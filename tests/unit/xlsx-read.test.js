/**
 * js/xlsx-read.js — xlsx/CSV okuyucu
 *
 * Neden bu testler yüksek değerli: burası sayısal çekirdek sayılır. Sıkıştırma
 * çözücüsü ya da hücre yerleşimi sessizce bozulursa sonuç "makul ama yanlış"
 * bir eğri olur — gözle yakalanmaz. Bu yüzden:
 *   • inflate, Node'un zlib'ine karşı BAYT BAYT karşılaştırılır (referans uygulama),
 *   • .xlsx fixture'ları testin İÇİNDE gerçek ZIP baytları olarak üretilir,
 *     dosya eklenmez — okuyucu gerçek bir kabı çözmek zorunda kalır.
 *
 * NOT: jsdom'da TextDecoder YOKTUR; veXlsUtf8 burada elle yazılmış yolu
 * kullanır. UTF-8 testleri bu yüzden gerçekten o yolu sınar.
 */

const zlib = require('zlib');
const X = require('../../js/xlsx-read.js');

// ── ZIP yazıcı (fixture üretimi) ──────────────────────────────────────────
// Okuyucudan BAĞIMSIZ yazılmıştır: aynı hatayı iki tarafta birden yapıp
// testin yeşil kalmasını engellemek için kasıtlı olarak elle kurulmuştur.

const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

/** files: { name: string|Buffer }, method: 0 (saklanan) | 8 (deflate) */
function zipBuild(files, method = 8) {
  const names = Object.keys(files);
  const locals = [];
  const central = [];
  let offset = 0;

  for (const name of names) {
    const raw = Buffer.isBuffer(files[name]) ? files[name] : Buffer.from(files[name], 'utf8');
    const data = method === 8 ? zlib.deflateRawSync(raw) : raw;
    const nameBuf = Buffer.from(name, 'utf8');

    const lh = Buffer.alloc(30);
    lh.writeUInt32LE(0x04034b50, 0);
    lh.writeUInt16LE(20, 4);
    lh.writeUInt16LE(0, 6);
    lh.writeUInt16LE(method, 8);
    lh.writeUInt32LE(crc32(raw), 14);
    lh.writeUInt32LE(data.length, 18);
    lh.writeUInt32LE(raw.length, 22);
    lh.writeUInt16LE(nameBuf.length, 26);
    lh.writeUInt16LE(0, 28);
    locals.push(lh, nameBuf, data);

    const ch = Buffer.alloc(46);
    ch.writeUInt32LE(0x02014b50, 0);
    ch.writeUInt16LE(20, 4);
    ch.writeUInt16LE(20, 6);
    ch.writeUInt16LE(method, 10);
    ch.writeUInt32LE(crc32(raw), 16);
    ch.writeUInt32LE(data.length, 20);
    ch.writeUInt32LE(raw.length, 24);
    ch.writeUInt16LE(nameBuf.length, 28);
    ch.writeUInt32LE(offset, 42);
    central.push(ch, nameBuf);

    offset += 30 + nameBuf.length + data.length;
  }

  const cd = Buffer.concat(central);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(names.length, 8);
  eocd.writeUInt16LE(names.length, 10);
  eocd.writeUInt32LE(cd.length, 12);
  eocd.writeUInt32LE(offset, 16);

  return new Uint8Array(Buffer.concat([...locals, cd, eocd]));
}

// ── xlsx fixture kurucusu ─────────────────────────────────────────────────

const NS = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';

