/**
 * mount-core.test.js — Takoz Çökme-Titreşim hesap çekirdeği (6 SD rijit gövde)
 *
 * SPEC Bölüm 6 kabul testleri (T1–T8), Adams BMC_TTAR_2031 doğrulama
 * referansıyla birebir. Çekirdek saf fonksiyon olduğundan DOM'suz require
 * edilir. Toleranslar SPEC'te verilen değerlerdir.
 */

const core = require('../../js/mount-core.js');

const comps = core.ttarComponentsSI();
const mounts = core.ttarMountsSI();
const g = core.TTAR_EXAMPLE.g;
const mp = core.combineMassProps(comps);
const Kstat = core.buildK(mounts, mp.cg, false);
const Kdyn = core.buildK(mounts, mp.cg, true);
const M6 = core.buildM6(mp.m, mp.I_G);

describe('T1 — Kütle birleştirme (tol: m ±0.01 kg, cg ±0.01 mm, I ±0.01 kg·m²)', () => {
  test('toplam kütle', () => {
    expect(mp.m).toBeCloseTo(2294.522, 2);
  });
  test('birleşik CG (mm)', () => {
    expect(mp.cg[0] * 1000).toBeCloseTo(254.669, 2);
    expect(mp.cg[1] * 1000).toBeCloseTo(7.504, 2);
    expect(mp.cg[2] * 1000).toBeCloseTo(746.052, 2);
  });
  test('birleşik atalet tensörü I_G (kg·m²)', () => {
    const exp = [
      [246.703, -5.074, 369.912],
      [-5.074, 1917.639, 1.150],
      [369.912, 1.150, 1754.782]
    ];
    for (let i = 0; i < 3; i++)
      for (let j = 0; j < 3; j++)
        expect(Math.abs(mp.I_G[i][j] - exp[i][j])).toBeLessThanOrEqual(0.01);
  });
  test('toplam kütle ≤ 0 → null', () => {
    expect(core.combineMassProps([{ name: 'x', mass: 0, cg: [0, 0, 0], I: [[0,0,0],[0,0,0],[0,0,0]], pointMass: true }])).toBeNull();
  });
});

describe('T2 — K_stat blokları (tol ±0.001 MN)', () => {
  const s = 1e-6;
  test('K_tt = diag(7.512, 7.512, 3.840) MN/m', () => {
    expect(Kstat[0][0] * s).toBeCloseTo(7.512, 3);
    expect(Kstat[1][1] * s).toBeCloseTo(7.512, 3);
    expect(Kstat[2][2] * s).toBeCloseTo(3.840, 3);
    expect(Kstat[0][1] * s).toBeCloseTo(0, 3);
    expect(Kstat[0][2] * s).toBeCloseTo(0, 3);
    expect(Kstat[1][2] * s).toBeCloseTo(0, 3);
  });
  test('K_tθ bloğu (MN/rad) — z-ekseni konvansiyonu: dz-tek terimler ters işaretli', () => {
    // makeA dz işaret çevirmesi (Adams kalibrasyonu): [0][1] ve [1][0] (dz'li) çevrilir.
    const exp = [[0, 1.4939, 0.0562], [-1.4939, 0, -1.3536], [-0.0287, 0.6919, 0]];
    for (let i = 0; i < 3; i++)
      for (let j = 0; j < 3; j++)
        expect(Math.abs(Kstat[i][3 + j] * s - exp[i][j])).toBeLessThanOrEqual(0.001);
  });
  test('K_θθ bloğu (MN·m/rad) — θx-θz ve θy-θz kuplajları ters işaretli', () => {
    const exp = [[0.7437, -0.0052, 0.9462], [-0.0052, 2.5549, 0.0112], [0.9462, 0.0112, 4.8346]];
    for (let i = 0; i < 3; i++)
      for (let j = 0; j < 3; j++)
        expect(Math.abs(Kstat[3 + i][3 + j] * s - exp[i][j])).toBeLessThanOrEqual(0.001);
  });
  test('K simetrik', () => {
    for (let i = 0; i < 6; i++)
      for (let j = 0; j < 6; j++)
        expect(Kstat[i][j]).toBeCloseTo(Kstat[j][i], 6);
  });
});

