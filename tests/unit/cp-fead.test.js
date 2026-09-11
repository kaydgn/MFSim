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
// components.js'teki yüklem GLOBAL'e yazılır: cp-fead.js / state.js require ile
// yükleniyor, dolayısıyla çıplak `veIsCanvasHidden` referansı bu dosyanın
// kapsamını DEĞİL global'i arar. Yazılmazsa kutusuz düğüm kapısı sessizce
// atlanır ve testler kutuların hâlâ kurulduğu bir dünyayı ölçer.
global.veIsCanvasHidden = veIsCanvasHidden;
eval(loadSource('fead-belts.js'));
eval(loadSource('fead-duty.js'));
// GLOBAL'E YAZILMASI ŞART: cp-fead.js `require` ile yükleniyor, dolayısıyla
// çıplak `veFeadDutyRowsOf` referansı bu dosyanın kapsamını DEĞİL global'i
// arar. Yazılmazsa tohum sessizce false döner ve kapı "doğru sebepten değil,
// kütüphane hiç görünmediği için" kırmızı olurdu.
[VE_FEAD_DUTY_DEFAULT, VE_FEAD_DUTY_DEGC].forEach(() => {});
global.VE_FEAD_DUTY_DEFAULT = VE_FEAD_DUTY_DEFAULT;
global.VE_FEAD_DUTY_DEGC = VE_FEAD_DUTY_DEGC;
global.VE_FEAD_DUTY_DB = VE_FEAD_DUTY_DB;
global.veFeadDutyList = veFeadDutyList;
global.veFeadDutyOf = veFeadDutyOf;
global.veFeadDutyLabel = veFeadDutyLabel;
global.veFeadDutyRowsOf = veFeadDutyRowsOf;
global.veFeadDutyMatch = veFeadDutyMatch;
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

// EKRAN X İŞARETİ — kanvas kutularının mm ile ilişkisi çizim düzleminden okunur.
// Ön görünüşte (varsayılan, 2026-09-07 krank CW konvansiyonu) kanvas da X'te
// aynalanıyor; bu dosyanın ölçtüğü şey işaretin KENDİSİ değil "kutu, mm'sinin
// gösterdiği yerde mi".
// ÇİZİM AYNALANMAZ — X işareti sabit (bkz. fead-model.js, "TEK ÇERÇEVE VAR").
const SX = () => 1;

