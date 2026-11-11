/**
 * Angst+Pfister APSOvib® takoz veritabanı (js/mount-ap.js) — kaynağa karşı kapı
 * ───────────────────────────────────────────────────────────────────────────
 * Kullanıcı isteği (2026-11-10): "program içinde kayıtlı olan Angst-Pfister
 * takozlarını da araştırmanı, ne bulursan programa eklemeni istiyorum".
 *
 * Kaynak üreticinin kendisi: APSOparts e-mağazasının makale tabloları (2026-11-10,
 * güncel) ve föyler (konik yatak 2015 · H-takoz 2018 · marine 2017) + genel katalog
 * (2017). Aşağıdaki sayılar föylerden BAĞIMSIZ yazılı: tablo kayarsa kırmızı.
 *
 * Test neyi kilitliyor:
 *   • envanter: 5 aile · 24 tip · 86 kod; birim kuralı (konik ve jeneratörde kg = daN);
 *   • rijitlik: konikte F/S her eksende, H-takozda yazılı C, marine ve jeneratörde Z;
 *   • üç ayrışmanın kararı (marine 0375 yay yolu, marine tip 3 sertliği, H-takoz C ↔ F/S);
 *   • kütüphane: anahtar, ad, kapasite; dinamik TAHMİNİ (Canlı Not 113'ün kuralı): NR'de
 *     (Sh+20)/50, CR H-takozda AMC-EO'nun NR medyanı — çözülür, taramaya aday değil;
 *     marine ve jeneratörde X · Y yayımlanmıyor → eksik, girilince dinamiği aynı oranla;
 *   • LMT-1433-00 (LASPAR kataloğunda, js/mount-laspar.js) ↔ konik yatak 026 S 1 (flanş ölçüsü) —
 *     LASPAR künyesinde "A+P eşi"; "Mount 1"e eş yazılmaz;
 *   • görsel yalnız tipin teknik resmi, Tip satırının (i) düğmesinde (Canlı Not 111);
 *     Takoz Özellikleri'nde kapasite yazılmaz (Canlı Not 65).
 */
const fs = require('fs');
const path = require('path');
const core = require('../../js/mount-core.js');
global.veMountCore = core;
const stubs = stubGlobals({ saveState: jest.fn(), showToast: jest.fn(), showNodeProperties: jest.fn() });
eval(fs.readFileSync(path.join(__dirname, '../../js/components.js'), 'utf8'));
global.componentDefs = componentDefs;
const P = require('../../js/mount-ap.js');
const cp = require('../../js/cp-mount.js');

beforeEach(() => { resetStubs(stubs); global.nodes = []; });

const L = cp.VE_MOUNT_LIBRARY;
const KOD = P.KOD, TIP = P.TIP;
const kodlar = Object.keys(KOD);
const aile = (k) => TIP[KOD[k][0]][0];

describe('ENVANTER — üreticinin tablosu', () => {
  test('5 aile · 24 tip · 86 kod; makale numarası 10 hane, tekil; her kodun tipi tanımlı', () => {
    expect(Object.keys(P.AILE)).toEqual(['konus', 'hd', 'h', 'marine', 'gen']);
    expect(Object.keys(TIP)).toHaveLength(24);
    expect(kodlar).toHaveLength(86);
    kodlar.forEach((k) => { expect(k).toMatch(/^12\d{8}$/); expect(TIP[KOD[k][0]]).toBeDefined(); });
    const say = {}; kodlar.forEach((k) => { say[aile(k)] = (say[aile(k)] || 0) + 1; });
    expect(say).toEqual({ konus: 27, hd: 6, h: 32, marine: 13, gen: 8 });
    expect(P.noktali('1221402503')).toBe('12.2140.2503');
  });
  test('föylerden çiviler (N): konik 2015 · H-takoz 2018 · marine 2017 (e-mağaza) · jeneratör', () => {
    // konik yatak 026 S 1 yumuşak: 1.360 N / 3,5 mm · 4.870 N / 4 mm (X = Y) — e-mağaza 136 · 487 "kg" (daN)
    expect(KOD['1221402501'].slice(3, 9)).toEqual([1360, 3.5, 4870, 4, 4870, 4]);
    expect(KOD['1221402604'].slice(3, 9)).toEqual([2800, 3.5, 8940, 4, 4665, 4]);      // 026 S 3 sert (Y yumuşak)
    expect(KOD['1221403004'].slice(3, 9)).toEqual([30000, 7, 30000, 3.5, 30000, 3.5]); // 05719 sert
    expect(KOD['1221400901'].slice(3, 9)).toEqual([2000, 6.5, 2800, 4, 1360, 4]);      // HD 1 yumuşak
    expect(KOD['1221470504'].slice(3, 11)).toEqual([13000, 3.4, 4480, 1.6, null, null, 3800, 2800]);   // H II 238 sert
    expect(KOD['1221440440'].slice(3, 5).concat(KOD['1221440440'][11])).toEqual([340, 4, 337]);        // marine 0140
    expect(KOD['1220640101'].slice(3, 5).concat(KOD['1220640101'][9])).toEqual([7000, 12, 583]);       // GL 1-700
  });
  test('jeneratörde yazılı Cz = 10 · Fz[kg] / Sz → A+P\'nin kg\'ı daN', () => {
    kodlar.filter((k) => aile(k) === 'gen').forEach((k) => expect(Math.abs(KOD[k][3] / KOD[k][4] - KOD[k][9])).toBeLessThan(1));
  });
});

