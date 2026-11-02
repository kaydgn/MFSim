/**
 * TTAR (Siper) ↔ Adams referans karşılaştırması (tests/fixtures/adams-ttar.js)
 * ───────────────────────────────────────────────────────────────────────────
 * Bu dosya bir doğruluk kapısı DEĞİL, bir DEFTERDİR (Tulga'nın eşi:
 * mount-adams-tulga.test.js). Ölçülmüş dört şeyi sayıyla dondurur:
 *
 *   1. GİRDİ — sevk edilen Siper örneği kitapla birebir (motor 1.386,26 kg,
 *      X15: 700 d/dk, 6 silindir); toplam kütle Adams'ınkiyle aynı.
 *
 *   2. MODLAR — altı mod Adams'la 0,025 Hz içinde (RMS 0,009 Hz).
 *
 *   3. ARAÇ EKSENİ — programın ivme yük durumları ileri −X eksende yazılı;
 *      TTAR'da ileri +X. Örnek Çözücü'de ileri +X ve 3,5 g virajla aynı yönde
 *      kaldırım darbesiyle gelir: 13 satırın 230 değerinde RMS 0,175 mm.
 *      Varsayılan ayarla (ileri −X) boyuna ve yanal yük durumları TERS:
 *      satır başına 2,6–10,7 mm. Tork ve saf düşey durumlar yük yönünden
 *      bağımsız (tork yönü varsayılan −X, TTAR'ın Adams'ı). Adams'ın X/Y'si
 *      Z etrafında 180° döndürülmüş eksende: karşılaştırma onları çevirir.
 *
 *   4. TR — program %5,66 (ζ çözücünün), Adams %5,2.
 *
 * Gerekçe ve kitabın tutarsız hücreleri fikstürün başlığında.
 */

const fs = require('fs');
const path = require('path');
const core = require('../../js/mount-core.js');
global.veMountCore = core;
global.veMntSignals = require('../../js/mount-signals.js');
global.veMntBrief = require('../../js/mount-brief.js');
const stubs = stubGlobals({ saveState: jest.fn(), showToast: jest.fn(), showNodeProperties: jest.fn() });
eval(fs.readFileSync(path.join(__dirname, '../../js/components.js'), 'utf8'));
global.componentDefs = componentDefs;
const cp = require('../../js/cp-mount.js');
const rep = require('../../js/cp-mount-report.js');
const REF = require('../fixtures/adams-ttar.js');

const TOPO = JSON.parse(fs.readFileSync(
  path.join(__dirname, '../../assets/examples/siper_topoloji.json'), 'utf8'));

beforeEach(() => { resetStubs(stubs); });

// ── Modeli koş: 'ornek' = sevk edilen örnek (ileri +X, kaldırım 3,5 g virajla
// aynı), 'varsayilan' = Çözücü'nün yön ayarları varsayılanda (ileri −X,
// kaldırım 1,55 g virajın tersi), 'kaldirim-varsayilan' = ileri +X, kaldırım
// varsayılanda ──
function solve(variant) {
  const t = JSON.parse(JSON.stringify(TOPO));
  const cz = t.nodes.find((n) => n.type === 'mnt-solver').data;
  if (variant === 'varsayilan') ['ileri', 'kaldirimG', 'kaldirimYon'].forEach((k) => delete cz[k]);
  if (variant === 'kaldirim-varsayilan') ['kaldirimG', 'kaldirimYon'].forEach((k) => delete cz[k]);
  global.nodes = t.nodes; global.connections = t.connections;
  global.veUpdateResultsTree = jest.fn();
  const R = cp._mntComputeResults(t.nodes.find((n) => n.type === 'mnt-solver').id);
  expect(R.error).toBeUndefined();
  const names = R.mounts.map((m) => m.name);
  const idx = REF.COLUMNS.map((c) => {
    const i = names.indexOf(c.mount);
    expect(i).toBeGreaterThanOrEqual(0);         // sütun eşlemesi çürüdüyse burada patlar
    return i;
  });
  const iso = rep._mntRepIsolation(R, {});       // rölanti ve silindir örneğin Motor'undan
  return {
    m: R.mp.m, cg: R.mp.cg.map((v) => v * 1000), tr: iso.T,
    modes: R.modes.map((md) => md.f_Hz),
    d: REF.ROWS.map((r) => {
      const c = R.allCases.find((x) => x.name === r.lc);
      expect(c && c.res).toBeTruthy();            // yük durumu adı çürüdüyse burada patlar
      return idx.map((i) => c.res.perMount[i].delta.map((v) => v * 1000));
    }),
    nodes: t.nodes,
  };
}

const ORN = solve('ornek');
const VARS = solve('varsayilan');
const KVARS = solve('kaldirim-varsayilan');