function xlsxBuild({ sheetXml, shared = null, styles = null, sheetNames = ['Measurement'] }) {
  const sheets = sheetNames
    .map((n, i) => `<sheet name="${n}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`)
    .join('');
  const rels = sheetNames
    .map((n, i) => `<Relationship Id="rId${i + 1}" Type="ws" Target="worksheets/sheet${i + 1}.xml"/>`)
    .join('');

  const files = {
    'xl/workbook.xml':
      `<?xml version="1.0"?><workbook xmlns="${NS}" ` +
      `xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">` +
      `<sheets>${sheets}</sheets></workbook>`,
    'xl/_rels/workbook.xml.rels':
      `<?xml version="1.0"?><Relationships>${rels}</Relationships>`,
    'xl/worksheets/sheet1.xml':
      `<?xml version="1.0"?><worksheet xmlns="${NS}"><sheetData>${sheetXml}</sheetData></worksheet>`,
  };
  sheetNames.slice(1).forEach((n, i) => {
    files[`xl/worksheets/sheet${i + 2}.xml`] =
      `<?xml version="1.0"?><worksheet xmlns="${NS}"><sheetData></sheetData></worksheet>`;
  });
  if (shared) {
    files['xl/sharedStrings.xml'] =
      `<?xml version="1.0"?><sst xmlns="${NS}" count="${shared.length}" uniqueCount="${shared.length}">` +
      shared.map((s) => `<si><t>${s}</t></si>`).join('') +
      `</sst>`;
  }
  if (styles) files['xl/styles.xml'] = styles;
  return zipBuild(files);
}

// ═══════════════════════════════════════════════════════════════════════════

describe('veXlsInflateRaw — zlib referansına karşı', () => {
  const cases = {
    'boş': Buffer.alloc(0),
    'tek bayt': Buffer.from([0x42]),
    'sıfırlar': Buffer.alloc(4096),
    'ölçüm başlığı tekrarı': Buffer.from('Time;EngSpeed;VehSpeed\n'.repeat(500)),
    // distance < length: geri başvuru kendi yazdığı baytları okur. Kopyayı
    // toplu yapan bir uygulama burada sessizce bozulur.
    'örtüşen geri başvuru': Buffer.from('ab'.repeat(8000)),
    'sıkıştırılamaz': require('crypto').randomBytes(60000),
    'türkçe utf8': Buffer.from('Motor Devri [d/dk] — Hız (km/sa) ölçümü\n'.repeat(400), 'utf8'),
  };

  // level 0 → saklanan blok, Z_FIXED → sabit Huffman, geri kalanı dinamik.
  const levels = [0, 1, 6, 9];
  const strategies = [
    zlib.constants.Z_DEFAULT_STRATEGY,
    zlib.constants.Z_FIXED,
    zlib.constants.Z_HUFFMAN_ONLY,
    zlib.constants.Z_RLE,
  ];

  for (const [name, buf] of Object.entries(cases)) {
    test(`${name} — tüm seviye/strateji kombinasyonları`, () => {
      for (const level of levels) {
        for (const strategy of strategies) {
          const comp = zlib.deflateRawSync(buf, { level, strategy });
          const got = Buffer.from(X.veXlsInflateRaw(new Uint8Array(comp)));
          expect(got.equals(buf)).toBe(true);
        }
      }
    });
  }

  test('bozuk akış sessizce yanlış veri döndürmez, hata fırlatır', () => {
    const comp = zlib.deflateRawSync(Buffer.from('x'.repeat(5000)));
    // Ortadan kırpılmış akış: çözücü veri bitmeden sembol bekler.
    expect(() => X.veXlsInflateRaw(new Uint8Array(comp.subarray(0, 5)))).toThrow();
  });
});

describe('veXlsZipRead', () => {
  test('deflate ve saklanan girişleri aynı içeriği verir', () => {
    const files = { 'a.txt': 'merhaba dünya', 'dir/b.bin': Buffer.from([1, 2, 3, 255]) };
    for (const method of [0, 8]) {
      const zip = X.veXlsZipRead(zipBuild(files, method));
      expect(zip.has('a.txt')).toBe(true);
      expect(X.veXlsUtf8(zip.read('a.txt'))).toBe('merhaba dünya');
      expect(Array.from(zip.read('dir/b.bin'))).toEqual([1, 2, 3, 255]);
    }
  });

  test('.xlsx olmayan dosya anlaşılır hata verir', () => {
    expect(() => X.veXlsZipRead(new Uint8Array(100))).toThrow(/EOCD|bulunamadı/);
  });

  test('olmayan giriş adı hata verir', () => {
    const zip = X.veXlsZipRead(zipBuild({ 'a.txt': 'x' }));
    expect(() => zip.read('yok.txt')).toThrow(/giriş yok/);
  });
});

