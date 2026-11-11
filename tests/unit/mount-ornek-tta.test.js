/**
 * mount-ornek-tta.test.js — 10 TON TTA ÖRNEĞİ: KULLANICININ ÇALIŞMA KİTABINA KARŞI
 * ─────────────────────────────────────────────────────────────────────────
 * Örnek (assets/examples/tta10_topoloji.json · MOUNT_EXAMPLES.tta10) kullanıcının
 * iki kitabından kuruldu (ikisi de dondurulmuş): gövdeler ilk kitaptan
 * (tests/fixtures/excel-tta-askisiz.js, 22.10.2026), takozlar ve rölanti "6X6 YENİ
 * KABİN" föyünden (tests/fixtures/excel-tta-yeni-kabin.js, Canlı Not 68). İlk
 * kitabın üç takozlu kurulumu (ön destek + iki volan muhafazası takozu) da
 * dondurulmuş (tests/fixtures/tta10-uc-nokta-topoloji.json) — Front Support'un
 * statiği onunla karşılaştırılır:
 *
 *   · EXCEL — Front Support'un formülleri Excel'in hücrelerindeki sonucu verir;
 *     ağırlık kırılımının grup toplamları ve iletilebilirlik eğrisi de.
 *   · GÖVDELER — örneğin on bir gövdesi kırılımın iki grubunu birebir verir;
 *     motorun ataleti ISM11 veri sayfası + motora katılan parçaların nokta kütle
 *     payı, 4500 SP'ninki Allison 4000 §11.
 *   · YENİ KABİN — altı takoz föyün Mount 1–6'sı (4 · 6'nın X'i sol eşlerinin:
 *     föyde 1.105,67 mm geride yazılı, resimde aynı hizada), rijitlik ASFAT'ın
 *     takozları; föyün ağırlıkları, ağırlık merkezleri, ataletleri ve vitesleri
 *     örneğinkiyle aynı; rölanti föyün 800 d/dk'sı.
 *   · ÜÇ NOKTA — ilk kitabın takozları: X Front Support'tan (L2 · L4 + L7), Y/Z
 *     kulaklardan, rijitlik ASFAT'ın takozlarından (kullanıcı kararı 2026-11-06).
 *   · MFSİM ↔ EXCEL (üç nokta) — statik reaksiyon ve bloğun arka yüzündeki moment. Excel'in
 *     Mr'ı 992,7 N·m, programın 1.152,6: Excel L3'ü (563) 4500 SP gövdesinin
 *     ağırlık merkezinden alıyor, Wt'ye (530 kg) ise PTO, pompa ve kardan payını
 *     da katıyor — grubun ağırlık merkeziyle L3 596,3, Mr 1.143,0. Kalan 9,6 N·m
 *     arka kulakların (11 kg, düzlemin arkasında) ve g'nin (9,81 ↔ 9,806) payı.
 *   · TORK — belgelerden (tests/fixtures/belge-tta-tork.js — dondurulmuş):
 *     FR20317 (ISME385 30), iSCAAN 497-A392175-1 (TC541 · 4500 SP · rölanti) ve
 *     ISM11 veri sayfası D353029BX03 (bloğun arka yüzü sınırı 1.350 N·m). Tork
 *     zinciri programın yöntemi (Te azami × stall oranı × vites): iSCAAN'ın stall
 *     noktasının %20,6 üstünde; arka takozların çekmeye geçtiği tork (~4,5 kN·m)
 *     ikisinin de altında. Kriterler: 1 ve 1b uygun değil — yalpalama 21,07 Hz
 *     sınırın (800 d/dk'da 20 Hz) üstünde, 3. mod 8,73 Hz 8–10 Hz bandında.
 *   · ZARF — hareket zarfı (statik konuma göre) ve takoz sehim zarfı, rapor §8.19;
 *     uç değerler durumların q'sundan bağımsız kinematikle yeniden üretilir.
 *   · KAYIT — JSON ile kayıt defteri birebir; rapor §8.18 sınırlı, uygunluğun 5. satırı.
 */
const fs = require('fs');
const path = require('path');
const X = require('../fixtures/excel-tta-askisiz.js');
const Y = require('../fixtures/excel-tta-yeni-kabin.js');
const BELGE = require('../fixtures/belge-tta-tork.js');
const core = require('../../js/mount-core.js');
global.veMountCore = core;
global.veMntSignals = require('../../js/mount-signals.js');
global.veMntBrief = require('../../js/mount-brief.js');
const stubs = stubGlobals({ saveState: jest.fn(), showToast: jest.fn(), showNodeProperties: jest.fn() });
eval(fs.readFileSync(path.join(__dirname, '../../js/components.js'), 'utf8'));
global.componentDefs = componentDefs;
const cp = require('../../js/cp-mount.js');
const rep = require('../../js/cp-mount-report.js');
['veMntUygunluk', 'veMntRaporOpts', '_mntRepCaseTr', '_mntRepIsolation', '_mntRepEngine', '_mntRepZeta']
  .forEach((k) => { global[k] = rep[k]; });
global.veSayi = require('../../js/sayi.js').veSayi;
const VS = require('../../js/mount-veri-sayfasi.js');

const TOPO = JSON.parse(fs.readFileSync(path.join(__dirname, '../../assets/examples/tta10_topoloji.json'), 'utf8'));
// İlk kitabın üç takozlu kurulumu (Canlı Not 68'den önceki örnek), dondurulmuş
const TOPO3 = JSON.parse(fs.readFileSync(path.join(__dirname, '../fixtures/tta10-uc-nokta-topoloji.json'), 'utf8'));
const EX = core.getMountExample('tta10');
const M = EX.model;
const F = X.frontSupport, Gi = F.girdi;
const G = 9.81;

// Front Support'un formülleri (B18 · B21 · B24 · B27 · B30 · B33 · L22), Excel'den birebir
function cummins(g) {
  const R2 = (g.We * (g.L2 - g.L1) + g.Wt * (g.L2 + g.L3) - g.R3 * (g.L2 + g.L5)) / (g.L2 + g.L4 + g.L7);
  const R1 = g.We + g.Wt - g.R3 - R2, k = F.kgfMmNm;
  return { R2, R1, Mr: (g.Wt * g.L3 - g.R3 * g.L5 - R2 * (g.L4 + g.L7)) * k, Mf: R1 * g.L6 * k,
    Mfwy: -(R2 / 2) * g.L7 * k, Mfwx: -(R2 / 2) * g.L8 * k,
    L4sifir: g.Wt * g.L2 * g.L3 / (g.Wt * g.L2 + g.We * (g.L2 - g.L1)) };
}
const grup = (satir) => {
  const m = satir.reduce((t, r) => t + r[2], 0);
  return { m, cg: [3, 4, 5].map((i) => satir.reduce((t, r) => t + r[2] * r[i], 0) / m) };
};
const MOTOR_G = grup(X.agirlik.motor), SANZ_G = grup(X.agirlik.sanziman);
const RFOB = MOTOR_G.cg[0] + Gi.L1;                                  // 428,53 — L3'ten 428,5

