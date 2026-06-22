import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import api from '../api/client';
import { Loader2, AlertCircle, Heart, Activity, Eye, EyeOff, Phone, CheckCircle2, ArrowRight, ArrowLeft, User, Mail, Lock, Smartphone } from 'lucide-react';
import logoImg from '../assets/logo.png';
import type { TokenResponse } from '../types';
import { MapContainer, TileLayer, CircleMarker, Popup, useMap, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

const INDIAN_CITIES = [
  { name: 'Mumbai', state: 'Maharashtra', lat: 19.0760, lng: 72.8777 },
  { name: 'Delhi', state: 'Delhi', lat: 28.7041, lng: 77.1025 },
  { name: 'Bengaluru', state: 'Karnataka', lat: 12.9716, lng: 77.5946 },
  { name: 'Chennai', state: 'Tamil Nadu', lat: 13.0827, lng: 80.2707 },
  { name: 'Hyderabad', state: 'Telangana', lat: 17.3850, lng: 78.4867 },
  { name: 'Kolkata', state: 'West Bengal', lat: 22.5726, lng: 88.3639 },
  { name: 'Pune', state: 'Maharashtra', lat: 18.5204, lng: 73.8567 },
  { name: 'Jaipur', state: 'Rajasthan', lat: 26.9124, lng: 75.7873 },
  { name: 'Ahmedabad', state: 'Gujarat', lat: 23.0225, lng: 72.5714 },
  { name: 'Lucknow', state: 'Uttar Pradesh', lat: 26.8467, lng: 80.9462 },
  { name: 'Patna', state: 'Bihar', lat: 25.5941, lng: 85.1376 },
  { name: 'Bhopal', state: 'Madhya Pradesh', lat: 23.2599, lng: 77.4126 },
  { name: 'Guwahati', state: 'Assam', lat: 26.1445, lng: 91.7362 },
  { name: 'Kochi', state: 'Kerala', lat: 9.9312, lng: 76.2673 },
  { name: 'Srinagar', state: 'Jammu & Kashmir', lat: 34.0837, lng: 74.7973 },
  { name: 'Visakhapatnam', state: 'Andhra Pradesh', lat: 17.6868, lng: 83.2185 },
  { name: 'Chandigarh', state: 'Punjab', lat: 30.7333, lng: 76.7794 },
  { name: 'Dehradun', state: 'Uttarakhand', lat: 30.3165, lng: 78.0322 },
  { name: 'Shimla', state: 'Himachal Pradesh', lat: 31.1048, lng: 77.1734 },
  { name: 'Bhubaneswar', state: 'Odisha', lat: 20.2961, lng: 85.8245 },
  { name: 'Raipur', state: 'Chhattisgarh', lat: 21.2514, lng: 81.6296 },
  { name: 'Ranchi', state: 'Jharkhand', lat: 23.3441, lng: 85.3096 },
  { name: 'Panaji', state: 'Goa', lat: 15.4909, lng: 73.8278 },
  { name: 'Thiruvananthapuram', state: 'Kerala', lat: 8.5241, lng: 76.9366 },
];

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

function MapPanToSelected({ center }: { center: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, map.getZoom() > 5 ? map.getZoom() : 6, { animate: true });
  }, [center, map]);
  return null;
}

