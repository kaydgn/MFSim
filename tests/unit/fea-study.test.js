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

  test('renderDetails single:material → Malzeme paneli çağrılır', () => {
    const node = makeModuleNode({ geometry: { type: 'box', params: { width: 10, height: 10, depth: 10 } } });
    global.nodes = [node];
    FEAMeshOutline.init('fea-1');
    FEAMeshOutline.select('single:material');
    const html = FEAMeshOutline.renderDetails();
    expect(html).toMatch(/Malzeme/);
  });

  test('cl:bc grup özeti → "+ Yeni Sınır Koşulu" + ekle', () => {
    const node = makeModuleNode({ geometry: { type: 'box', params: { width: 10, height: 10, depth: 10 } } });
    global.nodes = [node];
    FEAMeshOutline.init('fea-1');
    FEAMeshOutline.select('cl:bc');
    const html = FEAMeshOutline.renderDetails();
    expect(html).toMatch(/Sınır Koşulu/);
    expect(html).toContain('addControl');
  });

  test('BC öğesi: yüz + tip ile state hesabı', () => {
    const node = makeModuleNode({ geometry: { type: 'box', params: { width: 10, height: 10, depth: 10 } } });
    node.data.bc.assignments = [
      { faceId: null, kind: 'fixed' },                       // yüz yok → underdefined
      { faceId: 0, kind: 'fixed' },                          // OK
      { faceId: 1, kind: 'pressure', value: { magnitude: 0 } } // magnitude 0 → underdefined
    ];
    global.nodes = [node];
    FEAMeshOutline.init('fea-1');
    expect(FEAMeshOutline.computeNodeState(node, 'cl:bc[0]')).toBe('underdefined');
    expect(FEAMeshOutline.computeNodeState(node, 'cl:bc[1]')).toBe('ok');
    expect(FEAMeshOutline.computeNodeState(node, 'cl:bc[2]')).toBe('underdefined');
  });

  test('result öğesi: çözüm yoksa underdefined, varsa ok', () => {
    const node = makeModuleNode();
    node.data.solver.resultObjects = [{ type: 'vonMises' }];
    global.nodes = [node];
    FEAMeshOutline.init('fea-1');
    expect(FEAMeshOutline.computeNodeState(node, 'cl:result[0]')).toBe('underdefined');
    node.data.solver.results = { maxVonMises: 100 };
    expect(FEAMeshOutline.computeNodeState(node, 'cl:result[0]')).toBe('ok');
  });

  test('addControl bc → bc.assignments\'a ekler', () => {
    const node = makeModuleNode();
    global.nodes = [node];
    FEAMeshOutline.init('fea-1');
    FEAMeshOutline.addControl('bc');
    expect(node.data.bc.assignments).toHaveLength(1);
    expect(node.data.bc.assignments[0].kind).toBe('fixed');
  });

  test('addControl result → solver.resultObjects\'e ekler', () => {
    const node = makeModuleNode();
    global.nodes = [node];
    FEAMeshOutline.init('fea-1');
    FEAMeshOutline.addControl('result');
    expect(node.data.solver.resultObjects).toHaveLength(1);
    expect(node.data.solver.resultObjects[0].type).toBe('vonMises');
  });
});

