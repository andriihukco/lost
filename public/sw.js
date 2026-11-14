// Lost service worker. Keeps the app usable without a connection:
// - the app shell (pages, Next.js bundles, icon, manifest) is kept once seen;
// - map tiles, map styles, fonts and sprites from the map providers are kept once fetched (the offline map);
// - Supabase and other requests are never cached (progress must come from the server).
const SHELL = 'lost-shell-v1';
const MAP = 'lost-map-v1';
const MAP_TILE_LIMIT = 9000; // tiles kept on the device; the oldest go first
const MAP_HOSTS = ['api.maptiler.com', 'server.arcgisonline.com', 'tile.waymarkedtrails.org'];

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  if (MAP_HOSTS.includes(url.hostname)) {
    event.respondWith(cacheFirst(req, MAP, true));
    return;
  }
  if (url.origin !== self.location.origin) return; // Supabase and anything else: straight to the network

  if (req.mode === 'navigate') {
    event.respondWith(networkFirst(req));
    return;
  }
  if (url.pathname.startsWith('/_next/static/') || url.pathname === '/icon.svg' || url.pathname === '/manifest.webmanifest' || url.pathname === '/maplibre-gl-worker.mjs') {
    event.respondWith(cacheFirst(req, SHELL, false));
  }
});

async function cacheFirst(req, name, limited) {
  const cache = await caches.open(name);
  const hit = await cache.match(req);
  if (hit) return hit;
  try {
    const res = await fetch(req);
    if (res.ok || res.type === 'opaque') {
      cache.put(req, res.clone());
      if (limited) trim(cache, MAP_TILE_LIMIT);
    }
    return res;
  } catch {
    return hit || Response.error();
  }
}

async function networkFirst(req) {
  const cache = await caches.open(SHELL);
  try {
    const res = await fetch(req);
    if (res.ok) cache.put(req, res.clone());
    return res;
  } catch {
    return (await cache.match(req)) || (await cache.match('/')) || Response.error();
  }
}

async function trim(cache, limit) {
  const keys = await cache.keys();
  for (let i = 0; i < keys.length - limit; i++) await cache.delete(keys[i]);
}
