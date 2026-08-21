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
// Tarayıcıda components.js'teki defaultPortSide, cp-fead.js'teki
// veFeadPortSideFor'u GLOBAL olarak görüyor (ikisi de üst-seviye bildirim).
// Testte köprü elle kurulur; yoksa kanca sessizce atlanır ve "elle taşınan
// port kazanır" testi doğru sebepten değil, kanca hiç çalışmadığı için geçer.
global.veFeadPortSideFor = fead.veFeadPortSideFor;

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
    ['getFeadExamplePropertiesHTML', kasnak('fead-example', {})]
    // getFeadReportPropertiesHTML ARTIK BURADA DEĞİL: rapor üreteci kendi
    // dosyasına taşındı (js/cp-fead-report.js) ve orada test ediliyor
    // (tests/unit/cp-fead-report.test.js). Aynı adı iki dosyada üst-seviye
    // bildirmek `source-hygiene` kapısına takılırdı.
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
    // Dört kasnak → dört teğet + dört sarım yayı. Sayım KAYIŞ YOLUNUN kendi
    // path'inde yapılır (data-ve="belt"): dönüş okları ve yön gülü de yay
    // çiziyor, SVG'nin tamamında "A" saymak onları da toplardı.
    const belt = /<path data-ve="belt" d="([^"]+)"/.exec(svg);
    expect(belt).not.toBeNull();
    expect((belt[1].match(/ A/g) || []).length).toBe(4);
    expect((belt[1].match(/ L/g) || []).length).toBe(4);
    expect(typeof fead.getFeadLayoutPropertiesHTML(layout)).toBe('string');
  });

  // ── KAYIŞIN KABURGALI YÜZÜ ────────────────────────────────────────────
  // Temas tarafı bu modülün en pahalı SESSİZ hatası (ters verilirse çekirdek
  // geçerli ama başka bir güzergâh çözer). Şemada şimdiye kadar yalnız
  // kasnağın kesikli çemberi söylüyordu — bir uzlaşım. Diş sırası bunu
  // parçanın kendisi olarak gösteriyor ve tek bir işaret kuralına dayanıyor;
  // bu modülde işaret kuralları BİR KEZ ters yazıldı (yay sweep bayrağı,
  // "bükülmüş kayış"). O yüzden burada üslup değil GEOMETRİ ölçülüyor.
  test('dişler kaburgalı kasnakta İÇERİ, sırttan temas edende DIŞARI bakar', () => {
    kurTam();
    const build = veFeadBuildFromCanvas();
    const svg = fead.veFeadLayoutSVG(build, 420, 340);
    const rib = /<path data-ve="rib" d="([^"]+)"/.exec(svg);
    expect(rib).not.toBeNull();
    const disler = [...rib[1].matchAll(/M([-\d.]+) ([-\d.]+)L([-\d.]+) ([-\d.]+)/g)]
      .map((m) => ({ x1: +m[1], y1: +m[2], x2: +m[3], y2: +m[4] }));
    expect(disler.length).toBeGreaterThan(30);

    // Kasnak çemberleri SVG'den okunur — testin kendi geometrisi yok.
    const kasnaklar = [...svg.matchAll(
      /<circle data-ve="pulley" cx="([-\d.]+)" cy="([-\d.]+)" r="([-\d.]+)"([^>]*)>/g)]
      .map((m) => ({ cx: +m[1], cy: +m[2], r: +m[3], back: /stroke-dasharray/.test(m[4]) }));
    expect(kasnaklar.length).toBe(4);

    let sarımDisi = 0;
    disler.forEach((t) => {
      // Diş TABANI bir kasnağın çeperindeyse o kasnağın sarım yayındadır.
      const k = kasnaklar.find(
        (c) => Math.abs(Math.hypot(t.x1 - c.cx, t.y1 - c.cy) - c.r) < 0.6);
      if (!k) return;
      sarımDisi++;
      const d1 = Math.hypot(t.x1 - k.cx, t.y1 - k.cy);
      const d2 = Math.hypot(t.x2 - k.cx, t.y2 - k.cy);
      if (k.back) expect(d2).toBeGreaterThan(d1);   // sırt → dişler dışarı
      else        expect(d2).toBeLessThan(d1);      // kaburgalı → dişler içeri
    });
    expect(sarımDisi).toBeGreaterThan(10);
  });

  // TERS ÇEVRİMDE DE DOĞRU. Diş yönü çevrimin dönüş yönüne (sense) bağlı;
  // sabit bir yön yazılırsa BU topolojide doğru, aynasında YANLIŞ çıkardı ve
  // hiçbir şey uyarmazdı. Aynalanmış kasnak takımı çevrimin yönünü tersine
  // çevirir — kural tek olduğu için sonuç aynı kalmak zorunda.
  test('aynalanmış topolojide (ters çevrim yönü) diş yönü yine doğru', () => {
    kurTam();
    global.nodes.forEach((n) => {
      if (n.data && typeof n.data.x === 'number') n.data.x = -n.data.x;
      if (n.data && typeof n.data.pivotX === 'number') {
        n.data.pivotX = -n.data.pivotX;
        n.data.freeAngleDeg = 180 - n.data.freeAngleDeg;
      }
    });
    const build = veFeadBuildFromCanvas();
    expect(build.ok).toBe(true);
    const svg = fead.veFeadLayoutSVG(build, 420, 340);
    const rib = /<path data-ve="rib" d="([^"]+)"/.exec(svg)[1];
    const kasnaklar = [...svg.matchAll(
      /<circle data-ve="pulley" cx="([-\d.]+)" cy="([-\d.]+)" r="([-\d.]+)"([^>]*)>/g)]
      .map((m) => ({ cx: +m[1], cy: +m[2], r: +m[3], back: /stroke-dasharray/.test(m[4]) }));
    let n = 0;
    [...rib.matchAll(/M([-\d.]+) ([-\d.]+)L([-\d.]+) ([-\d.]+)/g)].forEach((m) => {
      const x1 = +m[1], y1 = +m[2], x2 = +m[3], y2 = +m[4];
      const k = kasnaklar.find((c) => Math.abs(Math.hypot(x1 - c.cx, y1 - c.cy) - c.r) < 0.6);
      if (!k) return;
      n++;
      const d1 = Math.hypot(x1 - k.cx, y1 - k.cy), d2 = Math.hypot(x2 - k.cx, y2 - k.cy);
      if (k.back) expect(d2).toBeGreaterThan(d1);
      else        expect(d2).toBeLessThan(d1);
    });
    expect(n).toBeGreaterThan(10);
  });

  test('diş uzunluğu sabit ve künye satırı var (ölçek ne olursa olsun)', () => {
    kurTam();
    const build = veFeadBuildFromCanvas();
    const svg = fead.veFeadLayoutSVG(build, 420, 340);
    expect(svg).toMatch(/data-ve="rib-legend"/);
    const rib = /<path data-ve="rib" d="([^"]+)"/.exec(svg)[1];
    const boy = [...rib.matchAll(/M([-\d.]+) ([-\d.]+)L([-\d.]+) ([-\d.]+)/g)]
      .map((m) => Math.hypot(+m[3] - +m[1], +m[4] - +m[2]));
    boy.forEach((b) => expect(b).toBeCloseTo(3.2, 1));
  });

  test('tam modelde çözücü paneli konum tablosunu üretir', () => {
    const { sv } = kurTam();
    const html = fead.getFeadSolverPropertiesHTML(sv);
    expect(html).toMatch(/Serbest kol/);
    expect(html).toMatch(/Ortalama/);
    expect(html).toMatch(/çözüldü/);
  });
});

