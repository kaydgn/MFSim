// ============================================================================
// FEA MESH ÜRETİMİ
// ============================================================================
// Geometriyi sonlu eleman ağına böler. F3a kapsamı:
//   - Kutu        → Heks8 structured (nx × ny × nz)
//   - Silindir    → Wedge6 (disk triangulation + eksenel extrude)
//   - Şaft        → Heks8 annulus (radyal × açısal × eksenel)
//   - STL / STEP  → Tri3 (yüzey mesh, vertex dedup)
//
// Hacim tetra (tet4/tet10) ve adaptif refinement F3b'de eklenir
// (tetgen-wasm veya benzeri yöntem gerekir).
//
// Mesh data formatı:
//   { type, geometryType, nodes (Float32Array Nx3), elements (Uint32Array),
//     nodesPerElement, grid?, metrics? }
//
// Public API:
//   veFEAMeshFromGeometry(geometry, opts) → meshData
//   veFEAComputeMeshMetrics(meshData)     → { nodeCount, elementCount, ... }
//   veFEAMeshLabel(type)                  → "Heks8" / "Wedge6" / "Tri3" vs.
// ============================================================================

var VE_FEA_MESH_MIN_SIZE = 0.5;  // mm — çok küçük değerleri clamp et
var VE_FEA_VOXEL_MAX_COUNT = 5000000; // 5M voxel üst sınır (performans güvencesi)

// Named selections veri modeli:
//   mesh.namedSelections = {
//     <key>: {
//       type: 'face' | 'edge' | 'node' | 'element',
//       source: 'auto' | 'manual',
//       label: <görünür isim>,
//       nodeIds: Uint32Array  // global düğüm indeksleri
//     }
//   }
// Auto-generated selections geometriye göre otomatik üretilir (kutu→6 yüzey,
// silindir→3 yüzey, şaft→4 yüzey, voxel→tek yüzey grubu).
// Sınır Koşulları (F4) bu gruplara referansla yük/mesnet uygular.

function veFEAMeshLabel(type) {
  return ({
    'hex8':   'Heks8',
    'wedge6': 'Wedge6 (Prizm)',
    'tet4':   'Tet4 (Tetra)',
    'tet10':  'Tet10 (Kuadratik Tetra)',
    'hex20':  'Hex20 (Kuadratik Heks)',
    'tri3':   'Tri3 (Yüzey)'
  })[type] || type;
}

// ─── Hex8/Wedge6 → Tet4 decomposition ─────────────────────────────────────
// Yapısal grid'lerde geçerli düğüm topolojisi ile gerçek tet4 mesh üretir.
// Düğüm konumları korunur (sadece eleman bağlantıları değişir), bu nedenle
// named selections ve nodeIds aynı kalır.
//
// Hex8 split: 6 tet, sabit diagonal (0-6). Yapısal grid'lerde komşu hücrelerin
// paylaşılan yüzlerinde diagonal eşleşir (conforming). Wedge6 split: 3 tet,
// diagonals (0-5) ve (1-5) — komşu wedge'lerle paylaşılan radyal arayüzlerde
// nodeID'ler aynı olduğundan diagonal otomatik eşleşir.
//
// Gerçek adaptive Delaunay/quality refinement (tetgen-wasm) ileride ayrı
// modül olarak eklenecek. Bu yöntem yapısal grid'ler ve voxel hex8 için
// solver-uygun tet4 mesh sağlar.
function veFEAConvertMeshToTet4(meshData) {
  if (!meshData || meshData.error) return meshData;
  if (meshData.type === 'hex8')   return _veFEAHexMeshToTet4(meshData);
  if (meshData.type === 'wedge6') return _veFEAWedgeMeshToTet4(meshData);
  if (meshData.type === 'tet4')   return meshData;
  return meshData; // tri3 vs. dokunma
}

// Heks8 → 6 Tet4 (diagonal 0-6 ile)
var _VE_FEA_HEX_TET_SPLIT = [
  [0, 1, 2, 6],
  [0, 2, 3, 6],
  [0, 3, 7, 6],
  [0, 7, 4, 6],
  [0, 4, 5, 6],
  [0, 5, 1, 6]
];
function _veFEAHexMeshToTet4(hexMesh) {
  var hex = hexMesh.elements;
  var nElem = hex.length / 8;
  var tets = new Uint32Array(nElem * 6 * 4);
  var p = 0;
  for (var e = 0; e < nElem; e++) {
    var off = e * 8;
    for (var s = 0; s < 6; s++) {
      var split = _VE_FEA_HEX_TET_SPLIT[s];
      tets[p++] = hex[off + split[0]];
      tets[p++] = hex[off + split[1]];
      tets[p++] = hex[off + split[2]];
      tets[p++] = hex[off + split[3]];
    }
  }
  return _veFEAWrapTet4Mesh(hexMesh, tets, { convertedFromHex: true });
}

// Wedge6 → 3 Tet4 (positive-orientation split)
// Cylinder mesher convention: alt üçgen (0,1,2) normali -y yönünde (flipped),
// üst üçgen apex'ler +y yönünde. Standard split (0,1,2,5)→(0,1,5,4)→(0,4,5,3)
// negatif signed volume verir. (0,2,1,...) gibi swapped'da pozitif:
var _VE_FEA_WEDGE_TET_SPLIT = [
  [0, 2, 1, 5],
  [0, 1, 4, 5],
  [0, 4, 3, 5]
];
function _veFEAWedgeMeshToTet4(wedgeMesh) {
  var w = wedgeMesh.elements;
  var nElem = w.length / 6;
  var tets = new Uint32Array(nElem * 3 * 4);
  var p = 0;
  for (var e = 0; e < nElem; e++) {
    var off = e * 6;
    for (var s = 0; s < 3; s++) {
      var split = _VE_FEA_WEDGE_TET_SPLIT[s];
      tets[p++] = w[off + split[0]];
      tets[p++] = w[off + split[1]];
      tets[p++] = w[off + split[2]];
      tets[p++] = w[off + split[3]];
    }
  }
  return _veFEAWrapTet4Mesh(wedgeMesh, tets, { convertedFromWedge: true });
}

// ─── Kuadratik enrichment (mid-side düğümler) ─────────────────────────────
// Lineer → quadratic dönüşüm: Her kenarın orta noktasına yeni düğüm ekler.
// Edge dedup via map<min(a,b)|max(a,b), newId> — paylaşılan kenarlar tek
// düğüm kazanır. Tet4→Tet10 (6 yeni/eleman, paylaşımla daha az), Hex8→Hex20
// (12 yeni/eleman), Wedge6→Wedge15 (9 yeni/eleman).
//
// Yapısal analizde quadratik elemanlar lineer mukabillerine göre gerilme
// gradyanlarını çok daha iyi yakalar (özellikle bend / contact bölgelerinde).
// Trade-off: 2-4× DOF artar → solver zamanı büyür.

// Eleman tipine göre kenar şablonu — lineer eleman düğüm sırasından kenar
// listesi (mid-side eklenmeden önce). Çıkış sırası eleman tipinin standart
// quadratik düğüm sırasına uygun olmalı (ANSYS / Abaqus uyumu).
var _VE_FEA_TET4_EDGES = [
  [0, 1], [1, 2], [2, 0],
  [0, 3], [1, 3], [2, 3]
];
var _VE_FEA_HEX8_EDGES = [
  [0, 1], [1, 2], [2, 3], [3, 0],  // alt yüz
  [4, 5], [5, 6], [6, 7], [7, 4],  // üst yüz
  [0, 4], [1, 5], [2, 6], [3, 7]   // dikey
];
var _VE_FEA_WEDGE6_EDGES = [
  [0, 1], [1, 2], [2, 0],  // alt üçgen
  [3, 4], [4, 5], [5, 3],  // üst üçgen
  [0, 3], [1, 4], [2, 5]   // dikey
];

function veFEAEnrichToQuadratic(meshData) {
  if (!meshData || meshData.error) return meshData;
  if (meshData.type === 'tet4')   return _veFEAGenericEnrich(meshData, _VE_FEA_TET4_EDGES,  'tet10', 10);
  if (meshData.type === 'hex8')   return _veFEAGenericEnrich(meshData, _VE_FEA_HEX8_EDGES,  'hex20', 20);
  if (meshData.type === 'wedge6') return _veFEAGenericEnrich(meshData, _VE_FEA_WEDGE6_EDGES, 'wedge15', 15);
  return meshData; // tri3 / zaten quadratic
}

