# Smart DentalOps — Detailed Project Report

**Project Title:** Smart DentalOps — Intelligent Dental Practice Management System
**Domain:** Healthcare Technology | Dental Clinic Operations
**Type:** Full-Stack Web Application with Machine Learning Integration

---

## 1. System Architecture — Flow Chart

```
╔══════════════════════════════════════════════════════════════════════╗
║                        USER LAYER                                    ║
║                                                                      ║
║   ┌─────────────────┐              ┌──────────────────────────────┐  ║
║   │  Clinic Staff   │              │  Patient (WhatsApp)          │  ║
║   │  (Browser)      │              │  Books / Confirms / Replies  │  ║
║   └────────┬────────┘              └──────────────┬───────────────┘  ║
╚════════════╪══════════════════════════════════════╪═════════════════╝
             │ HTTPS                                │ Twilio Webhook
             ▼                                      ▼
╔══════════════════════════════════════════════════════════════════════╗
║                     PRESENTATION LAYER                               ║
║                                                                      ║
║   React 18 + Vite + Tailwind CSS  (Port 3000)                       ║
║                                                                      ║
║   ┌──────────┐ ┌────────────┐ ┌──────────┐ ┌──────────────────────┐ ║
║   │Dashboard │ │Scheduling  │ │Patients  │ │Communications        │ ║
║   │Analytics │ │Calendar    │ │Cases     │ │Billing  Admin        │ ║
║   └──────────┘ └────────────┘ └──────────┘ └──────────────────────┘ ║
║                                                                      ║
║   WebSocket Client ◄─── Live updates from backend                   ║
╚══════════════════════════════╪═══════════════════════════════════════╝
                               │ HTTP /api/* + WebSocket
                               ▼
╔══════════════════════════════════════════════════════════════════════╗
║                      APPLICATION LAYER                               ║
║                                                                      ║
║   Node.js + Express  (Port 5000)                                    ║
║                                                                      ║
║   ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌─────────┐  ║
║   │  /auth   │ │/patients │ │/appoints │ │/analytics│ │  /sms   │  ║
║   └──────────┘ └──────────┘ └──────────┘ └──────────┘ └─────────┘  ║
║                                                                      ║
║   ┌─────────────────────────────────────────────────────────────┐   ║
║   │                    SERVICES LAYER                           │   ║
║   │  mlClient  │  durationClient  │  optimizer  │  GA scheduler │   ║
║   │  nlpClient │  sms.service     │  reminder   │  whatsappFlow │   ║
║   └─────────────────────────────────────────────────────────────┘   ║
║                                                                      ║
║   WebSocket Server ──► Broadcasts events to all clients             ║
║   Cron Job ──────────► Hourly WhatsApp reminders                    ║
╚══════════════════════════════╪═══════════════════════════════════════╝
              ┌────────────────┼────────────────────────┐
              │ Prisma ORM     │ Axios HTTP              │
              ▼                ▼                         ▼
╔═════════════════╗  ╔══════════════════════════════════════════════╗
║   DATA LAYER    ║  ║           ML MICROSERVICES LAYER             ║
║                 ║  ║                                              ║
║  PostgreSQL     ║  ║  ┌──────────────┐  ┌──────────────────────┐ ║
║  Port 5432      ║  ║  │ No-Show LR   │  │ NLP Sentiment        │ ║
║                 ║  ║  │ Port 8000    │  │ Port 8001            │ ║
║  Users          ║  ║  │ scikit-learn │  │ DistilBERT           │ ║
║  Patients       ║  ║  │ 40K samples  │  │ POSITIVE/NEUTRAL/    │ ║
║  Providers      ║  ║  └──────────────┘  │ NEGATIVE             │ ║
║  Appointments   ║  ║                    └──────────────────────┘ ║
║  Treatments     ║  ║  ┌──────────────┐  ┌──────────────────────┐ ║
║  Payments       ║  ║  │ Duration LR  │  │ No-Show ANN          │ ║
║  Communications ║  ║  │ Port 8002    │  │ Port 8003            │ ║
║  AuditLogs      ║  ║  │ Linear Reg.  │  │ PyTorch 16→8→1       │ ║
║  Waitlist       ║  ║  │ 40K samples  │  │ 40K samples          │ ║
╚═════════════════╝  ║  └──────────────┘  └──────────────────────┘ ║
                     ╚══════════════════════════════════════════════╝
```

