/* ThermalTrace PWA service worker */
const CACHE = "thermaltrace-v5";
const PRECACHE = [
  "/manifest.webmanifest",
  "/favicon.svg",
  "/logo.svg",
  "/icon-192.png",
  "/icon-512.png",
];

const SNAPSHOT_PATHS = new Set([
  "/api/home/readings",
  "/api/user/dashboard-snapshot",
]);

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  let url;
  try {
    url = new URL(request.url);
  } catch {
    return;
  }

  // Never intercept third-party requests (Cloudflare Insights, fonts, etc.)
  if (url.origin !== self.location.origin) return;

  // Let the browser handle Astro islands / build assets directly
  if (
    url.pathname.startsWith("/_server-islands/") ||
    url.pathname.startsWith("/_astro/") ||
    url.pathname.startsWith("/src/")
  ) {
    return;
  }

  // Network-first for API
  if (url.pathname.startsWith("/api/")) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok && SNAPSHOT_PATHS.has(url.pathname)) {
            const copy = response.clone();
            caches.open(CACHE).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() =>
          caches.match(request).then((cached) => {
            if (cached) {
              const stale = cached.clone();
              stale.headers.set("X-ThermalTrace-Stale", "1");
              stale.headers.set("X-Garage-Temp-Stale", "1");
              return stale;
            }
            return Response.error();
          }),
        ),
    );
    return;
  }

  // Network-first for HTML navigations so deploys are not stuck behind a stale "/"
  const isNavigation =
    request.mode === "navigate" ||
    (request.headers.get("accept") || "").includes("text/html");

  if (isNavigation) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => caches.match(request).then((cached) => cached || caches.match("/"))),
    );
    return;
  }

  // Cache-first for same-origin static assets
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => Response.error());
    }),
  );
});

self.addEventListener("push", (event) => {
  let title = "ThermalTrace";
  let body = "New alert";
  try {
    const data = event.data ? event.data.json() : null;
    if (data?.title) title = data.title;
    if (data?.body) body = data.body;
  } catch {
    body = event.data?.text() || body;
  }

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: "/favicon.svg",
      badge: "/favicon.svg",
      tag: "thermaltrace-alert",
      renotify: true,
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(clients.openWindow("/dashboard"));
});
