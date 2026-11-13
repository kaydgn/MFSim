/**
 * Kesin sönümlü (kompleks) modal çözüm — durum uzayı
 * ──────────────────────────────────────────────────
 *   (λ²M + λC + K)φ = 0   ⇔   A·v = λv ,  A = [[0, I], [−M⁻¹K, −M⁻¹C]]
 *   λ = σ ± iω_d  →  ω_n = |λ| ,  ζ = −σ/|λ|
 *
 * NEYİ KİLİTLER: (1) özdeğer motoru (dengeleme + Hessenberg + Francis çift
 * kaydırmalı QR) kökleri bilinen matrislerde; (2) orantılı sönümde kapalı form —
 * izdüşümün de kesin olduğu tek durum; (3) sönümsüz limitte solveModal'ın kendisi;
 * (4) programın kendi orantısız sönümünde artık, iz ve determinant özdeşlikleri ve
 * izdüşümle farkın ζ² ile büyümesi; (5) aşırı sönüm, çakışık mod ve tekil M.
 *
 * HATA SINIFI NEDEN SESSİZ: modal ζ bir tablo sayısıdır, program çalışmaya devam
 * eder. Hafif sönümde (ζ = 0,02) kesin değer izdüşümle zaten 2·10⁻⁵ içinde örtüşür:
 * yanlış bir özvektör, yanlış eşlenmiş bir mod ya da yanlış eşlenmiş aşırı sönümlü
 * kök çifti "makul" bir tablo üretir ve izdüşüme bakılarak YAKALANMAZ. Hakem kapalı
 * formdur, özdeşliklerdir ve özdeğer denkleminin artığıdır — bu dosyadaki hakem
 * hesapları (determinant, iz, MAC, artık) çekirdeği çağırmaz.
 *
 * Kapının düşebildiği ölçüldü (işaret geçici olarak ters çevrildi): QR'ın kaydırma
 * polinomu (r·s − w) → 18/26 kırmızı — yakınsamaz ve null döner, yanlış sayı vermez
 * (her adım benzerlik dönüşümü); 2×2 bloğun p'si → 14/26 kırmızı, yanlış kök;
 * ζ = −σ/|λ| → 9/26 kırmızı.
 */

const core = require('../../js/mount-core.js');

const TOL = 1e-9;
const mm = (v) => v / 1000, kN = (v) => v * 1000;
const bagil = (a, b) => Math.abs(a - b) / Math.abs(b);

