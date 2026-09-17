const express = require("express");
const cors = require("cors");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const multer = require("multer");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 8085;

// Environment config
const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID || "rzp_test_51EverBloomRiya";
const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET || "secret_EverBloomRiyasCorner2026";
const RAZORPAY_WEBHOOK_SECRET = process.env.RAZORPAY_WEBHOOK_SECRET || "whsec_EverBloomWebhookSecret987";
const MERCHANT_UPI_ID = process.env.MERCHANT_UPI_ID || "rianandagawli11-1@okhdfcbank";
const ADMIN_SECRET = process.env.ADMIN_SECRET || "admin123";

// Ensure data & upload directories exist safely (compatible with Vercel serverless read-only filesystem)
const DATA_DIR = path.join(__dirname, "data");
const UPLOAD_DIR = process.env.VERCEL ? path.join("/tmp", "uploads") : path.join(__dirname, "uploads");
const PRODUCT_IMG_DIR = path.join(UPLOAD_DIR, "products");

try {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
} catch (e) {
  console.warn("[SERVERLESS] Using read-only DATA_DIR");
}

try {
  if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  if (!fs.existsSync(PRODUCT_IMG_DIR)) fs.mkdirSync(PRODUCT_IMG_DIR, { recursive: true });
} catch (e) {
  console.warn("[SERVERLESS] Using fallback UPLOAD_DIR in /tmp");
}

// Setup file upload for UPI receipts
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || ".jpg";
    cb(null, `upi_proof_${Date.now()}_${Math.random().toString(36).substring(2, 8)}${ext}`);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith("image/")) cb(null, true);
    else cb(new Error("Only image files are allowed for payment screenshots"));
  }
});

// Setup file upload for product images
const productStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, PRODUCT_IMG_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || ".jpg";
    cb(null, `product_${Date.now()}_${Math.random().toString(36).substring(2, 8)}${ext}`);
  }
});
const productUpload = multer({
  storage: productStorage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith("image/")) cb(null, true);
    else cb(new Error("Only image files are allowed for product images"));
  }
});

// Security Headers (Helmet with customized CSP for Razorpay, Google Fonts, Tailwind & Babel CDN)
app.use(
  helmet({
    contentSecurityPolicy: false, // Disabled full CSP to allow frontend CDN dependencies & embedded Razorpay frame
    crossOriginResourcePolicy: { policy: "cross-origin" }
  })
);

// Rate Limiters
const globalApiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 200, // Limit each IP to 200 requests per 15 mins
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Too many requests from this IP. Please try again after 15 minutes." }
});

const strictAuthLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 30, // Limit sensitive operations (checkout, coupon validate, admin auth)
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "Too many sensitive requests from this IP. Please try again later." }
});

app.use("/api/", globalApiLimiter);
app.use("/api/orders/create", strictAuthLimiter);
app.use("/api/coupons/validate", strictAuthLimiter);
app.use("/api/admin/", strictAuthLimiter);

// Middleware: Raw body capture for webhook signature verification
app.use(express.json({
  verify: (req, res, buf) => {
    if (req.originalUrl.startsWith("/api/webhooks/razorpay")) {
      req.rawBody = buf.toString("utf8");
    }
  }
}));
app.use(express.urlencoded({ extended: true }));

// Production CORS Configuration
const allowedOrigins = process.env.CORS_ORIGINS ? process.env.CORS_ORIGINS.split(",") : null;
app.use(cors(allowedOrigins ? { origin: allowedOrigins, credentials: true } : {}));

// Health Check Endpoint
app.get("/api/health", (req, res) => {
  const memoryUsage = process.memoryUsage();
  res.json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.floor(process.uptime()),
    environment: process.env.NODE_ENV || "development",
    memory: {
      rssMB: Math.round(memoryUsage.rss / 1024 / 1024),
      heapTotalMB: Math.round(memoryUsage.heapTotal / 1024 / 1024),
      heapUsedMB: Math.round(memoryUsage.heapUsed / 1024 / 1024)
    }
  });
});

// Serve static assets
app.use(express.static(__dirname));
app.use("/uploads", express.static(UPLOAD_DIR));

// -------------------------------------------------------------------------------------
// DATABASE (data/db.json) - Atomic File Persistence
// -------------------------------------------------------------------------------------
const DB_FILE = path.join(DATA_DIR, "db.json");

