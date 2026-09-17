import { useState, useMemo, useEffect } from "react";
import {
  Flower2, Heart, Instagram, Youtube, ChevronLeft, ChevronRight,
  ImageUp, CalendarDays, Sparkles, Check, ShoppingBag, X, Star, Eye, Filter
} from "lucide-react";

const C = {
  paper: "#FAF6F0",
  paper2: "#F5EBD8",
  ink: "#2E2A20",
  inkSoft: "#726A57",
  rose: "#D9838D",
  roseDeep: "#AD5761",
  moss: "#69805A",
  mossDeep: "#425234",
  blush: "#F1DEDA",
  gold: "#CB9A47",
  line: "rgba(46,42,32,0.12)",
};

const FONTS = `
@import url('https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400;0,9..144,500;0,9..144,600;0,9..144,700;1,9..144,500;1,9..144,600&family=Work+Sans:wght@400;500;600;700&display=swap');
.rcc-display { font-family: 'Fraunces', serif; font-optical-sizing: auto; }
.rcc-body { font-family: 'Work Sans', sans-serif; }
.photo-zoom { transition: transform 0.4s cubic-bezier(.16,1,.3,1); }
.photo-zoom:hover { transform: scale(1.05); }
`;

// -------------------------------------------------------------------------------------
// UNIFIED GENERAL PRODUCT CATALOG
// -------------------------------------------------------------------------------------
export const PRODUCTS = [
  // --- INDIVIDUAL FLOWERS ---
  {
    id: "f-rose",
    name: "Handcrafted Velvet Red Rose",
    category: "flowers",
    flowerType: "rose",
    tag: "Bestseller",
    rating: "4.9",
    reviews: 128,
    price: 199,
    mrp: 249,
    image: "photos/Rose.jpeg",
    description: "Meticulously hand-twisted red velvet chenille rose with textured sepals and flexible stem. Keeps its rich crimson beauty forever.",
    careInstructions: "Everlasting velvet chenille. Never requires watering or sunlight. Gently dust with a soft brush if needed.",
    colors: ["Velvet Crimson Red", "Soft Blush Pink", "Silk Ivory White"],
    variants: [
      { id: "v1", label: "1 Stem (Single Rose)", price: 199, mrp: 249, count: 1 },
      { id: "v2", label: "3 Stems Trio", price: 549, mrp: 747, count: 3, discount: "Save 26%" },
      { id: "v3", label: "5 Stems Bundle", price: 899, mrp: 1245, count: 5, discount: "Save 28%" },
      { id: "v4", label: "10 Stems Statement Bunch", price: 1699, mrp: 2490, count: 10, discount: "Save 32%" },
    ],
    relatedIds: ["f-tulip", "f-sunflower", "b-ruby", "g-bear"]
  },
  {
    id: "f-tulip",
    name: "Handcrafted Pastel Tulip",
    category: "flowers",
    flowerType: "tulip",
    tag: "Popular",
    rating: "4.9",
    reviews: 94,
    price: 149,
    mrp: 199,
    image: "photos/roses.jpeg",
    description: "Artisan two-tone lilac and candy pink chenille tulip. Features an elegant closed-cup bloom and slender botanical green leaf.",
    careInstructions: "Everlasting flower. Keep away from direct moisture and open flame.",
    colors: ["Lilac Mist & Pink", "Candy Pink", "Warm Peach"],
    variants: [
      { id: "v1", label: "1 Tulip Stem", price: 149, mrp: 199, count: 1 },
      { id: "v2", label: "3 Tulips Trio", price: 419, mrp: 597, count: 3, discount: "Save 30%" },
      { id: "v3", label: "5 Tulips Bundle", price: 679, mrp: 995, count: 5, discount: "Save 32%" },
      { id: "v4", label: "10 Tulips Bunch", price: 1299, mrp: 1990, count: 10, discount: "Save 35%" },
    ],
    relatedIds: ["f-rose", "f-sunflower", "b-symphony", "g-card"]
  },
  {
    id: "f-sunflower",
    name: "Sun-Kissed Chenille Sunflower",
    category: "flowers",
    flowerType: "sunflower",
    tag: "Trending",
    rating: "4.8",
    reviews: 82,
    price: 189,
    mrp: 249,
    image: "photos/Sunflowers.jpeg",
    description: "Radiant golden yellow sunflower with a deep chocolate brown velvet center. Handcrafted to bring everlasting sunshine to any room or vase.",
    careInstructions: "Durable chenille craft. Suitable for table vases, car dashes, or desk decor.",
    colors: ["Golden Sunshine Yellow", "Warm Amber Ochre"],
    variants: [
      { id: "v1", label: "1 Stem", price: 189, mrp: 249, count: 1 },
      { id: "v2", label: "3 Stems Trio", price: 519, mrp: 747, count: 3, discount: "Save 30%" },
      { id: "v3", label: "5 Stems Meadow Bundle", price: 849, mrp: 1245, count: 5, discount: "Save 32%" },
    ],
    relatedIds: ["f-rose", "f-lily-pink", "bd-meadow", "g-bear"]
  },
  {
    id: "f-lily-pink",
    name: "Velvet Blush Starlight Lily",
    category: "flowers",
    flowerType: "lily",
    tag: "Signature",
    rating: "5.0",
    reviews: 67,
    price: 229,
    mrp: 299,
    image: "photos/tulip.jpeg",
    description: "Statement pink lily with delicate ruffled white-trimmed petals and handcrafted realistic white pollen stamens.",
    careInstructions: "Petals are gently bendable so you can reshape or fluff the bloom at any time.",
    colors: ["Blush Pink & White", "Fuchsia & White"],
    variants: [
      { id: "v1", label: "1 Lily Stem", price: 229, mrp: 299, count: 1 },
      { id: "v2", label: "3 Lilies Trio", price: 629, mrp: 897, count: 3, discount: "Save 30%" },
      { id: "v3", label: "5 Lilies Bundle", price: 999, mrp: 1495, count: 5, discount: "Save 33%" },
    ],
    relatedIds: ["f-lily-blue", "b-symphony", "f-rose"]
  },
  {
    id: "f-lily-blue",
    name: "Royal Azure Striped Lily",
    category: "flowers",
    flowerType: "lily",
    tag: "Rare Exotic",
    rating: "5.0",
    reviews: 45,
    price: 249,
    mrp: 329,
    image: "photos/blue tulip.jpeg",
    description: "Striking two-tone cyan and cobalt blue striped velvet petals with hand-piped white stamens. A rare botanical centerpiece.",
    careInstructions: "Avoid chemical sprays or water. Indoor display recommended.",
    colors: ["Royal Azure & Cyan", "Deep Cobalt"],
    variants: [
      { id: "v1", label: "1 Stem", price: 249, mrp: 329, count: 1 },
      { id: "v2", label: "3 Stems Trio", price: 689, mrp: 987, count: 3, discount: "Save 30%" },
      { id: "v3", label: "5 Stems Bundle", price: 1099, mrp: 1645, count: 5, discount: "Save 33%" },
    ],
    relatedIds: ["f-lily-pink", "b-ruby", "f-tulip"]
  },

  // --- BOUQUETS ---
  {
    id: "b-symphony",
    name: "Blush Lily & Tulip Symphony Bouquet",
    category: "bouquets",
    flowerType: "mixed",
    tag: "Bestseller",
    rating: "4.9",
    reviews: 84,
    price: 1399,
    mrp: 1699,
    image: "photos/WhatsApp Image 2026-09-12 at 13.46.53 (2).jpeg",
    description: "16 handcrafted stems of soft blush lilies, pink tulips, mini daisies, baby's breath & official EverBloom seal.",
    wrap: "Blush & White Layered Wrap",
    stemsInfo: "16 Handcrafted Stems Arrangement",
    relatedIds: ["f-rose", "g-bear", "g-card"]
  },
  {
    id: "b-ruby",
    name: "Midnight Crimson Velvet Lilies Bouquet",
    category: "bouquets",
    flowerType: "lily",
    tag: "Statement Piece",
    rating: "5.0",
    reviews: 62,
    price: 1799,
    mrp: 2199,
    image: "photos/WhatsApp Image 2026-09-12 at 13.46.52 (2).jpeg",
    description: "12 statement ruby red velvet lilies presented in pleated black wrap with gold-trimmed ribbon & pearl garland.",
    wrap: "Midnight Black Pleated Wrap",
    stemsInfo: "12 Statement Velvet Lilies",
    relatedIds: ["f-rose", "g-card", "a-pearls"]
  },
  {
    id: "b-wine",
    name: "Royal Wine Velvet Lilies Bouquet",
    category: "bouquets",
    flowerType: "lily",
    tag: "Signature",
    rating: "4.9",
    reviews: 47,
    price: 1599,
    mrp: 1899,
    image: "photos/WhatsApp Image 2026-09-12 at 13.46.52 (1).jpeg",
    description: "14 deep burgundy velvet lilies with white stamens, wrapped in crisp paper with maroon satin ribbon.",
    wrap: "Crisp White & Pearls",
    stemsInfo: "14 Handcrafted Stems",
    relatedIds: ["f-rose", "g-bear", "g-card"]
  },

  // --- BUNDLES & GIFTS ---
  {
    id: "bd-meadow",
    name: "Meadow Harmony Trio Stem Bundle",
    category: "bundles",
    flowerType: "mixed",
    tag: "Bundle Value",
    rating: "4.8",
    reviews: 31,
    price: 549,
    mrp: 699,
    image: "photos/WhatsApp Image 2026-09-12 at 13.46.53.jpeg",
    description: "Curated bunch of 3 assorted artisan blooms (sunflower, pink lily, tulip) tied with natural raffia for home vases.",
    relatedIds: ["f-sunflower", "f-rose"]
  },
  {
    id: "g-bear",
    name: "Mini Plush Cuddle Bear Keepsake",
    category: "gifts",
    tag: "Gift Add-on",
    rating: "4.9",
    reviews: 112,
    price: 299,
    mrp: 399,
    image: "photos/WhatsApp Image 2026-09-12 at 13.46.52.jpeg",
    description: "Adorable miniature plush bear with satin ribbon bow. Perfect companion for single flowers or bouquets.",
    relatedIds: ["f-rose", "b-symphony"]
  },
  {
    id: "g-card",
    name: "Wax-Sealed Botanical Greeting Card",
    category: "gifts",
    tag: "Handcrafted",
    rating: "5.0",
    reviews: 140,
    price: 79,
    mrp: 120,
    image: "photos/WhatsApp Image 2026-09-12 at 13.46.53 (2).jpeg",
    description: "Handmade cotton paper card with personalized calligraphy and vintage gold wax seal.",
    relatedIds: ["f-rose", "f-tulip"]
  },
];

