/**
 * arac-performans-launch-revup.test.js
 * ────────────────────────────────────
 * Tam-gaz KALKIŞ (launch) motor rev-up dinamiği — iSCAAN uyumu.
 *
 * Regresyon bağlamı: converter modunda motor devri eskiden her adımda anlık
 * denge noktasına ("stall kökü", ~2334 rpm) ATLIYORDU → kalkışta fizik-dışı
 * yüksek devir + ~1 sn yapay hızlanma avansı. Gerçek fizik: motor rölantiden
 * tork konvertörüne karşı devir alır (dönme ataleti), f(N)=T_net−pompa_emişi
 * teğetliği yüzünden ~1000 rpm'de SÜRÜNÜR, sonra KOPAR (~2400'e).
 *
 * Referans senaryo: JMMA — L5D Duramax (governed 3000) + TC-415 + Allison 3200SP.
 * iSCAAN hedefi: kalkış ~1023 rpm (2334 DEĞİL), 0→20 ≈ 2.2 s (1.1 DEĞİL),
 * kopuştan sonra converter fazı iSCAAN'la örtüşür, lockup (2L…6L) çalışır.
 *
 * Assertion'lar DAVRANIŞSAL bant olarak yazıldı (kırılgan tek-değer değil).
 */
const stubs = stubGlobals({ veResetChartView: jest.fn() });
global.veActiveModule = 'full-throttle';
global.COMPONENT_SIGNALS = {};

eval(loadSource('numerics.js'));
eval(loadSource('cp-engine.js'));
eval(loadSource('cp-gearbox.js'));
eval(loadSource('ft-performance.js'));

// L5D Duramax (kullanıcının Motor bileşeninden — GM 6.6L L5D, 470hp@2800, 1332Nm@1600)
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
  const vehicleNode = { id:'v1', type:'vehicle', data:{ ftGVW:11500, ftDrivenWeight:100, ftHeight:6.111, ftWidth:1.0, ftCd:cd, ftRho:1.169, ftGrade:0 } };
  const shiftCtrlNode = { id:'s1', type:'shift-controller', data:{} };
  const solverNode = { id:'sv1', type:'solver', data:{ maxSimTime:90, ftDt:0.005, method:'rk4' } };
  const chain = [engineNode, tcNode, gearboxNode, propshaftNode, transferNode, diffNode, wheelNode];
  global.nodes = chain.concat([shiftCtrlNode, vehicleNode, solverNode]);
  global.connections = [];
  global.veGetPowertrainChain = () => chain;
}
function atSpeed(R, field, target) {
  const s = R.speed;
  for (let i=1;i<s.length;i++) if (s[i-1] <= target && s[i] >= target) {
    const f = (s[i]>s[i-1]) ? (target-s[i-1])/(s[i]-s[i-1]) : 0;
    return R[field][i-1] + f*(R[field][i]-R[field][i-1]);
  }
  return null;
}

describe('Kalkış rev-up dinamiği (L5D + TC-415 + 3200SP) — iSCAAN uyumu', () => {
  let R;
  beforeAll(() => { buildJMMA(0.900); R = veFTRunSimulationEngine(); });

  test('sonuç sağlam (boş değil, NaN yok)', () => {
    expect(R.speed.length).toBeGreaterThan(30);
    expect(R.rpm.every(v => Number.isFinite(v))).toBe(true);
    expect(R.accel.every(v => Number.isFinite(v))).toBe(true);
    expect(R.TE.every(v => Number.isFinite(v))).toBe(true);
  });

  test('KALKIŞTA motor rölanti civarında — anlık stall köküne (2334) ATLAMIYOR', () => {
    // Eski hatalı davranış: v=0'da motor ~2334 rpm. Fix: rölantiden başlar (~700).
    expect(R.rpm[0]).toBeLessThan(1200);        // 2334 DEĞİL
    expect(R.rpm[0]).toBeGreaterThanOrEqual(690); // idle tabanı
  });

  test('düşük hızda motor "sürünür" (teğetlik) — sonra KOPAR', () => {
    // İlk ~4 km/h'te motor düşük kalmalı (crawl); sonra yüksek dala fırlamalı.
    const rpmAt3 = atSpeed(R, 'rpm', 3.2);
    expect(rpmAt3).toBeLessThan(1300);           // hâlâ sürünme bölgesi
    const rpmAt10 = atSpeed(R, 'rpm', 10);
    expect(rpmAt10).toBeGreaterThan(2100);        // kopmuş, converter dengesinde
  });

  test('kopuştan sonra converter fazı denge devrinde (fizik-dışı runaway yok)', () => {
    // Converter fazı (1C/2C, ≤~28 km/h) motor devri denge civarında kalmalı —
    // eski hatanın (anlık 2334 stall köküne atlama) converter fazına özgü olduğu yer burası.
    const rpmAt16 = atSpeed(R, 'rpm', 16.9);   // hâlâ 2C converter
    expect(rpmAt16).toBeGreaterThan(2500);
    expect(rpmAt16).toBeLessThan(2950);        // governed (3000) altında, converter dengesinde
    // Genel tavan: lockup/overdrive + Vmax-ötesi statik uzantı redline'a (3600) kadar
    // kinematik çıkabilir (fix'ten bağımsız, önceden de böyle) → yalnız redline sınırı.
    expect(Math.max.apply(null, R.rpm)).toBeLessThanOrEqual(3650);
  });

  test('0→20 km/h GERÇEKÇİ (~2.2 s) — eski ~1.1 s yapay avans YOK', () => {
    const t20 = atSpeed(R, 'time', 20);
    expect(t20).toBeGreaterThan(1.8);             // 1.1 s (eski) DEĞİL
    expect(t20).toBeLessThan(2.8);
  });

  test('lockup çalışıyor: converter (C) VE lockup (L) fazları mevcut', () => {
    expect(R.gearMode.some(gm => /C$/.test(String(gm)))).toBe(true);
    expect(R.gearMode.some(gm => /L$/.test(String(gm)))).toBe(true);
    const gearNums = R.gearMode.map(gm => parseInt(String(gm).replace(/[^0-9]/g,''),10));
    expect(Math.max.apply(null, gearNums)).toBeGreaterThanOrEqual(5); // üst viteslere çıkar
  });

  test('hızlanma monoton (dinamik fazda düşen adım yok)', () => {
    let dying = 0;
    for (let i=1;i<R.speed.length;i++) if (R.accel[i] > 0 && R.speed[i] < R.speed[i-1]-1e-6) dying++;
    expect(dying).toBe(0);
  });
});
