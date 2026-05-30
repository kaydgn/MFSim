/**
 * Vehicle Performance Study — birleşik "Araç Performans" sistem bloğu testleri
 *  - veVPCreateModuleData: 5 hücreli birleşik veri modeli
 *  - veVPIsModuleNode: tip tanıma
 *  - veVPCellStatus: durum kaskadı (unfulfilled/attention/uptodate)
 *  - render yardımcıları (blok / genel bakış / hücre editörü) string üretir
 */

const VP = require('../../js/vp-study.js');

function makeNode(data) {
  return { id: 'comp-1', type: 'vehicle-performance', data: data || VP.veVPCreateModuleData() };
}

describe('VP_CELLS', () => {
  test('5 hücre, doğru sırada', () => {
    expect(VP.VP_CELLS).toHaveLength(5);
    expect(VP.VP_CELLS.map((c) => c.key)).toEqual(['powertrain', 'vehicle', 'scenario', 'solver', 'results']);
    expect(VP.VP_CELLS.map((c) => c.code)).toEqual(['A1', 'A2', 'A3', 'A4', 'A5']);
  });
});

describe('veVPCreateModuleData', () => {
  test('tüm hücre alt-verilerini içerir', () => {
    const d = VP.veVPCreateModuleData();
    expect(d).toHaveProperty('powertrain');
    expect(d).toHaveProperty('vehicle');
    expect(d).toHaveProperty('scenario');
    expect(d).toHaveProperty('solver');
    expect(d).toHaveProperty('results', null);
    expect(d.scenario.type).toBe('full_throttle');
  });
});

describe('veVPIsModuleNode', () => {
  test('vehicle-performance node için true', () => {
    expect(VP.veVPIsModuleNode({ type: 'vehicle-performance' })).toBe(true);
  });
  test('başka tipler / null için false', () => {
    expect(VP.veVPIsModuleNode({ type: 'engine' })).toBe(false);
    expect(VP.veVPIsModuleNode(null)).toBe(false);
    expect(VP.veVPIsModuleNode(undefined)).toBe(false);
  });
});

describe('veVPCellStatus — kaskad', () => {
  test('boş blokta: powertrain/vehicle attention, solver/results unfulfilled', () => {
    const n = makeNode();
    expect(VP.veVPCellStatus(n, 'powertrain')).toBe('attention');
    expect(VP.veVPCellStatus(n, 'vehicle')).toBe('attention');
    expect(VP.veVPCellStatus(n, 'scenario')).toBe('uptodate'); // default senaryo seçili
    expect(VP.veVPCellStatus(n, 'solver')).toBe('unfulfilled'); // upstream eksik
    expect(VP.veVPCellStatus(n, 'results')).toBe('unfulfilled');
  });

  test('A1–A3 dolunca solver attention olur', () => {
    const n = makeNode();
    n.data.powertrain.preset = '6x6-heavy';
    n.data.vehicle.mass = 12000;
    expect(VP.veVPCellStatus(n, 'powertrain')).toBe('uptodate');
    expect(VP.veVPCellStatus(n, 'vehicle')).toBe('uptodate');
    expect(VP.veVPCellStatus(n, 'solver')).toBe('attention'); // hazır ama sonuç yok
    expect(VP.veVPCellStatus(n, 'results')).toBe('unfulfilled');
  });

  test('sonuç gelince solver/results uptodate olur', () => {
    const n = makeNode();
    n.data.powertrain.preset = '6x6-heavy';
    n.data.vehicle.mass = 12000;
    n.data.results = { ranAt: 'now' };
    expect(VP.veVPCellStatus(n, 'solver')).toBe('uptodate');
    expect(VP.veVPCellStatus(n, 'results')).toBe('uptodate');
  });

  test('components objesi de powertrain dolu sayılır', () => {
    const n = makeNode();
    n.data.powertrain.components = { engine: { id: 'e1' } };
    expect(VP.veVPCellStatus(n, 'powertrain')).toBe('uptodate');
  });
});

describe('render yardımcıları', () => {
  test('veVPBlockInnerHTML hücre etiketlerini ve durum sınıflarını içerir', () => {
    const html = VP.veVPBlockInnerHTML(makeNode());
    expect(typeof html).toBe('string');
    expect(html).toContain('Güç Aktarma Organları');
    expect(html).toContain('ve-vp-cell');
    expect(html).toMatch(/vp-st-(attention|unfulfilled|uptodate)/);
    expect(html).toContain('Araç Performans'); // header başlığı
  });

  test('veVPOverviewHTML aç butonlarını içerir', () => {
    const html = VP.veVPOverviewHTML(makeNode());
    expect(html).toContain('veVPOpenCell');
    expect(html).toContain('Güç Aktarma Organları');
  });

  test('veVPCellEditorHTML her hücre için anlamlı içerik üretir', () => {
    const n = makeNode();
    expect(VP.veVPCellEditorHTML(n, 'vehicle')).toContain('Kütle');
    expect(VP.veVPCellEditorHTML(n, 'scenario')).toContain('Senaryo');
    expect(VP.veVPCellEditorHTML(n, 'solver')).toContain('Çöz');
    expect(VP.veVPCellEditorHTML(n, 'results')).toContain('Henüz çözüm yok');
  });

  test('sonuç varken results hücresi "Çözüm hazır" gösterir', () => {
    const n = makeNode();
    n.data.results = { ranAt: 'now', summary: 'ok' };
    expect(VP.veVPCellEditorHTML(n, 'results')).toContain('Çözüm hazır');
  });
});
