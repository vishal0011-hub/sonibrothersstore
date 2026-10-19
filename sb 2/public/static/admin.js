/* Sony Brothers — admin client */
(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const toast = (m, err) => { const t = $('.toast'); t.textContent = m; t.className = 'toast' + (err ? ' err' : ''); t.hidden = false; setTimeout(() => (t.hidden = true), 3000); };
  async function api(url, body) {
    const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'sb' }, body: JSON.stringify(body) });
    const d = await r.json().catch(() => ({}));
    if (r.status === 401) { location.href = '/admin/login'; throw new Error('Session expired'); }
    if (!r.ok) throw new Error(d.error || 'Failed');
    return d;
  }
  // Forms → JSON (multi-value fields become arrays)
  document.addEventListener('submit', async e => {
    const f = e.target.closest('form[data-api]'); if (!f) return;
    e.preventDefault();
    const body = {};
    for (const [k, v] of new FormData(f)) {
      if (k in body) body[k] = [].concat(body[k], v);
      else body[k] = ['sizes', 'images'].includes(k) ? [v] : v;
    }
    const btn = $('button.btn:not([type=button])', f); btn && (btn.disabled = true);
    try {
      const d = await api(f.dataset.api, body);
      toast('Saved ✓');
      if (f.dataset.redirect) setTimeout(() => (location.href = f.dataset.redirect), 400);
      else if (d.reload || 'reload' in f.dataset) setTimeout(() => location.reload(), 400);
    } catch (x) { toast(x.message, true); } finally { btn && (btn.disabled = false); }
  });
  // Image upload with in-browser compression (max 1400px, JPEG 82%)
  function compress(file) {
    return new Promise((resolve, reject) => {
      const img = new Image(); const url = URL.createObjectURL(file);
      img.onload = () => {
        const max = 1400, s = Math.min(1, max / Math.max(img.width, img.height));
        const c = document.createElement('canvas'); c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
        const ctx = c.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height); ctx.drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(url); resolve(c.toDataURL('image/jpeg', 0.82));
      };
      img.onerror = reject; img.src = url;
    });
  }
  document.addEventListener('change', async e => {
    const inp = e.target.closest('[data-upload]'); if (!inp) return;
    const target = inp.dataset.target;
    for (const file of inp.files) {
      try {
        toast('Uploading ' + file.name + '…');
        const { url } = await api('/admin/api/upload', { data: await compress(file) });
        if (target) {
          $(`input[name="${target}"]`).value = url;
          $(`[data-single="${target}"]`).innerHTML = `<div class="img-item"><img src="${url}" alt=""><button type="button" data-rm-img>×</button></div>`;
        } else {
          $('[data-images]').insertAdjacentHTML('beforeend', `<div class="img-item"><img src="${url}" alt=""><button type="button" data-rm-img aria-label="Remove">×</button><input type="hidden" name="images" value="${url}"></div>`);
        }
      } catch (x) { toast(x.message || 'Upload failed', true); }
    }
    inp.value = ''; toast('Uploaded ✓ — remember to Save');
  });
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-rm-img]'); if (!b) return;
    const single = b.closest('[data-single]');
    if (single) $(`input[name="${single.dataset.single}"]`).value = '';
    b.closest('.img-item').remove();
  });
  // Drag to reorder product photos
  let drag;
  document.addEventListener('dragstart', e => { drag = e.target.closest('.img-item'); });
  document.addEventListener('dragover', e => { const over = e.target.closest('[data-images] .img-item'); if (drag && over && over !== drag) { e.preventDefault(); over.parentNode.insertBefore(drag, over.nextSibling === drag ? over : over.nextSibling); } });
  $$('[data-images] .img-item').forEach(i => (i.draggable = true));
  new MutationObserver(() => $$('[data-images] .img-item').forEach(i => (i.draggable = true))).observe(document.body, { childList: true, subtree: true });
})();
