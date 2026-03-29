import { useDraggable, useDroppable, DndContext } from '@dnd-kit/core';
import { AlertCircle } from 'lucide-react';

const HOURS = Array.from({ length: 10 }, (_, i) => i + 8);
const SLOT_HEIGHT = 64;

function formatTime(h) {
  return `${String(h).padStart(2, '0')}:00`;
}

function getTopOffset(scheduledAt) {
  const d = new Date(scheduledAt);
  return (d.getHours() + d.getMinutes() / 60 - 8) * SLOT_HEIGHT;
}

function getHeight(duration) {
  return (duration / 60) * SLOT_HEIGHT;
}

function AppointmentBlock({ appt, onClick }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: appt.id });

  const style = {
    top: getTopOffset(appt.scheduledAt),
    height: Math.max(getHeight(appt.duration), 28),
    transform: transform ? `translate(${transform.x}px, ${transform.y}px)` : undefined,
    opacity: isDragging ? 0.4 : 1,
    zIndex: isDragging ? 50 : 10,
  };

  const colorClass = appt.isEmergency
    ? 'bg-red-100 border-red-500 text-red-900'
    : appt.noShowProbability > 0.5
    ? 'bg-orange-100 border-orange-400 text-orange-900'
    : appt.noShowProbability > 0.3
    ? 'bg-yellow-100 border-yellow-400 text-yellow-900'
    : 'bg-blue-100 border-blue-400 text-blue-900';

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      onClick={(e) => { e.stopPropagation(); onClick(appt); }}
      style={style}
      className={`absolute left-1 right-1 rounded border-l-4 px-1.5 py-0.5 cursor-grab active:cursor-grabbing select-none overflow-hidden ${colorClass}`}
    >
      <div className="flex items-center gap-1">
        <p className="text-xs font-semibold truncate leading-tight flex-1">
          {new Date(appt.scheduledAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </p>
        {appt.isEmergency && <AlertCircle size={10} className="text-red-600 shrink-0" />}
      </div>
      <p className="text-xs truncate leading-tight">{appt.patient.firstName} {appt.patient.lastName}</p>
      <p className="text-xs truncate leading-tight opacity-70">{appt.procedure}</p>
    </div>
  );
}

function HourCell({ dayIso, hour }) {
  const { setNodeRef, isOver } = useDroppable({ id: `${dayIso}__${hour}` });
  return (
    <div
      ref={setNodeRef}
      className={`border-b border-gray-100 transition-colors ${isOver ? 'bg-blue-50' : ''}`}
      style={{ height: SLOT_HEIGHT }}
    />
  );
}

function DayColumn({ day, appointments, onAppointmentClick }) {
  const dayIso = day.toISOString().split('T')[0];
  const isToday = dayIso === new Date().toISOString().split('T')[0];

  return (
    <div className="flex-1 min-w-0 border-l border-gray-200 relative">
      <div className={`text-center py-2 border-b sticky top-0 z-20 ${isToday ? 'bg-blue-600 text-white' : 'bg-gray-50 text-gray-700'}`}>
        <p className="text-xs font-medium">{day.toLocaleDateString('en-US', { weekday: 'short' })}</p>
        <p className={`text-lg font-bold ${isToday ? 'text-white' : 'text-gray-900'}`}>{day.getDate()}</p>
      </div>
      <div className="relative">
        {HOURS.map((h) => <HourCell key={h} dayIso={dayIso} hour={h} />)}
        {appointments.map((a) => (
          <AppointmentBlock key={a.id} appt={a} onClick={onAppointmentClick} />
        ))}
      </div>
    </div>
  );
}

export default function CalendarGrid({ weekStart, appointments, onAppointmentClick, onDropReschedule }) {
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    return d;
  });

  const getApptsByDay = (day) => {
    const iso = day.toISOString().split('T')[0];
    return appointments.filter((a) => new Date(a.scheduledAt).toISOString().split('T')[0] === iso);
  };

  const handleDragEnd = ({ active, over }) => {
    if (!over || !active) return;
    const [dayIso, hourStr] = over.id.split('__');
    if (!dayIso || !hourStr) return;
    const newDate = new Date(dayIso);
    newDate.setHours(parseInt(hourStr), 0, 0, 0);
    onDropReschedule(active.id, newDate.toISOString());
  };

  return (
    <DndContext onDragEnd={handleDragEnd}>
      <div className="flex overflow-x-auto rounded-xl border bg-white">
        {/* Time gutter */}
        <div className="w-14 shrink-0 border-r border-gray-200">
          <div className="h-[57px] border-b bg-gray-50" />
          {HOURS.map((h) => (
            <div key={h} className="border-b border-gray-100 flex items-start justify-end pr-2 pt-1" style={{ height: SLOT_HEIGHT }}>
              <span className="text-xs text-gray-400">{formatTime(h)}</span>
            </div>
          ))}
        </div>
        {days.map((day) => (
          <DayColumn key={day.toISOString()} day={day} appointments={getApptsByDay(day)} onAppointmentClick={onAppointmentClick} />
        ))}
      </div>
    </DndContext>
  );
}
