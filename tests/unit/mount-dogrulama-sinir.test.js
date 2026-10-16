/**
 * Takoz doğrulaması — SINIR DAVRANIŞI, KRİTER EŞİKLERİ, YÜZEYLER ARASI TUTARLILIK
 * ─────────────────────────────────────────────────────────────────────
 * Doğru çalışan bir hesap, uç durumda da dürüst kalmalı: sayı ya doğru basılır
 * ya da hiç basılmaz. Bu dosya üç soruyu sorar:
 *   1. kötü koşullu / dejenere modelde çözüm hâlâ doğru mu, değilse söyleniyor mu?
 *   2. uygunluk kriterleri eşiğin iki yanında doğru hükmü veriyor mu, ve aynı
 *      kriteri hesaplayan iki yüzey (§8.8 ve uygunluk tablosu) aynı hükmü mü?
 *   3. aynı büyüklüğü basan iki yüzey (Sonuçlar yorumu ↔ rapor) aynı sayıyı mı?
 */
const H = require('../helpers/takoz-dogrulama.js');
const { core, rp } = H.kur();
const G = H.G;
const GOVDE = [{ ad: 'Kutu', m: 1200, cg: [300, 20, 650], kutu: [1100, 700, 800] }];

describe('kötü koşullu model: rijitlik oranı 10⁶ (kz ≫ kx, ky)', () => {
  const R = H.coz(H.kurguModel({ govdeler: GOVDE,
    takozlar: H.dortluTakoz([300, 20, 650], 600, 350, 200, [0.01, 0.01, 1e4], [0.01, 0.01, 1e4]), cozucu: {} }));

  test('modlar iki uçta (≈ 0,03 Hz ve ≈ 30–45 Hz) ve özdeğer artığı makine hassasiyetinde', () => {
    expect(R.modes[0].f_Hz).toBeLessThan(0.05);
    expect(R.modes[5].f_Hz).toBeGreaterThan(30);
    const mk = H.birlesikKutle(R.components), M = H.M6of(mk.m, mk.I);
    const K = H.topla6(R.mounts, R.mp.cg, R.mounts.map((m) => m.kdyn));
    R.modes.forEach((md) => {
      const w2 = (2 * Math.PI * md.f_Hz) ** 2, Kp = H.matVek(K, md.phi), Mp = H.matVek(M, md.phi);
      expect(H.norm(Kp.map((v, i) => v - w2 * Mp[i])) / H.norm(Kp)).toBeLessThan(1e-9);
    });
  });

  test('statik denge 6 bileşende hâlâ tutuyor', () => {
    R.allCases.forEach((rc) => {
      const s = H.genelKuvvet(R.mounts, R.mp.cg, rc.res.perMount.map((pm) => pm.f));
      expect(H.norm(s.map((v, c) => v - rc.res.F[c])) / (H.norm(rc.res.F) + R.mp.m * G)).toBeLessThan(1e-10);
    });
  });
});

describe('tek nokta kütle: dönme ataleti sıfır', () => {
  const R = H.coz(H.kurguModel({ govdeler: [{ ad: 'Nokta', m: 1200, cg: [300, 20, 650], nokta: true }],
    takozlar: H.dortluTakoz([300, 20, 650], 600, 350, 0, [900, 700, 400], [1400, 1050, 600]), cozucu: {} }));

  test('modal çözüm üretilmiyor (M tekil) ve program çökmüyor', () => {
    expect(R.error).toBeUndefined();
    expect(R.modes).toBeNull();
  });

  test('uygunluk "modal sonuç yok" diyor — kriter uydurulmuyor', () => {
    const U = rp.veMntUygunluk(R, {});
    expect(U.modalYok).toBe(true);
    expect(U.satirlar).toHaveLength(0);
  });

  test('statik çözüm yine doğru: δz = −m·g/(4·kz) her takozda', () => {
    const st = R.allCases.find((c) => c.name === 'Static').res;
    st.perMount.forEach((pm) => expect(Math.abs(pm.delta[2] + 1200 * G / (4 * 400e3))).toBeLessThan(1e-12));
  });
});

