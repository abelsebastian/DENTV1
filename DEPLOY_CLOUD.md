# Smart DentalOps — Cloud Deployment Guide
## Vercel (Frontend) + Railway (Backend + DB + ML Services)

---

## Architecture on Cloud

```
Vercel          → React frontend        (free)
Railway         → Express backend       (free tier)
Railway         → PostgreSQL            (free tier)
Railway         → ml-service  :8000     (free tier)
Railway         → nlp-service :8001     (free tier)
Railway         → duration-service :8002 (free tier)
Railway         → ann-service :8003     (free tier)
```

---

## Step 1 — Push to GitHub

Everything must be on GitHub before deploying.

```bash
cd smart-dentalops
git init
git add .
git commit -m "Initial commit"
```

Create a new repo at https://github.com/new (name it `smart-dentalops`), then:

```bash
git remote add origin https://github.com/YOUR_USERNAME/smart-dentalops.git
git branch -M main
git push -u origin main
```

---

## Step 2 — Deploy Backend on Railway

### 2.1 Create Railway account
Go to https://railway.app and sign up with GitHub.

### 2.2 Add PostgreSQL database
1. Click **New Project**
2. Click **Add a Service** → **Database** → **PostgreSQL**
3. Railway creates the DB and auto-generates `DATABASE_URL`

### 2.3 Deploy the backend
1. In the same project, click **Add a Service** → **GitHub Repo**
2. Select your `smart-dentalops` repo
3. Set **Root Directory** to: `smart-dentalops/backend`
4. Railway auto-detects Node.js

### 2.4 Set environment variables
In the backend service → **Variables** tab, add:

```
DATABASE_URL          = (auto-filled from PostgreSQL service — click "Add Reference")
JWT_SECRET            = your-strong-secret-key-change-this
PORT                  = 5000
FRONTEND_URL          = https://your-app.vercel.app
ML_SERVICE_URL        = https://your-ml-service.up.railway.app
NLP_SERVICE_URL       = https://your-nlp-service.up.railway.app
DURATION_SERVICE_URL  = https://your-duration-service.up.railway.app
ANN_SERVICE_URL       = https://your-ann-service.up.railway.app
TWILIO_SID            = ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN     = your_auth_token
TWILIO_PHONE          = +14155238886
```

> Note: Fill ML service URLs after deploying them in Step 3.

### 2.5 Set start command
In the backend service → **Settings** → **Deploy** → **Start Command**:

```
npx prisma migrate deploy && node src/index.js
```

### 2.6 Seed the database
After first deploy, open Railway's terminal for the backend service and run:

```bash
node prisma/seed.js
```

### 2.7 Get your backend URL
Railway gives you a URL like: `https://smart-dentalops-backend.up.railway.app`
Save this — you'll need it for Vercel.

---

## Step 3 — Deploy ML Services on Railway

Deploy each Python service as a **separate Railway service** in the same project.

### For each ML service (repeat 4 times):

1. Click **Add a Service** → **GitHub Repo**
2. Select `smart-dentalops` repo
3. Set **Root Directory** to the service folder:
   - `smart-dentalops/ml-service`
   - `smart-dentalops/nlp-service`
   - `smart-dentalops/duration-service`
   - `smart-dentalops/ann-service`

4. Set **Start Command** for each:

| Service | Root Directory | Start Command |
|---|---|---|
| ml-service | smart-dentalops/ml-service | `python train.py && uvicorn main:app --host 0.0.0.0 --port $PORT` |
| nlp-service | smart-dentalops/nlp-service | `uvicorn main:app --host 0.0.0.0 --port $PORT` |
| duration-service | smart-dentalops/duration-service | `python train.py && uvicorn main:app --host 0.0.0.0 --port $PORT` |
| ann-service | smart-dentalops/ann-service | `python train.py && uvicorn main:app --host 0.0.0.0 --port $PORT` |

> Railway injects `$PORT` automatically — no need to hardcode port numbers.

5. After each service deploys, copy its Railway URL and paste it into the backend service's environment variables (ML_SERVICE_URL, etc.)

---

## Step 4 — Deploy Frontend on Vercel

### 4.1 Create Vercel account
Go to https://vercel.com and sign up with GitHub.

### 4.2 Import project
1. Click **Add New Project**
2. Import your `smart-dentalops` GitHub repo
3. Set **Root Directory** to: `smart-dentalops/frontend`
4. Framework preset: **Vite** (auto-detected)

### 4.3 Set environment variables
In Vercel project settings → **Environment Variables**:

```
VITE_API_URL   = https://smart-dentalops-backend.up.railway.app
VITE_WS_URL    = wss://smart-dentalops-backend.up.railway.app
```

### 4.4 Deploy
Click **Deploy**. Vercel builds the React app and gives you a URL like:
`https://smart-dentalops.vercel.app`

### 4.5 Update backend FRONTEND_URL
Go back to Railway → backend service → Variables:
```
FRONTEND_URL = https://smart-dentalops.vercel.app
```
Redeploy the backend service.

---

## Step 5 — Update Twilio Webhook

Go to [Twilio WhatsApp Sandbox Settings](https://console.twilio.com/us1/develop/sms/try-it-out/whatsapp-learn):

Set "When a message comes in":
```
https://smart-dentalops-backend.up.railway.app/api/sms/reply
```
Method: `POST` → Save

---

## Step 6 — Verify Deployment

Check all health endpoints:

```
https://your-backend.up.railway.app/api/health
https://your-ml-service.up.railway.app/health
https://your-nlp-service.up.railway.app/health
https://your-duration-service.up.railway.app/health
https://your-ann-service.up.railway.app/health
```

All should return `{"status":"ok","model_loaded":true}`

Open the frontend: `https://smart-dentalops.vercel.app`

Login with:
```
admin@dentalops.com / password123
```

---

## Final URL Map

| Service | URL |
|---|---|
| Frontend | https://smart-dentalops.vercel.app |
| Backend API | https://smart-dentalops-backend.up.railway.app |
| API Docs | https://smart-dentalops-backend.up.railway.app/api/docs |
| No-Show LR | https://your-ml-service.up.railway.app |
| NLP Sentiment | https://your-nlp-service.up.railway.app |
| Duration ML | https://your-duration-service.up.railway.app |
| ANN No-Show | https://your-ann-service.up.railway.app |

---

## Troubleshooting

| Problem | Fix |
|---|---|
| Backend crashes on Railway | Check logs — likely missing env var. Add it in Variables tab |
| `prisma migrate deploy` fails | Make sure `DATABASE_URL` is linked from the PostgreSQL service |
| ML service 503 on first request | Model is still training — wait 2–3 minutes after deploy |
| CORS error on frontend | Set `FRONTEND_URL` in backend env to your exact Vercel URL |
| WebSocket not connecting | Make sure `VITE_WS_URL` uses `wss://` not `ws://` |
| Vercel build fails | Check that Root Directory is set to `smart-dentalops/frontend` |

---

## Notes on Railway Free Tier

- Free tier gives $5/month credit
- Each service sleeps after 30 minutes of inactivity (cold start ~10s)
- To avoid cold starts, upgrade to Railway Hobby plan ($5/month flat)
- PostgreSQL data persists even when services sleep