describe('T3 — Statik durum n=(0,0,−1) (tol sehim ±0.005 mm, kuvvet ±0.005 kN)', () => {
  const res = core.solveCase(Kstat, mounts, mp.cg, mp.m, g, { name: 'Static', n: [0, 0, -1], T: [0, 0, 0] });
  test('çözüm üretildi', () => { expect(res).not.toBeNull(); });
  // Z-EKSENİ KONVANSİYONU (makeA): ux, uy ve θz işaret çevirir; uz, θx, θy ve
  // tüm δz/fz DEĞİŞMEZ (δz = uz + dy·θx − dx·θy, dz içermez → statik δz doğruydu).
  test('q ötelemeleri (mm)', () => {
    expect(Math.abs(res.q[0] * 1000 - (-0.379))).toBeLessThanOrEqual(0.005);
    expect(Math.abs(res.q[1] * 1000 - (-0.084))).toBeLessThanOrEqual(0.005);
    expect(Math.abs(res.q[2] * 1000 - (-6.208))).toBeLessThanOrEqual(0.005);
  });
  test('q dönmeleri (mrad)', () => {
    expect(Math.abs(res.q[3] * 1000 - (-0.485))).toBeLessThanOrEqual(0.005);
    expect(Math.abs(res.q[4] * 1000 - 1.901)).toBeLessThanOrEqual(0.005);
    expect(Math.abs(res.q[5] * 1000 - 0.072)).toBeLessThanOrEqual(0.005);
  });
  test('takoz δz ve fz değerleri', () => {
    const expDz = [-3.941, -3.892, -6.911, -6.565, -7.104, -6.758];
    const expFz = [-2.522, -2.491, -4.423, -4.201, -4.547, -4.325];
    res.perMount.forEach((pm, i) => {
      expect(Math.abs(pm.delta[2] * 1000 - expDz[i])).toBeLessThanOrEqual(0.005);
      expect(Math.abs(pm.f[2] / 1000 - expFz[i])).toBeLessThanOrEqual(0.005);
    });
  });
  test('Σfz = −22.513 kN = −m·g, kontrol ✓, çekme = 0', () => {
    expect(Math.abs(res.sumF[2] / 1000 - (-22.513))).toBeLessThanOrEqual(0.005);
    expect(res.checks.sumFzOk).toBe(true);
    expect(res.checks.tensionCount).toBe(0);
  });
});

describe('T4 — Tork zinciri (tol ±0.5 N·m)', () => {
  const tq = core.TTAR_EXAMPLE.torque;
  test('T_fwd = 6667.1 N·m (φ_axle = 1/3.6 DAHİL)', () => {
    const T = core.torqueChain({ Te: tq.Te, Rstall: tq.Rstall, iGear: tq.fwd.iGear, iTransfer: tq.iTransfer, phiAxle: tq.fwd.phiAxle, derate: 1 });
    expect(Math.abs(T - 6667.1)).toBeLessThanOrEqual(0.5);
  });
  test('T_rev = −23705.1 N·m (işaretli iGear, φ_axle = 2.6/3.6)', () => {
    const T = core.torqueChain({ Te: tq.Te, Rstall: tq.Rstall, iGear: tq.rev.iGear, iTransfer: tq.iTransfer, phiAxle: tq.rev.phiAxle, derate: 1 });
    expect(Math.abs(T - (-23705.1))).toBeLessThanOrEqual(0.5);
  });
  test('derate verilmezse 1 kabul edilir', () => {
    const T1 = core.torqueChain({ Te: 100, Rstall: 1, iGear: 1, iTransfer: 1, phiAxle: 1 });
    expect(T1).toBeCloseTo(100, 9);
  });
});

