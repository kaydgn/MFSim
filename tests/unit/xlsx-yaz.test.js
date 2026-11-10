/**
 * @jest-environment jsdom
 */
// XLSX YAZICI (js/xlsx-yaz.js) — Takoz · Parametrik Analiz'in Excel çıktısının dosya katmanı.
// Kapılar: (1) her parça iyi biçimli XML, (2) programın kendi okuyucusu (xlsx-read.js)
// dosyayı açıp aynı değerleri okur, (3) ZIP'in CRC'si ve dizini doğru, (4) stil,
// birleşik hücre, bağlantı, not, gizli satır/sütun ve ızgara Excel'in beklediği yerde.
const X = require('../../js/xlsx-yaz.js');
const R = require('../../js/xlsx-read.js');

const KITAP = {
  sayfalar: [
    {
      ad: 'Özet', izgara: false, gizle: true, yakin: 85,
      sutun: { 2: 5, 3: 30, 4: 12 }, satir: { 2: 24, 4: 48 },
      hucre: [
        [2, 2, 'Başlık & <özel> "karakter"', { b: true, boy: 14, yatay: 'left' }],
        [4, 2, 'K', { b: true, kenar: true, yatay: 'center', sar: true }],
        [4, 3, 'Uygunluk', { b: true, kenar: true }],
        [5, 2, 'K0', { renk: '0563C1', alt: true, kenar: true }],
        [5, 3, 'En uygun', { b: true, renk: 'FFFFFF', dolgu: '1F7A3D', kenar: true }],
        [5, 4, 3.14159, { bicim: '0.00', kenar: true }],
        [6, 4, -0.4885, { bicim: '0.000', kenar: true }],
        [7, 4, 1153.2, { bicim: '#,##0', kenar: true }],
        [8, 4, '', { kenar: true }]
      ],
      birlesik: ['C9:D9'],
      bag: [[5, 2, 'K0 Mevcut', 'A1']],
      not: [[4, 3, 'Satır 1\nSatır 2', 330, 90]]
    },
    { ad: 'K0 Mevcut', hucre: [[1, 1, 'Durum'], [2, 1, 'Static'], [2, 2, -2.554]], filtre: 'A1:B2' }
  ]
};

function parca(F, ad) { const f = F.find((x) => x[0] === ad); return f ? f[1] : null; }

