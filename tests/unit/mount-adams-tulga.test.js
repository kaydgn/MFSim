/**
 * Tulga ↔ Adams referans karşılaştırması (tests/fixtures/adams-tulga.js)
 * ─────────────────────────────────────────────────────────────────────
 * Bu dosya bir doğruluk kapısı DEĞİL, bir DEFTERDİR. Ölçülmüş üç şeyi
 * sayıyla dondurur, böylece biri kaydığında sessiz kalmaz:
 *
 *   1. STATİK TARAF ÖRTÜŞÜYOR — 10 temiz yük durumunda RMS 0,067 mm, yani
 *      tablonun kendi yuvarlama biriminin (0,1 mm) altında. Geometri, kütle
 *      dağılımı ve k_stat bu satırla doğrulanmış sayılır. Bu sayı büyürse
 *      çözücünün ya da modelin statik tarafında bir şey bozulmuştur.
 *
 *   2. İKİ AÇIK MODEL FARKI — Adams'ta olup MFSim'de olmayan iki şey:
 *      yanal (±12 mm) durdurucu ve tork yalpa işareti. Bunlar kapatılırsa
 *      buradaki testler kırmızıya döner ve defterin güncellenmesini ister.
 *
 *   3. KAPANMAMIŞ MODAL SORUSU — sevk edilen örnek kataloğa göre düzeltildi
 *      (TK040 dinamik X↔Z takası), ama Adams TAKASLI hâle daha yakın:
 *      modal RMS 0,539 Hz (takaslı) < 1,010 Hz (katalog). Yani Adams'ın
 *      girdisi de büyük olasılıkla takaslı. Bu iki sayı burada durur ki
 *      MLMT-0216-33-TK040 raporu ya da Adams girdi dosyası geldiğinde
 *      hangi tarafın oynayacağı belli olsun. Gerekçe fikstürün başlığında.
 *
 * Statik çökmeler k_dyn'e BAĞLI DEĞİLDİR (statik yol yalnız k_stat kullanır),
 * dolayısıyla (1) ve (2) iki varyantta da AYNI çıkar — bu da ayrıca kilitli.
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
const REF = require('../fixtures/adams-tulga.js');

const TOPO = JSON.parse(fs.readFileSync(
  path.join(__dirname, '../../assets/examples/tulga_topoloji.json'), 'utf8'));

beforeEach(() => { resetStubs(stubs); });

// ── Modeli koş: 'katalog' = sevk edilen örnek, 'adams' = fikstürdeki girdi ──
function solve(variant) {
  const t = JSON.parse(JSON.stringify(TOPO));
  if (variant === 'adams') {
    const D = REF.INPUT_DELTA;
    t.nodes.forEach((n) => {
      if (n.type !== 'mnt-mount') return;
      const d = n.data, ks = [+d.kxs, +d.kys, +d.kzs];
      if (ks.every((v, i) => v === D.matchKstat[i])) {
        d.kxd = String(D.adamsKdyn[0]); d.kyd = String(D.adamsKdyn[1]); d.kzd = String(D.adamsKdyn[2]);
      }
    });
  }
  global.nodes = t.nodes; global.connections = t.connections;
  global.veUpdateResultsTree = jest.fn();
  const R = cp._mntComputeResults(t.nodes.find((n) => n.type === 'mnt-solver').id);
  expect(R.error).toBeUndefined();
  const names = R.mounts.map((m) => m.name);
  const idx = REF.COLUMNS.map((c) => {
    const i = names.indexOf(c.mount);
    expect(i).toBeGreaterThanOrEqual(0);       // sütun eşlemesi çürüdüyse burada patlar
    return i;
  });
  return {
    modes: R.modes.map((m) => m.f_Hz),
    d: REF.ROWS.map((r) => {
      const c = R.allCases.find((x) => x.name === r.lc);
      expect(c && c.res).toBeTruthy();          // yük durumu adı çürüdüyse burada patlar
      return idx.map((i) => c.res.perMount[i].delta.map((v) => v * 1000));
    }),
  };
}

const KAT = solve('katalog');
const ADA = solve('adams');

// Bir satır kümesinin Tablo 1'e göre hata istatistiği
function stats(sol, rowFilter) {
  const e = [];
  REF.ROWS.forEach((r, ri) => {
    if (!rowFilter(r)) return;
    for (let c = 0; c < 5; c++) for (let a = 0; a < 3; a++) {
      e.push(Math.abs(sol.d[ri][c][a] - REF.TABLE1[ri][c][a]));
    }
  });
  return { n: e.length, rms: Math.sqrt(e.reduce((s, v) => s + v * v, 0) / e.length),
           max: Math.max(...e), within: (v) => e.filter((x) => x <= v).length / e.length };
}
const CLEAN = (r) => !r.gap;
const modalRms = (m) => Math.sqrt(m.reduce((s, f, i) => s + (f - REF.TABLE1_MODES[i]) ** 2, 0) / 6);

describe('fikstür bütünlüğü — karşılaştırma neyi karşılaştırdığını bilmeli', () => {
  test('sevk edilen örnek KATALOG değerini taşıyor', () => {
    const D = REF.INPUT_DELTA;
    const tk = TOPO.nodes.filter((n) => n.type === 'mnt-mount' &&
      [+n.data.kxs, +n.data.kys, +n.data.kzs].every((v, i) => v === D.matchKstat[i]));
    expect(tk).toHaveLength(2);
    tk.forEach((n) => expect([+n.data.kxd, +n.data.kyd, +n.data.kzd]).toEqual(D.catalogKdyn));
  });

  test('Adams varyantının TEK farkı belgelenen girdi deltası', () => {
    // Fikstür zamanla çürümesin: iki model arasında başka hiçbir alan ayrışamaz.
    const a = JSON.parse(JSON.stringify(TOPO));
    const D = REF.INPUT_DELTA;
    let touched = 0;
    a.nodes.forEach((n) => {
      if (n.type !== 'mnt-mount') return;
      if (![+n.data.kxs, +n.data.kys, +n.data.kzs].every((v, i) => v === D.matchKstat[i])) return;
      n.data.kxd = String(D.adamsKdyn[0]); n.data.kzd = String(D.adamsKdyn[2]); touched++;
    });
    expect(touched).toBe(2);
    const diff = [];
    TOPO.nodes.forEach((n, i) => {
      const m = a.nodes[i];
      Object.keys(n.data || {}).forEach((k) => {
        if (String((n.data || {})[k]) !== String((m.data || {})[k])) diff.push(n.customName + '.' + k);
      });
    });
    expect(diff.sort()).toEqual(['Sağ Ön Takoz.kxd', 'Sağ Ön Takoz.kzd',
                                 'Sol Ön Takoz.kxd', 'Sol Ön Takoz.kzd']);
    expect(REF.INPUT_DELTA.adamsKdyn).toEqual([D.catalogKdyn[2], D.catalogKdyn[1], D.catalogKdyn[0]]);
  });
});

describe('1) statik taraf — Adams ile örtüşüyor ve k_dyn\'den bağımsız', () => {
  test('10 temiz yük durumunda RMS tablo yuvarlamasının altında', () => {
    const s = stats(KAT, CLEAN);
    expect(s.n).toBe(150);
    expect(s.rms).toBeLessThan(0.08);            // ölçülen 0,067 mm
    expect(s.max).toBeLessThan(0.30);            // ölçülen 0,23 mm
    expect(s.within(0.05)).toBeGreaterThan(0.55); // ölçülen %61 — tablo 0,1'e yuvarlı
    expect(s.within(0.50)).toBe(1);
  });

  test('iki varyant AYNI çökmeleri veriyor — k_dyn statik çözüme girmez', () => {
    // Bu, TK040 düzeltmesinin statik doğrulamayı bozmadığının kilidi.
    REF.ROWS.forEach((r, ri) => {
      for (let c = 0; c < 5; c++) for (let a = 0; a < 3; a++) {
        expect(KAT.d[ri][c][a]).toBeCloseTo(ADA.d[ri][c][a], 9);
      }
    });
  });
});

describe('2) açık model farkı — Adams\'ta var, MFSim\'de yok', () => {
  test('yanal durdurucu: Adams ön takozları ±12,0\'de kırpıyor, MFSim kırpmıyor', () => {
    ['Kerb Strike (L)', 'Kerb Strike (R)'].forEach((rowName) => {
      const ri = REF.ROWS.findIndex((r) => r.row === rowName);
      [2, 4].forEach((c) => {                                   // Sag_On_X, Sol_On_X
        // Adams ~12 mm'de duruyor (dört hücrenin üçü tam 12,0, biri 11,9)
        const t = Math.abs(REF.TABLE1[ri][c][1]);
        expect(t).toBeGreaterThanOrEqual(11.85);
        expect(t).toBeLessThanOrEqual(12.05);
        expect(Math.abs(KAT.d[ri][c][1])).toBeGreaterThan(t);          // MFSim: sınır yok, aşıyor
      });
      [1, 3].forEach((c) => {                                   // arka takozlar
        // Ön takozlar dibe oturunca Adams'ta yük arkaya dağılıyor → MFSim daha az
        expect(Math.abs(KAT.d[ri][c][1])).toBeLessThan(Math.abs(REF.TABLE1[ri][c][1]) - 1.0);
      });
    });
  });

  test('tork işareti: Y ve Z ters, X tutuyor', () => {
    ['Forward (3.49)', 'Reserve (-5.03)'].forEach((rowName) => {
      const ri = REF.ROWS.findIndex((r) => r.row === rowName);
      let flipped = 0, xok = 0;
      for (let c = 0; c < 5; c++) {
        [1, 2].forEach((a) => {
          const m = KAT.d[ri][c][a], t = REF.TABLE1[ri][c][a];
          if (Math.abs(m) > 1 && Math.abs(t) > 1 && Math.sign(m) !== Math.sign(t)) flipped++;
        });
        const mx = KAT.d[ri][c][0], tx = REF.TABLE1[ri][c][0];
        if (Math.abs(mx) < 1 || Math.abs(tx) < 1 || Math.sign(mx) === Math.sign(tx)) xok++;
      }
      expect(flipped).toBeGreaterThanOrEqual(9);   // 10 Y/Z değerinin neredeyse hepsi ters
      expect(xok).toBeGreaterThanOrEqual(3);
    });
  });
});

describe('3) kapanmamış soru — modal', () => {
  test('Adams, TAKASLI girdiye kataloglu girdiden DAHA YAKIN', () => {
    // Bu testin kırmızıya dönmesi iyi haberdir: ya gerçek sebep bulundu ya da
    // referans yenilendi. İkisinde de fikstürün başlığı güncellenmeli.
    const rk = modalRms(KAT.modes), ra = modalRms(ADA.modes);
    expect(ra).toBeLessThan(rk);
    expect(ra).toBeCloseTo(0.539, 2);     // takaslı  (Adams'ın muhtemel girdisi)
    expect(rk).toBeCloseTo(1.010, 2);     // katalog  (sevk edilen örnek)
  });

  test('mod başına sapma — hangi modun tuttuğu kayıtlı', () => {
    // Takaslı varyantta dördü %2,5 içinde; sapma mod 2 ve 5'te toplanıyor.
    const dev = ADA.modes.map((f, i) => Math.abs(f / REF.TABLE1_MODES[i] - 1));
    expect(dev.filter((d) => d < 0.025)).toHaveLength(4);
    expect(dev[1]).toBeGreaterThan(0.10);   // mod 2 (yanal) ~%12 düşük
    expect(dev[4]).toBeGreaterThan(0.05);   // mod 5 ~%7,5 düşük
  });

  test('reddedilen Tablo 2 hâlâ daha uzak — seçim gerekçesi kayıtlı', () => {
    const r2 = Math.sqrt(ADA.modes.reduce((s, f, i) => s + (f - REF.TABLE2_MODES[i]) ** 2, 0) / 6);
    expect(modalRms(ADA.modes)).toBeLessThan(r2);
  });
});
