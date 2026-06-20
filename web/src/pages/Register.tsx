import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import api from '../api/client';
import { Shield, Loader2, AlertCircle } from 'lucide-react';
import type { TokenResponse } from '../types';

export default function Register() {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('patient');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const login = useAuthStore((s) => s.login);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { data } = await api.post<TokenResponse>('/auth/register', {
        email, password, full_name: fullName, role,
      });
      login(data.access_token, data.user);
      navigate('/');
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Registration failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-navy-900 via-navy-800 to-navy-900 px-4">
      <div className="w-full max-w-md animate-fade-in">
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-teal-500 flex items-center justify-center mx-auto mb-4 shadow-lg shadow-teal-500/30">
            <Shield size={28} className="text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white">Create Account</h1>
          <p className="text-slate-400 mt-1">Join VitalBridge today</p>
        </div>

        <div className="bg-white rounded-2xl shadow-2xl p-8">
          {error && (
            <div className="flex items-center gap-2 p-3 mb-4 bg-coral-500/10 border border-coral-500/20 rounded-xl text-coral-500 text-sm">
              <AlertCircle size={16} />
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1.5">Full Name</label>
              <input
                id="register-name"
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 outline-none transition-all text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1.5">Email</label>
              <input
                id="register-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 outline-none transition-all text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1.5">Password</label>
              <input
                id="register-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 outline-none transition-all text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-600 mb-1.5">I am a</label>
              <select
                id="register-role"
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:border-teal-500 focus:ring-2 focus:ring-teal-500/20 outline-none transition-all text-sm"
              >
                <option value="patient">Patient</option>
                <option value="doctor">Doctor</option>
              </select>
            </div>
            <button
              id="register-submit"
              type="submit"
              disabled={loading}
              className="w-full py-2.5 bg-teal-500 hover:bg-teal-400 text-white font-semibold rounded-xl transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-50 shadow-lg shadow-teal-500/25"
            >
              {loading ? <Loader2 size={18} className="animate-spin" /> : null}
              {loading ? 'Creating account...' : 'Create account'}
            </button>
          </form>

          <p className="mt-4 text-center text-sm text-slate-500">
            Already have an account?{' '}
            <Link to="/login" className="text-teal-500 font-medium hover:text-teal-400">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
