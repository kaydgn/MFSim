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
  var topo = null;
  if      (geometry.type === 'box')        topo = _veFEAToplBox(p);
  else if (geometry.type === 'cylinder')   topo = _veFEAToplCylinder(p);
  else if (geometry.type === 'shaft')      topo = _veFEAToplShaft(p);
  else if (geometry.type === 'sphere')     topo = _veFEAToplSphere(p);
  else if (geometry.type === 'hemisphere') topo = _veFEAToplHemisphere(p);
  else if (geometry.type === 'torus')      topo = _veFEAToplTorus(p);
  else if (geometry.type === 'cone')       topo = _veFEAToplCone(p);
  else if (geometry.type === 'lbracket')   topo = _veFEAToplLBracket(p);
  else if (geometry.type === 'ibeam')      topo = _veFEAToplIBeam(p);
  else if (geometry.type === 'rectTube')   topo = _veFEAToplRectTube(p);
  else if (geometry.type === 'washer')     topo = _veFEAToplWasher(p);
  else if (geometry.type === 'nut')        topo = _veFEAToplNut(p);
  else if (geometry.type === 'bolt')       topo = _veFEAToplBolt(p);
  else if (geometry.type === 'plate')      topo = _veFEAToplPlate(p);
  else if (geometry.type === 'step')       topo = _veFEAToplStep(geometry);
  else if (typeof _veFEAToplGeneric === 'function') topo = _veFEAToplGeneric(geometry);
  if (!topo) return null;
  // Post-process: vertex.faceIds boşsa, edge'lerden otomatik doldur.
  // (Box gibi bazı primitiflerde elle dolu; plate/lbracket gibilerde edge'lerden türetilir.)
  _veFEAPropagateFaceBindings(topo);
  // Edges ve vertices array ise, eski {count:N} formatı için "count" property'sini
  // doğrudan array'in üzerine ekle. Böylece hem topology.edges.length hem
  // topology.edges.count erişimi çalışır. Eski code/test kırılmaz.
  if (Array.isArray(topo.edges))    { topo.edges.count = topo.edges.length; topo._edgesCount = topo.edges.length; }
  if (Array.isArray(topo.vertices)) { topo.vertices.count = topo.vertices.length; topo._verticesCount = topo.vertices.length; }
  return topo;
}

