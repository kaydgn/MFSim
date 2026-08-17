/**
 * cp-fead.test.js — FEAD SUNUM katmanı (js/cp-fead.js)
 *
 * KAPSAM AYRIMI — üç dosya, üç test:
 *   fead-core.test.js   çekirdek doğru mu (17 Gates raporu, 2095 değer)
 *   fead-model.test.js  köprü çekirdeğe doğru veriyi mi veriyor
 *   BU DOSYA            sunum katmanının sözleşmesi + tip tanımlarının yapısı
 *
 * Burada geometri testi YOK: eskiden vardı ve cp-fead.js kendi kayış çevresini
 * hesaplıyordu — o fonksiyon (veFeadBeltPath) bütün kasnakları dış teğet
 * sayıyordu, yani sırttan temas edenlerde YANLIŞTI (AG00686'da 37°). Emekliye
 * ayrıldı; geometri artık FEADCore.solveGeometry'den geliyor ve
 * fead-model.test.js'te Gates referansına karşı ölçülüyor. Yanlış bir
 * fonksiyonun testlerini taşımak, yanlışı korumak olurdu.
 *
 * CLAUDE.md test politikası: panel üreticilerine alan alan assertion açılmaz;
 * panel başına TEK "üretiliyor mu / patlamıyor mu" smoke testi yeter.
 */
const fead = require('../../js/cp-fead.js');
const M = require('../../js/fead-model.js');
const F = require('../../js/fead-core.js');

// componentDefs, tipten rol/temas okumasının tek kaynağı. Gerçek dosyadan
// yüklenir; testte elle sahte tanım tutmak ikinci bir gerçek kaynak yaratırdı.
const stubs = stubGlobals();
document.body.innerHTML = '<div id="ve-canvas"></div>';
global.nodes = [];
global.connections = [];
eval(loadSource('components.js'));
// Model katmanı ayrı dosyada; tarayıcıda ikisi de global kapsamda yüklenir,
// testte de öyle kurulur (cp-fead.js bu adları çağırıyor).
global.FEADCore = F;
Object.keys(M).forEach((k) => { global[k] = M[k]; });

beforeEach(() => {
  resetStubs(stubs);
  global.nodes = [];
  global.connections = [];
});

// ── Yardımcı: gerçek tip tanımını taşıyan kasnak düğümü ────────────────────
let _id = 0;
const kasnak = (type, data, name) => ({
  id: 'f' + ++_id, type, customName: name || null,
  def: componentDefs[type], data: data || {}
});

describe('Alt-sistem sözleşmesi', () => {
  test('modül paneli "Alt Topolojiyi Aç" kancasını düğümün id\'siyle kurar', () => {
    const html = fead.getFeadModulePropertiesHTML({ id: 'comp-3', type: 'fead-analysis', data: {} });
    expect(html).toContain("veFeadOpenEditor('comp-3')");
    expect(html).toContain('alt topolojisine');
  });

  test('açılmış alt-topolojinin bileşen/bağlantı sayısı özette görünür', () => {
    const html = fead.getFeadModulePropertiesHTML({
      id: 'comp-4', type: 'fead-analysis',
      data: { subTopology: { nodes: [{}, {}, {}, {}], connections: [{}, {}, {}] } }
    });
    expect(html).toContain('>4<');
    expect(html).toContain('>3<');
  });

  test('çift tık kapısı: veFeadOpenEditor yalnız fead-analysis düğümünü açar', () => {
    // Yanlış tipte sessizce çıkmalı — aksi hâlde bir "Motor" düğümüne çift
    // tıklamak canvası boşaltırdı (stack'e yanlış ebeveyn durumu girerdi).
    global.nodes = [{ id: 'x1', type: 'engine', data: {} }];
    global.veSerializeCurrentState = jest.fn(() => ({ nodes: [] }));
    global.veClearCanvasDOM = jest.fn();
    global.veLoadTabState = jest.fn();
    fead.veFeadOpenEditor && fead.veFeadOpenEditor('x1');
    expect(veClearCanvasDOM).not.toHaveBeenCalled();
  });

  test('başlangıç yerleşimi "Başlangıç ve Örnekler" bileşenini içerir', () => {
    // İlk açılışta iç topolojiye yalnız bu bileşen konur (diğer iki modülle
    // aynı kalıp); yerleşimden düşerse modül BOŞ açılırdı.
    const tipler = fead.VE_FEAD_STARTER_LAYOUT.map((it) => it.type);
    expect(tipler).toContain('fead-example');
    expect(tipler).toContain('fead-crank');
    // Yerleşimdeki her tip gerçekten tanımlı olmalı (yazım hatası kapısı)
    tipler.forEach((t) => expect(componentDefs[t]).toBeDefined());
  });
});