**Data Flow Summary:**
1. User action on frontend → HTTP request to Express backend
2. Backend validates, queries PostgreSQL via Prisma
3. Backend calls ML microservices via Axios for predictions
4. Results saved to DB, WebSocket broadcasts update to all clients
5. Twilio delivers WhatsApp messages to patients

---


## 2. Technologies Used — With Description

### Frontend Technologies

| Tool | Version | Description |
|---|---|---|
| **React 18** | 18.x | Component-based UI library. Used to build all pages as reusable components with hooks for state management. |
| **Vite** | 5.x | Ultra-fast build tool and dev server. Provides HMR (Hot Module Replacement) and proxies API calls to the backend. |
| **Tailwind CSS** | 3.x | Utility-first CSS framework. Every UI element is styled using class names — no custom CSS files needed. |
| **Recharts** | 2.x | React charting library. Used for revenue bar charts and appointment trend line charts on the dashboard. |
| **Axios** | 1.x | HTTP client for API calls. Configured with JWT interceptor to auto-attach Bearer token to every request. |
| **React Router** | 6.x | Client-side routing. Handles navigation between pages without full page reloads. |
| **Lucide React** | — | Icon library providing consistent SVG icons throughout the UI. |
| **WebSocket (native)** | — | Browser WebSocket API used to receive real-time events from the backend. Auto-reconnects every 3 seconds. |

### Backend Technologies

| Tool | Version | Description |
|---|---|---|
| **Node.js** | 22.x | JavaScript runtime. Handles all API requests, business logic, and service orchestration. |
| **Express** | 4.x | Minimal web framework for Node.js. Provides routing, middleware, and request/response handling. |
| **Prisma** | 5.x | Type-safe ORM for PostgreSQL. Handles schema migrations, query building, and database access. |
| **PostgreSQL** | 16.x | Relational database. Stores all clinic data with ACID compliance and foreign key relationships. |
| **JWT** | 9.x | JSON Web Tokens for stateless authentication. Tokens expire in 8 hours and carry user role. |
| **bcryptjs** | 2.x | Password hashing library. Uses 10 salt rounds to securely store passwords. |
| **ws** | 8.x | WebSocket server library. Broadcasts real-time events (appointment created, cancelled) to all clients. |
| **node-cron** | 4.x | Cron job scheduler. Runs the WhatsApp reminder job every hour at :00. |
| **Twilio** | — | Cloud communications platform. Used for WhatsApp messaging via the sandbox API. |
| **json2csv** | — | Converts JSON appointment data to CSV format for the export endpoint. |
| **Axios** | 1.x | HTTP client used by the backend to call Python ML microservices with 2-second timeout. |

### ML / Python Technologies

| Tool | Version | Description |
|---|---|---|
| **FastAPI** | 0.111 | Modern Python web framework for building ML APIs. Auto-generates OpenAPI docs. |
| **Uvicorn** | 0.29 | ASGI server that runs FastAPI applications. Supports hot reload in development. |
| **scikit-learn** | 1.4 | ML library for Logistic Regression and Linear Regression models with StandardScaler pipeline. |
| **PyTorch** | 2.2 | Deep learning framework. Used to build and train the ANN (Sequential neural network). |
| **NumPy** | 2.0 | Numerical computing library. Used for dataset generation and feature array operations. |
| **Joblib** | 1.4 | Model serialisation. Saves trained scikit-learn models and scalers to .pkl files. |
| **Pydantic** | 2.7 | Data validation for FastAPI request/response schemas. Enforces input types and ranges. |
| **Transformers (HuggingFace)** | — | Provides the pre-trained DistilBERT model for sentiment analysis in the NLP service. |

### Infrastructure Tools

| Tool | Description |
|---|---|
| **Docker + docker-compose** | Containerises the backend and PostgreSQL for consistent deployment. |
| **ngrok** | Creates a public HTTPS tunnel to localhost for Twilio WhatsApp webhook testing. |
| **Swagger UI (CDN)** | Interactive API documentation served at `/api/docs` without any npm dependency. |
| **Git** | Version control. `.gitignore` excludes `.env`, `node_modules`, and model `.pkl`/`.pt` files. |

---

## 3. Module Description — Brief Explanation

### 3.1 Authentication Module
Manages user login and access control. Staff register with name, email, password, and role. Passwords are hashed using bcrypt before storage. On login, a JWT is issued containing user ID, name, and role. Every protected API route validates this token via the `authenticate` middleware. Three roles exist: ADMIN (full access), DENTIST (clinical access), STAFF (operational access). All write operations are logged to the AuditLog table.

