/**
 * LASPAR takoz veritabanı (js/mount-laspar.js) — kaynağa karşı kapı
 * ───────────────────────────────────────────────────────────────────────────
 * Kullanıcı isteği (2026-11-11): "Programda şu takozlar var [TK035 · TK040 · TK050].
 * Bu takozların marka-model vs bulup, bu markadan başka ne takoz bulabiliyorsan
 * ekleyebilir misin? Tıpkı diğer takozlarda yaptığımız gibi."
 *
 * Kaynak: LASPAR genel kataloğu 2018 (laspargroup.com → Kataloglarımız), anti-vibrasyon
 * bölümü. Aşağıdaki sayılar katalogdan BAĞIMSIZ yazılı: tablo kayarsa kırmızı. GRAFİK
 * tablosu katalogun "eksenel basma karakteristikleri" grafiklerinden ölçüldü (PDF'in vektör
 * çizgilerinin uç noktaları, ızgarayla kalibre): tablonun bağımsız doğrulaması.
 *
 * Test neyi kilitliyor:
 *   • kimlik: LASPAR'ın kod kuralı (LMT/MLMT-xxxx-yy-TKnn, TKnn = Shore A); programın TK035 ·
 *     TK040 · TK050'si MLMT-0216-33'ün sertlikleri, LMT-1433-00 katalogdaki konik 1433;
 *   • envanter: 5 aile · 17 tip · 43 kod; katalogun tablosundan çiviler; grafik ↔ tablo;
 *   • iki ayrışmanın kararı (kabin tablosunda F/W sütunlarının birimi, temelde F = W·g);
 *   • kütüphane: anahtar, ad, kapasite (W), kz; konikte radyal LMT-1433-00'ın FEA oranıyla,
 *     dinamik (Sh+20)/50 — TAHMİNİ (çözülür, aday değil); öteki ailelerde X · Y yok → eksik;
 *   • künye: katalog tipinde veri ve (i); programın LASPAR girdisinde kod ve kaynak;
 *   • görsel yalnız tipin teknik resmi (Canlı Not 111), diskte ve künyede.
 */
const fs = require('fs');
const path = require('path');
const core = require('../../js/mount-core.js');
global.veMountCore = core;
const stubs = stubGlobals({ saveState: jest.fn(), showToast: jest.fn(), showNodeProperties: jest.fn() });
eval(fs.readFileSync(path.join(__dirname, '../../js/components.js'), 'utf8'));
global.componentDefs = componentDefs;
const P = require('../../js/mount-laspar.js');
const cp = require('../../js/cp-mount.js');

beforeEach(() => { resetStubs(stubs); global.nodes = []; });

const L = cp.VE_MOUNT_LIBRARY;
const KOD = P.KOD, TIP = P.TIP;
const kodlar = Object.keys(KOD);
const aile = (k) => TIP[KOD[k][0]][0];
const g = 9.81;

