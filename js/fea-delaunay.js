// ============================================================================
// MFSim FEA — DELAUNAY TET MESHER (saf JS)
// ============================================================================
// Mikola Lysenko'nun delaunay-triangulate (MIT) paketini kullanan incremental
// Bowyer-Watson 3D Delaunay tetrahedral mesher. Robust adaptive predicates ile
// dejenere durumlara dayanıklı.
//
// Strateji:
//   1. Vertex de-duplication (triangle-soup → unique points)
//   2. Opsiyonel iç-nokta sampling (octree-based, mesh kalitesini artırır)
//   3. Delaunay tetrahedralization (vendor/delaunay/delaunay-bundle.js)
//   4. Parity-test ile içeride/dışarıda sınıflandırma (ray cast üçgenlere)
//   5. Dış tet'leri ele, geri kalanı MFSim mesh formatında döndür
//
// Public API:
//   veFEADelaunayAvailable()                           → boolean
//   veFEADelaunayTetrahedralize(parsed, opts)          → Promise<mesh|{error}>
//
// Bağımlılık: window.veFEADelaunayTriangulate (vendor/delaunay/delaunay-bundle.js)
//   tarafından sağlanan, [[x,y,z], ...] → [[i,j,k,l], ...] fonksiyonu.
//
// Lisans: MIT (Mikola Lysenko). MFSim'in ISC lisansı ile uyumlu.
//   Detay: vendor/delaunay/NOTICE.md
// ============================================================================

// Senkron kontrol: Delaunay kütüphanesi yüklenmiş mi?
function veFEADelaunayAvailable() {
  if (typeof window !== 'undefined' && typeof window.veFEADelaunayTriangulate === 'function') {
    return true;
  }
  if (typeof global !== 'undefined' && typeof global.veFEADelaunayTriangulate === 'function') {
    return true;
  }
  return false;
}

function _veFEADelaunayGetTriangulator() {
  if (typeof window !== 'undefined' && typeof window.veFEADelaunayTriangulate === 'function') {
    return window.veFEADelaunayTriangulate;
  }
  if (typeof global !== 'undefined' && typeof global.veFEADelaunayTriangulate === 'function') {
    return global.veFEADelaunayTriangulate;
  }
  return null;
}

// Diagnostic — F12 console'dan durum raporu
function veFEADelaunayDiagnose() {
  var d = {
    available: veFEADelaunayAvailable(),
    triangulatorType: typeof (_veFEADelaunayGetTriangulator())
  };
  if (typeof console !== 'undefined') {
    console.log('[Delaunay]', d);
  }
  return d;
}

// ─── Vertex de-duplication ──────────────────────────────────────────────────
// fea-step.js / _veFEAParseSurfaceTriangles çıktısı triangle-soup formatında:
// her üçgen 3 ardışık (paylaşılmamış) vertex. Delaunay ise paylaşımlı nokta
// kümesi bekler. Spatial hash ile O(N) merge.
function _veFEADelaunayDedupVertices(verts, triangleCount) {
  var N = triangleCount * 3;
  var minX = Infinity, minY = Infinity, minZ = Infinity;
  var maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
  for (var i = 0; i < verts.length; i += 3) {
    var x = verts[i], y = verts[i + 1], z = verts[i + 2];
    if (x < minX) minX = x; if (x > maxX) maxX = x;
    if (y < minY) minY = y; if (y > maxY) maxY = y;
    if (z < minZ) minZ = z; if (z > maxZ) maxZ = z;
  }
  var dia = Math.max(maxX - minX, maxY - minY, maxZ - minZ);
  var eps = Math.max(1e-9, dia * 1e-6);
  var invEps = 1 / eps;

  var map = new Map();
  var uniqueCoords = [];
  var newIndices = new Int32Array(N);

  for (var v = 0; v < N; v++) {
    var px = verts[v * 3], py = verts[v * 3 + 1], pz = verts[v * 3 + 2];
    var k = Math.round(px * invEps) + '|' + Math.round(py * invEps) + '|' + Math.round(pz * invEps);
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
    coords: uniqueCoords,         // [x0,y0,z0, x1,y1,z1, ...]
    pointCount: uniqueCoords.length / 3,
    triangles: newIndices,        // 3*triangleCount entries
    triangleCount: triangleCount,
    bbox: { minX: minX, maxX: maxX, minY: minY, maxY: maxY, minZ: minZ, maxZ: maxZ },
    epsilon: eps
  };
}

