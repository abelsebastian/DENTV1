/**
 * Meta WhatsApp Cloud API Webhook
 *
 * Inbound pipeline:
 *   1. Extract message from Meta payload
 *   2. Find patient by phone
 *   3. Booking flow (if triggered)
 *   4. Sentiment analysis (NLP service)
 *   5. Intent detection (rule-based)
 *   6. No-show prediction (ANN)
 *   7. Sentiment → no-show risk adjustment
 *   8. Log to Communications with full context
 *   9. Update patient noShowCount if NEGATIVE + HIGH risk
 *  10. Smart contextual reply based on all signals
 */

const router = require('express').Router();
const { PrismaClient } = require('@prisma/client');
const { sendWhatsApp } = require('../services/metaWhatsapp.service');
const { getSentiment } = require('../services/nlpClient');
const { detectIntent } = require('../services/intelligence');
const { predictNoShowANN } = require('../services/mlClient');
const { handleBookingFlow } = require('../services/whatsappBooking');

const prisma = new PrismaClient();
const VERIFY_TOKEN = process.env.META_VERIFY_TOKEN || 'dental_verify_token';

// ── Webhook verification ──────────────────────────────────────────────────────
router.get('/webhook', (req, res) => {
  const mode      = req.query['hub.mode'];
  const token     = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === VERIFY_TOKEN) {
    console.log('[Meta] Webhook verified');
    return res.status(200).send(challenge);
  }
  res.sendStatus(403);
});

// ── Sentiment → risk adjustment ───────────────────────────────────────────────
/**
 * Adjusts ANN no-show probability based on message sentiment.
 * Negative sentiment increases risk, positive decreases it.
 *
 * Rules:
 *   NEGATIVE + HIGH   → keep HIGH, flag for staff attention
 *   NEGATIVE + MEDIUM → escalate to HIGH
 *   NEGATIVE + LOW    → escalate to MEDIUM
 *   POSITIVE + HIGH   → downgrade to MEDIUM (patient engaged)
 *   POSITIVE + MEDIUM → downgrade to LOW
 *   NEUTRAL           → no change
 */
function adjustRiskBySentiment(risk, sentiment) {
  if (sentiment === 'NEGATIVE') {
    if (risk === 'LOW')    return 'MEDIUM';
    if (risk === 'MEDIUM') return 'HIGH';
    return 'HIGH'; // already HIGH
  }
  if (sentiment === 'POSITIVE') {
    if (risk === 'HIGH')   return 'MEDIUM';
    if (risk === 'MEDIUM') return 'LOW';
    return 'LOW'; // already LOW
  }
  return risk; // NEUTRAL — no change
}

// ── Build smart reply ─────────────────────────────────────────────────────────
function buildReply(patient, upper, intent, sentiment, adjustedRisk, noShowProbability, nextAppt) {
  const name = patient?.firstName || 'there';

  // Priority 1: Direct YES/NO responses
  if (upper === 'YES') return null; // handled separately (needs DB update)
  if (upper === 'NO')  return `Hi ${name}, no problem. Please call us to reschedule your appointment.`;

  // Priority 2: Emergency — always respond immediately
  if (intent === 'EMERGENCY') {
    return `🚨 Hi ${name}, we've noted your urgent message. Please call us immediately or visit the clinic. We're here to help!`;
  }

  // Priority 3: Cancellation intent
  if (intent === 'CANCELLATION') {
    return `Hi ${name}, we received your cancellation request. Please call us or reply with your preferred reschedule date.`;
  }

  // Priority 4: Negative sentiment — empathetic response
  if (sentiment === 'NEGATIVE') {
    if (adjustedRisk === 'HIGH') {
      return `Hi ${name}, we're sorry to hear that. We also noticed your upcoming appointment may be at risk. Please call us — we'd love to help resolve any concerns.`;
    }
    return `Hi ${name}, we're sorry to hear that. Please call us so we can address your concerns right away.`;
  }

  // Priority 5: High no-show risk (after sentiment adjustment) — re-engagement
  if (adjustedRisk === 'HIGH' && nextAppt) {
    const date = nextAppt.scheduledAt.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
    const time = nextAppt.scheduledAt.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
    const pct  = Math.round(noShowProbability * 100);
    return `Hi ${name}, just checking in! Your appointment is on ${date} at ${time}. Reply *YES* to confirm or *NO* to reschedule. (Risk: ${pct}%)`;
  }

  // Priority 6: Booking intent
  if (intent === 'BOOKING') {
    return `Hi ${name}! To book an appointment, reply *BOOK* and we'll guide you through the process. 🦷`;
  }

  // Priority 7: Billing intent
  if (intent === 'BILLING') {
    return `Hi ${name}, for billing queries please call us or visit the clinic. We'll be happy to help!`;
  }

  // Priority 8: Positive sentiment — acknowledge
  if (sentiment === 'POSITIVE') {
    return `Thank you ${name}! 😊 We're glad to hear that. See you at your next appointment!`;
  }

  return null; // no auto-reply for general messages
}

