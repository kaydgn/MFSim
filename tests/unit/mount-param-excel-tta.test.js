/**
 * @jest-environment jsdom
 */
// TAKOZ · PARAMETRİK ANALİZ — EXCEL ÇIKTISI, GERÇEK MODEL (10 Ton TTA)
// Kapılar (js/cp-mount-param-sonuc.js → veMntParamExcelIndir · _mntParamExcelPlan):
//   SEÇİM    — K0 mevcut tasarım; K1… dört kesin kriteri sağlayanlar, STATİK SEHİM
//              küçükten büyüğe (kullanıcı 2026-11-10); kesin kriteri bozan listede yok;
//              listenin ilki En uygun, kalanı Uygun
//   TEK YOL  — K blokunun ve Veri'deki HER tarama satırının yer değiştirmeleri, modları ve
//              TR'si o kombinasyon modele uygulanıp Çözücü'yle çözülünce bulunanın aynısı
//   TARAMA   — çözülen her kombinasyon bir satır; sağlanan kriter sayısı, sonra statik sehim
//   PANO     — Sonuç'un önbelleği Veri'nin ilk satırı; süzgeç formülü Tarama'nın tamamını görür
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

// ONAY: Canlı Not'ta onaylanan Excel (R12) 10 Ton TTA'nın ilk kitabındaki üç takozlu
// kurulumdan üretildi; örnek 2026-11-10'da föyün altı takozuna geçti (Canlı Not 68).
// Onaylanan sayılar o kurulumun — dondurulmuş topolojisiyle koşar.
const TOPO = JSON.parse(require('fs').readFileSync(require('path').join(__dirname, '../fixtures/tta10-uc-nokta-topoloji.json'), 'utf8'));
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
const ad2key = () => { const m = {}; ent.D.adaylar.forEach((a) => { m[a.name] = a.key; }); return m; };
// Kombinasyonu modelin KOPYASINA uygula ve Çözücü'yle çöz.
function coz(tip) {
  const t = JSON.parse(JSON.stringify(TOPO));
  Hz.M.G.forEach((g, gi) => g.idler.forEach((id) => cp._mntLibUygula(t.nodes.find((n) => n.id === id).data, tip[gi])));
  return H.coz(t);
}
const kesinBit = () => { let b = 0; K.KISITLAR.forEach((Q, i) => { if (Q.zorunlu) b |= (1 << i) >>> 0; }); return b; };

describe('SEÇİM ve ONAY', () => {
  test('sayfalar: Özet, Tarama, Sonuç ve gizli Veri; konfigürasyon sayfası yok', () => {
    expect(wb.sheets.map((s) => s.name)).toEqual(['Özet', 'Tarama', 'Sonuç', 'Veri']);
    const z = R.veXlsZipRead(bayt), w = R.veXlsUtf8(z.read('xl/workbook.xml'));
    expect(w).toContain('name="Veri" sheetId="4" state="hidden"');
  });

  test('K1–K9: onaylanan R12\'nin dokuzu, statik sehim küçükten büyüğe; K1 en uygun, kalanı uygun', () => {
    const oz = satirlar('Özet').slice(5, 14);
    expect(oz.map((r) => r[3] + ' + ' + r[4]).sort()).toEqual([
      'Cone 39 40 ShA (AMC 137981) + 57RS313773 (A26)', 'LMT-1433-00 40 ShA + Cone 39 50 ShA (AMC 137982)',
      'LMT-1433-00 55 ShA + 57RS313773 (A26)', 'LMT-1433-00 55 ShA + Cone 39 50 ShA (AMC 137982)',
      'Mount 1 40 ShA + Cone 39 50 ShA (AMC 137982)', 'Mount 1 55 ShA + Cone 39 50 ShA (AMC 137982)',
      'Mount 1 70 ShA + Cone 39 50 ShA (AMC 137982)', 'TK035 35 ShA (57RS328045) + Mount 1 55 ShA',
      'TK040 45 ShA (57RS329001M) + Cone 121 NP 55 ShA (AMC 137829)'].sort());
    const d = oz.map((r) => r[6]);
    for (let i = 1; i < d.length; i++) expect(d[i]).toBeGreaterThanOrEqual(d[i - 1]);
    expect(oz[0].slice(1, 6)).toEqual(['K1', 'K1 TK040-45 + Cone121NP-55', 'TK040 45 ShA (57RS329001M)', 'Cone 121 NP 55 ShA (AMC 137829)', 'En uygun']);
    expect(oz[0][6]).toBeCloseTo(5.9178, 3);
    oz.slice(1).forEach((r) => expect(r[5]).toBe('Uygun'));
    oz.forEach((r) => expect(r.slice(7, 11)).toEqual(['Uygun', 'Uygun', 'Uygun', 'Uygun']));
  });

  test('statik sehim taramanın ölçüsü (δ_s = max |δz|, 1 g) ve K0 kesin kriteri bozuyor', () => {
    const m = ad2key(), oz = satirlar('Özet');
    oz.slice(5, 14).forEach((r) => {
      const x = ent.D.indeks([r[3], r[4]].map((ad) => ent.D.adaylar.findIndex((a) => a.key === m[ad])));
      expect(r[6]).toBeCloseTo(ent.D.d[x], 9);
    });
    expect(oz[4].slice(1, 6)).toEqual(['K0', 'K0 Mevcut', '57RS313774', '57RS313773', 'Uygun değil']);
    expect(oz[4].slice(7, 11)).toEqual(['Uygun', 'Uygun', 'Uygun değil', 'Uygun']);
  });
});

