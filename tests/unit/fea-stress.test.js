/**
 * FEA Stress Recovery + von Mises + Asal gerilme birim testleri
 */

const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '../..');

eval(fs.readFileSync(path.join(ROOT, 'js/fea-materials.js'), 'utf8'));
eval(fs.readFileSync(path.join(ROOT, 'js/fea-mesh.js'), 'utf8'));
eval(fs.readFileSync(path.join(ROOT, 'js/fea-solver.js'), 'utf8'));
eval(fs.readFileSync(path.join(ROOT, 'js/fea-stress.js'), 'utf8'));

describe('von Mises stress formülü', () => {
  test('Hidrostatik gerilme: σVM = 0 (deviatoric kısmı sıfır)', () => {
    var sigma = new Float64Array([100, 100, 100, 0, 0, 0]);
    expect(veFEAVonMisesFromCauchy(sigma)).toBeCloseTo(0, 8);
  });

  test('Uniaxial tension σxx=100: σVM = 100', () => {
    var sigma = new Float64Array([100, 0, 0, 0, 0, 0]);
    expect(veFEAVonMisesFromCauchy(sigma)).toBeCloseTo(100, 6);
  });

  test('Pure shear σxy=50: σVM = √3·50 ≈ 86.6', () => {
    var sigma = new Float64Array([0, 0, 0, 50, 0, 0]);
    expect(veFEAVonMisesFromCauchy(sigma)).toBeCloseTo(Math.sqrt(3) * 50, 6);
  });
});

describe('Asal gerilme (eigenvalue 3×3 sym tensor)', () => {
  test('Diagonal: σ1 = 100, σ2 = 50, σ3 = 10 (sıralı)', () => {
    var sigma = new Float64Array([100, 50, 10, 0, 0, 0]);
    var p = veFEAPrincipalStresses(sigma);
    expect(p[0]).toBeCloseTo(100, 8);
    expect(p[1]).toBeCloseTo(50, 8);
    expect(p[2]).toBeCloseTo(10, 8);
  });

  test('Hidrostatik: σ1 = σ2 = σ3', () => {
    var sigma = new Float64Array([50, 50, 50, 0, 0, 0]);
    var p = veFEAPrincipalStresses(sigma);
    expect(p[0]).toBeCloseTo(50, 6);
    expect(p[1]).toBeCloseTo(50, 6);
    expect(p[2]).toBeCloseTo(50, 6);
  });

  test('Pure shear: σ1=50, σ2=0, σ3=-50 (σxy=50, normaller=0)', () => {
    var sigma = new Float64Array([0, 0, 0, 50, 0, 0]);
    var p = veFEAPrincipalStresses(sigma);
    expect(p[0]).toBeCloseTo(50, 6);
    expect(p[1]).toBeCloseTo(0, 6);
    expect(p[2]).toBeCloseTo(-50, 6);
  });

  test('Asal gerilmeler büyükten küçüğe sıralı', () => {
    var sigma = new Float64Array([10, 100, 30, 5, -20, 15]);
    var p = veFEAPrincipalStresses(sigma);
    expect(p[0]).toBeGreaterThanOrEqual(p[1]);
    expect(p[1]).toBeGreaterThanOrEqual(p[2]);
  });
});

describe('Hex8 element gerilme hesabı', () => {
  test('Rigid translation → ε=0 → σ=0', () => {
    var nc = new Float64Array([
      0, 0, 0,  1, 0, 0,  1, 1, 0,  0, 1, 0,
      0, 0, 1,  1, 0, 1,  1, 1, 1,  0, 1, 1
    ]);
    var D = veFEAElasticityMatrix(veFEAMaterialById('steel-st37'));
    var u_e = new Float64Array(24);
    for (var i = 0; i < 8; i++) u_e[i * 3] = 0.5; // tüm node'lar +x'e 0.5 mm
    var stresses = veFEAHex8ComputeElementStresses(nc, u_e, D);
    var maxStress = 0;
    for (var s = 0; s < stresses.length; s++) maxStress = Math.max(maxStress, Math.abs(stresses[s]));
    expect(maxStress).toBeLessThan(1e-6);
  });

  test('Uniform x-strain ε_xx=0.001 → σ_xx ≈ E·ε (Poisson koreksiyonu hariç başlangıç)', () => {
    var nc = new Float64Array([
      0, 0, 0,  1, 0, 0,  1, 1, 0,  0, 1, 0,
      0, 0, 1,  1, 0, 1,  1, 1, 1,  0, 1, 1
    ]);
    var mat = veFEAMaterialById('steel-st37');
    var D = veFEAElasticityMatrix(mat);
    // u_e: x-yönde lineer artış (ε_xx = 0.001)
    // node x=0 → u_x=0, node x=1 → u_x = 0.001
    var u_e = new Float64Array(24);
    for (var i = 0; i < 8; i++) {
      u_e[i * 3] = nc[i * 3] * 0.001; // u_x = 0.001 * x
    }
    var stresses = veFEAHex8ComputeElementStresses(nc, u_e, D);
    // ε = [0.001, 0, 0, 0, 0, 0]
    // σ = D·ε: σ_xx = D[0,0]*0.001 = (λ+2μ)*0.001
    var nu = 0.30, E = 210000;
    var lam = nu * E / ((1 + nu) * (1 - 2 * nu));
    var mu  = E / (2 * (1 + nu));
    var expectedSxx = (lam + 2 * mu) * 0.001;
    // 8 Gauss point'ten herhangi biri kontrol
    expect(stresses[0]).toBeCloseTo(expectedSxx, 2);
    // εyy = εzz = 0 → σyy = σzz = λ·0.001 (uniaxial strain)
    expect(stresses[1]).toBeCloseTo(lam * 0.001, 2);
  });
});

