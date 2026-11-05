// Versos de Oro: abre rápido y deja leer sin señal lo que ya se vio.
const V = "versos-1.0.5";
const SHELL = ["/", "/css/app.css", "/js/app.js", "/manifest.webmanifest", "/icons/versos-192.png"];
self.addEventListener("install", e => { e.waitUntil(caches.open(V).then(c => c.addAll(SHELL)).catch(() => { })); self.skipWaiting(); });
self.addEventListener("activate", e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== V).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener("fetch", e => {
  const u = new URL(e.request.url);
  if (e.request.method !== "GET" || u.origin !== location.origin || u.pathname.startsWith("/api/admin") || u.pathname.startsWith("/api/yo")) return;
  e.respondWith(fetch(e.request).then(r => { if (r.ok) { const cp = r.clone(); caches.open(V).then(c => c.put(e.request, cp)); } return r; }).catch(() => caches.match(e.request, { ignoreSearch: !u.pathname.startsWith("/api/") }).then(r => r || caches.match("/"))));
});
