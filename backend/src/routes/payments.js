const router = require('express').Router();
const { PrismaClient } = require('@prisma/client');
const { authenticate } = require('../middleware/auth');
const { emit } = require('../events/handler');
const { audit } = require('../middleware/audit');

const prisma = new PrismaClient();
router.use(authenticate);

router.get('/', async (req, res) => {
  try {
    const { patientId, status } = req.query;
    const payments = await prisma.payment.findMany({
      where: {
        ...(patientId && { patientId }),
        ...(status && { status }),
      },
      include: { patient: true, treatment: true },
      orderBy: { createdAt: 'desc' },
    });
    res.json(payments);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', audit('CREATE', 'Payment'), async (req, res) => {
  try {
    const { patientId, amount } = req.body;
    if (!patientId) return res.status(400).json({ error: 'patientId is required' });
    if (amount == null || isNaN(amount) || amount <= 0) return res.status(400).json({ error: 'amount must be a positive number' });

    const payment = await prisma.payment.create({
      data: req.body,
      include: { patient: true, treatment: true },
    });
    emit('PAYMENT_RECORDED', payment);
    res.status(201).json(payment);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.put('/:id', audit('UPDATE', 'Payment'), async (req, res) => {
  try {
    const data = { ...req.body };
    if (req.body.status === 'PAID' && !req.body.paidAt) data.paidAt = new Date();
    const payment = await prisma.payment.update({
      where: { id: req.params.id },
      data,
      include: { patient: true, treatment: true },
    });
    emit('PAYMENT_RECORDED', payment);
    res.json(payment);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