describe('XLSX YAZICI — parçalar', () => {
  const F = X.dosyalar(KITAP);

  test('her parça iyi biçimli XML (VML dâhil)', () => {
    F.forEach(([ad, metin]) => {
      const d = new DOMParser().parseFromString(metin, 'application/xml');
      expect([ad, d.getElementsByTagName('parsererror').length]).toEqual([ad, 0]);
    });
  });

  test('içerik türleri her sayfayı ve notu listeler', () => {
    const ct = parca(F, '[Content_Types].xml');
    expect(ct).toContain('/xl/worksheets/sheet1.xml');
    expect(ct).toContain('/xl/worksheets/sheet2.xml');
    expect(ct).toContain('/xl/comments1.xml');
    expect(ct).toContain('Extension="vml"');
  });

  test('ızgara kapalı, yakınlık, gizli satır ve gizli sütunlar', () => {
    const s = parca(F, 'xl/worksheets/sheet1.xml');
    expect(s).toContain('showGridLines="0"');
    expect(s).toContain('zoomScale="85"');
    expect(s).toContain('zeroHeight="1"');
    // içerik D sütununda biter: E görünür kenar, F'den sonrası gizli
    expect(s).toMatch(/<col min="6" max="16384"[^>]*hidden="1"/);
    // içeriğin son satırı 9 (birleşik C9:D9): 10. satır görünür, hepsi yükseklikli
    expect(s).toMatch(/<row r="10" ht="15" customHeight="1"\/>/);
    expect(s).not.toMatch(/<row r="11"/);
    expect(s).toMatch(/<row r="2" ht="24" customHeight="1">/);
  });

  test('bağlantı sayfa içi (location), not legacyDrawing ile', () => {
    const s = parca(F, 'xl/worksheets/sheet1.xml');
    expect(s).toContain('<hyperlink ref="B5" location="\'K0 Mevcut\'!A1"/>');
    expect(s).toContain('<legacyDrawing r:id="rId2"/>');
    expect(parca(F, 'xl/worksheets/_rels/sheet1.xml.rels')).toContain('../comments1.xml');
    expect(parca(F, 'xl/comments1.xml')).toContain('<comment ref="C4"');
    expect(parca(F, 'xl/drawings/vmlDrawing1.vml')).toContain('<x:Row>3</x:Row><x:Column>2</x:Column>');
  });

  test('stiller: dolgu, yazı rengi, altı çizili, sayı biçimi, kenarlık', () => {
    const st = parca(F, 'xl/styles.xml');
    expect(st).toContain('<fgColor rgb="FF1F7A3D"/>');
    expect(st).toContain('<color rgb="FFFFFFFF"/>');
    expect(st).toMatch(/<font><u\/><sz val="11"\/><color rgb="FF0563C1"\/>/);
    expect(st).toContain('formatCode="0.000"');
    expect(st).toContain('<left style="thin">');
    expect(st).toContain('<patternFill patternType="gray125"/>');
  });

  test('filtre ve filtrenin tanımlı adı', () => {
    expect(parca(F, 'xl/worksheets/sheet2.xml')).toContain('<autoFilter ref="A1:B2"/>');
    expect(parca(F, 'xl/workbook.xml')).toContain('localSheetId="1" hidden="1">\'K0 Mevcut\'!$A$1:$B$2</definedName>');
  });

  test('metin kaçışı ve paylaşılan metin', () => {
    const sst = parca(F, 'xl/sharedStrings.xml');
    expect(sst).toContain('Başlık &amp; &lt;özel&gt; &quot;karakter&quot;');
    expect(sst).toMatch(/uniqueCount="\d+"/);
  });

  test('sayfa adı Excel kuralına uyar: yasak karakter yok, 31 karakter, tekil', () => {
    const kul = {};
    expect(X.sayfaAdi('K1 a/b:c*?[x]', kul)).toBe('K1 a b c   x');
    expect(X.sayfaAdi('x'.repeat(40), kul)).toHaveLength(31);
    const k2 = {};
    expect(X.sayfaAdi('Özet', k2)).toBe('Özet');
    expect(X.sayfaAdi('ÖZET', k2)).toBe('ÖZET (2)');
  });
});

describe('XLSX YAZICI — gidiş-dönüş (programın okuyucusu)', () => {
  const b = X.yaz(KITAP, new Date(2026, 10, 9, 12, 0, 0));

  test('ZIP: yerel başlık, merkezi dizin, CRC', () => {
    expect(Array.from(b.slice(0, 4))).toEqual([0x50, 0x4b, 0x03, 0x04]);
    const z = R.veXlsZipRead(b);
    expect(z.has('xl/workbook.xml')).toBe(true);
    const ham = z.read('xl/styles.xml');
    const crc = X.crc32(ham);
    // yerel başlıktaki CRC (14. bayt) okunan içerikle aynı: dosyanın ilk girdisi [Content_Types].xml
    const ilk = z.read('[Content_Types].xml');
    const yerel = (b[14] | (b[15] << 8) | (b[16] << 16) | (b[17] << 24)) >>> 0;
    expect(yerel).toBe(X.crc32(ilk));
    expect(crc).toBeGreaterThan(0);
  });

  test('okuyucu aynı sayfaları ve değerleri okur', () => {
    const wb = R.veXlsOpen(b);
    expect(wb.sheets.map((s) => s.name)).toEqual(['Özet', 'K0 Mevcut']);
    const s0 = wb.readSheet(0).rows;
    expect(s0[1][1]).toBe('Başlık & <özel> "karakter"');
    expect(s0[4][2]).toBe('En uygun');
    expect(s0[4][3]).toBeCloseTo(3.14159, 6);
    expect(s0[5][3]).toBeCloseTo(-0.4885, 6);
    const s1 = wb.readSheet(1).rows;
    expect(s1[1]).toEqual(['Static', -2.554]);
  });

  test('UTF-8: Türkçe ve simge karakterleri bozulmaz', () => {
    const k = { sayfalar: [{ ad: 'Ş', hucre: [[1, 1, 'ğüşıöç ĞÜŞİÖÇ ← → ✓ ✗ ±%20 √ ζ ² ·']] }] };
    const wb = R.veXlsOpen(X.yaz(k));
    expect(wb.readSheet(0).rows[0][0]).toBe('ğüşıöç ĞÜŞİÖÇ ← → ✓ ✗ ±%20 √ ζ ² ·');
  });

  test('sayı olmayan sayı (NaN, ∞) boş hücre olur, dosya bozulmaz', () => {
    const k = { sayfalar: [{ ad: 'A', hucre: [[1, 1, NaN, { kenar: true }], [1, 2, Infinity], [1, 3, 5]] }] };
    const wb = R.veXlsOpen(X.yaz(k));
    expect(wb.readSheet(0).rows[0]).toEqual([null, null, 5]);
  });

  test('sıkıştırmalı yol (CompressionStream yoksa sıkıştırmasız) aynı içeriği verir', async () => {
    const b2 = await X.yazSikistir(KITAP, new Date(2026, 10, 9, 12, 0, 0));
    const wb = R.veXlsOpen(b2);
    expect(wb.readSheet(0).rows[4][2]).toBe('En uygun');
  });
});

