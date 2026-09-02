/**
 * fead-example-ag00879.test.js — İKİNCİ GATES RAPORU ÇIPASI
 *
 * fead-example-ag00976.test.js ile AYNI işi yapar ama BAŞKA bir sistemde, ve
 * ayrı durmasının sebebi bu: AG00976 ile BMC_FEAD_2026 aynı aracın iki belgesi
 * (giden sayfa ↔ dönen rapor) ve aynı gergiyi (E9843, kol 90 mm) paylaşıyor.
 * Bu rapor BAŞKA bir araç, BAŞKA bir gergi (T38665, kol 56 mm), BEŞ kasnak ve
 * tamamen farklı çaplar — yani köprünün AG00976'ya özel bir varsayım taşıyıp
 * taşımadığını ancak bu ayırt eder. Fixture'ın kendi notu da öyle diyor:
 * "modelin evrenselligini sinar".
 *
 * KAYNAK: "AG00879 ANADOLU-ISUZU 6x6 Truck Secondary ALT Drive · 8PK1392HD ·
 * Gates T38665 31Nm · 17 Mayıs 2023", Gates v9.40, 12 sayfa. Referans değerler
 * tests/fixtures/fead-validation.js içindeki AG_MISC.AG00879 kaydından okunur —
 * İKİNCİ BİR KOPYA TUTULMUYOR. Fixture dışarıdan gelen birebir bir kopya;
 * sayıları buraya elle çekmek, ikisi ayrıştığında hangisinin doğru olduğunu
 * belirsiz bırakırdı.
 *
 * EŞİKLER: proje ölçütleri çalışma konumları %0.5, Load dahil %1.5, kol açısı
 * 0.2°. Burada ÖLÇÜLEN sapmalar bunların çok altında ve testler ölçülene göre
 * sıkılaştırıldı — gevşek bir eşik geçerken sessizce bozulmayı kaçırır.
 */
const M = require('../../js/fead-model.js');
const F = require('../../js/fead-core.js');
const V = require('../fixtures/fead-validation.js');

const stubs = stubGlobals();
document.body.innerHTML = '<div id="ve-canvas"></div>';
global.nodes = [];
global.connections = [];
eval(loadSource('components.js'));
global.FEADCore = F;
const fead = require('../../js/cp-fead.js');
Object.keys(M).forEach((k) => { global[k] = M[k]; });

beforeEach(() => { resetStubs(stubs); global.nodes = []; global.connections = []; });

const KEY = 'AG00879_GATES_2023';
const G = V.AG_MISC.AG00879;

// Gates "Tensioner Geometry" sütun adı ↔ FEADCore.positionTable satır adı.
const POS = { FreeArm: 'FreeArm', Replace: 'Replace', Max: 'MaxBelt',
              Mean: 'Mean', Min: 'MinBelt', Load: 'Load' };

function kur(mut) {
  const pack = veFeadExampleNodes(KEY);
  pack.nodes.forEach((n) => { n.def = componentDefs[n.type]; });
  if (mut) mut(pack.nodes);
  return { pack, build: veFeadBuildSystem(pack.nodes, pack.connections) };
}
const tenOf = (nodes) => nodes.find((n) => n.type === 'fead-tensioner').data;
const beltOf = (nodes) => nodes.find((n) => n.type === 'fead-belt').data;
const solverOf = (nodes) => nodes.find((n) => n.type === 'fead-solver').data;
const pctErr = (mine, ref) => Math.abs((mine - ref) / ref) * 100;

