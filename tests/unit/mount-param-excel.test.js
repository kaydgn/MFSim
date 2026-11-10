/**
 * @jest-environment jsdom
 */
// TAKOZ · PARAMETRİK ANALİZ — EXCEL ÇIKTISI (js/mount-param-excel.js · js/xlsx-yaz.js)
// Kullanıcı kararları: 2026-11-09 "Kullanıcı bu Excel formatında çıktı alacak" (düzen
// Canlı Not'ta 19 notla, 10 Ton TTA, R12); 2026-11-10 sıralamanın ana ölçütü statik
// sehim, Tarama'nın her satırının sonucu görülebilir, K sonuçları açık sayfa değil. Kapılar:
//   DÜZEN     — Özet · Tarama · Sonuç · gizli Veri; K sayfası YOK; Özet'in sütunları ve
//               başlık notları; ızgara kapalı; kullanılmayan satır/sütun gizli
//   UYGUNLUK  — tek renkli sütun: en uygun koyu yeşil (beyaz yazı), öteki uygunlar
//               sırayla açılan yeşil, uygun olmayan renksiz; başka hücre boyanmaz
//   SONUÇ     — pano: gösterilen No = girilen No, yoksa Tarama süzgecinin ilk satırı;
//               değerler Veri'den formülle, önbellek No 1'in; K blokları ve bağlantıları
//   VERİ      — Tarama'nın her satırı bir satır; yük durumu başına tek hücre
//               (mm'nin yüzde biri, ';' ayraçlı); panonun formülü doğru belirteci okur
//   AD        — "ASR…" eki hiçbir yerde yok
//   SAYI      — frekans payı ve kapasite onaylanan Excel'in değerleri (R12)
//   SIĞAR     — her kenarlıklı hücrenin yazısı sütun genişliğine sığar (Calibri ölçüsü)
const X = require('../../js/xlsx-yaz.js');
const E_ = require('../../js/mount-param-excel.js');
const R = require('../../js/xlsx-read.js');

