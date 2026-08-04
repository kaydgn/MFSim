/**
 * Şok / geçici rejim yanıtı (js/mount-core.js shockResponse)
 * ─────────────────────────────────────────────────────────
 * Frekans yanıtı SÜREKLİ rejimi, ivme süpürmesi YARI-STATİK dengeyi anlatır.
 * İkisinin de anlatamadığı şey tek bir darbedir. Burası o darbenin zaman
 * tanım alanındaki çözümü: M q̈ + C q̇ + K q = −M ι a(t), Newmark-β.
 *
 * Sayısal integrasyonda hata SESSİZDİR: eğri makul görünür, tepe değeri
 * yanlıştır. Bu yüzden test edilen şey "bir eğri çıktı mı" değil, çözümün
 * BİLİNEN LİMİTLERE oturması:
 *
 *  1. YARI-STATİK LİMİT — darbe modun periyodundan çok uzunsa çözüm o andaki
 *     statik dengeye yakınsamalı (q = K⁻¹F). Bu, sağ taraf vektörünün, işaret
 *     sözleşmesinin ve integrasyonun hepsini birden kilitler.
 *  2. SÖNÜMSÜZ ENERJİ KORUNUMU — ζ=0'da darbe bittikten sonra genlik
 *     AZALMAMALI. Newmark γ=1/2 seçimi tam olarak bunun içindir; γ>1/2 yapay
 *     sönüm ekler ve "salınım ne kadar sürüyor" sorusunun cevabını bozar.
 *  3. SERBEST SALINIM FREKANSI — darbe sonrası salınım modal frekanslardan
 *     birinde olmalı. Kaymışsa kütle/rijitlik matrisi yanlış bağlanmıştır.
 */
const core = require('../../js/mount-core.js');
global.veMountCore = core;
global.veMntBrief = require('../../js/mount-brief.js');
const S = require('../../js/mount-signals.js');
const B = global.veMntBrief;

const mm = 1e-3, kNmm = 1e3, G = 9.81;

const COMPS = [
  { name: 'Motor', mass: 300, cg: [-0.2, 0, 0.4],
    I: [[20, 0, 0], [0, 40, 0], [0, 0, 35]], pointMass: false },
  { name: 'Şanzıman', mass: 150, cg: [0.4, 0, 0.3],
    I: [[8, 0, 0], [0, 20, 0], [0, 0, 18]], pointMass: false },
];
const MOUNTS = [
  ['Sağ Ön', -150, 250, 100], ['Sol Ön', -150, -250, 100],
  ['Sağ Arka', 500, 250, 120], ['Sol Arka', 500, -250, 120],
].map((m) => ({ name: m[0], pos: [m[1] * mm, m[2] * mm, m[3] * mm],
                kstat: [800 * kNmm, 800 * kNmm, 500 * kNmm],
                kdyn: [1200 * kNmm, 1200 * kNmm, 800 * kNmm] }));

const MP = core.combineMassProps(COMPS);
const M6 = core.buildM6(MP.m, MP.I_G);
const K6D = core.buildK(MOUNTS, MP.cg, true);
const STATIC_LC = { name: 'Static', n: [0, 0, -1], T: [0, 0, 0] };
const STAT = core.solveCase(core.buildK(MOUNTS, MP.cg, false), MOUNTS, MP.cg, MP.m, G, STATIC_LC);
const DAMP = core.mountDamping(MOUNTS, core.mountLoadShares(STAT, G), 0.02);
const ZERO = MOUNTS.map(() => ({ c: [0, 0, 0] }));
const MODES = core.solveModal(K6D, M6, MOUNTS, MP.cg);

const shock = (o) => core.shockResponse(MOUNTS, MP.cg, M6, DAMP,
  Object.assign({ dir: 2, aG: 3, dur: 0.020, g: G }, o));

