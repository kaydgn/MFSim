/**
 * Takoz doğrulaması — KAPALI-FORM kıyas örnekleri (referans belgesiz)
 * ─────────────────────────────────────────────────────────────────────
 * Referans belge yokken hakem el hesabıdır: her örnek, cevabı kapalı formda
 * bilinen bir düzen olarak KURGULANDI. Program kendi hattından (cp-mount.js
 * _mntComputeResults: birim dönüşümü + toplayıcı + yük durumları + çözücü)
 * geçer ve cevabı formülle kıyaslanır. Hakem tarafı çekirdeğin hiçbir
 * fonksiyonunu kullanmaz (tests/helpers/takoz-dogrulama.js — bağımsızlık kuralı).
 *
 *   B1  Simetrik dörtlü kutu    — takozlar AM düzleminde: 6 mod TAM ayrışık
 *   B2  Önde/arkada farklı takoz — baş-kıç (bounce–pitch) kuplajı, 2 SD
 *   B3  Alçak takoz             — yanal–yalpa ve boyuna–baş-kıç kuplajı
 *   B4  Döndürülmüş atalet       — çarpım terimleri, asal eksen, dönme değişmezliği
 *   B7  Oransal sönüm            — elastik merkez AM altında → C = α·K tam
 *
 * Toleranslar: kapalı formla kıyas 1e-9 bağıl (çözücüler makine hassasiyetinde
 * çalışıyor; ölçülen en büyük sapma 4·10⁻¹³). Gevşek tolerans bir hatayı
 * gizler: işaret ya da terim hatası 1e-9'un çok üstünde iz bırakır.
 */
const H = require('../helpers/takoz-dogrulama.js');
const { core, rp } = H.kur();
const G = H.G;
const GAP = 0.015, ORAN = 100;          // metal-metal durdurucu (çekirdek STOP_GAP_M / STOP_STIFF_RATIO)
const TOL = 1e-9;

// Kod modlarını kapalı-form anahtarlarına en yakın frekansla eşle (birebir).
function eslestir(modes, w2) {
  const keys = Object.keys(w2), used = {};
  return modes.map((md) => {
    let best = null;
    keys.forEach((k) => {
      if (used[k]) return;
      if (!best || Math.abs(H.fHz(w2[k]) - md.f_Hz) < Math.abs(H.fHz(w2[best]) - md.f_Hz)) best = k;
    });
    used[best] = 1;
    return best;
  });
}
const hepsi = (R) => R.allCases.concat(R.designCases || [], R.gearCases || []);

// ═══════════════════ B1 — SİMETRİK DÖRTLÜ KUTU ═══════════════════
// Dört özdeş takoz ±Lx, ±Ly köşelerinde ve AM ile AYNI yükseklikte (dz = 0):
// K'nın bütün kuplaj terimleri sıfırdır (Σk·dx = Σk·dy = 0, dz = 0), altı mod
// birer serbestliğe ayrışır ve her biri tek satırlık formüldür.
const B1 = { m: 1200, kutu: [1100, 700, 800], cg: [300, 20, 650], Lx: 600, Ly: 350,
             ks: [900, 700, 400], kd: [1400, 1050, 600], zeta: 0.05,
             motor: { Te: 500, Rstall: 2, g1: 3, g2: 1.6, gR: -4, iTransfer: 1.25, phiFwd: 0.8, phiRev: 0.7,
                     derate: 0.9, idleRpm: 800, cylinders: 6 } };
const T1 = H.kurguModel({
  govdeler: [{ ad: 'Kutu', m: B1.m, cg: B1.cg, kutu: B1.kutu }],
  takozlar: H.dortluTakoz(B1.cg, B1.Lx, B1.Ly, 0, B1.ks, B1.kd),
  motor: B1.motor, cozucu: { zeta: B1.zeta }
});
const R1 = H.coz(T1);

function b1Kapali() {
  const m = B1.m, I = H.kutuAtalet(m, B1.kutu), Lx = B1.Lx / 1000, Ly = B1.Ly / 1000, z = B1.zeta;
  const kd = B1.kd.map((v) => v * 1000);
  const w2 = { 'fore-aft': 4 * kd[0] / m, lateral: 4 * kd[1] / m, bounce: 4 * kd[2] / m,
               roll: 4 * kd[2] * Ly * Ly / I[0][0], pitch: 4 * kd[2] * Lx * Lx / I[1][1],
               yaw: 4 * (kd[0] * Ly * Ly + kd[1] * Lx * Lx) / I[2][2] };
  // c = 2ζ√(k·m/4) her takozda. Öteleme modunda ζ_mod = ζ; dönme modunda
  // ζ_mod = Σc·d² / (2ω·I) → yalpa ζ·Ly/ρx, baş-kıç ζ·Lx/ρy (ρ = √(I/m)).
  const zeta = { 'fore-aft': z, lateral: z, bounce: z,
                 roll: z * Ly * Math.sqrt(m / I[0][0]), pitch: z * Lx * Math.sqrt(m / I[1][1]),
                 yaw: z * Math.sqrt(m) * (Math.sqrt(kd[0]) * Ly * Ly + Math.sqrt(kd[1]) * Lx * Lx) /
                      Math.sqrt(I[2][2] * (kd[0] * Ly * Ly + kd[1] * Lx * Lx)) };
  return { w2, zeta };
}

