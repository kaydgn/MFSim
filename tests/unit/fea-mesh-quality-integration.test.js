/**
 * MFSim FEA — Mesh kalite zinciri ENTEGRASYON testleri.
 *
 * Smoothing + ANSYS skoru + auto-improve'un GERÇEK ANSYS kalite skorunu (orthogonal
 * quality + skewness tabanlı) ölçülebilir biçimde artırdığını doğrular. Bu, tüm
 * kalite altyapısının uçtan-uca çalıştığının kanıtıdır.
 *
 * Kritik gözlem: hex8 mesh'lerde iç düğümler baskındır → smoothing skoru dramatik
 * artırır. (tet4 voxel mesh'lerde en kötü eleman yüzeyde olabilir → kazanım daha
 * çok TetGen min-dihedral switch'inden gelir.)
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '../..');

// Smoothing + fea-mesh global yükle
const SM = require(path.join(ROOT, 'js/fea-mesh-smoothing.js'));
global.veFEASmoothMesh = SM.veFEASmoothMesh;
global.veFEAAutoImproveMesh = SM.veFEAAutoImproveMesh;
const meshSrc = fs.readFileSync(path.join(ROOT, 'js/fea-mesh.js'), 'utf8');
const M = {};
new Function('module', 'exports', meshSrc +
  '\n;Object.assign(exports,{veFEAComputeMeshQualityScore, veFEAComputeQualityMetrics, veFEAComputeJacobianMetrics, veFEAAutoImproveMeshWithScore});'
)({ exports: M }, M);

// İç düğümleri jitter'lı yapısal hex grid (iyi yüzey, bozuk iç).
function makeJitteredHexGrid(nn, jitter) {
  var nodes = [];
  for (var z = 0; z <= nn; z++) for (var y = 0; y <= nn; y++) for (var x = 0; x <= nn; x++) {
    var jx = 0, jy = 0, jz = 0;
    if (x > 0 && x < nn && y > 0 && y < nn && z > 0 && z < nn) {
      var seed = (x * 131 + y * 17 + z * 7);
      jx = ((seed % 10) / 10 - 0.5) * jitter;
      jy = (((seed * 3) % 10) / 10 - 0.5) * jitter;
      jz = (((seed * 7) % 10) / 10 - 0.5) * jitter;
    }
    nodes.push(x + jx, y + jy, z + jz);
  }
  var id = function (x, y, z) { return x + y * (nn + 1) + z * (nn + 1) * (nn + 1); };
  var el = [];
  for (var zz = 0; zz < nn; zz++) for (var yy = 0; yy < nn; yy++) for (var xx = 0; xx < nn; xx++) {
    el.push(id(xx, yy, zz), id(xx + 1, yy, zz), id(xx + 1, yy + 1, zz), id(xx, yy + 1, zz),
            id(xx, yy, zz + 1), id(xx + 1, yy, zz + 1), id(xx + 1, yy + 1, zz + 1), id(xx, yy + 1, zz + 1));
  }
  return { type: 'hex8', nodes: new Float32Array(nodes), elements: new Uint32Array(el), nodesPerElement: 8 };
}

describe('Kalite zinciri — smoothing GERÇEK ANSYS skorunu artırır', () => {
  test('bozuk hex8 grid: smoothing → orthogonal quality + skewness ciddi iyileşir', () => {
    var mesh = makeJitteredHexGrid(4, 0.6);
    var s0 = M.veFEAComputeMeshQualityScore(mesh);
    var smoothed = SM.veFEASmoothMesh(mesh, { iterations: 10, method: 'optimization' });
    var s1 = M.veFEAComputeMeshQualityScore(smoothed);
    // GERÇEK ANSYS skoru artmalı (ortho/skew tabanlı)
    expect(s1.score).toBeGreaterThan(s0.score);
    // Orthogonal quality iyileşmeli, skewness düşmeli
    expect(s1.metrics.minOrthogonalQuality).toBeGreaterThan(s0.metrics.minOrthogonalQuality);
    expect(s1.metrics.maxSkewness).toBeLessThan(s0.metrics.maxSkewness);
    // Anlamlı kazanım (en az +15 skor)
    expect(s1.score - s0.score).toBeGreaterThan(15);
  });

  test('auto-improve (gerçek skor) hex8 grid\'i hedefe çeker', () => {
    var mesh = makeJitteredHexGrid(4, 0.5);
    var r = M.veFEAAutoImproveMeshWithScore(mesh, { targetScore: 90 });
    expect(r.initialScore).toBeLessThan(90);   // başlangıç hedefin altında
    expect(r.finalScore).toBeGreaterThan(r.initialScore);  // iyileşti
    expect(r.finalScore).toBeGreaterThanOrEqual(r.initialScore);  // monoton
    // Smoothing inverted üretmedi
    var jac = M.veFEAComputeJacobianMetrics(r.mesh);
    expect(jac.invertedCount).toBe(0);
  });

  test('auto-improve monoton: gerçek skor asla düşmez', () => {
    [[3, 0.3], [4, 0.5], [4, 0.7]].forEach(function (cfg) {
      var mesh = makeJitteredHexGrid(cfg[0], cfg[1]);
      var r = M.veFEAAutoImproveMeshWithScore(mesh, { targetScore: 99 });
      expect(r.finalScore).toBeGreaterThanOrEqual(r.initialScore);
    });
  });

  test('topoloji korunur (gerçek skor zinciri sonrası)', () => {
    var mesh = makeJitteredHexGrid(4, 0.5);
    var r = M.veFEAAutoImproveMeshWithScore(mesh, { targetScore: 90 });
    expect(r.mesh.elements.length).toBe(mesh.elements.length);
    expect(r.mesh.nodes.length).toBe(mesh.nodes.length);
    expect(r.mesh.type).toBe('hex8');
  });
});
