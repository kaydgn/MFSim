/**
 * Geçici rejim entegratörleri (js/mount-core.js → shockResponse · entegratorParam ·
 * entegratorYukseltme · geciciAyar)
 * ─────────────────────────────────────────────────────────────────────
 * Şok çözümü dört zaman entegratörünü TEK genelleştirilmiş-α denkleminden geçirir:
 * newmark-ort (varsayılan — eski yol), newmark-dogrusal (koşullu kararlı), HHT-α ve
 * genelleştirilmiş-α (Chung & Hulbert 1993). Sayısal sönüm SESSİZ bir büyüklüktür:
 * eğri makul görünür, salınım olması gerekenden erken söner ya da periyot kayar.
 * Ölçülen şey eğrinin varlığı değil:
 *
 *  1. VARSAYILAN DEĞİŞMEDİ — seçeneksiz çağrı = açık 'newmark-ort' = α = 0 HHT,
 *     lineer ve Newton yolunda.
 *  2. ÖZEL HÂL KİMLİKLERİ — eşleme literatürün formülleri; gen-α ρ∞ = ½ ≡ HHT
 *     α = −⅓; ρ∞ = 1'in asıl kökleri ortalama ivme Newmark'ınkiler.
 *  3. KURAM — adım büyütme matrisinin spektral yarıçapı Ω → ∞'da bilinen
 *     limitlere iner (HHT (1+α)/(1−α), gen-α ρ∞, Newmark-ort 1); doğrusal ivme
 *     Ω > 2√3'te kararsız.
 *  4. ÖLÇÜLEN = KURAM — ayrışık zıplamanın darbe sonrası serbest salınımında adım
 *     başına genlik oranı ve periyot, kapalı formun o Ω'daki değeri.
 *  5. KARARLILIK KISITI — koşullu yöntemde Δt kendiliğinden küçülür; bütçe
 *     yetmezse sonuç bayraklı döner (sessiz patlama yok).
 *  6. NEWTON YOLU — eğrili takoz ve durdurucuda her entegratör yakınsıyor; lineer
 *     yasada Newton yolu lineer yolun kendisi (iç kuvvetin ortalaması dâhil).
 *  7. AYAR — aralık dışı ya da bozuk değer sınıra ya da varsayılana düşüyor.
 */
const core = require('../../js/mount-core.js');

const mm = 1e-3, kNmm = 1e3, G = 9.81;
const KOK3 = 2 * Math.sqrt(3);                       // doğrusal ivmenin Ω_kritik'i

// ═══════════════════ Modeller ═══════════════════

const COMPS = [
  { name: 'Motor', mass: 300, cg: [-0.2, 0, 0.4], I: [[20, 0, 0], [0, 40, 0], [0, 0, 35]], pointMass: false },
  { name: 'Şanzıman', mass: 150, cg: [0.4, 0, 0.3], I: [[8, 0, 0], [0, 20, 0], [0, 0, 18]], pointMass: false },
];
const POS = [['Sağ Ön', -150, 250, 100], ['Sol Ön', -150, -250, 100],
             ['Sağ Arka', 500, 250, 120], ['Sol Arka', 500, -250, 120]];
// Sertleşen düşey yasa F = k0·x + c3·x³ (x mm, F N) — mount-nonlinear-transient ile aynı
const FIT_Z = { form: 'poly', k0: 500, c3: 6.0, c5: 0 };
function takozlar(egri) {
  return POS.map((p) => {
    const t = { name: p[0], pos: [p[1] * mm, p[2] * mm, p[3] * mm],
                kstat: [800 * kNmm, 800 * kNmm, 500 * kNmm], kdyn: [1200 * kNmm, 1200 * kNmm, 800 * kNmm] };
    if (egri) t.fits = { z: FIT_Z };
    return t;
  });
}
const MP = core.combineMassProps(COMPS);
const M6 = core.buildM6(MP.m, MP.I_G);
const LC1 = { name: 'Static', n: [0, 0, -1], T: [0, 0, 0] };

// Lineer montaj (mount-shock ile aynı). Statik sehim 3,4 / 1,0 mm — durdurucudan
// uzak; büyük darbede ±15 mm'ye oturur (k_stop = 100·k_z).
const LIN = takozlar(false);
const LIN_STAT = core.solveCase(core.buildK(LIN, MP.cg, false), LIN, MP.cg, MP.m, G, LC1);
const LIN_DAMP = core.mountDamping(LIN, core.mountLoadShares(LIN_STAT, G), 0.02);
// Sertleşen eğrili montaj — statik denge çevresinde, tanjant tabanlı sönüm
const EGRI = takozlar(true);
const EGRI_STAT = core.solveCaseNL(EGRI, MP.cg, MP.m, G, LC1, { useStop: true });
const EGRI_KB = core.mountTangentKdyn(EGRI, MP.cg, EGRI_STAT.q);
const EGRI_DAMP = core.mountDamping(EGRI, core.mountLoadShares(EGRI_STAT, G), 0.02, EGRI_KB);

const sok = (mounts, damping, o) => core.shockResponse(mounts, MP.cg, M6, damping,
  Object.assign({ dir: 2, aG: 3, dur: 0.020, g: G }, o));