function coz(degis, kaynak) {
  const t = JSON.parse(JSON.stringify(kaynak || TOPO));
  if (degis) degis(t);
  global.nodes = t.nodes.map((n) => Object.assign(n, { def: componentDefs[n.type] }));
  global.connections = [];
  cp._mntForgetResults();
  return cp._mntComputeResults(global.nodes.find((n) => n.type === 'mnt-solver').id);
}
const R = coz();
const R3 = coz(null, TOPO3);
const statik = (Rx) => Rx.allCases.find((c) => c.name === 'Static');
const dusey = (Rx) => statik(Rx).res.perMount.map((p) => -p.f[2] / G);   // kgf
const govdeler = () => TOPO.nodes.filter((n) => componentDefs[n.type].isMountBody);
const takozlar = () => TOPO.nodes.filter((n) => n.type === 'mnt-mount');
const takozlar3 = () => TOPO3.nodes.filter((n) => n.type === 'mnt-mount');

beforeEach(() => resetStubs(stubs));

describe('EXCEL — çalışma kitabının kendi hesabı', () => {
  test('Front Support: formüller Excel\'in R2 · R1 · Mr · Mf · Mfw · L4 (Mr = 0) hücrelerini verir', () => {
    const c = cummins(Gi);
    ['R2', 'R1', 'Mr', 'Mf', 'Mfwy', 'Mfwx', 'L4sifir'].forEach((k) => expect([k, c[k]]).toEqual([k, expect.closeTo(F.sonuc[k], 9)]));
    expect(c.R2 / 2).toBeCloseTo(F.sonuc.R2yari, 9);
    expect(F.sonuc.L4dene).toBeCloseTo(0.9 * c.L4sifir, 9);
  });
  test('ağırlık kırılımı: grup kütlesi ve ağırlık merkezi O25 · T25:V25 · O40 · T40:V40; toplam satırı kütlesiz ortalama', () => {
    const S = X.agirlik.sonuc;
    expect(MOTOR_G.m).toBeCloseTo(S.motor.m, 9);
    expect(SANZ_G.m).toBeCloseTo(S.sanziman.m, 9);
    MOTOR_G.cg.forEach((v, i) => expect(v).toBeCloseTo(S.motor.cg[i], 9));
    SANZ_G.cg.forEach((v, i) => expect(v).toBeCloseTo(S.sanziman.cg[i], 9));
    // T43:V43 = (T25 + T40)/2 — kütleyle ağırlıklı değil; doğrusu X 241,1, Excel'deki 461,1
    S.toplam.cg.forEach((v, i) => expect(v).toBeCloseTo((S.motor.cg[i] + S.sanziman.cg[i]) / 2, 9));
    const top = grup(X.agirlik.motor.concat(X.agirlik.sanziman));
    expect(top.m).toBeCloseTo(S.toplam.m, 9);
    expect(top.cg[0]).toBeCloseTo(241.055, 3);
    expect(S.toplam.cg[0] - top.cg[0]).toBeCloseTo(220.09, 2);
  });
  test('Front Support ↔ kırılım: We ve Wt grup kütleleri; L1 grubun, L3 yalnız 4500 SP gövdesinin ağırlık merkezinden', () => {
    expect(Math.abs(Gi.We - MOTOR_G.m)).toBeLessThan(1);
    expect(Gi.Wt).toBe(SANZ_G.m);
    const govde = X.agirlik.sanziman[0];
    expect(govde[3] - Gi.L3).toBeCloseTo(428.5, 9);                  // RFOB: 4500 SP gövdesi − L3
    expect(RFOB).toBeCloseTo(428.5, 1);                                // RFOB: motor grubu + L1
    expect(SANZ_G.cg[0] - 428.5).toBeCloseTo(596.255, 3);              // grubun L3'ü
  });
  test('iletilebilirlik: Excel\'in tek değeri ve eğrisi çekirdeğin transmissibility\'si', () => {
    const I = X.iletilebilirlik;
    expect(core.transmissibility(I.r, 1, I.zeta)).toBeCloseTo(I.TR, 12);
    I.egri.forEach(([r, tr]) => expect([r, core.transmissibility(r, 1, I.zeta)]).toEqual([r, expect.closeTo(tr, 12)]));
  });
});

