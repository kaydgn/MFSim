/**
 * can-log.test.js — CAN Çözümleyici, kayıt biçimleri
 * ──────────────────────────────────────────────────
 * Her biçim GERÇEK bir dosyadan alınmış örnek satırlarla sınanır. Kapının
 * asıl işi iki sessiz hata sınıfını tutmak:
 *
 *   1) YANLIŞ BİÇİM SEÇİMİ — bir eşleyici başka biçimin satırını "çözerse"
 *      kimlik ve veri yer değiştirir, grafik makul ama yanlış çıkar.
 *      Bu yüzden her örnek, YALNIZ kendi biçiminde çözülmeli.
 *   2) SESSİZ ATLAMA — çözülemeyen satırın sayılması. Kayıt %60 çözülüp
 *      gerisi atılırsa kimse fark etmez; sayaç bunun için var.
 */
eval(loadCanSource('can-dbc.js'));
eval(loadCanSource('can-log.js'));

describe('cdbMatchDumpHash — candump ID#VERİ', () => {
  test('mutlak zaman damgalı standart çerçeve', () => {
    const f = cdbMatchDumpHash('(1656664830.024244) can0 123#DEADBEEF');
    expect(f.t).toBeCloseTo(1656664830.024244, 6);
    expect(f.id).toBe(0x123);
    expect(f.ext).toBe(false);
    expect(f.bytes).toEqual([0xDE, 0xAD, 0xBE, 0xEF]);
    expect(f.dlc).toBe(4);
  });

  test('uzatılmış çerçeve KİMLİK ALANI GENİŞLİĞİNDEN okunur', () => {
    // candump standardı 3, uzatılmışı 8 haneyle yazar. Değere bakmak yetmez:
    // 0x00000123 de 0x123 de aynı sayıdır, farklı çerçeve tipidir.
    const f = cdbMatchDumpHash('(001.234567) vcan0 18FF50E5#0102030405060708');
    expect(f.id).toBe(0x18FF50E5);
    expect(f.ext).toBe(true);
    expect(f.bytes).toHaveLength(8);
    const g = cdbMatchDumpHash('(1.0) can0 00000123#00');
    expect(g.id).toBe(0x123);
    expect(g.ext).toBe(true);
  });

  test('zaman damgasız satır', () => {
    const f = cdbMatchDumpHash('can0 7DF#0201000000000000');
    expect(f.t).toBe(null);
    expect(f.id).toBe(0x7DF);
    expect(f.bytes[0]).toBe(0x02);
  });

  test('CAN FD (##) — ilk hane bayraktır, veri değil', () => {
    // '##' sonrası ilk hane FD bayrağıdır ('1'); veri ondan sonra başlar.
    // Bayrağı veri sanan bir okuyucu bütün baytları bir nibble kaydırır ve
    // kayıt baştan sona yanlış çözülür.
    const f = cdbMatchDumpHash('(1.0) can0 123##10102030405060708');
    expect(f.bytes).toEqual([0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08]);
  });

  test('uzaktan çerçeve (RTR) veri taşımaz', () => {
    const f = cdbMatchDumpHash('(1.0) can0 123#R');
    expect(f.bytes).toEqual([]);
    expect(f.dlc).toBe(0);
  });

  test('tek haneli/eksik veri reddedilir — yarım bayt uydurulmaz', () => {
    expect(cdbMatchDumpHash('(1.0) can0 123#DEA')).toBe(null);
    expect(cdbMatchDumpHash('rastgele bir satir')).toBe(null);
  });
});

describe('cdbMatchDumpPretty — candump okunur biçim', () => {
  test('köşeli parantezli DLC ve boşluklu bayt', () => {
    const f = cdbMatchDumpPretty('  can0  123   [8]  DE AD BE EF 00 11 22 33');
    expect(f.id).toBe(0x123);
    expect(f.dlc).toBe(8);
    expect(f.bytes).toEqual([0xDE, 0xAD, 0xBE, 0xEF, 0x00, 0x11, 0x22, 0x33]);
  });
  test('zaman damgalı', () => {
    const f = cdbMatchDumpPretty('(1234.567890)  can1  18FEF100   [8]  01 02 03 04 05 06 07 08');
    expect(f.t).toBeCloseTo(1234.56789, 6);
    expect(f.id).toBe(0x18FEF100);
    expect(f.ext).toBe(true);
  });
});

