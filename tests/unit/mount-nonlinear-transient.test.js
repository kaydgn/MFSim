/**
 * Nonlineer geçici rejim + tek rijitlik tabanı (js/mount-core.js)
 * ──────────────────────────────────────────────────────────────
 * Bu dosya İKİ eski hatanın kapısıdır. İkisi de sessizdi: program çalışıyor,
 * eğri makul görünüyor, sayı yanlış.
 *
 *  1. ŞOK ÇÖZÜMÜ LİNEERDİ. Statik çözücü nonlineer takoz yasasını Newton ile
 *     çözerken (solveCaseNL) geçici rejim sabit K_dyn ile tek doğrudan çözüm
 *     yapıyordu — Adams'ın her Δt'de koştuğu Newton–Raphson'ın karşılığı yoktu.
 *     Sertleşen takozda ölçülen fark 3,5 g'de %32 (lineer yol çökmeyi bu kadar
 *     FAZLA gösteriyor) ve metal-metal durdurucu hiç devrede değildi.
 *
 *  2. RİJİTLİK TABANI ÜÇ AYRI YERDEN GELİYORDU. Modal analiz statik dengedeki
 *     dinamik TANJANT'tan (buildKtangentDyn), FRF ile şok ise nominal
 *     k_dyn'den besleniyordu. Sonuç: aynı panoda panel 3. modu 14,317 Hz diye
 *     yazarken FRF eğrisi 13,958 Hz'de tepe yapıyordu. Üstelik sönüm katsayıları
 *     (c = 2ζ√(k·m)) tanjanttan türetildiği için FRF kendi içinde de tutarsızdı:
 *     C tanjanttan, K nominalden.
 *
 * Ölçülen büyüklük "bir eğri çıktı mı" değil, çözümün BİLİNEN LİMİTLERE
 * oturması: yarı-statik limitte Newton statik çözücüye, küçük genlik limitinde
 * de modal frekansa inmek ZORUNDA.
 */
const core = require('../../js/mount-core.js');

const mm = 1e-3, kNmm = 1e3, G = 9.81;

const COMPS = [
  { name: 'Motor', mass: 300, cg: [-0.2, 0, 0.4],
    I: [[20, 0, 0], [0, 40, 0], [0, 0, 35]], pointMass: false },
  { name: 'Şanzıman', mass: 150, cg: [0.4, 0, 0.3],
    I: [[8, 0, 0], [0, 20, 0], [0, 0, 18]], pointMass: false },
];

// Sertleşen düşey yasa: F = k0·x + c3·x³  (x mm, F N). Analitik fit biçimi
// ('poly') çekirdeğin makeAxisLaw'ında zaten var; nokta tablosu yerine bunu
// kullanmak eğriyi tam olarak bilinir kılıyor (tanjant kapalı formda).
const FIT_Z = { form: 'poly', k0: 500, c3: 6.0, c5: 0 };

const POS = [['Sağ Ön', -150, 250, 100], ['Sol Ön', -150, -250, 100],
             ['Sağ Arka', 500, 250, 120], ['Sol Arka', 500, -250, 120]];

// withFit=false → aynı takozun δ=0 tanjantıyla LİNEER karşılığı (k0 = 500 N/mm).
// dynRatio=false → k_dyn = k_stat; yarı-statik kilidi nonlineerlikten başka
// hiçbir şeyin bozmadığını görmek için.
function mkMounts(withFit, dynRatio) {
  return POS.map((m) => {
    const o = { name: m[0], pos: [m[1] * mm, m[2] * mm, m[3] * mm],
                kstat: [800 * kNmm, 800 * kNmm, 500 * kNmm],
                kdyn: dynRatio ? [1200 * kNmm, 1200 * kNmm, 800 * kNmm]
                               : [800 * kNmm, 800 * kNmm, 500 * kNmm] };
    if (withFit) o.fits = { z: FIT_Z };
    return o;
  });
}

