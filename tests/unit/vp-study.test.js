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

describe('veVPSynthesizeTopology', () => {
  test('preset + A2 verisinden geçerli powertrain üretir', () => {
    const n = makeNode();
    n.data.powertrain.preset = '6x6-heavy';
    n.data.vehicle.mass = 24000;
    const t = VP.veVPSynthesizeTopology(n);
    const byType = {};
    t.nodes.forEach((x) => { byType[x.type] = x; });
    expect(byType.engine.data.torqueData.length).toBeGreaterThanOrEqual(2);
    expect(byType.gearbox.data.gearRatios.length).toBeGreaterThan(1);
    expect(byType.vehicle.data.mass).toBe(24000);       // A2 değeri preset'i ezer
    expect(byType.differential.isMasterDiff).toBe(true);
    expect(byType.wheel.isMasterWheel).toBe(true);
    expect(byType.scenario).toBeTruthy();
    expect(byType.solver).toBeTruthy();
  });

  test('zincir engine→tc→gearbox→diff→wheel olarak bağlanır', () => {
    const n = makeNode();
    n.data.powertrain.preset = '6x6-heavy';
    const t = VP.veVPSynthesizeTopology(n);
    const froms = t.connections.map((c) => c.from);
    const tos = t.connections.map((c) => c.to);
    expect(froms).toContain('vp-engine');
    expect(tos).toContain('vp-wheel');
    expect(t.connections).toHaveLength(4);
  });

  test('A2 kütle boşsa preset varsayılanı kullanılır', () => {
    const n = makeNode();
    n.data.powertrain.preset = '4x4-medium';
    const t = VP.veVPSynthesizeTopology(n);
    const veh = t.nodes.find((x) => x.type === 'vehicle');
    expect(veh.data.mass).toBeGreaterThan(0);            // preset default
  });

  test('blok çözücü semantiği motor alanlarına çevrilir', () => {
    const speedNode = makeNode();
    speedNode.data.solver = { timeMode: 'speed', target: 80, method: 'rk45' };
    const sv1 = VP.veVPSynthesizeTopology(speedNode).nodes.find((x) => x.type === 'solver');
    expect(sv1.data.timeMode).toBe('stop');
    expect(sv1.data.stopSpeed).toBe(80);

    const timeNode = makeNode();
    timeNode.data.solver = { timeMode: 'time', target: 30, method: 'euler' };
    const sv2 = VP.veVPSynthesizeTopology(timeNode).nodes.find((x) => x.type === 'solver');
    expect(sv2.data.timeMode).toBe('manual');
    expect(sv2.data.duration).toBe(30);
    expect(sv2.data.method).toBe('euler');
  });
});

describe('veVPSummarize', () => {
  test('motor sonucundan metrikleri çıkarır', () => {
    const n = makeNode();
    n.data.solver = { timeMode: 'speed', target: 90 };  // 90 km/s = 25 m/s
    const result = { speed: [0, 5, 10, 27.78], time: [0, 1, 2, 3], distance: [0, 2, 8, 20] };
    const s = VP.veVPSummarize(result, n);
    expect(s.maxSpeedKmh).toBeCloseTo(100.0, 1);
    expect(s.finalTime).toBe(3);
    expect(s.distance).toBe(20);
    expect(s.timeToTarget).toBe(3);                      // ilk speed>=25 → idx3
    expect(s.points).toBe(4);
  });

  test('boş sonuç güvenli', () => {
    const s = VP.veVPSummarize({}, makeNode());
    expect(s.maxSpeedKmh).toBe(0);
    expect(s.points).toBe(0);
  });
});
