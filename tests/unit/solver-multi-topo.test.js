/**
 * solver.js — _veSolveOtherTopologies birim testleri
 * Çoklu topoloji otomatik çözüm, global durum güvenliği, try/finally
 */

// jsdom ortamında global DOM öğelerini simüle et
document.body.innerHTML = '<div id="ve-canvas"></div><div id="ve-solver-validation"></div><div id="ve-solver-progress"></div><div id="ve-solver-progress-fill"></div><div id="ve-solver-progress-text"></div><div id="ve-solver-result"></div>';

// Gerekli global değişkenler
global.nodes = [];
global.connections = [];
global.veActiveModule = 'full-throttle';
global.veActiveTabIdx = 0;
global.veTabs = [];
global.veChartViews = [];
global.veSimResults = null;
global.veResultSlots = [{}, {}, {}, {}];
global.componentDefs = {
  'engine': { name: 'Motor', svg: '<svg></svg>', inputs: 0, outputs: 1 },
  'engine-brake': { name: 'Motor Freni', svg: '<svg></svg>', inputs: 0, outputs: 1 },
  'gearbox': { name: 'Şanzıman', svg: '<svg></svg>', inputs: 1, outputs: 1 },
  'vehicle': { name: 'Araç', svg: '<svg></svg>', inputs: 1, outputs: 0 },
  'torque-converter': { name: 'TC', svg: '<svg></svg>', inputs: 1, outputs: 1 },
  'transfer': { name: 'Transfer', svg: '<svg></svg>', inputs: 1, outputs: 1 }
};

// Stub fonksiyonlar
global.showToast = jest.fn();
global.veSolverValidate = jest.fn();

// Simülasyon motorlarını stub'la
global.veRunSimulationEngine = jest.fn(function() {
  return {
    time: [0, 1, 2, 3, 4, 5],
    speed: [0, 10, 20, 30, 35, 38],
    rpm: [800, 1200, 1600, 2000, 2200, 2400],
    mode: 'full'
  };
});

global.veFTRunSimulationEngine = jest.fn(function(kademe) {
  return {
    time: [0, 1, 2, 3],
    speed: [0, 15, 30, 45],
    rpm: [1000, 1500, 2000, 2500],
    mode: 'full-throttle',
    kademe: kademe || 'High'
  };
});

const fs = require('fs');
const path = require('path');
const code = fs.readFileSync(path.join(__dirname, '../../js/solver.js'), 'utf8');
eval(code);

beforeEach(() => {
  nodes = [{ id: 'e1', type: 'engine', x: 0, y: 0, data: {} }];
  connections = [{ id: 'c1', from: 'e1', to: 'gb1' }];
  veActiveTabIdx = 0;
  veTabs = [];
  veChartViews = [{ id: 'chart1' }];
  window.veSimResults = { time: [0, 1], speed: [0, 5] };
  veActiveModule = 'full-throttle';
  veRunSimulationEngine.mockReset();
  veFTRunSimulationEngine.mockReset();
  // Varsayılan implementasyonları geri yükle
  veRunSimulationEngine.mockImplementation(function() {
    return { time: [0, 1, 2, 3, 4, 5], speed: [0, 10, 20, 30, 35, 38], rpm: [800, 1200, 1600, 2000, 2200, 2400], mode: 'full' };
  });
  veFTRunSimulationEngine.mockImplementation(function(kademe) {
    return { time: [0, 1, 2, 3], speed: [0, 15, 30, 45], rpm: [1000, 1500, 2000, 2500], mode: 'full-throttle', kademe: kademe || 'High' };
  });
});

// ── Yardımcı ──
function makeTab(name, tabNodes, tabConns) {
  return {
    name: name,
    state: {
      nodes: tabNodes || [],
      connections: tabConns || [],
      simResults: null
    }
  };
}

