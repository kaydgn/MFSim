/**
 * module-merge.test.js — Modül birleştirme testleri
 * Tek modül yapısının doğru çalıştığını kontrol eder.
 */

// jsdom ortamında global DOM öğelerini simüle et
document.body.innerHTML = `
  <div id="ve-module-overlay" style="display:block;">
    <div class="ve-module-card" onclick="veSelectModuleFromOverlay('full-throttle')"></div>
  </div>
  <input type="hidden" id="ve-module-select" value="full-throttle">
  <div class="ve-sidebar">
    <div class="ve-category">
      <div class="ve-component" data-type="engine"></div>
      <div class="ve-component" data-type="engine-brake"></div>
    </div>
    <div class="ve-category">
      <div class="ve-component" data-type="torque-converter"></div>
      <div class="ve-component" data-type="gearbox"></div>
      <div class="ve-component" data-type="propshaft"></div>
    </div>
    <div class="ve-category" data-always-visible="true">
      <div class="ve-component" data-type="frame"></div>
    </div>
  </div>
`;

// Gerekli global değişkenler
global.nodes = [];
global.connections = [];
global.selectedNodes = [];
global.undoStack = [];
global.redoStack = [];
global.veActiveModule = '';
global.showToast = jest.fn();
global.showEmptyProperties = jest.fn();
global.updateNodeCount = jest.fn();

const fs = require('fs');
const path = require('path');
const code = fs.readFileSync(path.join(__dirname, '../../js/components.js'), 'utf8');
eval(code);

// ═════════════════════════════════════════════════════════════════════
// VE_MODULES yapısı
// ═════════════════════════════════════════════════════════════════════
describe('VE_MODULES — tek modül yapısı', () => {
  test('sadece full-throttle modülü tanımlı', () => {
    var moduleKeys = Object.keys(VE_MODULES);
    expect(moduleKeys).toEqual(['full-throttle']);
  });

  test('modül adı "Ana Sayfa"', () => {
    expect(VE_MODULES['full-throttle'].name).toBe('Ana Sayfa');
  });

  test('engine-brake modülü kaldırılmış', () => {
    expect(VE_MODULES['engine-brake']).toBeUndefined();
  });

  test('performance modülü kaldırılmış', () => {
    expect(VE_MODULES['performance']).toBeUndefined();
  });

  test('fuel modülü kaldırılmış', () => {
    expect(VE_MODULES['fuel']).toBeUndefined();
  });

  test('tüm bileşen tipleri components listesinde', () => {
    var comps = VE_MODULES['full-throttle'].components;
    expect(comps).toContain('engine');
    expect(comps).toContain('engine-brake');
    expect(comps).toContain('torque-converter');
    expect(comps).toContain('gearbox');
    expect(comps).toContain('propshaft');
    expect(comps).toContain('transfer');
    expect(comps).toContain('differential');
    expect(comps).toContain('wheel');
    expect(comps).toContain('vehicle');
    expect(comps).toContain('scenario');
    expect(comps).toContain('solver');
    expect(comps).toContain('road');
  });

  test('tüm senaryo tipleri tanımlı', () => {
    var scenarios = VE_MODULES['full-throttle'].scenarios;
    expect(scenarios).toContain('full_throttle');
    expect(scenarios).toContain('coast');
    expect(scenarios).toContain('partial_throttle');
    expect(scenarios).toContain('full_brake');
    expect(scenarios).toContain('custom');
  });
});

// ═════════════════════════════════════════════════════════════════════
// veActiveModule — sabit değer
// ═════════════════════════════════════════════════════════════════════
describe('veActiveModule — sabit full-throttle', () => {
  test('başlangıç değeri full-throttle', () => {
    expect(veActiveModule).toBe('full-throttle');
  });

  test('veGetActiveModule her zaman full-throttle döndürür', () => {
    var mod = veGetActiveModule();
    expect(mod).toBe(VE_MODULES['full-throttle']);
    expect(mod.name).toBe('Ana Sayfa');
  });

  test('veOnModuleChange hiçbir şey yapmaz', () => {
    veActiveModule = 'full-throttle';
    veOnModuleChange('engine-brake');
    expect(veActiveModule).toBe('full-throttle');
  });

  test('veApplyModuleChange her zaman full-throttle olarak sabitler', () => {
    veActiveModule = 'test-value';
    veApplyModuleChange('anything');
    expect(veActiveModule).toBe('full-throttle');
  });
});

// ═════════════════════════════════════════════════════════════════════
// veSelectModuleFromOverlay
// ═════════════════════════════════════════════════════════════════════
describe('veSelectModuleFromOverlay', () => {
  test('overlay gizlenir', () => {
    var overlay = document.getElementById('ve-module-overlay');
    overlay.style.display = 'block';
    veSelectModuleFromOverlay('full-throttle');
    expect(overlay.style.display).toBe('none');
  });

  test('veActiveModule full-throttle olarak kalır', () => {
    veSelectModuleFromOverlay('full-throttle');
    expect(veActiveModule).toBe('full-throttle');
  });

  test('toast mesajı gösterilir', () => {
    showToast.mockClear();
    veSelectModuleFromOverlay('full-throttle');
    expect(showToast).toHaveBeenCalledWith('Ana Sayfa aktif', 'info');
  });
});

// ═════════════════════════════════════════════════════════════════════
// veShowAllSidebarComponents
// ═════════════════════════════════════════════════════════════════════
describe('veShowAllSidebarComponents', () => {
  test('tüm bileşenler görünür yapılır', () => {
    // Önce bazı bileşenleri gizle
    document.querySelectorAll('.ve-component[data-type]').forEach(function(el) {
      el.style.display = 'none';
    });
    document.querySelectorAll('.ve-category').forEach(function(cat) {
      cat.style.display = 'none';
    });

    veShowAllSidebarComponents();

    document.querySelectorAll('.ve-component[data-type]').forEach(function(el) {
      expect(el.style.display).toBe('');
    });
    document.querySelectorAll('.ve-category').forEach(function(cat) {
      expect(cat.style.display).toBe('');
    });
  });
});

// ═════════════════════════════════════════════════════════════════════
// componentDefs — engine-brake bileşeni
// ═════════════════════════════════════════════════════════════════════
describe('componentDefs — motor freni bileşeni', () => {
  test('engine-brake bileşeni tanımlı', () => {
    expect(componentDefs['engine-brake']).toBeDefined();
  });

  test('engine-brake ismi "Motor Freni"', () => {
    expect(componentDefs['engine-brake'].name).toBe('Motor Freni');
  });

  test('engine-brake 1 giriş 1 çıkış portuna sahip', () => {
    expect(componentDefs['engine-brake'].inputs).toBe(1);
    expect(componentDefs['engine-brake'].outputs).toBe(1);
  });
});

// ═════════════════════════════════════════════════════════════════════
// COMPONENT_SIGNALS — engine-brake sinyalleri
// ═════════════════════════════════════════════════════════════════════
describe('COMPONENT_SIGNALS — engine-brake', () => {
  test('engine-brake sinyalleri tanımlı', () => {
    expect(COMPONENT_SIGNALS['engine-brake']).toBeDefined();
    expect(COMPONENT_SIGNALS['engine-brake'].outputs).toBeDefined();
  });

  test('engine-brake fren torku sinyali var', () => {
    var signals = COMPONENT_SIGNALS['engine-brake'].outputs;
    var hasBrakeTorque = signals.some(function(s) { return s.id === 'torque'; });
    expect(hasBrakeTorque).toBe(true);
  });
});
