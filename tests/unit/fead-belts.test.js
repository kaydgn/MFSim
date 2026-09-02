/**
 * fead-belts.test.js — KAYIŞ KATALOĞU
 *
 * Katalogdaki sayılar ÖLÇÜLEMEZ (üretici katalog değerleri) ama TUTARLILIKLARI
 * ölçülebilir, ve asıl kapı orada: bir boy listesi sessizce bozulduğunda panel
 * yine bir tablo basar, yalnız yanlış boyları önerir.
 *
 * EN DEĞERLİ TEST BU DOSYANIN SONUNDA: BMC tedarikçi sayfasının kendi kayışı
 * (8PK 1715) katalogdan GERİ ÇIKIYOR mu? Serbest kip boyu hiç görmeden
 * 1715.27 mm hesaplıyor; katalog buna en yakın boyu öneriyor; o boy seçilince
 * çözüm sabit kipin tabanına (kol 28.4271° · T 532.142 N) BİREBİR oturuyor.
 * Üç bağımsız yol tek noktada buluşuyor.
 *
 * ── İKİ KÜME KARIŞTIRILMAMALI ──────────────────────────────────────────────
 * STOK  = ISO 9982 / DIN 7867 endüstriyel liste (gerçek katalog kayıtları)
 * IZGARA = otomotiv pratiği (bir KURAL, 5 mm adım)
 * Ayrımın bedeli ölçüldü: BMC'nin 8PK 1715'i STOK listesinde YOK — komşuları
 * 1690 ve 1755, yani 65 mm'lik bir boşluk. Yalnız stok listesi katalog
 * sayılsaydı kullanıcının elindeki kayış "katalogda yok" görünürdü.
 */
const B = require('../../js/fead-belts.js');
const M = require('../../js/fead-model.js');
const F = require('../../js/fead-core.js');

const stubs = stubGlobals();
document.body.innerHTML = '<div id="ve-canvas"></div>';
global.nodes = [];
global.connections = [];
eval(loadSource('components.js'));
global.componentDefs = componentDefs;
global.FEADCore = F;
Object.keys(B).forEach((k) => { global[k] = B[k]; });
Object.keys(M).forEach((k) => { global[k] = M[k]; });

beforeEach(() => { resetStubs(stubs); global.nodes = []; global.connections = []; });

const PROFILLER = ['PH', 'PJ', 'PK', 'PL', 'PM'];

describe('veri bütünlüğü', () => {
  test('her profilin listesi SIRALI, TEKİL ve pozitif', () => {
    PROFILLER.forEach((p) => {
      const v = B.VE_FEAD_BELT_STOCK[p];
      expect(Array.isArray(v)).toBe(true);
      expect(v.length).toBeGreaterThan(20);
      expect(new Set(v).size).toBe(v.length);              // tekrar yok
      for (let i = 1; i < v.length; i++) expect(v[i]).toBeGreaterThan(v[i - 1]);
      v.forEach((x) => { expect(Number.isInteger(x)).toBe(true); expect(x).toBeGreaterThan(0); });
    });
  });

  // Aralıklar ContiTech'in kendi beyanıyla çapraz doğrulandı. Bir listenin
  // sessizce yanlış profile yapıştırılması (PK'ya PL boyları) ancak böyle
  // yakalanır — tek tek sayılar makul görünür.
  test('aralıklar üreticinin beyan ettiği bantta', () => {
    const BEYAN = { PJ: [356, 2489], PK: [630, 2555], PL: [927, 7055], PM: [2134, 16764] };
    Object.keys(BEYAN).forEach((p) => {
      const v = B.VE_FEAD_BELT_STOCK[p];
      const [lo, hi] = BEYAN[p];
      expect(v[v.length - 1]).toBeLessThanOrEqual(hi * 1.15);
      expect(v[v.length - 1]).toBeGreaterThan(hi * 0.7);
      expect(v[0]).toBeLessThan(lo * 1.5);
    });
  });

  // Profiller kaburga adımına göre büyüyor; bir profilin boy bandı ondan
  // BAĞIMSIZ olamaz (PM kayışı 300 mm olamaz — min kasnak çapı 180 mm).
  test('profil büyüdükçe en kısa boy da büyüyor', () => {
    const enKisa = PROFILLER.map((p) => B.VE_FEAD_BELT_STOCK[p][0]);
    expect(enKisa[PROFILLER.indexOf('PM')]).toBeGreaterThan(enKisa[PROFILLER.indexOf('PK')]);
    expect(enKisa[PROFILLER.indexOf('PL')]).toBeGreaterThan(enKisa[PROFILLER.indexOf('PJ')]);
  });

  // Her boy, o profilin MİNİMUM kasnağına iki kez sarılıp bir gidiş-dönüş
  // yapacak kadar uzun olmalı — fiziksel bir alt sınır, katalog hatası kapısı.
  test('en kısa boy min. kasnak çevresinden büyük', () => {
    const MIN_DIA = { PH: 13, PJ: 20, PK: 45, PL: 75, PM: 180 };
    PROFILLER.forEach((p) => {
      expect(B.VE_FEAD_BELT_STOCK[p][0]).toBeGreaterThan(Math.PI * MIN_DIA[p]);
    });
  });

  // Katalog dizisini dışarıya vermek, bir çağrının onu yerinde değiştirip
  // bütün oturumu sessizce bozmasına açık kapı bırakırdı.
  test('veFeadBeltStock KOPYA döner', () => {
    const a = B.veFeadBeltStock('PK');
    a.push(99999); a[0] = -1;
    expect(B.veFeadBeltStock('PK')).not.toContain(99999);
    expect(B.veFeadBeltStock('PK')[0]).toBe(630);
  });

  test('bilinmeyen profil sessizce boş döner, patlamaz', () => {
    expect(B.veFeadBeltStock('XX')).toEqual([]);
    expect(B.veFeadBeltStock(null)).toEqual([]);
    expect(B.veFeadBeltProfileOf('pk')).toBe('PK');
    expect(B.veFeadBeltProfileOf('  Pj ')).toBe('PJ');
    expect(B.veFeadBeltProfileOf('PX')).toBeNull();
  });
});