describe('cdbMatchAsc — Vector ASC', () => {
  const ctxHex = { ascBase: 'hex' };

  test('klasik CAN satırı', () => {
    const f = cdbMatchAsc('   0.000000 1  100             Rx   d 8 01 02 03 04 05 06 07 08', ctxHex);
    expect(f.t).toBe(0);
    expect(f.id).toBe(0x100);
    expect(f.ext).toBe(false);
    expect(f.dlc).toBe(8);
    expect(f.bytes).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });

  test("kimliğin sonundaki 'x' uzatılmış çerçeve demektir", () => {
    const f = cdbMatchAsc('   0.010000 1  18FF50E5x       Rx   d 8 11 22 33 44 55 66 77 88', ctxHex);
    expect(f.id).toBe(0x18FF50E5);
    expect(f.ext).toBe(true);
  });

  test('"base dec" başlığı kimliği ONLUK okutur', () => {
    // 100 onaltılıkta 256, onlukta 100 — taban yanlış okunursa mesaj hiç
    // eşleşmez ve kayıt "bilinmeyen kimlik" dolar.
    expect(cdbMatchAsc('   0.0 1  100 Rx d 1 00', { ascBase: 'hex' }).id).toBe(0x100);
    expect(cdbMatchAsc('   0.0 1  100 Rx d 1 00', { ascBase: 'dec' }).id).toBe(100);
    expect(cdbLogContext(['date Mon Jan 1', 'base dec  timestamps absolute']).ascBase).toBe('dec');
    expect(cdbLogContext(['base hex  timestamps absolute']).ascBase).toBe('hex');
  });

  test('Tx yönü ve uzaktan çerçeve (r)', () => {
    expect(cdbMatchAsc('   1.5 1  200 Tx d 2 AA BB', ctxHex).bytes).toEqual([0xAA, 0xBB]);
    expect(cdbMatchAsc('   1.5 1  200 Rx r 0', ctxHex).bytes).toEqual([]);
  });

  test('CAN FD satırı — sembolik ad olsa da olmasa da', () => {
    const a = cdbMatchAsc('  0.010000 CANFD   1 Rx  123 MsgAdi 1 0 8 8 01 02 03 04 05 06 07 08', ctxHex);
    expect(a.id).toBe(0x123);
    expect(a.bytes).toHaveLength(8);
    const b = cdbMatchAsc('  0.020000 CANFD   1 Rx  18FF50E5x 1 0 4 4 AA BB CC DD', ctxHex);
    expect(b.id).toBe(0x18FF50E5);
    expect(b.ext).toBe(true);
    expect(b.bytes).toEqual([0xAA, 0xBB, 0xCC, 0xDD]);
  });

  test('başlık ve olay satırları gürültü sayılır', () => {
    ['date Mon Jan 1 12:00:00 2024', 'base hex  timestamps absolute',
     'internal events logged', '// version 8.0.0', ''].forEach(l => {
      expect(cdbIsNoise(l)).toBe(true);
    });
  });
});

