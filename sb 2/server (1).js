// Soni Brothers — wholesale store server. Zero dependencies: needs Node.js 22.13+ (built-in SQLite).
const http = require('http');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const crypto = require('crypto');

loadEnv();
const { db, DATA_DIR, getSettings, setSetting, parseProduct, parseOrder } = require('./db');
const L = require('./lib');
const { layout } = require('./views/layout');
const V = require('./views/store');
const { pages } = require('./views/pages');
const A = require('./views/admin');

const PROD = process.env.NODE_ENV === 'production';
const PORT = +process.env.PORT || 3000;
const SECRET = process.env.SESSION_SECRET || (PROD ? null : 'dev-secret-change-me');
if (!SECRET) { console.error('SESSION_SECRET is required in production'); process.exit(1); }
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || (PROD ? '' : 'admin123');
const DEMO_PAY = !L.razorpayEnabled() && !PROD;           // simulated payments only outside production
const TWOFACTOR_KEY = process.env.TWOFACTOR_API_KEY || '';
const otpProviderReady = () => L.smsEnabled() || Boolean(TWOFACTOR_KEY);
const PUBLIC = path.join(__dirname, 'public');
// Version = fingerprint of the CSS/JS files. Changes automatically whenever any of them is updated,
// so browsers and the installed app always fetch the newest code (no Command+Shift+R needed).
const ASSET_V = (() => {
  const h = crypto.createHash('sha1');
  for (const f of ['styles.css', 'app.js', 'admin.css', 'admin.js']) { try { h.update(fs.readFileSync(path.join(PUBLIC, 'static', f))); } catch {} }
  return h.digest('hex').slice(0, 10);
})();
const UPLOADS = path.join(DATA_DIR, 'uploads');

