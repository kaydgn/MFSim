// yerlesim-olcu.js — yerleşim ölçerinin MATEMATİĞİ düşebiliyor mu?
// Ölçer gerçek tarayıcıda koşuyor (tests/e2e/yerlesim.spec.js); burada tutulan
// ölçütün kendisi: kırık sözcük kuralı yanlış olsa bütün tarama sessizce yeşil
// (ya da her satır kırmızı) olurdu.
const { ySozcukler, ySatirSayisi, yKirikMi, yKesisim, yTasma, yYapiskanSerit, yCizgiSayilir, yKutudaNoktalar, KAYNAK } = require('../helpers/yerlesim-olcu.js');

describe('yerleşim ölçütü', () => {
  test('sözcükler: boşlukla ayrılır, harf/rakam taşımayan parça sözcük değildir', () => {
    expect(ySozcukler('TC-411  ·  Motor —')).toEqual([{ s: 'TC-411', i: 0 }, { s: 'Motor', i: 11 }]);
    expect(ySozcukler('')).toEqual([]);
    expect(ySozcukler('%97,0 · 1.716,2')).toEqual([{ s: '%97,0', i: 0 }, { s: '1.716,2', i: 8 }]);
  });

  test('satır sayısı: üst kenarı 2 px içinde olan kutular aynı satır', () => {
    expect(ySatirSayisi([{ top: 10, width: 5, height: 9 }, { top: 11.5, width: 5, height: 9 }])).toBe(1);
    expect(ySatirSayisi([{ top: 10, width: 5, height: 9 }, { top: 24, width: 5, height: 9 }])).toBe(2);
    expect(ySatirSayisi([{ top: 10, width: 0, height: 9 }, { top: 24, width: 5, height: 9 }])).toBe(1);   // boş kutu sayılmaz
  });

  test('kırık sözcük: harf ortası hep kırık; tirede iki yan ≥ 4 harfse kabul', () => {
    expect(yKirikMi('Şanzıman', 4)).toBe(true);          // "Şanz|ıman"
    expect(yKirikMi('TC-411', 3)).toBe(true);            // "TC-|411" — kısa yan
    expect(yKirikMi('Motor-Şanzıman', 6)).toBe(false);   // "Motor-|Şanzıman"
    expect(yKirikMi('Hızl.-Yavaşl.', 6)).toBe(false);    // iki yan 4+ harf
    expect(yKirikMi('ESC—', 3)).toBe(true);              // tire değil, uzun çizgi: harf ortası sayılır
    expect(yKirikMi('mm/s', 3)).toBe(true);              // eğik çizgide ama kısa yan
  });

  test('taşma: yazı kırpan kutunun dışında kalan kısım, eksen başına', () => {
    expect(yTasma({ left: 0, right: 50, top: 0, bottom: 10 }, { left: 0, right: 40, top: 0, bottom: 20 })).toEqual({ x: 10, y: 0 });
    expect(yTasma({ left: -3, right: 20, top: 5, bottom: 30 }, { left: 0, right: 40, top: 0, bottom: 20 })).toEqual({ x: 3, y: 10 });
    expect(yTasma({ left: 2, right: 20, top: 2, bottom: 12 }, { left: 0, right: 40, top: 0, bottom: 20 })).toEqual({ x: 0, y: 0 });
  });

  test('kesişim: iki eksende de pozitifse üst üste; dokunan kutu kesişmez', () => {
    expect(yKesisim({ left: 0, right: 30, top: 0, bottom: 10 }, { left: 20, right: 50, top: 5, bottom: 15 })).toEqual({ x: 10, y: 5 });
    const d = yKesisim({ left: 0, right: 30, top: 0, bottom: 10 }, { left: 30, right: 50, top: 0, bottom: 10 });
    expect(d.x).toBe(0);                                  // yan yana: kesişim yok
    expect(yKesisim({ left: 0, right: 30, top: 0, bottom: 10 }, { left: 0, right: 30, top: 20, bottom: 30 }).y).toBeLessThan(0);
  });

  test('yapışkan şerit: yapışık öğe kabın dolgusu + bottom kadar yukarıda; doğal yerdeki sayılmaz', () => {
    expect(yYapiskanSerit(952, 942, 10, 0)).toBe(10);       // FEAD Hesapla, eski: 10 px dolgu açıkta
    expect(yYapiskanSerit(952, 952, 10, -10)).toBe(0);      // dolgu kadar eksi bottom: dibe oturuyor
    expect(yYapiskanSerit(952, 700, 10, 0)).toBe(0);        // doğal yerinde (yapışık değil)
    expect(yYapiskanSerit(952, 952, 0, 0)).toBe(0);         // dolgusuz kap
  });

  // ÇİZGİ YAZIYI KESİYOR MU: hâle yalnız ALTINDA kalanı örter. Göbek diski
  // gibi üstte çizilen dolgulu şeklin örttüğü nokta görünür sayılmaz (sayfa
  // tarafı); görünür nokta yoksa çizgi yazıyı kesmiyordur.
  test('çizgi: hâleli yazının altındaki çizgi sayılmaz, üstündeki sayılır', () => {
    expect(yCizgiSayilir(true, false, 6)).toBe(false);    // önce çizilmiş, yazı hâleli → örtülür
    expect(yCizgiSayilir(true, true, 6)).toBe(true);      // sonra çizilmiş → hâle örtmez
    expect(yCizgiSayilir(false, false, 6)).toBe(true);    // hâlesiz yazının altından geçen
    expect(yCizgiSayilir(false, true, 0)).toBe(false);    // görünür nokta yok (hepsi örtülü)
  });

  test('çizgi: kutunun İÇİNDEKİ noktalar — kenar sayılmaz', () => {
    const k = { left: 10, right: 50, top: 0, bottom: 12 };
    const n = [{ x: 9, y: 5 }, { x: 10, y: 5 }, { x: 11, y: 5 }, { x: 30, y: 6 }, { x: 49.9, y: 11.9 }, { x: 30, y: 12 }];
    expect(yKutudaNoktalar(n, k)).toEqual([{ x: 11, y: 5 }, { x: 30, y: 6 }, { x: 49.9, y: 11.9 }]);
  });

  test('sayfa kaynağı kendi kendine yeterli (tek IIFE, dış ad yok)', () => {
    const w = {};
    const f = new Function('window', 'document', 'getComputedStyle', 'innerHeight', 'innerWidth', 'NodeFilter', KAYNAK);
    f(w, {}, () => ({}), 0, 0, {});
    expect(Object.keys(w)).toEqual(['__yerlesim']);
  });
});
