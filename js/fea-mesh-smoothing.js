// ============================================================================
// MFSim FEA — MESH SMOOTHING & QUALITY OPTIMIZATION (ANSYS-tarzı)
// ============================================================================
// Üretilmiş bir hacim mesh'inin (tet4 / hex8 / wedge6) DÜĞÜM KONUMLARINI
// iyileştirir — topoloji (eleman bağlantıları, düğüm sayısı, namedSelections)
// DEĞİŞMEZ. Yalnız iç düğümler hareket eder; yüzey düğümleri sabit kalır
// (geometri sınırı korunur). Bu, ANSYS Mesher'ın "smoothing" adımının
// (Laplacian + optimization-based) karşılığıdır.
//
// Neden topoloji sabit?  Düğüm ID'leri korunduğu için named selections, boundary
// condition referansları ve quadratic enrichment sonrası eşlemeler bozulmaz.
//
// Yöntemler:
//   1. Laplacian (umbrella): düğümü komşularının centroid'ine çek. Hızlı ama
//      kaliteyi her zaman artırmaz (konkav bölgede bozabilir).
//   2. Smart Laplacian: aday Laplacian konumu YALNIZ o düğüme bağlı elemanların
//      MİNİMUM kalitesini düşürmüyorsa kabul edilir. Monoton (kaliteyi asla
//      bozmaz) — ANSYS "quality-based smoothing" davranışı.
//   3. Optimization-based (yardımcı): aday konum + birkaç yön denenir, en yüksek
//      lokal min-kalite seçilir. Smart Laplacian başarısız kalırsa devreye girer.
//
// Public API:
//   veFEAMeshBuildTopology(mesh)              → { neighbors, nodeElements, boundary }
//   veFEASmoothMesh(mesh, opts)               → yeni mesh (düğümler iyileştirilmiş)
//   veFEAMeshSmoothingReport(before, after)   → { minQ, avgQ, ... } karşılaştırma
//
// opts:
//   iterations:      smoothing geçiş sayısı (default 3)
//   method:          'smartLaplacian' (default) | 'laplacian'
//   relaxation:      Laplacian adım katsayısı 0..1 (default 0.5)
//   preserveSurface: yüzey düğümlerini sabitle (default true)
//   qualityFloor:    bu kaliteden iyi düğümlere dokunma (default 0 = hepsini dene)
//   onProgress(frac, msg)
//
// Lisans: ISC (MFSim ile aynı). Saf JS, bağımlılık yok.
// ============================================================================

// ─── Eleman tipi → yüzey (face) şablonları ─────────────────────────────────
// Boundary tespiti: bir face yalnız 1 elemana aitse yüzeydedir (paylaşılmamış).
// Her face kanonik sıralı düğüm anahtarıyla sayılır.
var _VE_FEA_SMOOTH_FACE_TEMPLATES = {
  tet4:   [[0,1,2],[0,1,3],[0,2,3],[1,2,3]],
  hex8:   [[0,1,2,3],[4,5,6,7],[0,1,5,4],[1,2,6,5],[2,3,7,6],[3,0,4,7]],
  wedge6: [[0,1,2],[3,4,5],[0,1,4,3],[1,2,5,4],[2,0,3,5]]
};

// Eleman tipi → kenar (edge) şablonları (komşuluk grafiği için).
var _VE_FEA_SMOOTH_EDGE_TEMPLATES = {
  tet4:   [[0,1],[0,2],[0,3],[1,2],[1,3],[2,3]],
  hex8:   [[0,1],[1,2],[2,3],[3,0],[4,5],[5,6],[6,7],[7,4],[0,4],[1,5],[2,6],[3,7]],
  wedge6: [[0,1],[1,2],[2,0],[3,4],[4,5],[5,3],[0,3],[1,4],[2,5]]
};

// Kanonik face anahtarı (sıralı düğüm indisleri, '|' ile).
function _veFEASmoothFaceKey(ids) {
  var a = ids.slice().sort(function(x, y) { return x - y; });
  return a.join('|');
}

