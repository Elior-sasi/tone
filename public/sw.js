/* צור-tone service worker
 * - Offline app shell (the page, its JS/CSS, icons)
 * - The ffmpeg.wasm engine is cached after first use, so on-device conversion works offline
 * - API calls and user media are never cached
 */
const VERSION = "tzur-tone-v1";
const SHELL = `${VERSION}-shell`;
const ENGINE = `${VERSION}-engine`;
const SHELL_URLS = ["/", "/manifest.webmanifest", "/icons/icon-192.png", "/icons/icon-512.png", "/icons/apple-touch-icon.png", "/icons/favicon.svg", "/ffmpeg-worker.js"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(SHELL).then((c) => c.addAll(SHELL_URLS)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

async function cacheFirst(req, cacheName) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok && res.status === 200) cache.put(req, res.clone());
  return res;
}

async function networkFirst(req) {
  const cache = await caches.open(SHELL);
  try {
    const res = await fetch(req);
    if (res.ok) cache.put(req, res.clone());
    return res;
  } catch {
    return (await cache.match(req)) || (await cache.match("/")) || Response.error();
  }
}

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return; // never cache user media or API calls
  if (req.headers.has("range")) return;

  if (req.mode === "navigate") { event.respondWith(networkFirst(req)); return; }
  if (url.pathname.startsWith("/ffmpeg/")) { event.respondWith(cacheFirst(req, ENGINE)); return; }
  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/") || url.pathname.startsWith("/splash/")) {
    event.respondWith(cacheFirst(req, SHELL));
    return;
  }
  if (url.pathname === "/ffmpeg-worker.js" || url.pathname === "/manifest.webmanifest") {
    event.respondWith(networkFirst(req));
  }
});
