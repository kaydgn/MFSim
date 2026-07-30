/**
 * Eksen etiketi biçimlendirme — js/graphics.js
 * ────────────────────────────────────────────
 * Eksen basamak sayısı ADIMA göre BİR KEZ belirlenir; her etiket aynı
 * basamakla yazılır. Eskiden basamak DEĞER BAŞINA seçiliyordu, bu yüzden
 * eksen "60.0  80.0  100  120" diye okunuyordu: aynı eksende iki farklı
 * basamak düzeni.
 *
 * Burada sessiz bir kayma "makul ama yanlış" bir eksen üretir — grafik
 * çalışır görünür, sayılar tutarsız okunur. Gözle ancak o eksen o aralıkta
 * çizilirse fark edilir; testin karşılığı burada.
 */
const src = loadSource('graphics.js');

// graphics.js üst-seviye fonksiyon bildiriyor; yalnız ilgili iki saf
// fonksiyonu kapsama alıyoruz (dosyanın tamamı DOM'a dokunuyor).
const veAxisDecimals = new Function(
  src.slice(src.indexOf('function veAxisDecimals')) + '\nreturn veAxisDecimals;'
)();
const veFormatAxisVal = new Function(
  src.slice(src.indexOf('function veFormatAxisVal')) + '\nreturn veFormatAxisVal;'
)();

describe('veAxisDecimals — basamak sayısı adımdan gelir', () => {
  test('tam sayı adımlar basamak istemez', () => {
    [1, 2, 5, 10, 20, 50, 100, 1000].forEach((s) => expect(veAxisDecimals(s)).toBe(0));
  });

  test('ondalık adımlar kendi basamağını ister', () => {
    expect(veAxisDecimals(0.5)).toBe(1);
    expect(veAxisDecimals(0.2)).toBe(1);
    expect(veAxisDecimals(0.05)).toBe(2);
    expect(veAxisDecimals(0.02)).toBe(2);
    expect(veAxisDecimals(0.005)).toBe(3);
  });

  test('işaret önemsiz — mutlak değere bakılır', () => {
    expect(veAxisDecimals(-0.05)).toBe(veAxisDecimals(0.05));
  });

  test('geçersiz adım çökmez, 0 döner', () => {
    [0, -1, NaN, Infinity, undefined, null].forEach((s) => {
      expect(veAxisDecimals(s)).toBe(0);
    });
  });
});

describe('veFormatAxisVal — aynı eksende basamak sayısı DEĞİŞMEZ', () => {
  // Asıl regresyon: 20 adımlı bir eksende 60/80/100/120 etiketleri.
  test('20 adımlı eksende hiçbir etiket ondalık taşımaz', () => {
    const dec = veAxisDecimals(20);
    const etiketler = [60, 80, 100, 120].map((v) => veFormatAxisVal(v, dec));
    expect(etiketler).toEqual(['60', '80', '100', '120']);
  });

  test('0,5 adımlı eksende her etiket tek basamaklı', () => {
    const dec = veAxisDecimals(0.5);
    const etiketler = [0, 0.5, 1, 1.5, 2].map((v) => veFormatAxisVal(v, dec));
    expect(etiketler).toEqual(['0.0', '0.5', '1.0', '1.5', '2.0']);
  });

  test('sıfır ile büyük değer aynı eksende aynı basamağı alır', () => {
    const dec = veAxisDecimals(0.05);
    expect(veFormatAxisVal(0, dec)).toBe('0.00');
    expect(veFormatAxisVal(0.25, dec)).toBe('0.25');
    expect(veFormatAxisVal(4, dec)).toBe('4.00');
  });

  test('negatif değerler de aynı basamakla yazılır', () => {
    const dec = veAxisDecimals(0.5);
    expect(veFormatAxisVal(-1, dec)).toBe('-1.0');
    expect(veFormatAxisVal(-0.5, dec)).toBe('-0.5');
  });

  test('10 binin üstünde tam sayı eksende k kısaltması korunur', () => {
    expect(veFormatAxisVal(20000, 0)).toBe('20k');
    expect(veFormatAxisVal(150000, 0)).toBe('150k');
  });

  test('ondalıklı eksende k kısaltmasına DÜŞMEZ (basamak bilgisi kaybolmasın)', () => {
    expect(veFormatAxisVal(20000, 1)).toBe('20000.0');
  });

  test('adım verilmezse eski davranış korunur (geriye dönük)', () => {
    // Çağrı yerlerinden biri güncellenmezse sessizce bozulmasın diye
    // parametresiz yol hâlâ çalışıyor olmalı.
    expect(veFormatAxisVal(100)).toBe('100');
    expect(veFormatAxisVal(12.5)).toBe('12.5');
    expect(veFormatAxisVal(20000)).toBe('20k');
  });
});