// ── Hakem yardımcıları (çekirdekten bağımsız) ────────────────────────────────
function gaussCoz(Ain, bin) {                       // kısmi pivotlu Gauss
  const n = Ain.length, A = Ain.map((r) => r.slice()), b = bin.slice();
  for (let k = 0; k < n; k++) {
    let p = k;
    for (let i = k + 1; i < n; i++) if (Math.abs(A[i][k]) > Math.abs(A[p][k])) p = i;
    [A[k], A[p]] = [A[p], A[k]]; [b[k], b[p]] = [b[p], b[k]];
    for (let i = k + 1; i < n; i++) {
      const f = A[i][k] / A[k][k];
      for (let j = k; j < n; j++) A[i][j] -= f * A[k][j];
      b[i] -= f * b[k];
    }
  }
  const x = Array(n).fill(0);
  for (let i = n - 1; i >= 0; i--) {
    let s = b[i];
    for (let j = i + 1; j < n; j++) s -= A[i][j] * x[j];
    x[i] = s / A[i][i];
  }
  return x;
}
function det(Ain) {
  const n = Ain.length, A = Ain.map((r) => r.slice());
  let d = 1;
  for (let k = 0; k < n; k++) {
    let p = k;
    for (let i = k + 1; i < n; i++) if (Math.abs(A[i][k]) > Math.abs(A[p][k])) p = i;
    if (A[p][k] === 0) return 0;
    if (p !== k) { [A[k], A[p]] = [A[p], A[k]]; d = -d; }
    d *= A[k][k];
    for (let i = k + 1; i < n; i++) {
      const f = A[i][k] / A[k][k];
      for (let j = k; j < n; j++) A[i][j] -= f * A[k][j];
    }
  }
  return d;
}
const izMinvC = (M, C) => C.reduce((s, _, j) => s + gaussCoz(M, C.map((r) => r[j]))[j], 0);
// Kompleks vektör [[re, im], …] — M-ağırlıklı MAC ve özdeğer denkleminin artığı.
const cMv = (X, z) => X.map((r) => r.reduce((s, v, j) => [s[0] + v * z[j][0], s[1] + v * z[j][1]], [0, 0]));
const cDot = (a, b) => a.reduce((s, x, i) => [s[0] + x[0] * b[i][0] + x[1] * b[i][1], s[1] + x[0] * b[i][1] - x[1] * b[i][0]], [0, 0]);
const cNorm = (z) => Math.sqrt(z.reduce((s, c) => s + c[0] * c[0] + c[1] * c[1], 0));
function macM(M, u, c) {
  const Mc = cMv(M, c), Mu = cMv(M, u), s = cDot(u, Mc);
  return (s[0] * s[0] + s[1] * s[1]) / (cDot(u, Mu)[0] * cDot(c, Mc)[0]);
}
function artik(M, C, K, lam, phi) {
  const Mp = cMv(M, phi), Cp = cMv(C, phi), Kp = cMv(K, phi);
  const [a, b] = lam, l2 = [a * a - b * b, 2 * a * b];
  const r = Mp.map((m, i) => [l2[0] * m[0] - l2[1] * m[1] + a * Cp[i][0] - b * Cp[i][1] + Kp[i][0],
                              l2[0] * m[1] + l2[1] * m[0] + a * Cp[i][1] + b * Cp[i][0] + Kp[i][1]]);
  const L = Math.hypot(a, b);
  return cNorm(r) / (L * L * cNorm(Mp) + L * cNorm(Cp) + cNorm(Kp));
}
const reel = (v) => v.map((x) => [x, 0]);

// ── Modeller ─────────────────────────────────────────────────────────────────
// ASFAT 8x8 Obüs (ASR-SR-116) — mount-modal-energy.test.js ile aynı girdi.
const ASFAT_C = [
  { name: 'Motor', mass: 1600, cg: [-314.94, -0.127, 857.56].map(mm), I: [[110.7, 0, 0], [0, 260.2, 0], [0, 0, 205.9]], pointMass: false },
  { name: 'Şanzıman', mass: 839, cg: [932.365, -13.003, 700.632].map(mm), I: [[44.6, 0, 0], [0, 97.8, 0], [0, 0, 94.6]], pointMass: false },
  { name: 'Şaft', mass: 16, cg: [2300, 150, 0].map(mm), I: [[0.042, 0, 0], [0, 1.16, 0], [0, 0, 1.16]], pointMass: false },
];
const ON = { s: [1045, 1045, 1800], d: [1045, 1045, 1800] }, AR = { s: [462, 462, 2200], d: [630, 630, 3000] };
const ASFAT_T = [['Ön Sol', -953.45, -50.67, 367, ON], ['Ön Sağ', -953.45, 50.67, 367, ON],
  ['Sol Ön', 535.31, -347.1, 615.77, AR], ['Sağ Ön', 535.31, 347.1, 615.77, AR],
  ['Sol Arka', 636.8, -347.1, 615.77, AR], ['Sağ Arka', 636.8, 347.1, 615.77, AR]]
  .map((h) => ({ name: h[0], pos: [h[1], h[2], h[3]].map(mm), kstat: h[4].s.map(kN), kdyn: h[4].d.map(kN) }));