// ═══════════════════ MEKANİZMA — çözülmez, SÖYLENİR ═══════════════════
// Takoz noktasal yaydır: hepsi tek doğru üzerindeyse o doğru etrafındaki dönme
// rijitliksizdir ve K tekildir (rijitlik ne olursa olsun). Eskiden üretim yolu
// (durduruculu çözücü) artık kapısı taşımadığı için tekil K'yı yuvarlama
// artığıyla "çözüyordu": yanal yükte sehim 1,2·10¹⁸ mm, |θ| 2·10³² rad, uyarısız.
const DOGRU = (dy) => [-500, 0, 600].map((x, i) => ({ ad: 'T' + i, p: [300 + x, 20 + (i === 2 ? dy : 0), 450],
  ks: [900, 700, 400], kd: [1400, 1050, 600] }));

describe('mekanizma: takozlar tek doğru üzerinde → çözüm reddedilir ve sebebi söylenir', () => {
  test('üç takoz x ekseni boyunca: çözücü reddediyor, Hesapla\'dan ÖNCE ön denetim aynı cümleyi gösteriyor', () => {
    const topo = H.kurguModel({ govdeler: GOVDE, takozlar: DOGRU(0), cozucu: {} });
    const R = H.coz(topo);
    expect(R.allCases).toBeUndefined();
    expect(R.error).toHaveLength(1);
    expect(R.error[0]).toMatch(/tek bir doğru üzerinde.*kinematik olarak serbest/);
    global.nodes = topo.nodes; global.connections = [];
    const { cp } = H.kur();
    expect(cp._mntOnDenetim(topo.nodes.find((n) => n.type === 'mnt-solver'))).toEqual(R.error);
  });

  test('tek takoz ve iki takoz da mekanizma (nokta · doğru)', () => {
    [[DOGRU(0).slice(0, 1), /Tek takoz var/], [DOGRU(0).slice(0, 2), /İki takoz tek bir doğru/]].forEach(([tk, re]) => {
      const R = H.coz(H.kurguModel({ govdeler: GOVDE, takozlar: tk, cozucu: {} }));
      expect(R.error).toHaveLength(1);
      expect(R.error[0]).toMatch(re);
    });
  });

  test('doğrudan 20 mm sapan takoz mekanizma DEĞİL: çözülür ve 6 bileşenli denge tutar', () => {
    const R = H.coz(H.kurguModel({ govdeler: GOVDE, takozlar: DOGRU(20), cozucu: {} }));
    expect(R.error).toBeUndefined();
    R.allCases.forEach((rc) => {
      expect(rc.res).toBeTruthy();
      const s = H.genelKuvvet(R.mounts, R.mp.cg, rc.res.perMount.map((pm) => pm.f));
      expect(H.norm(s.map((v, c) => v - rc.res.F[c])) / (H.norm(rc.res.F) + R.mp.m * G)).toBeLessThan(1e-9);
    });
  });

  test('tolerans göreli ve birimden bağımsız: sapma/uzaklık 10⁻⁷ → doğru, 10⁻⁵ → değil (mm ve m aynı hüküm)', () => {
    const nokta = (e, olcek) => [[0, 0, 0], [1, 0, 0], [2, e, 0]].map((p) => p.map((v) => v * olcek));
    [1, 1000].forEach((olcek) => {
      expect(core.collinearPoints(nokta(1e-7, olcek))).toBe('dogru');
      expect(core.collinearPoints(nokta(1e-5, olcek))).toBeNull();
    });
    expect(core.collinearPoints([[1, 2, 3], [1, 2, 3], [1, 2, 3]])).toBe('nokta');
  });

  test('durduruculu çözücü tekil K\'yı çözmüş saymıyor (artık kapısı, lineerdeki ile aynı)', () => {
    // Doğrudan çekirdek: doğrulama kapısı atlanırsa da sahte çözüm dönmesin.
    const ms = DOGRU(0).map((t) => ({ name: t.ad, pos: t.p.map((v) => v / 1000),
      kstat: t.ks.map((v) => v * 1000), kdyn: t.kd.map((v) => v * 1000) }));
    const cg = [0.3, 0.02, 0.65], K = core.buildK(ms, cg, false);
    const yanal = { n: [0, 0.6, -1], T: [0, 0, 0] };            // doğru etrafında moment → çözüm yok
    expect(core.solveCaseStop(K, ms, cg, 1200, G, yanal, {})).toBeNull();
    expect(core.solveCase(K, ms, cg, 1200, G, yanal)).toBeNull();
  });
});

