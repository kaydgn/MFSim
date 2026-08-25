/**
 * fead-belt-mode.test.js — KAYIŞ BOYU SABİT DEĞİL
 *
 * Bu dosyanın konusu tek bir sözleşme değişikliği: kayış boyu artık her zaman
 * bir GİRDİ değil. Gerçek akış tasarımdan tedariğe gidiyor — kasnaklar
 * yerleştiriliyor, sonra o yerleşime uyan kayış ısmarlanıyor — dolayısıyla
 * "boyu seçilmiş kayış" yalnızca İKİ kipten biri.
 *
 * Kolun oturduğu açı ile kayış boyu TEK serbestlik derecesini paylaşıyor:
 *
 *   'fixed'  kayış seçilmiş → kol, yolu o boya eşitleyen açıya oturur
 *                             (gerginlik ÇIKAR)
 *   'free'   kayış seçilmemiş → kol, GERGİNİN NOMİNAL YAY YÜKÜNÜN açısına
 *                             oturur (kayış boyu ÇIKAR)
 *
 * Serbest kipin ankrajı GERGİNLİK OLAMAZ: tasarım gerginliği artık bir girdi
 * değil, yay dengesinden türüyor — hedef alsaydı döngü kurulurdu (gerginlik
 * açıdan çıkıyor, açı gerginlikten). Nominal kol açısı ise salt yay
 * künyesinden geliyor: rel = (M_mean − M₀)/k, geometriye hiç bakmadan.
 *
 * İkinci sözleşme: ÇÖZÜLEMEYEN BİR KÜME KALMAMALI. Kasnak konumu kanvastan
 * sürüklenebildiği için kullanıcı çözüm uzayına DIŞARIDAN giriyor; her ara
 * karede istisna atmak kullanılamaz bir yüzey olurdu. Model çözülür — belki
 * sınırda, belki geçersiz bir yolla — ama sebebini ADIYLA yazar.
 *
 * ÜÇ ÖLÇÜLMÜŞ HATA bu dosyada kilitleniyor (üçü de geliştirme sırasında
 * gerçekten oldu, üçü de sessizdi):
 *
 *   1. Hoşgörülü geometri `feasibleRelMax`'ı bozdu. O fonksiyon kolun fiziksel
 *      sınırını "istisna atıyor mu" diye arıyordu; hiçbir şey atmayınca sınır
 *      66.5° → 89° çıktı, kayış boyu hedefi kuşatılmamış sayıldı ve BMC
 *      L_eff'i 1715.0 yerine 1730.2 mm verdi (+%0.89).
 *   2. `_geomOpt` `makeSystem`'in SONUNDA atanıyordu, oysa `sense` otomatik
 *      bulma probu daha önce ve try/catch DIŞINDA geometri çözüyor.
 *   3. Dejenerelik ölçütü "sarım" sanıldı; oysa tekillik sin(β)'dan geliyor.
 *      Ters temas tarafı verilmiş BMC'de kenetlenme noktasında sarım 360.00°
 *      (kocaman) ama take-up 1.7e-8 mm/° ve gerginlik 3.2e10 N.
 */
const M = require('../../js/fead-model.js');
const F = require('../../js/fead-core.js');

const stubs = stubGlobals();
document.body.innerHTML = '<div id="ve-canvas"></div>';
global.nodes = [];
global.connections = [];
eval(loadSource('components.js'));
global.componentDefs = componentDefs;
global.FEADCore = F;
Object.keys(M).forEach((k) => { global[k] = M[k]; });

beforeEach(() => { resetStubs(stubs); global.nodes = []; global.connections = []; });

const P = (o) => JSON.parse(JSON.stringify(o));
const pack = () => veFeadExampleNodes('BMC_FEAD_2026');

// BMC örneğini kur; istenen kasnağı kaydır, istenen kayış kipini yaz.
function kur(opts) {
  const o = opts || {};
  const p = pack();
  const list = P(p.nodes);
  if (o.id) {
    const n = list.find((x) => x.id === o.id);
    n.data.x += (o.dx || 0);
    n.data.y += (o.dy || 0);
  }
  const belt = list.find((x) => x.type === 'fead-belt');
  if (o.mode) belt.data.lengthMode = o.mode;
  if ('effLength' in o) {
    if (o.effLength === undefined) delete belt.data.effLength;
    else belt.data.effLength = o.effLength;
  }
  return { list, conns: p.connections, belt };
}

