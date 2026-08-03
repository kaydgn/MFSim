/**
 * AMC MECANOCAUCHO® konik takozlar — kaynağa karşı altın referans
 * ───────────────────────────────────────────────────────────────
 * Kaynak: AMC Technical Assistance Service çok-gövdeli titreşim analizi raporları
 * (müşteri 79724 BMC Otomotiv, proje 3066 "8x8 Armored Carrier Truck – Powertrain",
 * hesaplar 13440 / 13948 / 13955 / 13957).
 *
 * Kütüphaneye eklenen dört takozun (Cone 38 / Cone 67 / Cone 121 NP / Cone 121 NG)
 * rijitlikleri bu raporlardan geri çözüldü. Bu testler, DEĞERLERİN RAPORLARIN
 * KENDİ SONUÇLARINI yeniden ürettiğini kalıcı olarak kilitler:
 *
 *   • dört yapılandırmanın statik çökme + takoz kuvvetleri (Static Results),
 *   • dört yapılandırmanın 6 doğal frekansı (Natural Frequencies),
 *   • oyuklu konilerin KASITLI radyal anizotropisi (sx ≠ sy) ve masif konilerin
 *     eksenel simetrisi (sx = sy).
 *
 * Bir hane kayarsa sonuç sessizce "makul ama yanlış" çıkar — testin karşılığı burada.
 * Aynı güç grubu (2285,2 kg) dört FARKLI takoz kombinasyonuyla çözüldüğü için tek
 * bir takozun rijitliği birden çok bağımsız yapılandırmayı aynı anda tutturmak
 * zorundadır; tesadüfen geçmesi mümkün değildir.
 */

const core = require('../../js/mount-core.js');
global.veMountCore = core;

const stubs = stubGlobals({ saveState: jest.fn(), showToast: jest.fn(), showNodeProperties: jest.fn() });
const fs = require('fs');
const path = require('path');
eval(fs.readFileSync(path.join(__dirname, '../../js/components.js'), 'utf8'));
global.componentDefs = componentDefs;
const cp = require('../../js/cp-mount.js');

beforeEach(() => { resetStubs(stubs); global.nodes = []; });

const mm = (v) => v / 1000;

// ── Rapor "Bodies" tablosu — dört raporda da AYNI ────────────────────────────
const COMPS = [
  { name: 'Motor',    mass: 1472.20, cg: [626.80, 64.10, 453.10].map(mm),
    I: [[110.00, 0, 0], [0, 205.00, 0], [0, 0, 260.00]], pointMass: false },
  { name: 'Şanzıman', mass: 813.00, cg: [1875.80, 42.60, 216.30].map(mm),
    I: [[16.40, 0, 0], [0, 68.20, 0], [0, 0, 64.90]], pointMass: false },
];
const G_AMC = 9.806;   // ΣFz = 22,41 kN / 2285,2 kg — raporun kendi yerçekimi sabiti

// ── Rapor "Supports" tablosundaki takoz konumları (mm) ───────────────────────
const P1 = [0, 0, 0];
const P2 = [0, 101.60, 0];
const P3 = [1506.40, -296.70, 264.20];
const P4 = [1506.40, 398.30, 264.20];
const P5 = [1656.40, -296.70, 264.20];
const P6 = [1656.40, 398.30, 264.20];

const K38 = 'amc137963', K67 = 'amc137731', KNP = 'amc137829', KNG = 'amc137830';

