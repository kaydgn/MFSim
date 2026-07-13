/**
 * arac-performans-calc-trace.test.js
 * ──────────────────────────────────
 * "Detaylı Hesaplama İzi" (calcTrace) altyapısı.
 *
 * İki temel güvence:
 *  1) FAITHFULNESS: iz TOPLAMA açık olsun ya da kapalı, simülasyon SONUÇLARI
 *     (speed/time/distance/rpm/accel) BİREBİR aynı olmalı — iz yalnız gözlemci,
 *     hesabı değiştirmemeli. Aksi hâlde rapor "programın yaptığı"nı değil
 *     "iz açıkken yaptığı"nı gösterir ki hata avının anlamı kalmaz.
 *  2) YAPI + TUTARLILIK: iz açıkken calcTrace dolu gelmeli; yakalanan ara
 *     değerler kendi içinde tutarlı olmalı (F_net = F_traction − F_resist,
 *     accel = F_net / m_eff, entegrasyon aşamaları mevcut, iterasyon kayıtları).
 *
 * Referans senaryo launch-revup testiyle aynı: JMMA (L5D + TC-415 + 3200SP).
 */
const stubs = stubGlobals({ veResetChartView: jest.fn() });
global.veActiveModule = 'full-throttle';
global.COMPONENT_SIGNALS = {};
if (typeof global.window === 'undefined') global.window = {};

eval(loadSource('numerics.js'));
eval(loadSource('cp-engine.js'));
eval(loadSource('cp-gearbox.js'));
eval(loadSource('ft-performance.js'));

const L5D_TORQUE = [
  {rpm:700,torque:203,power:14.9},{rpm:1000,torque:271,power:28.4},{rpm:1200,torque:583,power:73.3},
  {rpm:1400,torque:1085,power:159.1},{rpm:1500,torque:1247,power:195.9},{rpm:1600,torque:1332,power:223.2},
  {rpm:1800,torque:1322,power:249.2},{rpm:2000,torque:1315,power:275.4},{rpm:2200,torque:1302,power:300.0},
  {rpm:2400,torque:1268,power:318.7},{rpm:2600,torque:1247,power:339.5},{rpm:2800,torque:1194,power:350.1},
  {rpm:3000,torque:1085,power:340.9},{rpm:3200,torque:922,power:309.0},{rpm:3400,torque:597,power:212.6},
  {rpm:3600,torque:0,power:0}
];
const TC415 = [
  {sr:0.00,kpump:68.18,tau:2.35},{sr:0.10,kpump:68.28,tau:2.20},{sr:0.20,kpump:68.92,tau:2.04},
  {sr:0.30,kpump:69.42,tau:1.88},{sr:0.42,kpump:70.87,tau:1.67},{sr:0.50,kpump:72.39,tau:1.54},
  {sr:0.55,kpump:73.49,tau:1.47},{sr:0.60,kpump:74.95,tau:1.38},{sr:0.65,kpump:76.63,tau:1.31},
  {sr:0.70,kpump:78.56,tau:1.24},{sr:0.75,kpump:81.23,tau:1.17},{sr:0.80,kpump:84.27,tau:1.09},
  {sr:0.87,kpump:92.89,tau:0.99},{sr:0.90,kpump:99.25,tau:0.99},{sr:0.93,kpump:111.63,tau:0.99},
  {sr:0.95,kpump:137.92,tau:0.98},{sr:0.98,kpump:201.64,tau:0.98},{sr:0.99,kpump:329.27,tau:0.98}
];

function buildJMMA() {
  const engineNode = { id:'e1', type:'engine', data:{
    torqueData: L5D_TORQUE,
    motorSpecs: { idleRpm:700, governedSpeed:3000, noLoadGoverned:3000, inertia:0.5792 },
    governedRpm: 3000,
    accessories: [
      {name:'Fan (Clutch Fan)', userLoss:34.5}, {name:'Alternator / Generator', userLoss:3.5},
      {name:'Air Compressor', userLoss:1.8}, {name:'Steering Pump', userLoss:1.8}
    ]
  }};
  const tcNode = { id:'tc1', type:'torque-converter', data:{ tcData:TC415, pumpTorqueDrop:17.6 } };
  const gearboxNode = { id:'g1', type:'gearbox', data:{
    ftGearData: VE_FT_GB_DEFAULT_GEARS.map(g=>Object.assign({},g)), shiftProfile: 'allison3200sp_s1', efficiency:97 } };
  const propshaftNode = { id:'p1', type:'propshaft', data:{ psEff:98.6, psInertia:0.5 } };
  const transferNode = { id:'t1', type:'transfer', data:{
    ftTrGears:[{kademe:'High',ratio:1.000,eff:97.0},{kademe:'Low',ratio:2.470,eff:97.0}] } };
  const diffNode = { id:'d1', type:'differential', isMasterDiff:true, data:{ diffRatio:7.370, efficiency:96, diffInertia:1.0 } };
  const wheelNode = { id:'w1', type:'wheel', isMasterWheel:true, data:{ ftTireRadius:0.513, ftTireInertia:56.0, ftCrr:0.0035, ftSurfaceFactor:1.0 } };
  const vehicleNode = { id:'v1', type:'vehicle', data:{ ftGVW:11500, ftDrivenWeight:100, ftHeight:6.111, ftWidth:1.0, ftCd:0.900, ftRho:1.169, ftGrade:0 } };
  const shiftCtrlNode = { id:'s1', type:'shift-controller', data:{} };
  const solverNode = { id:'sv1', type:'solver', data:{ maxSimTime:90, ftDt:0.005, method:'rk4' } };
  const chain = [engineNode, tcNode, gearboxNode, propshaftNode, transferNode, diffNode, wheelNode];
  global.nodes = chain.concat([shiftCtrlNode, vehicleNode, solverNode]);
  global.connections = [];
  global.veGetPowertrainChain = () => chain;
}

