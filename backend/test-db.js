require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
p.$connect()
  .then(() => { console.log('DB_OK'); return p.$disconnect(); })
  .catch(e => { console.error('DB_ERROR:', e.message); process.exit(1); });