// 10 Ton TTA'nın (üç takozlu kurulum) konfigürasyonları — onaylanan Excel'in (R12) değerleri
const F_K0 = [5.1126, 5.7046, 6.5321, 8.4885, 10.7892, 15.4683];
const F_K1 = [6.8219, 7.9806, 11.4077, 12.0372, 14.2101, 15.2143];
function vaka(ad, dz) { return { ad, d: [[0.2, 0, dz[0]], [-0.5, 0.0044, dz[1]], [-0.45, 0.0044, dz[2]]] }; }
const BOS = -2147483648;
// Veri: 3 satır × 2 yük durumu × 3 takoz × X/Y/Z (mm/100)
const kod = new Int32Array(3 * 2 * 3 * 3).fill(BOS);
const yaz = (i, q, m, xyz) => xyz.forEach((v, a) => { kod[((i * 2 + q) * 3 + m) * 3 + a] = v; });
yaz(0, 0, 0, [-30, 10, -390]); yaz(0, 0, 1, [1, 0, -543]); yaz(0, 0, 2, [4, 0, -592]);
yaz(0, 1, 0, [-172, 3, -502]); yaz(0, 1, 1, [15, 0, -1504]);                // 3. takozun Max Bump'ı yok
yaz(1, 0, 0, [-12, 0, -1500]); yaz(1, 0, 1, [2, 0, -1200]); yaz(1, 0, 2, [2, 0, -1210]);
yaz(2, 0, 0, [0, 0, -1510]); yaz(2, 0, 1, [0, 0, -900]); yaz(2, 0, 2, [0, 0, -905]);
// uzun belirteçler (öncekilerin toplam boyu 40'ı aşar): sabit pencere 7. belirteçten sonrasını kaydırırdı
yaz(2, 1, 0, [-123456, 234567, -345678]); yaz(2, 1, 1, [-456789, 567891, -678912]); yaz(2, 1, 2, [-789123, 891234, -912345]);
const modF = new Float64Array(18).fill(NaN), modAd = new Uint16Array(18).fill(65535);
[F_K1, [3.58, 4.45, 6.0, 7.78, 10.11, 12.13], [3.7, 4.42, 6.0, 7.01, 8.9, 12.0]].forEach((f, i) => f.forEach((v, j) => {
  modF[i * 6 + j] = v; modAd[i * 6 + j] = j % 2;
}));
const E = {
  baslik: '10 Ton TTA — takoz konfigürasyonları', fAtes: 35, rolanti: 700, silindir: 6, zeta: 0.02, kutle: 1739.1,
  gruplar: ['Ön takoz · 57RS313774', 'Sağ/Sol arka takoz · 57RS313773'],
  takozlar: [{ ad: 'Ön takoz · 57RS313774', grup: 0 }, { ad: 'Sağ arka takoz · 57RS313773', grup: 1 }, { ad: 'Sol arka takoz · 57RS313773', grup: 1 }],
  konfig: [
    { K: 0, mevcut: true, tipler: ['57RS313774 (ASR-SR-116)', '57RS313773 (ASR-SR-116)'], uygunluk: 'Uygun değil',
      kriter: [true, true, false, true], d: 2.9001, f: F_K0, T: 0.10309,
      takozTip: ['57RS313774 (ASR-SR-116)', '57RS313773 (ASR-SR-116)', '57RS313773 (ASR-SR-116)'],
      vakalar: [vaka('Static', [-2.69, -2.66, -2.9]), vaka('Max Bump', [-15.1, -8.9, -9.7])],
      modlar: F_K0.map((f, i) => ({ f, ad: ['pitch+bounce', 'roll', 'bounce', 'lateral+yaw', 'fore-aft', 'roll'][i] })) },
    { K: 1, tipler: ['TK040 45 ShA (57RS329001M)', 'Cone 121 NP 55 ShA (AMC 137829)'], uygunluk: 'En uygun',
      kriter: [true, true, true, true], d: 5.9178, f: F_K1, T: 0.121701,
      takozTip: ['TK040 45 ShA (57RS329001M)', 'Cone 121 NP 55 ShA (AMC 137829)', 'Cone 121 NP 55 ShA (AMC 137829)'],
      vakalar: [vaka('Static', [-3.9, -5.43, -5.92])], modlar: F_K1.map((f) => ({ f, ad: 'roll' })) },
    { K: 2, tipler: ['Mount 1 70 ShA', 'Cone 39 50 ShA (AMC 137982)'], uygunluk: 'Uygun',
      kriter: [true, true, true, true], d: 6.0128, f: [5.69, 7.03, 7.86, 10.53, 11.06, 13.16], T: 0.051,
      takozTip: ['Mount 1 70 ShA', 'Cone 39 50 ShA (AMC 137982)', 'Cone 39 50 ShA (AMC 137982)'],
      vakalar: [vaka('Static', [-3.1, -6.0, -6.01])], modlar: [{ f: 5.69, ad: 'yaw+lateral' }] },
    { K: 3, tipler: ['LMT-1433-00 55 ShA', '57RS313773 (A26)'], uygunluk: 'Uygun',
      kriter: [true, true, true, true], d: 6.368, f: [4.25, 5.03, 6.42, 7.31, 10.66, 16.1], T: 0.0881,
      takozTip: ['LMT-1433-00 55 ShA', '57RS313773 (A26)', '57RS313773 (A26)'], vakalar: [], modlar: [] }
  ],
  tarama: { N: 576, gruplar: [0, 1], adaylar: [['TK040 45 ShA (57RS329001M)', 'Cone 121 NP 55 ShA (AMC 137829)', 'Mount 1 40 ShA']],
    satirlar: [
      { tipler: ['TK040 45 ShA (57RS329001M)', 'Cone 121 NP 55 ShA (AMC 137829)'], f: F_K1, fB: 11.49, T: 0.121701, d: 5.918,
        k: [true, true, true, true], yuk: [496, 648], azami: [null, 1200] },
      { tipler: ['Mount 1 40 ShA', 'Cone 39 50 ShA (AMC 137982)'], f: [3.58, 4.45, 6.0, 7.78, 10.11, 12.13], fB: 7.16, T: 0.045, d: 15.0,
        k: [true, true, true, true], yuk: [470, 661], azami: [null, 600] },
      { tipler: ['57RS313774 (ASR-SR-116)', 'Cone 38 60 ShA (AMC 137963)'], f: [3.7, 4.42, 6.0, 7.01, 8.9, 12.0], fB: 3.62, T: 0.012, d: 15.1,
        k: [true, false, false, true], yuk: [497.3, 647.8], azami: [null, 650] }
    ],
    veri: { vakaAdlari: ['Static', 'Max Bump'], nT: 3, nM: 6, kod, modF, modAd, modAdlar: ['pitch+bounce', 'roll'] } }
};
E.tarama.adaylar.push(E.tarama.adaylar[0]);

const KITAP = E_.kitap(E);
const sayfa = (ad) => KITAP.sayfalar.find((s) => s.ad === ad);
const hucre = (S, r, c) => S.hucre.find((h) => h[0] === r && h[1] === c);
const deger = (h) => (h && h[2] && typeof h[2] === 'object') ? h[2].v : (h ? h[2] : undefined);
const metinler = (S) => S.hucre.map((h) => (h[2] && typeof h[2] === 'object') ? h[2].f + ' ' + h[2].v : h[2])
  .filter((v) => typeof v === 'string').concat((S.not || []).map((n) => n[2]));
