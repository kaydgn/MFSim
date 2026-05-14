/**
 * FEA Çözücü (Faz 5 — Lineer Statik Yapısal Analiz)
 * ─────────────────────────────────────────────────────────────────
 * [K]·{u} = {F}  → izotropik elastik Hex8 eleman tipinde.
 *
 * Bu dosya 4 ana parçadan oluşur:
 *   1) Hex8 shape functions, derivatifler, Jacobian — element-level
 *   2) Element stiffness K_e (8-point Gauss quadrature)
 *   3) Global K assembly (sparse CSR formatında)
 *   4) BC enforcement (penalty veya elimination) + PCG çözücü
 *
 * Stress recovery ve von Mises ayrı dosyada (fea-stress.js).
 *
 * Birimler:
 *   - Düğüm koordinatları: mm
 *   - E (Young's modulus): MPa = N/mm²
 *   - Stress: MPa
 *   - Force: N
 *   - Displacement: mm
 *   - K matrisi: N/mm
 *
 * (mm + N + MPa tutarlı bir SI alt-birim ailesidir.)
 */

// ─── 1. Hex8 Shape Functions ─────────────────────────────────────────────
// Doğal koordinatlar (ξ, η, ζ) ∈ [−1, +1]³
// Hex8 düğüm sırası (Abaqus / ANSYS):
//   N0 = (−1,−1,−1)   N4 = (−1,−1,+1)
//   N1 = (+1,−1,−1)   N5 = (+1,−1,+1)
//   N2 = (+1,+1,−1)   N6 = (+1,+1,+1)
//   N3 = (−1,+1,−1)   N7 = (−1,+1,+1)
//
// Shape function: N_i(ξ,η,ζ) = (1/8)(1+ξ_i·ξ)(1+η_i·η)(1+ζ_i·ζ)

var _VE_FEA_HEX8_XI = [-1, +1, +1, -1, -1, +1, +1, -1];
var _VE_FEA_HEX8_ETA = [-1, -1, +1, +1, -1, -1, +1, +1];
var _VE_FEA_HEX8_ZETA = [-1, -1, -1, -1, +1, +1, +1, +1];

function veFEAHex8ShapeFunctions(xi, eta, zeta) {
  var N = new Float64Array(8);
  for (var i = 0; i < 8; i++) {
    N[i] = 0.125 *
      (1 + _VE_FEA_HEX8_XI[i] * xi) *
      (1 + _VE_FEA_HEX8_ETA[i] * eta) *
      (1 + _VE_FEA_HEX8_ZETA[i] * zeta);
  }
  return N;
}

// dN_i/dξ, dN_i/dη, dN_i/dζ — natural coords türevleri (8×3)
function veFEAHex8ShapeFunctionDerivativesNatural(xi, eta, zeta) {
  var dN = new Float64Array(8 * 3);
  for (var i = 0; i < 8; i++) {
    var xi_i  = _VE_FEA_HEX8_XI[i];
    var eta_i = _VE_FEA_HEX8_ETA[i];
    var zeta_i = _VE_FEA_HEX8_ZETA[i];
    var k = i * 3;
    dN[k]     = 0.125 * xi_i  * (1 + eta_i * eta) * (1 + zeta_i * zeta);
    dN[k + 1] = 0.125 * eta_i * (1 + xi_i  * xi)  * (1 + zeta_i * zeta);
    dN[k + 2] = 0.125 * zeta_i * (1 + xi_i * xi)  * (1 + eta_i  * eta);
  }
  return dN;
}