// Default product catalog (seeded into db.json on first run)
const DEFAULT_PRODUCTS = [
  { id: "f-rose", name: "Handcrafted Velvet Red Rose", category: "flowers", flowerType: "rose", tag: "Bestseller", rating: "4.9", reviews: 128, price: 199, mrp: 249, image: "photos/Rose.jpeg", description: "Meticulously hand-twisted red velvet chenille rose with textured sepals and a flexible lifelike stem.", careInstructions: "Everlasting velvet chenille. Never requires watering or sunlight.", colors: ["Velvet Crimson Red", "Soft Blush Pink", "Silk Ivory White"], variants: [{ id: "v1", label: "1 Stem (Single Rose)", price: 199, mrp: 249, count: 1 }, { id: "v2", label: "3 Stems Trio", price: 549, mrp: 747, count: 3, discount: "Save 26%" }, { id: "v3", label: "5 Stems Bundle", price: 899, mrp: 1245, count: 5, discount: "Save 28%" }, { id: "v4", label: "10 Stems Statement Bunch", price: 1699, mrp: 2490, count: 10, discount: "Save 32%" }], relatedIds: ["f-tulip", "f-sunflower", "b-ruby", "g-bear"], inStock: true },
  { id: "f-tulip", name: "Handcrafted Pastel Tulip", category: "flowers", flowerType: "tulip", tag: "Popular", rating: "4.9", reviews: 94, price: 149, mrp: 199, image: "photos/roses.jpeg", description: "Artisan two-tone lilac and candy pink chenille tulip.", careInstructions: "Everlasting flower. Do not wash with water.", colors: ["Lilac Mist & Pink", "Candy Pink", "Warm Peach"], variants: [{ id: "v1", label: "1 Tulip Stem", price: 149, mrp: 199, count: 1 }, { id: "v2", label: "3 Tulips Trio", price: 419, mrp: 597, count: 3, discount: "Save 30%" }, { id: "v3", label: "5 Tulips Bundle", price: 679, mrp: 995, count: 5, discount: "Save 32%" }, { id: "v4", label: "10 Tulips Bunch", price: 1299, mrp: 1990, count: 10, discount: "Save 35%" }], relatedIds: ["f-rose", "f-sunflower", "b-symphony", "g-card"], inStock: true },
  { id: "f-sunflower", name: "Sun-Kissed Chenille Sunflower", category: "flowers", flowerType: "sunflower", tag: "Trending", rating: "4.8", reviews: 82, price: 189, mrp: 249, image: "photos/Sunflowers.jpeg", description: "Radiant golden yellow sunflower with a deep chocolate brown velvet center.", careInstructions: "Durable chenille craft.", colors: ["Golden Sunshine Yellow", "Warm Amber Ochre"], variants: [{ id: "v1", label: "1 Stem", price: 189, mrp: 249, count: 1 }, { id: "v2", label: "3 Stems Trio", price: 519, mrp: 747, count: 3, discount: "Save 30%" }, { id: "v3", label: "5 Stems Meadow Bundle", price: 849, mrp: 1245, count: 5, discount: "Save 32%" }], relatedIds: ["f-rose", "f-lily-pink", "bd-meadow", "g-bear"], inStock: true },
  { id: "f-lily-pink", name: "Velvet Blush Starlight Lily", category: "flowers", flowerType: "lily", tag: "Signature", rating: "5.0", reviews: 67, price: 229, mrp: 299, image: "photos/tulip.jpeg", description: "Statement pink lily with delicate ruffled white-trimmed petals.", careInstructions: "Petals are gently bendable.", colors: ["Blush Pink & White", "Fuchsia & White"], variants: [{ id: "v1", label: "1 Lily Stem", price: 229, mrp: 299, count: 1 }, { id: "v2", label: "3 Lilies Trio", price: 629, mrp: 897, count: 3, discount: "Save 30%" }, { id: "v3", label: "5 Lilies Bundle", price: 999, mrp: 1495, count: 5, discount: "Save 33%" }], relatedIds: ["f-lily-blue", "b-symphony", "f-rose"], inStock: true },
  { id: "f-lily-blue", name: "Royal Azure Striped Lily", category: "flowers", flowerType: "lily", tag: "Rare Exotic", rating: "5.0", reviews: 45, price: 249, mrp: 329, image: "photos/blue%20tulip.jpeg", description: "Striking two-tone cyan and cobalt blue striped velvet petals.", careInstructions: "Handcrafted with premium color-fast chenille velvet.", colors: ["Royal Azure & Cyan", "Deep Cobalt"], variants: [{ id: "v1", label: "1 Stem", price: 249, mrp: 329, count: 1 }, { id: "v2", label: "3 Stems Trio", price: 689, mrp: 987, count: 3, discount: "Save 30%" }, { id: "v3", label: "5 Stems Bundle", price: 1099, mrp: 1645, count: 5, discount: "Save 33%" }], relatedIds: ["f-lily-pink", "b-ruby", "f-tulip"], inStock: true },
  { id: "f-lily-magenta", name: "Starlight Magenta Velvet Lily", category: "flowers", flowerType: "lily", tag: "New Arrival", rating: "4.9", reviews: 39, price: 229, mrp: 299, image: "photos/WhatsApp%20Image%202026-09-12%20at%2013.44.50.jpeg", description: "Vivid magenta center petals with snow-white fringe.", careInstructions: "Gently wipe with dry microfiber cloth.", colors: ["Vivid Magenta & White"], variants: [{ id: "v1", label: "1 Stem", price: 229, mrp: 299, count: 1 }, { id: "v2", label: "3 Stems Trio", price: 629, mrp: 897, count: 3, discount: "Save 30%" }], relatedIds: ["f-rose", "b-wine", "f-lily-pink"], inStock: true },
  { id: "b-symphony", name: "Blush Lily & Tulip Symphony Bouquet", category: "bouquets", flowerType: "mixed", tag: "Bestseller", rating: "4.9", reviews: 84, price: 1399, mrp: 1699, image: "photos/WhatsApp%20Image%202026-09-12%20at%2013.46.53%20(2).jpeg", description: "16 handcrafted stems of soft blush lilies, pink tulips, mini daisies.", wrap: "Blush & White Layered Wrap", stemsInfo: "16 Handcrafted Stems", relatedIds: ["f-rose", "g-bear", "g-card", "a-pearls"], inStock: true },
  { id: "b-ruby", name: "Midnight Crimson Velvet Lilies Bouquet", category: "bouquets", flowerType: "lily", tag: "Statement Piece", rating: "5.0", reviews: 62, price: 1799, mrp: 2199, image: "photos/WhatsApp%20Image%202026-09-12%20at%2013.46.52%20(2).jpeg", description: "12 statement ruby red velvet lilies in pleated black wrap.", wrap: "Midnight Black Pleated Wrap", stemsInfo: "12 Statement Velvet Lilies", relatedIds: ["f-rose", "g-card", "a-pearls"], inStock: true },
  { id: "b-wine", name: "Royal Wine Velvet Lilies Bouquet", category: "bouquets", flowerType: "lily", tag: "Signature", rating: "4.9", reviews: 47, price: 1599, mrp: 1899, image: "photos/WhatsApp%20Image%202026-09-12%20at%2013.46.52%20(1).jpeg", description: "14 deep burgundy velvet lilies with white stamens.", wrap: "Crisp White & Pearls", stemsInfo: "14 Handcrafted Stems", relatedIds: ["f-rose", "g-bear", "g-card"], inStock: true },
  { id: "b-petite", name: "Sweet Petite Peony & Tulip Wrap", category: "bouquets", flowerType: "mixed", tag: "Gift Fav", rating: "4.9", reviews: 53, price: 999, mrp: 1199, image: "photos/WhatsApp%20Image%202026-09-12%20at%2013.46.52.jpeg", description: "8 petite stems including multi-layered pink peony.", wrap: "Translucent White Wrap", stemsInfo: "8 Petite Stems", relatedIds: ["f-tulip", "g-card", "a-pearls"], inStock: true },
  { id: "b-lavender", name: "Lavender & Magenta Dream Wrap", category: "bouquets", flowerType: "mixed", tag: "New", rating: "5.0", reviews: 38, price: 1449, mrp: 1749, image: "photos/WhatsApp%20Image%202026-09-12%20at%2013.46.53%20(1).jpeg", description: "15 stems of two-tone lavender & bright fuchsia tulips.", wrap: "Lilac Translucent Cloud", stemsInfo: "15 Stems Bouquet", relatedIds: ["f-tulip", "g-card", "g-bear"], inStock: true },
  { id: "bd-meadow", name: "Meadow Harmony Trio Stem Bundle", category: "bundles", flowerType: "mixed", tag: "Bundle Value", rating: "4.8", reviews: 31, price: 549, mrp: 699, image: "photos/WhatsApp%20Image%202026-09-12%20at%2013.46.53.jpeg", description: "Curated bunch of 3 assorted artisan blooms.", careInstructions: "Trim or bend stems to match your vase height.", relatedIds: ["f-sunflower", "f-rose", "g-card"], inStock: true },
  { id: "g-bear", name: "Mini Plush Cuddle Bear Keepsake", category: "gifts", tag: "Gift Add-on", rating: "4.9", reviews: 112, price: 299, mrp: 399, image: "photos/WhatsApp%20Image%202026-09-12%20at%2013.46.52.jpeg", description: "Adorable miniature plush bear with satin ribbon bow.", relatedIds: ["f-rose", "b-symphony"], inStock: true },
  { id: "g-card", name: "Wax-Sealed Botanical Greeting Card", category: "gifts", tag: "Handcrafted", rating: "5.0", reviews: 140, price: 79, mrp: 120, image: "photos/WhatsApp%20Image%202026-09-12%20at%2013.46.53%20(2).jpeg", description: "Thick handmade cotton paper card with calligraphy note.", relatedIds: ["f-rose", "f-tulip", "b-symphony"], inStock: true },
  { id: "a-pearls", name: "Lustrous Pearl Garland Wrap Accent", category: "accessories", tag: "Glamour", rating: "4.9", reviews: 58, price: 89, mrp: 149, image: "photos/WhatsApp%20Image%202026-09-12%20at%2013.46.52%20(2).jpeg", description: "Faux pearl garland string to wrap around stems or bouquets.", relatedIds: ["f-rose", "b-ruby"], inStock: true }
];

