/**
 * arac-performans-operating-point.test.js
 * ────────────────────────────────────────
 * EVRENSEL KONVERTÖR ÇALIŞMA NOKTASI (Approach A) doğrulaması.
 *
 * Tam-gaz tam-gaz tablosunda motor, kalkışta idle→stall rev-up transientini (iSCAAN'ın
 * ihmal ettiği) atlayarak konvertör ÇALIŞMA NOKTASINDAN başlar. İki motor+TK kombinasyonu
 * kendi kendine ayrışır:
 *   • BMC/isb67 + TC-413  → düşük dal YOK → v=0'da temiz yüksek STALL (~2204, iSCAAN 2204)
 *   • JMMA/L5D  + TC-415  → teğet düşük dal → v=0'da ~1010 oyalanma (iSCAAN 1023) → kopuş
 *
 * Bu test, sabit 850-1350 rpm penceresine bağlı ESKİ (config'e özel) tespitin geri
 * gelmesini ve BMC'nin yeniden rölantiden (700) başlamasını önler.
 */
const stubs = stubGlobals({ veResetChartView: jest.fn() });
global.veActiveModule = 'full-throttle';
global.COMPONENT_SIGNALS = {};
eval(loadSource('numerics.js'));
eval(loadSource('cp-engine.js'));
eval(loadSource('cp-gearbox.js'));
eval(loadSource('ft-performance.js'));

function at(R, f, tv) {
  for (let i = 1; i < R.speed.length; i++) {
    if (R.speed[i - 1] <= tv && R.speed[i] >= tv) {
      const q = (R.speed[i] > R.speed[i - 1]) ? (tv - R.speed[i - 1]) / (R.speed[i] - R.speed[i - 1]) : 0;
      return R[f][i - 1] + q * (R[f][i] - R[f][i - 1]);
    }
  }
  return null;
}
function dynMax(R) { let m = 0; for (let i = 0; i < R.speed.length; i++) if (R.accel[i] > 0 && R.speed[i] > m) m = R.speed[i]; return m; }

// ═══ BMC / TURAN (isb67 + TC-413) — temiz yüksek stall (düşük dal yok) ═══
const ISB = [{ rpm: 800, torque: 610, power: 51.1 }, { rpm: 900, torque: 695, power: 65.5 }, { rpm: 1000, torque: 780, power: 81.7 }, { rpm: 1100, torque: 875, power: 100.8 }, { rpm: 1200, torque: 1000, power: 125.7 }, { rpm: 1300, torque: 1050, power: 142.9 }, { rpm: 1400, torque: 1100, power: 161.3 }, { rpm: 1500, torque: 1100, power: 172.8 }, { rpm: 1600, torque: 1100, power: 184.3 }, { rpm: 1700, torque: 1100, power: 195.8 }, { rpm: 1800, torque: 1075, power: 202.6 }, { rpm: 1900, torque: 1050, power: 208.9 }, { rpm: 2000, torque: 1025, power: 214.7 }, { rpm: 2100, torque: 1000, power: 219.9 }, { rpm: 2200, torque: 985, power: 226.9 }, { rpm: 2300, torque: 960, power: 231.2 }, { rpm: 2400, torque: 950, power: 238.8 }, { rpm: 2500, torque: 940, power: 246.1 }, { rpm: 2600, torque: 915, power: 249.1 }, { rpm: 2700, torque: 887.5, power: 250.9 }, { rpm: 2800, torque: 860, power: 252.2 }, { rpm: 2830, torque: 0, power: 0 }];
const TC413 = [{ sr: 0.00, kpump: 73.33, tau: 2.44 }, { sr: 0.10, kpump: 73.04, tau: 2.27 }, { sr: 0.20, kpump: 73.33, tau: 2.09 }, { sr: 0.30, kpump: 73.38, tau: 1.90 }, { sr: 0.41, kpump: 73.93, tau: 1.70 }, { sr: 0.50, kpump: 74.87, tau: 1.54 }, { sr: 0.55, kpump: 75.77, tau: 1.46 }, { sr: 0.60, kpump: 77.11, tau: 1.39 }, { sr: 0.64, kpump: 78.51, tau: 1.32 }, { sr: 0.70, kpump: 80.66, tau: 1.24 }, { sr: 0.75, kpump: 82.75, tau: 1.17 }, { sr: 0.80, kpump: 85.30, tau: 1.10 }, { sr: 0.88, kpump: 95.19, tau: 0.98 }, { sr: 0.90, kpump: 105.00, tau: 0.97 }, { sr: 0.93, kpump: 118.41, tau: 0.97 }, { sr: 0.95, kpump: 143.48, tau: 0.96 }, { sr: 0.98, kpump: 208.25, tau: 0.96 }, { sr: 0.99, kpump: 304.85, tau: 0.96 }];
const BMC_GEARS = [{ name: '1C', ratio: 3.487, eff: 98.1 }, { name: '2C', ratio: 1.864, eff: 98.8 }, { name: '3L', ratio: 1.409, eff: 99.0 }, { name: '4L', ratio: 1.000, eff: 99.6 }, { name: '5L', ratio: 0.750, eff: 98.6 }, { name: '6L', ratio: 0.652, eff: 98.0 }];
function buildBMC() {
  const chain = [
    { id: 'e1', type: 'engine', data: { torqueData: ISB, motorSpecs: { idleRpm: 700, governedSpeed: 2800, noLoadGoverned: 2830, inertia: 0.9562 }, governedRpm: 2800, accessories: [{ name: 'Fan (Kavramalı Fan)', userLoss: 20.2 }, { name: 'Alternator', userLoss: 2.5 }, { name: 'Hava Kompresoru', userLoss: 1.3 }, { name: 'Direksiyon Pompasi', userLoss: 1.3 }] } },
    { id: 'tc1', type: 'torque-converter', data: { tcData: TC413, pumpTorqueDrop: 17.6 } },
    { id: 'g1', type: 'gearbox', data: { ftGearData: BMC_GEARS, shiftProfile: 'allison3200sp_s1', efficiency: 98 } },
    { id: 'p1', type: 'propshaft', data: { psEff: 98.6, psInertia: 0.5 } },
    { id: 't1', type: 'transfer', data: { ftTrGears: [{ kademe: 'OnRoad', ratio: 1.257, eff: 97 }, { kademe: 'OffRoad', ratio: 2.337, eff: 97 }] } },
    { id: 'd1', type: 'differential', isMasterDiff: true, data: { diffRatio: 5.904, efficiency: 95, diffInertia: 1.0 } },
    { id: 'w1', type: 'wheel', isMasterWheel: true, data: { ftTireRadius: 0.531, ftTireInertia: 63.7721, ftCrr: 0.0035, ftSurfaceFactor: 1.0 } }];
  global.nodes = chain.concat([{ id: 's1', type: 'shift-controller', data: {} }, { id: 'v1', type: 'vehicle', data: { ftGVW: 13060, ftDrivenWeight: 100, ftHeight: 2.472, ftWidth: 2.472, ftCd: 0.900, ftRho: 1.225, ftGrade: 0 } }, { id: 'sv1', type: 'solver', data: { maxSimTime: 300, ftDt: 0.001, method: 'rk4' } }]);
  global.connections = []; global.veGetPowertrainChain = () => chain;
}