describe('Tam pipeline: mesh → solver → stress', () => {
  test('1×1×1 kutu + uniaxial tension → σ_xx ≈ F/A', () => {
    var mesh = veFEAMeshFromGeometry({ type: 'box', params: { width: 1, height: 1, depth: 1 } }, { size: 1 });
    var mat = veFEAMaterialById('steel-st37');
    var K = veFEAAssembleGlobalK(mesh, mat);
    var F = new Float64Array(K.nDoF);
    // Min/max x yüzlerini bul
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
    leftNodes.forEach(function (n) {
      veFEAApplyFixedSupport(K, F, n * 3);
      veFEAApplyFixedSupport(K, F, n * 3 + 1);
      veFEAApplyFixedSupport(K, F, n * 3 + 2);
    });
    // 1×1 mm² alana 100 N → 100 MPa stress
    var fPerNode = 100 / rightNodes.length;
    rightNodes.forEach(function (n) { F[n * 3] += fPerNode; });

    var sol = veFEAPCGSolve(K, F, { tol: 1e-10 });
    expect(sol.converged).toBe(true);

    var results = veFEAHex8ComputeNodalStresses(mesh, sol.u, mat);
    expect(results.maxVM).toBeGreaterThan(0);
    // Sol yüzdeki tam fix-support yan yönlerde de constraint koyar → corner'larda
    // σ_yy, σ_zz ≈ 15 MPa transverse stress oluşur. σ_xx ortalaması ise tam
    // analitik F/A = 100 MPa olmalı.
    var avgSxx = 0, n = results.nodalStress.length / 6;
    for (var i = 0; i < n; i++) avgSxx += results.nodalStress[i * 6];
    avgSxx /= n;
    expect(avgSxx).toBeCloseTo(100, 4);
    // VM max minimumdan yüksek olmalı (fizik gerçekleştiği için)
    expect(results.maxVM).toBeGreaterThan(50);
    expect(results.maxVM).toBeLessThan(110);
  });

  test('Toplam kütle 1 mm³ kutu çelik St37 ≈ 7.85e-6 kg', () => {
    var mesh = veFEAMeshFromGeometry({ type: 'box', params: { width: 1, height: 1, depth: 1 } }, { size: 1 });
    var mat = veFEAMaterialById('steel-st37');
    var K = veFEAAssembleGlobalK(mesh, mat);
    var F = new Float64Array(K.nDoF);
    var minX = Infinity;
    for (var n = 0; n < mesh.nodes.length / 3; n++) minX = Math.min(minX, mesh.nodes[n * 3]);
    for (var nn = 0; nn < mesh.nodes.length / 3; nn++) {
      if (Math.abs(mesh.nodes[nn * 3] - minX) < 1e-6) {
        veFEAApplyFixedSupport(K, F, nn * 3);
        veFEAApplyFixedSupport(K, F, nn * 3 + 1);
        veFEAApplyFixedSupport(K, F, nn * 3 + 2);
      }
    }
    var sol = veFEAPCGSolve(K, F, { tol: 1e-10 });
    var results = veFEAHex8ComputeNodalStresses(mesh, sol.u, mat);
    var summary = veFEABuildResultSummary(mesh, sol.u, mat, results);
    expect(summary.totalVolume).toBeCloseTo(1, 4);  // 1 mm³
    expect(summary.totalMass).toBeCloseTo(7.85e-6, 7);  // 1 mm³ × 7850 kg/m³ × 1e-9
  });
});

describe('Deplasman büyüklüğü', () => {
  test('Saf x-yönde deplasman: magnitude = |u_x|', () => {
    var u = new Float64Array([1.0, 0, 0,  0, 2.0, 0,  -3.0, 0, 0]);
    var d = veFEAComputeDisplacementMagnitudes(u);
    expect(d.mags[0]).toBeCloseTo(1.0, 8);
    expect(d.mags[1]).toBeCloseTo(2.0, 8);
    expect(d.mags[2]).toBeCloseTo(3.0, 8);
    expect(d.maxMag).toBeCloseTo(3.0, 8);
    expect(d.maxNode).toBe(2);
  });

  test('3D vektör magnitude: √(ux²+uy²+uz²)', () => {
    var u = new Float64Array([3, 4, 0]); // sqrt(9+16) = 5
    var d = veFEAComputeDisplacementMagnitudes(u);
    expect(d.mags[0]).toBeCloseTo(5, 8);
  });
});
