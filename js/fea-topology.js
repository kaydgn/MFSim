// ============================================================================
// FEA GEOMETRY TOPOLOGY
// ============================================================================
// ANSYS Workbench'in 2-aşamalı mesh sürecindeki ilk aşama: GEOMETRİ-BAZLI
// topology tespiti. Mesh üretmeden ÖNCE geometriyi parse edip yüzeyleri,
// kenarları ve köşeleri otomatik çıkarır. Mesher daha sonra bu topology'ye
// conforming şekilde element üretir.
//
// Primitif tipleri (box/cylinder/shaft/rectTube) için topology trivial:
//   - Statik face listesi geometriden analitik üretilir
//   - Face ID'leri mesh sonrası namedSelections ile eşleşir (zaten aynı id'ler)
// STEP için: full BREP topology OCCT entegrasyonu gerek (Faz B+); şimdilik
// tek "Yüzey" face olarak basitleştirildi.
//
// Topology data structure:
//   {
//     type, faces[], edges{count}, vertices{count},
//     totalSurfaceArea, volume, bbox
//   }
// Her face:
//   { id, label, type, area, normal?, radius?, length?, width?, height?, isHole? }
//
// Public API:
//   veFEAComputeGeometryTopology(geometry) → topology nesnesi
//   veFEATopologyFaceTypeLabel(type)       → "Düzlemsel" / "Silindirik" / ...
// ============================================================================

// ─── Face Adjacency Graph (ANSYS Extend to Adjacent için) ─────────────────
// topology.edges[].faceIds bilgisinden her face için komşu listesi çıkarır.
// Her edge'in iki face'i birbiriyle komşudur (shared edge).
function veFEABuildFaceAdjacency(topology) {
  var adj = {};
  if (!topology || !Array.isArray(topology.edges)) return adj;
  topology.edges.forEach(function(e) {
    if (!Array.isArray(e.faceIds) || e.faceIds.length < 2) return;
    for (var i = 0; i < e.faceIds.length; i++) {
      for (var j = 0; j < e.faceIds.length; j++) {
        if (i === j) continue;
        var a = e.faceIds[i], b = e.faceIds[j];
        if (!adj[a]) adj[a] = [];
        if (adj[a].indexOf(b) < 0) adj[a].push(b);
      }
    }
  });
  return adj;
}

// ANSYS Extend to Adjacent: feature-angle region growing.
// Verilen face seçiminden başlayıp, normaller arası açı thresholdDeg'den
// küçük olan komşuları rekürsif olarak ekler. Cylindrical/spherical normal
// vektörü olmayan face'ler atlanır.
function veFEAExtendSelectionAdjacent(selectedFaceIds, topology, thresholdDeg) {
  if (!Array.isArray(selectedFaceIds) || selectedFaceIds.length === 0) return [];
  if (!topology) return selectedFaceIds.slice();
  var threshold = (isFinite(+thresholdDeg) && +thresholdDeg > 0) ? +thresholdDeg : 30;
  var thresholdRad = threshold * Math.PI / 180;
  var adj = veFEABuildFaceAdjacency(topology);
  var faceMap = {};
  if (Array.isArray(topology.faces)) topology.faces.forEach(function(f) { faceMap[f.id] = f; });

  var result = {};
  selectedFaceIds.forEach(function(id) { result[id] = true; });
  var changed = true;
  var maxIter = 1000;  // sonsuz döngü koruması
  while (changed && maxIter-- > 0) {
    changed = false;
    var keys = Object.keys(result);
    for (var i = 0; i < keys.length; i++) {
      var fid = keys[i];
      var f = faceMap[fid];
      if (!f || !Array.isArray(f.normal)) continue;
      var neighbors = adj[fid] || [];
      for (var j = 0; j < neighbors.length; j++) {
        var nid = neighbors[j];
        if (result[nid]) continue;
        var nf = faceMap[nid];
        if (!nf || !Array.isArray(nf.normal)) continue;
        // İki face normal'i arasındaki açı (yön bağımsız — mutlak dot)
        var dot = f.normal[0]*nf.normal[0] + f.normal[1]*nf.normal[1] + f.normal[2]*nf.normal[2];
        if (dot > 1) dot = 1; if (dot < -1) dot = -1;
        var ang = Math.acos(Math.abs(dot));
        if (ang <= thresholdRad) {
          result[nid] = true;
          changed = true;
        }
      }
    }
  }
  return Object.keys(result);
}