// ─── Octree-tabanlı iç nokta sampling ──────────────────────────────────────
// Sadece boundary noktalarını Delaunay yapmak iç hücrelerin Steiner-eksik
// kalitesizliğine yol açar. Bbox grid'ine eşit aralıklı iç noktalar ekleyip
// her birinin parite testi ile içeride olduğundan emin oluruz.
function _veFEADelaunayAddInteriorPoints(dedup, parsed, opts) {
  var size = opts.targetSize;
  var b = dedup.bbox;
  var nx = Math.max(2, Math.ceil((b.maxX - b.minX) / size));
  var ny = Math.max(2, Math.ceil((b.maxY - b.minY) / size));
  var nz = Math.max(2, Math.ceil((b.maxZ - b.minZ) / size));
  // Çok yoğun grid'i kırp — interior point sayısı boundary point sayısının
  // 5-10 katından fazla olmasın (Delaunay maliyeti O(n log n)).
  var maxInt = Math.min(200000, dedup.pointCount * 8);
  if (nx * ny * nz > maxInt) {
    var k = Math.cbrt(maxInt / (nx * ny * nz));
    nx = Math.max(2, Math.floor(nx * k));
    ny = Math.max(2, Math.floor(ny * k));
    nz = Math.max(2, Math.floor(nz * k));
  }
  var dx = (b.maxX - b.minX) / nx;
  var dy = (b.maxY - b.minY) / ny;
  var dz = (b.maxZ - b.minZ) / nz;

  // Üçgenleri Y-Z bin'leyerek ray cast hızlandır
  var verts = parsed.vertices;
  var triCount = parsed.triangleCount;
  var triBuckets = new Array(ny);
  for (var j = 0; j < ny; j++) triBuckets[j] = [];
  for (var t = 0; t < triCount; t++) {
    var off = t * 9;
    var y1 = verts[off + 1], y2 = verts[off + 4], y3 = verts[off + 7];
    var triMinY = Math.min(y1, y2, y3);
    var triMaxY = Math.max(y1, y2, y3);
    var jMin = Math.max(0, Math.floor((triMinY - b.minY) / dy));
    var jMax = Math.min(ny - 1, Math.floor((triMaxY - b.minY) / dy));
    for (var jj = jMin; jj <= jMax; jj++) triBuckets[jj].push(t);
  }

  var offY = dy * 0.001337;  // küçük asal offsetler (vertex/edge'lere denk gelmesin)
  var offZ = dz * 0.002473;
  var addedX = [], addedY = [], addedZ = [];

  for (var k2 = 1; k2 < nz; k2++) {
    var rayZ = b.minZ + (k2 + 0.5) * dz + offZ;
    for (var j2 = 1; j2 < ny; j2++) {
      var rayY = b.minY + (j2 + 0.5) * dy + offY;
      var bucket = triBuckets[j2];
      // Her ray için kesişimleri topla
      var hits = [];
      for (var bi = 0; bi < bucket.length; bi++) {
        var ti = bucket[bi];
        var o2 = ti * 9;
        var x1 = verts[o2],     y1b = verts[o2 + 1], z1 = verts[o2 + 2];
        var x2 = verts[o2 + 3], y2b = verts[o2 + 4], z2 = verts[o2 + 5];
        var x3 = verts[o2 + 6], y3b = verts[o2 + 7], z3 = verts[o2 + 8];
        var triMinZ = Math.min(z1, z2, z3);
        var triMaxZ = Math.max(z1, z2, z3);
        if (rayZ < triMinZ || rayZ > triMaxZ) continue;
        var area = (y2b - y1b) * (z3 - z1) - (z2 - z1) * (y3b - y1b);
        if (Math.abs(area) < 1e-14) continue;
        var l1 = ((y2b - rayY) * (z3  - rayZ) - (z2  - rayZ) * (y3b - rayY)) / area;
        var l2 = ((y3b - rayY) * (z1  - rayZ) - (z3  - rayZ) * (y1b - rayY)) / area;
        var l3 = 1 - l1 - l2;
        if (l1 < -1e-9 || l2 < -1e-9 || l3 < -1e-9) continue;
        var hitX = l1 * x1 + l2 * x2 + l3 * x3;
        hits.push(hitX);
      }
      hits.sort(function(a, b) { return a - b; });

      // Parity'ye göre noktaları işaretle
      var hitIdx = 0;
      var insideFlag = false;
      for (var i2 = 1; i2 < nx; i2++) {
        var voxX = b.minX + (i2 + 0.5) * dx;
        while (hitIdx < hits.length && hits[hitIdx] < voxX) {
          insideFlag = !insideFlag;
          hitIdx++;
        }
        if (insideFlag) {
          addedX.push(voxX);
          addedY.push(rayY);
          addedZ.push(rayZ);
        }
      }
    }
  }
  // Sınıra çok yakın noktaları ele (degenerate tet'lere yol açar). Eşik:
  // grid hücre boyutu × 0.15 — daha yakın noktalar zaten boundary node'larıyla
  // birleşebilir.
  // (Şimdilik atla — ileride gerek olursa eklenir.)

  // dedup.coords'a ekle
  var origCount = dedup.coords.length / 3;
  for (var ai = 0; ai < addedX.length; ai++) {
    dedup.coords.push(addedX[ai], addedY[ai], addedZ[ai]);
  }
  dedup.interiorAdded = addedX.length;
  dedup.pointCount = dedup.coords.length / 3;
  return dedup;
}

