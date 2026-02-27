/**
 * sensors.js birim testleri
 * Sensör Sihirbazı: topoloji tarama, sensör eşleme, kurulum/kaldırma
 */

// jsdom ortamında global DOM öğelerini simüle et
document.body.innerHTML = '<div id="ve-canvas"></div>';

// Gerekli global değişkenler
global.nodes = [];
global.connections = [];

// Stub fonksiyonlar
global.showToast = jest.fn();
global.saveState = jest.fn();
global.showNodeProperties = jest.fn();

const fs = require('fs');
const path = require('path');
const code = fs.readFileSync(path.join(__dirname, '../../js/sensors.js'), 'utf8');
eval(code);

beforeEach(() => {
  nodes = [];
  connections = [];
  showToast.mockClear();
  saveState.mockClear();
  showNodeProperties.mockClear();
});

// ── Yardımcı: test node'ları oluştur ──
function makeNode(type, id, data) {
  return { id: id || type + '-1', type: type, x: 0, y: 0, width: 65, height: 60, data: data || {} };
}

// ═════════════════════════════════════════════════════════════════════
// swScanTopology
// ═════════════════════════════════════════════════════════════════════
describe('swScanTopology', () => {
  test('boş topolojide tüm bayraklar false', () => {
    var result = swScanTopology();
    expect(result.hasEngine).toBe(false);
    expect(result.hasTC).toBe(false);
    expect(result.hasGearbox).toBe(false);
    expect(result.hasVehicle).toBe(false);
    expect(result.chainComplete).toBe(false);
    expect(result.existingSensors).toHaveLength(0);
  });

  test('motor bileşeni algılar (engine)', () => {
    nodes = [makeNode('engine', 'e1')];
    var result = swScanTopology();
    expect(result.hasEngine).toBe(true);
    expect(result.engineNode.id).toBe('e1');
  });

  test('motor freni bileşeni algılar (engine-brake)', () => {
    nodes = [makeNode('engine-brake', 'eb1')];
    var result = swScanTopology();
    expect(result.hasEngine).toBe(true);
    expect(result.engineNode.id).toBe('eb1');
  });

  test('tam zinciri algılar (chainComplete)', () => {
    nodes = [
      makeNode('engine', 'e1'),
      makeNode('torque-converter', 'tc1'),
      makeNode('gearbox', 'gb1'),
      makeNode('vehicle', 'v1')
    ];
    var result = swScanTopology();
    expect(result.chainComplete).toBe(true);
    expect(result.hasEngine).toBe(true);
    expect(result.hasTC).toBe(true);
    expect(result.hasGearbox).toBe(true);
    expect(result.hasVehicle).toBe(true);
  });

  test('eksik bileşen varsa chainComplete false', () => {
    nodes = [
      makeNode('engine', 'e1'),
      makeNode('gearbox', 'gb1'),
      makeNode('vehicle', 'v1')
    ];
    var result = swScanTopology();
    expect(result.chainComplete).toBe(false);
    expect(result.hasTC).toBe(false);
  });

  test('sensör node\'larını toplar', () => {
    nodes = [
      makeNode('sensor', 's1', { attachedComponent: 'e1', sensorDirection: 'from', selectedSignal: 'rpm' }),
      makeNode('sensor', 's2', { attachedConnection: 'c1', sensorDirection: 'to', selectedSignal: 'torque' })
    ];
    var result = swScanTopology();
    expect(result.existingSensors).toHaveLength(2);
    expect(result.existingSensors[0].signal).toBe('rpm');
    expect(result.existingSensors[1].direction).toBe('to');
  });

  test('tüm bileşen tiplerini algılar', () => {
    nodes = [
      makeNode('engine', 'e1'),
      makeNode('torque-converter', 'tc1'),
      makeNode('gearbox', 'gb1'),
      makeNode('transfer', 'tr1'),
      makeNode('differential', 'd1'),
      makeNode('vehicle', 'v1'),
      makeNode('road', 'r1'),
      makeNode('shift-controller', 'sc1'),
      makeNode('solver', 'so1')
    ];
    var result = swScanTopology();
    expect(result.hasEngine).toBe(true);
    expect(result.hasTC).toBe(true);
    expect(result.hasGearbox).toBe(true);
    expect(result.hasTransfer).toBe(true);
    expect(result.hasDiff).toBe(true);
    expect(result.hasVehicle).toBe(true);
    expect(result.hasRoad).toBe(true);
    expect(result.hasShiftCtrl).toBe(true);
    expect(result.hasSolver).toBe(true);
  });
});