const DEFAULT_SETTINGS = {
  businessName: "Riyas Creative Corner",
  upiId: "rianandagawli11-1@okhdfcbank",
  deliveryFee: 99,
  freeDeliveryThreshold: 1999,
  address: "Warthi, Bhandara, Maharashtra, India"
};

function getInitialDb() {
  return {
    orders: [],
    payments: [],
    processedWebhooks: [],
    products: JSON.parse(JSON.stringify(DEFAULT_PRODUCTS)),
    inventory: {
      "f-rose": 100,
      "f-tulip": 120,
      "f-sunflower": 80,
      "f-lily-pink": 75,
      "f-lily-blue": 50,
      "f-lily-magenta": 60,
      "b-symphony": 25,
      "b-ruby": 20,
      "b-wine": 15,
      "b-petite": 30,
      "b-lavender": 20,
      "bd-meadow": 40,
      "g-bear": 50,
      "g-card": 200,
      "a-pearls": 100
    },
    coupons: [
      { code: "EVERBLOOM10", type: "PERCENT", value: 10, minOrder: 999, active: true },
      { code: "FIRSTBLOOM", type: "FIXED", value: 150, minOrder: 1299, active: true },
      { code: "RIYASPECIAL", type: "PERCENT", value: 15, minOrder: 1999, active: true }
    ],
    settings: JSON.parse(JSON.stringify(DEFAULT_SETTINGS))
  };
}

function loadDb() {
  if (!fs.existsSync(DB_FILE)) {
    const initial = getInitialDb();
    saveDb(initial);
    return initial;
  }
  try {
    const content = fs.readFileSync(DB_FILE, "utf8");
    const db = JSON.parse(content);
    // Auto-migrate: add missing keys from schema
    let migrated = false;
    if (!db.products || !Array.isArray(db.products) || db.products.length === 0) {
      db.products = JSON.parse(JSON.stringify(DEFAULT_PRODUCTS));
      migrated = true;
    }
    if (!db.settings) {
      db.settings = JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
      migrated = true;
    }
    if (migrated) saveDb(db);
    return db;
  } catch (err) {
    console.error("Error reading db.json, reinitializing:", err);
    const initial = getInitialDb();
    saveDb(initial);
    return initial;
  }
}

function saveDb(data) {
  try {
    const tempFile = DB_FILE + ".tmp";
    fs.writeFileSync(tempFile, JSON.stringify(data, null, 2), "utf8");
    fs.renameSync(tempFile, DB_FILE);
  } catch (err) {
    console.warn("[SERVERLESS] Warning: Could not save db.json to disk (read-only filesystem):", err.message);
  }
}

// -------------------------------------------------------------------------------------
// AUTHORITATIVE CATALOG & PRICE CALCULATION ENGINE (ZERO FRONTEND TRUST)
// -------------------------------------------------------------------------------------
const CATALOG_PRODUCTS = {
  // Individual Flowers with stem package tiers
  "f-rose": {
    name: "Handcrafted Velvet Red Rose",
    category: "flowers",
    stemPricing: { 1: 199, 3: 549, 5: 879, 10: 1699 }
  },
  "f-tulip": {
    name: "Soft Pastel Velvet Tulip",
    category: "flowers",
    stemPricing: { 1: 179, 3: 499, 5: 799, 10: 1549 }
  },
  "f-sunflower": {
    name: "Sun-Kissed Golden Sunflower",
    category: "flowers",
    stemPricing: { 1: 229, 3: 629, 5: 999, 10: 1899 }
  },
  "f-lily-pink": {
    name: "Pink Velvet Ruffled Lily",
    category: "flowers",
    stemPricing: { 1: 249, 3: 699, 5: 1099, 10: 2099 }
  },
  "f-lily-blue": {
    name: "Royal Azure Exotic Lily",
    category: "flowers",
    stemPricing: { 1: 269, 3: 749, 5: 1199, 10: 2299 }
  },
  "f-lily-magenta": {
    name: "Starlight Magenta Velvet Lily",
    category: "flowers",
    stemPricing: { 1: 249, 3: 699, 5: 1099, 10: 2099 }
  },
  // Bouquets
  "b-symphony": { name: "Blush Lily & Tulip Symphony", basePrice: 1599, category: "bouquets" },
  "b-ruby": { name: "Midnight Crimson Velvet Lilies", basePrice: 1799, category: "bouquets" },
  "b-wine": { name: "Royal Wine Velvet Lilies", basePrice: 1899, category: "bouquets" },
  "b-petite": { name: "Sweet Petite Peony & Tulip Wrap", basePrice: 899, category: "bouquets" },
  "b-lavender": { name: "Lavender & Magenta Dream", basePrice: 1699, category: "bouquets" },
  // Bundles & Gifts & Accessories
  "bd-meadow": { name: "Sunny Meadows Chenille Bundle", basePrice: 649, category: "bundles" },
  "g-bear": { name: "Handmade Miniature Plush Bear", basePrice: 299, category: "gifts" },
  "g-card": { name: "Calligraphy Greeting Card with Wax Seal", basePrice: 149, category: "gifts" },
  "a-pearls": { name: "Faux Pearl Pin Accent Wrap", basePrice: 199, category: "accessories" },
};

// Builder Configurator Pricing
const BUILDER_PRICING = {
  stems: { rose: 45, tulip: 60, lily: 90, sunflower: 55, bluelily: 95, magentalily: 90, custom: 99 },
  sizes: { mini: 499, small: 799, medium: 1199, large: 1699, premium: 2499 },
  wraps: { kraft: 0, white: 60, pink: 60, black: 150, lavender: 80 },
  accessories: { ribbon: 49, pearls: 79, card: 69, chocolates: 199, softtoy: 299, nametag: 89 }
};

// Dynamic delivery settings (loaded from DB settings, with hardcoded fallbacks)
function getDeliverySettings() {
  try {
    const db = loadDb();
    return {
      fee: (db.settings && db.settings.deliveryFee) || 99,
      threshold: (db.settings && db.settings.freeDeliveryThreshold) || 1999
    };
  } catch (e) {
    return { fee: 99, threshold: 1999 };
  }
}

const STANDARD_DELIVERY_FEE = 99;
const FREE_DELIVERY_THRESHOLD = 1999;

/**
 * Validates and recalculates cart item price strictly on the server.
 */
