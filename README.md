# 🌸 Riyas Creative Corner — Handcrafted Flowers, Bouquets & Gifts E-Commerce

**EverBloom Handcrafted Floral & Gifting Studio by Riya (`@riyascreativecorner`)**

Production-ready, full-stack e-commerce store built with Node.js, Express, React, Tailwind CSS, and Razorpay + UPI payment integration.

---

## Features

- 🌹 **Unified Product Catalog**: Individual flowers (Roses, Tulips, Sunflowers, Lilies), Handcrafted Bouquets, Flower Bundles, Gifts & Accessories.
- 🎨 **Live 2D Bouquet Configurator**: Interactive visualizer showing natural stem fan arrangements, chenille flower heads, wraps, satin ribbons, cards, and pearl garlands.
- 💳 **Dual Payment Gateway Integration**:
  - **Razorpay Online Payments**: Server-side order creation, HMAC-SHA256 signature verification, and secure webhook handler.
  - **Direct Merchant UPI (QR Code / UTR)**: Manual payment submission for `rianandagawli11-1@okhdfcbank` with receipt upload and admin review workflow.
- 🔐 **Visual No-Code Store Manager**:
  - Multi-tab admin panel for Orders, Products CRUD, Coupons management, Inventory controls, and Store Settings.
- 🛡️ **Production Security**:
  - Helmet security headers, rate limiting (100 reqs/15m API, 30 reqs/15m checkout/admin), atomic database persistence (`data/db.json`), production error handler, and MIME-checked file upload handling.

---

## Tech Stack

- **Backend**: Node.js, Express, Helmet, Express Rate Limit, Multer, Razorpay Node SDK, dotenv, Cors.
- **Frontend**: React 18, Babel Standalone, Tailwind CSS, Lucide Icons, Fraunces & Work Sans Google Fonts.
- **Database**: Atomic file-backed JSON database with automated schema migrations.
- **DevOps**: Docker, Docker Compose, PM2, NGINX Reverse Proxy support.

---

## Getting Started

### 1. Installation

```bash
git clone <repo-url>
cd riyas-creative-corner-deliverables
npm install
```

### 2. Environment Configuration

Copy `.env.example` to `.env` and fill in credentials:

```bash
cp .env.example .env
```

### 3. Run Locally

```bash
npm start
```

Visit the website at: `http://localhost:8085/rcc-preview.html`

---

## API Endpoints Overview

| Method | Endpoint | Access | Description |
|---|---|---|---|
| `GET` | `/api/health` | Public | Application health status & memory metrics |
| `GET` | `/api/products` | Public | Live product catalog feed (in-stock only) |
| `POST` | `/api/coupons/validate` | Public | Validate coupon code against subtotal |
| `POST` | `/api/orders/create` | Public | Authoritative server price calculation & order creation |
| `POST` | `/api/payments/verify` | Public | Verify Razorpay payment signature |
| `POST` | `/api/payments/manual-upi` | Public | Submit UTR reference & receipt proof |
| `POST` | `/api/webhooks/razorpay` | Public | Secure Razorpay webhook processing |
| `GET` | `/api/admin/orders` | Admin | Retrieve all customer orders |
| `GET/POST/PUT/DELETE` | `/api/admin/products` | Admin | Product catalog CRUD & stock toggle |
| `GET/POST/PUT/DELETE` | `/api/admin/coupons` | Admin | Coupon management |
| `GET/PUT` | `/api/admin/inventory` | Admin | Inventory stock level controls |
| `GET/PUT` | `/api/admin/settings` | Admin | Store settings (UPI ID, shipping fees, address) |

---

## Production Deployment

Refer to [DEPLOYMENT.md](DEPLOYMENT.md) for detailed instructions on deploying via Docker, PM2, NGINX, and configuring Razorpay live webhooks.