// ─── Topoloji: komşuluk + boundary tespiti ─────────────────────────────────
// neighbors[i]   : i düğümünün kenar-komşusu düğüm ID'leri (Array)
// nodeElements[i]: i düğümünü içeren eleman indeksleri (Array)
// boundary       : Uint8Array(nodeCount), 1 = yüzey düğümü (sabit tutulur)
function veFEAMeshBuildTopology(mesh) {
  if (!mesh || mesh.error || !mesh.nodes || !mesh.elements) return null;
  var type = mesh.type;
  var faceTpl = _VE_FEA_SMOOTH_FACE_TEMPLATES[type];
  var edgeTpl = _VE_FEA_SMOOTH_EDGE_TEMPLATES[type];
  if (!faceTpl || !edgeTpl) return null; // quadratic/tri3/pyramid desteklenmez

  var nodes = mesh.nodes;
  var elements = mesh.elements;
  var per = mesh.nodesPerElement;
  var nodeCount = nodes.length / 3;
  var elemCount = elements.length / per;

  // node → eleman listesi
  var nodeElements = new Array(nodeCount);
  for (var i = 0; i < nodeCount; i++) nodeElements[i] = [];

  // Komşuluk: Set ile dedup (büyük mesh'te de O(E·edges))
  var neighborSets = new Array(nodeCount);
  for (var j = 0; j < nodeCount; j++) neighborSets[j] = new Set();

  // Boundary: face sayımı
  var faceCount = new Map();      // key → count
  var faceNodes = new Map();      // key → [düğüm ID'leri] (ilk görülen)

  for (var e = 0; e < elemCount; e++) {
    var off = e * per;
    // node→eleman + komşuluk
    for (var c = 0; c < per; c++) {
      nodeElements[elements[off + c]].push(e);
    }
    for (var ei = 0; ei < edgeTpl.length; ei++) {
      var a = elements[off + edgeTpl[ei][0]];
      var b = elements[off + edgeTpl[ei][1]];
      neighborSets[a].add(b);
      neighborSets[b].add(a);
    }
    // face sayımı (boundary için)
    for (var fi = 0; fi < faceTpl.length; fi++) {
      var ft = faceTpl[fi];
      var ids = new Array(ft.length);
      for (var k = 0; k < ft.length; k++) ids[k] = elements[off + ft[k]];
      var key = _veFEASmoothFaceKey(ids);
      faceCount.set(key, (faceCount.get(key) || 0) + 1);
      if (!faceNodes.has(key)) faceNodes.set(key, ids);
    }
  }

  var boundary = new Uint8Array(nodeCount);
  faceCount.forEach(function(cnt, key) {
    if (cnt !== 1) return;       // iç face (2 eleman paylaşır) → atla
    var ids = faceNodes.get(key);
    for (var m = 0; m < ids.length; m++) boundary[ids[m]] = 1;
  });

  // Set → Array (sıralı erişim için)
  var neighbors = new Array(nodeCount);
  for (var n = 0; n < nodeCount; n++) {
    neighbors[n] = Array.from(neighborSets[n]);
  }

  return {
    neighbors: neighbors,
    nodeElements: nodeElements,
    boundary: boundary,
    nodeCount: nodeCount,
    elemCount: elemCount
  };
}

