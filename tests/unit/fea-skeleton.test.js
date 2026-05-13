/**
 * FEA İskelet birim testleri (Faz 0 + Faz 1)
 * - components.js: componentDefs ve COMPONENT_SIGNALS kayıtları
 * - VE_MODULES.full-throttle: 'fea' dahil mi
 * - ui-core.js: spawnFEAChain fonksiyonu — 4 alt blok + 3 bağlantı, tek instance kuralı
 */

const fs = require('fs');
const path = require('path');

// components.js'yi yükle — top-level var atamaları globalThis'e bind olur
const componentsCode = fs.readFileSync(path.join(__dirname, '../../js/components.js'), 'utf8');
eval(componentsCode);

describe('components.js — FEA componentDefs', () => {
  test("'fea' sidebar girdisi tanımlı, maxInstances=1 ve isFEAParent=true", () => {
    expect(componentDefs['fea']).toBeDefined();
    expect(componentDefs['fea'].name).toBe('Yapısal Analiz');
    expect(componentDefs['fea'].maxInstances).toBe(1);
    expect(componentDefs['fea'].isFEAParent).toBe(true);
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
// spawnFEAChain — ui-core.js'den fonksiyon kaynağını çıkar, izole ortamda test et
// ────────────────────────────────────────────────────────────────────────────
describe('ui-core.js — spawnFEAChain', () => {
  const uiCoreCode = fs.readFileSync(path.join(__dirname, '../../js/ui-core.js'), 'utf8');
  // 'function spawnFEAChain(x, y) {' ile başlayan bloğu, kendi seviyesinde kapanan }'ye kadar yakala.
  // Brace-balanced parse:
  function extractFunction(source, signaturePrefix) {
    const start = source.indexOf(signaturePrefix);
    if (start === -1) throw new Error('Fonksiyon bulunamadı: ' + signaturePrefix);
    const braceStart = source.indexOf('{', start);
    let depth = 0;
    for (let i = braceStart; i < source.length; i++) {
      const c = source[i];
      if (c === '{') depth++;
      else if (c === '}') {
        depth--;
        if (depth === 0) return source.substring(start, i + 1);
      }
    }
    throw new Error('Kapanış parantezi bulunamadı');
  }

  const spawnSrc = extractFunction(uiCoreCode, 'function spawnFEAChain(x, y)');

  let nodes, connections, toasts, compCounter, spawnFEAChain;

  function createNodeStub(type, x, y, w, h) {
    compCounter++;
    nodes.push({ id: 'comp-' + compCounter, type, x, y, width: w || 65, height: h || 60 });
  }
  function createConnectionStub(fromId, toId, fromPort, toPort) {
    connections.push({
      id: 'conn-' + connections.length,
      from: fromId,
      to: toId,
      fromPort: fromPort || 'output',
      toPort: toPort || 'input'
    });
  }
  function showToastStub(msg, type) {
    toasts.push({ msg, type });
  }

  beforeEach(() => {
    nodes = [];
    connections = [];
    toasts = [];
    compCounter = 0;
    // spawnFEAChain'i kontrollü scope ile inşa et
    spawnFEAChain = new Function(
      'nodes',
      'connections',
      'compCounter',
      'createNode',
      'createConnection',
      'showToast',
      spawnSrc + '\nreturn spawnFEAChain;'
    )(nodes, connections, compCounter, createNodeStub, createConnectionStub, showToastStub);
  });

  test('temiz canvas: 4 alt blok 2×2 grid düzeninde oluşur', () => {
    spawnFEAChain(100, 200);

    expect(nodes).toHaveLength(4);
    const types = nodes.map((n) => n.type);
    expect(types).toEqual(['fea-geometry', 'fea-mesh', 'fea-bc', 'fea-solver']);

    // 2×2 grid: Geometri (sol üst), Mesh (sağ üst), BC (sol alt), Solver (sağ alt)
    const [g, m, b, s] = nodes;
    expect(g.x).toBe(100);
    expect(g.y).toBe(200);
    // sağ üst: x değişir, y aynı
    expect(m.x).toBeGreaterThan(g.x);
    expect(m.y).toBe(g.y);
    // sol alt: x aynı, y değişir
    expect(b.x).toBe(g.x);
    expect(b.y).toBeGreaterThan(g.y);
    // sağ alt: m.x ile aynı, b.y ile aynı
    expect(s.x).toBe(m.x);
    expect(s.y).toBe(b.y);
  });

  test('3 bağlantı akış sırasına göre kurulur (Geo→Mesh→BC→Solver)', () => {
    spawnFEAChain(0, 0);

    expect(connections).toHaveLength(3);
    expect(connections[0]).toMatchObject({ from: 'comp-1', to: 'comp-2', fromPort: 'output', toPort: 'input' });
    expect(connections[1]).toMatchObject({ from: 'comp-2', to: 'comp-3', fromPort: 'output', toPort: 'input' });
    expect(connections[2]).toMatchObject({ from: 'comp-3', to: 'comp-4', fromPort: 'output', toPort: 'input' });
  });

  test('başarılı zincirden sonra success toast gösterilir', () => {
    spawnFEAChain(0, 0);
    expect(toasts.some((t) => t.type === 'success')).toBe(true);
  });

  test('mevcut FEA zinciri varken tekrar çağırınca yeni eklenmez ve warning toast atılır', () => {
    // Önceden var olan bir FEA node ile başla
    nodes.push({ id: 'comp-99', type: 'fea-geometry', x: 0, y: 0 });

    spawnFEAChain(500, 500);

    // Hâlâ sadece tek başlangıç node'u olmalı
    expect(nodes).toHaveLength(1);
    expect(connections).toHaveLength(0);
    expect(toasts.some((t) => t.type === 'warning')).toBe(true);
  });

  test('herhangi bir FEA alt tipinin varlığı tekrar eklemeyi engeller', () => {
    nodes.push({ id: 'comp-50', type: 'fea-solver', x: 0, y: 0 });
    spawnFEAChain(0, 0);
    expect(nodes).toHaveLength(1);
  });
});
