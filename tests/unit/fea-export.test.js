/**
 * FEA Export — birim testleri (Tier 3.14)
 *  - Abaqus .inp
 *  - NASTRAN .nas
 *  - VTK .vtk
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '../..');

eval(fs.readFileSync(path.join(ROOT, 'js/components.js'), 'utf8'));
eval(fs.readFileSync(path.join(ROOT, 'js/fea-primitives.js'), 'utf8'));
eval(fs.readFileSync(path.join(ROOT, 'js/fea-stl.js'), 'utf8'));
eval(fs.readFileSync(path.join(ROOT, 'js/fea-step.js'), 'utf8'));
eval(fs.readFileSync(path.join(ROOT, 'js/fea-topology.js'), 'utf8'));
eval(fs.readFileSync(path.join(ROOT, 'js/fea-mesh.js'), 'utf8'));
// veFEAMeshCache fea-viewer.js'te tanımlı; export bridge için stub:
var veFEAMeshCache = {};
eval(fs.readFileSync(path.join(ROOT, 'js/fea-export.js'), 'utf8'));

// ────────────────────────────────────────────────────────────────────────────
describe('veFEAExportAbaqus', () => {
  test('Hex8 mesh → C3D8 element type ile *NODE + *ELEMENT', () => {
    var m = veFEAMeshFromGeometry({ type: 'box', params: { width: 10, height: 10, depth: 10 } }, { size: 5 });
    var inp = veFEAExportAbaqus(m);
    expect(inp).toMatch(/\*NODE/);
    expect(inp).toMatch(/\*ELEMENT, TYPE=C3D8/);
    expect(inp).toMatch(/MFSim/);
    expect(inp.split('\n').length).toBeGreaterThan(20);
  });

  test('Tet4 mesh → C3D4', () => {
    var m = veFEAMeshFromGeometry({ type: 'box', params: { width: 10, height: 10, depth: 10 } }, { size: 5, elementType: 'tet4' });
    var inp = veFEAExportAbaqus(m);
    expect(inp).toMatch(/TYPE=C3D4/);
  });

  test('Hex20 mesh → C3D20', () => {
    var m = veFEAMeshFromGeometry({ type: 'box', params: { width: 10, height: 10, depth: 10 } }, { size: 5, midSideNodes: true });
    var inp = veFEAExportAbaqus(m);
    expect(inp).toMatch(/TYPE=C3D20/);
  });

  test('Wedge6 mesh → C3D6 (legacy crossSection:"wedge")', () => {
    var m = veFEAMeshFromGeometry({ type: 'cylinder', params: { radius: 5, height: 10 } }, { size: 5, crossSection: 'wedge' });
    var inp = veFEAExportAbaqus(m);
    expect(inp).toMatch(/TYPE=C3D6/);
  });

  test('Named selections *NSET olarak yazılır', () => {
    var m = veFEAMeshFromGeometry({ type: 'box', params: { width: 10, height: 10, depth: 10 } }, { size: 5 });
    var inp = veFEAExportAbaqus(m);
    expect(inp).toMatch(/\*NSET, NSET=FACEXMIN/);
    expect(inp).toMatch(/\*NSET, NSET=FACEYMAX/);
  });

  test('Node ID\'leri 1-based (Abaqus standardı)', () => {
    var m = veFEAMeshFromGeometry({ type: 'box', params: { width: 1, height: 1, depth: 1 } }, { size: 1 });
    var inp = veFEAExportAbaqus(m);
    // İlk düğüm 1, son düğüm 8 olmalı
    expect(inp).toMatch(/^1, [\d.\-]+, [\d.\-]+, [\d.\-]+$/m);
    expect(inp).toMatch(/^8, [\d.\-]+, [\d.\-]+, [\d.\-]+$/m);
  });

  test('Tri3 yüzey mesh → S3 element', () => {
    var tri = {
      type: 'tri3',
      nodes: new Float32Array([0,0,0, 1,0,0, 0,1,0]),
      elements: new Uint32Array([0, 1, 2]),
      nodesPerElement: 3
    };
    var inp = veFEAExportAbaqus(tri);
    expect(inp).toMatch(/TYPE=S3/);
  });

  test('null/error mesh → null', () => {
    expect(veFEAExportAbaqus(null)).toBeNull();
    expect(veFEAExportAbaqus({ error: 'voxel-too-many' })).toBeNull();
  });
});

// ────────────────────────────────────────────────────────────────────────────
describe('veFEAExportNASTRAN', () => {
  test('Hex8 → CHEXA + GRID kartları', () => {
    var m = veFEAMeshFromGeometry({ type: 'box', params: { width: 10, height: 10, depth: 10 } }, { size: 5 });
    var nas = veFEAExportNASTRAN(m);
    expect(nas).toMatch(/BEGIN BULK/);
    expect(nas).toMatch(/GRID,1,,/);
    expect(nas).toMatch(/CHEXA,1,1,/);
    expect(nas).toMatch(/ENDDATA/);
  });

  test('Tet4 → CTETRA', () => {
    var m = veFEAMeshFromGeometry({ type: 'box', params: { width: 10, height: 10, depth: 10 } }, { size: 5, elementType: 'tet4' });
    var nas = veFEAExportNASTRAN(m);
    expect(nas).toMatch(/CTETRA,1,1,/);
  });

  test('Wedge6 → CPENTA (legacy crossSection:"wedge")', () => {
    var m = veFEAMeshFromGeometry({ type: 'cylinder', params: { radius: 5, height: 10 } }, { size: 5, crossSection: 'wedge' });
    var nas = veFEAExportNASTRAN(m);
    expect(nas).toMatch(/CPENTA,1,1,/);
  });

  test('PSOLID + MAT1 default kartlar', () => {
    var m = veFEAMeshFromGeometry({ type: 'box', params: { width: 10, height: 10, depth: 10 } }, { size: 5 });
    var nas = veFEAExportNASTRAN(m);
    expect(nas).toMatch(/PSOLID,1,1/);
    expect(nas).toMatch(/MAT1,1,/);
  });

  test('null mesh → null', () => {
    expect(veFEAExportNASTRAN(null)).toBeNull();
  });
});

// ────────────────────────────────────────────────────────────────────────────
describe('veFEAExportVTK', () => {
  test('Hex8 → VTK CELL_TYPES 12', () => {
    var m = veFEAMeshFromGeometry({ type: 'box', params: { width: 10, height: 10, depth: 10 } }, { size: 5 });
    var vtk = veFEAExportVTK(m);
    expect(vtk).toMatch(/vtk DataFile Version 3.0/);
    expect(vtk).toMatch(/ASCII/);
    expect(vtk).toMatch(/DATASET UNSTRUCTURED_GRID/);
    expect(vtk).toMatch(/CELL_TYPES 8/);
    expect(vtk).toMatch(/^12$/m); // hex8 cell type
  });

  test('Tet4 → CELL_TYPES 10', () => {
    var m = veFEAMeshFromGeometry({ type: 'box', params: { width: 10, height: 10, depth: 10 } }, { size: 5, elementType: 'tet4' });
    var vtk = veFEAExportVTK(m);
    expect(vtk).toMatch(/^10$/m);
  });

  test('POINTS sayısı düğüm sayısına eşit', () => {
    var m = veFEAMeshFromGeometry({ type: 'box', params: { width: 1, height: 1, depth: 1 } }, { size: 1 });
    var vtk = veFEAExportVTK(m);
    expect(vtk).toMatch(/POINTS 8 float/);
  });

  test('CELLS toplam integer sayısı = nElem * (1 + per)', () => {
    var m = veFEAMeshFromGeometry({ type: 'box', params: { width: 1, height: 1, depth: 1 } }, { size: 1 });
    var vtk = veFEAExportVTK(m);
    // 1 hex × (1 + 8) = 9
    expect(vtk).toMatch(/CELLS 1 9/);
  });

  test('Node ID\'leri 0-based (VTK standardı), hex8 CCW ordering', () => {
    var m = veFEAMeshFromGeometry({ type: 'box', params: { width: 1, height: 1, depth: 1 } }, { size: 1 });
    var vtk = veFEAExportVTK(m);
    // hex8 düğüm sırası: alt CCW + üst CCW → 0,1,3,2,4,5,7,6
    // İlk sayı 8 = vertex count per element (VTK convention)
    expect(vtk).toMatch(/^8 0 1 3 2 4 5 7 6$/m);
  });

  test('Hex20 quadratic → cell type 25', () => {
    var m = veFEAMeshFromGeometry({ type: 'box', params: { width: 10, height: 10, depth: 10 } }, { size: 5, midSideNodes: true });
    var vtk = veFEAExportVTK(m);
    expect(vtk).toMatch(/^25$/m);
  });

  test('null mesh → null', () => {
    expect(veFEAExportVTK(null)).toBeNull();
  });
});

// ────────────────────────────────────────────────────────────────────────────
describe('veFEADownloadMeshExport (test ortamında string döner)', () => {
  test('Abaqus format → string içerik', () => {
    var m = veFEAMeshFromGeometry({ type: 'box', params: { width: 10, height: 10, depth: 10 } }, { size: 5 });
    // jsdom var ama jsdom test env'inde document/URL/Blob var
    // download tetiklenir ama download dosyası gelmez — sadece true döner
    var ok = veFEADownloadMeshExport(m, 'abaqus', 'test');
    expect(ok).toBeTruthy();
  });

  test('Bilinmeyen format → false', () => {
    var m = veFEAMeshFromGeometry({ type: 'box', params: { width: 10, height: 10, depth: 10 } }, { size: 5 });
    expect(veFEADownloadMeshExport(m, 'unknown', 'test')).toBe(false);
  });

  test('null mesh → false', () => {
    expect(veFEADownloadMeshExport(null, 'abaqus', 'test')).toBe(false);
  });
});

// ────────────────────────────────────────────────────────────────────────────
describe('veFEAExportMeshForNode (cache köprüsü)', () => {
  beforeEach(() => {
    global.showToast = jest.fn();
    Object.keys(veFEAMeshCache || {}).forEach((k) => delete veFEAMeshCache[k]);
  });

  test('Cache\'te mesh yokken warning toast atar', () => {
    if (typeof veFEAMeshCache === 'undefined') global.veFEAMeshCache = {};
    veFEAExportMeshForNode('nonexistent', 'abaqus');
    expect(global.showToast).toHaveBeenCalled();
    var warnCall = global.showToast.mock.calls.find(function(c) { return c[1] === 'warning'; });
    expect(warnCall).toBeDefined();
  });
});