describe('yarı-statik limit — çözümün ana kilidi', () => {
  test('uzun darbede q → K⁻¹F, altı serbestlikte birden', () => {
    // Darbe süresi en yavaş modun periyodundan çok uzunsa atalet terimi
    // kaybolur ve çözüm o andaki statik dengedir. Sağ taraf vektörü, işaret
    // sözleşmesi ve integrasyon bu tek testte birden doğrulanır.
    const tau = 6;                                  // en yavaş mod ~6 Hz → 36 çevrim
    const r = core.shockResponse(MOUNTS, MP.cg, M6, DAMP, { dir: 2, aG: 1, dur: tau, g: G });
    // Darbe tepesi t = τ/2'de (a = 1 g). Kayıt tEnd'de kesiliyorsa en yakın an.
    let i = 0;
    r.t.forEach((t, k) => { if (Math.abs(t - tau / 2) < Math.abs(r.t[i] - tau / 2)) i = k; });
    expect(r.a[i]).toBeCloseTo(1, 3);
    const qs = core.solveLinear(K6D, [0, 0, -MP.m * G, 0, 0, 0]);
    r.q[i].forEach((v, k) => expect(v).toBeCloseTo(qs[k], 5));
  });

  test('işaret doğru: aşağı ivme takozu BASAR (δz < 0)', () => {
    const r = shock({ aG: 3, dur: 0.020 });
    const qz = r.q.map((v) => v[2]);
    expect(Math.min(...qz)).toBeLessThan(0);
    // Darbenin ilk yarısında hareket aşağı: en büyük mutlak değer negatif
    const worst = qz.reduce((a, v) => (Math.abs(v) > Math.abs(a) ? v : a), 0);
    expect(worst).toBeLessThan(0);
  });
});

describe('sönümsüz durumda yapay sönüm YOK', () => {
  // Newmark γ = 1/2 seçiminin tek gerekçesi bu. γ > 1/2 sayısal sönüm ekler:
  // eğri güzel görünür, "salınım ne kadar sürüyor" cevabı yanlış çıkar.
  test('ζ = 0: darbe bittikten sonra TOPLAM ENERJİ korunuyor', () => {
    // Tek bir bileşenin genliğine bakmak yanıltır: altı mod birbiriyle vuruşur
    // (beating) ve q_z'nin tepesi sönüm olmadan da pencereden pencereye
    // değişir. Sayısal sönümün doğru ölçüsü KORUNAN BÜYÜKLÜKTÜR:
    //   E = ½ q̇ᵀMq̇ + ½ qᵀKq
    const r = core.shockResponse(MOUNTS, MP.cg, M6, ZERO, { dir: 2, aG: 3, dur: 0.020, g: G });
    const quad = (A, v) => {
      let s2 = 0;
      for (let i = 0; i < 6; i++) { let acc = 0; for (let j = 0; j < 6; j++) acc += A[i][j] * v[j]; s2 += v[i] * acc; }
      return s2;
    };
    const E = r.t.map((t, i) => (t > 0.03 ? 0.5 * quad(M6, r.qd[i]) + 0.5 * quad(K6D, r.q[i]) : null))
      .filter((v) => v !== null);
    expect(E.length).toBeGreaterThan(100);
    // Darbe bittikten sonra dış iş yok → E sabit kalmalı
    expect(Math.max(...E) / Math.min(...E) - 1).toBeLessThan(0.01);
    expect(E[E.length - 1] / E[0]).toBeCloseTo(1, 2);
  });

  test('ζ > 0: salınım gerçekten sönüyor', () => {
    const r = shock({});
    const after = r.t.map((t, i) => (t > 0.05 ? Math.abs(r.q[i][2]) : 0));
    const half = Math.floor(after.length / 2);
    expect(Math.max(...after.slice(half)) / Math.max(...after.slice(0, half))).toBeLessThan(0.9);
  });
});

