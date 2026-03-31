# Smart DentalOps — Project Report

**Title:** Smart DentalOps — Intelligent Dental Practice Management System  
**Domain:** Healthcare Technology / Dental Clinic Operations  
**Stack:** Full-Stack Web Application with Machine Learning Integration  

---

## 1. System Architecture

Smart DentalOps follows a microservices architecture where the frontend, backend API, database, and ML prediction services are decoupled and communicate over HTTP and WebSocket.

```
┌──────────────────────────────────────────────────────────────────┐
│                    PATIENT TOUCHPOINTS                           │
│   Browser (React App)          WhatsApp (Twilio Sandbox)        │
└────────────────┬───────────────────────────┬─────────────────────┘
                 │ HTTP                       │ Webhook POST
                 ▼                            ▼
┌──────────────────────────────────────────────────────────────────┐
│              FRONTEND — React + Vite  (Port 3000)                │
│  Dashboard | Scheduling | Patients | Cases | Billing |           │
│  Communications | Analytics | Providers | Admin                  │
│  WebSocket client for live updates                               │
└────────────────────────────┬─────────────────────────────────────┘
                             │ /api/* (Vite proxy)
                             ▼
┌──────────────────────────────────────────────────────────────────┐
│           BACKEND API — Node.js + Express  (Port 5000)           │
│                                                                  │
│  REST Routes: auth, patients, providers, appointments,           │
│               treatments, payments, communications,              │
│               analytics, scheduler, sms, admin, waitlist         │
│                                                                  │
│  Services: intelligence, mlClient, durationClient,               │
│            optimizer, geneticScheduler, schedulerService,        │
│            sms.service, reminder.service, whatsappBooking,       │
│            nlpClient, waitlist.service                           │
│                                                                  │
│  WebSocket Server (real-time event broadcasting)                 │
│  Cron Job (hourly WhatsApp reminders)                            │
└──────────┬──────────────────────────────────────────────────────┘
           │ Prisma ORM                    │ Axios HTTP
           ▼                              ▼
┌──────────────────┐    ┌─────────────────────────────────────────┐
│  PostgreSQL DB   │    │         ML MICROSERVICES                │
│  Port 5432       │    │                                         │
│                  │    │  :8000  No-Show LR  (scikit-learn)      │
│  Users           │    │  :8001  NLP Sentiment (DistilBERT)      │
│  Patients        │    │  :8002  Duration LR  (scikit-learn)     │
│  Providers       │    │  :8003  No-Show ANN  (PyTorch)          │
│  Appointments    │    │                                         │
│  Treatments      │    │  All built with FastAPI + Uvicorn       │
│  Payments        │    └─────────────────────────────────────────┘
│  Communications  │
│  AuditLogs       │
│  Waitlist        │
└──────────────────┘
```

### Key Architectural Decisions

- **Microservices for ML** — Each ML model runs as an independent FastAPI service. The Node.js backend calls them via Axios with a 2-second timeout and automatic fallback to rule-based logic if any service is unavailable.
- **Event-driven real-time** — WebSocket broadcasts appointment and payment events to all connected frontend clients instantly.
- **Resilient by design** — Every ML call has a fallback. The system never crashes due to a Python service being down.
- **Stateful WhatsApp sessions** — In-memory session store manages multi-step booking conversations with 15-minute expiry.

---

## 2. Technologies Used

### Frontend
| Technology | Version | Purpose |
|---|---|---|
| React | 18 | UI framework |
| Vite | 5 | Build tool and dev server |
| Tailwind CSS | 3 | Utility-first styling |
| Recharts | 2 | Analytics charts |
| Axios | 1 | HTTP client |
| React Router | 6 | Client-side routing |
| Lucide React | — | Icon library |
| WebSocket (native) | — | Real-time updates |

