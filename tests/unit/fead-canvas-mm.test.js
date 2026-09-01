/**
 * fead-canvas-mm.test.js — KANVAS = KAYIŞ DÜZLEMİ
 *
 * Kullanıcı isteği (2026-08-25): *"Krank kasnağına koordinatları girdiğimiz
 * zaman, bu koordinatların 0,0 noktası olması ve topoloji üzerinde bileşenleri
 * hareket ettirdiğimde, örneğin alternatör kasnağını, kanvas üzerinde de
 * hareket etmesi ve hesapların buna göre anında güncellenmesi."*
 *
 * Eskiden kanvastaki konum HİÇBİR ŞEY ifade etmiyordu; çözücü mm
 * koordinatlarını yalnız panelden okuyordu. Artık ikisi TEK BİR ŞEY, ve bu
 * dosya o bağın üç sessiz kırılma noktasını kilitliyor:
 *
 *   1. Y EKSENİ. Kanvasta y aşağı artar, kayış düzleminde yukarı. Ters
 *      yazılırsa bütün topoloji AYNALANIR — ve ölçüldü: TAM ayna bütün
 *      skalerleri birebir aynı bırakıyor (fizik ayna simetrik), yani hata
 *      sayılardan GÖRÜNMEZ. Yalnız çizim aynalanır.
 *   2. KUTU MERKEZİ. node.x/y kutunun SOL ÜSTÜ. Merkez yerine oradan ölçmek
 *      her kasnağa kendi kutu yarısı kadar SİSTEMATİK bir kayma verir —
 *      kutu ölçüleri 54…72 px arasında değiştiği için kayma da kasnaktan
 *      kasnağa değişir, yani tek bir ofsetle yakalanamaz.
 *   3. GERGİ. Merkezi bir girdi DEĞİL, çözücünün çıktısı. Kanvastan onun
 *      merkezine yazmak çözümü ezmek olurdu; taşınan şey PİVOT (+ montaj
 *      merkezi, rijit) ve kol boyu KORUNMAK ZORUNDA — yoksa veFeadArmCheck'in
 *      0.5 mm kapısı kırılır ve kullanıcı sebebini anlamaz.
 */
const M = require('../../js/fead-model.js');
const F = require('../../js/fead-core.js');
const B = require('../../js/fead-belts.js');

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

const P = (o) => JSON.parse(JSON.stringify(o));

// Kanvas düğümü: mm koordinatı data'da, piksel konumu üstte.
const kasnak = (id, type, px, py, data) => {
  const d = componentDefs[type];
  return { id, type, def: d, x: px, y: py,
           width: d.defaultWidth || 65, height: d.defaultHeight || 60,
           data: Object.assign({ od: 80 }, data || {}) };
};

