/**
 * Takoz doğrulaması — NONLİNEER yasa ve DURDURUCU kıyasları
 * ─────────────────────────────────────────────────────────────────────
 * Newton çözücüsünün (solveCaseNL) ve aktif-küme durdurucusunun (solveCaseStop)
 * hakemi yine kapalı formdur. Anahtar kurgu: simetrik dörtlü kutu, takozlar AM
 * düzleminde (dz = 0). Bu düzende nonlineer z yasasıyla bile her yük durumu tek
 * takozluk yasanın TERSİNE iner:
 *   Σ fz = m·g·nz  ve  Σ dy·fz = Tx   →   F_sağ + F_sol = m·g·nz/2,  F_sağ − F_sol = Tx/(2·Ly)
 * yani F_sağ ve F_sol doğrudan bulunur, sehim yasanın tersidir:
 *   basma (rasyonel)  k0·x/(1 + x/xmax) = F  →  x = F/(k0 − F/xmax)
 *   geri-gelme (kübik) k0·x + c3·x³ = F      →  Cardano
 * Böylece 20 yük durumunun TAMAMI (tork dâhil) Newton'a kapalı formla kıyaslanır.
 */
const H = require('../helpers/takoz-dogrulama.js');
const { core } = H.kur();
const G = H.G, GAP = 0.015, ORAN = 100;

const KUTU = { m: 1200, kutu: [1100, 700, 800], cg: [300, 20, 650], Lx: 600, Ly: 350,
               ks: [900, 700, 400], kd: [1400, 1050, 600] };
const MOTOR = { Te: 500, Rstall: 2, g1: 3, g2: 1.6, gR: -4 };
function kutuModel(ek, cozucu) {
  return H.kurguModel({ govdeler: [{ ad: 'Kutu', m: KUTU.m, cg: KUTU.cg, kutu: KUTU.kutu }],
    takozlar: H.dortluTakoz(KUTU.cg, KUTU.Lx, KUTU.Ly, 0, KUTU.ks, KUTU.kd, ek),
    motor: MOTOR, cozucu: Object.assign({ zeta: 0.05 }, cozucu || {}) });
}
const tum = (R) => R.allCases.concat(R.designCases || [], R.gearCases || []);

// ═══════════════════ N1 — RASYONEL BASMA YASASI ═══════════════════
// z: basmada k0·x/(1 + x/xmax) (−14 mm'de asimptot), geri-gelmede k0·x + c3·x³.
// Orijin eğimi k0 = k_z,stat (yasa katalogla öz-tutarlı); x, y lineer.
const ZFIT = { form: 'asym', comp: { k0: 400, xmax: 14 }, ext: { k0: 400, c3: 0.6 } };
const R1 = H.coz(kutuModel({ fit: { z: ZFIT } }));

function zTers(F) {                                   // F [N] → x [mm]
  if (F < 0) return F / (ZFIT.comp.k0 - F / ZFIT.comp.xmax);
  return H.kubikKok(ZFIT.ext.k0, ZFIT.ext.c3, F);
}
function n1Sehim(lc) {
  const m = KUTU.m, Ly = KUTU.Ly / 1000;
  const S = m * G * lc.n[2] / 2, D = lc.T[0] / (2 * Ly);
  const xs = [m * G * lc.n[0] / (4 * KUTU.ks[0] * 1000), m * G * lc.n[1] / (4 * KUTU.ks[1] * 1000)];
  const zR = zTers((S + D) / 2) / 1000, zL = zTers((S - D) / 2) / 1000;
  return [zR, zL, zR, zL].map((z) => [xs[0], xs[1], z]);   // Sağ Ön, Sol Ön, Sağ Arka, Sol Arka
}