describe('KİMLİK — programın TK ve LMT takozları LASPAR\'ın', () => {
  test('kod kuralı: LMT/MLMT-xxxx-yy-TKnn, TKnn kauçuğun Shore A sertliği (katalogun her kodu)', () => {
    kodlar.forEach((k) => {
      expect(k).toMatch(/^M?LMT-\d{4}(-\d{2}-TK\d{2})?$/);
      const m = /-TK(\d{2})$/.exec(k);
      if (m) expect([k, KOD[k][1]]).toEqual([k, Number(m[1])]);
    });
    expect(KOD['LMT-1887'][1]).toBe(50);                                          // katalogda "NR50"
  });
  test('TK035 · TK040 · TK050 = MLMT-0216-33\'ün üç sertliği; LMT-1433-00 katalogdaki konik 1433', () => {
    expect(['TK035', 'TK040', 'TK050'].map((k) => P.ESKI[k].kod)).toEqual(['MLMT-0216-33-TK035', 'MLMT-0216-33-TK040', 'MLMT-0216-33-TK050']);
    expect(['TK035', 'TK040', 'TK050'].map((k) => L[k].marka)).toEqual(['LASPAR', 'LASPAR', 'LASPAR']);
    expect(['lmt1433-00-40sh', 'lmt1433-00-55sh', 'lmt1433-00-70sh'].map((k) => P.ESKI[k].tip)).toEqual(['1433', '1433', '1433']);
    expect(KOD['LMT-1433-00-TK60'][0]).toBe('1433');
    // değerler değişmedi (kaynakları raporlar)
    expect([L.TK040.sx, L.TK040.sz, L.TK040.dx, L.TK040.dz]).toEqual([515, 242, 740, 335]);
    expect([L['lmt1433-00-70sh'].sx, L['lmt1433-00-70sh'].sz]).toEqual([2500, 1150]);
  });
  test('LMT-1433-00\'ın FEA Z\'si katalogla uyumlu: 40 ShA ↔ TK45 · 55 ↔ TK60 · 70 ↔ TK70, %7 içinde', () => {
    [['lmt1433-00-40sh', 'LMT-1433-00-TK45'], ['lmt1433-00-55sh', 'LMT-1433-00-TK60'], ['lmt1433-00-70sh', 'LMT-1433-00-TK70']]
      .forEach(([f, k]) => expect([f, Math.abs(L[f].sz / P.kz(k) - 1) < 0.07]).toEqual([f, true]));
  });
});

describe('ENVANTER — katalogun tablosu', () => {
  test('5 aile · 17 tip · 43 kod; aileler 18 · 18 · 2 · 4 · 1', () => {
    expect(Object.keys(P.AILE)).toEqual(['konik', 'mobil', 'kabin', 'sok', 'temel']);
    expect(P.TIP_SIRA.slice().sort()).toEqual(Object.keys(TIP).sort());
    expect(Object.keys(TIP)).toHaveLength(17);
    expect(kodlar).toHaveLength(43);
    const say = {}; kodlar.forEach((k) => { say[aile(k)] = (say[aile(k)] || 0) + 1; });
    expect(say).toEqual({ konik: 18, mobil: 18, kabin: 2, sok: 4, temel: 1 });
  });
  test('tablodan çiviler: [F N, W kg, S mm]', () => {
    const c = (k) => KOD[k].slice(2, 5);
    expect(c('LMT-1423-00-TK45')).toEqual([355, 36, 3.0]);
    expect(c('LMT-1433-00-TK70')).toEqual([3817, 389, 3.5]);
    expect(c('LMT-1434-00-TK70')).toEqual([10665, 1087, 4.0]);
    expect(c('LMT-1881-00-TK60')).toEqual([16670, 1700, 6.0]);
    expect(c('MLMT-0610-03-TK65')).toEqual([7943, 810, null]);
    expect(c('LMT-1875-00-TK60')).toEqual([5884, 600, 17]);
    expect(TIP['1433'][3]).toMatchObject({ boy: 107, en: 90, dBoy: 80, dEn: 65, dCap: 11, yuk: 56 });
  });
  test('tablonun F (N) ile W (kg) sütunu tutarlı: W = F / 9,81 (± %0,1 ya da 0,5 kg) — konik, mobil, şok', () => {
    kodlar.filter((k) => ['konik', 'mobil', 'sok'].indexOf(aile(k)) >= 0)
      .forEach((k) => expect([k, Math.abs(KOD[k][2] / g - KOD[k][3]) <= Math.max(0.5, KOD[k][3] / 1000)]).toEqual([k, true]));
  });
  test('mobilde LMT (ayar saplamalı) ve MLMT çeşidi aynı gövde: aynı yük ve aynı eğim', () => {
    ['608', '609', '610'].forEach((n) => {
      const lm = kodlar.filter((k) => TIP[KOD[k][0]][1] === n && /^LMT/.test(k));
      const mm = kodlar.filter((k) => TIP[KOD[k][0]][1] === n && /^MLMT/.test(k));
      expect(lm.map((k) => KOD[k].slice(1, 4))).toEqual(mm.map((k) => KOD[k].slice(1, 4)));
      expect(lm.map((k) => P.kz(k))).toEqual(mm.map((k) => P.kz(k)));
    });
  });
});

