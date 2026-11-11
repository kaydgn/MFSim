/**
 * @jest-environment jsdom
 */
// TAKOZ · PARAMETRİK ANALİZ — EXCEL ÇIKTISI, GERÇEK MODEL (10 Ton TTA)
// Kapılar (js/cp-mount-param-sonuc.js → veMntParamExcelIndir · _mntParamExcelPlan):
//   SEÇİM    — K0 mevcut tasarım; K1… dört kesin kriteri sağlayanlar, STATİK SEHİM
//              küçükten büyüğe (kullanıcı 2026-11-10); kesin kriteri bozan listede yok;
//              listenin ilki En uygun, kalanı Uygun
//   TEK YOL  — Sonuç'taki K bloklarının ve tarama satırlarının bloklarının yer değiştirmeleri,
//              modları ve TR'si o kombinasyon modele uygulanıp Çözücü'yle çözülünce bulunanın aynısı
//   TARAMA   — çözülen her kombinasyon bir satır; sağlanan kriter sayısı, sonra statik sehim
//   TIKLA    — Tarama'nın HER satırının No'su ve tipleri kendi bloğunun şeridine (başlığı o No ve
//              tipler); Özet'in K'sı kendi bloğuna; Sonuç'un başı boş (sekmeden açılınca)
//   KOŞUCU   — dilim dilim, ilerleme eylem satırında; eskimiş taramadan Excel üretilmez
//   HTML     — HTML raporu (js/mount-param-html.js) Excel'in PLANINDAN: K'lar, Tarama'nın
//              satırları ve Veri kodunun her değeri birebir; dilim dilim, çubukta "HTML";
//              künyenin başı (araç · motor · şanzıman) programdan, Excel'in girdisinde yok (Canlı not 2008)
const H = require('../helpers/takoz-dogrulama.js');
const { cp, rp } = H.kur();
// KATALOG ONAY ANINDAKİ 24 TİP: tarama testleri kütüphanenin ilk 24 girdisiyle (2026-11-10'a
// dek tam tiplerin hepsi) koşar — beklenen sayılar ve onaylı Excel o kümenin. Teknik
// resimlerle tamamlanan AMC kodları (137061 · 137062 · 137961) adayları 27'ye çıkarır;
// o sayı mount-amc.test.js → PARAMETRİK'te kilitli.
Object.keys(cp.VE_MOUNT_LIBRARY).slice(24).forEach((k) => { delete cp.VE_MOUNT_LIBRARY[k]; });
// Canlı Not 133 dört 57RS tipini taramanın adaylığından çıkardı (`aday:false`); donmuş kümede
// aday kalırlar — beklenen sayılar ve onaylı Excel o kümenin. Adaylıktan çıkış kapısı:
// mount-param.test.js → ADAY OLMAYAN TİP.
Object.keys(cp.VE_MOUNT_LIBRARY).forEach((k) => { delete cp.VE_MOUNT_LIBRARY[k].aday; });
Object.keys(cp).forEach((k) => { if (global[k] === undefined) global[k] = cp[k]; });
Object.keys(rp).forEach((k) => { if (global[k] === undefined) global[k] = rp[k]; });
global.veMntKatalog = require('../../js/mount-katalog.js');
const P = require('../../js/cp-mount-param.js');
Object.keys(P).forEach((k) => { if (global[k] === undefined) global[k] = P[k]; });
global.veSayi = global.veSayi || require('../../js/sayi.js').veSayi;
global.veMntParamCiz = require('../../js/mount-param-ciz.js');
global.veXlsxYaz = require('../../js/xlsx-yaz.js');
global.veMntParamExcel = require('../../js/mount-param-excel.js');
global.veMntParamHtml = require('../../js/mount-param-html.js');
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
// Sonuç'un düzeni (14 yük durumu, 6 mod): blok boyu 36, adım 38; j. bloğun ilk satırı 7 + 38j,
// başlığı bir altında (0 tabanlı dizin 7 + 38j). K0–K9 j = 0…9, Tarama'nın No'su n → j = 9 + n.
const ADIM = 38, ILK = (j) => 7 + ADIM * j, BI = (j) => ILK(j), SERIT = (j) => '$A$' + ILK(j) + ':$A$' + (ILK(j) + 35);
// Excel adı "ASR…" eki olmadan yazar ("57RS313773 (ASR-SR-116)" → "57RS313773"): ikisi de anahtara.
const ad2key = () => { const m = {}; ent.D.adaylar.forEach((a) => { m[a.name] = a.key; m[global.veMntParamExcel.temiz(a.name)] = a.key; }); return m; };
// Kombinasyonu modelin KOPYASINA uygula ve Çözücü'yle çöz.
function coz(tip) {
  const t = JSON.parse(JSON.stringify(TOPO));
  Hz.M.G.forEach((g, gi) => g.idler.forEach((id) => cp._mntLibUygula(t.nodes.find((n) => n.id === id).data, tip[gi])));
  return H.coz(t);
}
const kesinBit = () => { let b = 0; K.KISITLAR.forEach((Q, i) => { if (Q.zorunlu) b |= (1 << i) >>> 0; }); return b; };

