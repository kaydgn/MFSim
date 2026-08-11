/**
 * simulation-engine-grade.test.js
 * ────────────────────────────────
 * js/simulation-engine.js — YOL EĞİMİ İŞARET KONVANSİYONU.
 *
 * İki konvansiyon var ve çevirisi zorunlu:
 *   Harita/segment : grade > 0 = yokuş AŞAĞI , grade < 0 = yokuş YUKARI
 *   Fizik motoru   : grade > 0 = yokuş YUKARI (direnç artar)
 *
 * Kuralı js/ft-segment-drive.js:492-495 açıkça yazıyor ve çeviriyi yapıyor
 * (`active_grade_pct = -(seg.grade || 0)`). js/ft-performance.js de fizik
 * konvansiyonunu kullanır (F_grade dirençlere EKLENİR, r_current_grade
 * pozitif = yokuş yukarı). js/graphics.js'in rapor metni de aynısını beyan
 * eder: "F_egim: pozitif = direnc / negatif = itici".
 *
 * js/simulation-engine.js bu çeviriyi ATLIYORDU. İki hata birbirini
 * götürdüğü için F_net/ivme DOĞRUYDU (çeviri yok + F_net'te F_grade
 * çıkarılacağına eklenmiş), ama YAYINLANAN sinyaller diğer iki modülün
 * TERS işaretiyle çıkıyordu:
 *   - F_grade / r_grade_force : yokuş yukarı NEGATİF çıkıyordu
 *   - r_current_grade         : yokuş yukarı NEGATİF çıkıyordu
 *   - r_total_resist          : eğimi hiç içermiyordu (diğer modüller içerir)
 *
 * Bu dosya iki şeyi birden bağlar:
 *   1) İşaret kuralı (aşağıdaki "işaret" testleri) — düzeltmeden önce KIRILIR.
 *   2) Dinamiğin DEĞİŞMEDİĞİ (aşağıdaki "regresyon" testleri) — altın
 *      sayılar düzeltmeden ÖNCE ölçüldü; düzeltme F_net'i bit-bit aynı
 *      bırakmalı. Biri sonradan işareti "F_net'i çevirerek" düzeltmeye
 *      kalkarsa bu testler kırmızıya döner.
 */
const stubs = stubGlobals({ veTrResetView: jest.fn() });

// simulation-engine, nodeData dizilerini COMPONENT_SIGNALS'tan kurar; eksik
// sinyal `undefined.push` ile patlar. Tüm tipler için birleşik liste veriyoruz.
const SIG_IDS = ['angular_vel', 'force', 'gear', 'power', 'power_out', 'r_aero_force',
  'r_current_grade', 'r_current_segment', 'r_grade_force', 'r_net_force', 'r_rolling_force',
  'r_total_resist', 'ratio', 'rpm', 'rpm_in', 'rpm_out', 'speed', 'torque', 'torque_in',
  'torque_out', 'v_accel', 'v_decel_g', 'v_distance', 'v_kinetic_energy', 'v_speed'];
global.COMPONENT_SIGNALS = {};
['engine', 'gearbox', 'transfer', 'differential', 'wheel', 'vehicle', 'road', 'propshaft',
  'torque-converter', 'solver', 'scenario'].forEach(t => {
  global.COMPONENT_SIGNALS[t] = { outputs: SIG_IDS.map(id => ({ id })) };
});

eval(loadSource('numerics.js'));
eval(loadSource('simulation-engine.js'));

// mapEgim: HARİTA konvansiyonu (+ = yokuş aşağı, − = yokuş yukarı)
function runWithMapGrade(mapEgim) {
  const engineNode = {
    id: 'e1', type: 'engine', data: {
      torqueData: [
        { rpm: 800, torque: 900 }, { rpm: 1200, torque: 1150 },
        { rpm: 1600, torque: 1200 }, { rpm: 2100, torque: 1000 },
      ],
      governedRpm: 2100, verim: 100,
    },
  };
  const gearboxNode = { id: 'g1', type: 'gearbox', data: { gearRatios: [1.0], selectedGear: 1, efficiency: 97 } };
  const diffNode = { id: 'd1', type: 'differential', isMasterDiff: true, data: { diffRatio: 6.54, efficiency: 96 } };
  const wheelNode = {
    id: 'w1', type: 'wheel', isMasterWheel: true,
    data: { wheelRadius: 0.60876, rollingResistance: 0.015, rotatingMass: 1.08 },
  };
  const vehicleNode = { id: 'v1', type: 'vehicle', data: { mass: 20000, initialSpeed: 40, cd: 0.65, frontalArea: 6.7 } };
  const roadNode = {
    id: 'r1', type: 'road', data: {
      airDensity: 1.225, egimMode: 'segment',
      // Tek, çok uzun segment: tüm koşum boyunca eğim sabit kalsın.
      routeSegments: [{ no: 1, egim: mapEgim, mesafe: 100000, deltaH: 0 }],
    },
  };
  const solverNode = { id: 's1', type: 'solver', data: { method: 'rk4', timeMode: 'manual', duration: 10, dt: 0.05 } };

  const chain = [engineNode, gearboxNode, diffNode, wheelNode];
  global.nodes = chain.concat([vehicleNode, roadNode, solverNode]);
  global.connections = [];
  global.veGetPowertrainChain = () => chain;

  return veRunSimulationEngine();
}

let UP, FLAT, DOWN;
beforeAll(() => {
  UP = runWithMapGrade(-10);    // harita −10 => yokuş YUKARI
  FLAT = runWithMapGrade(0);
  DOWN = runWithMapGrade(+10);  // harita +10 => yokuş AŞAĞI
});