// Yük durumu → takoz başına beklenen sehim [m] + bayraklar (kapalı form).
// Öteleme u = m·g·n / Σk; düşey sehim ±15 mm'yi aşarsa durdurucu: k·δ + 100k·(δ − gap) = F.
// Tork yalnız yalpa: θx = Tx / (Σ kz·y²); δz = uz + θx·y.
function b1Sehim(lc) {
  const ks = B1.ks.map((v) => v * 1000), m = B1.m, Ly = B1.Ly / 1000;
  const u = [0, 1, 2].map((a) => m * G * lc.n[a] / (4 * ks[a]));
  let clamped = false;
  if (Math.abs(u[2]) > GAP) { u[2] = Math.sign(u[2]) * (Math.abs(u[2]) + ORAN * GAP) / (1 + ORAN); clamped = true; }
  const th = lc.T[0] / (4 * ks[2] * Ly * Ly);
  return [Ly, -Ly, Ly, -Ly].map((y) => {            // takoz sırası: Sağ Ön, Sol Ön, Sağ Arka, Sol Arka
    const d = [u[0], u[1], u[2] + th * y];
    const f = [ks[0] * d[0], ks[1] * d[1], ks[2] * d[2] + (clamped ? ORAN * ks[2] * (d[2] - Math.sign(d[2]) * GAP) : 0)];
    return { d, f, clamped, tension: d[2] > 1e-5, overLinear: d.some((v) => Math.abs(v) > 0.010) };
  });
}

describe('B1 — simetrik dörtlü kutu: 6 ayrışık mod kapalı formla', () => {
  const K = b1Kapali();
  const keys = eslestir(R1.modes, K.w2);

  test('6 modun 6\'sı farklı bir serbestliğe eşlendi', () => {
    expect(new Set(keys).size).toBe(6);
  });

  test('frekanslar f = (1/2π)·√(Σk/m) ve √(Σk·d²/I) ile birebir', () => {
    R1.modes.forEach((md, i) => {
      expect(H.bagil(md.f_Hz, H.fHz(K.w2[keys[i]]))).toBeLessThan(TOL);
    });
  });

  test('mod etiketleri ayrışık serbestliği adlandırıyor', () => {
    R1.modes.forEach((md, i) => expect(md.label).toBe(keys[i]));
  });

  test('mod başına sönüm oranı: öteleme ζ, yalpa ζ·Ly/ρx, baş-kıç ζ·Lx/ρy, savrulma formülü', () => {
    R1.modes.forEach((md, i) => {
      expect(H.bagil(R1.modalDamping[i].zeta, K.zeta[keys[i]])).toBeLessThan(TOL);
    });
  });

  test('sönümlü frekans f_d = f_n·√(1 − ζ²)', () => {
    R1.modes.forEach((md, i) => {
      const z = K.zeta[keys[i]];
      expect(H.bagil(R1.modalDamping[i].f_d, md.f_Hz * Math.sqrt(1 - z * z))).toBeLessThan(TOL);
    });
  });
});

