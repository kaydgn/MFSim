/**
 * fead-examples-gates.test.js — ARŞİVİN TAMAMI ÖRNEK OLARAK KURULUYOR
 *
 * Kullanıcı isteği: *"GitHub'da olan tüm Gates raporlarını programa örnek
 * olarak tanımlayalım. Yani, başlangıç sihirbazına."*
 *
 * `docs/gates-reports/pdf/` altındaki on raporun dokuzu bu dosyada sınanıyor;
 * onuncusu (AG00879) kendi dosyasında (`fead-example-ag00879.test.js`), çünkü
 * o örnek elle yazıldı ve keşif anlatısını taşıyor. Buradaki dokuz tanım
 * `tools/build-fead-gates-examples.js` ile ÜRETİLDİ.
 *
 * ÜRETİLMİŞ OLMAK BİR GÜVENCE DEĞİL — asıl kapı bu dosya. Üreteç fixture'ı
 * yanlış okusa (pitch ↔ effective karışsa, REBL yerine katalog adı alınsa,
 * kol açısı Mean yerine FreeArm'dan gelse) blok yine kusursuz görünürdü;
 * model de çözülürdü. Aşağıdaki battery her örneği KURUP raporun kendi
 * sayılarına karşı koşturuyor.
 *
 * REFERANSLAR FIXTURE'DAN (`AG_MISC`) OKUNUYOR — İKİNCİ KOPYA YOK.
 *
 * EŞİKLER projenin kendi ölçütleri: çalışma konumları %0.5, Load dahil %1.5,
 * kol açısı 0.2°. Burada ÖLÇÜLEN en kötü sapmalar bunların altında.
 */
const M = require('../../js/fead-model.js');
const F = require('../../js/fead-core.js');
const V = require('../fixtures/fead-validation.js');
const META = require('../../tools/fead-gates-examples-meta.json');

const stubs = stubGlobals();
document.body.innerHTML = '<div id="ve-canvas"></div>';
global.nodes = [];
global.connections = [];
eval(loadSource('components.js'));
global.componentDefs = componentDefs;
global.FEADCore = F;
Object.keys(M).forEach((k) => { global[k] = M[k]; });
const CP = require('../../js/cp-fead.js');
Object.keys(CP).forEach((k) => { if (global[k] === undefined) global[k] = CP[k]; });

beforeEach(() => { resetStubs(stubs); global.nodes = []; global.connections = []; });

// Gates "Tensioner Geometry" sütun adı ↔ FEADCore.positionTable satır adı.
const POS = { FreeArm: 'FreeArm', Replace: 'Replace', Max: 'MaxBelt',
              Mean: 'Mean', Min: 'MinBelt', Load: 'Load' };
const CIFT = META.map((m) => [m.id, m.fixture]);
const pctErr = (mine, ref) => Math.abs((mine - ref) / ref) * 100;

function kur(id) {
  const pack = veFeadExampleNodes(id);
  pack.nodes.forEach((n) => { n.def = componentDefs[n.type]; });
  return { pack, build: veFeadBuildSystem(pack.nodes, pack.connections) };
}
const solverOf = (pack) => pack.nodes.find((n) => n.type === 'fead-solver');
const tenOf = (pack) => pack.nodes.find((n) => n.type === 'fead-tensioner').data;

