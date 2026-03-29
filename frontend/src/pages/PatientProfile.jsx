import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ChevronLeft, CheckCircle2, XCircle } from 'lucide-react';
import api from '../api/client';
import Badge from '../components/Badge';

export default function PatientProfile() {
  const { id } = useParams();
  const [patient, setPatient] = useState(null);
  const [tab, setTab] = useState('appointments');

  useEffect(() => { api.get(`/patients/${id}`).then((r) => setPatient(r.data)); }, [id]);

  if (!patient) return <div className="p-6 text-gray-500">Loading...</div>;

  const noShowRate = patient.totalAppointments > 0
    ? Math.round((patient.noShowCount / patient.totalAppointments) * 100)
    : 0;

  return (
    <div className="p-6 space-y-6">
      <Link to="/patients" className="inline-flex items-center gap-1 text-blue-600 hover:underline text-sm">
        <ChevronLeft size={15} /> Patients
      </Link>

      <div className="bg-white rounded-xl border p-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold">{patient.firstName} {patient.lastName}</h1>
            <p className="text-gray-500 text-sm mt-1">{patient.phone} · {patient.email || 'No email'}</p>
            {patient.dateOfBirth && <p className="text-gray-500 text-sm">DOB: {new Date(patient.dateOfBirth).toLocaleDateString()}</p>}
          </div>
          <div className="text-right space-y-1">
            <div className="text-sm">
              <span className="text-gray-500">No-show rate: </span>
              <span className={noShowRate > 30 ? 'text-red-600 font-bold' : 'text-green-600 font-bold'}>{noShowRate}%</span>
            </div>
            <div className="text-sm">
              <span className="text-gray-500">Total visits: </span>
              <span className="font-medium">{patient.totalAppointments}</span>
            </div>
          </div>
        </div>
        {(patient.medicalHistory || patient.dentalHistory) && (
          <div className="mt-4 grid grid-cols-2 gap-4 pt-4 border-t">
            <div>
              <p className="text-xs font-medium text-gray-500 mb-1">Medical History</p>
              <p className="text-sm">{patient.medicalHistory || '—'}</p>
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500 mb-1">Dental History</p>
              <p className="text-sm">{patient.dentalHistory || '—'}</p>
            </div>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b">
        {['appointments', 'treatments', 'payments', 'communications'].map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm capitalize border-b-2 transition-colors ${tab === t ? 'border-blue-600 text-blue-600 font-medium' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-xl border overflow-hidden">
        {tab === 'appointments' && (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                {['Date', 'Procedure', 'Provider', 'Status', 'No-Show Risk'].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-gray-600 font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {patient.appointments.map((a) => (
                <tr key={a.id} className="border-b last:border-0">
                  <td className="px-4 py-3">{new Date(a.scheduledAt).toLocaleString()}</td>
                  <td className="px-4 py-3">{a.procedure}</td>
                  <td className="px-4 py-3">{a.provider.name}</td>
                  <td className="px-4 py-3"><Badge value={a.status} /></td>
                  <td className="px-4 py-3">
                    <span className={a.noShowProbability > 0.4 ? 'text-red-600' : 'text-green-600'}>
                      {Math.round(a.noShowProbability * 100)}%
                    </span>
                  </td>
                </tr>
              ))}
              {patient.appointments.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-6 text-center text-gray-400">No appointments</td></tr>
              )}
            </tbody>
          </table>
        )}

        {tab === 'treatments' && (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                {['Title', 'Cost', 'Acceptance', 'Status', 'Consent'].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-gray-600 font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {patient.treatments.map((t) => (
                <tr key={t.id} className="border-b last:border-0">
                  <td className="px-4 py-3 font-medium">{t.title}</td>
                  <td className="px-4 py-3">${t.estimatedCost.toLocaleString()}</td>
                  <td className="px-4 py-3">{Math.round(t.acceptanceProbability * 100)}%</td>
                  <td className="px-4 py-3"><Badge value={t.status} /></td>
                  <td className="px-4 py-3">
                    {t.consentSigned
                      ? <CheckCircle2 size={16} className="text-green-500" />
                      : <XCircle size={16} className="text-red-400" />}
                  </td>
                </tr>
              ))}
              {patient.treatments.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-6 text-center text-gray-400">No treatments</td></tr>
              )}
            </tbody>
          </table>
        )}

        {tab === 'payments' && (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                {['Amount', 'Status', 'Method', 'Due Date', 'Paid At'].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-gray-600 font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {patient.payments.map((p) => (
                <tr key={p.id} className="border-b last:border-0">
                  <td className="px-4 py-3 font-medium">${p.amount.toLocaleString()}</td>
                  <td className="px-4 py-3"><Badge value={p.status} /></td>
                  <td className="px-4 py-3">{p.method || '—'}</td>
                  <td className="px-4 py-3">{p.dueDate ? new Date(p.dueDate).toLocaleDateString() : '—'}</td>
                  <td className="px-4 py-3">{p.paidAt ? new Date(p.paidAt).toLocaleDateString() : '—'}</td>
                </tr>
              ))}
              {patient.payments.length === 0 && (
                <tr><td colSpan={5} className="px-4 py-6 text-center text-gray-400">No payments</td></tr>
              )}
            </tbody>
          </table>
        )}

        {tab === 'communications' && (
          <div className="divide-y">
            {patient.communications.map((c) => (
              <div key={c.id} className="px-4 py-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium text-gray-500">{c.channel} · {c.direction}</span>
                  <div className="flex gap-2 items-center">
                    {c.sentiment && <Badge value={c.sentiment} />}
                    <span className="text-xs text-gray-400">{new Date(c.createdAt).toLocaleString()}</span>
                  </div>
                </div>
                <p className="text-sm">{c.message}</p>
                {c.intent && <span className="text-xs text-blue-500 mt-1 block">Intent: {c.intent}</span>}
              </div>
            ))}
            {patient.communications.length === 0 && (
              <p className="px-4 py-6 text-center text-gray-400">No communications</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
