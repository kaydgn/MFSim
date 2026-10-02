// kontrast-olcu.js — ekran kontrast ölçerinin MATEMATİĞİ düşebiliyor mu?
// Ölçer gerçek tarayıcıda koşuyor (tests/e2e/kontrast.spec.js); burada
// tuttuğumuz şey ölçütün kendisi: yanlış bir parlaklık formülü ya da tanınmayan
// renk biçimi bütün ekran taramasını sessizce yeşil yapardı.
const { kLum, kOran, kUst, kRenk, kEsik, KAYNAK } = require('../helpers/kontrast-olcu.js');

describe('kontrast ölçütü (WCAG 2.1)', () => {
  test('bilinen çiftler: siyah/beyaz 21:1, #767676/beyaz 4,54:1', () => {
    expect(kOran([0, 0, 0], [255, 255, 255])).toBeCloseTo(21, 5);
    expect(kOran([118, 118, 118], [255, 255, 255])).toBeCloseTo(4.54, 2);
    expect(kOran([255, 255, 255], [118, 118, 118])).toBeCloseTo(4.54, 2);   // simetrik
    expect(kLum([255, 255, 255])).toBeCloseTo(1, 6);
  });

  test('opaklık katmanı: %62 metin rengi zemine doğru açılır ve oran DÜŞER', () => {
    // Ölçülen kusur: --text-primary (#26241f) opacity .62 → 4,36:1 (#faf8f4 üstünde)
    const z = [250, 248, 244, 1];
    const tam = kOran(kUst([38, 36, 31, 1], z), z);
    const soluk = kOran(kUst([38, 36, 31, 0.62], z), z);
    expect(tam).toBeGreaterThan(14);
    expect(soluk).toBeCloseTo(4.36, 1);
  });

  test('renk biçimleri: rgb · rgba · boşluklu · color(srgb) · transparent; bilinmeyen null', () => {
    expect(kRenk('rgb(1, 2, 3)')).toEqual([1, 2, 3, 1]);
    expect(kRenk('rgba(1, 2, 3, 0.5)')).toEqual([1, 2, 3, 0.5]);
    expect(kRenk('rgb(1 2 3 / 0.25)')).toEqual([1, 2, 3, 0.25]);
    const c = kRenk('color(srgb 1 0.5 0 / 0.4)');
    expect(c.map((x) => Math.round(x * 100) / 100)).toEqual([255, 127.5, 0, 0.4]);
    expect(kRenk('transparent')).toEqual([0, 0, 0, 0]);
    expect(kRenk('oklch(0.5 0.1 30)')).toBeNull();      // sessizce atlanmaz: çağıran ihlal yazar
    expect(kRenk('')).toBeNull();
  });

  test('eşik: normal yazı 4,5; büyük yazı (24 px ya da 18,66 px kalın) 3', () => {
    expect(kEsik(12, 400)).toBe(4.5);
    expect(kEsik(18.66, 400)).toBe(4.5);
    expect(kEsik(18.66, 700)).toBe(3);
    expect(kEsik(24, 400)).toBe(3);
  });

  test('sayfa kaynağı kendi kendine yeterli (tek IIFE, dış ad yok)', () => {
    const w = {};
    // Tarayıcı globallerini en küçük hâliyle taklit et: kurucu yalnız
    // window.__kontrast'ı tanımlamalı, başka global bırakmamalı.
    const f = new Function('window', 'document', 'getComputedStyle', 'innerHeight', 'innerWidth', 'NodeFilter',
      KAYNAK);
    f(w, {}, () => ({}), 0, 0, {});
    expect(Object.keys(w)).toEqual(['__kontrast']);
  });
});
