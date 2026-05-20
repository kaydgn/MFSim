// ============================================================================
// FEA MESH WORKER
// ============================================================================
// Mesh hesaplamasını arka planda (UI thread'ini bloke etmeden) yürütür.
// Büyük mesh'ler (>100k eleman) için UI rendaring donmaz.
//
// Dependencies: importScripts ile fea-primitives, fea-step, delaunay bundle,
// fea-delaunay, fea-mesh yüklenir. Aynı global API'ı (veFEAMeshFromGeometry).
//
// Mesaj formatı:
//   IN:  { type: 'meshFromGeometry', requestId, geometry, opts }
//   OUT: { type: 'meshResult', requestId, result }
//        { type: 'meshError',  requestId, error }
// ============================================================================

// Worker context'te document/window yok → grafik fonksiyonları (Three.js)
// disabled. veFEAMeshFromGeometry pure data işliyor, sorun yok.
try {
  importScripts('fea-primitives.js', 'fea-step.js', '../vendor/delaunay/delaunay-bundle.js',
                'fea-delaunay.js', 'fea-mesh.js');
} catch (e) {
  // importScripts yoluyla hata olursa mesh request'leri error verir
  self._VE_FEA_WORKER_INIT_ERROR = e.message || String(e);
}

self.onmessage = function(e) {
  var msg = e.data;
  if (!msg || !msg.type) return;
  if (msg.type !== 'meshFromGeometry') return;

  if (self._VE_FEA_WORKER_INIT_ERROR) {
    self.postMessage({
      type: 'meshError',
      requestId: msg.requestId,
      error: 'Worker init error: ' + self._VE_FEA_WORKER_INIT_ERROR
    });
    return;
  }

  try {
    var t0 = Date.now();
    var result;
    // STEP async ise wrapper kullan, değilse sync
    if (msg.geometry && msg.geometry.type === 'step' && typeof veFEAMeshFromGeometryAsync === 'function') {
      veFEAMeshFromGeometryAsync(msg.geometry, msg.opts).then(function(r) {
        self.postMessage({
          type: 'meshResult',
          requestId: msg.requestId,
          result: r,
          computeMs: Date.now() - t0
        });
      }).catch(function(err) {
        self.postMessage({
          type: 'meshError',
          requestId: msg.requestId,
          error: err.message || String(err)
        });
      });
      return;
    }
    result = veFEAMeshFromGeometry(msg.geometry, msg.opts);
    self.postMessage({
      type: 'meshResult',
      requestId: msg.requestId,
      result: result,
      computeMs: Date.now() - t0
    });
  } catch (err) {
    self.postMessage({
      type: 'meshError',
      requestId: msg.requestId,
      error: err.message || String(err)
    });
  }
};