// ════════════════════════════════════════════════════════════════════════════
//  KAYIŞ BAĞLANTISININ UCU — KOMŞUYA BAKAN KENAR
// ════════════════════════════════════════════════════════════════════════════
// Klasik kural (giriş SOLDA, çıkış SAĞDA) bir ÇEVRİMDE yolun yarısında ters
// düşüyor: kayış sağdan sola dönerken tel düğümün ÜSTÜNDEN geri geçiyor ve
// teller birbirini kesiyor. Kenar seçimi yerleşimi ya da düğümü DEĞİŞTİRMİYOR;
// yalnız telin çıktığı kenarı seçiyor.
describe('kayış bağlantısı komşuya bakan kenardan çıkar', () => {
  const kur = (yerler) => {
    const ns = yerler.map((y, i) => ({
      id: 'p' + i, type: y.t || 'fead-idler', def: componentDefs[y.t || 'fead-idler'],
      x: y.x, y: y.y, width: y.w || 54, height: y.h || 50, data: {}
    }));
    global.nodes = ns;
    global.connections = ns.map((n, i) => ({
      id: 'c' + i, from: n.id, to: ns[(i + 1) % ns.length].id,
      fromPort: 'output', toPort: 'input'
    }));
    return ns;
  };

  test('çıkış SIRADAKİ kasnağa, giriş ÖNCEKİNE bakar (dört yön)', () => {
    // Kare bir düzen: 0 sol-üst, 1 sağ-üst, 2 sağ-alt, 3 sol-alt
    const n = kur([{ x: 0, y: 0 }, { x: 400, y: 0 }, { x: 400, y: 400 }, { x: 0, y: 400 }]);
    expect(fead.veFeadPortSideFor(n[0], 'output')).toBe('right');   // → 1
    expect(fead.veFeadPortSideFor(n[0], 'input')).toBe('bottom');   // ← 3
    expect(fead.veFeadPortSideFor(n[1], 'output')).toBe('bottom');  // → 2
    expect(fead.veFeadPortSideFor(n[1], 'input')).toBe('left');     // ← 0
    expect(fead.veFeadPortSideFor(n[2], 'output')).toBe('left');    // → 3
    expect(fead.veFeadPortSideFor(n[3], 'output')).toBe('top');     // → 0
  });

  // Kenar seçimi kutunun ORANINA göre yapılır. Sabit 45° köşegeni kullanmak
  // geniş kutuda yanlış kenarı seçerdi: 200×50'lik bir kutuda 60° yukarı bakan
  // bir komşu için doğru cevap ÜST değil YAN'dır (kutu alçak ve geniş).
  test('kenar kutunun ORANINA göre seçilir, sabit 45° köşegenle değil', () => {
    const n = kur([{ x: 0, y: 0, w: 200, h: 50 }, { x: 190, y: -110 }]);
    // Δ = (+95, −85): |dx|·h = 95·50 = 4750 ; |dy|·w = 85·200 = 17000 → ÜST
    expect(fead.veFeadPortSideFor(n[0], 'output')).toBe('top');
    // Aynı yön, kutu KARE olsaydı: |dx|·h = 95·50 vs |dy|·w = 85·50 → SAĞ
    n[0].width = 50; n[0].height = 50;
    n[1].x = 145; n[1].y = -60;   // Δ = (+95, −85) merkezden merkeze korunur
    expect(fead.veFeadPortSideFor(n[0], 'output')).toBe('right');
  });

  test('kasnak olmayan düğüm ve bağlanmamış port null döner (klasik kural kalır)', () => {
    const n = kur([{ x: 0, y: 0 }, { x: 300, y: 0 }]);
    expect(fead.veFeadPortSideFor({ id: 'x', type: 'fead-belt', def: componentDefs['fead-belt'],
      x: 0, y: 0, data: {} }, 'output')).toBeNull();
    global.connections = [];
    expect(fead.veFeadPortSideFor(n[0], 'output')).toBeNull();
  });

  // VARSAYILAN olmak zorunda: kullanıcı bir portu sağ tıkla taşıdıysa
  // (node.data.portPositions) onun seçimi kazanmalı, yoksa taşıma işe yaramaz.
  test('defaultPortSide buradan okur; elle taşınan port yine de kazanır', () => {
    const n = kur([{ x: 0, y: 0 }, { x: 0, y: 400 }]);
    expect(defaultPortSide(n[0], 'output')).toBe('bottom');
    n[0].data.portPositions = { output: { side: 'left' } };
    expect(vePortOffset(n[0], 'output').side).toBe('left');
  });
});

