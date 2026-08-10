// sw.js — cache basique de l'app shell pour un usage hors-ligne après premier chargement
const CACHE_NAME = 'atelier-cache-v1';
const ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/style.css',
  './css/print.css',
  './js/app.js',
  './js/db.js',
  './js/utils.js',
  './js/router.js',
  './js/ui.js',
  './js/views/inventaire.js',
  './js/views/parametres.js',
  './js/views/recettes.js',
  './js/views/gateaux.js',
  './js/views/commandes.js',
  './js/views/devis.js',
  './assets/icon.svg',
  './assets/icon-192.png',
  './assets/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)).catch(() => {})
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request)
        .then((response) => {
          if (response.ok && event.request.url.startsWith(self.location.origin)) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => cached);
    })
  );
});
