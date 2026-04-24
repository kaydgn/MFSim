// MFSim Service Worker
// CACHE_NAME'deki __DEPLOY_SHA__ build sirasinda gen-version.js tarafindan
// gercek SHA ile degistirilir. Her deploy yeni cache adi → eski cache'ler
// activate'te temizlenir, tarayicilar yeni SW'yi otomatik tetikler.
var DEPLOY_SHA = '__DEPLOY_SHA__';
var CACHE_NAME = 'mfsim-' + DEPLOY_SHA;
var ASSETS = [
  './',
  './manifest.json',
  './icon.svg'
];

// Yükleme: temel dosyaları önbelleğe al
self.addEventListener('install', function(e) {
  e.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      return cache.addAll(ASSETS);
    })
  );
  self.skipWaiting();
});

// Aktivasyon: eski önbellekleri temizle
self.addEventListener('activate', function(e) {
  e.waitUntil(
    caches.keys().then(function(names) {
      return Promise.all(
        names.filter(function(n) { return n !== CACHE_NAME; })
             .map(function(n) { return caches.delete(n); })
      );
    }).then(function() { return self.clients.claim(); })
  );
});

// Sayfadan gelen 'SKIP_WAITING' mesajina yanit ver (yeni SW'yi hemen aktive et)
self.addEventListener('message', function(e) {
  if(e.data && e.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// Fetch: version.json her zaman ağ; diğerleri network-first, fallback cache
self.addEventListener('fetch', function(e) {
  if(e.request.method !== 'GET') return;

  // version.json bayat donmesin — network-only, cache'leme
  if(e.request.url.indexOf('version.json') !== -1) {
    e.respondWith(fetch(e.request).catch(function() {
      return new Response('{}', { status: 503, headers: { 'Content-Type': 'application/json' } });
    }));
    return;
  }

  e.respondWith(
    fetch(e.request).then(function(response) {
      if(response.status === 200) {
        var clone = response.clone();
        caches.open(CACHE_NAME).then(function(cache) {
          cache.put(e.request, clone);
        });
      }
      return response;
    }).catch(function() {
      return caches.match(e.request).then(function(cached) {
        return cached || new Response('Çevrimdışı — önbellekte bulunamadı.', {
          status: 503,
          headers: { 'Content-Type': 'text/plain; charset=utf-8' }
        });
      });
    })
  );
});