// ─── Parity test: tet centroid'i içeride mi? ────────────────────────────────
// Her tet'in centroid'inden +X yönünde ışın at; parsed triangle'lara kesişim
// sayısı tek ise içeride, çift ise dışarıda. Aynı bin'leme ile hızlı.
function _veFEADelaunayClassifyTets(tets, points, parsed) {
  var v = parsed.vertices;
  var triCount = parsed.triangleCount;
  if (triCount === 0) return new Uint8Array(tets.length);
  var minX = Infinity, minY = Infinity, minZ = Infinity;
  var maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
  for (var p = 0; p < v.length; p += 3) {
    if (v[p]   < minX) minX = v[p];   if (v[p]   > maxX) maxX = v[p];
    if (v[p+1] < minY) minY = v[p+1]; if (v[p+1] > maxY) maxY = v[p+1];
    if (v[p+2] < minZ) minZ = v[p+2]; if (v[p+2] > maxZ) maxZ = v[p+2];
  }
  var bins = Math.max(8, Math.min(64, Math.round(Math.cbrt(triCount))));
  var by = (maxY - minY) / bins;
  if (by <= 0) by = 1;

  // Üçgenleri Y-bucket'le
  var triBuckets = new Array(bins);
  for (var j = 0; j < bins; j++) triBuckets[j] = [];
  for (var t = 0; t < triCount; t++) {
    var off = t * 9;
    var y1 = v[off + 1], y2 = v[off + 4], y3 = v[off + 7];
    var triMinY = Math.min(y1, y2, y3);
    var triMaxY = Math.max(y1, y2, y3);
    var jMin = Math.max(0, Math.floor((triMinY - minY) / by));
    var jMax = Math.min(bins - 1, Math.floor((triMaxY - minY) / by));
    for (var jj = jMin; jj <= jMax; jj++) triBuckets[jj].push(t);
  }

  var inside = new Uint8Array(tets.length);
  for (var ti = 0; ti < tets.length; ti++) {
    var tet = tets[ti];
    // Centroid
    var cx = 0, cy = 0, cz = 0;
    for (var k = 0; k < 4; k++) {
      var pIdx = tet[k] * 3;
      cx += points[pIdx]; cy += points[pIdx + 1]; cz += points[pIdx + 2];
    }
    cx /= 4; cy /= 4; cz /= 4;

    // BBox'ın dışındaysa dışarıda
    if (cx < minX || cx > maxX || cy < minY || cy > maxY || cz < minZ || cz > maxZ) {
      inside[ti] = 0;
      continue;
    }

    // +X yönünde ışın at — parite test
    var jBin = Math.max(0, Math.min(bins - 1, Math.floor((cy - minY) / by)));
    var bucket = triBuckets[jBin];
    var hits = 0;
    for (var bi = 0; bi < bucket.length; bi++) {
      var tid = bucket[bi];
      var o2 = tid * 9;
      var x1 = v[o2],     y1b = v[o2 + 1], z1 = v[o2 + 2];
      var x2 = v[o2 + 3], y2b = v[o2 + 4], z2 = v[o2 + 5];
      var x3 = v[o2 + 6], y3b = v[o2 + 7], z3 = v[o2 + 8];
      // Y-Z düzleminde nokta üçgenin içinde mi?
      var area = (y2b - y1b) * (z3 - z1) - (z2 - z1) * (y3b - y1b);
      if (Math.abs(area) < 1e-14) continue;
      var l1 = ((y2b - cy) * (z3  - cz) - (z2  - cz) * (y3b - cy)) / area;
      var l2 = ((y3b - cy) * (z1  - cz) - (z3  - cz) * (y1b - cy)) / area;
      var l3 = 1 - l1 - l2;
      if (l1 < 0 || l2 < 0 || l3 < 0) continue;
      var hitX = l1 * x1 + l2 * x2 + l3 * x3;
      if (hitX > cx) hits++;
    }
    inside[ti] = (hits & 1);
  }
  return inside;
}

