/**
 * Takoz doğrulaması — ŞOK (geçici rejim) kıyasları
 * ─────────────────────────────────────────────────────────────────────
 * Simetrik dörtlü kutuda zıplama ayrışıktır: düşey yarım sinüs darbe yalnız onu
 * uyarır ve 6 SD Newmark çözümü TEK serbestlikli taban uyarımına iner:
 *     z̈ + 2ζω·ż + ω²·z = −A·g·sin(πt/τ),   0 ≤ t ≤ τ
 * Bu denklemin kapalı-form çözümü hakemdir. Üç ayrı soru sorulur:
 *   1. zaman geçmişi    — Newmark yanıtı kapalı formu ne kadar izliyor?
 *   2. yöntem kimliği    — ortalama ivme Newmark'ı (γ=½, β=¼) genliği korur ama
 *                          periyodu uzatır: T̄ = π·dt / atan(ω·dt/2). Ölçülen
 *                          periyot T̄'ye mi, tam T'ye mi oturuyor?
 *   3. şok yanıt spektrumu — τ/T taraması (impuls → rezonans → yarı-statik)
 */
const H = require('../helpers/takoz-dogrulama.js');
const { core } = H.kur();
const G = H.G;

// Kapalı-form taban uyarımlı SDOF yanıtı z(t) [m]. Ω = ω (tam rezonans) özel
// hâli ayrıca çözülür (genel formülde payda sıfırdır).
function yarimSinusSDOF(w, z, Ag, tau) {
  const W = Math.PI / tau, wd = w * Math.sqrt(1 - z * z);
  let ic;
  if (z === 0 && Math.abs(W - w) < 1e-9 * w) {
    // ẍ + ω²x = −Ag·sin(ωt): x = (Ag/2ω²)·(ωt·cos ωt − sin ωt)
    ic = (t) => ({ x: Ag / (2 * w * w) * (w * t * Math.cos(w * t) - Math.sin(w * t)),
                   v: -Ag / 2 * t * Math.sin(w * t) });
  } else {
    const Dn = (w * w - W * W) ** 2 + (2 * z * w * W) ** 2;
    const P = -Ag * (w * w - W * W) / Dn, Q = 2 * z * w * W * Ag / Dn;
    const E1 = -Q, E2 = (z * w * E1 - P * W) / wd;
    ic = (t) => {
      const ex = Math.exp(-z * w * t), c = Math.cos(wd * t), s = Math.sin(wd * t);
      return { x: P * Math.sin(W * t) + Q * Math.cos(W * t) + ex * (E1 * c + E2 * s),
               v: P * W * Math.cos(W * t) - Q * W * Math.sin(W * t) + ex * ((-z * w * E1 + wd * E2) * c + (-z * w * E2 - wd * E1) * s) };
    };
  }
  const son = ic(tau);
  return (t) => {
    if (t <= tau) return ic(t).x;
    const s = t - tau, ex = Math.exp(-z * w * s);
    return ex * (son.x * Math.cos(wd * s) + ((son.v + z * w * son.x) / wd) * Math.sin(wd * s));
  };
}

function kutu(ks, kd, Lx, Ly, zeta) {
  return H.coz(H.kurguModel({ govdeler: [{ ad: 'Kutu', m: 1200, cg: [300, 20, 650], kutu: [1100, 700, 800] }],
    takozlar: H.dortluTakoz([300, 20, 650], Lx, Ly, 0, ks, kd), cozucu: { zeta } }));
}
const sok = (R, o) => core.shockResponse(R.mounts, R.mp.cg, core.buildM6(R.mp.m, R.mp.I_G), R.damping,
  Object.assign({ dir: 2, aG: 3, dur: 0.02, g: G }, o));

describe('S1 — ayrışık zıplama: 6 SD Newmark yanıtı kapalı-form SDOF\'u izliyor', () => {
  const R = kutu([900, 700, 400], [1400, 1050, 600], 600, 350, 0.05);
  const w = Math.sqrt(4 * 600e3 / 1200);
  const ex = yarimSinusSDOF(w, 0.05, 3 * G, 0.02);

  test.each([['lineer yol', { useStop: false }], ['Newton yolu (durdurucu açık, statik denge çevresinde)', { useStop: true }]])(
    '%s — en büyük fark tepenin %0,1\'inden küçük', (ad, o) => {
      const out = sok(R, Object.assign({ q0: R.qStatic }, o));
      let pk = 0, err = 0;
      out.t.forEach((t, i) => { const e = ex(t); pk = Math.max(pk, Math.abs(e)); err = Math.max(err, Math.abs(out.q[i][2] - e)); });
      expect(err / pk).toBeLessThan(1e-3);            // ölçülen 5,9·10⁻⁴: (ω·dt)² mertebesinde faz hatası
      expect(pk * 1000).toBeCloseTo(7.62, 1);
    });

  test('darbe yalnız zıplamayı uyarıyor: öteki beş serbestlik sıfırda', () => {
    const out = sok(R, { useStop: false });
    out.q.forEach((q) => [0, 1, 3, 4, 5].forEach((j) => expect(Math.abs(q[j])).toBeLessThan(1e-15)));
  });

  test.each([[0, 'X', 1400], [1, 'Y', 1050]])('%s yönü (%s) — kendi öteleme frekansında aynı SDOF', (dir, ad, kd) => {
    const wd = Math.sqrt(4 * kd * 1000 / 1200), exd = yarimSinusSDOF(wd, 0.05, 3 * G, 0.02);
    const out = sok(R, { dir, useStop: false });
    let pk = 0, err = 0;
    out.t.forEach((t, i) => { const e = exd(t); pk = Math.max(pk, Math.abs(e)); err = Math.max(err, Math.abs(out.q[i][dir] - e)); });
    expect(err / pk).toBeLessThan(2e-3);
  });
});

