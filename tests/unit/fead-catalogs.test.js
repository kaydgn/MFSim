/**
 * fead-catalogs.test.js — BMC MOTOR VE AKSESUAR KATALOGLARI
 *
 * İki katalog da `KIRPI_II_NEX_GEN.FEAD.xlsx` defterinin kendi sayfalarından
 * çıkarıldı (BMC SAS ARGE / ADEM CAM, 13.08.2026). Defter depoda DEĞİL —
 * kullanıcının gönderdiği bir dosya — bu yüzden kapı, çıkarılan sayıların
 * defterle karşılaştırılması olamaz; onun yerine ÜÇ SINIFI tutuyor:
 *
 * 1. YAPISAL BÜTÜNLÜK — anahtar tekilliği, devirlerin sıralı olması, eğrilerin
 *    devirde ARTAN olması. Üçüncüsü bir çıkarma hatasını yakalayan kapı:
 *    defterin eğri bloklarının SAĞINDA 1,2,3… diye giden bir indis sütunu var
 *    ve ilk çıkarma onu eğriye katmıştı (motor eğrisi 2850 d/dk'dan sonra
 *    19'a düşüyordu). Artan-devir kuralı o hatanın tekrarını imkânsız kılar.
 *
 * 2. NOKTA ÇIPALARI — defterden okunan ve tek tek doğrulanan değerler.
 *    Sürüklenirlerse çıkarma bozulmuş demektir.
 *
 * 3. SÖZLEŞME — `veFeadEngineApply` / `veFeadAccApply` neyi yazar, neyi
 *    yazmaz. "Boş eğri yazılmaz" kuralı bir incelik değil: Prestolite 120A'nın
 *    devir/kW satırları defterde BOŞ ve katalog uygulamak kullanıcının kendi
 *    tablosunu silseydi, kW'ı sessizce sıfırlanmış bir aksesuar kalırdı.
 */
const E = require('../../js/fead-engines.js');
const A = require('../../js/fead-accessories.js');
const fs = require('fs');
const path = require('path');

const IDX = fs.readFileSync(path.join(__dirname, '../../index.html'), 'utf8');

