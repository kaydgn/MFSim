/**
 * arac-performans.test.js — "Araç Performans" alt modülü topoloji kurucusu
 *
 * veBuildVehiclePerformanceModule() gerçek DOM'a değil, global createNode /
 * createConnection fonksiyonlarına dayanır. Bu testte bu iki fonksiyon mock'lanır
 * ve kurucunun DOĞRU topoloji grafiğini (düğüm tipleri/sırası + bağlantılar +
 * portlar) ürettiği, ayrıca bağlantı id çakışmasını (senkron döngüde Date.now())
 * düzelttiği doğrulanır.
 */

// components.js sonundaki IIFE querySelector çağırır → minimal DOM
document.body.innerHTML =
  '<div class="ve-main"></div>' +
  '<div id="ve-module-overlay" style="display:none;"></div>' +
  '<div id="ve-canvas-wrapper"></div>';

const fs = require('fs');
const path = require('path');

// ── Global state + mock'lar ────────────────────────────────────────────────
function resetGlobals() {
  global.compCounter = 0;
  global.nodes = [];
  global.connections = [];
  global.undoStack = [];
  global.redoStack = [];
  global.canvasOffset = { x: 3000, y: 3000 };
  global.canvasZoom = 1;

  global.saveState = jest.fn(function () { undoStack.push({ n: nodes.length }); });
  global.showToast = jest.fn();
  global.updateAllConnections = jest.fn();
  global.clearSelection = jest.fn();
  global.addToSelection = jest.fn();
  global.confirm = jest.fn(function () { return true; });

  // Gerçek createNode davranışını taklit et: compCounter++, id ata, nodes'a ekle,
  // ilk differential/wheel'e master bayrağı koy.
  global.createNode = jest.fn(function (type, x, y) {
    global.compCounter++;
    var node = { id: 'comp-' + global.compCounter, type: type, x: x, y: y, data: {} };
    if (type === 'differential' && !nodes.some(function (n) { return n.type === 'differential'; })) node.isMasterDiff = true;
    if (type === 'wheel' && !nodes.some(function (n) { return n.type === 'wheel'; })) node.isMasterWheel = true;
    nodes.push(node);
  });

  // Gerçek createConnection: id = 'conn-' + Date.now() → senkron döngüde ÇAKIŞIR.
  // Kurucu bu id'yi 'conn-'+compCounter ile benzersizleştirmeli.
  global.createConnection = jest.fn(function (from, to, fromPort, toPort) {
    fromPort = fromPort || 'output';
    toPort = toPort || 'input';
    var exists = connections.some(function (c) {
      return c.from === from && c.to === to && c.fromPort === fromPort && c.toPort === toPort;
    });
    if (exists) return;
    connections.push({ id: 'conn-' + Date.now(), from: from, to: to, fromPort: fromPort, toPort: toPort });
  });
}

resetGlobals();
eval(fs.readFileSync(path.join(__dirname, '../../js/components.js'), 'utf8'));

// Yardımcı: id → tip haritası
function typeOf(id) {
  var n = nodes.find(function (x) { return x.id === id; });
  return n ? n.type : null;
}

describe('Araç Performans — veri yapısı bütünlüğü', () => {
  test('LAYOUT ve LINKS tanımlı', () => {
    expect(Array.isArray(VE_ARAC_PERFORMANS_LAYOUT)).toBe(true);
    expect(Array.isArray(VE_ARAC_PERFORMANS_LINKS)).toBe(true);
    expect(VE_ARAC_PERFORMANS_LAYOUT.length).toBe(16);
    expect(VE_ARAC_PERFORMANS_LINKS.length).toBe(11);
  });

  test('LAYOUT tipleri componentDefs içinde tanımlı', () => {
    VE_ARAC_PERFORMANS_LAYOUT.forEach(function (it) {
      expect(componentDefs[it.type]).toBeDefined();
    });
  });

  test('LINKS yalnızca LAYOUT içindeki key\'lere referans verir', () => {
    var keys = {};
    VE_ARAC_PERFORMANS_LAYOUT.forEach(function (it) { if (it.key) keys[it.key] = true; });
    VE_ARAC_PERFORMANS_LINKS.forEach(function (l) {
      expect(keys[l[0]]).toBe(true);
      expect(keys[l[1]]).toBe(true);
    });
  });

  test('üst diferansiyel/tekerlek listede önce (master ★ sırası)', () => {
    var diffIdx = VE_ARAC_PERFORMANS_LAYOUT.findIndex(function (it) { return it.key === 'diffTop'; });
    var diffBotIdx = VE_ARAC_PERFORMANS_LAYOUT.findIndex(function (it) { return it.key === 'diffBot'; });
    var w1Idx = VE_ARAC_PERFORMANS_LAYOUT.findIndex(function (it) { return it.key === 'w1'; });
    var w2Idx = VE_ARAC_PERFORMANS_LAYOUT.findIndex(function (it) { return it.key === 'w2'; });
    expect(diffIdx).toBeLessThan(diffBotIdx);
    expect(w1Idx).toBeLessThan(w2Idx);
  });
});

