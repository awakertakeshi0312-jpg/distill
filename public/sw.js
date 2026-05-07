const CACHE_NAME = 'distill-shell-v3';
const APP_SHELL = ['./', './index.html', './manifest.webmanifest', './distill-icon.svg', './distill-touch-icon.png'];

function isSameOriginGet(request) {
  return request.method === 'GET' && new URL(request.url).origin === self.location.origin;
}

function cacheResponse(request, response) {
  if (!response || !response.ok) {
    return response;
  }

  const copy = response.clone();
  caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
  return response;
}

function shouldPreferNetwork(request) {
  const url = new URL(request.url);
  return request.destination === 'script' || request.destination === 'style' || url.pathname.includes('/assets/');
}

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))),
    ),
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (!isSameOriginGet(event.request)) {
    return;
  }

  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then((response) => cacheResponse(event.request, response))
        .catch(() => caches.match(event.request).then((cached) => cached || caches.match('./'))),
    );
    return;
  }

  if (shouldPreferNetwork(event.request)) {
    event.respondWith(
      fetch(event.request)
        .then((response) => cacheResponse(event.request, response))
        .catch(() => caches.match(event.request)),
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cached) => {
      const network = fetch(event.request).then((response) => cacheResponse(event.request, response));
      return cached || network;
    }),
  );
});