// ─── Tek elemanın "shape quality" (0..1, 1=ideal) ───────────────────────────
// Smoothing'in optimize ettiği metrik: normalize edilmiş hacim / kenar². ANSYS
// "element quality" ile aynı aile. tet4/hex8/wedge6 için signed volume tabanlı;
// negatif (inverted) → 0 döner ki smoothing inverted'dan kaçınsın.
//   tet4:  Q = 12·(3·V)^(2/3) / Σ(edge²)        (regular tet → 1)
//   hex8/wedge6: alt-tet'lere böl, min(alt Q) — konservatif.
function _veFEASmoothTetQuality(p0, p1, p2, p3) {
  // signed volume
  var v1x=p1[0]-p0[0], v1y=p1[1]-p0[1], v1z=p1[2]-p0[2];
  var v2x=p2[0]-p0[0], v2y=p2[1]-p0[1], v2z=p2[2]-p0[2];
  var v3x=p3[0]-p0[0], v3y=p3[1]-p0[1], v3z=p3[2]-p0[2];
  var cx=v2y*v3z-v2z*v3y, cy=v2z*v3x-v2x*v3z, cz=v2x*v3y-v2y*v3x;
  var vol = (v1x*cx+v1y*cy+v1z*cz)/6;
  if (vol <= 0) return 0; // inverted/degenerate
  // Σ edge²  (6 kenar)
  function d2(a,b){var dx=a[0]-b[0],dy=a[1]-b[1],dz=a[2]-b[2];return dx*dx+dy*dy+dz*dz;}
  var sumL2 = d2(p0,p1)+d2(p0,p2)+d2(p0,p3)+d2(p1,p2)+d2(p1,p3)+d2(p2,p3);
  if (sumL2 <= 0) return 0;
  // Normalize: regular (eşkenar) tet → 1.0, ölçek-bağımsız.
  // Q_raw = (3·V)^(2/3) / ΣL².  Regular tet (kenar=1): V=1/(6√2), ΣL²=6 →
  // Q_raw = 1/12. Sabite bölünce regular tet → 1.0. Diğer tüm tet'ler < 1.
  var q = Math.pow(3 * vol, 2 / 3) / sumL2;
  var qNorm = q * 12;        // 1/(1/12) = 12  → regular tet = 1.0
  return qNorm > 1 ? 1 : qNorm;
}

// hex8 → 6 alt-tet (jacobian split ile aynı), min quality
var _VE_FEA_SMOOTH_HEX_SPLIT = [
  [0,1,2,6],[0,2,3,6],[0,3,7,6],[0,7,4,6],[0,4,5,6],[0,5,1,6]
];
var _VE_FEA_SMOOTH_WEDGE_SPLIT = [
  [0,2,1,5],[0,1,4,5],[0,4,3,5]
];

function _veFEASmoothNodePt(nodes, id) {
  return [nodes[id*3], nodes[id*3+1], nodes[id*3+2]];
}

// Bir elemanın kalitesi (tip-bağımsız), verilen nodes array'inden okur.
function _veFEASmoothElementQuality(type, nodes, elements, off) {
  if (type === 'tet4') {
    return _veFEASmoothTetQuality(
      _veFEASmoothNodePt(nodes, elements[off]),
      _veFEASmoothNodePt(nodes, elements[off+1]),
      _veFEASmoothNodePt(nodes, elements[off+2]),
      _veFEASmoothNodePt(nodes, elements[off+3]));
  }
  var split = (type === 'hex8') ? _VE_FEA_SMOOTH_HEX_SPLIT
            : (type === 'wedge6') ? _VE_FEA_SMOOTH_WEDGE_SPLIT : null;
  if (!split) return 1;
  var minQ = 1;
  for (var s = 0; s < split.length; s++) {
    var sp = split[s];
    var q = _veFEASmoothTetQuality(
      _veFEASmoothNodePt(nodes, elements[off+sp[0]]),
      _veFEASmoothNodePt(nodes, elements[off+sp[1]]),
      _veFEASmoothNodePt(nodes, elements[off+sp[2]]),
      _veFEASmoothNodePt(nodes, elements[off+sp[3]]));
    if (q < minQ) minQ = q;
  }
  return minQ;
}

// Bir düğüme bağlı elemanların MİN kalitesi (smart kabul kriteri).
function _veFEASmoothLocalMinQuality(type, nodes, elements, per, elemList) {
  var minQ = 1;
  for (var i = 0; i < elemList.length; i++) {
    var q = _veFEASmoothElementQuality(type, nodes, elements, elemList[i] * per);
    if (q < minQ) minQ = q;
    if (minQ === 0) return 0;
  }
  return minQ;
}