describe('SEÇİM ve ONAY', () => {
  test('sayfalar: Özet, Tarama, Sonuç — sekmeler görünür, gizli sayfa yok', () => {
    expect(wb.sheets.map((s) => s.name)).toEqual(['Özet', 'Tarama', 'Sonuç']);
    const z = R.veXlsZipRead(bayt), w = R.veXlsUtf8(z.read('xl/workbook.xml'));
    expect(w).not.toMatch(/state="hidden"|showSheetTabs/);
    // Özet'in K ve ad hücresi Sonuç'taki K bloğunun şeridine; Tarama'ya düğme
    const s1 = R.veXlsUtf8(z.read('xl/worksheets/sheet1.xml'));
    for (let k = 0; k < 10; k++) {
      expect(s1).toContain('<hyperlink ref="B' + (7 + k) + '" location="\'Sonuç\'!' + SERIT(k) + '"/>');
      expect(s1).toContain('<hyperlink ref="C' + (7 + k) + '" location="\'Sonuç\'!' + SERIT(k) + '"/>');
    }
    expect(s1).toContain('<hyperlink ref="C4" location="\'Tarama\'!A1"/>');
  });

  test('K1–K9: onaylanan R12\'nin dokuzu, statik sehim küçükten büyüğe; K1 en uygun, kalanı uygun', () => {
    const oz = satirlar('Özet').slice(7, 16);
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
    oz.slice(7, 16).forEach((r) => {
      const x = ent.D.indeks([r[3], r[4]].map((ad) => ent.D.adaylar.findIndex((a) => a.key === m[ad])));
      expect(r[6]).toBeCloseTo(ent.D.d[x], 9);
    });
    expect(oz[6].slice(1, 6)).toEqual(['K0', 'K0 Mevcut', '57RS313774', '57RS313773', 'Uygun değil']);
    expect(oz[6].slice(7, 11)).toEqual(['Uygun', 'Uygun', 'Uygun değil', 'Uygun']);
  });
});