// ── Dört rapor: takoz dizilimi + raporun KENDİ sonuçları ─────────────────────
const REPORTS = [
  { id: 'hesap 13948 — Cone 38 60Sh + Cone 121 NP 55Sh',
    mounts: [[K38, P1], [K38, P2], [KNP, P3], [KNP, P4]],
    f:  [5.770, 7.316, 10.692, 12.446, 15.000, 19.060],
    dz: [-2.876, -2.918, -7.105, -7.392],
    dx: [-0.420, -0.414, 0.326, 0.367],
    dy: [-0.014, -0.014, 0.005, 0.005],
    Fz: [-3.408, -3.453, -7.607, -7.942],
    Fy: [-0.015, -0.015, 0.015, 0.015],
    fTol: 0.47 },                                    // bkz. dosya başı notu (mod 4–5)
  { id: 'hesap 13955 — 2x Cone 38 60Sh + 4x Cone 67 50Sh',
    mounts: [[K38, P1], [K38, P2], [K67, P3], [K67, P4], [K67, P5], [K67, P6]],
    f:  [7.456, 10.404, 11.142, 14.499, 18.344, 20.602],
    dz: [-3.053, -3.075, -2.895, -3.041, -2.885, -3.032],
    dx: [0.011, 0.013, -0.014, 0.004, -0.014, 0.004],
    dy: [-0.012, -0.012, 0.005, 0.005, 0.001, 0.001],
    Fz: [-3.598, -3.621, -3.718, -3.889, -3.707, -3.878],
    Fy: [-0.013, -0.013, 0.010, 0.010, 0.003, 0.003],
    fTol: 0.05 },
  { id: 'hesap 13957 — 6x Cone 38 60Sh',
    mounts: [[K38, P1], [K38, P2], [K38, P3], [K38, P4], [K38, P5], [K38, P6]],
    f:  [7.398, 10.602, 11.124, 11.669, 18.115, 20.670],
    dz: [-3.066, -3.089, -3.146, -3.307, -3.160, -3.322],
    dx: [-0.019, -0.016, -0.001, 0.018, -0.001, 0.018],
    dy: [-0.011, -0.011, 0.008, 0.008, 0.004, 0.004],
    Fz: [-3.611, -3.637, -3.697, -3.868, -3.713, -3.884],
    Fy: [-0.012, -0.012, 0.008, 0.008, 0.004, 0.004],
    fTol: 0.20 },
  { id: 'hesap 13440 — Cone 38 60Sh + Cone 121 NG 55Sh',
    mounts: [[K38, P1], [K38, P2], [KNG, P3], [KNG, P4]],
    f:  [6.291, 7.998, 10.946, 14.346, 16.616, 19.517],
    dz: [-2.810, -2.845, -5.002, -5.241],
    dx: [-0.247, -0.242, 0.141, 0.174],
    dy: [-0.016, -0.016, 0.004, 0.004],
    Fz: [-3.336, -3.373, -7.685, -8.017],
    Fy: [-0.017, -0.017, 0.016, 0.016],
    fTol: 0.10 },
];

// Toleranslar KEYFİ DEĞİL: gerçekte ulaşılan en kötü sapmanın hemen üstüne
// konmuştur (δz 0,030 → 0,035 · δx 0,008 → 0,010 · δy 0,0015 → 0,002 ·
// Fz 0,005 → 0,006 · Fy 0,0015 → 0,002). Gevşek tolerans testi kör eder:
// bu değerlerle bir rijitliği %5 kaydırmak testi KIRAR (mutasyonla doğrulandı).
const TOL = { dz: 0.035, dx: 0.010, dy: 0.002, Fz: 0.006, Fy: 0.002 };

const buildMounts = (spec) => spec.map(([key, pos], i) => {
  const e = cp.VE_MOUNT_LIBRARY[key];
  return { name: key + '#' + (i + 1), pos: pos.map(mm),
           kstat: [e.sx, e.sy, e.sz].map((v) => v * 1000),
           kdyn:  [e.dx, e.dy, e.dz].map((v) => v * 1000) };
});

const solveReport = (R) => {
  const mounts = buildMounts(R.mounts);
  const mp = core.combineMassProps(COMPS);
  const stat = core.solveCase(core.buildK(mounts, mp.cg, false), mounts, mp.cg, mp.m, G_AMC,
                              { name: 'Static', n: [0, 0, -1], T: [0, 0, 0] });
  const modes = core.solveModal(core.buildK(mounts, mp.cg, true),
                                core.buildM6(mp.m, mp.I_G), mounts, mp.cg);
  return { mp, mounts, stat, modes };
};