// Kriter testleri gerçek bir çözümün modlarını kullanır; yalnız motor girdisi
// (rölanti, silindir) ve gerekiyorsa mod listesi değiştirilir.
const RA = H.coz(H.ornek('asfat'));
function motorlu(R, idleRpm, cylinders, modes) {
  return Object.assign({}, R, { modes: modes || R.modes,
    gather: Object.assign({}, R.gather, { torque: Object.assign({}, R.gather.torque, { idleRpm, cylinders }) }) });
}
const st = (U, no) => U.satirlar.find((s) => s.no === no).st;
const rozet1 = (R) => {
  const h = rp._mntRepFreqPlacement(R, {});
  return /Uygun · Kriter 1/.test(h) ? 'ok' : (/Dikkat · Kriter 1/.test(h) ? 'no' : '?');
};

describe('Kriter 1 — eşiğin iki yanında doğru hüküm, iki yüzey aynı hüküm', () => {
  const fmax = RA.modes[5].f_Hz;                        // 19,22 Hz (yalpa)
  // f_ateş = (N/60)·(z/2) → sınır 0,5·f_ateş = N·z/240; z = 6 → N = 40·sınır
  test.each([['sınırın %1 altında → kontrol', 0.99, 'no'], ['sınırın %1 üstünde → uygun', 1.01, 'ok']])('%s', (ad, k, beklenen) => {
    const R = motorlu(RA, 40 * fmax * k, 6);
    expect(st(rp.veMntUygunluk(R, {}), '1')).toBe(beklenen);
    expect(rozet1(R)).toBe(beklenen);                   // §8.8 rozeti aynı hükmü veriyor
  });
});

describe('Kriter 1 — TAM sınırda (f = 0,5·f_ateş) iki yüzey aynı hüküm', () => {
  // Kriter "f < 0,5·f_ateş" der: tam sınırdaki mod İHLALDİR. §8.8 rozeti bunu
  // '<' ile, uygunluk tablosu (modePlacement) '>' ile karşılaştırıyordu — tam
  // sınırda rozet "Dikkat", tablo "uygun" diyordu.
  test('600 d/dk · 6 sil. → sınır tam 15 Hz; en yüksek mod tam 15 Hz → ikisi de kontrol', () => {
    const R = motorlu(RA, 600, 6, RA.modes.map((m, i) => Object.assign({}, m, { f_Hz: [5, 6, 7, 11, 13, 15][i] })));
    expect(0.5 * (600 / 60) * (6 / 2)).toBe(15);                // testin anlamı: tam eşitlik
    expect(st(rp.veMntUygunluk(R, {}), '1')).toBe('no');
    expect(rozet1(R)).toBe('no');
  });
});

describe('Kriter 1a / 1b — eşik tanımları', () => {
  const temel = RA.modes.map((m) => Object.assign({}, m));
  const ile = (fs) => temel.map((m, i) => Object.assign({}, m, { f_Hz: fs[i] }));

  test('1a: komşu modlar arası en küçük fark 0,49 Hz → kontrol, 0,51 Hz → uygun', () => {
    expect(st(rp.veMntUygunluk(motorlu(RA, 600, 6, ile([5, 5.49, 7, 11, 13, 19])), {}), '1a')).toBe('no');
    expect(st(rp.veMntUygunluk(motorlu(RA, 600, 6, ile([5, 5.51, 7, 11, 13, 19])), {}), '1a')).toBe('ok');
  });

  test('1b: 8–10 Hz bandı UÇLAR DÂHİL — 8,00 ve 10,00 Hz bantta, 7,99 ve 10,01 Hz dışında', () => {
    expect(st(rp.veMntUygunluk(motorlu(RA, 600, 6, ile([5, 6, 8.0, 11, 13, 19])), {}), '1b')).toBe('no');
    expect(st(rp.veMntUygunluk(motorlu(RA, 600, 6, ile([5, 6, 10.0, 11, 13, 19])), {}), '1b')).toBe('no');
    expect(st(rp.veMntUygunluk(motorlu(RA, 600, 6, ile([5, 6, 7.99, 10.01, 13, 19])), {}), '1b')).toBe('ok');
  });
});

