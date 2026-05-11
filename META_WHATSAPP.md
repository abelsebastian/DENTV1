# Smart DentalOps — Meta WhatsApp Cloud API Integration

Replace Twilio sandbox with Meta's official WhatsApp Cloud API.
Meta pings your backend directly — no Twilio, no sandbox restrictions.

---

## How It Works

```
INBOUND (patient sends message):
  Patient → WhatsApp → Meta Cloud API → POST /api/whatsapp/webhook → Your backend

OUTBOUND (you send message):
  Your backend → POST graph.facebook.com/messages → Meta Cloud API → WhatsApp → Patient
```

---

## Step 1 — Meta Developer Setup

1. Go to https://developers.facebook.com
2. Create a new App → Business type
3. Add **WhatsApp** product to the app
4. Go to WhatsApp → Getting Started
5. You get:
   - **Phone Number ID** (test number provided free)
   - **Access Token** (temporary, make permanent later)
   - **Verify Token** (you create this — any random string)

---

## Step 2 — Add Environment Variables

Add to `smart-dentalops/backend/.env`:

```env
META_ACCESS_TOKEN=EAAxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
META_PHONE_NUMBER_ID=123456789012345
META_VERIFY_TOKEN=my_dental_verify_token_123
```

---

## Step 3 — Create Meta WhatsApp Service

Replace `sms.service.js` with a Meta-based sender:

The service is at `src/services/metaWhatsapp.service.js`.
The webhook route is at `src/routes/whatsapp.js`.

---

## Step 4 — Set Webhook URL in Meta Developer Console

1. Go to your Meta App → WhatsApp → Configuration
2. Set **Webhook URL** to:
   ```
   https://your-backend-url/api/whatsapp/webhook
   ```
3. Set **Verify Token** to the same value as `META_VERIFY_TOKEN` in your `.env`
4. Subscribe to the **messages** webhook field
5. Click Verify and Save

For local testing, use ngrok:
```bash
ngrok http 5000
# Use: https://xxxx.ngrok-free.app/api/whatsapp/webhook
```

---

## Step 5 — How Routing Works

The `sms.service.js` auto-detects which provider to use:

```
META_ACCESS_TOKEN set in .env?
  YES → Use Meta Cloud API (production)
  NO  → Use Twilio sandbox (development)
```

So during development you keep Twilio, and in production you just add the Meta env vars — no code changes needed.

---

## Comparison: Twilio Sandbox vs Meta Cloud API

| Feature | Twilio Sandbox | Meta Cloud API |
|---|---|---|
| Cost | Free (trial limits) | Free up to 1,000 conversations/month |
| Setup | Join sandbox with code | Meta Developer App |
| Phone number | Shared sandbox number | Your own number |
| Inbound messages | Via Twilio webhook | Direct from Meta |
| Production ready | No (sandbox only) | Yes |
| Approval required | No | Yes (for templates) |
| Free-form messages | Only to verified numbers | Yes (within 24h window) |

---

## New Workflow with Meta

```
INBOUND:
  Patient sends WhatsApp
       │
       ▼
  Meta Cloud API
       │  POST /api/whatsapp/webhook
       ▼
  Your Express backend
       │
       ├─ handleBookingFlow()   → multi-step booking
       ├─ getSentiment()        → NLP service
       ├─ detectIntent()        → rule-based
       ├─ predictNoShowANN()    → ANN service
       ├─ Log to Communications
       └─ Smart reply via sendWhatsApp()

OUTBOUND:
  Your backend
       │  POST graph.facebook.com/messages
       ▼
  Meta Cloud API
       │
       ▼
  Patient's WhatsApp
```

No ngrok needed in production — Meta calls your public backend URL directly.

---

## n8n + Meta Bridge

With Meta, the n8n workflows stay the same — they still call `POST /api/sms/send-custom` on your backend. The backend then uses Meta instead of Twilio to deliver the message. Zero changes to n8n workflows.

```
n8n → POST /api/sms/send-custom → backend → Meta Cloud API → WhatsApp
```