describe('GÖVDELER — kırılımın satırları', () => {
  // kırılımın satırı → örneğin gövdesi (tipi olmayan motor parçaları motorda)
  const AYRI = { 'MOTOR ARKA KULAK - SAG': 'Sağ arka kulak', 'MOTOR ARKA KULAK - SOL': 'Sol arka kulak',
    'TM21 6PK KLIMA KOMP.': 'Klima kompresörü', '250A ALTERNATOR KOMPLE': 'Alternatör grubu',
    'ÖN KULAK-MOTOR': 'Ön kulak', 'DİREKSİYON POMPASI': 'Direksiyon pompası',
    'VİTES KUTUSU-4500SP': 'Şanzıman — Allison 4500 SP', PTO: 'PTO', POMPA: 'Pompa', 'KARDAN MILI': 'Kardan mili payı' };
  const bul = (ad) => govdeler().find((n) => n.customName === ad);
  test('ayrı gövdeler kırılımın satırıyla birebir; kalan yedi motor parçası motorda (63 kg)', () => {
    const satir = X.agirlik.motor.concat(X.agirlik.sanziman);
    satir.filter((r) => AYRI[r[1]]).forEach((r) => {
      const d = bul(AYRI[r[1]]).data;
      expect([r[1], d.mass, d.cgx, d.cgy, d.cgz]).toEqual([r[1], r[2], r[3], r[4], r[5]]);
    });
    const motorda = X.agirlik.motor.filter((r) => !AYRI[r[1]]);
    expect(motorda.map((r) => r[1])).toEqual(['MOTOR', 'YAĞ 34lt x 0.881 = 30kg', 'KRANK KASNAK', 'HAVA GIRIS BAG. KOMPLE',
      'BRAKET-YAKIT FILTRESI', 'TURBO CIKIS DIRSEGI', 'PERVANE MONTAJI KOMP.', 'INTERCOOLER CIKIS BORUSU', 'INTERCOOLER GIRIS BORUSU']);
    const g = grup(motorda), d = bul('Motor — Cummins ISM').data;
    expect(d.mass).toBeCloseTo(g.m, 9);
    expect(g.m - 1073).toBe(63);
    [d.cgx, d.cgy, d.cgz].forEach((v, i) => expect(Math.abs(v - g.cg[i])).toBeLessThan(5e-4));
    expect(govdeler()).toHaveLength(11);
  });
  test('iki grup: örneğin gövdeleri Excel\'in motor ve şanzıman grubunu verir (kütle, ağırlık merkezi ±0,001 mm)', () => {
    const SANZ = ['Şanzıman — Allison 4500 SP', 'PTO', 'Pompa', 'Kardan mili payı'];
    const satir = (n) => ['', n.customName, n.data.mass, n.data.cgx, n.data.cgy, n.data.cgz];
    const m = grup(govdeler().filter((n) => !SANZ.includes(n.customName)).map(satir));
    const s = grup(govdeler().filter((n) => SANZ.includes(n.customName)).map(satir));
    const S = X.agirlik.sonuc;
    expect(m.m).toBeCloseTo(S.motor.m, 9);
    expect(s.m).toBeCloseTo(S.sanziman.m, 9);
    m.cg.forEach((v, i) => expect(Math.abs(v - S.motor.cg[i])).toBeLessThan(1e-3));
    s.cg.forEach((v, i) => expect(Math.abs(v - S.sanziman.cg[i])).toBeLessThan(1e-9));
  });
  test('atalet: motor = ISM11 veri sayfası + motora katılan parçaların nokta kütle payı; 4500 SP = Allison 4000 §11 (6 vites · PTO · retardersiz)', () => {
    const ism = VS.VE_MNT_VERI_SAYFASI.find((v) => v.k === 'cummins-ism11');
    const motorda = X.agirlik.motor.filter((r) => ['MOTOR', 'YAĞ 34lt x 0.881 = 30kg', 'KRANK KASNAK', 'HAVA GIRIS BAG. KOMPLE',
      'BRAKET-YAKIT FILTRESI', 'TURBO CIKIS DIRSEGI', 'PERVANE MONTAJI KOMP.', 'INTERCOOLER CIKIS BORUSU', 'INTERCOOLER GIRIS BORUSU'].includes(r[1]));
    const g = grup(motorda);
    const I = { Ixx: ism.atalet.x, Iyy: ism.atalet.y, Izz: ism.atalet.z, Ixy: 0, Ixz: 0, Iyz: 0 };
    motorda.forEach((r) => {                                          // paralel eksen, tensör bileşeni (CATIA)
      const d = [0, 1, 2].map((i) => (r[3 + i] - g.cg[i]) / 1000);
      I.Ixx += r[2] * (d[1] * d[1] + d[2] * d[2]); I.Iyy += r[2] * (d[0] * d[0] + d[2] * d[2]); I.Izz += r[2] * (d[0] * d[0] + d[1] * d[1]);
      I.Ixy -= r[2] * d[0] * d[1]; I.Ixz -= r[2] * d[0] * d[2]; I.Iyz -= r[2] * d[1] * d[2];
    });
    const d = govdeler().find((n) => n.type === 'mnt-motor').data;
    Object.keys(I).forEach((k) => expect([k, d[k]]).toEqual([k, expect.closeTo(I[k], 2)]));
    const s = govdeler().find((n) => n.type === 'mnt-gearbox').data;
    expect([s.Ixx, s.Iyy, s.Izz]).toEqual(VS.VE_MNT_A4K.atalet['6']['01']);
    // Excel'in 4500 SP ağırlık merkezi Allison'un satırından: eksen ∩ ön yüz + (412,5; −0,6; −47,0)
    const cg = VS.VE_MNT_A4K.cg['6'].d['01'].y;
    expect(cg).toEqual([412.5, 47.0, 0.6]);
    expect(s.bagZ - s.cgz).toBeCloseTo(cg[1], 9);                    // krank ekseni 493,96
    expect(s.bagY - s.cgy).toBeCloseTo(cg[2], 9);
  });
});