describe('cdbMatchTrc — PEAK PCAN-Trace', () => {
  test('v1.1: numara) zaman kimlik dlc veri', () => {
    const f = cdbMatchTrc('     1)      1000.0  0018  8  01 02 03 04 05 06 07 08');
    expect(f.t).toBeCloseTo(1000.0, 6);      // ham birim ms
    expect(f.id).toBe(0x18);
    expect(f.ext).toBe(false);               // PCAN standardı DÖRT haneye doldurur
    expect(f.bytes).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });

  test('v2.x: tip ve yön sütunlu', () => {
    const f = cdbMatchTrc('     1      1000.000 DT     0300 Rx 8  11 22 33 44 55 66 77 88');
    expect(f.id).toBe(0x300);
    expect(f.bytes).toEqual([0x11, 0x22, 0x33, 0x44, 0x55, 0x66, 0x77, 0x88]);
  });

  test('veri yolu numarası ve tire sütunu kimlik sanılmaz', () => {
    const f = cdbMatchTrc('    12      2500.100 DT 1   18FEF100 Rx -  8  01 02 03 04 05 06 07 08');
    expect(f.id).toBe(0x18FEF100);
    expect(f.ext).toBe(true);
  });

  test('kısa veri: DLC kadar bayt', () => {
    const f = cdbMatchTrc('     3)      1200.5  0100  2  AA BB');
    expect(f.bytes).toEqual([0xAA, 0xBB]);
    expect(f.dlc).toBe(2);
  });

  test('yorum satırı ve başlık çözülmez', () => {
    expect(cdbMatchTrc(';$FILEVERSION=1.1')).toBe(null);
    expect(cdbIsNoise(';$STARTTIME=44197.5')).toBe(true);
  });
});

describe('cdbMatchBusmaster — BusMaster .log', () => {
  test('mutlak zaman + uzatılmış çerçeve', () => {
    const f = cdbMatchBusmaster('20:16:19:0246 Rx 1 0x18fef100 x 8 01 02 03 04 05 06 07 08');
    // Kesir SABİT GENİŞLİKTE: dört hane → saniyenin on binde biri (0,1 ms).
    expect(f.t).toBeCloseTo(20 * 3600 + 16 * 60 + 19 + 0.0246, 6);
    expect(f.id).toBe(0x18FEF100);
    expect(f.ext).toBe(true);
    expect(f.bytes).toHaveLength(8);
  });

  test('ZAMAN BİRİMİ kesir alanının GENİŞLİĞİNDEN türer', () => {
    // Kullanıcının gerçek kaydında ölçüldü (199.664 satır): dört haneli alan
    // en fazla 9999 oluyor ve saniye tam ondan sonra artıyor. 1000'e bölen bir
    // okuma ekseni on kat uzatır VE her saniye sınırında zamanı geriye atardı.
    const a = cdbMatchBusmaster('0:0:0:9998 Rx 1 ABC x 1 00');
    const b = cdbMatchBusmaster('0:0:1:0004 Rx 1 ABC x 1 00');
    expect(a.t).toBeCloseTo(0.9998, 9);
    expect(b.t).toBeCloseTo(1.0004, 9);
    expect(b.t).toBeGreaterThan(a.t);          // saniye sınırında GERİYE ATLAMAZ
    // Üç haneli yazan bir sürümde aynı alan milisaniyedir
    expect(cdbMatchBusmaster('0:0:0:250 Rx 1 ABC x 1 00').t).toBeCloseTo(0.250, 9);
  });

  test('0x öneksiz kimlik ve x/s bayrağı — gerçek BusMaster satırı', () => {
    const f = cdbMatchBusmaster('0:4:20:7502 Rx 1 18FED917 x 8 FC FF 00 FF FF FF FF FF');
    expect(f.id).toBe(0x18FED917);
    expect(f.ext).toBe(true);
    expect(f.t).toBeCloseTo(4 * 60 + 20 + 0.7502, 6);
    // Üç haneli kısa kimlik de 'x' ile uzatılmış olabilir
    expect(cdbMatchBusmaster('0:0:0:0497 Rx 1 ABC x 8 00 00 01 00 00 00 00 00').ext).toBe(true);
  });

  test('***DEC*** başlığı kimliği ve baytları ONLUK okutur', () => {
    const dec = cdbMatchBusmaster('0:0:0:0100 Rx 1 256 s 2 10 20', { bmBase: 'dec' });
    expect(dec.id).toBe(256);
    expect(dec.bytes).toEqual([10, 20]);
    const hex = cdbMatchBusmaster('0:0:0:0100 Rx 1 256 s 2 10 20', { bmBase: 'hex' });
    expect(hex.id).toBe(0x256);
    expect(hex.bytes).toEqual([0x10, 0x20]);
    expect(cdbLogContext(['***BUSMASTER Ver 3.2.2***', '***DEC***']).bmBase).toBe('dec');
    expect(cdbLogContext(['***HEX***']).bmBase).toBe('hex');
  });
  test("standart çerçeve 's' ile işaretlenir", () => {
    const f = cdbMatchBusmaster('0000:00:01:0500 Tx 1 0x123 s 3 11 22 33');
    expect(f.ext).toBe(false);
    expect(f.id).toBe(0x123);
    expect(f.bytes).toEqual([0x11, 0x22, 0x33]);
  });
  test('*** başlık satırları gürültü', () => {
    expect(cdbIsNoise('***BUSMASTER Ver 3.2.2***')).toBe(true);
  });
});

