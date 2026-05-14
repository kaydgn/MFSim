/**
 * FEA Çözücü birim testleri (Faz 5)
 * - Hex8 shape functions (partition of unity, çekirdek özellikleri)
 * - Jacobian (birim küp için detJ=1)
 * - B matrix simetri
 * - Element K_e simetri + pozitif tanımlılık
 * - Global K assembly (CSR doğruluğu)
 * - PCG çözücü (uniaxial tension analitik karşılaştırma)
 */

const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '../..');

eval(fs.readFileSync(path.join(ROOT, 'js/fea-materials.js'), 'utf8'));
eval(fs.readFileSync(path.join(ROOT, 'js/fea-mesh.js'), 'utf8'));
eval(fs.readFileSync(path.join(ROOT, 'js/fea-solver.js'), 'utf8'));

// ─── Yardımcı: Birim küp Hex8 nodeCoords ─────────────────────────────────
// 8 düğüm × 3 koord, ANSYS/Abaqus düğüm sırası, (0,0,0) → (1,1,1)
function unitCubeCoords() {
  return new Float64Array([
    0, 0, 0,   1, 0, 0,   1, 1, 0,   0, 1, 0,
    0, 0, 1,   1, 0, 1,   1, 1, 1,   0, 1, 1
  ]);
}

describe('Hex8 Shape Functions', () => {
  test('Partition of unity: ΣN_i = 1 her noktada', () => {
    var pts = [[0,0,0], [-1,-1,-1], [0.5,0.5,0.5], [-0.3,0.7,-0.2]];
    pts.forEach(function (pt) {
      var N = veFEAHex8ShapeFunctions(pt[0], pt[1], pt[2]);
      var sum = 0;
      for (var i = 0; i < 8; i++) sum += N[i];
      expect(sum).toBeCloseTo(1, 10);
    });
  });

  test('Kronecker delta: N_i(node_j) = δ_ij', () => {
    var natural = [
      [-1,-1,-1],[+1,-1,-1],[+1,+1,-1],[-1,+1,-1],
      [-1,-1,+1],[+1,-1,+1],[+1,+1,+1],[-1,+1,+1]
    ];
    for (var i = 0; i < 8; i++) {
      var N = veFEAHex8ShapeFunctions(natural[i][0], natural[i][1], natural[i][2]);
      for (var j = 0; j < 8; j++) {
        expect(N[j]).toBeCloseTo(i === j ? 1 : 0, 10);
      }
    }
  });

  test('Türev partition of unity: Σ dN_i/dξ = 0', () => {
    var dN = veFEAHex8ShapeFunctionDerivativesNatural(0.3, -0.4, 0.5);
    var sx = 0, sy = 0, sz = 0;
    for (var i = 0; i < 8; i++) {
      sx += dN[i * 3];
      sy += dN[i * 3 + 1];
      sz += dN[i * 3 + 2];
    }
    expect(sx).toBeCloseTo(0, 10);
    expect(sy).toBeCloseTo(0, 10);
    expect(sz).toBeCloseTo(0, 10);
  });
});

describe('Hex8 Jacobian', () => {
  test('Birim küp: detJ = (1/2)³ = 0.125 (yarı genişlik)', () => {
    var nc = unitCubeCoords();
    var jac = veFEAHex8JacobianAtGaussPoint(nc, 0, 0, 0);
    expect(jac.detJ).toBeCloseTo(0.125, 8);
  });

  test('Birim küp ∫detJ dξ over 8 Gauss = 1 (cube volume)', () => {
    var nc = unitCubeCoords();
    var g = 1 / Math.sqrt(3);
    var pts = [
      [-g,-g,-g],[g,-g,-g],[g,g,-g],[-g,g,-g],
      [-g,-g,g],[g,-g,g],[g,g,g],[-g,g,g]
    ];
    var vol = 0;
    pts.forEach(function (pt) {
      var jac = veFEAHex8JacobianAtGaussPoint(nc, pt[0], pt[1], pt[2]);
      vol += jac.detJ; // weight = 1
    });
    expect(vol).toBeCloseTo(1, 8);
  });

  test('Negatif orientation → detJ < 0 (return)', () => {
    // Tersine sıralama: alt ve üst yüzü değiştir (orientation negatif)
    var bad = new Float64Array([
      0, 0, 1,   1, 0, 1,   1, 1, 1,   0, 1, 1,
      0, 0, 0,   1, 0, 0,   1, 1, 0,   0, 1, 0
    ]);
    var jac = veFEAHex8JacobianAtGaussPoint(bad, 0, 0, 0);
    expect(jac.detJ).toBeLessThan(0);
  });
});