describe('B.7 — 3D seçili yüzü scope\'a ekle', () => {
  function makeModuleNode(data) {
    return { id: 'fea-1', type: 'fea', data: Object.assign(veFEACreateModuleData(), data || {}) };
  }

  test('_add3DFaceToList: node.data.selectedFaceId Face Sizing scope\'una eklenir', () => {
    const node = makeModuleNode();
    node.data.selectedFaceId = 'faceXMin';
    node.data.meshSettings.faceSizingControls = [{ faceId: null, size: 2 }];
    global.nodes = [node];
    FEAMeshOutline.init('fea-1');
    FEAMeshControls._add3DFaceToList('faceSizing', 0, 'faceIds');
    expect(node.data.meshSettings.faceSizingControls[0].faceIds).toContain('faceXMin');
    expect(node.data.meshSettings.faceSizingControls[0].faceId).toBe('faceXMin');
  });

  test('_set3DFaceToBC: seçili yüz BC\'nin faceId\'si olur', () => {
    const node = makeModuleNode();
    node.data.selectedFaceId = 'faceYMax';
    node.data.bc.assignments = [{ faceId: null, kind: 'fixed' }];
    global.nodes = [node];
    FEAMeshOutline.init('fea-1');
    FEAMeshControls._set3DFaceToBC(0);
    expect(node.data.bc.assignments[0].faceId).toBe('faceYMax');
  });

  test('seçili yüz yoksa no-op (hata atmaz)', () => {
    const node = makeModuleNode();
    node.data.meshSettings.faceSizingControls = [{ faceId: null, size: 2 }];
    global.nodes = [node];
    global.showToast = jest.fn();
    FEAMeshOutline.init('fea-1');
    expect(() => FEAMeshControls._add3DFaceToList('faceSizing', 0, 'faceIds')).not.toThrow();
    expect(node.data.meshSettings.faceSizingControls[0].faceIds || []).toHaveLength(0);
  });

  test('aynı yüz iki kez eklenmez', () => {
    const node = makeModuleNode();
    node.data.selectedFaceId = 'faceZMin';
    node.data.meshSettings.faceSizingControls = [{ faceIds: ['faceZMin'], size: 2 }];
    global.nodes = [node];
    FEAMeshOutline.init('fea-1');
    FEAMeshControls._add3DFaceToList('faceSizing', 0, 'faceIds');
    expect(node.data.meshSettings.faceSizingControls[0].faceIds).toEqual(['faceZMin']);
  });
});

describe('B.6 — multibody veri modeli (per-body resolve)', () => {
  function makeModuleNode(data) {
    return { id: 'fea-1', type: 'fea', data: Object.assign(veFEACreateModuleData(), data || {}) };
  }

  test('Body Sizing farklı body\'ler için bağımsız çözülür', () => {
    const node = makeModuleNode({ meshSettings: Object.assign(veFEACreateModuleData().meshSettings, {
      bodySizingControls: [
        { bodyIds: [0], size: 2, behavior: 'soft' },
        { bodyIds: [1], size: 5, behavior: 'soft' }
      ]
    }) });
    global.nodes = [node];
    FEAMeshOutline.init('fea-1');
    expect(FEAMeshControls.resolveBodySizingFor(node, 0).size).toBe(2);
    expect(FEAMeshControls.resolveBodySizingFor(node, 1).size).toBe(5);
    expect(FEAMeshControls.resolveBodySizingFor(node, 2)).toBeFalsy();  // tanımsız body
  });

  test('Method Override body bazlı çözülür', () => {
    const node = makeModuleNode({ meshSettings: Object.assign(veFEACreateModuleData().meshSettings, {
      methodOverrides: [
        { bodyIds: [0], method: 'sweep' },
        { bodyIds: [1], method: 'hexDominant' }
      ]
    }) });
    global.nodes = [node];
    FEAMeshOutline.init('fea-1');
    expect(FEAMeshControls.resolveBodyMethodOverride(node, 0).method).toBe('sweep');
    expect(FEAMeshControls.resolveBodyMethodOverride(node, 1).method).toBe('hexDominant');
    expect(FEAMeshControls.resolveBodyMethodOverride(node, 9)).toBeFalsy();
  });
});

