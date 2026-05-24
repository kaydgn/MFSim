/**
 * FEA İskelet birim testleri (Faz 0 + Faz 1)
 * - components.js: componentDefs ve COMPONENT_SIGNALS kayıtları
 * - VE_MODULES.full-throttle: 'fea' dahil mi
 * - Faz 1: 'fea' artık tek birleşik modül (eski 4-node spawnFEAChain kaldırıldı)
 */

const fs = require('fs');
const path = require('path');

// components.js'yi yükle — top-level var atamaları globalThis'e bind olur
const componentsCode = fs.readFileSync(path.join(__dirname, '../../js/components.js'), 'utf8');
eval(componentsCode);
eval(fs.readFileSync(path.join(__dirname, '../../js/fea-study.js'), 'utf8'));

describe('components.js — FEA componentDefs', () => {
  test("'fea' birleşik modül girdisi tanımlı, maxInstances=1 ve isFEAModule=true", () => {
    expect(componentDefs['fea']).toBeDefined();
    expect(componentDefs['fea'].name).toBe('Yapısal Analiz');
    expect(componentDefs['fea'].maxInstances).toBe(1);
    // Faz 1: 'fea' artık 4-node zinciri DEĞİL, tek birleşik modül node'u
    expect(componentDefs['fea'].isFEAModule).toBe(true);
    expect(componentDefs['fea'].isFEAParent).toBeFalsy();
  });

  test("4 alt bileşen tanımlı (geometry, mesh, bc, solver) ve isFEAChild=true", () => {
    ['fea-geometry', 'fea-mesh', 'fea-bc', 'fea-solver'].forEach((t) => {
      expect(componentDefs[t]).toBeDefined();
      expect(componentDefs[t].isFEAChild).toBe(true);
    });
  });

  test('akış sırası port topolojisi: ilk girişi yok, son çıkışı yok', () => {
    expect(componentDefs['fea-geometry'].inputs).toBe(0);
    expect(componentDefs['fea-geometry'].outputs).toBe(1);
    expect(componentDefs['fea-mesh'].inputs).toBe(1);
    expect(componentDefs['fea-mesh'].outputs).toBe(1);
    expect(componentDefs['fea-bc'].inputs).toBe(1);
    expect(componentDefs['fea-bc'].outputs).toBe(1);
    expect(componentDefs['fea-solver'].inputs).toBe(1);
    expect(componentDefs['fea-solver'].outputs).toBe(0);
  });

  test('alt bileşenler ebeveyn değildir (yanlışlıkla zincir tetiklemez)', () => {
    ['fea-geometry', 'fea-mesh', 'fea-bc', 'fea-solver'].forEach((t) => {
      expect(componentDefs[t].isFEAParent).toBeFalsy();
    });
  });
});

describe('components.js — VE_MODULES', () => {
  test("'full-throttle' modülü 'fea' bileşenini içerir", () => {
    expect(VE_MODULES['full-throttle'].components).toContain('fea');
  });
});

describe('components.js — COMPONENT_SIGNALS', () => {
  test("'fea-solver' sensörle okunabilir çıktılar tanımlar", () => {
    const sig = COMPONENT_SIGNALS['fea-solver'];
    expect(sig).toBeDefined();
    expect(Array.isArray(sig.outputs)).toBe(true);
    const ids = sig.outputs.map((o) => o.id);
    expect(ids).toEqual(
      expect.arrayContaining([
        'max_von_mises',
        'max_displacement',
        'max_principal',
        'min_principal',
        'safety_factor',
        'mass'
      ])
    );
  });

  test('her çıktı için id, name, unit alanları dolu', () => {
    COMPONENT_SIGNALS['fea-solver'].outputs.forEach((o) => {
      expect(typeof o.id).toBe('string');
      expect(typeof o.name).toBe('string');
      expect(typeof o.unit).toBe('string');
      expect(o.id.length).toBeGreaterThan(0);
    });
  });
});

// ────────────────────────────────────────────────────────────────────────────
// Faz 1: birleşik 'fea' modülü — eski spawnFEAChain (4 node + 3 bağlantı)
// kaldırıldı. Artık tek node + tek ağaç; eski projeler migration ile göçürülür.
// ────────────────────────────────────────────────────────────────────────────
describe('Faz 1 — birleşik Yapısal Analiz modülü', () => {
  test('ui-core.js artık spawnFEAChain içermez', () => {
    const uiCoreCode = fs.readFileSync(path.join(__dirname, '../../js/ui-core.js'), 'utf8');
    expect(uiCoreCode).not.toMatch(/function spawnFEAChain/);
  });

  test('veFEACreateModuleData birleşik veri üretir (geometri+mesh+bc+solver tek node)', () => {
    const d = veFEACreateModuleData();
    expect(d).toHaveProperty('geometry');
    expect(d).toHaveProperty('meshSettings');
    expect(d).toHaveProperty('bc');
    expect(d).toHaveProperty('solver');
  });

  test('eski 4-node zincir migration ile tek fea node\'una iner', () => {
    const state = {
      nodes: [
        { id: 'comp-1', type: 'fea-geometry', x: 0, y: 0, data: { geometry: { type: 'box', params: {} } } },
        { id: 'comp-2', type: 'fea-mesh', x: 60, y: 0, data: { meshSettings: { size: 5 } } },
        { id: 'comp-3', type: 'fea-bc', x: 0, y: 60, data: { bc: { materialId: 'steel-st37', assignments: [] } } },
        { id: 'comp-4', type: 'fea-solver', x: 60, y: 60, data: { solver: {} } }
      ],
      connections: [
        { from: 'comp-1', to: 'comp-2' }, { from: 'comp-2', to: 'comp-3' }, { from: 'comp-3', to: 'comp-4' }
      ]
    };
    veFEAMigrateChainToModule(state);
    expect(state.nodes.filter((n) => n.type === 'fea')).toHaveLength(1);
    expect(state.nodes.filter((n) => /^fea-/.test(n.type))).toHaveLength(0);
    expect(state.connections).toHaveLength(0);
  });
});
