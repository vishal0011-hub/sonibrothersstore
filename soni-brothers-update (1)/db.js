// Soni Brothers — database (built-in SQLite, no external packages)
const path = require('path');
const fs = require('fs');
const { DatabaseSync } = require('node:sqlite');

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
fs.mkdirSync(path.join(DATA_DIR, 'uploads'), { recursive: true });

const db = new DatabaseSync(path.join(DATA_DIR, 'store.db'));
db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');

db.exec(`
CREATE TABLE IF NOT EXISTS categories (
  id INTEGER PRIMARY KEY, slug TEXT UNIQUE, name TEXT, icon TEXT, sort INTEGER DEFAULT 0, active INTEGER DEFAULT 1
);
CREATE TABLE IF NOT EXISTS products (
  id INTEGER PRIMARY KEY, slug TEXT UNIQUE, name TEXT, category_id INTEGER REFERENCES categories(id),
  description TEXT, fabric TEXT, fit TEXT, price INTEGER, mrp INTEGER,
  colors TEXT DEFAULT '[]', sizes TEXT DEFAULT '[]', images TEXT DEFAULT '[]',
  stock INTEGER DEFAULT 500, featured INTEGER DEFAULT 0, is_new INTEGER DEFAULT 0, bestseller INTEGER DEFAULT 0,
  active INTEGER DEFAULT 1, created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY, phone TEXT UNIQUE, name TEXT, business_name TEXT, gstin TEXT, email TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS otps (phone TEXT PRIMARY KEY, code_hash TEXT, expires INTEGER, attempts INTEGER DEFAULT 0, sent_at INTEGER);
CREATE TABLE IF NOT EXISTS sessions (token TEXT PRIMARY KEY, user_id INTEGER, admin INTEGER DEFAULT 0, expires INTEGER);
CREATE TABLE IF NOT EXISTS addresses (
  id INTEGER PRIMARY KEY, user_id INTEGER REFERENCES users(id), name TEXT, phone TEXT, business TEXT,
  line1 TEXT, line2 TEXT, city TEXT, state TEXT, pincode TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS orders (
  id INTEGER PRIMARY KEY, number TEXT UNIQUE, user_id INTEGER REFERENCES users(id),
  items TEXT, pieces INTEGER, subtotal INTEGER, shipping INTEGER, total INTEGER, tax TEXT,
  payment_method TEXT, pay_now INTEGER, balance_due INTEGER,
  payment_status TEXT DEFAULT 'pending', rp_order_id TEXT, rp_payment_id TEXT,
  status TEXT DEFAULT 'pending_payment', address TEXT, gstin TEXT, courier TEXT, tracking TEXT,
  history TEXT DEFAULT '[]', created_at TEXT DEFAULT CURRENT_TIMESTAMP, paid_at TEXT
);
CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT);
CREATE TABLE IF NOT EXISTS messages (id INTEGER PRIMARY KEY, name TEXT, phone TEXT, message TEXT, created_at TEXT DEFAULT CURRENT_TIMESTAMP);
`);

// ---------- upgrades for existing live databases (safe to run every start) ----------
for (const sql of [
  "ALTER TABLE products ADD COLUMN packs TEXT DEFAULT '[]'",      // custom sets, see lib.normalizePacks
  'ALTER TABLE products ADD COLUMN sell_single INTEGER DEFAULT 1', // allow buying single sizes too
]) { try { db.exec(sql); } catch (e) { if (!/duplicate column/i.test(e.message)) throw e; } }

