# ── Build stage ────────────────────────────────────────────────────────────────
FROM node:22-slim AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

# Same-origin: API calls go to /api, WS to /ws — nginx proxies to backend.
ENV VITE_API_URL=""
ENV VITE_WS_URL=""
RUN npm run build

# ── Runtime stage ──────────────────────────────────────────────────────────────
FROM nginx:alpine

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
