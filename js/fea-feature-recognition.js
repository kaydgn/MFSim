/**
 * FEA Yüzey Feature Recognition (Faz 6a)
 * ─────────────────────────────────────────────────────────────────
 * STEP üçgen mesh'inden geometrik özellikler tespit eder:
 *
 *   - Üçgen normalleri + komşuluk grafiği
 *   - Smooth region clustering (BFS, normal açısı < threshold)
 *   - Her cluster için primitive fit:
 *       planar    → tek normal yön
 *       cylindrical → ortak eksen + sabit yarıçap
 *       spherical → ortak merkez
 *       conical   → ortak apex (koni)
 *       freeform  → yukarıdakilerden hiçbiri uymadı
 *   - Feature edge tespit (normal açısı > sharpThreshold → keskin kenar)
 *
 * Çıkış: yüzeyler dizisi + edge tipleri. Bu çıkış mesh stratejisi seçimi
 * (curvature-adaptive sizing, cylinder substitution vs.) için kullanılır.
 */

// ─── 1. Vertex deduplication (pozisyon hash'i) ────────────────────────────
// Tessellated mesh: her üçgen 3 vertex × 3 coord = 9 float (paylaşım yok).
// Komşuluk için canonical vertex index gerekli. Çekirdek algoritma
// fea-mesh-utils.js → veFEADedupVertices.
function _veFEABuildVertexIndex(vertices, bboxSize) {
  var r = veFEADedupVertices(vertices, { bboxSize: bboxSize });
  return { canonical: r.canonical, unique: r.unique, uniqueCount: r.uniqueCount };
}

// ─── 2. Üçgen normalleri + alanlar + centroidler ─────────────────────────
function _veFEAComputeTriangleData(vertices, triCount) {
  var normals = new Float32Array(triCount * 3);
  var areas = new Float32Array(triCount);
  var centroids = new Float32Array(triCount * 3);
  for (var t = 0; t < triCount; t++) {
    var o = t * 9;
    var ax = vertices[o],     ay = vertices[o + 1], az = vertices[o + 2];
    var bx = vertices[o + 3], by = vertices[o + 4], bz = vertices[o + 5];
    var cx = vertices[o + 6], cy = vertices[o + 7], cz = vertices[o + 8];
    // Cross (B-A)×(C-A)
    var ux = bx - ax, uy = by - ay, uz = bz - az;
    var vx = cx - ax, vy = cy - ay, vz = cz - az;
    var nx = uy * vz - uz * vy;
    var ny = uz * vx - ux * vz;
    var nz = ux * vy - uy * vx;
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

// ─── 3. Edge → triangle adjacency ────────────────────────────────────────
// Her üçgenin 3 kenarı için (canonical vertex pair) → komşu üçgen listesi.
// Sonuç: triangle adjacency (üçgen → 0-3 komşu) + edge tipi (sharp/smooth) bilgisi.
function _veFEABuildTriangleAdjacency(canonical, triCount, normals) {
  var edgeMap = new Map();
  // edgeMap: 'minId|maxId' → first triangle ID
  // İkinci tekrarda komşu bulduğumuzda ikisini birbirine bağla
  var neighbors = new Int32Array(triCount * 3);
  // -1 = boş slot
  for (var i = 0; i < neighbors.length; i++) neighbors[i] = -1;
  // Edge angle (cos): -2 = uninitialized
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
        // Bağlantı kur
        neighbors[t * 3 + e] = ex.tri;
        neighbors[ex.tri * 3 + ex.slot] = t;
        // Normal açısı
        var n1x = normals[t * 3],     n1y = normals[t * 3 + 1],     n1z = normals[t * 3 + 2];
        var n2x = normals[ex.tri * 3], n2y = normals[ex.tri * 3 + 1], n2z = normals[ex.tri * 3 + 2];
        var c = n1x * n2x + n1y * n2y + n1z * n2z;
        edgeAngles[t * 3 + e] = c;
        edgeAngles[ex.tri * 3 + ex.slot] = c;
        edgeMap.delete(key); // bellek tasarrufu
      }
    }
  }
  return { neighbors: neighbors, edgeAngles: edgeAngles };
}

