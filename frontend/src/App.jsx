import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Patients from './pages/Patients';
import PatientProfile from './pages/PatientProfile';
import Scheduling from './pages/Scheduling';
import Providers from './pages/Providers';
import Cases from './pages/Cases';
import Billing from './pages/Billing';
import Communications from './pages/Communications';
import Analytics from './pages/Analytics';
import Admin from './pages/Admin';

function PrivateRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="flex items-center justify-center h-screen">Loading...</div>;
  return user ? children : <Navigate to="/login" />;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<PrivateRoute><Layout /></PrivateRoute>}>
            <Route index element={<Dashboard />} />
            <Route path="patients" element={<Patients />} />
            <Route path="patients/:id" element={<PatientProfile />} />
            <Route path="scheduling" element={<Scheduling />} />
            <Route path="providers" element={<Providers />} />
            <Route path="cases" element={<Cases />} />
            <Route path="billing" element={<Billing />} />
            <Route path="communications" element={<Communications />} />
            <Route path="analytics" element={<Analytics />} />
            <Route path="admin" element={<Admin />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
