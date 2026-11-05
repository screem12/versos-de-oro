// Versos de Oro: abre rápido y deja leer sin señal lo que ya se vio.
const V = "versos-1.1.0";
const SHELL = ["/", "/css/app.css", "/js/app.js", "/manifest.webmanifest", "/icons/versos-192.png"];
self.addEventListener("install", e => { e.waitUntil(caches.open(V).then(c => c.addAll(SHELL)).catch(() => { })); self.skipWaiting(); });
self.addEventListener("activate", e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== V).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener("fetch", e => {
  const u = new URL(e.request.url);
  if (e.request.method !== "GET" || u.origin !== location.origin || u.pathname.startsWith("/api/admin") || u.pathname.startsWith("/api/yo")) return;
  e.respondWith(fetch(e.request).then(r => { if (r.ok) { const cp = r.clone(); caches.open(V).then(c => c.put(e.request, cp)); } return r; }).catch(() => caches.match(e.request, { ignoreSearch: !u.pathname.startsWith("/api/") }).then(r => r || caches.match("/"))));
});

// Avisos al celular: poema nuevo, poeta nuevo, tu poema publicado
self.addEventListener("push", e => {
  let d = {}; try { d = e.data ? e.data.json() : {}; } catch { d = { title: "Versos de Oro", body: e.data ? e.data.text() : "" }; }
  e.waitUntil(self.registration.showNotification(d.title || "Versos de Oro", { body: d.body || "", icon: "/icons/versos-192.png", badge: "/icons/versos-192.png", tag: d.tag || "versos", data: { url: d.url || "/" }, vibrate: [80, 40, 80] }));
});
self.addEventListener("notificationclick", e => {
  e.notification.close(); const url = new URL(e.notification.data?.url || "/", self.location.origin).href;
  e.waitUntil(clients.matchAll({ type: "window", includeUncontrolled: true }).then(L => { for (const c of L) if (new URL(c.url).origin === self.location.origin && "focus" in c) { c.navigate(url).catch(() => { }); return c.focus(); } return clients.openWindow(url); }));
});
