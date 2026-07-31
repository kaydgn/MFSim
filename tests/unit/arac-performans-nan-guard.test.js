/**
 * arac-performans-nan-guard.test.js
 * ─────────────────────────────────
 * REGRESYON BEKÇİSİ: "Araç Performans çalıştırılınca program takılıyor" hatası.
 *
 * Kök neden zinciri (ölçüldü): motor tork tablosunda YİNELENEN bir devir satırı
 * → pchipCreate'te h=0 → 0/0 → spline'ın TAMAMI NaN → NaN çözücüde sessizce
 * yayılır → NaN karşılaştırmaları hep false olduğu için ne düşük-dal taramasının
 * break'leri ne de ana döngünün maks-hız erken çıkışı tetiklenebilir → koşum
 * güvenlik limitine kadar, adım başına tam tarama yaparak sürer.
 * Ölçüm (RK4, dt=0.01, iki transfer kademesi): temiz veri 0.4 s → bozuk veri 248 s.
 * Tarayıcıda tek senkron blok olduğu için bu "donma" olarak görünüyordu.
 *
 * Buradaki testler üç katmanı da kilitler:
 *   1) KAYNAK   — pchipCreate sessiz NaN yerine adresli hata atar
 *   2) KALKAN   — çözücü NaN'lı durumda hızlı ve anlaşılır biçimde durur
 *   3) SINIRLAR — RK45 kabul döngüsü sonsuz dönmez, güvenlik limiti uygulanır
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

// ── Ortak veri ───────────────────────────────────────────────────────────────
const TORQUE_CLEAN = [
  { rpm: 800, torque: 610 }, { rpm: 1200, torque: 1000 }, { rpm: 1600, torque: 1100 },
  { rpm: 2000, torque: 1025 }, { rpm: 2400, torque: 950 }, { rpm: 2800, torque: 860 },
  { rpm: 2830, torque: 0 }
];
const TC_CLEAN = [
  { sr: 0.00, kpump: 73.33, tau: 2.44 }, { sr: 0.30, kpump: 73.38, tau: 1.90 },
  { sr: 0.60, kpump: 77.11, tau: 1.39 }, { sr: 0.80, kpump: 85.30, tau: 1.10 },
  { sr: 0.99, kpump: 304.85, tau: 0.96 }
];
const GEARS = [
  { name: '1C', ratio: 3.487, eff: 98.1 }, { name: '2C', ratio: 1.864, eff: 98.8 },
  { name: '3L', ratio: 1.409, eff: 99.0 }, { name: '4L', ratio: 1.000, eff: 99.6 },
  { name: '5L', ratio: 0.750, eff: 98.6 }, { name: '6L', ratio: 0.652, eff: 98.0 }
];

function buildTopology(opts) {
  const o = opts || {};
  const chain = [
    { id: 'e1', type: 'engine', data: {
      torqueData: o.torqueData || TORQUE_CLEAN,
      motorSpecs: { governedSpeed: 2100, noLoadGoverned: 2830, idleRpm: 700, inertia: 1.431 }
    } },
    { id: 'tc1', type: 'torque-converter', data: { tcData: o.tcData || TC_CLEAN, pumpTorqueDrop: 17.6 } },
    { id: 'g1', type: 'gearbox', data: { ftGearData: GEARS, shiftProfile: 'allison3200sp_s1' } },
    { id: 'p1', type: 'propshaft', data: { psEff: 98.6, psInertia: 0.5 } },
    { id: 't1', type: 'transfer', data: { ftTrGears: [
      { kademe: 'High', ratio: 1.054, eff: 97 }, { kademe: 'Low', ratio: 2.337, eff: 97 }
    ] } },
    { id: 'd1', type: 'differential', isMasterDiff: true, data: { diffRatio: 5.904, efficiency: 95, diffInertia: 1.0 } },
    { id: 'w1', type: 'wheel', isMasterWheel: true, data: { ftTireRadius: 0.531, ftTireInertia: 63.77, ftCrr: 0.0035, ftSurfaceFactor: 1.0 } }
  ];
  global.nodes = chain.concat([
    { id: 's1', type: 'shift-controller', data: {} },
    { id: 'v1', type: 'vehicle', data: { ftGVW: 13060, ftDrivenWeight: 100, ftHeight: 3.2, ftWidth: 2.5, ftCd: 0.9, ftRho: 1.225, ftGrade: 0 } },
    { id: 'sv1', type: 'solver', data: Object.assign({ maxSimTime: 300, ftDt: 0.01, method: 'rk4' }, o.solver || {}) }
  ]);
  global.connections = [];
  global.veGetPowertrainChain = () => chain;
}

// ── 1) KAYNAK: pchipCreate sessiz NaN üretmez ────────────────────────────────
describe('pchipCreate — geçersiz düğüm noktalarına karşı sessiz NaN yok', () => {
  test('temiz, kesin artan veri normal çalışır', () => {
    const sp = FT_SOLVER.pchipCreate([0, 1, 2, 3], [0, 1, 4, 9]);
    expect(sp.ds.every(Number.isFinite)).toBe(true);
    expect(Number.isFinite(FT_SOLVER.pchipEval(sp, 1.5))).toBe(true);
  });

  test('YİNELENEN x → hata atar ve yinelenen değeri mesajda söyler', () => {
    expect(() => FT_SOLVER.pchipCreate([0, 1, 1, 2], [0, 1, 1, 4]))
      .toThrow(/kesin artan/);
    // Mesaj eyleme dönüştürülebilir olmalı: hangi değer, hangi satır
    expect(() => FT_SOLVER.pchipCreate([0, 1, 1, 2], [0, 1, 1, 4]))
      .toThrow(/1 \(satır 3\)/);
  });

  test('AZALAN x → hata atar', () => {
    expect(() => FT_SOLVER.pchipCreate([0, 5, 3], [0, 1, 2])).toThrow(/kesin artan/);
  });

  test('sayısal olmayan x veya y → hata atar', () => {
    expect(() => FT_SOLVER.pchipCreate([0, undefined, 2], [0, 1, 2])).toThrow(/sayısal olmayan/);
    expect(() => FT_SOLVER.pchipCreate([0, 1, 2], [0, NaN, 2])).toThrow(/sayısal olmayan/);
  });

  test('n=2 dalı da korumalı (yinelenen x burada da NaN üretiyordu)', () => {
    expect(() => FT_SOLVER.pchipCreate([5, 5], [1, 2])).toThrow(/kesin artan/);
  });
});

// ── 2) Tablo fabrikaları: hata mesajı HANGİ tabloyu söylemeli ────────────────
describe('tablo fabrikaları — hata hangi bileşenden geldiğini söyler', () => {
  test('temiz motor tablosu sonlu tork üretir', () => {
    const fn = FT_SOLVER.createMotorTorqueFn(TORQUE_CLEAN, 2100, 2830);
    expect(Number.isFinite(fn(1800))).toBe(true);
    expect(fn(1800)).toBeGreaterThan(0);
  });

  test('yinelenen devir → "Motor tork tablosu" diye adlandırılmış hata', () => {
    const dup = TORQUE_CLEAN.slice(0, 3)
      .concat([{ rpm: 1600, torque: 1100 }])   // 1600 iki kez
      .concat(TORQUE_CLEAN.slice(3));
    expect(() => FT_SOLVER.createMotorTorqueFn(dup, 2100, 2830))
      .toThrow(/Motor tork tablosu/);
  });

  test('yinelenen SR → "Konvertör tablosu" diye adlandırılmış hata', () => {
    const dup = [{ sr: 0.0, kpump: 73, tau: 2.4 }, { sr: 0.5, kpump: 75, tau: 1.5 },
                 { sr: 0.5, kpump: 76, tau: 1.4 }, { sr: 0.9, kpump: 105, tau: 0.97 }];
    expect(() => FT_SOLVER.createTCFunctions(dup)).toThrow(/Konvertör tablosu/);
  });

  test('boş bırakılmış SR alanı → sayısal olmayan hatası (sessiz NaN değil)', () => {
    const blank = [{ sr: 0.0, kpump: 73, tau: 2.4 }, { sr: undefined, kpump: 75, tau: 1.5 },
                   { sr: 0.9, kpump: 105, tau: 0.97 }];
    expect(() => FT_SOLVER.createTCFunctions(blank)).toThrow(/sayısal olmayan/);
  });
});

// ── 3) UÇTAN UCA: bozuk veri donma değil, hızlı hata üretir ─────────────────
describe('veFTRunSimulationEngine — bozuk tablo donmaya değil hataya dönüşür', () => {
  test('temiz topoloji çalışır ve sonlu sonuç üretir', () => {
    buildTopology();
    const R = veFTRunSimulationEngine('High');
    expect(R.speed.length).toBeGreaterThan(50);
    expect(R.speed.every(Number.isFinite)).toBe(true);
    expect(R.accel.every(Number.isFinite)).toBe(true);
    expect(Math.max.apply(null, R.speed)).toBeGreaterThan(20);
  });

  test('yinelenen devirli tablo → NaN dolu sonuç DEĞİL, hata; ve HIZLI', () => {
    const dup = TORQUE_CLEAN.slice(0, 4)
      .concat([{ rpm: 2000, torque: 1025 }])   // 2000 iki kez — çalışma bandında
      .concat(TORQUE_CLEAN.slice(4));
    buildTopology({ torqueData: dup });

    const t0 = Date.now();
    expect(() => veFTRunSimulationEngine('High')).toThrow(/Motor tork tablosu/);
    const elapsed = Date.now() - t0;

    // Eski davranış: hata YOK, NaN dolu sonuç ve tek kademe ~124 s.
    // Artık kurulum aşamasında patlıyor → bir saniyenin çok altında olmalı.
    expect(elapsed).toBeLessThan(2000);
  });
});

// ── 4) SINIRLAR: RK45 kabul döngüsü ve güvenlik limiti ──────────────────────
describe('RK45 — sınırsız döngü ve limit ihlali regresyon bekçisi', () => {
  // Bu testlerin HEPSİ eski kodda ya sonsuza kadar donuyordu ya da yanlış
  // sonuç veriyordu. Jest zaman aşımı, donmanın geri gelmesini yakalar.
  const T = 20000;

  test('NEGATİF atol sonsuz döngüye sokmaz', () => {
    buildTopology({ solver: { maxSimTime: 60, ftDt: 0.01, method: 'rk45', ftAtol: '-1e-6' } });
    const R = veFTRunSimulationEngine('High');
    expect(R.speed.every(Number.isFinite)).toBe(true);
  }, T);

  test('NEGATİF rtol sonsuz döngüye sokmaz', () => {
    buildTopology({ solver: { maxSimTime: 60, ftDt: 0.01, method: 'rk45', ftRtol: '-1e-4' } });
    const R = veFTRunSimulationEngine('High');
    expect(R.speed.every(Number.isFinite)).toBe(true);
  }, T);

  test('güvenlik limiti AŞILMAZ (RK45 dt büyütünce limiti deliyordu)', () => {
    buildTopology({ solver: { maxSimTime: 60, ftDt: 0.01, method: 'rk45' } });
    const R = veFTRunSimulationEngine('High');
    // solverStats.simEndTime = entegrasyonun bittiği an. Statik drawbar uzantısı
    // bunun ÖTESİNE rapor satırı ekler; limit kontrolü entegrasyon süresine bakar.
    //
    // Tolerans neden 0 değil: kesme kontrolü döngü BAŞINDA (`t >= maxTime`), yani
    // son kabul edilen adım limiti en çok bir dt_max (0.1 s) aşabilir. Yakalaması
    // gereken regresyon bu değil — eski kod 60 s limitle 170.15 s simüle ediyordu.
    expect(R.solverStats.simEndTime).toBeLessThan(60 + 0.2);
  }, T);

  test('adım bütçesi koşumu ERKEN kesmez (limit 30 s → ~30 s simüle edilir)', () => {
    buildTopology({ solver: { maxSimTime: 30, ftDt: 0.01, method: 'rk45' } });
    const R = veFTRunSimulationEngine('High');
    // Eski davranış: yalnız 0.71 s simüle edilip "tamamlandı" gibi dönüyordu.
    expect(R.solverStats.truncatedByStepBudget).toBe(false);
    if(!R.solverStats.reachedMaxSpeed) {
      expect(R.solverStats.simEndTime).toBeGreaterThan(29);
    }
  }, T);

  test('RK45 ve RK4 aynı süre sonunda birbirine yakın hız verir', () => {
    buildTopology({ solver: { maxSimTime: 30, ftDt: 0.01, method: 'rk4' } });
    const v4 = veFTRunSimulationEngine('High').solverStats.maxSpeed_kmh;
    buildTopology({ solver: { maxSimTime: 30, ftDt: 0.01, method: 'rk45' } });
    const v45 = veFTRunSimulationEngine('High').solverStats.maxSpeed_kmh;
    // Eski kodda RK45 erken kesildiği için 5.3 km/h veriyordu (RK4: 83.1).
    expect(Math.abs(v45 - v4)).toBeLessThan(0.1 * v4);
  }, T);
});

// ── 5) TEŞHİS: çözücü logu gerçek ayarı yazmalı ─────────────────────────────
describe('solver-pro FT log satırı — yöntem/Δt sabit kodlu olmamalı', () => {
  const srcSolverPro = loadSource('solver-pro.js');

  test('eski sabit string geri gelmemiş', () => {
    // Bu satır kullanıcı RK45 seçtiğinde bile "RK4" yazıyordu ve takılma
    // teşhisini yanlış yöne sürüklüyordu.
    expect(srcSolverPro).not.toContain("log('Yöntem: RK4 | Δt = 0.01 s");
  });

  test('log gerçek çözücü verisinden besleniyor', () => {
    expect(srcSolverPro).toMatch(/ftMethodLabel/);
    expect(srcSolverPro).toMatch(/parseFloat\(sd\.ftDt\)/);
  });
});