// ─── Optimization-based node smoothing (pattern search) ────────────────────
// Laplacian yönü işe yaramayan ("stubborn") bir düğüm için, düğümü çok yönde
// (±x,±y,±z + Laplacian/centroid) deneyip lokal MİN kaliteyi MAKSİMİZE eden
// konumu seçer. Kademeli küçülen adımlarla rafine eder (coordinate/pattern
// search — gradyan-serbest, ANSYS optimization-based smoothing'in pratik hali).
//
// nodes[i] mevcut konumda olmalı; başarılıysa nodes[i]'yi günceller ve true
// döner, aksi halde orijinalde bırakır ve false döner. Kaliteyi ASLA bozmaz
// (yalnız qBaseline'dan kesin iyi konumu kabul eder).
function _veFEASmoothOptimizeNode(type, nodes, elements, per, elemList, nodeId, nbList, qBaseline, surfaceProjector) {
  var i3 = nodeId * 3;
  var ox = nodes[i3], oy = nodes[i3+1], oz = nodes[i3+2];

  // Adım ölçeği: komşulara ortalama mesafenin bir kesri.
  var avgLen = 0, cnt = 0;
  for (var k = 0; k < nbList.length; k++) {
    var nb3 = nbList[k] * 3;
    var dx = nodes[nb3] - ox, dy = nodes[nb3+1] - oy, dz = nodes[nb3+2] - oz;
    avgLen += Math.sqrt(dx*dx + dy*dy + dz*dz); cnt++;
  }
  if (cnt === 0) return false;
  avgLen /= cnt;
  var step = avgLen * 0.25;
  if (!(step > 0)) return false;

  // Centroid yönü de aday yönlerden biri (Laplacian katkısı).
  var cx = 0, cy = 0, cz = 0;
  for (var c = 0; c < nbList.length; c++) {
    cx += nodes[nbList[c]*3]; cy += nodes[nbList[c]*3+1]; cz += nodes[nbList[c]*3+2];
  }
  cx /= cnt; cy /= cnt; cz /= cnt;

  var bestQ = qBaseline;
  var bestX = ox, bestY = oy, bestZ = oz;
  var improved = false;

  // Aday yönler: 6 eksen + centroid yönü (normalize). 7 yön × kademeli adım.
  var dirs = [
    [1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]
  ];
  var cdx = cx - ox, cdy = cy - oy, cdz = cz - oz;
  var clen = Math.sqrt(cdx*cdx + cdy*cdy + cdz*cdz);
  if (clen > 1e-12) dirs.push([cdx/clen, cdy/clen, cdz/clen]);

  // 3 kademe: step, step/2, step/4 — coarse→fine. Her kademede iyileşme
  // oldukça aynı kademede tekrar dene (sınırlı tur sayısı ile — sonsuz döngü yok).
  var totalRounds = 0;
  var MAX_ROUNDS = 24;
  for (var level = 0; level < 3 && totalRounds < MAX_ROUNDS; level++) {
    var s = step / (1 << level);
    var levelImproved = true;
    while (levelImproved && totalRounds < MAX_ROUNDS) {
      levelImproved = false;
      totalRounds++;
      for (var di = 0; di < dirs.length; di++) {
        var tx = bestX + dirs[di][0] * s;
        var ty = bestY + dirs[di][1] * s;
        var tz = bestZ + dirs[di][2] * s;
        if (surfaceProjector) {
          var pr = surfaceProjector(tx, ty, tz, nodeId);
          if (!pr) continue;
          tx = pr[0]; ty = pr[1]; tz = pr[2];
        }
        nodes[i3] = tx; nodes[i3+1] = ty; nodes[i3+2] = tz;
        var q = _veFEASmoothLocalMinQuality(type, nodes, elements, per, elemList);
        if (q > bestQ + 1e-9) {
          bestQ = q; bestX = tx; bestY = ty; bestZ = tz;
          improved = true; levelImproved = true;
        }
      }
    }
  }

  // En iyi konumu yaz (iyileşme varsa), yoksa orijinale dön.
  nodes[i3] = bestX; nodes[i3+1] = bestY; nodes[i3+2] = bestZ;
  return improved;
}

