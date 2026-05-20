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
// kümesi bekler. Çekirdek algoritma fea-mesh-utils.js → veFEADedupVertices.
// Burada Delaunay alt fonksiyonlarının (surface/interior sampling) sonradan
// nokta ekleyebilmesi için coords mutable Array olarak tutulur.
function _veFEADelaunayDedupVertices(verts, triangleCount) {
  var r = veFEADedupVertices(verts);
  var coords = new Array(r.unique.length);
  for (var i = 0; i < r.unique.length; i++) coords[i] = r.unique[i];
  return {
    coords:        coords,        // mutable [x0,y0,z0, ...] — sampling push edebilir
    pointCount:    r.uniqueCount,
    triangles:     r.canonical,   // 3*triangleCount entries
    triangleCount: triangleCount,
    bbox:          r.bbox,
    epsilon:       r.epsilon
  };
}

// ─── Yüzey nokta sampling (kalite için) ────────────────────────────────────
// OCCT triangulasyonu adaptive: eğri yüzeylerde sık, düzde seyrek üçgen verir.
// Delaunay-of-boundary-points sadece bu eşit olmayan noktaları kullanınca düz
// alanlarda büyük dejenere üçgenler kalır. Çözüm: input üçgenlerine alan
// orantılı ek yüzey noktası ekle → uniform boundary point density → uniform
// Delaunay yüzeyi.
//
// Yöntem: stratified barycentric random sampling. Her üçgen için
//   n_samples = ceil(area / (h² · √3/4))     (eşkenar üçgen alan referansı)
// noktası serpiştirilir.
function _veFEADelaunaySampleSurfacePoints(dedup, parsed, targetSize) {
  var verts = parsed.vertices;
  var triCount = parsed.triangleCount;
  // Hedef alan: kenarı h olan eşkenar üçgen → A = h²·√3/4
  // Pratikte daha yoğun istiyoruz (uniform Delaunay için) → 2× kat
  var refArea = targetSize * targetSize * 0.433 * 0.5;  // h²·√3/4 / 2
  // Aşırı sampling'i kırp — bellek/Delaunay süresi koruması
  var maxExtra = Math.min(150000, Math.max(5000, dedup.pointCount * 6));
  var added = 0;
  // Deterministic pseudo-random (test stability + reproducibility için)
  var seed = 1337;
  function rand() {
    seed = (seed * 1664525 + 1013904223) | 0;
    return ((seed >>> 0) % 100000) / 100000;
  }

  for (var t = 0; t < triCount; t++) {
    if (added >= maxExtra) break;
    var off = t * 9;
    var ax = verts[off],     ay = verts[off + 1], az = verts[off + 2];
    var bx = verts[off + 3], by = verts[off + 4], bz = verts[off + 5];
    var cx = verts[off + 6], cy = verts[off + 7], cz = verts[off + 8];
    // 3D üçgen alanı = ½|AB × AC|
    var ABx = bx - ax, ABy = by - ay, ABz = bz - az;
    var ACx = cx - ax, ACy = cy - ay, ACz = cz - az;
    var crx = ABy * ACz - ABz * ACy;
    var cry = ABz * ACx - ABx * ACz;
    var crz = ABx * ACy - ABy * ACx;
    var area = 0.5 * Math.sqrt(crx*crx + cry*cry + crz*crz);
    if (area < refArea) continue;  // zaten yeterince küçük üçgen
    var nSamples = Math.max(1, Math.floor(area / refArea));
    // Aşırı yoğun üçgeni kırp (örn. çok büyük tek bir üçgen)
    if (nSamples > 200) nSamples = 200;
    for (var s = 0; s < nSamples; s++) {
      if (added >= maxExtra) break;
      // Stratified barycentric: u, v in [0,1], u+v ≤ 1
      var u = rand(), v = rand();
      if (u + v > 1) { u = 1 - u; v = 1 - v; }
      var w = 1 - u - v;
      // Kenara çok yakın olanları ele (degenerate tet'lere sebep olur)
      if (u < 0.05 || v < 0.05 || w < 0.05) continue;
      dedup.coords.push(
        u * ax + v * bx + w * cx,
        u * ay + v * by + w * cy,
        u * az + v * bz + w * cz
      );
      added++;
    }
  }
  dedup.surfacePointsAdded = added;
  dedup.pointCount = dedup.coords.length / 3;
  return dedup;
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
// 3 farklı eksen yönünde (X, Y, Z) ışın at; her ışın için üçgen kesişim
// sayısının pariteti içeride/dışarıda söyler. 3 oydan en az 2'si "içeride"
// derse içeride sayılır.
//
// Neden çoklu ışın? Tek-yönlü +X ışını, ışın bir üçgen kenarına/vertex'ine
// teğet geçtiğinde hit'i tek sayar (2 saymalıydı) veya hiç saymaz → tet
// dışarıda iken içeride sayılır → spike artefaktı. Çoğunluk oyu bu numerik
// kenar durumlarını gizler.

// Tek-yönlü parite (helper). axis: 0=X, 1=Y, 2=Z (ışın yönü)
function _veFEADelaunayParityOneAxis(tets, points, parsed, axis) {
  var v = parsed.vertices;
  var triCount = parsed.triangleCount;
  // Düzlem eksen indeksleri (ışına dik)
  var aA = (axis + 1) % 3;  // plane axis A
  var aB = (axis + 2) % 3;  // plane axis B
  // BBox
  var minA = Infinity, maxA = -Infinity;
  for (var p = 0; p < v.length; p += 3) {
    var a = v[p + aA];
    if (a < minA) minA = a; if (a > maxA) maxA = a;
  }
  var bins = Math.max(8, Math.min(64, Math.round(Math.cbrt(triCount))));
  var binW = (maxA - minA) / bins;
  if (binW <= 0) binW = 1;

  // Üçgenleri A-eksenine bucket'le
  var triBuckets = new Array(bins);
  for (var j = 0; j < bins; j++) triBuckets[j] = [];
  for (var t = 0; t < triCount; t++) {
    var off = t * 9;
    var aV1 = v[off + aA], aV2 = v[off + 3 + aA], aV3 = v[off + 6 + aA];
    var triMin = Math.min(aV1, aV2, aV3);
    var triMax = Math.max(aV1, aV2, aV3);
    var jMin = Math.max(0, Math.floor((triMin - minA) / binW));
    var jMax = Math.min(bins - 1, Math.floor((triMax - minA) / binW));
    for (var jj = jMin; jj <= jMax; jj++) triBuckets[jj].push(t);
  }

  var inside = new Uint8Array(tets.length);
  for (var ti = 0; ti < tets.length; ti++) {
    var tet = tets[ti];
    var cx = 0, cy = 0, cz = 0;
    for (var k = 0; k < 4; k++) {
      var pIdx = tet[k] * 3;
      cx += points[pIdx]; cy += points[pIdx + 1]; cz += points[pIdx + 2];
    }
    cx /= 4; cy /= 4; cz /= 4;
    var centroid = [cx, cy, cz];
    var cR = centroid[axis];     // ray başlangıcı, ışın koordinatı
    var cA = centroid[aA];
    var cB = centroid[aB];

    var jBin = Math.max(0, Math.min(bins - 1, Math.floor((cA - minA) / binW)));
    var bucket = triBuckets[jBin];
    var hits = 0;
    for (var bi = 0; bi < bucket.length; bi++) {
      var tid = bucket[bi];
      var o2 = tid * 9;
      // Üçgen vertex'leri
      var p1A = v[o2 + aA],   p1B = v[o2 + aB],   p1R = v[o2 + axis];
      var p2A = v[o2+3 + aA], p2B = v[o2+3 + aB], p2R = v[o2+3 + axis];
      var p3A = v[o2+6 + aA], p3B = v[o2+6 + aB], p3R = v[o2+6 + axis];
      // Düzlemde (A,B) point-in-triangle
      var area = (p2A - p1A) * (p3B - p1B) - (p2B - p1B) * (p3A - p1A);
      if (Math.abs(area) < 1e-14) continue;
      var l1 = ((p2A - cA) * (p3B - cB) - (p2B - cB) * (p3A - cA)) / area;
      var l2 = ((p3A - cA) * (p1B - cB) - (p3B - cB) * (p1A - cA)) / area;
      var l3 = 1 - l1 - l2;
      // Kenara çok yakın hit'i kabul etmiyoruz — diğer 2 yöne bırak (çoğunluk oyu)
      if (l1 < 1e-9 || l2 < 1e-9 || l3 < 1e-9) continue;
      var hitR = l1 * p1R + l2 * p2R + l3 * p3R;
      if (hitR > cR) hits++;
    }
    inside[ti] = (hits & 1);
  }
  return inside;
}

function _veFEADelaunayClassifyTets(tets, points, parsed) {
  if (parsed.triangleCount === 0) return new Uint8Array(tets.length);
  // 3 yönde parite + çoğunluk oyu (≥2/3) — sayısal kenar durumlarına dayanıklı
  var insideX = _veFEADelaunayParityOneAxis(tets, points, parsed, 0);
  var insideY = _veFEADelaunayParityOneAxis(tets, points, parsed, 1);
  var insideZ = _veFEADelaunayParityOneAxis(tets, points, parsed, 2);
  var inside = new Uint8Array(tets.length);
  for (var i = 0; i < tets.length; i++) {
    var votes = insideX[i] + insideY[i] + insideZ[i];
    inside[i] = (votes >= 2) ? 1 : 0;
  }
  return inside;
}

// setTimeout(0) yardımcı — Promise tabanlı, browser'a render fırsatı verir.
// Worker dışında main thread'i bloke etmeden faz aralarında yield etmek için.
function _veFEADelaunayYield() {
  if (typeof setTimeout === 'undefined') return Promise.resolve();
  return new Promise(function(resolve) { setTimeout(resolve, 0); });
}

// ─── Ana giriş: tetrahedralize ──────────────────────────────────────────────
// Fazlar (yield ile ayrılmış — UI'ı bloke etmez):
//   1. Vertex dedup (triangle-soup → unique points)
//   2. Yüzey nokta sampling (büyük üçgenleri kır → uniform boundary)
//   3. İç-nokta sampling (octree, parite testi)
//   4. Delaunay triangulate (TEK BLOKLAYAN ADIM, ~500ms-2s)
//   5. Parite testi ile dış tet'leri ele
//   6. Compact + sonuç
//
// opts:
//   targetSize:        sampling grid boyutu (mm). Default: 10
//   addSurfacePoints:  true → büyük üçgenlere ek nokta (kalite ↑). Default: true
//   addInteriorPoints: true → bbox grid ile iç nokta. Default: true
//   onProgress(stage, msg, frac): faz değişikliklerinde çağrılır
//   verbose:           konsola süre/sayı bilgisi
//
// Promise<{type:'tet4', nodes:Float32Array, elements:Uint32Array, ...} | {error}>
function veFEADelaunayTetrahedralize(parsed, opts) {
  opts = opts || {};
  var onProgress = (typeof opts.onProgress === 'function') ? opts.onProgress : function() {};
  var verbose = opts.verbose === true;

  if (!parsed || !parsed.vertices || parsed.triangleCount <= 0) {
    return Promise.resolve({ error: 'parsed boş veya geçersiz' });
  }
  var triangulate = _veFEADelaunayGetTriangulator();
  if (!triangulate) {
    return Promise.resolve({ error: 'Delaunay kütüphanesi yüklenmemiş (vendor/delaunay/delaunay-bundle.js)' });
  }

  var t0 = (typeof performance !== 'undefined') ? performance.now() : Date.now();
  var sz = (typeof opts.targetSize === 'number' && opts.targetSize > 0) ? opts.targetSize : 10;
  var dedup, tets, inside, keptCount;

  // Faz 1: dedup
  onProgress('dedup', 'Yüzey noktaları indeksleniyor...', 0.05);
  return _veFEADelaunayYield().then(function() {
    dedup = _veFEADelaunayDedupVertices(parsed.vertices, parsed.triangleCount);
    if (verbose) console.log('[Delaunay] dedup: ' + dedup.pointCount + ' unique vertex');

    // Faz 2: yüzey sampling (kalite için — büyük düz alanları noktalarla doldur)
    onProgress('surface', 'Yüzey üçgenleri örnekleniyor...', 0.15);
    return _veFEADelaunayYield();
  }).then(function() {
    if (opts.addSurfacePoints !== false) {
      _veFEADelaunaySampleSurfacePoints(dedup, parsed, sz);
      if (verbose) console.log('[Delaunay] surface samples: +' + (dedup.surfacePointsAdded || 0));
    }

    // Faz 3: iç-nokta sampling
    onProgress('interior', 'İç noktalar örnekleniyor...', 0.30);
    return _veFEADelaunayYield();
  }).then(function() {
    if (opts.addInteriorPoints !== false) {
      _veFEADelaunayAddInteriorPoints(dedup, parsed, { targetSize: sz });
      if (verbose) console.log('[Delaunay] interior samples: +' + (dedup.interiorAdded || 0));
    }

    // Faz 4: Delaunay triangulate (BLOCKING — UI bunu yapamaz)
    onProgress('delaunay', 'Delaunay tetrahedralization (' + dedup.pointCount + ' nokta)...', 0.45);
    return _veFEADelaunayYield();
  }).then(function() {
    // [[x,y,z], ...] formatına çevir
    var pts = new Array(dedup.pointCount);
    for (var i = 0; i < dedup.pointCount; i++) {
      pts[i] = [dedup.coords[i*3], dedup.coords[i*3+1], dedup.coords[i*3+2]];
    }
    try {
      tets = triangulate(pts);
    } catch (e) {
      throw new Error('Delaunay triangulate exception: ' + (e.message || e));
    }
    if (!tets || tets.length === 0) {
      throw new Error('Delaunay 0 tet üretti (geometri yetersiz mi?)');
    }
    if (verbose) console.log('[Delaunay] triangulate: ' + tets.length + ' tet (raw)');

    // Faz 5: parite testi
    onProgress('parity', 'İç/dış sınıflandırma (' + tets.length + ' tet)...', 0.75);
    return _veFEADelaunayYield();
  }).then(function() {
    inside = _veFEADelaunayClassifyTets(tets, dedup.coords, parsed);
    keptCount = 0;
    for (var ki = 0; ki < inside.length; ki++) if (inside[ki]) keptCount++;
    if (keptCount === 0) {
      throw new Error('Parite testi tüm tet\'leri dış olarak işaretledi (yüzey kapalı mı?)');
    }
    if (verbose) console.log('[Delaunay] parity: ' + keptCount + ' inside, ' + (tets.length - keptCount) + ' outside');

    // Faz 6: compact + sonuç
    onProgress('compact', 'Düğüm/eleman compact...', 0.92);
    return _veFEADelaunayYield();
  }).then(function() {
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
    // Compact düğümler — referans verilmeyenleri ele
    var refCount = new Uint8Array(dedup.pointCount);
    for (var ei = 0; ei < elemsU32.length; ei++) refCount[elemsU32[ei]] = 1;
    var remap = new Int32Array(dedup.pointCount);
    var newPointCount = 0;
    var nodesF32 = new Float32Array(dedup.pointCount * 3);
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
    if (verbose) {
      console.log('[Delaunay] Bitti: ' + newPointCount + ' düğüm, ' + keptCount + ' tet, ' +
                  dt.toFixed(0) + ' ms');
    }
    onProgress('done', 'Tamamlandı', 1.0);
    return {
      type: 'tet4',
      nodes: nodesF32,
      elements: elemsU32,
      nodesPerElement: 4,
      info: {
        inputPoints: (parsed.triangleCount * 3) - (dedup.surfacePointsAdded || 0) - (dedup.interiorAdded || 0),
        surfacePoints: dedup.surfacePointsAdded || 0,
        interiorPoints: dedup.interiorAdded || 0,
        outputNodes: newPointCount,
        outputTets: keptCount,
        rawTets: tets.length,
        outsideRemoved: tets.length - keptCount,
        durationMs: dt
      }
    };
  }).catch(function(err) {
    return { error: err && err.message ? err.message : String(err) };
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
    _veFEADelaunaySampleSurfacePoints: _veFEADelaunaySampleSurfacePoints,
    _veFEADelaunayAddInteriorPoints: _veFEADelaunayAddInteriorPoints,
    _veFEADelaunayClassifyTets: _veFEADelaunayClassifyTets
  };
}
