/**
 * Kriter tamamlama + tasarım iterasyonu
 * ─────────────────────────────────────
 * ASR-SR-116 s.10'daki dört isterin ÜÇÜ doğrudan mod listesinden okunur; program
 * bunlardan yalnız birini (en yüksek mod) kontrol ediyordu. Burada kilitlenenler:
 *
 *   · principalInertia — atalet tensörünün asal eksene ayrıştırılması
 *     (dış yazılımların "aggregate mass" çıktısıyla karşılaştırma için)
 *   · modePlacement    — ½·f_ateş sınırı TÜM modlarda, mod ayrıklığı, 8–10 Hz bandı
 *   · softeningScan    — rijitlik ölçeklendikçe modların ve T'nin gerçekten
 *                        yeniden çözülmesi (f∝√k varsayılmaz)
 *
 * ALTIN REFERANS: ASR-SR-116 Tablo 19 — %50 yumuşatma sonrası
 * 4,19 / 4,67 / 5,23 / 8,06 / 9,41 / 13,42 Hz ve T = %9,9.
 */

const core = require('../../js/mount-core.js');
global.veMountCore = core;
const stubs = stubGlobals({ saveState: jest.fn(), showToast: jest.fn() });
const rep = require('../../js/cp-mount-report.js');

const mm = (v) => v / 1000, kN = (v) => v * 1000;
const c = (n, m, x, y, z, ix, iy, iz) => ({ name: n, mass: m, cg: [mm(x), mm(y), mm(z)],
  I: [[ix, 0, 0], [0, iy, 0], [0, 0, iz]], pointMass: false });

// ── ASFAT 8x8 Obüs (ASR-SR-116) — kayıt defterindeki örneğin aynısı ──
const COMPS = [
  c('Motor', 1600, -314.94, -0.127, 857.56, 110.7, 260.2, 205.9),
  c('Şanzıman', 600, 945.373, -9.97, 680.96, 16.43, 68.15, 64.91),
  c('Şaft', 16, 2246, 156, 0, 0.042, 1.16, 1.16),
  c('Sol Braket', 48, 760.963, -300.631, 736.392, 0.315, 4.392, 4.211),
  c('Sağ Braket', 48, 760.963, 300.631, 736.392, 0.315, 4.392, 4.211),
  c('Top PTO Grubu', 97, 1058.064, 77.013, 894.726, 0.45, 6.515, 6.15),
  c('Side PTO Grubu', 46, 855.34, -269.52, 473.3, 0.136, 0.915, 0.915),
];
const ON = { s: [1045, 1045, 1800], d: [1045, 1045, 1800] };
const AR = { s: [462, 462, 2200], d: [630, 630, 3000] };
const MOUNTS = [['Ön Sol', -953.45, -50.67, 367, ON], ['Ön Sağ', -953.45, 50.67, 367, ON],
  ['Sol Ön', 535.31, -347.1, 615.77, AR], ['Sağ Ön', 535.31, 347.1, 615.77, AR],
  ['Sol Arka', 636.8, -347.1, 615.77, AR], ['Sağ Arka', 636.8, 347.1, 615.77, AR]]
  .map((h) => ({ name: h[0], pos: [h[1], h[2], h[3]].map(mm),
                 kstat: h[4].s.map(kN), kdyn: h[4].d.map(kN) }));

const MP = core.combineMassProps(COMPS);
const M6 = core.buildM6(MP.m, MP.I_G);
const MODES = core.solveModal(core.buildK(MOUNTS, MP.cg, true), M6, MOUNTS, MP.cg);
const STAT = core.solveCase(core.buildK(MOUNTS, MP.cg, false), MOUNTS, MP.cg, MP.m, 9.81,
                            { name: 'Static', n: [0, 0, -1], T: [0, 0, 0] });