const SENARYO = {
  lineer: (o) => sok(LIN, LIN_DAMP, o),
  egri: (o) => sok(EGRI, EGRI_DAMP, Object.assign({ aG: 5, useStop: true, q0: EGRI_STAT.q }, o)),
  durdurucu: (o) => sok(LIN, LIN_DAMP, Object.assign({ aG: 20, useStop: true, q0: LIN_STAT.q }, o)),
};
// Takozların TOPLAM düşey sehiminin en büyüğü [m] (δz = u_z + θx·d_y − θy·d_x)
const toplamDz = (r, mounts) => mounts.map((t) => {
  const d = [0, 1, 2].map((j) => t.pos[j] - MP.cg[j]);
  return Math.max(...r.q.map((q) => Math.abs(r.q0[2] + q[2] + (r.q0[3] + q[3]) * d[1] - (r.q0[4] + q[4]) * d[0])));
});

// Ayrışık zıplama kutusu (mount-dogrulama-sok S2'nin kutusu, SI): simetrik dörtlü,
// takozlar ağırlık merkezi düzleminde, zıplama EN YÜKSEK mod → Δt = 1/(N·f_zıplama),
// Ω = ω·Δt = 2π/N tam. ζ = 0: darbe sonrası salınımın sönümü YALNIZ entegratörün.
function kutu(kz) {
  const m = 1200, cg = [0.3, 0.02, 0.65], a = 1.1, b = 0.7, c = 0.8;
  const I = [[m * (b * b + c * c) / 12, 0, 0], [0, m * (a * a + c * c) / 12, 0], [0, 0, m * (a * a + b * b) / 12]];
  const mp = core.combineMassProps([{ name: 'Kutu', mass: m, cg, I, pointMass: false }]);
  const kyan = (kz > 1e7) ? 1e3 : 3e5;
  const mounts = [[-1, 1], [-1, -1], [1, 1], [1, -1]].map((s, i) => ({ name: 'T' + i,
    pos: [cg[0] + s[0] * 0.3, cg[1] + s[1] * 0.2, cg[2]], kstat: [kyan, kyan, kz], kdyn: [kyan, kyan, kz] }));
  return { m, mp, M6: core.buildM6(mp.m, mp.I_G), mounts, sifir: mounts.map(() => ({ c: [0, 0, 0] })),
           w: Math.sqrt(4 * kz / m) };
}

// İki çözümün q, q̇, takoz kuvveti ve sehimindeki en büyük göreli fark.
function farkMaks(a, b) {
  let enb = 0;
  const kiyas = (x, y) => {
    let s = 0, d = 0;
    x.forEach((v, i) => { s = Math.max(s, Math.abs(v)); d = Math.max(d, Math.abs(v - y[i])); });
    if (s > 0) enb = Math.max(enb, d / s);
  };
  expect(b.t.length).toBe(a.t.length);
  for (let k = 0; k < 6; k++) {
    kiyas(a.q.map((v) => v[k]), b.q.map((v) => v[k]));
    kiyas(a.qd.map((v) => v[k]), b.qd.map((v) => v[k]));
  }
  a.per.forEach((p, i) => { kiyas(p.f, b.per[i].f); kiyas(p.d, b.per[i].d); });
  kiyas(a.dTotMax, b.dTotMax);
  return enb;
}
const sonlu = (r) => r.q.every((q) => q.every(Number.isFinite)) && r.dTotMax.every(Number.isFinite);

// Literatürün parametre formülleri — çekirdeğin eşlemesinden BAĞIMSIZ yazılır.
const LIT = {
  'newmark-ort': () => ({ alfaM: 0, alfaF: 0, beta: 1 / 4, gamma: 1 / 2 }),
  'newmark-dogrusal': () => ({ alfaM: 0, alfaF: 0, beta: 1 / 6, gamma: 1 / 2 }),
  // HHT (1977): γ = (1 − 2α)/2, β = (1 − α)²/4; denklem t_{n+1+α}'da → αf = −α
  hht: (o) => ({ alfaM: 0, alfaF: -o.alfa, beta: (1 - o.alfa) ** 2 / 4, gamma: (1 - 2 * o.alfa) / 2 }),
  // Chung–Hulbert (1993) eş. 25–26
  'gen-alfa': (o) => {
    const r = o.rhoInf, am = (2 * r - 1) / (r + 1), af = r / (r + 1);
    return { alfaM: am, alfaF: af, beta: (1 - am + af) ** 2 / 4, gamma: 0.5 - am + af };
  },
};

// ═══════════════════════════════════════════════════════════════════════════