describe('dönüşüm — Y ters, merkezden ölçülür', () => {
  test('gidiş-dönüş birebir', () => {
    const org = kasnak('o', 'fead-crank', 1000, 1000, { driver: true, x: 0, y: 0 });
    const n = kasnak('a', 'fead-alternator', 1234, 876, {});
    const mm = M.veFeadCanvasToMm(n, org, 1);
    const px = M.veFeadMmToCanvas(mm.x, mm.y, org, 1, M.veFeadNodeBox(n));
    expect(px.x).toBeCloseTo(n.x, 9);
    expect(px.y).toBeCloseTo(n.y, 9);
  });

  test('Y TERS: kanvasta AŞAĞI = mm\'de AZALAN', () => {
    const org = kasnak('o', 'fead-crank', 1000, 1000, { driver: true });
    const asagi = kasnak('a', 'fead-alternator', 1000, 1100, {});
    const yukari = kasnak('b', 'fead-alternator', 1000, 900, {});
    expect(M.veFeadCanvasToMm(asagi, org, 1).y).toBeLessThan(0);
    expect(M.veFeadCanvasToMm(yukari, org, 1).y).toBeGreaterThan(0);
  });

  test('X aynen: kanvasta SAĞ = mm\'de ARTAN', () => {
    const org = kasnak('o', 'fead-crank', 1000, 1000, { driver: true });
    const sag = kasnak('a', 'fead-alternator', 1200, 1000, {});
    expect(M.veFeadCanvasToMm(sag, org, 1).x).toBeGreaterThan(0);
  });

  // KUTU ÖLÇÜSÜ SONUCU ETKİLEMEMELİ. Sol üstten ölçen bir dönüşümde 72×66'lık
  // krank ile 54×50'lik avara arasında 9 px'lik sahte bir fark çıkardı.
  test('farklı kutu ölçüleri sistematik kayma ÜRETMEZ', () => {
    const org = kasnak('o', 'fead-crank', 1000, 1000, { driver: true });
    // İki farklı tipte kasnağı AYNI merkeze koy → mm'leri aynı olmalı
    const buyuk = kasnak('a', 'fead-ac', 0, 0, {});
    const kucuk = kasnak('b', 'fead-idler', 0, 0, {});
    const hedefX = 1300, hedefY = 1200;
    buyuk.x = hedefX - buyuk.width / 2;  buyuk.y = hedefY - buyuk.height / 2;
    kucuk.x = hedefX - kucuk.width / 2;  kucuk.y = hedefY - kucuk.height / 2;
    expect(buyuk.width).not.toBe(kucuk.width);          // fikstür gerçekten farklı
    const a = M.veFeadCanvasToMm(buyuk, org, 1), b = M.veFeadCanvasToMm(kucuk, org, 1);
    expect(a.x).toBeCloseTo(b.x, 9);
    expect(a.y).toBeCloseTo(b.y, 9);
  });

  test('1 px = 1 mm', () => {
    expect(M.VE_FEAD_PX_PER_MM).toBe(1);
    const org = kasnak('o', 'fead-crank', 1000, 1000, { driver: true });
    const n = kasnak('a', 'fead-alternator', 1000, 1000, {});
    const once = M.veFeadCanvasToMm(n, org, 1).x;
    n.x += 250;
    expect(M.veFeadCanvasToMm(n, org, 1).x - once).toBeCloseTo(250, 9);
  });
});

describe('orijin = SÜRÜCÜ kasnak', () => {
  test('rol tipin önüne geçer — sürücü FAN olabilir', () => {
    const list = [kasnak('c', 'fead-crank', 0, 0, {}),
                  kasnak('f', 'fead-fan', 0, 0, { driver: true })];
    expect(M.veFeadOriginNode(list).id).toBe('f');
  });

  test('işaret yoksa tipi sürücü olan; kasnak yoksa null', () => {
    expect(M.veFeadOriginNode([kasnak('a', 'fead-alternator', 0, 0, {}),
                               kasnak('c', 'fead-crank', 0, 0, {})]).id).toBe('c');
    expect(M.veFeadOriginNode([])).toBeNull();
    expect(M.veFeadOriginNode([{ id: 'x', type: 'fead-solver',
                                 def: componentDefs['fead-solver'], data: {} }])).toBeNull();
  });

  test('orijinin kendi mm koordinatı (0,0)', () => {
    const org = kasnak('o', 'fead-crank', 1234, 5678, { driver: true, x: 99, y: 99 });
    M.veFeadSyncMmFromCanvas([org], { origin: org });
    expect(org.data.x).toBeCloseTo(0, 9);
    expect(org.data.y).toBeCloseTo(0, 9);
  });
});

