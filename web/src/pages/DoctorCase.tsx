import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../api/client';
import { ArrowLeft, Send, Loader2, AlertTriangle, CheckCircle2, Pill, Smartphone } from 'lucide-react';
import type { Conversation, Patient, VitalReading, MedicationItem } from '../types';
import RiskScoreGauge from '../components/passport/RiskScoreGauge';

export default function DoctorCase() {
  const { conversationId } = useParams();
  const navigate = useNavigate();
  const [conv, setConv] = useState<Conversation | null>(null);
  const [patient, setPatient] = useState<Patient | null>(null);
  const [vitals, setVitals] = useState<VitalReading[]>([]);
  const [loading, setLoading] = useState(true);
  const [showRx, setShowRx] = useState(false);
  const [rxLoading, setRxLoading] = useState(false);
  const [rxDiagnosis, setRxDiagnosis] = useState('');
  const [rxNotes, setRxNotes] = useState('');
  const [meds, setMeds] = useState<MedicationItem[]>([{ name: '', dosage: '', frequency: '', duration: '' }]);
  const [rxSuccess, setRxSuccess] = useState(false);
  const [reportSending, setReportSending] = useState(false);
  const [reportMsg, setReportMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [riskData, setRiskData] = useState<{ score: number; band: 'low' | 'moderate' | 'high'; signals: string[] } | null>(null);

  useEffect(() => {
    if (!conversationId) return;
    api.get(`/doctor/conversations/${conversationId}`).then(r => {
      setConv(r.data);
      // Load patient data
      return Promise.all([
        api.get(`/doctor/patients/${r.data.patient_id}`),
        api.get(`/doctor/patients/${r.data.patient_id}/vitals`),
        api.get(`/risk/${r.data.patient_id}`),
      ]);
    }).then(([p, v, risk]) => {
      setPatient(p.data);
      setVitals(v.data);
      setRiskData(risk.data);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [conversationId]);

  // Connect to risk score websocket for real-time risk updates
  useEffect(() => {
    if (!patient) return;
    const token = localStorage.getItem('token'); // doctor auth token
    if (!token) return;
    
    const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
    const host = window.location.hostname === 'localhost' ? 'localhost:8000' : window.location.host;
    const ws = new WebSocket(`${protocol}://${host}/api/risk/ws/${patient.id}?token=${token}`);

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
  }, [patient?.id]);

  const addMed = () => setMeds(prev => [...prev, { name: '', dosage: '', frequency: '', duration: '' }]);
  const updateMed = (i: number, field: keyof MedicationItem, value: string) => {
    setMeds(prev => prev.map((m, idx) => idx === i ? { ...m, [field]: value } : m));
  };

  const submitPrescription = async () => {
    if (!conv || !patient || meds.some(m => !m.name || !m.dosage)) return;
    setRxLoading(true);
    try {
      await api.post('/doctor/prescriptions', {
        patient_id: patient.id,
        conversation_id: conv.id,
        medications: meds,
        diagnosis: rxDiagnosis,
        notes: rxNotes,
      });
      setRxSuccess(true);
      setShowRx(false);
    } catch (err) {
      console.error(err);
    } finally {
      setRxLoading(false);
    }
  };

  const sendReportToPatient = async () => {
    if (!conversationId || reportSending) return;
    setReportSending(true);
    setReportMsg(null);
    try {
      const { data } = await api.post(`/triage/conversations/${conversationId}/send-report`);
      setReportMsg({ type: 'success', text: data.message || 'Report sent to patient!' });
      setTimeout(() => setReportMsg(null), 5000);
    } catch (err: any) {
      setReportMsg({ type: 'error', text: err.response?.data?.detail || 'Failed to send report' });
      setTimeout(() => setReportMsg(null), 5000);
    } finally {
      setReportSending(false);
    }
  };

  if (loading) return <div className="flex items-center justify-center h-full"><Loader2 size={32} className="animate-spin text-teal-500" /></div>;
  if (!conv) return <div className="p-6 text-center text-slate-400">Conversation not found</div>;

  const latestVitals: Record<string, VitalReading> = {};
  vitals.forEach(v => { if (!latestVitals[v.reading_type]) latestVitals[v.reading_type] = v; });

  return (
    <div className="p-6 max-w-6xl mx-auto animate-fade-in">
      <button onClick={() => navigate('/doctor')} className="flex items-center gap-2 text-sm text-slate-500 hover:text-teal-500 mb-4 transition-colors">
        <ArrowLeft size={16} /> Back to queue
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Conversation */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <h2 className="font-semibold text-navy-900">Triage Conversation</h2>
              <span className={`text-xs font-medium px-3 py-1 rounded-full flex items-center gap-1
                ${conv.severity === 'high' ? 'bg-coral-500/10 text-coral-500' : 'bg-amber-50 text-amber-600'}`}>
                <AlertTriangle size={12} />
                {conv.severity.toUpperCase()} Severity
              </span>
            </div>
            {reportMsg && (
              <div className={`mx-5 mt-2 text-xs px-3 py-2 rounded-lg flex items-center gap-2 ${
                reportMsg.type === 'success' ? 'bg-teal-50 text-teal-600 border border-teal-200' : 'bg-red-50 text-red-500 border border-red-200'
              }`}>
                {reportMsg.type === 'success' ? <CheckCircle2 size={14} /> : <AlertTriangle size={14} />}
                {reportMsg.text}
              </div>
            )}
            <div className="p-5 space-y-3 max-h-[500px] overflow-auto">
              {conv.messages.map(msg => (
                <div key={msg.id} className={`flex ${msg.role === 'patient' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[80%] px-4 py-3 rounded-2xl text-sm leading-relaxed whitespace-pre-wrap
                    ${msg.role === 'patient' ? 'bg-slate-100 text-navy-900 rounded-br-md' : 'bg-teal-50 text-navy-900 rounded-bl-md'}`}>
                    <p className="text-[10px] font-medium mb-1 text-slate-400">
                      {msg.role === 'patient' ? 'Patient' : 'AI Triage'}
                    </p>
                    {msg.content}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Prescription Form */}
          {!rxSuccess && (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
              {!showRx ? (
                <div className="flex gap-3">
                  <button onClick={() => setShowRx(true)} className="flex-1 py-3 bg-teal-500 hover:bg-teal-400 text-white font-semibold rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg shadow-teal-500/25">
                    <Pill size={18} /> Write Prescription
                  </button>
                  <button
                    onClick={sendReportToPatient}
                    disabled={reportSending}
                    className="py-3 px-5 bg-teal-50 hover:bg-teal-100 text-teal-600 font-semibold rounded-xl transition-colors flex items-center gap-2 disabled:opacity-50 border border-teal-200"
                    title="Send triage report to patient's registered WhatsApp number"
                  >
                    {reportSending ? <Loader2 size={16} className="animate-spin" /> : <Smartphone size={16} />}
                    Send Report
                  </button>
                </div>
              ) : (
                <div className="space-y-4">
                  <h3 className="font-semibold text-navy-900">New Prescription</h3>
                  <div>
                    <label className="text-xs font-medium text-slate-500 mb-1 block">Diagnosis</label>
                    <input value={rxDiagnosis} onChange={e => setRxDiagnosis(e.target.value)} className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:border-teal-500 outline-none" />
                  </div>
                  {meds.map((med, i) => (
                    <div key={i} className="grid grid-cols-4 gap-2">
                      <input placeholder="Medication" value={med.name} onChange={e => updateMed(i, 'name', e.target.value)} className="px-3 py-2 rounded-lg border border-slate-200 text-sm focus:border-teal-500 outline-none" />
                      <input placeholder="Dosage" value={med.dosage} onChange={e => updateMed(i, 'dosage', e.target.value)} className="px-3 py-2 rounded-lg border border-slate-200 text-sm focus:border-teal-500 outline-none" />
                      <input placeholder="Frequency" value={med.frequency} onChange={e => updateMed(i, 'frequency', e.target.value)} className="px-3 py-2 rounded-lg border border-slate-200 text-sm focus:border-teal-500 outline-none" />
                      <input placeholder="Duration" value={med.duration} onChange={e => updateMed(i, 'duration', e.target.value)} className="px-3 py-2 rounded-lg border border-slate-200 text-sm focus:border-teal-500 outline-none" />
                    </div>
                  ))}
                  <button onClick={addMed} className="text-xs text-teal-500 font-medium hover:text-teal-400">+ Add medication</button>
                  <div>
                    <label className="text-xs font-medium text-slate-500 mb-1 block">Notes</label>
                    <textarea value={rxNotes} onChange={e => setRxNotes(e.target.value)} rows={2} className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm focus:border-teal-500 outline-none resize-none" />
                  </div>
                  <div className="flex gap-3">
                    <button onClick={() => setShowRx(false)} className="px-4 py-2 text-sm text-slate-500 hover:text-slate-700">Cancel</button>
                    <button onClick={submitPrescription} disabled={rxLoading} className="flex-1 py-2 bg-teal-500 hover:bg-teal-400 text-white font-semibold rounded-xl transition-all flex items-center justify-center gap-2 disabled:opacity-50">
                      {rxLoading ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                      Submit Prescription
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {rxSuccess && (
            <div className="bg-teal-50 rounded-2xl border border-teal-200 p-5 flex items-center gap-3">
              <CheckCircle2 size={24} className="text-teal-500" />
              <div>
                <p className="font-semibold text-teal-700">Prescription submitted successfully</p>
                <p className="text-sm text-teal-600">It is now visible in the patient's Health Passport.</p>
              </div>
            </div>
          )}
        </div>

        {/* Patient Info Sidebar */}
        <div className="space-y-4">
          {riskData && (
            <RiskScoreGauge
              score={riskData.score}
              band={riskData.band}
              signals={riskData.signals}
            />
          )}

          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
            <h3 className="font-semibold text-navy-900 mb-3">Patient Profile</h3>
            {patient && (
              <div className="space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-slate-400">Gender</span><span className="font-medium">{patient.gender || '—'}</span></div>
                <div className="flex justify-between"><span className="text-slate-400">Blood Group</span><span className="font-medium">{patient.blood_group || '—'}</span></div>
                <div className="flex justify-between"><span className="text-slate-400">City</span><span className="font-medium">{patient.city || '—'}</span></div>
                {(patient.allergies?.length || 0) > 0 && (
                  <div>
                    <span className="text-slate-400 text-xs">Allergies</span>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {patient.allergies.map((a, i) => (
                        <span key={i} className="text-[11px] bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full">{a}</span>
                      ))}
                    </div>
                  </div>
                )}
                {(patient.chronic_conditions?.length || 0) > 0 && (
                  <div>
                    <span className="text-slate-400 text-xs">Conditions</span>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {patient.chronic_conditions.map((c, i) => (
                        <span key={i} className="text-[11px] bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full">{c}</span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
            <h3 className="font-semibold text-navy-900 mb-3">Latest Vitals</h3>
            <div className="space-y-2">
              {Object.entries(latestVitals).slice(0, 5).map(([type, v]) => (
                <div key={type} className="flex items-center justify-between text-sm">
                  <span className="text-slate-400 capitalize">{type.replace('_', ' ')}</span>
                  <span className="font-semibold text-navy-900">{v.value} {v.unit}</span>
                </div>
              ))}
              {Object.keys(latestVitals).length === 0 && (
                <p className="text-xs text-slate-300">No vitals recorded</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
