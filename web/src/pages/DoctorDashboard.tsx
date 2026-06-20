import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import api from '../api/client';
import { AlertTriangle, Clock, Stethoscope, Loader2, Users } from 'lucide-react';
import type { DoctorQueueItem } from '../types';

const severityColors: Record<string, string> = {
  high: 'bg-coral-500/10 text-coral-500 border-coral-500/20',
  medium: 'bg-amber-50 text-amber-600 border-amber-200',
  low: 'bg-teal-50 text-teal-600 border-teal-200',
  pending: 'bg-slate-100 text-slate-500 border-slate-200',
};

export default function DoctorDashboard() {
  const { token } = useAuthStore();
  const navigate = useNavigate();
  const [queue, setQueue] = useState<DoctorQueueItem[]>([]);
  const [loading, setLoading] = useState(true);

  // Load queue
  useEffect(() => {
    api.get('/doctor/queue').then(r => {
      setQueue(r.data);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  // WebSocket for live updates
  useEffect(() => {
    if (!token) return;
    const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
    const host = window.location.hostname === 'localhost' ? 'localhost:8000' : window.location.host;
    const ws = new WebSocket(`${protocol}://${host}/api/doctor/ws/queue?token=${token}`);
    ws.onmessage = (e) => {
      const data = JSON.parse(e.data);
      if (data.type === 'new_escalation') {
        setQueue(prev => [{
          conversation_id: data.conversation_id,
          patient_name: data.patient_name,
          chief_complaint: data.chief_complaint,
          severity: data.severity,
          created_at: new Date().toISOString(),
          ai_summary: undefined,
        }, ...prev]);
      }
    };
    return () => ws.close();
  }, [token]);

  return (
    <div className="p-6 max-w-5xl mx-auto animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-navy-900 flex items-center gap-2">
            <Stethoscope size={24} className="text-teal-500" />
            Patient Queue
          </h1>
          <p className="text-sm text-slate-500 mt-1">Escalated cases requiring attention</p>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 bg-white rounded-xl border border-slate-200 shadow-sm">
          <Users size={16} className="text-teal-500" />
          <span className="text-sm font-semibold text-navy-900">{queue.length}</span>
          <span className="text-xs text-slate-400">pending</span>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={32} className="animate-spin text-teal-500" />
        </div>
      ) : queue.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 p-12 text-center">
          <Stethoscope size={48} className="text-slate-200 mx-auto mb-4" />
          <p className="text-lg font-medium text-slate-400">No escalated cases</p>
          <p className="text-sm text-slate-300 mt-1">New cases will appear here in real time</p>
        </div>
      ) : (
        <div className="space-y-3">
          {queue.map((item, i) => (
            <button
              key={item.conversation_id}
              onClick={() => navigate(`/doctor/case/${item.conversation_id}`)}
              className="w-full text-left bg-white rounded-2xl border border-slate-100 p-5 hover:shadow-md hover:border-teal-200 transition-all duration-200 animate-fade-in"
              style={{ animationDelay: `${i * 50}ms` }}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-teal-400 to-teal-600 flex items-center justify-center text-white font-bold text-sm shadow-sm">
                      {item.patient_name.charAt(0)}
                    </div>
                    <div>
                      <p className="font-semibold text-navy-900">{item.patient_name}</p>
                      <p className="text-xs text-slate-400 flex items-center gap-1">
                        <Clock size={10} />
                        {new Date(item.created_at).toLocaleString()}
                      </p>
                    </div>
                  </div>
                  <p className="text-sm text-slate-600 mt-2">{item.chief_complaint || 'No complaint recorded'}</p>
                  {item.ai_summary && (
                    <p className="text-xs text-slate-400 mt-2 line-clamp-2">{item.ai_summary}</p>
                  )}
                </div>
                <span className={`text-xs font-medium px-3 py-1 rounded-full border shrink-0 ml-4 flex items-center gap-1 ${severityColors[item.severity]}`}>
                  <AlertTriangle size={12} />
                  {item.severity.toUpperCase()}
                </span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