// Programın kendi kurulumu: statik çözüm → yük payı → c = 2ζ√(k·m_pay) → C = ΣAᵀ·diag(c)·A.
function kur(comps, mounts) {
  const mp = core.combineMassProps(comps);
  const M6 = core.buildM6(mp.m, mp.I_G), K6 = core.buildK(mounts, mp.cg, true);
  const modes = core.solveModal(K6, M6, mounts, mp.cg);
  const stat = core.solveCase(core.buildK(mounts, mp.cg, false), mounts, mp.cg, mp.m, 9.81,
                              { name: 'Static', n: [0, 0, -1], T: [0, 0, 0] });
  const pay = core.mountLoadShares(stat, 9.81);
  const C = (z) => core.buildCdamp(mounts, mp.cg, core.mountDamping(mounts, pay, z));
  return { mp, M6, K6, modes, C };
}
const ASFAT = kur(ASFAT_C, ASFAT_T);
const TTAR = kur(core.ttarComponentsSI(), core.ttarMountsSI());     // atalet çarpımları dolu

// Ayrışık kutu (mount-dogrulama-analitik.test.js B1 · KUTU_EXAMPLE): takozlar ağırlık
// merkezi düzleminde, simetrik → K ve C köşegen, altı mod tek serbestlik.
function kutu(kd, I, Lx, Ly) {
  const m = 1200, cg = [0.3, 0.02, 0.65];
  const comps = [{ name: 'Kutu', mass: m, cg, I: [[I[0], 0, 0], [0, I[1], 0], [0, 0, I[2]]], pointMass: false }];
  const mounts = [[1, 1], [1, -1], [-1, 1], [-1, -1]].map((s, i) => ({ name: 't' + i,
    pos: [cg[0] + s[0] * Lx, cg[1] + s[1] * Ly, cg[2]], kstat: [900e3, 700e3, 400e3], kdyn: kd.slice() }));
  return Object.assign(kur(comps, mounts), { m, kd, I, Lx, Ly });
}
// Kapalı form: ω² = Σk/atalet, c = 2ζ√(k·m/4) her takozda → ζ_mod = Σc·d²/(2ω·atalet).
function kutuKapali(B, z) {
  const { m, kd, I, Lx, Ly } = B, [kx, ky, kz] = kd, Kyaw = kx * Ly * Ly + ky * Lx * Lx;
  return {
    w2: { 'fore-aft': 4 * kx / m, lateral: 4 * ky / m, bounce: 4 * kz / m,
          roll: 4 * kz * Ly * Ly / I[0], pitch: 4 * kz * Lx * Lx / I[1], yaw: 4 * Kyaw / I[2] },
    zeta: { 'fore-aft': z, lateral: z, bounce: z, roll: z * Ly * Math.sqrt(m / I[0]), pitch: z * Lx * Math.sqrt(m / I[1]),
            yaw: z * Math.sqrt(m) * (Math.sqrt(kx) * Ly * Ly + Math.sqrt(ky) * Lx * Lx) / Math.sqrt(I[2] * Kyaw) },
  };
}
const KUTU = kutu([1400e3, 1050e3, 600e3], [113, 185, 170], 0.6, 0.35);

// ═══════════════════ Özdeğer motoru ═══════════════════