function _veFEAGenericEnrich(mesh, edgeTemplate, newType, newPerElement) {
  var nodes = mesh.nodes;
  var elements = mesh.elements;
  var per = mesh.nodesPerElement;
  var elCount = elements.length / per;
  var origNodeCount = nodes.length / 3;

  // Edge dedup map (string key — milyonlarca eleman için Map performanslı)
  var edgeMap = new Map();
  var midX = [], midY = [], midZ = [];

  function getEdgeMidNode(a, b) {
    var k = (a < b) ? (a + '|' + b) : (b + '|' + a);
    var id = edgeMap.get(k);
    if (id !== undefined) return id;
    var newId = origNodeCount + midX.length;
    midX.push((nodes[a * 3]     + nodes[b * 3])     / 2);
    midY.push((nodes[a * 3 + 1] + nodes[b * 3 + 1]) / 2);
    midZ.push((nodes[a * 3 + 2] + nodes[b * 3 + 2]) / 2);
    edgeMap.set(k, newId);
    return newId;
  }

  var newElements = new Uint32Array(elCount * newPerElement);
  var p = 0;
  for (var e = 0; e < elCount; e++) {
    var off = e * per;
    // Köşe düğümleri
    for (var c = 0; c < per; c++) newElements[p++] = elements[off + c];
    // Orta-kenar düğümleri
    for (var i = 0; i < edgeTemplate.length; i++) {
      var a = elements[off + edgeTemplate[i][0]];
      var b = elements[off + edgeTemplate[i][1]];
      newElements[p++] = getEdgeMidNode(a, b);
    }
  }

  // Yeni düğüm array'i (orijinal corners + midpoints)
  var nMid = midX.length;
  var newNodes = new Float32Array((origNodeCount + nMid) * 3);
  newNodes.set(nodes);
  for (var m = 0; m < nMid; m++) {
    newNodes[(origNodeCount + m) * 3]     = midX[m];
    newNodes[(origNodeCount + m) * 3 + 1] = midY[m];
    newNodes[(origNodeCount + m) * 3 + 2] = midZ[m];
  }

  return {
    type: newType,
    geometryType: mesh.geometryType,
    nodes: newNodes,
    elements: newElements,
    nodesPerElement: newPerElement,
    grid: mesh.grid,
    namedSelections: mesh.namedSelections, // köşe nodeId'leri korunur
    voxelMode: mesh.voxelMode || false,
    enrichedFrom: mesh.type
  };
}

function _veFEAWrapTet4Mesh(srcMesh, tetElements, extra) {
  var out = {
    type: 'tet4',
    geometryType: srcMesh.geometryType,
    nodes: srcMesh.nodes,
    elements: tetElements,
    nodesPerElement: 4,
    grid: srcMesh.grid,
    namedSelections: srcMesh.namedSelections, // node ID'leri korundu, geçerli
    voxelMode: srcMesh.voxelMode || false
  };
  if (extra) Object.keys(extra).forEach(function(k) { out[k] = extra[k]; });
  return out;
}

function veFEAMeshFromGeometry(geometry, opts) {
  if (!geometry || !geometry.type) return null;
  opts = opts || {};
  var size = Math.max(VE_FEA_MESH_MIN_SIZE, Number(opts.size) || 10);
  // mode: 'auto' (default), 'volume', 'surface'
  var mode = opts.mode || 'auto';
  // elementType: 'auto' (native: hex8/wedge6) | 'tet4' (decomposition)
  var elementType = opts.elementType || 'auto';

  var mesh = null;
  if (geometry.type === 'box')      mesh = _veFEAMeshBox(geometry.params || {}, size);
  else if (geometry.type === 'cylinder') mesh = _veFEAMeshCylinder(geometry.params || {}, size);
  else if (geometry.type === 'shaft')    mesh = _veFEAMeshShaft(geometry.params || {}, size);
  else if (geometry.type === 'stl' || geometry.type === 'step') {
    // Yüzey üçgenleri lazım. STL için sync parse, STEP için async (bu yol senkron).
    var parsed = _veFEAParseSurfaceTriangles(geometry);
    if (!parsed) return null;
    // mode kararı: auto → STL/STEP için voxel hacim; surface → Tri3
    if (mode === 'surface') {
      return _veFEAMeshFromParsedTriangles(parsed, geometry.type);
    }
    // auto + volume → voxel hex
    mesh = _veFEAVoxelizeTrianglesToHex(parsed, size, geometry.type);
  }

  // elementType: hex8/wedge6 → tet4 decomposition (yüzey tri3 etkilenmez)
  if (mesh && !mesh.error && elementType === 'tet4') {
    mesh = veFEAConvertMeshToTet4(mesh);
  }
  // midSideNodes: lineer → quadratic (Tet4→Tet10, Hex8→Hex20, Wedge6→Wedge15)
  if (mesh && !mesh.error && opts.midSideNodes === true) {
    mesh = veFEAEnrichToQuadratic(mesh);
  }
  return mesh;
}

// Async wrapper — STEP gibi parse'i Promise tabanlı geometriler için.
// Senkron yol başarısızsa STEP'i OCCT üzerinden async parse eder.
function veFEAMeshFromGeometryAsync(geometry, opts) {
  if (!geometry) return Promise.resolve(null);
  opts = opts || {};
  // Önce sync yolu dene
  var sync = veFEAMeshFromGeometry(geometry, opts);
  if (sync) return Promise.resolve(sync);

  // STEP için async parse
  if (geometry.type === 'step' && geometry.rawDataB64 &&
      typeof veFEABase64ToArrayBuffer === 'function' &&
      typeof veFEAParseSTEPBuffer === 'function' &&
      typeof veFEAStepMeshesToParsed === 'function') {
    var buf = veFEABase64ToArrayBuffer(geometry.rawDataB64);
    return veFEAParseSTEPBuffer(buf).then(function(result) {
      var parsed = veFEAStepMeshesToParsed(result);
      if (!parsed || parsed.triangleCount === 0) return null;
      var size = Math.max(VE_FEA_MESH_MIN_SIZE, Number(opts.size) || 10);
      var elementType = opts.elementType || 'auto';
      if ((opts.mode || 'auto') === 'surface') {
        return _veFEAMeshFromParsedTriangles(parsed, 'step');
      }
      var hexMesh = _veFEAVoxelizeTrianglesToHex(parsed, size, 'step');
      if (hexMesh && !hexMesh.error && elementType === 'tet4') {
        hexMesh = veFEAConvertMeshToTet4(hexMesh);
      }
      if (hexMesh && !hexMesh.error && opts.midSideNodes === true) {
        hexMesh = veFEAEnrichToQuadratic(hexMesh);
      }
      return hexMesh;
    });
  }
  return Promise.resolve(null);
}

// ─── Kutu → Heks8 structured ───────────────────────────────────────────────
function _veFEAMeshBox(p, size) {
  var w = Math.max(0.1, p.width  || 50);
  var h = Math.max(0.1, p.height || 30);
  var d = Math.max(0.1, p.depth  || 20);
  var nx = Math.max(1, Math.round(w / size));
  var ny = Math.max(1, Math.round(h / size));
  var nz = Math.max(1, Math.round(d / size));
  var dx = w / nx, dy = h / ny, dz = d / nz;
  var x0 = -w / 2, y0 = -h / 2, z0 = -d / 2;

  var nNodes = (nx + 1) * (ny + 1) * (nz + 1);
  var nodes = new Float32Array(nNodes * 3);
  var pitchY = (nx + 1);
  var pitchZ = (nx + 1) * (ny + 1);
  for (var k = 0; k <= nz; k++) {
    for (var j = 0; j <= ny; j++) {
      for (var i = 0; i <= nx; i++) {
        var idx = i + j * pitchY + k * pitchZ;
        nodes[idx * 3]     = x0 + i * dx;
        nodes[idx * 3 + 1] = y0 + j * dy;
        nodes[idx * 3 + 2] = z0 + k * dz;
      }
    }
  }

  var nElem = nx * ny * nz;
  var elements = new Uint32Array(nElem * 8);
  var e = 0;
  for (var k2 = 0; k2 < nz; k2++) {
    for (var j2 = 0; j2 < ny; j2++) {
      for (var i2 = 0; i2 < nx; i2++) {
        var n0 = i2 + j2 * pitchY + k2 * pitchZ;
        var off = e * 8; e++;
        // Standart heks8 düğüm sırası (CCW alt, CCW üst)
        elements[off]     = n0;
        elements[off + 1] = n0 + 1;
        elements[off + 2] = n0 + 1 + pitchY;
        elements[off + 3] = n0 + pitchY;
        elements[off + 4] = n0 + pitchZ;
        elements[off + 5] = n0 + 1 + pitchZ;
        elements[off + 6] = n0 + 1 + pitchY + pitchZ;
        elements[off + 7] = n0 + pitchY + pitchZ;
      }
    }
  }

  return {
    type: 'hex8',
    geometryType: 'box',
    nodes: nodes,
    elements: elements,
    nodesPerElement: 8,
    grid: { nx: nx, ny: ny, nz: nz },
    namedSelections: _veFEABoxNamedSelections(nx, ny, nz)
  };
}

