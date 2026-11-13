/**
 * sag-tik-pencere.test.js — SAĞ TIK PENCEREYİ AÇMAZ, KONUSUNU DEĞİŞTİRMEZ
 * ─────────────────────────────────────────────────────────────────────────
 * Kullanıcı 2026-11-11, Canlı Not 156 (Takoz › Parametrik Analiz): "Sağ tıklayınca sağda
 * pencere açılıyor sanki sol tık yapmışım gibi. Düzeltelim."
 *
 * Ölçülen eski hâl (gerçek tarayıcı, Tulga örneği, 1440×900): Çözücü'nün penceresi açıkken
 * Parametrik Analiz'e sağ tık pencereyi Parametrik Analiz'e çeviriyordu. Yol: bileşen menüsü
 * (context-menus.js) seçili olmayan bileşeni seçerken addToSelection → showNodeProperties.
 * Seçim yine menünün konusu olur (işlem seçime uygulanır); pencere kapalıysa kapalı, açıksa
 * konusuyla kalır. Sol tık, Ctrl+tık, çift tık ve menünün Aç'ı eskisi gibi.
 *
 * Gerçek dosya yolu: seçim (cp-core.js), pencere (map.js), menü (context-menus.js) ve
 * bileşenin fare bağlayıcıları (ui-core.js → veAttachNodeDrag · veNodeSagTik). Kayıt turu
 * (Ctrl+S, otomatik yedek) pencereyi konusundan kurar: subtopology-keepview.test.js → *KONU*.
 * Gerçek fare: tests/e2e/bilesen-menusu.spec.js → *SAĞ TIK PENCEREYİ SÜRMEZ*.
 */
global.nodes = [];
global.connections = [];
global.selectedNodes = [];
global.canvasZoom = 1;
global.requestAnimationFrame = (f) => { f(); return 0; };
global.componentDefs = {
  'test-cozucu': { name: 'Çözücü', svg: '<svg></svg>' },
  'test-param': { name: 'Parametrik Analiz', svg: '<svg></svg>' },
  'test-rapor': { name: 'Rapor', svg: '<svg></svg>' },
};

const stubs = stubGlobals({
  updateAllConnections: jest.fn(), veMinimapUpdate: jest.fn(), showAlignmentGuides: jest.fn(),
  checkAlignment: jest.fn(() => ({ snapX: 0, snapY: 0 })),
});
document.body.innerHTML = '<div id="ve-canvas"></div>';
eval(loadSource('ui-core.js'));
eval(loadSource('cp-core.js'));
eval(loadSource('map.js'));
eval(loadSource('context-menus.js'));

function kur() {
  document.body.innerHTML =
    '<div id="ve-properties-overlay" class="ve-properties-overlay" style="display:none;">'
    + '<div class="ve-properties" id="ve-properties"><div class="ve-properties-header">'
    + '<span id="ve-properties-title"></span></div><div class="ve-properties-content"></div></div></div>'
    + '<div id="ve-canvas"></div>';
  const mk = (id, type) => {
    const node = { id, type, x: 0, y: 0, def: componentDefs[type], data: {} };
    const el = document.createElement('div');
    el.className = 've-node';
    el.id = id;
    el.innerHTML = '<div class="ve-node-box"></div><div class="ve-node-label">' + node.def.name + '</div>';
    document.getElementById('ve-canvas').appendChild(el);
    veAttachNodeDrag(el, node);
    veNodeSagTik(el, node);
    return node;
  };
  global.nodes = [mk('C', 'test-cozucu'), mk('P', 'test-param'), mk('R', 'test-rapor')];
  global.selectedNodes = [];
  _veLastPropNodeId = null;
  _veMufettisKart = false;
  _veModalSutundan = false;
  document.documentElement.className = '';
  // Kullanıcının ekranı (1450 px): pencere tuvalin yanında sütun.
  window.matchMedia = (q) => ({ matches: /min-width:\s*1024px/.test(q), media: q });
  return global.nodes;
}
const acik = () => document.getElementById('ve-properties-overlay').classList.contains('visible');
const baslik = () => document.getElementById('ve-properties-title').textContent;
const icerik = () => document.querySelector('.ve-properties-content');
const menu = () => document.getElementById('ve-node-context-menu');
const menuAcik = () => !!menu() && menu().style.display === 'block';
const menuOge = (eylem) => menu().querySelector('[data-action="' + eylem + '"]');

// Tarayıcının sırası: basış, (sağ tuşta) bağlam menüsü olayı, bırakış. Sağ tuş click üretmez.
const fare = (el, tur, o) => el.dispatchEvent(new MouseEvent(tur,
  Object.assign({ bubbles: true, cancelable: true, clientX: 100, clientY: 100, button: 0 }, o || {})));
