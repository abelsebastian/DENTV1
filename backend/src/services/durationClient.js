/**
 * Duration Prediction Microservice Client
 * Calls the FastAPI duration prediction service via Axios.
 * Falls back to a procedure-based default if the service is unavailable.
 */

const axios = require('axios');

const DURATION_SERVICE_URL = process.env.DURATION_SERVICE_URL || 'http://localhost:8002';

const durationAxios = axios.create({
  baseURL: DURATION_SERVICE_URL,
  timeout: 2000,
  headers: { 'Content-Type': 'application/json' },
});

// Procedure type encoding — matches duration-service train.py
const PROCEDURE_TYPE_MAP = {
  'checkup':    0,
  'cleaning':   1,
  'filling':    2,
  'root canal': 3,
  'extraction': 4,
  'crown':      5,
};

// Fallback durations (minutes) when service is unavailable
const FALLBACK_DURATIONS = [30, 45, 60, 90, 50, 75];

/**
 * Encode a procedure string to its numeric type.
 * Defaults to 0 (Checkup) if unrecognized.
 */
function encodeProcedure(procedure = '') {
  const key = procedure.toLowerCase().trim();
  for (const [name, code] of Object.entries(PROCEDURE_TYPE_MAP)) {
    if (key.includes(name)) return code;
  }
  return 0;
}

/**
 * Predict procedure duration via the duration microservice.
 * Falls back to a static lookup on any error.
 *
 * @param {object} params
 * @param {string} params.procedure          - Procedure name string
 * @param {number} params.dentistExperience  - Provider years of experience
 * @param {number} params.pastAvgDuration    - Patient's historical avg duration (minutes)
 * @returns {Promise<number>} predicted duration in minutes
 *
 * @example
 * const duration = await predictDuration({ procedure: 'Root Canal', dentistExperience: 8, pastAvgDuration: 75 });
 * // 94.5
 */
async function predictDuration({ procedure, dentistExperience = 5, pastAvgDuration = 60 }) {
  const procedure_type = encodeProcedure(procedure);

  try {
    const { data } = await durationAxios.post('/predict/duration', {
      procedure_type,
      dentist_experience: dentistExperience,
      past_avg_duration:  pastAvgDuration,
    });

    return data.predicted_duration;
  } catch (err) {
    if (axios.isAxiosError(err)) {
      if (err.code === 'ECONNREFUSED') {
        console.warn('[durationClient] Duration service not running — using fallback');
      } else if (err.code === 'ECONNABORTED') {
        console.warn('[durationClient] Duration service timeout — using fallback');
      } else {
        console.warn(`[durationClient] Duration service error (${err.response?.status}) — using fallback`);
      }
    }
    return FALLBACK_DURATIONS[procedure_type];
  }
}

module.exports = { predictDuration };
