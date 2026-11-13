/**
 * mount-aski.test.js — ASKI YAYI: ŞANZIMANIN KUYRUĞUNU ŞASİYE ASAN ÖN YÜKLÜ YAY (2026-11-11)
 * ─────────────────────────────────────────────────────────────────────────
 * Kullanıcının dosyaları: askılı föy + Cummins aracı (tests/fixtures/excel-tta-askili.js),
 * yay resmi ve malzeme belgesi (BMC; js/mount-yay.js), Adams sunumu
 * (tests/fixtures/adams-isg-askili.js). Kapılar:
 *
 *   · KATALOG — yay resmindeki üç kuvvet–boy noktası F = k(L0 − L)'nin
 *     üstünde; geometriden yay sabiti resminkinin toleransında; EN 13906-1 gerilmesi.
 *   · ELLE HESAP — tek gövde, dört takoz, ağırlık merkezinde bir askı: kapalı biçim.
 *   · AKTİF KÜME — yay açılır (F = 0, askısızın çözümü) ve blok boyuna iner.
 *   · STATİK MONTAJ — kuvvetle tanımlı yayın tasarım boyu: statik dengede o kuvvet.
 *   · KESİT — bağlantı yüzündeki moment askının kuvvetini katar; bilinen kuvvetle
 *     çözülen statik denge askılı çözümle aynı.
 *   · DİNAMİK — modal, frekans yanıtı ve şok askıyı z rijitliğiyle görür; takoz
 *     başına çıktılar takozların; yumuşatma taraması askıyı ölçeklemez.
 *   · ADAMS — ISG 430'un beş takoz seçeneğinde 30 çökme ve 30 frekans: ön yüksüz yayla
 *     RMS 0,022 mm · %0,17; askısız %1,9; sunumdaki 918,4 N ön yükle 0,525 mm · %3,3.
 *   · CUMMINS — aracın formülleri kendi hücrelerini verir; düzeltilmiş girdilerle
 *     Mr 495 N·m ↔ altı serbestlik 511,5 N·m.
 *   · TTA ASKILI — örnek programın yolundan: 2 × 50 kgf'ta M_b 511,5 N·m, sıfır için
 *     yay başına 88,9 kgf (L_s 74,8 mm), Cummins bandı 68,4–88,9 kgf; modlar askısızdan
 *     ≤ 0,12 Hz; rapor §8.20 ve uygunluğun askı satırı.
 */
const fs = require('fs');
const path = require('path');
const core = require('../../js/mount-core.js');
const YAY = require('../../js/mount-yay.js');
const AD = require('../fixtures/adams-isg-askili.js');
const XA = require('../fixtures/excel-tta-askili.js');
global.veMountCore = core;
global.veMntSignals = require('../../js/mount-signals.js');
global.veMntBrief = require('../../js/mount-brief.js');
global.veMntAkso = require('../../js/mount-akso.js');
Object.assign(global, YAY);
const stubs = stubGlobals({ saveState: jest.fn(), showToast: jest.fn(), showNodeProperties: jest.fn() });
eval(fs.readFileSync(path.join(__dirname, '../../js/components.js'), 'utf8'));
global.componentDefs = componentDefs;
const cp = require('../../js/cp-mount.js');
const rep = require('../../js/cp-mount-report.js');
['veMntUygunluk', 'veMntRaporOpts', '_mntRepCaseTr', '_mntRepIsolation', '_mntRepEngine', '_mntRepZeta']
  .forEach((k) => { global[k] = rep[k]; });
global.veSayi = require('../../js/sayi.js').veSayi;

const G = 9.81;
const mm = (v) => v.map((x) => x / 1000);
const oku = (f) => JSON.parse(fs.readFileSync(path.join(__dirname, '../../assets/examples/' + f), 'utf8'));
const TOPO = oku('tta10askili_topoloji.json');
const TOPO0 = oku('tta10_topoloji.json');
const coz1 = (ms, cg, m, lc) => core.solveCaseStop(core.buildK(ms, cg, false), ms, cg, m, G, lc, { useStop: true });

beforeEach(() => resetStubs(stubs));