describe('örnek kayıt defteri: AG00879 kurulabilir', () => {
  test('örnek listede ve BEŞ kasnaklı kapalı çevrim kuruyor', () => {
    expect(veFeadExampleKeys()).toContain(KEY);
    const { pack, build } = kur();
    expect(build.ok).toBe(true);
    expect(build.errors || []).toEqual([]);
    expect(build.warnings || []).toEqual([]);
    expect(build.sys.pulleys).toHaveLength(5);
    expect(pack.connections).toHaveLength(5);
  });

  test('kasnak sırası raporun Layout Data sırası', () => {
    const { build } = kur();
    expect(build.order.map((p) => p.customName)).toEqual([
      'Sürücü Kasnak (FAN)', 'Avara', 'Klima Kompresörü', 'Alternatör',
      'Otomatik Gergi (T38665)',
    ]);
  });

  test('DIŞ ÇAP raporun Pitch/Effective sütunlarını geri veriyor', () => {
    // MFSim od ister; rapor pitch + effective basar. Çevrimi çekirdek yapar.
    // Bu kapı od'ları rapordan BAĞIMSIZ doğruluyor: bir od yanlış girilirse
    // geometri yine çözülür (hata YOK), yalnız sayılar kayar.
    const { build } = kur();
    build.sys.pulleys.forEach((p, i) => {
      const ref = G.pulley[G.order[i]];
      expect(p.rPitch * 2).toBeCloseTo(ref.p, 2);
      expect(p.rEff * 2).toBeCloseTo(ref.e, 2);
      expect(p.contact).toBe(ref.c);
    });
  });
});

describe('geometri raporu geri üretiyor', () => {
  test('beş span ve beş sarım açısı', () => {
    const { build } = kur();
    const g = F.geometryAt(build.sys, F.meanRel(build.sys));
    G.order.forEach((key, i) => {
      expect(g.spans[i].L).toBeCloseTo(G.span[key], 1);
      expect(g.wrapDeg(i)).toBeCloseTo(G.wrap[key], 0);
    });
    // Kapalı çevrim değişmezi — çekirdeğin kendi kapısı, burada da tutmalı.
    expect(Math.abs(g.signedWrapDeg)).toBeCloseTo(360, 3);
  });

  test('hız oranları PITCH çapından', () => {
    const { build } = kur();
    G.order.forEach((key, i) => {
      expect(F.speedRatio(build.sys, i)).toBeCloseTo(G.ratio[key], 2);
    });
  });

  test('take-up oranı 1.143 mm/°', () => {
    const { build } = kur();
    const st = F.tensionerState(build.sys, F.meanRel(build.sys));
    expect(st.takeupMmPerDeg).toBeCloseTo(G.takeupRef, 2);
  });
});

describe('gergi konum tablosu — altı konum × altı sütun', () => {
  test('kol açısı · X/Y · gerginlik · hubload · REBL', () => {
    const { build } = kur();
    const rows = F.positionTable(build.sys);
    G.pos.forEach((ref) => {
      const row = rows.find((r) => r.position === POS[ref.name]);
      expect(row).toBeDefined();
      // Load bir MEKANİK STOP: sarım sıfıra yaklaştığı için orada eşik gevşek.
      const gev = ref.name === 'Load';
      // Rapor kol açısını BİR ondalıkla basıyor (±0.05 kendi yuvarlaması);
      // proje ölçütü 0.2°. ÖLÇÜLEN en kötü sapma 0.06° — eşik ölçülene göre.
      expect(Math.abs(row.absDeg - ref.absDeg)).toBeLessThan(0.1);
      expect(row.idlerX).toBeCloseTo(ref.X, 0);
      expect(row.idlerY).toBeCloseTo(ref.Y, 0);
      expect(pctErr(row.tensionN, ref.T)).toBeLessThan(gev ? 1.5 : 0.5);
      expect(pctErr(row.hubloadN, ref.hub)).toBeLessThan(gev ? 1.5 : 0.5);
      expect(row.betaDeg).toBeCloseTo(ref.beta, 0);
      expect(row.requiredBeltMm).toBeCloseTo(ref.REBL, 0);
    });
  });

  test('TÜRETİLEN tasarım gerginliği raporun Design Tension satırına oturuyor', () => {
    // Ankraj örnekte YAZILI DEĞİL — yay dengesinden çıkıyor (T = M/(dL/dθ)).
    // Rapor 476 N basıyor; bu bağımsız bir doğrulama, bir eko değil.
    const { build } = kur();
    expect(veFeadExampleOf(KEY).solver.designTensionN).toBeUndefined();
    expect(pctErr(build.springTensionN, G.design)).toBeLessThan(0.5);
    expect(build.sys.designTensionN).toBeCloseTo(build.springTensionN, 9);
  });

  test('TÜRETİLEN serbest kol açısı raporun Free Arm satırına oturuyor', () => {
    // Bu da örnekte yazılı değil: montaj açısı + yay künyesinden türüyor.
    const { build } = kur();
    expect(tenOf(kur().pack.nodes).freeAngleDeg).toBeUndefined();
    const rows = F.positionTable(build.sys);
    const free = rows.find((r) => r.position === 'FreeArm');
    // absDeg sarmalı ±180 olabilir; 360'a normalize et.
    const norm = ((free.absDeg % 360) + 360) % 360;
    expect(norm).toBeCloseTo(G.freeAbsDeg, 1);
  });

  test('kol boyu çapraz kontrolü GERÇEK denetim (pivot GİRİLİ)', () => {
    // BMC_FEAD_2026'da pivot TÜRETİLİYOR ve kontrol tautolojik; burada pivot
    // raporda ölçülü, merkez de ayrı bir satır → iki BAĞIMSIZ sayı.
    const ac = veFeadArmCheck(tenOf(kur().pack.nodes));
    expect(ac.tautological).toBeFalsy();
    expect(ac.entered).toBe(G.arm);
    expect(ac.fromCoords).toBeCloseTo(G.arm, 1);
    expect(ac.ok).toBe(true);
  });
});