describe('B1 — bütün yük durumları kapalı formla (12 otomatik + 3 tasarım + tork + vites)', () => {
  const cases = hepsi(R1);

  test('yük durumu listesi beklenen kümeyi taşıyor', () => {
    expect(cases).toHaveLength(12 + 2 + 3 + 3);   // 12 otomatik + ileri/geri tork · 3 tasarım · 3 vites
    expect(cases.every((rc) => rc.res)).toBe(true);
  });

  test.each(hepsi(R1).map((rc) => [rc.name, rc]))('%s — takoz sehimi ve kuvveti', (ad, rc) => {
    const exp = b1Sehim(rc.loadCase);
    rc.res.perMount.forEach((pm, i) => {
      for (let a = 0; a < 3; a++) {
        expect(Math.abs(pm.delta[a] - exp[i].d[a])).toBeLessThan(1e-12);
        expect(Math.abs(pm.f[a] - exp[i].f[a])).toBeLessThan(1e-6 * (1 + Math.abs(exp[i].f[a])));
      }
      expect(pm.tension).toBe(exp[i].tension);
      expect(pm.overLinear).toBe(exp[i].overLinear);
      expect(!!pm.clamped).toBe(exp[i].clamped);
    });
  });

  test('ileri tork sağ takozları BASAR, sol takozları kaldırır (önden saat yönü krank)', () => {
    // Tx = −T_şaft: tepki torku gövdeyi önden bakınca saat yönünün TERSİNE
    // döndürür; sağ taraf iner. Arka çekişli boyuna motorlarda sürücü
    // tarafının (sol) takozunun hızlanmada kalkması bilinen saha davranışıdır.
    const st = R1.allCases.find((c) => c.name === 'Static').res;
    const fw = R1.allCases.find((c) => c.name === 'Forward Torque').res;
    [0, 2].forEach((i) => expect(fw.perMount[i].delta[2]).toBeLessThan(st.perMount[i].delta[2]));   // sağ
    [1, 3].forEach((i) => expect(fw.perMount[i].delta[2]).toBeGreaterThan(st.perMount[i].delta[2])); // sol
  });

  test('tork zinciri T_şaft = Te·R_stall·i_vites·i_transfer·φ_aks·derate — her çarpan 1\'den farklı', () => {
    // 1. vites 500·2·3·1,25·0,8·0,9 = 2700 · 2. vites 1440 · geri 500·2·(−4)·1,25·0,7·0,9 = −3150 N·m
    const T = (ad) => R1.gearCases.find((c) => c.name === ad).loadCase.T[0];
    expect(T('1. Vites')).toBeCloseTo(-2700, 9);
    expect(T('2. Vites')).toBeCloseTo(-1440, 9);
    expect(T('Geri Vites')).toBeCloseTo(3150, 9);
    expect(R1.allCases.find((c) => c.name === 'Forward Torque').loadCase.T[0]).toBeCloseTo(-2700, 9);
    expect(R1.allCases.find((c) => c.name === 'Reverse Torque').loadCase.T[0]).toBeCloseTo(3150, 9);
  });
});

describe('B1 — frekans yanıtı üç yönde TEK serbestlikli formülün kendisi', () => {
  // Ayrışık sistemde yön d'deki birim kuvvet yalnız o ötelemeyi uyarır; takoz
  // sönümü c = 2ζ√(k·m/4) olduğundan o modun sönüm oranı tam ζ'dir ve 6 SD
  // iletilebilirlik T = √[(1+(2ζr)²)/((1−r²)²+(2ζr)²)] ile BİREBİR çakışmalıdır.
  const M6 = core.buildM6(R1.mp.m, R1.mp.I_G);
  const fn = B1.kd.map((k) => H.fHz(4 * k * 1000 / B1.m));
  [0, 1, 2].forEach((dir) => {
    test(['X', 'Y', 'Z'][dir] + ' yönü — rezonans dâhil 8 frekansta', () => {
      [0.3, 2, 0.9 * fn[dir], fn[dir], 1.1 * fn[dir], 15, 30, 80].forEach((f) => {
        const T = core.frfAt(R1.mounts, R1.mp.cg, M6, R1.damping, f, dir);
        expect(H.bagil(T, H.sdofT(f, fn[dir], B1.zeta))).toBeLessThan(TOL);
      });
    });
  });

  test('rapor: f_bounce, SDOF izolasyonu ve 3 yönlü 6 SD tablosu kapalı formla', () => {
    const iso = rp._mntRepIsolation(R1, {});
    const fF = 800 / 60 * 3;                                   // (N/60)·(z/2)
    expect(iso.fFire).toBeCloseTo(fF, 12);
    expect(H.bagil(iso.fBounce, fn[2])).toBeLessThan(TOL);
    expect(H.bagil(iso.T, H.sdofT(fF, fn[2], B1.zeta))).toBeLessThan(TOL);
    const i3 = rp._mntRepIsolation3(R1, {});
    i3.dirs.forEach((d) => expect(H.bagil(d.T, H.sdofT(fF, fn[d.dir], B1.zeta))).toBeLessThan(TOL));
  });
});

describe('B1 — uygunluk kriterleri, cevabı bilinen modelde beklenen hükmü veriyor', () => {
  // Modlar: zıplama 7,12 · yalpa 8,12 · yanal 9,42 · ileri-geri 10,872 ·
  // baş-kıç 10,877 · savrulma 18,10 Hz. f_ateş = 40 Hz → sınır 20 Hz.
  const U = rp.veMntUygunluk(R1, {});
  const st = (no) => U.satirlar.find((s) => s.no === no).st;
  test('Kriter 1: en yüksek mod 18,10 Hz < 20 Hz → uygun', () => { expect(st('1')).toBe('ok'); });
  test('Kriter 1a: ileri-geri ile baş-kıç arası 0,004 Hz < 0,5 Hz → kontrol', () => {
    const K = b1Kapali();
    expect(Math.abs(H.fHz(K.w2.pitch) - H.fHz(K.w2['fore-aft']))).toBeLessThan(0.5);
    expect(st('1a')).toBe('no');
  });
  test('Kriter 1b: yalpa (8,12) ve yanal (9,42) 8–10 Hz bandında → kontrol', () => {
    expect(st('1b')).toBe('no');
    expect(U.satirlar.find((s) => s.no === '1b').bulgu).toMatch(/^2 mod bantta/);
  });
  test('Kriter 2: r = 40/7,12 → T ≈ 0,038 < 0,5 → uygun', () => { expect(st('2')).toBe('ok'); });
  test('Kriter 3 ve 4: vites ve tasarım durumları çözüldü → uygun', () => {
    expect(st('3')).toBe('ok');
    expect(st('4')).toBe('ok');
  });
});

