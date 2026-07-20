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

function buildSim(tc, opts) {
  opts = opts || {};
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
    shiftProfile:('shiftProfile' in opts ? opts.shiftProfile : 'gm8l90_perf'), forwardGears:8, reverseGears:1, efficiency:97 } };
  const propshaftNode = { id:'p1', type:'propshaft', data:{ psEff:98.6, psInertia:0.5 } };
  const transferNode = { id:'t1', type:'transfer', data:{ ftTrGears: opts.twoRange
    ? [{kademe:'High',ratio:1.0,eff:98.0},{kademe:'Low',ratio:2.5,eff:97.0}]
    : [{kademe:'High',ratio:1.0,eff:98.0}] } };
  const diffNode = { id:'d1', type:'differential', isMasterDiff:true, data:{ diffRatio:3.42, efficiency:96, diffInertia:1.0 } };
  const wheelNode = { id:'w1', type:'wheel', isMasterWheel:true, data:{ ftTireRadius:0.37, ftTireInertia:8.0, ftCrr:0.010, ftSurfaceFactor:1.0 } };
  const vehicleNode = { id:'v1', type:'vehicle', data:{ ftGVW:3200, ftDrivenWeight:100, ftHeight:1.90, ftWidth:1.85, ftCd:0.43, ftRho:1.225, ftGrade:0 } };
  const shiftCtrlNode = { id:'s1', type:'shift-controller', data:{} };
  const solverNode = { id:'sv1', type:'solver', data:{ maxSimTime:90, ftDt:0.01, method:'rk4' } };
  const chain = tc
    ? [engineNode, { id:'tc1', type:'torque-converter', data:{ tcData: tc.tcData, tcName: tc.tcName, pumpTorqueDrop: 17.6 } }, gearboxNode, propshaftNode, transferNode, diffNode, wheelNode]
    : [engineNode, gearboxNode, propshaftNode, transferNode, diffNode, wheelNode];
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
    const i = report.indexOf('PERFORMANS ÖZET TABLOSU');
    const e = report.indexOf('TOPOLOJİ DETAYI');
    section = report.slice(i, e > i ? e : report.length);
  });

  test('rapor üretilir ve Performans Özeti + Eğim Kabiliyeti içerir', () => {
    expect(typeof report).toBe('string');
    expect(report.length).toBeGreaterThan(500);
    expect(section).toContain('PERFORMANS ÖZET TABLOSU');
    expect(section).toContain('EĞİM KABİLİYETİ');
  });

  test('Konvertör Eşleşmesi bölümü TK yokken GÖSTERİLMEZ', () => {
    expect(section).not.toContain('KONVERTÖR EŞLEŞMESİ');
  });

  test('Genel Bilgiler\'de "Tork Konvertoru" satırı TK yokken yok', () => {
    expect(section).not.toContain('Tork Konvertörü');
  });

  test('motor adındaki " | tork&güç" etiketi ayrıştırılır', () => {
    expect(section).toContain('Duramax Turbo Diesel LZ0');
    expect(section).not.toContain('671Nm&227kW');   // etiket ayrıldı
  });

  test('kutu bordürü bozulmaz — tüm tablo satırları eşit genişlik', () => {
    const boxLines = section.split('\n').filter(l => /^\s{2}│/.test(l));
    expect(boxLines.length).toBeGreaterThan(5);
    const widths = boxLines.map(l => l.length);
    const w0 = widths[0];
    widths.forEach(w => expect(w).toBe(w0));   // hiçbir satır taşmıyor
  });

  test('Derecelendirme ve Kılavuz Kontrolü paneli kaldırıldı', () => {
    expect(report).not.toContain('DERECELENDİRME VE KILAVUZ KONTROLÜ');
  });
});

describe('TK VARSA rapor — konvertör bölümleri KORUNUR (ileride TK eklenirse güvence)', () => {
  let report, section, sim;
  beforeAll(() => {
    const TC = { tcName: 'Test Konvertor', tcData: [
      {sr:0.00,kpump:101.50,tau:2.05},{sr:0.20,kpump:102.14,tau:1.85},
      {sr:0.40,kpump:104.30,tau:1.59},{sr:0.60,kpump:108.03,tau:1.35},
      {sr:0.68,kpump:110.61,tau:1.26},{sr:0.80,kpump:120.0,tau:1.10},
      {sr:0.90,kpump:135.0,tau:1.02}
    ] };
    sim = buildSim(TC);
    report = veGenerateFTTxtReport(sim, 'Test');
    const i = report.indexOf('PERFORMANS ÖZET TABLOSU');
    const e = report.indexOf('TOPOLOJİ DETAYI');
    section = report.slice(i, e > i ? e : report.length);
  });

  test('TK varsa Genel Bilgiler\'de "Tork Konvertoru" satırı VAR (adıyla)', () => {
    expect(sim.reportSnapshot.hasTC).toBe(true);
    expect(section).toContain('Tork Konvertörü');
    expect(section).toContain('Test Konvertor');
  });

  test('TK varsa vites-modu converter/lockup (C/L) etiketli — kaldırılmadı', () => {
    expect(sim.gearMode.some(gm => /C$/.test(String(gm)))).toBe(true);
    expect(sim.gearMode.some(gm => /L$/.test(String(gm)))).toBe(true);
  });

  test('kutu bordürü TK\'li raporda da tutarlı', () => {
    const boxLines = section.split('\n').filter(l => /^\s{2}│/.test(l));
    expect(boxLines.length).toBeGreaterThan(5);
    const w0 = boxLines[0].length;
    boxLines.forEach(l => expect(l.length).toBe(w0));
  });
});

describe('Rapor ince ayarları — Shift Profili / Düşük Kademe eğim / Bölüm 4 YORUM', () => {
  test('kayıtlı shift profili YOKSA "Governed" gösterilir', () => {
    const sim = buildSim(null, { shiftProfile: '' });
    expect(sim.reportSnapshot.shiftProfileRegistered).toBe(false);
    expect(veGenerateFTTxtReport(sim, 'Test')).toMatch(/Shift Profili\s*:\s*Governed/);
  });

  test('kayıtlı profil VARSA profil adı gösterilir', () => {
    const sim = buildSim(null, { shiftProfile: 'gm8l90_perf' });
    expect(sim.reportSnapshot.shiftProfileRegistered).toBe(true);
    expect(veGenerateFTTxtReport(sim, 'Test')).toMatch(/Shift Profili\s*:\s*gm8l90_perf/);
  });

  test('düşük kademe VARSA Eğim Kabiliyeti özeti düşük kademeden gelir', () => {
    const sim = buildSim(null, { twoRange: true });
    expect(sim.gradeability.low).toBeTruthy();
    const rep = veGenerateFTTxtReport(sim, 'Test');
    expect(rep).toContain('Stall/Kalkış Eğim (Düşük)');
    expect(rep).toContain('%80 Eğim Kabiliyeti (Düşük)');
    expect(rep).not.toContain('Stall Eğim (Durma)');    // eski yüksek-kademe satırları kaldırıldı
  });

  test('Bölüm 4 (Vites Geçişleri) YORUM kutusu kaldırıldı', () => {
    expect(veGenerateFTTxtReport(buildSim(), 'Test')).not.toContain('viteste tam gaz ivmelenme');
  });
});
