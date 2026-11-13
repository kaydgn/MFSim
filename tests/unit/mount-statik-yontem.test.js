/**
 * Takoz çekirdeği — statik çözüm seçenekleri (solveCaseNL opts · statikAyar)
 * ─────────────────────────────────────────────────────────────────────
 * Çözücü bileşeninin statik seçenekleri hesap çekirdeğinde. Kapılar:
 *   VARSAYILAN — ayarsız çağrı = varsayılanları açıkça veren çağrı; yakınsayan çözümde
 *                tek artım, bölme yok, her iterasyonda tanjant (seçeneklerden önceki yol).
 *   ÜÇ YÖNTEM  — newton · modnewton · bfgs, aramalı ve aramasız, AYNI dengeye iner:
 *                eğrili kutu, durdurucusu oturan kutu (dört ve iki takoz), kuplajlı beş
 *                takozlu model; denge bağımsız hakemle Σ Aᵀ·f(δ) = F.
 *   HIZ        — Newton kuadratik (r_{k+1}/r_k² sabit), değiştirilmiş Newton doğrusal
 *                (r_{k+1}/r_k sabit, tek tanjant), BFGS süperdoğrusal (oran küçülür, tek tanjant).
 *   ARTIM      — N artım = tek artım (elastik, yol bağımsız); her artım yükü F/N artırır.
 *   KESME      — aramasız Newton'un inemediği asimptot yakını: kesme 0'da yakınsamaz,
 *                varsayılanla iner; bölme art arda sınırlı; tükenince son yakınsamış durum
 *                SÖYLENEREK döner (converged false, yukOrani < 1).
 *   ÖLÇÜT      — kuvvet ve moment AYRI: her biri kendi sınırında durdurur; maxIter
 *                tükenince söylenir; tolU açıkken denge aynı.
 *   AYAR       — statikAyar: bozuk değer varsayılana, aralık dışı değer sınıra.
 * Hakem (kinematik δ = u + θ×d, yasa, genelleştirilmiş kuvvet) tests/helpers/takoz-dogrulama.js'in
 * bağımsız yazımından; çekirdeğin fonksiyonu yalnız ölçülen taraftır.
 */
const core = require('../../js/mount-core.js');
const H = require('../helpers/takoz-dogrulama.js');

const G = 9.81, GAP = core.STOP_GAP_M, ORAN = core.STOP_STIFF_RATIO;
const k = (v) => v * 1000;                                   // N/mm → N/m

// ═══════════════════ Modeller (SI) ═══════════════════
// Simetrik dörtlü kutu: tests/unit/mount-dogrulama-nonlineer.test.js'in N1/N2 kutusu.
// h [m]: takozlar ağırlık merkezinin h altında (h > 0 → boyuna/yalpa kuplajı).
const ASYM = { form: 'asym', comp: { k0: 400, xmax: 14 }, ext: { k0: 400, c3: 0.6 } };  // basmada asimptot −14 mm
const POLY = { form: 'poly', k0: 400, c3: 1.0, c5: 0 };                                    // kübik sertleşme
function kutu(fitZ, h) {
  const cg = [0.3, 0.02, 0.65], Lx = 0.6, Ly = 0.35;
  const mounts = [['Sağ Ön', -1, 1], ['Sol Ön', -1, -1], ['Sağ Arka', 1, 1], ['Sol Arka', 1, -1]].map((q) => ({
    name: q[0] + ' Takoz', pos: [cg[0] + q[1] * Lx, cg[1] + q[2] * Ly, cg[2] - (h || 0)],
    kstat: [k(900), k(700), k(400)], kdyn: [k(1400), k(1050), k(600)], fits: fitZ ? { z: fitZ } : undefined }));
  return { mounts, cg, m: 1200 };
}
// İki gövde, beş takoz, simetri yok; üç eksende nonlineer yasa (H.genelModel).
function genel() {
  const sp = H.genelModel({ nonlineer: true });
  const comps = sp.govdeler.map((g) => ({ name: g.ad, mass: g.m, cg: g.cg.map((v) => v / 1000), I: g.I, pointMass: false }));
  const mp = core.combineMassProps(comps);
  const mounts = sp.takozlar.map((t) => ({ name: t.ad, pos: t.p.map((v) => v / 1000),
    kstat: t.ks.map(k), kdyn: t.kd.map(k), fits: t.fit }));
  return { mounts, cg: mp.cg, m: mp.m };
}
const lc = (ad, n, T) => ({ name: ad, n, T: T || [0, 0, 0] });