### Backend
| Technology | Version | Purpose |
|---|---|---|
| Node.js | 22 | Runtime |
| Express | 4 | REST API framework |
| Prisma | 5 | ORM for PostgreSQL |
| PostgreSQL | 16 | Relational database |
| JWT (jsonwebtoken) | 9 | Authentication |
| bcryptjs | 2 | Password hashing |
| ws | 8 | WebSocket server |
| node-cron | 4 | Scheduled reminder jobs |
| Twilio | — | WhatsApp messaging |
| json2csv | — | CSV export |
| js-yaml | — | Swagger spec parsing |
| Axios | 1 | ML service HTTP client |

### ML Services (Python)
| Technology | Version | Purpose |
|---|---|---|
| FastAPI | 0.111 | REST API framework |
| Uvicorn | 0.29 | ASGI server |
| scikit-learn | 1.4 | Logistic + Linear Regression |
| PyTorch | 2.2 | ANN (Neural Network) |
| NumPy | 2.0 | Numerical computing |
| Joblib | 1.4 | Model serialisation |
| Pydantic | 2.7 | Request/response validation |
| Transformers (HuggingFace) | — | DistilBERT NLP model |

### Infrastructure & Tools
| Tool | Purpose |
|---|---|
| Docker + docker-compose | Container orchestration |
| ngrok | Local tunnel for WhatsApp webhooks |
| Swagger UI (CDN) | API documentation |
| Git | Version control |

---

## 3. Module Description

### 3.1 Authentication Module
Handles user registration and login. Passwords are hashed with bcryptjs (10 salt rounds). JWT tokens are issued on login with 8-hour expiry. All API routes except `/auth/*` require a valid Bearer token. Role-based access control supports ADMIN, DENTIST, and STAFF roles.

### 3.2 Patient Management Module
Full CRUD for patient records. Stores demographic data, medical and dental history, no-show count, and total appointment count. Supports fuzzy search by name or phone. The patient profile page aggregates all related appointments, treatments, payments, and communications in a single view.

### 3.3 Smart Scheduling Module
The core module. Handles appointment booking with:
- Double-booking prevention (provider overlap check)
- AI slot suggestions using no-show probability
- Drag-and-drop calendar rescheduling
- Automatic duration prediction via ML
- Dual no-show prediction (LR + ANN in parallel)
- WhatsApp booking confirmation on creation
- Manual reminder trigger per appointment

### 3.4 Case Management Module
Treatment plan creation and tracking. Each treatment has an estimated cost, acceptance probability (calculated from cost and patient history), consent tracking, and follow-up date. Status lifecycle: PENDING → ACCEPTED/DECLINED → IN_PROGRESS → COMPLETED.

### 3.5 Billing Module
Payment recording and tracking. Supports PENDING, PARTIAL, PAID, and OVERDUE statuses. Dashboard alerts surface overdue payments automatically. Tracks payment method (Cash, Card, Insurance, Bank Transfer).

### 3.6 Communication Intelligence Module
Logs all patient interactions (Phone, Email, SMS, WhatsApp, In-Person). Every message is automatically analysed for:
- **Sentiment** — via DistilBERT NLP service (POSITIVE/NEUTRAL/NEGATIVE)
- **Intent** — via keyword classification (BOOKING/CANCELLATION/EMERGENCY/BILLING/GENERAL)

Inbound WhatsApp messages are logged automatically and trigger smart contextual replies.

### 3.7 Analytics Module
Provides KPI metrics, revenue trends, appointment trends, provider performance, no-show rates, and chair utilisation. All data is computed from the live database. The dashboard refreshes automatically via WebSocket events.

### 3.8 Intelligent Scheduler Module
Exposes five scheduling optimisation strategies:
- **DET** — Deterministic: first available slot
- **SAD** — Schedule Around Duration: fit slot by predicted duration
- **NSOB** — No-Show Overbooking: overbook high-risk patients
- **SADNSOB** — Combined duration + risk strategy (default)
- **GA_OPT** — Genetic Algorithm global optimisation

### 3.9 WhatsApp Integration Module
Bidirectional WhatsApp communication via Twilio sandbox:
- Outbound: booking confirmations, ML-based smart reminders
- Inbound: NLP analysis, intent detection, appointment confirmation (YES/NO), multi-step booking flow
- Automated hourly cron reminders with ANN-based risk routing