// Kullanıcı 2026-11-09 (Canlı Not 68): "10 TON TTA örneği sanırım şanzıman tarafından
// yukarıya doğru askılı …" → föy: "6X6 YENİ KABİN - ISM TAKOZ KONUMLARI - ŞANZIMAN
// ASKISIZ" ("Gerçi bu da askısız"). Örnek föyün altı takozuyla ve rölantisiyle yeniden
// kuruldu; askılı varyantın verisi iki kitapta da yok.
describe('YENİ KABİN — altı takoz ve rölanti föyden', () => {
  test('konum: föyün Mount 1–6\'sı; 4 · 6\'nın X\'i sol eşlerinin (föyde 1.105,67 mm geride, resimde aynı hizada)', () => {
    const T = takozlar().map((n) => n.data);
    expect(T).toHaveLength(6);
    const X46 = { 3: Y.takoz[2][1], 5: Y.takoz[4][1] };            // Mount 4 → 3'ün X'i, 6 → 5'in
    expect(T.map((d) => [d.x, d.y, d.z])).toEqual(Y.takoz.map(([, x, y, z], i) => [i in X46 ? X46[i] : x, y, z]));
    // föyün yazımı: sağ çiftin ikisi de sol eşinden TAM 1.105,67 mm geride
    expect(+(Y.takoz[3][1] - Y.takoz[2][1]).toFixed(2)).toBe(1105.67);
    expect(+(Y.takoz[5][1] - Y.takoz[4][1]).toFixed(2)).toBe(1105.67);
    // önde yan yana iki, arkada her yanda çift; ad Y'nin işaretiyle (sağ +Y)
    expect(takozlar().map((n) => n.customName)).toEqual(['Ön sol takoz · 57RS313774', 'Ön sağ takoz · 57RS313774',
      'Sol ön takoz · 57RS313773', 'Sağ ön takoz · 57RS313773', 'Sol arka takoz · 57RS313773', 'Sağ arka takoz · 57RS313773']);
    T.forEach((d, i) => expect(/Sağ|sağ/.test(takozlar()[i].customName)).toBe(d.y > 0));
  });
  test('rijitlik: önde 57RS313774, arkada 57RS313773 — kütüphanenin ASR-SR-116 girdileri (föy rijitlik vermiyor)', () => {
    const L = cp.VE_MOUNT_LIBRARY;
    const uc = (e) => [e.sx, e.sy, e.sz, e.dx, e.dy, e.dz];
    const tk = (n) => [n.data.kxs, n.data.kys, n.data.kzs, n.data.kxd, n.data.kyd, n.data.kzd];
    takozlar().forEach((n, i) => expect([n.customName, tk(n)]).toEqual([n.customName, uc(L[i < 2 ? '57RS313774-sr116' : '57RS313773-sr116'])]));
    expect(+TOPO.nodes.find((n) => n.type === 'mnt-solver').data.zeta).toBe(0.02);
  });
  test('föyün ağırlıkları, ağırlık merkezleri, ataletleri ve vitesleri örneğinkiyle aynı; rölanti föyün 800 d/dk\'sı', () => {
    const SANZ = ['Şanzıman — Allison 4500 SP', 'PTO', 'Pompa', 'Kardan mili payı'];
    const satir = (n) => ['', n.customName, n.data.mass, n.data.cgx, n.data.cgy, n.data.cgz];
    const m = grup(govdeler().filter((n) => !SANZ.includes(n.customName)).map(satir));
    const s = grup(govdeler().filter((n) => SANZ.includes(n.customName)).map(satir));
    expect(Math.abs(m.m - Y.agirlik.motor)).toBeLessThan(1);             // 1.209,1 ↔ 1.210
    expect(s.m).toBe(Y.agirlik.sanziman);
    m.cg.forEach((v, i) => expect(Math.abs(v - Y.cg.motor[i])).toBeLessThan(0.01));
    s.cg.forEach((v, i) => expect(Math.abs(v - Y.cg.sanziman[i])).toBeLessThan(0.1));
    // motorun ataleti föyde ISM11 veri sayfasınınki; 4500 SP'ninki birebir
    const ism = VS.VE_MNT_VERI_SAYFASI.find((v) => v.k === 'cummins-ism11');
    expect([ism.atalet.x, ism.atalet.y, ism.atalet.z]).toEqual(Y.atalet.motor);
    const sz = govdeler().find((n) => n.type === 'mnt-gearbox').data, mo = govdeler().find((n) => n.type === 'mnt-motor').data;
    expect([sz.Ixx, sz.Iyy, sz.Izz]).toEqual(Y.atalet.sanziman);
    [sz.g1, sz.g2, sz.g3, sz.g4, sz.g5, sz.g6].forEach((g, i) => expect(Math.abs(g - Y.vites[i])).toBeLessThan(0.01));
    expect(Math.abs(sz.gR - Y.geri)).toBeLessThan(0.01);
    expect(Math.abs(sz.Rstall - Y.stall)).toBeLessThan(0.005);
    expect([mo.Te, mo.TeRpm, mo.Pmax, mo.PmaxRpm]).toEqual([Y.motor.TeMax, Y.motor.TeRpm, Y.motor.Pmax, Y.motor.PmaxRpm]);
    expect(mo.idleRpm).toBe(Y.motor.rolanti);
    expect(M.torque.idleRpm).toBe(Y.motor.rolanti);
  });
  test('statik: altı düşey reaksiyon toplam ağırlığı taşır; sol ve sağ çift birbirine ±%5', () => {
    expect(R.error).toBeUndefined();
    expect(R.solvedNL).toBe(false);
    const d = dusey(R);
    expect(d.map((v) => +v.toFixed(1))).toEqual([246.6, 245.4, 316.7, 305.8, 317.7, 306.8]);
    expect(d.reduce((a, b) => a + b, 0)).toBeCloseTo(1739.1, 6);
    [[0, 1], [2, 3], [4, 5]].forEach(([a, b]) => expect(Math.abs(d[a] - d[b]) / d[a]).toBeLessThan(0.05));
  });
});

describe('ÜÇ NOKTA — ilk kitabın takozları (dondurulmuş): X Front Support\'tan, Y/Z kulaklardan', () => {
  const kulak = (ad) => govdeler().find((n) => n.customName === ad).data;
  test('konum: ön RFOB − L2, arka RFOB + L4 + L7; ön kulağın Y/Z\'si, arka kulağın Y\'si + L8 dışa', () => {
    const [on, sag, sol] = takozlar3().map((n) => n.data);
    expect([on.x, sag.x, sol.x]).toEqual([428.5 - Gi.L2, 428.5 + Gi.L4 + Gi.L7, 428.5 + Gi.L4 + Gi.L7]);
    expect([on.y, on.z]).toEqual([kulak('Ön kulak').cgy, kulak('Ön kulak').cgz]);
    expect(sag.y).toBeCloseTo(kulak('Sağ arka kulak').cgy + Gi.L8, 9);
    expect(sol.y).toBeCloseTo(kulak('Sol arka kulak').cgy - Gi.L8, 9);
    expect([sag.z, sol.z]).toEqual([kulak('Sağ arka kulak').cgz, kulak('Sol arka kulak').cgz]);
  });
  test('rijitlik: ön 57RS313774, arka 57RS313773 — kütüphanenin ASR-SR-116 girdileri, altı değer', () => {
    const L = cp.VE_MOUNT_LIBRARY;
    const uc = (e) => [e.sx, e.sy, e.sz, e.dx, e.dy, e.dz];
    const tk = (n) => [n.data.kxs, n.data.kys, n.data.kzs, n.data.kxd, n.data.kyd, n.data.kzd];
    const [on, sag, sol] = takozlar3();
    expect(tk(on)).toEqual(uc(L['57RS313774-sr116']));
    expect(tk(sag)).toEqual(uc(L['57RS313773-sr116']));
    expect(tk(sol)).toEqual(uc(L['57RS313773-sr116']));
    expect(+TOPO3.nodes.find((n) => n.type === 'mnt-solver').data.zeta).toBe(0.02);
  });
  test('gövdeler örneğinkiyle aynı; tek fark takozlar ve rölanti (700, iSCAAN)', () => {
    const g = (T) => T.nodes.filter((n) => componentDefs[n.type].isMountBody).map((n) => [n.type, n.customName, n.data]);
    const a = g(TOPO3), b = g(TOPO);
    expect(a.map((x) => x[1])).toEqual(b.map((x) => x[1]));
    a.forEach((x, i) => expect([x[1], Object.assign({}, x[2], { idleRpm: undefined })]).toEqual([b[i][1], Object.assign({}, b[i][2], { idleRpm: undefined })]));
    expect(TOPO3.nodes.find((n) => n.type === 'mnt-motor').data.idleRpm).toBe(BELGE.iscaan.rolanti);
  });
});

