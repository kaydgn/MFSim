/**
 * Sönümlü modal analiz + modal enerji
 * ───────────────────────────────────
 *   ζ_r = (φᵀCφ)/(2 ω_r φᵀMφ)   ·   m_r = φᵀMφ ,  k_r = φᵀKφ ,  T_r = ½ω²m_r
 *
 * İki çıktı da MOD ŞEKLİNİN ÖLÇEĞİNE bağlı olmamalıdır (φ keyfi normalize edilir).
 * Testler bunu, fiziksel özdeşlikleri (k/m = ω², Σ gövde enerjisi = ½ω²φᵀMφ) ve
 * yaklaşımın geçerlilik sınırını (orantılı sönümde TAM; hafif sönümde frekans
 * yanıtının yarı-güç genişliğine yakınsar) kilitler.
 *
 * ALTIN REFERANS: ASR-SR-116 Tablo 12 — Mod 1 (5,93 Hz) gövde dağılımı
 * Motor %51,89 · Şanzıman %46,99 · Şaft %1,13; motor içinde Y %49,39, RXX %1,66.
 */

const core = require('../../js/mount-core.js');
global.veMountCore = core;
const stubs = stubGlobals({ saveState: jest.fn(), showToast: jest.fn() });
const rep = require('../../js/cp-mount-report.js');

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
const K6 = core.buildK(MOUNTS, MP.cg, true);
const MODES = core.solveModal(K6, M6, MOUNTS, MP.cg);
const STAT = core.solveCase(core.buildK(MOUNTS, MP.cg, false), MOUNTS, MP.cg, MP.m, 9.81,
                            { name: 'Static', n: [0, 0, -1], T: [0, 0, 0] });
const DAMP = core.mountDamping(MOUNTS, core.mountLoadShares(STAT, 9.81), 0.02);
const C6 = core.buildCdamp(MOUNTS, MP.cg, DAMP);

const ZMOD = core.modalDampingRatios(MODES, M6, C6);
const ME = core.modalEnergy(MODES, M6, K6, COMPS, MP.cg);

// φ'yi keyfi bir çarpanla ölçekle — normalizasyon bağımsızlığı testleri için.
const scaleModes = (s) => MODES.map((m) => ({ f_Hz: m.f_Hz, phi: m.phi.map((v) => v * s), label: m.label }));