// ═════════════════════════════════════════════════════════════════════
// Temel çalışma
// ═════════════════════════════════════════════════════════════════════
describe('_veSolveOtherTopologies — temel', () => {
  test('tek topoloji varsa hiçbir şey yapmaz', () => {
    veTabs = [makeTab('Topoloji 1', [{ id: 'e1', type: 'engine', data: {} }])];
    _veSolveOtherTopologies();
    expect(veRunSimulationEngine).not.toHaveBeenCalled();
  });

  test('veTabs tanımsızsa hata vermez', () => {
    global.veTabs = undefined;
    expect(() => _veSolveOtherTopologies()).not.toThrow();
    global.veTabs = [];
  });

  test('aktif topolojiyi atlar', () => {
    veActiveTabIdx = 0;
    veTabs = [
      makeTab('Aktif', [{ id: 'e1', type: 'engine', data: {} }]),
      makeTab('Diğer', [{ id: 'e2', type: 'engine', data: {} }])
    ];
    _veSolveOtherTopologies();
    // Sadece ikinci topoloji çözülmeli (FT solver her zaman kullanılır)
    expect(veFTRunSimulationEngine).toHaveBeenCalled();
  });

  test('boş topolojiyi atlar', () => {
    veActiveTabIdx = 0;
    veTabs = [
      makeTab('Aktif', [{ id: 'e1', type: 'engine', data: {} }]),
      makeTab('Boş', []) // boş nodes
    ];
    _veSolveOtherTopologies();
    expect(veRunSimulationEngine).not.toHaveBeenCalled();
  });

  test('motor bileşeni olmayan topolojiyi atlar', () => {
    veActiveTabIdx = 0;
    veTabs = [
      makeTab('Aktif', [{ id: 'e1', type: 'engine', data: {} }]),
      makeTab('Motorsuz', [{ id: 'v1', type: 'vehicle', data: {} }])
    ];
    _veSolveOtherTopologies();
    expect(veRunSimulationEngine).not.toHaveBeenCalled();
  });

  test('motor bileşeni olan topolojiyi çözer', () => {
    veActiveTabIdx = 0;
    veTabs = [
      makeTab('Aktif', [{ id: 'e1', type: 'engine', data: {} }]),
      makeTab('Diğer', [{ id: 'e2', type: 'engine', data: {} }])
    ];
    _veSolveOtherTopologies();
    expect(veFTRunSimulationEngine).toHaveBeenCalled();
  });
});

// ═════════════════════════════════════════════════════════════════════
// Sonuç kaydetme
// ═════════════════════════════════════════════════════════════════════
describe('_veSolveOtherTopologies — sonuçlar', () => {
  test('sonuçları tab state\'ine kaydeder', () => {
    veActiveTabIdx = 0;
    veTabs = [
      makeTab('Aktif', [{ id: 'e1', type: 'engine', data: {} }]),
      makeTab('İkinci', [{ id: 'e2', type: 'engine', data: { torqueData: [] } }])
    ];
    _veSolveOtherTopologies();
    expect(veTabs[1].state.simResults).toBeDefined();
    expect(veTabs[1].state.simResults.time).toBeDefined();
  });

  test('birden fazla topoloji çözer', () => {
    veActiveTabIdx = 0;
    veTabs = [
      makeTab('Aktif', [{ id: 'e1', type: 'engine', data: {} }]),
      makeTab('İkinci', [{ id: 'e2', type: 'engine', data: {} }]),
      makeTab('Üçüncü', [{ id: 'e3', type: 'engine', data: {} }])
    ];
    _veSolveOtherTopologies();
    // Her iki ek topoloji için FT solver çağrılmalı (her biri varsayılan 1 kademe = 1 çağrı)
    expect(veFTRunSimulationEngine).toHaveBeenCalledTimes(2);
    expect(veTabs[1].state.simResults).toBeDefined();
    expect(veTabs[2].state.simResults).toBeDefined();
  });
});