describe('dokuz raporun dokuzu da kuruluyor', () => {
  test.each(CIFT)('%s — kapalı çevrim, hatasız, uyarısız', (id, fixKey) => {
    const G = V.AG_MISC[fixKey];
    const { pack, build } = kur(id);
    expect(build.ok).toBe(true);
    expect(build.errors || []).toEqual([]);
    expect(build.warnings || []).toEqual([]);
    expect(build.sys.pulleys).toHaveLength(G.order.length);
    expect(pack.connections).toHaveLength(G.order.length);
  });

  test.each(CIFT)('%s — kayış boyu raporun REBL sütunu, katalog adı DEĞİL', (id, fixKey) => {
    // AG00976'da rapor başlığı (1715) ile REBL (1714.6) ayrışıyor ve katalog
    // adını boy sanmak 0.56°'lik kol hatası veriyordu. Davranışsal kapılar bunu
    // YAKALAMIYOR: 0.4 mm'lik kayma konum tablosunun yuvarlama payına sığıyor
    // (mutasyonla ölçüldü — 104 testin hepsi yeşil kalıyordu). Bu yüzden
    // BİREBİR eşitlik aranıyor.
    const G = V.AG_MISC[fixKey];
    const mean = G.pos.find((p) => p.name === 'Mean');
    const belt = veFeadExampleOf(id).belt;
    expect(belt.effLength).toBe(mean.REBL);
    // Tolerans ve aşınma payı da raporun kendi künyesinden — sıfırlanınca kol
    // zarfı çöker ama konum tablosu eşikleri bunu GÖRMÜYOR (mutasyonla ölçüldü).
    expect(belt.tolerance).toBe(G.tol);
    expect(belt.wearPct).toBeCloseTo(G.wear / 100, 9);
    expect(belt.ribs).toBe(G.ribs);
  });

  test.each(CIFT)('%s — gergi merkezi LAYOUT satırı, yuvarlanmış Mean DEĞİL', (id, fixKey) => {
    // Layout Data iki ondalık, konum tablosunun Mean'i bire yuvarlanmış; fark
    // 0.014–0.064 mm. Davranışsal kapı bu kadarını görmez (mutasyonla ölçüldü),
    // ama iki kaynağı karıştırmak bir sonraki üretimde daha büyük bir kaymanın
    // kapısı olur. Örnek DAİMA daha hassas satırı taşımalı.
    const G = V.AG_MISC[fixKey];
    const tenKey = G.order.find((k) => G.pulley[k].ten);
    const td = tenOf(kur(id).pack);
    expect(td.cenX).toBe(G.xy[tenKey][0]);
    expect(td.cenY).toBe(G.xy[tenKey][1]);
  });

  test.each(CIFT)('%s — DIŞ ÇAP raporun Pitch/Effective sütunlarını veriyor', (id, fixKey) => {
    // Üretecin en sessiz hata noktası: fixture pitch+effective tutar, MFSim
    // dış çap ister. Çevrim yanlış olsa geometri yine çözülür, sayılar kayar.
    const G = V.AG_MISC[fixKey];
    const { build } = kur(id);
    build.sys.pulleys.forEach((p, i) => {
      const ref = G.pulley[G.order[i]];
      expect(p.rPitch * 2).toBeCloseTo(ref.p, 2);
      expect(p.rEff * 2).toBeCloseTo(ref.e, 2);
      expect(p.contact).toBe(ref.c);
    });
  });

  test.each(CIFT)('%s — span · sarım · hız oranı', (id, fixKey) => {
    const G = V.AG_MISC[fixKey];
    const { build } = kur(id);
    const g = F.geometryAt(build.sys, F.meanRel(build.sys));
    G.order.forEach((key, i) => {
      // Rapor span'i BİR ondalıkla basıyor (±0.05 kendi yuvarlaması);
      // ÖLÇÜLEN en kötü sapma dokuz raporda 0.06 mm.
      expect(Math.abs(g.spans[i].L - G.span[key])).toBeLessThan(0.1);
      expect(g.wrapDeg(i)).toBeCloseTo(G.wrap[key], 0);
      expect(F.speedRatio(build.sys, i)).toBeCloseTo(G.ratio[key], 2);
    });
    expect(Math.abs(g.signedWrapDeg)).toBeCloseTo(360, 3);
  });

  test.each(CIFT)('%s — gergi konum tablosu (kol · X/Y · T · hub · REBL)', (id, fixKey) => {
    const G = V.AG_MISC[fixKey];
    const { build } = kur(id);
    const rows = F.positionTable(build.sys);
    G.pos.forEach((ref) => {
      const row = rows.find((r) => r.position === POS[ref.name]);
      expect(row).toBeDefined();
      // Load bir MEKANİK STOP: sarım sıfıra yaklaştığı için orada eşik gevşek
      // (raporun 0.1°'lik kol yuvarlaması tek başına %1.4–2.3 fark yapıyor).
      const gev = ref.name === 'Load';
      expect(Math.abs(row.absDeg - ref.absDeg)).toBeLessThan(0.2);
      expect(row.idlerX).toBeCloseTo(ref.X, 0);
      expect(row.idlerY).toBeCloseTo(ref.Y, 0);
      expect(pctErr(row.tensionN, ref.T)).toBeLessThan(gev ? 1.5 : 0.8);
      expect(pctErr(row.hubloadN, ref.hub)).toBeLessThan(gev ? 1.5 : 0.5);
      expect(row.requiredBeltMm).toBeCloseTo(ref.REBL, 0);
    });
  });

  test.each(CIFT)('%s — TÜRETİLEN ankraj raporun Design Tension satırında', (id, fixKey) => {
    // Tasarım gerginliği örnekte YAZILI DEĞİL: T = M/(dL/dθ) ile geometriden
    // ve yay künyesinden çıkıyor. Raporun kendi satırıyla buluşması bağımsız
    // bir doğrulama — dokuz sistemde birden.
    const G = V.AG_MISC[fixKey];
    const { build } = kur(id);
    expect(veFeadExampleOf(id).solver.designTensionN).toBeUndefined();
    expect(pctErr(build.springTensionN, G.design)).toBeLessThan(0.5);
    expect(build.sys.designTensionN).toBeCloseTo(build.springTensionN, 9);
  });

  test.each(CIFT)('%s — TÜRETİLEN serbest kol açısı raporun Free Arm satırında', (id, fixKey) => {
    const G = V.AG_MISC[fixKey];
    const { build } = kur(id);
    const norm = ((build.freeAngleDeg % 360) + 360) % 360;
    const ref = ((G.freeAbsDeg % 360) + 360) % 360;
    expect(Math.abs(norm - ref)).toBeLessThan(0.2);
  });

  test.each(CIFT)('%s — TÜRETİLEN montaj konumu raporun pivotunu veriyor', (id, fixKey) => {
    // Montaj konumu bir GİRDİ değil: avara merkezi + kol açısından türüyor.
    // Rapor onu ayrıca "Tensioner Data" bloğunda basıyor; türev ona oturuyor.
    // Bu bir kapı değil, raporun iki ayrı satırının aynı kolu tarif ettiğinin
    // ölçüsü — ama kaymasını da GÖRÜR.
    const G = V.AG_MISC[fixKey];
    const td = tenOf(kur(id).pack);
    expect(td.pivotX).toBeUndefined();
    const p = M.veFeadTensionerPivot(td);
    expect(Math.hypot(p[0] - G.pivot[0], p[1] - G.pivot[1])).toBeLessThan(0.15);
    // Kol boyu türevin kendi değişmezi.
    expect(Math.hypot(p[0] - td.cenX, p[1] - td.cenY)).toBeCloseTo(G.arm, 6);
  });
});

