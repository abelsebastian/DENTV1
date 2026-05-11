# Smart Dental Clinic Flow — Complete System Design

---

## 1. End-to-End System Workflow

```
PRE-VISIT
─────────
Patient contacts clinic (WhatsApp / walk-in / call)
        │
        ▼
New patient? → Onboarding flow (collect name, DOB, medical history)
Existing?    → Lookup by phone number
        │
        ▼
State chief complaint: "tooth pain", "root canal", "implant"
        │
        ▼
System maps complaint → procedure pathway:
  Root Canal  → [Consultation → X-ray (IOPA) → Procedure]
  Extraction  → [Consultation → X-ray → Bleeding check → Procedure]
  Implant     → [Consultation → CBCT → Blood tests → Procedure]
  Checkup     → [Consultation → (X-ray if needed)]
        │
        ▼
System shows patient their JOURNEY MAP upfront:
  "Your visit will have 3 steps:
   1. Consultation (~15 min)
   2. X-ray (~10 min, available after 11 AM)
   3. Root Canal (~90 min)
   Estimated total: 2 hrs 15 min"
        │
        ▼
Patient picks TIME WINDOW (not fixed slot):
  "Morning (9–12)", "Afternoon (12–4)", "Evening (4–7)"
        │
        ▼
System assigns queue position + estimated start time
WhatsApp confirmation sent with journey map + queue number

DAY OF VISIT
────────────
Patient arrives → WhatsApp CHECK-IN or receptionist marks
        │
        ▼
Queue engine recalculates every 5 minutes:
  ├─ Who is in treatment (and how long)
  ├─ Who has checked in (waiting room)
  ├─ Who is no-show (>15 min past window start)
  └─ Any emergencies added
        │
        ▼
Patient sees live status:
  "You are #2 in queue. Est. wait: 22 min"
        │
        ▼
No-show detected → slot freed → next patient notified:
  "A slot opened. Can you come 30 min earlier? Reply YES"
        │
        ▼
Procedure running long → downstream patients notified:
  "Slight delay. Please arrive 20 min later than planned"
        │
        ▼
Patient called in → status: IN_TREATMENT
  ├─ Step 1: Consultation (doctor marks complete)
  ├─ Step 2: X-ray ordered → status: PREREQUISITE_PENDING
  │           X-ray done → status: PREREQUISITE_COMPLETE
  └─ Step 3: Procedure begins → timer starts
        │
        ▼
Procedure complete → doctor marks DONE
Queue shifts → next patient notified: "You're next, ~10 min"

POST-VISIT
──────────
Summary sent via WhatsApp:
  "Treatment complete. Next appointment: [date]. Payment: ₹2,400"
Follow-up reminder scheduled (if needed)
Feedback request sent 2 hours later
```

---

## 2. Patient Journey

### Before Visit
- Receives journey map: steps, estimated times, what to bring
- Gets queue position and time window
- Receives reminder 2 hours before with current queue status
- Can reply STATUS anytime to get live update

### During Visit
- Checks in via WhatsApp reply or receptionist
- Sees live queue position on phone (no app needed — WhatsApp link)
- Gets notified at each step transition
- If X-ray needed: "Please go to X-ray room. Return in ~10 min"
- If delay: proactive notification with new estimated time

### After Visit
- Receives treatment summary
- Payment link or instructions
- Next appointment booking prompt
- Feedback request (sentiment feeds into patient satisfaction score)

---

## 3. Receptionist + Doctor Workflow

### Receptionist Dashboard
```
Live Queue Board:
┌────┬──────────────┬───────────┬──────────┬──────────┬──────────────┐
│ #  │ Patient      │ Procedure │ Status   │ Est.Wait │ Risk         │
├────┼──────────────┼───────────┼──────────┼──────────┼──────────────┤
│ 1  │ John Smith   │ Root Canal│ IN TREAT │ —        │ —            │
│ 2  │ Mary Johnson │ Cleaning  │ CHECKED  │ 18 min   │ LOW          │
│ 3  │ Ravi Kumar   │ Extraction│ WAITING  │ 45 min   │ HIGH (63%)   │
│ 4  │ Priya Nair   │ Checkup   │ WAITING  │ 70 min   │ MEDIUM       │
└────┴──────────────┴───────────┴──────────┴──────────┴──────────────┘

Actions per row:
[Check In] [Start Treatment] [Mark Done] [No-Show] [Emergency ↑]
```

Receptionist actions:
- Mark CHECK-IN when patient arrives
- Add walk-in → system inserts at appropriate queue position
- Flag emergency → patient moves to top, others notified of delay
- Mark prerequisite complete (X-ray done)