function calculateItemServerPrice(item) {
  // 1. Custom Bespoke Bouquet
  if (item.category === "custom" || item.id === "custom-bouquet") {
    const qty = item.builderConfig?.qty || { rose: 4, tulip: 4, lily: 2 };
    const size = item.builderConfig?.size || "medium";
    const wrap = item.builderConfig?.wrap || "white";
    const accessories = item.builderConfig?.accessories || ["ribbon", "pearls"];

    let stemCost = 0;
    Object.entries(qty).forEach(([stemId, count]) => {
      const unitCost = BUILDER_PRICING.stems[stemId] || 60;
      stemCost += unitCost * Math.max(0, parseInt(count) || 0);
    });

    const sizeCost = BUILDER_PRICING.sizes[size] || BUILDER_PRICING.sizes.medium;
    const wrapCost = BUILDER_PRICING.wraps[wrap] || 0;
    let accCost = 0;
    accessories.forEach(accId => {
      accCost += BUILDER_PRICING.accessories[accId] || 0;
    });

    const singleUnitPrice = stemCost + sizeCost + wrapCost + accCost;
    const quantity = Math.max(1, parseInt(item.quantity) || 1);
    return {
      title: "Custom Bespoke Bouquet",
      unitPrice: singleUnitPrice,
      quantity,
      totalPrice: singleUnitPrice * quantity,
      verified: true
    };
  }

  // 2. Standard Catalog Product — check hardcoded catalog first, then DB products
  let catalogItem = CATALOG_PRODUCTS[item.id];
  if (!catalogItem) {
    // Fallback: look up product from db.json products array
    try {
      const db = loadDb();
      const dbProduct = db.products ? db.products.find(p => p.id === item.id) : null;
      if (dbProduct) {
        // Build a compatible catalog entry from DB product
        if (dbProduct.category === "flowers" && dbProduct.variants && dbProduct.variants.length > 0) {
          const stemPricing = {};
          dbProduct.variants.forEach(v => { stemPricing[v.count || 1] = v.price; });
          catalogItem = { name: dbProduct.name, category: dbProduct.category, stemPricing };
        } else {
          catalogItem = { name: dbProduct.name, category: dbProduct.category, basePrice: dbProduct.price };
        }
      }
    } catch (e) { /* ignore lookup errors */ }
  }

  if (!catalogItem) {
    throw new Error(`Invalid or unknown product ID: ${item.id}`);
  }

  const quantity = Math.max(1, parseInt(item.quantity) || 1);

  // Individual flowers with stem tiers
  if (catalogItem.stemPricing) {
    const stemCount = parseInt(item.stemCount) || 1;
    const tierPrice = catalogItem.stemPricing[stemCount] || catalogItem.stemPricing[1];
    return {
      title: catalogItem.name,
      stemCount,
      unitPrice: tierPrice,
      quantity,
      totalPrice: tierPrice * quantity,
      verified: true
    };
  }

  // Fixed unit products (bouquets, bundles, gifts, accessories)
  const unitPrice = catalogItem.basePrice;
  return {
    title: catalogItem.name,
    unitPrice,
    quantity,
    totalPrice: unitPrice * quantity,
    verified: true
  };
}

/**
 * Authoritative Server-Side Order Calculation
 */
function calculateOrderTotal(items, couponCode) {
  if (!Array.isArray(items) || items.length === 0) {
    throw new Error("Cart contains no items");
  }

  const verifiedItems = [];
  let subtotal = 0;

  for (const rawItem of items) {
    const verified = calculateItemServerPrice(rawItem);
    verifiedItems.push({
      ...rawItem,
      name: verified.title,
      unitPrice: verified.unitPrice,
      quantity: verified.quantity,
      totalPrice: verified.totalPrice
    });
    subtotal += verified.totalPrice;
  }

  // Calculate Shipping (using dynamic settings from DB)
  const deliverySettings = getDeliverySettings();
  const shippingFee = subtotal >= deliverySettings.threshold ? 0 : deliverySettings.fee;

  // Validate and apply coupon if provided
  let discount = 0;
  let appliedCoupon = null;
  if (couponCode) {
    const db = loadDb();
    const coupon = db.coupons.find(c => c.code.toUpperCase() === couponCode.trim().toUpperCase() && c.active);
    if (coupon) {
      if (subtotal >= coupon.minOrder) {
        if (coupon.type === "PERCENT") {
          discount = Math.round((subtotal * coupon.value) / 100);
        } else if (coupon.type === "FIXED") {
          discount = Math.min(coupon.value, subtotal);
        }
        appliedCoupon = coupon.code;
      }
    }
  }

  const total = Math.max(0, subtotal + shippingFee - discount);

  return {
    verifiedItems,
    subtotal,
    shippingFee,
    discount,
    appliedCoupon,
    total
  };
}

// -------------------------------------------------------------------------------------
// RAZORPAY OFFICIAL VERIFICATION & SDK WRAPPER
// -------------------------------------------------------------------------------------
let razorpayInstance = null;
try {
  const Razorpay = require("razorpay");
  razorpayInstance = new Razorpay({
    key_id: RAZORPAY_KEY_ID,
    key_secret: RAZORPAY_KEY_SECRET
  });
} catch (e) {
  console.warn("Razorpay SDK initialization notice:", e.message);
}

/**
 * Verifies Razorpay payment signature server-side.
 */
function verifyRazorpaySignature(orderId, paymentId, signature) {
  const generatedSignature = crypto
    .createHmac("sha256", RAZORPAY_KEY_SECRET)
    .update(`${orderId}|${paymentId}`)
    .digest("hex");
  return generatedSignature === signature;
}

/**
 * Verifies Razorpay webhook signature.
 */
function verifyWebhookSignature(rawBody, signatureHeader) {
  if (!signatureHeader || !RAZORPAY_WEBHOOK_SECRET) return false;
  const expected = crypto
    .createHmac("sha256", RAZORPAY_WEBHOOK_SECRET)
    .update(rawBody)
    .digest("hex");
  return expected === signatureHeader;
}

// -------------------------------------------------------------------------------------
// API ENDPOINTS
// -------------------------------------------------------------------------------------

/**
 * GET /api/config
 * Exposes non-sensitive merchant config (Razorpay Key ID & Merchant UPI ID)
 */
app.get("/api/config", (req, res) => {
  const db = loadDb();
  const settings = db.settings || DEFAULT_SETTINGS;
  res.json({
    razorpayKeyId: RAZORPAY_KEY_ID,
    merchantUpiId: settings.upiId || MERCHANT_UPI_ID,
    merchantName: settings.businessName || "Riya's Creative Corner",
    freeShippingThreshold: settings.freeDeliveryThreshold || FREE_DELIVERY_THRESHOLD,
    standardShippingFee: settings.deliveryFee || STANDARD_DELIVERY_FEE
  });
});

/**
 * GET /api/products
 * Public endpoint: Returns the product catalog from db.json
 */
app.get("/api/products", (req, res) => {
  const db = loadDb();
  const products = db.products || DEFAULT_PRODUCTS;
  // Only return in-stock products to customers (unless inStock is undefined/true)
  const visibleProducts = products.filter(p => p.inStock !== false);
  res.json({ success: true, products: visibleProducts });
});

/**
 * POST /api/coupons/validate
 * Validates a coupon against the current server rules
 */