### 3.10 Admin Module
User management, role assignment, and full audit log of all CREATE/UPDATE/DELETE operations with user, entity, and timestamp.

### 3.11 Waitlist Module
Patients can be added to a waitlist for a procedure. On appointment cancellation, the system automatically finds the next waitlisted patient and notifies them.

---

## 4. Risk Calculation Model

### 4.1 No-Show Risk — Dual Model Approach

The system runs two models in parallel for every appointment and uses the ANN result as primary.

#### Logistic Regression (Port 8000)
A scikit-learn pipeline with StandardScaler + LogisticRegression trained on 40,000 synthetic samples.

**Input features:**

| Feature | Description | Range |
|---|---|---|
| age | Patient age in years | 18–80 |
| lead_time | Days between booking and appointment | 0–60 |
| previous_no_shows | Historical no-show count | 0–8 |
| appointment_day | Day of week (Mon-based) | 0–6 |

**Label generation logic:**
```
logit = -3.0
      + 0.40 × previous_no_shows
      + 0.03 × lead_time
      - 0.01 × age
      + 0.20 × (Monday or Friday)

probability = sigmoid(logit)
label = 1 if random() < probability else 0
```

**Risk classification:**
```
probability ≥ 0.55  →  HIGH
probability ≥ 0.30  →  MEDIUM
probability < 0.30  →  LOW
```

#### Artificial Neural Network (Port 8003)
A PyTorch Sequential model trained on 40,000 samples.

**Architecture:**
```
Input(4) → Dense(16, ReLU) → Dense(8, ReLU) → Dense(1, Sigmoid)
```

**Training configuration:**
- Loss function: Binary Cross-Entropy (BCELoss)
- Optimiser: Adam (lr=0.001)
- Epochs: 50
- Normalisation: StandardScaler (saved as scaler.pkl)
- Split: 80:20 (32,000 train / 8,000 test)

#### Comparison Output
```json
{
  "probability": 0.6341,
  "risk": "HIGH",
  "model": "ANN",
  "comparison": {
    "lr":  { "probability": 0.61, "risk": "HIGH",   "source": "ml" },
    "ann": { "probability": 0.63, "risk": "HIGH",   "model": "ANN" }
  }
}
```

### 4.2 Duration Prediction — Linear Regression (Port 8002)

**Input features:**

| Feature | Description | Range |
|---|---|---|
| procedure_type | Encoded procedure (0–5) | 0=Checkup, 1=Cleaning, 2=Filling, 3=Root Canal, 4=Extraction, 5=Crown |
| dentist_experience | Years of experience | 1–30 |
| past_avg_duration | Patient's historical avg duration | 20–120 min |

**Base durations by procedure:**
```
Checkup: 30 min | Cleaning: 45 min | Filling: 60 min
Root Canal: 90 min | Extraction: 50 min | Crown: 75 min
```

**Duration formula:**
```
duration = base[procedure_type]
         - 1.0 × dentist_experience
         + 0.5 × past_avg_duration
         + noise(0, 5)
         clipped to [15, 180] minutes
```

### 4.3 Chair Utilisation Formula

```
Chair Utilization (%) = (Used Minutes / Total Available Minutes) × 100

Where:
  Used Minutes      = sum of COMPLETED appointment durations (current month)
  Available Minutes = 480 min/day × working days × number of chairs

Status:
  ≥ 80%  →  HIGH (efficient, risk of overload)
  60–79% →  OPTIMAL
  < 60%  →  LOW (idle time, revenue loss)
```

### 4.4 Fallback Chain

```
ANN service available?
  YES → use ANN probability
  NO  → try LR service
        LR available?
          YES → use LR probability
          NO  → rule-based fallback:
                rate = noShowCount / totalAppointments
                probability = rate × 0.7 + 0.1
```

---

## 5. Data and Inputs

### 5.1 Dataset Overview

