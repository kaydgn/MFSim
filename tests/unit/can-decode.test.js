/**
 * can-decode.test.js — CAN Çözümleyici, sinyal çözücü
 * ───────────────────────────────────────────────────
 * BU DOSYA PROGRAMIN EN ÖNEMLİ KAPISIDIR. Bit düzeni hatasının belirtisi
 * YOKTUR: program çalışır, grafik çizilir, sayı yanlıştır. En sık görülen
 * biçimi Motorola (@0) sinyalini Intel gibi "startBit + i" ile okumaktır —
 * kod okunaklı durur, testten geçer ve yanlış eğri çizer.
 *
 * Bu yüzden referans değerler EL İLE hesaplandı ve yorumda gösteriliyor;
 * "kodun bugün ürettiği değer" altın kabul edilmedi.
 */
eval(loadCanSource('can-dbc.js'));
eval(loadCanSource('can-log.js'));      // kare deposu (cdbNewStore/…)
eval(loadCanSource('can-decode.js'));

// Referans kare: her baytı kendi indeksinden ayırt edilebilir.
//   bayt:   0     1     2     3     4     5     6     7
const D = new Uint8Array([0x11, 0x22, 0x33, 0x44, 0x55, 0x66, 0x77, 0x88]);

function raw(startBit, len, le) { return cdbRawBits(D, 0, D.length, startBit, len, le); }

describe('cdbRawBits — Intel (@1, little endian)', () => {
  test('bayt hizalı 16 bit: bayt0 düşük, bayt1 yüksek', () => {
    // 0. bitten 16 bit → 0x22 << 8 | 0x11 = 0x2211
    expect(raw(0, 16, true)).toBe(0x2211);
    expect(raw(8, 16, true)).toBe(0x3322);
  });
  test('tek bayt', () => {
    expect(raw(0, 8, true)).toBe(0x11);
    expect(raw(56, 8, true)).toBe(0x88);
  });
  test('bayt sınırını aşan nibble: bayt0 üst yarısı + bayt1 alt yarısı', () => {
    // bit 4..7  = 0x11 >> 4      = 0x1   (düşük yarı)
    // bit 8..11 = 0x22 & 0x0F    = 0x2   (yüksek yarı)
    expect(raw(4, 8, true)).toBe(0x21);
  });
  test('tek bit', () => {
    expect(raw(0, 1, true)).toBe(1);   // 0x11 bit0 = 1
    expect(raw(1, 1, true)).toBe(0);
    expect(raw(4, 1, true)).toBe(1);   // 0x11 bit4 = 1
  });
  test('32 bit', () => {
    expect(raw(0, 32, true)).toBe(0x44332211);
  });
});

describe('cdbRawBits — Motorola (@0, big endian)', () => {
  test('bayt hizalı 16 bit: başlangıç biti MSB, bayt sırası ARTAR', () => {
    // startBit 7 = bayt0'ın MSB'si → 0x11 sonra 0x22 → 0x1122
    expect(raw(7, 16, false)).toBe(0x1122);
    expect(raw(15, 16, false)).toBe(0x2233);
  });
  test('tek bayt', () => {
    expect(raw(7, 8, false)).toBe(0x11);
    expect(raw(63, 8, false)).toBe(0x88);
  });
  test('bayt sınırını aşan nibble: bayt0 alt yarısı + bayt1 üst yarısı', () => {
    // startBit 3 → bayt0'ın 3,2,1,0 bitleri (0x1), sonra bayt1'in 7,6,5,4 (0x2)
    expect(raw(3, 8, false)).toBe(0x12);
  });
  test('adım kuralı: bit 0 iken +15, değilse -1', () => {
    // 4 baytlık Motorola: 0x11223344
    expect(raw(7, 32, false)).toBe(0x11223344);
  });
  test('Intel ile AYNI olmadığını doğrula (kapının kendisi)', () => {
    expect(raw(7, 16, false)).not.toBe(raw(7, 16, true));
    expect(raw(0, 16, true)).not.toBe(raw(0, 16, false));
  });
});

