// Svanexa AI — Service Worker Cache Purge & Self-Unregister
self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(keys.map((key) => caches.delete(key)));
    }).then(() => {
      return self.registration.unregister();
    })
  );
  self.clients.claim();
});

// Let all network requests pass through directly without caching interference
self.addEventListener('fetch', () => {
  return;
});
