// public/sw.js — Service Worker SEMENCE ÉPARGNE
const CACHE_NAME = 'semence-epargne-v1';
const STATIC_ASSETS = ['/', '/client', '/login', '/index.html'];

// Installation : mise en cache des assets statiques
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

// Activation : nettoyage des anciens caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch : stratégie Network First avec fallback cache
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Les appels API ne sont jamais mis en cache (données temps réel)
  if (url.pathname.startsWith('/api/')) return;

  // Pour les assets statiques : cache first
  event.respondWith(
    caches.match(event.request).then(cached => {
      const networkFetch = fetch(event.request).then(response => {
        if (response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      }).catch(() => cached);

      return cached || networkFetch;
    })
  );
});

// Sync en arrière-plan (Background Sync API)
self.addEventListener('sync', event => {
  if (event.tag === 'sync-offline-queue') {
    event.waitUntil(syncOfflineQueue());
  }
});

async function syncOfflineQueue() {
  // Déclenche la sync depuis le client
  const clients = await self.clients.matchAll();
  clients.forEach(client => {
    client.postMessage({ type: 'TRIGGER_SYNC' });
  });
}
