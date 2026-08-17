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
    // Dört kasnak → dört teğet + dört sarım yayı. Sayım KAYIŞ YOLUNUN kendi
    // path'inde yapılır (data-ve="belt"): dönüş okları ve yön gülü de yay
    // çiziyor, SVG'nin tamamında "A" saymak onları da toplardı.
    const belt = /<path data-ve="belt" d="([^"]+)"/.exec(svg);
    expect(belt).not.toBeNull();
    expect((belt[1].match(/ A/g) || []).length).toBe(4);
    expect((belt[1].match(/ L/g) || []).length).toBe(4);
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