// Kutu için 6 yüzey (XMin, XMax, YMin, YMax, ZMin, ZMax) — düğüm grupları
function _veFEABoxNamedSelections(nx, ny, nz) {
  var pitchY = (nx + 1);
  var pitchZ = (nx + 1) * (ny + 1);
  var sel = {};
  function face(name, label, iLo, iHi, jLo, jHi, kLo, kHi) {
    var size = (iHi - iLo + 1) * (jHi - jLo + 1) * (kHi - kLo + 1);
    var ids = new Uint32Array(size);
    var p = 0;
    for (var k = kLo; k <= kHi; k++) {
      for (var j = jLo; j <= jHi; j++) {
        for (var i = iLo; i <= iHi; i++) {
          ids[p++] = i + j * pitchY + k * pitchZ;
        }
      }
    }
    sel[name] = { type: 'face', source: 'auto', label: label, nodeIds: ids };
  }
  face('faceXMin', 'X− Yüzeyi', 0,  0,  0, ny, 0, nz);
  face('faceXMax', 'X+ Yüzeyi', nx, nx, 0, ny, 0, nz);
  face('faceYMin', 'Y− Yüzeyi (Alt)', 0, nx, 0,  0,  0, nz);
  face('faceYMax', 'Y+ Yüzeyi (Üst)', 0, nx, ny, ny, 0, nz);
  face('faceZMin', 'Z− Yüzeyi (Ön)',  0, nx, 0, ny, 0,  0);
  face('faceZMax', 'Z+ Yüzeyi (Arka)', 0, nx, 0, ny, nz, nz);
  return sel;
}

// ─── Silindir → Wedge6 (disk triangulation + eksenel extrude) ──────────────
function _veFEAMeshCylinder(p, size) {
  var r  = Math.max(0.1, p.radius || 15);
  var h  = Math.max(0.1, p.height || 60);
  var nC = Math.max(6, Math.round(2 * Math.PI * r / size));
  var nR = Math.max(2, Math.round(r / size));
  var nA = Math.max(1, Math.round(h / size));
  var halfH = h / 2;

  // Disk düğümleri: her layer'da 1 merkez + nR * nC halka düğümü
  var perLayer = 1 + nR * nC;
  var nNodes = perLayer * (nA + 1);
  var nodes = new Float32Array(nNodes * 3);

  for (var k = 0; k <= nA; k++) {
    var y = -halfH + (h * k / nA);
    var base = k * perLayer;
    nodes[base * 3]     = 0;
    nodes[base * 3 + 1] = y;
    nodes[base * 3 + 2] = 0;
    for (var rr = 1; rr <= nR; rr++) {
      var rad = r * rr / nR;
      for (var c = 0; c < nC; c++) {
        var theta = 2 * Math.PI * c / nC;
        var idx = base + 1 + (rr - 1) * nC + c;
        nodes[idx * 3]     = rad * Math.cos(theta);
        nodes[idx * 3 + 1] = y;
        nodes[idx * 3 + 2] = rad * Math.sin(theta);
      }
    }
  }

  function diskNode(layer, ring, circ) {
    var base = layer * perLayer;
    if (ring === 0) return base;
    return base + 1 + (ring - 1) * nC + ((circ % nC + nC) % nC);
  }

  // 2D disk tri sayısı: nC (merkez wedge) + 2*nC*(nR-1) (halka quad'ları)
  var diskTris = nC + 2 * nC * (nR - 1);
  var nElem = diskTris * nA;
  var elements = new Uint32Array(nElem * 6);
  var e = 0;

  for (var ka = 0; ka < nA; ka++) {
    // Merkez halka triangleları
    for (var c1 = 0; c1 < nC; c1++) {
      var a0 = diskNode(ka,     0, 0);
      var a1 = diskNode(ka,     1, c1);
      var a2 = diskNode(ka,     1, c1 + 1);
      var b0 = diskNode(ka + 1, 0, 0);
      var b1 = diskNode(ka + 1, 1, c1);
      var b2 = diskNode(ka + 1, 1, c1 + 1);
      var off = e * 6; e++;
      elements[off]     = a0; elements[off + 1] = a1; elements[off + 2] = a2;
      elements[off + 3] = b0; elements[off + 4] = b1; elements[off + 5] = b2;
    }
    // Halka quad'ları (her quad → 2 wedge)
    for (var rr2 = 1; rr2 < nR; rr2++) {
      for (var c2 = 0; c2 < nC; c2++) {
        var p0 = diskNode(ka,     rr2,     c2);
        var p1 = diskNode(ka,     rr2 + 1, c2);
        var p2 = diskNode(ka,     rr2 + 1, c2 + 1);
        var p3 = diskNode(ka,     rr2,     c2 + 1);
        var q0 = diskNode(ka + 1, rr2,     c2);
        var q1 = diskNode(ka + 1, rr2 + 1, c2);
        var q2 = diskNode(ka + 1, rr2 + 1, c2 + 1);
        var q3 = diskNode(ka + 1, rr2,     c2 + 1);
        var off2 = e * 6; e++;
        elements[off2]     = p0; elements[off2 + 1] = p1; elements[off2 + 2] = p2;
        elements[off2 + 3] = q0; elements[off2 + 4] = q1; elements[off2 + 5] = q2;
        off2 = e * 6; e++;
        elements[off2]     = p0; elements[off2 + 1] = p2; elements[off2 + 2] = p3;
        elements[off2 + 3] = q0; elements[off2 + 4] = q2; elements[off2 + 5] = q3;
      }
    }
  }

  return {
    type: 'wedge6',
    geometryType: 'cylinder',
    nodes: nodes,
    elements: elements,
    nodesPerElement: 6,
    grid: { nRadial: nR, nCircum: nC, nAxial: nA },
    namedSelections: _veFEACylinderNamedSelections(nR, nC, nA)
  };
}

// Silindir için 3 yüzey (Alt, Üst, Yan)
function _veFEACylinderNamedSelections(nR, nC, nA) {
  var perLayer = 1 + nR * nC;
  function diskNode(layer, ring, circ) {
    var base = layer * perLayer;
    if (ring === 0) return base;
    return base + 1 + (ring - 1) * nC + ((circ % nC + nC) % nC);
  }
  function diskNodes(layer) {
    var ids = [diskNode(layer, 0, 0)];
    for (var r = 1; r <= nR; r++) {
      for (var c = 0; c < nC; c++) ids.push(diskNode(layer, r, c));
    }
    return new Uint32Array(ids);
  }
  var sideIds = new Uint32Array((nA + 1) * nC);
  var p = 0;
  for (var k = 0; k <= nA; k++) {
    for (var c = 0; c < nC; c++) sideIds[p++] = diskNode(k, nR, c);
  }
  return {
    faceBottom: { type: 'face', source: 'auto', label: 'Alt Disk (Y−)', nodeIds: diskNodes(0) },
    faceTop:    { type: 'face', source: 'auto', label: 'Üst Disk (Y+)', nodeIds: diskNodes(nA) },
    faceSide:   { type: 'face', source: 'auto', label: 'Yan Yüzey (Radyal)', nodeIds: sideIds }
  };
}