describe('B.8 — Named Selections DRY (userNS)', () => {
  function makeModuleNode(data) {
    return { id: 'fea-1', type: 'fea', data: Object.assign(veFEACreateModuleData(), data || {}) };
  }

  test('userNS schema topologyTools altında', () => {
    const tt = FEAMeshOutline._findSchemaNode('group:topologyTools');
    const ids = tt.children.map((c) => c.id);
    expect(ids).toContain('cl:userNS');
  });

  test('addControl userNS → userNamedSelections\'a ekler', () => {
    const node = makeModuleNode();
    global.nodes = [node];
    FEAMeshOutline.init('fea-1');
    FEAMeshOutline.addControl('userNS');
    expect(node.data.meshSettings.userNamedSelections).toHaveLength(1);
  });

  test('userNS state: isim+yüz zorunlu', () => {
    const node = makeModuleNode({ meshSettings: Object.assign(veFEACreateModuleData().meshSettings, {
      userNamedSelections: [
        { name: null, faceIds: ['faceXMin'] },        // isim yok → underdefined
        { name: 'Yükleme Yüzleri', faceIds: [] },     // yüz yok → underdefined
        { name: 'Yükleme Yüzleri', faceIds: ['faceXMin', 'faceXMax'] }  // OK
      ]
    }) });
    global.nodes = [node];
    FEAMeshOutline.init('fea-1');
    expect(FEAMeshOutline.computeNodeState(node, 'cl:userNS[0]')).toBe('underdefined');
    expect(FEAMeshOutline.computeNodeState(node, 'cl:userNS[1]')).toBe('underdefined');
    expect(FEAMeshOutline.computeNodeState(node, 'cl:userNS[2]')).toBe('ok');
  });

  test('_importFromNS yüzleri target kontrole kopyalar (duplicate engellenir)', () => {
    const node = makeModuleNode({ meshSettings: Object.assign(veFEACreateModuleData().meshSettings, {
      userNamedSelections: [
        { name: 'Bolt yüzleri', faceIds: ['faceXMin', 'faceXMax'] }
      ],
      faceSizingControls: [{ faceIds: ['faceXMin'], size: 2 }]
    }) });
    global.nodes = [node];
    FEAMeshOutline.init('fea-1');
    FEAMeshControls._importFromNS('faceSizing', 0, 'faceIds', 0);
    const ids = node.data.meshSettings.faceSizingControls[0].faceIds;
    expect(ids).toEqual(['faceXMin', 'faceXMax']);  // dup engellendi, kopyalandı
  });

  test('isimsiz/boş/suppressed NS\'ler import için filtrelenir', () => {
    const node = makeModuleNode({ meshSettings: Object.assign(veFEACreateModuleData().meshSettings, {
      userNamedSelections: [
        { name: null, faceIds: ['faceXMin'] },                  // isim yok
        { name: 'Empty', faceIds: [] },                          // yüz yok
        { name: 'Sup', faceIds: ['faceYMin'] },                  // suppress edilecek
        { name: 'OK', faceIds: ['faceZMin'] }
      ],
      suppressFlags: { 'cl:userNS[2]': true }
    }) });
    global.nodes = [node];
    FEAMeshOutline.init('fea-1');
    const list = FEAMeshOutline._getControlList(node, 'userNS');
    // Sadece "OK" eligible olmalı
    const eligible = list.filter((ns, i) => ns.name && ns.faceIds && ns.faceIds.length > 0 && !FEAMeshOutline.isSuppressed(node, 'cl:userNS[' + i + ']'));
    expect(eligible.map((n) => n.name)).toEqual(['OK']);
  });
});

describe('C.10 — Tree filter / search', () => {
  function makeModuleNode(data) {
    return { id: 'fea-1', type: 'fea', data: Object.assign(veFEACreateModuleData(), data || {}) };
  }

  test('setFilter outline state\'ine yazar', () => {
    const node = makeModuleNode();
    global.nodes = [node];
    FEAMeshOutline.init('fea-1');
    FEAMeshOutline.setFilter('boyut');
    expect(node.data.meshSettings.outline.filter).toBe('boyut');
  });

  test('filter "Sınır" sadece Sınır Koşulları dalını gösterir', () => {
    const node = makeModuleNode();
    global.nodes = [node];
    FEAMeshOutline.init('fea-1');
    FEAMeshOutline.setFilter('Sınır');
    const html = FEAMeshOutline.render();
    expect(html).toMatch(/Sınır Koşulları/);
    expect(html).not.toMatch(/Geometri/);   // root altı geometry dalı görünmez
  });

  test('filter control item label\'ı eşleşince parent görünür', () => {
    const node = makeModuleNode({ meshSettings: Object.assign(veFEACreateModuleData().meshSettings, {
      bodySizingControls: [{ name: 'Bolt holes — sıkı', bodyIds: [0], size: 1 }]
    }) });
    global.nodes = [node];
    FEAMeshOutline.init('fea-1');
    FEAMeshOutline.setFilter('Bolt');
    const html = FEAMeshOutline.render();
    expect(html).toMatch(/Bolt holes/);
    expect(html).toMatch(/Body Sizing/);
    expect(html).toMatch(/Mesh/);  // ancestor görünür
  });

  test('filter boşsa her şey görünür', () => {
    const node = makeModuleNode();
    global.nodes = [node];
    FEAMeshOutline.init('fea-1');
    FEAMeshOutline.setFilter('');
    const html = FEAMeshOutline.render();
    expect(html).toMatch(/Geometri/);
    expect(html).toMatch(/Mesh/);
    expect(html).toMatch(/Sınır Koşulları/);
  });
});