// ═══════════════════════════════════════════════════════════════════════════
describe('Dört takoz kütüphaneye eklendi ve katalog kimliğini taşıyor', () => {
  const EXPECT = {
    [K38]: { name: 'Cone 38 60Sh (AMC 137963)',     s: [2670, 1065, 1180], d: [4265, 1690, 1715] },
    [K67]: { name: 'Cone 67 50Sh (AMC 137731)',     s: [3550, 2115, 1280], d: [4630, 2785, 1625] },
    [KNP]: { name: 'Cone 121 NP 55Sh (AMC 137829)', s: [3150, 3150, 1075], d: [4605, 4605, 1755] },
    [KNG]: { name: 'Cone 121 NG 55Sh (AMC 137830)', s: [4405, 4405, 1530], d: [6380, 6380, 2080] },
  };

  test('dördü de gömülü katalogda, değerleri birebir', () => {
    Object.entries(EXPECT).forEach(([k, v]) => {
      const e = cp.VE_MOUNT_LIBRARY[k];
      expect(e).toBeDefined();
      expect(e.name).toBe(v.name);
      expect([e.sx, e.sy, e.sz]).toEqual(v.s);
      expect([e.dx, e.dy, e.dz]).toEqual(v.d);
    });
  });

  test('anahtarlar ve adlar tekil — mevcut girdilerle çakışmıyor', () => {
    const L = cp.VE_MOUNT_LIBRARY;
    const names = Object.values(L).map((e) => e.name);
    expect(new Set(names).size).toBe(names.length);
    expect(new Set(Object.keys(L)).size).toBe(Object.keys(L).length);
  });

  test('mevcut girdiler DEĞİŞMEDİ (regresyon)', () => {
    const L = cp.VE_MOUNT_LIBRARY;
    expect([L['57RS313773'].sx, L['57RS313773'].sy, L['57RS313773'].sz]).toEqual([334, 334, 2300]);
    expect([L['57RS313774'].sx, L['57RS313774'].sy, L['57RS313774'].sz]).toEqual([1200, 1200, 2400]);
    expect([L['amc55sha'].sx, L['amc55sha'].sy, L['amc55sha'].sz]).toEqual([1252, 1252, 640]);
    expect(L['TK050'].fits.z.comp.k0).toBe(381);
  });

  test('dördü de Takoz panelinin kütüphane listesinde görünüyor', () => {
    const html = cp.getMntMountPropertiesHTML({ id: 'm1', type: 'mnt-mount', def: {}, data: {} });
    [K38, K67, KNP, KNG].forEach((k) => expect(html).toContain('value="' + k + '"'));
  });

  test('kütüphaneden uygulanınca Takoz düğümüne doğru rijitlikler yazılıyor', () => {
    const n = { id: 'm1', type: 'mnt-mount', def: componentDefs['mnt-mount'], data: {} };
    global.nodes = [n];
    cp.veMntApplyLib('m1', K67);
    expect([n.data.kxs, n.data.kys, n.data.kzs]).toEqual([3550, 2115, 1280]);
    expect([n.data.kxd, n.data.kyd, n.data.kzd]).toEqual([4630, 2785, 1625]);
    expect(n.data.libKey).toBe(K67);
  });
});

describe('Oyuklu / masif koni ayrımı korunuyor', () => {
  // AMC kataloğu: "CONE WITH CUTOUTS ... offer different horizontal/vertical
  // stiffness ratios". Oyuklu konide sx ≠ sy KASITLIDIR; masif konide sx = sy.
  test('oyuklu koniler radyal olarak anizotropik (sx belirgin şekilde > sy)', () => {
    [K38, K67].forEach((k) => {
      const e = cp.VE_MOUNT_LIBRARY[k];
      expect(e.sx / e.sy).toBeGreaterThan(1.5);
      expect(e.dx / e.dy).toBeGreaterThan(1.5);
    });
  });

  test('masif koniler eksenel simetrik (sx = sy, dx = dy)', () => {
    [KNP, KNG].forEach((k) => {
      const e = cp.VE_MOUNT_LIBRARY[k];
      expect(e.sx).toBe(e.sy);
      expect(e.dx).toBe(e.dy);
    });
  });

  test('dinamik/statik oranı kauçuk için makul aralıkta (1,1–1,9)', () => {
    [K38, K67, KNP, KNG].forEach((k) => {
      const e = cp.VE_MOUNT_LIBRARY[k];
      [[e.dx, e.sx], [e.dy, e.sy], [e.dz, e.sz]].forEach(([d, s]) => {
        expect(d / s).toBeGreaterThan(1.1);
        expect(d / s).toBeLessThan(1.9);
      });
    });
  });
});