describe('1 · VARSAYILAN DEĞİŞMEDİ — eski yol birebir', () => {
  test.each(Object.keys(SENARYO))('%s: seçeneksiz = açık newmark-ort = HHT α = 0 (göreli 1e-12)', (ad) => {
    const a = SENARYO[ad]({});
    const b = SENARYO[ad]({ entegrator: 'newmark-ort' });
    const c = SENARYO[ad]({ entegrator: 'hht', alfa: 0 });
    expect(farkMaks(a, b)).toBeLessThanOrEqual(1e-12);
    expect(farkMaks(a, c)).toBeLessThanOrEqual(1e-12);
    expect(a.newtonIters).toBe(b.newtonIters);
    expect(a.newtonIters).toBe(c.newtonIters);
    expect(a.dt).toBe(b.dt);
  });

  test('çıktı entegratörü, parametreleri ve kısıt bayrağını taşıyor — eski alanlar yerinde', () => {
    const r = SENARYO.lineer({});
    expect(r.entegrator).toBe('newmark-ort');
    expect(r.param).toEqual({ alfaM: 0, alfaF: 0, beta: 0.25, gamma: 0.5, rhoInf: 1 });
    expect(r.adimPeriyot).toBe(40);
    expect(r.dtKisit).toBe(false);
    expect(r.kararli).toBe(true);
    ['t', 'a', 'q', 'qd', 'per', 'dMax', 'dTotMax', 'dir', 'aPeak', 'dur', 'dt', 'tEnd', 'nonlinear',
     'useStop', 'q0', 'd0', 'stopHit', 'converged', 'newtonIters'].forEach((k) => expect(r).toHaveProperty(k));
  });

  test('HHT α = 0\'da αf +0 (−0 değil): parametreler ortalama ivmenin kendisi', () => {
    const P = core.entegratorParam('hht', { alfa: 0 });
    expect(Object.is(P.alfaF, 0)).toBe(true);
    expect([P.alfaM, P.alfaF, P.beta, P.gamma, P.rhoInf]).toEqual([0, 0, 0.25, 0.5, 1]);
  });
});

describe('2 · ÖZEL HÂL KİMLİKLERİ', () => {
  test.each([
    ['newmark-ort', {}], ['newmark-dogrusal', {}],
    ['hht', { alfa: -0.05 }], ['hht', { alfa: -0.2 }], ['hht', { alfa: -1 / 3 }],
    ['gen-alfa', { rhoInf: 0 }], ['gen-alfa', { rhoInf: 0.8 }], ['gen-alfa', { rhoInf: 1 }],
  ])('%s %j — eşleme literatürün formülü', (ad, o) => {
    const P = core.entegratorParam(ad, o), L = LIT[ad](o);
    ['alfaM', 'alfaF', 'beta', 'gamma'].forEach((k) => expect(P[k]).toBeCloseTo(L[k], 14));
    expect(P.kosullu).toBe(ad === 'newmark-dogrusal');
  });

  test('gen-α ρ∞ = ½ ≡ HHT α = −⅓: dört parametre birebir, çözüm birebir', () => {
    const g = core.entegratorParam('gen-alfa', { rhoInf: 0.5 });
    const h = core.entegratorParam('hht', { alfa: -1 / 3 });
    ['alfaM', 'alfaF', 'beta', 'gamma'].forEach((k) => expect(g[k]).toBe(h[k]));
    expect(g.rhoInf).toBeCloseTo(h.rhoInf, 14);
    ['lineer', 'egri', 'durdurucu'].forEach((ad) => {
      const a = SENARYO[ad]({ entegrator: 'gen-alfa', rhoInf: 0.5 });
      const b = SENARYO[ad]({ entegrator: 'hht', alfa: -1 / 3 });
      expect(farkMaks(a, b)).toBeLessThanOrEqual(1e-12);
    });
  });

  test('gen-α ρ∞ = 1 (αm = αf = ½): asıl kökler ortalama ivme Newmark\'ınkiler, sahte kök −1', () => {
    const g = core.entegratorParam('gen-alfa', { rhoInf: 1 });
    expect([g.alfaM, g.alfaF, g.beta, g.gamma]).toEqual([0.5, 0.5, 0.25, 0.5]);
    const n = core.entegratorParam('newmark-ort');
    [0.05, Math.PI / 20, 0.7, 2, 10].forEach((W) => {
      const Yg = core.entegratorYukseltme(g, W, 0), Yn = core.entegratorYukseltme(n, W, 0);
      expect(Yg.genlik).toBeCloseTo(1, 12);
      expect(Yg.OmegaBar).toBeCloseTo(Yn.OmegaBar, 12);
      expect(Yg.parazit).toBeCloseTo(-1, 12);
      expect(Yn.parazit).toBeCloseTo(0, 12);              // Newmark'ta sahte kök 0
    });
  });
});