// ─── 2. Jacobian + dN/dx (global koordinat türevleri) ────────────────────
// Jacobian: J = dN/dξ · X (3×3)
// dN/dx = J⁻¹ · dN/dξ
// detJ → integration weight çarpanı
//
// nodeCoords: Float64Array(24) — 8 düğümün x,y,z'si (sırayla)
// Çıkış: { dNdx (8×3), detJ }
function veFEAHex8JacobianAtGaussPoint(nodeCoords, xi, eta, zeta) {
  var dN = veFEAHex8ShapeFunctionDerivativesNatural(xi, eta, zeta);
  // Jacobian J = (dN/dξ) · X   →   J_ij = Σ_k dN_k/dξ_i · X_kj
  var J = new Float64Array(9);
  for (var k = 0; k < 8; k++) {
    var nx = nodeCoords[k * 3];
    var ny = nodeCoords[k * 3 + 1];
    var nz = nodeCoords[k * 3 + 2];
    // dN_k/dxi, dN_k/deta, dN_k/dzeta
    var dxi   = dN[k * 3];
    var deta  = dN[k * 3 + 1];
    var dzeta = dN[k * 3 + 2];
    J[0] += dxi   * nx;
    J[1] += dxi   * ny;
    J[2] += dxi   * nz;
    J[3] += deta  * nx;
    J[4] += deta  * ny;
    J[5] += deta  * nz;
    J[6] += dzeta * nx;
    J[7] += dzeta * ny;
    J[8] += dzeta * nz;
  }
  // detJ = J[0]·(J[4]·J[8] − J[5]·J[7]) − J[1]·(J[3]·J[8] − J[5]·J[6]) + J[2]·(J[3]·J[7] − J[4]·J[6])
  var detJ = J[0] * (J[4] * J[8] - J[5] * J[7])
           - J[1] * (J[3] * J[8] - J[5] * J[6])
           + J[2] * (J[3] * J[7] - J[4] * J[6]);
  if (Math.abs(detJ) < 1e-20) return null;
  var invDet = 1 / detJ;
  // J⁻¹ (3×3, row-major)
  var Jinv = new Float64Array(9);
  Jinv[0] =  (J[4] * J[8] - J[5] * J[7]) * invDet;
  Jinv[1] = -(J[1] * J[8] - J[2] * J[7]) * invDet;
  Jinv[2] =  (J[1] * J[5] - J[2] * J[4]) * invDet;
  Jinv[3] = -(J[3] * J[8] - J[5] * J[6]) * invDet;
  Jinv[4] =  (J[0] * J[8] - J[2] * J[6]) * invDet;
  Jinv[5] = -(J[0] * J[5] - J[2] * J[3]) * invDet;
  Jinv[6] =  (J[3] * J[7] - J[4] * J[6]) * invDet;
  Jinv[7] = -(J[0] * J[7] - J[1] * J[6]) * invDet;
  Jinv[8] =  (J[0] * J[4] - J[1] * J[3]) * invDet;
  // dN/dx = J⁻¹ · dN/dξ (8×3)
  var dNdx = new Float64Array(8 * 3);
  for (var ki = 0; ki < 8; ki++) {
    var dxi2   = dN[ki * 3];
    var deta2  = dN[ki * 3 + 1];
    var dzeta2 = dN[ki * 3 + 2];
    dNdx[ki * 3]     = Jinv[0] * dxi2 + Jinv[1] * deta2 + Jinv[2] * dzeta2;
    dNdx[ki * 3 + 1] = Jinv[3] * dxi2 + Jinv[4] * deta2 + Jinv[5] * dzeta2;
    dNdx[ki * 3 + 2] = Jinv[6] * dxi2 + Jinv[7] * deta2 + Jinv[8] * dzeta2;
  }
  return { dNdx: dNdx, detJ: detJ };
}

