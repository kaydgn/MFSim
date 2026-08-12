/**
 * arac-performans-shift-4500sp.test.js
 * ────────────────────────────────────
 * REGRESYON BEKÇİSİ: Allison 4500 SP — S1 Performance profilinin 2C→2L eşiği.
 *
 * SORUN (2026-08-12'de bulundu): profilin converterShifts['2C2L'] bloğu
 *   { type:'segmented', linear:{a:0.0800, b:111.0, validFrom:1800}, lookup:[[1600,230],[1700,242]] }
 * ESL = 1900'de 263 rpm eşik veriyordu. 1C→2C eşiği 303 rpm olduğundan lockup,
 * 2C'ye geçilen ADIMDA devreye giriyor; 2L'de motor 1640 rpm'e düşünce '2to1'
 * downshift eşiği (492) tetikleniyor ve 1C↔2C↔2L avlanması başlıyordu.
 * Ölçüm (bu dosyadaki topoloji): 321 geçiş / 105 aşağı vites.
 *
 * KÖK NEDEN: eşik kalibre edilirken türbin devri şanzıman çıkış devrine
 * çevrilirken vites oranına BİR KEZ FAZLA bölünmüş — 575.2 / 2.213 ≈ 260 ≈ 263.
 *
 * DOĞRU DEĞER — iSCAAN 497-A355435-1 (BMC 10TON 6×6 · Cummins ISG12 380HP ·
 * Allison 4500 SP · TC551 · aks 8.337 · transfer 0.874/1.536 · ESL 1900):
 * raporun "Vehicle Acceleration Performance" tablolarında her vitesin SON satırı
 * geçiş noktasıdır. İKİ transfer kademesi bağımsız iki ölçüm verir ve ikisi de
 * aynı şanzıman çıkış devrini üretir — modelin "geçiş N_out'a bağlı" varsayımı:
 *
 *   geçiş    Low tablosu (i_aux 1.536)   High tablosu (i_aux 0.874)   N_motor
 *   1C→2C     5.4 km/h × 55.849 = 301.6    9.5 × 31.779 = 301.9        1797
 *   2C→2L    10.3        ×      = 575.2   18.1        = 575.2          1762
 *   2L→3L    14.8        ×      = 826.6   26.0        = 826.3          1826
 *   3L→4L    21.4        ×      = 1195.2  37.6        = 1194.9         1826
 *   4L→5L    32.7        ×      = 1826.3  57.4        = 1824.1         1825
 *   5L→6L    42.8        ×      = 2390.3  75.1        = 2386.6         1827
 *
 * Bütün lockup geçişleri N_motor = ESL − 74 rpm'de → 3200SP S1'in kodda yazılı
 * kuralının (ESL − 75) aynısı. Beş katsayı zaten ±2 rpm uyuşuyordu; yalnız
 * 2C→2L 312 rpm sapıyordu.
 */
const stubs = stubGlobals({ veResetChartView: jest.fn() });
global.veActiveModule = 'full-throttle';
global.COMPONENT_SIGNALS = {};

eval(loadSource('numerics.js'));
eval(loadSource('cp-engine.js'));
eval(loadSource('cp-gearbox.js'));
eval(loadSource('cp-accessories.js'));
eval(loadSource('ft-performance.js'));

beforeEach(() => resetStubs(stubs));

const ESL = 1900;

// ── iSCAAN 497-A355435-1 geçiş noktaları (şanzıman çıkış devri, rpm) ────────
// İki transfer kademesinin ortalaması; kademeler arası fark ≤ 3.7 rpm.
const ISCAAN_SHIFT_NOUT = {
  '1C2C': 301.8, '2C2L': 575.2, '2L3L': 826.5,
  '3L4L': 1195.1, '4L5L': 1825.2, '5L6L': 2388.5
};