describe('S2 — yöntem kimliği: ölçülen periyot ortalama ivme Newmark\'ının periyodu', () => {
  // Zıplamanın EN YÜKSEK mod olduğu kutu (rocking ve yatay modlar altında) →
  // adım boyu dt = 1/(40·f_zıplama), ω·dt = π/20: periyot uzaması %0,2 —
  // ölçülebilir. ζ = 0: genlik sönmüyor, sıfır geçişleri temiz.
  const R = kutu([300, 300, 1000], [300, 300, 1000], 300, 200, 0);
  const w = Math.sqrt(4 * 1e6 / 1200);
  const out = sok(R, { aG: 1, dur: 0.15, useStop: false });
  const zc = [];
  for (let i = 1; i < out.t.length; i++) {
    if (out.t[i - 1] <= 0.16) continue;
    const a = out.q[i - 1][2], b = out.q[i][2];
    if ((a < 0) !== (b < 0)) zc.push(out.t[i - 1] + (out.t[i] - out.t[i - 1]) * a / (a - b));
  }
  const Tolc = 2 * (zc[zc.length - 1] - zc[0]) / (zc.length - 1);
  const Ttam = 2 * Math.PI / w, Tnm = Math.PI * out.dt / Math.atan(w * out.dt / 2);

  test('kurgu koşulu: zıplama en yüksek mod, adım boyu ondan türüyor', () => {
    expect(R.modes[5].label).toBe('bounce');
    expect(w * out.dt).toBeCloseTo(Math.PI / 20, 6);
    expect(zc.length).toBeGreaterThan(20);
  });

  test('ölçülen periyot T̄ = π·dt/atan(ω·dt/2) ile 10⁻⁵ içinde örtüşüyor', () => {
    expect(Math.abs(Tolc - Tnm) / Ttam).toBeLessThan(1e-5);     // ölçülen 2·10⁻⁷
  });

  test('ve tam periyottan beklenen kadar (≈ (ω·dt)²/12 = %0,2) UZUN — başka yöntem başka iz bırakırdı', () => {
    const uzama = (Tolc - Ttam) / Ttam;
    expect(uzama).toBeGreaterThan(0.0018);
    expect(uzama).toBeLessThan(0.0023);
  });

  test('ζ = 0: genlik sönmüyor (yöntem yapay sönüm eklemiyor)', () => {
    const tepeler = [];
    for (let i = 1; i < out.t.length - 1; i++) {
      if (out.t[i] < 0.16) continue;
      const a = Math.abs(out.q[i - 1][2]), b = Math.abs(out.q[i][2]), c = Math.abs(out.q[i + 1][2]);
      if (b >= a && b >= c) tepeler.push(b);
    }
    const ilk = tepeler.slice(0, 4), son = tepeler.slice(-4);
    expect(Math.abs(Math.max(...son) - Math.max(...ilk)) / Math.max(...ilk)).toBeLessThan(5e-3);
  });
});

describe('S3 — şok yanıt spektrumu: τ/T taraması kapalı formla (ζ = 0)', () => {
  const R = kutu([900, 700, 400], [1400, 1050, 600], 600, 350, 0);
  const w = Math.sqrt(4 * 600e3 / 1200), T = 2 * Math.PI / w, Ag = 3 * G;
  const satir = (r) => {
    const tau = r * T, out = sok(R, { dur: tau, useStop: false }), ex = yarimSinusSDOF(w, 0, Ag, tau);
    let pkEx = 0;
    for (let i = 0; i <= 40000; i++) pkEx = Math.max(pkEx, Math.abs(ex(out.tEnd * i / 40000)));
    const pkMf = Math.max(...out.q.map((q) => Math.abs(q[2])));
    return { kapali: pkEx * w * w / Ag, mfsim: pkMf * w * w / Ag };
  };

  test.each([0.02, 0.1, 0.25, 0.5, 0.8, 1.0, 1.25, 1.5, 2.5, 4])('τ/T = %s — spektrum değeri %0,2 içinde', (r) => {
    const s = satir(r);
    expect(H.bagil(s.mfsim, s.kapali)).toBeLessThan(2e-3);
  });

  test('spektrumun tepesi ≈ 1,77 (τ/T ≈ 0,8): yarım sinüsün bilinen büyütmesi', () => {
    const s = satir(0.8);
    expect(s.kapali).toBeGreaterThan(1.76);
    expect(s.kapali).toBeLessThan(1.775);
    expect(s.mfsim).toBeGreaterThan(1.76);
  });

  test('impuls limiti: τ ≪ T → z_maks = v₀/ω, v₀ = 2·A·g·τ/π', () => {
    const r = 0.02, s = satir(r);
    expect(H.bagil(s.mfsim, 4 * r)).toBeLessThan(2e-3);           // (v₀/ω)·ω²/(A·g) = 4·τ/T
  });

  test('τ/T = 0,5 tam rezonans (Ω = ω): spektrum değeri π/2, kapalı formla aynı', () => {
    const s = satir(0.5);
    expect(s.kapali).toBeCloseTo(Math.PI / 2, 9);                 // |x(τ)|·ω²/Ag = π/2 rezonansta
    expect(H.bagil(s.mfsim, s.kapali)).toBeLessThan(2e-3);
  });
});
