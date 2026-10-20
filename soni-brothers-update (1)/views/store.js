const { esc, inr, garmentIcon, garmentArt, INDIAN_STATES, packInfo } = require('../lib');
const { ICON, waLink } = require('./layout');

const pct = p => p.mrp > p.price ? Math.round((1 - p.price / p.mrp) * 100) : 0;

function productImg(p, icon, i = 0, cls = '') {
  const src = p.images[i];
  const color = p.colors[i % (p.colors.length || 1)] || { hex: '#222', name: '' };
  return src
    ? `<img class="${cls}" src="${esc(src)}" alt="${esc(p.name)}" loading="lazy" decoding="async">`
    : `<div class="ph ${cls}" style="--bg:${esc(color.hex)}">${garmentArt(icon, color.hex, p.name + ' ' + color.name)}</div>`;
}

// Data the client needs for quick-add (kept small)
const packsOf = p => (p.packs || []).map(pk => packInfo(pk, p)).filter(x => x.pieces > 0);
const cardData = (p, icon) => esc(JSON.stringify({
  id: p.id, slug: p.slug, name: p.name, price: p.price, mrp: p.mrp, sizes: p.sizes, colors: p.colors, icon, img: p.images[0] || '',
  single: p.sell_single || !packsOf(p).length ? 1 : 0,
  packs: packsOf(p).map(k => ({ id: k.id, name: k.name, label: k.sizesLabel, pieces: k.pieces, setPrice: k.setPrice, unit: k.unit, mode: k.colorMode, colors: k.colors ? k.colors.map(c => c.name) : null })),
}));

// Colour + sets + single sizes + total. Used on the product page and (via /picker/:id) in quick-add.
function picker(s, p, icon) {
  const packs = packsOf(p);
  const single = p.sell_single || !packs.length;
  const needsColour = single || packs.some(k => !k.colors);
  const steps = (attr, label) => `<div class="stepper"><button type="button" data-step="-1" aria-label="Less ${label}">−</button><input type="number" min="0" max="999" value="0" ${attr} aria-label="Quantity ${label}"><button type="button" data-step="1" aria-label="More ${label}">+</button></div>`;
  return `<div class="picker" data-product="${cardData(p, icon)}">
    ${needsColour ? `<div class="opt"><div class="opt-head"><span>Colour: <b data-color-name>${esc(p.colors[0]?.name || '')}</b></span></div>
      <div class="swatches">${p.colors.map((c, i) => `<button type="button" class="sw ${i === 0 ? 'on' : ''}" data-color="${i}" style="--c:${esc(c.hex)}" aria-label="${esc(c.name)}" title="${esc(c.name)}"></button>`).join('')}</div></div>` : ''}
    ${packs.length ? `<div class="opt"><div class="opt-head"><span>Buy in sets</span><a href="/size-guide" class="link small">Size guide</a></div>
      <div class="sets">${packs.map(k => `<div class="set-card" data-pack="${esc(k.id)}">
        <div class="set-info"><b>${esc(k.name)}</b><span>${esc(k.sizesLabel)}${k.colors ? ` × ${k.colors.length} colour${k.colors.length > 1 ? 's' : ''}` : ''} = <b>${k.pieces} pcs</b></span>
          ${k.colors ? `<span class="set-dots">${k.colors.slice(0, 14).map(c => `<i style="background:${esc(c.hex)}" title="${esc(c.name)}"></i>`).join('')}${k.colors.length > 14 ? `<em>+${k.colors.length - 14}</em>` : ''}</span>` : '<small>In your selected colour</small>'}</div>
        <div class="set-buy"><strong>${inr(k.setPrice)}<small>/set</small></strong><small class="muted">${inr(k.unit)}/pc</small>${steps(`data-set="${esc(k.id)}"`, esc(k.name))}</div>
      </div>`).join('')}</div></div>` : ''}
    ${single ? `<div class="opt"><div class="opt-head"><span>${packs.length ? 'Or single sizes' : 'Size &amp; quantity'}</span>${packs.length ? '' : '<a href="/size-guide" class="link small">Size guide</a>'}</div>
      <div class="size-qty">${p.sizes.map(z => `<label class="sq"><span>${esc(z)}</span>${steps(`data-size="${esc(z)}"`, esc(z))}</label>`).join('')}</div>
      ${packs.length ? '' : '<button type="button" class="link small" data-set-pack>+ Add 1 of every size (size set)</button>'}</div>` : ''}
    <div class="pdp-total"><span data-pdp-count>0 pieces</span><strong data-pdp-total>₹0</strong></div>
    <button class="btn btn-lg btn-block" data-add-pdp ${p.stock <= 0 ? 'disabled' : ''}>${p.stock <= 0 ? 'Sold out' : 'Add to bag'}</button>
  </div>`;
}

