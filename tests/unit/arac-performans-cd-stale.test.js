/**
 * arac-performans-cd-stale.test.js
 * ─────────────────────────────────
 * Regresyon: Araç 'Cd' (ve diğer aero/kütle) parametresi düzeltildiğinde detaylı
 * raporun ESKİ (çözüm anındaki, ör. varsayılan 0.9) değeri göstermeye devam etmesi
 * hatasının düzeltmesini doğrular.
 *
 * Kök neden: detaylı rapor girdi parametrelerini (Cd, alan, GVW…) çözüm anında
 * alınan reportSnapshot'tan okur. Kullanıcı Cd'yi değiştirse bile — yeniden
 * çözmeden — rapor eski Cd'yi gösterir; bu bayat snapshot projeyle kaydedilip
 * yeniden açılışta da 0.9 gelir.
 *
 * Düzeltme: çözümü etkileyen bir araç parametresi GERÇEKTEN değişince
 * onVEFTVehicleParamChange saklanan simülasyon sonucunu (window.veSimResults)
 * geçersiz kılar → rapor "önce çöz" durumuna döner; yeniden çözünce güncel Cd
 * kullanılır ve snapshot doğru değeri taşır.
 */
const stubs = stubGlobals({ veResetChartView: jest.fn(), showToast: jest.fn(), showNodeProperties: jest.fn() });
global.veActiveModule = 'full-throttle';
global.COMPONENT_SIGNALS = {};
global.veProjectName = 'Test';
global.connections = [];
global.compCounter = 0;
global.canvasOffset = { x: 0, y: 0 };
global.canvasZoom = 1;
global.veTabs = [{ id: 't1', name: 'T1', state: { simResults: null } }];
global.veActiveTabIdx = 0;

eval(loadSource('numerics.js'));
eval(loadSource('cp-engine.js'));
eval(loadSource('cp-gearbox.js'));
eval(loadSource('ft-performance.js'));
eval(loadSource('results.js'));
eval(loadSource('graphics.js'));
eval(loadSource('component-extras.js'));

function buildNodes() {
  const eng = VE_FT_MOTOR_PRESETS['duramax_lz0_305'];
  const engineNode = { id:'e1', type:'engine', data:{ ftMotorPreset:'duramax_lz0_305',
    torqueData: eng.data.map(d=>({rpm:d.rpm,torque:d.torque,power:d.power})),
    motorSpecs: Object.assign({}, eng.specs), governedRpm: eng.specs.governedSpeed,
    accessories: eng.accessories.map(a=>Object.assign({},a)) } };
  const gb = VE_GEARBOX_PRESETS['8L90'];
  const ftGearData = gb.gears.filter(g=>g.gear!=='R').map((g,i)=>({name:'F'+g.gear,ratio:g.ratio,
    eff: Math.abs(g.ratio-1.0)<0.01?99.64:(i===0?98.11:98.5), lockup:i>0}));
  ftGearData.push({name:'R1',ratio:3.82,eff:97.5,lockup:false});
  const gearboxNode = { id:'g1', type:'gearbox', data:{ ftGBPreset:'8L90', gbName:gb.name, ftGearData,
    shiftProfile:'gm8l90_perf', forwardGears:8, reverseGears:1, efficiency:97 } };
  const propshaftNode = { id:'p1', type:'propshaft', data:{ psEff:98.6, psInertia:0.5 } };
  const transferNode = { id:'t1', type:'transfer', data:{ ftTrGears:[{kademe:'High',ratio:1.0,eff:98.0}] } };
  const diffNode = { id:'d1', type:'differential', isMasterDiff:true, data:{ diffRatio:3.42, efficiency:96, diffInertia:1.0 } };
  const wheelNode = { id:'w1', type:'wheel', isMasterWheel:true, data:{ ftTireRadius:0.37, ftTireInertia:8.0, ftCrr:0.010, ftSurfaceFactor:1.0 } };
  const vehicleNode = { id:'v1', type:'vehicle', data:{ ftGVW:3200, ftDrivenWeight:100, ftHeight:1.90, ftWidth:1.85, ftRho:1.225, ftGrade:0 } }; // ftCd yok → panel varsayılanı 0.9
  const shiftCtrlNode = { id:'s1', type:'shift-controller', data:{} };
  const solverNode = { id:'sv1', type:'solver', data:{ maxSimTime:90, ftDt:0.01, method:'rk4' } };
  const chain = [engineNode, gearboxNode, propshaftNode, transferNode, diffNode, wheelNode];
  return { all: chain.concat([shiftCtrlNode, vehicleNode, solverNode]), chain, vehicleNode };
}

