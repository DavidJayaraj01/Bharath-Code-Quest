import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import api from '../api/client';
import { Shield, Loader2, AlertCircle } from 'lucide-react';
import type { TokenResponse } from '../types';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const login = useAuthStore((s) => s.login);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { data } = await api.post<TokenResponse>('/auth/login', { email, password });
      login(data.access_token, data.user);
      navigate('/');
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const fillDemo = (role: string) => {
    const demos: Record<string, [string, string]> = {
      patient: ['priya.sharma@demo.vitalbridge.in', 'demo1234'],
      doctor: ['dr.ananya.iyer@demo.vitalbridge.in', 'demo1234'],
      health_worker: ['sunita.devi@demo.vitalbridge.in', 'demo1234'],
    };
    const [e, p] = demos[role] || demos.patient;
    setEmail(e);
    setPassword(p);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-navy-900 via-navy-800 to-navy-900 px-4">
      <div className="w-full max-w-md animate-fade-in">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-teal-500 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-teal-500/30">
            <Shield size={28} className="text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white">VitalBridge</h1>
          <p className="text-slate-400 mt-1">Healthcare Continuum Platform</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <h2 className="text-xl font-semibold text-navy-900 mb-6">Sign in to your account</h2>

          {error && (
            <div className="flex items-center gap-2 p-3 mb-4 bg-coral-500/10 border border-coral-500/20 rounded-xl text-coral-500 text-sm">
              <AlertCircle size={16} />
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1.5">Email</label>
              <input
                id="login-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 outline-none transition-all text-sm"
                placeholder="Enter your email"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1.5">Password</label>
              <input
                id="login-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 outline-none transition-all text-sm"
                placeholder="Enter your password"
              />
            </div>
            <button
              id="login-submit"
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-teal-500 hover:bg-teal-400 text-white font-semibold rounded-xl transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-teal-500/25"
            >
              {loading ? <Loader2 size={18} className="animate-spin" /> : null}
              {loading ? 'Signing in...' : 'Sign in'}
            </button>
          </form>

          <p className="mt-4 text-center text-sm text-slate-500">
            Don't have an account?{' '}
            <Link to="/register" className="text-teal-500 font-medium hover:text-teal-400">Create one</Link>
          </p>

          {/* Demo accounts */}
          <div className="mt-6 pt-6 border-t border-slate-100">
            <p className="text-xs text-slate-400 mb-3 text-center">Quick demo login</p>
            <div className="flex gap-2">
              {[
                { role: 'patient', label: 'Patient', color: 'bg-teal-50 text-teal-700 hover:bg-teal-100' },
                { role: 'doctor', label: 'Doctor', color: 'bg-blue-50 text-blue-700 hover:bg-blue-100' },
                { role: 'health_worker', label: 'ASHA Worker', color: 'bg-amber-50 text-amber-700 hover:bg-amber-100' },
              ].map((d) => (
                <button
                  key={d.role}
                  onClick={() => fillDemo(d.role)}
                  className={`flex-1 py-2 text-xs font-medium rounded-lg transition-colors ${d.color}`}
                >
                  {d.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
