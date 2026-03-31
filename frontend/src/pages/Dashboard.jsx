import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line } from 'recharts';
import { AlertTriangle, Wifi, ArrowRight, AlertCircle, Clock, DollarSign } from 'lucide-react';
import api from '../api/client';
import StatCard from '../components/StatCard';
import Badge from '../components/Badge';
import { useWebSocket } from '../hooks/useWebSocket';

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [revenue, setRevenue] = useState([]);
  const [trend, setTrend] = useState([]);
  const [todayAppts, setTodayAppts] = useState([]);
  const [alerts, setAlerts] = useState({ overduePayments: [], pendingFollowUps: [], highRiskToday: [] });
  const [utilization, setUtilization] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);

  const loadAll = useCallback(() => {
    Promise.all([
      api.get('/analytics/dashboard'),
      api.get('/analytics/revenue'),
      api.get('/analytics/appointments-trend'),
      api.get('/appointments/today'),
      api.get('/analytics/alerts'),
      api.get('/analytics/chair-utilization'),
    ]).then(([s, r, t, a, al, u]) => {
      setStats(s.data); setRevenue(r.data); setTrend(t.data);
      setTodayAppts(a.data); setAlerts(al.data); setUtilization(u.data);
      setLastUpdated(new Date());
    });
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  useWebSocket(useCallback((msg) => {
    if (['APPOINTMENT_CREATED', 'APPOINTMENT_CANCELLED', 'PAYMENT_RECORDED', 'TREATMENT_UPDATED'].includes(msg.type)) loadAll();
  }, [loadAll]));

  const totalAlerts = alerts.overduePayments.length + alerts.pendingFollowUps.length + alerts.highRiskToday.length;

  if (!stats) return (
    <div className="p-6 flex items-center justify-center h-64">
      <div className="text-center text-gray-400">
        <div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full mx-auto mb-3" />
        <p className="text-sm">Loading dashboard...</p>
      </div>
    </div>
  );

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <div className="text-right">
          <p className="text-sm text-gray-500">{new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
          {lastUpdated && (
            <p className="text-xs text-green-500 flex items-center justify-end gap-1 mt-0.5">
              <Wifi size={11} /> Live · Updated {lastUpdated.toLocaleTimeString()}
            </p>
          )}
        </div>
      </div>

      {/* Alerts Panel */}
      {totalAlerts > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <h2 className="font-semibold text-amber-800 mb-3 flex items-center gap-2">
            <AlertTriangle size={16} /> Alerts ({totalAlerts})
          </h2>
          <div className="space-y-2 max-h-40 overflow-y-auto">
            {alerts.highRiskToday.map((a) => (
              <div key={a.id} className="flex items-center gap-2 text-sm">
                <AlertCircle size={13} className={a.severity === 'high' ? 'text-red-500' : 'text-yellow-500'} />
                <span className="text-gray-700">{a.message}</span>
                <Link to="/scheduling" className="ml-auto text-xs text-blue-600 hover:underline shrink-0 flex items-center gap-1">View <ArrowRight size={11} /></Link>
              </div>
            ))}
            {alerts.overduePayments.map((a) => (
              <div key={a.id} className="flex items-center gap-2 text-sm">
                <DollarSign size={13} className="text-red-500" />
                <span className="text-gray-700">{a.message}</span>
                <Link to="/billing" className="ml-auto text-xs text-blue-600 hover:underline shrink-0 flex items-center gap-1">Collect <ArrowRight size={11} /></Link>
              </div>
            ))}
            {alerts.pendingFollowUps.map((a) => (
              <div key={a.id} className="flex items-center gap-2 text-sm">
                <Clock size={13} className="text-yellow-500" />
                <span className="text-gray-700">{a.message}</span>
                <Link to="/cases" className="ml-auto text-xs text-blue-600 hover:underline shrink-0 flex items-center gap-1">Review <ArrowRight size={11} /></Link>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Total Patients" value={stats.totalPatients} color="blue" />
        <StatCard label="Today's Appointments" value={stats.todayAppointments} color="green" />
        <StatCard label="No-Show Rate" value={`${stats.noShowRate}%`} sub="This month" color={stats.noShowRate > 20 ? 'red' : 'green'} />
        <StatCard label="Acceptance Rate" value={`${stats.acceptanceRate}%`} sub="Treatment plans" color="purple" />
        <StatCard label="Total Revenue" value={`$${stats.totalRevenue.toLocaleString()}`} color="green" />
        <StatCard label="Pending Collections" value={`$${stats.pendingPayments.toLocaleString()}`} color="yellow" />
        <StatCard label="Chair Utilization" value={utilization ? `${utilization.utilizationRate}%` : `${stats.utilizationRate}%`} sub={utilization ? `${utilization.usedMinutes} / ${utilization.totalAvailableMinutes} min` : 'This month'} color={utilization ? (utilization.utilizationRate >= 80 ? 'green' : utilization.utilizationRate >= 60 ? 'yellow' : 'red') : 'yellow'} />
        <StatCard label="Month Appointments" value={stats.monthAppointments} color="blue" />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border p-4">
          <h2 className="font-semibold text-gray-700 mb-3">Revenue (6 months)</h2>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={revenue}>
              <XAxis dataKey="month" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip formatter={(v) => `$${v.toLocaleString()}`} />
              <Bar dataKey="revenue" fill="#2563eb" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div className="bg-white rounded-xl border p-4">
          <h2 className="font-semibold text-gray-700 mb-3">Appointments (7 days)</h2>
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={trend}>
              <XAxis dataKey="day" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Line type="monotone" dataKey="total" stroke="#2563eb" strokeWidth={2} dot={false} name="Total" />
              <Line type="monotone" dataKey="noShow" stroke="#ef4444" strokeWidth={2} dot={false} name="No-Show" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Today's Appointments */}
      <div className="bg-white rounded-xl border p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-semibold text-gray-700">Today's Appointments</h2>
          <Link to="/scheduling" className="text-sm text-blue-600 hover:underline flex items-center gap-1">View all <ArrowRight size={13} /></Link>
        </div>
        {todayAppts.length === 0 ? (
          <p className="text-gray-400 text-sm py-4 text-center">No appointments today</p>
        ) : (
          <div>
            {todayAppts.map((a) => (
              <div key={a.id} className="flex items-center justify-between py-2.5 border-b last:border-0">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-gray-500 w-16 shrink-0">
                    {new Date(a.scheduledAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                  <div>
                    <p className="text-sm font-medium">{a.patient.firstName} {a.patient.lastName}</p>
                    <p className="text-xs text-gray-500">{a.procedure} · {a.provider.name}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {a.noShowProbability > 0.4 && (
                    <span className="flex items-center gap-1 text-xs text-orange-500 font-medium">
                      <AlertTriangle size={12} /> {Math.round(a.noShowProbability * 100)}%
                    </span>
                  )}
                  {a.isEmergency && (
                    <span className="flex items-center gap-1 text-xs text-red-500 font-medium">
                      <AlertCircle size={12} /> Emergency
                    </span>
                  )}
                  <Badge value={a.status} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