// ───────────────────────────────────────────────────────── MOTOR KATALOĞU ──
describe('Motor kataloğu — yapısal bütünlük', () => {
  test('yirmi dört kayıt, anahtarlar tekil', () => {
    expect(E.VE_FEAD_ENGINE_DB.length).toBe(24);
    const keys = E.VE_FEAD_ENGINE_DB.map((e) => e.key);
    expect(new Set(keys).size).toBe(24);
  });

  test('her kaydın adı ve BMC numarası dolu', () => {
    E.VE_FEAD_ENGINE_DB.forEach((e) => {
      expect(typeof e.key).toBe('string');
      expect(e.key.length).toBeGreaterThan(5);
      expect(typeof e.ad).toBe('string');
      expect(e.ad.length).toBeGreaterThan(3);
    });
  });

  test('devir sınırları sıralı: rölanti < governed ≤ no load governed < overspeed', () => {
    E.VE_FEAD_ENGINE_DB.forEach((e) => {
      expect(e.idleRpm).toBeGreaterThan(0);
      expect(e.governedRpm).toBeGreaterThan(e.idleRpm);
      if (e.noLoadGovernedRpm != null)
        expect(e.noLoadGovernedRpm).toBeGreaterThanOrEqual(e.governedRpm);
      if (e.overspeedRpm != null) {
        const alt = e.noLoadGovernedRpm != null ? e.noLoadGovernedRpm : e.governedRpm;
        expect(e.overspeedRpm).toBeGreaterThan(alt);
      }
    });
  });

  // BU KAPI BİR ÇIKARMA HATASINI TUTUYOR (dosya başlığındaki 1. sınıf).
  test('tork/güç eğrileri devirde KESİN ARTAN — indis sütunu eğriye sızmamış', () => {
    E.VE_FEAD_ENGINE_DB.forEach((e) => {
      expect(e.curve.length).toBeGreaterThanOrEqual(9);
      for (let i = 1; i < e.curve.length; i++)
        expect(e.curve[i].rpm).toBeGreaterThan(e.curve[i - 1].rpm);
      e.curve.forEach((p) => {
        expect(Number.isFinite(p.rpm)).toBe(true);
        expect(p.rpm).toBeGreaterThan(200);      // indis sütunu 1…24 idi
        expect(Number.isFinite(p.nm)).toBe(true);
        expect(Number.isFinite(p.kw)).toBe(true);
      });
    });
  });

  test('eğrinin devir bandı motorun kendi sınırlarıyla tutarlı', () => {
    E.VE_FEAD_ENGINE_DB.forEach((e) => {
      const son = e.curve[e.curve.length - 1].rpm;
      // Eğri governed'ın belirgin altında bitmemeli (yarım bir eğri, tam yük
      // gücünü sessizce düşük gösterirdi) ve overspeed'i aşmamalı.
      expect(son).toBeGreaterThanOrEqual(e.governedRpm * 0.9);
      if (e.overspeedRpm != null) expect(son).toBeLessThanOrEqual(e.overspeedRpm);
    });
  });

  test('eksik alan null — sıfır DEĞİL', () => {
    E.VE_FEAD_ENGINE_DB.forEach((e) => {
      ['crankOD', 'fanDriveOD', 'compGearOD', 'compGearRatio', 'waterPumpOD'].forEach((k) => {
        expect(e[k] === null || e[k] > 0).toBe(true);
      });
    });
  });

  test('silindir sayısı: ISB4.5 sıra-4, kalan yirmi üçü sıra-6', () => {
    const dort = E.VE_FEAD_ENGINE_DB.filter((e) => e.cyl === 4);
    expect(dort.length).toBe(1);
    expect(dort[0].ad).toMatch(/^ISB4\.5/);
    expect(E.VE_FEAD_ENGINE_DB.filter((e) => e.cyl === 6).length).toBe(23);
  });
});

describe('Motor kataloğu — defter çıpaları', () => {
  // KIRPI II'nin kendi motoru. Defterin "Komponent Secimi" sayfası bu satırı
  // INDEX/MATCH ile çekiyor; beş sayının beşi de oradan okundu.
  test('57RS303234 (ISL8.9E3 375) künyesi birebir', () => {
    const e = E.veFeadEngineOf('57RS303234');
    expect(e.ad).toBe('ISL8.9E3 375/FR94882');
    expect(e.idleRpm).toBe(700);
    expect(e.governedRpm).toBe(2100);
    expect(e.noLoadGovernedRpm).toBe(2330);
    expect(e.overspeedRpm).toBe(2900);
    expect(e.crankOD).toBe(218.3);
    expect(e.fanDriveOD).toBe(179.62);
  });

  // Defterin "Motor Bilgileri" AM:AO bloğu bu eğriyi seçili motordan kopyalıyor
  // ve "Spanlardaki frekans" sayfası onu devir ekseninde kullanıyor.
  test('57RS303234 eğrisi defterin AM:AO bloğuyla aynı', () => {
    const e = E.veFeadEngineOf('57RS303234');
    expect(e.curve.map((p) => p.rpm)).toEqual(
      [800, 1000, 1100, 1200, 1400, 1500, 1600, 1700, 1800, 1900, 2000, 2100]);
    expect(e.curve.map((p) => p.nm)).toEqual(
      [950, 1356, 1550, 1550, 1550, 1508, 1466, 1424, 1380, 1338, 1296, 1250]);
    expect(e.curve.map((p) => p.kw)).toEqual(
      [80, 142, 179, 195, 227, 237, 246, 253, 260, 266, 271, 275]);
  });

  test('aynı model, farklı krank çapı — üç ISL8.9E3 375 kaydı ayrışıyor', () => {
    const l = E.veFeadEngineFind('ISL8.9E3 375');
    expect(l.map((e) => e.key).sort())
      .toEqual(['57RS303234', '57RS303252', '57RS303315']);
    // Anahtar model adı DEĞİL parça numarası: krank çapı 218,3 ↔ 197,72 ayrılıyor.
    expect(l.find((e) => e.key === '57RS303234').crankOD).toBe(218.3);
    expect(l.find((e) => e.key === '57RS303252').crankOD).toBe(197.72);
  });

  test('ara değerleme uçlarda SABİT tutar, ekstrapolasyon yapmaz', () => {
    const e = E.veFeadEngineOf('57RS303234');
    expect(E.veFeadEngineAt(e, 1500)).toEqual({ nm: 1508, kw: 237 });
    // Tam ortada doğrusal
    const m = E.veFeadEngineAt(e, 1550);
    expect(m.nm).toBeCloseTo((1508 + 1466) / 2, 6);
    expect(m.kw).toBeCloseTo((237 + 246) / 2, 6);
    // Uçların dışı: sabit
    expect(E.veFeadEngineAt(e, 100)).toEqual({ nm: 950, kw: 80 });
    expect(E.veFeadEngineAt(e, 9000)).toEqual({ nm: 1250, kw: 275 });
  });
});