// ═════════════════════════════════════════════════════════════════════
// Global durum güvenliği (try/finally)
// ═════════════════════════════════════════════════════════════════════
describe('_veSolveOtherTopologies — global durum güvenliği', () => {
  test('global değişkenler çözüm sonrası geri yüklenir', () => {
    var origNodes = nodes;
    var origConns = connections;
    var origSimResults = window.veSimResults;

    veActiveTabIdx = 0;
    veTabs = [
      makeTab('Aktif', [{ id: 'e1', type: 'engine', data: {} }]),
      makeTab('İkinci', [{ id: 'e2', type: 'engine', data: {} }])
    ];
    _veSolveOtherTopologies();

    expect(nodes).toBe(origNodes);
    expect(connections).toBe(origConns);
    expect(window.veSimResults).toBe(origSimResults);
  });

  test('simülasyon hata fırlatsa bile global durum geri yüklenir', () => {
    var origNodes = nodes;
    var origConns = connections;
    var origSimResults = window.veSimResults;

    veFTRunSimulationEngine.mockImplementation(function() {
      throw new Error('Simülasyon patladı!');
    });

    veActiveTabIdx = 0;
    veTabs = [
      makeTab('Aktif', [{ id: 'e1', type: 'engine', data: {} }]),
      makeTab('Hatalı', [{ id: 'e2', type: 'engine', data: {} }])
    ];

    // Fonksiyon hata fırlatmamalı
    expect(() => _veSolveOtherTopologies()).not.toThrow();

    // Global durum geri yüklenmiş olmalı
    expect(nodes).toBe(origNodes);
    expect(connections).toBe(origConns);
    expect(window.veSimResults).toBe(origSimResults);
  });

  test('veChartViews deep-copy ile yedeklenir', () => {
    veChartViews = [{ id: 'chart1', config: { zoom: 1.5 } }];
    var origRef = veChartViews;

    veActiveTabIdx = 0;
    veTabs = [
      makeTab('Aktif', [{ id: 'e1', type: 'engine', data: {} }]),
      makeTab('İkinci', [{ id: 'e2', type: 'engine', data: {} }])
    ];
    _veSolveOtherTopologies();

    // veChartViews geri yüklenmiş olmalı (deep copy, aynı referans değil)
    expect(veChartViews).toEqual([{ id: 'chart1', config: { zoom: 1.5 } }]);
  });
});

// ═════════════════════════════════════════════════════════════════════
// Full-throttle modu vites iterasyonu
// ═════════════════════════════════════════════════════════════════════
describe('_veSolveOtherTopologies — full-throttle vites iterasyonu', () => {
  test('full-throttle modunda veFTRunSimulationEngine çağrılır', () => {
    veActiveModule = 'full-throttle';
    veActiveTabIdx = 0;
    veTabs = [
      makeTab('Aktif', [{ id: 'e1', type: 'engine', data: {} }]),
      makeTab('FT', [{ id: 'e2', type: 'engine', data: {} }])
    ];
    _veSolveOtherTopologies();
    expect(veFTRunSimulationEngine).toHaveBeenCalled();
    expect(veRunSimulationEngine).not.toHaveBeenCalled();
  });

  test('transfer bileşeni varsa tüm vites kademelerini iterasyonla gezer', () => {
    veActiveModule = 'full-throttle';
    veActiveTabIdx = 0;
    veTabs = [
      makeTab('Aktif', [{ id: 'e1', type: 'engine', data: {} }]),
      makeTab('Transfer', [
        { id: 'e2', type: 'engine', data: {} },
        { id: 'tr1', type: 'transfer', data: {
          ftTrGears: [
            { kademe: 'High', ratio: 1.054, eff: 97.00 },
            { kademe: 'Low', ratio: 3.51, eff: 95.00 }
          ]
        }}
      ])
    ];
    _veSolveOtherTopologies();
    // İki kademe için iki çağrı
    expect(veFTRunSimulationEngine).toHaveBeenCalledTimes(2);
    expect(veFTRunSimulationEngine).toHaveBeenCalledWith('High');
    expect(veFTRunSimulationEngine).toHaveBeenCalledWith('Low');
  });

  test('transfer bileşeni yoksa varsayılan High kademesi kullanılır', () => {
    veActiveModule = 'full-throttle';
    veActiveTabIdx = 0;
    veTabs = [
      makeTab('Aktif', [{ id: 'e1', type: 'engine', data: {} }]),
      makeTab('NoTransfer', [{ id: 'e2', type: 'engine', data: {} }])
    ];
    _veSolveOtherTopologies();
    expect(veFTRunSimulationEngine).toHaveBeenCalledWith('High');
  });
});