function solve() {
  const sim = veFTRunSimulationEngine();
  window.veSimResults = sim;
  return sim;
}

// Aracın Cd input'unu DOM'a kur (panelin ürettiği id ile) ve değeri gir.
function setCdInput(vehId, value) {
  document.body.innerHTML = '<input id="ve-ftv-cd-' + vehId + '" value="' + value + '">';
}

describe('Araç Cd düzeltmesi — bayat rapor snapshot düzeltmesi', () => {
  let vehicleNode;
  beforeEach(() => {
    resetStubs(stubs);
    const b = buildNodes();
    vehicleNode = b.vehicleNode;
    global.nodes = b.all; try { nodes = global.nodes; } catch(e){}
    global.veGetPowertrainChain = () => b.chain; try { veGetPowertrainChain = global.veGetPowertrainChain; } catch(e){}
    if (typeof window !== 'undefined') { window._veFTAllRangeResults = null; window.veSimResults = null; }
    veTabs[0].state.simResults = null;
    document.body.innerHTML = '';
  });

  test('çözüm anında snapshot varsayılan Cd=0.9 taşır', () => {
    const sim = solve();
    expect(sim.reportSnapshot.cd).toBeCloseTo(0.9, 3);
  });

  test('Cd düzeltilince BAYAT sonuç geçersiz kılınır (rapor eski 0.9 göstermez)', () => {
    solve();
    expect(window.veSimResults).not.toBeNull();
    expect(window.veSimResults.reportSnapshot.cd).toBeCloseTo(0.9, 3);

    // Kullanıcı Cd'yi 0.43'e düzeltir (panel input + onchange)
    setCdInput('v1', '0.43');
    onVEFTVehicleParamChange('v1');

    // node.data güncel; ÖNCEKİ çözüm sonucu bayat olduğu için temizlendi
    expect(vehicleNode.data.ftCd).toBeCloseTo(0.43, 3);
    expect(window.veSimResults).toBeNull();
    expect(veTabs[0].state.simResults).toBeNull();
  });

  test('yeniden çözünce snapshot güncel Cd=0.43 taşır', () => {
    solve();
    setCdInput('v1', '0.43');
    onVEFTVehicleParamChange('v1');
    expect(window.veSimResults).toBeNull();

    const sim2 = solve();
    expect(sim2.reportSnapshot.cd).toBeCloseTo(0.43, 3);
  });

  test('Cd DEĞİŞMEYİNCE (aynı değer flush) sonuç geçersiz kılınmaz', () => {
    vehicleNode.data.ftCd = 0.43;   // önceden ayarlı
    solve();
    expect(window.veSimResults).not.toBeNull();

    // Panel flush'ı aynı değeri yazar → değişiklik yok → sonuç korunur
    setCdInput('v1', '0.43');
    onVEFTVehicleParamChange('v1');
    expect(window.veSimResults).not.toBeNull();
  });

  test('varsayılanın ilk kez node.data\'ya yazılması (0.9) yanlış geçersizleme yapmaz', () => {
    // ftCd tanımsız (panel varsayılan 0.9 gösterir). Çözülür.
    solve();
    expect(window.veSimResults).not.toBeNull();
    // Kullanıcı Cd'ye dokunmadan panel flush olur: DOM varsayılan 0.9 → node.data.ftCd=0.9
    setCdInput('v1', '0.9');
    onVEFTVehicleParamChange('v1');
    // Efektif değer değişmediği için sonuç KORUNUR
    expect(window.veSimResults).not.toBeNull();
    expect(vehicleNode.data.ftCd).toBeCloseTo(0.9, 3);
  });
});
