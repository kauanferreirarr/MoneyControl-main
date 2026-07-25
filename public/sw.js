const CACHE_NAME = 'moneycontrol-v3';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/login.html',
  '/registrar.html',
  '/config.html',
  '/gerenciamento.html',
  '/css/index-components.css',
  '/css/login.css',
  '/css/gerenciamento.css',
  '/js/main.js',
  '/js/script.js',
  '/js/configurações.js',
  '/js/resetgastos.js',
  '/js/gerenciamento.js',
  '/assets/logo.png'
];

const CDN_ASSETS = [
  'https://cdn.tailwindcss.com',
  'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap',
  'https://cdn.jsdelivr.net/npm/notyf@3/notyf.min.css',
  'https://cdn.jsdelivr.net/npm/notyf@3/notyf.min.js',
  'https://cdn.jsdelivr.net/npm/chart.js@4.4.7/dist/chart.umd.min.js'
];

self.addEventListener('install', (e) => {
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((k) => caches.delete(k))
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);

  if (url.hostname.includes('firebaseio.com')) {
    return;
  }

  if (e.request.method !== 'GET') return;

  e.respondWith(
    fetch(e.request).then((response) => {
      if (!response || response.status !== 200 || response.type !== 'basic') {
        return response;
      }

      const clone = response.clone();
      caches.open(CACHE_NAME).then((cache) => {
        cache.put(e.request, clone);
      });
      return response;
    }).catch(() => {
      return caches.match(e.request).then((cached) => {
        if (cached) return cached;
        if (e.request.mode === 'navigate') {
          return caches.match('/index.html');
        }
      });
    })
  );
});