describe('principalInertia — asal atalet ayrıştırması', () => {
  test('köşegen tensörde değerler değişmez, eksenler birim', () => {
    const p = core.principalInertia([[3, 0, 0], [0, 1, 0], [0, 0, 2]]);
    expect(p.values).toEqual([1, 2, 3]);                     // artan sırada
    p.axes.forEach((e) => {
      const norm = Math.hypot(e[0], e[1], e[2]);
      expect(norm).toBeCloseTo(1, 12);
    });
  });

  test('DÖNDÜRÜLMÜŞ tensörün asal değerleri özgün köşegeni geri verir', () => {
    // Bu, dokümanla karşılaştırmanın çekirdeği: Adams ataleti asal eksende basar,
    // biz global eksende tutarız. Ayrıştırma doğruysa iki taraf aynı sayıya gelir.
    const s = Math.SQRT1_2, R = [[s, -s, 0], [s, s, 0], [0, 0, 1]];
    const D = [[5, 0, 0], [0, 1, 0], [0, 0, 3]];
    const mul = (A, B) => A.map((r) => B[0].map((_, j) => r.reduce((a, v, k) => a + v * B[k][j], 0)));
    const T = (A) => A[0].map((_, j) => A.map((r) => r[j]));
    const I = mul(mul(R, D), T(R));
    expect(I[0][1]).not.toBeCloseTo(0, 6);                   // gerçekten köşegen dışı
    const p = core.principalInertia(I);
    expect(p.values[0]).toBeCloseTo(1, 9);
    expect(p.values[1]).toBeCloseTo(3, 9);
    expect(p.values[2]).toBeCloseTo(5, 9);
  });

  test('iz (trace) korunur — özdeğerlerin toplamı köşegenin toplamı', () => {
    const p = core.principalInertia(MP.I_G);
    const iz = MP.I_G[0][0] + MP.I_G[1][1] + MP.I_G[2][2];
    expect(p.values.reduce((a, b) => a + b, 0)).toBeCloseTo(iz, 6);
  });

  test('eksenler dik (ortonormal taban)', () => {
    const p = core.principalInertia(MP.I_G);
    const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
    expect(dot(p.axes[0], p.axes[1])).toBeCloseTo(0, 9);
    expect(dot(p.axes[0], p.axes[2])).toBeCloseTo(0, 9);
    expect(dot(p.axes[1], p.axes[2])).toBeCloseTo(0, 9);
  });

  test('girdi yoksa null', () => {
    expect(core.principalInertia(null)).toBeNull();
  });
});

describe('modePlacement — ASR-SR-116 s.10 kriterleri', () => {
  test('SINIR AŞIMI tüm modlarda aranır (yalnız en yüksekte değil)', () => {
    // Kritik regresyon: en yüksek mod sınırın ALTINDA, ortadaki bir mod ÜSTÜNDE.
    const md = [2, 4, 30, 6, 8].map((f) => ({ f_Hz: f, label: 'x' }));
    const pl = core.modePlacement(md, { fLimit: 15 });
    expect(pl.exceed).toHaveLength(1);
    expect(pl.exceed[0].no).toBe(3);
    expect(pl.fMax).toBe(30);
    // Yalnız fMax'a bakan bir kontrol burada yanlış hüküm verirdi:
    expect(md[md.length - 1].f_Hz).toBeLessThan(15);
  });

  test('ASFAT modelinde tek aşan mod roll (mod 6)', () => {
    const pl = core.modePlacement(MODES, { fLimit: 15 });     // f_ateş 30 → sınır 15
    expect(pl.exceed).toHaveLength(1);
    expect(pl.exceed[0].no).toBe(6);
    expect(pl.exceed[0].f).toBeCloseTo(19.217, 2);
  });

  test('mod ayrıklığı: en küçük aralık ve hangi çift olduğu', () => {
    const pl = core.modePlacement(MODES, {});
    expect(pl.gaps).toHaveLength(5);
    expect(pl.minGap).toBeCloseTo(0.675, 2);                  // mod 1–2
    expect(pl.minGapPair).toEqual([1, 2]);
    expect(pl.minGap).toBeGreaterThan(0.5);                   // ASFAT bu kriteri geçiyor
  });

  test('%50 yumuşatmada ayrıklık kriteri KIRILIR (dokümanın kendi çelişkisi)', () => {
    // ASR-SR-116 s.19 yumuşatılmış tasarım için "isterleri sağlamaktadır" diyor,
    // ama kendi Tablo 19'unda mod 1–2 aralığı 4,67−4,19 = 0,48 < 0,5.
    const soft = MOUNTS.map((m) => Object.assign({}, m, {
      kstat: m.kstat.map((v) => v / 2), kdyn: m.kdyn.map((v) => v / 2) }));
    const md = core.solveModal(core.buildK(soft, MP.cg, true), M6, soft, MP.cg);
    const pl = core.modePlacement(md, {});
    expect(pl.minGap).toBeLessThan(0.5);
    expect(pl.minGapPair).toEqual([1, 2]);
  });

  test('yaylandırılmamış kütle bandı (8–10 Hz) taraması', () => {
    expect(core.modePlacement(MODES, {}).inBand).toHaveLength(0);   // ASFAT temiz
    const md = [5, 9.4, 12, 20].map((f) => ({ f_Hz: f, label: 'x' }));
    const pl = core.modePlacement(md, {});
    expect(pl.inBand).toHaveLength(1);
    expect(pl.inBand[0].no).toBe(2);
    // bant sınırları ayarlanabilir
    expect(core.modePlacement(md, { bandLo: 11, bandHi: 13 }).inBand[0].no).toBe(3);
  });

  test('fLimit verilmezse aşım listesi boş (hüküm verilmez)', () => {
    expect(core.modePlacement(MODES, {}).exceed).toHaveLength(0);
    expect(Number.isNaN(core.modePlacement(MODES, {}).fLimit)).toBe(true);
  });

  test('mod yoksa null', () => {
    expect(core.modePlacement([], {})).toBeNull();
    expect(core.modePlacement(null, {})).toBeNull();
  });
});