describe('Detaylı Hesaplama İzi — faithfulness + yapı', () => {
  let R_off, R_on;
  beforeAll(() => {
    buildJMMA();
    window._veFTTraceEnabled = false;
    R_off = veFTRunSimulationEngine();
    window._veFTTraceEnabled = true;
    R_on = veFTRunSimulationEngine();
    window._veFTTraceEnabled = false;
  });

  test('FAITHFULNESS: iz açık/kapalı sonuçlar birebir aynı', () => {
    expect(R_on.speed.length).toBe(R_off.speed.length);
    expect(R_on.time.length).toBe(R_off.time.length);
    for (let i = 0; i < R_off.speed.length; i++) {
      expect(R_on.speed[i]).toBe(R_off.speed[i]);
      expect(R_on.time[i]).toBe(R_off.time[i]);
      expect(R_on.distance[i]).toBe(R_off.distance[i]);
      expect(R_on.rpm[i]).toBe(R_off.rpm[i]);
      expect(R_on.accel[i]).toBe(R_off.accel[i]);
    }
  });

  test('iz KAPALIYKEN calcTrace null (sıfır maliyet)', () => {
    expect(R_off.calcTrace).toBeNull();
  });

  test('iz AÇIKKEN calcTrace dolu: params + steps + stall + lowSpeedOp', () => {
    const T = R_on.calcTrace;
    expect(T).toBeTruthy();
    expect(T.params).toBeTruthy();
    expect(T.params.m_vehicle).toBe(11500);
    expect(T.params.forwardGears.length).toBeGreaterThan(0);
    expect(Array.isArray(T.steps)).toBe(true);
    expect(T.steps.length).toBeGreaterThan(3);      // kalkış + birkaç kilit nokta
    expect(T.settledStall).toBeTruthy();
    expect(T.lowSpeedOp).toBeTruthy();
  });

  test('kalkış adımı yakalandı (reason=kalkis, v≈0)', () => {
    const launch = R_on.calcTrace.steps.find(s => /kalkis/.test(s.reason));
    expect(launch).toBeTruthy();
    expect(launch.v_kmh).toBeLessThan(0.5);
    expect(launch.branch).toBe('converter');       // TK var → kalkış converter dalında
    expect(Array.isArray(launch.lowBranchScan.rows)).toBe(true);
    expect(launch.lowBranchScan.rows.length).toBeGreaterThan(5);  // tarama iterasyonları
  });

  test('vites geçişi adımı yakalandı + shiftEvent eşik içeriyor', () => {
    const sh = R_on.calcTrace.steps.filter(s => s.reason === 'vites-gecisi');
    expect(sh.length).toBeGreaterThanOrEqual(1);
    const withEvent = sh.find(s => s.shiftEvent);
    expect(withEvent).toBeTruthy();
    expect(withEvent.shiftEvent).toHaveProperty('threshold');
    expect(withEvent.shiftEvent).toHaveProperty('N_out');
  });

  test('TUTARLILIK: her iz adımında F_net=F_tr−F_res ve accel=F_net/m_eff', () => {
    R_on.calcTrace.steps.forEach(s => {
      expect(s.F_net).toBeCloseTo(s.F_traction - s.F_resist, 4);
      expect(s.accel).toBeCloseTo(s.F_net / s.m_eff, 8);
      // Direnç toplamı bileşenlerin toplamı
      expect(s.F_resist).toBeCloseTo(s.F_rolling + s.F_aero + s.F_grade, 4);
    });
  });

  test('entegrasyon iç adımları (RK4) yakalandı', () => {
    const s = R_on.calcTrace.steps.find(s => s.integration && s.integration.method === 'rk4');
    expect(s).toBeTruthy();
    expect(s.integration.stages.length).toBe(4);   // k1..k4
    // dv = (k1+2k2+2k3+k4)/6·dt — ilk aşama a(v) mevcut adımın accel'ine eşit
    expect(s.integration.stages[0].accel).toBeCloseTo(s.accel, 8);
    expect(typeof s.integration.dv).toBe('number');
  });

  test('stall taraması + lowSpeedOp bisection iterasyon kayıtları var', () => {
    const stall = R_on.calcTrace.settledStall;
    expect(Array.isArray(stall.scan.iterations)).toBe(true);
    expect(stall.scan.iterations.length).toBeGreaterThan(2);
    expect(stall.scan).toHaveProperty('chosenN');
    const lso = R_on.calcTrace.lowSpeedOp;
    expect(Array.isArray(lso.bisection.iterations)).toBe(true);
    expect(lso.bisection.iterations.length).toBeGreaterThan(2);
  });

  test('eşdeğer kütle terim dökümü yakalandı', () => {
    const s = R_on.calcTrace.steps[0];
    expect(s.massTerms).toBeTruthy();
    expect(s.massTerms).toHaveProperty('I_tire');
    expect(s.massTerms).toHaveProperty('i_total');
  });
});
