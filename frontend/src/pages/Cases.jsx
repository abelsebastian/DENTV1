import { useEffect, useState } from 'react';
import { Plus, CheckCircle2, XCircle } from 'lucide-react';
import api from '../api/client';
import Modal from '../components/Modal';
import Badge from '../components/Badge';

const STATUSES = ['PENDING', 'ACCEPTED', 'DECLINED', 'IN_PROGRESS', 'COMPLETED'];
const EMPTY = { patientId: '', title: '', description: '', estimatedCost: '', followUpDate: '', consentSigned: false };

export default function Cases() {
  const [treatments, setTreatments] = useState([]);
  const [patients, setPatients] = useState([]);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [editing, setEditing] = useState(null);
  const [filter, setFilter] = useState('');
  const [formError, setFormError] = useState('');

  const load = () => api.get(`/treatments${filter ? `?status=${filter}` : ''}`).then((r) => setTreatments(r.data));

  useEffect(() => { api.get('/patients').then((r) => setPatients(r.data)); }, []);
  useEffect(() => { load(); }, [filter]);

  const openAdd = () => { setForm(EMPTY); setEditing(null); setFormError(''); setModal(true); };
  const openEdit = (t) => {
    setForm({ ...t, estimatedCost: t.estimatedCost.toString(), followUpDate: t.followUpDate?.split('T')[0] || '' });
    setEditing(t.id);
    setFormError('');
    setModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    try {
      const data = { ...form, estimatedCost: parseFloat(form.estimatedCost) };
      if (!data.followUpDate) delete data.followUpDate;
      if (editing) await api.put(`/treatments/${editing}`, data);
      else await api.post('/treatments', data);
      setModal(false);
      load();
    } catch (err) {
      setFormError(err.response?.data?.error || 'Failed to save treatment plan');
    }
  };

  const updateStatus = async (id, status) => {
    await api.put(`/treatments/${id}`, { status });
    load();
  };

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Case Management</h1>
        <button onClick={openAdd} className="flex items-center gap-1.5 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700"><Plus size={15} /> New Treatment Plan</button>
      </div>

      <div className="flex gap-2">
        <button onClick={() => setFilter('')} className={`px-3 py-1.5 rounded-lg text-sm ${!filter ? 'bg-blue-600 text-white' : 'border hover:bg-gray-50'}`}>All</button>
        {STATUSES.map((s) => (
          <button key={s} onClick={() => setFilter(s)} className={`px-3 py-1.5 rounded-lg text-sm ${filter === s ? 'bg-blue-600 text-white' : 'border hover:bg-gray-50'}`}>{s}</button>
        ))}
      </div>

      <div className="bg-white rounded-xl border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>{['Patient', 'Treatment', 'Cost', 'Acceptance', 'Status', 'Consent', 'Follow-up', 'Actions'].map((h) => (
              <th key={h} className="text-left px-4 py-3 text-gray-600 font-medium">{h}</th>
            ))}</tr>
          </thead>
          <tbody>
            {treatments.map((t) => (
              <tr key={t.id} className="border-b last:border-0 hover:bg-gray-50">
                <td className="px-4 py-3">{t.patient.firstName} {t.patient.lastName}</td>
                <td className="px-4 py-3 font-medium">{t.title}</td>
                <td className="px-4 py-3">${t.estimatedCost.toLocaleString()}</td>
                <td className="px-4 py-3">
                  <span className={`font-medium ${t.acceptanceProbability > 0.6 ? 'text-green-600' : t.acceptanceProbability > 0.4 ? 'text-yellow-600' : 'text-red-600'}`}>
                    {Math.round(t.acceptanceProbability * 100)}%
                  </span>
                </td>
                <td className="px-4 py-3"><Badge value={t.status} /></td>
                <td className="px-4 py-3">
                  {t.consentSigned
                    ? <CheckCircle2 size={16} className="text-green-500" />
                    : <XCircle size={16} className="text-red-400" />}
                </td>
                <td className="px-4 py-3">{t.followUpDate ? new Date(t.followUpDate).toLocaleDateString() : '—'}</td>
                <td className="px-4 py-3">
                  <div className="flex gap-1 flex-wrap">
                    <button onClick={() => openEdit(t)} className="text-blue-500 hover:text-blue-700 text-xs">Edit</button>
                    {t.status === 'PENDING' && <button onClick={() => updateStatus(t.id, 'ACCEPTED')} className="text-green-500 hover:text-green-700 text-xs">Accept</button>}
                    {t.status === 'PENDING' && <button onClick={() => updateStatus(t.id, 'DECLINED')} className="text-red-500 hover:text-red-700 text-xs">Decline</button>}
                    {t.status === 'ACCEPTED' && <button onClick={() => updateStatus(t.id, 'IN_PROGRESS')} className="text-blue-500 hover:text-blue-700 text-xs">Start</button>}
                    {t.status === 'IN_PROGRESS' && <button onClick={() => updateStatus(t.id, 'COMPLETED')} className="text-gray-500 hover:text-gray-700 text-xs">Complete</button>}
                    {!t.consentSigned && <button onClick={() => api.put(`/treatments/${t.id}`, { consentSigned: true }).then(load)} className="text-purple-500 hover:text-purple-700 text-xs">Sign Consent</button>}
                  </div>
                </td>
              </tr>
            ))}
            {treatments.length === 0 && <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-400">No treatment plans</td></tr>}
          </tbody>
        </table>
      </div>

      {modal && (
        <Modal title={editing ? 'Edit Treatment Plan' : 'New Treatment Plan'} onClose={() => setModal(false)}>
          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Patient *</label>
              <select value={form.patientId} onChange={(e) => setForm({ ...form, patientId: e.target.value })} required className="w-full border rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500">
                <option value="">Select patient</option>
                {patients.map((p) => <option key={p.id} value={p.id}>{p.firstName} {p.lastName}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Treatment Title *</label>
              <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required className="w-full border rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Description</label>
              <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} className="w-full border rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Estimated Cost ($) *</label>
                <input type="number" value={form.estimatedCost} onChange={(e) => setForm({ ...form, estimatedCost: e.target.value })} required className="w-full border rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Follow-up Date</label>
                <input type="date" value={form.followUpDate} onChange={(e) => setForm({ ...form, followUpDate: e.target.value })} className="w-full border rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500" />
              </div>
            </div>
            {formError && <p className="text-red-500 text-sm bg-red-50 border border-red-200 rounded px-3 py-2">{formError}</p>}
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
