/**
 * WhatsApp Booking + Onboarding Flow
 *
 * New patient flow:
 *   ONBOARD_NAME → ONBOARD_DOB → ONBOARD_CONDITIONS → ONBOARD_ALLERGIES → registered
 *
 * Booking flow:
 *   START → IDENTIFY → PROCEDURE → DATE → TIME → CONFIRM → DONE
 */

const { PrismaClient } = require('@prisma/client');
const session = require('./whatsappSession');
const { predictNoShowANN } = require('./mlClient');
const { predictDuration } = require('./durationClient');

const prisma = new PrismaClient();

const PROCEDURES = [
  'Checkup',
  'Cleaning',
  'Filling',
  'Root Canal',
  'Extraction',
  'Crown',
];

// ── Date parsing ──────────────────────────────────────────────────────────────

function parseDate(input) {
  const text = input.trim().toLowerCase();
  const today = new Date();

  if (text === 'today') return today;
  if (text === 'tomorrow') {
    const d = new Date(today);
    d.setDate(d.getDate() + 1);
    return d;
  }

  // Try natural date like "15 april" or "april 15"
  const parsed = new Date(`${input} ${today.getFullYear()}`);
  if (!isNaN(parsed)) return parsed;

  // Try ISO format YYYY-MM-DD
  const iso = new Date(input);
  if (!isNaN(iso)) return iso;

  return null;
}

function formatDate(date) {
  return date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
}

// ── Available slots for a date ────────────────────────────────────────────────

async function getAvailableSlots(date, providerId) {
  const start = new Date(date); start.setHours(9, 0, 0, 0);
  const end   = new Date(date); end.setHours(17, 0, 0, 0);

  const booked = await prisma.appointment.findMany({
    where: {
      providerId,
      scheduledAt: { gte: start, lt: end },
      status: { notIn: ['CANCELLED'] },
    },
    select: { scheduledAt: true, duration: true },
  });

  const slots = [];
  for (let h = 9; h < 17; h++) {
    for (let m = 0; m < 60; m += 30) {
      const slot = new Date(date);
      slot.setHours(h, m, 0, 0);
      const slotEnd = new Date(slot.getTime() + 60 * 60000);
      const conflict = booked.some((b) => {
        const bStart = new Date(b.scheduledAt);
        const bEnd   = new Date(bStart.getTime() + b.duration * 60000);
        return slot < bEnd && slotEnd > bStart;
      });
      if (!conflict) slots.push(slot);
    }
  }
  return slots;
}

// ── Onboarding flow for new patients ─────────────────────────────────────────

/**
 * Handle new patient onboarding via WhatsApp.
 * Collects: name, DOB, medical conditions, allergies.
 * Creates patient record in DB on completion.
 *
 * @returns {string|null} reply message, or null if not in onboarding
 */
async function handleOnboarding(phone, message, existingPatient) {
  const s = session.get(phone);
  const text = message.trim();

  // Trigger onboarding if unknown number and not already in a session
  if (!existingPatient && !s) {
    session.set(phone, { step: 'ONBOARD_NAME' });
    return `👋 Welcome to Smart DentalOps!\n\nI don't have your details yet. Let's get you registered quickly.\n\nWhat is your *full name*?`;
  }

  if (!s || !s.step?.startsWith('ONBOARD')) return null;

  // ── Step: collect name ────────────────────────────────────────────────────
  if (s.step === 'ONBOARD_NAME') {
    if (text.length < 2) return `Please enter your full name.`;
    session.set(phone, { step: 'ONBOARD_DOB', name: text });
    return `Hi *${text}*! 😊\n\nWhat is your date of birth?\nFormat: DD/MM/YYYY`;
  }

  // ── Step: collect DOB ─────────────────────────────────────────────────────
  if (s.step === 'ONBOARD_DOB') {
    const parts = text.split('/');
    const dob = parts.length === 3
      ? new Date(`${parts[2]}-${parts[1].padStart(2,'0')}-${parts[0].padStart(2,'0')}`)
      : null;

    if (!dob || isNaN(dob)) {
      return `Please enter your date of birth in DD/MM/YYYY format.\nExample: 15/06/1995`;
    }
    session.set(phone, { step: 'ONBOARD_CONDITIONS', dob: dob.toISOString() });
    return `Do you have any of the following? Reply with the *numbers* (e.g. 1,3 or 4 for none):\n\n1. Diabetes\n2. Heart condition\n3. High blood pressure\n4. None of the above`;
  }

  // ── Step: collect medical conditions ─────────────────────────────────────
  if (s.step === 'ONBOARD_CONDITIONS') {
    const nums = text.split(/[,\s]+/).map(n => parseInt(n.trim())).filter(n => !isNaN(n));
    const hasDiabetes       = nums.includes(1);
    const hasHeartCondition = nums.includes(2);
    const hasBloodPressure  = nums.includes(3);
    session.set(phone, { step: 'ONBOARD_ALLERGIES', hasDiabetes, hasHeartCondition, hasBloodPressure });
    return `Any known *allergies* or *current medications*?\n(Reply NONE if not applicable)`;
  }

  // ── Step: collect allergies → create patient ──────────────────────────────
  if (s.step === 'ONBOARD_ALLERGIES') {
    const allergies = text.toUpperCase() === 'NONE' ? null : text;
    const nameParts = (s.name || '').trim().split(' ');
    const firstName = nameParts[0];
    const lastName  = nameParts.slice(1).join(' ') || '-';

    try {
      const patient = await prisma.patient.create({
        data: {
          firstName,
          lastName,
          phone,
          dateOfBirth:      s.dob ? new Date(s.dob) : null,
          hasDiabetes:      s.hasDiabetes || false,
          hasHeartCondition: s.hasHeartCondition || false,
          hasBloodPressure: s.hasBloodPressure || false,
          allergies,
          onboarded: true,
        },
      });

      session.clear(phone);
      console.log(`[WhatsApp Onboarding] New patient created: ${patient.id} — ${firstName} ${lastName}`);

      return `✅ *You're registered, ${firstName}!*\n\nYour profile has been created.\n\nWhat would you like to do?\n• Reply *BOOK* to book an appointment\n• Reply *STATUS* to check your queue\n• Reply *HELP* for more options`;
    } catch (err) {
      session.clear(phone);
      console.error('[WhatsApp Onboarding] Failed to create patient:', err.message);
      return `Sorry, we couldn't complete your registration. Please call us or try again.`;
    }
  }

  return null;
}

