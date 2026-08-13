/**
 * module-start-center.test.js — karşılama kartı → modül bloğu TAM ORTAYA düşer
 *
 * KULLANICI ŞİKÂYETİ (2026-08-13): "Araç Performans'ı seçince ana topoloji
 * sembolü tam ortaya gelmiyor, böyle bir kenara geliyor."
 *
 * KÖK NEDEN (tarayıcıda ölçüldü: sapma tam +142px = sidebar+ray'ın YARISI):
 * Sol Bileşenler paneli (220px) ve sayfa rayı (64px) karşılama ekranındayken
 * `.ve-main.ve-no-module` ile gizli. Bu sınıfı bir MutationObserver kaldırıyor —
 * gözlemci geri çağrısı ise SENKRON turun SONUNDA çalışıyor. veStartModule ise
 * overlay'ı gizledikten HEMEN sonra, aynı turda, kanvası ölçüp hem kamerayı
 * (veCameraHome) hem de bloğun konumunu hesaplıyordu. O anda kanvas hâlâ
 * 284px fazla geniş görünüyor → her ikisi de 284/2 = 142px sağa kayıyordu.
 *
 * Düzeltme: veSyncModuleShell() dışarıdan çağrılabilir hâle geldi ve
 * veStartModule ölçümden ÖNCE onu senkron çağırıyor.
 *
 * Bu test tarayıcının davranışını birebir taklit eder: kanvasın ölçüsü
 * `.ve-no-module` sınıfına BAĞLI bir getter'dır. Düzeltme olmadan kırmızıdır.
 */

const fs = require('fs');
const path = require('path');

const FULL_W = 1920;     // pencere genişliği
const SHELL_W = 284;     // sayfa rayı (64) + Bileşenler paneli (220)
const VIEW_H = 935;      // şerit + alt bant düşülmüş kanvas yüksekliği

function src(file) {
  return fs.readFileSync(path.join(__dirname, '../../js/', file), 'utf8');
}

// Karşılama ekranı açıkken kanvas TÜM genişliği kaplar; modül seçilince
// (.ve-no-module kalkınca) panel+ray yerini alır ve kanvas daralır.
function visibleWidth() {
  var main = document.querySelector('.ve-main');
  return (main && main.classList.contains('ve-no-module')) ? FULL_W : FULL_W - SHELL_W;
}

function setupDOM() {
  document.body.innerHTML =
    '<div id="sayfa2-content">' +
    '  <div class="ve-main">' +
    '    <div class="ve-sidebar"></div>' +
    '    <div class="ve-canvas-wrapper" id="ve-canvas-wrapper"></div>' +
    '    <div class="ve-module-overlay" id="ve-module-overlay"></div>' +
    '  </div>' +
    '</div>';

  var wrap = document.getElementById('ve-canvas-wrapper');
  Object.defineProperty(wrap, 'clientWidth', { configurable: true, get: visibleWidth });
  Object.defineProperty(wrap, 'clientHeight', { configurable: true, get: function () { return VIEW_H; } });
  wrap.getBoundingClientRect = function () {
    var w = visibleWidth();
    return { width: w, height: VIEW_H, left: FULL_W - w, top: 0, right: FULL_W, bottom: VIEW_H };
  };
  return wrap;
}

function resetGlobals() {
  global.nodes = [];
  global.connections = [];
  global.compCounter = 0;
  global.canvasZoom = 1;
  global.canvasOffset = { x: 3000, y: 3000 };
  global.updateCanvasTransform = jest.fn();
  global.showToast = jest.fn();
  global.createNode = jest.fn(function (type, x, y) {
    // componentDefs eval ile MODÜL kapsamına giriyor (global'e değil) — bkz. altta.
    var def = componentDefs[type] || {};
    global.compCounter++;
    var n = { id: 'comp-' + global.compCounter, type: type, x: x, y: y,
              width: def.defaultWidth || 65, height: def.defaultHeight || 60, data: {} };
    global.nodes.push(n);
    return n;
  });
}

setupDOM();
resetGlobals();
eval(src('canvas-space.js'));
eval(src('components.js'));

// Kanvas koordinatındaki bir noktanın görünüm (wrapper) içindeki x'i.
//   ekran = (yerel - 3000) * zoom + offset      (bkz. js/canvas-space.js)
function screenX(localX) {
  return (localX - 3000) * canvasZoom + canvasOffset.x;
}
function screenY(localY) {
  return (localY - 3000) * canvasZoom + canvasOffset.y;
}

describe('Karşılama kartı → modül bloğu görünümün tam ortasına düşer', () => {
  let wrap;

  beforeEach(() => {
    wrap = setupDOM();
    resetGlobals();
    // Karşılama ekranı açık: overlay görünür → kabuk gizli.
    document.getElementById('ve-module-overlay').style.display = '';
    veSyncModuleShell();
    expect(document.querySelector('.ve-main').classList.contains('ve-no-module')).toBe(true);
    expect(wrap.clientWidth).toBe(FULL_W);
  });

  test('kart tıklanınca panel+ray AYNI turda gelir (gözlemciyi beklemez)', () => {
    veStartModule('arac-performans');
    // MutationObserver'a hiç sıra gelmeden (senkron) sınıf kalkmış olmalı.
    expect(document.querySelector('.ve-main').classList.contains('ve-no-module')).toBe(false);
    expect(wrap.clientWidth).toBe(FULL_W - SHELL_W);
  });

  test('blok yatayda ve dikeyde ortalanır (eski kodda 142px sağdaydı)', () => {
    veStartModule('arac-performans');

    expect(nodes.length).toBe(1);
    const n = nodes[0];
    expect(n.type).toBe('arac-performans');

    const W = FULL_W - SHELL_W;
    expect(Math.abs(screenX(n.x + n.width / 2) - W / 2)).toBeLessThanOrEqual(1);
    expect(Math.abs(screenY(n.y + n.height / 2) - VIEW_H / 2)).toBeLessThanOrEqual(1);
  });

  test('kamera "ev" konumu da daralmış kanvasa göre kurulur', () => {
    veStartModule('arac-performans');
    const W = FULL_W - SHELL_W;
    expect(canvasOffset.x).toBe(Math.round(W / 2));       // eskiden 960 (=1920/2)
    expect(canvasOffset.y).toBe(Math.round(VIEW_H / 2));
    expect(canvasZoom).toBe(1);
  });

  test('Takoz kartı da aynı yoldan geçer', () => {
    veStartModule('mount-analysis');
    expect(nodes.length).toBe(1);
    expect(nodes[0].type).toBe('mount-analysis');
    const W = FULL_W - SHELL_W;
    expect(Math.abs(screenX(nodes[0].x + nodes[0].width / 2) - W / 2)).toBeLessThanOrEqual(1);
  });

  test('veSyncModuleShell idempotent — iki kez çağrılınca durum değişmez', () => {
    veStartModule('arac-performans');
    const before = document.querySelector('.ve-main').className;
    veSyncModuleShell();
    veSyncModuleShell();
    expect(document.querySelector('.ve-main').className).toBe(before);
  });
});
