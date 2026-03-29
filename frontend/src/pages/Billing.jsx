import { useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import api from '../api/client';
import Modal from '../components/Modal';
import Badge from '../components/Badge';
import StatCard from '../components/StatCard';

const EMPTY = { patientId: '', treatmentId: '', amount: '', method: '', status: 'PENDING', dueDate: '', notes: '' };

export default function Billing() {
  const [payments, setPayments] = useState([]);
  const [patients, setPatients] = useState([]);
  const [treatments, setTreatments] = useState([]);
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [editing, setEditing] = useState(null);
  const [filter, setFilter] = useState('');

  const load = () => api.get(`/payments${filter ? `?status=${filter}` : ''}`).then((r) => setPayments(r.data));

  useEffect(() => {
    api.get('/patients').then((r) => setPatients(r.data));
    api.get('/treatments').then((r) => setTreatments(r.data));
  }, []);
  useEffect(() => { load(); }, [filter]);

  const openAdd = () => { setForm(EMPTY); setEditing(null); setModal(true); };
  const openEdit = (p) => {
    setForm({ ...p, amount: p.amount.toString(), dueDate: p.dueDate?.split('T')[0] || '', treatmentId: p.treatmentId || '' });
    setEditing(p.id);
    setModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const data = { ...form, amount: parseFloat(form.amount) };
    if (!data.dueDate) delete data.dueDate;
    if (!data.treatmentId) delete data.treatmentId;
    if (editing) await api.put(`/payments/${editing}`, data);
    else await api.post('/payments', data);
    setModal(false);
    load();
  };

  const markPaid = async (id) => {
    await api.put(`/payments/${id}`, { status: 'PAID', paidAt: new Date().toISOString() });
    load();
  };

  const totalPaid = payments.filter((p) => p.status === 'PAID').reduce((s, p) => s + p.amount, 0);
  const totalPending = payments.filter((p) => ['PENDING', 'PARTIAL'].includes(p.status)).reduce((s, p) => s + p.amount, 0);
  const totalOverdue = payments.filter((p) => p.status === 'OVERDUE').reduce((s, p) => s + p.amount, 0);

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Billing & Collections</h1>
        <button onClick={openAdd} className="flex items-center gap-1.5 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700"><Plus size={15} /> Add Payment</button>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <StatCard label="Collected" value={`$${totalPaid.toLocaleString()}`} color="green" />
        <StatCard label="Pending" value={`$${totalPending.toLocaleString()}`} color="yellow" />
        <StatCard label="Overdue" value={`$${totalOverdue.toLocaleString()}`} color="red" />
      </div>

      <div className="flex gap-2">
        {['', 'PENDING', 'PARTIAL', 'PAID', 'OVERDUE'].map((s) => (
          <button key={s} onClick={() => setFilter(s)} className={`px-3 py-1.5 rounded-lg text-sm ${filter === s ? 'bg-blue-600 text-white' : 'border hover:bg-gray-50'}`}>{s || 'All'}</button>
        ))}
      </div>

      <div className="bg-white rounded-xl border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>{['Patient', 'Amount', 'Status', 'Method', 'Due Date', 'Paid At', 'Actions'].map((h) => (
              <th key={h} className="text-left px-4 py-3 text-gray-600 font-medium">{h}</th>
            ))}</tr>
          </thead>
          <tbody>
            {payments.map((p) => (
              <tr key={p.id} className="border-b last:border-0 hover:bg-gray-50">
                <td className="px-4 py-3">{p.patient.firstName} {p.patient.lastName}</td>
                <td className="px-4 py-3 font-medium">${p.amount.toLocaleString()}</td>
                <td className="px-4 py-3"><Badge value={p.status} /></td>
                <td className="px-4 py-3">{p.method || '—'}</td>
                <td className="px-4 py-3">{p.dueDate ? new Date(p.dueDate).toLocaleDateString() : '—'}</td>
                <td className="px-4 py-3">{p.paidAt ? new Date(p.paidAt).toLocaleDateString() : '—'}</td>
                <td className="px-4 py-3 flex gap-2">
                  <button onClick={() => openEdit(p)} className="text-blue-500 hover:text-blue-700 text-xs">Edit</button>
                  {p.status !== 'PAID' && <button onClick={() => markPaid(p.id)} className="text-green-500 hover:text-green-700 text-xs">Mark Paid</button>}
                </td>
              </tr>
            ))}
            {payments.length === 0 && <tr><td colSpan={7} className="px-4 py-8 text-center text-gray-400">No payments</td></tr>}
          </tbody>
        </table>
      </div>

      {modal && (
        <Modal title={editing ? 'Edit Payment' : 'Add Payment'} onClose={() => setModal(false)}>
          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Patient *</label>
              <select value={form.patientId} onChange={(e) => setForm({ ...form, patientId: e.target.value })} required className="w-full border rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500">
                <option value="">Select patient</option>
                {patients.map((p) => <option key={p.id} value={p.id}>{p.firstName} {p.lastName}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Treatment (optional)</label>
              <select value={form.treatmentId} onChange={(e) => setForm({ ...form, treatmentId: e.target.value })} className="w-full border rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500">
                <option value="">None</option>
                {treatments.filter((t) => t.patientId === form.patientId).map((t) => <option key={t.id} value={t.id}>{t.title}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Amount ($) *</label>
                <input type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} required className="w-full border rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Method</label>
                <select value={form.method} onChange={(e) => setForm({ ...form, method: e.target.value })} className="w-full border rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500">
                  <option value="">Select</option>
                  {['Cash', 'Card', 'Insurance', 'Bank Transfer', 'Payment Plan'].map((m) => <option key={m}>{m}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Status</label>
                <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} className="w-full border rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500">
                  {['PENDING', 'PARTIAL', 'PAID', 'OVERDUE'].map((s) => <option key={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Due Date</label>
                <input type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} className="w-full border rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500" />
              </div>
            </div>
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