describe('serbest salınım MODAL frekansta', () => {
  test('darbe sonrası sıfır geçişleri bir moda denk gelir', () => {
    // Frekans kaymışsa M ya da K yanlış bağlanmıştır — eğri yine makul görünür.
    const r = core.shockResponse(MOUNTS, MP.cg, M6, ZERO, { dir: 2, aG: 3, dur: 0.020, g: G });
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
    const modeF = MODES.filter((m) => m.f_Hz > 1e-6).map((m) => m.f_Hz);
    expect(modeF.some((mf) => Math.abs(f / mf - 1) < 0.06)).toBe(true);
  });
});

describe('takoz kuvvetleri ve çökmeler', () => {
  const r = shock({});

  test('her takoz için çökme ve kuvvet geçmişi, X ile aynı uzunlukta', () => {
    expect(r.per.length).toBe(MOUNTS.length);
    r.per.forEach((p) => {
      expect(p.d.length).toBe(r.t.length);
      expect(p.f.length).toBe(r.t.length);
    });
    expect(r.dMax.length).toBe(r.t.length);
  });

  test('en büyük çökme kanalı gerçekten takozların maksimumu', () => {
    r.dMax.forEach((v, i) => {
      expect(v).toBeCloseTo(Math.max(...r.per.map((p) => p.d[i])), 9);
    });
  });

  test('t = 0\'da sistem duruyor: çökme, kuvvet ve ivme sıfır', () => {
    expect(r.a[0]).toBeCloseTo(0, 12);
    r.q[0].forEach((v) => expect(v).toBeCloseTo(0, 12));
    r.per.forEach((p) => { expect(p.d[0]).toBeCloseTo(0, 12); expect(p.f[0]).toBeCloseTo(0, 12); });
  });

  test('darbe biçimi yarım sinüs, süresi kadar', () => {
    // Dikdörtgen darbe fiziksel değildir (sonsuz jerk) ve yapay yüksek frekans
    // içeriği katar; şok deneylerinin standardı yarım sinüstür.
    const tau = r.dur;
    r.t.forEach((t, i) => {
      const beklenen = (t >= 0 && t <= tau) ? 3 * Math.sin(Math.PI * t / tau) : 0;
      expect(r.a[i]).toBeCloseTo(beklenen, 9);
    });
    expect(Math.max(...r.a)).toBeCloseTo(3, 3);
  });

  test('tepe ivme ve süre girdisi çözümü ÖLÇEKLER (lineer sistem)', () => {
    // İki katı darbe → iki katı yanıt. Lineer bir sistemde bu zorunludur;
    // tutmazsa integrasyona bir yerden sabit sızmıştır.
    const a = shock({ aG: 1 }), b2 = shock({ aG: 2 });
    a.q.forEach((v, i) => expect(b2.q[i][2]).toBeCloseTo(2 * v[2], 9));
  });
});

describe('kayıt penceresi ve çözünürlük', () => {
  test('süre en yavaş modun birkaç çevrimini kapsar, 3 s ile sınırlı', () => {
    const r = shock({});
    const fLo = Math.min(...MODES.filter((m) => m.f_Hz > 1e-6).map((m) => m.f_Hz));
    expect(r.tEnd).toBeCloseTo(Math.min(0.02 + 8 / fLo, 3), 6);
    expect(r.t[r.t.length - 1]).toBeCloseTo(r.tEnd, 3);
  });

  test('adım boyu en hızlı modu ve darbeyi örnekleyecek kadar ince', () => {
    const r = shock({});
    const fHi = Math.max(...MODES.filter((m) => m.f_Hz > 1e-6).map((m) => m.f_Hz));
    expect(r.dt).toBeLessThanOrEqual(1 / (40 * fHi) + 1e-12);
    expect(r.dt).toBeLessThanOrEqual(r.dur / 40 + 1e-12);
    // Kayıt seyreltilir: 40 000 noktalı kanal panoya da yoruma da yük
    expect(r.t.length).toBeLessThanOrEqual(1502);
  });

  test('geçersiz girdi çökertmez', () => {
    expect(core.shockResponse(null, MP.cg, M6, DAMP, {})).toBeNull();
    expect(core.shockResponse(MOUNTS, MP.cg, null, DAMP, {})).toBeNull();
  });
});

