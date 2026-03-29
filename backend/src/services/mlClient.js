/**
 * ML Microservice Client
 * Calls the FastAPI no-show prediction service via Axios.
 * Falls back to rule-based logic if the service is unavailable.
 */

const axios = require('axios');
const { predictNoShow: ruleBasedPredict } = require('./intelligence');

const ML_SERVICE_URL  = process.env.ML_SERVICE_URL  || 'http://localhost:8000';
const ANN_SERVICE_URL = process.env.ANN_SERVICE_URL || 'http://localhost:8003';

// Axios instances with timeout
const mlAxios = axios.create({
  baseURL: ML_SERVICE_URL,
  timeout: 2000,
  headers: { 'Content-Type': 'application/json' },
});

const annAxios = axios.create({
  baseURL: ANN_SERVICE_URL,
  timeout: 2000,
  headers: { 'Content-Type': 'application/json' },
});

/**
 * Rule-based fallback — mirrors ML risk thresholds
 * @param {object} patient
 * @returns {{ probability: number, risk: string, source: string }}
 */
function ruleBasedFallback(patient) {
  const probability = ruleBasedPredict(patient);
  const risk =
    probability >= 0.55 ? 'HIGH' :
    probability >= 0.30 ? 'MEDIUM' : 'LOW';
  return { probability, risk, source: 'rule-based' };
}

/**
 * Build the ML request payload from a patient record + appointment datetime.
 * @param {object} patient     - Prisma patient record
 * @param {string} scheduledAt - ISO datetime string
 * @returns {{ age, lead_time, previous_no_shows, appointment_day }}
 */
function buildPayload(patient, scheduledAt) {
  const apptDate = new Date(scheduledAt);

  // Convert JS getDay() (0=Sun) → Mon-based (0=Mon … 6=Sun)
  const jsDay = apptDate.getDay();
  const appointment_day = jsDay === 0 ? 6 : jsDay - 1;

  const age = patient?.dateOfBirth
    ? Math.floor((Date.now() - new Date(patient.dateOfBirth)) / (365.25 * 24 * 3600 * 1000))
    : 35; // default if DOB unknown

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

/**
 * Predict no-show probability via the ML microservice.
 * Automatically falls back to rule-based logic on any error.
 *
 * @param {object} patient     - Prisma patient record
 * @param {string} scheduledAt - ISO datetime string
 * @returns {Promise<{ probability: number, risk: string, source: string }>}
 *
 * @example
 * const result = await predictNoShow(patient, '2026-04-10T09:00:00');
 * // { probability: 0.62, risk: 'HIGH', source: 'ml' }
 */
async function predictNoShow(patient, scheduledAt) {
  try {
    const payload = buildPayload(patient, scheduledAt);

    const { data } = await mlAxios.post('/predict/no-show', payload);

    return {
      probability: data.probability,
      risk: data.risk,           // 'LOW' | 'MEDIUM' | 'HIGH'
      source: 'ml',
    };
  } catch (err) {
    // Log the reason but never crash the main API
    if (axios.isAxiosError(err)) {
      if (err.code === 'ECONNREFUSED') {
        console.warn('[mlClient] ML service not running — using rule-based fallback');
      } else if (err.code === 'ECONNABORTED') {
        console.warn('[mlClient] ML service timeout — using rule-based fallback');
      } else {
        console.warn(`[mlClient] ML service error (${err.response?.status}) — using rule-based fallback`);
      }
    } else {
      console.warn('[mlClient] Unexpected error — using rule-based fallback', err.message);
    }

    return ruleBasedFallback(patient);
  }
}

/**
 * Predict no-show probability via the ANN microservice (PyTorch).
 * Falls back to rule-based logic if the service is unavailable.
 *
 * @param {object} patient
 * @param {string} scheduledAt
 * @returns {Promise<{ probability: number, risk: string, model: string }>}
 */
async function predictNoShowANN(patient, scheduledAt) {
  try {
    const payload = buildPayload(patient, scheduledAt);

    const { data } = await annAxios.post('/predict/no-show-ann', payload);

    return {
      probability: data.probability,
      risk: data.risk,
      model: 'ANN',
    };
  } catch (err) {
    if (axios.isAxiosError(err)) {
      if (err.code === 'ECONNREFUSED') {
        console.warn('[mlClient] ANN service not running — using rule-based fallback');
      } else if (err.code === 'ECONNABORTED') {
        console.warn('[mlClient] ANN service timeout — using rule-based fallback');
      } else {
        console.warn(`[mlClient] ANN service error (${err.response?.status}) — using rule-based fallback`);
      }
    }
    const fallback = ruleBasedFallback(patient);
    return { ...fallback, model: 'ANN-fallback' };
  }
}

/**
 * Run both LR and ANN predictions in parallel and return a comparison.
 *
 * @param {object} patient
 * @param {string} scheduledAt
 * @returns {Promise<{ lr: object, ann: object, probability: number, risk: string }>}
 */
async function predictNoShowComparison(patient, scheduledAt) {
  const [lr, ann] = await Promise.all([
    predictNoShow(patient, scheduledAt),
    predictNoShowANN(patient, scheduledAt),
  ]);

  // ANN is primary; LR is kept for comparison
  return {
    probability: ann.probability,
    risk: ann.risk,
    model: ann.model,
    comparison: { lr, ann },
  };
}

module.exports = { predictNoShow, predictNoShowANN, predictNoShowComparison };
