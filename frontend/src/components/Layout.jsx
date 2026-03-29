import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import LiveToast from './LiveToast';
import {
  LayoutDashboard, Users, CalendarDays, Stethoscope,
  ClipboardList, CreditCard, MessageSquare, BarChart2,
  Settings, LogOut, Activity,
} from 'lucide-react';

const nav = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, exact: true },
  { to: '/patients', label: 'Patients', icon: Users },
  { to: '/scheduling', label: 'Scheduling', icon: CalendarDays },
  { to: '/providers', label: 'Providers', icon: Stethoscope },
  { to: '/cases', label: 'Cases', icon: ClipboardList },
  { to: '/billing', label: 'Billing', icon: CreditCard },
  { to: '/communications', label: 'Communications', icon: MessageSquare },
  { to: '/analytics', label: 'Analytics', icon: BarChart2 },
  { to: '/admin', label: 'Admin', icon: Settings },
];

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const handleLogout = () => { logout(); navigate('/login'); };

  return (
    <div className="flex h-screen overflow-hidden">
      <aside className="w-56 bg-blue-900 text-white flex flex-col shrink-0">
        <div className="p-4 border-b border-blue-800 flex items-center gap-2">
          <Activity size={20} className="text-blue-300" />
          <div>
            <h1 className="text-sm font-bold leading-tight">Smart DentalOps</h1>
            <p className="text-xs text-blue-400">Practice Intelligence</p>
          </div>
        </div>
        <nav className="flex-1 p-2 space-y-0.5 overflow-y-auto">
          {nav.map(({ to, label, icon: Icon, exact }) => (
            <NavLink
              key={to}
              to={to}
              end={exact}
              className={({ isActive }) =>
                `flex items-center gap-2.5 px-3 py-2 rounded text-sm transition-colors ${isActive ? 'bg-blue-700 text-white' : 'text-blue-200 hover:bg-blue-800 hover:text-white'}`
              }
            >
              <Icon size={15} />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="p-3 border-t border-blue-800">
          <p className="text-xs text-blue-300 font-medium truncate">{user?.name}</p>
          <p className="text-xs text-blue-500 mb-2">{user?.role}</p>
          <button onClick={handleLogout} className="flex items-center gap-1.5 text-xs text-red-300 hover:text-red-100 transition-colors">
            <LogOut size={13} /> Logout
          </button>
        </div>
      </aside>
      <main className="flex-1 overflow-y-auto bg-gray-50">
        <Outlet />
      </main>
      <LiveToast />
    </div>
  );
}