// ── Raporun güç aktarma organları ──────────────────────────────────────────
// Motor eğrisi BRÜT (iSCAAN "Gross Torque"): aksesuar kaybını ft-performance
// kendi modeliyle düşer; net girilirse kayıp iki kez sayılır.
const ISG12_380 = [
  { rpm: 1000, torque: 1995.8, power: 209.0 }, { rpm: 1100, torque: 1996.7, power: 230.0 },
  { rpm: 1200, torque: 1997.4, power: 251.0 }, { rpm: 1300, torque: 1998.0, power: 272.0 },
  { rpm: 1400, torque: 1930.3, power: 283.0 }, { rpm: 1500, torque: 1801.6, power: 283.0 },
  { rpm: 1600, torque: 1689.0, power: 283.0 }, { rpm: 1700, torque: 1589.7, power: 283.0 },
  { rpm: 1800, torque: 1501.4, power: 283.0 }, { rpm: 1900, torque: 1407.3, power: 280.0 },
  { rpm: 2100, torque: 0, power: 0 }
];
// TC551 — raporun "Converter Mode" tablosundan türetildi:
//   T_pompa = T_türbin / τ,  K = N_motor / √T_pompa
const TC551 = [
  { sr: 0.000, kpump: 38.26, tau: 1.794 }, { sr: 0.100, kpump: 39.24, tau: 1.686 },
  { sr: 0.200, kpump: 39.81, tau: 1.600 }, { sr: 0.300, kpump: 41.10, tau: 1.540 },
  { sr: 0.400, kpump: 42.41, tau: 1.485 }, { sr: 0.497, kpump: 44.16, tau: 1.409 },
  { sr: 0.500, kpump: 44.21, tau: 1.406 }, { sr: 0.600, kpump: 46.01, tau: 1.300 },
  { sr: 0.632, kpump: 46.66, tau: 1.267 }, { sr: 0.700, kpump: 48.07, tau: 1.199 },
  { sr: 0.728, kpump: 48.69, tau: 1.168 }, { sr: 0.750, kpump: 49.19, tau: 1.144 },
  { sr: 0.800, kpump: 50.45, tau: 1.088 }, { sr: 0.850, kpump: 52.17, tau: 1.028 },
  { sr: 0.885, kpump: 54.58, tau: 0.983 }, { sr: 0.888, kpump: 55.09, tau: 0.985 },
  { sr: 0.891, kpump: 55.70, tau: 0.986 }, { sr: 0.895, kpump: 56.57, tau: 0.988 },
  { sr: 0.900, kpump: 57.64, tau: 0.990 }, { sr: 0.925, kpump: 66.20, tau: 0.992 },
  { sr: 0.940, kpump: 74.05, tau: 0.991 }, { sr: 0.950, kpump: 81.58, tau: 0.992 },
  { sr: 0.960, kpump: 93.71, tau: 0.989 }
];
const GEARS_4500SP = [
  { name: '1C', ratio: 4.695, eff: 98.83 }, { name: '2C', ratio: 2.213, eff: 99.05 },
  { name: '3L', ratio: 1.529, eff: 99.31 }, { name: '4L', ratio: 1.000, eff: 100.00 },
  { name: '5L', ratio: 0.765, eff: 99.18 }, { name: '6L', ratio: 0.672, eff: 99.05 }
];

function buildBMC10Ton(shiftProfile) {
  const chain = [
    { id: 'e1', type: 'engine', data: {
      torqueData: ISG12_380,
      motorSpecs: { idleRpm: 700, governedSpeed: ESL, noLoadGoverned: 2100, inertia: 2.7029 },
      accessories: [
        { name: 'Fan (Kavramalı Fan)', userLoss: 35.6 },
        { name: 'Alternatör / Jeneratör', userLoss: 2.8 },
        { name: 'Hava Kompresörü', userLoss: 1.6 },
        { name: 'Direksiyon Pompası', userLoss: 1.6 }
      ]
    } },
    { id: 'tc1', type: 'torque-converter', data: { tcData: TC551, pumpTorqueDrop: 32.2 } },
    { id: 'g1', type: 'gearbox', data: { ftGearData: GEARS_4500SP, shiftProfile: shiftProfile || 'allison4500sp_s1' } },
    { id: 'p1', type: 'propshaft', data: { psEff: 98.6, psInertia: 0.5 } },
    { id: 't1', type: 'transfer', data: { ftTrGears: [
      { kademe: 'High', ratio: 0.874, eff: 97 }, { kademe: 'Low', ratio: 1.536, eff: 97 }
    ] } },
    { id: 'd1', type: 'differential', isMasterDiff: true, data: { diffRatio: 8.337, efficiency: 93, diffInertia: 1.0 } },
    { id: 'w1', type: 'wheel', isMasterWheel: true, data: { ftTireRadius: 0.608, ftTireInertia: 293.8965, ftCrr: 0.0035, ftSurfaceFactor: 1.0 } }
  ];
  global.nodes = chain.concat([
    { id: 's1', type: 'shift-controller', data: {} },
    { id: 'v1', type: 'vehicle', data: { ftGVW: 32000, ftDrivenWeight: 100, ftHeight: 2.700, ftWidth: 2.600, ftCd: 0.750, ftRho: 1.225, ftGrade: 0 } },
    { id: 'sv1', type: 'solver', data: { maxSimTime: 300, ftDt: 0.002, method: 'rk4' } }
  ]);
  global.connections = [];
  global.veGetPowertrainChain = () => chain;
}

