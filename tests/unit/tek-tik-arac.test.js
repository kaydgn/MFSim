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

const ARACLAR = ['mnt-library', 'mnt-solver', 'mnt-example', 'mnt-viewer', 'mnt-coordframe', 'mnt-2dview', 'mnt-report', 'mnt-parametric'];
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
  test('Takoz araç şeridinin sekiz tipi tekTik beyan eder; kütle gövdesi ve takoz etmez', () => {
    expect(ARACLAR.filter((t) => componentDefs[t].tekTik)).toEqual(ARACLAR);
    expect(Object.keys(componentDefs).filter((t) => componentDefs[t].tekTik).sort()).toEqual(ARACLAR.slice().sort());
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