describe('veXlsUtf8 (jsdom: elle yazılmış yol)', () => {
  test('çok baytlı ve vekil çift (surrogate) karakterler', () => {
    const s = 'Şanzıman ölçümü — 25 °C, güç 120 kW 🚚 sonu';
    expect(X.veXlsUtf8(new Uint8Array(Buffer.from(s, 'utf8')))).toBe(s);
  });

  test('parça sınırını aşan uzun metin bozulmaz', () => {
    // İç tampon 4096 karakterde boşaltılıyor — sınırda karakter kaybı olmamalı.
    const s = 'ğüşiöçĞÜŞİÖÇ'.repeat(2000);
    expect(X.veXlsUtf8(new Uint8Array(Buffer.from(s, 'utf8')))).toBe(s);
  });
});

describe('XML yardımcıları', () => {
  test('veXlsColIndex sütun harfini indekse çevirir', () => {
    expect(X.veXlsColIndex('A1')).toBe(0);
    expect(X.veXlsColIndex('Z9')).toBe(25);
    expect(X.veXlsColIndex('AA1')).toBe(26);
    expect(X.veXlsColIndex('BC12')).toBe(54);
  });

  test('veXlsUnescape varlıkları çözer', () => {
    expect(X.veXlsUnescape('a &amp; b &lt;c&gt; &quot;d&quot; &#65; &#x42;')).toBe('a & b <c> "d" A B');
  });

  test('veXlsAttr tek ve çift tırnağı okur, benzer adla karışmaz', () => {
    expect(X.veXlsAttr(' r="B7" t="s"', 'r')).toBe('B7');
    expect(X.veXlsAttr(" name='Ölçüm'", 'name')).toBe('Ölçüm');
    // sheetId, id ile karıştırılmamalı
    expect(X.veXlsAttr(' sheetId="3" r:id="rId9"', 'r:id')).toBe('rId9');
  });

  test('veXlsSharedStrings zengin metin parçalarını birleştirir', () => {
    const xml = `<sst><si><t>Zaman</t></si><si><r><t>Eng</t></r><r><t>Speed</t></r></si><si/></sst>`;
    expect(X.veXlsSharedStrings(xml)).toEqual(['Zaman', 'EngSpeed', '']);
  });

  test('veXlsDateStyles tarih biçimli stilleri ayırt eder', () => {
    const styles =
      `<styleSheet><numFmts>` +
      `<numFmt numFmtId="166" formatCode="hh:mm:ss.000"/>` +
      // "0.000" sayı biçimi — 's' harfi içermiyor, tarih SAYILMAMALI
      `<numFmt numFmtId="167" formatCode="0.000"/>` +
      // Tırnaklı metin içindeki harf tarih sanılmamalı
      `<numFmt numFmtId="168" formatCode="0.0&quot; sn&quot;"/>` +
      `</numFmts><cellXfs>` +
      `<xf numFmtId="0"/><xf numFmtId="166"/><xf numFmtId="167"/><xf numFmtId="14"/><xf numFmtId="168"/>` +
      `</cellXfs></styleSheet>`;
    const d = X.veXlsDateStyles(styles);
    expect(d[0]).toBe(false);   // genel
    expect(d[1]).toBe(true);    // özel saat biçimi
    expect(d[2]).toBe(false);   // ondalık sayı
    expect(d[3]).toBe(true);    // yerleşik tarih (14)
    expect(d[4]).toBe(false);   // tırnak içi metin
  });
});