// ─── Şaft (içi boş silindir) → Heks8 annulus ───────────────────────────────
function _veFEAMeshShaft(p, size) {
  var rOut = Math.max(0.5, p.outerRadius || 20);
  var rIn  = Math.max(0,   p.innerRadius || 8);
  if (rIn >= rOut) rIn = Math.max(0, rOut - 1);
  var L    = Math.max(0.1, p.length || 120);
  var nC = Math.max(8, Math.round(2 * Math.PI * rOut / size));
  var nR = Math.max(1, Math.round((rOut - rIn) / size));
  var nA = Math.max(1, Math.round(L / size));

  var perLayer = (nR + 1) * nC;
  var nNodes = perLayer * (nA + 1);
  var nodes = new Float32Array(nNodes * 3);
  var halfL = L / 2;

  for (var k = 0; k <= nA; k++) {
    var y = -halfL + (L * k / nA);
    for (var rr = 0; rr <= nR; rr++) {
      var rad = rIn + (rOut - rIn) * rr / nR;
      for (var c = 0; c < nC; c++) {
        var theta = 2 * Math.PI * c / nC;
        var idx = k * perLayer + rr * nC + c;
        nodes[idx * 3]     = rad * Math.cos(theta);
        nodes[idx * 3 + 1] = y;
        nodes[idx * 3 + 2] = rad * Math.sin(theta);
      }
    }
  }

  function annNode(layer, ring, circ) {
    return layer * perLayer + ring * nC + ((circ % nC + nC) % nC);
  }

  var nElem = nR * nC * nA;
  var elements = new Uint32Array(nElem * 8);
  var e = 0;
  for (var ka = 0; ka < nA; ka++) {
    for (var rr2 = 0; rr2 < nR; rr2++) {
      for (var c2 = 0; c2 < nC; c2++) {
        var n0 = annNode(ka,     rr2,     c2);
        var n1 = annNode(ka,     rr2,     c2 + 1);
        var n2 = annNode(ka,     rr2 + 1, c2 + 1);
        var n3 = annNode(ka,     rr2 + 1, c2);
        var n4 = annNode(ka + 1, rr2,     c2);
        var n5 = annNode(ka + 1, rr2,     c2 + 1);
        var n6 = annNode(ka + 1, rr2 + 1, c2 + 1);
        var n7 = annNode(ka + 1, rr2 + 1, c2);
        var off = e * 8; e++;
        elements[off]     = n0; elements[off + 1] = n1;
        elements[off + 2] = n2; elements[off + 3] = n3;
        elements[off + 4] = n4; elements[off + 5] = n5;
        elements[off + 6] = n6; elements[off + 7] = n7;
      }
    }
  }

  return {
    type: 'hex8',
    geometryType: 'shaft',
    nodes: nodes,
    elements: elements,
    nodesPerElement: 8,
    grid: { nRadial: nR, nCircum: nC, nAxial: nA },
    namedSelections: _veFEAShaftNamedSelections(nR, nC, nA)
  };
}

// Şaft için 4 yüzey (Alt, Üst, Dış Yan, İç Yan)
function _veFEAShaftNamedSelections(nR, nC, nA) {
  var perLayer = (nR + 1) * nC;
  function annNode(layer, ring, circ) {
    return layer * perLayer + ring * nC + ((circ % nC + nC) % nC);
  }
  function annulusNodes(layer) {
    var ids = new Uint32Array((nR + 1) * nC);
    var p = 0;
    for (var r = 0; r <= nR; r++) {
      for (var c = 0; c < nC; c++) ids[p++] = annNode(layer, r, c);
    }
    return ids;
  }
  function sideNodes(ring) {
    var ids = new Uint32Array((nA + 1) * nC);
    var p = 0;
    for (var k = 0; k <= nA; k++) {
      for (var c = 0; c < nC; c++) ids[p++] = annNode(k, ring, c);
    }
    return ids;
  }
  return {
    faceBottom: { type: 'face', source: 'auto', label: 'Alt Halka (Y−)', nodeIds: annulusNodes(0) },
    faceTop:    { type: 'face', source: 'auto', label: 'Üst Halka (Y+)', nodeIds: annulusNodes(nA) },
    faceOuter:  { type: 'face', source: 'auto', label: 'Dış Yan Yüzey',  nodeIds: sideNodes(nR) },
    faceInner:  { type: 'face', source: 'auto', label: 'İç Yan Yüzey (Delik)', nodeIds: sideNodes(0) }
  };
}

// ─── STL / STEP → parsed triangles (sync) ─────────────────────────────────
// STL için doğrudan parse. STEP için sync parse yok (async wrapper kullan).
function _veFEAParseSurfaceTriangles(geom) {
  if (!geom || !geom.rawDataB64) return null;
  if (typeof veFEABase64ToArrayBuffer !== 'function') return null;
  if (geom.type === 'stl' && typeof veFEAParseSTL === 'function') {
    var buf = veFEABase64ToArrayBuffer(geom.rawDataB64);
    var parsed = veFEAParseSTL(buf);
    if (parsed && parsed.triangleCount > 0) return parsed;
  }
  // STEP sync parse yok — veFEAMeshFromGeometryAsync kullanılır
  return null;
}

// ─── Voxel hacim mesh (Heks8) — STL/STEP karmaşık geometriler için ────────
// Algoritma: bbox içinde voxel grid, X-eksenli ray casting ile parite testi,
// içeride kalan voxel'leri Heks8 olarak (ortak köşeler dedup'lı).
// ANSYS'in "Cartesian mesh" yöntemine benzer. Karmaşık geometrilerde çalışır;
// yüzeyde staircase artifact görülür (gerçek tet mesher F3c+ için planlı).
function _veFEAVoxelizeTrianglesToHex(parsed, voxelSize, geometryType) {
  if (!parsed || !parsed.vertices || parsed.triangleCount === 0) return null;
  var verts = parsed.vertices;
  var triCount = parsed.triangleCount;

  // BBox
  var minX = Infinity, minY = Infinity, minZ = Infinity;
  var maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
  for (var i = 0; i < verts.length; i += 3) {
    var vx = verts[i], vy = verts[i + 1], vz = verts[i + 2];
    if (vx < minX) minX = vx; if (vx > maxX) maxX = vx;
    if (vy < minY) minY = vy; if (vy > maxY) maxY = vy;
    if (vz < minZ) minZ = vz; if (vz > maxZ) maxZ = vz;
  }
  // Voxel grid boyutu — bbox'a tam oturur. Sınır artifaclarını önlemek için
  // ray casting'de küçük asal offset'ler kullanılır (vertex/edge'lere denk
  // gelmesin diye).
  var nx = Math.max(1, Math.ceil((maxX - minX) / voxelSize));
  var ny = Math.max(1, Math.ceil((maxY - minY) / voxelSize));
  var nz = Math.max(1, Math.ceil((maxZ - minZ) / voxelSize));
  if (nx * ny * nz > VE_FEA_VOXEL_MAX_COUNT) {
    // Çok yoğun mesh — mesh boyu artırılmalı
    return { error: 'voxel-too-many', nx: nx, ny: ny, nz: nz, total: nx*ny*nz };
  }

  var dx = (maxX - minX) / nx;
  var dy = (maxY - minY) / ny;
  var dz = (maxZ - minZ) / nz;

  // Üçgenleri Y-Z bbox'ına göre indexle: her j satırı için hangi üçgenler kesebilir?
  // 2D Y-row binning — daha hızlı bir prefilter.
  var triBuckets = new Array(ny);
  for (var j = 0; j < ny; j++) triBuckets[j] = [];
  for (var t = 0; t < triCount; t++) {
    var off = t * 9;
    var y1 = verts[off + 1], y2 = verts[off + 4], y3 = verts[off + 7];
    var triMinY = Math.min(y1, y2, y3);
    var triMaxY = Math.max(y1, y2, y3);
    var jMin = Math.max(0, Math.floor((triMinY - minY) / dy));
    var jMax = Math.min(ny - 1, Math.floor((triMaxY - minY) / dy));
    for (var jj = jMin; jj <= jMax; jj++) triBuckets[jj].push(t);
  }

  // İç voxel bayrakları (kompakt: Uint8Array)
  var inside = new Uint8Array(nx * ny * nz);

  // Ray pozisyonu için küçük asal offset'ler (vertex/edge'lere denk gelme
  // olasılığını azaltır — yarı-rastgele ama deterministic).
  var offY = voxelSize * 0.001337;
  var offZ = voxelSize * 0.002473;

  for (var k = 0; k < nz; k++) {
    var rayZ = minZ + (k + 0.5) * dz + offZ;
    for (var j2 = 0; j2 < ny; j2++) {
      var rayY = minY + (j2 + 0.5) * dy + offY;
      var bucket = triBuckets[j2];
      // Üçgenlerin Z aralığını da prefilter et
      var hits = [];
      for (var b = 0; b < bucket.length; b++) {
        var ti = bucket[b];
        var o2 = ti * 9;
        var x1 = verts[o2],     y1b = verts[o2 + 1], z1 = verts[o2 + 2];
        var x2 = verts[o2 + 3], y2b = verts[o2 + 4], z2 = verts[o2 + 5];
        var x3 = verts[o2 + 6], y3b = verts[o2 + 7], z3 = verts[o2 + 8];
        // Z prefilter
        var triMinZ = Math.min(z1, z2, z3);
        var triMaxZ = Math.max(z1, z2, z3);
        if (rayZ < triMinZ || rayZ > triMaxZ) continue;
        // YZ projeksiyonunda point-in-triangle (standart barycentric)
        // l_i = signed_area(P, V_{i+1}, V_{i+2}) / signed_area(V1, V2, V3)
        var area = (y2b - y1b) * (z3 - z1) - (z2 - z1) * (y3b - y1b);
        if (Math.abs(area) < 1e-14) continue; // X-paralel üçgen, kesişim belirsiz
        var l1 = ((y2b - rayY) * (z3  - rayZ) - (z2  - rayZ) * (y3b - rayY)) / area;
        var l2 = ((y3b - rayY) * (z1  - rayZ) - (z3  - rayZ) * (y1b - rayY)) / area;
        var l3 = 1 - l1 - l2;
        var eps = 1e-9;
        if (l1 < -eps || l2 < -eps || l3 < -eps) continue;
        var hitX = l1 * x1 + l2 * x2 + l3 * x3;
        hits.push(hitX);
      }
      hits.sort(function(a, b) { return a - b; });

      // Parite ile voxel'leri işaretle
      var hitIdx = 0;
      var insideFlag = false;
      for (var i2 = 0; i2 < nx; i2++) {
        var voxX = minX + (i2 + 0.5) * dx;
        while (hitIdx < hits.length && hits[hitIdx] < voxX) {
          insideFlag = !insideFlag;
          hitIdx++;
        }
        if (insideFlag) {
          inside[i2 + j2 * nx + k * nx * ny] = 1;
        }
      }
    }
  }

  // İç voxel'lerden Heks8 mesh oluştur — sparse vertex dedup
  // Vertex grid: (nx+1) × (ny+1) × (nz+1) potansiyel köşe
  // Sadece kullanılan köşeler eklenir
  var pitchY = (nx + 1);
  var pitchZ = (nx + 1) * (ny + 1);
  // map: grid index → mesh node index. -1 = henüz eklenmedi
  var nodeMap = new Int32Array((nx + 1) * (ny + 1) * (nz + 1));
  for (var im = 0; im < nodeMap.length; im++) nodeMap[im] = -1;
  var nodeList = [];
  function getNode(i, j, k) {
    var idx = i + j * pitchY + k * pitchZ;
    var existing = nodeMap[idx];
    if (existing >= 0) return existing;
    var newIdx = nodeList.length / 3;
    nodeList.push(minX + i * dx, minY + j * dy, minZ + k * dz);
    nodeMap[idx] = newIdx;
    return newIdx;
  }

  var elements = [];
  for (var k3 = 0; k3 < nz; k3++) {
    for (var j3 = 0; j3 < ny; j3++) {
      for (var i3 = 0; i3 < nx; i3++) {
        if (!inside[i3 + j3 * nx + k3 * nx * ny]) continue;
        var n0 = getNode(i3,     j3,     k3);
        var n1 = getNode(i3 + 1, j3,     k3);
        var n2 = getNode(i3 + 1, j3 + 1, k3);
        var n3 = getNode(i3,     j3 + 1, k3);
        var n4 = getNode(i3,     j3,     k3 + 1);
        var n5 = getNode(i3 + 1, j3,     k3 + 1);
        var n6 = getNode(i3 + 1, j3 + 1, k3 + 1);
        var n7 = getNode(i3,     j3 + 1, k3 + 1);
        elements.push(n0, n1, n2, n3, n4, n5, n6, n7);
      }
    }
  }

  if (elements.length === 0) return { error: 'voxel-empty', nx: nx, ny: ny, nz: nz, total: nx*ny*nz };

  var elementsTA = new Uint32Array(elements);
  var nodesTA = new Float32Array(nodeList);

  return {
    type: 'hex8',
    geometryType: 'voxel-' + (geometryType || 'unknown'),
    nodes: nodesTA,
    elements: elementsTA,
    nodesPerElement: 8,
    grid: { nx: nx, ny: ny, nz: nz, voxelCount: elementsTA.length / 8 },
    voxelMode: true,
    namedSelections: _veFEAVoxelMeshNamedSelections(nodesTA, elementsTA, 8, { minX: minX, maxX: maxX, minY: minY, maxY: maxY, minZ: minZ, maxZ: maxZ })
  };
}