function loadEnv() {
  const f = path.join(__dirname, '.env');
  if (!fs.existsSync(f)) return;
  for (const line of fs.readFileSync(f, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}

// ---------------- tiny router ----------------
const routes = [];
const route = (method, pattern, fn) => {
  const keys = [];
  const re = new RegExp('^' + pattern.replace(/:(\w+)/g, (_, k) => { keys.push(k); return '([^/]+)'; }) + '/?$');
  routes.push({ method, re, keys, fn });
};

// ---------------- response helpers ----------------
const SEC_HEADERS = {
  'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'strict-origin-when-cross-origin',
  'X-Frame-Options': 'SAMEORIGIN', 'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  ...(PROD ? { 'Strict-Transport-Security': 'max-age=31536000; includeSubDomains' } : {}),
};
function send(req, res, status, body, type = 'text/html; charset=utf-8', extra = {}) {
  if (typeof body === 'string' && type.startsWith('text/html')) body = body.replace(/(\/static\/[\w.-]+\.(?:css|js))\?v=\w+/g, `$1?v=${ASSET_V}`);
  let buf = Buffer.isBuffer(body) ? body : Buffer.from(String(body));
  const headers = { 'Content-Type': type, ...SEC_HEADERS, ...extra };
  if (buf.length > 1024 && /gzip/.test(req.headers['accept-encoding'] || '') && /text|json|javascript|svg|xml|manifest/.test(type)) {
    buf = zlib.gzipSync(buf); headers['Content-Encoding'] = 'gzip'; headers.Vary = 'Accept-Encoding';
  }
  headers['Content-Length'] = buf.length;
  res.writeHead(status, headers); res.end(req.method === 'HEAD' ? undefined : buf);
}
const json = (req, res, obj, status = 200) => send(req, res, status, JSON.stringify(obj), 'application/json; charset=utf-8', { 'Cache-Control': 'no-store' });
const redirect = (res, to, extra = {}) => { res.writeHead(302, { Location: to, ...extra }); res.end(); };
const cookie = (name, val, maxAge) => `${name}=${val}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${PROD ? '; Secure' : ''}`;
class HttpError extends Error { constructor(status, msg) { super(msg); this.status = status; } }

function parseCookies(req) {
  const out = {};
  for (const part of (req.headers.cookie || '').split(';')) { const i = part.indexOf('='); if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim()); }
  return out;
}
function readBody(req, limit = 1e6) {
  return new Promise((resolve, reject) => {
    const chunks = []; let size = 0;
    req.on('data', c => { size += c.length; if (size > limit) { reject(new HttpError(413, 'Too large')); req.destroy(); } else chunks.push(c); });
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}
async function parseBody(req, limit) {
  const raw = await readBody(req, limit);
  const type = req.headers['content-type'] || '';
  if (type.includes('application/json')) { try { return { raw, body: JSON.parse(raw.toString() || '{}') }; } catch { throw new HttpError(400, 'Invalid JSON'); } }
  if (type.includes('application/x-www-form-urlencoded')) return { raw, body: Object.fromEntries(new URLSearchParams(raw.toString())) };
  return { raw, body: {} };
}

// ---------------- sessions ----------------
const hash = s => crypto.createHmac('sha256', SECRET).update(s).digest('hex');
function newSession(userId, admin = 0) {
  const token = crypto.randomBytes(32).toString('hex');
  const days = admin ? 1 : 30;
  db.prepare('INSERT INTO sessions (token, user_id, admin, expires) VALUES (?, ?, ?, ?)').run(hash(token), userId, admin, Date.now() + days * 864e5);
  return { token, maxAge: days * 86400 };
}
function sessionOf(req, name, admin) {
  const t = parseCookies(req)[name]; if (!t) return null;
  const row = db.prepare('SELECT * FROM sessions WHERE token = ? AND admin = ? AND expires > ?').get(hash(t), admin, Date.now());
  return row || null;
}
const userOf = req => { const s = sessionOf(req, 'sid', 0); return s ? db.prepare('SELECT * FROM users WHERE id = ?').get(s.user_id) : null; };
const isAdmin = req => Boolean(sessionOf(req, 'asid', 1));

// in-memory rate limiter
const hits = new Map();
function limit(key, max, windowMs) {
  const now = Date.now(); const arr = (hits.get(key) || []).filter(t => now - t < windowMs);
  if (arr.length >= max) throw new HttpError(429, 'Too many attempts. Please wait a few minutes.');
  arr.push(now); hits.set(key, arr);
}
setInterval(() => { const now = Date.now(); for (const [k, v] of hits) if (!v.some(t => now - t < 36e5)) hits.delete(k); db.prepare('DELETE FROM sessions WHERE expires < ?').run(now); }, 6e5).unref();
const ipOf = req => (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket.remoteAddress;

// ---------------- catalogue helpers ----------------
const cats = () => db.prepare('SELECT * FROM categories WHERE active = 1 ORDER BY sort, id').all();
const allProducts = (where = 'p.active = 1', ...args) => db.prepare(`SELECT p.* FROM products p JOIN categories c ON c.id = p.category_id WHERE ${where} ORDER BY p.featured DESC, p.id DESC`).all(...args).map(parseProduct);
function iconMap() { const m = {}; for (const c of db.prepare('SELECT id, icon FROM categories').all()) m[c.id] = c.icon; return p => m[p.category_id] || 'tee'; }
function page(req, res, opts, status = 200) {
  const s = getSettings();
  send(req, res, status, layout(s, { ...opts, user: opts.user === undefined ? userOf(req) : opts.user, cats: cats() }), 'text/html; charset=utf-8', { 'Cache-Control': 'no-cache' });
}

function applyFilters(list, q) {
  let out = list;
  if (q.size) out = out.filter(p => p.sizes.includes(q.size));
  if (q.color) out = out.filter(p => p.colors.some(c => c.name === q.color));
  if (q.fabric) out = out.filter(p => p.fabric === q.fabric);
  if (q.max) out = out.filter(p => p.price <= +q.max);
  const sorts = { new: (a, b) => b.is_new - a.is_new || b.id - a.id, popular: (a, b) => b.bestseller - a.bestseller || b.featured - a.featured, low: (a, b) => a.price - b.price, high: (a, b) => b.price - a.price };
  if (sorts[q.sort]) out = [...out].sort(sorts[q.sort]);
  return out;
}
function facets(list) {
  const sizes = [...new Set(list.flatMap(p => p.sizes))];
  const order = ['XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL'];
  sizes.sort((a, b) => (order.indexOf(a) + 1 || 100 + +a) - (order.indexOf(b) + 1 || 100 + +b));
  const colors = []; const seen = new Set();
  for (const c of list.flatMap(p => p.colors)) if (!seen.has(c.name)) { seen.add(c.name); colors.push(c); }
  return { allSizes: sizes, allColors: colors, allFabrics: [...new Set(list.map(p => p.fabric).filter(Boolean))] };
}
const pickQ = (u, keys) => Object.fromEntries(keys.map(k => [k, u.searchParams.get(k)]).filter(([, v]) => v));

// ---------------- pricing / checkout ----------------
function priceCart(lines, s) {
  if (!Array.isArray(lines) || !lines.length) throw new HttpError(400, 'Your bag is empty.');
  const iconOf = iconMap();
  const merged = new Map();
  for (let l of lines.slice(0, 200)) {
    const p = parseProduct(db.prepare('SELECT * FROM products WHERE id = ? AND active = 1').get(+l.id));
    if (!p) throw new HttpError(400, 'A product in your bag is no longer available. Please remove it.');
    const qty = Math.floor(+l.qty);
    if (!(qty >= 1 && qty <= 999)) throw new HttpError(400, 'Invalid quantity.');
    const icon = iconOf(p);
    const hsn = /jean|cargo|jogger|short/.test(icon) ? '6203' : /shirt|jacket/.test(icon) ? '6205' : '6109';
    const base = { id: p.id, slug: p.slug, name: p.name, icon, hsn, stock: p.stock };
    if (!l.pack && !p.sizes.includes(l.size)) {
      const match = p.packs.find(pk => L.packInfo(pk, p).sizesLabel === l.size);
      if (match) l = { ...l, pack: match.id };
    }
    if (l.pack) {
      // ----- a set: qty = number of sets; stored qty becomes total pieces -----
      const pk = p.packs.find(x => x.id === l.pack);
      if (!pk) throw new HttpError(400, `A set of ${p.name} in your bag has changed. Please remove it and add again.`);
      const info = L.packInfo(pk, p);
      if (!info.pieces) throw new HttpError(400, `Set ${pk.name} of ${p.name} is not available.`);
      let color, colorHex, img = p.images[0] || '';
      if (info.colors) { color = info.colors.length === p.colors.length && info.colors.length > 1 ? `Assorted · all ${info.colors.length} colours` : info.colors.map(c => c.name).join(', '); colorHex = info.colors[0]?.hex || '#222'; }
      else {
        const c = p.colors.find(x => x.name === l.color);
        if (!c) throw new HttpError(400, `Please choose a colour for ${p.name}.`);
        color = c.name; colorHex = c.hex; img = p.images[p.colors.indexOf(c)] || img;
      }
      const key = `${p.id}|pack:${pk.id}|${color}`;
      const cur = merged.get(key);
      if (cur) { cur.sets += qty; cur.qty = cur.sets * info.pieces; continue; }
      merged.set(key, { ...base, pack: pk.id, packName: info.name, sets: qty, setPieces: info.pieces, qty: qty * info.pieces, price: info.unit,
        size: `Set: ${info.sizesLabel}`, color, colorHex, img,
        breakdown: `${info.sizes.map(([z, n]) => `${z}×${n}`).join(', ')}${info.colors ? ` in each of: ${info.colors.map(c => c.name).join(', ')}` : ` in ${color}`}` });
      continue;
    }
    // ----- a single size -----
    if (!p.sell_single && p.packs.length) throw new HttpError(400, `${p.name} is sold in sets only. Please remove it and add a set.`);
    if (!p.sizes.includes(l.size)) throw new HttpError(400, `Size ${l.size} not available for ${p.name}.`);
    const color = p.colors.find(c => c.name === l.color) || p.colors[0] || { name: '-', hex: '#222' };
    const key = `${p.id}|${l.size}|${color.name}`;
    const cur = merged.get(key);
    if (cur) cur.qty += qty;
    else merged.set(key, { ...base, price: p.price, size: l.size, color: color.name, colorHex: color.hex, img: p.images[p.colors.indexOf(color)] || p.images[0] || '', qty });
  }
  const items = [...merged.values()];
  const byProduct = {};
  for (const it of items) byProduct[it.id] = (byProduct[it.id] || 0) + it.qty;
  for (const it of items) if (byProduct[it.id] > it.stock) throw new HttpError(400, `Only ${it.stock} pieces of ${it.name} left in stock.`);
  const pieces = items.reduce((a, b) => a + b.qty, 0);
  const subtotal = items.reduce((a, b) => a + b.price * b.qty, 0);
  const fee = +s.shipping_fee || 0, freeAbove = +s.free_ship_above || 0;
  const shipping = fee && !(freeAbove && subtotal >= freeAbove) ? fee : 0;
  const total = subtotal + shipping;
  const advance = Math.ceil(total * (+s.cod_advance_pct) / 100);
  return { items: items.map(({ stock, ...r }) => r), pieces, subtotal, shipping, total, advance, moq: +s.moq, moqMet: pieces >= +s.moq };
}

function validAddress(a) {
  const clean = k => String(a[k] || '').trim().slice(0, 160);
  const out = { name: clean('name'), phone: clean('phone').replace(/\D/g, '').slice(-10), business: clean('business'), line1: clean('line1'), line2: clean('line2'), city: clean('city'), state: clean('state'), pincode: clean('pincode') };
  if (!out.name) throw new HttpError(400, 'Please enter the full name.');
  if (!/^[6-9]\d{9}$/.test(out.phone)) throw new HttpError(400, 'Please enter a valid 10-digit mobile number.');
  if (!out.line1) throw new HttpError(400, 'Please enter the address.');
  if (!/^[1-9]\d{5}$/.test(out.pincode)) throw new HttpError(400, 'Please enter a valid 6-digit pin code.');
  if (!out.city) throw new HttpError(400, 'Please enter the city.');
  if (!L.INDIAN_STATES.includes(out.state)) throw new HttpError(400, 'Please select the state.');
  return out;
}

const orderNo = () => { const d = new Date(Date.now() + 19800000); return 'SB' + d.toISOString().slice(2, 10).replace(/-/g, '') + crypto.randomInt(1000, 9999); };
const getOrder = number => parseOrder(db.prepare('SELECT * FROM orders WHERE number = ?').get(number));

function markPaid(o, paymentId, note) {
  const fresh = getOrder(o.number);
  if (!fresh || fresh.status !== 'pending_payment') return fresh;   // idempotent
  const payStatus = fresh.payment_method === 'cod' ? 'advance_paid' : 'paid';
  const history = [...fresh.history, { status: 'placed', at: new Date().toISOString(), note }];
  db.exec('BEGIN');
  try {
    db.prepare(`UPDATE orders SET payment_status = ?, rp_payment_id = ?, status = 'placed', paid_at = CURRENT_TIMESTAMP, history = ? WHERE id = ?`).run(payStatus, paymentId, JSON.stringify(history), fresh.id);
    const dec = db.prepare('UPDATE products SET stock = MAX(stock - ?, 0) WHERE id = ?');
    for (const it of fresh.items) dec.run(it.qty, it.id);
    db.exec('COMMIT');
  } catch (e) { db.exec('ROLLBACK'); throw e; }
  const s = getSettings();
  L.sendOrderSms(fresh.address.phone, { name: fresh.address.name, order: fresh.number, amount: String(fresh.total), brand: s.brand_name });
  return getOrder(o.number);
}

// ==================== STOREFRONT ====================
route('GET', '/', (req, res) => {
  const all = allProducts(); const iconOf = iconMap();
  page(req, res, { page: 'home', canonical: '/', body: V.home(getSettings(), { cats: cats(), featured: all.filter(p => p.featured).slice(0, 8), fresh: all.filter(p => p.is_new).slice(0, 8), best: all.filter(p => p.bestseller).slice(0, 8), iconOf }),
    jsonld: { '@context': 'https://schema.org', '@type': 'Organization', name: getSettings().brand_name, url: process.env.SITE_URL || '', sameAs: [getSettings().instagram, getSettings().youtube] } });
});
route('GET', '/shop', (req, res, { u }) => {
  const q = pickQ(u, ['size', 'color', 'fabric', 'max', 'sort']); const all = allProducts();
  page(req, res, { page: 'shop', title: 'Shop all wholesale streetwear', canonical: '/shop', body: V.listing(getSettings(), { title: 'Shop all', desc: `Wholesale prices per piece, GST included. Mix any styles — MOQ ${getSettings().moq} pieces.`, cats: cats(), active: 'all', products: applyFilters(all, q), iconOf: iconMap(), q, ...facets(all), basePath: '/shop' }) });
});
route('GET', '/c/:slug', (req, res, { params, u }) => {
  const cat = db.prepare('SELECT * FROM categories WHERE slug = ? AND active = 1').get(params.slug);
  if (!cat) throw new HttpError(404, 'Not found');
  const q = pickQ(u, ['size', 'color', 'fabric', 'max', 'sort']); const all = allProducts('p.active = 1 AND p.category_id = ?', cat.id);
  page(req, res, { page: 'shop', title: `${cat.name} wholesale`, desc: `Buy ${cat.name.toLowerCase()} in wholesale from ${getSettings().brand_name}. MOQ ${getSettings().moq} pieces, COD available, pan-India delivery.`, canonical: `/c/${cat.slug}`,
    body: V.listing(getSettings(), { title: cat.name, cats: cats(), active: cat.slug, products: applyFilters(all, q), iconOf: iconMap(), q, ...facets(all), basePath: `/c/${cat.slug}` }) });
});
route('GET', '/search', (req, res, { u }) => {
  const term = (u.searchParams.get('q') || '').trim().slice(0, 60);
  const q = { ...pickQ(u, ['size', 'color', 'fabric', 'max', 'sort']), ...(term ? { q: term } : {}) };
  const like = `%${term.replace(/[%_]/g, '')}%`;
  const all = term ? allProducts('p.active = 1 AND (p.name LIKE ? OR p.description LIKE ? OR p.fabric LIKE ? OR p.fit LIKE ? OR c.name LIKE ?)', like, like, like, like, like) : [];
  page(req, res, { page: 'shop', title: term ? `Search: ${term}` : 'Search', noindex: true, body: V.listing(getSettings(), { title: term ? `“${term}”` : 'Search', desc: term ? '' : 'Type in the search bar to find styles.', cats: cats(), active: '', products: applyFilters(all, q), iconOf: iconMap(), q, ...facets(all), basePath: '/search' }) });
});
route('GET', '/p/:slug', (req, res, { params }) => {
  const p = parseProduct(db.prepare('SELECT * FROM products WHERE slug = ? AND active = 1').get(params.slug));
  if (!p) throw new HttpError(404, 'Not found');
  const cat = db.prepare('SELECT * FROM categories WHERE id = ?').get(p.category_id);
  const related = allProducts('p.active = 1 AND p.category_id = ? AND p.id != ?', p.category_id, p.id).slice(0, 4);
  const more = related.length < 4 ? allProducts('p.active = 1 AND p.id != ? AND p.category_id != ?', p.id, p.category_id).slice(0, 4 - related.length) : [];
  const base = process.env.SITE_URL || '';
  page(req, res, { title: p.name, desc: `${p.name} — wholesale ${L.inr(p.price)}/piece. ${p.fabric}, ${p.fit} fit. MOQ ${getSettings().moq} pcs, COD available.`, canonical: `/p/${p.slug}`, ogImage: p.images[0] ? base + p.images[0] : '',
    body: V.product(getSettings(), { p, cat, related: [...related, ...more], iconOf: iconMap() }),
    jsonld: { '@context': 'https://schema.org', '@type': 'Product', name: p.name, description: p.description, image: p.images.map(i => base + i), brand: { '@type': 'Brand', name: getSettings().brand_name }, category: cat.name, offers: { '@type': 'Offer', priceCurrency: 'INR', price: p.price, availability: p.stock > 0 ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock', url: base + '/p/' + p.slug } } });
});
route('GET', '/picker/:id', (req, res, { params }) => {   // quick-add popup content
  const p = parseProduct(db.prepare('SELECT * FROM products WHERE id = ? AND active = 1').get(+params.id));
  if (!p) throw new HttpError(404, 'Not found');
  send(req, res, 200, V.picker(getSettings(), p, iconMap()(p)), 'text/html; charset=utf-8', { 'Cache-Control': 'no-cache' });
});
route('GET', '/cart', (req, res) => page(req, res, { page: 'cart', title: 'Your bag', noindex: true, body: V.cartPage(getSettings()) }));
route('GET', '/checkout', (req, res) => {
  const user = userOf(req);
  const addresses = user ? db.prepare('SELECT * FROM addresses WHERE user_id = ? ORDER BY id DESC LIMIT 5').all(user.id) : [];
  page(req, res, { page: 'checkout', title: 'Checkout', noindex: true, user, body: V.checkout(getSettings(), { user, addresses, rpKey: L.razorpayEnabled() ? L.RP_KEY : '', demo: DEMO_PAY }) });
});
route('GET', '/login', (req, res, { u }) => {
  const next = (u.searchParams.get('next') || '/account').replace(/^(?!\/)/, '/').replace(/^\/\//, '/');
  if (userOf(req)) return redirect(res, next);
  page(req, res, { page: 'account', title: 'Log in', noindex: true, body: V.loginPage(getSettings(), next) });
});
route('GET', '/logout', (req, res, { u }) => {
  const t = parseCookies(req).sid; if (t) db.prepare('DELETE FROM sessions WHERE token = ?').run(hash(t));
  const next = u.searchParams.get('next') || '/';
  redirect(res, next.startsWith('/') && !next.startsWith('//') ? next : '/', { 'Set-Cookie': cookie('sid', '', 0) });
});
route('GET', '/account', (req, res) => {
  const user = userOf(req); if (!user) return redirect(res, '/login?next=/account');
  const orders = db.prepare('SELECT * FROM orders WHERE user_id = ? ORDER BY id DESC').all(user.id).map(parseOrder);
  const addresses = db.prepare('SELECT * FROM addresses WHERE user_id = ? ORDER BY id DESC').all(user.id);
  page(req, res, { page: 'account', title: 'My account', noindex: true, user, body: V.account(getSettings(), { user, orders, addresses }) });
});
route('GET', '/order/:number', (req, res, { params, u }) => {
  const user = userOf(req); if (!user) return redirect(res, `/login?next=/order/${encodeURIComponent(params.number)}`);
  const o = getOrder(params.number); if (!o || o.user_id !== user.id) throw new HttpError(404, 'Not found');
  page(req, res, { page: 'account', title: `Order ${o.number}`, noindex: true, user, body: `<section class="wrap page-head">${V.orderBlock(getSettings(), o, { justPlaced: u.searchParams.has('placed') })}</section>` });
});
route('GET', '/track', (req, res, { u }) => {
  const number = (u.searchParams.get('order') || '').trim().toUpperCase(); const phone = (u.searchParams.get('phone') || '').replace(/\D/g, '').slice(-10);
  let order = null, error = '';
  if (number) { limit('track:' + ipOf(req), 30, 36e5); const o = getOrder(number); if (o && o.address.phone === phone && o.status !== 'pending_payment') order = o; else error = 'No order found with that number and mobile.'; }
  page(req, res, { title: 'Track order', body: V.track(getSettings(), { order, error }) });
});
route('GET', '/invoice/:number', (req, res, { params }) => {
  const o = getOrder(params.number); const user = userOf(req);
  if (!o || o.status === 'pending_payment' || !(isAdmin(req) || (user && user.id === o.user_id))) throw new HttpError(404, 'Not found');
  send(req, res, 200, V.invoice(getSettings(), o), 'text/html; charset=utf-8', { 'Cache-Control': 'private, no-store' });
});
for (const slug of Object.keys(pages)) {
  const titles = { about: 'About us', wholesale: 'How wholesale works', contact: 'Contact us', faq: 'FAQ', 'size-guide': 'Size guide', terms: 'Terms & Conditions', 'privacy-policy': 'Privacy Policy', 'shipping-policy': 'Shipping & Delivery Policy', 'refund-policy': 'Return & Refund Policy', 'cancellation-policy': 'Cancellation Policy' };
  route('GET', '/' + slug, (req, res) => page(req, res, { title: titles[slug], canonical: '/' + slug, body: pages[slug](getSettings()) }));
}
// aliases commonly checked by payment gateways
for (const [a, b] of [['/terms-and-conditions', '/terms'], ['/privacy', '/privacy-policy'], ['/shipping', '/shipping-policy'], ['/returns', '/refund-policy'], ['/refund', '/refund-policy'], ['/about-us', '/about'], ['/contact-us', '/contact']]) route('GET', a, (req, res) => redirect(res, b));

route('GET', '/robots.txt', (req, res) => send(req, res, 200, `User-agent: *\nDisallow: /admin\nDisallow: /checkout\nDisallow: /account\nDisallow: /api\nSitemap: ${process.env.SITE_URL || ''}/sitemap.xml\n`, 'text/plain'));
route('GET', '/sitemap.xml', (req, res) => {
  const b = process.env.SITE_URL || '';
  const urls = ['/', '/shop', ...cats().map(c => '/c/' + c.slug), ...allProducts().map(p => '/p/' + p.slug), ...Object.keys(pages).map(p => '/' + p)];
  send(req, res, 200, `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.map(x => `<url><loc>${L.esc(b + x)}</loc></url>`).join('')}</urlset>`, 'application/xml');
});

// ==================== STORE API ====================
async function sendOtp(phone, code) {
  if (L.smsEnabled()) return L.sendOtpSms(phone, code);
  if (TWOFACTOR_KEY) {
    const r = await fetch(`https://2factor.in/API/V1/${encodeURIComponent(TWOFACTOR_KEY)}/SMS/+91${phone}/${code}/${encodeURIComponent(process.env.TWOFACTOR_TEMPLATE || 'OTP1')}`);
    const d = await r.json().catch(() => ({}));
    if (d.Status !== 'Success') throw new HttpError(502, 'Could not send OTP right now. Please try again.');
    return d;
  }
  if (PROD) throw new HttpError(503, 'Login is temporarily unavailable. Please order on WhatsApp.');
  console.log(`[DEV OTP] +91 ${phone} → ${code}`);
  return { dev: true };
}
route('POST', '/api/otp/send', async (req, res, { body }) => {
  const phone = String(body.phone || '').replace(/\D/g, '').slice(-10);
  if (!/^[6-9]\d{9}$/.test(phone)) throw new HttpError(400, 'Enter a valid 10-digit Indian mobile number.');
  limit('otp-ip:' + ipOf(req), 10, 36e5); limit('otp-ph:' + phone, 5, 36e5);
  const prev = db.prepare('SELECT sent_at FROM otps WHERE phone = ?').get(phone);
  if (prev && Date.now() - prev.sent_at < 30000) throw new HttpError(429, 'Please wait 30 seconds before requesting a new OTP.');
  const code = String(crypto.randomInt(100000, 1000000));
  const r = await sendOtp(phone, code);
  db.prepare('INSERT INTO otps (phone, code_hash, expires, attempts, sent_at) VALUES (?, ?, ?, 0, ?) ON CONFLICT(phone) DO UPDATE SET code_hash = excluded.code_hash, expires = excluded.expires, attempts = 0, sent_at = excluded.sent_at')
    .run(phone, hash(phone + ':' + code), Date.now() + 10 * 60000, Date.now());
  json(req, res, { ok: true, ...(r?.dev ? { devCode: code } : {}) });
});
route('POST', '/api/otp/verify', (req, res, { body }) => {
  const phone = String(body.phone || '').replace(/\D/g, '').slice(-10); const code = String(body.code || '').trim();
  const row = db.prepare('SELECT * FROM otps WHERE phone = ?').get(phone);
  if (!row || row.expires < Date.now()) throw new HttpError(400, 'OTP expired. Please request a new one.');
  if (row.attempts >= 5) throw new HttpError(429, 'Too many wrong attempts. Request a new OTP.');
  if (!crypto.timingSafeEqual(Buffer.from(row.code_hash), Buffer.from(hash(phone + ':' + code)))) {
    db.prepare('UPDATE otps SET attempts = attempts + 1 WHERE phone = ?').run(phone);
    throw new HttpError(400, 'Incorrect OTP. Please try again.');
  }
  db.prepare('DELETE FROM otps WHERE phone = ?').run(phone);
  db.prepare('INSERT OR IGNORE INTO users (phone) VALUES (?)').run(phone);
  const user = db.prepare('SELECT * FROM users WHERE phone = ?').get(phone);
  const s = newSession(user.id);
  res.setHeader('Set-Cookie', cookie('sid', s.token, s.maxAge));
  json(req, res, { ok: true, user: { phone: user.phone, name: user.name } });
});
route('POST', '/api/profile', (req, res, { body }) => {
  const user = userOf(req); if (!user) throw new HttpError(401, 'Please log in.');
  const g = String(body.gstin || '').toUpperCase().trim();
  if (g && !/^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(g)) throw new HttpError(400, 'GSTIN looks invalid.');
  db.prepare('UPDATE users SET name = ?, business_name = ?, gstin = ?, email = ? WHERE id = ?').run(String(body.name || '').slice(0, 80), String(body.business_name || '').slice(0, 120), g, String(body.email || '').slice(0, 120), user.id);
  json(req, res, { ok: true });
});
route('POST', '/api/addresses/:id/delete', (req, res, { params }) => {
  const user = userOf(req); if (!user) throw new HttpError(401, 'Please log in.');
  db.prepare('DELETE FROM addresses WHERE id = ? AND user_id = ?').run(+params.id, user.id); json(req, res, { ok: true });
});
route('POST', '/api/contact', (req, res, { body }) => {
  limit('contact:' + ipOf(req), 5, 36e5);
  const m = { name: String(body.name || '').trim().slice(0, 80), phone: String(body.phone || '').replace(/\D/g, '').slice(-10), message: String(body.message || '').trim().slice(0, 2000) };
  if (!m.name || !m.message || !/^\d{10}$/.test(m.phone)) throw new HttpError(400, 'Please fill all fields.');
  db.prepare('INSERT INTO messages (name, phone, message) VALUES (?, ?, ?)').run(m.name, m.phone, m.message); json(req, res, { ok: true });
});
route('POST', '/api/cart/quote', (req, res, { body }) => {
  const s = getSettings(); const q = priceCart(body.lines, s);
  json(req, res, { ...q, tax: L.computeTax(q.items, s, body.state).tax });
});
route('POST', '/api/orders', async (req, res, { body }) => {
  const user = userOf(req); if (!user) throw new HttpError(401, 'Please log in with OTP to place your order.');
  limit('order:' + user.id, 20, 36e5);
  const s = getSettings(); const q = priceCart(body.lines, s);
  if (!q.moqMet) throw new HttpError(400, `Minimum order is ${q.moq} pieces. Add ${q.moq - q.pieces} more to continue.`);
  if (!['prepaid', 'cod'].includes(body.method)) throw new HttpError(400, 'Choose a payment method.');
  if (!L.razorpayEnabled() && !DEMO_PAY) throw new HttpError(503, 'Online payment is being set up. Please order on WhatsApp for now.');
  let address;
  if (body.address_id && body.address_id !== 'new') {
    const a = db.prepare('SELECT * FROM addresses WHERE id = ? AND user_id = ?').get(+body.address_id, user.id);
    if (!a) throw new HttpError(400, 'Please choose a delivery address.');
    address = validAddress(a);
  } else {
    address = validAddress(body.address || {});
    db.prepare('INSERT INTO addresses (user_id, name, phone, business, line1, line2, city, state, pincode) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)').run(user.id, address.name, address.phone, address.business, address.line1, address.line2, address.city, address.state, address.pincode);
  }
  const gstin = String(body.gstin || '').toUpperCase().trim();
  if (gstin && !/^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(gstin)) throw new HttpError(400, 'GSTIN looks invalid — please check or leave it blank.');
  if (!user.name || (gstin && !user.gstin)) db.prepare('UPDATE users SET name = COALESCE(NULLIF(name, \'\'), ?), business_name = COALESCE(NULLIF(business_name, \'\'), ?), gstin = COALESCE(NULLIF(gstin, \'\'), ?) WHERE id = ?').run(address.name, address.business, gstin, user.id);
  const tax = L.computeTax(q.items, s, address.state);
  const payNow = body.method === 'prepaid' ? q.total : q.advance;
  const number = orderNo();
  db.prepare(`INSERT INTO orders (number, user_id, items, pieces, subtotal, shipping, total, tax, payment_method, pay_now, balance_due, address, gstin, history)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(number, user.id, JSON.stringify(q.items), q.pieces, q.subtotal, q.shipping, q.total, JSON.stringify(tax), body.method, payNow, q.total - payNow, JSON.stringify(address), gstin, JSON.stringify([{ status: 'pending_payment', at: new Date().toISOString() }]));
  if (DEMO_PAY) return json(req, res, { ok: true, demo: true, number, amount: payNow });
  const rp = await L.razorpayCreateOrder(payNow, number, { order: number, method: body.method, phone: user.phone });
  db.prepare('UPDATE orders SET rp_order_id = ? WHERE number = ?').run(rp.id, number);
  json(req, res, { ok: true, number, amount: payNow, razorpay: { key: L.RP_KEY, order_id: rp.id, amount: rp.amount, currency: 'INR', name: s.brand_name, description: body.method === 'cod' ? `COD advance (${s.cod_advance_pct}%) · #${number}` : `Order #${number}`, prefill: { contact: '+91' + user.phone, name: address.name, email: user.email || '' }, notes: { order: number } } });
});
route('POST', '/api/payment/verify', (req, res, { body }) => {
  const user = userOf(req); if (!user) throw new HttpError(401, 'Please log in.');
  const o = getOrder(String(body.number || ''));
  if (!o || o.user_id !== user.id || o.rp_order_id !== body.razorpay_order_id) throw new HttpError(400, 'Order mismatch.');
  if (!L.verifyPaymentSignature(body.razorpay_order_id, body.razorpay_payment_id, body.razorpay_signature)) throw new HttpError(400, 'Payment verification failed. If money was deducted, it will be auto-refunded or confirmed shortly.');
  markPaid(o, body.razorpay_payment_id, 'Payment verified');
  json(req, res, { ok: true, number: o.number });
});
route('POST', '/api/payment/demo', (req, res, { body }) => {
  if (!DEMO_PAY) throw new HttpError(403, 'Not available');
  const user = userOf(req); const o = getOrder(String(body.number || ''));
  if (!user || !o || o.user_id !== user.id) throw new HttpError(400, 'Order mismatch.');
  markPaid(o, 'demo_' + crypto.randomBytes(6).toString('hex'), 'TEST payment (demo mode)');
  json(req, res, { ok: true, number: o.number });
});
// Razorpay webhook — set in Razorpay Dashboard → Webhooks: https://yourdomain/api/razorpay/webhook (events: payment.captured, order.paid)
route('POST', '/api/razorpay/webhook', (req, res, { raw }) => {
  if (!L.verifyWebhookSignature(raw, req.headers['x-razorpay-signature'])) throw new HttpError(400, 'Bad signature');
  const ev = JSON.parse(raw.toString());
  const pay = ev.payload?.payment?.entity; const rpOrder = pay?.order_id || ev.payload?.order?.entity?.id;
  if (['payment.captured', 'order.paid'].includes(ev.event) && rpOrder) {
    const row = db.prepare('SELECT number FROM orders WHERE rp_order_id = ?').get(rpOrder);
    if (row) markPaid(getOrder(row.number), pay?.id || '', 'Confirmed by Razorpay webhook');
  }
  json(req, res, { ok: true });
});

// ==================== ADMIN ====================
const adminOnly = req => { if (!isAdmin(req)) throw new HttpError(401, 'admin'); };
const adminPage = (req, res, html) => send(req, res, 200, html, 'text/html; charset=utf-8', { 'Cache-Control': 'no-store' });

route('GET', '/admin/login', (req, res) => adminPage(req, res, A.login(ADMIN_PASSWORD ? '' : 'Set ADMIN_PASSWORD in the server environment to enable admin.')));
route('POST', '/admin/login', (req, res, { body }) => {
  limit('admin:' + ipOf(req), 8, 15 * 60000);
  const ok = ADMIN_PASSWORD && crypto.timingSafeEqual(Buffer.from(hash(String(body.password || ''))), Buffer.from(hash(ADMIN_PASSWORD)));
  if (!ok) return adminPage(req, res, A.login('Wrong password.'));
  const s = newSession(0, 1);
  redirect(res, '/admin', { 'Set-Cookie': cookie('asid', s.token, s.maxAge) });
});
route('GET', '/admin/logout', (req, res) => { const t = parseCookies(req).asid; if (t) db.prepare('DELETE FROM sessions WHERE token = ?').run(hash(t)); redirect(res, '/admin/login', { 'Set-Cookie': cookie('asid', '', 0) }); });
route('GET', '/admin', (req, res) => {
  adminOnly(req); const s = getSettings();
  const one = (sql, ...a) => Object.values(db.prepare(sql).get(...a))[0] || 0;
  const st = {
    today: one("SELECT COUNT(*) FROM orders WHERE status != 'pending_payment' AND date(created_at, '+330 minutes') = date('now', '+330 minutes')"),
    revenue30: one("SELECT SUM(CASE WHEN payment_status = 'paid' THEN total ELSE pay_now END) FROM orders WHERE payment_status IN ('paid','advance_paid') AND created_at > datetime('now','-30 days')"),
    toShip: one("SELECT COUNT(*) FROM orders WHERE status IN ('placed','confirmed','packed')"),
    codPending: one("SELECT SUM(balance_due) FROM orders WHERE payment_status = 'advance_paid' AND status NOT IN ('cancelled','returned')"),
    customers: one('SELECT COUNT(*) FROM users'), products: one('SELECT COUNT(*) FROM products WHERE active = 1'),
  };
  const warnings = [];
  if (!L.razorpayEnabled()) warnings.push('Razorpay keys are not set — payments are in TEST mode. Add RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET.');
  if (!process.env.RAZORPAY_WEBHOOK_SECRET) warnings.push('Razorpay webhook secret not set (recommended so payments confirm even if the customer closes the page).');
  if (!otpProviderReady()) warnings.push('No SMS provider set — OTP codes only show on screen in test mode. Add MSG91 or 2Factor keys.');
  if (!s.gstin) warnings.push('Add your GSTIN in Settings (shown on invoices).');
  if (/Add your/.test(s.address) || /9000000000/.test(s.whatsapp)) warnings.push('Update your business address, phone and WhatsApp number in Settings.');
  if (/instagram\.com\/$/.test(s.instagram)) warnings.push('Add your Instagram and YouTube links in Settings.');
  if (!db.prepare("SELECT 1 FROM products WHERE images != '[]' LIMIT 1").get()) warnings.push('Upload real product photos (Products → edit). Placeholder artwork is showing now.');
  const recent = db.prepare("SELECT * FROM orders WHERE status != 'pending_payment' ORDER BY id DESC LIMIT 10").all().map(parseOrder);
  adminPage(req, res, A.dashboard(st, recent, warnings));
});
route('GET', '/admin/orders', (req, res, { u }) => {
  adminOnly(req); const q = pickQ(u, ['q', 'status']);
  let where = '1=1'; const args = [];
  if (q.status) { where += ' AND status = ?'; args.push(q.status); } else where += " AND status != 'pending_payment'";
  if (q.q) { where += ' AND (number LIKE ? OR address LIKE ?)'; args.push(`%${q.q}%`, `%${q.q}%`); }
  adminPage(req, res, A.orders(db.prepare(`SELECT * FROM orders WHERE ${where} ORDER BY id DESC LIMIT 300`).all(...args).map(parseOrder), q));
});
route('GET', '/admin/orders.csv', (req, res) => {
  adminOnly(req);
  const rows = db.prepare("SELECT * FROM orders WHERE status != 'pending_payment' ORDER BY id DESC").all().map(parseOrder);
  const c = v => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const csv = ['Order,Date,Name,Phone,City,State,Pincode,Pieces,Total,Method,Paid now,Balance,Payment,Status,Courier,AWB,GSTIN',
    ...rows.map(o => [o.number, o.created_at, o.address.name, o.address.phone, o.address.city, o.address.state, o.address.pincode, o.pieces, o.total, o.payment_method, o.pay_now, o.balance_due, o.payment_status, o.status, o.courier, o.tracking, o.gstin].map(c).join(','))].join('\n');
  send(req, res, 200, '﻿' + csv, 'text/csv; charset=utf-8', { 'Content-Disposition': 'attachment; filename="orders.csv"' });
});
route('GET', '/admin/orders/:number', (req, res, { params }) => {
  adminOnly(req); const o = getOrder(params.number); if (!o) throw new HttpError(404, 'Not found');
  adminPage(req, res, A.orderDetail(o, db.prepare('SELECT * FROM users WHERE id = ?').get(o.user_id), getSettings()));
});
route('POST', '/admin/api/orders/:number', (req, res, { params, body }) => {
  adminOnly(req); const o = getOrder(params.number); if (!o) throw new HttpError(404, 'Not found');
  if (!V.STATUS[body.status]) throw new HttpError(400, 'Bad status');
  const history = [...o.history];
  if (body.status !== o.status || body.note) history.push({ status: body.status, at: new Date().toISOString(), note: String(body.note || '').slice(0, 200) });
  let payment_status = o.payment_status;
  if (body.cod_collected && o.payment_status === 'advance_paid') { payment_status = 'paid'; history.push({ status: body.status, at: new Date().toISOString(), note: 'COD balance collected' }); }
  db.prepare('UPDATE orders SET status = ?, courier = ?, tracking = ?, payment_status = ?, history = ? WHERE id = ?').run(body.status, String(body.courier || '').slice(0, 60), String(body.tracking || '').slice(0, 60), payment_status, JSON.stringify(history), o.id);
  json(req, res, { ok: true, reload: true });
});
route('GET', '/admin/products', (req, res) => { adminOnly(req); adminPage(req, res, A.products(db.prepare('SELECT * FROM products ORDER BY id DESC').all().map(parseProduct), db.prepare('SELECT * FROM categories').all())); });
route('GET', '/admin/products/new', (req, res) => { adminOnly(req); adminPage(req, res, A.productForm(null, db.prepare('SELECT * FROM categories ORDER BY sort').all())); });
route('GET', '/admin/products/:id', (req, res, { params }) => {
  adminOnly(req); const p = parseProduct(db.prepare('SELECT * FROM products WHERE id = ?').get(+params.id)); if (!p) throw new HttpError(404, 'Not found');
  adminPage(req, res, A.productForm(p, db.prepare('SELECT * FROM categories ORDER BY sort').all()));
});
function saveProduct(body, id) {
  const arr = v => (Array.isArray(v) ? v : v ? [v] : []);
  const name = String(body.name || '').trim(); if (!name) throw new HttpError(400, 'Name is required');
  const price = Math.round(+body.price); if (!(price > 0)) throw new HttpError(400, 'Price must be more than 0');
  const colors = String(body.colors || '').split('\n').map(l => l.split(',').map(x => x.trim())).filter(([n]) => n).map(([n, h]) => ({ name: n.slice(0, 40), hex: /^#[0-9a-f]{3,6}$/i.test(h || '') ? h : '#222222' }));
  const sizes = arr(body.sizes); if (!sizes.length) throw new HttpError(400, 'Pick at least one size');
  let slug = L.slugify(body.slug || name);
  if (db.prepare('SELECT 1 FROM products WHERE slug = ? AND id != ?').get(slug, id || 0)) slug += '-' + crypto.randomInt(100, 999);
  const vals = [slug, name, +body.category_id, String(body.description || ''), String(body.fabric || ''), String(body.fit || ''), price, Math.round(+body.mrp || 0), JSON.stringify(colors.length ? colors : [{ name: 'Default', hex: '#222222' }]), JSON.stringify(sizes), JSON.stringify(arr(body.images).filter(i => /^\/uploads\/[\w.-]+$/.test(i))), Math.max(0, Math.round(+body.stock || 0)), body.featured ? 1 : 0, body.is_new ? 1 : 0, body.bestseller ? 1 : 0, body.active ? 1 : 0,
    JSON.stringify(L.normalizePacks(body.packs, sizes, colors.length ? colors : [{ name: 'Default', hex: '#222222' }])), body.sell_single ? 1 : 0];
  if (id) db.prepare('UPDATE products SET slug=?, name=?, category_id=?, description=?, fabric=?, fit=?, price=?, mrp=?, colors=?, sizes=?, images=?, stock=?, featured=?, is_new=?, bestseller=?, active=?, packs=?, sell_single=? WHERE id = ?').run(...vals, id);
  else db.prepare('INSERT INTO products (slug, name, category_id, description, fabric, fit, price, mrp, colors, sizes, images, stock, featured, is_new, bestseller, active, packs, sell_single) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').run(...vals);
}
route('POST', '/admin/api/products', (req, res, { body }) => { adminOnly(req); saveProduct(body); json(req, res, { ok: true }); });
route('POST', '/admin/api/products/:id', (req, res, { params, body }) => { adminOnly(req); saveProduct(body, +params.id); json(req, res, { ok: true }); });
route('POST', '/admin/api/upload', async (req, res, { body }) => {
  adminOnly(req);
  const m = String(body.data || '').match(/^data:image\/(jpeg|png|webp);base64,(.+)$/);
  if (!m) throw new HttpError(400, 'Upload a JPG, PNG or WEBP image');
  const buf = Buffer.from(m[2], 'base64'); if (buf.length > 8e6) throw new HttpError(400, 'Image too large');
  const name = `${Date.now().toString(36)}-${crypto.randomBytes(5).toString('hex')}.${m[1] === 'jpeg' ? 'jpg' : m[1]}`;
  fs.writeFileSync(path.join(UPLOADS, name), buf);
  json(req, res, { ok: true, url: '/uploads/' + name });
});
route('GET', '/admin/categories', (req, res) => { adminOnly(req); adminPage(req, res, A.categories(db.prepare('SELECT * FROM categories ORDER BY sort, id').all())); });
function saveCat(body, id) {
  const name = String(body.name || '').trim(); if (!name) throw new HttpError(400, 'Name required');
  let slug = L.slugify(name); if (db.prepare('SELECT 1 FROM categories WHERE slug = ? AND id != ?').get(slug, id || 0)) slug += '-' + crypto.randomInt(10, 99);
  if (id) db.prepare('UPDATE categories SET name = ?, slug = ?, icon = ?, sort = ?, active = ? WHERE id = ?').run(name, slug, String(body.icon || 'tee'), +body.sort || 0, body.active ? 1 : 0, id);
  else db.prepare('INSERT INTO categories (name, slug, icon, sort, active) VALUES (?, ?, ?, ?, ?)').run(name, slug, String(body.icon || 'tee'), +body.sort || 99, body.active ? 1 : 0);
}
route('POST', '/admin/api/categories', (req, res, { body }) => { adminOnly(req); saveCat(body); json(req, res, { ok: true, reload: true }); });
route('POST', '/admin/api/categories/:id', (req, res, { params, body }) => { adminOnly(req); saveCat(body, +params.id); json(req, res, { ok: true, reload: true }); });
route('GET', '/admin/customers', (req, res) => {
  adminOnly(req);
  adminPage(req, res, A.customers(db.prepare(`SELECT u.*, COUNT(o.id) orders, SUM(o.total) spent FROM users u LEFT JOIN orders o ON o.user_id = u.id AND o.status != 'pending_payment' GROUP BY u.id ORDER BY u.id DESC`).all()));
});
route('GET', '/admin/messages', (req, res) => { adminOnly(req); adminPage(req, res, A.messages(db.prepare('SELECT * FROM messages ORDER BY id DESC LIMIT 300').all())); });
route('GET', '/admin/settings', (req, res) => { adminOnly(req); adminPage(req, res, A.settings(getSettings())); });
route('POST', '/admin/api/settings', (req, res, { body }) => {
  adminOnly(req); const cur = getSettings();
  for (const k of Object.keys(cur)) if (k in body) setSetting(k, String(body[k]).slice(0, 2000));
  json(req, res, { ok: true });
});

// ==================== static ====================
const MIME = { '.css': 'text/css; charset=utf-8', '.js': 'application/javascript; charset=utf-8', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.svg': 'image/svg+xml', '.webmanifest': 'application/manifest+json', '.ico': 'image/x-icon', '.html': 'text/html; charset=utf-8' };
function serveFile(req, res, file, cache) {
  fs.readFile(file, (err, buf) => {
    if (err) return notFound(req, res);
    send(req, res, 200, buf, MIME[path.extname(file)] || 'application/octet-stream', { 'Cache-Control': cache });
  });
}
function staticRoute(req, res, pathname) {
  if (pathname === '/sw.js') {
    const sw = `// Soni Brothers app worker ${ASSET_V}
const V = 'sb-${ASSET_V}';
self.addEventListener('install', e => { self.skipWaiting(); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== V).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin) return;
  if (/^\\/(api|admin|checkout|account|order|invoice|login|logout|picker)/.test(u.pathname)) return;
  const fresh = () => fetch(e.request).then(r => { if (r.ok) { const c = r.clone(); caches.open(V).then(x => x.put(e.request, c)); } return r; });
  if (/^\\/(icons|uploads)\\//.test(u.pathname)) { e.respondWith(caches.match(e.request).then(hit => hit || fresh())); return; }
  if (/^\\/static\\//.test(u.pathname) || e.request.mode === 'navigate') { e.respondWith(fresh().catch(() => caches.match(e.request).then(hit => hit || caches.match('/')))); }
});`;
    send(req, res, 200, sw, 'application/javascript; charset=utf-8', { 'Cache-Control': 'no-cache' }); return true;
  }
  if (pathname === '/manifest.webmanifest') {
    const s = getSettings();
    const m = JSON.parse(fs.readFileSync(path.join(PUBLIC, 'manifest.webmanifest'), 'utf8'));
    Object.assign(m, { name: `${s.brand_name} — Wholesale Streetwear`, short_name: s.brand_name, description: `Factory-direct wholesale streetwear. MOQ ${s.moq} pieces, COD available, pan-India delivery.` });
    send(req, res, 200, JSON.stringify(m), 'application/manifest+json', { 'Cache-Control': 'public, max-age=3600' }); return true;
  }
  if (pathname === '/favicon.ico') return serveFile(req, res, path.join(PUBLIC, 'icons', 'icon-192.png'), 'public, max-age=604800'), true;
  for (const [prefix, dir, cache] of [['/static/', path.join(PUBLIC, 'static'), 'public, max-age=604800'], ['/icons/', path.join(PUBLIC, 'icons'), 'public, max-age=604800'], ['/uploads/', UPLOADS, 'public, max-age=31536000, immutable']]) {
    if (pathname.startsWith(prefix)) {
      const file = path.normalize(path.join(dir, decodeURIComponent(pathname.slice(prefix.length))));
      if (!file.startsWith(dir + path.sep)) return notFound(req, res), true;
      return serveFile(req, res, file, cache), true;
    }
  }
  return false;
}
function notFound(req, res) {
  if (req.url.startsWith('/api') || req.url.startsWith('/admin/api')) return json(req, res, { error: 'Not found' }, 404);
  page(req, res, { title: 'Page not found', noindex: true, body: `<section class="wrap narrow center page-head"><p class="eyebrow">404</p><h1 class="display xl">Lost the drop?</h1><p class="muted">This page doesn't exist.</p><a class="btn btn-lg" href="/shop">Shop all</a></section>` }, 404);
}

// ==================== server ====================
const server = http.createServer(async (req, res) => {
  const u = new URL(req.url, 'http://x');
  const method = req.method === 'HEAD' ? 'GET' : req.method;
  try {
    if (method === 'GET' && staticRoute(req, res, u.pathname)) return;
    let r, m;
    for (const x of routes) if (x.method === method && (m = u.pathname.match(x.re))) { r = x; break; }
    if (!r) return notFound(req, res);
    const params = {}; r.keys.forEach((k, i) => { params[k] = decodeURIComponent(m[i + 1]); });
    let body = {}, raw = null;
    if (method === 'POST') {
      const isApi = u.pathname.startsWith('/api/') || u.pathname.startsWith('/admin/api/');
      if (isApi && u.pathname !== '/api/razorpay/webhook' && req.headers['x-requested-with'] !== 'sb') throw new HttpError(403, 'Forbidden');
      ({ body, raw } = await parseBody(req, u.pathname === '/admin/api/upload' ? 12e6 : 1e6));
    }
    await r.fn(req, res, { params, body, raw, u });
  } catch (e) {
    const status = e.status || 500;
    if (status === 500) console.error(e);
    if (res.headersSent) return res.end();
    if (status === 401 && e.message === 'admin') return u.pathname.startsWith('/admin/api') ? json(req, res, { error: 'Session expired — log in again.' }, 401) : redirect(res, '/admin/login');
    if (status === 404 && method === 'GET') return notFound(req, res);
    if (u.pathname.startsWith('/api') || u.pathname.startsWith('/admin/api')) return json(req, res, { error: status === 500 ? 'Something went wrong. Please try again.' : e.message }, status);
    send(req, res, status, `<h1>${status}</h1><p>${L.esc(status === 500 ? 'Something went wrong.' : e.message)}</p>`);
  }
});
server.listen(PORT, () => {
  console.log(`Soni Brothers store running on http://localhost:${PORT}`);
  if (DEMO_PAY) console.log('⚠ TEST MODE: Razorpay keys not set — payments are simulated.');
  if (!otpProviderReady()) console.log('⚠ No SMS provider — OTP codes are printed here and shown on screen (test mode only).');
  if (!PROD && !process.env.ADMIN_PASSWORD) console.log('⚠ Admin password is "admin123" in test mode. Set ADMIN_PASSWORD before going live.');
});
