/**
 * fead-core.test.js — FEAD hesap çekirdeğinin DOĞRULAMA KAPISI
 *
 * `js/fead-core.js` MFSim'e DIŞARIDAN, hazır ve doğrulanmış olarak geldi:
 * 17 Gates raporundan çıkarılmış 2095 referans değerle kalibre edilmiş bir
 * çekirdek. Bu dosya o doğrulamayı MFSim'in kendi test koşusuna bağlar.
 *
 * NEDEN BÖYLE (kopya test yazmak yerine):
 * Referans veri ve karşılaştırma mantığı `tests/fixtures/fead-validation.js`
 * içinde, kaynağıyla BİREBİR duruyor (tek yerel fark: require yolu). Buradaki
 * testler o harness'ı KOŞTURUR ve yapısal sonuçlarına bakar. Referans sayıları
 * bu dosyaya kopyalasaydık iki nüsha olurdu ve biri sessizce eskirdi — oysa
 * bu verinin tek değeri birebir doğru olması.
 *
 * ÖLÇÜT NEREDEN GELİYOR (harness'ın kendi eşikleri, opts ile değiştirilebilir):
 *   • çalışma konumları  %0.5   — Load HARİÇ tüm yüzde karşılaştırmaları
 *   • Load dahil         %1.5   — "Load" bir MEKANİK STOP'tur, çalışma noktası
 *                                 değil; orada sarım sıfıra yaklaştığı için
 *                                 T = M/(r·sinβ·2sin(φ/2)) tekilleşir ve raporun
 *                                 bastığı kol açısındaki 0.1° yuvarlama tek
 *                                 başına %1.4–2.3 fark yaratır (bkz. SPEC §7e).
 *   • kol açıları        0.2°   — mutlak derece; sıfıra yakın açıda yüzde
 *                                 hatası anlamsız (4.7 vs 4.14 → %12).
 *
 * KAPSAM DIŞI — bilerek: mutlak B10 ömrü ve doğal frekans. İkisi de
 * spesifikasyonun §7'sinde "geçerlilik sınırı" olarak işaretli; harness
 * onları ayrı ve gevşek ölçütle raporlar, kapıya sokmayız.
 */
const V = require('../fixtures/fead-validation.js');
const F = require('../../js/fead-core.js');

// Harness ~130 ms sürüyor; bir kez koşup tüm testler aynı sonuca baksın.
const R = V.run();

describe('Gates referans doğrulaması — 17 rapor, 2095 değer', () => {
  test('deterministik fizik: çalışma konumları %0.5 içinde', () => {
    // Hata mesajı hangi satırın kaçırdığını söylesin — çıplak sayı teşhis etmez.
    const w = R.worstOpRow;
    expect({ enKotu: w && w.label, hesap: w && w.calc, referans: w && w.ref, hataPct: R.maxErrOpPct })
      .toMatchObject({ hataPct: expect.any(Number) });
    expect(R.maxErrOpPct).toBeLessThan(0.5);
  });

  test('Load (mekanik stop) dahil tüm yüzde karşılaştırmaları %1.5 içinde', () => {
    expect(R.maxErrPct).toBeLessThan(1.5);
  });

  test('gergi kol açıları 0.2 derece içinde', () => {
    expect(R.maxErrDeg).toBeLessThan(0.2);
  });

  test('harness kendi bütünsel ölçütünü de geçiyor', () => {
    expect(R.pass).toBe(true);
  });

  // Veri setinin sessizce küçülmesine karşı kapı: bir suit devre dışı kalır ya
  // da bir rapor düşerse yüzde ölçütleri YİNE geçer (daha az değer, daha az
  // hata şansı) — kaçırılan tek şey kapsam olur. Sayı bu yüzden ayrı tutuluyor.
  test('kapsam korunuyor: 17 veri seti, en az 2095 değer', () => {
    expect(R.suites.length).toBeGreaterThanOrEqual(17);
    expect(R.total).toBeGreaterThanOrEqual(2095);
  });

  test('kaburga yorulma dağılımı: RMS 1.5 yüzde puanının altında', () => {
    const suit = R.suites.filter((s) => s.rmsPt);
    expect(suit.length).toBeGreaterThan(0);
    suit.forEach((s) => expect(s.rmsPt).toBeLessThan(1.5));
  });
});