// Voxel mesh için yüzey nodları (degree-based): iç hex düğümleri 8 elemana bağlı,
// yüzeydekiler daha az. Ayrıca bbox sınırlarına göre yön bazlı gruplandırma.
function _veFEAVoxelMeshNamedSelections(nodes, elements, per, bbox) {
  var nodeCount = nodes.length / 3;
  var degree = new Uint8Array(nodeCount);
  for (var e = 0; e < elements.length; e++) {
    if (degree[elements[e]] < 255) degree[elements[e]]++;
  }
  var surfaceIds = [];
  for (var n = 0; n < nodeCount; n++) {
    if (degree[n] < 8) surfaceIds.push(n);
  }
  var sel = {
    faceSurface: {
      type: 'face', source: 'auto', label: 'Tüm Yüzey',
      nodeIds: new Uint32Array(surfaceIds)
    }
  };
  // bbox bilgisi varsa yön-bazlı gruplar da ekle (X−/X+/Y−/Y+/Z−/Z+)
  if (bbox) {
    var eps = 1e-3;
    function addDir(name, label, axis, isMax) {
      var lim = isMax ? bbox[axis === 'x' ? 'maxX' : axis === 'y' ? 'maxY' : 'maxZ']
                      : bbox[axis === 'x' ? 'minX' : axis === 'y' ? 'minY' : 'minZ'];
      var coord = axis === 'x' ? 0 : axis === 'y' ? 1 : 2;
      var ids = [];
      for (var i = 0; i < surfaceIds.length; i++) {
        var id = surfaceIds[i];
        if (Math.abs(nodes[id * 3 + coord] - lim) < eps) ids.push(id);
      }
      if (ids.length > 0) {
        sel[name] = { type: 'face', source: 'auto', label: label, nodeIds: new Uint32Array(ids) };
      }
    }
    addDir('faceXMin', 'X− Yüzeyi', 'x', false);
    addDir('faceXMax', 'X+ Yüzeyi', 'x', true);
    addDir('faceYMin', 'Y− Yüzeyi (Alt)', 'y', false);
    addDir('faceYMax', 'Y+ Yüzeyi (Üst)', 'y', true);
    addDir('faceZMin', 'Z− Yüzeyi (Ön)', 'z', false);
    addDir('faceZMax', 'Z+ Yüzeyi (Arka)', 'z', true);
  }
  return sel;
}

// Parsed (vertices array, triangleCount) → dedup'lı tri3 mesh
function _veFEAMeshFromParsedTriangles(parsed, geometryType) {
  var verts = parsed.vertices;
  var triCount = parsed.triangleCount;
  var posMap = {};
  var unique = [];
  var elements = new Uint32Array(triCount * 3);
  function key(x, y, z) {
    return x.toFixed(5) + '|' + y.toFixed(5) + '|' + z.toFixed(5);
  }
  for (var i = 0; i < triCount; i++) {
    for (var v = 0; v < 3; v++) {
      var off = i * 9 + v * 3;
      var x = verts[off], y = verts[off + 1], z = verts[off + 2];
      var k = key(x, y, z);
      var idx;
      if (posMap[k] !== undefined) {
        idx = posMap[k];
      } else {
        idx = unique.length / 3;
        unique.push(x, y, z);
        posMap[k] = idx;
      }
      elements[i * 3 + v] = idx;
    }
  }
  return {
    type: 'tri3',
    geometryType: geometryType,
    nodes: new Float32Array(unique),
    elements: elements,
    nodesPerElement: 3
  };
}