function productCard(p, icon) {
  const tag = p.is_new ? 'New' : p.bestseller ? 'Bestseller' : '';
  return `<article class="card">
    <div class="card-media">
      <a href="/p/${esc(p.slug)}" class="card-link" tabindex="-1" aria-hidden="true">${productImg(p, icon, 0)}</a>
      ${tag ? `<span class="tag">${tag}</span>` : ''}
      ${p.stock <= 0 ? '<span class="tag tag-out">Sold out</span>' : ''}
      <button class="quick-add" data-quick="${cardData(p, icon)}" aria-label="Quick add ${esc(p.name)}" ${p.stock <= 0 ? 'disabled' : ''}>+</button>
    </div>
    <div class="card-body">
      <a href="/p/${esc(p.slug)}" class="card-title">${esc(p.name)}</a>
      <div class="card-meta">${(() => { const k = packsOf(p); return k.length ? `Sets from ${k.reduce((a, b) => Math.min(a, b.pieces), 1e9)} pcs · ${p.colors.length} colour${p.colors.length > 1 ? 's' : ''}` : `${esc(p.fit)} · ${p.colors.length} colour${p.colors.length > 1 ? 's' : ''}`; })()}</div>
      <div class="price"><strong>${inr(p.price)}</strong><span class="per">/pc</span>${p.mrp > p.price ? `<s>${inr(p.mrp)}</s><em>${pct(p)}% off MRP</em>` : ''}</div>
      <div class="dots">${p.colors.slice(0, 5).map(c => `<i style="background:${esc(c.hex)}" title="${esc(c.name)}"></i>`).join('')}</div>
    </div>
  </article>`;
}

const grid = (list, iconOf) => `<div class="grid">${list.map(p => productCard(p, iconOf(p))).join('')}</div>`;

function section(title, href, list, iconOf, kicker = '') {
  if (!list.length) return '';
  return `<section class="wrap sec">
    <div class="sec-head"><div>${kicker ? `<p class="eyebrow">${esc(kicker)}</p>` : ''}<h2 class="display">${esc(title)}</h2></div>${href ? `<a href="${href}" class="link-arrow">View all ${ICON.arrow}</a>` : ''}</div>
    ${grid(list, iconOf)}
  </section>`;
}

function catRail(cats, active = '') {
  return `<div class="cat-rail" role="list">
    <a href="/shop" class="cat-chip ${active === 'all' ? 'on' : ''}" role="listitem"><span class="cat-ic">${ICON.grid}</span><span>All</span></a>
    ${cats.map(c => `<a href="/c/${esc(c.slug)}" class="cat-chip ${active === c.slug ? 'on' : ''}" role="listitem"><span class="cat-ic">${garmentIcon(c.icon, 34)}</span><span>${esc(c.name)}</span></a>`).join('')}
  </div>`;
}

