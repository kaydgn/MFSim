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
 *   • kütüphane: anahtar, ad, kapasite; dinamik YOK → tip eksik, taramaya aday değil;
 *   • LMT-1433-00 ↔ konik yatak 026 S 1 (flanş ölçüsü) ve künyesi; "Mount 1"e eş yazılmaz;
 *   • görseller diskte ve künyede; Takoz Özellikleri'nde kapasite yazılmaz (Canlı Not 65).
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
  test('rijitlik: konikte F/S her eksende, H-takozda yazılı C, marine ve jeneratörde yalnız Z; dinamik YOK', () => {
    const r = (k) => { const e = L['ap' + k]; return [e.sx, e.sy, e.sz, e.dx, e.dy, e.dz]; };
    expect(r('1221402501')).toEqual([1218, 1218, 389, null, null, null]);   // 4.870/4 · 1.360/3,5
    expect(r('1221402604')).toEqual([2235, 1166, 800, null, null, null]);   // 026 S 3: X > Y
    expect(r('1221470202')).toEqual([600, 600, 300, null, null, null]);
    expect(r('1221440675')).toEqual([null, null, 2350, null, null, null]);  // 9.400/4
    expect(r('1220640104')).toEqual([null, null, 2500, null, null, null]);
  });
  test('dinamik yayımlanmıyor → bütün A+P katalog tipleri eksik, taramaya aday değil', () => {
    kodlar.forEach((k) => expect([k, cp._mntLibTam(L['ap' + k])]).toEqual([k, false]));
    const map = cp.veMntGetLibraryMap();
    expect(cp._mntLibTur(map.ap1221402503)).toBe('eksik');
    expect(map.ap1221402503.ap).toMatchObject({ kod: '1221402503', tip: '026-s1', aile: 'konus', sinif: 'medium', sh: 60 });
  });
  test('ilk 24 girdi yerinde; A+P kodları AMC\'nin ardında, ailenin · tipin · sertliğin sırasıyla', () => {
    const k = Object.keys(L);
    expect(k.slice(0, 2)).toEqual(['amc55sha', '57RS313773']);
    expect(k.slice(-86)).toEqual(P.kodlar().map((x) => 'ap' + x));
    expect(P.kodlar().slice(0, 3)).toEqual(['1221402001', '1221402003', '1221402004']);   // 021 yumuşak · orta · sert
    const s = cp._mntLibSirali(cp.veMntGetLibraryList().filter((e) => e.builtin && e.marka === 'Angst+Pfister'));
    expect(s.slice(0, 7).map((e) => e.key)).toEqual(['amc55sha', 'lmt1433-00-40sh', 'lmt1433-00-55sh', 'lmt1433-00-70sh',
      'bmc-mount1-40sh', 'bmc-mount1-55sh', 'bmc-mount1-70sh']);
    expect(s.slice(7).map((e) => e.ap.kod)).toEqual(P.kodlar());
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

describe('LMT-1433 — programdaki BMC girdileri', () => {
  test('LMT-1433-00\'ın flanşı (BMC FEA: 107 × 90, delik 80 × 65) konik yatak 026\'nın ölçüsü; radyal X = Y → 026 S 1', () => {
    expect(TIP['026-s1'][5]).toMatchObject({ boy: 107, en: 90, dBoy: 80, dEn: 65 });
    expect(TIP['026-s3'][5]).toMatchObject({ boy: 107, en: 90, dBoy: 80, dEn: 65 });
    ['lmt1433-00-40sh', 'lmt1433-00-55sh', 'lmt1433-00-70sh'].forEach((k) => expect(P.ESLES[k]).toBe('026-s1'));
    expect(P.ESLES['bmc-mount1-55sh']).toBeUndefined();                              // ölçüsü belgesiz
  });
  test('FEA tablosu ↔ katalog: Z orta ve sertte %3 içinde (kayıt — FEA\'nın X\'i %13–15 düşük)', () => {
    const z = (k) => KOD[k][3] / KOD[k][4];
    expect(Math.abs(L['lmt1433-00-55sh'].sz / z('1221402503') - 1)).toBeLessThan(0.03);   // 750 ↔ 728,6
    expect(Math.abs(L['lmt1433-00-70sh'].sz / z('1221402504') - 1)).toBeLessThan(0.03);   // 1.150 ↔ 1.171,4
    expect(+(L['lmt1433-00-70sh'].sx / (KOD['1221402504'][5] / KOD['1221402504'][6]) - 1).toFixed(2)).toBe(-0.15);
  });
});

describe('GÖRSELLER — e-mağazanın fotoğrafı ve katalogun ölçülü çizimi', () => {
  const G = require('../../tools/takoz-gorsel.js');
  const dir = path.join(__dirname, '../../assets/takoz/ap');
  const kunye = JSON.parse(fs.readFileSync(path.join(dir, 'kunye.json'), 'utf8'));
  test('her tipin fotoğrafı ve çizimi diskte; üretecin listesiyle birebir', () => {
    const gerek = new Set();
    Object.keys(TIP).forEach((t) => { gerek.add('urun-' + t); gerek.add('cizim-' + TIP[t][3]); });
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
  test('konik yatak: çizim + fotoğraf ve veri; kapasite yazılmaz (Canlı Not 65)', () => {
    const d = kunye('ap1221402503');
    const k = d.querySelector('.ve-mnt-amc[data-ap="12.2140.2503"]');
    expect(k).not.toBeNull();
    expect([...k.querySelectorAll('img')].map((i) => i.getAttribute('src')))
      .toEqual(['assets/takoz/ap/cizim-k-026-s1.webp', 'assets/takoz/ap/urun-026-s1.webp']);
    expect(satirlar(k)).toEqual([['Kod', 'A+P 12.2140.2503'], ['Ürün ailesi', 'APSOvib® Conical bearing'], ['Tip', '026 S 1'],
      ['Sertlik', 'medium · ~60 ShA'], ['Ölçüler', '107 × 90 mm · delik 80 × 65 · Ø11'], ['Yükseklik', '49,5 mm'],
      ['Kaynak', 'A+P föyü Kasım 2015 · e-mağaza 10.11.2026']]);
    expect(d.textContent).not.toMatch(/Taşıma kapasitesi|Maks\. eksenel yük|Maks\. yük|2\.550 N|259,9/i);
  });
  test('H-takoz toleransı, marine ağırlığı; LMT-1433-00\'da katalog eşi, "Mount 1"de künye yok', () => {
    expect(satirlar(kunye('ap1221470202').querySelector('.ve-mnt-amc'))).toContainEqual(['Rijitlik toleransı', '±%20']);
    expect(satirlar(kunye('ap1221440440').querySelector('.ve-mnt-amc'))).toContainEqual(['Ağırlık', '337 g']);
    const es = kunye('lmt1433-00-55sh').querySelector('.ve-mnt-amc');
    expect(satirlar(es)).toEqual([['Üretici kodu', 'LMT-1433-00'], ['Katalog eşi', 'APSOvib® Conical bearing 026 S 1'],
      ['Ölçüler', '107 × 90 mm · delik 80 × 65 · Ø11'], ['Yükseklik', '49,5 mm'], ['Kaynak', 'BMC FEA raporu · 02.10.2018 · 12.02.2019']]);
    expect(kunye('bmc-mount1-55sh').querySelector('.ve-mnt-amc')).toBeNull();
  });
});