describe('modalDampingRatios — mod başına sönüm oranı', () => {
  test('6 mod için de fiziksel aralıkta (0 < ζ < 1) değer üretir', () => {
    expect(ZMOD).toHaveLength(6);
    ZMOD.forEach((z) => {
      expect(z.zeta).toBeGreaterThan(0);
      expect(z.zeta).toBeLessThan(1);
      expect(Number.isFinite(z.f_d)).toBe(true);
    });
  });

  test('sönümlü frekans f_d = f_n·√(1−ζ²) — hafif sönümde f_n\'e çok yakın', () => {
    ZMOD.forEach((z, i) => {
      expect(z.f_d).toBeCloseTo(MODES[i].f_Hz * Math.sqrt(1 - z.zeta * z.zeta), 12);
      expect(z.f_d).toBeLessThanOrEqual(MODES[i].f_Hz);
      expect(z.f_d / MODES[i].f_Hz).toBeGreaterThan(0.99);       // ζ<0,14 → <%1 kayma
    });
  });

  test('mod şeklinin ÖLÇEĞİNDEN bağımsız (pay ve payda φ\'de 2. derece)', () => {
    [1e-3, 7, 1e4].forEach((s) => {
      const z = core.modalDampingRatios(scaleModes(s), M6, C6);
      z.forEach((e, i) => expect(e.zeta).toBeCloseTo(ZMOD[i].zeta, 12));
    });
  });

  test('ζ_r girilen ζ ile ORANTILI (c = 2ζ√(km) → C ∝ ζ)', () => {
    const d2 = core.mountDamping(MOUNTS, core.mountLoadShares(STAT, 9.81), 0.04);
    const z2 = core.modalDampingRatios(MODES, M6, core.buildCdamp(MOUNTS, MP.cg, d2));
    z2.forEach((e, i) => expect(e.zeta).toBeCloseTo(2 * ZMOD[i].zeta, 12));
  });

  test('sönüm yoksa ζ_r = 0, f_d = f_n', () => {
    const z0 = core.modalDampingRatios(MODES, M6, core.buildCdamp(MOUNTS, MP.cg, null));
    z0.forEach((e, i) => {
      expect(e.zeta).toBe(0);
      expect(e.f_d).toBeCloseTo(MODES[i].f_Hz, 12);
    });
  });

  test('ORANTILI SÖNÜMDE TAM: C = αM + βK → ζ_r = α/2ω + βω/2 (analitik)', () => {
    // Bu, izdüşüm bağıntısının bir yaklaşım DEĞİL, kesin sonuç olduğu tek durumdur;
    // hafif sönüm varsayımının bozulmadığı referans noktası budur.
    const alpha = 0.6, beta = 2e-4;
    const Cp = M6.map((row, i) => row.map((v, j) => alpha * v + beta * K6[i][j]));
    const zp = core.modalDampingRatios(MODES, M6, Cp);
    zp.forEach((e, i) => {
      const w = 2 * Math.PI * MODES[i].f_Hz;
      expect(e.zeta).toBeCloseTo(alpha / (2 * w) + beta * w / 2, 12);
    });
  });

  test('TEK takoz + merkezî kütle = gerçek SDOF → ζ_r girilen ζ\'nin ta kendisi', () => {
    const m = 500, k = 2e6, z = 0.05;
    const one = [{ name: 's', pos: [0, 0, 0], kstat: [k, k, k], kdyn: [k, k, k] }];
    const M1 = core.buildM6(m, [[1, 0, 0], [0, 1, 0], [0, 0, 1]]);
    const K1 = core.buildK(one, [0, 0, 0], true);
    const md = core.solveModal(K1, M1, one, [0, 0, 0]);
    const dmp = [{ c: [0, 1, 2].map(() => 2 * z * Math.sqrt(k * m)) }];
    const zz = core.modalDampingRatios(md, M1, core.buildCdamp(one, [0, 0, 0], dmp));
    // Öteleme modları (dönme modları burada f=0 → NaN, kütle nokta değil ama
    // tek takoz dönmeyi kısıtlamaz; yalnız sonlu frekanslı öteleme modları bakılır)
    const trans = zz.filter((e, i) => md[i].f_Hz > 1e-6 && Math.abs(md[i].phi[0]) +
      Math.abs(md[i].phi[1]) + Math.abs(md[i].phi[2]) > 0.9);
    expect(trans.length).toBeGreaterThan(0);
    trans.forEach((e) => expect(e.zeta).toBeCloseTo(z, 9));
  });

  test('NONLİNEER: c, modal frekansı üreten TANJANT rijitlikten türer (nominal k_dyn değil)', () => {
    // Sertleşen bir takozda statik dengedeki dinamik tanjant, nominal k_dyn'in
    // katı olabilir. ζ_r = φᵀCφ/(2ω φᵀMφ) içinde ω tanjanttan, C nominalden
    // gelirse oran sistematik olarak √(k_nom/k_tan) kadar KÜÇÜK çıkar ve
    // kullanıcı "bu mod az sönümlü" diye yanlış okur.
    const nl = [[-0.5, -0.4, 0], [-0.5, 0.4, 0], [0.5, -0.4, 0], [0.5, 0.4, 0]].map((p, i) => ({
      name: 'm' + i, pos: p, kstat: [500e3, 500e3, 800e3], kdyn: [600e3, 600e3, 1200e3],
      fits: { z: { form: 'poly', k0: 800, c3: 60 } },        // F = 800x + 60x³ (x mm) — sertleşen
    }));
    const cs = [{ name: 'A', mass: 400, cg: [0, 0, 0.3], I: [[20, 0, 0], [0, 30, 0], [0, 0, 25]], pointMass: false }];
    const mpN = core.combineMassProps(cs);
    const MN = core.buildM6(mpN.m, mpN.I_G);
    const res = core.solveCaseNL(nl, mpN.cg, mpN.m, 9.81, { name: 'S', n: [0, 0, -3.5], T: [0, 0, 0] }, { useStop: true });
    const kt = core.mountTangentKdyn(nl, mpN.cg, res.q);
    expect(kt[0][2] / nl[0].kdyn[2]).toBeGreaterThan(2);      // tanjant nominalin 2 katından fazla
    // buildKtangentDyn ile AYNI kaynağı paylaşıyor mu?
    const KtA = core.buildKtangentDyn(nl, mpN.cg, res.q);
    const KtB = core.buildK(nl.map((m, i) => Object.assign({}, m, { kdyn: kt[i], kstat: kt[i] })), mpN.cg, true);
    for (let a = 0; a < 6; a++) for (let b = 0; b < 6; b++) expect(KtA[a][b]).toBeCloseTo(KtB[a][b], 6);

    const sh = core.mountLoadShares(res, 9.81);
    const modesN = core.solveModal(KtA, MN, nl, mpN.cg);
    const zNom = core.modalDampingRatios(modesN, MN, core.buildCdamp(nl, mpN.cg, core.mountDamping(nl, sh, 0.05)));
    const zTan = core.modalDampingRatios(modesN, MN, core.buildCdamp(nl, mpN.cg, core.mountDamping(nl, sh, 0.05, kt)));
    // Düşey hareket içeren modlarda fark belirgin (≥ %40)
    const rel = zTan.map((e, i) => e.zeta / zNom[i].zeta);
    expect(Math.max(...rel)).toBeGreaterThan(1.4);
    zTan.forEach((e) => expect(e.zeta).toBeGreaterThan(0));
  });

  test('LİNEER: kBasis verilmese de tanjant == nominal → c değişmez', () => {
    const kt = core.mountTangentKdyn(MOUNTS, MP.cg, null);
    kt.forEach((k, i) => k.forEach((v, ax) => expect(v).toBeCloseTo(MOUNTS[i].kdyn[ax], 6)));
    const dA = core.mountDamping(MOUNTS, core.mountLoadShares(STAT, 9.81), 0.02);
    const dB = core.mountDamping(MOUNTS, core.mountLoadShares(STAT, 9.81), 0.02, kt);
    dA.forEach((e, i) => e.c.forEach((v, ax) => expect(v).toBeCloseTo(dB[i].c[ax], 6)));
  });

  test('girdi eksikse null / NaN — sayı uydurulmaz', () => {
    expect(core.modalDampingRatios(null, M6, C6)).toBeNull();
    expect(core.modalDampingRatios(MODES, M6, null)).toBeNull();
    const bad = core.modalDampingRatios([{ f_Hz: 0, phi: [1, 0, 0, 0, 0, 0] }], M6, C6);
    expect(Number.isNaN(bad[0].zeta)).toBe(true);
    const noPhi = core.modalDampingRatios([{ f_Hz: 5 }], M6, C6);
    expect(Number.isNaN(noPhi[0].zeta)).toBe(true);
  });

  test('ASR-SR-116 modelinde ζ modlara EŞİT dağılmaz — dönme modu en çok söner', () => {
    // Tasarım bilgisi: tek bir ζ girilse de modların gördüğü sönüm 2 kattan fazla
    // değişir. Bu bulgu ortadan kalkarsa (hepsi 0,02 çıkarsa) C, K ile orantılı
    // kurulmuş demektir — bağıntı c = 2ζ√(k·m) bozulmuş olur.
    const zs = ZMOD.map((e) => e.zeta);
    const zmin = Math.min(...zs), zmax = Math.max(...zs);
    expect(zmax / zmin).toBeGreaterThan(1.8);
    expect(zs.indexOf(zmax)).toBe(5);              // en yüksek mod (roll) en sönümlü
    expect(zmax).toBeGreaterThan(0.02);            // girilen ζ'nin üstünde
    expect(zmin).toBeLessThan(0.02);               // ve altında mod var
  });

  // ── Bağımsız ölçüm: frekans yanıtı tepesinin yarı-güç (−3 dB) genişliği ──
  // İzdüşümü DOĞRULAYAN ikinci, tamamen farklı yol: ζ ≈ Δf₋₃dB/(2f_tepe).
  // FRF, modal ayrıştırma kullanmaz — doğrudan [K−ω²M+iωC]Q=F çözümüdür.
  const SHARES = core.mountLoadShares(STAT, 9.81);
  const halfPowerZeta = (zeta, i, dir) => {
    const d = core.mountDamping(MOUNTS, SHARES, zeta);
    const T = (f) => core.frfAt(MOUNTS, MP.cg, M6, d, f, dir);
    const f0 = MODES[i].f_Hz, span = f0 * 0.05, N = 600;
    let fp = f0, Tp = -1;
    for (let n = 0; n <= N; n++) { const f = f0 - span + 2 * span * n / N; const t = T(f); if (t > Tp) { Tp = t; fp = f; } }
    const half = Tp / Math.SQRT2;
    const bisect = (a, b) => { for (let n = 0; n < 60; n++) { const m = (a + b) / 2; if (T(m) > half) a = m; else b = m; } return (a + b) / 2; };
    return (bisect(fp, fp * 1.2) - bisect(fp, fp * 0.8)) / (2 * fp);
  };
  const projZeta = (zeta, i) => core.modalDampingRatios(MODES, M6,
    core.buildCdamp(MOUNTS, MP.cg, core.mountDamping(MOUNTS, SHARES, zeta)))[i].zeta;

  test('DOĞRULAMA: iyi ayrık modda yarı-güç ölçümü izdüşümle örtüşür (<%0,5)', () => {
    // Mod 1 (yanal, 5,92 Hz) en yakın komşusundan %11 uzakta — modal örtüşme yok.
    // Burada iki yöntem ζ=0,02'de bile birbirini ondalık basamağında tutar:
    // izdüşüm bağıntısının kendisi doğrudur.
    [0.02, 0.005].forEach((z) => {
      const p = projZeta(z, 0), h = halfPowerZeta(z, 0, 1);
      expect(Math.abs(h - p) / p).toBeLessThan(0.005);
    });
  });

  test('GEÇERLİLİK SINIRI: yakın modda fark ζ ile ORANTILI küçülür (modal örtüşme)', () => {
    // Mod 4 (11,33 Hz) ile mod 5 (13,26 Hz) yalnız %17 ayrık. Orada iki yöntem
    // ζ=0,02'de %10 ayrışır. HANGİSİ hatalı? Sönümü küçültünce fark sistematik
    // olarak sıfıra gider → ayrışmanın kaynağı izdüşüm DEĞİL, yarı-güç yönteminin
    // komşu tepe altında kalan kuyruğu ölçmesidir. Hafif sönüm varsayımının
    // ölçülmüş geçerlilik sınırı budur.
    const errs = [0.02, 0.01, 0.005, 0.002].map((z) => {
      const p = projZeta(z, 3);
      return Math.abs(halfPowerZeta(z, 3, 2) - p) / p;
    });
    for (let i = 1; i < errs.length; i++) expect(errs[i]).toBeLessThan(errs[i - 1]);
    expect(errs[0]).toBeLessThan(0.15);        // ζ=0,02 → ~%10,5
    expect(errs[3]).toBeLessThan(0.01);        // ζ=0,002 → <%1 (yakınsıyor)
  });

  test('DOĞRULAMA: en sönümlü mod (roll, ζ=0,0356) da bağımsız ölçümle uyuşuyor', () => {
    // Roll modu girilen ζ'nin 1,78 katını görüyor — bu, izdüşümün bir artefaktı
    // değil: bağımsız FRF ölçümü aynı büyüklüğü veriyor.
    const p = projZeta(0.02, 5), h = halfPowerZeta(0.02, 5, 1);
    expect(p).toBeCloseTo(0.0356, 3);
    expect(Math.abs(h - p) / p).toBeLessThan(0.03);
  });
});

