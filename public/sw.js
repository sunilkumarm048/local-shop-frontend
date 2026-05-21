/* eslint-disable no-restricted-globals */
/**
 * Local Shop service worker.
 *
 * Strategies:
 *   - Navigation requests (HTML): network-first, fall back to offline.html.
 *     We deliberately do NOT cache page HTML — the app is data-heavy and
 *     stale-while-revalidate on auth-bearing pages is dangerous.
 *   - Static assets under /_next/static and /icons: cache-first (those URLs
 *     are content-hashed by Next.js, so cache forever is safe).
 *   - Everything else (API, image uploads, OSM tiles): network-only,
 *     no caching. Customer-facing state must always be fresh.
 *
 * Versioning: bump CACHE_VERSION when the offline fallback or asset list
 * changes — the activate step deletes any older cache entries.
 */

const CACHE_VERSION = 'localshop-v1';
const PRECACHE_URLS = [
  '/offline.html',
  '/icons/icon.svg',
  '/manifest.json',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll(PRECACHE_URLS))
  );
  // Activate this new SW immediately rather than waiting for all tabs to close.
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const request = event.request;

  // Don't touch non-GET — POST/PATCH/DELETE go straight to the network.
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // 1. Navigation requests (HTML pages).
  if (request.mode === 'navigate') {
    event.respondWith(handleNavigation(request));
    return;
  }

  // 2. Cache-first for content-hashed static assets.
  if (url.origin === self.location.origin) {
    if (
      url.pathname.startsWith('/_next/static/') ||
      url.pathname.startsWith('/icons/') ||
      url.pathname === '/manifest.json'
    ) {
      event.respondWith(cacheFirst(request));
      return;
    }
  }

  // 3. Everything else (API calls, third-party fonts, OSM tiles, etc):
  //    network-only. The browser's HTTP cache still applies.
});

/**
 * Network-first for navigation; on failure, return the precached offline page.
 * We do NOT cache successful navigations — keeps auth-gated pages from being
 * served to the wrong user.
 */
async function handleNavigation(request) {
  try {
    return await fetch(request);
  } catch {
    const cache = await caches.open(CACHE_VERSION);
    const offline = await cache.match('/offline.html');
    return offline || new Response('Offline', { status: 503 });
  }
}

/**
 * Cache-first: serve from cache if present; otherwise fetch + put in cache.
 * Only used for content-hashed paths where stale === fresh.
 */
async function cacheFirst(request) {
  const cache = await caches.open(CACHE_VERSION);
  const cached = await cache.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    // Only cache successful responses (avoid caching 404s, redirects to login).
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch (err) {
    // Hashed asset missing AND offline — let it propagate so the page can
    // show its own error.
    throw err;
  }
}

// Allow the page to nudge a waiting SW to activate immediately (used by the
// "new version available" prompt — wired by PWARegistration.tsx).
self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});
