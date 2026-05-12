/**
 * Reminder Service — ML-Enhanced SMS Reminders via Twilio
 *
 * Cron: every hour at :00
 * Logic:
 *   1. Fetch appointments in next 24h with reminderSent = false
 *   2. Call ANN no-show prediction
 *   3. High risk (>0.7) → send confirmation request SMS
 *      Normal           → send standard reminder SMS
 *   4. Mark reminderSent = true
 */

const cron    = require('node-cron');
const axios   = require('axios');
const { PrismaClient } = require('@prisma/client');
const { sendSMS } = require('./sms.service');

const prisma = new PrismaClient();
const ANN_SERVICE_URL = process.env.ANN_SERVICE_URL || 'http://localhost:8003';

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(dt) {
  return dt.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
}

function formatTime(dt) {
  return dt.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}

/**
 * Get no-show probability from ANN service.
 * Returns 0 on any failure so reminders still send.
 */
async function getNoShowProbability(patient, scheduledAt) {
  try {
    const apptDate = new Date(scheduledAt);
    const jsDay    = apptDate.getDay();
    const appointment_day = jsDay === 0 ? 6 : jsDay - 1;

    const age = patient.dateOfBirth
      ? Math.floor((Date.now() - new Date(patient.dateOfBirth)) / (365.25 * 24 * 3600 * 1000))
      : 35;

    const lead_time = Math.max(
      0,
      Math.round((apptDate.getTime() - Date.now()) / (24 * 3600 * 1000))
    );

    const { data } = await axios.post(
      `${ANN_SERVICE_URL}/predict/no-show-ann`,
      { age, lead_time, previous_no_shows: patient.noShowCount ?? 0, appointment_day },
      { timeout: 2000 }
    );
    return data.probability ?? 0;
  } catch {
    return 0; // fallback — send normal reminder
  }
}

// ── Core reminder logic ───────────────────────────────────────────────────────

async function sendReminders() {
  const now   = new Date();
  const in24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);

  const appointments = await prisma.appointment.findMany({
    where: {
      scheduledAt:  { gte: now, lte: in24h },
      status:       { in: ['SCHEDULED', 'CONFIRMED'] },
      reminderSent: false,
    },
    include: {
      patient:  { select: { firstName: true, lastName: true, phone: true, email: true, dateOfBirth: true, noShowCount: true } },
      provider: { select: { name: true } },
    },
    orderBy: { scheduledAt: 'asc' },
  });

  if (!appointments.length) {
    console.log(`[ReminderService] ${now.toISOString()} — No pending reminders.`);
    return 0;
  }

  let sent = 0;

  for (const appt of appointments) {
    const { patient } = appt;
    const phone = patient.phone;
    const date  = formatDate(appt.scheduledAt);
    const time  = formatTime(appt.scheduledAt);
    const name  = `${patient.firstName} ${patient.lastName}`;

    try {
      // ── ML-based smart reminder ──────────────────────────────────────────
      const probability = await getNoShowProbability(patient, appt.scheduledAt);

      let message;
      if (probability > 0.7) {
        message = `Hi ${patient.firstName}, this is Smart DentalOps. ` +
          `Important: Please confirm your appointment on ${date} at ${time}. ` +
          `Reply YES to confirm or call us to reschedule.`;
      } else {
        message = `Hi ${patient.firstName}, reminder from Smart DentalOps: ` +
          `Your dental appointment is scheduled on ${date} at ${time} ` +
          `with ${appt.provider.name}. See you soon!`;
      }

      if (phone) {
        // Mark sent FIRST to prevent duplicates if process restarts
        await prisma.appointment.update({
          where: { id: appt.id },
          data:  { reminderSent: true },
        });
        await sendSMS(phone, message);
      } else {
        // No phone — mark sent and log only
        await prisma.appointment.update({
          where: { id: appt.id },
          data:  { reminderSent: true },
        });
        console.log(`[ReminderService] No phone for ${name} (${appt.id}) — logged only.`);
        console.log(`[ReminderService] MSG: ${message}`);
      }

      console.log(`[ReminderService] Reminder sent for ${name} | ${date} ${time} | risk: ${(probability * 100).toFixed(0)}%`);
      sent++;
    } catch (err) {
      console.error(`[ReminderService] Failed for appointment ${appt.id}: ${err.message}`);
    }
  }

  console.log(`[ReminderService] ${now.toISOString()} — Sent ${sent} reminder(s).`);
  return sent;
}

// ── Cron job ──────────────────────────────────────────────────────────────────

function startReminderJob() {
  console.log('[ReminderService] Hourly reminder job scheduled (runs at :00 every hour).');
  cron.schedule('0 * * * *', async () => {
    try {
      await sendReminders();
    } catch (err) {
      console.error('[ReminderService] Job failed:', err.message);
    }
  });
}

module.exports = { startReminderJob, sendReminders };
