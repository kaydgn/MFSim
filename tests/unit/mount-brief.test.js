/**
 * Diyagram yorumunun sayısal çekirdeği (js/mount-brief.js)
 * ───────────────────────────────────────────────────────
 * Yorum metninin ÜSLUBU test edilmez (kırılgan olur); yorumun dayandığı
 * SAYILAR test edilir. Çünkü buradaki bir kayma en tehlikeli türden hatadır:
 * cümle akıcı, sayı yanlış. Kullanıcı "ilk çekme 3,1 g'de başlıyor" cümlesini
 * okuyup tasarımı ona göre onaylar.
 *
 * Kapsam: tepe bulma, eşiğin altına kalıcı iniş, ilk sıfırdan büyük değer,
 * ara değerleme (log ve lineer ızgara) ve ateşleme frekansı.
 */
const B = require('../../js/mount-brief.js');

describe('interpAt — ara değerleme', () => {
  test('lineer ızgarada doğrusal', () => {
    const x = [0, 1, 2, 3], y = [0, 10, 20, 30];
    expect(B.interpAt(x, y, 1.5)).toBeCloseTo(15, 9);
    expect(B.interpAt(x, y, 0)).toBeCloseTo(0, 9);
    expect(B.interpAt(x, y, 3)).toBeCloseTo(30, 9);
  });

  test('sıfır içeren aralıkta log\'a düşmez — ivme süpürmesi 0 g\'den başlar', () => {
    // log10(0) = −sonsuz. Bu aralık doğrusal ele alınmazsa NaN üretilirdi.
    const x = [0, 0.1, 0.2], y = [0, 1, 2];
    expect(Number.isFinite(B.interpAt(x, y, 0.05, true))).toBe(true);
    expect(B.interpAt(x, y, 0.05, true)).toBeCloseTo(0.5, 9);
  });

  test('log ızgara ÇAĞIRAN tarafından bildirilir, tahmin edilmez', () => {
    // Aynı diziyi iki farklı yorumla okumak iki farklı sonuç verir; hangisinin
    // doğru olduğunu veri değil, veriyi üreten küme bilir.
    const x = [1, 10], y = [0, 1];
    expect(B.interpAt(x, y, Math.sqrt(10), true)).toBeCloseTo(0.5, 6);   // log ortası
    expect(B.interpAt(x, y, Math.sqrt(10))).toBeCloseTo(0.2402, 3);      // doğrusal
  });

  test('aralık dışı sorulursa sayı UYDURULMAZ', () => {
    const x = [1, 2, 3], y = [1, 2, 3];
    expect(Number.isNaN(B.interpAt(x, y, 0.5))).toBe(true);
    expect(Number.isNaN(B.interpAt(x, y, 9))).toBe(true);
    expect(Number.isNaN(B.interpAt(null, y, 2))).toBe(true);
  });
});

describe('peaks — rezonans tepeleri', () => {
  test('yerel en büyükleri büyükten küçüğe verir', () => {
    const x = [1, 2, 3, 4, 5, 6, 7];
    const y = [0, 5, 0, 9, 0, 3, 0];
    const p = B.peaks(x, y, 1);
    expect(p.map((q) => q.f)).toEqual([4, 2, 6]);
    expect(p[0].v).toBe(9);
  });

  test('eşiğin altındaki dalgalanma tepe sayılmaz', () => {
    const x = [1, 2, 3], y = [0, 0.4, 0];
    expect(B.peaks(x, y, 1.05)).toEqual([]);
  });

  test('uçlar tepe sayılmaz — komşusu olmayan nokta karşılaştırılamaz', () => {
    const x = [1, 2, 3], y = [9, 0, 9];
    expect(B.peaks(x, y, 1)).toEqual([]);
  });
});

describe('lastCrossBelow — izolasyonun başladığı nokta', () => {
  test('SAĞDAN taranır: son geçiş bulunur, ilk geçiş değil', () => {
    // İki tepe arasında eğri 1'in altına iner ve tekrar çıkar. "Kalıcı olarak
    // altına indiği" nokta SONUNCU geçiştir; soldan taramak erken bir frekans
    // bildirir ve kullanıcı izolasyonu olduğundan geniş sanır.
    const x = [1, 2, 3, 4, 5];
    const y = [2, 0.5, 2, 0.5, 0.2];
    expect(B.lastCrossBelow(x, y, 1)).toBeCloseTo(3 + (2 - 1) / (2 - 0.5), 9);
  });

  test('hiç geçmiyorsa sayı üretilmez', () => {
    expect(Number.isNaN(B.lastCrossBelow([1, 2], [3, 4], 1))).toBe(true);
  });
});

