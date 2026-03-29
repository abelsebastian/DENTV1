/**
 * Optimizer — All Scheduling Strategies
 *
 * Strategies:
 *   DET       — Deterministic: first available slot
 *   SAD       — Schedule Around Duration: fit slot based on predicted duration
 *   NSOB      — No-Show Overbooking: allow overbooking when risk > 0.7
 *   SADNSOB   — Combined: duration + no-show probability
 *   GA_OPT    — Genetic Algorithm: population-based global optimization
 */

const { optimizeSchedule } = require('./geneticScheduler');

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Convert ISO slot strings to { iso, minutes } objects for easy comparison */
function parseSlots(slots) {
  return slots.map((iso) => {
    const d = new Date(iso);
    return { iso, minutes: d.getHours() * 60 + d.getMinutes() };
  });
}

/** Find the first slot that can fit `duration` minutes without overlapping booked slots */
function firstFittingSlot(parsed, duration, bookedMinutes = []) {
  for (const slot of parsed) {
    const end = slot.minutes + duration;
    const overlaps = bookedMinutes.some((b) => slot.minutes < b.end && end > b.start);
    if (!overlaps) return slot;
  }
  return parsed[0]; // fallback: return first slot regardless
}

// ── Strategy: DET ─────────────────────────────────────────────────────────────

/**
 * DET — Return the first available slot, no intelligence applied.
 */
function strategyDET(slots, duration) {
  const parsed = parseSlots(slots);
  const slot   = parsed[0];
  return {
    slot_time:         slot.iso,
    predicted_duration: duration,
    optimization:      'DET',
  };
}

// ── Strategy: SAD ─────────────────────────────────────────────────────────────

/**
 * SAD — Schedule Around Duration.
 * Picks the first slot where the predicted duration fits without overlap.
 */
function strategySAD(slots, duration, bookedSlots = []) {
  const parsed = parseSlots(slots);
  const booked = bookedSlots.map((b) => ({
    start: new Date(b.slot_time).getHours() * 60 + new Date(b.slot_time).getMinutes(),
    end:   new Date(b.slot_time).getHours() * 60 + new Date(b.slot_time).getMinutes() + (b.duration || 60),
  }));

  const slot = firstFittingSlot(parsed, duration, booked);
  return {
    slot_time:         slot.iso,
    predicted_duration: duration,
    optimization:      'SAD',
  };
}

// ── Strategy: NSOB ────────────────────────────────────────────────────────────

/**
 * NSOB — No-Show Overbooking.
 * High-risk patients (probability > 0.7) are double-booked on the same slot
 * as another appointment to maximise utilisation.
 * Low/medium risk patients get the first available slot.
 */
function strategyNSOB(slots, duration, noShowProbability, bookedSlots = []) {
  const parsed = parseSlots(slots);

  if (noShowProbability > 0.7 && bookedSlots.length > 0) {
    // Overbook: reuse the most recently booked slot
    const lastBooked = bookedSlots[bookedSlots.length - 1];
    return {
      slot_time:         lastBooked.slot_time,
      predicted_duration: duration,
      no_show_risk:      'HIGH',
      optimization:      'NSOB',
      overbooked:        true,
    };
  }

  const slot = parsed[0];
  return {
    slot_time:         slot.iso,
    predicted_duration: duration,
    no_show_risk:      noShowProbability >= 0.3 ? 'MEDIUM' : 'LOW',
    optimization:      'NSOB',
    overbooked:        false,
  };
}

// ── Strategy: SADNSOB ─────────────────────────────────────────────────────────

/**
 * SADNSOB — Combined duration + no-show probability.
 * - High risk (> 0.5): schedule early (first fitting slot) to reduce impact of no-show
 * - Low risk:          schedule mid-day for better utilisation
 */
function strategySADNSOB(slots, duration, noShowProbability, bookedSlots = []) {
  const parsed = parseSlots(slots);
  const booked = bookedSlots.map((b) => ({
    start: new Date(b.slot_time).getHours() * 60 + new Date(b.slot_time).getMinutes(),
    end:   new Date(b.slot_time).getHours() * 60 + new Date(b.slot_time).getMinutes() + (b.duration || 60),
  }));

  let candidates = parsed.filter((s) => {
    const end = s.minutes + duration;
    return !booked.some((b) => s.minutes < b.end && end > b.start);
  });
  if (!candidates.length) candidates = parsed;

  const slot = noShowProbability > 0.5
    ? candidates[0]                                        // high risk → earliest
    : candidates[Math.floor(candidates.length / 2)];      // low risk  → mid-day

  return {
    slot_time:         slot.iso,
    predicted_duration: duration,
    no_show_risk:      noShowProbability >= 0.55 ? 'HIGH' : noShowProbability >= 0.3 ? 'MEDIUM' : 'LOW',
    optimization:      'SADNSOB',
  };
}

// ── Strategy: GA_OPT ──────────────────────────────────────────────────────────

/**
 * GA_OPT — Genetic Algorithm optimized slot selection.
 * Runs the GA across all pending appointments and returns the best slot
 * for the target appointment index.
 */
function strategyGA(slots, appointments, targetIndex = 0) {
  try {
    const { best_schedule, fitness_score } = optimizeSchedule(slots, appointments);
    const entry = best_schedule[targetIndex];

    if (!entry) throw new Error('GA returned no entry for targetIndex');

    return {
      slot_time:         entry.slot,
      predicted_duration: entry.duration,
      no_show_risk:      entry.noShowProbability >= 0.55 ? 'HIGH' : entry.noShowProbability >= 0.3 ? 'MEDIUM' : 'LOW',
      optimization:      'GA_OPT',
      fitness_score,
    };
  } catch (err) {
    console.warn(`[optimizer] GA_OPT failed — falling back to SADNSOB: ${err.message}`);
    const appt = appointments[targetIndex] ?? appointments[0];
    return strategySADNSOB(slots, appt.duration ?? 60, appt.noShowProbability ?? 0.3);
  }
}

// ── Main dispatcher ───────────────────────────────────────────────────────────

/**
 * Select and run a scheduling strategy.
 *
 * @param {object} params
 * @param {string}   params.strategy          - 'DET' | 'SAD' | 'NSOB' | 'SADNSOB' | 'GA_OPT'
 * @param {string[]} params.slots             - available ISO datetime strings
 * @param {number}   params.duration          - predicted duration (minutes)
 * @param {number}   params.noShowProbability - 0–1
 * @param {object[]} params.bookedSlots       - already booked slots for overlap checks
 * @param {object[]} params.appointments      - full appointment list (required for GA_OPT)
 * @param {number}   params.targetIndex       - which appointment to schedule (GA_OPT)
 * @returns {object} scheduling result
 */
function runStrategy({
  strategy = 'SADNSOB',
  slots,
  duration = 60,
  noShowProbability = 0.3,
  bookedSlots = [],
  appointments = [],
  targetIndex = 0,
}) {
  if (!slots?.length) throw new Error('No available slots provided');

  switch (strategy) {
    case 'DET':     return strategyDET(slots, duration);
    case 'SAD':     return strategySAD(slots, duration, bookedSlots);
    case 'NSOB':    return strategyNSOB(slots, duration, noShowProbability, bookedSlots);
    case 'GA_OPT':  return strategyGA(slots, appointments, targetIndex);
    case 'SADNSOB':
    default:        return strategySADNSOB(slots, duration, noShowProbability, bookedSlots);
  }
}

module.exports = { runStrategy, strategyDET, strategySAD, strategyNSOB, strategySADNSOB, strategyGA };
