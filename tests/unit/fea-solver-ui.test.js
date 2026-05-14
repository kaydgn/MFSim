/**
 * FEA Çözücü node UI + pipeline entegrasyonu birim testleri
 * - getFEASolverPropertiesHTML render
 * - Yukarı akış (BC → Mesh → Geometry) kontrolü
 * - veFEASolverRun: tam pipeline çözüm
 */

const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '../..');

eval(fs.readFileSync(path.join(ROOT, 'js/components.js'), 'utf8'));
eval(fs.readFileSync(path.join(ROOT, 'js/fea-primitives.js'), 'utf8'));
eval(fs.readFileSync(path.join(ROOT, 'js/fea-materials.js'), 'utf8'));
eval(fs.readFileSync(path.join(ROOT, 'js/fea-topology.js'), 'utf8'));
eval(fs.readFileSync(path.join(ROOT, 'js/fea-mesh.js'), 'utf8'));
eval(fs.readFileSync(path.join(ROOT, 'js/fea-solver.js'), 'utf8'));
eval(fs.readFileSync(path.join(ROOT, 'js/fea-stress.js'), 'utf8'));
eval(fs.readFileSync(path.join(ROOT, 'js/fea-viewer.js'), 'utf8'));
eval(fs.readFileSync(path.join(ROOT, 'js/cp-fea.js'), 'utf8'));

describe('Solver paneli — pipeline durumu', () => {
  test('Hiçbir bağlantı yok → tüm satırlar eksik', () => {
    global.nodes = [{ id: 'sol-1', type: 'fea-solver', data: {} }];
    global.connections = [];
    var html = getFEASolverPropertiesHTML(global.nodes[0]);
    expect(html).toMatch(/Geometri.*eksik/);
    expect(html).toMatch(/Mesh.*eksik/);
    expect(html).toMatch(/Sınır Koşulları.*eksik/);
    expect(html).toMatch(/yukari ak.*eksik/i);
  });

  test('Tam pipeline (geom→mesh→bc→solver) → ÇÖZ butonu aktif', () => {
    var mesh = veFEAMeshFromGeometry({ type: 'box', params: { width: 10, height: 10, depth: 10 } }, { size: 5 });
    global.nodes = [
      { id: 'g', type: 'fea-geometry', data: { geometry: { type: 'box', params: { width: 10, height: 10, depth: 10 } } } },
      { id: 'm', type: 'fea-mesh',     data: { meshData: mesh } },
      { id: 'b', type: 'fea-bc',       data: { bc: { materialId: 'steel-st37', assignments: [
        { faceId: 'faceXMin', kind: 'fixed', value: null, enabled: true },
        { faceId: 'faceXMax', kind: 'force', value: { fx: 100, fy: 0, fz: 0 }, enabled: true }
      ] } } },
      { id: 's', type: 'fea-solver',   data: {} }
    ];
    global.connections = [
      { from: 'g', to: 'm' },
      { from: 'm', to: 'b' },
      { from: 'b', to: 's' }
    ];
    var html = getFEASolverPropertiesHTML(global.nodes[3]);
    expect(html).toMatch(/▶ ÇÖZ/);
    expect(html).not.toMatch(/eksik/);
  });
});

describe('Solver: tam pipeline çözümü', () => {
  beforeEach(() => {
    var mesh = veFEAMeshFromGeometry({ type: 'box', params: { width: 10, height: 10, depth: 10 } }, { size: 5 });
    global.nodes = [
      { id: 'g', type: 'fea-geometry', data: { geometry: { type: 'box', params: { width: 10, height: 10, depth: 10 } } } },
      { id: 'm', type: 'fea-mesh',     data: { meshData: mesh } },
      { id: 'b', type: 'fea-bc',       data: { bc: { materialId: 'steel-st37', assignments: [
        { faceId: 'faceXMin', kind: 'fixed', value: null, enabled: true },
        { faceId: 'faceXMax', kind: 'force', value: { fx: 100, fy: 0, fz: 0 }, enabled: true }
      ] } } },
      { id: 's', type: 'fea-solver',   data: {} }
    ];
    global.connections = [
      { from: 'g', to: 'm' },
      { from: 'm', to: 'b' },
      { from: 'b', to: 's' }
    ];
    global.saveState = jest.fn();
    global.showNodeProperties = jest.fn();
    global.showToast = jest.fn();
  });

  test('veFEASolverRun: results data\'ya yazılır', () => {
    veFEASolverRun('s');
    var d = global.nodes[3].data;
    expect(d.solver).toBeDefined();
    expect(d.solver.results).toBeDefined();
    expect(d.solver.results.maxVonMises).toBeGreaterThan(0);
    expect(d.solver.results.maxDisplacement).toBeGreaterThan(0);
    expect(d.solver.results.totalMass).toBeGreaterThan(0);
    expect(d.solver.results.converged).toBe(true);
    expect(global.saveState).toHaveBeenCalled();
  });

  test('Sonuç var: panel sonuçları gösterir (von Mises, deplasman, FoS)', () => {
    veFEASolverRun('s');
    var html = getFEASolverPropertiesHTML(global.nodes[3]);
    expect(html).toMatch(/Maks\. von Mises/);
    expect(html).toMatch(/Maks\. deplasman/);
    expect(html).toMatch(/Güvenlik faktörü/);
    // Sonuç görselleştirme butonları
    expect(html).toMatch(/von Mises Haritası/);
    expect(html).toMatch(/Deplasman Haritası/);
    expect(html).toMatch(/Deforme Şekil/);
    expect(html).toMatch(/Maks\. Asal Gerilme/);
  });

  test('Pressure BC: F = p·A·n şeklinde dağıtılır', () => {
    // 10×10×10 box, sağ yüze 1 MPa pressure → A = 100 mm², toplam F = 100 N
    global.nodes[2].data.bc.assignments = [
      { faceId: 'faceXMin', kind: 'fixed', value: null, enabled: true },
      { faceId: 'faceXMax', kind: 'pressure', value: { magnitude: 1.0 }, enabled: true }
    ];
    veFEASolverRun('s');
    var d = global.nodes[3].data.solver.results;
    // Stress = 1 MPa beklenir (analitik)
    expect(d.maxVonMises).toBeGreaterThan(0);
    expect(d.maxVonMises).toBeLessThan(5);  // 1 MPa civarında ±20% (mesh sınırlamaları)
  });
});

describe('Solver tolerance ayarı', () => {
  test('veFEASolverSetTol: tolerans güncellenir', () => {
    global.nodes = [{ id: 's', type: 'fea-solver', data: {} }];
    veFEASolverSetTol('s', '1e-6');
    expect(global.nodes[0].data.solver.tolerance).toBe(1e-6);
  });
});

describe('Hata yönetimi', () => {
  beforeEach(() => {
    global.nodes = [{ id: 's', type: 'fea-solver', data: {} }];
    global.connections = [];
    global.saveState = jest.fn();
    global.showNodeProperties = jest.fn();
    global.showToast = jest.fn();
  });

  test('veFEASolverRun: pipeline eksik → toast error', () => {
    veFEASolverRun('s');
    expect(global.showToast).toHaveBeenCalledWith(expect.stringMatching(/mesh veya BC/i), 'error');
    expect(global.nodes[0].data.solver).toBeUndefined();
  });
});