const SON = sayfa('Sonuç');
const VERI = sayfa('Veri');
const veriSatir = (i) => VERI.akis.satir(i);

describe('DÜZEN', () => {
  test('sayfalar: Özet, Tarama, Sonuç ve gizli Veri — konfigürasyon başına sayfa yok', () => {
    expect(KITAP.sayfalar.map((s) => s.ad)).toEqual(['Özet', 'Tarama', 'Sonuç', 'Veri']);
    expect(KITAP.sayfalar.map((s) => !!s.gizli)).toEqual([false, false, false, true]);
    const wb = X.dosyalar(KITAP).find((f) => f[0] === 'xl/workbook.xml')[1];
    expect(wb).toContain('<sheet name="Veri" sheetId="4" state="hidden" r:id="rId4"/>');
    expect(wb).toContain('fullCalcOnLoad="1"');
  });

  test('Özet: başlık B2 (14 pt), tablo 4. satırda; Uygunluk\'un yanında Statik sehim', () => {
    const S = sayfa('Özet');
    expect(hucre(S, 2, 2)[2]).toBe('10 Ton TTA — takoz konfigürasyonları');
    expect(hucre(S, 2, 2)[3].boy).toBe(14);
    const bas = S.hucre.filter((h) => h[0] === 4).sort((a, b) => a[1] - b[1]).map((h) => h[2]);
    expect(bas).toEqual(['K', 'Sonuç', 'Ön takoz', 'Sağ/Sol arka takoz', 'Uygunluk', 'Statik sehim [mm]',
      'Kriter 1 · Modal bant < 17,50 Hz', 'Kriter 1a · Mod ayrıklığı > 0,5 Hz', 'Kriter 1b · 8–10 Hz bandında mod yok',
      'Kriter 2 · TR < %50', 'Frekans payı [Hz]', 'TR [%]', 'En düşük mod [Hz]']);
    expect(hucre(S, 6, 7)[2]).toBeCloseTo(5.9178, 4);
    expect(hucre(S, 6, 7)[3].bicim).toBe('0.00');
  });

  test('kriterlerin tanımı başlığın notunda; Uygunluk notu statik sehim sırasını söyler', () => {
    const S = sayfa('Özet');
    expect(S.not.map((n) => n[1])).toEqual([6, 7, 8, 9, 10, 11, 12]);   // Uygunluk · Statik sehim · 1 · 1a · 1b · 2 · Frekans payı
    const u = S.not.find((n) => n[1] === 6)[2];
    expect(u).toContain('En uygun: dört kesin kriteri sağlayanlar arasında statik sehimi en küçük olan.');
    expect(u).toContain('Sıra: statik sehim küçükten büyüğe');
    expect(u).not.toMatch(/Kısmen uygun/);
    expect(S.not.find((n) => n[1] === 7)[2]).toContain('max |δz|');
    expect(S.not.find((n) => n[1] === 8)[2]).toContain('f_ateş = 700 d/dk (rölanti) / 60 × 6 silindir / 2 = 35,00 Hz');
    expect(S.not.find((n) => n[1] === 11)[2]).toContain('ζ = 0,020;  m = 1.739,1 kg');
    expect(Math.max(...S.hucre.map((h) => h[0]))).toBe(8);
  });

  test('her sayfada ızgara kapalı, kullanılmayan satır ve sütun gizli', () => {
    KITAP.sayfalar.filter((S) => !S.akis).forEach((S) => { expect([S.ad, S.izgara, S.gizle]).toEqual([S.ad, false, true]); });
    const F = X.dosyalar(KITAP);
    const s1 = F.find((f) => f[0] === 'xl/worksheets/sheet1.xml')[1];
    expect(s1).toContain('showGridLines="0"');
    expect(s1).toContain('zeroHeight="1"');
  });

  test('Tarama: "Sonuçlar →" panoya gider; statik sehim sütunu', () => {
    const S = sayfa('Tarama');
    expect(hucre(S, 3, 6)[2]).toBe('Sonuçlar →');
    expect(S.bag).toEqual([[3, 6, 'Sonuç', 'C2']]);
    const bas = S.hucre.filter((h) => h[0] === 5).map((h) => h[2]);
    expect(bas).toContain('Statik sehim [mm]');
    expect(bas).not.toContain('Statik sehim maks [mm]');
  });
});

