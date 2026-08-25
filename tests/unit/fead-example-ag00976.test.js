/**
 * fead-example-ag00976.test.js — GATES RAPORU ÇIPASI
 *
 * Bu dosya FEAD zincirinin ÜÇÜNCÜ doğrulamasıdır ve diğer ikisinden farklı bir
 * şeye bakıyor:
 *
 *   fead-core.test.js     → ÇEKİRDEK, 17 rapor / 2095 değer (sistemi kendisi kurar)
 *   fead-example.test.js  → tedarikçiye GİDEN sayfa (BMC_FEAD_2026), 4 bağımsız çıpa
 *   BU DOSYA              → tedarikçiden DÖNEN rapor, ÖRNEK KAYIT DEFTERİNDEN kurulup
 *                            uçtan uca (köprü + çekirdek) raporu geri üretiyor mu
 *
 * Aradaki fark önemsiz değil: doğrulama harness'ı `F.makeSystem()`i doğrudan
 * çağırıyor, yani KÖPRÜYÜ (js/fead-model.js) atlıyor. Burada zincirin tamamı
 * koşuyor — örnek tanımı → düğüm dizisi → veFeadBuildSystem → FEADCore. Köprüde
 * sessiz bir çeviri hatası olsa harness onu GÖREMEZ; bu dosya görür.
 *
 * KAYNAK: "AG00976 BMC Otomotif FEAD 5 · Cummins Eng.Scndr ALT&AC Drive ·
 * Gates 8PK1715HD-Fleetrunner · Ten@-250/110 · Corrected-IDR1 · 05.06.2025",
 * Gates v13.02, 12 sayfa. Referans değerler tests/fixtures/fead-validation.js
 * içindeki AG00976['1715@-250/110'] kaydından okunuyor — İKİNCİ BİR KOPYA
 * TUTULMUYOR. Fixture dışarıdan gelen birebir bir kopya; sayıları buraya elle
 * çekmek, ikisi ayrıştığında hangisinin doğru olduğunu belirsiz bırakırdı.
 *
 * EŞİKLER projenin kendi ölçütleri (bkz. CLAUDE.md): çalışma konumları %0.5,
 * Load dahil %1.5, kol açısı 0.2°. Burada ölçülen değerler bunların çok
 * altında ve testler ÖLÇÜLENE göre sıkılaştırıldı — gevşek bir eşik geçerken
 * sessizce bozulmayı kaçırır.
 */
const M = require('../../js/fead-model.js');
const F = require('../../js/fead-core.js');
const V = require('../fixtures/fead-validation.js');
const fead = require('../../js/cp-fead.js');

const stubs = stubGlobals();
document.body.innerHTML = '<div id="ve-canvas"></div>';
global.nodes = [];
global.connections = [];
eval(loadSource('components.js'));
global.FEADCore = F;
Object.keys(M).forEach((k) => { global[k] = M[k]; });

beforeEach(() => { resetStubs(stubs); global.nodes = []; global.connections = []; });

const KEY = 'AG00976_GATES_2025';
const G = V.AG00976['1715@-250/110'];

// Raporun kasnak adları (Layout Data satır sırası) ↔ örnekteki sıra. Örnek
// kullanıcıya okunur adlar veriyor ("Klima Kompresörü"), rapor kısa kod
// kullanıyor ("A_C"); eşleme SIRAYLA yapılır, adla değil. Adla yapılsaydı
// örnekte bir kasnağı yeniden adlandırmak testi sessizce anlamsızlaştırırdı.
const GN = ['FAN', 'IDR1', 'A_C', 'IDR2', 'ALT', 'TEN'];

// Gates "Tensioner Geometry" sütun adı ↔ FEADCore.positionTable satır adı.
const POS = { FreeArm: 'FreeArm', Replace: 'Replace', Max: 'MaxBelt',
              Mean: 'Mean', Min: 'MinBelt', Load: 'Load' };

function kur(mut) {
  const pack = veFeadExampleNodes(KEY);
  pack.nodes.forEach((n) => { n.def = componentDefs[n.type]; });
  if (mut) mut(pack.nodes);
  return { pack, build: veFeadBuildSystem(pack.nodes, pack.connections) };
}
const solverOf = (pack) => pack.nodes.find((n) => n.type === 'fead-solver');
const tenOf = (nodes) => nodes.find((n) => n.type === 'fead-tensioner').data;
const beltOf = (nodes) => nodes.find((n) => n.type === 'fead-belt').data;
const pctErr = (mine, ref) => Math.abs((mine - ref) / ref) * 100;

