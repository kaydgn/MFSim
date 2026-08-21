/**
 * topology-wiring.test.js — KANVASTA TEL ÇEKMEK
 *
 * İki sessizlik burada kapanıyor; ikisi de kullanıcı tarafından "bağlantı
 * kurulmuyor" olarak bildirildi ve ikisi de gerçek tarayıcıda ölçüldü:
 *
 *  1) GEÇERSİZ PORT ÇİFTİ SESSİZCE YUTULUYORDU. İki çıkışa arka arkaya
 *     tıklamak hiçbir şey yapmıyor, hiçbir mesaj çıkmıyordu. FEAD'de bu
 *     özellikle yanıltıcı: port kenarı komşuya bakacak şekilde DİNAMİK
 *     (veFeadPortSideFor), yani "giriş solda / çıkış sağda" ipucu yok.
 *
 *  2) KAYIŞ YOLU KARTI BAĞLANTI DEĞİŞİNCE TAZELENMİYORDU. Kartın tek tazeleme
 *     noktası saveState()'ti, ama saveState mutasyondan ÖNCE çağrılıyor
 *     (geri-al anlık görüntüsü) — yani tel koparıldıktan sonra kart hiç
 *     yenilenmiyordu. Tazeleme artık updateAllConnections'ta, ama TOPOLOJİ
 *     İMZASINA bağlı: sürüklerken kart yeniden kurulmamalı (kurmak çözücüyü
 *     koşturmak demek).
 */
const stubs = stubGlobals({
  updateAllConnections: jest.fn(),
  updateNodeCount: jest.fn(),
  veCheckShiftControllerRequired: jest.fn(),
  veUpdateBoundary: jest.fn(),
  veMinimapUpdate: jest.fn(),
  veSyncPortDom: jest.fn(),
  veFeadRefreshLayoutCards: jest.fn(),
  updateNodeHandles: jest.fn(),
  veAttachNodeDrag: jest.fn(),
  veAttachPortConnect: jest.fn(),
  enablePortContextMenu: jest.fn(),
  showNodeContextMenu: jest.fn(),
  showLabelContextMenu: jest.fn(),
  applyNodeLabelPos: jest.fn(),
  updatePortPosition: jest.fn(),
  vePortStyleAttr: jest.fn(() => ''),
  veNodeDefaultSize: jest.fn(() => ({ w: 65, h: 60 })),
  startResize: jest.fn(),
  clearSelection: jest.fn(),
  addToSelection: jest.fn(),
  nodePortCount: jest.fn(() => 1),
});
global.nodes = [];
global.connections = [];
document.body.innerHTML = '<div id="ve-canvas"></div>';
eval(loadSource('ui-core.js'));

beforeEach(() => {
  resetStubs(stubs);
  global.nodes = [
    { id: 'a', type: 'fead-idler', x: 0, y: 0, data: {} },
    { id: 'b', type: 'fead-idler', x: 100, y: 0, data: {} }
  ];
  global.connections = [];
});

describe('port çifti — kurar ya da SEBEBİNİ SÖYLER', () => {
  test('çıkış → giriş bağlantıyı kurar', () => {
    expect(veTryConnectPorts('a', 'output', 'b', 'input')).toBe(true);
    expect(connections.length).toBe(1);
    expect(connections[0]).toMatchObject({ from: 'a', to: 'b', fromPort: 'output', toPort: 'input' });
  });

  test('giriş → çıkış aynı bağlantıyı TERS yönde kurar (yön korunur)', () => {
    expect(veTryConnectPorts('b', 'input', 'a', 'output')).toBe(true);
    expect(connections[0]).toMatchObject({ from: 'a', to: 'b' });
  });

  test('çıkış → ÇIKIŞ: bağlantı yok ama SESSİZ de değil', () => {
    expect(veTryConnectPorts('a', 'output', 'b', 'output')).toBe(false);
    expect(connections.length).toBe(0);
    expect(stubs.showToast).toHaveBeenCalledTimes(1);
    expect(stubs.showToast.mock.calls[0][0]).toMatch(/İki ÇIKIŞ/);
    expect(stubs.showToast.mock.calls[0][1]).toBe('warning');
  });

  test('giriş → GİRİŞ: bağlantı yok, uyarı var', () => {
    expect(veTryConnectPorts('a', 'input', 'b', 'input')).toBe(false);
    expect(connections.length).toBe(0);
    expect(stubs.showToast.mock.calls[0][0]).toMatch(/İki GİRİŞ/);
  });

  test('bileşen kendisine bağlanamaz ve bunu yazar', () => {
    expect(veTryConnectPorts('a', 'output', 'a', 'input')).toBe(false);
    expect(connections.length).toBe(0);
    expect(stubs.showToast.mock.calls[0][0]).toMatch(/kendisine/);
  });
});

// ── İmza: KİMLİK ve UÇLAR, konum DEĞİL ─────────────────────────────────────
describe('topoloji imzası — kart yalnız topoloji değişince kurulur', () => {
  const conns = require('fs').readFileSync(require('path').join(__dirname, '../../js/connections.js'), 'utf8');
  // connections.js'in tamamı gerekmiyor; imza + tazeleyici saf fonksiyonlar.
  const kes = conns.slice(conns.indexOf('var _veFeadTopoSig = null;'));
  eval(kes.slice(0, kes.indexOf('\n// Kontrol noktası sürükleme')));

  test('bağlantı eklenince/silinince imza değişir', () => {
    const a = veFeadTopoSignature();
    global.connections = [{ id: 'c1', from: 'a', to: 'b' }];
    const b = veFeadTopoSignature();
    expect(b).not.toBe(a);
    global.connections = [];
    expect(veFeadTopoSignature()).toBe(a);
  });

  test('düğüm SÜRÜKLENİNCE imza değişmez (kart yeniden kurulmaz)', () => {
    const a = veFeadTopoSignature();
    nodes[0].x += 250; nodes[0].y -= 90;
    expect(veFeadTopoSignature()).toBe(a);
  });

  test('düğüm eklenince imza değişir', () => {
    const a = veFeadTopoSignature();
    nodes.push({ id: 'c', type: 'fead-idler', x: 0, y: 0, data: {} });
    expect(veFeadTopoSignature()).not.toBe(a);
  });

  test('tazeleyici yalnız DEĞİŞİMDE kartı kurar', () => {
    veFeadTopoRefresh();                       // ilk çağrı: imza kurulur
    stubs.veFeadRefreshLayoutCards.mockClear();
    expect(veFeadTopoRefresh()).toBe(false);   // değişim yok
    expect(stubs.veFeadRefreshLayoutCards).not.toHaveBeenCalled();
    global.connections = [{ id: 'c1', from: 'a', to: 'b' }];
    expect(veFeadTopoRefresh()).toBe(true);
    expect(stubs.veFeadRefreshLayoutCards).toHaveBeenCalledTimes(1);
  });
});