describe('cdbDetectLogFormat — biçimler birbirinin satırını ÇALMAZ', () => {
  const ornek = {
    candump:   ['(1656664830.024244) can0 123#DEADBEEF', '(1656664830.034244) can0 456#0011'],
    'candump-p': ['  can0  123   [8]  DE AD BE EF 00 11 22 33', '  can0  456   [2]  00 11'],
    asc:       ['   0.000000 1  100  Rx   d 8 01 02 03 04 05 06 07 08',
                '   0.010000 1  200  Rx   d 2 AA BB'],
    trc:       ['     1)      1000.0  0018  8  01 02 03 04 05 06 07 08',
                '     2)      1010.0  0019  2  AA BB'],
    busmaster: ['20:16:19:0246 Rx 1 0x18fef100 x 8 01 02 03 04 05 06 07 08',
                '20:16:19:0346 Rx 1 0x123 s 2 AA BB']
  };

  Object.keys(ornek).forEach(id => {
    test(id + ' örneği kendi biçimini kazandırır', () => {
      const d = cdbDetectLogFormat(ornek[id], cdbLogContext(ornek[id]));
      expect(d.best).not.toBe(null);
      expect(d.best.format.id).toBe(id);
      expect(d.best.ratio).toBe(1);
    });
  });

  test('hiçbir biçime uymayan dosyada best null', () => {
    const d = cdbDetectLogFormat(['bu bir metin', 'su da bir metin'], {});
    expect(d.best).toBe(null);
  });
});

