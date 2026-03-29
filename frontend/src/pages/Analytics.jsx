import { useEffect, useState, useCallback } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell, Legend } from 'recharts';
import api from '../api/client';
import StatCard from '../components/StatCard';
import { useWebSocket } from '../hooks/useWebSocket';

const COLORS = ['#2563eb', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

export default function Analytics() {
  const [stats, setStats] = useState(null);
  const [revenue, setRevenue] = useState([]);
  const [trend, setTrend] = useState([]);
  const [providers, setProviders] = useState([]);

  const loadAll = useCallback(() => {
    Promise.all([
      api.get('/analytics/dashboard'),
      api.get('/analytics/revenue'),
      api.get('/analytics/appointments-trend'),
      api.get('/analytics/providers'),
    ]).then(([s, r, t, p]) => {
      setStats(s.data);
      setRevenue(r.data);
      setTrend(t.data);
      setProviders(p.data);
    });
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  // Auto-refresh on real-time events
  useWebSocket(useCallback((msg) => {
    if (['APPOINTMENT_CREATED', 'APPOINTMENT_CANCELLED', 'PAYMENT_RECORDED', 'TREATMENT_UPDATED'].includes(msg.type)) {
      loadAll();
    }
  }, [loadAll]));

  if (!stats) return <div className="p-6 text-gray-500">Loading analytics...</div>;

  const pieData = stats.treatmentBreakdown.map((t) => ({ name: t.status, value: t._count }));

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">Analytics & Insights</h1>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Total Patients" value={stats.totalPatients} color="blue" />
        <StatCard label="No-Show Rate" value={`${stats.noShowRate}%`} color="red" sub="This month" />
        <StatCard label="Chair Utilization" value={`${stats.utilizationRate}%`} color="green" sub="This month" />
        <StatCard label="Acceptance Rate" value={`${stats.acceptanceRate}%`} color="purple" sub="Treatment plans" />
        <StatCard label="Total Revenue" value={`$${stats.totalRevenue.toLocaleString()}`} color="green" />
        <StatCard label="Pending Collections" value={`$${stats.pendingPayments.toLocaleString()}`} color="yellow" />
        <StatCard label="Today's Appointments" value={stats.todayAppointments} color="blue" />
        <StatCard label="Month Appointments" value={stats.monthAppointments} color="purple" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl border p-4">
          <h2 className="font-semibold text-gray-700 mb-3">Monthly Revenue</h2>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={revenue}>
              <XAxis dataKey="month" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip formatter={(v) => `$${v.toLocaleString()}`} />
              <Bar dataKey="revenue" fill="#2563eb" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded-xl border p-4">
          <h2 className="font-semibold text-gray-700 mb-3">Appointment Trend (7 days)</h2>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={trend}>
              <XAxis dataKey="day" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="total" stroke="#2563eb" strokeWidth={2} name="Total" />
              <Line type="monotone" dataKey="noShow" stroke="#ef4444" strokeWidth={2} name="No-Show" />
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white rounded-xl border p-4">
          <h2 className="font-semibold text-gray-700 mb-3">Treatment Plan Status</h2>
          {pieData.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, value }) => `${name}: ${value}`}>
                  {pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-gray-400 text-sm text-center py-10">No treatment data</p>
          )}
        </div>

        <div className="bg-white rounded-xl border p-4">
          <h2 className="font-semibold text-gray-700 mb-3">ROI Impact Projections</h2>
          <div className="space-y-3 mt-2">
            {[
              { label: 'No-show reduction target', current: `${stats.noShowRate}%`, target: '< 10%', color: 'red' },
              { label: 'Chair utilization target', current: `${stats.utilizationRate}%`, target: '> 85%', color: 'green' },
              { label: 'Acceptance rate target', current: `${stats.acceptanceRate}%`, target: '> 70%', color: 'purple' },
            ].map((item) => (
              <div key={item.label} className="flex items-center justify-between py-2 border-b last:border-0">
                <span className="text-sm text-gray-600">{item.label}</span>
                <div className="flex gap-3 text-sm">
                  <span className="font-medium">{item.current}</span>
                  <span className="text-gray-400">→</span>
                  <span className="text-green-600 font-medium">{item.target}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Provider Productivity */}
      {providers.length > 0 && (
        <div className="bg-white rounded-xl border p-4">
          <h2 className="font-semibold text-gray-700 mb-3">Provider Productivity (This Month)</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>{['Provider', 'Specialty', 'Appointments', 'Completed', 'No-Shows', 'Utilization'].map((h) => (
                  <th key={h} className="text-left px-4 py-2 text-gray-600 font-medium">{h}</th>
                ))}</tr>
              </thead>
              <tbody>
                {providers.map((p) => (
                  <tr key={p.id} className="border-b last:border-0 hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium">{p.name}</td>
                    <td className="px-4 py-3 text-gray-500">{p.specialty || '—'}</td>
                    <td className="px-4 py-3">{p.total}</td>
                    <td className="px-4 py-3 text-green-600">{p.completed}</td>
                    <td className="px-4 py-3 text-red-500">{p.noShows}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 bg-gray-200 rounded-full h-1.5">
                          <div className={`h-1.5 rounded-full ${p.utilizationRate > 70 ? 'bg-green-500' : p.utilizationRate > 40 ? 'bg-yellow-500' : 'bg-red-500'}`} style={{ width: `${p.utilizationRate}%` }} />
                        </div>
                        <span className="text-xs font-medium w-10">{p.utilizationRate}%</span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