describe('çalışma çevrimi raporu geri üretiyor', () => {
  function coz() {
    const { pack, build } = kur();
    const sd = solverOf(pack.nodes);
    return F.analyze(build.sys, { duty: veFeadDutyToCore(build, sd.duty) });
  }

  test('25 açıklık gerginliği ve 25 hubload', () => {
    const A = coz();
    expect(A.duty).toHaveLength(G.duty.length);
    A.duty.forEach((row, k) => {
      const ref = G.duty[k];
      expect(row.engineRpm).toBe(ref.engineRpm);
      G.order.forEach((key, i) => {
        expect(pctErr(row.perPulley[i].exitTensionN, ref.T[key])).toBeLessThan(0.5);
        expect(pctErr(row.hubloads[i].FN, ref.H[key])).toBeLessThan(0.5);
      });
    });
  });

  test('SÜRÜCÜ kW toplamdan hesaplanıyor — raporun kendi değeri', () => {
    // FAN sütunu duty tablosuna YAZILMAZ; çekirdek onu diğerlerinin toplamı
    // olarak kurar. Elle yazılsaydı çevrim kapanmazdı.
    const sd = solverOf(kur().pack.nodes);
    sd.duty.forEach((r) => expect(Object.keys(r.kw || {}).length).toBeGreaterThan(0));
    const A = coz();
    A.duty.forEach((row, k) => {
      expect(row.perPulley[0].powerKw).toBeCloseTo(G.duty[k].crankKw, 2);
    });
  });

  test('duty sıcaklığı 80 °C ve yüzdeler 100 ediyor', () => {
    const sd = solverOf(kur().pack.nodes);
    expect(sd.duty.every((r) => r.degC === G.degC)).toBe(true);
    expect(sd.duty.reduce((a, r) => a + r.dcPct, 0)).toBeCloseTo(100, 6);
  });
});

