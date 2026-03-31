# Smart DentalOps — System Workflow

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                            PATIENT TOUCHPOINTS                              │
│                                                                             │
│   WhatsApp ──────────────────────────────────────────────────────────────┐  │
│   (Twilio Sandbox)                                                        │  │
└───────────────────────────────────────────────────────────────────────────┼─┘
                                                                            │
                                                                            ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         FRONTEND (React + Vite)                             │
│                           http://localhost:3000                             │
│                                                                             │
│  Login → Dashboard → Scheduling → Patients → Cases → Billing →             │
│  Communications → Analytics → Providers → Admin                            │
│                                                                             │
│  WebSocket client (live updates) ◄──────────────────────────────────────┐  │
└──────────────────────────────────┬──────────────────────────────────────┼──┘
                                   │ HTTP /api/*                          │
                                   ▼                                      │
┌─────────────────────────────────────────────────────────────────────────┼──┐
│                      BACKEND API (Node.js + Express)                    │  │
│                           http://localhost:5000                         │  │
│                                                                         │  │
│  ┌─────────────┐  ┌──────────────┐  ┌─────────────┐  ┌─────────────┐  │  │
│  │ /auth       │  │ /patients    │  │/appointments│  │ /analytics  │  │  │
│  │ /providers  │  │ /treatments  │  │ /payments   │  │ /scheduler  │  │  │
│  │ /waitlist   │  │/communicatio │  │ /admin      │  │ /sms        │  │  │
│  └─────────────┘  └──────────────┘  └─────────────┘  └─────────────┘  │  │
│                                                                         │  │
│  Services:                                                              │  │
│  ┌──────────────────┐  ┌─────────────────┐  ┌──────────────────────┐  │  │
│  │ intelligence.js  │  │ mlClient.js     │  │ durationClient.js    │  │  │
│  │ (rule-based)     │  │ (LR + ANN)      │  │ (Linear Regression)  │  │  │
│  └──────────────────┘  └─────────────────┘  └──────────────────────┘  │  │
│  ┌──────────────────┐  ┌─────────────────┐  ┌──────────────────────┐  │  │
│  │ optimizer.js     │  │ geneticScheduler│  │ schedulerService.js  │  │  │
│  │ (DET/SAD/NSOB/   │  │ (GA algorithm)  │  │ (orchestrator)       │  │  │
│  │  SADNSOB/GA_OPT) │  └─────────────────┘  └──────────────────────┘  │  │
│  └──────────────────┘                                                   │  │
│  ┌──────────────────┐  ┌─────────────────┐  ┌──────────────────────┐  │  │
│  │ sms.service.js   │  │ reminder.service│  │ whatsappBooking.js   │  │  │
│  │ (Twilio WhatsApp)│  │ (cron + ML)     │  │ (booking flow)       │  │  │
│  └──────────────────┘  └─────────────────┘  └──────────────────────┘  │  │
│                                                                         │  │
│  WebSocket Server ───────────────────────────────────────────────────────┘  │
└──────────────────────────────────┬─────────────────────────────────────────┘
                                   │ Prisma ORM
                                   ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                        PostgreSQL Database :5432                            │
│                                                                             │
│  Users │ Patients │ Providers │ Appointments │ Treatments │ Payments        │
│  Communications │ AuditLogs │ Waitlist                                      │
└─────────────────────────────────────────────────────────────────────────────┘
                                   │ Axios HTTP
          ┌────────────────────────┼────────────────────────┐
          ▼                        ▼                        ▼
┌──────────────────┐  ┌──────────────────────┐  ┌──────────────────────┐
│  ML Service      │  │  NLP Service         │  │  Duration Service    │
│  :8000           │  │  :8001               │  │  :8002               │
│                  │  │                      │  │                      │
│  POST            │  │  POST                │  │  POST                │
│  /predict/no-show│  │  /nlp/sentiment      │  │  /predict/duration   │
│                  │  │                      │  │                      │
│  Logistic        │  │  DistilBERT          │  │  Linear Regression   │
│  Regression      │  │  Sentiment Analysis  │  │  40K samples         │
│  40K samples     │  │                      │  │  MAE ~4 min          │
│  80:20 split     │  │  POSITIVE/NEUTRAL/   │  │  R² ~0.98            │
└──────────────────┘  │  NEGATIVE            │  └──────────────────────┘
          │           └──────────────────────┘
          ▼
┌──────────────────┐
│  ANN Service     │
│  :8003           │
│                  │
│  POST            │
│  /predict/       │
│  no-show-ann     │
│                  │
│  PyTorch ANN     │
│  16→8→1          │
│  40K samples     │
│  80:20 split     │
└──────────────────┘
```

---

## Core Workflow Flows

### 1. Appointment Booking Flow

```
Staff opens Scheduling page
        │
        ▼
Select Patient + Provider
        │
        ▼
AI Slot Suggestions panel loads
  ├─ GET /appointments/slots
  ├─ ANN → no-show probability
  └─ recommendSlot() → best time
        │
        ▼
Staff picks slot + procedure
        │
        ▼
POST /appointments
  ├─ Double booking check (DB)
  ├─ predictNoShowComparison()
  │    ├─ LR model  → probability
  │    └─ ANN model → probability (primary)
  ├─ predictDuration()
  │    └─ Linear Regression → minutes
  ├─ Save to DB (noShowProbability + duration)
  ├─ Emit APPOINTMENT_CREATED (WebSocket)
  └─ sendSMS() → WhatsApp confirmation
        │
        ▼
Appointment appears on calendar (live)
```

---

### 2. WhatsApp Booking Flow (Patient-initiated)

```
Patient sends "BOOK" on WhatsApp
        │
        ▼
Twilio → POST /api/sms/reply
        │
        ▼
whatsappBooking.handleBookingFlow()
        │
  ┌─────┴──────────────────────────────────┐
  │  Step 1: IDENTIFY                       │
  │  → Match patient by name               │
  └─────┬──────────────────────────────────┘
        │
  ┌─────┴──────────────────────────────────┐
  │  Step 2: PROCEDURE                      │
  │  → Show menu (1-6)                     │
  └─────┬──────────────────────────────────┘
        │
  ┌─────┴──────────────────────────────────┐
  │  Step 3: DATE                           │
  │  → Parse "tomorrow" / "15 April"       │
  └─────┬──────────────────────────────────┘
        │
  ┌─────┴──────────────────────────────────┐
  │  Step 4: TIME                           │
  │  → Show available slots (30-min grid)  │
  └─────┬──────────────────────────────────┘
        │
  ┌─────┴──────────────────────────────────┐
  │  Step 5: CONFIRM                        │
  │  → Show summary, reply YES             │
  └─────┬──────────────────────────────────┘
        │
        ▼
Create appointment in DB
  ├─ ANN no-show prediction
  ├─ Duration prediction
  └─ Send confirmation WhatsApp
```

---

### 3. Inbound WhatsApp Intelligence Flow

```
Patient sends any WhatsApp message
        │
        ▼
POST /api/sms/reply
        │
        ├─ handleBookingFlow() → if BOOK intent
        │
        ├─ getSentiment()  → NLP service :8001
        │    └─ POSITIVE / NEUTRAL / NEGATIVE
        │
        ├─ detectIntent()  → rule-based
        │    └─ BOOKING / CANCELLATION / EMERGENCY / BILLING / GENERAL
        │
        ├─ predictNoShowANN() → ANN service :8003
        │    └─ probability + risk for next appointment
        │
        ├─ Log to Communications table
        │    (channel=WhatsApp, direction=INBOUND, sentiment, intent)
        │
        └─ Smart reply based on:
             YES        → confirm appointment
             NO         → reschedule suggestion
             CANCELLATION → acknowledge + call us
             EMERGENCY  → urgent response
             NEGATIVE   → empathetic response
             HIGH risk  → re-engagement nudge
```

---

### 4. Automated Reminder Flow (Cron)

```
Every hour at :00
        │
        ▼
sendReminders() — reminder.service.js
        │
        ▼
Fetch appointments in next 24h
where reminderSent = false
        │
        ▼
For each appointment:
  ├─ getNoShowProbability() → ANN :8003
  │
  ├─ probability > 0.7?
  │    YES → "Please confirm. Reply YES"
  │    NO  → "Reminder: your appointment is on..."
  │
  ├─ sendSMS() → WhatsApp via Twilio
  │
  └─ Update reminderSent = true
```

---

### 5. Intelligent Scheduling (GA_OPT) Flow

```
POST /api/scheduler/schedule
        │
        ▼
schedulerService.scheduleAppointment()
        │
        ├─ Step 1: predictNoShowANN()
        │    └─ ANN :8003 → { probability, risk }
        │
        ├─ Step 2: predictDuration()
        │    └─ Duration :8002 → minutes
        │
        ├─ Step 3: runStrategy(GA_OPT)
        │    └─ geneticScheduler.optimizeSchedule()
        │         ├─ Initialize 30 random chromosomes
        │         ├─ 8 generations
        │         ├─ Fitness = utilization - overlap - idle_time
        │         ├─ Selection (tournament)
        │         ├─ Crossover (single-point)
        │         ├─ Mutation (15% rate)
        │         └─ Elitism (top 4 preserved)
        │
        └─ Return: { slot_time, predicted_duration,
                     no_show_risk, optimization_method,
                     fitness_score }
```

---

### 6. Analytics Flow

```
Dashboard loads
        │
        ▼
Promise.all([
  GET /analytics/dashboard      → KPIs, no-show rate, utilization
  GET /analytics/revenue        → 6-month revenue chart
  GET /analytics/appointments-trend → 7-day trend
  GET /appointments/today       → today's schedule
  GET /analytics/alerts         → overdue, follow-ups, high-risk
  GET /analytics/chair-utilization → (usedMin / availableMin) × 100
])
        │
        ▼
WebSocket keeps dashboard live:
  APPOINTMENT_CREATED → reload all
  APPOINTMENT_CANCELLED → reload all
  PAYMENT_RECORDED → reload all
```

---

## Dataset Summary

| Model | Algorithm | Samples | Train | Test | Key Metric |
|---|---|---|---|---|---|
| No-Show LR | Logistic Regression | 40,000 | 32,000 | 8,000 | F1, Accuracy |
| No-Show ANN | PyTorch (16→8→1) | 40,000 | 32,000 | 8,000 | F1, Accuracy |
| Duration | Linear Regression | 40,000 | 32,000 | 8,000 | MAE, R² |

All models use 80:20 stratified split with `random_state=42`.

---

## Port Reference

```
3000  React frontend
5000  Express backend + WebSocket
5432  PostgreSQL
8000  No-show LR (FastAPI)
8001  NLP sentiment (FastAPI + DistilBERT)
8002  Duration prediction (FastAPI)
8003  No-show ANN (FastAPI + PyTorch)
```
