/**
 * AMC Mecanocaucho® konik takoz veritabanı (js/mount-amc.js) — kaynağa karşı kapı
 * ───────────────────────────────────────────────────────────────────────────
 * Kullanıcı isteği (2026-11-10): "Bu AMC takozlarının TÜM MODELLERİNİ bulmanı ve
 * onların değerlerini bulmanı istiyorum … Sağlam bir takoz veritabanımız olmasını
 * istiyorum" · "Takoz resimlerini de al … Hepsini programa entegre edeceğiz".
 *
 * Kaynak üreticinin kendisi (mecanocaucho.com, 2026-11-10): aile sayfalarının
 * tabloları (envanter) ve yük–sehim grafikleri (eksenel rijitlik). Grafiğin her
 * çizgisi log-log eksende F = kz·δ; değerler çentiklerden kalibre okunur.
 *
 * Test neyi kilitliyor:
 *   • envanter: 5 aile · 51 tip · 148 kod, sitenin tablosundaki sayılarla;
 *   • kz'nin AMC-EO'yla örtüştüğü (9 kodun 7'si ±0,2 %) ve iki ayrışmanın sayısı;
 *   • dinamik/statik oranın AMC kuralı (Sh+20)/50 ve sertliksiz flanşlı konilerin oranı;
 *   • kütüphane girdileri: anahtar, ad, kapasite; radyali yayımlanmayan kod EKSİK
 *     (sx/sy/dx/dy boş) ve taramaya aday değil; tamamlanınca aday;
 *   • görseller: her tipin çizimi, ailenin fotoğrafları diskte ve künyede;
 *   • Takoz Özellikleri künyesi: veri + görsel, kapasite yazılmaz (Canlı Not 65).
 * Bir hane kayarsa sonuç sessizce "makul ama yanlış" çıkar — testin karşılığı burada.
 */
const fs = require('fs');
const path = require('path');
const core = require('../../js/mount-core.js');
global.veMountCore = core;
const stubs = stubGlobals({ saveState: jest.fn(), showToast: jest.fn(), showNodeProperties: jest.fn() });
eval(fs.readFileSync(path.join(__dirname, '../../js/components.js'), 'utf8'));
global.componentDefs = componentDefs;
const A = require('../../js/mount-amc.js');
const cp = require('../../js/cp-mount.js');

beforeEach(() => { resetStubs(stubs); global.nodes = []; });

const L = cp.VE_MOUNT_LIBRARY;
const KOD = A.KOD, TIP = A.TIP;
const kodlar = Object.keys(KOD);
const aile = (k) => TIP[KOD[k][0]][0];

describe('ENVANTER — üreticinin tablosu', () => {
  test('5 aile · 51 tip · 148 kod; her kodun tipi tanımlı, kodlar tekil', () => {
    expect(Object.keys(A.AILE)).toEqual(['masif', 'kesikli', 'flansli', 'hidrolik', 'dsm']);
    expect(Object.keys(TIP)).toHaveLength(51);
    expect(A.TIP_SIRA.slice().sort()).toEqual(Object.keys(TIP).sort());        // sıra dizisi tipleri eksiksiz taşır
    expect(A.TIP_SIRA.slice(0, 4)).toEqual(['01', '02', '11', '13']);
    expect(kodlar).toHaveLength(148);
    const say = {};
    kodlar.forEach((k) => { expect(TIP[KOD[k][0]]).toBeDefined(); say[aile(k)] = (say[aile(k)] || 0) + 1; });
    expect(say).toEqual({ masif: 71, kesikli: 29, flansli: 21, hidrolik: 21, dsm: 6 });
    kodlar.forEach((k) => expect(k).toMatch(/^1(37|77)\d{3}$/));
  });

  test('sitenin tablosundan çiviler — sertlik, maks. yük, sıkma torku, ağırlık', () => {
    expect(KOD['137961']).toEqual(['38', 40, 300, 450, 1.2, 'w3']);           // Cone 38 40 ShA
    expect(KOD['137984'].slice(0, 3)).toEqual(['39', 70, 1100]);              // Cone 39 70 ShA (eskiden "veri yok")
    expect(KOD['137741'].slice(0, 3)).toEqual(['68', 70, 2200]);              // Cone 68, yalnız web grafiğinde (Rev. 3)
    expect(KOD['137213'].slice(0, 3)).toEqual(['100-a', null, 3750]);         // sertliği yazılmıyor
    expect(TIP['121-ng']).toEqual(['masif', 'Cone 121 NG', '121-ng', 600, 7840]);
    expect(TIP['01'][3]).toBe(20.5);
  });

  test('kaynak düzeltmesi: 137936 sitede ağırlığı Shore hücresinde taşıyor — 2018 grafiği 60 ShA', () => {
    expect(KOD['137936'].slice(0, 3)).toEqual(['14-4', 60, 450]);
  });

  test('her tipte maks. yük sertlikle artar; sertliksiz tipte sertlik yok', () => {
    Object.keys(TIP).forEach((t) => {
      const K = kodlar.filter((k) => KOD[k][0] === t);
      expect(K.length).toBeGreaterThan(0);
      const sh = K.map((k) => KOD[k][1]);
      if (sh[0] === null) { expect(sh.every((s) => s === null)).toBe(true); return; }
      const s = K.slice().sort((a, b) => KOD[a][1] - KOD[b][1]);
      for (let i = 1; i < s.length; i++) expect([t, KOD[s[i]][2] > KOD[s[i - 1]][2]]).toEqual([t, true]);
    });
  });
});