// ═════════════════════════════════════════════════════════════════════
// swCheckSensorExists
// ═════════════════════════════════════════════════════════════════════
describe('swCheckSensorExists', () => {
  test('eşleşen component sensörü bulur', () => {
    nodes = [
      makeNode('engine', 'e1'),
      makeNode('sensor', 's1', { attachedComponent: 'e1', sensorDirection: 'from', selectedSignal: 'rpm' })
    ];
    var topo = swScanTopology();
    var result = swCheckSensorExists({ target: 'engine', attachment: 'component', signal: 'rpm' }, topo);
    expect(result.matched).toBe(true);
    expect(result.sensorNode.id).toBe('s1');
  });

  test('engine-brake tipi engine olarak eşleşir', () => {
    nodes = [
      makeNode('engine-brake', 'eb1'),
      makeNode('sensor', 's1', { attachedComponent: 'eb1', sensorDirection: 'from', selectedSignal: 'rpm' })
    ];
    var topo = swScanTopology();
    var result = swCheckSensorExists({ target: 'engine', attachment: 'component', signal: 'rpm' }, topo);
    expect(result.matched).toBe(true);
  });

  test('yanlış sinyal eşleşmez', () => {
    nodes = [
      makeNode('engine', 'e1'),
      makeNode('sensor', 's1', { attachedComponent: 'e1', sensorDirection: 'from', selectedSignal: 'torque' })
    ];
    var topo = swScanTopology();
    var result = swCheckSensorExists({ target: 'engine', attachment: 'component', signal: 'rpm' }, topo);
    expect(result.matched).toBe(false);
  });

  test('bağlantı üzerinde output sensörü eşleştirir', () => {
    nodes = [
      makeNode('engine', 'e1'),
      makeNode('gearbox', 'gb1'),
      makeNode('sensor', 's1', { attachedConnection: 'c1', sensorDirection: 'from', selectedSignal: 'torque' })
    ];
    connections = [{ id: 'c1', from: 'e1', to: 'gb1' }];
    var topo = swScanTopology();
    var result = swCheckSensorExists({ target: 'engine', attachment: 'output', signal: 'torque' }, topo);
    expect(result.matched).toBe(true);
  });

  test('bağlantı üzerinde input sensörü eşleştirir', () => {
    nodes = [
      makeNode('engine', 'e1'),
      makeNode('gearbox', 'gb1'),
      makeNode('sensor', 's1', { attachedConnection: 'c1', sensorDirection: 'to', selectedSignal: 'torque' })
    ];
    connections = [{ id: 'c1', from: 'e1', to: 'gb1' }];
    var topo = swScanTopology();
    var result = swCheckSensorExists({ target: 'gearbox', attachment: 'input', signal: 'torque' }, topo);
    expect(result.matched).toBe(true);
  });

  test('sensör yoksa eşleşmez', () => {
    nodes = [makeNode('engine', 'e1')];
    var topo = swScanTopology();
    var result = swCheckSensorExists({ target: 'engine', attachment: 'component', signal: 'rpm' }, topo);
    expect(result.matched).toBe(false);
    expect(result.sensorNode).toBeNull();
  });
});

// ═════════════════════════════════════════════════════════════════════
// swInstallSensors
// ═════════════════════════════════════════════════════════════════════
describe('swInstallSensors', () => {
  test('null/yanlış tipte node ile çağrılırsa işlem yapmaz', () => {
    swInstallSensors(null);
    swInstallSensors(makeNode('engine', 'e1'));
    expect(showToast).not.toHaveBeenCalled();
  });

  test('sadece vehicle varsa performance ve traction paketlerini kurar', () => {
    nodes = [makeNode('vehicle', 'v1')];
    var wizNode = makeNode('sensor-wizard', 'sw1');
    wizNode.data = {};
    nodes.push(wizNode);

    swInstallSensors(wizNode);

    expect(wizNode.data.sensorsInstalled).toBe(true);
    expect(wizNode.data.installedPackages).toContain('performance');
    expect(wizNode.data.installedPackages).toContain('traction-analysis');
    expect(wizNode.data.installedPackages).not.toContain('engine-analysis');
    expect(wizNode.data.installedPackages).not.toContain('tc-analysis');
    expect(wizNode.data.activeSensors.length).toBeGreaterThan(0);
    expect(saveState).toHaveBeenCalled();
    expect(showToast).toHaveBeenCalled();
  });

  test('motor + araç varsa engine-analysis paketi de kurulur', () => {
    nodes = [
      makeNode('engine', 'e1'),
      makeNode('vehicle', 'v1')
    ];
    var wizNode = makeNode('sensor-wizard', 'sw1');
    wizNode.data = {};
    nodes.push(wizNode);

    swInstallSensors(wizNode);

    expect(wizNode.data.installedPackages).toContain('performance');
    expect(wizNode.data.installedPackages).toContain('engine-analysis');
    expect(wizNode.data.installedPackages).toContain('traction-analysis');
  });

  test('engine-brake tipi motor olarak sayılır', () => {
    nodes = [
      makeNode('engine-brake', 'eb1'),
      makeNode('vehicle', 'v1')
    ];
    var wizNode = makeNode('sensor-wizard', 'sw1');
    wizNode.data = {};
    nodes.push(wizNode);

    swInstallSensors(wizNode);

    expect(wizNode.data.installedPackages).toContain('engine-analysis');
  });

  test('tam zincirde tüm uygun paketler kurulur', () => {
    nodes = [
      makeNode('engine', 'e1'),
      makeNode('torque-converter', 'tc1'),
      makeNode('gearbox', 'gb1'),
      makeNode('shift-controller', 'sc1'),
      makeNode('vehicle', 'v1')
    ];
    var wizNode = makeNode('sensor-wizard', 'sw1');
    wizNode.data = {};
    nodes.push(wizNode);

    swInstallSensors(wizNode);

    expect(wizNode.data.installedPackages).toContain('performance');
    expect(wizNode.data.installedPackages).toContain('engine-analysis');
    expect(wizNode.data.installedPackages).toContain('tc-analysis');
    expect(wizNode.data.installedPackages).toContain('traction-analysis');
    expect(wizNode.data.installedPackages).toContain('shift-analysis');
    expect(wizNode.data.installedPackages).toContain('comparison');
  });

  test('her sensörde doğru metadata bulunur', () => {
    nodes = [makeNode('vehicle', 'v1')];
    var wizNode = makeNode('sensor-wizard', 'sw1');
    wizNode.data = {};
    nodes.push(wizNode);

    swInstallSensors(wizNode);

    wizNode.data.activeSensors.forEach(function(s) {
      expect(s).toHaveProperty('packageId');
      expect(s).toHaveProperty('target');
      expect(s).toHaveProperty('attachment');
      expect(s).toHaveProperty('signal');
      expect(s).toHaveProperty('label');
    });
  });
});

