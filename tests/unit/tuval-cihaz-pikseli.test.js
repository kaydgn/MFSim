/**
 * tuval-cihaz-pikseli.test.js — ÇİZİLEN KAMERA CİHAZ PİKSELİNE OTURUR
 * ─────────────────────────────────────────────────────────────────────────
 * `updateCanvasTransform` kameranın ofsetini CSS'e olduğu gibi yazıyordu. Ofset
 * kesirli olunca (örnek yüklenince 765,5 px; %100'e dönüşte hemen her zaman)
 * 1× ekranda tuvaldeki her kutu kenarı, tel ve ikon İKİ piksele yayılıyordu —
 * kullanıcının "bulanıklık" dediği şeyin bir ayağı.
 *
 * Ölçü (gerçek Chromium, 1920×1080, Araç Performans örneği, düğümlerin
 * kutusunda Laplace varyansı): 2081 → 2345, yani yarım piksel içeriği %11
 * yumuşatıyordu. 1,25× ve 1,5×'te fark ölçülemedi (±%4 gürültü) — kural orada
 * zararsız, kazancı 1×'te.
 *
 * Sözleşme üç parça:
 *   1) ÇİZİM yuvarlanır: çeviri × dpr bir tam sayı.
 *   2) DURUM yuvarlanmaz: pan/tekerlek adımları canvasOffset'in üstüne
 *      birikiyor; her adımda yuvarlamak kamerayı kaydırırdı.
 *   3) Izgara İÇERİKLE aynı kamerayı izler (yoksa çizgileri yarım piksel kayar).
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
eval(loadSource('canvas-space.js'));
eval(loadSource('ui-core.js'));

const tuval = () => document.getElementById('ve-canvas');
const ceviri = () => {
  const m = /translate\(([-\d.e]+)px, ([-\d.e]+)px\) scale\(([-\d.e]+)\)/.exec(tuval().style.transform);
  if (!m) throw new Error('beklenmeyen dönüşüm: ' + tuval().style.transform);
  return { x: +m[1], y: +m[2], z: +m[3] };
};
const tamSayiMi = (v) => Math.abs(v - Math.round(v)) < 1e-9;
const dprYaz = (d) => Object.defineProperty(window, 'devicePixelRatio', { configurable: true, value: d });

afterEach(() => { dprYaz(1); canvasZoom = 1; canvasOffset.x = 0; canvasOffset.y = 0; });

describe('saf çekirdek — veCameraDrawOffset', () => {
  test('1× ekranda yarım piksel tam piksele yuvarlanır', () => {
    expect(veCameraDrawOffset({ x: 765.5, y: 464.25 }, 1)).toEqual({ x: 766, y: 464 });
  });

  test.each([1, 1.25, 1.5, 1.75, 2])('%s× ekranda çeviri cihazda TAM SAYI ve en çok yarım cihaz pikseli oynar', (d) => {
    for (const v of [585.455, 391.005, 513.287, -1234.61, 0.3, 818]) {
      const o = veCameraDrawOffset({ x: v, y: v }, d);
      expect(tamSayiMi(o.x * d)).toBe(true);
      expect(Math.abs(o.x - v)).toBeLessThanOrEqual(0.5 / d + 1e-9);
    }
  });

  test('zaten hizalı ofset DEĞİŞMEZ (1×\'te tam sayı, 1,25×\'te 0,8\'in katı)', () => {
    expect(veCameraDrawOffset({ x: 818, y: 513 }, 1)).toEqual({ x: 818, y: 513 });
    expect(veCameraDrawOffset({ x: 800.8, y: 400 }, 1.25)).toEqual({ x: 800.8, y: 400 });
  });

  test('geçersiz dpr 1\'e düşer; sayı olmayan ofset olduğu gibi geçer', () => {
    expect(veCameraDrawOffset({ x: 10.5, y: 3 }, 0)).toEqual({ x: 11, y: 3 });
    expect(veCameraDrawOffset({ x: 10.5, y: 3 }, NaN)).toEqual({ x: 11, y: 3 });
    expect(veCameraDrawOffset({ x: NaN, y: 3 }, 1).x).toBeNaN();
  });

  test('ölçeğe dokunulmaz — kesirli zoom zoom olarak kalır', () => {
    expect(veCanvasTransformCss({ x: 10.5, y: 20.5 }, 0.473, 1)).toBe('translate(11px, 21px) scale(0.473)');
  });
});

describe('bağlantı — GERÇEK updateCanvasTransform', () => {
  test('1× ekran: yazılan çeviri tam piksel, DURUM kesirli kalır', () => {
    dprYaz(1);
    canvasOffset.x = 765.5; canvasOffset.y = 464.5;
    updateCanvasTransform();
    expect(ceviri()).toEqual({ x: 766, y: 465, z: 1 });
    expect([canvasOffset.x, canvasOffset.y]).toEqual([765.5, 464.5]);
  });

  test.each([1.25, 1.5])('%s× ekran: yazılan çeviri × dpr tam sayı', (d) => {
    dprYaz(d);
    canvasOffset.x = 585.455; canvasOffset.y = 391.005; canvasZoom = 0.8;
    updateCanvasTransform();
    const c = ceviri();
    expect(tamSayiMi(c.x * d)).toBe(true);
    expect(tamSayiMi(c.y * d)).toBe(true);
    expect(c.z).toBe(0.8);
  });

  test('pan adımları DURUMDA birikir — çizimin yuvarlaması kamerayı kaydırmaz', () => {
    dprYaz(1);
    canvasOffset.x = 100; canvasOffset.y = 100;
    for (let i = 0; i < 6; i++) { canvasOffset.x += 0.25; updateCanvasTransform(); }
    // Her adımda durum yuvarlansaydı 0,25'lik adımlar hiç ilerlemezdi (100'de kalırdı).
    expect(canvasOffset.x).toBe(101.5);
    expect(ceviri().x).toBe(102);
  });

  test('ızgara İÇERİKLE aynı kamerayı izler', () => {
    dprYaz(1);
    canvasOffset.x = 765.5; canvasOffset.y = 464.5;
    updateCanvasTransform();
    const w = document.getElementById('ve-canvas-wrapper');
    const gx = parseFloat(w.style.getPropertyValue('--ve-grid-x'));
    const gy = parseFloat(w.style.getPropertyValue('--ve-grid-y'));
    // Yerel 3000 çizgisinin ekran yeri = çizilen çeviri; desen çizgisi oraya
    // hücrenin katı kadar uzakta olmalı.
    const c = ceviri();
    expect(((c.x - gx) % 20 + 20) % 20).toBeCloseTo(0, 9);
    expect(((c.y - gy) % 20 + 20) % 20).toBeCloseTo(0, 9);
  });
});