const N1 = kutu(ASYM), N1A = kutu(ASYM, 0.25), N2 = kutu(POLY), GENEL = genel();
const STATIK = lc('Static', [0, 0, -1]);
const DURUMLAR = [
  ['eğrili kutu · Static', N1, STATIK, 0],
  ['eğrili kutu · 2,5 g', N1, lc('Bump', [0, 0, -2.5]), 0],
  ['alçak eğrili kutu · fren', N1A, lc('Braking', [-1, 0, -1]), 0],
  ['kübik kutu · 3,5 g, dört takoz oturur', N2, lc('Max Bump', [0, 0, -3.5]), 4],
  ['kübik kutu · 2,6 g + yalpa, iki takoz oturur', N2, lc('Kısmi', [0, 0, -2.6], [-5000, 0, 0]), 2],
  ['beş takoz · fren + tork', GENEL, lc('Fren+tork', [-1.2, 0, -1], [-6000, 0, 0]), 0],
  ['beş takoz · viraj', GENEL, lc('Viraj', [0, 1.5, -1], [0, 0, 2000]), 0]
];
const YONTEMLER = ['newton', 'modnewton', 'bfgs'];

function coz(M, yd, o) {
  const iz = [];
  const r = core.solveCaseNL(M.mounts, M.cg, M.m, G, yd,
    Object.assign({ useStop: true, onIter: (i, rn) => iz.push(rn) }, o || {}));
  return { r, iz };
}

// ═══════════════════ Bağımsız hakem ═══════════════════
// Sehim q'dan bağımsız kinematikle; kuvvet çekirdeğin yasasından AYRI yazımla (H.fitKuvvet,
// mm → N, ya da k·δ); durdurucu |δz| > boşluk iken k_stop·(δz ∓ boşluk) — temas çözümün
// bayrağından değil sehimden okunur.
function hakemSehim(M, q) {
  return M.mounts.map((mt) => H.Arows([0, 1, 2].map((j) => mt.pos[j] - M.cg[j])).map((row) => H.noktaCarp(row, q)));
}
function hakemKuvvet(mt, d) {
  const f = [0, 1, 2].map((a) => {
    const fit = mt.fits && mt.fits['xyz'[a]];
    return fit ? H.fitKuvvet(fit, d[a] * 1000) : mt.kstat[a] * d[a];
  });
  if (d[2] < -GAP) f[2] += ORAN * mt.kstat[2] * (d[2] + GAP);
  else if (d[2] > GAP) f[2] += ORAN * mt.kstat[2] * (d[2] - GAP);
  return f;
}
// Denge artığı Σ Aᵀ·f(δ) − λ·F ve ölçütün ölçekleri (spesifikasyondan, çekirdekten değil).
function hakem(M, res, lam) {
  const d = hakemSehim(M, res.q);
  const g6 = H.genelKuvvet(M.mounts, M.cg, d.map((di, i) => hakemKuvvet(M.mounts[i], di)));
  const r = g6.map((v, a) => v - (lam == null ? 1 : lam) * res.F[a]);
  const F = res.F, mg = M.m * G;
  const L = Math.max(Math.sqrt(M.mounts.reduce((s, mt) =>
    s + [0, 1, 2].reduce((t, j) => t + (mt.pos[j] - M.cg[j]) ** 2, 0), 0) / M.mounts.length), 0.1);
  return { d, rF: H.norm(r.slice(0, 3)), rM: H.norm(r.slice(3)),
           Fref: H.norm(F.slice(0, 3)) + mg, Mref: H.norm(F.slice(3)) + mg * L };
}
// İki çözümün sehim farkı, en büyük sehime göre.
function goreliFark(a, b) {
  const s = Math.max(...a.perMount.map((pm) => Math.max(...pm.delta.map(Math.abs))));
  return Math.max(...a.perMount.map((pm, i) => Math.max(...pm.delta.map((v, j) => Math.abs(v - b.perMount[i].delta[j]))))) / s;
}

