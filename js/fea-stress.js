/**
 * FEA Stress Recovery + von Mises (Faz 5 — Sonuc Hesaplama)
 * ─────────────────────────────────────────────────────────────────
 * Cozumden sonra elde edilen u (deplasman) vektorunden:
 *   ε = B · u   (element-level, Gauss point'te)
 *   σ = D · ε   (Cauchy stress, izotropik için)
 *
 * Gauss point sonuçları node'lara extrapolated veya averaged.
 * Klasik yaklaşım: her node için kendisine komşu element'lerin
 * en yakın Gauss point gerilmesini toparlama (nodal averaging).
 *
 * von Mises stress:
 *   σ_VM = √(½ · ((σ1−σ2)² + (σ2−σ3)² + (σ3−σ1)²))
 *        veya Cauchy bilesenlerinden:
 *   σ_VM = √( (σxx−σyy)² + (σyy−σzz)² + (σzz−σxx)²
 *           + 6·(σxy² + σyz² + σxz²) ) / √2
 *
 * Sonuç: nodal von Mises array, max/min, asal gerilmeler.
 */

// ─── 1. Element Gauss-point gerilmeleri ──────────────────────────────────
// Bir elementin 8 Gauss point'inde σ = D·B·u_e hesapla.
// u_e: Float64Array(24) — element node deplasmanları
//
// Çıkış: Float64Array(8*6) — 8 GP × 6 stress component (Voigt sırası)
function veFEAHex8ComputeElementStresses(nodeCoords, u_e, D) {
  if (!nodeCoords || !u_e || !D) return null;
  var g = 1 / Math.sqrt(3);
  var gpts = [
    [-g,-g,-g],[g,-g,-g],[g,g,-g],[-g,g,-g],
    [-g,-g,g],[g,-g,g],[g,g,g],[-g,g,g]
  ];
  var out = new Float64Array(8 * 6);
  for (var gp = 0; gp < 8; gp++) {
    var pt = gpts[gp];
    var jac = veFEAHex8JacobianAtGaussPoint(nodeCoords, pt[0], pt[1], pt[2]);
    if (!jac) continue;
    var B = veFEAHex8StrainDisplacementB(jac.dNdx);
    // ε = B · u_e (6×24 · 24 = 6)
    var eps = new Float64Array(6);
    for (var r = 0; r < 6; r++) {
      var s = 0;
      for (var c = 0; c < 24; c++) s += B[r * 24 + c] * u_e[c];
      eps[r] = s;
    }
    // σ = D · ε (6×6 · 6 = 6)
    for (var ri = 0; ri < 6; ri++) {
      var ss = 0;
      for (var ci = 0; ci < 6; ci++) ss += D[ri * 6 + ci] * eps[ci];
      out[gp * 6 + ri] = ss;
    }
  }
  return out;
}

// ─── 2. von Mises stress (Voigt 6-bileşenden) ────────────────────────────
function veFEAVonMisesFromCauchy(sigma6) {
  var sxx = sigma6[0], syy = sigma6[1], szz = sigma6[2];
  var sxy = sigma6[3], syz = sigma6[4], sxz = sigma6[5];
  var devXX = sxx - syy;
  var devYY = syy - szz;
  var devZZ = szz - sxx;
  var sq = devXX * devXX + devYY * devYY + devZZ * devZZ + 6 * (sxy * sxy + syz * syz + sxz * sxz);
  return Math.sqrt(sq / 2);
}