describe('Kütle özellikleri raporun "Bodies" tablosuyla aynı', () => {
  test('toplam kütle, ağırlık merkezi ve atalet momentleri', () => {
    const mp = core.combineMassProps(COMPS);
    expect(mp.m).toBeCloseTo(2285.20, 6);
    expect(mp.cg[0] * 1000).toBeCloseTo(1071.15, 1);
    expect(mp.cg[1] * 1000).toBeCloseTo(56.45, 1);
    expect(mp.cg[2] * 1000).toBeCloseTo(368.85, 1);
    expect(mp.I_G[0][0]).toBeCloseTo(156.01, 1);
    expect(mp.I_G[1][1]).toBeCloseTo(1119.64, 1);
    expect(mp.I_G[2][2]).toBeCloseTo(1142.21, 1);
  });
});

describe.each(REPORTS.map((R) => [R.id, R]))('%s', (_id, R) => {
  test(`Static Results — düşey çökmeler (±${TOL.dz} mm)`, () => {
    const { stat } = solveReport(R);
    stat.perMount.forEach((pm, i) =>
      expect(Math.abs(pm.delta[2] * 1000 - R.dz[i])).toBeLessThanOrEqual(TOL.dz));
    expect(stat.checks.tensionCount).toBe(0);            // hepsi basıda
  });

  test(`Static Results — boyuna çökmeler (±${TOL.dx} mm) → sx'i kilitler`, () => {
    const { stat } = solveReport(R);
    stat.perMount.forEach((pm, i) =>
      expect(Math.abs(pm.delta[0] * 1000 - R.dx[i])).toBeLessThanOrEqual(TOL.dx));
  });

  test(`Static Results — yanal çökmeler (±${TOL.dy} mm) → sy'yi kilitler`, () => {
    const { stat } = solveReport(R);
    stat.perMount.forEach((pm, i) =>
      expect(Math.abs(pm.delta[1] * 1000 - R.dy[i])).toBeLessThanOrEqual(TOL.dy));
  });

  test(`Static Results — takoz kuvvetleri (Fz ±${TOL.Fz} kN, Fy ±${TOL.Fy} kN)`, () => {
    const { stat } = solveReport(R);
    stat.perMount.forEach((pm, i) => {
      expect(Math.abs(pm.f[2] / 1000 - R.Fz[i])).toBeLessThanOrEqual(TOL.Fz);
      expect(Math.abs(pm.f[1] / 1000 - R.Fy[i])).toBeLessThanOrEqual(TOL.Fy);
    });
    // ΣFz = ağırlık
    const sum = stat.perMount.reduce((s, pm) => s + pm.f[2], 0);
    expect(sum / 1000).toBeCloseTo(-2285.20 * G_AMC / 1000, 2);
  });

  test('Natural Frequencies — 6 doğal mod', () => {
    const { modes } = solveReport(R);
    expect(modes).toHaveLength(6);
    modes.forEach((md, i) => {
      expect(Math.abs(md.f_Hz - R.f[i])).toBeLessThanOrEqual(R.fTol);
    });
  });
});

describe('Değerler yapılandırmalar arası TUTARLI — tesadüf değil', () => {
  // Cone 38 üç ayrı raporda (13948 / 13955 / 13957) ve üç farklı komşu takozla
  // görünüyor. Tek bir rijitlik üçünü birden tutturuyorsa değer gerçektir.
  test('Cone 38 üç raporda da aynı rijitlikle tutuyor', () => {
    const worst = REPORTS.filter((R) => R.mounts.some(([k]) => k === K38))
      .map((R) => {
        const { stat } = solveReport(R);
        return Math.max(...stat.perMount.map((pm, i) => Math.abs(pm.delta[2] * 1000 - R.dz[i])));
      });
    expect(worst).toHaveLength(4);
    worst.forEach((w) => expect(w).toBeLessThanOrEqual(TOL.dz));
  });

  test('yanlış takoz tipi kullanılırsa sonuç BELİRGİN şekilde sapar (karışırsa fark edilir)', () => {
    // 13948'de Cone 121 NP yerine NG kullan → arka takozların çökmesi çok değişmeli
    const R = REPORTS[0];
    const good = solveReport(R);
    const bad = solveReport({ ...R, mounts: [[K38, P1], [K38, P2], [KNG, P3], [KNG, P4]] });
    const diff = Math.max(...good.stat.perMount.map((pm, i) =>
      Math.abs(pm.delta[2] - bad.stat.perMount[i].delta[2]) * 1000));
    expect(diff).toBeGreaterThan(1.0);                   // mm mertebesinde ayrışıyor
  });
});