describe('softeningScan — ASR-SR-116 Tablo 19 yeniden üretiliyor', () => {
  const SCAN = core.softeningScan(MOUNTS, MP.cg, M6, MP.m, [1, 0.5], 30, 0.02);

  test('%100 satırı mevcut tasarımla birebir aynı', () => {
    SCAN[0].modes.forEach((m, i) => expect(m.f_Hz).toBeCloseTo(MODES[i].f_Hz, 9));
  });

  test('%50 yumuşatma → PDF Tablo 19 (%1,5 içinde) ve T = %9,9', () => {
    const PDF19 = [4.19, 4.67, 5.23, 8.06, 9.41, 13.42];
    SCAN[1].modes.forEach((m, i) => {
      expect(Math.abs(m.f_Hz - PDF19[i]) / PDF19[i]).toBeLessThan(0.015);
    });
    expect(SCAN[1].T * 100).toBeCloseTo(9.9, 1);              // s.19: "% 9.9"
  });

  test('TEK katsayıda frekanslar TAM olarak √α ile gider (kuplaj fark etmez)', () => {
    // αKφ = ω²Mφ ⇒ ω² ∝ α. Bu bir yaklaşım değil, özdeğer probleminin kimliği.
    // Rapor metni de bunu böyle söylemeli — "kuplajlı modlarda √k tutmaz" YANLIŞ.
    SCAN[1].modes.forEach((m, i) => {
      expect(m.f_Hz / MODES[i].f_Hz).toBeCloseTo(Math.SQRT1_2, 10);
    });
  });

  test('İLETİLEBİLİRLİK katsayıyla orantılı DEĞİL — tablonun asıl bilgisi bu', () => {
    // Frekanslar α'ya göre TAM √α ile gider; T(r) rasyonel olduğu için gitmez.
    // Kanıt: ardışık yarılamalarda T oranı sabit kalmaz (kuvvet yasası yok).
    const s = core.softeningScan(MOUNTS, MP.cg, M6, MP.m, [1, 0.5, 0.25], 30, 0.02);
    const o1 = s[1].T / s[0].T, o2 = s[2].T / s[1].T;
    expect(Math.abs(o1 - o2)).toBeGreaterThan(0.01);
    // Frekans oranı ise iki adımda da BİREBİR aynı (kıyas noktası)
    const f1 = s[1].modes[0].f_Hz / s[0].modes[0].f_Hz;
    const f2 = s[2].modes[0].f_Hz / s[1].modes[0].f_Hz;
    expect(Math.abs(f1 - f2)).toBeLessThan(1e-12);
  });

  test('takoz başına FARKLI katsayı gerekirse √α kuralı düşer (tarama yine doğru)', () => {
    // Yalnız arka dörtlüyü yumuşat: artık tek bir α yok, kapalı form kullanılamaz.
    const kismi = MOUNTS.map((m, i) => (i < 2 ? m : Object.assign({}, m, {
      kstat: m.kstat.map((v) => v / 2), kdyn: m.kdyn.map((v) => v / 2) })));
    const md = core.solveModal(core.buildK(kismi, MP.cg, true), M6, kismi, MP.cg);
    const oran = md.map((m, i) => m.f_Hz / MODES[i].f_Hz);
    const yayilim = Math.max(...oran) - Math.min(...oran);
    expect(yayilim).toBeGreaterThan(0.05);                    // modlar farklı oranlarda düşer
  });

  test('f_bounce tam olarak √ölçek ile gider (tek serbestlik — kuplaj yok)', () => {
    expect(SCAN[1].fBounce / SCAN[0].fBounce).toBeCloseTo(Math.SQRT1_2, 9);
  });

  test('yumuşatma izolasyonu İYİLEŞTİRİR, sertleştirme kötüleştirir', () => {
    const s = core.softeningScan(MOUNTS, MP.cg, M6, MP.m, [1.5, 1, 0.5], 30, 0.02);
    expect(s[0].T).toBeGreaterThan(s[1].T);
    expect(s[1].T).toBeGreaterThan(s[2].T);
  });

  test('sönümsüz karşılık da üretilir; ζ=0 ise ikisi eşit', () => {
    expect(SCAN[1].T).toBeGreaterThan(SCAN[1].T0);            // izolasyon bölgesinde ζ T'yi artırır
    const z0 = core.softeningScan(MOUNTS, MP.cg, M6, MP.m, [0.5], 30, 0)[0];
    expect(z0.T).toBeCloseTo(z0.T0, 12);
  });

  test('kaynak takozlar DEĞİŞMEZ (tarama kopya üzerinde çalışır)', () => {
    const once = MOUNTS.map((m) => m.kdyn.slice());
    core.softeningScan(MOUNTS, MP.cg, M6, MP.m, [0.25], 30, 0.02);
    MOUNTS.forEach((m, i) => expect(m.kdyn).toEqual(once[i]));
  });

  test('girdi eksikse null', () => {
    expect(core.softeningScan([], MP.cg, M6, MP.m, [1], 30, 0.02)).toBeNull();
    expect(core.softeningScan(MOUNTS, MP.cg, null, MP.m, [1], 30, 0.02)).toBeNull();
  });
});