function veFEAComputeGeometryTopology(geometry) {
  if (!geometry || !geometry.type) return null;
  var p = geometry.params || {};
  if (geometry.type === 'box')      return _veFEAToplBox(p);
  if (geometry.type === 'cylinder') return _veFEAToplCylinder(p);
  if (geometry.type === 'shaft')    return _veFEAToplShaft(p);
  if (geometry.type === 'sphere')     return _veFEAToplSphere(p);
  if (geometry.type === 'hemisphere') return _veFEAToplHemisphere(p);
  if (geometry.type === 'torus')      return _veFEAToplTorus(p);
  if (geometry.type === 'cone')       return _veFEAToplCone(p);
  if (geometry.type === 'lbracket')   return _veFEAToplLBracket(p);
  if (geometry.type === 'ibeam')      return _veFEAToplIBeam(p);
  if (geometry.type === 'rectTube') return _veFEAToplRectTube(p);
  if (geometry.type === 'step') return _veFEAToplStep(geometry);
  return null;
}

function veFEATopologyFaceTypeLabel(type) {
  return ({
    'planar':         'Düzlemsel',
    'planar-annular': 'Halka (Düzlem)',
    'cylindrical':    'Silindirik',
    'spherical':      'Küresel',
    'conical':        'Konik (Eğri)',
    'toroidal':       'Toroidal (Halka)',
    'triangulated':   'Üçgenlenmiş'
  })[type] || type;
}

// ─── Kutu (box) — 6 yüzey, 12 kenar, 8 köşe ────────────────────────────────
function _veFEAToplBox(p) {
  var w = Math.max(0.1, p.width  || 50);
  var h = Math.max(0.1, p.height || 30);
  var d = Math.max(0.1, p.depth  || 20);
  var faces = [
    { id: 'faceXMin', label: 'X− Yüzeyi',           type: 'planar', normal: [-1, 0,  0], area: h * d, width: d, height: h },
    { id: 'faceXMax', label: 'X+ Yüzeyi',           type: 'planar', normal: [ 1, 0,  0], area: h * d, width: d, height: h },
    { id: 'faceYMin', label: 'Y− Yüzeyi (Alt)',     type: 'planar', normal: [ 0,-1,  0], area: w * d, width: w, height: d },
    { id: 'faceYMax', label: 'Y+ Yüzeyi (Üst)',     type: 'planar', normal: [ 0, 1,  0], area: w * d, width: w, height: d },
    { id: 'faceZMin', label: 'Z− Yüzeyi (Ön)',      type: 'planar', normal: [ 0, 0, -1], area: w * h, width: w, height: h },
    { id: 'faceZMax', label: 'Z+ Yüzeyi (Arka)',    type: 'planar', normal: [ 0, 0,  1], area: w * h, width: w, height: h }
  ];
  return {
    type: 'box',
    faces: faces,
    edges:    { count: 12 },
    vertices: { count: 8 },
    totalSurfaceArea: 2 * (w * h + w * d + h * d),
    volume: w * h * d,
    bbox: { x: w, y: h, z: d }
  };
}

// ─── Silindir — 3 yüzey, 2 daire kenar, 0 köşe ─────────────────────────────
function _veFEAToplCylinder(p) {
  var r = Math.max(0.1, p.radius || 15);
  var h = Math.max(0.1, p.height || 60);
  var disk = Math.PI * r * r;
  var side = 2 * Math.PI * r * h;
  return {
    type: 'cylinder',
    faces: [
      { id: 'faceBottom', label: 'Alt Disk (Y−)', type: 'planar',      normal: [0,-1,0], area: disk, radius: r },
      { id: 'faceTop',    label: 'Üst Disk (Y+)', type: 'planar',      normal: [0, 1,0], area: disk, radius: r },
      { id: 'faceSide',   label: 'Yan Yüzey (Radyal)', type: 'cylindrical',              area: side, radius: r, length: h }
    ],
    edges: [
      { id: 'edgeBottomCircle', label: 'Alt Daire (Y−)', type: 'circle', length: 2 * Math.PI * r, radius: r, faceIds: ['faceBottom', 'faceSide'] },
      { id: 'edgeTopCircle',    label: 'Üst Daire (Y+)', type: 'circle', length: 2 * Math.PI * r, radius: r, faceIds: ['faceTop',    'faceSide'] }
    ],
    vertices: { count: 0 },
    totalSurfaceArea: 2 * disk + side,
    volume: disk * h,
    bbox: { x: 2 * r, y: h, z: 2 * r }
  };
}