// ─── 3. Asal gerilmeler (eigenvalues of 3×3 stress tensor) ───────────────
// Cauchy tensor:
//   [σxx σxy σxz]
//   [σxy σyy σyz]
//   [σxz σyz σzz]
// Eigenvalueları büyükten küçüğe sıralı döner: [σ1, σ2, σ3]
//
// Direct karakteristik polinom çözümü (analytical) — symmetric 3×3:
// I1 = trace, I2 = (trace²−trace(σ²))/2, I3 = det
// Üçüncü dereceden polinom, üç gerçek kök (sembolik formül).
function veFEAPrincipalStresses(sigma6) {
  var sxx = sigma6[0], syy = sigma6[1], szz = sigma6[2];
  var sxy = sigma6[3], syz = sigma6[4], sxz = sigma6[5];
  // Invariants
  var I1 = sxx + syy + szz;
  var I2 = sxx * syy + syy * szz + szz * sxx - sxy * sxy - syz * syz - sxz * sxz;
  var I3 = sxx * syy * szz + 2 * sxy * syz * sxz - sxx * syz * syz - syy * sxz * sxz - szz * sxy * sxy;
  // Karakteristik polinom: λ³ − I1·λ² + I2·λ − I3 = 0
  // λ = y + I1/3 dönüşümü ile depressed cubic: y³ + p·y + q = 0
  //   p = I2 − I1²/3
  //   q = (−2·I1³ + 9·I1·I2 − 27·I3) / 27
  var p = I2 - I1 * I1 / 3;
  var q = (-2 * I1 * I1 * I1 + 9 * I1 * I2 - 27 * I3) / 27;
  var D = q * q / 4 + p * p * p / 27;
  if (Math.abs(p) < 1e-30) {
    // Degenerate: 3 katlı kök
    var v = Math.cbrt(-q);
    return [I1 / 3 + v, I1 / 3, I1 / 3 - v].sort(function (a, b) { return b - a; });
  }
  if (D > 1e-12) {
    // Bir gerçek + iki kompleks kök → sadece bir kullanılabilir (nadiren oluşur,
    // simetrik tensör icin uygulanmaz). Düşmek için 3 eşit kök gibi davran.
    var realRoot = Math.cbrt(-q / 2 + Math.sqrt(D)) + Math.cbrt(-q / 2 - Math.sqrt(D));
    return [I1 / 3 + realRoot, I1 / 3, I1 / 3];
  }
  // D ≤ 0: üç gerçek kök (klasik durum)
  var theta = Math.acos(Math.max(-1, Math.min(1, -q / 2 / Math.sqrt(-p * p * p / 27))));
  var r = 2 * Math.sqrt(-p / 3);
  var L1 = I1 / 3 + r * Math.cos(theta / 3);
  var L2 = I1 / 3 + r * Math.cos((theta + 2 * Math.PI) / 3);
  var L3 = I1 / 3 + r * Math.cos((theta + 4 * Math.PI) / 3);
  return [L1, L2, L3].sort(function (a, b) { return b - a; });
}

// ─── 4. Element gerilmelerinden nodal averaging ──────────────────────────
// Her node için: kendi olduğu tüm elementlerin yakın Gauss point'lerinin
// stress'ini ortalayarak nodal stress elde et.
//
// Hex8 nodes 0..7 ↔ Gauss point 0..7 (aynı pozisyonel sırada — ξ,η,ζ işaretleri eşleşir)
//
// Çıkış: { nodalStress: Float64Array(nNode*6), vonMises: Float64Array(nNode),
//          principal: Float64Array(nNode*3), maxVM, maxVMNode }
function veFEAHex8ComputeNodalStresses(mesh, u, material) {
  if (!mesh || mesh.type !== 'hex8' || !u || !material) return null;
  var D = veFEAElasticityMatrix(material);
  if (!D) return null;

  var nodes = mesh.nodes;
  var elements = mesh.elements;
  var nodeCount = nodes.length / 3;
  var nElem = elements.length / 8;

  var nodalStress = new Float64Array(nodeCount * 6);
  var nodalCounts = new Int32Array(nodeCount); // her node kaç elementin etkisi altında

  var nc = new Float64Array(24);
  var u_e = new Float64Array(24);

  for (var e = 0; e < nElem; e++) {
    var off = e * 8;
    // Element node koord ve deplasman
    for (var i = 0; i < 8; i++) {
      var n = elements[off + i];
      nc[i * 3]     = nodes[n * 3];
      nc[i * 3 + 1] = nodes[n * 3 + 1];
      nc[i * 3 + 2] = nodes[n * 3 + 2];
      u_e[i * 3]     = u[n * 3];
      u_e[i * 3 + 1] = u[n * 3 + 1];
      u_e[i * 3 + 2] = u[n * 3 + 2];
    }
    var stresses = veFEAHex8ComputeElementStresses(nc, u_e, D);
    if (!stresses) continue;
    // Her hex node i ↔ Gauss point i (positional correspondence)
    for (var ii = 0; ii < 8; ii++) {
      var nn = elements[off + ii];
      var stressOff = ii * 6;
      var nodalOff  = nn * 6;
      for (var c2 = 0; c2 < 6; c2++) nodalStress[nodalOff + c2] += stresses[stressOff + c2];
      nodalCounts[nn]++;
    }
  }

  // Averaging
  for (var ni = 0; ni < nodeCount; ni++) {
    var cnt = nodalCounts[ni];
    if (cnt === 0) continue;
    var oo = ni * 6;
    for (var k = 0; k < 6; k++) nodalStress[oo + k] /= cnt;
  }

  // von Mises + asal gerilmeler
  var vonMises = new Float64Array(nodeCount);
  var principal = new Float64Array(nodeCount * 3);
  var maxVM = 0, maxVMNode = 0;
  var sig6 = new Float64Array(6);
  for (var nj = 0; nj < nodeCount; nj++) {
    var off2 = nj * 6;
    for (var c3 = 0; c3 < 6; c3++) sig6[c3] = nodalStress[off2 + c3];
    var vm = veFEAVonMisesFromCauchy(sig6);
    vonMises[nj] = vm;
    if (vm > maxVM) { maxVM = vm; maxVMNode = nj; }
    var prin = veFEAPrincipalStresses(sig6);
    principal[nj * 3]     = prin[0];
    principal[nj * 3 + 1] = prin[1];
    principal[nj * 3 + 2] = prin[2];
  }

  return {
    nodalStress: nodalStress,
    vonMises: vonMises,
    principal: principal,
    maxVM: maxVM,
    maxVMNode: maxVMNode
  };
}