// ─── 3. Strain-displacement B matrisi ────────────────────────────────────
// 6×24 (6 strain × 24 DoF = 8 node × 3 disp)
// ε = B · u  burada ε = [εxx, εyy, εzz, γxy, γyz, γxz]^T
// u = [u0x, u0y, u0z, u1x, u1y, u1z, ..., u7x, u7y, u7z]^T
//
// B_i = [ dN_i/dx       0           0
//             0      dN_i/dy        0
//             0          0       dN_i/dz
//         dN_i/dy   dN_i/dx        0
//             0      dN_i/dz   dN_i/dy
//         dN_i/dz       0       dN_i/dx ]
function veFEAHex8StrainDisplacementB(dNdx) {
  var B = new Float64Array(6 * 24);
  for (var i = 0; i < 8; i++) {
    var c = i * 3;
    var Nx = dNdx[i * 3];
    var Ny = dNdx[i * 3 + 1];
    var Nz = dNdx[i * 3 + 2];
    // Satır 0 (εxx)
    B[0 * 24 + c]     = Nx;
    // Satır 1 (εyy)
    B[1 * 24 + c + 1] = Ny;
    // Satır 2 (εzz)
    B[2 * 24 + c + 2] = Nz;
    // Satır 3 (γxy)
    B[3 * 24 + c]     = Ny;
    B[3 * 24 + c + 1] = Nx;
    // Satır 4 (γyz)
    B[4 * 24 + c + 1] = Nz;
    B[4 * 24 + c + 2] = Ny;
    // Satır 5 (γxz)
    B[5 * 24 + c]     = Nz;
    B[5 * 24 + c + 2] = Nx;
  }
  return B;
}

// ─── 4. 8-point Gauss quadrature ─────────────────────────────────────────
// ξ_g, η_g, ζ_g = ±1/√3, hepsi weight = 1
var _VE_FEA_HEX8_GAUSS_PTS = (function () {
  var g = 1 / Math.sqrt(3);
  return [
    [-g, -g, -g], [+g, -g, -g], [+g, +g, -g], [-g, +g, -g],
    [-g, -g, +g], [+g, -g, +g], [+g, +g, +g], [-g, +g, +g]
  ];
})();

// ─── 5. Element stiffness K_e (24×24) ────────────────────────────────────
// K_e = Σ_g (B_g^T · D · B_g · detJ_g)  (8 Gauss points, weight = 1)
//
// nodeCoords: Float64Array(24)
// D: Float64Array(36) — 6×6 izotropik elastisite matrisi (MPa)
function veFEAHex8ElementStiffness(nodeCoords, D) {
  var Ke = new Float64Array(24 * 24);
  for (var g = 0; g < 8; g++) {
    var pt = _VE_FEA_HEX8_GAUSS_PTS[g];
    var jac = veFEAHex8JacobianAtGaussPoint(nodeCoords, pt[0], pt[1], pt[2]);
    if (!jac || jac.detJ <= 0) return null; // negatif Jacobian → eleman geçersiz
    var B = veFEAHex8StrainDisplacementB(jac.dNdx);
    // tmp = D · B  (6×24)
    var DB = new Float64Array(6 * 24);
    for (var r = 0; r < 6; r++) {
      for (var c = 0; c < 24; c++) {
        var s = 0;
        for (var k = 0; k < 6; k++) s += D[r * 6 + k] * B[k * 24 + c];
        DB[r * 24 + c] = s;
      }
    }
    // K_e += B^T · DB · detJ
    var w = jac.detJ; // weight = 1
    for (var ii = 0; ii < 24; ii++) {
      for (var jj = 0; jj < 24; jj++) {
        var s2 = 0;
        for (var kk = 0; kk < 6; kk++) s2 += B[kk * 24 + ii] * DB[kk * 24 + jj];
        Ke[ii * 24 + jj] += s2 * w;
      }
    }
  }
  return Ke;
}