describe('örnek kayıt defteri: Gates raporu kurulabilir', () => {
  test('örnek listede ve altı kasnaklı kapalı çevrim kuruyor', () => {
    expect(veFeadExampleKeys()).toContain(KEY);
    const { pack, build } = kur();
    expect(build.ok).toBe(true);
    expect(build.errors || []).toEqual([]);
    expect(build.sys.pulleys).toHaveLength(6);
    // Kayış yolu kapalı: altı kasnak, altı tel.
    expect(pack.connections).toHaveLength(6);
  });

  test('KANVAS YERLEŞİMİ için her kasnağın sonlu koordinatı var', () => {
    // veFeadLoadExample kasnakları kayış düzlemindeki gerçek koordinatlarına
    // oranlı yerleştiriyor ve gergiyi `cenX/cenY`den okuyor — gerginin `x/y`si
    // YOKTUR (merkezi pivot + kol + açıdan çözülür). Bir örnek gergiyi yalnız
    // `angleMode:'direct'` ile tanımlasaydı burada 0 okunur ve kutu SESSİZCE
    // krank kasnağının üstüne düşerdi: hata yok, çözüm doğru, yerleşim çöp.
    veFeadExampleKeys().forEach((k) => {
      veFeadExampleOf(k).pulleys.forEach((p) => {
        const x = (p.data.x != null) ? p.data.x : p.data.cenX;
        const y = (p.data.y != null) ? p.data.y : p.data.cenY;
        expect(Number.isFinite(x)).toBe(true);
        expect(Number.isFinite(y)).toBe(true);
      });
    });
    // Bu örnekte gergi merkezi gerçekten ikinci yoldan geliyor.
    const ten = veFeadExampleOf(KEY).pulleys.find((p) => p.key === 'TEN').data;
    expect(ten.x).toBeUndefined();
    expect(ten.cenX).toBeCloseTo(-161.97, 2);
  });

  test('panel kartı her iki örnek için de sayı basıyor — "undefined" YOK', () => {
    // Kart "birinci kademe: <crankOD> / <fanOD> mm" satırını HAM basıyordu.
    // Gates örneği tahrik oranını doğrudan veriyor (ratioMode 'direct'), yani
    // o iki alan YOK: satır "undefined / undefined mm" çıkıyordu. Bu, kullanıcı
    // gözüne çarpan tek işaretti ve bir sayı gibi okunuyordu.
    const html = fead.getFeadExamplePropertiesHTML({ data: {} });
    veFeadExampleKeys().forEach((k) => {
      expect(html).toMatch(new RegExp("veFeadLoadExample\\('" + k + "'\\)"));
    });
    expect(html).not.toMatch(/undefined/);
    expect(html).not.toMatch(/NaN/);
  });
});

describe('GEOMETRİ — Gates "Belt Drive System Geometry" sayfası', () => {
  // Bu tablo çözücünün SALT GEOMETRİ tarafı: kasnak koordinatları + çaplar +
  // temas tarafı. Yay künyesi buraya hiç girmiyor, yani bir sapma doğrudan
  // koordinat/çap/temas okumasına işaret eder.
  test('12 değerin 12\'si de rapora 0.2 (derece / mm) içinde oturuyor', () => {
    const { build } = kur();
    const geom = F.geometryAt(build.sys, F.meanRel(build.sys));
    GN.forEach((nm, i) => {
      expect(geom.wrapDeg(i)).toBeCloseTo(G.wrap[nm], 0);
      expect(Math.abs(geom.wrapDeg(i) - G.wrap[nm])).toBeLessThan(0.2);
      expect(Math.abs(geom.exitSpanLen(i) - G.span[nm])).toBeLessThan(0.2);
    });
  });

  test('DIŞ ÇAP → raporun Pitch/Effective sütunlarını çekirdek türetiyor', () => {
    // MFSim `od` (dış çap) ister; rapor Pitch ve Effective basıyor. İkisi
    // arasındaki dönüşüm çekirdeğin hb/hr sabitleri. Bu test o dönüşümü
    // raporun kendi sayılarına kilitliyor: grooved 162 → 164.40/162.00,
    // back 75 → 77.20/79.60. Bir sabit kayarsa bütün geometri kayar.
    const { build } = kur();
    const p = build.sys.pulleys;
    expect(p[0].rPitch * 2).toBeCloseTo(164.40, 2);   // FAN  grooved
    expect(p[0].rEff * 2).toBeCloseTo(162.00, 2);
    expect(p[1].rPitch * 2).toBeCloseTo(77.20, 2);    // IDR1 back
    expect(p[1].rEff * 2).toBeCloseTo(79.60, 2);
  });

  test('hız oranları raporun "Speed Ratio (Ref. Engine)" sütunu', () => {
    // Oran PITCH çapından gelir, dış çaptan değil. Tedarikçiye giden sayfa
    // alternatör oranını dış çaplarla elle yazmıştı (162/57 = 2.842); raporun
    // ve modelin değeri 164.4/59.4 = 2.768. %2.7 fark, ve bu sayı aksesuar
    // devrini belirlediği için güç eğrisi okumasına doğrudan giriyor.
    const { build } = kur();
    expect(F.speedRatio(build.sys, 0)).toBeCloseTo(1.000, 3);
    expect(F.speedRatio(build.sys, 4)).toBeCloseTo(2.768, 2);
    expect(F.speedRatio(build.sys, 1)).toBeCloseTo(2.130, 2);
    // Dış çap oranı BAŞKA bir sayı — testin ayırt ettiği şey tam olarak bu.
    expect(Math.abs(F.speedRatio(build.sys, 4) - 162 / 57)).toBeGreaterThan(0.05);
  });
});

