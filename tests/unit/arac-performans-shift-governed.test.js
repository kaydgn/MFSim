/**
 * arac-performans-shift-governed.test.js
 * ───────────────────────────────────────
 * GOVERNED ÜST-VİTES GÜVENLİĞİ — over-rev / vites-atmama koruması.
 *
 * Hata (düzeltme öncesi): TK-yok (doğrudan tahrik) + derin vites oranlı bir kurulumda
 * (6.6L V8 Duramax L5P, gov 3450), 2. viteste motor governed'ı geçip no-load'a (3600)
 * dayanıyor ama ÜST vitese GEÇMİYOR — çünkü converter→lockup (2C→2L) çıkış eşiği (shift
 * profili farklı oran için kalibre) governed'daki çıkış devrinin ÜSTÜNDE kalıp mode-flip'i
 * ve dolayısıyla 2→3 geçişini tamamen bloke ediyor. Motor 0 çekişte takılıyor.
 *
 * Düzeltme: motor governed'a ulaşınca ve üst vites varsa, mod/eşik ne olursa olsun ÜST
 * vitese geç (governed güvenliği). TK-yok'ta lockup-flag set edilmez → downshift hunt yok.
 */
const stubs = stubGlobals({ veResetChartView: jest.fn() });
global.veActiveModule = 'full-throttle';
global.COMPONENT_SIGNALS = {};
eval(loadSource('numerics.js')); eval(loadSource('cp-engine.js')); eval(loadSource('cp-gearbox.js')); eval(loadSource('ft-performance.js'));

const GEARS = [{name:'1',ratio:4.71,eff:98},{name:'2',ratio:3.14,eff:98},{name:'3',ratio:2.09,eff:98},{name:'4',ratio:1.40,eff:98},{name:'5',ratio:1.00,eff:98},{name:'6',ratio:0.75,eff:98}];
function buildNoTC_Duramax() {
  const p = VE_FT_MOTOR_PRESETS['duramax_l5p_470'];  // 6.6L V8 Duramax L5P, gov 3450, noLoad 3600
  const chain = [
    { id:'e1', type:'engine', data:{ ftMotorPreset:'duramax_l5p_470', torqueData:p.data.map(d=>({rpm:d.rpm,torque:d.torque,power:d.power})), motorSpecs:Object.assign({},p.specs), governedRpm:p.specs.governedSpeed, accessories:p.accessories.map(a=>Object.assign({},a)) } },
    { id:'g1', type:'gearbox', data:{ ftGearData:GEARS, shiftProfile:'allison3200sp_s1', efficiency:98 } },
    { id:'p1', type:'propshaft', data:{ psEff:98.6, psInertia:0.5 } },
    { id:'t1', type:'transfer', data:{ ftTrGears:[{kademe:'Yuksek',ratio:1.0,eff:98},{kademe:'Alcak',ratio:2.0,eff:98}] } },
    { id:'d1', type:'differential', isMasterDiff:true, data:{ diffRatio:4.10, efficiency:97, diffInertia:1.0 } },
    { id:'w1', type:'wheel', isMasterWheel:true, data:{ ftTireRadius:0.40, ftTireInertia:8, ftCrr:0.0035, ftSurfaceFactor:1.0 } }];
  global.nodes = chain.concat([{ id:'s1', type:'shift-controller', data:{} }, { id:'v1', type:'vehicle', data:{ ftGVW:4500, ftDrivenWeight:100, ftHeight:2.0, ftWidth:2.0, ftCd:0.45, ftRho:1.225, ftGrade:0 } }, { id:'sv1', type:'solver', data:{ maxSimTime:120, ftDt:0.005, method:'rk4' } }]);
  global.connections = []; global.veGetPowertrainChain = () => chain;
}

describe('Governed üst-vites güvenliği (TK-yok, derin oran, yüksek-devir motor)', () => {
  let R, specs;
  beforeAll(() => { buildNoTC_Duramax(); R = veFTRunSimulationEngine(); specs = VE_FT_MOTOR_PRESETS['duramax_l5p_470'].specs; });

  function gearIdx(g) { return parseInt(String(g).replace(/[^0-9]/g, ''), 10) || 0; }

  test('TÜM vitesler kullanılır — 2. viteste takılıp kalmaz', () => {
    const gearsSeen = new Set(R.gearMode.map(g => gearIdx(g)));
    expect(gearsSeen.size).toBeGreaterThanOrEqual(5);   // düzeltme öncesi yalnız 1,2 (2'de takılı)
    expect(gearsSeen.has(6)).toBe(true);                // en üst vitese ulaşır
  });

  test('ara vitesler no-load\'a dayanmaz — governed civarında ÜST vitese geçer', () => {
    // Her vitesteki maks motor devri (son vites hariç) no-load'ın altında; ~governed'da vites atar.
    const maxByGear = {};
    for (let i = 0; i < R.speed.length; i++) {
      const gi = gearIdx(R.gearMode[i]);
      if (!maxByGear[gi] || R.rpm[i] > maxByGear[gi]) maxByGear[gi] = R.rpm[i];
    }
    for (let g = 1; g <= 5; g++) {
      expect(maxByGear[g]).toBeLessThan(specs.governedSpeed + 80);   // over-rev yok (eski hata: 3600'e dayanma)
    }
  });

  test('vites dizisi MONOTON artan — up/down HUNT yok', () => {
    let prev = 0, maxSeen = 0;
    for (let i = 0; i < R.gearMode.length; i++) {
      const gi = gearIdx(R.gearMode[i]);
      if (gi === 0) continue;
      // Hızlanma sırasında vites yalnız artmalı (küçük geri düşüş = hunt → başarısız).
      expect(gi).toBeGreaterThanOrEqual(maxSeen - 0);
      if (gi > maxSeen) maxSeen = gi;
      prev = gi;
    }
    expect(maxSeen).toBe(6);
  });
});
