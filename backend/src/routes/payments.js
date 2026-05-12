const router = require('express').Router();
const { PrismaClient } = require('@prisma/client');
const { authenticate } = require('../middleware/auth');
const { emit } = require('../events/handler');
const { audit } = require('../middleware/audit');
const crypto = require('crypto');

const prisma = new PrismaClient();

// ── Razorpay Webhook (no auth — verified by signature) ────────────────────────
router.post('/razorpay-webhook', async (req, res) => {
  try {
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET || '';
    const signature = req.headers['x-razorpay-signature'];

    // Verify signature if secret is configured
    if (secret && signature) {
      const expected = crypto.createHmac('sha256', secret).update(JSON.stringify(req.body)).digest('hex');
      if (expected !== signature) {
        return res.status(400).json({ error: 'Invalid signature' });
      }
    }

    const event = req.body.event;
    const payload = req.body.payload;

    if (event === 'payment_link.paid') {
      const notes = payload.payment_link?.entity?.notes || {};
      const appointmentId = notes.appointmentId;
      const amount = (payload.payment_link?.entity?.amount || 0) / 100;

      if (appointmentId) {
        // Create payment record
        const appointment = await prisma.appointment.findUnique({
          where: { id: appointmentId },
          include: { patient: true },
        });

        if (appointment) {
          const payment = await prisma.payment.create({
            data: {
              patientId: appointment.patientId,
              amount,
              status: 'PAID',
              method: 'Razorpay',
              paidAt: new Date(),
              notes: `Payment link: ${payload.payment_link?.entity?.id || 'N/A'}`,
            },
            include: { patient: true },
          });
          emit('PAYMENT_RECORDED', payment);
          console.log(`[Razorpay Webhook] Payment recorded: ₹${amount} from ${appointment.patient.firstName} for appointment ${appointmentId}`);
        }
      }
    }

    res.json({ status: 'ok' });
  } catch (err) {
    console.error(`[Razorpay Webhook] Error: ${err.message}`);
    res.status(500).json({ error: err.message });
  }
});

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