describe('EKSENEL RİJİTLİK — üreticinin yük–sehim grafiğinden', () => {
  test('kz eksik yalnız DSM (eğrisi doğrusal değil) ve Cone 38 70 ShA (grafiğin ekseni 800 kg\'da biter; AMC-EO verir)', () => {
    const yok = kodlar.filter((k) => KOD[k][3] === null);
    expect(yok.sort()).toEqual(['137460', '137461', '137462', '137463', '137464', '137465', '137964']);
  });

  test('AMC-EO\'nun bildiği 9 kodun 7\'si grafikle ±0,2 % — iki ayrışma sayısıyla kayıtlı', () => {
    const fark = {};
    Object.keys(A.EO).forEach((k) => { if (KOD[k][3] !== null) fark[k] = KOD[k][3] / A.EO[k][0][2] - 1; });
    ['137963', '137981', '137982', '137983', '137830', '137833', '177296']
      .forEach((k) => expect([k, Math.abs(fark[k]) <= 0.002]).toEqual([k, true]));
    expect(+(fark['137731'] * 100).toFixed(1)).toBe(-3.0);   // Cone 67 50 ShA: AMC bildirimi 1325, grafik 1285
    expect(+(fark['137829'] * 100).toFixed(1)).toBe(2.3);    // Cone 121 NP 55 ShA: girdi çalışma noktası tabanında
  });

  test('her tipte kz sertlikle artar (grafiğin çizgileri karışmadı)', () => {
    Object.keys(TIP).forEach((t) => {
      const s = kodlar.filter((k) => KOD[k][0] === t && KOD[k][3] !== null && KOD[k][1] !== null)
        .sort((a, b) => KOD[a][1] - KOD[b][1]);
      for (let i = 1; i < s.length; i++) expect([t, KOD[s[i]][3] > KOD[s[i - 1]][3]]).toEqual([t, true]);
    });
    // sertliksiz flanşlı koniler: A en sert, C en yumuşak (maks. yükle aynı sıra)
    expect([KOD['137213'][3], KOD['137214'][3], KOD['137215'][3]]).toEqual([7500, 4500, 3200]);
    expect([KOD['137438'][3], KOD['137437'][3]]).toEqual([18210, 9295]);
  });

  test('kaynak sütunu tanımlı; 14 · 4 delik yalnız 2018 föyünde, hidrolik katalogda', () => {
    kodlar.filter((k) => KOD[k][3] !== null).forEach((k) => expect(A.KAYNAK[KOD[k][5]]).toBeDefined());
    expect(['137935', '137936', '137937'].map((k) => KOD[k][5])).toEqual(['f18', 'f18', 'f18']);
    kodlar.filter((k) => aile(k) === 'hidrolik').forEach((k) => expect(KOD[k][5]).toBe('k2'));
  });
});