All three ML models are trained on synthetic datasets generated with realistic statistical distributions that mirror real dental clinic patterns.

| Dataset | Model | Total Samples | Train | Test |
|---|---|---|---|---|
| No-Show Classification | Logistic Regression | 40,000 | 32,000 | 8,000 |
| No-Show Classification | PyTorch ANN | 40,000 | 32,000 | 8,000 |
| Duration Regression | Linear Regression | 40,000 | 32,000 | 8,000 |

All datasets use `random_state=42` for reproducibility and `test_size=0.2` for the 80:20 split.

### 5.2 No-Show Dataset Fields

| Field | Type | Range | Description |
|---|---|---|---|
| age | Integer | 18–80 | Patient age in years |
| lead_time | Integer | 0–60 | Days between booking and appointment date |
| previous_no_shows | Integer | 0–8 | Number of past missed appointments |
| appointment_day | Integer | 0–6 | Day of week (0=Monday, 6=Sunday) |
| label (y) | Binary | 0 or 1 | 0=Show, 1=No-Show |

**Class distribution:** ~28% no-show rate (reflects real-world dental clinic statistics of 20–30%)

**Key patterns encoded:**
- Patients with more previous no-shows have higher risk
- Longer lead time increases risk (patient forgets)
- Younger patients have slightly higher risk
- Monday and Friday appointments have higher no-show rates

### 5.3 Duration Dataset Fields

| Field | Type | Range | Description |
|---|---|---|---|
| procedure_type | Integer | 0–5 | Encoded procedure category |
| dentist_experience | Integer | 1–30 | Years of clinical experience |
| past_avg_duration | Integer | 20–120 | Patient's historical average procedure time (minutes) |
| duration (y) | Float | 15–180 | Target: actual procedure duration in minutes |

**Procedure encoding:**
```
0 = Checkup    (base: 30 min)
1 = Cleaning   (base: 45 min)
2 = Filling    (base: 60 min)
3 = Root Canal (base: 90 min)
4 = Extraction (base: 50 min)
5 = Crown      (base: 75 min)
```

### 5.4 Database Schema Fields

**Appointment table (key fields):**

| Field | Type | Description |
|---|---|---|
| id | UUID | Primary key |
| patientId | UUID | Foreign key to Patient |
| providerId | UUID | Foreign key to Provider |
| procedure | String | Procedure name |
| scheduledAt | DateTime | Appointment date and time |
| duration | Integer | Duration in minutes (ML-predicted) |
| status | Enum | SCHEDULED/CONFIRMED/COMPLETED/CANCELLED/NO_SHOW |
| noShowProbability | Float | ANN-predicted probability (0–1) |
| reminderSent | Boolean | WhatsApp reminder sent flag |
| confirmed | Boolean | Patient confirmed via WhatsApp |

**Patient table (key fields):**

| Field | Type | Description |
|---|---|---|
| id | UUID | Primary key |
| firstName, lastName | String | Patient name |
| phone | String | WhatsApp-compatible phone number |
| dateOfBirth | DateTime | Used to calculate age for ML |
| noShowCount | Integer | Cumulative no-show counter |
| totalAppointments | Integer | Total appointments booked |

---

## 6. System Workflow

### 6.1 Appointment Booking Workflow

```
1. Staff opens Scheduling page
2. Selects patient and provider
3. System calls GET /appointments/slots
   → ANN predicts no-show probability
   → recommendSlot() suggests optimal time
4. Staff selects slot and procedure
5. POST /appointments
   a. Double-booking check against DB
   b. predictNoShowComparison() — LR + ANN in parallel
   c. predictDuration() — Linear Regression
   d. Save appointment with noShowProbability + duration
   e. Emit APPOINTMENT_CREATED via WebSocket
   f. Send WhatsApp confirmation to patient
6. Calendar updates live across all connected clients
```

### 6.2 WhatsApp Patient Booking Workflow