describe('veXlsParseSheet', () => {
  test('seyrek hücreler r= başvurusuna göre doğru sütuna oturur', () => {
    // CANoe seyrek örneklemesi: satırda yalnızca DEĞİŞEN sinyalin hücresi var.
    const xml =
      `<row r="1"><c r="A1" t="s"><v>0</v></c><c r="C1" t="s"><v>1</v></c></row>` +
      `<row r="2"><c r="A2"><v>0</v></c><c r="C2"><v>800</v></c></row>` +
      `<row r="3"><c r="A3"><v>0.01</v></c></row>` +
      `<row r="4"><c r="A4"><v>0.02</v></c><c r="B4"><v>5</v></c></row>`;
    const r = X.veXlsParseSheet(xml, ['Time', 'EngSpeed'], {});
    expect(r.rows).toEqual([
      ['Time', null, 'EngSpeed'],
      [0, null, 800],
      [0.01, null, null],
      [0.02, 5, null],
    ]);
  });

  test('boş hücre null kalır — sıfıra çevrilmez', () => {
    // Sıfır geçerli bir ölçüm değeri; boşlukla karışırsa eğri tabana yapışır.
    const r = X.veXlsParseSheet(`<row r="1"><c r="A1"><v>0</v></c><c r="B1"/></row>`, [], {});
    expect(r.rows[0][0]).toBe(0);
    expect(r.rows[0][1]).toBe(null);
  });

  test('hücre tipleri: paylaşılan/satır-içi metin, mantıksal, hata, formül metni', () => {
    const xml =
      `<row r="1">` +
      `<c r="A1" t="s"><v>1</v></c>` +
      `<c r="B1" t="inlineStr"><is><t>Satır içi</t></is></c>` +
      `<c r="C1" t="b"><v>1</v></c>` +
      `<c r="D1" t="e"><v>#N/A</v></c>` +
      `<c r="E1" t="str"><v>hesap</v></c>` +
      `<c r="F1"><v>-12.5</v></c>` +
      `</row>`;
    const r = X.veXlsParseSheet(xml, ['sıfır', 'bir'], {});
    expect(r.rows[0]).toEqual(['bir', 'Satır içi', true, null, 'hesap', -12.5]);
  });

  test('tarih biçimli sayısal sütun dateCols ile bildirilir', () => {
    const xml = `<row r="1"><c r="A1" s="1"><v>45000.5</v></c><c r="B1" s="0"><v>3</v></c></row>`;
    const r = X.veXlsParseSheet(xml, [], { 1: true });
    expect(r.dateCols).toEqual({ 0: true });
  });

  test('ad alanı önekli (<x:row>) sayfa da okunur', () => {
    const xml = `<x:row r="1"><x:c r="A1"><x:v>7</x:v></x:c></x:row>`;
    expect(X.veXlsParseSheet(xml, [], {}).rows).toEqual([[7]]);
  });

  test('maxRows önizleme için satır sayısını sınırlar ve bunu bildirir', () => {
    const xml = Array.from({ length: 50 }, (_, i) => `<row r="${i + 1}"><c r="A${i + 1}"><v>${i}</v></c></row>`).join('');
    const r = X.veXlsParseSheet(xml, [], {}, 10);
    expect(r.rows.length).toBe(10);
    expect(r.truncated).toBe(true);
  });

  test('satırlar eşit genişliğe tamamlanır', () => {
    const xml = `<row r="1"><c r="A1"><v>1</v></c></row><row r="2"><c r="A2"><v>2</v></c><c r="D2"><v>9</v></c></row>`;
    const r = X.veXlsParseSheet(xml, [], {});
    expect(r.rows[0].length).toBe(4);
    expect(r.rows[0]).toEqual([1, null, null, null]);
  });
});

