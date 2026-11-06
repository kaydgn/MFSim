/**
 * mount-ornek-tta.test.js — 10 TON TTA ÖRNEĞİ: KULLANICININ ÇALIŞMA KİTABINA KARŞI
 * ─────────────────────────────────────────────────────────────────────────
 * Örnek (assets/examples/tta10_topoloji.json · MOUNT_EXAMPLES.tta10) kullanıcının
 * Excel'inden kuruldu (tests/fixtures/excel-tta-askisiz.js — dondurulmuş):
 *
 *   · EXCEL — Front Support'un formülleri Excel'in hücrelerindeki sonucu verir;
 *     ağırlık kırılımının grup toplamları ve iletilebilirlik eğrisi de.
 *   · GÖVDELER — örneğin on bir gövdesi kırılımın iki grubunu birebir verir;
 *     motorun ataleti ISM11 veri sayfası + motora katılan parçaların nokta kütle
 *     payı, 4500 SP'ninki Allison 4000 §11.
 *   · TAKOZLAR — X Front Support'tan (L2 · L4 + L7), Y/Z kulaklardan, rijitlik
 *     ASFAT'ın takozlarından (kullanıcı kararı 2026-11-06).
 *   · MFSİM ↔ EXCEL — statik reaksiyon ve bloğun arka yüzündeki moment. Excel'in
 *     Mr'ı 992,7 N·m, programın 1.152,6: Excel L3'ü (563) 4500 SP gövdesinin
 *     ağırlık merkezinden alıyor, Wt'ye (530 kg) ise PTO, pompa ve kardan payını
 *     da katıyor — grubun ağırlık merkeziyle L3 596,3, Mr 1.143,0. Kalan 9,6 N·m
 *     arka kulakların (11 kg, düzlemin arkasında) ve g'nin (9,81 ↔ 9,806) payı.
 *   · KAYIT — JSON ile kayıt defteri birebir; rapor §8.18 sınırsız.
 */
const fs = require('fs');
const path = require('path');
const X = require('../fixtures/excel-tta-askisiz.js');
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

function coz(degis) {
  const t = JSON.parse(JSON.stringify(TOPO));
  if (degis) degis(t);
  global.nodes = t.nodes.map((n) => Object.assign(n, { def: componentDefs[n.type] }));
  global.connections = [];
  cp._mntForgetResults();
  return cp._mntComputeResults(global.nodes.find((n) => n.type === 'mnt-solver').id);
}
const R = coz();
const statik = (Rx) => Rx.allCases.find((c) => c.name === 'Static');
const dusey = (Rx) => statik(Rx).res.perMount.map((p) => -p.f[2] / G);   // kgf
const govdeler = () => TOPO.nodes.filter((n) => componentDefs[n.type].isMountBody);
const takozlar = () => TOPO.nodes.filter((n) => n.type === 'mnt-mount');

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

describe('TAKOZLAR — X Front Support\'tan, Y/Z kulaklardan, rijitlik ASFAT\'ın takozlarından', () => {
  const kulak = (ad) => govdeler().find((n) => n.customName === ad).data;
  test('konum: ön RFOB − L2, arka RFOB + L4 + L7; ön kulağın Y/Z\'si, arka kulağın Y\'si + L8 dışa', () => {
    const [on, sag, sol] = takozlar().map((n) => n.data);
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
    const [on, sag, sol] = takozlar();
    expect(tk(on)).toEqual(uc(L['57RS313774-sr116']));
    expect(tk(sag)).toEqual(uc(L['57RS313773-sr116']));
    expect(tk(sol)).toEqual(uc(L['57RS313773-sr116']));
    expect(+TOPO.nodes.find((n) => n.type === 'mnt-solver').data.zeta).toBe(0.02);
  });
});