// ─── 6. Sparse Global K Assembly ─────────────────────────────────────────
// COO triplet listesi (row, col, val) toplandıktan sonra CSR'a sıkıştırılır.
// 3D: her node 3 DoF. DoF index = node*3 + (0|1|2).
//
// Çıkış: { nDoF, csrRowPtr, csrColIdx, csrVal, diag }
// diag: Jacobi preconditioner için diagonal vektör (her DoF için)
function veFEAAssembleGlobalK(mesh, material) {
  if (!mesh || mesh.type !== 'hex8') return null;
  var D = veFEAElasticityMatrix(material);
  if (!D) return null;

  var nodes = mesh.nodes;
  var elements = mesh.elements;
  var nodeCount = nodes.length / 3;
  var nElem = elements.length / 8;
  var nDoF = nodeCount * 3;

  // COO triplet (her hex 24×24 = 576 entry × 8 elem ortalama)
  // Önce kapasite yedek: 576 × nElem (gerçekte biraz daha az olur sym sayesinde)
  var capacity = 576 * nElem;
  var rows = new Int32Array(capacity);
  var cols = new Int32Array(capacity);
  var vals = new Float64Array(capacity);
  var nnz = 0;

  // Eleman koordinat buffer (her eleman için yeniden kullanılır)
  var nc = new Float64Array(24);

  for (var e = 0; e < nElem; e++) {
    var off = e * 8;
    for (var i = 0; i < 8; i++) {
      var n = elements[off + i];
      nc[i * 3]     = nodes[n * 3];
      nc[i * 3 + 1] = nodes[n * 3 + 1];
      nc[i * 3 + 2] = nodes[n * 3 + 2];
    }
    var Ke = veFEAHex8ElementStiffness(nc, D);
    if (!Ke) continue; // dejenere eleman atla
    // 24 DoF → global DoF map
    var gDoF = new Int32Array(24);
    for (var ii = 0; ii < 8; ii++) {
      var nn = elements[off + ii];
      gDoF[ii * 3]     = nn * 3;
      gDoF[ii * 3 + 1] = nn * 3 + 1;
      gDoF[ii * 3 + 2] = nn * 3 + 2;
    }
    // Triplet ekle
    for (var r = 0; r < 24; r++) {
      var gr = gDoF[r];
      for (var c = 0; c < 24; c++) {
        var v = Ke[r * 24 + c];
        if (v === 0) continue;
        rows[nnz] = gr;
        cols[nnz] = gDoF[c];
        vals[nnz] = v;
        nnz++;
      }
    }
  }

  // Triplet → CSR (row-sorted, sum duplicates)
  return _veFEACoosToCsr(rows, cols, vals, nnz, nDoF);
}

// COO → CSR konversiyonu, aynı (row,col) entry'leri toplar
function _veFEACoosToCsr(rows, cols, vals, nnz, nDoF) {
  // Her satırdaki entry sayısını sayalım
  var rowCount = new Int32Array(nDoF);
  for (var i = 0; i < nnz; i++) rowCount[rows[i]]++;
  // CSR row pointer (prefix sum)
  var rowPtr = new Int32Array(nDoF + 1);
  for (var r = 0; r < nDoF; r++) rowPtr[r + 1] = rowPtr[r] + rowCount[r];
  var totalEntries = rowPtr[nDoF];
  // Geçici array — satır içinde dolduralım
  var tempCol = new Int32Array(totalEntries);
  var tempVal = new Float64Array(totalEntries);
  var cursor = new Int32Array(nDoF);
  for (var ii = 0; ii < nnz; ii++) {
    var rr = rows[ii];
    var p = rowPtr[rr] + cursor[rr]++;
    tempCol[p] = cols[ii];
    tempVal[p] = vals[ii];
  }
  // Her satır içinde col'a göre sort + duplicate sum
  var finalRowPtr = new Int32Array(nDoF + 1);
  var finalColList = [];
  var finalValList = [];
  for (var rIdx = 0; rIdx < nDoF; rIdx++) {
    var start = rowPtr[rIdx], end = rowPtr[rIdx + 1];
    var rowLen = end - start;
    // Slice ve sort
    var pairs = [];
    for (var k = 0; k < rowLen; k++) pairs.push([tempCol[start + k], tempVal[start + k]]);
    pairs.sort(function (a, b) { return a[0] - b[0]; });
    // Duplicate'leri topla
    var lastCol = -1;
    for (var pi = 0; pi < pairs.length; pi++) {
      var col = pairs[pi][0], v = pairs[pi][1];
      if (col === lastCol) {
        finalValList[finalValList.length - 1] += v;
      } else {
        finalColList.push(col);
        finalValList.push(v);
        lastCol = col;
      }
    }
    finalRowPtr[rIdx + 1] = finalColList.length;
  }
  var csrColIdx = new Int32Array(finalColList);
  var csrVal    = new Float64Array(finalValList);
  // Diagonal vektör (preconditioner için)
  var diag = new Float64Array(nDoF);
  for (var d = 0; d < nDoF; d++) {
    var rs = finalRowPtr[d], re = finalRowPtr[d + 1];
    for (var di = rs; di < re; di++) {
      if (csrColIdx[di] === d) { diag[d] = csrVal[di]; break; }
    }
  }
  return {
    nDoF: nDoF,
    csrRowPtr: finalRowPtr,
    csrColIdx: csrColIdx,
    csrVal: csrVal,
    diag: diag
  };
}

