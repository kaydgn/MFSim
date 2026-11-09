/**
 * @jest-environment jsdom
 */
// TAKOZ · PARAMETRİK ANALİZ — EXCEL ÇIKTISI, GERÇEK MODEL (10 Ton TTA)
// Kapılar (js/cp-mount-param-sonuc.js → veMntParamExcelIndir · _mntParamExcelPlan):
//   SEÇİM    — K0 mevcut tasarım; K1… dört kesin kriteri sağlayanlar (önce bütün açık
//              kısıtları sağlayanlar, sonra toplam ihlal küçükten büyüğe); kesin kriteri
//              bozan kombinasyon listede yok; listenin ilki En uygun
//   TEK YOL  — konfigürasyon sayfasının yer değiştirmeleri, modları ve TR'si o kombinasyon
//              modele uygulanıp Çözücü'yle çözülünce bulunanın AYNISI
//   TARAMA   — çözülen her kombinasyon bir satır; dört kriter penceresinin hükmü
//   ONAY     — Canlı Not'ta onaylanan Excel'in (R12) konfigürasyonları ve K1'i
//   KOŞUCU   — dilim dilim, ilerleme eylem satırında; eskimiş taramadan Excel üretilmez
const H = require('../helpers/takoz-dogrulama.js');
const { cp, rp } = H.kur();
Object.keys(cp).forEach((k) => { if (global[k] === undefined) global[k] = cp[k]; });
Object.keys(rp).forEach((k) => { if (global[k] === undefined) global[k] = rp[k]; });
global.veMntKatalog = require('../../js/mount-katalog.js');
const P = require('../../js/cp-mount-param.js');
Object.keys(P).forEach((k) => { if (global[k] === undefined) global[k] = P[k]; });
global.veSayi = global.veSayi || require('../../js/sayi.js').veSayi;
global.veMntParamCiz = require('../../js/mount-param-ciz.js');
global.veXlsxYaz = require('../../js/xlsx-yaz.js');
global.veMntParamExcel = require('../../js/mount-param-excel.js');
const PS = require('../../js/cp-mount-param-sonuc.js');
Object.keys(PS).forEach((k) => { if (global[k] === undefined) global[k] = PS[k]; });
global.veIkon = global.veIkon || require('../../js/ikon.js').veIkon;
global.veDurumIkon = global.veDurumIkon || require('../../js/ikon.js').veDurumIkon;
const R = require('../../js/xlsx-read.js');
const K = global.veMntKatalog;

const TOPO = H.ornek('tta10');
let Hz, ent, bayt, wb, NODES;
beforeAll(async () => {
  global.nodes = JSON.parse(JSON.stringify(TOPO.nodes));
  global.connections = TOPO.connections || [];
  global.nodes.push({ id: 'pa', type: 'mnt-parametric', data: {} });
  NODES = global.nodes;
  Hz = P._mntParamHazirlik(global.nodes.find((n) => n.id === 'pa'));
  const O = P._mntParamOlcucu(Hz.M, K.baglam(Hz.ctx));
  const it = K.tarayici({ G: Hz.M.G, adaylar: Hz.aday, sabit: Hz.sabit, ctx: Hz.ctx, olc1: O.olc1, olc2: O.olc2, enIyi: 25, tam: true });
  it.adim(Infinity);
  PS._mntParamSonucKaydet('pa', Hz, O, it.depo());
  ent = PS._MNT_PARAM_SONUC.pa;
  bayt = await PS.veMntParamExcelIndir('pa');
  wb = R.veXlsOpen(bayt);
}, 120000);

const satirlar = (ad) => wb.readSheet(wb.sheets.findIndex((s) => s.name === ad)).rows;

