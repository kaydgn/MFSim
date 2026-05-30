/**
 * MFSim FEA — ANSYS-tarzı mesh kalite skoru testleri.
 *
 * Doğrulanan:
 *  1. veFEAComputeMeshQualityScore: 0-100 skor + grade + rating + recommendation.
 *  2. Mükemmel mesh (box hex8) → yüksek skor (A).
 *  3. Inverted eleman → veto (skor ≤ 25, grade F, valid:false).
 *  4. Skor metrikleri tutarlı (minOQ, maxSkew, avgEQ).
 *  5. UI entegrasyonu: viewer skoru hesaplıyor, editor rozet HTML üretiyor.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '../..');

// fea-mesh.js + smoothing global yükle
const smoothSrc = fs.readFileSync(path.join(ROOT, 'js/fea-mesh-smoothing.js'), 'utf8');
const meshSrc = fs.readFileSync(path.join(ROOT, 'js/fea-mesh.js'), 'utf8');
const G = {};
new Function('module', 'exports', smoothSrc +
  '\n;Object.assign(exports,{veFEASmoothMesh,veFEAMeshBuildTopology});')({ exports: G }, G);
global.veFEASmoothMesh = G.veFEASmoothMesh;
const M = {};
new Function('module', 'exports', meshSrc +
  '\n;Object.assign(exports,{veFEAMeshFromGeometry, veFEAComputeMeshQualityScore, veFEAComputeQualityMetrics});'
)({ exports: M }, M);

describe('Mesh kalite skoru — temel', () => {
  test('mükemmel box hex8 → yüksek skor (A/Mükemmel)', () => {
    var mesh = M.veFEAMeshFromGeometry({ type:'box', params:{ width:20, height:20, depth:20 } }, { size:5 });
    var s = M.veFEAComputeMeshQualityScore(mesh);
    expect(s).not.toBeNull();
    expect(s.score).toBeGreaterThanOrEqual(90);
    expect(s.grade).toBe('A');
    expect(s.valid).toBe(true);
    expect(s.metrics.minOrthogonalQuality).toBeGreaterThan(0.9);
  });

  test('skor alanları tam ve tipleri doğru', () => {
    var mesh = M.veFEAMeshFromGeometry({ type:'cylinder', params:{ radius:10, height:20 } }, { size:5 });
    var s = M.veFEAComputeMeshQualityScore(mesh);
    expect(typeof s.score).toBe('number');
    expect(s.score).toBeGreaterThanOrEqual(0);
    expect(s.score).toBeLessThanOrEqual(100);
    expect(typeof s.grade).toBe('string');
    expect(typeof s.rating).toBe('string');
    expect(typeof s.recommendation).toBe('string');
    expect(s.metrics).toBeDefined();
    expect(s.subScores).toBeDefined();
  });

  test('inverted eleman → veto (skor ≤ 25, grade F, valid:false)', () => {
    // Manuel inverted tet mesh (negatif hacim)
    var mesh = {
      type:'tet4',
      nodes:new Float32Array([0,0,0, 1,0,0, 0,1,0, 0.3,0.3,-1]), // son düğüm aşağıda → inverted
      elements:new Uint32Array([0,1,2,3]),
      nodesPerElement:4
    };
    var s = M.veFEAComputeMeshQualityScore(mesh);
    expect(s.valid).toBe(false);
    expect(s.score).toBeLessThanOrEqual(25);
    expect(s.grade).toBe('F');
    expect(s.recommendation).toMatch(/[Ii]nverted|degenerate/);
  });

  test('boş/geçersiz mesh → null', () => {
    expect(M.veFEAComputeMeshQualityScore(null)).toBeNull();
    expect(M.veFEAComputeMeshQualityScore({ error:'x' })).toBeNull();
  });

  test('grade monoton: daha iyi metrik → daha yüksek/eşit skor', () => {
    var box = M.veFEAComputeMeshQualityScore(
      M.veFEAMeshFromGeometry({ type:'box', params:{ width:20, height:20, depth:20 } }, { size:5 }));
    var sphere = M.veFEAComputeMeshQualityScore(
      M.veFEAMeshFromGeometry({ type:'sphere', params:{ radius:25 } }, { size:8 }));
    // box (mükemmel hex) ≥ sphere (cubed-sphere köşe sıkışması)
    expect(box.score).toBeGreaterThanOrEqual(sphere.score);
  });
});

describe('Mesh kalite skoru — UI entegrasyonu', () => {
  test('fea-viewer.js qualityScore hesaplıyor', () => {
    const src = fs.readFileSync(path.join(ROOT, 'js/fea-viewer.js'), 'utf8');
    expect(src).toMatch(/metrics\.qualityScore\s*=\s*veFEAComputeMeshQualityScore/);
  });

  test('fea-mesh-editor.js skor rozeti HTML üretiyor', () => {
    const src = fs.readFileSync(path.join(ROOT, 'js/fea-mesh-editor.js'), 'utf8');
    expect(src).toMatch(/metrics\.qualityScore/);
    expect(src).toMatch(/qs\.score/);
    expect(src).toMatch(/qs\.grade/);
  });
});
