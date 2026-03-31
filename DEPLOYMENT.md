# Smart DentalOps — Deployment Guide

## Option A: Local Development (Recommended for Testing)

### Prerequisites

Install the following before starting:

| Tool | Version | Download |
|---|---|---|
| Node.js | 22+ | https://nodejs.org |
| Python | 3.11–3.13 | https://www.python.org/downloads |
| PostgreSQL | 16 | https://www.postgresql.org/download |
| Git | Latest | https://git-scm.com |
| ngrok | Latest | https://ngrok.com/download |

---

### Step 1 — Clone the Repository

```bash
git clone https://github.com/YOUR_USERNAME/smart-dentalops.git
cd smart-dentalops
```

---

### Step 2 — Configure Environment

```bash
cd backend
cp .env.example .env
```

Edit `backend/.env`:

```env
DATABASE_URL="postgresql://postgres:password@localhost:5432/dentalops"
JWT_SECRET="your-strong-secret-key-here"
PORT=5000
ML_SERVICE_URL="http://localhost:8000"
NLP_SERVICE_URL="http://localhost:8001"
DURATION_SERVICE_URL="http://localhost:8002"
ANN_SERVICE_URL="http://localhost:8003"
TWILIO_SID="ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
TWILIO_AUTH_TOKEN="your_auth_token"
TWILIO_PHONE="+14155238886"
```

---

### Step 3 — Database Setup

```bash
# Create the database (run in psql or pgAdmin)
CREATE DATABASE dentalops;

# From backend folder
cd backend
npm install
npx prisma db push
node prisma/seed.js
```

---

### Step 4 — Start All Services

Open **7 separate terminals** and run one command in each:

**Terminal 1 — Backend API**
```bash
cd smart-dentalops/backend
node src/index.js
```
Expected output: `Server running on port 5000`

**Terminal 2 — Frontend**
```bash
cd smart-dentalops/frontend
npm install
npm run dev
```
Expected output: `Local: http://localhost:3000`

**Terminal 3 — No-Show ML Service (Logistic Regression)**
```bash
cd smart-dentalops/ml-service
pip install -r requirements.txt
python train.py
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

**Terminal 4 — NLP Sentiment Service**
```bash
cd smart-dentalops/nlp-service
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8001 --reload
```

**Terminal 5 — Duration Prediction Service**
```bash
cd smart-dentalops/duration-service
pip install -r requirements.txt
python train.py
uvicorn main:app --host 0.0.0.0 --port 8002 --reload
```

**Terminal 6 — ANN No-Show Service (PyTorch)**
```bash
cd smart-dentalops/ann-service
pip install -r requirements.txt
python train.py
uvicorn main:app --host 0.0.0.0 --port 8003 --reload
```

**Terminal 7 — ngrok (for WhatsApp webhooks)**
```bash
ngrok start --all
```

---

### Step 5 — Verify All Services

Open your browser and check each health endpoint:

```
http://localhost:5000/api/health   → {"status":"ok"}
http://localhost:8000/health       → {"status":"ok","model_loaded":true}
http://localhost:8001/health       → {"status":"ok"}
http://localhost:8002/health       → {"status":"ok","model_loaded":true}
http://localhost:8003/health       → {"status":"ok","model_loaded":true}
```

---

### Step 6 — Access the Application

Open: **http://localhost:3000**

Login credentials:

| Email | Password | Role |
|---|---|---|
| admin@dentalops.com | password123 | Admin |
| dr.smith@dentalops.com | password123 | Dentist |
| dr.jones@dentalops.com | password123 | Dentist |
| staff@dentalops.com | password123 | Staff |

---

### Step 7 — WhatsApp Setup (Optional)

1. Send `join chamber-temperature` to **+1 415 523 8886** on WhatsApp
2. Run `ngrok start --all` — note the two HTTPS URLs
3. Go to [Twilio Sandbox Settings](https://console.twilio.com/us1/develop/sms/try-it-out/whatsapp-learn)
4. Set "When a message comes in" to: `https://<backend-ngrok-url>/api/sms/reply`
5. Method: POST → Save

---

## Option B: Docker (Backend + Database Only)

### Prerequisites
- Docker Desktop installed and running

### Run

```bash
cd smart-dentalops
docker-compose up --build
```

This starts:
- PostgreSQL on port 5432
- Node.js backend on port 5000 (runs `prisma migrate deploy` on startup)

Run ML services separately using the terminal commands from Option A.

---

## Option C: DigitalOcean VPS (Production)

### Step 1 — Create a Droplet