// Grafikten ölçülen (vektör çizginin ucu, ızgarayla kalibre): [W kg, S mm] — orijinden geçen çizgi.
const GRAFIK = {
  'LMT-1423-00-TK45': [36.07, 2.996], 'LMT-1423-00-TK60': [72.71, 2.996], 'LMT-1423-00-TK70': [127.1, 2.996],
  'LMT-1436-00-TK45': [81.11, 3.498], 'LMT-1436-00-TK60': [136.45, 3.498], 'LMT-1436-00-TK70': [196.57, 3.498],
  'LMT-1433-00-TK45': [160.31, 3.498], 'LMT-1433-00-TK60': [250.38, 3.498], 'LMT-1433-00-TK70': [389.31, 3.498],
  'LMT-1435-00-TK45': [438.94, 3.502], 'LMT-1435-00-TK60': [618.32, 3.502], 'LMT-1435-00-TK70': [988.55, 3.502],
  'LMT-1434-00-TK45': [531.29, 4.011], 'LMT-1434-00-TK60': [824.42, 4.011], 'LMT-1434-00-TK70': [1085.49, 4.011],
  'LMT-1881-00-TK45': [951.15, 6.007], 'LMT-1881-00-TK60': [1699.25, 6.007], 'LMT-1881-00-TK70': [2703.81, 6.007],
  'LMT-1880-00-TK60': [400.69, 8.949], 'LMT-1875-00-TK60': [600.7, 16.957],
  'LMT-0154-01-TK55': [919.12, 2.144], 'LMT-0502-00-TK45': [203.88, 6.224], 'LMT-1887': [3141.5, 7.5]
};
// Grafiğin eğimi [kg/mm] — çizgi tablonun noktasından öteye uzanıyor ya da orijinden geçmiyor.
const EGIM_KG = { 'LMT-1880-00-TK45': 16.727, 'LMT-1875-00-TK45': 14.28,
  608: [12.918, 15.728, 21.443], 609: [33.998, 50.279, 83.798], 610: [77.795, 115.828, 154.041] };