describe('otomotiv ızgarası — bir KURAL, liste değil', () => {
  test('en yakın adıma yuvarlar', () => {
    expect(B.veFeadBeltGridNearest('PK', 1715.27)).toBe(1715);
    expect(B.veFeadBeltGridNearest('PK', 1712.4)).toBe(1710);
    expect(B.veFeadBeltGridNearest('PK', 1713)).toBe(1715);
  });

  test('aralık dışında KENETLENİR — uydurma bir boy üretmez', () => {
    const g = B.VE_FEAD_BELT_GRID.PK;
    expect(B.veFeadBeltGridNearest('PK', 10)).toBe(g.minMm);
    expect(B.veFeadBeltGridNearest('PK', 99999)).toBe(g.maxMm);
  });

  test('ızgarası olmayan profilde null — sessizce PK ızgarası kullanılmaz', () => {
    expect(B.veFeadBeltGridNearest('PM', 3000)).toBeNull();
    expect(B.veFeadBeltGrid('PL')).toBeNull();
  });
});

describe('katalog kodu', () => {
  test('otomotiv yazımını üretir ve gidiş-dönüş tutar', () => {
    expect(B.veFeadBeltCode('PK', 8, 1715)).toBe('8PK1715');
    const r = B.veFeadBeltParseCode('8PK1715');
    expect(r).toEqual({ profile: 'PK', ribs: 8, lengthMm: 1715 });
  });

  // Kullanıcı hangi katalogdan kopyalarsa kopyalasın çalışsın: Gates/Bando
  // kaburgayı öne, Optibelt/ContiTech arkaya yazıyor.
  test('endüstriyel yazımı da çözer', () => {
    expect(B.veFeadBeltParseCode('1715 PK-8')).toEqual({ profile: 'PK', ribs: 8, lengthMm: 1715 });
    expect(B.veFeadBeltParseCode('4 PH 698')).toEqual({ profile: 'PH', ribs: 4, lengthMm: 698 });
    expect(B.veFeadBeltParseCode('1168PJ-6')).toEqual({ profile: 'PJ', ribs: 6, lengthMm: 1168 });
  });

  test('kaburgasız kod da çözülür; anlamsız girdi null', () => {
    expect(B.veFeadBeltParseCode('PK1715')).toEqual({ profile: 'PK', ribs: null, lengthMm: 1715 });
    expect(B.veFeadBeltParseCode('saçma')).toBeNull();
    expect(B.veFeadBeltParseCode('')).toBeNull();
    expect(B.veFeadBeltParseCode(null)).toBeNull();
  });

  // Kaburga aralığı OLMAYAN profilde hüküm verilmiyor: bilinmeyeni "geçersiz"
  // saymak, olmayan bir bilgiyi varmış gibi kullanmak olurdu.
  test('kaburga denetimi yalnız verisi olan profilde hüküm verir', () => {
    expect(B.veFeadBeltRibsCheck('PK', 8)).toBe(true);
    expect(B.veFeadBeltRibsCheck('PK', 20)).toBe(false);
    expect(B.veFeadBeltRibsCheck('PL', 8)).toBeNull();
    expect(B.veFeadBeltRibsCheck('PM', 4)).toBeNull();
  });
});