// ─── 5. Deplasman büyüklüğü (magnitude) ──────────────────────────────────
function veFEAComputeDisplacementMagnitudes(u) {
  var n = u.length / 3;
  var mags = new Float64Array(n);
  var maxMag = 0, maxNode = 0;
  for (var i = 0; i < n; i++) {
    var ux = u[i * 3], uy = u[i * 3 + 1], uz = u[i * 3 + 2];
    var m = Math.sqrt(ux * ux + uy * uy + uz * uz);
    mags[i] = m;
    if (m > maxMag) { maxMag = m; maxNode = i; }
  }
  return { mags: mags, maxMag: maxMag, maxNode: maxNode };
}

// ─── 6. Sonuçları özet rapor ─────────────────────────────────────────────
function veFEABuildResultSummary(mesh, u, material, results) {
  var disp = veFEAComputeDisplacementMagnitudes(u);
  var maxVM = results.maxVM;
  var fos = veFEAYieldSafetyFactor(material, maxVM);

  // Toplam kütle
  var totalVol = 0;
  if (mesh && mesh.type === 'hex8') {
    var nodes = mesh.nodes, elements = mesh.elements;
    var nc = new Float64Array(24);
    var g = 1 / Math.sqrt(3);
    var gpts = [
      [-g,-g,-g],[g,-g,-g],[g,g,-g],[-g,g,-g],
      [-g,-g,g],[g,-g,g],[g,g,g],[-g,g,g]
    ];
    for (var e = 0; e < elements.length / 8; e++) {
      for (var i = 0; i < 8; i++) {
        var n = elements[e * 8 + i];
        nc[i * 3]     = nodes[n * 3];
        nc[i * 3 + 1] = nodes[n * 3 + 1];
        nc[i * 3 + 2] = nodes[n * 3 + 2];
      }
      for (var gp = 0; gp < 8; gp++) {
        var jac = veFEAHex8JacobianAtGaussPoint(nc, gpts[gp][0], gpts[gp][1], gpts[gp][2]);
        if (jac) totalVol += jac.detJ;
      }
    }
  }
  var totalMass = veFEAMaterialMass(material, totalVol);

  // Maks asal gerilmeler
  var maxPrincipal = -Infinity, minPrincipal = Infinity;
  for (var ni = 0; ni < results.principal.length / 3; ni++) {
    if (results.principal[ni * 3]     > maxPrincipal) maxPrincipal = results.principal[ni * 3];
    if (results.principal[ni * 3 + 2] < minPrincipal) minPrincipal = results.principal[ni * 3 + 2];
  }

  return {
    maxVonMises: maxVM,                     // MPa
    maxDisplacement: disp.maxMag,           // mm
    maxPrincipalStress: maxPrincipal,       // MPa
    minPrincipalStress: minPrincipal,       // MPa
    safetyFactor: fos,
    totalMass: totalMass,                   // kg
    totalVolume: totalVol                   // mm³
  };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    veFEAHex8ComputeElementStresses: veFEAHex8ComputeElementStresses,
    veFEAVonMisesFromCauchy: veFEAVonMisesFromCauchy,
    veFEAPrincipalStresses: veFEAPrincipalStresses,
    veFEAHex8ComputeNodalStresses: veFEAHex8ComputeNodalStresses,
    veFEAComputeDisplacementMagnitudes: veFEAComputeDisplacementMagnitudes,
    veFEABuildResultSummary: veFEABuildResultSummary
  };
}