describe('SEÇİM ve ONAY', () => {
  test('sayfalar: Özet, Tarama, K0 mevcut ve dokuz konfigürasyon (onaylanan R12\'nin dokuzu)', () => {
    const ad = wb.sheets.map((s) => s.name);
    expect(ad.slice(0, 3)).toEqual(['Özet', 'Tarama', 'K0 Mevcut']);
    expect(ad).toHaveLength(12);
    const oz = satirlar('Özet');
    const cift = oz.slice(5, 14).map((r) => r[3] + ' + ' + r[4]).sort();
    expect(cift).toEqual([
      'Cone 39 40 ShA (AMC 137981) + 57RS313773 (A26)', 'LMT-1433-00 40 ShA + Cone 39 50 ShA (AMC 137982)',
      'LMT-1433-00 55 ShA + 57RS313773 (A26)', 'LMT-1433-00 55 ShA + Cone 39 50 ShA (AMC 137982)',
      'Mount 1 40 ShA + Cone 39 50 ShA (AMC 137982)', 'Mount 1 55 ShA + Cone 39 50 ShA (AMC 137982)',
      'Mount 1 70 ShA + Cone 39 50 ShA (AMC 137982)', 'TK035 35 ShA (57RS328045) + Mount 1 55 ShA',
      'TK040 45 ShA (57RS329001M) + Cone 121 NP 55 ShA (AMC 137829)'].sort());
  });

  test('K0 mevcut: 1b uygun değil; K1 en uygun = LMT-1433-00 55 ShA + 57RS313773 (A26) (R12\'nin önerisi)', () => {
    const oz = satirlar('Özet');
    expect(oz[4].slice(1, 10)).toEqual(['K0', 'K0 Mevcut', '57RS313774', '57RS313773', 'Uygun değil', 'Uygun', 'Uygun', 'Uygun değil', 'Uygun']);
    expect(oz[4][10]).toBeCloseTo(-0.4885, 4);
    expect(oz[5].slice(1, 10)).toEqual(['K1', 'K1 LMT-55 + 57RS313773 A26', 'LMT-1433-00 55 ShA', '57RS313773 (A26)', 'En uygun', 'Uygun', 'Uygun', 'Uygun', 'Uygun']);
    expect(oz[5][10]).toBeCloseTo(0.281, 3);
    expect(oz[5][11]).toBeCloseTo(8.8119, 3);
  });

  test('listede kesin kriteri bozan yok; sıra toplam ihlale göre', () => {
    const oz = satirlar('Özet').slice(5, 14);
    oz.forEach((r) => expect(r.slice(6, 10)).toEqual(['Uygun', 'Uygun', 'Uygun', 'Uygun']));
    oz.slice(1).forEach((r) => expect(r[5]).toMatch(/^(Uygun|Kısmen uygun)$/));
    const c = K.baglam(Hz.ctx), Hk = K.hukumler(ent.D, c);
    const idx = (t) => ent.D.indeks(t.map((k) => ent.D.adaylar.findIndex((a) => a.key === k)));
    const ad2key = {};
    ent.D.adaylar.forEach((a) => { ad2key[a.name] = a.key; });
    const v = oz.map((r) => { const x = idx([ad2key[r[3]], ad2key[r[4]]]); return Hk.v1[x] + Hk.v2[x]; });
    for (let i = 1; i < v.length; i++) expect(v[i]).toBeGreaterThanOrEqual(v[i - 1]);
  });
});

describe('TEK YOL — konfigürasyon sayfası Çözücü\'nün bulduğu', () => {
  test('K1: 14 yük durumunda üç takozun X/Y/Z yer değiştirmesi, altı mod ve TR birebir', () => {
    const t = JSON.parse(JSON.stringify(TOPO));
    const tip = ['lmt1433-00-55sh', '57RS313773'];
    Hz.M.G.forEach((g, gi) => g.idler.forEach((id) => cp._mntLibUygula(t.nodes.find((n) => n.id === id).data, tip[gi])));
    const Rz = H.coz(t);
    const k1 = satirlar('K1 LMT-55 + 57RS313773 A26');
    const vaka = Rz.allCases.filter((rc) => Rz.loadCases ? true : true).slice(0, 14);
    let n = 0;
    vaka.forEach((rc, q) => {
      const r = k1[8 + q];
      expect(r[2]).toBe(rc.name);
      rc.res.perMount.forEach((pm, i) => [0, 1, 2].forEach((j) => {
        expect(Math.abs(r[3 + 4 * i + j] - pm.delta[j] * 1000)).toBeLessThan(1e-9); n++;
      }));
    });
    expect(n).toBe(14 * 9);
    const mh = 8 + 14 + 4;
    Rz.modes.forEach((m, i) => expect(Math.abs(k1[mh + 1 + i][3] - m.f_Hz)).toBeLessThan(1e-9));
    expect(k1[mh][1]).toBe('Mod');
    expect(k1[mh + 6 + 3][1]).toBe('TR (%)');
    expect(Math.abs(k1[mh + 6 + 3][2] - rp._mntRepIsolation(Rz, rp.veMntRaporOpts()).T * 100)).toBeLessThan(1e-9);
  });
});