describe('modalEnergy — genelleştirilmiş büyüklükler', () => {
  test('k_r/m_r = ω² — özdeğer çözümüyle birebir tutarlı (6/6 mod)', () => {
    ME.forEach((e, i) => {
      const w = 2 * Math.PI * MODES[i].f_Hz;
      expect(Math.sqrt(e.kGen / e.mGen)).toBeCloseTo(w, 6);
      expect(Math.sqrt(e.kGen / e.mGen) / (2 * Math.PI) / MODES[i].f_Hz).toBeCloseTo(1, 9);
    });
  });

  test('m_r > 0, k_r > 0 (M ve K pozitif tanımlı)', () => {
    ME.forEach((e) => {
      expect(e.mGen).toBeGreaterThan(0);
      expect(e.kGen).toBeGreaterThan(0);
    });
  });

  test('KE = ½ω²m_r tanımı birebir', () => {
    ME.forEach((e, i) => {
      const w = 2 * Math.PI * MODES[i].f_Hz;
      expect(e.ke).toBeCloseTo(0.5 * w * w * e.mGen, 9);
    });
  });

  test('ÖZDEŞLİK: Σ gövde kinetik enerjisi = ½ω²·φᵀM₆φ (makine hassasiyetinde)', () => {
    // Bu, dağılımın "uydurulmadığının" kanıtıdır: gövdeler kendi CG'lerindeki
    // atalet + paralel eksen ile toplandığında birleşik M₆ ile AYNI sayıyı verir
    // (Σ m_j d_j = 0 olduğu için çapraz terimler düşer).
    ME.forEach((e) => {
      expect(Math.abs(e.total - e.ke) / e.ke).toBeLessThan(1e-12);
    });
  });

  test('mutlak değerler ölçekle s² büyür, YÜZDE dağılım değişmez', () => {
    const s = 5;
    const me2 = core.modalEnergy(scaleModes(s), M6, K6, COMPS, MP.cg);
    me2.forEach((e, i) => {
      expect(e.mGen / ME[i].mGen).toBeCloseTo(s * s, 6);
      expect(e.ke / ME[i].ke).toBeCloseTo(s * s, 6);
      e.bodies.forEach((b, j) => expect(b.pct).toBeCloseTo(ME[i].bodies[j].pct, 9));
    });
  });

  test('yüzdelerin toplamı %100', () => {
    ME.forEach((e) => {
      const sum = e.bodies.reduce((a, b) => a + b.pct, 0);
      expect(sum).toBeCloseTo(100, 9);
    });
  });
});