describe('Rapor — §8.1 asal atalet, §8.15 yumuşatma, §8.16 mod şekilleri', () => {
  const R = {
    mp: MP, mounts: MOUNTS, modes: MODES, zeta: 0.02,
    allCases: [{ name: 'Static', res: STAT }],
    gather: { torque: { idleRpm: 600, cylinders: 6 },
              components: COMPS.map((x) => ({ name: x.name, mass: x.mass,
                cgx: x.cg[0] * 1000, cgy: x.cg[1] * 1000, cgz: x.cg[2] * 1000 })),
              mounts: MOUNTS.map((m) => ({ name: m.name,
                x: m.pos[0] * 1000, y: m.pos[1] * 1000, z: m.pos[2] * 1000 })) },
  };

  test('§8.1 asal atalet tablosu: değerler, eksenler ve çarpım oranı', () => {
    const h = rep._mntRepStep1Mass(R);
    expect(h).toContain('Asal atalet');
    expect(h).toContain('Asal eksen e');
    expect(h).toContain('Çarpım I');
    const pr = core.principalInertia(MP.I_G);
    expect(h).toContain(rep._rF(pr.values[0], 2));
  });

  test('§8.1 eksenler çakışıksa "doğrudan yorumlanabilir", değilse UYARIR', () => {
    const cakisik = Object.assign({}, R, { mp: Object.assign({}, MP,
      { I_G: [[100, 0, 0], [0, 200, 0], [0, 0, 150]] }) });
    expect(rep._mntRepStep1Mass(cakisik)).toContain('doğrudan yorumlanabilir');
    const egik = Object.assign({}, R, { mp: Object.assign({}, MP,
      { I_G: [[100, 40, 0], [40, 200, 0], [0, 0, 150]] }) });
    const h = rep._mntRepStep1Mass(egik);
    expect(h).toContain('asal eksenlerle çakışık değildir');
    expect(h).toContain('aggregate mass');
  });

  test('§8.15 yumuşatma tablosu üretilir; %100 satırı mevcut tasarım', () => {
    const h = rep._mntRepSoftening(R, {});
    expect(h).toContain('8.15 Rijitlik yumuşatma');
    expect(h).toContain('100%');
    expect(h).toContain('50%');
    expect(h).toContain(rep._rF(MODES[0].f_Hz, 2));           // mevcut mod 1 tabloda
  });

  test('§8.15 ASFAT: hiçbir ölçek TÜM kriterleri sağlamıyor ve ENGELİ adlandırıyor', () => {
    // Gerçek bulgu: %50 yumuşatma Kriter 1'i düzeltiyor ama mod ayrıklığını
    // (4,67−4,19 = 0,48 < 0,5) ve 8–10 Hz bandını kırıyor. Dokümanın s.19'daki
    // "isterleri sağlamaktadır" hükmü bu iki kriteri gözden kaçırıyor.
    const h = rep._mntRepSoftening(R, {});
    expect(h).toContain('tüm kriterleri sağlayan seviye yok');
    expect(h).toContain('Engelleyen kriterler');
    expect(h).toContain('Kriter 1a (mod ayrıklığı)');
    expect(h).toContain('yerleşimi');                          // yönlendirme veriyor
  });

  test('§8.15 uygun bir seviye VARSA onu önerir (en SERT olanı)', () => {
    // 700 d/dk · 6 sil → f_ateş 35 Hz → sınır 17,5 Hz.
    // %100'de mod 6 = 19,22 > 17,5 ✗ ; %80'de 17,19 < 17,5 ✓ ve 1a/1b/2 de temiz.
    // Beklenen: tarama %80'i önerir — daha da yumuşatmayı değil.
    const h = rep._mntRepSoftening(Object.assign({}, R, {
      gather: Object.assign({}, R.gather, { torque: { idleRpm: 700, cylinders: 6 } }) }), {});
    expect(h).toContain('Yumuşatma gerekiyor');
    expect(h).toContain('en sert');
    expect(h).toContain('<b>%80</b>');
  });

  test('§8.15 kriterler zaten sağlanıyorsa "gerekmiyor" der', () => {
    // Rölantiyi yükselt → f_ateş büyür → sınır büyür → tüm modlar altında kalır.
    const h = rep._mntRepSoftening(
      Object.assign({}, R, { gather: Object.assign({}, R.gather,
        { torque: { idleRpm: 1600, cylinders: 6 } }) }), {});
    expect(h).toContain('Yumuşatma gerekmiyor');
  });

  test('§8.15 statik çökme uyarısını mutlaka basar (yumuşatmanın bedeli)', () => {
    expect(rep._mntRepSoftening(R, {})).toContain('statik çökmeyi');
  });

  test('§8.16 her mod için deforme şekil çizilir (üstten + yandan)', () => {
    const h = rep._mntRepModeShapes(R);
    expect(h).toContain('8.16 Mod şekilleri');
    expect((h.match(/<figure/g) || []).length).toBe(MODES.length);
    expect((h.match(/<svg /g) || []).length).toBe(MODES.length * 2);
    expect(h).toContain('Üstten (X–Y)');
    expect(h).toContain('Yandan (X–Z)');
    expect(h).toContain('görseldir');                          // genlik uyarısı
    expect(h).toContain('uydurma ikon değildir');              // kutuların kaynağı açıklanıyor
    // Motor kutusu ölçekli çizilmeli: eşdeğer prizma 1154×460×787 mm
    const e = core.equivalentBox(1600, [[110.7, 0, 0], [0, 260.2, 0], [0, 0, 205.9]], false);
    expect(e[0] * 1000).toBeCloseTo(1154, 0);
    expect((h.match(/<rect /g) || []).length).toBeGreaterThan(MODES.length * 10);
  });

  test('§8.16 nokta kütle daire ile çizilir, kutu ile DEĞİL', () => {
    const nk = { name: 'Nokta', mass: 50, cgx: 500, cgy: 0, cgz: 400,
                 Ixx: 0, Iyy: 0, Izz: 0, pointMass: true };
    const R2 = Object.assign({}, R, { gather: Object.assign({}, R.gather,
      { components: [nk] }) });
    const h = rep._mntRepModeShapes(R2);
    expect(h).toContain('<circle');
    expect(core.equivalentBox(50, [[0, 0, 0], [0, 0, 0], [0, 0, 0]], true)).toBeNull();
  });

  test('§8.16 saf düşey modda yatay yer değiştirme YOK (kinematik doğru)', () => {
    // φ = [0,0,1,0,0,0] → tüm noktalar yalnız z'de öteler. Üstten görünüşte
    // (X–Y) hiçbir nokta kımıldamamalı; yandan görünüşte (X–Z) hepsi kaymalı.
    const dus = [{ f_Hz: 10, phi: [0, 0, 1, 0, 0, 0], label: 'bounce' }];
    const h = rep._mntRepModeShapes(Object.assign({}, R, { modes: dus }));
    const svgs = h.match(/<svg [\s\S]*?<\/svg>/g);
    expect(svgs).toHaveLength(2);
    // Yalnız YER DEĞİŞTİRME çizgileri sayılır (G imleci de <line> kullanır).
    expect(svgs[0].match(/<line class="disp"/g)).toBeNull();   // üstten: hareket yok
    expect((svgs[1].match(/<line class="disp"/g) || []).length).toBeGreaterThan(0);   // yandan: var
  });

  test('§8.16 veri yoksa boş döner', () => {
    expect(rep._mntRepModeShapes(Object.assign({}, R, { modes: [] }))).toBe('');
    expect(rep._mntRepSoftening(Object.assign({}, R, { modes: [] }), {})).toBe('');
  });
});
