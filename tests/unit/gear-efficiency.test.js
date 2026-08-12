/**
 * gear-efficiency.test.js
 * ───────────────────────
 * Şanzıman dişli verimi — sayısal çekirdek, sessiz regresyona en açık yer.
 *
 * ESKİ MODEL (evrensel):  L = |ln i| × (0.0175 + 2.93e-6 × N_türbin),  i=1 → L=0
 * YENİ MODEL (kalibre):   L = a + b·|ln i|·N_türbin + c·OD·N_çıkış²
 *   a, vitese göre ölçülebilir (perGear) ya da orana göre düz (co.a) verilir.
 *
 * Ölçüm kaynağı: 13 iSCAAN raporunun Lockup-mod vites tabloları,
 * η = T_çıkış / (T_türbin × i), governor düşüş bölgesi elenmiş (1239 nokta).
 * Aşağıdaki ÖLÇÜLEN değerler o tablolardan vites başına ortalamadır ve
 * bağımsız bir doğrulama olarak Converter-mod tablolarıyla da sınandı
 * (1080 nokta, uydurmada kullanılmadı: eski RMS %1.06 → yeni %0.46).
 */
const stubs = stubGlobals({ veResetChartView: jest.fn() });
global.veActiveModule = 'full-throttle';
global.COMPONENT_SIGNALS = {};
global.window = global.window || {};

eval(loadSource('numerics.js'));
eval(loadSource('cp-engine.js'));
eval(loadSource('cp-gearbox.js'));
eval(loadSource('ft-performance.js'));

beforeEach(() => resetStubs(stubs));

const eff = (i, N, co) => FT_SOLVER.calcGearEfficiency(i, N, co);
const loss = (i, N, co) => 100 * (1 - eff(i, N, co));

describe('katsayı çözümü — hangi şanzıman kalibre', () => {
  test('preset doğrudan seçiliyse katsayılar oradan gelir', () => {
    expect(FT_SOLVER.resolveGearEff({ ftGBPreset: '4500SP' })).toBe(VE_GEARBOX_PRESETS['4500SP'].gearEff);
  });

  test('preset yoksa vites geçiş profilinden çözülür', () => {
    // Örnek topolojilerde ftGBPreset BOŞ, yalnız shiftProfile var — bu yol
    // olmadan kalibrasyon o dosyalarda sessizce devre dışı kalırdı.
    expect(FT_SOLVER.resolveGearEff({ shiftProfile: 'allison4500sp_s1' }))
      .toBe(VE_GEARBOX_PRESETS['4500SP'].gearEff);
    expect(FT_SOLVER.resolveGearEff({ shiftProfile: 'allison2957sp_dyn0' }))
      .toBe(VE_GEARBOX_PRESETS['2957SP_WIDE'].gearEff);
  });

  test('kalibresiz şanzıman ve boş veri null döner (evrensel formüle düşer)', () => {
    expect(FT_SOLVER.resolveGearEff({ ftGBPreset: '1000SP' })).toBeNull();
    expect(FT_SOLVER.resolveGearEff({ shiftProfile: 'yok-boyle' })).toBeNull();
    expect(FT_SOLVER.resolveGearEff({})).toBeNull();
    expect(FT_SOLVER.resolveGearEff(null)).toBeNull();
  });

  test('yalnızca ÖLÇÜLEN şanzımanlar kalibre — kalanına katsayı uydurulmadı', () => {
    // 4700/4800/4900 SP, 4000 SP dişli setini derin bir 1. vitesle paylaşır;
    // tam orada (2957'de görüldüğü gibi) bileşik-yol sapması çıkar. Ölçmeden
    // katsayı taşımak sessiz hata üretir.
    const kalibre = Object.keys(VE_GEARBOX_PRESETS).filter(k => VE_GEARBOX_PRESETS[k].gearEff);
    expect(kalibre.sort()).toEqual(['2957SP_WIDE', '3000SP', '3200SP', '4000SP', '4500SP']);
  });
});

describe('evrensel formül (kalibresiz şanzıman) korunuyor', () => {
  test('direkt viteste kayıpsız, oran arttıkça kayıp artar', () => {
    expect(eff(1.0, 2000)).toBe(1.0);
    expect(eff(3.487, 2000)).toBeLessThan(eff(1.529, 2000));
  });

  test('clamp [0.90, 1.00] içinde kalır', () => {
    expect(eff(10, 5000)).toBeGreaterThanOrEqual(0.90);
    expect(eff(1.5, 0)).toBeLessThanOrEqual(1.0);
  });
});