describe('DİNAMİK/STATİK ORAN', () => {
  test('sertlikli NR konide (Sh+20)/50 — doğal frekans grafiklerinin oranı her sertlikte', () => {
    kodlar.filter((k) => ['masif', 'kesikli', 'flansli'].indexOf(aile(k)) >= 0 && KOD[k][1] !== null)
      .forEach((k) => expect([k, KOD[k][4]]).toEqual([k, Math.round((KOD[k][1] + 20) / 50 * 100) / 100]));
  });
  test('sertliksiz flanşlı koni grafiğin oranıyla; hidrolik ve DSM\'de oran yok', () => {
    expect(['137213', '137214', '137215', '137438', '137437'].map((k) => KOD[k][4])).toEqual([1.6, 1.5, 1.5, 1.7, 1.4]);
    kodlar.filter((k) => aile(k) === 'hidrolik' || aile(k) === 'dsm').forEach((k) => expect([k, KOD[k][4]]).toEqual([k, null]));
  });
});

describe('KÜTÜPHANE — VE_MOUNT_LIBRARY girdileri', () => {
  test('her kod "amc"+kod anahtarında, adı kuralla, kapasitesi tablodan', () => {
    kodlar.forEach((k) => {
      const e = L['amc' + k];
      expect(e).toBeDefined();
      expect(e.name).toBe(A.ad(k));
      expect(e.maxLoad).toBe(KOD[k][2]);
      expect(e.amc.kod).toBe(k);
    });
    expect(A.ad('137961')).toBe('Cone 38 40 ShA (AMC 137961)');
    expect(A.ad('137930')).toBe('Cone 14 2 Holes 45 ShA (AMC 137930)');
    expect(A.ad('137231')).toBe('Cone 50 M16x1.5 40 ShA (AMC 137231)');
    expect(A.ad('177081')).toBe('Hydraulic Cone 31 40 ShA (AMC 177081)');
    expect(A.ad('137461')).toBe('DSM 83 45 ShA (AMC 137461)');
  });

  test('ilk 24 girdinin sırası DEĞİŞMEDİ (taramanın kombinasyon sırası)', () => {
    expect(Object.keys(L).slice(0, 24)).toEqual(['amc55sha', '57RS313773', '57RS313774', '57RS313773-sr116', '57RS313774-sr116',
      'TK035', 'TK040', 'TK050', 'amc137963', 'amc137964', 'amc137731', 'amc137981', 'amc137982', 'amc137983',
      'amc137830', 'amc137833', 'amc177296', 'amc137829', 'lmt1433-00-40sh', 'lmt1433-00-55sh', 'lmt1433-00-70sh',
      'bmc-mount1-40sh', 'bmc-mount1-55sh', 'bmc-mount1-70sh']);
    expect(Object.keys(L)).toHaveLength(24 + 138 + 86);                       // + A+P (js/mount-ap.js)
  });

  test('tam tip AMC-EO\'nun 10 kodu + teknik resimlerin 3 kodu; ötekilerde radyal boş, dinamik eksenel kz × oran', () => {
    const tam = kodlar.filter((k) => cp._mntLibTam(L['amc' + k]));
    expect(tam.sort()).toEqual(Object.keys(A.EO).concat(['137061', '137062', '137961']).sort());
    const e = L.amc137962;
    expect([e.sx, e.sy, e.sz, e.dx, e.dy, e.dz]).toEqual([null, null, 700, null, null, 980]);
    const h = L.amc177081;                                            // hidrolik: dinamik frekansa bağlı, yazılmadı
    expect([h.sz, h.dz]).toEqual([250, null]);
    const d = L.amc137461;                                            // DSM: rijitlik yok
    expect([d.sx, d.sy, d.sz, d.dx, d.dy, d.dz]).toEqual([null, null, null, null, null, null]);
  });

  test('eksik tip uygulanınca takozun radyali boşalır ve pencere "rijitlik eksik" der; kapasite gelir', () => {
    const n = { id: 'm1', type: 'mnt-mount', def: componentDefs['mnt-mount'], data: { kxs: 1, kys: 1, kzs: 1, kxd: 1, kyd: 1, kzd: 1 } };
    global.nodes = [n];
    cp.veMntApplyLib('m1', 'amc137962');
    expect([n.data.kxs, n.data.kys, n.data.kzs, n.data.kxd, n.data.kyd, n.data.kzd]).toEqual([null, null, 700, null, null, 980]);
    expect(n.data.maxLoad).toBe(400);
    expect(cp._mntLibTur(cp.veMntGetLibraryMap().amc137962)).toBe('eksik');
    expect(cp._mntLibTur(cp.veMntGetLibraryMap().amc137963)).toBe('gomulu');
  });

  test('eksik tip uygulanınca tip notu 6/6 der: iki tarafı boş radyal "elle değiştirildi" sayılmaz; boş takoz eşleşmez', () => {
    const n = { id: 'm1', type: 'mnt-mount', def: componentDefs['mnt-mount'], data: {} };
    global.nodes = [n];
    expect(cp._mntKutuphaneEslesme(n)).toBeNull();                              // rijitliksiz tip (DSM) boş takoza oturmaz
    cp.veMntApplyLib('m1', 'amc137962');
    const E = cp._mntKutuphaneEslesme(n);
    expect([E.e.key, E.ayni, E.farkli]).toEqual(['amc137962', 6, []]);
    delete n.data.libKey;                                                       // bağsız: altı değer tek tipi gösterir
    expect(cp._mntKutuphaneEslesme(n).e.key).toBe('amc137962');
    n.data.kxs = 700;                                                           // radyal elle girildi → fark
    expect(cp._mntKutuphaneEslesme(n)).toBeNull();
  });

  test('liste sırası: AMC dışı katalog önce, AMC ailenin · tipin · sertliğin sırasıyla', () => {
    const s = cp._mntLibSirali(cp.veMntGetLibraryList().filter((e) => e.builtin));
    expect(s[0].key).toBe('amc55sha');
    const amc = s.filter((e) => e.amc).map((e) => e.amc.kod);
    expect(amc).toEqual(A.kodlar());
    expect(amc.slice(0, 3)).toEqual(['137005', '137006', '137015']);           // Cone 01 45 · 60 · 70 ShA
    expect(amc[amc.length - 1]).toBe('137465');                                 // DSM 141 60 ShA
  });
});

