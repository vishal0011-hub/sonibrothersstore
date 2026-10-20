const { esc, inr, garmentIcon } = require('../lib');
const { STATUS } = require('./store');
const { getSettings } = require('../db');
const { logoText } = require('./layout');

const shell = (title, active, body) => `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>${esc(title)} · Admin</title>
<link href="https://fonts.googleapis.com/css2?family=Anton&family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet"><link rel="stylesheet" href="/static/styles.css?v=2"><link rel="stylesheet" href="/static/admin.css?v=2"></head>
<body class="admin"><aside class="aside"><a href="/admin" class="logo inv">${logoText(getSettings(), 'ADMIN')}</a>
<nav>${[['/admin', 'Dashboard'], ['/admin/orders', 'Orders'], ['/admin/products', 'Products'], ['/admin/categories', 'Categories'], ['/admin/customers', 'Customers'], ['/admin/messages', 'Messages'], ['/admin/settings', 'Settings']].map(([h, l]) => `<a href="${h}" class="${active === l ? 'on' : ''}">${l}</a>`).join('')}
<a href="/" target="_blank">View store ↗</a><a href="/admin/logout">Log out</a></nav></aside>
<main class="amain"><h1 class="display sm">${esc(title)}</h1>${body}</main>
<div class="toast" role="status" hidden></div><script src="/static/admin.js?v=2" defer></script></body></html>`;

const login = (err) => `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex"><title>Admin login</title><link href="https://fonts.googleapis.com/css2?family=Anton&family=Inter:wght@400;600;800&display=swap" rel="stylesheet"><link rel="stylesheet" href="/static/styles.css?v=2"></head>
<body><section class="wrap narrow page-head center" style="max-width:380px"><a class="logo">${logoText(getSettings())}</a><h1 class="display sm" style="margin-top:2rem">Admin</h1>
<form method="post" action="/admin/login" class="stack"><label class="field"><span>Password</span><input type="password" name="password" required autofocus></label><button class="btn btn-block">Log in</button>${err ? `<p class="form-err">${esc(err)}</p>` : ''}</form></section></body></html>`;

const date = d => new Date(d + 'Z').toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
const payPill = o => ({ paid: '<span class="pill green">Paid</span>', advance_paid: '<span class="pill amber">Advance paid</span>', pending: '<span class="pill">Unpaid</span>', failed: '<span class="pill red">Failed</span>', refunded: '<span class="pill">Refunded</span>' }[o.payment_status] || esc(o.payment_status));

function dashboard(st, recent, warnings) {
  return shell('Dashboard', 'Dashboard', `
  ${warnings.length ? `<div class="warnbox"><b>Before going live:</b><ul>${warnings.map(w => `<li>${w}</li>`).join('')}</ul></div>` : ''}
  <div class="kpis">
    <div><span>Today's orders</span><b>${st.today}</b></div>
    <div><span>Revenue (paid, 30 days)</span><b>${inr(st.revenue30)}</b></div>
    <div><span>To dispatch</span><b>${st.toShip}</b></div>
    <div><span>COD balance pending</span><b>${inr(st.codPending)}</b></div>
    <div><span>Customers</span><b>${st.customers}</b></div>
    <div><span>Active products</span><b>${st.products}</b></div>
  </div>
  <h2 class="h2">Recent orders</h2>${orderTable(recent)}`);
}