describe('3 · KURAM — adım büyütme matrisinin spektral yarıçapı', () => {
  test.each([-0.05, -0.1, -0.2, -1 / 3])('HHT α = %s: Ω → ∞\'da ρ = (1+α)/(1−α)', (a) => {
    const P = core.entegratorParam('hht', { alfa: a }), kur = (1 + a) / (1 - a);
    expect(P.rhoInf).toBeCloseTo(kur, 14);
    expect(Math.abs(core.entegratorYukseltme(P, Infinity, 0).rho - kur)).toBeLessThan(1e-6);
    const yaklas = [1e2, 1e4, 1e6].map((W) => Math.abs(core.entegratorYukseltme(P, W, 0).rho - kur));
    expect(yaklas[2]).toBeLessThan(1e-4);
    expect(yaklas[1]).toBeLessThan(yaklas[0]);           // limite TEKDÜZE yaklaşıyor
    expect(yaklas[2]).toBeLessThan(yaklas[1]);
  });

  test.each([0, 0.3, 0.6, 0.8, 1])('gen-α ρ∞ = %s: Ω → ∞\'da spektral yarıçap ρ∞', (r) => {
    const P = core.entegratorParam('gen-alfa', { rhoInf: r });
    // Ω = ∞'da üç kök −ρ∞'da çakışır (üçlü kök: yuvarlama ε^⅓ ≈ 6·10⁻⁶ büyür)
    expect(Math.abs(core.entegratorYukseltme(P, Infinity, 0).rho - r)).toBeLessThan(1e-5);
    expect(Math.abs(core.entegratorYukseltme(P, 1e6, 0).rho - r)).toBeLessThan(2e-4);
  });

  test('newmark-ort: her Ω\'da ρ = 1, sönüm 0, periyot uzaması Ω/(2·atan(Ω/2)) − 1', () => {
    const P = core.entegratorParam('newmark-ort');
    [0.01, Math.PI / 20, 0.5, 2, 20, 1e4, Infinity].forEach((W) => {
      expect(core.entegratorYukseltme(P, W, 0).rho).toBeCloseTo(1, 12);
    });
    [0.01, Math.PI / 20, Math.PI / 4, 1, 2, 5].forEach((W) => {
      const Y = core.entegratorYukseltme(P, W, 0);
      expect(Math.abs(Y.xiBar)).toBeLessThan(1e-12);
      // mount-dogrulama-sok S2'nin ölçtüğü T̄ = π·Δt/atan(ω·Δt/2) ile aynı bağıntı
      expect(Y.periyotUzama).toBeCloseTo(W / (2 * Math.atan(W / 2)) - 1, 12);
    });
  });

  test('newmark-dogrusal: Ω < 2√3\'te ρ = 1, Ω > 2√3\'te ρ > 1 (kararsız), Ω → ∞\'da 2 + √3', () => {
    const P = core.entegratorParam('newmark-dogrusal');
    expect(P.OmegaKrit).toBeCloseTo(KOK3, 14);
    [0.5, 2, 3.4, KOK3 * (1 - 1e-6)].forEach((W) => {
      expect(core.entegratorYukseltme(P, W, 0).rho).toBeLessThanOrEqual(1 + 1e-12);
    });
    expect(core.entegratorYukseltme(P, KOK3 * 1.01, 0).rho).toBeGreaterThan(1.01);
    expect(core.entegratorYukseltme(P, 4, 0).rho).toBeGreaterThan(1.5);
    // Limit matrisin kökleri 0 ve −2 ± √3
    expect(core.entegratorYukseltme(P, Infinity, 0).rho).toBeCloseTo(2 + Math.sqrt(3), 10);
  });

  test('sönüm yöne uygun: HHT |α| ile, gen-α ρ∞ düştükçe artıyor; Ω → 0\'da sönüm yok', () => {
    const hht = [0, -0.05, -0.1, -0.2, -1 / 3].map((a) =>
      core.entegratorYukseltme(core.entegratorParam('hht', { alfa: a }), 0.5, 0).xiBar);
    const gen = [1, 0.9, 0.8, 0.5, 0].map((r) =>
      core.entegratorYukseltme(core.entegratorParam('gen-alfa', { rhoInf: r }), 0.5, 0).xiBar);
    [hht, gen].forEach((s) => {
      expect(Math.abs(s[0])).toBeLessThan(1e-12);
      for (let i = 1; i < s.length; i++) expect(s[i]).toBeGreaterThan(s[i - 1]);
    });
    // İkinci mertebe doğruluk: küçük Ω'da algoritmik sönüm Ω'yla birlikte söner
    const P = core.entegratorParam('hht', { alfa: -0.05 });
    expect(core.entegratorYukseltme(P, 1e-3, 0).xiBar).toBeLessThan(1e-4);
  });

  test('fiziksel sönüm: Ω → 0\'da her yöntemin ξ̄\'sı girilen ξ, periyodu tam periyot', () => {
    ['newmark-ort', 'newmark-dogrusal', 'hht', 'gen-alfa'].forEach((ad) => {
      const Y = core.entegratorYukseltme(core.entegratorParam(ad), 1e-3, 0.05);
      expect(Y.xiBar).toBeCloseTo(0.05, 6);
      expect(Math.abs(Y.periyotUzama)).toBeLessThan(1e-6);
    });
  });

  test('Ω → 0\'da gen-α\'nın sahte kökü αm/(αm − 1)', () => {
    [0, 0.5, 0.8, 1].forEach((r) => {
      const P = core.entegratorParam('gen-alfa', { rhoInf: r });
      expect(core.entegratorYukseltme(P, 1e-4, 0).parazit).toBeCloseTo(P.alfaM / (P.alfaM - 1), 8);
    });
  });

  test('geçersiz girdi çökertmez', () => {
    expect(core.entegratorYukseltme(core.entegratorParam('hht'), -1, 0)).toBeNull();
    expect(core.entegratorYukseltme(core.entegratorParam('hht'), NaN, 0)).toBeNull();
    expect(core.entegratorYukseltme(null, 1, 0).rho).toBeCloseTo(1, 12);   // varsayılan newmark-ort
  });
});