describe('PARAMETRİK — eksik tip aday değil', () => {
  global.veMntKatalog = require('../../js/mount-katalog.js');
  Object.keys(cp).forEach((k) => { if (global[k] === undefined) global[k] = cp[k]; });
  const P = require('../../js/cp-mount-param.js');
  test('adaylar yalnız tam tipler; Takoz Özellikleri\'nde tamamlanan AMC kodu aday olur', () => {
    const M = { lib: cp.veMntGetLibraryMap() };
    const ad = P._mntParamAdaylar(M, null).map((a) => a.key);
    expect(ad).toHaveLength(27);                                                // 24 + teknik resimlerin 3 kodu
    expect(ad).toEqual(expect.arrayContaining(['amc137061', 'amc137062', 'amc137961']));
    expect(ad).not.toContain('amc137962');
    const lib = { id: 'lib1', type: 'mnt-library', def: componentDefs['mnt-library'],
      data: { mounts: [], overrides: { amc137962: { sx: 1300, sy: 900, dx: 1820, dy: 1260 } } } };
    global.nodes = [lib];
    const ad2 = P._mntParamAdaylar({ lib: cp.veMntGetLibraryMap() }, null).map((a) => a.key);
    expect(ad2).toHaveLength(28);
    expect(ad2).toContain('amc137962');
  });
});