describe('çalışma çevrimi — raporun kendi tabloları', () => {
  test.each(CIFT)('%s — duty gerilme + hubload + sürücü kW', (id, fixKey) => {
    const G = V.AG_MISC[fixKey];
    const { pack, build } = kur(id);
    const A = F.analyze(build.sys, { duty: veFeadDutyToCore(build, veFeadDutyRows(solverOf(pack))) });
    expect(A.duty).toHaveLength(G.duty.length);

    // RAPORUN KENDİ KUSURU: AG00902-1300'de Gates tasarım gerginliğini GERGİ
    // çıkış spanı yerine KRANK çıkış spanına ankrajlamış ve zincir kapanmıyor
    // (fixture bunu `tensionTableValid:false` ile işaretliyor ve ayrıca
    // İSPATLIYOR). Orada gerilme/hubload karşılaştırması modeli değil raporu
    // ölçerdi — ÖLÇÜLDÜ: %430. Kapı bayrağı OKUYOR, eşiği gevşetmiyor.
    const tabloGecerli = G.tensionTableValid !== false;

    A.duty.forEach((row, k) => {
      const ref = G.duty[k];
      expect(row.engineRpm).toBe(ref.engineRpm);
      // Sürücü kW toplamdan hesaplanır (duty tablosuna YAZILMAZ) ve raporun
      // kendi değerini verir — bu, tablo geçersiz olsa da geçerli.
      expect(row.perPulley[0].powerKw).toBeCloseTo(ref.crankKw, 2);
      if (!tabloGecerli) return;
      G.order.forEach((key, i) => {
        expect(pctErr(row.perPulley[i].exitTensionN, ref.T[key])).toBeLessThan(0.5);
        expect(pctErr(row.hubloads[i].FN, ref.H[key])).toBeLessThan(0.5);
      });
    });
  });

  test('AG00902-1300 GERÇEKTEN ayrışıyor — bayrak boş bir muafiyet değil', () => {
    // Yukarıdaki atlama bir "geçsin diye" muafiyet olsaydı sessizce yanlış
    // olurdu. Burada farkın BÜYÜK olduğu ve yönünün raporun teşhis edilmiş
    // kusuruyla uyuştuğu SAYIYLA gösteriliyor.
    const G = V.AG_MISC['AG00902-1300'];
    expect(G.tensionTableValid).toBe(false);
    const { pack, build } = kur('AG00902_1300_GATES_2023');
    const A = F.analyze(build.sys, { duty: veFeadDutyToCore(build, veFeadDutyRows(solverOf(pack))) });
    const r0 = A.duty[0];
    let enBuyuk = 0;
    G.order.forEach((key, i) => {
      enBuyuk = Math.max(enBuyuk, pctErr(r0.perPulley[i].exitTensionN, G.duty[0].T[key]));
    });
    expect(enBuyuk).toBeGreaterThan(50);   // ÖLÇÜLDÜ: %430
    // Kardeş revizyon (1275) AYNI sistemin sağlam raporu ve o TUTUYOR —
    // yani ayrışma modelin değil, o belgenin.
    const s = kur('AG00902_1275_GATES_2023');
    const B = F.analyze(s.build.sys, { duty: veFeadDutyToCore(s.build, veFeadDutyRows(solverOf(s.pack))) });
    const H = V.AG_MISC['AG00902-1275'];
    H.order.forEach((key, i) => {
      expect(pctErr(B.duty[0].perPulley[i].exitTensionN, H.duty[0].T[key])).toBeLessThan(0.5);
    });
  });
});

