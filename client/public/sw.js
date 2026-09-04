const CACHE_NAME = "field-visits-v7";
const APP_SHELL = ["/", "/manifest.webmanifest", "/icon.svg"];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL))
  );
  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  const url = new URL(event.request.url);

  // Only intercept GET requests on same origin
  if (event.request.method !== "GET" || url.origin !== self.location.origin) return;

  // Never intercept sw itself, API routes, or uploads
  if (
    url.pathname === "/sw.js" ||
    url.pathname.startsWith("/api/") ||
    url.pathname.startsWith("/uploads/")
  ) {
    return;
  }

  // For HTML page navigation: Always Network-First so updates take effect immediately
  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          if (response && response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put("/", copy));
          }
          return response;
        })
        .catch(() => caches.match("/"))
    );
    return;
  }

  // For static assets: Cache first, then Network
  event.respondWith(
    caches.match(event.request).then(cached => {
      if (cached) return cached;
      return fetch(event.request).then(response => {
        // ONLY cache valid 200 OK responses. Never cache 404 or error pages!
        if (response && response.ok && response.status === 200) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
        }
        return response;
      });
    })
  );
});
