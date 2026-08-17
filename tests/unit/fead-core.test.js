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
