/**
 * sw.js: makes Memo work offline. Every file the app needs is cached on the first
 * visit. Requests are answered from the cache straight away and the cache is
 * refreshed from the network in the background, so an update shows up on the
 * visit after it's published. Bump CACHE whenever FILES changes.
 */

const CACHE = 'memo-v2';

const FILES = [
  './',
  'index.html',
  'style.css',
  'manifest.json',
  'icon.svg',
  'fonts/roboto-mono-latin.woff2',
  'src/app.js',
  'src/components.js',
  'src/dom.js',
  'src/match.js',
  'src/speech.js',
  'src/state.js',
  'src/storage.js',
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(FILES)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  const oldCaches = caches.keys().then((keys) => keys.filter((key) => key !== CACHE));
  event.waitUntil(oldCaches.then((keys) => Promise.all(keys.map((key) => caches.delete(key)))));
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const isOwnFile = event.request.method === 'GET' && new URL(event.request.url).origin === location.origin;
  if (!isOwnFile) return;

  event.respondWith(caches.open(CACHE).then(async (cache) => {
    const cached = await cache.match(event.request);
    const fresh = fetch(event.request)
      .then((response) => {
        if (response.ok) cache.put(event.request, response.clone());
        return response;
      })
      .catch(() => cached);
    return cached ?? fresh;
  }));
});