describe('GERGİ — Gates "Tensioner Geometry" tablosu (6 konum × 7 sütun)', () => {
  test('altı konumun tamamı: kol 0.2°, çalışma gerginliği %0.5, Load %1.5', () => {
    const { build } = kur();
    const pt = F.positionTable(build.sys);
    G.pos.forEach((ref) => {
      const mine = pt.find((r) => r.position === POS[ref.name]);
      expect(mine).toBeDefined();
      expect(mine.error).toBeUndefined();
      expect(Math.abs(mine.relDeg - ref.rel)).toBeLessThan(0.2);
      expect(Math.abs(mine.idlerX - ref.X)).toBeLessThan(0.2);
      expect(Math.abs(mine.idlerY - ref.Y)).toBeLessThan(0.2);
      expect(Math.abs(mine.betaDeg - ref.beta)).toBeLessThan(0.2);
      expect(Math.abs(mine.wrapDeg - ref.wrap)).toBeLessThan(0.2);
      // Load bir MEKANİK STOP: sarım sıfıra yaklaştığı için gerginlik
      // tekilleşir ve raporun 0.1° yuvarlaması tek başına %1.4-2.3 fark
      // yaratır (bkz. fead-validation.js NOT 2). Eşik bu yüzden ayrı.
      expect(pctErr(mine.tensionN, ref.T)).toBeLessThan(ref.name === 'Load' ? 1.5 : 0.5);
      expect(pctErr(mine.hubloadN, ref.hub)).toBeLessThan(0.5);
      // Uzunluk sütunları: raporun hem EDL hem REBL'i basılıyor, ikisi de
      // tutmak zorunda. Yalnız birine bakmak lengthOffset'i serbest bırakırdı.
      expect(Math.abs(mine.driveLenMm - ref.EDL)).toBeLessThan(0.2);
      expect(Math.abs(mine.requiredBeltMm - ref.REBL)).toBeLessThan(0.2);
    });
  });

  test('take-up oranı ve yay çalışma momenti', () => {
    const { build } = kur();
    const st = F.tensionerState(build.sys, F.meanRel(build.sys));
    expect(pctErr(st.takeupMmPerDeg, G.takeupRef)).toBeLessThan(0.5);
    expect(pctErr(st.springNm, G.meanLoad)).toBeLessThan(0.5);
  });

  test('SERBEST AÇI montaj merkezinden TÜRETİLİYOR — rapor onu ayrıca yazıyor', () => {
    // Örnek gergiyi sayfanın biçiminde tanımlıyor (pivot + çalışma merkezi +
    // yay künyesi) ve serbest açıyı TÜRETİYOR. Rapor ise serbest açıyı kendi
    // "Free Arm" satırında AYRICA basıyor. İkisinin buluşması bedava ve
    // bağımsız bir doğrulama: türetme yanlış olsaydı geometri yine kusursuz
    // çözülür, hiçbir hata çıkmaz, yalnız gerginlik kayardı (2.6 kat — bkz.
    // fead-example.test.js'teki sessiz kanal ölçümü).
    const { build } = kur();
    expect(build.freeAngleDeg).toBeCloseTo(G.freeAbsDeg, 0);
    expect(Math.abs(build.freeAngleDeg - G.freeAbsDeg)).toBeLessThan(0.15);
  });

  test('KOL BOYU ÇAPRAZ KONTROLÜ sessiz değil — uyuşmazlık çözümü durdurur', () => {
    // |çalışma merkezi − pivot| = kol boyu, ve bu örnekte tam 90.00 mm.
    // Kapının ısırdığını göstermek için pivotu 10 mm kaydırıyoruz: model
    // ÇÖZÜLMEMELİ ve sebebi ADIYLA yazmalı. Bu kapı gerçek bir veri
    // uyuşmazlığını yakaladı — tedarikçiye giden sayfanın "öngörülen merkezi
    // montaj pozisyonu" raporun gerçek pivotundan 90 değil 80.65 mm uzakta.
    const arm = veFeadArmCheck(tenOf(veFeadExampleNodes(KEY).nodes));
    expect(arm.ok).toBe(true);
    expect(arm.fromCoords).toBeCloseTo(90.0, 1);

    const { build } = kur((ns) => { tenOf(ns).pivotX = -240; });
    expect(build.ok).toBe(false);
    expect((build.errors || []).join(' ')).toMatch(/kol boyu/i);
  });
});