describe('Motor kataloğu — uygulama sözleşmesi', () => {
  test('apply: silindir, dört devir ve birinci kademe çapları yazılır', () => {
    const sd = {};
    E.veFeadEngineApply(sd, '57RS303234');
    expect(sd.engineLib).toBe('57RS303234');
    expect(sd.cylinders).toBe(6);
    expect(sd.governedRpm).toBe(2100);
    expect(sd.overspeedRpm).toBe(2900);
    expect(sd.crankOD).toBe(218.3);
    expect(sd.fanOD).toBe(179.62);
    expect(sd.ratioMode).toBe('derive');
  });

  // Katalogda null olan alana DOKUNULMAZ: kullanıcının kendi girdiği fan çapını
  // silmek, olmayan bir bilgiyi dayatmak olurdu.
  test('apply: katalogda null olan alan kullanıcının değerini EZMEZ', () => {
    const e = E.VE_FEAD_ENGINE_DB.find((x) => x.fanDriveOD === null && x.crankOD !== null);
    expect(e).toBeTruthy();
    const sd = { fanOD: 150 };
    E.veFeadEngineApply(sd, e.key);
    expect(sd.fanOD).toBe(150);
    expect(sd.crankOD).toBe(e.crankOD);
  });

  test('apply: iki çaptan biri yoksa ratioMode değiştirilmez', () => {
    const e = E.VE_FEAD_ENGINE_DB.find((x) => x.fanDriveOD === null);
    const sd = { ratioMode: 'direct', driveRatio: 1 };
    E.veFeadEngineApply(sd, e.key);
    expect(sd.ratioMode).toBe('direct');
  });

  test('drift: elle değiştirilen alan raporlanır, katalogda olmayan alan sayılmaz', () => {
    const sd = {};
    E.veFeadEngineApply(sd, '57RS303234');
    expect(E.veFeadEngineDrift(sd).drift).toEqual([]);
    sd.governedRpm = 2200;
    const d = E.veFeadEngineDrift(sd);
    expect(d.drift.length).toBe(1);
    expect(d.drift[0]).toMatch(/governed/);
    // Metin karşılaştırması olsaydı "2100" ≠ 2100 diye yanlış alarm verirdi.
    sd.governedRpm = '2100';
    expect(E.veFeadEngineDrift(sd).drift).toEqual([]);
  });

  test('bilinmeyen anahtar hiçbir şey yazmaz', () => {
    const sd = { cylinders: 4 };
    E.veFeadEngineApply(sd, 'YOK');
    expect(sd).toEqual({ cylinders: 4 });
    expect(E.veFeadEngineOf('YOK')).toBeNull();
    expect(E.veFeadEngineSpeeds('YOK')).toBeNull();
  });
});

