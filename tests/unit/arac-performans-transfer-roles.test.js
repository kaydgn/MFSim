/**
 * arac-performans-transfer-roles.test.js
 * ──────────────────────────────────────
 * REGRESYON BEKÇİSİ: transfer kademelerinin YÜKSEK/DÜŞÜK rolü.
 *
 * SORUN: rol DİZİ KONUMUNDAN alınıyordu — ft-performance.js'te
 *   var lowGear = trGears[1];   // "İkinci kademe = düşük kademe (yüksek oran)"
 * hem veCalculateGradeability hem veCalculateAcceleration içinde. Bu pozisyonel
 * varsayım hiçbir yerde doğrulanmıyordu.
 *
 * Tuzağın gerçek olduğunun kanıtı: iSCAAN'ın KENDİ High/Low etiketleri aynı
 * BMC 10TON 6×6 aracının iki başvurusunda ters:
 *     497-A355435-1 : Low = 1.536, High = 0.874
 *     497-A355294-1 : Low = 0.874, High = 1.536
 * Rapordaki etiket sırasını kopyalayan kullanıcı diziyi ters girer. Ölçülen etki:
 * fizik doğru kalıyor (her kademenin sayıları kendi oranına ait) ama "Yüksek
 * Kademe" etiketi 1.536'ya, "Düşük Kademe" 0.874'e takılıyordu — ve bu ters
 * adlandırma sonuç paneline, eğim grafiğine, TXT ve HTML raporlarına yayılıyordu
 * (results.js:1524, 1532, 3285, 3289). Uyarı yoktu.
 *
 * DÜZELTME: roller orandan çözülüyor (veResolveTransferRoles) — küçük oran =
 * yüksek (hızlı) kademe, dizi sırası ne olursa olsun.
 */
const stubs = stubGlobals({ veResetChartView: jest.fn() });
global.veActiveModule = 'full-throttle';
global.COMPONENT_SIGNALS = {};

eval(loadSource('numerics.js'));
eval(loadSource('cp-engine.js'));
eval(loadSource('cp-gearbox.js'));
eval(loadSource('cp-accessories.js'));
eval(loadSource('ft-performance.js'));

beforeEach(() => resetStubs(stubs));

const FAST = 0.874;   // iSCAAN "yüksek kademe" — küçük oran
const SLOW = 1.536;   // iSCAAN "düşük kademe"  — büyük oran

describe('veResolveTransferRoles — rol orandan çözülür', () => {
  const g = (ratio, kademe) => ({ kademe: kademe, ratio: ratio, eff: 97 });

  test('dizi sırası ne olursa olsun aynı rolleri verir', () => {
    const duz  = veResolveTransferRoles([g(FAST, 'High'), g(SLOW, 'Low')], FAST);
    const ters = veResolveTransferRoles([g(SLOW, 'High'), g(FAST, 'Low')], FAST);
    expect(duz.activeIsLow).toBe(false);
    expect(ters.activeIsLow).toBe(false);
    expect(duz.otherRatio).toBe(SLOW);
    expect(ters.otherRatio).toBe(SLOW);
  });

  test('aktif kademe YAVAŞ olan ise activeIsLow = true', () => {
    const r = veResolveTransferRoles([g(FAST, 'High'), g(SLOW, 'Low')], SLOW);
    expect(r.activeIsLow).toBe(true);
    expect(r.otherRatio).toBe(FAST);
  });

  test('etiketler yanıltıcı olsa da orana bakar', () => {
    // 497-A355294-1'deki gibi: "Low" etiketi hızlı orana yapışmış.
    const r = veResolveTransferRoles([g(FAST, 'Low'), g(SLOW, 'High')], FAST);
    expect(r.activeIsLow).toBe(false);      // etikete DEĞİL orana bakıyor
    expect(r.otherRatio).toBe(SLOW);
  });

  test('tek kademe / boş / eşit oranlar → null', () => {
    expect(veResolveTransferRoles([g(FAST, 'High')], FAST)).toBeNull();
    expect(veResolveTransferRoles([], 1)).toBeNull();
    expect(veResolveTransferRoles(null, 1)).toBeNull();
    expect(veResolveTransferRoles([g(1.0, 'A'), g(1.0, 'B')], 1.0)).toBeNull();
  });

  test('ikiden çok kademede uçlar esas alınır', () => {
    const r = veResolveTransferRoles([g(1.2, 'Orta'), g(FAST, 'H'), g(SLOW, 'L')], FAST);
    expect(r.activeIsLow).toBe(false);
    expect(r.otherRatio).toBe(SLOW);        // en büyük oran
  });

  test('oran alanı "oran" adıyla gelse de okunur', () => {
    const r = veResolveTransferRoles([{ kademe: 'A', oran: FAST }, { kademe: 'B', oran: SLOW }], FAST);
    expect(r.otherRatio).toBe(SLOW);
  });
});

