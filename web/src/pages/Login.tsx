import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import api from '../api/client';
import { Shield, Loader2, AlertCircle, Heart, Activity, Eye, EyeOff } from 'lucide-react';
import type { TokenResponse } from '../types';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
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
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden" style={{ background: 'linear-gradient(135deg, #111c14 0%, #1a2a1f 25%, #2a1f18 50%, #1a2a1f 75%, #111c14 100%)' }}>
      {/* Animated Background Orbs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="login-orb login-orb-1" />
        <div className="login-orb login-orb-2" />
        <div className="login-orb login-orb-3" />
        {/* Grid Pattern */}
        <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.8) 1px, transparent 1px)', backgroundSize: '32px 32px' }} />
        {/* Decorative ECG Line */}
        <svg className="absolute bottom-0 left-0 w-full h-32 opacity-10" viewBox="0 0 1200 120" preserveAspectRatio="none">
          <path d="M0,60 L200,60 L220,20 L240,100 L260,40 L280,80 L300,60 L500,60 L520,10 L540,110 L560,30 L580,90 L600,60 L800,60 L820,15 L840,105 L860,35 L880,85 L900,60 L1200,60" fill="none" stroke="#e87f33" strokeWidth="2" className="login-ecg-line" />
        </svg>
      </div>

      <div className="w-full max-w-md mx-4 relative z-10">
        {/* Logo Section */}
        <div className="text-center mb-8 login-float-in" style={{ animationDelay: '0.1s' }}>
          <div className="relative inline-block mb-5">
            <div className="w-20 h-20 rounded-3xl flex items-center justify-center mx-auto shadow-2xl login-logo-glow" style={{ background: 'linear-gradient(135deg, #e87f33 0%, #3e7a2c 100%)' }}>
              <Shield size={36} className="text-white drop-shadow-lg" />
            </div>
            {/* Pulse ring */}
            <div className="absolute inset-0 rounded-3xl login-pulse-ring" />
            {/* Floating icons */}
            <div className="absolute -top-2 -right-3 w-8 h-8 rounded-full bg-peach-500/20 flex items-center justify-center login-float-badge" style={{ animationDelay: '0s' }}>
              <Heart size={14} className="text-peach-400" />
            </div>
            <div className="absolute -bottom-1 -left-3 w-8 h-8 rounded-full bg-sage-500/20 flex items-center justify-center login-float-badge" style={{ animationDelay: '1s' }}>
              <Activity size={14} className="text-sage-400" />
            </div>
          </div>
          <h1 className="text-4xl font-extrabold text-white tracking-tight">VitalBridge</h1>
          <p className="text-peach-300/70 mt-2 text-sm font-medium tracking-wider uppercase">Healthcare Continuum Platform</p>
        </div>

        {/* Glass Card */}
        <div className="login-float-in login-glass-card rounded-3xl p-8 shadow-2xl" style={{ animationDelay: '0.25s' }}>
          <h2 className="text-xl font-bold text-white mb-1">Welcome back</h2>
          <p className="text-slate-400 text-sm mb-6">Sign in to continue to your dashboard</p>

          {error && (
            <div className="flex items-center gap-2 p-3.5 mb-5 rounded-xl text-sm login-error-bg border border-red-500/20">
              <AlertCircle size={16} className="text-red-400 shrink-0" />
              <span className="text-red-300">{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Email Address</label>
              <div className="relative">
                <input
                  id="login-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="login-input w-full"
                  placeholder="you@example.com"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">Password</label>
              <div className="relative">
                <input
                  id="login-password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="login-input w-full pr-11"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>
            <button
              id="login-submit"
              type="submit"
              disabled={loading}
              className="login-submit-btn w-full"
            >
              {loading ? <Loader2 size={20} className="animate-spin" /> : null}
              <span>{loading ? 'Signing in...' : 'Sign in'}</span>
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-slate-400">
            Don't have an account?{' '}
            <Link to="/register" className="text-peach-400 font-semibold hover:text-peach-300 transition-colors">Create one</Link>
          </p>

          {/* Demo accounts */}
          <div className="mt-6 pt-6 border-t border-white/10">
            <p className="text-xs text-slate-500 mb-3 text-center uppercase tracking-wider font-medium">Quick Demo Access</p>
            <div className="flex gap-2">
              {[
                { role: 'patient', label: '🧑 Patient', glow: 'from-peach-500/20 to-sage-500/20 hover:from-peach-500/30 hover:to-sage-500/30 text-peach-300 border-peach-500/20' },
                { role: 'doctor', label: '👨‍⚕️ Doctor', glow: 'from-sage-500/20 to-peach-500/20 hover:from-sage-500/30 hover:to-peach-500/30 text-sage-300 border-sage-500/20' },
                { role: 'health_worker', label: '🏥 ASHA', glow: 'from-amber-500/20 to-orange-500/20 hover:from-amber-500/30 hover:to-orange-500/30 text-amber-300 border-amber-500/20' },
              ].map((d) => (
                <button
                  key={d.role}
                  onClick={() => fillDemo(d.role)}
                  className={`flex-1 py-2.5 text-xs font-semibold rounded-xl transition-all duration-300 bg-gradient-to-br border ${d.glow} backdrop-blur-sm`}
                >
                  {d.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Bottom tagline */}
        <p className="text-center text-xs text-slate-600 mt-6 login-float-in" style={{ animationDelay: '0.4s' }}>
          🔒 Secured with AES-256 encryption & FHIR R4 compliance
        </p>
      </div>
    </div>
  );
}
