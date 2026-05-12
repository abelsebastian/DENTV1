/**
 * Razorpay Payment Link Service
 *
 * Creates payment links via Razorpay API and sends them to patients via WhatsApp.
 * Uses Razorpay Test/Sandbox keys for development.
 */

const Razorpay = require('razorpay');
const { sendWhatsApp } = require('./metaWhatsapp.service');

const RAZORPAY_KEY_ID     = process.env.RAZORPAY_KEY_ID;
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET;

let razorpay = null;

function getInstance() {
  if (!razorpay && RAZORPAY_KEY_ID && RAZORPAY_KEY_SECRET) {
    razorpay = new Razorpay({
      key_id: RAZORPAY_KEY_ID,
      key_secret: RAZORPAY_KEY_SECRET,
    });
  }
  return razorpay;
}

// Procedure pricing (INR)
const PROCEDURE_PRICES = {
  'Checkup':     500,
  'Cleaning':    1000,
  'Filling':     2000,
  'Root Canal':  5000,
  'Extraction':  3000,
  'Crown':       8000,
};

/**
 * Create a Razorpay payment link for an appointment.
 *
 * @param {object} params
 * @param {string} params.patientName  - Patient full name
 * @param {string} params.phone        - Patient phone (E.164)
 * @param {string} params.procedure    - Procedure name
 * @param {string} params.appointmentId - Appointment ID for reference
 * @param {number} params.amount       - Amount in INR (optional, auto-calculated from procedure)
 * @returns {Promise<{paymentLinkId: string, shortUrl: string, amount: number}>}
 */
async function createPaymentLink({ patientName, phone, procedure, appointmentId, amount }) {
  const instance = getInstance();
  if (!instance) {
    console.warn('[Razorpay] Not configured — skipping payment link');
    return null;
  }

  const finalAmount = amount || PROCEDURE_PRICES[procedure] || 1000;

  try {
    const link = await instance.paymentLink.create({
      amount: finalAmount * 100, // Razorpay expects paise
      currency: 'INR',
      description: `Smart DentalOps — ${procedure} appointment`,
      customer: {
        name: patientName,
        contact: phone,
      },
      notify: {
        sms: false,    // We send via WhatsApp ourselves
        email: false,
      },
      reminder_enable: false,
      notes: {
        appointmentId,
        procedure,
      },
      callback_url: process.env.FRONTEND_URL || 'https://mainproject.thebuilderloop.space',
      callback_method: 'get',
    });

    console.log(`[Razorpay] Payment link created: ${link.short_url} | Amount: ₹${finalAmount} | Appointment: ${appointmentId}`);

    return {
      paymentLinkId: link.id,
      shortUrl: link.short_url,
      amount: finalAmount,
    };
  } catch (err) {
    console.error(`[Razorpay] Failed to create payment link: ${err.message}`);
    return null;
  }
}

/**
 * Create payment link and send it to patient via WhatsApp.
 *
 * @param {object} params - Same as createPaymentLink
 * @returns {Promise<{paymentLinkId: string, shortUrl: string, amount: number} | null>}
 */
async function sendPaymentLinkViaWhatsApp({ patientName, phone, procedure, appointmentId, amount }) {
  const result = await createPaymentLink({ patientName, phone, procedure, appointmentId, amount });
  if (!result) return null;

  const message = `💳 *Payment for your appointment*\n\n` +
    `Procedure: ${procedure}\n` +
    `Amount: ₹${result.amount}\n\n` +
    `Pay securely here:\n${result.shortUrl}\n\n` +
    `This is a one-time payment link. You can pay now or at the clinic.`;

  try {
    await sendWhatsApp(phone, message);
    console.log(`[Razorpay] Payment link sent via WhatsApp to ${phone}`);
  } catch (err) {
    console.warn(`[Razorpay] WhatsApp send failed (link still valid): ${err.message}`);
  }

  return result;
}

module.exports = { createPaymentLink, sendPaymentLinkViaWhatsApp, PROCEDURE_PRICES };