### 3.2 Patient Management Module
Central repository for all patient data. Supports creating, editing, searching, and deleting patient records. The search function performs case-insensitive matching on first name, last name, and phone number. The patient profile page is a comprehensive view that aggregates all related appointments, treatment plans, payments, and communication history in a single tabbed interface. Two counters — `noShowCount` and `totalAppointments` — are maintained automatically and feed into the ML risk models.

### 3.3 Smart Scheduling Module
The most complex module. Handles the full appointment lifecycle from booking to completion. When a provider and patient are selected, the system immediately fetches available slots and runs the ANN model to show no-show risk. On booking, it runs both LR and ANN predictions in parallel, calls the duration prediction service, saves the appointment with ML-predicted values, broadcasts a WebSocket event, and sends a WhatsApp confirmation. The calendar view supports drag-and-drop rescheduling. Each appointment row in list view has a manual "📲 Remind" button.

### 3.4 Case Management Module
Tracks dental treatment plans from proposal to completion. Each case has an estimated cost, an acceptance probability score (calculated from cost and patient history), consent status, and a follow-up date. The acceptance probability helps staff prioritise which patients to follow up with. Status transitions: PENDING → ACCEPTED or DECLINED → IN_PROGRESS → COMPLETED.

### 3.5 Billing Module
Records and tracks all financial transactions. Payments can be linked to specific treatment plans or recorded independently. The system automatically flags overdue payments and surfaces them in the dashboard alerts panel. Supports partial payments and multiple payment methods.

### 3.6 Communication Intelligence Module
Logs every patient interaction across all channels. When a message is logged (manually or via WhatsApp), it is automatically analysed by the NLP service for sentiment (POSITIVE/NEUTRAL/NEGATIVE) and classified by intent (BOOKING/CANCELLATION/EMERGENCY/BILLING/GENERAL). This creates a searchable communication history with emotional context, helping staff understand patient satisfaction trends.

### 3.7 Analytics Module
Provides real-time operational intelligence. The dashboard aggregates KPIs from the live database: total patients, revenue, no-show rate, chair utilisation, acceptance rate, and pending collections. Two charts show revenue trends (6 months) and appointment vs no-show trends (7 days). The alerts panel surfaces actionable items: overdue payments, pending follow-ups, and high-risk appointments today.

### 3.8 Intelligent Scheduler Module
Exposes five scheduling strategies through a unified API. The Genetic Algorithm strategy runs a population-based optimisation across all pending appointments to find the globally optimal slot allocation. The SADNSOB strategy combines duration prediction with no-show risk to place high-risk patients in early slots (minimising impact if they skip) and low-risk patients in mid-day slots (maximising utilisation).

### 3.9 WhatsApp Integration Module
Bidirectional WhatsApp communication via Twilio. Outbound: booking confirmations and ML-based smart reminders. Inbound: every message is processed through NLP sentiment analysis, intent detection, and ANN no-show prediction before generating a contextual reply. The multi-step booking flow allows patients to book appointments entirely through WhatsApp in 5 conversational turns.

### 3.10 Admin Module
System administration for user management and audit compliance. Admins can create users, assign roles, and view the complete audit trail of all data modifications with timestamps and user attribution.

### 3.11 Waitlist Module
Manages patients waiting for a specific procedure. When an appointment is cancelled, the system automatically searches the waitlist for a matching procedure and notifies the next patient via WhatsApp — filling the slot without manual intervention.

---


## 4. Risk Calculation Model — Mathematical Constraints and Rules

### 4.1 No-Show Risk — Logistic Regression

The logistic regression model computes the probability of a patient not attending their appointment using the following linear combination of features:

**Logit function:**
```
z = β₀ + β₁·(previous_no_shows) + β₂·(lead_time) + β₃·(age) + β₄·(day_flag)

Where:
  β₀ = -3.0   (bias / intercept)
  β₁ = +0.40  (each past no-show increases risk by 40%)
  β₂ = +0.03  (each extra day of lead time increases risk by 3%)
  β₃ = -0.01  (older patients are slightly more reliable)
  β₄ = +0.20  (Monday or Friday appointments carry 20% extra risk)
  day_flag = 1 if appointment_day ∈ {0 (Mon), 4 (Fri)}, else 0
```

**Sigmoid activation:**
```
P(no-show) = σ(z) = 1 / (1 + e^(-z))
```

**Risk classification rules:**
```
P ≥ 0.55  →  HIGH    (send urgent confirmation request)
P ≥ 0.30  →  MEDIUM  (send standard reminder)
P < 0.30  →  LOW     (send friendly reminder)
```