describe('N1 — rasyonel basma yasası: 20 yük durumunda Newton = kapalı form', () => {
  test('çözüm Newton yolundan geçti ve bütün durumlarda yakınsadı', () => {
    expect(R1.solvedNL).toBe(true);
    tum(R1).forEach((rc) => {
      expect(rc.res.checks.converged).toBe(true);
      expect(rc.res.checks.clampCount).toBe(0);          // bu yüklerde durdurucuya ulaşılmıyor
    });
    expect(tum(R1)).toHaveLength(20);
  });

  test.each(tum(R1).map((rc) => [rc.name, rc]))('%s — sehim', (ad, rc) => {
    const exp = n1Sehim(rc.loadCase);
    rc.res.perMount.forEach((pm, i) => {
      for (let a = 0; a < 3; a++) expect(Math.abs(pm.delta[a] - exp[i][a])).toBeLessThan(1e-10);
      expect(pm.tension).toBe(exp[i][2] > 1e-5);
    });
  });

  test('statik sehim lineer modelinkinden KÜÇÜK (yasa sertleşiyor): 4,823 ↔ 7,358 mm', () => {
    const st = R1.allCases.find((c) => c.name === 'Static').res;
    const lin = KUTU.m * G / (4 * KUTU.ks[2] * 1000);
    expect(-st.perMount[0].delta[2] * 1000).toBeCloseTo(4.8229, 3);
    expect(-st.perMount[0].delta[2]).toBeLessThan(0.7 * lin);
  });

  test('modal: tanjant k_t = k0/(1 + x/xmax)² × k_din/k_stat — 6 frekans kapalı formla', () => {
    const x = zTers(-KUTU.m * G / 4);
    const kt = ZFIT.comp.k0 / (1 + x / ZFIT.comp.xmax) ** 2 * 1000 * (KUTU.kd[2] / KUTU.ks[2]);   // N/m
    const I = H.kutuAtalet(KUTU.m, KUTU.kutu), Lx = KUTU.Lx / 1000, Ly = KUTU.Ly / 1000;
    const kd = KUTU.kd.map((v) => v * 1000);
    const exp = [4 * kd[0] / KUTU.m, 4 * kd[1] / KUTU.m, 4 * kt / KUTU.m, 4 * kt * Ly * Ly / I[0][0],
                 4 * kt * Lx * Lx / I[1][1], 4 * (kd[0] * Ly * Ly + kd[1] * Lx * Lx) / I[2][2]]
      .map(H.fHz).sort((a, b) => a - b);
    R1.modes.forEach((md, i) => expect(H.bagil(md.f_Hz, exp[i])).toBeLessThan(1e-9));
    R1.kBasis.forEach((kb) => expect(H.bagil(kb[2], kt)).toBeLessThan(1e-9));
  });

  test('sönüm tanjant tabanından: zıplama modunda ζ_mod tam olarak ζ (0,05)', () => {
    const x = zTers(-KUTU.m * G / 4);
    const fb = H.fHz(4 * ZFIT.comp.k0 / (1 + x / ZFIT.comp.xmax) ** 2 * 1000 * 1.5 / KUTU.m);
    const i = R1.modes.findIndex((md) => H.bagil(md.f_Hz, fb) < 1e-9);
    expect(i).toBeGreaterThanOrEqual(0);
    expect(H.bagil(R1.modalDamping[i].zeta, 0.05)).toBeLessThan(1e-9);
  });
});

// ═══════════════════ N2 — KÜBİK YASA + DURDURUCU ═══════════════════
// z: F = k0·x + c3·x³ (simetrik sertleşme). 3,5 g'de yasa tek başına 15 mm'yi
// geçiyor → metal-metal durdurucu Newton'un İÇİNDE devreye girer:
//   k0·x + c3·x³ + k_stop·(x + gap) = F  (x < −gap),  k_stop = 100·k_z,stat
const PFIT = { form: 'poly', k0: 400, c3: 1.0, c5: 0 };
const R2 = H.coz(kutuModel({ fit: { z: PFIT } }));
function koku(fn, a, b) {                              // ikiye bölme — hakem kök bulucu
  let fa = fn(a);
  for (let i = 0; i < 200; i++) { const c = (a + b) / 2, fc = fn(c); if ((fc < 0) === (fa < 0)) { a = c; fa = fc; } else b = c; }
  return (a + b) / 2;
}