describe('hessenbergQR — gerçel, simetrik olmayan matrisin özdeğerleri', () => {
  const enYakin = (ev, kok) => ev.reduce((b, e) => Math.min(b, Math.hypot(e.re - kok[0], e.im - kok[1])), Infinity);

  test('eşlik matrisi: kökleri bilinen 7. derece polinom (3 gerçel + 2 eşlenik çift)', () => {
    const kokler = [[5, 0], [3, 0], [-2, 0], [1, 2], [1, -2], [-0.5, 0.25], [-0.5, -0.25]];
    let c = [[1, 0]];                                  // Π(x − r) katsayıları, en yüksek derece önce
    kokler.forEach(([re, im]) => {
      const y = c.map((z) => z.slice()).concat([[0, 0]]);
      c.forEach((z, i) => { y[i + 1][0] -= re * z[0] - im * z[1]; y[i + 1][1] -= re * z[1] + im * z[0]; });
      c = y;
    });
    const n = kokler.length;
    const E = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (__, j) =>
      (i === 0) ? -c[j + 1][0] : (i === j + 1 ? 1 : 0)));
    const ev = core.hessenbergQR(E);
    expect(ev).toHaveLength(n);
    kokler.forEach((k) => expect(enYakin(ev, k)).toBeLessThan(1e-12));
    ev.forEach((e) => expect(enYakin(kokler.map((k) => ({ re: k[0], im: k[1] })), [e.re, e.im])).toBeLessThan(1e-12));
  });

  test('sabit tohumlu 12×12 rastgele matris: Σλ = iz, Πλ = det, kompleksler eşlenik çift', () => {
    let s = 20261113;
    const rnd = () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296 - 0.5; };
    const R = Array.from({ length: 12 }, () => Array.from({ length: 12 }, rnd));
    const ev = core.hessenbergQR(R);
    expect(ev).toHaveLength(12);
    const iz = R.reduce((t, r, i) => t + r[i], 0);
    const top = ev.reduce((t, e) => [t[0] + e.re, t[1] + e.im], [0, 0]);
    const car = ev.reduce((p, e) => [p[0] * e.re - p[1] * e.im, p[0] * e.im + p[1] * e.re], [1, 0]);
    expect(Math.abs(top[0] - iz)).toBeLessThan(1e-13);
    expect(Math.abs(top[1])).toBeLessThan(1e-13);
    expect(bagil(car[0], det(R))).toBeLessThan(1e-11);
    expect(Math.abs(car[1])).toBeLessThan(1e-11 * Math.abs(car[0]));
    ev.forEach((e, i) => {
      if (e.im > 0) expect(ev[i + 1]).toEqual({ re: e.re, im: -e.im });
    });
    expect(ev.some((e) => e.im !== 0)).toBe(true);             // örnek gerçekten kompleks kök taşıyor
  });

  test('Francis QR\'ın tıkanma örneği — döngüsel permütasyon: istisnai kaydırmayla 12. birim kökler', () => {
    // Alt köşedeki 2×2 blok sıfır kaydırma verir, P² de permütasyon: düz çift kaydırmalı
    // adım matrisi DEĞİŞTİRMEZ. Wilkinson'ın istisnai kaydırması olmadan yakınsamaz.
    const n = 12;
    const P = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (__, j) => (i === (j + 1) % n ? 1 : 0)));
    const ev = core.hessenbergQR(P);
    expect(ev).toHaveLength(n);
    for (let k = 0; k < n; k++) {
      const a = 2 * Math.PI * k / n;
      expect(enYakin(ev, [Math.cos(a), Math.sin(a)])).toBeLessThan(1e-12);
    }
  });

  test('dengeleme: 10¹⁶ ölçek farklı üç köşegenli matris — 2 − √3, 2, 2 + √3', () => {
    // D⁻¹AD = [[1,1,0],[1,2,1],[0,1,3]] (D = diag(1, 10⁸, 10¹⁶)) — yuvarlamasız benzerlik.
    const ev = core.hessenbergQR([[1, 1e8, 0], [1e-8, 2, 1e8], [0, 1e-8, 3]]).map((e) => e.re).sort((a, b) => a - b);
    [2 - Math.sqrt(3), 2, 2 + Math.sqrt(3)].forEach((v, i) => expect(Math.abs(ev[i] - v)).toBeLessThan(1e-13));
  });

  test('geçersiz girdi null — sayı uydurulmaz; sıfır matris sıfır kök', () => {
    expect(core.hessenbergQR([])).toBeNull();
    expect(core.hessenbergQR(null)).toBeNull();
    expect(core.hessenbergQR([[1, 2], [3]])).toBeNull();
    expect(core.hessenbergQR([[1, NaN], [0, 1]])).toBeNull();
    expect(core.hessenbergQR([[0, 0], [0, 0]])).toEqual([{ re: 0, im: 0 }, { re: 0, im: 0 }]);
    expect(core.hessenbergQR([[5]])).toEqual([{ re: 5, im: 0 }]);
  });

  test('girdiyi değiştirmez', () => {
    const A = [[4, 1, 2], [0.5, 3, 1], [2, 1, 1]], kopya = A.map((r) => r.slice());
    core.hessenbergQR(A);
    expect(A).toEqual(kopya);
  });
});