describe('TEK YOL — Excel Çözücü\'nün bulduğu', () => {
  test('K0–K9 blokları: 14 yük durumunda üç takozun X/Y/Z yer değiştirmesi, altı mod ve TR birebir', () => {
    const m = ad2key(), oz = satirlar('Özet');
    let n = 0;
    const son = satirlar('Sonuç');
    for (let k = 0; k <= 9; k++) {
      const r0 = oz[6 + k], b = BI(k);
      expect(r0[1]).toBe('K' + k);
      expect(son[b][2]).toBe('K' + k + ' — Ön takoz: ' + r0[3] + ' · Sağ/Sol arka takoz: ' + r0[4]);
      const Rk = k ? coz([m[r0[3]], m[r0[4]]]) : H.coz(JSON.parse(JSON.stringify(TOPO)));   // K0: modelin kendisi
      Rk.allCases.slice(0, 14).forEach((rc, q) => {
        const r = son[b + 7 + q];
        expect(r[2]).toBe(rc.name);
        rc.res.perMount.forEach((pm, i) => [0, 1, 2].forEach((j) => {
          expect(Math.abs(r[3 + 4 * i + j] - pm.delta[j] * 1000)).toBeLessThan(1e-9); n++;
        }));
      });
      const mh = b + 7 + 14 + 4;
      expect(son[mh][1]).toBe('Mod');
      Rk.modes.forEach((md, i) => expect(Math.abs(son[mh + 1 + i][3] - md.f_Hz)).toBeLessThan(1e-9));
      expect(son[mh + 6 + 3][1]).toBe('TR (%)');
      expect(Math.abs(son[mh + 6 + 3][2] - rp._mntRepIsolation(Rk, rp.veMntRaporOpts()).T * 100)).toBeLessThan(1e-9);
    }
    expect(n).toBe(10 * 14 * 9);
  }, 60000);

  test('tarama satırlarının blokları: örneklenen satırların sonucu Çözücü\'nün (mm/100), modlar ve TR', () => {
    const son = satirlar('Sonuç'), ta = satirlar('Tarama'), m = ad2key();
    let n = 0;
    [1, 2, 9, 10, 137, 300, 576].forEach((no) => {
      const tr = ta[4 + no], b = BI(9 + no);
      expect(tr[0]).toBe(no);
      expect(son[b][2]).toBe('No ' + no + ' — Ön takoz: ' + tr[1] + ' · Sağ/Sol arka takoz: ' + tr[2]);
      expect([son[b + 4][4], son[b + 4][8], son[b + 4][12]]).toEqual([tr[1], tr[2], tr[2]]);   // takoz başına tip (ortadaki sütun)
      const Rz = coz([m[tr[1]], m[tr[2]]]);
      Rz.allCases.slice(0, 14).forEach((rc, q) => {
        const r = son[b + 7 + q];
        expect(r[2]).toBe(rc.name);
        rc.res.perMount.forEach((pm, i) => [0, 1, 2].forEach((j) => {
          expect(Math.abs(r[3 + 4 * i + j] - pm.delta[j] * 1000)).toBeLessThanOrEqual(0.005 + 1e-9); n++;
        }));
      });
      const mh = b + 7 + 14 + 4, f = Rz.modes.map((md) => md.f_Hz).sort((a, c) => a - c);
      expect(son[mh][1]).toBe('Mod');
      f.forEach((v, j) => expect(Math.abs(son[mh + 1 + j][3] - v)).toBeLessThan(1e-9));
      expect(Math.abs(son[mh + 6 + 3][2] - rp._mntRepIsolation(Rz, rp.veMntRaporOpts()).T * 100)).toBeLessThan(1e-9);
    });
    expect(n).toBe(7 * 14 * 9);
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
    const oz = satirlar('Özet').slice(7, 16);
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

describe('TIKLA — konfigürasyonun yazısı Sonuç\'taki bloğunu açar', () => {
  test('Tarama\'nın 576 satırının her birinde No ve iki tip mavi bağlantı: hedef kendi bloğunun şeridi', () => {
    const z = R.veXlsZipRead(bayt), s2 = R.veXlsUtf8(z.read('xl/worksheets/sheet2.xml')), ta = satirlar('Tarama'), son = satirlar('Sonuç');
    const F = {};
    for (const m of s2.matchAll(/<c r="([A-C])(\d+)"[^>]*><f>HYPERLINK\(&quot;#'Sonuç'!\$A\$(\d+):\$A\$(\d+)&quot;,(?:&quot;[^<]*&quot;|\d+)\)<\/f>/g)) {
      (F[m[2]] || (F[m[2]] = [])).push([m[1], +m[3], +m[4]]);
    }
    for (let no = 1; no <= 576; no++) {
      const r = 5 + no, L = F[r] || [];
      expect([no, L.map((x) => x[0]).join('')]).toEqual([no, 'ABC']);
      L.forEach((x) => expect([no, x[1], x[2]]).toEqual([no, ILK(9 + no), ILK(9 + no) + 35]));
      const tr = ta[r - 1];
      expect([no, son[ILK(9 + no)][2]]).toEqual([no, 'No ' + no + ' — Ön takoz: ' + tr[1] + ' · Sağ/Sol arka takoz: ' + tr[2]]);
    }
    expect(Object.keys(F)).toHaveLength(576);
  });

  test('Sonuç sekmeden açılınca boş: yönlendirme ve iki düğme, ardından iki yüksek boş satır; son blok TR\'de biter', () => {
    const son = satirlar('Sonuç'), z = R.veXlsZipRead(bayt), s3 = R.veXlsUtf8(z.read('xl/worksheets/sheet3.xml'));
    expect(son[1][2]).toBe('Özet’te ya da Tarama’da konfigürasyonu seçin.');
    expect(son.slice(4, 7).every((r) => r.every((v) => v == null || v === ''))).toBe(true);
    expect(s3).toContain('<row r="5" ht="409" customHeight="1"/>');
    expect(s3).not.toContain('zeroHeight');                                     // yalnız yazılan satırlar
    expect(s3).not.toContain('<mergeCells');
    expect(s3).toMatch(/<dimension ref="A1:[A-Z]+22274"\/>/);                    // 6 + (10 K + 576) · 38
    expect(son[BI(585) + 7 + 14 + 4 + 6 + 3][1]).toBe('TR (%)');
  });
});

describe('AD ve DOSYA', () => {
  test('"ASR" dosyanın hiçbir parçasında yok; ızgara kapalı, kullanılmayan sütun gizli, satır Özet ve Tarama\'da', () => {
    const z = R.veXlsZipRead(bayt);
    z.names.forEach((ad) => {
      const m = R.veXlsUtf8(z.read(ad));
      expect([ad, /ASR/.test(m)]).toEqual([ad, false]);
      const no = /worksheets\/sheet(\d+)\.xml$/.exec(ad);
      if (no) {                                                        // Özet · Tarama · Sonuç
        expect(m).toContain('showGridLines="0"');
        expect(m).toMatch(/max="16384" width="9.140625" hidden="1"/);
        expect([ad, m.includes('zeroHeight="1"')]).toEqual([ad, no[1] !== '3']);
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
    document.body.innerHTML = '<div class="ve-properties-content">' + P._mntParamEskiPencereHTML(n) + '</div>';
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

describe('HTML — Excel\'in planı', () => {
  beforeEach(() => { global.nodes = NODES; global.connections = TOPO.connections || []; });
  const veri = (html) => JSON.parse(/<script type="application\/json" id="ve-veri">([\s\S]*?)<\/script>/.exec(html)[1]);
  const coz = (x) => {
    const t = atob(x.b), u = new Uint8Array(t.length);
    for (let i = 0; i < t.length; i++) u[i] = t.charCodeAt(i);
    return x.t === 'i16' ? new Int16Array(u.buffer) : new Int32Array(u.buffer);
  };
  test('K\'lar, Tarama\'nın satırları ve Veri kodunun her değeri Excel\'in planıyla birebir; Özet Excel\'in Özet\'i', async () => {
    const html = await PS.veMntParamHtmlIndir('pa');
    expect(typeof html).toBe('string');
    const D = veri(html);
    const Pl = PS._mntParamExcelPlan(ent, Hz);
    Pl.adim.forEach((f) => f());
    const E = Pl.E();
    expect(D.konfig.map((k) => k.K)).toEqual(E.konfig.map((k) => k.K));
    expect(D.konfig.map((k) => k.u)).toEqual(E.konfig.map((k) => k.uygunluk));
    D.konfig.forEach((k, n) => expect(k.d).toBeCloseTo(E.konfig[n].d, 3));
    // Excel'in Özet'i: K ve Uygunluk sütunu aynı sırada
    const oz = wb.readSheet(0).rows.slice(6).filter((r) => r && /^K\d+$/.test(r[1]));
    expect(oz.map((r) => r[1])).toEqual(D.konfig.map((k) => 'K' + k.K));
    expect(D.tarama.n).toBe(E.tarama.satirlar.length);
    expect(D.tarama.N).toBe(E.tarama.N);
    D.tarama.d.forEach((v, i) => expect(v).toBeCloseTo(E.tarama.satirlar[i].d, 3));
    const kod = coz(D.tarama.kod), ref = E.tarama.veri.kod, bos = D.tarama.kod.t === 'i16' ? -32768 : -2147483648;
    expect(kod.length).toBe(ref.length);
    let fark = 0;
    for (let j = 0; j < ref.length; j++) if ((kod[j] === bos ? -2147483648 : kod[j]) !== ref[j]) fark++;
    expect(fark).toBe(0);
  });

  // Canlı not 2008 ("Buraya aracın ismini falan da yazalım. Yani bilgi versin kullanıcıya."): künyenin
  // başı programın bildiğinden — tuvalin örneği (Araç: başlangıç sayfasının adı; eskimiş anahtar başka
  // aracın adını yazmaz), 3B'nin veri sayfası (Motor modeli · Şanzıman ailesi), yoksa gövde penceresinin
  // Katalog'u (Motor · Vites konfigürasyonu); Excel'in girdisi değişmez
  test('aracın kimliği programdan: tuvalin örneği, 3B\'nin veri sayfası, yoksa pencerenin Katalog\'u; Excel\'in girdisinde yok', async () => {
    const [wz, ev, mo, sz] = ['mnt-wizard', 'mnt-viewer', 'mnt-motor', 'mnt-gearbox'].map((t) => NODES.find((n) => n.type === t));
    const yedek = [wz, ev, mo, sz].map((n) => JSON.stringify(n.data || {}));
    global.veMntStpVs = require('../../js/mount-step.js').veMntStpVs;
    global._mntEnginePresets = () => ({ ism385: { name: 'ISMe3 385 | FR20317' } });
    try {
      expect(PS._mntParamKimlik()).toEqual({ arac: null, motor: null, sanziman: null });
      wz.data = Object.assign(wz.data || {}, { ornek: 'eski-ornek' });
      expect(PS._mntParamKimlik().arac).toBeNull();
      wz.data.ornek = 'tta10';
      mo.data.enginePreset = 'ism385';
      sz.data.gearPreset = 'allison-4000:wr';
      expect(PS._mntParamKimlik()).toEqual({ arac: '10 Ton TTA', motor: 'ISMe3 385 | FR20317', sanziman: 'Allison 4000 · Wide Ratio (WR)' });
      ev.data = Object.assign(ev.data || {}, { cad: { roller: [
        { yol: ['a'], rol: 'mnt-motor', ad: 'Motor', yog: 'cummins-ism11' },
        { yol: ['b'], rol: 'mnt-gearbox', ad: 'Şanzıman', yog: 'allison-4000?dizi=wr' }] } });
      expect(PS._mntParamKimlik()).toEqual({ arac: '10 Ton TTA', motor: 'Cummins ISM11', sanziman: 'Allison 4000' });
      const html = await PS.veMntParamHtmlIndir('pa'), D = veri(html);
      expect([D.arac, D.motor, D.sanziman]).toEqual(['10 Ton TTA', 'Cummins ISM11', 'Allison 4000']);
      expect(html).toContain('<dl class="kunye"><div><dt>Araç</dt><dd>10 Ton TTA</dd></div><div><dt>Motor</dt><dd>Cummins ISM11</dd></div>');
      const Pl = PS._mntParamExcelPlan(ent, Hz);
      expect(['arac', 'motor', 'sanziman'].filter((k) => k in Pl.E())).toEqual([]);
    } finally {
      [wz, ev, mo, sz].forEach((n, i) => { n.data = JSON.parse(yedek[i]); });
      delete global.veMntStpVs; delete global._mntEnginePresets;
    }
  });

  test('dilim dilim: çubukta HTML (Satır i / n, sonra Dosya); sürerken Excel de HTML de yok sayılır; eskimiş taramadan üretilmez', async () => {
    const PK = require('../../js/pencere-kabuk.js');
    global.vePencereEylem = PK.vePencereEylem;
    const iz = [];
    global.vePencereIlerleme = (id, il) => { if (il) iz.push([il.ad, il.metin, il.oran]); return PK.vePencereIlerleme(id, il); };
    global.vePencereIlerlemeHTML = PK.vePencereIlerlemeHTML;
    const n = global.nodes.find((x) => x.id === 'pa');
    document.body.innerHTML = '<div class="ve-properties-content">' + P._mntParamEskiPencereHTML(n) + '</div>';
    expect(document.querySelector('.ve-fp-kat[data-k="sonuc"] button[data-html]').textContent).toMatch(/HTML’i indir/);
    const p1 = PS.veMntParamHtmlIndir('pa');
    expect(await PS.veMntParamHtmlIndir('pa')).toBeNull();
    expect(await PS.veMntParamExcelIndir('pa')).toBeNull();
    expect(P._mntParamIlerleme('pa').ad).toBe('HTML');
    expect((await p1).length).toBeGreaterThan(1000);
    expect(iz.every((x) => x[0] === 'HTML')).toBe(true);
    expect(iz[iz.length - 1].slice(1)).toEqual(['Dosya', 1]);
    for (let i = 1; i < iz.length; i++) expect(iz[i][2]).toBeGreaterThanOrEqual(iz[i - 1][2]);
    expect(P._mntParamIlerleme('pa')).toBeNull();
    expect(document.getElementById('ve-mnt-param-st-pa').textContent).toMatch(/^İndirildi \([\d.]+ KB\)$/);
    const tk = global.nodes.find((x) => x.type === 'mnt-mount');
    const eski = tk.data.x;
    tk.data.x = Number(eski) + 50;
    try {
      expect(await PS.veMntParamHtmlIndir('pa')).toBeNull();
      expect(document.getElementById('ve-mnt-param-st-pa').textContent).toBe('Taramadan sonra girdi değişti');
    } finally { tk.data.x = eski; }
  });
});
