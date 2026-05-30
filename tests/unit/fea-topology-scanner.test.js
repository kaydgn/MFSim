/**
 * FEA Topoloji Motoru — animasyonlu tarama testleri
 * - veFEAStartTopologyScan / veFEACancelTopologyScan / veFEAIsTopologyScanning
 * - Faz faz tarama (yüzey → kenar → köşe)
 * - Progress bar DOM + canlı sayaç
 * - Viewer scan state metodları
 */

const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '../..');

eval(fs.readFileSync(path.join(ROOT, 'js/fea-mesh-utils.js'), 'utf8'));
eval(fs.readFileSync(path.join(ROOT, 'js/fea-feature-recognition.js'), 'utf8'));
eval(fs.readFileSync(path.join(ROOT, 'js/fea-topology.js'), 'utf8'));
eval(fs.readFileSync(path.join(ROOT, 'js/fea-topology-scanner.js'), 'utf8'));

// ─── Fake viewer — scan state metodlarını kaydeder ──────────────────────────
function makeFakeViewer() {
  return {
    _scanState: null,
    _topo: null,
    scanFacesCalls: [],
    scanEdgesCalls: [],
    scanVerticesCalls: [],
    cleared: 0,
    setTopologyData: function(t) { this._topo = t; },
    setScanState: function(s) { this._scanState = s; },
    setScanFaces: function(map, color) { this.scanFacesCalls.push({ count: Object.keys(map).length, color: color }); this._scanState = this._scanState || {}; this._scanState.faces = map; },
    setScanEdges: function(map, color) { this.scanEdgesCalls.push({ count: Object.keys(map).length, color: color }); this._scanState = this._scanState || {}; this._scanState.edges = map; },
    setScanVertices: function(map, color) { this.scanVerticesCalls.push({ count: Object.keys(map).length, color: color }); this._scanState = this._scanState || {}; this._scanState.vertices = map; },
    clearScanState: function() { this.cleared++; this._scanState = null; }
  };
}

