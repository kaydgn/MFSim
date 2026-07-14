/**
 * arac-performans-turan-calibration.test.js
 * ──────────────────────────────────────────
 * TURAN (Cummins ISB6.7 · Allison 3000SP · TC-413 · 5.904 aks · 2.337/1.257 transfer)
 * kalibrasyonu — iSCAAN TURAN_.html referansına karşı (Rev4 brief §9 kabul kriterleri).
 *
 * Korunan düzeltmeler:
 *   Fix 1 — Lockup tork zinciri: pompa drop + düz 0.965 ÜÇLÜ kayıp sayımı kaldırıldı;
 *           dişli kaybı calcGearEfficiency ile bir kez. (0-100: 37.6→35.3 s)
 *   Fix 3 — Gradeability metriği GRİP-LİMİTSİZ (drivetrain kapasitesi) + tekerlek-kayması
 *           bayrağı. (OnRoad stall 97→112, OffRoad stall 97→999)
 *   (Fix 2 stall birleştirme — evrensel çalışma noktası commit'inde yapıldı.)
 */
const stubs = stubGlobals({ veResetChartView: jest.fn() });
global.veActiveModule = 'full-throttle';
global.COMPONENT_SIGNALS = {};
global.window = global.window || {};
eval(loadSource('numerics.js')); eval(loadSource('cp-engine.js')); eval(loadSource('cp-gearbox.js')); eval(loadSource('ft-performance.js'));

const ISB=[{rpm:800,torque:610,power:51.1},{rpm:900,torque:695,power:65.5},{rpm:1000,torque:780,power:81.7},{rpm:1100,torque:875,power:100.8},{rpm:1200,torque:1000,power:125.7},{rpm:1300,torque:1050,power:142.9},{rpm:1400,torque:1100,power:161.3},{rpm:1500,torque:1100,power:172.8},{rpm:1600,torque:1100,power:184.3},{rpm:1700,torque:1100,power:195.8},{rpm:1800,torque:1075,power:202.6},{rpm:1900,torque:1050,power:208.9},{rpm:2000,torque:1025,power:214.7},{rpm:2100,torque:1000,power:219.9},{rpm:2200,torque:985,power:226.9},{rpm:2300,torque:960,power:231.2},{rpm:2400,torque:950,power:238.8},{rpm:2500,torque:940,power:246.1},{rpm:2600,torque:915,power:249.1},{rpm:2700,torque:887.5,power:250.9},{rpm:2800,torque:860,power:252.2},{rpm:2830,torque:0,power:0}];
const TC413=[{sr:0.00,kpump:73.33,tau:2.44},{sr:0.10,kpump:73.04,tau:2.27},{sr:0.20,kpump:73.33,tau:2.09},{sr:0.30,kpump:73.38,tau:1.90},{sr:0.41,kpump:73.93,tau:1.70},{sr:0.50,kpump:74.87,tau:1.54},{sr:0.55,kpump:75.77,tau:1.46},{sr:0.60,kpump:77.11,tau:1.39},{sr:0.64,kpump:78.51,tau:1.32},{sr:0.70,kpump:80.66,tau:1.24},{sr:0.75,kpump:82.75,tau:1.17},{sr:0.80,kpump:85.30,tau:1.10},{sr:0.88,kpump:95.19,tau:0.98},{sr:0.90,kpump:105.00,tau:0.97},{sr:0.93,kpump:118.41,tau:0.97},{sr:0.95,kpump:143.48,tau:0.96},{sr:0.98,kpump:208.25,tau:0.96},{sr:0.99,kpump:304.85,tau:0.96}];
const BMC_GEARS=[{name:'1C',ratio:3.487,eff:98.1},{name:'2C',ratio:1.864,eff:98.8},{name:'3L',ratio:1.409,eff:99.0},{name:'4L',ratio:1.000,eff:99.6},{name:'5L',ratio:0.750,eff:98.6},{name:'6L',ratio:0.652,eff:98.0}];
function buildTURAN(){const chain=[
  {id:'e1',type:'engine',data:{torqueData:ISB,motorSpecs:{idleRpm:700,governedSpeed:2800,noLoadGoverned:2830,inertia:0.9562},governedRpm:2800,accessories:[{name:'Fan (Kavramalı Fan)',userLoss:20.2},{name:'Alternator',userLoss:2.5},{name:'Hava Kompresoru',userLoss:1.3},{name:'Direksiyon Pompasi',userLoss:1.3}]}},
  {id:'tc1',type:'torque-converter',data:{tcData:TC413,pumpTorqueDrop:17.6}},
  {id:'g1',type:'gearbox',data:{ftGearData:BMC_GEARS,shiftProfile:'allison3200sp_s1',efficiency:98}},
  {id:'p1',type:'propshaft',data:{psEff:98.6,psInertia:0.5}},
  {id:'t1',type:'transfer',data:{ftTrGears:[{kademe:'OnRoad',ratio:1.257,eff:97},{kademe:'OffRoad',ratio:2.337,eff:97}]}},
  {id:'d1',type:'differential',isMasterDiff:true,data:{diffRatio:5.904,efficiency:95,diffInertia:1.0}},
  {id:'w1',type:'wheel',isMasterWheel:true,data:{ftTireRadius:0.531,ftTireInertia:63.7721,ftCrr:0.0035,ftSurfaceFactor:1.0}}];
  global.nodes=chain.concat([{id:'s1',type:'shift-controller',data:{}},{id:'v1',type:'vehicle',data:{ftGVW:13060,ftDrivenWeight:100,ftHeight:6.11,ftWidth:1.0,ftCd:0.750,ftRho:1.225,ftGrade:0}},{id:'sv1',type:'solver',data:{maxSimTime:300,ftDt:0.002,method:'rk4'}}]);
  global.connections=[];global.veGetPowertrainChain=()=>chain;}