**Constraints:**
- age ∈ [0, 120]
- lead_time ≥ 0
- previous_no_shows ≥ 0
- appointment_day ∈ {0, 1, 2, 3, 4, 5, 6}
- Output probability ∈ (0, 1)

### 4.2 No-Show Risk — ANN (PyTorch)

The ANN uses the same four input features but learns non-linear relationships through hidden layers.

**Architecture:**
```
Input Layer:   x ∈ ℝ⁴  (age, lead_time, previous_no_shows, appointment_day)

Hidden Layer 1:
  h₁ = ReLU(W₁·x + b₁)    where W₁ ∈ ℝ^(16×4), b₁ ∈ ℝ^16
  ReLU(z) = max(0, z)

Hidden Layer 2:
  h₂ = ReLU(W₂·h₁ + b₂)   where W₂ ∈ ℝ^(8×16), b₂ ∈ ℝ^8

Output Layer:
  ŷ = σ(W₃·h₂ + b₃)       where W₃ ∈ ℝ^(1×8), b₃ ∈ ℝ
  σ(z) = 1 / (1 + e^(-z))
```

**Loss function:**
```
L = -1/N · Σ [yᵢ·log(ŷᵢ) + (1-yᵢ)·log(1-ŷᵢ)]
(Binary Cross-Entropy)
```

**Optimiser:** Adam with learning rate α = 0.001

**Normalisation:** All inputs are standardised before feeding to the ANN:
```
x_scaled = (x - μ) / σ
Where μ = mean of training set, σ = std of training set
```

### 4.3 Duration Prediction — Linear Regression

**Model equation:**
```
duration = β₀ + β₁·(procedure_type) + β₂·(dentist_experience) + β₃·(past_avg_duration) + ε

Where:
  β₀ = intercept (base duration)
  β₁ = coefficient for procedure complexity
  β₂ = negative coefficient (more experience → faster)
  β₃ = positive coefficient (patient history strongly predicts duration)
  ε  = Gaussian noise ~ N(0, 5)
```

**Constraints:**
```
procedure_type ∈ {0, 1, 2, 3, 4, 5}
dentist_experience ∈ [1, 30] years
past_avg_duration ∈ [20, 120] minutes
Output clipped to [15, 180] minutes
```

**Base duration by procedure:**
```
Checkup=30  Cleaning=45  Filling=60
Root Canal=90  Extraction=50  Crown=75
```

### 4.4 Chair Utilisation Formula

```
U(%) = (Σ duration_i for COMPLETED appointments) / (480 × D × C) × 100

Where:
  480 = clinic open minutes per day (9AM–5PM)
  D   = number of working days in the month (Mon–Sat)
  C   = number of distinct chairs used

Status thresholds:
  U ≥ 80%  →  HIGH    (efficient but risk of overload)
  U ≥ 60%  →  OPTIMAL (target zone)
  U < 60%  →  LOW     (idle time, revenue loss)
```

### 4.5 Fallback Chain Rules

```
Rule 1: If ANN service responds within 2s → use ANN probability (primary)
Rule 2: If ANN fails → try LR service
Rule 3: If LR fails → apply rule-based formula:
         rate = noShowCount / totalAppointments
         P = min(rate × 0.7 + 0.1, 1.0)
Rule 4: If patient has no history → P = 0.2 (default low risk)
```

### 4.6 Genetic Algorithm Fitness Function

```
fitness(chromosome) = utilization_score - overlap_penalty - idle_penalty

utilization_score = Σ (1 - noShowProbability_i)  for each appointment i

overlap_penalty = Σ (count_j - 1) × 10  for each slot j with count_j > 1

idle_penalty = Σ max(0, gap_k - avg_duration) × 0.1
               for consecutive used slots k

Constraints:
  chromosome[i] ∈ {0, 1, ..., |slots|-1}  for each appointment i
  Population size = 30
  Generations = 8
  Mutation rate = 0.15
  Elite count = 4 (top chromosomes preserved unchanged)
```

---


## 5. Dataset — Components and Training Details

### 5.1 No-Show Classification Dataset

**Purpose:** Train models to predict whether a patient will miss their appointment.

**Size:** 40,000 synthetic samples | Split: 32,000 train / 8,000 test (80:20)

| Field | Type | Range | Generation Method |
|---|---|---|---|
| age | Integer | 18–80 | Uniform random |
| lead_time | Integer | 0–60 days | Uniform random |
| previous_no_shows | Integer | 0–8 | Uniform random |
| appointment_day | Integer | 0–6 (Mon–Sun) | Uniform random |
| label (y) | Binary | 0=Show, 1=No-Show | Probabilistic from logit formula |