describe('firstNonZero — ilk çekme / ilk durdurucu teması', () => {
  test('sayacın ilk kez sıfırdan büyüdüğü x', () => {
    const x = [0, 1, 2, 3], y = [0, 0, 1, 2];
    expect(B.firstNonZero(x, y)).toBe(2);
  });

  test('hep sıfırsa olay yok', () => {
    expect(Number.isNaN(B.firstNonZero([0, 1], [0, 0]))).toBe(true);
  });
});

describe('engineFiring — ateşleme frekansı', () => {
  test('4 zamanlı motor: devir/60 × silindir/2', () => {
    const e = B.engineFiring({ gather: { torque: { idleRpm: 750, cylinders: 6 } } });
    expect(e.f).toBeCloseTo(37.5, 9);
  });

  test('motor tanımı eksikse null — "bilinmiyor" cümlesi yazılmaz', () => {
    expect(B.engineFiring({ gather: { torque: { idleRpm: 750 } } })).toBeNull();
    expect(B.engineFiring({ gather: { torque: { cylinders: 4 } } })).toBeNull();
    expect(B.engineFiring({})).toBeNull();
    expect(B.engineFiring(null)).toBeNull();
  });
});

describe('mod etiketleri Türkçeleşir', () => {
  test('çekirdeğin İngilizce etiketi okunur hâle gelir', () => {
    expect(B.modeTR('bounce')).toContain('zıplama');
    expect(B.modeTR('roll')).toContain('yalpalama');
    expect(B.modeTR('bounce+pitch')).toContain('+');
    expect(B.modeShort('bounce+pitch')).toBe('zıplama+baş-kıç');
  });

  test('bilinmeyen etiket olduğu gibi kalır — uydurma çeviri yok', () => {
    expect(B.modeTR('serbest mod (f≈0) ⚠')).toBe('serbest mod (f≈0) ⚠');
  });
});

describe('build — üretilemeyen yorum null döner', () => {
  test('çözüm yoksa / hatalıysa yorum yok', () => {
    expect(B.build(null, {})).toBeNull();
    expect(B.build({ key: 'frf' }, null)).toBeNull();
    expect(B.build({ key: 'frf' }, { error: ['x'] })).toBeNull();
  });

  test('bilinmeyen küme sessizce null — patlamaz', () => {
    expect(B.build({ key: 'yok', x: { data: [] }, channels: [] }, { mounts: [] })).toBeNull();
  });
});

describe('campbellCrossings — rezonans devri', () => {
  // Kesişim devri N = f·60/mertebe. Bu bağıntıda bir kayma, kullanıcıyı yanlış
  // devirde sorun aramaya gönderir; cümle akıcı, sayı yanlış olur.
  const ords = [{ o: 1 }, { o: 3, firing: true }];
  const mds = [{ no: 1, f: 10, label: 'zıplama' }, { no: 2, f: 20, label: 'yalpalama' }];

  test('N = f · 60 / mertebe', () => {
    const cr = B.campbellCrossings(ords, mds, 5000);
    const at = (o, f) => cr.find((c) => c.o === o && c.f === f).rpm;
    expect(at(1, 10)).toBeCloseTo(600, 9);
    expect(at(3, 10)).toBeCloseTo(200, 9);
    expect(at(1, 20)).toBeCloseTo(1200, 9);
    expect(at(3, 20)).toBeCloseTo(400, 9);
  });

  test('devirden küçüğe göre sıralı — okuma sırası bu', () => {
    const cr = B.campbellCrossings(ords, mds, 5000);
    for (let i = 1; i < cr.length; i++) expect(cr[i].rpm).toBeGreaterThanOrEqual(cr[i - 1].rpm);
  });

  test('devir tavanının üstündeki kesişim RAPORLANMAZ', () => {
    // Grafikte görünmeyen bir kesişimi yorumda saymak, kullanıcıyı olmayan
    // bir çizgiyi aramaya gönderir.
    const cr = B.campbellCrossings(ords, mds, 700);
    expect(cr.every((c) => c.rpm <= 700)).toBe(true);
    expect(cr.some((c) => c.o === 1 && c.f === 20)).toBe(false);   // 1200 d/dk
  });

  test('ateşleme bayrağı kesişime taşınır', () => {
    const cr = B.campbellCrossings(ords, mds, 5000);
    expect(cr.filter((c) => c.firing).every((c) => c.o === 3)).toBe(true);
    expect(cr.some((c) => c.firing)).toBe(true);
  });

  test('geçersiz mertebe / frekans kesişim üretmez', () => {
    expect(B.campbellCrossings([{ o: 0 }], mds, 5000)).toEqual([]);
    expect(B.campbellCrossings(ords, [{ no: 1, f: 0 }], 5000)).toEqual([]);
  });
});
