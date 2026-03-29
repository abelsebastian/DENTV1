const router = require('express').Router();
const { PrismaClient } = require('@prisma/client');
const { authenticate } = require('../middleware/auth');

const prisma = new PrismaClient();
router.use(authenticate);

// GET all waitlist entries
router.get('/', async (req, res) => {
  try {
    const entries = await prisma.waitlist.findMany({
      include: {
        patient: {
          select: { id: true, firstName: true, lastName: true, phone: true, email: true, noShowCount: true, totalAppointments: true },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
    res.json(entries);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST add patient to waitlist
router.post('/', async (req, res) => {
  try {
    const { patientId, procedure, notes } = req.body;
    if (!patientId) return res.status(400).json({ error: 'patientId is required' });

    // Prevent duplicate entries for same patient
    const existing = await prisma.waitlist.findFirst({ where: { patientId } });
    if (existing) return res.status(409).json({ error: 'Patient is already on the waitlist' });

    const entry = await prisma.waitlist.create({
      data: { patientId, procedure: procedure || null, notes: notes || null },
      include: { patient: true },
    });
    res.status(201).json(entry);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// DELETE remove from waitlist (when patient books or declines)
router.delete('/:id', async (req, res) => {
  try {
    await prisma.waitlist.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