// ────────────────────────────────────────────────────── AKSESUAR KATALOĞU ──
describe('Aksesuar kataloğu — yapısal bütünlük', () => {
  test('on alternatör + dört klima kompresörü, anahtarlar tekil', () => {
    expect(A.VE_FEAD_ACC_DB.length).toBe(14);
    expect(A.veFeadAccList('fead-alternator').length).toBe(10);
    expect(A.veFeadAccList('fead-ac').length).toBe(4);
    expect(new Set(A.VE_FEAD_ACC_DB.map((a) => a.key)).size).toBe(14);
  });

  test('üç devir sınırı sıralı: optimum ≤ sürekli ≤ anlık', () => {
    A.VE_FEAD_ACC_DB.forEach((a) => {
      expect(a.optimumRpm).toBeGreaterThan(0);
      expect(a.maxContRpm).toBeGreaterThanOrEqual(a.optimumRpm);
      expect(a.maxPeakRpm).toBeGreaterThanOrEqual(a.maxContRpm);
    });
  });

  test('güç eğrileri devirde KESİN ARTAN, güç negatif değil', () => {
    A.VE_FEAD_ACC_DB.forEach((a) => {
      for (let i = 1; i < a.curve.length; i++)
        expect(a.curve[i].rpm).toBeGreaterThan(a.curve[i - 1].rpm);
      a.curve.forEach((p) => {
        expect(p.rpm).toBeGreaterThan(200);
        expect(p.kw).toBeGreaterThanOrEqual(0);
      });
    });
  });

  // Model adı tek başına ayırt etmiyor: üç Prestolite 180A, iki 155A, iki TM31.
  test('etiket parça numarasını da taşır — aynı model birden çok kez geçiyor', () => {
    const adlar = A.VE_FEAD_ACC_DB.map((a) => a.ad);
    expect(new Set(adlar).size).toBeLessThan(adlar.length);
    A.veFeadAccList().forEach((r) => expect(r.label).toContain(r.key));
  });
});

describe('Aksesuar kataloğu — defter çıpaları', () => {
  test('Prestolite 155A (57RS309348) künyesi ve eğrisi birebir', () => {
    const a = A.veFeadAccOf('57RS309348');
    expect(a.ad).toBe('Prestolite 155A');
    expect(a.optimumRpm).toBe(6000);
    expect(a.maxContRpm).toBe(8000);
    expect(a.maxPeakRpm).toBe(12000);
    expect(a.curve.map((p) => p.rpm)).toEqual(
      [1000, 1200, 1400, 1600, 1800, 2000, 2500, 3000, 3500, 4000, 4500, 5000, 5500, 6000, 7000, 8000]);
    expect(a.curve.map((p) => p.kw)).toEqual(
      [0, 1.71, 2.42, 2.85, 3.14, 3.42, 3.85, 3.99, 4.08, 4.13, 4.16, 4.19, 4.25, 4.28, 4.28, 4.28]);
  });

  test('Valeo TM31 (57RS322530) künyesi ve eğrisi birebir', () => {
    const a = A.veFeadAccOf('57RS322530');
    expect(a.ad).toBe('Valeo TM31');
    expect(a.optimumRpm).toBe(1000);
    expect(a.maxContRpm).toBe(3000);
    expect(a.maxPeakRpm).toBe(6000);
    expect(a.curve.map((p) => p.kw)).toEqual([0.8, 2, 3.5, 5.5, 8.3, 10.6, 12.4]);
  });

  test('klima kompresörlerinin dördü de aynı devir penceresini paylaşıyor', () => {
    A.veFeadAccList('fead-ac').forEach((r) => {
      const a = A.veFeadAccOf(r.key);
      expect([a.optimumRpm, a.maxContRpm, a.maxPeakRpm]).toEqual([1000, 3000, 6000]);
    });
  });
});