const MP = core.combineMassProps(COMPS);
const M6 = core.buildM6(MP.m, MP.I_G);
const lcZ = (n) => ({ name: 'g' + n, n: [0, 0, -n], T: [0, 0, 0] });

// ═══════════════════════════════════════════════════════════════════════════

describe('tek rijitlik assembler — üç yol tek tabandan', () => {
  const M = mkMounts(true, true);

  test('buildK(dynamic) === buildKfromBasis(dynStiffBasis(null))', () => {
    const a = core.buildK(M, MP.cg, true);
    const b = core.buildKfromBasis(M, MP.cg, core.dynStiffBasis(M, null));
    a.forEach((row, i) => row.forEach((v, j) => expect(b[i][j]).toBeCloseTo(v, 9)));
  });

  test('lineer takozda tanjant taban === nominal k_dyn (T10 denkliği korunur)', () => {
    const L = mkMounts(false, true);
    const tan = core.buildKtangentDyn(L, MP.cg, null);
    const nom = core.buildK(L, MP.cg, true);
    tan.forEach((row, i) => row.forEach((v, j) => expect(nom[i][j]).toBeCloseTo(v, 6)));
  });

  test('EĞRİLİ takozda tanjant taban nominalden AYRILIR (hatanın yönü)', () => {
    const stat = core.solveCaseNL(M, MP.cg, MP.m, G, lcZ(1), { useStop: true });
    const kt = core.mountTangentKdyn(M, MP.cg, stat.q);
    // Sertleşen eğri + basma → tanjant nominalin ÜSTÜNDE olmalı
    kt.forEach((k, i) => expect(k[2]).toBeGreaterThan(M[i].kdyn[2]));
  });

  test('mountDynamicLaws: lineer takozda φ_dyn = k_dyn·δ (birebir)', () => {
    const L = mkMounts(false, true);
    const laws = core.mountDynamicLaws(L[0]);
    [-0.005, -0.001, 0, 0.002].forEach((d) => {
      expect(laws[2].force(d)).toBeCloseTo(L[0].kdyn[2] * d, 6);
      expect(laws[2].tangent(d)).toBeCloseTo(L[0].kdyn[2], 6);
    });
  });
});

describe('şok — lineer yol BİREBİR korunuyor', () => {
  const L = mkMounts(false, true);
  const stat = core.solveCase(core.buildK(L, MP.cg, false), L, MP.cg, MP.m, G, lcZ(1));
  const DAMP = core.mountDamping(L, core.mountLoadShares(stat, G), 0.02);
  const o = { dir: 2, aG: 3, dur: 0.020, g: G };

  test('eğri yok + durdurucu kapalı → Newton yoluna HİÇ girilmez', () => {
    const r = core.shockResponse(L, MP.cg, M6, DAMP, o);
    expect(r.nonlinear).toBe(false);
    expect(r.newtonIters).toBe(0);
  });

  test('Newton yolu zorlanınca AYNI sonucu verir (indirgeme kanıtı)', () => {
    // Lineer yasada Ψ(q) = K_dyn·q ve tanjant sabittir → Newton ilk düzeltmede
    // tam çözüme iner. Sonuç birebir eşleşmezse indirgeme bozulmuştur.
    const a = core.shockResponse(L, MP.cg, M6, DAMP, o);
    const b = core.shockResponse(L, MP.cg, M6, DAMP,
      Object.assign({ nonlinear: true }, o));
    expect(b.nonlinear).toBe(true);
    expect(b.newtonIters).toBeGreaterThan(0);
    expect(b.t.length).toBe(a.t.length);
    a.q.forEach((qa, i) => qa.forEach((v, k) => {
      expect(b.q[i][k]).toBeCloseTo(v, 9);
    }));
    a.per.forEach((p, i) => p.f.forEach((v, k) => {
      expect(b.per[i].f[k]).toBeCloseTo(v, 6);
    }));
  });
});