const orderTable = list => list.length ? `<div class="tbl"><table><thead><tr><th>Order</th><th>Date</th><th>Customer</th><th>Pcs</th><th>Total</th><th>Method</th><th>Payment</th><th>Status</th></tr></thead><tbody>
${list.map(o => `<tr><td><a href="/admin/orders/${esc(o.number)}"><b>#${esc(o.number)}</b></a></td><td>${date(o.created_at)}</td><td>${esc(o.address.name)}<br><small>${esc(o.address.city)}</small></td><td>${o.pieces}</td><td>${inr(o.total)}</td><td>${o.payment_method === 'cod' ? 'COD' : 'Prepaid'}</td><td>${payPill(o)}</td><td>${STATUS[o.status] || esc(o.status)}</td></tr>`).join('')}
</tbody></table></div>` : '<p class="muted">No orders yet.</p>';

function orders(list, q) {
  return shell('Orders', 'Orders', `<form class="afilter" method="get">
    <input name="q" placeholder="Order no. / phone / name" value="${esc(q.q || '')}">
    <select name="status"><option value="">All statuses</option>${Object.entries(STATUS).map(([k, v]) => `<option value="${k}" ${q.status === k ? 'selected' : ''}>${v}</option>`).join('')}</select>
    <button class="btn">Filter</button><a class="btn btn-ghost" href="/admin/orders.csv">Export CSV</a></form>${orderTable(list)}`);
}

function orderDetail(o, user, s) {
  const wa = `https://wa.me/91${esc(o.address.phone)}?text=${encodeURIComponent(`Hi ${o.address.name}, your ${s.brand_name} order #${o.number} is now: ${STATUS[o.status]}.${o.tracking ? ` Courier: ${o.courier} AWB ${o.tracking}.` : ''} Track: ${process.env.SITE_URL || ''}/track`)}`;
  return shell(`Order #${o.number}`, 'Orders', `
  <div class="agrid">
    <section class="acard">
      <h2 class="h2">Items (${o.pieces} pcs)</h2>
      <div class="tbl"><table><thead><tr><th>Product</th><th>Colour</th><th>Size / set</th><th>Pieces</th><th>Rate/pc</th><th>Amount</th></tr></thead><tbody>
      ${o.items.map(i => `<tr><td>${esc(i.name)}${i.sets ? `<br><small><b>${esc(i.packName)}: ${i.sets} set${i.sets > 1 ? 's' : ''}</b> — pack ${esc(i.breakdown || '')}</small>` : ''}</td><td>${esc(i.color)}</td><td>${esc(i.size)}</td><td>${i.qty}</td><td>${inr(i.price)}</td><td>${inr(i.price * i.qty)}</td></tr>`).join('')}
      </tbody></table></div>
      <div class="sumline"><span>Subtotal</span><b>${inr(o.subtotal)}</b></div><div class="sumline"><span>Shipping</span><b>${inr(o.shipping)}</b></div><div class="sumline"><span>Total</span><b>${inr(o.total)}</b></div>
      <div class="sumline"><span>${o.payment_method === 'cod' ? 'COD advance' : 'Prepaid'}</span><b>${inr(o.pay_now)} ${payPill(o)}</b></div>
      ${o.payment_method === 'cod' ? `<div class="sumline"><span>Collect on delivery</span><b>${o.payment_status === 'paid' ? '₹0 (collected)' : inr(o.balance_due)}</b></div>` : ''}
      <p class="small muted">Razorpay order ${esc(o.rp_order_id || '—')} · payment ${esc(o.rp_payment_id || '—')}</p>
      <h2 class="h2">Timeline</h2><ul class="timeline">${o.history.map(h => `<li><b>${esc(STATUS[h.status] || h.status)}</b> · ${esc(new Date(h.at).toLocaleString('en-IN'))}${h.note ? ` — ${esc(h.note)}` : ''}</li>`).join('')}</ul>
    </section>
    <section class="acard">
      <h2 class="h2">Update</h2>
      <form class="stack" data-api="/admin/api/orders/${esc(o.number)}">
        <label class="field"><span>Status</span><select name="status">${Object.entries(STATUS).map(([k, v]) => `<option value="${k}" ${o.status === k ? 'selected' : ''}>${v}</option>`).join('')}</select></label>
        <label class="field"><span>Courier</span><input name="courier" value="${esc(o.courier || '')}" placeholder="Delhivery / DTDC / Shiprocket"></label>
        <label class="field"><span>AWB / tracking no.</span><input name="tracking" value="${esc(o.tracking || '')}"></label>
        <label class="field"><span>Note (optional)</span><input name="note"></label>
        ${o.payment_method === 'cod' && o.payment_status === 'advance_paid' ? '<label class="check"><input type="checkbox" name="cod_collected" value="1"> COD balance collected</label>' : ''}
        <button class="btn">Save</button>
      </form>
      <a class="btn btn-ghost btn-block" href="${wa}" target="_blank" rel="noopener">WhatsApp customer the update</a>
      <a class="btn btn-ghost btn-block" href="/invoice/${esc(o.number)}" target="_blank">GST invoice</a>
      <h2 class="h2">Customer</h2>
      <p>${esc(o.address.name)}${o.address.business ? `<br>${esc(o.address.business)}` : ''}<br>${esc(o.address.line1)}${o.address.line2 ? ', ' + esc(o.address.line2) : ''}<br>${esc(o.address.city)}, ${esc(o.address.state)} – ${esc(o.address.pincode)}<br>📞 <a href="tel:+91${esc(o.address.phone)}">${esc(o.address.phone)}</a>${o.gstin ? `<br>GSTIN ${esc(o.gstin)}` : ''}<br><small>Login: +91 ${esc(user?.phone || '')}</small></p>
    </section>
  </div>`);
}