// ═══════════════════ VARSAYILAN ═══════════════════

describe('VARSAYILAN — ayarsız çağrı önceki yolun aynısı', () => {
  test('varsayılanları açıkça veren çağrı ayarsız çağrıyla BİREBİR (q, sehim, checks)', () => {
    DURUMLAR.forEach(([, M, yd]) => {
      const a = core.solveCaseNL(M.mounts, M.cg, M.m, G, yd, { useStop: true });
      const b = core.solveCaseNL(M.mounts, M.cg, M.m, G, yd, Object.assign({ useStop: true }, core.STATIK_VARSAYILAN));
      expect(b).toEqual(a);
    });
  });

  test('bozuk ayar çözümü bozmaz: varsayılan çözümle birebir', () => {
    const bozuk = { yontem: 'xyz', arama: 'evet', artim: -3, kesme: 'çok', tolF: 'a', tolM: null, tolU: undefined,
                    maxIter: NaN, aktifTur: {}, stiffRatio: 'yüz' };
    DURUMLAR.forEach(([, M, yd]) => {
      const a = core.solveCaseNL(M.mounts, M.cg, M.m, G, yd, { useStop: true });
      const b = core.solveCaseNL(M.mounts, M.cg, M.m, G, yd, Object.assign({ useStop: true }, bozuk));
      expect(b).toEqual(a);
    });
  });

  test('yakınsayan çözümde tek artım, bölme yok, her iterasyonda bir tanjant', () => {
    DURUMLAR.forEach(([, M, yd, oturan]) => {
      const { r } = coz(M, yd);
      expect(r.checks).toEqual(expect.objectContaining({ converged: true, stopConverged: true, yontem: 'newton',
        artim: 1, kesme: 0, yukOrani: 1, clampCount: oturan }));
      expect(r.checks.tanjant).toBe(r.checks.newtonIters);
    });
  });

  test('varsayılanlar önceki sabitler: tam Newton, arama, 60 iterasyon, 50 tur, durdurucu 100·k, ölçüt 1e-9', () => {
    expect(core.STATIK_VARSAYILAN).toEqual({ yontem: 'newton', arama: true, artim: 1, kesme: 5,
      tolF: 1e-9, tolM: 1e-9, tolU: 0, maxIter: 60, aktifTur: 50, stiffRatio: ORAN });
    expect(Object.isFrozen(core.STATIK_VARSAYILAN)).toBe(true);
  });

  test('solveCaseStop: varsayılanı açıkça veren çağrı ayarsız çağrıyla birebir', () => {
    const T = core.ttarMountsSI(), mp = core.combineMassProps(core.ttarComponentsSI());
    const K = core.buildK(T, mp.cg, false), yd = lc('Max Bump', [0, 0, -3.5]);
    expect(core.solveCaseStop(K, T, mp.cg, mp.m, G, yd, core.STATIK_VARSAYILAN))
      .toEqual(core.solveCaseStop(K, T, mp.cg, mp.m, G, yd));
  });
});

// ═══════════════════ ÜÇ YÖNTEM ═══════════════════