describe('TARAMA', () => {
  test('576 çözülen kombinasyon; dört kriteri sağlayan 9 başta; kriter işareti pencerenin hükmü', () => {
    const ta = satirlar('Tarama');
    expect(ta[0][0]).toBe('Tarama — 576 kombinasyon (Ön takoz × Sağ/Sol arka takoz)');
    const L = ta.slice(5).filter((r) => r[0] != null);
    expect(L).toHaveLength(576);
    const dort = L.map((r) => r[16]);
    expect(dort.filter((v) => v === 'Uygun')).toHaveLength(9);
    expect(dort.slice(0, 9).every((v) => v === 'Uygun')).toBe(true);
    L.forEach((r) => expect(r[16] === 'Uygun').toBe(r.slice(12, 16).every((v) => v === '✓')));
  });
});

describe('AD ve DOSYA', () => {
  test('"ASR" dosyanın hiçbir parçasında yok; ızgara kapalı, gizli satır/sütun', () => {
    const z = R.veXlsZipRead(bayt);
    z.names.forEach((ad) => {
      const m = R.veXlsUtf8(z.read(ad));
      expect([ad, /ASR/.test(m)]).toEqual([ad, false]);
      if (/worksheets\/sheet\d+\.xml$/.test(ad)) {
        expect(m).toContain('showGridLines="0"');
        expect(m).toContain('zeroHeight="1"');
      }
    });
  });
});

describe('KOŞUCU', () => {
  beforeEach(() => { global.nodes = NODES; global.connections = TOPO.connections || []; });   // TEK YOL çözümü düğüm listesini değiştirir
  test('dilim dilim: ilerleme eylem satırında (Excel · Satır i / n); sürerken ikinci istek yok sayılır', async () => {
    const PK = require('../../js/pencere-kabuk.js');
    global.vePencereEylem = PK.vePencereEylem;
    global.vePencereIlerleme = PK.vePencereIlerleme;
    global.vePencereIlerlemeHTML = PK.vePencereIlerlemeHTML;
    const n = global.nodes.find((x) => x.id === 'pa');
    document.body.innerHTML = '<div class="ve-properties-content">' + P.getMntParamPropertiesHTML(n) + '</div>';
    expect(document.querySelector('.ve-fp-kat[data-k="sonuc"] button[data-excel]').textContent).toMatch(/Excel’i indir/);
    const p1 = PS.veMntParamExcelIndir('pa');
    const p2 = await PS.veMntParamExcelIndir('pa');
    expect(p2).toBeNull();
    const il = P._mntParamIlerleme('pa');
    expect(il.ad).toBe('Excel');
    expect(il.metin).toMatch(/^Satır [\d.]+ \/ [\d.]+$/);
    const b = await p1;
    expect(b && b.length).toBeGreaterThan(1000);
    expect(P._mntParamIlerleme('pa')).toBeNull();
    expect(document.getElementById('ve-mnt-param-st-pa').textContent).toMatch(/^İndirildi \([\d.]+ KB\)$/);
  });

  test('tarama eskiyince (model değişti) Excel üretilmez, sebebi yazılır', async () => {
    const tk = global.nodes.find((x) => x.type === 'mnt-mount');
    const eski = tk.data.x;
    tk.data.x = Number(eski) + 50;
    try {
      expect(await PS.veMntParamExcelIndir('pa')).toBeNull();
      expect(document.getElementById('ve-mnt-param-st-pa').textContent).toBe('Taramadan sonra girdi değişti');
    } finally { tk.data.x = eski; }
  });
});