const FLOWERS_BUILDER = [
  { id: "rose", name: "Red Rose", price: 45, image: "photos/Rose.jpeg" },
  { id: "tulip", name: "Pastel Tulip", price: 60, image: "photos/roses.jpeg" },
  { id: "lily", name: "Velvet Lily", price: 90, image: "photos/tulip.jpeg" },
  { id: "sunflower", name: "Sunflower", price: 55, image: "photos/Sunflowers.jpeg" },
];

function currency(n) {
  return "₹" + n.toLocaleString("en-IN");
}

function Badge({ children, tone = "rose" }) {
  const bg = tone === "rose" ? C.roseDeep : tone === "moss" ? C.mossDeep : tone === "black" ? "#222023" : C.gold;
  return (
    <span className="rcc-body inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium tracking-wide shadow-xs" style={{ backgroundColor: bg, color: "#fff" }}>
      {children}
    </span>
  );
}

function TopNav({ setPage, cartCount, onOpenCart, onSelectCategory }) {
  return (
    <header className="sticky top-0 z-30 border-b backdrop-blur-md" style={{ backgroundColor: "rgba(250,246,240,0.94)", borderColor: C.line }}>
      <div className="mx-auto max-w-6xl flex items-center justify-between px-4 py-3">
        <button onClick={() => setPage("home")} className="flex items-center gap-2.5 text-left">
          <Flower2 size={24} style={{ color: C.roseDeep }} />
          <div>
            <span className="rcc-display text-xl font-bold tracking-tight block" style={{ color: C.ink }}>Riyas Creative Corner</span>
            <span className="rcc-body text-[10px] uppercase tracking-wider font-semibold opacity-75 block -mt-1" style={{ color: C.roseDeep }}>EverBloom · Handcrafted Flowers & Gifts</span>
          </div>
        </button>

        <nav className="rcc-body hidden md:flex items-center gap-6 text-sm font-medium" style={{ color: C.inkSoft }}>
          <button onClick={() => { setPage("home"); onSelectCategory("all"); }} className="hover:text-stone-900">Shop All</button>
          <button onClick={() => { setPage("home"); onSelectCategory("flowers"); }} className="hover:text-stone-900">Flowers 🌷</button>
          <button onClick={() => { setPage("home"); onSelectCategory("bouquets"); }} className="hover:text-stone-900">Bouquets 💐</button>
          <button onClick={() => { setPage("home"); onSelectCategory("gifts"); }} className="hover:text-stone-900">Gifts 🎁</button>
          <button onClick={() => setPage("builder")} className="hover:text-stone-900">Custom Studio ✨</button>
        </nav>

        <button onClick={onOpenCart} className="relative flex items-center gap-1.5 rounded-full px-3.5 py-2 shadow-xs hover:scale-105 transition-transform" style={{ backgroundColor: C.blush }}>
          <ShoppingBag size={16} style={{ color: C.roseDeep }} />
          <span className="rcc-body text-xs font-bold" style={{ color: C.roseDeep }}>{cartCount}</span>
        </button>
      </div>
    </header>
  );
}