describe('ÜÇ YÖNTEM — newton · modnewton · bfgs, aramalı ve aramasız, aynı dengeye iner', () => {
  const ref = new Map(DURUMLAR.map(([ad, M, yd]) => [ad, coz(M, yd).r]));
  const satir = [];
  DURUMLAR.forEach(([ad, M, yd, oturan]) => YONTEMLER.forEach((y) => [true, false].forEach((ar) =>
    satir.push([ad + ' · ' + y + (ar ? '' : ' · aramasız'), M, yd, oturan, y, ar]))));

  test.each(satir)('%s', (ad, M, yd, oturan, y, ar) => {
    const { r } = coz(M, yd, { yontem: y, arama: ar });
    expect(r.checks.converged).toBe(true);
    expect(r.checks.stopConverged).toBe(true);
    expect(r.checks.yontem).toBe(y);
    expect(r.checks.clampCount).toBe(oturan);
    const R = ref.get(ad.split(' · ').slice(0, 2).join(' · '));
    expect(goreliFark(R, r)).toBeLessThan(1e-8);
    // Denge — bağımsız hakem: iki ölçüt de kendi sınırında
    const h = hakem(M, r);
    expect(h.rF).toBeLessThanOrEqual(1e-9 * h.Fref);
    expect(h.rM).toBeLessThanOrEqual(1e-9 * h.Mref);
    r.perMount.forEach((pm, i) => expect(pm.clamped).toBe(Math.abs(h.d[i][2]) > GAP));   // tümleyenlik
  });

  test('doğrusal takozda üç yöntem de tur başına TEK adımda iner ve solveCaseStop\'a eşittir', () => {
    const T = core.ttarMountsSI(), mp = core.combineMassProps(core.ttarComponentsSI());
    const K = core.buildK(T, mp.cg, false);
    [[lc('Static', [0, 0, -1]), 1], [lc('Max Bump', [0, 0, -3.5]), 2]].forEach(([yd, tur]) => {
      const s = core.solveCaseStop(K, T, mp.cg, mp.m, G, yd, {});
      const sk = Math.max(...s.q.map(Math.abs));
      YONTEMLER.forEach((y) => {
        const r = core.solveCaseNL(T, mp.cg, mp.m, G, yd, { useStop: true, yontem: y });
        expect(r.checks.newtonIters).toBe(tur);                       // aktif küme turu başına bir iterasyon
        expect(r.checks.clampCount).toBe(s.checks.clampCount);
        r.q.forEach((v, i) => expect(Math.abs(v - s.q[i])).toBeLessThan(1e-12 * sk));
      });
    });
  });
});

// ═══════════════════ HIZ ═══════════════════
// Eğrili kutu, Static: durdurucu yok, aktif küme tek tur — iz yalnız yöntemin yakınsaması.

describe('HIZ — Newton kuadratik, değiştirilmiş Newton doğrusal, BFGS süperdoğrusal', () => {
  const N = coz(N1, STATIK), MN = coz(N1, STATIK, { yontem: 'modnewton' }), B = coz(N1, STATIK, { yontem: 'bfgs' });
  const oran = (iz) => iz.slice(1).map((v, i) => v / iz[i]);

  test('newton: r_{k+1}/r_k² sabit (iki kat içinde), her iterasyonda tanjant', () => {
    const c = N.iz.slice(1).map((v, i) => v / (N.iz[i] * N.iz[i]));
    expect(c.length).toBeGreaterThanOrEqual(3);
    expect(Math.max(...c) / Math.min(...c)).toBeLessThan(2);
    expect(N.r.checks.tanjant).toBe(N.r.checks.newtonIters);
  });

  test('modnewton: tek tanjant, oran sabit (doğrusal yakınsama), iterasyon newton\'unkinden çok', () => {
    expect(MN.r.checks.tanjant).toBe(1);
    expect(MN.r.checks.newtonIters).toBeGreaterThan(N.r.checks.newtonIters + 3);
    const kuyruk = oran(MN.iz).slice(-5);
    expect(Math.max(...kuyruk) / Math.min(...kuyruk)).toBeLessThan(1.05);
    expect(kuyruk[0]).toBeGreaterThan(0.01);
    expect(kuyruk[0]).toBeLessThan(0.9);
    // kuadratik DEĞİL: r_{k+1}/r_k² kuyrukta büyüyor (sabit oranda 1/oran katı)
    const t = MN.iz.slice(-4), c = t.slice(1).map((v, i) => v / (t[i] * t[i]));
    expect(c[2]).toBeGreaterThan(10 * c[0]);
  });

  test('bfgs: tek tanjant, oran küçülerek (süperdoğrusal); iterasyon newton ile modnewton arasında', () => {
    [[N1, STATIK], [GENEL, lc('Fren+tork', [-1.2, 0, -1], [-6000, 0, 0])]].forEach(([M, yd]) => {
      const n = coz(M, yd), mn = coz(M, yd, { yontem: 'modnewton' }), b = coz(M, yd, { yontem: 'bfgs' });
      expect(b.r.checks.tanjant).toBe(1);
      expect(b.r.checks.newtonIters).toBeGreaterThanOrEqual(n.r.checks.newtonIters);
      expect(b.r.checks.newtonIters).toBeLessThan(mn.r.checks.newtonIters);
      const o = oran(b.iz).slice(-3);
      expect(o[2]).toBeLessThan(o[1]);
      expect(o[1]).toBeLessThan(o[0]);
      expect(o[2]).toBeLessThan(0.05);
    });
  });

  // Beş takozlu kurguda başlangıç tanjantıyla oran 0,83'e, bölünen artımda 1'e yaklaşıyordu:
  // yalnız artık büyüyünce yenilenen tanjant turu 60 iterasyonda indiremiyordu.
  test('modnewton: artık yarıya inmeyince tanjant yenilenir — kuplajlı modelde bölmesiz, az tanjantla', () => {
    [lc('Static', [0, 0, -1]), lc('Fren+tork', [-1.2, 0, -1], [-6000, 0, 0]), lc('Viraj', [0, 1.5, -1], [0, 0, 2000])]
      .forEach((yd) => {
        const { r } = coz(GENEL, yd, { yontem: 'modnewton' });
        expect(r.checks.converged).toBe(true);
        expect(r.checks.kesme).toBe(0);
        expect(r.checks.newtonIters).toBeLessThan(30);
        expect(r.checks.tanjant).toBeGreaterThan(1);
        expect(r.checks.tanjant).toBeLessThan(r.checks.newtonIters / 3);
      });
  });

  test('onIter her yöntemde iterasyon başına bir kez', () => {
    [N, MN, B].forEach(({ r, iz }) => expect(iz).toHaveLength(r.checks.newtonIters));
    const a = coz(N2, lc('Max Bump', [0, 0, -3.5]), { yontem: 'bfgs', artim: 3 });
    expect(a.iz).toHaveLength(a.r.checks.newtonIters);
  });
});