describe('en yakın adaylar', () => {
  test('iki küme AYRI dönüyor ve etiketli', () => {
    const n = B.veFeadBeltNearest('PK', 1715.27, { count: 3 });
    expect(n.stock).toHaveLength(3);
    n.stock.forEach((c) => expect(c.kind).toBe('stock'));
    expect(n.grid.kind).toBe('grid');
    expect(n.grid.lengthMm).toBe(1715);
  });

  test('stok adayları gerçekten EN YAKINLAR ve boya göre sıralı', () => {
    const t = 1715.27;
    const n = B.veFeadBeltNearest('PK', t, { count: 3 });
    const hepsi = B.veFeadBeltStock('PK')
      .map((L) => Math.abs(L - t)).sort((a, b) => a - b).slice(0, 3);
    const secilen = n.stock.map((c) => Math.abs(c.deltaMm)).sort((a, b) => a - b);
    expect(secilen).toEqual(hepsi);
    for (let i = 1; i < n.stock.length; i++)
      expect(n.stock[i].lengthMm).toBeGreaterThan(n.stock[i - 1].lengthMm);
  });

  test('delta İŞARETLİ — kısa mı uzun mu okunabilsin', () => {
    const n = B.veFeadBeltNearest('PK', 1715, { count: 2 });
    const kisa = n.stock.find((c) => c.lengthMm === 1690);
    const uzun = n.stock.find((c) => c.lengthMm === 1755);
    expect(kisa.deltaMm).toBeLessThan(0);
    expect(uzun.deltaMm).toBeGreaterThan(0);
  });

  test('geçersiz girdide patlamaz', () => {
    expect(B.veFeadBeltNearest('XX', 1715).stock).toEqual([]);
    expect(B.veFeadBeltNearest('PK', NaN).stock).toEqual([]);
    expect(B.veFeadBeltBest('PK', NaN)).toBeNull();
  });
});

// ── ÖLÇÜLMÜŞ BOŞLUK ────────────────────────────────────────────────────────
// Bu testin varlık sebebi bir TASARIM KARARINI kilitlemek: katalog neden
// yalnız endüstriyel stok listesi DEĞİL.
describe('BMC kayışı stok listesinde YOK — kataloğun iki kümeli olmasının sebebi', () => {
  test('8PK 1715 endüstriyel listede yok, komşuları 65 mm uzakta', () => {
    const pk = B.veFeadBeltStock('PK');
    expect(pk).not.toContain(1715);
    expect(pk).toContain(1690);
    expect(pk).toContain(1755);
    expect(1755 - 1690).toBe(65);
  });

  test('ama otomotiv ızgarası onu TAM veriyor', () => {
    expect(B.veFeadBeltGridNearest('PK', 1715.27)).toBe(1715);
    expect(B.veFeadBeltBest('PK', 1715.27).lengthMm).toBe(1715);
  });
});

