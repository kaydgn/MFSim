/**
 * tek-tik-arac.test.js — TEK TIK SEÇER, ÇİFT TIK AÇAR (kullanıcı 2026-11-10, Canlı Not 116)
 * ─────────────────────────────────────────────────────────────────────────
 * Kullanıcı: "Başlangıç sihirbazı gibi pop-up olarak açılan bileşenlere iki kere
 * tıklamak durumunda kalalım. Tek tıkla açılınca garip duruyor." Takoz'un araç şeridi
 * (Takoz Özellikleri · Çözücü · 3D Görüntüleyici · Görünümler · Rapor · Parametrik
 * Analiz) tek tıkta penceresini (kullanım notu T20, `componentDefs.tekTik`), Başlangıç
 * Sihirbazı sihirbazı açıyordu (Canlı Not 110). Artık her bileşende tek tık yalnız
 * seçer; çift tık penceresini ya da eylemini açar.
 *
 * EYLEM ARACI (Canlı Not 110): Başlangıç Sihirbazı bileşeninin işi bir pencere değil bir
 * eylemdir — `componentDefs.eylem` beyan eder; çift tık eylemi çalıştırır, özellikler
 * penceresi açılmaz.
 */
const stubs = stubGlobals({
  updateAllConnections: jest.fn(), veMinimapUpdate: jest.fn(), saveState: jest.fn(),
  showAlignmentGuides: jest.fn(), checkAlignment: jest.fn(() => ({ snapX: 0, snapY: 0 })),
  veTogglePropertiesPanel: jest.fn(),
});
global.nodes = [];
global.connections = [];
global.canvasZoom = 1;
global.selectedNodes = [];
global.clearSelection = jest.fn(() => { global.selectedNodes = []; });
global.addToSelection = jest.fn((n) => { if (global.selectedNodes.indexOf(n) < 0) global.selectedNodes.push(n); });
document.body.innerHTML = '<div id="ve-canvas"></div>';
eval(loadSource('ui-core.js'));
eval(loadSource('components.js'));
global.componentDefs = componentDefs;

const ARACLAR = ['mnt-library', 'mnt-solver', 'mnt-viewer', 'mnt-2dview', 'mnt-report', 'mnt-parametric'];   // pencere açar
const EYLEMLER = ['mnt-wizard'];                                                                              // eylem çalıştırır
const HEPSI = ARACLAR.concat(EYLEMLER);
const kur = (type) => {
  const el = document.createElement('div');
  el.id = 'n-' + type + Math.random();
  document.getElementById('ve-canvas').appendChild(el);
  const node = { id: el.id, type, x: 0, y: 0, def: componentDefs[type] };
  veAttachNodeDrag(el, node);
  return { el, node };
};
const fare = (el, tur, x, y, o = {}) => el.dispatchEvent(new MouseEvent(tur, Object.assign({ bubbles: true, clientX: x, clientY: y, button: 0 }, o)));
const tikla = (el, o = {}, kay = 0) => {
  fare(el, 'mousedown', 100, 100, o);
  if (kay) fare(document, 'mousemove', 100 + kay, 100, o);
  fare(document, 'mouseup', 100 + kay, 100, o);
};
beforeEach(() => { resetStubs(stubs); global.selectedNodes = []; });

const cift = (el) => el.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, clientX: 100, clientY: 100, button: 0 }));

describe('ÇİFT TIK — tek tık seçer, çift tık açar (Canlı Not 116)', () => {
  beforeEach(() => { window.veMntWizAc = jest.fn(); });
  afterEach(() => { delete window.veMntWizAc; });

  test('hiçbir tip tek tıkta açmayı beyan etmez; tek tık açıcısı yok', () => {
    expect(Object.keys(componentDefs).filter((t) => componentDefs[t].tekTik)).toEqual([]);
    expect(typeof veTekTikAcar).toBe('undefined');
  });

  test.each(HEPSI)('%s: sürüklemesiz tek tık yalnız seçer — pencere de eylem de açılmaz', (t) => {
    const { el, node } = kur(t);
    tikla(el);
    expect(stubs.veTogglePropertiesPanel).not.toHaveBeenCalled();
    expect(window.veMntWizAc).not.toHaveBeenCalled();
    expect(global.selectedNodes).toEqual([node]);
  });

  test.each(ARACLAR)('%s: çift tık penceresini açar', (t) => {
    const { el } = kur(t);
    cift(el);
    expect(stubs.veTogglePropertiesPanel).toHaveBeenCalledWith(true);
    expect(window.veMntWizAc).not.toHaveBeenCalled();
  });

  test('kütle gövdesi ve takoz da aynı: tek tık seçer, çift tık açar', () => {
    ['mnt-motor', 'mnt-mount'].forEach((t) => {
      const { el, node } = kur(t);
      global.selectedNodes = [];
      tikla(el);
      expect(global.selectedNodes).toEqual([node]);
    });
    expect(stubs.veTogglePropertiesPanel).not.toHaveBeenCalled();
    cift(kur('mnt-motor').el);
    expect(stubs.veTogglePropertiesPanel).toHaveBeenCalledWith(true);
  });
});

describe('EYLEM ARACI — çift tık eylemi çalıştırır, pencere açmaz', () => {
  beforeEach(() => { window.veMntWizAc = jest.fn(); });
  afterEach(() => { delete window.veMntWizAc; });

  test('beyan: yalnız Başlangıç Sihirbazı eylem taşır, eylem global işlevin adıdır', () => {
    expect(Object.keys(componentDefs).filter((t) => componentDefs[t].eylem)).toEqual(EYLEMLER);
    expect(componentDefs['mnt-wizard'].eylem).toBe('veMntWizAc');
    expect(componentDefs['mnt-wizard'].isMountWizard).toBe(true);
    expect(componentDefs['mnt-wizard'].maxInstances).toBe(1);
    // Kalkan "Başlangıç ve Örnekler" bileşeni tipte de yok (Canlı Not 110)
    expect(componentDefs['mnt-example']).toBeUndefined();
  });

  test('çift tık sihirbazı açar, özellikler penceresini AÇMAZ', () => {
    const { el } = kur('mnt-wizard');
    cift(el);
    expect(window.veMntWizAc).toHaveBeenCalledTimes(1);
    expect(stubs.veTogglePropertiesPanel).not.toHaveBeenCalled();
  });

  test('eylem işlevi yüklü değilse çift tık sessizce yutulur, pencere yine açılmaz', () => {
    delete window.veMntWizAc;
    const { el } = kur('mnt-wizard');
    expect(() => cift(el)).not.toThrow();
    expect(stubs.veTogglePropertiesPanel).not.toHaveBeenCalled();
  });
});