// ═══════════════════ ARTIM ═══════════════════

describe('ARTIM — N artım tek artımın dengesine iner (elastik, yol bağımsız)', () => {
  const DUR = [['eğrili kutu · Static', N1, STATIK, 0],
               ['kübik kutu · 3,5 g, dört takoz oturur', N2, lc('Max Bump', [0, 0, -3.5]), 4],
               ['beş takoz · fren + tork', GENEL, lc('Fren+tork', [-1.2, 0, -1], [-6000, 0, 0]), 0]];
  const satir = [];
  DUR.forEach((d) => [2, 5, 10].forEach((n) => satir.push([d[0] + ' · ' + n + ' artım', n].concat(d.slice(1)))));

  test.each(satir)('%s', (ad, n, M, yd, oturan) => {
    const tek = coz(M, yd).r, { r } = coz(M, yd, { artim: n });
    expect(r.checks).toEqual(expect.objectContaining({ converged: true, stopConverged: true,
      artim: n, kesme: 0, yukOrani: 1, clampCount: oturan }));
    expect(goreliFark(tek, r)).toBeLessThan(1e-8);
  });

  test('k. artımda yük k/N·F: her artımın ilk artığı ‖F‖/N (önceki artım dengede)', () => {
    [2, 4, 7].forEach((n) => {
      const { r, iz } = coz(N1, STATIK, { artim: n });
      const adim = H.norm(r.F) / n;
      const baslar = iz.filter((v) => Math.abs(v - adim) < 1e-6 * adim);
      expect(baslar).toHaveLength(n);
      expect(iz[0]).toBeCloseTo(adim, 6);
    });
  });
});

// ═══════════════════ KESME ═══════════════════
// Eğrili kutu, denge asimptotun %86'sında: takoz başına x* = −12 mm, F = k0·x*/(1 + x*/xmax).
// Aramasız tam Newton ilk adımda asimptotun ötesine (u < 0,02) atlar ve 60 iterasyonda
// geri gelemez; yük ikiye bölününce ilk adım asimptotun berisinde kalır.