### Doctor Dashboard
```
My Queue Today:
1. John Smith — Root Canal — IN TREATMENT (started 10:15, est. done 11:45)
2. Mary Johnson — Cleaning — READY
3. Ravi Kumar — Extraction — WAITING (X-ray pending)

Actions: [Start] [Pause - X-ray needed] [Complete] [Flag Emergency]
```

---

## 4. Smart Scheduling Logic

### Dynamic Queue Recalculation (every 5 min)
```
For each patient in queue:
  estimatedStart[i] = max(
    completionTime[i-1] + 5min buffer,
    patient.windowStart
  )

  completionTime[i] = estimatedStart[i]
                    + predictedDuration(procedure, doctor.experience)
                    + prerequisiteTime(procedure)  // X-ray, CBCT etc.

  estimatedWait[i] = estimatedStart[i] - now()
```

### No-Show Detection
```
IF patient.status == WAITING
AND now() > patient.windowStart + 15 min
AND patient.checkedIn == false:
  → Flag as LIKELY_NO_SHOW
  → Send WhatsApp: "Are you on your way? Reply YES or NO"
  → Wait 10 min for response
  → No response → mark NO_SHOW, free slot, notify next patient
```

### Early Slot Notification
```
IF slot freed (no-show or early completion):
  → Find next WAITING patient whose estimatedStart shifts earlier by >20 min
  → Send: "A slot opened. Can you come at [new time]? Reply YES"
  → If YES → update their estimatedStart
  → If NO / no response → offer to next patient
```

### Delay Propagation
```
IF currentPatient.actualDuration > predictedDuration + 15 min:
  → Recalculate all downstream estimatedStart values
  → For each patient where shift > 10 min:
    → Send: "Running slightly late. Please arrive at [new time] instead"
```

### Prerequisite Handling (X-ray, CBCT)
```
Patient status: IN_TREATMENT
Doctor flags: NEEDS_XRAY
  → Status → PREREQUISITE_PENDING
  → Patient sent to X-ray room
  → X-ray slot reserved (separate queue)
  → Doctor takes next patient in main queue
  → When X-ray done → patient re-inserted at priority position
  → Doctor notified: "John Smith's X-ray is ready"
```

---

## 5. Queue Management Strategy

### Priority Levels
```
0 = Standard appointment
1 = Premium / fast-track (paid)
2 = Emergency (pain, swelling, trauma)
3 = Returning same-day (prerequisite complete)
```

### Walk-in Handling
```
Walk-in arrives → receptionist adds to system
System checks:
  ├─ Current queue length
  ├─ Available windows
  └─ Estimated wait time
Receptionist tells patient: "Est. wait: 45 min. Want to wait or book for later?"
If wait → added to queue at appropriate position
If book → offered next available window
```

### Fair Priority Rules
- Emergency always goes first (transparent to other patients)
- Premium fast-track: max 1 premium per 3 standard patients
- Same-day prerequisite return: inserted before next standard patient

---

## 6. Data Model

```prisma
model Patient {
  id               String   @id @default(uuid())
  firstName        String
  lastName         String
  phone            String   @unique
  dateOfBirth      DateTime?
  gender           String?
  // Medical screening
  hasDiabetes      Boolean  @default(false)
  hasHeartCondition Boolean @default(false)
  hasBloodPressure Boolean  @default(false)
  allergies        String?
  currentMedications String?
  bloodGroup       String?
  // Clinic metrics
  noShowCount      Int      @default(0)
  totalVisits      Int      @default(0)
  onboarded        Boolean  @default(false)
  createdAt        DateTime @default(now())
}

model Appointment {
  id                String      @id @default(uuid())
  patientId         String
  providerId        String
  procedure         String
  windowStart       DateTime    // flexible window start
  windowEnd         DateTime    // flexible window end
  scheduledAt       DateTime    // actual assigned time
  duration          Int         // ML-predicted minutes
  status            AppointmentStatus
  noShowProbability Float       @default(0)
  confirmed         Boolean     @default(false)
  isEmergency       Boolean     @default(false)
  priority          Int         @default(0)
  queueEntry        QueueEntry?
}

model QueueEntry {
  id              String      @id @default(uuid())
  appointmentId   String      @unique
  position        Int
  estimatedStart  DateTime
  estimatedWait   Int         // minutes
  status          QueueStatus @default(WAITING)
  checkedInAt     DateTime?
  treatmentStart  DateTime?
  treatmentEnd    DateTime?
  prerequisite    String?     // "XRAY" | "CBCT" | "BLOOD_TEST"
  prerequisiteDone Boolean    @default(false)
  notifiedEarly   Boolean     @default(false)
  notifiedDelay   Boolean     @default(false)
  createdAt       DateTime    @default(now())
  appointment     Appointment @relation(fields: [appointmentId], references: [id])
}

model ProcedurePathway {
  id          String   @id @default(uuid())
  procedure   String   @unique
  steps       Json     // ["CONSULTATION", "XRAY", "PROCEDURE"]
  prerequisites Json   // { "XRAY": true, "BLOOD_TEST": false }
  baseDuration Int     // minutes
  xrayRequired Boolean @default(false)
  cbctRequired Boolean @default(false)
  bloodTestRequired Boolean @default(false)
}

enum QueueStatus {
  WAITING
  CHECKED_IN
  IN_CONSULTATION
  PREREQUISITE_PENDING
  PREREQUISITE_COMPLETE
  IN_TREATMENT
  COMPLETED
  NO_SHOW
  RESCHEDULED
}
```