- Go to [digitalocean.com](https://digitalocean.com)
- Create Droplet: Ubuntu 22.04, 2GB RAM ($12/month)
- Add your SSH key

### Step 2 — Connect and Install Dependencies

```bash
ssh root@YOUR_DROPLET_IP

# Update system
apt update && apt upgrade -y

# Install Node.js 22
curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
apt install -y nodejs

# Install Python 3.11
apt install -y python3.11 python3.11-venv python3-pip

# Install PostgreSQL
apt install -y postgresql postgresql-contrib

# Install Nginx
apt install -y nginx

# Install PM2 (process manager)
npm install -g pm2

# Install Git
apt install -y git
```

### Step 3 — Setup PostgreSQL

```bash
sudo -u postgres psql
CREATE DATABASE dentalops;
CREATE USER dentalops WITH PASSWORD 'your_db_password';
GRANT ALL PRIVILEGES ON DATABASE dentalops TO dentalops;
\q
```

### Step 4 — Clone and Configure

```bash
cd /var/www
git clone https://github.com/YOUR_USERNAME/smart-dentalops.git
cd smart-dentalops

# Backend env
cd backend
cp .env.example .env
nano .env
# Set DATABASE_URL, JWT_SECRET, TWILIO credentials, ML service URLs
```

### Step 5 — Install Dependencies and Train Models

```bash
# Backend
cd /var/www/smart-dentalops/backend
npm install
npx prisma migrate deploy
node prisma/seed.js

# Frontend build
cd /var/www/smart-dentalops/frontend
npm install
npm run build

# ML services
cd /var/www/smart-dentalops/ml-service
pip3 install -r requirements.txt
python3 train.py

cd /var/www/smart-dentalops/duration-service
pip3 install -r requirements.txt
python3 train.py

cd /var/www/smart-dentalops/ann-service
pip3 install -r requirements.txt
python3 train.py

cd /var/www/smart-dentalops/nlp-service
pip3 install -r requirements.txt
```

### Step 6 — Start All Services with PM2

```bash
# Backend
pm2 start /var/www/smart-dentalops/backend/src/index.js --name backend

# ML services
pm2 start "uvicorn main:app --host 0.0.0.0 --port 8000" \
  --name ml-service --cwd /var/www/smart-dentalops/ml-service \
  --interpreter python3

pm2 start "uvicorn main:app --host 0.0.0.0 --port 8001" \
  --name nlp-service --cwd /var/www/smart-dentalops/nlp-service \
  --interpreter python3

pm2 start "uvicorn main:app --host 0.0.0.0 --port 8002" \
  --name duration-service --cwd /var/www/smart-dentalops/duration-service \
  --interpreter python3

pm2 start "uvicorn main:app --host 0.0.0.0 --port 8003" \
  --name ann-service --cwd /var/www/smart-dentalops/ann-service \
  --interpreter python3

# Save PM2 config so services restart on reboot
pm2 save
pm2 startup
```

### Step 7 — Configure Nginx

```bash
nano /etc/nginx/sites-available/dentalops
```

Paste this config:

```nginx
server {
    listen 80;
    server_name YOUR_DOMAIN_OR_IP;

    # Frontend (built React app)
    location / {
        root /var/www/smart-dentalops/frontend/dist;
        try_files $uri $uri/ /index.html;
    }

    # Backend API + WebSocket
    location /api {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    # WebSocket
    location /ws {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
    }
}
```

```bash
ln -s /etc/nginx/sites-available/dentalops /etc/nginx/sites-enabled/
nginx -t
systemctl restart nginx
```

### Step 8 — SSL Certificate (HTTPS)

```bash
apt install -y certbot python3-certbot-nginx
certbot --nginx -d YOUR_DOMAIN
```

### Step 9 — Update Twilio Webhook

In Twilio Sandbox Settings, update the webhook URL to:
```
https://YOUR_DOMAIN/api/sms/reply
```

---

## Port Reference

| Port | Service |
|---|---|
| 80 / 443 | Nginx (public) |
| 3000 | React frontend (dev only) |
| 5000 | Express backend |
| 5432 | PostgreSQL |
| 8000 | No-show LR service |
| 8001 | NLP sentiment service |
| 8002 | Duration prediction service |
| 8003 | ANN no-show service |

---

## Useful Commands

```bash
# Check all PM2 processes
pm2 list

# View logs
pm2 logs backend
pm2 logs ml-service

# Restart a service
pm2 restart backend

# Re-seed database
cd /var/www/smart-dentalops/backend
node prisma/seed.js

# Retrain ML models
cd /var/www/smart-dentalops/ml-service && python3 train.py
cd /var/www/smart-dentalops/ann-service && python3 train.py
cd /var/www/smart-dentalops/duration-service && python3 train.py

# Manually trigger WhatsApp reminders
cd /var/www/smart-dentalops/backend
node -e "require('./src/services/reminder.service').sendReminders().then(n => console.log('Sent:', n))"
```

---

## Troubleshooting

| Problem | Solution |
|---|---|
| `EADDRINUSE: port 5000` | Kill the process: `npx kill-port 5000` |
| `Invalid token` | Re-login to get a fresh JWT |
| `Model not loaded` | Run `python train.py` in the service folder |
| `EPERM: prisma generate` | Stop the backend server first, then regenerate |
| WhatsApp not receiving | Check ngrok tunnel is pointing to port 5000 |
| `403 Forbidden` on ngrok | Add ngrok host to `vite.config.js` allowedHosts |
| `procedure is not defined` | Restart backend after code changes |
