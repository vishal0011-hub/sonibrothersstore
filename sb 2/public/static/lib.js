// Shared helpers: HTML escaping, money, GST, garment artwork, Razorpay, SMS/OTP
const crypto = require('crypto');

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const inr = n => '₹' + Number(n || 0).toLocaleString('en-IN');
const slugify = s => String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80);

// ---------- Garment silhouettes (used for category icons + placeholder product art) ----------
const SHAPES = {
  tee: 'M38 22 L50 16 Q60 24 70 16 L82 22 L98 38 L88 48 L82 43 L82 102 L38 102 L38 43 L32 48 L22 38 Z',
  oversized: 'M34 22 L50 15 Q60 23 70 15 L86 22 L104 44 L90 54 L86 48 L88 104 L32 104 L34 48 L30 54 L16 44 Z',
  shirt: 'M38 22 L50 15 L60 28 L70 15 L82 22 L98 40 L88 48 L82 43 L82 104 L38 104 L38 43 L32 48 L22 40 Z',
  polo: 'M38 22 L50 16 L60 30 L70 16 L82 22 L98 38 L88 48 L82 43 L82 102 L38 102 L38 43 L32 48 L22 38 Z',
  hoodie: 'M40 26 Q44 10 60 10 Q76 10 80 26 L94 32 L104 94 L92 96 L86 54 L86 104 L34 104 L34 54 L28 96 L16 94 L26 32 Z',
  jacket: 'M40 22 L52 16 L60 22 L68 16 L80 22 L94 30 L104 94 L92 96 L86 54 L86 104 L34 104 L34 54 L28 96 L16 94 L26 30 Z',
  jeans: 'M40 14 L80 14 L86 108 L66 108 L60 44 L54 108 L34 108 Z',
  cargo: 'M38 14 L82 14 L88 108 L66 108 L60 44 L54 108 L32 108 Z',
  jogger: 'M40 14 L80 14 L82 100 L66 104 L60 44 L54 104 L38 100 Z',
  shorts: 'M36 30 L84 30 L90 82 L64 84 L60 56 L56 84 L30 82 Z',
};
const DETAILS = {
  shirt: '<path d="M60 28 V104" stroke-width="1.6"/><circle cx="60" cy="44" r="1.6"/><circle cx="60" cy="60" r="1.6"/><circle cx="60" cy="76" r="1.6"/>',
  polo: '<path d="M60 30 V48" stroke-width="1.6"/><circle cx="60" cy="38" r="1.4"/>',
  hoodie: '<path d="M48 26 Q60 40 72 26"/><path d="M46 78 H74 L70 92 H50 Z"/>',
  jacket: '<path d="M60 22 V104"/><path d="M34 98 H86" stroke-width="3"/>',
  jeans: '<path d="M40 22 H80"/><path d="M60 14 V44"/>',
  cargo: '<path d="M38 22 H82"/><rect x="34" y="60" width="12" height="14" rx="1"/><rect x="74" y="60" width="12" height="14" rx="1"/>',
  jogger: '<path d="M40 22 H80"/><path d="M38 96 L54 99 M66 99 L82 96" stroke-width="3"/>',
  shorts: '<path d="M36 38 H84"/>',
};
function garmentIcon(icon, size = 40) {
  const d = SHAPES[icon] || SHAPES.tee;
  return `<svg viewBox="0 0 120 120" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="4" stroke-linejoin="round" stroke-linecap="round" aria-hidden="true"><path d="${d}"/>${(DETAILS[icon] || '').replace(/stroke-width="[\d.]+"/g, 'stroke-width="3"')}</svg>`;
}
function lum(hex) {
  const h = (hex || '#888').replace('#', ''); const n = parseInt(h.length === 3 ? h.split('').map(x => x + x).join('') : h, 16);
  return (0.299 * (n >> 16 & 255) + 0.587 * (n >> 8 & 255) + 0.114 * (n & 255)) / 255;
}
// Placeholder product art: garment silhouette in the product colour (replace with real photos from Admin)
function garmentArt(icon, hex = '#111', label = '') {
  const d = SHAPES[icon] || SHAPES.tee;
  const line = lum(hex) > 0.6 ? 'rgba(0,0,0,.35)' : 'rgba(255,255,255,.28)';
  return `<svg class="art" viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${esc(label)}">
    <ellipse cx="60" cy="112" rx="34" ry="3" fill="rgba(0,0,0,.08)"/>
    <path d="${d}" fill="${esc(hex)}" stroke="rgba(0,0,0,.18)" stroke-width=".8" stroke-linejoin="round"/>
    <g fill="none" stroke="${line}" stroke-width="1.2">${DETAILS[icon] || ''}</g></svg>`;
}

