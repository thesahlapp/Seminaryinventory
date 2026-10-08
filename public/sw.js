/*
 * Qalam Inventory service worker.
 *
 * - App files (scripts, styles, fonts, icons) are cached after first use, so
 *   the app opens quickly even on a weak signal.
 * - Pages are fetched fresh when possible. On a slow or missing connection the
 *   last copy seen on this device is shown, or an offline page.
 * - Data changes (saving quantities etc.) always go to the server; nothing is
 *   queued while offline.
 */
const VERSION = "v1";
const STATIC_CACHE = `static-${VERSION}`;
const PAGE_CACHE = `pages-${VERSION}`;
const OFFLINE_URL = "/offline";
const PRECACHE = [OFFLINE_URL, "/logo-mark-cream.png", "/logo.png", "/icons/icon-192.png"];
const PAGE_TIMEOUT_MS = 4000;
const MAX_PAGES = 40;

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(STATIC_CACHE).then((cache) => cache.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => ![STATIC_CACHE, PAGE_CACHE].includes(k)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

function isStaticAsset(url) {
  return (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icons/") ||
    /\.(?:png|jpg|jpeg|svg|webp|woff2?|ico)$/.test(url.pathname)
  );
}

async function cacheFirst(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) (await caches.open(STATIC_CACHE)).put(request, response.clone());
  return response;
}

async function trimPages() {
  const cache = await caches.open(PAGE_CACHE);
  const keys = await cache.keys();
  await Promise.all(keys.slice(0, Math.max(0, keys.length - MAX_PAGES)).map((k) => cache.delete(k)));
}

async function networkFirstPage(request) {
  const cache = await caches.open(PAGE_CACHE);
  const network = fetch(request).then((response) => {
    // Only keep normal pages (not redirects to sign-in).
    if (response.ok && response.type === "basic" && !response.redirected) {
      cache.put(request, response.clone()).then(trimPages);
    }
    return response;
  });

  const timeout = new Promise((resolve) => setTimeout(() => resolve(null), PAGE_TIMEOUT_MS));
  try {
    const first = await Promise.race([network, timeout]);
    if (first) return first;
    // Slow connection: show the saved copy if there is one, else keep waiting.
    return (await cache.match(request)) || (await network);
  } catch {
    return (await cache.match(request)) || (await caches.match(OFFLINE_URL));
  }
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  // Live data (API routes, sign-in, React Server Component payloads) always goes to the network.
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/auth/") || url.searchParams.has("_rsc")) return;
  if (request.headers.get("RSC") || request.headers.get("Next-Router-Prefetch")) return;

  if (isStaticAsset(url)) {
    event.respondWith(cacheFirst(request));
  } else if (request.mode === "navigate") {
    event.respondWith(networkFirstPage(request));
  }
});
