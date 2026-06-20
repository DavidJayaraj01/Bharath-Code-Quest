import { useState, useEffect, useRef } from 'react';
import { useAuthStore } from '../store/authStore';
import api from '../api/client';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { Heart, Thermometer, Activity, Droplets, Clock, Pill, FileText, User, Loader2, Cpu, CheckCircle2, AlertCircle, Lock } from 'lucide-react';
import type { Patient, VitalReading, Prescription, ConversationSummary, DispenserDevice } from '../types';

const vitalIcons: Record<string, React.ReactNode> = {
  heart_rate: <Heart size={16} className="text-coral-500" />,
  temperature: <Thermometer size={16} className="text-amber-500" />,
  spo2: <Droplets size={16} className="text-blue-500" />,
  bp_systolic: <Activity size={16} className="text-coral-400" />,
  bp_diastolic: <Activity size={16} className="text-coral-400" />,
};

const vitalLabels: Record<string, string> = {
  heart_rate: 'Heart Rate',
  temperature: 'Temperature',
  spo2: 'SpO2',
  bp_systolic: 'BP (Systolic)',
  bp_diastolic: 'BP (Diastolic)',
};

const dispenserStateConfig: Record<string, { bg: string; text: string; icon: React.ReactNode; label: string }> = {
  locked: { bg: 'bg-slate-100 text-slate-500', text: 'text-slate-500', icon: <Lock size={14} />, label: 'Locked' },
  dose_window_open: { bg: 'bg-amber-50 text-amber-600 border-amber-200', text: 'text-amber-600', icon: <Clock size={14} className="animate-pulse" />, label: 'Dose Window Open' },
  dispensed: { bg: 'bg-teal-50 text-teal-600 border-teal-200', text: 'text-teal-600', icon: <CheckCircle2 size={14} />, label: 'Dispensed' },
  missed: { bg: 'bg-coral-500/10 text-coral-500 border-coral-500/20', text: 'text-coral-500', icon: <AlertCircle size={14} />, label: 'Missed' },
};