// ═══ JMMA (L5D + TC-415) — teğet düşük dal (regresyon) ═══
const L5D = [{ rpm: 700, torque: 203, power: 14.9 }, { rpm: 1000, torque: 271, power: 28.4 }, { rpm: 1200, torque: 583, power: 73.3 }, { rpm: 1400, torque: 1085, power: 159.1 }, { rpm: 1500, torque: 1247, power: 195.9 }, { rpm: 1600, torque: 1332, power: 223.2 }, { rpm: 1800, torque: 1322, power: 249.2 }, { rpm: 2000, torque: 1315, power: 275.4 }, { rpm: 2200, torque: 1302, power: 300.0 }, { rpm: 2400, torque: 1268, power: 318.7 }, { rpm: 2600, torque: 1247, power: 339.5 }, { rpm: 2800, torque: 1194, power: 350.1 }, { rpm: 3000, torque: 1085, power: 340.9 }, { rpm: 3200, torque: 922, power: 309.0 }, { rpm: 3400, torque: 597, power: 212.6 }, { rpm: 3600, torque: 0, power: 0 }];
const TC415 = [{ sr: 0.00, kpump: 68.18, tau: 2.35 }, { sr: 0.10, kpump: 68.28, tau: 2.20 }, { sr: 0.20, kpump: 68.92, tau: 2.04 }, { sr: 0.30, kpump: 69.42, tau: 1.88 }, { sr: 0.42, kpump: 70.87, tau: 1.67 }, { sr: 0.50, kpump: 72.39, tau: 1.54 }, { sr: 0.55, kpump: 73.49, tau: 1.47 }, { sr: 0.60, kpump: 74.95, tau: 1.38 }, { sr: 0.65, kpump: 76.63, tau: 1.31 }, { sr: 0.70, kpump: 78.56, tau: 1.24 }, { sr: 0.75, kpump: 81.23, tau: 1.17 }, { sr: 0.80, kpump: 84.27, tau: 1.09 }, { sr: 0.87, kpump: 92.89, tau: 0.99 }, { sr: 0.90, kpump: 99.25, tau: 0.99 }, { sr: 0.93, kpump: 111.63, tau: 0.99 }, { sr: 0.95, kpump: 137.92, tau: 0.98 }, { sr: 0.98, kpump: 201.64, tau: 0.98 }, { sr: 0.99, kpump: 329.27, tau: 0.98 }];
function buildJMMA() {
  const chain = [{ id: 'e1', type: 'engine', data: { torqueData: L5D, motorSpecs: { idleRpm: 700, governedSpeed: 3000, noLoadGoverned: 3600, inertia: 0.5792 }, governedRpm: 3000, accessories: [{ name: 'Fan (Clutch Fan)', userLoss: 34.5 }, { name: 'Alt', userLoss: 3.5 }, { name: 'Comp', userLoss: 1.8 }, { name: 'Steer', userLoss: 1.8 }] } }, { id: 'tc1', type: 'torque-converter', data: { tcData: TC415, pumpTorqueDrop: 17.6 } }, { id: 'g1', type: 'gearbox', data: { ftGearData: VE_FT_GB_DEFAULT_GEARS.map(g => Object.assign({}, g)), shiftProfile: 'allison3200sp_s1', efficiency: 97 } }, { id: 'p1', type: 'propshaft', data: { psEff: 98.6, psInertia: 0.5 } }, { id: 't1', type: 'transfer', data: { ftTrGears: [{ kademe: 'High', ratio: 1.0, eff: 97 }, { kademe: 'Low', ratio: 2.470, eff: 97 }] } }, { id: 'd1', type: 'differential', isMasterDiff: true, data: { diffRatio: 7.370, efficiency: 96, diffInertia: 1.0 } }, { id: 'w1', type: 'wheel', isMasterWheel: true, data: { ftTireRadius: 0.513, ftTireInertia: 49.12, ftCrr: 0.0035, ftSurfaceFactor: 1.0 } }];
  global.nodes = chain.concat([{ id: 's1', type: 'shift-controller', data: {} }, { id: 'v1', type: 'vehicle', data: { ftGVW: 11500, ftDrivenWeight: 100, ftHeight: 6.111, ftWidth: 1.0, ftCd: 0.750, ftRho: 1.225, ftGrade: 0 } }, { id: 'sv1', type: 'solver', data: { maxSimTime: 120, ftDt: 0.005, method: 'rk4' } }]);
  global.connections = []; global.veGetPowertrainChain = () => chain;
}