describe('senkron — kanvas ↔ mm', () => {
  const kurum = () => {
    const org = kasnak('o', 'fead-crank', 1000, 1000, { driver: true, x: 0, y: 0 });
    const alt = kasnak('a', 'fead-alternator', 0, 0, { x: -200, y: 150 });
    const idl = kasnak('i', 'fead-idler', 0, 0, { x: 120, y: -80 });
    const list = [org, alt, idl];
    M.veFeadSyncCanvasFromMm(list, { origin: org });
    return { list, org, alt, idl };
  };

  test('mm → kanvas: mesafeler birebir, Y ters', () => {
    const { org, alt } = kurum();
    const mo = M.veFeadNodeCenter(org), ma = M.veFeadNodeCenter(alt);
    expect(ma.x - mo.x).toBeCloseTo(-200, 6);
    expect(ma.y - mo.y).toBeCloseTo(-150, 6);        // mm +150 → kanvas −150
  });

  test('kanvas → mm gidiş-dönüş koordinatı DEĞİŞTİRMEZ', () => {
    const { list, alt, idl } = kurum();
    const once = [P(alt.data), P(idl.data)];
    M.veFeadSyncMmFromCanvas(list);
    expect(alt.data.x).toBeCloseTo(once[0].x, 3);
    expect(alt.data.y).toBeCloseTo(once[0].y, 3);
    expect(idl.data.x).toBeCloseTo(once[1].x, 3);
    expect(idl.data.y).toBeCloseTo(once[1].y, 3);
  });

  test('kasnağı sürüklemek mm\'yi O KADAR değiştirir', () => {
    const { list, alt } = kurum();
    alt.x += 37; alt.y -= 22;                        // kanvasta sağa ve YUKARI
    M.veFeadSyncMmFromCanvas(list);
    expect(alt.data.x).toBeCloseTo(-200 + 37, 3);
    expect(alt.data.y).toBeCloseTo(150 + 22, 3);     // yukarı → mm ARTAR
  });

  // ORİJİN DE BİR KASNAK. Krank sürüklenince diğerlerinin krank-göreli konumu
  // değişir ve bu FİZİKSEL OLARAK DOĞRUdur: krank aksesuarlara göre kaymıştır.
  test('ORİJİNİ sürüklemek diğerlerinin mm\'sini karşı yönde kaydırır', () => {
    const { list, org, alt } = kurum();
    org.x += 50;                                     // krank sağa
    M.veFeadSyncMmFromCanvas(list);
    expect(org.data.x).toBe(0);                      // orijin hep (0,0)
    expect(alt.data.x).toBeCloseTo(-200 - 50, 3);    // ötekiler göreli sola
  });

  test('araç düğümlerine DOKUNMAZ', () => {
    const { list } = kurum();
    const solver = { id: 's', type: 'fead-solver', def: componentDefs['fead-solver'],
                     x: 9999, y: 9999, data: { designTensionN: 650 } };
    list.push(solver);
    M.veFeadSyncMmFromCanvas(list);
    M.veFeadSyncCanvasFromMm(list);
    expect(solver.x).toBe(9999);
    expect(solver.data.x).toBeUndefined();
  });

  // Kasnak YOKSA orijin de yok → senkron hiç çalışmaz ve yarım model bozulmaz.
  // (Tek kasnak varsa o KENDİ orijini olur — veFeadResolveDriver ilk kasnağa
  // düşüyor — ve mm'si tanım gereği (0,0) olur.)
  test('kasnak yoksa senkron HİÇBİR ŞEY yapmaz', () => {
    const solver = { id: 's', type: 'fead-solver', def: componentDefs['fead-solver'],
                     x: 5, y: 5, data: {} };
    expect(M.veFeadSyncMmFromCanvas([solver])).toBe(0);
    expect(M.veFeadSyncCanvasFromMm([solver])).toBe(0);
  });

  test('tek kasnak KENDİ orijinidir', () => {
    const a = kasnak('a', 'fead-alternator', 500, 500, { x: 10, y: 10 });
    M.veFeadSyncMmFromCanvas([a]);
    expect(a.data.x).toBeCloseTo(0, 9);
    expect(a.data.y).toBeCloseTo(0, 9);
  });
});