const ri = (row) => REF.ROWS.findIndex((r) => r.row === row);
const ci = (col) => REF.COLUMNS.findIndex((c) => c.col === col);
const supheli = (r, c, a) => REF.SUPHELI.some((s) => ri(s.row) === r && ci(s.col) === c && s.axis === a);
// Adams'ın raporladığı eksende program: X ve Y ters (bulgu 2), ya da olduğu gibi
const adamsta = (sol, r, c, cevir) => sol.d[r][c].map((v, a) => (cevir !== false && a < 2) ? -v : v);
function stats(sol, satirlar, opt) {
  opt = opt || {};
  const e = [];
  satirlar.forEach((name) => {
    const r = ri(name);
    for (let c = 0; c < 6; c++) {
      const p = adamsta(sol, r, c, opt.cevir);
      for (let a = 0; a < 3; a++) {
        if (supheli(r, c, a) || (opt.hucre && !opt.hucre(c, a))) continue;
        e.push(p[a] - REF.TABLE[r][c][a]);
      }
    }
  });
  return { n: e.length, rms: Math.sqrt(e.reduce((s, v) => s + v * v, 0) / e.length), max: Math.max(...e.map(Math.abs)) };
}
const BOYUNA_YANAL = ['Braking', 'Cornering Left', 'Cornering Right', 'Brake in Turn (L)', 'Brake in Turn (R)', 'Pothole Braking'];
const DUSEY = ['Static', 'Max Bump', 'Max Rebound'];
const TORK = ['Forward (3.51)', 'Reverse (-4.8)'];
const KALDIRIM = ['Rim Lateral Kerb Strike (L)', 'Rim Lateral Kerb Strike (R)'];
const KARSILASTIRILAN = REF.ROWS.filter((r) => r.gap !== 'yer-tutucu').map((r) => r.row);

describe('1) girdi — Siper örneği kitapla birebir', () => {
  test('örneğin Çözücü ayarı: ileri +X, kaldırım 3,5 g virajla aynı, tork yönü varsayılan (−X)', () => {
    const cz = TOPO.nodes.find((n) => n.type === 'mnt-solver').data;
    expect(cp._mntYonAyari(cz)).toEqual({ ileri: '+x', kaldirimG: REF.KERB_G, kaldirimYon: 'ayni', torkYon: '-x' });
    const mo = TOPO.nodes.find((n) => n.type === 'mnt-motor').data;
    expect([+mo.idleRpm, +mo.cylinders]).toEqual([REF.ENGINE.idleRpm, REF.ENGINE.cylinders]);
  });

  test('gövdeler: kütle, ağırlık merkezi, atalet', () => {
    const govde = ORN.nodes.filter((n) => (componentDefs[n.type] || {}).isMountBody);
    expect(govde).toHaveLength(REF.INPUT.bodies.length);
    REF.INPUT.bodies.forEach((b) => {
      const n = govde.find((x) => x.customName === b.name);
      expect(n).toBeTruthy();
      const d = n.data;
      expect(Math.abs(+d.mass - b.mass)).toBeLessThan(1e-9);
      [+d.cgx, +d.cgy, +d.cgz].forEach((v, k) => expect(Math.abs(v - b.cg[k])).toBeLessThan(0.002));
      if (b.I && b.name !== 'Sağ cradle') [+d.Ixx, +d.Iyy, +d.Izz].forEach((v, k) => expect(v).toBeCloseTo(b.I[k], 6));
    });
    // Sağ cradle'ın ataletini kitap Sol cradle'dan kopyalamış; örnek CATIA'nın kendi değerini taşıyor
    const sag = govde.find((x) => x.customName === 'Sağ cradle').data;
    expect([+sag.Ixx, +sag.Iyy]).toEqual([0.23, 3.858]);
  });

  test('takozlar ve tork zinciri birebir', () => {
    const tk = ORN.nodes.filter((n) => n.type === 'mnt-mount');
    REF.COLUMNS.forEach((c, k) => {
      const d = tk.find((x) => x.customName === c.mount).data;
      expect([+d.x, +d.y, +d.z]).toEqual(REF.INPUT.mounts[k]);
      expect([+d.kxs, +d.kys, +d.kzs]).toEqual(REF.INPUT.kstat);
      expect([+d.kxd, +d.kyd, +d.kzd]).toEqual(REF.INPUT.kdyn);
    });
    const g = ORN.nodes.find((n) => n.type === 'mnt-gearbox').data, mo = ORN.nodes.find((n) => n.type === 'mnt-motor').data;
    const T = REF.INPUT.torque;
    expect(+mo.Te).toBe(T.Te);
    expect([+g.Rstall, +g.iTransfer, +g.g1, +g.gR]).toEqual([T.Rstall, T.iTransfer, T.g1, T.gR]);
    expect(+g.phiFwd).toBeCloseTo(T.phiFwd, 12);
    expect(+g.phiRev).toBeCloseTo(T.phiRev, 12);
  });

  test('toplam kütle ve ağırlık merkezi Adams\'ınkiyle', () => {
    expect(Math.abs(ORN.m - REF.MASS.m)).toBeLessThan(1e-6);
    ORN.cg.forEach((v, k) => expect(Math.abs(v - REF.MASS.cg[k])).toBeLessThan(0.02));
  });
});