// ── Main flow handler ─────────────────────────────────────────────────────────

/**
 * Process an inbound WhatsApp message through the booking flow.
 * Returns the reply message string (or null if not in booking flow).
 *
 * @param {string} phone   - normalised E.164 phone number
 * @param {string} message - raw message text
 * @param {object} patient - Prisma patient record (may be null)
 */
async function handleBookingFlow(phone, message, patient) {
  const text  = message.trim();
  const upper = text.toUpperCase();
  const s     = session.get(phone);

  // ── Onboarding for new patients ───────────────────────────────────────────
  const onboardReply = await handleOnboarding(phone, message, patient);
  if (onboardReply) return onboardReply;

  // ── Trigger: start booking flow ───────────────────────────────────────────
  if (!s && (upper === 'BOOK' || upper === 'BOOK APPOINTMENT' || upper === '1')) {
    if (!patient) {
      session.set(phone, { step: 'IDENTIFY' });
      return `👋 Welcome to Smart DentalOps!\n\nTo book an appointment, please reply with your *full name* so we can find your record.`;
    }
    // Patient already known — skip identify step
    session.set(phone, { step: 'PROCEDURE', patientId: patient.id, patientName: `${patient.firstName} ${patient.lastName}` });
    return buildProcedureMenu(patient.firstName);
  }

  // Not in a booking session
  if (!s) return null;

  // ── Step: IDENTIFY ────────────────────────────────────────────────────────
  if (s.step === 'IDENTIFY') {
    const name = text.trim();
    const parts = name.split(' ');
    const found = await prisma.patient.findFirst({
      where: {
        OR: [
          { firstName: { contains: parts[0], mode: 'insensitive' } },
          { lastName:  { contains: parts[parts.length - 1], mode: 'insensitive' } },
        ],
      },
    });

    if (!found) {
      return `❌ We couldn't find a patient named "${name}".\n\nPlease check your name and try again, or call us to register.`;
    }

    session.set(phone, { step: 'PROCEDURE', patientId: found.id, patientName: `${found.firstName} ${found.lastName}` });
    return buildProcedureMenu(found.firstName);
  }

  // ── Step: PROCEDURE ───────────────────────────────────────────────────────
  if (s.step === 'PROCEDURE') {
    const num = parseInt(text);
    if (isNaN(num) || num < 1 || num > PROCEDURES.length) {
      return `Please reply with a number between 1 and ${PROCEDURES.length}.\n\n${buildProcedureMenu(null, true)}`;
    }
    const procedure = PROCEDURES[num - 1];
    session.set(phone, { step: 'DATE', procedure });
    return `Great choice! *${procedure}* selected.\n\n📅 What date would you like?\n\nReply with a date like:\n• *tomorrow*\n• *15 April*\n• *2026-04-20*`;
  }

  // ── Step: DATE ────────────────────────────────────────────────────────────
  if (s.step === 'DATE') {
    const date = parseDate(text);
    if (!date || date < new Date()) {
      return `❌ Couldn't understand that date. Please try again.\n\nExamples: *tomorrow*, *15 April*, *2026-04-20*`;
    }

    // Get first available provider
    const provider = await prisma.provider.findFirst({ where: { isActive: true } });
    if (!provider) return `Sorry, no providers are available right now. Please call us.`;

    const slots = await getAvailableSlots(date, provider.id);
    if (!slots.length) {
      return `😔 No available slots on ${formatDate(date)}. Please try another date.`;
    }

    session.set(phone, {
      step: 'TIME',
      date: date.toISOString().split('T')[0],
      providerId: provider.id,
      providerName: provider.name,
      availableSlots: slots.map((s) => s.toISOString()),
    });

    const slotList = slots.slice(0, 8).map((slot, i) =>
      `${i + 1}. ${slot.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`
    ).join('\n');

    return `📅 *${formatDate(date)}* — Available slots with ${provider.name}:\n\n${slotList}\n\nReply with the *number* of your preferred time.`;
  }

  // ── Step: TIME ────────────────────────────────────────────────────────────
  if (s.step === 'TIME') {
    const num = parseInt(text);
    const slots = s.availableSlots || [];
    if (isNaN(num) || num < 1 || num > Math.min(slots.length, 8)) {
      return `Please reply with a number between 1 and ${Math.min(slots.length, 8)}.`;
    }

    const chosenSlot = slots[num - 1];
    const slotDate   = new Date(chosenSlot);
    const timeStr    = slotDate.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

    session.set(phone, { step: 'CONFIRM', chosenSlot, timeStr });

    return `✅ *Booking Summary*\n\n` +
      `👤 Patient: ${s.patientName}\n` +
      `🦷 Procedure: ${s.procedure}\n` +
      `📅 Date: ${formatDate(slotDate)}\n` +
      `⏰ Time: ${timeStr}\n` +
      `👨‍⚕️ Provider: ${s.providerName}\n\n` +
      `Reply *YES* to confirm or *NO* to cancel.`;
  }

  // ── Step: CONFIRM ─────────────────────────────────────────────────────────
  if (s.step === 'CONFIRM') {
    if (upper === 'NO' || upper === 'CANCEL') {
      session.clear(phone);
      return `❌ Booking cancelled. Reply *BOOK* anytime to start again.`;
    }

    if (upper !== 'YES') {
      return `Please reply *YES* to confirm or *NO* to cancel.`;
    }

    // Create the appointment
    try {
      const patient = await prisma.patient.findUnique({ where: { id: s.patientId } });
      const scheduledAtISO = new Date(s.chosenSlot).toISOString();

      // ML predictions
      const [noShowResult, predictedDuration] = await Promise.all([
        predictNoShowANN(patient, scheduledAtISO).catch(() => ({ probability: 0.2, risk: 'LOW', model: 'fallback' })),
        predictDuration({ procedure: s.procedure, dentistExperience: 5, pastAvgDuration: 60 }).catch(() => 60),
      ]);

      const appointment = await prisma.appointment.create({
        data: {
          patientId:        s.patientId,
          providerId:       s.providerId,
          procedure:        s.procedure,
          scheduledAt:      scheduledAtISO,
          duration:         Math.round(predictedDuration),
          noShowProbability: noShowResult.probability,
          status:           'CONFIRMED',
          confirmed:        true,
        },
        include: { patient: true, provider: true },
      });

      await prisma.patient.update({
        where: { id: s.patientId },
        data:  { totalAppointments: { increment: 1 } },
      });

      session.clear(phone);

      return `🎉 *Appointment Booked!*\n\n` +
        `📋 Ref: ${appointment.id.slice(0, 8).toUpperCase()}\n` +
        `🦷 ${s.procedure}\n` +
        `📅 ${formatDate(new Date(s.chosenSlot))}\n` +
        `⏰ ${s.timeStr}\n` +
        `👨‍⚕️ ${s.providerName}\n` +
        `⏱️ Est. duration: ${Math.round(predictedDuration)} min\n\n` +
        `See you soon! Reply *BOOK* to make another appointment.`;
    } catch (err) {
      session.clear(phone);
      console.error('[WhatsApp Booking] Failed to create appointment:', err.message);
      return `❌ Sorry, we couldn't complete your booking. Please call us or try again.\n\nReply *BOOK* to start over.`;
    }
  }

  return null;
}

function buildProcedureMenu(firstName, listOnly = false) {
  const list = PROCEDURES.map((p, i) => `${i + 1}. ${p}`).join('\n');
  if (listOnly) return list;
  return `Hi ${firstName}! 😊\n\nPlease choose a procedure:\n\n${list}\n\nReply with the *number* of your choice.`;
}

module.exports = { handleBookingFlow };