describe('KATALOG — askı yayının resmi (BMC, yayın 3) ve EN 13906-1', () => {
  const e = YAY.veMntYay('tta-aski');
  test('resmin üç noktası F = k(L0 − L) doğrusunun üstünde (toleransıyla)', () => {
    expect(e).toBeTruthy();
    expect(e.noktalar.map((p) => p.ad)).toEqual(['ilk', 'montaj', 'st']);
    e.noktalar.forEach((p) => {
      const F = e.kgfmm * (e.L0 - p.L);
      expect([p.ad, Math.abs(F - p.F) <= (p.tol || 0.5)]).toEqual([p.ad, true]);
    });
    expect(e.noktalar[2].L).toBe(e.Lc);                     // "st" blok boyu
  });
  test('geometriden yay sabiti G·d⁴/(8D³n) resmin toleransında; ortalama çap (Do + Di)/2', () => {
    const D = YAY.veMntYayOrtaCap(e);
    expect(D).toBe(61);
    const k = YAY.veMntYaySabiti(e.d, D, e.n);
    expect(k).toBeCloseTo(56.727, 3);
    expect(Math.abs(k / G - e.kgfmm)).toBeLessThanOrEqual(e.kgfmmTol);
    expect(YAY.veMntYayNmm(e)).toBeCloseTo(57.3885, 4);
  });
  test('gerilme: düzeltmesiz τ = 8FD/(πd³), Bergsträsser k = (w + 0,5)/(w − 0,75); blok boyunda 330 MPa ≤ 0,56·Rm', () => {
    const D = YAY.veMntYayOrtaCap(e), w = D / e.d, F = 158 * G;
    expect(YAY.veMntYayDuzeltme(e.d, D)).toBeCloseTo((w + 0.5) / (w - 0.75), 12);
    expect(YAY.veMntYayGerilmeHam(F, e.d, D)).toBeCloseTo(8 * F * D / (Math.PI * 729), 9);
    expect(YAY.veMntYayGerilmeHam(F, e.d, D)).toBeCloseTo(330.27, 1);
    expect(YAY.veMntYayGerilme(F, e.d, D)).toBeCloseTo(398.76, 1);
    expect(YAY.VE_MNT_YAY_IZIN * e.Rm).toBeCloseTo(829.36, 2);
    expect(YAY.veMntYayFrekans(e.d, D, e.n)).toBeCloseTo(172.2, 1);
    expect(YAY.veMntYaySabiti(0, D, 5)).toBeNaN();
  });
});

// Tek gövde (kutu), dört özdeş takoz köşelerde, askı ağırlık merkezinin altında
const KUTU = { m: 1000, cg: [0, 0, 0] };
const kutuTakoz = (kz) => [[-0.5, -0.4], [0.5, -0.4], [-0.5, 0.4], [0.5, 0.4]].map(([x, y], i) =>
  ({ name: 'T' + (i + 1), pos: [x, y, 0], kstat: [1e5, 1e5, kz], kdyn: [1e5, 1e5, kz] }));
const askiKutu = (o) => Object.assign({ name: 'A', pos: [0, 0, 0], k: 50e3, L0: 0.090, Lc: 0.063, Ld: 0.080 }, o || {});
const kutuCoz = (ms, lc) => coz1(ms, KUTU.cg, KUTU.m, lc);

describe('ELLE HESAP — dört takoz + ağırlık merkezinde askı: (Σk + k_a)·δ = −mg + k_a(L0 − Ld)', () => {
  test('düşey öteleme, yayın boyu ve kuvveti kapalı biçimle; ΣFz takozlar + askı', () => {
    const kz = 1e6, h = askiKutu();
    const r = core.solveWithHangers(kutuCoz, kutuTakoz(kz), KUTU.cg, KUTU.m, G, { name: 'Static', n: [0, 0, -1], T: [0, 0, 0] }, [h]);
    const dz = (-KUTU.m * G + h.k * (h.L0 - h.Ld)) / (4 * kz + h.k);
    expect(r.q[2]).toBeCloseTo(dz, 12);
    expect(r.perMount).toHaveLength(4);
    expect(r.perHanger[0].L).toBeCloseTo(h.Ld + dz, 12);
    expect(r.perHanger[0].F).toBeCloseTo(h.k * (h.L0 - h.Ld - dz), 9);
    expect(r.perHanger[0].durum).toBe('normal');
    expect(r.checks.sumFzOk).toBe(true);
    expect(r.sumF[2] - r.checks.askiFz).toBeCloseTo(-KUTU.m * G, 6);
    expect(r.F[2]).toBeCloseTo(-KUTU.m * G, 9);                     // özgün dış yük
    expect(r.checks.askiYakinsadi).toBe(true);
  });
  test('askısız çağrı çözücünün kendisi (birebir)', () => {
    const lc = { name: 'Static', n: [0, 0, -1], T: [0, 0, 0] };
    expect(core.solveWithHangers(kutuCoz, kutuTakoz(1e6), KUTU.cg, KUTU.m, G, lc, [])).toEqual(kutuCoz(kutuTakoz(1e6), lc));
  });
  test('yasa: açık (L ≥ L0) sıfır, blokta k(L0 − Lc) + 1000·k(Lc − L)', () => {
    const h = askiKutu();
    expect(core.askiKuvvet(h, 0.010)).toBe(0);                              // L = 90
    expect(core.askiKuvvet(h, -0.010)).toBeCloseTo(h.k * 0.020, 9);         // L = 70
    expect(core.askiKuvvet(h, -0.018)).toBeCloseTo(h.k * 0.027 + 1000 * h.k * 0.001, 6);
    expect(['acik', 'normal', 'blok'].map((d) => core.askiEleman(h, d).k)).toEqual([0, h.k, 1000 * h.k]);
  });
});