describe('modelin KENDİ İLAN ETTİĞİ sınırlar', () => {
  test('B10 geçerlilik aralığının DIŞINDA ve model bunu SÖYLÜYOR', () => {
    // Üç kasnak 79.6 mm tabanının altında (IDR/TEN 78.6, ALT 58.8). Model
    // sayıyı gizlemiyor, sınırı sonucun İÇİNDE taşıyor — düzeltilmiş değer
    // raporun 5632 saatine %1 içinde oturuyor.
    const { pack, build } = kur();
    const A = veFeadAnalyze(build, { rows: solverOf(pack.nodes).duty });
    const life = A.life;
    expect(life.inValidRange).toBe(false);
    expect(life.outOfRange.length).toBe(3);
    expect(pctErr(life.hoursB10Corrected, G.B10)).toBeLessThan(2);
    // Ham değer düzeltilmişten AÇIKÇA ayrı — biri öbürünün yerine geçmemeli.
    expect(life.hoursB10).toBeLessThan(life.hoursB10Corrected * 0.8);
  });

  test('ATALET YOK ve bu SESSİZ DEĞİL', () => {
    // Rapor kasnak ataletlerini basmıyor, örnek de uydurmuyor. Burulma modeli
    // bunu adıyla söylüyor. Sessiz kalsaydı kullanıcı bir frekans görür ve
    // onu ölçülmüş sanardı.
    const ex = veFeadExampleOf(KEY);
    ex.pulleys.forEach((p) => expect(p.data.inertia).toBeUndefined());
    const { pack, build } = kur();
    const A = veFeadAnalyze(build, { rows: solverOf(pack.nodes).duty });
    expect(A.ok).toBe(true);
    expect(A.warnings.join(' ')).toMatch(/atalet/i);
  });

  test('gergi T38665 çekirdeğin ölçülmüş listesinde YOK — künye uydurulmadı', () => {
    const t = veFeadExampleOf(KEY).pulleys.find((p) => p.key === 'TEN').data;
    expect(t.armInertia).toBeUndefined();
    expect(t.pulleyMass).toBeUndefined();
  });
});

describe('üç örnek AYRI kalıyor', () => {
  test('AG00879 kendi gergisini ve kayışını taşıyor', () => {
    const a = veFeadExampleOf(KEY).pulleys.find((p) => p.key === 'TEN').data;
    const b = veFeadExampleOf('AG00976_GATES_2025').pulleys.find((p) => p.key === 'TEN').data;
    // FARKLI gergi: kol boyu 56 ↔ 90, yay künyesi tamamen ayrı.
    expect(a.armLen).toBe(56.0);
    expect(b.armLen).toBe(90.0);
    expect(a.meanLoad).not.toBeCloseTo(b.meanLoad, 1);
    // FARKLI kayış.
    expect(veFeadExampleOf(KEY).belt.effLength).toBe(1392);
    expect(veFeadExampleOf('AG00976_GATES_2025').belt.effLength).toBe(1714.6);
  });

  test('BAŞLIK ile REBL burada AYNI — AG00976 tuzağı her raporda ısırmıyor', () => {
    // AG00976'da başlık 1715, REBL 1714.6 idi. Burada ikisi de 1392: hangisinin
    // geçerli olduğunu REBL sütunu söyler, ve bu örnek onu doğruluyor.
    const mean = G.pos.find((p) => p.name === 'Mean');
    expect(mean.REBL).toBe(1392);
    expect(veFeadExampleOf(KEY).belt.effLength).toBe(mean.REBL);
  });
});

