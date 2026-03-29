const router = require('express').Router();
const { PrismaClient } = require('@prisma/client');
const { authenticate } = require('../middleware/auth');

const prisma = new PrismaClient();
router.use(authenticate);

router.get('/', async (req, res) => {
  try {
    const providers = await prisma.provider.findMany({ where: { isActive: true } });
    res.json(providers);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const provider = await prisma.provider.create({ data: req.body });
    res.status(201).json(provider);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const provider = await prisma.provider.update({ where: { id: req.params.id }, data: req.body });
    res.json(provider);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
