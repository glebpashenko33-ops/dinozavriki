// Офлайн-режим для сайта: после первого открытия игра работает без интернета.
const CACHE = 'dino-v1';
const FILES = [
  './', 'index.html', 'manifest.webmanifest',
  'css/fonts.css', 'css/style.css',
  'js/art.js', 'js/data.js', 'js/audio.js', 'js/app.js', 'js/games-more.js', 'js/main.js',
  'fonts/nunito-cyrillic.woff2', 'fonts/nunito-latin.woff2',
  'icons/apple-touch-icon.png', 'icons/icon-192.png', 'icons/icon-512.png',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

// Сначала сеть (чтобы обновления приходили сразу), без сети — из кэша.
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    fetch(e.request)
      .then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, copy));
        return res;
      })
      .catch(() => caches.match(e.request, { ignoreSearch: true }))
  );
});