---

## 7. Edge Cases

| Scenario | System Response |
|---|---|
| Patient arrives 30 min late | If within window → check in normally. If past window → offer next available slot |
| Emergency walk-in | Added at priority=2, all patients notified of ~20 min delay |
| Procedure takes 2x longer | Downstream patients notified with new times, offered option to reschedule |
| X-ray machine down | All X-ray-dependent appointments flagged, patients notified, rescheduled |
| Patient refuses X-ray | Doctor marks waiver, procedure proceeds with risk note |
| No-show high-risk patient | Slot freed immediately, waitlist patient offered slot via WhatsApp |
| Multiple no-shows | Queue compresses, earlier patients offered to move up |
| New patient walk-in | Onboarding flow via WhatsApp while waiting (collects medical history) |

---

## 8. MVP Build Plan

### Phase 1 (Week 1–2) — Queue Engine
- Add `QueueEntry` + `ProcedurePathway` tables to Prisma
- `POST /api/queue/checkin/:appointmentId`
- `PUT /api/queue/status/:id`
- `GET /api/queue/live` — returns full queue with estimated times
- Cron every 5 min: recalculate all `estimatedStart` values
- WebSocket broadcasts queue changes

### Phase 2 (Week 3) — Smart Notifications
- No-show detection (15 min rule)
- Early slot notification
- Delay propagation notifications
- All via existing `metaWhatsapp.service.js`

### Phase 3 (Week 4) — Patient Journey Map
- `ProcedurePathway` seeded for all 6 procedures
- Journey map sent on booking confirmation
- Step-by-step status updates during visit

### Phase 4 (Week 5) — Onboarding
- New patient WhatsApp onboarding flow
- Medical history collection
- Auto-creates patient record in DB

---

## 9. Monetization Strategy

### SaaS Tiers

| Tier | Price | Features |
|---|---|---|
| Starter | ₹2,999/month | Up to 3 doctors, basic queue, WhatsApp notifications |
| Growth | ₹6,999/month | Unlimited doctors, ML predictions, analytics, priority queue |
| Enterprise | ₹14,999/month | Multi-clinic, custom branding, API access, dedicated support |

### Add-on Revenue
- **Priority/Fast-track booking** — Patient pays ₹200–500 extra to skip queue (clinic keeps 70%)
- **SMS credits** — For clinics without WhatsApp Business API
- **Setup fee** — ₹5,000 one-time onboarding + training

### Unit Economics
- Average clinic: 30–50 patients/day
- Time saved per patient: 15–20 min
- No-show reduction: 20–30%
- Revenue recovered from no-shows: ₹500–2,000/day
- ROI for clinic: positive within 2 months

---

## WhatsApp Onboarding Integration

New patient sends any message → system detects unknown number → starts onboarding:

```
Bot: "Welcome to Smart DentalOps! 👋
     I don't have your details yet.
     Let's get you registered quickly.
     What is your full name?"

Patient: "Abel Sebastian"

Bot: "Hi Abel! What is your date of birth? (DD/MM/YYYY)"

Patient: "15/06/1995"

Bot: "Do you have any of the following? (Reply numbers, e.g. 1,3)
     1. Diabetes
     2. Heart condition
     3. High blood pressure
     4. None of the above"

Patient: "4"

Bot: "Any known allergies or current medications? (or reply NONE)"

Patient: "None"

Bot: "✅ You're registered! 
     To book an appointment, reply BOOK
     To check your queue status, reply STATUS"
```

Patient record created automatically in DB.
