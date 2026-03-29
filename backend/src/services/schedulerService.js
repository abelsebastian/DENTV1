/**
 * Scheduler Service — Intelligent Appointment Scheduling Orchestrator
 *
 * Flow:
 *   1. Call ANN → no-show probability
 *   2. Call duration model → predicted duration
 *   3. Run chosen optimization strategy
 *   4. Return unified result
 */

const { predictNoShowANN } = require('./mlClient');
const { predictDuration }  = require('./durationClient');
const { runStrategy }      = require('./optimizer');

/**
 * Schedule a single appointment intelligently.
 *
 * @param {object} params
 * @param {object}   params.patient           - Prisma patient record
 * @param {string}   params.procedure         - Procedure name string
 * @param {string}   params.scheduledAt       - Proposed ISO datetime (used for lead_time calc)
 * @param {number}   params.dentistExperience - Provider years of experience
 * @param {string[]} params.availableSlots    - ISO datetime strings of open slots
 * @param {object[]} params.bookedSlots       - Already booked slots { slot_time, duration }
 * @param {object[]} params.allAppointments   - Full list for GA (optional)
 * @param {string}   params.strategy          - 'DET'|'SAD'|'NSOB'|'SADNSOB'|'GA_OPT' (default: SADNSOB)
 * @param {number}   params.targetIndex       - Index within allAppointments for GA (default: 0)
 *
 * @returns {Promise<{
 *   slot_time: string,
 *   predicted_duration: number,
 *   no_show_probability: number,
 *   no_show_risk: string,
 *   optimization_method: string,
 *   ann_model: string,
 *   fitness_score?: number
 * }>}
 */
async function scheduleAppointment({
  patient,
  procedure        = 'Checkup',
  scheduledAt,
  dentistExperience = 5,
  availableSlots   = [],
  bookedSlots      = [],
  allAppointments  = [],
  strategy         = 'SADNSOB',
  targetIndex      = 0,
}) {
  // ── Step 1: ANN no-show prediction ────────────────────────────────────────
  const noShowResult = await predictNoShowANN(patient, scheduledAt ?? availableSlots[0]);
  const { probability: noShowProbability, risk: no_show_risk, model: ann_model } = noShowResult;

  // ── Step 2: Duration prediction ───────────────────────────────────────────
  const pastAvgDuration = patient?.totalAppointments > 0
    ? Math.round((patient.totalAppointments * 60) / Math.max(patient.totalAppointments, 1))
    : 60;

  const predicted_duration = await predictDuration({
    procedure,
    dentistExperience,
    pastAvgDuration,
  });

  // ── Step 3: Build appointment list for GA if not provided ─────────────────
  const appointments = allAppointments.length > 0
    ? allAppointments
    : [{ id: patient?.id ?? 'appt-0', duration: Math.round(predicted_duration), noShowProbability }];

  // ── Step 4: Run optimization strategy ────────────────────────────────────
  const optimized = runStrategy({
    strategy,
    slots:            availableSlots,
    duration:         Math.round(predicted_duration),
    noShowProbability,
    bookedSlots,
    appointments,
    targetIndex,
  });

  // ── Step 5: Return unified result ─────────────────────────────────────────
  return {
    slot_time:          optimized.slot_time,
    predicted_duration: optimized.predicted_duration,
    no_show_probability: noShowProbability,
    no_show_risk,
    optimization_method: optimized.optimization,
    ann_model,
    ...(optimized.fitness_score !== undefined && { fitness_score: optimized.fitness_score }),
    ...(optimized.overbooked    !== undefined && { overbooked:    optimized.overbooked }),
  };
}

module.exports = { scheduleAppointment };