describe('TEK YOL — Excel Çözücü\'nün bulduğu', () => {
  test('K1 bloku: 14 yük durumunda üç takozun X/Y/Z yer değiştirmesi, altı mod ve TR birebir', () => {
    const son = satirlar('Sonuç');
    const b = son.findIndex((r) => typeof r[2] === 'string' && r[2].startsWith('K1 — '));
    expect(b).toBeGreaterThan(40);
    const m = ad2key(), tip = [m['TK040 45 ShA (57RS329001M)'], m['Cone 121 NP 55 ShA (AMC 137829)']];
    const Rk = coz(tip);
    let n = 0;
    Rk.allCases.slice(0, 14).forEach((rc, q) => {
      const r = son[b + 7 + q];
      expect(r[2]).toBe(rc.name);
      rc.res.perMount.forEach((pm, i) => [0, 1, 2].forEach((j) => {
        expect(Math.abs(r[3 + 4 * i + j] - pm.delta[j] * 1000)).toBeLessThan(1e-9); n++;
      }));
    });
    expect(n).toBe(14 * 9);
    const mh = b + 7 + 14 + 4;
    expect(son[mh][1]).toBe('Mod');
    Rk.modes.forEach((md, i) => expect(Math.abs(son[mh + 1 + i][3] - md.f_Hz)).toBeLessThan(1e-9));
    expect(son[mh + 6 + 3][1]).toBe('TR (%)');
    expect(Math.abs(son[mh + 6 + 3][2] - rp._mntRepIsolation(Rk, rp.veMntRaporOpts()).T * 100)).toBeLessThan(1e-9);
  });

  test('Veri: örneklenen tarama satırlarının tam sonucu Çözücü\'nün (mm/100 · 0,001 Hz)', () => {
    const veri = satirlar('Veri'), ta = satirlar('Tarama'), m = ad2key();
    const bas = veri[0], cV = bas.indexOf('Static [mm/100]'), cM = bas.indexOf('Mod 1 [Hz]'), cT = bas.indexOf('TR [%]');
    expect(veri).toHaveLength(577);
    [1, 2, 9, 10, 137, 300, 576].forEach((no) => {
      const r = veri[no], tr = ta[4 + no];
      expect([r[0], tr[0]]).toEqual([no, no]);
      expect([r[1], r[2]]).toEqual([tr[1], tr[2]]);                         // Tarama'nın satırıyla aynı kombinasyon
      const Rz = coz([m[r[1]], m[r[2]]]);
      Rz.allCases.slice(0, 14).forEach((rc, q) => {
        const t = String(r[cV + q]).split(';').map(Number);
        rc.res.perMount.forEach((pm, i) => [0, 1, 2].forEach((j) => {
          expect(Math.abs(t[3 * i + j] / 100 - pm.delta[j] * 1000)).toBeLessThanOrEqual(0.005 + 1e-9);
        }));
      });
      const f = Rz.modes.map((md) => md.f_Hz).sort((a, b) => a - b);
      f.forEach((v, j) => expect(Math.abs(r[cM + j] - v)).toBeLessThanOrEqual(0.0005 + 1e-12));
      expect(Math.abs(r[cT] - rp._mntRepIsolation(Rz, rp.veMntRaporOpts()).T * 100)).toBeLessThan(1e-4);
    });
  }, 60000);
});

