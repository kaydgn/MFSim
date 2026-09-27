/**
 * can-sayi.test.js — CAN Çözümleyici'nin sayı yazıcısı MFSim'inkiyle AYNI (karar 7·C)
 * ───────────────────────────────────────────────────────────────────────────
 * candbc/ js/'ten dosya almaz (candbc/README.md) — yazıcı bu yüzden ikinci
 * kez yazıldı (cdbSayi · cdbSayiUstel, can-decode.js). İki kopya sessizce
 * ayrışabilir: aynı sayı iki programda iki türlü görünür. Kapı kodu değil
 * DAVRANIŞI ölçer; ayrıca CAN'ın bütün kaynağı işaretsiz yazım için taranır.
 */
const fs = require('fs');
const path = require('path');
const T = require('../../tools/sayi-dili.js');
const { veSayi, veSayiUstel } = require('../../js/sayi.js');
const D = require('../../candbc/js/can-decode.js');
const C = require('../../candbc/js/can-chart.js');

const TOHUM = [0, 1, -1, 0.5, 12.25, 999.99, 1000, 1716.2, -1716.25, 12345.678, 1234567.5,
  -0.004, 0.00355, 1e21, 1e-7, 2141, NaN, Infinity, null, '', '12.5'];

describe('cdbSayi ↔ veSayi — aynı sayı iki programda aynı yazılır', () => {
  test.each(TOHUM.flatMap((v) => [null, 0, 1, 3, 6].map((b) => [v, b])))('%p (%p basamak)', (v, b) => {
    expect(D.cdbSayi(v, b == null ? undefined : b)).toBe(veSayi(v, b == null ? undefined : b));
  });
  test.each([1.2e7, 0.0000012, -3.5e-9, 6.02e23])('üstel: %p', (v) => {
    expect(D.cdbSayiUstel(v, 2)).toBe(veSayiUstel(v, 2));
  });
});

describe('ekrandaki biçimlendiriciler Türkçe', () => {
  test('eksen ve zaman', () => {
    expect(C.cdbFmtNum(1716.25, 0.01)).toBe('1.716,25');
    expect(C.cdbFmtTime(12.5, 0.01)).toBe('12,500 s');
  });
  test('sinyal değeri', () => {
    const rpm = { factor: 0.125, offset: 0, unit: 'rpm', valueType: 'int', values: null };
    expect(D.cdbFmtSigVal(rpm, 1451.625)).toBe('1.451,625 rpm');
    const yuzde = { factor: 0.4, offset: 0, unit: '%', valueType: 'int', values: null };
    expect(D.cdbFmtSigVal(yuzde, 37.2)).toBe('%37,2');         // yüzde önde
    expect(D.cdbFmtSigVal(yuzde, 37.2, false)).toBe('37,2');
  });
});

describe('CAN kaynağı', () => {
  const KOK = path.join(__dirname, '../..');
  const dosyalar = fs.readdirSync(path.join(KOK, 'candbc/js')).filter((f) => f.endsWith('.js')).map((f) => 'candbc/js/' + f);
  test('işaretsiz sayı yazımı yok (makine biçimi sebebiyle işaretli)', () => {
    expect(dosyalar.length).toBeGreaterThan(5);
    expect(dosyalar.flatMap(T.sapmalar).map((x) => x.dosya + ':' + x.satir + ' ' + x.metin)).toEqual([]);
  });
  test('CSV Excel-TR biçiminde: ayraç ";", zaman ve değer ondalığı ","', () => {
    const src = fs.readFileSync(path.join(KOK, 'candbc/js/can-app.js'), 'utf8');
    expect(src).toMatch(/ser\.t\[i\]\.toFixed\(6\)\.replace\('\.', ','\) \+ ';'/);
    expect(src).toMatch(/ser\.v\[i\]\.toFixed\(cdbSigDecimals\(meta\.sig\)\)\.replace\('\.', ','\)/);
  });
});
