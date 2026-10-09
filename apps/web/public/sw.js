const CACHE_NAME = 'wordocious-v1';
// Per-puzzle bank files (/banks/<game>/<content-hash>/<entry>.json) never change
// meaning, so they are served cache-first (founder, 2026-09-29).
const BANKS_CACHE = 'wordocious-banks-v1';
const BANKS_CACHE_MAX = 400;
const OFFLINE_URL = '/offline.html';

const PRECACHE_URLS = [
  OFFLINE_URL,
  '/manifest.json',
  '/favicon.ico',
  '/icon-192.png',
  '/icon-512.png',
  '/badge-96.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME && k !== BANKS_CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('push', (event) => {
  const data = event.data ? event.data.json() : {};
  const title = data.title || 'Wordocious';
  const options = {
    body: data.body || "Your daily puzzles are ready!",
    // FINISH_SPEC K2: the app icon B; a large image (the event's cast pose) when the payload carries one.
    // Item 34: the sender's mascot as the icon when the payload carries one; a thread tag stacks / replaces.
    icon: data.icon || '/icon-192.png',
    ...(data.tag ? { tag: data.tag, renotify: true } : {}),
    // BJ11: the status-bar badge is a white W-mascot silhouette (Android masks it to alpha —
    // a full-color icon there reads as a blank white square). Same shape as ic_stat_wordocious.
    badge: '/badge-96.png',
    ...(data.image ? { image: data.image } : {}),
    data: { url: data.url || '/' },
  };
  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      for (const client of windowClients) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      return clients.openWindow(url);
    })
  );
});

async function bankResponse(request) {
  const cache = await caches.open(BANKS_CACHE);
  const hit = await cache.match(request);
  if (hit) return hit;
  const res = await fetch(request);
  if (res.ok) {
    await cache.put(request, res.clone());
    // Bounded: drop the oldest entries (keys come back in insertion order).
    const keys = await cache.keys();
    for (let i = 0; i < keys.length - BANKS_CACHE_MAX; i++) await cache.delete(keys[i]);
  }
  return res;
}

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (event.request.method === 'GET' && url.origin === self.location.origin && url.pathname.startsWith('/banks/')) {
    event.respondWith(bankResponse(event.request).catch(() => fetch(event.request)));
    return;
  }
  if (event.request.mode !== 'navigate') return;

  event.respondWith(
    fetch(event.request).catch(() => caches.match(OFFLINE_URL))
  );
});