describe('AYRIŞMALAR — kaynaklar arası kararlar', () => {
  test('marine 0375: yay yolu 4 mm (e-mağaza ve föy; katalogda 6)', () => {
    expect(KOD['1221440675'][4]).toBe(4);
  });
  test('marine tip 3 sertliği föyün ve tip kodunun (0345 … 0375): 45 · 55 · 65 · 75 ShA', () => {
    expect(['1221440645', '1221440655', '1221440665', '1221440675'].map((k) => KOD[k][2])).toEqual([45, 55, 65, 75]);
  });
  test('H-takozda yazılı C alınır; F/S ile ayrışan beş kod kayıtlı', () => {
    const ayr = kodlar.filter((k) => aile(k) === 'h' && (Math.abs(KOD[k][3] / KOD[k][4] - KOD[k][9]) / KOD[k][9] > 0.02
      || Math.abs(KOD[k][5] / KOD[k][6] - KOD[k][10]) / KOD[k][10] > 0.02)).sort();
    expect(ayr).toEqual(['1221470302', '1221470402', '1221470604', '1221470704', '1221470804']);
    expect([L.ap1221470804.sz, L.ap1221470804.sx]).toEqual([1900, 5200]);                // III 135 sert: 4.800/3 değil
  });
});

describe('KÜTÜPHANE — VE_MOUNT_LIBRARY girdileri', () => {
  test('her kod "ap"+kod anahtarında, markası Angst+Pfister, adı kuralla, kapasitesi Fz/9,81', () => {
    kodlar.forEach((k) => {
      const e = L['ap' + k];
      expect(e.marka).toBe('Angst+Pfister');
      expect(e.name).toMatch(/^(Conical bearing( HD)? \S+( S \d)? \d{2} ShA|H-Mount (I|II|III) \d{3}-\d{3}-\d{3} (soft|middle soft|middle hard|hard)|Marine mount [123] \d{2} ShA|HD Generator bearing [12] \d{2} ShA) \(A\+P 12\.\d{4}\.\d{4}\)$/);
      expect(e.maxLoad).toBeCloseTo(KOD[k][3] / 9.81, 1);
    });
    expect(L.ap1221402503.name).toBe('Conical bearing 026 S 1 60 ShA (A+P 12.2140.2503)');
    expect(L.ap1221470202.name).toBe('H-Mount II 135-335-120 middle soft (A+P 12.2147.0202)');
  });
  test('rijitlik: konikte F/S her eksende, H-takozda yazılı C, marine ve jeneratörde yalnız Z; dinamik statik × oran', () => {
    const r = (k) => { const e = L['ap' + k]; return [e.sx, e.sy, e.sz, e.dx, e.dy, e.dz]; };
    expect(r('1221402501')).toEqual([1218, 1218, 389, 1583, 1583, 506]);   // 4.870/4 · 1.360/3,5 · 45 ShA → 1,3
    expect(r('1221402604')).toEqual([2235, 1166, 800, 4023, 2099, 1440]);  // 026 S 3: X > Y · 70 ShA → 1,8
    expect(r('1221470202')).toEqual([600, 600, 300, 912, 912, 456]);       // H-takoz (CR): 1,52
    expect(r('1221440675')).toEqual([null, null, 2350, null, null, 4465]); // 9.400/4 · 75 ShA → 1,9
    expect(r('1220640104')).toEqual([null, null, 2500, null, null, 4500]);
  });
  test('DİNAMİK TAHMİN: NR\'de (Sh+20)/50 (AMC\'nin NR konileri), CR H-takozda AMC-EO\'nun 9 NR kodunun medyanı', () => {
    kodlar.forEach((k) => {
      const D = P.dinOrani(k);
      if (aile(k) === 'h') expect([k, D.tur, D.din]).toEqual([k, 'medyan', 1.52]);
      else expect([k, D.tur, D.din]).toEqual([k, 'sertlik', Math.round((KOD[k][2] + 20) / 50 * 100) / 100]);
      expect(L['ap' + k].tahmin).toEqual(['dx', 'dy', 'dz']);
    });
    const A = require('../../js/mount-amc.js');                                 // medyan ölçümden yeniden
    const v = Object.keys(A.EO).filter((k) => A.TIP[A.KOD[k][0]][0] !== 'hidrolik').map((k) => {
      const s = A.EO[k][0], d = A.EO[k][1]; return (d[0] / s[0] + d[1] / s[1] + d[2] / s[2]) / 3;
    }).sort((a, b) => a - b);
    expect([v.length, +v[(v.length - 1) / 2].toFixed(2)]).toEqual([P.DIN_MEDYAN.n, P.DIN_MEDYAN.din]);
    const yasa = A.kodlar().filter((k) => A.KOD[k][1] != null && ['masif', 'kesikli'].indexOf(A.TIP[A.KOD[k][0]][0]) >= 0);
    yasa.forEach((k) => expect([k, A.KOD[k][4]]).toEqual([k, Math.round((A.KOD[k][1] + 20) / 50 * 100) / 100]));
  });
  test('konik · HD · H-takoz tam ve tahminli (çözülür, aday değil); marine ve jeneratör X · Y yok → eksik', () => {
    const say = {};
    kodlar.forEach((k) => { const a = aile(k), t = cp._mntLibTam(L['ap' + k]); say[a] = say[a] || [0, 0]; say[a][t ? 0 : 1]++; });
    expect(say).toEqual({ konus: [27, 0], hd: [6, 0], h: [32, 0], marine: [0, 13], gen: [0, 8] });
    const map = cp.veMntGetLibraryMap();
    expect([cp._mntLibTahmin(map.ap1221402503).length > 0, cp._mntLibTam(map.ap1221440455)]).toEqual([true, false]);   // tahminli · eksik
    expect(map.ap1221402503.ap).toMatchObject({ kod: '1221402503', tip: '026-s1', aile: 'konus', sinif: 'medium', sh: 60 });
  });
  test('girilen değer tahminden çıkar: marinede X · Y girilince dinamiği aynı oranla kurulur, tip tamamlanır', () => {
    const lib = { id: 'lib1', type: 'mnt-library', def: componentDefs['mnt-library'],
      data: { mounts: [], overrides: { ap1221440455: { sx: 120, sy: 120 }, ap1221402503: { dz: 1200 } } } };
    global.nodes = [lib];
    const map = cp.veMntGetLibraryMap(), m = map.ap1221440455, k = map.ap1221402503;
    expect([m.sx, m.sy, m.sz, m.dx, m.dy, m.dz, m.tahmin, cp._mntLibTam(m)]).toEqual([120, 120, 170, 180, 180, 255, ['dx', 'dy', 'dz'], true]);
    expect([k.dz, k.tahmin]).toEqual([1200, ['dx', 'dy']]);
    expect(L.ap1221440455.sx).toBeNull();                                       // fabrika girdisi değişmez
  });
  test('ilk 24 girdi yerinde; A+P kodları AMC\'nin ardında (LASPAR\'dan önce), ailenin · tipin · sertliğin sırasıyla', () => {
    const k = Object.keys(L), nLp = Object.keys(require('../../js/mount-laspar.js').KOD).length;
    expect(k.slice(0, 2)).toEqual(['amc55sha', 'a26-a']);
    expect(k.slice(-86 - nLp, -nLp)).toEqual(P.kodlar().map((x) => 'ap' + x));
    expect(P.kodlar().slice(0, 3)).toEqual(['1221402001', '1221402003', '1221402004']);   // 021 yumuşak · orta · sert
    const s = cp._mntLibSirali(cp.veMntGetLibraryList().filter((e) => e.builtin && e.marka === 'Angst+Pfister'));
    expect(s.map((e) => e.ap.kod)).toEqual(P.kodlar());                                    // markada yalnız katalog kodları
  });
  test('Takoz Özellikleri\'nde tamamlanan A+P tipi (dinamik) aday olur', () => {
    global.veMntKatalog = require('../../js/mount-katalog.js');
    Object.keys(cp).forEach((x) => { if (global[x] === undefined) global[x] = cp[x]; });
    const PA = require('../../js/cp-mount-param.js');
    const lib = { id: 'lib1', type: 'mnt-library', def: componentDefs['mnt-library'],
      data: { mounts: [], overrides: { ap1221402503: { dx: 2400, dy: 2400, dz: 1020 } } } };
    global.nodes = [lib];
    expect(PA._mntParamAdaylar({ lib: cp.veMntGetLibraryMap() }, null).map((a) => a.key)).toContain('ap1221402503');
  });
});