// shiftHistory'de bir geçişin İLK oluşumu (avlanma tekrarları elenir).
function firstShifts(R) {
  const out = {};
  (R.solverStats.shiftHistory || []).forEach(s => {
    const k = s.fromMode + s.toMode;
    if(!(k in out)) out[k] = s;
  });
  return out;
}

describe('allison4500sp_s1 — eşik katsayıları iSCAAN raporuna oturuyor', () => {
  const P = VE_FT_SHIFT_PROFILES.allison4500sp_s1;

  test('2C→2L artık segmentli DEĞİL, düz lineer (hatalı blok geri gelmemiş)', () => {
    const cs = P.converterShifts['2C2L'];
    expect(cs.type).toBeUndefined();          // 'segmented' geri gelirse kırmızı
    expect(cs.lookup).toBeUndefined();
    expect(typeof cs.a).toBe('number');
  });

  test('2C→2L eşiği ESL=1900\'de 575 rpm (263 DEĞİL)', () => {
    const cs = P.converterShifts['2C2L'];
    const thr = cs.a * ESL + (cs.b || 0);
    expect(thr).toBeGreaterThan(ISCAAN_SHIFT_NOUT['2C2L'] - 3);
    expect(thr).toBeLessThan(ISCAAN_SHIFT_NOUT['2C2L'] + 3);
  });

  test('2C→2L eşiği 1C→2C eşiğinin ÜSTÜNDE — lockup aynı adımda kapanamaz', () => {
    // Avlanmanın mekanik kaynağı buydu: 263 < 303 olduğu için 2C'ye geçilen adımda
    // lockup koşulu da sağlanıyordu. Bu bekçi ESL'den bağımsız çalışır.
    [1600, 1800, 1900, 2100].forEach(esl => {
      const c1 = P.converterShifts['1C2C'], c2 = P.converterShifts['2C2L'];
      const t1 = c1.a * esl + (c1.b || 0);
      const t2 = c2.a * esl + (c2.b || 0);
      expect(t2).toBeGreaterThan(t1);
    });
  });

  test('türbin oranı S1 bandında (0.670) — diğer S1 profilleriyle aynı fizik', () => {
    // N_türbin = N_out × i₂. S1 stratejisinde bu oran şanzımandan bağımsız:
    // 3200SP 0.670 · 3500SP 0.673 · 4000SP 0.672 · 4700SP 0.673.
    const cs = P.converterShifts['2C2L'];
    const turbineRatio = (cs.a * ESL + (cs.b || 0)) * 2.213 / ESL;
    expect(turbineRatio).toBeGreaterThan(0.660);
    expect(turbineRatio).toBeLessThan(0.680);
  });

  test('lockup geçişleri motoru ESL − 75 civarında değiştiriyor', () => {
    const I = { '2L3L': 2.213, '3L4L': 1.529, '4L5L': 1.000, '5L6L': 0.765 };
    Object.keys(I).forEach(k => {
      const ls = P.lockupShifts[k];
      const nEngine = (ls.a * ESL + (ls.b || 0)) * I[k];
      expect(nEngine).toBeGreaterThan(ESL - 85);
      expect(nEngine).toBeLessThan(ESL - 65);
    });
  });
});