// Sessizce yanlış sonuç üretmek, hata fırlatmaktan KÖTÜDÜR. Harness sekiz
// tuzağı deniyor; hepsinin atması gerekir. Biri "hata atmadi" derse çekirdek
// o durumda makul görünen ama yanlış bir tasarım üretiyor demektir.
describe('koruma mekanizmaları — hepsi hata fırlatmalı', () => {
  test('sekiz korumanın hepsi çalışıyor', () => {
    const basarisiz = R.guards.tests.filter((g) => !g.ok).map((g) => g.name);
    expect(basarisiz).toEqual([]);
    expect(R.guards.tests.length).toBeGreaterThanOrEqual(8);
    expect(R.guards.pass).toBe(true);
  });
});

/**
 * Spesifikasyon §9'un YAPISAL kabul testleri.
 *
 * Bunlar rapor karşılaştırması DEĞİL, çekirdeğin kendi içinde tutması gereken
 * özdeşlikler — referans veriye ihtiyaç duymazlar, bu yüzden burada açıkça
 * yazılabilirler (ikinci bir nüsha oluşmaz). Rapor karşılaştırmalı olanlar
 * (take-up, β, konum tablosu) yukarıdaki eşiklerin içinde ölçülüyor.
 */
describe('Spesifikasyon §9 — yapısal özdeşlikler', () => {
  const sys = V.buildMisc('AG00686');
  const geom = F.tensionerState(sys, F.meanRel(sys)).geom;

  test('sarım değişmezi: Σ(kaburgalı) − Σ(sırttan) = 360°', () => {
    expect(Math.abs(geom.signedWrapDeg)).toBeCloseTo(360, 6);
  });

  test('boy özdeşliği: L_pitch − L_eff = 2π·hb (yerleşimden bağımsız)', () => {
    const hb = F.beltProps(sys.belt).hb;
    expect(geom.LpitchMm - geom.LeffMm).toBeCloseTo(2 * Math.PI * hb, 6);
  });

  test('sürücü gücü diğer kasnakların toplamına eşit (çevrim kapanır)', () => {
    const t = F.spanTensions(sys, {
      engineRpm: 1250, loadsKw: { IDR: 0.01, A_C: 5, TEN: 0.01 },
    });
    const c = sys._crkIdx;
    const digerleri = t.perPulley.reduce((a, p, i) => a + (i === c ? 0 : p.powerKw), 0);
    expect(t.perPulley[c].powerKw).toBeCloseTo(digerleri, 9);
  });

  test('gerilme zinciri bir tur sonra ankraja döner', () => {
    const t = F.spanTensions(sys, {
      engineRpm: 1250, loadsKw: { IDR: 0.01, A_C: 5, TEN: 0.01 },
    });
    const n = sys._n, c = sys._crkIdx, ti = sys._tenIdx;
    const sonKasnak = (ti - 1 + n) % n;
    const adim = (ti === c ? +1 : -1) * (t.perPulley[ti].powerKw * 1000) / t.vMs;
    expect(t.spanN[sonKasnak] + adim).toBeCloseTo(t.spanN[ti], 6);
  });

  test('çap katmanı: kaburgalı ve sırttan yarıçaplar SPEC ile aynı', () => {
    const bp = F.beltProps({ profile: 'PK', brand: 'GATES' });
    expect([bp.hb, bp.hr]).toEqual([1.2, 1.1]);
    // kaburgalı: rPitch = OD/2 + hb ,  rEff = OD/2
    const g = F.radiiFromOD(160, 'grooved', bp);
    expect(g.rPitch).toBeCloseTo(81.2, 9);
    expect(g.rEff).toBeCloseTo(80, 9);
    // sırttan  : rPitch = OD/2 + hr ,  rEff = OD/2 + hr + hb
    // (toEqual DEĞİL: 37.5+1.1+1.2 kayan noktada 39.800000000000004 veriyor)
    const b = F.radiiFromOD(75, 'back', bp);
    expect(b.rPitch).toBeCloseTo(38.6, 9);
    expect(b.rEff).toBeCloseTo(39.8, 9);
  });
});

