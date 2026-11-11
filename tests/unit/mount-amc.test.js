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
 *   • kütüphane girdileri: anahtar, ad, kapasite; radyali yayımlanmayan kod TAHMİNİ
 *     (Canlı Not 113: AMC'nin ölçtüğü radyal/eksenel oran — AMC-EO ve teknik resimler;
 *     aynı tipte sertliğe göre ara değer, aile, hepsi), çözülür, taramaya aday değil;
 *     radyali girilince aday; kz'si olmayan DSM eksik;
 *   • teknik resimler: kutunun X · Y'si üç kodu ölçülü yapar, 137961'in Z eğrisi;
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
    expect(Object.keys(L)).toHaveLength(24 + 138 + 86);                       // + A+P (js/mount-ap.js)
  });

  test('tahminli tip uygulanınca tip notu 6/6 der ve radyalin tahmini olduğunu söyler; elle girilen değer farktır', () => {
    const n = { id: 'm1', type: 'mnt-mount', def: componentDefs['mnt-mount'], data: {} };
    global.nodes = [n];
    expect(cp._mntKutuphaneEslesme(n)).toBeNull();                              // rijitliksiz tip (DSM) boş takoza oturmaz
    cp.veMntApplyLib('m1', 'amc137962');
    const E = cp._mntKutuphaneEslesme(n);
    expect([E.e.key, E.ayni, E.farkli]).toEqual(['amc137962', 6, []]);
    const not = document.createElement('div'); not.innerHTML = cp._mntKutuphaneNotu(n);
    expect(not.textContent).toBe('Cone 38 50 ShA (AMC 137962) ile 6/6 değer aynı · radyal tahmini (kz × x 2,12 · y 1,39 · Cone 38, 40–60 ShA · AMC-EO · AMC çizimi).');
    delete n.data.libKey;                                                       // bağsız: altı değer tek tipi gösterir
    expect(cp._mntKutuphaneEslesme(n).e.key).toBe('amc137962');
    n.data.kxs = 1500;                                                          // radyal elle girildi → fark
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

describe('RADYAL TAHMİN — AMC\'nin yayımlamadığı radyal (Canlı Not 113)', () => {
  test('ölçüm: AMC-EO\'nun 10 kodu + teknik resimlerin 3 yeni kutusu; oran tipte sertlikle değişebilir', () => {
    expect(kodlar.filter((k) => A.olcum(k)).sort()).toEqual(Object.keys(A.EO).concat(['137061', '137062', '137961']).sort());
    expect(A.ORAN.tip['38'].olc.map((o) => [o.sh, +o.x.toFixed(3), +o.y.toFixed(3), o.belge]))
      .toEqual([[40, 2.667, 1.733, 'AMC çizimi'], [60, 1.565, 1.052, 'AMC-EO'], [70, 1.458, 1.047, 'AMC-EO']]);
    expect(A.ORAN.tip['31'].olc.map((o) => [o.sh, +o.x.toFixed(3)])).toEqual([[60, 2.744], [70, 1.719]]);
    expect(A.ORAN.tip['39'].olc.map((o) => +o.x.toFixed(3))).toEqual([1.861, 1.913, 1.779]);    // Cone 39'da az değişir
  });
  test('sertliğe göre ara değer: bir sertliği dışarıda bırakan sınamada tipin ortalamasından yakın', () => {
    let ara = 0, ort = 0;
    Object.keys(A.ORAN.tip).forEach((t) => {
      const O0 = A.ORAN.tip[t].olc; if (O0.length < 2) return;
      O0.forEach((o) => {
        const O = O0.filter((x) => x !== o);
        const T = { olc: O, x: O.reduce((a, b) => a + b.x, 0) / O.length, y: O.reduce((a, b) => a + b.y, 0) / O.length };
        const r = A.tipOrani(T, o.sh);
        ara += Math.abs(r.x / o.x - 1) + Math.abs(r.y / o.y - 1);
        ort += Math.abs(T.x / o.x - 1) + Math.abs(T.y / o.y - 1);
      });
    });
    expect([+ara.toFixed(2), +ort.toFixed(2)]).toEqual([4.52, 5.41]);
    expect(ara).toBeLessThan(ort);
  });
  test('ara değer ölçülmüş sertlikler arasında doğrusal, dışında en yakın ölçülmüş sertliğinki (öteleme yok)', () => {
    const r = (k) => A.tahminOrani(k);
    expect([r('137962').x, r('137962').y, r('137962').kaynak.sh]).toEqual([2.116, 1.393, [40, 60]]);   // Cone 38 50 ShA
    expect([r('137063').x, r('137063').kaynak.sh]).toEqual([2.744, [60]]);                           // Cone 31 50 ShA
    expect([r('137984').x, r('137984').kaynak.sh]).toEqual([1.779, [60]]);                           // Cone 39 70 ShA
  });
  test('sıra: aynı tip → aynı aile (eksen başına medyan) → ölçülmüş bütün tipler (x = y); hidrolikte din./stat. ailenin ölçümü', () => {
    const r = (k) => A.tahminOrani(k), B = ['AMC-EO', 'AMC çizimi'];
    expect(r('137962').kaynak).toEqual({ tur: 'tip', ad: 'Cone 38', n: 3, sh: [40, 60], belge: B });
    expect(r('137005').kaynak).toEqual({ tur: 'aile', ad: 'Solid cone', n: 4, belge: B });      // Cone 01: masif ailesi
    expect(r('137213').kaynak).toEqual({ tur: 'hepsi', ad: null, n: 7, belge: B });             // flanşlı: ölçüm yok
    expect([r('137005').x, r('137005').y, r('137213').x, r('137213').y]).toEqual([2.437, 2.437, 1.977, 1.977]);
    const kes = kodlar.find((k) => aile(k) === 'kesikli' && !A.ORAN.tip[KOD[k][0]]);
    expect(r(kes).kaynak.tur).toBe('aile');
    expect(r(kes).x / r(kes).y).toBeCloseTo(1.46, 1);                                // kesikli konide x ≠ y
    expect([r('177081').din, r('177081').dinTahmin]).toEqual([2, true]);             // hidrolik: 177296'nın 2,0'ı
    expect([r('137005').din, r('137005').dinTahmin]).toEqual([1.3, false]);           // NR: kodun kendi oranı
    ['137982', '137961', '137061'].forEach((k) => expect(r(k)).toBeNull());          // ölçülü kodda tahmin yok
  });
  test('kütüphane: 13 ölçülü · 129 tahminli · 6 eksik (DSM); kz × oran 5 N/mm\'ye yuvarlı, dinamik statik × din./stat.', () => {
    const E = kodlar.map((k) => L['amc' + k]);
    expect(E.filter((e) => cp._mntLibTam(e) && !cp._mntLibTahmin(e).length).map((e) => e.amc.kod).sort())
      .toEqual(Object.keys(A.EO).concat(['137061', '137062', '137961']).sort());
    expect(E.filter((e) => cp._mntLibTahmin(e).length)).toHaveLength(129);
    expect(E.filter((e) => !cp._mntLibTam(e)).map((e) => e.amc.aile)).toEqual(Array(6).fill('dsm'));
    const e = L.amc137962;                                                            // Cone 38 50 ShA: kz 700, din 1,4
    expect([e.sx, e.sy, e.sz, e.dx, e.dy, e.dz, e.tahmin]).toEqual([1480, 975, 700, 2072, 1365, 980, ['sx', 'sy', 'dx', 'dy']]);
    const h = L.amc177081;                                                            // hidrolik: dinamik de tahmini
    expect([h.sx, h.sz, h.dx, h.dz, h.tahmin]).toEqual([420, 250, 840, 500, ['sx', 'sy', 'dx', 'dy', 'dz']]);
    const d = L.amc137461;                                                            // DSM: kz yok, tahmin yok
    expect([d.sx, d.sz, d.dz, d.tahmin]).toEqual([null, null, null, undefined]);
    expect(['amc137963', 'amc137982', 'amc137961'].map((k) => L[k].tahmin)).toEqual([undefined, undefined, undefined]);
  });
  test('girilen değer tahminden çıkar; kalan tahmin girilenden kurulur (kz → kx, kx → dinamik)', () => {
    const lib = { id: 'lib1', type: 'mnt-library', def: componentDefs['mnt-library'], data: { mounts: [], overrides: { amc137962: { sz: 600 } } } };
    global.nodes = [lib];
    let e = cp.veMntGetLibraryMap().amc137962;
    expect([e.sx, e.sy, e.sz, e.dx, e.dy, e.dz, e.tahmin]).toEqual([1270, 835, 600, 1778, 1169, 980, ['sx', 'sy', 'dx', 'dy']]);
    lib.data.overrides.amc137962 = { sx: 1500 };
    e = cp.veMntGetLibraryMap().amc137962;
    expect([e.sx, e.dx, e.tahmin]).toEqual([1500, 2100, ['sy', 'dx', 'dy']]);         // dinamik girilen statikten: 1.500 × 1,4
    lib.data.overrides.amc137962 = { sx: 1500, sy: 1000, dx: 2100, dy: 1400 };
    e = cp.veMntGetLibraryMap().amc137962;
    expect([e.tahmin, !!e.overridden, cp.veMntGetLibraryMap().amc137005.tahmin]).toEqual([null, true, ['sx', 'sy', 'dx', 'dy']]);
    expect(L.amc137962.sx).toBe(1480);                                                // fabrika girdisi değişmez
  });
  test('tahminli tip uygulanınca takoz dolu ve "rijitlik eksik" yok; tür ve takozun tahminli alanları', () => {
    const n = { id: 'm1', type: 'mnt-mount', def: componentDefs['mnt-mount'], data: { kxs: 1, kys: 1, kzs: 1, kxd: 1, kyd: 1, kzd: 1 } };
    global.nodes = [n];
    cp.veMntApplyLib('m1', 'amc137962');
    expect([n.data.kxs, n.data.kys, n.data.kzs, n.data.kxd, n.data.kyd, n.data.kzd, n.data.maxLoad]).toEqual([1480, 975, 700, 2072, 1365, 980, 400]);
    expect(cp._mntTakozTipDurumu(n).d).toBe('ok');
    expect(cp._mntTakozTahmin(n)).toEqual(['kxs', 'kys', 'kxd', 'kyd']);
    n.data.kxs = 1500;                                                                // elle girilen değer tahmin değil
    expect(cp._mntTakozTahmin(n)).toEqual(['kys', 'kxd', 'kyd']);
    const M = cp.veMntGetLibraryMap();
    expect(['amc137962', 'amc137961', 'amc137963', 'amc137461'].map((k) => [cp._mntLibTahmin(M[k]).length > 0, cp._mntEntryHasLaw(M[k]), cp._mntLibTam(M[k])]))
      .toEqual([[true, false, true], [false, true, true], [false, false, true], [false, false, false]]);   // tahminli · eğrili · tam · eksik
  });
  test('Takoz Özellikleri: tahminli hücreler işaretli, durum "tahmini", eksik bandı yok; kaynağı Rijitlik\'te', () => {
    const lib = { id: 'lib1', type: 'mnt-library', def: componentDefs['mnt-library'], data: { mounts: [], _selKey: 'amc137005' } };
    global.nodes = [lib];
    const d = document.createElement('div'); d.innerHTML = cp.getMntLibraryPropertiesHTML(lib);
    const tah = [...d.querySelectorAll('td.tah input')].map((i) => i.id.replace(/^ve-mnt-lib-|-lib1$/g, ''));
    expect(tah).toEqual(['sx', 'dx', 'sy', 'dy']);
    expect([...d.querySelectorAll('td.zor')]).toHaveLength(0);
    expect(d.querySelector('.ve-fp-kat[data-k="rij"]').getAttribute('data-d')).toBe('ok');
    expect(d.textContent).not.toMatch(/reddeder|rijitlik eksik/);
    const g = d.querySelector('#ve-mnt-lib-tah-lib1');
    expect([g.getAttribute('data-d'), g.textContent]).toEqual(['warn', 'Radyal tahminikz × 2,44 · Solid cone, 4 tip · AMC-EO · AMC çizimi']);
    expect(d.querySelector('#ve-mnt-lib-sx-lib1').value).toBe('315');
  });
  test('ÇÖZÜCÜ: radyali yayımlanmayan tip modeli reddettirmez — eskiden boş radyal hata veriyordu', () => {
    const H = require('../helpers/takoz-dogrulama.js');
    const e = L.amc137005, G1 = [{ ad: 'Kutu', m: 60, cg: [300, 20, 650], kutu: [500, 400, 400] }];
    const model = (ks, kd) => H.kurguModel({ govdeler: G1, takozlar: H.dortluTakoz([300, 20, 650], 200, 150, 150, ks, kd), cozucu: {} });
    const once = H.coz(model([null, null, e.sz], [null, null, e.dz]));                // tahminsiz: radyal boş
    expect(once.error && once.error.length).toBeGreaterThan(0);
    const R = H.coz(model([e.sx, e.sy, e.sz], [e.dx, e.dy, e.dz]));
    expect(R.error).toBeUndefined();
    expect(R.modes).toHaveLength(6);
    R.modes.forEach((m) => expect(Number.isFinite(m.f_Hz) && m.f_Hz > 0).toBe(true));
  });
});

describe('PARAMETRİK — eksik ve tahminli tip aday değil', () => {
  global.veMntKatalog = require('../../js/mount-katalog.js');
  Object.keys(cp).forEach((k) => { if (global[k] === undefined) global[k] = cp[k]; });
  const P = require('../../js/cp-mount-param.js');
  test('adaylar yalnız tam ve tahminsiz tipler; Takoz Özellikleri\'nde radyali girilen AMC kodu aday olur', () => {
    const M = { lib: cp.veMntGetLibraryMap() };
    const ad = P._mntParamAdaylar(M, null).map((a) => a.key);
    expect(ad).toHaveLength(27);                                                // 24 + teknik resimlerin 3 kodu
    expect(ad).toEqual(expect.arrayContaining(['amc137061', 'amc137062', 'amc137961']));
    expect(ad).not.toContain('amc137962');
    expect(ad.filter((k) => /^ap/.test(k))).toEqual([]);                              // A+P: dinamik tahmini
    const lib = { id: 'lib1', type: 'mnt-library', def: componentDefs['mnt-library'],
      data: { mounts: [], overrides: { amc137962: { sx: 1300, sy: 900, dx: 1820, dy: 1260 } } } };
    global.nodes = [lib];
    const ad2 = P._mntParamAdaylar({ lib: cp.veMntGetLibraryMap() }, null).map((a) => a.key);
    expect(ad2).toHaveLength(28);
    expect(ad2).toContain('amc137962');
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
  test('137962\'nin resmindeki kutu 137963\'ün kopyası — yazılmadı; radyali Cone 38\'in ölçümlerinden tahmini', () => {
    const e = L.amc137962;
    expect(A.RESIM['137962']).toBeUndefined();
    expect([e.sz, e.tahmin, e.sx === 1800]).toEqual([700, ['sx', 'sy', 'dx', 'dy'], false]);
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
