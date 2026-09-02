/* Vulnexa PWA service worker — enables installability and a resilient mobile shell. */
self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", (event) => {
  // The app is data-driven; prefer the network for fresh data. The service worker
  // simply needs to exist for installability and to keep the app "alive" offline.
  return;
});