const router = require('express').Router();
const { PrismaClient } = require('@prisma/client');
const { authenticate } = require('../middleware/auth');
const { audit } = require('../middleware/audit');

const prisma = new PrismaClient();

router.use(authenticate);

router.get('/', async (req, res) => {
  try {
    const { search } = req.query;
    const patients = await prisma.patient.findMany({
      where: search ? {
        OR: [
          { firstName: { contains: search, mode: 'insensitive' } },
          { lastName: { contains: search, mode: 'insensitive' } },
          { phone: { contains: search } },
        ],
      } : undefined,
      orderBy: { createdAt: 'desc' },
    });
    res.json(patients);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const patient = await prisma.patient.findUnique({
      where: { id: req.params.id },
      include: {
        appointments: { include: { provider: true }, orderBy: { scheduledAt: 'desc' } },
        treatments: { orderBy: { createdAt: 'desc' } },
        payments: { orderBy: { createdAt: 'desc' } },
        communications: { orderBy: { createdAt: 'desc' } },
      },
    });
    if (!patient) return res.status(404).json({ error: 'Patient not found' });
    res.json(patient);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', audit('CREATE', 'Patient'), async (req, res) => {
  try {
    const { firstName, lastName, phone } = req.body;
    if (!firstName) return res.status(400).json({ error: 'firstName is required' });
    if (!lastName) return res.status(400).json({ error: 'lastName is required' });
    if (!phone) return res.status(400).json({ error: 'phone is required' });

    // Sanitize: convert empty strings to null for optional fields
    const data = { ...req.body };
    ['email', 'gender', 'address', 'medicalHistory', 'dentalHistory', 'dateOfBirth'].forEach((f) => {
      if (data[f] === '') data[f] = null;
    });
    if (data.dateOfBirth) data.dateOfBirth = new Date(data.dateOfBirth);

    const patient = await prisma.patient.create({ data });
    res.status(201).json(patient);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.put('/:id', audit('UPDATE', 'Patient'), async (req, res) => {
  try {
    const data = { ...req.body };
    ['email', 'gender', 'address', 'medicalHistory', 'dentalHistory', 'dateOfBirth'].forEach((f) => {
      if (data[f] === '') data[f] = null;
    });
    if (data.dateOfBirth) data.dateOfBirth = new Date(data.dateOfBirth);

    const patient = await prisma.patient.update({ where: { id: req.params.id }, data });
    res.json(patient);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.delete('/:id', audit('DELETE', 'Patient'), async (req, res) => {
  try {
    await prisma.patient.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