describe('UYGUNLUK — tek renkli sütun', () => {
  const S = sayfa('Özet');
  test('en uygun koyu yeşil ve beyaz yazı; uygunlar sırayla açılan yeşil; uygun olmayan renksiz', () => {
    expect(hucre(S, 5, 6)[2]).toBe('Uygun değil');
    expect(hucre(S, 5, 6)[3].dolgu).toBeUndefined();
    expect(hucre(S, 6, 6)[3]).toMatchObject({ dolgu: '1F7A3D', renk: 'FFFFFF', b: true });
    expect(hucre(S, 7, 6)[3].dolgu).toBe('6BC782');
    expect(hucre(S, 8, 6)[3].dolgu).toBe('7BCD90');
  });
  test('Uygunluk sütunundan başka hiçbir hücre boyanmaz (Not 15)', () => {
    const boyali = S.hucre.filter((h) => h[3] && h[3].dolgu).map((h) => h[1]);
    expect(new Set(boyali)).toEqual(new Set([6]));
  });
});

describe('SONUÇ — seçili kombinasyon panosu', () => {
  test('gösterilen No: girilen No, yoksa süzgecin ilk satırı (dizi formülü, görünmeyen satırı saymaz)', () => {
    expect(hucre(SON, 6, 3)[2]).toBe('Gösterilen No');
    expect(hucre(SON, 6, 4)[2]).toEqual({ f: 'IF(ISNUMBER($D$7),$D$7,$D$8)', v: 1 });
    expect(hucre(SON, 7, 3)[2]).toBe('No');
    expect(hucre(SON, 7, 4)[2]).toBe('');
    expect(hucre(SON, 7, 4)[3].dolgu).toBe('FFF2CC');
    const ilk = hucre(SON, 8, 4)[2];
    expect(ilk.dizi).toBe(true);
    expect(ilk.v).toBe(1);
    expect(ilk.f).toBe('IFERROR(INDEX(\'Tarama\'!$A$6:$A$8,MATCH(1,SUBTOTAL(103,OFFSET(\'Tarama\'!$A$6,ROW(\'Tarama\'!$A$6:$A$8)-ROW(\'Tarama\'!$A$6),0)),0)),"")');
  });

  test('başlık: No ve grupların tipi Veri\'den', () => {
    const b = hucre(SON, 2, 3)[2];
    expect(b.v).toBe('No 1 — Ön takoz: TK040 45 ShA (57RS329001M) · Sağ/Sol arka takoz: Cone 121 NP 55 ShA (AMC 137829)');
    expect(b.f).toContain('INDEX(\'Veri\'!$B$2:$B$4,$D$6)');
    expect(b.f).toContain('INDEX(\'Veri\'!$C$2:$C$4,$D$6)');
    expect(SON.bag).toEqual(expect.arrayContaining([[4, 3, 'Özet', 'A1'], [4, 4, 'Tarama', 'A1']]));
  });

  test('kriterler ve sayılar: başlık 10. satırda, değer 11. satırda (önbellek No 1)', () => {
    const bas = [4, 5, 6, 7, 8, 9, 10, 11].map((c) => hucre(SON, 10, c)[2]);
    expect(bas).toEqual(['Kriter 1', '1a', '1b', '2', 'Dört kriter', 'TR [%]', 'Statik sehim [mm]', 'Frekans payı [Hz]']);
    expect([4, 5, 6, 7, 8].map((c) => deger(hucre(SON, 11, c)))).toEqual(['✓', '✓', '✓', '✓', 'Uygun']);
    expect(deger(hucre(SON, 11, 9))).toBeCloseTo(12.1701, 4);
    expect(deger(hucre(SON, 11, 10))).toBeCloseTo(5.918, 3);
  });

  test('tablo: takoz tipi 13. satırda Veri\'den, yük durumları 16\'dan; belirteç doğru yerden', () => {
    expect(deger(hucre(SON, 13, 8))).toBe('Cone 121 NP 55 ShA (AMC 137829)');
    expect(hucre(SON, 13, 8)[2].olc).toBe('Cone 121 NP 55 ShA (AMC 137829)');     // en uzun aday adı genişliği belirler
    expect(hucre(SON, 14, 8)[2]).toBe('Sağ arka takoz');
    expect([16, 17].map((r) => hucre(SON, r, 3)[2])).toEqual(['Static', 'Max Bump']);
    // Static · Sağ arka takoz (2. takoz) · Z → belirteç 3·1 + 2 = 5; pencere W = (7 + 1) · 9 = 72 → MID başı 5·72 + 1
    const z = hucre(SON, 16, 10)[2];
    expect(z.f).toBe('IFERROR(VALUE(TRIM(MID(SUBSTITUTE(INDEX(\'Veri\'!$X$2:$X$4,$D$6),";",REPT(" ",72)),361,72)))/100,"")');
    expect(z.v).toBeCloseTo(-5.43, 6);
    expect(hucre(SON, 16, 10)[3].bicim).toBe('0.0');
    expect(deger(hucre(SON, 17, 12))).toBe('');                                   // 3. takozun Max Bump'ı yok
  });

  test('modlar ve TR: Veri\'den, frekansa göre sıralı', () => {
    const mh = 16 + 2 + 4;
    expect([2, 3, 4].map((c) => hucre(SON, mh, c)[2])).toEqual(['Mod', 'Mod Tipi', 'Hz']);
    expect(deger(hucre(SON, mh + 1, 3))).toBe('Pitch + Bounce');
    expect(deger(hucre(SON, mh + 2, 4))).toBeCloseTo(7.981, 3);                  // Veri'de 3 ondalık, ekranda 2
    expect(hucre(SON, mh + 6 + 3, 2)[2]).toBe('TR (%)');
    expect(deger(hucre(SON, mh + 6 + 3, 3))).toBeCloseTo(12.1701, 4);
  });
});