describe('Sonuçlar kümeleri ve yorum', () => {
  const R = {
    mp: MP, mounts: MOUNTS, damping: DAMP, g: G, zeta: 0.02, modes: MODES,
    allCases: [{ name: 'Static', loadCase: STATIC_LC, res: STAT }],
    gather: { torque: { idleRpm: 800, cylinders: 6 } },
    shock: { aG: 3, ms: 20 },
  };
  const SETS = S.build(R, {});
  const ds = SETS.find((d) => d.key === 'shockz');

  test('üç yön için ayrı küme, X ekseni ZAMAN', () => {
    ['shockz', 'shocky', 'shockx'].forEach((k) => {
      const d = SETS.find((x) => x.key === k);
      expect(d).toBeTruthy();
      expect(d.x.unit).toBe('s');
      d.channels.forEach((c) => expect(c.data.length).toBe(d.x.data.length));
    });
  });

  test('Çözücü darbesi kümeye geçer', () => {
    expect(ds.meta.aPeak).toBe(3);
    expect(ds.meta.dur).toBeCloseTo(0.02, 9);
    const R2 = Object.assign({}, R, { shock: { aG: 5, ms: 40 } });
    const d2 = S.build(R2, {}).find((d) => d.key === 'shockz');
    expect(d2.meta.aPeak).toBe(5);
    expect(d2.meta.dur).toBeCloseTo(0.04, 9);
    // Darbe iki kat büyükse yanıt da büyür (lineer sistem)
    const p1 = Math.max(...ds.channels.find((c) => c.id === 'dmax').data);
    const p2 = Math.max(...d2.channels.find((c) => c.id === 'dmax').data);
    expect(p2).toBeGreaterThan(p1);
  });

  test('yorum: tepe değerler, durdurucu payı ve sönme süresi', () => {
    const ids = ds.channels.map((c) => c.id);
    const t = B.forLane(ds, R, ids).paras.join(' ');
    expect(t).toContain('yarım sinüs');
    expect(t).toContain('3 g');   // '3,00 g' değil — girilen sayıya olmayan hassasiyet eklenmez
    // Sönme süresi settleTime ile birebir
    const dm = ds.channels.find((c) => c.id === 'dmax');
    const ts = B.settleTime(ds.x.data, dm.data, 0.05);
    expect(t).toContain((ts * 1000).toFixed(ts * 1000 >= 100 ? 0 : 1).replace('.', ','));
  });

  test('genlik durdurucuyu aşarsa yorum ÇÖZÜMÜ GEÇERSİZ İLAN EDER', () => {
    // Şok çözümü lineerdir; durdurucu devrede değildir. Sessizce geçmek,
    // gerçekte çelikten geçen bir yükü kauçuktan geçiyormuş gibi raporlamaktır.
    const R3 = Object.assign({}, R, { shock: { aG: 60, ms: 20 } });
    const d3 = S.build(R3, {}).find((d) => d.key === 'shockz');
    const worst = Math.max(...d3.channels.find((c) => c.id === 'dmax').data);
    expect(worst).toBeGreaterThan(B.STOP_MM);
    const t = B.forLane(d3, R3, d3.channels.map((c) => c.id)).paras.join(' ');
    expect(t).toContain('geçerli değildir');
  });

  test('işaretler: darbenin bitişi ve durdurucu sınırı', () => {
    const marks = ds.brief.marks;
    const ev = marks.find((m) => m.axis === 'x' && /darbe biter/.test(m.label));
    expect(ev.value).toBeCloseTo(0.02, 9);
    const stop = marks.find((m) => m.axis === 'y' && m.kind === 'stop');
    expect(stop.value).toBe(B.STOP_MM);
    expect(stop.unit).toBe('mm');
  });
});