const coz = (k) => {
  const b = veFeadBuildSystem(k.list, k.conns);
  if (!b.ok) return { ok: false, build: b, err: (b.errors || [])[0] };
  const st = F.tensionerState(b.sys, b.relDeg);
  return { ok: true, build: b, rel: b.relDeg, L: b.beltLengthMm,
           T: st.tensionN, hub: st.hubloadN };
};

// Değişiklikten ÖNCE ölçülen taban. Bunlar Gates/tedarikçi çıpaları değil,
// "sabit kip birebir eski davranışını koruyor mu" kapısı.
// PİVOT ARTIK GİRDİ DEĞİL: gergi KASNAĞININ merkezi (−170.080 / 99.160) ile
// parça künyesinin kol açısından (E9843 çizimi: 344° mean) türetiliyor.
// Kayış boyu çıpaları geometriden geldiği için DEĞİŞMEDİ; değişen gerginlik
// tarafı (β başka çıkıyor).
const TABAN = { rel: 28.4271, L: 1715.0, T: 532.142, hub: 302.125 };

describe('kip çözümü — geriye dönük uyumluluk', () => {
  test('kip yazılı değilse ve boy varsa SABİT — eski her proje aynen çalışır', () => {
    expect(veFeadBeltMode({ effLength: 1715 })).toBe('fixed');
    expect(veFeadBeltMode({ length: 1715 })).toBe('fixed');
  });

  test('kip yazılı değilse ve boy YOKSA serbest — boş kayışta hata değil, kip', () => {
    expect(veFeadBeltMode({})).toBe('free');
    expect(veFeadBeltMode({ effLength: 0 })).toBe('free');
    expect(veFeadBeltMode(null)).toBe('free');
  });

  test('açık seçim her zaman kazanır', () => {
    expect(veFeadBeltMode({ lengthMode: 'free', effLength: 1715 })).toBe('free');
    expect(veFeadBeltMode({ lengthMode: 'fixed' })).toBe('fixed');
  });

  // Boy girilmemiş bir model eskiden ÇÖZÜLEMEZDİ ("Kayış efektif boyu
  // girilmedi"). Artık serbest kip sayılıyor ve boyu KENDİSİ buluyor.
  test('boy girilmemiş model artık çözülüyor ve boyu türetiyor', () => {
    const k = kur({ effLength: undefined });
    const r = coz(k);
    expect(r.ok).toBe(true);
    expect(r.build.beltLengthDerived).toBe(true);
    expect(r.L).toBeGreaterThan(0);
  });
});

describe('SABİT kip — davranış birebir eskisi', () => {
  test('dokunulmamış BMC taban değerlerini birebir veriyor', () => {
    const r = coz(kur({ mode: 'fixed' }));
    expect(r.rel).toBeCloseTo(TABAN.rel, 3);
    expect(r.L).toBeCloseTo(TABAN.L, 3);
    expect(r.T).toBeCloseTo(TABAN.T, 2);
    expect(r.hub).toBeCloseTo(TABAN.hub, 2);
    expect(r.build.workPoint.atLimit).toBeNull();
    expect(r.build.beltLengthDerived).toBe(false);
  });

  test('kayış boyu GİRDİ olarak kalır — türetilmiş diye işaretlenmez', () => {
    const r = coz(kur({ mode: 'fixed' }));
    expect(r.build.beltMode).toBe('fixed');
    expect(r.L).toBe(1715);
  });
});