describe('MFSİM ↔ EXCEL — statik (1 g), ilk kitabın üç takozuyla', () => {
  test('çözüm lineer ve hatasız; düşey reaksiyonlar ön 493,0 · sağ arka 595,7 · sol arka 650,4 kgf', () => {
    expect(R3.error).toBeUndefined();
    expect(R3.solvedNL).toBe(false);
    const [on, sag, sol] = dusey(R3);
    expect([+on.toFixed(1), +sag.toFixed(1), +sol.toFixed(1)]).toEqual([493.0, 595.7, 650.4]);
    expect(on + sag + sol).toBeCloseTo(1739.1, 6);
  });
  test('reaksiyon Excel\'in formülüyle, L3 grubun ağırlık merkezinden: ±0,5 kgf; Excel\'in L3\'üyle 14,8 kgf fark', () => {
    const [on, sag, sol] = dusey(R3);
    const t = cummins(Object.assign({}, Gi, { We: MOTOR_G.m, L3: SANZ_G.cg[0] - 428.5 }));
    expect(Math.abs(on - t.R1)).toBeLessThan(0.5);
    expect(Math.abs(sag + sol - t.R2)).toBeLessThan(0.5);
    expect(F.sonuc.R1 - on).toBeCloseTo(14.8, 1);
    expect(sag + sol - F.sonuc.R2).toBeCloseTo(13.9, 1);
  });
  test('rijitlikten bağımsız: A26 ve TK050 takozlarıyla düşey reaksiyonlar ±%0,5', () => {
    const baz = dusey(R3);
    [['57RS313774', '57RS313773'], ['TK050', 'TK050']].forEach(([a, b]) => {
      const Rx = coz((t) => t.nodes.filter((n) => n.type === 'mnt-mount').forEach((n, i) => {
        const e = cp.VE_MOUNT_LIBRARY[i === 0 ? a : b];
        Object.assign(n.data, { kxs: e.sx, kys: e.sy, kzs: e.sz, kxd: e.dx, kyd: e.dy, kzd: e.dz });
      }), TOPO3);
      dusey(Rx).forEach((v, i) => expect(Math.abs(v - baz[i]) / baz[i]).toBeLessThan(0.005));
    });
  });
  test('bloğun arka yüzünde moment: 1.152,6 N·m; Excel 992,7 — farkın 150,3\'ü L3, kalan 9,6\'sı arka kulaklar ve g', () => {
    const st = R3.baglanti.satirlar.find((r) => r.name === 'Static');
    expect(R3.baglanti).toMatchObject({ S: [428.5, -0.58, 493.96], a: [1, 0, 0], sinir: BELGE.ism11.rfobMb });
    expect([st.m, st.takoz]).toEqual([541, 2]);                       // şanzıman grubu + iki arka kulak · iki arka takoz
    expect(+st.egilme.toFixed(1)).toBe(1152.6);
    // düzlemin arkası serbest cisim (düşey kuvvetlerle): takozların yatay kuvvetinin payı < 1 N·m
    const [, sag, sol] = dusey(R3);
    const arka = govdeler().filter((n) => n.data.cgx > 428.5);
    const elle = (arka.reduce((t, n) => t + n.data.mass * (n.data.cgx - 428.5), 0) - (sag + sol) * (Gi.L4 + Gi.L7)) * G / 1000;
    expect(Math.abs(st.egilme - elle)).toBeLessThan(1);
    // Excel'in formülü, L3 grubun ağırlık merkezinden: +150,3 N·m
    const t = cummins(Object.assign({}, Gi, { L3: SANZ_G.cg[0] - 428.5 }));
    expect(t.Mr).toBeCloseTo(1142.96, 2);
    expect(t.Mr - F.sonuc.Mr).toBeCloseTo(150.27, 2);
    // kalan: arka kulaklar düzlemin 83,9 mm arkasında (Excel onları We'nin içinde, önde sayıyor) ve g (9,81 ↔ 9,806)
    const kulak = 11 * G * (512.44 - 428.5) / 1000;
    expect(kulak).toBeCloseTo(9.06, 2);
    expect(Math.abs(st.egilme - (t.Mr * G / F.kgfMmNm / 1000 + kulak))).toBeLessThan(1);
    expect((st.egilme - F.sonuc.Mr) / F.sonuc.Mr).toBeCloseTo(0.161, 3);
  });
  test('Mr = 0 için arka takozun RFOB\'a uzaklığı: grubun ağırlık merkeziyle 277,9 mm (Excel 262,4; bugün 160)', () => {
    const t = cummins(Object.assign({}, Gi, { L3: SANZ_G.cg[0] - 428.5 }));
    expect(t.L4sifir).toBeCloseTo(277.87, 2);
    expect(F.sonuc.L4sifir).toBeCloseTo(262.37, 2);
    expect(Gi.L4 + Gi.L7).toBe(160);
  });
});

