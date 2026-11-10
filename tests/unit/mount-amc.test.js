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
 *   • görsel: yalnız her tipin teknik resmi diskte ve künyede — ürün ve uygulama
 *     fotoğrafı yok (Canlı Not 111: "Sadece teknik resmi kalsa yeter");
 *   • Takoz Özellikleri künyesi: yalnız veri, kapasite yazılmaz (Canlı Not 65);
 *     teknik resim Tip satırının (i) düğmesiyle pencerede (Canlı Not 111).
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
    expect(Object.keys(L)).toHaveLength(24 + 138);
  });

  test('tam tip yalnız AMC-EO\'nun 10 kodu; ötekilerde radyal boş, dinamik eksenel kz × oran', () => {
    const tam = kodlar.filter((k) => cp._mntLibTam(L['amc' + k]));
    expect(tam.sort()).toEqual(Object.keys(A.EO).sort());
    const e = L.amc137961;
    expect([e.sx, e.sy, e.sz, e.dx, e.dy, e.dz]).toEqual([null, null, 450, null, null, 540]);
    const h = L.amc177081;                                            // hidrolik: dinamik frekansa bağlı, yazılmadı
    expect([h.sz, h.dz]).toEqual([250, null]);
    const d = L.amc137461;                                            // DSM: rijitlik yok
    expect([d.sx, d.sy, d.sz, d.dx, d.dy, d.dz]).toEqual([null, null, null, null, null, null]);
  });

  test('eksik tip uygulanınca takozun radyali boşalır ve pencere "rijitlik eksik" der; kapasite gelir', () => {
    const n = { id: 'm1', type: 'mnt-mount', def: componentDefs['mnt-mount'], data: { kxs: 1, kys: 1, kzs: 1, kxd: 1, kyd: 1, kzd: 1 } };
    global.nodes = [n];
    cp.veMntApplyLib('m1', 'amc137961');
    expect([n.data.kxs, n.data.kys, n.data.kzs, n.data.kxd, n.data.kyd, n.data.kzd]).toEqual([null, null, 450, null, null, 540]);
    expect(n.data.maxLoad).toBe(300);
    expect(cp._mntLibTur(cp.veMntGetLibraryMap().amc137961)).toBe('eksik');
    expect(cp._mntLibTur(cp.veMntGetLibraryMap().amc137963)).toBe('gomulu');
  });

  test('eksik tip uygulanınca tip notu 6/6 der: iki tarafı boş radyal "elle değiştirildi" sayılmaz; boş takoz eşleşmez', () => {
    const n = { id: 'm1', type: 'mnt-mount', def: componentDefs['mnt-mount'], data: {} };
    global.nodes = [n];
    expect(cp._mntKutuphaneEslesme(n)).toBeNull();                              // rijitliksiz tip (DSM) boş takoza oturmaz
    cp.veMntApplyLib('m1', 'amc137961');
    const E = cp._mntKutuphaneEslesme(n);
    expect([E.e.key, E.ayni, E.farkli]).toEqual(['amc137961', 6, []]);
    delete n.data.libKey;                                                       // bağsız: altı değer tek tipi gösterir
    expect(cp._mntKutuphaneEslesme(n).e.key).toBe('amc137961');
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
    expect(ad).toHaveLength(24);
    expect(ad).not.toContain('amc137961');
    const lib = { id: 'lib1', type: 'mnt-library', def: componentDefs['mnt-library'],
      data: { mounts: [], overrides: { amc137961: { sx: 700, sy: 480, dx: 840, dy: 576 } } } };
    global.nodes = [lib];
    const ad2 = P._mntParamAdaylar({ lib: cp.veMntGetLibraryMap() }, null).map((a) => a.key);
    expect(ad2).toHaveLength(25);
    expect(ad2).toContain('amc137961');
  });
});