function products(list, cats) {
  const cn = id => cats.find(c => c.id === id)?.name || '';
  return shell('Products', 'Products', `<div class="afilter"><a href="/admin/products/new" class="btn">+ Add product</a></div>
  <div class="tbl"><table><thead><tr><th></th><th>Name</th><th>Category</th><th>Price</th><th>Stock</th><th>Flags</th><th>Status</th></tr></thead><tbody>
  ${list.map(p => `<tr><td>${p.images[0] ? `<img src="${esc(p.images[0])}" class="thumb" alt="">` : `<span class="thumb sw" style="background:${esc(p.colors[0]?.hex || '#ddd')}"></span>`}</td><td><a href="/admin/products/${p.id}"><b>${esc(p.name)}</b></a></td><td>${esc(cn(p.category_id))}</td><td>${inr(p.price)}</td><td>${p.stock <= 0 ? '<span class="pill red">0</span>' : p.stock}</td><td>${[p.featured && 'Featured', p.is_new && 'New', p.bestseller && 'Best'].filter(Boolean).join(', ')}</td><td>${p.active ? '<span class="pill green">Live</span>' : '<span class="pill">Hidden</span>'}</td></tr>`).join('')}
  </tbody></table></div>`);
}

// One editable set row (also used as the template for "+ Add a set")
function packRow(k) {
  const sizes = Object.entries(k.sizes || {}).map(([z, n]) => (n > 1 ? `${z}:${n}` : z)).join(', ');
  const mode = k.colorMode || 'each';
  return `<div class="pack-row" data-pack-row data-id="${esc(k.id || '')}">
    <div class="pack-head"><b>Set</b><button type="button" data-rm-pack>Remove</button></div>
    <div class="fgrid">
      <label class="field"><span>Set name (shown to customer)</span><input data-k="name" value="${esc(k.name || '')}" placeholder="e.g. Size set, Full set, Colour box"></label>
      <label class="field"><span>Sizes in one set</span><input data-k="sizes" value="${esc(sizes)}" placeholder="M, L, XL  or  M:2, L:2, XL:1"></label>
      <label class="field"><span>Colours</span><select data-k="colorMode">
        <option value="each" ${mode === 'each' ? 'selected' : ''}>Customer picks one colour</option>
        <option value="all" ${mode === 'all' ? 'selected' : ''}>All colours in one set (assorted)</option>
        <option value="list" ${mode === 'list' ? 'selected' : ''}>Only selected colours (assorted)</option></select></label>
      <label class="field"><span>Price per piece in this set (optional)</span><input data-k="price" type="number" min="0" value="${esc(k.price || '')}" placeholder="Leave blank = product price"></label>
    </div>
    <div class="pack-colors" data-k="colors" data-selected="${esc((k.colors || []).join('|'))}" ${mode === 'list' ? '' : 'hidden'}></div>
    <div class="pack-sum"></div>
  </div>`;
}