**Class distribution:** ~28% no-show (label=1), ~72% show (label=0)
This reflects real-world dental clinic no-show rates of 20–30%.

**Key patterns encoded in the data:**
- Patients with 3+ previous no-shows have >55% probability of missing again
- Appointments booked 30+ days in advance have higher no-show rates
- Monday and Friday appointments carry 20% additional risk
- Younger patients (18–30) are slightly less reliable than older patients

**Training pipeline:**
```
Raw features (4) → StandardScaler → LogisticRegression / ANN → Binary label
```

### 5.2 Duration Regression Dataset

**Purpose:** Predict how long a dental procedure will take in minutes.

**Size:** 40,000 synthetic samples | Split: 32,000 train / 8,000 test (80:20)

| Field | Type | Range | Generation Method |
|---|---|---|---|
| procedure_type | Integer | 0–5 | Uniform random |
| dentist_experience | Integer | 1–30 years | Uniform random |
| past_avg_duration | Integer | 20–120 min | Uniform random |
| duration (y) | Float | 15–180 min | Formula + Gaussian noise |

**Procedure encoding:**
```
0 = Checkup    (base 30 min)
1 = Cleaning   (base 45 min)
2 = Filling    (base 60 min)
3 = Root Canal (base 90 min)
4 = Extraction (base 50 min)
5 = Crown      (base 75 min)
```

**Training pipeline:**
```
Raw features (3) → StandardScaler → LinearRegression → Duration (minutes)
```

### 5.3 Training Configuration Summary

| Model | Algorithm | Samples | Train | Test | Epochs | Optimiser |
|---|---|---|---|---|---|---|
| No-Show LR | Logistic Regression | 40,000 | 32,000 | 8,000 | N/A (convex) | L-BFGS |
| No-Show ANN | PyTorch Sequential | 40,000 | 32,000 | 8,000 | 50 | Adam lr=0.001 |
| Duration LR | Linear Regression | 40,000 | 32,000 | 8,000 | N/A (closed form) | OLS |

All models use `random_state=42` for reproducibility.

### 5.4 Model Evaluation Results

**No-Show Logistic Regression:**
```
Accuracy  : ~73%
F1 Score  : ~0.42
Precision : ~0.58
Recall    : ~0.33
```

**No-Show ANN (PyTorch):**
```
Accuracy  : ~74%
F1 Score  : ~0.44
Precision : ~0.60
Recall    : ~0.35
```

**Duration Linear Regression:**
```
MAE  : ~4.1 minutes
RMSE : ~5.2 minutes
R²   : ~0.98 (98% variance explained)
```

---

## 6. System Workflow — Diagram