// ════════════════════════════════════════════════════════════════════════════
//  KANVASA KURMA — veFeadExampleNodes'u DOĞRUDAN çağırmak YETMEZ
// ════════════════════════════════════════════════════════════════════════════
// Yukarıdaki bütün testler veFeadExampleNodes'u doğrudan kullanıyor, yani
// düğüm kimlikleri 'ex-*' olarak KALIYOR ve duty kW sözlüğünün eşleşmesi
// TESADÜFEN tutuyor. Gerçek yol (veFeadLoadExample) her düğümü YENİ kimlikle
// kurar; göç yapılmazsa hiçbir aksesuar eşleşmez, hepsi 0 kW ile koşar ve
// UYARI ÇIKMAZ (bkz. CLAUDE.md "duty kW çözüme HİÇ ULAŞMIYORDU"). Bu blok
// gerçek yükleyiciyi koşturuyor.
describe('kanvasa kurma — gerçek yükleyici', () => {
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
    const altId = ns.find((n) => n.type === 'fead-alternator').id;
    const kw = solver.data.duty[0].kw;
    expect(Object.keys(kw)).toContain(altId);
    expect(Object.keys(kw).some((k) => /^ex-/.test(k))).toBe(false);
    expect(kw[altId]).toBe(3.50);
  });

  test('kanvasa kurulan örnek raporun duty tablosunu GERİ ÜRETİYOR', () => {
    const { ns, conns, solver } = kanvasaKur(KEY);
    const build = veFeadBuildSystem(ns, conns);
    expect(build.ok).toBe(true);
    const res = veFeadAnalyze(build, { rows: veFeadDutyRows(solver) });
    const r0 = res.analysis.duty[0];
    expect(r0.perPulley[0].powerKw).toBeCloseTo(G.duty[0].crankKw, 2);
    G.order.forEach((key, k) => {
      expect(pctErr(r0.perPulley[k].exitTensionN, G.duty[0].T[key])).toBeLessThan(0.5);
      expect(pctErr(r0.hubloads[k].FN, G.duty[0].H[key])).toBeLessThan(0.5);
    });
  });

  test('GÖÇ OLMAZSA sonuç GERÇEKTEN bozulur — yüksüz koşar', () => {
    // Kapının ısırdığının kanıtı: göçü geri alınca bütün açıklık gerginlikleri
    // tasarım gerginliğine (≈476 N) düzleşiyor ve hiçbir uyarı çıkmıyor.
    const { ns, conns, solver } = kanvasaKur(KEY);
    const bozuk = JSON.parse(JSON.stringify(solver.data.duty));
    bozuk.forEach((r) => {
      const yeniKw = {};
      Object.keys(r.kw).forEach((id) => { yeniKw['ex-' + id] = r.kw[id]; });
      r.kw = yeniKw;
    });
    const build = veFeadBuildSystem(ns, conns);
    const res = veFeadAnalyze(build, { rows: bozuk });
    const r0 = res.analysis.duty[0];
    expect(r0.perPulley[0].powerKw).toBeCloseTo(0, 6);
    // Beş kasnağın BEŞİ de ankraja düzleşiyor — sessiz ve yanlış.
    r0.perPulley.forEach((p) => {
      expect(pctErr(p.exitTensionN, build.springTensionN)).toBeLessThan(0.1);
    });
  });

  test('kasnak kutuları mm koordinatının söylediği yerde', () => {
    // Örnek kurucusu kendi ölçeğini kullansaydı ilk sürükleme koordinatı
    // kaydırırdı (ölçülmüş hata sınıfı: CLAUDE.md "örnek kurucusu kutuyu
    // koordinatın SÖYLEMEDİĞİ yere koyuyordu").
    const { ns } = kanvasaKur(KEY);
    const build = veFeadBuildSystem(ns, global.connections);
    expect(build.ok).toBe(true);
    // Çalışma (Mean) konumundaki merkezler. Gergininki ÇÖZÜLÜR — ve raporun
    // Layout Data TEN satırı da zaten Mean merkezidir, yani o da bu kapıdan
    // geçmek zorunda.
    const g = F.geometryAt(build.sys, F.meanRel(build.sys));
    G.order.forEach((key, i) => {
      const ref = G.xy[key];
      expect(g.pulleys[i].c[0]).toBeCloseTo(ref[0], 1);
      expect(g.pulleys[i].c[1]).toBeCloseTo(ref[1], 1);
    });
  });
});

describe('sihirbaz kartı', () => {
  test('kart üretiliyor ve undefined/NaN basmıyor', () => {
    const html = fead.getFeadExamplePropertiesHTML({ data: {} });
    expect(html).toContain('Anadolu Isuzu 6x6');
    expect(html).toContain('8PK1392HD');
    expect(html).toContain(KEY);
    expect(html).not.toMatch(/undefined|NaN|\[object/);
  });
});
