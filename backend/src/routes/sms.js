const router = require('express').Router();
const { PrismaClient } = require('@prisma/client');
const { sendSMS } = require('../services/sms.service');
const { authenticate } = require('../middleware/auth');
const { getSentiment } = require('../services/nlpClient');
const { detectIntent } = require('../services/intelligence');
const { predictNoShowANN } = require('../services/mlClient');
const { handleBookingFlow } = require('../services/whatsappBooking');

const prisma = new PrismaClient();

// ── Custom message (from CRM Communications page) ────────────────────────────
router.post('/send-custom', authenticate, async (req, res) => {
  try {
    const { phone, message } = req.body;
    if (!phone || !message) return res.status(400).json({ error: 'phone and message are required' });
    await sendSMS(phone, message);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── Manual reminder trigger (from CRM) ───────────────────────────────────────
/**
 * POST /api/sms/send-reminder/:appointmentId
 * Manually send a WhatsApp reminder for a specific appointment.
 * Requires auth — called from the CRM UI.
 */
router.post('/send-reminder/:appointmentId', authenticate, async (req, res) => {
  try {
    const appointment = await prisma.appointment.findUnique({
      where: { id: req.params.appointmentId },
      include: { patient: true, provider: true },
    });

    if (!appointment) return res.status(404).json({ error: 'Appointment not found' });
    if (!appointment.patient.phone) return res.status(400).json({ error: 'Patient has no phone number' });

    const date = appointment.scheduledAt.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
    const time = appointment.scheduledAt.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

    const message = appointment.noShowProbability > 0.7
      ? `Hi ${appointment.patient.firstName}, this is Smart DentalOps. Important: Please confirm your appointment on ${date} at ${time} with ${appointment.provider.name}. Reply YES to confirm.`
      : `Hi ${appointment.patient.firstName}, reminder from Smart DentalOps: Your appointment is on ${date} at ${time} with ${appointment.provider.name}. See you soon!`;

    await sendSMS(appointment.patient.phone, message);

    // Mark reminder sent
    await prisma.appointment.update({
      where: { id: appointment.id },
      data: { reminderSent: true },
    });

    res.json({ success: true, message: `WhatsApp reminder sent to ${appointment.patient.phone}` });
  } catch (err) {
    console.error(`[SMS] Manual reminder failed: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

// ── Twilio inbound webhook ────────────────────────────────────────────────────
router.post('/reply', async (req, res) => {
  const from = req.body.From;
  const body = (req.body.Body || '').trim();
  const upper = body.toUpperCase();

  if (!from) return res.status(400).send('Missing From');

  try {
    const normalised = from.replace(/^whatsapp:/, '').replace(/^\+/, '');
    console.log(`[WhatsApp] Inbound from: "${from}" | normalised: "${normalised}" | body: "${body}"`);
    const patient = await prisma.patient.findFirst({
      where: {
        phone: {
          in: [
            normalised,
            `+${normalised}`,
            from,
            from.replace(/^whatsapp:/, ''),
          ]
        }
      },
    });
    console.log(`[WhatsApp] Patient lookup result: ${patient ? `${patient.firstName} ${patient.lastName}` : 'NOT FOUND'}`);

    // ── Booking flow — takes priority over other handlers ─────────────────────
    const bookingReply = await handleBookingFlow(
      `+${normalised}`,
      body,
      patient
    );
    if (bookingReply) {
      if (patient?.phone) await sendSMS(patient.phone, bookingReply);
      else await sendSMS(`+${normalised}`, bookingReply);
      res.setHeader('Content-Type', 'text/xml');
      return res.send('<?xml version="1.0"?><Response></Response>');
    }

    // ── Run NLP + intent in parallel ─────────────────────────────────────────
    const [sentiment, intent] = await Promise.all([
      getSentiment(body),
      Promise.resolve(detectIntent(body)),
    ]);

    // ── No-show prediction from message context ───────────────────────────────
    let noShowRisk = null;
    let noShowProbability = null;
    if (patient) {
      const nextAppt = await prisma.appointment.findFirst({
        where: { patientId: patient.id, scheduledAt: { gte: new Date() }, status: { in: ['SCHEDULED', 'CONFIRMED'] } },
        orderBy: { scheduledAt: 'asc' },
      });
      if (nextAppt) {
        const prediction = await predictNoShowANN(patient, nextAppt.scheduledAt.toISOString()).catch(() => null);
        if (prediction) {
          noShowRisk = prediction.risk;
          noShowProbability = prediction.probability;
        }
      }
    }

    // ── Log to Communications table ───────────────────────────────────────────
    if (patient) {
      await prisma.communication.create({
        data: {
          patientId: patient.id,
          channel:   'WhatsApp',
          direction: 'INBOUND',
          message:   body,
          sentiment,
          intent,
        },
      });
      console.log(`[WhatsApp] Logged | sentiment: ${sentiment} | intent: ${intent} | no-show risk: ${noShowRisk ?? 'N/A'}`);
    } else {
      console.warn(`[WhatsApp] Unknown number ${from} — message not logged`);
    }

    // ── Smart contextual reply ────────────────────────────────────────────────
    let replyMessage = null;

    if (upper === 'YES' && patient) {
      // Confirm appointment
      const appointment = await prisma.appointment.findFirst({
        where: { patientId: patient.id, scheduledAt: { gte: new Date() }, status: { in: ['SCHEDULED', 'CONFIRMED'] }, confirmed: false },
        orderBy: { scheduledAt: 'asc' },
      });
      if (appointment) {
        await prisma.appointment.update({ where: { id: appointment.id }, data: { confirmed: true, status: 'CONFIRMED' } });
        const time = appointment.scheduledAt.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
        const date = appointment.scheduledAt.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
        replyMessage = `✅ Thank you ${patient.firstName}! Your appointment on ${date} at ${time} is confirmed. See you then!`;
        console.log(`[WhatsApp] Appointment ${appointment.id} confirmed`);
      } else {
        replyMessage = `Hi ${patient.firstName}, we couldn't find an upcoming appointment to confirm. Please call us.`;
      }

    } else if (upper === 'NO' && patient) {
      replyMessage = `Hi ${patient.firstName}, no problem. Please call us to reschedule your appointment.`;

    } else if (patient && intent === 'CANCELLATION') {
      replyMessage = `Hi ${patient.firstName}, we received your cancellation request. Please call us or reply with your preferred reschedule time.`;

    } else if (patient && intent === 'BOOKING') {
      replyMessage = `Hi ${patient.firstName}, to book an appointment please call us or visit our clinic. We'll be happy to help!`;

    } else if (patient && intent === 'EMERGENCY') {
      replyMessage = `🚨 Hi ${patient.firstName}, we've noted your urgent message. Please call us immediately or visit the clinic. We're here to help!`;

    } else if (patient && sentiment === 'NEGATIVE') {
      // Negative sentiment — empathetic response
      replyMessage = `Hi ${patient.firstName}, we're sorry to hear that. Please call us so we can address your concerns right away.`;

    } else if (patient && noShowRisk === 'HIGH') {
      // High no-show risk — proactive re-engagement
      replyMessage = `Hi ${patient.firstName}, just checking in! Your upcoming appointment is important. Reply YES to confirm or call us to reschedule.`;
    }

    // Send reply if we have one
    if (replyMessage && patient?.phone) {
      await sendSMS(patient.phone, replyMessage);
    }

    res.setHeader('Content-Type', 'text/xml');
    res.send('<?xml version="1.0"?><Response></Response>');
  } catch (err) {
    console.error(`[WhatsApp] Reply handler error: ${err.message}`);
    res.status(500).send('Error');
  }
});

module.exports = router;
