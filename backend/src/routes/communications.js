const router = require('express').Router();
const { PrismaClient } = require('@prisma/client');
const { authenticate } = require('../middleware/auth');
const { detectIntent } = require('../services/intelligence');
const { getSentiment } = require('../services/nlpClient');

const prisma = new PrismaClient();
router.use(authenticate);

router.get('/', async (req, res) => {
  try {
    const { patientId } = req.query;
    const comms = await prisma.communication.findMany({
      where: patientId ? { patientId } : undefined,
      include: { patient: true },
      orderBy: { createdAt: 'desc' },
    });
    res.json(comms);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    if (!req.body.message) return res.status(400).json({ error: 'message is required' });

    // NLP microservice (falls back to keyword engine if unavailable)
    const [sentiment, intent] = await Promise.all([
      getSentiment(req.body.message),
      Promise.resolve(detectIntent(req.body.message)),
    ]);

    const comm = await prisma.communication.create({
      data: { ...req.body, sentiment, intent },
      include: { patient: true },
    });
    res.status(201).json(comm);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
