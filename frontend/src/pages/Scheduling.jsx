import { useEffect, useState, useCallback } from 'react';
import { CalendarDays, List, ChevronLeft, ChevronRight, Plus, AlertCircle, AlertTriangle } from 'lucide-react';
import api from '../api/client';
import Modal from '../components/Modal';
import Badge from '../components/Badge';
import CalendarGrid from '../components/CalendarGrid';
import { useWebSocket } from '../hooks/useWebSocket';

const EMPTY = { patientId: '', providerId: '', procedure: '', scheduledAt: '', duration: 60, chair: '', notes: '', isEmergency: false };

function getWeekStart(date) {
  const d = new Date(date);
  const day = d.getDay(); // 0=Sun
  d.setDate(d.getDate() - day);
  d.setHours(0, 0, 0, 0);
  return d;
}

export default function Scheduling() {
  const [appointments, setAppointments] = useState([]);
  const [patients, setPatients] = useState([]);
  const [providers, setProviders] = useState([]);
  const [weekStart, setWeekStart] = useState(getWeekStart(new Date()));
  const [view, setView] = useState('calendar'); // 'calendar' | 'list'
  const [modal, setModal] = useState(false);
  const [detailModal, setDetailModal] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [editing, setEditing] = useState(null);
  const [slots, setSlots] = useState(null);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [error, setError] = useState('');
  const [listDate, setListDate] = useState(new Date().toISOString().split('T')[0]);

  // Load full week for calendar, single day for list
  const load = useCallback(() => {
    if (view === 'calendar') {
      const end = new Date(weekStart);
      end.setDate(end.getDate() + 7);
      // Fetch each day of the week
      const promises = Array.from({ length: 7 }, (_, i) => {
        const d = new Date(weekStart);
        d.setDate(d.getDate() + i);
        return api.get(`/appointments?date=${d.toISOString().split('T')[0]}`);
      });
      Promise.all(promises).then((results) => {
        setAppointments(results.flatMap((r) => r.data));
      });
    } else {
      api.get(`/appointments?date=${listDate}`).then((r) => setAppointments(r.data));
    }
  }, [view, weekStart, listDate]);

  useEffect(() => {
    api.get('/patients').then((r) => setPatients(r.data));
    api.get('/providers').then((r) => setProviders(r.data));
  }, []);

  useEffect(() => { load(); }, [load]);

  useWebSocket(useCallback((msg) => {
    if (['APPOINTMENT_CREATED', 'APPOINTMENT_CANCELLED'].includes(msg.type)) load();
  }, [load]));

  // AI slot suggestions
  useEffect(() => {
    if (!form.providerId || !form.patientId || editing) { setSlots(null); return; }
    const apptDate = form.scheduledAt ? form.scheduledAt.split('T')[0] : new Date().toISOString().split('T')[0];
    setSlotsLoading(true);
    api.get(`/appointments/slots?providerId=${form.providerId}&patientId=${form.patientId}&date=${apptDate}`)
      .then((r) => setSlots(r.data))
      .catch(() => setSlots(null))
      .finally(() => setSlotsLoading(false));
  }, [form.providerId, form.patientId, editing]);

  const openAdd = (prefillTime) => {
    setForm({ ...EMPTY, scheduledAt: prefillTime || '' });
    setEditing(null); setSlots(null); setError(''); setModal(true);
  };

  const openEdit = (a) => {
    setForm({ ...a, scheduledAt: new Date(a.scheduledAt).toISOString().slice(0, 16) });
    setEditing(a.id); setSlots(null); setError(''); setDetailModal(null); setModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault(); setError('');
    try {
      if (editing) await api.put(`/appointments/${editing}`, form);
      else await api.post('/appointments', form);
      setModal(false); load();
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to save appointment');
    }
  };

  const updateStatus = async (id, status) => {
    await api.put(`/appointments/${id}`, { status });
    setDetailModal(null); load();
  };

  const [reminderSending, setReminderSending] = useState({});

  const sendReminder = async (apptId) => {
    setReminderSending((s) => ({ ...s, [apptId]: true }));
    try {
      await api.post(`/sms/send-reminder/${apptId}`);
      alert('WhatsApp reminder sent!');
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to send reminder');
    } finally {
      setReminderSending((s) => ({ ...s, [apptId]: false }));
    }
  };

  const applySlot = (isoSlot) => setForm((f) => ({ ...f, scheduledAt: isoSlot.slice(0, 16) }));
  const handleDropReschedule = async (apptId, newScheduledAt) => {
    try {
      await api.put(`/appointments/${apptId}`, { scheduledAt: newScheduledAt });
      load();
    } catch (err) {
      alert(err.response?.data?.error || 'Could not reschedule');
    }
  };

  const prevWeek = () => { const d = new Date(weekStart); d.setDate(d.getDate() - 7); setWeekStart(d); };
  const nextWeek = () => { const d = new Date(weekStart); d.setDate(d.getDate() + 7); setWeekStart(d); };
  const goToday = () => setWeekStart(getWeekStart(new Date()));

  const weekEnd = new Date(weekStart); weekEnd.setDate(weekEnd.getDate() + 6);
  const weekLabel = `${weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${weekEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;

  return (
    <div className="p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Scheduling</h1>
        <div className="flex items-center gap-2">
          <div className="flex border rounded-lg overflow-hidden text-sm">
            <button onClick={() => setView('calendar')} className={`flex items-center gap-1.5 px-3 py-1.5 ${view === 'calendar' ? 'bg-blue-600 text-white' : 'hover:bg-gray-50'}`}>
              <CalendarDays size={14} /> Calendar
            </button>
            <button onClick={() => setView('list')} className={`flex items-center gap-1.5 px-3 py-1.5 border-l ${view === 'list' ? 'bg-blue-600 text-white' : 'hover:bg-gray-50'}`}>
              <List size={14} /> List
            </button>
          </div>
          <button onClick={() => openAdd()} className="flex items-center gap-1.5 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700">
            <Plus size={15} /> Book
          </button>
        </div>
      </div>

      {/* Calendar view */}
      {view === 'calendar' && (
        <>
          <div className="flex items-center gap-3">
            <button onClick={prevWeek} className="flex items-center gap-1 border rounded-lg px-3 py-1.5 text-sm hover:bg-gray-50"><ChevronLeft size={14} /> Prev</button>
            <button onClick={goToday} className="border rounded-lg px-3 py-1.5 text-sm hover:bg-gray-50">Today</button>
            <button onClick={nextWeek} className="flex items-center gap-1 border rounded-lg px-3 py-1.5 text-sm hover:bg-gray-50">Next <ChevronRight size={14} /></button>
            <span className="text-sm font-medium text-gray-700">{weekLabel}</span>
            <span className="text-xs text-gray-400 ml-2">Drag appointments to reschedule</span>
          </div>
          <div style={{ height: 'calc(100vh - 220px)', overflowY: 'auto' }}>
            <CalendarGrid
              weekStart={weekStart}
              appointments={appointments}
              onAppointmentClick={setDetailModal}
              onDropReschedule={handleDropReschedule}
            />
          </div>
        </>
      )}

      {/* List view */}
      {view === 'list' && (
        <>
          <div className="flex items-center gap-3">
            <label className="text-sm font-medium text-gray-600">Date:</label>
            <input type="date" value={listDate} onChange={(e) => setListDate(e.target.value)} className="border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            <span className="text-sm text-gray-500">{appointments.length} appointments</span>
          </div>
          <div className="bg-white rounded-xl border overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>{['Time', 'Patient', 'Procedure', 'Provider', 'Chair', 'No-Show Risk', 'Status', 'Actions'].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-gray-600 font-medium">{h}</th>
                ))}</tr>
              </thead>
              <tbody>
                {appointments.map((a) => (
                  <tr key={a.id} className={`border-b last:border-0 hover:bg-gray-50 ${a.isEmergency ? 'bg-red-50' : ''}`}>
                    <td className="px-4 py-3 font-medium">{new Date(a.scheduledAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                    <td className="px-4 py-3">{a.patient.firstName} {a.patient.lastName}</td>
                    <td className="px-4 py-3">{a.procedure}{a.isEmergency && <span className="ml-1 inline-flex"><AlertCircle size={13} className="text-red-500" /></span>}</td>
                    <td className="px-4 py-3">{a.provider.name}</td>
                    <td className="px-4 py-3">{a.chair || '—'}</td>
                    <td className="px-4 py-3">
                      <span className={`font-medium ${a.noShowProbability > 0.5 ? 'text-red-600' : a.noShowProbability > 0.3 ? 'text-yellow-600' : 'text-green-600'}`}>
                        {Math.round(a.noShowProbability * 100)}%
                      </span>
                    </td>
                    <td className="px-4 py-3"><Badge value={a.status} /></td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1 flex-wrap">
                        <button onClick={() => openEdit(a)} className="text-blue-500 hover:text-blue-700 text-xs">Edit</button>
                        {a.status === 'SCHEDULED' && <button onClick={() => updateStatus(a.id, 'CONFIRMED')} className="text-green-500 hover:text-green-700 text-xs">Confirm</button>}
                        {['SCHEDULED', 'CONFIRMED'].includes(a.status) && <button onClick={() => updateStatus(a.id, 'COMPLETED')} className="text-gray-500 hover:text-gray-700 text-xs">Complete</button>}
                        {['SCHEDULED', 'CONFIRMED'].includes(a.status) && <button onClick={() => updateStatus(a.id, 'NO_SHOW')} className="text-orange-500 hover:text-orange-700 text-xs">No-Show</button>}
                        {['SCHEDULED', 'CONFIRMED'].includes(a.status) && <button onClick={() => updateStatus(a.id, 'CANCELLED')} className="text-red-500 hover:text-red-700 text-xs">Cancel</button>}
                        {['SCHEDULED', 'CONFIRMED'].includes(a.status) && (
                          <button onClick={() => sendReminder(a.id)} disabled={reminderSending[a.id]} className="text-green-600 hover:text-green-800 text-xs disabled:opacity-50">
                            {reminderSending[a.id] ? 'Sending...' : '📲 Remind'}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
                {appointments.length === 0 && <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-400">No appointments for this date</td></tr>}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Appointment detail modal (click on calendar block) */}
      {detailModal && (
        <Modal title="Appointment Details" onClose={() => setDetailModal(null)}>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><p className="text-xs text-gray-500">Patient</p><p className="font-medium">{detailModal.patient.firstName} {detailModal.patient.lastName}</p></div>
              <div><p className="text-xs text-gray-500">Provider</p><p className="font-medium">{detailModal.provider.name}</p></div>
              <div><p className="text-xs text-gray-500">Procedure</p><p className="font-medium">{detailModal.procedure}</p></div>
              <div><p className="text-xs text-gray-500">Chair</p><p className="font-medium">{detailModal.chair || '—'}</p></div>
              <div><p className="text-xs text-gray-500">Time</p><p className="font-medium">{new Date(detailModal.scheduledAt).toLocaleString()}</p></div>
              <div><p className="text-xs text-gray-500">Duration</p><p className="font-medium">{detailModal.duration} min</p></div>
              <div><p className="text-xs text-gray-500">Status</p><Badge value={detailModal.status} /></div>
              <div>
                <p className="text-xs text-gray-500">No-Show Risk</p>
                <p className={`font-medium ${detailModal.noShowProbability > 0.5 ? 'text-red-600' : detailModal.noShowProbability > 0.3 ? 'text-yellow-600' : 'text-green-600'}`}>
                  {Math.round(detailModal.noShowProbability * 100)}%
                </p>
              </div>
            </div>
            {detailModal.notes && <div><p className="text-xs text-gray-500">Notes</p><p className="text-sm">{detailModal.notes}</p></div>}
            <div className="flex flex-wrap gap-2 pt-2 border-t">
              <button onClick={() => openEdit(detailModal)} className="px-3 py-1.5 text-sm border rounded-lg hover:bg-gray-50">Edit</button>
              {detailModal.status === 'SCHEDULED' && <button onClick={() => updateStatus(detailModal.id, 'CONFIRMED')} className="px-3 py-1.5 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700">Confirm</button>}
              {['SCHEDULED', 'CONFIRMED'].includes(detailModal.status) && <button onClick={() => updateStatus(detailModal.id, 'COMPLETED')} className="px-3 py-1.5 text-sm bg-gray-600 text-white rounded-lg hover:bg-gray-700">Complete</button>}
              {['SCHEDULED', 'CONFIRMED'].includes(detailModal.status) && <button onClick={() => updateStatus(detailModal.id, 'NO_SHOW')} className="px-3 py-1.5 text-sm bg-orange-500 text-white rounded-lg hover:bg-orange-600">No-Show</button>}
              {['SCHEDULED', 'CONFIRMED'].includes(detailModal.status) && <button onClick={() => updateStatus(detailModal.id, 'CANCELLED')} className="px-3 py-1.5 text-sm bg-red-500 text-white rounded-lg hover:bg-red-600">Cancel</button>}
              {['SCHEDULED', 'CONFIRMED'].includes(detailModal.status) && (
                <button onClick={() => { sendReminder(detailModal.id); setDetailModal(null); }} className="px-3 py-1.5 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700">
                  📲 Send Reminder
                </button>
              )}
            </div>
          </div>
        </Modal>
      )}

      {/* Book / Edit modal */}
      {modal && (
        <Modal title={editing ? 'Edit Appointment' : 'Book Appointment'} onClose={() => setModal(false)}>
          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Patient *</label>
              <select value={form.patientId} onChange={(e) => setForm({ ...form, patientId: e.target.value })} required className="w-full border rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500">
                <option value="">Select patient</option>
                {patients.map((p) => <option key={p.id} value={p.id}>{p.firstName} {p.lastName}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Provider *</label>
              <select value={form.providerId} onChange={(e) => setForm({ ...form, providerId: e.target.value })} required className="w-full border rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500">
                <option value="">Select provider</option>
                {providers.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>

            {/* AI Suggestion Panel */}
            {!editing && slots && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-xs font-semibold text-blue-700 mb-2 flex items-center gap-1.5">
                  <span className="inline-block w-4 h-4 bg-blue-600 rounded text-white text-center leading-4 text-xs font-bold">AI</span>
                  Slot Suggestions
                </p>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs text-gray-600">No-show risk:</span>
                  <span className={`text-xs font-bold ${slots.noShowProbability > 0.5 ? 'text-red-600' : slots.noShowProbability > 0.3 ? 'text-yellow-600' : 'text-green-600'}`}>
                    {Math.round(slots.noShowProbability * 100)}%
                  </span>
                </div>
                {slots.recommended && (
                  <div className="mb-2">
                    <span className="text-xs text-gray-600">Recommended: </span>
                    <button type="button" onClick={() => applySlot(slots.recommended)} className="text-xs text-blue-600 font-medium hover:underline">
                      {new Date(slots.recommended).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} — Apply
                    </button>
                  </div>
                )}
                <div className="flex flex-wrap gap-1 max-h-20 overflow-y-auto">
                  {slots.available.slice(0, 12).map((s) => (
                    <button key={s} type="button" onClick={() => applySlot(s)}
                      className={`text-xs px-2 py-1 rounded border transition-colors ${form.scheduledAt === s.slice(0, 16) ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-200 hover:border-blue-400'}`}>
                      {new Date(s).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </button>
                  ))}
                  {slots.available.length === 0 && <p className="text-xs text-red-500">No available slots</p>}
                </div>
              </div>
            )}
            {!editing && slotsLoading && <p className="text-xs text-blue-500">Loading available slots...</p>}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Procedure *</label>
                <input value={form.procedure} onChange={(e) => setForm({ ...form, procedure: e.target.value })} required className="w-full border rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Chair</label>
                <input value={form.chair} onChange={(e) => setForm({ ...form, chair: e.target.value })} className="w-full border rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Date & Time *</label>
                <input type="datetime-local" value={form.scheduledAt} onChange={(e) => setForm({ ...form, scheduledAt: e.target.value })} required className="w-full border rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Duration (min)</label>
                <input type="number" value={form.duration} onChange={(e) => setForm({ ...form, duration: parseInt(e.target.value) })} className="w-full border rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Notes</label>
              <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} className="w-full border rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500" />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.isEmergency} onChange={(e) => setForm({ ...form, isEmergency: e.target.checked })} />
              Emergency appointment
            </label>
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
