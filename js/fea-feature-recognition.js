/**
 * FEA Yüzey Feature Recognition (Faz 6a)
 * ─────────────────────────────────────────────────────────────────
 * STL/STEP üçgen mesh'inden geometrik özellikler tespit eder:
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
// STL: her üçgen 3 vertex × 3 coord = 9 float (paylaşım yok).
// Komşuluk için canonical vertex index gerekli.
function _veFEABuildVertexIndex(vertices, bboxSize) {
  var n = vertices.length / 3;
  // Quantize: bbox'ın ~1e-6'sı kadar tolerans
  var eps = (bboxSize > 0 ? bboxSize : 1) * 1e-6;
  var invEps = 1 / eps;
  var map = new Map();
  var canonical = new Int32Array(n);
  var uniqueCount = 0;
  // Geçici uniqueVerts (flat) — sonunda Float32Array'e dönüştür
  var uxs = [], uys = [], uzs = [];
  for (var i = 0; i < n; i++) {
    var x = vertices[i * 3], y = vertices[i * 3 + 1], z = vertices[i * 3 + 2];
    var kx = Math.round(x * invEps);
    var ky = Math.round(y * invEps);
    var kz = Math.round(z * invEps);
    var key = kx + '|' + ky + '|' + kz;
    var idx = map.get(key);
    if (idx === undefined) {
      idx = uniqueCount++;
      map.set(key, idx);
      uxs.push(x); uys.push(y); uzs.push(z);
    }
    canonical[i] = idx;
  }
  var unique = new Float32Array(uniqueCount * 3);
  for (var j = 0; j < uniqueCount; j++) {
    unique[j * 3]     = uxs[j];
    unique[j * 3 + 1] = uys[j];
    unique[j * 3 + 2] = uzs[j];
  }
  return { canonical: canonical, unique: unique, uniqueCount: uniqueCount };
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
// parsed: { vertices, triangleCount } (STL/STEP parser çıktısı)
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
  // izin verilen max normal acisi. ANSYS-style default 30° — duz yuzeylerde
  // birlestirme (0° farkla), egri yuzeylerde tessellation segmentlerini birlestir
  // (silindir 32 seg = 11.25° aralik, kure 16 lon = 22.5°), ama keskin kenar
  // (genellikle 60°+) ayri kalir.
  var smoothCos = Math.cos((opts.smoothAngleDeg || 30) * Math.PI / 180);
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

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    veFEADetectGeometryFeatures: veFEADetectGeometryFeatures,
    veFEAFeatureTypeLabel: veFEAFeatureTypeLabel
  };
}