// ═══════════════════ B2 — BAŞ-KIÇ KUPLAJI ═══════════════════
// Önde (x = −a) ve arkada (x = +b) farklı takoz çiftleri, AM düzleminde.
// Σkz·dx ≠ 0 → zıplama ile baş-kıç kuplajlanır (taşıt dinamiğinin klasik 2 SD
// problemi). ky_ön·a = ky_arka·b seçildi → yanal–savrulma ayrışık kalır.
const B2 = { m: 900, kutu: [900, 600, 700], cg: [-200, 15, 520], a: 400, b: 600, Ly: 300,
             ksOn: [800, 600, 500], ksArka: [700, 400, 300], kdOn: [1200, 900, 750], kdArka: [1050, 600, 450] };
function b2Takozlar() {
  const c = B2.cg;
  return [['Sağ Ön Takoz', -B2.a, B2.Ly, 'On'], ['Sol Ön Takoz', -B2.a, -B2.Ly, 'On'],
          ['Sağ Arka Takoz', B2.b, B2.Ly, 'Arka'], ['Sol Arka Takoz', B2.b, -B2.Ly, 'Arka']].map((q) => ({
    ad: q[0], p: [c[0] + q[1], c[1] + q[2], c[2]], ks: B2['ks' + q[3]], kd: B2['kd' + q[3]] }));
}
const R2 = H.coz(H.kurguModel({ govdeler: [{ ad: 'Gövde', m: B2.m, cg: B2.cg, kutu: B2.kutu }],
                                 takozlar: b2Takozlar(), cozucu: { zeta: 0.02 } }));

describe('B2 — önde/arkada farklı takoz: baş-kıç kuplajı 2 SD kapalı formla', () => {
  const m = B2.m, I = H.kutuAtalet(m, B2.kutu), a = B2.a / 1000, b = B2.b / 1000, Ly = B2.Ly / 1000;
  const kf = B2.kdOn.map((v) => v * 1000), kr = B2.kdArka.map((v) => v * 1000);
  // δz = uz − θy·dx → K_zz = Σkz, K_zθy = −Σkz·dx, K_θyθy = Σkz·dx²
  const K11 = 2 * (kf[2] + kr[2]), K12 = 2 * (kf[2] * a - kr[2] * b), K22 = 2 * (kf[2] * a * a + kr[2] * b * b);
  const bp = H.ozdeger2(K11, K12, K22, m, I[1][1]);
  const w2 = { 'fore-aft': 2 * (kf[0] + kr[0]) / m, lateral: 2 * (kf[1] + kr[1]) / m,
               roll: 2 * (kf[2] + kr[2]) * Ly * Ly / I[0][0],
               yaw: 2 * ((kf[0] + kr[0]) * Ly * Ly + kf[1] * a * a + kr[1] * b * b) / I[2][2],
               bp1: bp[0], bp2: bp[1] };
  const keys = eslestir(R2.modes, w2);

  test('kuplaj gerçekten var (K_zθy ≠ 0) ve yanal–savrulma ayrışık (ky_ön·a = ky_arka·b)', () => {
    expect(Math.abs(K12)).toBeGreaterThan(0.01 * K11 * a);
    expect(kf[1] * a).toBeCloseTo(kr[1] * b, 6);
  });

  test('6 frekans kapalı formla (zıplama–baş-kıç ikilisi 2×2 özdeğerden)', () => {
    R2.modes.forEach((md, i) => expect(H.bagil(md.f_Hz, H.fHz(w2[keys[i]]))).toBeLessThan(TOL));
  });

  test('kuplajlı modların şekil oranı uz/θy = −K12/(K11 − ω²m)', () => {
    R2.modes.forEach((md, i) => {
      if (keys[i] !== 'bp1' && keys[i] !== 'bp2') return;
      const oran = -K12 / (K11 - w2[keys[i]] * m);
      expect(H.bagil(md.phi[2] / md.phi[4], oran)).toBeLessThan(1e-7);
      // ve kuplajsız serbestlikler bu modda sıfır
      [0, 1, 3, 5].forEach((j) => expect(Math.abs(md.phi[j])).toBeLessThan(1e-9));
    });
  });

  test('statik: [K11 K12; K12 K22]·[uz; θy] = [−mg; 0] (k_stat ile)', () => {
    const ksf = B2.ksOn.map((v) => v * 1000), ksr = B2.ksArka.map((v) => v * 1000);
    const S11 = 2 * (ksf[2] + ksr[2]), S12 = 2 * (ksf[2] * a - ksr[2] * b), S22 = 2 * (ksf[2] * a * a + ksr[2] * b * b);
    const det = S11 * S22 - S12 * S12;
    const uz = (-m * G * S22) / det, th = (m * G * S12) / det;
    const st = R2.allCases.find((c) => c.name === 'Static').res;
    [-a, -a, b, b].forEach((dx, i) => {
      expect(Math.abs(st.perMount[i].delta[2] - (uz - th * dx))).toBeLessThan(1e-12);
    });
    expect(Math.abs(st.q[4] - th)).toBeLessThan(1e-12);
  });

  test('takozlar AM düzlemindeyken frende baş-kıç dönmesi YOK (ayrışma teoremi)', () => {
    // Fren kuvveti AM'den geçiyor ve takoz düzleminde: moment kolu sıfır.
    const st = R2.allCases.find((c) => c.name === 'Static').res;
    const br = R2.allCases.find((c) => c.name === 'Braking').res;
    expect(Math.abs(br.q[4] - st.q[4])).toBeLessThan(1e-15);
    const ksx = 2 * (B2.ksOn[0] + B2.ksArka[0]) * 1000;
    br.perMount.forEach((pm) => expect(Math.abs(pm.delta[0] - (-m * G / ksx))).toBeLessThan(1e-12));
  });
});