describe('LMT-1433 — programdaki BMC girdileri (LASPAR)', () => {
  test('LMT-1433-00\'ın flanşı (LASPAR kataloğu: 107 × 90, delik 80 × 65) konik yatak 026\'nın ölçüsü; radyal X = Y → 026 S 1', () => {
    const LP = require('../../js/mount-laspar.js');
    expect(TIP['026-s1'][4]).toMatchObject({ boy: 107, en: 90, dBoy: 80, dEn: 65 });
    expect(TIP['026-s3'][4]).toMatchObject({ boy: 107, en: 90, dBoy: 80, dEn: 65 });
    expect(LP.TIP['1433'][3]).toMatchObject({ boy: 107, en: 90, dBoy: 80, dEn: 65 });
    expect(LP.AP_ESI['1433']).toBe('026-s1');
    expect(['lmt1433-00-40sh', 'amc55sha', 'bmc-mount1-55sh'].map((k) => L[k].marka)).toEqual(['LASPAR', 'LASPAR', 'LASPAR']);
  });
  test('FEA tablosu ↔ katalog: Z orta ve sertte %3 içinde (kayıt — FEA\'nın X\'i %13–15 düşük)', () => {
    const z = (k) => KOD[k][3] / KOD[k][4];
    expect(Math.abs(L['lmt1433-00-55sh'].sz / z('1221402503') - 1)).toBeLessThan(0.03);   // 750 ↔ 728,6
    expect(Math.abs(L['lmt1433-00-70sh'].sz / z('1221402504') - 1)).toBeLessThan(0.03);   // 1.150 ↔ 1.171,4
    expect(+(L['lmt1433-00-70sh'].sx / (KOD['1221402504'][5] / KOD['1221402504'][6]) - 1).toFixed(2)).toBe(-0.15);
  });
});

