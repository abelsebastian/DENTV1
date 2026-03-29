import { useEffect, useState } from 'react';
import { Plus, MessageCircle, Send } from 'lucide-react';
import api from '../api/client';
import Modal from '../components/Modal';
import Badge from '../components/Badge';

const EMPTY = { patientId: '', channel: 'Phone', direction: 'INBOUND', message: '' };

export default function Communications() {
  const [comms, setComms] = useState([]);
  const [patients, setPatients] = useState([]);
  const [modal, setModal] = useState(false);
  const [reminderModal, setReminderModal] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [filter, setFilter] = useState('');
  const [reminderPatientId, setReminderPatientId] = useState('');
  const [reminderMsg, setReminderMsg] = useState('');
  const [sending, setSending] = useState(false);

  const load = () => api.get(`/communications${filter ? `?patientId=${filter}` : ''}`).then((r) => setComms(r.data));

  useEffect(() => { api.get('/patients').then((r) => setPatients(r.data)); }, []);
  useEffect(() => { load(); }, [filter]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    await api.post('/communications', form);
    setModal(false);
    setForm(EMPTY);
    load();
  };

  const handleSendWhatsApp = async (e) => {
    e.preventDefault();
    setSending(true);
    try {
      // Find the patient's next appointment and send reminder
      const appts = await api.get(`/appointments?status=SCHEDULED`);
      const appt = appts.data.find((a) => a.patientId === reminderPatientId);
      if (appt) {
        await api.post(`/sms/send-reminder/${appt.id}`);
        alert('WhatsApp reminder sent!');
      } else {
        // No appointment — send custom message directly via a custom endpoint
        const patient = patients.find((p) => p.id === reminderPatientId);
        if (!patient?.phone) { alert('Patient has no phone number'); return; }
        await api.post('/sms/send-custom', { phone: patient.phone, message: reminderMsg });
        alert('WhatsApp message sent!');
      }
      setReminderModal(false);
      setReminderPatientId('');
      setReminderMsg('');
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to send message');
    } finally {
      setSending(false);
    }
  };

  const sentimentCounts = comms.reduce((acc, c) => {
    if (c.sentiment) acc[c.sentiment] = (acc[c.sentiment] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Communications</h1>
        <div className="flex gap-2">
          <button onClick={() => setReminderModal(true)} className="flex items-center gap-1.5 bg-green-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-green-700"><Send size={15} /> WhatsApp Reminder</button>
          <button onClick={() => setModal(true)} className="flex items-center gap-1.5 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700"><Plus size={15} /> Log Interaction</button>
        </div>
      </div>

      {/* Sentiment summary */}
      <div className="flex gap-3">
        {Object.entries(sentimentCounts).map(([s, count]) => (
          <div key={s} className="flex items-center gap-2 bg-white border rounded-lg px-3 py-2">
            <Badge value={s} />
            <span className="text-sm font-medium">{count}</span>
          </div>
        ))}
      </div>

      <div className="flex items-center gap-3">
        <label className="text-sm font-medium text-gray-600">Filter by patient:</label>
        <select value={filter} onChange={(e) => setFilter(e.target.value)} className="border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="">All patients</option>
          {patients.map((p) => <option key={p.id} value={p.id}>{p.firstName} {p.lastName}</option>)}
        </select>
      </div>

      <div className="bg-white rounded-xl border divide-y">
        {comms.map((c) => (
          <div key={c.id} className="p-4">
            <div className="flex items-start justify-between">
              <div>
                <p className="font-medium text-sm">{c.patient.firstName} {c.patient.lastName}</p>
                <p className="text-xs text-gray-500 mt-0.5">{c.channel} · {c.direction} · {new Date(c.createdAt).toLocaleString()}</p>
              </div>
              <div className="flex gap-2 items-center">
                {c.sentiment && <Badge value={c.sentiment} />}
                {c.intent && <span className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full">{c.intent}</span>}
              </div>
            </div>
            <p className="text-sm text-gray-700 mt-2">{c.message}</p>
          </div>
        ))}
        {comms.length === 0 && <p className="px-4 py-8 text-center text-gray-400">No communications logged</p>}
      </div>

      {modal && (
        <Modal title="Log Interaction" onClose={() => setModal(false)}>
          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Patient *</label>
              <select value={form.patientId} onChange={(e) => setForm({ ...form, patientId: e.target.value })} required className="w-full border rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500">
                <option value="">Select patient</option>
                {patients.map((p) => <option key={p.id} value={p.id}>{p.firstName} {p.lastName}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Channel</label>
                <select value={form.channel} onChange={(e) => setForm({ ...form, channel: e.target.value })} className="w-full border rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500">
                  {['Phone', 'Email', 'SMS', 'In-Person', 'WhatsApp'].map((c) => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Direction</label>
                <select value={form.direction} onChange={(e) => setForm({ ...form, direction: e.target.value })} className="w-full border rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500">
                  <option value="INBOUND">Inbound</option>
                  <option value="OUTBOUND">Outbound</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Message *</label>
              <textarea value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} required rows={4} className="w-full border rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500" placeholder="Enter the message or summary of the interaction..." />
            </div>
            <p className="text-xs text-gray-400">Sentiment and intent will be auto-detected.</p>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setModal(false)} className="px-4 py-2 text-sm border rounded-lg hover:bg-gray-50">Cancel</button>
              <button type="submit" className="px-4 py-2 text-sm bg-blue-600 text-white rounded-lg hover:bg-blue-700">Log</button>
            </div>
          </form>
        </Modal>
      )}
      {reminderModal && (
        <Modal title="Send WhatsApp Reminder" onClose={() => setReminderModal(false)}>
          <form onSubmit={handleSendWhatsApp} className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Patient *</label>
              <select value={reminderPatientId} onChange={(e) => setReminderPatientId(e.target.value)} required className="w-full border rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500">
                <option value="">Select patient</option>
                {patients.map((p) => <option key={p.id} value={p.id}>{p.firstName} {p.lastName} — {p.phone}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Custom message (optional)</label>
              <textarea value={reminderMsg} onChange={(e) => setReminderMsg(e.target.value)} rows={3} placeholder="Leave blank to auto-generate from next appointment..." className="w-full border rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500" />
            </div>
            <p className="text-xs text-gray-400">Message will be sent via WhatsApp using Twilio sandbox.</p>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setReminderModal(false)} className="px-4 py-2 text-sm border rounded-lg hover:bg-gray-50">Cancel</button>
              <button type="submit" disabled={sending} className="px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50">
                {sending ? 'Sending...' : '📲 Send WhatsApp'}
              </button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}
