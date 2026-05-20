// ============================================================================
// FEA MESH UTILS — ortak yardımcılar
// ============================================================================
// Mesh üretim modüllerinin paylaştığı pure helper'lar. Algoritma duplikasyonu
// olmaması için, dedup gibi her yerde aynı şekilde yapılması gereken işler
// burada tek noktadan tanımlanır.
//
// Public API:
//   veFEADedupVertices(vertices, opts) → { canonical, unique, uniqueCount, bbox, epsilon }
//
// Çağrıldığı yerler:
//   - js/fea-delaunay.js          (triangle-soup → indexed PLC)
//   - js/fea-feature-recognition.js (canonical vertex index for adjacency)
// ============================================================================

/**
 * Triangle-soup veya genel point cloud'da çakışan/yakın vertex'leri spatial
 * hash ile birleştirir. O(N) — bbox quantization grid'i kullanır.
 *
 * @param {Float32Array|number[]} vertices  Flat [x,y,z, x,y,z, ...] dizisi
 * @param {object} [opts]
 * @param {number} [opts.bboxSize]      Tolerans için bbox boyu (yoksa hesaplanır)
 * @param {number} [opts.epsRatio=1e-6] Tolerance = bbox * epsRatio
 * @param {number} [opts.minEps=1e-9]   Tolerance alt sınırı
 * @returns {{
 *   canonical:   Int32Array,    // her input vertex → unique index
 *   unique:      Float32Array,  // unique pozisyonlar [x,y,z,...]
 *   uniqueCount: number,
 *   bbox:        { minX, maxX, minY, maxY, minZ, maxZ },
 *   epsilon:     number
 * }}
 */
function veFEADedupVertices(vertices, opts) {
  opts = opts || {};
  var n = (vertices.length / 3) | 0;

  var minX = Infinity, minY = Infinity, minZ = Infinity;
  var maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
  for (var i = 0; i < vertices.length; i += 3) {
    var x = vertices[i], y = vertices[i + 1], z = vertices[i + 2];
    if (x < minX) minX = x; if (x > maxX) maxX = x;
    if (y < minY) minY = y; if (y > maxY) maxY = y;
    if (z < minZ) minZ = z; if (z > maxZ) maxZ = z;
  }
  var dia = (typeof opts.bboxSize === 'number' && opts.bboxSize > 0)
    ? opts.bboxSize
    : Math.max(maxX - minX, maxY - minY, maxZ - minZ);
  var epsRatio = (typeof opts.epsRatio === 'number') ? opts.epsRatio : 1e-6;
  var minEps   = (typeof opts.minEps   === 'number') ? opts.minEps   : 1e-9;
  var eps = Math.max(minEps, dia * epsRatio);
  var invEps = 1 / eps;

  var map = new Map();
  var canonical = new Int32Array(n);
  var uxs = [], uys = [], uzs = [];
  var uniqueCount = 0;

  for (var v = 0; v < n; v++) {
    var px = vertices[v * 3], py = vertices[v * 3 + 1], pz = vertices[v * 3 + 2];
    var key = Math.round(px * invEps) + '|' + Math.round(py * invEps) + '|' + Math.round(pz * invEps);
    var existing = map.get(key);
    if (existing !== undefined) {
      canonical[v] = existing;
    } else {
      canonical[v] = uniqueCount;
      map.set(key, uniqueCount);
      uxs.push(px); uys.push(py); uzs.push(pz);
      uniqueCount++;
    }
  }

  var unique = new Float32Array(uniqueCount * 3);
  for (var j = 0; j < uniqueCount; j++) {
    unique[j * 3]     = uxs[j];
    unique[j * 3 + 1] = uys[j];
    unique[j * 3 + 2] = uzs[j];
  }

  return {
    canonical:   canonical,
    unique:      unique,
    uniqueCount: uniqueCount,
    bbox:        { minX: minX, maxX: maxX, minY: minY, maxY: maxY, minZ: minZ, maxZ: maxZ },
    epsilon:     eps
  };
}

// Node.js (Jest) / Worker uyumu için global export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { veFEADedupVertices: veFEADedupVertices };
}
