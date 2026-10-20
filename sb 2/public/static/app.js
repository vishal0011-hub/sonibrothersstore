/* Soni Brothers — storefront client */
(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const MOQ = +document.body.dataset.moq || 4;
  const inr = n => '₹' + Math.round(n).toLocaleString('en-IN');
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  async function api(url, body) {
    const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'sb' }, body: JSON.stringify(body || {}), credentials: 'same-origin' });
    const d = await r.json().catch(() => ({ error: 'Network error' }));
    if (!r.ok) throw Object.assign(new Error(d.error || 'Something went wrong'), { status: r.status });
    return d;
  }
  let toastT;
  function toast(msg, err = false) {
    const t = $('.toast'); t.textContent = msg; t.className = 'toast' + (err ? ' err' : ''); t.hidden = false;
    clearTimeout(toastT); toastT = setTimeout(() => (t.hidden = true), 3200);
  }

  // ---------- garment art (mirrors server) ----------
  const SHAPES = {
    tee: 'M38 22 L50 16 Q60 24 70 16 L82 22 L98 38 L88 48 L82 43 L82 102 L38 102 L38 43 L32 48 L22 38 Z',
    oversized: 'M34 22 L50 15 Q60 23 70 15 L86 22 L104 44 L90 54 L86 48 L88 104 L32 104 L34 48 L30 54 L16 44 Z',
    shirt: 'M38 22 L50 15 L60 28 L70 15 L82 22 L98 40 L88 48 L82 43 L82 104 L38 104 L38 43 L32 48 L22 40 Z',
    polo: 'M38 22 L50 16 L60 30 L70 16 L82 22 L98 38 L88 48 L82 43 L82 102 L38 102 L38 43 L32 48 L22 38 Z',
    hoodie: 'M40 26 Q44 10 60 10 Q76 10 80 26 L94 32 L104 94 L92 96 L86 54 L86 104 L34 104 L34 54 L28 96 L16 94 L26 32 Z',
    jacket: 'M40 22 L52 16 L60 22 L68 16 L80 22 L94 30 L104 94 L92 96 L86 54 L86 104 L34 104 L34 54 L28 96 L16 94 L26 30 Z',
    jeans: 'M40 14 L80 14 L86 108 L66 108 L60 44 L54 108 L34 108 Z', cargo: 'M38 14 L82 14 L88 108 L66 108 L60 44 L54 108 L32 108 Z',
    jogger: 'M40 14 L80 14 L82 100 L66 104 L60 44 L54 104 L38 100 Z', shorts: 'M36 30 L84 30 L90 82 L64 84 L60 56 L56 84 L30 82 Z',
  };
  const art = (icon, hex) => `<div class="ph"><svg class="art" viewBox="0 0 120 120"><path d="${SHAPES[icon] || SHAPES.tee}" fill="${esc(hex)}" stroke="rgba(0,0,0,.18)" stroke-width=".8"/></svg></div>`;
  const thumb = l => l.img ? `<img src="${esc(l.img)}" alt="" loading="lazy">` : art(l.icon, l.colorHex);

  // ---------- panels ----------
  const scrim = $('.scrim');
  let lastFocus;
  function open(id) {
    closeAll(); lastFocus = document.activeElement;
    const el = document.getElementById(id); if (!el) return;
    el.hidden = false;
    if (['cart', 'menu'].includes(id)) scrim.hidden = false;
    if (id === 'cart') renderCart();
    document.body.style.overflow = 'hidden';
    setTimeout(() => (el.querySelector('input:not([type=hidden]),button[data-close]') || el).focus(), 30);
  }
  function closeAll() {
    ['cart', 'menu', 'search', 'quick', 'login'].forEach(id => { const el = document.getElementById(id); if (el) el.hidden = true; });
    scrim.hidden = true; document.body.style.overflow = '';
  }
  document.addEventListener('click', e => {
    const o = e.target.closest('[data-open]');
    if (o) { e.preventDefault(); if (o.dataset.next) loginNext = o.dataset.next; return open(o.dataset.open); }
    if (e.target.closest('[data-close]') || e.target === scrim || e.target.classList.contains('modal')) { closeAll(); lastFocus?.focus?.(); }
  });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeAll(); });

  // ---------- cart store ----------
  const KEY = 'sb_cart_v1';
  const read = () => { try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch { return []; } };
  const write = lines => { try { localStorage.setItem(KEY, JSON.stringify(lines)); } catch {} sync(); };
  // A line is either a single size (qty = pieces) or a set (qty = number of sets, setPieces pcs each)
  const linePcs = l => l.qty * (l.setPieces || 1);
  const lineAmt = l => l.qty * (l.setPrice || l.price);
  const pieces = lines => lines.reduce((a, l) => a + linePcs(l), 0);
  const subtotal = lines => lines.reduce((a, l) => a + lineAmt(l), 0);
  const forServer = lines => lines.map(({ id, size, color, qty, pack }) => ({ id, size, color, qty, pack }));
  function addLines(product, color, sizeQty, setQty = {}) {
    const lines = read();
    const push = (key, extra, qty) => {
      const ex = lines.find(l => l.key === key);
      if (ex) ex.qty = Math.min(999, ex.qty + qty);
      else lines.push({ key, id: product.id, slug: product.slug, name: product.name, price: product.price, icon: product.icon, img: product.img, qty, ...extra });
    };
    for (const [size, qty] of Object.entries(sizeQty)) if (qty) push(`${product.id}|${size}|${color.name}`, { size, color: color.name, colorHex: color.hex }, qty);
    for (const [id, qty] of Object.entries(setQty)) {
      const k = (product.packs || []).find(x => x.id === id); if (!qty || !k) continue;
      const c = k.colors ? { name: k.colors.length === product.colors.length && k.colors.length > 1 ? `Assorted · all ${k.colors.length} colours` : k.colors.join(', '), hex: product.colors[0]?.hex } : color;
      push(`${product.id}|pack:${id}|${c.name}`, { pack: id, packName: k.name, size: k.label, setPieces: k.pieces, setPrice: k.setPrice, price: k.unit, color: k.colors ? c.name : color.name, colorHex: k.colors ? c.hex : color.hex }, qty);
    }
    write(lines);
  }
  function moqHTML(n) {
    const left = MOQ - n;
    return left > 0 ? `Add <b>${left} more piece${left > 1 ? 's' : ''}</b> to reach the minimum order of ${MOQ}. Mix any styles.` : `✓ Minimum order of ${MOQ} pieces reached`;
  }
  function paintMoq(n) {
    $$('.moq-meter').forEach(m => { m.classList.toggle('ok', n >= MOQ); $('.moq-text', m).innerHTML = moqHTML(n); $('.bar i', m).style.width = Math.min(100, (n / MOQ) * 100) + '%'; });
  }
  const lineHTML = l => `<div class="cline" data-key="${esc(l.key)}">
    <a href="/p/${esc(l.slug)}" class="cline-img">${thumb(l)}</a>
    <div><b>${esc(l.name)}</b><div class="meta">${l.pack ? `<b>${esc(l.packName)}</b> · ${esc(l.size)} · ${esc(l.color)}<br>${l.setPieces} pcs/set · ${inr(l.setPrice)}/set${l.qty > 1 ? ` · <b>${linePcs(l)} pcs</b>` : ''}` : `${esc(l.color)} · Size ${esc(l.size)} · ${inr(l.price)}/pc`}</div>
      <div class="stepper"><button data-q="-1" aria-label="Decrease">−</button><input type="number" value="${l.qty}" min="0" max="999" data-qin aria-label="Quantity"><button data-q="1" aria-label="Increase">+</button></div>
      <button class="rm" data-rm>Remove</button></div>
    <div class="amt">${inr(lineAmt(l))}${l.pack ? `<small>${l.qty} set${l.qty > 1 ? 's' : ''}</small>` : ''}</div></div>`;
  function renderCart() {
    const lines = read(); const n = pieces(lines);
    const body = $('#cart-lines');
    if (body) body.innerHTML = lines.length ? lines.map(lineHTML).join('') : '<div class="empty"><h3>Your bag is empty</h3><p class="muted">Mix any designs and sizes — minimum ' + MOQ + ' pieces.</p><a class="btn" href="/shop">Start shopping</a></div>';
    const cp = $('#cart-page-lines');
    if (cp) { cp.innerHTML = lines.length ? lines.map(lineHTML).join('') : '<div class="empty"><h3>Your bag is empty</h3><a class="btn" href="/shop">Start shopping</a></div>'; $('#cp-pcs').textContent = n; $('#cp-sub').textContent = inr(subtotal(lines)); }
    $('#cart-sub') && ($('#cart-sub').textContent = inr(subtotal(lines)));
    [$('#cart-checkout'), $('#cp-checkout')].forEach(b => b && b.classList.toggle('disabled', n < MOQ));
    paintMoq(n);
  }
  function sync() {
    const n = pieces(read());
    $$('.cart-count').forEach(c => { c.textContent = n; c.hidden = !n; });
    renderCart();
    if (document.body.dataset.page === 'checkout') quote();
  }
  document.addEventListener('click', e => {
    const line = e.target.closest('.cline[data-key]'); if (!line) return;
    const lines = read(); const l = lines.find(x => x.key === line.dataset.key); if (!l) return;
    if (e.target.closest('[data-q]')) { l.qty = Math.max(0, l.qty + +e.target.closest('[data-q]').dataset.q); }
    else if (e.target.closest('[data-rm]')) l.qty = 0; else return;
    write(lines.filter(x => x.qty > 0));
  });
  document.addEventListener('change', e => {
    if (!e.target.matches('[data-qin]')) return;
    const key = e.target.closest('.cline').dataset.key; const lines = read(); const l = lines.find(x => x.key === key);
    if (l) { l.qty = Math.max(0, Math.min(999, Math.floor(+e.target.value) || 0)); write(lines.filter(x => x.qty > 0)); }
  });

  // ---------- picker: colour + sets + single sizes (product page and quick-add share it) ----------
  function wirePicker(root) {
    const product = JSON.parse(root.dataset.product);
    let colorIdx = 0;
    const clamp = i => { const v = Math.max(0, Math.min(999, Math.floor(+i.value) || 0)); i.value = v; return v; };
    const total = () => {
      const q = {}, sq = {}; let n = 0, amt = 0;
      $$('input[data-size]', root).forEach(i => { const v = clamp(i); q[i.dataset.size] = v; n += v; amt += v * product.price; i.closest('.sq').classList.toggle('has', v > 0); });
      $$('input[data-set]', root).forEach(i => {
        const v = clamp(i); const k = product.packs.find(x => x.id === i.dataset.set); sq[i.dataset.set] = v;
        n += v * k.pieces; amt += v * k.setPrice; i.closest('.set-card').classList.toggle('has', v > 0);
      });
      $('[data-pdp-count]', root).textContent = `${n} piece${n === 1 ? '' : 's'}`;
      $('[data-pdp-total]', root).textContent = inr(amt);
      return { q, sq, n };
    };
    root.addEventListener('click', e => {
      const st = e.target.closest('[data-step]');
      if (st) { const i = st.parentElement.querySelector('input'); i.value = Math.max(0, (+i.value || 0) + +st.dataset.step); total(); }
      if (e.target.closest('[data-set-pack]')) { $$('input[data-size]', root).forEach(i => (i.value = (+i.value || 0) + 1)); total(); }
      const sw = e.target.closest('[data-color]');
      if (sw) {
        colorIdx = +sw.dataset.color; $$('[data-color]', root).forEach(x => x.classList.toggle('on', x === sw));
        $('[data-color-name]', root).textContent = product.colors[colorIdx].name;
        const g = $('[data-gallery]'); const slide = g && $(`.g-slide[data-i="${colorIdx}"]`, g);
        if (slide && root.closest('.pdp')) slide.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
        const qimg = $('.qa-top .qimg', root.parentElement); if (qimg && !product.img) qimg.innerHTML = art(product.icon, product.colors[colorIdx].hex);
      }
      if (e.target.closest('[data-add-pdp]')) {
        const { q, sq, n } = total();
        if (!n) return toast(product.packs.length ? 'Choose how many sets you want' : 'Choose at least 1 piece in any size', true);
        addLines(product, product.colors[colorIdx] || { name: '-', hex: '#222' }, q, sq);
        $$('input[data-size],input[data-set]', root).forEach(i => (i.value = 0)); total();
        const inCart = pieces(read());
        toast(inCart >= MOQ ? `Added ${n} pcs · Bag ready for checkout` : `Added ${n} pcs · ${MOQ - inCart} more to reach MOQ`);
        if (root.closest('#quick')) closeAll();
        open('cart');
      }
    });
    root.addEventListener('input', e => e.target.matches('input[data-size],input[data-set]') && total());
    total();
  }
  const pdpPicker = $('.pdp-info .picker');
  if (pdpPicker) wirePicker(pdpPicker);

  document.addEventListener('click', async e => {
    const b = e.target.closest('[data-quick]'); if (!b) return;
    e.preventDefault();
    const p = JSON.parse(b.dataset.quick);
    const old = $('#quick-body'); const box = old.cloneNode(false); old.replaceWith(box);   // fresh node, no old listeners
    box.innerHTML = `<button class="icon-btn modal-x" data-close aria-label="Close">✕</button>
      <div class="qa-top"><div class="qimg">${p.img ? `<img src="${esc(p.img)}" alt="">` : art(p.icon, p.colors[0]?.hex)}</div><div><h3>${esc(p.name)}</h3><div class="price"><strong>${inr(p.price)}</strong><span class="per">/pc</span></div><a class="link small" href="/p/${esc(p.slug)}">View details</a></div></div>
      <div class="q-picker"><p class="muted small">Loading…</p></div>`;
    open('quick');
    try {
      const r = await fetch(`/picker/${p.id}`); if (!r.ok) throw new Error();
      $('.q-picker', box).innerHTML = await r.text();
      wirePicker($('.q-picker .picker', box));
    } catch { location.href = `/p/${p.slug}`; }
  });

  // ---------- pin code ----------
  const METRO = ['Delhi', 'Maharashtra', 'Karnataka', 'Tamil Nadu', 'Telangana', 'West Bengal', 'Gujarat'];
  const FAR = ['Arunachal Pradesh', 'Assam', 'Manipur', 'Meghalaya', 'Mizoram', 'Nagaland', 'Sikkim', 'Tripura', 'Jammu and Kashmir', 'Ladakh', 'Andaman and Nicobar Islands', 'Lakshadweep'];
  async function lookupPin(pin) {
    try {
      const ctl = new AbortController(); setTimeout(() => ctl.abort(), 5000);
      const r = await fetch('https://api.postalpincode.in/pincode/' + pin, { signal: ctl.signal });
      const d = await r.json(); const po = d?.[0]?.PostOffice?.[0];
      return po ? { city: po.District, state: po.State } : null;
    } catch { return undefined; }
  }
  document.addEventListener('submit', async e => {
    const f = e.target.closest('[data-pincheck]'); if (!f) return;
    e.preventDefault();
    const pin = $('input', f).value.trim(); const out = $('.pin-result', f);
    if (!/^[1-9]\d{5}$/.test(pin)) { out.className = 'pin-result small bad'; out.textContent = 'Enter a valid 6-digit pin code'; return; }
    out.className = 'pin-result small'; out.textContent = 'Checking…';
    const loc = await lookupPin(pin);
    if (loc === null) { out.className = 'pin-result small bad'; out.textContent = 'This pin code looks invalid. Please check.'; return; }
    const eta = !loc ? '3–8' : METRO.includes(loc.state) ? '3–5' : FAR.includes(loc.state) ? '7–12' : '5–8';
    out.className = 'pin-result small ok';
    out.textContent = `✓ We deliver${loc ? ` to ${loc.city}, ${loc.state}` : ''} · ${eta} working days · COD available`;
  });

  // ---------- OTP login ----------
  let loginNext = null, otpPhone = '', resendT;
  const f1 = $('#otp-form-1'), f2 = $('#otp-form-2');
  f1?.addEventListener('submit', async e => {
    e.preventDefault();
    const btn = $('button', f1); btn.disabled = true;
    try {
      otpPhone = f1.phone.value.replace(/\D/g, '');
      const d = await api('/api/otp/send', { phone: otpPhone });
      f1.hidden = true; f2.hidden = false; $('#otp-phone').textContent = '+91 ' + otpPhone;
      const dev = $('.dev-otp', f2);
      if (d.devCode) { dev.hidden = false; dev.textContent = `Test mode — your OTP is ${d.devCode} (real SMS is sent once an SMS provider is connected)`; } else dev.hidden = true;
      f2.code.value = ''; f2.code.focus(); startResend();
    } catch (err) { toast(err.message, true); } finally { btn.disabled = false; }
  });
  function startResend() {
    const b = $('#otp-resend'); let s = 30; b.disabled = true; clearInterval(resendT);
    resendT = setInterval(() => { b.textContent = s > 0 ? `Resend OTP in ${s--}s` : 'Resend OTP'; if (s < 0) { b.disabled = false; clearInterval(resendT); } }, 1000);
  }
  $('#otp-resend')?.addEventListener('click', () => { f1.phone.value = otpPhone; f1.requestSubmit(); });
  $('#otp-change')?.addEventListener('click', e => { e.preventDefault(); f2.hidden = true; f1.hidden = false; f1.phone.focus(); });
  f2?.addEventListener('input', e => { if (e.target.name === 'code' && /^\d{6}$/.test(e.target.value)) f2.requestSubmit(); });
  f2?.addEventListener('submit', async e => {
    e.preventDefault();
    const btn = $('button.btn', f2); btn.disabled = true;
    try {
      await api('/api/otp/verify', { phone: otpPhone, code: f2.code.value.trim() });
      toast('Logged in ✓');
      const next = loginNext || new URLSearchParams(location.search).get('next');
      if (next && next.startsWith('/') && !next.startsWith('//')) location.href = next; else location.reload();
    } catch (err) { toast(err.message, true); btn.disabled = false; }
  });
  if ($('#auto-login')) { loginNext = $('#auto-login').dataset.next; open('login'); }

  // ---------- checkout ----------
  const co = $('#checkout');
  let lastQuote = null;
  async function quote() {
    if (!co) return;
    const lines = read(); const sum = $('#co-summary');
    if (!lines.length) { $('#co-lines').innerHTML = '<div class="empty"><p>Your bag is empty.</p><a class="btn" href="/shop">Shop now</a></div>'; $('.sum-rows', sum).innerHTML = ''; $('#place-btn').disabled = true; return; }
    $('#co-lines').innerHTML = `<div class="co-lines">${lines.map(l => `<div class="cline"><div class="cline-img">${thumb(l)}</div><div><b>${esc(l.name)}</b><div class="meta">${l.pack ? `${esc(l.packName)} · ${esc(l.color)} · ${l.qty} set${l.qty > 1 ? 's' : ''} (${linePcs(l)} pcs)` : `${esc(l.color)} · ${esc(l.size)} · ×${l.qty}`}</div></div><div class="amt">${inr(lineAmt(l))}</div></div>`).join('')}</div><a class="link small" href="/cart">Edit bag</a>`;
    const form = $('#co-form');
    try {
      const q = await api('/api/cart/quote', { lines: forServer(lines), state: form?.state?.value });
      lastQuote = q;
      const cod = form?.method?.value === 'cod';
      $('#pay-pre').textContent = inr(q.total);
      $('#pay-cod').textContent = inr(q.advance) + ' now';
      $('.sum-rows', sum).innerHTML = `
        <div class="row-between"><span>${q.pieces} pieces</span><span>${inr(q.subtotal)}</span></div>
        <div class="row-between"><span>Shipping</span><span>${q.shipping ? inr(q.shipping) : 'Free'}</span></div>
        <div class="row-between total"><span>Total</span><b>${inr(q.total)}</b></div>
        <p class="tiny muted">Includes GST of approx. ${inr(q.tax)}</p>
        <div class="row-between hl-row"><span>${cod ? 'Pay now (advance)' : 'Pay now'}</span><b>${inr(cod ? q.advance : q.total)}</b></div>
        ${cod ? `<div class="row-between"><span>Pay on delivery</span><b>${inr(q.total - q.advance)}</b></div>` : ''}
        ${q.moqMet ? '' : `<p class="form-err">Minimum order is ${q.moq} pieces — add ${q.moq - q.pieces} more.</p>`}`;
      $('#place-btn').disabled = !q.moqMet;
      $('#place-btn').textContent = `Pay ${inr(cod ? q.advance : q.total)} & place order`;
    } catch (err) { $('.sum-rows', sum).innerHTML = `<p class="form-err">${esc(err.message)}</p>`; $('#place-btn').disabled = true; }
  }
  if (co) {
    const form = $('#co-form');
    quote();
    form.addEventListener('change', e => {
      if (e.target.name === 'address_id') $('.addr-new', form).hidden = e.target.value !== 'new';
      if (['method', 'state', 'address_id'].includes(e.target.name)) quote();
    });
    form.pincode?.addEventListener('input', async e => {
      const pin = e.target.value.replace(/\D/g, '');
      if (pin.length !== 6) return;
      const loc = await lookupPin(pin);
      if (loc) { if (!form.city.value) form.city.value = loc.city; const opt = [...form.state.options].find(o => o.value.toLowerCase() === loc.state.toLowerCase()); if (opt) { form.state.value = opt.value; quote(); } }
    });
    form.addEventListener('submit', async e => {
      e.preventDefault();
      const err = $('.form-err[role=alert]', form); err.hidden = true;
      const showErr = m => { err.textContent = m; err.hidden = false; err.scrollIntoView({ behavior: 'smooth', block: 'center' }); };
      if (document.body.dataset.logged !== '1') return open('login');
      if (!form.agree.checked) return showErr('Please accept the terms to continue.');
      const lines = read();
      if (pieces(lines) < MOQ) return showErr(`Minimum order is ${MOQ} pieces.`);
      const addrId = form.address_id?.value || (form.querySelector('[name=address_id]:checked') || {}).value || 'new';
      const fd = Object.fromEntries(new FormData(form));
      const btn = $('#place-btn'); btn.disabled = true; const label = btn.textContent; btn.textContent = 'Processing…';
      try {
        const d = await api('/api/orders', {
          lines: forServer(lines), method: fd.method, gstin: fd.gstin,
          address_id: addrId, address: { name: fd.name, phone: fd.phone, business: fd.business, line1: fd.line1, line2: fd.line2, city: fd.city, state: fd.state, pincode: fd.pincode },
        });
        if (d.demo) {
          if (!confirm(`TEST MODE\n\nSimulate a successful payment of ${inr(d.amount)} for order #${d.number}?`)) throw new Error('Payment cancelled');
          await api('/api/payment/demo', { number: d.number });
          return done(d.number);
        }
        if (!window.Razorpay) throw new Error('Payment window failed to load. Check your internet and try again.');
        const rz = new window.Razorpay({
          ...d.razorpay, order_id: d.razorpay.order_id, theme: { color: '#0b0b0b' },
          handler: async resp => {
            try { await api('/api/payment/verify', { number: d.number, ...resp }); done(d.number); }
            catch (x) { showErr(x.message); btn.disabled = false; btn.textContent = label; }
          },
          modal: { ondismiss: () => { btn.disabled = false; btn.textContent = label; toast('Payment not completed. You can try again.', true); } },
        });
        rz.on('payment.failed', r => toast(r.error?.description || 'Payment failed', true));
        rz.open();
      } catch (x) {
        if (x.status === 401) { btn.disabled = false; btn.textContent = label; return open('login'); }
        showErr(x.message); btn.disabled = false; btn.textContent = label;
      }
    });
  }
  function done(number) { write([]); location.href = `/order/${encodeURIComponent(number)}?placed=1`; }

  // ---------- account / contact ----------
  $('#profile-form')?.addEventListener('submit', async e => {
    e.preventDefault();
    try { await api('/api/profile', Object.fromEntries(new FormData(e.target))); toast('Saved ✓'); } catch (x) { toast(x.message, true); }
  });
  document.addEventListener('click', async e => {
    const b = e.target.closest('[data-del-addr]'); if (!b) return;
    if (!confirm('Remove this address?')) return;
    try { await api(`/api/addresses/${b.dataset.delAddr}/delete`); b.closest('.addr').remove(); } catch (x) { toast(x.message, true); }
  });
  $('#contact-form')?.addEventListener('submit', async e => {
    e.preventDefault();
    try { await api('/api/contact', Object.fromEntries(new FormData(e.target))); e.target.reset(); toast("Thanks! We'll get back to you soon."); } catch (x) { toast(x.message, true); }
  });

  sync();

  // ---------- PWA ----------
  if ('serviceWorker' in navigator && location.protocol === 'https:' || location.hostname === 'localhost') {
    window.addEventListener('load', () => navigator.serviceWorker?.register('/sw.js').catch(() => {}));
  }
})();