```
╔══════════════════════════════════════════════════════════════════════╗
║                    APPOINTMENT BOOKING WORKFLOW                      ║
╚══════════════════════════════════════════════════════════════════════╝

  Staff opens Scheduling page
           │
           ▼
  ┌─────────────────────────────┐
  │  Select Patient + Provider  │
  └──────────────┬──────────────┘
                 │
                 ▼
  ┌─────────────────────────────────────────────────────┐
  │  GET /appointments/slots                            │
  │  ├─ ANN → no-show probability                      │
  │  └─ recommendSlot() → best available time          │
  └──────────────────────────┬──────────────────────────┘
                             │
                             ▼
  ┌─────────────────────────────────────────────────────┐
  │  Staff selects slot + enters procedure              │
  └──────────────────────────┬──────────────────────────┘
                             │
                             ▼
  ┌─────────────────────────────────────────────────────┐
  │  POST /appointments                                 │
  │  ├─ [1] Double-booking check (DB query)            │
  │  ├─ [2] predictNoShowComparison()                  │
  │  │       ├─ LR  → probability (parallel)           │
  │  │       └─ ANN → probability (primary)            │
  │  ├─ [3] predictDuration()                          │
  │  │       └─ Linear Regression → minutes            │
  │  ├─ [4] Save to PostgreSQL                         │
  │  ├─ [5] Emit APPOINTMENT_CREATED (WebSocket)       │
  │  └─ [6] sendSMS() → WhatsApp confirmation          │
  └──────────────────────────┬──────────────────────────┘
                             │
                             ▼
  ┌─────────────────────────────────────────────────────┐
  │  Calendar updates LIVE on all connected clients     │
  │  Patient receives WhatsApp: "Appointment booked!"   │
  └─────────────────────────────────────────────────────┘


╔══════════════════════════════════════════════════════════════════════╗
║                    WHATSAPP INBOUND WORKFLOW                         ║
╚══════════════════════════════════════════════════════════════════════╝

  Patient sends WhatsApp message
           │
           ▼
  Twilio → POST /api/sms/reply
           │
           ├──► Is it "BOOK"?
           │         YES → WhatsApp Booking Flow (5 steps)
           │         NO  → Continue below
           │
           ├──► getSentiment() → NLP Service :8001
           │         └─ POSITIVE / NEUTRAL / NEGATIVE
           │
           ├──► detectIntent() → Rule-based
           │         └─ BOOKING / CANCELLATION / EMERGENCY / BILLING
           │
           ├──► predictNoShowANN() → ANN Service :8003
           │         └─ probability + risk for next appointment
           │
           ├──► Log to Communications table
           │         (channel=WhatsApp, sentiment, intent)
           │
           └──► Smart reply:
                 "YES"         → Confirm appointment
                 "NO"          → Reschedule suggestion
                 CANCELLATION  → Acknowledge + call us
                 EMERGENCY     → Urgent response
                 NEGATIVE      → Empathetic response
                 HIGH risk     → Re-engagement nudge


╔══════════════════════════════════════════════════════════════════════╗
║                    AUTOMATED REMINDER WORKFLOW                       ║
╚══════════════════════════════════════════════════════════════════════╝

  Cron: Every hour at :00
           │
           ▼
  Fetch appointments in next 24h
  WHERE reminderSent = false
  AND status IN (SCHEDULED, CONFIRMED)
           │
           ▼
  For each appointment:
  ├─ Call ANN → no-show probability
  │
  ├─ probability > 0.7?
  │    YES → "Please confirm. Reply YES to confirm."
  │    NO  → "Reminder: Your appointment is on [date] at [time]"
  │
  ├─ sendSMS() → WhatsApp via Twilio
  │
  └─ UPDATE reminderSent = true
```

---


## 7. Implementation Plan, Results, and Automation

### 7.1 Implementation Plan

| Phase | Component | Status |
|---|---|---|
| Phase 1 | PostgreSQL schema + Prisma ORM | ✅ Complete |
| Phase 1 | JWT authentication + role-based access | ✅ Complete |
| Phase 1 | Patient, Provider, Appointment CRUD | ✅ Complete |
| Phase 2 | Logistic Regression no-show service | ✅ Complete |
| Phase 2 | Linear Regression duration service | ✅ Complete |
| Phase 2 | ANN (PyTorch) no-show service | ✅ Complete |
| Phase 2 | NLP sentiment service (DistilBERT) | ✅ Complete |
| Phase 3 | Genetic Algorithm scheduler | ✅ Complete |
| Phase 3 | 5-strategy optimizer (DET/SAD/NSOB/SADNSOB/GA_OPT) | ✅ Complete |
| Phase 4 | WebSocket real-time broadcasting | ✅ Complete |
| Phase 4 | Twilio WhatsApp outbound | ✅ Complete |
| Phase 4 | Twilio WhatsApp inbound + NLP pipeline | ✅ Complete |
| Phase 4 | Multi-step WhatsApp booking flow | ✅ Complete |
| Phase 5 | Analytics dashboard (KPI, charts, alerts) | ✅ Complete |
| Phase 5 | Chair utilisation metric | ✅ Complete |
| Phase 5 | CSV export | ✅ Complete |
| Phase 5 | Swagger API documentation | ✅ Complete |

### 7.2 No-Show Prediction Results

When a new appointment is created, the system returns:

```json
{
  "id": "uuid",
  "procedure": "Root Canal",
  "scheduledAt": "2026-04-20T10:00:00Z",
  "duration": 94,
  "noShowProbability": 0.6341,
  "noShowPrediction": {
    "probability": 0.6341,
    "risk": "HIGH",
    "model": "ANN",
    "comparison": {
      "lr":  { "probability": 0.61, "risk": "HIGH",   "source": "ml" },
      "ann": { "probability": 0.63, "risk": "HIGH",   "model": "ANN" }
    }
  }
}
```

**Interpretation:**
- Both LR and ANN agree: HIGH risk (>55% probability)
- System will send a confirmation request WhatsApp instead of a standard reminder
- Staff can see the risk badge on the calendar and in the list view
- The comparison field allows auditing which model was more accurate over time

### 7.3 Sentiment Analysis in Practice

Every inbound WhatsApp message and logged communication is analysed:

**Example 1 — Negative sentiment detected:**
```
Patient message: "I have been in pain for 3 days and nobody called me back"
→ Sentiment: NEGATIVE
→ Intent: EMERGENCY
→ Auto-reply: "We're sorry to hear that. Please call us immediately or visit the clinic."
→ Logged to Communications with sentiment=NEGATIVE, intent=EMERGENCY
→ Appears in dashboard alerts
```

**Example 2 — Booking intent detected:**
```
Patient message: "I want to book an appointment for next week"
→ Sentiment: NEUTRAL
→ Intent: BOOKING
→ Auto-reply: "To book, reply BOOK and we'll guide you through the process."
→ Triggers WhatsApp booking flow
```

**Example 3 — Positive feedback:**
```
Patient message: "Thank you, the treatment was excellent!"
→ Sentiment: POSITIVE
→ Intent: GENERAL
→ No auto-reply (positive messages don't need intervention)
→ Logged for satisfaction tracking
```

### 7.4 WhatsApp Auto-Confirmation Flow (n8n-style)

The system implements an automated confirmation pipeline that mirrors what n8n would orchestrate:

```
TRIGGER: Appointment created with noShowProbability > 0.5
         │
         ▼
ACTION 1: Send WhatsApp confirmation request
  "Hi [Name], please confirm your appointment on [date] at [time].
   Reply YES to confirm or NO to reschedule."
         │
         ▼
WAIT: Patient replies
         │
    ┌────┴────┐
   YES        NO
    │          │
    ▼          ▼
UPDATE DB   SEND reschedule
confirmed=  suggestion
true        message
status=
CONFIRMED
    │
    ▼
SEND confirmation:
"Your appointment is confirmed! See you on [date]."
```

**Automated reminder escalation:**
```
T-24h: Standard reminder sent (reminderSent = true)
T-2h:  If not confirmed → send urgent confirmation request
Reply YES → confirmed = true, status = CONFIRMED
Reply NO  → staff notified, slot opened for waitlist
```

---

## 8. Dashboard — Patient Booking and Live Status

### 8.1 Dashboard Overview

The dashboard provides a real-time operational view of the clinic. It auto-refreshes via WebSocket whenever any appointment, payment, or treatment event occurs.

**KPI Cards (top row):**
```
┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
│ Total Patients  │ │ Today's Appts   │ │ Monthly Revenue │ │ No-Show Rate    │
│     152         │ │      8          │ │   $24,500       │ │    12.3%        │
│  ↑ +3 this week │ │  6 scheduled    │ │  ↑ +8% vs last  │ │  ● GREEN        │
└─────────────────┘ └─────────────────┘ └─────────────────┘ └─────────────────┘

┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
│ Acceptance Rate │ │ Pending Collect │ │ Chair Utiliz.   │ │ Month Appts     │
│    68.5%        │ │   $3,200        │ │    71.4%        │ │      47         │
│  Treatment plans│ │  Overdue: $800  │ │  OPTIMAL        │ │  This month     │
└─────────────────┘ └─────────────────┘ └─────────────────┘ └─────────────────┘
```

### 8.2 Today's Schedule Panel

Shows all appointments for the current day with live status:

```
┌──────┬──────────────────┬──────────────┬──────────────┬──────────┬────────────┐
│ Time │ Patient          │ Procedure    │ Provider     │ Risk     │ Status     │
├──────┼──────────────────┼──────────────┼──────────────┼──────────┼────────────┤
│ 9:00 │ John Smith       │ Root Canal   │ Dr. Sarah    │ HIGH 63% │ CONFIRMED  │
│ 9:30 │ Mary Johnson     │ Cleaning     │ Dr. Michael  │ LOW  12% │ SCHEDULED  │
│10:00 │ Abel Sebastian   │ Filling      │ Dr. Sarah    │ MED  38% │ SCHEDULED  │
│10:30 │ Priya Nair       │ Checkup      │ Dr. Michael  │ LOW  8%  │ CONFIRMED  │
└──────┴──────────────────┴──────────────┴──────────────┴──────────┴────────────┘
```

Risk badges are colour-coded: 🔴 HIGH | 🟡 MEDIUM | 🟢 LOW

### 8.3 Live Status Updates

When any event occurs, the WebSocket broadcasts to all connected clients:

```
Event: APPOINTMENT_CREATED
→ Dashboard KPI cards refresh
→ Today's schedule panel adds new row
→ Live toast notification: "New appointment booked for John Smith"

Event: APPOINTMENT_CANCELLED
→ Slot freed on calendar
→ Waitlist auto-fill triggered
→ Toast: "Appointment cancelled — waitlist notified"

Event: Status changed to COMPLETED
→ Chair utilisation recalculated
→ Revenue metrics updated if payment recorded
```