// ═══════════════════ Kesin sönümlü modlar ═══════════════════

describe('complexModes — orantılı sönüm C = αM + βK: kapalı form (izdüşümün de kesin olduğu tek durum)', () => {
  // ζ_r = α/(2ω_r) + βω_r/2 ;  λ = −ζω ± iω√(1−ζ²)  (ζ < 1)  ya da  ω(−ζ ± √(ζ²−1))  (ζ ≥ 1)
  const Cp = (S, a, b) => S.M6.map((r, i) => r.map((v, j) => a * v + b * S.K6[i][j]));

  test.each([[0.6, 2e-4], [3, 1e-3]])('TTAR, α = %p, β = %p: λ, ζ, f_n, f_d ve gerçel φ 1e-9', (a, b) => {
    const cm = core.complexModes(TTAR.M6, Cp(TTAR, a, b), TTAR.K6, { modes: TTAR.modes });
    expect(cm).toHaveLength(6);
    cm.forEach((k, i) => {
      const w = 2 * Math.PI * TTAR.modes[i].f_Hz, z = a / (2 * w) + b * w / 2;
      const lam = [-z * w, w * Math.sqrt(1 - z * z)];
      expect(k.mod).toBe(i);
      expect(k.over).toBe(false);
      expect(Math.hypot(k.lambda[0] - lam[0], k.lambda[1] - lam[1]) / w).toBeLessThan(TOL);
      expect(bagil(k.zeta, z)).toBeLessThan(TOL);
      expect(bagil(k.f_n, TTAR.modes[i].f_Hz)).toBeLessThan(TOL);
      expect(bagil(k.f_d, lam[1] / (2 * Math.PI))).toBeLessThan(TOL);
      expect(k.mac).toBeGreaterThan(1 - TOL);                  // şekil = sönümsüz şekil
      expect(Math.max(...k.phi.map((c) => Math.abs(c[1])))).toBeLessThan(TOL);   // ve gerçel
    });
  });

  test('β büyük → yüksek modlar aşırı sönümlü: iki gerçel kök ω(−ζ ± √(ζ²−1)) kapalı formla', () => {
    const a = 0.5, b = 0.02;
    const cm = core.complexModes(TTAR.M6, Cp(TTAR, a, b), TTAR.K6, { modes: TTAR.modes });
    let asiri = 0;
    cm.forEach((k, i) => {
      const w = 2 * Math.PI * TTAR.modes[i].f_Hz, z = a / (2 * w) + b * w / 2;
      expect(k.over).toBe(z >= 1);
      expect(bagil(k.zeta, z)).toBeLessThan(TOL);
      expect(bagil(k.f_n, TTAR.modes[i].f_Hz)).toBeLessThan(TOL);
      if (z < 1) return;
      asiri++;
      const kok = Math.sqrt(z * z - 1);
      expect(bagil(k.lambda[0], w * (-z + kok))).toBeLessThan(TOL);      // yavaş kök
      expect(bagil(k.lambda2[0], w * (-z - kok))).toBeLessThan(TOL);     // hızlı kök
      expect(k.lambda[1]).toBe(0);
      expect(Number.isNaN(k.f_d)).toBe(true);
    });
    expect(asiri).toBeGreaterThan(0);
  });
});

describe('complexModes — sönümsüz limit (C = 0): solveModal\'ın kendisi', () => {
  test.each([['ASFAT', ASFAT], ['TTAR', TTAR]])('%s: f_n = f_d = sönümsüz f, ζ = 0, şekil aynı', (_, S) => {
    [null, S.M6.map((r) => r.map(() => 0))].forEach((C) => {
      const cm = core.complexModes(S.M6, C, S.K6, { modes: S.modes });
      expect(cm).toHaveLength(6);
      cm.forEach((k, i) => {
        expect(k.mod).toBe(i);
        expect(bagil(k.f_n, S.modes[i].f_Hz)).toBeLessThan(TOL);
        expect(bagil(k.f_d, S.modes[i].f_Hz)).toBeLessThan(TOL);
        expect(Math.abs(k.zeta)).toBeLessThan(TOL);
        expect(k.over).toBe(false);
        expect(k.mac).toBeGreaterThan(1 - TOL);
      });
    });
  });
});

