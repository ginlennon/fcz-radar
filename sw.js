// Offline shell + fresh-but-fast data. Bump VERSION (and ?v= in index.html) when shell files change.
const VERSION = 'fczr-v2';
const SHELL = ['./', 'index.html', 'styles.css?v=2', 'app.js?v=2', 'manifest.webmanifest', 'assets/icon.svg', 'assets/icon-192.png'];
self.addEventListener('install', (e) => { e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL))); self.skipWaiting(); });
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
// network first, but never wait more than `ms` when a cached copy exists (weak stadium connection)
function netFirst(req, ms) {
  const net = fetch(req).then((r) => { if (r.ok) { const c = r.clone(); caches.open(VERSION).then((cc) => cc.put(req, c)); } return r; });
  const cached = caches.match(req, { ignoreSearch: true });
  return new Promise((resolve) => {
    let done = false;
    const finish = (r) => { if (!done && r) { done = true; resolve(r); } };
    net.then(finish).catch(() => cached.then((r) => finish(r || Response.error())));
    setTimeout(() => cached.then(finish), ms);
  });
}
self.addEventListener('fetch', (e) => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin) return;
  if (/\.(js|css|svg|png|webmanifest)$/.test(u.pathname) && u.search.includes('v=')) {
    e.respondWith(caches.match(e.request).then((r) => r || netFirst(e.request, 4000))); // versioned shell: cache first
  } else {
    e.respondWith(netFirst(e.request, 3000));
  }
});