describe('TASARIM GERGİNLİĞİ SORULMUYOR — yay dengesinden türetiliyor', () => {
  test('türetilen ankraj raporun Design Tension satırını %0.5 içinde veriyor', () => {
    // Rapor 544 N basıyor ama örnek bu sayıyı TAŞIMIYOR: T = M/(dL/dθ) ile
    // geometriden ve yay künyesinden çıkıyor. İkisinin buluşması, ankrajın
    // girdi olmaktan çıkarılmasının doğru karar olduğunun bu rapordaki kanıtı.
    const { build } = kur();
    expect(veFeadExampleOf(KEY).solver.designTensionN).toBeUndefined();
    expect(pctErr(build.sys.designTensionN, G.design)).toBeLessThan(0.5);
  });
});

describe('ÇALIŞMA ÇEVRİMİ — Gates "Load Conditions / Mean Tensions / Hubloads"', () => {
  test('12 satır × 6 kasnak: gerilme ve hubload %0.5 içinde', () => {
    const { pack, build } = kur();
    const res = veFeadAnalyze(build, {
      rows: veFeadDutyRows(solverOf(pack)), cylinders: 6, crankInertia: 0.70,
    });
    expect(res.ok).toBe(true);
    expect(res.analysis.duty).toHaveLength(G.duty.length);
    res.analysis.duty.forEach((row, i) => {
      const ref = G.duty[i];
      expect(row.engineRpm).toBe(ref.engineRpm);
      GN.forEach((nm, k) => {
        expect(pctErr(row.perPulley[k].exitTensionN, ref.T[nm])).toBeLessThan(0.5);
        expect(pctErr(row.hubloads[k].FN, ref.H[nm])).toBeLessThan(0.5);
      });
    });
  });

  test('SÜRÜCÜ GÜCÜ hesaplanıyor, girilmiyor — raporun 6.34 kW satırı', () => {
    // Sürücü sütunu duty tablosunda YOK; çekirdek onu diğerlerinin toplamı
    // olarak buluyor. Raporda da 2.70 + 3.61 + 3×0.01 = 6.34.
    const { pack, build } = kur();
    const res = veFeadAnalyze(build, { rows: veFeadDutyRows(solverOf(pack)), cylinders: 6 });
    expect(res.analysis.duty[0].perPulley[0].powerKw).toBeCloseTo(6.34, 2);
    veFeadExampleOf(KEY).solver.duty.forEach((r) => {
      expect(Object.keys(r.kwByKey)).not.toContain('FAN');
    });
  });

  test('kW ÖRNEKTE KASNAK ANAHTARIYLA durur, çekirdeğe DÜĞÜM KİMLİĞİYLE gider', () => {
    // Bu çeviri (kwByKey → kw[node.id]) veFeadExampleNodes'ta, TEK yerde.
    // Kayarsa hata SESSİZ: eşleşmeyen kimlik "kW girilmemiş" sayılır ve o
    // aksesuar 0 kW ile koşar — çözüm yine üretilir, yalnız gerilmeler düşer.
    // Kapı bunu iki uçtan tutuyor: çeviri gerçekten oldu mu, ve olmazsa
    // sonuç GERÇEKTEN değişiyor mu.
    const pack = veFeadExampleNodes(KEY);
    const duty = solverOf(pack).data.duty;
    const acId = pack.nodes.find((n) => n.type === 'fead-ac').id;
    expect(duty[0].kwByKey).toBeUndefined();
    expect(duty[0].kw[acId]).toBe(2.70);

    // Çeviri olmasaydı: aynı model, A_C yükü sıfır → gerilme belirgin düşer.
    const { build } = kur();
    const res = veFeadAnalyze(build, { rows: veFeadDutyRows(solverOf(pack)), cylinders: 6 });
    const bos = veFeadAnalyze(build, {
      rows: veFeadDutyRows(solverOf(pack)).map((r) => Object.assign({}, r, { kw: {} })),
      cylinders: 6,
    });
    expect(res.analysis.duty[0].perPulley[0].exitTensionN)
      .toBeGreaterThan(bos.analysis.duty[0].perPulley[0].exitTensionN * 1.5);
  });

  test('duty yüzdeleri 100\'e toplanıyor ve sıcaklık tek değere iniyor', () => {
    const duty = veFeadExampleOf(KEY).solver.duty;
    expect(duty.reduce((a, r) => a + r.dcPct, 0)).toBeCloseTo(100, 6);
    const { pack, build } = kur();
    const res = veFeadAnalyze(build, { rows: veFeadDutyRows(solverOf(pack)), cylinders: 6 });
    // Tablo tek sıcaklıklı (90 °C) → hasar-eşdeğer indirgeme tam o sayıyı
    // vermeli (log2(2^x) = x). Aritmetik ortalamaya kayarsa bu da 90 verir,
    // ama tek sıcaklıkta ikisi zaten aynı — burada bakılan şey indirgemenin
    // doğrulanmış sonuçları KAYDIRMADIĞI.
    expect(res.degCEq).toBeCloseTo(90, 6);
  });
});