// ─── Ana giriş: tetrahedralize ──────────────────────────────────────────────
// opts:
//   targetSize:      iç-nokta sampling grid boyutu (mm). Default: 10
//   addInteriorPoints: true → iç noktalar ekle (kalite ↑), false → sadece
//                      boundary noktalar (hızlı ama kalite ↓). Default: true
//   verbose:         konsola süre/sayı bilgisi
// Promise<{type:'tet4', nodes:Float32Array, elements:Uint32Array, ...} | {error}>
function veFEADelaunayTetrahedralize(parsed, opts) {
  opts = opts || {};
  return new Promise(function(resolve) {
    if (!parsed || !parsed.vertices || parsed.triangleCount <= 0) {
      resolve({ error: 'parsed boş veya geçersiz' });
      return;
    }
    var triangulate = _veFEADelaunayGetTriangulator();
    if (!triangulate) {
      resolve({ error: 'Delaunay kütüphanesi yüklenmemiş (vendor/delaunay/delaunay-bundle.js)' });
      return;
    }
    var t0 = (typeof performance !== 'undefined') ? performance.now() : Date.now();

    var dedup = _veFEADelaunayDedupVertices(parsed.vertices, parsed.triangleCount);

    // İç-nokta sampling (kalite için)
    if (opts.addInteriorPoints !== false) {
      var sz = (typeof opts.targetSize === 'number' && opts.targetSize > 0) ? opts.targetSize : 10;
      _veFEADelaunayAddInteriorPoints(dedup, parsed, { targetSize: sz });
    }

    if (opts.verbose) {
      console.log('[Delaunay] Noktalar: ' + (parsed.triangleCount * 3) + ' (soup) → ' +
                  dedup.pointCount + ' (unique + interior ' + (dedup.interiorAdded || 0) + ')');
    }

    // Noktaları [[x,y,z], ...] formatına çevir
    var pts = new Array(dedup.pointCount);
    for (var i = 0; i < dedup.pointCount; i++) {
      pts[i] = [dedup.coords[i*3], dedup.coords[i*3+1], dedup.coords[i*3+2]];
    }

    var tets;
    try {
      tets = triangulate(pts);
    } catch (e) {
      resolve({ error: 'Delaunay triangulate exception: ' + (e.message || e) });
      return;
    }
    if (!tets || tets.length === 0) {
      resolve({ error: 'Delaunay 0 tet üretti (geometri yetersiz mi?)' });
      return;
    }

    // İçeride/dışarıda sınıflandırma — parite testi
    var inside = _veFEADelaunayClassifyTets(tets, dedup.coords, parsed);
    var keptCount = 0;
    for (var ki = 0; ki < inside.length; ki++) if (inside[ki]) keptCount++;
    if (keptCount === 0) {
      resolve({ error: 'Parite testi tüm tet\'leri dış olarak işaretledi (yüzey kapalı mı?)' });
      return;
    }

    // Sonuç buffers
    var elemsU32 = new Uint32Array(keptCount * 4);
    var wp = 0;
    for (var ti = 0; ti < tets.length; ti++) {
      if (!inside[ti]) continue;
      var tet = tets[ti];
      elemsU32[wp++] = tet[0];
      elemsU32[wp++] = tet[1];
      elemsU32[wp++] = tet[2];
      elemsU32[wp++] = tet[3];
    }
    // Düğümleri compact'la — referans verilmeyen interior point'leri ele
    var refCount = new Uint8Array(dedup.pointCount);
    for (var ei = 0; ei < elemsU32.length; ei++) refCount[elemsU32[ei]] = 1;
    var remap = new Int32Array(dedup.pointCount);
    var newPointCount = 0;
    var nodesF32 = new Float32Array(dedup.pointCount * 3);  // üst sınır
    for (var pi = 0; pi < dedup.pointCount; pi++) {
      if (!refCount[pi]) { remap[pi] = -1; continue; }
      remap[pi] = newPointCount;
      nodesF32[newPointCount * 3]     = dedup.coords[pi * 3];
      nodesF32[newPointCount * 3 + 1] = dedup.coords[pi * 3 + 1];
      nodesF32[newPointCount * 3 + 2] = dedup.coords[pi * 3 + 2];
      newPointCount++;
    }
    nodesF32 = nodesF32.slice(0, newPointCount * 3);
    for (var fi = 0; fi < elemsU32.length; fi++) elemsU32[fi] = remap[elemsU32[fi]];

    var dt = ((typeof performance !== 'undefined') ? performance.now() : Date.now()) - t0;
    if (opts.verbose) {
      console.log('[Delaunay] Bitti: ' + newPointCount + ' düğüm, ' + keptCount + ' tet (toplam ' +
                  tets.length + ', dış ' + (tets.length - keptCount) + '), ' + dt.toFixed(0) + ' ms');
    }
    resolve({
      type: 'tet4',
      nodes: nodesF32,
      elements: elemsU32,
      nodesPerElement: 4,
      info: {
        inputPoints: dedup.pointCount - (dedup.interiorAdded || 0),
        interiorPoints: dedup.interiorAdded || 0,
        outputNodes: newPointCount,
        outputTets: keptCount,
        rawTets: tets.length,
        outsideRemoved: tets.length - keptCount,
        durationMs: dt
      }
    });
  });
}

// Init-time diagnostic
if (typeof window !== 'undefined' && typeof console !== 'undefined') {
  // Bundle henüz yüklenmediği için Available() şu an false dönebilir.
  // Modal açılışında tekrar kontrol edilir.
}

// CommonJS export (Jest test ortamı için)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    veFEADelaunayAvailable: veFEADelaunayAvailable,
    veFEADelaunayDiagnose: veFEADelaunayDiagnose,
    veFEADelaunayTetrahedralize: veFEADelaunayTetrahedralize,
    _veFEADelaunayDedupVertices: _veFEADelaunayDedupVertices,
    _veFEADelaunayAddInteriorPoints: _veFEADelaunayAddInteriorPoints,
    _veFEADelaunayClassifyTets: _veFEADelaunayClassifyTets
  };
}
