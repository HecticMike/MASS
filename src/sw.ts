/// <reference lib="webworker" />

declare const self: ServiceWorkerGlobalScope

const CACHE_VERSION = 'mass-cache-v2'

const resolveBasePath = () => {
  const base = import.meta.env.BASE_URL ?? '/'
  const absolute = new URL(base, self.location.origin).pathname
  return absolute.endsWith('/') ? absolute : `${absolute}/`
}

const BASE_PATH = resolveBasePath()
const ORIGIN = self.location.origin

const APP_SHELL_PATHS = [
  BASE_PATH,
  `${BASE_PATH}index.html`,
  `${BASE_PATH}manifest.webmanifest`,
  `${BASE_PATH}icons/icon-192.png`,
  `${BASE_PATH}icons/icon-512.png`,
  `${BASE_PATH}icons/apple-touch-icon.png`,
]

const APP_SHELL_URLS = APP_SHELL_PATHS.map((path) => `${ORIGIN}${path}`)
const APP_SHELL_PATH_SET = new Set(APP_SHELL_PATHS)
const INDEX_URL = `${ORIGIN}${BASE_PATH}index.html`

self.addEventListener('install', (event: ExtendableEvent) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE_VERSION)
      await cache.addAll(APP_SHELL_URLS)
      await self.skipWaiting()
    })(),
  )
})

self.addEventListener('activate', (event: ExtendableEvent) => {
  const cleanup = caches.keys().then((keys) =>
    Promise.all(
      keys.filter((key) => key !== CACHE_VERSION).map((key) => caches.delete(key)),
    ),
  )

  event.waitUntil(
    cleanup.then(() => {
      void self.clients.claim()
    }),
  )
})

self.addEventListener('fetch', (event: FetchEvent) => {
  const { request } = event
  if (request.method !== 'GET') {
    return
  }

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone()
          void caches.open(CACHE_VERSION).then((cache) => cache.put(INDEX_URL, copy))
          return response
        })
        .catch(async () => {
          const cache = await caches.open(CACHE_VERSION)
          const cachedIndex = await cache.match(INDEX_URL)
          if (cachedIndex) {
            return cachedIndex
          }
          const cachedRoot = await cache.match(APP_SHELL_URLS[0])
          if (cachedRoot) {
            return cachedRoot
          }
          throw new Error('Offline and no cached shell')
        }),
    )
    return
  }

  const url = new URL(request.url)
  if (url.origin !== ORIGIN) {
    return
  }

  event.respondWith(
    caches.open(CACHE_VERSION).then(async (cache) => {
      const cached = await cache.match(request)
      if (cached) {
        fetch(request)
          .then((response) => {
            if (!response || response.status !== 200) {
              return
            }
            cache.put(request, response.clone())
          })
          .catch(() => {
            // Ignore network failures; stale cache is fine offline.
          })

        return cached
      }

      return fetch(request)
        .then((response) => {
          if (response && response.status === 200) {
            cache.put(request, response.clone())
          }
          return response
        })
        .catch(async () => {
          if (APP_SHELL_PATH_SET.has(url.pathname)) {
            const fallback = await cache.match(`${ORIGIN}${url.pathname}`)
            if (fallback) {
              return fallback
            }
          }
          throw new Error('Resource not available offline')
        })
    }),
  )
})

export {}
