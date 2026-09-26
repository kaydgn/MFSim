/**
 * minimap-ortmez.test.js — MİNİMAP İÇERİĞİ ÖRTMEZ (js/minimap.js)
 * ───────────────────────────────────────────────────────────────────────────
 * Açık kutu bir kartın, adının ya da notun üstüne düşecekse minimap köşedeki
 * düğmesine iner ("oto"); köşe boşalınca kendiliğinden açılır. Soluk durmak
 * (opacity) yetmiyordu: soluk kutu tıklamayı yine yutuyor.
 *
 * Kurallar:
 *   · ölçü AÇIK hâlin kutusuyla (--mm-w/--mm-h), o anki kutuyla DEĞİL — yoksa
 *     inen kutu artık değmez, açılır, yine değer: titrer
 *   · oto iniş kullanıcının tercihini YAZMAZ (localStorage)
 *   · oto inmişken düğmeye basmak bir istektir: köşe boşalana kadar açık kalır
 *   · kullanıcının kendi indirdiği kutu köşe boş da olsa inik kalır
 *   · haritayı sürüklerken durum değişmez (kutu elden kaçmasın)
 *   · inmiş kutu da denetlenir (tuvali display:none → boyut kapısının ÖNÜNDE)
 *   · tuval pencere boyu değişmeden daralır (müfettiş sütunu): gözlemci şart
 *
 * Gerçek tarayıcıdaki karşılığı: tests/e2e/minimap-ortmez.spec.js.
 */
const cs = require('../../js/canvas-space.js');

stubGlobals();
global.veNodeLabelOverflow = cs.veNodeLabelOverflow;
global.componentDefs = {
  kutusuz: { noCanvasBox: true },
  modul: { isSubsystem: true },
};
global.veIsCanvasHidden = (n) => !!(componentDefs[n.type] || {}).noCanvasBox;
global.veIsModuleNode = (n) => !!(componentDefs[n.type] || {}).isSubsystem;
global.veNodeDefaultSize = () => ({ w: 65, h: 60 });
global.nodes = [];
global.connections = [];
global.annotations = [];
global.canvasZoom = 1;
global.canvasOffset = { x: 0, y: 0 };

// Gözlemci: tarayıcıdaki gibi hedefi ve geri çağrıyı tut.
const gozlenen = [];
global.ResizeObserver = class {
  constructor(cb) { this.cb = cb; }
  observe(el) { gozlenen.push({ el, cb: this.cb }); }
};

eval(loadSource('minimap.js'));

// ── Görünüm: 1000×600 kap, kutu sağ-alt köşeye çapalı (sağ 14, alt 14) ──────
// jsdom yerleşim hesaplamaz; ölçüleri CSS'in söylediği gibi sınıfa bağlı kur.
const W = 1000, H = 600;
function sahneKur() {
  document.body.innerHTML =
    '<div id="ve-canvas-wrapper"><div id="ve-canvas"></div>' +
    '<div class="ve-minimap" id="ve-minimap" style="--mm-w:196px;--mm-h:134px">' +
    '<canvas id="ve-minimap-canvas"></canvas><div id="ve-minimap-viewport"></div>' +
    '<button id="ve-minimap-toggle" type="button"></button></div></div>';
  const wr = document.getElementById('ve-canvas-wrapper');
  Object.defineProperty(wr, 'clientWidth', { get: () => W, configurable: true });
  Object.defineProperty(wr, 'clientHeight', { get: () => H, configurable: true });
  const el = document.getElementById('ve-minimap');
  const olcu = () => (el.classList.contains('collapsed') ? [34, 34] : [196, 134]);
  Object.defineProperty(el, 'offsetParent', { get: () => wr, configurable: true });
  Object.defineProperty(el, 'offsetWidth', { get: () => olcu()[0], configurable: true });
  Object.defineProperty(el, 'offsetHeight', { get: () => olcu()[1], configurable: true });
  Object.defineProperty(el, 'offsetLeft', { get: () => W - 14 - olcu()[0], configurable: true });
  Object.defineProperty(el, 'offsetTop', { get: () => H - 14 - olcu()[1], configurable: true });
  return el;
}
// Görünüm koordinatında bir kart (kamera: zoom 1, ofset 0 → ekran = yerel − 3000).
const kart = (l, t, w, h, tip) => ({ id: 'n' + l + '_' + t, type: tip || 'kart', x: 3000 + l, y: 3000 + t, width: w, height: h });
// Açık kutu: [790..986]×[452..586]; inmiş düğme: [952..986]×[552..586].
const ALTINDA = () => kart(800, 460, 100, 80);           // açık kutuya değer, düğmeye değmez
const UZAKTA = () => kart(100, 100, 100, 80);