describe('N2 — kübik yasa ve durdurucu: Newton + aktif küme kapalı formla', () => {
  test('statik: k0·x + c3·x³ = m·g/4 (Cardano)', () => {
    const st = R2.allCases.find((c) => c.name === 'Static').res;
    const x = -H.kubikKok(PFIT.k0, PFIT.c3, KUTU.m * G / 4) / 1000;
    st.perMount.forEach((pm) => expect(Math.abs(pm.delta[2] - x)).toBeLessThan(1e-10));
  });

  test('Max Bump 3,5 g: yasa 15 mm\'yi aşıyor, durdurucu Newton içinde oturuyor', () => {
    const rc = R2.allCases.find((c) => c.name === 'Max Bump').res;
    const F = -3.5 * KUTU.m * G / 4, kS = ORAN * KUTU.ks[2];          // N, N/mm
    const serbest = -H.kubikKok(PFIT.k0, PFIT.c3, -F);                 // durdurucusuz yasa çözümü
    expect(serbest).toBeLessThan(-15);                                 // testin anlamı: durdurucu gerçekten gerekiyor
    const x = koku((v) => PFIT.k0 * v + PFIT.c3 * v ** 3 + kS * (v + 15) - F, -16, -15) / 1000;
    expect(rc.checks.clampCount).toBe(4);
    expect(rc.checks.converged).toBe(true);
    rc.perMount.forEach((pm) => {
      expect(Math.abs(pm.delta[2] - x)).toBeLessThan(1e-10);
      expect(pm.clamped).toBe(true);
    });
  });

  // Tanjant yanlışsa Newton yine AYNI dengeye iner (artık doğru kuvvetten), yalnız
  // yavaş: sonucu kıyaslayan test bunu göremez. Durdurucu tanjanta eklenmeyince
  // (100·kz'lik yay tanjantta yok) yakınsama doğrusala düşüyor — ölçüldü: son aktif
  // kümede 3 → 13 adım, kz = 250'de 60 adımda yakınsamıyor. Kural: aktif küme
  // değiştikten sonra kuadratik yakınsama, yani ≤ 4 adım ve her adım ≥ 100 kat.
  test('Newton kuadratik yakınsıyor: durdurucu oturduktan sonra ≤ 4 adım, her adımda artık ≥ 100 kat düşüyor', () => {
    // Max Bump: dört takoz oturur · 2,6 g + 5 kN·m yalpa: yalnız bir taraf oturur (kısmi temas)
    [[{ n: [0, 0, -3.5], T: [0, 0, 0] }, 4], [{ n: [0, 0, -2.6], T: [-5000, 0, 0] }, 2]].forEach(([lc, oturan]) => {
      const iz = [];
      const r = core.solveCaseNL(R2.mounts, R2.mp.cg, R2.mp.m, G, lc,
        { useStop: true, onIter: (i, rn) => iz.push(rn) });
      expect(r.checks.converged).toBe(true);
      expect(r.checks.clampCount).toBe(oturan);                       // testin anlamı: durdurucu oturdu
      // Aktif küme değişince artık sıçrar: son sıçramadan sonrası son kümenin Newton'u
      let bas = 0;
      for (let k = 1; k < iz.length; k++) if (iz[k] > iz[k - 1]) bas = k;
      const son = iz.slice(bas);
      expect(bas).toBeGreaterThan(0);
      expect(son.length).toBeLessThanOrEqual(4);
      for (let k = 1; k < son.length; k++) expect(son[k]).toBeLessThan(son[k - 1] / 100);
    });
  });
});

// ═══════════════════ N3 — NOKTA TABLOSU ═══════════════════