// ── Profil eşik yardımcıları (ft-performance.js'teki mantığın aynısı) ──────
function converterThreshold(P, key, esl) {
  // Çözücü eşikleri shiftRefRPM ile çarpıyor (ft-performance.js:850, 863) — profil
  // kendi referansını bildiriyorsa ESL değil O kullanılır. Bunu taklit etmezsek
  // shiftRefRPM'i motor governed'ından FARKLI olan profiller yanlış ölçülür.
  esl = P.shiftRefRPM || esl;
  const cs = P.converterShifts && P.converterShifts[key];
  if(cs) {
    if(cs.type === 'segmented') {
      if(esl >= cs.linear.validFrom) return cs.linear.a * esl + cs.linear.b;
      const lk = cs.lookup;
      if(esl <= lk[0][0]) return lk[0][1];
      if(esl >= lk[lk.length - 1][0]) return lk[lk.length - 1][1];
      for(let i = 0; i < lk.length - 1; i++) {
        if(esl >= lk[i][0] && esl <= lk[i + 1][0]) {
          const f = (esl - lk[i][0]) / (lk[i + 1][0] - lk[i][0]);
          return lk[i][1] + f * (lk[i + 1][1] - lk[i][1]);
        }
      }
    }
    return cs.a * esl + (cs.b || 0);
  }
  const ratio = (key === '1C2C') ? P.shift1C2C_outRatio : P.shift2C2L_outRatio;
  return (ratio == null) ? null : ratio * esl;
}

// Profilin bağlı olduğu şanzımanın 2. vites oranı. 4700/4800/4900'de ilk satır
// creeper (C) ve shift profilinin dışında → bir kaydır.
function secondGearRatio(profileKey) {
  const gbKey = veGetGearboxKeyFromShiftProfile(profileKey);
  const gp = VE_GEARBOX_PRESETS[gbKey];
  if(!gp) return null;
  const fw = gp.gears.filter(g => g.gear !== 'R');
  const off = (fw.length >= 7 && fw[0].ratio > 6) ? 1 : 0;
  return fw[off + 1] ? fw[off + 1].ratio : null;
}

describe('YAPISAL KAPI — bütün shift profillerinde 2C→2L eşiği', () => {
  // Bu iki kapı, 4500SP hatasını üç sabit sayıya bakmadan yakalar; aynı sınıf
  // hata başka bir profile girerse de kırmızıya döner.
  const KEYS = Object.keys(VE_FT_SHIFT_PROFILES);
  const ESLS = [1600, 1800, 1900, 2100, 2500];

  test('kayıt defteri boş değil (eval/yükleme sessizce bozulmasın)', () => {
    expect(KEYS.length).toBeGreaterThan(15);
  });

  test('her profilde 2C→2L eşiği 1C→2C eşiğinin ÜSTÜNDE', () => {
    // Altında kalırsa lockup, 2C'ye geçilen adımda kapanır → avlanma.
    const ihlal = [];
    KEYS.forEach(k => {
      const P = VE_FT_SHIFT_PROFILES[k];
      ESLS.forEach(esl => {
        const t1 = converterThreshold(P, '1C2C', esl);
        const t2 = converterThreshold(P, '2C2L', esl);
        if(t1 == null || t2 == null) return;
        if(t2 <= t1) ihlal.push(`${k} @ESL=${esl}: 2C2L ${t2.toFixed(1)} ≤ 1C2C ${t1.toFixed(1)}`);
      });
    });
    expect(ihlal).toEqual([]);
  });

  // 2C2L yuvasının NEYİ kodladığı profile göre değişir. Altı vitesli Allison
  // profillerinde gerçekten 2. viteste converter→lockup geçişidir. 9 vitesli
  // 2957 SP DynActive'de ise raporun 1L→2L geçişi bu yuvaya oturtuldu (durum
  // makinesi 1C/2C/2L etiketlerini konuma göre eşliyor), yani araç eşiğe
  // gelirken hâlâ 1. VİTESTE. İkisini aynı çarpanla ölçmek yanlış olur.
  const SLOT_IS_FIRST_GEAR = ['allison2957sp_dyn0'];

  test('Allison profillerinde 2C→2L türbin oranı 0.60–0.70 bandında', () => {
    // N_türbin/N_ref = (eşik × i₂) / N_ref. Strateji sabiti; ölçülen aralık
    // 0.619 (S4) – 0.683 (2500SP). Eski hatalı 4500SP değeri 0.306 idi.
    // gm8l90_perf hariç: TK'siz profil, oranı tasarımı gereği 1.0.
    const disari = [];
    KEYS.filter(k => k.startsWith('allison') && SLOT_IS_FIRST_GEAR.indexOf(k) < 0).forEach(k => {
      const P = VE_FT_SHIFT_PROFILES[k];
      const i2 = secondGearRatio(k);
      if(i2 == null) return;
      const ref = P.shiftRefRPM || ESL;
      const r = converterThreshold(P, '2C2L', ESL) * i2 / ref;
      if(r < 0.60 || r > 0.70) disari.push(`${k}: ${r.toFixed(3)}`);
    });
    expect(disari).toEqual([]);
  });

  test('2957 SP: 2C→2L yuvası 1. viteste kilitlenmeyi kodluyor (N_türbin = N_ref)', () => {
    // Bu profilde bant kuralı geçerli değil, ama yerine DAHA SIKI bir çıpa var:
    // rapor (iSCAAN 497-A336126-1) bütün lockup geçişlerini N_motor = 2400'de
    // gösteriyor, yani eşik × i₁ tam olarak shiftRefRPM'e oturmalı.
    const P = VE_FT_SHIFT_PROFILES['allison2957sp_dyn0'];
    const i1 = VE_GEARBOX_PRESETS[veGetGearboxKeyFromShiftProfile('allison2957sp_dyn0')]
                 .gears.filter(g => g.gear !== 'R')[0].ratio;
    const nTurb = converterThreshold(P, '2C2L', ESL) * i1;
    expect(nTurb).toBeGreaterThan(P.shiftRefRPM - 15);
    expect(nTurb).toBeLessThan(P.shiftRefRPM + 15);
    // İkinci vitesle ölçseydik 0.729 çıkıyordu — bant kapısının neden atlandığının kanıtı.
    expect(converterThreshold(P, '2C2L', ESL) * secondGearRatio('allison2957sp_dyn0') / P.shiftRefRPM)
      .toBeGreaterThan(0.70);
  });
});

