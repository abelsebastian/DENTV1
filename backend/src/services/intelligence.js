/**
 * Intelligence Engine
 *
 * Combines ML microservice predictions with rule-based fallback.
 * All functions are pure and independently testable.
 *
 * Primary entry point: getNoShowRisk(data)
 */

const axios = require('axios');

const ML_SERVICE_URL = process.env.ML_SERVICE_URL || 'http://localhost:8000';

// Axios instance — shared, pre-configured, 2s timeout
const mlAxios = axios.create({
  baseURL: ML_SERVICE_URL,
  timeout: 2000,
  headers: { 'Content-Type': 'application/json' },
});

// ── Risk classification ────────────────────────────────────────────────────────

/**
 * Convert a raw probability to a risk label.
 * @param {number} probability
 * @returns {'LOW' | 'MEDIUM' | 'HIGH'}
 */
function classifyRisk(probability) {
  if (probability >= 0.55) return 'HIGH';
  if (probability >= 0.30) return 'MEDIUM';
  return 'LOW';
}

// ── Rule-based scoring ─────────────────────────────────────────────────────────

/**
 * Rule-based no-show probability from patient history.
 * Used as fallback when the ML service is unavailable.
 * @param {object} patient - Prisma patient record
 * @returns {number} probability 0–1
 */
function ruleBasedNoShowScore(patient) {
  if (!patient) return 0.2;
  const rate = patient.totalAppointments > 0
    ? patient.noShowCount / patient.totalAppointments
    : 0;
  // 70% weight on history rate + 10% base
  return Math.min(parseFloat((rate * 0.7 + 0.1).toFixed(2)), 1);
}

// ── ML payload builder ─────────────────────────────────────────────────────────

/**
 * Build the feature payload expected by the ML microservice.
 * @param {object} patient
 * @param {string} scheduledAt - ISO datetime
 * @returns {{ age, lead_time, previous_no_shows, appointment_day }}
 */
function buildMLPayload(patient, scheduledAt) {
  const apptDate = new Date(scheduledAt);

  // JS getDay(): 0=Sun → convert to Mon-based: 0=Mon … 6=Sun
  const jsDay = apptDate.getDay();
  const appointment_day = jsDay === 0 ? 6 : jsDay - 1;

  const age = patient?.dateOfBirth
    ? Math.floor((Date.now() - new Date(patient.dateOfBirth)) / (365.25 * 24 * 3600 * 1000))
    : 35;

  const lead_time = Math.max(
    0,
    Math.round((apptDate.getTime() - Date.now()) / (24 * 3600 * 1000))
  );

  return {
    age,
    lead_time,
    previous_no_shows: patient?.noShowCount ?? 0,
    appointment_day,
  };
}

// ── Primary export: getNoShowRisk ──────────────────────────────────────────────

/**
 * Get no-show risk by calling the ML microservice first.
 * Automatically falls back to rule-based scoring on any failure.
 *
 * @param {{ patient: object, scheduledAt: string }} data
 * @returns {Promise<{ probability: number, risk: string, source: string }>}
 *
 * @example
 * const { probability, risk, source } = await getNoShowRisk({
 *   patient: { noShowCount: 3, totalAppointments: 10, dateOfBirth: '1990-01-01' },
 *   scheduledAt: '2026-04-15T09:00:00',
 * });
 * // ML up:   { probability: 0.62, risk: 'HIGH',   source: 'ml' }
 * // ML down: { probability: 0.31, risk: 'MEDIUM', source: 'rule-based' }
 */
async function getNoShowRisk({ patient, scheduledAt }) {
  // ── Step 1: Try ML microservice ──────────────────────────────────────────
  try {
    const payload = buildMLPayload(patient, scheduledAt);
    const { data } = await mlAxios.post('/predict/no-show', payload);

    return {
      probability: data.probability,
      risk: data.risk,
      source: 'ml',
    };
  } catch (err) {
    // ── Step 2: Log reason, fall through to rule-based ───────────────────
    if (axios.isAxiosError(err)) {
      const reason =
        err.code === 'ECONNREFUSED' ? 'service not running' :
        err.code === 'ECONNABORTED' ? 'timeout' :
        `HTTP ${err.response?.status ?? 'unknown'}`;
      console.warn(`[intelligence] ML unavailable (${reason}) — using rule-based fallback`);
    } else {
      console.warn('[intelligence] Unexpected ML error — using rule-based fallback:', err.message);
    }
  }

  // ── Step 3: Rule-based fallback ──────────────────────────────────────────
  const probability = ruleBasedNoShowScore(patient);
  return {
    probability,
    risk: classifyRisk(probability),
    source: 'rule-based',
  };
}

