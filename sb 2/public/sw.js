// Service worker: makes the site installable as an app and keeps it fast/offline-tolerant.
const V = 'sb-v1';
const CORE = ['/', '/shop', '/static/styles.css?v=1', '/static/app.js?v=1', '/manifest.webmanifest', '/icons/icon-192.png'];
self.addEventListener('install', e => { e.waitUntil(caches.open(V).then(c => c.addAll(CORE)).catch(() => {})); self.skipWaiting(); });
self.addEventListener('activate', e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== V).map(k => caches.delete(k))))); self.clients.claim(); });
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin) return;
  if (/^\/(api|admin|checkout|account|order|invoice|login|logout)/.test(u.pathname)) return; // never cache private pages
  if (/^\/(static|icons|uploads)\//.test(u.pathname)) {
    e.respondWith(caches.match(e.request).then(hit => hit || fetch(e.request).then(r => { const copy = r.clone(); caches.open(V).then(c => c.put(e.request, copy)); return r; })));
    return;
  }
  if (e.request.mode === 'navigate') {
    e.respondWith(fetch(e.request).then(r => { const copy = r.clone(); caches.open(V).then(c => c.put(e.request, copy)); return r; })
      .catch(() => caches.match(e.request).then(hit => hit || caches.match('/'))));
  }
});