// FORMÜL · GİZLİ SAYFA · AKIŞ (2026-11-10): Sonuç sayfasının panosu Veri'yi formülle
// okur; Veri gizli ve satırları istendikçe üretilir (13.824 kombinasyon).
describe('XLSX YAZICI — formül, gizli sayfa, akış', () => {
  const K2 = {
    sayfalar: [
      { ad: 'Sonuç', hucre: [
        [1, 1, { f: 'IF(ISNUMBER(B1),B1,2)', v: 2 }],
        [2, 1, { f: 'IFERROR(INDEX(\'Veri\'!$B$1:$B$3,A1),"")', v: 'ikinci "tip"' }],
        [3, 1, { f: 'SUM(\'Veri\'!$A$1:$A$3)', v: 6, dizi: true }, { kenar: true }],
        [4, 1, { f: 'B9', v: null }]
      ] },
      { ad: 'Veri', gizli: true, akis: { n: 3, satir: (i) => [i + 1, ['bir', 'ikinci "tip"', 'üç'][i], null, '12;-3;'] } }
    ]
  };
  const F = X.dosyalar(K2);
  const s1 = parca(F, 'xl/worksheets/sheet1.xml'), s2 = parca(F, 'xl/worksheets/sheet2.xml'), wb = parca(F, 'xl/workbook.xml');

  test('formül önbellek değeriyle; metin sonucu t="str"; dizi formülü t="array"', () => {
    expect(s1).toContain('<c r="A1"><f>IF(ISNUMBER(B1),B1,2)</f><v>2</v></c>');
    expect(s1).toContain('t="str"><f>IFERROR(INDEX(\'Veri\'!$B$1:$B$3,A1),&quot;&quot;)</f><v>ikinci &quot;tip&quot;</v></c>');
    expect(s1).toMatch(/<c r="A3" s="\d+"><f t="array" ref="A3">SUM\('Veri'!\$A\$1:\$A\$3\)<\/f><v>6<\/v><\/c>/);
    expect(s1).toContain('<c r="A4"><f>B9</f></c>');
  });

  test('gizli sayfa state="hidden"; formül varsa açılışta yeniden hesap', () => {
    expect(wb).toContain('<sheet name="Veri" sheetId="2" state="hidden" r:id="rId2"/>');
    expect(wb).toContain('<calcPr calcId="191029" fullCalcOnLoad="1"/>');
    expect(parca(X.dosyalar(KITAP), 'xl/workbook.xml')).not.toContain('calcPr');   // formülsüz kitapta yok
  });

  test('sekme çubuğu gizli kitap: workbookView showSheetTabs="0"; belirtilmezse yok', () => {
    expect(parca(X.dosyalar({ sayfalar: [{ ad: 'A', hucre: [[1, 1, 1]] }], sekmeGizli: true }), 'xl/workbook.xml'))
      .toContain('<workbookView activeTab="0" showSheetTabs="0"/>');
    expect(parca(X.dosyalar(KITAP), 'xl/workbook.xml')).toContain('<workbookView activeTab="0"/>');
  });

  test('ilk sayfa gizlenmez (Excel açılacak sekme bulamaz)', () => {
    const W = parca(X.dosyalar({ sayfalar: [{ ad: 'A', gizli: true, hucre: [[1, 1, 1]] }] }), 'xl/workbook.xml');
    expect(W).not.toContain('state="hidden"');
  });

  test('akış sayfası: satır satır, metin satır içi, boş hücre yazılmaz; iyi biçimli XML', () => {
    expect(s2).toContain('<row r="1"><c r="A1"><v>1</v></c><c r="B1" t="inlineStr"><is><t>bir</t></is></c><c r="D1" t="inlineStr"><is><t>12;-3;</t></is></c></row>');
    expect(s2).toContain('<dimension ref="A1:D3"/>');
    [s1, s2, wb].forEach((m) => expect(new DOMParser().parseFromString(m, 'application/xml').getElementsByTagName('parsererror').length).toBe(0));
  });

  test('okuyucu formülün önbellek değerini ve akış sayfasını okur', () => {
    const W = R.veXlsOpen(X.yaz(K2));
    expect(W.sheets.map((s) => s.name)).toEqual(['Sonuç', 'Veri']);
    expect(W.readSheet(0).rows.slice(0, 3).map((r) => r[0])).toEqual([2, 'ikinci "tip"', 6]);
    expect(W.readSheet(1).rows).toEqual([[1, 'bir', null, '12;-3;'], [2, 'ikinci "tip"', null, '12;-3;'], [3, 'üç', null, '12;-3;']]);
  });

  test('UTF-8: yerleşik kodlayıcı ile el yazımı aynı baytları verir', () => {
    const m = 'ğüşıöç ĞÜŞİÖÇ ← → ✓ ✗ ±%20 √ ζ ² · 𝜁';
    expect(Array.from(X.utf8(m))).toEqual(Array.from(Buffer.from(m, 'utf8')));
  });
});

