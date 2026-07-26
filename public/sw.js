/**
 * MoneyControl Service Worker
 * Versao: 4.0
 *
 * Estrategia: Network-first com fallback para cache
 * - Recursos estaticos locais: cache imediato no install
 * - Navegacao (HTML): network-first, fallback para cache
 * - CDN (fonts, tailwind, chart.js, notyf): stale-while-revalidate
 * - Firebase/WhatsApp: network only (sem cache)
 */

var CACHE_VERSION = 'moneycontrol-v4';
var CACHE_NAME = CACHE_VERSION;

/* ============================================================
   ASSETS ESTATICOS PARA PRE-CACHE NO INSTALL
   ============================================================ */
var PRECACHE_ASSETS = [
  '/',
  '/index.html',
  '/login.html',
  '/registrar.html',
  '/config.html',
  '/gerenciamento.html',
  '/ajuda.html',
  '/css/global.css',
  '/css/style.css',
  '/css/overely.css',
  '/css/mobile.css',
  '/css/index-components.css',
  '/css/login.css',
  '/css/config.css',
  '/css/config-components.css',
  '/css/gerenciamento.css',
  '/css/pwa.css',
  '/js/main.js',
  '/js/script.js',
  '/js/configurações.js',
  '/js/gerenciamento.js',
  '/js/pwa.js',
  '/assets/logo.png',
  '/assets/icon-192.png',
  '/assets/icon-512.png',
  '/manifest.json'
];

/* ============================================================
   DOMINIOS QUE NUNCA DEVEM SER CACHEADOS
   ============================================================ */
var EXCLUDE_HOSTNAMES = [
  'firebaseio.com',
  'googleapis.com/colab',
  'whatsapp.com',
  'wa.me'
];

/* ============================================================
   HOSTNAME PARA NETWORK-ONLY (sem cache)
   ============================================================ */
var NETWORK_ONLY_HOSTNAMES = [
  'firebaseio.com',
  'firestore.googleapis.com',
  'identitytoolkit.googleapis.com'
];

/* ============================================================
   INSTALL - Pre-cache de assets essenciais
   ============================================================ */
self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(function (cache) {
        console.log('[SW] Pre-caching assets essenciais');
        return cache.addAll(PRECACHE_ASSETS).catch(function (err) {
          console.warn('[SW] Alguns assets falharam no pre-cache:', err);
          /* Continua mesmo com falhas parciais */
          return Promise.resolve();
        });
      })
      .then(function () {
        return self.skipWaiting();
      })
  );
});

/* ============================================================
   ACTIVATE - Limpa caches antigos
   ============================================================ */
self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys()
      .then(function (cacheNames) {
        return Promise.all(
          cacheNames
            .filter(function (name) {
              return name !== CACHE_NAME;
            })
            .map(function (name) {
              console.log('[SW] Removendo cache antigo:', name);
              return caches.delete(name);
            })
        );
      })
      .then(function () {
        /* Toma controle de todas as paginas abertas imediatamente */
        return self.clients.claim();
      })
  );
});

/* ============================================================
   FETCH - Estrategia de cache por tipo de requisicao
   ============================================================ */
self.addEventListener('fetch', function (event) {
  var request = event.request;
  var url = new URL(request.url);

  /* Apenas GET requests */
  if (request.method !== 'GET') return;

  /* Excluir dominios que nao devem ser cacheados */
  for (var i = 0; i < EXCLUDE_HOSTNAMES.length; i++) {
    if (url.hostname.includes(EXCLUDE_HOSTNAMES[i])) return;
  }

  /* Network-only para APIs do Firebase */
  for (var j = 0; j < NETWORK_ONLY_HOSTNAMES.length; j++) {
    if (url.hostname.includes(NETWORK_ONLY_HOSTNAMES[j])) {
      event.respondWith(fetch(request));
      return;
    }
  }

  /* Navegacao (requests de pagina): Network-first com fallback */
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then(function (response) {
          /* Salva uma copia no cache */
          var responseClone = response.clone();
          caches.open(CACHE_NAME).then(function (cache) {
            cache.put(request, responseClone);
          });
          return response;
        })
        .catch(function () {
          return caches.match(request).then(function (cached) {
            return cached || caches.match('/index.html');
          });
        })
    );
    return;
  }

  /* Assets estaticos locais: Cache-first */
  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.match(request).then(function (cached) {
        if (cached) return cached;

        return fetch(request).then(function (response) {
          if (response && response.status === 200) {
            var responseClone = response.clone();
            caches.open(CACHE_NAME).then(function (cache) {
              cache.put(request, responseClone);
            });
          }
          return response;
        });
      })
    );
    return;
  }

  /* CDN assets: Stale-while-revalidate */
  event.respondWith(
    caches.match(request).then(function (cached) {
      var networkFetch = fetch(request).then(function (response) {
        if (response && response.status === 200) {
          var responseClone = response.clone();
          caches.open(CACHE_NAME).then(function (cache) {
            cache.put(request, responseClone);
          });
        }
        return response;
      }).catch(function () {
        return cached;
      });

      return cached || networkFetch;
    })
  );
});

/* ============================================================
   MENSAGENS - Permite forcar atualizacao do cache
   ============================================================ */
self.addEventListener('message', function (event) {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }

  if (event.data && event.data.type === 'CLEAR_CACHE') {
    caches.keys().then(function (names) {
      return Promise.all(
        names.map(function (name) {
          return caches.delete(name);
        })
      );
    }).then(function () {
      self.clients.matchAll().then(function (clients) {
        clients.forEach(function (client) {
          client.postMessage({ type: 'CACHE_CLEARED' });
        });
      });
    });
  }
});