describe('kare deposu', () => {
  test('tipli dizilere geçer, veri düz tamponda birikir', () => {
    const st = cdbNewStore();
    cdbStorePush(st, { t: 10, id: 0x100, ext: false, dlc: 2, bytes: [0xAA, 0xBB] });
    cdbStorePush(st, { t: 11, id: 0x100, ext: false, dlc: 3, bytes: [1, 2, 3] });
    cdbStoreFinalize(st, { relativeTime: false });
    expect(st.n).toBe(2);
    expect(st.data.length).toBe(5);
    expect(st.off[1]).toBe(2);
    expect(st.len[1]).toBe(3);
    expect(Array.from(st.data.subarray(st.off[1], st.off[1] + 3))).toEqual([1, 2, 3]);
  });

  test('büyüme: başlangıç kapasitesinin ötesinde veri kaybolmaz', () => {
    const st = cdbNewStore();
    for (let i = 0; i < 5000; i++) cdbStorePush(st, { t: i, id: 0x100, ext: false, dlc: 8, bytes: [i & 255, 0, 0, 0, 0, 0, 0, 0] });
    cdbStoreFinalize(st, { relativeTime: false });
    expect(st.n).toBe(5000);
    expect(st.data[st.off[4999]]).toBe(4999 & 255);
    expect(st.t[4999]).toBe(4999);
  });

  test('zaman ölçeği saniyeye çevirir; göreli mod ilk kareyi sıfırlar', () => {
    const st = cdbNewStore();
    cdbStorePush(st, { t: 1000, id: 1, ext: false, dlc: 0, bytes: [] });
    cdbStorePush(st, { t: 1500, id: 1, ext: false, dlc: 0, bytes: [] });
    cdbStoreFinalize(st, { timeScale: 0.001, relativeTime: true });
    expect(st.t[0]).toBe(0);
    expect(st.t[1]).toBeCloseTo(0.5, 9);
    expect(st.tAbs0).toBe(1);
  });

  test('mesaj dizini kimlik + çerçeve tipine göre AYRIŞIR', () => {
    // 0x100 hem 11 bit hem 29 bit gelebilir; ikisi ayrı mesajdır.
    const st = cdbNewStore();
    cdbStorePush(st, { t: 0, id: 0x100, ext: false, dlc: 1, bytes: [1] });
    cdbStorePush(st, { t: 1, id: 0x100, ext: true,  dlc: 1, bytes: [2] });
    cdbStorePush(st, { t: 2, id: 0x100, ext: false, dlc: 1, bytes: [3] });
    cdbStoreFinalize(st, { relativeTime: false });
    expect(Array.from(st.byKey[cdbMsgKey(0x100, false)])).toEqual([0, 2]);
    expect(Array.from(st.byKey[cdbMsgKey(0x100, true)])).toEqual([1]);
    expect(st.counts[cdbMsgKey(0x100, false)]).toBe(2);
  });

  test('zaman geriye akarsa işaretlenir ve uçlar gerçek en küçük/en büyükten', () => {
    const st = cdbNewStore();
    [5, 1, 9, 3].forEach(t => cdbStorePush(st, { t: t, id: 1, ext: false, dlc: 0, bytes: [] }));
    cdbStoreFinalize(st, { relativeTime: false });
    expect(st.timeMonotonic).toBe(false);
    expect(st.t0).toBe(1);
    expect(st.t1).toBe(9);
  });
});

describe('cdbParseLogAsync — uçtan uca', () => {
  test('biçim algılar, kareleri kurar, ÇÖZÜLEMEYEN SATIRI SAYAR', (done) => {
    const text = [
      '# baslik satiri',
      '(1000.000000) can0 123#0102',
      'bu satir hicbir bicime uymuyor',
      '(1000.100000) can0 123#0304',
      '(1000.200000) can0 456#AA',
      ''
    ].join('\n');
    cdbParseLogAsync(text, {}, null, (res) => {
      expect(res.error).toBeUndefined();
      const st = res.store;
      expect(st.formatId).toBe('candump');
      expect(st.n).toBe(3);
      expect(st.skipped).toBe(1);
      expect(st.skippedSamples[0].text).toContain('hicbir bicime');
      expect(st.t[0]).toBe(0);
      expect(st.t[1]).toBeCloseTo(0.1, 9);
      expect(st.counts[cdbMsgKey(0x123, false)]).toBe(2);
      done();
    });
  });

  test('tanınmayan dosya SESSİZ boş sonuç değil HATA verir', (done) => {
    cdbParseLogAsync('lorem ipsum\ndolor sit amet\n', {}, null, (res) => {
      expect(res.store).toBe(null);
      expect(res.error).toMatch(/tanınan bir CAN kayıt biçimi/);
      done();
    });
  });

  test('zamansız kayıtta kare sırası eksen olur', (done) => {
    cdbParseLogAsync('can0 123#0102\ncan0 123#0304\ncan0 123#0506\n', {}, null, (res) => {
      expect(res.store.noTime).toBe(true);
      expect(Array.from(res.store.t)).toEqual([0, 1, 2]);
      done();
    });
  });

  test('PCAN kaydı milisaniyeden saniyeye çevrilir', (done) => {
    const text = ';$FILEVERSION=1.1\n' +
                 '     1)      1000.0  0018  2  01 02\n' +
                 '     2)      1500.0  0018  2  03 04\n';
    cdbParseLogAsync(text, {}, null, (res) => {
      expect(res.store.formatId).toBe('trc');
      expect(res.store.t[1]).toBeCloseTo(0.5, 9);
      done();
    });
  });
});