describe('KESME — yakınsamayan artım ikiye bölünür, tükenirse söylenir', () => {
  const X = -12, FM = ASYM.comp.k0 * X / (1 + X / ASYM.comp.xmax);       // N, takoz başına
  const SERT = lc('Asimptot', [0, 0, 4 * FM / (N1.m * G)]);

  test('kesme 0: aramasız Newton yakınsamıyor ve bu SÖYLENİYOR (yük oranı 0)', () => {
    const { r } = coz(N1, SERT, { arama: false, kesme: 0 });
    expect(r.checks).toEqual(expect.objectContaining({ converged: false, kesme: 0, artim: 0, yukOrani: 0,
      newtonIters: core.STATIK_VARSAYILAN.maxIter }));
    expect(r.checks.sumFzOk).toBe(false);
  });

  test('bölme ART ARDA sınırlı: kesme 1 yetmiyor, kesme sayısı 1', () => {
    const { r } = coz(N1, SERT, { arama: false, kesme: 1 });
    expect(r.checks.converged).toBe(false);
    expect(r.checks.kesme).toBe(1);
  });

  test('varsayılan kesme: aramasız Newton iner; sehim kapalı formda, denge bağımsız hakemde', () => {
    const { r } = coz(N1, SERT, { arama: false });
    expect(r.checks).toEqual(expect.objectContaining({ converged: true, stopConverged: true, yukOrani: 1, clampCount: 0 }));
    expect(r.checks.kesme).toBeGreaterThanOrEqual(1);
    expect(r.checks.artim).toBeGreaterThan(1);
    r.perMount.forEach((pm) => expect(Math.abs(pm.delta[2] - X / 1000)).toBeLessThan(1e-10));
    const h = hakem(N1, r);
    expect(h.rF).toBeLessThanOrEqual(1e-9 * h.Fref);
    expect(h.rM).toBeLessThanOrEqual(1e-9 * h.Mref);
    // Aramalı varsayılan yol aynı dengeye bölmesiz iner
    const v = coz(N1, SERT).r;
    expect(v.checks.kesme).toBe(0);
    expect(goreliFark(v, r)).toBeLessThan(1e-8);
  });

  test('sınır art arda bölmenin sınırı, toplamın değil: 3 iterasyonla yol 5\'ten çok bölmeyle tamamlanır', () => {
    const { r } = coz(N1, lc('Bump', [0, 0, -3.5]), { maxIter: 3 });
    expect(r.checks.converged).toBe(true);
    expect(r.checks.kesme).toBeGreaterThan(core.STATIK_VARSAYILAN.kesme);
    expect(goreliFark(coz(N1, lc('Bump', [0, 0, -3.5])).r, r)).toBeLessThan(1e-8);
  });

  // Aktif küme tek turla sınırlı: durdurucuya değen her artım "oturmadı" sayılır. Yol
  // takozlar 15 mm'ye varana dek ilerler, sonra bölme tükenir.
  test('tükenen bölme SON YAKINSAMIŞ durumu döndürür: denge yukOrani·F\'de, aktif küme geri yüklenmiş', () => {
    const { r } = coz(N2, lc('Max Bump', [0, 0, -3.5]), { aktifTur: 1 });
    expect(r.checks.converged).toBe(false);
    expect(r.checks.stopConverged).toBe(false);
    expect(r.checks.yukOrani).toBeGreaterThan(0.5);
    expect(r.checks.yukOrani).toBeLessThan(1);
    expect(r.checks.sumFzOk).toBe(false);                      // tam yük dengelenmedi — söyleniyor
    const h = hakem(N2, r, r.checks.yukOrani);
    expect(h.rF).toBeLessThanOrEqual(1e-9 * h.Fref);
    expect(h.rM).toBeLessThanOrEqual(1e-9 * h.Mref);
    expect(r.checks.clampCount).toBe(0);
    r.perMount.forEach((pm, i) => {
      expect(Math.abs(h.d[i][2])).toBeLessThanOrEqual(GAP);
      expect(Math.abs(pm.f[2] - hakemKuvvet(N2.mounts[i], h.d[i])[2])).toBeLessThan(1e-6);
    });
  });
});

