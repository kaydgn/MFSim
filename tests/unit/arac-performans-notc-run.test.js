/**
 * arac-performans-notc-run.test.js
 * ─────────────────────────────────
 * UÇTAN-UCA doğrulama: Tork Konvertörü OLMADAN (Motor → Şanzıman doğrudan)
 * kurulan güç aktarma zinciriyle GERÇEK performans çözücüsü
 * (veFTRunSimulationEngine) koşar ve makul bir tam-gaz hızlanma sonucu üretir mi?
 *
 * Motor = 3.0L Duramax LZ0 preset'i, Şanzıman = 8L90 (gm8l90_perf profili).
 * Çözücü saf-hesap bir sonuç nesnesi döndürür (DOM'a yazmaz) → headless koşar.
 * veGetPowertrainChain + grafik/sinyal yan-etkileri stub'lanır.
 */
const stubs = stubGlobals({ veResetChartView: jest.fn() });
global.veActiveModule = 'full-throttle';
global.COMPONENT_SIGNALS = {};           // sinyal kaydı devre dışı (sonuç dizileri yine dolar)

eval(loadSource('numerics.js'));         // pchipCreate / pchipEval
eval(loadSource('cp-engine.js'));        // VE_FT_MOTOR_PRESETS
eval(loadSource('cp-gearbox.js'));       // VE_GEARBOX_PRESETS, VE_FT_SHIFT_PROFILES, VE_FT_GB_DEFAULT_GEARS
eval(loadSource('ft-performance.js'));   // FT_SOLVER + veFTRunSimulationEngine

// ── TK'SİZ GÜÇ AKTARMA ZİNCİRİ KUR ──────────────────────────────────────────
function buildNoTCTopology() {
  const eng = VE_FT_MOTOR_PRESETS['duramax_lz0_305'];
  const engineNode = {
    id: 'e1', type: 'engine', data: {
      ftMotorPreset: 'duramax_lz0_305',
      torqueData: eng.data.map(d => ({ rpm: d.rpm, torque: d.torque, power: d.power })),
      motorSpecs: Object.assign({}, eng.specs),
      governedRpm: eng.specs.governedSpeed,
      accessories: eng.accessories.map(a => Object.assign({}, a))
    }
  };

  // 8L90 ileri vitesleri → ftGearData (onVEFTGBPresetSelect'in ürettiği şekle uygun)
  const gb = VE_GEARBOX_PRESETS['8L90'];
  const ftGearData = gb.gears.filter(g => g.gear !== 'R').map((g, i) => ({
    name: 'F' + g.gear, ratio: g.ratio,
    eff: Math.abs(g.ratio - 1.0) < 0.01 ? 99.64 : (i === 0 ? 98.11 : 98.5),
    lockup: i > 0
  }));
  ftGearData.push({ name: 'R1', ratio: 3.82, eff: 97.5, lockup: false });

  const gearboxNode = {
    id: 'g1', type: 'gearbox', data: {
      ftGBPreset: '8L90', gbName: gb.name, ftGearData: ftGearData,
      shiftProfile: 'gm8l90_perf', forwardGears: 8, reverseGears: 1, efficiency: 97,
      gbGrossInputPower: gb.grossInputPower, gbGrossInputTorque: gb.grossInputTorque,
      gbNetTurbineTorque: gb.netTurbineTorque
    }
  };

  const propshaftNode = { id: 'p1', type: 'propshaft', data: { psEff: 98.6, psInertia: 0.5 } };
  const transferNode = {
    id: 't1', type: 'transfer', data: {
      ftTrGears: [{ kademe: 'High', ratio: 1.0, eff: 98.0 }, { kademe: 'Low', ratio: 2.5, eff: 97.0 }]
    }
  };
  const diffNode = { id: 'd1', type: 'differential', isMasterDiff: true, data: { diffRatio: 3.42, efficiency: 96, diffInertia: 1.0 } };
  const wheelNode = { id: 'w1', type: 'wheel', isMasterWheel: true, data: { ftTireRadius: 0.37, ftTireInertia: 8.0, ftCrr: 0.010, ftSurfaceFactor: 1.0 } };
  const vehicleNode = {
    id: 'v1', type: 'vehicle', data: {
      ftGVW: 3200, ftDrivenWeight: 100, ftHeight: 1.90, ftWidth: 1.85, ftCd: 0.43, ftRho: 1.225, ftGrade: 0
    }
  };
  const shiftCtrlNode = { id: 's1', type: 'shift-controller', data: {} };
  const solverNode = { id: 'sv1', type: 'solver', data: { maxSimTime: 90, ftDt: 0.01, method: 'rk4' } };

  // Zincir: TK YOK — motor doğrudan şanzımana
  const chain = [engineNode, gearboxNode, propshaftNode, transferNode, diffNode, wheelNode];
  global.nodes = chain.concat([shiftCtrlNode, vehicleNode, solverNode]);
  global.connections = [];
  global.veGetPowertrainChain = () => chain;
  return { chain };
}