function home(s, { cats, featured, fresh, best, iconOf }) {
  const [l1, l2] = String(s.hero_title).split('\n');
  const showcase = featured.slice(0, 3);
  return `
  <section class="hero">
    <div class="wrap hero-in">
      <div class="hero-copy">
        <p class="eyebrow">${esc(s.hero_kicker)}</p>
        <h1 class="display xl">${esc(l1)}${l2 ? `<br><span class="hl">${esc(l2)}</span>` : ''}</h1>
        <p class="lead">${esc(s.hero_sub)}</p>
        <div class="hero-cta"><a href="/shop" class="btn btn-lg">Shop wholesale ${ICON.arrow}</a><a href="${waLink(s, 'Hi, I want to know about wholesale orders.')}" class="btn btn-lg btn-ghost" target="_blank" rel="noopener">${ICON.wa} Order on WhatsApp</a></div>
        <dl class="hero-stats">
          <div><dt>${esc(s.pincodes_delivered)}+</dt><dd>Pin codes delivered</dd></div>
          <div><dt>${esc(s.moq)} pcs</dt><dd>Minimum order</dd></div>
          <div><dt>${esc(s.instagram_followers)}</dt><dd>Instagram family</dd></div>
        </dl>
      </div>
      <div class="hero-visual">
        ${s.hero_image ? `<img src="${esc(s.hero_image)}" alt="${esc(s.brand_name)} collection" class="hero-img">` : `
        <div class="stack-cards">
          ${showcase.map((p, i) => `<a href="/p/${esc(p.slug)}" class="sc sc-${i}">${productImg(p, iconOf(p), 0)}<span>${esc(p.name)}<b>${inr(p.price)}/pc</b></span></a>`).join('')}
        </div>`}
      </div>
    </div>
  </section>

  <section class="wrap cats-sec" aria-label="Shop by category">
    <div class="sec-head"><h2 class="display sm">Shop by category</h2></div>
    ${catRail(cats)}
  </section>

  <section class="wrap trust">
    <div class="trust-item">${ICON.pin}<div><b>${esc(s.pincodes_delivered)}+ pin codes</b><span>Delivered across India</span></div></div>
    <div class="trust-item">${ICON.cash}<div><b>COD available</b><span>Just ${esc(s.cod_advance_pct)}% advance</span></div></div>
    <div class="trust-item">${ICON.truck}<div><b>Pan-India shipping</b><span>Tracked to your door</span></div></div>
    <div class="trust-item">${ICON.factory}<div><b>Manufacturer direct</b><span>No middlemen pricing</span></div></div>
  </section>

  ${section('New arrivals', '/shop?sort=new', fresh, iconOf, 'Just dropped')}

  <section class="wrap moq-band">
    <div class="moq-copy"><p class="eyebrow">How wholesale works</p><h2 class="display">Mix &amp; match.<br>Minimum just ${esc(s.moq)} pieces.</h2></div>
    <ol class="steps">
      <li><b>01</b><h3>Pick any styles</h3><p>Mix designs, colours and sizes — S to XXL, 28 to 36.</p></li>
      <li><b>02</b><h3>Reach ${esc(s.moq)} pieces</h3><p>Your bag tracks the MOQ for you. Any combination counts.</p></li>
      <li><b>03</b><h3>Pay your way</h3><p>Prepaid, or COD with only ${esc(s.cod_advance_pct)}% advance online.</p></li>
    </ol>
  </section>

  ${section('Bestsellers', '/shop?sort=popular', best, iconOf, 'Resellers love these')}
  ${section('Featured', '/shop', featured, iconOf, 'Hand-picked')}

  <section class="wrap pin-check-band">
    <div><h2 class="display sm">Do we deliver to you?</h2><p class="muted">We've shipped to ${esc(s.pincodes_delivered)} of ${esc(s.pincodes_total)} pin codes in India.</p></div>
    <form class="pin-check" data-pincheck><input inputmode="numeric" maxlength="6" placeholder="Enter pin code" aria-label="Pin code" required pattern="[1-9][0-9]{5}"><button class="btn">Check</button><p class="pin-result small" aria-live="polite"></p></form>
  </section>`;
}

function listing(s, { title, desc, cats, active, products, iconOf, q = {}, allSizes, allColors, allFabrics, basePath }) {
  const qs = (k, v) => { const u = new URLSearchParams(q); if (v === null || u.get(k) === v) u.delete(k); else u.set(k, v); return basePath + (u.toString() ? '?' + u : ''); };
  const chip = (k, v, label) => `<a href="${esc(qs(k, v))}" class="fchip ${q[k] === v ? 'on' : ''}">${label}</a>`;
  return `
  <section class="wrap page-head">
    <nav class="crumbs"><a href="/">Home</a> / ${esc(title)}</nav>
    <h1 class="display">${esc(title)}</h1>
    ${desc ? `<p class="muted">${esc(desc)}</p>` : ''}
  </section>
  <section class="wrap">${catRail(cats, active)}</section>
  <section class="wrap filters">
    <details class="fgroup" ${q.size || q.color || q.fabric ? 'open' : ''}><summary>Filters ${q.size || q.color || q.fabric || q.max ? '<i class="fdot"></i>' : ''}</summary>
      <div class="frow"><span>Size</span>${allSizes.map(z => chip('size', z, esc(z))).join('')}</div>
      <div class="frow"><span>Colour</span>${allColors.map(c => `<a href="${esc(qs('color', c.name))}" class="fchip ${q.color === c.name ? 'on' : ''}"><i style="background:${esc(c.hex)}"></i>${esc(c.name)}</a>`).join('')}</div>
      <div class="frow"><span>Fabric</span>${allFabrics.map(f => chip('fabric', f, esc(f))).join('')}</div>
      <div class="frow"><span>Price</span>${chip('max', '250', 'Under ₹250')}${chip('max', '400', 'Under ₹400')}${chip('max', '600', 'Under ₹600')}</div>
      ${q.size || q.color || q.fabric || q.max ? `<a class="link small" href="${esc(basePath + (q.q ? '?q=' + encodeURIComponent(q.q) : ''))}">Clear all</a>` : ''}
    </details>
    <form class="sort" method="get" action="${esc(basePath)}">
      ${Object.entries(q).filter(([k]) => k !== 'sort').map(([k, v]) => `<input type="hidden" name="${esc(k)}" value="${esc(v)}">`).join('')}
      <label><span class="sr">Sort</span><select name="sort" onchange="this.form.submit()">
        ${[['', 'Recommended'], ['new', 'Newest'], ['popular', 'Bestsellers'], ['low', 'Price: low to high'], ['high', 'Price: high to low']].map(([v, l]) => `<option value="${v}" ${(q.sort || '') === v ? 'selected' : ''}>${l}</option>`).join('')}
      </select></label>
    </form>
  </section>
  <section class="wrap sec">
    <p class="muted small count">${products.length} style${products.length === 1 ? '' : 's'}</p>
    ${products.length ? grid(products, iconOf) : `<div class="empty"><h3>No styles match</h3><p class="muted">Try removing a filter.</p><a class="btn" href="/shop">Shop all</a></div>`}
  </section>`;
}