describe('componentDefs — FEAD tipleri yapısal olarak tutarlı', () => {
  const feadTipler = () => Object.keys(componentDefs).filter((t) => t.indexOf('fead-') === 0);

  test('her kasnak kayış yolu için 1 giriş + 1 çıkış taşır', () => {
    feadTipler().filter((t) => componentDefs[t].isFeadPulley).forEach((t) => {
      expect(componentDefs[t].inputs).toBe(1);
      expect(componentDefs[t].outputs).toBe(1);
    });
  });

  test('araç blokları (kayış künyesi/çözücü/şema/örnek/rapor) portsuzdur', () => {
    ['fead-belt', 'fead-solver', 'fead-layout', 'fead-example', 'fead-report'].forEach((t) => {
      expect(componentDefs[t].inputs).toBe(0);
      expect(componentDefs[t].outputs).toBe(0);
    });
  });

  test('tam bir tahrik zinciri kurulabilir: krank + aksesuar + gergi + avara', () => {
    const roller = feadTipler().reduce((a, t) => {
      const d = componentDefs[t];
      if (d.isFeadDriver) a.driver++;
      if (d.isFeadAccessory) a.acc++;
      if (d.isFeadTensioner) a.tens++;
      if (d.isFeadIdler) a.idler++;
      return a;
    }, { driver: 0, acc: 0, tens: 0, idler: 0 });
    expect(roller.driver).toBe(1);          // tek tahrik kaynağı: krank
    expect(roller.acc).toBeGreaterThan(3);
    expect(roller.tens).toBe(1);
    expect(roller.idler).toBe(1);
  });

  test('her tipin sembolü var ve viewBox 0 0 100 100 (palet ölçü dili)', () => {
    feadTipler().forEach((t) => {
      expect(componentDefs[t].svg).toContain('viewBox="0 0 100 100"');
      expect(componentDefs[t].name).toBeTruthy();
    });
  });

  test('kayış künyesi iç topolojide tek kopya', () => {
    expect(componentDefs['fead-belt'].maxInstances).toBe(1);
  });
});

// ── Temas tarafı: TİP VARSAYILANI yapısal kapı ──────────────────────────────
// Bir kasnak tipine feadContact koymayı unutmak sessizce 'grooved' demektir;
// avara ve gergi o zaman kayışı yanlış taraftan sarar ve HATA VERİLMEZ.
describe('componentDefs — temas tarafı varsayılanları', () => {
  test('avara ve gergi sırttan, tahrik ve aksesuarlar kaburgalı', () => {
    expect(componentDefs['fead-idler'].feadContact).toBe('back');
    expect(componentDefs['fead-tensioner'].feadContact).toBe('back');
    expect(componentDefs['fead-crank'].feadContact).toBe('grooved');
    Object.keys(componentDefs)
      .filter((t) => componentDefs[t].isFeadAccessory)
      .forEach((t) => expect(componentDefs[t].feadContact).toBe('grooved'));
  });
});

// ── Kanvas rozeti ───────────────────────────────────────────────────────────
// Temas tarafı sessiz hatanın kaynağı; rozet onu gözle görünür kılan tek şey.
// Rozetin İÇERİĞİ değil, DOĞRU DEĞERİ yansıtması test ediliyor.
describe('veFeadApplyBadge — temas tarafı kanvasta görünür', () => {
  const el = () => {
    const d = document.createElement('div');
    d.className = 've-node';
    d.innerHTML = '<div class="ve-node-box"></div>';
    return d;
  };
  const rozet = (node) => {
    const e = el();
    fead.veFeadApplyBadge(e, node);
    return e.querySelector('.ve-fead-badge');
  };

  test('kaburgalı K, sırttan S gösterir', () => {
    expect(rozet(kasnak('fead-alternator')).textContent).toBe('K');
    expect(rozet(kasnak('fead-idler')).textContent).toBe('S');
  });

  test('kullanıcının ezdiği değeri yansıtır', () => {
    expect(rozet(kasnak('fead-idler', { contact: 'grooved' })).textContent).toBe('K');
  });

  test('sürücü kasnak ayrıca işaretlenir', () => {
    expect(rozet(kasnak('fead-crank', { driver: true })).textContent).toBe('► K');
  });

  test('kasnak olmayan düğüme rozet konmaz; iki kez çağrılınca çoğalmaz', () => {
    expect(rozet(kasnak('fead-belt'))).toBeNull();
    const e = el(), n = kasnak('fead-ac');
    fead.veFeadApplyBadge(e, n);
    fead.veFeadApplyBadge(e, n);
    expect(e.querySelectorAll('.ve-fead-badge')).toHaveLength(1);
  });
});