// ─── Jacobian / signed volume metrikleri ──────────────────────────────────
// Eleman tipinin sub-tetrahedronlarının signed volume'unu hesaplar.
// Negatif veya çok küçük = inverted/degenerate (solver'da singular stiffness).
// Jacobian ratio = max|V_i| / min|V_i| → 1.0 mükemmel; ANSYS uyarı eşiği ~40.
//
// Algoritma:
//   - Tet4: kendisi (1 sub-tet)
//   - Hex8: diagonal 0-6 split → 6 sub-tet
//   - Wedge6: 3 sub-tet (wedge-to-tet decomposition ile aynı)
//   - Tri3: 2D mesh — Jacobian değil, üçgen alan kontrolü
function veFEAComputeJacobianMetrics(meshData, opts) {
  if (!meshData || meshData.error) return null;
  opts = opts || {};
  var jacEps = opts.eps !== undefined ? opts.eps : 1e-10;
  var ratioWarn = opts.ratioWarn || 40; // ANSYS varsayılan uyarı eşiği

  var nodes = meshData.nodes;
  var elements = meshData.elements;
  var per = meshData.nodesPerElement;
  var n = elements.length / per;
  var type = meshData.type;

  var invertedCount = 0;
  var degenerateCount = 0;
  var poorCount = 0; // ratio > ratioWarn
  var minVol = Infinity;
  var maxVol = -Infinity;
  var minRatio = Infinity;
  var maxRatio = -Infinity;
  var sumRatio = 0;
  var validRatioCount = 0;
  var invertedIds = [];

  for (var e = 0; e < n; e++) {
    var off = e * per;
    var vols;
    if (type === 'tet4')        vols = [_veFEATetSignedVolume(nodes, elements, off, 0, 1, 2, 3)];
    else if (type === 'hex8')   vols = _veFEAHexSubTetVolumes(nodes, elements, off);
    else if (type === 'wedge6') vols = _veFEAWedgeSubTetVolumes(nodes, elements, off);
    else continue;

    var absMin = Infinity, absMax = -Infinity, anyNeg = false, anyDeg = false;
    for (var i = 0; i < vols.length; i++) {
      var v = vols[i];
      var a = Math.abs(v);
      if (v <= -jacEps) anyNeg = true;
      if (a < jacEps) anyDeg = true;
      if (a < absMin) absMin = a;
      if (a > absMax) absMax = a;
    }
    var totalVol = 0;
    for (var ii = 0; ii < vols.length; ii++) totalVol += vols[ii];

    if (anyNeg) {
      invertedCount++;
      if (invertedIds.length < 20) invertedIds.push(e);
    } else if (anyDeg) {
      degenerateCount++;
    }

    if (totalVol < minVol) minVol = totalVol;
    if (totalVol > maxVol) maxVol = totalVol;

    if (absMin > jacEps) {
      var ratio = absMax / absMin;
      if (ratio < minRatio) minRatio = ratio;
      if (ratio > maxRatio) maxRatio = ratio;
      sumRatio += ratio;
      validRatioCount++;
      if (ratio > ratioWarn) poorCount++;
    }
  }

  return {
    elementCount: n,
    invertedCount: invertedCount,
    degenerateCount: degenerateCount,
    poorCount: poorCount,
    invertedIds: invertedIds, // ilk 20 tanesi (kullanıcı incelemesi için)
    minVolume: isFinite(minVol) ? minVol : 0,
    maxVolume: isFinite(maxVol) ? maxVol : 0,
    minJacRatio: isFinite(minRatio) ? minRatio : 0,
    maxJacRatio: isFinite(maxRatio) ? maxRatio : 0,
    avgJacRatio: validRatioCount ? (sumRatio / validRatioCount) : 0,
    ratioWarnThreshold: ratioWarn,
    valid: invertedCount === 0 && degenerateCount === 0
  };
}

function _veFEATetSignedVolume(nodes, elements, off, i0, i1, i2, i3) {
  var a = elements[off + i0] * 3, b = elements[off + i1] * 3, c = elements[off + i2] * 3, d = elements[off + i3] * 3;
  var v1x = nodes[b] - nodes[a], v1y = nodes[b+1] - nodes[a+1], v1z = nodes[b+2] - nodes[a+2];
  var v2x = nodes[c] - nodes[a], v2y = nodes[c+1] - nodes[a+1], v2z = nodes[c+2] - nodes[a+2];
  var v3x = nodes[d] - nodes[a], v3y = nodes[d+1] - nodes[a+1], v3z = nodes[d+2] - nodes[a+2];
  var cx = v2y*v3z - v2z*v3y;
  var cy = v2z*v3x - v2x*v3z;
  var cz = v2x*v3y - v2y*v3x;
  return (v1x*cx + v1y*cy + v1z*cz) / 6;
}

function _veFEAHexSubTetVolumes(nodes, elements, off) {
  var T = _VE_FEA_HEX_TET_SPLIT;
  var out = new Array(6);
  for (var i = 0; i < 6; i++) {
    out[i] = _veFEATetSignedVolume(nodes, elements, off, T[i][0], T[i][1], T[i][2], T[i][3]);
  }
  return out;
}

function _veFEAWedgeSubTetVolumes(nodes, elements, off) {
  var T = _VE_FEA_WEDGE_TET_SPLIT;
  var out = new Array(3);
  for (var i = 0; i < 3; i++) {
    out[i] = _veFEATetSignedVolume(nodes, elements, off, T[i][0], T[i][1], T[i][2], T[i][3]);
  }
  return out;
}

// ─── Eleman tipi için yüz şablonu (skewness/min-angle hesabı için) ─────────
// Her face → ordered düğüm indeksi listesi (CCW outward normal)
var _VE_FEA_TET4_FACES = [
  [0, 1, 2], [0, 1, 3], [1, 2, 3], [2, 0, 3]
];
var _VE_FEA_HEX8_FACES = [
  [0, 1, 2, 3], [4, 5, 6, 7],
  [0, 1, 5, 4], [1, 2, 6, 5], [2, 3, 7, 6], [3, 0, 4, 7]
];
var _VE_FEA_WEDGE6_FACES = [
  [0, 1, 2], [3, 4, 5],
  [0, 1, 4, 3], [1, 2, 5, 4], [2, 0, 3, 5]
];

function _veFEAGetFaceTemplate(type) {
  if (type === 'tet4'   || type === 'tet10')   return _VE_FEA_TET4_FACES;
  if (type === 'hex8'   || type === 'hex20')   return _VE_FEA_HEX8_FACES;
  if (type === 'wedge6' || type === 'wedge15') return _VE_FEA_WEDGE6_FACES;
  if (type === 'tri3') return [[0, 1, 2]];
  return [];
}

// İki kenarın ortak köşedeki iç açısı (derece cinsinden).
function _veFEAInteriorAngleDeg(nodes, prev, curr, next) {
  var v1x = nodes[prev]     - nodes[curr];
  var v1y = nodes[prev + 1] - nodes[curr + 1];
  var v1z = nodes[prev + 2] - nodes[curr + 2];
  var v2x = nodes[next]     - nodes[curr];
  var v2y = nodes[next + 1] - nodes[curr + 1];
  var v2z = nodes[next + 2] - nodes[curr + 2];
  var dot = v1x * v2x + v1y * v2y + v1z * v2z;
  var m1 = Math.sqrt(v1x * v1x + v1y * v1y + v1z * v1z);
  var m2 = Math.sqrt(v2x * v2x + v2y * v2y + v2z * v2z);
  if (m1 < 1e-12 || m2 < 1e-12) return 0;
  var c = dot / (m1 * m2);
  if (c > 1) c = 1; else if (c < -1) c = -1;
  return Math.acos(c) * 180 / Math.PI;
}

// Histogram: [minVal, maxVal] aralığını binCount eşit dilime böler.
function _veFEAHistogram(values, minVal, maxVal, binCount) {
  var bins = new Uint32Array(binCount);
  var range = maxVal - minVal;
  if (range <= 0 || binCount <= 0) return { bins: [], min: minVal, max: maxVal, binCount: binCount };
  for (var i = 0; i < values.length; i++) {
    var v = values[i];
    if (!isFinite(v)) continue;
    var b = Math.floor((v - minVal) / range * binCount);
    if (b < 0) b = 0;
    if (b >= binCount) b = binCount - 1;
    bins[b]++;
  }
  return {
    bins: Array.from(bins),
    min: minVal,
    max: maxVal,
    binCount: binCount
  };
}