describe('SERBEST kip — kayış boyu ÇIKTI', () => {
  test('kol NOMİNAL yay yükünün açısında tutulur, boy ondan çıkar', () => {
    const r = coz(kur({ mode: 'free' }));
    expect(r.ok).toBe(true);
    expect(r.build.beltLengthDerived).toBe(true);
    // rel = (22.07 − 8.60)/0.480 = 28.0625° — salt yay künyesi, geometri YOK
    expect(r.rel).toBeCloseTo(28.0625, 4);
    expect(r.build.workPoint.nominalRelDeg).toBeCloseTo(28.0625, 4);
    expect(r.build.workPoint.nominalFallback).toBe(false);
  });

  // BAĞIMSIZ DOĞRULAMA. Serbest kip kayış boyunu HİÇ görmeden hesaplıyor
  // (girdi: kasnak koordinatları, çaplar, gergi künyesi) ve tedarikçi
  // sayfasının kendi kayışını geri veriyor: 1715.27 ↔ 1715 mm, %0.016.
  test('türetilen boy tedarikçi sayfasının kayışını geri veriyor', () => {
    const r = coz(kur({ mode: 'free' }));
    expect(r.L).toBeCloseTo(1715.27, 1);
    expect(Math.abs(r.L - 1715) / 1715).toBeLessThan(0.0005);
  });

  // İKİ KİP AYNI YERE YAKINSIYOR ama ÖZDEŞ DEĞİL — ve fark anlamlı:
  //   sabit  : kol 28.4271°, L 1715.0000 (GİRDİ), T 532.14 N
  //   serbest: kol 28.0625°, L 1715.2666 (ÇIKTI), T 525.55 N
  // 0.36°'lik açı farkı 1715'in YUVARLANMIŞ bir katalog boyu olmasından.
  // Sabit kip "elimdeki boyla kol nerede oturur", serbest kip "kol nominalde
  // otursun diye hangi boy gerekir" diyor. Aynı olmalarını beklemek, katalog
  // yuvarlamasını yok saymak olurdu.
  test('iki kip yakınsıyor ama fark KATALOG YUVARLAMASI kadar', () => {
    const a = coz(kur({ mode: 'fixed' }));
    const b = coz(kur({ mode: 'free' }));
    expect(Math.abs(b.rel - a.rel)).toBeLessThan(0.5);
    expect(Math.abs(b.L - a.L)).toBeLessThan(0.5);
    expect(Math.abs(b.T - a.T) / a.T).toBeLessThan(0.02);
    expect(b.L).not.toBe(a.L);                    // ÇIKTI ≠ GİRDİ
  });

  // ASIL KAZANÇ. Sabit kipte alternatörü 10 mm kaydırmak modeli çözülemez
  // yapıyordu; geometri kusursuz çözülüyor (Σsarım = 360.00°), çöken tek şey
  // "1715 mm bu düzene sığar mı" sorusuydu. Serbest kipte böyle bir hedef yok.
  test('kasnak SÜRÜKLENİRKEN çözüm kopmuyor — boy takip ediyor', () => {
    // Kol nominal açıda SABİT; değişen kayış boyu ve — geometrinin gergiye
    // verdiği mekanik avantaj değiştiği için — gerginlik.
    const beklenen = [
      [-200, 2095.44, 310.9], [-120, 1940.22, 346.9], [-60, 1825.93, 400.9],
      [-20, 1751.58, 469.9], [0, 1715.27, 525.6], [20, 1679.74, 608.0],
      [40, 1645.22, 738.9], [60, 1611.97, 969.6],
    ];
    beklenen.forEach(([dx, L, T]) => {
      const r = coz(kur({ id: 'ex-ALT', dx, mode: 'free' }));
      expect({ dx, ok: r.ok }).toEqual({ dx, ok: true });
      expect(r.rel).toBeCloseTo(28.0625, 4);      // kol NOMİNALDE duruyor
      expect(r.L).toBeCloseTo(L, 1);
      expect(r.build.sys.designTensionN).toBeCloseTo(T, 0);
      expect(r.build.workPoint.atLimit).toBeNull();   // HİÇ kenetlenmiyor
      expect(r.build.geomValid).toBe(true);
    });
  });

  // Gerginlik sabit DEĞİL ve bu fizik: aynı yay açısında moment aynı
  // (M = M₀ + k·θ) ama take-up geometriyle değişiyor (dL/dθ = a·sinβ·2sin(φ/2)),
  // dolayısıyla T = M/(dL/dθ) da değişiyor. Sürükleme aralığında 3.1 kat.
  test('aynı kol açısında gerginlik GEOMETRİYLE değişiyor', () => {
    const T = [-200, 0, 60].map((dx) =>
      coz(kur({ id: 'ex-ALT', dx, mode: 'free' })).build.sys.designTensionN);
    expect(T[0]).toBeLessThan(T[1]);
    expect(T[1]).toBeLessThan(T[2]);
    expect(T[2] / T[0]).toBeGreaterThan(3);
  });

  test('gereken boy sürüklemeyle MONOTON değişiyor (fizik: uzaklaşan kasnak = uzun kayış)', () => {
    const L = [-120, -60, -20, 0, 20, 40].map(
      (dx) => coz(kur({ id: 'ex-ALT', dx, mode: 'free' })).L);
    for (let i = 1; i < L.length; i++) expect(L[i]).toBeLessThan(L[i - 1]);
  });
});