describe('eğim işareti — fizik konvansiyonuna çeviri', () => {
  test('yokuş yukarıda F_grade POZİTİF (direnç)', () => {
    expect(UP.F_grade[0]).toBeGreaterThan(0);
    expect(UP.F_grade.every(v => v > 0)).toBe(true);
  });

  test('yokuş aşağıda F_grade NEGATİF (itici)', () => {
    expect(DOWN.F_grade[0]).toBeLessThan(0);
    expect(DOWN.F_grade.every(v => v < 0)).toBe(true);
  });

  test('düz yolda F_grade sıfır', () => {
    expect(FLAT.F_grade[0]).toBe(0);
  });

  test('r_grade_force sinyali de aynı işareti taşır', () => {
    expect(UP.nodeData.r1.r_grade_force[0]).toBeGreaterThan(0);
    expect(DOWN.nodeData.r1.r_grade_force[0]).toBeLessThan(0);
  });

  test('r_current_grade yokuş yukarıda POZİTİF — ft-performance.js ile aynı', () => {
    expect(UP.nodeData.r1.r_current_grade[0]).toBeCloseTo(+10, 9);
    expect(DOWN.nodeData.r1.r_current_grade[0]).toBeCloseTo(-10, 9);
    expect(FLAT.nodeData.r1.r_current_grade[0]).toBe(0);
  });

  test('r_total_resist eğim kuvvetini İÇERİR — ft-performance.js ile aynı tanım', () => {
    const r = UP.nodeData.r1;
    expect(r.r_total_resist[0]).toBeCloseTo(
      r.r_rolling_force[0] + r.r_aero_force[0] + r.r_grade_force[0], 6);
    // Yokuş yukarı: eğim dirence eklendiği için toplam direnç düz yoldakinden büyük
    expect(UP.nodeData.r1.r_total_resist[0]).toBeGreaterThan(FLAT.nodeData.r1.r_total_resist[0]);
  });

  test('hareket denklemi: F_net = F_cekis − toplam_direnç, F_cekis eğimden bağımsız', () => {
    // F_net = F_cekis − (F_yuv + F_aero + F_egim) = F_cekis − r_total_resist
    // Çekiş kuvveti eğimden bağımsızdır (aynı hız → aynı devir → aynı tork),
    // dolayısıyla F_net + r_total_resist ÜÇ koşumda da AYNI sayı olmalı.
    const cekis = R => R.F_net[0] + R.nodeData.r1.r_total_resist[0];
    expect(cekis(UP)).toBeCloseTo(cekis(FLAT), 6);
    expect(cekis(DOWN)).toBeCloseTo(cekis(FLAT), 6);
    expect(cekis(FLAT)).toBeGreaterThan(0);
  });

  test('r_net_force sinyali F_net ile aynı', () => {
    for (const R of [UP, FLAT, DOWN]) {
      expect(R.nodeData.r1.r_net_force[0]).toBeCloseTo(R.F_net[0], 9);
    }
  });
});

describe('regresyon — dinamik DEĞİŞMEMELİ (altın değerler düzeltmeden önce ölçüldü)', () => {
  // js/simulation-engine.js düzeltilmeden ÖNCE ölçülen değerler. Düzeltme
  // yalnızca işaret çevirisini ekler; F_net/ivme/hız aynı kalmak ZORUNDA.
  const GOLDEN = {
    up: { Fn: -11678.044178179542, a: -0.540650193434238, vEnd: 18.222243105197045 },
    flat: { Fn: 7829.9799445284425, a: 0.3624990715059464, vEnd: 53.49308747305189 },
    down: { Fn: 27367.215165660433, a: 1.267000702113909, vEnd: 80.58839164654091 },
  };

  test.each([
    ['yokuş yukarı', () => UP, GOLDEN.up],
    ['düz', () => FLAT, GOLDEN.flat],
    ['yokuş aşağı', () => DOWN, GOLDEN.down],
  ])('%s: F_net, ivme ve bitiş hızı bit-bit aynı', (_ad, get, g) => {
    const R = get();
    expect(R.F_net[0]).toBeCloseTo(g.Fn, 9);
    expect(R.accel[0]).toBeCloseTo(g.a, 12);
    expect(R.speed[R.speed.length - 1]).toBeCloseTo(g.vEnd, 9);
  });

  test('yokuş yukarı yavaşlatır, yokuş aşağı hızlandırır', () => {
    expect(UP.accel[0]).toBeLessThan(FLAT.accel[0]);
    expect(FLAT.accel[0]).toBeLessThan(DOWN.accel[0]);
    expect(UP.accel[0]).toBeLessThan(0);
  });

  test('eğim terimi tam simetrik: F_net(aşağı) − F_net(yukarı) = 2·|F_grade|', () => {
    expect(DOWN.F_net[0] - UP.F_net[0]).toBeCloseTo(2 * Math.abs(UP.F_grade[0]), 6);
  });

  test('enerji dengesi tutarlı (eğim işareti çevrilince de küçük kalır)', () => {
    for (const R of [UP, FLAT, DOWN]) {
      const eb = R.solverStats.energyError;
      expect(eb).toBeTruthy();
      // veEnergyBalance işareti F_grade konvansiyonunu izler; çeviri sonrası da
      // bağıl hata küçük kalmalı (aksi halde W_grade işareti uzlaşmamış demektir).
      expect(Math.abs(eb.error_pct)).toBeLessThan(1.0);
    }
  });
});