describe('modalEnergy — gövde bazında dağılım (ASR-SR-116 Tablo 12)', () => {
  const m1 = ME[0];
  const by = (n) => m1.bodies.find((b) => b.name === n);

  test('Mod 1 (~5,9 Hz, yanal) enerjisi Motor–Şanzıman arasında paylaşılır', () => {
    expect(MODES[0].f_Hz).toBeCloseTo(5.93, 0);
    expect(by('Motor').pct).toBeCloseTo(51.9, 0);        // rapor %51,89
    expect(by('Şanzıman').pct).toBeCloseTo(47.0, 0);     // rapor %46,99
    expect(by('Şaft').pct).toBeLessThan(2);              // rapor %1,13
    expect(by('Motor').pct).toBeGreaterThan(by('Şanzıman').pct);
  });

  test('Mod 1 motor enerjisi Y ötelemesinde toplanır (rapor: Y %49,39)', () => {
    const tot = m1.total;
    expect(100 * by('Motor').Y / tot).toBeCloseTo(49.4, 0);
    expect(100 * by('Motor').RXX / tot).toBeCloseTo(1.7, 0);   // rapor %1,66
    expect(by('Motor').Y).toBeGreaterThan(by('Motor').X + by('Motor').Z);
  });

  test('gövde payları kütle ve ağırlık merkezi ofsetiyle tutarlı', () => {
    // Saf ÖTELEME modunda (θ≈0) pay yalnız kütle oranıdır — geometri girmez.
    const pureTrans = { f_Hz: 10, phi: [0, 0, 1, 0, 0, 0], label: 'test' };
    const e = core.modalEnergy([pureTrans], M6, K6, COMPS, MP.cg)[0];
    e.bodies.forEach((b, j) => {
      expect(b.pct).toBeCloseTo(100 * COMPS[j].mass / MP.m, 9);
    });
  });

  test('ÇAPRAZ ÇARPIM İŞARETİ: v = u + θ×d (özdeşlik bu işarete KÖR — ayrı kilit)', () => {
    // Σ m_j d_j = 0 olduğundan Σ KE_j = ½ω²φᵀMφ özdeşliği v = u ± θ×d için AYNI
    // şekilde sağlanır; yani özdeşlik testi işaret hatasını YAKALAMAZ. Burada
    // kuplajın YÖNÜ analitik olarak kilitlenir: eşit iki kütle ±L'de, mod
    // φ = [0, u_y, 0, 0, 0, θ_z] iken (θ×d)_y = θ_z·d_x olduğundan +x'teki gövde
    // v_y = u_y + θ_z·L (güçlenir), −x'teki v_y = u_y − θ_z·L (zayıflar).
    // İşaret ters çevrilirse hangi gövdenin "sıcak" olduğu yer değiştirir.
    const L = 2, mB = 100;
    const two = [
      { name: 'sag', mass: mB, cg: [+L, 0, 0], I: [[0, 0, 0], [0, 0, 0], [0, 0, 0]], pointMass: true },
      { name: 'sol', mass: mB, cg: [-L, 0, 0], I: [[0, 0, 0], [0, 0, 0], [0, 0, 0]], pointMass: true },
    ];
    const mpT = core.combineMassProps(two);
    expect(mpT.cg).toEqual([0, 0, 0]);
    const M = core.buildM6(mpT.m, mpT.I_G);
    const uy = 1, tz = 0.25;
    const e = core.modalEnergy([{ f_Hz: 10, phi: [0, uy, 0, 0, 0, tz], label: 't' }], M, M, two, mpT.cg)[0];
    const sag = e.bodies[0], sol = e.bodies[1];
    // v_y beklenen: sağ 1+0,25·2 = 1,5 ; sol 1−0,25·2 = 0,5 → enerji oranı 9:1
    expect(sag.Y / sol.Y).toBeCloseTo((uy + tz * L) ** 2 / (uy - tz * L) ** 2, 9);
    expect(sag.pct).toBeCloseTo(90, 9);
    expect(sol.pct).toBeCloseTo(10, 9);
    // özdeşlik de tutar — ama tek başına yukarıdaki 90/10'u garanti ETMEZ
    expect(Math.abs(e.total - e.ke) / e.ke).toBeLessThan(1e-12);
  });

  test('saf DÖNME modunda uzaktaki gövde baskın (kaldıraç kolu)', () => {
    // θz etrafında saf yaw: KE_j ∝ m_j·|d_j⊥|² + I_zz,j. Şaft en uzaktadır;
    // 16 kg olmasına rağmen payı kütle oranının (%0,65) çok üstüne çıkar.
    const yaw = { f_Hz: 10, phi: [0, 0, 0, 0, 0, 1], label: 'test' };
    const e = core.modalEnergy([yaw], M6, K6, COMPS, MP.cg)[0];
    const saft = e.bodies.find((b) => b.name === 'Şaft');
    expect(saft.pct).toBeGreaterThan(100 * 16 / MP.m);
    expect(saft.Z).toBe(0);                       // θz yaw → düşey hız yok
  });

  test('NOKTA KÜTLE: atalet terimleri sıfır ve özdeşlik YİNE tutar', () => {
    // Kritik: combineMassProps da nokta kütlede I=0 alır. Uygulamada M₆ ve gövde
    // ayrıştırması AYNI kabulü paylaştığı için Σ KE_j = ½ω²φᵀM₆φ bozulmaz.
    // (Şaft/PTO/Pompa varsayılan olarak nokta kütledir — bu yol gerçek kullanımdır.)
    const pm = COMPS.map((c) => Object.assign({}, c, { pointMass: true }));
    const MPp = core.combineMassProps(pm);
    const M6p = core.buildM6(MPp.m, MPp.I_G);
    const K6p = core.buildK(MOUNTS, MPp.cg, true);
    const modesP = core.solveModal(K6p, M6p, MOUNTS, MPp.cg);
    const ep = core.modalEnergy(modesP, M6p, K6p, pm, MPp.cg);
    ep.forEach((e) => {
      e.bodies.forEach((b) => {
        expect(b.RXX + b.RYY + b.RZZ + b.RXY + b.RXZ + b.RYZ).toBe(0);
        expect(b.ke).toBeCloseTo(b.X + b.Y + b.Z, 12);
      });
      expect(Math.abs(e.total - e.ke) / e.ke).toBeLessThan(1e-12);   // özdeşlik korunur
    });
  });

  test('SÖZLEŞME: M₆ ile bileşen listesi çelişirse özdeşlik bozulur (uyumsuzluk kilidi)', () => {
    // M₆ tam ataletten, gövdeler nokta kütle kabulünden gelirse fark, ihmal edilen
    // kendi-atalet katkısıdır. Bu bilinçli bir uyumsuzluktur; uygulamada oluşmaz
    // (aynı bileşen listesi her ikisini de besler) ama sessizce yutulmamalıdır.
    const pm = COMPS.map((c) => Object.assign({}, c, { pointMass: true }));
    const e = core.modalEnergy(MODES, M6, K6, pm, MP.cg)[0];
    expect(e.total).toBeLessThan(e.ke);
  });

  test('atalet ÇARPIM terimleri (RXY/RXZ/RYZ) I_j simetrikse sıfır', () => {
    ME.forEach((e) => e.bodies.forEach((b) => {
      expect(b.RXY).toBeCloseTo(0, 15); expect(b.RXZ).toBeCloseTo(0, 15); expect(b.RYZ).toBeCloseTo(0, 15);
    }));
    // Çarpım atalet girilirse terim ORTAYA ÇIKAR ve özdeşlik yine tutar.
    const withProd = COMPS.map((c) => Object.assign({}, c, {
      I: [[c.I[0][0], 5, 3], [5, c.I[1][1], 2], [3, 2, c.I[2][2]]] }));
    const MPp = core.combineMassProps(withProd);
    const M6p = core.buildM6(MPp.m, MPp.I_G);
    const K6p = core.buildK(MOUNTS, MPp.cg, true);
    const modesP = core.solveModal(K6p, M6p, MOUNTS, MPp.cg);
    const ep = core.modalEnergy(modesP, M6p, K6p, withProd, MPp.cg);
    expect(ep[0].bodies.some((b) => b.RXY !== 0)).toBe(true);
    ep.forEach((e) => expect(Math.abs(e.total - e.ke) / Math.abs(e.ke)).toBeLessThan(1e-10));
  });

  test('bileşen listesi yoksa gövde dağılımı boş, genelleştirilmiş değerler durur', () => {
    const e = core.modalEnergy(MODES, M6, K6, null, MP.cg)[0];
    expect(e.bodies).toEqual([]);
    expect(e.mGen).toBeCloseTo(ME[0].mGen, 12);
    expect(e.total).toBe(0);
  });

  test('girdi eksikse null', () => {
    expect(core.modalEnergy(null, M6, K6, COMPS, MP.cg)).toBeNull();
    expect(core.modalEnergy(MODES, null, K6, COMPS, MP.cg)).toBeNull();
    expect(core.modalEnergy(MODES, M6, null, COMPS, MP.cg)).toBeNull();
  });
});