describe('2) modlar — Adams\'la 0,025 Hz içinde', () => {
  test('mod başına ve karesel ortalama', () => {
    const e = ORN.modes.map((f, i) => f - REF.MODES[i]);
    e.forEach((v) => expect(Math.abs(v)).toBeLessThan(0.025));   // en büyüğü 6. mod: +0,021 Hz
    expect(Math.sqrt(e.reduce((s, v) => s + v * v, 0) / 6)).toBeLessThan(0.012);   // ölçülen 0,009 Hz
  });
  test('yük yönü modlara girmez', () => {
    VARS.modes.forEach((f, i) => expect(f).toBeCloseTo(ORN.modes[i], 9));
  });
});

describe('3) araç ekseni — TTAR\'da ileri +X', () => {
  test('Adams\'ın X/Y\'si döndürülmüş eksende: saf düşey ve tork satırlarında yalnız çevrilince tutuyor', () => {
    const xy = (c, a) => a < 2;
    const olduguGibi = stats(ORN, DUSEY.concat(TORK), { cevir: false, hucre: xy });
    const cevrik = stats(ORN, DUSEY.concat(TORK), { hucre: xy });
    expect(olduguGibi.rms).toBeGreaterThan(1.0);                 // ölçülen 1,44 mm
    expect(cevrik.rms).toBeLessThan(0.15);                       // ölçülen 0,098 mm
  });

  test('örnek (ileri +X): boyuna ve yanal yük durumları tablo mertebesinde', () => {
    BOYUNA_YANAL.forEach((row) => {
      expect(stats(ORN, [row]).rms).toBeLessThan(0.3);           // ölçülen 0,07–0,29 mm
    });
    const s = stats(ORN, KARSILASTIRILAN);
    expect(s.n).toBe(230);
    expect(s.rms).toBeLessThan(0.2);                             // ölçülen 0,175 mm
    expect(s.max).toBeLessThan(1.0);                             // ölçülen 0,95 mm
  });

  test('varsayılan (ileri −X): boyuna ve yanal yük durumları ters yönde', () => {
    BOYUNA_YANAL.forEach((row) => {
      expect(stats(VARS, [row]).rms).toBeGreaterThan(2.5);       // ölçülen 2,6–10,7 mm
    });
  });

  test('saf düşey ve tork durumları yük yönünden bağımsız ve çevirmeden tutuyor', () => {
    DUSEY.concat(TORK).forEach((row) => {
      const a = stats(ORN, [row]), b = stats(VARS, [row]);
      expect(a.rms).toBeCloseTo(b.rms, 9);
      expect(a.rms).toBeLessThan(0.25);                          // ölçülen 0,04–0,19 mm
    });
  });
});

describe('kaldırım darbesi — kitabın tanımı 3,5 g, virajla aynı yönde', () => {
  test('örnek: ön takozlar 0,1 mm içinde, iki satır 0,3 mm içinde', () => {
    const on = stats(ORN, KALDIRIM, { hucre: (c, a) => c < 2 && a > 0 });
    expect(on.rms).toBeLessThan(0.1);                            // ölçülen 0,06 mm
    KALDIRIM.forEach((row) => expect(stats(ORN, [row]).rms).toBeLessThan(0.3));
  });
  test('varsayılan 1,55 g (virajın tersi) tutmuyor', () => {
    KALDIRIM.forEach((row) => expect(stats(KVARS, [row]).rms).toBeGreaterThan(4));
  });
});

describe('4) TR — ateşleme frekansında iletilebilirlik', () => {
  test('program %5,66, Adams %5,2', () => {
    expect(ORN.tr * 100).toBeCloseTo(5.66, 1);
    expect(Math.abs(ORN.tr - REF.TR)).toBeLessThan(0.006);
  });
});

describe('kitaptaki tutarsızlıklar — karşılaştırma dışı, kayıtlı', () => {
  test('dört hücre programdan > 2 mm uzak, tutarlı karşılığı 0,5 mm içinde', () => {
    REF.SUPHELI.forEach((s) => {
      const r = ri(s.row), c = ci(s.col), kr = ri(s.karsi.row), kc = ci(s.karsi.col);
      const p = adamsta(ORN, r, c)[s.axis], pk = adamsta(ORN, kr, kc)[s.axis];
      expect(Math.abs(p - REF.TABLE[r][c][s.axis])).toBeGreaterThan(2);
      expect(Math.abs(pk - REF.TABLE[kr][kc][s.axis])).toBeLessThan(0.5);
    });
  });
  test('Acceleration satırı yer tutucu: altı takozda aynı değer', () => {
    const r = ri('Acceleration');
    REF.TABLE[r].forEach((v) => expect(v).toEqual(REF.TABLE[r][0]));
  });
});