describe('SONUÇ — K blokları', () => {
  const Oz = sayfa('Özet');
  const capa = (n) => Oz.bag.find((b) => b[0] === 5 + n && b[1] === 2)[3];
  const satir = (n) => +capa(n).slice(1);
  test('Özet\'in K ve adı Sonuç\'taki bloka gider; blokun başlığı o konfigürasyon', () => {
    [0, 1, 2, 3].forEach((n) => {
      expect(Oz.bag).toEqual(expect.arrayContaining([[5 + n, 2, 'Sonuç', capa(n)], [5 + n, 3, 'Sonuç', capa(n)]]));
      expect(hucre(SON, satir(n), 3)[2]).toMatch(new RegExp('^K' + n + ' — '));
    });
    expect(hucre(Oz, 6, 3)[2]).toBe('K1 TK040-45 + Cone121NP-55');
    expect(hucre(SON, satir(1), 3)[2]).toBe('K1 — Ön takoz: TK040 45 ShA (57RS329001M) · Sağ/Sol arka takoz: Cone 121 NP 55 ShA (AMC 137829)');
  });

  test('blokun düğmeleri: Özet\'e, önceki ve sonraki bloka; ilkte Geri, sonda İleri yok', () => {
    const b = satir(1);
    expect(hucre(SON, b + 2, 3)[2]).toBe('← Özet sayfasına dön');
    expect(hucre(SON, b + 2, 4)[2]).toBe('← Geri konfigürasyon (K0)');
    expect(hucre(SON, b + 2, 12)[2]).toBe('İleri konfigürasyon (K2) →');
    expect(SON.bag).toEqual(expect.arrayContaining([[b + 2, 3, 'Özet', 'A1'], [b + 2, 4, 'Sonuç', capa(0)], [b + 2, 12, 'Sonuç', capa(2)]]));
    expect(hucre(SON, satir(0) + 2, 4)).toBeUndefined();
    expect(hucre(SON, satir(3) + 2, 12)).toBeUndefined();
  });

  test('blokun tablosu: çözümün değerleri (formülsüz)', () => {
    const b = satir(1);
    expect(hucre(SON, b + 5, 8)[2]).toBe('Sağ arka takoz');
    expect([8, 9, 10].map((c) => hucre(SON, b + 6, c)[2])).toEqual(['X', 'Y', 'Z']);
    expect(hucre(SON, b + 7, 3)[2]).toBe('Static');
    expect(hucre(SON, b + 7, 10)[2]).toBe(-5.43);
    expect(hucre(SON, b + 7 + 1 + 4 + 6 + 3, 3)[2]).toBeCloseTo(12.1701, 4);
    const sonra = SON.hucre.filter((h) => h[0] >= satir(0));
    expect(sonra.some((h) => h[2] && typeof h[2] === 'object')).toBe(false);
  });
});