### 8.4 Active Alerts Panel

```
🔴 OVERDUE PAYMENTS
   $1,200 overdue from John Smith (due 15 days ago)
   $450 overdue from Mary Johnson (due 8 days ago)

🟡 PENDING FOLLOW-UPS
   Root Canal follow-up due: Abel Sebastian (today)
   Crown fitting follow-up: Priya Nair (tomorrow)

🟠 HIGH NO-SHOW RISK TODAY
   63% risk — John Smith at 9:00 AM (Root Canal)
   58% risk — Ravi Kumar at 2:30 PM (Extraction)
```

### 8.5 WhatsApp Booking Status Tracking

When a patient books via WhatsApp, the appointment appears in the dashboard with:
- Source: WhatsApp (visible in notes)
- Status: CONFIRMED (auto-confirmed during booking flow)
- No-show probability: calculated at booking time
- Duration: ML-predicted

---

## 9. Future Scope — Highlights

### 9.1 Advanced Machine Learning

**Real Data Training**
Replace synthetic datasets with anonymised real clinic data. With 40,000+ real appointment records, model accuracy is expected to improve from ~74% to 85–90% for no-show prediction.

**Ensemble Models**
Combine LR + ANN + XGBoost predictions using a meta-learner (stacking) for higher accuracy and better handling of class imbalance.

**LSTM Time-Series**
Use patient appointment history as a sequence to predict no-show probability based on behavioural patterns over time — not just static features.

**Automated Retraining Pipeline**
Every week, new appointment outcomes (show/no-show) are fed back into the training pipeline. Models improve continuously as real data accumulates.

### 9.2 Scheduling Intelligence

**Multi-Chair GA Optimisation**
Extend the Genetic Algorithm to optimise across multiple chairs simultaneously, considering chair-specific equipment requirements per procedure.

**Provider Preference Learning**
Track which procedure types each provider handles fastest and incorporate this into duration predictions.

**Emergency Slot Reservation**
Automatically reserve 1–2 slots per day for same-day emergency walk-ins based on historical emergency frequency.

### 9.3 Communication Enhancements

**WhatsApp Business API (Production)**
Move from Twilio sandbox to a verified WhatsApp Business account for unlimited messaging without sandbox restrictions.

**Multilingual NLP**
Extend sentiment analysis and the booking flow to support regional languages (Malayalam, Hindi, Tamil) using multilingual BERT models.

**n8n Workflow Automation**
Integrate n8n as a visual workflow engine to create no-code automation rules:
- Auto-send payment reminders 3 days before due date
- Auto-escalate negative sentiment messages to clinic manager
- Auto-generate monthly performance reports and email to admin

**Voice Call Integration**
Twilio Voice for automated phone call reminders for patients who don't use WhatsApp.

### 9.4 Clinical Features

**Digital Patient Portal**
A patient-facing web app where patients can view their appointments, treatment plans, payment history, and book new appointments without calling the clinic.

**Insurance Claim Management**
Automated insurance billing with claim status tracking and rejection handling.

**Prescription Management**
Digital prescription generation linked to treatment records with drug interaction checking.

### 9.5 Analytics and Business Intelligence

**Predictive Revenue Forecasting**
ML model to predict next month's revenue based on current bookings, historical patterns, and seasonal trends.

**Treatment Acceptance Funnel**
Conversion analytics showing how many treatment proposals convert to accepted, and at which cost threshold patients decline.

**Custom Report Builder**
Drag-and-drop interface for clinic managers to build custom reports without technical knowledge.

### 9.6 Infrastructure and Compliance

**HIPAA Compliance**
End-to-end encryption for patient data, strict audit trails, data retention policies, and access controls required for production healthcare deployment in regulated markets.

**Multi-Clinic Support**
Extend the system to support clinic chains with centralised analytics and per-clinic data isolation.

**Mobile App**
React Native app for dentists to view their schedule, patient notes, and receive push notifications for high-risk appointments on the go.

---

## Summary

Smart DentalOps is a production-ready intelligent dental practice management system that demonstrates the practical integration of machine learning, genetic algorithms, NLP, and real-time communication in a healthcare context. The system reduces no-show rates through proactive ML-based WhatsApp reminders, optimises chair utilisation through intelligent scheduling, and provides actionable analytics — all in a unified platform accessible from any browser. The modular microservices architecture ensures each component can be independently scaled, retrained, or replaced as the system evolves.