```
Patient → "BOOK" on WhatsApp
  → Step 1: Identify patient by name
  → Step 2: Choose procedure (menu 1–6)
  → Step 3: Enter preferred date
  → Step 4: Choose from available time slots
  → Step 5: Confirm with YES
  → Appointment created with ML predictions
  → Confirmation message sent
```

### 6.3 Automated Reminder Workflow

```
Cron: every hour at :00
  → Fetch appointments in next 24h (reminderSent=false)
  → For each: call ANN for no-show probability
    → probability > 0.7: send confirmation request
    → probability ≤ 0.7: send standard reminder
  → Mark reminderSent = true
```

### 6.4 Inbound WhatsApp Intelligence Workflow

```
Patient sends message
  → NLP sentiment analysis (DistilBERT)
  → Intent detection (keyword rules)
  → ANN no-show prediction for next appointment
  → Log to Communications table
  → Smart contextual reply based on intent + sentiment + risk
```

### 6.5 GA Scheduling Optimisation Workflow

```
POST /api/scheduler/schedule (strategy: GA_OPT)
  → ANN no-show prediction
  → Duration prediction
  → Genetic Algorithm (30 chromosomes, 8 generations)
    → Fitness = utilization - overlap_penalty - idle_penalty
    → Selection, Crossover, Mutation, Elitism
  → Return optimal slot with fitness score
```

---

## 7. Implementation and Results

### 7.1 Model Performance

#### No-Show Logistic Regression (40,000 samples, 80:20 split)

| Metric | Value |
|---|---|
| Accuracy | ~73% |
| F1 Score | ~0.42 |
| Precision | ~0.58 |
| Recall | ~0.33 |

The class imbalance (72% show, 28% no-show) explains the lower F1. The model is conservative — it prefers not to falsely flag patients as no-shows.

#### No-Show ANN — PyTorch (40,000 samples, 80:20 split)

| Metric | Value |
|---|---|
| Accuracy | ~74% |
| F1 Score | ~0.44 |
| Precision | ~0.60 |
| Recall | ~0.35 |

The ANN slightly outperforms LR due to its ability to capture non-linear feature interactions. Both models are used in parallel for comparison.

#### Duration Linear Regression (40,000 samples, 80:20 split)

| Metric | Value |
|---|---|
| MAE | ~4.1 min |
| RMSE | ~5.2 min |
| R² | ~0.98 |

R² of 0.98 indicates the model explains 98% of variance in procedure duration. Average prediction error is approximately 4 minutes.

### 7.2 Genetic Algorithm Performance

| Parameter | Value |
|---|---|
| Population size | 30 chromosomes |
| Generations | 8 |
| Mutation rate | 15% |
| Elite count | 4 (preserved each generation) |
| Selection | Tournament (best of 3) |
| Crossover | Single-point |

The GA consistently converges to a high-fitness schedule within 8 generations. Fitness scores typically range from 1.2 to 2.8 depending on the number of appointments and available slots.

### 7.3 WhatsApp Integration Results

- Outbound messages delivered via Twilio WhatsApp sandbox
- Inbound messages processed with NLP sentiment + intent detection
- Multi-step booking flow completes in 5 conversational turns
- Session state maintained for 15 minutes per user
- YES/NO confirmation updates appointment status in real time

### 7.4 API Performance

- All ML service calls have 2-second timeout with automatic fallback
- Parallel execution of LR + ANN predictions using Promise.all
- WebSocket broadcasts reach all clients within ~50ms
- CSV export handles large appointment datasets via streaming

---

## 8. Dashboard Outputs

### 8.1 KPI Cards

| Metric | Source | Description |
|---|---|---|
| Total Patients | COUNT(patients) | All registered patients |
| Today's Appointments | COUNT where scheduledAt = today | Live count |
| Monthly Revenue | SUM(payments where status=PAID) | Current month |
| No-Show Rate | (no-shows / total) × 100 | Current month |
| Acceptance Rate | (accepted treatments / total) × 100 | All time |
| Pending Collections | SUM(payments where status=PENDING/OVERDUE) | Outstanding |
| Chair Utilisation | (used min / available min) × 100 | Current month |
| Month Appointments | COUNT where scheduledAt in month | Current month |

