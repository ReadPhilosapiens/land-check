// Land Check: works offline, always fetches the newest version when online.
const C = "land-check-v2";
self.addEventListener("install", e => { e.waitUntil(caches.open(C).then(c => c.addAll(["./", "index.html"]))); self.skipWaiting(); });
self.addEventListener("activate", e => { e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== C).map(k => caches.delete(k))))); self.clients.claim(); });
self.addEventListener("fetch", e => {
  if (e.request.method !== "GET") return;
  // Bypass the browser's HTTP cache so a new upload shows up on the next open.
  e.respondWith(fetch(e.request, { cache: "no-store" })
    .then(r => { const copy = r.clone(); caches.open(C).then(c => c.put(e.request, copy)); return r; })
    .catch(() => caches.match(e.request).then(r => r || caches.match("index.html"))));
});