describe('4 · ÖLÇÜLEN = KURAM — ayrışık zıplamanın serbest salınımı (ζ = 0)', () => {
  // Darbe (1 g, 150 ms) yalnız zıplamayı uyarır; sonrasında sistem korunumlu ve
  // q_z TEK serbestlikli sayısal yinelemedir: x_{n+1} = 2|λ|cos Ω̄·x_n − |λ|²·x_{n−1}
  // (sahte kök birkaç adımda söner). ÖLÇÜM: serbest salınımın örnekleri bu iki
  // terimli yinelemeye en küçük kareyle oturtulur → adım başına genlik oranı
  // √(−c₂) ve faz acos(c₁/(2√(−c₂))). Periyot ayrıca sıfır geçişlerinden.
  // HAKEM: entegratorYukseltme, parametreler LİT'ten (çekirdeğin eşlemesinden değil).
  const K = kutu(1e6);
  const N = 8;
  function olc(ad, o) {
    const r = core.shockResponse(K.mounts, K.mp.cg, K.M6, K.sifir,
      Object.assign({ dir: 2, aG: 1, dur: 0.15, g: G, adimPeriyot: N, entegrator: ad }, o));
    const bas = Math.ceil(0.15 / r.dt) + 40;            // darbe + sahte kökün sönmesi
    const x = r.q.slice(bas).map((q) => q[2]);
    let s11 = 0, s12 = 0, s22 = 0, b1 = 0, b2 = 0;
    for (let n = 1; n < x.length - 1; n++) {
      s11 += x[n] * x[n]; s12 += x[n] * x[n - 1]; s22 += x[n - 1] * x[n - 1];
      b1 += x[n] * x[n + 1]; b2 += x[n - 1] * x[n + 1];
    }
    const det = s11 * s22 - s12 * s12;
    const c1 = (b1 * s22 - b2 * s12) / det, c2 = (s11 * b2 - s12 * b1) / det;
    const genlik = Math.sqrt(-c2), faz = Math.acos(c1 / (2 * genlik));
    const zc = [];
    for (let i = bas + 1; i < r.t.length; i++) {
      const a = r.q[i - 1][2], b = r.q[i][2];
      if ((a < 0) !== (b < 0)) zc.push(r.t[i - 1] + (r.t[i] - r.t[i - 1]) * a / (a - b));
    }
    const periyot = 2 * (zc[zc.length - 1] - zc[0]) / (zc.length - 1);
    return { r, genlik, faz, periyot, nGecis: zc.length, nOrnek: x.length };
  }

  test('kurgu: zıplama en yüksek mod, Ω = 2π/8, kayıt her adımda, öteki serbestlikler sıfır', () => {
    const o = olc('newmark-ort', {});
    expect(K.w * o.r.dt).toBeCloseTo(2 * Math.PI / N, 9);
    expect(o.r.t.length).toBe(Math.ceil(o.r.tEnd / o.r.dt) + 1);
    expect(o.nOrnek).toBeGreaterThan(60);
    expect(o.nGecis).toBeGreaterThan(15);
    o.r.q.forEach((q) => [0, 1, 3, 4, 5].forEach((j) => expect(Math.abs(q[j])).toBeLessThan(1e-15)));
  });

  test.each([
    ['newmark-ort', {}], ['newmark-dogrusal', {}],
    ['hht', { alfa: -0.05 }], ['hht', { alfa: -1 / 3 }],
    ['gen-alfa', { rhoInf: 0.8 }], ['gen-alfa', { rhoInf: 0 }],
  ])('%s %j — adım başına genlik oranı ve periyot kapalı formla örtüşüyor', (ad, o) => {
    const m = olc(ad, o);
    const W = K.w * m.r.dt;
    const Y = core.entegratorYukseltme(LIT[ad](o), W, 0);
    expect(Math.abs(m.genlik / Y.genlik - 1)).toBeLessThan(1e-9);    // ölçülen ~10⁻¹⁵
    expect(Math.abs(m.faz / Y.OmegaBar - 1)).toBeLessThan(1e-9);
    // Sıfır geçişleri 8 örnek/periyotta doğrusal ara değerle — kaba ama bağımsız
    expect(Math.abs(m.periyot / (2 * Math.PI / K.w * (1 + Y.periyotUzama)) - 1)).toBeLessThan(1e-3);
    if (ad === 'hht' || ad === 'gen-alfa') expect(Y.genlik).toBeLessThan(1 - 2e-4);   // sönüm ölçülebilir
    else expect(Y.genlik).toBeCloseTo(1, 12);
  });

  test('örnek sayılar (Ω = π/4): HHT α = −0,05 adım başına %0,158 söner, gen-α ρ∞ = 0,8 %0,022', () => {
    const h = olc('hht', { alfa: -0.05 }), g = olc('gen-alfa', { rhoInf: 0.8 });
    expect(1 - h.genlik).toBeCloseTo(1.578e-3, 5);
    expect(1 - g.genlik).toBeCloseTo(2.200e-4, 6);
    // ortalama ivmenin periyot uzaması %4,94; HHT'ninki %5,54
    const W = Math.PI / 4;
    expect(core.entegratorYukseltme(LIT['newmark-ort'](), W, 0).periyotUzama).toBeCloseTo(0.04945, 4);
    expect(core.entegratorYukseltme(LIT.hht({ alfa: -0.05 }), W, 0).periyotUzama).toBeCloseTo(0.05537, 4);
  });
});

