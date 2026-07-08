/**
 * arac-performans-notc-report.test.js
 * TK'siz Tam-Gaz TXT raporunun (graphics.js veGenerateFTTxtReport) "Performans
 * Özeti" bölümünün TK-temizliği ve kutu-bütünlüğü.
 *
 * Doğrulananlar:
 *  - Konvertör Eşleşmesi bölümü TK yokken GÖSTERİLMEZ (kaldırıldı).
 *  - Genel Bilgiler'de "Tork Konvertoru" satırı TK yokken gösterilmez.
 *  - Motor adındaki " | tork&güç" etiketi ayrıştırılır (yalnız görünen ad).
 *  - Kutu bordürü uzun adlarla bozulmaz (tüm '  |' satırları eşit genişlik).
 */
const stubs = stubGlobals({ veResetChartView: jest.fn(), showToast: jest.fn() });
global.veActiveModule = 'full-throttle';
global.COMPONENT_SIGNALS = {};
eval(loadSource('numerics.js'));
eval(loadSource('cp-engine.js'));
eval(loadSource('cp-gearbox.js'));
eval(loadSource('ft-performance.js'));
eval(loadSource('results.js'));
eval(loadSource('graphics.js'));

function buildSim() {
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
  const vehicleNode = { id:'v1', type:'vehicle', data:{ ftGVW:3200, ftDrivenWeight:100, ftHeight:1.90, ftWidth:1.85, ftCd:0.43, ftRho:1.225, ftGrade:0 } };
  const shiftCtrlNode = { id:'s1', type:'shift-controller', data:{} };
  const solverNode = { id:'sv1', type:'solver', data:{ maxSimTime:90, ftDt:0.01, method:'rk4' } };
  const chain = [engineNode, gearboxNode, propshaftNode, transferNode, diffNode, wheelNode];
  global.nodes = chain.concat([shiftCtrlNode, vehicleNode, solverNode]);
  global.connections = [];
  global.veGetPowertrainChain = () => chain;
  try { nodes = global.nodes; } catch(e) {}
  try { connections = global.connections; } catch(e) {}
  try { veGetPowertrainChain = global.veGetPowertrainChain; } catch(e) {}
  if (typeof window !== 'undefined') window._veFTAllRangeResults = null;
  const sim = veFTRunSimulationEngine();
  sim.gradeability = veCalculateGradeability(sim);
  sim.acceleration = veCalculateAcceleration(sim);
  return sim;
}

describe('TK\'siz Tam-Gaz TXT raporu — Performans Özeti temizliği', () => {
  let report, section;
  beforeAll(() => {
    const sim = buildSim();
    report = veGenerateFTTxtReport(sim, 'Test');
    const i = report.indexOf('6. PERFORMANS OZETI');
    const e = report.indexOf('RAPOR SONU');
    section = report.slice(i, e > i ? e : report.length);
  });

  test('rapor üretilir ve Performans Özeti + Eğim Kabiliyeti içerir', () => {
    expect(typeof report).toBe('string');
    expect(report.length).toBeGreaterThan(500);
    expect(section).toContain('PERFORMANS OZETI');
    expect(section).toContain('EGIM KABILIYETI');
  });

  test('Konvertör Eşleşmesi bölümü TK yokken GÖSTERİLMEZ', () => {
    expect(section).not.toContain('KONVERTOR ESLESMESI');
  });

  test('Genel Bilgiler\'de "Tork Konvertoru" satırı TK yokken yok', () => {
    expect(section).not.toContain('Tork Konvertoru');
  });

  test('motor adındaki " | tork&güç" etiketi ayrıştırılır', () => {
    expect(section).toContain('Duramax Turbo Diesel LZ0');
    expect(section).not.toContain('671Nm&227kW');   // etiket ayrıldı
  });

  test('kutu bordürü bozulmaz — tüm tablo satırları eşit genişlik', () => {
    const boxLines = section.split('\n').filter(l => /^\s{2}\|/.test(l));
    expect(boxLines.length).toBeGreaterThan(5);
    const widths = boxLines.map(l => l.length);
    const w0 = widths[0];
    widths.forEach(w => expect(w).toBe(w0));   // hiçbir satır taşmıyor
  });
});
