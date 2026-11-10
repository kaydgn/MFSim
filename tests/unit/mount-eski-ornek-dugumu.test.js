/**
 * mount-eski-ornek-dugumu.test.js — KALKAN "BAŞLANGIÇ VE ÖRNEKLER" DÜĞÜMÜ AÇILIŞTA DÜŞER
 * ─────────────────────────────────────────────────────────────────────────────────────
 * Kullanıcı 2026-11-10 (Canlı Not 110): "Bu bileşeni tamamen kaldıralım." Tip
 * (`mnt-example`) componentDefs'ten çıktı; onu taşıyan KAYITLI projeler yine açılmalı.
 * GERÇEK restoreState: tanımsız tipli düğüm sessizce atlanır (Koordinat Düzlemi ile aynı
 * yol — Canlı Not 63), gerisi yerinde yüklenir; yalnız o düğümü taşıyan eski boş topoloji
 * gerçekten boş kalır ve başlangıç sayfasını gerektirir.
 */
const stubs = stubGlobals({
  vePortStyleAttr: jest.fn(() => ''), escapeHTML: jest.fn((s) => String(s)),
  updateNodeHandles: jest.fn(), startResize: jest.fn(), enablePortContextMenu: jest.fn(),
  veAttachNodeDrag: jest.fn(), veAttachPortConnect: jest.fn(), getPortPosition: jest.fn(() => ({ x: 0, y: 0 })),
  updatePortPosition: jest.fn(), applyNodeLabelPos: jest.fn(), showLabelContextMenu: jest.fn(),
  updateNodeCount: jest.fn(), clearSelection: jest.fn(), veMinimapUpdate: jest.fn(),
  veUpdateBoundary: jest.fn(),
});
document.body.innerHTML = '<div id="ve-canvas"></div><svg id="ve-connections-layer"></svg>';
global.nodes = [];
global.connections = [];
global.selectedNodes = [];
global.compCounter = 0;
global.canvasOffset = { x: 0, y: 0 };
global.canvasZoom = 1;
global.isConnecting = false;
eval(loadSource('components.js'));
global.veIsCanvasHidden = veIsCanvasHidden;
global.componentDefs = componentDefs;
global.VE_STANDALONE_TYPES = VE_STANDALONE_TYPES;
eval(loadSource('state.js'));
eval(loadSource('connections.js'));
veStopAutoSync();
global.saveState = saveState;
global.updateAllConnections = updateAllConnections;
const BS = require('../../js/cp-mount-baslangic.js');

beforeEach(() => { resetStubs(stubs); });

const kayit = (dugumler) => ({ schemaVersion: VE_SCHEMA_VERSION, connections: [], nodes: dugumler });
const eski = { id: 'comp-7', type: 'mnt-example', x: 3200, y: 3040, width: 60, height: 56, data: { exampleKey: 'tulga' } };
const motor = { id: 'comp-8', type: 'mnt-motor', x: 3100, y: 3100, width: 60, height: 56, data: { mass: 1386.3 } };

describe('KAYITLI ESKİ PROJE — Başlangıç ve Örnekler düğümü', () => {
  test('tip artık tanımsız: componentDefs\'te yok', () => {
    expect(componentDefs['mnt-example']).toBeUndefined();
  });

  test('modelle birlikte kayıtlı eski düğüm düşer; kalan düğüm yerinde yüklenir', () => {
    restoreState(kayit([eski, motor]));
    expect(nodes.map((n) => n.type)).toEqual(['mnt-motor']);
    expect(nodes[0].data.mass).toBe(1386.3);
    expect(document.getElementById('comp-7')).toBeNull();
  });

  test('yalnız o düğümü taşıyan eski boş topoloji gerçekten boş: başlangıç sayfası gerekir', () => {
    restoreState(kayit([eski]));
    expect(nodes).toEqual([]);
    expect(BS.veMntBaslangicGerekli(nodes)).toBe(true);
  });

  test('yeni Başlangıç Sihirbazı bileşeni yüklenir ve model sayılmaz', () => {
    restoreState(kayit([{ id: 'comp-9', type: 'mnt-wizard', x: 3300, y: 3040, width: 60, height: 56, data: {} }]));
    expect(nodes.map((n) => n.type)).toEqual(['mnt-wizard']);
    expect(BS.veMntBaslangicGerekli(nodes)).toBe(true);        // yalnız sihirbazı açan düğüm boş sayılır
    restoreState(kayit([{ id: 'comp-9', type: 'mnt-wizard', x: 3300, y: 3040, width: 60, height: 56, data: {} }, motor]));
    expect(BS.veMntBaslangicGerekli(nodes)).toBe(false);
  });
});