// ═══════════════════ B3 — ALÇAK TAKOZ ═══════════════════
// Simetrik dörtlü ama takozlar AM'nin h kadar ALTINDA. dz = −h iki çift kuplaj
// doğurur: yanal–yalpa (K_yθx = Σky·h) ve boyuna–baş-kıç (K_xθy = −Σkx·h).
// Fren ve viraj artık gövdeyi döndürür; dönme momenti m·g·n·h'dir.
const B3 = { m: 1500, kutu: [1200, 800, 900], cg: [100, -10, 700], Lx: 550, Ly: 380, h: 250,
             ks: [1000, 800, 600], kd: [1500, 1200, 900], zeta: 0.03 };
const R3 = H.coz(H.kurguModel({ govdeler: [{ ad: 'Gövde', m: B3.m, cg: B3.cg, kutu: B3.kutu }],
  takozlar: H.dortluTakoz(B3.cg, B3.Lx, B3.Ly, B3.h, B3.ks, B3.kd), cozucu: { zeta: B3.zeta } }));

// Kapalı-form statik çözüm (durdurucu devrede değilken): z tek, (x,θy) ve (y,θx) 2×2.
function b3Sehim(n, ks) {
  const m = B3.m, h = B3.h / 1000, Lx = B3.Lx / 1000, Ly = B3.Ly / 1000;
  const [kx, ky, kz] = ks.map((v) => v * 1000);
  const uz = m * G * n[2] / (4 * kz);
  const xs = H.coz6([[4 * kx, -4 * kx * h], [-4 * kx * h, 4 * (kx * h * h + kz * Lx * Lx)]], [m * G * n[0], 0]);
  const ys = H.coz6([[4 * ky, 4 * ky * h], [4 * ky * h, 4 * (ky * h * h + kz * Ly * Ly)]], [m * G * n[1], 0]);
  const [ux, thy] = xs, [uy, thx] = ys;
  return { thx, thy, mounts: [[-Lx, Ly], [-Lx, -Ly], [Lx, Ly], [Lx, -Ly]].map(([dx, dy]) =>
    [ux - thy * h, uy + thx * h, uz + thx * dy - thy * dx]) };
}

describe('B3 — alçak takoz: kuplajlı iki çift 2×2 kapalı formla', () => {
  const m = B3.m, I = H.kutuAtalet(m, B3.kutu), h = B3.h / 1000, Lx = B3.Lx / 1000, Ly = B3.Ly / 1000;
  const [kx, ky, kz] = B3.kd.map((v) => v * 1000);
  const yr = H.ozdeger2(4 * ky, 4 * ky * h, 4 * (kz * Ly * Ly + ky * h * h), m, I[0][0]);
  const xp = H.ozdeger2(4 * kx, -4 * kx * h, 4 * (kz * Lx * Lx + kx * h * h), m, I[1][1]);
  const w2 = { bounce: 4 * kz / m, yaw: 4 * (kx * Ly * Ly + ky * Lx * Lx) / I[2][2],
               yr1: yr[0], yr2: yr[1], xp1: xp[0], xp2: xp[1] };
  const keys = eslestir(R3.modes, w2);

  test('6 frekans kapalı formla', () => {
    R3.modes.forEach((md, i) => expect(H.bagil(md.f_Hz, H.fHz(w2[keys[i]]))).toBeLessThan(TOL));
  });

  test('h → 0 limitinde kuplaj kaybolur: alçak takozla yalpa modu ayrışık formülden UZAKLAŞIR', () => {
    // Testin anlamlı olduğunun kanıtı: kuplajsız formül bu modelde tutmamalı.
    const ayrisik = H.fHz(4 * kz * Ly * Ly / I[0][0]);
    const enYakin = Math.min(...R3.modes.map((md) => Math.abs(md.f_Hz - ayrisik)));
    expect(enYakin / ayrisik).toBeGreaterThan(0.01);
  });
});