describe('Rapor — §8.7 sönümlü sütunlar ve §8.14 modal enerji', () => {
  const SHARES2 = core.mountLoadShares(STAT, 9.81);
  const R = { mp: MP, mounts: MOUNTS, modes: MODES, modalDamping: ZMOD, modalEnergy: ME,
              components: COMPS, damping: DAMP, zeta: 0.02,
              gather: { components: [], mounts: [], torque: {} } };

  test('§8.7 tablosunda ζ_mod ve f_d sütunları görünür', () => {
    const h = rep._mntRepStep5Modal(R, core);
    expect(h).toContain('ζ<sub>mod</sub>');
    expect(h).toContain('f<sub>d</sub>');
    expect(h).toContain('\\zeta_r');
  });

  test('§8.7 modalDamping yoksa sütunları HİÇ basmaz (boş sütun gösterilmez)', () => {
    const h = rep._mntRepStep5Modal(Object.assign({}, R, { modalDamping: null }), core);
    expect(h).not.toContain('ζ<sub>mod</sub>');
    expect(h).toContain('Rijit gövde modları');       // tablo yine üretilir
  });

  test('§8.14 üretilir; özdeğer tutarlılık kapısı YEŞİL', () => {
    const h = rep._mntRepModalEnergy(R);
    expect(h).toContain('8.14 Modal enerji');
    expect(h).toContain('note check');                 // uyumsuzluk uyarısı YOK
    expect(h).not.toContain('Beklenenden büyük');
  });

  test('§8.14 gövde adlarını ve mod başına ayrıntı tablolarını içerir', () => {
    const h = rep._mntRepModalEnergy(R);
    ['Motor', 'Şanzıman', 'Şaft'].forEach((n) => expect(h).toContain(n));
    expect(h).toContain('RXY');
    // 6 mod × 1 ayrıntı tablosu + özet + genelleştirilmiş tablo
    expect((h.match(/<caption>/g) || []).length).toBe(8);
  });

  test('§8.14 YANLIŞ K ile kurulursa tutarlılık kapısı KIRMIZI olur', () => {
    // Regresyon kilidi: modal enerji, modları üreten K'den farklı bir K ile
    // hesaplanırsa k/m = ω² bozulur — rapor bunu sessizce geçmemeli.
    const meBad = core.modalEnergy(MODES, M6, core.buildK(MOUNTS, MP.cg, false), COMPS, MP.cg);
    const h = rep._mntRepModalEnergy(Object.assign({}, R, { modalEnergy: meBad }));
    expect(h).toContain('Beklenenden büyük');
    expect(h).toContain('note warn');
  });

  test('§8.14 veri yoksa boş döner (rapora bölüm eklenmez)', () => {
    expect(rep._mntRepModalEnergy(Object.assign({}, R, { modalEnergy: null }))).toBe('');
    expect(rep._mntRepModalEnergy(Object.assign({}, R, { modes: MODES.slice(0, 3) }))).toBe('');
  });

  test('_rE bilimsel gösterimi: küçük mertebe düz, büyük mertebe üslü', () => {
    expect(rep._rE(12.345, 2)).toBe('12,35');
    expect(rep._rE(0)).toBe('0');
    expect(rep._rE(1.68e6, 2)).toBe('1,68·10<sup>6</sup>');
    expect(rep._rE(4.5e-7, 1)).toBe('4,5·10<sup>−7</sup>');
    expect(rep._rE(NaN)).toBe('—');
    expect(rep._rE(1)).toBe('1');
    expect(rep._rE(9999.9, 1)).toBe('9999,9');
    expect(rep._rE(10000)).toBe('1·10<sup>4</sup>');
    expect(rep._rE(0.5, 2)).toBe('0,5');            // 1e-3..1 düz basılır
    expect(rep._rE(-1234.5, 1)).toBe('−1234,5');
  });

  test('_rE mantisi yuvarlama sonrası NORMALİZE edilir ("10·10⁶" basılmaz)', () => {
    // 9,9996·10⁶ iki haneye yuvarlanınca mantis 10,00 olur; üs bir artırılmalı.
    expect(rep._rE(9.9996e6, 2)).toBe('1·10<sup>7</sup>');
    expect(rep._rE(-9.9996e6, 2)).toBe('−1·10<sup>7</sup>');
    expect(rep._rE(9.96e-8, 1)).toBe('1·10<sup>−7</sup>');
    expect(rep._rE(5e-324)).toBe('—');              // subnormal: 10^e taşar
    expect(rep._rE(Infinity)).toBe('—');
  });

  test('§8.7 "en sönümlü mod" numarası ORİJİNAL indekstir (NaN varsa kaymaz)', () => {
    // Mod 1'in ζ'si NaN; gerçek en sönümlü mod 6. Filtrelenmiş dizide indexOf
    // kullanılırsa rapor "mod 5" yazardı ve kendi tablosuyla çelişirdi.
    const z = ZMOD.map((e, i) => (i === 0 ? { zeta: NaN, f_d: NaN, over: false } : e));
    const h = rep._mntRepStep5Modal(Object.assign({}, R, { modalDamping: z }), core);
    expect(h).toContain('en sönümlü mod 6');
    expect(h).not.toContain('en sönümlü mod 5');
  });

  test('§8.7 nedensel gerekçe VERİDEN gelir (dönme baskın değilse yazılmaz)', () => {
    const h = rep._mntRepStep5Modal(R, core);
    expect(h).toContain('dönme baskın');            // bu modelde mod 6 = roll
    // en sönümlü modu ÖTELEME baskın bir moda taşı → gerekçe değişmeli
    const z = ZMOD.map((e, i) => (i === 0 ? { zeta: 0.9, f_d: 1, over: false } : { zeta: 0.01, f_d: 1, over: false }));
    const h2 = rep._mntRepStep5Modal(Object.assign({}, R, { modalDamping: z }), core);
    expect(h2).toContain('öteleme baskındır');
    expect(h2).not.toContain('kaldıraç koluyla');
  });

  test('§8.7 AŞIRI SÖNÜM (ζ_mod ≥ 1) sessizce yutulmaz — işaretlenir', () => {
    const z6 = core.modalDampingRatios(MODES, M6,
      core.buildCdamp(MOUNTS, MP.cg, core.mountDamping(MOUNTS, SHARES2, 0.6)));
    expect(z6[5].zeta).toBeGreaterThan(1);          // roll modu kritik sönümü aşıyor
    expect(z6[5].over).toBe(true);
    expect(Number.isNaN(z6[5].f_d)).toBe(true);     // salınım yok → f_d tanımsız
    const h = rep._mntRepStep5Modal(Object.assign({}, R, { modalDamping: z6 }), core);
    expect(h).toContain('aşırı sönüm');
    expect(h).toContain('salınım yok');
    expect(h).toContain('en sönümlü mod 6');
  });

  test('§8.14 SERBEST MOD kapıyı yanlış kırmızıya çevirmez', () => {
    // 2 takoz → kinematik olarak serbest; mod 1 f≈6,6e-8 Hz. Bağıl fark 0/0
    // mertebesinde ve ~0,29 çıkıyor. Bu mod kapıya girmemeli.
    const two = [MOUNTS[0], MOUNTS[1]];
    const Kf = core.buildK(two, MP.cg, true);
    const mf = core.solveModal(Kf, M6, two, MP.cg);
    const ef = core.modalEnergy(mf, M6, Kf, COMPS, MP.cg);
    expect(mf[0].f_Hz).toBeLessThan(1e-6);                     // gerçekten serbest
    const h = rep._mntRepModalEnergy(Object.assign({}, R, { modes: mf, modalEnergy: ef, modalDamping: null }));
    expect(h).toContain('note check');
    expect(h).not.toContain('Beklenenden büyük');
    expect(h).toContain('kapı dışında bırakıldı');
    expect(h).toContain('1 mod sıfıra yakın frekansta');
  });

  test('§8.14 enerjisi TAM SIFIR olan mod sessizce atlanmaz — açıklanır', () => {
    const zeroMode = { f_Hz: 0, phi: [0, 0, 1, 0, 0, 0], label: 'serbest mod (f≈0) ⚠' };
    const ms = [zeroMode].concat(MODES.slice(1));
    const es = core.modalEnergy(ms, M6, K6, COMPS, MP.cg);
    expect(es[0].total).toBe(0);
    const h = rep._mntRepModalEnergy(Object.assign({}, R, { modes: ms, modalEnergy: es, modalDamping: null }));
    expect(h).toContain('Atlanan modlar');
    expect(h).toContain('Mod 1');
    expect((h.match(/<caption>/g) || []).length).toBe(7);      // 8 yerine 7: mod 1 tablosu yok
  });

  test('§8.14 hiç değerlendirilebilir mod yoksa "fark 0" diye OLUMLU iddia basmaz', () => {
    const bad = ME.map((e) => Object.assign({}, e, { mGen: 0, kGen: 0, ke: 0, total: 0, bodies: [] }));
    const h = rep._mntRepModalEnergy(Object.assign({}, R, { modalEnergy: bad }));
    expect(h).toContain('Kontrol edilebilir mod bulunamadı');
    expect(h).not.toContain('note check');
    expect(h).not.toContain('aynı K ve M matrislerinin özçözümüdür');
  });

  test('§8.12 metni C matrisinin gerçekten girdiği yerleri söylüyor', () => {
    const h = rep._mntRepDamping(R);
    expect(h).toContain('§8.13');
    expect(h).toContain('sönümü hiç içermez');      // §8.14 C kullanmıyor — açıkça yazılı
  });
});