describe('Alt-sistem sözleşmesi', () => {
  test('modül paneli "Alt Topolojiyi Aç" kancasını düğümün id\'siyle kurar', () => {
    const html = fead.getFeadModulePropertiesHTML({ id: 'comp-3', type: 'fead-analysis', data: {} });
    expect(html).toContain("veFeadOpenEditor('comp-3')");
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

  test('başlangıç yerleşimi TANIMLI tiplerden kurulu; örnek bileşeni YOK', () => {
    const tipler = fead.VE_FEAD_STARTER_LAYOUT.map((it) => it.type);
    // "Başlangıç ve Örnekler" 2026-09-09'da kaldırıldı (kullanıcı: *"Gerek
    // yok"*) — sunduğu liste sihirbazın 1. adımında zaten vardı. Negatif kapı
    // duruyor çünkü yerleşim listesi elle düzenleniyor ve tanımı olmayan bir
    // tip oraya geri yazılırsa modül o kutuyu SESSİZCE kurmaz.
    expect(tipler).not.toContain('fead-example');
    expect(tipler).toContain('fead-wizard');
    expect(tipler).toContain('fead-crank');
    // Yerleşimdeki her tip gerçekten tanımlı olmalı (yazım hatası kapısı)
    tipler.forEach((t) => expect(componentDefs[t]).toBeDefined());
  });
});

describe('componentDefs — FEAD tipleri yapısal olarak tutarlı', () => {
  const feadTipler = () => Object.keys(componentDefs).filter((t) => t.indexOf('fead-') === 0);

  // KASNAKLAR DA PORTSUZ (2026-09-09). Kayış sırası kablodan tabloya taşındı;
  // port bırakmak, kullanıcının kurabileceği ama HİÇBİR ŞEY İFADE ETMEYEN bir
  // tel demekti — sıra artık o telden okunmuyor.
  test('FEAD\'de HİÇBİR düğüm port taşımaz — kasnaklar dahil', () => {
    feadTipler().forEach((t) => {
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

  test('ne kasnak ne kayış olan düğüme rozet konmaz; iki kez çağrılınca çoğalmaz', () => {
    expect(rozet(kasnak('fead-solver'))).toBeNull();
    expect(rozet(kasnak('fead-layout'))).toBeNull();
    const e = el(), n = kasnak('fead-ac');
    fead.veFeadApplyBadge(e, n);
    fead.veFeadApplyBadge(e, n);
    expect(e.querySelectorAll('.ve-fead-badge')).toHaveLength(1);
  });

  // ── ÇAP HAYALETİ KALDIRILDI, GERİ GELMEMELİ (2026-08-26) ────────────────
  //
  // Kutunun arkasına gerçek dış çapı gösteren soluk kesikli bir çember
  // çiziliyordu; kullanıcı isteğiyle kaldırıldı ("bu bileşenlerin etrafına
  // böyle sanal bir çizgili daireler çizmişsin. Onları kaldıralım, gerek yok").
  //
  // ÖLÇÜLDÜ: özelliğin tamamı silindiğinde 5918 birim testinin HİÇBİRİ
  // kırılmadı — hayaletin hiç kapısı yoktu. Kaldırılan bir yüzeyi negatif
  // kapıyla kilitlemek bu deponun kalıbı (bkz. Geometri panelindeki "incelik
  // seçicisi ve 'Kenarlar' kutusu YOK"): yoksa biri çağrıyı geri koyar ve
  // kullanıcı isteği SESSİZCE geri alınmış olur.
  //
  // `od` VERİLİ olmak zorunda: eski üretici zaten `od > 0` olmadan çizmiyordu,
  // çapsız bir düğümle bu kapı ısırmazdı.
  test('kasnak kutusuna kesikli ÇAP HAYALETİ çizilmez', () => {
    [kasnak('fead-crank', { od: 162, driver: true }),
     kasnak('fead-alternator', { od: 57 }),
     kasnak('fead-idler', { od: 75, contact: 'back' })].forEach((n) => {
      const e = el();
      fead.veFeadApplyBadge(e, n);
      expect(e.querySelector('.ve-fead-dia')).toBeNull();
      // Kutuya HİÇBİR kesikli çember eklenmiyor (sınıf adı değişse de yakalar)
      expect(e.innerHTML).not.toMatch(/border-radius:\s*50%/);
      expect(e.innerHTML).not.toMatch(/dashed/);
    });
    // ve üretici/tazeleyici dışa da açılmıyor
    expect(fead.veFeadApplyDiaGhost).toBeUndefined();
    expect(fead.veFeadRefreshDiaGhosts).toBeUndefined();
  });

  // KAYIŞ DÜĞÜMÜ ROZETİ AYRI BİR ŞEY: temas tarafı değil, BOY KİPİ — ve salt
  // gösterge değil, seçim yüzeyi. Kullanıcı isteği: "topoloji üzerinden çok
  // basit bir şekilde 'kayış boyu sabit' veya 'kayış boyu değişken' seçeneği".
  describe('kayış düğümü: boy kipi rozeti', () => {
    test('kipi yazıyor ve varsayılan geriye dönük (boyu olan proje SABİT)', () => {
      expect(rozet(kasnak('fead-belt', { effLength: 1715 })).textContent).toBe('SABİT');
      expect(rozet(kasnak('fead-belt', {})).textContent).toBe('SERBEST');
      expect(rozet(kasnak('fead-belt', { lengthMode: 'free', effLength: 1715 })).textContent)
        .toBe('SERBEST');
    });

    test('TIKLANABİLİR — sürükleme başlatmaz, çift tık yutulur', () => {
      const b = rozet(kasnak('fead-belt', { effLength: 1715 }));
      expect(b.style.cursor).toBe('pointer');
      expect(typeof b.onclick).toBe('function');
      // Düğüm sürüklemesi mousedown'da başlıyor; rozet onu durdurmazsa tık
      // hiç gelmez (kanvasta ölçülmüş bir sınıf: hareketsiz tık kayboluyordu).
      expect(typeof b.onmousedown).toBe('function');
      expect(typeof b.ondblclick).toBe('function');
    });

    test('renk kipin ANLAMINI taşıyor: girdi mavi, türetilmiş amber', () => {
      expect(rozet(kasnak('fead-belt', { effLength: 1715 })).style.background)
        .toMatch(/accent-primary/);
      expect(rozet(kasnak('fead-belt', {})).style.background).toMatch(/accent-warning/);
    });

    test('iki kez çağrılınca çoğalmaz', () => {
      const e = el(), n = kasnak('fead-belt', { effLength: 1715 });
      fead.veFeadApplyBadge(e, n);
      fead.veFeadApplyBadge(e, n);
      expect(e.querySelectorAll('.ve-fead-badge')).toHaveLength(1);
    });
  });
});

// ── Boy kipi seçicisi ───────────────────────────────────────────────────────
describe('kayış boyu kipi — topoloji seçicisi', () => {
  const kurBelt = (data) => {
    const n = { id: 'blt1', type: 'fead-belt', def: componentDefs['fead-belt'],
                data: data || {} };
    global.nodes = [n];
    global.connections = [];
    return n;
  };

  test('geçiş kipi ÇEVİRİR ve düğüme yazar', () => {
    const n = kurBelt({ effLength: 1715 });
    expect(fead.veFeadToggleBeltMode('blt1')).toBe('free');
    expect(n.data.lengthMode).toBe('free');
    expect(fead.veFeadToggleBeltMode('blt1')).toBe('fixed');
    expect(n.data.lengthMode).toBe('fixed');
  });

  // Kip bir KULLANICI KARARI: geri alınabilmeli. (Kol konumu ya da yön gülü
  // gibi salt görünüm tercihleri undo yığınına binmiyor; bu ONLARDAN DEĞİL —
  // çözümü değiştiriyor.)
  test('geçiş saveState çağırır — geri alınabilir', () => {
    kurBelt({ effLength: 1715 });
    stubs.saveState.mockClear();
    fead.veFeadToggleBeltMode('blt1');
    expect(stubs.saveState).toHaveBeenCalled();
  });

  test('kayış olmayan düğümde geçiş HİÇBİR ŞEY yapmaz', () => {
    const n = { id: 'p1', type: 'fead-ac', def: componentDefs['fead-ac'], data: {} };
    global.nodes = [n];
    expect(fead.veFeadToggleBeltMode('p1')).toBeNull();
    expect(n.data.lengthMode).toBeUndefined();
  });

  test('panel kipi SORUYOR ve kanvas rozetiyle AYNI alanı okuyor', () => {
    const n = kurBelt({ effLength: 1715 });
    const sabit = fead.getFeadBeltPropertiesHTML(n);
    expect(sabit).toMatch(/lengthMode/);
    expect(sabit).toMatch(/value="fixed" selected/);
    expect(sabit).toMatch(/Efektif boy/);            // SABİT kipte GİRDİ alanı var

    n.data.lengthMode = 'free';
    const serb = fead.getFeadBeltPropertiesHTML(n);
    expect(serb).toMatch(/value="free" selected/);
    // SERBEST kipte boy bir alan DEĞİL, bir okuma
    expect(serb).not.toMatch(/id="ve-fead-effLength-/);
    expect(serb).toMatch(/Gereken efektif boy/);
  });

  // Türetilen sayı GÖRÜNMEK ZORUNDA: alanı kaldırıp yerine hiçbir şey koymamak
  // "boy nereden geldi" sorusunu cevapsız bırakırdı.
  test('serbest kipte türetilen boy panelde YAZILI', () => {
    const pack = M.veFeadExampleNodes('BMC_FEAD_2026');
    pack.nodes.forEach((x) => { x.def = componentDefs[x.type]; });
    const belt = pack.nodes.find((x) => x.type === 'fead-belt');
    belt.data.lengthMode = 'free';
    global.nodes = pack.nodes;
    global.connections = pack.connections;
    const html = fead.getFeadBeltPropertiesHTML(belt);
    expect(html).toMatch(/Gereken efektif boy/);
    expect(html).toMatch(/1715[.,]\d+ mm/);          // türetilen boy basılı
    expect(html).toMatch(/kol 28[.,]\d+°/);          // hangi kol açısından geldiği
  });

  test('çözülemeyen modelde sayı UYDURULMUYOR, sebep yazılıyor', () => {
    const n = kurBelt({ lengthMode: 'free' });        // tek başına kayış düğümü
    const html = fead.getFeadBeltPropertiesHTML(n);
    expect(html).toMatch(/Gereken efektif boy/);
    expect(html).toMatch(/—/);
    expect(html).not.toMatch(/NaN|undefined/);
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
    ['getFeadBeltPropertiesHTML', kasnak('fead-belt', {})]
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
      od: 75, cenX: -151.89, cenY: 185.50, armLen: 90, armMeanDeg: 71.8,
      preload: 8.59, kArm: 0.482, meanLoad: 22.09, sense: 1, loadStopRelDeg: 62.4
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
      if (n.data && typeof n.data.cenX === 'number') {
        n.data.cenX = -n.data.cenX;
        n.data.armMeanDeg = 180 - n.data.armMeanDeg;
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
// PORT KENARI BLOĞU KALKTI (2026-09-09) — `veFeadPortSideFor` ile birlikte.
// Kasnaklar artık portsuz, dolayısıyla "kenar komşuya bakar" diye bir kural
// yok. Ölçümü (on uçtan altısının 36,8…72 px sapması) modül skill'inde
// arşivli; aynı yön yeniden denenirse oradan okunur.
test('veFeadPortSideFor KALDIRILDI — geri gelirse kapı kırmızıya döner', () => {
  expect(typeof fead.veFeadPortSideFor).toBe('undefined');
});

// ── KUTULAR KALKTI (2026-09-09) — NEGATİF KAPI ────────────────────────────
// Kullanıcı isteği: *"Kutular kalkacak. Kutulara tıklayarak ulaşabildiğimiz
// detay panellerine tablodan parça isimlerinin üstüne tıklayarak yapacağız."*
// Kasnaklar modelde DÜĞÜM olarak duruyor (panel, geri-al, kayıt, göç hepsi
// oradan) ama kanvasa kutu ÇİZİLMİYOR. Kutuya bağlı bütün köprü onunla
// birlikte kalktı; bu kapı geri gelmelerini yakalar.
describe('kasnak KUTULARI ve kanvas↔mm köprüsü KALDIRILDI', () => {
  test('kasnak tipleri noCanvasBox taşır, araç düğümleri taşımaz', () => {
    Object.keys(componentDefs).filter((t) => componentDefs[t].isFeadPulley)
      .forEach((t) => expect(componentDefs[t].noCanvasBox).toBe(true));
    ['fead-belt', 'fead-solver', 'fead-layout', 'fead-table', 'fead-report', 'fead-spin']
      .forEach((t) => expect(!!componentDefs[t].noCanvasBox).toBe(false));
  });

  test('veIsCanvasHidden yalnız kasnaklara evet der', () => {
    expect(veIsCanvasHidden({ type: 'fead-crank' })).toBe(true);
    expect(veIsCanvasHidden({ type: 'fead-tensioner' })).toBe(true);
    expect(veIsCanvasHidden({ type: 'fead-table' })).toBe(false);
    expect(veIsCanvasHidden({ type: 'gearbox' })).toBe(false);
    expect(veIsCanvasHidden(null)).toBe(false);
  });

  test('kutuya bağlı yüzeyler dışa açılmıyor — hiçbiri geri gelmedi', () => {
    ['veFeadPlaceFromCoords', 'veFeadSyncDrag', 'veFeadApplyCoordLinkBadge',
     'veFeadToggleCoordLink', 'getFeadCoordLinkPropertiesHTML',
     'veFeadCoordLinkAfterDelete'].forEach((ad) => {
      expect(typeof fead[ad]).toBe('undefined');
    });
    ['veFeadCanvasToMm', 'veFeadMmToCanvas', 'veFeadNodeCenter',
     'veFeadSyncMmFromCanvas', 'veFeadSyncCanvasFromMm', 'veFeadDragTensioner',
     'veFeadCoordLinkNode', 'veFeadCoordLinkOn'].forEach((ad) => {
      expect(typeof M[ad]).toBe('undefined');
    });
  });

  test('Konum Bağı bileşeni componentDefs\'te YOK', () => {
    expect(componentDefs['fead-coordlink']).toBeUndefined();
  });
});

describe('gergi paneli TEK koordinat soruyor', () => {
  // Kullanıcı kararı (2026-08-29): "Artık sadece 'otomatik gergi montaj konumu'
  // var … Herhangi bir doğrulama gibi bir olay söz konusu değil."
  //
  // Bu blok eskiden kipe göre HANGİ ALANIN sorulduğunu tutuyordu (montaj
  // merkezi ↔ serbest açı). Kipler kalktı; kapı artık ikilik OLMADIĞINI
  // tutuyor — ikinci bir koordinat alanı geri gelirse kırmızıya döner.
  const tam = () => kasnak('fead-tensioner', {
    od: 75, cenX: -161.97, cenY: 91.29, armLen: 90, armMeanDeg: -11.9992,
    preload: 8.6, kArm: 0.48, meanLoad: 22.07,
  });

  test('avara merkezi ve kol YÖNÜ sorulur', () => {
    const html = fead.getFeadTensionerPropertiesHTML(tam());
    expect(html).toMatch(/veFeadSet\('[^']+','cenX'/);
    expect(html).toMatch(/veFeadSet\('[^']+','cenY'/);
    expect(html).toMatch(/Avara Kasnağının Merkezi/);
    expect(html).toMatch(/veFeadSet\('[^']+','meanLoad'/);
    // KOL YÖNÜ NİSPİ GÖSTERİLİYOR (kullanıcı, 2026-09-01) — alan mutlak
    // `armMeanDeg`i DOĞRUDAN yazmıyor, çeviriciden geçiyor. Saklanan alan
    // değişmedi; değişen tek şey ekranda konuşulan dil.
    expect(html).toMatch(/veFeadSetArmShown\('[^']+'/);
    expect(html).toMatch(/Kol yönü/);
    expect(html).not.toMatch(/veFeadSet\('[^']+','armMeanDeg'/);
  });

  test('İKİNCİ KOORDİNAT YOK — montaj konumu, serbest açı ve doğrulama alanı SORULMAZ', () => {
    const html = fead.getFeadTensionerPropertiesHTML(tam());
    ['pivotX', 'pivotY', 'freeAngleDeg', 'verifyCenX', 'verifyCenY'].forEach((k) => {
      expect(html).not.toMatch(new RegExp("veFeadSet\\('[^']+','" + k + "'"));
      expect(html).not.toMatch(new RegExp("'" + k + "'"));
    });
  });

  // MONTAJ KONUMU BİR ALAN DEĞİL, BİR OKUMA — ve okunmak ZORUNDA: atölyeye
  // giden sayı odur ve girdiyi doğru alana yazıp yazmadığınızı denetleyen tek
  // sayı da odur (kılavuz §7.1). Sessiz bırakılsaydı kullanıcı ters girişi
  // hiçbir yüzeyden fark edemezdi — ölçülmüş bedeli gerginlikte medyan
  // +%1526 ve 14 sistemin 5'inde HİÇBİR uyarı çıkmıyor.
  test('türeyen montaj konumu panelde BASILIYOR', () => {
    const html = fead.getFeadTensionerPropertiesHTML(tam());
    expect(html).toMatch(/montaj konumu \(türedi\)/);
    expect(html).toMatch(/-250\.00 \/ 110\.00/);
    expect(html).not.toMatch(/undefined|NaN/);
  });

  // ...VE KOL KÜNYESİ KARTINDA, "Avara Hareketi"ndekine ek olarak. İkisi AYNI
  // ŞEY DEĞİL ve mutasyon bunu ölçtü: Kol Künyesi'ndeki okuma SAF (yalnız üç
  // alandan hesaplanıyor), Avara Hareketi'ndeki ise ancak model ÇÖZÜLÜNCE
  // basılıyor. Çözülemeyen bir yerleşimde — ki ters koordinat girişinin en
  // olası sonucu odur — tek kalan teşhis yüzeyi birincisidir.
  test('kayış yolu ÇÖZÜLEMESE de montaj konumu okunuyor', () => {
    // Kanvasta başka kasnak yok: geometri kurulamıyor.
    global.nodes = []; global.connections = [];
    const html = fead.getFeadTensionerPropertiesHTML(tam());
    expect(html).toMatch(/montaj konumu \(türedi\)/);
    expect(html).toMatch(/-250\.00 \/ 110\.00/);
    // ve okuma KOL KÜNYESİ kartının içinde — onu belirleyen iki alanın yanında
    const i = html.indexOf('Kol Künyesi');
    const j = html.indexOf('Yay Künyesi');
    expect(i).toBeGreaterThan(-1);
    expect(j).toBeGreaterThan(i);
    expect(html.slice(i, j)).toMatch(/montaj konumu \(türedi\)/);
  });

  test('KİP SEÇİCİSİ YOK — tek yol var', () => {
    const html = fead.getFeadTensionerPropertiesHTML(tam());
    expect(html).not.toMatch(/angleMode/);
    expect(html).not.toMatch(/Ölçülmüş Pivot/);
  });

  test('KARŞILIKLI DOĞRULAMA YOK — "tutuyor/TUTMUYOR" hükmü basılmıyor', () => {
    // Eski panel |merkez − pivot| ile kol boyunu karşılaştırıp hüküm veriyordu.
    // Kol boyu ne olursa olsun artık böyle bir hüküm çıkmamalı.
    [90, 70, 120].forEach((armLen) => {
      const html = fead.getFeadTensionerPropertiesHTML(kasnak('fead-tensioner', {
        od: 75, cenX: -161.97, cenY: 91.29, armLen, armMeanDeg: -11.9992,
        preload: 8.6, kArm: 0.48, meanLoad: 22.07,
      }));
      expect(html).not.toMatch(/TUTMUYOR/);
      expect(html).not.toMatch(/çapraz kontrol/i);
      expect(html).not.toMatch(/Doğrulama/);
    });
  });

  test('ESKİ KAYIT göç eder: montaj konumlu gergi avara merkeziyle açılır', () => {
    // 2026-08-28…09-01 arası "zarf kipi" kaydı: pivotX/pivotY + armMeanDeg
    // + armPinned. Merkez TÜRETİLİR, eski alanlar SİLİNİR.
    const ten = kasnak('fead-tensioner', {
      od: 75, pivotX: -256.59, pivotY: 123.97, armLen: 90, armMeanDeg: 344,
      armPinned: true, angleMode: 'envelope',
      preload: 8.6, kArm: 0.48, meanLoad: 22.07,
    });
    const html = fead.getFeadTensionerPropertiesHTML(ten);
    // göç panelin kendi yolunda koştu
    expect(ten.data.pivotX).toBeUndefined();
    expect(ten.data.angleMode).toBeUndefined();
    expect(ten.data.armPinned).toBeUndefined();
    expect(ten.data.cenX).toBeCloseTo(-170.076, 2);
    expect(ten.data.cenY).toBeCloseTo(99.163, 2);
    expect(ten.data.armMeanDeg).toBe(344);       // kol açısı KORUNUR
    expect(html).toMatch(/Avara Kasnağının Merkezi/);
  });

  // EN ESKİ YAZIM da göç eder ve BEDAVA: `cenX/cenY` (+ angleMode:'mount')
  // 2026-08-29 öncesindeki her kaydın biçimiydi ve bugünkü girdinin ta
  // kendisi. Yalnız kalkmış alanlar siliniyor.
  test('EN ESKİ KAYIT (mount) alanı olduğu gibi taşır', () => {
    const ten = kasnak('fead-tensioner', {
      od: 75, cenX: -170.08, cenY: 99.16, armLen: 90, armMeanDeg: 344,
      angleMode: 'mount', preload: 8.6, kArm: 0.48, meanLoad: 22.07,
    });
    fead.getFeadTensionerPropertiesHTML(ten);
    expect(ten.data.cenX).toBe(-170.08);
    expect(ten.data.cenY).toBe(99.16);
    expect(ten.data.angleMode).toBeUndefined();
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

// "ÖRNEK PANELİ" KAPILARI TAŞINDI. Bileşen 2026-09-09'da kaldırıldı (kullanıcı:
// *"Gerek yok"*) ve tuttukları üç hüküm sihirbazın 1. adımında zaten kapılı:
// hiçbir örnek listeden düşmüyor (`fead-examples-gates.test.js` → *"sihirbazın
// 1. adımı HEPSİNİ listeliyor"*), pencere örnek sayısıyla büyümüyor ve seçim
// künyeyi değiştiriyor (`fead-wizard.test.js` → *"örnekten doldur — AÇILIR
// LİSTE"*). Buraya kopya bir kapı açmak aynı hükmü iki yerde tutmak olurdu.

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
      od: 75, cenX: -151.89, cenY: 185.50, armLen: 90, armMeanDeg: 71.8,
      preload: 8.59, kArm: 0.482, meanLoad: 22.09, sense: 1
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
  // SÖZLEŞME DEĞİŞTİ: geçersiz bir yol artık çizilir ve sebebi durum şeridinde
  // ADIYLA yazılır. Eskiden çizim gizlenip yerine mesaj konuyordu; ama çizim
  // teşhisin kendisi — hangi kasnağın ters sarıldığı ancak ona bakınca görünür.
  // Kapı bu yüzden "çizim var mı"dan "sebep yazıyor mu"ya taşındı.
  test('temas tarafı ters verilince kart ÇEVRİMİN KAPANMADIĞINI söyler', () => {
    const { lay, crk } = kurCozulur();
    const saglam = fead.veFeadLayoutCardHTML(lay);
    expect(saglam).toMatch(/data-ve="belt"/);
    expect(saglam).toMatch(/✓/);
    expect(saglam).not.toMatch(/KAPANMIYOR|İÇİNDEN/);

    crk.data.contact = 'back';
    const html = fead.veFeadLayoutCardHTML(lay);
    expect(html).toMatch(/data-ve="belt"/);               // sayılar var → çizilir
    expect(html).toMatch(/✗/);                            // ama geçersiz
    expect(html).toMatch(/KAPANMIYOR|İÇİNDEN geçiyor/);   // ve sebebi YAZILI
  });

  test('çözülemeyen modelde SEBEP yazılır — boş kutu değil', () => {
    const { lay, ten } = kurCozulur();
    delete ten.data.cenX;                    // avara merkezi eksik
    const html = fead.veFeadLayoutCardHTML(lay);
    expect(html).toMatch(/Şema çizilemiyor/);
    expect(html).toMatch(/avarasının merkez koordinatı/i);
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
      od: 75, cenX: -151.89, cenY: 185.50, armLen: 90, armMeanDeg: 71.8,
      preload: 8.59, kArm: 0.482, meanLoad: 22.09, sense: 1
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
    // KULLANICI İSTEĞİ (2026-08-26): "kanvas biraz BOYUNA GENİŞ" — kart
    // yükseklik-baskın olmak zorunda. Yalnız iki alt sınır tutulsaydı 500×440
    // (yani YATAY) da geçerdi ve istek sessizce geri alınmış olurdu.
    expect(VE_FEAD_LAYOUT_H).toBeGreaterThan(VE_FEAD_LAYOUT_W);
  });

  test('eski 60×56 kayıt kart ölçüsüne YÜKSELİR', () => {
    const n = { type: 'fead-layout', width: VE_FEAD_LAYOUT_LEGACY_W, height: VE_FEAD_LAYOUT_LEGACY_H };
    expect(veFeadNormalizeLayoutSize(n)).toBe(true);
    expect(n.width).toBe(VE_FEAD_LAYOUT_W);
    expect(n.height).toBe(VE_FEAD_LAYOUT_H);
  });

  // Kart ölçüsü 420×340 → 440×500 büyüdüğünde, bugüne kadar kaydedilmiş HER
  // proje eski ölçüyü taşıyor. Liste olmasaydı o projeler küçük kartla açılır,
  // yeni ölçü yalnız yeni kartlarda görünür ve aynı sürümde iki farklı kart
  // ölçüsü dolaşırdı — kullanıcı da farkı kendi yaptığı bir şey sanırdı.
  test('AŞILMIŞ her varsayılan yükselir — 60×56 DE 420×340 DA', () => {
    expect(VE_FEAD_LAYOUT_LEGACY.length).toBeGreaterThanOrEqual(2);
    VE_FEAD_LAYOUT_LEGACY.forEach((e) => {
      const n = { type: 'fead-layout', width: e.w, height: e.h };
      expect(veFeadNormalizeLayoutSize(n)).toBe(true);
      expect(n.width).toBe(VE_FEAD_LAYOUT_W);
      expect(n.height).toBe(VE_FEAD_LAYOUT_H);
    });
    // Listedeki hiçbir çift GÜNCEL ölçü olamaz: olursa göç kendi kendini
    // sonsuza kadar "değişti" sayar ve saveState her açılışta kirlenirdi.
    VE_FEAD_LAYOUT_LEGACY.forEach((e) => {
      expect(e.w === VE_FEAD_LAYOUT_W && e.h === VE_FEAD_LAYOUT_H).toBe(false);
    });
  });

  test('kullanıcının bilerek verdiği ölçü KORUNUR', () => {
    // Ölçü ne GÜNCEL ne de AŞILMIŞ hiçbir çiftle örtüşmemeli: 640×500 seçilseydi
    // yükseklik VE_FEAD_LAYOUT_H'in ta kendisi olurdu ve "korunuyor" iddiası
    // tek alandan ayrışırdı (test yine geçerdi, ama yanlış sebepten).
    const n = { type: 'fead-layout', width: 640, height: 420 };
    expect(VE_FEAD_LAYOUT_LEGACY.concat([{ w: VE_FEAD_LAYOUT_W, h: VE_FEAD_LAYOUT_H }])
      .some((e) => e.w === n.width || e.h === n.height)).toBe(false);
    expect(veFeadNormalizeLayoutSize(n)).toBe(false);
    expect(n.width).toBe(640);
    expect(n.height).toBe(420);
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
      od: 75, cenX: -151.89, cenY: 185.50, armLen: 90, armMeanDeg: 71.8,
      preload: 8.59, kArm: 0.482, meanLoad: 22.09, sense: 1
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
  //
  // ÖN GÖRÜNÜŞ: çizim X'te aynalandığı için `d` işareti de çevriliyor
  // (fead-model.js → veFeadMirrorGeomX). Beklenti bu yüzden ÇİZİMİN gördüğü
  // geometriden türetiliyor, ham sistemden değil — yoksa test aynalamayı bir
  // hata sanardı. Kapı yine ısırıyor: sweep'i sabitleyen bir mutasyon burada
  // kırmızı olur, çünkü ölçüt hâlâ "yay o kasnağın el yönüyle uyumlu mu".
  test('sweep kuralı: çizimdeki d > 0 → 0, d < 0 → 1', () => {
    const build = kurCozulur();
    const svg = fead.veFeadLayoutSVG(build, 420, 320);
    const yaylar = yaylariCoz(svg, 'belt');
    let geom = F.tensionerState(build.sys, F.meanRel(build.sys)).geom;
    if (M.VE_FEAD_VIEW_FRONT) geom = M.veFeadMirrorGeomX(geom);
    // Yaylar kayış sırasında: i. yay (i+1). kasnağın etrafında.
    yaylar.forEach((a, i) => {
      const p = geom.pulleys[(i + 1) % geom.pulleys.length];
      expect(a.fS).toBe(p.d > 0 ? 0 : 1);
    });
  });

  // ÖN GÖRÜNÜŞ AYNALAMASI: veri değil YALNIZ çizim döner.
  test('aynalama çizimi çevirir, sistemi ASLA', () => {
    const build = kurCozulur();
    const once = JSON.stringify(build.sys.pulleys.map((p) => p.c || [p.x, p.y]));
    const g = F.tensionerState(build.sys, F.meanRel(build.sys)).geom;
    const m = M.veFeadMirrorGeomX(g);
    // skalerler BİREBİR: aynalama tam simetri
    expect(m.LeffMm).toBe(g.LeffMm);
    expect(m.wraps).toEqual(g.wraps);
    // el yönü çevrilir
    expect(m.signedWrapDeg).toBeCloseTo(-g.signedWrapDeg, 9);
    m.pulleys.forEach((p, i) => {
      expect(p.d).toBe(-g.pulleys[i].d);
      expect(p.c[0]).toBeCloseTo(-g.pulleys[i].c[0], 9);
      expect(p.c[1]).toBeCloseTo(g.pulleys[i].c[1], 9);   // YUKARI yukarı kalır
    });
    // SAF: girdi değişmedi
    expect(JSON.stringify(build.sys.pulleys.map((p) => p.c || [p.x, p.y]))).toBe(once);
  });

  // Gül çizimi takip etmek ZORUNDA: aynalı resim + aynalanmamış açı okuması,
  // kullanıcıya 0°'yi yanlış tarafta aratırdı.
  test('yön gülü çizimle aynı yöne bakar', () => {
    const svg = fead.veFeadLayoutSVG(kurCozulur(), 420, 320, { compass: true });
    const et = [...svg.matchAll(/<text x="([-\d.]+)"[^>]*>(0|180)<\/text>/g)]
      .map((m) => ({ x: parseFloat(m[1]), t: m[2] }));
    expect(et.length).toBe(2);
    const sifir = et.find((e) => e.t === '0'), yuz80 = et.find((e) => e.t === '180');
    if (M.VE_FEAD_VIEW_FRONT) expect(sifir.x).toBeLessThan(yuz80.x);   // 0 SOLDA
    else expect(sifir.x).toBeGreaterThan(yuz80.x);
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
      od: 75, cenX: -151.89, cenY: 185.50, armLen: 90, armMeanDeg: 71.8,
      preload: 8.59, kArm: 0.482, meanLoad: 22.09, sense: 1
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
  //
  // TOLERANS/AŞINMA AÇIKÇA 0 VERİLİYOR ve varsayılan onu EZMEMELİ: `0` geçerli
  // bir kullanıcı değeridir ("zarfı kapat"), boş bırakmakla aynı şey değil.
  // Arşiv varsayılanı yalnız BOŞ alana iner (bkz. fead-defaults.test.js).
  test('tolerans 0 ise özdeş konumlar TEKİLLEŞİR ve sebep yazılır', () => {
    const { build } = kur({ tolerance: 0, wearPct: 0 });
    expect(build.sys.belt.tolerance).toBe(0);          // varsayılan EZMEDİ
    expect(build.sys.belt.wearPct).toBe(0);
    const sel = veFeadPosSelection(build, 'all');
    // Replace/Max/Mean/Min aynı açıya oturuyor → tek hayalet. Serbest kol ve
    // (durdurucu varsayılanı geldiği için) Load ayrı açılarda.
    const keys = sel.ghosts.map((g) => g.key).sort();
    expect(keys).toEqual(['free', 'load']);
  });

  test('tek konum kipinde hayalet YOK', () => {
    const { build } = kur();
    ['mean', 'free', 'min', 'max'].forEach((m) => {
      expect(veFeadPosSelection(build, m).ghosts).toHaveLength(0);
      expect(veFeadPosSelection(build, m).primary.key).toBe(m);
    });
  });

  // DURDURUCU ARTIK VARSAYILAN ALIYOR (2026-09-02): girilmemiş bir stop
  // nominal dönüşten ölçekleniyor, dolayısıyla Load konumu normalde ÇÖZÜLÜR.
  test('durdurucu girilmemişse arşiv varsayılanı gelir ve Load çözülür', () => {
    const { build } = kur();
    const sel = veFeadPosSelection(build, 'load');
    expect(sel.primary.key).toBe('load');
    const d = build.defaults.filter((x) => /load stop/i.test(x.field));
    expect(d).toHaveLength(1);
    // Varsayılan = nominal dönüş × katsayı, ve çekirdeğin sınırından KÜÇÜK.
    const nom = build.spring.relMeanDeg;
    expect(d[0].value).toBeCloseTo(nom * M.VE_FEAD_DEFAULTS.loadStopFactor, 9);
  });

  // Şema yine de BOŞ KALMAZ: listede olmayan bir konum seçilirse çalışma
  // konumuna düşer ve sebebini yazar. Kapı duruyor; yalnız "stop yok" durumu
  // artık varsayılan devreye girdiği için ELLE kuruluyor (yay künyesi eksik
  // bir modelde hâlâ böyle oluyor — nominal dönüş türetilemeyince varsayılan
  // da kurulmuyor).
  test('konum tabloda yoksa çalışma konumuna düşer + sebep', () => {
    const { build } = kur();
    delete build.sys.tensioner.loadStopRelDeg;
    build.sys._cache = {};
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
describe('gergi DOĞRULAMA kartı — panel hiçbir şeyi karşılaştırmıyor', () => {
  // Tek girdi AVARA MERKEZİDİR ve program, girilen noktanın o mu yoksa
  // gövdenin montaj konumu mu olduğunu TEK koordinatla ayırt EDEMEZ.
  // ÖLÇÜLDÜ: "kayış yoluna uzaklık" ölçütü ayırmıyor, eşik yanlış alarm
  // üretirdi. Eksik olan sezgi değil İKİNCİ SAYI — ve program onu SORMUYOR.
  // Denetim okuyucunun: türeyen montaj konumu ekranda basılı duruyor.
  const kur = () => {
    const pack = veFeadExampleNodes('AG00976_GATES_2025');
    pack.nodes.forEach((n) => { n.def = componentDefs[n.type]; });
    const t = pack.nodes.filter((n) => componentDefs[n.type].isFeadTensioner)[0];
    delete pack.nodes.filter((n) => componentDefs[n.type].isFeadBelt)[0].data.effLength;
    global.nodes = pack.nodes; global.connections = pack.connections;
    return t;
  };
  const duz = (h) => h.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ');

  test('DOĞRULAMA KARTI YOK — panel hiçbir şeyi karşılaştırmıyor', () => {
    // Kullanıcı kararı: "Herhangi bir doğrulama gibi bir olay söz konusu
    // değil." Kapı ÜRETİLEN YÜZEYE bakıyor: kart geri gelirse kırmızı.
    const h = duz(fead.getFeadTensionerPropertiesHTML(kur()));
    expect(h).not.toContain('Doğrulama');
    expect(h).not.toContain('Ayrışıyor');
    expect(h).not.toContain('kol boyuyla TUTUYOR');
    expect(h).not.toContain('Layout Data');
    expect(typeof fead.veFeadVerifyCard).toBe('undefined');
    expect(typeof fead.veFeadSetVerifyCen).toBe('undefined');
  });

  test('MONTAJ KONUMU yine OKUMA olarak basılıyor — gizlenmiyor', () => {
    // Atölyeye giden sayı odur ve girdiyi doğru alana yazıp yazmadığınızı
    // denetleyen tek sayı da odur. Gizlenirse ters giriş hiçbir yüzeyden
    // görünmez (ölçülmüş bedeli gerginlikte medyan +%1526).
    const h = duz(fead.getFeadTensionerPropertiesHTML(kur()));
    expect(h).toContain('montaj konumu (türedi)');
    expect(h).toContain('-250');
  });
});

// ── "OTOMATİK DÜZENLE" ARTIK YALNIZ ARAÇ KARTLARINI DİZİYOR ───────────────
//
// Bu blok iki kez yeniden yazıldı ve ikisi de bir sözleşme değişikliğiydi:
// önce "kasnakları halkaya diz" (konum hiçbir şey ifade etmezken doğruydu),
// sonra "kutuları mm koordinatına oturt" (kanvas kayış düzlemi olunca). Bugün
// kasnakların KUTUSU YOK — dizilecek kasnak kalmadı, geriye araç kartları
// kaldı. Eski iki yönün ölçümleri modül skill'inde arşivli.
describe('veFeadArrangeByCoords — araç kartlarını diziyor, kasnağa dokunmuyor', () => {
  const kur = (kasnakSay, aracTipler) => {
    const tipler = ['fead-crank', 'fead-alternator', 'fead-idler', 'fead-ac'];
    const ns = [];
    for (let i = 0; i < kasnakSay; i++) {
      const t = tipler[i % tipler.length];
      const d = componentDefs[t];
      ns.push({ id: 'r' + i, type: t, def: d, x: 7, y: 9,
                width: d.defaultWidth || 65, height: d.defaultHeight || 60,
                data: Object.assign({ od: 80, x: i * 100, y: i * 50 },
                                    i === 0 ? { driver: true } : {}) });
    }
    (aracTipler || []).forEach((t, i) => {
      const d = componentDefs[t];
      ns.push({ id: 'a' + i, type: t, def: d, x: 0, y: 0,
                width: d.defaultWidth || 65, height: d.defaultHeight || 60, data: {} });
    });
    global.nodes = ns; global.connections = [];
    return ns;
  };

  beforeEach(() => {
    document.body.innerHTML = '<div id="ve-canvas"></div>';
    global.updateAllConnections = jest.fn();
  });

  test('KASNAK KUTUSU OYNAMAZ — kanvasta yeri yok', () => {
    const ns = kur(4, ['fead-belt', 'fead-layout']);
    fead.veFeadArrangeByCoords({ silent: true });
    ns.filter((n) => componentDefs[n.type].isFeadPulley).forEach((n) => {
      expect(n.x).toBe(7);          // dokunulmadı
      expect(n.y).toBe(9);
    });
  });

  test('iki BÜYÜK kart sağda, künyeler solda', () => {
    const ns = kur(3, ['fead-belt', 'fead-solver', 'fead-layout', 'fead-table']);
    expect(fead.veFeadArrangeByCoords({ silent: true })).toBe(true);
    const bul = (t) => ns.find((n) => n.type === t);
    // Sağ şerit: Kayış Yolu + Kayış Tablosu. Sol şerit: künyeler.
    expect(bul('fead-layout').x).toBeGreaterThan(bul('fead-belt').x);
    expect(bul('fead-table').x).toBeGreaterThan(bul('fead-solver').x);
    // Sol şerit SAĞA yaslı (x0 - genişlik), sağ şerit SOLA yaslı → çakışma yok.
    const solSag = Math.max(bul('fead-belt').x + bul('fead-belt').width,
                            bul('fead-solver').x + bul('fead-solver').width);
    expect(bul('fead-layout').x).toBeGreaterThanOrEqual(solSag);
  });

  test('aynı şeritteki kartlar dikeyde ÇAKIŞMIYOR', () => {
    const ns = kur(2, ['fead-belt', 'fead-solver', 'fead-report']);
    fead.veFeadArrangeByCoords({ silent: true });
    const sol = ns.filter((n) => ['fead-belt', 'fead-solver', 'fead-report'].includes(n.type))
      .sort((a, b) => a.y - b.y);
    for (let i = 1; i < sol.length; i++)
      expect(sol[i].y).toBeGreaterThanOrEqual(sol[i - 1].y + sol[i - 1].height);
  });

  // ── ADIN YERİ DE ŞERİDE GİRER ───────────────────────────────────────────
  // YUKARIDAKİ KAPI YALNIZ KUTUYU ÖLÇÜYOR ve hata tam oradan kaçtı: ad kutunun
  // ALTINDA duruyor, dikey adım onu hiç saymıyordu. Ölçüldü (gerçek tarayıcı,
  // 6 kasnaklı AG00976): üç araç aralığında da adın altında 2 px kalıyor ve
  // komşunun DEKORASYONU oraya biniyordu — seçim tutamağı kutudan ~5 px dışarı
  // taşar ("Çözücü" → "Çöz▪cü"), kayış kipi rozeti kutunun üst kenarına oturup
  // üstteki adın kuyruklarını örter. Sekiz çakışma; düzeltmeden sonra sıfır.
  test('ad KUTUNUN ALTINDA duruyor ve sonraki karta DEĞMİYOR', () => {
    const CS = require('../../js/canvas-space.js');
    const LH = 12;
    global.veNodeLabelOverflow = CS.veNodeLabelOverflow;
    global.veMeasureNodeLabel = () => ({ w: 96, h: LH });   // DOM'un yerine
    try {
      const tipler = ['fead-belt', 'fead-solver', 'fead-report'];
      const serit = (ns) => ns.filter((n) => tipler.includes(n.type)).sort((a, b) => a.y - b.y);

      // ADSIZ hâlin kutu-kutu boşluğu — kapının ÖLÇÜTÜ bu, koda gömülü bir
      // sayı değil: sabit değişirse kapı onunla birlikte kayar.
      delete global.veMeasureNodeLabel;
      const a = serit((kur(2, tipler), fead.veFeadArrangeByCoords({ silent: true }), global.nodes));
      const bosluk = a[1].y - (a[0].y + a[0].height);
      expect(bosluk).toBeGreaterThan(0);

      // ADLI hâl: adın ALTINDA da AYNI boşluk kalmalı — yoksa komşunun
      // dekorasyonu adın üstüne biner.
      global.veMeasureNodeLabel = () => ({ w: 96, h: LH });
      const b = serit((kur(2, tipler), fead.veFeadArrangeByCoords({ silent: true }), global.nodes));
      const adPay = CS.VE_LABEL_GAP_V + LH;      // css margin + ad yüksekliği
      for (let i = 1; i < b.length; i++)
        expect(b[i].y - (b[i - 1].y + b[i - 1].height + adPay)).toBeGreaterThanOrEqual(bosluk);
    } finally {
      delete global.veNodeLabelOverflow; delete global.veMeasureNodeLabel;
    }
  });

  test('ad ÖLÇÜLEMEZSE yerleşim BİREBİR eski hâli', () => {
    // Saf koşucuda DOM yok; uydurma bir yükseklik kartları sebepsiz
    // uzaklaştırırdı. Kapı `veBoundaryBox`un `measure` sözleşmesiyle aynı:
    // ölçüm işlevi yoksa davranış değişmez.
    const tipler = ['fead-belt', 'fead-solver', 'fead-report'];
    const oku = (ns) => ns.filter((n) => tipler.includes(n.type))
      .sort((a, b) => a.id.localeCompare(b.id)).map((n) => [n.x, n.y]);

    const a = kur(2, tipler);
    fead.veFeadArrangeByCoords({ silent: true });
    const olcumsuz = oku(a);

    global.veMeasureNodeLabel = () => null;      // eleman yok → ölçü yok
    try {
      const b = kur(2, tipler);
      fead.veFeadArrangeByCoords({ silent: true });
      expect(oku(b)).toEqual(olcumsuz);
    } finally { delete global.veMeasureNodeLabel; }
  });

  test('yalnız kasnak varsa düzen KURULMAZ (dizilecek kart yok)', () => {
    kur(4, []);
    expect(fead.veFeadArrangeByCoords({ silent: true })).toBe(false);
  });

  test('silent: saveState ve toast ÇAĞRILMAZ, yerleştirme yine yapılır', () => {
    const ns = kur(2, ['fead-belt', 'fead-layout']);
    stubs.saveState.mockClear(); stubs.showToast.mockClear();
    expect(fead.veFeadArrangeByCoords({ silent: true })).toBe(true);
    expect(stubs.saveState).not.toHaveBeenCalled();
    expect(stubs.showToast).not.toHaveBeenCalled();
    expect(ns.find((n) => n.type === 'fead-layout').x).not.toBe(0);
  });
});

// ── ÖRNEK KURUCUSU: KASNAK KUTUSU KURMUYOR ────────────────────────────────
// Eski blok "kutu merkezi mm koordinatına oturuyor mu" diye soruyordu ve iki
// sessiz kaymayı yakalamıştı (kurucunun kendi ölçeği · hizalama kenetlemesi).
// İkisi de artık KURULAMIYOR: kutu yok. Kapı bugün onun yerine kutusuzluğu ve
// araç düğümlerinin şerit sırasını tutuyor.
describe('veFeadLoadExample — kasnak kutusu KURULMUYOR', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="ve-canvas"></div>';
    global.nodes = []; global.connections = [];
  });

  test('kurulan kasnakların DOM elemanı yok, araç düğümlerinin var', () => {
    let k = 0;
    global.createNode = (type, x, y) => {
      const d = componentDefs[type] || {};
      if (d.maxInstances && global.nodes.filter((n) => n.type === type).length >= d.maxInstances)
        return null;
      const n = { id: 'cv' + ++k, type, def: d, x, y,
                  width: d.defaultWidth || 65, height: d.defaultHeight || 60, data: {} };
      global.nodes.push(n);
      // Gerçek createNode kutusuz tipte DOM kurmuyor — sahte de kurmamalı,
      // yoksa kapı doğru sebepten değil, sahte yüzünden geçerdi.
      if (!veIsCanvasHidden(n)) {
        const el = document.createElement('div');
        el.id = n.id; el.innerHTML = '<div class="ve-node-box"></div>';
        document.body.appendChild(el);
      }
      return n;
    };
    fead.veFeadLoadExample('AG00976_GATES_2025');
    delete global.createNode;

    const kasnak = global.nodes.filter((n) => componentDefs[n.type].isFeadPulley);
    expect(kasnak).toHaveLength(6);
    kasnak.forEach((n) => expect(document.getElementById(n.id)).toBeNull());
    ['fead-belt', 'fead-solver', 'fead-layout', 'fead-table', 'fead-report'].forEach((t) => {
      const n = global.nodes.find((x) => x.type === t);
      expect(n).toBeTruthy();
      expect(document.getElementById(n.id)).not.toBeNull();
    });
  });
});

describe('serbest kipte türetilen boyun KÖKENİ', () => {
  const bmc = (mut) => {
    const pack = veFeadExampleNodes('BMC_FEAD_2026');
    pack.nodes.forEach((n) => { n.def = componentDefs[n.type]; });
    pack.nodes.find((n) => n.type === 'fead-belt').data.lengthMode = 'free';
    if (mut) mut(pack);
    global.nodes = pack.nodes; global.connections = pack.connections;
    return pack.nodes.find((n) => n.type === 'fead-belt');
  };
  const duz = (h) => h.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  // Yay künyesi EKSİK kurulum — nominal açı salt künyeden geldiği için
  // model burada sayı üretmek yerine sebebini yazmak zorunda.
  const direct = (pack, sil) => {
    const t = pack.nodes.find((n) => n.type === 'fead-tensioner');
    t.data.sense = -1;
    if (sil) delete t.data.meanLoad;
  };

  test('SAĞLIKLI modelde metin değişmedi — yanlış alarm YOK', () => {
    const belt = bmc();
    const t = duz(fead.veFeadDerivedLengthHTML(belt));
    expect(t).toMatch(/Tedarikçiye verilecek boy budur/);
    expect(t).not.toMatch(/künyesi eksik|oturamadı/);
    // sayı amber kalır, soru işareti eklenmez
    expect(fead.veFeadDerivedLengthHTML(belt)).toMatch(/--accent-warning/);
    expect(t).not.toMatch(/mm \?/);
    // ve panelde uyarı kutusu çıkmaz
    expect(duz(fead.getFeadBeltPropertiesHTML(belt))).not.toMatch(/Uyarılar/);
  });

  test('künye EKSİKSE boy UYDURULMAZ — sebep yazılır', () => {
    // ESKİDEN: yay künyesi eksikken kol gezinme aralığının ORTASINA düşüyor,
    // panel yine "tedarikçiye verilecek boy budur" diyordu. Tek koordinata
    // inince o sessiz yedek kalktı: nominal açı SALT yay künyesinden geldiği
    // için künye yoksa zarf üzerinde seçilecek bir nokta da yok, ve model
    // sayı üretmek yerine sebebini yazıyor.
    const belt = bmc((p) => direct(p, true));
    const t = duz(fead.veFeadDerivedLengthHTML(belt));
    expect(t).toMatch(/Spring Mean Load\)? girilmedi/);
    expect(t).not.toMatch(/Tedarikçiye verilecek boy budur/);
    expect(t).not.toMatch(/NaN|undefined/);
  });

  test('kol KENETLENDİYSE: nominale oturamadığını yazar', () => {
    const belt = bmc((p) => {
      p.nodes.find((n) => n.type === 'fead-tensioner').data.kArm = 0.048;  // ondalık kayması
    });
    const h = fead.veFeadDerivedLengthHTML(belt), t = duz(h);
    expect(t).toMatch(/Kol nominal açısına oturamadı/);
    expect(t).not.toMatch(/Tedarikçiye verilecek boy budur/);
    expect(h).toMatch(/--accent-danger/);
  });

  // Boyun OKUNDUĞU panel, sebebi de basmak zorunda: veFeadWarningBox Kayış
  // Yolu ve Çözücü panellerinde vardı, burada YOKTU.
  test('kenetlenmiş çözümün SEBEBİ Kayış Özellikleri panelinde basılır', () => {
    const belt = bmc((p) => {
      p.nodes.find((n) => n.type === 'fead-tensioner').data.kArm = 0.048;
    });
    const panel = duz(fead.getFeadBeltPropertiesHTML(belt));
    expect(panel).toMatch(/Uyarılar/);
    expect(panel).toMatch(/aralığın dışında|kenetlendi/);
  });

  test('çözülemeyen modelde sayı UYDURULMAZ', () => {
    const belt = bmc((p) => {
      const t = p.nodes.find((n) => n.type === 'fead-tensioner');
      delete t.data.cenX; delete t.data.cenY; delete t.data.pivotX; delete t.data.pivotY;
    });
    const t = duz(fead.veFeadDerivedLengthHTML(belt));
    expect(t).toMatch(/Gereken efektif boy —/);
    expect(t).not.toMatch(/\d+\.\d+ mm/);
  });
});

describe('yön gülünün yeri', () => {
  const kurCozulur = () => {
    const crk = kasnak('fead-crank', { od: 160, x: 0, y: 0, driver: true }, 'CRK');
    const idr = kasnak('fead-idler', { od: 75, x: -72, y: 267 }, 'IDR');
    const ac = kasnak('fead-ac', { od: 127, x: -224, y: 448 }, 'A_C');
    const ten = kasnak('fead-tensioner', {
      od: 75, cenX: -151.89, cenY: 185.50, armLen: 90, armMeanDeg: 71.8,
      preload: 8.59, kArm: 0.482, meanLoad: 22.09, sense: 1
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

  // ── ŞERİT ARTIK KOŞULLU — ve ölçütü ÇİZİLEN ŞEYİN KENDİSİ ────────────────
  //
  // Eski kural: gül varsayılan yerindeyse 54 px'lik sağ şerit KOŞULSUZ ayrılır.
  // Yeni kural bir ölçüm: şerit ayrılmadan ölçeklenir, sonra gülün kutusu
  // gerçekten çizilen şeylere (kasnak çemberleri · kayış açıklıkları · gergi
  // kolu · pivot) çarpıyor mu diye bakılır. Çarpmıyorsa şerit hiç ayrılmaz.
  //
  // ÖLÇÜLDÜ (BMC, 6 kasnak) — en büyük kasnak yarıçapı px:
  //   kart      eski (koşulsuz)   yeni    kazanç
  //   440×458        50.29        58.05   +%15.4   ← yeni varsayılan kart
  //   380×298        41.67        45.45   +%9.1
  //   340×298        35.92        43.68   +%21.6
  //   300×240        30.17        35.39   +%17.3
  //   260×200        23.50        28.45   +%21.1
  //   220×180        16.68        16.68     %0     ← ÇARPIŞMA VAR, şerit ayrılır
  //   180×140         9.86         9.86     %0     ← çarpışma var
  //
  // Yani kazanç yer VARKEN doğuyor, yer YOKKEN davranış birebir eskisi.
  // 420×298'de iki kural da aynı sonucu veriyor çünkü orada ölçek zaten
  // YÜKSEKLİĞE bağlıydı — şerit hiçbir şeyi kısıtlamıyordu.
  const bmc = () => {
    const pack = veFeadExampleNodes('BMC_FEAD_2026');
    pack.nodes.forEach((n) => { n.def = componentDefs[n.type]; });
    global.nodes = pack.nodes; global.connections = pack.connections;
    return veFeadBuildFromCanvas();
  };
  // "Şerit ayrıldı mı" sorusunun gözlenebilir karşılığı: gülü TAŞIMAK çizimi
  // büyütüyor mu? Taşınmış gül hiçbir zaman şerit ayırmaz, dolayısıyla fark
  // yalnız varsayılan konumda şerit ayrılmışsa doğar.
  const seritAyrildi = (build, W, H) => {
    const a = enBuyukR(fead.veFeadLayoutSVG(build, W, H, { nodeId: 'lay' }));
    const b = enBuyukR(fead.veFeadLayoutSVG(build, W, H,
      { nodeId: 'lay', compassPos: { fx: 0.12, fy: 0.12 } }));
    return { ayrildi: Math.abs(b - a) > 0.01, a: a, b: b };
  };

  test('gül çizime ÇARPMIYORSA şerit ayrılmaz — varsayılan kartta ayrılmıyor', () => {
    const build = bmc();
    const r = seritAyrildi(build, VE_FEAD_LAYOUT_W, VE_FEAD_LAYOUT_H - 42);
    expect(r.ayrildi).toBe(false);
    // Kullanıcı gülü taşısa bile kazanacağı bir şey yok: çizim ZATEN tam alanda.
    expect(r.b).toBeCloseTo(r.a, 2);
    // ve gerçekten büyük: eski koşulsuz şeritte 50.29 px'ti (yukarıdaki tablo)
    expect(r.a).toBeGreaterThan(55);
  });

  test('çarpışma VARSA şerit AYRILIR — dar kartta eski davranış korunuyor', () => {
    const build = bmc();
    const r = seritAyrildi(build, 200, 150);
    expect(r.ayrildi).toBe(true);
    expect(r.b / r.a).toBeGreaterThan(1.2);          // ölçüldü: %49.0
  });

  test('geniş kartta iki kural da aynı sonucu verir (ölçek yüksekliğe bağlı)', () => {
    const build = bmc();
    const r = seritAyrildi(build, 420, 298);
    expect(r.ayrildi).toBe(false);
    expect(r.b).toBeCloseTo(r.a, 2);
  });

  // ── GÜL ETİKET YERLEŞTİRİCİSİNDE BİR ENGELDİR ──────────────────────────
  //
  // Şerit koşullu olunca çizim gülün durduğu sağ alt köşeye kadar uzanabiliyor;
  // orada duran bir kasnağın ADI yön etiketlerinin (0/90/180/270) üstüne biner
  // ve bu, çizim hatası gibi değil VERİ hatası gibi okunur.
  //
  // ÖLÇÜT ÇAPA NOKTASI DEĞİL, ETİKET KUTUSU. İlk yazımda çapa noktasına
  // bakılıyordu ve kapı MUTASYONDAN GEÇTİ (engeli kaldırmak testi kırmıyordu):
  // `middle` çapası çakışmanın 43 px solunda duruyor, kutu ise sağa taşıyor.
  // Kutu ölçütüyle ölçüldüğünde beş kombinasyon çakışıyor — engel gerçekten
  // iş yapıyor. Kutu kuralı yerleştiricinin kendisiyle AYNI (bkz. `aday`).
  const adKutulari = (svg) =>
    [...svg.matchAll(/<text data-ve="name" x="([-\d.]+)" y="([-\d.]+)" text-anchor="(\w+)" font-size="9"[^>]*>([^<]*)</g)]
      .map((m) => {
        const x = +m[1], y = +m[2], an = m[3], w = m[4].length * 9 * 0.6;
        const x0 = an === 'middle' ? x - w / 2 : an === 'start' ? x : x - w;
        return { x0, x1: x0 + w, y0: y - 8, y1: y + 2 };
      });

  test('kasnak adı gülün kutusuna GİRMEZ', () => {
    const build = bmc();
    // Çakışmanın GERÇEKTEN doğduğu kombinasyon (ölçüldü): dar kart + uzun ad.
    // Varsayılan 440×458 kartta hiçbir ad güle yaklaşmıyor, yani orada ölçmek
    // engeli hiç sınamazdı.
    [[340, 298], [300, 240]].forEach(([W, H]) => {
      const svg = fead.veFeadLayoutSVG(build, W, H,
        { nodeId: 'lay', names: { 0: 'Klima Kompresörü Kasnağı (Denso 6SEU14C)' } });
      const g = /<g data-ve="compass-group" data-cx="([-\d.]+)" data-cy="([-\d.]+)"/.exec(svg);
      expect(g).not.toBeNull();
      const m = fead.VE_FEAD_ROSE_HALF + 3;
      const r = { x0: +g[1] - m, x1: +g[1] + m, y0: +g[2] - m, y1: +g[2] + m };
      const ad = adKutulari(svg);
      expect(ad.length).toBeGreaterThan(0);
      ad.forEach((b) => {
        const ortusuyor = !(b.x1 <= r.x0 || b.x0 >= r.x1 || b.y1 <= r.y0 || b.y0 >= r.y1);
        expect(ortusuyor).toBe(false);
      });
    });
  });

  // TAŞINMIŞ GÜL DE ENGELDİR. "Şerit ayırayım mı" ile "etiket buraya girmesin"
  // İKİ AYRI SORU: birincisi taşınmış gülde gerçekten kullanıcının sorumluluğu,
  // ikincisi koşulsuz doğru — taşınmış gül de çiziliyor ve kullanıcı onu tam
  // şemanın ORTASINA sürükleyebilir. İkisi tek bayrağa (`!moved`) bağlanınca
  // compassPos verilir verilmez koruma kapanıyordu; yani gül çizime GİRDİĞİ
  // anda etiketler onun altına düşüyordu.
  //
  // ÖLÇÜLDÜ (BMC, 440×458, gülün 16×16'lık kesir ızgarası = 256 konum):
  //   engel VARKEN  çakışan konum sayısı **3**
  //   engel YOKKEN  çakışan konum sayısı **61**
  // Kalan 3 konum (fx 0.20 · fy 0.25–0.35) yerleştiricinin kendi ilan ettiği
  // geri düşüşü: dört adayın hiçbiri temiz değilse etiket üste döner ve
  // çakışır — kaybolmaz. Aşağıdaki konumlar o üçün DIŞINDAN, yani engelin
  // gerçekten kurtardığı yerlerden seçildi.
  test('gül TAŞINMIŞKEN de etiket engelidir — şemanın ortasına sürüklense bile', () => {
    const build = bmc();
    [{ fx: 0.40, fy: 0.60 }, { fx: 0.40, fy: 0.65 }, { fx: 0.45, fy: 0.25 },
     { fx: 0.30, fy: 0.65 }, { fx: 0.86, fy: 0.86 }].forEach((pos) => {
      const svg = fead.veFeadLayoutSVG(build, VE_FEAD_LAYOUT_W, VE_FEAD_LAYOUT_H - 42,
        { nodeId: 'lay', compassPos: pos });
      const g = /<g data-ve="compass-group" data-cx="([-\d.]+)" data-cy="([-\d.]+)"/.exec(svg);
      expect(g).not.toBeNull();
      const m = fead.VE_FEAD_ROSE_HALF + 3;
      const r = { x0: +g[1] - m, x1: +g[1] + m, y0: +g[2] - m, y1: +g[2] + m };
      adKutulari(svg).forEach((b) => {
        expect(!(b.x1 <= r.x0 || b.x0 >= r.x1 || b.y1 <= r.y0 || b.y0 >= r.y1)).toBe(false);
      });
    });
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

// ════════════════════════════════════════════════════════════════════════════
//  DURUM ŞERİDİ: ÇEVRİM İKİ YÖNE DE GEZİLEBİLİR (±360°)
// ════════════════════════════════════════════════════════════════════════════
// Aynalanmış bir yerleşimde kayış ters yönde dolanır ve işaretli sarım toplamı
// −360° çıkar. ÇEKİRDEK bunu zaten kabul ediyor (fead-core.js: ||Σ|−360| > 0.05
// → hata) ve HTML rapor da |Σ| ile bakıyor; yalnız kart şeridi +360 arıyordu.
// Sonuç: çekirdeğin kusursuz çözdüğü bir topoloji kartta ✗ "tutarsız"
// görünüyordu. RASTGELE ÜRETİLMİŞ bir konfigürasyonda yakalandı — ezber bir
// eşiğin genel matematikle ayrıştığı yer tam olarak burasıydı.
describe('durum şeridi — aynalanmış çevrim', () => {
  const kurDort = () => {
    const crk = kasnak('fead-crank', { od: 160, x: 0, y: 0, driver: true }, 'CRK');
    const idr = kasnak('fead-idler', { od: 75, x: -72, y: 267 }, 'IDR');
    const ac = kasnak('fead-ac', { od: 127, x: -224, y: 448 }, 'A_C');
    const ten = kasnak('fead-tensioner', {
      od: 75, cenX: -151.89, cenY: 185.50, armLen: 90, armMeanDeg: 71.8,
      preload: 8.59, kArm: 0.482, meanLoad: 22.09, sense: 1
    }, 'TEN');
    const belt = kasnak('fead-belt', { profile: 'PK', brand: 'GATES', ribs: 8, effLength: 1475, tolerance: 6 });
    const sv = kasnak('fead-solver', { designTensionN: 765.7, driveRatio: 1, lengthOffsetMm: 3.5 });
    global.nodes = [crk, idr, ac, ten, belt, sv];
    global.connections = [[crk, idr], [idr, ac], [ac, ten], [ten, crk]]
      .map(([a, b]) => ({ id: 'c' + a.id + b.id, from: a.id, to: b.id, fromPort: 'output', toPort: 'input' }));
  };

  test('düz çevrim: ✓ ve Σsarım 360°', () => {
    kurDort();
    const h = fead.veFeadLayoutCardStrip(veFeadBuildFromCanvas(), 'mean');
    expect(h).toMatch(/✓/);
    expect(h).toMatch(/Σsarım 360\.0°/);
    expect(h).not.toMatch(/ters yön/);
  });

  // Bu düzen RASTGELE ÜRETİLDİ (tohum 69) ve kapıyı bu yakaladı: sekiz kasnak,
  // dördü sırttan temas, çekirdek kusursuz çözüyor ama işaretli sarım toplamı
  // −360° çıkıyor. Sayılar birebir o üretimden; elle "ayarlanmış" bir düzen
  // değil. Eski kapı bunu ✗ ile "tutarsız" gösteriyordu.
  const kurNegatif = () => {
    const P = [
      ['fead-crank', { od: 197.9, x: -10.4, y: -261.6, contact: 'grooved', driver: true }],
      ['fead-idler', { od: 74.5, x: 127.6, y: -198.8, contact: 'back' }],
      ['fead-ac', { od: 130, x: 190.2, y: -63.1, contact: 'grooved' }],
      ['fead-idler', { od: 94.6, x: 157.5, y: 155.9, contact: 'back' }],
      ['fead-idler', { od: 68.7, x: 59.7, y: 249.5, contact: 'back' }],
      ['fead-waterpump', { od: 65.7, x: -101.6, y: 224, contact: 'grooved' }],
      ['fead-ac', { od: 112.6, x: -193.7, y: 39.2, contact: 'grooved' }],
      ['fead-tensioner', { od: 84.1, x: -172.3, y: -124.8, contact: 'back',
        cenX: -211.682, cenY: -94.444, armLen: 61.3, armMeanDeg: 76.3,
        meanLoad: 31.55, preload: 12.05, kArm: 0.696 }]
    ].map(([t, d], i) => kasnak(t, d, 'P' + i));
    const belt = kasnak('fead-belt', { profile: 'PK', brand: 'GATES', ribs: 8,
      effLength: 2266.1, tolerance: 3, wearPct: 0.007 });
    const sv = kasnak('fead-solver', { designTensionN: 408, driveRatio: 1, lengthOffsetMm: 0 });
    global.nodes = P.concat([belt, sv]);
    global.connections = P.map((n, i) => ({ id: 'k' + i, from: n.id, to: P[(i + 1) % P.length].id,
      fromPort: 'output', toPort: 'input' }));
  };

  test('Σ = −360° veren düzen ÇÖZÜLÜYOR ve şerit onu ✗ saymıyor', () => {
    kurNegatif();
    const build = veFeadBuildFromCanvas();
    expect(build.ok).toBe(true);
    const g = F.tensionerState(build.sys, F.meanRel(build.sys)).geom;
    let sg = 0, bk = 0;
    g.wraps.forEach((w, i) => { if (build.sys.pulleys[i].contact === 'back') bk += w; else sg += w; });
    const inv = (sg - bk) * 180 / Math.PI;
    expect(inv).toBeCloseTo(-360, 1);                       // gerçekten negatif
    const h = fead.veFeadLayoutCardStrip(build, 'mean');
    expect(h).toMatch(/✓/);
    expect(h).not.toMatch(/✗/);
    expect(h).toMatch(/ters yön/);
  });

  test('çözülemeyen model ✗ kalır (kapı yalnız işareti gevşetti)', () => {
    kurNegatif();
    // "Zinciri kopar" ARTIK YAPILAMIYOR (kablo 2026-09-09'da kalktı ve liste
    // tanımı gereği kapalı). Çözülemezliğin kalan gerçek kaynağı GEOMETRİ:
    // iki kasnağı üst üste koymak teğeti yok ediyor, çekirdek üretecek sayı
    // bulamıyor. Kapının ölçtüğü şey değişmedi — şerit hükmü ✗.
    global.nodes[1].data.x = global.nodes[0].data.x;
    global.nodes[1].data.y = global.nodes[0].data.y;
    const h = fead.veFeadLayoutCardStrip(veFeadBuildFromCanvas(), 'mean');
    expect(h).toMatch(/✗/);
  });
});

// ════════════════════════════════════════════════════════════════════════════
//  TASARIM GERGİNLİĞİ PANELDE SORULMUYOR
// ════════════════════════════════════════════════════════════════════════════
// Alan kaldırıldı çünkü bağımsız bir veri değildi (10 Gates raporunda girilen ↔
// türeyen farkı %0.12). Geri gelirse sessiz kayma sınıfı da geri gelir: girilen
// bir sayı zinciri ankrajlar, bütün gerilmeler kayar ve kayma emniyeti bir ORAN
// olduğu için tablodan anlaşılmaz.
describe('Çözücü paneli tasarım gerginliği SORMUYOR', () => {
  test('panelde designTensionN alanı yok', () => {
    const node = { id: 'sv', type: 'fead-solver', def: componentDefs['fead-solver'], data: {} };
    const html = fead.getFeadSolverPropertiesHTML(node);
    expect(html).not.toMatch(/designTensionN/);
    expect(html).not.toMatch(/Tasarım gerginliği \[N\]/);
    // yerine nereden geldiği YAZILI olmalı
    expect(html).toMatch(/Tasarım gerginliği sorulmaz/);
  });

  test('Algılanan Model tablosu TÜRETİLEN değeri gösteriyor', () => {
    const ex = veFeadExampleNodes('BMC_FEAD_2026');
    ex.nodes.forEach((n) => { n.def = componentDefs[n.type]; });
    const build = veFeadBuildSystem(ex.nodes);
    const h = fead.veFeadModelTable(build);
    expect(h).toMatch(/Tasarım gerginliği \(türetildi\)/);
    expect(h).toContain(Math.round(build.springTensionN).toString());
    expect(h).toMatch(/yay dengesinden/);
  });
});

// ════════════════════════════════════════════════════════════════════════════
//  GERGİ PANELİ — PİVOT ARTIK SORULMUYOR (kullanıcı kararı, 2026-08-25)
// ════════════════════════════════════════════════════════════════════════════
describe('gergi paneli: avara hareketi montaj konumundan tanımlanır', () => {
  const ten = (d) => kasnak('fead-tensioner', d);

  test('avara merkezi bir GİRDİ DEĞİL — panel onu okuma olarak basıyor', () => {
    const html = fead.getFeadTensionerPropertiesHTML(ten({
      od: 75, cenX: -161.97, cenY: 91.29, armLen: 90, armMeanDeg: -11.9992,
      preload: 8.6, kArm: 0.48, meanLoad: 22.07,
    }));
    expect(html).toMatch(/Avara Hareketi/);
    expect(html).toMatch(/montaj konumu \(türedi\)/);
    expect(html).not.toMatch(/NaN/);
  });

  test('kol boyu yine SORULUR — parçanın verisi', () => {
    const html = fead.getFeadTensionerPropertiesHTML(ten({
      od: 75, cenX: -161.97, cenY: 91.29, armLen: 90, armMeanDeg: -11.9992,
      preload: 8.6, kArm: 0.48, meanLoad: 22.07,
    }));
    expect(html).toMatch(/veFeadSet\('[^']+','armLen'/);
  });
});

// ── ÇALIŞMA ÇEVRİMİ PANELDE DE BOŞ AÇILMAZ (2026-08-31) ────────────────────
//
// Kullanıcı sihirbazı işaret etti ama kusur asıl modelin yaşadığı yerde de
// vardı: Çözücü paneli `duty: []` ile açılıyor ve "Henüz devir noktası yok."
// diyordu. İki yüzey AYNI kütüphaneden besleniyor — ayrı listeler tutsalardı
// kullanıcı sihirbazda seçtiği çevrimi panelde bulamazdı.
describe('çözücü paneli — çalışma çevrimi', () => {
  const cozucu = (data) => ({ id: 'slv1', type: 'fead-solver', data: data || {} });

  test('BOŞ tablo tohumlanıyor ve hangi kayıt olduğu YAZILIYOR', () => {
    const n = cozucu();
    expect(fead.veFeadDutySeed(n)).toBe(true);
    expect(n.data.duty.length).toBeGreaterThan(0);
    expect(n.data.dutyLib).toBe(VE_FEAD_DUTY_DEFAULT);
    expect(veFeadDutyMatch(n.data.duty)).toBe(VE_FEAD_DUTY_DEFAULT);
  });

  test('DOLU tabloya DOKUNULMUYOR — kaydedilmiş proje birebir korunur', () => {
    const kendi = [{ rpm: 950, dcPct: 100, degC: 85, kw: { x: 2 } }];
    const n = cozucu({ duty: kendi.map((r) => Object.assign({}, r)) });
    fead.veFeadDutySeed(n);
    expect(n.data.duty.length).toBe(1);
    expect(n.data.duty[0].rpm).toBe(950);
    expect(n.data.duty[0].degC).toBe(85);
  });

  test('TEK SEFERLİK: kullanıcı satırları silerse geri gelmiyor', () => {
    // Bayrak olmasaydı, bilerek boşaltılan tablo her panel açılışında dolardı.
    const n = cozucu();
    fead.veFeadDutySeed(n);
    n.data.duty = [];
    expect(fead.veFeadDutySeed(n)).toBe(false);
    expect(n.data.duty.length).toBe(0);
  });

  test('kütüphaneden çevrim uygulanıyor ve kW devri tutan satırda KORUNUYOR', () => {
    global.nodes = [cozucu({ duty: [{ rpm: 2000, dcPct: 100, degC: 90, kw: { alt: 3.9 } }],
                             dutySeeded: true })];
    fead.veFeadDutyLib('slv1', 'AG00686-6');
    const d = global.nodes[0].data;
    expect(d.duty.map((r) => r.rpm)).toEqual([800, 1000, 1250, 1500, 1750, 2000]);
    expect(d.dutyLib).toBe('AG00686-6');
    expect(d.duty.find((r) => r.rpm === 2000).kw.alt).toBe(3.9);   // taşındı
    expect(d.duty.find((r) => r.rpm === 800).kw).toEqual({});      // uydurulmadı
  });

  test('panelde ÇEVRİM SEÇİCİ basılıyor ve yüklü kaydı gösteriyor', () => {
    global.nodes = [cozucu()];
    const h = fead.getFeadSolverPropertiesHTML(global.nodes[0]);
    expect(h).toContain('Çevrim kaydı');
    expect(h).toContain('veFeadDutyLib(');
    const rec = veFeadDutyOf(VE_FEAD_DUTY_DEFAULT);
    expect(h).toContain('value="' + rec.key + '" selected');
    // ...ve tablo artık "Henüz devir noktası yok." demiyor.
    expect(h).not.toContain('Henüz devir noktası yok');
  });

  test('elle düzenlenmiş tablo seçicide ÖZEL diyor', () => {
    global.nodes = [cozucu({ duty: [{ rpm: 1234, dcPct: 100, degC: 90, kw: {} }],
                             dutySeeded: true })];
    const h = fead.getFeadSolverPropertiesHTML(global.nodes[0]);
    expect(h).toContain('özel (elle düzenlendi)');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
//  BİR KULLANICI EYLEMİ = BİR GERİ-AL ADIMI
// ═══════════════════════════════════════════════════════════════════════════
//
// KULLANICI BİLDİRİMİ (2026-09-09): *"CTRL Z komutunu kullandığımda tablo
// siliniyor. Yani boş bir hale geliyor. Hata veriyor, garip oluyor."*
//
// `createNode` her düğümde `saveState()` çağırıyor — tek düğüm eklerken doğru.
// Ama bu kurucular ONİKİ düğüm kuruyor ve sarılmazlarsa yığına onüç ayrı adım
// yazıyorlar: Ctrl+Z modeli düğüm düğüm SÖKÜYOR. ÖLÇÜLDÜ (gerçek tarayıcı,
// AG00976): 12. basışta Kayış Tablosu boşalıyor, 13.'te kart tamamen gidiyor,
// 15.'te yığın tükenip "Geri alınacak işlem yok" uyarısı çıkıyordu — yani üç
// belirtinin üçü de tek sebepten.
//
// Adım SAYISININ kendisi state.js'de ölçülüyor (veStateBatch). Buradaki kapı
// başka bir şeyi tutuyor ve o olmadan mekanizmanın hiçbir değeri yok:
// KURUCULARIN O MEKANİZMADAN GEÇTİĞİNİ.
describe('kurucular TEK geri-al adımı bırakıyor', () => {
  const kur = () => {
    document.body.innerHTML = '<div id="ve-canvas"></div>';
    global.nodes = []; global.connections = [];
    const iz = { sarma: 0, derinlik: 0, disarida: [], kurulan: 0 };
    global.veStateBatchActive = () => iz.derinlik > 0;
    global.veStateBatch = (fn) => {
      iz.sarma++; iz.derinlik++;
      try { return fn(); } finally { iz.derinlik--; }
    };
    global.veStateResetBaseline = () => { iz.taban = true; return true; };
    let k = 0;
    global.createNode = (type, x, y) => {
      const d = componentDefs[type] || {};
      if (d.maxInstances && global.nodes.filter((n) => n.type === type).length >= d.maxInstances)
        return null;
      iz.kurulan++;
      if (iz.derinlik === 0) iz.disarida.push(type);   // sarmalın DIŞINDA kuruldu
      const n = { id: 'cv' + ++k, type, def: d, x, y,
                  width: d.defaultWidth || 65, height: d.defaultHeight || 60, data: {} };
      global.nodes.push(n);
      return n;
    };
    return iz;
  };
  const sok = () => {
    delete global.createNode; delete global.veStateBatch;
    delete global.veStateBatchActive; delete global.veStateResetBaseline;
  };

  test('veFeadLoadExample: onbir düğümün TAMAMI tek sarmalın içinde', () => {
    const iz = kur();
    fead.veFeadLoadExample('AG00976_GATES_2025');
    sok();
    expect(iz.sarma).toBe(1);
    expect(iz.kurulan).toBeGreaterThanOrEqual(11);
    // Bir düğüm bile dışarıda kurulsaydı o kendi geri-al adımını yazardı ve
    // Ctrl+Z eylemin ortasında bir yere düşerdi.
    expect(iz.disarida).toEqual([]);
  });

  test('veFeadPopulateStarter: sarmal + AÇILIŞ DURUMU YIĞININ TABANI', () => {
    const iz = kur();
    fead.veFeadPopulateStarter();
    sok();
    expect(iz.sarma).toBe(1);
    expect(iz.disarida).toEqual([]);
    // Modüle girip araçları almak bir DÜZENLEME değil. Adım olsaydı Ctrl+Z
    // kullanıcıyı boş bir kanvasa düşürürdü: ne tablo, ne sihirbaz, ne örnek —
    // ve dönüşün tek yolu Ctrl+Y olurdu.
    expect(iz.taban).toBe(true);
  });

  test('İÇ İÇE kurucu ikinci kez SARMIYOR (sayaç bayrağa düşmesin)', () => {
    const iz = kur();
    global.veStateBatch(() => { fead.veFeadPopulateStarter(); });
    sok();
    // Dışarıda zaten bir sarmal açıkken kurucu kendi sarmalını açmıyor:
    // açsaydı içteki biterken `veStateResetBaseline` DIŞ kurulumun ortasında
    // yığını sıfırlardı.
    expect(iz.sarma).toBe(1);
    expect(iz.taban).toBeUndefined();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
//  BOŞ BİR FEAD TOPOLOJİSİ SİHİRBAZLA KARŞILAR
// ═══════════════════════════════════════════════════════════════════════════
//
// Kullanıcı isteği (2026-09-09): *"FEAD modülünü ana topoloji kısmından
// açtığım zaman, direkt karşıma 'Başlangıç Sihirbazı' bileşeninin gelmesini
// istiyorum."* Eskiden karşılayan şey BOŞ bir Kayış Tablosuydu: doldurulacak
// hiçbir satırı yok, ne yapılacağını da söylemiyordu.
describe('FEAD editörü açılışı', () => {
  const kabuk = () => {
    document.body.innerHTML = '<div id="ve-canvas"></div>';
    global.nodes = []; global.connections = [];
    const iz = { wiz: 0, yuklenen: [] };
    global.veSerializeCurrentState = () => ({ nodes: [], connections: [] });
    global.veClearCanvasDOM = () => {};
    global.veLoadTabState = (o) => { iz.yuklenen.push(o && o.state ? 'kayıt' : 'boş'); };
    // Sahte olan yalnız MODALI AÇAN çağrı; `veFeadWizOpenAny`nin kendisi
    // gerçek koşuyor (sihirbaz düğümünü bulma/kurma yolu da ölçülsün).
    global.veFeadWizOpen = (id) => { iz.wiz++; iz.wizId = id; return true; };
    let k = 0;
    global.createNode = (type, x, y) => {
      const d = componentDefs[type] || {};
      if (d.maxInstances && global.nodes.filter((n) => n.type === type).length >= d.maxInstances)
        return null;
      const n = { id: 'oe' + ++k, type, def: d, x, y, data: {} };
      global.nodes.push(n); return n;
    };
    return iz;
  };
  const sok = () => {
    ['veSerializeCurrentState', 'veClearCanvasDOM', 'veLoadTabState',
     'veFeadWizOpen', 'createNode'].forEach((k) => { delete global[k]; });
  };

  test('KAYITSIZ topolojiye girince sihirbaz AÇILIR', () => {
    const iz = kabuk();
    global.nodes = [{ id: 'fa1', type: 'fead-analysis', data: {} }];
    fead.veFeadOpenEditor('fa1');
    sok();
    expect(iz.yuklenen).toEqual(['boş']);
    expect(iz.wiz).toBe(1);
    // Açılış yüzeyi de kuruldu: sihirbazı kapatan kullanıcı boş bir kanvasa
    // düşmesin — bu bir kapı değil bir karşılama.
    expect(global.nodes.filter((n) => n.type === 'fead-wizard').length).toBe(1);
    expect(global.nodes.filter((n) => n.type === 'fead-table').length).toBe(1);
    // Ve açılan sihirbaz KANVASTAKİ düğümün kendisi — ikinci bir kopya
    // kurulmuyor (düğüm kullanıcının yarım bıraktığı formu taşıyor).
    expect(iz.wizId).toBe(global.nodes.filter((n) => n.type === 'fead-wizard')[0].id);
  });

  test('KURULMUŞ bir modele dönerken sihirbaz AÇILMAZ', () => {
    const iz = kabuk();
    // Her girişte kapatılması gereken bir pencereyle karşılamak, karşılamayı
    // engele çevirirdi.
    global.nodes = [{ id: 'fa2', type: 'fead-analysis',
      data: { subTopology: { nodes: [{ id: 'x', type: 'fead-crank', data: {} }],
                             connections: [] } } }];
    fead.veFeadOpenEditor('fa2');
    sok();
    expect(iz.yuklenen).toEqual(['kayıt']);
    expect(iz.wiz).toBe(0);
  });

  test('GÖRÜNMEZ geri-giriş (_silent) sihirbaz AÇMAZ', () => {
    const iz = kabuk();
    // autosave köke çöküp kullanıcıyı iç topolojiye geri getiriyor; orada
    // kullanıcı FEAD'e "girmiyor" bile.
    global.nodes = [{ id: 'fa3', type: 'fead-analysis', data: {} }];
    fead.veFeadOpenEditor('fa3', true);
    sok();
    expect(iz.wiz).toBe(0);
  });
});

// ── "BAŞLANGIÇ VE ÖRNEKLER" KALDIRILDI — NEGATİF KAPI ─────────────────────
// Kullanıcı isteği (2026-09-09): *"'Başlangıç ve Örnekler' bileşenini de
// oradan kaldıralım. Gerek yok."* Sunduğu iki şey (sihirbaz düğmesi + örnek
// listesi) sihirbazın 1. adımında zaten vardı.
//
// Kapı BEŞ YÜZEYE birden bakıyor, çünkü bir bileşen beş yerden asılı ve biri
// unutulursa hata SESSİZ: palette duran ama tanımı olmayan bir kutu hiçbir şey
// kurmaz, tanımı olup paneli olmayan bir düğüm boş panel açar.
describe('"Başlangıç ve Örnekler" bileşeni kaldırıldı', () => {
  const fs = require('fs');
  const path = require('path');
  const oku = (f) => fs.readFileSync(path.join(__dirname, '../../', f), 'utf8');

  test('kayıt defteri · palet · panel dağıtımı · açılış yerleşimi — beşi de temiz', () => {
    expect(componentDefs['fead-example']).toBeUndefined();
    Object.keys(VE_MODULES).forEach((m) => {
      expect((VE_MODULES[m].components) || []).not.toContain('fead-example');
    });
    expect(oku('index.html')).not.toContain('fead-example');
    expect(oku('js/cp-core.js')).not.toContain('fead-example');
    expect(fead.VE_FEAD_STARTER_LAYOUT.map((it) => it.type)).not.toContain('fead-example');
    expect(fead.getFeadExamplePropertiesHTML).toBeUndefined();
  });

  test('örnek KURUCUSU duruyor — sihirbazın "Modeli Kur"u ile aynı işi yapan yol', () => {
    // Kaldırılan şey bileşendi, yetenek değil: `veFeadLoadExample` testlerin
    // kanonik model kurucusu ve sihirbazın kurulum yolunun aynadaki eşi.
    expect(typeof fead.veFeadLoadExample).toBe('function');
  });
});