// Çekirdek tarayıcıda da yüklenecek (index.html): UMD sarmalı window.FEADCore
// kurmalı. Node tarafı zaten require ile kanıtlandı; burada tarayıcı dalı.
describe('tarayıcı köprüsü', () => {
  test('UMD sarmalı window.FEADCore kurar ve sürümünü bildirir', () => {
    const fs = require('fs');
    const path = require('path');
    const src = fs.readFileSync(path.join(__dirname, '../../js/fead-core.js'), 'utf8');
    const kap = {};
    // module/exports görünmesin ki UMD tarayıcı dalına düşsün
    new Function('self', 'module', 'exports', src).call(kap, kap, undefined, undefined);
    expect(kap.FEADCore).toBeDefined();
    expect(kap.FEADCore.VERSION).toBe(F.VERSION);
    expect(typeof kap.FEADCore.analyze).toBe('function');
  });
});

// ════════════════════════════════════════════════════════════════════════════
//  BURULMA (DÖNEL TİTREŞİM) MODELİ — torsionalModel()
// ════════════════════════════════════════════════════════════════════════════
// Çekirdeğe sonradan eklenen ÇOK SERBESTLİK DERECELİ model. Statik zincirden
// (17 rapor / 2095 değer / %0.33) farklı bir şey: KALİBRE bir model, iki serbest
// parametresi var (kord rijitliği, kavis payı). Bu yüzden kapısı da iki katmanlı:
//
//   • YAPISAL özdeşlikler — kalibrasyondan BAĞIMSIZ, sıkı tolerans
//   • KALİBRASYON — Gates "System Resonance (Mode 1)" satırına gevşek tolerans
//
// Kalibrasyon takımı doğrulama fixture'ının içinde zaten duruyordu (AG_MISC'in
// `NF` ve `inertia` alanları) ama koşucu onları BESLEMİYOR — harness statik
// zincire bakıyor. Burada besleniyorlar.
describe('torsionalModel — burulma modeli', () => {
  const V = require('../fixtures/fead-validation.js');
  const { vibrationOf } = require('../helpers/gates-vibration.js');

  // GİRDİLER DE REFERANS DA KAYNAĞINDAN OKUNUR — `docs/gates-reports/pdf/`
  // altındaki raporun "System Vibration Analysis" sayfasından. Teste elle
  // yazılsalardı ikinci bir kopya doğardı; kaynağından sessizce ayrışması bu
  // projenin en pahalı hata sınıfı. Arşiv depoda olduğu için okumak mümkün
  // (10 PDF 261 ms, modül önbellekli).
  //
  // BU ÜÇ KUSURU KAPATTI — üçü de ölçüldü, üçü de sessizdi:
  //   1. Krank mili ataleti BEŞ sistem için 0.7'ye SABİTLENMİŞTİ; raporlar
  //      sistem başına 0.15 / 0.5 / 0.7 diyor ve 0.7 yalnız takımın DIŞINDAKİ
  //      AG00810'da doğru. Fixture doğru değeri iki sistemde zaten taşıyordu.
  //   2. Gergi kasnak kütlesi çekirdeğin künyesinden TÜRETİLİYORDU ve
  //      AG00810'da null dönüyordu ("kütle bilinmiyor"); raporunun kendi
  //      sayfası 0.80 kg yazıyor.
  //   3. NF referanslarının üçü kaynağıyla uyuşmuyordu (11.87 ↔ 12.61 ·
  //      13.35 ↔ 12.61 · 13.29 ↔ 15.05). Gates SÜRÜM farkı değil: damgalar
  //      birebir aynı (9.37 / 9.40 / 4.32) ve tasarım adları doğru sistemler.
  const kurTors = (key) => {
    const v = vibrationOf(key);
    const sys = V.buildMisc(key);
    sys.pulleys.forEach((p) => {
      p.inertiaKgM2 = p.crank ? v.crankInertiaKgM2
        : (v.accessoryInertia[p.name] != null ? v.accessoryInertia[p.name] : 0.0002);
    });
    sys.tensioner.armInertiaKgM2 = v.armInertiaKgM2;
    sys.tensioner.pulleyMassKg = v.pulleyMassKg;
    sys._cache = {};
    return { sys, ref: v.mode1Hz };
  };

  // KALİBRASYON TAKIMI — %10 bandına düşen sistemler. Arşivde titreşim sayfası
  // olan YEDİ raporun tamamı kaynak girdileriyle koşuldu; beşi banda düşüyor.
  // Dışarıda kalan ikisi (AG00810 %16.6, AG00879 %13.4) aşağıda ayrıca
  // belgeleniyor — ikisi de artık GERÇEK model sapması, "veri eksik" değil.
  const TAKIM = ['AG00686', 'AG00686-1520', 'AG0868-4PK', 'AG0868-6PK', 'AG0868'];

  describe('YAPISAL — kalibrasyondan bağımsız', () => {
    test('tam BİR rijit cisim modu (f = 0): K tekil, sistem birlikte döner', () => {
      TAKIM.forEach((k) => {
        const T = F.torsionalModel(kurTors(k).sys, {});
        expect(T.rigidBodyModes).toBe(1);
        expect(T.modes.length).toBe(T.dofNames.length);
        expect(T.modes[0].fHz).toBeLessThan(1e-6);      // sıralı: en küçük önde
        expect(T.firstElasticHz).toBeGreaterThan(0);
      });
    });

    test('TAKE-UP ÖZDEŞLİĞİ: Σ(∂span/∂kol) = gergi take-up oranı', () => {
      // Modelin kendi iç tutarlılık kapısı ve aynı zamanda çekirdeğin kendi
      // yorumunun kanıtı: kol→span türevleri PROJEKSİYONLA alınıyor
      // (u·v), serbest span boyunun sonlu farkıyla DEĞİL. Çekirdeğin notu
      // sonlu farkın %3–49 saptığını söylüyor; projeksiyon tam oturuyor.
      TAKIM.forEach((k) => {
        const T = F.torsionalModel(kurTors(k).sys, {});
        expect(T.takeupCheck.errPct).toBeLessThan(0.01);
      });
    });

    test('yalnız gergiye KOMŞU iki span kol hareketinden etkilenir', () => {
      const { sys } = kurTors('AG00686');
      const T = F.torsionalModel(sys, {});
      const t = sys._tenIdx, n = sys._n;
      T.armTakeupMPerRad.forEach((a, i) => {
        if (i === t || i === (t - 1 + n) % n) expect(Math.abs(a)).toBeGreaterThan(1e-4);
        else expect(a).toBe(0);          // sabit kasnaklar arası span kıpırdamaz
      });
    });

    test('kasnak kütlesi kol boyu yarıçapında NOKTA KÜTLE olarak eklenir', () => {
      const { sys } = kurTors('AG0868');            // kol 0.0009, kütle 0.80
      const L = sys.tensioner.armLength / 1000;
      const T = F.torsionalModel(sys, {});
      expect(T.armInertiaUsedKgM2).toBeCloseTo(0.0009 + 0.80 * L * L, 12);

      // ve bu terim İHMAL EDİLEMEZ: bu gergide m·L² kol ataletinin 7 katı.
      const yalin = JSON.parse(JSON.stringify(sys));
      delete yalin.tensioner.pulleyMassKg;
      const T2 = F.torsionalModel(F.makeSystem(yalin), {});
      expect(T2.firstElasticHz / T.firstElasticHz).toBeGreaterThan(1.3);
    });

    test('eksik atalet SESSİZCE 0 sayılmaz, açık hata verir', () => {
      const { sys } = kurTors('AG00686');
      const eksik = JSON.parse(JSON.stringify(sys));
      delete eksik.pulleys[1].inertiaKgM2;
      expect(() => F.torsionalModel(F.makeSystem(eksik), {}))
        .toThrow(/atalet momenti yok/i);
      const kolsuz = JSON.parse(JSON.stringify(sys));
      delete kolsuz.tensioner.armInertiaKgM2;
      expect(() => F.torsionalModel(F.makeSystem(kolsuz), {}))
        .toThrow(/armInertiaKgM2 gerekli/i);
    });

    test('kord rijitliği yoksa açık hata (sessizce varsayılan uydurulmaz)', () => {
      const { sys } = kurTors('AG00686');
      const bp = Object.assign({}, sys._bp); delete bp.cordStiffnessNPerRib;
      const s2 = Object.assign({}, sys, { _bp: bp, belt: Object.assign({}, sys.belt) });
      delete s2.belt.cordStiffnessN;
      expect(() => F.spanStiffness(s2, F.geometryAt(sys, F.meanRel(sys)), {}))
        .toThrow(/kord rijitligi yok/i);
    });
  });

  describe('KALİBRASYON — Gates "System Resonance (Mode 1)"', () => {
    test('beş sistemde RMS %8 içinde, en kötü %10', () => {
      const err = TAKIM.map((k) => {
        const { sys, ref } = kurTors(k);
        return Math.abs(F.torsionalModel(sys, {}).firstElasticHz / ref - 1) * 100;
      });
      const rms = Math.sqrt(err.reduce((a, x) => a + x * x, 0) / err.length);
      expect(rms).toBeLessThan(8);
      expect(Math.max.apply(null, err)).toBeLessThan(10);
    });

    test('KABURGA ÖLÇEKLEMESİ doğru: AG0868 4/6/8PK ailesi', () => {
      // Kontrollü deney — AYNI kasnaklar, AYNI geometri, yalnız kaburga sayısı
      // (ve tasarım gerginliği) değişiyor. Kord rijitliği kaburgayla orantılı
      // olduğu için frekans √kaburga gibi büyümeli; modelin en anlamlı sınavı.
      const f = ['AG0868-4PK', 'AG0868-6PK', 'AG0868']
        .map((k) => F.torsionalModel(kurTors(k).sys, {}).firstElasticHz);
      expect(f[0]).toBeLessThan(f[1]);
      expect(f[1]).toBeLessThan(f[2]);
      // ölçülmüş: 29.1 · 35.7 · 41.2 Hz  (Gates 28.3 · 37.6 · 45.6)
      expect(f[0]).toBeCloseTo(29.1, 0);
      expect(f[1]).toBeCloseTo(35.7, 0);
      expect(f[2]).toBeCloseTo(41.2, 0);
      // √(kaburga) ölçeklemesi: f(8PK)/f(4PK) ≈ √2 mertebesinde
      expect(f[2] / f[0]).toBeGreaterThan(1.30);
      expect(f[2] / f[0]).toBeLessThan(1.50);
    });

    test('KRANK ataleti kasnak ataletiyle karıştırılırsa model çöker', () => {
      // Bu, köprüdeki veFeadTorsionalOpt'un varlık nedeni. Krank serbestliğine
      // krank KASNAĞININ ataleti (0.064) konunca AG0868 ailesi Gates'ten
      // uzaklaşıyor — mutasyon kapısı.
      const { sys, ref } = kurTors('AG0868');
      const yanlis = JSON.parse(JSON.stringify(sys));
      yanlis.pulleys.forEach((p) => { if (p.crank) p.inertiaKgM2 = 0.064; });
      const T = F.torsionalModel(F.makeSystem(yanlis), {});
      const dogru = F.torsionalModel(sys, {});
      expect(Math.abs(dogru.firstElasticHz / ref - 1))
        .toBeLessThan(Math.abs(T.firstElasticHz / ref - 1));
    });

    test('[BİLİNEN SINIR] AG00810 ve AG00879 takımın DIŞINDA — VERİ EKSİĞİ DEĞİL', () => {
      // ESKİ GEREKÇE ÇÜRÜTÜLDÜ. Bu test bir dönem AG00810'un dışarıda
      // kalmasını "gergi kasnak kütlesi BİLİNMİYOR" diye açıklıyordu; raporun
      // kendi titreşim sayfası o kütleyi (0.80 kg) YAZIYOR. Gerçek kütleyle
      // koşunca 20.3 → 17.55 Hz (Gates 15.05) — yani eksik veri sapmanın bir
      // KISMIYDI, tamamı değil. Kalan fark modelin kendi sınırı.
      //
      // AG00879 de arşive girince ölçülebildi (fixture'da atalet verisi HİÇ
      // yoktu): 25.06 ↔ 22.11 Hz. İkisi de banda düşmüyor ama ikisi de
      // eskiden sanıldığından çok daha yakın.
      const olc = (k) => {
        const { sys, ref } = kurTors(k);
        return F.torsionalModel(sys, {}).firstElasticHz / ref;
      };
      expect(vibrationOf('AG00810').pulleyMassKg).toBeCloseTo(0.80, 5);
      expect(olc('AG00810')).toBeGreaterThan(1.10);   // ölçüldü: 1.166
      expect(olc('AG00810')).toBeLessThan(1.25);
      expect(olc('AG00879')).toBeGreaterThan(1.08);   // ölçüldü: 1.133
      expect(olc('AG00879')).toBeLessThan(1.20);
    });
  });
});