app.post("/api/coupons/validate", (req, res) => {
  const { code, subtotal } = req.body;
  if (!code) return res.status(400).json({ valid: false, message: "Coupon code is required" });

  const db = loadDb();
  const coupon = db.coupons.find(c => c.code.toUpperCase() === code.trim().toUpperCase() && c.active);
  if (!coupon) {
    return res.status(404).json({ valid: false, message: "Invalid or expired coupon code" });
  }

  const orderSubtotal = parseFloat(subtotal) || 0;
  if (orderSubtotal < coupon.minOrder) {
    return res.status(400).json({
      valid: false,
      message: `Coupon requires a minimum order of ₹${coupon.minOrder.toLocaleString("en-IN")}`
    });
  }

  let discount = 0;
  if (coupon.type === "PERCENT") discount = Math.round((orderSubtotal * coupon.value) / 100);
  else if (coupon.type === "FIXED") discount = Math.min(coupon.value, orderSubtotal);

  return res.json({
    valid: true,
    code: coupon.code,
    type: coupon.type,
    value: coupon.value,
    discount,
    message: `Coupon applied: ₹${discount.toLocaleString("en-IN")} saved!`
  });
});

/**
 * POST /api/orders/create
 * Validates cart server-side, calculates final amount, creates Order & Payment, and creates Razorpay Order.
 */