// ── Remaining rule-based helpers (unchanged) ───────────────────────────────────

/** Recommend the best available slot based on no-show risk. */
function recommendSlot(noShowProbability, availableSlots) {
  if (!availableSlots?.length) return null;
  // High risk → earliest slot (minimise gap if they skip)
  if (noShowProbability > 0.5) return availableSlots[0];
  // Low risk → mid-day slot
  return availableSlots[Math.floor(availableSlots.length / 2)];
}

/** Predict treatment acceptance probability from cost + patient history. */
function predictAcceptance(estimatedCost, patient) {
  let base = 0.7;
  if (estimatedCost > 2000) base -= 0.2;
  else if (estimatedCost > 1000) base -= 0.1;
  if (patient?.noShowCount > 2) base -= 0.1;
  return Math.max(parseFloat(base.toFixed(2)), 0.1);
}

/** Keyword-based sentiment analysis (fallback for NLP service). */
function analyzeSentiment(message) {
  const text = message.toLowerCase();
  const positive = ['great', 'good', 'happy', 'satisfied', 'excellent', 'thanks', 'thank'];
  const negative = ['bad', 'pain', 'hurt', 'cancel', 'unhappy', 'disappointed', 'problem', 'issue'];
  const pos = positive.filter((w) => text.includes(w)).length;
  const neg = negative.filter((w) => text.includes(w)).length;
  if (neg > pos) return 'NEGATIVE';
  if (pos > neg) return 'POSITIVE';
  return 'NEUTRAL';
}

/** Keyword-based intent classification. */
function detectIntent(message) {
  const text = message.toLowerCase();
  if (text.includes('cancel') || text.includes('reschedule')) return 'CANCELLATION';
  if (text.includes('book') || text.includes('appointment') || text.includes('schedule')) return 'BOOKING';
  if (text.includes('payment') || text.includes('bill') || text.includes('invoice')) return 'BILLING';
  if (text.includes('pain') || text.includes('emergency') || text.includes('urgent')) return 'EMERGENCY';
  return 'GENERAL';
}

// Keep predictNoShow exported for backward compatibility (used in mlClient fallback)
const predictNoShow = ruleBasedNoShowScore;

// ── GA_OPTIMIZED slot recommendation ──────────────────────────────────────────

/**
 * Select the best slot using the Genetic Algorithm optimizer.
 * Falls back to SADNSOB (recommendSlot) if GA produces no result.
 *
 * @param {string[]} availableSlots     - ISO datetime strings
 * @param {{ id, duration, noShowProbability }[]} appointments
 * @param {number} targetAppointmentIdx - index of the appointment to schedule
 * @returns {{ slot_time: string, duration: number, optimization: string }}
 */
function recommendSlotGA(availableSlots, appointments, targetAppointmentIdx = 0) {
  try {
    const { optimizeSchedule } = require('./geneticScheduler');
    const { best_schedule, fitness_score } = optimizeSchedule(availableSlots, appointments);

    const entry = best_schedule[targetAppointmentIdx];
    if (!entry || !entry.slot) throw new Error('GA returned no valid slot');

    return {
      slot_time:    entry.slot,
      duration:     entry.duration,
      optimization: 'GA',
      fitness_score,
    };
  } catch (err) {
    console.warn(`[intelligence] GA optimization failed — falling back to SADNSOB: ${err.message}`);

    // SADNSOB fallback: use existing recommendSlot with a neutral probability
    const noShowProbability = appointments[targetAppointmentIdx]?.noShowProbability ?? 0.3;
    const slots = availableSlots.map((s) => new Date(s));
    const best  = recommendSlot(noShowProbability, slots);

    return {
      slot_time:    best ? best.toISOString() : availableSlots[0],
      duration:     appointments[targetAppointmentIdx]?.duration ?? 60,
      optimization: 'SADNSOB',
    };
  }
}

module.exports = {
  getNoShowRisk,          // primary — ML + fallback combined
  predictNoShow,          // legacy rule-based (used internally)
  recommendSlot,          // SADNSOB strategy
  recommendSlotGA,        // GA_OPTIMIZED strategy
  predictAcceptance,
  analyzeSentiment,
  detectIntent,
};