describe('Hex8 B Matrix', () => {
  test('B size 6×24', () => {
    var nc = unitCubeCoords();
    var jac = veFEAHex8JacobianAtGaussPoint(nc, 0, 0, 0);
    var B = veFEAHex8StrainDisplacementB(jac.dNdx);
    expect(B.length).toBe(6 * 24);
  });

  test('Birim küp center: B sıfır olmayan elementler doğru sütunlarda', () => {
    var nc = unitCubeCoords();
    var jac = veFEAHex8JacobianAtGaussPoint(nc, 0, 0, 0);
    var B = veFEAHex8StrainDisplacementB(jac.dNdx);
    // node 0 (corner) için B[0, 0] = dN0/dx > 0 olmalı (birim küp için)
    // node 0 koord (0,0,0), gauss merkez (0.5,0.5,0.5) → N0(0,0,0)=1, dN0/dx ≠ 0
    // Yapısal eksenler her Gauss point'te node etkilerine bağlı
    // En basit test: B'nin sıfır olmayan satır 0'lara node3'er 1 entry (εxx için)
    var row0NonZero = 0;
    for (var c = 0; c < 24; c++) if (B[0 * 24 + c] !== 0) row0NonZero++;
    expect(row0NonZero).toBe(8); // εxx satırı 8 node × 1 disp = 8 entry
  });
});

describe('Hex8 Element Stiffness K_e (24×24)', () => {
  test('Birim küp + çelik St37: K_e simetrik', () => {
    var nc = unitCubeCoords();
    var D = veFEAElasticityMatrix(veFEAMaterialById('steel-st37'));
    var Ke = veFEAHex8ElementStiffness(nc, D);
    expect(Ke).not.toBeNull();
    expect(Ke.length).toBe(24 * 24);
    // Simetri kontrolü
    var maxAsym = 0;
    for (var i = 0; i < 24; i++) {
      for (var j = i + 1; j < 24; j++) {
        var a = Ke[i * 24 + j], b = Ke[j * 24 + i];
        maxAsym = Math.max(maxAsym, Math.abs(a - b));
      }
    }
    // Floating-point tolerance — K_e büyüklüğü ~10⁵-10⁶
    expect(maxAsym).toBeLessThan(1e-3);
  });

  test('K_e diagonal pozitif (pozitif tanımlı temel)', () => {
    var nc = unitCubeCoords();
    var D = veFEAElasticityMatrix(veFEAMaterialById('steel-st37'));
    var Ke = veFEAHex8ElementStiffness(nc, D);
    for (var i = 0; i < 24; i++) {
      expect(Ke[i * 24 + i]).toBeGreaterThan(0);
    }
  });

  test('Rigid body translation: K_e · u_rigid = 0 (kontrolü)', () => {
    // Tüm node'ları aynı miktar (1,0,0) hareket ettir → ε=0, dolayısıyla F = K_e·u = 0
    var nc = unitCubeCoords();
    var D = veFEAElasticityMatrix(veFEAMaterialById('steel-st37'));
    var Ke = veFEAHex8ElementStiffness(nc, D);
    var u = new Float64Array(24);
    for (var i = 0; i < 8; i++) u[i * 3] = 1; // x-yönde rigid trans
    var f = new Float64Array(24);
    for (var ii = 0; ii < 24; ii++) {
      var s = 0;
      for (var jj = 0; jj < 24; jj++) s += Ke[ii * 24 + jj] * u[jj];
      f[ii] = s;
    }
    // F norm ~ 0 (rigid body mode)
    var fNorm = 0;
    for (var k = 0; k < 24; k++) fNorm += f[k] * f[k];
    fNorm = Math.sqrt(fNorm);
    // Çelik için K büyüklüğü ~10⁶, rigid mode'ta f ~ 10⁻⁸-10⁻⁹ olmalı (floating)
    expect(fNorm).toBeLessThan(1e-3);
  });

  test('Negatif Jacobian eleman → null döner', () => {
    var bad = new Float64Array([
      0, 0, 1,   1, 0, 1,   1, 1, 1,   0, 1, 1,
      0, 0, 0,   1, 0, 0,   1, 1, 0,   0, 1, 0
    ]);
    var D = veFEAElasticityMatrix(veFEAMaterialById('steel-st37'));
    var Ke = veFEAHex8ElementStiffness(bad, D);
    expect(Ke).toBeNull();
  });
});

