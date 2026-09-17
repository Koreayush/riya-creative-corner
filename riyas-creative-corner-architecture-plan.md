# Riyas Creative Corner — Architecture & Implementation Plan

*Handcrafted flowers, made e-commerce. This document is the build spec: architecture, schema, flows, design system, folder structure, and a phased roadmap. Prices, products, and reviews referenced anywhere in this plan or the prototype are placeholder demo content — none of it is real business data.*

---

## 1. Product summary

A mobile-first storefront + custom-order platform for an Instagram/YouTube handmade-flower creator, built so an Instagram follower can go **Bio → Shop or Builder → Checkout → Order** in a few minutes, with WhatsApp as a fallback for anyone who still wants a human. The standout feature is the **Create Your Own Bouquet** configurator — it needs to feel like the most polished thing on the site, since it's the thing that replaces "DM to order."

## 2. Tech stack (decision + reasoning)

| Layer | Choice | Why |
|---|---|---|
| Frontend | Next.js 14 (App Router) + TypeScript | SSR/ISR for SEO on product pages, file-based routing, server actions cut down on boilerplate API routes |
| Styling | Tailwind CSS + shadcn/ui | Fast, consistent, easy to keep a real design system instead of ad-hoc CSS |
| Backend | Next.js Route Handlers + Server Actions (not a separate FastAPI service) | One deployable unit is simpler to ship and maintain for a single-merchant MVP; the service layer is still isolated (see §8) so it can be split out later if SaaS scale demands it |
| Database | PostgreSQL | Relational integrity for orders/inventory/payments matters more than schema flexibility here |
| ORM | Prisma | Type-safe queries, migrations, good fit with Next.js |
| Auth | Auth.js (NextAuth) with credentials + Google OAuth, sessions in DB | Production-ready, no need to hand-roll JWT/session logic |
| File storage | S3-compatible bucket (AWS S3 or Cloudflare R2) via presigned URLs | Product photos, videos, and customer reference-image uploads never touch the app server |
| Payments | Razorpay (Orders API + Webhooks) | India-first, supports UPI/cards/netbanking/wallets |
| Messaging | `wa.me` deep links (no WhatsApp Business API needed for MVP) | Zero-cost, no approval process, matches current DM-based workflow |
| Hosting | Vercel (app) + managed Postgres (Neon/RDS) + S3/R2 | Minimal ops burden for a small team |
| Background jobs | Vercel Cron / a lightweight queue (e.g. Inngest) for abandoned-cart emails, order-status reminders | Decouples slow/async work from request cycle |

---

## 3. Database schema (core entities)

Multi-tenant-ready from day one via a `Store` table, even though only one store exists initially — every merchant-owned table carries `storeId`.

