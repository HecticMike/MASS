/// <reference lib="webworker" />

declare const self: ServiceWorkerGlobalScope;

const CACHE_VERSION = 'mass-cache-v1';
const APP_SHELL = [
  '/',
  '/index.html',
  '/manifest.webmanifest',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/apple-touch-icon.png',
];

self.addEventListener('install', (event: ExtendableEvent) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_VERSION);
      await cache.addAll(APP_SHELL);
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener('activate', (event: ExtendableEvent) => {
  const cleanup = caches.keys().then((keys) =>
    Promise.all(
      keys.filter((key) => key !== CACHE_VERSION).map((key) => caches.delete(key)),
    ),
  );

  event.waitUntil(
    cleanup.then(() => {
      void self.clients.claim();
    }),
  );
});

self.addEventListener('fetch', (event: FetchEvent) => {
  const { request } = event;
  if (request.method !== 'GET') {
    return;
  }

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          void caches.open(CACHE_VERSION).then((cache) => cache.put('/index.html', copy));
          return response;
        })
        .catch(async () => {
          const cached = await caches.match('/index.html');
          if (cached) {
            return cached;
          }
          throw new Error('Offline and no cached shell');
        }),
    );
    return;
  }

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) {
    return;
  }

  event.respondWith(
    caches.open(CACHE_VERSION).then(async (cache) => {
      const cached = await cache.match(request);
      if (cached) {
        fetch(request)
          .then((response) => {
            if (!response || response.status !== 200) {
              return;
            }
            cache.put(request, response.clone());
          })
          .catch(() => {
            // Ignore network failures; stale cache is fine offline.
          });

        return cached;
      }

      return fetch(request)
        .then((response) => {
          if (response && response.status === 200) {
            cache.put(request, response.clone());
          }
          return response;
        })
        .catch(async () => {
          if (APP_SHELL.includes(url.pathname)) {
            const fallback = await cache.match(url.pathname);
            if (fallback) {
              return fallback;
            }
          }
          throw new Error('Resource not available offline');
        });
    }),
  );
});

export {};
