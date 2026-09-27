/**
 * sayi-dili.test.js — TEK SAYI YAZICISI (kullanıcı kararı 7·C, 2026-09-26)
 * ───────────────────────────────────────────────────────────────────────────
 * Ekrana giden sayı Türkçe yazılır: ondalık VİRGÜL, binlik NOKTA — 1.716,2.
 * Karar sayfasındaki ölçüm: 213 sayı noktalı (1716.2), 17 sayı virgüllü
 * (1714,6), aynı modülde ikisi birden; günlük hız oranını "1.090" yazıyordu.
 *
 * Kapılar:
 *   · veSayi / veSayiOku davranışı — özellikle GİRDİ yolu: gruplanmış "1.716"
 *     okurken bin mi bir virgül mü belli değil; girdi alanı gruplamasız yazılır
 *     ve okuyucu kendi çıktısını geri okur (sessiz bin kat hataya karşı).
 *   · aşama dosyalarında işaretsiz toFixed/toExponential/toLocaleString yok
 *     (tools/sayi-dili.js) — makine biçimi `// makine: <sebep>` taşır.
 *   · Ölçüm Görüntüleyici aynı yazıcıyı taşıyor (viewer/sync.js birebir kopya).
 */
const fs = require('fs');
const path = require('path');
const T = require('../../tools/sayi-dili.js');
const { veSayi, veSayiUstel, veSayiOku } = require('../../js/sayi.js');

const KOK = path.join(__dirname, '../..');
const oku = (f) => fs.readFileSync(path.join(KOK, f), 'utf8');

// Aşama 1: grafik çekirdeği — eksen, imleç okuması, sinyal ağacı, pano
// tablosu. MFSim ile Ölçüm Görüntüleyici'de ortak.
const ASAMA1 = ['js/sayi.js', 'js/signal-tree.js', 'js/trace-view.js', 'js/measure-core.js',
  'viewer/js/board.js'];

describe('veSayi — Türkçe yazım', () => {
  test.each([
    [1716.2, 1, '1.716,2'],
    [1714.64, 1, '1.714,6'],
    [1000, 0, '1.000'],
    [999.5, 0, '1.000'],              // yuvarlama gruplamadan ÖNCE
    [1.09, 3, '1,090'],               // günlüğün "1.090"u: artık bin doksan diye okunmaz
    [1234567.891, 2, '1.234.567,89'],
    [-12, 2, '-12,00'],
    [0.5, undefined, '0,5'],
    [42, undefined, '42']
  ])('%p (%p hane) → %s', (v, n, beklenen) => expect(veSayi(v, n)).toBe(beklenen));

  test('yuvarlanınca sıfıra inen eksi sayı işaretini bırakır ("-0,0" yok)', () => {
    expect(veSayi(-0.04, 1)).toBe('0,0');
    expect(veSayi(-0.0001, 0)).toBe('0');
    expect(veSayi(-0.06, 1)).toBe('-0,1');
  });

  test('sayı değilse tire; seçenekler: gruplamasız, belge eksisi, işaret', () => {
    [NaN, Infinity, null, undefined, '', 'abc'].forEach((v) => expect(veSayi(v, 1)).toBe('—'));
    expect(veSayi(1716.2, 1, { binlik: false })).toBe('1716,2');
    expect(veSayi(-3.5, 1, { eksi: '−' })).toBe('−3,5');
    expect(veSayi(25, 0, { isaret: true })).toBe('+25');
    expect(veSayi(0, 0, { isaret: true })).toBe('0');
    expect(veSayi('12.5', 1)).toBe('12,5');            // sayı dizgesi okunur
  });

  test('üstel yazımda ondalık virgül; toFixed\'in üstele kaçtığı büyüklükte de', () => {
    expect(veSayiUstel(0.000123, 2)).toBe('1,23e-4');
    expect(veSayiUstel(-4.5e-7, 1)).toBe('-4,5e-7');
    expect(veSayi(1e21, 0)).toBe('1,00e+21');
  });
});

