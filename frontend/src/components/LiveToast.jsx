import { useState, useCallback } from 'react';
import { useWebSocket } from '../hooks/useWebSocket';
import { CalendarCheck, CalendarX, DollarSign, ClipboardList, X, Users } from 'lucide-react';

const EVENT_LABELS = {
  APPOINTMENT_CREATED:   { Icon: CalendarCheck, color: 'bg-blue-600',   label: 'New appointment booked' },
  APPOINTMENT_CANCELLED: { Icon: CalendarX,     color: 'bg-red-500',    label: 'Appointment cancelled' },
  PAYMENT_RECORDED:      { Icon: DollarSign,    color: 'bg-green-600',  label: 'Payment recorded' },
  TREATMENT_UPDATED:     { Icon: ClipboardList, color: 'bg-purple-600', label: 'Treatment updated' },
  WAITLIST_SUGGESTION:   { Icon: Users,         color: 'bg-amber-500',  label: 'Waitlist candidates available' },
};

export default function LiveToast() {
  const [toasts, setToasts] = useState([]);

  const handleMessage = useCallback((msg) => {
    if (msg.type === 'CONNECTED') return;
    const meta = EVENT_LABELS[msg.type];
    if (!meta) return;
    const id = Date.now();
    const name = msg.type === 'WAITLIST_SUGGESTION'
      ? `${msg.payload?.candidates?.length ?? 0} candidate(s) for ${msg.payload?.cancelledAppointment?.procedure}`
      : msg.payload?.patient
      ? `${msg.payload.patient.firstName} ${msg.payload.patient.lastName}`
      : '';
    setToasts((prev) => [...prev, { id, ...meta, name }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 4000);
  }, []);

  useWebSocket(handleMessage);

  return (
    <div className="fixed bottom-4 right-4 space-y-2 z-50">
      {toasts.map((t) => (
        <div key={t.id} className={`flex items-center gap-2 ${t.color} text-white px-4 py-2.5 rounded-lg shadow-lg text-sm animate-fade-in`}>
          <t.Icon size={15} />
          <span>{t.label}{t.name ? ` — ${t.name}` : ''}</span>
          <button onClick={() => setToasts((p) => p.filter((x) => x.id !== t.id))} className="ml-2 opacity-70 hover:opacity-100">
            <X size={13} />
          </button>
        </div>
      ))}
    </div>
  );
}
