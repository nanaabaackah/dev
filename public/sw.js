const STATIC_CACHE = "devkpi-static-v1";
const RUNTIME_CACHE = "devkpi-runtime-v1";

const CORE_ASSETS = [
  "/",
  "/index.html",
  "/imgs/dev-logo.png",
  "/assets/favicon_io/favicon.ico",
  "/assets/favicon_io/favicon-16x16.png",
  "/assets/favicon_io/favicon-32x32.png",
  "/assets/favicon_io/apple-touch-icon.png",
  "/assets/favicon_io/android-chrome-192x192.png",
  "/assets/favicon_io/android-chrome-512x512.png",
  "/assets/favicon_io/site.webmanifest",
];

const CACHEABLE_DESTINATIONS = new Set(["document", "script", "style", "image", "font"]);

const shouldCacheRequest = (request, url) => {
  if (CACHEABLE_DESTINATIONS.has(request.destination)) return true;
  if (url.pathname.startsWith("/assets/")) return true;
  return false;
};

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => cache.addAll(CORE_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== STATIC_CACHE && key !== RUNTIME_CACHE)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Keep authenticated API requests network-first and out of generic cache.
  if (url.pathname.startsWith("/api/")) return;

  if (request.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          const response = await fetch(request);
          const cache = await caches.open(RUNTIME_CACHE);
          cache.put(request, response.clone());
          return response;
        } catch {
          const cachedPage = await caches.match(request);
          if (cachedPage) return cachedPage;
          const shell = await caches.match("/index.html");
          if (shell) return shell;
          return new Response("Offline", {
            status: 503,
            statusText: "Offline",
            headers: { "Content-Type": "text/plain; charset=utf-8" },
          });
        }
      })()
    );
    return;
  }

  if (!shouldCacheRequest(request, url)) return;

  event.respondWith(
    (async () => {
      const cached = await caches.match(request);
      if (cached) {
        return cached;
      }

      try {
        const response = await fetch(request);
        if (response.ok) {
          const cache = await caches.open(RUNTIME_CACHE);
          cache.put(request, response.clone());
        }
        return response;
      } catch {
        if (request.destination === "image") {
          const fallbackImage = await caches.match("/imgs/dev-logo.png");
          if (fallbackImage) return fallbackImage;
        }
        return new Response("Offline", {
          status: 503,
          statusText: "Offline",
          headers: { "Content-Type": "text/plain; charset=utf-8" },
        });
      }
    })()
  );
});

self.addEventListener("message", (event) => {
  if (event?.data?.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});