describe('MFSİM ↔ EXCEL — statik (1 g)', () => {
  test('çözüm lineer ve hatasız; düşey reaksiyonlar ön 493,0 · sağ arka 595,7 · sol arka 650,4 kgf', () => {
    expect(R.error).toBeUndefined();
    expect(R.solvedNL).toBe(false);
    const [on, sag, sol] = dusey(R);
    expect([+on.toFixed(1), +sag.toFixed(1), +sol.toFixed(1)]).toEqual([493.0, 595.7, 650.4]);
    expect(on + sag + sol).toBeCloseTo(1739.1, 6);
  });
  test('reaksiyon Excel\'in formülüyle, L3 grubun ağırlık merkezinden: ±0,5 kgf; Excel\'in L3\'üyle 14,8 kgf fark', () => {
    const [on, sag, sol] = dusey(R);
    const t = cummins(Object.assign({}, Gi, { We: MOTOR_G.m, L3: SANZ_G.cg[0] - 428.5 }));
    expect(Math.abs(on - t.R1)).toBeLessThan(0.5);
    expect(Math.abs(sag + sol - t.R2)).toBeLessThan(0.5);
    expect(F.sonuc.R1 - on).toBeCloseTo(14.8, 1);
    expect(sag + sol - F.sonuc.R2).toBeCloseTo(13.9, 1);
  });
  test('rijitlikten bağımsız: A26 ve TK050 takozlarıyla düşey reaksiyonlar ±%0,5', () => {
    const baz = dusey(R);
    [['57RS313774', '57RS313773'], ['TK050', 'TK050']].forEach(([a, b]) => {
      const Rx = coz((t) => t.nodes.filter((n) => n.type === 'mnt-mount').forEach((n, i) => {
        const e = cp.VE_MOUNT_LIBRARY[i === 0 ? a : b];
        Object.assign(n.data, { kxs: e.sx, kys: e.sy, kzs: e.sz, kxd: e.dx, kyd: e.dy, kzd: e.dz });
      }));
      dusey(Rx).forEach((v, i) => expect(Math.abs(v - baz[i]) / baz[i]).toBeLessThan(0.005));
    });
  });
  test('bloğun arka yüzünde moment: 1.152,6 N·m; Excel 992,7 — farkın 150,3\'ü L3, kalan 9,6\'sı arka kulaklar ve g', () => {
    const st = R.baglanti.satirlar.find((r) => r.name === 'Static');
    expect(R.baglanti).toMatchObject({ S: [428.5, -0.58, 493.96], a: [1, 0, 0], sinir: null });
    expect([st.m, st.takoz]).toEqual([541, 2]);                       // şanzıman grubu + iki arka kulak · iki arka takoz
    expect(+st.egilme.toFixed(1)).toBe(1152.6);
    // düzlemin arkası serbest cisim (düşey kuvvetlerle): takozların yatay kuvvetinin payı < 1 N·m
    const [, sag, sol] = dusey(R);
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
      expect(d.egSinir).toBeUndefined();
    });
    expect(T.map((n) => n.customName)).toEqual(M.mounts.map((m) => m.name));
    T.forEach((n, i) => {
      const m = M.mounts[i], d = n.data;
      expect([d.x, d.y, d.z, d.kxs, d.kys, d.kzs, d.kxd, d.kyd, d.kzd]).toEqual(m.pos.concat(m.kstat, m.kdyn));
    });
    expect(+TOPO.nodes.find((n) => n.type === 'mnt-solver').data.zeta).toBe(M.cozucu.zeta);
    expect(TOPO.nodes.find((n) => n.type === 'mnt-example').data.exampleKey).toBe('tta10');
  });
  test('TORK YOK — Excel tork, vites ve rölanti vermez; uydurma değer sızmaz', () => {
    expect(M.torque).toBeUndefined();
    const alan = ['Te', 'TeRpm', 'Pmax', 'idleRpm', 'cylinders', 'g1', 'gR', 'Rstall', 'iTransfer'];
    govdeler().forEach((n) => alan.forEach((k) => expect([n.customName, k, n.data[k]]).toEqual([n.customName, k, undefined])));
    expect(R.allCases.map((c) => c.name)).not.toContain('Forward Torque');
  });
  test('programatik kurucu (JSON\'suz yol) bağlantı yüzünü de kurar', () => {
    jest.useFakeTimers();
    try {
      let k = 0;
      global.createNode = jest.fn((type, x, y) => { global.nodes.push({ id: 'p' + (++k), type, def: componentDefs[type], x, y, width: 80, height: 60, data: {} }); });
      global.confirm = () => true;
      global.nodes = [];
      global.connections = [];
      cp._mntLoadExampleFromModel(null, 'tta10');
      const s = global.nodes.find((n) => n.type === 'mnt-gearbox').data;
      expect([s.bagX, s.bagY, s.bagZ]).toEqual([428.5, -0.58, 493.96]);
      expect('egSinir' in s).toBe(false);
      expect(global.nodes.filter((n) => componentDefs[n.type].isMountBody)).toHaveLength(11);
    } finally {
      jest.clearAllTimers();
      jest.useRealTimers();
      delete global.createNode;
    }
  });
  test('rapor §8.18: bloğun arka yüzünde Statik 1.153 N·m, sınır yok — hüküm sütunu ve uygunluğun 5. satırı yok', () => {
    global._veMntLast = coz();
    const el = document.createElement('div');
    el.innerHTML = rep._mntRepSection8(global._veMntLast);
    const tablo = Array.from(el.querySelectorAll('table')).find((t) => /kesit momenti/.test((t.querySelector('caption') || {}).textContent || ''));
    expect(tablo.querySelector('caption').textContent).not.toContain('sınır');
    const st = Array.from(tablo.querySelectorAll('tr')).find((tr) => tr.cells[0].textContent === 'Statik (yerçekimi)');
    expect(Array.from(st.cells).map((c) => c.textContent).slice(2, 4)).toEqual(['2', '1.153']);
    expect(st.cells).toHaveLength(5);
    expect(rep.veMntUygunluk(global._veMntLast).satirlar.map((s) => s.no)).toEqual(['1', '1a', '1b', '2', '3', '4']);
  });
});
