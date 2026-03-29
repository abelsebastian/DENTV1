# Smart DentalOps — Technical Report

**Project:** Smart DentalOps — Intelligent Dental Practice Management System  
**Stack:** Node.js · Express · PostgreSQL · Prisma · React · Python · FastAPI · PyTorch · scikit-learn  
**Date:** March 2026

---

## 1. Executive Summary

Smart DentalOps is a full-stack intelligent dental practice management system that combines traditional CRUD operations with machine learning microservices and a genetic algorithm optimizer. The system automates appointment scheduling, predicts patient no-show risk using an Artificial Neural Network, predicts procedure durations using Linear Regression, and optimizes slot allocation using a Genetic Algorithm — all integrated into a single cohesive platform.

---

## 2. System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        React Frontend                           │
│              (Vite · Tailwind · Recharts · WebSocket)           │
└────────────────────────────┬────────────────────────────────────┘
                             │ HTTP / WebSocket
┌────────────────────────────▼────────────────────────────────────┐
│                   Node.js / Express Backend                     │
│                        Port 5000                                │
│                                                                 │
│  Routes: auth · patients · providers · appointments ·           │
│          treatments · payments · communications ·               │
│          analytics · admin · waitlist · scheduler               │
│                                                                 │
│  Services: intelligence · mlClient · durationClient ·           │
│            geneticScheduler · optimizer · schedulerService      │
└──────┬──────────────────────────┬───────────────────────────────┘
       │ Prisma ORM               │ Axios HTTP
┌──────▼──────┐     ┌─────────────▼──────────────────────────────┐
│ PostgreSQL  │     │           Python Microservices              │
│   Port 5432 │     │                                             │
└─────────────┘     │  ml-service      Port 8000  (LR no-show)   │
                    │  nlp-service     Port 8001  (NLP sentiment) │
                    │  duration-service Port 8002 (Linear Reg)    │
                    │  ann-service     Port 8003  (ANN no-show)   │
                    └─────────────────────────────────────────────┘