describe('raporun vermediği yazılmıyor', () => {
  const { REPORT } = require('../helpers/gates-vibration.js');

  test.each(CIFT)('%s — yazılan atalet raporun KENDİ sayfasındaki değer', (id, fixKey) => {
    // Atalet hatası tam da sessiz sınıf: burulma modu kayar, model KALİBRE
    // olduğu için kimse fark etmez. Mutasyonla ölçüldü — ×100 yapmak 122
    // testin hepsinden geçiyordu. Kaynak `gates-vibration.js`, yani PDF'in
    // kendisi; burada ikinci bir kopya YOK.
    const { REPORT, vibrationOf } = require('../helpers/gates-vibration.js');
    if (!REPORT[fixKey]) return;                    // alıntı rapor — sayfa yok
    const v = vibrationOf(fixKey);
    const G = V.AG_MISC[fixKey];
    const ex = veFeadExampleOf(id);
    ex.pulleys.forEach((p) => {
      const bekle = G.pulley[p.key].crank ? v.crankInertiaKgM2 : v.accessoryInertia[p.key];
      expect(p.data.inertia).toBeCloseTo(bekle, 9);
    });
    expect(ex.solver.crankInertia).toBeCloseTo(v.crankInertiaKgM2, 9);
    // Silindir sayısı ateşleme frekansına giriyor; o da raporun Engine Data
    // satırından (mutasyonla ölçüldü: 6 → 4 yapmak hiçbir testi kırmıyordu).
    expect(ex.solver.cylinders).toBe(v.cylinders);
    const td = ex.pulleys.find((p) => G.pulley[p.key].ten).data;
    expect(td.armInertia).toBeCloseTo(v.armInertiaKgM2, 9);
    expect(td.pulleyMass).toBeCloseTo(v.pulleyMassKg, 9);
  });

  test.each(CIFT)('%s — atalet YALNIZ arşivde tam duran raporlarda', (id, fixKey) => {
    // Üç ALINTI PDF'te (AG00894 · AG00902 ×2) "System Vibration Analysis"
    // sayfası YOK. Oralarda atalet uydurulmadı; tam raporlarda ise kaynağından
    // geldi. Kapı ikisini de tutuyor — "hepsinde var" da "hiçbirinde yok" da
    // sessizce yanlış olurdu.
    const arsivdeTam = !!REPORT[fixKey];
    const ex = veFeadExampleOf(id);
    const atalet = ex.pulleys.filter((p) => p.data.inertia != null).length;
    if (arsivdeTam) expect(atalet).toBe(ex.pulleys.length);
    else expect(atalet).toBe(0);
    expect(ex.solver.crankInertia != null).toBe(arsivdeTam);
  });

  test('alıntı raporda eksik atalet SESSİZ DEĞİL — VARSAYIM olarak yazılıyor', () => {
    // Köprü eksik ataleti arşiv medyanıyla dolduruyor ama bunu `defaults`
    // listesine KAYDEDİYOR — yani sayı uydurulmuş değil, varsayıldığı yazılı.
    // Kapı ikisini birden tutuyor: alıntı raporda kayıt VAR, tam raporda YOK.
    const alinti = kur('AG00894_GATES_2023').build;
    const atalet = (alinti.defaults || []).filter((d) => /atalet/i.test(d.field));
    expect(atalet.length).toBeGreaterThan(0);
    atalet.forEach((d) => {
      expect(d.value).toBeGreaterThan(0);
      expect(d.source).toMatch(/Gates/);        // kaynağı da yazılı
    });

    // Tam rapor: bütün ataletler kaynağından geldiği için VARSAYIM YOK.
    const tam = kur('AG00686_1475_GATES_2023').build;
    expect((tam.defaults || []).filter((d) => /atalet/i.test(d.field))).toHaveLength(0);
  });
});