function at(R,f,tv){for(let i=1;i<R.speed.length;i++){if(R.speed[i-1]<=tv&&R.speed[i]>=tv){const q=(R.speed[i]>R.speed[i-1])?(tv-R.speed[i-1])/(R.speed[i]-R.speed[i-1]):0;return R[f][i-1]+q*(R[f][i]-R[f][i-1]);}}return null;}

let on, off, G;
beforeAll(() => {
  buildTURAN();
  on = veFTRunSimulationEngine('OnRoad');
  off = veFTRunSimulationEngine('OffRoad');
  global.window._veFTAllRangeResults = { OnRoad: on, OffRoad: off };
  global.window._veFTTransferGears = [{kademe:'OnRoad',ratio:1.257,eff:97},{kademe:'OffRoad',ratio:2.337,eff:97}];
  G = veCalculateGradeability(on);
});

describe('TURAN OnRoad (1.257) — iSCAAN kabul (§9.1)', () => {
  test('hızlanma süreleri iSCAAN bandında', () => {
    expect(at(on,'time',20)).toBeLessThan(1.9);
    expect(at(on,'time',30)).toBeGreaterThan(3.1); expect(at(on,'time',30)).toBeLessThan(3.6);
    expect(at(on,'time',60)).toBeGreaterThan(11.2); expect(at(on,'time',60)).toBeLessThan(12.0);   // Fix1: 12.2→11.7
    expect(at(on,'time',100)).toBeGreaterThan(34.4); expect(at(on,'time',100)).toBeLessThan(36.4); // Fix1: 37.6→35.3
  });
  test('stall/launch eğimi GRİP-LİMİTSİZ (Fix 3) + kayma bayrağı', () => {
    expect(G.high.stallGrade).toBeGreaterThan(110);   // iSCAAN 113.6; eski grip-kırpık 97.1
    expect(G.high.launchGrade).toBeGreaterThan(108);  // iSCAAN 111.6
    expect(on.settledStall.slip).toBe(true);          // TE(96) > F_grip(89.7) → tekerlek kayması olası
    expect(on.settledStall.TE_gripLimited_kN).toBeLessThan(on.settledStall.TE_kN); // ayrıca saklanır
  });
  test('düşük-hız eğimi ve düz-yol tavan hızı bandında', () => {
    expect(G.high.lowSpeedGrade).toBeGreaterThan(45); expect(G.high.lowSpeedGrade).toBeLessThan(51);
    expect(G.high.maxSpeedFlat).toBeGreaterThan(115); expect(G.high.maxSpeedFlat).toBeLessThan(118);
  });
});

describe('TURAN OffRoad (2.337) — iSCAAN kabul (§9.2)', () => {
  test('hızlanma süreleri iSCAAN bandında', () => {
    expect(at(off,'time',20)).toBeLessThan(1.9);
    expect(at(off,'time',60)).toBeGreaterThan(11.2); expect(at(off,'time',60)).toBeLessThan(12.2);
  });
  test('stall/launch ölçek-dışı (DP ≥ m·g → 999/997), düz-yol tavan ~63', () => {
    expect(G.low).toBeTruthy();
    expect(G.low.stallGrade).toBe(999);   // iSCAAN 999 (eski yanlış: rölanti 13.7)
    expect(G.low.launchGrade).toBe(997);
    expect(G.low.maxSpeedFlat).toBeGreaterThan(62); expect(G.low.maxSpeedFlat).toBeLessThan(64);
  });
});

describe('TURAN çıpalar (§8 regresyon)', () => {
  test('quasi-statik stall motor ~2204 rpm (evrensel çalışma noktası)', () => {
    expect(on.settledStall.N_engine).toBeGreaterThan(2150);
    expect(on.settledStall.N_engine).toBeLessThan(2260);
  });
  test('Fix 1 — 4L lockup çıkış torku iSCAAN düzleminde (~778, üçlü-kayıp 734 DEĞİL)', () => {
    let idx=-1; for(let i=0;i<on.gearMode.length;i++){if(String(on.gearMode[i])==='4L' && on.rpm[i]>2680 && on.rpm[i]<2760){idx=i;break;}}
    expect(idx).toBeGreaterThan(0);
    expect(on.T_output[idx]).toBeGreaterThan(760);   // eski üçlü-kayım 733.8; iSCAAN 778.2
    expect(on.T_output[idx]).toBeLessThan(800);
  });
});
