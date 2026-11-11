/**
 * Yanal durdurucu (F006) — takoz başına `gapY` [m]: yanal (y) sehim ±gapY'de
 * metal-metal temasa oturur (k_stop = 100·ky). Kapılar:
 *   TANIMSIZ  → sonuç birebir eski (TTAR Adams'la durdurucusuz örtüşüyor).
 *   TANIMLI   → takoz boşlukta kesilir, ΣFy dış yükü taşır, temas yükü öne çeker.
 *   İKİ YOL   → lineer (solveCaseStop) ve Newton (solveCaseNL) aynı sonucu verir.
 */
const core = require('../../js/mount-core.js');

const k = (s) => s * 1000;                             // N/mm → N/m
function model(gapY) {
  const mounts = [
    { name: 'SağÖn', pos: [-0.3,  0.35, 0.1], kstat: [k(500), k(260), k(240)], kdyn: [k(700), k(350), k(330)] },
    { name: 'SolÖn', pos: [-0.3, -0.35, 0.1], kstat: [k(500), k(260), k(240)], kdyn: [k(700), k(350), k(330)] },
    { name: 'SağArka', pos: [0.9,  0.30, 0.0], kstat: [k(400), k(210), k(190)], kdyn: [k(500), k(250), k(230)] },
    { name: 'SolArka', pos: [0.9, -0.30, 0.0], kstat: [k(400), k(210), k(190)], kdyn: [k(500), k(250), k(230)] },
  ];
  if (gapY != null) { mounts[0].gapY = gapY; mounts[1].gapY = gapY; }
  return { mounts, cg: [0.2, 0, 0.3], m: 900, g: 9.81 };
}
const KERB = { name: 'Kerb', n: [0, -1.55, -1], T: [0, 0, 0] };
const solve = (M, lc) => core.solveCaseStop(core.buildK(M.mounts, M.cg, false), M.mounts, M.cg, M.m, M.g, lc, {});
const dy = (res, i) => res.perMount[i].delta[1] * 1000;

describe('YANAL DURDURUCU', () => {
  const serbest = solve(model(null), KERB);

  test('kaldırım durumunda ön takozlar boşluğu aşıyor (modelin ön koşulu)', () => {
    expect(Math.abs(dy(serbest, 0))).toBeGreaterThan(6);
    expect(serbest.checks.clampYCount).toBe(0);
  });

  test('TANIMSIZ ya da ulaşılmayan boşluk: sonuç birebir eski', () => {
    [solve(model(0), KERB), solve(model(1), KERB)].forEach((r) => {
      expect(r.q).toEqual(serbest.q);
      expect(r.checks.clampYCount).toBe(0);
    });
  });

  test('TANIMLI: ön takozlar ±boşlukta kesilir, ΣFy dış yükü taşır, arka yük alır', () => {
    const r = solve(model(0.006), KERB);
    expect(r.checks.clampYCount).toBe(2);
    [0, 1].forEach((i) => {
      expect(Math.abs(dy(r, i))).toBeGreaterThan(6);
      expect(Math.abs(dy(r, i))).toBeLessThan(6.2);           // sonlu rijit temas, ~0,1 mm
      expect(r.perMount[i].clampedY).toBe(true);
    });
    const Fy = r.perMount.reduce((s, p) => s + p.f[1], 0);
    expect(Fy).toBeCloseTo(r.F[1], 3);
    // Temas ön takozu SERTLEŞTİRİR: kuvvet k·boşluğu aşar, yük öne çekilir — arka azalır.
    [0, 1].forEach((i) => expect(Math.abs(r.perMount[i].f[1])).toBeGreaterThan(260e3 * 0.006 * 1.05));
    [2, 3].forEach((i) => expect(Math.abs(dy(r, i))).toBeLessThan(Math.abs(dy(serbest, i))));
    expect(r.perMount[2].clamped).toBe(false);                 // düşey durdurucu ayrı
  });

  test('İKİ YOL: Newton yolu lineer yolla aynı', () => {
    const M = model(0.006);
    // Doğrusal 2 noktalı eğri → Newton yoluna girer, fizik aynı
    M.mounts.forEach((m) => { m.curves = { z: [[-0.05, -m.kstat[2] * 0.05], [0.05, m.kstat[2] * 0.05]] }; });
    expect(core.anyCurve(M.mounts)).toBe(true);
    const nl = core.solveCaseNL(M.mounts, M.cg, M.m, M.g, KERB, { useStop: true });
    const li = solve(model(0.006), KERB);
    expect(nl.checks.clampYCount).toBe(2);
    nl.q.forEach((v, i) => expect(v).toBeCloseTo(li.q[i], 7));
  });

  test('useStop kapalı Newton yolu yanal durdurucuyu da kapatır', () => {
    const M = model(0.006);
    M.mounts.forEach((m) => { m.curves = { z: [[-0.05, -m.kstat[2] * 0.05], [0.05, m.kstat[2] * 0.05]] }; });
    expect(core.solveCaseNL(M.mounts, M.cg, M.m, M.g, KERB, { useStop: false }).checks.clampYCount).toBe(0);
  });
});
