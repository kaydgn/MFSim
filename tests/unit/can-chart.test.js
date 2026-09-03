/**
 * can-chart.test.js — CAN Çözümleyici, grafik çekirdeği + UÇTAN UCA kapı
 * ─────────────────────────────────────────────────────────────────────
 * İki iş yapar:
 *
 *  1) Grafiğin SAF çekirdeğini sınar (eksen adımı, görünür aralık, imleç
 *     örneklemesi). Canvas çizimi test edilmiyor — orası kırılgan; ölçülen
 *     şey çizimden ÖNCEKİ karar.
 *
 *  2) GİDİŞ-DÖNÜŞ: örnek üreteci bilinen fiziksel değerleri kareye yazıyor,
 *     kayıt metnine döküyor; test onu ayrıştırıp geri çözüyor ve AYNI sayıyı
 *     bekliyor. Bu halka DBC ayrıştırıcısı + candump biçimi + bit çıkarma +
 *     çoklama + Motorola düzenini TEK SEFERDE bağlar. Bir işaret hatası
 *     buradan geçemez.
 */
eval(loadCanSource('can-dbc.js'));
eval(loadCanSource('can-j1939.js'));
eval(loadCanSource('can-log.js'));
eval(loadCanSource('can-match.js'));
eval(loadCanSource('can-decode.js'));
eval(loadCanSource('can-example.js'));

// can-chart.js DOM'a bakan yerler içeriyor; saf yardımcıları require ile al.
const chart = require('../../candbc/js/can-chart.js');

describe('cdbNiceStep — 1/2/5 × 10ⁿ ölçeği', () => {
  test('bilinen aralıklar', () => {
    // Merdiven 1-2-5: ham adım 2,5 ise YUKARI, 5'e çıkar (aşağı yuvarlamak
    // istenenden çok tik üretir ve eksen kalabalıklaşır).
    expect(chart.cdbNiceStep(10, 5)).toBe(2);      // ham 2   → 2
    expect(chart.cdbNiceStep(100, 4)).toBe(50);    // ham 25  → 50
    expect(chart.cdbNiceStep(1, 4)).toBeCloseTo(0.5, 9);  // ham 0,25 → 0,5
    expect(chart.cdbNiceStep(3000, 4)).toBe(1000); // ham 750 → 1000
  });
  test('sıfır ya da negatif aralık patlamaz', () => {
    expect(chart.cdbNiceStep(0, 4)).toBe(1);
    expect(chart.cdbNiceStep(-5, 4)).toBe(1);
  });
});

describe('cdbFmtNum / cdbFmtTime', () => {
  test('ondalık sayısı adımdan türer', () => {
    expect(chart.cdbFmtNum(12.345, 1)).toBe('12');
    expect(chart.cdbFmtNum(12.345, 0.1)).toBe('12.3');
    expect(chart.cdbFmtNum(12.345, 0.01)).toBe('12.35');
  });
  test('çok büyük/küçük sayı üstel yazılır', () => {
    expect(chart.cdbFmtNum(1.2e7, 1)).toMatch(/e\+/);
    expect(chart.cdbFmtNum(0.0000012, 1e-7)).toMatch(/e-/);
  });
  test('zaman ekseni adıma göre saniye ya da milisaniye', () => {
    expect(chart.cdbFmtTime(1.5, 1)).toBe('1.5 s');
    expect(chart.cdbFmtTime(1.5, 0.01)).toBe('1.500 s');
    expect(chart.cdbFmtTime(0.0015, 0.0001)).toBe('1.500 ms');
  });
});

describe('cdbSampleAt — CAN sinyali BASAMAKLIDIR, ara değerlenmez', () => {
  const ser = { n: 4, t: [0, 1, 2, 3], v: [10, 20, 30, 40] };
  test('tam örnek anında o örneği verir', () => {
    expect(chart.cdbSampleAt(ser, 1).v).toBe(20);
  });
  test('iki örnek arasında ÖNCEKİ örnekte kalır — 25 uydurulmaz', () => {
    // 20 ms'de bir gelen bir mesajın iki karesi arasında değer DEĞİŞMEZ.
    expect(chart.cdbSampleAt(ser, 1.9).v).toBe(20);
    expect(chart.cdbSampleAt(ser, 2.0).v).toBe(30);
  });
  test('ilk örnekten önce değer YOK (null), 0 değil', () => {
    expect(chart.cdbSampleAt(ser, -1)).toBe(null);
  });
  test('son örnekten sonra son değerde kalır', () => {
    expect(chart.cdbSampleAt(ser, 99).v).toBe(40);
  });
  test('boş seri null döner', () => {
    expect(chart.cdbSampleAt({ n: 0, t: [], v: [] }, 1)).toBe(null);
    expect(chart.cdbSampleAt(null, 1)).toBe(null);
  });
});