let el;
beforeEach(() => {
  try { localStorage.clear(); } catch (e) {}
  _mmCollapsed = false; _mmOto = false; _mmZorla = false; _mmDragging = false;
  global.nodes = [UZAKTA()];
  global.annotations = [];
  el = sahneKur();
});

describe('saf hesap', () => {
  const kutu = { l: 790, t: 452, r: 986, b: 586 };

  test('kamera çevirisi: ekran = (yerel − 3000)·zoom + ofset, parça PAY kadar büyür', () => {
    const p = veMinimapIcerikParcalari([{ id: 'a', type: 'kart', x: 3000, y: 3000, width: 100, height: 50 }], [],
      { zoom: 0.5, x: 200, y: 100 });
    expect(p).toEqual([{ l: 200 - VE_MINIMAP_PAY, t: 100 - VE_MINIMAP_PAY, r: 250 + VE_MINIMAP_PAY, b: 125 + VE_MINIMAP_PAY }]);
  });

  test('kutusuz düğüm (FEAD kasnağı) sayılmaz; modül kartının adı taşmaz', () => {
    const olc = () => ({ w: 300, h: 14 });
    const p = veMinimapIcerikParcalari([
      { id: 'k', type: 'kutusuz', x: 3800, y: 3460, width: 100, height: 80 },
      { id: 'm', type: 'modul', x: 3000, y: 3000, width: 100, height: 80 },
    ], [], { zoom: 1, x: 0, y: 0 }, olc);
    expect(p).toHaveLength(1);
    expect(p[0].r - p[0].l).toBe(100 + 2 * VE_MINIMAP_PAY);
  });

  test('ad kutunun dışına taşıyorsa parça onu da sarar (sınır çerçevesiyle aynı kural)', () => {
    const olc = () => ({ w: 160, h: 14 });
    const [p] = veMinimapIcerikParcalari([{ id: 'a', type: 'kart', x: 3000, y: 3000, width: 100, height: 60 }], [],
      { zoom: 1, x: 0, y: 0 }, olc);
    expect(p.b).toBe(60 + cs.VE_LABEL_GAP_V + 14 + VE_MINIMAP_PAY);
    expect(p.l).toBe(-30 - VE_MINIMAP_PAY);
    expect(p.r).toBe(130 + VE_MINIMAP_PAY);
  });

  test('içeriğe değen kutu örter, PAY kadar yaklaşan da; uzaktaki örtmez', () => {
    const p = veMinimapIcerikParcalari([kart(700, 300, 88, 150)], [], { zoom: 1, x: 0, y: 0 });
    expect(veMinimapOrtuyor(kutu, p)).toBe(true);                       // 788+6 > 790
    const u = veMinimapIcerikParcalari([kart(600, 300, 80, 100)], [], { zoom: 1, x: 0, y: 0 });
    expect(veMinimapOrtuyor(kutu, u)).toBe(false);
  });

  test('çerçeve notu HALKADIR: kutu boş içine düşebilir, kenarına düşemez', () => {
    const ic = [{ id: 'f', type: 'frame', x: 3700, y: 3350, width: 400, height: 300 }];
    expect(veMinimapOrtuyor(kutu, veMinimapIcerikParcalari([], ic, { zoom: 1, x: 0, y: 0 }))).toBe(false);
    const kenar = [{ id: 'f', type: 'frame', x: 3700, y: 3350, width: 250, height: 300 }];   // sağ kenar 950'de
    expect(veMinimapOrtuyor(kutu, veMinimapIcerikParcalari([], kenar, { zoom: 1, x: 0, y: 0 }))).toBe(true);
  });

  test('yazı notunun genişliği metinden ölçülür', () => {
    const not = [{ id: 't', type: 'text', x: 3700, y: 3470, width: 50, height: 20 }];
    expect(veMinimapOrtuyor(kutu, veMinimapIcerikParcalari([], not, { zoom: 1, x: 0, y: 0 }))).toBe(false);
    const olcNot = () => ({ w: 140, h: 20 });
    expect(veMinimapOrtuyor(kutu, veMinimapIcerikParcalari([], not, { zoom: 1, x: 0, y: 0 }, null, olcNot))).toBe(true);
  });
});

