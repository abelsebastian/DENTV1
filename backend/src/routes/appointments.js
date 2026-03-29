const router = require('express').Router();
const { PrismaClient } = require('@prisma/client');
const { Parser } = require('json2csv');
const { authenticate } = require('../middleware/auth');
const { predictNoShow: ruleBasedPredict, recommendSlot, getNoShowRisk } = require('../services/intelligence');
const { emit } = require('../events/handler');
const { audit } = require('../middleware/audit');
const { handleCancellation } = require('../services/waitlist.service');
const { predictDuration } = require('../services/durationClient');
const { predictNoShowComparison } = require('../services/mlClient');
const { sendSMS } = require('../services/sms.service');

const prisma = new PrismaClient();
router.use(authenticate);

router.get('/', async (req, res) => {
  try {
    const { date, status, providerId } = req.query;
    const where = {};
    if (status) where.status = status;
    if (providerId) where.providerId = providerId;
    if (date) {
      const start = new Date(date);
      const end = new Date(date);
      end.setDate(end.getDate() + 1);
      where.scheduledAt = { gte: start, lt: end };
    }
    const appointments = await prisma.appointment.findMany({
      where,
      include: { patient: true, provider: true },
      orderBy: { scheduledAt: 'asc' },
    });
    res.json(appointments);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/today', async (req, res) => {
  try {
    const start = new Date(); start.setHours(0, 0, 0, 0);
    const end = new Date(); end.setHours(23, 59, 59, 999);
    const appointments = await prisma.appointment.findMany({
      where: { scheduledAt: { gte: start, lte: end } },
      include: { patient: true, provider: true },
      orderBy: { scheduledAt: 'asc' },
    });
    res.json(appointments);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/export/appointments', async (req, res) => {
  try {
    const { date, status, providerId } = req.query;
    const where = {};
    if (status) where.status = status;
    if (providerId) where.providerId = providerId;
    if (date) {
      const start = new Date(date);
      const end = new Date(date);
      end.setDate(end.getDate() + 1);
      where.scheduledAt = { gte: start, lt: end };
    }

    const appointments = await prisma.appointment.findMany({
      where,
      include: { patient: true, provider: true },
      orderBy: { scheduledAt: 'asc' },
    });

    // Flatten data for CSV export
    const flatData = appointments.map(apt => ({
      id: apt.id,
      scheduledAt: apt.scheduledAt,
      duration: apt.duration,
      status: apt.status,
      procedure: apt.procedure,
      notes: apt.notes || '',
      noShowProbability: apt.noShowProbability,
      patientName: `${apt.patient.firstName} ${apt.patient.lastName}`,
      patientEmail: apt.patient.email,
      patientPhone: apt.patient.phone,
      providerName: `${apt.provider.firstName} ${apt.provider.lastName}`,
      providerSpecialty: apt.provider.specialty,
      createdAt: apt.createdAt,
      updatedAt: apt.updatedAt,
    }));

    const parser = new Parser();
    const csv = parser.parse(flatData);

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=appointments.csv');
    res.send(csv);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /appointments/slots — available slot recommendations for a provider on a date
router.get('/slots', async (req, res) => {
  try {
    const { providerId, date, patientId } = req.query;
    if (!providerId || !date) return res.status(400).json({ error: 'providerId and date are required' });

    const start = new Date(date); start.setHours(8, 0, 0, 0);
    const end = new Date(date); end.setHours(18, 0, 0, 0);

    // Get booked slots for this provider on this date
    const booked = await prisma.appointment.findMany({
      where: {
        providerId,
        scheduledAt: { gte: start, lt: end },
        status: { notIn: ['CANCELLED'] },
      },
      select: { scheduledAt: true, duration: true },
    });

    // Build 30-min slots from 08:00–18:00
    const allSlots = [];
    for (let h = 8; h < 18; h++) {
      for (let m = 0; m < 60; m += 30) {
        const slot = new Date(date);
        slot.setHours(h, m, 0, 0);
        allSlots.push(slot);
      }
    }

    // Filter out booked slots
    const available = allSlots.filter((slot) => {
      return !booked.some((b) => {
        const bStart = new Date(b.scheduledAt);
        const bEnd = new Date(bStart.getTime() + b.duration * 60000);
        return slot >= bStart && slot < bEnd;
      });
    });

    // Get patient for no-show prediction
    const patient = patientId ? await prisma.patient.findUnique({ where: { id: patientId } }) : null;
    const { probability: noShowProbability } = await getNoShowRisk({ patient, scheduledAt: `${date}T09:00:00` });
    const recommended = recommendSlot(noShowProbability, available);

    res.json({
      available: available.map((s) => s.toISOString()),
      recommended: recommended?.toISOString() || null,
      noShowProbability,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', audit('CREATE', 'Appointment'), async (req, res) => {
  try {
    const { patientId, providerId, scheduledAt, duration = 60, procedure } = req.body;

    // Input validation
    if (!patientId) return res.status(400).json({ error: 'patientId is required' });
    if (!providerId) return res.status(400).json({ error: 'providerId is required' });
    if (!scheduledAt) return res.status(400).json({ error: 'scheduledAt is required' });
    if (!procedure) return res.status(400).json({ error: 'procedure is required' });

    // Normalise scheduledAt — datetime-local sends "2026-03-29T07:00" without seconds
    const scheduledAtISO = new Date(scheduledAt).toISOString();

    // Double booking check — same provider, overlapping time
    const apptStart = new Date(scheduledAtISO);
    const apptEnd = new Date(apptStart.getTime() + duration * 60000);
    const conflict = await prisma.appointment.findFirst({
      where: {
        providerId,
        status: { notIn: ['CANCELLED'] },
        AND: [
          { scheduledAt: { lt: apptEnd } },
          { scheduledAt: { gte: new Date(apptStart.getTime() - duration * 60000) } },
        ],
      },
    });
    if (conflict) return res.status(409).json({ error: 'Provider not available at this time — double booking detected' });

    const patient = await prisma.patient.findUnique({ where: { id: patientId } });
    if (!patient) return res.status(404).json({ error: 'Patient not found' });

    // Run LR + ANN predictions in parallel
    const noShowPrediction = await predictNoShowComparison(patient, scheduledAtISO);
    const noShowProbability = noShowPrediction.probability;

    // Predict duration from ML service; falls back to request body value or default
    const predictedDuration = await predictDuration({
      procedure,
      dentistExperience: (await prisma.provider.findUnique({ where: { id: providerId } }))?.experience ?? 5,
      pastAvgDuration: patient.totalAppointments > 0 ? duration : 60,
    });

    const appointment = await prisma.appointment.create({
      data: { ...req.body, scheduledAt: scheduledAtISO, duration: Math.round(predictedDuration), noShowProbability },
      include: { patient: true, provider: true },
    });

    await prisma.patient.update({
      where: { id: patientId },
      data: { totalAppointments: { increment: 1 } },
    });

    emit('APPOINTMENT_CREATED', appointment);

    // Send booking confirmation SMS (non-blocking)
    if (appointment.patient?.phone) {
      const date = new Date(appointment.scheduledAt).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
      const time = new Date(appointment.scheduledAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
      sendSMS(
        appointment.patient.phone,
        `Hi ${appointment.patient.firstName}, your appointment at Smart DentalOps is booked for ${date} at ${time}. We look forward to seeing you!`
      ).catch((err) => console.warn(`[SMS] Booking confirmation failed: ${err.message}`));
    }

    res.status(201).json({ ...appointment, noShowPrediction });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.put('/:id', audit('UPDATE', 'Appointment'), async (req, res) => {
  try {
    const prev = await prisma.appointment.findUnique({ where: { id: req.params.id } });
    const appointment = await prisma.appointment.update({
      where: { id: req.params.id },
      data: req.body,
      include: { patient: true, provider: true },
    });

    if (req.body.status === 'NO_SHOW' && prev.status !== 'NO_SHOW') {
      await prisma.patient.update({
        where: { id: appointment.patientId },
        data: { noShowCount: { increment: 1 } },
      });
    }

    if (req.body.status === 'CANCELLED') {
      emit('APPOINTMENT_CANCELLED', appointment);
      // Trigger waitlist auto-fill — non-blocking
      handleCancellation(appointment).catch(() => {});
    }
    res.json(appointment);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    await prisma.appointment.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