describe('YARI-STATİK KİLİT — Newton statik çözücüye inmek zorunda', () => {
  // Bu testin kilitlediği şey tek bir sayı değil: sağ taraf vektörü, işaret
  // sözleşmesi, q₀ etrafında lineerleştirme, nonlineer yasanın TOPLAM sehimde
  // okunması ve Newmark integrasyonu — hepsi birden.
  const M = mkMounts(true, false);          // k_dyn = k_stat: nonlineerliği izole et
  const s1 = core.solveCaseNL(M, MP.cg, MP.m, G, lcZ(1), { useStop: true });
  const KT = core.mountTangentKdyn(M, MP.cg, s1.q);
  const shares = core.mountLoadShares(s1, G);
  const dampAt = (z) => core.mountDamping(M, shares, z, KT);
  const DAMP = dampAt(0.05);
  const A = 2, tau = 2;                     // en yavaş mod ~6 Hz → 12 çevrim

  // Darbe tepesindeki (t = τ/2) bağıl hata — statik çözücüye göre.
  function qsError(zeta) {
    const s3 = core.solveCaseNL(M, MP.cg, MP.m, G, lcZ(1 + A), { useStop: true });
    const want = s3.q.map((v, i) => v - s1.q[i]);
    const r = core.shockResponse(M, MP.cg, M6, dampAt(zeta),
      { dir: 2, aG: A, dur: tau, g: G, useStop: true, q0: s1.q });
    let i = 0;
    r.t.forEach((t, k) => { if (Math.abs(t - tau / 2) < Math.abs(r.t[i] - tau / 2)) i = k; });
    const e = want.map((v, k) => (Math.abs(v) < 1e-9 ? 0
                                  : Math.abs(r.q[i][k] - v) / Math.abs(v)));
    return { r, i, err: Math.max(...e), aPk: r.a[i] };
  }

  test('uzun darbede q → q_statik(1+A) − q_statik(1)', () => {
    const o = qsError(0.20);
    expect(o.r.nonlinear).toBe(true);
    expect(o.r.converged).toBe(true);
    expect(o.aPk).toBeCloseTo(A, 2);
    expect(o.err).toBeLessThan(2e-3);
  });

  test('kalan fark ATALET ARTIĞI — sönüm arttıkça küçülüyor', () => {
    // Bir sapmayı "yakınsama toleransı" diye geçiştirmek kolay. Ayırt edici
    // ölçüm bu: yarı-statik limitte kalan fark yalnız sönmemiş salınımdan
    // geliyorsa sönüm arttıkça KÜÇÜLMELİ. Model yanlış olsaydı sabit kalırdı.
    const e05 = qsError(0.05).err, e10 = qsError(0.10).err, e20 = qsError(0.20).err;
    expect(e10).toBeLessThan(e05);
    expect(e20).toBeLessThan(e10);
    expect(e20).toBeLessThan(e05 / 10);
  });

  test('LİNEER yol aynı limitte ŞAŞIYOR — kapının ölçtüğü fark', () => {
    // Aynı darbe, aynı takoz, tek fark eğrinin devrede olması. Sertleşen
    // yasada lineer çözüm çökmeyi FAZLA gösterir; bu testin sayısı düşerse
    // Newton yolu sessizce devre dışı kalmış demektir.
    const A = 2, tau = 2;
    const L = mkMounts(false, false);
    const rl = core.shockResponse(L, MP.cg, M6, DAMP, { dir: 2, aG: A, dur: tau, g: G });
    const rn = core.shockResponse(M, MP.cg, M6, DAMP,
      { dir: 2, aG: A, dur: tau, g: G, useStop: true, q0: s1.q });
    const pk = (r) => Math.max(...r.dMax);
    expect(pk(rl) / pk(rn)).toBeGreaterThan(1.15);
  });
});