// ─── 7. CSR Matrix-Vector çarpımı ────────────────────────────────────────
function veFEACsrSpMV(K, x, y) {
  // y = K · x
  var rp = K.csrRowPtr, ci = K.csrColIdx, val = K.csrVal;
  var n = K.nDoF;
  if (!y) y = new Float64Array(n); else y.fill(0);
  for (var r = 0; r < n; r++) {
    var s = 0;
    for (var p = rp[r]; p < rp[r + 1]; p++) s += val[p] * x[ci[p]];
    y[r] = s;
  }
  return y;
}

// ─── 8. BC enforcement — penalty method ──────────────────────────────────
// Fixed DoF için K[i,i] *= PENALTY, F[i] = 0 (veya prescribed value × PENALTY).
// Force/Pressure: F[i] += value (yüzeyin tüm node'larına dağıt).
// Pressure: F[i] = p · A_face · n_i / nNodesOnFace (uniform dağılım).
//
// fixedDoFs: Set<int> — global DoF indices
// prescribedDisplacements: { dofIdx: value }
// loadVector: Float64Array(nDoF) — başlangıçta sıfır
// Penalty katsayısı: diag(K) ortalamasının ~10⁸ katı yeterli (1e20 numeric
// precision'ı bozar, PCG yakınsamaz). Hex8 E=200GPa için K diag ~1e6, dolayısıyla
// 1e12 ile fixed-DoF effective olarak sabit (numerik tutarlılık ile).
var VE_FEA_BC_PENALTY = 1e12;

function veFEAApplyFixedSupport(K, F, dofIdx) {
  // K[i,i] *= PENALTY, F[i] = 0 (sabit destek için u_i = 0)
  var rp = K.csrRowPtr, ci = K.csrColIdx, val = K.csrVal;
  for (var p = rp[dofIdx]; p < rp[dofIdx + 1]; p++) {
    if (ci[p] === dofIdx) {
      val[p] *= VE_FEA_BC_PENALTY;
      K.diag[dofIdx] = val[p];
      break;
    }
  }
  F[dofIdx] = 0;
}

function veFEAApplyPrescribedDisplacement(K, F, dofIdx, value) {
  var rp = K.csrRowPtr, ci = K.csrColIdx, val = K.csrVal;
  for (var p = rp[dofIdx]; p < rp[dofIdx + 1]; p++) {
    if (ci[p] === dofIdx) {
      val[p] *= VE_FEA_BC_PENALTY;
      K.diag[dofIdx] = val[p];
      F[dofIdx] = val[p] * value;
      return;
    }
  }
}