describe('C.11 — Go To (kapsam ters-arama)', () => {
  function makeModuleNode(data) {
    return { id: 'fea-1', type: 'fea', data: Object.assign(veFEACreateModuleData(), data || {}) };
  }

  test('findScopeUsers face\'i kullanan tüm kontrolleri döner', () => {
    const node = makeModuleNode({ meshSettings: Object.assign(veFEACreateModuleData().meshSettings, {
      faceSizingControls: [{ faceIds: ['faceXMin', 'faceYMax'], size: 2 }],
      refinementControls: [{ entityType: 'face', faceIds: ['faceXMin'], level: 2 }],
      virtualTopology: [{ faceIds: ['faceXMax', 'faceYMax'] }]
    }) });
    node.data.bc.assignments = [{ faceId: 'faceXMin', kind: 'fixed' }];
    global.nodes = [node];
    FEAMeshOutline.init('fea-1');
    const users = FEAMeshOutline.findScopeUsers(node, 'faceXMin');
    const types = users.map((u) => u.controlType).sort();
    expect(types).toEqual(['bc', 'faceSizing', 'refinement']);
    users.forEach((u) => expect(u.outlineId).toMatch(/^cl:[a-zA-Z]+\[\d+\]$/));
  });

  test('findScopeUsers eşleşme yoksa boş dizi', () => {
    const node = makeModuleNode();
    global.nodes = [node];
    FEAMeshOutline.init('fea-1');
    expect(FEAMeshOutline.findScopeUsers(node, 'faceXMin')).toEqual([]);
  });

  test('string/number faceId esnek eşleşir', () => {
    const node = makeModuleNode({ meshSettings: Object.assign(veFEACreateModuleData().meshSettings, {
      faceSizingControls: [{ faceIds: [3], size: 1 }]
    }) });
    global.nodes = [node];
    FEAMeshOutline.init('fea-1');
    expect(FEAMeshOutline.findScopeUsers(node, '3')).toHaveLength(1);
    expect(FEAMeshOutline.findScopeUsers(node, 3)).toHaveLength(1);
  });

  test('showScopeUsersForSelected: yüz seçili değilse no-op (showToast)', () => {
    const node = makeModuleNode();
    global.nodes = [node];
    global.showToast = jest.fn();
    FEAMeshOutline.init('fea-1');
    FEAMeshOutline.showScopeUsersForSelected();
    expect(global.showToast).toHaveBeenCalled();
    expect(node.data.meshSettings.outline.goToFaceId).toBeUndefined();
  });

  test('seçili yüzle Go To → outline state\'e goToFaceId yazılır + render banner', () => {
    const node = makeModuleNode({ meshSettings: Object.assign(veFEACreateModuleData().meshSettings, {
      faceSizingControls: [{ faceIds: ['faceXMin'], size: 2 }]
    }) });
    node.data.selectedFaceId = 'faceXMin';
    global.nodes = [node];
    FEAMeshOutline.init('fea-1');
    FEAMeshOutline.showScopeUsersForSelected();
    expect(node.data.meshSettings.outline.goToFaceId).toBe('faceXMin');
    const html = FEAMeshOutline.render();
    expect(html).toMatch(/Bu yüze scope edilen/);
    expect(html).toMatch(/faceXMin/);
  });

  test('clearGoTo banner\'ı kaldırır', () => {
    const node = makeModuleNode();
    node.data.meshSettings.outline = { selected:'single:geometry', expanded:{}, splitPct:50, filter:'', goToFaceId:'faceXMin' };
    global.nodes = [node];
    FEAMeshOutline.init('fea-1');
    FEAMeshOutline.clearGoTo();
    expect(node.data.meshSettings.outline.goToFaceId).toBeUndefined();
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