describe('TARAMA', () => {
  test('576 çözülen kombinasyon; dört kriteri sağlayan 9 başta ve K1–K9 sırasında; sonra kriter sayısı ve sehim', () => {
    const ta = satirlar('Tarama');
    expect(ta[0][0]).toBe('Tarama — 576 kombinasyon (Ön takoz × Sağ/Sol arka takoz)');
    const L = ta.slice(5).filter((r) => r[0] != null);
    expect(L).toHaveLength(576);
    const iK = ta[4].indexOf('Kriter 1'), iD = ta[4].indexOf('Statik sehim [mm]'), iH = ta[4].indexOf('Dört kriter');
    expect(L.filter((r) => r[iH] === 'Uygun')).toHaveLength(9);
    const oz = satirlar('Özet').slice(5, 14);
    expect(L.slice(0, 9).map((r) => r[1] + ' + ' + r[2])).toEqual(oz.map((r) => r[3] + ' + ' + r[4]));
    const gec = (r) => r.slice(iK, iK + 4).filter((v) => v === '✓').length;
    for (let i = 1; i < L.length; i++) {
      const a = L[i - 1], b = L[i];
      expect(gec(a) > gec(b) || (gec(a) === gec(b) && a[iD] <= b[iD] + 1e-9)).toBe(true);
    }
    L.forEach((r) => expect(r[iH] === 'Uygun').toBe(r.slice(iK, iK + 4).every((v) => v === '✓')));
    const kb = kesinBit(), Hk = PS._mntParamOzet(ent, K.baglam(Hz.ctx)).Hk;
    let say = 0;
    for (let x = 0; x < ent.D.N; x++) if (ent.D.d1[x] === 1 && !(Hk.m[x] & kb)) say++;
    expect(say).toBe(9);
  });
});

describe('PANO — Sonuç\'un seçili kombinasyonu', () => {
  test('önbellek Veri\'nin ilk satırı (K1 ile aynı kombinasyon); süzgeç formülü Tarama\'nın 576 satırını görür', () => {
    const son = satirlar('Sonuç'), veri = satirlar('Veri');
    expect(son[1][2]).toBe('No 1 — Ön takoz: TK040 45 ShA (57RS329001M) · Sağ/Sol arka takoz: Cone 121 NP 55 ShA (AMC 137829)');
    expect([son[5][3], son[7][3]]).toEqual([1, 1]);
    const t = String(veri[1][veri[0].indexOf('Static [mm/100]')]).split(';').map(Number);
    expect(son[15][2]).toBe('Static');
    [0, 1, 2].forEach((i) => [0, 1, 2].forEach((j) => expect(son[15][3 + 4 * i + j]).toBeCloseTo(t[3 * i + j] / 100, 9)));
    const z = R.veXlsZipRead(bayt), s3 = R.veXlsUtf8(z.read('xl/worksheets/sheet3.xml'));
    expect(s3).toContain('SUBTOTAL(103,OFFSET(\'Tarama\'!$A$6,ROW(\'Tarama\'!$A$6:$A$581)-ROW(\'Tarama\'!$A$6),0))');
    expect(s3).toContain('INDEX(\'Veri\'!$X$2:$X$577,$D$6)');
  });
});

describe('AD ve DOSYA', () => {
  test('"ASR" dosyanın hiçbir parçasında yok; ızgara kapalı, gizli satır/sütun', () => {
    const z = R.veXlsZipRead(bayt);
    z.names.forEach((ad) => {
      const m = R.veXlsUtf8(z.read(ad));
      expect([ad, /ASR/.test(m)]).toEqual([ad, false]);
      if (/worksheets\/sheet[123]\.xml$/.test(ad)) {
        expect(m).toContain('showGridLines="0"');
        expect(m).toContain('zeroHeight="1"');
      }
    });
  });
});

describe('KOŞUCU', () => {
  beforeEach(() => { global.nodes = NODES; global.connections = TOPO.connections || []; });   // TEK YOL çözümü düğüm listesini değiştirir
  test('dilim dilim: ilerleme eylem satırında (Excel · Satır i / n, sonra Dosya); sürerken ikinci istek yok sayılır', async () => {
    const PK = require('../../js/pencere-kabuk.js');
    global.vePencereEylem = PK.vePencereEylem;
    const iz = [];                                                                // çubuğun her yazımı: metin · oran
    global.vePencereIlerleme = (id, il) => { if (il) iz.push([il.metin, il.oran]); return PK.vePencereIlerleme(id, il); };
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
    // çubuk: önce satırların çözümü (%0–70), sonra kitap ve dosya (%70–100); hiç geri gitmez
    expect(iz.some((x) => /^Satır /.test(x[0]))).toBe(true);
    expect(iz[iz.length - 1]).toEqual(['Dosya', 1]);
    for (let i = 1; i < iz.length; i++) expect(iz[i][1]).toBeGreaterThanOrEqual(iz[i - 1][1]);
    iz.forEach((x) => expect(x[0] === 'Dosya' ? x[1] >= 0.7 : x[1] <= 0.7).toBe(true));
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