// ═══════════════════ ÖLÇÜT ═══════════════════

describe('ÖLÇÜT — kuvvet ve moment AYRI, maxIter, tolU', () => {
  const M = N1A, YD = lc('Fren+viraj+tork', [-1, 0.5, -1], [3000, 0, 0]);

  // Gevşek ölçütle duran çözümün hakem artığı (rF, rM) iki sınırın ikisini de sınar:
  // eşik artığın %90'ına çekilirse çözücü devam eder, %110'una çekilirse aynı yerde durur.
  test('her ölçüt kendi sınırında durdurur: F_ref = ‖F‖ + m·g, M_ref = ‖T‖ + m·g·L_ref', () => {
    const L = coz(M, YD, { tolF: 1e-4, tolM: 1e-4 }).r, h = hakem(M, L);
    const n = L.checks.newtonIters;
    expect(L.checks.converged).toBe(true);
    expect(h.rF).toBeLessThanOrEqual(1e-4 * h.Fref);
    expect(h.rM).toBeLessThanOrEqual(1e-4 * h.Mref);
    expect(n).toBeLessThan(coz(M, YD).r.checks.newtonIters);            // gevşek ölçüt erken durdu
    const it = (o) => coz(M, YD, o).r.checks.newtonIters;
    expect(it({ tolF: 0.9 * h.rF / h.Fref, tolM: 1e-4 })).toBeGreaterThan(n);
    expect(it({ tolF: 1e-4, tolM: 0.9 * h.rM / h.Mref })).toBeGreaterThan(n);
    expect(it({ tolF: 1.1 * h.rF / h.Fref, tolM: 1.1 * h.rM / h.Mref })).toBe(n);
  });

  test('maxIter tükenince converged=false bildiriliyor', () => {
    const { r, iz } = coz(N1, STATIK, { maxIter: 2, kesme: 0 });
    expect(r.checks.converged).toBe(false);
    expect(r.checks.newtonIters).toBe(2);
    expect(iz).toHaveLength(2);
  });

  test('tolU açıkken denge aynı; doğrusal takozda ölçüt bir düzeltme daha ister', () => {
    DURUMLAR.forEach(([, Md, yd]) => {
      const a = coz(Md, yd).r, b = coz(Md, yd, { tolU: 1e-10 }).r;
      expect(b.checks.converged).toBe(true);
      expect(b.checks.newtonIters).toBeGreaterThanOrEqual(a.checks.newtonIters);
      expect(goreliFark(a, b)).toBeLessThan(1e-8);
      const h = hakem(Md, b);
      expect(h.rF).toBeLessThanOrEqual(1e-9 * h.Fref);
      expect(h.rM).toBeLessThanOrEqual(1e-9 * h.Mref);
    });
    const T = core.ttarMountsSI(), mp = core.combineMassProps(core.ttarComponentsSI());
    const r0 = core.solveCaseNL(T, mp.cg, mp.m, G, STATIK, { useStop: true });
    const r1 = core.solveCaseNL(T, mp.cg, mp.m, G, STATIK, { useStop: true, tolU: 1e-10 });
    expect([r0.checks.newtonIters, r1.checks.newtonIters]).toEqual([1, 2]);
    const sk = Math.max(...r0.q.map(Math.abs));
    r1.q.forEach((v, i) => expect(Math.abs(v - r0.q[i])).toBeLessThan(1e-12 * sk));
  });

  test('aktifTur: tek tur durdurucuya oturan durumu kapatamaz — solveCaseStop söylüyor', () => {
    const T = core.ttarMountsSI(), mp = core.combineMassProps(core.ttarComponentsSI());
    const K = core.buildK(T, mp.cg, false), yd = lc('Max Bump', [0, 0, -3.5]);
    expect(core.solveCaseStop(K, T, mp.cg, mp.m, G, yd, { aktifTur: 1 }).checks.stopConverged).toBe(false);
    expect(core.solveCaseStop(K, T, mp.cg, mp.m, G, yd, { aktifTur: 2 }).checks.stopConverged).toBe(true);
  });

  test('solveAllCases seçenekleri Newton yoluna geçirir', () => {
    const model = { m: N2.m, cg: N2.cg, mounts: N2.mounts, g: G, Kstat: core.buildK(N2.mounts, N2.cg, false) };
    core.solveAllCases(model, [STATIK, lc('Max Bump', [0, 0, -3.5])], { useStop: true, yontem: 'bfgs', artim: 3 })
      .forEach((rc) => expect(rc.res.checks).toEqual(expect.objectContaining({ yontem: 'bfgs', artim: 3, converged: true })));
  });
});