describe('Evrensel konvertör çalışma noktası — BMC (temiz yüksek stall)', () => {
  let R;
  beforeAll(() => { buildBMC(); R = veFTRunSimulationEngine(); });

  test('v=0 motor STALL noktasında (~2204), RÖLANTİDE (700) DEĞİL', () => {
    expect(R.rpm[0]).toBeGreaterThan(2100);     // iSCAAN 2204
    expect(R.rpm[0]).toBeLessThan(2320);
    expect(R.rpm[0]).toBeGreaterThan(1500);     // kesinlikle idle transienti değil
  });

  test('v=0 çekiş STALL seviyesinde (yüksek), idle transient (~10 kN) DEĞİL', () => {
    expect(R.TE[0]).toBeGreaterThan(80);        // iSCAAN 96.6; grip/verim'e göre ~90
  });

  test('düşük hız izi iSCAAN eşleşme taramasını takip eder (~2200 civarı, düşük dala düşmez)', () => {
    expect(at(R, 'rpm', 3.2)).toBeGreaterThan(2130);   // iSCAAN 2203
    expect(at(R, 'rpm', 3.2)).toBeLessThan(2280);
    expect(at(R, 'rpm', 9.6)).toBeGreaterThan(2170);   // iSCAAN 2259
    expect(at(R, 'rpm', 9.6)).toBeLessThan(2320);
  });

  test('settledStall v=0 iz satırıyla tutarlı (aynı çalışma noktası)', () => {
    expect(R.settledStall).toBeTruthy();
    expect(Math.abs(R.settledStall.N_engine - R.rpm[0])).toBeLessThan(30);
  });
});

describe('Evrensel konvertör çalışma noktası — JMMA (teğet düşük dal, regresyon)', () => {
  let R;
  beforeAll(() => { buildJMMA(); R = veFTRunSimulationEngine(); });

  test('v=0 DÜŞÜK DAL noktasında oyalanır (~1010), stall\'a (2335) kaçmaz', () => {
    expect(R.rpm[0]).toBeGreaterThanOrEqual(950);      // iSCAAN 1023
    expect(R.rpm[0]).toBeLessThanOrEqual(1120);
  });

  test('düşük dal ~3 km/h\'ye kadar tutulur, sonra yüksek dala KOPAR', () => {
    expect(at(R, 'rpm', 3.2)).toBeLessThan(1250);      // hâlâ düşük dal (iSCAAN 1011)
    expect(at(R, 'rpm', 9.7)).toBeGreaterThan(2200);   // kopmuş, yüksek dal (iSCAAN 2463)
  });

  test('hızlanma iSCAAN bandında (0→20 in 2.0-2.5 s) ve maks hız ~133', () => {
    const t20 = at(R, 'time', 20);
    expect(t20).toBeGreaterThan(2.0);
    expect(t20).toBeLessThan(2.5);
    expect(dynMax(R)).toBeGreaterThan(131);
    expect(dynMax(R)).toBeLessThan(136);
  });
});