describe('T5 — Forward süperpozisyon n=(0,0,−1), Tx=−6667.07 (tol ±0.01 mm)', () => {
  const res = core.solveCase(Kstat, mounts, mp.cg, mp.m, g, { name: 'Fwd', n: [0, 0, -1], T: [-6667.07, 0, 0] });
  test('takoz δz değerleri', () => {
    const expDz = [-4.918, -2.914, -13.782, 0.306, -13.975, 0.113];
    res.perMount.forEach((pm, i) => {
      expect(Math.abs(pm.delta[2] * 1000 - expDz[i])).toBeLessThanOrEqual(0.01);
    });
  });
  test('T8d — çekme bayrağı = 2 (sol orta + sol arka, lift-off DOĞRU yönde)', () => {
    expect(res.checks.tensionCount).toBe(2);
    expect(res.perMount[3].tension).toBe(true);  // sol orta +0.306
    expect(res.perMount[5].tension).toBe(true);  // sol arka +0.113
    expect(res.perMount[0].tension).toBe(false); // basma yanlış sayılmıyor
  });
  test('|δ| > 10 mm lineer bölge uyarısı (sağ orta/arka ~−13.8/−14.0)', () => {
    expect(res.perMount[2].overLinear).toBe(true);
    expect(res.perMount[4].overLinear).toBe(true);
    expect(res.checks.overLinearCount).toBeGreaterThanOrEqual(2);
  });
});

describe('T6 — Modal, dinamik rijitlik (tol ±0.005 Hz)', () => {
  const modes = core.solveModal(Kdyn, M6, mounts, mp.cg);
  test('6 mod, artan sırada', () => {
    expect(modes).toHaveLength(6);
    for (let i = 1; i < 6; i++) expect(modes[i].f_Hz).toBeGreaterThanOrEqual(modes[i - 1].f_Hz);
  });
  test('frekanslar Adams referans bandında', () => {
    const exp = [5.039, 6.111, 8.364, 10.148, 12.071, 21.239];
    modes.forEach((md, i) => {
      expect(Math.abs(md.f_Hz - exp[i])).toBeLessThanOrEqual(0.005);
    });
  });
  test('mod etiketleri (geometri duyarlı classifyMode, relMounts İLE)', () => {
    expect(modes[0].label).toMatch(/roll/);
    expect(modes[1].label).toMatch(/pitch/);
    expect(modes[2].label).toMatch(/bounce/);
    expect(modes[3].label).toMatch(/lateral|yaw/);
    expect(modes[4].label).toMatch(/fore-aft/);
    expect(modes[5].label).toMatch(/roll/);
  });
  test('mod şekilleri max bileşene normalize (maks |φ| = 1)', () => {
    modes.forEach(md => {
      const maxAbs = Math.max(...md.phi.map(Math.abs));
      expect(maxAbs).toBeCloseTo(1, 9);
    });
  });
});

describe('T7 — Modal, statik rijitlik çapraz kontrol (tol ±0.005 Hz)', () => {
  test('frekanslar', () => {
    const modes = core.solveModal(Kstat, M6, mounts, mp.cg);
    const exp = [4.051, 4.933, 6.764, 7.924, 9.433, 16.653];
    modes.forEach((md, i) => {
      expect(Math.abs(md.f_Hz - exp[i])).toBeLessThanOrEqual(0.005);
    });
  });
});

describe('T8 — Regresyon / negatif testler', () => {
  test('T8a — boş takoz tablosu: anlamlı hata, çökme yok', () => {
    const probs = core.validateModel(comps, []);
    expect(probs.some(p => p.includes('Takoz tablosu boş'))).toBe(true);
    const K0 = core.buildK([], mp.cg, false);
    expect(core.solveCase(K0, [], mp.cg, mp.m, g, { name: 'x', n: [0, 0, -1], T: [0, 0, 0] })).toBeNull();
  });
  test('T8b — tek takoz: null (singular) veya ΣFz kontrolü geçer', () => {
    const one = [mounts[0]];
    const K1 = core.buildK(one, mp.cg, false);
    const res = core.solveCase(K1, one, mp.cg, mp.m, g, { name: 'x', n: [0, 0, -1], T: [0, 0, 0] });
    if (res !== null) expect(res.checks.sumFzOk).toBe(true);
  });
  test('T8c — kz = 0: validasyon hatası "rijitlik ≤ 0"', () => {
    const bad = [{ name: 'bozuk', pos: [0, 0, 0], kstat: [1000, 1000, 0], kdyn: [1000, 1000, 1000] }];
    const probs = core.validateModel(comps, bad);
    expect(probs.some(p => /rijitlik/i.test(p))).toBe(true);
  });
});