export default function PatientPassport() {
  const { user, token } = useAuthStore();
  const [profile, setProfile] = useState<Patient | null>(null);
  const [vitals, setVitals] = useState<VitalReading[]>([]);
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [history, setHistory] = useState<ConversationSummary[]>([]);
  const [activeVital, setActiveVital] = useState('heart_rate');
  
  // IoT state
  const [device, setDevice] = useState<DispenserDevice | null>(null);
  const [adherenceRate, setAdherenceRate] = useState<number>(100);
  
  const [loading, setLoading] = useState(true);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    Promise.all([
      api.get('/passport/profile'),
      api.get('/passport/vitals'),
      api.get('/passport/prescriptions'),
      api.get('/passport/history'),
      api.get('/iot/devices'),
    ]).then(([p, v, rx, h, devRes]) => {
      setProfile(p.data);
      setVitals(v.data);
      setPrescriptions(rx.data);
      setHistory(h.data);
      
      const patientDevice = devRes.data[0] || null;
      setDevice(patientDevice);
      
      if (patientDevice) {
        // Fetch adherence details from events
        api.get(`/iot/devices/${patientDevice.id}/events`).then(evRes => {
          const events = evRes.data;
          const taken = events.filter((e: any) => e.event_type === 'dose_taken').length;
          const missed = events.filter((e: any) => e.event_type === 'dose_missed' || e.to_state === 'missed').length;
          const total = taken + missed;
          if (total > 0) {
            setAdherenceRate(Math.round((taken / total) * 100));
          }
        });
      }
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  // Connect to device websocket for real-time status updates
  useEffect(() => {
    if (!device || !token) return;
    
    const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
    const ws = new WebSocket(`${protocol}://${window.location.host}/api/iot/ws/${device.id}?token=${token}`);
    wsRef.current = ws;

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'dispenser_event') {
        setDevice(prev => prev ? { ...prev, state: data.event.to_state } : null);
        
        // Refresh adherence calculation
        api.get(`/iot/devices/${device.id}/events`).then(evRes => {
          const events = evRes.data;
          const taken = events.filter((e: any) => e.event_type === 'dose_taken').length;
          const missed = events.filter((e: any) => e.event_type === 'dose_missed' || e.to_state === 'missed').length;
          const total = taken + missed;
          if (total > 0) {
            setAdherenceRate(Math.round((taken / total) * 100));
          }
        });
      }
    };

    return () => { ws.close(); };
  }, [device?.id, token]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 size={32} className="animate-spin text-teal-500" />
      </div>
    );
  }

  // Prepare chart data for active vital
  const chartData = vitals
    .filter(v => v.reading_type === activeVital)
    .sort((a, b) => new Date(a.recorded_at).getTime() - new Date(b.recorded_at).getTime())
    .map(v => ({
      date: new Date(v.recorded_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }),
      value: v.value,
      unit: v.unit,
    }));

  // Latest vitals (one per type)
  const latestVitals: Record<string, VitalReading> = {};
  vitals.forEach(v => {
    if (!latestVitals[v.reading_type]) latestVitals[v.reading_type] = v;
  });

  const stateConfig = device ? (dispenserStateConfig[device.state] || dispenserStateConfig.locked) : null;

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-navy-900">Health Passport</h1>
          <p className="text-sm text-slate-500">Your complete health record</p>
        </div>
      </div>

      {/* Profile Card */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
        <div className="flex items-start gap-5">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-teal-400 to-teal-600 flex items-center justify-center text-white text-2xl font-bold shadow-lg shadow-teal-500/20">
            {user?.full_name?.charAt(0)}
          </div>
          <div className="flex-1">
            <h2 className="text-xl font-bold text-navy-900">{user?.full_name}</h2>
            <p className="text-sm text-slate-500">{user?.email}</p>
            <div className="flex flex-wrap gap-4 mt-3">
              {profile?.gender && (
                <span className="text-xs bg-slate-100 text-slate-600 px-3 py-1 rounded-full flex items-center gap-1.5">
                  <User size={12} /> {profile.gender}
                </span>
              )}
              {profile?.blood_group && (
                <span className="text-xs bg-coral-500/10 text-coral-500 px-3 py-1 rounded-full flex items-center gap-1.5">
                  <Droplets size={12} /> {profile.blood_group}
                </span>
              )}
              {profile?.city && (
                <span className="text-xs bg-slate-100 text-slate-600 px-3 py-1 rounded-full">
                  {profile.city}, {profile.state}
                </span>
              )}
            </div>
            {(profile?.allergies?.length || 0) > 0 && (
              <div className="mt-3">
                <span className="text-xs text-slate-400">Allergies: </span>
                {profile?.allergies.map((a, i) => (
                  <span key={i} className="text-xs bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full mr-1">{a}</span>
                ))}
              </div>
            )}
            {(profile?.chronic_conditions?.length || 0) > 0 && (
              <div className="mt-2">
                <span className="text-xs text-slate-400">Conditions: </span>
                {profile?.chronic_conditions.map((c, i) => (
                  <span key={i} className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full mr-1">{c}</span>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Vitals Grid + Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Latest Vitals */}
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider">Latest Vitals</h3>
          {Object.entries(latestVitals).map(([type, v]) => (
            <button
              key={type}
              onClick={() => setActiveVital(type)}
              className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all text-left
                ${activeVital === type ? 'border-teal-500 bg-teal-50/50 shadow-sm' : 'border-slate-100 bg-white hover:border-slate-200'}`}
            >
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${activeVital === type ? 'bg-teal-100' : 'bg-slate-50'}`}>
                {vitalIcons[type] || <Activity size={16} />}
              </div>
              <div className="flex-1">
                <p className="text-xs text-slate-400">{vitalLabels[type] || type}</p>
                <p className="text-lg font-bold text-navy-900">{v.value} <span className="text-xs font-normal text-slate-400">{v.unit}</span></p>
              </div>
            </button>
          ))}
        </div>

        {/* Vitals Chart */}
        <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-slate-100 p-5">
          <h3 className="text-sm font-semibold text-slate-500 mb-4">
            {vitalLabels[activeVital] || activeVital} — 14 Day Trend
          </h3>
          {chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#94A3B8' }} />
                <YAxis tick={{ fontSize: 11, fill: '#94A3B8' }} domain={['auto', 'auto']} />
                <Tooltip
                  contentStyle={{ borderRadius: 12, border: '1px solid #E2E8F0', fontSize: 12 }}
                  formatter={(value: any) => [value, vitalLabels[activeVital]]}
                />
                <Line type="monotone" dataKey="value" stroke="#0D9488" strokeWidth={2} dot={{ r: 3, fill: '#0D9488' }} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-64 text-slate-300 text-sm">No data available</div>
          )}
        </div>
      </div>

      {/* IoT Pill Dispenser Status */}
      {device && stateConfig && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 animate-fade-in">
          <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-4 flex items-center gap-2">
            <Cpu size={16} className="text-teal-500 animate-pulse" />
            Smart Pill Dispenser Status
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="p-4 bg-slate-50 rounded-xl">
              <p className="text-[11px] text-slate-400 font-semibold uppercase">Device Name</p>
              <p className="text-sm font-bold text-navy-900 mt-1">{device.device_name}</p>
            </div>
            <div className="p-4 bg-slate-50 rounded-xl">
              <p className="text-[11px] text-slate-400 font-semibold uppercase">Medication & Dose</p>
              <p className="text-sm font-bold text-navy-900 mt-1">{device.medication_name} — {device.dosage}</p>
            </div>
            <div className="p-4 bg-slate-50 rounded-xl">
              <p className="text-[11px] text-slate-400 font-semibold uppercase">Device Status</p>
              <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1 rounded-full mt-2 border ${stateConfig.bg}`}>
                {stateConfig.icon}
                {stateConfig.label}
              </span>
            </div>
            <div className="p-4 bg-slate-50 rounded-xl">
              <p className="text-[11px] text-slate-400 font-semibold uppercase">Adherence Rating</p>
              <p className={`text-lg font-extrabold mt-1
                ${adherenceRate >= 80 ? 'text-teal-600' :
                  adherenceRate >= 60 ? 'text-amber-500' : 'text-coral-500'}`}>
                {adherenceRate}%
              </p>
            </div>
          </div>
          <div className="mt-4 flex items-center gap-2 text-xs text-slate-400">
            <Clock size={12} />
            <span>Scheduled dose times: {device.schedule_times.join(', ')}</span>
          </div>
        </div>
      )}

      {/* Prescriptions */}
      <div>
        <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-2">
          <Pill size={14} /> Prescriptions
        </h3>
        <div className="space-y-3">
          {prescriptions.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-100 p-8 text-center text-sm text-slate-400">
              No prescriptions yet
            </div>
          ) : (
            prescriptions.map((rx) => (
              <div key={rx.id} className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 animate-fade-in">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm font-semibold text-navy-900">{rx.diagnosis || 'Prescription'}</p>
                  <span className="text-[11px] text-slate-400 flex items-center gap-1">
                    <Clock size={10} />
                    {new Date(rx.created_at).toLocaleDateString()}
                  </span>
                </div>
                <div className="space-y-2">
                  {rx.medications.map((med, i) => (
                    <div key={i} className="flex items-center gap-3 p-2 bg-slate-50 rounded-lg">
                      <div className="w-8 h-8 rounded-lg bg-teal-50 flex items-center justify-center">
                        <Pill size={14} className="text-teal-500" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-navy-900">{med.name} — {med.dosage}</p>
                        <p className="text-[11px] text-slate-400">{med.frequency} • {med.duration}</p>
                      </div>
                    </div>
                  ))}
                </div>
                {rx.notes && <p className="text-xs text-slate-400 mt-3 italic">{rx.notes}</p>}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Visit History */}
      <div>
        <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-2">
          <FileText size={14} /> Visit History
        </h3>
        <div className="space-y-2">
          {history.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-100 p-8 text-center text-sm text-slate-400">
              No visits recorded
            </div>
          ) : (
            history.map((h) => {
              const sev = h.severity;
              const colors: Record<string, string> = {
                low: 'bg-teal-50 text-teal-600',
                medium: 'bg-amber-50 text-amber-600',
                high: 'bg-coral-500/10 text-coral-500',
                pending: 'bg-slate-100 text-slate-500',
              };
              return (
                <div key={h.id} className="bg-white rounded-xl border border-slate-100 px-5 py-3 flex items-center justify-between">
                  <div>
                    <p className="text-sm text-navy-900">{h.chief_complaint || 'Consultation'}</p>
                    <p className="text-[11px] text-slate-400">{new Date(h.created_at).toLocaleDateString()}</p>
                  </div>
                  <span className={`text-[11px] font-medium px-2.5 py-0.5 rounded-full ${colors[sev]}`}>
                    {sev.charAt(0).toUpperCase() + sev.slice(1)}
                  </span>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
