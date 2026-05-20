// ============================================================================
// FEA MESH ÜRETİMİ
// ============================================================================
// Geometriyi sonlu eleman ağına böler. Native mesher'lar:
//   - Kutu        → Heks8 structured (nx × ny × nz)
//   - Silindir    → Heks8 O-grid (butterfly) veya Wedge6 fan (legacy)
//   - Şaft        → Heks8 annulus (radyal × açısal × eksenel)
//   - Cone/Sphere/Torus/Hemisphere/I-beam/L-bracket/Rect-tube — Heks8/Wedge6
//   - STEP/STL    → Tet4 (Delaunay) veya Heks8 (voxel fallback)
//
// Public API:
//   veFEAMeshFromGeometry(geometry, opts)      → FEAMeshData | FEAMeshError
//   veFEAMeshFromGeometryAsync(geometry, opts) → Promise<FEAMeshData | FEAMeshError>
//   veFEAMeshFromGeometryViaWorker(...)        → Promise (web worker)
//   veFEAComputeMeshMetrics(meshData)          → FEAMeshMetrics
//   veFEAComputeQualityMetrics(meshData)       → quality stats (aspect/skewness/...)
//   veFEAComputeJacobianMetrics(meshData)      → jacobian stats
//   veFEAConvertMeshToTet4(meshData)           → tet4 mesh (decomposition)
//   veFEAEnrichToQuadratic(meshData)           → hex20/tet10/wedge15
//   veFEAMeshLabel(type)                       → görünür label
//
// ─── FEAMeshData kontratı (JSDoc) ───────────────────────────────────────────
// ============================================================================

/**
 * @typedef {Object} FEAMeshData
 * @property {('hex8'|'wedge6'|'tet4'|'tri3'|'pyramid5'|'hex20'|'tet10'|'wedge15')} type
 *   Eleman tipi. Native generated veya conversion/enrichment çıktısı.
 * @property {string} geometryType
 *   Kaynak geometri etiketi: 'box' | 'cylinder' | 'shaft' | 'cone' | 'sphere'
 *   | 'torus' | 'hemisphere' | 'ibeam' | 'lbracket' | 'recttube' | 'voxel-step'
 *   | 'delaunay-<src>' | 'tri-surface-<src>'.
 * @property {Float32Array} nodes
 *   Düğüm pozisyonları, flat [x0,y0,z0, x1,y1,z1, ...] (length = 3·nodeCount).
 * @property {Uint32Array} elements
 *   Eleman bağlantıları, flat indices (length = nodesPerElement·elementCount).
 * @property {number} nodesPerElement
 *   Eleman başına düğüm: 3 (tri3), 4 (tet4), 5 (pyramid5), 6 (wedge6),
 *   8 (hex8), 10 (tet10), 15 (wedge15), 20 (hex20).
 * @property {Object<string,FEANamedSelection>} [namedSelections]
 *   Auto/manual yüzey/edge/node/element grupları. Geometriye göre otomatik:
 *   kutu→6 yüzey, silindir→3, şaft→4, voxel→tek yüzey grubu. BC referansı.
 * @property {Object} [grid]
 *   Yapısal grid'lerde topolojik boyutlar (örn. {nx,ny,nz} veya
 *   {nRadial,nCircum,nAxial}). Voxel/Delaunay mesh'te bulunmaz.
 * @property {FEAMeshMetrics} [metrics]
 *   Compute sonrası eklenen istatistikler (veFEAComputeMeshMetrics ile).
 */

/**
 * @typedef {Object} FEANamedSelection
 * @property {('face'|'edge'|'node'|'element')} type
 * @property {('auto'|'manual')} source
 * @property {string} label  Kullanıcıya görünen isim.
 * @property {Uint32Array} nodeIds  Global düğüm indeksleri.
 */

/**
 * @typedef {Object} FEAMeshError
 * @property {string} error  Hata kodu: 'voxel-too-many' | 'voxel-empty'
 *   | 'mixed-element-types' | 'tet-mesher-failed' | ...
 * @property {string} [message]  Açıklama.
 * @property {number} [nx]  Voxel hatalarında grid boyutları.
 * @property {number} [ny]
 * @property {number} [nz]
 * @property {number} [total]  Toplam voxel sayısı (üst sınır aşımında).
 */

/**
 * @typedef {Object} FEAMeshMetrics
 * @property {number} nodeCount
 * @property {number} elementCount
 * @property {string} elementType
 * @property {{minX:number,maxX:number,minY:number,maxY:number,minZ:number,maxZ:number}} [bbox]
 * @property {Object} [quality]   Aspect/skewness/angle istatistikleri.
 * @property {Object} [jacobian]  Jacobian ratio istatistikleri.
 */

var VE_FEA_MESH_MIN_SIZE = 0.5;  // mm — çok küçük değerleri clamp et
var VE_FEA_VOXEL_MAX_COUNT = 20000000; // 20M voxel üst sınır — sub-1mm mesh için
                                       // büyük geometrilerde headroom sağlar.
                                       // Boundary-snap fallback'i (degree-based)
                                       // yüzey düğümlerini tarayacağı için RAM
                                       // büyür ama hala makul sınırda kalır
                                       // (20M voxel ≈ 100³ × 20 ≈ 480 MB Float32).