// ─── Kalite metrikleri: aspect ratio + skewness + iç açı ──────────────────
// Aspect ratio (eleman bazında): max_edge / min_edge — 1.0 ideal, > 20 zayıf
// Equiangular skewness (face bazında): max((θ_max - θ_ideal)/(180 - θ_ideal),
//   (θ_ideal - θ_min)/θ_ideal). 0 = ideal, 1 = dejenere.
//   θ_ideal: üçgen yüz için 60°, kare yüz için 90°
// İç açı: tüm yüzlerin tüm köşe açıları — min ve max global histogram'a düşer.
function veFEAComputeQualityMetrics(meshData) {
  if (!meshData || meshData.error) return null;
  var nodes = meshData.nodes;
  var elements = meshData.elements;
  var per = meshData.nodesPerElement;
  var type = meshData.type;
  var n = elements.length / per;
  if (n === 0) return null;

  // Sadece köşe düğümlerini kullan (quadratic için corner count'u tespit et)
  var cornerCount;
  if (type === 'tet10') cornerCount = 4;
  else if (type === 'hex20') cornerCount = 8;
  else if (type === 'wedge15') cornerCount = 6;
  else cornerCount = per;

  var edges;
  if (type === 'hex8' || type === 'hex20')
    edges = [[0,1],[1,2],[2,3],[3,0], [4,5],[5,6],[6,7],[7,4], [0,4],[1,5],[2,6],[3,7]];
  else if (type === 'wedge6' || type === 'wedge15')
    edges = [[0,1],[1,2],[2,0], [3,4],[4,5],[5,3], [0,3],[1,4],[2,5]];
  else if (type === 'tet4' || type === 'tet10')
    edges = [[0,1],[0,2],[0,3],[1,2],[1,3],[2,3]];
  else if (type === 'tri3') edges = [[0,1],[1,2],[2,0]];
  else return null;

  var faces = _veFEAGetFaceTemplate(type);

  var aspectArr = new Float32Array(n);
  var skewArr = new Float32Array(n);
  var minAngleArr = new Float32Array(n);
  var maxAngleArr = new Float32Array(n);
  var poorAspect = 0;     // ar > 20
  var poorSkew = 0;       // sk > 0.85

  var gMinAr = Infinity, gMaxAr = -Infinity, sumAr = 0;
  var gMinSk = Infinity, gMaxSk = -Infinity, sumSk = 0;
  var gMinAng = Infinity, gMaxAng = -Infinity;

  for (var e = 0; e < n; e++) {
    var off = e * per;
    // Aspect
    var minE = Infinity, maxE = -Infinity;
    for (var i = 0; i < edges.length; i++) {
      var a = elements[off + edges[i][0]] * 3;
      var b = elements[off + edges[i][1]] * 3;
      var dx = nodes[a]     - nodes[b];
      var dy = nodes[a + 1] - nodes[b + 1];
      var dz = nodes[a + 2] - nodes[b + 2];
      var L = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (L < minE) minE = L;
      if (L > maxE) maxE = L;
    }
    var ar = (minE > 1e-12) ? (maxE / minE) : Infinity;
    aspectArr[e] = ar;
    if (isFinite(ar)) {
      if (ar < gMinAr) gMinAr = ar;
      if (ar > gMaxAr) gMaxAr = ar;
      sumAr += ar;
      if (ar > 20) poorAspect++;
    }

    // Skewness + min/max angle
    var elemMinAng = Infinity, elemMaxAng = -Infinity, elemSkew = 0;
    for (var f = 0; f < faces.length; f++) {
      var face = faces[f];
      var fLen = face.length;
      var idealAng = (fLen === 3) ? 60 : 90;
      for (var v = 0; v < fLen; v++) {
        var prevNode = elements[off + face[(v + fLen - 1) % fLen]] * 3;
        var currNode = elements[off + face[v]] * 3;
        var nextNode = elements[off + face[(v + 1) % fLen]] * 3;
        var ang = _veFEAInteriorAngleDeg(nodes, prevNode, currNode, nextNode);
        if (ang < elemMinAng) elemMinAng = ang;
        if (ang > elemMaxAng) elemMaxAng = ang;
        var dev1 = (180 - idealAng > 0) ? Math.max(0, ang - idealAng) / (180 - idealAng) : 0;
        var dev2 = (idealAng > 0)       ? Math.max(0, idealAng - ang) / idealAng       : 0;
        var sk = Math.max(dev1, dev2);
        if (sk > elemSkew) elemSkew = sk;
      }
    }
    skewArr[e] = elemSkew;
    minAngleArr[e] = elemMinAng;
    maxAngleArr[e] = elemMaxAng;

    if (elemMinAng < gMinAng) gMinAng = elemMinAng;
    if (elemMaxAng > gMaxAng) gMaxAng = elemMaxAng;
    if (elemSkew < gMinSk) gMinSk = elemSkew;
    if (elemSkew > gMaxSk) gMaxSk = elemSkew;
    sumSk += elemSkew;
    if (elemSkew > 0.85) poorSkew++;
  }

  return {
    elementCount: n,
    cornerCount: cornerCount,
    aspectRatio: {
      min: isFinite(gMinAr) ? gMinAr : 0,
      max: isFinite(gMaxAr) ? gMaxAr : 0,
      avg: sumAr / n,
      poorCount: poorAspect,
      warnThreshold: 20,
      histogram: _veFEAHistogram(aspectArr, 1, 20, 10)
    },
    skewness: {
      min: isFinite(gMinSk) ? gMinSk : 0,
      max: isFinite(gMaxSk) ? gMaxSk : 0,
      avg: sumSk / n,
      poorCount: poorSkew,
      warnThreshold: 0.85,
      histogram: _veFEAHistogram(skewArr, 0, 1, 10)
    },
    angle: {
      min: isFinite(gMinAng) ? gMinAng : 0,
      max: isFinite(gMaxAng) ? gMaxAng : 0,
      histogram: _veFEAHistogram(minAngleArr, 0, 180, 12)
    }
  };
}

// ─── Per-element kalite değerleri (heat map için) ─────────────────────────
// veFEAComputeQualityMetrics özet değerler döner; viewer renk için her eleman
// için tek değer ister. Bu fonksiyon istenen metriği eleman array'i olarak verir.
function veFEAComputePerElementQuality(meshData, metric) {
  if (!meshData || meshData.error) return null;
  var nodes = meshData.nodes;
  var elements = meshData.elements;
  var per = meshData.nodesPerElement;
  var type = meshData.type;
  var n = elements.length / per;
  if (n === 0) return null;

  var edges;
  if (type === 'hex8' || type === 'hex20')
    edges = [[0,1],[1,2],[2,3],[3,0], [4,5],[5,6],[6,7],[7,4], [0,4],[1,5],[2,6],[3,7]];
  else if (type === 'wedge6' || type === 'wedge15')
    edges = [[0,1],[1,2],[2,0], [3,4],[4,5],[5,3], [0,3],[1,4],[2,5]];
  else if (type === 'tet4' || type === 'tet10')
    edges = [[0,1],[0,2],[0,3],[1,2],[1,3],[2,3]];
  else if (type === 'tri3') edges = [[0,1],[1,2],[2,0]];
  else return null;

  var faces = _veFEAGetFaceTemplate(type);
  var out = new Float32Array(n);

  for (var e = 0; e < n; e++) {
    var off = e * per;

    if (metric === 'aspect') {
      var minE = Infinity, maxE = -Infinity;
      for (var i = 0; i < edges.length; i++) {
        var a = elements[off + edges[i][0]] * 3;
        var b = elements[off + edges[i][1]] * 3;
        var dx = nodes[a]     - nodes[b];
        var dy = nodes[a + 1] - nodes[b + 1];
        var dz = nodes[a + 2] - nodes[b + 2];
        var L = Math.sqrt(dx * dx + dy * dy + dz * dz);
        if (L < minE) minE = L;
        if (L > maxE) maxE = L;
      }
      out[e] = (minE > 1e-12) ? (maxE / minE) : 999;

    } else if (metric === 'skewness') {
      var elemSkew = 0;
      for (var f = 0; f < faces.length; f++) {
        var face = faces[f];
        var fLen = face.length;
        var idealAng = (fLen === 3) ? 60 : 90;
        for (var v = 0; v < fLen; v++) {
          var prevNode = elements[off + face[(v + fLen - 1) % fLen]] * 3;
          var currNode = elements[off + face[v]] * 3;
          var nextNode = elements[off + face[(v + 1) % fLen]] * 3;
          var ang = _veFEAInteriorAngleDeg(nodes, prevNode, currNode, nextNode);
          var d1 = (180 - idealAng > 0) ? Math.max(0, ang - idealAng) / (180 - idealAng) : 0;
          var d2 = (idealAng > 0)       ? Math.max(0, idealAng - ang) / idealAng       : 0;
          var sk = Math.max(d1, d2);
          if (sk > elemSkew) elemSkew = sk;
        }
      }
      out[e] = elemSkew;

    } else if (metric === 'minAngle') {
      var elemMinA = Infinity;
      for (var ff = 0; ff < faces.length; ff++) {
        var fc = faces[ff];
        var fL = fc.length;
        for (var vv = 0; vv < fL; vv++) {
          var pn = elements[off + fc[(vv + fL - 1) % fL]] * 3;
          var cn = elements[off + fc[vv]] * 3;
          var nn = elements[off + fc[(vv + 1) % fL]] * 3;
          var aa = _veFEAInteriorAngleDeg(nodes, pn, cn, nn);
          if (aa < elemMinA) elemMinA = aa;
        }
      }
      out[e] = isFinite(elemMinA) ? elemMinA : 0;

    } else if (metric === 'jacobianRatio') {
      var vols;
      if (type === 'tet4' || type === 'tet10') vols = [_veFEATetSignedVolume(nodes, elements, off, 0, 1, 2, 3)];
      else if (type === 'hex8' || type === 'hex20') vols = _veFEAHexSubTetVolumes(nodes, elements, off);
      else if (type === 'wedge6' || type === 'wedge15') vols = _veFEAWedgeSubTetVolumes(nodes, elements, off);
      else { out[e] = 1; continue; }
      var absMin = Infinity, absMax = -Infinity;
      for (var k = 0; k < vols.length; k++) {
        var av = Math.abs(vols[k]);
        if (av < absMin) absMin = av;
        if (av > absMax) absMax = av;
      }
      out[e] = (absMin > 1e-12) ? (absMax / absMin) : 999;
    } else {
      out[e] = 0;
    }
  }
  return out;
}

