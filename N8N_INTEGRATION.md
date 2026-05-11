# Smart DentalOps — n8n Integration Plan

n8n is a visual workflow automation tool. Instead of writing code for every automation,
you connect nodes visually. This plan covers 3 simple workflows that plug into the
existing Smart DentalOps backend via webhooks and HTTP requests.

**Key design:** n8n never calls Twilio directly. It calls the Smart DentalOps
backend API (`/api/sms/send-custom`), which already has Twilio wired up.
This keeps all messaging logic in one place.

```
n8n workflow
    │
    │  POST /api/sms/send-custom
    │  { phone, message }
    ▼
Smart DentalOps Backend
    │
    │  sendSMS(phone, message)
    ▼
Twilio → WhatsApp → Patient
```

---

## Setup n8n Locally

```bash
# Install and run n8n
npx n8n

# Opens at http://localhost:5678
```

Or with Docker:
```bash
docker run -it --rm --name n8n -p 5678:5678 n8nio/n8n
```

---

## n8n Credential Setup (one time)

In n8n → Settings → Credentials → Add New → **Header Auth**

```
Name:  SmartDentalOps
Value: Bearer YOUR_JWT_TOKEN
```

Get your token:
```powershell
$r = Invoke-RestMethod -Method POST -Uri "http://localhost:5000/api/auth/login" `
  -ContentType "application/json" `
  -Body '{"email":"admin@dentalops.com","password":"password123"}'
$r.token
```

All three workflows use this one credential — no Twilio credentials needed in n8n.

---

## Workflow 1 — Appointment Confirmation

**Trigger:** Smart DentalOps backend sends a webhook to n8n when an appointment is created.
**Action:** n8n calls back to the backend's send-custom endpoint to deliver the WhatsApp message.

```
[Webhook Node]
  URL: http://localhost:5678/webhook/appointment-created
  Method: POST
      │
      │  Receives: { appointmentId, patientName, phone, date, time, noShowRisk }
      ▼
[IF Node]
  Condition: {{ $json.noShowRisk }} === "HIGH"
      │                         │
     YES                        NO
      │                         │
      ▼                         ▼
[HTTP Request]            [HTTP Request]
POST /api/sms/send-custom  POST /api/sms/send-custom
{                          {
  phone: {{phone}},          phone: {{phone}},
  message: "Hi {{name}},     message: "Hi {{name}},
  please confirm your        your appointment is on
  appointment on {{date}}    {{date}} at {{time}}.
  at {{time}}.               See you soon!"
  Reply YES to confirm."   }
}
```

**HTTP Request node config (both branches):**
```
Method:  POST
URL:     http://localhost:5000/api/sms/send-custom
Auth:    Header Auth → SmartDentalOps credential
Body:    JSON
         {
           "phone":   "{{ $json.phone }}",
           "message": "Hi {{ $json.patientName }}..."
         }
```

**Backend change — add webhook trigger in appointments.js:**

```js
// After saving appointment — trigger n8n (non-blocking)
if (process.env.N8N_WEBHOOK_URL) {
  fetch(process.env.N8N_WEBHOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      appointmentId: appointment.id,
      patientName:   `${appointment.patient.firstName} ${appointment.patient.lastName}`,
      phone:         appointment.patient.phone,
      date:          new Date(appointment.scheduledAt).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' }),
      time:          new Date(appointment.scheduledAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
      noShowRisk:    noShowPrediction.risk,
    }),
  }).catch(() => {});
}
```

Add to `.env`:
```
N8N_WEBHOOK_URL=http://localhost:5678/webhook/appointment-created
```

---

## Workflow 2 — Daily High-Risk Report to Admin

**Trigger:** Every day at 8:00 AM
**Action:** Fetch today's appointments → filter high-risk → send summary to admin via backend

```
[Schedule Trigger]
  Cron: 0 8 * * *  (8 AM daily)
      │
      ▼
[HTTP Request]
  GET http://localhost:5000/api/appointments/today
  Auth: SmartDentalOps credential
      │
      ▼
[Code Node]
  Filter high-risk, build message
      │
      ▼
[IF Node]
  {{ $json.count }} > 0
      │
     YES
      │
      ▼
[HTTP Request]
  POST http://localhost:5000/api/sms/send-custom
  Auth: SmartDentalOps credential
  Body: { phone: "ADMIN_PHONE", message: "{{$json.message}}" }
```

**Code Node (JavaScript):**
```javascript
const appointments = $input.first().json;
const highRisk = appointments.filter(a => a.noShowProbability > 0.5);

const lines = highRisk.map(a => {
  const time = new Date(a.scheduledAt).toLocaleTimeString('en-US', {
    hour: '2-digit', minute: '2-digit'
  });
  const pct = Math.round(a.noShowProbability * 100);
  return `• ${time} — ${a.patient.firstName} ${a.patient.lastName} (${a.procedure}) — ${pct}% risk`;
});

const message = highRisk.length > 0
  ? `🦷 High-Risk Today (${highRisk.length}/${appointments.length}):\n${lines.join('\n')}`
  : '';

return [{ json: { count: highRisk.length, message } }];
```

---

## Workflow 3 — Weekly Overdue Payment Alert

**Trigger:** Every Monday at 9:00 AM
**Action:** Fetch overdue payments → send WhatsApp summary to admin via backend

```
[Schedule Trigger]
  Cron: 0 9 * * 1  (9 AM every Monday)
      │
      ▼
[HTTP Request]
  GET http://localhost:5000/api/analytics/alerts
  Auth: SmartDentalOps credential
      │
      ▼
[Code Node]
  Extract overduePayments, calculate total
      │
      ▼
[IF Node]
  {{ $json.count }} > 0
      │
     YES
      │
      ▼
[HTTP Request]
  POST http://localhost:5000/api/sms/send-custom
  Auth: SmartDentalOps credential
  Body: { phone: "ADMIN_PHONE", message: "{{$json.message}}" }
```

**Code Node (JavaScript):**
```javascript
const data = $input.first().json;
const overdue = data.overduePayments || [];

const lines = overdue.map(p => `• ${p.message}`);
const message = `💰 Overdue Payments (${overdue.length}):\n${lines.join('\n')}`;

return [{ json: { count: overdue.length, message } }];
```

---

## How the Bridge Works

```
n8n                          Smart DentalOps Backend         Twilio
 │                                    │                         │
 │  POST /api/sms/send-custom         │                         │
 │  { phone, message }                │                         │
 │ ─────────────────────────────────► │                         │
 │                                    │  sendSMS(phone, msg)    │
 │                                    │ ──────────────────────► │
 │                                    │                         │  WhatsApp
 │                                    │                         │ ─────────►
 │                                    │                         │  Patient
 │  { success: true }                 │                         │
 │ ◄───────────────────────────────── │                         │
```

n8n only needs one credential (the JWT token for the backend API).
Twilio credentials stay only in the backend `.env` — never exposed to n8n.

---

## Summary

| Workflow | Trigger | n8n calls | Result |
|---|---|---|---|
| Appointment Confirmation | Webhook from backend | POST /api/sms/send-custom | WhatsApp to patient |
| Daily Risk Report | 8 AM cron | GET /api/appointments/today → POST /api/sms/send-custom | WhatsApp to admin |
| Overdue Payment Alert | Monday 9 AM cron | GET /api/analytics/alerts → POST /api/sms/send-custom | WhatsApp to admin |

All messaging goes through the backend. n8n is purely the orchestration layer.