describe('cdbSigDecimals — ondalık ÇARPANDAN türer', () => {
  const mk = (factor, valueType) => ({ factor: factor, valueType: valueType || 'int', unit: '', values: null, offset: 0 });
  test('tam sayı çarpanlı sinyalde ondalık yok', () => {
    expect(cdbSigDecimals(mk(1))).toBe(0);
    expect(cdbSigDecimals(mk(10))).toBe(0);
  });
  test('0,125 → üç basamak; 0,1 → bir basamak', () => {
    expect(cdbSigDecimals(mk(0.125))).toBe(3);
    expect(cdbSigDecimals(mk(0.1))).toBe(1);
    expect(cdbSigDecimals(mk(0.00390625))).toBe(6);   // 8 gerekir, tavan 6
  });
  test('IEEE sinyalde sabit üç basamak', () => {
    expect(cdbSigDecimals(mk(1, 'float'))).toBe(3);
  });
  test('cdbFmtSigVal: tablo varsa METİN, yoksa sayı + birim', () => {
    const enumSig = { factor: 1, offset: 0, unit: '', valueType: 'int', values: { 2: 'Ikinci' } };
    expect(cdbFmtSigVal(enumSig, 2)).toBe('Ikinci');
    const rpm = { factor: 0.125, offset: 0, unit: 'rpm', valueType: 'int', values: null };
    expect(cdbFmtSigVal(rpm, 1451.625)).toBe('1451.625 rpm');
    expect(cdbFmtSigVal(rpm, 1451.625, false)).toBe('1451.625');
    expect(cdbFmtSigVal({ factor: 1, offset: 0, unit: '', valueType: 'int', values: null }, 0)).toBe('0');
  });

  test('EKRANDA basamak üçle sınırlı — J1939 hızı "80.445313" diye yazılmaz', () => {
    // Çarpan 1/256; komşu ham değerler 0,0039 km/h arayla. Üçüncü ondalık
    // onları zaten ayırıyor, kalan üç hane yalnız rozeti şişiriyordu.
    const hiz = { factor: 0.00390625, offset: 0, unit: 'km/h', valueType: 'int', values: null };
    expect(cdbSigDecimals(hiz)).toBe(6);            // çarpanın gerçek ihtiyacı
    expect(cdbFmtSigVal(hiz, 80.445313)).toBe('80.445 km/h');
  });
});

describe('örnek veri — DBC ile kayıt AYNI kimlikleri kullanır', () => {
  const db = cdbParseDbc(CDB_EXAMPLE_DBC);
  const log = cdbMakeExampleLog();

  test('DBC uyarısız okunur ve beş mesaj tanımlar', () => {
    expect(db.warnings).toEqual([]);
    expect(db.messages).toHaveLength(5);
  });

  test('kayıttaki HER kimlik DBC\'de tanımlı', () => {
    // Bu kapı gerçek bir hatayı yakaladı: DBC ham kimliği (0x80000000 | id)
    // elle yazılmıştı ve iki mesajda tutmuyordu; program onları "tanımsız
    // kimlik" diye listeliyor, iki şerit boş çiziliyordu.
    const bulunan = new Set();
    log.split('\n').forEach(l => {
      const m = cdbMatchDumpHash(l);
      if (m) bulunan.add(cdbMsgKey(m.id, m.ext));
    });
    expect(bulunan.size).toBe(5);
    bulunan.forEach(k => expect(db.byKey[k]).toBeDefined());
  });
});

