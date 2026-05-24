/**
 * FEA Mesh Outline — ANSYS-tarz tree + lokal kontrol testleri
 *  - Schema temel sağlamlığı (root + group + controlList + readonly)
 *  - State hesaplaması: ok / underdefined / suppressed / error
 *  - addControl / removeControl / toggleSuppress / renameControl
 *  - Conflict resolution (hard > soft)
 *  - Suppress flag re-index doğruluğu
 *  - Mevcut Face/Edge sizing listelerinin outline'da görünmesi (backward-compat)
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '../..');

// Sıralı load — outline ve controls fea-mesh-editor'dan ÖNCE
eval(fs.readFileSync(path.join(ROOT, 'js/components.js'), 'utf8'));
eval(fs.readFileSync(path.join(ROOT, 'js/fea-mesh-outline.js'), 'utf8'));
eval(fs.readFileSync(path.join(ROOT, 'js/fea-mesh-controls.js'), 'utf8'));

// Global'leri jsdom'da window'a da bağla (eval modülleri var ile global'e yazıyor;
// FEAMeshOutline/FEAMeshControls window.X = ... atıyor ve window referansı global)
beforeAll(() => {
  // Jest jsdom: window mevcut. Hep set olmuş olsun:
  if (typeof window !== 'undefined') {
    if (!window.FEAMeshOutline)  window.FEAMeshOutline  = global.FEAMeshOutline  || FEAMeshOutline;
    if (!window.FEAMeshControls) window.FEAMeshControls = global.FEAMeshControls || FEAMeshControls;
  }
});

function makeMeshNode(extraSettings) {
  return {
    id: 'mesh-1',
    type: 'fea-mesh',
    data: {
      meshSettings: Object.assign({
        size: 10,
        bodySizingControls: [],
        faceSizingControls: [],
        edgeSizingControls: [],
        sphereOfInfluence: [],
        refinementControls: [],
        methodOverrides: [],
        virtualTopology: [],
        suppressFlags: {}
      }, extraSettings || {})
    }
  };
}

beforeEach(() => {
  global.nodes = [];
  global.connections = [];
  global.saveState = jest.fn();
});

describe('FEAMeshOutline — schema', () => {
  test('SCHEMA root is study-level (Yapısal Analiz) with geometry/material/mesh/bc/solution branches', () => {
    const schema = FEAMeshOutline._SCHEMA;
    expect(schema.id).toBe('root');
    expect(schema.type).toBe('root');
    expect(schema.label).toBe('Yapısal Analiz');
    const childIds = schema.children.map((c) => c.id);
    expect(childIds).toEqual(['single:geometry', 'group:mesh', 'single:material', 'cl:bc', 'group:solution']);
  });

  test('Mesh subtree contains globals/localControls/topologyTools/inspect groups', () => {
    const mesh = FEAMeshOutline._findSchemaNode('group:mesh');
    expect(mesh).toBeTruthy();
    const childIds = mesh.children.map((c) => c.id);
    expect(childIds).toContain('group:globals');
    expect(childIds).toContain('group:localControls');
    expect(childIds).toContain('group:topologyTools');
    expect(childIds).toContain('group:inspect');
  });

  test('group:localControls contains expected control list types', () => {
    const lc = FEAMeshOutline._findSchemaNode('group:localControls');
    expect(lc).toBeDefined();
    const ctlTypes = lc.children.map((c) => c.controlType).filter(Boolean);
    expect(ctlTypes).toEqual(expect.arrayContaining([
      'bodySizing', 'faceSizing', 'edgeSizing', 'soi', 'refinement', 'methodOverride'
    ]));
  });

  test('_findSchemaNode locates known IDs', () => {
    expect(FEAMeshOutline._findSchemaNode('root')).toBeTruthy();
    expect(FEAMeshOutline._findSchemaNode('cl:bodySizing')).toBeTruthy();
    expect(FEAMeshOutline._findSchemaNode('inspect:quality')).toBeTruthy();
    expect(FEAMeshOutline._findSchemaNode('does:not:exist')).toBeFalsy();
  });
});

describe('FEAMeshOutline — outline id parsing', () => {
  test('_controlOutlineId and _parseControlOutlineId roundtrip', () => {
    const id = FEAMeshOutline._controlOutlineId('faceSizing', 3);
    expect(id).toBe('cl:faceSizing[3]');
    const parsed = FEAMeshOutline._parseControlOutlineId(id);
    expect(parsed).toEqual({ controlType: 'faceSizing', index: 3 });
  });

  test('_parseControlOutlineId rejects non-control IDs', () => {
    expect(FEAMeshOutline._parseControlOutlineId('group:globals')).toBeNull();
    expect(FEAMeshOutline._parseControlOutlineId('single:sizing')).toBeNull();
    expect(FEAMeshOutline._parseControlOutlineId('inspect:quality')).toBeNull();
  });
});

describe('FEAMeshOutline — state computation', () => {
  test('empty control list → group state is "info"', () => {
    const node = makeMeshNode();
    global.nodes = [node];
    expect(FEAMeshOutline.computeNodeState(node, 'cl:bodySizing')).toBe('info');
  });

  test('bodySizing control with no bodyIds → "underdefined"', () => {
    const node = makeMeshNode({ bodySizingControls: [{ bodyIds: [], size: 5 }] });
    global.nodes = [node];
    expect(FEAMeshOutline.computeNodeState(node, 'cl:bodySizing[0]')).toBe('underdefined');
    // Group state propagates worst
    expect(FEAMeshOutline.computeNodeState(node, 'cl:bodySizing')).toBe('underdefined');
  });

  test('bodySizing control with valid scope+size → "ok"', () => {
    const node = makeMeshNode({ bodySizingControls: [{ bodyIds: [0], size: 5 }] });
    global.nodes = [node];
    expect(FEAMeshOutline.computeNodeState(node, 'cl:bodySizing[0]')).toBe('ok');
  });

  test('suppress flag overrides any underlying state', () => {
    const node = makeMeshNode({
      bodySizingControls: [{ bodyIds: [], size: null }],     // underdefined
      suppressFlags: { 'cl:bodySizing[0]': true }
    });
    global.nodes = [node];
    expect(FEAMeshOutline.computeNodeState(node, 'cl:bodySizing[0]')).toBe('suppressed');
  });

  test('refinement requires entity list AND level 1-3', () => {
    const node = makeMeshNode({ refinementControls: [
      { entityType: 'face', faceIds: [], level: 2 },                  // no faces → underdefined
      { entityType: 'face', faceIds: [1, 2], level: 5 },              // level > 3 → underdefined
      { entityType: 'face', faceIds: [1, 2], level: 2 }                // OK
    ]});
    global.nodes = [node];
    expect(FEAMeshOutline.computeNodeState(node, 'cl:refinement[0]')).toBe('underdefined');
    expect(FEAMeshOutline.computeNodeState(node, 'cl:refinement[1]')).toBe('underdefined');
    expect(FEAMeshOutline.computeNodeState(node, 'cl:refinement[2]')).toBe('ok');
    // Group: worst of children
    expect(FEAMeshOutline.computeNodeState(node, 'cl:refinement')).toBe('underdefined');
  });

  test('methodOverride needs bodyIds AND method', () => {
    const node = makeMeshNode({ methodOverrides: [
      { bodyIds: [], method: 'sweep' },                                // no body
      { bodyIds: [0], method: null },                                  // no method
      { bodyIds: [0], method: 'sweep' }                                 // OK
    ]});
    global.nodes = [node];
    expect(FEAMeshOutline.computeNodeState(node, 'cl:methodOverride[0]')).toBe('underdefined');
    expect(FEAMeshOutline.computeNodeState(node, 'cl:methodOverride[1]')).toBe('underdefined');
    expect(FEAMeshOutline.computeNodeState(node, 'cl:methodOverride[2]')).toBe('ok');
  });

  test('inspect:quality is "info" when no mesh; "ok" when valid', () => {
    const node = makeMeshNode();
    global.nodes = [node];
    expect(FEAMeshOutline.computeNodeState(node, 'inspect:quality')).toBe('info');
    node.data.meshActive = true;
    node.data.meshMetrics = { jacobian: { valid: true } };
    expect(FEAMeshOutline.computeNodeState(node, 'inspect:quality')).toBe('ok');
    node.data.meshMetrics = { jacobian: { valid: false } };
    expect(FEAMeshOutline.computeNodeState(node, 'inspect:quality')).toBe('error');
  });

  test('_worstState ordering: error > underdefined > suppressed > info > ok', () => {
    const w = FEAMeshOutline._worstState;
    expect(w('ok', 'info')).toBe('info');
    expect(w('info', 'suppressed')).toBe('suppressed');
    expect(w('suppressed', 'underdefined')).toBe('underdefined');
    expect(w('underdefined', 'error')).toBe('error');
    expect(w('error', 'ok')).toBe('error');
  });

  test('mesh build error scoped to a control key → "error"', () => {
    const node = makeMeshNode({ bodySizingControls: [{ bodyIds: [0], size: 5 }] });
    node.data.meshError = { controlKey: 'cl:bodySizing[0]', message: 'fail' };
    global.nodes = [node];
    expect(FEAMeshOutline.computeNodeState(node, 'cl:bodySizing[0]')).toBe('error');
  });
});

describe('FEAMeshOutline — mutations', () => {
  test('addControl appends a control + selects it + auto-expands group', () => {
    const node = makeMeshNode();
    global.nodes = [node];
    FEAMeshOutline.init('mesh-1');
    const newId = FEAMeshOutline.addControl('bodySizing');
    expect(newId).toBe('cl:bodySizing[0]');
    expect(node.data.meshSettings.bodySizingControls).toHaveLength(1);
    const state = node.data.meshSettings.outline;
    expect(state.selected).toBe('cl:bodySizing[0]');
    expect(state.expanded['cl:bodySizing']).toBe(true);
    expect(global.saveState).toHaveBeenCalled();
  });

  test('addControl uses factoryOf default — body size = global/2', () => {
    const node = makeMeshNode({ size: 20 });
    global.nodes = [node];
    FEAMeshOutline.init('mesh-1');
    FEAMeshOutline.addControl('bodySizing');
    const c = node.data.meshSettings.bodySizingControls[0];
    expect(c.size).toBe(10);
    expect(c.behavior).toBe('soft');
  });

  test('removeControl shifts suppress flags correctly', () => {
    const node = makeMeshNode({
      bodySizingControls: [
        { bodyIds: [0], size: 5 },
        { bodyIds: [0], size: 3 },
        { bodyIds: [0], size: 1 }
      ],
      suppressFlags: {
        'cl:bodySizing[0]': true,
        'cl:bodySizing[2]': true,
        'cl:faceSizing[0]': true   // başka tip — etkilenmemeli
      }
    });
    global.nodes = [node];
    FEAMeshOutline.init('mesh-1');

    // Index 1'i sil — index 2 → index 1 olur, suppress flag de kayar
    FEAMeshOutline.removeControl('cl:bodySizing[1]');
    expect(node.data.meshSettings.bodySizingControls).toHaveLength(2);
    expect(node.data.meshSettings.bodySizingControls[0].size).toBe(5);
    expect(node.data.meshSettings.bodySizingControls[1].size).toBe(1);
    const sf = node.data.meshSettings.suppressFlags;
    expect(sf['cl:bodySizing[0]']).toBe(true);
    expect(sf['cl:bodySizing[1]']).toBe(true);     // eski [2] → yeni [1]
    expect(sf['cl:bodySizing[2]']).toBeUndefined();
    expect(sf['cl:faceSizing[0]']).toBe(true);     // başka tip etkilenmedi
  });

  test('toggleSuppress sets and clears flag', () => {
    const node = makeMeshNode({ bodySizingControls: [{ bodyIds: [0], size: 5 }] });
    global.nodes = [node];
    FEAMeshOutline.init('mesh-1');
    FEAMeshOutline.toggleSuppress('cl:bodySizing[0]');
    expect(node.data.meshSettings.suppressFlags['cl:bodySizing[0]']).toBe(true);
    FEAMeshOutline.toggleSuppress('cl:bodySizing[0]');
    expect(node.data.meshSettings.suppressFlags['cl:bodySizing[0]']).toBeUndefined();
  });

  test('renameControl writes name', () => {
    const node = makeMeshNode({ bodySizingControls: [{ bodyIds: [0], size: 5 }] });
    global.nodes = [node];
    FEAMeshOutline.init('mesh-1');
    FEAMeshOutline.renameControl('cl:bodySizing[0]', 'Bolt holes — sıkı');
    expect(node.data.meshSettings.bodySizingControls[0].name).toBe('Bolt holes — sıkı');
  });

  test('updateControlField supports dotted path', () => {
    const node = makeMeshNode({ bodySizingControls: [{ bodyIds: [0], size: 5 }] });
    global.nodes = [node];
    FEAMeshOutline.init('mesh-1');
    FEAMeshOutline.updateControlField('cl:bodySizing[0]', 'size', 3.5);
    expect(node.data.meshSettings.bodySizingControls[0].size).toBe(3.5);
    FEAMeshOutline.updateControlField('cl:bodySizing[0]', 'scope.maxLevel', 2);
    expect(node.data.meshSettings.bodySizingControls[0].scope).toEqual({ maxLevel: 2 });
  });

  test('toggleExpand persists state', () => {
    const node = makeMeshNode();
    global.nodes = [node];
    FEAMeshOutline.init('mesh-1');
    const before = node.data.meshSettings.outline.expanded['cl:bodySizing'];
    FEAMeshOutline.toggleExpand('cl:bodySizing');
    expect(node.data.meshSettings.outline.expanded['cl:bodySizing']).toBe(!before);
  });
});

describe('FEAMeshOutline — rendering', () => {
  test('render produces tree HTML with state icons', () => {
    const node = makeMeshNode({ bodySizingControls: [{ bodyIds: [], size: null }] });
    global.nodes = [node];
    FEAMeshOutline.init('mesh-1');
    const html = FEAMeshOutline.render();
    expect(html).toContain('ve-fea-outline-tree');
    expect(html).toContain('Mesh');              // root label
    expect(html).toContain('Body Sizing');       // controlList label
    expect(html).toContain('⚠');                 // underdefined icon
  });

  test('renderDetails for single:sizing returns a renderable string', () => {
    const node = makeMeshNode();
    global.nodes = [node];
    FEAMeshOutline.init('mesh-1');
    FEAMeshOutline.select('single:sizing');
    const html = FEAMeshOutline.renderDetails();
    expect(typeof html).toBe('string');
    expect(html.length).toBeGreaterThan(20);
  });

  test('renderDetails for empty controlList shows + add button', () => {
    const node = makeMeshNode();
    global.nodes = [node];
    FEAMeshOutline.init('mesh-1');
    FEAMeshOutline.select('cl:bodySizing');
    const html = FEAMeshOutline.renderDetails();
    expect(html).toContain('Yeni Body Sizing');
    expect(html).toContain('addControl');
  });

  test('renderDetails for a control item calls FEAMeshControls renderer', () => {
    const node = makeMeshNode({ bodySizingControls: [{ bodyIds: [], size: 5 }] });
    global.nodes = [node];
    FEAMeshOutline.init('mesh-1');
    FEAMeshOutline.select('cl:bodySizing[0]');
    const html = FEAMeshOutline.renderDetails();
    expect(html).toContain('Body Sizing 1');     // default label
    expect(html).toContain('Eleman boyutu');     // section
    expect(html).toContain('Suppress Et');       // suppress button
  });

  test('isSuppressed reflects flag state', () => {
    const node = makeMeshNode({
      bodySizingControls: [{ bodyIds: [0], size: 5 }],
      suppressFlags: { 'cl:bodySizing[0]': true }
    });
    expect(FEAMeshOutline.isSuppressed(node, 'cl:bodySizing[0]')).toBe(true);
    expect(FEAMeshOutline.isSuppressed(node, 'cl:bodySizing')).toBe(false);
  });
});

describe('FEAMeshControls — conflict resolution', () => {
  test('resolveBodySizingFor returns hard control even when softer is smaller', () => {
    const node = makeMeshNode({ bodySizingControls: [
      { bodyIds: [0], size: 1, behavior: 'soft' },     // very small soft
      { bodyIds: [0], size: 3, behavior: 'hard' },     // bigger but hard
      { bodyIds: [1], size: 0.5, behavior: 'soft' }    // wrong body
    ]});
    global.nodes = [node];
    FEAMeshOutline.init('mesh-1');
    const r = FEAMeshControls.resolveBodySizingFor(node, 0);
    expect(r).toBeTruthy();
    expect(r.size).toBe(3);
    expect(r.behavior).toBe('hard');
  });

  test('resolveBodySizingFor among soft picks smallest', () => {
    const node = makeMeshNode({ bodySizingControls: [
      { bodyIds: [0], size: 5, behavior: 'soft' },
      { bodyIds: [0], size: 2, behavior: 'soft' },
      { bodyIds: [0], size: 7, behavior: 'soft' }
    ]});
    global.nodes = [node];
    FEAMeshOutline.init('mesh-1');
    const r = FEAMeshControls.resolveBodySizingFor(node, 0);
    expect(r.size).toBe(2);
  });

  test('resolveBodyMethodOverride picks last matching (later wins)', () => {
    const node = makeMeshNode({ methodOverrides: [
      { bodyIds: [0], method: 'sweep' },
      { bodyIds: [0], method: 'hexDominant' }
    ]});
    global.nodes = [node];
    FEAMeshOutline.init('mesh-1');
    const m = FEAMeshControls.resolveBodyMethodOverride(node, 0);
    expect(m.method).toBe('hexDominant');
  });

  test('suppressed controls are excluded from activeControls', () => {
    const node = makeMeshNode({
      bodySizingControls: [
        { bodyIds: [0], size: 3, behavior: 'hard' },
        { bodyIds: [0], size: 2, behavior: 'hard' }
      ],
      suppressFlags: { 'cl:bodySizing[1]': true }
    });
    global.nodes = [node];
    FEAMeshOutline.init('mesh-1');
    const acts = FEAMeshControls.activeControls(node, 'bodySizing');
    expect(acts).toHaveLength(1);
    expect(acts[0].control.size).toBe(3);
  });

  test('applyRefinementsToMesh attaches metadata', () => {
    const node = makeMeshNode({ refinementControls: [
      { entityType: 'face', faceIds: [1, 2], level: 2 }
    ]});
    global.nodes = [node];
    FEAMeshOutline.init('mesh-1');
    const meshData = { nodes: [], elements: [] };
    FEAMeshControls.applyRefinementsToMesh(node, meshData);
    expect(meshData.refinementApplied).toHaveLength(1);
    expect(meshData.refinementApplied[0].entityType).toBe('face');
    expect(meshData.refinementApplied[0].ids).toEqual([1, 2]);
    expect(meshData.refinementApplied[0].level).toBe(2);
  });
});

describe('FEAMeshControls — control type renderers', () => {
  test('renderControlDetail handles all known types', () => {
    const node = makeMeshNode({
      bodySizingControls:     [{ bodyIds: [], size: 5 }],
      faceSizingControls:     [{ faceId: null, size: 5 }],
      edgeSizingControls:     [{ edgeId: null, size: 5 }],
      sphereOfInfluence:      [{ cx: 0, cy: 0, cz: 0, radius: 10 }],
      refinementControls:     [{ entityType: 'face', faceIds: [], level: 1 }],
      methodOverrides:        [{ bodyIds: [], method: 'automatic' }],
      virtualTopology:        [{ faceIds: [] }]
    });
    global.nodes = [node];
    FEAMeshOutline.init('mesh-1');
    ['bodySizing', 'faceSizing', 'edgeSizing', 'soi', 'refinement', 'methodOverride', 'virtualTopology']
      .forEach((ct) => {
        const html = FEAMeshControls.renderControlDetail(node, ct, 0);
        expect(typeof html).toBe('string');
        expect(html.length).toBeGreaterThan(50);
      });
  });

  test('renderControlDetail returns gracefully on unknown type', () => {
    const node = makeMeshNode();
    global.nodes = [node];
    FEAMeshOutline.init('mesh-1');
    const html = FEAMeshControls.renderControlDetail(node, 'nonexistent', 0);
    expect(html).toContain('Bilinmeyen kontrol tipi');
  });

  test('Body Sizing renderer shows scope multi-select', () => {
    const node = makeMeshNode({ bodySizingControls: [{ bodyIds: [0], size: 3 }] });
    global.nodes = [node];
    FEAMeshOutline.init('mesh-1');
    const html = FEAMeshControls.renderControlDetail(node, 'bodySizing', 0);
    expect(html).toContain('Scope');
    expect(html).toContain('Body Sizing 1');
    expect(html).toContain('1 body seçili');
  });

  test('Refinement renderer reflects entityType change in scope label', () => {
    const node = makeMeshNode({ refinementControls: [
      { entityType: 'edge', edgeIds: [0, 1, 2], level: 1 }
    ]});
    global.nodes = [node];
    FEAMeshOutline.init('mesh-1');
    const html = FEAMeshControls.renderControlDetail(node, 'refinement', 0);
    expect(html).toContain('3 edge seçili');
  });
});

describe('FEAMeshOutline — backward compatibility', () => {
  test('legacy faceSizingControls with faceId (singular) appears in outline', () => {
    const node = makeMeshNode({ faceSizingControls: [{ faceId: 4, size: 2 }] });
    global.nodes = [node];
    FEAMeshOutline.init('mesh-1');
    expect(FEAMeshOutline.computeNodeState(node, 'cl:faceSizing[0]')).toBe('ok');
    const html = FEAMeshOutline.render();
    expect(html).toContain('Face Sizing');
  });

  test('legacy sphereOfInfluence array length reflected in group label', () => {
    const node = makeMeshNode({ sphereOfInfluence: [
      { cx: 0, cy: 0, cz: 0, radius: 5 },
      { cx: 1, cy: 1, cz: 1, radius: 3 }
    ]});
    global.nodes = [node];
    FEAMeshOutline.init('mesh-1');
    // Group seçince summary'de "2 kontrol" görünür
    FEAMeshOutline.select('cl:soi');
    const html = FEAMeshOutline.renderDetails();
    expect(html).toContain('2 kontrol');
  });
});

describe('FEAMeshOutline — defensive', () => {
  test('init with unknown nodeId is a safe no-op', () => {
    expect(() => FEAMeshOutline.init('nope')).not.toThrow();
  });

  test('addControl with unknown type is a no-op', () => {
    const node = makeMeshNode();
    global.nodes = [node];
    FEAMeshOutline.init('mesh-1');
    expect(() => FEAMeshOutline.addControl('alienType')).not.toThrow();
    expect(node.data.meshSettings.bodySizingControls).toHaveLength(0);
  });

  test('removeControl with out-of-bound index is a no-op', () => {
    const node = makeMeshNode({ bodySizingControls: [{ bodyIds: [0], size: 5 }] });
    global.nodes = [node];
    FEAMeshOutline.init('mesh-1');
    expect(() => FEAMeshOutline.removeControl('cl:bodySizing[42]')).not.toThrow();
    expect(node.data.meshSettings.bodySizingControls).toHaveLength(1);
  });
});
