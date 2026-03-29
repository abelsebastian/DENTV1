const router = require('express').Router();
const { authenticate } = require('../middleware/auth');
const { optimizeSchedule } = require('../services/geneticScheduler');
const { recommendSlotGA, recommendSlot } = require('../services/intelligence');
const { runStrategy } = require('../services/optimizer');
const { scheduleAppointment } = require('../services/schedulerService');

router.use(authenticate);

/**
 * POST /api/scheduler/optimize
 * Full GA run — returns best_schedule for all appointments.
 */
router.post('/optimize', (req, res) => {
  try {
    const { slots, appointments } = req.body;
    if (!Array.isArray(slots) || !slots.length)
      return res.status(400).json({ error: 'slots must be a non-empty array of ISO datetime strings' });
    if (!Array.isArray(appointments) || !appointments.length)
      return res.status(400).json({ error: 'appointments must be a non-empty array' });

    const result = optimizeSchedule(slots, appointments);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/scheduler/recommend-slot
 * Single-slot recommendation using any strategy.
 *
 * Body: { strategy, slots, appointments, targetIndex }
 * strategy: 'DET' | 'SAD' | 'NSOB' | 'SADNSOB' | 'GA_OPT'
 */
router.post('/recommend-slot', (req, res) => {
  try {
    const { strategy = 'SADNSOB', slots, appointments = [], targetIndex = 0 } = req.body;

    if (!Array.isArray(slots) || !slots.length)
      return res.status(400).json({ error: 'slots must be a non-empty array' });

    const appt = appointments[targetIndex] ?? appointments[0] ?? { duration: 60, noShowProbability: 0.3 };

    const result = runStrategy({
      strategy,
      slots,
      duration:         appt.duration ?? 60,
      noShowProbability: appt.noShowProbability ?? 0.3,
      bookedSlots:      [],
      appointments,
      targetIndex,
    });

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/scheduler/schedule
 * Full intelligent scheduling flow:
 *   ANN prediction → duration prediction → strategy optimization
 *
 * Body:
 * {
 *   patient: { id, noShowCount, totalAppointments, dateOfBirth },
 *   procedure: string,
 *   scheduledAt: ISO string,
 *   dentistExperience: number,
 *   availableSlots: string[],
 *   bookedSlots: { slot_time, duration }[],
 *   strategy: 'DET'|'SAD'|'NSOB'|'SADNSOB'|'GA_OPT'
 * }
 */
router.post('/schedule', async (req, res) => {
  try {
    const result = await scheduleAppointment(req.body);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
