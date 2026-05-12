/**
 * Voice Routes — Twilio inbound call webhooks.
 *
 * Flow:
 *   1. /inbound   — Twilio calls this when someone dials your number
 *   2. /gather    — Twilio calls this with the transcribed speech
 *   3. /status    — Twilio calls this when the call ends
 *
 * No auth middleware — Twilio webhooks are unauthenticated (validated by signature in production).
 */

const router = require('express').Router();
const { getSession, generateResponse, endSession } = require('../services/voiceAgent');

/**
 * POST /api/voice/inbound
 * Called by Twilio when an inbound call arrives.
 * Responds with TwiML: greet + start listening.
 */
router.post('/inbound', (req, res) => {
  const { CallSid, From, To } = req.body;
  console.log(`[Voice] Inbound call from ${From} to ${To} | CallSid: ${CallSid}`);

  // Initialize session
  getSession(CallSid, From);

  // TwiML: greet and start gathering speech
  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Aditi">Hello! Thank you for calling Smart DentalOps. How can I help you today?</Say>
  <Gather input="speech" action="/api/voice/gather" method="POST" speechTimeout="3" language="en-IN">
    <Say voice="Polly.Aditi">You can ask about appointments, cancellations, clinic hours, or anything else.</Say>
  </Gather>
  <Say voice="Polly.Aditi">I did not hear anything. Goodbye!</Say>
</Response>`;

  res.type('text/xml').send(twiml);
});

/**
 * POST /api/voice/gather
 * Called by Twilio after speech is transcribed.
 * Processes the text, generates AI response, continues the conversation.
 */
router.post('/gather', async (req, res) => {
  const { CallSid, From, SpeechResult, Confidence } = req.body;
  const speechText = SpeechResult || '';

  console.log(`[Voice] Speech from ${From}: "${speechText}" (confidence: ${Confidence})`);

  if (!speechText.trim()) {
    const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Aditi">Sorry, I did not catch that. Could you please repeat?</Say>
  <Gather input="speech" action="/api/voice/gather" method="POST" speechTimeout="3" language="en-IN" />
  <Say voice="Polly.Aditi">I still could not hear you. Please call back if you need help. Goodbye!</Say>
</Response>`;
    return res.type('text/xml').send(twiml);
  }

  const session = getSession(CallSid, From);
  const response = await generateResponse(speechText, session);

  // Check if conversation should end
  if (session.ended) {
  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Aditi">${escapeXml(response)}</Say>
  <Hangup />
</Response>`;
    // Log the call
    endSession(CallSid);
    return res.type('text/xml').send(twiml);
  }

  // Continue conversation — speak response then listen again
  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Aditi">${escapeXml(response)}</Say>
  <Gather input="speech" action="/api/voice/gather" method="POST" speechTimeout="3" language="en-IN" />
  <Say voice="Polly.Aditi">Are you still there? If you need anything else, please speak now.</Say>
  <Gather input="speech" action="/api/voice/gather" method="POST" speechTimeout="3" language="en-IN" />
  <Say voice="Polly.Aditi">Goodbye! Thank you for calling Smart DentalOps.</Say>
</Response>`;

  res.type('text/xml').send(twiml);
});

/**
 * POST /api/voice/outbound-connect
 * Called by Twilio when an outbound confirmation call connects.
 * Reads appointment details from query params, confirms with patient.
 */
router.post('/outbound-connect', (req, res) => {
  const { patientName, procedure, date, time, providerName } = req.query;
  const { CallSid, To } = req.body;

  console.log(`[Voice] Outbound call connected to ${To} | CallSid: ${CallSid}`);

  // Initialize session for this outbound call
  getSession(CallSid, To);

  const greeting = `Hello ${patientName || 'there'}! This is Smart DentalOps calling to confirm your appointment. ` +
    `You have a ${procedure || 'dental'} appointment on ${date || 'your scheduled date'} at ${time || 'your scheduled time'} ` +
    `with ${providerName || 'your dentist'}. ` +
    `Is there anything you would like to ask about your upcoming visit?`;

  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Say voice="Polly.Aditi">${escapeXml(greeting)}</Say>
  <Gather input="speech" action="/api/voice/gather" method="POST" speechTimeout="3" language="en-IN">
    <Say voice="Polly.Aditi">You can ask about preparation instructions, clinic location, or say goodbye if everything is clear.</Say>
  </Gather>
  <Say voice="Polly.Aditi">Thank you for confirming. See you at your appointment. Goodbye!</Say>
</Response>`;

  res.type('text/xml').send(twiml);
});

/**
 * POST /api/voice/status
 * Called by Twilio when call status changes (completed, no-answer, etc.)
 * Used to finalize and log the call.
 */
router.post('/status', async (req, res) => {
  const { CallSid, CallStatus, CallDuration } = req.body;
  console.log(`[Voice] Call ${CallSid} status: ${CallStatus} | duration: ${CallDuration}s`);

  if (['completed', 'no-answer', 'busy', 'failed', 'canceled'].includes(CallStatus)) {
    await endSession(CallSid);
  }

  res.sendStatus(200);
});

/** Escape special XML characters for TwiML */
function escapeXml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

module.exports = router;
