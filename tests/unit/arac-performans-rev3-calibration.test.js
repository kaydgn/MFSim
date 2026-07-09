/**
 * arac-performans-rev3-calibration.test.js
 * ─────────────────────────────────────────
 * REV 3 kalibrasyon düzeltmelerinin regresyon kilidi (JMMA: L5D + TC-415 + 3200SP).
 *   Fix B — Governed üstü çift-droop giderildi: tablo no-load'a kadar iniyorsa (L5D 3600→0)
 *           sentetik governor droop UYGULANMAZ → tepe hız iSCAAN'a oturur (~133 km/h).
 *   Fix A — Stall/launch/düşük-hız eğim metrikleri TRANSIENT t=0 satırından değil, motorun
 *           OTURDUĞU quasi-statik noktadan hesaplanır (settledStall ~1000 rpm; low-speed op).
 * Referans iSCAAN: stall eğim 22.3%, launch 20.3%, maks hız 133.4 km/h, 0→20 = 2.2 s.
 */
const stubs = stubGlobals({ veResetChartView: jest.fn() });
global.veActiveModule = 'full-throttle';
global.COMPONENT_SIGNALS = {};

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

function buildJMMA(cd) {
  const engineNode = { id:'e1', type:'engine', data:{
    torqueData: L5D_TORQUE,
    motorSpecs: { idleRpm:700, governedSpeed:3000, noLoadGoverned:3600, inertia:0.5792 },
    governedRpm: 3000,
    accessories: [
      {name:'Fan (Clutch Fan)', userLoss:34.5}, {name:'Alternator / Generator', userLoss:3.5},
      {name:'Air Compressor', userLoss:1.8}, {name:'Steering Pump', userLoss:1.8}
    ]
  }};
  const tcNode = { id:'tc1', type:'torque-converter', data:{ tcData:TC415, pumpTorqueDrop:17.6 } };
  const gearboxNode = { id:'g1', type:'gearbox', data:{
    ftGearData: VE_FT_GB_DEFAULT_GEARS.map(g=>Object.assign({},g)), shiftProfile:'allison3200sp_s1', efficiency:97 }};
  const propshaftNode = { id:'p1', type:'propshaft', data:{ psEff:98.6, psInertia:0.5 } };
  const transferNode = { id:'t1', type:'transfer', data:{
    ftTrGears:[{kademe:'High',ratio:1.000,eff:97.0},{kademe:'Low',ratio:2.470,eff:97.0}] }};
  const diffNode = { id:'d1', type:'differential', isMasterDiff:true, data:{ diffRatio:7.370, efficiency:96, diffInertia:1.0 } };
  const wheelNode = { id:'w1', type:'wheel', isMasterWheel:true, data:{ ftTireRadius:0.513, ftTireInertia:49.12, ftCrr:0.0035, ftSurfaceFactor:1.0 } };
  const vehicleNode = { id:'v1', type:'vehicle', data:{ ftGVW:11500, ftDrivenWeight:100, ftHeight:6.111, ftWidth:1.0, ftCd:cd, ftRho:1.225, ftGrade:0 } };
  const shiftCtrlNode = { id:'s1', type:'shift-controller', data:{} };
  const solverNode = { id:'sv1', type:'solver', data:{ maxSimTime:120, ftDt:0.005, method:'rk4' } };
  const chain = [engineNode, tcNode, gearboxNode, propshaftNode, transferNode, diffNode, wheelNode];
  global.nodes = chain.concat([shiftCtrlNode, vehicleNode, solverNode]);
  global.connections = [];
  global.veGetPowertrainChain = () => chain;
}
function dynMaxSpeed(R){ let m=0; for(let i=0;i<R.speed.length;i++) if(R.accel[i]>0 && R.speed[i]>m) m=R.speed[i]; return m; }
function timeToSpeed(R, tgt){ for(let i=1;i<R.speed.length;i++){ if(R.speed[i-1]<=tgt&&R.speed[i]>=tgt){ const f=(R.speed[i]>R.speed[i-1])?(tgt-R.speed[i-1])/(R.speed[i]-R.speed[i-1]):0; return R.time[i-1]+f*(R.time[i]-R.time[i-1]); } } return null; }