```

---

## 3. Technology Stack

| Layer | Technology | Purpose |
|---|---|---|
| Frontend | React 18 + Vite | SPA dashboard |
| Styling | Tailwind CSS | Utility-first CSS |
| Charts | Recharts | Analytics visualisation |
| Backend | Node.js + Express | REST API server |
| ORM | Prisma | PostgreSQL schema + queries |
| Database | PostgreSQL 16 | Persistent data store |
| Auth | JWT (jsonwebtoken) | Stateless authentication |
| Real-time | WebSocket (ws) | Live event broadcasting |
| ML (no-show LR) | FastAPI + scikit-learn | Logistic Regression prediction |
| ML (no-show ANN) | FastAPI + PyTorch | Neural network prediction |
| ML (duration) | FastAPI + scikit-learn | Linear Regression prediction |
| NLP | FastAPI + DistilBERT | Sentiment + intent analysis |
| Containerisation | Docker + docker-compose | Service orchestration |
| API Docs | Swagger UI (CDN) | OpenAPI 3.0 documentation |

---

## 4. Database Schema

The PostgreSQL database is managed via Prisma ORM with the following models:

| Model | Key Fields | Relations |
|---|---|---|
| User | id, name, email, password, role | AuditLog |
| Patient | id, firstName, lastName, phone, noShowCount, totalAppointments | Appointments, Treatments, Payments, Communications, Waitlist |
| Provider | id, name, specialty, isActive | Appointments |
| Appointment | id, patientId, providerId, procedure, scheduledAt, duration, status, noShowProbability | Patient, Provider |
| Treatment | id, patientId, title, estimatedCost, acceptanceProbability, status | Patient, Payments |
| Payment | id, patientId, amount, status, paidAt, dueDate | Patient, Treatment |
| Communication | id, patientId, channel, message, sentiment, intent | Patient |
| AuditLog | id, userId, action, entity, entityId | User |
| Waitlist | id, patientId, procedure | Patient |

**Enums:**
- `Role`: ADMIN · DENTIST · STAFF
- `AppointmentStatus`: SCHEDULED · CONFIRMED · COMPLETED · CANCELLED · NO_SHOW
- `TreatmentStatus`: PENDING · ACCEPTED · DECLINED · IN_PROGRESS · COMPLETED
- `PaymentStatus`: PENDING · PARTIAL · PAID · OVERDUE

---

## 5. Backend API Endpoints

### Authentication
| Method | Endpoint | Description |
|---|---|---|
| POST | /api/auth/register | Register new user |
| POST | /api/auth/login | Login, returns JWT |

### Patients
| Method | Endpoint | Description |
|---|---|---|
| GET | /api/patients | List all (search by name/phone) |
| GET | /api/patients/:id | Full profile with history |
| POST | /api/patients | Create patient |
| PUT | /api/patients/:id | Update patient |
| DELETE | /api/patients/:id | Delete patient |

### Appointments
| Method | Endpoint | Description |
|---|---|---|
| GET | /api/appointments | List (filter by date/status/provider) |
| GET | /api/appointments/today | Today's appointments |
| GET | /api/appointments/slots | Available slots with no-show prediction |
| GET | /api/appointments/export/appointments | CSV export |
| POST | /api/appointments | Create (auto-predicts duration + no-show) |
| PUT | /api/appointments/:id | Update / change status |
| DELETE | /api/appointments/:id | Delete |

### Analytics
| Method | Endpoint | Description |
|---|---|---|
| GET | /api/analytics/kpi | Total patients, revenue, appointments |
| GET | /api/analytics/no-show-rate | No-show percentage |
| GET | /api/analytics/provider-performance | Patients handled per provider |
| GET | /api/analytics/dashboard | Full dashboard summary |
| GET | /api/analytics/revenue | 6-month revenue trend |
| GET | /api/analytics/appointments-trend | 7-day appointment trend |
| GET | /api/analytics/alerts | Overdue payments, follow-ups, high-risk |

### Intelligent Scheduler
| Method | Endpoint | Description |
|---|---|---|
| POST | /api/scheduler/schedule | Full intelligent scheduling flow |
| POST | /api/scheduler/recommend-slot | Single strategy slot recommendation |
| POST | /api/scheduler/optimize | Raw GA batch optimization |

### Other
| Method | Endpoint | Description |
|---|---|---|
| GET/POST | /api/treatments | Treatment plan management |
| GET/POST | /api/payments | Payment tracking |
| GET/POST | /api/communications | Patient communications + NLP |
| GET/POST | /api/waitlist | Waitlist management |
| GET/POST | /api/admin | User and role management |
| GET | /api/health | Health check |
| GET | /api/docs | Swagger UI |

---

## 6. Machine Learning Services

### 6.1 No-Show Prediction — Logistic Regression (Port 8000)

**Location:** `smart-dentalops/ml-service/`

A scikit-learn Logistic Regression model trained on 2,000 synthetic patient records.

**Input features:**
- `age` — patient age in years
- `lead_time` — days between booking and appointment
- `previous_no_shows` — historical no-show count
- `appointment_day` — day of week (0=Mon, 6=Sun)

**Label logic:** Higher no-show count, longer lead time, younger age, and Monday/Friday appointments increase risk.

**Pipeline:** `StandardScaler → LogisticRegression(max_iter=500)`

**Endpoint:** `POST /predict/no-show`  
**Output:** `{ probability: float, risk: "LOW"|"MEDIUM"|"HIGH" }`

**Risk thresholds:**
- HIGH: probability ≥ 0.55
- MEDIUM: probability ≥ 0.30
- LOW: probability < 0.30

---

### 6.2 No-Show Prediction — ANN / PyTorch (Port 8003)

**Location:** `smart-dentalops/ann-service/`

A PyTorch neural network trained on 3,000 synthetic records with the same feature set as the LR model.

**Architecture:**
```
Input(4) → Dense(16, ReLU) → Dense(8, ReLU) → Dense(1, Sigmoid)
```

**Training:**
- Loss: `BCELoss` (binary cross-entropy)
- Optimizer: Adam (lr=0.001)
- Epochs: 50, Batch size: 64
- Normalisation: `StandardScaler` (saved separately as `scaler.pkl`)

**Endpoint:** `POST /predict/no-show-ann`  
**Output:** `{ probability: float, risk: "LOW"|"MEDIUM"|"HIGH" }`

**Model files:** `ann_model.pt` + `scaler.pkl`

---

### 6.3 Procedure Duration Prediction — Linear Regression (Port 8002)

**Location:** `smart-dentalops/duration-service/`

A scikit-learn Linear Regression model trained on 1,500 synthetic records.

**Input features:**
- `procedure_type` — encoded integer (0=Checkup, 1=Cleaning, 2=Filling, 3=Root Canal, 4=Extraction, 5=Crown)
- `dentist_experience` — years of experience
- `past_avg_duration` — patient's historical average duration (minutes)

**Base durations by procedure:** 30 · 45 · 60 · 90 · 50 · 75 minutes  
**Pipeline:** `StandardScaler → LinearRegression`  
**Output clamped:** 15–180 minutes

**Endpoint:** `POST /predict/duration`  
**Output:** `{ predicted_duration: float }`

---

### 6.4 NLP Sentiment Analysis (Port 8001)

**Location:** `smart-dentalops/nlp-service/`

DistilBERT-based sentiment analysis for patient communications.

**Endpoint:** `POST /nlp/sentiment`  
**Output:** `{ label: "POSITIVE"|"NEGATIVE"|"NEUTRAL", score: float }`

---

## 7. Intelligent Scheduling System

### 7.1 Overview

The scheduling system combines ANN predictions with a Genetic Algorithm to produce optimised appointment slots. It is exposed via `POST /api/scheduler/schedule` and orchestrated by `schedulerService.js`.

### 7.2 Scheduling Flow

```
scheduleAppointment(patient, procedure, slots, strategy)
         │
         ├─ 1. predictNoShowANN()
         │      └─ POST http://localhost:8003/predict/no-show-ann
         │         Fallback: rule-based scoring from patient history
         │
         ├─ 2. predictDuration()
         │      └─ POST http://localhost:8002/predict/duration
         │         Fallback: static lookup by procedure type
         │
         └─ 3. runStrategy(strategy, slots, duration, noShowProbability)
                └─ Returns: { slot_time, predicted_duration, optimization_method }