describe('MODELİN SINIRLARI raporla karşılaştırıldığında AÇIKÇA duruyor', () => {
  test('B10 ham değeri geçerlilik aralığı dışında ve model BUNU SÖYLÜYOR', () => {
    // Alternatör Ø57 mm; mutlak ömrün kalibre aralığı 79.6-176 mm. Model
    // aralık dışında sistematik olarak ~0.55x veriyor ve bunu kendi
    // uyarısında yazıyor. Test iki şeyi birden kilitliyor: uyarının ÇIKTIĞI,
    // ve ampirik düzeltmenin rapora %10 içinde oturduğu. Uyarı sessizce
    // düşerse kullanıcı 1403 saati rapordaki 2670'in yerine koyardı.
    const { pack, build } = kur();
    const res = veFeadAnalyze(build, { rows: veFeadDutyRows(solverOf(pack)), cylinders: 6 });
    expect(res.life.inValidRange).toBe(false);
    // Uyarı kasnağı KULLANICININ gördüğü adla anıyor ("Alternatör (155 A)"),
    // raporun kısa koduyla değil — mesaj panelde basılıyor, orada kısa kod
    // hiçbir yerde geçmiyor. Kapı adı değil, HANGİ kasnağın ve hangi çapın
    // adlandırıldığını arıyor.
    const disari = res.life.outOfRange.join(' ');
    expect(disari).toContain(veFeadExampleOf(KEY).pulleys.find((p) => p.key === 'ALT').name);
    expect(disari).toMatch(/57\.0 mm/);
    expect(pctErr(res.life.hoursB10, G.B10)).toBeGreaterThan(30);
    expect(pctErr(res.life.hoursB10Corrected, G.B10)).toBeLessThan(10);
  });

  test('burulma 1. modu raporun "System Resonance" satırına %8 içinde', () => {
    // Bu sistem burulma KALİBRASYON TAKIMINDA DEĞİL (takım fead-core.test.js'te:
    // AG00686 x2 + AG0868 ailesi). Yani bu, kalibre edilmemiş bir sisteme karşı
    // BAĞIMSIZ bir ölçüm ve modelin kendi ilan ettiği ±%8 bandına düşüyor.
    //
    // İKİ SESSİZ GİRDİ burada da ısırıyor: krank MİLİ ataleti geçilmezse
    // frekans %30 yukarı kayar. Test ikisini de koşturup farkı belgeliyor.
    const { pack, build } = kur();
    const rows = veFeadDutyRows(solverOf(pack));
    const ile = veFeadAnalyze(build, { rows, cylinders: 6, crankInertia: 0.70 });
    expect(ile.torsional).toBeTruthy();
    expect(pctErr(ile.torsional.firstElasticHz, G.NF)).toBeLessThan(8);

    const siz = veFeadAnalyze(build, { rows, cylinders: 6 });
    expect(siz.torsional.firstElasticHz).toBeGreaterThan(ile.torsional.firstElasticHz * 1.2);
  });

  test('gergi kasnak KÜTLESİ kol ataletine nokta kütle olarak giriyor', () => {
    // J_kullanılan = J_kol + m·a² = 0.0009 + 0.80 × 0.090² = 0.00738.
    // Kütle ihmal edilirse 1. mod belirgin yükselir (CLAUDE.md: +%32).
    const { pack, build } = kur();
    const res = veFeadAnalyze(build, {
      rows: veFeadDutyRows(solverOf(pack)), cylinders: 6, crankInertia: 0.70,
    });
    expect(res.torsional.armInertiaUsedKgM2).toBeCloseTo(0.0009 + 0.80 * 0.09 * 0.09, 6);
  });
});