describe('cdbSignExtend — iki tümleyen', () => {
  test('8 bit', () => {
    expect(cdbSignExtend(0xFF, 8)).toBe(-1);
    expect(cdbSignExtend(0x80, 8)).toBe(-128);
    expect(cdbSignExtend(0x7F, 8)).toBe(127);
    expect(cdbSignExtend(0x00, 8)).toBe(0);
  });
  test('16 bit ve 4 bit', () => {
    expect(cdbSignExtend(0xFFFF, 16)).toBe(-1);
    expect(cdbSignExtend(0x8000, 16)).toBe(-32768);
    expect(cdbSignExtend(0xF, 4)).toBe(-1);
    expect(cdbSignExtend(0x8, 4)).toBe(-8);
  });
});

describe('cdbRawFloat — IEEE-754', () => {
  test('float32 1.0 (0x3F800000), Intel', () => {
    const b = new Uint8Array([0x00, 0x00, 0x80, 0x3F, 0, 0, 0, 0]);
    expect(cdbRawFloat(b, 0, 8, 0, 32, true, false)).toBeCloseTo(1.0, 9);
  });
  test('float32 -2.5 (0xC0200000), Intel', () => {
    const b = new Uint8Array([0x00, 0x00, 0x20, 0xC0, 0, 0, 0, 0]);
    expect(cdbRawFloat(b, 0, 8, 0, 32, true, false)).toBeCloseTo(-2.5, 9);
  });
  test('float64 3.5, Intel', () => {
    const b = new Uint8Array(8);
    new DataView(b.buffer).setFloat64(0, 3.5, true);
    expect(cdbRawFloat(b, 0, 8, 0, 64, true, true)).toBeCloseTo(3.5, 12);
  });
  test('float32 Motorola: bayt sırası ters', () => {
    const b = new Uint8Array([0x3F, 0x80, 0x00, 0x00, 0, 0, 0, 0]);
    expect(cdbRawFloat(b, 0, 8, 7, 32, false, false)).toBeCloseTo(1.0, 9);
  });
});

describe('cdbDecodeSignal — ölçekleme', () => {
  test('J1939 motor devri: 16 bit Intel, çarpan 0,125', () => {
    // Ham 8000 → 1000 rpm. 8000 = 0x1F40 → bayt3 = 0x40, bayt4 = 0x1F
    const b = new Uint8Array([0xFF, 0xFF, 0xFF, 0x40, 0x1F, 0xFF, 0xFF, 0xFF]);
    const sig = { startBit: 24, length: 16, littleEndian: true, signed: false,
                  factor: 0.125, offset: 0, valueType: 'int' };
    expect(cdbDecodeSignal(b, 0, 8, sig)).toBeCloseTo(1000, 9);
  });
  test('sıcaklık: 8 bit işaretsiz, ofset -40', () => {
    const b = new Uint8Array([0x64, 0, 0, 0, 0, 0, 0, 0]);   // 100
    const sig = { startBit: 0, length: 8, littleEndian: true, signed: false,
                  factor: 1, offset: -40, valueType: 'int' };
    expect(cdbDecodeSignal(b, 0, 8, sig)).toBe(60);
  });
  test('işaretli sinyalde ofset işaret çevriminden SONRA uygulanır', () => {
    const b = new Uint8Array([0xFF, 0, 0, 0, 0, 0, 0, 0]);   // -1
    const sig = { startBit: 0, length: 8, littleEndian: true, signed: true,
                  factor: 0.5, offset: 10, valueType: 'int' };
    expect(cdbDecodeSignal(b, 0, 8, sig)).toBeCloseTo(9.5, 9);
  });
});

describe('cdbRawBits — kısa kare (DLC sınırının dışı)', () => {
  test('kare sınırının ötesindeki bitler 0 okunur, patlamaz', () => {
    const b = new Uint8Array([0xFF, 0xFF]);
    expect(cdbRawBits(b, 0, 2, 0, 32, true)).toBe(0xFFFF);
    expect(cdbRawBits(b, 0, 2, 7, 32, false)).toBe(0xFFFF0000);
  });
});