function productForm(p, cats) {
  const isNew = !p;
  p = p || { name: '', slug: '', category_id: cats[0]?.id, price: '', mrp: '', colors: [], sizes: ['S', 'M', 'L', 'XL', 'XXL'], images: [], stock: 500, featured: 0, is_new: 1, bestseller: 0, active: 1, description: '', fabric: '', fit: 'Regular', packs: [], sell_single: 1 };
  const ALL = ['XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL', '26', '28', '30', '32', '34', '36', '38', 'Free'];
  return shell(isNew ? 'Add product' : 'Edit product', 'Products', `
  <form class="agrid" data-api="/admin/api/products${isNew ? '' : '/' + p.id}" data-redirect="/admin/products">
    <section class="acard stack">
      <label class="field"><span>Product name *</span><input name="name" required value="${esc(p.name)}"></label>
      <label class="field"><span>URL slug (auto if empty)</span><input name="slug" value="${esc(p.slug)}"></label>
      <label class="field"><span>Description</span><textarea name="description" rows="4">${esc(p.description)}</textarea></label>
      <div class="fgrid">
        <label class="field"><span>Wholesale price / pc (₹, incl. GST) *</span><input name="price" type="number" min="1" required value="${esc(p.price)}"></label>
        <label class="field"><span>MRP (₹)</span><input name="mrp" type="number" min="0" value="${esc(p.mrp)}"></label>
        <label class="field"><span>Fabric</span><input name="fabric" value="${esc(p.fabric)}" placeholder="240 GSM Cotton"></label>
        <label class="field"><span>Fit</span><input name="fit" value="${esc(p.fit)}" placeholder="Oversized"></label>
        <label class="field"><span>Category</span><select name="category_id">${cats.map(c => `<option value="${c.id}" ${c.id === p.category_id ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select></label>
        <label class="field"><span>Stock (pieces)</span><input name="stock" type="number" min="0" value="${esc(p.stock)}"></label>
      </div>
      <fieldset class="field"><span>Sizes</span><div class="checks">${ALL.map(z => `<label class="check"><input type="checkbox" name="sizes" value="${z}" ${p.sizes.includes(z) ? 'checked' : ''}>${z}</label>`).join('')}</div></fieldset>
      <label class="field"><span>Colours — one per line as <code>Name, #hex</code></span><textarea name="colors" rows="4" placeholder="Jet Black, #111111&#10;Off White, #F1EFEA">${esc(p.colors.map(c => `${c.name}, ${c.hex}`).join('\n'))}</textarea></label>

      <h2 class="h2">Sets / packs</h2>
      <p class="hint">Create any set you sell. Sizes: type <code>M, L, XL</code> for one of each, or <code>M:2, L:2, XL:1</code> for quantities. Price is worked out automatically (pieces × price per piece). Customers see each set with its price and choose how many sets they want.</p>
      <div class="packs" data-packs>${p.packs.map(packRow).join('')}</div>
      <button type="button" class="btn btn-ghost" data-add-pack>+ Add a set</button>
      <label class="check"><input type="checkbox" name="sell_single" value="1" ${p.sell_single !== 0 ? 'checked' : ''}> Also allow buying single sizes (not only sets)</label>
      <input type="hidden" name="packs" value="">
      <template id="pack-tpl">${packRow({})}</template>
    </section>
    <section class="acard stack">
      <h2 class="h2">Photos</h2>
      <p class="small muted">First photo is the main image. Order photos to match the colour order. Images are compressed automatically.</p>
      <div class="img-list" data-images>${p.images.map(src => `<div class="img-item"><img src="${esc(src)}" alt=""><button type="button" data-rm-img aria-label="Remove">×</button><input type="hidden" name="images" value="${esc(src)}"></div>`).join('')}</div>
      <label class="btn btn-ghost">Upload photos<input type="file" accept="image/*" multiple data-upload hidden></label>
      <h2 class="h2">Visibility</h2>
      <label class="check"><input type="checkbox" name="active" value="1" ${p.active ? 'checked' : ''}> Live on store</label>
      <label class="check"><input type="checkbox" name="featured" value="1" ${p.featured ? 'checked' : ''}> Featured on home</label>
      <label class="check"><input type="checkbox" name="is_new" value="1" ${p.is_new ? 'checked' : ''}> New arrival</label>
      <label class="check"><input type="checkbox" name="bestseller" value="1" ${p.bestseller ? 'checked' : ''}> Bestseller</label>
      <button class="btn btn-lg btn-block">${isNew ? 'Create product' : 'Save changes'}</button>
      ${isNew ? '' : `<a href="/p/${esc(p.slug)}" target="_blank" class="link small">View on store ↗</a>`}
    </section>
  </form>`);
}

function categories(cats) {
  const icons = ['tee', 'oversized', 'shirt', 'polo', 'hoodie', 'jacket', 'jeans', 'cargo', 'jogger', 'shorts'];
  const row = (c = {}) => `<form class="cat-row" data-api="/admin/api/categories${c.id ? '/' + c.id : ''}" data-reload>
    <span class="cat-ic">${garmentIcon(c.icon || 'tee', 28)}</span>
    <input name="name" value="${esc(c.name || '')}" placeholder="Category name" required>
    <select name="icon">${icons.map(i => `<option ${c.icon === i ? 'selected' : ''}>${i}</option>`).join('')}</select>
    <input name="sort" type="number" value="${esc(c.sort ?? 99)}" style="width:70px" title="Order">
    <label class="check"><input type="checkbox" name="active" value="1" ${c.active !== 0 ? 'checked' : ''}>Live</label>
    <button class="btn">${c.id ? 'Save' : 'Add'}</button></form>`;
  return shell('Categories', 'Categories', `<div class="acard stack">${cats.map(row).join('')}<h2 class="h2">New category</h2>${row()}</div>`);
}

function customers(list) {
  return shell('Customers', 'Customers', `<div class="tbl"><table><thead><tr><th>Mobile</th><th>Name</th><th>Business</th><th>GSTIN</th><th>Orders</th><th>Spent</th><th>Joined</th></tr></thead><tbody>
  ${list.map(u => `<tr><td><a href="https://wa.me/91${esc(u.phone)}" target="_blank">+91 ${esc(u.phone)}</a></td><td>${esc(u.name || '')}</td><td>${esc(u.business_name || '')}</td><td>${esc(u.gstin || '')}</td><td>${u.orders}</td><td>${inr(u.spent || 0)}</td><td>${date(u.created_at)}</td></tr>`).join('')}
  </tbody></table></div>`);
}

function messages(list) {
  return shell('Messages', 'Messages', list.length ? `<div class="tbl"><table><thead><tr><th>Date</th><th>Name</th><th>Mobile</th><th>Message</th></tr></thead><tbody>${list.map(m => `<tr><td>${date(m.created_at)}</td><td>${esc(m.name)}</td><td><a href="https://wa.me/91${esc(m.phone)}" target="_blank">${esc(m.phone)}</a></td><td>${esc(m.message)}</td></tr>`).join('')}</tbody></table></div>` : '<p class="muted">No messages yet.</p>');
}

function settings(s) {
  const F = (k, label, type = 'text', hint = '') => `<label class="field"><span>${label}</span>${type === 'textarea' ? `<textarea name="${k}" rows="3">${esc(s[k])}</textarea>` : `<input name="${k}" type="${type}" value="${esc(s[k])}">`}${hint ? `<small class="muted">${hint}</small>` : ''}</label>`;
  return shell('Settings', 'Settings', `<form class="agrid" data-api="/admin/api/settings">
  <section class="acard stack"><h2 class="h2">Business details (shown on invoices &amp; policy pages)</h2>
    ${F('brand_name', 'Brand name')}${F('legal_name', 'Registered business name (as on GST)')}${F('gstin', 'GSTIN')}
    ${F('address', 'Address')}<div class="fgrid">${F('city', 'City')}${F('state', 'State', 'text', 'Must match exactly for CGST/SGST')}${F('pincode', 'Pin code')}${F('phone', 'Phone')}</div>
    ${F('email', 'Support email', 'email')}${F('whatsapp', 'WhatsApp number', 'text', 'Digits only with 91, e.g. 919876543210')}
    ${F('instagram', 'Instagram URL', 'url')}${F('youtube', 'YouTube URL', 'url')}${F('instagram_followers', 'Followers label', 'text', 'e.g. 1M+')}
  </section>
  <section class="acard stack"><h2 class="h2">Orders &amp; tax</h2>
    <div class="fgrid">${F('moq', 'Minimum order (pieces)', 'number')}${F('cod_advance_pct', 'COD advance %', 'number')}${F('shipping_fee', 'Shipping fee ₹ (0 = free)', 'number')}${F('free_ship_above', 'Free shipping above ₹ (0 = n/a)', 'number')}
    ${F('gst_low', 'GST % (≤ threshold)', 'number')}${F('gst_high', 'GST % (> threshold)', 'number')}${F('gst_threshold', 'GST threshold ₹/pc', 'number')}${F('return_days', 'Return window (days)', 'number')}
    ${F('pincodes_delivered', 'Pin codes delivered')}${F('pincodes_total', 'Total pin codes')}</div>
    <h2 class="h2">Home page</h2>
    ${F('announcement', 'Top announcement bar')}${F('hero_kicker', 'Hero small text')}${F('hero_title', 'Hero headline (use a new line for 2nd line)', 'textarea')}${F('hero_sub', 'Hero description', 'textarea')}${F('tagline', 'Tagline')}
    <label class="field"><span>Hero image (optional)</span><div class="img-list" data-single="hero_image">${s.hero_image ? `<div class="img-item"><img src="${esc(s.hero_image)}" alt=""><button type="button" data-rm-img>×</button></div>` : ''}</div><input type="hidden" name="hero_image" value="${esc(s.hero_image)}"><label class="btn btn-ghost">Upload<input type="file" accept="image/*" data-upload data-target="hero_image" hidden></label></label>
    <button class="btn btn-lg btn-block">Save settings</button>
  </section></form>`);
}

module.exports = { login, dashboard, orders, orderDetail, products, productForm, categories, customers, messages, settings };