describe('5 · KARARLILIK KISITI — koşullu yöntemde Δt kendiliğinden küçülür', () => {
  const dogrusal = core.entegratorParam('newmark-dogrusal');
  const SINIR = 0.9 * KOK3;

  describe('Newton yolu: durdurucu teması en yüksek frekansı ~8 kat artırır', () => {
    // Statik denge durdurucudan uzak (a priori sınır kısıtlamaz: Ω_taban = 2π/8);
    // 150 ms'lik 60 g darbede dört takoz da ±15 mm'ye oturur ve orada kalır
    // (k_stop = 100·k_z). İzleme tanjantın sınırı aştığını görür → Δt küçülür,
    // koşu baştan. Kısıtsız aynı koşu 4,6·10²⁷ mm'ye ıraksıyor, Newton
    // yakınsamıyordu (ölçüldü) — bayraksız.
    const D5 = core.mountDamping(LIN, core.mountLoadShares(LIN_STAT, G), 0.05);
    const o = { aG: 60, dur: 0.150, useStop: true, q0: LIN_STAT.q, adimPeriyot: 8 };
    const fHi = Math.max(...core.solveModal(core.buildK(LIN, MP.cg, true), M6, LIN, MP.cg).map((x) => x.f_Hz));
    const dtTaban = Math.min(0.150 / 8, 1 / (8 * fHi));
    const kTam = LIN.map((t) => [t.kdyn[0], t.kdyn[1], t.kdyn[2] + core.STOP_STIFF_RATIO * t.kstat[2]]);
    const wTam = Math.sqrt(Math.max(...core.generalizedEigenSym(core.buildKfromBasis(LIN, MP.cg, kTam), M6).lambda));
    const d = sok(LIN, D5, Object.assign({ entegrator: 'newmark-dogrusal' }, o));
    const n = sok(LIN, D5, Object.assign({ entegrator: 'newmark-ort' }, o));
    const ref = sok(LIN, D5, Object.assign({}, o, { adimPeriyot: 400 }));   // yakınsamış

    test('kurgu: statik denge durdurucudan uzak, darbede dört takoz da oturuyor', () => {
      toplamDz({ q: [[0, 0, 0, 0, 0, 0]], q0: LIN_STAT.q }, LIN).forEach((dz) => expect(dz).toBeLessThan(core.STOP_GAP_M));
      toplamDz(d, LIN).forEach((dz) => expect(dz).toBeGreaterThan(core.STOP_GAP_M));
      expect(2 * Math.PI * fHi * dtTaban).toBeCloseTo(2 * Math.PI / 8, 9);
    });

    test('kısıtsız Δt\'de tam temasın Ω\'sı 2√3\'ü aşardı — kuram adım başına ×1,4 büyüme der', () => {
      expect(wTam * dtTaban).toBeGreaterThan(KOK3);
      expect(core.entegratorYukseltme(dogrusal, wTam * dtTaban, 0).rho).toBeGreaterThan(1.3);
    });

    test('Δt sınırın altına iniyor, dtKisit işaretli; tam temas artık kararlı bölgede', () => {
      expect(d.dtKisit).toBe(true);
      expect(d.kararli).toBe(true);
      expect(d.dt).toBeLessThan(dtTaban);
      expect(wTam * d.dt).toBeLessThanOrEqual(SINIR);
      expect(core.entegratorYukseltme(dogrusal, wTam * d.dt, 0).rho).toBeLessThanOrEqual(1 + 1e-12);
    });

    test('yanıt patlamıyor: sonlu, yakınsamış, sönümle iniyor, tepe yakınsamış çözümün %25\'i içinde', () => {
      expect(sonlu(d)).toBe(true);
      expect(d.converged).toBe(true);
      expect(d.stopHit).toBe(true);
      // Kaydın son beşte biri tepenin yarısının altında (ölçülen %5)
      const kuyruk = (r) => Math.max(...r.dMax.slice(Math.floor(r.dMax.length * 0.8)));
      expect(kuyruk(d)).toBeLessThan(0.5 * Math.max(...d.dMax));
      // Kaba adımda (temasın bir periyodu ~2,5 adım) doğruluk değil kararlılık
      // sorulur: ölçülen 23,24 ↔ 19,67 mm (kısıtsız: 4,6·10²⁷ mm)
      expect(Math.abs(Math.max(...d.dTotMax) / Math.max(...ref.dTotMax) - 1)).toBeLessThan(0.25);
    });

    test('kısıt yönteme özgü: aynı ayarda newmark-ort Δt\'ye dokunmaz', () => {
      expect(n.dtKisit).toBe(false);
      expect(n.dt).toBe(dtTaban);
      expect(n.kararli).toBe(true);
    });

    test('varsayılan adımda (N = 40) tam temas da sınırın içinde — kısıt devreye girmez', () => {
      const r = sok(LIN, D5, Object.assign({ entegrator: 'newmark-dogrusal' }, o, { adimPeriyot: 40 }));
      expect(wTam * r.dt).toBeLessThan(SINIR);
      expect(r.dtKisit).toBe(false);
      expect(r.stopHit).toBe(true);
    });
  });

  describe('lineer yol: 40 000 adım sınırı kararlılıktan önce gelirse', () => {
    // 10 kHz zıplama + 0,3 Hz yanal öteleme: kayıt 3 s, doğruluğun adım sınırında
    // Δt = 7,5·10⁻⁵ s → Ω = 4,71. Ortalama ivme için sorun değil; doğrusal ivme
    // orada her adımda ~2 kat büyürdü. Kısıt adım sınırını aşar (kararlılık için).
    const K = kutu(1200 * (2 * Math.PI * 1e4) ** 2 / 4);
    const fHi = Math.max(...core.solveModal(core.buildK(K.mounts, K.mp.cg, true), K.M6, K.mounts, K.mp.cg).map((x) => x.f_Hz));
    const kos = (ad) => core.shockResponse(K.mounts, K.mp.cg, K.M6, K.sifir,
      { dir: 2, aG: 3, dur: 0.020, g: G, entegrator: ad });

    test('newmark-ort adım sınırında kalır (koşulsuz kararlı — Ω = 4,71 sorun değil)', () => {
      const r = kos('newmark-ort');
      expect(Math.round(r.tEnd / r.dt)).toBe(40000);
      expect(2 * Math.PI * fHi * r.dt).toBeGreaterThan(KOK3);
      expect(r.dtKisit).toBe(false);
      expect(sonlu(r)).toBe(true);
    });

    test('newmark-dogrusal Δt\'yi sınıra çeker, 40 000 adımı aşar, yanıt yarı-statik', () => {
      const r = kos('newmark-dogrusal');
      expect(r.dtKisit).toBe(true);
      expect(r.kararli).toBe(true);
      expect(2 * Math.PI * fHi * r.dt).toBeCloseTo(SINIR, 9);
      expect(Math.ceil(r.tEnd / r.dt)).toBeGreaterThan(40000);
      expect(sonlu(r)).toBe(true);
      // 20 ms'lik darbe 10 kHz'lik sistem için yarı-statik: tepe ≈ 3g/ω²
      const pk = Math.max(...r.q.map((q) => Math.abs(q[2])));
      expect(pk / (3 * G / (K.w * K.w))).toBeGreaterThan(0.98);
      expect(pk / (3 * G / (K.w * K.w))).toBeLessThan(1.02);
    });

    test('bütçe yetmezse (40 kHz: 200 000 adımın üstü) sonuç BAYRAKLI — sessiz değil', () => {
      const K4 = kutu(1200 * (2 * Math.PI * 4e4) ** 2 / 4);
      const r = core.shockResponse(K4.mounts, K4.mp.cg, K4.M6, K4.sifir,
        { dir: 2, aG: 3, dur: 0.020, g: G, entegrator: 'newmark-dogrusal' });
      expect(r.dtKisit).toBe(true);
      expect(r.kararli).toBe(false);
      expect(Math.round(r.tEnd / r.dt)).toBe(200000);
    });
  });
});