describe('kalibre model — iSCAAN ölçümüne oturuyor', () => {
  // [preset, oran, türbin devri, ÖLÇÜLEN ortalama kayıp %]
  // (Lockup-mod tablolarından; devir o vitesin ölçüm bandının ortası.)
  const OLCUM = [
    ['4500SP', 4.695, 1500, 1.98], ['4500SP', 1.000, 1500, 0.81], ['4500SP', 0.672, 1500, 3.17],
    ['3200SP', 3.487, 1800, 2.38], ['3200SP', 1.000, 1800, 0.61], ['3200SP', 0.652, 1800, 3.03],
    ['4000SP', 3.510, 1500, 1.83], ['4000SP', 1.000, 1500, 1.01], ['4000SP', 0.639, 1500, 2.99],
    ['2957SP_WIDE', 4.822, 1800, 7.24], ['2957SP_WIDE', 3.512, 1800, 2.72],
    ['2957SP_WIDE', 2.852, 1800, 5.04], ['2957SP_WIDE', 0.568, 1800, 5.00]
  ];

  test.each(OLCUM)('%s i=%p @%p rpm → ölçülen kayıp %%%p (±0.9 puan)', (key, i, N, olculen) => {
    expect(Math.abs(loss(i, N, VE_GEARBOX_PRESETS[key].gearEff) - olculen)).toBeLessThan(0.9);
  });

  test('KRİTİK: 9 vitesli 2957 SP’de kayıp orandan çözülmüyor', () => {
    // 1. vites (i=4.822) %7.24 kaybederken DAHA KÜÇÜK oranlı 2. vites (3.512)
    // yalnız %2.72 kaybediyor — bileşik planet yolu imzası. Orana göre monoton
    // her model burada yanılır; vites başına ölçüm bu yüzden var.
    const co = VE_GEARBOX_PRESETS['2957SP_WIDE'].gearEff;
    expect(co.perGear).toBeTruthy();
    expect(loss(4.822, 1800, co)).toBeGreaterThan(loss(3.512, 1800, co) * 2);
    // Aynı noktada evrensel formül tersini söylerdi (monoton), 3.6 puan sapardı.
    expect(loss(4.822, 1800)).toBeLessThan(loss(4.822, 1800, co));
  });

  test('perGear tablosunda karşılığı olmayan oran evrensel formüle düşer', () => {
    // Ölçülmemiş bir vites için komşusunun sabiti UYDURULMAZ.
    const co = VE_GEARBOX_PRESETS['2957SP_WIDE'].gearEff;
    expect(eff(2.400, 1800, co)).toBe(eff(2.400, 1800));
    // ±%1 tolerans: oran yuvarlaması kaydı düşürmesin
    expect(eff(4.870, 1800, co)).not.toBe(eff(4.870, 1800));
  });
});

describe('düzeltilen fizik', () => {
  test('direkt vites artık kayıpsız DEĞİL — iSCAAN %0.6–1.0 gösteriyor', () => {
    // Eski model i=1’de kaybı sıfır sayıyordu; raporun kendi tablosu saymıyor.
    ['3200SP', '4000SP', '4500SP'].forEach(k => {
      const L = loss(1.0, 1500, VE_GEARBOX_PRESETS[k].gearEff);
      expect(L).toBeGreaterThan(0.5);
      expect(L).toBeLessThan(1.3);
    });
    expect(eff(1.0, 1500)).toBe(1.0);   // kalibresiz yol eski davranışta kalır
  });

  test('stall’da (N_türbin = 0) kayıp ölçülen %0.7–0.8 bandında', () => {
    // Converter-mod tabloları stall’ı doğrudan gösteriyor: 4500SP %0.76,
    // 3200SP %0.70, 4000SP %0.69. Eski model 1. viteste %2.7 diyordu —
    // kalkışta çekiş kuvvetini 2 puan fazla kırpıyordu.
    expect(loss(4.695, 0, VE_GEARBOX_PRESETS['4500SP'].gearEff)).toBeLessThan(1.1);
    expect(loss(3.487, 0, VE_GEARBOX_PRESETS['3200SP'].gearEff)).toBeLessThan(1.1);
    expect(loss(4.695, 0)).toBeGreaterThan(2.5);   // eski evrensel model
  });

  test('geri viteste NaN yok — negatif oranın büyüklüğü alınır', () => {
    // Math.log(-4.49) NaN üretirdi; verim NaN olunca çıkış torku sessizce
    // NaN’a dönüşür ve simülasyon boş grafik basardı.
    [eff(-4.49, 1500), eff(-4.49, 1500, VE_GEARBOX_PRESETS['4500SP'].gearEff)]
      .forEach(v => { expect(Number.isNaN(v)).toBe(false); expect(v).toBeGreaterThan(0.8); });
    expect(eff(-4.49, 1500)).toBe(eff(4.49, 1500));
  });

  test('overdrive terimi yalnız overdrive’da çalışır', () => {
    // c·OD·N_çıkış², OD = max(0, −ln i) → i ≥ 1’de sıfır.
    const co = { a: 0.01, b: 0, c: 1e-8 };
    expect(loss(2.0, 2000, co)).toBeCloseTo(1.0, 6);   // yalnız a
    expect(loss(0.65, 2000, co)).toBeGreaterThan(1.0);  // a + overdrive terimi
  });

  test('kalibre yolda alt sınır 0.85 — bozuk katsayı sonsuza gitmesin', () => {
    expect(eff(0.5, 6000, { a: 0.5, b: 0, c: 0 })).toBe(0.85);
    expect(eff(2.0, 1000, { a: -5, b: 0, c: 0 })).toBe(1.0);
  });
});
