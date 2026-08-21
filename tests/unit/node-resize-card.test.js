/**
 * node-resize-card.test.js — ÖLÇÜYE GÖRE ÇİZİLEN KART, BOYUTLANDIRMADAN SONRA
 *
 * Kayış Yolu kartı bir SVG ve viewBox'ı düğümün ölçüsünden üretiliyor. Yeniden
 * boyutlandırma yalnız DOM kutusunu büyütüp küçültüyor; kart yeniden
 * çizilmezse yeni kutuya ESKİ çizim ölçeklenerek oturuyor — en-boy oranı
 * değiştiyse boş bantlar ve orantısız yazılar, ve bu hâl kullanıcı başka bir
 * alana dokunup saveState'i tetikleyene kadar sürüyor.
 *
 * ÖLÇÜLDÜ (gerçek tarayıcı): düğüm 300×300'e indirildiğinde kartın kutusu
 * 418×338 kalıyordu, yani çizim hiç yeniden ölçeklenmiyordu.
 *
 * Burada test edilen şey KABLOLAMA: boyutlandırma bitince tazeleyici çağrılıyor
 * mu, ve yığına ikinci bir geri-al adımı KONMUYOR mu.
 */
const stubs = stubGlobals({
  showAlignmentGuides: jest.fn(),
  updateAllConnections: jest.fn(),
  veFeadRefreshLayoutCards: jest.fn(),
});
global.canvasZoom = 1;
global.nodes = [];
document.body.innerHTML = '<div id="ve-canvas"></div>';
eval(loadSource('node-resize.js'));

beforeEach(() => {
  resetStubs(stubs);
  stopResize();                       // önceki testten kalan durum sızmasın
  resetStubs(stubs);
  document.body.innerHTML = '<div id="ve-canvas"></div>'
    + '<div id="n1" style="left:0px; top:0px; width:420px;">'
    + '<div class="ve-node-box" style="width:420px; height:340px;"></div></div>';
});

const dugum = () => {
  const n = { id: 'n1', x: 0, y: 0, width: 420, height: 340 };
  global.nodes = [n];
  return n;
};

test('boyutlandırma bitince ölçüye bağlı kartlar tazelenir', () => {
  const n = dugum();
  startResize({ clientX: 100, clientY: 100, stopPropagation() {}, preventDefault() {} }, n, 'se');
  doResize({ clientX: -20, clientY: -20 });
  expect(n.width).toBe(300);                        // 420 − 120
  expect(stubs.veFeadRefreshLayoutCards).not.toHaveBeenCalled();   // sürüklerken değil
  stopResize();
  expect(stubs.veFeadRefreshLayoutCards).toHaveBeenCalledTimes(1); // bırakınca
});

test('yığına yalnız ÖN durum konur (tek geri-al adımı)', () => {
  const n = dugum();
  startResize({ clientX: 100, clientY: 100, stopPropagation() {}, preventDefault() {} }, n, 'se');
  doResize({ clientX: 150, clientY: 150 });
  stopResize();
  expect(stubs.saveState).toHaveBeenCalledTimes(1);
});

test('boyutlandırma başlamamışsa bırakma tazeleme çağırmaz', () => {
  stopResize();
  expect(stubs.veFeadRefreshLayoutCards).not.toHaveBeenCalled();
});