// ─── Şaft (içi boş silindir) — 4 yüzey, 4 daire kenar, 0 köşe ──────────────
function _veFEAToplShaft(p) {
  var rOut = Math.max(0.5, p.outerRadius || 20);
  var rIn  = Math.max(0,   p.innerRadius || 8);
  if (rIn >= rOut) rIn = Math.max(0, rOut - 1);
  var L = Math.max(0.1, p.length || 120);
  var ring  = Math.PI * (rOut * rOut - rIn * rIn);
  var outer = 2 * Math.PI * rOut * L;
  var inner = 2 * Math.PI * rIn  * L;
  return {
    type: 'shaft',
    faces: [
      { id: 'faceBottom', label: 'Alt Halka (Y−)',       type: 'planar-annular', normal: [0,-1,0], area: ring, outerRadius: rOut, innerRadius: rIn },
      { id: 'faceTop',    label: 'Üst Halka (Y+)',       type: 'planar-annular', normal: [0, 1,0], area: ring, outerRadius: rOut, innerRadius: rIn },
      { id: 'faceOuter',  label: 'Dış Yan Yüzey',        type: 'cylindrical',                       area: outer, radius: rOut, length: L },
      { id: 'faceInner',  label: 'İç Yan Yüzey (Delik)', type: 'cylindrical',                       area: inner, radius: rIn,  length: L, isHole: true }
    ],
    edges: [
      { id: 'edgeOuterBottom', label: 'Dış Alt Daire (Y−)',  type: 'circle', length: 2 * Math.PI * rOut, radius: rOut, faceIds: ['faceBottom', 'faceOuter'] },
      { id: 'edgeOuterTop',    label: 'Dış Üst Daire (Y+)',  type: 'circle', length: 2 * Math.PI * rOut, radius: rOut, faceIds: ['faceTop',    'faceOuter'] },
      { id: 'edgeInnerBottom', label: 'İç Alt Daire (Delik Y−)', type: 'circle', length: 2 * Math.PI * rIn, radius: rIn, faceIds: ['faceBottom', 'faceInner'], isHole: true },
      { id: 'edgeInnerTop',    label: 'İç Üst Daire (Delik Y+)', type: 'circle', length: 2 * Math.PI * rIn, radius: rIn, faceIds: ['faceTop',    'faceInner'], isHole: true }
    ],
    vertices: { count: 0 },
    totalSurfaceArea: 2 * ring + outer + inner,
    volume: ring * L,
    bbox: { x: 2 * rOut, y: L, z: 2 * rOut }
  };
}

// ─── Küre — 1 yüzey (spherical), 0 kenar, 0 köşe ──────────────────────────
function _veFEAToplSphere(p) {
  var r = Math.max(0.5, p.radius || 25);
  var area = 4 * Math.PI * r * r;
  var vol  = (4 / 3) * Math.PI * r * r * r;
  return {
    type: 'sphere',
    faces: [
      { id: 'faceSurface', label: 'Küresel Yüzey', type: 'spherical', area: area, radius: r }
    ],
    edges:    { count: 0 },
    vertices: { count: 0 },
    totalSurfaceArea: area,
    volume: vol,
    bbox: { x: 2 * r, y: 2 * r, z: 2 * r }
  };
}

// ─── Yarım Küre — 2 face (alt düz disk + üst dome) + 1 daire (equator) ────
function _veFEAToplHemisphere(p) {
  var r = Math.max(0.5, p.radius || 25);
  var domeArea = 2 * Math.PI * r * r;
  var flatArea = Math.PI * r * r;
  return {
    type: 'hemisphere',
    faces: [
      { id: 'faceFlat', label: 'Alt Düz Disk (Y−)', type: 'planar', normal: [0,-1,0], area: flatArea, radius: r },
      { id: 'faceDome', label: 'Yarı Küresel Yüzey (Dome)', type: 'spherical', area: domeArea, radius: r }
    ],
    edges: [
      { id: 'edgeEquator', label: 'Ekvator Dairesi', type: 'circle', length: 2 * Math.PI * r, radius: r, faceIds: ['faceFlat', 'faceDome'] }
    ],
    vertices: { count: 0 },
    totalSurfaceArea: domeArea + flatArea,
    volume: (2 / 3) * Math.PI * r * r * r,
    bbox: { x: 2 * r, y: r, z: 2 * r }
  };
}

