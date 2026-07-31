/**
 * Tam frekans yanıtı — çok serbestlikli kuvvet iletilebilirliği
 * ─────────────────────────────────────────────────────────────
 *   [K − ω²M + iωC]·Q = F₀ ,  fᵢ = (kᵢ + iω cᵢ)·Aᵢ·Q ,  T = |Σ fᵢ,z| / |F₀,z|
 *
 * Karmaşık 6×6 sistem 12×12 gerçel sisteme açılarak çözülür. Buradaki testler
 * hem O AÇILIMIN doğruluğunu (analitik SDOF ile birebir), hem fiziksel limitleri
 * (T→1 statik, rezonanslar modlarda, yalnız düşey modlar uyarılır), hem de
 * ASR-SR-116 Şekil 9 / s.12 değerlerini kilitler.
 *
 * Bu bölüm §8.8'in SDOF kestirimini DOĞRULAR: ikisi izolasyon bölgesinde
 * örtüşmezse kestirim geçersizdir ve rapor yanlış hüküm verir.
 */

const core = require('../../js/mount-core.js');
const mm = (v) => v / 1000, kN = (v) => v * 1000;

// ── ASFAT 8x8 Obüs modeli (ASR-SR-116) ───────────────────────────────────────
const COMPS = [
  { name: 'Motor', mass: 1600, cg: [-314.94, -0.127, 857.56].map(mm),
    I: [[110.7, 0, 0], [0, 260.2, 0], [0, 0, 205.9]], pointMass: false },
  { name: 'Şanzıman', mass: 839, cg: [932.365, -13.003, 700.632].map(mm),
    I: [[44.6, 0, 0], [0, 97.8, 0], [0, 0, 94.6]], pointMass: false },
  { name: 'Şaft', mass: 16, cg: [2300, 150, 0].map(mm),
    I: [[0.042, 0, 0], [0, 1.16, 0], [0, 0, 1.16]], pointMass: false },
];
const ON = { s: [1045, 1045, 1800], d: [1045, 1045, 1800] };
const AR = { s: [462, 462, 2200], d: [630, 630, 3000] };
const MOUNTS = [['Ön Sol', -953.45, -50.67, 367, ON], ['Ön Sağ', -953.45, 50.67, 367, ON],
  ['Sol Ön', 535.31, -347.1, 615.77, AR], ['Sağ Ön', 535.31, 347.1, 615.77, AR],
  ['Sol Arka', 636.8, -347.1, 615.77, AR], ['Sağ Arka', 636.8, 347.1, 615.77, AR]]
  .map((h) => ({ name: h[0], pos: [h[1], h[2], h[3]].map(mm),
                 kstat: h[4].s.map(kN), kdyn: h[4].d.map(kN) }));

const MP = core.combineMassProps(COMPS);
const M6 = core.buildM6(MP.m, MP.I_G);
const STAT = core.solveCase(core.buildK(MOUNTS, MP.cg, false), MOUNTS, MP.cg, MP.m, 9.81,
                            { name: 'Static', n: [0, 0, -1], T: [0, 0, 0] });
const DAMP = core.mountDamping(MOUNTS, core.mountLoadShares(STAT, 9.81), 0.02);
const F_FIRE = 30;

describe('Sönüm matrisi', () => {
  test('C rijitlikle aynı kinematikten kurulur (simetrik, poz. yarı-tanımlı)', () => {
    const C6 = core.buildCdamp(MOUNTS, MP.cg, DAMP);
    for (let i = 0; i < 6; i++) for (let j = 0; j < 6; j++) {
      expect(C6[i][j]).toBeCloseTo(C6[j][i], 9);          // simetri
    }
    for (let i = 0; i < 6; i++) expect(C6[i][i]).toBeGreaterThan(0);
  });

  test('sönüm yoksa C sıfır matrisi', () => {
    const C6 = core.buildCdamp(MOUNTS, MP.cg, null);
    C6.forEach((row) => row.forEach((v) => expect(v).toBe(0)));
  });

  test('c ölçeklenince C aynı oranda ölçeklenir (lineerlik)', () => {
    const d2 = DAMP.map((e) => ({ c: e.c.map((v) => v * 3) }));
    const a = core.buildCdamp(MOUNTS, MP.cg, DAMP);
    const b = core.buildCdamp(MOUNTS, MP.cg, d2);
    expect(b[2][2]).toBeCloseTo(3 * a[2][2], 6);
  });
});

