import { useState, useEffect } from 'react';
import api from '../api/client';
import { useAuthStore } from '../store/authStore';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { Activity, AlertTriangle, MapPin, TrendingUp, Loader2, Users, Pill, Clock, Globe } from 'lucide-react';
import type { SurveillanceSummary, SurveillanceRegionSummary, AdminDispenserDevice } from '../types';

function MapResizeInvalidator() {
  const map = useMap();
  useEffect(() => {
    const handleResize = () => {
      setTimeout(() => {
        map.invalidateSize();
      }, 200);
    };
    window.addEventListener('resize', handleResize);
    handleResize();
    return () => window.removeEventListener('resize', handleResize);
  }, [map]);
  return null;
}

const alertColors: Record<string, { bg: string; text: string; dot: string; mapColor: string }> = {
  normal: { bg: 'bg-teal-50', text: 'text-teal-600', dot: 'bg-teal-400', mapColor: '#14B8A6' },
  watch: { bg: 'bg-blue-50', text: 'text-blue-600', dot: 'bg-blue-400', mapColor: '#3B82F6' },
  warning: { bg: 'bg-amber-50', text: 'text-amber-600', dot: 'bg-amber-400', mapColor: '#F59E0B' },
  critical: { bg: 'bg-coral-500/10', text: 'text-coral-500', dot: 'bg-coral-500', mapColor: '#EF4444' },
};

const dispenserStateColors: Record<string, { bg: string; text: string; label: string }> = {
  locked: { bg: 'bg-slate-100/80 text-slate-500', label: 'Locked', text: 'text-slate-500' },
  dose_window_open: { bg: 'bg-amber-50 text-amber-600', label: 'Dose Window Open', text: 'text-amber-500' },
  dispensed: { bg: 'bg-teal-50 text-teal-600', label: 'Dispensed', text: 'text-teal-500' },
  missed: { bg: 'bg-coral-500/10 text-coral-500', label: 'Missed Dose', text: 'text-coral-500' },
};

const PIE_COLORS = ['#0D9488', '#14B8A6', '#F59E0B', '#EF4444', '#6366F1'];

interface LiveEventLog {
  timestamp: string;
  patientName: string;
  deviceName: string;
  medicationName: string;
  toState: string;
}