describe('GERGİ — sürükleme AVARA MERKEZİNİ taşır, montaj konumu RİJİT takip eder', () => {
  const gergi = (px, py) => kasnak('t', 'fead-tensioner', px, py, {
    cenX: -170.08, cenY: 99.16, armLen: 90.0, armMeanDeg: 344,
    preload: 8.6, kArm: 0.48, meanLoad: 22.07 });

  test('ORİJİN sürüklenince gerginin merkezi de tazelenir', () => {
    const org = kasnak('o', 'fead-crank', 1000, 1000, { driver: true, x: 0, y: 0 });
    const t = gergi(0, 0);
    const list = [org, t];
    M.veFeadSyncCanvasFromMm(list, { origin: org });
    const onceCen = t.data.cenX;
    const oncePiv = M.veFeadTensionerPivot(t.data)[0];

    org.x += 70;                                  // KRANK sağa sürüklendi
    expect(M.veFeadSyncMmFromCanvas(list, { origin: org })).toBeGreaterThan(0);

    // Krank-göreli olarak gergi 70 mm SOLA kaymış olmalı.
    expect(t.data.cenX).toBeCloseTo(onceCen - 70, 2);
    expect(t.data.pivotX).toBeUndefined();        // ikinci koordinat YOK
    // MONTAJ KONUMU RİJİT TAKİP EDER: kol boyu ve açı dokunulmadığı için
    // türev aynı kadar ötelenir. Ayrı bir yazma yolu GEREKMİYOR ve olmamalı
    // (olsaydı montaj konumu sessizce bir GİRDİYE dönerdi).
    expect(M.veFeadTensionerPivot(t.data)[0]).toBeCloseTo(oncePiv - 70, 2);
  });

  test('gergi düğümü olmayan girdide sessizce false', () => {
    const org = kasnak('o', 'fead-crank', 0, 0, { driver: true });
    expect(M.veFeadDragTensioner(kasnak('a', 'fead-alternator', 0, 0, {}), org, 1)).toBe(false);
    expect(M.veFeadDragTensioner(null, org, 1)).toBe(false);
  });
});

describe('gergi kutusu HANGİ noktayı gösterir — tek okuyucu', () => {
  // Okuyucu `veFeadTensionerBoxMm(data)` — dizi ya da null döner.
  // Gergi kayış düzleminde İKİ noktaya sahip ve hangisinin GİRDİ olduğu kipe
  // bağlı. Aralarında tam kol boyu kadar mesafe var (90 mm), yani karar
  // yanlışsa kutu 90 mm yanlış yerde durur — ve o kutu sürüklenince pivot da
  // 90 mm yanlış yazılır.
  const gergi = (ek) => kasnak('t', 'fead-tensioner', 0, 0, Object.assign({
    cenX: -161.97, cenY: 91.29, armLen: 90, armMeanDeg: -11.9992,
    preload: 8.6, kArm: 0.48, meanLoad: 22.07 }, ek || {}));

  test('kutu AVARA MERKEZİNİ okur — montaj konumunu DEĞİL', () => {
    const t = gergi();
    expect(M.veFeadTensionerBoxMm(t.data)).toEqual([-161.97, 91.29]);
    // Montaj konumu 90 mm ötede ve AYRI bir okuyucudan geliyor.
    const p = M.veFeadTensionerPivot(t.data);
    expect(Math.hypot(p[0] - (-161.97), p[1] - 91.29)).toBeCloseTo(90, 6);
  });

  test('senkron gergiyi ATLAMAZ', () => {
    const org = kasnak('o', 'fead-crank', 1000, 1000, { driver: true, x: 0, y: 0 });
    const t = gergi();
    // Orijin tanım gereği yerinde kalır (yazma olmaz); ölçülen şey GERGİNİN
    // taşınması ve nereye taşındığı.
    expect(M.veFeadSyncCanvasFromMm([org, t], { origin: org })).toBeGreaterThanOrEqual(1);
    // Kutu MERKEZİ avara merkezinin mm konumunda olmalı: krank orijin, Y ters.
    const om = { x: org.x + org.width / 2, y: org.y + org.height / 2 };
    const tm = { x: t.x + t.width / 2, y: t.y + t.height / 2 };
    expect(tm.x - om.x).toBeCloseTo(-161.97, 0);
    expect(tm.y - om.y).toBeCloseTo(-91.29, 0);
  });
});