describe('oto iniş', () => {
  test('içerik altına düşünce iner, köşe boşalınca açılır', () => {
    global.nodes = [ALTINDA()];
    _mmOtoDenetle(el);
    expect(el.classList.contains('collapsed')).toBe(true);
    expect(el.classList.contains('oto')).toBe(true);
    global.nodes = [UZAKTA()];
    _mmOtoDenetle(el);
    expect(el.classList.contains('collapsed')).toBe(false);
    expect(el.classList.contains('oto')).toBe(false);
  });

  test('ölçü AÇIK hâlin kutusuyla: inmiş kutu tekrar denetlenince açılmaz (titremez)', () => {
    global.nodes = [ALTINDA()];
    // Titreme her denetimde durumu ÇEVİRİR: tek sayıda denetimden sonra
    // bakmak onu görmez, her birinden sonra bakılır.
    const durum = [];
    for (let i = 0; i < 4; i++) { _mmOtoDenetle(el); durum.push(el.classList.contains('collapsed')); }
    expect(durum).toEqual([true, true, true, true]);
  });

  test('oto iniş kullanıcının tercihini YAZMAZ', () => {
    global.nodes = [ALTINDA()];
    _mmOtoDenetle(el);
    expect(localStorage.getItem('veMinimapCollapsed')).toBeNull();
  });

  test('inmiş kutu çizim döngüsünde de denetlenir (boyut kapısının önünde)', () => {
    global.nodes = [ALTINDA()];
    _mmRender();
    expect(el.classList.contains('collapsed')).toBe(true);
    global.nodes = [UZAKTA()];
    _mmRender();                            // tuvali 0 px: boyut kapısı burada döner
    expect(el.classList.contains('collapsed')).toBe(false);
  });

  test('haritayı sürüklerken durum değişmez', () => {
    _mmDragging = true;
    global.nodes = [ALTINDA()];
    _mmOtoDenetle(el);
    expect(el.classList.contains('collapsed')).toBe(false);
  });
});

describe('kullanıcının seçimi', () => {
  test('oto inmişken düğme açar ve köşe boşalana dek açık tutar; sonra oto yine çalışır', () => {
    global.nodes = [ALTINDA()];
    _mmOtoDenetle(el);
    veMinimapToggle();
    expect(el.classList.contains('collapsed')).toBe(false);
    expect(localStorage.getItem('veMinimapCollapsed')).toBe('0');
    _mmOtoDenetle(el);                      // içerik hâlâ altında: istek geçerli
    expect(el.classList.contains('collapsed')).toBe(false);
    global.nodes = [UZAKTA()];
    _mmOtoDenetle(el);                      // köşe boşaldı: istek yerine geldi
    global.nodes = [ALTINDA()];
    _mmOtoDenetle(el);
    expect(el.classList.contains('collapsed')).toBe(true);
  });

  test('kullanıcının indirdiği kutu köşe boşken de inik kalır ve tercih yazılır', () => {
    veMinimapToggle();
    expect(localStorage.getItem('veMinimapCollapsed')).toBe('1');
    _mmOtoDenetle(el);
    expect(el.classList.contains('collapsed')).toBe(true);
    expect(el.classList.contains('oto')).toBe(false);
  });

  test('açılışta kayıtlı tercih okunur', () => {
    localStorage.setItem('veMinimapCollapsed', '1');
    veMinimapInit();
    expect(_mmCollapsed).toBe(true);
    expect(el.classList.contains('collapsed')).toBe(true);
  });

  test('düğmenin adı oto inişi söyler', () => {
    global.nodes = [ALTINDA()];
    _mmOtoDenetle(el);
    expect(document.getElementById('ve-minimap-toggle').title).toMatch(/örtmesin/);
  });
});

describe('tuval pencere boyu değişmeden daralır', () => {
  test('açılışta tuvalin kabı gözlenir ve gözlemci denetimi yeniden koşar', async () => {
    gozlenen.length = 0;
    veMinimapInit();
    const g = gozlenen.find((x) => x.el === document.getElementById('ve-canvas-wrapper'));
    expect(g).toBeTruthy();
    global.nodes = [ALTINDA()];
    g.cb();
    await new Promise((r) => setTimeout(r, 40));
    expect(el.classList.contains('collapsed')).toBe(true);
  });
});