app.post("/api/orders/create", async (req, res) => {
  try {
    const { items, customer, couponCode, paymentMethod } = req.body;

    if (!customer || !customer.name || !customer.phone || !customer.address) {
      return res.status(400).json({ success: false, message: "Complete customer delivery information is required." });
    }

    // 1. Authoritative Server Price Calculation (Ignored client prices)
    const calculation = calculateOrderTotal(items, couponCode);

    const db = loadDb();
    const orderId = `RCC-ORD-${Date.now().toString().slice(-6)}${Math.floor(Math.random() * 90 + 10)}`;
    const paymentId = `PAY-${Date.now().toString().slice(-6)}${Math.floor(Math.random() * 90 + 10)}`;

    const selectedMethod = paymentMethod === "MANUAL_UPI" ? "MANUAL_UPI" : "RAZORPAY";
    let razorpayOrderId = null;

    if (selectedMethod === "RAZORPAY") {
      // Create Razorpay Order with amount in Paise (1 INR = 100 Paise)
      const amountPaise = Math.round(calculation.total * 100);

      try {
        if (razorpayInstance) {
          const rzpOrder = await razorpayInstance.orders.create({
            amount: amountPaise,
            currency: "INR",
            receipt: orderId,
            notes: {
              customerName: customer.name,
              customerPhone: customer.phone,
              itemsCount: calculation.verifiedItems.length
            }
          });
          razorpayOrderId = rzpOrder.id;
        } else {
          // Resilient test order generation
          razorpayOrderId = `order_${crypto.randomBytes(8).toString("hex")}`;
        }
      } catch (rzpErr) {
        console.warn("Razorpay gateway order creation fallback:", rzpErr.message);
        razorpayOrderId = `order_${crypto.randomBytes(8).toString("hex")}`;
      }
    }

    const newOrder = {
      id: orderId,
      customer: {
        name: customer.name.trim(),
        phone: customer.phone.trim(),
        email: customer.email ? customer.email.trim() : "",
        address: customer.address.trim(),
        city: customer.city ? customer.city.trim() : "",
        state: customer.state ? customer.state.trim() : "",
        pincode: customer.pincode ? customer.pincode.trim() : "",
        notes: customer.notes || ""
      },
      items: calculation.verifiedItems,
      subtotal: calculation.subtotal,
      shippingFee: calculation.shippingFee,
      discount: calculation.discount,
      couponCode: calculation.appliedCoupon,
      total: calculation.total,
      status: "PENDING", // PENDING -> CONFIRMED / PENDING_REVIEW
      paymentMethod: selectedMethod,
      paymentId: paymentId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    const newPayment = {
      id: paymentId,
      orderId: orderId,
      gateway: selectedMethod,
      gatewayOrderId: razorpayOrderId,
      gatewayPaymentId: null,
      amount: calculation.total,
      currency: "INR",
      paymentMethod: selectedMethod,
      status: "PENDING",
      signatureVerified: false,
      webhookVerified: false,
      utr: null,
      screenshotUrl: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    db.orders.push(newOrder);
    db.payments.push(newPayment);
    saveDb(db);

    res.status(201).json({
      success: true,
      orderId: newOrder.id,
      amount: newOrder.total,
      amountPaise: Math.round(newOrder.total * 100),
      currency: "INR",
      paymentMethod: selectedMethod,
      razorpayOrderId: razorpayOrderId,
      razorpayKeyId: RAZORPAY_KEY_ID,
      merchantUpiId: MERCHANT_UPI_ID,
      customer: newOrder.customer,
      items: newOrder.items
    });
  } catch (err) {
    console.error("Error creating order:", err);
    res.status(500).json({ success: false, message: err.message || "Failed to create order" });
  }
});

/**
 * POST /api/payments/verify
 * Verifies Razorpay payment signature server-side.
 * Only after verification is the order transitioned to CONFIRMED.
 */
app.post("/api/payments/verify", (req, res) => {
  try {
    const { orderId, razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

    if (!orderId || !razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({
        success: false,
        message: "Missing required Razorpay payment verification parameters."
      });
    }

    const db = loadDb();
    const order = db.orders.find(o => o.id === orderId);
    const payment = db.payments.find(p => p.orderId === orderId);

    if (!order || !payment) {
      return res.status(404).json({ success: false, message: "Order or Payment record not found." });
    }

    // Official server-side signature verification
    const isValid = verifyRazorpaySignature(razorpay_order_id, razorpay_payment_id, razorpay_signature);

    if (!isValid) {
      payment.status = "FAILED";
      payment.gatewayPaymentId = razorpay_payment_id;
      payment.updatedAt = new Date().toISOString();
      order.status = "PENDING"; // Stays pending for payment retry
      saveDb(db);

      return res.status(400).json({
        success: false,
        signatureVerified: false,
        message: "Security verification failed: Invalid payment signature."
      });
    }

    // Payment Verified Successfully
    payment.status = "CAPTURED";
    payment.gatewayOrderId = razorpay_order_id;
    payment.gatewayPaymentId = razorpay_payment_id;
    payment.signatureVerified = true;
    payment.updatedAt = new Date().toISOString();

    order.status = "CONFIRMED";
    order.updatedAt = new Date().toISOString();

    // Deduct inventory safely (idempotent check)
    if (!order.inventoryDeducted) {
      order.items.forEach(item => {
        if (db.inventory[item.id] !== undefined) {
          db.inventory[item.id] = Math.max(0, db.inventory[item.id] - item.quantity);
        }
      });
      order.inventoryDeducted = true;
    }

    saveDb(db);

    return res.json({
      success: true,
      signatureVerified: true,
      message: "Payment successfully verified and order confirmed.",
      order: order,
      payment: payment
    });
  } catch (err) {
    console.error("Error verifying payment:", err);
    res.status(500).json({ success: false, message: err.message || "Payment verification failed" });
  }
});

/**
 * POST /api/payments/manual-upi
 * Handles manual UPI payments via QR code / UPI ID (rianandagawli11-1@okhdfcbank).
 * Places payment in MANUAL_PAYMENT_REVIEW (never auto-marks paid).
 */
app.post("/api/payments/manual-upi", upload.single("screenshot"), (req, res) => {
  try {
    const { orderId, utr } = req.body;

    if (!orderId || !utr || utr.trim().length < 6) {
      return res.status(400).json({
        success: false,
        message: "Valid 12-digit UPI Transaction Reference (UTR) number is required."
      });
    }

    const db = loadDb();
    const order = db.orders.find(o => o.id === orderId);
    const payment = db.payments.find(p => p.orderId === orderId);

    if (!order || !payment) {
      return res.status(404).json({ success: false, message: "Order not found." });
    }

    // Save uploaded proof if provided
    let screenshotUrl = null;
    if (req.file) {
      screenshotUrl = `/uploads/${req.file.filename}`;
    }

    payment.gateway = "MANUAL_UPI";
    payment.status = "MANUAL_PAYMENT_REVIEW";
    payment.utr = utr.trim();
    if (screenshotUrl) payment.screenshotUrl = screenshotUrl;
    payment.updatedAt = new Date().toISOString();

    order.status = "PENDING_REVIEW";
    order.updatedAt = new Date().toISOString();

    saveDb(db);

    return res.json({
      success: true,
      message: "Payment details submitted for verification. Order placed under manual review.",
      order,
      payment
    });
  } catch (err) {
    console.error("Error submitting manual UPI payment:", err);
    res.status(500).json({ success: false, message: err.message || "Failed to submit UPI payment details" });
  }
});

/**
 * POST /api/webhooks/razorpay
 * Secure, Idempotent Webhook Handler
 */
app.post("/api/webhooks/razorpay", (req, res) => {
  try {
    const signature = req.headers["x-razorpay-signature"];
    const rawBody = req.rawBody || JSON.stringify(req.body);

    // Verify webhook signature
    if (!verifyWebhookSignature(rawBody, signature)) {
      console.warn("Unauthorized webhook attempt: invalid signature");
      return res.status(400).json({ error: "Invalid webhook signature" });
    }

    const event = req.body;
    const eventId = event.event_id || `${event.event}_${Date.now()}`;

    const db = loadDb();

    // Idempotency: Prevent duplicate webhook processing
    if (db.processedWebhooks.includes(eventId)) {
      return res.status(200).json({ status: "already_processed" });
    }

    const eventType = event.event;
    const paymentEntity = event.payload?.payment?.entity;
    const rzpOrderId = paymentEntity?.order_id || event.payload?.order?.entity?.id;

    if (rzpOrderId) {
      const payment = db.payments.find(p => p.gatewayOrderId === rzpOrderId);
      const order = payment ? db.orders.find(o => o.id === payment.orderId) : null;

      if (payment && order) {
        if (eventType === "payment.captured" || eventType === "order.paid") {
          payment.status = "CAPTURED";
          payment.gatewayPaymentId = paymentEntity?.id || payment.gatewayPaymentId;
          payment.webhookVerified = true;
          payment.updatedAt = new Date().toISOString();

          order.status = "CONFIRMED";
          order.updatedAt = new Date().toISOString();

          // Deduct inventory safely if not yet deducted
          if (!order.inventoryDeducted) {
            order.items.forEach(item => {
              if (db.inventory[item.id] !== undefined) {
                db.inventory[item.id] = Math.max(0, db.inventory[item.id] - item.quantity);
              }
            });
            order.inventoryDeducted = true;
          }
        } else if (eventType === "payment.failed") {
          payment.status = "FAILED";
          payment.gatewayPaymentId = paymentEntity?.id || payment.gatewayPaymentId;
          payment.updatedAt = new Date().toISOString();
        }
      }
    }

    // Record processed webhook ID
    db.processedWebhooks.push(eventId);
    if (db.processedWebhooks.length > 500) db.processedWebhooks.shift();
    saveDb(db);

    return res.status(200).json({ status: "ok" });
  } catch (err) {
    console.error("Webhook processing error:", err);
    return res.status(500).json({ error: "Internal webhook error" });
  }
});

/**
 * POST /api/orders/:id/retry-payment
 * Re-initiates online payment for an existing pending order.
 */
app.post("/api/orders/:id/retry-payment", async (req, res) => {
  try {
    const orderId = req.params.id;
    const db = loadDb();
    const order = db.orders.find(o => o.id === orderId);
    const payment = db.payments.find(p => p.orderId === orderId);

    if (!order || !payment) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    if (order.status === "CONFIRMED") {
      return res.status(400).json({ success: false, message: "Order is already confirmed and paid." });
    }

    const amountPaise = Math.round(order.total * 100);
    let newRazorpayOrderId = null;

    try {
      if (razorpayInstance) {
        const rzpOrder = await razorpayInstance.orders.create({
          amount: amountPaise,
          currency: "INR",
          receipt: `${order.id}-R`,
          notes: { orderId: order.id, retry: true }
        });
        newRazorpayOrderId = rzpOrder.id;
      } else {
        newRazorpayOrderId = `order_${crypto.randomBytes(8).toString("hex")}`;
      }
    } catch (e) {
      newRazorpayOrderId = `order_${crypto.randomBytes(8).toString("hex")}`;
    }

    payment.gatewayOrderId = newRazorpayOrderId;
    payment.status = "PENDING";
    payment.updatedAt = new Date().toISOString();
    order.updatedAt = new Date().toISOString();
    saveDb(db);

    return res.json({
      success: true,
      orderId: order.id,
      amount: order.total,
      amountPaise,
      razorpayOrderId: newRazorpayOrderId,
      razorpayKeyId: RAZORPAY_KEY_ID,
      customer: order.customer
    });
  } catch (err) {
    console.error("Error retrying payment:", err);
    res.status(500).json({ success: false, message: err.message || "Failed to retry payment" });
  }
});

/**
 * GET /api/orders/:id
 * Fetches order & payment status for confirmation / tracking
 */
app.get("/api/orders/:id", (req, res) => {
  const db = loadDb();
  const order = db.orders.find(o => o.id === req.params.id);
  const payment = db.payments.find(p => p.orderId === req.params.id);

  if (!order) return res.status(404).json({ success: false, message: "Order not found" });

  res.json({
    success: true,
    order,
    payment
  });
});

/**
 * ADMIN ENDPOINTS (Protected with Admin Secret Header)
 */
function checkAdminAuth(req, res, next) {
  const secret = req.headers["x-admin-secret"] || req.query.admin_secret;
  if (secret === ADMIN_SECRET) return next();
  return res.status(401).json({ success: false, message: "Unauthorized admin access" });
}

/**
 * GET /api/admin/orders
 * Returns all orders with corresponding payment details
 */
app.get("/api/admin/orders", checkAdminAuth, (req, res) => {
  const db = loadDb();
  const ordersWithPayments = db.orders.map(order => {
    const payment = db.payments.find(p => p.orderId === order.id);
    return {
      ...order,
      payment
    };
  }).reverse();

  res.json({
    success: true,
    count: ordersWithPayments.length,
    orders: ordersWithPayments
  });
});

/**
 * POST /api/admin/orders/:id/verify-manual
 * Approves or rejects a manual UPI payment
 */
app.post("/api/admin/orders/:id/verify-manual", checkAdminAuth, (req, res) => {
  const { action, notes } = req.body; // action: "APPROVE" | "REJECT"
  const db = loadDb();
  const order = db.orders.find(o => o.id === req.params.id);
  const payment = db.payments.find(p => p.orderId === req.params.id);

  if (!order || !payment) {
    return res.status(404).json({ success: false, message: "Order or payment not found" });
  }

  if (action === "APPROVE") {
    payment.status = "CAPTURED";
    payment.adminVerified = true;
    payment.adminNotes = notes || "Verified manually against bank statement";
    payment.updatedAt = new Date().toISOString();

    order.status = "CONFIRMED";
    order.updatedAt = new Date().toISOString();

    // Deduct inventory
    if (!order.inventoryDeducted) {
      order.items.forEach(item => {
        if (db.inventory[item.id] !== undefined) {
          db.inventory[item.id] = Math.max(0, db.inventory[item.id] - item.quantity);
        }
      });
      order.inventoryDeducted = true;
    }
  } else {
    payment.status = "FAILED";
    payment.adminVerified = false;
    payment.adminNotes = notes || "Rejected by admin: Payment not received";
    payment.updatedAt = new Date().toISOString();

    order.status = "CANCELLED";
    order.updatedAt = new Date().toISOString();
  }

  saveDb(db);
  res.json({ success: true, message: `Order marked as ${order.status}`, order, payment });
});

/**
 * POST /api/admin/payments/refund
 * Initiates gateway refund via Razorpay
 */
app.post("/api/admin/payments/refund", checkAdminAuth, async (req, res) => {
  const { paymentId, amount, reason } = req.body;
  const db = loadDb();
  const payment = db.payments.find(p => p.id === paymentId || p.gatewayPaymentId === paymentId);

  if (!payment) return res.status(404).json({ success: false, message: "Payment record not found" });

  try {
    if (razorpayInstance && payment.gatewayPaymentId && !payment.gatewayPaymentId.startsWith("mock_")) {
      await razorpayInstance.payments.refund(payment.gatewayPaymentId, {
        amount: amount ? Math.round(amount * 100) : undefined,
        notes: { reason: reason || "Customer requested refund" }
      });
    }

    payment.status = (amount && amount < payment.amount) ? "PARTIALLY_REFUNDED" : "REFUNDED";
    payment.refundAmount = amount || payment.amount;
    payment.refundReason = reason || "Admin refund";
    payment.updatedAt = new Date().toISOString();

    const order = db.orders.find(o => o.id === payment.orderId);
    if (order) {
      order.status = "CANCELLED";
      order.updatedAt = new Date().toISOString();
    }

    saveDb(db);
    res.json({ success: true, message: "Refund processed successfully", payment });
  } catch (err) {
    console.error("Refund error:", err);
    res.status(500).json({ success: false, message: err.message || "Failed to process refund" });
  }
});

// -------------------------------------------------------------------------------------
// ADMIN STORE MANAGEMENT ENDPOINTS (Visual No-Code Manager)
// -------------------------------------------------------------------------------------

/**
 * GET /api/admin/products — Returns all products (including out-of-stock)
 */
app.get("/api/admin/products", checkAdminAuth, (req, res) => {
  const db = loadDb();
  res.json({ success: true, products: db.products || [] });
});

/**
 * POST /api/admin/products — Create a new product (with optional image upload)
 */
app.post("/api/admin/products", checkAdminAuth, productUpload.single("image"), (req, res) => {
  try {
    const db = loadDb();
    const body = req.body;

    const newId = body.id || `p-${Date.now().toString(36)}`;
    if (db.products.find(p => p.id === newId)) {
      return res.status(400).json({ success: false, message: `Product ID '${newId}' already exists.` });
    }

    let imagePath = body.image || "";
    if (req.file) {
      imagePath = `uploads/products/${req.file.filename}`;
    }

    const newProduct = {
      id: newId,
      name: body.name || "New Product",
      category: body.category || "flowers",
      flowerType: body.flowerType || "",
      tag: body.tag || "",
      rating: body.rating || "5.0",
      reviews: parseInt(body.reviews) || 0,
      price: parseFloat(body.price) || 0,
      mrp: parseFloat(body.mrp) || 0,
      image: imagePath,
      description: body.description || "",
      careInstructions: body.careInstructions || "",
      colors: body.colors ? (typeof body.colors === "string" ? JSON.parse(body.colors) : body.colors) : [],
      variants: body.variants ? (typeof body.variants === "string" ? JSON.parse(body.variants) : body.variants) : [],
      relatedIds: body.relatedIds ? (typeof body.relatedIds === "string" ? JSON.parse(body.relatedIds) : body.relatedIds) : [],
      wrap: body.wrap || "",
      stemsInfo: body.stemsInfo || "",
      inStock: body.inStock !== "false" && body.inStock !== false
    };

    db.products.push(newProduct);
    // Also add to inventory if not exists
    if (db.inventory[newId] === undefined) {
      db.inventory[newId] = parseInt(body.stock) || 50;
    }
    saveDb(db);

    res.status(201).json({ success: true, product: newProduct });
  } catch (err) {
    console.error("Error creating product:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * PUT /api/admin/products/:id — Update an existing product
 */
app.put("/api/admin/products/:id", checkAdminAuth, productUpload.single("image"), (req, res) => {
  try {
    const db = loadDb();
    const idx = db.products.findIndex(p => p.id === req.params.id);
    if (idx === -1) {
      return res.status(404).json({ success: false, message: "Product not found" });
    }

    const body = req.body;
    const existing = db.products[idx];

    if (req.file) {
      existing.image = `uploads/products/${req.file.filename}`;
    } else if (body.image !== undefined) {
      existing.image = body.image;
    }

    if (body.name !== undefined) existing.name = body.name;
    if (body.category !== undefined) existing.category = body.category;
    if (body.flowerType !== undefined) existing.flowerType = body.flowerType;
    if (body.tag !== undefined) existing.tag = body.tag;
    if (body.rating !== undefined) existing.rating = body.rating;
    if (body.reviews !== undefined) existing.reviews = parseInt(body.reviews) || existing.reviews;
    if (body.price !== undefined) existing.price = parseFloat(body.price);
    if (body.mrp !== undefined) existing.mrp = parseFloat(body.mrp);
    if (body.description !== undefined) existing.description = body.description;
    if (body.careInstructions !== undefined) existing.careInstructions = body.careInstructions;
    if (body.wrap !== undefined) existing.wrap = body.wrap;
    if (body.stemsInfo !== undefined) existing.stemsInfo = body.stemsInfo;
    if (body.colors !== undefined) existing.colors = typeof body.colors === "string" ? JSON.parse(body.colors) : body.colors;
    if (body.variants !== undefined) existing.variants = typeof body.variants === "string" ? JSON.parse(body.variants) : body.variants;
    if (body.relatedIds !== undefined) existing.relatedIds = typeof body.relatedIds === "string" ? JSON.parse(body.relatedIds) : body.relatedIds;
    if (body.inStock !== undefined) existing.inStock = body.inStock !== "false" && body.inStock !== false;

    db.products[idx] = existing;
    saveDb(db);

    res.json({ success: true, product: existing });
  } catch (err) {
    console.error("Error updating product:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

/**
 * DELETE /api/admin/products/:id — Delete a product
 */
app.delete("/api/admin/products/:id", checkAdminAuth, (req, res) => {
  const db = loadDb();
  const idx = db.products.findIndex(p => p.id === req.params.id);
  if (idx === -1) {
    return res.status(404).json({ success: false, message: "Product not found" });
  }
  db.products.splice(idx, 1);
  delete db.inventory[req.params.id];
  saveDb(db);
  res.json({ success: true, message: "Product deleted" });
});

/**
 * POST /api/admin/products/:id/toggle-stock — Toggle in-stock / out-of-stock
 */
app.post("/api/admin/products/:id/toggle-stock", checkAdminAuth, (req, res) => {
  const db = loadDb();
  const product = db.products.find(p => p.id === req.params.id);
  if (!product) {
    return res.status(404).json({ success: false, message: "Product not found" });
  }
  product.inStock = product.inStock === false ? true : false;
  saveDb(db);
  res.json({ success: true, product });
});

/**
 * GET /api/admin/coupons — Returns all coupons
 */
app.get("/api/admin/coupons", checkAdminAuth, (req, res) => {
  const db = loadDb();
  res.json({ success: true, coupons: db.coupons || [] });
});

/**
 * POST /api/admin/coupons — Create a new coupon
 */
app.post("/api/admin/coupons", checkAdminAuth, (req, res) => {
  const { code, type, value, minOrder } = req.body;
  if (!code || !type || value === undefined) {
    return res.status(400).json({ success: false, message: "Code, type, and value are required" });
  }
  const db = loadDb();
  if (db.coupons.find(c => c.code.toUpperCase() === code.toUpperCase())) {
    return res.status(400).json({ success: false, message: "Coupon code already exists" });
  }
  const newCoupon = {
    code: code.toUpperCase().trim(),
    type: type === "FIXED" ? "FIXED" : "PERCENT",
    value: parseFloat(value) || 0,
    minOrder: parseFloat(minOrder) || 0,
    active: true
  };
  db.coupons.push(newCoupon);
  saveDb(db);
  res.status(201).json({ success: true, coupon: newCoupon });
});

/**
 * PUT /api/admin/coupons/:code — Update an existing coupon
 */
app.put("/api/admin/coupons/:code", checkAdminAuth, (req, res) => {
  const db = loadDb();
  const coupon = db.coupons.find(c => c.code.toUpperCase() === req.params.code.toUpperCase());
  if (!coupon) {
    return res.status(404).json({ success: false, message: "Coupon not found" });
  }
  if (req.body.type !== undefined) coupon.type = req.body.type;
  if (req.body.value !== undefined) coupon.value = parseFloat(req.body.value);
  if (req.body.minOrder !== undefined) coupon.minOrder = parseFloat(req.body.minOrder);
  if (req.body.active !== undefined) coupon.active = req.body.active;
  saveDb(db);
  res.json({ success: true, coupon });
});

/**
 * DELETE /api/admin/coupons/:code — Delete a coupon
 */
app.delete("/api/admin/coupons/:code", checkAdminAuth, (req, res) => {
  const db = loadDb();
  const idx = db.coupons.findIndex(c => c.code.toUpperCase() === req.params.code.toUpperCase());
  if (idx === -1) {
    return res.status(404).json({ success: false, message: "Coupon not found" });
  }
  db.coupons.splice(idx, 1);
  saveDb(db);
  res.json({ success: true, message: "Coupon deleted" });
});

/**
 * POST /api/admin/coupons/:code/toggle — Toggle coupon active/inactive
 */
app.post("/api/admin/coupons/:code/toggle", checkAdminAuth, (req, res) => {
  const db = loadDb();
  const coupon = db.coupons.find(c => c.code.toUpperCase() === req.params.code.toUpperCase());
  if (!coupon) {
    return res.status(404).json({ success: false, message: "Coupon not found" });
  }
  coupon.active = !coupon.active;
  saveDb(db);
  res.json({ success: true, coupon });
});

/**
 * GET /api/admin/inventory — Returns inventory object with product names
 */
app.get("/api/admin/inventory", checkAdminAuth, (req, res) => {
  const db = loadDb();
  const products = db.products || [];
  const inventoryWithNames = Object.entries(db.inventory || {}).map(([id, stock]) => {
    const product = products.find(p => p.id === id);
    return { id, name: product ? product.name : id, stock, category: product ? product.category : "unknown" };
  });
  res.json({ success: true, inventory: inventoryWithNames });
});

/**
 * PUT /api/admin/inventory/:productId — Update stock count
 */
app.put("/api/admin/inventory/:productId", checkAdminAuth, (req, res) => {
  const { stock } = req.body;
  if (stock === undefined || isNaN(parseInt(stock))) {
    return res.status(400).json({ success: false, message: "Valid stock count required" });
  }
  const db = loadDb();
  db.inventory[req.params.productId] = Math.max(0, parseInt(stock));
  saveDb(db);
  res.json({ success: true, productId: req.params.productId, stock: db.inventory[req.params.productId] });
});

/**
 * GET /api/admin/settings — Returns business settings
 */
app.get("/api/admin/settings", checkAdminAuth, (req, res) => {
  const db = loadDb();
  res.json({ success: true, settings: db.settings || DEFAULT_SETTINGS });
});

/**
 * PUT /api/admin/settings — Update business settings
 */
app.put("/api/admin/settings", checkAdminAuth, (req, res) => {
  const db = loadDb();
  const settings = db.settings || JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
  if (req.body.businessName !== undefined) settings.businessName = req.body.businessName;
  if (req.body.upiId !== undefined) settings.upiId = req.body.upiId;
  if (req.body.deliveryFee !== undefined) settings.deliveryFee = parseFloat(req.body.deliveryFee) || 0;
  if (req.body.freeDeliveryThreshold !== undefined) settings.freeDeliveryThreshold = parseFloat(req.body.freeDeliveryThreshold) || 0;
  if (req.body.address !== undefined) settings.address = req.body.address;
  db.settings = settings;
  saveDb(db);
  res.json({ success: true, settings });
});

// Fallback to rcc-preview.html for root navigation
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "rcc-preview.html"));
});

// Production Global Error Handler Middleware (Sanitizes stack traces in production)
app.use((err, req, res, next) => {
  console.error(`[SERVER ERROR] ${req.method} ${req.originalUrl}:`, err.stack || err.message);
  const isProd = process.env.NODE_ENV === "production";
  res.status(err.status || 500).json({
    success: false,
    message: isProd ? "An unexpected server error occurred. Please try again." : (err.message || "Internal server error")
  });
});

// Export app for serverless platforms (Vercel)
module.exports = app;

// Start Server if run directly
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`=======================================================`);
    console.log(`🌸 Riyas Creative Corner Backend & Storefront Running!`);
    console.log(`📡 URL: http://localhost:${PORT}/rcc-preview.html`);
    console.log(`💳 Razorpay Gateway Key: ${RAZORPAY_KEY_ID}`);
    console.log(`📱 Merchant UPI ID: ${MERCHANT_UPI_ID}`);
    console.log(`=======================================================`);
  });
}
