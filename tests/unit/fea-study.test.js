/**
 * FEA Study — birleşik "Yapısal Analiz" modülü + migration testleri (Faz 1)
 *  - veFEACreateModuleData: birleşik veri modeli
 *  - veFEAMigrateChainToModule: eski 4-node zinciri → tek 'fea' node
 *  - Idempotency, veri korunması, bağlantı temizliği
 *  - Birleşik node + outline entegrasyonu (geometry/bc/solver dal state'leri)
 *  - Upstream helper'ların tek-node-farkındalığı
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '../..');

eval(fs.readFileSync(path.join(ROOT, 'js/components.js'), 'utf8'));
eval(fs.readFileSync(path.join(ROOT, 'js/fea-primitives.js'), 'utf8'));
eval(fs.readFileSync(path.join(ROOT, 'js/fea-step.js'), 'utf8'));
eval(fs.readFileSync(path.join(ROOT, 'js/fea-topology.js'), 'utf8'));
eval(fs.readFileSync(path.join(ROOT, 'js/fea-mesh.js'), 'utf8'));
eval(fs.readFileSync(path.join(ROOT, 'js/fea-study.js'), 'utf8'));
eval(fs.readFileSync(path.join(ROOT, 'js/fea-mesh-outline.js'), 'utf8'));
eval(fs.readFileSync(path.join(ROOT, 'js/fea-mesh-controls.js'), 'utf8'));
eval(fs.readFileSync(path.join(ROOT, 'js/fea-viewer.js'), 'utf8'));
eval(fs.readFileSync(path.join(ROOT, 'js/cp-fea.js'), 'utf8'));

beforeEach(() => {
  global.nodes = [];
  global.connections = [];
  global.saveState = jest.fn();
});

// Eski 4-node zincir state fixture'ı
function legacyChainState() {
  return {
    nodes: [
      { id: 'comp-1', type: 'fea-geometry', x: 100, y: 100, width: 65, height: 60,
        data: { geometry: { type: 'box', params: { width: 10, height: 10, depth: 10 }, sourceLabel: 'Kutu' } } },
      { id: 'comp-2', type: 'fea-mesh', x: 245, y: 100, width: 65, height: 60,
        data: { meshSettings: { size: 5, mode: 'auto', faceSizingControls: [{ faceId: 2, size: 1 }] },
                meshActive: true, meshMetrics: { nodeCount: 100, elementCount: 50 } } },
      { id: 'comp-3', type: 'fea-bc', x: 100, y: 230, width: 65, height: 60,
        data: { bc: { materialId: 'alu-6061', assignments: [{ faceId: 0, kind: 'fixed' }, { faceId: 1, kind: 'force', value: { fx: 100 } }] } } },
      { id: 'comp-4', type: 'fea-solver', x: 245, y: 230, width: 65, height: 60,
        data: { solver: { tolerance: 1e-9, results: { maxVonMises: 123 } } } }
    ],
    connections: [
      { id: 'conn-1', from: 'comp-1', to: 'comp-2' },
      { id: 'conn-2', from: 'comp-2', to: 'comp-3' },
      { id: 'conn-3', from: 'comp-3', to: 'comp-4' }
    ]
  };
}

describe('veFEACreateModuleData', () => {
  test('birleşik veri modeli tüm sub-bölümleri içerir', () => {
    const d = veFEACreateModuleData();
    expect(d).toHaveProperty('geometry', null);
    expect(d).toHaveProperty('meshSettings');
    expect(d).toHaveProperty('bc');
    expect(d).toHaveProperty('solver');
    expect(d.meshSettings.bodySizingControls).toEqual([]);
    expect(d.meshSettings.suppressFlags).toEqual({});
    expect(d.bc.assignments).toEqual([]);
    expect(d.solver.tolerance).toBeGreaterThan(0);
  });
});

describe('veFEAModuleHasChain', () => {
  test('eski zincir varsa true', () => {
    expect(veFEAModuleHasChain(legacyChainState())).toBe(true);
  });
  test('FEA içermeyen state için false', () => {
    expect(veFEAModuleHasChain({ nodes: [{ type: 'engine' }], connections: [] })).toBe(false);
  });
  test('sadece modül node\'u olan state için false', () => {
    expect(veFEAModuleHasChain({ nodes: [{ type: 'fea' }], connections: [] })).toBe(false);
  });
});

describe('veFEAMigrateChainToModule', () => {
  test('4-node zinciri tek fea node\'una indirir', () => {
    const state = legacyChainState();
    veFEAMigrateChainToModule(state);
    const feaNodes = state.nodes.filter((n) => n.type === 'fea');
    const childNodes = state.nodes.filter((n) => ['fea-geometry', 'fea-mesh', 'fea-bc', 'fea-solver'].indexOf(n.type) >= 0);
    expect(feaNodes).toHaveLength(1);
    expect(childNodes).toHaveLength(0);
  });

  test('migration tüm sub-data\'yı korur', () => {
    const state = legacyChainState();
    veFEAMigrateChainToModule(state);
    const fea = state.nodes.find((n) => n.type === 'fea');
    expect(fea.data.geometry.type).toBe('box');
    expect(fea.data.geometry.sourceLabel).toBe('Kutu');
    expect(fea.data.meshSettings.size).toBe(5);
    expect(fea.data.meshSettings.faceSizingControls).toEqual([{ faceId: 2, size: 1 }]);
    expect(fea.data.meshActive).toBe(true);
    expect(fea.data.meshMetrics.nodeCount).toBe(100);
    expect(fea.data.bc.materialId).toBe('alu-6061');
    expect(fea.data.bc.assignments).toHaveLength(2);
    expect(fea.data.solver.tolerance).toBe(1e-9);
    expect(fea.data.solver.results.maxVonMises).toBe(123);
  });

  test('migration yeni mesh kontrol alanlarını default\'tan tamamlar', () => {
    const state = legacyChainState();
    veFEAMigrateChainToModule(state);
    const fea = state.nodes.find((n) => n.type === 'fea');
    // Eski meshSettings'te yoktu — default boş dizilerle gelir
    expect(fea.data.meshSettings.bodySizingControls).toEqual([]);
    expect(fea.data.meshSettings.refinementControls).toEqual([]);
    expect(fea.data.meshSettings.methodOverrides).toEqual([]);
    expect(fea.data.meshSettings.suppressFlags).toEqual({});
  });

  test('migration zincir bağlantılarını temizler', () => {
    const state = legacyChainState();
    veFEAMigrateChainToModule(state);
    expect(state.connections).toHaveLength(0);
  });

  test('modül node geometri node\'unun konumunu/ID\'sini devralır (anchor)', () => {
    const state = legacyChainState();
    veFEAMigrateChainToModule(state);
    const fea = state.nodes.find((n) => n.type === 'fea');
    expect(fea.id).toBe('comp-1');
    expect(fea.x).toBe(100);
    expect(fea.y).toBe(100);
  });

  test('idempotent: FEA içermeyen state dokunulmaz', () => {
    const state = { nodes: [{ id: 'e1', type: 'engine', data: {} }], connections: [] };
    const before = JSON.stringify(state);
    veFEAMigrateChainToModule(state);
    expect(JSON.stringify(state)).toBe(before);
  });

  test('idempotent: zaten modül olan state ikinci kez göçürülmez', () => {
    const state = legacyChainState();
    veFEAMigrateChainToModule(state);
    const after1 = JSON.stringify(state);
    veFEAMigrateChainToModule(state);
    expect(JSON.stringify(state)).toBe(after1);
  });

  test('eksik zincir (sadece geometri) yine de tek node üretir', () => {
    const state = {
      nodes: [{ id: 'g1', type: 'fea-geometry', x: 5, y: 5, data: { geometry: { type: 'cylinder', params: {} } } }],
      connections: []
    };
    veFEAMigrateChainToModule(state);
    const fea = state.nodes.find((n) => n.type === 'fea');
    expect(fea).toBeTruthy();
    expect(fea.data.geometry.type).toBe('cylinder');
    // Eksik bölümler default ile dolar
    expect(fea.data.bc.assignments).toEqual([]);
    expect(fea.data.solver).toBeTruthy();
  });

  test('motor/şanzıman node\'ları migration\'dan etkilenmez', () => {
    const state = legacyChainState();
    state.nodes.push({ id: 'eng-1', type: 'engine', x: 500, y: 500, data: { rpm: 2000 } });
    state.connections.push({ id: 'c-x', from: 'eng-1', to: 'eng-1' });
    veFEAMigrateChainToModule(state);
    const eng = state.nodes.find((n) => n.type === 'engine');
    expect(eng).toBeTruthy();
    expect(eng.data.rpm).toBe(2000);
    // engine bağlantısı korunur (FEA zinciriyle alakasız)
    expect(state.connections.find((c) => c.from === 'eng-1')).toBeTruthy();
  });
});

describe('_mergeMeshSettings', () => {
  test('eski değerler korunur, yeni alanlar eklenir', () => {
    const merged = FEAStudy._mergeMeshSettings(
      veFEACreateModuleData().meshSettings,
      { size: 99, curvatureRefinement: { enabled: true } }
    );
    expect(merged.size).toBe(99);
    expect(merged.curvatureRefinement.enabled).toBe(true);
    expect(merged.bodySizingControls).toEqual([]);
    expect(merged.suppressFlags).toEqual({});
  });
});

describe('Birleşik node + outline entegrasyonu', () => {
  function makeModuleNode(data) {
    return { id: 'fea-1', type: 'fea', data: Object.assign(veFEACreateModuleData(), data || {}) };
  }

  test('single:geometry — geometri tanımsız → underdefined, tanımlı → ok', () => {
    const node = makeModuleNode();
    global.nodes = [node];
    expect(FEAMeshOutline.computeNodeState(node, 'single:geometry')).toBe('underdefined');
    node.data.geometry = { type: 'box', params: {} };
    expect(FEAMeshOutline.computeNodeState(node, 'single:geometry')).toBe('ok');
  });

  test('single:bc — atama yoksa info, varsa ok', () => {
    const node = makeModuleNode();
    global.nodes = [node];
    expect(FEAMeshOutline.computeNodeState(node, 'single:bc')).toBe('info');
    node.data.bc.assignments.push({ faceId: 0, kind: 'fixed' });
    expect(FEAMeshOutline.computeNodeState(node, 'single:bc')).toBe('ok');
  });

  test('single:solver — sonuç yoksa info, varsa ok', () => {
    const node = makeModuleNode();
    global.nodes = [node];
    expect(FEAMeshOutline.computeNodeState(node, 'single:solver')).toBe('info');
    node.data.solver.results = { maxVonMises: 50 };
    expect(FEAMeshOutline.computeNodeState(node, 'single:solver')).toBe('ok');
  });

  test('outline mesh kontrolleri birleşik node\'da çalışır', () => {
    const node = makeModuleNode();
    global.nodes = [node];
    FEAMeshOutline.init('fea-1');
    FEAMeshOutline.addControl('bodySizing');
    expect(node.data.meshSettings.bodySizingControls).toHaveLength(1);
  });

  test('renderDetails single:geometry → geometri paneli çağrılır', () => {
    const node = makeModuleNode({ geometry: { type: 'box', params: { width: 10, height: 10, depth: 10 } } });
    global.nodes = [node];
    FEAMeshOutline.init('fea-1');
    FEAMeshOutline.select('single:geometry');
    const html = FEAMeshOutline.renderDetails();
    expect(typeof html).toBe('string');
    expect(html.length).toBeGreaterThan(50);
  });

  test('renderDetails single:bc → BC paneli çağrılır', () => {
    const node = makeModuleNode({ geometry: { type: 'box', params: { width: 10, height: 10, depth: 10 } } });
    global.nodes = [node];
    FEAMeshOutline.init('fea-1');
    FEAMeshOutline.select('single:bc');
    const html = FEAMeshOutline.renderDetails();
    expect(html).toMatch(/Malzeme|Sınır Koşul|Fixed|Yüzey/);
  });
});

describe('Upstream helper tek-node-farkındalığı', () => {
  test('_veFEAFindUpstreamGeometryNode birleşik node\'u kendisi döndürür', () => {
    const node = { id: 'fea-1', type: 'fea', data: { geometry: { type: 'box' }, meshSettings: {}, bc: {}, solver: {} } };
    global.nodes = [node];
    global.connections = [];
    expect(_veFEAFindUpstreamGeometryNode(node)).toBe(node);
  });

  test('_veFEAFindUpstreamMeshNode birleşik node\'u kendisi döndürür', () => {
    const node = { id: 'fea-1', type: 'fea', data: { meshSettings: { size: 5 }, bc: {}, solver: {} } };
    global.nodes = [node];
    global.connections = [];
    expect(_veFEAFindUpstreamMeshNode(node)).toBe(node);
  });

  test('_veFEAFindUpstreamBCNode birleşik node\'u kendisi döndürür', () => {
    const node = { id: 'fea-1', type: 'fea', data: { bc: { assignments: [] }, solver: {} } };
    global.nodes = [node];
    global.connections = [];
    expect(_veFEAFindUpstreamBCNode(node)).toBe(node);
  });

  test('eski 4-node zincirde traversal hâlâ çalışır (geriye uyum)', () => {
    const geom = { id: 'g', type: 'fea-geometry', data: { geometry: { type: 'box' } } };
    const mesh = { id: 'm', type: 'fea-mesh', data: { meshSettings: {} } };
    global.nodes = [geom, mesh];
    global.connections = [{ from: 'g', to: 'm' }];
    // mesh node'unun upstream geometrisi = geom (connection üzerinden)
    expect(_veFEAFindUpstreamGeometryNode(mesh)).toBe(geom);
  });
});