// ── Gerçek koşu: BMC 10TON 6×6 (iSCAAN 497-A355294-1, 30 t) ────────────────
const ISG12_380 = [
  { rpm: 1000, torque: 1995.8, power: 209.0 }, { rpm: 1200, torque: 1997.4, power: 251.0 },
  { rpm: 1400, torque: 1930.3, power: 283.0 }, { rpm: 1600, torque: 1689.0, power: 283.0 },
  { rpm: 1700, torque: 1589.7, power: 283.0 }, { rpm: 1800, torque: 1501.4, power: 283.0 },
  { rpm: 1900, torque: 1407.3, power: 280.0 }, { rpm: 2100, torque: 0, power: 0 }
];
const TC551 = [
  { sr: 0.000, kpump: 38.26, tau: 1.794 }, { sr: 0.200, kpump: 39.81, tau: 1.600 },
  { sr: 0.400, kpump: 42.41, tau: 1.485 }, { sr: 0.600, kpump: 46.01, tau: 1.300 },
  { sr: 0.750, kpump: 49.19, tau: 1.144 }, { sr: 0.850, kpump: 52.17, tau: 1.028 },
  { sr: 0.891, kpump: 55.70, tau: 0.986 }, { sr: 0.950, kpump: 81.58, tau: 0.992 }
];
const GEARS = [
  { name: '1C', ratio: 4.695, eff: 98.83 }, { name: '2C', ratio: 2.213, eff: 99.05 },
  { name: '3L', ratio: 1.529, eff: 99.31 }, { name: '4L', ratio: 1.000, eff: 100.0 },
  { name: '5L', ratio: 0.765, eff: 99.18 }, { name: '6L', ratio: 0.672, eff: 99.05 }
];

function build(trGears) {
  const chain = [
    { id: 'e1', type: 'engine', data: {
      torqueData: ISG12_380,
      motorSpecs: { idleRpm: 700, governedSpeed: 1900, noLoadGoverned: 2100, inertia: 2.7029 },
      accessories: [{ name: 'Fan (Kavramalı Fan)', userLoss: 35.6 }, { name: 'Alternatör / Jeneratör', userLoss: 2.8 }]
    } },
    { id: 'tc1', type: 'torque-converter', data: { tcData: TC551, pumpTorqueDrop: 32.2 } },
    { id: 'g1', type: 'gearbox', data: { ftGearData: GEARS, shiftProfile: 'allison4500sp_s1' } },
    { id: 'p1', type: 'propshaft', data: { psEff: 98.6, psInertia: 0.5 } },
    { id: 't1', type: 'transfer', data: { ftTrGears: trGears } },
    { id: 'd1', type: 'differential', isMasterDiff: true, data: { diffRatio: 8.337, efficiency: 93, diffInertia: 1.0 } },
    { id: 'w1', type: 'wheel', isMasterWheel: true, data: { ftTireRadius: 0.608, ftTireInertia: 293.8965, ftCrr: 0.0035, ftSurfaceFactor: 1.0 } }
  ];
  global.nodes = chain.concat([
    { id: 'v1', type: 'vehicle', data: { ftGVW: 30000, ftDrivenWeight: 100, ftHeight: 2.7, ftWidth: 2.6, ftCd: 0.75, ftRho: 1.225, ftGrade: 0 } },
    { id: 'sv1', type: 'solver', data: { maxSimTime: 300, ftDt: 0.005, method: 'rk4' } }
  ]);
  global.connections = [];
  global.veGetPowertrainChain = () => chain;
}

// Verilen sırayla iki kademeyi de koşturur, G ve A döndürür.
function runBoth(trGears) {
  build(trGears);
  global.window = global.window || {};
  const out = {};
  trGears.forEach(t => { out[t.kademe] = veFTRunSimulationEngine(t.kademe); });
  global.window._veFTAllRangeResults = out;
  global.window._veFTTransferGears = trGears;
  const primary = out[trGears[0].kademe];          // panelin varsayılanı = ilk kademe
  return { G: veCalculateGradeability(primary), A: veCalculateAcceleration(primary) };
}