describe('GÖRSELLER — yalnız tipin teknik resmi (Canlı Not 111)', () => {
  const D = path.join(__dirname, '../../assets/takoz/amc');
  const kunye = JSON.parse(fs.readFileSync(path.join(D, 'kunye.json'), 'utf8'));
  const dosya = fs.readdirSync(D).filter((f) => f.endsWith('.webp')).map((f) => f.replace(/\.webp$/, '')).sort();
  test('her tipin teknik resmi diskte; ürün ve uygulama fotoğrafı yok, üreteç de üretmez', () => {
    const iste = new Set(Object.keys(TIP).map((t) => 'cizim-' + TIP[t][2]));
    expect([...iste].filter((x) => dosya.indexOf(x) < 0)).toEqual([]);
    expect(dosya.filter((x) => !iste.has(x))).toEqual([]);                       // öksüz görsel yok — fotoğraf da
    expect(Object.keys(A.AILE).map((a) => A.AILE[a].length)).toEqual([1, 1, 1, 1, 1]);   // ailede fotoğraf alanı yok
    const T = require('../../tools/takoz-gorsel.js');
    expect(T.listesi().map((x) => x.ad).sort()).toEqual([...iste].sort());
    const K = A.kunye('137963');
    expect([K.cizim, 'foto' in K, 'uyg' in K]).toEqual(['assets/takoz/amc/cizim-38.webp', false, false]);
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

describe('KÜNYE — Takoz Özellikleri', () => {
  const dom = (h) => { const d = document.createElement('div'); d.innerHTML = h; return d; };
  test('AMC tipinde yalnız veri: pencerede görsel yok, kapasite yazılmaz (Canlı Not 65 · 111)', () => {
    const lib = { id: 'lib1', type: 'mnt-library', def: componentDefs['mnt-library'], data: { mounts: [], _selKey: 'amc137963' } };
    global.nodes = [lib];
    const d = dom(cp.getMntLibraryPropertiesHTML(lib));
    const k = d.querySelector('.ve-mnt-amc[data-amc="137963"]');
    expect(k).not.toBeNull();
    expect(d.querySelectorAll('img')).toHaveLength(0);                     // resim yalnız (i)'nin penceresinde
    const satir = [...k.querySelectorAll('tr')].map((r) => [r.querySelector('th').textContent, r.querySelector('td').textContent]);
    expect(satir).toEqual([['Kod', 'AMC 137963'], ['Ürün ailesi', 'Cone with cutouts'], ['Sertlik', '60 ShA'],
      ['Sıkma torku', '170 N·m'], ['Ağırlık', '1.438 g'], ['Kaynak', 'AMC-EO · 24.11.2025']]);
    expect(d.textContent).not.toMatch(/Taşıma kapasitesi|Maks\. eksenel yük|Maks\. yük|650 kg/i);
  });
  test('AMC dışı tipte künye de (i) de yok', () => {
    const lib = { id: 'lib1', type: 'mnt-library', def: componentDefs['mnt-library'], data: { mounts: [], _selKey: 'TK040' } };
    global.nodes = [lib];
    const d = dom(cp.getMntLibraryPropertiesHTML(lib));
    expect([d.querySelector('.ve-mnt-amc'), d.querySelector('.mntlib-bilgi')]).toEqual([null, null]);
    expect(d.querySelector('.mntlib-sec > .mntlib-tip > .mntlib-picker')).not.toBeNull();   // satırın yapısı aynı
  });
});

describe('TEKNİK RESİM — Tip satırının (i) düğmesi (Canlı Not 111)', () => {
  const BSK = require('../../js/baslangic-sayfa.js');
  beforeAll(() => { global.veBasResimGoster = BSK.veBasResimGoster; });
  afterAll(() => { delete global.veBasResimGoster; BSK.veBasResimKapat(); document.body.innerHTML = ''; });
  test('(i) tetikleyicinin yanında; tık pencere ailesinin penceresinde tipin teknik resmini açar, Esc kapatır, odak döner', () => {
    const lib = { id: 'lib1', type: 'mnt-library', def: componentDefs['mnt-library'], data: { mounts: [], _selKey: 'amc137963' } };
    global.nodes = [lib];
    document.body.innerHTML = cp.getMntLibraryPropertiesHTML(lib);
    const b = document.querySelector('.mntlib-sec > .mntlib-tip > button.mntlib-bilgi');
    expect(b).not.toBeNull();
    expect(b.previousElementSibling.classList.contains('mntlib-picker')).toBe(true);
    expect([b.getAttribute('aria-label'), b.getAttribute('title'), b.querySelector('.mf-ico-info') !== null, b.getAttribute('onclick')])
      .toEqual(['Teknik resim', 'Teknik resim', true, 'veMntLibCizimAc(this)']);
    expect(document.querySelectorAll('img')).toHaveLength(0);
    expect(cp.veMntLibCizimAc(b)).toBe(true);
    const perde = document.getElementById('ve-bas-buyuk-perde');
    const pen = perde.querySelector('.ve-bas-buyuk-pencere[role="dialog"][aria-modal="true"]');
    expect(pen.querySelector('.ve-settings-header .ve-settings-close .mf-ico-x')).not.toBeNull();
    expect(pen.querySelector('#ve-bas-buyuk-baslik').textContent).toBe('Cone 38 · teknik resim');
    const im = pen.querySelector('.ve-bas-buyuk-govde img');
    expect([im.getAttribute('src'), im.hasAttribute('width'), im.getAttribute('alt')])
      .toEqual(['assets/takoz/amc/cizim-38.webp', false, 'Cone 38 · teknik resim']);   // ölçü dosyanın kendisinden
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(document.getElementById('ve-bas-buyuk-perde')).toBeNull();
    expect(document.activeElement).toBe(b);
  });
  test('bilinmeyen kod ya da pencere kiti yoksa hiçbir şey açılmaz', () => {
    const b = document.createElement('button'); b.setAttribute('data-amc', '999999');
    expect(cp.veMntLibCizimAc(b)).toBe(false);
    b.setAttribute('data-amc', '137963');
    const g = global.veBasResimGoster; delete global.veBasResimGoster;
    try { expect(cp.veMntLibCizimAc(b)).toBe(false); } finally { global.veBasResimGoster = g; }
    expect(document.getElementById('ve-bas-buyuk-perde')).toBeNull();
  });
});
