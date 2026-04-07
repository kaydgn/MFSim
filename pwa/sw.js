// MFSim Service Worker
var CACHE_NAME = 'mfsim-v2';
var ASSETS = [
  './',
  '../MFSim_Code.html',
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
    })
  );
  self.clients.claim();
});

// Fetch: önce ağ, başarısızsa önbellek (network-first)
self.addEventListener('fetch', function(e) {
  // Sadece GET istekleri cache'lensin
  if(e.request.method !== 'GET') return;

  e.respondWith(
    fetch(e.request).then(function(response) {
      // Geçerli yanıtları önbelleğe kaydet
      if(response.status === 200) {
        var clone = response.clone();
        caches.open(CACHE_NAME).then(function(cache) {
          cache.put(e.request, clone);
        });
      }
      return response;
    }).catch(function() {
      // Ağ yoksa önbellekten sun
      return caches.match(e.request).then(function(cached) {
        return cached || new Response('Çevrimdışı — önbellekte bulunamadı.', {
          status: 503,
          headers: { 'Content-Type': 'text/plain; charset=utf-8' }
        });
      });
    })
  );
});
