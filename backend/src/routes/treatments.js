const router = require('express').Router();
const { PrismaClient } = require('@prisma/client');
const { authenticate } = require('../middleware/auth');
const { predictAcceptance } = require('../services/intelligence');
const { emit } = require('../events/handler');
const { audit } = require('../middleware/audit');

const prisma = new PrismaClient();
router.use(authenticate);

router.get('/', async (req, res) => {
  try {
    const { patientId, status } = req.query;
    const treatments = await prisma.treatment.findMany({
      where: {
        ...(patientId && { patientId }),
        ...(status && { status }),
      },
      include: { patient: true },
      orderBy: { createdAt: 'desc' },
    });
    res.json(treatments);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const treatment = await prisma.treatment.findUnique({
      where: { id: req.params.id },
      include: { patient: true, payments: true },
    });
    if (!treatment) return res.status(404).json({ error: 'Not found' });
    res.json(treatment);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', audit('CREATE', 'Treatment'), async (req, res) => {
  try {
    const { patientId, title, estimatedCost } = req.body;
    if (!patientId) return res.status(400).json({ error: 'patientId is required' });
    if (!title) return res.status(400).json({ error: 'title is required' });
    if (estimatedCost == null || isNaN(estimatedCost)) return res.status(400).json({ error: 'estimatedCost must be a number' });

    const patient = await prisma.patient.findUnique({ where: { id: patientId } });
    if (!patient) return res.status(404).json({ error: 'Patient not found' });

    const acceptanceProbability = predictAcceptance(estimatedCost, patient);
    const treatment = await prisma.treatment.create({
      data: { ...req.body, acceptanceProbability },
      include: { patient: true },
    });
    emit('TREATMENT_UPDATED', treatment);
    res.status(201).json(treatment);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.put('/:id', audit('UPDATE', 'Treatment'), async (req, res) => {
  try {
    const treatment = await prisma.treatment.update({
      where: { id: req.params.id },
      data: req.body,
      include: { patient: true },
    });
    emit('TREATMENT_UPDATED', treatment);
    res.json(treatment);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
