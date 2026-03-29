import { useEffect, useState } from 'react';
import { Plus, Pencil, ToggleLeft, ToggleRight } from 'lucide-react';
import api from '../api/client';
import Modal from '../components/Modal';

const EMPTY = { name: '', specialty: '', email: '', phone: '' };

export default function Providers() {
  const [providers, setProviders] = useState([]);
  const [productivity, setProductivity] = useState([]);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [editing, setEditing] = useState(null);
  const [error, setError] = useState('');

  const load = () => Promise.all([
    api.get('/providers').then((r) => setProviders(r.data)),
    api.get('/analytics/providers').then((r) => setProductivity(r.data)),
  ]);

  useEffect(() => { load(); }, []);

  const openAdd = () => { setForm(EMPTY); setEditing(null); setError(''); setModal(true); };
  const openEdit = (p) => { setForm(p); setEditing(p.id); setError(''); setModal(true); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      if (editing) await api.put(`/providers/${editing}`, form);
      else await api.post('/providers', form);
      setModal(false);
      load();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save provider');
    }
  };

  const toggleActive = async (p) => {
    await api.put(`/providers/${p.id}`, { isActive: !p.isActive });
    load();
  };

  const getStats = (id) => productivity.find((p) => p.id === id);

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Providers</h1>
        <button onClick={openAdd} className="flex items-center gap-1.5 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700"><Plus size={15} /> Add Provider</button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {providers.map((p) => {
          const stats = getStats(p.id);
          return (
            <div key={p.id} className={`bg-white rounded-xl border p-4 ${!p.isActive ? 'opacity-60' : ''}`}>
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-semibold text-gray-900">{p.name}</h3>
                  <p className="text-sm text-blue-600">{p.specialty || 'General'}</p>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full ${p.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                  {p.isActive ? 'Active' : 'Inactive'}
                </span>
              </div>
              <div className="text-xs text-gray-500 space-y-1 mb-3">
                {p.email && <p>✉️ {p.email}</p>}
                {p.phone && <p>📞 {p.phone}</p>}
              </div>
              {stats && (
                <div className="grid grid-cols-3 gap-2 mb-3 pt-3 border-t">
                  <div className="text-center">
                    <p className="text-lg font-bold text-gray-900">{stats.total}</p>
                    <p className="text-xs text-gray-500">Appts</p>
                  </div>
                  <div className="text-center">
                    <p className="text-lg font-bold text-green-600">{stats.completed}</p>
                    <p className="text-xs text-gray-500">Done</p>
                  </div>
                  <div className="text-center">
                    <p className={`text-lg font-bold ${stats.utilizationRate > 70 ? 'text-green-600' : stats.utilizationRate > 40 ? 'text-yellow-600' : 'text-red-600'}`}>
                      {stats.utilizationRate}%
                    </p>
                    <p className="text-xs text-gray-500">Util.</p>
                  </div>
                </div>
              )}
              <div className="flex gap-2">
                <button onClick={() => openEdit(p)} className="flex-1 flex items-center justify-center gap-1 text-xs border rounded py-1.5 hover:bg-gray-50"><Pencil size={12} /> Edit</button>
                <button onClick={() => toggleActive(p)} className={`flex-1 flex items-center justify-center gap-1 text-xs border rounded py-1.5 ${p.isActive ? 'hover:bg-red-50 text-red-500' : 'hover:bg-green-50 text-green-600'}`}>
                  {p.isActive ? <><ToggleLeft size={12} /> Deactivate</> : <><ToggleRight size={12} /> Activate</>}
                </button>
              </div>
            </div>
          );
        })}
        {providers.length === 0 && <p className="text-gray-400 text-sm col-span-3">No providers found</p>}
      </div>

      {modal && (
        <Modal title={editing ? 'Edit Provider' : 'Add Provider'} onClose={() => setModal(false)}>
          <form onSubmit={handleSubmit} className="space-y-3">
            {[['name', 'Name *', true], ['specialty', 'Specialty', false], ['email', 'Email', false], ['phone', 'Phone', false]].map(([k, l, req]) => (
              <div key={k}>
                <label className="block text-xs font-medium text-gray-600 mb-1">{l}</label>
                <input
                  value={form[k] || ''}
                  onChange={(e) => setForm({ ...form, [k]: e.target.value })}
                  required={req}
                  className="w-full border rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
            ))}
            {error && <p className="text-red-500 text-sm bg-red-50 border border-red-200 rounded px-3 py-2">{error}</p>}
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setModal(false)} className="px-4 py-2 text-sm border rounded-lg hover:bg-gray-50">Cancel</button>
              <button type="submit" className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700">Save</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
