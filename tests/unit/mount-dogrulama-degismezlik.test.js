/**
 * Takoz doğrulaması — DEĞİŞMEZLİK, DENGE ve BAĞIMSIZ TÜRETİM bataryası
 * ─────────────────────────────────────────────────────────────────────
 * Kapalı formu olmayan (simetrisiz, gerçekçi) modellerde hakem, iki çözüm
 * arasındaki BİLİNEN ilişkidir. Aynı batarya altı modelin her birine uygulanır:
 * depodaki üç gerçek örnek (SİPER, TULGA, ASFAT), simetrisiz bir kurgu model ve
 * ikisinin nonlineer (Newton) varyantı.
 *
 *   denge       Σ Aᵢᵀ fᵢ = F — kuvvet VE moment (kod yalnız ΣFz'yi denetliyor)
 *   öteleme     bütün konumlar kaydırılınca hiçbir sonuç değişmez
 *   sıra        takoz sırası ters çevrilince sonuç da ters sırayla aynıdır
 *   ayna        y → −y: sol/sağ yük durumları yer değiştirir, δy işaret değiştirir
 *   bölme       gövdeyi iki parçaya, takozu iki yarım takoza bölmek fiziği değiştirmez
 *   ölçek       kütle × α → f/√α, statik × α; rijitlik × β → f·√β, statik / β
 *   Hessian     K = sonlu dönmeli potansiyel enerjinin Hessian'ı (kodun A'sı kullanılmadan)
 *   özdeğer     artık, M-dikgenlik, iz ve determinant
 *   FRF         karmaşık DOĞRUDAN çözüm = programın 12×12 gerçel açılımı
 *   doğrusallaştırma  küçük-dönme varsayımının sehim hatası ölçülür
 *
 * Hakem tarafı çekirdeği çağırmaz (tests/helpers/takoz-dogrulama.js).
 */
const H = require('../helpers/takoz-dogrulama.js');
const { core, cp, rp } = H.kur();
const G = H.G, GAP = 0.015, ORAN = 100;
const LIB = cp.VE_MOUNT_LIBRARY;

const MOTOR = { Te: 900, Rstall: 1.8, g1: 3.5, g2: 2, gR: -3.2, idleRpm: 700, cylinders: 6 };
const MODELLER = [
  { ad: 'SİPER', topo: H.ornek('siper'), lineer: true },
  { ad: 'TULGA', topo: H.ornek('tulga'), lineer: true },
  { ad: 'ASFAT', topo: H.ornek('asfat'), lineer: true },
  { ad: 'Genel kurgu', topo: H.kurguModel(H.genelModel({ motor: MOTOR })), lineer: true },
  { ad: 'TULGA + TK yasaları', topo: H.yasaTak(H.ornek('tulga'), LIB), lineer: false },
  { ad: 'Genel kurgu nonlineer', topo: H.kurguModel(H.genelModel({ motor: MOTOR, nonlineer: true })), lineer: false }
];
MODELLER.forEach((M) => { M.R = H.coz(M.topo); });

const tum = (R) => R.allCases.concat(R.designCases || [], R.gearCases || []);
const bul = (R, ad) => tum(R).find((c) => c.name === ad);
const dVec = (mt, cg) => [0, 1, 2].map((j) => mt.pos[j] - cg[j]);
const tabanK = (R) => R.kBasis || R.mounts.map((m) => m.kdyn);
// Modele uygulanmayan test (ölçek yalnız lineerde, tanjant tabanı yalnız nonlineerde)
// hiç TANIMLANMAZ: test.skip jest'te "atlandı" sayılır ve devre dışı test sanılır.
const yok = () => {};

// Takozun ilettiği kuvvet — HAKEM yazımı: yasa (fit) ya da lineer k_stat, artı
// aktif durdurucu teması k_stop·(δz ∓ gap), k_stop = 100·k_z,stat.
function kuvvetHakem(mt, d, clamped) {
  const f = [0, 1, 2].map((a) => {
    const fit = mt.fits && mt.fits[['x', 'y', 'z'][a]];
    return fit ? H.fitKuvvet(fit, d[a] * 1000) : mt.kstat[a] * d[a];
  });
  if (clamped) f[2] += ORAN * mt.kstat[2] * (d[2] - Math.sign(d[2]) * GAP);
  return f;
}