// ═════════════════════════════════════════════════════════════════════
// Loglama (pro solver)
// ═════════════════════════════════════════════════════════════════════
describe('_veSolveOtherTopologies — loglama', () => {
  test('log fonksiyonu verildiğinde detaylı loglama yapar', () => {
    var logMessages = [];
    var mockLog = jest.fn(function(msg) { logMessages.push(msg); });
    var mockLogSpacer = jest.fn();

    veActiveTabIdx = 0;
    veTabs = [
      makeTab('Aktif', [{ id: 'e1', type: 'engine', data: {} }]),
      makeTab('İkinci', [{ id: 'e2', type: 'engine', data: {} }])
    ];
    _veSolveOtherTopologies({ log: mockLog, logSpacer: mockLogSpacer });

    expect(mockLog).toHaveBeenCalled();
    expect(mockLogSpacer).toHaveBeenCalled();
    // Başlık loglanmalı
    var hasHeader = logMessages.some(function(m) { return m.indexOf('EK TOPOLOJİLER') > -1; });
    expect(hasHeader).toBe(true);
  });

  test('log fonksiyonu verilmediğinde sessiz çalışır', () => {
    var consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(function() {});
    veActiveTabIdx = 0;
    veTabs = [
      makeTab('Aktif', [{ id: 'e1', type: 'engine', data: {} }]),
      makeTab('İkinci', [{ id: 'e2', type: 'engine', data: {} }])
    ];
    // İddia AÇIK yazılıyor: gövdesi iddiasız bir test, ileride biri çağrıyı
    // try/catch'e sararsa sessizce anlamsızlaşır ve yine yeşil kalırdı.
    expect(() => _veSolveOtherTopologies()).not.toThrow();   // options yok
    consoleWarnSpy.mockRestore();
  });

  test('hata durumunda log ile hatayı raporlar', () => {
    var logMessages = [];
    var mockLog = jest.fn(function(msg) { logMessages.push(msg); });
    veFTRunSimulationEngine.mockImplementation(function() {
      throw new Error('Test hatası');
    });

    veActiveTabIdx = 0;
    veTabs = [
      makeTab('Aktif', [{ id: 'e1', type: 'engine', data: {} }]),
      makeTab('Hatalı', [{ id: 'e2', type: 'engine', data: {} }])
    ];
    _veSolveOtherTopologies({ log: mockLog, logSpacer: jest.fn() });

    var hasError = logMessages.some(function(m) { return m.indexOf('HATA') > -1; });
    expect(hasError).toBe(true);
  });

  test('hata durumunda log yoksa console.warn kullanır', () => {
    var consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(function() {});
    veFTRunSimulationEngine.mockImplementation(function() {
      throw new Error('Test hatası');
    });

    veActiveTabIdx = 0;
    veTabs = [
      makeTab('Aktif', [{ id: 'e1', type: 'engine', data: {} }]),
      makeTab('Hatalı', [{ id: 'e2', type: 'engine', data: {} }])
    ];
    _veSolveOtherTopologies(); // log yok

    expect(consoleWarnSpy).toHaveBeenCalled();
    consoleWarnSpy.mockRestore();
  });
});

// ═════════════════════════════════════════════════════════════════════
// Node yeniden yapılandırma
// ═════════════════════════════════════════════════════════════════════
describe('_veSolveOtherTopologies — node yapılandırma', () => {
  test('bilinmeyen bileşen tipleri filtrelenir', () => {
    veActiveTabIdx = 0;
    veTabs = [
      makeTab('Aktif', [{ id: 'e1', type: 'engine', data: {} }]),
      makeTab('Karışık', [
        { id: 'e2', type: 'engine', data: {} },
        { id: 'unk1', type: 'unknown-component', data: {} } // componentDefs'te yok
      ])
    ];

    // Hata fırlatmamalı
    expect(() => _veSolveOtherTopologies()).not.toThrow();
    expect(veFTRunSimulationEngine).toHaveBeenCalled();
  });

  test('node verisi deep-copy edilir (orijinal etkilenmez)', () => {
    var originalData = { torqueData: [100, 200, 300] };
    veActiveTabIdx = 0;
    veTabs = [
      makeTab('Aktif', [{ id: 'e1', type: 'engine', data: {} }]),
      makeTab('İkinci', [{ id: 'e2', type: 'engine', data: originalData }])
    ];

    // veFTRunSimulationEngine'i veriyi değiştiren bir mock ile değiştir
    veFTRunSimulationEngine.mockImplementation(function() {
      // nodes global'e erişip veriyi değiştirmeye çalış
      if(nodes[0] && nodes[0].data && nodes[0].data.torqueData) {
        nodes[0].data.torqueData.push(999);
      }
      return { time: [0, 1], speed: [0, 10], rpm: [800, 1200] };
    });

    _veSolveOtherTopologies();

    // Orijinal veri değişmemiş olmalı
    expect(originalData.torqueData).toEqual([100, 200, 300]);
  });
});
