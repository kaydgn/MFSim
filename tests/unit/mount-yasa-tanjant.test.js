/**
 * mount-yasa-tanjant.test.js — TAKOZ YASASININ TANJANTI KUVVETİNİN TÜREVİ
 * ─────────────────────────────────────────────────────────────────────────
 * Newton–Raphson'ın kuadratik yakınsaması tanjant rijitliğin kuvvetin GERÇEK
 * türevi olmasına bağlıdır (K_T = Σ Aᵀ·φ′·A). Tutarsız tanjant sonucu bozmaz —
 * artık kuvvetten hesaplanır, denge yine doğru çıkar — ama Newton'u doğrusal
 * yakınsamaya düşürür: SESSİZ bir hata (statik çözücünün ajanı ölçtü, 2026-11-13).
 * Asimptotlu basma yasası ('asym') kırpma sınırının ötesinde kuvveti k0·x/EPS
 * (eğim k0/EPS) sürdürürken tanjantı k0/EPS² yazıyordu: 50 kat. Düzeltme: kuvvet
 * sınırdaki teğetle sürer (C¹), "asimptot ötesi sonlu ama çok sert".
 *
 *   · TÜREV — dört biçimde (doğrusal · nokta tablosu · polinom · asimptotlu) tanjant,
 *     kuvvetin merkezi farkıyla bütün aralıkta (tablonun ve kırpmanın ötesi dâhil).
 *   · C¹ — asimptotlu yasa kırpma sınırında kuvvet ve eğim sürekli.
 *   · NEWTON — asimptotu aşan yükte tam Newton kuadratik yakınsar.
 */
const core = require('../../js/mount-core.js');

const MM = 1e-3;
const fark = (law, d, h) => (law.force(d + h) - law.force(d - h)) / (2 * h);
function turevTutarli(law, araliklar, h) {
  araliklar.forEach((d) => {
    const fd = fark(law, d, h), kt = law.tangent(d);
    expect([d, Math.abs(kt - fd) / Math.max(Math.abs(fd), 1)]).toEqual([d, expect.any(Number)]);
    expect(Math.abs(kt - fd)).toBeLessThanOrEqual(1e-5 * Math.max(Math.abs(fd), 1));
  });
}
const izgara = (a, b, n) => Array.from({ length: n }, (_, i) => a + (b - a) * (i + 0.5) / n);

describe('TÜREV — tanjant kuvvetin türevi, bütün aralıkta', () => {
  test('doğrusal', () => {
    turevTutarli(core.makeAxisLaw({ type: 'linear', k: 1.2e6 }), izgara(-0.05, 0.05, 21), 1e-7);
  });
  test('nokta tablosu (monoton kübik) — tablonun içi ve iki dışı', () => {
    const law = core.makeAxisLaw({ type: 'curve', points: [[-0.012, -24000], [-0.006, -8000], [0, 0], [0.004, 3000], [0.01, 6000]] });
    turevTutarli(law, izgara(-0.03, 0.03, 61), 1e-8);
  });
  test('polinom (radyal fit)', () => {
    turevTutarli(core.makeAxisLaw({ form: 'poly', k0: 800, c3: 2.5, c5: 0.01 }), izgara(-0.02, 0.02, 41), 1e-8);
  });
  test('asimptotlu (eksenel fit) — kırpma sınırının ötesi dâhil', () => {
    const xmax = 12;                                                // mm
    const law = core.makeAxisLaw({ form: 'asym', comp: { k0: 900, xmax }, ext: { k0: 500, c3: 1.5 } });
    const xb = (0.02 - 1) * xmax * MM;                              // kırpma sınırı [m]
    turevTutarli(law, izgara(-2 * xmax * MM, 0.01, 80).filter((d) => Math.abs(d - xb) > 1e-6 && Math.abs(d) > 1e-6), 1e-9);
  });
});

describe('C¹ — asimptotlu yasa kırpma sınırında sürekli', () => {
  test('kuvvet ve eğim sınırın iki yanında aynı; ötesi sınırdaki teğetle doğrusal', () => {
    const xmax = 10, k0 = 700, EPS = 0.02;
    const law = core.makeAxisLaw({ form: 'asym', comp: { k0, xmax }, ext: { k0: 400 } });
    const xb = (EPS - 1) * xmax * MM, h = 1e-9;
    const kb = k0 / (EPS * EPS) * 1000;                             // N/m — sınırdaki teğet
    expect(law.force(xb)).toBeCloseTo(k0 * (xb / MM) / EPS, 6);      // rasyonel dalın sınırdaki değeri
    const sol = (law.force(xb - h) - law.force(xb - 3 * h)) / (2 * h), sag = (law.force(xb + 3 * h) - law.force(xb + h)) / (2 * h);
    expect(Math.abs(sol - kb) / kb).toBeLessThan(1e-4);
    expect(Math.abs(sag - kb) / kb).toBeLessThan(1e-4);
    expect(law.tangent(xb - 5 * MM)).toBeCloseTo(kb, 6);
    expect(law.force(xb - 5 * MM)).toBeCloseTo(law.force(xb) - kb * 5 * MM, 3);
  });
});

describe('NEWTON — asimptotu aşan yükte hızlı yakınsama', () => {
  // Ölçüldü (2026-11-13): eski tutarsız tanjantla aynı model 130 · 200 · 400 g'de 984 · 1.935 ·
  // 1.994 iterasyonda YAKINSAMADAN duruyor, sehim kırpma sınırına (−7,84 mm) yapışıyordu; eski
  // kuvvet doğrusu takozu asimptotun ötesine (200 g'de −13,1 mm, xmax 8 mm) ezdirirdi.
  test.each([[-130], [-200], [-400]])('dört simetrik takoz, düşey %d g: denge kırpmanın hemen ötesinde, birkaç iterasyon', (nz) => {
    const xmax = 8, k0 = 300;                                       // N/mm — yumuşak takoz, büyük yük
    const mounts = [[0.4, 0.3], [0.4, -0.3], [-0.4, 0.3], [-0.4, -0.3]].map(([x, y], i) => ({
      name: 'T' + i, pos: [x, y, -0.2], kstat: [k0 * 1000, k0 * 1000, k0 * 1000], kdyn: [k0 * 1000, k0 * 1000, k0 * 1000],
      fits: { z: { form: 'asym', comp: { k0, xmax }, ext: { k0 } } }
    }));
    const m = 400, g = 9.81;
    const res = core.solveCaseNL(mounts, [0, 0, 0], m, g, { name: 'x', n: [0, 0, nz], T: [0, 0, 0] }, { useStop: false });
    expect(res.checks.converged).toBe(true);
    expect(res.checks.newtonIters).toBeLessThanOrEqual(8);
    const dz = res.perMount[0].delta[2], xb = (0.02 - 1) * xmax * MM;
    expect(dz).toBeLessThan(xb);                                    // denge kırpma sınırının ötesinde
    expect(dz).toBeGreaterThan(-xmax * MM * 1.1);                    // ama asimptotun çok ötesinde değil
    expect(res.perMount.reduce((s, p) => s + p.f[2], 0)).toBeCloseTo(m * g * nz, 3);
  });
});