// ---------- settings ----------
const DEFAULT_SETTINGS = {
  brand_name: 'Soni Brothers',
  tagline: 'Streetwear. Wholesale. Direct from the manufacturer.',
  legal_name: 'Soni Enterprises',           // registered business name as on GST certificate
  gstin: '',                              // e.g. 27ABCDE1234F1Z5
  address: 'Add your registered business address',
  city: 'Mumbai', state: 'Maharashtra', pincode: '400001',
  phone: '+91 90000 00000',
  whatsapp: '919000000000',               // digits only, with country code
  email: 'support@sonybrothers.com',
  instagram: 'https://instagram.com/',
  youtube: 'https://youtube.com/',
  instagram_followers: '1M+',
  moq: '4',
  cod_advance_pct: '20',
  gst_low: '5', gst_high: '18', gst_threshold: '2500', // per-piece selling price threshold (₹)
  prices_include_gst: '1',
  shipping_fee: '0', free_ship_above: '0',
  pincodes_delivered: '16,101', pincodes_total: '19,101',
  hero_kicker: 'New drop · Gen Z Collection',
  hero_title: 'Built for the streets.\nPriced for resellers.',
  hero_sub: 'Factory-direct streetwear from one of Asia\'s largest garment manufacturers. Mix any designs and sizes — minimum just 4 pieces.',
  hero_image: '',
  announcement: 'MOQ just 4 pieces · Mix any design & size · COD with 20% advance · Free pan-India shipping',
  return_days: '7',
};
const settingsStmt = db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)');
for (const [k, v] of Object.entries(DEFAULT_SETTINGS)) settingsStmt.run(k, v);

function getSettings() {
  const s = {};
  for (const r of db.prepare('SELECT key, value FROM settings').all()) s[r.key] = r.value;
  return s;
}
function setSetting(k, v) {
  db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run(k, String(v ?? ''));
}