describe('ORİJİN GÖÇÜ — öteleme BEDAVA (ölçüldü)', () => {
  const bmc = (kaydir) => {
    const pack = veFeadExampleNodes('BMC_FEAD_2026');
    pack.nodes.forEach((n) => { n.def = componentDefs[n.type]; });
    if (kaydir) {
      pack.nodes.forEach((n) => {
        const d = n.data || {};
        if (Number.isFinite(d.x)) { d.x += kaydir[0]; d.y += kaydir[1]; }
        if (Number.isFinite(d.cenX)) { d.cenX += kaydir[0]; d.cenY += kaydir[1]; }
      });
    }
    return pack;
  };
  const coz = (pack) => {
    const b = veFeadBuildSystem(pack.nodes, pack.connections);
    const g = F.geometryAt(b.sys, b.relDeg);
    return { L: g.LeffMm, wrap: g.wraps.map((w) => w * 180 / Math.PI),
             T: F.tensionerState(b.sys, b.relDeg).tensionN };
  };

  // Bütün geometri merkez FARKLARINDAN kuruluyor (tangent: w = c_j − c_i),
  // dolayısıyla öteleme hiçbir şeye dokunmuyor. Krankı orijine almak ÜCRETSİZ.
  test('öteleme L_eff, sarım ve gerginliği BİREBİR bırakır', () => {
    const a = coz(bmc(null));
    const b = coz(bmc([500, -300]));
    expect(b.L).toBeCloseTo(a.L, 9);
    expect(b.T).toBeCloseTo(a.T, 9);
    b.wrap.forEach((w, i) => expect(w).toBeCloseTo(a.wrap[i], 9));
  });

  test('göç krankı (0,0)\'a çeker ve GERİ KALANI birlikte öteler', () => {
    const pack = bmc([500, -300]);
    const krank = pack.nodes.find((n) => n.data && n.data.driver);
    expect(krank.data.x).toBe(500);
    expect(M.veFeadNormalizeOrigin(pack.nodes)).toBeGreaterThan(0);
    expect(krank.data.x).toBe(0);
    expect(krank.data.y).toBe(0);
    // ve çözüm değişmedi
    const a = coz(bmc(null)), b = coz(pack);
    expect(b.L).toBeCloseTo(a.L, 6);
    expect(b.T).toBeCloseTo(a.T, 6);
  });

  test('gerginin AVARA MERKEZİ de ötelenir — KISMİ göç modeli bozardı', () => {
    const pack = bmc([500, -300]);
    const ten = pack.nodes.find((n) => n.type === 'fead-tensioner');
    const once = [ten.data.cenX, ten.data.cenY];
    M.veFeadNormalizeOrigin(pack.nodes);
    // Gergi TEK koordinat taşıyor ve göç onu da 500/−300 kadar geri alıyor.
    expect(ten.data.cenX).toBeCloseTo(once[0] - 500, 6);
    expect(ten.data.cenY).toBeCloseTo(once[1] + 300, 6);
    expect(ten.data.pivotX).toBeUndefined();
  });

  // ESKİ `pivotX/pivotY` DE ÖTELENİR ve bu ölü kod DEĞİL: göç
  // (veFeadMigrateTensioner) alt topoloji açılışında bu fonksiyondan SONRA
  // koşabiliyor. Ötelenmemiş bir montaj konumundan türetilen merkez krankın
  // ofseti kadar yanlış yere düşerdi — sessiz, çünkü model yine çözülür.
  test('göç EDİLMEMİŞ eski kayıtta montaj konumu da ötelenir', () => {
    const eski = [
      kasnak('c', 'fead-crank', 0, 0, { driver: true, x: 500, y: -300, od: 172 }),
      kasnak('t', 'fead-tensioner', 0, 0, { pivotX: 243.41, pivotY: -176.03,
        armLen: 90, armMeanDeg: 344 })
    ];
    expect(M.veFeadNormalizeOrigin(eski)).toBeGreaterThan(0);
    expect(eski[1].data.pivotX).toBeCloseTo(-256.59, 6);
    expect(eski[1].data.pivotY).toBeCloseTo(123.97, 6);
  });
  test('krank zaten (0,0) ise göç HİÇBİR ŞEY yapmaz', () => {
    expect(M.veFeadNormalizeOrigin(bmc(null).nodes)).toBe(0);
  });
});