// ---------- GST ----------
// Apparel GST (from 22 Sep 2025): 5% if sale value per piece ≤ ₹2,500, else 18%. Configurable in Admin → Settings.
function computeTax(lines, settings, buyerState) {
  const low = +settings.gst_low, high = +settings.gst_high, thr = +settings.gst_threshold;
  const inclusive = settings.prices_include_gst === '1';
  const intra = (buyerState || '').trim().toLowerCase() === (settings.state || '').trim().toLowerCase();
  let taxable = 0, tax = 0;
  const rows = lines.map(l => {
    const rate = l.price <= thr ? low : high;
    const gross = l.price * l.qty;
    const t = inclusive ? gross - gross / (1 + rate / 100) : gross * rate / 100;
    const base = inclusive ? gross - t : gross;
    taxable += base; tax += t;
    return { ...l, rate, taxable: +base.toFixed(2), tax: +t.toFixed(2) };
  });
  return {
    rows, inclusive, intra,
    taxable: +taxable.toFixed(2), tax: +tax.toFixed(2),
    cgst: intra ? +(tax / 2).toFixed(2) : 0, sgst: intra ? +(tax / 2).toFixed(2) : 0, igst: intra ? 0 : +tax.toFixed(2),
  };
}

// ---------- Razorpay ----------
const RP_KEY = process.env.RAZORPAY_KEY_ID || '';
const RP_SECRET = process.env.RAZORPAY_KEY_SECRET || '';
const RP_WEBHOOK_SECRET = process.env.RAZORPAY_WEBHOOK_SECRET || '';
const razorpayEnabled = () => Boolean(RP_KEY && RP_SECRET);

async function razorpayCreateOrder(amountRupees, receipt, notes = {}) {
  const res = await fetch('https://api.razorpay.com/v1/orders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: 'Basic ' + Buffer.from(`${RP_KEY}:${RP_SECRET}`).toString('base64') },
    body: JSON.stringify({ amount: Math.round(amountRupees * 100), currency: 'INR', receipt, notes }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error?.description || 'Razorpay order failed');
  return data;
}
function safeEqual(a, b) {
  const x = Buffer.from(String(a)), y = Buffer.from(String(b));
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}
const verifyPaymentSignature = (rpOrderId, paymentId, signature) =>
  safeEqual(crypto.createHmac('sha256', RP_SECRET).update(`${rpOrderId}|${paymentId}`).digest('hex'), signature);
const verifyWebhookSignature = (rawBody, signature) =>
  Boolean(RP_WEBHOOK_SECRET) && safeEqual(crypto.createHmac('sha256', RP_WEBHOOK_SECRET).update(rawBody).digest('hex'), signature);

// ---------- SMS / OTP via MSG91 (https://msg91.com) ----------
const MSG91_KEY = process.env.MSG91_AUTH_KEY || '';
const MSG91_OTP_TEMPLATE = process.env.MSG91_OTP_TEMPLATE_ID || '';
const MSG91_ORDER_TEMPLATE = process.env.MSG91_ORDER_TEMPLATE_ID || '';
const smsEnabled = () => Boolean(MSG91_KEY && MSG91_OTP_TEMPLATE);

async function sendOtpSms(phone10, code) {
  if (!smsEnabled()) { console.log(`[DEV OTP] +91 ${phone10} → ${code}`); return { dev: true }; }
  const url = `https://control.msg91.com/api/v5/otp?template_id=${encodeURIComponent(MSG91_OTP_TEMPLATE)}&mobile=91${phone10}&otp=${code}&otp_length=6&otp_expiry=10`;
  const res = await fetch(url, { method: 'POST', headers: { authkey: MSG91_KEY, 'Content-Type': 'application/json' }, body: '{}' });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || data.type === 'error') throw new Error(data.message || 'Could not send OTP');
  return data;
}
async function sendOrderSms(phone10, vars) {
  if (!MSG91_KEY || !MSG91_ORDER_TEMPLATE) { console.log(`[ORDER SMS] +91 ${phone10}`, vars); return; }
  try {
    await fetch('https://control.msg91.com/api/v5/flow', {
      method: 'POST', headers: { authkey: MSG91_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ template_id: MSG91_ORDER_TEMPLATE, short_url: '0', recipients: [{ mobiles: '91' + phone10, ...vars }] }),
    });
  } catch (e) { console.error('Order SMS failed', e.message); }
}

// ---------- Custom sets (packs) ----------
// A product can have any number of sets, defined in Admin → Products:
//   { id, name, sizes: { M: 1, L: 1, XL: 1 }, colorMode: 'each' | 'all' | 'list', colors: [names], price: per-piece override or null }
//   'each' → customer picks ONE colour; a set = the sizes in that colour        (e.g. M+L+XL = 3 pcs)
//   'all'  → a set contains EVERY colour of the product × the sizes             (e.g. 12 colours × M,L,XL = 36 pcs)
//   'list' → a set contains only the chosen colours × the sizes
const SIZE_ORDER = ['XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL', '4XL', 'FREE'];
const sizeRank = z => { const i = SIZE_ORDER.indexOf(String(z).toUpperCase()); return i >= 0 ? i : 100 + (parseFloat(z) || 0); };

