const CACHE_NAME = 'anonymous-hf-v1'

self.addEventListener('install', (event) => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(
        names.filter((name) => name !== CACHE_NAME).map((name) => caches.delete(name))
      )
    )
  )
  self.clients.claim()
})

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return

  // Only cache static assets (JS, CSS, images, fonts)
  const url = new URL(event.request.url)
  const isStatic = /\.(js|css|png|jpg|jpeg|svg|woff2?|ttf|eot)$/.test(url.pathname)

  if (isStatic) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        const fetched = fetch(event.request).then((response) => {
          if (response.ok) {
            const clone = response.clone()
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone))
          }
          return response
        })
        return cached || fetched
      })
    )
  }
})