describe('KAYIT — JSON ile kayıt defteri birebir', () => {
  test('gövde ve takozlar sırasıyla; tip, kütle, ağırlık merkezi, atalet, bağlantı yüzü', () => {
    expect(TOPO.format).toBe('mfsim-mount-example');
    expect(EX).toMatchObject({ id: 'tta10', vehicle: '10 Ton TTA', topology: 'assets/examples/tta10_topoloji.json' });
    expect(EX.kurgu).toBeUndefined();
    const B = govdeler(), T = takozlar();
    expect(B.map((n) => [n.type, n.customName])).toEqual(M.components.map((c) => [c.kind, c.name]));
    B.forEach((n, i) => {
      const c = M.components[i], d = n.data;
      expect([d.mass, d.cgx, d.cgy, d.cgz, d.Ixx, d.Iyy, d.Izz, d.Ixy, d.Ixz, d.Iyz, !!d.pointMass])
        .toEqual([c.mass].concat(c.cg, [c.Ixx, c.Iyy, c.Izz, c.Ixy, c.Ixz, c.Iyz, !!c.pointMass]));
      expect([d.bagX, d.bagY, d.bagZ]).toEqual(c.bag || [undefined, undefined, undefined]);
      expect(d.egSinir).toBe(c.egSinir);
      Object.keys(c.veri || {}).forEach((k) => expect([c.name, k, d[k]]).toEqual([c.name, k, c.veri[k]]));
    });
    // tork alanları yalnız motor ve şanzımanda
    const alan = ['Te', 'TeRpm', 'Pmax', 'idleRpm', 'cylinders', 'g1', 'gR', 'Rstall', 'iTransfer'];
    B.filter((n) => !['mnt-motor', 'mnt-gearbox'].includes(n.type))
      .forEach((n) => alan.forEach((k) => expect([n.customName, k, n.data[k]]).toEqual([n.customName, k, undefined])));
    expect(T.map((n) => n.customName)).toEqual(M.mounts.map((m) => m.name));
    T.forEach((n, i) => {
      const m = M.mounts[i], d = n.data;
      expect([d.x, d.y, d.z, d.kxs, d.kys, d.kzs, d.kxd, d.kyd, d.kzd]).toEqual(m.pos.concat(m.kstat, m.kdyn));
    });
    expect(+TOPO.nodes.find((n) => n.type === 'mnt-solver').data.zeta).toBe(M.cozucu.zeta);
    expect(TOPO.nodes.filter((n) => n.type === 'mnt-wizard')).toHaveLength(1);       // sihirbazı açan bileşen (Canlı Not 110)
    expect(TOPO.nodes.some((n) => n.type === 'mnt-example')).toBe(false);
  });
  test('programatik kurucu (JSON\'suz yol) bağlantı yüzünü de kurar', () => {
    jest.useFakeTimers();
    try {
      let k = 0;
      global.createNode = jest.fn((type, x, y) => { global.nodes.push({ id: 'p' + (++k), type, def: componentDefs[type], x, y, width: 80, height: 60, data: {} }); });
      global.confirm = () => true;
      global.nodes = [];
      global.connections = [];
      cp._mntLoadExampleFromModel('tta10');
      const s = global.nodes.find((n) => n.type === 'mnt-gearbox').data;
      expect([s.bagX, s.bagY, s.bagZ]).toEqual([428.5, -0.58, 493.96]);
      expect([s.egSinir, s.g1, s.gR, s.Rstall]).toEqual([1350, 4.695, -5.552, 1.897]);
      const mo = global.nodes.find((n) => n.type === 'mnt-motor').data;
      expect([mo.Te, mo.idleRpm, mo.cylinders]).toEqual([1835, 800, 6]);
      expect(global.nodes.filter((n) => componentDefs[n.type].isMountBody)).toHaveLength(11);
    } finally {
      jest.clearAllTimers();
      jest.useRealTimers();
      delete global.createNode;
    }
  });
  test('rapor §8.18: bloğun arka yüzünde Statik 1.169 N·m (dört arka takoz düzlemin arkasında), sınır 1.350 (ISM11 veri sayfası) — %86,6 uygun; uygunluğun 5. satırı', () => {
    global._veMntLast = coz();
    const el = document.createElement('div');
    el.innerHTML = rep._mntRepSection8(global._veMntLast);
    const tablo = Array.from(el.querySelectorAll('table')).find((t) => /kesit momenti/.test((t.querySelector('caption') || {}).textContent || ''));
    expect(tablo.querySelector('caption').textContent).toContain('sınır 1.350 N·m (veri sayfası, statik)');
    const st = Array.from(tablo.querySelectorAll('tr')).find((tr) => tr.cells[0].textContent === 'Statik (yerçekimi)');
    expect(Array.from(st.cells).map((c) => c.textContent)).toEqual(['Statik (yerçekimi)', '541', '4', '1.169', '28', '%86,6', '✓ Uygun']);
    const U = rep.veMntUygunluk(global._veMntLast);
    expect(U.satirlar.map((s) => s.no)).toEqual(['1', '1a', '1b', '2', '3', '4', '5']);
    expect(U.satirlar[6]).toMatchObject({ kisa: 'Bağlantı yüzü', st: 'ok', hedef: '≤ 1.350 N·m (veri sayfası)' });
  });
});