// ─── Ana smoothing geçişi ──────────────────────────────────────────────────
function veFEASmoothMesh(mesh, opts) {
  opts = opts || {};
  if (!mesh || mesh.error) return mesh;
  var type = mesh.type;
  if (type !== 'tet4' && type !== 'hex8' && type !== 'wedge6') {
    return mesh; // quadratic/tri3/pyramid: smoothing yok (sessiz)
  }
  var topo = veFEAMeshBuildTopology(mesh);
  if (!topo) return mesh;

  var iterations = (opts.iterations != null) ? Math.max(0, opts.iterations | 0) : 3;
  var method = opts.method || 'smartLaplacian';
  var relax = (opts.relaxation != null) ? Math.max(0, Math.min(1, opts.relaxation)) : 0.5;
  var preserveSurface = opts.preserveSurface !== false;
  var qualityFloor = (opts.qualityFloor != null) ? opts.qualityFloor : 1.0;
  // Laplacian başarısız kötü düğümlerde çok-yönlü optimization devreye girsin mi?
  // (method='optimization' her zaman; optimizeStubborn smartLaplacian'a ekler.)
  var optimizeStubborn = opts.optimizeStubborn === true;
  var onProgress = (typeof opts.onProgress === 'function') ? opts.onProgress : function() {};

  var per = mesh.nodesPerElement;
  var elements = mesh.elements;
  // Düğümleri kopyala (mutable çalışma alanı) — orijinal mesh bozulmaz.
  var nodes = new Float32Array(mesh.nodes);
  var nodeCount = topo.nodeCount;
  var neighbors = topo.neighbors;
  var nodeElements = topo.nodeElements;
  var boundary = topo.boundary;

  // Surface projector (opsiyonel): boundary düğümleri geometri yüzeyine geri
  // projekte ederek TANJANT KAYMA sağlar (ANSYS surface smoothing). null/yoksa
  // boundary düğümler tamamen sabit kalır (preserveSurface davranışı).
  var surfaceProjector = (typeof opts.surfaceProjector === 'function') ? opts.surfaceProjector : null;

  var movedTotal = 0;

  for (var it = 0; it < iterations; it++) {
    var movedThisPass = 0;
    for (var i = 0; i < nodeCount; i++) {
      var isBoundary = boundary[i] === 1;
      // Yüzey düğümü: projector yoksa veya preserveSurface ise sabit; varsa kaydır.
      if (isBoundary && (preserveSurface && !surfaceProjector)) continue;
      var nb = neighbors[i];
      if (nb.length === 0) continue;

      // Laplacian hedef: komşuların centroid'i
      var cx = 0, cy = 0, cz = 0;
      for (var k = 0; k < nb.length; k++) {
        cx += nodes[nb[k]*3]; cy += nodes[nb[k]*3+1]; cz += nodes[nb[k]*3+2];
      }
      cx /= nb.length; cy /= nb.length; cz /= nb.length;

      var ox = nodes[i*3], oy = nodes[i*3+1], oz = nodes[i*3+2];
      // relaxation ile interpolasyon
      var tx = ox + relax * (cx - ox);
      var ty = oy + relax * (cy - oy);
      var tz = oz + relax * (cz - oz);

      // Boundary düğüm → yüzeye geri projekte (tanjant kayma). Projeksiyon
      // başarısızsa (null) bu düğümü atla (sabit bırak).
      if (isBoundary && surfaceProjector) {
        var pr = surfaceProjector(tx, ty, tz, i);
        if (!pr) continue;
        tx = pr[0]; ty = pr[1]; tz = pr[2];
      }

      var elemList = nodeElements[i];

      if (method === 'laplacian') {
        nodes[i*3] = tx; nodes[i*3+1] = ty; nodes[i*3+2] = tz;
        movedThisPass++;
        continue;
      }

      // smartLaplacian: hareketten önce/sonra lokal min kalite
      var qBefore = _veFEASmoothLocalMinQuality(type, nodes, elements, per, elemList);
      if (qBefore >= qualityFloor) continue;  // zaten yeterince iyi → dokunma

      nodes[i*3] = tx; nodes[i*3+1] = ty; nodes[i*3+2] = tz;
      var qAfter = _veFEASmoothLocalMinQuality(type, nodes, elements, per, elemList);

      if (qAfter > qBefore + 1e-9) {
        movedThisPass++;                      // kabul (kalite arttı)
      } else {
        // reddet — geri al, küçük adımlarla dene (line search)
        var accepted = false;
        var frac = relax * 0.5;
        for (var attempt = 0; attempt < 3 && !accepted; attempt++) {
          var ax = ox + frac * (cx - ox);
          var ay = oy + frac * (cy - oy);
          var az = oz + frac * (cz - oz);
          if (isBoundary && surfaceProjector) {
            var prL = surfaceProjector(ax, ay, az, i);
            if (prL) { ax = prL[0]; ay = prL[1]; az = prL[2]; } else { frac *= 0.5; continue; }
          }
          nodes[i*3] = ax; nodes[i*3+1] = ay; nodes[i*3+2] = az;
          var qa = _veFEASmoothLocalMinQuality(type, nodes, elements, per, elemList);
          if (qa > qBefore + 1e-9) { accepted = true; movedThisPass++; }
          frac *= 0.5;
        }
        // Optimization-based: Laplacian yönü işe yaramadıysa, çok yönlü pattern
        // search ile lokal min kaliteyi maksimize eden konumu ara (ANSYS
        // optimization-based smoothing). Yalnız method='optimization' veya
        // optimizeStubborn açıkken — pahalı olduğu için kötü düğümlere odaklı.
        if (!accepted && (method === 'optimization' || optimizeStubborn)) {
          nodes[i*3] = ox; nodes[i*3+1] = oy; nodes[i*3+2] = oz;
          var opt = _veFEASmoothOptimizeNode(
            type, nodes, elements, per, elemList, i, neighbors[i],
            qBefore, isBoundary ? surfaceProjector : null);
          if (opt) { movedThisPass++; accepted = true; }
        }
        if (!accepted) {
          nodes[i*3] = ox; nodes[i*3+1] = oy; nodes[i*3+2] = oz; // tam geri al
        }
      }
    }
    movedTotal += movedThisPass;
    onProgress((it + 1) / iterations, 'Smoothing geçişi ' + (it+1) + '/' + iterations +
               ' (' + movedThisPass + ' düğüm)');
    if (movedThisPass === 0) break; // yakınsadı
  }

  // Yeni mesh — topoloji aynı, yalnız nodes değişti.
  var out = {};
  for (var key in mesh) { if (mesh.hasOwnProperty(key)) out[key] = mesh[key]; }
  out.nodes = nodes;
  out.smoothingApplied = {
    method: method, iterations: iterations, relaxation: relax,
    nodesMoved: movedTotal, preserveSurface: preserveSurface
  };
  return out;
}