describe('TK\'siz (Motor→Şanzıman) tam-gaz koşumu — gerçek çözücü', () => {
  let R;
  beforeAll(() => {
    buildNoTCTopology();
    R = veFTRunSimulationEngine();
  });

  test('çözücü sonuç üretir (boş değil, NaN yok)', () => {
    expect(R).toBeTruthy();
    expect(R.mode).toBe('full-throttle');
    expect(Array.isArray(R.speed)).toBe(true);
    expect(R.speed.length).toBeGreaterThan(50);
    expect(R.time.length).toBe(R.speed.length);
    expect(R.speed.every(v => Number.isFinite(v))).toBe(true);
    expect(R.rpm.every(v => Number.isFinite(v))).toBe(true);
    expect(R.accel.every(v => Number.isFinite(v))).toBe(true);
  });

  test('araç hızlanır — dinamik tepe hız makul (statik drawbar-uzantısı hariç)', () => {
    expect(R.speed[0]).toBeLessThan(5);          // duruştan kalkış
    // Dinamik tepe hız = ivmenin pozitif olduğu en yüksek hız. Çözücü, tepe hızın
    // ÖTESİNDE rapor için statik drawbar-eğrisi noktaları ekler (ivme<0, WP→0'a
    // kadar; bkz. ft-performance.js:1338 "STATİK UZANTI") → onları hariç tut.
    let vDyn = 0;
    for (let i = 0; i < R.speed.length; i++) if (R.accel[i] > 0 && R.speed[i] > vDyn) vDyn = R.speed[i];
    expect(vDyn).toBeGreaterThan(150);           // km/h — makul dinamik tepe hız
    expect(vDyn).toBeLessThan(280);
    // Dinamik hızlanma fazı monoton (statik uzantıya kadar düşen adım yok)
    let dyingSteps = 0;
    for (let i = 1; i < R.speed.length; i++) if (R.accel[i] > 0 && R.speed[i] < R.speed[i - 1] - 1e-6) dyingSteps++;
    expect(dyingSteps).toBe(0);
  });

  test('0–100 km/h makul bir sürede', () => {
    let t100 = null;
    for (let i = 0; i < R.speed.length; i++) {
      if (R.speed[i] >= 100) { t100 = R.time[i]; break; }
    }
    expect(t100).not.toBeNull();
    expect(t100).toBeGreaterThan(3);    // fizik-dışı hızlı değil
    expect(t100).toBeLessThan(30);      // makul üst sınır
  });

  test('tüm 8 vites kullanılır (vites geçişleri çalışıyor)', () => {
    const gearNums = R.gearMode.map(gm => parseInt(String(gm).replace(/[^0-9]/g, ''), 10));
    expect(Math.max.apply(null, gearNums)).toBe(8);   // 8. vitese kadar çıkar
    expect(Math.min.apply(null, gearNums)).toBe(1);   // 1. viteste başlar
  });

  test('vites geçişleri güç tepesi yakınında (~3900 rpm) olur — 8L90 profili', () => {
    const gearNums = R.gearMode.map(gm => parseInt(String(gm).replace(/[^0-9]/g, ''), 10));
    const upshiftRpms = [];
    for (let i = 1; i < gearNums.length; i++) {
      if (gearNums[i] > gearNums[i - 1]) upshiftRpms.push(R.rpm[i - 1]); // geçiş öncesi devir
    }
    expect(upshiftRpms.length).toBeGreaterThanOrEqual(6);   // 1→2 ... 7→8
    upshiftRpms.forEach(rpm => {
      expect(rpm).toBeGreaterThan(3600);
      expect(rpm).toBeLessThan(4150);
    });
  });

  test('motor devri fiziksel aralıkta kalır (rölanti…redline)', () => {
    const maxRpm = Math.max.apply(null, R.rpm);
    const minRpm = Math.min.apply(null, R.rpm);
    expect(minRpm).toBeGreaterThanOrEqual(699);   // rölanti tabanı (idleRpm=700)
    expect(maxRpm).toBeLessThanOrEqual(5000);     // maks. motor devri
  });

  test('TK yok → hayalet konvertör kayıpları uygulanmaz (SR=τ=1, çıkış torku ≈ motor·dişli verimi)', () => {
    // Hızlanma boyunca tüm adımlarda SR=1, τ=1 (kilitli/doğrudan)
    expect(R.SR.every(sr => Math.abs(sr - 1.0) < 1e-6)).toBe(true);
    expect(R.tau.every(t => Math.abs(t - 1.0) < 1e-6)).toBe(true);
    // Bir orta adımda T_output ≈ T_engine × dişli verimi (pompa/klaç kaybı yok)
    const k = Math.floor(R.T_output.length / 2);
    const ratio = R.T_output[k] / R.engineTorque[k];
    expect(ratio).toBeGreaterThan(0.95);   // yalnız dişli verimi (~0.98), TK kaybı yok
    expect(ratio).toBeLessThanOrEqual(1.0);
  });
});