describe('EFEKTİF BOY 1714.6 — raporun başlığı değil, REBL sütunu', () => {
  test('raporun dört uzunluk konumu 1714.6 ile birebir, 1715 ile 0.4 mm kayık', () => {
    // Rapor başlığı "Effective Belt Length (ISO 9981) 1715" diyor; kendi
    // Tensioner Geometry tablosunun REBL sütunu ise dört konumun DÖRDÜNDE de
    // tam 0.4 mm aşağıda. Aradaki ADIMLAR (tol 6.0, wear 0.006·L) birebir
    // tuttuğu için kayan şey nominal boyun KENDİSİ: "1715" yuvarlanmış katalog
    // adı (8PK**1715**HD). Kapı bunu iki yönden tutuyor — doğru değer geçiyor,
    // katalog adı kullanılırsa AÇIKÇA kırılıyor.
    expect(veFeadExampleOf(KEY).belt.effLength).toBe(1714.6);
    const ref = G.pos.find((p) => p.name === 'Mean');
    expect(ref.REBL).toBeCloseTo(1714.6, 6);

    const iyi = kur();
    const iyiMean = F.positionTable(iyi.build.sys).find((r) => r.position === 'Mean');
    expect(Math.abs(iyiMean.relDeg - ref.rel)).toBeLessThan(0.1);

    const katalog = kur((ns) => { beltOf(ns).effLength = 1715; });
    const katMean = F.positionTable(katalog.build.sys).find((r) => r.position === 'Mean');
    expect(Math.abs(katMean.relDeg - ref.rel)).toBeGreaterThan(0.4);
    expect(pctErr(katMean.tensionN, ref.T)).toBeGreaterThan(1.0);
  });

  test('TOLERANS ve AŞINMA girilmezse kol zarfı tek noktaya çöker', () => {
    // Tedarikçiye giden sayfada bu iki alan YOK; raporda ±6.00 mm ve %0.60.
    // Sıfır bırakılınca Replace = Max = Mean = Min oluyor: kullanıcı kolun
    // gezinme aralığını HİÇ göremiyor, üstelik hata da almıyor. Örneğin bu
    // iki alanı taşıması bu yüzden veri değil, ÖZELLİK.
    expect(veFeadExampleOf(KEY).belt.tolerance).toBe(6);
    expect(veFeadExampleOf(KEY).belt.wearPct).toBeCloseTo(0.006, 9);

    const { build } = kur((ns) => { const b = beltOf(ns); b.tolerance = 0; b.wearPct = 0; });
    const pt = F.positionTable(build.sys);
    const acilar = ['Replace', 'MaxBelt', 'Mean', 'MinBelt']
      .map((n) => pt.find((r) => r.position === n).relDeg);
    expect(Math.max.apply(null, acilar) - Math.min.apply(null, acilar)).toBeLessThan(1e-6);

    // Örneğin KENDİSİNDE zarf gerçekten açık (Replace ↔ Min arası 30°+).
    const acik = F.positionTable(kur().build.sys);
    const yay = acik.find((r) => r.position === 'MinBelt').relDeg
              - acik.find((r) => r.position === 'Replace').relDeg;
    expect(yay).toBeGreaterThan(30);
  });
});