// İki çözümü takoz eşlemesiyle kıyasla: map(i) → B'deki takoz indisi.
function sehimKiyas(RA, RB, mapI, caseMap, donustur) {
  let enBuyuk = 0, sayi = 0;
  tum(RA).forEach((rc) => {
    const adB = caseMap ? caseMap(rc.name) : rc.name;
    if (!adB || !rc.res) return;
    const rb = bul(RB, adB);
    rc.res.perMount.forEach((pm, i) => {
      const exp = donustur ? donustur(pm.delta) : pm.delta;
      const got = rb.res.perMount[mapI(i)].delta;
      for (let a = 0; a < 3; a++) enBuyuk = Math.max(enBuyuk, Math.abs(got[a] - exp[a]));
    });
    sayi++;
  });
  return { enBuyuk, sayi };
}
const modKiyas = (RA, RB, olcek) => Math.max(...RA.modes.map((md, i) => H.bagil(RB.modes[i].f_Hz, md.f_Hz * (olcek || 1))));

describe.each(MODELLER.map((M) => [M.ad, M]))('%s', (ad, M) => {
  const R = M.R;

  test('çözüm tam: bütün yük durumları çözüldü, modal ve sönüm üretildi', () => {
    expect(tum(R).every((rc) => rc.res)).toBe(true);
    expect(R.modes).toHaveLength(6);
    expect(R.damping).toBeTruthy();
    expect(R.solvedNL).toBe(!M.lineer);
  });

  test('kütle özellikleri bağımsız paralel eksen hesabıyla aynı', () => {
    const mk = H.birlesikKutle(R.components);
    expect(H.bagil(R.mp.m, mk.m)).toBeLessThan(1e-14);
    for (let i = 0; i < 3; i++) {
      expect(Math.abs(R.mp.cg[i] - mk.cg[i])).toBeLessThan(1e-13);
      for (let j = 0; j < 3; j++) expect(Math.abs(R.mp.I_G[i][j] - mk.I[i][j])).toBeLessThan(1e-10 * (1 + Math.abs(mk.I[i][j])));
    }
  });

  test('6 bileşenli denge Σ Aᵀf = F — kuvvetler HAKEM yasasıyla, durdurucu dâhil', () => {
    let enBuyuk = 0;
    tum(R).forEach((rc) => {
      const fList = rc.res.perMount.map((pm, i) => kuvvetHakem(R.mounts[i], pm.delta, pm.clamped));
      const s = H.genelKuvvet(R.mounts, R.mp.cg, fList);
      const olc = H.norm(rc.res.F) + R.mp.m * G;
      enBuyuk = Math.max(enBuyuk, H.norm(s.map((v, c) => v - rc.res.F[c])) / olc);
    });
    expect(enBuyuk).toBeLessThan(M.lineer ? 1e-12 : 1e-8);   // Newton toleransı 1e-9·(‖F‖ + mg)
  });

  test('öteleme: bütün konumlar (1234,5; −678,9; 345,6) mm kaydırılınca hiçbir sonuç değişmez', () => {
    const RB = H.coz(H.otele(M.topo, [1234.5, -678.9, 345.6]));
    expect(sehimKiyas(R, RB, (i) => i).enBuyuk).toBeLessThan(1e-11);
    expect(modKiyas(R, RB)).toBeLessThan(1e-10);
    R.damping.forEach((dm, i) => dm.c.forEach((c, a) => expect(H.bagil(RB.damping[i].c[a], c)).toBeLessThan(1e-10)));
  });

  test('takoz sırası ters çevrilince sonuç da ters sırayla aynı', () => {
    const RB = H.coz(H.takozSirasiTers(M.topo)), n = R.mounts.length;
    expect(sehimKiyas(R, RB, (i) => n - 1 - i).enBuyuk).toBeLessThan(1e-11);
    expect(modKiyas(R, RB)).toBeLessThan(1e-10);
    R.damping.forEach((dm, i) => dm.c.forEach((c, a) => expect(H.bagil(RB.damping[n - 1 - i].c[a], c)).toBeLessThan(1e-10)));
  });

  test('ayna y → −y: sol/sağ durumları yer değiştirir, δy işaret değiştirir, frekanslar aynı', () => {
    const RB = H.coz(H.aynala(M.topo));
    const esle = { 'Cornering Left': 'Cornering Right', 'Cornering Right': 'Cornering Left',
                   'Brake in Turn L': 'Brake in Turn R', 'Brake in Turn R': 'Brake in Turn L',
                   'Kerb Strike L': 'Kerb Strike R', 'Kerb Strike R': 'Kerb Strike L' };
    const kendisi = ['Static', 'Max Bump', 'Braking', 'Acceleration', 'Pothole Braking', 'Max Rebound',
                     '3,5g Düşey', '1g Boyuna (fren)'];
    const k = sehimKiyas(R, RB, (i) => i, (nm) => esle[nm] || (kendisi.indexOf(nm) >= 0 ? nm : null),
                         (d) => [d[0], -d[1], d[2]]);
    expect(k.sayi).toBe(14);
    expect(k.enBuyuk).toBeLessThan(1e-11);
    expect(modKiyas(R, RB)).toBeLessThan(1e-10);
  });

  test('gövdeyi iki parçaya bölmek (aynı kütle, AM, tensör) sonucu değiştirmez', () => {
    const govdeler = M.topo.nodes.filter((n) => n.data && n.data.mass != null && n.type !== 'mnt-mount' && !n.data.pointMass);
    const en = govdeler.reduce((a, b) => (Number(b.data.mass) > Number(a.data.mass) ? b : a));
    const RB = H.coz(H.govdeBol(M.topo, en.id, [80, -50, 40]));
    expect(RB.components.length).toBe(R.components.length + 1);
    expect(sehimKiyas(R, RB, (i) => i).enBuyuk).toBeLessThan(1e-11);
    expect(modKiyas(R, RB)).toBeLessThan(1e-9);
    R.damping.forEach((dm, i) => dm.c.forEach((c, a) => expect(H.bagil(RB.damping[i].c[a], c)).toBeLessThan(1e-9)));
  });

  test('takozu aynı noktada iki yarım takoza bölmek sonucu değiştirmez (sönüm dâhil)', () => {
    const ilk = M.topo.nodes.find((n) => n.type === 'mnt-mount');
    const RB = H.coz(H.takozBol(M.topo, ilk.id));
    const k = sehimKiyas(R, RB, (i) => (i === 0 ? 0 : i + 1));
    expect(k.enBuyuk).toBeLessThan(1e-11);
    tum(R).forEach((rc) => {        // iki yarım AYNI sehimde, her biri yarım kuvvet taşır
      const rb = bul(RB, rc.name).res;
      for (let a = 0; a < 3; a++) {
        expect(Math.abs(rb.perMount[1].delta[a] - rb.perMount[0].delta[a])).toBeLessThan(1e-15);
        expect(Math.abs(rb.perMount[0].f[a] + rb.perMount[1].f[a] - rc.res.perMount[0].f[a])).toBeLessThan(1e-6 * (1 + Math.abs(rc.res.perMount[0].f[a])));
      }
    });
    expect(modKiyas(R, RB)).toBeLessThan(1e-10);
    // c = 2ζ√(k·m): yarım rijitlik × yarım yük payı → yarım sönüm, toplam aynı
    R.damping[0].c.forEach((c, a) => expect(H.bagil(RB.damping[0].c[a] + RB.damping[1].c[a], c)).toBeLessThan(1e-10));
    const MA = core.buildM6(R.mp.m, R.mp.I_G);
    [2, 8, 30].forEach((f) => [0, 1, 2].forEach((dir) => {
      expect(H.bagil(core.frfAt(RB.mounts, RB.mp.cg, MA, RB.damping, f, dir),
                     core.frfAt(R.mounts, R.mp.cg, MA, R.damping, f, dir))).toBeLessThan(1e-9);
    }));
  });

  (M.lineer ? test : yok)('kütle × 1,3 → f/√1,3 · statik sehim × 1,3 · mod sönümü aynı · T(f) = T₀(f·√1,3)', () => {
    const a = 1.3, RB = H.coz(H.kutleOlcek(M.topo, a));
    expect(modKiyas(R, RB, 1 / Math.sqrt(a))).toBeLessThan(1e-10);
    R.modalDamping.forEach((md, i) => expect(H.bagil(RB.modalDamping[i].zeta, md.zeta)).toBeLessThan(1e-9));
    let n = 0;
    R.allCases.forEach((rc) => {
      const rb = bul(RB, rc.name).res;
      if (rc.res.checks.clampCount || rb.checks.clampCount) return;
      rc.res.perMount.forEach((pm, i) => pm.delta.forEach((v, k) => expect(Math.abs(rb.perMount[i].delta[k] - a * v)).toBeLessThan(1e-12)));
      n++;
    });
    expect(n).toBeGreaterThan(4);
    const MA = core.buildM6(R.mp.m, R.mp.I_G), MB = core.buildM6(RB.mp.m, RB.mp.I_G);
    [1.5, 6, 25].forEach((f) => expect(H.bagil(core.frfAt(RB.mounts, RB.mp.cg, MB, RB.damping, f, 2),
      core.frfAt(R.mounts, R.mp.cg, MA, R.damping, f * Math.sqrt(a), 2))).toBeLessThan(1e-9));
  });

  (M.lineer ? test : yok)('rijitlik × 0,7 → f·√0,7 · statik sehim / 0,7 · mod sönümü aynı', () => {
    const b = 0.7, RB = H.coz(H.rijitlikOlcek(M.topo, b));
    expect(modKiyas(R, RB, Math.sqrt(b))).toBeLessThan(1e-10);
    R.modalDamping.forEach((md, i) => expect(H.bagil(RB.modalDamping[i].zeta, md.zeta)).toBeLessThan(1e-9));
    let n = 0;
    R.allCases.forEach((rc) => {
      const rb = bul(RB, rc.name).res;
      if (rc.res.checks.clampCount || rb.checks.clampCount) return;
      rc.res.perMount.forEach((pm, i) => pm.delta.forEach((v, k) => expect(Math.abs(rb.perMount[i].delta[k] - v / b)).toBeLessThan(1e-12)));
      n++;
    });
    expect(n).toBeGreaterThan(4);
  });

  test('K = sonlu dönmeli potansiyel enerjinin Hessian\'ı (statik ve dinamik taban)', () => {
    const ms = R.mounts, cg = R.mp.cg, q0 = [0, 0, 0, 0, 0, 0];
    const kiyas = (kList, Kkod) => {
      const Hs = H.sayisalHessian((q) => H.potansiyel(ms, cg, kList, q), q0, 1e-4);
      const sc = H.maksMutlak(Kkod);
      let d = 0;
      for (let i = 0; i < 6; i++) for (let j = 0; j < 6; j++) d = Math.max(d, Math.abs(Hs[i][j] - Kkod[i][j]));
      return d / sc;
    };
    expect(kiyas(ms.map((m) => m.kstat), core.buildK(ms, cg, false))).toBeLessThan(1e-7);
    const kb = tabanK(R);
    expect(kiyas(kb, core.buildKfromBasis(ms, cg, kb))).toBeLessThan(1e-7);
  });

  // Tek taban kuralı (dynStiffBasis): SDOF kestirimi ve yumuşatma taraması modal
  // çözümle AYNI k'den. Lineerde taban nominal k_dyn, nonlineerde statik dengedeki
  // dinamik tanjant — ikisinde de §8.15'in "%100 satırı = §8.7" iddiası doğru olmalı.
  test('SDOF f_bounce ve §8.15 %100 satırı modal tabandan (Σk_z · 6 mod)', () => {
    const fb = H.fHz(tabanK(R).reduce((a, k) => a + k[2], 0) / R.mp.m);
    expect(H.bagil(rp._mntRepIsolation(R, {}).fBounce, fb)).toBeLessThan(1e-12);
    const h = rp._mntRepSoftening(R, {});
    const v = [...h.split('<tr').find((r) => r.includes('<b>%100</b>'))
      .matchAll(/<td>([^<%]*)<\/td>/g)].map((m) => veSayiOku(m[1]));
    R.modes.forEach((md, i) => expect(Math.abs(v[i] - md.f_Hz)).toBeLessThanOrEqual(0.005 + 1e-9));
    expect(Math.abs(v[6] - fb)).toBeLessThanOrEqual(0.005 + 1e-9);
  });

  (M.lineer ? yok : test)('nonlineer: dinamik tanjant tabanı = yasanın statik dengedeki türevi × k_din/k_stat', () => {
    const st = bul(R, 'Static').res;
    R.mounts.forEach((mt, i) => {
      [0, 1, 2].forEach((a) => {
        const fit = mt.fits && mt.fits[['x', 'y', 'z'][a]];
        const kt = fit ? H.fitTanjant(fit, st.perMount[i].delta[a] * 1000) * 1000 : mt.kstat[a];
        expect(H.bagil(R.kBasis[i][a], kt * mt.kdyn[a] / mt.kstat[a])).toBeLessThan(1e-6);
      });
    });
  });

  test('özdeğer çözümü: artık, M-dikgenlik, Σω² = iz(M⁻¹K), Πω² = det K / det M', () => {
    const mk = H.birlesikKutle(R.components), Mm = H.M6of(mk.m, mk.I);
    const K = H.topla6(R.mounts, R.mp.cg, tabanK(R));
    const w2 = R.modes.map((md) => (2 * Math.PI * md.f_Hz) ** 2);
    R.modes.forEach((md, r) => {
      const Kp = H.matVek(K, md.phi), Mp = H.matVek(Mm, md.phi);
      expect(H.norm(Kp.map((v, i) => v - w2[r] * Mp[i])) / H.norm(Kp)).toBeLessThan(1e-9);
      R.modes.forEach((m2, s) => {
        if (s <= r) return;
        const mrs = H.noktaCarp(md.phi, H.matVek(Mm, m2.phi));
        const nrm = Math.sqrt(H.noktaCarp(md.phi, Mp) * H.noktaCarp(m2.phi, H.matVek(Mm, m2.phi)));
        expect(Math.abs(mrs) / nrm).toBeLessThan(1e-9);
      });
    });
    let iz = 0;
    for (let j = 0; j < 6; j++) iz += H.coz6(Mm, K.map((row) => row[j]))[j];
    expect(H.bagil(w2.reduce((s, v) => s + v, 0), iz)).toBeLessThan(1e-9);
    expect(H.bagil(w2.reduce((p, v) => p * v, 1), H.det(K) / H.det(Mm))).toBeLessThan(1e-8);
  });

  test('FRF: karmaşık doğrudan çözüm = programın 12×12 gerçel açılımı (3 yön, rezonans yakını dâhil)', () => {
    const mk = H.birlesikKutle(R.components), Mm = H.M6of(mk.m, mk.I);
    const kb = tabanK(R), cl = R.damping.map((d) => d.c);
    const K = H.topla6(R.mounts, R.mp.cg, kb), Cm = H.topla6(R.mounts, R.mp.cg, cl);
    const M6 = core.buildM6(R.mp.m, R.mp.I_G);
    const fl = [0.5, R.modes[0].f_Hz, 1.03 * R.modes[3].f_Hz, 2 * R.modes[5].f_Hz, 45];
    fl.forEach((f) => [0, 1, 2].forEach((dir) => {
      const hakem = H.frfHakem(R.mounts, R.mp.cg, Mm, K, Cm, kb, cl, f, dir);
      expect(H.bagil(core.frfAt(R.mounts, R.mp.cg, M6, R.damping, f, dir), hakem)).toBeLessThan(1e-8);
    }));
  });

  (M.lineer ? test : yok)('küçük-dönme doğrusallaştırması: tam geometrik dengeyle sehim farkı %1\'in altında', () => {
    // Ölçülen (2026-10-16): en kötü durum bordür darbesi, |θ| 10–17 mrad, fark
    // %0,15–0,6 (≤ 0,08 mm). Durgun durumda ≤ %0,08. Model bu yüklerde küçük
    // dönme varsayımının içinde kalıyor; bu kapı varsayımın sınırını izler.
    const ms = R.mounts, cg = R.mp.cg, ks = ms.map((m) => m.kstat);
    const V = (q) => H.potansiyel(ms, cg, ks, q);
    let enKotu = 0;
    ['Static', 'Braking', 'Cornering Left', 'Kerb Strike L'].forEach((nm) => {
      const rc = bul(R, nm);
      if (rc.res.checks.clampCount) return;
      const F = rc.res.F;
      let q = rc.res.q.slice();
      for (let it = 0; it < 20; it++) {
        const r = H.sayisalGradyan(V, q, 1e-7).map((v, i) => v - F[i]);
        if (H.norm(r) < 1e-9 * H.norm(F)) break;
        const dq = H.coz6(H.sayisalHessian(V, q, 1e-5), r.map((v) => -v));
        q = q.map((v, i) => v + dq[i]);
      }
      let maxD = 0, maxE = 0;
      ms.forEach((mt, i) => {
        const ex = H.sehimSonlu(q, dVec(mt, cg)), li = rc.res.perMount[i].delta;
        for (let a = 0; a < 3; a++) { maxD = Math.max(maxD, Math.abs(li[a])); maxE = Math.max(maxE, Math.abs(ex[a] - li[a])); }
      });
      enKotu = Math.max(enKotu, maxE / maxD);
    });
    expect(enKotu).toBeGreaterThan(0);
    expect(enKotu).toBeLessThan(0.01);
  });
});
