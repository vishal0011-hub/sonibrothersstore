const { esc, garmentIcon } = require('../lib');

const ICON = {
  search: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>',
  user: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8"><circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/></svg>',
  bag: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M5 8h14l-1 13H6L5 8Z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/></svg>',
  home: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 11 12 4l9 7v9h-6v-6H9v6H3z"/></svg>',
  grid: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="4" y="4" width="7" height="7"/><rect x="13" y="4" width="7" height="7"/><rect x="4" y="13" width="7" height="7"/><rect x="13" y="13" width="7" height="7"/></svg>',
  menu: '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 7h16M4 12h16M4 17h16"/></svg>',
  close: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M6 6l12 12M18 6 6 18"/></svg>',
  arrow: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
  wa: '<svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18.2a8.2 8.2 0 0 1-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8s-.4-.1-.6.1-.7.8-.8 1-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.3-.4.7-1.4.1-.2 0-.3 0-.5l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.7 11.8 11.8 0 0 0 4.5 4c1.7.7 2.3.8 3.2.6a2.7 2.7 0 0 0 1.8-1.2 2.2 2.2 0 0 0 .2-1.2c-.1-.2-.3-.2-.6-.4Z"/></svg>',
  ig: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1" fill="currentColor"/></svg>',
  yt: '<svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><path d="M22 8.2a3 3 0 0 0-2.1-2.1C18 5.6 12 5.6 12 5.6s-6 0-7.9.5A3 3 0 0 0 2 8.2 31 31 0 0 0 1.6 12a31 31 0 0 0 .4 3.8 3 3 0 0 0 2.1 2.1c1.9.5 7.9.5 7.9.5s6 0 7.9-.5a3 3 0 0 0 2.1-2.1 31 31 0 0 0 .4-3.8 31 31 0 0 0-.4-3.8ZM10 15.1V8.9l5.2 3.1Z"/></svg>',
  truck: '<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M2 6h12v10H2zM14 10h4l3 3v3h-7"/><circle cx="6" cy="18" r="2"/><circle cx="17" cy="18" r="2"/></svg>',
  cash: '<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="2" y="6" width="20" height="12" rx="1"/><circle cx="12" cy="12" r="3"/><path d="M6 9v.01M18 15v.01"/></svg>',
  factory: '<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M2 21V10l6 4V10l6 4V6h3l1-3h2l1 3v15z"/><path d="M6 17h2M11 17h2M16 17h2"/></svg>',
  pin: '<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M12 21s-7-6.5-7-12a7 7 0 0 1 14 0c0 5.5-7 12-7 12Z"/><circle cx="12" cy="9" r="2.5"/></svg>',
  shield: '<svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6z"/><path d="m9 12 2 2 4-4"/></svg>',
};

// Logo comes from Admin → Settings → Brand name: first word plain, the rest highlighted (e.g. SONI [BROTHERS])
function logoText(s, rest) {
  const words = String(s.brand_name || 'Store').trim().toUpperCase().split(/\s+/);
  const first = words.shift();
  return `${esc(first)}<span>${esc(rest || words.join(' ') || 'STORE')}</span>`;
}
const greeting = s => `Hi ${s.brand_name}, I want to place a wholesale order.`;

const waLink = (s, text = '') => `https://wa.me/${esc(String(s.whatsapp || '').replace(/\D/g, ''))}${text ? '?text=' + encodeURIComponent(text) : ''}`;