describe('KENETLEME — hedef erişilemezse istisna değil, sınır', () => {
  // Kuşatılmış hedefte çekirdeğin KENDİ çözümü dönmeli; sarmalayıcı araya
  // girip başka bir sayı üretirse doğrulanmış zincir sessizce kayardı.
  test('hedef aralık içindeyken çekirdeğin çözümü birebir döner', () => {
    const sys = coz(kur({ mode: 'fixed' })).build.sys;
    const c = veFeadSolveArmClamped(sys, 'belt', 1715);
    expect(c.ok).toBe(true);
    expect(c.atLimit).toBeNull();
    expect(c.relDeg).toBeCloseTo(F.solveArmForBeltLength(sys, 1715), 6);
  });

  test('erişilemeyen gerginlik kenetleniyor ve aralığı söylüyor', () => {
    const sys = coz(kur({ mode: 'fixed' })).build.sys;
    const c = veFeadSolveArmClamped(sys, 'tension', 1);   // 1 N ulaşılamaz
    expect(c.ok).toBe(true);                               // ATMIYOR
    expect(c.atLimit).not.toBeNull();
    expect(c.atLimit.rangeMin).toBeGreaterThan(1);
    expect(veFeadAtLimitText(c.atLimit)).toMatch(/erişilemiyor/i);
  });

  // Kayış sığmadığında kolun UÇ konumu take-up tekilliğine komşu ve oradaki
  // gerginlik fiziksel değil (ölçüldü: 4.15e10 N). Doğal çıkış noktası keyfî
  // bir eşik değil: T(rel) monoton arttığı için tasarım gerginliğini veren TEK
  // bir açı var; sığmayan kayışta anlamlı tek çalışma noktası odur.
  test('sığmayan kayış → NOMİNAL kol açısına düşer, sayılar FİZİKSEL kalır', () => {
    const r = coz(kur({ id: 'ex-ALT', dx: -10, mode: 'fixed' }));
    expect(r.ok).toBe(true);
    const al = r.build.workPoint.atLimit;
    expect(al).not.toBeNull();
    expect(al.resolvedAt).toBe('nominalArm');
    expect(r.rel).toBeCloseTo(28.0625, 4);
    expect(r.T).toBeCloseTo(495.2, 0);            // 4e10 DEĞİL
    expect(r.hub).toBeLessThan(2000);
  });

  test('düşülen konumda ÖNERİLEN kayış boyu yazılıyor — eyleme geçirilebilir cevap', () => {
    const r = coz(kur({ id: 'ex-ALT', dx: -10, mode: 'fixed' }));
    const al = r.build.workPoint.atLimit;
    expect(al.suggestedBeltMm).toBeCloseTo(1733.34, 0);
    const t = veFeadAtLimitText(al);
    expect(t).toMatch(/1733[.,]3 mm/);
    expect(t).toMatch(/SERBEST/);
    // Önerilen boy, serbest kipin aynı yerleşimde bulduğu boyla AYNI olmalı —
    // iki yol tek cevaba varmazsa biri sessizce yanlış demektir.
    expect(al.suggestedBeltMm)
      .toBeCloseTo(coz(kur({ id: 'ex-ALT', dx: -10, mode: 'free' })).L, 1);
  });

  test('kenetlenmişken tasarım gerginliği uyuşmazlık uyarısı BASILMAZ (sebep bir kez söylenir)', () => {
    const r = coz(kur({ id: 'ex-ALT', dx: -10, mode: 'fixed' }));
    expect(r.build.warnings.join(' ')).not.toMatch(/uyuşmuyor/);
    expect(r.build.warnings.join(' ')).toMatch(/KISA|UZUN/);
  });

  test('serbest kipte tasarım gerginliği uyarısı ANLAMSIZ — basılmıyor', () => {
    // Kol zaten tasarım gerginliğini veren açıya oturuyor; iki değer TANIM
    // GEREĞİ eşit, "uyuşmuyor" demek kendi kurduğumuz özdeşliği hata saymaktı.
    const r = coz(kur({ mode: 'free' }));
    expect(r.build.warnings.join(' ')).not.toMatch(/uyuşmuyor/);
  });
});