describe('Aksesuar kataloğu — uygulama sözleşmesi', () => {
  test('apply: sınırlar ve eğri yazılır', () => {
    const n = { data: {} };
    A.veFeadAccApply(n, '57RS309348');
    expect(n.data.accLib).toBe('57RS309348');
    expect(n.data.maxContRpm).toBe(8000);
    expect(n.data.pwrCurve.length).toBe(16);
  });

  // DEFTERDE EĞRİSİ OLMAYAN KAYIT: sınırlar dolu, eğri boş. Boş eğriyi yazmak
  // kullanıcının kendi tablosunu silerdi ve kW sessizce sıfırlanırdı.
  test('apply: boş eğri kullanıcının tablosunu SİLMEZ', () => {
    const kendi = [{ rpm: 2000, kw: 3.1 }];
    const n = { data: { pwrCurve: kendi } };
    A.veFeadAccApply(n, '57RS309791');            // Prestolite 120A — eğrisi yok
    expect(A.veFeadAccOf('57RS309791').curve.length).toBe(0);
    expect(n.data.pwrCurve).toBe(kendi);
    expect(n.data.maxContRpm).toBe(9000);         // sınırlar yine de geldi
  });

  test('apply: eğri KOPYALANIR — düğümü düzenlemek kataloğu bozmaz', () => {
    const n = { data: {} };
    A.veFeadAccApply(n, '57RS322530');
    n.data.pwrCurve[0].kw = 99;
    expect(A.veFeadAccOf('57RS322530').curve[0].kw).toBe(0.8);
  });

  test('limits: ELLE girilen değer katalogtan üstün', () => {
    const l = A.veFeadAccLimits({ data: { accLib: '57RS309348', maxContRpm: 7500 } });
    expect(l.maxCont).toEqual({ rpm: 7500, kaynak: 'elle' });
    expect(l.maxPeak).toEqual({ rpm: 12000, kaynak: 'katalog' });
    expect(l.optimum).toEqual({ rpm: 6000, kaynak: 'katalog' });
  });

  // KATALOG UYGULAMAK ALANLARI DOLDURUYOR — sadece "dolu mu" diye bakan bir
  // kaynak tespiti, katalogdan gelen üç sayıyı da "elle girildi" sayardı.
  // Panelde tam olarak öyle görünüyordu ("3 alan elle girilmiş"); ölçüt
  // KATALOGTAN FARKLI OLMAK.
  test('limits: apply\'den sonra üç alan da "katalog" kaynaklı görünür', () => {
    const n = { data: {} };
    A.veFeadAccApply(n, '57RS309348');
    const l = A.veFeadAccLimits(n);
    expect(l.optimum.kaynak).toBe('katalog');
    expect(l.maxCont.kaynak).toBe('katalog');
    expect(l.maxPeak.kaynak).toBe('katalog');
    // Metin olarak yazılmış aynı sayı da katalog sayılır.
    n.data.maxContRpm = '8000';
    expect(A.veFeadAccLimits(n).maxCont.kaynak).toBe('katalog');
    n.data.maxContRpm = 7500;
    expect(A.veFeadAccLimits(n).maxCont.kaynak).toBe('elle');
  });

  test('limits: katalogsuz düğümde elle girilen sınırlar yine okunur', () => {
    const l = A.veFeadAccLimits({ data: { optimumRpm: 1200, maxContRpm: 4000 } });
    expect(l.key).toBeNull();
    expect(l.optimum.rpm).toBe(1200);
    expect(l.maxCont.rpm).toBe(4000);
    expect(Number.isNaN(l.maxPeak.rpm)).toBe(true);
  });

  test('unlink: bağ çözülür, ALANLAR KALIR', () => {
    // "— elle gir —" yolu: kullanıcı künyenin değerlerini alıp düzenlemek
    // istiyor (gergi künyesi kilidinin aynı kuralı).
    const n = { data: {} };
    A.veFeadAccApply(n, '57RS309348');
    A.veFeadAccUnlink(n);
    expect(n.data.accLib).toBeUndefined();
    expect(n.data.maxContRpm).toBe(8000);
    expect(n.data.pwrCurve.length).toBe(16);
  });

  // ── BAŞKA MODELE GEÇİŞ AYRI BİR YOLDUR (2026-09-01) ─────────────────────
  // ÖLÇÜLDÜ: bırakılan eğri yeni seçimi SESSİZCE eziyordu — güç önceliği
  // `duty kW > düğümün kendi eğrisi > katalog` ve künyenin yazdığı eğri
  // "düğümün kendi eğrisi" sayılıyor.
  describe('clearWritten: künyenin yazdığını siler, kullanıcınınkini KORUR', () => {
    test('künyenin yazdığı eğri ve üç sınır gider', () => {
      const n = { data: {} };
      A.veFeadAccApply(n, '57RS309348');
      A.veFeadAccClearWritten(n);
      expect(n.data.accLib).toBeUndefined();
      expect(n.data.accLibVer).toBeUndefined();
      expect(n.data.pwrCurve).toBeUndefined();
      expect(n.data.optimumRpm).toBeUndefined();
      expect(n.data.maxContRpm).toBeUndefined();
      expect(n.data.maxPeakRpm).toBeUndefined();
    });

    test('ELLE değiştirilen eğri ve sınır KALIR', () => {
      const n = { data: {} };
      A.veFeadAccApply(n, '57RS309348');
      n.data.pwrCurve = [{ rpm: 1000, kw: 1 }, { rpm: 2000, kw: 2 }];
      n.data.maxContRpm = 12345;
      A.veFeadAccClearWritten(n);
      expect(n.data.pwrCurve.length).toBe(2);
      expect(n.data.maxContRpm).toBe(12345);
      expect(n.data.maxPeakRpm).toBeUndefined();      // dokunulmayan gider
    });

    test('TEK BİR SAYI değişmişse eğri kullanıcınındır', () => {
      const n = { data: {} };
      A.veFeadAccApply(n, '57RS309348');
      const uzun = n.data.pwrCurve.length;
      n.data.pwrCurve[0].kw += 0.001;
      A.veFeadAccClearWritten(n);
      expect(n.data.pwrCurve.length).toBe(uzun);
    });

    test('künyesiz düğümde HİÇBİR ŞEYE dokunmaz', () => {
      const n = { data: { pwrCurve: [{ rpm: 1, kw: 1 }], maxContRpm: 5 } };
      A.veFeadAccClearWritten(n);
      expect(n.data.pwrCurve.length).toBe(1);
      expect(n.data.maxContRpm).toBe(5);
    });
  });

  test('tip eşlemesi tek kaynaktan', () => {
    expect(A.VE_FEAD_ACC_TYPE['fead-alternator']).toBe('alternator');
    expect(A.VE_FEAD_ACC_TYPE['fead-ac']).toBe('ac');
    expect(A.veFeadAccList('fead-idler').length).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────── YÜKLEME SIRASI ──
describe('index.html yükleme sırası', () => {
  test('üç yeni dosya da script etiketiyle yükleniyor', () => {
    ['js/fead-engines.js', 'js/fead-accessories.js', 'js/fead-checks.js']
      .forEach((f) => expect(IDX).toContain('src="' + f + '"'));
  });

  // Kapılar aksesuar kataloğunun `veFeadAccLimits`'ini ÇAĞIRIYOR; katalog
  // sonra yüklenirse çağrı çalışma anında tanımsız kalırdı.
  test('fead-accessories.js, fead-checks.js\'ten ÖNCE geliyor', () => {
    expect(IDX.indexOf('src="js/fead-accessories.js"'))
      .toBeLessThan(IDX.indexOf('src="js/fead-checks.js"'));
  });
});