// ═══════════════════ AYAR ═══════════════════

describe('AYAR — statikAyar: bozuk değer varsayılana, aralık dışı değer sınıra', () => {
  const V = core.STATIK_VARSAYILAN, AR = core.STATIK_ARALIK, ayar = core.statikAyar;

  test('girdisiz ya da nesne olmayan girdi → varsayılanlar (yeni nesne); bilinmeyen anahtar atılır', () => {
    [undefined, null, {}, 'newton', 42].forEach((h) => expect(ayar(h)).toEqual(V));
    expect(ayar()).not.toBe(V);
    expect(Object.keys(ayar({ foo: 1, gap: 0.01, onIter: () => 0 }))).toEqual(Object.keys(V));
  });

  test('her ayarın aralığı var, varsayılan aralığın içinde', () => {
    expect(Object.keys(AR).sort()).toEqual(Object.keys(V).sort());
    Object.keys(V).forEach((ad) => {
      const ar = AR[ad];
      if (ar.secenek) expect(ar.secenek).toContain(V[ad]);
      else if (!(ar.kapali != null && V[ad] === ar.kapali)) {
        expect(V[ad]).toBeGreaterThanOrEqual(ar.min);
        expect(V[ad]).toBeLessThanOrEqual(ar.max);
      }
    });
  });

  test('sayı alanları: aralık dışı → sınır, sayı olmayan → varsayılan, tam sayı yuvarlanır, metin sayı okunur', () => {
    Object.keys(AR).filter((ad) => !AR[ad].secenek).forEach((ad) => {
      const ar = AR[ad];
      expect(ayar({ [ad]: ar.max * 10 })[ad]).toBe(ar.max);
      expect(ayar({ [ad]: ar.min / 10 - 1 })[ad]).toBe(ar.kapali != null ? ar.kapali : ar.min);
      ['abc', '', null, true, NaN, Infinity, [], {}].forEach((v) => expect(ayar({ [ad]: v })[ad]).toBe(V[ad]));
      expect(ayar({ [ad]: String(ar.max) })[ad]).toBe(ar.max);
    });
    expect(ayar({ artim: 2.6 }).artim).toBe(3);
    expect(ayar({ artim: '4' }).artim).toBe(4);
    expect(ayar({ kesme: 0 }).kesme).toBe(0);
    expect(ayar({ tolF: 0 }).tolF).toBe(AR.tolF.min);
    expect(ayar({ tolM: 1e-6 }).tolM).toBe(1e-6);
    expect(ayar({ stiffRatio: 250 }).stiffRatio).toBe(250);
  });

  test('tolU: 0 ya da eksi → kapalı; sıfırdan büyük değer [min, max] içine', () => {
    expect(ayar({ tolU: 0 }).tolU).toBe(0);
    expect(ayar({ tolU: -1 }).tolU).toBe(0);
    expect(ayar({ tolU: 1e-20 }).tolU).toBe(AR.tolU.min);
    expect(ayar({ tolU: 1e-8 }).tolU).toBe(1e-8);
    expect(ayar({ tolU: 0.5 }).tolU).toBe(AR.tolU.max);
  });

  test('seçenek alanları: yalnız tanımlı değer, başkası varsayılan', () => {
    YONTEMLER.forEach((y) => expect(ayar({ yontem: y }).yontem).toBe(y));
    ['BFGS', 'Newton', 'quasi', 1, null].forEach((y) => expect(ayar({ yontem: y }).yontem).toBe(V.yontem));
    expect(ayar({ arama: false }).arama).toBe(false);
    ['false', 0, null].forEach((a) => expect(ayar({ arama: a }).arama).toBe(V.arama));
  });
});
