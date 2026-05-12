/**
 * Voice Agent — AI-powered conversational voice agent for inbound calls.
 *
 * Uses Twilio <Gather speech> for STT, <Say> for TTS.
 * Intent detection via intelligence.js, sentiment via NLP service.
 * Logs full transcript to Communications table.
 */

const { PrismaClient } = require('@prisma/client');
const { detectIntent, analyzeSentiment } = require('./intelligence');
const { getSentiment } = require('./nlpClient');

const prisma = new PrismaClient();

// In-memory call sessions (keyed by CallSid)
const sessions = new Map();

/**
 * Get or create a call session.
 */
function getSession(callSid, from) {
  if (!sessions.has(callSid)) {
    sessions.set(callSid, {
      callSid,
      from,
      transcript: [],
      startedAt: new Date(),
      patientId: null,
    });
  }
  return sessions.get(callSid);
}

/**
 * Generate AI response based on what the patient said.
 * Uses your existing intent detection + contextual replies.
 */
async function generateResponse(speechText, session) {
  const intent = detectIntent(speechText);
  const lower = speechText.toLowerCase();

  // Track transcript
  session.transcript.push({ role: 'patient', text: speechText, intent, timestamp: new Date() });

  let response;

  switch (intent) {
    case 'BOOKING':
      response = 'I can help you book an appointment. Could you tell me which day and time works best for you? We have slots available Monday through Saturday, 8 AM to 6 PM.';
      break;

    case 'CANCELLATION':
      response = 'I understand you want to cancel or reschedule. Could you tell me your name so I can look up your appointment?';
      break;

    case 'EMERGENCY':
      response = 'I understand this is urgent. Please come to the clinic immediately or call emergency services if needed. I am noting this as a priority case. Is there anything else I can help with?';
      break;

    case 'BILLING':
      response = 'For billing inquiries, I can check your balance. Could you tell me your name so I can look up your account?';
      break;

    default:
      // General / greeting / unknown
      if (lower.includes('hello') || lower.includes('hi') || lower.includes('hey')) {
        response = 'Hello! Welcome to Smart DentalOps. I can help you book an appointment, check your upcoming visits, or answer questions about our services. How can I help you today?';
      } else if (lower.includes('hours') || lower.includes('open') || lower.includes('time')) {
        response = 'Our clinic is open Monday through Saturday, 8 AM to 6 PM. We are closed on Sundays. Would you like to book an appointment?';
      } else if (lower.includes('bye') || lower.includes('goodbye') || lower.includes('thank')) {
        response = 'Thank you for calling Smart DentalOps. Have a great day! Goodbye.';
        session.ended = true;
      } else if (lower.includes('yes') || lower.includes('confirm')) {
        response = 'Great, confirmed! Is there anything else I can help you with?';
      } else if (lower.includes('no')) {
        response = 'Alright. If you need anything else, just call us back. Have a good day!';
        session.ended = true;
      } else {
        response = 'I am not sure I understood that. Could you please repeat? I can help with booking appointments, cancellations, or general clinic information.';
      }
  }

  session.transcript.push({ role: 'agent', text: response, timestamp: new Date() });
  return response;
}

/**
 * End a call session — log transcript to DB with sentiment analysis.
 */
async function endSession(callSid) {
  const session = sessions.get(callSid);
  if (!session) return;

  try {
    // Find patient by phone
    const normalised = session.from.replace(/^\+/, '');
    const patient = await prisma.patient.findFirst({
      where: {
        phone: { in: [normalised, `+${normalised}`, session.from] },
      },
    });

    // Build full transcript text
    const fullText = session.transcript
      .map((t) => `${t.role === 'patient' ? 'Patient' : 'Agent'}: ${t.text}`)
      .join('\n');

    // Get sentiment of patient messages
    const patientMessages = session.transcript
      .filter((t) => t.role === 'patient')
      .map((t) => t.text)
      .join('. ');

    let sentiment = 'NEUTRAL';
    if (patientMessages) {
      try {
        sentiment = await getSentiment(patientMessages);
      } catch {
        sentiment = analyzeSentiment(patientMessages);
      }
    }

    // Detect primary intent from all patient messages
    const primaryIntent = detectIntent(patientMessages);

    // Log to Communications table
    if (patient) {
      await prisma.communication.create({
        data: {
          patientId: patient.id,
          channel: 'Voice',
          direction: 'INBOUND',
          message: fullText,
          sentiment,
          intent: primaryIntent,
        },
      });
      console.log(`[VoiceAgent] Call logged for ${patient.firstName} ${patient.lastName} | sentiment: ${sentiment} | intent: ${primaryIntent}`);
    } else {
      console.log(`[VoiceAgent] Call from unknown number ${session.from} — not logged to patient`);
    }
  } catch (err) {
    console.error(`[VoiceAgent] Failed to log call: ${err.message}`);
  } finally {
    sessions.delete(callSid);
  }
}

module.exports = { getSession, generateResponse, endSession };