describe('allison4500sp S1–S4 — strateji ilerlemesi', () => {
  // S1 ölçüldü (iSCAAN 497-A355435-1). S2/S3/S4 TÜRETİLDİ: 2C→2L türbin oranı
  // stratejiye bağlı, şanzımandan bağımsız bir sabit (3200SP/3500SP/4700SP'de
  // yayılım ±1.5e-3). Yöntem doğrulaması: aynı benzeşim S1 için 0.3035 öngörüyor,
  // ölçülen 0.3027 → %0.3 hata.
  const BEKLENEN = { s1: 0.3027, s2: 0.2975, s3: 0.2927, s4: 0.2810 };

  test('katsayılar türetilen/ölçülen değerlerde', () => {
    Object.keys(BEKLENEN).forEach(s => {
      const cs = VE_FT_SHIFT_PROFILES['allison4500sp_' + s].converterShifts['2C2L'];
      expect(cs.type).toBeUndefined();          // segmentli blok geri gelmemiş
      expect(cs.a).toBeCloseTo(BEKLENEN[s], 4);
    });
  });

  test('yedek alan (shift2C2L_outRatio) converterShifts ile tutarlı', () => {
    // null kalırsa converterShifts devre dışı bırakıldığında 0.3594 fallback'ine
    // düşer — 4500SP için yanlış şanzımanın değeri.
    Object.keys(BEKLENEN).forEach(s => {
      const P = VE_FT_SHIFT_PROFILES['allison4500sp_' + s];
      expect(P.shift2C2L_outRatio).not.toBeNull();
      expect(P.shift2C2L_outRatio).toBeCloseTo(P.converterShifts['2C2L'].a, 4);
    });
  });

  test('eşik S1 > S2 > S3 > S4 (ekonomi stratejisi daha erken kilitler)', () => {
    const v = ['s1', 's2', 's3', 's4'].map(s =>
      VE_FT_SHIFT_PROFILES['allison4500sp_' + s].converterShifts['2C2L'].a);
    for(let i = 1; i < v.length; i++) expect(v[i]).toBeLessThan(v[i - 1]);
  });
});