// ═════════════════════════════════════════════════════════════════════
// swRemoveSensors
// ═════════════════════════════════════════════════════════════════════
describe('swRemoveSensors', () => {
  test('kurulu sensörleri temizler', () => {
    var wizNode = makeNode('sensor-wizard', 'sw1');
    wizNode.data = {
      sensorsInstalled: true,
      installedPackages: ['performance'],
      activeSensors: [{ packageId: 'performance', target: 'vehicle', signal: 'v_speed' }]
    };
    nodes = [wizNode];

    swRemoveSensors(wizNode);

    expect(wizNode.data.sensorsInstalled).toBe(false);
    expect(wizNode.data.installedPackages).toHaveLength(0);
    expect(wizNode.data.activeSensors).toHaveLength(0);
    expect(saveState).toHaveBeenCalled();
    expect(showToast).toHaveBeenCalledWith('Sensörler kaldırıldı', 'info');
  });

  test('null/yanlış tipte node ile çağrılırsa işlem yapmaz', () => {
    swRemoveSensors(null);
    swRemoveSensors(makeNode('engine', 'e1'));
    expect(saveState).not.toHaveBeenCalled();
  });
});

// ═════════════════════════════════════════════════════════════════════
// SENSOR_PACKAGES veri yapısı doğrulaması
// ═════════════════════════════════════════════════════════════════════
describe('SENSOR_PACKAGES yapısı', () => {
  test('tüm paketlerin gerekli alanları var', () => {
    SENSOR_PACKAGES.forEach(function(pkg) {
      expect(pkg).toHaveProperty('id');
      expect(pkg).toHaveProperty('name');
      expect(pkg).toHaveProperty('requires');
      expect(pkg).toHaveProperty('diagrams');
      expect(pkg).toHaveProperty('sensors');
      expect(Array.isArray(pkg.requires)).toBe(true);
      expect(Array.isArray(pkg.diagrams)).toBe(true);
      expect(Array.isArray(pkg.sensors)).toBe(true);
    });
  });

  test('her diyagramın SW_DIAGRAM_SIGNALS karşılığı var', () => {
    SENSOR_PACKAGES.forEach(function(pkg) {
      pkg.diagrams.forEach(function(d) {
        expect(SW_DIAGRAM_SIGNALS).toHaveProperty(d.id);
      });
    });
  });

  test('SW_DIAGRAM_SIGNALS yapısı doğru', () => {
    Object.keys(SW_DIAGRAM_SIGNALS).forEach(function(diagId) {
      var sig = SW_DIAGRAM_SIGNALS[diagId];
      expect(sig).toHaveProperty('x');
      expect(sig).toHaveProperty('y');
      expect(sig.x).toHaveProperty('target');
      expect(Array.isArray(sig.y)).toBe(true);
      sig.y.forEach(function(ySig) {
        expect(ySig).toHaveProperty('target');
        expect(ySig).toHaveProperty('signal');
        expect(ySig).toHaveProperty('name');
        expect(ySig).toHaveProperty('unit');
      });
    });
  });
});