// BİÇİMLİ AKIŞ (2026-11-10): Takoz Excel'inin Sonuç sayfası — her konfigürasyonun bloğu,
// milyonlarca hücre; hücreler istendikçe üretilir, birleştirme yerine centerContinuous ve
// kısmi kenarlık, bağlantı düğmenin üç hücresini kaplar, bağlantılar yazımın sonunda okunur.
describe('XLSX YAZICI — biçimli akış, kısmi kenarlık, çok hücreli bağlantı', () => {
  const KUTU = [{ b: true, kenar: 'ltb', yatay: 'centerContinuous' }, { b: true, kenar: 'tb', yatay: 'centerContinuous' },
    { b: true, kenar: 'trb', yatay: 'centerContinuous' }];
  const SAYI = { kenar: true, bicim: '0.0' };
  let baglar = null;
  const yap = () => ({ sayfalar: [
    { ad: 'Giriş', hucre: [[1, 1, { f: 'HYPERLINK("#\'Blok\'!$A$3:$A$5",1)', v: 1 }, { renk: '0563C1', alt: true }]] },
    { ad: 'Blok', izgara: false, gizle: true, sutun: { 2: 12 }, bag: () => baglar,
      akis: { n: 6, sutun: 4,
        hucre: (r) => {
          if (r === 1) baglar = [];
          if (r === 3){ baglar.push([3, 2, 'Giriş', 'A1', 4]); return [[2, 'Düğme', KUTU[0]], [3, '', KUTU[1]], [4, '', KUTU[2]]]; }
          if (r === 4) return [[2, -1.25, SAYI], [3, 'metin', SAYI]];
          return null;
        },
        ht: (r) => (r === 5 ? 409 : r === 3 ? 22 : undefined) } }
  ] });
  const F = X.dosyalar(yap()), s2 = parca(F, 'xl/worksheets/sheet2.xml'), st = parca(F, 'xl/styles.xml');

  test('satırlar istendikçe: stil, paylaşılan metin, yükseklik; gizle\'de her satır yazılı, sonrası gizli', () => {
    expect(s2).toContain('<dimension ref="A1:D6"/>');
    expect(s2).toContain('<sheetFormatPr defaultRowHeight="15" zeroHeight="1"/>');
    expect(s2).toContain('<col min="2" max="2" width="12.0000" customWidth="1"/><col min="6" max="16384" width="9.140625" hidden="1"/>');
    expect(s2).toMatch(/<row r="3" ht="22" customHeight="1"><c r="B3" s="\d+" t="s"><v>\d+<\/v><\/c><c r="C3" s="\d+"\/><c r="D3" s="\d+"\/><\/row>/);
    expect(s2).toContain('<row r="5" ht="409" customHeight="1"/>');
    expect(s2).toContain('<row r="7" ht="15" customHeight="1"/>');            // son satırdan bir sonrası görünür
    expect(s2).not.toContain('<row r="8"');
    expect(s2).not.toContain('<mergeCells');
  });

  test('bağlantı yazımın sonunda okunur ve düğmenin üç hücresini kaplar', () => {
    expect(s2).toContain('<hyperlinks><hyperlink ref="B3:D3" location="\'Giriş\'!A1"/></hyperlinks>');
    const F2 = X.dosyalar(yap());                                                 // ikinci yazım aynı (bağlantılar yeniden dolar)
    expect(F2).toEqual(F);
  });

  test('kısmi kenarlık ve centerContinuous stil tablosunda; tam kenarlık 1. sırada kalır', () => {
    expect(st).toContain('<borders count="5">');
    expect(st).toContain('<border><left style="thin"><color rgb="FF000000"/></left><right style="thin"><color rgb="FF000000"/></right><top style="thin"><color rgb="FF000000"/></top><bottom style="thin"><color rgb="FF000000"/></bottom><diagonal/></border>');
    expect(st).toContain('<border><left/><right/><top style="thin"><color rgb="FF000000"/></top><bottom style="thin"><color rgb="FF000000"/></bottom><diagonal/></border>');
    expect((st.match(/horizontal="centerContinuous"/g) || []).length).toBe(3);
    const X1 = parca(X.dosyalar(KITAP), 'xl/styles.xml');
    expect(X1).toContain('<borders count="2">');                                 // kısmi kenarlıksız kitap eskisi gibi
  });

  test('okuyucu biçimli akışı okur; iyi biçimli XML', () => {
    const W = R.veXlsOpen(X.yaz(yap()));
    expect(W.readSheet(1).rows.slice(2, 4).map((r) => r.slice(1, 4))).toEqual([['Düğme', null, null], [-1.25, 'metin', null]]);
    [s2, st].forEach((m) => expect(new DOMParser().parseFromString(m, 'application/xml').getElementsByTagName('parsererror').length).toBe(0));
  });
});