describe('complexModes — programın orantısız sönümü (mountLoadShares → mountDamping → buildCdamp)', () => {
  const C2 = ASFAT.C(0.02);
  const CM = core.complexModes(ASFAT.M6, C2, ASFAT.K6, { modes: ASFAT.modes });
  const PR = core.modalDampingRatios(ASFAT.modes, ASFAT.M6, C2);

  test('artık < 1e-9 her modda; hakemin ayrı hesabıyla aynı sayı', () => {
    expect(CM).toHaveLength(6);
    CM.forEach((k) => {
      const r = artik(ASFAT.M6, C2, ASFAT.K6, k.lambda, k.phi);
      expect(k.artik).toBeLessThan(TOL);
      expect(Math.abs(r - k.artik)).toBeLessThan(1e-15);
    });
  });

  test('artık ölçütü ayırt edicidir: λ_r başka modun φ\'siyle ≥ 1e-3', () => {
    CM.forEach((k, i) => {
      const yanlis = CM[(i + 1) % 6];
      expect(artik(ASFAT.M6, C2, ASFAT.K6, k.lambda, yanlis.phi)).toBeGreaterThan(1e-3);
    });
  });

  test('İZ ÖZDEŞLİĞİ: Σ 2ζ_r·ω_n,r = iz(M⁻¹C) — kesin çözüm de izdüşüm de (1e-12)', () => {
    const iz = izMinvC(ASFAT.M6, C2);
    const kesin = CM.reduce((s, k) => s + 2 * k.zeta * 2 * Math.PI * k.f_n, 0);
    const izd = PR.reduce((s, z, i) => s + 2 * z.zeta * 2 * Math.PI * ASFAT.modes[i].f_Hz, 0);
    expect(bagil(kesin, iz)).toBeLessThan(1e-12);
    expect(bagil(izd, iz)).toBeLessThan(1e-12);
  });

  test('DETERMİNANT ÖZDEŞLİĞİ: Π ω_n = √(det K / det M) = Π ω_sönümsüz — sönümden bağımsız', () => {
    const w = (f) => 2 * Math.PI * f;
    const kesin = CM.reduce((p, k) => p * w(k.f_n), 1);
    const sonumsuz = ASFAT.modes.reduce((p, md) => p * w(md.f_Hz), 1);
    expect(bagil(kesin, Math.sqrt(det(ASFAT.K6) / det(ASFAT.M6)))).toBeLessThan(1e-12);
    expect(bagil(kesin, sonumsuz)).toBeLessThan(1e-12);
  });

  test('MAC (kütle ağırlıklı) her modu sönümsüz eşine ≥ 0,99 ile bağlar; tanım hakemle aynı', () => {
    CM.forEach((k, i) => {
      expect(k.mod).toBe(i);
      expect(k.mac).toBeGreaterThanOrEqual(0.99);
      expect(Math.abs(k.mac - macM(ASFAT.M6, reel(ASFAT.modes[i].phi), k.phi))).toBeLessThan(1e-12);
    });
  });

  test('KUPLAJ VAR: izdüşüm ζ\'sı ile kesin ζ farkı küçük ama sıfır değil (ζ = 0,02\'de 1e-6 … 1e-4)', () => {
    // Ölçülen en büyüğü 2,04·10⁻⁵ (mod 6); sayısal gürültü artık düzeyinde (~10⁻¹⁵).
    const d = CM.map((k, i) => bagil(k.zeta, PR[i].zeta));
    expect(Math.max(...d)).toBeGreaterThan(1e-6);
    expect(Math.max(...d)).toBeLessThan(1e-4);
    CM.forEach((k, i) => expect(bagil(k.f_n, ASFAT.modes[i].f_Hz)).toBeLessThan(1e-3));
  });

  test('izdüşüm BİRİNCİ derece: fark ζ² ile büyür — ζ iki katına çıkınca her modda 4 kat (ζ ve f_n)', () => {
    // Pertürbasyon: modlar arası sönüm terimi c_rs öz değere ilk derecede girmez; ζ'nin ve
    // ω_n'in düzeltmesi c_rs² ile orantılı. Ölçülen oranlar 4,001 … 4,014.
    const fark = (z) => {
      const C = ASFAT.C(z), pr = core.modalDampingRatios(ASFAT.modes, ASFAT.M6, C);
      return core.complexModes(ASFAT.M6, C, ASFAT.K6, { modes: ASFAT.modes })
        .map((k, i) => [bagil(k.zeta, pr[i].zeta), bagil(k.f_n, ASFAT.modes[i].f_Hz)]);
    };
    const a = fark(0.02), b = fark(0.04);
    a.forEach((v, i) => {
      expect(b[i][0] / v[0]).toBeGreaterThan(3.9);
      expect(b[i][0] / v[0]).toBeLessThan(4.1);
      expect(b[i][1] / v[1]).toBeGreaterThan(3.9);
      expect(b[i][1] / v[1]).toBeLessThan(4.1);
    });
  });

  test('mod şekli KOMPLEKS: orantısız sönümde sanal kısım var (orantılıda 1e-9 altında)', () => {
    const im = Math.max(...CM.map((k) => Math.max(...k.phi.map((c) => Math.abs(c[1])))));
    expect(im).toBeGreaterThan(1e-3);                         // ölçülen 0,0198
    CM.forEach((k) => {
      const j = k.genlik.indexOf(Math.max(...k.genlik));
      expect(k.phi[j]).toEqual([1, 0]);                       // en büyük bileşene normalize
      expect(k.faz[j]).toBe(0);
      k.phi.forEach((c, r) => {
        expect(k.genlik[r]).toBeCloseTo(Math.hypot(c[0], c[1]), 15);
        expect(k.faz[r]).toBeCloseTo(Math.atan2(c[1], c[0]), 15);
      });
    });
  });

  test('modes verilmezse f_n artan sırada, eşleme alanı yok', () => {
    const cm = core.complexModes(ASFAT.M6, C2, ASFAT.K6);
    for (let i = 1; i < cm.length; i++) expect(cm[i].f_n).toBeGreaterThanOrEqual(cm[i - 1].f_n);
    cm.forEach((k) => { expect(k.mod).toBeUndefined(); expect(k.mac).toBeUndefined(); });
  });
});