describe('kayıt defteri ve sihirbaz', () => {
  test('arşivdeki ON raporun ONU da örnek', () => {
    // Kullanıcının istediği şey buydu; sayı düşerse kapı kırılır.
    const fs = require('fs');
    const path = require('path');
    const pdf = fs.readdirSync(path.join(__dirname, '../../docs/gates-reports/pdf'))
      .filter((f) => f.endsWith('.pdf'));
    expect(pdf).toHaveLength(10);
    const gates = veFeadExampleKeys().filter((k) => /GATES/.test(k));
    // On arşiv raporu + AG00976 (PDF'i yok, veri olarak fixture'da).
    expect(gates).toHaveLength(11);
  });

  test('anahtarlar ve adlar TEKİL', () => {
    const keys = veFeadExampleKeys();
    expect(new Set(keys).size).toBe(keys.length);
    const adlar = keys.map((k) => veFeadExampleOf(k).name);
    expect(new Set(adlar).size).toBe(adlar.length);
  });

  test('sihirbaz kartı HEPSİNİ listeliyor ve undefined/NaN basmıyor', () => {
    const html = CP.getFeadExamplePropertiesHTML({ data: {} });
    veFeadExampleKeys().forEach((k) => {
      expect(html).toContain(k);
      expect(html).toContain(veFeadExampleOf(k).name);
    });
    expect(html).not.toMatch(/undefined|NaN|\[object/);
  });
});

describe('kanvasa kurma — gerçek yükleyici', () => {
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

  test.each(CIFT)('%s — kW kimlik göçü yapılıyor ve model çözülüyor', (id, fixKey) => {
    // Diğer bütün testler veFeadExampleNodes'u DOĞRUDAN kullanıyor, yani
    // kimlikler 'ex-*' kalıyor ve eşleşme TESADÜFEN tutuyor. Gerçek yükleyici
    // her düğüme YENİ kimlik veriyor; göç yapılmazsa hiçbir aksesuar eşleşmez,
    // hepsi 0 kW ile koşar ve UYARI ÇIKMAZ.
    const G = V.AG_MISC[fixKey];
    const { ns, conns, solver } = kanvasaKur(id);
    expect(Object.keys(solver.data.duty[0].kw).some((k) => /^ex-/.test(k))).toBe(false);
    const build = veFeadBuildSystem(ns, conns);
    expect(build.ok).toBe(true);
    const A = veFeadAnalyze(build, { rows: veFeadDutyRows(solver) });
    expect(A.analysis.duty[0].perPulley[0].powerKw).toBeCloseTo(G.duty[0].crankKw, 2);
  });

  test.each(CIFT)('%s — kasnak kutuları mm koordinatının söylediği yerde', (id, fixKey) => {
    const G = V.AG_MISC[fixKey];
    const { ns, conns } = kanvasaKur(id);
    const build = veFeadBuildSystem(ns, conns);
    const g = F.geometryAt(build.sys, F.meanRel(build.sys));
    G.order.forEach((key, i) => {
      const ref = G.xy[key];
      expect(g.pulleys[i].c[0]).toBeCloseTo(ref[0], 1);
      expect(g.pulleys[i].c[1]).toBeCloseTo(ref[1], 1);
    });
  });
});