// ─── 4. Smooth region clustering (BFS) ───────────────────────────────────
// Aynı smooth region: komşu kenardaki normal açısı < smoothThreshold.
// smoothThreshold default 5° (cos > 0.9962).
function _veFEAClusterSmoothRegions(adj, triCount, smoothCosThreshold) {
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
        // Edge angle (cos) kontrolü
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

// ─── 5. Cluster classification (primitive fitting) ───────────────────────
// Her cluster için:
//   - Toplam alan
//   - Ortalama normal + varyans
//   - Centroid
//   - Tip tespiti:
//       Normal varyans çok küçük → planar
//       Aksi takdirde: cylinder/sphere/cone fit dene; en iyi residual → tip
function _veFEAClassifyCluster(cluster, triData, planarVarianceLimit) {
  var ids = cluster.triangleIds;
  var n = ids.length;
  var totalArea = 0;
  var nxSum = 0, nySum = 0, nzSum = 0;
  var cxSum = 0, cySum = 0, czSum = 0;
  for (var i = 0; i < n; i++) {
    var t = ids[i];
    var w = triData.areas[t];
    totalArea += w;
    nxSum += triData.normals[t * 3]     * w;
    nySum += triData.normals[t * 3 + 1] * w;
    nzSum += triData.normals[t * 3 + 2] * w;
    cxSum += triData.centroids[t * 3]     * w;
    cySum += triData.centroids[t * 3 + 1] * w;
    czSum += triData.centroids[t * 3 + 2] * w;
  }
  if (totalArea < 1e-20) return { type: 'degenerate', area: 0, triangleIds: ids };
  var avgN = [nxSum / totalArea, nySum / totalArea, nzSum / totalArea];
  var lenN = Math.sqrt(avgN[0]*avgN[0] + avgN[1]*avgN[1] + avgN[2]*avgN[2]);
  var avgCentroid = [cxSum / totalArea, cySum / totalArea, czSum / totalArea];

  // Normal varyans (area-weighted): cluster içindeki tüm normal'lerin avgN'e göre
  // ne kadar saptıklarının ölçüsü. Düşük varyans → planar.
  var varN = 0;
  for (var j = 0; j < n; j++) {
    var t2 = ids[j];
    var dx = triData.normals[t2 * 3]     - avgN[0];
    var dy = triData.normals[t2 * 3 + 1] - avgN[1];
    var dz = triData.normals[t2 * 3 + 2] - avgN[2];
    varN += (dx * dx + dy * dy + dz * dz) * triData.areas[t2];
  }
  varN /= totalArea;

  // Düzlemsel: tüm normaller birbirine paralel → varN ≈ 0 (ve |avgN| ≈ 1)
  if (varN < planarVarianceLimit && lenN > 0.99) {
    return {
      type: 'planar',
      area: totalArea,
      normal: [avgN[0] / lenN, avgN[1] / lenN, avgN[2] / lenN],
      centroid: avgCentroid,
      triangleIds: ids
    };
  }

  // Cylinder fit: ortak eksen → SVD/PCA ile centroid'lerden eksen yönü
  // Hızlı yaklaşım: normal'lerin oluşturduğu kümeyle dik olan yön. Tüm normaller
  // bir düzlem üzerinde ise, o düzlemin normali silindir ekseni.
  // PCA: normaller matrisinin en küçük eigenvektörü = en az varyans yönü
  var cylFit = _veFEAFitCylinderToCluster(cluster, triData);
  if (cylFit && cylFit.residual < 0.05) {
    return {
      type: 'cylindrical',
      area: totalArea,
      axis: cylFit.axis,
      centroid: cylFit.center,
      radius: cylFit.radius,
      length: cylFit.length,
      residual: cylFit.residual,
      triangleIds: ids
    };
  }

  // Sphere fit: normaller centroid'lerden bir merkeze işaret eder.
  // Merkez = c_i - r * n_i (her üçgen için aynı). LSQ ile fit.
  var sphFit = _veFEAFitSphereToCluster(cluster, triData);
  if (sphFit && sphFit.residual < 0.05) {
    return {
      type: 'spherical',
      area: totalArea,
      center: sphFit.center,
      radius: sphFit.radius,
      residual: sphFit.residual,
      triangleIds: ids
    };
  }

  // Hiçbiri uymazsa freeform
  return {
    type: 'freeform',
    area: totalArea,
    normal: lenN > 1e-10 ? [avgN[0]/lenN, avgN[1]/lenN, avgN[2]/lenN] : [0,0,1],
    centroid: avgCentroid,
    normalVariance: varN,
    triangleIds: ids
  };
}

// ─── 6. Cylinder fitting (PCA-based) ─────────────────────────────────────
// Yaklaşım: normaller bir düzlemde yatıyorsa (silindir eksenine dik),
// PCA en küçük eigenvektör = eksen yönü. Centroid'ler eksen üzerinde projekte
// edildiğinde radial mesafe ≈ sabit ise gerçek silindir.
function _veFEAFitCylinderToCluster(cluster, triData) {
  var ids = cluster.triangleIds;
  var n = ids.length;
  if (n < 5) return null;
  // Normal matrisinin covariance (3x3) — area-weighted
  var c00 = 0, c01 = 0, c02 = 0, c11 = 0, c12 = 0, c22 = 0;
  var totalArea = 0;
  for (var i = 0; i < n; i++) {
    var t = ids[i];
    var w = triData.areas[t];
    var nx = triData.normals[t * 3], ny = triData.normals[t * 3 + 1], nz = triData.normals[t * 3 + 2];
    c00 += nx * nx * w; c01 += nx * ny * w; c02 += nx * nz * w;
    c11 += ny * ny * w; c12 += ny * nz * w;
    c22 += nz * nz * w;
    totalArea += w;
  }
  if (totalArea < 1e-20) return null;
  c00 /= totalArea; c01 /= totalArea; c02 /= totalArea;
  c11 /= totalArea; c12 /= totalArea; c22 /= totalArea;
  // En küçük eigenvalue + eigenvector (3×3 symmetric)
  var eig = _veFEASymmetric3x3Eigenvalues(c00, c01, c02, c11, c12, c22);
  // En küçük eigenvalue silindir ekseninin normal'lere katkısı (≈0 ise gerçek silindir)
  var minIdx = (eig.values[0] <= eig.values[1] && eig.values[0] <= eig.values[2]) ? 0
              : (eig.values[1] <= eig.values[2] ? 1 : 2);
  var minEig = eig.values[minIdx];
  if (minEig > 0.05) return null; // ekseninde "yapışmayan" yönlü
  var axis = eig.vectors[minIdx]; // eksen birim vektör
  // Centroid'ler axis-projection: her centroid (c-c_avg) · axis
  // Sonra radial mesafe r_i = |centroid - axisLine|
  var cxAvg = 0, cyAvg = 0, czAvg = 0;
  for (var i2 = 0; i2 < n; i2++) {
    var t2 = ids[i2];
    cxAvg += triData.centroids[t2 * 3];
    cyAvg += triData.centroids[t2 * 3 + 1];
    czAvg += triData.centroids[t2 * 3 + 2];
  }
  cxAvg /= n; cyAvg /= n; czAvg /= n;
  // Tüm centroid'ler için axis-perpendicular mesafe (silindir yarıçapı)
  var rSum = 0, rSqSum = 0;
  var axisProjMin = Infinity, axisProjMax = -Infinity;
  for (var i3 = 0; i3 < n; i3++) {
    var t3 = ids[i3];
    var dxc = triData.centroids[t3 * 3]     - cxAvg;
    var dyc = triData.centroids[t3 * 3 + 1] - cyAvg;
    var dzc = triData.centroids[t3 * 3 + 2] - czAvg;
    var alongAxis = dxc * axis[0] + dyc * axis[1] + dzc * axis[2];
    if (alongAxis < axisProjMin) axisProjMin = alongAxis;
    if (alongAxis > axisProjMax) axisProjMax = alongAxis;
    var perpX = dxc - alongAxis * axis[0];
    var perpY = dyc - alongAxis * axis[1];
    var perpZ = dzc - alongAxis * axis[2];
    var r = Math.sqrt(perpX * perpX + perpY * perpY + perpZ * perpZ);
    rSum += r;
    rSqSum += r * r;
  }
  var rMean = rSum / n;
  var rVar = rSqSum / n - rMean * rMean;
  // Residual: yarıçap varyansı / yarıçap²
  var residual = (rMean > 1e-10) ? Math.sqrt(Math.max(0, rVar)) / rMean : 1;
  return {
    axis: axis,
    center: [cxAvg, cyAvg, czAvg],
    radius: rMean,
    length: axisProjMax - axisProjMin,
    residual: residual
  };
}

// ─── 7. Sphere fitting (analytical least squares) ────────────────────────
// Üçgen centroid'leri ve normalleri kullanarak küre merkezi:
//   c_i = centroid_i - r * normal_i (eğer küre dış yüzeyse)
//   tüm c_i'ler aynı noktada (küre merkezinde) buluşmalı.
// LSQ ile merkez ve yarıçap bul.
function _veFEAFitSphereToCluster(cluster, triData) {
  var ids = cluster.triangleIds;
  var n = ids.length;
  if (n < 4) return null;
  // Her üçgen için: merkez = centroid - r * normal denkleminden 3 denklem.
  // Birleşik denklem: minimize Σ |c - centroid_i + r·normal_i|²
  // ∂/∂r = 0 → r = Σ (centroid_i - c)·normal_i / n
  // ∂/∂c_xyz = 0 → c_x = Σ centroid_i_x - r · Σ normal_i_x / n
  // İteratif fit
  var cxAvg = 0, cyAvg = 0, czAvg = 0;
  var nxAvg = 0, nyAvg = 0, nzAvg = 0;
  for (var i = 0; i < n; i++) {
    var t = ids[i];
    cxAvg += triData.centroids[t * 3];
    cyAvg += triData.centroids[t * 3 + 1];
    czAvg += triData.centroids[t * 3 + 2];
    nxAvg += triData.normals[t * 3];
    nyAvg += triData.normals[t * 3 + 1];
    nzAvg += triData.normals[t * 3 + 2];
  }
  cxAvg /= n; cyAvg /= n; czAvg /= n;
  nxAvg /= n; nyAvg /= n; nzAvg /= n;
  // İlk tahmin: r = centroid_avg ve normal_avg'in açısal projeksiyonu
  // Daha basit: r = ortalama (centroid_i - centroid_avg) · normal_i
  var rSigned = 0;
  for (var i2 = 0; i2 < n; i2++) {
    var t2 = ids[i2];
    var dx = triData.centroids[t2 * 3]     - cxAvg;
    var dy = triData.centroids[t2 * 3 + 1] - cyAvg;
    var dz = triData.centroids[t2 * 3 + 2] - czAvg;
    rSigned += dx * triData.normals[t2 * 3] + dy * triData.normals[t2 * 3 + 1] + dz * triData.normals[t2 * 3 + 2];
  }
  rSigned /= n;
  // Winding bagimsizligi: r isareti normal yonune bagli. Mutlak deger kullan.
  // (Mesh winding outward/inward fark etmez — kure her iki durumda da kure.)
  var r = Math.abs(rSigned);
  if (r < 1e-6) return null;
  // Merkez: c = centroid_avg - rSigned * normal_avg (isaretli rSigned ile dogru yon)
  var center = [cxAvg - rSigned * nxAvg, cyAvg - rSigned * nyAvg, czAvg - rSigned * nzAvg];
  // Residual: her uggenin merkeze mesafesi ile r arasindaki ortalama sapma
  var resSum = 0;
  for (var i3 = 0; i3 < n; i3++) {
    var t3 = ids[i3];
    var dxc = triData.centroids[t3 * 3]     - center[0];
    var dyc = triData.centroids[t3 * 3 + 1] - center[1];
    var dzc = triData.centroids[t3 * 3 + 2] - center[2];
    var dist = Math.sqrt(dxc*dxc + dyc*dyc + dzc*dzc);
    resSum += Math.abs(dist - r) / r;
  }
  var residual = resSum / n;
  return { center: center, radius: r, residual: residual };
}

// ─── 8. Symmetric 3×3 eigenvalues + eigenvectors ─────────────────────────
// Analitik: karakteristik polinom çözümü (Cardano).
// 3 reel kök (symmetric matrix garantisi).
function _veFEASymmetric3x3Eigenvalues(m00, m01, m02, m11, m12, m22) {
  // Invariants
  var I1 = m00 + m11 + m22;
  var I2 = m00 * m11 + m11 * m22 + m22 * m00 - m01 * m01 - m12 * m12 - m02 * m02;
  var I3 = m00 * m11 * m22 + 2 * m01 * m12 * m02 - m00 * m12 * m12 - m11 * m02 * m02 - m22 * m01 * m01;
  var p = I2 - I1 * I1 / 3;
  var q = (-2 * I1 * I1 * I1 + 9 * I1 * I2 - 27 * I3) / 27;
  var eigs = [0, 0, 0];
  if (Math.abs(p) < 1e-30) {
    eigs[0] = eigs[1] = eigs[2] = I1 / 3;
  } else {
    var theta = Math.acos(Math.max(-1, Math.min(1, -q / 2 / Math.sqrt(-p * p * p / 27))));
    var r = 2 * Math.sqrt(-p / 3);
    eigs[0] = I1 / 3 + r * Math.cos(theta / 3);
    eigs[1] = I1 / 3 + r * Math.cos((theta + 2 * Math.PI) / 3);
    eigs[2] = I1 / 3 + r * Math.cos((theta + 4 * Math.PI) / 3);
  }
  // Eigenvectorlar: her eigenvalue için (M - λI) v = 0
  // 3 satır arasinda en buyuk cross product magnitudune sahip cift kullanilir
  // (degenerate row durumlarinda dogru axis bulmak icin).
  var vecs = [];
  for (var k = 0; k < 3; k++) {
    var lam = eigs[k];
    var a = m00 - lam, b = m01, c = m02;
    var d = m01, e = m11 - lam, f = m12;
    var g = m02, hh = m12, ii = m22 - lam;
    // 3 satir x 3 satir kombinasyonu — 3 cross product
    var crosses = [
      [b*f - c*e, c*d - a*f, a*e - b*d],   // row1 × row2
      [b*ii - c*hh, c*g - a*ii, a*hh - b*g], // row1 × row3
      [e*ii - f*hh, f*g - d*ii, d*hh - e*g]  // row2 × row3
    ];
    // En buyuk magnitudeluyu sec
    var bestLen = 0, bestVec = [0, 0, 1];
    for (var ci = 0; ci < 3; ci++) {
      var vx = crosses[ci][0], vy = crosses[ci][1], vz = crosses[ci][2];
      var len = Math.sqrt(vx*vx + vy*vy + vz*vz);
      if (len > bestLen) { bestLen = len; bestVec = [vx/len, vy/len, vz/len]; }
    }
    vecs.push(bestVec);
  }
  return { values: eigs, vectors: vecs };
}

// ─── 9. Public API: tam feature recognition pipeline ─────────────────────
//
// parsed: { vertices, triangleCount } (STEP parser çıktısı)
// opts: { smoothAngleDeg: 5, sharpAngleDeg: 30, planarVarLimit: 0.001 }
//
// Çıkış:
//   {
//     features: [ {type, area, ..., triangleIds}, ... ],
//     totalArea, totalTriangles,
//     edgeStats: { sharp: N, smooth: M, total: T },
//     summary: { planar: c1, cylindrical: c2, spherical: c3, freeform: c4 }
//   }
function veFEADetectGeometryFeatures(parsed, opts) {
  opts = opts || {};
  if (!parsed || !parsed.vertices || !parsed.triangleCount) return null;
  // smoothAngleDeg: komsu uggenlerin ayni "smooth region"da olabilmesi icin
  // izin verilen max normal acisi. Default 50° — silindir/koni'yi N≥8'e kadar
  // dogru cluster eder (N=8 segment acisi = 45°), kutu kenarlarini (90°) ayri
  // tutmaya yetecek kadar dusuk. Ondan once 30° idi; bu nedenle N=8/16 gibi
  // dusuk-segment silindirler birden cok 'planar' cluster'a bolunup
  // recognition basarisiz oluyordu (kullaniciya kubik voxel ile sonuclanan
  // duruma yol aciyor).
  var smoothCos = Math.cos((opts.smoothAngleDeg || 50) * Math.PI / 180);
  // sharpAngleDeg: edge tipi etiketleme — 45°+ olan kenarlar "keskin" sayilir.
  var sharpCos = Math.cos((opts.sharpAngleDeg || 45) * Math.PI / 180);
  var planarVarLimit = (opts.planarVarLimit !== undefined) ? opts.planarVarLimit : 0.001;
  var vertices = parsed.vertices;
  var triCount = parsed.triangleCount;

  // BBox
  var minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity, minZ = Infinity, maxZ = -Infinity;
  for (var i = 0; i < vertices.length; i += 3) {
    if (vertices[i]     < minX) minX = vertices[i];     if (vertices[i]     > maxX) maxX = vertices[i];
    if (vertices[i + 1] < minY) minY = vertices[i + 1]; if (vertices[i + 1] > maxY) maxY = vertices[i + 1];
    if (vertices[i + 2] < minZ) minZ = vertices[i + 2]; if (vertices[i + 2] > maxZ) maxZ = vertices[i + 2];
  }
  var bboxSize = Math.max(maxX - minX, maxY - minY, maxZ - minZ);

  // Vertex deduplication + triangle data
  var vIdx = _veFEABuildVertexIndex(vertices, bboxSize);
  var triData = _veFEAComputeTriangleData(vertices, triCount);
  // Edge adjacency
  var adj = _veFEABuildTriangleAdjacency(vIdx.canonical, triCount, triData.normals);
  // Smooth clustering
  var clustered = _veFEAClusterSmoothRegions(adj, triCount, smoothCos);
  // Cluster classification
  var features = [];
  for (var c = 0; c < clustered.clusters.length; c++) {
    var feat = _veFEAClassifyCluster(clustered.clusters[c], triData, planarVarLimit);
    feat.id = c;
    features.push(feat);
  }
  // Edge statistics
  var sharpEdges = 0, smoothEdges = 0, totalEdges = 0;
  for (var t = 0; t < triCount; t++) {
    for (var e = 0; e < 3; e++) {
      var nb = adj.neighbors[t * 3 + e];
      if (nb < 0 || nb < t) continue; // double-count engelle
      totalEdges++;
      var ca = adj.edgeAngles[t * 3 + e];
      if (ca < sharpCos) sharpEdges++;
      else smoothEdges++;
    }
  }
  // Summary
  var summary = { planar: 0, cylindrical: 0, spherical: 0, conical: 0, freeform: 0, degenerate: 0 };
  var totalArea = 0;
  for (var k = 0; k < features.length; k++) {
    var f = features[k];
    summary[f.type] = (summary[f.type] || 0) + 1;
    totalArea += f.area || 0;
  }
  return {
    features: features,
    totalArea: totalArea,
    totalTriangles: triCount,
    uniqueVertices: vIdx.uniqueCount,
    edgeStats: { sharp: sharpEdges, smooth: smoothEdges, total: totalEdges },
    summary: summary,
    bbox: { min: [minX, minY, minZ], max: [maxX, maxY, maxZ], size: bboxSize }
  };
}

// Tipler için kısa etiket (UI'da kullanılır)
function veFEAFeatureTypeLabel(type) {
  return ({
    'planar':      'Düzlemsel',
    'cylindrical': 'Silindirik',
    'spherical':   'Küresel',
    'conical':     'Konik',
    'freeform':    'Serbest Form',
    'degenerate':  'Dejenere'
  })[type] || type;
}

// ─── 10. Primitif Çıkarımı (Inference) ─────────────────────────────────────
// Tespit edilen feature setinden tam bir primitif tipinin uyup uymadığını
// kontrol et. Eşleşen pattern bulunursa, primitif parametreleri + uzaysal
// dönüşüm (rotasyon + öteleme) döner.
//
// Pattern'ler:
//   - Sphere:   1 baskın spherical feature
//   - Cylinder: 1 cylindrical + 2 planar (eksen perpendikülü kapaklar)
//   - Box:      6 planar (3 çift karşılıklı, ortogonal eksenler)
//   - Hemisphere: 1 spherical + 1 planar (düz disk)
//
// Çıkış:
//   {
//     type: 'cylinder' | 'sphere' | 'box' | ...,
//     params: { radius, height, ... },   // primitif mesher icin
//     transform: {                        // mesh sonrasi uygulanacak donusum
//       center: [x, y, z],                // oteleme
//       axis: [x, y, z]                   // primitive'in birincil ekseninin
//                                         // hedef yonu (cylinder/cone icin)
//     },
//     confidence: 0..1                    // pattern uyma derecesi
//   }
//
// Eşleşmezse null.
function veFEAInferPrimitiveFromFeatures(detectedFeatures, bboxObj) {
  if (!detectedFeatures || !detectedFeatures.features) return null;
  var features = detectedFeatures.features;
  // Toplam alan + onemli feature filtreleme (alan > toplam %1)
  var totalArea = 0;
  features.forEach(function (f) { totalArea += f.area || 0; });
  if (totalArea < 1e-10) return null;
  var significant = features.filter(function (f) { return (f.area || 0) > totalArea * 0.01; });
  if (significant.length === 0) return null;

  var planar = significant.filter(function (f) { return f.type === 'planar'; });
  var cyls   = significant.filter(function (f) { return f.type === 'cylindrical'; });
  var sphs   = significant.filter(function (f) { return f.type === 'spherical'; });

  // ─── Sphere pattern ─────────────────────────────────────────────────
  // 1 spherical + (opsiyonel olarak 0 düzlemsel)
  if (sphs.length === 1 && planar.length === 0 && cyls.length === 0) {
    var s = sphs[0];
    return {
      type: 'sphere',
      params: { radius: s.radius },
      transform: { center: s.center.slice(), axis: [0, 1, 0] },
      confidence: 1 - (s.residual || 0)
    };
  }

  // ─── Hemisphere pattern ──────────────────────────────────────────────
  // 1 spherical + 1 planar (düz disk, sphere merkezinden geçer)
  if (sphs.length === 1 && planar.length === 1 && cyls.length === 0) {
    var s2 = sphs[0];
    var p = planar[0];
    // Disk normalini sphere center'dan p.centroid'e olan vektorle karsilastir
    return {
      type: 'hemisphere',
      params: { radius: s2.radius },
      transform: { center: s2.center.slice(), axis: p.normal.slice() },
      confidence: 1 - (s2.residual || 0)
    };
  }

  // ─── Cylinder pattern ────────────────────────────────────────────────
  // 1 cylindrical + 2 planar (kapaklar, normalleri eksene paralel)
  if (cyls.length === 1 && planar.length === 2 && sphs.length === 0) {
    var c = cyls[0];
    var axis = c.axis;
    var cap0 = planar[0], cap1 = planar[1];
    var dot0 = Math.abs(axis[0]*cap0.normal[0] + axis[1]*cap0.normal[1] + axis[2]*cap0.normal[2]);
    var dot1 = Math.abs(axis[0]*cap1.normal[0] + axis[1]*cap1.normal[1] + axis[2]*cap1.normal[2]);
    if (dot0 > 0.95 && dot1 > 0.95) {
      // Yukseklik = kapaklar arasi eksen-projeksiyon mesafesi
      var dx = cap0.centroid[0] - cap1.centroid[0];
      var dy = cap0.centroid[1] - cap1.centroid[1];
      var dz = cap0.centroid[2] - cap1.centroid[2];
      var height = Math.abs(dx * axis[0] + dy * axis[1] + dz * axis[2]);
      // Cylinder merkezi: 2 kapağın centroid ortalaması
      var center = [
        (cap0.centroid[0] + cap1.centroid[0]) / 2,
        (cap0.centroid[1] + cap1.centroid[1]) / 2,
        (cap0.centroid[2] + cap1.centroid[2]) / 2
      ];
      return {
        type: 'cylinder',
        params: { radius: c.radius, height: height },
        transform: { center: center, axis: axis.slice() },
        confidence: 1 - (c.residual || 0)
      };
    }
  }

  // ─── Shaft (içi boş silindir) pattern ────────────────────────────────
  // 2 cylindrical (dış + iç) + 2 planar (annular kapaklar)
  if (cyls.length === 2 && planar.length === 2 && sphs.length === 0) {
    var c0 = cyls[0], c1 = cyls[1];
    // İki silindirin eksenleri paralel mi?
    var axDot = Math.abs(c0.axis[0]*c1.axis[0] + c0.axis[1]*c1.axis[1] + c0.axis[2]*c1.axis[2]);
    if (axDot > 0.95) {
      var rOut = Math.max(c0.radius, c1.radius);
      var rIn  = Math.min(c0.radius, c1.radius);
      var capA = planar[0], capB = planar[1];
      var axS = c0.axis;
      var dxS = capA.centroid[0] - capB.centroid[0];
      var dyS = capA.centroid[1] - capB.centroid[1];
      var dzS = capA.centroid[2] - capB.centroid[2];
      var length = Math.abs(dxS * axS[0] + dyS * axS[1] + dzS * axS[2]);
      var center2 = [
        (capA.centroid[0] + capB.centroid[0]) / 2,
        (capA.centroid[1] + capB.centroid[1]) / 2,
        (capA.centroid[2] + capB.centroid[2]) / 2
      ];
      return {
        type: 'shaft',
        params: { outerRadius: rOut, innerRadius: rIn, length: length },
        transform: { center: center2, axis: axS.slice() },
        confidence: Math.min(1 - (c0.residual || 0), 1 - (c1.residual || 0))
      };
    }
  }

  // ─── Box pattern (axis-aligned) ──────────────────────────────────────
  // 6 planar + 3 karsi cift + 3 ortogonal eksen
  if (planar.length === 6 && cyls.length === 0 && sphs.length === 0 && significant.length === 6) {
    return _veFEAInferBox(planar, bboxObj);
  }

  return null;
}

function _veFEAInferBox(planar, bboxObj) {
  // 6 planar'in karşılıklı çiftlerini eşle (normaller ters yönlü)
  var matched = [false, false, false, false, false, false];
  var pairs = [];
  for (var i = 0; i < 6; i++) {
    if (matched[i]) continue;
    var ni = planar[i].normal;
    for (var j = i + 1; j < 6; j++) {
      if (matched[j]) continue;
      var nj = planar[j].normal;
      var dot = ni[0]*nj[0] + ni[1]*nj[1] + ni[2]*nj[2];
      if (dot < -0.95) {
        pairs.push([planar[i], planar[j]]);
        matched[i] = true; matched[j] = true;
        break;
      }
    }
  }
  if (pairs.length !== 3) return null;
  // 3 ekseni topla, mutually orthogonal mi?
  var axes = pairs.map(function (pr) {
    // İlk yüzeyin normalini "pozitif" eksen yönü olarak al
    return pr[0].normal.slice();
  });
  var d01 = Math.abs(axes[0][0]*axes[1][0] + axes[0][1]*axes[1][1] + axes[0][2]*axes[1][2]);
  var d02 = Math.abs(axes[0][0]*axes[2][0] + axes[0][1]*axes[2][1] + axes[0][2]*axes[2][2]);
  var d12 = Math.abs(axes[1][0]*axes[2][0] + axes[1][1]*axes[2][1] + axes[1][2]*axes[2][2]);
  if (d01 > 0.05 || d02 > 0.05 || d12 > 0.05) return null; // ortogonal değil
  // Her çift için: kenarlar arası mesafe = boyut
  var sizes = pairs.map(function (pr) {
    var dx = pr[0].centroid[0] - pr[1].centroid[0];
    var dy = pr[0].centroid[1] - pr[1].centroid[1];
    var dz = pr[0].centroid[2] - pr[1].centroid[2];
    var n = pr[0].normal;
    return Math.abs(dx * n[0] + dy * n[1] + dz * n[2]);
  });
  // Box merkezi: tüm 6 centroid ortalamasi
  var cx = 0, cy = 0, cz = 0;
  for (var k = 0; k < 6; k++) {
    cx += planar[k].centroid[0];
    cy += planar[k].centroid[1];
    cz += planar[k].centroid[2];
  }
  cx /= 6; cy /= 6; cz /= 6;
  // Axis-aligned ise eksenleri ±X, ±Y, ±Z'ye eşle.
  // axes[i] = i'nci eksenin yönü. Hangi global eksene en yakın?
  function _dominantAxis(v) {
    var ax = Math.abs(v[0]), ay = Math.abs(v[1]), az = Math.abs(v[2]);
    if (ax >= ay && ax >= az) return 0;
    if (ay >= az) return 1;
    return 2;
  }
  var domA = _dominantAxis(axes[0]);
  var domB = _dominantAxis(axes[1]);
  var domC = _dominantAxis(axes[2]);
  // 3 farklı eksene gidiyor mu? (0,1,2 in some order)
  var uniqueDoms = new Set([domA, domB, domC]);
  if (uniqueDoms.size !== 3) return null; // axis-aligned değil
  // Sirala: 0→width(X), 1→height(Y), 2→depth(Z)
  var w = 0, h = 0, d = 0;
  if (domA === 0) w = sizes[0]; else if (domA === 1) h = sizes[0]; else d = sizes[0];
  if (domB === 0) w = sizes[1]; else if (domB === 1) h = sizes[1]; else d = sizes[1];
  if (domC === 0) w = sizes[2]; else if (domC === 1) h = sizes[2]; else d = sizes[2];
  return {
    type: 'box',
    params: { width: w, height: h, depth: d },
    transform: { center: [cx, cy, cz], axis: [0, 1, 0] },
    confidence: 1.0
  };
}

// Tespit edilen primitif tipi için kullanıcı dostu mesaj
function veFEAInferredPrimitiveLabel(inferred) {
  if (!inferred) return null;
  var t = inferred.type;
  var p = inferred.params;
  if (t === 'box')      return 'Kutu (' + p.width.toFixed(1) + ' × ' + p.height.toFixed(1) + ' × ' + p.depth.toFixed(1) + ' mm)';
  if (t === 'cylinder') return 'Silindir (R=' + p.radius.toFixed(1) + ', H=' + p.height.toFixed(1) + ' mm)';
  if (t === 'sphere')   return 'Küre (R=' + p.radius.toFixed(1) + ' mm)';
  if (t === 'hemisphere') return 'Yarım Küre (R=' + p.radius.toFixed(1) + ' mm)';
  if (t === 'shaft')    return 'Şaft (R_dış=' + p.outerRadius.toFixed(1) + ', R_iç=' + p.innerRadius.toFixed(1) + ', L=' + p.length.toFixed(1) + ' mm)';
  return t;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    veFEADetectGeometryFeatures: veFEADetectGeometryFeatures,
    veFEAFeatureTypeLabel: veFEAFeatureTypeLabel,
    veFEAInferPrimitiveFromFeatures: veFEAInferPrimitiveFromFeatures,
    veFEAInferredPrimitiveLabel: veFEAInferredPrimitiveLabel
  };
}