describe('N3 — nokta tablosu (monoton kübik) yolu', () => {
  test('doğrusal tablo LİNEER yasaya iner: Newton sonuçları lineer çözümle aynı (durdurucu dâhil)', () => {
    const k = KUTU.ks[2];
    const RL = H.coz(kutuModel());
    const RT = H.coz(kutuModel({ egri: { z: [[-30, -30 * k], [-10, -10 * k], [0, 0], [10, 10 * k], [30, 30 * k]] } }));
    expect(RL.solvedNL).toBe(false);
    expect(RT.solvedNL).toBe(true);
    tum(RL).forEach((rc) => {
      const rt = tum(RT).find((c) => c.name === rc.name).res;
      rc.res.perMount.forEach((pm, i) => pm.delta.forEach((v, a) => expect(Math.abs(rt.perMount[i].delta[a] - v)).toBeLessThan(1e-12)));
      expect(rt.checks.clampCount).toBe(rc.res.checks.clampCount);
    });
    RL.modes.forEach((md, i) => expect(H.bagil(RT.modes[i].f_Hz, md.f_Hz)).toBeLessThan(1e-12));
  });

  test('rasyonel yasadan 0,5 mm aralıkla örneklenen tablo kapalı forma ≤ 0,005 mm yaklaşır', () => {
    const pts = [];
    for (let x = -13; x <= 10.001; x += 0.5) pts.push([x, H.fitKuvvet(ZFIT, x)]);
    const RT = H.coz(kutuModel({ egri: { z: pts } }));
    ['Static', 'Max Bump', 'Max Rebound'].forEach((ad) => {
      const rc = RT.allCases.find((c) => c.name === ad);
      const exp = n1Sehim(rc.loadCase);
      rc.res.perMount.forEach((pm, i) => expect(Math.abs(pm.delta[2] - exp[i][2]) * 1000).toBeLessThan(0.005));
    });
  });

  test('monoton kübik: düğümlerden geçer, düğümler arasında taşmaz, uçlarda doğrusal uzar', () => {
    const xs = [-0.02, -0.01, -0.004, 0, 0.003, 0.01], ys = [-9000, -3000, -900, 0, 500, 2500];
    const sp = core.buildMonotoneCubic(xs, ys);
    xs.forEach((x, i) => expect(Math.abs(sp.eval(x) - ys[i])).toBeLessThan(1e-9));
    for (let i = 0; i < xs.length - 1; i++) {
      for (let t = 0.05; t < 1; t += 0.05) {
        const x = xs[i] + t * (xs[i + 1] - xs[i]), y = sp.eval(x);
        expect(y).toBeGreaterThanOrEqual(ys[i] - 1e-9);                  // aşma yok (monotonluk)
        expect(y).toBeLessThanOrEqual(ys[i + 1] + 1e-9);
        expect(sp.slope(x)).toBeGreaterThanOrEqual(-1e-9);
      }
    }
    const sL = sp.slope(xs[0]), sR = sp.slope(xs[5]);
    expect(Math.abs(sp.eval(-0.03) - (ys[0] + sL * (-0.01)))).toBeLessThan(1e-9);
    expect(Math.abs(sp.eval(0.02) - (ys[5] + sR * 0.01))).toBeLessThan(1e-9);
    // C¹ süreklilik: düğümün iki yanında eğim aynı
    xs.slice(1, -1).forEach((x) => expect(Math.abs(sp.slope(x - 1e-12) - sp.slope(x + 1e-12)) / Math.abs(sp.slope(x) + 1)).toBeLessThan(1e-3));
  });
});