// Vertex ve edge bağlantılarını topology'de tutarlı hale getir.
// Vertex.faceIds: o vertex'i kullanan tüm edge'lerin faceIds birleşimi.
// Vertex.edgeIds: o vertex'i endpoint olarak kullanan tüm edge'ler.
// Face.edgeIds: bu face'i içeren tüm edge'ler.
// Face.vertexIds: bu face'in vertex'leri (edge'lerin vertex'lerinin birleşimi).
function _veFEAPropagateFaceBindings(topo) {
  if (!topo || !Array.isArray(topo.faces)) return;
  var edges = Array.isArray(topo.edges) ? topo.edges : [];
  var verts = Array.isArray(topo.vertices) ? topo.vertices : [];
  var vertMap = {};
  verts.forEach(function(v) {
    vertMap[v.id] = v;
    if (!Array.isArray(v.edgeIds)) v.edgeIds = [];
    if (!Array.isArray(v.faceIds)) v.faceIds = [];
  });
  var faceMap = {};
  topo.faces.forEach(function(f) {
    faceMap[f.id] = f;
    if (!Array.isArray(f.edgeIds)) f.edgeIds = [];
    if (!Array.isArray(f.vertexIds)) f.vertexIds = [];
  });
  edges.forEach(function(e) {
    // face.edgeIds
    if (Array.isArray(e.faceIds)) {
      e.faceIds.forEach(function(fid) {
        var ff = faceMap[fid];
        if (ff && ff.edgeIds.indexOf(e.id) < 0) ff.edgeIds.push(e.id);
      });
    }
    // vertex.edgeIds + vertex.faceIds
    if (Array.isArray(e.vertexIds)) {
      e.vertexIds.forEach(function(vid) {
        var vv = vertMap[vid];
        if (!vv) return;
        if (vv.edgeIds.indexOf(e.id) < 0) vv.edgeIds.push(e.id);
        if (Array.isArray(e.faceIds)) {
          e.faceIds.forEach(function(fid) {
            if (vv.faceIds.indexOf(fid) < 0) vv.faceIds.push(fid);
            var ff2 = faceMap[fid];
            if (ff2 && ff2.vertexIds.indexOf(vid) < 0) ff2.vertexIds.push(vid);
          });
        }
      });
    }
  });
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
  var hw = w/2, hh = h/2, hd = d/2;
  var faces = [
    { id: 'faceXMin', label: 'X− Yüzeyi',           type: 'planar', normal: [-1, 0,  0], area: h * d, width: d, height: h, centroid: [-hw, 0, 0] },
    { id: 'faceXMax', label: 'X+ Yüzeyi',           type: 'planar', normal: [ 1, 0,  0], area: h * d, width: d, height: h, centroid: [ hw, 0, 0] },
    { id: 'faceYMin', label: 'Y− Yüzeyi (Alt)',     type: 'planar', normal: [ 0,-1,  0], area: w * d, width: w, height: d, centroid: [0, -hh, 0] },
    { id: 'faceYMax', label: 'Y+ Yüzeyi (Üst)',     type: 'planar', normal: [ 0, 1,  0], area: w * d, width: w, height: d, centroid: [0,  hh, 0] },
    { id: 'faceZMin', label: 'Z− Yüzeyi (Ön)',      type: 'planar', normal: [ 0, 0, -1], area: w * h, width: w, height: h, centroid: [0, 0, -hd] },
    { id: 'faceZMax', label: 'Z+ Yüzeyi (Arka)',    type: 'planar', normal: [ 0, 0,  1], area: w * h, width: w, height: h, centroid: [0, 0,  hd] }
  ];
  // 8 vertex (köşeler) — adlandırma: vXmYmZm = (X-, Y-, Z-) octant
  var vertices = [
    { id: 'vXmYmZm', label: 'Köşe (−,−,−)', position: [-hw,-hh,-hd], faceIds: ['faceXMin','faceYMin','faceZMin'] },
    { id: 'vXpYmZm', label: 'Köşe (+,−,−)', position: [ hw,-hh,-hd], faceIds: ['faceXMax','faceYMin','faceZMin'] },
    { id: 'vXmYpZm', label: 'Köşe (−,+,−)', position: [-hw, hh,-hd], faceIds: ['faceXMin','faceYMax','faceZMin'] },
    { id: 'vXpYpZm', label: 'Köşe (+,+,−)', position: [ hw, hh,-hd], faceIds: ['faceXMax','faceYMax','faceZMin'] },
    { id: 'vXmYmZp', label: 'Köşe (−,−,+)', position: [-hw,-hh, hd], faceIds: ['faceXMin','faceYMin','faceZMax'] },
    { id: 'vXpYmZp', label: 'Köşe (+,−,+)', position: [ hw,-hh, hd], faceIds: ['faceXMax','faceYMin','faceZMax'] },
    { id: 'vXmYpZp', label: 'Köşe (−,+,+)', position: [-hw, hh, hd], faceIds: ['faceXMin','faceYMax','faceZMax'] },
    { id: 'vXpYpZp', label: 'Köşe (+,+,+)', position: [ hw, hh, hd], faceIds: ['faceXMax','faceYMax','faceZMax'] }
  ];
  // 12 kenar (4 X-yönlü + 4 Y-yönlü + 4 Z-yönlü)
  var edges = [
    // X-yönlü 4 edge
    { id: 'eX_YmZm', label: 'X-Kenar (Y−,Z−)', type: 'line', length: w, p1:[-hw,-hh,-hd], p2:[ hw,-hh,-hd], faceIds:['faceYMin','faceZMin'], vertexIds:['vXmYmZm','vXpYmZm'] },
    { id: 'eX_YpZm', label: 'X-Kenar (Y+,Z−)', type: 'line', length: w, p1:[-hw, hh,-hd], p2:[ hw, hh,-hd], faceIds:['faceYMax','faceZMin'], vertexIds:['vXmYpZm','vXpYpZm'] },
    { id: 'eX_YmZp', label: 'X-Kenar (Y−,Z+)', type: 'line', length: w, p1:[-hw,-hh, hd], p2:[ hw,-hh, hd], faceIds:['faceYMin','faceZMax'], vertexIds:['vXmYmZp','vXpYmZp'] },
    { id: 'eX_YpZp', label: 'X-Kenar (Y+,Z+)', type: 'line', length: w, p1:[-hw, hh, hd], p2:[ hw, hh, hd], faceIds:['faceYMax','faceZMax'], vertexIds:['vXmYpZp','vXpYpZp'] },
    // Y-yönlü 4 edge
    { id: 'eY_XmZm', label: 'Y-Kenar (X−,Z−)', type: 'line', length: h, p1:[-hw,-hh,-hd], p2:[-hw, hh,-hd], faceIds:['faceXMin','faceZMin'], vertexIds:['vXmYmZm','vXmYpZm'] },
    { id: 'eY_XpZm', label: 'Y-Kenar (X+,Z−)', type: 'line', length: h, p1:[ hw,-hh,-hd], p2:[ hw, hh,-hd], faceIds:['faceXMax','faceZMin'], vertexIds:['vXpYmZm','vXpYpZm'] },
    { id: 'eY_XmZp', label: 'Y-Kenar (X−,Z+)', type: 'line', length: h, p1:[-hw,-hh, hd], p2:[-hw, hh, hd], faceIds:['faceXMin','faceZMax'], vertexIds:['vXmYmZp','vXmYpZp'] },
    { id: 'eY_XpZp', label: 'Y-Kenar (X+,Z+)', type: 'line', length: h, p1:[ hw,-hh, hd], p2:[ hw, hh, hd], faceIds:['faceXMax','faceZMax'], vertexIds:['vXpYmZp','vXpYpZp'] },
    // Z-yönlü 4 edge
    { id: 'eZ_XmYm', label: 'Z-Kenar (X−,Y−)', type: 'line', length: d, p1:[-hw,-hh,-hd], p2:[-hw,-hh, hd], faceIds:['faceXMin','faceYMin'], vertexIds:['vXmYmZm','vXmYmZp'] },
    { id: 'eZ_XpYm', label: 'Z-Kenar (X+,Y−)', type: 'line', length: d, p1:[ hw,-hh,-hd], p2:[ hw,-hh, hd], faceIds:['faceXMax','faceYMin'], vertexIds:['vXpYmZm','vXpYmZp'] },
    { id: 'eZ_XmYp', label: 'Z-Kenar (X−,Y+)', type: 'line', length: d, p1:[-hw, hh,-hd], p2:[-hw, hh, hd], faceIds:['faceXMin','faceYMax'], vertexIds:['vXmYpZm','vXmYpZp'] },
    { id: 'eZ_XpYp', label: 'Z-Kenar (X+,Y+)', type: 'line', length: d, p1:[ hw, hh,-hd], p2:[ hw, hh, hd], faceIds:['faceXMax','faceYMax'], vertexIds:['vXpYpZm','vXpYpZp'] }
  ];
  return {
    type: 'box',
    faces: faces,
    edges: edges,
    vertices: vertices,
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
  var hh = h / 2;
  return {
    type: 'cylinder',
    faces: [
      { id: 'faceBottom', label: 'Alt Disk (Y−)', type: 'planar',      normal: [0,-1,0], area: disk, radius: r, centroid: [0,-hh,0] },
      { id: 'faceTop',    label: 'Üst Disk (Y+)', type: 'planar',      normal: [0, 1,0], area: disk, radius: r, centroid: [0, hh,0] },
      { id: 'faceSide',   label: 'Yan Yüzey (Radyal)', type: 'cylindrical',              area: side, radius: r, length: h, axis:[0,1,0], center:[0,0,0] }
    ],
    edges: [
      { id: 'edgeBottomCircle', label: 'Alt Daire (Y−)', type: 'circle', length: 2 * Math.PI * r, radius: r, center: [0,-hh,0], axis:[0,1,0], polyline: _veFEACirclePolyline([0,-hh,0],[0,1,0],r,48), faceIds: ['faceBottom', 'faceSide'], vertexIds: [] },
      { id: 'edgeTopCircle',    label: 'Üst Daire (Y+)', type: 'circle', length: 2 * Math.PI * r, radius: r, center: [0, hh,0], axis:[0,1,0], polyline: _veFEACirclePolyline([0, hh,0],[0,1,0],r,48), faceIds: ['faceTop',    'faceSide'], vertexIds: [] }
    ],
    vertices: [],
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
  var hL = L / 2;
  return {
    type: 'shaft',
    faces: [
      { id: 'faceBottom', label: 'Alt Halka (Y−)',       type: 'planar-annular', normal: [0,-1,0], area: ring, outerRadius: rOut, innerRadius: rIn, centroid:[0,-hL,0] },
      { id: 'faceTop',    label: 'Üst Halka (Y+)',       type: 'planar-annular', normal: [0, 1,0], area: ring, outerRadius: rOut, innerRadius: rIn, centroid:[0, hL,0] },
      { id: 'faceOuter',  label: 'Dış Yan Yüzey',        type: 'cylindrical',                       area: outer, radius: rOut, length: L, axis:[0,1,0], center:[0,0,0] },
      { id: 'faceInner',  label: 'İç Yan Yüzey (Delik)', type: 'cylindrical',                       area: inner, radius: rIn,  length: L, axis:[0,1,0], center:[0,0,0], isHole: true }
    ],
    edges: [
      { id: 'edgeOuterBottom', label: 'Dış Alt Daire (Y−)',  type: 'circle', length: 2 * Math.PI * rOut, radius: rOut, center:[0,-hL,0], axis:[0,1,0], polyline: _veFEACirclePolyline([0,-hL,0],[0,1,0],rOut,48), faceIds: ['faceBottom', 'faceOuter'], vertexIds: [] },
      { id: 'edgeOuterTop',    label: 'Dış Üst Daire (Y+)',  type: 'circle', length: 2 * Math.PI * rOut, radius: rOut, center:[0, hL,0], axis:[0,1,0], polyline: _veFEACirclePolyline([0, hL,0],[0,1,0],rOut,48), faceIds: ['faceTop',    'faceOuter'], vertexIds: [] },
      { id: 'edgeInnerBottom', label: 'İç Alt Daire (Delik Y−)', type: 'circle', length: 2 * Math.PI * rIn, radius: rIn, center:[0,-hL,0], axis:[0,1,0], polyline: _veFEACirclePolyline([0,-hL,0],[0,1,0],rIn,48), faceIds: ['faceBottom', 'faceInner'], vertexIds: [], isHole: true },
      { id: 'edgeInnerTop',    label: 'İç Üst Daire (Delik Y+)', type: 'circle', length: 2 * Math.PI * rIn, radius: rIn, center:[0, hL,0], axis:[0,1,0], polyline: _veFEACirclePolyline([0, hL,0],[0,1,0],rIn,48), faceIds: ['faceTop',    'faceInner'], vertexIds: [], isHole: true }
    ],
    vertices: [],
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
      { id: 'faceSurface', label: 'Küresel Yüzey', type: 'spherical', area: area, radius: r, center: [0,0,0], centroid: [0,0,0] }
    ],
    edges: [],
    vertices: [],
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
      { id: 'faceFlat', label: 'Alt Düz Disk (Y−)', type: 'planar', normal: [0,-1,0], area: flatArea, radius: r, centroid:[0,0,0] },
      { id: 'faceDome', label: 'Yarı Küresel Yüzey (Dome)', type: 'spherical', area: domeArea, radius: r, center: [0,0,0], centroid: [0, r/2, 0] }
    ],
    edges: [
      { id: 'edgeEquator', label: 'Ekvator Dairesi', type: 'circle', length: 2 * Math.PI * r, radius: r, center:[0,0,0], axis:[0,1,0], polyline: _veFEACirclePolyline([0,0,0],[0,1,0],r,48), faceIds: ['faceFlat', 'faceDome'], vertexIds: [] }
    ],
    vertices: [],
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
      { id: 'faceSurface', label: 'Toroidal Yüzey', type: 'toroidal', area: area, majorRadius: R, minorRadius: r, center: [0,0,0], axis: [0,1,0], centroid: [0,0,0] }
    ],
    edges: [],
    vertices: [],
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
  var hH = h / 2;
  // centroid'leri faces'e ekleyelim
  faces[0].centroid = [0, -hH, 0]; // bottom
  faces[faces.length - 1].center = [0, 0, 0];
  faces[faces.length - 1].axis = [0, 1, 0];
  if (!isApex) faces[1].centroid = [0, hH, 0];
  var coneEdges = [
    { id: 'edgeBottomCircle', label: 'Alt Daire (Y−)', type: 'circle', length: 2 * Math.PI * rB, radius: rB, center:[0,-hH,0], axis:[0,1,0], polyline: _veFEACirclePolyline([0,-hH,0],[0,1,0],rB,48), faceIds: ['faceBottom', 'faceSide'], vertexIds: [] }
  ];
  if (!isApex) {
    coneEdges.push({ id: 'edgeTopCircle', label: 'Üst Daire (Y+)', type: 'circle', length: 2 * Math.PI * rT, radius: rT, center:[0, hH,0], axis:[0,1,0], polyline: _veFEACirclePolyline([0, hH,0],[0,1,0],rT,48), faceIds: ['faceTop', 'faceSide'], vertexIds: [] });
  }
  var coneVerts = isApex
    ? [{ id: 'vApex', label: 'Tepe Noktası', position: [0, hH, 0], faceIds: ['faceSide'] }]
    : [];
  return {
    type: 'cone',
    faces: faces,
    edges: coneEdges,
    vertices: coneVerts,
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
  var hw = w/2, hh = h/2, hL = L/2;
  var crossArea = t * (w + h - t);
  var faces = [
    { id: 'faceZMin',     label: 'Ön Kesit (Z−)',              type: 'planar', normal: [0,0,-1], area: crossArea, centroid: [0,0,-hL] },
    { id: 'faceZMax',     label: 'Arka Kesit (Z+)',            type: 'planar', normal: [0,0,1],  area: crossArea, centroid: [0,0, hL] },
    { id: 'faceXMin',     label: 'Sol Yan (X−)',               type: 'planar', normal: [-1,0,0], area: h * L, centroid: [-hw, 0, 0] },
    { id: 'faceYMin',     label: 'Alt Yan (Y−)',               type: 'planar', normal: [0,-1,0], area: w * L, centroid: [0, -hh, 0] },
    { id: 'faceXMax',     label: 'Yatay Kol Sağ Yüzü (X+)',    type: 'planar', normal: [1,0,0],  area: t * L, centroid: [hw - (w - t)/2, -hh + t/2, 0] },
    { id: 'faceYMax',     label: 'Dikey Kol Üst Yüzü (Y+)',    type: 'planar', normal: [0,1,0],  area: t * L, centroid: [-hw + t/2, hh - (h - t)/2, 0] },
    { id: 'faceInnerY',   label: 'İç Köşe Üst Yüzü',           type: 'planar', normal: [0,1,0],  area: (w - t) * L, centroid: [hw - (w - t)/2, -hh + t, 0] },
    { id: 'faceInnerX',   label: 'İç Köşe Yan Yüzü',           type: 'planar', normal: [1,0,0],  area: (h - t) * L, centroid: [-hw + t, hh - (h - t)/2, 0] }
  ];
  // 6 cross-section köşesi × 2 z-uç = 12 vertex. L-profil 2D cross-section köşeleri:
  // (saat yönünün tersi, X- alt sol köşeden başlar)
  //   C1=(-hw,-hh), C2=(hw,-hh), C3=(hw,-hh+t), C4=(-hw+t,-hh+t), C5=(-hw+t, hh), C6=(-hw, hh)
  var cs = [
    [-hw,-hh],         // C1 dış alt sol
    [ hw,-hh],         // C2 dış alt sağ
    [ hw,-hh + t],     // C3 yatay kol sağ-üst
    [-hw + t,-hh + t], // C4 iç köşe (concave)
    [-hw + t, hh],     // C5 dikey kol üst-sağ
    [-hw, hh]          // C6 dış sol üst
  ];
  var vertices = [];
  for (var zi = 0; zi < 2; zi++) {
    var z = (zi === 0) ? -hL : hL;
    cs.forEach(function(c, ci) {
      vertices.push({
        id: 'vL_C' + (ci + 1) + (zi === 0 ? '_Zm' : '_Zp'),
        label: 'Köşe C' + (ci + 1) + ' (' + (zi === 0 ? 'Z−' : 'Z+') + ')',
        position: [c[0], c[1], z],
        faceIds: []
      });
    });
  }
  // 18 edge: 6 X-Y kesit edge (front) + 6 (back) + 6 axial
  var edges = [];
  function _vid(ci, zi) { return 'vL_C' + (ci + 1) + (zi === 0 ? '_Zm' : '_Zp'); }
  // Cross-section edge'leri (front Z-, back Z+)
  for (var zi2 = 0; zi2 < 2; zi2++) {
    var zVal = (zi2 === 0) ? -hL : hL;
    var faceId = (zi2 === 0) ? 'faceZMin' : 'faceZMax';
    for (var ei = 0; ei < 6; ei++) {
      var a = cs[ei], b = cs[(ei + 1) % 6];
      var L1 = Math.sqrt(Math.pow(b[0]-a[0],2) + Math.pow(b[1]-a[1],2));
      // İkinci faceId — bu kenarın hangi yan yüzünü ayırdığını belirleyen statik tablo
      var sideFace = ['faceYMin','faceXMax','faceInnerY','faceInnerX','faceYMax','faceXMin'][ei];
      edges.push({
        id: 'eL_C' + (ei + 1) + (zi2 === 0 ? '_Zm' : '_Zp'),
        label: 'Kesit Kenarı C' + (ei + 1) + '→' + ((ei + 1) % 6 + 1) + ' (' + (zi2 === 0 ? 'Z−' : 'Z+') + ')',
        type: 'line', length: L1,
        p1: [a[0], a[1], zVal], p2: [b[0], b[1], zVal],
        polyline: _veFEALinePolyline([a[0], a[1], zVal], [b[0], b[1], zVal]),
        faceIds: [faceId, sideFace],
        vertexIds: [_vid(ei, zi2), _vid((ei + 1) % 6, zi2)]
      });
    }
  }
  // Axial (Z) edge'leri — her cross-section köşesinden Z- → Z+
  cs.forEach(function(c, ei3) {
    // Bu köşedeki iki yan yüz — sırayla cw'de gelen yüzeyler
    var leftFace  = ['faceXMin','faceYMin','faceXMax','faceInnerY','faceInnerX','faceYMax'][ei3];
    var rightFace = ['faceYMin','faceXMax','faceInnerY','faceInnerX','faceYMax','faceXMin'][ei3];
    edges.push({
      id: 'eL_Z_C' + (ei3 + 1),
      label: 'Eksenel Kenar C' + (ei3 + 1) + ' (Z)',
      type: 'line', length: L,
      p1: [c[0], c[1], -hL], p2: [c[0], c[1], hL],
      polyline: _veFEALinePolyline([c[0], c[1], -hL], [c[0], c[1], hL]),
      faceIds: [leftFace, rightFace],
      vertexIds: [_vid(ei3, 0), _vid(ei3, 1)]
    });
  });
  return {
    type: 'lbracket',
    faces: faces,
    edges: edges,
    vertices: vertices,
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
  var hw = w/2, hh = h/2, htw = tw/2, hL = L/2;
  var innerW = (w - tw) / 2;
  var innerH = h - 2 * tf;
  var crossArea = 2 * (w * tf) + tw * innerH;
  var faces = [
    { id: 'faceZMin',  label: 'Ön Kesit (Z−)',        type: 'planar', normal: [0,0,-1], area: crossArea, centroid:[0,0,-hL] },
    { id: 'faceZMax',  label: 'Arka Kesit (Z+)',      type: 'planar', normal: [0,0,1],  area: crossArea, centroid:[0,0, hL] },
    { id: 'faceYMin',  label: 'Alt Flanş Tabanı (Y−)', type: 'planar', normal: [0,-1,0], area: w * L, centroid:[0,-hh,0] },
    { id: 'faceYMax',  label: 'Üst Flanş Tepesi (Y+)', type: 'planar', normal: [0,1,0],  area: w * L, centroid:[0, hh,0] },
    { id: 'faceXMin',  label: 'Sol Yan (X−)',         type: 'planar', normal: [-1,0,0], area: tf * L + tf * L, centroid:[-hw, 0, 0] },
    { id: 'faceXMax',  label: 'Sağ Yan (X+)',         type: 'planar', normal: [1,0,0],  area: tf * L + tf * L, centroid:[ hw, 0, 0] },
    { id: 'faceWebL',  label: 'Gövde Sol Yüzü',       type: 'planar', normal: [-1,0,0], area: innerH * L, centroid:[-htw, 0, 0] },
    { id: 'faceWebR',  label: 'Gövde Sağ Yüzü',       type: 'planar', normal: [1,0,0],  area: innerH * L, centroid:[ htw, 0, 0] },
    { id: 'faceInnerYU',label: 'Üst Flanş İç Yüzü (Y−)',type: 'planar', normal: [0,-1,0], area: 2 * innerW * L, centroid:[0,  hh - tf, 0] },
    { id: 'faceInnerYL',label: 'Alt Flanş İç Yüzü (Y+)',type: 'planar', normal: [0,1,0],  area: 2 * innerW * L, centroid:[0, -hh + tf, 0] }
  ];
  // I-profil cross-section 12 köşe (CCW, alt-sol köşeden başlar):
  // C1=(-hw,-hh), C2=(hw,-hh), C3=(hw,-hh+tf), C4=(htw,-hh+tf), C5=(htw,hh-tf),
  // C6=(hw,hh-tf), C7=(hw,hh), C8=(-hw,hh), C9=(-hw,hh-tf), C10=(-htw,hh-tf),
  // C11=(-htw,-hh+tf), C12=(-hw,-hh+tf)
  var cs = [
    [-hw,-hh], [ hw,-hh], [ hw,-hh+tf], [ htw,-hh+tf], [ htw, hh-tf], [ hw, hh-tf],
    [ hw, hh], [-hw, hh], [-hw, hh-tf], [-htw, hh-tf], [-htw,-hh+tf], [-hw,-hh+tf]
  ];
  // Her edge'in (i → i+1) hangi yan yüzü ayırdığı
  var sideFaces = ['faceYMin','faceXMax','faceInnerYL','faceWebR','faceInnerYU','faceXMax',
                   'faceYMax','faceXMin','faceInnerYU','faceWebL','faceInnerYL','faceXMin'];
  var vertices = [];
  for (var zi = 0; zi < 2; zi++) {
    var z = (zi === 0) ? -hL : hL;
    cs.forEach(function(c, ci) {
      vertices.push({
        id: 'vI_C' + (ci + 1) + (zi === 0 ? '_Zm' : '_Zp'),
        label: 'Köşe C' + (ci + 1) + ' (' + (zi === 0 ? 'Z−' : 'Z+') + ')',
        position: [c[0], c[1], z], faceIds: []
      });
    });
  }
  function _vid(ci, zi) { return 'vI_C' + (ci + 1) + (zi === 0 ? '_Zm' : '_Zp'); }
  var edges = [];
  for (var zi2 = 0; zi2 < 2; zi2++) {
    var zVal = (zi2 === 0) ? -hL : hL;
    var fId = (zi2 === 0) ? 'faceZMin' : 'faceZMax';
    for (var ei = 0; ei < 12; ei++) {
      var a = cs[ei], b = cs[(ei + 1) % 12];
      var L1 = Math.sqrt(Math.pow(b[0]-a[0],2) + Math.pow(b[1]-a[1],2));
      edges.push({
        id: 'eI_C' + (ei + 1) + (zi2 === 0 ? '_Zm' : '_Zp'),
        label: 'Kesit Kenarı C' + (ei + 1) + '→' + ((ei + 1) % 12 + 1) + ' (' + (zi2 === 0 ? 'Z−' : 'Z+') + ')',
        type: 'line', length: L1,
        p1: [a[0], a[1], zVal], p2: [b[0], b[1], zVal],
        polyline: _veFEALinePolyline([a[0], a[1], zVal], [b[0], b[1], zVal]),
        faceIds: [fId, sideFaces[ei]],
        vertexIds: [_vid(ei, zi2), _vid((ei + 1) % 12, zi2)]
      });
    }
  }
  // Axial edge'ler (Z-yönlü)
  var axialAdj = [
    ['faceXMin','faceYMin'],   // C1
    ['faceYMin','faceXMax'],   // C2
    ['faceXMax','faceInnerYL'],// C3
    ['faceInnerYL','faceWebR'],// C4
    ['faceWebR','faceInnerYU'],// C5
    ['faceInnerYU','faceXMax'],// C6
    ['faceXMax','faceYMax'],   // C7
    ['faceYMax','faceXMin'],   // C8
    ['faceXMin','faceInnerYU'],// C9
    ['faceInnerYU','faceWebL'],// C10
    ['faceWebL','faceInnerYL'],// C11
    ['faceInnerYL','faceXMin'] // C12
  ];
  cs.forEach(function(c, ei3) {
    edges.push({
      id: 'eI_Z_C' + (ei3 + 1),
      label: 'Eksenel Kenar C' + (ei3 + 1) + ' (Z)',
      type: 'line', length: L,
      p1: [c[0], c[1], -hL], p2: [c[0], c[1], hL],
      polyline: _veFEALinePolyline([c[0], c[1], -hL], [c[0], c[1], hL]),
      faceIds: axialAdj[ei3].slice(),
      vertexIds: [_vid(ei3, 0), _vid(ei3, 1)]
    });
  });
  return {
    type: 'ibeam',
    faces: faces,
    edges: edges,
    vertices: vertices,
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
  var hw = w/2, hh = h/2, hL = L/2;
  var iw = Math.max(0, w - 2 * t);
  var ih = Math.max(0, h - 2 * t);
  var hiw = iw/2, hih = ih/2;
  var outerSect = w * h;
  var innerSect = iw * ih;
  var ringSect  = outerSect - innerSect;
  var faces = [
    { id: 'faceZMin',     label: 'Alt Kesit (Z−)',       type: 'planar', normal: [0,0,-1], area: ringSect, centroid:[0,0,-hL] },
    { id: 'faceZMax',     label: 'Üst Kesit (Z+)',       type: 'planar', normal: [0,0, 1], area: ringSect, centroid:[0,0, hL] },
    { id: 'faceXMin',     label: 'X− Dış Yan Yüzey',     type: 'planar', normal: [-1,0,0], area: h * L, centroid:[-hw, 0, 0] },
    { id: 'faceXMax',     label: 'X+ Dış Yan Yüzey',     type: 'planar', normal: [ 1,0,0], area: h * L, centroid:[ hw, 0, 0] },
    { id: 'faceYMin',     label: 'Y− Dış Yan Yüzey',     type: 'planar', normal: [0,-1,0], area: w * L, centroid:[0, -hh, 0] },
    { id: 'faceYMax',     label: 'Y+ Dış Yan Yüzey',     type: 'planar', normal: [0, 1,0], area: w * L, centroid:[0,  hh, 0] },
    { id: 'faceInnerXMin',label: 'X− İç Yüzey (boşluk)', type: 'planar', normal: [ 1,0,0], area: ih * L, centroid:[-hiw, 0, 0], isHole: true },
    { id: 'faceInnerXMax',label: 'X+ İç Yüzey (boşluk)', type: 'planar', normal: [-1,0,0], area: ih * L, centroid:[ hiw, 0, 0], isHole: true },
    { id: 'faceInnerYMin',label: 'Y− İç Yüzey (boşluk)', type: 'planar', normal: [0, 1,0], area: iw * L, centroid:[0, -hih, 0], isHole: true },
    { id: 'faceInnerYMax',label: 'Y+ İç Yüzey (boşluk)', type: 'planar', normal: [0,-1,0], area: iw * L, centroid:[0,  hih, 0], isHole: true }
  ];
  // 16 vertex (4 dış × 2 z-uç + 4 iç × 2 z-uç)
  var outerCs = [[-hw,-hh], [ hw,-hh], [ hw, hh], [-hw, hh]];
  var innerCs = [[-hiw,-hih], [ hiw,-hih], [ hiw, hih], [-hiw, hih]];
  var vertices = [];
  for (var zi = 0; zi < 2; zi++) {
    var z = (zi === 0) ? -hL : hL;
    outerCs.forEach(function(c, ci) {
      vertices.push({ id: 'vRT_O' + (ci + 1) + (zi === 0 ? '_Zm' : '_Zp'),
        label: 'Dış Köşe ' + (ci + 1) + ' (' + (zi === 0 ? 'Z−' : 'Z+') + ')',
        position: [c[0], c[1], z], faceIds: [] });
    });
    innerCs.forEach(function(c, ci) {
      vertices.push({ id: 'vRT_I' + (ci + 1) + (zi === 0 ? '_Zm' : '_Zp'),
        label: 'İç Köşe ' + (ci + 1) + ' (' + (zi === 0 ? 'Z−' : 'Z+') + ')',
        position: [c[0], c[1], z], faceIds: [] });
    });
  }
  function _void(ci, zi) { return 'vRT_O' + (ci + 1) + (zi === 0 ? '_Zm' : '_Zp'); }
  function _viid(ci, zi) { return 'vRT_I' + (ci + 1) + (zi === 0 ? '_Zm' : '_Zp'); }
  var edges = [];
  var outerSideFaces = ['faceYMin','faceXMax','faceYMax','faceXMin'];
  var innerSideFaces = ['faceInnerYMin','faceInnerXMax','faceInnerYMax','faceInnerXMin'];
  // Cross-section edge'leri (dış 4 + iç 4) × 2 z-uç
  for (var zi2 = 0; zi2 < 2; zi2++) {
    var zVal = (zi2 === 0) ? -hL : hL;
    var fId = (zi2 === 0) ? 'faceZMin' : 'faceZMax';
    // Dış
    for (var ei = 0; ei < 4; ei++) {
      var a = outerCs[ei], b = outerCs[(ei + 1) % 4];
      var L1 = Math.sqrt(Math.pow(b[0]-a[0],2) + Math.pow(b[1]-a[1],2));
      edges.push({
        id: 'eRT_OC' + (ei + 1) + (zi2 === 0 ? '_Zm' : '_Zp'),
        label: 'Dış Kesit ' + (ei + 1) + '→' + ((ei + 1) % 4 + 1) + ' (' + (zi2 === 0 ? 'Z−' : 'Z+') + ')',
        type: 'line', length: L1,
        p1: [a[0], a[1], zVal], p2: [b[0], b[1], zVal],
        polyline: _veFEALinePolyline([a[0], a[1], zVal], [b[0], b[1], zVal]),
        faceIds: [fId, outerSideFaces[ei]],
        vertexIds: [_void(ei, zi2), _void((ei + 1) % 4, zi2)]
      });
    }
    // İç
    for (var ei2 = 0; ei2 < 4; ei2++) {
      var ai = innerCs[ei2], bi = innerCs[(ei2 + 1) % 4];
      var L2 = Math.sqrt(Math.pow(bi[0]-ai[0],2) + Math.pow(bi[1]-ai[1],2));
      edges.push({
        id: 'eRT_IC' + (ei2 + 1) + (zi2 === 0 ? '_Zm' : '_Zp'),
        label: 'İç Kesit ' + (ei2 + 1) + '→' + ((ei2 + 1) % 4 + 1) + ' (' + (zi2 === 0 ? 'Z−' : 'Z+') + ')',
        type: 'line', length: L2,
        p1: [ai[0], ai[1], zVal], p2: [bi[0], bi[1], zVal],
        polyline: _veFEALinePolyline([ai[0], ai[1], zVal], [bi[0], bi[1], zVal]),
        faceIds: [fId, innerSideFaces[ei2]],
        isHole: true,
        vertexIds: [_viid(ei2, zi2), _viid((ei2 + 1) % 4, zi2)]
      });
    }
  }
  // Axial (Z) edge'leri — 4 dış + 4 iç
  var outerAxialAdj = [['faceXMin','faceYMin'], ['faceYMin','faceXMax'], ['faceXMax','faceYMax'], ['faceYMax','faceXMin']];
  var innerAxialAdj = [['faceInnerXMin','faceInnerYMin'], ['faceInnerYMin','faceInnerXMax'], ['faceInnerXMax','faceInnerYMax'], ['faceInnerYMax','faceInnerXMin']];
  outerCs.forEach(function(c, ei4) {
    edges.push({
      id: 'eRT_OZ_C' + (ei4 + 1), label: 'Dış Eksenel ' + (ei4 + 1) + ' (Z)',
      type: 'line', length: L,
      p1: [c[0], c[1], -hL], p2: [c[0], c[1], hL],
      polyline: _veFEALinePolyline([c[0], c[1], -hL], [c[0], c[1], hL]),
      faceIds: outerAxialAdj[ei4].slice(),
      vertexIds: [_void(ei4, 0), _void(ei4, 1)]
    });
  });
  innerCs.forEach(function(c, ei5) {
    edges.push({
      id: 'eRT_IZ_C' + (ei5 + 1), label: 'İç Eksenel ' + (ei5 + 1) + ' (Z)',
      type: 'line', length: L,
      p1: [c[0], c[1], -hL], p2: [c[0], c[1], hL],
      polyline: _veFEALinePolyline([c[0], c[1], -hL], [c[0], c[1], hL]),
      faceIds: innerAxialAdj[ei5].slice(), isHole: true,
      vertexIds: [_viid(ei5, 0), _viid(ei5, 1)]
    });
  });
  return {
    type: 'rectTube',
    faces: faces,
    edges: edges,
    vertices: vertices,
    totalSurfaceArea: 2 * ringSect + 2 * (w + h) * L + 2 * (iw + ih) * L,
    volume: ringSect * L,
    bbox: { x: w, y: h, z: L }
  };
}

// ─── Pul / Conta / Bilezik — 4 yüzey, 4 daire kenar, 0 köşe ────────────────
// Şaft'ın yassı versiyonu — kalınlık küçük. Otomotiv: sızdırmazlık conta,
// ayarlama pulu, cıvata bilezikleri.
function _veFEAToplWasher(p) {
  var rOut = Math.max(0.5, p.outerRadius || 12);
  // p.innerRadius === 0 explicit kontrolü — `|| 5` operatörü 0'ı false sayar
  var rIn  = (p.innerRadius !== undefined && p.innerRadius !== null) ? Math.max(0, p.innerRadius) : 5;
  if (rIn >= rOut) rIn = Math.max(0, rOut - 1);
  var t = Math.max(0.1, p.thickness || 1.5);
  var hT = t / 2;
  var ring  = Math.PI * (rOut * rOut - rIn * rIn);
  var outer = 2 * Math.PI * rOut * t;
  var inner = 2 * Math.PI * rIn  * t;
  var hasHole = rIn > 0;
  var faces = [
    { id: 'faceTop',    label: 'Üst Halka (Y+)',          type: 'planar-annular', normal: [0, 1, 0], area: ring, outerRadius: rOut, innerRadius: rIn, centroid:[0, hT, 0] },
    { id: 'faceBottom', label: 'Alt Halka (Y−)',          type: 'planar-annular', normal: [0,-1, 0], area: ring, outerRadius: rOut, innerRadius: rIn, centroid:[0,-hT, 0] },
    { id: 'faceOuter',  label: 'Dış Yan Yüzey (Silindir)', type: 'cylindrical',                       area: outer, radius: rOut, length: t, axis:[0,1,0], center:[0,0,0] }
  ];
  if (hasHole) {
    faces.push({ id: 'faceInner', label: 'İç Yan Yüzey (Delik)', type: 'cylindrical', area: inner, radius: rIn, length: t, axis:[0,1,0], center:[0,0,0], isHole: true });
  }
  var edges = [
    { id: 'edgeOuterTop',    label: 'Dış Üst Daire (Y+)', type: 'circle', length: 2 * Math.PI * rOut, radius: rOut, center:[0, hT, 0], axis:[0,1,0], polyline: _veFEACirclePolyline([0, hT, 0],[0,1,0],rOut,48), faceIds: ['faceTop','faceOuter'], vertexIds: [] },
    { id: 'edgeOuterBottom', label: 'Dış Alt Daire (Y−)', type: 'circle', length: 2 * Math.PI * rOut, radius: rOut, center:[0,-hT, 0], axis:[0,1,0], polyline: _veFEACirclePolyline([0,-hT, 0],[0,1,0],rOut,48), faceIds: ['faceBottom','faceOuter'], vertexIds: [] }
  ];
  if (hasHole) {
    edges.push({ id: 'edgeInnerTop',    label: 'İç Üst Daire (Delik Y+)', type: 'circle', length: 2 * Math.PI * rIn, radius: rIn, center:[0, hT, 0], axis:[0,1,0], polyline: _veFEACirclePolyline([0, hT, 0],[0,1,0],rIn,48), faceIds: ['faceTop','faceInner'], vertexIds: [], isHole: true });
    edges.push({ id: 'edgeInnerBottom', label: 'İç Alt Daire (Delik Y−)', type: 'circle', length: 2 * Math.PI * rIn, radius: rIn, center:[0,-hT, 0], axis:[0,1,0], polyline: _veFEACirclePolyline([0,-hT, 0],[0,1,0],rIn,48), faceIds: ['faceBottom','faceInner'], vertexIds: [], isHole: true });
  }
  return {
    type: 'washer',
    faces: faces,
    edges: edges,
    vertices: [],
    totalSurfaceArea: 2 * ring + outer + (hasHole ? inner : 0),
    volume: ring * t,
    bbox: { x: 2 * rOut, y: t, z: 2 * rOut }
  };
}

// ─── Somun (altıgen + merkez delik) — 9 yüzey, 20 kenar, 12 köşe ───────────
// Top + bottom hexagonal-annular + 6 side rectangles + 1 inner cylindrical.
// Otomotiv: cıvata ile birlikte montaj.
function _veFEAToplNut(p) {
  var width = Math.max(1, p.width || 13);          // across-flats
  var thick = Math.max(0.5, p.thickness || 6.5);
  var hT = thick / 2;
  // 0 (deliksiz) ile undefined ayrımı — `|| 8` 0'ı default'a düşürürdü
  var holeD = (p.holeDiameter !== undefined && p.holeDiameter !== null) ? Math.max(0, p.holeDiameter) : 8;
  var hexR  = width / Math.sqrt(3);                // circumradius
  var hexAreaFull = (3 * Math.sqrt(3) / 2) * hexR * hexR;
  var holeR = holeD / 2;
  var holeArea = Math.PI * holeR * holeR;
  var hexAnnular = Math.max(0, hexAreaFull - holeArea);
  var sideRect = width * thick;       // her bir altıgen yan yüz
  var innerCyl = 2 * Math.PI * holeR * thick;
  var hasHole = holeR > 0;
  var faces = [
    { id: 'faceTop',    label: 'Üst Yüzey (Altıgen-Halka)', type: 'planar-annular', normal: [0, 1, 0], area: hexAnnular, outerRadius: hexR, innerRadius: holeR, centroid:[0, hT, 0] },
    { id: 'faceBottom', label: 'Alt Yüzey (Altıgen-Halka)', type: 'planar-annular', normal: [0,-1, 0], area: hexAnnular, outerRadius: hexR, innerRadius: holeR, centroid:[0,-hT, 0] }
  ];
  // 6 altıgen köşe (XZ düzleminde) — circumradius hexR, 30° offset
  var hexCorners = [];
  for (var hi = 0; hi < 6; hi++) {
    var cang = (Math.PI / 6) + hi * (Math.PI / 3);   // 30° offset (across-flats hizalı)
    hexCorners.push([hexR * Math.cos(cang), hexR * Math.sin(cang)]);
  }
  // 6 yan yüzey — her biri düzlemsel dikdörtgen
  for (var i = 0; i < 6; i++) {
    var ang = (Math.PI / 6) + i * (Math.PI / 3) + (Math.PI / 6);  // yan yüzeyin normali (midpoint açısı)
    var c1 = hexCorners[i], c2 = hexCorners[(i + 1) % 6];
    var midX = (c1[0] + c2[0]) / 2, midZ = (c1[1] + c2[1]) / 2;
    faces.push({
      id: 'faceSide' + (i + 1),
      label: 'Yan Yüzey #' + (i + 1),
      type: 'planar',
      normal: [Math.cos(ang), 0, Math.sin(ang)],
      area: sideRect,
      width: width,
      height: thick,
      centroid: [midX, 0, midZ]
    });
  }
  if (hasHole) {
    faces.push({ id: 'faceInner', label: 'İç Yüzey (Delik)', type: 'cylindrical', area: innerCyl, radius: holeR, length: thick, axis:[0,1,0], center:[0,0,0], isHole: true });
  }
  // 12 vertex (6 üst hex + 6 alt hex)
  var vertices = [];
  for (var zi = 0; zi < 2; zi++) {
    var y = (zi === 0) ? -hT : hT;
    hexCorners.forEach(function(c, ci) {
      vertices.push({
        id: 'vN_C' + (ci + 1) + (zi === 0 ? '_Yb' : '_Yt'),
        label: 'Altıgen Köşe ' + (ci + 1) + ' (' + (zi === 0 ? 'Alt' : 'Üst') + ')',
        position: [c[0], y, c[1]], faceIds: []
      });
    });
  }
  function _vNid(ci, zi) { return 'vN_C' + (ci + 1) + (zi === 0 ? '_Yb' : '_Yt'); }
  var edges = [];
  // 12 hex edge (üst + alt)
  for (var zi2 = 0; zi2 < 2; zi2++) {
    var yVal = (zi2 === 0) ? -hT : hT;
    var fId = (zi2 === 0) ? 'faceBottom' : 'faceTop';
    for (var ei = 0; ei < 6; ei++) {
      var a = hexCorners[ei], b = hexCorners[(ei + 1) % 6];
      var L1 = Math.sqrt(Math.pow(b[0]-a[0],2) + Math.pow(b[1]-a[1],2));
      edges.push({
        id: 'eN_Hex' + (ei + 1) + (zi2 === 0 ? '_Yb' : '_Yt'),
        label: 'Altıgen Kenar ' + (ei + 1) + ' (' + (zi2 === 0 ? 'Alt' : 'Üst') + ')',
        type: 'line', length: L1,
        p1: [a[0], yVal, a[1]], p2: [b[0], yVal, b[1]],
        polyline: _veFEALinePolyline([a[0], yVal, a[1]], [b[0], yVal, b[1]]),
        faceIds: [fId, 'faceSide' + (ei + 1)],
        vertexIds: [_vNid(ei, zi2), _vNid((ei + 1) % 6, zi2)]
      });
    }
  }
  // 6 dikey edge (altıgen prizmanın yan kenarları)
  hexCorners.forEach(function(c, ei2) {
    var leftSide = 'faceSide' + (((ei2 + 5) % 6) + 1);
    var rightSide = 'faceSide' + (ei2 + 1);
    edges.push({
      id: 'eN_V_C' + (ei2 + 1), label: 'Dikey Kenar ' + (ei2 + 1),
      type: 'line', length: thick,
      p1: [c[0], -hT, c[1]], p2: [c[0], hT, c[1]],
      polyline: _veFEALinePolyline([c[0], -hT, c[1]], [c[0], hT, c[1]]),
      faceIds: [leftSide, rightSide],
      vertexIds: [_vNid(ei2, 0), _vNid(ei2, 1)]
    });
  });
  // 2 iç delik dairesi (varsa)
  if (hasHole) {
    edges.push({ id: 'edgeInnerTop',    label: 'İç Üst Daire (Delik Y+)', type: 'circle', length: 2 * Math.PI * holeR, radius: holeR, center:[0, hT, 0], axis:[0,1,0], polyline: _veFEACirclePolyline([0, hT, 0],[0,1,0],holeR,48), faceIds: ['faceTop','faceInner'], vertexIds: [], isHole: true });
    edges.push({ id: 'edgeInnerBottom', label: 'İç Alt Daire (Delik Y−)', type: 'circle', length: 2 * Math.PI * holeR, radius: holeR, center:[0,-hT, 0], axis:[0,1,0], polyline: _veFEACirclePolyline([0,-hT, 0],[0,1,0],holeR,48), faceIds: ['faceBottom','faceInner'], vertexIds: [], isHole: true });
  }
  return {
    type: 'nut',
    faces: faces,
    edges: edges,
    vertices: vertices,
    totalSurfaceArea: 2 * hexAnnular + 6 * sideRect + (hasHole ? innerCyl : 0),
    volume: hexAnnular * thick,
    bbox: { x: 2 * hexR, y: thick, z: 2 * hexR }
  };
}

// ─── Cıvata (altıgen başlık + silindir gövde) — 10 yüzey, ~20 kenar ─────────
// Head: 1 üst hex + 1 alt hex-annular (gövde girer) + 6 yan dikdörtgen.
// Shaft: 1 yan silindir + 1 alt disk. Otomotiv: motor blok, şanzıman flanş.
function _veFEAToplBolt(p) {
  var headW = Math.max(1, p.headWidth || 13);       // across-flats
  var headH = Math.max(0.5, p.headHeight || 5.5);
  var shaftD = Math.max(0.5, p.shaftDiameter || 8);
  var shaftL = Math.max(1, p.shaftLength || 30);
  var hexR  = headW / Math.sqrt(3);
  var hexAreaFull = (3 * Math.sqrt(3) / 2) * hexR * hexR;
  var shaftR = shaftD / 2;
  var shaftCirc = Math.PI * shaftR * shaftR;
  var headBottomArea = Math.max(0, hexAreaFull - shaftCirc);
  var headSideRect = headW * headH;
  var shaftSide = 2 * Math.PI * shaftR * shaftL;
  // Yerleşim: head top y=headH+shaftL/2 +headH/2, üst-sol referans bbox
  // Daha basit — head üstte (Y+), shaft altta (Y-). Toplam yükseklik h = headH + shaftL.
  // bbox.y = headH+shaftL, head üst y = headH+shaftL/2, head alt = shaftL/2, shaft alt = -shaftL/2
  // Bu hizalama ile primitives builder ile uyumlu olur.
  var hY = (headH + shaftL) / 2;
  var headTopY = hY;
  var headBotY = hY - headH;       // head-shaft junction
  var shaftBotY = -hY;
  var faces = [
    { id: 'faceHeadTop',    label: 'Başlık Üst (Altıgen)',   type: 'planar',         normal: [0, 1, 0], area: hexAreaFull, outerRadius: hexR, centroid:[0, headTopY, 0] },
    { id: 'faceHeadBottom', label: 'Başlık Alt (Altıgen-Halka)', type: 'planar-annular', normal: [0,-1, 0], area: headBottomArea, outerRadius: hexR, innerRadius: shaftR, centroid:[0, headBotY, 0] }
  ];
  // 6 altıgen başlık köşesi
  var hexCorners = [];
  for (var hi = 0; hi < 6; hi++) {
    var cang = (Math.PI / 6) + hi * (Math.PI / 3);
    hexCorners.push([hexR * Math.cos(cang), hexR * Math.sin(cang)]);
  }
  for (var i = 0; i < 6; i++) {
    var ang = (Math.PI / 6) + i * (Math.PI / 3) + (Math.PI / 6);
    var c1 = hexCorners[i], c2 = hexCorners[(i + 1) % 6];
    var midX = (c1[0] + c2[0]) / 2, midZ = (c1[1] + c2[1]) / 2;
    faces.push({
      id: 'faceHeadSide' + (i + 1),
      label: 'Başlık Yan #' + (i + 1),
      type: 'planar',
      normal: [Math.cos(ang), 0, Math.sin(ang)],
      area: headSideRect,
      width: headW,
      height: headH,
      centroid: [midX, (headTopY + headBotY) / 2, midZ]
    });
  }
  faces.push({ id: 'faceShaftSide',   label: 'Gövde Yan Yüzey (Silindir)', type: 'cylindrical', area: shaftSide, radius: shaftR, length: shaftL, axis:[0,1,0], center:[0, (headBotY + shaftBotY) / 2, 0] });
  faces.push({ id: 'faceShaftBottom', label: 'Gövde Alt Disk',             type: 'planar', normal: [0,-1, 0], area: shaftCirc, radius: shaftR, centroid:[0, shaftBotY, 0] });
  // 12 vertex (6 head top + 6 head bottom hex corners)
  var vertices = [];
  for (var zi = 0; zi < 2; zi++) {
    var y = (zi === 0) ? headBotY : headTopY;
    hexCorners.forEach(function(c, ci) {
      vertices.push({
        id: 'vB_C' + (ci + 1) + (zi === 0 ? '_Yb' : '_Yt'),
        label: 'Başlık Köşe ' + (ci + 1) + ' (' + (zi === 0 ? 'Alt' : 'Üst') + ')',
        position: [c[0], y, c[1]], faceIds: []
      });
    });
  }
  function _vBid(ci, zi) { return 'vB_C' + (ci + 1) + (zi === 0 ? '_Yb' : '_Yt'); }
  var edges = [];
  // 12 hex edge (üst + alt)
  for (var zi2 = 0; zi2 < 2; zi2++) {
    var yVal = (zi2 === 0) ? headBotY : headTopY;
    var fId = (zi2 === 0) ? 'faceHeadBottom' : 'faceHeadTop';
    for (var ei = 0; ei < 6; ei++) {
      var a = hexCorners[ei], b = hexCorners[(ei + 1) % 6];
      var L1 = Math.sqrt(Math.pow(b[0]-a[0],2) + Math.pow(b[1]-a[1],2));
      edges.push({
        id: 'eB_Hex' + (ei + 1) + (zi2 === 0 ? '_Yb' : '_Yt'),
        label: 'Başlık Altıgen Kenar ' + (ei + 1) + ' (' + (zi2 === 0 ? 'Alt' : 'Üst') + ')',
        type: 'line', length: L1,
        p1: [a[0], yVal, a[1]], p2: [b[0], yVal, b[1]],
        polyline: _veFEALinePolyline([a[0], yVal, a[1]], [b[0], yVal, b[1]]),
        faceIds: [fId, 'faceHeadSide' + (ei + 1)],
        vertexIds: [_vBid(ei, zi2), _vBid((ei + 1) % 6, zi2)]
      });
    }
  }
  // 6 dikey başlık edge (yan yüzler arası)
  hexCorners.forEach(function(c, ei2) {
    var leftSide = 'faceHeadSide' + (((ei2 + 5) % 6) + 1);
    var rightSide = 'faceHeadSide' + (ei2 + 1);
    edges.push({
      id: 'eB_V_C' + (ei2 + 1), label: 'Başlık Dikey Kenar ' + (ei2 + 1),
      type: 'line', length: headH,
      p1: [c[0], headBotY, c[1]], p2: [c[0], headTopY, c[1]],
      polyline: _veFEALinePolyline([c[0], headBotY, c[1]], [c[0], headTopY, c[1]]),
      faceIds: [leftSide, rightSide],
      vertexIds: [_vBid(ei2, 0), _vBid(ei2, 1)]
    });
  });
  // 2 daire (head-shaft junction + shaft bottom)
  edges.push({ id: 'edgeShaftJunction', label: 'Başlık-Gövde Birleşim Dairesi', type: 'circle', length: 2 * Math.PI * shaftR, radius: shaftR, center:[0, headBotY, 0], axis:[0,1,0], polyline: _veFEACirclePolyline([0, headBotY, 0],[0,1,0],shaftR,48), faceIds: ['faceHeadBottom','faceShaftSide'], vertexIds: [] });
  edges.push({ id: 'edgeShaftBottom',   label: 'Gövde Alt Dairesi', type: 'circle', length: 2 * Math.PI * shaftR, radius: shaftR, center:[0, shaftBotY, 0], axis:[0,1,0], polyline: _veFEACirclePolyline([0, shaftBotY, 0],[0,1,0],shaftR,48), faceIds: ['faceShaftSide','faceShaftBottom'], vertexIds: [] });
  return {
    type: 'bolt',
    faces: faces,
    edges: edges,
    vertices: vertices,
    totalSurfaceArea: hexAreaFull + headBottomArea + 6 * headSideRect + shaftSide + shaftCirc,
    volume: hexAreaFull * headH + shaftCirc * shaftL,
    bbox: { x: 2 * hexR, y: headH + shaftL, z: 2 * hexR }
  };
}

// ─── Delikli Levha (rectangular plate with grid holes) — 6 + N yüzey ────────
// Motor mounts, şanzıman flanş plakaları. cols × rows = N delik.
function _veFEAToplPlate(p) {
  var L = Math.max(5, p.length || 120);
  var W = Math.max(5, p.width  || 80);
  var T = Math.max(0.5, p.thickness || 8);
  var hL = L/2, hW = W/2, hT = T/2;
  // 0 (deliksiz) ile undefined ayrımı
  var holeD = (p.holeDiameter !== undefined && p.holeDiameter !== null) ? Math.max(0, p.holeDiameter) : 9;
  var cols = Math.max(1, Math.round(p.cols || 2));
  var rows = Math.max(1, Math.round(p.rows || 2));
  var margin = Math.max(0, +p.margin || 15);
  var holeR = holeD / 2;
  var holeArea = Math.PI * holeR * holeR;
  var hasHoles = holeR > 0;
  var n = hasHoles ? cols * rows : 0;
  var plateAreaFull = L * W;
  var plateAreaAnn  = Math.max(0, plateAreaFull - n * holeArea);
  var sideX = W * T;        // X+/X− yan yüzeyleri
  var sideZ = L * T;        // Z+/Z− yan yüzeyleri (rotateX(-π/2) sonrası Z=W)
  var holeCyl = 2 * Math.PI * holeR * T;
  var faces = [
    { id: 'faceTop',    label: 'Üst Yüzey' + (n > 0 ? ' (' + n + ' delikli)' : ''), type: n > 0 ? 'planar-annular' : 'planar', normal: [0, 1, 0], area: plateAreaAnn, width: L, height: W, centroid:[0, hT, 0] },
    { id: 'faceBottom', label: 'Alt Yüzey' + (n > 0 ? ' (' + n + ' delikli)' : ''), type: n > 0 ? 'planar-annular' : 'planar', normal: [0,-1, 0], area: plateAreaAnn, width: L, height: W, centroid:[0,-hT, 0] },
    { id: 'faceXMin', label: 'X− Yan Yüzey', type: 'planar', normal: [-1, 0, 0], area: sideX, width: W, height: T, centroid:[-hL, 0, 0] },
    { id: 'faceXMax', label: 'X+ Yan Yüzey', type: 'planar', normal: [ 1, 0, 0], area: sideX, width: W, height: T, centroid:[ hL, 0, 0] },
    { id: 'faceZMin', label: 'Z− Yan Yüzey', type: 'planar', normal: [ 0, 0,-1], area: sideZ, width: L, height: T, centroid:[0, 0, -hW] },
    { id: 'faceZMax', label: 'Z+ Yan Yüzey', type: 'planar', normal: [ 0, 0, 1], area: sideZ, width: L, height: T, centroid:[0, 0,  hW] }
  ];
  // Her delik için ayrı silindirik iç yüzey + merkez konumu hesabı
  // Delikler grid içine eşit dağıtılır. fea-primitives.js'teki yerleşim ile uyumlu olması için
  // basit bir grid: X ekseni cols (length), Z ekseni rows (width). Merkez (0,0,0).
  var holeCentres = [];
  if (hasHoles) {
    var stepX = (cols > 1) ? (L - 2 * margin) / (cols - 1) : 0;
    var stepZ = (rows > 1) ? (W - 2 * margin) / (rows - 1) : 0;
    var startX = (cols > 1) ? -hL + margin : 0;
    var startZ = (rows > 1) ? -hW + margin : 0;
    for (var i = 0; i < n; i++) {
      var ci = i % cols, ri = Math.floor(i / cols);
      var hx = startX + ci * stepX;
      var hz = startZ + ri * stepZ;
      holeCentres.push({ x: hx, z: hz, ri: ri, ci: ci });
      faces.push({
        id: 'faceHole_' + ri + '_' + ci,
        label: 'Delik #' + (i + 1) + ' (' + (ri + 1) + '×' + (ci + 1) + ')',
        type: 'cylindrical',
        area: holeCyl, radius: holeR, length: T,
        axis: [0, 1, 0], center: [hx, 0, hz],
        centroid: [hx, 0, hz],
        isHole: true
      });
    }
  }
  // 8 vertex (plate corners)
  var cornerSigns = [[-1,-1,-1], [1,-1,-1], [-1,-1, 1], [1,-1, 1], [-1, 1,-1], [1, 1,-1], [-1, 1, 1], [1, 1, 1]];
  var cornerLabels = ['XmYmZm','XpYmZm','XmYmZp','XpYmZp','XmYpZm','XpYpZm','XmYpZp','XpYpZp'];
  var vertices = cornerSigns.map(function(s, idx) {
    return {
      id: 'vP_' + cornerLabels[idx],
      label: 'Plaka Köşe ' + cornerLabels[idx],
      position: [s[0]*hL, s[1]*hT, s[2]*hW],
      faceIds: []
    };
  });
  function _vPid(s) { return 'vP_' + cornerLabels[cornerSigns.findIndex(function(cs){return cs[0]===s[0]&&cs[1]===s[1]&&cs[2]===s[2];})]; }
  // 12 plate edge
  var edges = [
    // Üst yüz (Y+) 4 edge'i
    { id: 'eP_TopX_Zm', label: 'Üst X-Kenar (Z−)', type:'line', length: L, p1:[-hL, hT,-hW], p2:[ hL, hT,-hW], polyline:_veFEALinePolyline([-hL, hT,-hW],[ hL, hT,-hW]), faceIds:['faceTop','faceZMin'], vertexIds:[_vPid([-1,1,-1]), _vPid([1,1,-1])] },
    { id: 'eP_TopX_Zp', label: 'Üst X-Kenar (Z+)', type:'line', length: L, p1:[-hL, hT, hW], p2:[ hL, hT, hW], polyline:_veFEALinePolyline([-hL, hT, hW],[ hL, hT, hW]), faceIds:['faceTop','faceZMax'], vertexIds:[_vPid([-1,1,1]), _vPid([1,1,1])] },
    { id: 'eP_TopZ_Xm', label: 'Üst Z-Kenar (X−)', type:'line', length: W, p1:[-hL, hT,-hW], p2:[-hL, hT, hW], polyline:_veFEALinePolyline([-hL, hT,-hW],[-hL, hT, hW]), faceIds:['faceTop','faceXMin'], vertexIds:[_vPid([-1,1,-1]), _vPid([-1,1,1])] },
    { id: 'eP_TopZ_Xp', label: 'Üst Z-Kenar (X+)', type:'line', length: W, p1:[ hL, hT,-hW], p2:[ hL, hT, hW], polyline:_veFEALinePolyline([ hL, hT,-hW],[ hL, hT, hW]), faceIds:['faceTop','faceXMax'], vertexIds:[_vPid([1,1,-1]), _vPid([1,1,1])] },
    // Alt yüz (Y−) 4 edge'i
    { id: 'eP_BotX_Zm', label: 'Alt X-Kenar (Z−)', type:'line', length: L, p1:[-hL,-hT,-hW], p2:[ hL,-hT,-hW], polyline:_veFEALinePolyline([-hL,-hT,-hW],[ hL,-hT,-hW]), faceIds:['faceBottom','faceZMin'], vertexIds:[_vPid([-1,-1,-1]), _vPid([1,-1,-1])] },
    { id: 'eP_BotX_Zp', label: 'Alt X-Kenar (Z+)', type:'line', length: L, p1:[-hL,-hT, hW], p2:[ hL,-hT, hW], polyline:_veFEALinePolyline([-hL,-hT, hW],[ hL,-hT, hW]), faceIds:['faceBottom','faceZMax'], vertexIds:[_vPid([-1,-1,1]), _vPid([1,-1,1])] },
    { id: 'eP_BotZ_Xm', label: 'Alt Z-Kenar (X−)', type:'line', length: W, p1:[-hL,-hT,-hW], p2:[-hL,-hT, hW], polyline:_veFEALinePolyline([-hL,-hT,-hW],[-hL,-hT, hW]), faceIds:['faceBottom','faceXMin'], vertexIds:[_vPid([-1,-1,-1]), _vPid([-1,-1,1])] },
    { id: 'eP_BotZ_Xp', label: 'Alt Z-Kenar (X+)', type:'line', length: W, p1:[ hL,-hT,-hW], p2:[ hL,-hT, hW], polyline:_veFEALinePolyline([ hL,-hT,-hW],[ hL,-hT, hW]), faceIds:['faceBottom','faceXMax'], vertexIds:[_vPid([1,-1,-1]), _vPid([1,-1,1])] },
    // Dikey 4 edge
    { id: 'eP_Y_XmZm', label: 'Dikey Kenar (X−,Z−)', type:'line', length: T, p1:[-hL,-hT,-hW], p2:[-hL, hT,-hW], polyline:_veFEALinePolyline([-hL,-hT,-hW],[-hL, hT,-hW]), faceIds:['faceXMin','faceZMin'], vertexIds:[_vPid([-1,-1,-1]), _vPid([-1,1,-1])] },
    { id: 'eP_Y_XpZm', label: 'Dikey Kenar (X+,Z−)', type:'line', length: T, p1:[ hL,-hT,-hW], p2:[ hL, hT,-hW], polyline:_veFEALinePolyline([ hL,-hT,-hW],[ hL, hT,-hW]), faceIds:['faceXMax','faceZMin'], vertexIds:[_vPid([1,-1,-1]), _vPid([1,1,-1])] },
    { id: 'eP_Y_XmZp', label: 'Dikey Kenar (X−,Z+)', type:'line', length: T, p1:[-hL,-hT, hW], p2:[-hL, hT, hW], polyline:_veFEALinePolyline([-hL,-hT, hW],[-hL, hT, hW]), faceIds:['faceXMin','faceZMax'], vertexIds:[_vPid([-1,-1,1]), _vPid([-1,1,1])] },
    { id: 'eP_Y_XpZp', label: 'Dikey Kenar (X+,Z+)', type:'line', length: T, p1:[ hL,-hT, hW], p2:[ hL, hT, hW], polyline:_veFEALinePolyline([ hL,-hT, hW],[ hL, hT, hW]), faceIds:['faceXMax','faceZMax'], vertexIds:[_vPid([1,-1,1]), _vPid([1,1,1])] }
  ];
  // Her delik için 2 daire edge (üst + alt)
  holeCentres.forEach(function(hc) {
    var fHole = 'faceHole_' + hc.ri + '_' + hc.ci;
    edges.push({
      id: 'eP_HoleTop_' + hc.ri + '_' + hc.ci,
      label: 'Delik Üst Dairesi (' + (hc.ri + 1) + '×' + (hc.ci + 1) + ')',
      type: 'circle', length: 2 * Math.PI * holeR, radius: holeR,
      center: [hc.x, hT, hc.z], axis: [0, 1, 0],
      polyline: _veFEACirclePolyline([hc.x, hT, hc.z], [0,1,0], holeR, 48),
      faceIds: ['faceTop', fHole], vertexIds: [], isHole: true
    });
    edges.push({
      id: 'eP_HoleBot_' + hc.ri + '_' + hc.ci,
      label: 'Delik Alt Dairesi (' + (hc.ri + 1) + '×' + (hc.ci + 1) + ')',
      type: 'circle', length: 2 * Math.PI * holeR, radius: holeR,
      center: [hc.x, -hT, hc.z], axis: [0, 1, 0],
      polyline: _veFEACirclePolyline([hc.x, -hT, hc.z], [0,1,0], holeR, 48),
      faceIds: ['faceBottom', fHole], vertexIds: [], isHole: true
    });
  });
  return {
    type: 'plate',
    faces: faces,
    edges: edges,
    vertices: vertices,
    totalSurfaceArea: 2 * plateAreaAnn + 2 * sideX + 2 * sideZ + n * holeCyl,
    volume: plateAreaAnn * T,
    bbox: { x: L, y: T, z: W }
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
    // STEP mesh'inden detaylı edge ve vertex extraction (Three.js varsa)
    var stepEdges = [];
    var stepVertices = [];
    if (typeof THREE !== 'undefined' && geom.parsedMesh && geom.parsedMesh.triangles) {
      try {
        var stepMesh = _veFEABuildStepThreeMesh(geom.parsedMesh);
        if (stepMesh) {
          stepEdges = _veFEAExtractMeshEdges([stepMesh], 30, 5);
          stepVertices = _veFEAExtractMeshVertices(stepEdges);
        }
      } catch (e) {
        // sessiz fail — fallback edge count'a düşer
      }
    }
    return {
      type: geom.type,
      faces: faces,
      edges:    stepEdges.length > 0 ? stepEdges : (
        det.edgeStats ? { count: det.edgeStats.total, sharp: det.edgeStats.sharp, smooth: det.edgeStats.smooth } : { count: 0 }
      ),
      vertices: stepVertices.length > 0 ? stepVertices : { count: det.uniqueVertices || 0 },
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

// STEP parsed mesh'inden Three.js Mesh oluştur (edge extraction için).
// parsedMesh: { triangles: [{v1, v2, v3, normal?}, ...] }
function _veFEABuildStepThreeMesh(parsed) {
  if (typeof THREE === 'undefined' || !parsed || !parsed.triangles || parsed.triangles.length === 0) return null;
  var tris = parsed.triangles;
  var positions = new Float32Array(tris.length * 9);
  for (var i = 0; i < tris.length; i++) {
    var t = tris[i];
    positions[i*9 + 0] = t.v1[0]; positions[i*9 + 1] = t.v1[1]; positions[i*9 + 2] = t.v1[2];
    positions[i*9 + 3] = t.v2[0]; positions[i*9 + 4] = t.v2[1]; positions[i*9 + 5] = t.v2[2];
    positions[i*9 + 6] = t.v3[0]; positions[i*9 + 7] = t.v3[1]; positions[i*9 + 8] = t.v3[2];
  }
  var geom = new THREE.BufferGeometry();
  geom.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geom.computeVertexNormals();
  var mat = new THREE.MeshBasicMaterial();
  var mesh = new THREE.Mesh(geom, mat);
  mesh.updateMatrixWorld(true);
  return mesh;
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

// ════════════════════════════════════════════════════════════════════════════
// GENERIC TOPOLOGY ANALYZER — Three.js mesh'inden tam BREP-benzeri topology
// ════════════════════════════════════════════════════════════════════════════
// Pipeline (her geometri tipi için aynı — primitif ya da generic):
//   1) Mesh'ten flat vertex buffer çıkar (world space)
//   2) Vertex dedup (epsilon-bucket) → canonical vertex index
//   3) Triangle adjacency (her üçgenin 3 komşusu) + edge angle (dihedral)
//   4) Smooth region clustering (BFS, normal açısı < smoothThreshold)
//   5) Her cluster'ı sınıflandır: planar / cylindrical / spherical / conical / freeform
//   6) Sharp edge'leri tespit (dihedral > sharpThreshold)
//   7) Sharp edge segment'lerini chain'lerle birleştir → polyline edge'ler
//   8) Curve fitting (line / circle / arc / ellipse / spline)
//   9) Edge ↔ face bağı — edge'in iki yanındaki triangle'ların cluster ID'leri
//  10) Vertex ↔ face / edge bağı — vertex'e değen tüm üçgenlerin cluster'ları
//  11) Hint mapping — mesh.userData.feaFaceMap varsa face ID'leri korunur
//      (primitif geometriler için face ID'leri namedSelections ile uyumlu kalır)
function _veFEAToplGeneric(geometry) {
  if (typeof THREE === 'undefined' || typeof veFEABuildPrimitiveMesh !== 'function') {
    return _veFEAToplGenericMinimal(geometry);
  }
  var p = geometry.params || {};
  var meshOrGroup;
  try {
    meshOrGroup = veFEABuildPrimitiveMesh(geometry.type, p);
  } catch (e) {
    console.warn('[FEA Topology] generic build failed:', e.message);
    return _veFEAToplGenericMinimal(geometry);
  }
  if (!meshOrGroup) return _veFEAToplGenericMinimal(geometry);
  return _veFEAExtractFullTopology(meshOrGroup, geometry);
}

// Universal topology extractor — Three.js mesh/group'tan tam topology üretir.
// Hint: mesh.userData.feaFaceMap[matIndex] = faceId (primitif → mevcut ID'leri koru)
// Hint: mesh.userData.feaFaceId = faceId (group child = tek face mesh)
function _veFEAExtractFullTopology(meshOrGroup, geometry) {
  var meshes = [];
  meshOrGroup.traverse(function (o) { if (o.isMesh && o.geometry) meshes.push(o); });
  if (meshes.length === 0) return _veFEAToplGenericMinimal(geometry || {});

  // 1) Mesh'ten flat vertex buffer + per-triangle hint (feaFaceId/feaFaceMap)
  var vertsArr = [];   // [x,y,z, x,y,z, ...] world space
  var triHints = [];   // her üçgen için: { faceId: string | null }
  var totalVolume = 0;
  meshes.forEach(function (m) {
    var geo = m.geometry;
    geo.computeVertexNormals();
    var pos = geo.attributes.position;
    var idx = geo.index;
    var groups = (Array.isArray(geo.groups) && geo.groups.length > 0) ? geo.groups : null;
    var triCount = idx ? (idx.count / 3) : (pos.count / 3);
    var v1 = new THREE.Vector3(), v2 = new THREE.Vector3(), v3 = new THREE.Vector3();
    var faceMap = m.userData && Array.isArray(m.userData.feaFaceMap) ? m.userData.feaFaceMap : null;
    var faceIdSingle = m.userData && m.userData.feaFaceId ? m.userData.feaFaceId : null;
    for (var i = 0; i < triCount; i++) {
      var a, b, c;
      if (idx) { a = idx.getX(i*3); b = idx.getX(i*3+1); c = idx.getX(i*3+2); }
      else     { a = i*3; b = i*3+1; c = i*3+2; }
      v1.fromBufferAttribute(pos, a);
      v2.fromBufferAttribute(pos, b);
      v3.fromBufferAttribute(pos, c);
      v1.applyMatrix4(m.matrixWorld);
      v2.applyMatrix4(m.matrixWorld);
      v3.applyMatrix4(m.matrixWorld);
      var ux = v2.x - v1.x, uy = v2.y - v1.y, uz = v2.z - v1.z;
      var vx = v3.x - v1.x, vy = v3.y - v1.y, vz = v3.z - v1.z;
      var cx = uy*vz - uz*vy, cy = uz*vx - ux*vz, cz = ux*vy - uy*vx;
      var area = 0.5 * Math.sqrt(cx*cx + cy*cy + cz*cz);
      if (area < 1e-12) continue;  // dejenere
      vertsArr.push(v1.x, v1.y, v1.z, v2.x, v2.y, v2.z, v3.x, v3.y, v3.z);
      // Hint: hangi face'e ait?
      var hint = null;
      if (faceIdSingle) hint = faceIdSingle;
      else if (faceMap && groups) {
        // Üçgen indeksinin hangi group'a düştüğünü bul
        var triStart3 = i * 3;
        for (var gi = 0; gi < groups.length; gi++) {
          var g = groups[gi];
          if (triStart3 >= g.start && triStart3 < g.start + g.count) {
            hint = faceMap[g.materialIndex];
            break;
          }
        }
      }
      triHints.push(hint);
      // Signed tetrahedra hacim
      var crossX = v2.y*v3.z - v2.z*v3.y;
      var crossY = v2.z*v3.x - v2.x*v3.z;
      var crossZ = v2.x*v3.y - v2.y*v3.x;
      totalVolume += (v1.x * crossX + v1.y * crossY + v1.z * crossZ) / 6;
    }
  });
  var triCount = triHints.length;
  if (triCount === 0) return _veFEAToplGenericMinimal(geometry || {});
  var verticesF32 = new Float32Array(vertsArr);

  // 2) Bbox + vertex dedup
  var bb = { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity, minZ: Infinity, maxZ: -Infinity };
  for (var bi = 0; bi < verticesF32.length; bi += 3) {
    if (verticesF32[bi]   < bb.minX) bb.minX = verticesF32[bi];   if (verticesF32[bi]   > bb.maxX) bb.maxX = verticesF32[bi];
    if (verticesF32[bi+1] < bb.minY) bb.minY = verticesF32[bi+1]; if (verticesF32[bi+1] > bb.maxY) bb.maxY = verticesF32[bi+1];
    if (verticesF32[bi+2] < bb.minZ) bb.minZ = verticesF32[bi+2]; if (verticesF32[bi+2] > bb.maxZ) bb.maxZ = verticesF32[bi+2];
  }
  var bboxSize = Math.max(bb.maxX - bb.minX, bb.maxY - bb.minY, bb.maxZ - bb.minZ);
  var dedupRes = (typeof veFEADedupVertices === 'function')
    ? veFEADedupVertices(verticesF32, { bboxSize: bboxSize })
    : _veFEADedupVerticesFallback(verticesF32, bboxSize);
  var canonical = dedupRes.canonical;
  var uniqueVerts = dedupRes.unique;

  // 3) Triangle data + adjacency
  var triData = _veFEATopoTriangleData(verticesF32, triCount);
  var adj = _veFEATopoTriangleAdjacency(canonical, triCount, triData.normals);

  // 4) Smooth region clustering — 30° tolerans (silindir N=8 segment için ≥45°,
  //    silindir N=16 için ≥22.5°. Generic motor 30° dengeli: kutu kenarları
  //    90°, prizma kenarları 60°+ olduğu için cluster'ları bölmez)
  var smoothCos = Math.cos(30 * Math.PI / 180);
  var clustered = _veFEATopoClusterSmoothRegions(adj, triCount, smoothCos);

  // 5) Cluster classification → face listesi
  // Hint dağılımına bak: cluster'daki üçgenlerin çoğu aynı hint'i taşıyorsa
  // o cluster ID'sini hint'ten al (primitif geometri için namedSelections uyumu).
  var faces = [];
  var clusterToFaceIdx = new Int32Array(clustered.clusters.length);
  for (var ci = 0; ci < clustered.clusters.length; ci++) {
    var cl = clustered.clusters[ci];
    // Hint majority — cluster'ın çoğu hangi faceId'ye işaret ediyor?
    var hintCount = {};
    for (var ti = 0; ti < cl.triangleIds.length; ti++) {
      var hh = triHints[cl.triangleIds[ti]];
      if (hh) hintCount[hh] = (hintCount[hh] || 0) + 1;
    }
    var bestHint = null, bestCt = 0;
    for (var hkey in hintCount) {
      if (hintCount[hkey] > bestCt) { bestCt = hintCount[hkey]; bestHint = hkey; }
    }
    var feat = _veFEATopoClassifyCluster(cl, triData, 0.001);
    var faceId = bestHint || ('faceP_' + faces.length);
    var face = {
      id: faceId,
      label: _veFEAGenericFaceLabel(feat, faces.length, bestHint),
      type: _veFEAFeatureTypeToBrepLabel(feat.type),
      area: feat.area || 0,
      triangleCount: cl.triangleIds.length,
      triangleIds: cl.triangleIds.slice(),
      edgeIds: [],
      vertexIds: []
    };
    if (feat.type === 'planar' && feat.normal) face.normal = feat.normal.slice();
    if (feat.type === 'cylindrical') {
      face.axis = feat.axis ? feat.axis.slice() : [0,1,0];
      face.radius = feat.radius;
      face.length = feat.length;
      face.center = feat.centroid ? feat.centroid.slice() : null;
    }
    if (feat.type === 'spherical') {
      face.center = feat.center ? feat.center.slice() : null;
      face.radius = feat.radius;
    }
    if (feat.type === 'conical' && feat.axis) {
      face.axis = feat.axis.slice();
    }
    face.centroid = feat.centroid ? feat.centroid.slice() : null;
    clusterToFaceIdx[ci] = faces.length;
    faces.push(face);
  }
  // Tek bir cluster'a düşmeyen üçgenler için fallback (gerçekleşmemeli ama defansif)
  // — labels[i] >= 0 garanti

  // 6-9) Sharp edge extraction with face binding
  var sharpCos = Math.cos(30 * Math.PI / 180);
  var edges = _veFEATopoExtractEdgesWithFaceBinding(
    adj, triCount, canonical, uniqueVerts, clustered.labels, faces, clusterToFaceIdx, sharpCos
  );
  // edge.id → faces[i].edgeIds
  edges.forEach(function(e) {
    e.faceIds.forEach(function(fid) {
      var f = faces.find(function(ff) { return ff.id === fid; });
      if (f && f.edgeIds.indexOf(e.id) < 0) f.edgeIds.push(e.id);
    });
  });

  // 10) Vertex extraction with face/edge binding
  var vertices = _veFEATopoExtractVerticesWithBindings(edges, clustered.labels, canonical, uniqueVerts, faces, clusterToFaceIdx);
  vertices.forEach(function(v) {
    v.faceIds.forEach(function(fid) {
      var f = faces.find(function(ff) { return ff.id === fid; });
      if (f && f.vertexIds.indexOf(v.id) < 0) f.vertexIds.push(v.id);
    });
  });

  // Toplam alan
  var totalArea = 0;
  for (var t2 = 0; t2 < triCount; t2++) totalArea += triData.areas[t2];

  return {
    type: geometry ? geometry.type : 'generic',
    faces: faces,
    edges: edges,
    vertices: vertices,
    totalSurfaceArea: totalArea,
    volume: Math.abs(totalVolume),
    bbox: { x: bb.maxX - bb.minX, y: bb.maxY - bb.minY, z: bb.maxZ - bb.minZ },
    generic: true
  };
}

// ─── Yardımcılar (feature-recognition'dan port) ────────────────────────────
function _veFEATopoTriangleData(vertices, triCount) {
  var normals = new Float32Array(triCount * 3);
  var areas = new Float32Array(triCount);
  var centroids = new Float32Array(triCount * 3);
  for (var t = 0; t < triCount; t++) {
    var o = t * 9;
    var ax = vertices[o],     ay = vertices[o + 1], az = vertices[o + 2];
    var bx = vertices[o + 3], by = vertices[o + 4], bz = vertices[o + 5];
    var cx = vertices[o + 6], cy = vertices[o + 7], cz = vertices[o + 8];
    var ux = bx - ax, uy = by - ay, uz = bz - az;
    var vx = cx - ax, vy = cy - ay, vz = cz - az;
    var nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    var len = Math.sqrt(nx * nx + ny * ny + nz * nz);
    var area = 0.5 * len;
    if (len > 1e-20) { nx /= len; ny /= len; nz /= len; }
    var no = t * 3;
    normals[no] = nx; normals[no + 1] = ny; normals[no + 2] = nz;
    areas[t] = area;
    centroids[no]     = (ax + bx + cx) / 3;
    centroids[no + 1] = (ay + by + cy) / 3;
    centroids[no + 2] = (az + bz + cz) / 3;
  }
  return { normals: normals, areas: areas, centroids: centroids };
}

function _veFEATopoTriangleAdjacency(canonical, triCount, normals) {
  var edgeMap = new Map();
  var neighbors = new Int32Array(triCount * 3);
  for (var i = 0; i < neighbors.length; i++) neighbors[i] = -1;
  var edgeAngles = new Float32Array(triCount * 3);
  for (var t = 0; t < triCount; t++) {
    var v0 = canonical[t * 3];
    var v1 = canonical[t * 3 + 1];
    var v2 = canonical[t * 3 + 2];
    var triEdges = [[v0, v1], [v1, v2], [v2, v0]];
    for (var e = 0; e < 3; e++) {
      var a = triEdges[e][0], b = triEdges[e][1];
      var key = (a < b) ? (a + '|' + b) : (b + '|' + a);
      var ex = edgeMap.get(key);
      if (ex === undefined) {
        edgeMap.set(key, { tri: t, slot: e });
      } else {
        neighbors[t * 3 + e] = ex.tri;
        neighbors[ex.tri * 3 + ex.slot] = t;
        var n1x = normals[t * 3],     n1y = normals[t * 3 + 1],     n1z = normals[t * 3 + 2];
        var n2x = normals[ex.tri * 3], n2y = normals[ex.tri * 3 + 1], n2z = normals[ex.tri * 3 + 2];
        var cc = n1x * n2x + n1y * n2y + n1z * n2z;
        edgeAngles[t * 3 + e] = cc;
        edgeAngles[ex.tri * 3 + ex.slot] = cc;
        edgeMap.delete(key);
      }
    }
  }
  return { neighbors: neighbors, edgeAngles: edgeAngles };
}

function _veFEATopoClusterSmoothRegions(adj, triCount, smoothCosThreshold) {
  var labels = new Int32Array(triCount);
  for (var i = 0; i < triCount; i++) labels[i] = -1;
  var clusters = [];
  var queue = new Int32Array(triCount);
  for (var seed = 0; seed < triCount; seed++) {
    if (labels[seed] !== -1) continue;
    var label = clusters.length;
    labels[seed] = label;
    var qHead = 0, qTail = 0;
    queue[qTail++] = seed;
    var members = [];
    while (qHead < qTail) {
      var tri = queue[qHead++];
      members.push(tri);
      for (var e = 0; e < 3; e++) {
        var nb = adj.neighbors[tri * 3 + e];
        if (nb < 0 || labels[nb] !== -1) continue;
        var ca = adj.edgeAngles[tri * 3 + e];
        if (ca >= smoothCosThreshold) {
          labels[nb] = label;
          queue[qTail++] = nb;
        }
      }
    }
    clusters.push({ id: label, triangleIds: members });
  }
  return { labels: labels, clusters: clusters };
}

function _veFEATopoClassifyCluster(cluster, triData, planarVarianceLimit) {
  var ids = cluster.triangleIds;
  var n = ids.length;
  var totalArea = 0;
  var nxSum = 0, nySum = 0, nzSum = 0;
  var cxSum = 0, cySum = 0, czSum = 0;
  for (var i = 0; i < n; i++) {
    var t = ids[i];
    var w = triData.areas[t];
    totalArea += w;
    nxSum += triData.normals[t * 3] * w;
    nySum += triData.normals[t * 3 + 1] * w;
    nzSum += triData.normals[t * 3 + 2] * w;
    cxSum += triData.centroids[t * 3] * w;
    cySum += triData.centroids[t * 3 + 1] * w;
    czSum += triData.centroids[t * 3 + 2] * w;
  }
  if (totalArea < 1e-20) return { type: 'degenerate', area: 0, triangleIds: ids };
  var avgN = [nxSum / totalArea, nySum / totalArea, nzSum / totalArea];
  var lenN = Math.sqrt(avgN[0]*avgN[0] + avgN[1]*avgN[1] + avgN[2]*avgN[2]);
  var avgCentroid = [cxSum / totalArea, cySum / totalArea, czSum / totalArea];
  var varN = 0;
  for (var j = 0; j < n; j++) {
    var t2 = ids[j];
    var dx = triData.normals[t2 * 3]     - avgN[0];
    var dy = triData.normals[t2 * 3 + 1] - avgN[1];
    var dz = triData.normals[t2 * 3 + 2] - avgN[2];
    varN += (dx * dx + dy * dy + dz * dz) * triData.areas[t2];
  }
  varN /= totalArea;
  if (varN < planarVarianceLimit && lenN > 0.99) {
    return {
      type: 'planar', area: totalArea,
      normal: [avgN[0] / lenN, avgN[1] / lenN, avgN[2] / lenN],
      centroid: avgCentroid, triangleIds: ids
    };
  }
  // Cylinder fit
  var cylFit = (typeof _veFEAFitCylinderToCluster === 'function')
    ? _veFEAFitCylinderToCluster(cluster, triData) : null;
  if (cylFit && cylFit.residual < 0.05) {
    return {
      type: 'cylindrical', area: totalArea,
      axis: cylFit.axis, centroid: cylFit.center,
      radius: cylFit.radius, length: cylFit.length,
      residual: cylFit.residual, triangleIds: ids
    };
  }
  // Sphere fit
  var sphFit = (typeof _veFEAFitSphereToCluster === 'function')
    ? _veFEAFitSphereToCluster(cluster, triData) : null;
  if (sphFit && sphFit.residual < 0.05) {
    return {
      type: 'spherical', area: totalArea,
      center: sphFit.center, radius: sphFit.radius,
      centroid: sphFit.center,
      residual: sphFit.residual, triangleIds: ids
    };
  }
  return {
    type: 'freeform', area: totalArea,
    normal: lenN > 1e-10 ? [avgN[0]/lenN, avgN[1]/lenN, avgN[2]/lenN] : [0,0,1],
    centroid: avgCentroid, normalVariance: varN, triangleIds: ids
  };
}

function _veFEAGenericFaceLabel(feat, fallbackIdx, hint) {
  if (hint) return hint;
  var t = feat.type;
  if (t === 'planar')      return 'Düzlemsel Yüzey #' + (fallbackIdx + 1);
  if (t === 'cylindrical') return 'Silindirik Yüzey #' + (fallbackIdx + 1) + ' (R≈' + (feat.radius || 0).toFixed(1) + ')';
  if (t === 'spherical')   return 'Küresel Yüzey #' + (fallbackIdx + 1) + ' (R≈' + (feat.radius || 0).toFixed(1) + ')';
  if (t === 'conical')     return 'Konik Yüzey #' + (fallbackIdx + 1);
  if (t === 'freeform')    return 'Serbest Yüzey #' + (fallbackIdx + 1);
  return 'Yüzey #' + (fallbackIdx + 1);
}

// ════════════════════════════════════════════════════════════════════════════
// Edge extraction with face binding
// Sharp edge: dihedral > sharpThreshold. Bu kenarın iki tarafındaki üçgenlerin
// cluster ID'lerini kaydet — edge.faceIds bu cluster'ların face ID'leri olur.
// Sharp edge segment'lerini chain'lerle birleştir, curve fitting yap.
// ════════════════════════════════════════════════════════════════════════════
function _veFEATopoExtractEdgesWithFaceBinding(adj, triCount, canonical, uniqueVerts, labels, faces, clusterToFaceIdx, sharpCos) {
  // Sharp segment listesi: { v1, v2, leftCluster, rightCluster }
  // v1, v2: unique vertex index
  // leftCluster: tri'nin cluster ID'si, rightCluster: komşu tri'nin cluster ID'si
  var segments = [];
  var segSeen = {};
  for (var t = 0; t < triCount; t++) {
    var labT = labels[t];
    for (var e = 0; e < 3; e++) {
      var nb = adj.neighbors[t * 3 + e];
      if (nb < 0) continue;
      if (nb < t) continue;  // double-count engelle
      var ca = adj.edgeAngles[t * 3 + e];
      // Sharp veya cluster-sınırı edge
      var labNb = labels[nb];
      var isSharp = (ca < sharpCos);
      var isClusterBoundary = (labT !== labNb);
      if (!isSharp && !isClusterBoundary) continue;
      // Kenar canonical vertex çifti
      var triBase = t * 3;
      var va = canonical[triBase + e];
      var vb = canonical[triBase + ((e + 1) % 3)];
      var lo = Math.min(va, vb), hi = Math.max(va, vb);
      var key = lo + '|' + hi;
      if (segSeen[key]) continue;
      segSeen[key] = true;
      segments.push({
        v1: va, v2: vb,
        leftCluster: labT,
        rightCluster: labNb,
        isSharp: isSharp,
        isClusterBoundary: isClusterBoundary,
        dihedralCos: ca
      });
    }
  }
  if (segments.length === 0) return [];

  // Komşu segment grafiği — vertex paylaşıyorsa ve aynı (leftCluster, rightCluster)
  // çiftine sahipse (yani aynı face pair'ı ayırıyorsa) chain'leyebiliriz.
  var vertAdj = {};
  segments.forEach(function(s, idx) {
    if (!vertAdj[s.v1]) vertAdj[s.v1] = [];
    if (!vertAdj[s.v2]) vertAdj[s.v2] = [];
    vertAdj[s.v1].push(idx);
    vertAdj[s.v2].push(idx);
  });

  // Aynı face pair'ını paylaşan segment'leri chain'le
  var visited = new Array(segments.length);
  var edges = [];
  function _pairKey(a, b) { return (a < b) ? (a + '_' + b) : (b + '_' + a); }
  function _segPair(s) { return _pairKey(s.leftCluster, s.rightCluster); }

  for (var si = 0; si < segments.length; si++) {
    if (visited[si]) continue;
    visited[si] = true;
    var chain = [segments[si].v1, segments[si].v2];
    var pairKey = _segPair(segments[si]);
    // İki yöne uzat
    function _extend(fromEnd) {
      var changed = true;
      while (changed) {
        changed = false;
        var endVi = chain[fromEnd === 0 ? 0 : chain.length-1];
        var neighbors = vertAdj[endVi] || [];
        // Aynı face-pair'ına ait olup unvisited tek bir komşu olmalı
        var candidates = neighbors.filter(function(ni) {
          if (visited[ni]) return false;
          return _segPair(segments[ni]) === pairKey;
        });
        if (candidates.length !== 1) break;
        var cand = segments[candidates[0]];
        var otherVi = (cand.v1 === endVi) ? cand.v2 : cand.v1;
        if (chain.indexOf(otherVi) >= 0 && !(fromEnd === 0 && otherVi === chain[chain.length-1]) && !(fromEnd === 1 && otherVi === chain[0])) {
          // Loop oluşacak — sadece tam closure ise kabul (full circle)
          if ((fromEnd === 0 && otherVi === chain[chain.length-1]) || (fromEnd === 1 && otherVi === chain[0])) {
            visited[candidates[0]] = true;
            if (fromEnd === 0) chain.unshift(otherVi);
            else                chain.push(otherVi);
          }
          break;
        }
        visited[candidates[0]] = true;
        if (fromEnd === 0) chain.unshift(otherVi);
        else                chain.push(otherVi);
        changed = true;
      }
    }
    _extend(1);
    _extend(0);
    // Polyline çıkar
    var polyline = chain.map(function(vi) {
      return [uniqueVerts[vi*3], uniqueVerts[vi*3+1], uniqueVerts[vi*3+2]];
    });
    // Curve fitting
    var fit = veFEAFitCurveToPolyline(polyline);
    var faceIds = [];
    var s0 = segments[si];
    if (s0.leftCluster >= 0 && s0.leftCluster < clusterToFaceIdx.length)  faceIds.push(faces[clusterToFaceIdx[s0.leftCluster]].id);
    if (s0.rightCluster >= 0 && s0.rightCluster < clusterToFaceIdx.length) {
      var fId2 = faces[clusterToFaceIdx[s0.rightCluster]].id;
      if (faceIds.indexOf(fId2) < 0) faceIds.push(fId2);
    }
    var typeLbl = (fit.type === 'circle' ? 'Daire' : fit.type === 'arc' ? 'Yay' :
                   fit.type === 'ellipse' ? 'Eliptik' : fit.type === 'spline' ? 'Eğri' : 'Doğru');
    var edge = {
      id: 'eGen_' + edges.length,
      label: typeLbl + ' Kenar #' + (edges.length + 1),
      type: fit.type,
      length: fit.length,
      polyline: polyline,
      faceIds: faceIds,
      vertexIds: []
    };
    if (fit.type === 'line') {
      edge.p1 = fit.p1; edge.p2 = fit.p2; edge.direction = fit.direction;
    } else if (fit.type === 'circle' || fit.type === 'arc') {
      edge.center = fit.center; edge.axis = fit.axis; edge.radius = fit.radius;
      edge.startAngle = fit.startAngle; edge.endAngle = fit.endAngle;
      edge.isFullCircle = fit.isFullCircle;
    } else if (fit.type === 'ellipse') {
      edge.center = fit.center; edge.axis = fit.axis;
      edge.semiMajor = fit.semiMajor; edge.semiMinor = fit.semiMinor;
      edge.majorAxis = fit.majorAxis;
    } else if (fit.type === 'spline') {
      edge.controlPoints = fit.controlPoints;
    }
    edges.push(edge);
  }
  return edges;
}

// Vertex extraction with face/edge binding.
// Her edge endpoint'i bir vertex — endpoint'e değen tüm üçgenlerin cluster'larını
// topla → vertex.faceIds.
function _veFEATopoExtractVerticesWithBindings(edges, labels, canonical, uniqueVerts, faces, clusterToFaceIdx) {
  if (!Array.isArray(edges) || edges.length === 0) return [];
  // Endpoint canonical vertex indekslerini topla
  // edge.polyline endpoint'i = uniqueVerts'ten gelir; polyline[0] ve polyline[n-1]
  // hangi canonical vertex'i? Bunu polyline coord'undan tersinden bulamayız temiz;
  // bu yüzden edge oluştururken chain'in ilk/son canonical index'ini saklamamız lazım.
  // Mevcut implementasyonda polyline koordinatlardan; yine de epsilon-match ile bul.
  var endpointSet = {};   // canonicalIdx → { id, edgeIds, ... }
  function _findCanonical(pt) {
    // En yakın unique vertex'i bul (linear; vertex sayısı küçük olduğu için kabul edilebilir).
    // Daha hızlısı için spatial hash kullanılabilir; ama tipik primitif < 100 vertex.
    var bestI = -1, bestD = Infinity;
    for (var vi = 0; vi < uniqueVerts.length; vi += 3) {
      var dx = uniqueVerts[vi]   - pt[0];
      var dy = uniqueVerts[vi+1] - pt[1];
      var dz = uniqueVerts[vi+2] - pt[2];
      var d = dx*dx + dy*dy + dz*dz;
      if (d < bestD) { bestD = d; bestI = vi / 3; }
    }
    return bestI;
  }
  // Triangle vertex-to-triangles map (canonical vertex → triangle ID'leri)
  // labels[t] kullanarak vertex'in komşu cluster'larını çıkaracağız.
  var v2tris = {};
  var triCount = canonical.length / 3;
  for (var t = 0; t < triCount; t++) {
    for (var k = 0; k < 3; k++) {
      var vi = canonical[t*3 + k];
      if (!v2tris[vi]) v2tris[vi] = [];
      v2tris[vi].push(t);
    }
  }
  edges.forEach(function(e) {
    if (!e.polyline || e.polyline.length === 0) return;
    var p0 = e.polyline[0], p1 = e.polyline[e.polyline.length-1];
    [p0, p1].forEach(function(pp) {
      var vi = _findCanonical(pp);
      if (vi < 0) return;
      if (!endpointSet[vi]) {
        var clusterIds = {};
        var tris = v2tris[vi] || [];
        tris.forEach(function(t2) {
          var lab = labels[t2];
          if (lab >= 0 && lab < clusterToFaceIdx.length) {
            clusterIds[faces[clusterToFaceIdx[lab]].id] = true;
          }
        });
        endpointSet[vi] = {
          id: 'vGen_' + Object.keys(endpointSet).length,
          label: 'Köşe #' + (Object.keys(endpointSet).length + 1),
          position: [uniqueVerts[vi*3], uniqueVerts[vi*3+1], uniqueVerts[vi*3+2]],
          edgeIds: [e.id],
          faceIds: Object.keys(clusterIds)
        };
        e.vertexIds.push(endpointSet[vi].id);
      } else {
        if (endpointSet[vi].edgeIds.indexOf(e.id) < 0) endpointSet[vi].edgeIds.push(e.id);
        if (e.vertexIds.indexOf(endpointSet[vi].id) < 0) e.vertexIds.push(endpointSet[vi].id);
      }
    });
  });
  var verts = Object.keys(endpointSet).map(function(k) { return endpointSet[k]; });
  // En az 2 edge'le bağlı vertex'ler — tek-edge dangling endpoint'ler closed loop
  // case'inde olmaz; sadece açık polyline başlangıç/bitiş için bırak.
  return verts.filter(function(v) { return v.edgeIds.length >= 1; });
}

// Fallback dedup — veFEADedupVertices yoksa
function _veFEADedupVerticesFallback(vertices, bboxSize) {
  var eps = Math.max((bboxSize || 1) * 1e-6, 1e-9);
  var invEps = 1 / eps;
  var map = new Map();
  var n = vertices.length / 3;
  var canonical = new Int32Array(n);
  var ux = [], uy = [], uz = [];
  for (var i = 0; i < n; i++) {
    var px = vertices[i*3], py = vertices[i*3+1], pz = vertices[i*3+2];
    var key = Math.round(px*invEps) + '|' + Math.round(py*invEps) + '|' + Math.round(pz*invEps);
    var ex = map.get(key);
    if (ex !== undefined) {
      canonical[i] = ex;
    } else {
      canonical[i] = ux.length;
      map.set(key, ux.length);
      ux.push(px); uy.push(py); uz.push(pz);
    }
  }
  var unique = new Float32Array(ux.length * 3);
  for (var j = 0; j < ux.length; j++) {
    unique[j*3] = ux[j]; unique[j*3+1] = uy[j]; unique[j*3+2] = uz[j];
  }
  return { canonical: canonical, unique: unique, uniqueCount: ux.length, epsilon: eps };
}

// Minimal fallback (THREE veya builder yoksa): persisted stats'den dön
function _veFEAToplGenericMinimal(geometry) {
  var stats = (typeof veFEAPrimitiveStats === 'function') ? veFEAPrimitiveStats(geometry.type, geometry.params) : null;
  return {
    type: geometry.type,
    faces: [
      { id: 'faceSurface', label: 'Yüzey (Tüm üçgenler)', type: 'triangulated',
        area: (stats && stats.surfaceArea) || geometry.surfaceArea || 0 }
    ],
    edges:    { count: 0 },
    vertices: { count: 0 },
    totalSurfaceArea: (stats && stats.surfaceArea) || geometry.surfaceArea || 0,
    volume: (stats && stats.volume) || geometry.volume || 0,
    bbox: (stats && stats.bbox) || geometry.bbox || { x: 0, y: 0, z: 0 },
    generic: true
  };
}

// ─── Helpers ───────────────────────────────────────────────────────────────

// Üçgenleri normal-yönüne göre kümele. Aynı normal (cos θ > 1-tol) ve
// koplanar (signed distance < epsilon) üçgenler tek planar face.
function _veFEAClusterPlanarFaces(tris, angDeg) {
  var tol = Math.cos(angDeg * Math.PI / 180);   // cos threshold
  var clusters = [];
  for (var i = 0; i < tris.length; i++) {
    var t = tris[i];
    var matched = false;
    for (var c = 0; c < clusters.length; c++) {
      var cl = clusters[c];
      var dot = t.n.dot(cl.n);
      if (dot < tol) continue;
      // Koplanarite kontrolü: triangle centroid'ı cluster plane'inden
      // makul mesafede mi (max dim'in %1'i)
      var centroid = new THREE.Vector3(
        (t.p1.x + t.p2.x + t.p3.x) / 3,
        (t.p1.y + t.p2.y + t.p3.y) / 3,
        (t.p1.z + t.p2.z + t.p3.z) / 3
      );
      var dist = Math.abs(centroid.dot(cl.n) - cl.planeD);
      if (dist > 0.1) continue;  // 0.1mm tolerans
      cl.area += t.area;
      cl.triIdxs.push(i);
      // Normal güncelle (alan-ağırlıklı ortalama)
      cl.n.multiplyScalar(cl.area - t.area).add(t.n.clone().multiplyScalar(t.area)).normalize();
      matched = true;
      break;
    }
    if (!matched) {
      var centroid2 = new THREE.Vector3(
        (t.p1.x + t.p2.x + t.p3.x) / 3,
        (t.p1.y + t.p2.y + t.p3.y) / 3,
        (t.p1.z + t.p2.z + t.p3.z) / 3
      );
      clusters.push({
        n: t.n.clone(),
        planeD: centroid2.dot(t.n),
        area: t.area,
        triIdxs: [i]
      });
    }
  }
  // Çok küçük cluster'ları (sadece 1-2 üçgen, curved'ın artığı) at — curved'ın
  // parçası olarak değerlendir. Minimum 3 üçgen + minimum alan.
  return clusters.filter(function (c) {
    return c.triIdxs.length >= 3 || c.area > 1.0;
  });
}

// Edge sayısı: her mesh için EdgesGeometry (>angDeg) → unique line segments
function _veFEACountSharpEdges(meshes, angDeg) {
  var total = 0;
  meshes.forEach(function (m) {
    try {
      var eg = new THREE.EdgesGeometry(m.geometry, angDeg);
      var posAttr = eg.attributes.position;
      total += posAttr.count / 2;  // her edge = 2 endpoint
      eg.dispose && eg.dispose();
    } catch (e) {}
  });
  return total;
}

// Vertex dedup — basit grid hashing (epsilon-bucket)
function _veFEACountUniqueVertices(flatXYZ, eps) {
  var seen = {};
  var count = 0;
  var inv = 1 / Math.max(eps, 1e-9);
  for (var i = 0; i < flatXYZ.length; i += 3) {
    var kx = Math.round(flatXYZ[i] * inv);
    var ky = Math.round(flatXYZ[i + 1] * inv);
    var kz = Math.round(flatXYZ[i + 2] * inv);
    var key = kx + ',' + ky + ',' + kz;
    if (!seen[key]) { seen[key] = 1; count++; }
  }
  return count;
}

// ════════════════════════════════════════════════════════════════════════════
// CURVE & POLYLINE HELPERS — analitik primitif edge'leri için 3D çizgi üretir
// ════════════════════════════════════════════════════════════════════════════

// Daire polyline'ı: center + axis (normal) ile çizilir, segments segment.
// Viewer'da edge highlight için kullanılır.
function _veFEACirclePolyline(center, axis, radius, segments) {
  if (!center || !axis) return [];
  var seg = Math.max(8, Math.round(segments || 32));
  // axis'e dik iki birim vektör üret (Gram-Schmidt)
  var ax = axis[0], ay = axis[1], az = axis[2];
  var alen = Math.sqrt(ax*ax + ay*ay + az*az) || 1;
  ax /= alen; ay /= alen; az /= alen;
  // axis'e en uzak temel vektör seç
  var ref = (Math.abs(ax) < 0.9) ? [1,0,0] : [0,1,0];
  // u = ref - (ref·a)a, sonra normalize
  var dot = ref[0]*ax + ref[1]*ay + ref[2]*az;
  var ux = ref[0] - dot*ax, uy = ref[1] - dot*ay, uz = ref[2] - dot*az;
  var ulen = Math.sqrt(ux*ux + uy*uy + uz*uz) || 1;
  ux /= ulen; uy /= ulen; uz /= ulen;
  // v = a × u
  var vx = ay*uz - az*uy, vy = az*ux - ax*uz, vz = ax*uy - ay*ux;
  var pts = [];
  for (var i = 0; i <= seg; i++) {
    var th = (i / seg) * 2 * Math.PI;
    var c = Math.cos(th), s = Math.sin(th);
    pts.push([
      center[0] + radius * (c*ux + s*vx),
      center[1] + radius * (c*uy + s*vy),
      center[2] + radius * (c*uz + s*vz)
    ]);
  }
  return pts;
}

// İki nokta arası düz çizgi polyline (yalnızca p1, p2 — viewer line için yeterli)
function _veFEALinePolyline(p1, p2) {
  return [[p1[0], p1[1], p1[2]], [p2[0], p2[1], p2[2]]];
}

// Yay polyline'ı: center, axis, radius, startAngle, endAngle, segments
function _veFEAArcPolyline(center, axis, radius, startAng, endAng, segments) {
  if (!center || !axis) return [];
  var seg = Math.max(4, Math.round(segments || 24));
  var ax = axis[0], ay = axis[1], az = axis[2];
  var alen = Math.sqrt(ax*ax + ay*ay + az*az) || 1;
  ax /= alen; ay /= alen; az /= alen;
  var ref = (Math.abs(ax) < 0.9) ? [1,0,0] : [0,1,0];
  var dot = ref[0]*ax + ref[1]*ay + ref[2]*az;
  var ux = ref[0] - dot*ax, uy = ref[1] - dot*ay, uz = ref[2] - dot*az;
  var ulen = Math.sqrt(ux*ux + uy*uy + uz*uz) || 1;
  ux /= ulen; uy /= ulen; uz /= ulen;
  var vx = ay*uz - az*uy, vy = az*ux - ax*uz, vz = ax*uy - ay*ux;
  var pts = [];
  for (var i = 0; i <= seg; i++) {
    var t = i / seg;
    var th = startAng + t * (endAng - startAng);
    var c = Math.cos(th), s = Math.sin(th);
    pts.push([
      center[0] + radius * (c*ux + s*vx),
      center[1] + radius * (c*uy + s*vy),
      center[2] + radius * (c*uz + s*vz)
    ]);
  }
  return pts;
}

// ════════════════════════════════════════════════════════════════════════════
// CURVE FITTING — generic mesh edge segment'leri için tip tespiti
// ════════════════════════════════════════════════════════════════════════════
// Input: polyline (3D nokta dizisi, sıralı)
// Output: { type, ...params }
//   'line':    { type, p1, p2, length, direction }
//   'circle':  { type, center, axis, radius, length, isFullCircle }
//   'arc':     { type, center, axis, radius, startAngle, endAngle, length }
//   'ellipse': { type, center, axis, semiMajor, semiMinor, length }
//   'spline':  { type, length, controlPoints }
function veFEAFitCurveToPolyline(polyline, tolerance) {
  if (!Array.isArray(polyline) || polyline.length < 2) return { type: 'unknown' };
  var n = polyline.length;
  // Toplam uzunluk + bbox (adaptif tolerans için)
  var totalLen = 0;
  var mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity];
  for (var i = 0; i < n; i++) {
    for (var k = 0; k < 3; k++) {
      if (polyline[i][k] < mn[k]) mn[k] = polyline[i][k];
      if (polyline[i][k] > mx[k]) mx[k] = polyline[i][k];
    }
    if (i > 0) {
      var dx = polyline[i][0] - polyline[i-1][0];
      var dy = polyline[i][1] - polyline[i-1][1];
      var dz = polyline[i][2] - polyline[i-1][2];
      totalLen += Math.sqrt(dx*dx + dy*dy + dz*dz);
    }
  }
  var scale = Math.sqrt((mx[0]-mn[0])*(mx[0]-mn[0]) + (mx[1]-mn[1])*(mx[1]-mn[1]) + (mx[2]-mn[2])*(mx[2]-mn[2]));
  // Adaptif tolerans: kullanıcı vermezse curve ölçeğinin %2.5'i (gürültü genelde
  // ölçekle orantılıdır — gerçek CAD tessellation sapması). Mutlak alt sınır var.
  var tol = (isFinite(tolerance) && tolerance > 0) ? tolerance : Math.max(scale * 0.025, 1e-4);

  // 1) LINE — PCA/least-squares doğru fit (RMS + inlier robust kabul)
  var lineFit = _veFEATryFitLine(polyline, tol);
  if (lineFit) {
    lineFit.length = totalLen;
    return lineFit;
  }

  // 2) CIRCLE/ARC — Kåsa least-squares çember fit (gürültüye dayanıklı)
  if (n >= 3) {
    var circFit = _veFEATryFitCircle(polyline, tol);
    if (circFit) {
      circFit.length = totalLen;
      var first = polyline[0], last = polyline[n-1];
      var dx2 = first[0]-last[0], dy2 = first[1]-last[1], dz2 = first[2]-last[2];
      var endDist = Math.sqrt(dx2*dx2 + dy2*dy2 + dz2*dz2);
      // Full circle eşiği: yarıçapa göreli (tek tolerans değil) — kapanma testi
      circFit.isFullCircle = endDist < Math.max(tol * 3, circFit.radius * 0.08);
      if (!circFit.isFullCircle) circFit.type = 'arc';
      return circFit;
    }

    // 3) ELLIPSE — düzlemsel conic fit
    var ellFit = _veFEATryFitEllipse(polyline, tol);
    if (ellFit) {
      ellFit.length = totalLen;
      return ellFit;
    }
  }

  // 4) SPLINE FALLBACK
  var ctrl = [];
  var maxCtrl = 16;
  var step = Math.max(1, Math.floor(n / maxCtrl));
  for (var c2 = 0; c2 < n; c2 += step) ctrl.push(polyline[c2]);
  if (ctrl[ctrl.length-1] !== polyline[n-1]) ctrl.push(polyline[n-1]);
  return { type: 'spline', length: totalLen, controlPoints: ctrl };
}

// ─── Robust fit helper'ları (least-squares + RMS/inlier) ───────────────────
// Newell yöntemi — düzlemsel (kapalı/açık) polyline için robust normal.
// Ardışık kenar çiftlerinin alan-vektörünü toplar; gürültüye dayanıklı.
function _veFEANewellNormal(pts) {
  var nx = 0, ny = 0, nz = 0, n = pts.length;
  for (var i = 0; i < n; i++) {
    var a = pts[i], b = pts[(i + 1) % n];
    nx += (a[1] - b[1]) * (a[2] + b[2]);
    ny += (a[2] - b[2]) * (a[0] + b[0]);
    nz += (a[0] - b[0]) * (a[1] + b[1]);
  }
  var L = Math.sqrt(nx*nx + ny*ny + nz*nz);
  if (L < 1e-12) return null;
  return [nx/L, ny/L, nz/L];
}

// 3x3 simetrik lineer sistem çözücü (Kåsa circle için) — Cramer.
function _veFEASolve3x3(m, b) {
  function det3(a) {
    return a[0]*(a[4]*a[8]-a[5]*a[7]) - a[1]*(a[3]*a[8]-a[5]*a[6]) + a[2]*(a[3]*a[7]-a[4]*a[6]);
  }
  var D = det3(m);
  if (Math.abs(D) < 1e-14) return null;
  var mx = m.slice(); mx[0]=b[0]; mx[3]=b[1]; mx[6]=b[2];
  var my = m.slice(); my[1]=b[0]; my[4]=b[1]; my[7]=b[2];
  var mz = m.slice(); mz[2]=b[0]; mz[5]=b[1]; mz[8]=b[2];
  return [det3(mx)/D, det3(my)/D, det3(mz)/D];
}

// Dominant eigenvector (power iteration) — line yönü için.
function _veFEAPowerIter(cov, seed) {
  var v = seed.slice();
  for (var it = 0; it < 24; it++) {
    var x = cov[0]*v[0] + cov[1]*v[1] + cov[2]*v[2];
    var y = cov[3]*v[0] + cov[4]*v[1] + cov[5]*v[2];
    var z = cov[6]*v[0] + cov[7]*v[1] + cov[8]*v[2];
    var L = Math.sqrt(x*x + y*y + z*z);
    if (L < 1e-14) break;
    v = [x/L, y/L, z/L];
  }
  return v;
}

function _veFEATryFitLine(pts, tol) {
  var n = pts.length;
  // Centroid
  var cx = 0, cy = 0, cz = 0;
  for (var i = 0; i < n; i++) { cx += pts[i][0]; cy += pts[i][1]; cz += pts[i][2]; }
  cx /= n; cy /= n; cz /= n;
  // Covariance (3x3 simetrik) — PCA ile en iyi doğru yönü
  var c00=0,c01=0,c02=0,c11=0,c12=0,c22=0;
  for (var j = 0; j < n; j++) {
    var dx = pts[j][0]-cx, dy = pts[j][1]-cy, dz = pts[j][2]-cz;
    c00 += dx*dx; c01 += dx*dy; c02 += dx*dz;
    c11 += dy*dy; c12 += dy*dz; c22 += dz*dz;
  }
  var cov = [c00,c01,c02, c01,c11,c12, c02,c12,c22];
  // Başlangıç tahmini: ilk→son yönü (yakınsamayı hızlandırır)
  var sx = pts[n-1][0]-pts[0][0], sy = pts[n-1][1]-pts[0][1], sz = pts[n-1][2]-pts[0][2];
  var sL = Math.sqrt(sx*sx+sy*sy+sz*sz) || 1;
  var dir = _veFEAPowerIter(cov, [sx/sL, sy/sL, sz/sL]);
  // RMS dik mesafe + inlier oranı
  var sumSq = 0, inliers = 0, maxErr = 0;
  for (var m = 0; m < n; m++) {
    var px = pts[m][0]-cx, py = pts[m][1]-cy, pz = pts[m][2]-cz;
    var t = px*dir[0] + py*dir[1] + pz*dir[2];
    var ex = px - t*dir[0], ey = py - t*dir[1], ez = pz - t*dir[2];
    var e = Math.sqrt(ex*ex + ey*ey + ez*ez);
    sumSq += e*e;
    if (e <= tol) inliers++;
    if (e > maxErr) maxErr = e;
  }
  var rms = Math.sqrt(sumSq / n);
  // Kabul: RMS tolerans içinde VE noktaların ≥%85'i inlier
  if (rms > tol || (inliers / n) < 0.85) return null;
  // Uç noktaları doğruya projekte et (temiz p1/p2)
  function proj(p) {
    var px = p[0]-cx, py = p[1]-cy, pz = p[2]-cz;
    var t = px*dir[0] + py*dir[1] + pz*dir[2];
    return [cx + t*dir[0], cy + t*dir[1], cz + t*dir[2]];
  }
  return {
    type: 'line', p1: proj(pts[0]), p2: proj(pts[n-1]),
    direction: [dir[0], dir[1], dir[2]], rms: rms
  };
}

// Robust çember fit — Kåsa least-squares (tüm noktalar) + RMS/inlier kabul.
// 3-nokta circumcircle yerine bütün noktalardan en iyi çemberi çözer; bu
// sayede tessellation gürültüsüne dayanıklıdır.
function _veFEATryFitCircle(pts, tol) {
  var n = pts.length;
  if (n < 3) return null;
  // 1) Düzlem normali — Newell (robust). Düzlemsellik RMS'ini de ölç.
  var normal = _veFEANewellNormal(pts);
  if (!normal) return null;
  var nx = normal[0], ny = normal[1], nz = normal[2];
  // Centroid (düzlem noktası)
  var cx0 = 0, cy0 = 0, cz0 = 0;
  for (var i0 = 0; i0 < n; i0++) { cx0 += pts[i0][0]; cy0 += pts[i0][1]; cz0 += pts[i0][2]; }
  cx0 /= n; cy0 /= n; cz0 /= n;
  // Düzlemsellik RMS — noktaların düzleme dik sapması
  var planarSq = 0;
  for (var i1 = 0; i1 < n; i1++) {
    var pd = (pts[i1][0]-cx0)*nx + (pts[i1][1]-cy0)*ny + (pts[i1][2]-cz0)*nz;
    planarSq += pd*pd;
  }
  var planarRms = Math.sqrt(planarSq / n);
  if (planarRms > tol * 1.5) return null;  // düzlemsel değil → çember olamaz
  // 2) Düzleme dik 2 birim eksen (u, v) — noktaları 2D'ye projekte et
  var ref = (Math.abs(nx) < 0.9) ? [1,0,0] : [0,1,0];
  var dotn = ref[0]*nx + ref[1]*ny + ref[2]*nz;
  var ux = ref[0]-dotn*nx, uy = ref[1]-dotn*ny, uz = ref[2]-dotn*nz;
  var uL = Math.sqrt(ux*ux+uy*uy+uz*uz) || 1; ux/=uL; uy/=uL; uz/=uL;
  var vx = ny*uz-nz*uy, vy = nz*ux-nx*uz, vz = nx*uy-ny*ux;
  var U = new Array(n), V = new Array(n);
  for (var i2 = 0; i2 < n; i2++) {
    var px = pts[i2][0]-cx0, py = pts[i2][1]-cy0, pz = pts[i2][2]-cz0;
    U[i2] = px*ux + py*uy + pz*uz;
    V[i2] = px*vx + py*vy + pz*vz;
  }
  // 3) Kåsa algebraic circle fit (2D): min Σ(u²+v² + A·u + B·v + C)²
  // Normal denklemler: [Suu Suv Su; Suv Svv Sv; Su Sv n]·[A;B;C] = -[Suuu+Suvv; Svuu+Svvv; Suu+Svv]
  var Su=0,Sv=0,Suu=0,Svv=0,Suv=0,Suuu=0,Svvv=0,Suvv=0,Svuu=0;
  for (var i3 = 0; i3 < n; i3++) {
    var u = U[i3], v = V[i3], uu = u*u, vv = v*v;
    Su += u; Sv += v; Suu += uu; Svv += vv; Suv += u*v;
    Suuu += uu*u; Svvv += vv*v; Suvv += u*vv; Svuu += v*uu;
  }
  var M = [Suu, Suv, Su,  Suv, Svv, Sv,  Su, Sv, n];
  var rhs = [-(Suuu + Suvv), -(Svvv + Svuu), -(Suu + Svv)];
  var sol = _veFEASolve3x3(M, rhs);
  if (!sol) return null;
  var ucc = -sol[0]/2, vcc = -sol[1]/2;
  var R2 = ucc*ucc + vcc*vcc - sol[2];
  if (R2 <= 1e-12) return null;
  var R = Math.sqrt(R2);
  // 4) Radyal RMS + inlier oranı
  var sumSq = 0, inliers = 0;
  for (var i4 = 0; i4 < n; i4++) {
    var ddu = U[i4]-ucc, ddv = V[i4]-vcc;
    var d = Math.abs(Math.sqrt(ddu*ddu + ddv*ddv) - R);
    sumSq += d*d;
    if (d <= tol) inliers++;
  }
  var rms = Math.sqrt(sumSq / n);
  // Kabul: radyal RMS tolerans içinde VE noktaların ≥%80'i inlier
  if (rms > tol || (inliers / n) < 0.80) return null;
  // 5) 3D merkez + açı aralığı
  var cx = cx0 + ucc*ux + vcc*vx;
  var cy = cy0 + ucc*uy + vcc*vy;
  var cz = cz0 + ucc*uz + vcc*vz;
  function angleOf(idx) { return Math.atan2(V[idx]-vcc, U[idx]-ucc); }
  return {
    type: 'circle', center: [cx, cy, cz], axis: [nx, ny, nz], radius: R,
    startAngle: angleOf(0), endAngle: angleOf(n-1), rms: rms, planarRms: planarRms
  };
}

function _veFEATryFitEllipse(pts, tol) {
  // Basit yaklaşım: noktaları en küçük kareler ile bir ellipse'e fit etmeye çalış.
  // v1: planar mı diye kontrol et, eğer öyleyse 2D ellipse fit (Fitzgibbon's direct method
  // basitleştirilmiş halini kullan). Eksik kalırsa null döner ve fonksiyon spline'a düşer.
  var n = pts.length;
  if (n < 5) return null;
  var pA = pts[0], pB = pts[Math.floor(n/2)], pC = pts[n-1];
  var ax = pB[0]-pA[0], ay = pB[1]-pA[1], az = pB[2]-pA[2];
  var bx = pC[0]-pA[0], by = pC[1]-pA[1], bz = pC[2]-pA[2];
  var nx = ay*bz - az*by, ny = az*bx - ax*bz, nz = ax*by - ay*bx;
  var nLen = Math.sqrt(nx*nx + ny*ny + nz*nz);
  if (nLen < 1e-9) return null;
  nx /= nLen; ny /= nLen; nz /= nLen;
  // Düzlemsellik kontrolü
  for (var i = 0; i < n; i++) {
    var planeProj = (pts[i][0]-pA[0])*nx + (pts[i][1]-pA[1])*ny + (pts[i][2]-pA[2])*nz;
    if (Math.abs(planeProj) > tol * 2) return null;
  }
  // 2D düzleme projeksiyon (u/v koordinatları)
  var ux = ax, uy = ay, uz = az;
  var uLen = Math.sqrt(ux*ux + uy*uy + uz*uz) || 1;
  ux /= uLen; uy /= uLen; uz /= uLen;
  var vx = ny*uz - nz*uy, vy = nz*ux - nx*uz, vz = nx*uy - ny*ux;
  var pts2d = [];
  var cx0 = 0, cy0 = 0;
  for (var j = 0; j < n; j++) {
    var px = pts[j][0]-pA[0], py = pts[j][1]-pA[1], pz = pts[j][2]-pA[2];
    var u2 = px*ux + py*uy + pz*uz;
    var v2 = px*vx + py*vy + pz*vz;
    pts2d.push([u2, v2]);
    cx0 += u2; cy0 += v2;
  }
  cx0 /= n; cy0 /= n;
  // Covariance ile principal axes (basit yaklaşık)
  var Suu = 0, Svv = 0, Suv = 0;
  for (var k = 0; k < n; k++) {
    var du = pts2d[k][0] - cx0, dv = pts2d[k][1] - cy0;
    Suu += du*du; Svv += dv*dv; Suv += du*dv;
  }
  Suu /= n; Svv /= n; Suv /= n;
  // Eigenvalues
  var trace = Suu + Svv;
  var det = Suu*Svv - Suv*Suv;
  var disc = Math.sqrt(Math.max(0, trace*trace/4 - det));
  var l1 = trace/2 + disc, l2 = trace/2 - disc;
  if (l1 < 1e-6 || l2 < 1e-6) return null;
  var semiMajor = 2 * Math.sqrt(l1);  // ~2σ
  var semiMinor = 2 * Math.sqrt(l2);
  // Eksenler yaklaşık eşitse → circle (zaten önce denenmiş olmalı, yine de elenir)
  if (Math.abs(semiMajor - semiMinor) < tol * 2) return null;
  // 2D merkez → 3D
  var centerX = pA[0] + cx0*ux + cy0*vx;
  var centerY = pA[1] + cx0*uy + cy0*vy;
  var centerZ = pA[2] + cx0*uz + cy0*vz;
  // Major axis vector — covariance ana eigenvector'ünden hesapla
  var theta = (Math.abs(Suu - Svv) < 1e-9) ? 0 : 0.5 * Math.atan2(2*Suv, Suu - Svv);
  var maX = Math.cos(theta)*ux + Math.sin(theta)*vx;
  var maY = Math.cos(theta)*uy + Math.sin(theta)*vy;
  var maZ = Math.cos(theta)*uz + Math.sin(theta)*vz;
  return {
    type: 'ellipse', center: [centerX, centerY, centerZ], axis: [nx, ny, nz],
    semiMajor: semiMajor, semiMinor: semiMinor, majorAxis: [maX, maY, maZ]
  };
}

// ════════════════════════════════════════════════════════════════════════════
// MESH-DRIVEN EDGE EXTRACTION — sharp edge'leri line segment'lere böl,
// adjacent segment'leri tek bir edge'e (line/circle/arc) birleştir.
// ════════════════════════════════════════════════════════════════════════════
function _veFEAExtractMeshEdges(meshes, dihedralDeg, mergeAngleDeg) {
  if (!meshes || meshes.length === 0 || typeof THREE === 'undefined') return [];
  var dDeg = (isFinite(dihedralDeg) && dihedralDeg > 0) ? dihedralDeg : 30;
  var mAng = (isFinite(mergeAngleDeg) && mergeAngleDeg > 0) ? mergeAngleDeg : 5;
  var segments = [];  // her segment: { p1: [x,y,z], p2: [x,y,z] }
  meshes.forEach(function(m) {
    try {
      var eg = new THREE.EdgesGeometry(m.geometry, dDeg);
      var pos = eg.attributes.position;
      var mat = m.matrixWorld;
      for (var i = 0; i < pos.count; i += 2) {
        var a = new THREE.Vector3().fromBufferAttribute(pos, i).applyMatrix4(mat);
        var b = new THREE.Vector3().fromBufferAttribute(pos, i+1).applyMatrix4(mat);
        segments.push({ p1: [a.x, a.y, a.z], p2: [b.x, b.y, b.z] });
      }
      eg.dispose && eg.dispose();
    } catch (e) {}
  });
  if (segments.length === 0) return [];
  // Bbox'tan epsilon hesabı
  var minX=Infinity, minY=Infinity, minZ=Infinity, maxX=-Infinity, maxY=-Infinity, maxZ=-Infinity;
  segments.forEach(function(s) {
    [s.p1, s.p2].forEach(function(pp){
      if (pp[0]<minX) minX=pp[0]; if (pp[0]>maxX) maxX=pp[0];
      if (pp[1]<minY) minY=pp[1]; if (pp[1]>maxY) maxY=pp[1];
      if (pp[2]<minZ) minZ=pp[2]; if (pp[2]>maxZ) maxZ=pp[2];
    });
  });
  var diag = Math.sqrt(Math.pow(maxX-minX,2)+Math.pow(maxY-minY,2)+Math.pow(maxZ-minZ,2)) || 1;
  var eps = Math.max(diag * 1e-4, 1e-5);
  // Vertex dedup: epsilon-bucket → vertex index
  var vMap = {};
  var verts = [];
  function _key(p) {
    var inv = 1 / eps;
    return Math.round(p[0]*inv) + ',' + Math.round(p[1]*inv) + ',' + Math.round(p[2]*inv);
  }
  function _vIndex(p) {
    var k = _key(p);
    if (vMap[k] !== undefined) return vMap[k];
    var idx = verts.length;
    verts.push([p[0], p[1], p[2]]);
    vMap[k] = idx;
    return idx;
  }
  // Segment endpointlerini vertex indeksine bağla, duplicate segmentleri unique yap
  var segMap = {};
  var uniqueSegs = [];  // { a, b, dir }
  segments.forEach(function(s) {
    var ia = _vIndex(s.p1), ib = _vIndex(s.p2);
    if (ia === ib) return;
    var lo = Math.min(ia, ib), hi = Math.max(ia, ib);
    var key = lo + '-' + hi;
    if (segMap[key]) return;
    segMap[key] = true;
    uniqueSegs.push({ a: ia, b: ib });
  });
  // Vertex → segment komşuları
  var vAdj = {};
  uniqueSegs.forEach(function(s, idx) {
    if (!vAdj[s.a]) vAdj[s.a] = [];
    if (!vAdj[s.b]) vAdj[s.b] = [];
    vAdj[s.a].push(idx);
    vAdj[s.b].push(idx);
  });
  // Edge polyline'larını chain ile birleştir.
  // Strateji: T-junction (3+ komşu) vertex'leri "break" noktası;
  // 2 komşulu vertex'lerde teğet açısı < mergeAngle ise zincire devam.
  var mergeCos = Math.cos(mAng * Math.PI / 180);
  function _segDir(seg) {
    var a = verts[seg.a], b = verts[seg.b];
    var dx = b[0]-a[0], dy = b[1]-a[1], dz = b[2]-a[2];
    var L = Math.sqrt(dx*dx+dy*dy+dz*dz)||1;
    return [dx/L, dy/L, dz/L];
  }
  function _segLen(seg) {
    var a = verts[seg.a], b = verts[seg.b];
    var dx = b[0]-a[0], dy = b[1]-a[1], dz = b[2]-a[2];
    return Math.sqrt(dx*dx+dy*dy+dz*dz);
  }
  var visited = new Array(uniqueSegs.length);
  var chains = [];
  for (var sIdx = 0; sIdx < uniqueSegs.length; sIdx++) {
    if (visited[sIdx]) continue;
    visited[sIdx] = true;
    // İki yöne de uzat
    var chain = [uniqueSegs[sIdx].a, uniqueSegs[sIdx].b];
    function _extend(fromEnd) {
      // fromEnd: 0=baş, 1=son
      var changed = true;
      while (changed) {
        changed = false;
        var endVi = chain[fromEnd === 0 ? 0 : chain.length-1];
        var neighbors = vAdj[endVi] || [];
        // T-junction kontrolü
        var unvisited = neighbors.filter(function(ni) { return !visited[ni]; });
        if (unvisited.length !== 1) break;  // ya 0 (dead end) ya 2+ (T-junction)
        // Teğet açıya bak — chain'in son segment yönü ile candidate segment yönü
        var prevVi = chain[fromEnd === 0 ? 1 : chain.length-2];
        var prevA = verts[prevVi], prevB = verts[endVi];
        var prevDx = prevB[0]-prevA[0], prevDy = prevB[1]-prevA[1], prevDz = prevB[2]-prevA[2];
        var prevL = Math.sqrt(prevDx*prevDx+prevDy*prevDy+prevDz*prevDz)||1;
        prevDx /= prevL; prevDy /= prevL; prevDz /= prevL;
        var cand = uniqueSegs[unvisited[0]];
        var otherVi = (cand.a === endVi) ? cand.b : cand.a;
        var candA = verts[endVi], candB = verts[otherVi];
        var candDx = candB[0]-candA[0], candDy = candB[1]-candA[1], candDz = candB[2]-candA[2];
        var candL = Math.sqrt(candDx*candDx+candDy*candDy+candDz*candDz)||1;
        candDx /= candL; candDy /= candL; candDz /= candL;
        var dot = prevDx*candDx + prevDy*candDy + prevDz*candDz;
        // mergeCos eşiğinde değil → chain'i kır. Ancak daire için açı kademeli — daha
        // gevşek bir eşik (cos(20°) ≈ 0.94) kullanalım ki daire chain'leri ayrılmasın.
        var minDot = Math.cos(20 * Math.PI / 180);
        if (dot < minDot) break;
        visited[unvisited[0]] = true;
        if (fromEnd === 0) chain.unshift(otherVi);
        else                chain.push(otherVi);
        changed = true;
      }
    }
    _extend(1);
    _extend(0);
    chains.push(chain);
  }
  // Her chain için curve fitting yap
  var edges = [];
  chains.forEach(function(chain, ci) {
    var polyline = chain.map(function(vi) { return verts[vi]; });
    var fit = veFEAFitCurveToPolyline(polyline);
    var edge = {
      id: 'eMesh_' + ci,
      label: 'Kenar #' + (ci + 1) + ' (' + (fit.type === 'circle' ? 'Daire' :
                                              fit.type === 'arc' ? 'Yay' :
                                              fit.type === 'ellipse' ? 'Eliptik' :
                                              fit.type === 'spline' ? 'Eğri' : 'Doğru') + ')',
      type: fit.type,
      length: fit.length,
      polyline: polyline,
      faceIds: [],
      vertexIds: []
    };
    // Curve params
    if (fit.type === 'line') {
      edge.p1 = fit.p1; edge.p2 = fit.p2; edge.direction = fit.direction;
    } else if (fit.type === 'circle' || fit.type === 'arc') {
      edge.center = fit.center; edge.axis = fit.axis; edge.radius = fit.radius;
      edge.startAngle = fit.startAngle; edge.endAngle = fit.endAngle;
      edge.isFullCircle = fit.isFullCircle;
    } else if (fit.type === 'ellipse') {
      edge.center = fit.center; edge.axis = fit.axis;
      edge.semiMajor = fit.semiMajor; edge.semiMinor = fit.semiMinor;
      edge.majorAxis = fit.majorAxis;
    } else if (fit.type === 'spline') {
      edge.controlPoints = fit.controlPoints;
    }
    edges.push(edge);
  });
  return edges;
}

// ════════════════════════════════════════════════════════════════════════════
// MESH-DRIVEN VERTEX EXTRACTION — sharp edge endpoint'lerini topla, T-junction
// ve corner sınıflandırması yap.
// ════════════════════════════════════════════════════════════════════════════
function _veFEAExtractMeshVertices(edges) {
  if (!Array.isArray(edges) || edges.length === 0) return [];
  // Endpoint'leri topla (epsilon dedup)
  var pts = [];
  edges.forEach(function(e) {
    if (e.polyline && e.polyline.length > 0) {
      pts.push(e.polyline[0]);
      pts.push(e.polyline[e.polyline.length - 1]);
    }
  });
  if (pts.length === 0) return [];
  var bb = { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity, minZ: Infinity, maxZ: -Infinity };
  pts.forEach(function(p){
    if (p[0]<bb.minX) bb.minX=p[0]; if (p[0]>bb.maxX) bb.maxX=p[0];
    if (p[1]<bb.minY) bb.minY=p[1]; if (p[1]>bb.maxY) bb.maxY=p[1];
    if (p[2]<bb.minZ) bb.minZ=p[2]; if (p[2]>bb.maxZ) bb.maxZ=p[2];
  });
  var diag = Math.sqrt(Math.pow(bb.maxX-bb.minX,2)+Math.pow(bb.maxY-bb.minY,2)+Math.pow(bb.maxZ-bb.minZ,2)) || 1;
  var eps = Math.max(diag * 1e-4, 1e-5);
  var inv = 1 / eps;
  var vMap = {};
  var verts = [];
  edges.forEach(function(e, ei) {
    if (!e.polyline || e.polyline.length === 0) return;
    var p0 = e.polyline[0], p1 = e.polyline[e.polyline.length-1];
    [p0, p1].forEach(function(pp, endIdx) {
      var k = Math.round(pp[0]*inv) + ',' + Math.round(pp[1]*inv) + ',' + Math.round(pp[2]*inv);
      if (vMap[k] === undefined) {
        var vid = 'vMesh_' + verts.length;
        var vertex = {
          id: vid, label: 'Köşe #' + (verts.length + 1),
          position: [pp[0], pp[1], pp[2]],
          edgeIds: [e.id], faceIds: []
        };
        vMap[k] = verts.length;
        verts.push(vertex);
        e.vertexIds.push(vid);
      } else {
        var existing = verts[vMap[k]];
        if (existing.edgeIds.indexOf(e.id) < 0) existing.edgeIds.push(e.id);
        if (e.vertexIds.indexOf(existing.id) < 0) e.vertexIds.push(existing.id);
      }
    });
  });
  // Tek-edge vertex'leri (dangling) at — closed loop'larda 0 vertex normal
  verts = verts.filter(function(v) { return v.edgeIds.length >= 2; });
  return verts;
}

// ════════════════════════════════════════════════════════════════════════════
// EDGE NORMALIZATION — eski {count:N} formatını array'e çevirir (compat)
// ════════════════════════════════════════════════════════════════════════════
function veFEANormalizeTopology(topology) {
  if (!topology) return topology;
  // Edges normalize
  if (topology.edges && !Array.isArray(topology.edges)) {
    var oldCount = topology.edges.count || 0;
    var oldSharp = topology.edges.sharp;
    var oldSmooth = topology.edges.smooth;
    topology.edges = [];
    topology._edgesCount = oldCount;
    if (oldSharp !== undefined) topology._edgesSharp = oldSharp;
    if (oldSmooth !== undefined) topology._edgesSmooth = oldSmooth;
  } else if (Array.isArray(topology.edges)) {
    topology._edgesCount = topology.edges.length;
  }
  // Vertices normalize
  if (topology.vertices && !Array.isArray(topology.vertices)) {
    var oldVCount = topology.vertices.count || 0;
    topology.vertices = [];
    topology._verticesCount = oldVCount;
  } else if (Array.isArray(topology.vertices)) {
    topology._verticesCount = topology.vertices.length;
  }
  return topology;
}

// ════════════════════════════════════════════════════════════════════════════
// EDGE ADJACENCY GRAPH — edge'lerin face komşuluğunu graph olarak
// ════════════════════════════════════════════════════════════════════════════
function veFEABuildEdgeAdjacency(topology) {
  var adj = {};
  if (!topology || !Array.isArray(topology.edges)) return adj;
  topology.edges.forEach(function(e) {
    adj[e.id] = (Array.isArray(e.faceIds) ? e.faceIds.slice() : []);
  });
  return adj;
}

// VERTEX ADJACENCY — vertex'in komşu edge ve face'leri
function veFEABuildVertexAdjacency(topology) {
  var adj = {};
  if (!topology || !Array.isArray(topology.vertices)) return adj;
  topology.vertices.forEach(function(v) {
    adj[v.id] = {
      edges: Array.isArray(v.edgeIds) ? v.edgeIds.slice() : [],
      faces: Array.isArray(v.faceIds) ? v.faceIds.slice() : []
    };
  });
  return adj;
}

// ════════════════════════════════════════════════════════════════════════════
// TOPOLOGY SUMMARY — UI için kısa özet metni
// ════════════════════════════════════════════════════════════════════════════
function veFEATopologyEdgeTypeLabel(type) {
  return ({
    'line':     'Doğru',
    'circle':   'Daire',
    'arc':      'Yay',
    'ellipse':  'Eliptik',
    'spline':   'Eğri (Spline)',
    'polyline': 'Polyline',
    'unknown':  'Belirsiz'
  })[type] || type;
}

// Topology'nin edge sayısını döndür (eski count vs yeni array fark etmeden).
function veFEATopologyEdgeCount(topology) {
  if (!topology) return 0;
  if (Array.isArray(topology.edges)) return topology.edges.length;
  if (topology.edges && typeof topology.edges.count === 'number') return topology.edges.count;
  if (typeof topology._edgesCount === 'number') return topology._edgesCount;
  return 0;
}

// Topology'nin vertex sayısını döndür.
function veFEATopologyVertexCount(topology) {
  if (!topology) return 0;
  if (Array.isArray(topology.vertices)) return topology.vertices.length;
  if (topology.vertices && typeof topology.vertices.count === 'number') return topology.vertices.count;
  if (typeof topology._verticesCount === 'number') return topology._verticesCount;
  return 0;
}