```
Store          id, slug, name, whatsappNumber, instagramHandle, youtubeUrl, heroHeading,
               heroSubheading, contactEmail, shippingConfigJson, createdAt

User           id, storeId?, email, phone, passwordHash?, role[CUSTOMER|ADMIN|SUPERADMIN],
               name, createdAt

CustomerProfile  id, userId, defaultAddressId, marketingOptIn

Address        id, userId, label, line1, line2, city, state, pincode, phone, isDefault

Category       id, storeId, name, slug, parentId?, sortOrder, imageUrl

Product        id, storeId, categoryId, productType[INDIVIDUAL_FLOWER|BOUQUET|BUNDLE|GIFT|ACCESSORY],
               name, slug, description, careInstructions, basePrice, discountPrice?, sku,
               flowerType[ROSE|TULIP|SUNFLOWER|LILY|MIXED|OTHER]?, occasionTags[], isCustomizable,
               isBestseller, isNewArrival, prepTimeHours, status[DRAFT|ACTIVE|ARCHIVED],
               seoTitle, seoDescription, ogImageUrl

ProductImage   id, productId, url, altText, sortOrder
ProductVideo   id, productId, url, thumbnailUrl

ProductVariant id, productId, unitLabel (e.g. "1 Stem", "3 Stems Trio", "5 Stems Bundle", "Medium Bouquet"),
               stemCount?, size[MINI|SMALL|MEDIUM|LARGE|PREMIUM]?, color?, price, mrp?, sku

Inventory      id, variantId, quantityOnHand, lowStockThreshold

BouquetFlower  id, storeId, name, pricePerStem, colorOptions[], isActive
WrappingOption id, storeId, name, priceDelta, isActive
AccessoryOption id, storeId, name, priceDelta, isActive

BouquetConfiguration   id, userId?, sessionId?, flowersJson, colorsJson, size,
                        wrappingId, accessoryIds[], message, referenceImageUrl,
                        deliveryDate?, computedPrice, savedName?, createdAt

Cart           id, userId?, sessionId, createdAt
CartItem       id, cartId, productId?, variantId?, bouquetConfigurationId?, customOrderId?,
               quantity, personalization, giftMessage, unitPrice

Order          id, storeId, userId, addressId, subtotal, shippingFee, discount, tax, total,
               status[PENDING|CONFIRMED|PROCESSING|CUSTOMIZATION|READY_TO_SHIP|SHIPPED|
                       DELIVERED|CANCELLED],
               paymentId?, deliveryDate?, createdAt
OrderItem      id, orderId, productId?, variantId?, bouquetConfigurationId?, customOrderId?,
               quantity, unitPrice, personalization, giftMessage

CustomOrder    id, storeId, userId, requestId (human-readable e.g. #RC1024), productType,
               occasion, preferredFlowers, preferredColors, budgetBand, size, quantity,
               deliveryDate?, recipientDetails, message, additionalInstructions,
               status[REQUESTED|REVIEWING|QUOTE_SENT|CUSTOMER_APPROVED|PAYMENT_PENDING|
                       IN_PRODUCTION|READY|SHIPPED|DELIVERED|REJECTED],
               quotedPrice?, adminNotes, createdAt
CustomRequestImage  id, customOrderId, url

Payment        id, orderId, razorpayOrderId, razorpayPaymentId?, razorpaySignature?,
               amount, status[CREATED|AUTHORIZED|CAPTURED|FAILED|REFUNDED], rawWebhookJson

Coupon         id, storeId, code, type[PERCENT|FIXED], value, minOrderAmount, usageLimit,
               timesUsed, firstOrderOnly, expiresAt

Review         id, productId, userId, orderId (proves verified purchase), rating, text,
               imageUrls[], isApproved, createdAt

Wishlist       id, userId, productId, createdAt

ShippingRule   id, storeId, zoneName, pincodePrefixes[], flatFee, freeAboveAmount,
               estimatedDaysMin, estimatedDaysMax, expressAvailable, expressFee

Delivery       id, orderId, courierName?, trackingNumber?, status, estimatedDate, updatedAt

Notification   id, userId, type, payload, isRead, createdAt

AnalyticsEvent id, storeId, sessionId, userId?, eventType[PAGE_VIEW|PRODUCT_VIEW|
                ADD_TO_CART|CHECKOUT_STARTED|PURCHASE|CUSTOM_REQUEST_SUBMITTED],
               utmSource, utmMedium, utmCampaign, metadataJson, createdAt
```

Indexes worth calling out: `Product(storeId, status, categoryId)`, `Order(userId, status)`, `AnalyticsEvent(storeId, eventType, createdAt)`, unique constraint on `Coupon(storeId, code)`.

---

## 4. API surface (representative, not exhaustive)

```
GET    /api/products                 filter by category, tag, bestseller, price range
GET    /api/products/[slug]
POST   /api/bouquet-config           save a builder configuration, returns computedPrice
POST   /api/custom-orders            submit a custom request → creates requestId, notifies admin
GET    /api/custom-orders/[id]       customer status view
PATCH  /api/admin/custom-orders/[id] admin: notes, quote, status transition
POST   /api/cart/items               add product / bouquet-config / custom-order to cart
POST   /api/checkout/session         validates cart, shipping rule, creates Razorpay order
POST   /api/webhooks/razorpay        signature-verified payment confirmation (server-only trust)
GET    /api/orders/[id]/track
POST   /api/uploads/presign          returns a presigned S3 URL for reference-image uploads
GET    /api/admin/analytics/summary
```

Rule that matters most: **order status only ever flips to "paid" from the Razorpay webhook after signature verification** — the frontend's return from checkout never writes payment state directly.

---

## 5. Primary user flows

**Discovery → purchase (Standard products: individual flowers, bundles, bouquets, gifts)**
Instagram bio link → Home / Shop All → category filter (Individual Flowers, Bouquets, Bundles, Gifts) or search → Product detail page / modal → select configurable variant (e.g. 1 stem, 3 stems, 5 stems, 10 stems) + color selection → Add to cart / Buy now with contextual cross-selling ("You might also like" / "Complete the gift") → Checkout (guest or logged in) → address → shipping rule applied → Razorpay → webhook confirms → Order confirmation → tracking page.

**Create Your Own Bouquet**
Flowers + quantities → colors → size → wrapping → accessories → message → optional reference image upload → optional delivery date → live price panel updates after every step → preview summary → "Add Custom Bouquet to Cart" → same checkout as above.

**Custom product request (quote-based)**
Form (product type, occasion, flowers, colors, budget, size, delivery date, recipient, message, reference image) → submit → status `Requested`, `requestId` shown + WhatsApp deep link pre-filled with it → admin reviews, sets price, sends quote → customer approves → payment link → `In Production` → `Shipped` → `Delivered`, all visible on the customer's account.

## 6. Admin flows

