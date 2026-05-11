# Smart DentalOps — Docker VPS Deployment

Runs everything in Docker with auto-restart. Services survive reboots and SSH disconnects.

## What you get

| Container | Port | Exposed publicly |
|---|---|---|
| frontend (nginx) | 80 | yes |
| backend | 5000 | no (proxied via frontend) |
| postgres | 5432 | no |
| ml-service | 8000 | no |
| nlp-service | 8001 | no |
| duration-service | 8002 | no |
| ann-service | 8003 | no |

Only port 80 (and 443 after SSL) is open to the internet. Everything else stays on the internal Docker network.

## 1. VPS prerequisites

Ubuntu 22.04, minimum 4GB RAM (the NLP + ANN services load PyTorch). 2GB works with swap but will be slow.

```bash
ssh root@YOUR_VPS_IP

# Firewall
ufw allow OpenSSH
ufw allow 80/tcp
ufw allow 443/tcp
ufw --force enable

# Docker + Compose plugin
curl -fsSL https://get.docker.com | sh
apt install -y docker-compose-plugin git

# Swap (skip if RAM >= 4GB)
fallocate -l 2G /swapfile && chmod 600 /swapfile
mkswap /swapfile && swapon /swapfile
echo '/swapfile none swap sw 0 0' >> /etc/fstab
```

## 2. Clone the repo

```bash
cd /opt
git clone https://github.com/YOUR_USERNAME/smart-dentalops.git
cd smart-dentalops
```

## 3. Configure environment

```bash
cp .env.prod.example .env
nano .env
```

Set at minimum:
- `POSTGRES_PASSWORD` — strong random string
- `JWT_SECRET` — long random string (e.g. `openssl rand -hex 32`)
- `FRONTEND_URL` — `https://your-domain.com` (or `http://YOUR_VPS_IP` for testing)

Twilio and Meta WhatsApp vars are optional. Leave blank if unused.

## 4. Build and start

```bash
docker compose -f docker-compose.prod.yml up -d --build
```

First build takes 5–10 minutes (downloads torch, transformers, DistilBERT model). Subsequent rebuilds are cached.

## 5. Seed the database (first deploy only)

Prisma migrations run automatically in the backend container. Seed data doesn't, so:

```bash
docker compose -f docker-compose.prod.yml exec backend node prisma/seed.js
```

## 6. Verify

```bash
docker compose -f docker-compose.prod.yml ps
```

All containers should show `Up (healthy)` or `Up`.

Hit the frontend: `http://YOUR_VPS_IP`
Login: `admin@dentalops.com` / `password123`

## 7. HTTPS (recommended)

Point your domain's A record to the VPS IP, then:

```bash
# Install certbot on the host
apt install -y certbot

# Stop nginx container briefly
docker compose -f docker-compose.prod.yml stop frontend

# Get cert
certbot certonly --standalone -d your-domain.com

# Mount certs into the nginx container — edit docker-compose.prod.yml:
# frontend service:
#   volumes:
#     - /etc/letsencrypt:/etc/letsencrypt:ro
#   ports:
#     - "80:80"
#     - "443:443"
# Then update frontend/nginx.conf to listen on 443 with ssl_certificate paths.
```

Easier alternative: put Caddy in front. Caddy handles SSL automatically. Ask if you want that version.

## Daily operations

```bash
# View logs
docker compose -f docker-compose.prod.yml logs -f backend
docker compose -f docker-compose.prod.yml logs -f nlp-service

# Restart one service
docker compose -f docker-compose.prod.yml restart backend

# Pull latest code and redeploy
cd /opt/smart-dentalops
git pull
docker compose -f docker-compose.prod.yml up -d --build

# Stop everything
docker compose -f docker-compose.prod.yml down

# Stop + wipe database (DESTRUCTIVE)
docker compose -f docker-compose.prod.yml down -v
```

## Why this survives SSH disconnects and reboots

- `docker compose up -d` runs containers in detached mode (background).
- `restart: unless-stopped` tells Docker to auto-restart each container if it crashes or the VPS reboots.
- Docker itself runs as a systemd service, so it starts on boot.

You can close your SSH session and everything keeps running.

## Troubleshooting

| Problem | Fix |
|---|---|
| `backend` restart loop with prisma error | Check `POSTGRES_PASSWORD` in `.env` matches what compose uses |
| `nlp-service` build fails on slow network | Retry; HF model download is ~250MB |
| Out of memory during build | Add swap (see step 1) or build one service at a time: `docker compose -f docker-compose.prod.yml build nlp-service` |
| Frontend loads but API 502 | `docker compose logs backend` — usually DATABASE_URL or JWT_SECRET missing |
| WebSocket not connecting | Make sure you hit via domain/IP on port 80, not port 3000 |
| Port 80 in use | Stop host nginx: `systemctl stop nginx && systemctl disable nginx` |