describe('AKTİF KÜME — yay açılır ve blok boyuna iner', () => {
  test('yukarı yük (n_z = +1): yay açılır, kuvvet 0 ve çözüm askısızınki', () => {
    const lc = { name: 'yukarı', n: [0, 0, 1], T: [0, 0, 0] };
    const r = core.solveWithHangers(kutuCoz, kutuTakoz(2e5), KUTU.cg, KUTU.m, G, lc, [askiKutu()]);
    const r0 = kutuCoz(kutuTakoz(2e5), lc);
    expect(r.perHanger[0].durum).toBe('acik');
    expect(r.perHanger[0].F).toBe(0);
    r.q.forEach((v, i) => expect(v).toBeCloseTo(r0.q[i], 12));
  });
  // Takozun ±15 mm durdurucusu gövdeyi 15 mm'de tutar: Ld 75 mm → yay 63 mm'ye 12 mm'de iner
  test('yumuşak takozda 3 g: blok — boy blok boyunun hemen altında, kuvvet blok kuvvetinin üstünde', () => {
    const h = askiKutu({ Ld: 0.075 });
    const r = core.solveWithHangers(kutuCoz, kutuTakoz(2e5), KUTU.cg, KUTU.m, G, { name: '3g', n: [0, 0, -3], T: [0, 0, 0] }, [h]);
    const p = r.perHanger[0];
    expect(p.durum).toBe('blok');
    expect(p.L).toBeLessThan(h.Lc);
    expect(h.Lc - p.L).toBeLessThan(0.001);
    expect(p.F).toBeGreaterThan(h.k * (h.L0 - h.Lc));
    expect(r.checks.askiYakinsadi).toBe(true);
    expect(r.checks.sumFzOk).toBe(true);
  });
});

describe('STATİK MONTAJ — kuvvetle tanımlı yay statik dengede o kuvveti taşır', () => {
  test('askiTasarimBoylari → Ld; askılı statik çözüm Fs ve Ls verir', () => {
    const h = askiKutu({ Ld: undefined, Fs: 60 * G, Ls: 0.090 - 60 * G / 50e3 });
    const lcS = { name: 'Static', n: [0, 0, -1], T: [0, 0, 0] };
    const Ld = core.askiTasarimBoylari(kutuCoz, kutuTakoz(1e6), KUTU.cg, KUTU.m, G, lcS, [h]);
    h.Ld = Ld[0];
    const r = core.solveWithHangers(kutuCoz, kutuTakoz(1e6), KUTU.cg, KUTU.m, G, lcS, [h]);
    expect(r.perHanger[0].F).toBeCloseTo(h.Fs, 6);
    expect(r.perHanger[0].L).toBeCloseTo(h.Ls, 12);
  });
});