describe('VERİ — gizli sayfa, Tarama\'nın her satırı', () => {
  test('başlık ve satır sayısı: No = satır', () => {
    expect(VERI.akis.n).toBe(4);
    const bas = veriSatir(0);
    expect(bas.slice(0, 11)).toEqual(['No', 'Ön takoz', 'Sağ/Sol arka takoz', 'Kriter 1', '1a', '1b', '2', 'Dört kriter',
      'TR [%]', 'Statik sehim [mm]', 'Frekans payı [Hz]']);
    expect(bas.slice(-2)).toEqual(['Static [mm/100]', 'Max Bump [mm/100]']);
  });
  test('satır: tip, ✓/✗, sayılar, sıralı modlar, yük durumu başına tek hücre', () => {
    const r = veriSatir(1);
    expect(r.slice(0, 8)).toEqual([1, 'TK040 45 ShA (57RS329001M)', 'Cone 121 NP 55 ShA (AMC 137829)', '✓', '✓', '✓', '✓', 'Uygun']);
    expect(r[8]).toBeCloseTo(12.1701, 4);
    expect(r[9]).toBeCloseTo(5.918, 3);
    expect(r.slice(11, 17)).toEqual(F_K1.map((f) => Math.round(f * 1000) / 1000));
    expect(r.slice(17, 23)).toEqual(['Pitch + Bounce', 'Roll', 'Pitch + Bounce', 'Roll', 'Pitch + Bounce', 'Roll']);
    expect(r[23]).toBe('-30;10;-390;1;0;-543;4;0;-592');
    expect(r[24]).toBe('-172;3;-502;15;0;-1504;;;');
    expect(veriSatir(3).slice(0, 8)).toEqual([3, '57RS313774', 'Cone 38 60 ShA (AMC 137963)', '✓', '✗', '✗', '✓', '—']);
  });
  // Excel'in işlevleri (TRIM: baştaki/sondaki boşluk ve iç boşluklar teke)
  const SUBSTITUTE = (m, a, b) => m.split(a).join(b);
  const MID = (m, bas, n) => m.substr(bas - 1, n);
  const TRIM = (m) => m.trim().replace(/ +/g, ' ');
  const hesapla = (f, veriMetni) => {
    const x = /^IFERROR\(VALUE\(TRIM\(MID\(SUBSTITUTE\(INDEX\('Veri'!\$[A-Z]+\$2:\$[A-Z]+\$\d+,\$D\$6\),";",REPT\(" ",(\d+)\)\),(\d+),(\d+)\)\)\)\/100,""\)$/.exec(f);
    expect(x).not.toBeNull();
    const t = TRIM(MID(SUBSTITUTE(veriMetni, ';', ' '.repeat(+x[1])), +x[2], +x[3]));
    return t === '' ? '' : Number(t) / 100;                    // VALUE("") hata → IFERROR → ""
  };
  test('panonun her yük durumu hücresi, Veri\'nin HER satırında aynı belirteci okur (uzun belirteç dâhil)', () => {
    const C = VERI.akis.satir(0), vSut = C.map((b, c) => [b, c]).filter(([b]) => /\[mm\/100\]$/.test(b)).map(([, c]) => c);
    let say = 0;
    for (let n = 1; n < VERI.akis.n; n++) {
      const r = veriSatir(n);
      vSut.forEach((c, q) => E.takozlar.forEach((t, i) => [0, 1, 2].forEach((a) => {
        const h = hucre(SON, 16 + q, 4 + 4 * i + a)[2];
        const bek = String(r[c]).split(';')[3 * i + a];
        expect(hesapla(h.f, String(r[c]))).toBe(bek === '' || bek === undefined ? '' : Number(bek) / 100);
        say++;
      })));
    }
    expect(say).toBe(3 * 2 * 3 * 3);
    expect(hesapla(hucre(SON, 17, 14)[2].f, String(veriSatir(3)[24]))).toBeCloseTo(-9123.45, 6);   // son takozun Z'si (4 + 4·2 + 2)
  });
  test('pencere paketlerken tutulan en küçük/en büyük belirteçten (veri.uc) de aynı', () => {
    let ek = 0, en = 0;
    kod.forEach((v) => { if (v !== BOS) { ek = Math.min(ek, v); en = Math.max(en, v); } });
    const E3 = Object.assign({}, E, { tarama: Object.assign({}, E.tarama, { veri: Object.assign({}, E.tarama.veri, { uc: [ek, en] }) }) });
    const S3 = E_.kitap(E3).sayfalar.find((x) => x.ad === 'Sonuç');
    expect(S3.hucre.filter((h) => h[0] >= 16 && h[0] <= 17).map((h) => h[2] && h[2].f))
      .toEqual(SON.hucre.filter((h) => h[0] >= 16 && h[0] <= 17).map((h) => h[2] && h[2].f));
  });
  test('sabit 40 boşluklu pencere uzun belirteçte YANLIŞ okurdu (kapının düşebildiği)', () => {
    const m = String(veriSatir(3)[24]);
    const t = 3 * 2 + 2, eski = TRIM(MID(SUBSTITUTE(m, ';', ' '.repeat(40)), t * 40 + 1, 40));
    expect(eski).not.toBe(m.split(';')[t]);
  });
});