function packColors(pack, product) {
  if (pack.colorMode === 'all') return product.colors;
  if (pack.colorMode === 'list') return product.colors.filter(c => (pack.colors || []).includes(c.name));
  return null; // 'each' — customer chooses
}
function packInfo(pack, product) {
  const sizes = Object.entries(pack.sizes || {}).filter(([z, n]) => product.sizes.includes(z) && n > 0).sort((a, b) => sizeRank(a[0]) - sizeRank(b[0]));
  const perColour = sizes.reduce((a, [, n]) => a + n, 0);
  const cols = packColors(pack, product);
  const pieces = perColour * (cols ? cols.length : 1);
  const unit = pack.price > 0 ? pack.price : product.price;
  const sizesLabel = sizes.map(([z, n]) => (n > 1 ? `${n}×${z}` : z)).join(' · ');
  return { id: pack.id, name: pack.name, sizes, sizesLabel, colorMode: pack.colorMode, colors: cols, perColour, pieces, unit, setPrice: unit * pieces };
}
// Parse + validate what the admin typed. sizesText like "M, L, XL" or "M:2, L:2, XL:1"
function normalizePacks(raw, sizes, colors) {
  let list = raw;
  if (typeof list === 'string') { try { list = JSON.parse(list || '[]'); } catch { list = []; } }
  if (!Array.isArray(list)) return [];
  const colorNames = colors.map(c => c.name);
  return list.slice(0, 20).map(pk => {
    const map = {};
    const text = typeof pk.sizes === 'string' ? pk.sizes : Object.entries(pk.sizes || {}).map(([z, n]) => `${z}:${n}`).join(',');
    for (const part of text.split(/[,;]+/).map(x => x.trim()).filter(Boolean)) {
      const m = part.match(/^(.+?)\s*[:×*]\s*(\d+)$/);            // "M:2", "M×2", "M*2" — never split on the X in XL
      const [z0, n0] = m ? [m[1].trim(), m[2]] : [part, undefined];
      const z = sizes.find(sz => sz.toUpperCase() === String(z0).toUpperCase());
      if (!z) throw Object.assign(new Error(`Set "${pk.name || ''}": size "${z0}" is not one of this product's sizes (${sizes.join(', ')}).`), { status: 400 });
      const n = n0 === undefined || n0 === '' ? 1 : Math.floor(+n0);
      if (!(n >= 1 && n <= 99)) throw Object.assign(new Error(`Set "${pk.name || ''}": quantity for ${z} must be 1–99.`), { status: 400 });
      map[z] = (map[z] || 0) + n;
    }
    if (!Object.keys(map).length) throw Object.assign(new Error('Every set needs at least one size.'), { status: 400 });
    const mode = ['each', 'all', 'list'].includes(pk.colorMode) ? pk.colorMode : 'each';
    const pickedColors = (Array.isArray(pk.colors) ? pk.colors : String(pk.colors || '').split(',')).map(x => x.trim()).filter(x => colorNames.includes(x));
    if (mode === 'list' && !pickedColors.length) throw Object.assign(new Error(`Set "${pk.name || ''}": choose which colours are in the set.`), { status: 400 });
    const total = Object.values(map).reduce((a, b) => a + b, 0);
    return {
      id: /^[a-z0-9]{4,12}$/.test(pk.id || '') ? pk.id : crypto.randomBytes(4).toString('hex'),
      name: String(pk.name || '').trim().slice(0, 40) || (mode === 'each' ? `Set of ${total}` : 'Assorted set'),
      sizes: map, colorMode: mode, colors: mode === 'list' ? pickedColors : [],
      price: Math.round(+pk.price) > 0 ? Math.round(+pk.price) : null,
    };
  });
}

const INDIAN_STATES = ['Andaman and Nicobar Islands', 'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chandigarh', 'Chhattisgarh', 'Dadra and Nagar Haveli and Daman and Diu', 'Delhi', 'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jammu and Kashmir', 'Jharkhand', 'Karnataka', 'Kerala', 'Ladakh', 'Lakshadweep', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram', 'Nagaland', 'Odisha', 'Puducherry', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal'];

module.exports = {
  esc, inr, slugify, garmentIcon, garmentArt, computeTax,
  RP_KEY, razorpayEnabled, razorpayCreateOrder, verifyPaymentSignature, verifyWebhookSignature,
  smsEnabled, sendOtpSms, sendOrderSms, INDIAN_STATES, packInfo, normalizePacks, sizeRank,
};