describe('DİNAMİK — askı z rijitliğiyle, takoz başına çıktılar takozların', () => {
  const ms = kutuTakoz(1e6), I = [[100, 0, 0], [0, 200, 0], [0, 0, 250]];
  const M6 = core.buildM6(KUTU.m, I);
  const hs = [askiKutu({ pos: [0.3, 0, 0] })];
  const dm = ms.concat(core.askiTakozlari(hs, ['normal']));
  test('askı takozu: yalnız z, durdurucusuz ve tam yasası şoka gider; açık durumda rijitliksiz', () => {
    expect(dm[4]).toMatchObject({ aski: true, kstat: [0, 0, 50e3], kdyn: [0, 0, 50e3], askiH: { k: 50e3, L0: 0.090, Lc: 0.063, Ld: 0.080 } });
    expect(core.askiTakozlari(hs, ['acik'])[0].kstat).toEqual([0, 0, 0]);
    const y = core.askiYasalari(hs[0]);
    expect(y[2].force(-0.010)).toBeCloseTo(-core.askiKuvvet(hs[0], -0.010), 12);
    expect([0.02, -0.005, -0.03].map((d) => y[2].tangent(d))).toEqual([0, 50e3, 50e6]);
  });
  test('zıplama modu askının rijitliğini görür: f = √((Σk + k_a)/m)/2π', () => {
    const dm0 = ms.concat(core.askiTakozlari([askiKutu()], ['normal']));          // ağırlık merkezinde: ayrışık
    const md = core.solveModal(core.buildK(dm0, KUTU.cg, true), M6, ms, KUTU.cg);
    const fz = Math.sqrt((4e6 + 50e3) / KUTU.m) / (2 * Math.PI);
    expect(md.some((m) => Math.abs(m.f_Hz - fz) < 1e-6)).toBe(true);
    expect(core.bounceFrequency(dm0, KUTU.m, null)).toBeCloseTo(fz, 9);
  });
  test('yumuşatma taraması askıyı ölçeklemez (çelik)', () => {
    const s = core.softeningScan(dm, KUTU.cg, M6, KUTU.m, [0.5], 40, 0.02, null);
    expect(s[0].fBounce).toBeCloseTo(Math.sqrt((0.5 * 4e6 + 50e3) / KUTU.m) / (2 * Math.PI), 9);
  });
  test('şok: en büyük takoz sehimi askıyı saymaz; frekans yanıtının takoz başına dizisi askıyı da taşır', () => {
    const damping = ms.map(() => ({ c: [500, 500, 500] }));
    // takozlar ağırlık merkezinin önünde (zıplama–yunuslama bağlı), askı 2 m geride: kendi sehimi
    // takozlarınkinden büyük — sayılsaydı en büyük takoz sehimi değişirdi
    const uzak = ms.map((m) => Object.assign({}, m, { pos: [m.pos[0] - 0.3, m.pos[1], m.pos[2]] }))
      .concat(core.askiTakozlari([askiKutu({ pos: [2.0, 0, 0] })], ['normal']));
    const sk = core.shockResponse(uzak, KUTU.cg, M6, damping, { dir: 2, aG: 3, dur: 0.02, useStop: true });
    expect(sk.per).toHaveLength(5);
    const enb = sk.t.map((_, i) => Math.max(...sk.per.slice(0, 4).map((p) => p.d[i])));
    sk.dMax.forEach((v, i) => expect(v).toBeCloseTo(enb[i], 9));
    expect(Math.max(...sk.per[4].d)).toBeGreaterThan(Math.max(...sk.dMax));
    const fr = core.frequencyResponse(dm, KUTU.cg, M6, damping, { dir: 2, perMount: true, nPts: 20 });
    expect(fr.Tm).toHaveLength(5);
  });
});

