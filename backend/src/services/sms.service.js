/**
 * SMS / WhatsApp Service
 * Uses Meta WhatsApp Cloud API if META_ACCESS_TOKEN is set.
 * Falls back to Twilio sandbox if not.
 */

const twilio = require('twilio');
const { sendWhatsApp: metaSend } = require('./metaWhatsapp.service');

const TWILIO_SID   = process.env.TWILIO_SID;
const TWILIO_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const TWILIO_FROM  = process.env.TWILIO_PHONE;

let twilioClient = null;
function getTwilioClient() {
  if (!twilioClient) twilioClient = twilio(TWILIO_SID, TWILIO_TOKEN);
  return twilioClient;
}

/**
 * Send a WhatsApp message.
 * Automatically uses Meta Cloud API if META_ACCESS_TOKEN is set,
 * otherwise falls back to Twilio sandbox.
 */
async function sendSMS(to, message) {
  if (!to) throw new Error('Recipient phone number is required');

  // Meta Cloud API (production)
  if (process.env.META_ACCESS_TOKEN && process.env.META_PHONE_NUMBER_ID) {
    return metaSend(to, message);
  }

  // Twilio sandbox (development fallback)
  const normalised = to.replace(/^whatsapp:/, '');
  const toWA   = `whatsapp:${normalised}`;
  const fromWA = `whatsapp:${TWILIO_FROM}`;

  try {
    const msg = await getTwilioClient().messages.create({ body: message, from: fromWA, to: toWA });
    console.log(`[Twilio WhatsApp] Sent to ${toWA} | SID: ${msg.sid}`);
    return msg.sid;
  } catch (err) {
    console.error(`[Twilio WhatsApp] Failed to send to ${toWA}: ${err.message}`);
    throw err;
  }
}

module.exports = { sendSMS };