const sagTik = (n) => {
  const el = document.getElementById(n.id).querySelector('.ve-node-box');
  fare(el, 'mousedown', { button: 2, buttons: 2 });
  fare(el, 'contextmenu', { button: 2 });
  fare(el, 'mouseup', { button: 2 });
};
const solTik = (n, o) => {
  const el = document.getElementById(n.id).querySelector('.ve-node-box');
  fare(el, 'mousedown', o);
  fare(el, 'mouseup', o);
  fare(el, 'click', o);
};
const ciftTik = (n) => { solTik(n); solTik(n); fare(document.getElementById(n.id).querySelector('.ve-node-box'), 'dblclick'); };

beforeEach(() => resetStubs(stubs));

describe('SAĞ TIK yalnız bileşen menüsünü açar (Canlı Not 156)', () => {
  test('pencere kapalıyken: menü açılır, pencere kapalı kalır; menü sağ tıklanana uygulanır', () => {
    const [, P] = kur();
    sagTik(P);
    expect(menuAcik()).toBe(true);
    expect(acik()).toBe(false);
    expect(document.documentElement.classList.contains('ve-mufettis-acik')).toBe(false);
    expect(selectedNodes).toEqual([P]);
    expect(document.getElementById('P').classList.contains('selected')).toBe(true);
  });

  test('Çözücü penceresi açıkken Parametrik Analiz’e sağ tık: pencere Çözücü’de kalır', () => {
    const [C, P] = kur();
    ciftTik(C);
    expect([acik(), baslik()]).toEqual([true, 'Çözücü']);
    sagTik(P);
    expect(menuAcik()).toBe(true);
    expect(acik()).toBe(true);
    expect(baslik()).toBe('Çözücü');
    expect(icerik().querySelector('#ve-node-name-display-C')).not.toBeNull();
    expect(icerik().querySelector('#ve-node-name-display-P')).toBeNull();
    expect(veMufettisKonusu()).toBe(C);
    expect(selectedNodes).toEqual([P]);
    // Esc menüyü kapatır (odaktaki öğeden yayılır); pencere yine Çözücü'de
    document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(menuAcik()).toBe(false);
    expect([acik(), baslik()]).toEqual([true, 'Çözücü']);
  });

  test('pencerenin kendi konusuna sağ tık içeriği yeniden kurmaz', () => {
    const [C] = kur();
    ciftTik(C);
    const once = icerik().firstElementChild;
    clearSelection();                                                  // boşluğa tık: seçim boşalır, pencere kalır
    sagTik(C);
    expect(selectedNodes).toEqual([C]);
    expect(icerik().firstElementChild).toBe(once);
  });

  test('menünün Aç’ı sağ tıklananın penceresini açar — kapalı pencerede', () => {
    const [, P] = kur();
    sagTik(P);
    menuOge('ac').click();
    expect(menuAcik()).toBe(false);
    expect([acik(), baslik()]).toEqual([true, 'Parametrik Analiz']);
    expect(veMufettisKonusu()).toBe(P);
  });

  test('menünün Aç’ı sağ tıklananın penceresini açar — başka bileşenin açık penceresinde', () => {
    const [C, P] = kur();
    ciftTik(C);
    sagTik(P);
    menuOge('ac').click();
    expect([acik(), baslik()]).toEqual([true, 'Parametrik Analiz']);
    expect(veMufettisKonusu()).toBe(P);
  });

  test('sol tık, Ctrl+tık ve çift tık eskisi gibi: sağ tıktan sonra sol tık içeriği değiştirir', () => {
    const [C, P, R] = kur();
    ciftTik(C);
    sagTik(P);
    expect(baslik()).toBe('Çözücü');
    solTik(P);                                                         // açık pencerede tek tık: YERİNDE değişir
    expect([acik(), baslik()]).toEqual([true, 'Parametrik Analiz']);
    solTik(R, { ctrlKey: true });                                      // Ctrl+tık: çoklu seçim
    expect(selectedNodes).toEqual([P, R]);
    expect(icerik().textContent).toContain('2 bileşen seçili');
    clearSelection();
    ciftTik(R);                                                        // çift tık: o bileşen
    expect([acik(), baslik()]).toEqual([true, 'Rapor']);
  });

  test('çoklu seçim: içindekine sağ tık seçimi ve pencereyi korur; dışındakine sağ tık onu göstermez', () => {
    const [C, P, R] = kur();
    ciftTik(C);
    solTik(P, { ctrlKey: true });
    expect(selectedNodes).toEqual([C, P]);
    expect(icerik().textContent).toContain('2 bileşen seçili');
    sagTik(P);
    expect(selectedNodes).toEqual([C, P]);
    expect(icerik().textContent).toContain('2 bileşen seçili');
    expect(menu().querySelector('.ve-context-bas').textContent).toBe('2 bileşen');
    sagTik(R);
    expect(selectedNodes).toEqual([R]);
    expect(baslik()).not.toBe('Rapor');
    expect(icerik().querySelector('#ve-node-name-display-R')).toBeNull();
    expect(icerik().textContent).not.toContain('Seçilenleri sil');     // eski seçimin işlemi kalmaz
  });
});