// ADIM ADIM (2026-11-10): kitabın kurulumu dilimli — Özet ve Sonuç bir adım, Tarama'nın
// başı bir adım, her 100 satırı bir adım, sonu (süzgeç, sütun genişliği) bir adım.
describe('ADIM ADIM — kitabın kurulumu dilimli', () => {
  const sur = (I) => { let n = 0; const oran = []; while (I.adim()) { n++; oran.push(I.oran()); } return { n, oran }; };
  test('kitapIs adımları kitap(E) ile aynı dosyaları verir', () => {
    const I = E_.kitapIs(E);
    expect(() => I.kitap()).toThrow('Kitap kurulmadı');
    const { n, oran } = sur(I);
    expect(n).toBe(4);                                                            // Özet+Sonuç · baş · 3 satır · son
    expect(oran[oran.length - 1]).toBe(1);
    expect(X.dosyalar(I.kitap())).toEqual(X.dosyalar(KITAP));
  });
  test('büyük tarama çok adımda; sütun ölçüsü satırlar boyunca birikir (tek seferlikle aynı)', () => {
    const satirlar = [];
    for (let i = 0; i < 1000; i++) satirlar.push(Object.assign({}, E.tarama.satirlar[i % 3], { d: 5 + i / 7, T: 0.001 * (i % 211) }));
    satirlar[777] = Object.assign({}, satirlar[777], { fB: 1234567.891 });          // en geniş sayı sonlarda
    const E2 = Object.assign({}, E, { tarama: Object.assign({}, E.tarama, { N: 1000, satirlar, veri: undefined }) });
    const I = E_.kitapIs(E2), { n, oran } = sur(I);
    expect(n).toBe(1 + 1 + 10 + 1);
    for (let i = 1; i < oran.length; i++) expect(oran[i]).toBeGreaterThanOrEqual(oran[i - 1]);
    const K = I.kitap(), K1 = E_.kitap(E2);
    expect(X.dosyalar(K)).toEqual(X.dosyalar(K1));
    const ta = K.sayfalar.find((x) => x.ad === 'Tarama'), c = 1 + 2 + 6 + 1;     // No · 2 grup · 6 mod · f_b
    expect(ta.sutun[c]).toBe(E_.olc(Object.assign({}, ta, { sutun: {}, satir: {} })).sutun[c]);
    expect(ta.sutun[c]).toBeGreaterThan(9);                                      // 1.234.567,891'in genişliği
  });
});

describe('AD', () => {
  test('"ASR" hiçbir hücrede, notta, formülde, sayfa adında ve dosyanın içinde yok', () => {
    KITAP.sayfalar.filter((S) => !S.akis).forEach((S) => {
      expect(S.ad).not.toMatch(/ASR/i);
      metinler(S).forEach((m) => expect(m).not.toMatch(/ASR/));
    });
    for (let i = 0; i < VERI.akis.n; i++) veriSatir(i).forEach((v) => expect(String(v)).not.toMatch(/ASR/));
    const F = X.dosyalar(KITAP);
    F.forEach(([ad, m]) => expect([ad, /ASR/.test(m)]).toEqual([ad, false]));
    expect(hucre(sayfa('Özet'), 5, 4)[2]).toBe('57RS313774');
  });

  test('kısa tip adı ve konfigürasyonun adı (bütün grupların tipi)', () => {
    expect(E_.kisa('Cone 39 50 ShA (AMC 137982)')).toBe('Cone39-50');
    expect(E_.kisa('57RS313773 (A26)')).toBe('57RS313773 A26');
    expect(E_.kisa('57RS313773 (ASR-SR-116)')).toBe('57RS313773');
    expect(E_.kisa('LMT-1433-00 55 ShA')).toBe('LMT-55');
    expect(E_.kisa('Cone 121 NG 65 ShA (AMC 137833)')).toBe('Cone121NG-65');
    expect(E_.sayfaAdi({ K: 7 }, ['57RS313773 (A26)', 'Cone 39 60 ShA (AMC 137983)', '57RS313774 (A26)']))
      .toBe('K7 57RS313773 A26 + Cone39-60 + 57RS313774 A26');
    expect(E_.sayfaAdi({ K: 0, mevcut: true }, [])).toBe('K0 Mevcut');
  });

  test('mod adı onaylanan biçimde', () => {
    expect(E_.modAdi('pitch+bounce')).toBe('Pitch + Bounce');
    expect(E_.modAdi('fore-aft')).toBe('Fore-aft');
  });
});