describe('Araç Performans — topoloji kurulumu', () => {
  let created;
  beforeAll(() => {
    resetGlobals();
    created = veBuildVehiclePerformanceModule();
  });

  test('16 düğüm oluşturulur ve dönüş değeri döner', () => {
    expect(createNode).toHaveBeenCalledTimes(16);
    expect(nodes.length).toBe(16);
    expect(Array.isArray(created)).toBe(true);
    expect(created.length).toBe(16);
  });

  test('doğru bileşen tipleri oluşturulur', () => {
    var counts = {};
    nodes.forEach(function (n) { counts[n.type] = (counts[n.type] || 0) + 1; });
    expect(counts['engine']).toBe(1);
    expect(counts['torque-converter']).toBe(1);
    expect(counts['gearbox']).toBe(1);
    expect(counts['propshaft']).toBe(1);
    expect(counts['transfer']).toBe(1);
    expect(counts['differential']).toBe(2);
    expect(counts['wheel']).toBe(4);
    expect(counts['ec-matching']).toBe(1);
    expect(counts['solver']).toBe(1);
    expect(counts['shift-controller']).toBe(1);
    expect(counts['vehicle']).toBe(1);
    expect(counts['obstacle-crossing']).toBe(1);
  });

  test('11 bağlantı kurulur', () => {
    expect(connections.length).toBe(11);
  });

  test('bağlantı grafiği tip/port düzeyinde doğru', () => {
    // (fromType, toType, fromPort, toPort) çoklu kümesi
    var actual = connections.map(function (c) {
      return typeOf(c.from) + '>' + typeOf(c.to) + ':' + c.fromPort + '/' + c.toPort;
    }).sort();
    var expected = [
      'engine>torque-converter:output/input',
      'engine>ec-matching:output/input',
      'torque-converter>gearbox:output/input',
      'gearbox>propshaft:output/input',
      'propshaft>transfer:output/input',
      'transfer>differential:output-0/input',
      'transfer>differential:output-1/input',
      'differential>wheel:output-0/input',
      'differential>wheel:output-1/input',
      'differential>wheel:output-0/input',
      'differential>wheel:output-1/input'
    ].sort();
    expect(actual).toEqual(expected);
  });

  test('Motor çıkışı iki girişe bağlanır (TC + Eşleştirme)', () => {
    var engine = nodes.find(function (n) { return n.type === 'engine'; });
    var fromEngine = connections.filter(function (c) { return c.from === engine.id; });
    expect(fromEngine.length).toBe(2);
    var targets = fromEngine.map(function (c) { return typeOf(c.to); }).sort();
    expect(targets).toEqual(['ec-matching', 'torque-converter'].sort());
  });

  test('bağlantı id\'leri benzersiz (Date.now() çakışması düzeltildi)', () => {
    var ids = connections.map(function (c) { return c.id; });
    expect(new Set(ids).size).toBe(ids.length);
    ids.forEach(function (id) { expect(id.indexOf('conn-')).toBe(0); });
  });

  test('ilk diferansiyel ve ilk tekerlek master (★) olur', () => {
    var diffs = nodes.filter(function (n) { return n.type === 'differential'; });
    var wheels = nodes.filter(function (n) { return n.type === 'wheel'; });
    expect(diffs[0].isMasterDiff).toBe(true);
    expect(diffs[1].isMasterDiff).toBeFalsy();
    expect(wheels[0].isMasterWheel).toBe(true);
    expect(wheels.slice(1).every(function (w) { return !w.isMasterWheel; })).toBe(true);
    // Master diferansiyel, transfer output-0'a (üst) bağlı olan olmalı
    var transfer = nodes.find(function (n) { return n.type === 'transfer'; });
    var topLink = connections.find(function (c) { return c.from === transfer.id && c.fromPort === 'output-0'; });
    expect(topLink.to).toBe(diffs[0].id);
  });
});