describe('B3 — fren ve viraj: işaret VE büyüklük kapalı formla', () => {
  const named = (ad) => R3.allCases.find((c) => c.name === ad).res;
  const kapali = ['Static', 'Braking', 'Acceleration', 'Cornering Left', 'Cornering Right',
                  'Brake in Turn L', 'Brake in Turn R', 'Kerb Strike L', 'Kerb Strike R', 'Max Rebound'];

  test.each(kapali)('%s — 4 takozun 3 ekseni', (ad) => {
    const rc = R3.allCases.find((c) => c.name === ad);
    const exp = b3Sehim(rc.loadCase.n, B3.ks);
    rc.res.perMount.forEach((pm, i) => {
      for (let a = 0; a < 3; a++) expect(Math.abs(pm.delta[a] - exp.mounts[i][a])).toBeLessThan(1e-12);
    });
  });

  test('fren → BURUN AŞAĞI: θy = −m·g·h/(4·kz·Lx²), ön takozlar daha çok basılır', () => {
    const m = B3.m, h = B3.h / 1000, Lx = B3.Lx / 1000, kz = B3.ks[2] * 1000;
    const br = named('Braking');
    expect(H.bagil(br.q[4], -m * G * h / (4 * kz * Lx * Lx))).toBeLessThan(1e-9);
    expect(br.perMount[0].delta[2]).toBeLessThan(br.perMount[2].delta[2]);   // sağ ön < sağ arka (daha basık)
    expect(br.perMount[1].delta[2]).toBeLessThan(br.perMount[3].delta[2]);
  });

  test('hızlanma → arka takozlar daha çok basılır (frenin aynası)', () => {
    const ac = named('Acceleration');
    expect(ac.perMount[2].delta[2]).toBeLessThan(ac.perMount[0].delta[2]);
  });

  test('sol viraj (yanal atalet +Y) → sağ takozlar basılır: θx = −0,6·m·g·h/(4·kz·Ly²)', () => {
    const m = B3.m, h = B3.h / 1000, Ly = B3.Ly / 1000, kz = B3.ks[2] * 1000;
    const cl = named('Cornering Left');
    expect(H.bagil(cl.q[3], -0.6 * m * G * h / (4 * kz * Ly * Ly))).toBeLessThan(1e-9);
    expect(cl.perMount[0].delta[2]).toBeLessThan(cl.perMount[1].delta[2]);   // sağ ön < sol ön
  });

  test('bordür darbesi (1,55 g) karşı taraftaki takozları ÇEKMEYE sokar', () => {
    // θx·Ly = 6,25 mm > statik 6,13 mm → kalkan taraf çekmede (δz > +0,01 mm).
    const kl = named('Kerb Strike L');
    expect(kl.checks.tensionCount).toBe(2);
    expect(kl.perMount[0].tension && kl.perMount[2].tension).toBe(true);    // sağ taraf kalkar
  });
});

// ═══════════════════ B4 — DÖNDÜRÜLMÜŞ ATALET / DÖNME DEĞİŞMEZLİĞİ ═══════════════════

describe('B4 — asal atalet ve eşdeğer kutu', () => {
  const Rm = H.matCarp(H.rotZ(30 * Math.PI / 180), H.rotX(20 * Math.PI / 180));
  const Ib = [[30, 0, 0], [0, 80, 0], [0, 0, 95]];
  const I = H.tensorDondur(Rm, Ib);

  test('döndürülmüş tensörde çarpım terimleri gerçekten dolu', () => {
    expect(Math.abs(I[0][1])).toBeGreaterThan(5);     // 30° z dönmesi: (I1 − I2)·sin·cos
    expect(Math.abs(I[1][2])).toBeGreaterThan(2);     // 20° x eğimi
  });

  test('asal değerler 30 · 80 · 95 kg·m² geri kazanılır', () => {
    const pr = core.principalInertia(I);
    [30, 80, 95].forEach((v, k) => expect(H.bagil(pr.values[k], v)).toBeLessThan(1e-10));
  });

  test('asal eksenler döndürme matrisinin sütunları (işaret serbest)', () => {
    const pr = core.principalInertia(I);
    pr.axes.forEach((ax, k) => {
      const col = [Rm[0][k], Rm[1][k], Rm[2][k]];
      expect(Math.abs(Math.abs(H.noktaCarp(ax, col)) - 1)).toBeLessThan(1e-9);
    });
  });

  test('eşdeğer kutu, kütle ve köşegen ataletinden kenarları geri verir', () => {
    const kutu = core.equivalentBox(400, H.kutuAtalet(400, [900, 500, 600]), false);
    [0.9, 0.5, 0.6].forEach((v, k) => expect(H.bagil(kutu[k], v)).toBeLessThan(1e-12));
  });
});