describe('veXlsOpen — uçtan uca gerçek .xlsx baytları', () => {
  test('CANoe tarzı sayfa: üstte üstbilgi satırları, sonra başlık ve veri', () => {
    const shared = ['Measurement:', 'Testfahrt', 'Time', 'EngineData::EngSpeed', 'Motor Sıcaklığı'];
    const xml =
      `<row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c></row>` +
      `<row r="2"><c r="A2" t="s"><v>2</v></c><c r="B2" t="s"><v>3</v></c><c r="C2" t="s"><v>4</v></c></row>` +
      `<row r="3"><c r="A3"><v>0</v></c><c r="B3"><v>800</v></c><c r="C3"><v>21.5</v></c></row>` +
      `<row r="4"><c r="A4"><v>0.01</v></c><c r="B4"><v>812.25</v></c><c r="C4"><v>21.6</v></c></row>`;
    const wb = X.veXlsOpen(xlsxBuild({ sheetXml: xml, shared, sheetNames: ['Measurement', 'Info'] }));

    expect(wb.sheets.map((s) => s.name)).toEqual(['Measurement', 'Info']);

    const sh = wb.readSheet(0);
    expect(sh.name).toBe('Measurement');
    expect(sh.rows[1]).toEqual(['Time', 'EngineData::EngSpeed', 'Motor Sıcaklığı']);
    expect(sh.rows[2]).toEqual([0, 800, 21.5]);
    expect(sh.rows[3]).toEqual([0.01, 812.25, 21.6]);
  });

  test('ArrayBuffer girdisi de kabul edilir', () => {
    const bytes = xlsxBuild({ sheetXml: `<row r="1"><c r="A1"><v>5</v></c></row>` });
    const ab = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
    expect(X.veXlsOpen(ab).readSheet(0).rows).toEqual([[5]]);
  });

  test('sharedStrings/styles olmayan kitap da açılır', () => {
    const wb = X.veXlsOpen(xlsxBuild({ sheetXml: `<row r="1"><c r="A1" t="inlineStr"><is><t>Zaman</t></is></c></row>` }));
    expect(wb.readSheet(0).rows).toEqual([['Zaman']]);
  });

  test('Excel olmayan zip anlaşılır hata verir', () => {
    expect(() => X.veXlsOpen(zipBuild({ 'okuma.txt': 'merhaba' }))).toThrow(/Excel çalışma kitabı değil/);
  });
});

describe('CSV', () => {
  test('ondalık virgüllü Avrupa dışa aktarımında ayraç noktalı virgül seçilir', () => {
    // Virgülü ayraç sanmak her sayıyı ikiye bölerdi — sniff bunu önlemeli.
    const text = 'Time;EngSpeed;VehSpeed\n0,00;800,5;0,0\n0,01;812,25;0,4\n';
    expect(X.veXlsSniffDelimiter(text)).toBe(';');
    const r = X.veXlsCsvParse(text);
    expect(r.delimiter).toBe(';');
    expect(r.rows[1]).toEqual(['0,00', '800,5', '0,0']);
  });

  test('sekme ve virgül ayraçları da tanınır', () => {
    expect(X.veXlsSniffDelimiter('a\tb\tc\n1\t2\t3\n')).toBe('\t');
    expect(X.veXlsSniffDelimiter('a,b,c\n1,2,3\n')).toBe(',');
  });

  test('tırnaklı alanlar: gömülü ayraç, satır sonu ve çift tırnak', () => {
    const r = X.veXlsCsvParse('a,"b,1","iki\nsatır","tır""nak"\n');
    expect(r.rows[0]).toEqual(['a', 'b,1', 'iki\nsatır', 'tır"nak']);
  });

  test('BOM atılır ve CRLF satır sonu çalışır', () => {
    const r = X.veXlsCsvParse('﻿Time,V\r\n0,1\r\n');
    expect(r.rows[0]).toEqual(['Time', 'V']);
    expect(r.rows[1]).toEqual(['0', '1']);
  });

  test('eksik hücreli satırlar eşit genişliğe tamamlanır', () => {
    const r = X.veXlsCsvParse('a,b,c\n1,2\n');
    expect(r.rows[1]).toEqual(['1', '2', '']);
  });
});