describe('SAYI — onaylanan Excel\'in (R12) değerleri', () => {
  test('frekans payı: K0 −0,488 (Özet)', () => {
    expect(E_.frekansPayi(F_K0, 35)).toBeCloseTo(-0.4885, 4);
    expect(hucre(sayfa('Özet'), 5, 12)[2]).toBeCloseTo(-0.4885, 4);
    expect(hucre(sayfa('Özet'), 6, 13)[2]).toBeCloseTo(12.1701, 4);    // TR [%]
    expect(hucre(sayfa('Özet'), 6, 14)[2]).toBeCloseTo(6.8219, 4);     // en düşük mod
  });
  test('kapasite: grup başına yük ↔ azami yük', () => {
    expect(E_.kapasite([470, 661], [null, 600])).toBe('Aşıyor');
    expect(E_.kapasite([496, 648], [null, 1200])).toBe('Bilinen yeter');
    expect(E_.kapasite([497, 647], [900, 650])).toBe('Yeter');
    expect(E_.kapasite([497, 647], [null, null])).toBe('Katalogda yok');
  });
  test('Tarama: dört kriter ✓/✗, satır sırası ve filtre', () => {
    const S = sayfa('Tarama');
    expect(hucre(S, 1, 1)[2]).toBe('Tarama — ilk 3 / 576 kombinasyon (Ön takoz × Sağ/Sol arka takoz)');
    const bas = S.hucre.filter((h) => h[0] === 5).sort((a, b) => a[1] - b[1]).map((h) => h[2]);
    expect(bas.slice(0, 3)).toEqual(['No', 'Ön takoz', 'Sağ/Sol arka takoz']);
    const i1 = bas.indexOf('Kriter 1') + 1;
    expect([0, 1, 2, 3].map((j) => hucre(S, 8, i1 + j)[2])).toEqual(['✓', '✗', '✗', '✓']);
    expect(hucre(S, 8, i1 + 4)[2]).toBe('—');
    expect(hucre(S, 6, i1 + 4)[2]).toBe('Uygun');
    expect(S.filtre).toBe('A5:' + X.harf(bas.length) + '8');
  });
});

describe('SIĞAR — kenarlıklı her hücrenin yazısı sütununa sığar', () => {
  test('tek satırlık yazı sütun genişliğinin içinde (formülde önbellek ya da ölçü ipucu)', () => {
    KITAP.sayfalar.filter((S) => !S.akis).forEach((S) => {
      const kapali = {};
      (S.birlesik || []).forEach((b) => {
        const m = /^([A-Z]+)(\d+):([A-Z]+)(\d+)$/.exec(b);
        const c = (h) => [...h].reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0);
        for (let x = c(m[1]); x <= c(m[3]); x++) kapali[m[2] + ',' + x] = true;
      });
      S.hucre.forEach((h) => {
        const st = h[3] || {};
        let v = h[2];
        if (v && typeof v === 'object') v = v.olc != null ? v.olc : v.v;
        if (!st.kenar || st.sar || kapali[h[0] + ',' + h[1]] || v === '' || v == null) return;
        const gen = (S.sutun[h[1]] || 8.43) * 7 + 5 - 6;
        const yazi = typeof v === 'number' ? String(v.toFixed(3)).replace('.', ',') : v;   // makine: en uzun gösterim
        expect([S.ad, h[0], h[1], E_.px(yazi, st.b) <= gen + 6]).toEqual([S.ad, h[0], h[1], true]);
      });
    });
  });
});

describe('DOSYA — programın okuyucusuyla gidiş-dönüş', () => {
  test('okunan Özet, Sonuç panosu (önbellek) ve Veri kurucunun değerlerini taşır', () => {
    const wb = R.veXlsOpen(X.yaz(KITAP));
    expect(wb.sheets.map((s) => s.name)).toEqual(['Özet', 'Tarama', 'Sonuç', 'Veri']);
    const oz = wb.readSheet(0).rows;
    expect(oz[5].slice(1, 6)).toEqual(['K1', 'K1 TK040-45 + Cone121NP-55', 'TK040 45 ShA (57RS329001M)', 'Cone 121 NP 55 ShA (AMC 137829)', 'En uygun']);
    const son = wb.readSheet(2).rows;
    expect(son[5][3]).toBe(1);
    expect(son[15][2]).toBe('Static');
    expect(son[15][9]).toBeCloseTo(-5.43, 6);
    const veri = wb.readSheet(3).rows;
    expect(veri[1].slice(0, 3)).toEqual([1, 'TK040 45 ShA (57RS329001M)', 'Cone 121 NP 55 ShA (AMC 137829)']);
    expect(veri[1][23]).toBe('-30;10;-390;1;0;-543;4;0;-592');
  });
});