// ── UÇTAN UCA: sürükle → çözüm değişir ─────────────────────────────────────
describe('sürükleme çözümü GERÇEKTEN değiştiriyor', () => {
  test('alternatörü kanvasta taşımak gereken kayış boyunu değiştirir', () => {
    const pack = veFeadExampleNodes('BMC_FEAD_2026');
    pack.nodes.forEach((n) => { n.def = componentDefs[n.type]; });
    pack.nodes.find((n) => n.type === 'fead-belt').data.lengthMode = 'free';

    // Kanvas konumlarını mm'den kur
    const org = M.veFeadOriginNode(pack.nodes);
    org.x = 1000; org.y = 1000;
    org.width = 72; org.height = 66;
    pack.nodes.forEach((n) => {
      if (!n.width) { n.width = (componentDefs[n.type] || {}).defaultWidth || 65; }
      if (!n.height) { n.height = (componentDefs[n.type] || {}).defaultHeight || 60; }
    });
    M.veFeadSyncCanvasFromMm(pack.nodes, { origin: org });

    const once = veFeadBuildSystem(pack.nodes, pack.connections).beltLengthMm;

    // Alternatörü kanvasta 40 px SOLA sürükle → mm'de −40
    const alt = pack.nodes.find((n) => n.id === 'ex-ALT');
    alt.x -= 40;
    M.veFeadSyncMmFromCanvas(pack.nodes, { origin: org });
    expect(alt.data.x).toBeCloseTo(-281 - 40, 1);

    const sonra = veFeadBuildSystem(pack.nodes, pack.connections).beltLengthMm;
    expect(sonra).toBeGreaterThan(once);            // uzaklaşan kasnak = uzun kayış
    expect(sonra - once).toBeGreaterThan(20);
  });
});

// ── KADEMELİ TAZELEME ───────────────────────────────────────────────────────
// Karar 6: geometri + Kayış Yolu kartı her karede, duty/ömür/burulma bırakınca.
// Sözleşmenin taşıyıcısı TOPOLOJİ İMZASI: kasnak konumu imzaya giriyor (kartı
// tazelesin), araç düğümlerinin konumu GİRMİYOR — 440×500'lük kartı kendi
// kutusundan tutup taşımak çözücüyü koşturmasın.
describe('imza: kasnak konumu girer, araç düğümü GİRMEZ', () => {
  const kurCanvas = () => {
    const org = kasnak('o', 'fead-crank', 1000, 1000, { driver: true, x: 0, y: 0 });
    const alt = kasnak('a', 'fead-alternator', 1200, 1000, { x: 200, y: 0 });
    const layout = { id: 'L', type: 'fead-layout', def: componentDefs['fead-layout'],
                     x: 2000, y: 2000, width: 420, height: 340, data: {} };
    global.nodes = [org, alt, layout];
    global.connections = [{ id: 'c', from: 'o', to: 'a', fromPort: 'output', toPort: 'input' }];
    return { org, alt, layout };
  };

  beforeEach(() => {
    global._feadIsPulley = M.veFeadOriginNode ? _feadIsPulley : undefined;
    eval(loadSource('connections.js'));
    global.veFeadTopoSignature = veFeadTopoSignature;
  });

  test('kasnağın mm koordinatı değişince imza DEĞİŞİR', () => {
    const { alt } = kurCanvas();
    const once = veFeadTopoSignature();
    alt.data.x = 250;
    expect(veFeadTopoSignature()).not.toBe(once);
  });

  test('kasnağın ÇAPI ve TEMAS tarafı da imzada', () => {
    const { alt } = kurCanvas();
    let sig = veFeadTopoSignature();
    alt.data.od = 61;
    expect(veFeadTopoSignature()).not.toBe(sig);
    sig = veFeadTopoSignature();
    alt.data.contact = 'back';
    expect(veFeadTopoSignature()).not.toBe(sig);
  });

  test('KAYIŞ YOLU KARTINI taşımak imzayı DEĞİŞTİRMEZ (çözücü koşmasın)', () => {
    const { layout } = kurCanvas();
    const once = veFeadTopoSignature();
    layout.x += 400; layout.y -= 250;
    expect(veFeadTopoSignature()).toBe(once);
  });

  // Kasnağın KANVAS pikseli de tek başına imzayı değiştirmemeli: imzaya giren
  // şey mm koordinatı. (Sürüklerken ikisi birlikte değişiyor; ayrı ayrı
  // bakmak, senkron kopsa bile kartın boşuna kurulmamasını garanti ediyor.)
  test('yalnız kanvas pikseli değişirse imza AYNI kalır', () => {
    const { alt } = kurCanvas();
    const once = veFeadTopoSignature();
    alt.x += 300; alt.y += 300;
    expect(veFeadTopoSignature()).toBe(once);
  });
});