// ── Inbound messages ──────────────────────────────────────────────────────────
router.post('/webhook', async (req, res) => {
  res.sendStatus(200); // Acknowledge immediately — Meta requires 200 within 5s

  try {
    const entry   = req.body?.entry?.[0];
    const changes = entry?.changes?.[0];
    const value   = changes?.value;

    if (!value?.messages?.length) return; // status updates, not messages

    const msg  = value.messages[0];
    const from = `+${msg.from}`;
    const body = msg.text?.body?.trim() || '';
    const upper = body.toUpperCase();

    console.log(`[Meta WhatsApp] Inbound from ${from}: "${body}"`);

    // ── 1. Find patient ───────────────────────────────────────────────────────
    const patient = await prisma.patient.findFirst({
      where: { phone: { in: [from, msg.from, `+${msg.from}`] } },
    });

    // ── 2. Booking flow (takes priority) ─────────────────────────────────────
    const bookingReply = await handleBookingFlow(from, body, patient);
    if (bookingReply) {
      await sendWhatsApp(from, bookingReply);
      return;
    }

    // ── 3. Run NLP sentiment + intent in parallel ─────────────────────────────
    const [sentiment, intent] = await Promise.all([
      getSentiment(body),
      Promise.resolve(detectIntent(body)),
    ]);

    // ── 4. ANN no-show prediction for next appointment ────────────────────────
    let noShowProbability = 0;
    let noShowRisk        = 'LOW';
    let nextAppt          = null;

    if (patient) {
      nextAppt = await prisma.appointment.findFirst({
        where: {
          patientId:   patient.id,
          scheduledAt: { gte: new Date() },
          status:      { in: ['SCHEDULED', 'CONFIRMED'] },
        },
        orderBy: { scheduledAt: 'asc' },
      });

      if (nextAppt) {
        const pred = await predictNoShowANN(patient, nextAppt.scheduledAt.toISOString()).catch(() => null);
        if (pred) {
          noShowProbability = pred.probability;
          noShowRisk        = pred.risk;
        }
      }
    }

    // ── 5. Adjust risk based on sentiment ─────────────────────────────────────
    const adjustedRisk = adjustRiskBySentiment(noShowRisk, sentiment);

    console.log(
      `[Meta WhatsApp] Analysis — sentiment: ${sentiment} | intent: ${intent} | ` +
      `no-show: ${noShowRisk} → adjusted: ${adjustedRisk} (${Math.round(noShowProbability * 100)}%)`
    );

    // ── 6. Log to Communications with full context ────────────────────────────
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

      // Update appointment noShowProbability if risk escalated by sentiment
      if (nextAppt && adjustedRisk !== noShowRisk) {
        const adjustedProbability = adjustedRisk === 'HIGH'   ? Math.max(noShowProbability, 0.56)
                                  : adjustedRisk === 'MEDIUM' ? Math.max(noShowProbability, 0.31)
                                  : Math.min(noShowProbability, 0.29);

        await prisma.appointment.update({
          where: { id: nextAppt.id },
          data:  { noShowProbability: adjustedProbability },
        });

        console.log(`[Meta WhatsApp] Updated appointment ${nextAppt.id} noShowProbability: ${noShowProbability.toFixed(2)} → ${adjustedProbability.toFixed(2)}`);
      }
    }

    // ── 7. Handle YES confirmation ────────────────────────────────────────────
    if (upper === 'YES' && patient) {
      const appt = await prisma.appointment.findFirst({
        where: {
          patientId:   patient.id,
          scheduledAt: { gte: new Date() },
          status:      { in: ['SCHEDULED', 'CONFIRMED'] },
          confirmed:   false,
        },
        orderBy: { scheduledAt: 'asc' },
      });

      if (appt) {
        await prisma.appointment.update({
          where: { id: appt.id },
          data:  { confirmed: true, status: 'CONFIRMED', noShowProbability: Math.min(noShowProbability * 0.5, 0.29) },
        });
        const date = appt.scheduledAt.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
        const time = appt.scheduledAt.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
        await sendWhatsApp(from, `✅ Thank you ${patient.firstName}! Your appointment on ${date} at ${time} is confirmed. See you then!`);
        console.log(`[Meta WhatsApp] Appointment ${appt.id} confirmed — risk reduced`);
      } else {
        await sendWhatsApp(from, `Hi ${patient?.firstName || 'there'}, we couldn't find an upcoming appointment to confirm. Please call us.`);
      }
      return;
    }

    // ── 8. Build and send smart reply ─────────────────────────────────────────
    const reply = buildReply(patient, upper, intent, sentiment, adjustedRisk, noShowProbability, nextAppt);
    if (reply) {
      await sendWhatsApp(from, reply);
    }

  } catch (err) {
    console.error('[Meta WhatsApp] Webhook error:', err.message);
  }
});

module.exports = router;