describe('6 · NEWTON YOLU — eğri ve durdurucuda her entegratör', () => {
  const ENT = [['newmark-ort', {}], ['newmark-dogrusal', {}], ['hht', {}], ['gen-alfa', {}]];
  const egriRef = SENARYO.egri({});
  const durRef = SENARYO.durdurucu({});

  test.each(ENT)('%s — sertleşen eğri: yakınsıyor, adım başına 1–6 iterasyon, tepe %%1 içinde', (ad, o) => {
    const r = SENARYO.egri(Object.assign({ entegrator: ad }, o));
    expect(r.nonlinear).toBe(true);
    expect(r.converged).toBe(true);
    expect(sonlu(r)).toBe(true);
    const nStep = Math.round(r.tEnd / r.dt);
    expect(r.newtonIters / nStep).toBeGreaterThan(1);
    expect(r.newtonIters / nStep).toBeLessThan(6);
    expect(Math.abs(Math.max(...r.dMax) / Math.max(...egriRef.dMax) - 1)).toBeLessThan(0.01);
  });

  test.each(ENT)('%s — durdurucu: yakınsıyor, temas işaretli, tepe %%1 içinde', (ad, o) => {
    const r = SENARYO.durdurucu(Object.assign({ entegrator: ad }, o));
    expect(r.converged).toBe(true);
    expect(r.stopHit).toBe(true);
    expect(sonlu(r)).toBe(true);
    expect(Math.abs(Math.max(...r.dTotMax) / Math.max(...durRef.dTotMax) - 1)).toBeLessThan(0.01);
  });

  test.each([
    ['newmark-ort', {}], ['newmark-dogrusal', {}], ['hht', { alfa: -0.05 }], ['hht', { alfa: -1 / 3 }],
    ['gen-alfa', { rhoInf: 0.8 }], ['gen-alfa', { rhoInf: 0 }],
  ])('%s %j — lineer yasada Newton yolu lineer yolun KENDİSİ (iç kuvvetin ortalaması dâhil)', (ad, o) => {
    // (1−αf)Ψ(q_{n+1}) + αfΨ(qₙ) lineer yasada K·[(1−αf)q_{n+1} + αf·qₙ]: iki yol aynı
    // denklemi çözer. Ortalamanın Ψ(qₙ)'si yanlış adımdan okunsaydı ayrışırlardı.
    [40, 8].forEach((N) => {
      const x = Object.assign({ entegrator: ad, adimPeriyot: N }, o);
      const a = SENARYO.lineer(x), b = SENARYO.lineer(Object.assign({ nonlinear: true }, x));
      expect(a.nonlinear).toBe(false);
      expect(b.nonlinear).toBe(true);
      expect(farkMaks(a, b)).toBeLessThan(1e-9);
    });
  });

  test('newtonMaxIter ve newtonTol bağlı: tek iterasyon sertleşen eğride yakınsamaz, gevşek tolerans iterasyonu azaltır', () => {
    const tek = SENARYO.egri({ newtonMaxIter: 1 });
    expect(tek.converged).toBe(false);                  // dürüst: kırpılmış Newton söyleniyor
    const gevsek = SENARYO.egri({ newtonTol: 1e-4 });
    expect(gevsek.converged).toBe(true);
    expect(gevsek.newtonIters).toBeLessThan(egriRef.newtonIters);
  });
});