describe('HOŞGÖRÜLÜ GEOMETRİ — çözülemeyen küme kalmadı', () => {
  const bozukSira = () => {
    const p = pack();
    const ord = ['ex-SRC', 'ex-A_C', 'ex-IDR1', 'ex-IDR2', 'ex-ALT', 'ex-TEN'];
    return { list: P(p.nodes),
             conns: ord.map((k, i) => ({ from: k, to: ord[(i + 1) % ord.length] })) };
  };

  test('kapanmayan çevrim ÇÖZÜLÜYOR ama geçersiz olduğu YAZILI', () => {
    const b = veFeadBuildSystem(bozukSira().list, bozukSira().conns);
    expect(b.ok).toBe(true);
    expect(b.geomValid).toBe(false);
    expect(b.warnings.join(' ')).toMatch(/KAPANMIYOR/);
    const g = F.geometryAt(b.sys, b.relDeg);
    expect(g.violations.map((v) => v.type)).toContain('wrapSum');
  });

  test('kasnağı kesen kayış da ihlal olarak taşınıyor', () => {
    const b = veFeadBuildSystem(bozukSira().list, bozukSira().conns);
    const g = F.geometryAt(b.sys, b.relDeg);
    expect(g.violations.map((v) => v.type)).toContain('clearance');
    expect(veFeadViolationText(g.violations.find((v) => v.type === 'clearance')))
      .toMatch(/İÇİNDEN geçiyor/);
  });

  // ÇEKİRDEĞİN VARSAYILANI DEĞİŞMEDİ. 2095 referans değerli doğrulama kapısı
  // hoşgörüsüz yolu koşuyor; orada ihlal hâlâ İSTİSNA.
  test('hoşgörü VARSAYILAN KAPALI — çekirdek yine atıyor', () => {
    const b = veFeadBuildSystem(bozukSira().list, bozukSira().conns);
    const cozulmus = b.sys.pulleys.map((p, i) => ({
      name: p.name, c: F.geometryAt(b.sys, b.relDeg).pulleys[i].c,
      rPitch: p.rPitch, rEff: p.rEff, contact: p.contact }));
    expect(() => F.solveGeometry(cozulmus)).toThrow(/sarim|geciyor/i);
    const g = F.solveGeometry(cozulmus, { tolerant: true });
    expect(g.violations.length).toBeGreaterThan(0);
    expect(g.valid).toBe(false);
  });

  test('geçerli modelde ihlal listesi BOŞ — kapı ters yöne de kapalı', () => {
    const r = coz(kur({ mode: 'fixed' }));
    expect(r.build.geomValid).toBe(true);
    expect(F.geometryAt(r.build.sys, r.rel).violations).toHaveLength(0);
    expect(F.geometryAt(r.build.sys, r.rel).valid).toBe(true);
  });

  // Kasnakların birbirinin İÇİNE girmesi tek gerçek imkânsızlık: ortak teğet
  // YOKTUR, üretilecek sayı da yoktur. Orası hâlâ durduruyor — ve sebebini
  // hangi kasnak çifti olduğuyla birlikte söylüyor.
  test('çakışan kasnaklar tek gerçek durdurucu ve çifti adıyla söylüyor', () => {
    const r = coz(kur({ id: 'ex-IDR1', dx: -130, dy: -140, mode: 'free' }));
    expect(r.ok).toBe(false);
    expect(r.err).toMatch(/teğet çözülemedi|çakış/i);
    expect(r.err).toMatch(/Sürücü Kasnak|Avara 1/);
  });
});