// ════════════════════════════════════════════════════════════════════════════
//  TEDARİKÇİ SAYFASININ BİÇİMİ (FEAD_INFORMATION)
// ════════════════════════════════════════════════════════════════════════════
// Panel testleri kasıtlı olarak SEYREK: her etiket için assertion açmak
// kırılgan olurdu (bkz. CLAUDE.md test politikası). Burada test edilen şey
// etiketler değil, panelin HANGİ ALANLARI SORDUĞU — çünkü yanlış alan setini
// sormak sessiz bir hesap hatasına dönüşüyor (montaj merkezi ↔ serbest açı).
describe('gergi paneli sayfanın biçimini soruyor', () => {
  test('montaj yolunda montaj merkezi sorulur, serbest açı SORULMAZ', () => {
    const ten = kasnak('fead-tensioner', {
      angleMode: 'mount', pivotX: -259.94, pivotY: 104.15,
      cenX: -170.08, cenY: 99.16, armLen: 90, preload: 8.6, kArm: 0.48, meanLoad: 22.07
    });
    const html = fead.getFeadTensionerPropertiesHTML(ten);
    expect(html).toMatch(/veFeadSet\('[^']+','cenX'/);
    expect(html).toMatch(/veFeadSet\('[^']+','meanLoad'/);
    expect(html).not.toMatch(/veFeadSet\('[^']+','freeAngleDeg'/);
  });

  test('elle yolunda serbest açı sorulur, montaj merkezi SORULMAZ', () => {
    const ten = kasnak('fead-tensioner', { angleMode: 'direct', freeAngleDeg: 42 });
    const html = fead.getFeadTensionerPropertiesHTML(ten);
    expect(html).toMatch(/veFeadSet\('[^']+','freeAngleDeg'/);
    expect(html).not.toMatch(/veFeadSet\('[^']+','cenX'/);
  });

  // ESKİ KAYIT: yalnız freeAngleDeg taşıyan bir gergi 'direct' modda açılmalı.
  // Panel 'mount' gösterirse kullanıcı boş bir montaj kutusu görür ve kendi
  // çalışan modelinin bozulduğunu sanır.
  test('yalnız serbest açı taşıyan ESKİ kayıt elle modda açılır', () => {
    const ten = kasnak('fead-tensioner', { pivotX: 0, pivotY: 0, armLen: 90, freeAngleDeg: 42 });
    const html = fead.getFeadTensionerPropertiesHTML(ten);
    expect(html).toMatch(/value="direct" selected/);
    expect(html).toMatch(/veFeadSet\('[^']+','freeAngleDeg'/);
  });

  test('montaj merkezi taşıyan kayıt montaj modunda açılır', () => {
    const ten = kasnak('fead-tensioner', { pivotX: -259.94, pivotY: 104.15, cenX: -170.08, cenY: 99.16 });
    expect(fead.getFeadTensionerPropertiesHTML(ten)).toMatch(/value="mount" selected/);
  });

  test('kol boyu çapraz kontrolü panelde GÖRÜNÜR', () => {
    const tam = kasnak('fead-tensioner', {
      angleMode: 'mount', pivotX: -259.94, pivotY: 104.15,
      cenX: -170.08, cenY: 99.16, armLen: 90, preload: 8.6, kArm: 0.48, meanLoad: 22.07
    });
    expect(fead.getFeadTensionerPropertiesHTML(tam)).toMatch(/tutuyor/);
    const bozuk = kasnak('fead-tensioner', {
      angleMode: 'mount', pivotX: -259.94, pivotY: 104.15,
      cenX: -170.08, cenY: 99.16, armLen: 70, preload: 8.6, kArm: 0.48, meanLoad: 22.07
    });
    expect(fead.getFeadTensionerPropertiesHTML(bozuk)).toMatch(/TUTMUYOR/);
  });
});

describe('çözücü paneli: birinci kademe ve motor künyesi', () => {
  test('türetme modunda iki çap sorulur, oran gösterilir', () => {
    const sv = kasnak('fead-solver', { ratioMode: 'derive', crankOD: 197.32, fanOD: 179.62 });
    const html = fead.veFeadDriveCard(sv);
    expect(html).toMatch(/veFeadSet\('[^']+','crankOD'/);
    expect(html).toMatch(/veFeadSet\('[^']+','fanOD'/);
    expect(html).toMatch(/1\.0985/);                       // 197.32 / 179.62
    expect(html).not.toMatch(/veFeadSet\('[^']+','driveRatio'/);
  });

  test('elle modda oran kutusu sorulur, çaplar SORULMAZ', () => {
    const sv = kasnak('fead-solver', { ratioMode: 'direct', driveRatio: 1.1 });
    const html = fead.veFeadDriveCard(sv);
    expect(html).toMatch(/veFeadSet\('[^']+','driveRatio'/);
    expect(html).not.toMatch(/veFeadSet\('[^']+','crankOD'/);
  });

  // Hesaba GİRMEYEN alanların girmediği yazılı olmalı: sessizce alan açmak
  // "girdim, hesaba girdi" izlenimi verir.
  test('motor künyesi kartı hangi alanın hesaba girmediğini SÖYLER', () => {
    const html = fead.veFeadEngineCard(kasnak('fead-solver', {}));
    expect(html).toMatch(/veFeadSet\('[^']+','cylinders'/);
    expect(html).toMatch(/veFeadSet\('[^']+','crankInertia'/);
    expect(html).toMatch(/veFeadSet\('[^']+','serviceFact'/);
    expect(html).toMatch(/hesaba katmaz/);
  });
});

describe('güç eğrisi kartı', () => {
  test('aksesuarda görünür, AVARADA görünmez', () => {
    const ac = kasnak('fead-ac', { od: 152, x: 0, y: 0 });
    const idr = kasnak('fead-idler', { od: 75, x: 0, y: 0 });
    expect(fead.getFeadPulleyPropertiesHTML(ac)).toMatch(/Güç Eğrisi/);
    expect(fead.getFeadPulleyPropertiesHTML(idr)).not.toMatch(/Güç Eğrisi/);
  });

  test('boş eğride satır eklenebilir, dolu eğri satırları basılır', () => {
    const bos = kasnak('fead-ac', { od: 152, x: 0, y: 0 });
    expect(fead.veFeadPowerCurveCard(bos)).toMatch(/veFeadCurveAdd/);
    const dolu = kasnak('fead-ac', { od: 152, x: 0, y: 0,
      pwrCurve: [{ rpm: 1000, kw: 2 }, { rpm: 2000, kw: 6 }] });
    const html = fead.veFeadPowerCurveCard(dolu);
    expect((html.match(/veFeadCurveSet/g) || []).length).toBe(4);   // 2 satır × 2 alan
    expect((html.match(/veFeadCurveRemove/g) || []).length).toBe(2);
  });

  test('tek noktalı eğri UYARIR (sabit güç gibi davranır)', () => {
    const tek = kasnak('fead-ac', { od: 152, x: 0, y: 0, pwrCurve: [{ rpm: 1500, kw: 3 }] });
    expect(fead.veFeadPowerCurveCard(tek)).toMatch(/Tek nokta/);
  });
});

describe('örnek paneli: tedarikçi sayfası kurulabilir', () => {
  test('kayıt defterindeki her örnek için kurma düğmesi var', () => {
    const html = fead.getFeadExamplePropertiesHTML(kasnak('fead-example', {}));
    veFeadExampleKeys().forEach((k) => {
      expect(html).toMatch(new RegExp("veFeadLoadExample\\('" + k + "'\\)"));
    });
    expect(html).not.toMatch(/Hesap çekirdeği bekleniyor/);   // artık boş değil
  });
});

describe('servis faktörü sonuç tablosunda hüküm veriyor', () => {
  // Sahte bir sonuç nesnesi: gerçek çözüm bu dosyanın işi değil (fead-example
  // orada), burada test edilen şey EŞİĞİN NEREDEN GELDİĞİ.
  const sahteR = (sf, minSF) => ({
    serviceFact: sf, pulleyNames: ['A', 'B'],
    analysis: { duty: [{
      engineRpm: 2000, dcPct: 50, vMs: 12, firingHz: 100,
      perPulley: [{ exitTensionN: 600 }, { exitTensionN: 500 }],
      hubloads: [{ FN: 1200, dirDeg: 90 }, { FN: 900, dirDeg: 180 }],
      slip: [{ SF: minSF }, { SF: minSF + 1 }], warnings: []
    }] }
  });

  test('min SF servis faktörünün üstündeyse GEÇTİ', () => {
    const html = fead.veFeadDutyResultTable(sahteR(1.3, 1.8));
    expect(html).toMatch(/GEÇTİ/);
    expect(html).not.toMatch(/KALDI/);
  });

  test('min SF servis faktörünün altındaysa KALDI', () => {
    const html = fead.veFeadDutyResultTable(sahteR(1.3, 1.15));
    expect(html).toMatch(/KALDI/);
  });

  // Eşik ARTIK SABİT DEĞİL: 1.5 isteyen kullanıcıda 1.4 kalmalı, 1.2 isteyende
  // aynı 1.4 geçmeli. Sabit 1.3 olsaydı ikisi de aynı sonucu verirdi.
  test('eşik kullanıcının girdiği servis faktörü — sabit 1.3 DEĞİL', () => {
    expect(fead.veFeadDutyResultTable(sahteR(1.5, 1.4))).toMatch(/KALDI/);
    expect(fead.veFeadDutyResultTable(sahteR(1.2, 1.4))).toMatch(/GEÇTİ/);
  });

  test('servis faktörü girilmemişse hüküm satırı HİÇ çıkmaz (uydurma eşik yok)', () => {
    const html = fead.veFeadDutyResultTable(sahteR(0, 1.1));
    expect(html).not.toMatch(/GEÇTİ|KALDI/);
    expect(html).not.toMatch(/Servis faktörü/);
  });
});

// ════════════════════════════════════════════════════════════════════════════
//  KANVAS KARTI — CANLI KAYIŞ YOLU ŞEMASI
// ════════════════════════════════════════════════════════════════════════════
// Bu kartın değeri "HTML üretiyor mu" değil: kullanıcı girdileri değiştirdikçe
// modelinin tutarlı olup olmadığını PANEL AÇMADAN görebilmesi. Yani test edilen
// şey (a) çizimin kanvas düğümünün içine girmesi, (b) girdi değişince yeniden
// çizilmesi, (c) çözülemeyen modelde SEBEBİN yazılması, (d) sarım değişmezi
// tutmuyorsa şeridin kırmızıya dönmesi.
describe('Kayış Yolu kanvas kartı', () => {
  const el = (node) => {
    const d = document.createElement('div');
    d.className = 've-node';
    d.id = node.id;
    d.innerHTML = '<div class="ve-node-box"><svg><circle/></svg></div>';
    return d;
  };
  // PDF sistemine benzer, çözülebilir küçük bir model (dört kasnak).
  const kurCozulur = () => {
    const crk = kasnak('fead-crank', { od: 160, x: 0, y: 0, driver: true }, 'CRK');
    const idr = kasnak('fead-idler', { od: 75, x: -72, y: 267 }, 'IDR');
    const ac = kasnak('fead-ac', { od: 127, x: -224, y: 448 }, 'A_C');
    const ten = kasnak('fead-tensioner', {
      od: 75, pivotX: -180, pivotY: 100, armLen: 90,
      preload: 8.59, kArm: 0.482, freeAngleDeg: 42, sense: 1
    }, 'TEN');
    const belt = kasnak('fead-belt', { profile: 'PK', brand: 'GATES', ribs: 8, effLength: 1475, tolerance: 6 });
    const sv = kasnak('fead-solver', { designTensionN: 765.7, driveRatio: 1, lengthOffsetMm: 3.5 });
    const lay = kasnak('fead-layout', {});
    global.nodes = [crk, idr, ac, ten, belt, sv, lay];
    global.connections = [[crk, idr], [idr, ac], [ac, ten], [ten, crk]]
      .map(([a, b]) => ({ id: 'c' + a.id + b.id, from: a.id, to: b.id, fromPort: 'output', toPort: 'input' }));
    return { lay, crk, ten };
  };

  test('kart kanvas düğümünün kutusuna girer, sembolü gizler', () => {
    const { lay } = kurCozulur();
    const e = el(lay);
    expect(fead.veFeadApplyLayoutCard(e, lay)).toBe(true);
    const card = e.querySelector('.' + fead.VE_FEAD_CARD_CLASS);
    expect(card).not.toBeNull();
    expect(card.querySelector('svg')).not.toBeNull();
    // Düğümün palet sembolü kartın arkasında kalmasın
    expect(e.querySelector('.ve-node-box > svg').style.display).toBe('none');
  });

  test('kasnak olmayan / şema olmayan düğüme kart konmaz', () => {
    const { crk } = kurCozulur();
    expect(fead.veFeadApplyLayoutCard(el(crk), crk)).toBe(false);
  });

  test('iki kez çağrılınca kart ÇOĞALMAZ, içi tazelenir', () => {
    const { lay } = kurCozulur();
    const e = el(lay);
    fead.veFeadApplyLayoutCard(e, lay);
    fead.veFeadApplyLayoutCard(e, lay);
    expect(e.querySelectorAll('.' + fead.VE_FEAD_CARD_CLASS)).toHaveLength(1);
  });

  // ASIL KAPI: girdi değişince çizim değişmeli. Değişmezse kart eski
  // geometriyi göstermeye devam eder ve "tutarlı" yalanı söyler.
  test('girdi değişince şema YENİDEN çizilir', () => {
    const { lay, crk } = kurCozulur();
    const once = fead.veFeadLayoutCardHTML(lay);
    crk.data.od = 162;                       // krank çapı büyüdü (çözüm korunur)
    const sonra = fead.veFeadLayoutCardHTML(lay);
    expect(sonra).not.toBe(once);
    expect(once).toMatch(/data-ve="belt"/);
    expect(sonra).toMatch(/data-ve="belt"/);
  });

  // ROZETİN ORTAĞI. Temas tarafı ters verilirse çekirdek bazen GEÇERLİ ama
  // başka bir yol çözer (rozetin varlık nedeni), bazen de çevrim hiç kapanmaz.
  // İkinci durumda kart sebebi yazıyor — kullanıcı "çizim gitti" değil "kayış
  // yolu kapanmıyor, temas tarafına bak" mesajını görüyor.
  test('temas tarafı ters verilince kart ÇEVRİMİN KAPANMADIĞINI söyler', () => {
    const { lay, crk } = kurCozulur();
    expect(fead.veFeadLayoutCardHTML(lay)).toMatch(/data-ve="belt"/);
    crk.data.contact = 'back';
    const html = fead.veFeadLayoutCardHTML(lay);
    expect(html).not.toMatch(/data-ve="belt"/);
    expect(html).toMatch(/Şema çizilemiyor/);
    expect(html).toMatch(/temas tarafı|kapanmıyor/i);
  });

  test('çözülemeyen modelde SEBEP yazılır — boş kutu değil', () => {
    const { lay, ten } = kurCozulur();
    delete ten.data.pivotX;                  // pivot eksik
    const html = fead.veFeadLayoutCardHTML(lay);
    expect(html).toMatch(/Şema çizilemiyor/);
    expect(html).toMatch(/pivot/i);
    expect(html).not.toMatch(/data-ve="belt"/);
  });

  test('çözülen modelde durum şeridi YEŞİL ve kasnak sayısı + boy yazılı', () => {
    const { lay } = kurCozulur();
    const html = fead.veFeadLayoutCardHTML(lay);
    expect(html).toMatch(/accent-success/);
    expect(html).toMatch(/4 kasnak/);
    expect(html).toMatch(/Σsarım/);
    expect(html).toMatch(/✓/);
  });

  test('boş topolojide patlamaz, kırmızı şeritle çıkar', () => {
    global.nodes = []; global.connections = [];
    const lay = kasnak('fead-layout', {});
    const html = fead.veFeadLayoutCardHTML(lay);
    expect(typeof html).toBe('string');
    expect(html).toMatch(/accent-danger/);
    expect(html).toMatch(/✗/);
  });

  test('veFeadRefreshLayoutCards tuvaldeki TÜM şema düğümlerini tazeler', () => {
    const { lay } = kurCozulur();
    const lay2 = kasnak('fead-layout', {});
    global.nodes.push(lay2);
    const canvas = document.getElementById('ve-canvas');
    canvas.innerHTML = '';
    [lay, lay2].forEach((n) => canvas.appendChild(el(n)));
    expect(fead.veFeadRefreshLayoutCards()).toBe(2);
    expect(document.querySelectorAll('.' + fead.VE_FEAD_CARD_CLASS)).toHaveLength(2);
    canvas.innerHTML = '';
  });
});

// ── Şemanın işaretleri: pivot artısı, kol, dönüş oku, yön gülü ──────────────
// Bunlar süs değil: pivot artısı yanlış girilmiş bir pivotu (kol kayışa ters
// uzanır) gözle yakalatıyor, yön gülü "montaj açısı −3.18°" gibi bir sayının
// hangi yöne baktığını okutuyor, dönüş oku sırttan temas eden kasnağın ters
// döndüğünü gösteriyor.
describe('şema işaretleri', () => {
  const kurCozulur = () => {
    const crk = kasnak('fead-crank', { od: 160, x: 0, y: 0, driver: true }, 'CRK');
    const idr = kasnak('fead-idler', { od: 75, x: -72, y: 267 }, 'IDR');
    const ac = kasnak('fead-ac', { od: 127, x: -224, y: 448 }, 'A_C');
    const ten = kasnak('fead-tensioner', {
      od: 75, pivotX: -180, pivotY: 100, armLen: 90,
      preload: 8.59, kArm: 0.482, freeAngleDeg: 42, sense: 1
    }, 'TEN');
    const belt = kasnak('fead-belt', { profile: 'PK', brand: 'GATES', ribs: 8, effLength: 1475, tolerance: 6 });
    const sv = kasnak('fead-solver', { designTensionN: 765.7, driveRatio: 1, lengthOffsetMm: 3.5 });
    global.nodes = [crk, idr, ac, ten, belt, sv];
    global.connections = [[crk, idr], [idr, ac], [ac, ten], [ten, crk]]
      .map(([a, b]) => ({ id: 'c' + a.id + b.id, from: a.id, to: b.id, fromPort: 'output', toPort: 'input' }));
    return veFeadBuildFromCanvas();
  };

  test('varsayılanda dördü de çizilir', () => {
    const svg = fead.veFeadLayoutSVG(kurCozulur(), 420, 340);
    expect(svg).toMatch(/data-ve="pivot"/);
    expect(svg).toMatch(/data-ve="arm"/);
    expect(svg).toMatch(/data-ve="compass"/);
    expect(svg).toMatch(/data-ve="spin"/);
    expect(svg).toMatch(/>0</);                 // yön gülü etiketleri
    expect(svg).toMatch(/>90</);
    expect(svg).toMatch(/>270</);
  });

  test('kapatılabilirler (opts)', () => {
    const b = kurCozulur();
    const svg = fead.veFeadLayoutSVG(b, 420, 340,
      { compass: false, pivot: false, arrows: false });
    expect(svg).not.toMatch(/data-ve="compass"/);
    expect(svg).not.toMatch(/data-ve="pivot"/);
    expect(svg).not.toMatch(/data-ve="spin"/);
    expect(svg).toMatch(/data-ve="belt"/);      // kayış yolu her hâlde çizilir
  });

  test('her kasnak için bir daire ve bir dönüş oku', () => {
    const b = kurCozulur();
    const svg = fead.veFeadLayoutSVG(b, 420, 340);
    expect((svg.match(/data-ve="pulley"/g) || []).length).toBe(4);
    expect((svg.match(/data-ve="spin"/g) || []).length).toBeGreaterThan(0);
  });

  test('gerçek modelde pivot artısı çerçevenin İÇİNDE', () => {
    const svg = fead.veFeadLayoutSVG(kurCozulur(), 420, 340);
    const g = /data-ve="pivot"[^>]*><line x1="([-\d.]+)" y1="([-\d.]+)"/.exec(svg);
    expect(g).not.toBeNull();
    const [x, y] = [parseFloat(g[1]), parseFloat(g[2])];
    expect(x).toBeGreaterThanOrEqual(0);
    expect(x).toBeLessThanOrEqual(420);
    expect(y).toBeGreaterThanOrEqual(0);
    expect(y).toBeLessThanOrEqual(340);
  });

  // PİVOTUN ÖLÇEĞE GİRMESİ — doğrudan çizim fonksiyonuna karşı ölçülüyor.
  // Neden böyle: doğrulanmış iki sistemde (Gates AG00686 ve BMC) pivot,
  // kasnak zarfının İÇİNDE kalıyor — yani gerçek veriyle bu koruma tetiklenmiyor
  // ve onu "uzak pivot gir" diye test etmek mümkün değil (uzak pivotta kayış
  // yolu hiç kapanmıyor, ölçüldü). O yüzden çizicinin sözleşmesi tek başına
  // sınanıyor: verilen geometri + pivot → çerçeveye SIĞAN SVG.
  test('pivot kasnak zarfının DIŞINDAysa ölçek onu da kapsar', () => {
    const gercek = FEADCore.tensionerState, gercekMean = FEADCore.meanRel;
    const sahteGeom = {
      pulleys: [
        { c: [0, 0],  rPitch: 20, contact: 'grooved', d: +1 },
        { c: [60, 0], rPitch: 20, contact: 'back',    d: -1 }
      ],
      spans: [{ Pi: [0, 20], Pj: [60, 20] }, { Pi: [60, -20], Pj: [0, -20] }],
      wraps: [Math.PI, Math.PI],
      names: ['P0', 'TEN'],
      wrapDeg: () => 180,
      LeffMm: 200
    };
    // meanRel de sahte: çizici tensionerState'i meanRel(sys) ile çağırıyor ve
    // gerçek meanRel bu iskelet sys üzerinde çalışamaz.
    FEADCore.meanRel = () => 0;
    FEADCore.tensionerState = () => ({ geom: sahteGeom });
    try {
      const b = {
        ok: true, order: [{ type: 'fead-crank' }, { type: 'fead-tensioner' }],
        sys: {
          pulleys: [{ crank: true, contact: 'grooved' }, { tensioner: true, contact: 'back' }],
          _tenIdx: 1,
          tensioner: { pivot: [-600, 0] }        // kasnaklardan ÇOK uzakta
        }
      };
      const ile = fead.veFeadLayoutSVG(b, 420, 340);
      const g = /data-ve="pivot"[^>]*><line x1="([-\d.]+)"/.exec(ile);
      expect(g).not.toBeNull();
      const x = parseFloat(g[1]);
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThanOrEqual(420);

      // Ve pivot ölçeğe girdiği için kasnaklar KÜÇÜLMÜŞ olmalı — pivot yok
      // sayılsaydı aynı kasnaklar daha büyük çizilirdi.
      const rIle = parseFloat(/data-ve="pulley" cx="[-\d.]+" cy="[-\d.]+" r="([-\d.]+)"/.exec(ile)[1]);
      const haric = fead.veFeadLayoutSVG(b, 420, 340, { pivot: false });
      const rHaric = parseFloat(/data-ve="pulley" cx="[-\d.]+" cy="[-\d.]+" r="([-\d.]+)"/.exec(haric)[1]);
      expect(rIle).toBeLessThan(rHaric);
    } finally {
      FEADCore.tensionerState = gercek;
      FEADCore.meanRel = gercekMean;
    }
  });

  test('inline kipte dış çerçeve/arkaplan yok (kanvas kartı için)', () => {
    const b = kurCozulur();
    const kart = fead.veFeadLayoutSVG(b, 420, 320, { inline: true });
    const panel = fead.veFeadLayoutSVG(b, 320, 240);
    expect(kart).toMatch(/height:100%/);
    expect(kart).not.toMatch(/border:1px solid/);
    expect(panel).toMatch(/border:1px solid/);
  });
});

describe('Kayış Yolu düğümünün ölçüsü — tek kaynak', () => {
  test('componentDefs ölçüyü VE_FEAD_LAYOUT_W/H sabitlerinden alır', () => {
    expect(componentDefs['fead-layout'].defaultWidth).toBe(VE_FEAD_LAYOUT_W);
    expect(componentDefs['fead-layout'].defaultHeight).toBe(VE_FEAD_LAYOUT_H);
    // Şema okunabilir olmak zorunda: küçük kutu bu kartı taşımıyor
    expect(VE_FEAD_LAYOUT_W).toBeGreaterThan(300);
    expect(VE_FEAD_LAYOUT_H).toBeGreaterThan(240);
  });

  test('eski 60×56 kayıt kart ölçüsüne YÜKSELİR', () => {
    const n = { type: 'fead-layout', width: VE_FEAD_LAYOUT_LEGACY_W, height: VE_FEAD_LAYOUT_LEGACY_H };
    expect(veFeadNormalizeLayoutSize(n)).toBe(true);
    expect(n.width).toBe(VE_FEAD_LAYOUT_W);
    expect(n.height).toBe(VE_FEAD_LAYOUT_H);
  });

  test('kullanıcının bilerek verdiği ölçü KORUNUR', () => {
    const n = { type: 'fead-layout', width: 640, height: 500 };
    expect(veFeadNormalizeLayoutSize(n)).toBe(false);
    expect(n.width).toBe(640);
  });

  test('başka tipe dokunmaz', () => {
    const n = { type: 'fead-crank', width: VE_FEAD_LAYOUT_LEGACY_W, height: VE_FEAD_LAYOUT_LEGACY_H };
    expect(veFeadNormalizeLayoutSize(n)).toBe(false);
  });
});

// ════════════════════════════════════════════════════════════════════════════
//  SARIM YAYLARI KASNAĞIN ÜZERİNDE Mİ — bükülmüş kayışa karşı DEĞİŞMEZ
// ════════════════════════════════════════════════════════════════════════════
// Bu testin varlık nedeni ölçülmüş bir kusur: sweep bayrağı ters yazılmıştı.
// Yarıçap ve teğet uçları DOĞRU olduğu için yay yine iki uca değiyordu, ama
// AYNALANMIŞ çemberin üzerinde kalıyor — yani kasnağın İÇİNDEN geçiyordu.
// Gözle "kaymış, bükülmüş" görünüyordu; eski testler ise yay SAYISINA baktığı
// için yeşil kalmıştı.
//
// Değişmez: yayın örtük merkezi, o kasnağın merkezidir. SVG uç→merkez
// dönüşümüyle ölçülür (spec: F.6.5), yani çizimin kendi sayılarından.
describe('kayış yayları kasnakların ÜZERİNDE (bükülme kapısı)', () => {
  const kurCozulur = () => {
    const crk = kasnak('fead-crank', { od: 160, x: 0, y: 0, driver: true }, 'CRK');
    const idr = kasnak('fead-idler', { od: 75, x: -72, y: 267 }, 'IDR');
    const ac = kasnak('fead-ac', { od: 127, x: -224, y: 448 }, 'A_C');
    const ten = kasnak('fead-tensioner', {
      od: 75, pivotX: -180, pivotY: 100, armLen: 90,
      preload: 8.59, kArm: 0.482, freeAngleDeg: 42, sense: 1
    }, 'TEN');
    const belt = kasnak('fead-belt', { profile: 'PK', brand: 'GATES', ribs: 8, effLength: 1475, tolerance: 6 });
    const sv = kasnak('fead-solver', { designTensionN: 765.7, driveRatio: 1, lengthOffsetMm: 3.5 });
    global.nodes = [crk, idr, ac, ten, belt, sv];
    global.connections = [[crk, idr], [idr, ac], [ac, ten], [ten, crk]]
      .map(([a, b]) => ({ id: 'c' + a.id + b.id, from: a.id, to: b.id, fromPort: 'output', toPort: 'input' }));
    return veFeadBuildFromCanvas();
  };

  // SVG yay parametrelerinden örtük merkez (W3C SVG 1.1 F.6.5.2/3).
  const yayMerkezi = ({ p0, p1, r, fA, fS }) => {
    const [x1, y1] = p0, [x2, y2] = p1;
    const dx2 = (x1 - x2) / 2, dy2 = (y1 - y2) / 2;
    const num = r * r * r * r - r * r * dy2 * dy2 - r * r * dx2 * dx2;
    const den = r * r * dy2 * dy2 + r * r * dx2 * dx2;
    let co = Math.sqrt(Math.max(0, num / den));
    if (fA === fS) co = -co;
    return [co * r * dy2 / r + (x1 + x2) / 2, -co * r * dx2 / r + (y1 + y2) / 2];
  };

  const yaylariCoz = (svg, secici) => {
    const d = new RegExp('<path data-ve="' + secici + '" d="([^"]+)"').exec(svg)[1];
    const parcalar = d.match(/[MLAZ][^MLAZ]*/g);
    let cur = null; const yaylar = [];
    parcalar.forEach((t) => {
      const k = t[0];
      const v = t.slice(1).trim().split(/[\s,]+/).filter((x) => x !== '').map(Number);
      if (k === 'M' || k === 'L') cur = [v[0], v[1]];
      else if (k === 'A') {
        yaylar.push({ p0: cur.slice(), r: v[0], fA: v[3], fS: v[4], p1: [v[5], v[6]] });
        cur = [v[5], v[6]];
      }
    });
    return yaylar;
  };

  const daireler = (svg) => [...svg.matchAll(
    /data-ve="pulley" cx="([-\d.]+)" cy="([-\d.]+)" r="([-\d.]+)"/g)]
    .map((m) => ({ x: +m[1], y: +m[2], r: +m[3] }));

  test('her yayın merkezi bir kasnağın merkezi (sapma < 0.5 px)', () => {
    const svg = fead.veFeadLayoutSVG(kurCozulur(), 420, 320);
    const yaylar = yaylariCoz(svg, 'belt');
    const cs = daireler(svg);
    expect(yaylar).toHaveLength(4);
    expect(cs).toHaveLength(4);
    yaylar.forEach((a) => {
      const [cx, cy] = yayMerkezi(a);
      const enYakin = Math.min(...cs.map((c) => Math.hypot(c.x - cx, c.y - cy)));
      // 0.5 px: path sayıları 2 basamağa yuvarlanıyor (f()), gerçek sapma ~0.01.
      expect(enYakin).toBeLessThan(0.5);
    });
  });

  test('yay yarıçapı kasnak yarıçapıyla AYNI', () => {
    const svg = fead.veFeadLayoutSVG(kurCozulur(), 420, 320);
    const cs = daireler(svg);
    yaylariCoz(svg, 'belt').forEach((a) => {
      const [cx, cy] = yayMerkezi(a);
      let en = null, bd = Infinity;
      cs.forEach((c) => { const d = Math.hypot(c.x - cx, c.y - cy); if (d < bd) { bd = d; en = c; } });
      expect(Math.abs(a.r - en.r)).toBeLessThan(0.5);
    });
  });

  // Sweep bayrağı TERS olsaydı yay aynalanmış çemberde kalırdı: aşağıdaki
  // ölçüm o hâlde 6.7–42.7 px sapma veriyordu. Kuralı doğrudan kilitliyoruz.
  test('sweep kuralı: d > 0 → 0, d < 0 → 1', () => {
    const build = kurCozulur();
    const svg = fead.veFeadLayoutSVG(build, 420, 320);
    const yaylar = yaylariCoz(svg, 'belt');
    const geom = F.tensionerState(build.sys, F.meanRel(build.sys)).geom;
    // Yaylar kayış sırasında: i. yay (i+1). kasnağın etrafında.
    yaylar.forEach((a, i) => {
      const p = geom.pulleys[(i + 1) % geom.pulleys.length];
      expect(a.fS).toBe(p.d > 0 ? 0 : 1);
    });
  });

  test('hayalet konumların yayları da kasnakların üzerinde', () => {
    const build = kurCozulur();
    const svg = fead.veFeadLayoutSVG(build, 420, 320, { posMode: 'all' });
    expect(svg).toMatch(/data-ve="belt-ghost"/);
    const hepsi = [...svg.matchAll(/<path data-ve="belt-ghost" d="([^"]+)"/g)];
    expect(hepsi.length).toBeGreaterThan(0);
    hepsi.forEach((m) => {
      const parcalar = m[1].match(/[MLAZ][^MLAZ]*/g);
      let cur = null; let sayi = 0;
      parcalar.forEach((t) => {
        const k = t[0];
        const v = t.slice(1).trim().split(/[\s,]+/).filter((x) => x !== '').map(Number);
        if (k === 'M' || k === 'L') cur = [v[0], v[1]];
        else if (k === 'A') {
          // Yayın merkezi ile uçlarının uzaklığı = yarıçap olmak zorunda.
          const [cx, cy] = yayMerkezi({ p0: cur.slice(), r: v[0], fA: v[3], fS: v[4], p1: [v[5], v[6]] });
          expect(Math.abs(Math.hypot(cur[0] - cx, cur[1] - cy) - v[0])).toBeLessThan(0.5);
          expect(Math.abs(Math.hypot(v[5] - cx, v[6] - cy) - v[0])).toBeLessThan(0.5);
          cur = [v[5], v[6]]; sayi++;
        }
      });
      expect(sayi).toBe(4);
    });
  });

  test('dönüş oku kasnağın GERÇEK yönünü gösterir (d < 0 → ekranda saat yönü)', () => {
    const build = kurCozulur();
    const svg = fead.veFeadLayoutSVG(build, 420, 320);
    const geom = F.tensionerState(build.sys, F.meanRel(build.sys)).geom;
    const oklar = [...svg.matchAll(/data-ve="spin" d="M[-\d. ]+A[\d. ]+0 1 (\d)/g)].map((m) => +m[1]);
    expect(oklar.length).toBeGreaterThan(0);
    // Yalnız R > 9 olan kasnaklarda ok çiziliyor; işaretlerin TAMAMI aynı
    // kuraldan gelmeli: ekran saat yönü (sweep 1) ⇔ d < 0.
    const beklenen = geom.pulleys.filter((p, k) => {
      const svgR = daireler(svg)[k];
      return svgR && svgR.r > 9;
    }).map((p) => (p.d < 0 ? 1 : 0));
    expect(oklar.sort()).toEqual(beklenen.sort());
  });
});

// ════════════════════════════════════════════════════════════════════════════
//  GERGİ KOL KONUMU SEÇİCİSİ
// ════════════════════════════════════════════════════════════════════════════
describe('kol konumu seçimi', () => {
  const kur = (beltData) => {
    const crk = kasnak('fead-crank', { od: 160, x: 0, y: 0, driver: true }, 'CRK');
    const idr = kasnak('fead-idler', { od: 75, x: -72, y: 267 }, 'IDR');
    const ac = kasnak('fead-ac', { od: 127, x: -224, y: 448 }, 'A_C');
    const ten = kasnak('fead-tensioner', {
      od: 75, pivotX: -180, pivotY: 100, armLen: 90,
      preload: 8.59, kArm: 0.482, freeAngleDeg: 42, sense: 1
    }, 'TEN');
    const belt = kasnak('fead-belt', Object.assign(
      { profile: 'PK', brand: 'GATES', ribs: 8, effLength: 1475, tolerance: 6 }, beltData || {}));
    const sv = kasnak('fead-solver', { designTensionN: 765.7, driveRatio: 1, lengthOffsetMm: 3.5 });
    const lay = kasnak('fead-layout', {});
    global.nodes = [crk, idr, ac, ten, belt, sv, lay];
    global.connections = [[crk, idr], [idr, ac], [ac, ten], [ten, crk]]
      .map(([a, b]) => ({ id: 'c' + a.id + b.id, from: a.id, to: b.id, fromPort: 'output', toPort: 'input' }));
    return { lay, build: veFeadBuildFromCanvas() };
  };

  test('varsayılan ÇALIŞMA konumu', () => {
    expect(veFeadPosMode({ data: {} })).toBe('mean');
    expect(veFeadPosMode({ data: { posMode: 'saçma' } })).toBe('mean');
    expect(veFeadPosMode({ data: { posMode: 'free' } })).toBe('free');
    expect(veFeadPosMode({ data: { posMode: 'all' } })).toBe('all');
  });

  test('konum tablosu kol açılarını sıralı verir', () => {
    const { build } = kur();
    const rows = veFeadPositionRows(build);
    const cozulen = rows.filter((r) => r.ok);
    expect(cozulen.length).toBeGreaterThan(2);
    // Serbest kol her zaman 0°; kayış kısaldıkça kol açısı BÜYÜR.
    expect(cozulen.filter((r) => r.key === 'free')[0].relDeg).toBeCloseTo(0, 6);
    const mean = cozulen.filter((r) => r.key === 'mean')[0];
    const min = cozulen.filter((r) => r.key === 'min')[0];
    const max = cozulen.filter((r) => r.key === 'max')[0];
    expect(max.relDeg).toBeLessThan(mean.relDeg);
    expect(min.relDeg).toBeGreaterThan(mean.relDeg);
  });

  test('TÜMÜ kipinde hayalet konumlar çıkar', () => {
    const { build } = kur();
    const sel = veFeadPosSelection(build, 'all');
    expect(sel.primary.key).toBe('mean');
    expect(sel.ghosts.length).toBeGreaterThan(1);
    const svg = fead.veFeadLayoutSVG(build, 420, 320, { posMode: 'all' });
    expect((svg.match(/data-ve="belt-ghost"/g) || []).length).toBe(sel.ghosts.length);
    expect((svg.match(/data-ve="pulley-ghost"/g) || []).length).toBe(sel.ghosts.length);
  });

  // TOLERANS 0 → dört orta konum AYNI açıya oturuyor. Üst üste çizilseydi dört
  // özdeş eğri binerdi ve çizim hatası gibi görünürdü.
  test('tolerans 0 ise özdeş konumlar TEKİLLEŞİR ve sebep yazılır', () => {
    const { build } = kur({ tolerance: 0, wearPct: 0 });
    const sel = veFeadPosSelection(build, 'all');
    // Serbest kol ayrı bir açı; Replace/Max/Mean/Min aynı → tek hayalet kalır.
    expect(sel.ghosts.length).toBe(1);
    expect(sel.ghosts[0].key).toBe('free');
  });

  test('tek konum kipinde hayalet YOK', () => {
    const { build } = kur();
    ['mean', 'free', 'min', 'max'].forEach((m) => {
      expect(veFeadPosSelection(build, m).ghosts).toHaveLength(0);
      expect(veFeadPosSelection(build, m).primary.key).toBe(m);
    });
  });

  // Load stop girilmemişse listede yok; seçiliyse şema BOŞ KALMAZ, Mean'e düşer
  // ve sebep note'a yazılır.
  test('çözülemeyen konum seçilirse çalışma konumuna düşer + sebep', () => {
    const { build } = kur();
    const sel = veFeadPosSelection(build, 'load');
    expect(sel.primary.key).toBe('mean');
    expect(sel.note).toMatch(/Load stop|çözülemedi/i);
  });

  test('seçilen konum ŞEMAYI değiştirir', () => {
    const { build } = kur();
    const a = fead.veFeadLayoutSVG(build, 420, 320, { posMode: 'mean' });
    const b = fead.veFeadLayoutSVG(build, 420, 320, { posMode: 'min' });
    expect(a).not.toBe(b);
    // Konum künyesi şemanın içinde yazılı
    expect(a).toMatch(/data-ve="pos-label"/);
    expect(a).toMatch(/Çalışma/);
    expect(b).toMatch(/Min\. kayış/);
  });

  test('kartta seçici var ve düğüm sürüklemesini ENGELLER', () => {
    const { lay, build } = kur();
    const h = fead.veFeadPosPicker(lay, build, 'mean');
    expect(h).toMatch(/veFeadSetChoice\('[^']+','posMode'/);
    expect(h).toMatch(/event\.stopPropagation\(\)/);
    // Sürükleme mousedown ile başlıyor; durdurulmazsa listeyi açmak düğümü taşır.
    expect(h).toMatch(/onmousedown="event\.stopPropagation\(\);"/);
    expect(h).toMatch(/TÜMÜ/);
  });

  test('kart seçili konumu çiziyor ve şeridi ona göre yazıyor', () => {
    const { lay } = kur();
    lay.data.posMode = 'min';
    const html = fead.veFeadLayoutCardHTML(lay);
    expect(html).toMatch(/Min\. kayış/);
    expect(html).toMatch(/value="min" selected/);
  });

  test('çözülemeyen modelde seçici patlamaz', () => {
    global.nodes = []; global.connections = [];
    const lay = kasnak('fead-layout', {});
    expect(typeof fead.veFeadPosPicker(lay, veFeadBuildFromCanvas(), 'mean')).toBe('string');
    expect(typeof fead.veFeadLayoutCardHTML(lay)).toBe('string');
  });
});

// ════════════════════════════════════════════════════════════════════════════
//  "OTOMATİK DÜZENLE" FEAD'DE HALKA KURAR
// ════════════════════════════════════════════════════════════════════════════
// Genel yerleştirici (tidy-layout.js) katmanlı bir DAG düzeni kuruyor: kenarlar
// soldan sağa sıralı katmanlara bölünüyor. FEAD ise kapalı bir ÇEVRİM; katmanlama
// onu keyfî bir yerden kırıp dönüş telini bütün kümenin üstünden geçiriyor.
// ÖLÇÜLDÜ (gerçek tarayıcı, BMC örneği, 6 kasnak): kesişen tel çifti 0 → 1 ve
// altı kasnak tek bir yatay sıraya diziliyordu; halka düzeniyle yine 0.
describe('veFeadArrangeRing — kayış çevrimi halka olarak dizilir', () => {
  const kur = (n, ekTip) => {
    const tipler = ['fead-crank', 'fead-alternator', 'fead-idler', 'fead-ac',
                    'fead-waterpump', 'fead-tensioner', 'fead-idler', 'fead-alternator'];
    const ns = [];
    for (let i = 0; i < n; i++) {
      const t = tipler[i % tipler.length];
      const d = componentDefs[t];
      ns.push({ id: 'r' + i, type: t, def: d, x: 0, y: 0,
                width: d.defaultWidth || 65, height: d.defaultHeight || 60,
                data: i === 0 ? { driver: true } : {} });
    }
    (ekTip || []).forEach((t, i) => {
      const d = componentDefs[t];
      ns.push({ id: 'a' + i, type: t, def: d, x: 0, y: 0,
                width: d.defaultWidth || 65, height: d.defaultHeight || 60, data: {} });
    });
    global.nodes = ns;
    global.connections = [];
    for (let i = 0; i < n; i++) {
      global.connections.push({ id: 'c' + i, from: 'r' + i, to: 'r' + ((i + 1) % n),
                                fromPort: 'output', toPort: 'input' });
    }
    return ns;
  };
  const merkez = (nd) => ({ x: nd.x + nd.width / 2, y: nd.y + nd.height / 2 });

  beforeEach(() => {
    document.body.innerHTML = '<div id="ve-canvas"></div>';
    global.updateAllConnections = jest.fn();
  });

  test('kasnaklar ORTAK bir çember üzerinde ve kayış SIRASINDA dizilir', () => {
    const ns = kur(6);
    expect(fead.veFeadArrangeRing()).toBe(true);
    const R = ns.map((n) => Math.hypot(merkez(n).x - 3000, merkez(n).y - 3000));
    // Hepsi aynı yarıçapta (yuvarlama payı)
    R.forEach((r) => expect(r).toBeCloseTo(R[0], 0));
    // Açılar kayış sırasında, SAAT YÖNÜNDE ve eşit aralıklı
    const aci = ns.map((n) => Math.atan2(merkez(n).y - 3000, merkez(n).x - 3000));
    const adim = aci.map((a, i) => {
      let d = a - aci[(i - 1 + 6) % 6];
      while (d <= 0) d += 2 * Math.PI;
      return d;
    });
    adim.forEach((d) => expect(d).toBeCloseTo((2 * Math.PI) / 6, 2));
    // Sürücü TEPEDE başlar (kullanıcı kayışı oradan okumaya başlıyor)
    expect(merkez(ns[0]).y).toBeLessThan(3000);
    expect(merkez(ns[0]).x).toBeCloseTo(3000, 0);
  });

  // Sabit bir yarıçap büyük kutularda onları üst üste bindirirdi: kiriş
  // 2R·sin(π/N) yarıçaptan KÜÇÜK. Yarıçap kutudan TÜRETİLİYOR — aynı halka
  // büyük kutularla kurulunca genişlemek ZORUNDA.
  test('yarıçap kutu ölçüsüne göre büyür (sabit değil)', () => {
    const yaricap = () => Math.hypot(merkez(global.nodes[0]).x - 3000,
                                     merkez(global.nodes[0]).y - 3000);
    kur(6);
    fead.veFeadArrangeRing();
    const kucuk = yaricap();
    const ns = kur(6);
    ns.forEach((n) => { n.width = 180; n.height = 140; });
    fead.veFeadArrangeRing();
    expect(yaricap()).toBeGreaterThan(kucuk * 1.5);
  });

  test('komşu kutular çakışmaz (yarıçap kutu köşegeninden türer)', () => {
    [2, 3, 5, 8].forEach((n) => {
      const ns = kur(n);
      // Kutuları BÜYÜT: 190 px'lik sabit bir yarıçap N=8'de 145 px kiriş verir,
      // 228 px köşegenli kutu oraya sığmaz — sabit yarıçap burada çakışır.
      ns.forEach((nd) => { nd.width = 180; nd.height = 140; });
      fead.veFeadArrangeRing();
      const kasnak = ns.slice(0, n);
      for (let i = 0; i < n; i++) {
        const a = kasnak[i], b = kasnak[(i + 1) % n];
        if (n === 2 && i === 1) continue;                 // aynı çift
        const kose = Math.max(Math.hypot(a.width, a.height), Math.hypot(b.width, b.height));
        expect(Math.hypot(merkez(a).x - merkez(b).x, merkez(a).y - merkez(b).y))
          .toBeGreaterThanOrEqual(kose);
      }
    });
  });

  // Araç düğümleri halkanın İÇİNE düşerse teller kutuların arkasından geçer —
  // veFeadLoadExample'ın çözdüğü sorunun aynısı (ölçüldü: "Başlangıç ve
  // Örnekler" kutusu tam Klima ↔ Avara 1 açıklığının üstüne oturuyordu).
  test('araç düğümleri halkanın DIŞINDA; Kayış Yolu kartı sağ şeritte', () => {
    const ns = kur(4, ['fead-belt', 'fead-solver', 'fead-layout']);
    fead.veFeadArrangeRing();
    const R = Math.hypot(merkez(ns[0]).x - 3000, merkez(ns[0]).y - 3000);
    const belt = ns.find((n) => n.type === 'fead-belt');
    const lay = ns.find((n) => n.type === 'fead-layout');
    expect(merkez(belt).x).toBeLessThan(3000 - R);       // sol şerit
    expect(lay.x).toBeGreaterThan(3000 + R);             // sağ şerit
  });

  test('iki kasnaktan az varsa düzen KURULMAZ (genel yerleştirici çalışsın)', () => {
    kur(1);
    expect(fead.veFeadArrangeRing()).toBe(false);
    global.nodes = []; global.connections = [];
    expect(fead.veFeadArrangeRing()).toBe(false);
  });

  // Bağlantı sırası kullanıcının hangi teli önce çektiğine göre değişir; düzen
  // KAYIŞ sırasını izlemeli, dizideki sırayı değil.
  test('düğüm dizisi karışık olsa da halka kayış sırasını izler', () => {
    const ns = kur(4);
    ns.reverse();                                        // dizi ters, kayış aynı
    global.nodes = ns;
    fead.veFeadArrangeRing();
    const sira = (typeof veFeadRouteOrder === 'function')
      ? veFeadRouteOrder(global.nodes, global.connections) : [];
    const aci = sira.map((n) => Math.atan2(merkez(n).y - 3000, merkez(n).x - 3000));
    for (let i = 1; i < aci.length; i++) {
      let d = aci[i] - aci[i - 1];
      while (d <= 0) d += 2 * Math.PI;
      expect(d).toBeCloseTo((2 * Math.PI) / 4, 2);
    }
  });

  // Kapı: genel yerleştirici FEAD'e HİÇ girmemeli.
  test('veTidyLayout FEAD topolojisinde halka yerleştiricisine devreder', () => {
    const tidy = require('../../js/tidy-layout.js');
    global.veFeadArrangeRing = jest.fn(() => true);
    global._feadIsPulley = M._feadIsPulley;
    kur(4);
    tidy.veTidyLayout();
    expect(global.veFeadArrangeRing).toHaveBeenCalled();
    // FEAD DIŞI topolojide devretmez
    global.veFeadArrangeRing.mockClear();
    global.nodes = [{ id: 'g1', type: 'gearbox', def: {}, x: 0, y: 0, data: {} },
                    { id: 'g2', type: 'gearbox', def: {}, x: 0, y: 0, data: {} }];
    global.connections = [];
    tidy.veTidyLayout();
    expect(global.veFeadArrangeRing).not.toHaveBeenCalled();
    delete global.veFeadArrangeRing;
  });
});

// ════════════════════════════════════════════════════════════════════════════
//  YÖN GÜLÜ TAŞINABİLİR — ve taşınınca ŞERİDİ ŞEMAYA BIRAKIR
// ════════════════════════════════════════════════════════════════════════════
// Gül varsayılan yerinde (sağ alt) dururken şemadan 54 px'lik bir sağ şerit
// ayrılıyor; 420 px'lik kartın SEKİZDE BİRİ yalnız dört sayı için. Kartı
// daraltmak isteyen kullanıcının önündeki asıl engel buydu.
//
// Buradaki testlerin ölçtüğü şey "gül taşınabiliyor mu" değil — asıl kazanç
// ŞERİDİN GERİ ALINMASI, ve o kazanç ancak ÇİZİMİN BÜYÜMESİYLE görülür. Kanca
// kurulup şerit ayrılmaya devam etseydi arayüz "çalışıyor" görünür, kart yine
// daralmazdı.
describe('yön gülünün yeri', () => {
  const kurCozulur = () => {
    const crk = kasnak('fead-crank', { od: 160, x: 0, y: 0, driver: true }, 'CRK');
    const idr = kasnak('fead-idler', { od: 75, x: -72, y: 267 }, 'IDR');
    const ac = kasnak('fead-ac', { od: 127, x: -224, y: 448 }, 'A_C');
    const ten = kasnak('fead-tensioner', {
      od: 75, pivotX: -180, pivotY: 100, armLen: 90,
      preload: 8.59, kArm: 0.482, freeAngleDeg: 42, sense: 1
    }, 'TEN');
    const belt = kasnak('fead-belt', { profile: 'PK', brand: 'GATES', ribs: 8, effLength: 1475, tolerance: 6 });
    const sv = kasnak('fead-solver', { designTensionN: 765.7, driveRatio: 1, lengthOffsetMm: 3.5 });
    const lay = kasnak('fead-layout', {});
    global.nodes = [crk, idr, ac, ten, belt, sv, lay];
    global.connections = [[crk, idr], [idr, ac], [ac, ten], [ten, crk]]
      .map(([a, b]) => ({ id: 'c' + a.id + b.id, from: a.id, to: b.id, fromPort: 'output', toPort: 'input' }));
    return { build: veFeadBuildFromCanvas(), lay };
  };
  // Çizimin ölçeği: en büyük kasnak dairesinin yarıçapı (SVG'nin kendi sayısı).
  const enBuyukR = (svg) => Math.max(...[...svg.matchAll(
    /<circle data-ve="pulley"[^>]*r="([-\d.]+)"/g)].map((m) => +m[1]));

  test('varsayılan yer sağ alt köşe; taşınmış sayılmaz', () => {
    const y = fead.veFeadCompassPlace(420, 298, null);
    expect(y.moved).toBe(false);
    expect(y.cx).toBeCloseTo(420 - fead.VE_FEAD_ROSE_W / 2 - 4, 6);
    expect(y.cy).toBeCloseTo(298 - fead.VE_FEAD_ROSE_W / 2 - 8, 6);
  });

  test('kenetleme: gül hangi kesir verilirse verilsin çerçevenin İÇİNDE kalır', () => {
    const m = fead.VE_FEAD_ROSE_HALF + 2;
    [[-5, -5], [0, 0], [0.5, 0.5], [1, 1], [9, 9]].forEach(([fx, fy]) => {
      const y = fead.veFeadCompassPlace(420, 298, { fx, fy });
      expect(y.moved).toBe(true);
      expect(y.cx).toBeGreaterThanOrEqual(m);
      expect(y.cx).toBeLessThanOrEqual(420 - m);
      expect(y.cy).toBeGreaterThanOrEqual(m);
      expect(y.cy).toBeLessThanOrEqual(298 - m);
    });
  });

  test('gülden de küçük bir kartta merkeze oturur (yarısı dışarıda kalmaz)', () => {
    const y = fead.veFeadCompassPlace(40, 30, { fx: 1, fy: 1 });
    expect(y.cx).toBeCloseTo(20, 6);
    expect(y.cy).toBeCloseTo(15, 6);
  });

  // ASIL KAZANÇ — ve NEREDE ortaya çıktığı.
  //
  // Ölçek s = min(genişlik/spanX, yükseklik/spanY). Kart GENİŞken bağlayıcı
  // olan yükseklik, dolayısıyla 54 px'lik şerit ölçeği hiç kısıtlamıyor:
  // ÖLÇÜLDÜ (BMC, 420×298) kazanç %0.0. Kullanıcı kartı DARALTTIĞI anda
  // bağlayıcı olan genişlik oluyor ve şerit doğrudan çizimden kesiyor:
  //   340×298 → %21.6 · 300×240 → %17.3 · 260×200 → %16.5 · 220×180 → %33.7
  // Bu yüzden test dar kartta ölçüyor: özelliğin varlık sebebi orası.
  // Ölçüm GERÇEK örnekle (BMC, 6 kasnak): kazanç topolojinin en-boy oranına
  // bağlı ve yukarıdaki dört kasnaklı çizim fixture'ı çok uzun, yani her
  // ölçüde yükseklik-bağlı kalıyor — ondan ölçmek özelliği hiç sınamazdı.
  const bmc = () => {
    const pack = veFeadExampleNodes('BMC_FEAD_2026');
    pack.nodes.forEach((n) => { n.def = componentDefs[n.type]; });
    global.nodes = pack.nodes; global.connections = pack.connections;
    return veFeadBuildFromCanvas();
  };

  test('gül taşınınca sağ şerit ŞEMAYA bırakılır — DAR kartta çizim büyür', () => {
    const build = bmc();
    const dar = fead.veFeadLayoutSVG(build, 340, 298, { nodeId: 'lay' });
    const genis = fead.veFeadLayoutSVG(build, 340, 298,
      { nodeId: 'lay', compassPos: { fx: 0.12, fy: 0.12 } });
    expect(enBuyukR(genis) / enBuyukR(dar)).toBeGreaterThan(1.15);   // ölçüldü: %21.6
  });

  test('kart genişken şerit ölçeği kısıtlamıyor (kazanç dar kartta doğuyor)', () => {
    const build = bmc();
    const a = fead.veFeadLayoutSVG(build, 420, 298, { nodeId: 'lay' });
    const b = fead.veFeadLayoutSVG(build, 420, 298,
      { nodeId: 'lay', compassPos: { fx: 0.12, fy: 0.12 } });
    expect(enBuyukR(b)).toBeCloseTo(enBuyukR(a), 2);
  });

  test('gül verilen kesire oturur ve çember data-cx ile aynı noktadadır', () => {
    const { build } = kurCozulur();
    const svg = fead.veFeadLayoutSVG(build, 420, 298,
      { nodeId: 'lay', compassPos: { fx: 0.3, fy: 0.7 } });
    const g = /<g data-ve="compass-group" data-cx="([-\d.]+)" data-cy="([-\d.]+)"/.exec(svg);
    expect(g).not.toBeNull();
    expect(+g[1]).toBeCloseTo(0.3 * 420, 1);
    expect(+g[2]).toBeCloseTo(0.7 * 298, 1);
    const c = /<g data-ve="compass"[^>]*><circle cx="([-\d.]+)" cy="([-\d.]+)"/.exec(svg);
    expect(+c[1]).toBeCloseTo(+g[1], 6);
    expect(+c[2]).toBeCloseTo(+g[2], 6);
  });

  test('taşıma kancası YALNIZ düğüm kimliği verilince kurulur (rapor/dışa aktarma değil)', () => {
    const { build } = kurCozulur();
    const kartta = fead.veFeadLayoutSVG(build, 420, 298, { nodeId: 'lay-7' });
    expect(kartta).toMatch(/veFeadCompassDragStart\(event,'lay-7'\)/);
    expect(kartta).toMatch(/veFeadCompassReset\('lay-7'\)/);
    expect(kartta).toMatch(/cursor:move/);
    expect(kartta).toMatch(/fill="transparent"/);       // tutamak dikdörtgeni
    const raporda = fead.veFeadLayoutSVG(build, 820, 360, { posMode: 'mean' });
    expect(raporda).toMatch(/data-ve="compass"/);       // gül yine çizilir
    expect(raporda).not.toMatch(/veFeadCompassDragStart/);
    expect(raporda).not.toMatch(/cursor:move/);
  });

  test('kart ve panel AYNI alanı okur', () => {
    const { lay } = kurCozulur();
    lay.data.compassPos = { fx: 0.2, fy: 0.8 };
    const kart = fead.veFeadLayoutCardHTML(lay);
    const panel = fead.getFeadLayoutPropertiesHTML(lay);
    [kart, panel].forEach((h) => {
      const g = /<g data-ve="compass-group" data-cx="([-\d.]+)" data-cy="([-\d.]+)"/.exec(h);
      expect(g).not.toBeNull();
      expect(+g[1] / +g[2]).toBeGreaterThan(0);         // ikisi de taşınmış konumda
      expect(h).toMatch(new RegExp('veFeadCompassDragStart\\(event,\'' + lay.id + '\'\\)'));
    });
  });

  // ── SÜRÜKLEME KANCASI ────────────────────────────────────────────────────
  // Gerçek SVG geometrisi jsdom'da yok; kanca da zaten ona bağlı değil —
  // fare noktasını kutu oranından çözüyor (getScreenCTM yedeği). Sahte öge
  // tam olarak kancanın okuduğu şeyleri verir, fazlasını değil.
  const sahteGul = (W, H) => {
    const svg = {
      viewBox: { baseVal: { width: W, height: H } },
      getBoundingClientRect: () => ({ left: 0, top: 0, width: W, height: H })
    };
    const attrs = { 'data-ve': 'compass-group', 'data-cx': String(W - 31), 'data-cy': String(H - 35) };
    const g = {
      ownerSVGElement: svg, setAttribute: jest.fn((k, v) => { attrs[k] = v; }),
      getAttribute: (k) => attrs[k], parentNode: null
    };
    return { svg, g, attrs };
  };
  const fareyle = (g, nodeId, yol) => {
    const kanca = {};
    const ekle = jest.spyOn(document, 'addEventListener')
      .mockImplementation((t, fn) => { kanca[t] = fn; });
    const sil = jest.spyOn(document, 'removeEventListener').mockImplementation(() => {});
    const bas = yol[0];
    fead.veFeadCompassDragStart(
      { currentTarget: g, clientX: bas.x, clientY: bas.y,
        stopPropagation() {}, preventDefault() {} }, nodeId);
    yol.slice(1).forEach((p) => kanca.mousemove && kanca.mousemove({ clientX: p.x, clientY: p.y }));
    if (kanca.mouseup) kanca.mouseup({});
    ekle.mockRestore(); sil.mockRestore();
  };

  test('HAREKETSİZ tık hiçbir şey yazmaz (çift tık öğeyi kaybetmesin)', () => {
    const { lay } = kurCozulur();
    const { g } = sahteGul(420, 298);
    stubs.saveState.mockClear();
    fareyle(g, lay.id, [{ x: 389, y: 263 }, { x: 389.4, y: 263.6 }]);
    expect(lay.data.compassPos).toBeUndefined();
    expect(stubs.saveState).not.toHaveBeenCalled();
  });

  test('sürükleme konumu KESİR olarak yazar ve kenetler', () => {
    const { lay } = kurCozulur();
    const { g } = sahteGul(420, 298);
    fareyle(g, lay.id, [{ x: 389, y: 263 }, { x: 200, y: 150 }, { x: 120, y: 100 }]);
    expect(lay.data.compassPos).toBeDefined();
    // 389 → 120, yani −269 px; başlangıç merkezi 389 → 120 (kenetlemenin içinde)
    expect(lay.data.compassPos.fx).toBeCloseTo(120 / 420, 3);
    expect(lay.data.compassPos.fy).toBeCloseTo(100 / 298, 3);
    expect(stubs.saveState).toHaveBeenCalled();

    // Çerçevenin dışına sürüklemek gülü dışarı taşımaz
    fareyle(g, lay.id, [{ x: 389, y: 263 }, { x: -900, y: -900 }]);
    const m = fead.VE_FEAD_ROSE_HALF + 2;
    expect(lay.data.compassPos.fx * 420).toBeCloseTo(m, 1);
    expect(lay.data.compassPos.fy * 298).toBeCloseTo(m, 1);
  });

  test('çift tık sıfırlar: alan SİLİNİR, sabit varsayılan yazılmaz', () => {
    const { lay } = kurCozulur();
    expect(fead.veFeadCompassReset(lay.id)).toBe(false);   // zaten varsayılanda
    lay.data.compassPos = { fx: 0.2, fy: 0.8 };
    expect(fead.veFeadCompassReset(lay.id)).toBe(true);
    expect(lay.data.compassPos).toBeUndefined();
    expect(fead.veFeadLayoutCardHTML(lay)).toMatch(/data-ve="compass-group"/);
  });
});