export default function SurveillanceDashboard() {
  const { token } = useAuthStore();
  const [activeTab, setActiveTab] = useState<'outbreak' | 'adherence'>('outbreak');
  const [summary, setSummary] = useState<SurveillanceSummary | null>(null);
  const [selectedRegion, setSelectedRegion] = useState<SurveillanceRegionSummary | null>(null);

  // IoT Adherence States
  const [devices, setDevices] = useState<AdminDispenserDevice[]>([]);
  const [liveLogs, setLiveLogs] = useState<LiveEventLog[]>([]);

  const [loadingSummary, setLoadingSummary] = useState(true);
  const [loadingDevices, setLoadingDevices] = useState(false);

  // Load Outbreak Summary
  useEffect(() => {
    api.get('/surveillance/summary').then(r => {
      setSummary(r.data);
      setLoadingSummary(false);
    }).catch(() => setLoadingSummary(false));
  }, []);

  // Load Devices on mount / tab switch
  useEffect(() => {
    if (activeTab === 'adherence') {
      setLoadingDevices(true);
      api.get('/iot/admin/devices').then(r => {
        setDevices(r.data);
        setLoadingDevices(false);
      }).catch(() => setLoadingDevices(false));
    }
  }, [activeTab]);

  // Live WebSocket for both Surveillance and IoT Adherence
  useEffect(() => {
    if (!token) return;
    let wsUrl = import.meta.env.VITE_BACKEND_WS_URL;
    if (wsUrl) {
      if (!wsUrl.endsWith('/')) wsUrl += '/';
      wsUrl += `api/surveillance/ws?token=${token}`;
    } else {
      const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
      const host = window.location.hostname === 'localhost' ? 'localhost:8000' : window.location.host;
      wsUrl = `${protocol}://${host}/api/surveillance/ws?token=${token}`;
    }
    const ws = new WebSocket(wsUrl);

    ws.onmessage = (e) => {
      const data = JSON.parse(e.data);
      if (data.type === 'surveillance_update') {
        api.get('/surveillance/summary').then(r => setSummary(r.data));
      } else if (data.type === 'dispenser_state_change') {
        setDevices(prev => prev.map(d => {
          if (d.device_id === data.device_id) {
            const updated = {
              ...d,
              state: data.to_state,
              adherence_rate: data.adherence_rate,
              last_event_time: data.last_event_time
            };
            const logEntry: LiveEventLog = {
              timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
              patientName: d.patient_name,
              deviceName: d.device_name,
              medicationName: d.medication_name,
              toState: data.to_state
            };
            setLiveLogs(logs => [logEntry, ...logs.slice(0, 19)]);
            return updated;
          }
          return d;
        }));
      }
    };
    return () => ws.close();
  }, [token]);

  if (loadingSummary) return <div className="flex items-center justify-center h-full"><Loader2 size={32} className="animate-spin text-teal-500" /></div>;

  const barData = summary?.regions
    .sort((a, b) => b.total_cases - a.total_cases)
    .map(r => ({ name: r.region, cases: r.total_cases, risk: Math.round(r.max_risk_score * 100) })) || [];

  const categoryTotals: Record<string, number> = {};
  summary?.regions.forEach(r => {
    (Object.entries(r.categories) as [string, number][]).forEach(([cat, count]) => {
      categoryTotals[cat] = (categoryTotals[cat] || 0) + count;
    });
  });
  const pieData = Object.entries(categoryTotals).map(([name, value]) => ({ name, value }));

  // Map center: approximate center of India
  const mapCenter: [number, number] = [22.5, 78.5];

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-navy-900 flex items-center gap-2">
            <Activity size={24} className="text-teal-500" />
            Disease Surveillance & Adherence
          </h1>
          <p className="text-sm text-slate-500 mt-1">Real-time disease outbreak and IoT adherence monitoring</p>
        </div>

        {/* Tab Toggle */}
        <div className="flex bg-slate-100 p-1 rounded-xl self-start sm:self-center">
          <button
            onClick={() => setActiveTab('outbreak')}
            className={`px-4 py-2 text-xs font-semibold rounded-lg transition-all ${activeTab === 'outbreak' ? 'bg-white text-navy-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            Outbreak Monitoring
          </button>
          <button
            onClick={() => setActiveTab('adherence')}
            className={`px-4 py-2 text-xs font-semibold rounded-lg transition-all ${activeTab === 'adherence' ? 'bg-white text-navy-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            Medication Adherence (IoT)
          </button>
        </div>
      </div>

      {activeTab === 'outbreak' ? (
        <>
          {/* Stats Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Total Cases', value: summary?.total_cases || 0, icon: <Users size={20} />, color: 'text-teal-500 bg-teal-50' },
              { label: 'Regions Monitored', value: summary?.total_regions || 0, icon: <MapPin size={20} />, color: 'text-blue-500 bg-blue-50' },
              { label: 'Critical Zones', value: summary?.critical_regions || 0, icon: <AlertTriangle size={20} />, color: 'text-coral-500 bg-coral-500/10' },
              { label: 'Triages (24h)', value: summary?.recent_triages_24h || 0, icon: <TrendingUp size={20} />, color: 'text-amber-500 bg-amber-50' },
            ].map((stat, i) => (
              <div key={i} className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 animate-count-up" style={{ animationDelay: `${i * 100}ms` }}>
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${stat.color}`}>
                  {stat.icon}
                </div>
                <p className="text-2xl font-bold text-navy-900">{stat.value}</p>
                <p className="text-xs text-slate-400 mt-0.5">{stat.label}</p>
              </div>
            ))}
          </div>

          {/* ── Interactive Outbreak Map ── */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
            <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-4 flex items-center gap-2">
              <Globe size={16} className="text-teal-500" />
              Live Outbreak Map — India
            </h3>
            <div className="rounded-xl overflow-hidden border border-slate-200 h-[40vh] md:h-[420px]">
              <MapContainer
                center={mapCenter}
                zoom={5}
                style={{ height: '100%', width: '100%' }}
                scrollWheelZoom={true}
              >
                <MapResizeInvalidator />
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                {summary?.regions.map(region => {
                  const alert = alertColors[region.alert_level] || alertColors.normal;
                  const radius = Math.max(8, Math.min(30, region.total_cases / 3));
                  return (
                    <CircleMarker
                      key={region.region}
                      center={[region.latitude, region.longitude]}
                      radius={radius}
                      pathOptions={{
                        color: alert.mapColor,
                        fillColor: alert.mapColor,
                        fillOpacity: 0.4,
                        weight: 2,
                      }}
                      eventHandlers={{ click: () => setSelectedRegion(region) }}
                    >
                      <Popup>
                        <div className="text-xs font-sans">
                          <p className="font-bold text-sm mb-1">{region.region}</p>
                          <p>Alert: <span className="font-semibold uppercase">{region.alert_level}</span></p>
                          <p>Cases: <span className="font-semibold">{region.total_cases}</span></p>
                          <p>Risk Score: <span className="font-semibold">{Math.round(region.max_risk_score * 100)}%</span></p>
                          <div className="mt-1 pt-1 border-t border-slate-200">
                            {Object.entries(region.categories).map(([cat, count]) => (
                              <p key={cat} className="capitalize">{cat}: {count}</p>
                            ))}
                          </div>
                        </div>
                      </Popup>
                    </CircleMarker>
                  );
                })}
              </MapContainer>
            </div>
            <div className="flex items-center gap-6 mt-3 text-xs text-slate-400">
              <span className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-teal-400" /> Normal</span>
              <span className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-blue-400" /> Watch</span>
              <span className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-amber-400" /> Warning</span>
              <span className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-full bg-coral-500" /> Critical</span>
              <span className="ml-auto">Circle size = case volume</span>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Region List */}
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
              <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-4">Regions</h3>
              <div className="space-y-2">
                {summary?.regions
                  .sort((a, b) => b.max_risk_score - a.max_risk_score)
                  .map(region => {
                    const alert = alertColors[region.alert_level] || alertColors.normal;
                    return (
                      <button
                        key={region.region}
                        onClick={() => setSelectedRegion(region)}
                        className={`w-full text-left p-3 rounded-xl border transition-all
                          ${selectedRegion?.region === region.region
                            ? 'border-teal-500 bg-teal-50/50'
                            : 'border-slate-100 hover:border-slate-200'}`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className={`w-2.5 h-2.5 rounded-full ${alert.dot}`} />
                            <span className="text-sm font-medium text-navy-900">{region.region}</span>
                          </div>
                          <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${alert.bg} ${alert.text}`}>
                            {region.alert_level.toUpperCase()}
                          </span>
                        </div>
                        <div className="flex items-center justify-between mt-1.5">
                          <span className="text-xs text-slate-400">{region.total_cases} cases</span>
                          <span className="text-xs text-slate-400">Risk: {Math.round(region.max_risk_score * 100)}%</span>
                        </div>
                      </button>
                    );
                  })}
              </div>
            </div>

            {/* Charts */}
            <div className="lg:col-span-2 space-y-6">
              {/* Bar Chart — cases by region */}
              <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
                <h3 className="text-sm font-semibold text-slate-500 mb-4">Cases by Region</h3>
                {barData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={barData}>
                      <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#94A3B8' }} />
                      <YAxis tick={{ fontSize: 11, fill: '#94A3B8' }} />
                      <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #E2E8F0', fontSize: 12 }} />
                      <Bar dataKey="cases" fill="#0D9488" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-64 text-slate-300 text-sm">No data available</div>
                )}
              </div>

              {/* Symptom Category Breakdown */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
                  <h3 className="text-sm font-semibold text-slate-500 mb-4">Symptom Categories</h3>
                  {pieData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={200}>
                      <PieChart>
                        <Pie data={pieData} cx="50%" cy="50%" innerRadius={45} outerRadius={80} paddingAngle={3} dataKey="value">
                          {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                        </Pie>
                        <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #E2E8F0', fontSize: 12 }} />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex items-center justify-center h-48 text-slate-300 text-sm">No data available</div>
                  )}
                  <div className="flex flex-wrap gap-2 mt-3">
                    {pieData.map((d, i) => (
                      <span key={d.name} className="text-[11px] flex items-center gap-1.5">
                        <div className="w-2.5 h-2.5 rounded-full" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                        <span className="capitalize text-slate-500">{d.name}</span>
                        <span className="font-medium text-navy-900">{d.value}</span>
                      </span>
                    ))}
                  </div>
                </div>

                {/* Region Detail */}
                {selectedRegion && (
                  <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 animate-fade-in">
                    <h3 className="text-sm font-semibold text-slate-500 mb-2">
                      <MapPin size={14} className="inline mr-1" />
                      {selectedRegion.region} Detail
                    </h3>
                    <div className="space-y-3 mt-4">
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-400">Total Cases</span>
                        <span className="font-bold text-navy-900">{selectedRegion.total_cases}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-400">Risk Score</span>
                        <span className="font-bold text-navy-900">{Math.round(selectedRegion.max_risk_score * 100)}%</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-slate-400">Coordinates</span>
                        <span className="text-xs text-slate-500">{selectedRegion.latitude.toFixed(2)}, {selectedRegion.longitude.toFixed(2)}</span>
                      </div>
                      <div className="pt-2 border-t border-slate-100">
                        <p className="text-xs text-slate-400 mb-2">Breakdown</p>
                        {(Object.entries(selectedRegion.categories) as [string, number][]).map(([cat, count]) => (
                          <div key={cat} className="flex items-center justify-between py-1">
                            <span className="text-xs capitalize text-slate-500">{cat}</span>
                            <div className="flex items-center gap-2">
                              <div className="w-20 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                <div className="h-full bg-teal-400 rounded-full" style={{ width: `${Math.min(100, (count / selectedRegion.total_cases) * 100)}%` }} />
                              </div>
                              <span className="text-xs font-medium text-navy-900 w-6 text-right">{count}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Patient Adherence List */}
          <div className="lg:col-span-2 space-y-4">
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider">Patient IoT Dispenser List</h3>
                {loadingDevices && <Loader2 size={16} className="animate-spin text-teal-500" />}
              </div>

              {devices.length === 0 ? (
                <p className="text-sm text-slate-400 py-6 text-center">No active dispenser devices found.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm border-collapse">
                    <thead>
                      <tr className="border-b border-slate-100 text-slate-400 text-xs font-semibold uppercase">
                        <th className="pb-3 pr-2">Patient</th>
                        <th className="pb-3 pr-2">Device & Medication</th>
                        <th className="pb-3 pr-2 text-center">Adherence</th>
                        <th className="pb-3 pr-2">Current State</th>
                        <th className="pb-3">Last Trigger</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {devices.map(device => {
                        const stateConf = dispenserStateColors[device.state] || dispenserStateColors.locked;
                        return (
                          <tr key={device.device_id} className="hover:bg-slate-50/50 transition-colors">
                            <td className="py-3.5 pr-2">
                              <p className="font-semibold text-navy-900">{device.patient_name}</p>
                              <p className="text-[11px] text-slate-400 capitalize">
                                {device.patient_age ? `${device.patient_age}y • ` : ''}{device.patient_gender || ''}
                              </p>
                            </td>
                            <td className="py-3.5 pr-2">
                              <p className="font-medium text-navy-900">{device.medication_name} ({device.dosage})</p>
                              <p className="text-[11px] text-slate-400">{device.device_name}</p>
                            </td>
                            <td className="py-3.5 pr-2 text-center">
                              <span className={`inline-block px-2.5 py-1 rounded-lg text-xs font-bold
                                ${device.adherence_rate >= 80 ? 'bg-teal-50 text-teal-600' :
                                  device.adherence_rate >= 60 ? 'bg-amber-50 text-amber-600' :
                                  'bg-coral-500/10 text-coral-500'}`}>
                                {device.adherence_rate}%
                              </span>
                            </td>
                            <td className="py-3.5 pr-2">
                              <span className={`inline-block text-xs font-medium px-2.5 py-0.5 rounded-full ${stateConf.bg}`}>
                                {stateConf.label}
                              </span>
                            </td>
                            <td className="py-3.5 text-xs text-slate-400">
                              {device.last_event_time ? new Date(device.last_event_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'No events'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          {/* Live Events Logs Feed */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 flex flex-col h-[500px]">
            <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-4 flex items-center gap-2">
              <Clock size={16} className="text-teal-500" />
              Live Simulator Log
            </h3>

            <div className="flex-1 overflow-auto space-y-3 pr-1">
              {liveLogs.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-slate-300 text-center px-4">
                  <Pill size={32} className="mb-2 text-slate-200" />
                  <p className="text-sm">Listening for live events...</p>
                  <p className="text-[11px] text-slate-400 mt-0.5">IoT state changes will stream here instantly.</p>
                </div>
              ) : (
                liveLogs.map((log, index) => {
                  const stateConf = dispenserStateColors[log.toState] || dispenserStateColors.locked;
                  return (
                    <div key={index} className="text-xs p-3 bg-slate-50 border border-slate-100 rounded-xl space-y-1 animate-fade-in">
                      <div className="flex items-center justify-between text-[10px] text-slate-400">
                        <span>{log.timestamp}</span>
                        <span className="font-semibold">{log.deviceName}</span>
                      </div>
                      <p className="text-navy-900 font-medium">{log.patientName}</p>
                      <p className="text-slate-500">
                        {log.medicationName} state changed to{' '}
                        <span className={`font-semibold ${stateConf.text}`}>{stateConf.label}</span>
                      </p>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