function ProductModal({ product, onClose, onAddToCart }) {
  if (!product) return null;
  const [variant, setVariant] = useState(product.variants ? product.variants[0] : null);
  const [qty, setQty] = useState(1);
  const price = variant ? variant.price : product.price;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm" onClick={onClose}>
      <div className="relative max-w-2xl w-full bg-white rounded-3xl overflow-hidden shadow-2xl p-6" onClick={(e) => e.stopPropagation()}>
        <button onClick={onClose} className="absolute top-4 right-4 p-1 rounded-full hover:bg-stone-100"><X size={20} /></button>
        <div className="grid md:grid-cols-2 gap-6">
          <img src={product.image} alt={product.name} className="w-full h-72 object-cover rounded-2xl" />
          <div className="flex flex-col justify-between">
            <div>
              <span className="text-xs uppercase font-bold text-pink-700">{product.category}</span>
              <h2 className="rcc-display text-2xl font-bold mt-1 text-stone-900">{product.name}</h2>
              <p className="rcc-body text-xs text-stone-600 mt-2">{product.description}</p>
              
              <div className="text-2xl font-bold mt-3 text-pink-700">{currency(price * qty)}</div>

              {product.variants && (
                <div className="mt-3 space-y-1.5">
                  <span className="text-xs font-bold text-stone-600">Stem Quantity:</span>
                  <div className="grid grid-cols-2 gap-1.5">
                    {product.variants.map((v) => (
                      <button key={v.id} onClick={() => setVariant(v)} className={`p-2 rounded-xl text-xs border text-left ${variant?.id === v.id ? 'border-pink-600 bg-pink-50 font-bold' : 'border-stone-200'}`}>
                        <div>{v.label}</div>
                        <div className="text-pink-700 font-bold">{currency(v.price)}</div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <button
              onClick={() => {
                onAddToCart({
                  id: product.id + `-${Date.now()}`,
                  name: product.name,
                  variant: variant?.label || "Standard",
                  price: price * qty,
                  image: product.image
                });
                onClose();
              }}
              className="mt-5 w-full py-3 rounded-full text-xs font-bold text-white shadow"
              style={{ backgroundColor: C.mossDeep }}>
              Add to Basket — {currency(price * qty)}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const [page, setPage] = useState("home");
  const [cart, setCart] = useState([]);
  const [activeCategory, setActiveCategory] = useState("all");
  const [selectedProduct, setSelectedProduct] = useState(null);

  const addToCart = (item) => setCart([...cart, item]);

  return (
    <div className="rcc-body min-h-screen" style={{ backgroundColor: C.paper }}>
      <style>{FONTS}</style>
      <TopNav 
        setPage={setPage} 
        cartCount={cart.length} 
        onOpenCart={() => alert(`Basket items: ${cart.length}`)}
        onSelectCategory={setActiveCategory}
      />
      
      {/* Home / Catalog */}
      <main className="mx-auto max-w-6xl px-4 py-8">
        <h1 className="rcc-display text-4xl font-bold mb-2">Handcrafted Flowers & Gifts</h1>
        <p className="rcc-body text-sm text-stone-500 mb-6">Individual stems, bouquets, bundles & bespoke creations.</p>

        {/* Category Tabs */}
        <div className="flex gap-2 mb-8">
          {["all", "flowers", "bouquets", "bundles", "gifts"].map((cat) => (
            <button key={cat} onClick={() => setActiveCategory(cat)} className={`px-4 py-2 rounded-full text-xs font-bold capitalize ${activeCategory === cat ? 'bg-stone-900 text-white' : 'bg-white border border-stone-200 text-stone-700'}`}>
              {cat}
            </button>
          ))}
        </div>

        {/* Product Grid */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {PRODUCTS.filter(p => activeCategory === "all" || p.category === activeCategory).map((p) => (
            <div key={p.id} className="bg-white rounded-2xl overflow-hidden border border-stone-200 shadow-xs p-4 flex flex-col justify-between">
              <div>
                <img src={p.image} alt={p.name} className="w-full h-56 object-cover rounded-xl mb-3" />
                <span className="text-[10px] font-bold uppercase text-pink-700">{p.category}</span>
                <h3 className="rcc-display text-base font-bold mt-0.5">{p.name}</h3>
                <p className="rcc-body text-xs text-stone-500 mt-1 line-clamp-2">{p.description}</p>
              </div>
              <div className="mt-4 pt-3 border-t border-stone-100 flex justify-between items-center">
                <span className="rcc-display text-lg font-bold text-pink-700">{currency(p.price)}</span>
                <button onClick={() => setSelectedProduct(p)} className="px-4 py-2 rounded-full text-xs font-bold text-white" style={{ backgroundColor: C.mossDeep }}>
                  View Options
                </button>
              </div>
            </div>
          ))}
        </div>
      </main>

      <ProductModal product={selectedProduct} onClose={() => setSelectedProduct(null)} onAddToCart={addToCart} />
    </div>
  );
}