// DİLİMLİ YAZIM (2026-11-10): 13.824 satırlık kitap tek görevde 1,7 sn donduruyordu.
// is.adim() bir parça işler (sayfanın ~256 K karakterlik satırları ya da küçük bir
// dosya); tek seferlik yolla (yaz) aynı bayt, büyük sayfa çok adımda.
describe('XLSX YAZICI — dilimli yazım', () => {
  const T = new Date(2026, 10, 10, 9, 30, 0);
  const sur = (I) => { let n = 0; const oran = [I.oran()]; while (I.adim()) { n++; oran.push(I.oran()); } return { n, oran }; };
  const BUYUK = {
    sayfalar: [
      { ad: 'Özet', hucre: [[1, 1, 'Başlık'], [2, 1, { f: 'SUM(\'Veri\'!A1:A3)', v: 6 }]], not: [[1, 1, 'not', 200, 60]] },
      { ad: 'Tablo', gizle: true, hucre: Array.from({ length: 3000 }, (_, i) => [i + 1, 1 + (i % 7), 'hücre ' + (i % 13), { kenar: true }]) },
      { ad: 'Veri', gizli: true, akis: { n: 20000, satir: (i) => [i, 'tip ' + (i % 9), (i * 0.37) % 11, '12;-3;' + i + ';' + (i * 7)] } }
    ]
  };

  test('sıkıştırmasız dilimli yazım tek seferlik yazımla BAYT BAYT aynı (sıra, CRC, içerik)', async () => {
    for (const K of [KITAP, BUYUK]) {
      const I = X.is(K, { tarih: T, sikistir: false });
      sur(I);
      const b = await I.bitir();
      expect(Array.from(b)).toEqual(Array.from(X.yaz(K, T)));
    }
  });

  test('büyük sayfa çok adımda; her adımın parçası sınırlı; oran 0 → 1 ve hiç geri gitmez', () => {
    const I = X.is(BUYUK, { tarih: T, sikistir: false });
    const { n, oran } = sur(I);
    const ham = X.dosyalar(BUYUK).reduce((s, f) => s + f[1].length, 0);
    expect(n).toBeGreaterThanOrEqual(Math.ceil(ham / (1 << 18)));               // ~256 K karakterden büyük parça yok
    expect(I.bayt()).toBe(X.dosyalar(BUYUK).reduce((s, f) => s + X.utf8(f[1]).length, 0));
    expect(oran[0]).toBe(0);
    expect(oran[oran.length - 1]).toBe(1);
    for (let i = 1; i < oran.length; i++) expect(oran[i]).toBeGreaterThanOrEqual(oran[i - 1]);
  });

  test('yazım bitmeden bitir() reddedilir; bitmiş iş okunur kitap verir', async () => {
    const I = X.is(BUYUK, { tarih: T, sikistir: false });
    I.adim();
    await expect(I.bitir()).rejects.toThrow('Yazım sürüyor');
    while (I.adim());
    const W = R.veXlsOpen(await I.bitir());
    expect(W.sheets.map((s) => s.name)).toEqual(['Özet', 'Tablo', 'Veri']);
    const v = W.readSheet(2).rows;
    expect(v.length).toBe(20000);
    expect(v[19999]).toEqual([19999, 'tip 1', (19999 * 0.37) % 11, '12;-3;19999;139993']);
  });

  test('sıkıştırmalı dilimli yazım (CompressionStream, dosya başına bir akış): okuyucu aynı içeriği açar', async () => {
    const onceki = global.CompressionStream;
    global.CompressionStream = require('node:stream/web').CompressionStream;
    try {
      const I = X.is(BUYUK, { tarih: T });
      sur(I);
      const b = await I.bitir(), z = R.veXlsZipRead(b);
      expect(z.entries['xl/worksheets/sheet3.xml'].method).toBe(8);
      expect(b.length).toBeLessThan(X.yaz(BUYUK, T).length / 3);
      expect(z.names).toEqual(R.veXlsZipRead(X.yaz(BUYUK, T)).names);           // ZIP'in sırası aynı
      const W = R.veXlsOpen(b), D = R.veXlsOpen(X.yaz(BUYUK, T));
      [0, 1, 2].forEach((i) => expect(W.readSheet(i).rows).toEqual(D.readSheet(i).rows));
    } finally { global.CompressionStream = onceki; }
  });

  test('akış sayfası 20.000 satırın hepsini taşır; XML iyi biçimli', () => {
    const P = X.dosyalar(BUYUK).find((f) => f[0] === 'xl/worksheets/sheet3.xml')[1];
    const satir = P.match(/<row r="\d+">/g).length;
    expect(satir).toBe(20000);
    expect(new DOMParser().parseFromString(P, 'application/xml').getElementsByTagName('parsererror').length).toBe(0);
  });
});
