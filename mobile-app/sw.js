self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== "vulnexa-live-v2").map((k) => caches.delete(k)))).then(() => self.clients.claim())
  );
});
self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;
  // Network-first: always try the live server so updates appear immediately.
  event.respondWith(
    fetch(req)
      .then((res) => {
        const copy = res.clone();
        if (res.ok && !url.pathname.startsWith("/api/")) caches.open("vulnexa-live-v2").then((cache) => cache.put(req, copy));
        return res;
      })
      .catch(() =>
        caches.open("vulnexa-live-v2").then((cache) => cache.match(req)).then((cached) => cached || Response.error())
      )
  );
});
