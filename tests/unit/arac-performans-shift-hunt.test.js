/**
 * arac-performans-shift-hunt.test.js
 * ──────────────────────────────────
 * REGRESYON BEKÇİSİ: vites salınımı (hunt) → 25.000+ geçiş → tarayıcı kilitleniyor.
 *
 * Kullanıcı logundan (MFSim_Log_20260731_1107.txt) çıkan tablo:
 *   entegrasyon        : 0,728 s  (hesap SORUNSUZ bitmiş)
 *   vites geçişi       : 25.134   (5L↔6L 7189/7188, 4L↔5L 2724/2723, ...)
 *   log son zaman damgası: 51.639 s  ← 14+ SAAT, satırların DOM'a basılması
 *   ve en sonunda      : "SİMÜLASYON HATASI: gd is not defined"
 *
 * KÖK NEDEN — birbiriyle kavga eden İKİ kural, aralarında hakem yok:
 *   • "governed güvenliği": motor governed'ı aşarsa üst vitese at
 *   • downshift tablosu   : N_out eşiğin altındaysa alt vitese düş
 *   Allison 2500SP S1 profili 6 vitesli bir şanzıman için kalibre; kullanıcının
 *   şanzımanı 9 vitesli. 5L'de N_out=2425 → N_engine=2425×1,439=3489 > 2500 →
 *   güvenlik 6L'ye atıyor; 6L'de N_out=2425 < 3011 ('6to5' eşiği) → downshift
 *   5L'ye geri atıyor → her adımda bir gidiş-dönüş.
 *   NOT: profilin KENDİ histerezis bantları doğru (up 3292 / down 3011).
 *
 * DÜZELTME: alt vitese düşmek motoru governed'ın üstüne çıkaracaksa o düşüş
 * fiziksel olarak geçersizdir → engellenir. Ek kalkan: ters yön kilidi.
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

// ── Kullanıcının topolojisi (logdan birebir) ────────────────────────────────
// Motor: 21 satır tork verisi, governed 2500 → isb45_210_fr94198 preset'i
// Şanzıman: 9 ileri vites, shift profili allison2500sp_s1
// Transfer: OnRoad i=3.428 | Diferansiyel 1.706 | Teker r=0.435 | GVW 7350
const TC_18 = [
  { sr: 0.00, kpump: 73.33, tau: 2.44 }, { sr: 0.10, kpump: 73.04, tau: 2.27 },
  { sr: 0.20, kpump: 73.33, tau: 2.09 }, { sr: 0.30, kpump: 73.38, tau: 1.90 },
  { sr: 0.41, kpump: 73.93, tau: 1.70 }, { sr: 0.50, kpump: 74.87, tau: 1.54 },
  { sr: 0.55, kpump: 75.77, tau: 1.46 }, { sr: 0.60, kpump: 77.11, tau: 1.39 },
  { sr: 0.64, kpump: 78.51, tau: 1.32 }, { sr: 0.70, kpump: 80.66, tau: 1.24 },
  { sr: 0.75, kpump: 82.75, tau: 1.17 }, { sr: 0.80, kpump: 85.30, tau: 1.10 },
  { sr: 0.88, kpump: 95.19, tau: 0.98 }, { sr: 0.90, kpump: 105.00, tau: 0.97 },
  { sr: 0.93, kpump: 118.41, tau: 0.97 }, { sr: 0.95, kpump: 143.48, tau: 0.96 },
  { sr: 0.98, kpump: 208.25, tau: 0.96 }, { sr: 0.99, kpump: 304.85, tau: 0.96 }
];
const GEARS_9 = [
  { name: 'F1', ratio: 4.822, eff: 98.11, lockup: false },
  { name: 'F2', ratio: 3.512, eff: 98.60, lockup: true },
  { name: 'F3', ratio: 2.852, eff: 98.70, lockup: true },
  { name: 'F4', ratio: 1.896, eff: 98.80, lockup: true },
  { name: 'F5', ratio: 1.439, eff: 98.90, lockup: true },
  { name: 'F6', ratio: 1.000, eff: 99.64, lockup: true },
  { name: 'F7', ratio: 0.736, eff: 98.05, lockup: true },
  { name: 'F8', ratio: 0.643, eff: 97.48, lockup: true },
  { name: 'F9', ratio: 0.568, eff: 96.91, lockup: true }
];

function buildUserTopology(solverOverride) {
  const P = VE_FT_MOTOR_PRESETS['isb45_210_fr94198'];
  const chain = [
    { id: 'e1', type: 'engine', data: {
      torqueData: P.data.map(d => ({ rpm: d.rpm, torque: d.torque, power: d.power })),
      motorSpecs: Object.assign({}, P.specs),
      accessories: [
        { name: 'Fan (Kavramalı Fan)', userLoss: 16.1, fanMode: 'clutch' },
        { name: 'Alternatör / Jeneratör', userLoss: 1.6 },
        { name: 'Hava Kompresörü', userLoss: 0.8 },
        { name: 'Direksiyon Pompası', userLoss: 0.8 }
      ]
    } },
    { id: 'tc1', type: 'torque-converter', data: { tcData: TC_18, pumpTorqueDrop: 17.6 } },
    { id: 'g1', type: 'gearbox', data: { ftGearData: GEARS_9, shiftProfile: 'allison2500sp_s1' } },
    { id: 'p1', type: 'propshaft', data: { psEff: 98.6, psInertia: 0.5 } },
    { id: 't1', type: 'transfer', data: { ftTrGears: [{ kademe: 'OnRoad', ratio: 3.428, eff: 97 }] } },
    { id: 'd1', type: 'differential', isMasterDiff: true, data: { diffRatio: 1.706, efficiency: 95, diffInertia: 1.0 } },
    { id: 'w1', type: 'wheel', isMasterWheel: true, data: { ftTireRadius: 0.435, ftTireInertia: 63.77, ftCrr: 0.0035, ftSurfaceFactor: 1.0 } }
  ];
  global.nodes = chain.concat([
    { id: 's1', type: 'shift-controller', data: {} },
    { id: 'v1', type: 'vehicle', data: { ftGVW: 7350, ftDrivenWeight: 100, ftHeight: 2.3, ftWidth: 2.5, ftCd: 0.9, ftRho: 1.0, ftGrade: 0 } },
    { id: 'sv1', type: 'solver', data: Object.assign({ maxSimTime: 300, ftDt: 0.001, method: 'rk4' }, solverOverride || {}) }
  ]);
  global.connections = [];
  global.veGetPowertrainChain = () => chain;
}

describe('vites salınımı (hunt) — kullanıcının gerçek topolojisi', () => {
  let R;
  beforeAll(() => { buildUserTopology(); R = veFTRunSimulationEngine('OnRoad'); }, 60000);

  test('geçiş sayısı makul — eski kodda 25.854 idi', () => {
    const n = R.solverStats.shiftHistory.length;
    // 9 ileri vites → sağlıklı bir tam gaz koşumunda ~8 geçiş beklenir.
    // Eşiği 50'de tutuyoruz: salınım geri gelirse binlere fırlar, yakalanır.
    expect(n).toBeGreaterThan(0);
    expect(n).toBeLessThan(50);
  });

  test('aynı vites çifti arasında GİDİŞ-DÖNÜŞ yok', () => {
    const sh = R.solverStats.shiftHistory;
    for(let i = 1; i < sh.length; i++) {
      const prev = sh[i - 1], cur = sh[i];
      // Bir önceki geçişin tersi hemen tekrarlanmamalı (A→B ardından B→A)
      const isReversal = (cur.fromGear === prev.toGear && cur.toGear === prev.fromGear);
      expect(isReversal).toBe(false);
    }
  });

  test('vites dizisi kalkıştan son vitese ilerliyor', () => {
    expect(R.solverStats.finalGear).toBe('F9');
    expect(R.solverStats.reachedMaxSpeed).toBe(true);
  });

  test('fiziksel sonuç korundu — maks hız kullanıcının logundaki 121.2 km/h', () => {
    // Salınım düzeltmesi FİZİĞİ değiştirmemeli: eski kod da 121.2 üretiyordu,
    // yalnız oraya 25.854 gereksiz geçişle varıyordu.
    expect(R.solverStats.maxSpeed_kmh).toBeGreaterThan(118);
    expect(R.solverStats.maxSpeed_kmh).toBeLessThan(125);
  });

  test('kayıt noktası sayısı patlamıyor — eski kodda 53.677 idi', () => {
    // Her geçişte recordStep 2 kez çağrılıyor → salınım kayıt dizilerini de şişiriyordu.
    expect(R.speed.length).toBeLessThan(10000);
  });

  test('sonuç tamamen sonlu', () => {
    expect(R.speed.every(Number.isFinite)).toBe(true);
    expect(R.rpm.every(Number.isFinite)).toBe(true);
    expect(R.accel.every(Number.isFinite)).toBe(true);
  });

  test('solverStats bastırılan salınım sayısını raporluyor', () => {
    expect(typeof R.solverStats.suppressedHunts).toBe('number');
  });
});

describe('over-rev kilidi — downshift motoru governed üstüne çıkaramaz', () => {
  test('hiçbir downshift motoru governed’ın üstüne taşımıyor', () => {
    buildUserTopology();
    const R2 = veFTRunSimulationEngine('OnRoad');
    const governed = R2.solverStats.N_governed;
    R2.solverStats.shiftHistory.forEach(s => {
      if(!s.isDownshift) return;
      // Downshift sonrası motor devri = N_out × alt vites oranı
      const lower = R2.solverStats.forwardGears[s.toGear];
      if(!lower) return;
      const nEngAfter = (s.N_out || 0) * (parseFloat(lower.ratio) || 1);
      expect(nEngAfter).toBeLessThan(governed);
    });
  });
});

describe('solver-pro kaynak bekçileri', () => {
  const srcSolverPro = loadSource('solver-pro.js');

  test('"gd is not defined" çökmesi geri gelmemiş', () => {
    // gd yalnız ADIM 2 bloğunda tanımlı (orada kullanımı MEŞRU); Vites Geçiş
    // Doğrulama bölümü onu kullanınca Lock→Lock geçişi olan HER topolojide
    // çözüm son anda çöküyordu. Bekçi yalnız o satırı hedefler.
    expect(srcSolverPro).not.toContain('var spValData = VE_FT_SHIFT_PROFILES[gd.shiftProfile');
  });

  test('doğrulama bölümü shift profilini kendi kapsamından okuyor', () => {
    expect(srcSolverPro).toContain('_gbDataV.shiftProfile');
  });

  test('vites geçiş listeleri log tavanıyla basılıyor', () => {
    expect(srcSolverPro).toContain('VE_LOG_LIST_CAP');
    expect(srcSolverPro).toContain('veLogCappedList');
  });
});

describe('veLogCappedList — log seli koruması', () => {
  // solver-pro.js üst-seviye fonksiyon bildiriyor; DOM'a dokunmadan yüklenebilir.
  eval(loadSource('solver-pro.js'));

  test('tavanın altındaki liste olduğu gibi basılır', () => {
    const out = [];
    veLogCappedList([1, 2, 3], (m) => out.push(m), (x) => 'satir ' + x);
    expect(out).toEqual(['satir 1', 'satir 2', 'satir 3']);
  });

  test('tavanı aşan liste kesilir ve kaç satırın gizlendiği SÖYLENİR', () => {
    const big = Array.from({ length: VE_LOG_LIST_CAP + 250 }, (_, i) => i);
    const out = [];
    veLogCappedList(big, (m) => out.push(m), (x) => 'satir ' + x);
    // VE_LOG_LIST_CAP satır + 1 açıklama satırı
    expect(out.length).toBe(VE_LOG_LIST_CAP + 1);
    expect(out[out.length - 1]).toContain('250 satır daha');
    expect(out[out.length - 1]).toContain('toplam ' + big.length);
  });

  test('tavan, 25.000 satırlık gerçek vakayı sınırlıyor', () => {
    const huge = Array.from({ length: 25134 }, (_, i) => i);
    const out = [];
    veLogCappedList(huge, (m) => out.push(m), (x) => 'satir ' + x);
    expect(out.length).toBeLessThan(400);
  });
});