// ═══════════════════ N4 — KISMİ DURDURUCU TEMASI ═══════════════════
// Alçak takozlu kutuda (AM'nin 250 mm altında) Pothole Braking: fren burnu
// aşağı iter, yalnız ÖN takozlar 15 mm'yi aşar → aktif küme simetrik değil,
// kapalı form yok. Hakem: aynı aktif-küme fikrinin BAĞIMSIZ yazımı + tümleyenlik
// koşulları (aktif takozda |δz| ≥ gap, pasif takozda |δz| ≤ gap).
describe('N4 — kısmi durdurucu teması: bağımsız aktif-küme çözümü ve tümleyenlik', () => {
  const B = { m: 1500, kutu: [1200, 800, 900], cg: [100, -10, 700], Lx: 550, Ly: 380, h: 250,
              ks: [1000, 800, 600], kd: [1500, 1200, 900] };
  const R = H.coz(H.kurguModel({ govdeler: [{ ad: 'Gövde', m: B.m, cg: B.cg, kutu: B.kutu }],
    takozlar: H.dortluTakoz(B.cg, B.Lx, B.Ly, B.h, B.ks, B.kd), cozucu: { zeta: 0.03 } }));
  const rc = R.allCases.find((c) => c.name === 'Pothole Braking').res;

  test('yalnız ön takozlar durdurucuya oturuyor', () => {
    expect(rc.perMount.map((pm) => !!pm.clamped)).toEqual([true, true, false, false]);
  });

  test('tümleyenlik: aktif takozda |δz| ≥ 15 mm, pasifte ≤ 15 mm', () => {
    rc.perMount.forEach((pm) => {
      if (pm.clamped) expect(Math.abs(pm.delta[2])).toBeGreaterThanOrEqual(GAP);
      else expect(Math.abs(pm.delta[2])).toBeLessThanOrEqual(GAP);
    });
  });

  test('bağımsız aktif-küme yazımı aynı sehimi buluyor', () => {
    const ms = R.mounts, cg = R.mp.cg, n = rc.F;
    const az = ms.map((mt) => H.Arows([0, 1, 2].map((j) => mt.pos[j] - cg[j]))[2]);
    let aktif = ms.map(() => 0), q = null;
    for (let it = 0; it < 20; it++) {
      const K = H.topla6(ms, cg, ms.map((m) => m.kstat)), rhs = n.slice();
      ms.forEach((mt, i) => {
        if (!aktif[i]) return;
        const kS = ORAN * mt.kstat[2];
        for (let a = 0; a < 6; a++) { rhs[a] += kS * aktif[i] * GAP * az[i][a]; for (let b = 0; b < 6; b++) K[a][b] += kS * az[i][a] * az[i][b]; }
      });
      q = H.coz6(K, rhs);
      const yeni = az.map((r) => { const dz = H.noktaCarp(r, q); return dz < -GAP ? -1 : dz > GAP ? 1 : 0; });
      if (yeni.every((v, i) => v === aktif[i])) break;
      aktif = yeni;
    }
    ms.forEach((mt, i) => {
      const A = H.Arows([0, 1, 2].map((j) => mt.pos[j] - cg[j]));
      for (let a = 0; a < 3; a++) expect(Math.abs(H.noktaCarp(A[a], q) - rc.perMount[i].delta[a])).toBeLessThan(1e-12);
    });
  });
});

