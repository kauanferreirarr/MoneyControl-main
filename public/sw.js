const CACHE_NAME = 'moneycontrol-v1';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/login.html',
  '/registrar.html',
  '/config.html',
  '/css/index-components.css',
  '/css/login.css',
  '/js/main.js',
  '/js/script.js',
  '/js/configurações.js',
  '/js/resetgastos.js',
  '/assets/logo.png'
];

const CDN_ASSETS = [
  'https://cdn.tailwindcss.com',
  'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap',
  'https://cdn.jsdelivr.net/npm/notyf@3/notyf.min.css',
  'https://cdn.jsdelivr.net/npm/notyf@3/notyf.min.js'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll([...STATIC_ASSETS, ...CDN_ASSETS]);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);

  // Firebase requests: network first, no cache
  if (url.hostname.includes('firebaseio.com') || url.hostname.includes('googleapis.com') && url.pathname.includes('firebase')) {
    return;
  }

  // CDN / static assets: cache first, fallback to network
  if (e.request.method !== 'GET') return;

  e.respondWith(
    caches.match(e.request).then((cached) => {
      if (cached) return cached;

      return fetch(e.request).then((response) => {
        if (!response || response.status !== 200) return response;

        const clone = response.clone();
        caches.open(CACHE_NAME).then((cache) => {
          cache.put(e.request, clone);
        });
        return response;
      }).catch(() => {
        // offline fallback for navigation
        if (e.request.mode === 'navigate') {
          return caches.match('/index.html');
        }
      });
    })
  );
});