describe('GÖRSELLER — yalnız katalogun ölçülü çizimi (Canlı Not 111)', () => {
  const G = require('../../tools/takoz-gorsel.js');
  const dir = path.join(__dirname, '../../assets/takoz/ap');
  const kunye = JSON.parse(fs.readFileSync(path.join(dir, 'kunye.json'), 'utf8'));
  test('her tipin çizimi diskte; fotoğraf yok; üretecin listesiyle birebir', () => {
    const gerek = new Set();
    Object.keys(TIP).forEach((t) => gerek.add('cizim-' + TIP[t][3]));
    const disk = fs.readdirSync(dir).filter((f) => f.endsWith('.webp')).map((f) => f.replace('.webp', ''));
    expect(disk.sort()).toEqual([...gerek].sort());
    expect(G.listesiAp().map((x) => x.ad).sort()).toEqual([...gerek].sort());
  });
  test('künye diskle birebir: kaynak üreticinin adresi, bayt dosyanınki', () => {
    Object.keys(kunye).forEach((ad) => {
      expect(kunye[ad].kaynak).toMatch(/^https:\/\/www\.(apsoparts|angst-pfister)\.com\//);
      expect(fs.statSync(path.join(dir, ad + '.webp')).size).toBe(kunye[ad].bayt);
    });
  });
});

describe('KÜNYE — Takoz Özellikleri', () => {
  const dom = (h) => { const d = document.createElement('div'); d.innerHTML = h; return d; };
  const kunye = (anahtar) => {
    const lib = { id: 'lib1', type: 'mnt-library', def: componentDefs['mnt-library'], data: { mounts: [], _selKey: anahtar } };
    global.nodes = [lib];
    return dom(cp.getMntLibraryPropertiesHTML(lib));
  };
  const satirlar = (k) => [...k.querySelectorAll('tr')].map((r) => [r.querySelector('th').textContent, r.querySelector('td').textContent]);
  test('konik yatak: yalnız veri, resim (i)\'de; kapasite yazılmaz (Canlı Not 65 · 111)', () => {
    const d = kunye('ap1221402503');
    const k = d.querySelector('.ve-mnt-amc[data-ap="12.2140.2503"]');
    expect(k).not.toBeNull();
    expect(d.querySelectorAll('img')).toHaveLength(0);
    expect(d.querySelector('.mntlib-sec > .mntlib-tip > button.mntlib-bilgi').getAttribute('data-ap')).toBe('1221402503');
    expect(P.kunye('1221402503').cizim).toBe('assets/takoz/ap/cizim-k-026-s1.webp');
    expect('foto' in P.kunye('1221402503')).toBe(false);
    expect(satirlar(k)).toEqual([['Kod', 'A+P 12.2140.2503'], ['Ürün ailesi', 'APSOvib® Conical bearing'], ['Tip', '026 S 1'],
      ['Sertlik', 'medium · ~60 ShA'], ['Ölçüler', '107 × 90 mm · delik 80 × 65 · Ø11'], ['Yükseklik', '49,5 mm']]);
    // KAYNAK (i)'DE (Canlı Not 139)
    const ki = k.querySelector('.ve-mnt-kaynak-i');
    expect(ki.closest('tr').querySelector('th').textContent).toBe('Ürün ailesi');
    expect(ki.getAttribute('data-ipucu')).toBe('Kaynak · A+P föyü Kasım 2015 · e-mağaza 10.11.2026');
    expect(d.textContent).not.toMatch(/Taşıma kapasitesi|Maks\. eksenel yük|Maks\. yük|2\.550 N|259,9/i);
  });
  test('H-takoz toleransı, marine ağırlığı; A+P künyesi yalnız A+P kodunda', () => {
    expect(satirlar(kunye('ap1221470202').querySelector('.ve-mnt-amc'))).toContainEqual(['Rijitlik toleransı', '±%20']);
    expect(satirlar(kunye('ap1221440440').querySelector('.ve-mnt-amc'))).toContainEqual(['Ağırlık', '337 g']);
    expect(kunye('lmt1433-00-55sh').querySelector('.ve-mnt-amc[data-ap]')).toBeNull();   // LASPAR'ın künyesi (mount-laspar.test.js)
  });
  test('Rijitlik: tahminli dinamik hücreler işaretli, ipucu oranı ve kaynağını yazar', () => {
    const d = kunye('ap1221402503');
    expect([...d.querySelectorAll('td.tah input')].map((i) => i.id.replace(/^ve-mnt-lib-|-lib1$/g, ''))).toEqual(['dx', 'dy', 'dz']);
    expect(d.querySelector('td.tah').getAttribute('title')).toBe('Tahmini · statik × 1,60 · 60 ShA, (Sh + 20)/50 · AMC NR koniler');
    expect(kunye('ap1221470202').querySelector('td.tah').getAttribute('title')).toBe('Tahmini · statik × 1,52 · AMC-EO, 9 NR kodun medyanı');
    expect(d.querySelectorAll('td.zor')).toHaveLength(0);
  });
  test('(i) A+P\'nin teknik resmini açar; bilinmeyen kodda hiçbir şey', () => {
    const BSK = require('../../js/baslangic-sayfa.js');
    global.veBasResimGoster = BSK.veBasResimGoster;
    try {
      const b = document.createElement('button'); b.setAttribute('data-ap', '1221470202'); document.body.appendChild(b);
      expect(cp.veMntLibCizimAc(b)).toBe(true);
      const pen = document.querySelector('#ve-bas-buyuk-perde .ve-bas-buyuk-pencere');
      expect([pen.querySelector('#ve-bas-buyuk-baslik').textContent, pen.querySelector('img').getAttribute('src')])
        .toEqual(['H-Mount II 135-335-120 · teknik resim', 'assets/takoz/ap/cizim-h-2.webp']);
      BSK.veBasResimKapat();
      const yok = document.createElement('button'); yok.setAttribute('data-ap', '1299999999');
      expect(cp.veMntLibCizimAc(yok)).toBe(false);
    } finally { delete global.veBasResimGoster; BSK.veBasResimKapat(); document.body.innerHTML = ''; }
  });
});