// ─── 9. PCG (Jacobi preconditioned) solver ───────────────────────────────
// K · u = F  (symmetric positive definite, after BC enforcement)
// Jacobi precond: M = diag(K) → z = r ./ diag(K)
//
// Çıkış: { u, iterations, residual }
function veFEAPCGSolve(K, F, opts) {
  opts = opts || {};
  var maxIter = opts.maxIter || (10 * K.nDoF);
  var tol = opts.tol || 1e-8;
  var n = K.nDoF;
  var u = new Float64Array(n);
  var r = new Float64Array(n);
  // r = F - K·u  (u=0 başlangıç → r = F)
  for (var i = 0; i < n; i++) r[i] = F[i];
  // İlk residual normu
  var rNorm0 = 0;
  for (var j = 0; j < n; j++) rNorm0 += r[j] * r[j];
  rNorm0 = Math.sqrt(rNorm0);
  if (rNorm0 < 1e-30) return { u: u, iterations: 0, residual: 0, converged: true };

  // z = M⁻¹ r
  var z = new Float64Array(n);
  for (var k = 0; k < n; k++) {
    var d = K.diag[k];
    z[k] = (Math.abs(d) > 1e-30) ? r[k] / d : r[k];
  }
  // p = z
  var p = new Float64Array(n);
  p.set(z);
  // rDotZ
  var rDotZ = 0;
  for (var m = 0; m < n; m++) rDotZ += r[m] * z[m];
  var iter = 0;
  var Ap = new Float64Array(n);
  for (iter = 0; iter < maxIter; iter++) {
    veFEACsrSpMV(K, p, Ap);
    // α = rDotZ / (p·Ap)
    var pAp = 0;
    for (var i2 = 0; i2 < n; i2++) pAp += p[i2] * Ap[i2];
    if (Math.abs(pAp) < 1e-30) break;
    var alpha = rDotZ / pAp;
    // u += α·p, r -= α·Ap
    for (var i3 = 0; i3 < n; i3++) {
      u[i3] += alpha * p[i3];
      r[i3] -= alpha * Ap[i3];
    }
    // Residual check
    var rNorm = 0;
    for (var i4 = 0; i4 < n; i4++) rNorm += r[i4] * r[i4];
    rNorm = Math.sqrt(rNorm);
    if (rNorm / rNorm0 < tol) {
      return { u: u, iterations: iter + 1, residual: rNorm, converged: true };
    }
    // z = M⁻¹ r
    for (var i5 = 0; i5 < n; i5++) {
      var d2 = K.diag[i5];
      z[i5] = (Math.abs(d2) > 1e-30) ? r[i5] / d2 : r[i5];
    }
    // β = rDotZ_new / rDotZ
    var rDotZ_new = 0;
    for (var i6 = 0; i6 < n; i6++) rDotZ_new += r[i6] * z[i6];
    var beta = rDotZ_new / rDotZ;
    rDotZ = rDotZ_new;
    // p = z + β·p
    for (var i7 = 0; i7 < n; i7++) p[i7] = z[i7] + beta * p[i7];
  }
  // Yakınsamadıysa son halini döndür
  var finalRNorm = 0;
  for (var i8 = 0; i8 < n; i8++) finalRNorm += r[i8] * r[i8];
  return { u: u, iterations: iter, residual: Math.sqrt(finalRNorm), converged: false };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    veFEAHex8ShapeFunctions: veFEAHex8ShapeFunctions,
    veFEAHex8ShapeFunctionDerivativesNatural: veFEAHex8ShapeFunctionDerivativesNatural,
    veFEAHex8JacobianAtGaussPoint: veFEAHex8JacobianAtGaussPoint,
    veFEAHex8StrainDisplacementB: veFEAHex8StrainDisplacementB,
    veFEAHex8ElementStiffness: veFEAHex8ElementStiffness,
    veFEAAssembleGlobalK: veFEAAssembleGlobalK,
    veFEACsrSpMV: veFEACsrSpMV,
    veFEAApplyFixedSupport: veFEAApplyFixedSupport,
    veFEAApplyPrescribedDisplacement: veFEAApplyPrescribedDisplacement,
    veFEAPCGSolve: veFEAPCGSolve,
    VE_FEA_BC_PENALTY: VE_FEA_BC_PENALTY
  };
}