function product(s, { p, cat, related, iconOf }) {
  const icon = cat.icon;
  const n = Math.max(p.images.length, Math.min(p.colors.length, 4), 1);
  const gallery = Array.from({ length: n }, (_, i) => productImg(p, icon, i, 'g-img'));
  return `
  <section class="wrap pdp">
    <nav class="crumbs"><a href="/">Home</a> / <a href="/c/${esc(cat.slug)}">${esc(cat.name)}</a> / ${esc(p.name)}</nav>
    <div class="pdp-grid">
      <div class="gallery" data-gallery>${gallery.map((g, i) => `<div class="g-slide" data-i="${i}">${g}</div>`).join('')}</div>
      <div class="pdp-info">
        ${p.is_new ? '<span class="tag static">New drop</span>' : ''}${p.bestseller ? '<span class="tag static">Bestseller</span>' : ''}
        <h1 class="pdp-title">${esc(p.name)}</h1>
        <div class="price lg"><strong>${inr(p.price)}</strong><span class="per">/piece</span>${p.mrp > p.price ? `<s>MRP ${inr(p.mrp)}</s><em>${pct(p)}% margin room</em>` : ''}</div>
        <p class="tiny muted">Wholesale price, inclusive of GST. MOQ ${esc(s.moq)} pieces — mix with any other style.</p>
        ${picker(s, p, icon)}
        <div class="pdp-cta">
          <a class="btn btn-lg btn-ghost btn-block" href="${waLink(s, `Hi, I'm interested in ${p.name} (${process.env.SITE_URL || ''}/p/${p.slug})`)}" target="_blank" rel="noopener">${ICON.wa} Ask on WhatsApp</a>
        </div>

        <form class="pin-check inline" data-pincheck><input inputmode="numeric" maxlength="6" placeholder="Check delivery — enter pin code" aria-label="Pin code" required pattern="[1-9][0-9]{5}"><button class="btn btn-ghost">Check</button><p class="pin-result small" aria-live="polite"></p></form>

        <div class="acc">
          <details open><summary>Product details</summary><p>${esc(p.description)}</p><ul class="specs"><li><span>Fabric</span>${esc(p.fabric)}</li><li><span>Fit</span>${esc(p.fit)}</li><li><span>Sizes</span>${esc(p.sizes.join(', '))}</li><li><span>Category</span>${esc(cat.name)}</li></ul></details>
          <details><summary>Shipping &amp; COD</summary><p>Dispatched in 24–48 hours. Delivered in 3–8 working days across India. Pay fully online, or choose COD by paying ${esc(s.cod_advance_pct)}% advance — the balance is paid to the courier on delivery. <a href="/shipping-policy">Shipping policy</a></p></details>
          <details><summary>Returns &amp; exchanges</summary><p>Manufacturing defects and wrong items are replaced within ${esc(s.return_days)} days of delivery with an unboxing video. <a href="/refund-policy">Return policy</a></p></details>
        </div>
      </div>
    </div>
  </section>
  ${section('You may also like', `/c/${cat.slug}`, related, iconOf)}`;
}

function cartPage(s) {
  return `<section class="wrap page-head"><h1 class="display">Your bag</h1></section>
  <section class="wrap cart-page">
    <div><div class="moq-meter big"><div class="moq-text"></div><div class="bar"><i></i></div></div><div id="cart-page-lines"></div></div>
    <aside class="summary"><h3>Summary</h3><div class="row-between"><span>Pieces</span><b id="cp-pcs">0</b></div><div class="row-between"><span>Subtotal (incl. GST)</span><b id="cp-sub">₹0</b></div><a href="/checkout" class="btn btn-lg btn-block" id="cp-checkout">Checkout</a><a href="/shop" class="btn btn-ghost btn-block">Continue shopping</a></aside>
  </section>`;
}

function checkout(s, { user, addresses, rpKey, demo }) {
  return `<section class="wrap page-head"><nav class="crumbs"><a href="/cart">Bag</a> / Checkout</nav><h1 class="display">Checkout</h1></section>
  <section class="wrap checkout" id="checkout" data-rpkey="${esc(rpKey)}" data-demo="${demo ? 1 : 0}" data-advance="${esc(s.cod_advance_pct)}">
    <div class="co-steps">
      <div class="co-block ${user ? 'done' : ''}" id="co-login">
        <h2><b>1</b> Login</h2>
        ${user ? `<p>Logged in as <b>+91 ${esc(user.phone)}</b> · <a href="/logout?next=/checkout">Change</a></p>` : `<p class="muted">Browse freely — we only need your mobile number to place the order.</p><button class="btn" data-open="login">Login with OTP</button>`}
      </div>
      <form class="co-block ${user ? '' : 'locked'}" id="co-form" novalidate>
        <h2><b>2</b> Delivery address</h2>
        ${addresses.length ? `<div class="addr-list">${addresses.map((a, i) => `<label class="addr"><input type="radio" name="address_id" value="${a.id}" ${i === 0 ? 'checked' : ''}><span><b>${esc(a.name)}</b>${a.business ? ` · ${esc(a.business)}` : ''}<br>${esc(a.line1)}${a.line2 ? ', ' + esc(a.line2) : ''}, ${esc(a.city)}, ${esc(a.state)} – ${esc(a.pincode)}<br>${esc(a.phone)}</span></label>`).join('')}<label class="addr"><input type="radio" name="address_id" value="new"><span><b>+ Add a new address</b></span></label></div>` : '<input type="hidden" name="address_id" value="new">'}
        <div class="addr-new" ${addresses.length ? 'hidden' : ''}>
          <div class="fgrid">
            <label class="field"><span>Full name *</span><input name="name" autocomplete="name" value="${esc(user?.name || '')}"></label>
            <label class="field"><span>Mobile *</span><input name="phone" inputmode="numeric" maxlength="10" value="${esc(user?.phone || '')}"></label>
            <label class="field full"><span>Shop / business name</span><input name="business" value="${esc(user?.business_name || '')}"></label>
            <label class="field full"><span>Address line 1 *</span><input name="line1" autocomplete="address-line1" placeholder="Shop no., building, street"></label>
            <label class="field full"><span>Address line 2</span><input name="line2" autocomplete="address-line2" placeholder="Area, landmark"></label>
            <label class="field"><span>Pin code *</span><input name="pincode" inputmode="numeric" maxlength="6" autocomplete="postal-code" data-pin-autofill></label>
            <label class="field"><span>City *</span><input name="city" autocomplete="address-level2"></label>
            <label class="field full"><span>State *</span><select name="state"><option value="">Select state</option>${INDIAN_STATES.map(st => `<option>${esc(st)}</option>`).join('')}</select></label>
          </div>
        </div>
        <label class="field"><span>GSTIN (optional — for GST input credit)</span><input name="gstin" maxlength="15" value="${esc(user?.gstin || '')}" placeholder="27ABCDE1234F1Z5" style="text-transform:uppercase"></label>

        <h2><b>3</b> Payment</h2>
        <div class="pay-opts">
          <label class="pay"><input type="radio" name="method" value="prepaid" checked><span><b>Prepaid</b><small>Pay 100% now via UPI, card or net banking</small><em id="pay-pre">₹0</em></span></label>
          <label class="pay"><input type="radio" name="method" value="cod"><span><b>Cash on Delivery</b><small>Pay ${esc(s.cod_advance_pct)}% advance now, rest on delivery</small><em id="pay-cod">₹0</em></span></label>
        </div>
        <label class="check"><input type="checkbox" name="agree" required checked><span>I agree to the <a class="link" href="/terms" target="_blank">Terms</a>, <a class="link" href="/refund-policy" target="_blank">Return</a> &amp; <a class="link" href="/cancellation-policy" target="_blank">Cancellation</a> policies.</span></label>
        <p class="form-err" role="alert" hidden></p>
        <button class="btn btn-lg btn-block" id="place-btn">Place order</button>
        ${demo ? '<p class="tiny warn">Test mode: Razorpay keys not set — payments are simulated. Add keys before going live.</p>' : '<p class="tiny muted center">🔒 Payments secured by Razorpay</p>'}
      </form>
    </div>
    <aside class="summary" id="co-summary"><h3>Order summary</h3><div id="co-lines"></div><div class="sum-rows"></div></aside>
  </section>
  ${rpKey ? '<script src="https://checkout.razorpay.com/v1/checkout.js" defer></script>' : ''}`;
}

const STATUS = {
  pending_payment: 'Awaiting payment', placed: 'Order placed', confirmed: 'Confirmed', packed: 'Packed',
  shipped: 'Shipped', out_for_delivery: 'Out for delivery', delivered: 'Delivered', cancelled: 'Cancelled', returned: 'Returned',
};
const FLOW = ['placed', 'confirmed', 'packed', 'shipped', 'delivered'];

function orderBlock(s, o, { justPlaced = false, iconOf }) {
  const idx = FLOW.indexOf(o.status);
  return `
  ${justPlaced ? `<div class="success-hero"><div class="tick">✓</div><h1 class="display">Order placed!</h1><p>Thank you. Order <b>#${esc(o.number)}</b> is confirmed. We'll WhatsApp/SMS you as it moves.</p></div>` : `<nav class="crumbs"><a href="/account">Account</a> / Order #${esc(o.number)}</nav><h1 class="display sm">Order #${esc(o.number)}</h1>`}
  <div class="order-grid">
    <div>
      ${o.status === 'cancelled' ? '<p class="pill red">Cancelled</p>' : o.status === 'pending_payment' ? '<p class="pill amber">Awaiting payment</p>' : `
      <ol class="track">${FLOW.map((st, i) => `<li class="${i <= idx ? 'on' : ''}"><i></i><span>${STATUS[st]}</span></li>`).join('')}</ol>`}
      ${o.tracking ? `<p class="small">Courier: <b>${esc(o.courier || '')}</b> · AWB <b>${esc(o.tracking)}</b></p>` : ''}
      <div class="lines">${o.items.map(it => `<div class="line"><div class="line-img">${it.img ? `<img src="${esc(it.img)}" alt="">` : `<div class="ph" style="--bg:${esc(it.colorHex)}">${garmentArt(it.icon, it.colorHex)}</div>`}</div><div class="line-info"><b>${esc(it.name)}</b><span>${it.sets ? `${esc(it.packName)} · ${esc(it.size.replace(/^Set: /, ''))} · ${esc(it.color)}<br>${it.sets} set${it.sets > 1 ? 's' : ''} × ${it.setPieces} pcs = ${it.qty} pcs` : `${esc(it.color)} · ${esc(it.size)} · ${it.qty} pc`}</span></div><b>${inr(it.price * it.qty)}</b></div>`).join('')}</div>
    </div>
    <aside class="summary">
      <h3>Payment</h3>
      <div class="row-between"><span>${o.pieces} pieces</span><span>${inr(o.subtotal)}</span></div>
      <div class="row-between"><span>Shipping</span><span>${o.shipping ? inr(o.shipping) : 'Free'}</span></div>
      <div class="row-between total"><span>Total</span><b>${inr(o.total)}</b></div>
      <div class="row-between"><span>${o.payment_method === 'cod' ? `Advance paid (${esc(s.cod_advance_pct)}%)` : 'Paid online'}</span><span>${['paid', 'advance_paid'].includes(o.payment_status) ? inr(o.pay_now) : '—'}</span></div>
      ${o.payment_method === 'cod' ? `<div class="row-between"><span>Pay on delivery</span><b>${o.payment_status === 'paid' ? '₹0' : inr(o.balance_due)}</b></div>` : ''}
      <p class="tiny muted">Includes GST ${inr(o.tax.tax)}</p>
      <h3>Deliver to</h3><p class="small">${esc(o.address.name)}${o.address.business ? ', ' + esc(o.address.business) : ''}<br>${esc(o.address.line1)}${o.address.line2 ? ', ' + esc(o.address.line2) : ''}<br>${esc(o.address.city)}, ${esc(o.address.state)} – ${esc(o.address.pincode)}<br>${esc(o.address.phone)}</p>
      ${o.status !== 'pending_payment' ? `<a class="btn btn-block" href="/invoice/${esc(o.number)}" target="_blank">Download GST invoice</a>` : ''}
      <a class="btn btn-ghost btn-block" href="${waLink(s, `Hi, I need help with order #${o.number}`)}" target="_blank" rel="noopener">${ICON.wa} Help with this order</a>
    </aside>
  </div>`;
}

function account(s, { user, orders, addresses }) {
  return `<section class="wrap page-head"><p class="eyebrow">My account</p><h1 class="display">Hi${user.name ? ', ' + esc(user.name.split(' ')[0]) : ''}.</h1><p class="muted">+91 ${esc(user.phone)} · <a href="/logout">Log out</a></p></section>
  <section class="wrap acct">
    <div>
      <h2 class="display sm">Orders</h2>
      ${orders.length ? `<div class="order-list">${orders.map(o => `<a href="/order/${esc(o.number)}" class="order-row"><div><b>#${esc(o.number)}</b><span>${esc(new Date(o.created_at + 'Z').toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }))} · ${o.pieces} pcs · ${o.payment_method === 'cod' ? 'COD' : 'Prepaid'}</span></div><div class="r"><b>${inr(o.total)}</b><span class="pill">${STATUS[o.status] || esc(o.status)}</span></div></a>`).join('')}</div>` : `<div class="empty"><p class="muted">No orders yet.</p><a class="btn" href="/shop">Start shopping</a></div>`}
    </div>
    <aside>
      <h2 class="display sm">Profile</h2>
      <form class="stack" id="profile-form">
        <label class="field"><span>Name</span><input name="name" value="${esc(user.name || '')}"></label>
        <label class="field"><span>Business name</span><input name="business_name" value="${esc(user.business_name || '')}"></label>
        <label class="field"><span>GSTIN</span><input name="gstin" value="${esc(user.gstin || '')}" maxlength="15"></label>
        <label class="field"><span>Email</span><input name="email" type="email" value="${esc(user.email || '')}"></label>
        <button class="btn">Save</button>
      </form>
      <h2 class="display sm" style="margin-top:2rem">Saved addresses</h2>
      ${addresses.length ? addresses.map(a => `<div class="addr static"><span><b>${esc(a.name)}</b><br>${esc(a.line1)}, ${esc(a.city)}, ${esc(a.state)} – ${esc(a.pincode)}</span><button class="link small" data-del-addr="${a.id}">Remove</button></div>`).join('') : '<p class="muted small">Addresses you use at checkout are saved here.</p>'}
    </aside>
  </section>`;
}

function loginPage(s, next) {
  return `<section class="wrap narrow center page-head"><h1 class="display">Log in</h1><p class="muted">Use your mobile number — no password needed.</p><button class="btn btn-lg" data-open="login" data-next="${esc(next)}" id="auto-login">Login with OTP</button></section>`;
}

function track(s, { order, error }) {
  return `<section class="wrap narrow page-head"><h1 class="display">Track your order</h1>
    <form class="stack" method="get" action="/track"><label class="field"><span>Order number</span><input name="order" required placeholder="SB2610191234"></label><label class="field"><span>Mobile number used for the order</span><input name="phone" inputmode="numeric" maxlength="10" required></label><button class="btn">Track</button></form>
    ${error ? `<p class="form-err">${esc(error)}</p>` : ''}
    ${order ? `<div class="track-result"><h3>#${esc(order.number)} — ${STATUS[order.status] || esc(order.status)}</h3><ol class="track">${FLOW.map((st, i) => `<li class="${i <= FLOW.indexOf(order.status) ? 'on' : ''}"><i></i><span>${STATUS[st]}</span></li>`).join('')}</ol>${order.tracking ? `<p>Courier ${esc(order.courier || '')} · AWB <b>${esc(order.tracking)}</b></p>` : ''}</div>` : ''}
  </section>`;
}

function invoice(s, o) {
  const t = o.tax;
  const n2 = n => Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>Invoice ${esc(o.number)}</title>
  <style>body{font:13px/1.5 Inter,system-ui,sans-serif;color:#111;margin:0;background:#f4f4f4}.inv{max-width:820px;margin:24px auto;background:#fff;padding:40px}h1{font:28px Anton,Impact,sans-serif;letter-spacing:.02em;margin:0}table{width:100%;border-collapse:collapse;margin:20px 0}th,td{padding:8px;border-bottom:1px solid #e5e5e5;text-align:left}th{background:#111;color:#fff;font-weight:600;font-size:11px;text-transform:uppercase;letter-spacing:.05em}td.r,th.r{text-align:right}.top{display:flex;justify-content:space-between;gap:24px;flex-wrap:wrap}.box{border:1px solid #e5e5e5;padding:12px;flex:1;min-width:220px}.muted{color:#666}.tot td{border:0;padding:4px 8px}.grand td{font-size:16px;font-weight:800;border-top:2px solid #111}.bar{text-align:center;margin:16px}button{background:#111;color:#fff;border:0;padding:12px 24px;font-weight:700;cursor:pointer}@media print{.bar{display:none}body{background:#fff}.inv{margin:0;padding:0}}</style></head><body>
  <div class="bar"><button onclick="print()">Print / Save as PDF</button></div>
  <div class="inv">
    <div class="top"><div><h1>${esc(s.brand_name).toUpperCase()}</h1><div class="muted">${esc(s.legal_name)}<br>${esc(s.address)}, ${esc(s.city)}, ${esc(s.state)} ${esc(s.pincode)}<br>${s.gstin ? 'GSTIN: ' + esc(s.gstin) + '<br>' : ''}${esc(s.phone)} · ${esc(s.email)}</div></div>
    <div style="text-align:right"><b style="font-size:16px">TAX INVOICE</b><br>Invoice no: <b>${esc(o.number)}</b><br>Date: ${esc(new Date((o.paid_at || o.created_at) + 'Z').toLocaleDateString('en-IN'))}<br>Place of supply: ${esc(o.address.state)}</div></div>
    <div class="top" style="margin-top:20px"><div class="box"><b>Bill / Ship to</b><br>${esc(o.address.name)}${o.address.business ? '<br>' + esc(o.address.business) : ''}<br>${esc(o.address.line1)}${o.address.line2 ? ', ' + esc(o.address.line2) : ''}<br>${esc(o.address.city)}, ${esc(o.address.state)} – ${esc(o.address.pincode)}<br>Ph: ${esc(o.address.phone)}${o.gstin ? '<br>GSTIN: ' + esc(o.gstin) : ''}</div>
    <div class="box"><b>Payment</b><br>${o.payment_method === 'cod' ? `Cash on Delivery<br>Advance paid: ₹${n2(o.pay_now)}<br>Balance on delivery: ₹${n2(o.payment_status === 'paid' ? 0 : o.balance_due)}` : `Prepaid — ₹${n2(o.pay_now)}`}${o.rp_payment_id ? '<br>Ref: ' + esc(o.rp_payment_id) : ''}</div></div>
    <table><thead><tr><th>#</th><th>Item</th><th>HSN</th><th class="r">Qty</th><th class="r">Rate</th><th class="r">Taxable</th><th class="r">GST</th><th class="r">Amount</th></tr></thead><tbody>
    ${t.rows.map((r, i) => `<tr><td>${i + 1}</td><td>${esc(r.name)}<br><span class="muted">${r.sets ? `${esc(r.packName)} — ${r.sets} set${r.sets > 1 ? 's' : ''} × ${r.setPieces} pcs<br>${esc(r.breakdown || '')}` : `${esc(r.color)} / ${esc(r.size)}`}</span></td><td>${esc(r.hsn || '6109')}</td><td class="r">${r.qty}</td><td class="r">${n2(r.price)}</td><td class="r">${n2(r.taxable)}</td><td class="r">${r.rate}%</td><td class="r">${n2(r.price * r.qty)}</td></tr>`).join('')}
    </tbody></table>
    <table class="tot" style="width:320px;margin-left:auto">
      <tr><td>Taxable value</td><td class="r">₹${n2(t.taxable)}</td></tr>
      ${t.intra ? `<tr><td>CGST</td><td class="r">₹${n2(t.cgst)}</td></tr><tr><td>SGST</td><td class="r">₹${n2(t.sgst)}</td></tr>` : `<tr><td>IGST</td><td class="r">₹${n2(t.igst)}</td></tr>`}
      <tr><td>Shipping</td><td class="r">₹${n2(o.shipping)}</td></tr>
      <tr class="grand"><td>Total</td><td class="r">₹${n2(o.total)}</td></tr>
    </table>
    <p class="muted">This is a computer-generated invoice. Goods once sold are subject to our return policy. Subject to ${esc(s.city)} jurisdiction.</p>
  </div></body></html>`;
}

module.exports = { picker, home, listing, product, cartPage, checkout, orderBlock, account, loginPage, track, invoice, STATUS };