describe('veXlsSniffDelimiter — ayracı içermeyen satırlar adayı ELEMEZ', () => {
  // Gerçek hata: CANoe dosyasının üstünde tek hücrelik bir başlık satırı
  // varsa ';' adayı ilk satırda hiç geçmediği için tamamen düşüyor, ayraç ','
  // seçiliyor ve ondalık virgüller sütun sınırı sanılıyordu:
  // "0,0046;798,625;0,0" → ["0","0046;798","625;0","0"]. Hata vermiyordu.
  const withTitle =
    'CANoe Messung Testfahrt\n' +
    'Time;EngSpeed;VehSpeed\n' +
    '0,0046;798,625;0,0\n' +
    '0,0146;799,125;0,1\n' +
    '0,0246;800,250;0,2\n';

  test('üstteki tek hücrelik başlık ayraç seçimini bozmaz', () => {
    expect(X.veXlsSniffDelimiter(withTitle)).toBe(';');
  });

  test('ondalık virgüller sütuna bölünmez', () => {
    const out = X.veXlsCsvParse(withTitle);
    expect(out.delimiter).toBe(';');
    expect(out.rows[2]).toEqual(['0,0046', '798,625', '0,0']);
  });

  test('gerçekten virgüllü dosya hâlâ virgülle okunur', () => {
    const csv = 'Time,EngSpeed,VehSpeed\n0.0,798.6,0.0\n0.1,799.1,0.4\n';
    expect(X.veXlsSniffDelimiter(csv)).toBe(',');
  });

  test('sekmeli dosya tanınır', () => {
    const tsv = 'Rapor\nTime\tRPM\n0.0\t800\n0.1\t812\n';
    expect(X.veXlsSniffDelimiter(tsv)).toBe('\t');
  });
});

describe('veXlsSniffDelimiter — ondalık ayırıcı ayraç sanılmaz', () => {
  // Başlık satırı olmayan Avrupa biçimli dosyada her satırda 10 ';' ve 11
  // ondalık ',' var; ikisi de %100 tutarlı. Alan sayısı eşitlik bozucu olsaydı
  // ',' bir puanla kazanır ve "0,004600;798,625000" → ["0","004600;798", …]
  // olurdu: zaman ekseni tam saniyeye yuvarlanır, tüm sinyaller metne döner.
  const headless =
    '0,004600;798,625000;21,000000\n' +
    '0,009380;798,625000;21,000000\n' +
    '0,011870;799,125000;21,000000\n' +
    '0,014600;800,250000;22,000000\n';

  test('başlıksız Avrupa dosyasında ayraç noktalı virgüldür', () => {
    expect(X.veXlsSniffDelimiter(headless)).toBe(';');
  });

  test('sayılar ikiye bölünmez', () => {
    expect(X.veXlsCsvParse(headless).rows[0]).toEqual(['0,004600', '798,625000', '21,000000']);
  });

  test('başlıksız gerçek virgüllü dosya hâlâ virgülle okunur', () => {
    const us = '0.0,798.6,0.0\n0.1,799.1,0.4\n0.2,800.2,0.9\n';
    expect(X.veXlsSniffDelimiter(us)).toBe(',');
    expect(X.veXlsCsvParse(us).rows[0]).toEqual(['0.0', '798.6', '0.0']);
  });

  test('tam sayılı noktalı virgüllü dosya (ondalık ipucu yok)', () => {
    expect(X.veXlsSniffDelimiter('a;b;c\n1;2;3\n4;5;6\n')).toBe(';');
  });

  test('boru ayraçlı dosya', () => {
    expect(X.veXlsSniffDelimiter('Time|RPM\n0.0|800\n0.1|812\n')).toBe('|');
  });
});