describe('Kriter 2 — §8.8 ile uygunluk tablosu aynı sayıyı ve aynı hükmü veriyor', () => {
  test.each([400, 600, 900, 1500])('rölanti %s d/dk', (rpm) => {
    const R = motorlu(RA, rpm, 6);
    const iso = rp._mntRepIsolation(R, {});
    const U = rp.veMntUygunluk(R, {});
    expect(st(U, '2')).toBe(iso.T < 0.5 ? 'ok' : 'no');
    // Tablo sayıyı Türkçe yazar ve sondaki sıfırı atar ("%3"); yazılan sayı ayrıştırılıp kıyaslanır.
    const yazilan = /T=<b>%([0-9.,]+)<\/b>/.exec(U.satirlar.find((s) => s.no === '2').bulgu);
    expect(yazilan).not.toBeNull();
    expect(Math.abs(veSayiOku(yazilan[1]) - iso.T * 100)).toBeLessThanOrEqual(0.05 + 1e-9);
  });

  // Eşiğin kendisi: yukarıdaki dört devirde T eşiğe yakın değil, yani eşik 0,6'ya
  // kaysa hiçbiri düşmezdi (mutasyonla ölçüldü). Devir, T = 0,5·(1 ± %1) olacak
  // biçimde SDOF bağıntısının tersinden kurulur (r > √2'de T azalan → ikiye bölme).
  test.each([['eşiğin %1 üstünde → kontrol', 1.01, 'no'], ['eşiğin %1 altında → uygun', 0.99, 'ok']])('T %s', (ad, k, beklenen) => {
    const iso0 = rp._mntRepIsolation(RA, {});
    const hedef = 0.5 * k;
    let a = Math.SQRT2 * 1.0001, b = 20;
    for (let i = 0; i < 200; i++) {
      const c = (a + b) / 2;
      if (H.sdofT(c, 1, iso0.zeta) > hedef) a = c; else b = c;
    }
    const R = motorlu(RA, (a + b) / 2 * iso0.fBounce * 120 / 6, 6);   // f_ateş = r·f_b = (N/60)·(6/2)
    const iso = rp._mntRepIsolation(R, {});
    expect(Math.abs(iso.T - hedef)).toBeLessThan(1e-9);
    expect(st(rp.veMntUygunluk(R, {}), '2')).toBe(beklenen);
    expect(iso.ok).toBe(beklenen === 'ok');
  });
});

describe('yüzeyler arası tutarlılık — Sonuçlar yorumu ↔ rapor', () => {
  const R = H.coz(H.ornek('asfat'), { sinyal: true });
  const ds = R.signals.find((s) => s.key === 'frf');

  test('ateşleme frekansında iletilebilirlik: Sonuçlar (ızgaradan ara değer) ↔ rapor (tam çözüm) %0,2 içinde', () => {
    const fF = 600 / 60 * 3;
    const i3 = rp._mntRepIsolation3(R, {});
    [0, 1, 2].forEach((dir) => {
      const T = ds.channels.find((c) => c.id === 'T_' + dir).data;
      const izgara = global.veMntBrief.interpAt(ds.x.data, T, fF, true);
      expect(H.bagil(izgara, i3.dirs[dir].T)).toBeLessThan(2e-3);
    });
  });

  test('Campbell kesişim devirleri modal frekanslardan birebir: N = 60·f/mertebe', () => {
    const cs = global.veMntBrief.campbellCrossings([{ o: 3 }], R.modes.map((m, i) => ({ no: i + 1, f: m.f_Hz })), 1e9);
    cs.forEach((c) => expect(c.rpm).toBeCloseTo(60 * c.f / 3, 9));
    expect(cs).toHaveLength(6);
  });
});
