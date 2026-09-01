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

  test('avara merkezi ve kol çalışma açısı sorulur', () => {
    const html = fead.getFeadTensionerPropertiesHTML(tam());
    expect(html).toMatch(/veFeadSet\('[^']+','cenX'/);
    expect(html).toMatch(/veFeadSet\('[^']+','cenY'/);
    expect(html).toMatch(/veFeadSet\('[^']+','armMeanDeg'/);
    expect(html).toMatch(/Avara Kasnağının Merkezi/);
    expect(html).toMatch(/veFeadSet\('[^']+','meanLoad'/);
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

describe('veFeadArrangeByCoords — kasnaklar KOORDİNATLARINA yerleşir', () => {
  // SÖZLEŞME DEĞİŞTİ. Bu yerleştirici eskiden kasnakları bir HALKAYA diziyordu
  // ve o zaman doğruydu: kanvastaki konum hiçbir şey ifade etmiyordu. Artık
  // konum FİZİKSEL (1 px = 1 mm) — halkaya dizmek kullanıcının girdiği bütün
  // mm koordinatlarını SİLMEK olurdu, yani "düzenle" düğmesi modeli bozardı.
  const kur = (koord, ekTip) => {
    const tipler = ['fead-crank', 'fead-alternator', 'fead-idler', 'fead-ac',
                    'fead-waterpump', 'fead-idler'];
    const ns = koord.map((c, i) => {
      const t = tipler[i % tipler.length];
      const d = componentDefs[t];
      return { id: 'r' + i, type: t, def: d, x: 0, y: 0,
               width: d.defaultWidth || 65, height: d.defaultHeight || 60,
               data: Object.assign({ od: 80 }, c, i === 0 ? { driver: true } : {}) };
    });
    (ekTip || []).forEach((t, i) => {
      const d = componentDefs[t];
      ns.push({ id: 'a' + i, type: t, def: d, x: 0, y: 0,
                width: d.defaultWidth || 65, height: d.defaultHeight || 60, data: {} });
    });
    global.nodes = ns;
    global.connections = [];
    for (let i = 0; i < koord.length; i++)
      global.connections.push({ id: 'c' + i, from: 'r' + i, to: 'r' + ((i + 1) % koord.length),
                                fromPort: 'output', toPort: 'input' });
    return ns;
  };
  const merkez = (nd) => ({ x: nd.x + nd.width / 2, y: nd.y + nd.height / 2 });

  beforeEach(() => {
    document.body.innerHTML = '<div id="ve-canvas"></div>';
    global.updateAllConnections = jest.fn();
  });

  // D1 KAPISI — ÖLÇÜLMÜŞ BİR SESSİZ KUSURDU.
  // Yerleştirici gergi için KOŞULSUZ `cenX/cenY` okuyordu; zarf kipinde o
  // alanlar hiç yazılmıyor, dolayısıyla gergi "koordinatı olmayan kasnak"
  // sayılıp kümenin ALTINA diziliyordu. ÖLÇÜLDÜ (AG00976, zarf kipi): gergi
  // kutusu en alttaki kasnaktan 147 px aşağıda, kümenin ortalamasından 343 px
  // sapmış. Ve `veFeadDragTensioner` zarf kipinde mm'yi MUTLAK yazdığı için
  // sonraki İLK sürükleme o kaymanın tamamını pivota yazardı.
  //
  // Karar TEK YERDE (veFeadTensionerBoxMm, fead-model.js); kapı ÜRETİLEN
  // YERLEŞİMİ ölçüyor — okuyucuyu doğrudan çağırmak, yerleştiricinin onu
  // kullanmayı BIRAKMASINI göremezdi.
  test('gergi kümenin İÇİNE yerleşir (montaj konumundan)', () => {
    const kurGergi = (kip) => {
      const tipler = ['fead-crank', 'fead-alternator', 'fead-idler'];
      const koord = [{ x: 0, y: 0 }, { x: -281, y: 259.5 }, { x: 130, y: 140 }];
      const ns = koord.map((c, i) => {
        const t = tipler[i], d = componentDefs[t];
        return { id: 'r' + i, type: t, def: d, x: 0, y: 0,
                 width: d.defaultWidth, height: d.defaultHeight,
                 data: Object.assign({ od: 80 }, c, i === 0 ? { driver: true } : {}) };
      });
      const dt = componentDefs['fead-tensioner'];
      const td = { od: 75, armLen: 90, preload: 8.6, kArm: 0.48, meanLoad: 22.07,
                   cenX: -161.97, cenY: 91.29, armMeanDeg: -11.9992 };
      ns.push({ id: 't', type: 'fead-tensioner', def: dt, x: 0, y: 0,
                width: dt.defaultWidth, height: dt.defaultHeight, data: td });
      global.nodes = ns; global.connections = [];
      for (let i = 0; i < ns.length; i++)
        global.connections.push({ id: 'c' + i, from: ns[i].id,
          to: ns[(i + 1) % ns.length].id, fromPort: 'output', toPort: 'input' });
      return ns;
    };
    ['a', 'b'].forEach((kip) => {
      const ns = kurGergi(kip);
      expect(fead.veFeadArrangeByCoords({ silent: true })).toBe(true);
      const t = ns[ns.length - 1];
      const tm = merkez(t);
      const digerleri = ns.slice(0, 3).map(merkez);
      const enAlt = Math.max(...digerleri.map((p) => p.y));
      // Kümenin altındaki "koordinatı yok" sırasına DÜŞMEMELİ.
      expect(tm.y).toBeLessThan(enAlt);
      // Ve gerçekten kendi mm noktasında olmalı: krank orijin, Y ters.
      const om = merkez(ns[0]);
      const bek = { x: -161.97, y: 91.29 };   // kutu AVARA MERKEZİNİ gösterir
      expect(tm.x - om.x).toBeCloseTo(bek.x, 0);
      expect(tm.y - om.y).toBeCloseTo(-bek.y, 0);
    });
  });

  test('kanvas mesafesi mm mesafesine EŞİT (1 px = 1 mm)', () => {
    const ns = kur([{ x: 0, y: 0 }, { x: 200, y: 0 }, { x: 0, y: 150 }]);
    expect(fead.veFeadArrangeByCoords()).toBe(true);
    const a = merkez(ns[0]), b = merkez(ns[1]), c = merkez(ns[2]);
    expect(b.x - a.x).toBeCloseTo(200, 0);
    expect(c.y - a.y).toBeCloseTo(-150, 0);      // ← Y TERS
  });

  // Y ekseninin ters olması bu modülün en sessiz tuzağı: kanvasta y aşağı,
  // kayış düzleminde yukarı. Ters yazılsaydı bütün topoloji AYNALANIRDI.
  test('Y EKSENİ TERS — mm yukarı, kanvas aşağı', () => {
    const ns = kur([{ x: 0, y: 0 }, { x: 0, y: 300 }]);
    fead.veFeadArrangeByCoords();
    expect(merkez(ns[1]).y).toBeLessThan(merkez(ns[0]).y);
  });

  test('küme görünür alanda ORTALANIR — orijin kenardaysa bile', () => {
    // BMC'de krank kümenin kenarında (X −281…+184); orijini doğrudan merkeze
    // koymak her şeyi bir yana yığardı.
    const ns = kur([{ x: 0, y: 0 }, { x: 400, y: 0 }, { x: 800, y: 0 }]);
    fead.veFeadArrangeByCoords();
    const xs = ns.map((n) => merkez(n).x);
    expect((Math.min(...xs) + Math.max(...xs)) / 2).toBeCloseTo(3000, 0);
  });

  test('koordinatı OLMAYAN kasnak gizlenmez, kümenin altına dizilir', () => {
    const ns = kur([{ x: 0, y: 0 }, { x: 200, y: 0 }, {}]);
    expect(fead.veFeadArrangeByCoords()).toBe(true);
    const yok = ns[2];
    expect(Number.isFinite(yok.x)).toBe(true);
    expect(merkez(yok).y).toBeGreaterThan(merkez(ns[0]).y);
    // ve üst üste binmiyor (sessizce (0,0)'a konsaydı çakışırdı)
    expect(Math.abs(merkez(yok).x - merkez(ns[0]).x)
         + Math.abs(merkez(yok).y - merkez(ns[0]).y)).toBeGreaterThan(20);
  });

  test('araç düğümleri kümenin DIŞINDA; Kayış Yolu kartı sağ şeritte', () => {
    const ns = kur([{ x: 0, y: 0 }, { x: 300, y: 0 }, { x: 0, y: 300 }],
                   ['fead-solver', 'fead-layout']);
    fead.veFeadArrangeByCoords();
    const kasnak = ns.slice(0, 3).map((n) => merkez(n).x);
    const solver = ns.find((n) => n.type === 'fead-solver');
    const layout = ns.find((n) => n.type === 'fead-layout');
    expect(merkez(solver).x).toBeLessThan(Math.min(...kasnak));
    expect(merkez(layout).x).toBeGreaterThan(Math.max(...kasnak));
  });

  // ── GERGİ KUTUSU: KİP BAŞINA BAŞKA BİR NOKTA ────────────────────────────
  //
  // ÖLÇÜLMÜŞ SESSİZLİK: bu yerleştirici gergiyi doğrudan `cenX/cenY`den
  // okuyordu, oysa zarf kipinde o alan HİÇ yazılmıyor (kasnak merkezi bir
  // çıktı). Sonuç: gergi "koordinatı yok" sayılıp kümenin ALTINA diziliyor ve
  // uyarı toast'ı basılıyordu — AG00976'da kutu 2857,4/3039,0 yerine
  // 2971,0/3277,3. Oysa alt topoloji açılışındaki yol
  // (veFeadSyncCanvasFromMm) onu PİVOTA oturtuyordu: iki yerleştirme yolu
  // birbirinden habersizdi ve kutu ilk açılışta yerinden zıplıyordu.
  const gergili = (tenData) => {
    const mk = (id, type, data) => {
      const d = componentDefs[type];
      return { id, type, def: d, x: 0, y: 0,
               width: d.defaultWidth || 65, height: d.defaultHeight || 60, data };
    };
    const ns = [
      mk('g0', 'fead-crank',      { driver: true, od: 180, x: 0, y: 0 }),
      mk('g1', 'fead-alternator', { od: 57, x: -280, y: 60 }),
      mk('g2', 'fead-idler',      { od: 70, x: -150, y: 150 }),
      mk('g3', 'fead-tensioner',  tenData)
    ];
    global.nodes = ns;
    global.connections = ns.map((n, i) => ({ id: 'gc' + i, from: n.id,
      to: ns[(i + 1) % ns.length].id, fromPort: 'output', toPort: 'input' }));
    return ns;
  };
  // Kutunun mm karşılığı: orijin (sürücü) kutusunun merkezine göre, Y TERS.
  const mmOf = (ns, nd) => ({ x: merkez(nd).x - merkez(ns[0]).x,
                              y: -(merkez(nd).y - merkez(ns[0]).y) });

  test('gergi kutusu AVARA MERKEZİNİ gösterir', () => {
    const ns = gergili({ od: 75, armLen: 90,
                         cenX: -161.97, cenY: 91.29, armMeanDeg: -11.9992,
                         preload: 8.6, kArm: 0.48, meanLoad: 22.07 });
    expect(fead.veFeadArrangeByCoords()).toBe(true);
    const mm = mmOf(ns, ns[3]);
    expect(mm.x).toBeCloseTo(-161.97, 1);
    expect(mm.y).toBeCloseTo(91.29, 1);
    // "koordinatı yok" sırasına DÜŞMEDİ: uyarı basılmıyor.
    const toast = stubs.showToast.mock.calls.map((c) => String(c[0])).join(' | ');
    expect(toast).not.toContain('koordinatı yok');
  });

  test('İKİ YERLEŞTİRME YOLU AYNI YERE KOYAR — sync tek kutuyu bile oynatmaz', () => {
    // Asıl kapı bu: "Otomatik Düzenle" ile alt topoloji açılışı aynı noktayı
    // kullanmak ZORUNDA. Ayrıştıklarında hata sessiz — kullanıcı düzenler,
    // kapatıp açar, kutu yerinden zıplar.
    [{ od: 75, armLen: 90, cenX: -161.97, cenY: 91.29,
       armMeanDeg: -11.9992, preload: 8.6, kArm: 0.48, meanLoad: 22.07 },
     { od: 75, armLen: 90, cenX: -161.97, cenY: 91.29,
       preload: 8.6, kArm: 0.48, meanLoad: 22.07 }].forEach((td) => {
      const ns = gergili(td);
      fead.veFeadArrangeByCoords({ silent: true });
      const once = ns.map((n) => [n.x, n.y]);
      expect(veFeadSyncCanvasFromMm(ns)).toBe(0);
      ns.forEach((n, i) => {
        expect(n.x).toBeCloseTo(once[i][0], 6);
        expect(n.y).toBeCloseTo(once[i][1], 6);
      });
    });
  });

  test('kipin girdisi eksikse gergi yine gizlenmez — kümenin altına dizilir', () => {
    // Zarf kipinde pivot yoksa okunacak nokta YOKTUR; sessizce (0,0)'a koymak
    // kasnakları üst üste bindirirdi (koordinatsız kasnak kuralının aynısı).
    const ns = gergili({ od: 75, angleMode: 'envelope', armLen: 90 });
    expect(fead.veFeadArrangeByCoords()).toBe(true);
    expect(Number.isFinite(ns[3].x)).toBe(true);
    expect(merkez(ns[3]).y).toBeGreaterThan(merkez(ns[0]).y);
    const toast = stubs.showToast.mock.calls.map((c) => String(c[0])).join(' | ');
    expect(toast).toContain('koordinatı yok');
  });

  test('orijin YOKSA ya da iki kasnaktan az varsa düzen KURULMAZ', () => {
    kur([{ x: 0, y: 0 }]);
    expect(fead.veFeadArrangeByCoords()).toBe(false);
    global.nodes = []; global.connections = [];
    expect(fead.veFeadArrangeByCoords()).toBe(false);
  });

  // Yerleştirici KOORDİNAT YAZMAZ — yalnız kutuları yerine koyar. Yazsaydı
  // "düzenle" düğmesi modeli sessizce değiştirirdi.
  test('koordinatlara DOKUNMAZ, yalnız kutuları taşır', () => {
    const ns = kur([{ x: 0, y: 0 }, { x: 250, y: -80 }]);
    const once = ns.map((n) => JSON.stringify(n.data));
    fead.veFeadArrangeByCoords();
    expect(ns.map((n) => JSON.stringify(n.data))).toEqual(once);
  });

  // SESSİZ KİP — örnek kurucusu buradan geçiyor ve kendi saveState'ini,
  // kendi toast'ını, kendi kamerasını kullanıyor. Bayrak yutulursa kullanıcı
  // tek bir "örnek kuruldu" yerine üst üste iki bildirim görür ve tek bir
  // "geri al" örneği kaldırmaz (undo yığınında iki adım kalır).
  test('silent: saveState ve toast ÇAĞRILMAZ, yerleştirme yine yapılır', () => {
    const ns = kur([{ x: 0, y: 0 }, { x: 200, y: 0 }]);
    global.saveState.mockClear(); global.showToast.mockClear();
    expect(fead.veFeadArrangeByCoords({ silent: true })).toBe(true);
    expect(global.saveState).not.toHaveBeenCalled();
    expect(global.showToast).not.toHaveBeenCalled();
    expect(merkez(ns[1]).x - merkez(ns[0]).x).toBeCloseTo(200, 6);
  });

  // TAM SAYIYA YUVARLAMA KUANTALARDI. 1 px = 1 mm olduğu için Math.round
  // koordinatı 1 mm'ye oturtur; ölçüldü, alternatörün 1 mm'si gerginliği
  // 38.6 N (%5.9) değiştiriyor ve gergi kol boyu kapısının toleransı 0.5 mm.
  test('kutu konumu 1 mm\'ye KUANTALANMAZ (kesirli mm korunur)', () => {
    const ns = kur([{ x: 0, y: 0 }, { x: 130.08, y: 139.92 }]);
    fead.veFeadArrangeByCoords();
    expect(merkez(ns[1]).x - merkez(ns[0]).x).toBeCloseTo(130.08, 1);
    expect(merkez(ns[1]).y - merkez(ns[0]).y).toBeCloseTo(-139.92, 1);
  });

  test('veTidyLayout FEAD topolojisinde koordinat yerleştiricisine devreder', () => {
    kur([{ x: 0, y: 0 }, { x: 200, y: 0 }]);
    eval(loadSource('tidy-layout.js'));
    global.veFeadArrangeByCoords = jest.fn(() => true);
    veTidyLayout();
    expect(global.veFeadArrangeByCoords).toHaveBeenCalled();
    global.veFeadArrangeByCoords.mockClear();
    // Kasnaksız topolojide genel yerleştirici çalışmalı
    global.nodes = [{ id: 'x', type: 'engine', def: componentDefs['engine'] || {}, x: 0, y: 0, data: {} }];
    global.connections = [];
    veTidyLayout();
    expect(global.veFeadArrangeByCoords).not.toHaveBeenCalled();
    delete global.veFeadArrangeByCoords;
  });
});

// ════════════════════════════════════════════════════════════════════════════
//  ÖRNEK KURULUNCA KANVAS İLE mm AYNI ŞEYİ SÖYLER
// ════════════════════════════════════════════════════════════════════════════
//
// Kanvas artık KAYIŞ DÜZLEMİ; kutunun yeri bir görünüm tercihi değil, düğümün
// taşıdığı mm koordinatının ta kendisi. Örnek kurucusu bunu bir dönem
// YALANLIYORDU: kümeyi 520×400'lük bir kutuya sığdıran kendi ölçeğini
// (BMC'de ×1.1178) kullanıyor ve kutuları köşe koordinatıyla diziyordu.
//
// ÖLÇÜLDÜ (gerçek tarayıcı, BMC, HİÇ SÜRÜKLEMEDEN önce):
//   alternatör merkezi − krank merkezi = −319.108 px
//   alternatör mm koordinatı           = −281.000 mm   →  38.108 mm FARK
//
// Sessizliğin sebebi: hata ancak İLK SÜRÜKLEMEDE ortaya çıkıyor.
// veFeadSyncMmFromCanvas kanvası okuyup mm'yi tazelediği için o 38.108 mm
// koordinatın üstüne biniyor — kullanıcı 60 px sürüklüyor, model 98 mm
// oynuyor ve kayış boyu bir anda hiç istenmeyen bir yere gidiyor.
describe('veFeadLoadExample — kutu konumu mm koordinatını YALANLAMAZ', () => {
  const kurExample = (key) => {
    document.body.innerHTML = '<div id="ve-canvas"></div><div id="ve-canvas-wrapper"></div>';
    global.nodes = []; global.connections = [];
    let k = 0;
    // Gerçek createNode DOM kurar ve tip tanımlarına bakar; burada sınanan şey
    // KONUM aritmetiği, o yüzden düğüm kabuğu yeter. def GERÇEK tanımdan gelir:
    // kutu genişliği hatanın bir parçasıydı ((54−72)/2 = −5 px).
    global.createNode = (type, x, y) => {
      const d = componentDefs[type] || {};
      const n = { id: 'ex' + ++k, type, def: d, x, y,
                  width: d.defaultWidth || 65, height: d.defaultHeight || 60, data: {} };
      global.nodes.push(n);
      return n;
    };
    global.createConnection = (from, to) =>
      global.connections.push({ id: 'c' + global.connections.length, from, to,
                               fromPort: 'output', toPort: 'input' });
    const out = fead.veFeadLoadExample(key);
    delete global.createNode; delete global.createConnection;
    return out;
  };
  const merkez = (n) => ({ x: n.x + n.width / 2, y: n.y + n.height / 2 });

  // ── ÖRNEK "KULLANIMA HAZIR" GELİR: BAŞLANGIÇ GİDER, RAPOR KALIR ─────────
  //
  // Kullanıcı isteği (2026-08-26): örnek kurulduktan sonra "Başlangıç ve
  // Örnekler" kutusu kanvasta kalmasın, "Rapor" kutusu ise Çözücü'nün altında
  // dursun. İkisi de bir SÖZLEŞME: biri açılış yüzeyi ve işini bitiriyor,
  // öbürü örneğin eksik kalan halkası (kullanıcı raporu almak için bileşeni
  // paletten ayrıca aramak zorunda kalıyordu).
  test('örnek kurulunca "Başlangıç ve Örnekler" düğümü KALMAZ', () => {
    // Örnekten ÖNCE starter kutusu kanvasta duruyor (veFeadPopulateStarter'ın
    // koyduğu düğümü taklit ediyoruz; kurExample global.nodes'u sıfırlıyor,
    // o yüzden createNode kancasını kurup starter'ı ONUNLA ekliyoruz).
    const eskiKur = fead.veFeadLoadExample;
    document.body.innerHTML = '<div id="ve-canvas"></div><div id="ve-canvas-wrapper"></div>';
    global.nodes = []; global.connections = [];
    let k = 0;
    global.createNode = (type, x, y) => {
      const d = componentDefs[type] || {};
      const n = { id: 'ex' + ++k, type, def: d, x, y,
                  width: d.defaultWidth || 65, height: d.defaultHeight || 60, data: {} };
      global.nodes.push(n); return n;
    };
    global.createConnection = (from, to) =>
      global.connections.push({ id: 'c' + global.connections.length, from, to,
                                fromPort: 'output', toPort: 'input' });
    createNode('fead-example', 100, 100);
    expect(global.nodes.filter((n) => n.type === 'fead-example').length).toBe(1);

    expect(eskiKur('BMC_FEAD_2026')).toBeTruthy();
    expect(global.nodes.filter((n) => n.type === 'fead-example').length).toBe(0);
    delete global.createNode; delete global.createConnection;
  });

  test('örnek "Rapor" düğümünü de kurar', () => {
    expect(kurExample('BMC_FEAD_2026')).toBeTruthy();
    expect(global.nodes.filter((n) => n.type === 'fead-report').length).toBe(1);
  });

  // SOL ŞERİT SIRASI nodes dizisi sırasından geliyor (veFeadArrangeByCoords →
  // serit()). Rapor Çözücü'den ÖNCE push edilseydi şeritte de onun ÜSTÜNDE
  // çıkardı — sıra bir yerleşim ayrıntısı değil, veFeadExampleNodes'un push
  // sırasının gözlenebilir sonucu.
  test('sol şerit sırası: Kayış Özellikleri → Çözücü → Rapor', () => {
    expect(kurExample('BMC_FEAD_2026')).toBeTruthy();
    const sol = global.nodes
      .filter((n) => { const d = componentDefs[n.type] || {};
                       return d.isFeadBelt || d.isFeadSolver || d.isFeadReport || d.isFeadExample; })
      .slice().sort((a, b) => a.y - b.y)
      .map((n) => n.type);
    expect(sol).toEqual(['fead-belt', 'fead-solver', 'fead-report']);
    // ve hepsi kasnak kümesinin SOLUNDA (araç kutuları çizime girmez)
    const kasnakMinX = Math.min(...global.nodes.filter((n) => M._feadIsPulley(n)).map((n) => n.x));
    global.nodes.filter((n) => { const d = componentDefs[n.type] || {};
      return d.isFeadBelt || d.isFeadSolver || d.isFeadReport; })
      .forEach((n) => expect(n.x).toBeLessThan(kasnakMinX));
  });

  test('kayıtlı BÜTÜN örnekler Rapor düğümünü taşır', () => {
    Object.keys(M.VE_FEAD_EXAMPLES).forEach((key) => {
      const pack = M.veFeadExampleNodes(key);
      const tipler = pack.nodes.map((n) => n.type);
      expect(tipler).toContain('fead-report');
      expect(tipler).toContain('fead-layout');
      // Rapor, Çözücü'den SONRA
      expect(tipler.indexOf('fead-report')).toBeGreaterThan(tipler.indexOf('fead-solver'));
      // Rapor düğümü rapor TÜRÜ taşımaz → veFeadReportKind varsayılana ('detailed') düşer
      const rep = pack.nodes.find((n) => n.type === 'fead-report');
      expect(rep.data && rep.data.reportKind).toBeUndefined();
    });
  });

  test('BMC örneğinde HER kasnağın kutu merkezi mm koordinatına oturur', () => {
    expect(kurExample('BMC_FEAD_2026')).toBeTruthy();
    const kasnaklar = global.nodes.filter((n) => M._feadIsPulley(n));
    expect(kasnaklar.length).toBe(6);
    const org = M.veFeadOriginNode(global.nodes);
    expect(org).toBeTruthy();
    const o = merkez(org);
    let enBuyukSapma = 0;
    kasnaklar.forEach((n) => {
      const d = n.data || {};
      const mx = M._feadDefOf(n).isFeadTensioner ? d.cenX : d.x;
      const my = M._feadDefOf(n).isFeadTensioner ? d.cenY : d.y;
      if (!Number.isFinite(mx) || !Number.isFinite(my)) return;
      const c = merkez(n);
      enBuyukSapma = Math.max(enBuyukSapma,
        Math.abs((c.x - o.x) - mx), Math.abs((c.y - o.y) - (-my)));   // Y TERS
    });
    // Eski ölçekli yerleşimde bu sayı 38.108 idi.
    expect(enBuyukSapma).toBeLessThan(0.05);
  });

  // Asıl bedel burada ödeniyordu: mm zaten doğru duruyor, sürükleme onu
  // BOZUYORDU. Bir karelik sürüklemeyi birebir yeniden koşturuyoruz.
  test('İLK SÜRÜKLEME koordinatı KAYDIRMIYOR — sürüklenen kadar oynuyor', () => {
    kurExample('BMC_FEAD_2026');
    const alt = global.nodes.find((n) => n.type === 'fead-alternator');
    const once = alt.data.x;
    alt.x -= 60;                                   // kanvasta 60 px sola
    M.veFeadSyncMmFromCanvas(global.nodes);
    expect(alt.data.x).toBeCloseTo(once - 60, 2);  // ← eskiden −98.1 oynuyordu
  });

  test('kurulan her örnekte aynı kapı — kasnak sayısı ve bağlantılar da yerinde', () => {
    Object.keys(M.VE_FEAD_EXAMPLES).forEach((key) => {
      expect(kurExample(key)).toBeTruthy();
      const org = M.veFeadOriginNode(global.nodes);
      if (!org) return;
      const o = merkez(org);
      global.nodes.filter((n) => M._feadIsPulley(n)).forEach((n) => {
        const d = n.data || {};
        const mx = M._feadDefOf(n).isFeadTensioner ? d.cenX : d.x;
        const my = M._feadDefOf(n).isFeadTensioner ? d.cenY : d.y;
        if (!Number.isFinite(mx) || !Number.isFinite(my)) return;
        const c = merkez(n);
        expect(c.x - o.x).toBeCloseTo(mx, 1);
        expect(c.y - o.y).toBeCloseTo(-my, 1);
      });
    });
  });
});

// ════════════════════════════════════════════════════════════════════════════
//  TÜRETİLEN BOY, KOLUN NEREDE OTURDUĞUNU SÖYLEMEK ZORUNDA
// ════════════════════════════════════════════════════════════════════════════
//
// Serbest kipin cevabı "kol yayın ÇALIŞMA momentindeyken kayış yolu ne kadar"
// sorusunun cevabı. Kol oraya oturamadıysa çıkan sayı hâlâ bir sayıdır ama
// "tedarikçiye verilecek boy" DEĞİLDİR. İki hâl var, ikisi de eskiden
// sessizdi ve panel ikisinde de "Tedarikçiye verilecek boy budur" diyordu:
//
//   nominalFallback : künye eksik → kol aralığın ORTASINA düştü
//   atLimit         : nominal açı erişilemez → kol KENETLENDİ (+39.7 mm)
//
// Bu, modülün kendi kuralının ihlaliydi: geçerlilik sınırı sonucun İÇİNDE
// taşınır (bkz. B10 çap penceresi, tepe yük "KALİBRE DEĞİL" damgası).
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
    global.connections = global.connections.slice(0, 3);    // zincir kopuk
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
    const build = veFeadBuildSystem(ex.nodes, ex.connections);
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