Dashboard (sales, pending orders, custom requests, low stock) → **Products Management (CRUD for individual flower stems, bundles, bouquets, gifts with tier pricing/variants per stem count, images/video, colors, inventory, bestseller/new-arrival flags without developer code changes)** → Orders (status board) → Custom Orders (review → note → quote → approve/reject → production tracking) → Coupons → Reviews (moderation queue) → Storefront content (hero copy, banners, FAQ, shipping info, contact/WhatsApp number) — all editable without a deploy.

---

## 7. Design system

**Why not the obvious look:** the templated default for "handmade + premium" right now is cream background + serif headline + terracotta accent — which is legible but has become the generic AI-storefront look. This brand is younger, more Instagram-native, and slightly playful, so the palette leans into a muted botanical rose + moss green instead of terracotta, and the display type has more character (a "wonky," slightly irregular serif that reads handcrafted rather than corporate-elegant).

- **Color**
  - `--paper: #FAF6F0` (warm background, not stark white)
  - `--ink: #2A251F` (text)
  - `--rose: #B4707B` (primary brand accent — dusty, not bubblegum pink)
  - `--moss: #4F5D40` (secondary accent — buttons, badges; gives the "botanical" not "candy" feel)
  - `--blush: #F1DEDA` (soft section backgrounds)
  - `--gold: #C39A56` (small premium accents — bestseller badges, dividers)
- **Type:** Fraunces (display serif with visible ink-trap/wonky character for headlines) + Work Sans (body/UI). Two families, clearly distinct roles, no third face.
- **Layout:** asymmetric hero (image dominant, copy left-aligned, not centered-hero-with-two-buttons default), Instagram-grid-inspired square product tiles instead of generic rounded SaaS cards with uniform shadow.
- **Motion:** one deliberate reveal on the builder's price panel when it updates; hover states are simple opacity/scale, not on every element.
- **Components to standardize:** buttons (primary/secondary/ghost), product card, category chip, price display (with strikethrough original price), step indicator, badge (bestseller/new/demo), toast, empty state, skeleton loader.

---

## 8. Folder structure (Next.js app)

```
/app
  /(storefront)/page.tsx                  Home
  /(storefront)/shop/page.tsx
  /(storefront)/product/[slug]/page.tsx
  /(storefront)/builder/page.tsx          Create Your Own Bouquet
  /(storefront)/custom/page.tsx           Custom Product request
  /(storefront)/cart/page.tsx
  /(storefront)/checkout/page.tsx
  /(storefront)/orders/[id]/page.tsx      tracking
  /(storefront)/account/*
  /(admin)/admin/*                        dashboard, products, orders, custom-orders, coupons
  /api/*                                  route handlers listed in §4
/components
  /ui                                     shadcn primitives
  /storefront                             ProductCard, BouquetStep, PriceSummary, WhatsAppButton...
  /admin
/lib
  /db (prisma client)
  /services (pricing.ts, shipping.ts, razorpay.ts, whatsapp.ts, analytics.ts)
  /auth
/prisma/schema.prisma
```

`lib/services` is the seam that lets this become multi-tenant SaaS later — every service function takes a `storeId` even though there's one store today, so nothing has to be rewritten to add a second merchant.

---

## 9. Environment variables

```
DATABASE_URL=
NEXTAUTH_SECRET=
NEXTAUTH_URL=
GOOGLE_CLIENT_ID= / GOOGLE_CLIENT_SECRET=
RAZORPAY_KEY_ID= / RAZORPAY_KEY_SECRET= / RAZORPAY_WEBHOOK_SECRET=
S3_BUCKET= / S3_REGION= / S3_ACCESS_KEY_ID= / S3_SECRET_ACCESS_KEY=
NEXT_PUBLIC_WHATSAPP_NUMBER=
NEXT_PUBLIC_INSTAGRAM_HANDLE=
NEXT_PUBLIC_YOUTUBE_URL=
```

None of these are ever sent to the client except the `NEXT_PUBLIC_*` display values.

---

## 10. Phased roadmap (as specified)

1. **Phase 1 — foundation:** Home, catalog, product detail, categories, cart, checkout (UI only, mock payment), auth, admin dashboard shell, product + order management.
2. **Phase 2 — the differentiator:** Bouquet builder, custom product request, custom-order status workflow, WhatsApp deep links, reviews, coupons, wishlist.
3. **Phase 3 — money and delivery:** Real Razorpay integration + webhook verification, shipping-rule engine, analytics dashboard + UTM tracking, Instagram gallery (admin-managed URLs), SEO (schema, sitemap, OG images).
4. **Phase 4 — SaaS + AI:** multi-tenant store routing, AI product-description generator, AI bouquet recommender, AI customer support, admin AI custom-order structuring assistant.

**What's built right now, below:** a clickable prototype of Home and the Create Your Own Bouquet builder, in the target visual language, so the design direction can be validated before real engineering starts on Phase 1.
