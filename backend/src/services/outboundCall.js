/**
 * Outbound Call Service — Initiates AI voice calls via Twilio.
 *
 * Used after WhatsApp booking to confirm appointment via voice.
 * Twilio calls the patient, then hits /api/voice/outbound-connect
 * which starts the AI conversation.
 */

const twilio = require('twilio');

const TWILIO_SID   = process.env.TWILIO_SID;
const TWILIO_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const TWILIO_PHONE = process.env.TWILIO_PHONE;
const BASE_URL     = process.env.FRONTEND_URL || 'https://mainproject.thebuilderloop.space';

let client = null;
function getClient() {
  if (!client) client = twilio(TWILIO_SID, TWILIO_TOKEN);
  return client;
}

/**
 * Initiate an outbound confirmation call after WhatsApp booking.
 *
 * @param {object} params
 * @param {string} params.phone        - Patient phone (E.164 format)
 * @param {string} params.patientName  - Patient first name
 * @param {string} params.procedure    - Procedure booked
 * @param {string} params.date         - Formatted date string
 * @param {string} params.time         - Formatted time string
 * @param {string} params.providerName - Doctor name
 * @param {string} params.appointmentId - Appointment ID
 */
async function initiateConfirmationCall({
  phone,
  patientName,
  procedure,
  date,
  time,
  providerName,
  appointmentId,
}) {
  if (!TWILIO_SID || !TWILIO_TOKEN || !TWILIO_PHONE) {
    console.warn('[OutboundCall] Twilio credentials not configured — skipping call');
    return null;
  }

  // Encode appointment details in the URL so the TwiML webhook can use them
  const params = new URLSearchParams({
    patientName,
    procedure,
    date,
    time,
    providerName,
    appointmentId,
  });

  try {
    const call = await getClient().calls.create({
      to: phone,
      from: TWILIO_PHONE,
      url: `${BASE_URL}/api/voice/outbound-connect?${params.toString()}`,
      statusCallback: `${BASE_URL}/api/voice/status`,
      statusCallbackEvent: ['completed', 'no-answer', 'busy', 'failed'],
      method: 'POST',
      timeout: 30, // ring for 30 seconds max
    });

    console.log(`[OutboundCall] Initiated call to ${phone} | SID: ${call.sid} | Appointment: ${appointmentId}`);
    return call.sid;
  } catch (err) {
    console.error(`[OutboundCall] Failed to call ${phone}: ${err.message}`);
    return null;
  }
}

module.exports = { initiateConfirmationCall };
