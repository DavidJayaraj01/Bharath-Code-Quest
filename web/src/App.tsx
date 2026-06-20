import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect } from 'react';
import { useAuthStore } from './store/authStore';
import Login from './pages/Login';
import Register from './pages/Register';
import PatientChat from './pages/PatientChat';
import PatientPassport from './pages/PatientPassport';
import DoctorDashboard from './pages/DoctorDashboard';
import DoctorCase from './pages/DoctorCase';
import SurveillanceDashboard from './pages/SurveillanceDashboard';
import Layout from './components/Layout';

function ProtectedRoute({ children, roles }: { children: React.ReactNode; roles?: string[] }) {
  const { isAuthenticated, user } = useAuthStore();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (roles && user && !roles.includes(user.role)) return <Navigate to="/" replace />;
  return <>{children}</>;
}

function RoleRedirect() {
  const { user } = useAuthStore();
  if (!user) return <Navigate to="/login" replace />;
  switch (user.role) {
    case 'patient': return <Navigate to="/chat" replace />;
    case 'doctor': return <Navigate to="/doctor" replace />;
    case 'health_worker': return <Navigate to="/surveillance" replace />;
    case 'admin': return <Navigate to="/surveillance" replace />;
    default: return <Navigate to="/login" replace />;
  }
}

export default function App() {
  const hydrate = useAuthStore((s) => s.hydrate);
  useEffect(() => { hydrate(); }, [hydrate]);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
          <Route index element={<RoleRedirect />} />
          <Route path="chat" element={<ProtectedRoute roles={['patient']}><PatientChat /></ProtectedRoute>} />
          <Route path="chat/:conversationId" element={<ProtectedRoute roles={['patient']}><PatientChat /></ProtectedRoute>} />
          <Route path="passport" element={<ProtectedRoute roles={['patient']}><PatientPassport /></ProtectedRoute>} />
          <Route path="doctor" element={<ProtectedRoute roles={['doctor']}><DoctorDashboard /></ProtectedRoute>} />
          <Route path="doctor/case/:conversationId" element={<ProtectedRoute roles={['doctor']}><DoctorCase /></ProtectedRoute>} />
          <Route path="surveillance" element={<ProtectedRoute roles={['health_worker', 'doctor', 'admin']}><SurveillanceDashboard /></ProtectedRoute>} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}
