/**
 * fit-view.test.js — "İÇERİĞE SIĞDIR" (js/ui-core.js → veFitViewToContent)
 * ─────────────────────────────────────────────────────────────────────────
 * İki seçenek FEAD'in tablo penceresi için eklendi (Çizim Masası,
 * 2026-09-23): pencere kanvasın alt kısmına biniyor ve ölçüldü — açılışta iki
 * çizimin ALT YARISI (175 px) pencerenin altında kalıyordu.
 *
 *   only        : yalnız süzülen düğümler sığdırılır (çizimler; künyeler değil)
 *   bottomInset : kabın altından bu kadar px ÖRTÜLÜ — içerik üstte kalan
 *                 alana sığdırılır ve O ALANIN ortasına oturur
 *
 * Seçeneksiz çağrı BİREBİR eski davranış: projenin her "sığdır" çağrısı
 * (açılış, örnek, Otomatik Düzenle) bu işlevden geçiyor.
 */
stubGlobals({
  updateNodeHandles: jest.fn(), veAttachNodeDrag: jest.fn(), veAttachPortConnect: jest.fn(),
  enablePortContextMenu: jest.fn(), showNodeContextMenu: jest.fn(),
  showLabelContextMenu: jest.fn(), applyNodeLabelPos: jest.fn(),
  updatePortPosition: jest.fn(), vePortStyleAttr: jest.fn(() => ''),
  veNodeDefaultSize: jest.fn(() => ({ w: 65, h: 60 })), veUpdateBoundary: jest.fn(),
  veMinimapUpdate: jest.fn(), startResize: jest.fn(), updateNodeCount: jest.fn(),
  clearSelection: jest.fn(), addToSelection: jest.fn(), nodePortCount: jest.fn(() => 1),
  updateAllConnections: jest.fn(),
});
document.body.innerHTML = '<div id="ve-canvas-wrapper"><div id="ve-canvas"></div></div>';
global.componentDefs = {};
global.nodes = [];
global.connections = [];
global.compCounter = 0;
global.selectedNodes = [];
global.VE_STANDALONE_TYPES = [];
global.canvasZoom = 1;
global.canvasOffset = { x: 0, y: 0 };
eval(loadSource('ui-core.js'));

const W = 1300, H = 900;
beforeEach(() => {
  const w = document.getElementById('ve-canvas-wrapper');
  Object.defineProperty(w, 'clientWidth', { configurable: true, get: () => W });
  Object.defineProperty(w, 'clientHeight', { configurable: true, get: () => H });
  canvasZoom = 1; canvasOffset.x = 0; canvasOffset.y = 0;
  // İki kanvas (440×500) yan yana + solda bir künye (80×60).
  nodes.length = 0;
  nodes.push({ id: 'k1', type: 'kanvas', x: 3100, y: 3000, width: 440, height: 500 },
             { id: 'k2', type: 'kanvas', x: 3564, y: 3000, width: 440, height: 500 },
             { id: 'a1', type: 'kunye', x: 2800, y: 2900, width: 80, height: 60 });
});
// Kanvas içeriğinin ekrandaki kutusu (#ve-canvas: -3000 başlangıç + dönüşüm).
const ekran = (n) => ({
  ust: (n.y - 3000) * canvasZoom + canvasOffset.y,
  alt: (n.y + n.height - 3000) * canvasZoom + canvasOffset.y,
  sol: (n.x - 3000) * canvasZoom + canvasOffset.x,
  sag: (n.x + n.width - 3000) * canvasZoom + canvasOffset.x,
});

test('seçeneksiz: bütün düğümler, bütün kabın ortasına — eski davranış', () => {
  veFitViewToContent({ margin: 24 });
  const k = nodes.map(ekran);
  const ust = Math.min(...k.map((b) => b.ust)), alt = Math.max(...k.map((b) => b.alt));
  const sol = Math.min(...k.map((b) => b.sol)), sag = Math.max(...k.map((b) => b.sag));
  expect((ust + alt) / 2).toBeCloseTo(H / 2, 6);
  expect((sol + sag) / 2).toBeCloseTo(W / 2, 6);
});

test('bottomInset: içerik ÖRTÜLMEYEN alana sığar ve o alanın ortasına oturur', () => {
  const ortu = 383;                                   // pencere: kabın alt 383 px'i
  veFitViewToContent({ margin: 24, bottomInset: ortu,
                       only: (n) => n.type === 'kanvas', maxZoom: 1.2 });
  const k = nodes.filter((n) => n.type === 'kanvas').map(ekran);
  const alt = Math.max(...k.map((b) => b.alt)), ust = Math.min(...k.map((b) => b.ust));
  expect(alt).toBeLessThanOrEqual(H - ortu - 24 + 1e-6);   // pencerenin üstünde
  expect(ust).toBeGreaterThanOrEqual(24 - 1e-6);
  expect((ust + alt) / 2).toBeCloseTo((H - ortu) / 2, 6);
});

test('only: süzülmeyen düğüm sığdırmaya girmez — künye kadrajı büyütmez', () => {
  veFitViewToContent({ margin: 24, only: (n) => n.type === 'kanvas', maxZoom: 5 });
  const z1 = canvasZoom;
  veFitViewToContent({ margin: 24, maxZoom: 5 });
  // Künye soldan ve yukarıdan taşıyor: onu da sayan çağrı daha UZAK kalır.
  expect(z1).toBeGreaterThan(canvasZoom);
});

test('örtü kabı tüketirse kamera OYNAMAZ', () => {
  canvasZoom = 0.7; canvasOffset.x = 11; canvasOffset.y = 22;
  veFitViewToContent({ bottomInset: H - 10 });
  expect([canvasZoom, canvasOffset.x, canvasOffset.y]).toEqual([0.7, 11, 22]);
});