describe('cdbMuxMatches — çoklama', () => {
  test('çoklanmamış sinyal her karede geçerli', () => {
    expect(cdbMuxMatches({ muxValue: null, muxRanges: null }, null)).toBe(true);
    expect(cdbMuxMatches({ muxValue: null, muxRanges: null }, 7)).toBe(true);
  });
  test('m<n> yalnız o çoklayıcı değerinde geçerli', () => {
    const s = { muxValue: 2, muxRanges: null };
    expect(cdbMuxMatches(s, 2)).toBe(true);
    expect(cdbMuxMatches(s, 3)).toBe(false);
    expect(cdbMuxMatches(s, null)).toBe(false);
  });
  test('SG_MUL_VAL_ aralıkları', () => {
    const s = { muxValue: 1, muxRanges: [[1, 3], [7, 8]] };
    [1, 2, 3, 7, 8].forEach(v => expect(cdbMuxMatches(s, v)).toBe(true));
    [0, 4, 6, 9].forEach(v => expect(cdbMuxMatches(s, v)).toBe(false));
  });
});

describe('cdbValueText — VAL_ tablosu HAM değere göre aranır', () => {
  test('çarpan 1 / ofset 0', () => {
    const sig = { factor: 1, offset: 0, values: { 0: 'Bos', 1: 'Birinci' } };
    expect(cdbValueText(sig, 0)).toBe('Bos');
    expect(cdbValueText(sig, 1)).toBe('Birinci');
    expect(cdbValueText(sig, 2)).toBe(null);
  });
  test('ölçekli sinyalde fiziksel değer ham değere ÇEVRİLİR', () => {
    // Ham 3 → fiziksel 3*2+10 = 16. Tablo ham 3'ü tanır.
    const sig = { factor: 2, offset: 10, values: { 3: 'Uc' } };
    expect(cdbValueText(sig, 16)).toBe('Uc');
    expect(cdbValueText(sig, 17)).toBe(null);   // ham 3,5 → tam sayı değil
  });
  test('tablosu olmayan sinyal null döner', () => {
    expect(cdbValueText({ factor: 1, offset: 0, values: null }, 5)).toBe(null);
  });
});

describe('cdbIsDiscrete — basamaklı çizim ölçütü', () => {
  test('değer tablosu olan sinyal ayrıktır', () => {
    expect(cdbIsDiscrete({ values: { 0: 'a' }, length: 16, factor: 0.1, offset: 0, valueType: 'int' })).toBe(true);
  });
  test('tek bitlik bayrak ayrıktır', () => {
    expect(cdbIsDiscrete({ values: null, length: 1, factor: 1, offset: 0, valueType: 'int' })).toBe(true);
  });
  test('ölçekli sürekli sinyal ayrık DEĞİLDİR', () => {
    expect(cdbIsDiscrete({ values: null, length: 16, factor: 0.125, offset: 0, valueType: 'int' })).toBe(false);
  });
  test('tam sayı adımlı dar sinyal ayrıktır', () => {
    expect(cdbIsDiscrete({ values: null, length: 4, factor: 1, offset: 0, valueType: 'int' })).toBe(true);
  });
});