describe('KÜÇÜK GENLİK KİLİDİ — şok, modal ve FRF aynı frekansta', () => {
  const M = mkMounts(true, true);
  const s1 = core.solveCaseNL(M, MP.cg, MP.m, G, lcZ(1), { useStop: true });
  const KB = core.mountTangentKdyn(M, MP.cg, s1.q);
  const DAMP = core.mountDamping(M, core.mountLoadShares(s1, G), 0.02, KB);
  const modesTan = core.solveModal(core.buildKtangentDyn(M, MP.cg, s1.q), M6, M, MP.cg);
  const modesNom = core.solveModal(core.buildK(M, MP.cg, true), M6, M, MP.cg);
  const fTan = modesTan.map((m) => m.f_Hz);
  const fNom = modesNom.map((m) => m.f_Hz);

  test('iki taban gerçekten farklı frekans veriyor (test anlamlı mı?)', () => {
    // Ayrışma yoksa aşağıdaki iki testin ayırt gücü de yoktur.
    const sep = fTan.map((f, i) => Math.abs(f / fNom[i] - 1));
    expect(Math.max(...sep)).toBeGreaterThan(0.03);
  });

  test('şokun serbest salınımı TANJANT moda oturur, nominale değil', () => {
    const r = core.shockResponse(M, MP.cg, M6, null,
      { dir: 2, aG: 0.01, dur: 0.02, g: G, useStop: true, q0: s1.q, kBasis: KB });
    const t = [], q = [];
    r.t.forEach((tt, i) => { if (tt > 0.05) { t.push(tt); q.push(r.q[i][2]); } });
    let first = NaN, last = NaN, n = 0;
    for (let i = 1; i < q.length; i++) {
      if (q[i - 1] < 0 && q[i] >= 0) {
        const tc = t[i - 1] + (t[i] - t[i - 1]) * (-q[i - 1]) / (q[i] - q[i - 1]);
        if (!Number.isFinite(first)) first = tc; else last = tc;
        n++;
      }
    }
    expect(n).toBeGreaterThan(3);
    const f = (n - 1) / (last - first);
    const dTan = Math.min(...fTan.map((v) => Math.abs(f / v - 1)));
    const dNom = Math.min(...fNom.map((v) => Math.abs(f / v - 1)));
    expect(dTan).toBeLessThan(0.02);
    expect(dTan).toBeLessThan(dNom);           // yön: tanjanta DAHA yakın
  });

  test('FRF tepesi TANJANT moda oturur (14,317 ↔ 13,958 ayrışması)', () => {
    const fr = core.frequencyResponse(M, MP.cg, M6, DAMP,
      { fMin: 1, fMax: 60, nPts: 3000, dir: 2 });
    let bi = 0;
    fr.T.forEach((v, i) => { if (v > fr.T[bi]) bi = i; });
    const fPk = fr.f[bi];
    const dTan = Math.min(...fTan.map((v) => Math.abs(fPk / v - 1)));
    const dNom = Math.min(...fNom.map((v) => Math.abs(fPk / v - 1)));
    expect(dTan).toBeLessThan(0.01);
    expect(dTan).toBeLessThan(dNom);
  });

  test('taban damping kayıtlarından ÇÖZÜLÜYOR — çağıran unutamaz', () => {
    // mountDamping kBasis'i sakladığı için frequencyResponse/frfAt onu
    // damping'ten okur; açık parametre geçmek AYNI sonucu vermeli.
    const auto = core.frfAt(M, MP.cg, M6, DAMP, 12, 2);
    const expl = core.frfAt(M, MP.cg, M6, DAMP, 12, 2, KB);
    expect(auto).toBeCloseTo(expl, 9);
    // Nominal tabanla ölçülebilir biçimde FARKLI (yoksa test bir şey ölçmüyor)
    const nomD = core.mountDamping(M, core.mountLoadShares(s1, G), 0.02);
    const nom = core.frfAt(M, MP.cg, M6, nomD.map((d) => ({ c: d.c })), 12, 2);
    expect(Math.abs(auto / nom - 1)).toBeGreaterThan(0.01);
  });
});

