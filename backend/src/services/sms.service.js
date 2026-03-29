/**
 * SMS / WhatsApp Service — Twilio Integration
 * Sends via WhatsApp (sandbox-friendly for trial accounts).
 * To format: "whatsapp:+15551234567"
 */

const twilio = require('twilio');

const TWILIO_SID   = process.env.TWILIO_SID;
const TWILIO_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const TWILIO_FROM  = process.env.TWILIO_PHONE; // e.g. +14155238886 (WhatsApp sandbox number)

let client = null;
function getClient() {
  if (!client) {
    if (!TWILIO_SID || !TWILIO_TOKEN) {
      throw new Error('TWILIO_SID and TWILIO_AUTH_TOKEN must be set in .env');
    }
    client = twilio(TWILIO_SID, TWILIO_TOKEN);
  }
  return client;
}

/**
 * Send a WhatsApp message via Twilio sandbox.
 *
 * @param {string} to      - Phone number e.g. "+15551234567" (whatsapp: prefix added automatically)
 * @param {string} message - Message body
 * @returns {Promise<string>} Twilio message SID
 */
async function sendSMS(to, message) {
  if (!to) throw new Error('Recipient phone number is required');
  if (!TWILIO_FROM) throw new Error('TWILIO_PHONE must be set in .env');

  // Normalise number — strip whatsapp: prefix if already present, then re-add
  const normalised = to.replace(/^whatsapp:/, '');
  const toWA   = `whatsapp:${normalised}`;
  const fromWA = `whatsapp:${TWILIO_FROM}`;

  try {
    const msg = await getClient().messages.create({
      body: message,
      from: fromWA,
      to:   toWA,
    });
    console.log(`[WhatsApp] Sent to ${toWA} | SID: ${msg.sid}`);
    return msg.sid;
  } catch (err) {
    console.error(`[WhatsApp] Failed to send to ${toWA}: ${err.message}`);
    throw err;
  }
}

module.exports = { sendSMS };