describe('Topoloji Motoru — tarama yaşam döngüsü', () => {
  beforeEach(() => {
    global.nodes = [];
    global.veFEAViewerRegistry = {};
    document.body.innerHTML = '';
    // requestAnimationFrame'i hemen-çalıştır mock
    global.requestAnimationFrame = function(cb) { return setTimeout(function() { cb(performance.now()); }, 0); };
    global.cancelAnimationFrame = function(id) { clearTimeout(id); };
  });
  afterEach(() => {
    // Aktif taramaları temizle
    if (global.nodes) global.nodes.forEach(function(n) { veFEACancelTopologyScan(n.id); });
  });

  function setupBox(meshId) {
    var geomNode = {
      id: 'geom-' + meshId, type: 'fea-geometry',
      data: { geometry: { type: 'box', params: { width: 50, height: 30, depth: 20 } } }
    };
    geomNode.data.geometry.topology = veFEAComputeGeometryTopology(geomNode.data.geometry);
    var meshNode = { id: meshId, type: 'fea-mesh', data: {} };
    global.nodes = [geomNode, meshNode];
    global.connections = [{ from: geomNode.id, to: meshId }];
    // veFEAFindUpstreamGeometryNode mock — fea-viewer yüklenmediği için
    global.veFEAFindUpstreamGeometryNode = function(id) {
      return global.connections.filter(function(c){ return c.to === id; })
        .map(function(c){ return global.nodes.find(function(n){ return n.id === c.from; }); })[0] || null;
    };
    var viewer = makeFakeViewer();
    global.veFEAViewerRegistry[meshId] = viewer;
    // Canvas + container (progress bar için)
    var container = document.createElement('div');
    var canvas = document.createElement('canvas');
    canvas.id = 've-fea-mesh-canvas-' + meshId;
    container.appendChild(canvas);
    document.body.appendChild(container);
    return { viewer: viewer, meshNode: meshNode, canvas: canvas, container: container };
  }

  test('Viewer yoksa tarama başlamaz (false döner)', () => {
    global.nodes = [{ id: 'no-viewer', type: 'fea-mesh', data: {} }];
    expect(veFEAStartTopologyScan('no-viewer')).toBe(false);
  });

  test('Geometri yoksa tarama başlamaz', () => {
    var meshNode = { id: 'no-geom', type: 'fea-mesh', data: {} };
    global.nodes = [meshNode];
    global.veFEAViewerRegistry['no-geom'] = makeFakeViewer();
    global.veFEAFindUpstreamGeometryNode = function() { return null; };
    expect(veFEAStartTopologyScan('no-geom')).toBe(false);
  });

  test('Box geometri ile tarama başlar (true döner) + scanning state aktif', () => {
    var s = setupBox('mesh-scan1');
    var ok = veFEAStartTopologyScan('mesh-scan1', { durationMs: 500 });
    expect(ok).toBe(true);
    expect(veFEAIsTopologyScanning('mesh-scan1')).toBe(true);
  });

  test('Tarama başlayınca viewer.setTopologyData ve setScanState çağrılır', () => {
    var s = setupBox('mesh-scan2');
    veFEAStartTopologyScan('mesh-scan2', { durationMs: 500 });
    expect(s.viewer._topo).not.toBeNull();
    expect(s.viewer._scanState).not.toBeNull();
    expect(s.viewer._scanState.faceColor).toBe(0x22c55e);
  });

  test('Progress bar DOM\'u canvas container\'ına eklenir', () => {
    var s = setupBox('mesh-scan3');
    veFEAStartTopologyScan('mesh-scan3', { durationMs: 500 });
    var bar = document.getElementById('ve-fea-scan-progress-mesh-scan3');
    expect(bar).not.toBeNull();
    expect(bar.querySelector('[data-scan-bar]')).not.toBeNull();
    expect(bar.querySelectorAll('[data-seg]').length).toBeGreaterThan(10);  // segment'li bar
    expect(bar.querySelector('[data-c-faces]')).not.toBeNull();
  });

  test('Canlı sayaç DOM\'da yüzey/kenar/köşe etiketleri içerir', () => {
    var s = setupBox('mesh-scan4');
    veFEAStartTopologyScan('mesh-scan4', { durationMs: 500 });
    var bar = document.getElementById('ve-fea-scan-progress-mesh-scan4');
    expect(bar.querySelector('[data-c-faces]').textContent).toMatch(/yüzey/);
    expect(bar.querySelector('[data-c-edges]').textContent).toMatch(/kenar/);
    expect(bar.querySelector('[data-c-verts]').textContent).toMatch(/köşe/);
  });

  test('veFEACancelTopologyScan tarama durdurur + viewer temizler', () => {
    var s = setupBox('mesh-scan5');
    veFEAStartTopologyScan('mesh-scan5', { durationMs: 500 });
    expect(veFEAIsTopologyScanning('mesh-scan5')).toBe(true);
    veFEACancelTopologyScan('mesh-scan5');
    expect(veFEAIsTopologyScanning('mesh-scan5')).toBe(false);
    expect(s.viewer.cleared).toBeGreaterThanOrEqual(1);
  });

  test('Yeni tarama önceki taramayı iptal eder (çift başlatma)', () => {
    var s = setupBox('mesh-scan6');
    veFEAStartTopologyScan('mesh-scan6', { durationMs: 500 });
    var firstState = veFEAIsTopologyScanning('mesh-scan6');
    veFEAStartTopologyScan('mesh-scan6', { durationMs: 500 });
    expect(firstState).toBe(true);
    expect(veFEAIsTopologyScanning('mesh-scan6')).toBe(true);
  });

  test('veFEAScanTopologyButton export edilmiş', () => {
    expect(typeof veFEAScanTopologyButton).toBe('function');
  });

  test('veFEAScanTopologyButton primitif (STEP değil) geometride doğrudan tarar', async () => {
    var s = setupBox('mesh-btn1');  // box geometri → STEP değil → BREP hazırlık atlanır
    veFEAScanTopologyButton('mesh-btn1', { durationMs: 300 });
    // _veFEAScanPrepareBrep Promise.resolve(false) → .then(veFEAStartTopologyScan)
    await Promise.resolve(); await Promise.resolve(); await Promise.resolve();
    expect(veFEAIsTopologyScanning('mesh-btn1')).toBe(true);
    veFEACancelTopologyScan('mesh-btn1');
  });

  test('Tarama tamamlanınca onComplete çağrılır + topologyScanned=true', (done) => {
    var s = setupBox('mesh-scan7');
    veFEAStartTopologyScan('mesh-scan7', {
      durationMs: 60,  // çok kısa → hızlı tamamlansın
      onComplete: function(topo) {
        expect(topo).not.toBeNull();
        expect(Array.isArray(topo.faces)).toBe(true);
        expect(s.meshNode.data.topologyScanned).toBe(true);
        expect(s.meshNode.data.topologySummary.faces).toBe(6);  // box 6 yüzey
        done();
      }
    });
  });

  test('Tamamlanınca viewer scan state temizlenir + topology normal set edilir', (done) => {
    var s = setupBox('mesh-scan8');
    veFEAStartTopologyScan('mesh-scan8', {
      durationMs: 60,
      onComplete: function() {
        expect(s.viewer.cleared).toBeGreaterThanOrEqual(1);
        expect(veFEAIsTopologyScanning('mesh-scan8')).toBe(false);
        done();
      }
    });
  });

  test('Faz faz: yüzey rengi yeşil, kenar cyan, köşe sarı', () => {
    var s = setupBox('mesh-scan9');
    veFEAStartTopologyScan('mesh-scan9', { durationMs: 500 });
    // İlk frame yüzey fazı — setScanFaces yeşil renkle çağrılmış olmalı
    return new Promise(function(resolve) {
      setTimeout(function() {
        expect(s.viewer.scanFacesCalls.length).toBeGreaterThan(0);
        expect(s.viewer.scanFacesCalls[0].color).toBe(0x22c55e);
        veFEACancelTopologyScan('mesh-scan9');
        resolve();
      }, 30);
    });
  });
});

describe('Topoloji Motoru — birleşik modül (node kendi geometry\'si)', () => {
  beforeEach(() => {
    global.nodes = [];
    global.veFEAViewerRegistry = {};
    document.body.innerHTML = '';
    global.requestAnimationFrame = function(cb) { return setTimeout(function() { cb(performance.now()); }, 0); };
    global.cancelAnimationFrame = function(id) { clearTimeout(id); };
    global.veFEAFindUpstreamGeometryNode = function() { return null; };
  });

  test('Birleşik modül node\'unda data.geometry varsa tarama çalışır', () => {
    var node = {
      id: 'fea-unified', type: 'fea',
      data: { geometry: { type: 'cylinder', params: { radius: 10, height: 40 } } }
    };
    node.data.geometry.topology = veFEAComputeGeometryTopology(node.data.geometry);
    global.nodes = [node];
    var viewer = makeFakeViewer();
    global.veFEAViewerRegistry['fea-unified'] = viewer;
    var container = document.createElement('div');
    var canvas = document.createElement('canvas');
    canvas.id = 've-fea-mesh-canvas-fea-unified';
    container.appendChild(canvas);
    document.body.appendChild(container);
    var ok = veFEAStartTopologyScan('fea-unified', { durationMs: 300 });
    expect(ok).toBe(true);
    veFEACancelTopologyScan('fea-unified');
  });
});