describe('Karmaşık çözümün doğruluğu — analitik SDOF ile birebir', () => {
  // TEK takoz, kütle ağırlık merkezinde, tek eksen → sistem tam olarak SDOF'tur.
  // Sayısal 12×12 açılım, kapalı-form T(r) ile ondalık basamağına kadar tutmalı.
  const m = 500, k = 2e6, z = 0.05;
  const c = 2 * z * Math.sqrt(k * m);
  const one = [{ name: 's', pos: [0, 0, 0], kstat: [k, k, k], kdyn: [k, k, k] }];
  const M1 = core.buildM6(m, [[1, 0, 0], [0, 1, 0], [0, 0, 1]]);
  const fn = Math.sqrt(k / m) / (2 * Math.PI);

  test.each([0.3, 0.9, 1.0, 1.5, 2.5, 5])('r = %p noktasında analitik ile aynı', (r) => {
    const f = r * fn;
    const T = core.frfAt(one, [0, 0, 0], M1, [{ c: [c, c, c] }], f, 2);
    expect(T).toBeCloseTo(core.transmissibility(f, fn, z), 6);
  });

  test('sönümsüz TAM rezonansta sistem tekildir → NaN (sahte sayı üretilmez)', () => {
    // K − ω²M tam sıfırlanır; solveLinear null döner. Belgelenmiş davranış.
    expect(Number.isNaN(core.frfAt(one, [0, 0, 0], M1, null, fn, 2))).toBe(true);
  });

  test('sönümsüz rezonansın hemen yanında değer patlar', () => {
    const T = core.frfAt(one, [0, 0, 0], M1, null, fn * 0.9995, 2);
    expect(T).toBeGreaterThan(500);
    expect(Number.isFinite(T)).toBe(true);
  });
});

describe('Fiziksel limitler', () => {
  test('f → 0 iken T → 1 (statik limit: kuvvet tümüyle iletilir)', () => {
    expect(core.frfAt(MOUNTS, MP.cg, M6, DAMP, 0.1, 2)).toBeCloseTo(1, 2);
    expect(core.frfAt(MOUNTS, MP.cg, M6, DAMP, 0.01, 2)).toBeCloseTo(1, 3);
  });

  test('yüksek frekansta T monoton düşer (izolasyon bölgesi)', () => {
    const a = core.frfAt(MOUNTS, MP.cg, M6, DAMP, 30, 2);
    const b = core.frfAt(MOUNTS, MP.cg, M6, DAMP, 60, 2);
    const c2 = core.frfAt(MOUNTS, MP.cg, M6, DAMP, 90, 2);
    expect(b).toBeLessThan(a);
    expect(c2).toBeLessThan(b);
    expect(c2).toBeLessThan(0.1);
  });

  test('rezonans tepeleri DÜŞEY hareketli modlarda; diğer modlar uyarılmaz', () => {
    const modes = core.solveModal(core.buildK(MOUNTS, MP.cg, true), M6, MOUNTS, MP.cg)
                      .map((m2) => m2.f_Hz);
    const sw = core.frequencyResponse(MOUNTS, MP.cg, M6, DAMP, { fMin: 3, fMax: 30, nPts: 2000 });
    const peaks = [];
    for (let i = 1; i < sw.f.length - 1; i++) {
      if (sw.T[i] > sw.T[i - 1] && sw.T[i] > sw.T[i + 1] && sw.T[i] > 1.5) peaks.push(sw.f[i]);
    }
    expect(peaks.length).toBeGreaterThan(0);
    // her tepe bir modun yakınında olmalı (±%2)
    peaks.forEach((pf) => {
      const near = modes.some((mf) => Math.abs(pf - mf) / mf < 0.02);
      expect(near).toBe(true);
    });
    // düşey tahrik yalnız bounce/pitch modlarını uyarır — lateral/yaw/roll değil
    peaks.forEach((pf) => { expect(pf).toBeGreaterThan(10); expect(pf).toBeLessThan(15); });
  });

  test('sönüm rezonans tepesini düşürür, izolasyon bölgesini neredeyse etkilemez', () => {
    const fRes = 11.3;
    expect(core.frfAt(MOUNTS, MP.cg, M6, DAMP, fRes, 2))
      .toBeLessThan(core.frfAt(MOUNTS, MP.cg, M6, null, fRes, 2));
    const dz = core.frfAt(MOUNTS, MP.cg, M6, DAMP, 30, 2);
    const uz = core.frfAt(MOUNTS, MP.cg, M6, null, 30, 2);
    expect(Math.abs(dz - uz) / uz).toBeLessThan(0.02);
  });
});