// ─── Smoothing öncesi/sonrası kalite raporu ────────────────────────────────
// Aynı kalite ölçütüyle (lokal-min-quality histogramı yerine global min/avg).
function veFEAMeshSmoothingReport(meshBefore, meshAfter) {
  function stats(mesh) {
    if (!mesh || mesh.error) return { minQ: 0, avgQ: 0, elemCount: 0 };
    var type = mesh.type;
    if (type !== 'tet4' && type !== 'hex8' && type !== 'wedge6') {
      return { minQ: 1, avgQ: 1, elemCount: 0 };
    }
    var per = mesh.nodesPerElement;
    var elements = mesh.elements;
    var nodes = mesh.nodes;
    var n = elements.length / per;
    var minQ = 1, sum = 0;
    for (var e = 0; e < n; e++) {
      var q = _veFEASmoothElementQuality(type, nodes, elements, e * per);
      if (q < minQ) minQ = q;
      sum += q;
    }
    return { minQ: minQ, avgQ: n ? sum / n : 0, elemCount: n };
  }
  var b = stats(meshBefore), a = stats(meshAfter);
  return {
    before: b, after: a,
    minQDelta: a.minQ - b.minQ,
    avgQDelta: a.avgQ - b.avgQ,
    improved: a.minQ > b.minQ - 1e-9 && a.avgQ >= b.avgQ - 1e-9
  };
}

// CommonJS export (Jest)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    veFEAMeshBuildTopology: veFEAMeshBuildTopology,
    veFEASmoothMesh: veFEASmoothMesh,
    veFEAMeshSmoothingReport: veFEAMeshSmoothingReport,
    _veFEASmoothTetQuality: _veFEASmoothTetQuality,
    _veFEASmoothElementQuality: _veFEASmoothElementQuality
  };
}
