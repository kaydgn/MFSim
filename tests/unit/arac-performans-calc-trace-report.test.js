/**
 * arac-performans-calc-trace-report.test.js
 * ─────────────────────────────────────────
 * "Detaylı Hesaplama İzi" TXT rapor ÜRETECİ (veGenerateFTCalcTraceReport).
 *
 * Politika gereği tek "smoke" testi: rapor patlamadan üretiliyor mu, izli
 * yeniden-koşuyu yapıp bölümleri (formül sözlüğü, stall, adım izi) içeriyor mu.
 * Etiket/biçim ayrıntısı için kırılgan assertion AÇILMAZ — davranış test edilir.
 */
const stubs = stubGlobals({ veResetChartView: jest.fn() });
global.veActiveModule = 'full-throttle';
global.COMPONENT_SIGNALS = {};
// graphics.js yüklenirken window.addEventListener('resize',...) çağırır → stub
global.window = { addEventListener: function () {} };

eval(loadSource('numerics.js'));
eval(loadSource('cp-engine.js'));
eval(loadSource('cp-gearbox.js'));
eval(loadSource('ft-performance.js'));
eval(loadSource('graphics.js'));

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
    accessories: [ {name:'Fan (Clutch Fan)', userLoss:34.5}, {name:'Alternator', userLoss:3.5} ]
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

describe('veGenerateFTCalcTraceReport — smoke', () => {
  let txt;
  beforeAll(() => { buildJMMA(); txt = veGenerateFTCalcTraceReport(null, 'Test Muhendis'); });

  test('rapor uretiliyor, boş değil, hata mesajı değil', () => {
    expect(typeof txt).toBe('string');
    expect(txt.length).toBeGreaterThan(2000);
    expect(txt).not.toMatch(/uretilemedi/);
  });

  test('ana bölümler mevcut (kılavuz, girdiler, formül, stall, adım izi)', () => {
    expect(txt).toContain('DETAY MATEMATIK HESAPLARI');
    expect(txt).toContain('A. GIRDILER VE SABITLER');
    expect(txt).toContain('B. FORMUL SOZLUGU');
    expect(txt).toContain('OTURMUS STALL');
    expect(txt).toContain('ADIM ADIM HIZLANMA IZI');
    expect(txt).toContain('Test Muhendis');       // yazar başlıkta
  });

  test('adım izinde formül+sayı ikamesi var (F_aero substitution)', () => {
    expect(txt).toMatch(/0\.5 \* rho \* Cd \* A \* v\^2/);       // aero formülü
    expect(txt).toMatch(/\(F_cekis - F_direnc\) \/ m_eff/);     // ivme formülü
    expect(txt).toMatch(/k1 = a\(v\)/);                          // RK4 iç adımı yazılmış
  });

  test('izli yeniden-koşu ekrandaki veriyi (window.veSimResults) bozmaz', () => {
    // Rapor üretimi window.veSimResults'a dokunmamalı (sadece kendi koşusunu yapar)
    expect(window.veSimResults).toBeUndefined();
  });

  test('düşük kademe (rangeSel=low) ayrı iz üretir', () => {
    const low = veGenerateFTCalcTraceReport(null, 'Test', 'low');
    expect(typeof low).toBe('string');
    expect(low.charAt(0)).not.toBe('(');                         // hata mesajı değil
    expect(low).toMatch(/Transfer Kademesi\s*:\s*Low/);          // düşük kademe başlıkta
    // yüksek ve düşük farklı içerik (farklı transfer oranı → farklı devir/kuvvet)
    expect(low).not.toBe(txt);
  });
});