describe('BMC 10TON 6×6 — gerçek koşuda geçiş noktaları ve avlanma', () => {
  let High, Low;
  beforeAll(() => {
    buildBMC10Ton();
    High = veFTRunSimulationEngine('High');
    Low = veFTRunSimulationEngine('Low');
  }, 120000);

  test('altı geçişin hepsi iSCAAN noktasında (±8 rpm)', () => {
    const f = firstShifts(High);
    Object.keys(ISCAAN_SHIFT_NOUT).forEach(k => {
      expect(f[k]).toBeDefined();
      expect(Math.abs(f[k].N_out - ISCAAN_SHIFT_NOUT[k])).toBeLessThan(8);
    });
  });

  test('avlanma yok — eski kodda High 321 / Low 114 geçiş vardı', () => {
    // 6 ileri kademe → sağlıklı tam gaz koşumunda tam 6 geçiş (1C→2C→2L→3L→4L→5L→6L).
    expect(High.solverStats.shiftHistory.length).toBeLessThan(12);
    expect(Low.solverStats.shiftHistory.length).toBeLessThan(12);
  });

  test('hiç aşağı vites yok — eski kodda High 105 / Low 36 vardı', () => {
    [High, Low].forEach(R => {
      const down = R.solverStats.shiftHistory.filter(s => s.isDownshift);
      expect(down.length).toBe(0);
    });
  });

  test('vites dizisi kalkıştan 6L\'ye kesintisiz ilerliyor', () => {
    const seq = High.solverStats.shiftHistory.map(s => s.toMode);
    expect(seq).toEqual(['2C', '2L', '3L', '4L', '5L', '6L']);
  });

  test('fizik korundu — stall devri ve eğim iSCAAN bandında', () => {
    // iSCAAN: konvertör stall 1526 rpm, stall gradeability High 49.8 / Low 127.2.
    expect(High.settledStall.N_engine).toBeGreaterThan(1490);
    expect(High.settledStall.N_engine).toBeLessThan(1570);

    global.window = global.window || {};
    global.window._veFTAllRangeResults = { High, Low };
    global.window._veFTTransferGears = [
      { kademe: 'High', ratio: 0.874, eff: 97 }, { kademe: 'Low', ratio: 1.536, eff: 97 }
    ];
    const G = veCalculateGradeability(High);
    expect(G.high.stallGrade).toBeGreaterThan(46);
    expect(G.high.stallGrade).toBeLessThan(53);
    expect(G.low.stallGrade).toBeGreaterThan(118);
    expect(G.low.stallGrade).toBeLessThan(132);
  });

  test('sonuç tamamen sonlu', () => {
    [High, Low].forEach(R => {
      expect(R.speed.every(Number.isFinite)).toBe(true);
      expect(R.rpm.every(Number.isFinite)).toBe(true);
    });
  });
});

describe('S2/S3/S4 profilleri — aynı topolojide avlanma yok', () => {
  // S1'deki hatalı blok bu üçünde de vardı (birebir aynı katsayılar).
  // Eşikler türetilmiş olduğu için iSCAAN noktası iddia EDİLMİYOR; iddia edilen
  // tek şey davranış: lockup 2C'ye geçilen adımda kapanmıyor, avlanma yok.
  const PROFILLER = ['allison4500sp_s2', 'allison4500sp_s3', 'allison4500sp_s4'];
  const sonuc = {};

  beforeAll(() => {
    PROFILLER.forEach(p => { buildBMC10Ton(p); sonuc[p] = veFTRunSimulationEngine('High'); });
  }, 120000);

  test.each(PROFILLER)('%s — geçiş sayısı makul, aşağı vites yok', p => {
    const sh = sonuc[p].solverStats.shiftHistory;
    expect(sh.length).toBeGreaterThan(0);
    expect(sh.length).toBeLessThan(12);
    expect(sh.filter(s => s.isDownshift).length).toBe(0);
  });

  test.each(PROFILLER)('%s — dizi 2C→2L→3L→4L→5L→6L', p => {
    expect(sonuc[p].solverStats.shiftHistory.map(s => s.toMode))
      .toEqual(['2C', '2L', '3L', '4L', '5L', '6L']);
  });

  test.each(PROFILLER)('%s — 2C→2L geçişi 1C→2C\'den SONRA gerçekleşiyor', p => {
    const sh = sonuc[p].solverStats.shiftHistory;
    const i1 = sh.findIndex(s => s.toMode === '2C');
    const i2 = sh.findIndex(s => s.toMode === '2L');
    expect(i1).toBeGreaterThanOrEqual(0);
    expect(i2).toBeGreaterThan(i1);
    // Aynı ADIMDA olmamalı: araç hızı gözle görülür şekilde artmış olmalı.
    expect(sh[i2].v_kmh - sh[i1].v_kmh).toBeGreaterThan(3);
  });

  test.each(PROFILLER)('%s — sonuç sonlu', p => {
    expect(sonuc[p].speed.every(Number.isFinite)).toBe(true);
    expect(sonuc[p].rpm.every(Number.isFinite)).toBe(true);
  });
});