// ─── Torus — 1 face (toroidal surface), 0 edge, 0 vertex (closed manifold) ─
function _veFEAToplTorus(p) {
  var R = Math.max(1, p.majorRadius || 30);
  var r = Math.max(0.1, p.minorRadius || 10);
  var area = 4 * Math.PI * Math.PI * R * r;
  var vol  = 2 * Math.PI * Math.PI * R * r * r;
  return {
    type: 'torus',
    faces: [
      { id: 'faceSurface', label: 'Toroidal Yüzey', type: 'toroidal', area: area, majorRadius: R, minorRadius: r }
    ],
    edges:    { count: 0 },
    vertices: { count: 0 },
    totalSurfaceArea: area,
    volume: vol,
    bbox: { x: 2 * (R + r), y: 2 * r, z: 2 * (R + r) }
  };
}

// ─── Koni / Frustum — 3 face (alt disk, üst disk, conical yan) ─────────────
function _veFEAToplCone(p) {
  var rB = Math.max(0.1, p.bottomRadius || 20);
  var rT = Math.max(0,   p.topRadius || 0);
  var h  = Math.max(0.1, p.height || 60);
  var slant = Math.sqrt(h * h + (rB - rT) * (rB - rT));
  var sideArea = Math.PI * (rB + rT) * slant;
  var bottomArea = Math.PI * rB * rB;
  var topArea = Math.PI * rT * rT;
  var volume = (Math.PI * h / 3) * (rB * rB + rB * rT + rT * rT);
  var faces = [
    { id: 'faceBottom', label: 'Alt Disk (Y−)', type: 'planar', normal: [0,-1,0], area: bottomArea, radius: rB },
    { id: 'faceSide',   label: 'Konik Yan Yüzey', type: 'conical', area: sideArea, bottomRadius: rB, topRadius: rT, slant: slant }
  ];
  // Apex case (rT=0): üst disk yok, üst tek nokta (vertex)
  var isApex = (rT < 1e-6);
  if (!isApex) {
    faces.splice(1, 0, { id: 'faceTop', label: 'Üst Disk (Y+)', type: 'planar', normal: [0,1,0], area: topArea, radius: rT });
  }
  var rMaxC = Math.max(rB, rT);
  var coneEdges = [
    { id: 'edgeBottomCircle', label: 'Alt Daire (Y−)', type: 'circle', length: 2 * Math.PI * rB, radius: rB, faceIds: ['faceBottom', 'faceSide'] }
  ];
  if (!isApex) {
    coneEdges.push({ id: 'edgeTopCircle', label: 'Üst Daire (Y+)', type: 'circle', length: 2 * Math.PI * rT, radius: rT, faceIds: ['faceTop', 'faceSide'] });
  }
  return {
    type: 'cone',
    faces: faces,
    edges: coneEdges,
    vertices: { count: isApex ? 1 : 0 },         // apex vertex
    totalSurfaceArea: bottomArea + topArea + sideArea,
    volume: volume,
    bbox: { x: 2 * rMaxC, y: h, z: 2 * rMaxC }
  };
}

// ─── L-Profil (köşe kirişi) — 8 face ───────────────────────────────────────
function _veFEAToplLBracket(p) {
  var w = Math.max(1, p.width || 60);
  var h = Math.max(1, p.height || 40);
  var t = Math.max(0.5, p.thickness || 5);
  var L = Math.max(1, p.length || 100);
  var crossArea = t * (w + h - t);
  return {
    type: 'lbracket',
    faces: [
      { id: 'faceZMin',     label: 'Ön Kesit (Z−)',              type: 'planar', normal: [0,0,-1], area: crossArea },
      { id: 'faceZMax',     label: 'Arka Kesit (Z+)',            type: 'planar', normal: [0,0,1],  area: crossArea },
      { id: 'faceXMin',     label: 'Sol Yan (X−)',               type: 'planar', normal: [-1,0,0], area: h * L },
      { id: 'faceYMin',     label: 'Alt Yan (Y−)',               type: 'planar', normal: [0,-1,0], area: w * L },
      { id: 'faceXMax',     label: 'Yatay Kol Sağ Yüzü (X+)',    type: 'planar', normal: [1,0,0],  area: t * L },
      { id: 'faceYMax',     label: 'Dikey Kol Üst Yüzü (Y+)',    type: 'planar', normal: [0,1,0],  area: t * L },
      { id: 'faceInnerY',   label: 'İç Köşe Üst Yüzü',           type: 'planar', normal: [0,1,0],  area: (w - t) * L },
      { id: 'faceInnerX',   label: 'İç Köşe Yan Yüzü',           type: 'planar', normal: [1,0,0],  area: (h - t) * L }
    ],
    edges:    { count: 18 },
    vertices: { count: 12 },     // 6 cross-section köşe × 2 z-uç
    totalSurfaceArea: 2 * crossArea + 2 * (w + h) * L,
    volume: crossArea * L,
    bbox: { x: w, y: h, z: L }
  };
}