describe('solveAllCases — çoklu yük durumu matrisi', () => {
  test('TTAR yük durumu şablonu: 8 satır, hepsi çözülür', () => {
    const model = core.buildModel(comps, mounts, g);
    const rows = core.solveAllCases(model, core.TTAR_EXAMPLE.loadCases);
    expect(rows).toHaveLength(8);
    rows.forEach(r => { expect(r.res).not.toBeNull(); });
    // Static satırı T3 ile aynı olmalı
    const st = rows[0].res;
    expect(Math.abs(st.perMount[0].delta[2] * 1000 - (-3.941))).toBeLessThanOrEqual(0.005);
    // Forward Torque satırı T5 ile aynı olmalı
    const fw = rows[6].res;
    expect(Math.abs(fw.perMount[2].delta[2] * 1000 - (-13.782))).toBeLessThanOrEqual(0.01);
  });
});

describe('T9 — ±15 mm metal-metal durdurucu (solveCaseStop, F4)', () => {
  test('küçük sehim: durdurucu devrede değil → solveCase (lineer) ile aynı', () => {
    const lc = { name: 'Static', n: [0, 0, -1], T: [0, 0, 0] };
    const lin = core.solveCase(Kstat, mounts, mp.cg, mp.m, g, lc);
    const stp = core.solveCaseStop(Kstat, mounts, mp.cg, mp.m, g, lc);
    expect(stp.checks.clampCount).toBe(0);
    expect(stp.checks.stopConverged).toBe(true);
    stp.perMount.forEach((pm, i) => {
      expect(pm.clamped).toBe(false);
      expect(pm.delta[2]).toBeCloseTo(lin.perMount[i].delta[2], 9);
    });
  });
  test('Max Bump 3.5g: orta+arka 4 takoz klipslenir, |δz| ≤ ~15 mm, ΣFz dengeli', () => {
    const res = core.solveCaseStop(Kstat, mounts, mp.cg, mp.m, g, { name: 'Max Bump', n: [0, 0, -3.5], T: [0, 0, 0] });
    expect(res.checks.stopConverged).toBe(true);
    expect(res.checks.clampCount).toBe(4);
    expect(res.perMount[0].clamped).toBe(false);  // ön serbest
    expect(res.perMount[2].clamped).toBe(true);    // orta klipsli
    res.perMount.forEach(pm => expect(Math.abs(pm.delta[2])).toBeLessThanOrEqual(0.0155));
    // Yük yeniden dağıtımı: klipslenen arka yükü öne aktarır → ön lineer −11.7'den derinleşir
    expect(res.perMount[0].delta[2] * 1000).toBeLessThan(-12.5);
    expect(res.checks.sumFzOk).toBe(true);         // temas kuvvetleri dahil düşey denge
  });
  test('Reverse Torque: çift yönlü klips (±15), yakınsar, ΣFz dengeli', () => {
    const res = core.solveCaseStop(Kstat, mounts, mp.cg, mp.m, g, { name: 'Reverse', n: [0, 0, -1], T: [23705.14, 0, 0] });
    expect(res.checks.stopConverged).toBe(true);
    expect(res.checks.clampCount).toBeGreaterThanOrEqual(3);
    res.perMount.forEach(pm => expect(Math.abs(pm.delta[2])).toBeLessThanOrEqual(0.016));
    expect(res.checks.sumFzOk).toBe(true);
  });
  test('solveAllCases useStop: Static aynı, Max Bump klipsli', () => {
    const model = core.buildModel(comps, mounts, g);
    const cases = [
      { name: 'Static', n: [0, 0, -1], T: [0, 0, 0] },
      { name: 'Max Bump', n: [0, 0, -3.5], T: [0, 0, 0] }
    ];
    const lin = core.solveAllCases(model, cases);
    const stp = core.solveAllCases(model, cases, { useStop: true });
    expect(stp[0].res.checks.clampCount).toBe(0);
    expect(stp[1].res.checks.clampCount).toBe(4);
    // durdurucusuz Max Bump orta lineer 15 mm'yi aşar; durduruculu klipslenir
    expect(Math.abs(lin[1].res.perMount[2].delta[2])).toBeGreaterThan(0.015);
    expect(Math.abs(stp[1].res.perMount[2].delta[2])).toBeLessThanOrEqual(0.0155);
  });
});

