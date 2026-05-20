// ============================================================================
// MFSim FEA — TetGen WASM SARMALAYICI
// ============================================================================
// TetGen 1.6.0 (Hang Si, AGPL-3.0) tabanlı Constrained Delaunay tetrahedral
// mesher. STEP/triangulated surface → solver-uygun tet4 mesh.
//
// LİSANS UYARISI: TetGen AGPL-3.0. Bu modül yüklenip kullanıldığında MFSim
// dağıtımı AGPL yükümlülüklerine tabidir. Detay: vendor/tetgen/NOTICE.md
//
// Yükleme stratejisi (fea-solver-wasm.js ile aynı pattern):
//   - Monolitik build: window.__feaInline.tetgenScript / tetgenWasm (base64)
//   - Dev modu:        vendor/tetgen/tetgen-wasm.{js,wasm} (lazy fetch)
//   - WASM derlenmemişse: graceful unavailable — fea-mesh.js voxel'a düşer.
//
// Public API:
//   veFEATetgenIsBuilt()       → boolean (WASM kaynağı var mı?)
//   veFEATetgenEnsureWasm()    → Promise<Module> (yükle ve döndür)
//   veFEATetgenTetrahedralize(parsed, opts) → Promise<{nodes,elements,nodesPerElement,error?,info}>
//
// Giriş formatı (parsed):
//   { vertices: Float32Array (3*N), triangleCount: M }
//     vertices her 3 elemanı 1 vertex (XYZ); her ardışık 3 vertex 1 üçgen.
//     (fea-mesh.js'in _veFEAParseSurfaceTriangles çıktısıyla uyumlu.)
//
// Çıkış formatı: { type:'tet4', nodes:Float32Array, elements:Uint32Array,
//                  nodesPerElement:4, info:{...} }
// ============================================================================

var VE_FEA_TETGEN_STATE = { module: null, loading: null };

// WASM kaynak adresi (kaynak yoksa null döner — fea-mesh.js bunu sayar).
function _veFEATetgenScriptSource() {
  if (typeof window !== 'undefined' && window.__feaInline && window.__feaInline.tetgenScript) {
    return { kind: 'inline', source: window.__feaInline.tetgenScript };
  }
  return { kind: 'url', source: 'vendor/tetgen/tetgen-wasm.js' };
}