function layout(s, { title, desc, body, user, cats = [], canonical = '', ogImage = '', jsonld = null, page = '', noindex = false }) {
  const brand = esc(s.brand_name);
  const fullTitle = title ? `${esc(title)} | ${brand}` : `${brand} — ${esc(s.tagline)}`;
  const description = esc(desc || s.hero_sub);
  const base = process.env.SITE_URL || '';
  return `<!doctype html>
<html lang="en-IN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${fullTitle}</title>
<meta name="description" content="${description}">
${noindex ? '<meta name="robots" content="noindex">' : ''}
${canonical ? `<link rel="canonical" href="${esc(base + canonical)}">` : ''}
<meta property="og:type" content="website"><meta property="og:site_name" content="${brand}">
<meta property="og:title" content="${fullTitle}"><meta property="og:description" content="${description}">
<meta property="og:image" content="${esc(ogImage || base + '/icons/og.png')}">
<meta name="twitter:card" content="summary_large_image">
<meta name="theme-color" content="#0b0b0b">
<link rel="manifest" href="/manifest.webmanifest">
<link rel="icon" href="/icons/icon-192.png" sizes="192x192">
<link rel="apple-touch-icon" href="/icons/apple-touch-icon.png">
<meta name="apple-mobile-web-app-capable" content="yes"><meta name="apple-mobile-web-app-status-bar-style" content="black">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Anton&family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/static/styles.css?v=2">
${jsonld ? `<script type="application/ld+json">${JSON.stringify(jsonld).replace(/</g, '\\u003c')}</script>` : ''}
</head>
<body data-page="${esc(page)}" data-moq="${esc(s.moq)}" data-logged="${user ? 1 : 0}">
<a class="skip" href="#main">Skip to content</a>
<div class="announce"><div class="announce-track"><span>${esc(s.announcement)}</span><span aria-hidden="true">${esc(s.announcement)}</span></div></div>
<header class="hdr">
  <div class="wrap hdr-in">
    <button class="icon-btn only-m" data-open="menu" aria-label="Menu">${ICON.menu}</button>
    <a href="/" class="logo" aria-label="${brand} home">${logoText(s)}</a>
    <nav class="nav only-d" aria-label="Main">
      <a href="/shop">Shop all</a>
      ${cats.slice(0, 6).map(c => `<a href="/c/${esc(c.slug)}">${esc(c.name)}</a>`).join('')}
    </nav>
    <div class="hdr-act">
      <button class="icon-btn only-d" data-open="search" aria-label="Search">${ICON.search}</button>
      <a class="icon-btn only-d" href="/account" aria-label="Account">${ICON.user}</a>
      <button class="icon-btn cart-btn" data-open="cart" aria-label="Cart">${ICON.bag}<b class="cart-count" hidden>0</b></button>
    </div>
  </div>
</header>

<div class="search-ov" id="search" hidden>
  <form action="/search" class="wrap search-form" role="search">
    ${ICON.search}<input name="q" placeholder="Search oversized tees, cargos, hoodies…" autocomplete="off" aria-label="Search products">
    <button type="button" class="icon-btn" data-close aria-label="Close">${ICON.close}</button>
  </form>
</div>

<aside class="menu" id="menu" hidden aria-label="Menu">
  <div class="menu-head"><span class="logo">${logoText(s)}</span><button class="icon-btn" data-close aria-label="Close">${ICON.close}</button></div>
  <a href="/shop" class="menu-big">Shop all ${ICON.arrow}</a>
  ${cats.map(c => `<a href="/c/${esc(c.slug)}" class="menu-cat">${garmentIcon(c.icon, 28)}<span>${esc(c.name)}</span></a>`).join('')}
  <div class="menu-links"><a href="/account">My account</a><a href="/track">Track order</a><a href="/size-guide">Size guide</a><a href="/contact">Contact</a></div>
</aside>

<main id="main">${body}</main>

<section class="social-band">
  <div class="wrap social-in">
    <div><p class="eyebrow">${esc(s.instagram_followers)} community</p><h2 class="display">Follow the drop.</h2><p class="muted-inv">New styles, restock alerts and reseller tips — first on our socials.</p></div>
    <div class="social-btns">
      <a class="sbtn ig" href="${esc(s.instagram)}" target="_blank" rel="noopener">${ICON.ig}<span>Instagram</span></a>
      <a class="sbtn yt" href="${esc(s.youtube)}" target="_blank" rel="noopener">${ICON.yt}<span>YouTube</span></a>
      <a class="sbtn wa" href="${waLink(s, greeting(s))}" target="_blank" rel="noopener">${ICON.wa}<span>WhatsApp</span></a>
    </div>
  </div>
</section>

<footer class="ftr">
  <div class="wrap ftr-grid">
    <div class="ftr-brand">
      <a href="/" class="logo inv">${logoText(s)}</a>
      <p>${esc(s.tagline)}</p>
      <p class="small">${esc(s.legal_name)}<br>${esc(s.address)}, ${esc(s.city)}, ${esc(s.state)} ${esc(s.pincode)}${s.gstin ? `<br>GSTIN: ${esc(s.gstin)}` : ''}</p>
      <p class="small"><a href="tel:${esc(s.phone.replace(/\s/g, ''))}">${esc(s.phone)}</a> · <a href="mailto:${esc(s.email)}">${esc(s.email)}</a></p>
    </div>
    <div><h4>Shop</h4>${cats.map(c => `<a href="/c/${esc(c.slug)}">${esc(c.name)}</a>`).join('')}</div>
    <div><h4>Help</h4><a href="/track">Track order</a><a href="/shipping-policy">Shipping &amp; delivery</a><a href="/refund-policy">Returns &amp; refunds</a><a href="/cancellation-policy">Cancellation</a><a href="/size-guide">Size guide</a><a href="/faq">FAQ</a><a href="/contact">Contact us</a></div>
    <div><h4>Company</h4><a href="/about">About us</a><a href="/wholesale">How wholesale works</a><a href="/terms">Terms &amp; conditions</a><a href="/privacy-policy">Privacy policy</a><a href="/account">My account</a></div>
  </div>
  <div class="wrap ftr-bottom">
    <div class="pay-chips"><span>UPI</span><span>Cards</span><span>Net Banking</span><span>COD*</span><span>Secured by Razorpay</span></div>
    <p>© ${new Date().getFullYear()} ${brand}. All rights reserved. *COD requires ${esc(s.cod_advance_pct)}% advance.</p>
  </div>
</footer>

<nav class="tabbar only-m" aria-label="App navigation">
  <a href="/" class="${page === 'home' ? 'on' : ''}">${ICON.home}<span>Home</span></a>
  <a href="/shop" class="${page === 'shop' ? 'on' : ''}">${ICON.grid}<span>Shop</span></a>
  <button data-open="search">${ICON.search}<span>Search</span></button>
  <a href="/account" class="${page === 'account' ? 'on' : ''}">${ICON.user}<span>Account</span></a>
  <button data-open="cart" class="cart-btn">${ICON.bag}<span>Cart</span><b class="cart-count" hidden>0</b></button>
</nav>

<a class="wa-float" href="${waLink(s, greeting(s))}" target="_blank" rel="noopener" aria-label="Chat on WhatsApp">${ICON.wa}</a>

<div class="scrim" hidden></div>
<aside class="drawer" id="cart" hidden aria-label="Cart">
  <div class="drawer-head"><h3>Your bag</h3><button class="icon-btn" data-close aria-label="Close">${ICON.close}</button></div>
  <div class="moq-meter"><div class="moq-text"></div><div class="bar"><i></i></div></div>
  <div class="drawer-body" id="cart-lines"></div>
  <div class="drawer-foot">
    <div class="row-between"><span>Subtotal</span><strong id="cart-sub">₹0</strong></div>
    <p class="tiny muted">Inclusive of GST. Shipping calculated at checkout.</p>
    <a href="/checkout" class="btn btn-block" id="cart-checkout">Checkout</a>
    <a href="/cart" class="btn btn-ghost btn-block">View bag</a>
  </div>
</aside>

<div class="modal" id="quick" hidden role="dialog" aria-modal="true" aria-label="Quick add"><div class="modal-card" id="quick-body"></div></div>

<div class="modal" id="login" hidden role="dialog" aria-modal="true" aria-label="Login">
  <div class="modal-card login-card">
    <button class="icon-btn modal-x" data-close aria-label="Close">${ICON.close}</button>
    <p class="eyebrow">Secure login</p>
    <h3 class="display sm">Log in with OTP</h3>
    <form id="otp-form-1" class="stack">
      <label class="field"><span>Mobile number</span><div class="phone-in"><b>+91</b><input name="phone" inputmode="numeric" pattern="[6-9][0-9]{9}" maxlength="10" required placeholder="10-digit mobile number" autocomplete="tel-national"></div></label>
      <button class="btn btn-block">Send OTP</button>
      <p class="tiny muted">We'll send a 6-digit code by SMS. By continuing you agree to our <a href="/terms">Terms</a> &amp; <a href="/privacy-policy">Privacy Policy</a>.</p>
    </form>
    <form id="otp-form-2" class="stack" hidden>
      <p class="muted small">Code sent to <b id="otp-phone"></b> · <a href="#" id="otp-change">Change</a></p>
      <label class="field"><span>Enter OTP</span><input name="code" inputmode="numeric" maxlength="6" pattern="[0-9]{6}" required autocomplete="one-time-code" class="otp-input" placeholder="••••••"></label>
      <button class="btn btn-block">Verify &amp; continue</button>
      <button type="button" class="link small" id="otp-resend" disabled>Resend OTP</button>
      <p class="tiny dev-otp" hidden></p>
    </form>
  </div>
</div>

<div class="toast" role="status" aria-live="polite" hidden></div>
<script src="/static/app.js?v=2" defer></script>
</body></html>`;
}

module.exports = { layout, ICON, waLink, logoText };