describe('İKİ ÖRNEK AYNI GERGİYİ, FARKLI KAYIŞI ANLATIYOR', () => {
  // Kullanıcı kararı (2026-08-25): "Tedarikçiye ne gönderdik kısmını geçelim,
  // sen Gates raporundaki 'Tensioner Data' kısmını baz alarak hesaplamalarını
  // yap." Eskiden BMC_FEAD_2026 pivotu VERİDEN TÜRETİYORDU (sayfa pivotu
  // vermiyor); artık iki örnek de raporun Tensioner Data bloğunu taşıyor.
  //
  // AYRIŞMA KAYIŞ KÜNYESİNDE KALDI ve bilinçli: BMC hâlâ sayfanın kayışını
  // (1715 · tolerans 0 · aşınma 0) taşıyor, AG00976 raporunkini
  // (1714.6 · ±6 · %0.60 · lengthOffset 1.6).

  test('GERGİ KÜNYESİ İKİ ÖRNEKTE DE AYNI — Gates "Tensioner Data" bloğu', () => {
    const a = veFeadExampleOf('BMC_FEAD_2026').pulleys.find((p) => p.key === 'TEN').data;
    const b = veFeadExampleOf(KEY).pulleys.find((p) => p.key === 'TEN').data;
    // Raporun bastığı beş sayı, ikisinde de birebir.
    ['pivotX', 'pivotY', 'armLen', 'preload', 'kArm', 'meanLoad'].forEach((k) => {
      expect(a[k]).toBeCloseTo(b[k], 6);
    });
    expect(a.pivotX).toBeCloseTo(-250.00, 6);
    expect(a.pivotY).toBeCloseTo(110.00, 6);
    // TÜRETİLMİŞ pivot geri gelmemeli: sayfanın kendi merkezinden 90 mm uzağa
    // konan uydurma pivot (−259.94, 104.15) gerçeğinden 11.5 mm sapıyor ve
    // çalışma gerginliğini 544 yerine 650 N gösteriyordu.
    expect(Math.hypot(a.pivotX + 259.94, a.pivotY - 104.15)).toBeGreaterThan(10);
  });

  test('KAYIŞ KÜNYESİ AYRI — ve fark ölçülebilir', () => {
    const a = veFeadExampleOf('BMC_FEAD_2026').belt;
    const b = veFeadExampleOf(KEY).belt;
    expect(a.effLength).toBe(1715);        // sayfanın "modelden bulunan" boyu
    expect(b.effLength).toBe(1714.6);      // raporun REBL sütunu
    expect(a.tolerance).toBe(0);
    expect(b.tolerance).toBe(6);
  });

  test('AYNI GERGİYLE, KAYIŞ FARKI ÇALIŞMA NOKTASINI KAYDIRIYOR', () => {
    // Gates raporu Mean'de 543.9 N diyor. AG00976 (kayış da rapordan) buna
    // %0.5 içinde oturuyor; BMC (kayış sayfadan) yukarıda kalıyor — ve kalan
    // fark ARTIK gergiden değil, yalnız kayış künyesinden geliyor.
    const ref = G.pos.find((p) => p.name === 'Mean');

    const pb = veFeadExampleNodes('BMC_FEAD_2026');
    pb.nodes.forEach((n) => { n.def = componentDefs[n.type]; });
    const bb = veFeadBuildSystem(pb.nodes, pb.connections);
    const meanB = F.positionTable(bb.sys).find((r) => r.position === 'Mean');

    const { build } = kur();
    const meanA = F.positionTable(build.sys).find((r) => r.position === 'Mean');

    expect(pctErr(meanA.tensionN, ref.T)).toBeLessThan(0.5);      // rapor künyesi
    expect(pctErr(meanB.tensionN, ref.T)).toBeGreaterThan(2);     // sayfa kayışı
    expect(pctErr(meanB.tensionN, ref.T)).toBeLessThan(10);       // ama artık %19.5 değil
  });

  test('SERBEST KİPTE İKİSİ DE RAPORUN GERGİNLİĞİNE VARIYOR', () => {
    // Kol nominal yay açısına oturunca kayış boyu ÇIKTI olur ve sayfanın
    // kayışı denklemden düşer. ÖLÇÜLDÜ: BMC serbest kipte 543.7 N — Gates'in
    // Design Tension'ı 544 N. Yani iki örnek arasındaki tek gerçek fark,
    // sabit kipte hangi kayışın dayatıldığı.
    const pb = veFeadExampleNodes('BMC_FEAD_2026');
    pb.nodes.find((n) => n.type === 'fead-belt').data.lengthMode = 'free';
    pb.nodes.forEach((n) => { n.def = componentDefs[n.type]; });
    const bb = veFeadBuildSystem(pb.nodes, pb.connections);
    expect(pctErr(bb.sys.designTensionN, G.design)).toBeLessThan(0.5);
  });
});