// ── Panel smoke testleri ────────────────────────────────────────────────────
// Her panel: dizgi üretiyor mu, ISTISNA ATMIYOR mu. Alan alan assertion YOK
// (etiket değişince kırılır, davranışı değil detayı test eder).
describe('panel üreticileri — üretiliyor ve patlamıyor', () => {
  const paneller = [
    ['getFeadModulePropertiesHTML', { id: 'm1', type: 'fead-analysis', data: {} }],
    ['getFeadPulleyPropertiesHTML', kasnak('fead-crank', { od: 160, x: 0, y: 0 })],
    ['getFeadPulleyPropertiesHTML', kasnak('fead-idler', {})],
    ['getFeadTensionerPropertiesHTML', kasnak('fead-tensioner', {})],
    ['getFeadBeltPropertiesHTML', kasnak('fead-belt', {})],
    ['getFeadExamplePropertiesHTML', kasnak('fead-example', {})],
    ['getFeadReportPropertiesHTML', kasnak('fead-report', {})]
  ];
  paneller.forEach(([fn, node], i) => {
    test(fn + ' (#' + i + ') boş veriyle çalışır', () => {
      const html = fead[fn](node);
      expect(typeof html).toBe('string');
      expect(html.length).toBeGreaterThan(50);
    });
  });

  // Kasnak paneli açılırken eski kaydı göç ettirmeli (dia → od); açmak
  // veriyi bozmamalı ama eskimiş alanı da bırakmamalı.
  test('kasnak paneli açılınca dia → od göçü uygulanır', () => {
    const n = kasnak('fead-ac', { dia: 120 });
    fead.getFeadPulleyPropertiesHTML(n);
    expect(n.data.od).toBe(120);
    expect(n.data.dia).toBeUndefined();
  });
});

// ── Çözücü ve şema: TOPOLOJİYE bakan paneller ───────────────────────────────
// Bunlar canlı `nodes`/`connections` okur. İki uç durum kritik: yarım kurulmuş
// model (hata sayılmalı, patlamamalı) ve tam model (şema + tablo gelmeli).
describe('topolojiye bakan paneller', () => {
  const kurTam = () => {
    const crk = kasnak('fead-crank', { od: 160, x: 0, y: 0, driver: true }, 'CRK');
    const idr = kasnak('fead-idler', { od: 75, x: -72, y: 267 }, 'IDR');
    const ac = kasnak('fead-ac', { od: 127, x: -224, y: 448 }, 'A_C');
    const ten = kasnak('fead-tensioner', {
      od: 75, pivotX: -180, pivotY: 100, armLen: 90,
      preload: 8.59, kArm: 0.482, freeAngleDeg: 42, sense: 1, loadStopRelDeg: 62.4
    }, 'TEN');
    const belt = kasnak('fead-belt', {
      profile: 'PK', brand: 'GATES', ribs: 8, effLength: 1475, tolerance: 6, wearPct: 0.007
    });
    const sv = kasnak('fead-solver', { designTensionN: 765.7, driveRatio: 1, lengthOffsetMm: 3.5 });
    global.nodes = [crk, idr, ac, ten, belt, sv];
    global.connections = [[crk, idr], [idr, ac], [ac, ten], [ten, crk]]
      .map(([a, b]) => ({ id: 'c' + a.id + b.id, from: a.id, to: b.id, fromPort: 'output', toPort: 'input' }));
    return { sv, layout: kasnak('fead-layout', {}) };
  };

  test('boş topolojide çözücü paneli patlamaz, eksikleri sayar', () => {
    global.nodes = []; global.connections = [];
    const html = fead.getFeadSolverPropertiesHTML(kasnak('fead-solver', {}));
    expect(typeof html).toBe('string');
    expect(html).toMatch(/çözülemedi|kasnak yok/i);
  });

  test('boş topolojide şema paneli patlamaz', () => {
    global.nodes = []; global.connections = [];
    expect(typeof fead.getFeadLayoutPropertiesHTML(kasnak('fead-layout', {}))).toBe('string');
  });

  test('tam modelde şema SVG üretir ve kayış yolu yayları çizilir', () => {
    const { layout } = kurTam();
    const build = veFeadBuildFromCanvas();
    expect(build.ok).toBe(true);
    const svg = fead.veFeadLayoutSVG(build, 320, 240);
    expect(svg).toMatch(/^<svg /);
    // Dört kasnak → dört teğet + dört sarım yayı
    expect((svg.match(/ A/g) || []).length).toBe(4);
    expect(typeof fead.getFeadLayoutPropertiesHTML(layout)).toBe('string');
  });

  test('tam modelde çözücü paneli konum tablosunu üretir', () => {
    const { sv } = kurTam();
    const html = fead.getFeadSolverPropertiesHTML(sv);
    expect(html).toMatch(/Serbest kol/);
    expect(html).toMatch(/Ortalama/);
    expect(html).toMatch(/çözüldü/);
  });
});