describe('ASR-SR-116 ile karşılaştırma', () => {
  test('f_ateş = 30 Hz → rapor değerleri (%22,0 sönümlü / %21,9 sönümsüz)', () => {
    expect(core.frfAt(MOUNTS, MP.cg, M6, DAMP, F_FIRE, 2) * 100).toBeCloseTo(22.0, 1);
    expect(core.frfAt(MOUNTS, MP.cg, M6, null, F_FIRE, 2) * 100).toBeCloseTo(21.9, 1);
  });

  test('%50 yumuşatma → %9,9 (rapor §5)', () => {
    const soft = MOUNTS.map((m2) => Object.assign({}, m2, { kdyn: m2.kdyn.map((v) => v / 2) }));
    const st = core.solveCase(core.buildK(soft, MP.cg, false), soft, MP.cg, MP.m, 9.81,
                              { name: 'Static', n: [0, 0, -1], T: [0, 0, 0] });
    const d2 = core.mountDamping(soft, core.mountLoadShares(st, 9.81), 0.02);
    expect(core.frfAt(soft, MP.cg, M6, d2, F_FIRE, 2) * 100).toBeCloseTo(9.9, 1);
  });

  test('SDOF kestirimi tam çözüme izolasyon bölgesinde çok yakın (§8.8 geçerli)', () => {
    const tam = core.frfAt(MOUNTS, MP.cg, M6, DAMP, F_FIRE, 2);
    const sdof = core.transmissibility(F_FIRE, core.bounceFrequency(MOUNTS, MP.m), 0.02);
    expect(Math.abs(sdof - tam) / tam).toBeLessThan(0.02);     // %2'den iyi
  });
});

describe('Tarama ve savunma', () => {
  test('frequencyResponse logaritmik ızgara üretir', () => {
    const sw = core.frequencyResponse(MOUNTS, MP.cg, M6, DAMP, { fMin: 0.1, fMax: 100, nPts: 50 });
    expect(sw.f).toHaveLength(50);
    expect(sw.f[0]).toBeCloseTo(0.1, 9);
    expect(sw.f[49]).toBeCloseTo(100, 6);
    const r1 = sw.f[1] / sw.f[0], r2 = sw.f[30] / sw.f[29];
    expect(r2).toBeCloseTo(r1, 9);                              // eşit logaritmik adım
    expect(sw.T.every((v) => Number.isFinite(v) && v > 0)).toBe(true);
  });

  test('takoz yoksa null (çökme yok)', () => {
    expect(core.frequencyResponse([], MP.cg, M6, DAMP, {})).toBeNull();
    expect(core.frequencyResponse(null, MP.cg, M6, DAMP, {})).toBeNull();
  });

  test('geçersiz frekansta NaN', () => {
    expect(Number.isNaN(core.frfAt(MOUNTS, MP.cg, M6, DAMP, 0, 2))).toBe(true);
    expect(Number.isNaN(core.frfAt(MOUNTS, MP.cg, M6, DAMP, -5, 2))).toBe(true);
  });
});

describe('Rapor §8.13', () => {
  const rep = require('../../js/cp-mount-report.js');
  global.veMountCore = core;
  const R = {
    zeta: 0.02, mp: MP, mounts: MOUNTS, damping: DAMP,
    gather: { torque: { idleRpm: 600, cylinders: 6 }, components: [] },
    modes: [{ f_Hz: 11.33, phi: [0, 0, 1, 0, 0, 0], label: 'bounce' }],
  };

  test('bölüm üretiliyor: grafik + karşılaştırma tablosu', () => {
    const h = rep._mntRepFRF(R, {});
    expect(h).toContain('8.13');
    expect(h).toContain('<svg');
    expect(h).toContain('sönümsüz');
    expect(h).toContain('f_ateş');
    // _rF sondaki sıfırı kırpar: 22,0 → "22"
    expect(h).toMatch(/<td>22%<\/td><td>21,9%<\/td>/);     // tam çözüm satırı
    expect(h).toMatch(/<td>21,9%<\/td><td>21,8%<\/td>/);   // SDOF kestirimi satırı
  });

  test('sönüm yoksa bölüm atlanır (uydurma eğri çizilmez)', () => {
    expect(rep._mntRepFRF(Object.assign({}, R, { damping: null }), {})).toBe('');
    expect(rep._mntRepFRF(Object.assign({}, R, { mounts: [] }), {})).toBe('');
  });

  test('grafik log-log eksenleri ve T=1 referansını çiziyor', () => {
    const svg = rep._mntRepFRFChart(
      core.frequencyResponse(MOUNTS, MP.cg, M6, DAMP, { fMin: 0.1, fMax: 100, nPts: 40 }), 30);
    expect(svg).toContain('İletilebilirlik T');
    expect(svg).toContain('Frekans [Hz]');
    expect(svg).toContain('izolasyon yok');
    expect(svg.match(/<path /g).length).toBe(2);   // sönümlü + sönümsüz
  });
});