describe('kanvasa kurma — duty kW kimlik göçü', () => {
  const CP = require('../../js/cp-fead.js');
  Object.keys(CP).forEach((k) => { if (global[k] === undefined) global[k] = CP[k]; });

  function kanvasaKur(key) {
    let c = 0;
    global.nodes = []; global.connections = [];
    global.createNode = (type, x, y) => {
      const n = { id: 'canvas-' + (++c), type, x, y, data: {} };
      global.nodes.push(n);
      return n;
    };
    global.createConnection = (from, to) => { global.connections.push({ from, to }); };
    global.updateAllConnections = () => {};
    global.veFeadRefreshBadges = () => {};
    CP.veFeadLoadExample(key);
    const ns = global.nodes.map((n) => Object.assign({}, n, { def: componentDefs[n.type] }));
    return { ns, conns: global.connections, solver: ns.find((n) => n.type === 'fead-solver') };
  }

  test('kW sözlüğü KANVAS kimliklerine taşınıyor', () => {
    const { ns, solver } = kanvasaKur(KEY);
    const acId = ns.find((n) => n.type === 'fead-ac').id;
    const kw = solver.data.duty[0].kw;
    expect(Object.keys(kw)).toContain(acId);
    // Örnek tanımındaki 'ex-*' anahtarı ARTIK YOK — kalırsa sessizce 0 kW.
    expect(Object.keys(kw).some((k) => /^ex-/.test(k))).toBe(false);
    expect(kw[acId]).toBe(2.70);
  });

  test('kanvasa kurulan örnek Gates duty tablosunu GERİ ÜRETİYOR', () => {
    const { ns, conns, solver } = kanvasaKur(KEY);
    const build = veFeadBuildSystem(ns, conns);
    expect(build.ok).toBe(true);
    const res = veFeadAnalyze(build, {
      rows: veFeadDutyRows(solver), cylinders: 6, crankInertia: 0.70,
    });
    const r0 = res.analysis.duty[0];
    expect(r0.perPulley[0].powerKw).toBeCloseTo(6.34, 2);   // sürücü = toplam
    GN.forEach((nm, k) => {
      expect(pctErr(r0.perPulley[k].exitTensionN, G.duty[0].T[nm])).toBeLessThan(0.5);
      expect(pctErr(r0.hubloads[k].FN, G.duty[0].H[nm])).toBeLessThan(0.5);
    });
  });

  test('GÖÇ OLMAZSA sonuç GERÇEKTEN bozulur — yüksüz koşar', () => {
    // Kapının ısırdığının kanıtı: göçü geri alınca kullanıcının bildirdiği
    // tablo birebir geri geliyor (bütün gerginlikler tasarım gerginliğine
    // düzleşiyor). Bu test olmasaydı düzeltme sessizce geri alınabilirdi.
    const { ns, conns, solver } = kanvasaKur(KEY);
    const bozuk = JSON.parse(JSON.stringify(solver.data.duty));
    bozuk.forEach((r) => {
      const yeni = {};
      Object.keys(r.kw).forEach((k, i) => { yeni['ex-sahte-' + i] = r.kw[k]; });
      r.kw = yeni;
    });
    const build = veFeadBuildSystem(ns, conns);
    const res = veFeadAnalyze(build, {
      rows: veFeadDutyRows({ data: { duty: bozuk } }), cylinders: 6,
    });
    const r0 = res.analysis.duty[0];
    r0.perPulley.forEach((q) => expect(q.powerKw).toBe(0));
    // Bütün gerginlikler tasarım gerginliğine düzleşiyor — kullanıcının gördüğü.
    const T = r0.perPulley.map((q) => q.exitTensionN);
    expect(Math.max.apply(null, T) - Math.min.apply(null, T)).toBeLessThan(1);
    expect(pctErr(T[0], G.duty[0].T.FAN)).toBeGreaterThan(50);
  });

  test('göç EŞLEŞMEYEN anahtarı silmiyor — kullanıcının kendi satırı korunur', () => {
    // Harita yalnız kurulan düğümleri kapsar; kanvasta zaten düzenlenmiş bir
    // satırın anahtarı haritada olmaz ve silinmesi VERİ KAYBI olurdu.
    const rows = [{ rpm: 800, dcPct: 100, degC: 90, kw: { 'ex-A_C': 1, 'baska-dugum': 2 } }];
    veFeadRemapDutyKw(rows, { 'ex-A_C': 'canvas-9' });
    expect(rows[0].kw).toEqual({ 'canvas-9': 1, 'baska-dugum': 2 });
  });
});