// ─── Yüzey üçgeni çıkarımı (boundary face detection) ──────────────────────
// Her face'i sıralı düğüm anahtarıyla hash'le; tek görünen = boundary.
// Quadratic elemanlar için corner face'leri kullanılır.
function veFEAExtractSurfaceTriangles(meshData) {
  if (!meshData) return null;
  var type = meshData.type;
  var nodes = meshData.nodes;
  var elements = meshData.elements;
  var per = meshData.nodesPerElement;
  var n = elements.length / per;
  if (n === 0) return null;

  // Tri3 → her eleman zaten yüzey
  if (type === 'tri3') {
    var positions = new Float32Array(n * 9);
    var elemIds = new Uint32Array(n);
    for (var i = 0; i < n; i++) {
      for (var v = 0; v < 3; v++) {
        var nid = elements[i * 3 + v];
        positions[i * 9 + v * 3]     = nodes[nid * 3];
        positions[i * 9 + v * 3 + 1] = nodes[nid * 3 + 1];
        positions[i * 9 + v * 3 + 2] = nodes[nid * 3 + 2];
      }
      elemIds[i] = i;
    }
    return { positions: positions, elementIds: elemIds };
  }

  var faces = _veFEAGetFaceTemplate(type);
  if (faces.length === 0) return null;

  // Map<sorted_face_key, { count, ids, elementId }>
  var faceMap = new Map();
  for (var e = 0; e < n; e++) {
    var off = e * per;
    for (var f = 0; f < faces.length; f++) {
      var face = faces[f];
      var ids = new Array(face.length);
      for (var ii = 0; ii < face.length; ii++) ids[ii] = elements[off + face[ii]];
      var sorted = ids.slice().sort(function(a, b) { return a - b; });
      var key = sorted.join('|');
      var existing = faceMap.get(key);
      if (existing) existing.count++;
      else faceMap.set(key, { count: 1, ids: ids, elementId: e });
    }
  }

  // Boundary'ler: count == 1 (interior count == 2)
  var triPos = [];
  var triElems = [];
  faceMap.forEach(function(fm) {
    if (fm.count !== 1) return;
    var ids = fm.ids;
    if (ids.length === 3) {
      for (var v = 0; v < 3; v++) {
        triPos.push(nodes[ids[v] * 3], nodes[ids[v] * 3 + 1], nodes[ids[v] * 3 + 2]);
      }
      triElems.push(fm.elementId);
    } else if (ids.length === 4) {
      // Quad → 2 üçgen (0,1,2) + (0,2,3)
      [0, 1, 2, 0, 2, 3].forEach(function(idx, k) {
        var nid = ids[idx];
        triPos.push(nodes[nid * 3], nodes[nid * 3 + 1], nodes[nid * 3 + 2]);
        if (k % 3 === 0) triElems.push(fm.elementId);
      });
    }
  });

  return {
    positions: new Float32Array(triPos),
    elementIds: new Uint32Array(triElems)
  };
}

// Jet color ramp: t ∈ [0,1] → [r, g, b] ∈ [0,1]³
// Mavi (cold = iyi) → Cyan → Yeşil → Sarı → Kırmızı (hot = kötü)
function veFEAJetColor(t) {
  if (!isFinite(t)) t = 0;
  if (t < 0) t = 0; else if (t > 1) t = 1;
  var r = Math.max(0, Math.min(1, 4 * t - 1.5));
  var g = Math.max(0, Math.min(1, 4 * t - 0.5)) - Math.max(0, Math.min(1, 4 * t - 2.5));
  var b = Math.max(0, Math.min(1, -4 * t + 2.5));
  return [r, g, b];
}

// ─── Kalite metrikleri (basit: edge length, eleman sayısı) ─────────────────
function veFEAComputeMeshMetrics(mesh) {
  if (!mesh) return null;
  var nodes = mesh.nodes;
  var elements = mesh.elements;
  var per = mesh.nodesPerElement;
  var nodeCount = nodes.length / 3;
  var elementCount = elements.length / per;

  var edges;
  if (mesh.type === 'hex8' || mesh.type === 'hex20')
    edges = [[0,1],[1,2],[2,3],[3,0], [4,5],[5,6],[6,7],[7,4], [0,4],[1,5],[2,6],[3,7]];
  else if (mesh.type === 'wedge6' || mesh.type === 'wedge15')
    edges = [[0,1],[1,2],[2,0], [3,4],[4,5],[5,3], [0,3],[1,4],[2,5]];
  else if (mesh.type === 'tet4' || mesh.type === 'tet10')
    edges = [[0,1],[0,2],[0,3],[1,2],[1,3],[2,3]];
  else if (mesh.type === 'tri3')   edges = [[0,1],[1,2],[2,0]];
  else                              edges = [];

  var minSize = Infinity, maxSize = -Infinity, sumSize = 0, edgeCount = 0;
  for (var e = 0; e < elementCount; e++) {
    var off = e * per;
    for (var p = 0; p < edges.length; p++) {
      var a = elements[off + edges[p][0]];
      var b = elements[off + edges[p][1]];
      var dx = nodes[a * 3]     - nodes[b * 3];
      var dy = nodes[a * 3 + 1] - nodes[b * 3 + 1];
      var dz = nodes[a * 3 + 2] - nodes[b * 3 + 2];
      var L = Math.sqrt(dx * dx + dy * dy + dz * dz);
      if (L < minSize) minSize = L;
      if (L > maxSize) maxSize = L;
      sumSize += L;
      edgeCount++;
    }
  }

  return {
    nodeCount: nodeCount,
    elementCount: elementCount,
    elementType: mesh.type,
    minSize: edgeCount ? minSize : 0,
    maxSize: edgeCount ? maxSize : 0,
    avgSize: edgeCount ? sumSize / edgeCount : 0
  };
}

// Named selections'tan UI/persistence için özet üretir (nodeIds hariç)
//   { <key>: { label, type, source, nodeCount } }
// Float32Array/Uint32Array JSON-serializable değildir; özet localStorage'a
// güvenle yazılabilir. Tam veri her zaman veFEAMeshCache'de canlı durur.
function veFEAComputeNamedSelectionsSummary(mesh) {
  if (!mesh || !mesh.namedSelections) return {};
  var sel = mesh.namedSelections;
  var out = {};
  Object.keys(sel).forEach(function(k) {
    var ns = sel[k];
    out[k] = {
      label: ns.label,
      type: ns.type,
      source: ns.source,
      nodeCount: ns.nodeIds ? ns.nodeIds.length : 0
    };
  });
  return out;
}

// Mesh edges'i toplar (her edge tek kez) — viewer line render'ı için
function veFEAMeshExtractEdges(mesh) {
  if (!mesh) return null;
  var per = mesh.nodesPerElement;
  var edges;
  if (mesh.type === 'hex8' || mesh.type === 'hex20')
    edges = [[0,1],[1,2],[2,3],[3,0], [4,5],[5,6],[6,7],[7,4], [0,4],[1,5],[2,6],[3,7]];
  else if (mesh.type === 'wedge6' || mesh.type === 'wedge15')
    edges = [[0,1],[1,2],[2,0], [3,4],[4,5],[5,3], [0,3],[1,4],[2,5]];
  else if (mesh.type === 'tet4' || mesh.type === 'tet10')
    edges = [[0,1],[0,2],[0,3],[1,2],[1,3],[2,3]];
  else if (mesh.type === 'tri3')   edges = [[0,1],[1,2],[2,0]];
  else                              edges = [];

  var seen = {};
  var lines = [];
  var nodes = mesh.nodes;
  var elements = mesh.elements;
  var elementCount = elements.length / per;
  for (var e = 0; e < elementCount; e++) {
    var off = e * per;
    for (var p = 0; p < edges.length; p++) {
      var a = elements[off + edges[p][0]];
      var b = elements[off + edges[p][1]];
      var key = a < b ? (a + '-' + b) : (b + '-' + a);
      if (seen[key]) continue;
      seen[key] = 1;
      lines.push(nodes[a * 3], nodes[a * 3 + 1], nodes[a * 3 + 2]);
      lines.push(nodes[b * 3], nodes[b * 3 + 1], nodes[b * 3 + 2]);
    }
  }
  return new Float32Array(lines);
}