describe('Global K Assembly (CSR)', () => {
  test('1 hex8 mesh → nDoF = 8·3 = 24', () => {
    var mesh = veFEAMeshFromGeometry({ type: 'box', params: { width: 1, height: 1, depth: 1 } }, { size: 1 });
    expect(mesh.elements.length / 8).toBe(1); // tek hex
    var K = veFEAAssembleGlobalK(mesh, veFEAMaterialById('steel-st37'));
    expect(K.nDoF).toBe(24);
    expect(K.csrRowPtr.length).toBe(25);
    // K diagonal pozitif
    for (var i = 0; i < 24; i++) expect(K.diag[i]).toBeGreaterThan(0);
  });

  test('2×2×2 hex8 mesh → 27 düğüm, 81 DoF, CSR simetrik', () => {
    var mesh = veFEAMeshFromGeometry({ type: 'box', params: { width: 2, height: 2, depth: 2 } }, { size: 1 });
    expect(mesh.elements.length / 8).toBe(8); // 8 hex
    var K = veFEAAssembleGlobalK(mesh, veFEAMaterialById('steel-st37'));
    expect(K.nDoF).toBe(27 * 3); // 27 node × 3 DoF
    // K simetri: K[i,j] = K[j,i]
    function _getEntry(K, r, c) {
      for (var p = K.csrRowPtr[r]; p < K.csrRowPtr[r + 1]; p++) {
        if (K.csrColIdx[p] === c) return K.csrVal[p];
      }
      return 0;
    }
    var maxAsym = 0;
    for (var i = 0; i < K.nDoF; i++) {
      for (var p2 = K.csrRowPtr[i]; p2 < K.csrRowPtr[i + 1]; p2++) {
        var j = K.csrColIdx[p2];
        if (j > i) {
          var a = K.csrVal[p2];
          var b = _getEntry(K, j, i);
          maxAsym = Math.max(maxAsym, Math.abs(a - b));
        }
      }
    }
    expect(maxAsym).toBeLessThan(1e-3);
  });
});

describe('CSR Mat-Vec çarpımı', () => {
  test('Birim hex8 küp K · u_rigid_trans ≈ 0', () => {
    var mesh = veFEAMeshFromGeometry({ type: 'box', params: { width: 1, height: 1, depth: 1 } }, { size: 1 });
    var K = veFEAAssembleGlobalK(mesh, veFEAMaterialById('steel-st37'));
    var u = new Float64Array(K.nDoF);
    for (var i = 0; i < 8; i++) u[i * 3] = 1; // tüm node'lar +x'e 1 mm
    var f = veFEACsrSpMV(K, u);
    var fNorm = 0;
    for (var j = 0; j < f.length; j++) fNorm += f[j] * f[j];
    expect(Math.sqrt(fNorm)).toBeLessThan(1e-3);
  });
});

describe('PCG Çözücü — uniaxial tension validation', () => {
  test('1×1×1 hex8 + sol yüz fixed + sağ yüz F_x: u_x ≈ FL/EA (analitik)', () => {
    var mesh = veFEAMeshFromGeometry({ type: 'box', params: { width: 1, height: 1, depth: 1 } }, { size: 1 });
    var mat = veFEAMaterialById('steel-st37');
    var K = veFEAAssembleGlobalK(mesh, mat);
    var F = new Float64Array(K.nDoF);

    // Mesh kutusu merkezden başlar: width=1 → x ∈ [-0.5, +0.5].
    // Sol yüz: minX → fixed; Sağ yüz: maxX → force.
    var minX = Infinity, maxX = -Infinity;
    for (var n = 0; n < mesh.nodes.length / 3; n++) {
      var x = mesh.nodes[n * 3];
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
    }
    var leftNodes = [], rightNodes = [];
    for (var nn = 0; nn < mesh.nodes.length / 3; nn++) {
      var xx = mesh.nodes[nn * 3];
      if (Math.abs(xx - minX) < 1e-6) leftNodes.push(nn);
      else if (Math.abs(xx - maxX) < 1e-6) rightNodes.push(nn);
    }
    // Sol yüz fixed (3 DoF, 4 node = 12 DoF)
    leftNodes.forEach(function (n) {
      veFEAApplyFixedSupport(K, F, n * 3);
      veFEAApplyFixedSupport(K, F, n * 3 + 1);
      veFEAApplyFixedSupport(K, F, n * 3 + 2);
    });
    // Sağ yüze toplam Fx = 100 N (1 mm² alana = 100 MPa stress)
    var totalForce = 100; // N
    var fPerNode = totalForce / rightNodes.length;
    rightNodes.forEach(function (n) { F[n * 3] += fPerNode; });

    var result = veFEAPCGSolve(K, F, { tol: 1e-10, maxIter: 1000 });
    expect(result.converged).toBe(true);

    // Analitik: σ = F/A = 100/1 = 100 MPa; ε = σ/E; ΔL = ε·L = (σ/E)·L
    // E = 210000 MPa, L = 1 mm
    // ΔL = (100/210000)·1 ≈ 0.000476 mm
    // Note: 3D olduğu için Poisson kontraksiyon var → x ekseninde stiffness biraz daha yüksek,
    // ama tek hex için tam unit cube analitik kontrol: u_x_avg ≈ FL/EA (~ %2 hata)
    var avgUx = 0;
    rightNodes.forEach(function (n) { avgUx += result.u[n * 3]; });
    avgUx /= rightNodes.length;
    var expectedUx = (totalForce / 1.0) / mat.youngsModulus * 1.0; // FL/EA
    // 8-Gauss tek hex8 unit cube için yaklaşık %2 sapma
    expect(avgUx).toBeCloseTo(expectedUx, 4);
  });
});
