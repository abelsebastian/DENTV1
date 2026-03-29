import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, Plus, Pencil, Trash2 } from 'lucide-react';
import api from '../api/client';
import Modal from '../components/Modal';

const EMPTY = { firstName: '', lastName: '', phone: '', email: '', dateOfBirth: '', gender: '', address: '', medicalHistory: '', dentalHistory: '' };

export default function Patients() {
  const [patients, setPatients] = useState([]);
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [editing, setEditing] = useState(null);

  const load = (q = '') => api.get(`/patients${q ? `?search=${q}` : ''}`).then((r) => setPatients(r.data));

  useEffect(() => { load(); }, []);

  const handleSearch = (e) => {
    setSearch(e.target.value);
    load(e.target.value);
  };

  const openAdd = () => { setForm(EMPTY); setEditing(null); setModal(true); };
  const openEdit = (p) => { setForm({ ...p, dateOfBirth: p.dateOfBirth?.split('T')[0] || '' }); setEditing(p.id); setModal(true); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    // Strip empty strings so Prisma doesn't reject optional fields
    const data = Object.fromEntries(
      Object.entries(form).filter(([, v]) => v !== '' && v !== null)
    );
    try {
      if (editing) await api.put(`/patients/${editing}`, data);
      else await api.post('/patients', data);
      setModal(false);
      load(search);
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to save patient');
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this patient?')) return;
    await api.delete(`/patients/${id}`);
    load(search);
  };

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Patients</h1>
        <button onClick={openAdd} className="flex items-center gap-1.5 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700"><Plus size={15} /> Add Patient</button>
      </div>

      <div className="relative">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          value={search}
          onChange={handleSearch}
          placeholder="Search by name or phone..."
          className="w-full border rounded-lg pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      <div className="bg-white rounded-xl border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              {['Name', 'Phone', 'Email', 'No-Shows', 'Appointments', 'Actions'].map((h) => (
                <th key={h} className="text-left px-4 py-3 text-gray-600 font-medium">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {patients.map((p) => (
              <tr key={p.id} className="border-b last:border-0 hover:bg-gray-50">
                <td className="px-4 py-3">
                  <Link to={`/patients/${p.id}`} className="font-medium text-blue-600 hover:underline">
                    {p.firstName} {p.lastName}
                  </Link>
                </td>
                <td className="px-4 py-3 text-gray-600">{p.phone}</td>
                <td className="px-4 py-3 text-gray-600">{p.email || '—'}</td>
                <td className="px-4 py-3">
                  <span className={p.noShowCount > 2 ? 'text-red-600 font-medium' : 'text-gray-600'}>{p.noShowCount}</span>
                </td>
                <td className="px-4 py-3 text-gray-600">{p.totalAppointments}</td>
                <td className="px-4 py-3 flex gap-2">
                  <button onClick={() => openEdit(p)} className="flex items-center gap-1 text-blue-500 hover:text-blue-700 text-xs"><Pencil size={12} /> Edit</button>
                  <button onClick={() => handleDelete(p.id)} className="flex items-center gap-1 text-red-500 hover:text-red-700 text-xs"><Trash2 size={12} /> Delete</button>
                </td>
              </tr>
            ))}
            {patients.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-gray-400">No patients found</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {modal && (
        <Modal title={editing ? 'Edit Patient' : 'Add Patient'} onClose={() => setModal(false)}>
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              {[['firstName', 'First Name'], ['lastName', 'Last Name'], ['phone', 'Phone'], ['email', 'Email'], ['dateOfBirth', 'Date of Birth'], ['gender', 'Gender']].map(([k, l]) => (
                <div key={k}>
                  <label className="block text-xs font-medium text-gray-600 mb-1">{l}</label>
                  <input
                    type={k === 'dateOfBirth' ? 'date' : 'text'}
                    value={form[k]}
                    onChange={(e) => setForm({ ...form, [k]: e.target.value })}
                    className="w-full border rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                    required={['firstName', 'lastName', 'phone'].includes(k)}
                  />
                </div>
              ))}
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Medical History</label>
              <textarea value={form.medicalHistory} onChange={(e) => setForm({ ...form, medicalHistory: e.target.value })} rows={2} className="w-full border rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Dental History</label>
              <textarea value={form.dentalHistory} onChange={(e) => setForm({ ...form, dentalHistory: e.target.value })} rows={2} className="w-full border rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500" />
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