describe('GRAFİK ↔ TABLO — katalogun iki gösterimi aynı takozu anlatıyor', () => {
  test('konik: çizgi tablonun noktasında biter (18/18, yük %1, sehim 0,02 mm içinde)', () => {
    kodlar.filter((k) => aile(k) === 'konik').forEach((k) => {
      const [W, S] = GRAFIK[k];
      expect([k, Math.abs(W / KOD[k][3] - 1) < 0.01, Math.abs(S - KOD[k][4]) < 0.02]).toEqual([k, true, true]);
    });
  });
  test('şok: TK60 çizgisi tablonun noktasında, TK45\'in eğimi tablonun F/S\'i (%2 içinde)', () => {
    ['LMT-1880-00-TK60', 'LMT-1875-00-TK60'].forEach((k) =>
      expect([k, Math.abs(GRAFIK[k][0] / KOD[k][3] - 1) < 0.01, Math.abs(GRAFIK[k][1] - KOD[k][4]) < 0.1]).toEqual([k, true, true]));
    ['LMT-1880-00-TK45', 'LMT-1875-00-TK45'].forEach((k) =>
      expect([k, Math.abs(EGIM_KG[k] * g / P.kz(k) - 1) < 0.02]).toEqual([k, true]));
  });
  test('AYRIŞMA — kabin: tablonun "F (N)" sütunu kg, "W (kg)" sütunu kN; grafik 918 · 204 kg gösteriyor', () => {
    expect([KOD['LMT-0154-01-TK55'][3], KOD['LMT-0502-00-TK45'][3]]).toEqual([918, 204]);       // tabloda "F" sütununda
    ['LMT-0154-01-TK55', 'LMT-0502-00-TK45'].forEach((k) => {
      expect([k, Math.abs(GRAFIK[k][0] / KOD[k][3] - 1) < 0.005]).toEqual([k, true]);
      expect([k, Math.abs(KOD[k][2] - KOD[k][3] * g) < 1]).toEqual([k, true]);                 // F = W·g
    });
  });
  test('AYRIŞMA — temel: tabloda F "31" (kN) — W = 3.130 kg alındı, grafik 7,5 mm\'de 3.142 kg', () => {
    const k = 'LMT-1887';
    expect(KOD[k].slice(2, 5)).toEqual([30705, 3130, 7.5]);
    expect(Math.abs(KOD[k][2] / 1000 - 31) < 0.5).toBe(true);
    expect(Math.abs(GRAFIK[k][0] / KOD[k][3] - 1) < 0.005).toBe(true);
  });
  test('mobil: tabloda sehim yok — kz grafiğin eğimi (N/mm, yuvarlı)', () => {
    [608, 609, 610].forEach((n) => [45, 55, 65].forEach((sh, i) =>
      expect([n, sh, P.EGIM[n][sh]]).toEqual([n, sh, Math.round(EGIM_KG[n][i] * g)])));
  });
});

