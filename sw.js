// Offline shell + network-first data. Bump VERSION when shell files change.
const VERSION = 'fczr-v1';
const SHELL = ['./', 'index.html', 'styles.css?v=1', 'app.js?v=1', 'manifest.webmanifest', 'assets/icon.svg', 'assets/icon-192.png'];
self.addEventListener('install', (e) => { e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL))); self.skipWaiting(); });
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin) return;
  // network first for everything same-origin, cache as fallback (data stays fresh, app works offline)
  e.respondWith(fetch(e.request).then((r) => {
    const copy = r.clone(); caches.open(VERSION).then((c) => c.put(e.request, copy)); return r;
  }).catch(() => caches.match(e.request, { ignoreSearch: true })));
});