describe('TORK — FR20317 · iSCAAN 497-A392175-1 · ISM11 veri sayfası', () => {
  const motor = () => govdeler().find((n) => n.type === 'mnt-motor').data;
  const sanz = () => govdeler().find((n) => n.type === 'mnt-gearbox').data;
  const durum = (Rx, ad) => Rx.allCases.concat(Rx.gearCases, Rx.designCases).find((c) => c.name === ad);
  const dz = (rc, i) => rc.res.perMount[i].delta[2] * 1000;
  test('motor FR20317 (1.835 N·m @ 1.200 · 283 kW @ 1.900 · 6 silindir), rölanti föyün 800\'ü (iSCAAN 700, FR20317 600–800); şanzıman iSCAAN (TC541 1,897 · 4500 SP)', () => {
    const F = BELGE.fr20317, I = BELGE.iscaan, m = motor(), s = sanz();
    expect([m.Te, m.TeRpm, m.Pmax, m.PmaxRpm, m.cylinders]).toEqual([F.TeMax, F.TeRpm, F.Pmax, F.PmaxRpm, F.silindir]);
    expect(I.tepe).toEqual({ Te: F.TeMax, rpm: F.TeRpm });
    expect(m.cylinders).toBe(BELGE.ism11.silindir);
    expect(m.idleRpm).toBe(Y.motor.rolanti);
    expect(I.rolanti).toBe(700);
    expect(m.idleRpm).toBeGreaterThanOrEqual(F.rolantiMin);
    expect(m.idleRpm).toBeLessThanOrEqual(F.rolantiMax);
    expect([s.g1, s.g2, s.g3, s.g4, s.g5, s.g6]).toEqual(I.vites.slice(0, 6).map((v) => v[1]));
    expect(s.gR).toBe(-I.vites[6][1]);
    expect(s.Rstall).toBe(I.stall.TR);
    expect(s.egSinir).toBe(BELGE.ism11.rfobMb);
    // transfer kutusu güç grubunda değil: reaksiyon şanzıman çıkışının torku
    expect(TOPO.nodes.filter((n) => n.type === 'mnt-transfer')).toHaveLength(0);
    expect(s.iTransfer).toBeUndefined();
    expect(M.torque).toEqual({ Te: 1835, Rstall: 1.897, iTransfer: 1, fwd: { iGear: 4.695, phiAxle: 1 },
      rev: { iGear: -5.552, phiAxle: 1 }, derate: 1, idleRpm: 800, cylinders: 6 });
  });
  test('zincir: 1. vites 1.835 × 1,897 × 4,695 = 16.343,3 N·m, geri 19.326,5; Çözücü\'nün varsayılan yönüyle Tx = −T; kayıt defteri JSON\'la aynı', () => {
    const ileri = 1835 * 1.897 * 4.695, geri = 1835 * 1.897 * -5.552;
    expect(ileri).toBeCloseTo(16343.27, 2);
    expect(geri).toBeCloseTo(-19326.48, 2);
    const T = (Rx, ad) => durum(Rx, ad).loadCase.T;
    expect(T(R, 'Forward Torque')[0]).toBeCloseTo(-ileri, 9);
    expect(T(R, 'Reverse Torque')[0]).toBeCloseTo(-geri, 9);
    ['Forward Torque', 'Reverse Torque'].forEach((ad) => expect(M.loadCases.find((c) => c.name === ad).T)
      .toEqual(T(R, ad).map((v) => expect.closeTo(v, 9))));
    expect(R.gearCases.map((c) => [c.name, +c.loadCase.Tshaft.toFixed(1)])).toEqual([
      ['1. Vites', 16343.3], ['2. Vites', 7703.4], ['3. Vites', 5322.4], ['4. Vites', 3481], ['5. Vites', 2663],
      ['6. Vites', 2339.2], ['Geri Vites', -19326.5]]);
  });
  test('iSCAAN\'ın stall noktası: şanzıman çıkışı = türbin × oran × verim (0,96–1); programın zinciri F1\'de %20,6, R1\'de %23,6 üstte', () => {
    const I = BELGE.iscaan;
    I.vites.forEach(([ad, i, Tc]) => {
      const verim = Tc / (I.stall.Tturbin * i);
      expect([ad, verim > 0.96 && verim <= 1]).toEqual([ad, true]);
    });
    expect(I.stall.Te).toBeLessThan(BELGE.fr20317.TeMax);            // stall 1.560 d/dk'da net tork, azami değil
    const zincir = (i) => 1835 * 1.897 * i;
    expect(zincir(4.695) / I.vites[0][2]).toBeCloseTo(1.206, 3);
    expect(zincir(5.552) / I.vites[6][2]).toBeCloseTo(1.236, 3);
  });
  // Takoz sırası föyün: 0 ön sol · 1 ön sağ · 2 sol ön · 3 sağ ön · 4 sol arka · 5 sağ arka
  test('çekme: 1.–3. viteste soldaki iki arka, geride sağdaki iki arka takoz; 4.–6. viteste hepsi basıda; boşalma torku ileri ~4,6 · geri ~4,45 kN·m — iSCAAN\'ın stall torkunun da altında', () => {
    const cekme = (ad) => durum(R, ad).res.perMount.map((p) => p.tension);
    const sol = [false, false, true, false, true, false], yok = [false, false, false, false, false, false];
    expect(['1. Vites', '2. Vites', '3. Vites'].map(cekme)).toEqual([sol, sol, sol]);
    expect(['4. Vites', '5. Vites', '6. Vites'].map(cekme)).toEqual([yok, yok, yok]);
    expect(cekme('Geri Vites')).toEqual([false, false, false, true, false, true]);
    // lineer: δz(T) = δz(Statik) + T · eğim → δz = 0'daki tork
    const st = durum(R, 'Static'), g1 = durum(R, '1. Vites'), gR = durum(R, 'Geri Vites');
    const bos = (rc, i) => -dz(st, i) / ((dz(rc, i) - dz(st, i)) / Math.abs(rc.loadCase.Tshaft));
    expect(bos(g1, 2)).toBeCloseTo(4604, -1);
    expect(bos(g1, 4)).toBeCloseTo(4621, -1);
    expect(bos(gR, 3)).toBeCloseTo(4448, -1);
    expect(bos(gR, 5)).toBeCloseTo(4460, -1);
    [2, 4].forEach((i) => expect(bos(g1, i)).toBeLessThan(BELGE.iscaan.vites[0][2]));
    [3, 5].forEach((i) => expect(bos(gR, i)).toBeLessThan(BELGE.iscaan.vites[6][2]));
    // 1. viteste soldaki arka takozlar +3,60 · +3,59 mm (çekme), sağdakiler −6,37 · −6,38; geride tersi
    expect([2, 3, 4, 5].map((i) => +dz(g1, i).toFixed(2))).toEqual([3.6, -6.37, 3.59, -6.38]);
    expect([2, 3, 4, 5].map((i) => +dz(gR, i).toFixed(2))).toEqual([-7.34, 4.56, -7.34, 4.56]);
  });
  // Kriter 2'nin sınırı %15 (kullanıcı 2026-11-11): TR %16,6 — %50 sınırında uygundu.
  test('kriterler (rölanti 800 → f_ateş 40 Hz, sınır 20 Hz): 1 değil — yalpalama 21,07 Hz; 1b değil — 3. mod 8,73 Hz bantta; 2 değil — TR %16,6 ≥ %15; 1a · 3 · 4 · 5 uygun', () => {
    expect(R.modes.map((m) => [+m.f_Hz.toFixed(2), m.label])).toEqual([[7.18, 'lateral+yaw'], [7.95, 'fore-aft'],
      [8.73, 'yaw+lateral'], [12.22, 'pitch'], [15.27, 'bounce'], [21.07, 'roll']]);
    const U = rep.veMntUygunluk(R);
    expect(U.satirlar.map((s) => [s.no, s.st])).toEqual([['1', 'no'], ['1a', 'ok'], ['1b', 'no'], ['2', 'no'], ['3', 'ok'], ['4', 'ok'], ['5', 'ok']]);
    const duz = (no) => U.satirlar.find((s) => s.no === no).bulgu.replace(/<[^>]+>/g, '');
    expect(duz('1')).toContain('mod 6 21,07 Hz');
    expect(duz('1')).toContain('= 20 Hz');
    expect(duz('1b')).toContain('mod 3 8,73 Hz');
    expect(duz('2')).toMatch(/fateş 40 Hz .* T=%16,6/);
    expect(duz('3')).toContain('16,16 kN (Geri · Sol arka takoz · 57RS313773)');
    // ilk kitabın üç takozuyla (rölanti 700) yalpalama 15,47 Hz, sınır 17,5 Hz — uygundu
    expect(+R3.modes[5].f_Hz.toFixed(2)).toBe(15.47);
    expect(rep.veMntUygunluk(R3).satirlar.find((x) => x.no === '1').st).toBe('ok');
  });
});