describe('veSayiOku — girdi iki yazımı da kabul eder, SESSİZ bin kat hata yok', () => {
  test.each([
    ['63,5', 63.5], ['63.5', 63.5], ['1.716,2', 1716.2], ['1716,2', 1716.2],
    [' −2,5 ', -2.5], ['-2.5', -2.5], ['1e3', 1000], [12, 12]
  ])('%p → %p', (s, v) => expect(veSayiOku(s)).toBe(v));

  test('bozuk ya da boş girdi NaN — sıfır değil', () => {
    ['', '   ', 'abc', '1,2,3', '--2', null, undefined].forEach((s) => expect(veSayiOku(s)).toBeNaN());
  });

  test('virgülsüz nokta ONDALIKTIR: "1.716" bugünkü gibi 1,716 okunur', () => {
    // Bu yüzden girdi alanı gruplamasız yazılır — aşağıdaki gidiş-dönüş kapısı.
    expect(veSayiOku('1.716')).toBe(1.716);
  });

  const TOHUM = [0, 1, -1, 0.5, 12.25, 999.99, 1000, 1716.2, -1716.25, 12345.678, 1234567.5, -0.004];

  test('gidiş-dönüş: GRUPLAMASIZ çıktı her zaman aynı sayıya döner (girdi alanının yolu)', () => {
    for (const v of TOHUM) {
      for (const n of [0, 1, 2, 3]) {
        const beklenen = Number(v.toFixed(n)) || 0;   // yazıcı "-0" yazmaz (yukarıda)
        expect([v, n, veSayiOku(veSayi(v, n, { binlik: false }))]).toEqual([v, n, beklenen]);
      }
    }
  });

  test('gidiş-dönüş: gruplu çıktı ONDALIK taşıyorsa döner (virgül binliği belirler)', () => {
    for (const v of TOHUM) {
      for (const n of [1, 2, 3]) {
        expect([v, n, veSayiOku(veSayi(v, n))]).toEqual([v, n, Number(v.toFixed(n)) || 0]);
      }
    }
  });

  test('gruplanmış TAM SAYI geri okunamaz: "1.000" → 1 — girdi alanına gruplu sayı YAZILMAZ', () => {
    // Bilerek: okuyucu virgülsüz noktayı ondalık sayar, çünkü dişli oranı
    // "1.000" / "2.480" bugün böyle yazılıyor. Kapının ilk sürümü tam bu
    // bin kat hatayı yakaladı (999,99 → "1.000" → 1).
    expect(veSayi(999.99, 0)).toBe('1.000');
    expect(veSayiOku(veSayi(999.99, 0))).toBe(1);
    expect(veSayiOku(veSayi(999.99, 0, { binlik: false }))).toBe(1000);
  });
});

describe('tarayıcının kuralı', () => {
  const yakalar = (m) => T.tara(m, 'a.js').map((x) => x.satir);
  test('ekrana giden toFixed / toExponential / toLocaleString yakalanır', () => {
    expect(yakalar("h += v.toFixed(1) + ' mm';")).toEqual([1]);
    expect(yakalar('s = x.toExponential(2);')).toEqual([1]);
    expect(yakalar('s = n.toLocaleString();')).toEqual([1]);
  });
  test('sebebi yazılı makine biçimi, yorum ve veSayi geçer; sebepsiz işaret geçmez', () => {
    expect(yakalar("row += n.toFixed(4);   // makine: CSV hücresi")).toEqual([]);
    expect(yakalar('// eskiden v.toFixed(1) yazılıyordu')).toEqual([]);
    expect(yakalar("h += veSayi(v, 1) + ' mm';")).toEqual([]);
    expect(yakalar('row += n.toFixed(4);   // makine:')).toEqual([1]);
  });
});

describe('aşama 1 — grafik çekirdeği (eksen · imleç · sinyal ağacı · pano)', () => {
  test('liste boş değil ve dosyalar var', () => {
    ASAMA1.forEach((f) => expect(fs.existsSync(path.join(KOK, f))).toBe(true));
  });
  test('işaretsiz sayı yazımı yok', () => {
    const s = ASAMA1.flatMap(T.sapmalar).map((x) => x.dosya + ':' + x.satir + ' ' + x.metin);
    expect(s).toEqual([]);
  });
  test('eksen ve ipucu yazıcıları (graphics.js + görüntüleyici kopyası) veSayi\'den geçiyor', () => {
    for (const f of ['js/graphics.js', 'viewer/js/board.js']) {
      const s = oku(f);
      for (const ad of ['veFormatTooltipVal', 'veFormatAxisVal']) {
        const i = s.indexOf('function ' + ad + '(');
        const govde = s.slice(i, s.indexOf('\n}\n', i));
        expect([f, ad, T.tara(govde, f).length]).toEqual([f, ad, 0]);
        expect([f, ad, /veSayi\(/.test(govde)]).toEqual([f, ad, true]);
      }
    }
  });
  test('yazıcı yükleyiciden ÖNCE yüklenir (MFSim) ve görüntüleyici onu birebir taşır', () => {
    const html = oku('index.html');
    expect(html.indexOf('src="js/sayi.js"')).toBeGreaterThan(-1);
    expect(html.indexOf('src="js/sayi.js"')).toBeLessThan(html.indexOf('src="js/loader.js"'));
    expect(oku('viewer/js/sayi.js')).toBe(oku('js/sayi.js'));
    const v = oku('viewer/index.html');
    expect(v.indexOf('src="js/sayi.js"')).toBeLessThan(v.indexOf('src="js/board.js"'));
  });
});
