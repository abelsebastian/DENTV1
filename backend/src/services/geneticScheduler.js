/**
 * Genetic Algorithm — Appointment Schedule Optimizer
 *
 * Inputs:
 *   slots[]              - available time slots (ISO strings)
 *   appointments[]       - { id, duration, noShowProbability }
 *
 * A "chromosome" is an array of slot indices, one per appointment.
 * e.g. [2, 0, 3, 1] means appointment[0] → slots[2], appt[1] → slots[0], etc.
 */

const POPULATION_SIZE = 30;
const GENERATIONS     = 8;
const MUTATION_RATE   = 0.15;
const ELITE_COUNT     = 4; // top N carried unchanged to next generation

// ── Helpers ───────────────────────────────────────────────────────────────────

function randInt(max) {
  return Math.floor(Math.random() * max);
}

/** Random chromosome: shuffle slot indices for each appointment */
function randomChromosome(numAppointments, numSlots) {
  return Array.from({ length: numAppointments }, () => randInt(numSlots));
}

/** Initialize population */
function initPopulation(numAppointments, numSlots) {
  return Array.from({ length: POPULATION_SIZE }, () =>
    randomChromosome(numAppointments, numSlots)
  );
}

// ── Fitness ───────────────────────────────────────────────────────────────────

/**
 * Score a chromosome. Higher = better schedule.
 *
 * Rewards:
 *   + utilization: slots filled by likely-to-show appointments
 *
 * Penalties:
 *   - overlap:   two appointments sharing the same slot
 *   - idle_time: large gaps between consecutive used slots
 */
function fitness(chromosome, slots, appointments) {
  const slotMinutes = slots.map((s) => {
    const d = new Date(s);
    return d.getHours() * 60 + d.getMinutes();
  });

  let overlapPenalty   = 0;
  let idlePenalty      = 0;
  let utilizationScore = 0;

  // Count slot usage
  const slotUsage = {};
  chromosome.forEach((slotIdx, apptIdx) => {
    slotUsage[slotIdx] = (slotUsage[slotIdx] || 0) + 1;

    // Utilization: reward slots assigned to low-no-show appointments
    const showProbability = 1 - (appointments[apptIdx].noShowProbability || 0);
    utilizationScore += showProbability;
  });

  // Overlap penalty: each extra appointment on the same slot costs 10 pts
  Object.values(slotUsage).forEach((count) => {
    if (count > 1) overlapPenalty += (count - 1) * 10;
  });

  // Idle time penalty: sum of gaps (minutes) between consecutive used slots
  const usedSlotMinutes = [...new Set(chromosome)]
    .map((i) => slotMinutes[i])
    .sort((a, b) => a - b);

  for (let i = 1; i < usedSlotMinutes.length; i++) {
    const gap = usedSlotMinutes[i] - usedSlotMinutes[i - 1];
    // Only penalise gaps larger than the average appointment duration
    const avgDuration = appointments.reduce((s, a) => s + (a.duration || 60), 0) / appointments.length;
    if (gap > avgDuration) idlePenalty += (gap - avgDuration) * 0.1;
  }

  return utilizationScore - overlapPenalty - idlePenalty;
}

// ── Genetic Operators ─────────────────────────────────────────────────────────

/** Single-point crossover */
function crossover(parentA, parentB) {
  const point = randInt(parentA.length);
  return [
    [...parentA.slice(0, point), ...parentB.slice(point)],
    [...parentB.slice(0, point), ...parentA.slice(point)],
  ];
}

/** Random slot swap mutation */
function mutate(chromosome, numSlots) {
  return chromosome.map((gene) =>
    Math.random() < MUTATION_RATE ? randInt(numSlots) : gene
  );
}

/** Tournament selection — pick best of 3 random candidates */
function select(population, scores) {
  const candidates = Array.from({ length: 3 }, () => randInt(population.length));
  const best = candidates.reduce((a, b) => (scores[a] > scores[b] ? a : b));
  return population[best];
}

// ── Main GA ───────────────────────────────────────────────────────────────────

/**
 * Run the genetic algorithm.
 *
 * @param {string[]} slots          - ISO datetime strings of available slots
 * @param {{ id, duration, noShowProbability }[]} appointments
 * @returns {{ best_schedule: object[], fitness_score: number }}
 */
function optimizeSchedule(slots, appointments) {
  if (!slots.length || !appointments.length) {
    return { best_schedule: [], fitness_score: 0 };
  }

  let population = initPopulation(appointments.length, slots.length);

  let bestChromosome = null;
  let bestScore      = -Infinity;

  for (let gen = 0; gen < GENERATIONS; gen++) {
    // Score every chromosome
    const scores = population.map((c) => fitness(c, slots, appointments));

    // Track global best
    scores.forEach((score, i) => {
      if (score > bestScore) {
        bestScore      = score;
        bestChromosome = population[i];
      }
    });

    // Sort by fitness descending
    const ranked = population
      .map((c, i) => ({ c, s: scores[i] }))
      .sort((a, b) => b.s - a.s);

    // Elitism: carry top N unchanged
    const nextGen = ranked.slice(0, ELITE_COUNT).map((r) => r.c);

    // Fill rest via selection + crossover + mutation
    while (nextGen.length < POPULATION_SIZE) {
      const parentA  = select(population, scores);
      const parentB  = select(population, scores);
      const [c1, c2] = crossover(parentA, parentB);
      nextGen.push(mutate(c1, slots.length));
      if (nextGen.length < POPULATION_SIZE) nextGen.push(mutate(c2, slots.length));
    }

    population = nextGen;
  }

  // Decode best chromosome → human-readable schedule
  const best_schedule = bestChromosome.map((slotIdx, apptIdx) => ({
    appointmentId:    appointments[apptIdx].id,
    slot:             slots[slotIdx],
    duration:         appointments[apptIdx].duration || 60,
    noShowProbability: appointments[apptIdx].noShowProbability || 0,
  }));

  return {
    best_schedule,
    fitness_score: parseFloat(bestScore.toFixed(4)),
  };
}

module.exports = { optimizeSchedule };
