/**
 * Waitlist Auto-Fill Service
 *
 * When an appointment is cancelled, this service:
 *  1. Finds waitlisted patients who match the freed procedure/slot
 *  2. Ranks them by: procedure match → low no-show risk → longest wait
 *  3. Returns top 3 candidates
 *  4. Emits a WAITLIST_SUGGESTION WebSocket event
 */

const { PrismaClient } = require('@prisma/client');
const { emit } = require('../events/handler');

const prisma = new PrismaClient();

/**
 * Find top 3 waitlist candidates for a cancelled appointment.
 *
 * Ranking priority:
 *  1. Exact procedure match (highest priority)
 *  2. Low no-show probability (reliable patients first)
 *  3. Earliest waitlist entry (longest wait)
 *
 * @param {object} cancelledAppointment - full appointment record with patient
 * @returns {Promise<Array>} up to 3 candidate objects
 */
async function findWaitlistCandidates(cancelledAppointment) {
  const { procedure, providerId, scheduledAt } = cancelledAppointment;

  // Get all waitlisted patients, excluding the patient who just cancelled
  const waitlistEntries = await prisma.waitlist.findMany({
    where: {
      patientId: { not: cancelledAppointment.patientId },
    },
    include: {
      patient: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          phone: true,
          email: true,
          noShowCount: true,
          totalAppointments: true,
        },
      },
    },
    orderBy: { createdAt: 'asc' }, // longest wait first
  });

  if (!waitlistEntries.length) return [];

  // Score each candidate
  const scored = waitlistEntries.map((entry) => {
    const { patient } = entry;

    // No-show rate (lower = better)
    const noShowRate = patient.totalAppointments > 0
      ? patient.noShowCount / patient.totalAppointments
      : 0;

    // Procedure match bonus
    const procedureMatch = entry.procedure
      ? entry.procedure.toLowerCase() === procedure.toLowerCase()
      : true; // no preference = matches anything

    const score =
      (procedureMatch ? 100 : 0) +   // procedure match: +100
      (1 - noShowRate) * 50;          // reliability: 0–50

    return {
      waitlistId: entry.id,
      patientId: patient.id,
      name: `${patient.firstName} ${patient.lastName}`,
      phone: patient.phone,
      email: patient.email,
      requestedProcedure: entry.procedure || 'Any',
      procedureMatch,
      noShowRate: parseFloat(noShowRate.toFixed(2)),
      waitingSince: entry.createdAt,
      notes: entry.notes,
      score,
    };
  });

  // Sort by score descending, take top 3
  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);
}

/**
 * Handle a cancellation: find candidates, notify top one via WhatsApp, emit WebSocket event.
 * Called automatically when an appointment is cancelled.
 *
 * @param {object} cancelledAppointment
 */
async function handleCancellation(cancelledAppointment) {
  try {
    const candidates = await findWaitlistCandidates(cancelledAppointment);

    if (!candidates.length) {
      console.log(`[Waitlist] No candidates found for cancelled slot: ${cancelledAppointment.procedure}`);
      return;
    }

    console.log(`[Waitlist] Found ${candidates.length} candidate(s) for: ${cancelledAppointment.procedure}`);

    // Auto-contact top candidate via WhatsApp
    const top = candidates[0];
    if (top.phone) {
      const date = new Date(cancelledAppointment.scheduledAt).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
      const time = new Date(cancelledAppointment.scheduledAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
      const msg = `Hi ${top.name.split(' ')[0]}! A ${cancelledAppointment.procedure} slot just opened on ${date} at ${time}. ` +
        `Would you like to take it? Reply *YES* to confirm or *NO* to pass.`;
      try {
        const { sendSMS } = require('./sms.service');
        await sendSMS(top.phone, msg);
        console.log(`[Waitlist] Auto-contacted ${top.name} (${top.phone}) for opened slot`);
      } catch (err) {
        console.warn(`[Waitlist] Failed to contact ${top.name}: ${err.message}`);
      }
    }

    // Emit WebSocket event to all connected clients
    emit('WAITLIST_SUGGESTION', {
      cancelledAppointment: {
        id: cancelledAppointment.id,
        procedure: cancelledAppointment.procedure,
        scheduledAt: cancelledAppointment.scheduledAt,
        providerId: cancelledAppointment.providerId,
      },
      candidates,
    });
  } catch (err) {
    console.error('[Waitlist] Error finding candidates:', err.message);
  }
}

module.exports = { handleCancellation, findWaitlistCandidates };
