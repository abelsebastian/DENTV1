/**
 * Meta WhatsApp Cloud API Service
 * Replaces Twilio — sends messages directly via Meta's Graph API.
 * No sandbox restrictions, no Twilio account needed.
 */

const axios = require('axios');

const META_TOKEN    = process.env.META_ACCESS_TOKEN;
const PHONE_NUM_ID  = process.env.META_PHONE_NUMBER_ID;
const API_URL       = `https://graph.facebook.com/v19.0/${PHONE_NUM_ID}/messages`;

/**
 * Send a WhatsApp text message via Meta Cloud API.
 *
 * @param {string} to      - E.164 phone number e.g. "+917736569176"
 * @param {string} message - Message body text
 * @returns {Promise<string>} Meta message ID
 */
async function sendWhatsApp(to, message) {
  if (!META_TOKEN || !PHONE_NUM_ID) {
    throw new Error('META_ACCESS_TOKEN and META_PHONE_NUMBER_ID must be set in .env');
  }

  // Meta requires phone without + prefix
  const phone = to.replace(/^\+/, '');

  try {
    const { data } = await axios.post(
      API_URL,
      {
        messaging_product: 'whatsapp',
        to: phone,
        type: 'text',
        text: { body: message },
      },
      {
        headers: {
          Authorization: `Bearer ${META_TOKEN}`,
          'Content-Type': 'application/json',
        },
        timeout: 5000,
      }
    );

    const msgId = data.messages?.[0]?.id;
    console.log(`[Meta WhatsApp] Sent to ${to} | ID: ${msgId}`);
    return msgId;
  } catch (err) {
    const detail = err.response?.data?.error?.message || err.message;
    console.error(`[Meta WhatsApp] Failed to send to ${to}: ${detail}`);
    throw err;
  }
}

module.exports = { sendWhatsApp };
