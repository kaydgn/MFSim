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
const fead = require('../../js/cp-fead.js');
const F = require('../../js/fead-core.js');
const B = require('../../js/fead-belts.js');

const stubs = stubGlobals();
document.body.innerHTML = '<div id="ve-canvas"></div>';
global.nodes = [];
global.connections = [];
eval(loadSource('components.js'));
// components.js'teki yüklem GLOBAL'e yazılır: cp-fead.js / state.js require ile
// yükleniyor, dolayısıyla çıplak `veIsCanvasHidden` referansı bu dosyanın
// kapsamını DEĞİL global'i arar. Yazılmazsa kutusuz düğüm kapısı sessizce
// atlanır ve testler kutuların hâlâ kurulduğu bir dünyayı ölçer.
global.veIsCanvasHidden = veIsCanvasHidden;
global.componentDefs = componentDefs;
global.FEADCore = F;
Object.keys(B).forEach((k) => { global[k] = B[k]; });
Object.keys(M).forEach((k) => { global[k] = M[k]; });

beforeEach(() => { resetStubs(stubs); global.nodes = []; global.connections = []; });

const P = (o) => JSON.parse(JSON.stringify(o));

// EKRAN X İŞARETİ — beklentiler bayraktan TÜRETİLİR, sabitlenmez.
// Kanvas da bir çizimdir ve çizim düzlemi ön görünüşe alınınca (2026-09-07,
// krank CW konvansiyonu) kanvasın X'i de aynalanır. Bu dosya X'in İŞARETİNİ
// değil, kanvas ↔ mm bağının KENDİSİNİ ölçüyor; işaret düzlemden okunuyor
// (fead-spin.test.js'teki `cizimYonu` ile aynı kalıp).
// ÇİZİM AYNALANMAZ — X işareti sabit (bkz. fead-model.js, "TEK ÇERÇEVE VAR").
const SX = () => 1;

// Kanvas düğümü: mm koordinatı data'da, piksel konumu üstte.
const kasnak = (id, type, px, py, data) => {
  const d = componentDefs[type];
  return { id, type, def: d, x: px, y: py,
           width: d.defaultWidth || 65, height: d.defaultHeight || 60,
           data: Object.assign({ od: 80 }, data || {}) };
};


// KANVAS ↔ mm SENKRONU KALKTI (2026-09-09) — kasnakların kutusu yok, koordinat
// yalnız Kayış Tablosu'ndan giriliyor. Bu dosyada kalan şey mm tarafının hâlâ
// canlı olan üç parçası: orijinin KİM olduğu, gerginin kutu noktasının tek
// okuyucusu ve orijin göçünün bedava oluşu.
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

  // "Senkron gergiyi atlamaz" testi KALKTI: kanvas ↔ mm senkronu 2026-09-09'da
  // kasnak kutularıyla birlikte kaldırıldı. Okuyucunun tekliği ise KALDI ve
  // asıl kapı o: Kayış Tablosu gergi satırının X/Y'sini buradan alıyor, ikinci
  // bir "gerginin koordinatı hangisi" kuralı yazılırsa satır boş görünür.
  test('tablo gergi satırını AYNI okuyucudan alıyor', () => {
    const t = gergi();
    global.nodes = [kasnak('o', 'fead-crank', 0, 0, { driver: true, x: 0, y: 0, od: 160 }), t];
    const satir = fead.veFeadTableRows({ order: global.nodes }).rows
      .find((r) => r.tensioner);
    expect(satir).toBeTruthy();
    expect([satir.xMm, satir.yMm]).toEqual(M.veFeadTensionerBoxMm(t.data));
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
    const b = veFeadBuildSystem(pack.nodes);
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