describe('ADAMS — ISG 430 askılı, beş takoz seçeneği (30 çökme + 30 frekans)', () => {
  const comps = Object.keys(AD.govde).map((ad) => {
    const g = AD.govde[ad];
    return { name: ad, mass: g.kutle, cg: mm(g.cg), pointMass: !g.I,
      I: g.I ? [[g.I[0] * 1e-6, 0, 0], [0, g.I[1] * 1e-6, 0], [0, 0, g.I[2] * 1e-6]] : [[0, 0, 0], [0, 0, 0], [0, 0, 0]] };
  });
  const mp = core.combineMassProps(comps);
  // Çıktının sol/sağı girdinin y'siyle ters (fikstürün başlığı); yay Adams'ta ön yüksüz, bloksuz
  function olc(onYuk, askisiz) {
    let ed = 0, ef = 0, n = 0;
    Object.keys(AD.sonuc).forEach((kb) => {
      const s = AD.sonuc[kb];
      const ms = AD.takoz.map(([ad, x, y, z], i) => {
        const t = AD.tip[i < 2 ? s.on : s.arka];
        return { name: ad, pos: mm([x, -y, z]), kstat: t.s.map((v) => v * 1000), kdyn: t.d.map((v) => v * 1000) };
      });
      const k = AD.yay.k * 1000;
      const hs = askisiz ? [] : AD.yay.ust.map((p, i) => ({ name: 'Yay ' + (i + 1), pos: mm([p[0], -p[1], p[2]]), k, L0: 0.070 + onYuk / k, Lc: 0, Ld: 0.070 }));
      const cz = (m2, lc) => coz1(m2, mp.cg, mp.m, lc);
      const st = core.solveWithHangers(cz, ms, mp.cg, mp.m, G, { name: 'Static', n: [0, 0, -1], T: [0, 0, 0] }, hs);
      const durum = st.perHanger ? st.perHanger.map((h) => h.durum) : [];
      const modlar = core.solveModal(core.buildK(ms.concat(core.askiTakozlari(hs, durum)), mp.cg, true), core.buildM6(mp.m, mp.I_G), ms, mp.cg);
      st.perMount.forEach((pm, i) => { ed += (pm.delta[2] * 1000 - s.d[i]) ** 2; });
      modlar.forEach((md, i) => { ef += ((md.f_Hz - s.f[i]) / s.f[i]) ** 2; n++; });
    });
    return { d: Math.sqrt(ed / 30), f: 100 * Math.sqrt(ef / n) };
  }
  test('toplam kütle sunumunki', () => { expect(mp.m).toBeCloseTo(AD.toplamKutle, 1); });
  test('ön yüksüz yay: RMS çökme < 0,03 mm, frekans < %0,2', () => {
    const r = olc(0, false);
    expect(r.d).toBeLessThan(0.03);
    expect(r.f).toBeLessThan(0.2);
  });
  // Ön yük statiği kaydırır, frekansı değiştirmez (doğrusal): kütleler sabitken ayırt eden çökme
  test('askısız frekans %1,9 (yay modlara giriyor); sunumdaki ön yük 918,4 N ile çökme 0,5 mm', () => {
    const a = olc(0, true), b = olc(AD.yay.onYuk, false);
    expect(a.f).toBeGreaterThan(1.5);
    expect(b.d).toBeGreaterThan(0.4);
    expect(b.f).toBeCloseTo(olc(0, false).f, 9);
  });
});

describe('CUMMINS — Engine Mounting Reaction and Moments Tool (askılı)', () => {
  const k = XA.cummins.kgfMmNm;
  const arac = (g) => {
    const R2 = (g.We * (g.L2 - g.L1) + g.Wt * (g.L2 + g.L3) - g.R3 * (g.L2 + g.L5)) / (g.L2 + g.L4 + g.L7);
    return { R2, R1: g.We + g.Wt - g.R3 - R2, Mr: (g.Wt * g.L3 - g.R3 * g.L5 - R2 * (g.L4 + g.L7)) * k,
      Mf: (g.We + g.Wt - g.R3 - R2) * g.L6 * k, Mfwy: -(R2 / 2) * g.L7 * k, Mfwx: -(R2 / 2) * g.L8 * k };
  };
  test('formüller aracın hücrelerini verir', () => {
    const c = arac(XA.cummins.girdi), S = XA.cummins.sonuc;
    expect(c.R2).toBeCloseTo(S.R2, 1);
    expect(c.R1).toBeCloseTo(S.R1, 1);
    expect(c.R2 / 2).toBeCloseTo(S.R2yari, 1);
    expect(Math.round(c.Mr)).toBe(S.Mr);
    expect(Math.round(c.Mf)).toBe(S.Mf);
    expect(Math.round(c.Mfwy)).toBe(S.Mfwy);
    expect(Math.round(c.Mfwx)).toBe(S.Mfwx);
  });
  test('Mr(R3) = Mr0 − c·R3 doğrusal, c = L2(L5 − D)/(L2 + D), D = L4 + L7', () => {
    const g = XA.cummins.girdi, D = g.L4 + g.L7, c = g.L2 * (g.L5 - D) / (g.L2 + D);
    const Mr0 = arac(Object.assign({}, g, { R3: 0 })).Mr;
    [0, 50, 100, 183].forEach((R3) => expect(arac(Object.assign({}, g, { R3 })).Mr).toBeCloseTo(Mr0 - c * R3 * k, 9));
  });
  test('düzeltilmiş girdilerle (L7 takoz çiftinin ortası, L3 grubun ağırlık merkezi, L5 yayın X\'i) Mr 495 ↔ altı serbestlik 511,5', () => {
    const g = Object.assign({}, XA.cummins.girdi, { L7: (532 + 642) / 2 - 428.5 - 84, L3: 596.3, L5: 1365 - 428.5 });
    expect(g.L7).toBeCloseTo(74.5, 9);
    expect(arac(g).Mr).toBeCloseTo(495.0, 0);
  });
});

