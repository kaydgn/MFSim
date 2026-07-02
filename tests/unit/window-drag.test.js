/**
 * window-drag.test.js — Özellik penceresi sürükleme + konum kaydetme
 * js/window-drag.js saf fonksiyonlarını (clamp, kalıcılık, uygulama) test eder.
 */

// jsdom localStorage'ı temiz başlat
beforeEach(() => {
  try { window.localStorage.clear(); } catch (e) {}
  jest.resetModules();
});

const load = () => require('../../js/window-drag.js');

describe('clampPos — konumu viewport içinde tut', () => {
  const { clampPos } = load();
  const VP_W = 1000, VP_H = 800, WIN_W = 300, WIN_H = 200;

  test('içerideki konum değişmeden döner', () => {
    expect(clampPos(400, 300, WIN_W, WIN_H, VP_W, VP_H)).toEqual({ left: 400, top: 300 });
  });

  test('sol/üst taşması kenara (MARGIN) çekilir', () => {
    expect(clampPos(-50, -80, WIN_W, WIN_H, VP_W, VP_H)).toEqual({ left: 8, top: 8 });
  });

  test('sağ taşması sağ kenara clamp (vpW - winW - MARGIN)', () => {
    expect(clampPos(9999, 300, WIN_W, WIN_H, VP_W, VP_H)).toEqual({ left: 1000 - 300 - 8, top: 300 });
  });

  test('alt taşması alt kenara clamp (vpH - winH - MARGIN)', () => {
    expect(clampPos(400, 9999, WIN_W, WIN_H, VP_W, VP_H)).toEqual({ left: 400, top: 800 - 200 - 8 });
  });

  test('pencere viewport\'tan büyükse sol/üst kenara yapışır (MARGIN)', () => {
    expect(clampPos(500, 500, 1200, 1000, VP_W, VP_H)).toEqual({ left: 8, top: 8 });
  });
});

describe('kalıcılık — save/load/clear', () => {
  test('kaydedilen konum yuvarlanarak geri yüklenir', () => {
    const api = load();
    api.savePos(120.6, 240.2);
    expect(api.loadPos()).toEqual({ left: 121, top: 240 });
  });

  test('kayıt yokken null döner', () => {
    const api = load();
    expect(api.loadPos()).toBeNull();
  });

  test('clearPos kaydı siler', () => {
    const api = load();
    api.savePos(100, 100);
    api.clearPos();
    expect(api.loadPos()).toBeNull();
  });

  test('bozuk/eksik JSON güvenle null döner', () => {
    const api = load();
    window.localStorage.setItem(api.STORE_KEY, '{bozuk');
    expect(api.loadPos()).toBeNull();
    window.localStorage.setItem(api.STORE_KEY, JSON.stringify({ left: 'x' }));
    expect(api.loadPos()).toBeNull();
  });
});

describe('applyStoredPosition — kayıtlı konumu pencereye uygular', () => {
  function setupDOM() {
    document.body.innerHTML =
      '<div id="ve-properties-overlay" style="display:flex">' +
      '  <div class="ve-properties">' +
      '    <div class="ve-properties-header">Özellikler</div>' +
      '  </div>' +
      '</div>';
    const win = document.querySelector('.ve-properties');
    // jsdom getBoundingClientRect 0 döndürür → pencere boyutunu sabitle
    win.getBoundingClientRect = () => ({ left: 0, top: 0, width: 400, height: 300, right: 400, bottom: 300 });
    return win;
  }

  test('kayıt varsa absolute konum + clamp uygulanır', () => {
    const win = setupDOM();
    const api = load();
    api.savePos(250, 150);
    api.applyStoredPosition();
    expect(win.style.position).toBe('absolute');
    expect(win.style.left).toBe('250px');
    expect(win.style.top).toBe('150px');
    expect(win.style.margin).toBe('0px');
  });

  test('kayıt yoksa inline stiller temizlenir (flex ortalama)', () => {
    const win = setupDOM();
    win.style.position = 'absolute'; win.style.left = '10px'; win.style.top = '10px';
    const api = load();
    api.applyStoredPosition();
    expect(win.style.position).toBe('');
    expect(win.style.left).toBe('');
    expect(win.style.top).toBe('');
  });

  test('ekran dışı kayıt açılışta viewport içine clamp\'lenir', () => {
    const win = setupDOM();
    const api = load();
    api.savePos(99999, 99999);
    api.applyStoredPosition();
    // window.innerWidth/Height jsdom varsayılanı (1024x768) — clamp uygulanmalı
    expect(parseFloat(win.style.left)).toBeLessThan(window.innerWidth);
    expect(parseFloat(win.style.top)).toBeLessThan(window.innerHeight);
    expect(parseFloat(win.style.left)).toBeGreaterThanOrEqual(8);
  });
});