describe('gerçek koşu — dizi sırası rolleri değiştirmiyor', () => {
  let duz, ters;
  beforeAll(() => {
    // "Doğru" sıra: hızlı önce. "Ters" sıra: raporun etiket sırası kopyalanmış.
    duz  = runBoth([{ kademe: 'H', ratio: FAST, eff: 97 }, { kademe: 'L', ratio: SLOW, eff: 97 }]);
    ters = runBoth([{ kademe: 'L', ratio: SLOW, eff: 97 }, { kademe: 'H', ratio: FAST, eff: 97 }]);
  }, 180000);

  test('eğim: Yüksek Kademe HER İKİ sırada da küçük orana bağlı', () => {
    expect(duz.G.high.transferRatio).toBeCloseTo(FAST, 3);
    expect(ters.G.high.transferRatio).toBeCloseTo(FAST, 3);
    expect(duz.G.low.transferRatio).toBeCloseTo(SLOW, 3);
    expect(ters.G.low.transferRatio).toBeCloseTo(SLOW, 3);
  });

  test('eğim: etiket metni de doğru kademeyi söylüyor', () => {
    [duz, ters].forEach(R => {
      expect(R.G.high.label).toContain('Yüksek Kademe');
      expect(R.G.high.label).toContain('0.874');
      expect(R.G.low.label).toContain('Düşük Kademe');
      expect(R.G.low.label).toContain('1.536');
    });
  });

  test('hızlanma: Yüksek Kademe HER İKİ sırada da küçük orana bağlı', () => {
    expect(duz.A.high.transferRatio).toBeCloseTo(FAST, 3);
    expect(ters.A.high.transferRatio).toBeCloseTo(FAST, 3);
    expect(duz.A.low.transferRatio).toBeCloseTo(SLOW, 3);
    expect(ters.A.low.transferRatio).toBeCloseTo(SLOW, 3);
    [duz, ters].forEach(R => {
      expect(R.A.high.label).toContain('Yüksek Kademe');
      expect(R.A.low.label).toContain('Düşük Kademe');
    });
  });

  test('fizik korundu — yavaş kademe daha dik tırmanır, hızlı kademe daha hızlı gider', () => {
    [duz, ters].forEach(R => {
      expect(R.G.low.stallGrade).toBeGreaterThan(R.G.high.stallGrade);
      expect(R.G.high.maxSpeedFlat).toBeGreaterThan(R.G.low.maxSpeedFlat);
      expect(R.A.high.maxSpeed).toBeGreaterThan(R.A.low.maxSpeed);
    });
  });

  test('sayılar sıraya göre değişmiyor — yalnız hangi role düştükleri sabitlendi', () => {
    // Aynı orana ait değerler iki sırada da aynı olmalı.
    expect(ters.G.high.stallGrade).toBeCloseTo(duz.G.high.stallGrade, 1);
    expect(ters.G.low.stallGrade).toBeCloseTo(duz.G.low.stallGrade, 1);
    expect(ters.G.high.maxSpeedFlat).toBeCloseTo(duz.G.high.maxSpeedFlat, 1);
  });

  test('iSCAAN bandında (497-A355294-1: 0.874 stall 54.0 · 1.536 stall 154.1)', () => {
    expect(duz.G.high.stallGrade).toBeGreaterThan(48);
    expect(duz.G.high.stallGrade).toBeLessThan(60);
    expect(duz.G.low.stallGrade).toBeGreaterThan(140);
    expect(duz.G.low.stallGrade).toBeLessThan(165);
  });
});

describe('tek kademeli transfer — regresyon olmadığı', () => {
  test('G.high dolu, G.low null', () => {
    const trGears = [{ kademe: 'Tek', ratio: 1.0, eff: 97 }];
    build(trGears);
    global.window = global.window || {};
    global.window._veFTAllRangeResults = null;
    global.window._veFTTransferGears = trGears;
    const R = veFTRunSimulationEngine('Tek');
    const G = veCalculateGradeability(R);
    const A = veCalculateAcceleration(R);
    expect(G.high).toBeTruthy();
    expect(G.low).toBeNull();
    expect(G.high.label).toContain('Yüksek Kademe');
    expect(A.high).toBeTruthy();
    expect(A.low).toBeNull();
  }, 60000);
});