describe('cdbBuildSeries — mesajın kendi kareleri üzerinde çözer', () => {
  // İki mesajlı küçük bir depo elle kurulur.
  function store() {
    const st = cdbNewStore();
    // 0x100: çoklayıcı bayt0'ın alt 4 biti; yük bayt1-2
    cdbStorePush(st, { t: 0.0, id: 0x100, ext: false, dlc: 4, bytes: [0, 0x10, 0x00, 0] });
    cdbStorePush(st, { t: 0.1, id: 0x200, ext: false, dlc: 2, bytes: [1, 2] });
    cdbStorePush(st, { t: 0.2, id: 0x100, ext: false, dlc: 4, bytes: [1, 0x20, 0x00, 0] });
    cdbStorePush(st, { t: 0.3, id: 0x100, ext: false, dlc: 4, bytes: [0, 0x30, 0x00, 0] });
    return cdbStoreFinalize(st, { relativeTime: false });
  }
  const db = cdbParseDbc(
    'BO_ 256 Durum: 4 X\n' +
    ' SG_ Mux M : 0|4@1+ (1,0) [0|15] "" X\n' +
    ' SG_ Basinc m0 : 8|16@1+ (0.1,0) [0|100] "bar" X\n' +
    ' SG_ Hata m1 : 8|16@1+ (1,0) [0|65535] "" X\n'
  );
  const msg = db.byKey[cdbMsgKey(0x100, false)];

  test('yalnız kendi kimliğinin kareleri okunur', () => {
    const s = cdbBuildSeries(store(), msg, msg.sigByName['Mux']);
    expect(s.n).toBe(3);
    expect(Array.from(s.t)).toEqual([0, 0.2, 0.3]);
  });

  test('çoklanmış sinyal, çoklayıcı uyuşmayan kareyi ATLAR', () => {
    const s = cdbBuildSeries(store(), msg, msg.sigByName['Basinc']);
    expect(s.n).toBe(2);                     // mux=0 olan iki kare
    expect(Array.from(s.t)).toEqual([0, 0.3]);
    expect(s.v[0]).toBeCloseTo(1.6, 9);      // 0x0010 * 0.1
    expect(s.v[1]).toBeCloseTo(4.8, 9);      // 0x0030 * 0.1
    expect(s.skipped).toBe(1);
  });

  test('öteki çoklayıcı dalı ayrı seri verir', () => {
    const s = cdbBuildSeries(store(), msg, msg.sigByName['Hata']);
    expect(s.n).toBe(1);
    expect(s.v[0]).toBe(0x0020);
  });

  test('kayıtta hiç geçmeyen mesaj boş seri verir, patlamaz', () => {
    const yok = cdbParseDbc('BO_ 999 Yok: 8 X\n SG_ A : 0|8@1+ (1,0) [0|255] "" X\n');
    const s = cdbBuildSeries(store(), yok.messages[0], yok.messages[0].signals[0]);
    expect(s.n).toBe(0);
  });

  test('sinyali taşıyacak kadar uzun olmayan kare ATLANIR — 0 çizilmez', () => {
    const st = cdbNewStore();
    cdbStorePush(st, { t: 0, id: 0x100, ext: false, dlc: 1, bytes: [0] });        // kısa
    cdbStorePush(st, { t: 1, id: 0x100, ext: false, dlc: 4, bytes: [0, 0x10, 0, 0] });
    cdbStoreFinalize(st, { relativeTime: false });
    const s = cdbBuildSeries(st, msg, msg.sigByName['Basinc']);
    expect(s.n).toBe(1);
    expect(s.skipped).toBe(1);
    expect(s.t[0]).toBe(1);
  });
});

describe('cdbDecodeFrame — kare listesi', () => {
  test('yalnız o karede geçerli sinyaller döner', () => {
    const db = cdbParseDbc(
      'BO_ 256 D: 4 X\n' +
      ' SG_ Mux M : 0|4@1+ (1,0) [0|15] "" X\n' +
      ' SG_ A m0 : 8|8@1+ (1,0) [0|255] "" X\n' +
      ' SG_ B m1 : 8|8@1+ (1,0) [0|255] "" X\n'
    );
    const msg = db.messages[0];
    const st = cdbNewStore();
    cdbStorePush(st, { t: 0, id: 0x100, ext: false, dlc: 4, bytes: [0, 5, 0, 0] });
    cdbStoreFinalize(st, { relativeTime: false });
    const rows = cdbDecodeFrame(st, msg, 0);
    const names = rows.map(r => r.sig.name);
    expect(names).toContain('Mux');
    expect(names).toContain('A');
    expect(names).not.toContain('B');
    expect(rows.find(r => r.sig.name === 'A').value).toBe(5);
  });
});
