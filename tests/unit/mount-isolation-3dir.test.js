/**
 * Üç yönde izolasyon yüzdesi (Rapor §8.8 ek tablosu)
 * ──────────────────────────────────────────────────
 * Tedarikçi raporlarının (AMC, Angst+Pfister) "Isolation %" sütunu, ateşleme
 * frekansındaki iletilebilirliğin yüzde karşılığıdır ve ÜÇ YÖNDE ayrı verilir.
 * Bizde yalnız tek-serbestlik kestirimi vardı: tek sayı, yalnız düşey.
 *
 * Burada test edilen üç şey:
 *
 *  1. Sayının TAM 6 SD çözümden gelmesi. Kestirimden okunsaydı dönme
 *     kuplajları kaybolur, tedarikçi sayısıyla karşılaştırma anlamsızlaşırdı.
 *  2. İzolasyon = (1−T)·100 özdeşliği ve NEGATİF değerin kırpılmaması —
 *     rezonansta titreşim azalmaz, katlanır; sıfıra kırpmak "kötü değil"
 *     izlenimi verirdi.
 *  3. Motor tanımı yoksa tablonun HİÇ üretilmemesi (ateşleme frekansı yok →
 *     karşılaştırılacak nokta da yok).
 */
const core = require('../../js/mount-core.js');
global.veMountCore = core;
global.showToast = () => {};
const rep = require('../../js/cp-mount-report.js');

const mm = 1e-3, kNmm = 1e3, G = 9.81;

function buildR(torqueExtra) {
  const comps = [
    { name: 'Motor', mass: 300, cg: [-0.2, 0, 0.4],
      I: [[20, 0, 0], [0, 40, 0], [0, 0, 35]], pointMass: false },
    { name: 'Şanzıman', mass: 150, cg: [0.4, 0, 0.3],
      I: [[8, 0, 0], [0, 20, 0], [0, 0, 18]], pointMass: false },
  ];
  const mnts = [
    ['Sağ Ön', -150, 250, 100], ['Sol Ön', -150, -250, 100],
    ['Sağ Arka', 500, 250, 120], ['Sol Arka', 500, -250, 120],
  ].map((m) => ({ name: m[0], pos: [m[1] * mm, m[2] * mm, m[3] * mm],
                  kstat: [800 * kNmm, 800 * kNmm, 500 * kNmm],
                  kdyn: [1200 * kNmm, 1200 * kNmm, 800 * kNmm] }));
  const mp = core.combineMassProps(comps);
  const K = core.buildK(mnts, mp.cg, false);
  const LC = { name: 'Static', n: [0, 0, -1], T: [0, 0, 0] };
  const stat = core.solveCase(K, mnts, mp.cg, mp.m, G, LC);
  const M6 = core.buildM6(mp.m, mp.I_G);
  return {
    mp, mounts: mnts, g: G, zeta: 0.02,
    damping: core.mountDamping(mnts, core.mountLoadShares(stat, G), 0.02),
    modes: core.solveModal(core.buildK(mnts, mp.cg, true), M6, mnts, mp.cg),
    allCases: [{ name: 'Static', loadCase: LC, res: stat }],
    gather: { torque: Object.assign({ idleRpm: 800, cylinders: 6 }, torqueExtra || {}) },
    M6,
  };
}

const R = buildR();
const fFire = (800 / 60) * (6 / 2);

describe('_mntRepIsolation3 — yön başına iletilebilirlik', () => {
  const i3 = rep._mntRepIsolation3(R, {});

  test('ateşleme frekansı f = (N/60)·(z/2)', () => {
    expect(i3.fFire).toBeCloseTo(fFire, 9);
    expect(i3.dirs.length).toBe(3);
    expect(i3.dirs.map((d) => d.dir)).toEqual([0, 1, 2]);
  });

  test('T değeri TAM 6 SD frekans yanıtından — kestirimden DEĞİL', () => {
    // Aynı çekirdek çağrısıyla birebir örtüşmeli. Kestirimden okunsaydı
    // dönme kuplajları kaybolur, tedarikçi sayısıyla karşılaştırma bozulurdu.
    [0, 1, 2].forEach((d) => {
      const ref = core.frfAt(R.mounts, R.mp.cg, R.M6, R.damping, fFire, d);
      expect(i3.dirs[d].T).toBeCloseTo(ref, 12);
    });
    // Ve tek-serbestlik kestiriminden FARKLI olmalı (yoksa test bir şey
    // kanıtlamıyor demektir): SDOF yalnız düşeyde tek kütle-yay varsayar.
    const sdof = rep._mntRepIsolation(R, {});
    expect(Math.abs(i3.dirs[2].T - sdof.T)).toBeGreaterThan(1e-6);
  });

  test('izolasyon = (1−T)·100, negatif değer KIRPILMAZ', () => {
    i3.dirs.forEach((d) => expect(d.iso).toBeCloseTo((1 - d.T) * 100, 9));
    // Rezonansa denk gelen bir yön varsa yüzde eksi olabilmeli
    const low = buildR({ idleRpm: 60 });        // ateşleme 3 Hz → mod bandına yakın
    const i4 = rep._mntRepIsolation3(low, {});
    i4.dirs.forEach((d) => expect(d.iso).toBeCloseTo((1 - d.T) * 100, 9));
  });

  test('şirket kriteri (T < 0,5) yön başına işaretlenir', () => {
    i3.dirs.forEach((d) => expect(d.ok).toBe(d.T < 0.5));
  });

  test('motor tanımı yoksa hesap HİÇ yapılmaz', () => {
    // Ateşleme frekansı bilinmeden karşılaştırılacak bir nokta yok.
    expect(rep._mntRepIsolation3(buildR({ idleRpm: 0 }), {})).toBeNull();
    const noCyl = buildR();
    delete noCyl.gather.torque.cylinders;
    expect(rep._mntRepIsolation3(noCyl, {})).toBeNull();
    // Sönüm türetilemediyse de yok (uydurma ζ ile izolasyon yüzdesi verilmez)
    const noDamp = buildR();
    noDamp.damping = null;
    expect(rep._mntRepIsolation3(noDamp, {})).toBeNull();
  });
});

describe('Rapor tablosu', () => {
  test('üç yön satırı ve izolasyon yüzdesi tabloda', () => {
    const h = rep._mntRepIso3Table(R, {}, rep._mntRepIsolation(R, {}));
    expect(h).toContain('İzolasyon [%]');
    ['X (boyuna)', 'Y (yanal)', 'Z (düşey)'].forEach((n) => expect(h).toContain(n));
    const i3 = rep._mntRepIsolation3(R, {});
    i3.dirs.forEach((d) => expect(h).toContain(d.T.toFixed(4).replace('.', ',')));
    // Tedarikçi raporlarıyla karşılaştırma yönergesi
    expect(h).toContain('Isolation %');
  });

  test('hesaplanamıyorsa tablo hiç basılmaz — boş sütun görünmez', () => {
    expect(rep._mntRepIso3Table(buildR({ idleRpm: 0 }), {}, null)).toBe('');
  });

  test('§8.8 bölümü tabloyu içerir', () => {
    const h = rep._mntRepFreqPlacement(R, {});
    expect(h).toContain('yön başına izolasyon');
    // Kestirim de duruyor: ikisi yan yana, biri ötekinin yerine geçmiyor
    expect(h).toContain('tek-serbestlik kestirimidir');
  });
});