describe('ZARF — hareket zarfı ve takoz sehim zarfı (rapor §8.19)', () => {
  const mm = (v) => +(v * 1000).toFixed(2);
  const durumlar = () => R.allCases.concat(R.gearCases, R.designCases).filter((c) => c.res);
  test('güç grubunun bütün noktaları, statik konuma göre: X −14,78 / +4,95 · Y ±15,33 · Z −5,64 / +5,19 mm; belirleyen nokta ve durum', () => {
    const Z = R.zarf.toplam;
    expect(Z.min.map(mm)).toEqual([-14.78, -15.33, -5.64]);
    expect(Z.max.map(mm)).toEqual([4.95, 15.33, 5.19]);
    expect(Z.minAt).toEqual([
      { durum: 'Pothole Braking', nokta: [-1, -1, 1], govde: 'Motor — Cummins ISM' },
      { durum: 'Kerb Strike L', nokta: 'ag', govde: 'Kardan mili payı' },
      { durum: 'Pothole Braking', nokta: [-1, -1, -1], govde: 'Motor — Cummins ISM' }]);
    expect(Z.maxAt).toEqual([
      { durum: 'Acceleration', nokta: [-1, -1, 1], govde: 'Motor — Cummins ISM' },
      { durum: 'Kerb Strike R', nokta: 'ag', govde: 'Kardan mili payı' },
      { durum: 'Reverse Torque', nokta: 'ag', govde: 'Sağ arka kulak' }]);
    const mo = R.zarf.govde.find((g) => g.name === 'Motor — Cummins ISM');
    expect([mo.min.map(mm), mo.max.map(mm)]).toEqual([[-14.78, -12.88, -5.64], [4.95, 11.18, 3.79]]);
  });
  test('hakem: her gövdenin zarfı durumların q\'sundan bağımsız kinematikle (Δu + Δθ × r, kutu ataletten) aynı', () => {
    const G0 = R.mp.cg, q0 = R.qStatic;
    govdeler().forEach((n) => {
      const d = n.data, c = [d.cgx, d.cgy, d.cgz].map((v) => v / 1000);
      const p = [c];
      if (!d.pointMass) {
        const a = [6 * (d.Iyy + d.Izz - d.Ixx), 6 * (d.Ixx + d.Izz - d.Iyy), 6 * (d.Ixx + d.Iyy - d.Izz)].map((v) => Math.sqrt(v / d.mass) / 2);
        [-1, 1].forEach((i) => [-1, 1].forEach((j) => [-1, 1].forEach((k) => p.push([c[0] + i * a[0], c[1] + j * a[1], c[2] + k * a[2]]))));
      }
      const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
      durumlar().forEach((rc) => {
        const u = [0, 1, 2].map((i) => rc.res.q[i] - q0[i]), t = [3, 4, 5].map((i) => rc.res.q[i] - q0[i]);
        p.forEach((P) => {
          const r = [P[0] - G0[0], P[1] - G0[1], P[2] - G0[2]];
          const dd = [u[0] + t[1] * r[2] - t[2] * r[1], u[1] + t[2] * r[0] - t[0] * r[2], u[2] + t[0] * r[1] - t[1] * r[0]];
          dd.forEach((v, i) => { lo[i] = Math.min(lo[i], v); hi[i] = Math.max(hi[i], v); });
        });
      });
      const z = R.zarf.govde.find((g) => g.name === n.customName);
      [0, 1, 2].forEach((i) => {
        expect([n.customName, i, z.min[i]]).toEqual([n.customName, i, expect.closeTo(lo[i], 12)]);
        expect([n.customName, i, z.max[i]]).toEqual([n.customName, i, expect.closeTo(hi[i], 12)]);
      });
    });
    expect(R.zarf.govde).toHaveLength(11);
  });
  test('rapor §8.19: dört tablo; aynı yükün iki adı tek satırda; takoz sehim zarfı yüksüz konumdan ve çekme işaretli', () => {
    const el = document.createElement('div');
    el.innerHTML = rep._mntRepZarf(R);
    expect(el.querySelector('h3').textContent).toBe('8.19 Hareket zarfı');
    const tablolar = Array.from(el.querySelectorAll('table'));
    expect(tablolar.map((t) => t.querySelector('caption').textContent.replace(/^Tablo \d+ — /, ''))).toEqual([
      'Gövde başına hareket zarfı, statik konuma göre [mm]', 'Güç grubunun zarfını belirleyen nokta ve durum',
      'Birleşik ağırlık merkezinin ötelemesi ve dönmesi, statik konuma göre', 'Takoz sehim zarfı, yüksüz konumdan [mm]']);
    const hucre = (t, i) => Array.from(tablolar[t].querySelectorAll('tr')).slice(1).map((tr) => tr.cells[i].textContent);
    expect(hucre(0, 0).slice(-1)).toEqual(['Güç grubu (bütün noktalar)']);
    expect(Array.from(tablolar[0].rows).slice(-1)[0].cells[3].textContent).toBe('−15,33');
    expect(hucre(2, 0)).toContain('İleri tork · 1. Vites');
    expect(hucre(2, 0)).toContain('Tümsek (3,5g) · 3,5g Düşey');
    expect(hucre(2, 0)).toHaveLength(durumlar().length - 1 - 4);    // Statik yok; dört ad ikiz
    const sehim = Array.from(tablolar[3].rows).slice(1).map((tr) => Array.from(tr.cells).map((c) => c.textContent));
    expect(sehim).toHaveLength(18);                                  // altı takoz × üç eksen
    expect(sehim[2]).toEqual(['δz', '−6,97', 'Çukur + fren (3,5g)', '+1,34', 'Azami geri esneme (droop) · çekme']);
    expect(sehim[8]).toEqual(['δz', '−7,34', 'Geri tork', '+3,6', 'İleri tork · çekme']);
    expect(sehim[17]).toEqual(['δz', '−6,38', 'İleri tork', '+4,56', 'Geri tork · çekme']);
  });
});
