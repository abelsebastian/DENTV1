# Smart DentalOps

Intelligent Dental Practice Management System — full-stack with ML, ANN, Genetic Algorithm, and WhatsApp integration.

---

## What's Inside

| Service | Tech | Port |
|---|---|---|
| Frontend | React + Vite + Tailwind | 3000 |
| Backend API | Node.js + Express + Prisma | 5000 |
| Database | PostgreSQL | 5432 |
| No-Show ML (LR) | FastAPI + scikit-learn | 8000 |
| NLP Sentiment | FastAPI + DistilBERT | 8001 |
| Duration ML | FastAPI + scikit-learn | 8002 |
| No-Show ANN | FastAPI + PyTorch | 8003 |

---

## Prerequisites

Install these before starting:

- [Node.js 22+](https://nodejs.org)
- [Python 3.11–3.13](https://www.python.org/downloads/) (for ML services)
- [PostgreSQL 16](https://www.postgresql.org/download/) (or use Docker)
- [ngrok](https://ngrok.com/download) (for WhatsApp inbound webhooks)

---

## Quick Start — All Services

Open **7 terminal windows** and run one command in each.

### Terminal 1 — PostgreSQL (skip if already running)
```bash
# Windows: start PostgreSQL service
net start postgresql-x64-16

# Or use Docker:
docker run -d --name dentalops-db -e POSTGRES_PASSWORD=password -e POSTGRES_DB=dentalops -p 5432:5432 postgres:16
```

### Terminal 2 — Backend API
```bash
cd smart-dentalops/backend
cp .env.example .env        # edit .env with your values
npm install
npx prisma db push
node prisma/seed.js
node src/index.js
```

### Terminal 3 — Frontend
```bash
cd smart-dentalops/frontend
npm install
npm run dev
```

### Terminal 4 — No-Show ML Service (Logistic Regression)
```bash
cd smart-dentalops/ml-service
pip install -r requirements.txt
python train.py              # only needed once
uvicorn main:app --port 8000 --reload
```

### Terminal 5 — NLP Sentiment Service
```bash
cd smart-dentalops/nlp-service
pip install -r requirements.txt
uvicorn main:app --port 8001 --reload
```

### Terminal 6 — Duration Prediction Service
```bash
cd smart-dentalops/duration-service
pip install -r requirements.txt
python train.py              # only needed once
uvicorn main:app --port 8002 --reload
```

### Terminal 7 — ANN No-Show Service (PyTorch)
```bash
cd smart-dentalops/ann-service
pip install -r requirements.txt
python train.py              # only needed once
uvicorn main:app --port 8003 --reload
```

Open the app at **http://localhost:3000**

---

## Login Credentials

| Email | Password | Role |
|---|---|---|
| admin@dentalops.com | password123 | Admin |
| dr.smith@dentalops.com | password123 | Dentist |
| dr.jones@dentalops.com | password123 | Dentist |
| staff@dentalops.com | password123 | Staff |

---

## Environment Variables

Edit `smart-dentalops/backend/.env`:

```env
DATABASE_URL="postgresql://postgres:password@localhost:5432/dentalops"
JWT_SECRET="your-secret-key-change-this"
PORT=5000

# ML Services
ML_SERVICE_URL="http://localhost:8000"
NLP_SERVICE_URL="http://localhost:8001"
DURATION_SERVICE_URL="http://localhost:8002"
ANN_SERVICE_URL="http://localhost:8003"

# Twilio WhatsApp
TWILIO_SID="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
TWILIO_AUTH_TOKEN="your_auth_token"
TWILIO_PHONE="+14155238886"
```

---

## WhatsApp Setup (Twilio Sandbox)

### Step 1 — Join the sandbox
Send this WhatsApp message to **+1 415 523 8886**:
```
join chamber-temperature
```

### Step 2 — Expose backend with ngrok

Add tunnels to your ngrok config at `C:\Users\<Name>\AppData\Local\ngrok\ngrok.yml`:

```yaml
version: "3"
agent:
  authtoken: YOUR_NGROK_AUTH_TOKEN

tunnels:
  frontend:
    addr: 3000
    proto: http
  backend:
    addr: 5000
    proto: http
```

Then run:
```bash
ngrok start --all
```

### Step 3 — Set webhook in Twilio

Go to [Twilio WhatsApp Sandbox Settings](https://console.twilio.com/us1/develop/sms/try-it-out/whatsapp-learn) → Sandbox Settings

Set "When a message comes in":
```
https://<your-backend-ngrok-url>/api/sms/reply
```
Method: `POST` → Save

### Step 4 — Update patient phone numbers

Update patient phones to your WhatsApp number for testing. In `smart-dentalops/backend`:
```bash
node -e "
const { PrismaClient } = require('@prisma/client');
const p = new PrismaClient();
p.patient.updateMany({ where: {}, data: { phone: '+91XXXXXXXXXX' } })
  .then(r => { console.log('Updated:', r.count); p.\$disconnect(); });
"
```

---

## Docker (Backend + Database only)

```bash
cd smart-dentalops
docker-compose up --build
```

This starts PostgreSQL and the Node.js backend. Run ML services separately as shown above.

---

## API Documentation

With the backend running, open:
```
http://localhost:5000/api/docs
```

---

## Useful Commands

```bash
# Re-seed the database
cd smart-dentalops/backend
node prisma/seed.js

# Manually trigger WhatsApp reminders (without waiting for cron)
node -e "require('./src/services/reminder.service').sendReminders().then(n => console.log('Sent:', n))"

# Regenerate Prisma client after schema changes
npx prisma generate

# Apply schema changes to DB
npx prisma db push
```

---

## Service Health Checks

```bash
curl http://localhost:5000/api/health    # Backend
curl http://localhost:8000/health        # No-show LR
curl http://localhost:8001/health        # NLP
curl http://localhost:8002/health        # Duration
curl http://localhost:8003/health        # ANN
```

---

## Ports Summary

```
3000  →  React frontend (Vite)
5000  →  Express backend API + WebSocket
5432  →  PostgreSQL
8000  →  No-show prediction (Logistic Regression)
8001  →  NLP sentiment analysis (DistilBERT)
8002  →  Duration prediction (Linear Regression)
8003  →  No-show prediction (PyTorch ANN)
```