// ═══════════════════ N5 — NONLİNEER ŞOKTA ENERJİ ═══════════════════
// ζ = 0: darbe bittikten sonra sistem korunumludur. Toplam enerji
//   E = ½·q̇ᵀMq̇ + Σ ∫ [F_din(δ₀+s) − F_din(δ₀)] ds
// sabit kalmalı. Lineer yolda Newmark (γ=½, β=¼) enerjiyi TAM korur; nonlineer
// yasada adım başına Newton'la çözülen trapez kuralı yaklaşık korur — hata
// (ω·dt)² mertebesindedir. Ölçülen (2026-10-16): 3 g'de 3,4·10⁻⁴, 6 g'de 1,3·10⁻³.
describe('N5 — nonlineer şok, ζ = 0: darbe sonrası enerji korunuyor', () => {
  const R = H.coz(kutuModel({ fit: { z: ZFIT } }, { zeta: 0 }));
  const M6 = H.M6of(R.mp.m, R.mp.I_G);
  const enerji = (aG) => {
    const out = core.shockResponse(R.mounts, R.mp.cg, core.buildM6(R.mp.m, R.mp.I_G), R.damping,
      { dir: 2, aG, dur: 0.02, g: G, useStop: true, q0: R.qStatic, kBasis: R.kBasis });
    const A = R.mounts.map((mt) => H.Arows([0, 1, 2].map((j) => mt.pos[j] - R.mp.cg[j])));
    const kuvvet = (mt, a, x) => {
      const fit = mt.fits && mt.fits[['x', 'y', 'z'][a]], r = mt.kdyn[a] / mt.kstat[a];
      return r * (fit ? H.fitKuvvet(fit, x * 1000) : mt.kstat[a] * x);
    };
    const d0 = A.map((Ai) => Ai.map((row) => H.noktaCarp(row, R.qStatic)));
    const simpson = (fn, a, b) => { const n = 120, h = (b - a) / n; let s = fn(a) + fn(b); for (let i = 1; i < n; i++) s += (i % 2 ? 4 : 2) * fn(a + i * h); return s * h / 3; };
    const E = (q, qd) => {
      let e = 0.5 * H.noktaCarp(qd, H.matVek(M6, qd));
      R.mounts.forEach((mt, k) => [0, 1, 2].forEach((a) => {
        const dl = H.noktaCarp(A[k][a], q), F0 = kuvvet(mt, a, d0[k][a]);
        e += simpson((s) => kuvvet(mt, a, s) - F0, d0[k][a], d0[k][a] + dl);
      }));
      return e;
    };
    const Es = out.t.map((t, i) => (t > 0.021 ? E(out.q[i], out.qd[i]) : NaN)).filter(Number.isFinite);
    return { out, surukleme: Math.max(...Es.map((v) => Math.abs(v - Es[0]))) / Es[0] };
  };

  test('3 g: Newton her adımda yakınsadı, durdurucuya oturmadı, enerji sürüklenmesi < 10⁻³', () => {
    const r = enerji(3);
    expect(r.out.nonlinear).toBe(true);
    expect(r.out.converged).toBe(true);
    expect(r.out.stopHit).toBe(false);
    expect(r.surukleme).toBeLessThan(1e-3);
  });

  test('6 g: daha büyük genlikte de sürüklenme < %0,5 (ayrıklaştırma hatası, sönüm değil)', () => {
    const r = enerji(6);
    expect(r.out.converged).toBe(true);
    expect(r.surukleme).toBeLessThan(5e-3);
  });
});

// ═══════════════════ N6 — ÇÖZÜM MODU SEÇİMİ ═══════════════════

describe('N6 — Çözücü\'nün çözüm modu: Lineer yasaları gerçekten sıyırıyor', () => {
  test('"Lineer" modda yasalı model, yasasız modelle BİREBİR aynı (sehim, mod, sönüm)', () => {
    const RLin = H.coz(kutuModel({ fit: { z: ZFIT } }, { solveMode: 'linear' }));
    const RRef = H.coz(kutuModel());
    expect(RLin.solvedNL).toBe(false);
    tum(RRef).forEach((rc) => {
      const rl = tum(RLin).find((c) => c.name === rc.name).res;
      rc.res.perMount.forEach((pm, i) => pm.delta.forEach((v, a) => expect(Math.abs(rl.perMount[i].delta[a] - v)).toBeLessThan(1e-15)));
    });
    RRef.modes.forEach((md, i) => expect(RLin.modes[i].f_Hz).toBe(md.f_Hz));
    RRef.damping.forEach((dm, i) => dm.c.forEach((c, a) => expect(RLin.damping[i].c[a]).toBe(c)));
  });

  test('"Nonlineer" seçilip yasa yoksa lineer çözülür ve bu SÖYLENİR (nlNoCurve)', () => {
    const R = H.coz(kutuModel(null, { solveMode: 'nonlinear' }));
    expect(R.solvedNL).toBe(false);
    expect(R.nlNoCurve).toBe(true);
  });
});