function _veFEATetgenWasmBinaryUrl() {
  if (typeof window === 'undefined') return null;
  if (window.__feaInline && window.__feaInline.tetgenWasm) {
    var b64 = window.__feaInline.tetgenWasm;
    var binary = (typeof atob === 'function') ? atob(b64) : Buffer.from(b64, 'base64').toString('binary');
    var bytes = new Uint8Array(binary.length);
    for (var i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return URL.createObjectURL(new Blob([bytes], { type: 'application/wasm' }));
  }
  return 'vendor/tetgen/tetgen-wasm.wasm';
}

// Senkron kontrol: WASM modülü yüklenebilir durumda mı? (UI'da göstermek için)
function veFEATetgenIsBuilt() {
  if (typeof window === 'undefined') return false;
  if (window.__feaInline && window.__feaInline.tetgenScript && window.__feaInline.tetgenWasm) {
    return true;
  }
  // Dev modunda: vendor/tetgen/tetgen-wasm.js dosya kontrolü async; UI için
  // false varsayıyoruz. Gerçek yükleme veFEATetgenEnsureWasm() ile denenir.
  return false;
}

// Diagnostic: kullanıcı F12 console'dan TetGen durumunu çağırabilir.
// Cache problemleri / yanlış HTML versiyonu / dev modu için tanı.
function veFEATetgenDiagnose() {
  var d = { hasWindow: typeof window !== 'undefined', inline: {}, isBuilt: false };
  if (typeof window !== 'undefined' && window.__feaInline) {
    d.inline.hasScript = !!window.__feaInline.tetgenScript;
    d.inline.hasWasm = !!window.__feaInline.tetgenWasm;
    if (window.__feaInline.tetgenScript) d.inline.scriptLen = window.__feaInline.tetgenScript.length;
    if (window.__feaInline.tetgenWasm) d.inline.wasmB64Len = window.__feaInline.tetgenWasm.length;
  }
  d.isBuilt = veFEATetgenIsBuilt();
  d.mode = (d.inline.hasScript && d.inline.hasWasm) ? 'monolitik (inline)' : 'dev (vendor/tetgen/*)';
  if (typeof console !== 'undefined') {
    console.log('[TetGen] Tanı:', d);
    if (!d.isBuilt) {
      console.warn('[TetGen] WASM bulunamadı. Olası nedenler:');
      console.warn('  1) Tarayıcı önbelleği eski HTML\'i gösteriyor → Ctrl+Shift+R');
      console.warn('  2) MFSim_Code.html güncel değil → "npm run build" çalıştır');
      console.warn('  3) Dev modunda index.html açtınız ama vendor/tetgen/*.wasm yok → "npm run build:wasm:tetgen"');
    }
  }
  return d;
}

// Init-time tanı: yüklendiğinde otomatik bir kez console'a yaz (sessizce
// monolitik build için OK durumu da loglar — kullanıcı F12'de görebilsin).
if (typeof window !== 'undefined' && typeof console !== 'undefined') {
  var _veFEATetgenBuilt = veFEATetgenIsBuilt();
  console.info('[TetGen] WASM ' + (_veFEATetgenBuilt ? 'HAZIR (inline)' : 'YOK (voxel fallback aktif)') +
    ' — detay: veFEATetgenDiagnose()');
}

function _veFEATetgenLoadScript(src, isBlobUrl) {
  return new Promise(function(resolve, reject) {
    if (typeof document === 'undefined') {
      reject(new Error('document yok — Worker/Node ortamında doğrudan require/importScripts kullanın'));
      return;
    }
    var script = document.createElement('script');
    script.src = src;
    script.onload = function() {
      if (isBlobUrl) URL.revokeObjectURL(src);
      if (typeof TetgenWasmModule === 'undefined') {
        reject(new Error('TetGen glue yüklendi ama TetgenWasmModule global tanımlı değil'));
      } else {
        resolve();
      }
    };
    script.onerror = function() { reject(new Error('TetGen glue yüklenemedi: ' + src)); };
    document.head.appendChild(script);
  });
}

function _veFEATetgenEnsureScript() {
  if (typeof TetgenWasmModule !== 'undefined') return Promise.resolve();
  var src = _veFEATetgenScriptSource();
  if (src.kind === 'inline') {
    var url = URL.createObjectURL(new Blob([src.source], { type: 'application/javascript' }));
    return _veFEATetgenLoadScript(url, true).catch(function() {
      try { (0, eval)(src.source); return Promise.resolve(); }
      catch (e) { return Promise.reject(e); }
    });
  }
  return _veFEATetgenLoadScript(src.source, false);
}

// Ana giriş: TetGen WASM modülünü hazır halde döner.
function veFEATetgenEnsureWasm() {
  if (VE_FEA_TETGEN_STATE.module) return Promise.resolve(VE_FEA_TETGEN_STATE.module);
  if (VE_FEA_TETGEN_STATE.loading) return VE_FEA_TETGEN_STATE.loading;

  VE_FEA_TETGEN_STATE.loading = _veFEATetgenEnsureScript().then(function() {
    var wasmUrl = _veFEATetgenWasmBinaryUrl();
    return TetgenWasmModule({
      locateFile: function(p) {
        return /\.wasm$/i.test(p) ? wasmUrl : p;
      }
    });
  }).then(function(mod) {
    VE_FEA_TETGEN_STATE.module = mod;
    VE_FEA_TETGEN_STATE.loading = null;
    return mod;
  }).catch(function(err) {
    VE_FEA_TETGEN_STATE.loading = null;
    throw err;
  });

  return VE_FEA_TETGEN_STATE.loading;
}

// ─── Vertex de-duplication ──────────────────────────────────────────────────
// fea-step.js / _veFEAParseSurfaceTriangles çıktısı triangle-soup formatında:
// her üçgen 3 ardışık (paylaşılmamış) vertex. TetGen ise indeksli PLC bekler.
// Spatial hash ile O(N) merge.
function _veFEATetgenDeduplicateVertices(verts, triangleCount) {
  var N = triangleCount * 3;
  // Bounding box (epsilon ölçeği için)
  var minX = Infinity, minY = Infinity, minZ = Infinity;
  var maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
  for (var i = 0; i < verts.length; i += 3) {
    var x = verts[i], y = verts[i + 1], z = verts[i + 2];
    if (x < minX) minX = x; if (x > maxX) maxX = x;
    if (y < minY) minY = y; if (y > maxY) maxY = y;
    if (z < minZ) minZ = z; if (z > maxZ) maxZ = z;
  }
  var dia = Math.max(maxX - minX, maxY - minY, maxZ - minZ);
  // Birleşme eşiği: diagonal'in 1e-6 katı (mm ölçeğinde nm hassasiyet).
  // Daha sıkı eşik degenerate vertex'leri ayrı tutar; daha gevşek eşik
  // farklı feature'ları yanlışlıkla birleştirir.
  var eps = Math.max(1e-9, dia * 1e-6);
  var invEps = 1 / eps;

  var map = new Map();  // key (string) → newIndex
  var uniqueCoords = [];
  var newIndices = new Int32Array(N);

  function key(x, y, z) {
    // Snap to grid, build sortable string key
    var ix = Math.round(x * invEps);
    var iy = Math.round(y * invEps);
    var iz = Math.round(z * invEps);
    return ix + '|' + iy + '|' + iz;
  }

  for (var v = 0; v < N; v++) {
    var px = verts[v * 3], py = verts[v * 3 + 1], pz = verts[v * 3 + 2];
    var k = key(px, py, pz);
    var existing = map.get(k);
    if (existing !== undefined) {
      newIndices[v] = existing;
    } else {
      var newIdx = uniqueCoords.length / 3;
      map.set(k, newIdx);
      uniqueCoords.push(px, py, pz);
      newIndices[v] = newIdx;
    }
  }
  return {
    points: new Float64Array(uniqueCoords),  // TetGen REAL = double
    pointCount: uniqueCoords.length / 3,
    triangles: newIndices,                   // 3*triangleCount entries
    triangleCount: triangleCount,
    epsilon: eps
  };
}

// ─── Ana giriş: tetrahedralize ──────────────────────────────────────────────
// opts:
//   quality:           true → "q1.4", false → düz CDT (default: true)
//   radiusEdgeRatio:   default 1.4 (TetGen önerisi; 1.0 daha sıkı, 2.0 daha gevşek)
//   maxVolume:         null veya pozitif sayı (tek tet için maks hacim, mm³)
//   verbose:           true → console.log (default: false)
//   tolerance:         coplanar tespit eşiği (default: 1e-10, geometri ölçeğine
//                       göre TetGen kendisi normalize eder)
//   noBoundarySteiner: true → "Y" (sınırda Steiner ekleme yok; yüzey değişmez)
function veFEATetgenTetrahedralize(parsed, opts) {
  opts = opts || {};
  if (!parsed || !parsed.vertices || parsed.triangleCount <= 0) {
    return Promise.resolve({ error: 'parsed boş veya geçersiz' });
  }

  return veFEATetgenEnsureWasm().then(function(Module) {
    // 1) Vertex deduplication
    var dedup = _veFEATetgenDeduplicateVertices(parsed.vertices, parsed.triangleCount);
    if (opts.verbose) {
      console.log('[TetGen] Dedup: ' + (parsed.triangleCount * 3) + ' → ' +
                  dedup.pointCount + ' unique vertices');
    }

    // 2) Switch string oluştur
    var sw = 'pQ';  // p=PLC, Q=quiet
    if (opts.quality !== false) {
      var r = (typeof opts.radiusEdgeRatio === 'number') ? opts.radiusEdgeRatio : 1.4;
      sw += 'q' + r;
    }
    if (typeof opts.maxVolume === 'number' && opts.maxVolume > 0) {
      sw += 'a' + opts.maxVolume;
    }
    if (opts.noBoundarySteiner === true) {
      sw += 'Y';
    }
    if (typeof opts.tolerance === 'number' && opts.tolerance > 0) {
      sw += 'T' + opts.tolerance;
    }

    if (opts.verbose) console.log('[TetGen] switches=' + sw);

    // 3) Heap'e veri kopyala
    var pointBytes = dedup.pointCount * 3 * 8;     // double = 8 bytes
    var triBytes   = dedup.triangleCount * 3 * 4;  // int    = 4 bytes
    var swBytes    = sw.length + 1;                // null-terminated UTF-8

    var pPoints = Module._malloc(pointBytes);
    var pTris   = Module._malloc(triBytes);
    var pSw     = Module._malloc(swBytes);
    if (!pPoints || !pTris || !pSw) {
      if (pPoints) Module._free(pPoints);
      if (pTris) Module._free(pTris);
      if (pSw) Module._free(pSw);
      return { error: 'malloc başarısız (geometri çok büyük olabilir)' };
    }

    Module.HEAPF64.set(dedup.points, pPoints >> 3);
    Module.HEAP32.set(dedup.triangles, pTris >> 2);
    for (var ci = 0; ci < sw.length; ci++) {
      Module.HEAPU8[pSw + ci] = sw.charCodeAt(ci);
    }
    Module.HEAPU8[pSw + sw.length] = 0;

    // 4) Çağrı
    var handle = 0;
    var t0 = (typeof performance !== 'undefined') ? performance.now() : Date.now();
    try {
      handle = Module.ccall(
        'tetgen_tetrahedralize', 'number',
        ['number', 'number', 'number', 'number', 'number'],
        [pPoints, dedup.pointCount, pTris, dedup.triangleCount, pSw]
      );
    } finally {
      Module._free(pPoints);
      Module._free(pTris);
      Module._free(pSw);
    }
    var dt = ((typeof performance !== 'undefined') ? performance.now() : Date.now()) - t0;

    if (handle === 0) {
      var errPtr = Module.ccall('tetgen_last_error', 'number', [], []);
      var errMsg = Module.UTF8ToString(errPtr);
      return { error: 'TetGen başarısız: ' + (errMsg || 'bilinmeyen hata') };
    }

    // 5) Çıktıyı oku
    try {
      var outPoints = Module.ccall('tetgen_out_point_count', 'number', ['number'], [handle]);
      var outTets   = Module.ccall('tetgen_out_tet_count',   'number', ['number'], [handle]);
      var npt       = Module.ccall('tetgen_out_nodes_per_tet','number', ['number'], [handle]);
      var pNodes    = Module.ccall('tetgen_out_points',      'number', ['number'], [handle]);
      var pElems    = Module.ccall('tetgen_out_tets',        'number', ['number'], [handle]);

      if (outPoints <= 0 || outTets <= 0 || npt !== 4) {
        return { error: 'TetGen çıktısı geçersiz (points=' + outPoints +
                ', tets=' + outTets + ', nodesPerTet=' + npt + ')' };
      }

      // HEAPF64 / HEAP32'ten KOPYA al — Module belleği shrink edilirse view bozulur
      var nodesF32 = new Float32Array(outPoints * 3);
      var heapDouble = Module.HEAPF64;
      var srcOff = pNodes >> 3;
      for (var ni = 0; ni < outPoints * 3; ni++) {
        nodesF32[ni] = heapDouble[srcOff + ni];
      }
      var elemsU32 = new Uint32Array(outTets * 4);
      var heap32 = Module.HEAP32;
      var elemOff = pElems >> 2;
      for (var ei = 0; ei < outTets * 4; ei++) {
        elemsU32[ei] = heap32[elemOff + ei];
      }

      return {
        type: 'tet4',
        geometryType: 'tetgen',
        nodes: nodesF32,
        elements: elemsU32,
        nodesPerElement: 4,
        info: {
          inputPoints: dedup.pointCount,
          inputTriangles: dedup.triangleCount,
          outputNodes: outPoints,
          outputTets: outTets,
          steinerAdded: outPoints - dedup.pointCount,
          switches: sw,
          durationMs: dt
        }
      };
    } finally {
      Module.ccall('tetgen_free', null, ['number'], [handle]);
    }
  }).catch(function(err) {
    return { error: 'TetGen yüklenemedi: ' + (err && err.message ? err.message : err) };
  });
}

// CommonJS export (Jest test ortamı için)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    veFEATetgenIsBuilt: veFEATetgenIsBuilt,
    veFEATetgenDiagnose: veFEATetgenDiagnose,
    veFEATetgenEnsureWasm: veFEATetgenEnsureWasm,
    veFEATetgenTetrahedralize: veFEATetgenTetrahedralize,
    _veFEATetgenDeduplicateVertices: _veFEATetgenDeduplicateVertices
  };
}