function MapClickHandler({ onMapClick }: { onMapClick: (lat: number, lng: number) => void }) {
  useMapEvents({
    click(e) {
      onMapClick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

type Step = 'details' | 'phone' | 'otp';

export default function Register() {
  // Form fields
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('patient');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [city, setCity] = useState('');

  // Step management
  const [step, setStep] = useState<Step>('details');

  // OTP states
  const [otpVerified, setOtpVerified] = useState(false);
  const [otpLoading, setOtpLoading] = useState(false);
  const [otpError, setOtpError] = useState('');
  const [otpCountdown, setOtpCountdown] = useState(0);
  const [otpSuccessMessage, setOtpSuccessMessage] = useState('');

  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const login = useAuthStore((s) => s.login);
  const navigate = useNavigate();

  // Send OTP
  const handleSendOtp = async () => {
    if (phone.length !== 10) {
      setOtpError('Please enter a valid 10-digit mobile number');
      return;
    }
    setOtpError('');
    setOtpLoading(true);
    setOtpSuccessMessage('');
    try {
      const { data } = await api.post('/auth/otp/send', { phone: phone.trim() });
      if (data.success) {
        setStep('otp');
        setOtpSuccessMessage(data.message || '');
        // Start countdown
        setOtpCountdown(60);
        const interval = setInterval(() => {
          setOtpCountdown(prev => {
            if (prev <= 1) {
              clearInterval(interval);
              return 0;
            }
            return prev - 1;
          });
        }, 1000);

        // Bypassed/Fallback mode (unverified trial number)
        if (data.message && data.message.includes('Use code:')) {
          const match = data.message.match(/Use code:\s*(\d+)/);
          if (match) {
            setOtp(match[match.length - 1]);
          }
        }
      } else {
        setOtpError(data.message || 'Failed to send OTP');
      }
    } catch (err: any) {
      setOtpError(err.response?.data?.detail || 'Failed to send OTP. Please check your mobile number.');
    } finally {
      setOtpLoading(false);
    }
  };

  // Verify OTP
  const handleVerifyOtp = async () => {
    if (!otp.trim() || otp.length < 6) {
      setOtpError('Please enter the 6-digit OTP');
      return;
    }
    setOtpError('');
    setOtpLoading(true);
    try {
      const { data } = await api.post('/auth/otp/verify', { phone: phone.trim(), otp: otp.trim() });
      if (data.success) {
        setOtpVerified(true);
        setOtpError('');
      } else {
        setOtpError('Invalid or expired OTP. Please try again.');
      }
    } catch (err: any) {
      setOtpError(err.response?.data?.detail || 'OTP verification failed');
    } finally {
      setOtpLoading(false);
    }
  };

  // Final Registration
  const handleSubmit = async () => {
    setError('');
    setLoading(true);
    try {
      const payload: any = {
        email,
        password,
        full_name: fullName,
        role,
        city: city || undefined,
      };
      if (phone.trim() && otpVerified) {
        payload.phone = phone.trim();
        payload.otp = otp.trim();
      }
      const { data } = await api.post<TokenResponse>('/auth/register', payload);
      login(data.access_token, data.user);
      navigate('/');
    } catch (err: any) {
      setError(err.response?.data?.detail || 'Registration failed.');
    } finally {
      setLoading(false);
    }
  };

  const canProceedToPhone = fullName.trim() && email.trim() && password.length >= 6 && city;

  const renderStep = () => {
    switch (step) {
      case 'details':
        return (
          <div className="space-y-5 login-step-enter">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-8 h-8 rounded-full bg-peach-500/20 flex items-center justify-center text-peach-400 text-sm font-bold">1</div>
              <div>
                <p className="text-white font-semibold text-sm">Account Details</p>
                <p className="text-slate-500 text-xs">Basic information for your profile</p>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                <User size={14} className="inline mr-1.5 -mt-0.5 text-slate-500" />
                Full Name
              </label>
              <input
                id="register-name"
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
                className="login-input w-full"
                placeholder="Dr. Ananya Iyer"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                <Mail size={14} className="inline mr-1.5 -mt-0.5 text-slate-500" />
                Email Address
              </label>
              <input
                id="register-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="login-input w-full"
                placeholder="you@example.com"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                <Lock size={14} className="inline mr-1.5 -mt-0.5 text-slate-500" />
                Password
              </label>
              <div className="relative">
                <input
                  id="register-password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  className="login-input w-full pr-11"
                  placeholder="Min. 6 characters"
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
            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">I am a</label>
              <div className="flex gap-3">
                {[
                  { value: 'patient', label: '🧑 Patient', desc: 'Get AI health triage' },
                  { value: 'doctor', label: '👨‍⚕️ Doctor', desc: 'Review patient cases' },
                ].map((r) => (
                  <button
                    key={r.value}
                    type="button"
                    onClick={() => {
                      setRole(r.value);
                    }}
                    className={`flex-1 py-3 px-4 rounded-xl border text-left transition-all duration-300 ${
                      role === r.value
                        ? 'border-peach-500/50 bg-peach-500/10 shadow-lg shadow-peach-500/10'
                        : 'border-white/10 bg-white/5 hover:border-white/20'
                    }`}
                  >
                    <p className="text-sm font-semibold text-white">{r.label}</p>
                    <p className="text-[11px] text-slate-500 mt-0.5">{r.desc}</p>
                  </button>
                ))}
              </div>
            </div>

            {(role === 'patient' || role === 'doctor') && (() => {
              const selectedCityObj = INDIAN_CITIES.find(c => c.name === city);
              const selectedCityCoords: [number, number] = selectedCityObj 
                ? [selectedCityObj.lat, selectedCityObj.lng] 
                : [20.5937, 78.9629];

              const handleMapClick = (lat: number, lng: number) => {
                let nearestCity = INDIAN_CITIES[0];
                let minDistance = Infinity;
                INDIAN_CITIES.forEach((c) => {
                  const dist = Math.pow(c.lat - lat, 2) + Math.pow(c.lng - lng, 2);
                  if (dist < minDistance) {
                    minDistance = dist;
                    nearestCity = c;
                  }
                });
                setCity(nearestCity.name);
              };

              return (
                <div className="space-y-3">
                  <label className="block text-sm font-medium text-slate-300">
                    Select Location (City)
                  </label>
                  <select
                    id="register-city"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    required
                    className="login-input w-full bg-slate-950/50 text-white rounded-xl border border-white/10 px-3 py-3 text-sm outline-none focus:border-peach-500/50"
                    style={{ colorScheme: 'dark' }}
                  >
                    <option value="" disabled className="bg-slate-900 text-slate-400">Select city...</option>
                    {INDIAN_CITIES.map((c) => (
                      <option key={c.name} value={c.name} className="bg-slate-900 text-white">
                        {c.name} ({c.state})
                      </option>
                    ))}
                  </select>

                  <div className="h-44 rounded-xl overflow-hidden border border-white/10 relative z-0">
                    <MapContainer
                      center={selectedCityCoords}
                      zoom={4}
                      className="h-full w-full"
                      zoomControl={false}
                    >
                      <TileLayer
                        url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                        attribution='&copy; OpenStreetMap &copy; CARTO'
                      />
                      <MapPanToSelected center={selectedCityCoords} />
                      <MapResizeInvalidator />
                      <MapClickHandler onMapClick={handleMapClick} />
                      
                      {INDIAN_CITIES.map((c) => (
                        <CircleMarker
                          key={c.name}
                          center={[c.lat, c.lng]}
                          radius={city === c.name ? 8 : 4}
                          fillColor={city === c.name ? '#FF9C5F' : '#6E8552'}
                          color={city === c.name ? '#FF9C5F' : '#6E8552'}
                          weight={city === c.name ? 3 : 1}
                          fillOpacity={0.8}
                          eventHandlers={{
                            click: () => setCity(c.name),
                          }}
                        >
                          <Popup>
                            <div className="text-xs font-bold text-[#0D1B2A]">{c.name}</div>
                            <div className="text-[10px] text-slate-500">{c.state}</div>
                          </Popup>
                        </CircleMarker>
                      ))}
                    </MapContainer>
                  </div>
                  <p className="text-[10px] text-slate-500 leading-normal">
                    Tip: Click any marker or click anywhere on the India map to select the closest city.
                  </p>
                </div>
              );
            })()}

            <button
              type="button"
              onClick={() => setStep('phone')}
              disabled={!canProceedToPhone}
              className="login-submit-btn w-full"
            >
              <span>Continue</span>
              <ArrowRight size={18} />
            </button>
          </div>
        );

      case 'phone':
        return (
          <div className="space-y-5 login-step-enter">
            <div className="flex items-center gap-3 mb-2">
              <button onClick={() => setStep('details')} className="text-slate-500 hover:text-slate-300 transition-colors">
                <ArrowLeft size={18} />
              </button>
              <div className="w-8 h-8 rounded-full bg-peach-500/20 flex items-center justify-center text-peach-400 text-sm font-bold">2</div>
              <div>
                <p className="text-white font-semibold text-sm">Phone Verification</p>
                <p className="text-slate-500 text-xs">Verify via SMS OTP</p>
              </div>
            </div>

            {/* Info banner */}
            <div className="flex items-start gap-3 p-4 rounded-xl bg-sage-500/10 border border-sage-500/20">
              <Smartphone size={20} className="text-sage-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-sage-300 text-sm font-medium">SMS OTP Verification</p>
                <p className="text-slate-400 text-xs mt-1 leading-relaxed">
                  We'll send a 6-digit OTP to your phone via SMS. Health reports will be sent to this number via WhatsApp.
                </p>
              </div>
            </div>

            {otpError && (
              <div className="flex items-center gap-2 p-3 rounded-xl text-sm login-error-bg border border-red-500/20">
                <AlertCircle size={16} className="text-red-400 shrink-0" />
                <span className="text-red-300">{otpError}</span>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-slate-300 mb-2">
                <Phone size={14} className="inline mr-1.5 -mt-0.5 text-slate-500" />
                Mobile Number (10 digits)
              </label>
              <div className="flex gap-2">
                <div className="flex flex-1 rounded-xl border border-white/10 bg-white/5 overflow-hidden focus-within:border-peach-500/50 transition-all duration-300">
                  <span className="flex items-center justify-center px-3 bg-white/10 text-slate-300 text-sm font-semibold border-r border-white/10 select-none">
                    +91
                  </span>
                  <input
                    id="register-phone"
                    type="tel"
                    value={phone}
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, ''); // only allow digits
                      if (val.length <= 10) {
                        setPhone(val);
                      }
                    }}
                    className="w-full bg-transparent px-3 py-2 text-white text-sm outline-none placeholder:text-slate-500"
                    placeholder="9876543210"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleSendOtp}
                  disabled={otpLoading || phone.length !== 10}
                  className="px-5 py-3 rounded-xl font-semibold text-sm transition-all duration-300 disabled:opacity-40 disabled:cursor-not-allowed"
                  style={{ background: 'linear-gradient(135deg, #FF9C5F 0%, #C25B20 100%)', color: 'white' }}
                >
                  {otpLoading ? <Loader2 size={18} className="animate-spin" /> : 'Send OTP'}
                </button>
              </div>
              <p className="text-xs text-slate-600 mt-2">Enter your 10-digit Indian mobile number (e.g. 9840488355)</p>
            </div>

            {/* Skip phone verification option */}
            <div className="flex items-center gap-3">
              <div className="flex-1 h-px bg-white/10" />
              <span className="text-xs text-slate-600 uppercase tracking-wide">or</span>
              <div className="flex-1 h-px bg-white/10" />
            </div>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={loading}
              className="w-full py-3 rounded-xl border border-white/10 bg-white/5 text-slate-300 text-sm font-medium hover:bg-white/10 transition-all flex items-center justify-center gap-2"
            >
              {loading ? <Loader2 size={16} className="animate-spin" /> : null}
              Skip & Create Account
            </button>
          </div>
        );

      case 'otp':
        return (
          <div className="space-y-5 login-step-enter">
            <div className="flex items-center gap-3 mb-2">
              <button onClick={() => setStep('phone')} className="text-slate-500 hover:text-slate-300 transition-colors">
                <ArrowLeft size={18} />
              </button>
              <div className="w-8 h-8 rounded-full bg-peach-500/20 flex items-center justify-center text-peach-400 text-sm font-bold">3</div>
              <div>
                <p className="text-white font-semibold text-sm">Enter OTP</p>
                <p className="text-slate-500 text-xs">Check your SMS messages for the code</p>
              </div>
            </div>

            {/* OTP sent success */}
            <div className="flex items-start gap-3 p-4 rounded-xl bg-sage-500/10 border border-sage-500/20">
              <CheckCircle2 size={20} className="text-sage-400 shrink-0 mt-0.5" />
              <div>
                <p className="text-sage-300 text-sm font-medium">OTP Status</p>
                <p className="text-slate-400 text-xs mt-1">
                  {otpSuccessMessage ? (
                    otpSuccessMessage.includes('Use code:') ? (
                      <span>
                        SMS delivery skipped (unverified number). Developer code auto-filled:{" "}
                        <strong className="text-amber-400 font-bold">{otpSuccessMessage.match(/Use code:\s*(\d+)/)?.[1]}</strong>
                      </span>
                    ) : (
                      otpSuccessMessage
                    )
                  ) : (
                    `A 6-digit code was sent to +91 ${phone} via SMS.`
                  )}
                </p>
              </div>
            </div>

            {otpError && (
              <div className="flex items-center gap-2 p-3 rounded-xl text-sm login-error-bg border border-red-500/20">
                <AlertCircle size={16} className="text-red-400 shrink-0" />
                <span className="text-red-300">{otpError}</span>
              </div>
            )}

            {otpVerified ? (
              <>
                <div className="flex items-center gap-3 p-4 rounded-xl bg-sage-500/10 border border-sage-500/30">
                  <div className="w-10 h-10 rounded-full bg-sage-500/20 flex items-center justify-center">
                    <CheckCircle2 size={22} className="text-sage-400" />
                  </div>
                  <div>
                    <p className="text-sage-300 font-semibold text-sm">Phone Verified!</p>
                    <p className="text-slate-400 text-xs">Your number is confirmed. Creating account...</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={loading}
                  className="login-submit-btn w-full"
                >
                  {loading ? <Loader2 size={20} className="animate-spin" /> : null}
                  <span>{loading ? 'Creating account...' : 'Create Account'}</span>
                </button>
              </>
            ) : (
              <>
                <div>
                  <label className="block text-sm font-medium text-slate-300 mb-2">Enter 6-digit OTP</label>
                  <input
                    id="register-otp"
                    type="text"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    className="login-input w-full text-center text-2xl tracking-[0.5em] font-mono"
                    placeholder="000000"
                    maxLength={6}
                  />
                </div>
                <button
                  type="button"
                  onClick={handleVerifyOtp}
                  disabled={otpLoading || otp.length < 6}
                  className="login-submit-btn w-full"
                >
                  {otpLoading ? <Loader2 size={20} className="animate-spin" /> : null}
                  <span>{otpLoading ? 'Verifying...' : 'Verify OTP'}</span>
                </button>
                <div className="text-center">
                  {otpCountdown > 0 ? (
                    <p className="text-xs text-slate-500">Resend OTP in <span className="text-peach-400 font-semibold">{otpCountdown}s</span></p>
                  ) : (
                    <button onClick={handleSendOtp} disabled={otpLoading} className="text-xs text-peach-400 font-medium hover:text-peach-300 transition-colors">
                      Resend OTP
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        );
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden" style={{ background: 'linear-gradient(135deg, #130d0a 0%, #1c130d 25%, #2c1a11 50%, #1c130d 75%, #130d0a 100%)' }}>
      {/* Animated Background Orbs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="login-orb login-orb-1" />
        <div className="login-orb login-orb-2" />
        <div className="login-orb login-orb-3" />
        <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.8) 1px, transparent 1px)', backgroundSize: '32px 32px' }} />
        <svg className="absolute bottom-0 left-0 w-full h-32 opacity-10" viewBox="0 0 1200 120" preserveAspectRatio="none">
          <path d="M0,60 L200,60 L220,20 L240,100 L260,40 L280,80 L300,60 L500,60 L520,10 L540,110 L560,30 L580,90 L600,60 L800,60 L820,15 L840,105 L860,35 L880,85 L900,60 L1200,60" fill="none" stroke="#FF9C5F" strokeWidth="2" className="login-ecg-line" />
        </svg>
      </div>

      <div className="w-full max-w-md mx-4 relative z-10">
        {/* Logo */}
        <div className="text-center mb-8 login-float-in" style={{ animationDelay: '0.1s' }}>
          <div className="relative inline-block mb-5">
            <div className="w-20 h-20 rounded-3xl flex items-center justify-center mx-auto shadow-2xl login-logo-glow overflow-hidden bg-slate-950/80 p-3.5 border border-white/10">
              <img src={logoImg} alt="VitalBridge Logo" className="object-contain w-full h-full" />
            </div>
            <div className="absolute inset-0 rounded-3xl login-pulse-ring" />
            <div className="absolute -top-2 -right-3 w-8 h-8 rounded-full bg-peach-500/20 flex items-center justify-center login-float-badge" style={{ animationDelay: '0s' }}>
              <Heart size={14} className="text-peach-400" />
            </div>
            <div className="absolute -bottom-1 -left-3 w-8 h-8 rounded-full bg-sage-500/20 flex items-center justify-center login-float-badge" style={{ animationDelay: '1s' }}>
              <Activity size={14} className="text-sage-400" />
            </div>
          </div>
          <h1 className="text-4xl font-extrabold text-white tracking-tight">Create Account</h1>
          <p className="text-peach-300/70 mt-2 text-sm font-medium tracking-wider uppercase">Join VitalBridge Today</p>
        </div>

        {/* Progress indicator */}
        <div className="flex items-center justify-center gap-2 mb-6 login-float-in" style={{ animationDelay: '0.2s' }}>
          {(['details', 'phone', 'otp'] as Step[]).map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              <div className={`w-2.5 h-2.5 rounded-full transition-all duration-500 ${
                step === s ? 'bg-peach-400 shadow-lg shadow-peach-400/50 scale-125' :
                (['details', 'phone', 'otp'].indexOf(step) > i) ? 'bg-peach-600' : 'bg-white/10'
              }`} />
              {i < 2 && <div className={`w-8 h-0.5 rounded-full transition-all duration-500 ${
                (['details', 'phone', 'otp'].indexOf(step) > i) ? 'bg-peach-600' : 'bg-white/10'
              }`} />}
            </div>
          ))}
        </div>

        {/* Glass Card */}
        <div className="login-float-in login-glass-card rounded-3xl p-8 shadow-2xl" style={{ animationDelay: '0.25s' }}>
          {error && (
            <div className="flex items-center gap-2 p-3.5 mb-5 rounded-xl text-sm login-error-bg border border-red-500/20">
              <AlertCircle size={16} className="text-red-400 shrink-0" />
              <span className="text-red-300">{error}</span>
            </div>
          )}

          {renderStep()}

          <p className="mt-6 text-center text-sm text-slate-400">
            Already have an account?{' '}
            <Link to="/login" className="text-peach-400 font-semibold hover:text-peach-300 transition-colors">Sign in</Link>
          </p>
        </div>

        <p className="text-center text-xs text-slate-600 mt-6 login-float-in" style={{ animationDelay: '0.4s' }}>
          🔒 Secured with AES-256 encryption & FHIR R4 compliance
        </p>
      </div>
    </div>
  );
}