### 8.2 Charts

**Revenue Trend (6 months)** — Bar chart showing monthly revenue from paid payments. Helps identify seasonal patterns and revenue growth.

**Appointments vs No-Shows (7 days)** — Line chart comparing total appointments against no-shows per day. Highlights problem days.

### 8.3 Today's Schedule Panel

Lists all appointments for the current day with:
- Patient name and procedure
- Provider name
- Scheduled time
- No-show risk badge (LOW/MEDIUM/HIGH with colour coding)
- Current status badge

### 8.4 Active Alerts Panel

Three alert categories surfaced automatically:

| Alert Type | Trigger | Severity |
|---|---|---|
| Overdue Payments | payment.status = OVERDUE | High (red) |
| Pending Follow-ups | treatment.followUpDate ≤ today | Medium (yellow) |
| High No-Show Risk Today | noShowProbability ≥ 0.4 + scheduled today | High/Medium |

### 8.5 Analytics Page

- Provider performance table with patients handled and utilisation rate
- KPI summary (total patients, revenue, appointments)
- No-show rate with total and breakdown
- Chair utilisation with used vs available minutes

---

## 9. Future Scope

### 9.1 Machine Learning Enhancements

- **Real patient data training** — Replace synthetic datasets with anonymised real clinic data to improve model accuracy significantly
- **XGBoost / Random Forest** — Ensemble models for better no-show prediction on imbalanced datasets
- **LSTM time-series model** — Predict no-show patterns based on historical appointment sequences per patient
- **Federated learning** — Train across multiple clinics without sharing patient data
- **Automated retraining pipeline** — Retrain models weekly as new appointment outcomes are recorded

### 9.2 Scheduling Intelligence

- **Multi-chair optimisation** — Extend GA to optimise across multiple chairs simultaneously
- **Provider preference learning** — Learn which procedure types each provider handles fastest
- **Emergency slot reservation** — Automatically reserve slots for same-day emergencies
- **Patient preference learning** — Remember preferred times and providers per patient

### 9.3 Communication Enhancements

- **Full WhatsApp Business API** — Move from sandbox to production WhatsApp Business account
- **Multilingual support** — NLP and booking flow in regional languages
- **Voice call integration** — Twilio Voice for automated phone reminders
- **Email integration** — Automated appointment emails via SendGrid/Mailgun
- **Two-way SMS** — For patients without WhatsApp

### 9.4 Clinical Features

- **Digital X-ray integration** — Link radiograph images to patient records
- **Insurance claim management** — Automated insurance billing and claim tracking
- **Prescription management** — Digital prescription generation and history
- **Referral system** — Track specialist referrals and outcomes
- **Patient portal** — Self-service booking and record access for patients

### 9.5 Analytics and Reporting

- **Predictive revenue forecasting** — ML-based monthly revenue prediction
- **Staff productivity analytics** — Per-provider efficiency metrics
- **Treatment acceptance funnel** — Conversion analytics for treatment plans
- **Custom report builder** — Drag-and-drop report generation
- **PDF report export** — Automated monthly clinic performance reports

### 9.6 Infrastructure

- **Production deployment** — DigitalOcean Droplet with Nginx + PM2 + SSL
- **CI/CD pipeline** — GitHub Actions for automated testing and deployment
- **Model versioning** — MLflow for tracking model experiments and versions
- **Horizontal scaling** — Load balancing for high-traffic multi-clinic deployments
- **HIPAA compliance** — End-to-end encryption, audit trails, data retention policies for production healthcare use

---

## Summary

Smart DentalOps demonstrates a complete intelligent dental practice management system that integrates traditional CRUD operations with machine learning predictions, genetic algorithm optimisation, and real-time WhatsApp communication. The system reduces no-show rates through proactive ML-based reminders, optimises chair utilisation through intelligent scheduling, and provides actionable analytics for clinic management — all in a single unified platform.