// ─── I-Profil (kiriş) — 12 face (dış silüet) ──────────────────────────────
function _veFEAToplIBeam(p) {
  var w = Math.max(1, p.width || 80);
  var h = Math.max(1, p.height || 120);
  var tf = Math.max(0.5, p.flange || 8);
  var tw = Math.max(0.5, p.web || 6);
  var L = Math.max(1, p.length || 200);
  var innerW = (w - tw) / 2;
  var innerH = h - 2 * tf;
  var crossArea = 2 * (w * tf) + tw * innerH;
  // I-profil dış silüet 12 köşeli polygon → 12 yan yüz (yan yüzeyler kenar başına)
  return {
    type: 'ibeam',
    faces: [
      { id: 'faceZMin',  label: 'Ön Kesit (Z−)',        type: 'planar', normal: [0,0,-1], area: crossArea },
      { id: 'faceZMax',  label: 'Arka Kesit (Z+)',      type: 'planar', normal: [0,0,1],  area: crossArea },
      { id: 'faceYMin',  label: 'Alt Flanş Tabanı (Y−)', type: 'planar', normal: [0,-1,0], area: w * L },
      { id: 'faceYMax',  label: 'Üst Flanş Tepesi (Y+)', type: 'planar', normal: [0,1,0],  area: w * L },
      { id: 'faceXMin',  label: 'Sol Yan (X−)',         type: 'planar', normal: [-1,0,0], area: tf * L + tf * L },  // alt + üst flanşın sol kenarı
      { id: 'faceXMax',  label: 'Sağ Yan (X+)',         type: 'planar', normal: [1,0,0],  area: tf * L + tf * L },
      { id: 'faceWebL',  label: 'Gövde Sol Yüzü',       type: 'planar', normal: [-1,0,0], area: innerH * L },
      { id: 'faceWebR',  label: 'Gövde Sağ Yüzü',       type: 'planar', normal: [1,0,0],  area: innerH * L },
      { id: 'faceInnerYU',label: 'Üst Flanş İç Yüzü (Y−)',type: 'planar', normal: [0,-1,0], area: 2 * innerW * L },
      { id: 'faceInnerYL',label: 'Alt Flanş İç Yüzü (Y+)',type: 'planar', normal: [0,1,0],  area: 2 * innerW * L }
    ],
    edges:    { count: 24 },
    vertices: { count: 24 },     // 12 cross-section × 2 z-uç
    totalSurfaceArea: 2 * crossArea + (2 * w + 2 * h + 4 * innerW) * L,
    volume: crossArea * L,
    bbox: { x: w, y: h, z: L }
  };
}

// ─── Dikdörtgen profil (rectTube) — 8 yüzey (4 dış + 4 iç) ─────────────────
function _veFEAToplRectTube(p) {
  var w = Math.max(1, p.width || 60);
  var h = Math.max(1, p.height || 40);
  var t = Math.max(0.2, p.thickness || 4);
  var L = Math.max(1, p.length || 200);
  var iw = Math.max(0, w - 2 * t);
  var ih = Math.max(0, h - 2 * t);
  var outerSect = w * h;
  var innerSect = iw * ih;
  var ringSect  = outerSect - innerSect;
  return {
    type: 'rectTube',
    faces: [
      { id: 'faceZMin',     label: 'Alt Kesit (Z−)',       type: 'planar', normal: [0,0,-1], area: ringSect },
      { id: 'faceZMax',     label: 'Üst Kesit (Z+)',       type: 'planar', normal: [0,0, 1], area: ringSect },
      { id: 'faceXMin',     label: 'X− Dış Yan Yüzey',     type: 'planar', normal: [-1,0,0], area: h * L },
      { id: 'faceXMax',     label: 'X+ Dış Yan Yüzey',     type: 'planar', normal: [ 1,0,0], area: h * L },
      { id: 'faceYMin',     label: 'Y− Dış Yan Yüzey',     type: 'planar', normal: [0,-1,0], area: w * L },
      { id: 'faceYMax',     label: 'Y+ Dış Yan Yüzey',     type: 'planar', normal: [0, 1,0], area: w * L },
      { id: 'faceInnerXMin',label: 'X− İç Yüzey (boşluk)', type: 'planar', normal: [ 1,0,0], area: ih * L, isHole: true },
      { id: 'faceInnerXMax',label: 'X+ İç Yüzey (boşluk)', type: 'planar', normal: [-1,0,0], area: ih * L, isHole: true },
      { id: 'faceInnerYMin',label: 'Y− İç Yüzey (boşluk)', type: 'planar', normal: [0, 1,0], area: iw * L, isHole: true },
      { id: 'faceInnerYMax',label: 'Y+ İç Yüzey (boşluk)', type: 'planar', normal: [0,-1,0], area: iw * L, isHole: true }
    ],
    edges:    { count: 16 },  // 8 outer + 8 inner
    vertices: { count: 16 },
    totalSurfaceArea: 2 * ringSect + 2 * (w + h) * L + 2 * (iw + ih) * L,
    volume: ringSect * L,
    bbox: { x: w, y: h, z: L }
  };
}