describe('7 · AYAR — GECICI_VARSAYILAN + geciciAyar', () => {
  const V = core.GECICI_VARSAYILAN;

  test('varsayılanlar bugünkü sabitler; nesne donmuş', () => {
    expect(core.geciciAyar()).toEqual({ entegrator: 'newmark-ort', alfa: -0.05, rhoInf: 0.8,
      adimPeriyot: 40, newtonTol: 1e-9, newtonMaxIter: 20 });
    expect(Object.isFrozen(V)).toBe(true);
    expect(Object.isFrozen(V.aralik)).toBe(true);
    expect(V.aralik.entegrator).toEqual(['newmark-ort', 'newmark-dogrusal', 'hht', 'gen-alfa']);
    expect(V.aralik.alfa).toEqual([-1 / 3, 0]);
    expect(V.aralik.rhoInf).toEqual([0, 1]);
  });

  test('aralık dışı sınıra kırpılır, tam sayı alanı yuvarlanır', () => {
    const a = core.geciciAyar({ alfa: 0.3, rhoInf: 1.5, adimPeriyot: 2, newtonTol: 1, newtonMaxIter: 500 });
    expect(a.alfa).toBe(0);
    expect(a.rhoInf).toBe(1);
    expect(a.adimPeriyot).toBe(V.aralik.adimPeriyot[0]);
    expect(a.newtonTol).toBe(V.aralik.newtonTol[1]);
    expect(a.newtonMaxIter).toBe(V.aralik.newtonMaxIter[1]);
    const b = core.geciciAyar({ alfa: -0.9, rhoInf: -0.2, adimPeriyot: 1e6, newtonTol: 0, newtonMaxIter: 0 });
    expect(b.alfa).toBe(-1 / 3);
    expect(b.rhoInf).toBe(0);
    expect(b.adimPeriyot).toBe(V.aralik.adimPeriyot[1]);
    expect(b.newtonTol).toBe(V.aralik.newtonTol[0]);
    expect(b.newtonMaxIter).toBe(1);
    expect(core.geciciAyar({ adimPeriyot: 12.6, newtonMaxIter: 7.4 })).toMatchObject({ adimPeriyot: 13, newtonMaxIter: 7 });
    expect(core.geciciAyar({ alfa: -0.1, rhoInf: 0.5 })).toMatchObject({ alfa: -0.1, rhoInf: 0.5 });
  });

  test('bozuk değer ve bilinmeyen ad varsayılana düşer; makine biçimli yazı okunur', () => {
    const a = core.geciciAyar({ entegrator: 'rk4', alfa: 'abc', rhoInf: NaN, adimPeriyot: null,
      newtonTol: Infinity, newtonMaxIter: true });
    expect(a).toEqual(core.geciciAyar());
    expect(core.geciciAyar({ entegrator: 'HHT' }).entegrator).toBe('newmark-ort');
    expect(core.geciciAyar({ alfa: '0,1' }).alfa).toBe(-0.05);          // virgüllü yazı makine biçimi değil
    expect(core.geciciAyar({ alfa: '-0.1', adimPeriyot: '80' })).toMatchObject({ alfa: -0.1, adimPeriyot: 80 });
    expect(core.geciciAyar(null)).toEqual(core.geciciAyar());
    expect(core.geciciAyar('hht')).toEqual(core.geciciAyar());
    const ham = { alfa: 5 };
    core.geciciAyar(ham);
    expect(ham).toEqual({ alfa: 5 });                    // girdi değişmez
  });

  test('shockResponse ayarı kırparak kullanır: bilinmeyen ad newmark-ort, aralık dışı α = 0 newmark-ort', () => {
    const a = SENARYO.lineer({});
    const b = SENARYO.lineer({ entegrator: 'rk4' });
    const c = SENARYO.lineer({ entegrator: 'hht', alfa: 0.5 });
    expect(b.entegrator).toBe('newmark-ort');
    expect(c.entegrator).toBe('hht');
    expect(farkMaks(a, b)).toBe(0);
    expect(farkMaks(a, c)).toBe(0);
    expect(SENARYO.lineer({ adimPeriyot: 1 }).adimPeriyot).toBe(V.aralik.adimPeriyot[0]);
  });

  test('adimPeriyot Δt\'yi belirler: Δt = min(τ/N, 1/(N·f_en yüksek))', () => {
    const fHi = Math.max(...core.solveModal(core.buildK(LIN, MP.cg, true), M6, LIN, MP.cg).map((x) => x.f_Hz));
    [10, 40, 80].forEach((N) => {
      const r = SENARYO.lineer({ adimPeriyot: N });
      expect(r.adimPeriyot).toBe(N);
      expect(r.dt).toBeCloseTo(Math.min(0.020 / N, 1 / (N * fHi)), 15);
    });
  });
});