function veFEAMeshLabel(type) {
  return ({
    'hex8':   'Heks8',
    'wedge6': 'Wedge6 (Prizm)',
    'tet4':   'Tet4 (Tetra)',
    'tet10':  'Tet10 (Kuadratik Tetra)',
    'hex20':  'Hex20 (Kuadratik Heks)',
    'pyramid5': 'Pyramid5 (Piramit)',
    'wedge15':'Wedge15 (Kuadratik Prizm)',
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

// ─── Hex8 → 6 Pyramid5 (centroid apex) decomposition ──────────────────────
// Bir Hex8'i 6 piramide böler: her hex face'i taban + hex centroid'i apex.
// Bu Pyramid5'lerin tabanları orijinal hex face'leri ile birebir uyumlu,
// dolayısıyla komşu hex'lerle tet4 / hex8 / wedge6 elemanlarına hibrit olarak
// bağlanabilir (ANSYS / Abaqus uyumu için klasik geçiş elemanı).
//
// Pyramid5 node order (Abaqus / VTK / ANSYS uyumlu):
//   [P0, P1, P2, P3] = taban kuad CCW (bakış: apex'ten tabana doğru)
//   [P4] = apex (centroid)
//
// Hex8 face listesi (ANSYS/Abaqus klasik CCW dış normal sırası):
//   Face 1: nodes 0,1,2,3 (alt, -Z), normal -Z
//   Face 2: nodes 4,5,6,7 (üst, +Z), normal +Z → CCW dış: 4,7,6,5
//   Face 3: nodes 0,1,5,4 (-Y),       normal -Y → CCW dış: 0,1,5,4 (zaten)
//   Face 4: nodes 1,2,6,5 (+X),       normal +X → CCW dış: 1,2,6,5
//   Face 5: nodes 2,3,7,6 (+Y),       normal +Y → CCW dış: 2,3,7,6 (zaten CCW from +Y)
//   Face 6: nodes 3,0,4,7 (-X),       normal -X → CCW dış: 3,0,4,7
var _VE_FEA_HEX_PYRAMID_FACES = [
  [0, 3, 2, 1],   // alt (-Z) → CCW bakış aşağıdan
  [4, 5, 6, 7],   // üst (+Z) → CCW bakış yukarıdan
  [0, 1, 5, 4],   // -Y
  [1, 2, 6, 5],   // +X
  [2, 3, 7, 6],   // +Y
  [3, 0, 4, 7]    // -X
];

function veFEAConvertHexToPyramid5(hexMesh) {
  if (!hexMesh || hexMesh.type !== 'hex8') return hexMesh;
  var hex = hexMesh.elements;
  var origNodes = hexMesh.nodes;
  var origNodeCount = origNodes.length / 3;
  var nElem = hex.length / 8;

  // Her hex için 1 centroid + 6 pyramid
  var newNodeCount = origNodeCount + nElem;
  var newNodes = new Float32Array(newNodeCount * 3);
  newNodes.set(origNodes);
  var pyrs = new Uint32Array(nElem * 6 * 5);
  var pOff = 0;

  for (var e = 0; e < nElem; e++) {
    var off = e * 8;
    // Centroid hesabı
    var cx = 0, cy = 0, cz = 0;
    for (var c = 0; c < 8; c++) {
      var n = hex[off + c];
      cx += origNodes[n * 3];
      cy += origNodes[n * 3 + 1];
      cz += origNodes[n * 3 + 2];
    }
    var apexId = origNodeCount + e;
    newNodes[apexId * 3]     = cx / 8;
    newNodes[apexId * 3 + 1] = cy / 8;
    newNodes[apexId * 3 + 2] = cz / 8;
    // 6 piramit (her yüz için)
    for (var f = 0; f < 6; f++) {
      var face = _VE_FEA_HEX_PYRAMID_FACES[f];
      pyrs[pOff++] = hex[off + face[0]];
      pyrs[pOff++] = hex[off + face[1]];
      pyrs[pOff++] = hex[off + face[2]];
      pyrs[pOff++] = hex[off + face[3]];
      pyrs[pOff++] = apexId;
    }
  }

  return {
    type: 'pyramid5',
    geometryType: hexMesh.geometryType,
    nodes: newNodes,
    elements: pyrs,
    nodesPerElement: 5,
    grid: hexMesh.grid,
    namedSelections: hexMesh.namedSelections,
    voxelMode: hexMesh.voxelMode || false,
    convertedFromHex: true
  };
}

// Pyramid5 → 2 Tet4 (4-3 split): pyramid (P0,P1,P2,P3,P4) →
//   Tet (P0,P1,P2,P4) + Tet (P0,P2,P3,P4)
function veFEAConvertPyramidToTet4(pyrMesh) {
  if (!pyrMesh || pyrMesh.type !== 'pyramid5') return pyrMesh;
  var pyr = pyrMesh.elements;
  var nElem = pyr.length / 5;
  var tets = new Uint32Array(nElem * 2 * 4);
  var p = 0;
  for (var e = 0; e < nElem; e++) {
    var off = e * 5;
    var p0 = pyr[off], p1 = pyr[off + 1], p2 = pyr[off + 2], p3 = pyr[off + 3], p4 = pyr[off + 4];
    tets[p++] = p0; tets[p++] = p1; tets[p++] = p2; tets[p++] = p4;
    tets[p++] = p0; tets[p++] = p2; tets[p++] = p3; tets[p++] = p4;
  }
  return _veFEAWrapTet4Mesh(pyrMesh, tets, { convertedFromPyramid: true });
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

  // Curvature-based refinement: opts.curvatureRefinement = { enabled, normalAngleDeg }
  // Eğrili yüzeylerde otomatik daha fine mesh (silindir/şaft çevresel segment)
  var curvOpts = opts.curvatureRefinement || null;
  var mesh = null;
  if (geometry.type === 'box')      mesh = _veFEAMeshBox(geometry.params || {}, size);
  else if (geometry.type === 'cylinder') mesh = _veFEAMeshCylinder(geometry.params || {}, size, curvOpts, { crossSection: opts.crossSection });
  else if (geometry.type === 'shaft')    mesh = _veFEAMeshShaft(geometry.params || {}, size, curvOpts);
  else if (geometry.type === 'sphere')     mesh = _veFEAMeshSphere(geometry.params || {}, size);
  else if (geometry.type === 'hemisphere') mesh = _veFEAMeshHemisphere(geometry.params || {}, size);
  else if (geometry.type === 'torus')      mesh = _veFEAMeshTorus(geometry.params || {}, size);
  else if (geometry.type === 'cone')       mesh = _veFEAMeshCone(geometry.params || {}, size, curvOpts, { crossSection: opts.crossSection });
  else if (geometry.type === 'rectTube') mesh = _veFEAMeshRectTube(geometry.params || {}, size);
  else if (geometry.type === 'lbracket') mesh = _veFEAMeshLBracket(geometry.params || {}, size);
  else if (geometry.type === 'ibeam')    mesh = _veFEAMeshIBeam(geometry.params || {}, size);
  else if (geometry.type === 'step') {
    // ANSYS-style otomatik primitif inference:
    // Tespit edilen feature seti tam bir primitif'e uyuyor mu? (silindir/küre/kutu)
    // Uyuyorsa voxel yerine yapısal primitive mesh kullan.
    if (geometry.detectedFeatures && typeof veFEAInferPrimitiveFromFeatures === 'function' &&
        opts.disablePrimitiveInference !== true && mode !== 'surface') {
      var inferred = veFEAInferPrimitiveFromFeatures(geometry.detectedFeatures, geometry.bbox);
      if (inferred && inferred.confidence > 0.85) {
        // Primitif olarak mesh'le
        var primMesh = veFEAMeshFromGeometry(
          { type: inferred.type, params: inferred.params },
          { size: size, curvatureRefinement: curvOpts, elementType: elementType,
            midSideNodes: opts.midSideNodes, localSizing: opts.localSizing,
            crossSection: opts.crossSection }
        );
        if (primMesh && !primMesh.error) {
          // Mesh node'larini tespit edilen orientation/center'a tasi
          _veFEATransformMeshToOrientation(primMesh, inferred.transform);
          // Etiketleme: bu STEP'ten infer edildi
          primMesh.geometryType = geometry.type;
          primMesh.originalGeometry = geometry.type;
          primMesh.inferredPrimitive = inferred;
          if (geometry.detectedFeatures.summary) {
            primMesh.detectedFeatureSummary = geometry.detectedFeatures.summary;
          }
          return primMesh;
        }
      }
    }
    // STEP için sync parse yok — async wrapper (veFEAMeshFromGeometryAsync)
    // kullanılır. Bu sync yol primitif inference başarısız olursa null döner.
    var parsed = _veFEAParseSurfaceTriangles(geometry);
    if (!parsed) return null;
    // mode kararı: auto → STEP için voxel hacim; surface → Tri3
    if (mode === 'surface') {
      return _veFEAMeshFromParsedTriangles(parsed, geometry.type);
    }
    // ANSYS-style: feature-aware curvature-adaptive voxel sizing (fallback)
    // Primitif eşleşmediyse ama eğri yüzey varsa, voxel boyutunu adapte et.
    mesh = _veFEAVoxelizeTrianglesToHex(parsed, size, geometry.type,
      geometry.detectedFeatures || null);
    if (mesh && !mesh.error && geometry.detectedFeatures && geometry.detectedFeatures.summary) {
      mesh.detectedFeatureSummary = geometry.detectedFeatures.summary;
    }
    // Boundary-snap fallback: primitif inference başarısız olunca kullanıcının
    // gördüğü "kübik mesh" hissini azaltmak için yüzey hex'lerini otomatik
    // tet4'e böl + yüzey düğümlerini orijinal üçgenlerin en yakın noktasına
    // snap et. opts.disableBoundarySnap === true ise atlanır (test/perf için).
    // elementType=hex8 isteyen kullanıcı için snap atlanır (kullanıcı niyetli).
    if (mesh && !mesh.error && mesh.voxelMode && opts.disableBoundarySnap !== true) {
      if (elementType !== 'hex8' && elementType !== 'pyramid5') {
        // Önce tet4'e çevir (snap'ten önce — tet düğümleri zaten hex düğümleri)
        var tetMesh = veFEAConvertMeshToTet4(mesh);
        if (tetMesh && !tetMesh.error) {
          mesh = tetMesh;
          // Sonra yüzey düğümlerini parsed üçgenlere snap et
          if (typeof _veFEABoundarySnapToTriangles === 'function') {
            var snapped = _veFEABoundarySnapToTriangles(mesh, parsed);
            if (snapped && !snapped.error) mesh = snapped;
          }
          // elementType="tet4" zaten yapıldı, sonraki tet4 conversion'u atla
          elementType = 'tet4-done';
        }
      }
    }
  }

  // GENERIC FALLBACK: Yukarıdaki hiçbir tip-spesifik case eşleşmediyse
  // (yeni primitif eklendi ama dispatch unutuldu, custom primitif vs.)
  // Three.js mesh'inden triangulated surface çıkar → voxel + boundary-snap.
  // veFEABuildPrimitiveMesh impl'i olan HERHANGİ bir tip için çalışır.
  // Tip-spesifik structured mesher (_veFEAMeshBox vs.) yalnız performans
  // ve kalite optimizasyonu — eksikse generic devreye girer, hata vermez.
  if (!mesh && geometry.type !== 'step') {
    mesh = _veFEAMeshGenericPrimitive(geometry, size, mode, elementType, opts);
  }

  // Lokal sizing (bias): yapısal mesh sonrasında düğüm konumlarını
  // hedef yüze doğru kümele. Tet4/quadratic dönüşümlerinden ÖNCE uygulanır
  // ki midpoint düğümleri doğru pozisyonda hesaplansın.
  if (mesh && !mesh.error && opts.localSizing && opts.localSizing.selection &&
      opts.localSizing.selection !== 'none' && _veFEALocalSizingActive(opts.localSizing)) {
    mesh = veFEAApplyLocalSizing(mesh, opts.localSizing);
  }
  // elementType: hex8/wedge6 → tet4 decomposition (yüzey tri3 etkilenmez)
  // 'tet4-done' sentinel: boundary-snap fallback'i zaten tet4 dönüşümünü yaptı.
  if (mesh && !mesh.error && elementType === 'tet4') {
    mesh = veFEAConvertMeshToTet4(mesh);
  }
  // elementType: hex8 → pyramid5 (hex-tet köprü elemanı; transition meshler için)
  if (mesh && !mesh.error && elementType === 'pyramid5' && mesh.type === 'hex8') {
    mesh = veFEAConvertHexToPyramid5(mesh);
  }
  // midSideNodes: lineer → quadratic (Tet4→Tet10, Hex8→Hex20, Wedge6→Wedge15)
  if (mesh && !mesh.error && opts.midSideNodes === true) {
    mesh = veFEAEnrichToQuadratic(mesh);
  }
  return mesh;
}

function _veFEALocalSizingActive(ls) {
  if (!ls) return false;
  var mode = ls.biasMode || 'power';
  if (mode === 'power') return Number(ls.biasStrength) > 0;
  if (mode === 'inflation') {
    var first = Number(ls.firstLayerThickness);
    var nLayers = parseInt(ls.layerCount, 10);
    return isFinite(first) && first > 0 && isFinite(nLayers) && nLayers >= 1;
  }
  return false;
}

// ─── Lokal sizing (boundary bias) ──────────────────────────────────────────
// Adı verilen yüzeye doğru düğümleri kümele. İki mod:
//   - power: t → t^p (sürekli, sade)
//   - inflation: geometric progression layer'ları + uniform interior
//
//   localSizing = {
//     selection: 'faceXMin',
//     biasMode: 'power' | 'inflation',  (default: 'power')
//     biasStrength: 0.7,                (power mode)
//     firstLayerThickness: 1,           (inflation mode, mm)
//     growthRate: 1.2,                  (inflation mode)
//     layerCount: 5                     (inflation mode)
//   }
// Eksen yönlü yüzeyler desteklenir (X, Y, Z, top/bottom). Radyal yüzeyler
// (faceSide, faceOuter, faceInner) henüz desteklenmez — sadece axial.
function veFEAApplyLocalSizing(mesh, localSizing) {
  if (!mesh || mesh.error || !mesh.namedSelections) return mesh;
  if (!localSizing || !localSizing.selection) return mesh;

  var name = localSizing.selection;
  var axis = -1, towardMax = false;
  if (name === 'faceXMin') { axis = 0; towardMax = false; }
  else if (name === 'faceXMax') { axis = 0; towardMax = true; }
  else if (name === 'faceYMin' || name === 'faceBottom') { axis = 1; towardMax = false; }
  else if (name === 'faceYMax' || name === 'faceTop')    { axis = 1; towardMax = true; }
  else if (name === 'faceZMin') { axis = 2; towardMax = false; }
  else if (name === 'faceZMax') { axis = 2; towardMax = true; }
  else return mesh;

  var mode = localSizing.biasMode || 'power';
  if (mode === 'inflation') return _veFEAApplyInflation(mesh, localSizing, axis, towardMax);
  return _veFEAApplyPowerBias(mesh, localSizing, axis, towardMax);
}

function _veFEAApplyPowerBias(mesh, ls, axis, towardMax) {
  var strength = Number(ls.biasStrength);
  if (!isFinite(strength) || strength <= 0) return mesh;
  if (strength > 1) strength = 1;

  var nodes = mesh.nodes;
  var n = nodes.length / 3;
  var minVal = Infinity, maxVal = -Infinity;
  for (var i = 0; i < n; i++) {
    var v = nodes[i * 3 + axis];
    if (v < minVal) minVal = v;
    if (v > maxVal) maxVal = v;
  }
  var range = maxVal - minVal;
  if (range <= 0) return mesh;
  var p = 1 + strength * 3;

  var newNodes = new Float32Array(nodes);
  for (var ii = 0; ii < n; ii++) {
    var orig = newNodes[ii * 3 + axis];
    var t = (orig - minVal) / range;
    var tNew;
    if (!towardMax) tNew = Math.pow(t, p);
    else            tNew = 1 - Math.pow(1 - t, p);
    newNodes[ii * 3 + axis] = minVal + tNew * range;
  }
  return Object.assign({}, mesh, { nodes: newNodes, localSizingApplied: ls });
}

// Inflation: first × growth^i kalınlığında k katman, kalan kısım uniform
function _veFEAApplyInflation(mesh, ls, axis, towardMax) {
  var firstLayer = Number(ls.firstLayerThickness);
  var growth = Number(ls.growthRate);
  var nLayers = parseInt(ls.layerCount, 10);
  if (!isFinite(firstLayer) || firstLayer <= 0) return mesh;
  if (!isFinite(growth) || growth <= 0) growth = 1.2;
  if (growth > 5) growth = 5;
  if (!isFinite(nLayers) || nLayers < 1) return mesh;
  if (nLayers > 50) nLayers = 50;

  var nodes = mesh.nodes;
  var n = nodes.length / 3;
  var minVal = Infinity, maxVal = -Infinity;
  for (var i = 0; i < n; i++) {
    var v = nodes[i * 3 + axis];
    if (v < minVal) minVal = v;
    if (v > maxVal) maxVal = v;
  }
  var L = maxVal - minVal;
  if (L <= 0) return mesh;

  // Eksenel düğüm sayısı (eşsiz pozisyonlar)
  var posSet = {};
  for (var ii = 0; ii < n; ii++) posSet[nodes[ii * 3 + axis].toFixed(6)] = true;
  var sortedPos = Object.keys(posSet).map(Number).sort(function(a, b) { return a - b; });
  var nAxis = sortedPos.length - 1; // interval sayısı
  if (nAxis < 1) return mesh;

  if (nLayers > nAxis) nLayers = nAxis;

  // Inflation toplam kalınlığı
  var inflTotal;
  if (Math.abs(growth - 1) < 1e-6) inflTotal = firstLayer * nLayers;
  else inflTotal = firstLayer * (Math.pow(growth, nLayers) - 1) / (growth - 1);
  // Eksen boyunu aşıyorsa scale
  if (inflTotal >= L * 0.95) {
    var scale = (L * 0.95) / inflTotal;
    firstLayer *= scale;
    inflTotal *= scale;
  }
  var remaining = L - inflTotal;
  var uniformN = nAxis - nLayers;
  var uniformStep = uniformN > 0 ? (remaining / uniformN) : 0;

  // Yeni eksen pozisyonları (boundary'den başlayarak)
  var newRel = new Array(sortedPos.length);
  newRel[0] = 0;
  var cur = 0;
  for (var li = 0; li < nLayers; li++) {
    cur += firstLayer * Math.pow(growth, li);
    newRel[li + 1] = cur;
  }
  for (var lj = 0; lj < uniformN; lj++) {
    cur += uniformStep;
    newRel[nLayers + lj + 1] = cur;
  }

  // Eşle: sortedPos[k] (orijinal) → newRel[k] (yeni, boundary'den uzaklık)
  var origToNew = {};
  for (var k = 0; k < sortedPos.length; k++) {
    var newPos = towardMax ? (maxVal - newRel[k]) : (minVal + newRel[k]);
    origToNew[sortedPos[k].toFixed(6)] = newPos;
  }

  var newNodes = new Float32Array(nodes);
  for (var nn = 0; nn < n; nn++) {
    var ok = newNodes[nn * 3 + axis].toFixed(6);
    var nv = origToNew[ok];
    if (nv !== undefined) newNodes[nn * 3 + axis] = nv;
  }
  return Object.assign({}, mesh, { nodes: newNodes, localSizingApplied: ls });
}

// Async wrapper — STEP gibi parse'i Promise tabanlı geometriler için.
// Senkron yol başarısızsa STEP'i OCCT üzerinden async parse eder.
//
// Mesh stratejisi (STEP karmaşık geometriler için):
//   1. Primitif inference (sync, sade şekiller için)
//   2. Pure JS Delaunay tet mesher (Mikola Lysenko, MIT) — opts.useTetMesher
//   3. Voxel + boundary snap (her zaman çalışan fallback)
function veFEAMeshFromGeometryAsync(geometry, opts) {
  if (!geometry) return Promise.resolve(null);
  opts = opts || {};
  // Önce sync yolu dene (primitif inference + cached parsed voxel)
  var sync = veFEAMeshFromGeometry(geometry, opts);
  if (sync) {
    // Tet mesher aktifse ve sync sonuç voxel ise: Delaunay ile yeniden mesh dene
    if (_veFEAShouldTryTetMesher(opts) && sync.voxelMode === true && geometry.type === 'step') {
      var parsedCached = _veFEAParseSurfaceTriangles(geometry);
      if (parsedCached) {
        return _veFEAMeshWithTetMesherOrVoxel(parsedCached, geometry, opts, sync);
      }
    }
    return Promise.resolve(sync);
  }

  // STEP için async parse
  if (geometry.type === 'step' && geometry.rawDataB64 &&
      typeof veFEABase64ToArrayBuffer === 'function' &&
      typeof veFEAParseSTEPBuffer === 'function' &&
      typeof veFEAStepMeshesToParsed === 'function') {
    var buf = veFEABase64ToArrayBuffer(geometry.rawDataB64);
    return veFEAParseSTEPBuffer(buf).then(function(result) {
      var parsed = veFEAStepMeshesToParsed(result);
      if (!parsed || parsed.triangleCount === 0) return null;
      if ((opts.mode || 'auto') === 'surface') {
        return _veFEAMeshFromParsedTriangles(parsed, 'step');
      }
      return _veFEAMeshWithTetMesherOrVoxel(parsed, geometry, opts, null);
    });
  }
  return Promise.resolve(null);
}

// Tet mesher denenebilir mi? (opts ve runtime kontrolü)
function _veFEAShouldTryTetMesher(opts) {
  if (!opts) opts = {};
  if (opts.useTetMesher === false) return false;
  if (opts.disableTetMesher === true) return false;
  if (typeof veFEADelaunayTetrahedralize !== 'function') return false;
  if (typeof veFEADelaunayAvailable === 'function' && !veFEADelaunayAvailable()) {
    return false;
  }
  return true;
}

// STEP/triangle soup için iki kademeli mesh stratejisi: önce Delaunay tet
// mesher denenir, başarısız/devre-dışı olursa voxel hex fallback. Üretilen
// mesh tek bir element tipidir (tet4 veya hex8) — "hybrid" değildir.
// `preBuiltVoxel` opsiyonel: sync yol voxel'ı zaten post-process'lemişse
// hazır kullanılır.
function _veFEAMeshWithTetMesherOrVoxel(parsed, geometry, opts, preBuiltVoxel) {
  var size = Math.max(VE_FEA_MESH_MIN_SIZE, Number(opts.size) || 10);
  var geometryType = geometry.type || 'unknown';

  function applyPostProcessing(mesh) {
    if (!mesh || mesh.error) return mesh;
    var elementType = opts.elementType || 'auto';
    if (opts.localSizing && opts.localSizing.selection &&
        opts.localSizing.selection !== 'none' && _veFEALocalSizingActive(opts.localSizing)) {
      mesh = veFEAApplyLocalSizing(mesh, opts.localSizing);
    }
    if (elementType === 'tet4' && mesh.type === 'hex8') {
      mesh = veFEAConvertMeshToTet4(mesh);
    }
    if (opts.midSideNodes === true) {
      mesh = veFEAEnrichToQuadratic(mesh);
    }
    return mesh;
  }

  function buildVoxelFallback() {
    if (preBuiltVoxel) return preBuiltVoxel;
    var elementType = opts.elementType || 'auto';
    var hexMesh = _veFEAVoxelizeTrianglesToHex(parsed, size, geometryType,
      geometry.detectedFeatures || null);
    if (hexMesh && !hexMesh.error && geometry.detectedFeatures && geometry.detectedFeatures.summary) {
      hexMesh.detectedFeatureSummary = geometry.detectedFeatures.summary;
    }
    if (hexMesh && !hexMesh.error && hexMesh.voxelMode && opts.disableBoundarySnap !== true) {
      if (elementType !== 'hex8' && elementType !== 'pyramid5') {
        var tetMesh = veFEAConvertMeshToTet4(hexMesh);
        if (tetMesh && !tetMesh.error) {
          hexMesh = tetMesh;
          if (typeof _veFEABoundarySnapToTriangles === 'function') {
            var snapped = _veFEABoundarySnapToTriangles(hexMesh, parsed);
            if (snapped && !snapped.error) hexMesh = snapped;
          }
          opts = Object.assign({}, opts, { elementType: 'tet4-done' });
        }
      }
    }
    return applyPostProcessing(hexMesh);
  }

  if (!_veFEAShouldTryTetMesher(opts)) {
    return Promise.resolve(buildVoxelFallback());
  }

  // Delaunay tet mesher denemesi
  var delaunayOpts = {
    targetSize: size,
    addSurfacePoints: opts.delaunayAddSurfacePoints !== false,
    addInteriorPoints: opts.delaunayAddInteriorPoints !== false,
    onProgress: opts.onProgress,
    verbose: opts.verbose === true
  };
  return veFEADelaunayTetrahedralize(parsed, delaunayOpts).then(function(tetResult) {
    if (!tetResult || tetResult.error) {
      if (opts.verbose) console.warn('[Delaunay] başarısız, voxel fallback:', tetResult && tetResult.error);
      return buildVoxelFallback();
    }
    var tetMesh = _veFEAWrapDelaunayResult(tetResult, geometry);
    return applyPostProcessing(tetMesh);
  }).catch(function(err) {
    if (opts.verbose) console.warn('[Delaunay] exception, voxel fallback:', err);
    return buildVoxelFallback();
  });
}

// Delaunay sonucunu MFSim mesh formatına sarmak: bbox + namedSelections + meta
function _veFEAWrapDelaunayResult(tetResult, geometry) {
  var nodes = tetResult.nodes;
  var elements = tetResult.elements;
  var minX = Infinity, minY = Infinity, minZ = Infinity;
  var maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
  for (var i = 0; i < nodes.length; i += 3) {
    var x = nodes[i], y = nodes[i + 1], z = nodes[i + 2];
    if (x < minX) minX = x; if (x > maxX) maxX = x;
    if (y < minY) minY = y; if (y > maxY) maxY = y;
    if (z < minZ) minZ = z; if (z > maxZ) maxZ = z;
  }
  var bbox = { minX: minX, maxX: maxX, minY: minY, maxY: maxY, minZ: minZ, maxZ: maxZ };
  var sel = _veFEATetMeshNamedSelections(nodes, elements, bbox);
  var mesh = {
    type: 'tet4',
    geometryType: 'delaunay-' + (geometry.type || 'unknown'),
    nodes: nodes,
    elements: elements,
    nodesPerElement: 4,
    namedSelections: sel,
    delaunayInfo: tetResult.info || null
  };
  if (geometry.detectedFeatures && geometry.detectedFeatures.summary) {
    mesh.detectedFeatureSummary = geometry.detectedFeatures.summary;
  }
  return mesh;
}

// Tet4 mesh için yüzey düğümleri (face-hash, kanonik): her face'i 4 tet
// içinden çıkar; tek seferlik görünenler yüzey face'leri. Voxel versiyonundan
// daha doğru — voxel'in degree-based hard-coded `< 8` heuristik'i tet'lerde
// güvenilir değil.
function _veFEATetMeshNamedSelections(nodes, elements, bbox) {
  var nodeCount = nodes.length / 3;
  var tetCount = elements.length / 4;
  var faceCount = new Map();
  // Tet (v0,v1,v2,v3) face'leri: (012),(013),(023),(123) — yönelime bakmaksızın
  // sıralı triple key kullanıyoruz (kanonik). 4 face × N tet, Map içinde count.
  var FACE_IDX = [[0,1,2],[0,1,3],[0,2,3],[1,2,3]];
  for (var t = 0; t < tetCount; t++) {
    var off = t * 4;
    for (var f = 0; f < 4; f++) {
      var fi = FACE_IDX[f];
      var a = elements[off + fi[0]];
      var b = elements[off + fi[1]];
      var c = elements[off + fi[2]];
      // 3 sayıyı sırala (sade insertion sort)
      var s0, s1, s2;
      if (a < b) { s0 = a; s1 = b; } else { s0 = b; s1 = a; }
      if (c < s0) { s2 = s1; s1 = s0; s0 = c; }
      else if (c < s1) { s2 = s1; s1 = c; }
      else { s2 = c; }
      var key = s0 + '|' + s1 + '|' + s2;
      faceCount.set(key, (faceCount.get(key) || 0) + 1);
    }
  }
  var surfMark = new Uint8Array(nodeCount);
  faceCount.forEach(function(v, k) {
    if (v !== 1) return;  // İç face: 2 tet paylaşır
    var parts = k.split('|');
    surfMark[parts[0] | 0] = 1;
    surfMark[parts[1] | 0] = 1;
    surfMark[parts[2] | 0] = 1;
  });
  var surfaceIds = [];
  for (var n = 0; n < nodeCount; n++) {
    if (surfMark[n]) surfaceIds.push(n);
  }
  var sel = {
    faceSurface: {
      type: 'face', source: 'auto', label: 'Tüm Yüzey',
      nodeIds: new Uint32Array(surfaceIds)
    }
  };
  if (bbox) {
    var dia = Math.max(bbox.maxX - bbox.minX, bbox.maxY - bbox.minY, bbox.maxZ - bbox.minZ);
    var eps = Math.max(1e-3, dia * 1e-4);
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
function _veFEAMeshCylinder(p, size, curvOpts, extraOpts) {
  var r  = Math.max(0.1, p.radius || 15);
  var h  = Math.max(0.1, p.height || 60);
  var nC = Math.max(8, Math.round(2 * Math.PI * r / size));
  var nR = Math.max(2, Math.round(r / size));
  var nA = Math.max(1, Math.round(h / size));
  // Curvature refinement: max yüz açısı θ → nC ≥ 360/θ
  if (curvOpts && curvOpts.enabled) {
    var angDeg = Math.max(1, Math.min(90, Number(curvOpts.normalAngleDeg) || 18));
    var nCByCurv = Math.ceil(360 / angDeg);
    if (nCByCurv > nC) nC = nCByCurv;
  }
  // ─── Akilli mesh stratejisi: dairesel kesit → O-grid Hex8 (default) ──
  // Wedge6 fan'i sadece kullanici acikca isterse (extraOpts.crossSection==='wedge')
  // Aksi takdirde merkezde dejenere hucreler olusturmayan butterfly topoloji.
  var useWedgeFan = !!(extraOpts && extraOpts.crossSection === 'wedge');
  if (!useWedgeFan) {
    nC = Math.max(8, Math.round(nC / 4) * 4);  // 4'ün katı zorunlu
    var nRArc = Math.max(1, nR);
    var nSquare = nC / 4;
    return _veFEAMeshCylinderOgrid(r, h, nC, nSquare, nRArc, nA);
  }
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
    sweepAxis: 'Y',
    namedSelections: _veFEACylinderNamedSelections(nR, nC, nA)
  };
}

// ─── O-grid (Butterfly) Hex8 disk → axial extrude ──────────────────────────
// ANSYS ICEM CFD altın standardı dairesel kesit için: merkezde küçük kare
// blok + etrafında 4 yay × radial layers. Tüm elementler Hex8, pole
// singularity yok, dairesel yüzeylere %3-5 daha doğru yakınsama.
//
// Topology (2D disk):
//   ┌─────────────────┐
//   │      arc N      │
//   ├──┐         ┌────┤
//   │ a│  inner  │ a  │
//   │ r│  square │ r  │
//   │ c│ nSq×nSq │ c  │
//   │ W│         │ E  │
//   ├──┘         └────┤
//   │      arc S      │
//   └─────────────────┘
// Inner square: a = r * 0.45 (innerFactor) — half-side
// Each arc: nSquare angular × nR radial Hex (deformed: outer = circle)
function _veFEABuildOgridDisk2D(r, nSquare, nR, innerFactor) {
  if (!innerFactor) innerFactor = 0.45;
  var a = r * innerFactor;
  var nodes2D = [];
  var nodeMap = {};
  function getNode(x, z) {
    var key = x.toFixed(6) + '|' + z.toFixed(6);
    if (key in nodeMap) return nodeMap[key];
    var idx = nodes2D.length;
    nodes2D.push([x, z]);
    nodeMap[key] = idx;
    return idx;
  }
  var quads = []; // [a,b,c,d] CCW

  // Inner square: nSquare × nSquare quads (uniform grid)
  // Quad order CW in xz plane (from +Y view) — Y-axial Hex8 extrude için
  // Jacobian pozitif. Bu (1-0)×(3-0) = +Y normal verir → apex (top) yönünde.
  for (var j = 0; j < nSquare; j++) {
    for (var i = 0; i < nSquare; i++) {
      var x0 = -a + 2 * a * i / nSquare;
      var x1 = -a + 2 * a * (i + 1) / nSquare;
      var z0 = -a + 2 * a * j / nSquare;
      var z1 = -a + 2 * a * (j + 1) / nSquare;
      var n0 = getNode(x0, z0);
      var n1 = getNode(x1, z0);
      var n2 = getNode(x1, z1);
      var n3 = getNode(x0, z1);
      quads.push([n0, n3, n2, n1]);  // n1↔n3 swap (CCW xz → CW xz)
    }
  }

  // 4 outer arcs — her biri (nSquare angular) × nR radial cells
  // Inner edge: square'in ilgili kenarı
  // Outer edge: çember yayı
  // Arc convention: corner (a,a), (-a,a), (-a,-a), (a,-a) inner square'in 4 köşesi
  var arcs = [
    // East (+X tarafı): θ ∈ [-π/4, π/4]
    { ix0:  a, iz0: -a, ix1:  a, iz1:  a, t0: -Math.PI / 4, t1:  Math.PI / 4 },
    // North (+Z tarafı): θ ∈ [π/4, 3π/4]
    { ix0:  a, iz0:  a, ix1: -a, iz1:  a, t0:  Math.PI / 4, t1: 3 * Math.PI / 4 },
    // West (-X tarafı): θ ∈ [3π/4, 5π/4]
    { ix0: -a, iz0:  a, ix1: -a, iz1: -a, t0: 3 * Math.PI / 4, t1: 5 * Math.PI / 4 },
    // South (-Z tarafı): θ ∈ [5π/4, 7π/4]
    { ix0: -a, iz0: -a, ix1:  a, iz1: -a, t0: 5 * Math.PI / 4, t1: 7 * Math.PI / 4 }
  ];
  function _arcPos(arc, rad, ang, nR_, nSq_) {
    var s = ang / nSq_;          // 0 = arc start, 1 = arc end
    var t = rad / nR_;           // 0 = inner edge, 1 = outer arc
    var ix = arc.ix0 + s * (arc.ix1 - arc.ix0);
    var iz = arc.iz0 + s * (arc.iz1 - arc.iz0);
    var theta = arc.t0 + s * (arc.t1 - arc.t0);
    var ox = r * Math.cos(theta);
    var oz = r * Math.sin(theta);
    return [ix + t * (ox - ix), iz + t * (oz - iz)];
  }
  arcs.forEach(function(arc) {
    // Önce tüm node'ları kaydet (dedup şared edges)
    for (var rad = 0; rad <= nR; rad++) {
      for (var ang = 0; ang <= nSquare; ang++) {
        var p = _arcPos(arc, rad, ang, nR, nSquare);
        getNode(p[0], p[1]);
      }
    }
    // Quads — arc cell vertex layout doğal olarak CW xz plane'de (radial outward
    // ve circumferential combine olduğunda). Y-axial extrude için Jacobian +.
    // Order: inner_low → inner_high → outer_high → outer_low.
    for (var rad2 = 0; rad2 < nR; rad2++) {
      for (var ang2 = 0; ang2 < nSquare; ang2++) {
        var pIL = _arcPos(arc, rad2,     ang2,     nR, nSquare); // inner low (rad=0, ang=0)
        var pIH = _arcPos(arc, rad2,     ang2 + 1, nR, nSquare); // inner high (rad=0, ang=1)
        var pOH = _arcPos(arc, rad2 + 1, ang2 + 1, nR, nSquare); // outer high (rad=1, ang=1)
        var pOL = _arcPos(arc, rad2 + 1, ang2,     nR, nSquare); // outer low (rad=1, ang=0)
        quads.push([
          getNode(pIL[0], pIL[1]),
          getNode(pIH[0], pIH[1]),
          getNode(pOH[0], pOH[1]),
          getNode(pOL[0], pOL[1])
        ]);
      }
    }
  });
  return { nodes2D: nodes2D, quads: quads };
}

// O-grid disk × eksenel extrude → Hex8 mesh
function _veFEAMeshCylinderOgrid(r, h, nC, nSquare, nR, nA) {
  var disk = _veFEABuildOgridDisk2D(r, nSquare, nR);
  var n2 = disk.nodes2D.length;
  var nQuads = disk.quads.length;
  var halfH = h / 2;

  // Düğümler: 2D nodes × (nA+1) axial layers
  var nodes = new Float32Array(n2 * (nA + 1) * 3);
  for (var k = 0; k <= nA; k++) {
    var y = -halfH + h * k / nA;
    for (var i = 0; i < n2; i++) {
      var off = (k * n2 + i) * 3;
      nodes[off]     = disk.nodes2D[i][0];
      nodes[off + 1] = y;
      nodes[off + 2] = disk.nodes2D[i][1];
    }
  }

  // Hex8 elementler: nQuads × nA
  var elements = new Uint32Array(nQuads * nA * 8);
  var ep = 0;
  for (var k2 = 0; k2 < nA; k2++) {
    var bOff = k2 * n2;
    var tOff = (k2 + 1) * n2;
    for (var q = 0; q < nQuads; q++) {
      var qd = disk.quads[q];
      // Hex8 düğüm sırası (alt CCW + üst CCW, box mesher ile aynı convention)
      elements[ep++] = bOff + qd[0];
      elements[ep++] = bOff + qd[1];
      elements[ep++] = bOff + qd[2];
      elements[ep++] = bOff + qd[3];
      elements[ep++] = tOff + qd[0];
      elements[ep++] = tOff + qd[1];
      elements[ep++] = tOff + qd[2];
      elements[ep++] = tOff + qd[3];
    }
  }

  return {
    type: 'hex8',
    geometryType: 'cylinder',
    nodes: nodes,
    elements: elements,
    nodesPerElement: 8,
    grid: { nNodes2D: n2, nQuads: nQuads, nCircum: nC, nRadial: nR, nAxial: nA, ogrid: true },
    sweepAxis: 'Y',
    namedSelections: _veFEAOgridCylinderNamedSelections(disk, n2, nA, r)
  };
}

// O-grid silindir için named selections (alt/üst/yan)
function _veFEAOgridCylinderNamedSelections(disk, n2, nA, r) {
  // Bottom (k=0) ve Top (k=nA): tüm 2D düğümler
  var bottom = new Uint32Array(n2);
  var top = new Uint32Array(n2);
  for (var i = 0; i < n2; i++) {
    bottom[i] = i;
    top[i] = nA * n2 + i;
  }
  // Side: 2D'de outer circle üzerindeki düğümler × tüm axial layer
  var sideIds = [];
  var eps = r * 1e-4;
  for (var ii = 0; ii < n2; ii++) {
    var x = disk.nodes2D[ii][0], z = disk.nodes2D[ii][1];
    if (Math.abs(Math.sqrt(x * x + z * z) - r) < eps) {
      for (var k = 0; k <= nA; k++) sideIds.push(k * n2 + ii);
    }
  }
  return {
    faceBottom: { type: 'face', source: 'auto', label: 'Alt Disk (Y−)',         nodeIds: bottom },
    faceTop:    { type: 'face', source: 'auto', label: 'Üst Disk (Y+)',         nodeIds: top },
    faceSide:   { type: 'face', source: 'auto', label: 'Yan Yüzey (Radyal)',    nodeIds: new Uint32Array(sideIds) }
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
function _veFEAMeshShaft(p, size, curvOpts) {
  var rOut = Math.max(0.5, p.outerRadius || 20);
  var rIn  = Math.max(0,   p.innerRadius || 8);
  if (rIn >= rOut) rIn = Math.max(0, rOut - 1);
  var L    = Math.max(0.1, p.length || 120);
  var nC = Math.max(8, Math.round(2 * Math.PI * rOut / size));
  var nR = Math.max(1, Math.round((rOut - rIn) / size));
  var nA = Math.max(1, Math.round(L / size));
  // Curvature refinement: dış+iç yüzeyler için
  if (curvOpts && curvOpts.enabled) {
    var angDeg = Math.max(1, Math.min(90, Number(curvOpts.normalAngleDeg) || 18));
    var nCByCurv = Math.ceil(360 / angDeg);
    if (nCByCurv > nC) nC = nCByCurv;
  }

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
    sweepAxis: 'Y',
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

// ─── Rectangular tube (içi boş kutu) → Heks8 ─────────────────────────────
// Sweep meshing örneği: 2D dikdörtgen halka (dış − iç) × eksenel Z extrude.
// 4 kenar (alt, sağ, üst, sol) hex8 slab olarak ayrı ayrı meshlenir, ortak
// köşelerde nodeId paylaşılır (dedup'lı). Tipik kullanım: kutu profili,
// kanal, dikdörtgen tüp (chassis frame).
function _veFEAMeshRectTube(p, size) {
  var w = Math.max(1, p.width || 60);
  var h = Math.max(1, p.height || 40);
  var t = Math.max(0.2, p.thickness || 4);
  var L = Math.max(1, p.length || 200);
  var maxT = Math.min(w, h) / 2 - 0.1;
  if (t >= maxT) t = Math.max(0.2, maxT);

  var nT = Math.max(1, Math.round(t / size));     // cidar boyunca
  var nW = Math.max(1, Math.round(w / size));     // dış genişlik boyunca
  var nH = Math.max(1, Math.round(h / size));     // dış yükseklik boyunca
  var nZ = Math.max(1, Math.round(L / size));     // sweep yönü
  // Dış-iç ayrımı için cidar ile birlikte tüm w/h boyunca uniform grid
  // mantıklı; sonra "iç dikdörtgen içinde kalan" hücreleri çıkar.
  var dx = w / nW, dy = h / nH, dz = L / nZ;
  var x0 = -w / 2, y0 = -h / 2, z0 = -L / 2;

  // Node grid: (nW+1) × (nH+1) × (nZ+1) potansiyel; sadece kullanılanlar
  var pitchY = nW + 1;
  var pitchZ = (nW + 1) * (nH + 1);
  var nodeMap = new Int32Array((nW + 1) * (nH + 1) * (nZ + 1));
  for (var im = 0; im < nodeMap.length; im++) nodeMap[im] = -1;
  var nodeList = [];
  function getNode(i, j, k) {
    var idx = i + j * pitchY + k * pitchZ;
    var ex = nodeMap[idx];
    if (ex >= 0) return ex;
    var newIdx = nodeList.length / 3;
    nodeList.push(x0 + i * dx, y0 + j * dy, z0 + k * dz);
    nodeMap[idx] = newIdx;
    return newIdx;
  }

  // İç bölge: |x - 0| < (w/2 - t) AND |y - 0| < (h/2 - t)
  // Yani x ∈ (-w/2+t, w/2-t), y ∈ (-h/2+t, h/2-t)
  // Hücre dışarıda kalıyorsa eklenir, içte boş.
  var iw2 = w / 2 - t, ih2 = h / 2 - t;
  var elements = [];
  for (var k = 0; k < nZ; k++) {
    for (var j = 0; j < nH; j++) {
      for (var i = 0; i < nW; i++) {
        // Hücre merkezi
        var cx = x0 + (i + 0.5) * dx;
        var cy = y0 + (j + 0.5) * dy;
        // İç dikdörtgen içindeyse atla
        if (Math.abs(cx) < iw2 && Math.abs(cy) < ih2) continue;
        var n0 = getNode(i,     j,     k);
        var n1 = getNode(i + 1, j,     k);
        var n2 = getNode(i + 1, j + 1, k);
        var n3 = getNode(i,     j + 1, k);
        var n4 = getNode(i,     j,     k + 1);
        var n5 = getNode(i + 1, j,     k + 1);
        var n6 = getNode(i + 1, j + 1, k + 1);
        var n7 = getNode(i,     j + 1, k + 1);
        elements.push(n0, n1, n2, n3, n4, n5, n6, n7);
      }
    }
  }

  if (elements.length === 0) return null;

  var nodes = new Float32Array(nodeList);
  var elementsTA = new Uint32Array(elements);

  // Named selections — bbox yön bazlı (voxel mesh ile aynı yaklaşım)
  return {
    type: 'hex8',
    geometryType: 'rectTube',
    nodes: nodes,
    elements: elementsTA,
    nodesPerElement: 8,
    grid: { nW: nW, nH: nH, nZ: nZ, nT: nT, voxelCount: elementsTA.length / 8 },
    sweepAxis: 'Z',
    namedSelections: _veFEAVoxelMeshNamedSelections(nodes, elementsTA, 8, {
      minX: x0, maxX: x0 + w, minY: y0, maxY: y0 + h, minZ: z0, maxZ: z0 + L
    })
  };
}

// ─── L-Profil (köşe kirişi) → Hex8 cell-exclusion ─────────────────────────
// W x H bbox alındı, t kalınlığı kadar yatay (Y<t) ve dikey (X<t) iki kol.
// Yerel koordinat: köşe (0,0,0), pozitif X yatay kol boyunca, pozitif Y dikey
// kol boyunca, Z sweep ekseni. Merkezleme bbox ortasına yapılır.
// "İç boşluk" predikatı: cx > t AND cy > t (her iki koldan da uzak)
function _veFEAMeshLBracket(p, size) {
  var w = Math.max(1, p.width || 60);
  var h = Math.max(1, p.height || 40);
  var t = Math.max(0.5, p.thickness || 5);
  var L = Math.max(1, p.length || 100);
  var maxT = Math.min(w, h) - 0.1;
  if (t >= maxT) t = Math.max(0.5, maxT);

  // Mesh size feature size'dan büyükse (t < size) thickness yönünde en az 1 hücre garantile.
  // En geniş ortak hücre kenarı: min(size, t).
  var cell = Math.min(size, t);
  var nW = Math.max(1, Math.round(w / cell));
  var nH = Math.max(1, Math.round(h / cell));
  var nZ = Math.max(1, Math.round(L / size));
  var dx = w / nW, dy = h / nH, dz = L / nZ;
  var x0 = -w / 2, y0 = -h / 2, z0 = -L / 2;

  var pitchY = nW + 1;
  var pitchZ = (nW + 1) * (nH + 1);
  var nodeMap = new Int32Array((nW + 1) * (nH + 1) * (nZ + 1));
  for (var im = 0; im < nodeMap.length; im++) nodeMap[im] = -1;
  var nodeList = [];
  function getNode(i, j, k) {
    var idx = i + j * pitchY + k * pitchZ;
    var ex = nodeMap[idx];
    if (ex >= 0) return ex;
    var newIdx = nodeList.length / 3;
    nodeList.push(x0 + i * dx, y0 + j * dy, z0 + k * dz);
    nodeMap[idx] = newIdx;
    return newIdx;
  }

  // L şekli: yatay kol (alt kısım, y ∈ [0, t]) + dikey kol (sol kısım, x ∈ [0, t])
  // Köşe (0,0,0)'da bbox'ın sol-alt köşesi olacak şekilde local frame:
  //   lx = cx - x0  (∈ [0, w])
  //   ly = cy - y0  (∈ [0, h])
  // Hücre içeride ise: lx < t  OR  ly < t  (dikey kol veya yatay kol)
  var elements = [];
  for (var k = 0; k < nZ; k++) {
    for (var j = 0; j < nH; j++) {
      for (var i = 0; i < nW; i++) {
        var lx = (i + 0.5) * dx;
        var ly = (j + 0.5) * dy;
        if (!(lx < t || ly < t)) continue;
        var n0 = getNode(i,     j,     k);
        var n1 = getNode(i + 1, j,     k);
        var n2 = getNode(i + 1, j + 1, k);
        var n3 = getNode(i,     j + 1, k);
        var n4 = getNode(i,     j,     k + 1);
        var n5 = getNode(i + 1, j,     k + 1);
        var n6 = getNode(i + 1, j + 1, k + 1);
        var n7 = getNode(i,     j + 1, k + 1);
        elements.push(n0, n1, n2, n3, n4, n5, n6, n7);
      }
    }
  }

  if (elements.length === 0) return null;

  var nodes = new Float32Array(nodeList);
  var elementsTA = new Uint32Array(elements);

  return {
    type: 'hex8',
    geometryType: 'lbracket',
    nodes: nodes,
    elements: elementsTA,
    nodesPerElement: 8,
    grid: { nW: nW, nH: nH, nZ: nZ, voxelCount: elementsTA.length / 8 },
    sweepAxis: 'Z',
    namedSelections: _veFEAVoxelMeshNamedSelections(nodes, elementsTA, 8, {
      minX: x0, maxX: x0 + w, minY: y0, maxY: y0 + h, minZ: z0, maxZ: z0 + L
    })
  };
}

// ─── I-Profil (kiriş) → Hex8 cell-exclusion ───────────────────────────────
// W x H bbox; alt flanş (y ∈ [0, tf]), üst flanş (y ∈ [h-tf, h]), gövde
// (x ∈ [(w-tw)/2, (w+tw)/2]). "İçeride" predikatı:
//   ly < tf  OR  ly > h-tf  OR  (innerWL < lx < innerWR)
function _veFEAMeshIBeam(p, size) {
  var w = Math.max(1, p.width || 80);
  var h = Math.max(1, p.height || 120);
  var tf = Math.max(0.5, p.flange || 8);
  var tw = Math.max(0.5, p.web || 6);
  var L = Math.max(1, p.length || 200);
  if (tf >= h / 2 - 0.1) tf = Math.max(0.5, h / 2 - 0.1);
  if (tw >= w - 0.1)     tw = Math.max(0.5, w - 0.1);

  // Web (tw) ve flange (tf) feature size'larını çözmek için minimum cell boyutu.
  var cell = Math.min(size, Math.min(tf, tw));
  var nW = Math.max(1, Math.round(w / cell));
  var nH = Math.max(1, Math.round(h / cell));
  var nZ = Math.max(1, Math.round(L / size));
  var dx = w / nW, dy = h / nH, dz = L / nZ;
  var x0 = -w / 2, y0 = -h / 2, z0 = -L / 2;

  var pitchY = nW + 1;
  var pitchZ = (nW + 1) * (nH + 1);
  var nodeMap = new Int32Array((nW + 1) * (nH + 1) * (nZ + 1));
  for (var im = 0; im < nodeMap.length; im++) nodeMap[im] = -1;
  var nodeList = [];
  function getNode(i, j, k) {
    var idx = i + j * pitchY + k * pitchZ;
    var ex = nodeMap[idx];
    if (ex >= 0) return ex;
    var newIdx = nodeList.length / 3;
    nodeList.push(x0 + i * dx, y0 + j * dy, z0 + k * dz);
    nodeMap[idx] = newIdx;
    return newIdx;
  }

  var webL = (w - tw) / 2, webR = (w + tw) / 2;
  var elements = [];
  for (var k = 0; k < nZ; k++) {
    for (var j = 0; j < nH; j++) {
      for (var i = 0; i < nW; i++) {
        var lx = (i + 0.5) * dx;
        var ly = (j + 0.5) * dy;
        var inFlangeBot = ly < tf;
        var inFlangeTop = ly > h - tf;
        var inWeb       = (lx > webL && lx < webR);
        if (!(inFlangeBot || inFlangeTop || inWeb)) continue;
        var n0 = getNode(i,     j,     k);
        var n1 = getNode(i + 1, j,     k);
        var n2 = getNode(i + 1, j + 1, k);
        var n3 = getNode(i,     j + 1, k);
        var n4 = getNode(i,     j,     k + 1);
        var n5 = getNode(i + 1, j,     k + 1);
        var n6 = getNode(i + 1, j + 1, k + 1);
        var n7 = getNode(i,     j + 1, k + 1);
        elements.push(n0, n1, n2, n3, n4, n5, n6, n7);
      }
    }
  }

  if (elements.length === 0) return null;

  var nodes = new Float32Array(nodeList);
  var elementsTA = new Uint32Array(elements);

  return {
    type: 'hex8',
    geometryType: 'ibeam',
    nodes: nodes,
    elements: elementsTA,
    nodesPerElement: 8,
    grid: { nW: nW, nH: nH, nZ: nZ, voxelCount: elementsTA.length / 8 },
    sweepAxis: 'Z',
    namedSelections: _veFEAVoxelMeshNamedSelections(nodes, elementsTA, 8, {
      minX: x0, maxX: x0 + w, minY: y0, maxY: y0 + h, minZ: z0, maxZ: z0 + L
    })
  };
}

// ─── Küre → Cubed-Sphere Hex8 (single-block) ──────────────────────────────
// Tüm küreyi "deformed cube" olarak modelle. Her cube grid noktası radyal
// projeksiyon ile küreye taşınır:
//   sphere_pos = r * cube_max * unit_dir(cube_pos)
// Burada cube_max = max(|x|,|y|,|z|) (Chebyshev distance).
//   - Cube yüzeyi (cube_max=1) → küre yüzeyi (r * unit_dir)
//   - Cube merkezi (cube_max=0) → orijin
//   - İç noktalar: radyal mesafe r * cube_max
// Pole singularity yok, tüm Hex8, kabul edilebilir uniform kalite.
// Köşelerde aspect ratio yüksek (corners squeeze) ama yapısal analiz için OK.
function _veFEAMeshSphere(p, size) {
  var r = Math.max(0.5, p.radius || 25);
  // nC: cube grid çözünürlüğü. Sphere yüzey arc length = π·r/2 (her face),
  // size'a bölersek nC ≈ π·r / (2·size). Min 4 (yeterli kalite için).
  var nC = Math.max(4, Math.round(Math.PI * r / (2 * size)));

  var n1 = nC + 1;
  var nNodes = n1 * n1 * n1;
  var nodes = new Float32Array(nNodes * 3);
  for (var k = 0; k <= nC; k++) {
    var cz = -1 + 2 * k / nC;
    for (var j = 0; j <= nC; j++) {
      var cy = -1 + 2 * j / nC;
      for (var i = 0; i <= nC; i++) {
        var cx = -1 + 2 * i / nC;
        var idx = (k * n1 * n1 + j * n1 + i) * 3;
        var maxAbs = Math.max(Math.abs(cx), Math.abs(cy), Math.abs(cz));
        if (maxAbs < 1e-9) {
          // Center node: stay at origin
          nodes[idx] = nodes[idx + 1] = nodes[idx + 2] = 0;
        } else {
          var len = Math.sqrt(cx * cx + cy * cy + cz * cz);
          var ux = cx / len, uy = cy / len, uz = cz / len;
          var rad = r * maxAbs;
          nodes[idx]     = rad * ux;
          nodes[idx + 1] = rad * uy;
          nodes[idx + 2] = rad * uz;
        }
      }
    }
  }

  // Hex8 elements (box mesher convention ile aynı connectivity)
  var nElem = nC * nC * nC;
  var elements = new Uint32Array(nElem * 8);
  var pitchY = n1, pitchZ = n1 * n1;
  var e = 0;
  for (var k2 = 0; k2 < nC; k2++) {
    for (var j2 = 0; j2 < nC; j2++) {
      for (var i2 = 0; i2 < nC; i2++) {
        var n0 = i2 + j2 * pitchY + k2 * pitchZ;
        var off = e * 8; e++;
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
    geometryType: 'sphere',
    nodes: nodes,
    elements: elements,
    nodesPerElement: 8,
    grid: { nC: nC, cubedSphere: true },
    namedSelections: _veFEASphereNamedSelections(n1, nC)
  };
}

// ─── Yarım Küre → Hex8 (üst yarı cubed-sphere + alt düz disk koruma) ──────
// Cube grid x,z ∈ [-1,1], y ∈ [0,1]. j=0 (alt) düğümler düz disk'e projeksiyon
// (y=0 sabit, radyal scale). j>0 düğümler radyal cubed-sphere projeksiyonu.
function _veFEAMeshHemisphere(p, size) {
  var r = Math.max(0.5, p.radius || 25);
  var nC = Math.max(4, Math.round(Math.PI * r / (2 * size)));
  var n1 = nC + 1;
  var nNodes = n1 * n1 * n1;
  var nodes = new Float32Array(nNodes * 3);
  for (var k = 0; k <= nC; k++) {
    var cz = -1 + 2 * k / nC;
    for (var j = 0; j <= nC; j++) {
      var cy = j / nC;          // 0 = alt düz disk, 1 = üst (apex region)
      for (var i = 0; i <= nC; i++) {
        var cx = -1 + 2 * i / nC;
        var idx = (k * n1 * n1 + j * n1 + i) * 3;
        if (j === 0) {
          // Alt düz disk: y=0 sabit, xz radyal scale to disk of radius r
          var maxAbsXZ = Math.max(Math.abs(cx), Math.abs(cz));
          if (maxAbsXZ < 1e-9) {
            nodes[idx] = nodes[idx + 1] = nodes[idx + 2] = 0;
          } else {
            var lenXZ = Math.sqrt(cx * cx + cz * cz);
            var radXZ = r * maxAbsXZ;
            nodes[idx]     = radXZ * cx / lenXZ;
            nodes[idx + 1] = 0;
            nodes[idx + 2] = radXZ * cz / lenXZ;
          }
        } else {
          // Üst yarı: cubed-sphere radial projection
          var maxAbs = Math.max(Math.abs(cx), cy, Math.abs(cz));
          if (maxAbs < 1e-9) {
            nodes[idx] = nodes[idx + 1] = nodes[idx + 2] = 0;
          } else {
            var len = Math.sqrt(cx * cx + cy * cy + cz * cz);
            var rad = r * maxAbs;
            nodes[idx]     = rad * cx / len;
            nodes[idx + 1] = rad * cy / len;
            nodes[idx + 2] = rad * cz / len;
          }
        }
      }
    }
  }

  // Hex8 elements
  var nElem = nC * nC * nC;
  var elements = new Uint32Array(nElem * 8);
  var pitchY = n1, pitchZ = n1 * n1;
  var e = 0;
  for (var k2 = 0; k2 < nC; k2++) {
    for (var j2 = 0; j2 < nC; j2++) {
      for (var i2 = 0; i2 < nC; i2++) {
        var n0 = i2 + j2 * pitchY + k2 * pitchZ;
        var off = e * 8; e++;
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
    geometryType: 'hemisphere',
    nodes: nodes,
    elements: elements,
    nodesPerElement: 8,
    grid: { nC: nC, cubedSphere: true, hemisphere: true },
    namedSelections: _veFEAHemisphereNamedSelections(n1, nC)
  };
}

// ─── Torus → Wedge6 mesh (cross-section fan × toroidal sweep, closed loop) ─
// Disk kesidi cylinder mesher gibi: merkez + nR halka × nMinor angular.
// Toroidal direction: nMajor layer, last layer first ile bağlanır (closed).
function _veFEAMeshTorus(p, size) {
  var R = Math.max(1, p.majorRadius || 30);
  var r = Math.max(0.1, p.minorRadius || 10);
  var nMajor = Math.max(8, Math.round(2 * Math.PI * R / size));
  var nMinor = Math.max(8, Math.round(2 * Math.PI * r / size));
  var nRad   = Math.max(2, Math.round(r / size));
  // 4'un kati zorunlu (O-grid disk topolojisi icin)
  nMinor = Math.max(8, Math.round(nMinor / 4) * 4);
  var nSquare = nMinor / 4;

  // 2D O-grid disk (cross-section, local xz coords)
  var disk = _veFEABuildOgridDisk2D(r, nSquare, nRad);
  var nDisk = disk.nodes2D.length;
  var nQuads = disk.quads.length;

  // Her major angle icin disk'i toroidal centerline'a yerlestir.
  // Local disk: x = radial yatay (cross-section), z = vertical (y world)
  // Torus dunya koordinati: theta = major angle (XZ duzleminde)
  //   centerline(theta) = (R cos theta, 0, R sin theta)
  //   radial_world(theta) = (cos theta, 0, sin theta)
  //   y_world = (0, 1, 0)
  //   world = centerline + diskX·radial + diskZ·y_world
  var nodes = new Float32Array(nDisk * nMajor * 3);
  for (var k = 0; k < nMajor; k++) {
    var theta = 2 * Math.PI * k / nMajor;
    var cosT = Math.cos(theta), sinT = Math.sin(theta);
    var cxW = R * cosT, czW = R * sinT;
    var base = k * nDisk;
    for (var i = 0; i < nDisk; i++) {
      var lx = disk.nodes2D[i][0];  // local x (radial inward/outward)
      var lz = disk.nodes2D[i][1];  // local z (vertical, becomes y world)
      var off = (base + i) * 3;
      nodes[off]     = cxW + lx * cosT;
      nodes[off + 1] = lz;
      nodes[off + 2] = czW + lx * sinT;
    }
  }

  // Hex8 elements: her quad × her major-angle pair (closed loop)
  var elements = new Uint32Array(nQuads * nMajor * 8);
  var ep = 0;
  for (var ka = 0; ka < nMajor; ka++) {
    var bOff = ka * nDisk;
    var tOff = ((ka + 1) % nMajor) * nDisk;  // closed loop
    for (var q = 0; q < nQuads; q++) {
      var qd = disk.quads[q];
      elements[ep++] = bOff + qd[0];
      elements[ep++] = bOff + qd[1];
      elements[ep++] = bOff + qd[2];
      elements[ep++] = bOff + qd[3];
      elements[ep++] = tOff + qd[0];
      elements[ep++] = tOff + qd[1];
      elements[ep++] = tOff + qd[2];
      elements[ep++] = tOff + qd[3];
    }
  }

  return {
    type: 'hex8',
    geometryType: 'torus',
    nodes: nodes,
    elements: elements,
    nodesPerElement: 8,
    grid: { nMajor: nMajor, nMinor: nMinor, nRadial: nRad, ogrid: true, closed: true },
    namedSelections: _veFEAOgridTorusNamedSelections(disk, nDisk, nMajor, r)
  };
}

// Torus O-grid named selections — toroidal outer surface (disk outer circle nodes × all major layers)
function _veFEAOgridTorusNamedSelections(disk, nDisk, nMajor, r) {
  var surface = [];
  var eps = r * 1e-4;
  for (var i = 0; i < nDisk; i++) {
    var lx = disk.nodes2D[i][0], lz = disk.nodes2D[i][1];
    if (Math.abs(Math.sqrt(lx * lx + lz * lz) - r) < eps) {
      for (var k = 0; k < nMajor; k++) surface.push(k * nDisk + i);
    }
  }
  return {
    faceSurface: { type: 'face', source: 'auto', label: 'Toroidal Yüzey', nodeIds: new Uint32Array(surface) }
  };
}

// Yarım küre named selections: faceFlat (j=0 alt disk) + faceDome (üst kabuk)
function _veFEAHemisphereNamedSelections(n1, nC) {
  var pitchY = n1, pitchZ = n1 * n1;
  var flat = [];     // j=0 plane
  var dome = [];     // i,k=0/nC veya j=nC (üst yüzey)
  for (var k = 0; k <= nC; k++) {
    for (var j = 0; j <= nC; j++) {
      for (var i = 0; i <= nC; i++) {
        var nid = i + j * pitchY + k * pitchZ;
        var onSide = (i === 0 || i === nC || k === 0 || k === nC);
        var onTop  = (j === nC);
        var onBottom = (j === 0);
        if (onBottom) flat.push(nid);
        if (j > 0 && (onSide || onTop)) dome.push(nid);
      }
    }
  }
  return {
    faceFlat: { type: 'face', source: 'auto', label: 'Alt Düz Disk (Y−)',         nodeIds: new Uint32Array(flat) },
    faceDome: { type: 'face', source: 'auto', label: 'Yarı Küresel Yüzey (Dome)', nodeIds: new Uint32Array(dome) }
  };
}

// Küre için tek named selection: faceSurface (cube grid'in dış yüzü = küre yüzeyi)
function _veFEASphereNamedSelections(n1, nC) {
  var pitchY = n1, pitchZ = n1 * n1;
  var surface = [];
  for (var k = 0; k <= nC; k++) {
    for (var j = 0; j <= nC; j++) {
      for (var i = 0; i <= nC; i++) {
        if (i === 0 || i === nC || j === 0 || j === nC || k === 0 || k === nC) {
          surface.push(i + j * pitchY + k * pitchZ);
        }
      }
    }
  }
  return {
    faceSurface: { type: 'face', source: 'auto', label: 'Küresel Yüzey', nodeIds: new Uint32Array(surface) }
  };
}

// ─── Koni / Frustum → Hex8/Wedge6 (cylinder + radial scaling) ─────────────
// Cylinder mesh'in yeniden kullanımı: max yarıçap ile silindir oluştur, sonra
// her node'u y koordinatına göre yarıçap interpolasyonu uygula:
//   r(y) = rB + t·(rT − rB),  t = (y + h/2) / h ∈ [0,1]
//   scale = r(y) / rMax
// Topology aynı kalır (3 face: alt/üst disk + yan), sadece geometryType değişir.
// Apex case (rT=0): üst layer node'lar tek noktaya çakışır → degenerate hex.
// Solver problemi olmasın diye min effective top radius uygulanır (rMax/1000).
function _veFEAMeshCone(p, size, curvOpts, extraOpts) {
  var rB = Math.max(0.1, p.bottomRadius || 20);
  var rT = Math.max(0,   p.topRadius || 0);
  var h  = Math.max(0.1, p.height || 60);
  var rMax = Math.max(rB, rT);
  // Apex case: tam 0 yerine epsilon → degenerate hex önle
  var rTeff = Math.max(rT, 0.001 * rMax);

  // Cylinder mesh oluştur (max radius ile)
  var cylMesh = _veFEAMeshCylinder(
    { radius: rMax, height: h, segments: p.segments },
    size, curvOpts, extraOpts
  );
  if (!cylMesh) return null;

  // Her node için y koordinatına göre radial ölçekle
  var nodes = cylMesh.nodes;
  var nNodes = nodes.length / 3;
  var halfH = h / 2;
  var newNodes = new Float32Array(nodes);  // copy (cylMesh nodes shared olmasın)
  for (var i = 0; i < nNodes; i++) {
    var y = newNodes[i * 3 + 1];
    var t = (y + halfH) / h;             // 0 = alt, 1 = üst
    if (t < 0) t = 0; else if (t > 1) t = 1;
    var rAtY = rB + t * (rTeff - rB);
    var scale = (rMax > 1e-9) ? (rAtY / rMax) : 0;
    newNodes[i * 3]     *= scale;
    newNodes[i * 3 + 2] *= scale;
  }

  return {
    type: cylMesh.type,
    geometryType: 'cone',
    nodes: newNodes,
    elements: cylMesh.elements,
    nodesPerElement: cylMesh.nodesPerElement,
    grid: cylMesh.grid,
    sweepAxis: 'Y',
    namedSelections: cylMesh.namedSelections   // aynı id'ler: faceTop/Bottom/Side
  };
}

// ─── STEP → parsed triangles ──────────────────────────────────────────────
// STEP için sync parse yok — veFEAMeshFromGeometryAsync (OCCT WebAssembly)
// üzerinden async yolu kullanılır. Sync dispatcher bu yüzden null döner ve
// caller async wrapper'a fallback eder. (STL desteği kaldırıldı.)
//
// Test bypass: geometry._parsedTriangles (test-only) varsa onu döndür ki
// birim testler sync voxelizer üzerinden tam pipeline'ı çalıştırabilsin.
// ─── Generic primitif mesh — tip-spesifik mesher yoksa fallback ────────────
// Three.js mesh'inden triangulated surface çıkar → STEP voxel/boundary-snap
// path'i ile mesh'le. Yeni eklenen primitifler (washer, bolt, nut, plate)
// veya gelecek primitifler için tek nokta dispatch. Worker'da THREE yoksa
// null döner — main thread'de yeniden denenir.
function _veFEAMeshGenericPrimitive(geometry, size, mode, elementType, opts) {
  // 1) Triangulated surface çıkar
  var parsed = geometry._parsedTriangles ||
               _veFEAExtractTrianglesFromPrimitive(geometry.type, geometry.params || {});
  if (!parsed || parsed.triangleCount === 0) {
    if (typeof console !== 'undefined') {
      console.warn('[FEA Mesh] generic primitive triangulation failed:', geometry.type,
                   '(THREE.js gerekli — worker context?)');
    }
    return null;
  }

  // 2) Surface mode → Tri3
  if (mode === 'surface') {
    return _veFEAMeshFromParsedTriangles(parsed, geometry.type);
  }

  // 3) Volume mode → voxel hex8
  var mesh = _veFEAVoxelizeTrianglesToHex(parsed, size, geometry.type, null);
  if (!mesh || mesh.error) return mesh;

  // 4) Boundary snap + tet4 dönüşümü (kullanıcı elementType=hex8 demediyse)
  if (mesh.voxelMode && opts && opts.disableBoundarySnap !== true) {
    if (elementType !== 'hex8' && elementType !== 'pyramid5') {
      var tetMesh = (typeof veFEAConvertMeshToTet4 === 'function') ? veFEAConvertMeshToTet4(mesh) : null;
      if (tetMesh && !tetMesh.error) {
        mesh = tetMesh;
        if (typeof _veFEABoundarySnapToTriangles === 'function') {
          var snapped = _veFEABoundarySnapToTriangles(mesh, parsed);
          if (snapped && !snapped.error) mesh = snapped;
        }
      }
    }
  }
  return mesh;
}

// Three.js primitif mesh'inden triangulated surface çıkar.
// veFEABuildPrimitiveMesh ile mesh inşa et, tüm child mesh'lerden üçgenleri
// matrixWorld uygulayarak flat Float32Array'e topla.
function _veFEAExtractTrianglesFromPrimitive(type, params) {
  if (typeof THREE === 'undefined' || typeof veFEABuildPrimitiveMesh !== 'function') return null;
  var meshOrGroup;
  try {
    meshOrGroup = veFEABuildPrimitiveMesh(type, params);
  } catch (e) { return null; }
  if (!meshOrGroup) return null;
  // matrixWorld'leri günceller (Group içinde child transform varsa)
  meshOrGroup.updateMatrixWorld(true);

  var allVerts = [];
  meshOrGroup.traverse(function (o) {
    if (!o.isMesh || !o.geometry) return;
    var geo = o.geometry;
    var pos = geo.attributes.position;
    if (!pos) return;
    var idx = geo.index;
    var triCount = idx ? idx.count / 3 : pos.count / 3;
    var v1 = new THREE.Vector3(), v2 = new THREE.Vector3(), v3 = new THREE.Vector3();
    for (var i = 0; i < triCount; i++) {
      var a, b, c;
      if (idx) { a = idx.getX(i * 3); b = idx.getX(i * 3 + 1); c = idx.getX(i * 3 + 2); }
      else     { a = i * 3; b = i * 3 + 1; c = i * 3 + 2; }
      v1.fromBufferAttribute(pos, a);
      v2.fromBufferAttribute(pos, b);
      v3.fromBufferAttribute(pos, c);
      v1.applyMatrix4(o.matrixWorld);
      v2.applyMatrix4(o.matrixWorld);
      v3.applyMatrix4(o.matrixWorld);
      allVerts.push(v1.x, v1.y, v1.z, v2.x, v2.y, v2.z, v3.x, v3.y, v3.z);
    }
  });

  if (allVerts.length === 0) return null;
  return {
    vertices: new Float32Array(allVerts),
    triangleCount: allVerts.length / 9
  };
}

function _veFEAParseSurfaceTriangles(geom) {
  if (geom && geom._parsedTriangles && geom._parsedTriangles.triangleCount > 0) {
    return geom._parsedTriangles;
  }
  return null;
}

// ─── Voxel hacim mesh (Heks8) — STEP karmaşık geometriler için ────────────
// Algoritma: bbox içinde voxel grid, X-eksenli ray casting ile parite testi,
// içeride kalan voxel'leri Heks8 olarak (ortak köşeler dedup'lı).
// ANSYS'in "Cartesian mesh" yöntemine benzer. Karmaşık geometrilerde çalışır;
// yüzeyde staircase artifact görülür (gerçek tet mesher F3c+ için planlı).
// ─── Mesh node'larini canonical pozisyondan target orientation'a tasi ───
// Canonical: silindir/kure Y-axis hizali, merkez = origin
// Target: detected primitive'in axis ve center'i
// Rodrigues' rotation formulu: Y → target axis
function _veFEATransformMeshToOrientation(mesh, transform) {
  if (!mesh || !mesh.nodes || !transform) return;
  var center = transform.center || [0, 0, 0];
  var targetAxis = transform.axis || [0, 1, 0];
  // Y → target rotasyon matrisi (Rodrigues)
  var yx = 0, yy = 1, yz = 0;
  var tx = targetAxis[0], ty = targetAxis[1], tz = targetAxis[2];
  var tLen = Math.sqrt(tx*tx + ty*ty + tz*tz);
  if (tLen < 1e-12) return; // gecersiz target
  tx /= tLen; ty /= tLen; tz /= tLen;
  // Y ile target paralel mi? (anti-paralel veya ayni)
  var cosA = yx * tx + yy * ty + yz * tz; // = ty
  var R; // 3x3 row-major
  if (cosA > 0.9999) {
    // Ayni yon → birim matris
    R = [1,0,0, 0,1,0, 0,0,1];
  } else if (cosA < -0.9999) {
    // Tam ters → 180° Y rotasyonu (X-Z duzleminde flip)
    R = [-1,0,0, 0,-1,0, 0,0,1];
  } else {
    // Rotasyon eksen = Y × target, sin = |bu|
    var kx = yy * tz - yz * ty;
    var ky = yz * tx - yx * tz;
    var kz = yx * ty - yy * tx;
    var sinA = Math.sqrt(kx*kx + ky*ky + kz*kz);
    kx /= sinA; ky /= sinA; kz /= sinA;
    // Rodrigues: R = I + sinA·K + (1-cosA)·K²
    // K cross-product matrisi
    var oc = 1 - cosA;
    R = [
      cosA + kx*kx*oc,       kx*ky*oc - kz*sinA,   kx*kz*oc + ky*sinA,
      ky*kx*oc + kz*sinA,    cosA + ky*ky*oc,      ky*kz*oc - kx*sinA,
      kz*kx*oc - ky*sinA,    kz*ky*oc + kx*sinA,   cosA + kz*kz*oc
    ];
  }
  // Her node'a uygula: new = R · old + center
  var nodes = mesh.nodes;
  var n = nodes.length / 3;
  for (var i = 0; i < n; i++) {
    var x = nodes[i * 3], y = nodes[i * 3 + 1], z = nodes[i * 3 + 2];
    nodes[i * 3]     = R[0]*x + R[1]*y + R[2]*z + center[0];
    nodes[i * 3 + 1] = R[3]*x + R[4]*y + R[5]*z + center[1];
    nodes[i * 3 + 2] = R[6]*x + R[7]*y + R[8]*z + center[2];
  }
}

// ─── Boundary-snap: yüzey düğümlerini üçgen yüzeye snap et ─────────────────
// Voxel fallback (inference başarısız) staircase artifact'ını gizlemek için
// kullanılır. Algoritma: degree<thresh düğümleri = yüzey düğümleri olarak
// işaretle, parsed üçgenlerini 3D bin'le, her yüzey düğümünü en yakın
// üçgen noktasına taşı (Eberly's closest-point-on-triangle).
//
// Mesh topolojisi (eleman bağlantıları) korunur; sadece düğüm konumları
// değişir. Bu sayede staircase kübik yüzey gerçek geometriye yaklaşır.
function _veFEABoundarySnapToTriangles(mesh, parsed) {
  if (!mesh || mesh.error || !mesh.nodes || !parsed || !parsed.vertices) return mesh;
  var nodes = mesh.nodes;
  var elements = mesh.elements;
  var per = mesh.nodesPerElement || 8;
  var nNodes = nodes.length / 3;
  if (!elements || elements.length === 0) return mesh;

  // Düğüm derecesi (kaç elemana bağlı). İç düğümler tipik olarak yüksek
  // derece, yüzeydekiler düşük. Adaptif eşik = ortalama × 0.7.
  var degree = new Uint16Array(nNodes);
  for (var e = 0; e < elements.length; e++) {
    var d = degree[elements[e]];
    if (d < 65535) degree[elements[e]] = d + 1;
  }
  var sumD = 0;
  for (var s = 0; s < nNodes; s++) sumD += degree[s];
  var avgD = sumD / Math.max(1, nNodes);
  var thresh = Math.max(1, Math.floor(avgD * 0.7));

  var v = parsed.vertices;
  var triCount = parsed.triangleCount;
  if (triCount === 0) return mesh;

  // BBox üçgenlerden
  var bMinX = Infinity, bMinY = Infinity, bMinZ = Infinity;
  var bMaxX = -Infinity, bMaxY = -Infinity, bMaxZ = -Infinity;
  for (var p2 = 0; p2 < v.length; p2 += 3) {
    if (v[p2]   < bMinX) bMinX = v[p2];   if (v[p2]   > bMaxX) bMaxX = v[p2];
    if (v[p2+1] < bMinY) bMinY = v[p2+1]; if (v[p2+1] > bMaxY) bMaxY = v[p2+1];
    if (v[p2+2] < bMinZ) bMinZ = v[p2+2]; if (v[p2+2] > bMaxZ) bMaxZ = v[p2+2];
  }
  // 3D grid bin'leme: triangle bbox'larını bin'lere dağıt. O(N) snap arama.
  var bins = Math.max(4, Math.min(64, Math.round(Math.cbrt(triCount))));
  var bx = (bMaxX - bMinX) / bins;
  var by = (bMaxY - bMinY) / bins;
  var bz = (bMaxZ - bMinZ) / bins;
  if (bx <= 0) bx = 1; if (by <= 0) by = 1; if (bz <= 0) bz = 1;
  var grid = {};
  function key3(ix, jy, kz) { return ix + '|' + jy + '|' + kz; }
  for (var t = 0; t < triCount; t++) {
    var o = t * 9;
    var miX = Math.min(v[o], v[o+3], v[o+6]), maX = Math.max(v[o], v[o+3], v[o+6]);
    var miY = Math.min(v[o+1], v[o+4], v[o+7]), maY = Math.max(v[o+1], v[o+4], v[o+7]);
    var miZ = Math.min(v[o+2], v[o+5], v[o+8]), maZ = Math.max(v[o+2], v[o+5], v[o+8]);
    var i0 = Math.max(0, Math.min(bins - 1, Math.floor((miX - bMinX) / bx)));
    var i1 = Math.max(0, Math.min(bins - 1, Math.floor((maX - bMinX) / bx)));
    var j0 = Math.max(0, Math.min(bins - 1, Math.floor((miY - bMinY) / by)));
    var j1 = Math.max(0, Math.min(bins - 1, Math.floor((maY - bMinY) / by)));
    var k0 = Math.max(0, Math.min(bins - 1, Math.floor((miZ - bMinZ) / bz)));
    var k1 = Math.max(0, Math.min(bins - 1, Math.floor((maZ - bMinZ) / bz)));
    for (var ii = i0; ii <= i1; ii++) for (var jj = j0; jj <= j1; jj++) for (var kk = k0; kk <= k1; kk++) {
      var k = key3(ii, jj, kk);
      (grid[k] = grid[k] || []).push(t);
    }
  }

  // Eberly closest-point-on-triangle (out: [x,y,z])
  function nearestOnTri(px, py, pz, ax, ay, az, bx2, by2, bz2, cx, cy, cz, out) {
    var abx = bx2 - ax, aby = by2 - ay, abz = bz2 - az;
    var acx = cx - ax, acy = cy - ay, acz = cz - az;
    var apx = px - ax, apy = py - ay, apz = pz - az;
    var d1 = abx*apx + aby*apy + abz*apz;
    var d2 = acx*apx + acy*apy + acz*apz;
    if (d1 <= 0 && d2 <= 0) { out[0]=ax; out[1]=ay; out[2]=az; return; }
    var bpx = px - bx2, bpy = py - by2, bpz = pz - bz2;
    var d3 = abx*bpx + aby*bpy + abz*bpz;
    var d4 = acx*bpx + acy*bpy + acz*bpz;
    if (d3 >= 0 && d4 <= d3) { out[0]=bx2; out[1]=by2; out[2]=bz2; return; }
    var vc = d1*d4 - d3*d2;
    if (vc <= 0 && d1 >= 0 && d3 <= 0) {
      var wAB = d1 / (d1 - d3);
      out[0] = ax + wAB*abx; out[1] = ay + wAB*aby; out[2] = az + wAB*abz; return;
    }
    var cpx = px - cx, cpy = py - cy, cpz = pz - cz;
    var d5 = abx*cpx + aby*cpy + abz*cpz;
    var d6 = acx*cpx + acy*cpy + acz*cpz;
    if (d6 >= 0 && d5 <= d6) { out[0]=cx; out[1]=cy; out[2]=cz; return; }
    var vb = d5*d2 - d1*d6;
    if (vb <= 0 && d2 >= 0 && d6 <= 0) {
      var wAC = d2 / (d2 - d6);
      out[0] = ax + wAC*acx; out[1] = ay + wAC*acy; out[2] = az + wAC*acz; return;
    }
    var va = d3*d6 - d5*d4;
    if (va <= 0 && (d4 - d3) >= 0 && (d5 - d6) >= 0) {
      var wBC = (d4 - d3) / ((d4 - d3) + (d5 - d6));
      out[0] = bx2 + wBC*(cx - bx2); out[1] = by2 + wBC*(cy - by2); out[2] = bz2 + wBC*(cz - bz2); return;
    }
    var denom = 1 / (va + vb + vc);
    var vv = vb * denom, ww = vc * denom;
    out[0] = ax + vv*abx + ww*acx;
    out[1] = ay + vv*aby + ww*acy;
    out[2] = az + vv*abz + ww*acz;
  }

  var newNodes = new Float32Array(nodes);
  var hit = [0, 0, 0];
  for (var nId = 0; nId < nNodes; nId++) {
    if (degree[nId] >= thresh) continue; // iç düğüm — snap yok
    var nx = nodes[nId * 3], ny = nodes[nId * 3 + 1], nz = nodes[nId * 3 + 2];
    var ix = Math.max(0, Math.min(bins - 1, Math.floor((nx - bMinX) / bx)));
    var jy = Math.max(0, Math.min(bins - 1, Math.floor((ny - bMinY) / by)));
    var kz = Math.max(0, Math.min(bins - 1, Math.floor((nz - bMinZ) / bz)));
    var bestD2 = Infinity, bestX = nx, bestY = ny, bestZ = nz;
    for (var di = -1; di <= 1; di++) for (var dj = -1; dj <= 1; dj++) for (var dk = -1; dk <= 1; dk++) {
      var bi = ix + di, bj = jy + dj, bk = kz + dk;
      if (bi < 0 || bi >= bins || bj < 0 || bj >= bins || bk < 0 || bk >= bins) continue;
      var list = grid[key3(bi, bj, bk)];
      if (!list) continue;
      for (var li = 0; li < list.length; li++) {
        var ti = list[li];
        var oo = ti * 9;
        nearestOnTri(
          nx, ny, nz,
          v[oo],     v[oo + 1], v[oo + 2],
          v[oo + 3], v[oo + 4], v[oo + 5],
          v[oo + 6], v[oo + 7], v[oo + 8],
          hit
        );
        var dx = hit[0] - nx, dy = hit[1] - ny, dz = hit[2] - nz;
        var d2 = dx*dx + dy*dy + dz*dz;
        if (d2 < bestD2) { bestD2 = d2; bestX = hit[0]; bestY = hit[1]; bestZ = hit[2]; }
      }
    }
    if (bestD2 !== Infinity) {
      newNodes[nId * 3]     = bestX;
      newNodes[nId * 3 + 1] = bestY;
      newNodes[nId * 3 + 2] = bestZ;
    }
  }
  return Object.assign({}, mesh, { nodes: newNodes, boundarySnapped: true });
}

function _veFEAVoxelizeTrianglesToHex(parsed, voxelSize, geometryType, detectedFeatures) {
  if (!parsed || !parsed.vertices || parsed.triangleCount === 0) return null;
  var verts = parsed.vertices;
  var triCount = parsed.triangleCount;
  // Feature-aware sizing: egri yuzey (cylindrical/spherical) varsa voxel
  // boyutunu daha kucuk al (curvature-adaptive refinement). Adim global —
  // sonraki version'da bolgesel oktree refinement gelebilir.
  if (detectedFeatures && detectedFeatures.summary) {
    var s = detectedFeatures.summary;
    var curvedCount = (s.cylindrical || 0) + (s.spherical || 0) + (s.conical || 0);
    if (curvedCount > 0) {
      // Egri yuzey varsa voxel'i %30 kucult — daireselligi daha iyi yakala
      voxelSize = voxelSize * 0.7;
    }
  }

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
// Element Quality (3D): Q = C × |V| / (Σ L²)^(3/2), C tip-spesifik normalize
//   sabit, mükemmel küp/eşkenar = 1, dejenere = 0. ANSYS-uyumlu formül.
// Orthogonal Quality: her yüz için |(face_center − cell_center) · n| / |..|,
//   per-eleman min. Yapısal hex/quad için birincil metrik. 1 = mükemmel.
// Warping Factor (quad face): 4 köşenin düzlemden sapma ölçüsü (diagonal
//   midpoints farkı / avg diagonal). 0 = planar. Sadece hex/wedge quad
//   yüzlerinde anlamlı.
// Parallel Deviation (quad face): paralel kenarların paralellikten sapma
//   açısı (derece). 0 = mükemmel paralelogram. Sadece quad-faced elemanlarda.

// İki vektör (a, b) arasındaki açı (derece).
function _veFEAVecAngleDeg(ax, ay, az, bx, by, bz) {
  var aL = Math.sqrt(ax*ax + ay*ay + az*az);
  var bL = Math.sqrt(bx*bx + by*by + bz*bz);
  if (aL < 1e-12 || bL < 1e-12) return 0;
  var d = (ax*bx + ay*by + az*bz) / (aL * bL);
  if (d > 1) d = 1; else if (d < -1) d = -1;
  return Math.acos(d) * 180 / Math.PI;
}

// Element merkezini hesapla (cornerCount düğümün ortalaması).
function _veFEAElementCentroid(nodes, elements, off, cornerCount) {
  var cx = 0, cy = 0, cz = 0;
  for (var i = 0; i < cornerCount; i++) {
    var n = elements[off + i] * 3;
    cx += nodes[n]; cy += nodes[n + 1]; cz += nodes[n + 2];
  }
  return { x: cx / cornerCount, y: cy / cornerCount, z: cz / cornerCount };
}

// Yüz merkezi + outward normal (ilk 3 köşeden cross product, CCW şablonu varsayar).
function _veFEAFaceCenterNormal(nodes, elements, off, face) {
  var fLen = face.length;
  var cx = 0, cy = 0, cz = 0;
  for (var i = 0; i < fLen; i++) {
    var n = elements[off + face[i]] * 3;
    cx += nodes[n]; cy += nodes[n + 1]; cz += nodes[n + 2];
  }
  cx /= fLen; cy /= fLen; cz /= fLen;
  var a = elements[off + face[0]] * 3;
  var b = elements[off + face[1]] * 3;
  var c = elements[off + face[2]] * 3;
  var e1x = nodes[b]     - nodes[a];
  var e1y = nodes[b + 1] - nodes[a + 1];
  var e1z = nodes[b + 2] - nodes[a + 2];
  var e2x = nodes[c]     - nodes[a];
  var e2y = nodes[c + 1] - nodes[a + 1];
  var e2z = nodes[c + 2] - nodes[a + 2];
  var nx = e1y * e2z - e1z * e2y;
  var ny = e1z * e2x - e1x * e2z;
  var nz = e1x * e2y - e1y * e2x;
  var len = Math.sqrt(nx*nx + ny*ny + nz*nz);
  if (len > 1e-20) { nx /= len; ny /= len; nz /= len; }
  return { cx: cx, cy: cy, cz: cz, nx: nx, ny: ny, nz: nz };
}

// Orthogonal Quality (per element): element centroid'ten her face center'a
// vektör ile face normal arasındaki açının |cos|'ü. 1 = mükemmel ortogonal,
// 0 = paralel (kötü). Per-element value = min over all faces.
function _veFEAOrthogonalQuality(nodes, elements, off, cornerCount, faces) {
  var cen = _veFEAElementCentroid(nodes, elements, off, cornerCount);
  var minQ = Infinity;
  for (var f = 0; f < faces.length; f++) {
    var fn = _veFEAFaceCenterNormal(nodes, elements, off, faces[f]);
    var fx = fn.cx - cen.x;
    var fy = fn.cy - cen.y;
    var fz = fn.cz - cen.z;
    var fl = Math.sqrt(fx*fx + fy*fy + fz*fz);
    if (fl < 1e-12) continue;
    var dot = (fx * fn.nx + fy * fn.ny + fz * fn.nz) / fl;
    var q = Math.abs(dot);
    if (q < minQ) minQ = q;
  }
  return isFinite(minQ) ? minQ : 0;
}

// Element Quality (geometric shape factor). Mükemmel referansta Q=1.
// 3D: Q = C × |V| / (Σ L²)^(3/2). C: tet=72√3, hex=24√3, wedge=36√3.
// 2D: Q = (4√3) × A / (Σ L²) — equilateral tri için 1.
var _VE_FEA_ELEM_QUAL_C_TET   = 72 * Math.sqrt(3);  // ≈ 124.708
var _VE_FEA_ELEM_QUAL_C_HEX   = 24 * Math.sqrt(3);  // ≈ 41.569
var _VE_FEA_ELEM_QUAL_C_WEDGE = 36 * Math.sqrt(3);  // ≈ 62.354
var _VE_FEA_ELEM_QUAL_C_TRI   = 4  * Math.sqrt(3);  // ≈ 6.928 (2D)
function _veFEAElementQuality(type, nodes, elements, off, edges) {
  var sumL2 = 0;
  for (var i = 0; i < edges.length; i++) {
    var a = elements[off + edges[i][0]] * 3;
    var b = elements[off + edges[i][1]] * 3;
    var dx = nodes[a]     - nodes[b];
    var dy = nodes[a + 1] - nodes[b + 1];
    var dz = nodes[a + 2] - nodes[b + 2];
    sumL2 += dx*dx + dy*dy + dz*dz;
  }
  if (sumL2 < 1e-20) return 0;

  if (type === 'tri3') {
    var a0 = elements[off + 0] * 3;
    var a1 = elements[off + 1] * 3;
    var a2 = elements[off + 2] * 3;
    var e1x = nodes[a1]     - nodes[a0];
    var e1y = nodes[a1 + 1] - nodes[a0 + 1];
    var e1z = nodes[a1 + 2] - nodes[a0 + 2];
    var e2x = nodes[a2]     - nodes[a0];
    var e2y = nodes[a2 + 1] - nodes[a0 + 1];
    var e2z = nodes[a2 + 2] - nodes[a0 + 2];
    var cx = e1y * e2z - e1z * e2y;
    var cy = e1z * e2x - e1x * e2z;
    var cz = e1x * e2y - e1y * e2x;
    var area = 0.5 * Math.sqrt(cx*cx + cy*cy + cz*cz);
    var q2 = _VE_FEA_ELEM_QUAL_C_TRI * area / sumL2;
    return q2 > 1 ? 1 : (q2 < 0 ? 0 : q2);
  }

  var vol = 0, C = 0;
  if (type === 'tet4' || type === 'tet10') {
    vol = Math.abs(_veFEATetSignedVolume(nodes, elements, off, 0, 1, 2, 3));
    C = _VE_FEA_ELEM_QUAL_C_TET;
  } else if (type === 'hex8' || type === 'hex20') {
    var vh = _veFEAHexSubTetVolumes(nodes, elements, off);
    var sh = 0; for (var kh = 0; kh < vh.length; kh++) sh += vh[kh];
    vol = Math.abs(sh);
    C = _VE_FEA_ELEM_QUAL_C_HEX;
  } else if (type === 'wedge6' || type === 'wedge15') {
    var vw = _veFEAWedgeSubTetVolumes(nodes, elements, off);
    var sw = 0; for (var kw = 0; kw < vw.length; kw++) sw += vw[kw];
    vol = Math.abs(sw);
    C = _VE_FEA_ELEM_QUAL_C_WEDGE;
  } else {
    return 0;
  }
  var den = Math.pow(sumL2, 1.5);
  if (den < 1e-20) return 0;
  var q = C * vol / den;
  return q > 1 ? 1 : (q < 0 ? 0 : q);
}

// Warping Factor (per element): quad-face'lerin düzlemden sapması.
// Yöntem: iki diagonal'in midpoint'leri arası mesafe / ortalama diagonal uzunluğu.
// 0 = planar, > 0.05 problemli. Tet/tri'de quad face yok → 0.
function _veFEAWarpingFactor(nodes, elements, off, faces) {
  var maxW = 0;
  for (var f = 0; f < faces.length; f++) {
    var face = faces[f];
    if (face.length !== 4) continue;
    var p0 = elements[off + face[0]] * 3;
    var p1 = elements[off + face[1]] * 3;
    var p2 = elements[off + face[2]] * 3;
    var p3 = elements[off + face[3]] * 3;
    var m1x = (nodes[p0]     + nodes[p2])     * 0.5;
    var m1y = (nodes[p0 + 1] + nodes[p2 + 1]) * 0.5;
    var m1z = (nodes[p0 + 2] + nodes[p2 + 2]) * 0.5;
    var m2x = (nodes[p1]     + nodes[p3])     * 0.5;
    var m2y = (nodes[p1 + 1] + nodes[p3 + 1]) * 0.5;
    var m2z = (nodes[p1 + 2] + nodes[p3 + 2]) * 0.5;
    var dx = m1x - m2x, dy = m1y - m2y, dz = m1z - m2z;
    var d = Math.sqrt(dx*dx + dy*dy + dz*dz);
    var d1x = nodes[p2]     - nodes[p0], d1y = nodes[p2+1] - nodes[p0+1], d1z = nodes[p2+2] - nodes[p0+2];
    var d2x = nodes[p3]     - nodes[p1], d2y = nodes[p3+1] - nodes[p1+1], d2z = nodes[p3+2] - nodes[p1+2];
    var L1 = Math.sqrt(d1x*d1x + d1y*d1y + d1z*d1z);
    var L2 = Math.sqrt(d2x*d2x + d2y*d2y + d2z*d2z);
    var avgL = (L1 + L2) * 0.5;
    if (avgL < 1e-12) continue;
    var w = d / avgL;
    if (w > maxW) maxW = w;
  }
  return maxW;
}

// Parallel Deviation (per element): quad face paralel kenarlarının paralellikten
// sapma açısı (derece). 0 = mükemmel paralelogram, > 70° kötü.
function _veFEAParallelDeviation(nodes, elements, off, faces) {
  var maxD = 0;
  for (var f = 0; f < faces.length; f++) {
    var face = faces[f];
    if (face.length !== 4) continue;
    var p0 = elements[off + face[0]] * 3;
    var p1 = elements[off + face[1]] * 3;
    var p2 = elements[off + face[2]] * 3;
    var p3 = elements[off + face[3]] * 3;
    var e0x = nodes[p1]   - nodes[p0],   e0y = nodes[p1+1] - nodes[p0+1], e0z = nodes[p1+2] - nodes[p0+2];
    var e1x = nodes[p2]   - nodes[p1],   e1y = nodes[p2+1] - nodes[p1+1], e1z = nodes[p2+2] - nodes[p1+2];
    var e2x = nodes[p3]   - nodes[p2],   e2y = nodes[p3+1] - nodes[p2+1], e2z = nodes[p3+2] - nodes[p2+2];
    var e3x = nodes[p0]   - nodes[p3],   e3y = nodes[p0+1] - nodes[p3+1], e3z = nodes[p0+2] - nodes[p3+2];
    // Paralel olması beklenen: e0 ‖ -e2, e1 ‖ -e3. Sapma açısı:
    var dev1 = _veFEAVecAngleDeg(e0x, e0y, e0z, -e2x, -e2y, -e2z);
    var dev2 = _veFEAVecAngleDeg(e1x, e1y, e1z, -e3x, -e3y, -e3z);
    var dev = Math.max(dev1, dev2);
    if (dev > maxD) maxD = dev;
  }
  return maxD;
}

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
  var orthoArr = new Float32Array(n);
  var elemQualArr = new Float32Array(n);
  var warpArr = new Float32Array(n);
  var parDevArr = new Float32Array(n);
  var poorAspect = 0;     // ar > 20
  var poorSkew = 0;       // sk > 0.85
  var poorElemQual = 0;   // eq < 0.2
  var poorOrtho = 0;      // oq < 0.1
  var poorWarp = 0;       // w > 0.05
  var poorParDev = 0;     // pd > 70°

  var gMinAr = Infinity, gMaxAr = -Infinity, sumAr = 0;
  var gMinSk = Infinity, gMaxSk = -Infinity, sumSk = 0;
  var gMinAng = Infinity, gMaxAng = -Infinity;
  var gMinEq = Infinity, gMaxEq = -Infinity, sumEq = 0;
  var gMinOq = Infinity, gMaxOq = -Infinity, sumOq = 0;
  var gMinWp = Infinity, gMaxWp = -Infinity, sumWp = 0;
  var gMinPd = Infinity, gMaxPd = -Infinity, sumPd = 0;

  var hasQuadFaces = (type === 'hex8' || type === 'hex20' ||
                      type === 'wedge6' || type === 'wedge15');
  var is3D = (type !== 'tri3');

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

    // Element Quality (tüm tipler)
    var eq = _veFEAElementQuality(type, nodes, elements, off, edges);
    elemQualArr[e] = eq;
    if (eq < gMinEq) gMinEq = eq;
    if (eq > gMaxEq) gMaxEq = eq;
    sumEq += eq;
    if (eq < 0.2) poorElemQual++;

    // Orthogonal Quality (sadece 3D)
    if (is3D) {
      var oq = _veFEAOrthogonalQuality(nodes, elements, off, cornerCount, faces);
      orthoArr[e] = oq;
      if (oq < gMinOq) gMinOq = oq;
      if (oq > gMaxOq) gMaxOq = oq;
      sumOq += oq;
      if (oq < 0.1) poorOrtho++;
    }

    // Warping + Parallel Deviation (sadece quad-faced)
    if (hasQuadFaces) {
      var wp = _veFEAWarpingFactor(nodes, elements, off, faces);
      warpArr[e] = wp;
      if (wp < gMinWp) gMinWp = wp;
      if (wp > gMaxWp) gMaxWp = wp;
      sumWp += wp;
      if (wp > 0.05) poorWarp++;

      var pd = _veFEAParallelDeviation(nodes, elements, off, faces);
      parDevArr[e] = pd;
      if (pd < gMinPd) gMinPd = pd;
      if (pd > gMaxPd) gMaxPd = pd;
      sumPd += pd;
      if (pd > 70) poorParDev++;
    }
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
    },
    elementQuality: {
      min: isFinite(gMinEq) ? gMinEq : 0,
      max: isFinite(gMaxEq) ? gMaxEq : 0,
      avg: sumEq / n,
      poorCount: poorElemQual,
      warnThreshold: 0.2,
      histogram: _veFEAHistogram(elemQualArr, 0, 1, 10)
    },
    orthogonalQuality: is3D ? {
      min: isFinite(gMinOq) ? gMinOq : 0,
      max: isFinite(gMaxOq) ? gMaxOq : 0,
      avg: sumOq / n,
      poorCount: poorOrtho,
      warnThreshold: 0.1,
      histogram: _veFEAHistogram(orthoArr, 0, 1, 10)
    } : null,
    warpingFactor: hasQuadFaces ? {
      min: isFinite(gMinWp) ? gMinWp : 0,
      max: isFinite(gMaxWp) ? gMaxWp : 0,
      avg: sumWp / n,
      poorCount: poorWarp,
      warnThreshold: 0.05,
      histogram: _veFEAHistogram(warpArr, 0, 0.5, 10)
    } : null,
    parallelDeviation: hasQuadFaces ? {
      min: isFinite(gMinPd) ? gMinPd : 0,
      max: isFinite(gMaxPd) ? gMaxPd : 0,
      avg: sumPd / n,
      poorCount: poorParDev,
      warnThreshold: 70,
      histogram: _veFEAHistogram(parDevArr, 0, 90, 9)
    } : null
  };
}

// ─── Adaptive refinement önerileri (mesh kalite-tabanlı) ─────────────────
// Solver F5 tamamlanana kadar gerçek "error indicator feedback" yok. Bu yöntem
// quality + jacobian metriklerinden heuristic öneriler üretir:
//   - Ters eleman → KRİTİK: mesh size %50 küçült (yeniden meshle)
//   - Aspect/skewness/jacobian-ratio kötü oranı %5+ → UYARI: %20 küçült
//   - Çok düşük kaliteli → INFO: lokal sizing dene
//   - Tüm metrikler iyi → "mesh hazır" mesajı
function veFEAComputeRefinementSuggestions(meshMetrics) {
  if (!meshMetrics) return [];
  var out = [];
  var n = meshMetrics.elementCount || 1;
  var jm = meshMetrics.jacobian;
  var q = meshMetrics.quality;

  // 1. Inverted / dejenere — KRİTİK
  if (jm && (jm.invertedCount > 0 || jm.degenerateCount > 0)) {
    out.push({
      severity: 'critical',
      message: 'Ters/dejenere eleman var (' + (jm.invertedCount + jm.degenerateCount) + '). Mesh boyu yarıya indirilmeli.',
      action: { type: 'reduceSize', factor: 0.5 }
    });
    return out; // kritik durum, diğer önerilere bakma
  }

  // 2. Düşük aspect ratio oranı
  if (q && q.aspectRatio.poorCount > 0) {
    var pctA = q.aspectRatio.poorCount / n;
    if (pctA > 0.05) {
      out.push({
        severity: 'warn',
        message: q.aspectRatio.poorCount + ' eleman aspect > ' + q.aspectRatio.warnThreshold +
          ' (%' + Math.round(pctA * 100) + '). Mesh boyu %20 küçültülmeli.',
        action: { type: 'reduceSize', factor: 0.8 }
      });
    } else if (pctA > 0) {
      out.push({
        severity: 'info',
        message: q.aspectRatio.poorCount + ' eleman aspect > ' + q.aspectRatio.warnThreshold +
          ' (%' + (pctA * 100).toFixed(1) + '). Lokal sizing düşünülebilir.',
        action: null
      });
    }
  }

  // 3. Skewness
  if (q && q.skewness.poorCount > 0) {
    var pctS = q.skewness.poorCount / n;
    if (pctS > 0.05) {
      out.push({
        severity: 'warn',
        message: q.skewness.poorCount + ' eleman skewness > ' + q.skewness.warnThreshold +
          ' (%' + Math.round(pctS * 100) + '). Mesh boyu %15 küçültülmeli.',
        action: { type: 'reduceSize', factor: 0.85 }
      });
    }
  }

  // 4. Jacobian oranı
  if (jm && jm.poorCount > 0) {
    var pctJ = jm.poorCount / n;
    if (pctJ > 0.05) {
      out.push({
        severity: 'warn',
        message: jm.poorCount + ' eleman Jacobian oranı > ' + jm.ratioWarnThreshold +
          '. Lokal yoğunlaştırma veya curvature refinement deneyin.',
        action: null
      });
    }
  }

  // 5. Element Quality (3D shape factor)
  if (q && q.elementQuality && q.elementQuality.poorCount > 0) {
    var pctEq = q.elementQuality.poorCount / n;
    if (pctEq > 0.05) {
      out.push({
        severity: 'warn',
        message: q.elementQuality.poorCount + ' eleman Element Quality < ' + q.elementQuality.warnThreshold +
          ' (%' + Math.round(pctEq * 100) + '). Şekil faktörü düşük, lokal sizing veya method değişikliği deneyin.',
        action: null
      });
    }
  }

  // 6. Orthogonal Quality (yapısal hex/quad için birincil metrik)
  if (q && q.orthogonalQuality && q.orthogonalQuality.poorCount > 0) {
    var pctOq = q.orthogonalQuality.poorCount / n;
    if (pctOq > 0.05) {
      out.push({
        severity: 'warn',
        message: q.orthogonalQuality.poorCount + ' eleman Orthogonal Quality < ' + q.orthogonalQuality.warnThreshold +
          ' (%' + Math.round(pctOq * 100) + '). Sweep/MultiZone yöntemi veya curvature refinement deneyin.',
        action: null
      });
    }
  }

  // 7. Warping (quad-faced elements)
  if (q && q.warpingFactor && q.warpingFactor.poorCount > 0) {
    var pctWp = q.warpingFactor.poorCount / n;
    if (pctWp > 0.05) {
      out.push({
        severity: 'warn',
        message: q.warpingFactor.poorCount + ' yüz warping > ' + q.warpingFactor.warnThreshold +
          ' (%' + Math.round(pctWp * 100) + '). Düz yüzeyli mesh için sweep veya yapısal grid kullanın.',
        action: null
      });
    }
  }

  // 8. Parallel Deviation (quad-faced elements)
  if (q && q.parallelDeviation && q.parallelDeviation.poorCount > 0) {
    var pctPd = q.parallelDeviation.poorCount / n;
    if (pctPd > 0.05) {
      out.push({
        severity: 'info',
        message: q.parallelDeviation.poorCount + ' yüz parallel deviation > ' + q.parallelDeviation.warnThreshold +
          '° (%' + Math.round(pctPd * 100) + '). Quad simetrisi bozuk, structured sweep değerlendirin.',
        action: null
      });
    }
  }

  // 9. Çevresel curvature (silindir/şaft için)
  if (meshMetrics.sweepAxis === 'Y' && q && q.aspectRatio.max > 5) {
    out.push({
      severity: 'info',
      message: 'Eğrili yüzeyde aspect ratio yüksek. Curvature refinement aktif edin (Maks açı 18°).',
      action: { type: 'enableCurvature', normalAngleDeg: 18 }
    });
  }

  // Hiçbir öneri yoksa mesh OK
  if (out.length === 0) {
    out.push({
      severity: 'ok',
      message: 'Mesh kalitesi iyi. Tüm metrikler eşik değerlerin altında.',
      action: null
    });
  }
  return out;
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

    } else if (metric === 'elementQuality') {
      out[e] = _veFEAElementQuality(type, nodes, elements, off, edges);

    } else if (metric === 'orthogonalQuality') {
      if (type === 'tri3') { out[e] = 0; continue; }
      var cornerC = (type === 'tet10') ? 4
                  : (type === 'hex20') ? 8
                  : (type === 'wedge15') ? 6
                  : per;
      out[e] = _veFEAOrthogonalQuality(nodes, elements, off, cornerC, faces);

    } else if (metric === 'warpingFactor') {
      out[e] = _veFEAWarpingFactor(nodes, elements, off, faces);

    } else if (metric === 'parallelDeviation') {
      out[e] = _veFEAParallelDeviation(nodes, elements, off, faces);

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

// ANSYS Mesh Quality Worksheet renkleri — threshold-based:
//   value < warnLimit → yeşil (iyi)
//   warnLimit ≤ value < errLimit → sarı (uyarı)
//   value ≥ errLimit → kırmızı (hata)
// inverted=true: küçük değer kötü (örn. minAngle).
function veFEAThresholdColor(value, warnLimit, errLimit, inverted) {
  if (!isFinite(value)) return [0.5, 0.5, 0.5];
  var isErr, isWarn;
  if (inverted) {
    isErr  = value <= errLimit;
    isWarn = !isErr && value <= warnLimit;
  } else {
    isErr  = value >= errLimit;
    isWarn = !isErr && value >= warnLimit;
  }
  if (isErr)  return [0.93, 0.27, 0.27];   // ANSYS kırmızı (#ef4444)
  if (isWarn) return [0.96, 0.62, 0.04];   // ANSYS sarı/turuncu (#f59e0b)
  return [0.13, 0.77, 0.37];                // ANSYS yeşil (#22c55e)
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

// ─── Web Worker async mesh — UI thread'i bloke etmez ──────────────────────
// Büyük mesh'lerde (>100k eleman tahmini) Worker'da hesapla, UI render'ı
// dondurmaz. Worker yoksa veya hata varsa sync yola fallback.
var VE_FEA_MESH_WORKER = null;
var VE_FEA_MESH_WORKER_REQS = {};
var VE_FEA_MESH_WORKER_FAILED = false;

function _veFEAEnsureMeshWorker() {
  if (VE_FEA_MESH_WORKER) return VE_FEA_MESH_WORKER;
  if (VE_FEA_MESH_WORKER_FAILED) return null;
  if (typeof Worker === 'undefined') { VE_FEA_MESH_WORKER_FAILED = true; return null; }
  try {
    // Dev: doğrudan path. Monolithic HTML için ileride inline blob URL desteği.
    VE_FEA_MESH_WORKER = new Worker('js/fea-mesh-worker.js');
    VE_FEA_MESH_WORKER.onmessage = function(e) {
      var msg = e.data;
      if (!msg || !msg.requestId) return;
      var req = VE_FEA_MESH_WORKER_REQS[msg.requestId];
      if (!req) return;
      delete VE_FEA_MESH_WORKER_REQS[msg.requestId];
      if (msg.type === 'meshResult') req.resolve(msg.result);
      else if (msg.type === 'meshError') req.reject(new Error(msg.error || 'Worker hatası'));
    };
    VE_FEA_MESH_WORKER.onerror = function(err) {
      console.error('[FEA Worker]', err.message || err);
      VE_FEA_MESH_WORKER_FAILED = true;
      // Bekleyen tüm istekleri reject et
      Object.keys(VE_FEA_MESH_WORKER_REQS).forEach(function(rid) {
        VE_FEA_MESH_WORKER_REQS[rid].reject(new Error('Worker hatası: ' + (err.message || 'unknown')));
        delete VE_FEA_MESH_WORKER_REQS[rid];
      });
      try { VE_FEA_MESH_WORKER.terminate(); } catch (e2) {}
      VE_FEA_MESH_WORKER = null;
    };
    return VE_FEA_MESH_WORKER;
  } catch (err) {
    console.warn('[FEA] Worker oluşturulamadı:', err);
    VE_FEA_MESH_WORKER_FAILED = true;
    return null;
  }
}

// Mesh request'ini Worker'a gönder. Worker yoksa sync fallback.
//   Returns: Promise<meshData>
function veFEAMeshFromGeometryViaWorker(geometry, opts) {
  return new Promise(function(resolve, reject) {
    var worker = _veFEAEnsureMeshWorker();
    if (!worker) {
      // Sync fallback (test ortamı veya Worker desteklenmiyor)
      try {
        if (geometry && geometry.type === 'step' && typeof veFEAMeshFromGeometryAsync === 'function') {
          veFEAMeshFromGeometryAsync(geometry, opts).then(resolve).catch(reject);
        } else {
          resolve(veFEAMeshFromGeometry(geometry, opts));
        }
      } catch (e) { reject(e); }
      return;
    }
    var requestId = 'req_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
    VE_FEA_MESH_WORKER_REQS[requestId] = { resolve: resolve, reject: reject };
    worker.postMessage({
      type: 'meshFromGeometry',
      requestId: requestId,
      geometry: geometry,
      opts: opts
    });
  });
}

// ─── Multi-body: mesh birleştirme + contact detection ─────────────────────
// Birden fazla mesh'i tek bir mesh data'sı halinde birleştirir. Düğüm ID'leri
// offset'lenir, elemanlar relabel olur, named selections prefix'lenir.
// Tüm mesh'lerin tipi aynı olmalı (hex8 + hex8, vb). Karma tipler (hex8 + wedge6)
// 'mixed' tipinde döner ama uyumsuz elemanlar tek block'da olur.
//
// Kullanım (BC F4 öncesi multi-body assembly):
//   var assembly = veFEACombineMeshes([meshA, meshB], ['body1', 'body2']);
//
// Output:
//   { type, nodes, elements, nodesPerElement, namedSelections (prefixed),
//     bodyRanges: [{ name, nodeStart, nodeEnd, elemStart, elemEnd }] }
function veFEACombineMeshes(meshList, names) {
  if (!Array.isArray(meshList) || meshList.length === 0) return null;
  names = names || meshList.map(function(_, i) { return 'body' + (i + 1); });

  // Tip uyumu — heterojen mesh'ler farklı per değerleri taşıyabilir
  var firstValid = meshList.find(function(m) { return m && !m.error; });
  if (!firstValid) return null;
  var baseType = firstValid.type;
  var basePer = firstValid.nodesPerElement;
  var heterogeneous = false;
  for (var i = 0; i < meshList.length; i++) {
    var m = meshList[i];
    if (!m || m.error) continue;
    if (m.type !== baseType || m.nodesPerElement !== basePer) {
      heterogeneous = true;
      break;
    }
  }
  if (heterogeneous) {
    // Karma tipler şu an desteklenmiyor — açık hata
    return { error: 'mixed-element-types', message: 'veFEACombineMeshes: tüm mesh\'ler aynı element tipinde olmalı (heterojen henüz desteklenmiyor)' };
  }

  // Toplam boyutlar
  var totalNodes = 0, totalElems = 0;
  meshList.forEach(function(m) {
    if (!m || m.error) return;
    totalNodes += m.nodes.length / 3;
    totalElems += m.elements.length / m.nodesPerElement;
  });
  if (totalNodes === 0) return null;

  var nodes = new Float32Array(totalNodes * 3);
  var elements = new Uint32Array(totalElems * basePer);
  var combinedNS = {};
  var bodyRanges = [];

  var nodeOffset = 0;
  var elemPtr = 0;
  meshList.forEach(function(m, idx) {
    if (!m || m.error) return;
    var name = names[idx] || ('body' + (idx + 1));
    var nNodes = m.nodes.length / 3;
    var nElems = m.elements.length / m.nodesPerElement;

    // Düğümleri kopyala
    nodes.set(m.nodes, nodeOffset * 3);

    // Elemanları offset'le
    for (var e = 0; e < m.elements.length; e++) {
      elements[elemPtr * basePer + e] = m.elements[e] + nodeOffset;
    }
    elemPtr += nElems;

    // Named selections prefix'le
    if (m.namedSelections) {
      Object.keys(m.namedSelections).forEach(function(k) {
        var ns = m.namedSelections[k];
        var offsetIds = new Uint32Array(ns.nodeIds.length);
        for (var j = 0; j < ns.nodeIds.length; j++) {
          offsetIds[j] = ns.nodeIds[j] + nodeOffset;
        }
        combinedNS[name + '.' + k] = {
          type: ns.type,
          source: ns.source,
          label: name + ': ' + ns.label,
          nodeIds: offsetIds
        };
      });
    }

    bodyRanges.push({
      name: name,
      nodeStart: nodeOffset,
      nodeEnd: nodeOffset + nNodes - 1,
      elemStart: elemPtr - nElems,
      elemEnd: elemPtr - 1
    });

    nodeOffset += nNodes;
  });

  return {
    type: baseType,
    geometryType: 'assembly',
    nodes: nodes,
    elements: elements,
    nodesPerElement: basePer,
    namedSelections: combinedNS,
    bodyRanges: bodyRanges,
    isAssembly: true
  };
}

// İki mesh arasındaki yakın boundary node çiftlerini bulur (tie-constraint
// adayları). MVP: O(n²) tüm boundary node'lar arası kontrol; n > 10k için
// spatial hash gerekir (ileride).
//   meshList: array of mesh data
//   tolerance: yakınlık eşiği (mm)
//   Returns: [{ mesh1: idx, node1: id, mesh2: idx, node2: id, distance }]
function veFEADetectContactPairs(meshList, tolerance) {
  if (!Array.isArray(meshList) || meshList.length < 2) return [];
  var tol = (typeof tolerance === 'number' && tolerance > 0) ? tolerance : 0.1;
  var tol2 = tol * tol;

  // Her mesh için boundary nodeId listesi + pozisyon array'i hazırla
  var bodies = [];
  meshList.forEach(function(m) {
    if (!m || m.error) { bodies.push(null); return; }
    var nodeCount = m.nodes.length / 3;
    var degree = new Uint8Array(nodeCount);
    for (var e = 0; e < m.elements.length; e++) {
      if (degree[m.elements[e]] < 255) degree[m.elements[e]]++;
    }
    var boundary = [];
    for (var n = 0; n < nodeCount; n++) {
      if (degree[n] < 8) boundary.push(n);
    }
    bodies.push({ mesh: m, boundary: boundary });
  });

  var pairs = [];
  for (var a = 0; a < bodies.length; a++) {
    for (var b = a + 1; b < bodies.length; b++) {
      var ba = bodies[a], bb = bodies[b];
      if (!ba || !bb) continue;
      var nodesA = ba.mesh.nodes;
      var nodesB = bb.mesh.nodes;
      for (var i = 0; i < ba.boundary.length; i++) {
        var idA = ba.boundary[i];
        var ax = nodesA[idA * 3], ay = nodesA[idA * 3 + 1], az = nodesA[idA * 3 + 2];
        for (var j = 0; j < bb.boundary.length; j++) {
          var idB = bb.boundary[j];
          var bx = nodesB[idB * 3], by = nodesB[idB * 3 + 1], bz = nodesB[idB * 3 + 2];
          var dx = ax - bx, dy = ay - by, dz = az - bz;
          var d2 = dx * dx + dy * dy + dz * dz;
          if (d2 < tol2) {
            pairs.push({ mesh1: a, node1: idA, mesh2: b, node2: idB, distance: Math.sqrt(d2) });
          }
        }
      }
    }
  }
  return pairs;
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

// Sadece sınır (yüzey) face'lerinin kenarlarını çıkar. Yoğun hacim
// mesh'lerinde iç edge'ler ekrana sığmaz (milyonlarca); yüzey edge'leri
// boyut(N^(2/3)) ölçeklenir, bu sayede her zaman görünür kalır.
// Algoritma: face dedup (count==1 → sınır), sınır face kenarları dedup.
function veFEAMeshExtractSurfaceEdges(meshData) {
  if (!meshData) return null;
  var type = meshData.type;
  var nodes = meshData.nodes;
  var elements = meshData.elements;
  var per = meshData.nodesPerElement;
  var n = elements ? elements.length / per : 0;
  if (n === 0) return null;

  // Tri3 zaten yüzey — tüm edge'ler döndür
  if (type === 'tri3') return veFEAMeshExtractEdges(meshData);

  var faces = _veFEAGetFaceTemplate(type);
  if (faces.length === 0) return null;

  // Face dedup: count==1 → sınır, count==2 → iç (paylaşılan)
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
      else faceMap.set(key, { count: 1, ids: ids });
    }
  }

  // Sınır face'leri (count==1) için edge listesi (cycle order, dedup)
  var edgeSeen = {};
  var lines = [];
  faceMap.forEach(function(fm) {
    if (fm.count !== 1) return;
    var ids = fm.ids;
    var len = ids.length;
    for (var i = 0; i < len; i++) {
      var a = ids[i];
      var b = ids[(i + 1) % len];
      var k = a < b ? (a + '-' + b) : (b + '-' + a);
      if (edgeSeen[k]) continue;
      edgeSeen[k] = 1;
      lines.push(nodes[a * 3], nodes[a * 3 + 1], nodes[a * 3 + 2]);
      lines.push(nodes[b * 3], nodes[b * 3 + 1], nodes[b * 3 + 2]);
    }
  });
  return new Float32Array(lines);
}