describe('yakınsama görünür ve dürüst', () => {
  const M = mkMounts(true, true);
  const s1 = core.solveCaseNL(M, MP.cg, MP.m, G, lcZ(1), { useStop: true });
  const DAMP = core.mountDamping(M, core.mountLoadShares(s1, G), 0.02,
                                 core.mountTangentKdyn(M, MP.cg, s1.q));

  test('adım başına iterasyon sayısı makul (başlangıç tahmini iyi)', () => {
    const r = core.shockResponse(M, MP.cg, M6, DAMP,
      { dir: 2, aG: 5, dur: 0.020, g: G, useStop: true, q0: s1.q });
    expect(r.converged).toBe(true);
    const nStep = Math.round(r.tEnd / r.dt);
    expect(r.newtonIters / nStep).toBeGreaterThan(1);   // gerçekten koşuyor
    expect(r.newtonIters / nStep).toBeLessThan(6);      // ve patlamıyor
  });

  test('durdurucuya oturunca stopHit işaretleniyor', () => {
    const soft = mkMounts(false, true).map((m) => Object.assign({}, m, {
      kstat: [80 * kNmm, 80 * kNmm, 50 * kNmm], kdyn: [120 * kNmm, 120 * kNmm, 80 * kNmm] }));
    const r = core.shockResponse(soft, MP.cg, M6, null,
      { dir: 2, aG: 20, dur: 0.030, g: G, useStop: true });
    expect(r.stopHit).toBe(true);
    expect(r.converged).toBe(true);
  });
});

describe('BMC TTAR referans modeli — durdurucu payı 10 kat abartılıyordu', () => {
  // Bu, projenin kendi referans montajı (mount-core TTAR_EXAMPLE) ve
  // raporların 3 g / 20 ms darbesi. Bulunan şey bir "tutarlılık rötuşu"
  // değil, mühendislik sonucunu değiştiren bir sayı:
  //
  //   statik önyük  7,11 mm   ← eski kontrol bunu HİÇ saymıyordu
  //   darbe         9,79 mm   ← ±15 mm ile karşılaştırılan tek sayı buydu
  //   TOPLAM       14,56 mm   ← durdurucunun gerçekten gördüğü sehim
  //
  // Eski yorum "±15 mm sınırına 5,21 mm pay kalıyor" diyordu; gerçek pay
  // 0,45 mm. Boşluk YÜKSÜZ konumdan ölçülür, dolayısıyla önyük sayılmak
  // ZORUNDA. Bu sayılar kayarsa ya darbe ya da önyük tanımı değişmiştir.
  const comps = core.ttarComponentsSI();
  const mnts = core.ttarMountsSI();
  const mp = core.combineMassProps(comps);
  const m6 = core.buildM6(mp.m, mp.I_G);
  const st = core.solveCaseStop(core.buildK(mnts, mp.cg, false), mnts, mp.cg, mp.m, G,
    { name: 'Static', n: [0, 0, -1], T: [0, 0, 0] }, { useStop: true });
  const damp = core.mountDamping(mnts, core.mountLoadShares(st, G), 0.02);
  const r = core.shockResponse(mnts, mp.cg, m6, damp,
    { dir: 2, aG: 3, dur: 0.020, g: G, useStop: true, q0: st.q });

  test('statik önyük gerçekten var ve şok çözümüne giriyor', () => {
    expect(Math.max(...r.d0)).toBeCloseTo(7.107, 2);
    expect(r.q0).toEqual(st.q);
  });

  test('toplam sehim darbenin kendisinden ÇOK daha büyük', () => {
    const dPulse = Math.max(...r.dMax);
    const dTot = Math.max(...r.dTotMax);
    expect(dPulse).toBeCloseTo(9.787, 2);
    expect(dTot).toBeCloseTo(14.555, 2);
    // Eski kontrolün payı 5,2 mm; gerçek pay 0,45 mm — 10 kattan fazla fark.
    expect((15 - dPulse) / (15 - dTot)).toBeGreaterThan(10);
  });

  test('bu darbede durdurucuya OTURMUYOR — ama payı yok denecek kadar az', () => {
    expect(r.stopHit).toBe(false);
    expect(r.converged).toBe(true);
    expect(15 - Math.max(...r.dTotMax)).toBeLessThan(1);
  });
});