describe('feasibleRelMax — hoşgörü ile ARASINDAKİ sessiz bağ', () => {
  // ÖLÇÜLMÜŞ HATA: ölçüt "istisna atıyor mu" idi. Hoşgörü açılınca hiçbir şey
  // atmayınca kol sınırı 66.5° → 89° çıktı, kayış hedefi kuşatılmamış sayıldı
  // ve BMC L_eff'i 1730.2 mm verdi. Ölçüt artık "geçerli geometri veriyor mu".
  test('kol sınırı GEÇERSİZ geometriye taşmıyor', () => {
    const sys = coz(kur({ mode: 'fixed' })).build.sys;
    const hi = F.feasibleRelMax(sys);
    expect(F.geometryAt(sys, hi).violations).toHaveLength(0);
    expect(hi).toBeLessThan(89);
  });

  // Ama yol BAŞTAN geçersizse (yanlış sıra) o ölçüt bütün aralığı elerdi ve
  // model yine "çözülemez" olurdu; o durumda matematiksel alana düşülüyor.
  test('yol baştan geçersizse yine bir aralık veriyor (model cevapsız kalmıyor)', () => {
    const p = pack();
    const ord = ['ex-SRC', 'ex-A_C', 'ex-IDR1', 'ex-IDR2', 'ex-ALT', 'ex-TEN'];
    const b = veFeadBuildSystem(P(p.nodes),
      ord.map((k, i) => ({ from: k, to: ord[(i + 1) % ord.length] })));
    expect(b.ok).toBe(true);
    expect(F.feasibleRelMax(b.sys)).toBeGreaterThan(0);
  });
});

describe('DEJENERELİK ÖLÇÜTÜ take-up, sarım DEĞİL', () => {
  // Ters temas tarafı verilmiş BMC'de kenetlenme noktasında sarım 360.00°
  // (kocaman) ama take-up 1.7e-8 mm/° ve gerginlik 3.2e10 N. Sarıma bakan bir
  // ölçüt bunu "sağlıklı" ilan ederdi.
  test('sarım büyükken bile take-up sıfıra inerse dejenere sayılır', () => {
    const p = pack();
    const list = P(p.nodes);
    list.find((n) => n.id === 'ex-SRC').data.contact = 'back';
    const belt = list.find((n) => n.type === 'fead-belt');
    belt.data.lengthMode = 'fixed';
    const b = veFeadBuildSystem(list, p.connections);
    expect(b.ok).toBe(true);
    const sys = b.sys;
    const hi = F.feasibleRelMax(sys);
    const c = veFeadSolveArmClamped(sys, 'belt', 1715);
    if (c.atLimit && !c.atLimit.resolvedAt) {
      expect(c.atLimit.wrapDeg).toBeGreaterThan(100);   // sarım KOCAMAN
      expect(c.atLimit.takeupRatio).toBeLessThan(VE_FEAD_MIN_TAKEUP_RATIO);
      expect(c.atLimit.degenerate).toBe(true);          // ama dejenere
      expect(veFeadAtLimitText(c.atLimit)).toMatch(/FİZİKSEL DEĞİL/);
    }
    expect(hi).toBeGreaterThan(0);
  });
});

describe('_geomOpt sistemin ÖMRÜNÜN BAŞINDA kurulur', () => {
  // ÖLÇÜLMÜŞ HATA: atama makeSystem'in SONUNDAYDI, oysa `sense` otomatik bulma
  // probu daha önce ve geometryAtRaw çağrısı try/catch DIŞINDA geometri
  // çözüyor. Hoşgörü orada etkisiz kalıyor ve model KURULMADAN atıyordu.
  test('sense otomatik bulunurken de hoşgörü etkin', () => {
    const p = pack();
    const list = P(p.nodes);
    delete list.find((n) => n.id === 'ex-TEN').data.sense;
    const ord = ['ex-SRC', 'ex-A_C', 'ex-IDR1', 'ex-IDR2', 'ex-ALT', 'ex-TEN'];
    const b = veFeadBuildSystem(list,
      ord.map((k, i) => ({ from: k, to: ord[(i + 1) % ord.length] })));
    expect(b.ok).toBe(true);                 // kurulmadan atmıyor
    expect(b.sys._geomOpt).toEqual({ tolerant: true });
  });
});