```

**Response shape:**
```json
{
  "slot_time": "2026-04-15T09:00:00Z",
  "predicted_duration": 94,
  "no_show_probability": 0.58,
  "no_show_risk": "HIGH",
  "optimization_method": "GA_OPT",
  "ann_model": "ANN",
  "fitness_score": 1.42
}
```

### 7.3 Optimization Strategies

All strategies are implemented in `services/optimizer.js`:

| Strategy | Logic | Use Case |
|---|---|---|
| DET | Return first available slot | Simple deterministic baseline |
| SAD | First slot fitting predicted duration without overlap | Duration-aware scheduling |
| NSOB | Overbook high-risk (>0.7) patients on existing slots | Maximise utilisation |
| SADNSOB | Duration + risk combined; high risk → early slot, low risk → mid-day | Default balanced strategy |
| GA_OPT | Genetic Algorithm across all appointments | Global optimisation |

### 7.4 Genetic Algorithm

**Location:** `services/geneticScheduler.js`

**Parameters:**
- Population size: 30
- Generations: 8
- Mutation rate: 0.15
- Elite count: 4 (top chromosomes carried unchanged)

**Chromosome encoding:** Array of slot indices, one per appointment.  
Example: `[2, 0, 3, 1]` → appointment 0 gets slot 2, appointment 1 gets slot 0, etc.

**Fitness function:**
```
fitness = utilization_score - overlap_penalty - idle_penalty

