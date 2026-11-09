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
