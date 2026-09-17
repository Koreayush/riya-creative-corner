# Production Deployment Guide — Riyas Creative Corner

This guide outlines the production deployment procedure for **Riya's Creative Corner** (`@riyascreativecorner`).

---

## Architecture Overview

```
User Browser / Instagram Link
         │
         ▼
     Cloudflare / NGINX (SSL / Reverse Proxy)
         │
         ▼
     Node.js Express Server (Port 8085)
   ├── Helmet (Security Headers)
   ├── Rate Limiting Middleware (100 reqs/15m, 15 reqs/15m)
   ├── Static Asset Delivery (`rcc-preview.html`, `photos/`, `uploads/`)
   ├── Authoritative Server-Side Pricing Engine
   ├── Razorpay Live Gateway SDK & HMAC-SHA256 Webhook Handler
   └── Atomic Persistence Layer (`data/db.json`)
```

---

## 1. Prerequisites
- **Server**: Linux VPS (Ubuntu 22.04 LTS / Debian) or container platform (Render, Railway, DigitalOcean, AWS EC2/AppRunner).
- **Node.js**: v18.x or v20.x LTS installed.
- **SSL Certificate**: Let's Encrypt / Cloudflare SSL.
- **Domain**: Registered custom domain (e.g. `riyascreativecorner.com`).

---

## 2. Environment Variables Setup

Copy `.env.example` to `.env` on your production server:

```bash
cp .env.example .env
nano .env
```

Set real production values:
```env
NODE_ENV=production
PORT=8085
CORS_ORIGINS=https://riyascreativecorner.com,https://www.riyascreativecorner.com

RAZORPAY_KEY_ID=rzp_live_YOUR_LIVE_KEY_ID
RAZORPAY_KEY_SECRET=YOUR_LIVE_KEY_SECRET
RAZORPAY_WEBHOOK_SECRET=whsec_YOUR_LIVE_WEBHOOK_SECRET

MERCHANT_UPI_ID=rianandagawli11-1@okhdfcbank
MERCHANT_NAME=Riya's Creative Corner
ADMIN_SECRET=YOUR_STRONG_SECURE_ADMIN_PASSWORD
```

---

## 3. Deployment Options

### Option A: Deployment via PM2 (Recommended for VPS / EC2)

1. Clone repository to server:
   ```bash
   git clone <your-repo-url> /var/www/riyas-creative-corner
   cd /var/www/riyas-creative-corner
   ```

2. Install production dependencies:
   ```bash
   npm ci --only=production
   ```

3. Start application using PM2 process manager:
   ```bash
   npm install -g pm2
   pm2 start server.js --name "riyas-creative-corner"
   pm2 save
   pm2 startup
   ```

### Option B: Deployment via Docker / Docker Compose

1. Build and start using Docker Compose:
   ```bash
   docker-compose up -d --build
   ```

2. Verify container status and health check:
   ```bash
   docker ps
   curl http://localhost:8085/api/health
   ```

### Option C: Deployment via Render (Cloud Platform)

1. Log in to [Render Dashboard](https://dashboard.render.com).
2. Click **New +** → **Web Service**.
3. Connect your GitHub repository (`riya-creative-corner`).
4. Settings:
   - **Environment**: Node (or Docker)
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
5. Add Environment Variables in Render Dashboard (`RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`, `MERCHANT_UPI_ID`, `ADMIN_SECRET`).
6. Click **Create Web Service**. Render will deploy your application.

---

## 4. NGINX Reverse Proxy & SSL Configuration

Example NGINX site configuration (`/etc/nginx/sites-available/riyascreativecorner`):

```nginx
server {
    listen 80;
    server_name riyascreativecorner.com www.riyascreativecorner.com;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    server_name riyascreativecorner.com www.riyascreativecorner.com;

    ssl_certificate /etc/letsencrypt/live/riyascreativecorner.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/riyascreativecorner.com/privkey.pem;

    client_max_body_size 10M;

    location / {
        proxy_pass http://127.0.0.1:8085;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

---

## 5. Razorpay Production Webhook Configuration

1. Log in to [Razorpay Dashboard](https://dashboard.razorpay.com).
2. Switch mode to **Live Mode**.
3. Navigate to **Settings** → **Webhooks** → **Add New Webhook**.
4. Enter Webhook URL:
   `https://riyascreativecorner.com/api/webhooks/razorpay`
5. Enter Webhook Secret: Must match `RAZORPAY_WEBHOOK_SECRET` in `.env`.
6. Enable Events:
   - `order.paid`
   - `payment.captured`
   - `payment.failed`

---

## 6. Health Check & Monitoring

Verify application status via health endpoint:
```bash
curl -s https://riyascreativecorner.com/api/health
```

Expected Response:
```json
{
  "status": "healthy",
  "timestamp": "2026-09-17T15:56:00.000Z",
  "uptimeSeconds": 3600,
  "environment": "production",
  "memory": {
    "rssMB": 42,
    "heapTotalMB": 24,
    "heapUsedMB": 18
  }
}
```

---

## 7. Data Backup & Persistence

All store catalog, inventory, coupon, order, and payment data are persisted in:
- `data/db.json`
- `uploads/`

Ensure periodic automated backups of the `data/` and `uploads/` directories using a cron job:
```bash
0 2 * * * tar -czf /backups/rcc_db_$(date +\%F).tar.gz /var/www/riyas-creative-corner/data /var/www/riyas-creative-corner/uploads
```