describe('REV3 Fix B — governed üstü çift-droop giderildi', () => {
  test('tablo no-load\'a kadar iniyorsa sentetik droop UYGULANMAZ (PCHIP tabloyu izler)', () => {
    // L5D: tablo 3600\'de sıfır. governed 3000, noLoad 3600. Çift-droop olmamalı.
    const fn = FT_SOLVER.createMotorTorqueFn(L5D_TORQUE.map(d=>({rpm:d.rpm,torque:d.torque})), 3000, 3600);
    expect(fn(3143)).toBeGreaterThan(900);   // tablo ~969; çift-droop olsaydı ~745 olurdu
    expect(fn(3354)).toBeGreaterThan(620);   // tablo ~672; çift-droop olsaydı ~283 olurdu
    expect(fn(3600)).toBeLessThan(5);        // no-load: sıfır
  });
  test('tablo yalnız governed\'a kadarsa sentetik droop KORUNUR (geriye uyum)', () => {
    // Tablo 3000\'de bitiyor → üstü düz ekstrapolasyon → sentetik droop gerekli.
    const shortTable = L5D_TORQUE.filter(d=>d.rpm<=3000).map(d=>({rpm:d.rpm,torque:d.torque}));
    const fn = FT_SOLVER.createMotorTorqueFn(shortTable, 3000, 3600);
    expect(fn(3300)).toBeLessThan(fn(3000));   // droop tabloyu (düz 1085) aşağı çeker
    expect(fn(3600)).toBe(0);                  // noLoad\'da sıfır
  });
  test('tam koşuda düz yol maks hız iSCAAN bandında (~133 km/h, çift-droop yok)', () => {
    buildJMMA(0.750);
    const R = veFTRunSimulationEngine();
    expect(dynMaxSpeed(R)).toBeGreaterThan(131);   // düzeltme öncesi ~127.4 idi
    expect(dynMaxSpeed(R)).toBeLessThan(136);
  });
});

describe('REV3 Fix A — eğim metrikleri oturmuş noktadan (transient değil)', () => {
  let R;
  beforeAll(() => { buildJMMA(0.750); R = veFTRunSimulationEngine(); });

  test('settledStall v=0 oturmuş noktayı verir (~1000-1050 rpm, teğetlik; 2334 DEĞİL)', () => {
    expect(R.settledStall).toBeTruthy();
    expect(R.settledStall.N_engine).toBeGreaterThanOrEqual(950);
    expect(R.settledStall.N_engine).toBeLessThanOrEqual(1120);   // iSCAAN 1023 bandı
    expect(R.settledStall.TE_kN).toBeGreaterThan(18);            // yüksek köke (2334→79 kN grip) kaçmadı
    expect(R.settledStall.TE_kN).toBeLessThan(30);
  });

  test('simülasyon izi hâlâ rölantiden başlar (Option A korunmuş)', () => {
    expect(R.rpm[0]).toBeLessThan(900);   // t=0 fiziksel idle (~700)
  });

  test('stall eğim yanlış andan değil oturmuş noktadan → makul (transient 9.5% DEĞİL)', () => {
    const G = veCalculateGradeability(R);
    expect(G).toBeTruthy();
    expect(G.high.stallGrade).toBeGreaterThan(17);   // iSCAAN 22.3, band tabanı ~20; transient 9.5\'i kesin geçer
    expect(G.high.stallGrade).toBeLessThan(26);
    // launch = stall civarı (stall−2 konvansiyonu), transient 7.5 değil
    expect(G.high.launchGrade).toBeGreaterThan(15);
  });

  test('lowSpeedOp quasi-statik ~10 km/h noktası mevcut ve makul', () => {
    expect(R.lowSpeedOp).toBeTruthy();
    expect(R.lowSpeedOp.TE_kN).toBeGreaterThan(60);
    expect(R.lowSpeedOp.TE_kN).toBeLessThan(85);
  });
});

describe('REV3 REGRESYON — rev-up fix + hızlanma + lockup korunuyor', () => {
  let R;
  beforeAll(() => { buildJMMA(0.750); R = veFTRunSimulationEngine(); });

  test('0→20 km/h iSCAAN bandında (~2.2 s) — rev-up transiyenti korunuyor', () => {
    const t20 = timeToSpeed(R, 20);
    expect(t20).toBeGreaterThan(2.0);
    expect(t20).toBeLessThan(2.6);
  });
  test('vites/mod dizisi lockup\'a geçer ve 6. vitese çıkar', () => {
    const gm = R.gearMode.map(String);
    expect(gm.some(g => /L$/.test(g))).toBe(true);          // lockup fazı
    const nums = gm.map(g => parseInt(g.replace(/[^0-9]/g,''),10));
    expect(Math.max.apply(null, nums)).toBe(6);
  });
});