describe('transmissibility — iletilebilirlik / izolasyon (Kriter 2)', () => {
  const T = core.transmissibility;
  test('r=√2 izolasyon başı → T≈1 (düşük ζ)', () => {
    expect(T(Math.SQRT2, 1, 0.001)).toBeCloseTo(1, 2);
  });
  test('r=√3 → T≈0.5 (%50 kriter eşiği)', () => {
    expect(T(Math.sqrt(3), 1, 0.001)).toBeCloseTo(0.5, 2);
  });
  test('r=2 → T≈1/3 (klasik iki-kat ayrım)', () => {
    expect(T(2, 1, 0.001)).toBeCloseTo(1 / 3, 2);
  });
  test('statik r=0 → T=1', () => {
    expect(T(0, 1, 0.001)).toBeCloseTo(1, 9);
  });
  test('izolasyon bölgesinde (r>√2) frekans oranı arttıkça T azalır', () => {
    expect(T(2, 1, 0.001)).toBeLessThan(T(1.5, 1, 0.001));
    expect(T(3, 1, 0.001)).toBeLessThan(T(2, 1, 0.001));
  });
  test('rezonansta (r=1) sönüm tepeyi sınırlar: ζ↑ → T↓', () => {
    expect(T(1, 1, 0.001)).toBeGreaterThan(T(1, 1, 0.05));
    expect(T(1, 1, 0.05)).toBeCloseTo(10, 1);   // T_rez ≈ 1/(2ζ)
  });
  test('çok küçük ζ ≈ sönümsüz: T→1/|1−r²|', () => {
    const r = 1.53;
    expect(T(r, 1, 1e-6)).toBeCloseTo(1 / Math.abs(1 - r * r), 3);
  });
  test('f_nat ≤ 0 → NaN', () => {
    expect(Number.isNaN(T(30, 0, 0.001))).toBe(true);
    expect(Number.isNaN(T(30, -5, 0.001))).toBe(true);
  });
});

describe('selfTest — gömülü kabul testi koşucusu', () => {
  test('T1–T8 hepsi yeşil (failed = 0)', () => {
    const r = core.selfTest();
    const failedDetails = r.details.filter(d => !d.ok).map(d => d.id + ': ' + d.detail).join('\n');
    expect(failedDetails).toBe('');
    expect(r.failed).toBe(0);
    expect(r.passed).toBeGreaterThanOrEqual(10);
  });
});

describe('classifyMode — kenar durumlar', () => {
  test('relMounts olmadan etiket üretmez (— döner)', () => {
    expect(core.classifyMode([0, 0, 1, 0, 0, 0], [])).toBe('—');
    expect(core.classifyMode([0, 0, 1, 0, 0, 0], null)).toBe('—');
  });
  test('saf bounce ötelemesi → bounce', () => {
    const rel = mounts.map(m => [m.pos[0] - mp.cg[0], m.pos[1] - mp.cg[1], m.pos[2] - mp.cg[2]]);
    expect(core.classifyMode([0, 0, 1, 0, 0, 0], rel)).toBe('bounce');
  });
  test('saf roll dönmesi → roll', () => {
    const rel = mounts.map(m => [m.pos[0] - mp.cg[0], m.pos[1] - mp.cg[1], m.pos[2] - mp.cg[2]]);
    expect(core.classifyMode([0, 0, 0, 1, 0, 0], rel)).toBe('roll');
  });
});