describe('GİDİŞ-DÖNÜŞ — üret, yaz, ayrıştır, çöz, karşılaştır', () => {
  const db = cdbParseDbc(CDB_EXAMPLE_DBC);

  // Bilinen değerleri kareye yazıp candump satırına döker.
  function kayit(satirlar) {
    const st = cdbNewStore();
    satirlar.forEach(l => {
      const f = cdbMatchDumpHash(l);
      if (f) cdbStorePush(st, f);
    });
    return cdbStoreFinalize(st, { relativeTime: false });
  }
  // Kanal çözümlemesi: seri artık kanal üzerinden kuruluyor.
  function kanal(st, id, ext) {
    const k = cdbMsgKey(id, ext);
    return cdbBuildChannels(db, st, {}).channels.filter(c => c.key === k)[0];
  }
  function hex(bytes) {
    return bytes.map(b => (b & 255).toString(16).toUpperCase().padStart(2, '0')).join('');
  }

  test('Intel 16 bit + çarpan: 1450,5 rpm gidip geliyor', () => {
    const b = [0, 0, 0, 0, 0, 0, 0, 0];
    cdbExPutLE(b, 24, 16, 1450.5 / 0.125);
    const st = kayit(['(0.000000) can0 0CF004FE#' + hex(b)]);
    const msg = db.byKey[cdbMsgKey(0x0CF004FE, true)];
    const ch = kanal(st, 0x0CF004FE, true);
    const s = cdbBuildSeries(st, ch, msg.sigByName['MotorDevri']);
    expect(s.n).toBe(1);
    expect(s.v[0]).toBeCloseTo(1450.5, 6);
  });

  test('negatif ofset: SurucuTalebi %0 → ham 125', () => {
    const b = [0, 0, 0, 0, 0, 0, 0, 0];
    cdbExPutLE(b, 8, 8, 0 + 125);
    const st = kayit(['(0.000000) can0 0CF004FE#' + hex(b)]);
    const msg = db.byKey[cdbMsgKey(0x0CF004FE, true)];
    expect(cdbBuildSeries(st, kanal(st, 0x0CF004FE, true), msg.sigByName['SurucuTalebi']).v[0]).toBeCloseTo(0, 9);
  });

  test('MOTOROLA (@0) işaretli sinyal: −128,5 Nm gidip geliyor', () => {
    // Bu testin tuttuğu şey programın en sessiz hata sınıfı: Motorola sinyali
    // Intel gibi okunursa değer bambaşka çıkar ama program çalışmaya devam eder.
    const b = [0, 0, 0, 0];
    let raw = Math.round(-128.5 / 0.1);
    if (raw < 0) raw += 65536;
    cdbExPutBE(b, 7, 16, raw);
    const st = kayit(['(0.000000) can0 200#' + hex(b)]);
    const msg = db.byKey[cdbMsgKey(0x200, false)];
    const ch = kanal(st, 0x200, false);
    const s = cdbBuildSeries(st, ch, msg.sigByName['BuyukUcluDeger']);
    expect(s.v[0]).toBeCloseTo(-128.5, 6);
  });

  test('MOTOROLA tek bit bayrağı doğru bitte', () => {
    const b0 = [0, 0, 0, 0], b1 = [0, 0, 0, 0];
    cdbExPutBE(b1, 23, 1, 1);
    const st = kayit(['(0.000000) can0 200#' + hex(b0), '(0.100000) can0 200#' + hex(b1)]);
    const msg = db.byKey[cdbMsgKey(0x200, false)];
    const ch = kanal(st, 0x200, false);
    const s = cdbBuildSeries(st, ch, msg.sigByName['Bayrak']);
    expect(Array.from(s.v)).toEqual([0, 1]);
  });

  test('ÇOKLAMA: sayfa 0 basıncı, sayfa 1 hata kodunu taşır', () => {
    const p0 = [0, 0, 0, 0], p1 = [0, 0, 0, 0];
    cdbExPutLE(p0, 0, 2, 0); cdbExPutLE(p0, 2, 4, 3); cdbExPutLE(p0, 8, 16, 12.7 / 0.1);
    cdbExPutLE(p1, 0, 2, 1); cdbExPutLE(p1, 2, 4, 3); cdbExPutLE(p1, 8, 16, 519);
    const st = kayit(['(0.000000) can0 100#' + hex(p0), '(0.100000) can0 100#' + hex(p1)]);
    const msg = db.byKey[cdbMsgKey(0x100, false)];
    const ch = kanal(st, 0x100, false);

    const bas = cdbBuildSeries(st, ch, msg.sigByName['HatBasinci']);
    expect(bas.n).toBe(1);
    expect(bas.t[0]).toBe(0);
    expect(bas.v[0]).toBeCloseTo(12.7, 6);

    const hata = cdbBuildSeries(st, ch, msg.sigByName['HataKodu']);
    expect(hata.n).toBe(1);
    expect(hata.t[0]).toBeCloseTo(0.1, 9);
    expect(hata.v[0]).toBe(519);

    // Vites çoklanmamış: HER İKİ karede de okunur.
    const vites = cdbBuildSeries(st, ch, msg.sigByName['Vites']);
    expect(vites.n).toBe(2);
    expect(Array.from(vites.v)).toEqual([3, 3]);
    expect(cdbValueText(msg.sigByName['Vites'], 3)).toBe('3. vites');
  });

  test('bütün örnek kayıt uçtan uca çözülür — atlanan satır yok', (done) => {
    cdbParseLogAsync(cdbMakeExampleLog(), {}, null, (res) => {
      expect(res.error).toBeUndefined();
      expect(res.store.formatId).toBe('candump');
      expect(res.store.skipped).toBe(0);
      expect(res.store.n).toBeGreaterThan(3000);
      expect(res.store.timeMonotonic).toBe(true);

      // Devir kayıt boyunca rölanti ile azami arasında kalmalı: profil
      // değiştiğinde bu bant kırmızıya döner ve "eğri neden düz" sorusu
      // gözle değil testle sorulur.
      const msg = db.byKey[cdbMsgKey(0x0CF004FE, true)];
      const ch = cdbBuildChannels(db, res.store, {}).channels
                   .filter(c => c.key === cdbMsgKey(0x0CF004FE, true))[0];
      const s = cdbBuildSeries(res.store, ch, msg.sigByName['MotorDevri']);
      expect(s.n).toBeGreaterThan(1900);
      expect(s.min).toBeGreaterThan(650);
      expect(s.max).toBeLessThan(2450);
      expect(s.max - s.min).toBeGreaterThan(1000);   // testere dişi gerçekten var
      done();
    });
  });
});
