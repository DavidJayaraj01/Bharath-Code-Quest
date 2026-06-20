import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { MessageSquare, FileHeart, Stethoscope, Activity, LogOut, Shield } from 'lucide-react';

const navItems: Record<string, { label: string; path: string; icon: React.ReactNode }[]> = {
  patient: [
    { label: 'AI Triage', path: '/chat', icon: <MessageSquare size={20} /> },
    { label: 'Health Passport', path: '/passport', icon: <FileHeart size={20} /> },
  ],
  doctor: [
    { label: 'Patient Queue', path: '/doctor', icon: <Stethoscope size={20} /> },
    { label: 'Surveillance', path: '/surveillance', icon: <Activity size={20} /> },
  ],
  health_worker: [
    { label: 'Surveillance', path: '/surveillance', icon: <Activity size={20} /> },
  ],
  admin: [
    { label: 'Surveillance', path: '/surveillance', icon: <Activity size={20} /> },
  ],
};

export default function Layout() {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const items = navItems[user?.role || 'patient'] || [];

  return (
    <div className="flex h-screen bg-slate-50 flex-col lg:flex-row">
      {/* Sidebar - Desktop */}
      <aside className="hidden lg:flex w-64 bg-navy-900 text-white flex-col shrink-0">
        {/* Logo */}
        <div className="px-6 py-5 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-teal-500 flex items-center justify-center">
              <Shield size={20} className="text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight">VitalBridge</h1>
              <p className="text-[11px] text-slate-400 -mt-0.5">Healthcare Continuum</p>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-1">
          {items.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200
                ${isActive
                  ? 'bg-teal-500/20 text-teal-300'
                  : 'text-slate-300 hover:bg-white/5 hover:text-white'
                }`
              }
            >
              {item.icon}
              {item.label}
            </NavLink>
          ))}
        </nav>

        {/* User info */}
        <div className="px-4 py-4 border-t border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-teal-500/20 flex items-center justify-center text-teal-300 text-sm font-bold">
              {user?.full_name?.charAt(0) || '?'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">{user?.full_name}</p>
              <p className="text-[11px] text-slate-400 capitalize">{user?.role?.replace('_', ' ')}</p>
            </div>
            <button
              onClick={handleLogout}
              className="p-2 rounded-lg hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
              title="Logout"
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile Bottom Tab Bar */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 h-16 bg-white border-t border-slate-200 flex items-center justify-around z-50 px-4 pb-[env(safe-area-inset-bottom)] shadow-lg">
        {items.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              `flex flex-col items-center justify-center gap-1 text-[10px] font-medium transition-all duration-200
              ${isActive ? 'text-teal-500' : 'text-slate-400 hover:text-slate-600'}`
            }
          >
            {item.icon}
            <span>{item.label}</span>
          </NavLink>
        ))}
        {/* Mobile logout */}
        <button
          onClick={handleLogout}
          className="flex flex-col items-center justify-center gap-1 text-[10px] font-medium text-slate-400 hover:text-slate-600"
          title="Logout"
        >
          <LogOut size={20} />
          <span>Logout</span>
        </button>
      </nav>

      {/* Main content */}
      <main className="flex-1 overflow-auto pb-20 lg:pb-0">
        <Outlet />
      </main>
    </div>
  );
}