// Genel (simetrisiz) model yardımcıda (H.genelModel): iki gövde, beş takoz, farklı
// yükseklikler, tam tensör. Dönme testinde takozlar RADYAL İZOTROP (kx = ky): z
// etrafında döndürülen takozun rijitlik tensörü değişmez, yani bütün model
// döndürülünce fizik aynı kalmalı.
// Bütün modeli z ekseni etrafında P noktası çevresinde döndür (gövde AM'si, tensörü, takoz konumu).
function zDondur(spec, psi, P, kxkyTakas) {
  const R = H.rotZ(psi), s = JSON.parse(JSON.stringify(spec));
  const don = (p) => { const d = [p[0] - P[0], p[1] - P[1], p[2] - P[2]], r = H.matVek(R, d); return [r[0] + P[0], r[1] + P[1], r[2] + P[2]]; };
  s.govdeler.forEach((g) => { g.cg = don(g.cg); g.I = H.tensorDondur(R, g.I); });
  s.takozlar.forEach((t) => {
    t.p = don(t.p);
    if (kxkyTakas) { [t.ks[0], t.ks[1]] = [t.ks[1], t.ks[0]]; [t.kd[0], t.kd[1]] = [t.kd[1], t.kd[0]]; }
  });
  return s;
}

describe('B4 — bütün model z ekseni etrafında döndürülünce fizik değişmez', () => {
  const spec = H.genelModel({ radyalIzotrop: true });
  const RA = H.coz(H.kurguModel(spec));
  const RB = H.coz(H.kurguModel(zDondur(spec, 37 * Math.PI / 180, [200, -100, 0], false)));

  test('modal frekanslar aynı (çarpım terimli tensörlerle)', () => {
    RA.modes.forEach((md, i) => expect(H.bagil(RB.modes[i].f_Hz, md.f_Hz)).toBeLessThan(1e-9));
  });

  test.each(['Static', 'Max Bump', 'Max Rebound'])('%s — düşey sehim aynı, yatay sehim döner ama boyu aynı', (ad) => {
    const a = RA.allCases.find((c) => c.name === ad).res, b = RB.allCases.find((c) => c.name === ad).res;
    a.perMount.forEach((pm, i) => {
      expect(Math.abs(b.perMount[i].delta[2] - pm.delta[2])).toBeLessThan(1e-12);
      expect(Math.abs(Math.hypot(b.perMount[i].delta[0], b.perMount[i].delta[1]) -
                      Math.hypot(pm.delta[0], pm.delta[1]))).toBeLessThan(1e-12);
    });
  });

  test('takoz sönüm katsayıları ve düşey iletilebilirlik aynı', () => {
    RA.damping.forEach((dm, i) => dm.c.forEach((c, a) => expect(H.bagil(RB.damping[i].c[a], c)).toBeLessThan(1e-9)));
    const MA = core.buildM6(RA.mp.m, RA.mp.I_G), MB = core.buildM6(RB.mp.m, RB.mp.I_G);
    [1, 5, 8, 12, 30].forEach((f) => {
      expect(H.bagil(core.frfAt(RB.mounts, RB.mp.cg, MB, RB.damping, f, 2),
                     core.frfAt(RA.mounts, RA.mp.cg, MA, RA.damping, f, 2))).toBeLessThan(1e-9);
    });
  });
});

describe('B4 — 90° döndürülmüş takoz = sx ↔ sy takası (kütüphanenin montaj kuralı)', () => {
  // MFSim'de takozun açı alanı yok; kütüphane 90° döndürülmüş montajı sx ↔ sy
  // takasıyla girmeyi söylüyor. Bütün model 90° döndürülüp her takozda kx ↔ ky
  // takas edilince sonuç, döndürülmemiş modelinkinin AYNISI olmalı.
  const spec = H.genelModel();
  const RA = H.coz(H.kurguModel(spec));
  const RB = H.coz(H.kurguModel(zDondur(spec, Math.PI / 2, [0, 0, 0], true)));

  test('modal frekanslar aynı', () => {
    RA.modes.forEach((md, i) => expect(H.bagil(RB.modes[i].f_Hz, md.f_Hz)).toBeLessThan(1e-9));
  });

  test('döndürülmüş modelin "1g Yanal" durumu = asıl modelin "Acceleration" durumu (döndürülmüş)', () => {
    // R(90°)·(1, 0, −1) = (0, 1, −1): asıl modelde +X yükü, döndürülmüşte +Y yüküdür.
    const a = RA.allCases.find((c) => c.name === 'Acceleration').res;
    const b = RB.designCases.find((c) => c.name === '1g Yanal').res;
    a.perMount.forEach((pm, i) => {
      const exp = [-pm.delta[1], pm.delta[0], pm.delta[2]];       // R(90°)·δ
      for (let k = 0; k < 3; k++) expect(Math.abs(b.perMount[i].delta[k] - exp[k])).toBeLessThan(1e-12);
    });
  });
});