describe('veXlsCsvParse — alan ORTASINDAKİ tırnak alan açmaz', () => {
  // RFC 4180: tırnak yalnızca alan başında alan açar. Eskiden ortadaki tek bir
  // " tırnak açıyor, sonraki ayraçlar VE SATIR SONLARI alan içi sayılıyordu:
  // 3" boru gibi tek bir hücre dosyanın kalanını tek hücreye yığıyordu.
  test('inç işareti satırları yutmaz', () => {
    const r = X.veXlsCsvParse('a,b\n3" boru,5\nx,y\n');
    expect(r.rows).toEqual([['a', 'b'], ['3" boru', '5'], ['x', 'y']]);
  });

  test('gerçek tırnaklı alan hâlâ çalışır (içinde ayraç dahil)', () => {
    const r = X.veXlsCsvParse('a,b\n"1,5",2\nx,y\n');
    expect(r.rows).toEqual([['a', 'b'], ['1,5', '2'], ['x', 'y']]);
  });

  test('tırnak içi satır sonu korunur', () => {
    const r = X.veXlsCsvParse('a,b\n"iki\nsatır",2\n');
    expect(r.rows[1]).toEqual(['iki\nsatır', '2']);
  });
});

describe('veXlsSniffDelimiter — tek sütunlu dosya bölünmez', () => {
  // Ondalık virgüllü tek sütunlu dosyada ',' seçilirse her satır ikiye
  // ayrılırdı: "0,0046" → ["0","0046"].
  test('ondalık virgüllü tek sütun', () => {
    const one = 'Time\n0,0046\n0,0093\n0,0118\n';
    expect(X.veXlsCsvParse(one).rows.every((r) => r.length === 1)).toBe(true);
  });

  test('ondalık noktalı tek sütun', () => {
    const one = 'Time\n0.0046\n0.0093\n';
    expect(X.veXlsCsvParse(one).rows.every((r) => r.length === 1)).toBe(true);
  });

  test('Avrupa biçimli sekmeli dosyada ayraç sekmedir', () => {
    const tsv = 'Time\tRPM\n0,0046\t798,625\n0,0093\t799,125\n';
    expect(X.veXlsSniffDelimiter(tsv)).toBe('\t');
    expect(X.veXlsCsvParse(tsv).rows[1]).toEqual(['0,0046', '798,625']);
  });

  test('veto tek adaylı düzgün dosyayı bölünmeden bırakmaz', () => {
    // "1,2" ondalık gibi görünse de ',' burada tek adaydır: elenirse dosya
    // hiç bölünmezdi.
    expect(X.veXlsCsvParse('a,b,c\n1,2\n').rows[1]).toEqual(['1', '2', '']);
  });
});

describe('veXlsDecodeText — kodlama tespiti', () => {
  // Excel'in "Unicode Metin" dışa aktarması UTF-16 üretiyor; koşulsuz UTF-8
  // çözümü her karakterin arasına NUL serpilmiş çöp metin veriyordu.
  function utf16(str, little, bom) {
    const b = [];
    if (bom) b.push(little ? 0xff : 0xfe, little ? 0xfe : 0xff);
    for (const ch of str) {
      const k = ch.charCodeAt(0);
      b.push(little ? (k & 255) : (k >> 8), little ? (k >> 8) : (k & 255));
    }
    return Uint8Array.from(b);
  }
  const sample = 'Time;RPM\n0,0046;798,625\n';

  test('UTF-16LE (BOM ile)', () => {
    expect(X.veXlsDecodeText(utf16(sample, true, true))).toBe(sample);
  });

  test('UTF-16BE (BOM ile)', () => {
    expect(X.veXlsDecodeText(utf16(sample, false, true))).toBe(sample);
  });

  test('UTF-16LE (BOM olmadan — NUL örüntüsünden anlaşılır)', () => {
    expect(X.veXlsDecodeText(utf16(sample, true, false))).toBe(sample);
  });

  test('UTF-8 Türkçe karakterlerle bozulmadan geçer', () => {
    const t = 'Zaman;Sıcaklık;Ölçüm\n0,5;21,3;çalışıyor\n';
    const bytes = Uint8Array.from(Buffer.from(t, 'utf8'));
    expect(X.veXlsDecodeText(bytes)).toBe(t);
  });
});
