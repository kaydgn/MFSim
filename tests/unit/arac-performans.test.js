/**
 * arac-performans.test.js — "Araç Performans" alt-sistem (subsystem) düğümü
 *
 * "Araç Performans" bir composite düğümdür; çift tıklanınca kendi iç topolojisi
 * açılır. Bu testte:
 *  1) componentDefs['arac-performans'] kaydı (subsystem düğümü, 0 port),
 *  2) veAracPopulateDrivetrain() — iç topolojiye kurulan hazır güç aktarma
 *     grafiği (16 düğüm + 11 bağlantı, port'lar, benzersiz id, master sırası),
 *  3) getAracPerformansPropertiesHTML() — "Alt Topolojiyi Aç" butonu
 * doğrulanır. veAracPopulateDrivetrain gerçek DOM'a değil global createNode /
 * createConnection'a dayanır → bunlar mock'lanır.
 */

// components.js sonundaki IIFE querySelector çağırır → minimal DOM
document.body.innerHTML =
  '<div class="ve-main"></div>' +
  '<div id="ve-module-overlay" style="display:none;"></div>' +
  '<div id="ve-canvas-wrapper"></div>';

const fs = require('fs');
const path = require('path');

function resetGlobals() {
  global.compCounter = 0;
  global.nodes = [];
  global.connections = [];
  global.canvasOffset = { x: 3000, y: 3000 };
  global.canvasZoom = 1;
  global.showToast = jest.fn();
  global.updateAllConnections = jest.fn();

  global.createNode = jest.fn(function (type, x, y) {
    global.compCounter++;
    var node = { id: 'comp-' + global.compCounter, type: type, x: x, y: y, data: {} };
    if (type === 'differential' && !nodes.some(function (n) { return n.type === 'differential'; })) node.isMasterDiff = true;
    if (type === 'wheel' && !nodes.some(function (n) { return n.type === 'wheel'; })) node.isMasterWheel = true;
    nodes.push(node);
  });

  // Gerçek createConnection gibi id = 'conn-' + Date.now() (senkron döngüde ÇAKIŞIR)
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
eval(fs.readFileSync(path.join(__dirname, '../../js/cp-arac-performans.js'), 'utf8'));

function typeOf(id) {
  var n = nodes.find(function (x) { return x.id === id; });
  return n ? n.type : null;
}

describe('Araç Performans — bileşen kaydı (subsystem düğümü)', () => {
  test('componentDefs girişi tanımlı ve doğru', () => {
    const def = componentDefs['arac-performans'];
    expect(def).toBeDefined();
    expect(def.name).toBe('Araç Performans');
    expect(def.inputs).toBe(0);
    expect(def.outputs).toBe(0);
    expect(def.isSubsystem).toBe(true);
    expect(typeof def.svg).toBe('string');
    expect(def.svg.startsWith('<svg')).toBe(true);
  });

  test('VE_MODULES components dizisinde mevcut', () => {
    expect(VE_MODULES['full-throttle'].components).toContain('arac-performans');
  });
});

describe('Araç Performans — veri yapısı bütünlüğü', () => {
  test('LAYOUT ve LINKS tanımlı', () => {
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
});

describe('Araç Performans — iç topoloji kurulumu (veAracPopulateDrivetrain)', () => {
  let created;
  beforeAll(() => {
    resetGlobals();
    created = veAracPopulateDrivetrain();
  });

  test('16 düğüm + 11 bağlantı oluşturulur', () => {
    expect(nodes.length).toBe(16);
    expect(connections.length).toBe(11);
    expect(Array.isArray(created)).toBe(true);
    expect(created.length).toBe(16);
  });

  test('doğru bileşen tipleri', () => {
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

  test('bağlantı grafiği tip/port düzeyinde doğru', () => {
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
    expect(fromEngine.map(function (c) { return typeOf(c.to); }).sort())
      .toEqual(['ec-matching', 'torque-converter'].sort());
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
    var transfer = nodes.find(function (n) { return n.type === 'transfer'; });
    var topLink = connections.find(function (c) { return c.from === transfer.id && c.fromPort === 'output-0'; });
    expect(topLink.to).toBe(diffs[0].id);
  });
});

describe('Araç Performans — özellik paneli', () => {
  test('getAracPerformansPropertiesHTML "Alt Topolojiyi Aç" butonu içerir', () => {
    const node = { id: 'comp-7', type: 'arac-performans', def: componentDefs['arac-performans'], data: {} };
    const html = getAracPerformansPropertiesHTML(node);
    expect(typeof html).toBe('string');
    expect(html).toContain("veAracOpenEditor('comp-7')");
    expect(html).toContain('Alt Topolojiyi Aç');
    // Henüz açılmamış → "hazır güç aktarma topolojisi ile başlar" bilgisi
    expect(html).toContain('hazır güç aktarma topolojisi');
  });

  test('açılmış (subTopology dolu) düğümde bileşen/bağlantı sayısı gösterilir', () => {
    const node = {
      id: 'comp-9', type: 'arac-performans', def: componentDefs['arac-performans'],
      data: { subTopology: { nodes: new Array(16), connections: new Array(11) } }
    };
    const html = getAracPerformansPropertiesHTML(node);
    expect(html).toContain('16');
    expect(html).toContain('11');
  });
});
