import { useState, useEffect, useRef } from 'react';
import { useAuthStore } from '../store/authStore';
import api from '../api/client';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine } from 'recharts';
import {
  Activity, Clock, Pill, FileText, User, Loader2, Cpu, CheckCircle2, AlertCircle,
  Plus, Phone, MapPin, Calendar, ShieldAlert, Sparkles, X, HeartHandshake, Eye,
  Download, Settings
} from 'lucide-react';
import type { Patient, VitalReading, Prescription, ConversationSummary, DispenserDevice } from '../types';
import RiskScoreGauge from '../components/passport/RiskScoreGauge';

// Helper to determine operating status based on hours
const getIsOpenText = (open24h: boolean) => {
  if (open24h) return { text: 'Open 24hrs', open: true };
  const hour = new Date().getHours();
  const open = hour >= 8 && hour < 20;
  return { text: open ? 'Open (8 AM - 8 PM)' : 'Closed Now', open };
};

// Seeded local vaccine structures
interface Vaccine {
  name: string;
  dateAdministered?: string;
  nextDue?: string;
  status: 'up-to-date' | 'due-soon' | 'overdue';
}

// Seeded local contact structures
interface Contact {
  name: string;
  relationship: string;
  phone: string;
}

export default function PatientPassport() {
  const { user, token } = useAuthStore();
  const [profile, setProfile] = useState<Patient | null>(null);
  const [vitals, setVitals] = useState<VitalReading[]>([]);
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [history, setHistory] = useState<ConversationSummary[]>([]);
  const [fhirData, setFhirData] = useState<any>(null);
  const [activeVital, setActiveVital] = useState('heart_rate');

  // Nearby Hospitals & Appointments
  const [hospitals, setHospitals] = useState<any[]>([]);
  const [appointingDocId, setAppointingDocId] = useState<string | null>(null);
  const [appointSuccess, setAppointSuccess] = useState<string | null>(null);
  const [appointError, setAppointError] = useState<string | null>(null);
  
  const [device, setDevice] = useState<DispenserDevice | null>(null);
  const [adherenceRate, setAdherenceRate] = useState<number>(100);
  const [riskData, setRiskData] = useState<{ score: number; band: 'low' | 'moderate' | 'high'; signals: string[] } | null>(null);
  
  const [loading, setLoading] = useState(true);
  const wsRef = useRef<WebSocket | null>(null);

  // Expanded hospital list state
  const [expandedHospitals, setExpandedHospitals] = useState<boolean>(false);

  // New section states
  const [vaccines, setVaccines] = useState<Vaccine[]>([
    { name: 'BCG', dateAdministered: '2020-05-15', status: 'up-to-date' },
    { name: 'OPV', dateAdministered: '2022-09-10', nextDue: '2026-12-10', status: 'up-to-date' },
    { name: 'COVID Booster', dateAdministered: '2023-01-20', nextDue: '2026-09-15', status: 'due-soon' }
  ]);
  
  const [contacts, setContacts] = useState<Contact[]>([
    { name: 'Suresh Sharma', relationship: 'Husband', phone: '+91-98402-98765' }
  ]);

  const [ashaWorker] = useState({
    name: 'Kamala Devi',
    phone: '+91-94440-12345',
    area: 'Chennai District Zone 4',
    photo: 'KD'
  });

  // Modal control states
  const [selectedTriage, setSelectedTriage] = useState<ConversationSummary | null>(null);
  const [triageMessages, setTriageMessages] = useState<any[]>([]);
  const [loadingTriageMessages, setLoadingTriageMessages] = useState(false);
  
  const [showAddVaccineModal, setShowAddVaccineModal] = useState(false);
  const [newVaccine, setNewVaccine] = useState({ name: '', dateAdministered: '', nextDue: '', status: 'up-to-date' as const });

  const [showAddContactModal, setShowAddContactModal] = useState(false);
  const [newContact, setNewContact] = useState({ name: '', relationship: '', phone: '' });

  const [showQRModal, setShowQRModal] = useState<{ id: string; name: string } | null>(null);

  // Wearable simulated state
  const [wearableConnected, setWearableConnected] = useState(true);

  // Load all initial data
  useEffect(() => {
    Promise.all([
      api.get('/passport/profile'),
      api.get('/passport/vitals'),
      api.get('/passport/prescriptions'),
      api.get('/passport/history'),
      api.get('/iot/devices'),
      api.get('/passport/fhir'),
      api.get('/passport/nearby-hospitals'),
      api.get('/risk/my/score'),
    ]).then(([p, v, rx, h, devRes, fhirRes, hospRes, riskRes]) => {
      setProfile(p.data);
      setVitals(v.data);
      setPrescriptions(rx.data);
      setHistory(h.data);
      setFhirData(fhirRes.data);
      setHospitals(hospRes.data);
      setRiskData(riskRes.data);
      
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

  // Handle URL hash on startup for smooth scroll
  useEffect(() => {
    if (!loading && window.location.hash) {
      const id = window.location.hash.substring(1);
      setTimeout(() => {
        const el = document.getElementById(id);
        if (el) el.scrollIntoView({ behavior: 'smooth' });
      }, 300);
    }
  }, [loading]);

  const handleAppoint = async (doctorId: string) => {
    setAppointingDocId(doctorId);
    setAppointSuccess(null);
    setAppointError(null);
    try {
      const activeConv = history.find(h => h.status === 'active' || h.status === 'escalated');
      const { data } = await api.post('/passport/appoint', {
        doctor_id: doctorId,
        conversation_id: activeConv?.id || null
      });
      if (data.success) {
        setAppointSuccess(data.message);
        const histRes = await api.get('/passport/history');
        setHistory(histRes.data);
      }
    } catch (err: any) {
      setAppointError(err.response?.data?.detail || 'Failed to request appointment');
    } finally {
      setAppointingDocId(null);
    }
  };

  // Find More hospitals handler
  const handleFindMoreHospitals = async () => {
    try {
      const dist = profile?.city || 'Chennai';
      const { data } = await api.get(`/hospitals?district=${dist}&limit=10`);
      setHospitals(data);
      setExpandedHospitals(true);
    } catch (err) {
      console.error('Failed to load more hospitals', err);
    }
  };

  // Open conversation details modal
  const handleViewConversation = async (conv: ConversationSummary) => {
    setSelectedTriage(conv);
    setTriageMessages([]);
    setLoadingTriageMessages(true);
    try {
      // Endpoint is /api/triage/history/{id}/messages or similar
      const { data } = await api.get(`/triage/history/${conv.id}/messages`);
      setTriageMessages(data);
    } catch (err) {
      console.error('Error fetching conversation messages:', err);
    } finally {
      setLoadingTriageMessages(false);
    }
  };

  // Connect to device websocket for real-time status updates
  useEffect(() => {
    if (!device || !token) return;
    
    const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
    const host = window.location.hostname === 'localhost' ? 'localhost:8000' : window.location.host;
    const ws = new WebSocket(`${protocol}://${host}/api/iot/ws/${device.id}?token=${token}`);
    wsRef.current = ws;

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'dispenser_event') {
        setDevice(prev => prev ? { ...prev, state: data.event.to_state } : null);
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

  // Connect to risk score websocket for real-time risk updates
  useEffect(() => {
    if (!profile || !token) return;
    
    const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
    const host = window.location.hostname === 'localhost' ? 'localhost:8000' : window.location.host;
    const ws = new WebSocket(`${protocol}://${host}/api/risk/ws/${profile.id}?token=${token}`);

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === 'risk_update') {
        setRiskData({
          score: data.score,
          band: data.band,
          signals: data.signals,
        });
      }
    };

    return () => { ws.close(); };
  }, [profile?.id, token]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 size={32} className="animate-spin text-[#0D9488]" />
      </div>
    );
  }

  // Fallback for empty vitals
  const getDummyVitals = (type: string): VitalReading[] => {
    const now = Date.now();
    const oneDay = 24 * 3600 * 1000;
    if (type === 'heart_rate') {
      return [
        { id: 'h4', reading_type: 'heart_rate', value: 74, unit: 'bpm', recorded_at: new Date().toISOString() },
        { id: 'h3', reading_type: 'heart_rate', value: 80, unit: 'bpm', recorded_at: new Date(now - 2 * oneDay).toISOString() },
        { id: 'h2', reading_type: 'heart_rate', value: 75, unit: 'bpm', recorded_at: new Date(now - 4 * oneDay).toISOString() },
        { id: 'h1', reading_type: 'heart_rate', value: 72, unit: 'bpm', recorded_at: new Date(now - 6 * oneDay).toISOString() },
      ] as VitalReading[];
    }
    if (type === 'bp_systolic') {
      return [
        { id: 'b4', reading_type: 'bp_systolic', value: 119, unit: 'mmHg', recorded_at: new Date().toISOString() },
        { id: 'b3', reading_type: 'bp_systolic', value: 124, unit: 'mmHg', recorded_at: new Date(now - 2 * oneDay).toISOString() },
        { id: 'b2', reading_type: 'bp_systolic', value: 120, unit: 'mmHg', recorded_at: new Date(now - 4 * oneDay).toISOString() },
        { id: 'b1', reading_type: 'bp_systolic', value: 118, unit: 'mmHg', recorded_at: new Date(now - 6 * oneDay).toISOString() },
      ] as VitalReading[];
    }
    if (type === 'spo2') {
      return [
        { id: 's4', reading_type: 'spo2', value: 98, unit: '%', recorded_at: new Date().toISOString() },
        { id: 's3', reading_type: 'spo2', value: 99, unit: '%', recorded_at: new Date(now - 2 * oneDay).toISOString() },
        { id: 's2', reading_type: 'spo2', value: 97, unit: '%', recorded_at: new Date(now - 4 * oneDay).toISOString() },
        { id: 's1', reading_type: 'spo2', value: 98, unit: '%', recorded_at: new Date(now - 6 * oneDay).toISOString() },
      ] as VitalReading[];
    }
    if (type === 'glucose') {
      return [
        { id: 'g4', reading_type: 'glucose', value: 115, unit: 'mg/dL', recorded_at: new Date().toISOString() },
        { id: 'g3', reading_type: 'glucose', value: 145, unit: 'mg/dL', recorded_at: new Date(now - 2 * oneDay).toISOString() },
        { id: 'g2', reading_type: 'glucose', value: 125, unit: 'mg/dL', recorded_at: new Date(now - 4 * oneDay).toISOString() },
        { id: 'g1', reading_type: 'glucose', value: 110, unit: 'mg/dL', recorded_at: new Date(now - 6 * oneDay).toISOString() },
      ] as VitalReading[];
    }
    return [];
  };

  const filteredVitals = vitals.filter(v => v.reading_type === activeVital);
  const displayedVitals = filteredVitals.length === 0 ? getDummyVitals(activeVital) : filteredVitals;

  const dummyPrescriptions = [
    {
      id: 'dummy-rx-1',
      diagnosis: 'Essential Hypertension & Type-2 Diabetes Management',
      created_at: new Date(Date.now() - 3 * 24 * 3600 * 1000).toISOString(),
      medications: [
        { name: 'Metformin', dosage: '500mg', frequency: 'Twice daily after meals' },
        { name: 'Amlodipine', dosage: '5mg', frequency: 'Once daily in the morning' }
      ]
    }
  ] as Prescription[];

  const displayedPrescriptions = prescriptions.length === 0 ? dummyPrescriptions : prescriptions;

  // Prepare chart data for active vital
  const chartData = [...displayedVitals]
    .sort((a, b) => new Date(a.recorded_at).getTime() - new Date(b.recorded_at).getTime())
    .map(v => ({
      date: new Date(v.recorded_at).toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit' }),
      value: v.value,
      unit: v.unit,
    }));

  const vitalRangeConfig: Record<string, { ceiling: number; floor?: number; unit: string; name: string }> = {
    heart_rate: { ceiling: 100, unit: 'bpm', name: 'Heart Rate' },
    bp_systolic: { ceiling: 130, unit: 'mmHg', name: 'Blood Pressure' },
    spo2: { floor: 95, ceiling: 100, unit: '%', name: 'SpO2' },
    glucose: { ceiling: 140, unit: 'mg/dL', name: 'Glucose' },
  };

  const currentRange = vitalRangeConfig[activeVital] || { ceiling: 100, unit: '', name: activeVital };

  // Calculate stats for selected vital
  const currentVal = displayedVitals[0]?.value || '—';
  const averageVal = displayedVitals.length > 0 
    ? Math.round(displayedVitals.reduce((sum: number, v) => sum + v.value, 0) / displayedVitals.length) 
    : '—';
  const peakVal = displayedVitals.length > 0 
    ? Math.max(...displayedVitals.map(v => v.value)) 
    : '—';

  // Custom Dot renderer for Recharts
  const CustomDot = (props: any) => {
    const { cx, cy, payload } = props;
    if (!cx || !cy) return null;
    let isAbnormal = false;
    if (activeVital === 'heart_rate') {
      isAbnormal = payload.value > 100;
    } else if (activeVital === 'bp_systolic') {
      isAbnormal = payload.value > 130;
    } else if (activeVital === 'spo2') {
      isAbnormal = payload.value < 95;
    } else if (activeVital === 'glucose') {
      isAbnormal = payload.value > 140;
    }
    return (
      <circle
        cx={cx}
        cy={cy}
        r={isAbnormal ? 5 : 3}
        fill={isAbnormal ? '#EF4444' : '#0D9488'}
        stroke={isAbnormal ? '#EF4444' : '#0D9488'}
        strokeWidth={isAbnormal ? 2 : 1}
      />
    );
  };

  // Get Next Dose time remaining
  const getNextDoseRemaining = () => {
    if (!device?.schedule_times || device.schedule_times.length === 0) return 'N/A';
    const now = new Date();
    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    
    let nextMin = Infinity;
    for (const time of device.schedule_times) {
      const [h, m] = time.split(':').map(Number);
      const targetMin = h * 60 + m;
      if (targetMin > currentMinutes && targetMin < nextMin) {
        nextMin = targetMin;
      }
    }
    
    if (nextMin === Infinity) {
      const [h, m] = device.schedule_times[0].split(':').map(Number);
      nextMin = h * 60 + m + 24 * 60;
    }
    
    const diffMinutes = nextMin - currentMinutes;
    const hours = Math.floor(diffMinutes / 60);
    const mins = diffMinutes % 60;
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
  };

  // Get Last Triage text
  const getLastTriageText = () => {
    if (history.length === 0) return 'Never';
    const diffTime = Math.abs(Date.now() - new Date(history[0].created_at).getTime());
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    return diffDays === 0 ? 'Today' : `${diffDays} days ago`;
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6 animate-fade-in pb-16">
      {/* Redesigned Rich Profile Header */}
      <div className="bg-[#0D1B2A] rounded-2xl shadow-xl border border-slate-800 p-6 text-white">
        <div className="flex flex-col lg:flex-row gap-6 justify-between items-start lg:items-center">
          <div className="flex items-center gap-5">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#0D9488] to-[#CCFBF1] flex items-center justify-center text-[#0D1B2A] text-2xl font-extrabold shadow-lg shadow-teal-500/20">
              {user?.full_name?.charAt(0) || 'P'}
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h2 className="text-xl font-bold text-white">{user?.full_name || 'Priya Sharma'}</h2>
                <span className="text-[11px] bg-[#CCFBF1] text-[#0D9488] px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider">
                  Active Patient
                </span>
              </div>
              <p className="text-sm text-slate-400 mt-0.5">{user?.email || 'priya.sharma@demo.vitalbridge.in'}</p>
            </div>
          </div>

          {/* Metric Pills */}
          <div className="flex flex-wrap gap-3">
            <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl px-4 py-2 text-center min-w-[100px]">
              <p className="text-[10px] text-slate-400 uppercase tracking-wide">Health ID</p>
              <p className="text-xs font-bold text-teal-400 mt-0.5">VB-2024-00042</p>
            </div>
            <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl px-4 py-2 text-center min-w-[80px]">
              <p className="text-[10px] text-slate-400 uppercase tracking-wide">Age</p>
              <p className="text-xs font-bold text-teal-400 mt-0.5">{profile?.gender === 'Female' ? 28 : 34} yrs</p>
            </div>
            <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl px-4 py-2 text-center min-w-[80px]">
              <p className="text-[10px] text-slate-400 uppercase tracking-wide">Blood Group</p>
              <p className="text-xs font-bold text-teal-400 mt-0.5">{profile?.blood_group || 'B+'}</p>
            </div>
          </div>
        </div>

        {/* Real-time Quick Stats Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6 pt-6 border-t border-slate-800/80">
          <div className="bg-slate-800/30 p-4 rounded-xl border border-slate-800 hover:border-slate-700/50 transition-all">
            <p className="text-[10px] text-slate-400 uppercase font-semibold">Last Triage</p>
            <p className="text-base font-bold text-[#F59E0B] mt-1 flex items-center gap-1.5">
              <Calendar size={14} /> {getLastTriageText()}
            </p>
          </div>
          <div className="bg-slate-800/30 p-4 rounded-xl border border-slate-800 hover:border-slate-700/50 transition-all">
            <p className="text-[10px] text-slate-400 uppercase font-semibold">Risk Score</p>
            <p className={`text-base font-bold mt-1
              ${(riskData?.score || 0) > 75 ? 'text-[#EF4444]' :
                (riskData?.score || 0) > 40 ? 'text-[#F59E0B]' : 'text-[#0D9488]'}`}>
              {riskData?.score || 0} / 100
            </p>
          </div>
          <div className="bg-slate-800/30 p-4 rounded-xl border border-slate-800 hover:border-slate-700/50 transition-all">
            <p className="text-[10px] text-slate-400 uppercase font-semibold">Adherence Rate</p>
            <p className={`text-base font-bold mt-1
              ${adherenceRate >= 80 ? 'text-[#0D9488]' :
                adherenceRate >= 60 ? 'text-[#F59E0B]' : 'text-[#EF4444]'}`}>
              {adherenceRate}% this week
            </p>
          </div>
          <div className="bg-slate-800/30 p-4 rounded-xl border border-slate-800 hover:border-slate-700/50 transition-all">
            <p className="text-[10px] text-slate-400 uppercase font-semibold">Next Dose</p>
            <p className="text-base font-bold text-teal-400 mt-1 flex items-center gap-1.5">
              <Clock size={14} className="animate-pulse" /> {getNextDoseRemaining()}
            </p>
          </div>
        </div>
      </div>

      {/* Main Grid: Vitals & Smart Dispenser */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Risk score gauge column */}
        <div className="lg:col-span-1 flex flex-col gap-6">
          {riskData && (
            <RiskScoreGauge
              score={riskData.score}
              band={riskData.band}
              signals={riskData.signals}
            />
          )}

          {/* IoT Pill Dispenser Manual Controls & Details */}
          {device && (
            <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 flex flex-col justify-between">
              <div>
                <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-4 flex items-center gap-2">
                  <Cpu size={16} className="text-[#0D9488]" />
                  IoT Pill Dispenser
                </h3>
                <div className="space-y-4">
                  <div className="flex justify-between items-center py-2 border-b border-slate-50">
                    <span className="text-xs text-slate-400">Device</span>
                    <span className="text-xs font-bold text-slate-700">{device.device_name}</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-slate-50">
                    <span className="text-xs text-slate-400">Medication</span>
                    <span className="text-xs font-bold text-slate-700">{device.medication_name} ({device.dosage})</span>
                  </div>
                  <div className="flex justify-between items-center py-2 border-b border-slate-50">
                    <span className="text-xs text-slate-400">Status</span>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full uppercase
                      ${device.state === 'locked' ? 'bg-slate-100 text-slate-600' :
                        device.state === 'dose_window_open' ? 'bg-amber-100 text-amber-700' :
                        device.state === 'dispensed' ? 'bg-teal-100 text-teal-700' : 'bg-red-100 text-red-700'}`}>
                      {device.state}
                    </span>
                  </div>
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-slate-100 space-y-3">
                <button
                  id="iot-take-dose-btn"
                  onClick={async () => {
                    try {
                      const res = await api.post(`/iot/devices/${device.id}/take-dose`);
                      setDevice(prev => prev ? { ...prev, state: 'dispensed' } : null);
                      setAdherenceRate(res.data.adherence_rate);
                    } catch (err) { console.error(err); }
                  }}
                  className="w-full justify-center px-4 py-2 bg-[#0D9488] hover:bg-teal-600 text-white text-xs font-semibold rounded-xl transition-all shadow-sm flex items-center gap-2"
                >
                  <CheckCircle2 size={14} /> Take Dose
                </button>
                <button
                  id="iot-miss-dose-btn"
                  onClick={async () => {
                    try {
                      const res = await api.post(`/iot/devices/${device.id}/miss-dose`);
                      setDevice(prev => prev ? { ...prev, state: 'missed' } : null);
                      setAdherenceRate(res.data.adherence_rate);
                    } catch (err) { console.error(err); }
                  }}
                  className="w-full justify-center px-4 py-2 bg-[#EF4444] hover:bg-red-500 text-white text-xs font-semibold rounded-xl transition-all shadow-sm flex items-center gap-2"
                >
                  <AlertCircle size={14} /> Miss Dose
                </button>
              </div>
            </div>
          )}
        </div>

        {/* PART 3: Vitals Dashboard Section */}
        <div id="vitals-section" className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-slate-100 p-6 flex flex-col justify-between">
          <div>
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
              <div>
                <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                  <Activity size={16} className="text-[#0D9488]" />
                  Vitals Dashboard
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">14-day tracking from biosensors</p>
              </div>

              {/* Selector Tabs */}
              <div className="flex bg-slate-100 p-1 rounded-xl">
                {Object.keys(vitalRangeConfig).map((key) => (
                  <button
                    key={key}
                    onClick={() => setActiveVital(key)}
                    className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all
                      ${activeVital === key ? 'bg-white text-[#0D1B2A] shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
                  >
                    {vitalRangeConfig[key].name}
                  </button>
                ))}
              </div>
            </div>

            {/* Recharts Area Chart */}
            <div className="h-64">
              {chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                    <defs>
                      <linearGradient id="colorVal" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#0D9488" stopOpacity={0.2} />
                        <stop offset="95%" stopColor="#0D9488" stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F1F5F9" />
                    <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#94A3B8' }} />
                    <YAxis tick={{ fontSize: 10, fill: '#94A3B8' }} domain={['auto', 'auto']} />
                    <Tooltip
                      contentStyle={{ borderRadius: 12, border: '1px solid #E2E8F0', fontSize: 11 }}
                      formatter={(value: any) => [value, currentRange.name]}
                    />
                    {currentRange.ceiling && (
                      <ReferenceLine y={currentRange.ceiling} stroke="#EF4444" strokeDasharray="3 3" label={{ value: `Ceiling: ${currentRange.ceiling}`, fill: '#EF4444', fontSize: 9, position: 'top' }} />
                    )}
                    {currentRange.floor && (
                      <ReferenceLine y={currentRange.floor} stroke="#EF4444" strokeDasharray="3 3" label={{ value: `Floor: ${currentRange.floor}`, fill: '#EF4444', fontSize: 9, position: 'bottom' }} />
                    )}
                    <Area type="monotone" dataKey="value" stroke="#0D9488" strokeWidth={2} fillOpacity={1} fill="url(#colorVal)" dot={<CustomDot />} />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-slate-300 text-sm">No data available</div>
              )}
            </div>
          </div>

          {/* Stats below chart */}
          <div className="grid grid-cols-3 gap-4 mt-6 pt-6 border-t border-slate-100">
            <div className="text-center p-3 bg-slate-50 rounded-xl">
              <p className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Latest</p>
              <p className="text-xl font-extrabold text-[#0D1B2A] mt-1">
                {currentVal} <span className="text-[10px] font-normal text-slate-400">{currentRange.unit}</span>
              </p>
            </div>
            <div className="text-center p-3 bg-slate-50 rounded-xl">
              <p className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">14d Average</p>
              <p className="text-xl font-extrabold text-[#0D1B2A] mt-1">
                {averageVal} <span className="text-[10px] font-normal text-slate-400">{currentRange.unit}</span>
              </p>
            </div>
            <div className="text-center p-3 bg-slate-50 rounded-xl">
              <p className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">14d Peak</p>
              <p className="text-xl font-extrabold text-[#0D1B2A] mt-1">
                {peakVal} <span className="text-[10px] font-normal text-slate-400">{currentRange.unit}</span>
              </p>
            </div>
          </div>

          {/* Wearable Sync Status Bar */}
          <div className="mt-4 flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
            {wearableConnected ? (
              <>
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                  </span>
                  <span>boAt Band • Last synced 12 min ago • BLE Connected</span>
                </div>
                <button
                  onClick={() => setWearableConnected(false)}
                  className="text-xs font-semibold text-[#EF4444] hover:underline"
                >
                  Disconnect
                </button>
              </>
            ) : (
              <>
                <span className="text-xs text-slate-400">No wearable connected — Connect a device</span>
                <button
                  onClick={() => setWearableConnected(true)}
                  className="px-3 py-1 bg-[#0D9488] hover:bg-teal-600 text-white text-xs font-bold rounded-lg transition-colors"
                >
                  Connect Wearable
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* PART 4: Prescriptions Section */}
      <div id="medications-section" className="space-y-4">
        <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-2">
          <Pill size={16} className="text-[#0D9488]" />
          Active Prescriptions
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {displayedPrescriptions.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-100 p-8 text-center text-sm text-slate-400 md:col-span-2">
              No prescriptions yet
            </div>
          ) : (
            displayedPrescriptions.map((rx) => (
              <div key={rx.id} className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 flex flex-col justify-between hover:shadow-md transition-all duration-300">
                <div>
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="text-sm font-bold text-[#0D1B2A]">{rx.diagnosis || 'Prescription'}</p>
                      <p className="text-xs text-slate-400 mt-0.5">Prescribed by Dr. Ananya Iyer • {new Date(rx.created_at).toLocaleDateString()}</p>
                    </div>

                    {/* Drug interaction check (Metformin + Amlodipine has mild interaction warning) */}
                    {rx.medications.length > 1 && (
                      <div className="relative group cursor-pointer">
                        <span className="bg-[#F59E0B]/10 text-[#F59E0B] p-1.5 rounded-full flex items-center justify-center">
                          <ShieldAlert size={16} />
                        </span>
                        <div className="absolute right-0 top-8 bg-slate-950 text-white text-[10px] p-2 rounded-lg shadow-xl hidden group-hover:block z-20 w-48">
                          Potential interaction warning: Metformin + Amlodipine may increase risk of mild acidosis. Check with doctor.
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="space-y-4 mt-5">
                    {rx.medications.map((med, i) => (
                      <div key={i} className="p-3 bg-slate-50/50 border border-slate-100 rounded-xl space-y-2">
                        <div className="flex justify-between items-center">
                          <span className="text-sm font-bold text-[#0D1B2A]">{med.name}</span>
                          <span className="text-xs bg-[#CCFBF1] text-[#0D9488] px-2 py-0.5 rounded-lg font-semibold">{med.dosage}</span>
                        </div>
                        
                        {/* Frequency Dots */}
                        <div className="flex items-center gap-4 text-xs text-slate-500 pt-1">
                          <span>Today's doses:</span>
                          <div className="flex gap-2">
                            <span className="flex items-center gap-1">
                              <span className="w-2.5 h-2.5 rounded-full bg-[#0D9488]"></span> Morning
                            </span>
                            <span className="flex items-center gap-1">
                              <span className={`w-2.5 h-2.5 rounded-full ${med.frequency.toLowerCase().includes('twice') ? 'bg-[#0D9488]' : 'bg-slate-300'}`}></span> Evening
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Adherence and Action Bar */}
                <div className="mt-6 pt-4 border-t border-slate-100">
                  <div className="flex justify-between items-center text-xs text-slate-400 mb-2">
                    <span>Adherence Rate</span>
                    <span className="font-semibold text-slate-700">{adherenceRate}%</span>
                  </div>
                  <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                    <div 
                      className={`h-full transition-all duration-500
                        ${adherenceRate >= 80 ? 'bg-[#0D9488]' :
                          adherenceRate >= 60 ? 'bg-[#F59E0B]' : 'bg-[#EF4444]'}`}
                      style={{ width: `${adherenceRate}%` }}
                    ></div>
                  </div>

                  <div className="flex items-center gap-3 mt-5">
                    <button
                      onClick={() => setShowQRModal({ id: rx.id, name: rx.diagnosis || 'Prescription' })}
                      className="flex-1 py-2 border border-[#0D9488] text-[#0D9488] hover:bg-[#CCFBF1]/20 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-2"
                    >
                      <Sparkles size={14} /> View QR
                    </button>
                    <a
                      href={`/api/reports/triage-summary/${rx.id}`} // placeholder download link
                      download
                      className="flex-1 py-2 bg-slate-100 text-slate-600 hover:bg-slate-200 text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-2"
                    >
                      <Download size={14} /> Download PDF
                    </a>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* PART 5: Nearby Hospital Care Section */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-2">
              <span>🏥</span> Nearby Hospital Care
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">District centers near <span className="font-semibold text-slate-600">{profile?.city || 'Chennai'}</span></p>
          </div>
          <span className="text-xs bg-[#CCFBF1] text-[#0D9488] px-3 py-1 rounded-full font-bold">
            Emergency & Specialist Care
          </span>
        </div>

        {appointSuccess && (
          <div className="mb-4 flex items-center gap-2 p-3 rounded-xl text-sm bg-teal-50 border border-teal-200 text-teal-700 animate-slide-in">
            <CheckCircle2 size={16} className="text-teal-600 shrink-0" />
            <span>{appointSuccess}</span>
          </div>
        )}

        {appointError && (
          <div className="mb-4 flex items-center gap-2 p-3 rounded-xl text-sm bg-red-50 border border-red-200 text-red-700 animate-slide-in">
            <AlertCircle size={16} className="text-red-600 shrink-0" />
            <span>{appointError}</span>
          </div>
        )}

        {hospitals.length === 0 ? (
          <div className="text-center p-6 text-slate-400 text-sm bg-slate-50 rounded-xl">
            No healthcare facilities found.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {hospitals.map((hosp, i) => {
              const status = getIsOpenText(hosp.open_24h || hosp.open_24h === undefined);
              return (
                <div key={i} className="p-5 border border-slate-100 rounded-2xl bg-slate-50/50 flex flex-col justify-between hover:bg-slate-50 hover:shadow-sm transition-all duration-300">
                  <div>
                    <div className="flex items-start justify-between">
                      <div>
                        <h4 className="font-bold text-[#0D1B2A] text-base">{hosp.hospital_name || hosp.name}</h4>
                        <p className="text-xs text-slate-400 mt-1 flex items-center gap-1">
                          <MapPin size={12} /> {hosp.address || 'Chennai District'} • {hosp.distance} km
                        </p>
                      </div>
                      <span className="text-xs bg-slate-200 text-slate-600 px-2 py-0.5 rounded font-bold">
                        {hosp.distance} km
                      </span>
                    </div>

                    {/* Specialty chips */}
                    <div className="flex flex-wrap gap-2 mt-3">
                      {(hosp.specialties || ['General']).map((spec: string, _idx: number) => (
                        <span 
                          key={_idx} 
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase
                            ${spec === 'Emergency' ? 'bg-[#EF4444]/10 text-[#EF4444]' :
                              spec === 'Maternity' ? 'bg-pink-100 text-pink-600' : 'bg-[#CCFBF1] text-[#0D9488]'}`}
                        >
                          {spec}
                        </span>
                      ))}
                    </div>

                    <div className="mt-3 flex items-center gap-1.5 text-xs">
                      <span className={`w-2 h-2 rounded-full ${status.open ? 'bg-green-500' : 'bg-red-500'}`}></span>
                      <span className="text-slate-500">{status.text}</span>
                    </div>

                    {/* Doctors list if available */}
                    {hosp.doctors && hosp.doctors.length > 0 && (
                      <div className="mt-4 space-y-2">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Available Doctors</p>
                        {hosp.doctors.map((doc: any, j: number) => (
                          <div key={j} className="flex items-center justify-between p-2.5 bg-white rounded-xl border border-slate-100">
                            <div>
                              <p className="text-xs font-bold text-[#0D1B2A]">{doc.name}</p>
                              <p className="text-[10px] text-slate-400">{doc.specialty} • {doc.experience} Years Exp.</p>
                            </div>
                            <button
                              onClick={() => handleAppoint(doc.id)}
                              disabled={appointingDocId === doc.id || !doc.is_available}
                              className="px-2.5 py-1.5 bg-[#F59E0B] hover:bg-[#d97706] text-white text-[10px] font-bold rounded-lg transition-colors flex items-center gap-1 disabled:opacity-50"
                            >
                              {appointingDocId === doc.id ? (
                                <Loader2 size={10} className="animate-spin" />
                              ) : (
                                'Appoint & Share'
                              )}
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="mt-5 flex items-center gap-3">
                    <a
                      href={`https://maps.google.com/?q=${encodeURIComponent(hosp.hospital_name || hosp.name)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 py-1.5 border border-slate-200 text-slate-600 hover:bg-slate-100 text-xs font-bold rounded-lg transition-all text-center"
                    >
                      Open in Maps
                    </a>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {!expandedHospitals && (
          <div className="mt-4 text-center">
            <button
              onClick={handleFindMoreHospitals}
              className="px-4 py-2 border border-[#0D9488] text-[#0D9488] hover:bg-[#CCFBF1]/20 text-xs font-bold rounded-xl transition-all"
            >
              Find More Hospitals
            </button>
          </div>
        )}
      </div>

      {/* PART 6: Three Entirely New Sections */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Section A — Symptom History Timeline */}
        <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm border border-slate-100 p-6 flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-4 flex items-center gap-2">
              <FileText size={16} className="text-[#0D9488]" />
              Symptom History Timeline
            </h3>
            
            <div className="space-y-4 relative pl-4 border-l border-slate-100">
              {history.length === 0 ? (
                <p className="text-xs text-slate-400 py-2">No past triage events recorded.</p>
              ) : (
                history.map((conv) => (
                  <div key={conv.id} className="relative space-y-1">
                    <span className="absolute -left-[21px] top-1 w-2.5 h-2.5 rounded-full bg-[#0D9488] border border-white"></span>
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] text-slate-400 font-semibold">{new Date(conv.created_at).toLocaleDateString()}</span>
                      <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase
                        ${conv.severity === 'high' ? 'bg-[#EF4444]/10 text-[#EF4444]' :
                          conv.severity === 'medium' ? 'bg-[#F59E0B]/10 text-[#F59E0B]' : 'bg-[#CCFBF1] text-[#0D9488]'}`}>
                        {conv.severity}
                      </span>
                    </div>
                    <p className="text-xs font-bold text-[#0D1B2A]">{conv.chief_complaint || 'Symptom Consultation'}</p>
                    <p className="text-[11px] text-slate-400 line-clamp-1">{conv.ai_summary || 'Summary not generated.'}</p>
                    <button
                      onClick={() => handleViewConversation(conv)}
                      className="text-[10px] text-[#0D9488] hover:underline flex items-center gap-1 font-semibold pt-1"
                    >
                      <Eye size={10} /> View Full Conversation
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Section B — Vaccination Record */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                <HeartHandshake size={16} className="text-[#0D9488]" />
                Vaccinations
              </h3>
              <button
                onClick={() => setShowAddVaccineModal(true)}
                className="p-1 bg-[#CCFBF1] text-[#0D9488] hover:bg-teal-100 rounded-lg transition-colors"
                title="Add Vaccination"
              >
                <Plus size={14} />
              </button>
            </div>

            <div className="space-y-3">
              {vaccines.map((v, i) => (
                <div key={i} className="p-3 border border-slate-100 rounded-xl bg-slate-50/50 flex justify-between items-center">
                  <div>
                    <p className="text-xs font-bold text-[#0D1B2A]">{v.name}</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">Administered: {v.dateAdministered || 'N/A'}</p>
                    {v.nextDue && <p className="text-[9px] text-[#F59E0B] font-semibold">Next due: {v.nextDue}</p>}
                  </div>
                  <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full uppercase
                    ${v.status === 'up-to-date' ? 'bg-[#CCFBF1] text-[#0D9488]' :
                      v.status === 'due-soon' ? 'bg-[#F59E0B]/10 text-[#F59E0B]' : 'bg-[#EF4444]/10 text-[#EF4444]'}`}>
                    {v.status.replace('-', ' ')}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Section C — Emergency Contacts & ASHA Worker */}
      <div id="asha-section" className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Emergency Contacts */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-2">
                <ShieldAlert size={16} className="text-[#EF4444]" />
                Emergency Contacts
              </h3>
              <button
                onClick={() => setShowAddContactModal(true)}
                className="p-1 bg-[#EF4444]/10 text-[#EF4444] hover:bg-[#EF4444]/20 rounded-lg transition-colors"
                title="Add Contact"
              >
                <Plus size={14} />
              </button>
            </div>

            <div className="space-y-3">
              {contacts.map((c, i) => (
                <div key={i} className="p-3 border border-slate-100 rounded-xl bg-slate-50/50 flex justify-between items-center">
                  <div>
                    <p className="text-xs font-bold text-[#0D1B2A]">{c.name} ({c.relationship})</p>
                    <p className="text-[10px] text-slate-400 mt-0.5">{c.phone}</p>
                  </div>
                  <a
                    href={`tel:${c.phone}`}
                    className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg transition-colors"
                  >
                    <Phone size={12} />
                  </a>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Assigned ASHA Worker Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 flex flex-col justify-between">
          <div>
            <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-4 flex items-center gap-2">
              <User size={16} className="text-[#0D9488]" />
              Assigned ASHA Worker
            </h3>

            <div className="flex items-center gap-4 p-3 bg-slate-50/50 rounded-xl border border-slate-100">
              <div className="w-12 h-12 rounded-full bg-teal-500 text-white flex items-center justify-center font-bold text-sm">
                {ashaWorker.photo}
              </div>
              <div>
                <p className="text-xs font-bold text-[#0D1B2A]">{ashaWorker.name}</p>
                <p className="text-[10px] text-slate-400 mt-0.5">{ashaWorker.area}</p>
                <p className="text-[10px] text-slate-400 mt-0.5">{ashaWorker.phone}</p>
              </div>
            </div>
          </div>

          <div className="mt-5">
            <a
              href={`tel:${ashaWorker.phone}`}
              className="w-full py-2 bg-[#0D9488] hover:bg-teal-600 text-white text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-2"
            >
              <Phone size={12} /> Call ASHA Worker
            </a>
          </div>
        </div>
      </div>

      {/* Settings Mock Section */}
      <div id="settings-section" className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6">
        <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-4 flex items-center gap-2">
          <Settings size={16} className="text-slate-500" />
          Passport Settings & Access Control
        </h3>
        <p className="text-xs text-slate-400 mb-4">Configure medical record visibility, sync preferences, and linked health IDs.</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 space-y-2">
            <p className="text-xs font-bold text-slate-700">Digital Consent Registry</p>
            <p className="text-[11px] text-slate-400">Manage which clinics can access your passport via ABHA networks.</p>
            <button className="text-xs font-bold text-[#0D9488] hover:underline mt-2">Manage Consents →</button>
          </div>
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 space-y-2">
            <p className="text-xs font-bold text-slate-700">FHIR Sync Settings</p>
            <p className="text-[11px] text-slate-400">Configure auto-exporting of vitals history to state servers.</p>
            <button className="text-xs font-bold text-[#0D9488] hover:underline mt-2">Configure Sync →</button>
          </div>
        </div>
      </div>

      {/* FHIR Record View */}
      {fhirData && (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-6 animate-fade-in">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-2">
              <FileText size={16} className="text-[#0D9488]" />
              FHIR R4 Digital Health Passport
            </h3>
            <span className="text-[10px] bg-[#CCFBF1] text-[#0D9488] px-2.5 py-0.5 rounded-full font-bold uppercase">
              Standard Compliant
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm mb-4">
            <div className="p-3 bg-slate-50 rounded-xl">
              <p className="text-[10px] text-slate-400 font-semibold uppercase">ABHA Official ID</p>
              <p className="font-bold text-[#0D1B2A] mt-0.5">
                {fhirData.identifier?.[0]?.value || '—'}
              </p>
            </div>
            <div className="p-3 bg-slate-50 rounded-xl">
              <p className="text-[10px] text-slate-400 font-semibold uppercase">FHIR Resource Type</p>
              <p className="font-bold text-[#0D1B2A] mt-0.5">{fhirData.resourceType}</p>
            </div>
            <div className="p-3 bg-slate-50 rounded-xl">
              <p className="text-[10px] text-slate-400 font-semibold uppercase">Official Name</p>
              <p className="font-bold text-[#0D1B2A] mt-0.5">{fhirData.name?.[0]?.text || '—'}</p>
            </div>
            <div className="p-3 bg-slate-50 rounded-xl">
              <p className="text-[10px] text-slate-400 font-semibold uppercase">Contact Telecom</p>
              <p className="font-bold text-[#0D1B2A] mt-0.5">
                {fhirData.telecom?.[0]?.value || '—'} ({fhirData.telecom?.[0]?.use})
              </p>
            </div>
          </div>

          <details 
            className="group mt-4 border border-slate-100 rounded-xl overflow-hidden" 
            open={window.innerWidth >= 1024}
          >
            <summary className="list-none flex items-center justify-between p-3 bg-slate-50 cursor-pointer select-none">
              <span className="text-xs font-semibold text-slate-500 uppercase">Raw FHIR R4 JSON Payload</span>
              <span className="text-xs text-[#0D9488] group-open:hidden">Show JSON</span>
              <span className="text-xs text-[#0D9488] hidden group-open:inline">Hide JSON</span>
            </summary>
            <div className="p-4 bg-[#0D1B2A] text-white font-mono text-xs overflow-x-auto whitespace-pre rounded-b-xl max-h-[300px]">
              {JSON.stringify(fhirData, null, 2)}
            </div>
          </details>
        </div>
      )}

      {/* Modal: View Triage Conversation */}
      {selectedTriage && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-slide-in">
            <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <div>
                <h4 className="font-bold text-[#0D1B2A] text-base">{selectedTriage.chief_complaint || 'Symptom Consultation'}</h4>
                <p className="text-xs text-slate-400 mt-0.5">{new Date(selectedTriage.created_at).toLocaleString()}</p>
              </div>
              <button
                onClick={() => setSelectedTriage(null)}
                className="p-1 rounded-full hover:bg-slate-200 text-slate-500 transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 overflow-auto p-5 space-y-4 bg-slate-50/50">
              {loadingTriageMessages ? (
                <div className="flex items-center justify-center py-10">
                  <Loader2 size={24} className="animate-spin text-[#0D9488]" />
                </div>
              ) : triageMessages.length === 0 ? (
                <div className="text-center py-6 text-xs text-slate-400">
                  No conversation logs available for this session.
                </div>
              ) : (
                triageMessages.map((msg, i) => (
                  <div 
                    key={i} 
                    className={`flex flex-col max-w-[80%] rounded-2xl p-4 text-xs shadow-sm
                      ${msg.role === 'patient' 
                        ? 'bg-[#0D9488] text-white ml-auto rounded-tr-none' 
                        : 'bg-white text-[#0D1B2A] border border-slate-100 rounded-tl-none'}`}
                  >
                    <p className="font-bold mb-1 uppercase tracking-wide text-[9px] opacity-80">
                      {msg.role === 'patient' ? 'You' : 'AI Assistant'}
                    </p>
                    <p className="leading-relaxed whitespace-pre-line">{msg.content}</p>
                  </div>
                ))
              )}
            </div>

            <div className="p-4 border-t border-slate-100 flex justify-end">
              <button
                onClick={() => setSelectedTriage(null)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold rounded-xl transition-all"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Add Vaccination */}
      {showAddVaccineModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl overflow-hidden animate-slide-in">
            <div className="p-5 border-b border-slate-100 flex justify-between items-center">
              <h4 className="font-bold text-[#0D1B2A]">Log New Vaccination</h4>
              <button
                onClick={() => setShowAddVaccineModal(false)}
                className="p-1 rounded-full hover:bg-slate-100 text-slate-500"
              >
                <X size={18} />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase">Vaccine Name</label>
                <input
                  type="text"
                  placeholder="e.g. Hepatitis B"
                  value={newVaccine.name}
                  onChange={e => setNewVaccine(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full mt-1 p-2.5 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-teal-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase">Date Administered</label>
                <input
                  type="date"
                  value={newVaccine.dateAdministered}
                  onChange={e => setNewVaccine(prev => ({ ...prev, dateAdministered: e.target.value }))}
                  className="w-full mt-1 p-2.5 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-teal-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase">Next Due Date (Optional)</label>
                <input
                  type="date"
                  value={newVaccine.nextDue}
                  onChange={e => setNewVaccine(prev => ({ ...prev, nextDue: e.target.value }))}
                  className="w-full mt-1 p-2.5 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-teal-500 focus:outline-none"
                />
              </div>
            </div>
            <div className="p-4 border-t border-slate-100 flex justify-end gap-2">
              <button
                onClick={() => setShowAddVaccineModal(false)}
                className="px-4 py-2 border border-slate-200 text-slate-600 text-xs font-semibold rounded-xl"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (!newVaccine.name) return;
                  setVaccines(prev => [...prev, newVaccine]);
                  setShowAddVaccineModal(false);
                  setNewVaccine({ name: '', dateAdministered: '', nextDue: '', status: 'up-to-date' });
                }}
                className="px-4 py-2 bg-[#0D9488] hover:bg-teal-600 text-white text-xs font-bold rounded-xl"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Add Contact */}
      {showAddContactModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full shadow-2xl overflow-hidden animate-slide-in">
            <div className="p-5 border-b border-slate-100 flex justify-between items-center">
              <h4 className="font-bold text-[#0D1B2A]">Add Emergency Contact</h4>
              <button
                onClick={() => setShowAddContactModal(false)}
                className="p-1 rounded-full hover:bg-slate-100 text-slate-500"
              >
                <X size={18} />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase">Contact Name</label>
                <input
                  type="text"
                  placeholder="e.g. Ramesh Sharma"
                  value={newContact.name}
                  onChange={e => setNewContact(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full mt-1 p-2.5 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-teal-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase">Relationship</label>
                <input
                  type="text"
                  placeholder="e.g. Brother"
                  value={newContact.relationship}
                  onChange={e => setNewContact(prev => ({ ...prev, relationship: e.target.value }))}
                  className="w-full mt-1 p-2.5 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-teal-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase">Phone Number</label>
                <input
                  type="tel"
                  placeholder="e.g. +91-98402-XXXXX"
                  value={newContact.phone}
                  onChange={e => setNewContact(prev => ({ ...prev, phone: e.target.value }))}
                  className="w-full mt-1 p-2.5 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-teal-500 focus:outline-none"
                />
              </div>
            </div>
            <div className="p-4 border-t border-slate-100 flex justify-end gap-2">
              <button
                onClick={() => setShowAddContactModal(false)}
                className="px-4 py-2 border border-slate-200 text-slate-600 text-xs font-semibold rounded-xl"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (!newContact.name || !newContact.phone) return;
                  setContacts(prev => [...prev, newContact]);
                  setShowAddContactModal(false);
                  setNewContact({ name: '', relationship: '', phone: '' });
                }}
                className="px-4 py-2 bg-[#0D9488] hover:bg-teal-600 text-white text-xs font-bold rounded-xl"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: View QR */}
      {showQRModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full shadow-2xl overflow-hidden p-6 animate-slide-in text-center">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3 mb-4">
              <span className="font-bold text-sm text-[#0D1B2A]">Prescription Verification Token</span>
              <button
                onClick={() => setShowQRModal(null)}
                className="p-1 rounded-full hover:bg-slate-100 text-slate-500"
              >
                <X size={18} />
              </button>
            </div>
            
            <p className="text-xs text-slate-500 mb-4">Scan at any verified VitalBridge pharmacy to dispense medications.</p>
            
            {/* Beautiful pixelated simulated QR code */}
            <div className="w-48 h-48 mx-auto bg-slate-100 border-2 border-slate-200 rounded-xl p-3 flex items-center justify-center">
              <svg className="w-full h-full text-slate-800" viewBox="0 0 100 100" fill="currentColor">
                <rect x="5" y="5" width="25" height="25" />
                <rect x="10" y="10" width="15" height="15" fill="white" />
                <rect x="12" y="12" width="11" height="11" />
                
                <rect x="70" y="5" width="25" height="25" />
                <rect x="75" y="10" width="15" height="15" fill="white" />
                <rect x="77" y="12" width="11" height="11" />
                
                <rect x="5" y="70" width="25" height="25" />
                <rect x="10" y="75" width="15" height="15" fill="white" />
                <rect x="12" y="77" width="11" height="11" />
                
                {/* Random pixel squares */}
                <rect x="35" y="15" width="10" height="5" />
                <rect x="50" y="5" width="5" height="15" />
                <rect x="60" y="20" width="5" height="5" />
                <rect x="40" y="35" width="15" height="5" />
                <rect x="15" y="45" width="10" height="10" />
                <rect x="45" y="50" width="5" height="15" />
                <rect x="55" y="40" width="15" height="10" />
                <rect x="30" y="70" width="15" height="5" />
                <rect x="35" y="80" width="5" height="10" />
                <rect x="55" y="75" width="10" height="15" />
                <rect x="75" y="40" width="5" height="25" />
                <rect x="85" y="65" width="10" height="5" />
                <rect x="80" y="80" width="15" height="15" />
              </svg>
            </div>
            
            <p className="text-[10px] text-slate-400 font-mono mt-4 truncate">TOKEN: {showQRModal.id}</p>
            <p className="text-xs font-bold text-teal-600 mt-1 uppercase tracking-wide">{showQRModal.name}</p>

            <button
              onClick={() => setShowQRModal(null)}
              className="mt-6 w-full py-2 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold rounded-xl transition-all"
            >
              Done
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