function coz(t) {
  global.nodes = JSON.parse(JSON.stringify(t)).nodes.map((n) => Object.assign(n, { def: componentDefs[n.type] }));
  global.connections = [];
  cp._mntForgetResults();
  const R = cp._mntComputeResults(global.nodes.find((n) => n.type === 'mnt-solver').id);
  global._veMntLast = R;
  return R;
}

describe('TTA ASKILI — örnek, programın yolundan', () => {
  const R = coz(TOPO);
  const R0 = coz(Object.assign({}, TOPO, { nodes: TOPO.nodes.filter((n) => n.type !== 'mnt-aski') }));   // aynı takozlar, askısız
  const R00 = coz(TOPO0);                                                                                   // askısız örnek
  const st = (Rx) => Rx.allCases.find((c) => c.name === 'Static');
  // Takozların tipi ve ön yük takoz seçiminden (mount-aski-secim.test.js): ön çift TK040 (yasasıyla),
  // arka dört AMC 137963, yay başına 80 kgf (föyün 50 kg'ı bu takozlarla tork durumunda açılıyor)
  test('örnek föyün yerleşimi: arka takozlar ±335, iki yay Spring-1 · 2\'nin noktasında; seçilen tipler, 2 × 80 kgf statik', () => {
    const tak = TOPO.nodes.filter((n) => n.type === 'mnt-mount');
    const fy = XA.takoz.map((t) => [t[1], t[2], t[3]]);
    fy[3][0] = 532; fy[5][0] = 642;                                        // Adams'ın X'i → sol eşleri
    expect(tak.map((n) => [n.data.x, n.data.y, n.data.z])).toEqual(fy);
    const alti = (d) => [d.kxs, d.kys, d.kzs, d.kxd, d.kyd, d.kzd];
    tak.slice(0, 2).forEach((n) => { expect(alti(n.data)).toEqual([515, 260, 242, 740, 355, 335]); expect(n.data.fitZ.form).toBe('asym'); });
    tak.slice(2).forEach((n) => expect(alti(n.data).concat(n.data.maxLoad)).toEqual([1800, 1210, 1150, 2880, 1936, 1840, 650]));
    const as = TOPO.nodes.filter((n) => n.type === 'mnt-aski');
    expect(as.map((n) => [n.data.x, n.data.y, n.data.z])).toEqual(XA.yay.map((y) => [y[1], y[2], y[3]]));
    as.forEach((n) => expect(n.data).toMatchObject({ yay: 'tta-aski', kurulum: 'kuvvet', montajF: 80, L0: 90, Lc: 63 }));
    const M = core.getMountExample('tta10askili').model;
    // iki kopya (çekirdeğin örneği · topoloji dosyası) ad, yay ve kurulum dâhil aynı
    expect(M.askilar.map((a) => [a.name, a.pos, a.yay, a.k, a.L0, a.Lc, a.kurulum, a.montajF]))
      .toEqual(as.map((n) => [n.customName, [n.data.x, n.data.y, n.data.z], n.data.yay, n.data.k, n.data.L0, n.data.Lc, n.data.kurulum, n.data.montajF]));
    expect(M.mounts.map((m) => [m.name].concat(m.kstat, m.kdyn))).toEqual(tak.map((n) => [n.customName].concat(alti(n.data))));
  });
  test('statik: yaylar 80 kgf (76,33 mm), ΣFz dengede; M_b 119,9 N·m (askısız 1.173,1)', () => {
    const s = st(R).res;
    s.perHanger.forEach((p) => { expect(p.F / G).toBeCloseTo(80, 6); expect(p.L * 1000).toBeCloseTo(76.325, 2); expect(p.durum).toBe('normal'); });
    expect(s.checks.sumFzOk).toBe(true);
    const mb = (Rx) => Rx.baglanti.satirlar.find((r) => r.name === 'Static').egilme;
    expect(mb(R)).toBeCloseTo(119.93, 1);
    expect(mb(R0)).toBeCloseTo(1173.13, 1);
  });
  test('montaj önerisi: sıfır moment yay başına 89,1 kgf (L_s 74,8 mm); Cummins bandı 68,6–89,1 kgf', () => {
    const P = R.askiOneri;
    expect(P.m0).toBeCloseTo(1173.13, 1);
    expect(P.egim * G).toBeCloseTo(-6.585, 3);
    P.yaylar.forEach((y) => {
      expect(y.Fsifir / G).toBeCloseTo(89.08, 1);
      expect(y.Lsifir * 1000).toBeCloseTo(74.77, 1);
      expect(y.Fbant[0] / G).toBeCloseTo(68.58, 1);
      expect(y.Lbant[1] * 1000).toBeCloseTo(78.28, 1);
    });
  });
  // Ön takozlar nonlineer (TK040'ın yasası): askının ön yükü onların çalışma noktasını
  // değiştirir, modlar askısız çözümden 0,94 Hz'e kadar ayrışır
  test('modlar ve iletilebilirlik; dinamik listede iki askı', () => {
    expect(R.solvedNL).toBe(true);
    expect(R.modes.map((m) => +m.f_Hz.toFixed(2))).toEqual([7.28, 11.5, 12.74, 13.78, 14.99, 15.91]);
    expect(rep._mntRepIsolation(R, {}).T).toBeCloseTo(0.1378, 4);
    expect(Math.max(...R.modes.map((m, i) => Math.abs(m.f_Hz - R0.modes[i].f_Hz)))).toBeCloseTo(0.937, 2);
    expect(R.dinMounts).toHaveLength(8);
    expect(R.mounts).toHaveLength(6);
    expect(R0.dinMounts).toBeUndefined();
  });
  // Askısız modelde modal matris takozlarınkinin kendisi (askı yolu devreye girmez);
  // örneğin değerleri mount-ornek-tta.test.js'te kilitli.
  test('askısız örnekte modal çözüm takozların dinamik rijitliğinden, birebir', () => {
    const md = core.solveModal(core.buildK(R00.mounts, R00.mp.cg, true), core.buildM6(R00.mp.m, R00.mp.I_G), R00.mounts, R00.mp.cg);
    R00.modes.forEach((m, i) => expect(m.f_Hz).toBe(md[i].f_Hz));
    expect(R00.baglanti.satirlar.find((r) => r.name === 'Static').egilme).toBeCloseTo(1168.58, 1);
  });
  test('rapor §8.20: tanım, durum başına boy-kuvvet, gerilme, montaj; uygunluğun askı satırı uygun', () => {
    const h = rep._mntRepSection8(R, {});
    expect(h).toContain('<h3>8.20 Askı yayları</h3>');
    expect(h).toContain('Sol askı yayı L [mm]');
    expect(h).toMatch(/89,1<\/td><td>74,8/);
    expect(h).toContain('68,6–89,1');
    expect(rep._mntRepSection8(R0, {})).not.toContain('8.20');
    const U = rep.veMntUygunluk(R, {});
    const a = U.satirlar.find((s) => s.kisa === 'Askı yayı');
    expect(a).toMatchObject({ no: '6', st: 'ok' });
    expect(U.satirlar.map((x) => x.no + ':' + x.st)).toEqual(['1:ok', '1a:ok', '1b:ok', '2:ok', '3:ok', '4:ok', '5:ok', '6:ok']);
    expect(rep.veMntUygunluk(R0, {}).satirlar.some((s) => s.kisa === 'Askı yayı')).toBe(false);
  });
  test('askısız modelde askı alanları yok', () => {
    [R0, R00].forEach((Rx) => {
      expect(Rx.askilar).toBeUndefined();
      expect(Rx.askiOneri).toBeNull();
      expect(st(Rx).res.perHanger).toBeUndefined();
    });
  });
});

