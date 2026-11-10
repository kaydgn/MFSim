/**
 * tek-tik-arac.test.js — TEK TIKLA AÇILAN ARAÇ (kullanım notu T20, 2026-11-03)
 * ─────────────────────────────────────────────────────────────────────────
 * Ölçülen: pencere sütunu kapalıyken tuvaldeki 3D Görüntüleyici'ye tek tık
 * yalnız seçim kulpu gösteriyordu; penceresi ancak çift tıkla açılıyordu
 * ("tıklamanın bir şey yapmadığı izlenimi"). Aracın işi penceresidir:
 * `componentDefs.tekTik` beyan eden tip (Takoz'un araç şeridi) sürüklemesiz
 * tek tıkta pencereyi açar. Öteki bileşenlerde tek tık yalnız seçer —
 * pencere çift tıkla (kullanıcı kararı 2026-10-16). Sürükleme, Ctrl ile
 * çoklu seçim ve çoklu seçim pencere açmaz.
 *
 * EYLEM ARACI (kullanıcı 2026-11-10, Canlı Not 110): Başlangıç Sihirbazı bileşeninin işi
 * bir pencere değil bir eylemdir — `componentDefs.eylem` beyan eder; tek tık (ve çift tık)
 * eylemi çalıştırır, özellikler penceresi açılmaz.
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

describe('TEK TIK — araç penceresini açar, bileşen yalnız seçer', () => {
  test('Takoz araç şeridinin yedi tipi tekTik beyan eder; kütle gövdesi ve takoz etmez', () => {
    expect(HEPSI.filter((t) => componentDefs[t].tekTik)).toEqual(HEPSI);
    expect(Object.keys(componentDefs).filter((t) => componentDefs[t].tekTik).sort()).toEqual(HEPSI.slice().sort());
    ['mnt-motor', 'mnt-mount', 'engine', 'fead-layout'].forEach((t) => expect(!!componentDefs[t].tekTik).toBe(false));
  });

  test.each(ARACLAR)('%s: sürüklemesiz tek tık pencereyi açar', (t) => {
    const { el } = kur(t);
    tikla(el);
    expect(stubs.veTogglePropertiesPanel).toHaveBeenCalledWith(true);
  });

  test('sürükleme · Ctrl · çoklu seçim pencere açmaz; kütle gövdesi tek tıkta yalnız seçilir', () => {
    const v = kur('mnt-viewer');
    tikla(v.el, {}, 30);                                         // sürükleme
    tikla(v.el, { ctrlKey: true });                              // çoklu seçimin Ctrl'ü
    global.selectedNodes = [kur('mnt-motor').node];
    tikla(v.el, { ctrlKey: false, shiftKey: true });             // Shift
    const m = kur('mnt-motor');
    global.selectedNodes = [];
    tikla(m.el);
    expect(stubs.veTogglePropertiesPanel).not.toHaveBeenCalled();
    expect(global.selectedNodes).toEqual([m.node]);
  });
});

describe('EYLEM ARACI — tek tık ve çift tık eylemi çalıştırır, pencere açmaz', () => {
  beforeEach(() => { window.veMntWizAc = jest.fn(); });
  afterEach(() => { delete window.veMntWizAc; });
  const cift = (el) => el.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, clientX: 100, clientY: 100, button: 0 }));

  test('beyan: yalnız Başlangıç Sihirbazı eylem taşır, eylem global işlevin adıdır', () => {
    expect(Object.keys(componentDefs).filter((t) => componentDefs[t].eylem)).toEqual(EYLEMLER);
    expect(componentDefs['mnt-wizard'].eylem).toBe('veMntWizAc');
    expect(componentDefs['mnt-wizard'].isMountWizard).toBe(true);
    expect(componentDefs['mnt-wizard'].maxInstances).toBe(1);
    // Kalkan "Başlangıç ve Örnekler" bileşeni tipte de yok (Canlı Not 110)
    expect(componentDefs['mnt-example']).toBeUndefined();
  });

  test('sürüklemesiz tek tık sihirbazı açar, özellikler penceresini AÇMAZ', () => {
    const { el } = kur('mnt-wizard');
    tikla(el);
    expect(window.veMntWizAc).toHaveBeenCalledTimes(1);
    expect(stubs.veTogglePropertiesPanel).not.toHaveBeenCalled();
  });

  test('çift tık da sihirbazı açar, pencereyi açmaz', () => {
    const { el } = kur('mnt-wizard');
    cift(el);
    expect(window.veMntWizAc).toHaveBeenCalledTimes(1);
    expect(stubs.veTogglePropertiesPanel).not.toHaveBeenCalled();
  });

  test('sürükleme · Ctrl · Shift eylemi çalıştırmaz', () => {
    const w = kur('mnt-wizard');
    tikla(w.el, {}, 30);
    tikla(w.el, { ctrlKey: true });
    tikla(w.el, { shiftKey: true });
    expect(window.veMntWizAc).not.toHaveBeenCalled();
  });

  test('eylem işlevi yüklü değilse tık sessizce yutulur, pencere yine açılmaz', () => {
    delete window.veMntWizAc;
    const { el } = kur('mnt-wizard');
    expect(() => tikla(el)).not.toThrow();
    expect(stubs.veTogglePropertiesPanel).not.toHaveBeenCalled();
  });

  test('pencere açan araç eski yolda: tek tık pencereyi açar, eylem çalışmaz', () => {
    const { el } = kur('mnt-solver');
    tikla(el);
    expect(stubs.veTogglePropertiesPanel).toHaveBeenCalledWith(true);
    expect(window.veMntWizAc).not.toHaveBeenCalled();
  });
});