describe('complexModes — ayrışık kutu: kapalı form, aşırı sönüm', () => {
  // C modal köşegen olduğundan izdüşüm de kesindir — iki yol 1e-9 içinde aynı sayı.
  test.each([[0.05], [0.8]])('ζ girdisi %p: ω_n, ζ ve kökler kapalı formla; izdüşümle aynı', (zg) => {
    const K = kutuKapali(KUTU, zg), C = KUTU.C(zg);
    const cm = core.complexModes(KUTU.M6, C, KUTU.K6, { modes: KUTU.modes });
    const pr = core.modalDampingRatios(KUTU.modes, KUTU.M6, C);
    let asiri = 0;
    cm.forEach((k, i) => {
      const ad = KUTU.modes[i].label, w = Math.sqrt(K.w2[ad]), z = K.zeta[ad];
      expect(bagil(2 * Math.PI * k.f_n, w)).toBeLessThan(TOL);
      expect(bagil(k.zeta, z)).toBeLessThan(TOL);
      expect(bagil(k.zeta, pr[i].zeta)).toBeLessThan(TOL);
      expect(k.over).toBe(z >= 1);
      expect(k.artik).toBeLessThan(TOL);
      if (z < 1) {
        expect(bagil(k.lambda[0], -z * w)).toBeLessThan(TOL);
        expect(bagil(k.lambda[1], w * Math.sqrt(1 - z * z))).toBeLessThan(TOL);
        return;
      }
      asiri++;
      expect(k.zeta).toBeGreaterThanOrEqual(1);
      expect(Number.isNaN(k.f_d)).toBe(true);
      expect(bagil(k.lambda[0], w * (-z + Math.sqrt(z * z - 1)))).toBeLessThan(TOL);
      expect(bagil(k.lambda2[0], w * (-z - Math.sqrt(z * z - 1)))).toBeLessThan(TOL);
      expect(bagil(k.lambda[0] * k.lambda2[0], w * w)).toBeLessThan(TOL);   // ω_n = √(λ₁λ₂)
    });
    // ζ = 0,8 → baş-kıç (1,22) ve savrulma (1,47) aşırı sönümlü, kalan dördü değil
    expect(asiri).toBe(zg === 0.8 ? 2 : 0);
  });
});