describe('GÖRSELLER — üreticinin çizimi ve fotoğrafları', () => {
  const D = path.join(__dirname, '../../assets/takoz/amc');
  const kunye = JSON.parse(fs.readFileSync(path.join(D, 'kunye.json'), 'utf8'));
  const dosya = fs.readdirSync(D).filter((f) => f.endsWith('.webp')).map((f) => f.replace(/\.webp$/, '')).sort();
  test('her tipin ölçülü çizimi, her ailenin ürün ve uygulama fotoğrafı diskte', () => {
    const iste = new Set();
    Object.keys(TIP).forEach((t) => iste.add('cizim-' + TIP[t][2]));
    Object.keys(A.AILE).forEach((a) => {
      iste.add(A.AILE[a][1]);
      for (let i = 1; i <= A.AILE[a][2]; i++) iste.add('uyg-' + a + '-' + i);
    });
    expect([...iste].filter((x) => dosya.indexOf(x) < 0)).toEqual([]);
    expect(dosya.filter((x) => !iste.has(x))).toEqual([]);                       // öksüz görsel yok
  });
  test('künye diskle birebir: kaynak üreticinin adresi, bayt dosyanınki', () => {
    expect(Object.keys(kunye).sort()).toEqual(dosya);
    dosya.forEach((x) => {
      expect(kunye[x].kaynak).toMatch(/^https:\/\/cdn\.amcsa\.es\//);
      expect(kunye[x].bayt).toBe(fs.statSync(path.join(D, x + '.webp')).size);
      expect(fs.readFileSync(path.join(D, x + '.webp')).toString('ascii', 8, 12)).toBe('WEBP');
    });
  });
  test('adres: derlemede gömülü, modüler kopyada dosya', () => {
    expect(A.gorsel('cizim-38')).toBe('assets/takoz/amc/cizim-38.webp');
    global.window.__MFSIM_TAKOZ = { 'takoz/amc/cizim-38.webp': 'data:image/webp;base64,AAAA' };
    try { expect(A.gorsel('cizim-38')).toBe('data:image/webp;base64,AAAA'); }
    finally { delete global.window.__MFSIM_TAKOZ; }
  });
  test('derleme assets/takoz altını gömer (build.js → __MFSIM_TAKOZ)', () => {
    const b = fs.readFileSync(path.join(__dirname, '../../build.js'), 'utf8');
    expect(b).toMatch(/path\.join\(ROOT, 'assets', 'takoz'\)/);
    expect(b).toMatch(/'window\.__MFSIM_TAKOZ = '/);
  });
});

// ── TEKNİK RESİM — BMC'nin dokuz resmindeki AMC kutusu (kullanıcı 2026-11-10) ──
// Resimden okunan sayılar (kN/mm → N/mm, kg) burada BAĞIMSIZ yazılı: modülün
// RESIM tablosu bozulursa ya da grafiğin sayısallaştırması kayarsa kırmızı.
describe('TEKNİK RESİM — AMC kutusu', () => {
  const RES = {                                   // kod: [maks. yük kg, X, Y, Z N/mm, din]
    '137061': [500, 2470, 2470, 900, null], '137062': [750, 2750, 2750, 1600, null],
    '137963': [650, 1800, 1210, 1150, 1.6], '137964': [900, 2770, 1990, 1900, 1.8],
    '177296': [900, 1090, 1090, 650, 2], '137961': [300, 1200, 780, 450, 1.2]
  };
  const TABLO = { '137063': 310, '137061': 500, '137062': 750, '137961': 300, '137962': 400, '137963': 650, '137964': 900,
    '137981': 400, '137982': 600, '137983': 900, '137984': 1100, '177294': 400, '177295': 600, '177296': 900, '177297': 1000 };
  test('grafikten okunan kz resmin Z\'siyle birebir (beş kod) — sayısallaştırmanın bağımsız doğrulaması', () => {
    ['137061', '137062', '137961', '137963', '177296'].forEach((k) => expect([k, A.KOD[k][3]]).toEqual([k, RES[k][3]]));
  });
  test('resimlerdeki aile yük tabloları on beş kodda sitenin tablosuyla aynı', () => {
    Object.keys(TABLO).forEach((k) => expect([k, A.KOD[k][2]]).toEqual([k, TABLO[k]]));
  });
  test('üç kodda resim = AMC-EO; üç kodda X · Y yeni → kütüphanede tam tip', () => {
    ['137963', '137964', '177296'].forEach((k) => {
      expect(A.EO[k][0]).toEqual(RES[k].slice(1, 4));
      expect(A.EO[k][1]).toEqual(RES[k].slice(1, 4).map((v) => Math.round(v * RES[k][4])));
    });
    expect([L.amc137061.sx, L.amc137061.sy, L.amc137061.sz, L.amc137061.dx, L.amc137061.dz]).toEqual([2470, 2470, 900, 3952, 1440]);
    expect([L.amc137062.sx, L.amc137062.sy, L.amc137062.sz, L.amc137062.dx, L.amc137062.dz]).toEqual([2750, 2750, 1600, 4950, 2880]);
    expect([L.amc137961.sx, L.amc137961.sy, L.amc137961.sz, L.amc137961.dx, L.amc137961.dy, L.amc137961.dz]).toEqual([1200, 780, 450, 1440, 936, 540]);
    ['137061', '137062', '137961'].forEach((k) => expect(L['amc' + k].amc.kzKaynak).toBe('resim'));
  });
  test('137962\'nin resmindeki kutu 137963\'ün kopyası — yazılmadı, tip eksik kalır', () => {
    const e = L.amc137962;
    expect([e.sx, e.sy, e.sz]).toEqual([null, null, 700]);
    expect(A.RESIM['137962']).toBeUndefined();
  });
  test('137961 Z basma eğrisi: basma δ < 0, monoton; maks. yükte sekant tabloyla ±1 %; orijin eğimi katalogla uyumlu', () => {
    const z = L.amc137961.curves.z;
    expect(z[z.length - 1]).toEqual([0, 0]);
    for (let i = 1; i < z.length; i++) { expect(z[i][0]).toBeGreaterThan(z[i - 1][0]); expect(z[i][1]).toBeGreaterThan(z[i - 1][1]); }
    const C = require('../../js/mount-core.js');
    const mnt = { kstat: [1200e3, 780e3, 450e3], curves: { z: z.map((p) => [p[0] / 1000, p[1]]) } };
    const yasa = C.mountStaticLaws ? C.mountStaticLaws(mnt)[2] : null;
    if (yasa) {
      const F = 300 * 9.81; let lo = -0.0128, hi = 0;                           // F(δ) = −F'yi ikiye bölmeyle bul
      for (let i = 0; i < 60; i++) { const m = (lo + hi) / 2; if (yasa.force(m) < -F) lo = m; else hi = m; }
      expect(Math.abs(F / -lo / 1000 / 450 - 1)).toBeLessThan(0.01);
    }
    expect(C.lawCatalogMismatch(mnt)).toEqual([]);
  });
  test('Takoz Özellikleri: resimli tipte sönüm ve kaynak; BMC parça no yazılmaz (kullanıcı 2026-11-10)', () => {
    const lib = { id: 'lib1', type: 'mnt-library', def: componentDefs['mnt-library'], data: { mounts: [], _selKey: 'amc137961' } };
    global.nodes = [lib];
    const d = document.createElement('div'); d.innerHTML = cp.getMntLibraryPropertiesHTML(lib);
    const satir = [...d.querySelectorAll('.ve-mnt-amc tr')].map((r) => [r.querySelector('th').textContent, r.querySelector('td').textContent]);
    expect(satir).toContainEqual(['Sönüm', '0,03']);
    expect(satir).toContainEqual(['Kaynak', 'AMC çizimi · BMC teknik resmi']);
    expect(d.textContent).not.toMatch(/BMC parça/);
  });
});

describe('KÜNYE — Takoz Özellikleri', () => {
  const dom = (h) => { const d = document.createElement('div'); d.innerHTML = h; return d; };
  test('AMC tipinde çizim + fotoğraf + uygulama fotoğrafları ve veri; kapasite yazılmaz (Canlı Not 65)', () => {
    const lib = { id: 'lib1', type: 'mnt-library', def: componentDefs['mnt-library'], data: { mounts: [], _selKey: 'amc137963' } };
    global.nodes = [lib];
    const d = dom(cp.getMntLibraryPropertiesHTML(lib));
    const k = d.querySelector('.ve-mnt-amc[data-amc="137963"]');
    expect(k).not.toBeNull();
    const img = [...k.querySelectorAll('img')].map((i) => i.getAttribute('src'));
    expect(img.slice(0, 2)).toEqual(['assets/takoz/amc/cizim-38.webp', 'assets/takoz/amc/urun-kesikli.webp']);
    expect(img).toHaveLength(2 + 6);
    const satir = [...k.querySelectorAll('tr')].map((r) => [r.querySelector('th').textContent, r.querySelector('td').textContent]);
    expect(satir).toEqual([['Kod', 'AMC 137963'], ['Ürün ailesi', 'Cone with cutouts'], ['Sertlik', '60 ShA'],
      ['Sıkma torku', '170 N·m'], ['Ağırlık', '1.438 g'], ['Kaynak', 'AMC-EO · 24.11.2025']]);
    expect(d.textContent).not.toMatch(/Taşıma kapasitesi|Maks\. eksenel yük|Maks\. yük|650 kg/i);
    [...k.querySelectorAll('button.ve-mnt-amc-res')].forEach((b) => expect(b.getAttribute('onclick')).toMatch(/veBasResimAc\(this\)/));
  });
  test('AMC dışı tipte künye yok', () => {
    const lib = { id: 'lib1', type: 'mnt-library', def: componentDefs['mnt-library'], data: { mounts: [], _selKey: 'TK040' } };
    global.nodes = [lib];
    expect(dom(cp.getMntLibraryPropertiesHTML(lib)).querySelector('.ve-mnt-amc')).toBeNull();
  });
});