// ── UÇTAN UCA ───────────────────────────────────────────────────────────────
describe('katalog + çözücü: üç bağımsız yol tek noktada buluşuyor', () => {
  const bmc = (mode) => {
    const p = veFeadExampleNodes('BMC_FEAD_2026');
    p.nodes.forEach((n) => { n.def = componentDefs[n.type]; });
    if (mode) p.nodes.find((n) => n.type === 'fead-belt').data.lengthMode = mode;
    return veFeadBuildSystem(p.nodes, p.connections);
  };

  test('serbest kipin gereken boyu → katalog → sabit kip tabanı', () => {
    const b = bmc('free');
    const o = veFeadBeltOptions(b, { count: 3 });
    expect(o.ok).toBe(true);
    expect(o.profile).toBe('PK');
    expect(o.ribs).toBe(8);
    expect(o.targetMm).toBeCloseTo(1715.27, 1);      // 1 · geometriden

    expect(o.grid.lengthMm).toBe(1715);              // 2 · katalogdan
    expect(o.grid.code).toBe('8PK1715');             //     sayfanın kendi kodu

    const f = o.grid.fit;                            // 3 · çözücüden
    expect(f.ok).toBe(true);
    expect(f.fits).toBe(true);
    // Sabit kip tabanı (bkz. fead-belt-mode.test.js TABAN). Girdi avara
    // merkezine dönünce (2026-09-01) örnek sayfanın kendi koordinatını
    // taşımaya başladı; ölçülen kayma L −0,0025 mm · T +%0,008.
    expect(f.relDeg).toBeCloseTo(28.4271, 3);
    expect(f.tensionN).toBeCloseTo(532.142, 1);
    expect(f.hubloadN).toBeCloseTo(302.136, 1);
  });

  // SIĞMAYAN ADAY BİR SAYI DEĞİL, BİR HÜKÜM — ama YALNIZ kenetlenme take-up
  // TEKİLLİĞİNE oturduğunda. Ayrım fizikte: kol MEKANİK BİR DURDURUCUYA
  // dayandığında ürettiği gerginlik gerçek ve basılabilir bir sayıdır;
  // tekilliğe dayandığında (dL/dθ → 0) değildir — ölçüldü: durdurucusuz
  // BMC'ye 1690 mm denenince 4.05e10 N çıkıyor.
  //
  // 2026-09-02'den beri durdurucu girilmemişse arşivden VARSAYILIYOR, yani
  // ikinci hâl artık varsayılan yol. Bu yüzden test iki dalı da ölçüyor.
  test('sığmayan aday: DURDURUCUYA dayanınca gerginlik GERÇEK', () => {
    const b = bmc('free');
    expect(b.sys.tensioner.loadStopRelDeg).toBeGreaterThan(0);   // varsayılan geldi
    const kisa = veFeadBeltFit(b.sys, 1690);
    expect(kisa.ok).toBe(true);                      // cevap var
    expect(kisa.fits).toBe(false);                   // ama sığmıyor
    expect(kisa.atLimit).not.toBeNull();
    expect(kisa.atLimit.degenerate).toBeFalsy();     // tekillik DEĞİL, stop
    expect(Number.isFinite(kisa.tensionN)).toBe(true);
    expect(kisa.tensionN).toBeLessThan(5000);        // 4e10 DEĞİL, fiziksel
  });

  test('sığmayan aday: TEKİLLİĞE dayanınca gerginlik YAZILMIYOR', () => {
    const b = bmc('free');
    delete b.sys.tensioner.loadStopRelDeg;           // durdurucusuz gergi
    b.sys._cache = {};
    const kisa = veFeadBeltFit(b.sys, 1690);
    expect(kisa.ok).toBe(true);
    expect(kisa.fits).toBe(false);
    expect(kisa.atLimit.degenerate).toBe(true);
    expect(Number.isFinite(kisa.tensionN)).toBe(false);   // 4e10 DEĞİL
    expect(Number.isFinite(kisa.hubloadN)).toBe(false);
  });

  test('sığan aday gerginliği YAZAR ve fiziksel', () => {
    const b = bmc('free');
    const f = veFeadBeltFit(b.sys, 1715);
    expect(f.fits).toBe(true);
    expect(f.tensionN).toBeGreaterThan(100);
    expect(f.tensionN).toBeLessThan(5000);
  });

  // Kayış uzadıkça kol kapanır (rel küçülür) ve gerginlik düşer — take-up
  // yönünün kendisi. Ters çıkarsa bir işaret sessizce dönmüş demektir.
  test('boy uzadıkça kol açısı ve gerginlik DÜŞER', () => {
    const b = bmc('free');
    const a = veFeadBeltFit(b.sys, 1705);
    const c = veFeadBeltFit(b.sys, 1725);
    expect(a.fits && c.fits).toBe(true);
    expect(c.relDeg).toBeLessThan(a.relDeg);
    expect(c.tensionN).toBeLessThan(a.tensionN);
  });

  test('katalog hedefi TÜREYEN boydur — girilen boy hedefi değiştirmez', () => {
    // Kayış boyu artık bir ÇIKTI: katalog adayları o çıktının etrafında
    // aranıyor, kullanıcının yazdığı boyun etrafında değil.
    const kur = (L) => {
      const pack = veFeadExampleNodes('BMC_FEAD_2026');
      pack.nodes.forEach((n) => { n.def = componentDefs[n.type]; });
      pack.nodes.find((n) => n.type === 'fead-belt').data.effLength = L;
      return veFeadBeltOptions(veFeadBuildSystem(pack.nodes, pack.connections));
    };
    const a1 = kur(1715), a2 = kur(1600);
    expect(a1.targetMm).toBeCloseTo(a2.targetMm, 9);
    expect(a1.targetMm).toBeCloseTo(1715.269, 2);
  });
  test('aday değerlendirmesi çalışma noktasını KİRLETMİYOR', () => {
    const b = bmc('fixed');
    const once = F.meanRel(b.sys);
    veFeadBeltOptions(b, { count: 3 });
    veFeadBeltFit(b.sys, 1200);
    veFeadBeltFit(b.sys, 2400);
    expect(F.meanRel(b.sys)).toBe(once);
  });

  test('çözülemeyen modelde katalog SESSİZ kalmıyor', () => {
    const o = veFeadBeltOptions({ ok: false, errors: ['test hatası'] });
    expect(o.ok).toBe(false);
    expect(o.error).toMatch(/test hatası/);
  });
});