// ─── STEP — feature-aware (yuklenen geometriden tespit) ───────────────────
// Geom üzerinde detectedFeatures varsa (veFEADetectGeometryFeatures cikti),
// her feature ayri face olarak topology'ye eklenir. Aksi takdirde tek
// "triangulated" face fallback.
function _veFEAToplStep(geom) {
  if (geom.detectedFeatures && geom.detectedFeatures.features && geom.detectedFeatures.features.length > 0) {
    var det = geom.detectedFeatures;
    var faces = det.features.map(function (f, idx) {
      var base = {
        id: 'feat' + idx,
        label: _veFEAFeatureFaceLabel(f, idx),
        type: _veFEAFeatureTypeToBrepLabel(f.type),
        area: f.area || 0,
        triangleCount: (f.triangleIds || []).length
      };
      if (f.type === 'planar' && f.normal) {
        base.normal = f.normal;
      } else if (f.type === 'cylindrical') {
        base.axis = f.axis;
        base.radius = f.radius;
        base.length = f.length;
      } else if (f.type === 'spherical') {
        base.center = f.center;
        base.radius = f.radius;
      }
      return base;
    });
    return {
      type: geom.type,
      faces: faces,
      edges:    { count: det.edgeStats ? det.edgeStats.total : 0,
                  sharp: det.edgeStats ? det.edgeStats.sharp : 0,
                  smooth: det.edgeStats ? det.edgeStats.smooth : 0 },
      vertices: { count: det.uniqueVertices || 0 },
      totalSurfaceArea: det.totalArea || geom.surfaceArea || 0,
      volume: geom.volume || 0,
      bbox: geom.bbox || (det.bbox ? {
        x: det.bbox.size,
        y: det.bbox.size,
        z: det.bbox.size
      } : { x: 0, y: 0, z: 0 }),
      featureSummary: det.summary
    };
  }
  // Fallback: tek "triangulated" face
  return {
    type: geom.type,
    faces: [
      {
        id: 'faceSurface',
        label: 'Yüzey (Tüm üçgenler)',
        type: 'triangulated',
        area: geom.surfaceArea || 0,
        triangleCount: geom.triangleCount || 0
      }
    ],
    edges:    { count: 0 },
    vertices: { count: 0 },
    totalSurfaceArea: geom.surfaceArea || 0,
    volume: geom.volume || 0,
    bbox: geom.bbox || { x: 0, y: 0, z: 0 }
  };
}

function _veFEAFeatureFaceLabel(f, idx) {
  var t = f.type;
  if (t === 'planar')      return 'Düzlemsel Yüzey #' + (idx + 1);
  if (t === 'cylindrical') return 'Silindirik Yüzey #' + (idx + 1) + ' (R≈' + (f.radius || 0).toFixed(1) + ')';
  if (t === 'spherical')   return 'Küresel Yüzey #' + (idx + 1) + ' (R≈' + (f.radius || 0).toFixed(1) + ')';
  if (t === 'conical')     return 'Konik Yüzey #' + (idx + 1);
  if (t === 'freeform')    return 'Serbest Yüzey #' + (idx + 1);
  return 'Yüzey #' + (idx + 1);
}

function _veFEAFeatureTypeToBrepLabel(t) {
  if (t === 'planar')      return 'planar';
  if (t === 'cylindrical') return 'cylindrical';
  if (t === 'spherical')   return 'spherical';
  if (t === 'conical')     return 'conical';
  return 'triangulated'; // freeform veya unknown
}