describe('PENCERE — kategoriler ve doğrulama', () => {
  test('üç kategori (Yay · Kurulum · Konum); katalogdan yay yazar; kuvvet ↔ statik boy karşılığı', () => {
    global.nodes = JSON.parse(JSON.stringify(TOPO)).nodes.map((n) => Object.assign(n, { def: componentDefs[n.type] }));
    const n = global.nodes.find((x) => x.type === 'mnt-aski');
    const h = cp.getMntAskiPropertiesHTML(n);
    ['Yay', 'Kurulum', 'Konum'].forEach((b) => expect(h).toContain('<b>' + b + '</b>'));
    expect(h).toMatch(/ve-mnt-askikarsi-n24"[^>]*/);
    expect(h).toContain('value="76,33"');
    n.data = { x: 1, y: 2, z: 3 };
    cp.veMntAskiYay(n.id, 'tta-aski');
    expect(n.data).toMatchObject({ yay: 'tta-aski', k: 57.39, L0: 90, Lc: 63, d: 9, D: 61, n: 5, Rm: 1481 });
    expect(stubs.saveState).toHaveBeenCalled();
  });
  test('doğrulama: eksik yay sabiti, blok boyunu aşan kuvvet modeli durdurur', () => {
    const t = JSON.parse(JSON.stringify(TOPO));
    t.nodes.find((x) => x.id === 'n24').data.montajF = 200;           // 200 kgf → L 55,8 < Lc
    t.nodes.find((x) => x.id === 'n25').data.k = '';
    const R = coz(t);
    expect(R.error.join(' ')).toContain('Sol askı yayı: montaj kuvveti yayı blok boyuna indiriyor.');
    expect(R.error.join(' ')).toContain('Sağ askı yayı: yay sabiti girilmedi.');
  });
});

describe('ÇİZİM — Görünümler, Güç grubundaki yeri ve raporun aksonometrisi', () => {
  const R = coz(TOPO);
  const askiG = (svg) => (svg.match(/<g class="ve-ak-aski"[^>]*>/g) || []);
  test('model iki askı taşır: nokta ve statik boy (çözümden; çözümsüz kurulumdan)', () => {
    const m = cp.veMntAksoCozumModel(R);
    expect(m.aski.map((a) => [a.k, a.x, a.y, +a.L.toFixed(2)])).toEqual([['A1', 1365, -350, 76.33], ['A2', 1365, 350, 76.33]]);
    expect(cp._mntAskiStatikBoy({ k: 57.39, L0: 90, montajF: 80 })).toBeCloseTo(76.325, 2);
    expect(cp._mntAskiStatikBoy({ kurulum: 'boy', montajL: 74 })).toBe(74);
    expect(cp._mntAskiStatikBoy({ kurulum: 'tasarim', tasarimL: 70 })).toBe(70);
  });
  test('çizim: her askı noktasından oturağına zikzak; yukarıdan bakışta yalnız noktası', () => {
    const m = cp.veMntAksoCozumModel(R);
    const svg = veMntAkso.ciz(m, { W: 600, stil: 'golge' }).svg;
    expect(askiG(svg)).toHaveLength(2);
    expect((svg.match(/class="a-yay"/g) || [])).toHaveLength(2);
    const ust = veMntAkso.ciz(m, { W: 600, kam: { az: 0, el: 90 }, kure: true }).svg;
    expect((ust.match(/class="a-yay"/g) || [])).toHaveLength(0);
    expect((ust.match(/class="a-uc"/g) || [])).toHaveLength(2);
  });
  test('askının penceresinde "Güç grubundaki yeri" askıyı seçili çizer', () => {
    global.nodes = JSON.parse(JSON.stringify(TOPO)).nodes.map((n) => Object.assign(n, { def: componentDefs[n.type] }));
    const n = global.nodes.find((x) => x.type === 'mnt-aski');
    const h = cp.getMntAskiPropertiesHTML(n);
    expect(h).toMatch(/<g class="ve-ak-aski" data-ak="A1" data-sec=""/);
    expect(h).toContain('Güç grubundaki yeri: ' + n.customName);
  });
  test('raporun aksonometrisi askıyı çizer; çizimin her sınıfının belgenin stilinde kuralı var', () => {
    global.veMntAksoCozumModel = cp.veMntAksoCozumModel;              // programda global
    const s8 = rep._mntRepSection8(R, {});
    const a = s8.indexOf('<figure class="rp-akso">'), fig = s8.slice(a, s8.indexOf('</figure>', a));
    expect(askiG(fig)).toHaveLength(2);
    ['ve-ak-aski', 'a-yay', 'a-otur', 'a-uc'].forEach((c) => expect(rep._MNT_REP_AKSO_CSS).toContain('.' + c));
  });
});