describe('complexModes — çakışık mod, tekil M, girdi', () => {
  test('ÇAKIŞIK: simetrik kutuda (kx = ky, Lx = Ly, Ixx = Iyy) çift modlar sönümsüz eşine hizalı', () => {
    // Tam çakışmada özuzayın her vektörü özvektördür; hizalanmasa MAC 0,25 · 0,59 çıkıyordu.
    const B = kutu([1000e3, 1000e3, 500e3], [100, 100, 150], 0.5, 0.5), zg = 0.05;
    const K = kutuKapali(B, zg);
    const cm = core.complexModes(B.M6, B.C(zg), B.K6, { modes: B.modes });
    expect(cm.filter((k) => k.cakisik)).toHaveLength(4);
    cm.forEach((k, i) => {
      const ad = B.modes[i].label;
      expect(k.mod).toBe(i);
      expect(k.mac).toBeGreaterThan(1 - TOL);
      expect(k.artik).toBeLessThan(1e-12);
      expect(bagil(2 * Math.PI * k.f_n, Math.sqrt(K.w2[ad]))).toBeLessThan(TOL);
      expect(bagil(k.zeta, K.zeta[ad])).toBeLessThan(TOL);
      expect(k.cakisik).toBe(['fore-aft', 'lateral', 'roll', 'pitch'].includes(ad));
    });
    expect(new Set(cm.map((k) => k.mod)).size).toBe(6);
  });

  test('M tekil (nokta kütle, ataletsiz) → null, çökme yok', () => {
    const mp = core.combineMassProps([{ name: 'p', mass: 100, cg: [0, 0, 0], I: [[0, 0, 0], [0, 0, 0], [0, 0, 0]], pointMass: true }]);
    const M = core.buildM6(mp.m, mp.I_G);
    expect(core.complexModes(M, null, ASFAT.K6)).toBeNull();
    expect(core.complexModes(M, ASFAT.C(0.02), ASFAT.K6, { modes: ASFAT.modes })).toBeNull();
  });

  test('geçersiz girdi null: boyut uyuşmazlığı, NaN, eksik matris', () => {
    const C = ASFAT.C(0.02);
    expect(core.complexModes(null, C, ASFAT.K6)).toBeNull();
    expect(core.complexModes(ASFAT.M6, C, null)).toBeNull();
    expect(core.complexModes(ASFAT.M6, C.slice(0, 5), ASFAT.K6)).toBeNull();
    expect(core.complexModes(ASFAT.M6, C, ASFAT.K6.map((r, i) => r.map((v, j) => (i === j && i === 2) ? NaN : v)))).toBeNull();
  });

  test('girdileri değiştirmez', () => {
    const C = ASFAT.C(0.02), kopya = [ASFAT.M6, C, ASFAT.K6].map((X) => X.map((r) => r.slice()));
    core.complexModes(ASFAT.M6, C, ASFAT.K6, { modes: ASFAT.modes });
    expect([ASFAT.M6, C, ASFAT.K6]).toEqual(kopya);
  });
});