describe('KÜTÜPHANE — VE_MOUNT_LIBRARY girdileri', () => {
  test('her kod "lp-"+kod anahtarında, markası LASPAR, adı kuralla, kapasitesi W (kg), kz F/S ya da grafik', () => {
    kodlar.forEach((k) => {
      const e = L[P.anahtar(k)];
      expect(e.marka).toBe('LASPAR');
      expect(e.name).toBe(P.ad(k));
      expect(e.name).toMatch(/^(Conical mount|Universal mobile mount|Cabin mount|Heavy duty shock mount|Foundation mount) \d{3,4} \d{2} ShA \(LASPAR M?LMT-[0-9A-Z-]+\)$/);
      expect(e.maxLoad).toBe(KOD[k][3]);
      expect(e.sz).toBe(KOD[k][4] ? Math.round(KOD[k][2] / KOD[k][4]) : P.EGIM[TIP[KOD[k][0]][1]][KOD[k][1]]);
    });
    expect(L['lp-lmt-1433-00-tk60'].name).toBe('Conical mount 1433 60 ShA (LASPAR LMT-1433-00-TK60)');
    expect(L['lp-mlmt-0608-04-tk45'].name).toBe('Universal mobile mount 608 45 ShA (LASPAR MLMT-0608-04-TK45)');
  });
  test('konik: radyal LMT-1433-00\'ın FEA oranıyla (40 · 55 ShA 2,0 · 70 ShA 2,17), dinamik (Sh+20)/50 — tahmini', () => {
    expect(P.FEA_ORAN.map(([sh, r]) => [sh, +r.toFixed(3)])).toEqual([[40, 2], [55, 2], [70, 2.174]]);
    [['lmt1433-00-40sh', 40], ['lmt1433-00-55sh', 55], ['lmt1433-00-70sh', 70]].forEach(([k, sh], i) =>
      expect([L[k].sx / L[k].sz, L[k].sy / L[k].sz]).toEqual([P.FEA_ORAN[i][1], P.FEA_ORAN[i][1]]));
    const r = (k) => { const e = L[P.anahtar(k)]; return [e.sx, e.sy, e.sz, e.dx, e.dy, e.dz, e.tahmin]; };
    expect(r('LMT-1433-00-TK45')).toEqual([900, 900, 451, 1170, 1170, 586, ['sx', 'sy', 'dx', 'dy', 'dz']]);
    expect(r('LMT-1433-00-TK60')).toEqual([1445, 1445, 701, 2312, 2312, 1122, ['sx', 'sy', 'dx', 'dy', 'dz']]);
    expect(r('LMT-1433-00-TK70')).toEqual([2370, 2370, 1091, 4266, 4266, 1964, ['sx', 'sy', 'dx', 'dy', 'dz']]);
  });
  test('konik tam ve tahminli (çözülür, aday değil); öteki ailelerde X · Y yok → eksik', () => {
    const say = {};
    kodlar.forEach((k) => { const a = aile(k), t = cp._mntLibTam(L[P.anahtar(k)]); say[a] = say[a] || [0, 0]; say[a][t ? 0 : 1]++; });
    expect(say).toEqual({ konik: [18, 0], mobil: [0, 18], kabin: [0, 2], sok: [0, 4], temel: [0, 1] });
    const map = cp.veMntGetLibraryMap();
    expect([cp._mntLibTahmin(map['lp-lmt-1433-00-tk60']).length > 0, cp._mntLibTam(map['lp-lmt-0608-04-tk45'])]).toEqual([true, false]);
    global.veMntKatalog = require('../../js/mount-katalog.js');
    Object.keys(cp).forEach((x) => { if (global[x] === undefined) global[x] = cp[x]; });
    const PA = require('../../js/cp-mount-param.js');
    expect(PA._mntParamAdaylar({ lib: map }, null).map((a) => a.key).filter((k) => /^lp-/.test(k))).toEqual([]);
  });
  test('girilen değer tahminden çıkar: mobilde X · Y girilince dinamiği aynı oranla kurulur; konikte kz girilince radyal ondan', () => {
    const lib = { id: 'lib1', type: 'mnt-library', def: componentDefs['mnt-library'],
      data: { mounts: [], overrides: { 'lp-mlmt-0608-04-tk45': { sx: 100, sy: 100 }, 'lp-lmt-1433-00-tk60': { sz: 800 } } } };
    global.nodes = [lib];
    const map = cp.veMntGetLibraryMap(), m = map['lp-mlmt-0608-04-tk45'], k = map['lp-lmt-1433-00-tk60'];
    expect([m.sx, m.sy, m.sz, m.dx, m.dy, m.dz, m.tahmin, cp._mntLibTam(m)]).toEqual([100, 100, 127, 130, 130, 165, ['dx', 'dy', 'dz'], true]);
    expect([k.sz, k.sx, k.dz, k.tahmin]).toEqual([800, 1645, 1280, ['sx', 'sy', 'dx', 'dy', 'dz']]);   // 2,058 × 800 · 1,6 × 800
    expect(L['lp-mlmt-0608-04-tk45'].sx).toBeNull();                              // fabrika girdisi değişmez
  });
  test('sıra: LASPAR kodları A+P\'nin ardında; markada önce programın LASPAR takozları, sonra katalog ailenin sırasıyla', () => {
    const k = Object.keys(L);
    expect(k.slice(-43)).toEqual(P.kodlar().map((x) => P.anahtar(x)));
    expect(P.kodlar().slice(0, 3)).toEqual(['LMT-1423-00-TK45', 'LMT-1423-00-TK60', 'LMT-1423-00-TK70']);
    expect(P.kodlar().slice(-1)).toEqual(['LMT-1887']);
    const s = cp._mntLibSirali(cp.veMntGetLibraryList().filter((e) => e.builtin && e.marka === 'LASPAR'));
    expect(s.slice(0, 10).map((e) => e.key)).toEqual(['amc55sha', 'TK035', 'TK040', 'TK050', 'lmt1433-00-40sh', 'lmt1433-00-55sh',
      'lmt1433-00-70sh', 'bmc-mount1-40sh', 'bmc-mount1-55sh', 'bmc-mount1-70sh']);
    expect(s.slice(10).map((e) => e.lp.kod)).toEqual(P.kodlar());
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
  test('katalog kodu: veri, A+P eşi, resim (i)\'de; kapasite yazılmaz (Canlı Not 65 · 111)', () => {
    const d = kunye('lp-lmt-1433-00-tk60');
    const k = d.querySelector('.ve-mnt-amc[data-lp="LMT-1433-00-TK60"]');
    expect(d.querySelectorAll('img')).toHaveLength(0);
    expect(satirlar(k)).toEqual([['Kod', 'LASPAR LMT-1433-00-TK60'], ['Ürün ailesi', 'Industrial Conical Mounts'], ['Tip', '1433'],
      ['Sertlik', '60 ShA'], ['Ölçüler', '107 × 90 mm · delik 80 × 65 · Ø11'], ['Yükseklik', '56 mm'],
      ['A+P eşi', 'Conical bearing 026 S 1']]);
    // KAYNAK (i)'DE (Canlı Not 139)
    expect(k.querySelector('.ve-mnt-kaynak-i').closest('tr').querySelector('th').textContent).toBe('Ürün ailesi');
    expect(k.querySelector('.ve-mnt-kaynak-i').getAttribute('data-ipucu')).toBe('Kaynak · LASPAR genel kataloğu 2018 · s. 52');
    expect(d.querySelector('.mntlib-sec > .mntlib-tip > button.mntlib-bilgi').getAttribute('data-lp')).toBe('LMT-1433-00-TK60');
    expect(d.textContent).not.toMatch(/Taşıma kapasitesi|Maks\. yük|2\.454 N|250 kg/i);
    expect(satirlar(kunye('lp-lmt-0154-01-tk55').querySelector('.ve-mnt-amc'))).toContainEqual(['Ölçüler', 'Ø120 mm · iç Ø20']);
    expect(satirlar(kunye('lp-lmt-0608-04-tk45').querySelector('.ve-mnt-amc'))).toContainEqual(['Ölçüler', '100 × 60 mm · delik 60 · M12']);
  });
  test('programın LASPAR takozu: TK040\'ta model kodu ve kaynak; LMT-1433-00\'da katalog tipi ve (i); "Mount 1"de künye yok', () => {
    const tk = kunye('TK040');
    expect(satirlar(tk.querySelector('.ve-mnt-amc'))).toEqual([['Kod', 'LASPAR MLMT-0216-33-TK040'], ['Sertlik', '45 ShA']]);
    // ailesiz künyede kaynak Kod satırının (i)'sinde
    expect(tk.querySelector('.ve-mnt-kaynak-i').closest('tr').querySelector('th').textContent).toBe('Kod');
    expect(tk.querySelector('.ve-mnt-kaynak-i').getAttribute('data-ipucu')).toBe('Kaynak · LASPAR test raporu');
    expect(tk.querySelector('.mntlib-bilgi')).toBeNull();
    const lm = kunye('lmt1433-00-55sh');
    expect(satirlar(lm.querySelector('.ve-mnt-amc'))).toEqual([['Kod', 'LASPAR LMT-1433-00'], ['Ürün ailesi', 'Industrial Conical Mounts'],
      ['Tip', '1433'], ['Sertlik', '55 ShA'], ['Ölçüler', '107 × 90 mm · delik 80 × 65 · Ø11'], ['Yükseklik', '56 mm'],
      ['A+P eşi', 'Conical bearing 026 S 1']]);
    expect(lm.querySelector('.ve-mnt-kaynak-i').getAttribute('data-ipucu')).toBe('Kaynak · BMC FEA raporu · 02.10.2018 · 12.02.2019');
    expect(lm.querySelector('.mntlib-bilgi').getAttribute('data-lp-eski')).toBe('lmt1433-00-55sh');
    expect(satirlar(kunye('amc55sha').querySelector('.ve-mnt-amc'))).toEqual([['Kod', 'LASPAR LMT-1433-37'], ['Sertlik', '55 ShA']]);
    expect([kunye('bmc-mount1-55sh').querySelector('.ve-mnt-amc'), kunye('bmc-mount1-55sh').querySelector('.mntlib-bilgi')]).toEqual([null, null]);
  });
  test('Rijitlik: konikte radyal ve dinamik tahmini, mobilde dinamik tahmini ve X · Y boş (zorunlu)', () => {
    const d = kunye('lp-lmt-1433-00-tk60');
    expect([...d.querySelectorAll('td.tah input')].map((i) => i.id.replace(/^ve-mnt-lib-|-lib1$/g, ''))).toEqual(['sx', 'dx', 'sy', 'dy', 'dz']);
    // künye hücrenin ipucunda (tablonun altında satır yok — Canlı Not 138)
    expect(d.querySelector('td.tah').getAttribute('title'))
      .toBe('Tahmini · kz × 2,06 · LMT-1433-00 FEA · statik × 1,60 · 60 ShA, (Sh + 20)/50 · AMC NR koniler');
    const m = kunye('lp-mlmt-0608-04-tk45');
    expect(m.querySelector('td.tah').getAttribute('title')).toBe('Tahmini · statik × 1,30 · 45 ShA, (Sh + 20)/50 · AMC NR koniler');
    expect([...m.querySelectorAll('td.zor input')].map((i) => i.id.replace(/^ve-mnt-lib-|-lib1$/g, ''))).toEqual(['sx', 'dx', 'sy', 'dy']);
  });
  test('(i) LASPAR\'ın ve programın LMT-1433-00\'ının teknik resmini açar; bilinmeyen kodda hiçbir şey', () => {
    const BSK = require('../../js/baslangic-sayfa.js');
    global.veBasResimGoster = BSK.veBasResimGoster;
    try {
      const b = document.createElement('button'); b.setAttribute('data-lp', 'MLMT-0609-03-TK55'); document.body.appendChild(b);
      expect(cp.veMntLibCizimAc(b)).toBe(true);
      const pen = document.querySelector('#ve-bas-buyuk-perde .ve-bas-buyuk-pencere');
      expect([pen.querySelector('#ve-bas-buyuk-baslik').textContent, pen.querySelector('img').getAttribute('src')])
        .toEqual(['Universal mobile mount 609 · teknik resim', 'assets/takoz/lp/cizim-m-mlmt.webp']);
      BSK.veBasResimKapat();
      const es = document.createElement('button'); es.setAttribute('data-lp-eski', 'lmt1433-00-40sh');
      expect(cp.veMntLibCizimAc(es)).toBe(true);
      expect(document.querySelector('#ve-bas-buyuk-perde img').getAttribute('src')).toBe('assets/takoz/lp/cizim-k-1433.webp');
      BSK.veBasResimKapat();
      const yok = document.createElement('button'); yok.setAttribute('data-lp', 'LMT-9999');
      expect(cp.veMntLibCizimAc(yok)).toBe(false);
    } finally { delete global.veBasResimGoster; BSK.veBasResimKapat(); document.body.innerHTML = ''; }
  });
});

describe('RAPOR — tahminin yöntemi üreticiye göre', () => {
  test('LASPAR konikte radyal (FEA oranı) ve dinamik, öteki ailede yalnız dinamik; tahminsizde cümle yok', () => {
    Object.keys(cp).forEach((x) => { if (global[x] === undefined) global[x] = cp[x]; });
    const rep = require('../../js/cp-mount-report.js');
    const Y = (k) => rep._mntRepTahminYontem(L[k]);
    expect(Y('lp-lmt-1433-00-tk60')).toMatch(/LMT-1433-00’ın FEA’daki radyal\/eksenel oranı.*\(Sh \+ 20\)\/50/);
    expect(Y('lp-lmt-0608-04-tk45')).toMatch(/^üretici dinamik rijitliği yayımlamıyor; dinamik değer statik × \(Sh \+ 20\)\/50/);
    expect(Y('lp-lmt-0608-04-tk45')).not.toMatch(/FEA|AMC-EO/);
    expect(Y('ap1221402503')).toMatch(/AMC-EO’daki NR kodların/);
    expect(Y('amc137962')).toMatch(/AMC’nin ölçtüğü radyal\/eksenel oran/);
    expect([Y('TK040'), rep._mntRepTahminYontem(null)]).toEqual(['', '']);
  });
  test('Tablo 2: tahminli takozun hücresi ≈, dipnot yöntem başına bir cümle ve takozların adları', () => {
    Object.keys(cp).forEach((x) => { if (global[x] === undefined) global[x] = cp[x]; });
    const rep = require('../../js/cp-mount-report.js');
    const tak = (id, ad, tip) => { const n = { id, type: 'mnt-mount', def: componentDefs['mnt-mount'], data: { name: ad } };
      global.nodes.push(n); cp.veMntApplyLib(id, tip); return n; };
    global.nodes = [];
    const ns = [tak('m1', 'Sağ Ön', 'lp-lmt-1433-00-tk60'), tak('m2', 'Sol Ön', 'lp-lmt-1433-00-tk60'), tak('m3', 'Arka', 'TK040')];
    const m = ns.map((n) => Object.assign({ id: n.id, name: n.data.name, x: 0, y: 0, z: 0 },
      ...['kxs', 'kys', 'kzs', 'kxd', 'kyd', 'kzd'].map((a) => ({ [a]: n.data[a] }))));
    const h = rep._mntRepMountTable({ gather: { mounts: m } });
    const d = document.createElement('div'); d.innerHTML = h;
    const satir = [...d.querySelectorAll('tr')].slice(1).map((r) => [...r.querySelectorAll('td')].slice(4).map((c) => c.textContent));
    expect(satir[0]).toEqual(['≈1.445', '≈1.445', '701', '≈2.312', '≈2.312', '≈1.122']);
    expect(satir[2]).toEqual(['515', '260', '242', '740', '355', '335']);                    // TK040: rapordan, tahminsiz
    const p = [...d.querySelectorAll('p')].map((x) => x.textContent);
    expect(p).toHaveLength(1);
    expect(p[0]).toMatch(/^≈ Tahmini rijitlik — Sağ Ön, Sol Ön: üretici radyal ve dinamik rijitliği yayımlamıyor; kx, ky eksenel/);
  });
});

describe('GÖRSELLER — yalnız katalogun ölçülü çizimi (Canlı Not 111)', () => {
  const G = require('../../tools/takoz-gorsel.js');
  const dir = path.join(__dirname, '../../assets/takoz/lp');
  const kunye = JSON.parse(fs.readFileSync(path.join(dir, 'kunye.json'), 'utf8'));
  test('her tipin çizimi diskte; üretecin listesiyle birebir', () => {
    const gerek = new Set(Object.keys(TIP).map((t) => 'cizim-' + TIP[t][2]));
    const disk = fs.readdirSync(dir).filter((f) => f.endsWith('.webp')).map((f) => f.replace('.webp', ''));
    expect(disk.sort()).toEqual([...gerek].sort());
    expect(G.listesiLp().map((x) => x.ad).sort()).toEqual([...gerek].sort());
    expect(Object.keys(kunye).sort()).toEqual([...gerek].sort());
  });
  test('künye diskle birebir: kaynak katalogun sayfası, bayt dosyanınki', () => {
    Object.keys(kunye).forEach((ad) => {
      expect(kunye[ad].kaynak).toMatch(/^https:\/\/drive\.usercontent\.google\.com\/download\?id=1gDoV00IIwu3lYZXtcrT8tOv6S2yh97na&export=download#page=\d+$/);
      expect(fs.statSync(path.join(dir, ad + '.webp')).size).toBe(kunye[ad].bayt);
    });
  });
});
