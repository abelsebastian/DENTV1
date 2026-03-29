import { useEffect, useState } from 'react';
import api from '../api/client';
import { useAuth } from '../context/AuthContext';
import Badge from '../components/Badge';

export default function Admin() {
  const { user } = useAuth();
  const [users, setUsers] = useState([]);
  const [logs, setLogs] = useState([]);
  const [tab, setTab] = useState('users');

  useEffect(() => {
    if (user?.role !== 'ADMIN') return;
    api.get('/admin/users').then((r) => setUsers(r.data));
    api.get('/admin/audit-logs').then((r) => setLogs(r.data));
  }, [user]);

  const updateRole = async (id, role) => {
    await api.put(`/admin/users/${id}`, { role });
    api.get('/admin/users').then((r) => setUsers(r.data));
  };

  if (user?.role !== 'ADMIN') {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
          <p className="text-red-600 font-medium">Access Denied</p>
          <p className="text-red-400 text-sm mt-1">Admin role required</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-bold">Admin</h1>

      <div className="flex gap-2 border-b">
        {['users', 'audit-logs'].map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`px-4 py-2 text-sm capitalize border-b-2 transition-colors ${tab === t ? 'border-blue-600 text-blue-600 font-medium' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            {t.replace('-', ' ')}
          </button>
        ))}
      </div>

      {tab === 'users' && (
        <div className="bg-white rounded-xl border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>{['Name', 'Email', 'Role', 'Created', 'Change Role'].map((h) => (
                <th key={h} className="text-left px-4 py-3 text-gray-600 font-medium">{h}</th>
              ))}</tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-b last:border-0 hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">{u.name}</td>
                  <td className="px-4 py-3 text-gray-600">{u.email}</td>
                  <td className="px-4 py-3"><Badge value={u.role} /></td>
                  <td className="px-4 py-3 text-gray-500">{new Date(u.createdAt).toLocaleDateString()}</td>
                  <td className="px-4 py-3">
                    <select
                      value={u.role}
                      onChange={(e) => updateRole(u.id, e.target.value)}
                      disabled={u.id === user.id}
                      className="border rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50"
                    >
                      {['ADMIN', 'DENTIST', 'STAFF'].map((r) => <option key={r}>{r}</option>)}
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'audit-logs' && (
        <div className="bg-white rounded-xl border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>{['User', 'Action', 'Entity', 'Details', 'Time'].map((h) => (
                <th key={h} className="text-left px-4 py-3 text-gray-600 font-medium">{h}</th>
              ))}</tr>
            </thead>
            <tbody>
              {logs.map((l) => (
                <tr key={l.id} className="border-b last:border-0 hover:bg-gray-50">
                  <td className="px-4 py-3">{l.user?.name || '—'}</td>
                  <td className="px-4 py-3 font-medium">{l.action}</td>
                  <td className="px-4 py-3">{l.entity}</td>
                  <td className="px-4 py-3 text-gray-500 max-w-xs truncate">{l.details || '—'}</td>
                  <td className="px-4 py-3 text-gray-500">{new Date(l.createdAt).toLocaleString()}</td>
                </tr>
              ))}
              {logs.length === 0 && <tr><td colSpan={5} className="px-4 py-8 text-center text-gray-400">No audit logs</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
