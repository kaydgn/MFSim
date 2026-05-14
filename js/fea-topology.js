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
// STL/STEP için: full BREP topology OCCT entegrasyonu gerek (Faz B+); şimdilik
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

function veFEAComputeGeometryTopology(geometry) {
  if (!geometry || !geometry.type) return null;
  var p = geometry.params || {};
  if (geometry.type === 'box')      return _veFEAToplBox(p);
  if (geometry.type === 'cylinder') return _veFEAToplCylinder(p);
  if (geometry.type === 'shaft')    return _veFEAToplShaft(p);
  if (geometry.type === 'rectTube') return _veFEAToplRectTube(p);
  if (geometry.type === 'stl' || geometry.type === 'step') return _veFEAToplStlStep(geometry);
  return null;
}

function veFEATopologyFaceTypeLabel(type) {
  return ({
    'planar':         'Düzlemsel',
    'planar-annular': 'Halka (Düzlem)',
    'cylindrical':    'Silindirik',
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
    edges:    { count: 2 },   // üst + alt daire
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
    edges:    { count: 4 },   // 2 dış + 2 iç daire
    vertices: { count: 0 },
    totalSurfaceArea: 2 * ring + outer + inner,
    volume: ring * L,
    bbox: { x: 2 * rOut, y: L, z: 2 * rOut }
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

// ─── STL / STEP — basitleştirilmiş (tek "Yüzey" face) ──────────────────────
// Gerçek BREP topology (face/edge/vertex per OCCT primitive) Faz B'de OCCT
// topology API ile eklenir. Şimdilik tüm üçgenler tek face altında toplanır.
function _veFEAToplStlStep(geom) {
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