utilization_score = Σ (1 - noShowProbability) per appointment
overlap_penalty   = (count - 1) × 10 per double-booked slot
idle_penalty      = Σ max(0, gap - avgDuration) × 0.1 between consecutive slots
```

**Genetic operators:**
- Selection: Tournament (best of 3 random candidates)
- Crossover: Single-point
- Mutation: Random slot swap per gene at mutation rate

**Fallback:** If GA fails for any reason, automatically falls back to SADNSOB.

---

## 8. Node.js ML Integration

### mlClient.js

Handles all no-show prediction calls with automatic fallback:

```
predictNoShow(patient, scheduledAt)       → LR model (port 8000)
predictNoShowANN(patient, scheduledAt)    → ANN model (port 8003)
predictNoShowComparison(patient, ...)     → Both in parallel via Promise.all
```

Fallback chain: ML service → rule-based scoring from `noShowCount / totalAppointments`

### durationClient.js

Handles duration prediction with procedure name encoding:

```
predictDuration({ procedure, dentistExperience, pastAvgDuration })
```

Procedure strings like `"Root Canal"` are automatically encoded to integer type codes.  
Fallback: static duration lookup `[30, 45, 60, 90, 50, 75]` by procedure type.

Both clients use a 2-second Axios timeout to prevent blocking the main API.

---

## 9. Appointment Creation Intelligence

When a new appointment is created via `POST /api/appointments`, the system automatically:

1. Runs `predictNoShowComparison()` — both LR and ANN in parallel
2. Runs `predictDuration()` — fetches predicted duration from duration service
3. Saves `noShowProbability` (ANN primary) and `duration` (ML-predicted) to the database
4. Returns the appointment with a `noShowPrediction` comparison object:

```json
{
  "noShowPrediction": {
    "probability": 0.63,
    "risk": "HIGH",
    "model": "ANN",
    "comparison": {
      "lr":  { "probability": 0.61, "risk": "HIGH", "source": "ml" },
      "ann": { "probability": 0.63, "risk": "HIGH", "model": "ANN" }
    }
  }
}
```

---

## 10. CSV Export

`GET /api/appointments/export/appointments` exports appointments as a downloadable CSV file using `json2csv`.

**Query parameters:** `date`, `status`, `providerId`

**CSV columns:** id, scheduledAt, duration, status, procedure, notes, noShowProbability, patientName, patientEmail, patientPhone, providerName, providerSpecialty, createdAt, updatedAt

**Headers set:**
```
Content-Type: text/csv
Content-Disposition: attachment; filename=appointments.csv
```

---

## 11. Real-Time Events

The backend uses a WebSocket server (`ws` library) to broadcast live events to connected frontend clients.

**Events emitted:**
- `APPOINTMENT_CREATED` — on new appointment
- `APPOINTMENT_CANCELLED` — triggers waitlist auto-fill

**Waitlist auto-fill:** On cancellation, `waitlist.service.js` automatically finds the next waitlisted patient for the same procedure and notifies them.

---

## 12. Security

- All routes (except `/api/auth/*` and `/api/docs`) require a valid JWT Bearer token
- Passwords hashed with `bcryptjs` (10 salt rounds)
- JWT signed with `JWT_SECRET` from environment, expires in 8 hours
- Role-based access: ADMIN · DENTIST · STAFF
- Audit logging on all CREATE / UPDATE / DELETE operations via `audit.js` middleware

---

## 13. Docker Setup

```yaml
services:
  postgres:   image: postgres:16-alpine  port: 5432
  backend:    build: ./backend           port: 5000
```

The backend Dockerfile uses `node:22-slim` (Debian-based) with OpenSSL installed to satisfy Prisma's query engine requirements. On startup, `prisma migrate deploy` runs automatically before the server starts.

```bash
docker-compose up --build
```

---

## 14. API Documentation

Swagger UI is served at `GET /api/docs` using a CDN-loaded interface with the spec inlined as JSON. No `swagger-ui-express` dependency — avoids v5 compatibility issues.

The OpenAPI 3.0 spec (`src/swagger.yaml`) documents all endpoints across `/patients`, `/appointments`, and `/analytics` with full request/response schemas and JWT bearer auth.

---

## 15. Running the System

### Prerequisites
- Node.js 22+
- Python 3.11–3.13 (TensorFlow) or 3.14 (PyTorch)
- PostgreSQL 16 or Docker

### Start all services

```bash
# 1. Database + Backend
cd smart-dentalops
docker-compose up --build

# OR without Docker:
cd backend
npm install && npx prisma migrate dev && node prisma/seed.js && npm run dev

# 2. No-show LR service (port 8000)
cd ml-service
pip install -r requirements.txt && python train.py
uvicorn main:app --port 8000 --reload

# 3. NLP service (port 8001)
cd nlp-service
pip install -r requirements.txt
uvicorn main:app --port 8001 --reload

# 4. Duration service (port 8002)
cd duration-service
pip install -r requirements.txt && python train.py
uvicorn main:app --port 8002 --reload

# 5. ANN service (port 8003)
cd ann-service
pip install -r requirements.txt && python train.py
uvicorn main:app --port 8003 --reload

# 6. Frontend
cd frontend
npm install && npm run dev
```

### Environment variables (backend/.env)
```
DATABASE_URL=postgresql://user:password@localhost:5432/dentalops
JWT_SECRET=your-secret-key
PORT=5000
ML_SERVICE_URL=http://localhost:8000
ANN_SERVICE_URL=http://localhost:8003
DURATION_SERVICE_URL=http://localhost:8002
```

---

## 16. Project File Structure

```
smart-dentalops/
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma
│   │   ├── seed.js
│   │   └── migrations/
│   └── src/
│       ├── index.js
│       ├── swagger.yaml
│       ├── middleware/
│       │   ├── auth.js
│       │   └── audit.js
│       ├── routes/
│       │   ├── auth.js
│       │   ├── patients.js
│       │   ├── appointments.js
│       │   ├── analytics.js
│       │   ├── scheduler.js
│       │   └── ...
│       ├── services/
│       │   ├── intelligence.js       ← rule-based engine
│       │   ├── mlClient.js           ← LR + ANN clients
│       │   ├── durationClient.js     ← duration prediction client
│       │   ├── geneticScheduler.js   ← GA implementation
│       │   ├── optimizer.js          ← all 5 strategies
│       │   ├── schedulerService.js   ← orchestrator
│       │   ├── waitlist.service.js
│       │   └── reminder.service.js
│       └── events/
│           └── handler.js
├── frontend/
│   └── src/
│       ├── pages/                    ← Dashboard, Patients, Scheduling, etc.
│       ├── components/               ← Layout, Modal, StatCard, etc.
│       ├── context/AuthContext.jsx
│       └── hooks/useWebSocket.js
├── ml-service/                       ← Logistic Regression (port 8000)
├── nlp-service/                      ← DistilBERT NLP (port 8001)
├── duration-service/                 ← Linear Regression (port 8002)
├── ann-service/                      ← PyTorch ANN (port 8003)
├── docker-compose.yml
└── README.md
```

---

## 17. Key Design Decisions

**Resilient ML integration** — Every ML call has a fallback. If any Python service is down, the Node.js backend continues operating using rule-based logic. No single point of failure.

**ANN as primary, LR for comparison** — When creating appointments, both models run in parallel. The ANN result is used as the primary `noShowProbability` stored in the database; the LR result is returned for comparison/audit purposes.

**GA with elitism** — The top 4 chromosomes are carried unchanged to each new generation, preventing regression and ensuring the best solution found is never lost.

**Procedure encoding at the client** — The `durationClient.js` handles string-to-integer encoding of procedure names so the rest of the application works with human-readable strings throughout.

**Swagger without swagger-ui-express** — v5 of `swagger-ui-express` had breaking changes. The solution serves a single HTML page loading Swagger UI from the unpkg CDN with the spec inlined as JSON — zero dependency, zero routing issues.