// ═══════════════════ B7 — ORANSAL SÖNÜM ═══════════════════
// İzotrop takozlar (kx = ky = kz), rijitlik merkezi AM'nin TAM altında
// (Σk·dx = Σk·dy = 0) ve bütün takozlarda k_din = 1,4·k_stat. Sonuçlar:
//   • statik sehim her takozda AYNI → yük payı m_i ∝ k_i
//   • c_i = 2ζ√(k_din·m_i) = α·k_din,i → C = α·K: sönüm ORANSAL
//   • oransal sönümde mod başına oran TAM olarak ζ_r = α·ω_r/2 = ζ·f_r/f_zıplama
// Bu modelde izdüşüm yaklaşımı (φᵀCφ / 2ωφᵀMφ) yaklaşım değil, kesin değerdir.
const B7 = { m: 1000, kutu: [1000, 600, 700], cg: [0, 0, 600], h: 200, oran: 1.4, zeta: 0.04,
             takoz: [[-500, 300, 500], [-500, -250, 600], [500, 350, 500], [600, -350, 500]] };   // [dx, dy, k]
const R7 = H.coz(H.kurguModel({
  govdeler: [{ ad: 'Gövde', m: B7.m, cg: B7.cg, kutu: B7.kutu }],
  takozlar: B7.takoz.map(([dx, dy, k], i) => ({ ad: ['Sol', 'Sağ'][dy > 0 ? 1 : 0] + ' ' + (dx < 0 ? 'Ön' : 'Arka') + ' Takoz',
    p: [B7.cg[0] + dx, B7.cg[1] + dy, B7.cg[2] - B7.h], ks: [k, k, k], kd: [k * B7.oran, k * B7.oran, k * B7.oran] })),
  cozucu: { zeta: B7.zeta }
}));

describe('B7 — oransal sönüm: ζ_r = ζ·f_r/f_zıplama TAM', () => {
  const Sk = B7.takoz.reduce((s, t) => s + t[2], 0) * 1000;
  const fb = H.fHz(B7.oran * Sk / B7.m);

  test('kurgu koşulu: rijitlik merkezi AM altında (Σk·dx = Σk·dy = 0)', () => {
    expect(B7.takoz.reduce((s, t) => s + t[2] * t[0], 0)).toBe(0);
    expect(B7.takoz.reduce((s, t) => s + t[2] * t[1], 0)).toBe(0);
  });

  test('statik sehim bütün takozlarda aynı: δz = −m·g/Σk, dönme yok', () => {
    const st = R7.allCases.find((c) => c.name === 'Static').res;
    st.perMount.forEach((pm) => {
      expect(Math.abs(pm.delta[2] - (-B7.m * G / Sk))).toBeLessThan(1e-12);
      expect(Math.abs(pm.delta[0]) + Math.abs(pm.delta[1])).toBeLessThan(1e-12);
    });
  });

  test('zıplama modu ayrışık: f = (1/2π)·√(Σk_din/m)', () => {
    expect(Math.min(...R7.modes.map((md) => H.bagil(md.f_Hz, fb)))).toBeLessThan(TOL);
  });

  test('altı modun altısında ζ_r = ζ·f_r/f_zıplama (kuplajlı modlar dâhil)', () => {
    R7.modes.forEach((md, i) => {
      expect(H.bagil(R7.modalDamping[i].zeta, B7.zeta * md.f_Hz / fb)).toBeLessThan(TOL);
    });
  });

  test('C gerçekten α·K: takoz başına c/k_din bütün eksen ve takozlarda aynı', () => {
    const al = R7.damping.map((dm, i) => dm.c.map((c, a) => c / (R7.mounts[i].kdyn[a])));
    const a0 = al[0][0];
    al.forEach((r) => r.forEach((v) => expect(H.bagil(v, a0)).toBeLessThan(1e-12)));
    expect(H.bagil(a0, 2 * B7.zeta / (2 * Math.PI * fb))).toBeLessThan(1e-12);   // α = 2ζ/ω_zıplama
  });

  test('düşey FRF = tek serbestlikli formül (zıplama ayrışık, ζ_zıplama = ζ)', () => {
    const M6 = core.buildM6(R7.mp.m, R7.mp.I_G);
    [0.5, 4, fb, 12, 40].forEach((f) => {
      expect(H.bagil(core.frfAt(R7.mounts, R7.mp.cg, M6, R7.damping, f, 2), H.sdofT(f, fb, B7.zeta))).toBeLessThan(TOL);
    });
  });
});