// ---------- seed catalogue (only if empty) ----------
function seed() {
  if (db.prepare('SELECT COUNT(*) c FROM categories').get().c > 0) return;
  const cats = [
    ['oversized-tees', 'Oversized Tees', 'oversized'],
    ['t-shirts', 'T-Shirts', 'tee'],
    ['shirts', 'Shirts', 'shirt'],
    ['polos', 'Polos', 'polo'],
    ['hoodies', 'Hoodies', 'hoodie'],
    ['jackets', 'Jackets', 'jacket'],
    ['jeans', 'Jeans', 'jeans'],
    ['cargos', 'Cargos', 'cargo'],
    ['joggers', 'Joggers', 'jogger'],
    ['shorts', 'Shorts', 'shorts'],
  ];
  const ci = db.prepare('INSERT INTO categories (slug, name, icon, sort) VALUES (?, ?, ?, ?)');
  cats.forEach((c, i) => ci.run(c[0], c[1], c[2], i));
  const catId = slug => db.prepare('SELECT id FROM categories WHERE slug = ?').get(slug).id;

  const C = {
    black: { name: 'Jet Black', hex: '#111111' }, white: { name: 'Off White', hex: '#F1EFEA' },
    olive: { name: 'Olive', hex: '#5B5F3A' }, sand: { name: 'Sand', hex: '#CDBA96' },
    navy: { name: 'Navy', hex: '#1E2A44' }, grey: { name: 'Ash Grey', hex: '#9A9A9A' },
    maroon: { name: 'Maroon', hex: '#5E1F2A' }, sky: { name: 'Sky', hex: '#A9C7E3' },
    lilac: { name: 'Lilac', hex: '#B9A7D6' }, brown: { name: 'Mocha', hex: '#5A3E2B' },
    indigo: { name: 'Indigo Wash', hex: '#3A4E78' }, ice: { name: 'Ice Wash', hex: '#B8C6D6' },
    charcoal: { name: 'Charcoal', hex: '#3A3A3A' }, volt: { name: 'Acid Lime', hex: '#C6E83A' },
  };
  const TOP = ['S', 'M', 'L', 'XL', 'XXL'];
  const BOTTOM = ['28', '30', '32', '34', '36'];
  const P = [
    // slug, name, cat, price, mrp, colors, sizes, fabric, fit, flags[f,n,b], desc
    ['drop-shoulder-heavyweight-tee', 'Drop Shoulder Heavyweight Tee', 'oversized-tees', 249, 699, ['black', 'white', 'sand', 'olive'], TOP, '240 GSM 100% Cotton', 'Oversized', [1, 1, 1], 'Heavyweight 240 GSM cotton with dropped shoulders and a boxy, oversized cut. Our fastest-moving streetwear blank — prints and resells well.'],
    ['acid-wash-oversized-tee', 'Acid Wash Oversized Tee', 'oversized-tees', 289, 799, ['charcoal', 'brown', 'maroon'], TOP, '220 GSM Cotton, Acid Washed', 'Oversized', [1, 1, 0], 'Vintage acid-washed finish, every piece slightly unique. Relaxed oversized fit with ribbed neck.'],
    ['graphic-back-print-tee', 'Graphic Back Print Tee', 'oversized-tees', 279, 799, ['black', 'white', 'lilac'], TOP, '220 GSM Cotton', 'Oversized', [0, 1, 1], 'Bold back graphic with a minimal front chest hit. Gen Z bestseller.'],
    ['essential-crew-tee', 'Essential Crew Neck Tee', 't-shirts', 159, 449, ['black', 'white', 'navy', 'grey', 'olive'], TOP, '180 GSM Bio-washed Cotton', 'Regular', [1, 0, 1], 'Everyday bio-washed cotton tee. Soft hand-feel, no shrink, colours that last.'],
    ['striped-relaxed-tee', 'Striped Relaxed Tee', 't-shirts', 199, 549, ['navy', 'white'], TOP, '180 GSM Cotton', 'Relaxed', [0, 1, 0], 'Yarn-dyed stripes on a relaxed body. Easy summer seller.'],
    ['cuban-collar-resort-shirt', 'Cuban Collar Resort Shirt', 'shirts', 349, 999, ['sand', 'black', 'sky'], TOP, 'Rayon Viscose', 'Relaxed', [1, 1, 1], 'Camp collar, boxy fit and fluid rayon drape. The summer streetwear staple.'],
    ['oversized-denim-shirt', 'Oversized Denim Shirt', 'shirts', 449, 1299, ['indigo', 'ice'], TOP, '8 oz Cotton Denim', 'Oversized', [1, 0, 0], 'Washed denim with double chest pockets and a dropped shoulder.'],
    ['corduroy-overshirt', 'Corduroy Overshirt', 'shirts', 429, 1199, ['brown', 'olive', 'sand'], TOP, '14 Wale Corduroy', 'Relaxed', [0, 1, 0], 'Layer it or wear it solo. Soft corduroy with snap buttons.'],
    ['textured-knit-polo', 'Textured Knit Polo', 'polos', 299, 899, ['white', 'black', 'sand'], TOP, 'Waffle Knit Cotton', 'Regular', [0, 1, 1], 'Waffle-knit texture with an open collar — clean, premium look.'],
    ['heavy-fleece-hoodie', 'Heavy Fleece Oversized Hoodie', 'hoodies', 549, 1599, ['black', 'grey', 'maroon', 'olive'], TOP, '400 GSM Brushed Fleece', 'Oversized', [1, 0, 1], 'Brushed-back 400 GSM fleece, double-layer hood, kangaroo pocket. Winter bestseller.'],
    ['zip-up-hoodie', 'Zip-Up Boxy Hoodie', 'hoodies', 599, 1699, ['charcoal', 'sand'], TOP, '360 GSM Fleece', 'Boxy', [0, 1, 0], 'Cropped boxy fit with a metal two-way zip.'],
    ['varsity-bomber-jacket', 'Varsity Bomber Jacket', 'jackets', 699, 1999, ['black', 'navy'], TOP, 'Wool Blend Body, Faux Leather Sleeves', 'Regular', [1, 1, 0], 'Classic varsity silhouette with ribbed trims and chenille-ready chest.'],
    ['baggy-wide-leg-jeans', 'Baggy Wide Leg Jeans', 'jeans', 499, 1499, ['indigo', 'ice', 'black'], BOTTOM, '12 oz Non-stretch Denim', 'Baggy', [1, 1, 1], 'The Gen Z jean — high rise, wide straight leg, heavy denim.'],
    ['six-pocket-cargo-pants', 'Six Pocket Cargo Pants', 'cargos', 449, 1299, ['olive', 'black', 'sand', 'grey'], BOTTOM, 'Cotton Twill', 'Relaxed', [1, 0, 1], 'Utility cargos with six pockets, drawcord hem and a relaxed straight leg.'],
    ['parachute-cargo', 'Parachute Cargo Pants', 'cargos', 399, 1199, ['black', 'grey', 'olive'], BOTTOM, 'Nylon Taslan', 'Baggy', [0, 1, 1], 'Lightweight parachute fabric with toggle hems. Trend-led, fast moving.'],
    ['terry-joggers', 'French Terry Joggers', 'joggers', 299, 899, ['black', 'grey', 'navy'], TOP, '280 GSM French Terry', 'Tapered', [0, 0, 1], 'Soft french terry, tapered leg with ribbed cuffs and zip pockets.'],
    ['nylon-utility-shorts', 'Nylon Utility Shorts', 'shorts', 249, 699, ['black', 'olive', 'sand'], BOTTOM, 'Quick-dry Nylon', 'Relaxed', [0, 1, 0], 'Quick-dry nylon shorts with cargo pocket. Summer volume seller.'],
  ];
  const pi = db.prepare(`INSERT INTO products (slug, name, category_id, price, mrp, colors, sizes, fabric, fit, featured, is_new, bestseller, description)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
  for (const p of P) {
    pi.run(p[0], p[1], catId(p[2]), p[3], p[4], JSON.stringify(p[5].map(k => C[k])), JSON.stringify(p[6]), p[7], p[8], p[9][0], p[9][1], p[9][2], p[10]);
  }
  // sample sets so the demo shows how sets work (edit them in Admin → Products)
  const setPacks = db.prepare('UPDATE products SET packs = ? WHERE slug = ?');
  const tops = [{ id: 'set3mlxl', name: 'Size set', sizes: { M: 1, L: 1, XL: 1 }, colorMode: 'each', colors: [], price: null },
    { id: 'set5full', name: 'Full size set', sizes: { S: 1, M: 1, L: 1, XL: 1, XXL: 1 }, colorMode: 'each', colors: [], price: null }];
  for (const slug of ['drop-shoulder-heavyweight-tee', 'acid-wash-oversized-tee', 'essential-crew-tee', 'heavy-fleece-hoodie']) setPacks.run(JSON.stringify(tops), slug);
  setPacks.run(JSON.stringify([tops[0], { id: 'boxall01', name: 'Colour box', sizes: { M: 1, L: 1, XL: 1 }, colorMode: 'all', colors: [], price: null }]), 'cuban-collar-resort-shirt');
  setPacks.run(JSON.stringify([{ id: 'jean2836', name: 'Size set 28–36', sizes: { 28: 1, 30: 1, 32: 1, 34: 1, 36: 1 }, colorMode: 'each', colors: [], price: null }]), 'baggy-wide-leg-jeans');
}
seed();

const parseProduct = p => p && ({ ...p, colors: JSON.parse(p.colors || '[]'), sizes: JSON.parse(p.sizes || '[]'), images: JSON.parse(p.images || '[]'), packs: JSON.parse(p.packs || '[]'), sell_single: p.sell_single ?? 1 });
const parseOrder = o => o && ({ ...o, items: JSON.parse(o.items || '[]'), tax: JSON.parse(o.tax || '{}'), address: JSON.parse(o.address || '{}'), history: JSON.parse(o.history || '[]') });

module.exports = { db, DATA_DIR, getSettings, setSetting, parseProduct, parseOrder };
