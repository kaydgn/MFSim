/**
 * fead-wizard.test.js — FEAD BAŞLANGIÇ SİHİRBAZI
 *
 * Kullanıcı isteği (2026-08-29): *"Bir 'Başlangıç Sihirbazı' bileşeni
 * kuracağız… adım adım bir modeli kurmak için gereken tüm girdileri
 * gireceğiz."*
 *
 * BU DOSYANIN KİLİTLEDİĞİ ASIL ŞEY: sihirbazın kendi model kurucusu YOK.
 * Durum → `veFeadWizNodes` → köprünün düğüm biçimi; önizleme de kurulum da
 * AYNI listeden geçiyor. İkinci bir kurucu yazmak, önizlemenin kanvasta çıkan
 * modelden sessizce ayrışması demekti — bu modülde defalarca ölçülmüş sınıf.
 *
 * En sıkı kapı bu yüzden bir EŞİTLİK: sihirbaz iki örneği de doldurup
 * çözdüğünde, örnek kurucusunun kendi yolundan çıkan sayıların BİREBİR aynısını
 * vermek zorunda (kol açısı, kayış boyu, tasarım gerginliği, dönüş yönü).
 */
const wiz = require('../../js/cp-fead-wizard.js');
const fead = require('../../js/cp-fead.js');
const M = require('../../js/fead-model.js');
const F = require('../../js/fead-core.js');
const fs = require('fs');
const path = require('path');

const stubs = stubGlobals();
document.body.innerHTML = '<div id="ve-canvas"></div>';
global.nodes = [];
global.connections = [];
eval(loadSource('components.js'));
// GLOBAL'E YAZILMASI ŞART: js/ modülleri `require` ile yüklendiğinde bare
// `componentDefs` referansı test dosyasının kapsamını DEĞİL global'i arar.
// Yazılmazsa hata ReferenceError olur — sessiz değil ama kurulum hatası.
global.componentDefs = componentDefs;
global.VE_MODULES = VE_MODULES;
// Aksesuar katalogları (Araç Performans modülüyle ORTAK kaynak) — sihirbazın
// "Aksesuar Modelleri" kartı bunları okuyor. Yüklenmezse kart "katalog yok"
// der ve preset kapıları DOĞRU SEBEPTEN DEĞİL, kütüphane eksik olduğu için
// geçerdi.
eval(loadSource('cp-accessories.js'));
global.VE_ALTERNATOR_PRESETS = VE_ALTERNATOR_PRESETS;
global.VE_AC_PRESETS = VE_AC_PRESETS;
global.VE_AIRCOMP_PRESETS = VE_AIRCOMP_PRESETS;
// Eğri ara değerleyicisi de GLOBAL olmalı: veFeadAutoKw (require ile yüklenen
// fead-model.js) onu global'de arıyor. Yayınlanmazsa katalogdan güç HİÇ
// gelmez ve preset kapıları "0 kW" ile yanlış sebepten geçerdi.
global.veAccInterpCurve = veAccInterpCurve;
const DUTY = require('../../js/fead-duty.js');
Object.keys(DUTY).forEach((k) => { global[k] = DUTY[k]; });
const BELTS = require('../../js/fead-belts.js');
const TENS = require('../../js/fead-tensioners.js');
Object.keys(BELTS).forEach((k) => { global[k] = BELTS[k]; });
Object.keys(TENS).forEach((k) => { global[k] = TENS[k]; });
// AKSESUAR VE MOTOR DEFTERLERİ DE YÜKLENMELİ. Yüklenmezse sihirbaz sessizce
// yedek dala düşer ("katalog yüklenmedi") ve o kartların kapıları DOĞRU
// SEBEPTEN değil, kütüphane eksik olduğu için geçerdi.
const ACCLIB = require('../../js/fead-accessories.js');
Object.keys(ACCLIB).forEach((k) => { global[k] = ACCLIB[k]; });
const ENGLIB = require('../../js/fead-engines.js');
Object.keys(ENGLIB).forEach((k) => { global[k] = ENGLIB[k]; });
global.FEADCore = F;
Object.keys(M).forEach((k) => { global[k] = M[k]; });
Object.keys(fead).forEach((k) => { if (global[k] === undefined) global[k] = fead[k]; });
Object.keys(wiz).forEach((k) => { global[k] = wiz[k]; });

const IDX = fs.readFileSync(path.join(__dirname, '../../index.html'), 'utf8');
const CSS = fs.readFileSync(path.join(__dirname, '../../css/styles.css'), 'utf8');
const WIZ_SRC = fs.readFileSync(path.join(__dirname, '../../js/cp-fead-wizard.js'), 'utf8');

beforeEach(() => {
  resetStubs(stubs);
  global.nodes = [];
  global.connections = [];
});

// Sihirbazı düğümsüz açmak için: durum doğrudan kurulur (render DOM ister,
// o yüzden kabuk da enjekte ediliyor).
const _fwSifirla = () => {
  // TAZE durum: `veFeadWizReset` "Boş başla" SEÇİMİ sayılıyor (izini yazıyor),
  // taze bir sihirbaz ise hiçbir şey seçilmemiş demek.
  wiz.veFeadWizReset();
  delete wiz.veFeadWizState().seededFrom;
};
const kabuk = () => {
  document.body.innerHTML = '<div id="ve-canvas"></div>'
    + '<div id="ve-feadwiz-overlay" style="display:none;">'
    + '<div id="ve-fw-nav"></div><div id="ve-fw-body"></div><div id="ve-fw-foot"></div></div>';
};

// ─────────────────────────────────────────────────────────────────────────────
describe('bileşen sözleşmesi', () => {
  test('girişsiz/çıkışsız, tek kopya, kendi ölçüsünde', () => {
    const d = componentDefs['fead-wizard'];
    expect(d).toBeTruthy();
    expect(d.inputs).toBe(0);
    expect(d.outputs).toBe(0);
    expect(d.maxInstances).toBe(1);
    expect(d.isFeadWizard).toBe(true);
    // Zincirin halkası değil bir ARAÇ: bağlanamaz, ikinci kopyası olamaz.
    expect(d.isFeadPulley).toBeFalsy();
  });

  test('palet · kayıt defteri · panel dağıtımı · çift tık — beşi de bağlı', () => {
    // Bir modülün beş dosyaya birden bağlanması bu projenin kendi kuralı
    // (bkz. cp-structural.test.js): biri unutulursa bileşen paletten
    // sürüklenir ama paneli açılmaz ya da kaydedilen proje bozulur.
    expect(IDX).toContain('data-type="fead-wizard"');
    expect(IDX).toContain('js/cp-fead-wizard.js');
    expect(IDX).toContain('id="ve-feadwiz-overlay"');
    expect(IDX).toContain('id="ve-fw-nav"');
    expect(IDX).toContain('id="ve-fw-body"');
    expect(IDX).toContain('id="ve-fw-foot"');
    expect(VE_MODULES['full-throttle'].components).toContain('fead-wizard');
    const core = fs.readFileSync(path.join(__dirname, '../../js/cp-core.js'), 'utf8');
    expect(core).toContain("node.type === 'fead-wizard'");
    expect(core).toContain('getFeadWizardPropertiesHTML');
    const ui = fs.readFileSync(path.join(__dirname, '../../js/ui-core.js'), 'utf8');
    expect(ui).toContain("node.type === 'fead-wizard'");
    expect(ui).toContain('veFeadWizOpen');
  });

  test('betik cp-fead.js\'ten SONRA yükleniyor', () => {
    // Sihirbaz cp-fead.js'in yardımcılarını (_feadDefOf üzerinden değil ama
    // veFeadLayoutSVG / veFeadArrangeByCoords üzerinden) çağırıyor. Sıra
    // bozulursa tarayıcıda ReferenceError değil SESSİZ bir eksik çıkar:
    // typeof kontrolleri yüzünden şema hiç çizilmez.
    expect(IDX.indexOf('js/cp-fead-wizard.js')).toBeGreaterThan(IDX.indexOf('js/cp-fead.js'));
  });

  test('kabuk ORTAK, gövde kendine ait', () => {
    // Üçüncü bir pencere dili kurmanın karşılığı yok: kabuk Ayarlar/İçe
    // Aktarma modallarıyla aynı sınıflar.
    expect(IDX).toContain('class="ve-settings-modal ve-fw-modal"');
    ['.ve-fw-shell', '.ve-fw-nav', '.ve-fw-body', '.ve-fw-foot', '.ve-fw-card',
     '.ve-fw-step', '.ve-fw-inp', '.ve-fw-tbl'].forEach((c) => {
      expect(CSS).toContain(c);
    });
  });

  test('başlangıçta İKİ açılış yüzeyi kurulur: sihirbaz + örnekler', () => {
    document.body.innerHTML = '<div id="ve-canvas"></div><div id="ve-canvas-wrapper"></div>';
    global.nodes = []; global.connections = [];
    let k = 0;
    global.createNode = (type, x, y) => {
      const d = componentDefs[type] || {};
      const n = { id: 'st' + ++k, type, def: d, x, y,
                  width: d.defaultWidth || 65, height: d.defaultHeight || 60, data: {} };
      global.nodes.push(n); return n;
    };
    const out = fead.veFeadPopulateStarter();
    delete global.createNode;
    expect(out.length).toBe(2);
    expect(out.map((n) => n.type).sort()).toEqual(['fead-example', 'fead-wizard']);
    // Üst üste binmiyorlar (ikisi de aynı şeride konuyor).
    expect(Math.abs(out[0].x - out[1].x)).toBeGreaterThan(60);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// EN SIKI KAPI: sihirbaz iki örneği de BİREBİR geri üretiyor.
//
// Sihirbaz durumu bambaşka bir biçim (form satırları, kasnak anahtarları,
// kwByKey yerine kw) ama çözüm AYNI sayı olmak zorunda. Çeviride bir alan
// düşerse (temas tarafı, sürücü rolü, kip, yay künyesi, duty kW) sonuç sessizce
// kayar — model yine çözülür, yalnız başka bir sistemi anlatır.
describe('durum → düğüm çevirisi: örnekleri BİREBİR geri üretiyor', () => {
  const cift = (key) => {
    kabuk();
    expect(wiz.veFeadWizSeed(key)).toBe(true);
    const st = wiz.veFeadWizState();
    const sb = wiz.veFeadWizBuild();
    const ex = M.veFeadExampleNodes(key);
    const rb = M.veFeadBuildSystem(ex.nodes, ex.connections);
    return { st, sb, rb };
  };

  ['AG00976_GATES_2025', 'BMC_FEAD_2026'].forEach((key) => {
    test(key + ' — kol · boy · gerginlik · yön birebir', () => {
      const { sb, rb } = cift(key);
      expect(sb.ok).toBe(true);
      expect(rb.ok).toBe(true);
      expect(sb.beltLengthMm).toBeCloseTo(rb.beltLengthMm, 6);
      expect(sb.springTensionN).toBeCloseTo(rb.springTensionN, 6);
      expect(sb.relDeg).toBeCloseTo(rb.relDeg, 6);
      expect(sb.spin).toBe(rb.spin);
      expect(sb.order.length).toBe(rb.order.length);
    });
  });

  test('AG00976 — kanonik çıpalar (Gates raporunun kendi sayıları)', () => {
    const { sb } = cift('AG00976_GATES_2025');
    // TEK KOORDİNATA GEÇİŞTEN SONRAKİ TABAN. Kayış boyu artık bir ÇIKTI:
    // eski değer 1714,6 mm bir GİRDİYDİ ve kolu nominalin 0,0125° ötesine
    // itiyordu. Ölçülen fark T'de −%0,036.
    expect(sb.beltLengthMm).toBeCloseTo(1714.609, 2);
    expect(sb.springTensionN).toBeCloseTo(543.853, 1);
    expect(sb.relDeg).toBeCloseTo(28.0625, 3);
  });

  test('BMC — kanonik taban (CLAUDE.md kaydı)', () => {
    const { sb } = cift('BMC_FEAD_2026');
    // BMC'nin "1715" boyu YUVARLANMIŞ bir katalog adıydı ve girdi olarak
    // kolu nominalin 0,36° ötesine itiyordu; boy çıktı olunca kol nominalinde
    // duruyor. Ölçülen fark −%1,24.
    expect(sb.relDeg).toBeCloseTo(28.0625, 3);
    expect(sb.beltLengthMm).toBeCloseTo(1715.266, 2);
    expect(sb.springTensionN).toBeCloseTo(525.56, 1);
  });

  test('duty kW ANAHTARDAN KİMLİĞE çevriliyor — ve çevrilmezse sonuç DEĞİŞİYOR', () => {
    // İki uçlu kapı: çeviri oldu mu, ve olmasa gerçekten fark eder miydi?
    // (Örnek kurucusunda ölçülmüş sınıf: eşleşmeyen anahtar "kW girilmemiş"
    // sayılır, aksesuar 0 kW ile koşar, bütün gerilmeler tasarım gerginliğine
    // düzleşir — hiçbir uyarı çıkmadan.)
    const { st } = cift('AG00976_GATES_2025');
    const pack = wiz.veFeadWizNodes(st);
    const sol = pack.nodes.find((n) => n.type === 'fead-solver');
    const kimlikler = pack.nodes.map((n) => n.id);
    const anahtarlar = Object.keys(sol.data.duty[0].kw);
    expect(anahtarlar.length).toBeGreaterThan(0);
    anahtarlar.forEach((k) => { expect(kimlikler).toContain(k); });

    const toplam = (R) => Object.keys(R.duty[0].loadsKw || {})
      .reduce((a, k) => a + R.duty[0].loadsKw[k], 0);
    const b1 = M.veFeadBuildSystem(pack.nodes, pack.connections);
    const R1 = M.veFeadAnalyze(b1, { rows: sol.data.duty });
    // Anahtarları boz → aynı model, 0 kW
    sol.data.duty.forEach((r) => {
      const bozuk = {};
      Object.keys(r.kw).forEach((k) => { bozuk['yok-' + k] = r.kw[k]; });
      r.kw = bozuk;
    });
    const R2 = M.veFeadAnalyze(b1, { rows: sol.data.duty });
    expect(toplam(R1)).toBeGreaterThan(0.5);
    expect(toplam(R2)).toBeCloseTo(0, 6);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('kipe göre hangi alan taşınır', () => {
  const durum = () => {
    kabuk();
    wiz.veFeadWizSeed('AG00976_GATES_2025');
    return wiz.veFeadWizState();
  };
  const gergi = (st) => wiz.veFeadWizNodes(st).nodes.find((n) => n.type === 'fead-tensioner');

  test('sihirbaz TEK koordinat taşır — montaj konumu ve kip alanı YOK', () => {
    const t = gergi(durum());
    expect(t.data.cenX).toBeCloseTo(-161.97, 6);
    expect(t.data.cenY).toBeCloseTo(91.29, 6);
    expect(t.data.armMeanDeg).toBeCloseTo(-11.9992, 6);   // ZORUNLU girdi
    ['pivotX', 'pivotY', 'angleMode', 'freeAngleDeg', 'verifyCenX', 'verifyCenY',
     'armPinned'].forEach((k) => expect(t.data[k]).toBeUndefined());
  });

  test('sihirbazda KİP SORUSU YOK — ikilik ön kapıda da kapalı', () => {
    kabuk();
    wiz.veFeadWizSeed('AG00976_GATES_2025');
    // Kapı ÜRETİLEN YÜZEYE bakıyor: sihirbazın her adımının HTML'i taranıyor.
    const st = wiz.veFeadWizState();
    const b = wiz.veFeadWizBuild();
    const hepsi = wiz.VE_FW_STEPS.map((_, i) => wiz.veFeadWizStepHTML(i, b)).join('');
    expect(hepsi).not.toMatch(/Gergiyi nasıl tanımlayacaksınız/);
    expect(hepsi).not.toMatch(/tenMode/);
    // ve gergi adımı TEK koordinat soruyor
    expect(hepsi).toMatch(/Avara Kasnağının Merkezi/);
    expect(hepsi).not.toMatch(/ten\.pivotX|ten\.freeAngleDeg/);
    expect(st).toBeTruthy();
  });

  test('zarf kipinde kayış BOY KİPİ yazılmaz (yapısal olarak çıktı)', () => {
    const st = durum();
    st.belt.lengthMode = 'fixed';           // kullanıcı ısrar etse bile
    const b = wiz.veFeadWizNodes(st).nodes.find((n) => n.type === 'fead-belt');
    expect(b.data.lengthMode).toBeUndefined();
    const sb = M.veFeadBuildSystem(wiz.veFeadWizNodes(st).nodes, wiz.veFeadWizNodes(st).connections);
    expect(sb.beltMode).toBe('free');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('sıra, sürücü ve satır düzenleme', () => {
  const bos = () => { kabuk(); wiz.veFeadWizReset(); return wiz.veFeadWizState(); };

  test('ilk kasnak SÜRÜCÜ doğar, ikinci doğmaz', () => {
    bos();
    wiz.veFeadWizPulleyAdd('fead-crank');
    wiz.veFeadWizPulleyAdd('fead-alternator');
    const st = wiz.veFeadWizState();
    expect(st.pulleys[0].driver).toBe(true);
    expect(st.pulleys[1].driver).toBe(false);
  });

  test('sürücü TEK olabilir', () => {
    bos();
    wiz.veFeadWizPulleyAdd('fead-crank');
    wiz.veFeadWizPulleyAdd('fead-alternator');
    const st = wiz.veFeadWizState();
    wiz.veFeadWizDriver(st.pulleys[1].key);
    expect(st.pulleys.filter((p) => p.driver).length).toBe(1);
    expect(st.pulleys[1].driver).toBe(true);
  });

  test('gergi sıraya KENDİLİĞİNDEN girer (durumda ayrı duruyor)', () => {
    bos();
    wiz.veFeadWizPulleyAdd('fead-crank');
    wiz.veFeadWizPulleyAdd('fead-idler');
    const r = wiz.veFeadWizRoute(wiz.veFeadWizState());
    expect(r.length).toBe(3);
    expect(r[r.length - 1]).toBe('__ten__');
  });

  test('kasnak silinince sıradan VE duty kW\'dan düşer', () => {
    bos();
    wiz.veFeadWizPulleyAdd('fead-crank');
    wiz.veFeadWizPulleyAdd('fead-alternator');
    const st = wiz.veFeadWizState();
    const k = st.pulleys[1].key;
    wiz.veFeadWizDutyAdd();
    wiz.veFeadWizDutyKw(0, k, 3.2);
    expect(st.solver.duty[0].kw[k]).toBe(3.2);
    wiz.veFeadWizPulleyDel(k);
    expect(st.route.indexOf(k)).toBe(-1);
    // Kalırsa kurulumda eşleşmeyen bir anahtar olarak taşınır ve "girilmiş ama
    // görünmeyen" bir güç üretirdi.
    expect(st.solver.duty[0].kw[k]).toBeUndefined();
  });

  test('tip değişince temas tarafı tipin varsayılanına döner', () => {
    bos();
    wiz.veFeadWizPulleyAdd('fead-alternator');
    const st = wiz.veFeadWizState();
    expect(st.pulleys[0].contact).toBe('grooved');
    wiz.veFeadWizPulleyType(st.pulleys[0].key, 'fead-idler');
    expect(st.pulleys[0].contact).toBe('back');
  });

  test('sırayı çevirmek DÖNÜŞ YÖNÜNÜ çevirir', () => {
    kabuk();
    wiz.veFeadWizSeed('AG00976_GATES_2025');
    const once = wiz.veFeadWizBuild().spin;
    wiz.veFeadWizRouteReverse();
    const sonra = wiz.veFeadWizBuild().spin;
    expect(once).toBe(1);
    expect(sonra).toBe(-1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('kurulum kapısı ve kurulum', () => {
  const sahteKanvas = () => {
    // Kabuk KORUNUYOR: veFeadWizOpen overlay'i arıyor ve bulamazsa düğüme
    // bağlanmıyor — taslağın düğümde kalması bu bağa dayanıyor.
    document.body.innerHTML = '<div id="ve-canvas"></div><div id="ve-canvas-wrapper"></div>'
      + '<div id="ve-feadwiz-overlay" style="display:none;">'
      + '<div id="ve-fw-nav"></div><div id="ve-fw-body"></div><div id="ve-fw-foot"></div></div>';
    global.nodes = []; global.connections = [];
    let k = 0;
    global.createNode = (type, x, y) => {
      const d = componentDefs[type] || {};
      // maxInstances GERÇEK createNode'da uygulanıyor; sahte de uygulamalı,
      // yoksa "araç düğümünü yeniden kullan" dalı hiç sınanmaz.
      if (d.maxInstances && global.nodes.filter((n) => n.type === type).length >= d.maxInstances)
        return null;
      const n = { id: 'cv' + ++k, type, def: d, x, y,
                  width: d.defaultWidth || 65, height: d.defaultHeight || 60, data: {} };
      global.nodes.push(n); return n;
    };
    global.createConnection = (from, to) =>
      global.connections.push({ id: 'c' + global.connections.length, from, to,
                                fromPort: 'output', toPort: 'input' });
  };

  test('kanvasta kasnak varken kurulum KAPALI, sebebi yazılı', () => {
    kabuk();
    wiz.veFeadWizSeed('AG00976_GATES_2025');
    global.nodes = [{ id: 'x1', type: 'fead-crank', def: componentDefs['fead-crank'], data: {} }];
    const k = wiz.veFeadWizCanCreate();
    expect(k.ok).toBe(false);
    expect(k.varOlan).toBe(1);
    expect(k.sebep).toMatch(/zaten/i);
    // Onay işaretlenince açılıyor (silme GERİ ALINABİLİR: saveState çağrılıyor).
    wiz.veFeadWizState().temizle = true;
    expect(wiz.veFeadWizCanCreate().ok).toBe(true);
  });

  test('kurulum: düğümler + teller kanvasa geçiyor, çözüm AYNI kalıyor', () => {
    kabuk();
    wiz.veFeadWizSeed('AG00976_GATES_2025');
    const beklenen = wiz.veFeadWizBuild();
    sahteKanvas();
    const out = wiz.veFeadWizCreate();
    delete global.createNode; delete global.createConnection;
    expect(out).toBeTruthy();
    // 6 kasnak + kayış + çözücü + kart + rapor
    expect(global.nodes.filter((n) => (componentDefs[n.type] || {}).isFeadPulley).length).toBe(6);
    expect(global.nodes.filter((n) => n.type === 'fead-belt').length).toBe(1);
    expect(global.nodes.filter((n) => n.type === 'fead-solver').length).toBe(1);
    expect(global.nodes.filter((n) => n.type === 'fead-layout').length).toBe(1);
    expect(global.nodes.filter((n) => n.type === 'fead-report').length).toBe(1);
    expect(global.connections.length).toBe(6);
    // KURULAN MODEL ÖNİZLEMEYLE AYNI SAYIYI VERİYOR — sihirbazın varlık şartı.
    const b = M.veFeadBuildSystem(global.nodes, global.connections);
    expect(b.ok).toBe(true);
    expect(b.beltLengthMm).toBeCloseTo(beklenen.beltLengthMm, 6);
    expect(b.springTensionN).toBeCloseTo(beklenen.springTensionN, 6);
    expect(b.spin).toBe(beklenen.spin);
  });

  test('kurulumda duty kW kanvas KİMLİKLERİNE göç ediyor', () => {
    kabuk();
    wiz.veFeadWizSeed('AG00976_GATES_2025');
    sahteKanvas();
    wiz.veFeadWizCreate();
    delete global.createNode; delete global.createConnection;
    const sol = global.nodes.find((n) => n.type === 'fead-solver');
    const kimlikler = global.nodes.map((n) => n.id);
    const anahtar = Object.keys(sol.data.duty[0].kw);
    expect(anahtar.length).toBeGreaterThan(0);
    anahtar.forEach((k) => { expect(kimlikler).toContain(k); });
    // Göç yapılmasaydı hiçbiri eşleşmez ve bütün aksesuarlar 0 kW koşardı.
    const b = M.veFeadBuildSystem(global.nodes, global.connections);
    const R = M.veFeadAnalyze(b, { rows: sol.data.duty });
    const yuk = R.duty[0].loadsKw || {};
    expect(Object.keys(yuk).reduce((a, k) => a + yuk[k], 0)).toBeGreaterThan(0.5);
  });

  test('SİHİRBAZ DÜĞÜMÜ KALIR, "Başlangıç ve Örnekler" GİDER', () => {
    // Ayrım kullanıcı verisinde: sihirbaz düğümü kullanıcının kendi formunu
    // taşıyor (silmek onu çöpe atmak olurdu), örnek düğümü hiçbir şey taşımıyor.
    kabuk();
    wiz.veFeadWizSeed('BMC_FEAD_2026');
    sahteKanvas();
    createNode('fead-wizard', 0, 0);
    createNode('fead-example', 0, 0);
    const wn = global.nodes.find((n) => n.type === 'fead-wizard');
    wiz.veFeadWizOpen(wn.id);                  // taslak düğüme bağlansın
    wiz.veFeadWizSeed('BMC_FEAD_2026');
    wiz.veFeadWizCreate();
    delete global.createNode; delete global.createConnection;
    expect(global.nodes.filter((n) => n.type === 'fead-wizard').length).toBe(1);
    expect(global.nodes.filter((n) => n.type === 'fead-example').length).toBe(0);
    // Taslak düğümde KALDI (kullanıcı geri dönüp bir sayıyı düzeltebilsin).
    expect(global.nodes.find((n) => n.type === 'fead-wizard').data.wiz).toBeTruthy();
  });

  test('temizle işaretliyse mevcut kasnaklar VE telleri gider', () => {
    kabuk();
    wiz.veFeadWizSeed('BMC_FEAD_2026');
    sahteKanvas();
    createNode('fead-crank', 0, 0);
    createNode('fead-idler', 0, 0);
    createConnection(global.nodes[0].id, global.nodes[1].id);
    expect(global.connections.length).toBe(1);
    wiz.veFeadWizState().temizle = true;
    wiz.veFeadWizCreate();
    delete global.createNode; delete global.createConnection;
    // Eski iki kasnak gitti; yerine örneğin altı kasnağı geldi.
    expect(global.nodes.filter((n) => (componentDefs[n.type] || {}).isFeadPulley).length).toBe(6);
    expect(global.connections.length).toBe(6);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
describe('adım eşlemesi ve yüzeyler', () => {
  test('hata mesajı ait olduğu adıma düşüyor', () => {
    expect(wiz.veFeadWizStepOf('"Alternatör" kasnağının konumu (X / Y) girilmedi.')).toBe(1);
    expect(wiz.veFeadWizStepOf('Kayış yolu kapanmıyor: …')).toBe(2);
    expect(wiz.veFeadWizStepOf('Gergi kol boyu girilmedi.')).toBe(3);
    expect(wiz.veFeadWizStepOf('Kayış kanal (kaburga) sayısı girilmedi.')).toBe(4);
    // Eşleşmeyen mesaj ÖZET adımında toplanıyor: bilinmeyen bir hatayı
    // gizlemek, yanlış yere koymaktan kötüdür.
    expect(wiz.veFeadWizStepOf('bilinmeyen bir şey oldu')).toBe(6);
  });

  test('yedi adımın yedisi de patlamadan çiziliyor (boş durumda bile)', () => {
    kabuk();
    wiz.veFeadWizReset();
    const b = wiz.veFeadWizBuild();
    for (let i = 0; i < wiz.VE_FW_STEPS.length; i++) {
      const html = wiz.veFeadWizStepHTML(i, b);
      expect(typeof html).toBe('string');
      expect(html.length).toBeGreaterThan(50);
      expect(html).not.toContain('undefined');
      expect(html).not.toContain('NaN');
      expect(html).not.toContain('[object');
    }
  });

  test('dolu durumda da yedi adım temiz', () => {
    kabuk();
    wiz.veFeadWizSeed('AG00976_GATES_2025');
    const b = wiz.veFeadWizBuild();
    for (let i = 0; i < wiz.VE_FW_STEPS.length; i++) {
      const html = wiz.veFeadWizStepHTML(i, b);
      expect(html).not.toContain('undefined');
      expect(html).not.toContain('[object');
    }
  });

  test('adım rozeti O ADIMIN hata sayısını taşıyor', () => {
    kabuk();
    wiz.veFeadWizReset();
    const b = wiz.veFeadWizBuild();
    const nav = wiz.veFeadWizNavHTML(b);
    expect(nav).toContain('ve-fw-step-n');           // boş durumda hata var
    const kasnakHata = wiz.veFeadWizIssues(b, 1).filter((x) => x.tur === 'err').length;
    expect(kasnakHata).toBeGreaterThan(0);
  });

  // ── ADIM RAYI ÜÇ DURUM YAKIYOR (kullanıcı isteği, 2026-08-31) ────────────
  //
  // *"eksik girdi olduğunda kırmızı, girdiler tam olduğunda belirgin yeşil…
  // kullanıcı yeteri kadar bilgilenemiyor."* — eski rayda tek işaret hata
  // rozetiydi, yani "sorun yok" ile "buraya hiç bakılmadı" AYIRT EDİLEMİYORDU.
  describe('adım rayı — üç durum', () => {
    test('durum köprünün KENDİ listesinden türüyor, ikinci bir liste yok', () => {
      kabuk(); wiz.veFeadWizSeed('AG00976_GATES_2025');
      const b = wiz.veFeadWizBuild();
      for (let i = 0; i < wiz.VE_FW_STEPS.length; i++) {
        const d = wiz.veFeadWizStepState(b, i);
        const l = wiz.veFeadWizIssues(b, i);
        expect(d.err).toBe(l.filter((x) => x.tur === 'err').length);
        expect(d.warn).toBe(l.filter((x) => x.tur === 'warn').length);
        expect(d.durum).toBe(d.err ? 'err' : (d.warn ? 'warn' : 'ok'));
      }
    });

    test('ÜÇ durum da var ve hata UYARIYI bastırır', () => {
      // İkiye indirilseydi: uyarıyı yeşile katmak "her şey tamam" demek,
      // kırmızıya katmak çözülen bir modeli bozuk göstermek olurdu.
      expect(wiz.veFeadWizStepState({ errors: [], warnings: [] }, undefined).durum).toBe('ok');
      const sadeceUyari = wiz.veFeadWizStepState(
        { errors: [], warnings: ['Gergi kol boyu girilmedi.'] }, undefined);
      expect(sadeceUyari.durum).toBe('warn');
      const ikisi = wiz.veFeadWizStepState(
        { errors: ['Gergi kol boyu girilmedi.'], warnings: ['Gergi kol boyu girilmedi.'] }, undefined);
      expect(ikisi.durum).toBe('err');
    });

    test('BOŞ sihirbazda kırmızı, DOLU örnekte yeşil — ray gerçekten yanıyor', () => {
      kabuk(); wiz.veFeadWizReset();
      const bos = wiz.veFeadWizNavHTML(wiz.veFeadWizBuild());
      expect(bos).toContain('ve-fw-st-err');

      kabuk(); wiz.veFeadWizSeed('AG00976_GATES_2025');
      const dolu = wiz.veFeadWizNavHTML(wiz.veFeadWizBuild());
      expect(dolu).toContain('ve-fw-st-ok');
      expect(dolu).not.toContain('ve-fw-st-err');
      // ...ve TAMAMLANMIŞ adım da rozet taşıyor (✓). Yalnız hata varken
      // çizilseydi "tamam" hâli sessiz kalırdı — bildirilen eksiklik buydu.
      expect(dolu).toContain('>✓</span>');
    });

    test('YEDİ adımın yedisi de durum sınıfı taşıyor — sessiz adım yok', () => {
      kabuk(); wiz.veFeadWizSeed('BMC_FEAD_2026');
      const nav = wiz.veFeadWizNavHTML(wiz.veFeadWizBuild());
      expect((nav.match(/ve-fw-st-(ok|warn|err)/g) || []).length).toBe(wiz.VE_FW_STEPS.length);
      // `ve-fw-step-n"` — sondaki tırnak ŞART: tırnaksız kalıp numara
      // dairesini (`ve-fw-step-no`) de sayar ve kapı 14 görür.
      expect((nav.match(/class="ve-fw-step-n"/g) || []).length).toBe(wiz.VE_FW_STEPS.length);
    });

    test('DURUM ile ODAK ayrı kanallar — seçili adımın durumu kaybolmuyor', () => {
      // Tek kanala bindirilseydi (eski `.done` gibi) kullanıcının en çok
      // baktığı adımın durumu tam da orada görünmezdi.
      kabuk(); wiz.veFeadWizSeed('AG00976_GATES_2025');
      wiz.veFeadWizGoto(0);
      const nav = wiz.veFeadWizNavHTML(wiz.veFeadWizBuild());
      const ilk = nav.slice(nav.indexOf('<li'), nav.indexOf('</li>'));
      expect(ilk).toContain(' on');
      expect(ilk).toMatch(/ve-fw-st-(ok|warn|err)/);
      // KONUMSAL "done" EMEKLİ: üstünden geçilmiş ama eksik bir adım yeşil
      // halka gösteriyordu, yani ray YANLIŞ bilgi veriyordu.
      expect(nav).not.toContain('ve-fw-step done');
      ['.ve-fw-st-ok', '.ve-fw-st-warn', '.ve-fw-st-err'].forEach((c) => {
        expect(CSS).toContain(c);
      });
    });
  });

  // ── ALT ÇUBUK MODALIN KENDİ BAŞLIĞIYLA AYNI ÖLÇÜDE ──────────────────────
  //
  // Kullanıcı bildirimi: *"çok geniş olmuş… butonlar falan da çok geniş
  // duruyor."* ÖLÇÜLDÜ (gerçek tarayıcı): çubuk 48 px, aynı diyaloğun başlığı
  // 39 px — alt çubuk kendi üst çubuğundan 9 px KALIN.
  test('alt çubuk dolgusu modal başlığıyla aynı kaynaktan', () => {
    const kural = (sec) => {
      const i = CSS.indexOf(sec + '{');
      return i < 0 ? '' : CSS.slice(i, CSS.indexOf('}', i));
    };
    const foot = kural('.ve-fw-foot');
    const btn = kural('.ve-fw-btn');
    // Dikey dolgu 8 px'i AŞMAMALI: aştığı anda çubuk başlığın üstüne çıkıyor.
    const fpad = (foot.match(/padding:\s*(\d+)px/) || [])[1];
    expect(Number(fpad)).toBeLessThanOrEqual(8);
    const bpad = (btn.match(/padding:\s*(\d+)px\s+(\d+)px/) || []);
    expect(Number(bpad[1])).toBeLessThanOrEqual(5);   // düğme yüksekliği
    expect(Number(bpad[2])).toBeLessThanOrEqual(11);  // düğme genişliği
  });

  test('panel: taslak varken künyeyi, yokken sebebi yazıyor', () => {
    const bosNode = { id: 'w1', type: 'fead-wizard', data: {} };
    const h1 = wiz.getFeadWizardPropertiesHTML(bosNode);
    expect(h1).toContain("veFeadWizOpen('w1')");
    expect(h1).toMatch(/Henüz taslak yok/);
    kabuk();
    wiz.veFeadWizSeed('BMC_FEAD_2026');
    const doluNode = { id: 'w2', type: 'fead-wizard',
                       data: { wiz: JSON.parse(JSON.stringify(wiz.veFeadWizState())) } };
    const h2 = wiz.getFeadWizardPropertiesHTML(doluNode);
    expect(h2).toContain('Kayıtlı taslak');
    expect(h2).not.toContain('undefined');
  });

  test('açılış/kapanış: durum düğüme YAZILIR, saveState bir kez çağrılır', () => {
    kabuk();
    global.nodes = [{ id: 'w9', type: 'fead-wizard', def: componentDefs['fead-wizard'], data: {} }];
    expect(wiz.veFeadWizOpen('w9')).toBe(true);
    wiz.veFeadWizPulleyAdd('fead-crank');
    // ALAN YAZMAK DA yığını kirletmemeli — asıl risk burada: kırk alanlık bir
    // formda her tuş vuruşu bir undo adımı olsaydı geri-al kullanılamaz hale
    // gelirdi (panel alanlarının kuralı burada geçerli değil: orada bir alan =
    // bir karar). Sihirbazın satır ekleme yolu da aynı kurala tabi.
    wiz._fwSet('ad', 'Deneme');
    wiz._fwSet('belt.ribs', 7);
    wiz.veFeadWizPulleySet(wiz.veFeadWizState().pulleys[0].key, 'od', 180);
    expect(stubs.saveState).not.toHaveBeenCalled();
    wiz.veFeadWizClose(true);
    expect(global.nodes[0].data.wiz.pulleys.length).toBe(1);
    expect(stubs.saveState).toHaveBeenCalledTimes(1);
  });

  test('yarım kalan taslak KALDIĞI YERDEN açılıyor', () => {
    kabuk();
    global.nodes = [{ id: 'w8', type: 'fead-wizard', def: componentDefs['fead-wizard'], data: {} }];
    wiz.veFeadWizOpen('w8');
    wiz.veFeadWizPulleyAdd('fead-crank');
    wiz.veFeadWizPulleyAdd('fead-ac');
    wiz.veFeadWizClose(true);
    wiz.veFeadWizOpen('w8');
    expect(wiz.veFeadWizState().pulleys.length).toBe(2);
    // Anahtar üreteci kayıttaki en büyüğün ÜSTÜNDEN devam etmeli; yoksa yeni
    // satır eski bir satırla aynı anahtarı alır ve duty kW ona sızar.
    wiz.veFeadWizPulleyAdd('fead-idler');
    const k = wiz.veFeadWizState().pulleys.map((p) => p.key);
    expect(new Set(k).size).toBe(3);
  });
});


// ═══════════════════════════════════════════════════════════════════════════
//  KULLANICI DÜZELTMELERİ (2026-08-31) — beş madde
// ═══════════════════════════════════════════════════════════════════════════

// ── 1 · GERGİ SATIRI "Kasnaklar" TABLOSUNDA ────────────────────────────────
//
// Kullanıcı isteği: *"'Kasnaklar' kısmında otomatik gergi eklenmiyor/
// çıkarılmıyor. Kasnaklar kısmına otomatik olarak eklensin. Koordinatları
// oraya el ile girelim, bu sayfadan gerginin tipini seçelim. Bu girdiler
// sihirbazın 'Otomatik Gergi' sayfasına gitsin."*
describe('gergi satırı — Kasnaklar tablosunda, silinemez, tek kaynak', () => {
  const kur = (key) => { kabuk(); wiz.veFeadWizSeed(key); return wiz.veFeadWizState(); };
  const kasnakHTML = () => wiz.veFeadWizStepHTML(1, wiz.veFeadWizBuild());
  const tenSatiri = (h) => {
    const i = h.indexOf('ve-fw-tr-ten');
    return i < 0 ? '' : h.slice(i, h.indexOf('</tr>', i));
  };

  test('satır HER ZAMAN var — kasnak yokken bile', () => {
    // Çekirdek tam bir gergi istiyor; gergi bir SEÇENEK değil modelin parçası.
    kabuk(); wiz.veFeadWizReset();
    expect(tenSatiri(kasnakHTML())).toContain("veFeadWizTenSet('od'");
    kur('AG00976_GATES_2025');
    expect(tenSatiri(kasnakHTML())).toContain("veFeadWizTenSet('od'");
  });

  test('silinemez ve SÜRÜCÜ OLAMAZ — iki düğme de devre dışı', () => {
    kur('AG00976_GATES_2025');
    const r = tenSatiri(kasnakHTML());
    expect(r).toMatch(/<input type="radio" disabled/);
    expect(r).toMatch(/class="ve-fw-x" disabled/);
  });

  test('X/Y AVARA MERKEZİ — satır bunu ADIYLA söylüyor', () => {
    // Bu modülün en pahalı sessiz hatası: avara merkezi ↔ montaj konumu
    // karışması (ölçüldü: gerginlik medyan +%1526, 14/14 sistem YİNE çözülür,
    // 5'inde hiçbir uyarı çıkmaz). Satır hangi noktayı istediğini SÖYLEMEK
    // zorunda — beş kasnakla aynı şeyi istese bile.
    //
    // Uyarı iki kez taşındı ve İKİSİ DE kullanıcı isteğiydi: önce satırdaki
    // amber çipten kart açıklamasına, sonra (2026-09-02, açıklamalar tümden
    // kalkınca) alanın kendi `title` ipucuna. İpucu üzerine gelince çıkıyor,
    // yüzeyi doldurmuyor — ve ÖLÇÜLMÜŞ BEDELİ de taşıyor, yoksa bir gün
    // "sadeleştirme" diye tamamen silinirdi.
    kur('AG00976_GATES_2025');
    expect(wiz.veFeadWizTenCoordKeys()).toEqual(['cenX', 'cenY']);
    const r = tenSatiri(kasnakHTML());
    expect(r).toContain("veFeadWizTenSet('cenX'");
    expect(r).toContain("veFeadWizTenSet('cenY'");
    // Amber çip GİTTİ (kullanıcı isteği) — satır diğerleriyle birebir.
    expect(r).not.toContain('ve-fw-tag');
    // Uyarı, X ve Y alanlarının KENDİ ipucunda.
    const xy = r.match(/<input[^>]*veFeadWizTenSet\('cen[XY]'/g) || [];
    expect(xy.length).toBe(2);
    xy.forEach((alan) => {
      expect(alan).toMatch(/title="[^"]*MERKEZ/);
      expect(alan).toMatch(/title="[^"]*\+%1526/);      // bedel de ipucunda
    });
    // ...ve montaj konumu alanına ASLA yazmıyor: o bir ÇIKTI. Satırın oraya
    // yazması, kullanıcının girdiği sayıyı 90 mm ötedeki bir noktaya koymak
    // olurdu.
    expect(r).not.toContain("veFeadWizTenSet('pivotX'");
    expect(r).not.toContain("veFeadWizTenSet('pivotY'");
  });

  test('tablodan yazılan değer GERGİ ADIMINDA görünür — tek kayıt', () => {
    // İki yüzey ikinci bir durum kopyası tutsaydı biri ötekini sessizce
    // eskitirdi ("panel ile kart AYNI alanı okur").
    const st = kur('AG00976_GATES_2025');
    wiz.veFeadWizTenSet('cenX', -160.5);
    expect(st.ten.cenX).toBe(-160.5);
    expect(wiz.veFeadWizStepHTML(3, wiz.veFeadWizBuild())).toContain('-160.5');
    // ve çözüme de gidiyor
    const t = wiz.veFeadWizNodes(st).nodes.find((n) => n.type === 'fead-tensioner');
    expect(t.data.cenX).toBe(-160.5);
  });

  test('gergi st.pulleys dizisine GİRMEZ — duty sütunu açılmaz, sürücü olamaz', () => {
    // Diziye gerçek satır olarak konsaydı: (a) duty tablosunda gergiye kW
    // sütunu açılır ve çekirdeğe güç yazılırdı, (b) sürücü radyosu onu
    // seçebilirdi. İkisi de sessizce yanlış model üretir.
    const st = kur('AG00976_GATES_2025');
    expect(st.pulleys.some((p) => p.type === 'fead-tensioner')).toBe(false);
    const h6 = wiz.veFeadWizStepHTML(5, wiz.veFeadWizBuild());
    expect(h6).not.toContain('Otomatik Gergi (E9843)<em>kW');
    // sıra yine gergiyi taşıyor (kablolama)
    expect(wiz.veFeadWizRoute(st)).toContain('__ten__');
  });

  test('gergi künyesi TABLODAN seçilebiliyor ve alanları dolduruyor', () => {
    const st = kur('BMC_FEAD_2026');
    const oncePivotX = st.ten.pivotX, oncePivotY = st.ten.pivotY;
    wiz.veFeadWizTenLib('AG0868-4PK');
    expect(st.ten.tenLib).toBe('AG0868-4PK');
    expect(st.ten.armLen).toBe(90);
    expect(st.ten.meanLoad).toBeCloseTo(16.07, 3);
    // Künye MOTORUN verisini yazmaz: montaj konumu ve kol açısı DEĞİŞMEDEN
    // kalır (kütüphane bir katalogdur; bir katalogun koordinatını kullanıcının
    // motoruna uygulamak sessizce başka bir sistemi anlatmak olurdu).
    expect(st.ten.pivotX).toBe(oncePivotX);
    expect(st.ten.pivotY).toBe(oncePivotY);
  });
});

// ── PARÇA KODU — künye uygulanınca taşınır, kodsuzda SİLİNİR ───────────────
describe('gergi parça kodu (tenPart) — pim künyesinin anahtarı', () => {
  test('kodlu künye: kod taşınır, düğüme gider, pim planı çözülür', () => {
    kabuk(); wiz.veFeadWizSeed('BMC_FEAD_2026');
    const st = wiz.veFeadWizState();
    wiz.veFeadWizTenLib('AG0868-8PK');
    expect(st.ten.tenPart).toBe('E9843');
    expect(st.ten.inertia).toBeCloseTo(0.0009, 6);     // kasnak ataleti de gelir
    const t = wiz.veFeadWizNodes(st).nodes.find((n) => n.type === 'fead-tensioner');
    expect(t.data.tenPart).toBe('E9843');
    const b = wiz.veFeadWizBuild();
    expect(b.pin && b.pin.ok).toBe(true);
    expect(b.pin.angleDeg).toBeCloseTo(231.0, 1);      // E9843 çizimi: 231°
  });

  test('kodsuz künyeye geçince kod SİLİNİR — eski parçanın pimi kalmaz', () => {
    kabuk(); wiz.veFeadWizSeed('BMC_FEAD_2026');
    const st = wiz.veFeadWizState();
    wiz.veFeadWizTenLib('AG0868-8PK');
    expect(st.ten.tenPart).toBe('E9843');
    wiz.veFeadWizTenLib('AG00976-1715');               // bu kayıtta part YOK
    expect(st.ten.tenPart).toBeUndefined();
    const t = wiz.veFeadWizNodes(st).nodes.find((n) => n.type === 'fead-tensioner');
    expect(t.data.tenPart).toBeUndefined();
    const b = wiz.veFeadWizBuild();
    expect(b.pin && b.pin.ok).toBe(false);
    expect(String(b.pin.reason)).toMatch(/parça kodu yok/i);
  });
});

// ── 2 · KÜNYE ETİKETİ: yalnız kol boyu + çalışma momenti ───────────────────
describe('gergi künye etiketi — rapor adı YOK', () => {
  const liste = () => TENS.veFeadTensionerList();

  test('etiket kol boyu ve çalışma momentini yazar, rapor adını YAZMAZ', () => {
    liste().forEach((r) => {
      const et = TENS.veFeadTenLabel(r);
      expect(et).toContain(String(r.armLen));
      expect(et).toContain(r.meanNm.toFixed(2));
      expect(et).not.toContain(r.src);
      expect(et).not.toMatch(/AG0\d|Ten@|8PK1715HD/);
    });
  });

  test('14 etiketin 14\'ü TEKİL — iki ondalık ZORUNLU', () => {
    // ÖLÇÜLDÜ: bir ondalığa düşürülürse iki çakışma doğuyor
    // (22,07↔22,15 ve 22,21↔22,20) ve kullanıcı hangi künyeyi seçtiğini
    // bilemez — model yine çözülür, hata çıkmaz, yalnız künye başkasıdır.
    const et = liste().map(TENS.veFeadTenLabel);
    expect(new Set(et).size).toBe(et.length);
    const tek = liste().map((r) => 'kol ' + r.armLen + ' mm · ' + r.meanNm.toFixed(1) + ' Nm');
    expect(new Set(tek).size).toBeLessThan(tek.length);   // 1 ondalık ÇAKIŞIYOR
    // Etiket PARÇA KODUYLA başlıyor (kullanıcı, 2026-09-01) — kodsuz kayıt "?".
    et.forEach((e) => expect(e).toMatch(/^\S+ · kol \d+(\.\d+)? mm · \d+\.\d{2} Nm$/));
  });

  test('sayı UYDURULMAZ: eksik kayıtta NaN/undefined basılmaz', () => {
    expect(TENS.veFeadTenLabel(null)).toBe('');
    expect(TENS.veFeadTenLabel({ key: 'x' })).not.toMatch(/NaN|undefined/);
  });

  test('İKİ YÜZEY AYRIŞMAZ — sihirbaz ve panel aynı etiket kümesini basar', () => {
    // Etiket bir dönem iki dosyada iki ayrı ifadeyle üretiliyordu ve ZATEN
    // ayrışmıştı (biri birimleri yazıyor, öteki yazmıyordu). Tek üretici.
    kabuk(); wiz.veFeadWizSeed('BMC_FEAD_2026');
    const h = wiz.veFeadWizStepHTML(3, wiz.veFeadWizBuild());
    const panel = fead.veFeadTensionerLibCard({ id: 'n1', data: {} });
    const cek = (s) => (s.match(/>[^<>]* · kol [^<]*<\/option>/g) || []).map((x) => x.slice(1, -10));
    const a = cek(h), bb = cek(panel);
    expect(a.length).toBe(14);
    expect(new Set(a)).toEqual(new Set(bb));
    // <option value> hâlâ ANAHTAR — etiket kimlik taşımıyor
    expect(h).toContain('value="AG0868-8PK"');
  });
});

// ── 3 · KATALOG ÖNERİSİ SİHİRBAZDAN KALKTI ─────────────────────────────────
describe('kayış adımı — katalog önerisi yok, gereken boy okuması var', () => {
  test('katalog önerisi basılmaz ama gereken boy DURUR', () => {
    kabuk(); wiz.veFeadWizSeed('AG00976_GATES_2025');
    const b = wiz.veFeadWizBuild();
    expect(b.ok).toBe(true);
    const h = wiz.veFeadWizStepHTML(4, b);
    expect(h).not.toMatch(/Katalog önerisi|ISO 9982 stok|Otomotiv ızgarası/);
    expect(h).toMatch(/Gereken boy/);                 // bilgi kaybı YOK
  });

  test('PANELİN katalog kartı aynen duruyor — kaldırma yalnız sihirbazda', () => {
    // Kullanıcı yalnız sihirbazdan kaldırılmasını istedi; panel tarafındaki
    // katalog kartı (kayış seçme yüzeyi) bambaşka bir iş yapıyor: aday boyu
    // çözüp kolun nereye oturacağını ve gerginliği veriyor.
    //
    // KAPI ÜRETİLEN YÜZEYE BAKAR, kaynak metnine değil — fonksiyonun VAR
    // olması onun ÇAĞRILDIĞI anlamına gelmiyor (ölçüldü: bugün panelden
    // çağrıldığını tutan başka hiçbir test yok).
    const h = fead.getFeadBeltPropertiesHTML({
      id: 'b1', type: 'fead-belt',
      data: { profile: 'PK', brand: 'GATES', ribs: 8, effLength: 1715, lengthMode: 'fixed' }
    });
    // Kart künyesi ÇÖZÜMDEN BAĞIMSIZ basılıyor (aday listesi çözüm ister,
    // başlık istemez) — kapı bu yüzden başlığa bakıyor.
    expect(h).toContain('ISO 9982');
    expect(h).toContain('Katalog');
  });
});

// ── 4 · AKSESUAR GÜCÜ: model seçilir, değer OTOMATİK gelir ─────────────────
describe('aksesuar modelleri — elle kW girişi YOK', () => {
  const kur = (key) => { kabuk(); wiz.veFeadWizSeed(key); return wiz.veFeadWizState(); };

  test('duty tablosunda kW GİRDİSİ yok, salt okunur değer var', () => {
    kur('AG00976_GATES_2025');
    const h = wiz.veFeadWizStepHTML(5, wiz.veFeadWizBuild());
    expect(h).not.toContain('veFeadWizDutyKw(');       // elle giriş kalktı
    expect(h).toContain('ve-fw-ro');                   // okuma hücresi
    expect(h).toContain('Aksesuar Modelleri');
  });

  test('katalogu olan aksesuarda açılır pencere, olmayanda "katalog yok"', () => {
    const st = kur('AG00976_GATES_2025');
    const h = wiz.veFeadWizStepHTML(5, wiz.veFeadWizBuild());
    // ALT ve KK katalogu var; seçici TEK yazıcıdan geçiyor.
    expect((h.match(/veFeadWizAccModel\(/g) || []).length).toBe(2);
    expect(h).toContain('katalog yok');                // avaralar
    expect(st.pulleys.filter((p) => veFeadPresetLib(p.type)).length).toBe(2);
  });

  // ── SEÇENEKLER EKSİK DEĞİL, GÖRÜNMÜYORDU (kullanıcı, 2026-09-01) ────────
  // İki katalog vardı ve zengin olanı (BMC defteri: 10 alternatör · 4 klima)
  // BAŞKA bir kartın seçicisindeydi; "Aksesuar Modelleri" yalnız Araç
  // Performans kataloğunu (2 · 2) gösteriyordu.
  describe('aksesuar modeli — iki katalogun BİRLEŞİMİ, tek seçici', () => {
    test('liste iki katalogu da içeriyor ve BMC defteri baskın', () => {
      const alt = wiz.veFeadWizAccModelOpts('fead-alternator');
      const bmc = alt.filter((o) => o[0].indexOf('bmc:') === 0);
      const ap = alt.filter((o) => o[0].indexOf('ap:') === 0);
      expect(bmc.length).toBe(veFeadAccList('fead-alternator').length);
      expect(ap.length).toBe(Object.keys(veFeadPresetLib('fead-alternator')).length);
      expect(bmc.length).toBeGreaterThan(ap.length);
      // Eski kart YALNIZ AP'yi gösteriyordu — birleşim ondan kesinlikle geniş.
      expect(alt.length).toBeGreaterThan(ap.length);
      const ac = wiz.veFeadWizAccModelOpts('fead-ac');
      expect(ac.filter((o) => o[0].indexOf('bmc:') === 0).length).toBe(4);
      // Hava kompresörünün defterde karşılığı YOK; AP kataloğu tek kaynak.
      const hk = wiz.veFeadWizAccModelOpts('fead-aircomp');
      expect(hk.length).toBe(Object.keys(veFeadPresetLib('fead-aircomp')).length);
      expect(hk.every((o) => o[0].indexOf('ap:') === 0)).toBe(true);
      // Anahtarlar TEKİL — ön ek olmasa iki katalog çakışabilirdi.
      expect(new Set(alt.map((o) => o[0])).size).toBe(alt.length);
    });

    test('ÖN EK hangi katalog olduğunu söylüyor ve doğru alanı yazıyor', () => {
      const st = kur('AG00976_GATES_2025');
      const alt = st.pulleys.find((p) => p.type === 'fead-alternator');
      const bmcKey = veFeadAccList('fead-alternator')[0].key;

      wiz.veFeadWizAccModel(alt.key, 'bmc:' + bmcKey);
      expect(alt.accLib).toBe(bmcKey);
      expect(alt.accPreset).toBeUndefined();
      expect(Array.isArray(alt.pwrCurve) && alt.pwrCurve.length).toBeTruthy();
      expect(alt.maxContRpm).toBeGreaterThan(0);          // sınırlar da geldi
      expect(wiz.veFeadWizAccModelOf(alt)).toBe('bmc:' + bmcKey);

      // AP'ye geçiş BMC izini TEMİZLER: bırakılsaydı eğri (öncelikli) eski
      // künyeden gelir, kullanıcı seçtiği modelin gücünü GÖREMEZDİ.
      wiz.veFeadWizAccModel(alt.key, 'ap:tepas_350a');
      expect(alt.accPreset).toBe('tepas_350a');
      expect(alt.accLib).toBeFalsy();
      expect(alt.pwrCurve === undefined || alt.pwrCurve.length === 0).toBe(true);
      expect(wiz.veFeadWizAccModelOf(alt)).toBe('ap:tepas_350a');

      wiz.veFeadWizAccModel(alt.key, '');
      expect(alt.accPreset).toBeUndefined();
      expect(alt.accLib).toBeFalsy();
      expect(wiz.veFeadWizAccModelOf(alt)).toBe('');
    });

    test('SINIR KARTINDA ikinci seçici YOK — model tek yerden seçilir', () => {
      const st = kur('AG00976_GATES_2025');
      const yuk = st.pulleys.filter((p) => !p.driver);
      const h = wiz._fwAccLimitCard(st, yuk);
      expect(h).not.toContain('veFeadWizAccLib(');
      expect(h).not.toContain('<select');
      // Ama künye OKUNUYOR: seçim yapılınca orada görünüyor.
      const alt = st.pulleys.find((p) => p.type === 'fead-alternator');
      wiz.veFeadWizAccModel(alt.key, 'bmc:' + veFeadAccList('fead-alternator')[0].key);
      expect(wiz._fwAccLimitCard(wiz.veFeadWizState(),
        wiz.veFeadWizState().pulleys.filter((p) => !p.driver)))
        .toContain(veFeadAccList('fead-alternator')[0].key);
    });
  });

  test('model seçimi KAYITLI kW\'ı TEMİZLER — yoksa eski sayı kataloğu sessizce ezer', () => {
    // veFeadDutyToCore'un öncelik sırası: açıkça yazılı kW > kendi eğrisi >
    // katalog. Temizlenmezse kullanıcı model seçer, tablo değişmez, sebebi
    // görünmez.
    const st = kur('AG00976_GATES_2025');
    const alt = st.pulleys.find((p) => p.type === 'fead-alternator');
    expect(st.solver.duty[0].kw[alt.key]).toBeCloseTo(3.61, 2);
    wiz.veFeadWizAccPreset(alt.key, 'tepas_350a');
    expect(alt.accPreset).toBe('tepas_350a');
    st.solver.duty.forEach((r) => expect(r.kw[alt.key]).toBeUndefined());
  });

  test('seçilen model DÜĞÜME gider ve kW\'ı gerçekten değiştirir', () => {
    const st = kur('AG00976_GATES_2025');
    const alt = st.pulleys.find((p) => p.type === 'fead-alternator');
    const b0 = wiz.veFeadWizBuild();
    const kw0 = wiz._fwKwEff(b0, st, 0, alt).kw;
    wiz.veFeadWizAccPreset(alt.key, 'tepas_350a');
    const b1 = wiz.veFeadWizBuild();
    const t = wiz.veFeadWizNodes(st).nodes.find((n) => n.id === 'wz-' + alt.key);
    expect(t.data.accPreset).toBe('tepas_350a');
    const kw1 = wiz._fwKwEff(b1, st, 0, alt).kw;
    expect(kw1).not.toBeCloseTo(kw0, 3);               // katalog gerçekten devrede
    expect(kw1).toBeGreaterThan(0);
  });

  test('kW KAYNAĞI doğru sırayla çözülür (köprünün sırasının aynısı)', () => {
    const st = kur('BMC_FEAD_2026');                   // aksesuarların KENDİ eğrisi var
    const b = wiz.veFeadWizBuild();
    const alt = st.pulleys.find((p) => p.type === 'fead-alternator');
    expect(wiz._fwKwEff(b, st, 0, alt).kaynak).toBe('egri');
    const st2 = kur('AG00976_GATES_2025');             // güç yalnız duty kW'da
    const b2 = wiz.veFeadWizBuild();
    const alt2 = st2.pulleys.find((p) => p.type === 'fead-alternator');
    expect(wiz._fwKwEff(b2, st2, 0, alt2).kaynak).toBe('kayit');
  });

  test('GÜCÜ OLMAYAN aksesuar uyarılır; avara/gergi uyarılmaz', () => {
    // Sessiz sıfır sınıfı: gücü hiçbir kaynaktan gelmeyen aksesuar 0 kW ile
    // koşar, model yine çözülür ve bütün açıklık gerilmeleri tasarım
    // gerginliğine düzleşir.
    const st = kur('AG00976_GATES_2025');
    const alt = st.pulleys.find((p) => p.type === 'fead-alternator');
    st.solver.duty.forEach((r) => { delete r.kw[alt.key]; });   // gücünü kes
    const h = wiz.veFeadWizStepHTML(5, wiz.veFeadWizBuild());
    expect(h).toMatch(/0 kW.*ile koşacak|gücü hiçbir/i);
    expect(h).toContain('Alternatör');
    // avaralar uyarıda GEÇMEZ (güç çekmemeleri doğru davranış)
    const uyari = h.slice(h.indexOf('ve-fw-issue-warn'));
    expect(uyari.slice(0, 400)).not.toMatch(/Avara/);
  });
});

// ── 5 · ÖZET: kol açısı kutusu kalktı ──────────────────────────────────────
describe('özet kartı — kol açısı kutusu yok', () => {
  test('kol açısı/dönmesi kutusu basılmaz, kalan beş kutu durur', () => {
    kabuk(); wiz.veFeadWizSeed('BMC_FEAD_2026');
    const h = wiz.veFeadWizStepHTML(6, wiz.veFeadWizBuild());
    expect(h).not.toMatch(/Kol açısı|Kol dönmesi/);
    expect((h.match(/class="ve-fw-stat/g) || []).length).toBe(5);
    ['Durum', 'Kasnak', 'Kayış boyu', 'Tasarım gerginliği', 'Dönüş yönü']
      .forEach((k) => expect(h).toContain(k));
  });

  // "BU KÜNYEDEN ÇIKANLAR" KARTI KALKTI (kullanıcı isteği, 2026-08-31):
  // *"'Bu künyeden çıkanlar' kısmına gerek yok. Zaten raporda bunları
  // okuyacağız."* Kart yalnız OKUMA basıyordu; sihirbazda tek bir girdi
  // almıyordu, dolayısıyla kaldırmanın modele etkisi YOK ve bu ölçülüyor.
  test('gergi adımı OKUMA kartı basmıyor — ve model DEĞİŞMİYOR', () => {
    kabuk(); wiz.veFeadWizSeed('AG00976_GATES_2025');
    const b = wiz.veFeadWizBuild();
    const h = wiz.veFeadWizStepHTML(3, b);
    expect(h).not.toMatch(/Bu künyeden çıkanlar/);
    expect(h).not.toMatch(/Yay kurulması|Gereken KAYIŞ BOYU/);
    // MONTAJ KONUMU BUNUN DIŞINDA ve bilerek: bir okuma değil bir ÇIKTI —
    // atölyeye giden sayı ve girdiyi denetleyen tek sayı odur.
    expect(h).toMatch(/Gövdenin Montaj Konumu/);
    // Çözüm çıpası birebir: kaldırılan şey bir GÖRÜNÜM, bir hesap değil.
    expect(b.beltLengthMm).toBeCloseTo(1714.6075, 3);
    expect(b.springTensionN).toBeCloseTo(543.8750, 3);
    // Sayılar RAPORDA duruyor — kullanıcının kendi gerekçesi.
    const RS = fs.readFileSync(path.join(__dirname, '../../js/cp-fead-report.js'), 'utf8');
    expect(RS).toMatch(/Kol açısı|armAbsDeg|kol açısı/i);
  });
});

// ── ÇALIŞMA ÇEVRİMİ TABLO BOŞ AÇILMAZ (kullanıcı isteği, 2026-08-31) ────────
//
// *"Motor ve Çevrim kısmında aksesuar seçtiğimizde çalışma çevrimini otomatik
// olarak hesaplamıyor. El ile girmek gerekiyor. Bu olmamalı."*
//
// ÖLÇÜLDÜ (düzeltmeden önce): taze sihirbazda 0 devir noktası; aksesuar modeli
// seçilse bile doldurulacak satır yoktu.
describe('çalışma çevrimi — tablo dolu açılır', () => {
  test('TAZE sihirbaz boş tabloyla açılmıyor', () => {
    kabuk();
    wiz.veFeadWizReset();
    const st = wiz.veFeadWizState();
    expect(st.solver.duty.length).toBeGreaterThan(0);
    // ...ve yüklenen çevrim ADIYLA yazılı — hangi ölçümden geldiği kayboluyorsa
    // tablo "nereden geldiği bilinmeyen sayılar" olurdu.
    expect(st.solver.dutyLib).toBe(DUTY.VE_FEAD_DUTY_DEFAULT);
    expect(DUTY.veFeadDutyMatch(st.solver.duty)).toBe(DUTY.VE_FEAD_DUTY_DEFAULT);
  });

  test('kW sözlüğü BOŞ gelir — güç elle girilmez, hesaplanır', () => {
    kabuk(); wiz.veFeadWizReset();
    wiz.veFeadWizState().solver.duty.forEach((r) => expect(r.kw).toEqual({}));
  });

  test('6. adımda ÇEVRİM SEÇİCİ var ve yüklü kaydı gösteriyor', () => {
    kabuk(); wiz.veFeadWizReset();
    const h = wiz.veFeadWizStepHTML(5, wiz.veFeadWizBuild());
    expect(h).toContain('Çalışma Çevrimi Kaydı');
    expect(h).toContain('veFeadWizDutyLib');
    // Yüklü kayıt SEÇİLİ görünmeli.
    const rec = DUTY.veFeadDutyOf(DUTY.VE_FEAD_DUTY_DEFAULT);
    expect(h).toContain('value="' + rec.key + '" selected');
    expect(h).toContain(rec.kaynak);           // kaynağı yazılı
  });

  test('çevrim değiştirmek tabloyu O KAYITLA değiştiriyor', () => {
    kabuk(); wiz.veFeadWizReset();
    wiz.veFeadWizDutyLib('AG00902-4');
    const st = wiz.veFeadWizState();
    expect(st.solver.duty.map((r) => r.rpm)).toEqual([700, 1200, 2000, 3000]);
    expect(st.solver.dutyLib).toBe('AG00902-4');
  });

  test('çevrim değişince KAYITLI kW devri tutan satırlarda KORUNUR', () => {
    // Taşınmasaydı çevrim değiştirmek, örneğin rapordan gelen güç tablosunu
    // sessizce silerdi.
    kabuk(); wiz.veFeadWizSeed('AG00976_GATES_2025');
    const st = wiz.veFeadWizState();
    const alt = st.pulleys.find((p) => p.type === 'fead-alternator');
    const kw2000 = st.solver.duty.find((r) => r.rpm === 2000).kw[alt.key];
    expect(kw2000).toBeGreaterThan(0);
    wiz.veFeadWizDutyLib('AG00686-6');          // 800…2000, yani 2000 ORTAK
    const s2 = wiz.veFeadWizState();
    expect(s2.solver.duty.find((r) => r.rpm === 2000).kw[alt.key]).toBe(kw2000);
    // ...ortak OLMAYAN devirde kW yok — uydurulmuyor.
    expect(s2.solver.duty.find((r) => r.rpm === 1750).kw).toEqual({});
  });

  test('elle düzenlenen tablo seçicide ÖZEL diyor — kayıt gibi okutulmuyor', () => {
    kabuk(); wiz.veFeadWizReset();
    wiz.veFeadWizDutySet(0, 'rpm', 1234);
    const h = wiz.veFeadWizStepHTML(5, wiz.veFeadWizBuild());
    expect(h).toContain('özel (elle düzenlendi)');
    expect(DUTY.veFeadDutyMatch(wiz.veFeadWizState().solver.duty)).toBeNull();
  });

  test('ÇÖZÜLEN modelde kW otomatik geliyor — her devir noktasında', () => {
    // Asıl istek bu: aksesuar modeli seçilince tablo kendiliğinden dolsun.
    kabuk(); wiz.veFeadWizSeed('AG00976_GATES_2025');
    const st = wiz.veFeadWizState();
    const b = wiz.veFeadWizBuild();
    const alt = st.pulleys.find((p) => p.type === 'fead-alternator');
    wiz.veFeadWizAccPreset(alt.key, 'tepas_350a');   // kayıtlı ölçümü temizler
    const s2 = wiz.veFeadWizState(), b2 = wiz.veFeadWizBuild();
    const p2 = s2.pulleys.find((p) => p.key === alt.key);
    const kw = s2.solver.duty.map((r, i) => wiz._fwKwEff(b2, s2, i, p2));
    kw.forEach((e) => {
      expect(e.kaynak).toBe('katalog');
      expect(e.kw).toBeGreaterThan(0);
    });
    // Devirle ARTIYOR (alternatör eğrisi) — sabit bir sayı basılmıyor.
    expect(kw[kw.length - 1].kw).toBeGreaterThan(kw[0].kw);
    // Çevrimi değiştirince YENİ devirlerde yine otomatik.
    wiz.veFeadWizDutyLib('AG00902-4');
    const s3 = wiz.veFeadWizState(), b3 = wiz.veFeadWizBuild();
    const p3 = s3.pulleys.find((p) => p.key === alt.key);
    s3.solver.duty.forEach((r, i) => {
      const e = wiz._fwKwEff(b3, s3, i, p3);
      expect(e.kw).toBeGreaterThan(0);
    });
  });

  // ── GÜÇ GEOMETRİDEN BAĞIMSIZ (kullanıcı bildirimi, 2026-08-31) ───────────
  //
  // *"Motor ve çevrim kısmında aksesuarların tiplerini seçtiğimde değerler
  // hala gelmiyor."* Kapı `build.ok`'tı ve YANLIŞ kapıydı: aksesuar devri
  // `driveRatio · r_sürücü / r_i`, yani salt çaptan geliyor. Koordinat
  // girilmeden de bilinir.
  test('KOORDİNATSIZ modelde katalog gücü GELİYOR', () => {
    kabuk(); wiz.veFeadWizReset();
    wiz.veFeadWizPulleyAdd('fead-crank');
    wiz.veFeadWizPulleyAdd('fead-alternator');
    const st = wiz.veFeadWizState();
    const alt = st.pulleys[1];
    st.solver.duty[0].rpm = 1000;
    let b = wiz.veFeadWizBuild();
    expect(b.ok).toBe(false);                       // geometri gerçekten çözülmüyor
    expect(b.ratioSys).toBeTruthy();                // ama oran kurulu
    // Model seçilmeden: gerçekten güç YOK (model eksikliği değil).
    expect(wiz._fwKwEff(b, st, 0, alt).kaynak).toBe('yok');
    wiz.veFeadWizAccPreset(alt.key, 'prestolite_180a');
    b = wiz.veFeadWizBuild();
    const e = wiz._fwKwEff(b, st, 0, alt);
    expect(e.kaynak).toBe('katalog');
    expect(e.kw).toBeGreaterThan(0);
    // Devirle DEĞİŞİYOR — sabit bir sayı basılmıyor.
    st.solver.duty[1].rpm = 2000;
    b = wiz.veFeadWizBuild();
    expect(wiz._fwKwEff(b, st, 1, alt).kw).not.toBeCloseTo(e.kw, 3);
  });

  test('ORAN BİLE KURULAMIYORSA sebep AYRI — "güç yok" denmez', () => {
    // İki durum tek etikete katılmaz: gerçekten güç yok ↔ hesap kurulamıyor.
    // Sayı UYDURULMAZ: profil bilinmiyorsa pitch yarıçapı da bilinmiyor
    // (rPitch = OD/2 + h_b) ve oran kurulamaz.
    kabuk(); wiz.veFeadWizSeed('AG00976_GATES_2025');
    const st = wiz.veFeadWizState();
    st.belt.profile = 'YOKBOYLEPROFIL';
    const b = wiz.veFeadWizBuild();
    expect(b.ratioSys).toBeFalsy();
    const alt = st.pulleys.find((p) => p.type === 'fead-alternator');
    // KAYITLI ÖLÇÜM orandan BAĞIMSIZ ve öncelikli — o yüzden temizleniyor,
    // yoksa kapı doğru sebepten değil kayıt yüzünden geçerdi.
    st.solver.duty.forEach((r) => { delete r.kw[alt.key]; });
    const e = wiz._fwKwEff(b, st, 0, { key: alt.key, type: alt.type });
    expect(e.kaynak).toBe('cozumsuz');
    expect(e.kw).toBeNull();
  });

  test('ÇÖZÜLMÜŞ modelde `ratioSys` ÇÖZÜLMÜŞ sistemin KENDİSİ', () => {
    // İki kaynak tutulsaydı biri düzeltilince öbürü sessizce eskirdi.
    kabuk(); wiz.veFeadWizSeed('AG00976_GATES_2025');
    const b = wiz.veFeadWizBuild();
    expect(b.ok).toBe(true);
    expect(b.ratioSys).toBe(b.sys);
  });

  test('örneklerin KENDİ çevrimi korunuyor — tohum onları ezmiyor', () => {
    kabuk(); wiz.veFeadWizSeed('AG00976_GATES_2025');
    expect(wiz.veFeadWizState().solver.duty.length).toBe(12);
    kabuk(); wiz.veFeadWizSeed('BMC_FEAD_2026');
    expect(wiz.veFeadWizState().solver.duty.length).toBe(9);
  });
});


// ════════════════════════════════════════════════════════════════════════════
//  BEŞ DÜZELTME — kullanıcı turu (2026-08-31, ikinci tur)
// ════════════════════════════════════════════════════════════════════════════

// ── 1 · GERGİ SATIRININ TİP SÜTUNU ─────────────────────────────────────────
// *"otomatik gerginin satırında 'elle gir' gibi bir şey var. O olmayacak,
// orada normal 'Otomatik Gergi' yazacak. Ad kısmı da diğerleri gibi olacak.
// Otomatik gerginin tipinin seçileceği yeri estetik bir şekilde o satıra
// eklememiz gerekiyor."*
describe('gergi satırı — TİP sütunu tipi söyler', () => {
  // Sihirbazın kendi adı — palet adı "Gergi", sihirbaz baştan beri
  // "Otomatik Gergi" diyor ve kullanıcı satırda da onu istedi.
  const tenAd = () => wiz._fwTenAd();

  test('tip hücresi DİĞERLERİYLE AYNI biçimde — tek seçenekli <select>', () => {
    // Kullanıcı isteği (2026-09-01): *"'otomatik gergi' kısmı diğer satırlar
    // gibi olmamış… Onu da diğer satırlar gibi yapalım."* Diğer beş satırda
    // TİP hücresi bir açılır listedir ve hücrenin hizasını o belirler; düz
    // metin satırı görünür biçimde ayırıyordu.
    kabuk(); wiz.veFeadWizSeed('BMC_FEAD_2026');
    const h = wiz._fwTenRow(wiz.veFeadWizState());
    const tip = h.slice(h.indexOf('<td>'), h.indexOf('</td>', h.indexOf('<td>')));
    expect(tip).toContain('<select');
    expect(tip).toContain(tenAd());
    // Kilit GÖRÜNÜMLE değil SEÇENEK KÜMESİYLE: tek seçenek var.
    expect((tip.match(/<option/g) || []).length).toBe(1);
    expect(tip).not.toContain('disabled');
    // Satırda künye seçicisi ve "elle gir" metni YOK.
    expect(h).not.toContain('veFeadWizTenLib');
    expect(h).not.toMatch(/elle gir/);
    // Ama 4. ADIMDA duruyor — seçim kaybolmadı, yer değiştirdi.
    const g = wiz.veFeadWizStepHTML(3, wiz.veFeadWizBuild());
    expect(g).toContain('veFeadWizTenLib(this.value)');
    expect(g).toMatch(/elle gir/);
  });

  test('yer tutucu, ad boşken KURULACAK adın TA KENDİSİ', () => {
    // Ayrışsalardı kullanıcı yer tutucuda bir ad görüp kanvasta başkasını
    // bulurdu — bu deponun tekrar eden "iki yüzey, iki kaynak" sınıfı.
    kabuk(); wiz.veFeadWizReset();
    expect(wiz._fwTenRow(wiz.veFeadWizState())).toContain('placeholder="' + tenAd() + '"');
    const pack = wiz.veFeadWizNodes(wiz.veFeadWizState());
    const ten = pack.nodes.find((n) => n.type === 'fead-tensioner');
    expect(ten.customName).toBe(tenAd());
    expect(tenAd()).toBe('Otomatik Gergi');
  });

  test('SATIR diğerleriyle BİREBİR — sütun sayısı ve hücre biçimleri', () => {
    // *"Otomatik gergi satırı da diğerleri gibi olsun. Örneğin 'X/Y = montaj
    // noktası' gibi garip belirteçlere gerek yok."* Çip SİLİNDİ ama UYARI
    // silinmedi: alanların `title`ına ve tablonun altındaki karta taşındı
    // (karıştırmanın ölçülmüş bedeli gerginlikte medyan +%1526).
    kabuk(); wiz.veFeadWizSeed('AG00976_GATES_2025');
    const tam = wiz.veFeadWizStepHTML(1, wiz.veFeadWizBuild());
    const gergi = wiz._fwTenRow(wiz.veFeadWizState());
    // Kasnak satırlarıyla AYNI sütun sayısı.
    const say = (r) => (r.match(/<td/g) || []).length;
    const ilk = tam.slice(tam.indexOf('<tbody>'), tam.indexOf('</tr>', tam.indexOf('<tbody>')));
    expect(say(gergi)).toBe(say(ilk));
    // Fazladan hiçbir rozet/çip yok.
    expect(gergi).not.toContain('ve-fw-tag');
    expect(gergi).not.toContain('ve-fw-sub');
    expect(gergi).not.toMatch(/X\/Y = /);
  });

  test('CSS: tip hücresi TANIMLI, ölü kural KALMAMIŞ', () => {
    // Sınıf basılıp kuralı olmayan bir hücre sessizce hizasız kalır.
    expect(CSS).toMatch(/\.ve-fw-tip-ten\s*\{/);
    // Kural TEK KEZ: satır bir dönem iki katmanlıydı (ad + künye seçici) ve
    // o zamanın flex kuralı geride kalsaydı düz metin hücresini de flex kutusu
    // yapardı — iki kural aynı sınıfa farklı düzen dayatırdı.
    expect((CSS.match(/\.ve-fw-tip-ten\s*\{/g) || []).length).toBe(1);
    // `.ve-fw-sub` artık HİÇBİR yerde kullanılmıyor; kuralı da kalmamalı.
    expect(WIZ_SRC).not.toContain('ve-fw-sub');
    expect(CSS).not.toContain('ve-fw-sub');
  });
});

// ── 2 · DÖNÜŞ YÖNÜ "Kasnaklar" adımında ────────────────────────────────────
// *"'Kasnaklar' kısmına 'dönüş yönü' seçmeyi de eklememiz gerekiyor. Dönüş
// yönünü seçtikten sonra matematik ve topoloji buna göre belirlensin."*
describe('dönüş yönü — Kasnaklar adımında seçilir', () => {
  test('DURUM TUTMUYOR: seçim SIRAYI çeviriyor, düğüme bayrak yazmıyor', () => {
    kabuk(); wiz.veFeadWizSeed('AG00976_GATES_2025');
    const st = wiz.veFeadWizState();
    let b = wiz.veFeadWizBuild();
    const y0 = b.spin, r0 = st.route.slice();
    expect(y0).not.toBe(0);

    // AYNI yön seçilirse HİÇBİR ŞEY olmaz (aksi hâlde bir aç/kapa gibi
    // davranır ve ikinci tık sırayı geri çevirirdi).
    expect(wiz.veFeadWizSpinSet(y0)).toBe(false);
    expect(st.route).toEqual(r0);

    // TERS yön: sıra çevrilir, yön çevrilir.
    expect(wiz.veFeadWizSpinSet(-y0)).toBe(true);
    expect(st.route).not.toEqual(r0);
    b = wiz.veFeadWizBuild();
    expect(b.spin).toBe(-y0);

    // Duruma "yön" diye bir alan YAZILMIYOR — ikinci gerçek kaynak yok.
    expect(JSON.stringify(st)).not.toMatch(/"spin"|"dir"|"yon"/);

    // Geri dönüş BİREBİR.
    expect(wiz.veFeadWizSpinSet(y0)).toBe(true);
    expect(st.route).toEqual(r0);
    expect(wiz.veFeadWizBuild().spin).toBe(y0);
  });

  test('GEOMETRİ DEĞİŞMEZ — cebirsel özdeşlik', () => {
    // Ters yürütmek hem `sense`i hem giriş/çıkış teğetlerini takas eder;
    // iki işaret birbirini götürür. Ölçülüyor ki bir gün "yönü çevirmek
    // kayış boyunu da değiştirsin" diye bir düzeltme sessizce girmesin.
    kabuk(); wiz.veFeadWizSeed('AG00976_GATES_2025');
    const b0 = wiz.veFeadWizBuild();
    const L0 = b0.beltLengthMm, rel0 = b0.relDeg;
    wiz.veFeadWizSpinSet(-b0.spin);
    const b1 = wiz.veFeadWizBuild();
    expect(b1.beltLengthMm).toBeCloseTo(L0, 6);
    expect(b1.relDeg).toBeCloseTo(rel0, 6);
  });

  test('YALNIZ Kasnaklar adımında — Kayış Yolu\'nda CCW/CW düğmesi YOK', () => {
    // Kullanıcı isteği (2026-08-31): *"'kayış yolu' kısmında CCW ve CW
    // butonlarına gerek yok. Zaten dönüş yönünü 'kasnaklar' kısmında
    // hallediyoruz."* Yön OKUMASI kaybolmuyor: canlı şerit her adımda basıyor.
    kabuk(); wiz.veFeadWizSeed('BMC_FEAD_2026');
    const b = wiz.veFeadWizBuild();
    const kontrol = wiz.veFeadWizSpinHTML(b);
    expect(wiz.veFeadWizStepHTML(1, b)).toContain(kontrol);
    expect(wiz.veFeadWizStepHTML(2, b)).not.toContain('ve-fw-spinbox');
    expect(wiz.veFeadWizStepHTML(2, b)).not.toContain('veFeadWizSpinSet');
    // Sıra çevirme düğmesi KALIYOR — adımın konusu serpantin sırası.
    expect(wiz.veFeadWizStepHTML(2, b)).toContain('veFeadWizRouteReverse()');
    // Yön yine görünüyor (canlı şerit).
    expect(wiz.veFeadWizStepHTML(2, b)).toMatch(/CCW|CW/);
    expect(kontrol).toContain('ve-fw-spin-on');
  });

  test('yön OKUNAMIYORSA düğmeler kapalı — hüküm uydurulmaz', () => {
    kabuk(); wiz.veFeadWizReset();
    const h = wiz.veFeadWizSpinHTML(wiz.veFeadWizBuild());
    expect((h.match(/disabled/g) || []).length).toBe(2);
    expect(h).not.toContain('ve-fw-spin-on');
    // Kapalıyken çağrılsa bile sırayı BOZMAZ.
    const r0 = wiz.veFeadWizState().route.slice();
    expect(wiz.veFeadWizSpinSet(1)).toBe(false);
    expect(wiz.veFeadWizState().route).toEqual(r0);
  });

  test('CSS sınıfı tanımlı ve CW ↔ CCW AYNI renkte', () => {
    // İkisi de eşit meşru: birine amber vermek "bu yön hesaplanmış, öbürü
    // girilmiş" derdi ve yalan olurdu (kanvastaki fead-spin rozetinin kuralı).
    expect(CSS).toMatch(/\.ve-fw-spin\s*\{/);
    expect(CSS).toMatch(/\.ve-fw-spin-on\s*\{/);
    const h = wiz.veFeadWizSpinHTML({ spin: 1 });
    expect(h).toContain('CCW');
    expect(h).toContain('CW');
    // Sınıf dışında satır içi renk YOK.
    expect(h).not.toMatch(/style="[^"]*color/);
  });
});

// ── SIRA: OKUNAN ve YAZILAN sıra AYNI OLMAK ZORUNDA ───────────────────────
//
// Gergi `st.pulleys`ta değil `st.ten`de; `'__ten__'` anahtarını sıraya
// `veFeadWizRoute` ANLIK ekliyordu ve `_fwState.route`a yazmıyordu. Taşıma ile
// çevirme YAZILAN sırada çalıştığı için iki işlem de yanlış sırayı görüyordu.
describe('serpantin sırası — iki sıra birleşti', () => {
  // Elle kurulmuş model: sıra `'__ten__'` TAŞIMIYOR (örnek kurucusu taşıyor).
  const elleKur = () => {
    kabuk(); wiz.veFeadWizSeed('AG00976_GATES_2025');
    const st = wiz.veFeadWizState();
    st.route = st.route.filter((k) => k !== '__ten__');
    return st;
  };

  test('ÇEVİRME gerçekten ÇEVİRİYOR — gergiyi halkada kaydırmıyor', () => {
    // ÖLÇÜLDÜ (düzeltmeden önce): okunan sıra `p1>p2>p3>p4>p5>__ten__` →
    // `p1>p5>p4>p3>p2>__ten__`, yani gergi SONDA kaldı; kayış boyu
    // 1714,61 → 2459,29 mm, gerginlik 543,85 → 323,41 N.
    const st = elleKur();
    const b0 = wiz.veFeadWizBuild();
    const okunan0 = wiz.veFeadWizRoute(st).slice();
    wiz.veFeadWizRouteReverse();
    const b1 = wiz.veFeadWizBuild();
    const okunan1 = wiz.veFeadWizRoute(st);
    // Gerçek çevirme: ilk öge sabit, gerisi ters.
    expect(okunan1).toEqual([okunan0[0]].concat(okunan0.slice(1).reverse()));
    // GEOMETRİ DEĞİŞMEZ — cebirsel özdeşlik elle kurulmuş modelde de geçerli.
    expect(b1.beltLengthMm).toBeCloseTo(b0.beltLengthMm, 6);
    expect(b1.springTensionN).toBeCloseTo(b0.springTensionN, 6);
    expect(b1.spin).toBe(-b0.spin);
    expect(b1.warnings).toEqual([]);
  });

  test('GERGİ SATIRI TAŞINABİLİYOR — oklar artık ölü değil', () => {
    // ÖLÇÜLDÜ: `indexOf('__ten__') < 0` ile erken dönüyordu; 3. adımdaki
    // yukarı/aşağı okları etkin görünüp hiçbir şey yapmıyordu.
    const st = elleKur();
    const once = wiz.veFeadWizRoute(st).join('>');
    wiz.veFeadWizRouteMove('__ten__', -1);
    const sonra = wiz.veFeadWizRoute(st).join('>');
    expect(sonra).not.toBe(once);
    expect(sonra.split('>').indexOf('__ten__'))
      .toBe(once.split('>').indexOf('__ten__') - 1);
  });

  test('YAZMA BİRİM İŞLEM — seedlenmiş sıra değişmiyor', () => {
    kabuk(); wiz.veFeadWizSeed('BMC_FEAD_2026');
    const st = wiz.veFeadWizState();
    const r0 = st.route.slice();
    wiz.veFeadWizRouteReverse();
    wiz.veFeadWizRouteReverse();
    expect(st.route).toEqual(r0);
  });

  test('YÖN SEÇİCİSİ de bu yoldan geçiyor — elle kurulmuş modelde', () => {
    const st = elleKur();
    const b0 = wiz.veFeadWizBuild();
    expect(wiz.veFeadWizSpinSet(-b0.spin)).toBe(true);
    const b1 = wiz.veFeadWizBuild();
    expect(b1.spin).toBe(-b0.spin);
    expect(b1.beltLengthMm).toBeCloseTo(b0.beltLengthMm, 6);
    expect(b1.warnings).toEqual([]);
  });
});

// ── 4 · KÜNYE SEÇİLİYSE PARÇA ALANLARI KİLİTLİ ─────────────────────────────
// *"'Otomatik Gergi' kısmında, 'elle gir' haricinde, diğer gergiler
// seçildiğinde değerler değiştirilmemeli. Eğer illa değiştirilecekse,
// kullanıcı seçeceği gergiyi seçip, ardından 'elle gir' seçeneğine tıklamalı
// ve buna tıklayınca önceki seçtiği gergi değerleri gelmeli."*
describe('gergi künyesi — seçiliyken parça alanları kilitli', () => {
  const KILITLI = ['ten.armLen', 'ten.od', 'ten.preload', 'ten.kArm', 'ten.meanLoad'];

  test('künye seçilince parça alanları readonly, montaj konumu AÇIK', () => {
    kabuk(); wiz.veFeadWizSeed('BMC_FEAD_2026');
    wiz.veFeadWizTenLib('AG00894');
    expect(wiz.veFeadWizTenLocked()).toBe(true);
    const h = wiz.veFeadWizStepHTML(3, wiz.veFeadWizBuild());
    KILITLI.forEach((yol) => {
      const i = h.indexOf("_fwSet('" + yol + "'");
      expect(i).toBeGreaterThan(-1);
      const alan = h.slice(h.lastIndexOf('<input', i), i);
      expect(alan).toContain('readonly');
      expect(alan).toContain('ve-fw-lock');
    });
    // Temas tarafı da parçanın verisi (künye onu da yazıyor).
    const ci = h.indexOf("_fwSetRender('ten.contact'");
    expect(h.slice(h.lastIndexOf('<select', ci), ci)).toContain('disabled');
    // MONTAJ KONUMU MOTORUN VERİSİ — asla kilitlenmez.
    ['ten.pivotX', 'ten.pivotY'].forEach((yol) => {
      const i = h.indexOf("_fwSet('" + yol + "'");
      expect(h.slice(h.lastIndexOf('<input', i), i)).not.toContain('readonly');
    });
  });

  test('"elle gir" KİLİDİ AÇAR ve seçilen künyenin değerlerini KORUR', () => {
    kabuk(); wiz.veFeadWizSeed('BMC_FEAD_2026');
    wiz.veFeadWizTenLib('AG00879');            // kol 56 mm · 31.14 Nm — belirgin
    const t = wiz.veFeadWizState().ten;
    const kunye = { armLen: t.armLen, preload: t.preload, kArm: t.kArm,
                    meanLoad: t.meanLoad, od: t.od, contact: t.contact };
    expect(kunye.armLen).toBeCloseTo(56, 6);

    wiz.veFeadWizTenLib('');                   // ← "elle gir"
    expect(wiz.veFeadWizTenLocked()).toBe(false);
    const t2 = wiz.veFeadWizState().ten;
    Object.keys(kunye).forEach((k) => expect(t2[k]).toEqual(kunye[k]));
    expect(t2.tenLib).toBe('');

    const h = wiz.veFeadWizStepHTML(3, wiz.veFeadWizBuild());
    KILITLI.forEach((yol) => {
      const i = h.indexOf("_fwSet('" + yol + "'");
      expect(h.slice(h.lastIndexOf('<input', i), i)).not.toContain('readonly');
    });
  });

  test('gergi SATIRI da aynı kilidi okuyor — iki yüzey ayrışamaz', () => {
    kabuk(); wiz.veFeadWizSeed('BMC_FEAD_2026');
    const acik = wiz._fwTenRow(wiz.veFeadWizState());
    expect(acik).not.toContain('readonly');
    wiz.veFeadWizTenLib('AG00894');
    const kilitli = wiz._fwTenRow(wiz.veFeadWizState());
    expect(kilitli).toContain('readonly');
    expect(kilitli).toContain('ve-fw-lock');
  });

  test('kilit SAYIYI GİZLEMİYOR — readonly, disabled değil', () => {
    // Soluk/boş bir alan "veri yok" gibi okunurdu; kullanıcı *"değerler
    // değiştirilmemeli"* dedi, *"görünmesin"* değil.
    kabuk(); wiz.veFeadWizSeed('BMC_FEAD_2026');
    wiz.veFeadWizTenLib('AG00879');
    const h = wiz.veFeadWizStepHTML(3, wiz.veFeadWizBuild());
    const i = h.indexOf("_fwSet('ten.armLen'");
    const alan = h.slice(h.lastIndexOf('<input', i), i);
    expect(alan).toContain('value="56"');
    expect(alan).not.toMatch(/\sdisabled/);
    expect(CSS).toMatch(/\.ve-fw-inp\.ve-fw-lock\s*\{/);
  });

  test('kilit ÇÖZÜMÜ değiştirmiyor — yalnız yüzey', () => {
    kabuk(); wiz.veFeadWizSeed('AG00976_GATES_2025');
    const b0 = wiz.veFeadWizBuild();
    const st = wiz.veFeadWizState();
    const L0 = b0.beltLengthMm, T0 = b0.springTensionN;
    st.ten.tenLib = '';                        // kilidi aç, değeri değiştirme
    const b1 = wiz.veFeadWizBuild();
    expect(b1.beltLengthMm).toBeCloseTo(L0, 9);
    expect(b1.springTensionN).toBeCloseTo(T0, 9);
  });
});

// ── 6 · KAYIŞ ADIMI: künye · malzeme · kip seçicisi KALKTI ─────────────────
// *"'Kayış' kısmında, 'Künye' ve 'Malzeme' kısımlarına gerek yok… programda
// SADECE VE SADECE kayış boyunu çıktı olarak verecek… Ama 'Kayış'
// penceresindeki 'profil ve marka' kısmı kalsın."*
describe('kayış adımı — tek çıktı, profil kalır', () => {
  test('üç kart da YOK, "Profil ve Marka" DURUYOR', () => {
    kabuk(); wiz.veFeadWizSeed('AG00976_GATES_2025');
    const h = wiz.veFeadWizStepHTML(4, wiz.veFeadWizBuild());
    expect(h).toContain('Profil ve Marka');
    expect(h).toContain("_fwSetRender('belt.profile'");
    expect(h).toContain("_fwSetRender('belt.brand'");
    expect(h).toContain("_fwSet('belt.ribs'");
    // Kalkanlar:
    expect(h).not.toMatch(/>Künye</);
    expect(h).not.toMatch(/>Malzeme</);
    expect(h).not.toContain("belt.beltType");
    expect(h).not.toContain("belt.tolerance");
    expect(h).not.toContain("belt.wearPct");
    expect(h).not.toContain("belt.massPerRibKgM");
    expect(h).not.toContain("belt.beltDataMode");
    expect(h).not.toMatch(/seçilen kayışın sabitleriyle hesapla/);
  });

  test('boy bir ÇIKTI ve katalog sabitleri KAPALI diye YAZILI', () => {
    kabuk(); wiz.veFeadWizSeed('AG00976_GATES_2025');
    const b = wiz.veFeadWizBuild();
    const h = wiz.veFeadWizStepHTML(4, b);
    expect(h).toContain('SERBEST (kilitli)');
    expect(h).toMatch(/Gereken boy \(çıktı\)/);
    expect(h).toContain('1714.6');
    // Ne kapandığı ADIYLA yazılı — bir özet yüzeyin en pahalı sessiz hatası,
    // İÇERMEDİĞİ bir hesabın yapıldığı izlenimini bırakmasıdır.
    expect(h).toMatch(/KAPALI/);
    // Üretilmeyenlerin listesi bir AÇIKLAMA değil, bir OKUMA satırı — kartın
    // altındaki paragraflar kalktığı için (kullanıcı isteği, 2026-09-02)
    // sayısal okumaların yanına taşındı.
    expect(h).toContain('Üretilmeyenler');
    (VE_FEAD_BELT_DATA_OFF || []).forEach((ad) => expect(h).toContain(ad));
  });

  test('kurulan model kayış kipini AÇIK bırakamaz', () => {
    kabuk(); wiz.veFeadWizSeed('AG00976_GATES_2025');
    const st = wiz.veFeadWizState();
    st.belt.beltDataMode = 'full';             // eski bir taslakta yazılı kalmış
    const pack = wiz.veFeadWizNodes(st);
    const belt = pack.nodes.find((n) => n.type === 'fead-belt');
    expect(belt.data.beltDataMode).toBe('none');
  });

  test('SORULMAYAN alan TAŞINMAYAN alan DEĞİL — örnek verisi korunuyor', () => {
    // Kullanıcı *"otomatik olarak gelsin"* dedi: alanlar sihirbazdan kalktı,
    // ama örnekten gelen tip/kod, tolerans, aşınma ve kütle kayış düğümüne
    // taşınmaya devam ediyor (Kayış Özellikleri panelinde düzenlenebilir).
    kabuk(); wiz.veFeadWizSeed('AG00976_GATES_2025');
    const pack = wiz.veFeadWizNodes(wiz.veFeadWizState());
    const d = pack.nodes.find((n) => n.type === 'fead-belt').data;
    expect(d.beltType).toBe('8PK1715HD');
    expect(d.tolerance).toBeCloseTo(6, 6);
    expect(d.wearPct).toBeCloseTo(0.006, 6);
    expect(d.massPerRibKgM).toBeCloseTo(0.0196, 6);
    expect(d.profile).toBe('PK');
  });
});

// ── 8 · GİRDİLER TOPOLOJİYE GERÇEKTEN ULAŞIYOR ─────────────────────────────
// *"başlangıç sihirbazında girilen girdilerin, topolojideki bileşenlere doğru
// aktarıldığından da emin olalım. Örneğin aksesuar tiplerini seçtikten sonra,
// topoloji üzerindeki bileşen üzerinden bu aksesuarın tipini vs göreyim."*
describe('sihirbaz girdisi → topoloji bileşeni', () => {
  const sahneKur = () => {
    kabuk();
    global.nodes = []; global.connections = [];
    let seq = 0;
    global.createNode = (type, x, y) => {
      const d = componentDefs[type] || {};
      const n = { id: 'cv-' + (++seq), type, x, y, data: {},
                  width: d.width || 60, height: d.height || 56 };
      nodes.push(n); return n;
    };
    global.createConnection = (a, b) => { connections.push({ id: 'k' + (++seq), from: a, to: b }); };
  };

  test('aksesuar MODELİ düğüme yazılıyor VE bileşen panelinde seçili görünüyor', () => {
    sahneKur();
    wiz.veFeadWizSeed('AG00976_GATES_2025');
    const st = wiz.veFeadWizState();
    const alt = st.pulleys.find((p) => p.type === 'fead-alternator');
    wiz.veFeadWizAccPreset(alt.key, 'tepas_350a');
    expect(wiz.veFeadWizCreate()).toBeTruthy();

    const an = nodes.find((n) => n.type === 'fead-alternator');
    expect(an.data.accPreset).toBe('tepas_350a');
    // KULLANICININ SORDUĞU ŞEY: bileşenin KENDİ panelinden görünüyor mu.
    const h = getFeadPulleyPropertiesHTML(an);
    expect(h).toContain('Katalog Modeli');
    const kart = h.slice(h.indexOf('Katalog Modeli'));
    expect(kart.slice(0, kart.indexOf('</select>')))
      .toContain('value="tepas_350a" selected');
  });

  test('kasnak · gergi · kayış · çözücü alanlarının hepsi taşınıyor', () => {
    sahneKur();
    wiz.veFeadWizSeed('AG00976_GATES_2025');
    wiz.veFeadWizCreate();

    const ten = nodes.find((n) => n.type === 'fead-tensioner');
    // Gergi TEK koordinat taşır ve montaj konumu ASLA yazılmaz.
    expect(ten.data.cenX).toBeCloseTo(-161.97, 6);
    expect(ten.data.cenY).toBeCloseTo(91.29, 6);
    expect(ten.data.pivotX).toBeUndefined();
    expect(ten.data.pivotY).toBeUndefined();
    ['armLen', 'armMeanDeg', 'preload', 'kArm', 'meanLoad', 'armInertia',
     'pulleyMass', 'loadStopRelDeg', 'inertia', 'od'].forEach((a) => {
      expect(Number.isFinite(ten.data[a])).toBe(true);
    });

    const ac = nodes.find((n) => n.type === 'fead-ac');
    expect(ac.data.od).toBeCloseTo(152, 6);
    expect(ac.data.contact).toBe('grooved');
    expect(Number.isFinite(ac.data.x)).toBe(true);

    const sol = nodes.find((n) => n.type === 'fead-solver');
    expect(sol.data.duty.length).toBe(12);
    expect(sol.data.cylinders).toBe(6);
    expect(sol.data.serviceFact).toBeCloseTo(1.3, 6);
    // kW SÖZLÜĞÜ KANVAS KİMLİĞİNE GÖÇTÜ — `wz-` kalıntısı SESSİZ 0 kW demekti.
    Object.keys(sol.data.duty[0].kw).forEach((k) => {
      expect(k).not.toMatch(/^wz-/);
      expect(nodes.some((n) => n.id === k)).toBe(true);
    });
  });

  test('KURULAN model önizlemeyle BİREBİR aynı çözümü veriyor', () => {
    sahneKur();
    wiz.veFeadWizSeed('AG00976_GATES_2025');
    const once = wiz.veFeadWizBuild();
    wiz.veFeadWizCreate();
    const sonra = veFeadBuildSystem(nodes, connections);
    expect(sonra.ok).toBe(true);
    expect(sonra.beltLengthMm).toBeCloseTo(once.beltLengthMm, 6);
    expect(sonra.springTensionN).toBeCloseTo(once.springTensionN, 6);
    expect(sonra.spin).toBe(once.spin);
  });
});


// ════════════════════════════════════════════════════════════════════════════
//  ÜÇÜNCÜ KULLANICI TURU (2026-08-31) — kozmetik + iki ölçülmüş kusur
// ════════════════════════════════════════════════════════════════════════════

// ── 1 · YÜKLENEN ÖRNEK KARTI BELİRGİN ──────────────────────────────────────
// *"Başlangıç kısmında 'örnekten doldur' kategorisi var. Buradan bir seçenek
// seçtiğimizde seçtiğimiz seçeneğin belirgin olmasını istiyorum."*
describe('örnekten doldur — AÇILIR LİSTE, yüklenen belirgin', () => {
  // YÜZEY DEĞİŞTİ, ANLAM DEĞİŞMEDİ. Kart yığını açılır listeye döndü
  // (kullanıcı, 2026-09-02: *"pencereyi uzatmasaydın keşke, böyle aşağıya
  // indirilebilir bir pencere yapsaydın"*) — üç örnek için tasarlanmış liste
  // arşivin tamamı girince ON İKİ tam genişlik kartı oldu ve 1. adım
  // kaydırmasız okunamaz hâle geldi. Aşağıdaki dört kapı ESKİSİYLE AYNI
  // ayrımları tutuyor, yalnız işareti <option selected> üzerinden okuyor.
  const secenekler = () => {
    const h = wiz.veFeadWizStepHTML(0, wiz.veFeadWizBuild());
    return (h.match(/<option[^>]*>[^<]*<\/option>/g) || []);
  };
  const secili = () => secenekler().filter((x) => /\sselected/.test(x));

  test('taze sihirbazda HİÇBİR ÖRNEK seçili değil — iddia uydurulmuyor', () => {
    kabuk();
    _fwSifirla();
    const o = secenekler();
    expect(o.length).toBeGreaterThan(2);
    // Yalnız başlık satırı işaretsiz duruyor; hiçbir örnek "yüklendi" demiyor.
    expect(secili()).toHaveLength(0);
    expect(wiz.veFeadWizStepHTML(0, wiz.veFeadWizBuild())).not.toContain('ve-fw-seeded');
  });

  test('örnek yüklenince YALNIZ o seçenek işaretli', () => {
    kabuk(); wiz.veFeadWizSeed('AG00976_GATES_2025');
    const i = secili();
    expect(i).toHaveLength(1);
    expect(i[0]).toContain(veFeadExampleOf('AG00976_GATES_2025').name);
    // "Yüklendi" ayrımı <select>'in kendisinde YOK — durum satırı taşıyor.
    const h = wiz.veFeadWizStepHTML(0, wiz.veFeadWizBuild());
    expect(h).toContain('ve-fw-seeded');
    expect(h).toContain('yüklendi');
    expect(h).toContain(veFeadExampleOf('AG00976_GATES_2025').name);
  });

  test('işaret SEÇENEKTEN SEÇENEĞE geçiyor, birikmiyor', () => {
    kabuk(); wiz.veFeadWizSeed('AG00976_GATES_2025');
    wiz.veFeadWizSeed('BMC_FEAD_2026');
    const i = secili();
    expect(i).toHaveLength(1);
    expect(i[0]).toContain(veFeadExampleOf('BMC_FEAD_2026').name);
  });

  test('"Boş başla" da bir SEÇİMDİR ve işaretleniyor', () => {
    kabuk(); wiz.veFeadWizSeed('BMC_FEAD_2026');
    wiz.veFeadWizReset();
    const i = secili();
    expect(i).toHaveLength(1);
    expect(i[0]).toContain('Boş başla');
  });

  test('BAŞLIK SATIRI bir seçim DEĞİL — listeyi açıp kapatmak silmiyor', () => {
    // Açılır listenin kart yığınında olmayan riski: kullanıcı listeyi açıp
    // başlık satırına dönerse yüklü örnek SESSİZCE silinirdi.
    kabuk(); wiz.veFeadWizSeed('BMC_FEAD_2026');
    wiz.veFeadWizSeedPick('__');
    expect(wiz.veFeadWizState().seededFrom).toBe('BMC_FEAD_2026');
    // '' ise gerçek eylem: temizle.
    wiz.veFeadWizSeedPick('');
    expect(wiz.veFeadWizState().seededFrom).toBe('');
  });

  test('PENCERE ÖRNEK SAYISIYLA BÜYÜMÜYOR — asıl kazanç bu', () => {
    // Kullanıcının bildirdiği sorun buydu. Kapı sayıya değil BİÇİME bakıyor:
    // örnek başına bir blok eleman üretilirse (kart/düğme) liste yine uzar.
    // Kayıt defterine örnek eklemek 1. adımın yüksekliğini DEĞİŞTİRMEMELİ.
    kabuk(); _fwSifirla();
    const h = wiz.veFeadWizStepHTML(0, wiz.veFeadWizBuild());
    const n = veFeadExampleKeys().length;
    expect(n).toBeGreaterThan(10);                       // arşivin tamamı
    expect((h.match(/<option[^>]*>/g) || []).length).toBeGreaterThanOrEqual(n);
    // Örnek başına tam genişlik düğme YOK.
    expect(h).not.toContain('ve-fw-btn-wide');
    expect((h.match(/<select/g) || []).length).toBe(1);  // tek denetim
  });

  test('iz TASLAKLA birlikte kalıyor — kullanıcı neyle başladığını görüyor', () => {
    kabuk(); wiz.veFeadWizSeed('BMC_FEAD_2026');
    expect(wiz.veFeadWizState().seededFrom).toBe('BMC_FEAD_2026');
  });

  test('iz ÇÖZÜME GİRMİYOR — salt künye', () => {
    kabuk(); wiz.veFeadWizSeed('AG00976_GATES_2025');
    const b0 = wiz.veFeadWizBuild();
    const pack0 = wiz.veFeadWizNodes(wiz.veFeadWizState());
    wiz.veFeadWizState().seededFrom = 'baska-bir-sey';
    const b1 = wiz.veFeadWizBuild();
    expect(b1.beltLengthMm).toBeCloseTo(b0.beltLengthMm, 9);
    // Düğüm verisinde hiçbir yerde geçmiyor.
    expect(JSON.stringify(pack0.nodes)).not.toMatch(/seededFrom/);
  });

  test('CSS: işaretli kart GÖLGE + şerit taşıyor', () => {
    expect(CSS).toMatch(/\.ve-fw-btn-wide\.ve-fw-btn-on\s*\{/);
    expect(CSS).toMatch(/\.ve-fw-btn-mark\s*\{/);
    const kural = CSS.slice(CSS.indexOf('.ve-fw-btn-wide.ve-fw-btn-on{'));
    expect(kural.slice(0, kural.indexOf('}'))).toMatch(/box-shadow/);
  });
});

// ── 4 · AKSESUAR TABLOSU SEÇİMLE KAYMAZ ────────────────────────────────────
// *"'aksesuar modelleri' kısmında alternatör tiplerini seçtiğimde, tablo garip
// bir şekilde kayıyor, yana çekiliyor."*
//
// ÖLÇÜLDÜ (gerçek tarayıcı): açılır listenin genişliği 362 → 283 px. Sebep
// `table-layout` varsayılanının AUTO olması: "Güç kaynağı" hücresi model
// seçilince uzuyor ve payı Model sütunundan çalıyor.
describe('aksesuar tablosu — sütunlar seçimle oynamıyor', () => {
  test('sabit düzen + oranlı colgroup', () => {
    kabuk(); wiz.veFeadWizSeed('AG00976_GATES_2025');
    const st = wiz.veFeadWizState();
    const yuk = st.pulleys.filter((p) => !p.driver);
    const h = wiz._fwAccCard(st, wiz.veFeadWizBuild(), yuk);
    expect(h).toContain('ve-fw-tbl-fixed');
    expect(h).toContain('<colgroup>');
    const yuzde = (h.match(/width:(\d+)%/g) || []).map((x) => +x.match(/\d+/)[0]);
    expect(yuzde.length).toBe(3);
    expect(yuzde.reduce((a, b) => a + b, 0)).toBe(100);
  });

  test('CSS kuralı VAR — sınıf basılıp kuralı olmayan bir düzen sessizce eski', () => {
    expect(CSS).toMatch(/\.ve-fw-tbl\.ve-fw-tbl-fixed\s*\{[^}]*table-layout:\s*fixed/);
    // Açılır listenin kendi min-width'i sabit düzeni EZERDİ.
    expect(CSS).toMatch(/\.ve-fw-tbl\.ve-fw-tbl-fixed select\.ve-fw-inp\s*\{[^}]*min-width:\s*0/);
  });

  test('model seçmek sütun oranlarını DEĞİŞTİRMİYOR', () => {
    kabuk(); wiz.veFeadWizSeed('AG00976_GATES_2025');
    const st = wiz.veFeadWizState();
    const yuk = () => wiz.veFeadWizState().pulleys.filter((p) => !p.driver);
    const kol = (h) => (h.match(/<col style="width:[^"]+">/g) || []).join('|');
    const once = kol(wiz._fwAccCard(st, wiz.veFeadWizBuild(), yuk()));
    const alt = st.pulleys.find((p) => p.type === 'fead-alternator');
    wiz.veFeadWizAccPreset(alt.key, 'tepas_350a');
    const sonra = kol(wiz._fwAccCard(wiz.veFeadWizState(), wiz.veFeadWizBuild(), yuk()));
    expect(sonra).toBe(once);
    expect(once).not.toBe('');
  });
});

// ── 5 · KAYDIRMA KONUMU KORUNUYOR ──────────────────────────────────────────
// *"'Çalışma çevrimi' kısmında 'çevrim' seçtiğim zaman, sayfa en tepeye
// atıyor. Seçtiğim yerde kalmıyor yani."*
describe('kaydırma konumu — aynı adımda korunur, adım değişince sıfırlanır', () => {
  const govde = () => document.getElementById('ve-fw-body');
  const sahne = (yukseklik) => {
    kabuk();
    const b = govde();
    // jsdom yerleşim yapmıyor: scrollHeight/clientHeight elle tanımlanır ki
    // kırpma dalı da gerçekten ölçülsün.
    Object.defineProperty(b, 'scrollHeight', { value: yukseklik, configurable: true });
    Object.defineProperty(b, 'clientHeight', { value: 400, configurable: true });
    return b;
  };

  test('AYNI adımda yeniden çizim konumu KORUYOR', () => {
    const b = sahne(2000);
    wiz.veFeadWizSeed('AG00976_GATES_2025');
    wiz.veFeadWizGoto(5);
    b.scrollTop = 900;
    wiz.veFeadWizDutyLib('AG00902-4');          // kullanıcının bildirdiği eylem
    expect(b.scrollTop).toBe(900);
  });

  test('her yerinde çizim yolu aynı — alan yazmak da konumu korur', () => {
    const b = sahne(2000);
    wiz.veFeadWizSeed('AG00976_GATES_2025');
    wiz.veFeadWizGoto(1);
    b.scrollTop = 640;
    wiz._fwSetRender('ten.contact', 'grooved');
    expect(b.scrollTop).toBe(640);
  });

  test('ADIM DEĞİŞİNCE sıfırlanır — yeni adım baştan okunur', () => {
    const b = sahne(2000);
    wiz.veFeadWizSeed('AG00976_GATES_2025');
    wiz.veFeadWizGoto(5);
    b.scrollTop = 900;
    wiz.veFeadWizGo(-1);
    expect(b.scrollTop).toBe(0);
    b.scrollTop = 500;
    wiz.veFeadWizGoto(6);
    expect(b.scrollTop).toBe(0);
  });

  test('İÇERİK KISALINCA konum KIRPILIR — dibe yapışmaz', () => {
    const b = sahne(2000);
    wiz.veFeadWizSeed('AG00976_GATES_2025');
    wiz.veFeadWizGoto(5);
    b.scrollTop = 1500;
    Object.defineProperty(b, 'scrollHeight', { value: 600, configurable: true });
    wiz.veFeadWizDutyLib('AG00902-4');
    expect(b.scrollTop).toBe(200);              // 600 − 400
  });
});


// ════════════════════════════════════════════════════════════════════════════
//  DÖRDÜNCÜ KULLANICI TURU (2026-09-01)
// ════════════════════════════════════════════════════════════════════════════

// ── 1 · GERGİ SATIRI DİĞERLERİYLE AYNI, ZORUNLULUK ÜST KARTTA ──────────────
describe('gergi satırı — biçim diğerleriyle aynı, hüküm üst kartta', () => {
  test('satır ile kasnak satırı AYNI hücre biçimlerini taşıyor', () => {
    kabuk(); wiz.veFeadWizSeed('AG00976_GATES_2025');
    const h = wiz.veFeadWizStepHTML(1, wiz.veFeadWizBuild());
    const ilk = h.slice(h.indexOf('<tbody>'), h.indexOf('</tr>', h.indexOf('<tbody>')));
    const ten = h.slice(h.indexOf('ve-fw-tr-ten'), h.indexOf('</tr>', h.indexOf('ve-fw-tr-ten')));
    const bicim = (r) => [...r.matchAll(/<(input|select|span)\b[^>]*>/g)]
      .map((m) => m[1] + (/type="([^"]+)"/.exec(m[0]) || [, ''])[1]);
    // Aynı sırada aynı tür kontroller: radyo · select · metin · 4 sayı · select…
    expect(bicim(ten)).toEqual(bicim(ilk));
    expect((ten.match(/<td/g) || []).length).toBe((ilk.match(/<td/g) || []).length);
  });

  test('ZORUNLULUK kutusu da KALKTI — açıklama yüzeyi kalmadı', () => {
    // Kutu bir önceki turda eklenmişti; kullanıcı (2026-09-02) sihirbazdaki
    // açıklamaların TAMAMINI kaldırttı ve bu da onlardan biriydi.
    kabuk(); wiz.veFeadWizReset();
    expect(wiz.veFeadWizStepHTML(1, wiz.veFeadWizBuild())).not.toContain('ve-fw-note-req');
    expect(WIZ_SRC).not.toContain('ve-fw-note-req');
    expect(CSS).not.toContain('ve-fw-note-req');
  });

  test('satır YİNE silinemez ve sürücü olamaz — biçim değişti, kural değil', () => {
    kabuk(); wiz.veFeadWizSeed('AG00976_GATES_2025');
    const r = wiz._fwTenRow(wiz.veFeadWizState());
    expect(r).toMatch(/<input type="radio" disabled/);
    expect(r).toMatch(/class="ve-fw-x" disabled/);
  });
});

// ── 2 · KASNAK SATIRLARI TAŞINABİLİR ───────────────────────────────────────
describe('kasnak satırı taşıma — tablo düzeni, kayış yolu DEĞİL', () => {
  test('↑ ↓ sırayı değiştiriyor, uçlarda duruyor', () => {
    kabuk(); wiz.veFeadWizSeed('AG00976_GATES_2025');
    const st = wiz.veFeadWizState();
    const anahtar = () => st.pulleys.map((p) => p.key).join(',');
    const a0 = anahtar();
    expect(wiz.veFeadWizPulleyMove(st.pulleys[1].key, -1)).toBe(true);
    expect(anahtar()).not.toBe(a0);
    expect(wiz.veFeadWizPulleyMove(st.pulleys[0].key, -1)).toBe(false);   // tepe
    expect(wiz.veFeadWizPulleyMove(st.pulleys[st.pulleys.length - 1].key, 1)).toBe(false);
    expect(wiz.veFeadWizPulleyMove('yok-boyle', 1)).toBe(false);
  });

  test('KAYIŞ YOLUNU ve ÇÖZÜMÜ değiştirmiyor — sıra yalnız tablonun', () => {
    // Bağlansaydı tabloyu düzenlemek gerilmeyi sessizce değiştirirdi.
    kabuk(); wiz.veFeadWizSeed('AG00976_GATES_2025');
    const st = wiz.veFeadWizState();
    const b0 = wiz.veFeadWizBuild();
    const yol0 = st.route.slice();
    wiz.veFeadWizPulleyMove(st.pulleys[2].key, -1);
    const b1 = wiz.veFeadWizBuild();
    expect(st.route).toEqual(yol0);
    expect(b1.beltLengthMm).toBeCloseTo(b0.beltLengthMm, 9);
    expect(b1.springTensionN).toBeCloseTo(b0.springTensionN, 9);
    expect(b1.spin).toBe(b0.spin);
  });

  test('düğmeler satırda ve uçlarda KAPALI', () => {
    kabuk(); wiz.veFeadWizSeed('AG00976_GATES_2025');
    const h = wiz.veFeadWizStepHTML(1, wiz.veFeadWizBuild());
    expect(h).toContain('veFeadWizPulleyMove');
    const govde = h.slice(h.indexOf('<tbody>'), h.indexOf('</tbody>'));
    const ilk = govde.slice(0, govde.indexOf('</tr>'));
    expect(ilk).toMatch(/class="ve-fw-mini" disabled[^>]*>↑/);   // ilk satır yukarı gidemez
  });
});

// ── 3 · VİRGÜL TANINIYOR ───────────────────────────────────────────────────
describe('ondalık ayırıcı — virgül de nokta da', () => {
  test('sayı alanları type="number" DEĞİL', () => {
    // `type="number"` virgülü GEÇERSİZ sayar ve `input.value` boş döner:
    // tuş vuruşu programa hiç ulaşmıyordu.
    kabuk(); wiz.veFeadWizSeed('AG00976_GATES_2025');
    [1, 3, 5].forEach((adim) => {
      const h = wiz.veFeadWizStepHTML(adim, wiz.veFeadWizBuild());
      expect(h).not.toMatch(/<input[^>]*type="number"[^>]*veFeadWizPulleySet\('[^']+','(od|x|y)'/);
      expect(h).not.toMatch(/<input[^>]*type="number"[^>]*_fwSet\('(ten|belt|solver)\./);
    });
    const r = wiz._fwTenRow(wiz.veFeadWizState());
    expect(r).not.toContain('type="number"');
    expect(r).toContain('inputmode="decimal"');
  });

  test('virgüllü değer modele DOĞRU sayı olarak giriyor', () => {
    kabuk(); wiz.veFeadWizSeed('AG00976_GATES_2025');
    const st = wiz.veFeadWizState();
    const p = st.pulleys[1];
    wiz.veFeadWizPulleySet(p.key, 'x', '130,5');
    wiz.veFeadWizPulleySet(p.key, 'y', '-139,9');
    const pack = wiz.veFeadWizNodes(st);
    const n = pack.nodes.find((x) => x.customName === (p.name || ''));
    const d = pack.nodes[1].data;
    expect(d.x).toBeCloseTo(130.5, 9);
    expect(d.y).toBeCloseTo(-139.9, 9);
  });

  test('virgül NOKTAYLA aynı sonucu veriyor — çözüm birebir', () => {
    const coz = (ayirici) => {
      kabuk(); wiz.veFeadWizSeed('AG00976_GATES_2025');
      const st = wiz.veFeadWizState();
      st.pulleys.forEach((p) => {
        ['x', 'y', 'od'].forEach((a) => {
          if (p[a] !== undefined && p[a] !== '')
            p[a] = String(p[a]).replace('.', ayirici);
        });
      });
      const b = wiz.veFeadWizBuild();
      return [b.ok, b.beltLengthMm, b.springTensionN];
    };
    const nokta = coz('.'), virgul = coz(',');
    expect(virgul[0]).toBe(true);
    expect(virgul[1]).toBeCloseTo(nokta[1], 9);
    expect(virgul[2]).toBeCloseTo(nokta[2], 9);
  });
});

// ── 6 · ORAN YALNIZ ÇAPLARDAN ya da KADEME YOK ────────────────────────────
//
// 2026-09-02: ara kademenin VARLIĞI artık bir SEÇİM. Öncesinde "kademe yok"
// durumu iki çapı da boş bırakmakla ifade ediliyordu ve bu bir SESSİZLİKTİ —
// "kademe yok" ile "çapları henüz girmedim" aynı görünüyordu. Elle oran alanı
// hâlâ YOK (spesifikasyon §2.3'ün ölçülmüş bulgusu: elle yazılmış hız oranları
// bütün gerilmeleri %17 düşürüyordu).
describe('tahrik oranı — elle girilemez', () => {
  test('KADEME seçicisi var, elle oran alanı YOK', () => {
    kabuk(); wiz.veFeadWizSeed('BMC_FEAD_2026');
    const h = wiz.veFeadWizStepHTML(5, wiz.veFeadWizBuild());
    expect(h).toContain('solver.ratioMode');
    expect(h).toContain('value="derive"');
    expect(h).toContain('value="unity"');
    expect(h).not.toContain('value="direct"');            // elle oran YOK
    expect(h).not.toContain("_fwSet('solver.driveRatio'");
    expect(h).toContain("_fwSet('solver.crankOD'");
    expect(h).toContain("_fwSet('solver.fanOD'");
  });

  test('KADEME YOK seçilince çap alanları kalkıyor ve oran 1', () => {
    kabuk(); wiz.veFeadWizSeed('BMC_FEAD_2026');
    wiz.veFeadWizState().solver.ratioMode = 'unity';
    const h = wiz.veFeadWizStepHTML(5, wiz.veFeadWizBuild());
    expect(h).not.toContain("_fwSet('solver.crankOD'");
    expect(h).not.toContain("_fwSet('solver.fanOD'");
    const b = wiz.veFeadWizBuild();
    expect(b.drive.mode).toBe('unity');
    expect(b.drive.ratio).toBe(1);
    // BMC'nin çapları durumda DURUYOR ama kullanılmıyor — seçim onları eziyor
    expect(Number(wiz.veFeadWizState().solver.crankOD)).toBeGreaterThan(0);
  });

  test('kurulan model kipi taşıyor — elle oran ise DÜŞÜRÜLÜYOR', () => {
    kabuk(); wiz.veFeadWizSeed('AG00976_GATES_2025');
    const st = wiz.veFeadWizState();
    st.solver.ratioMode = 'direct';                 // eski taslak
    expect(wiz.veFeadWizNodes(st).nodes.find((n) => n.type === 'fead-solver')
      .data.ratioMode).toBe('derive');
    st.solver.ratioMode = 'unity';
    expect(wiz.veFeadWizNodes(st).nodes.find((n) => n.type === 'fead-solver')
      .data.ratioMode).toBe('unity');
  });

  test('iki çap da boşken oran 1 — ve çözüm BOZULMUYOR', () => {
    kabuk(); wiz.veFeadWizSeed('AG00976_GATES_2025');
    const b = wiz.veFeadWizBuild();
    expect(b.ok).toBe(true);
    expect(b.drive.ratio).toBeCloseTo(1, 9);
  });

  test('TEK çap girilirse SESSİZ kalmıyor', () => {
    kabuk(); wiz.veFeadWizSeed('AG00976_GATES_2025');
    wiz.veFeadWizState().solver.crankOD = 197.32;   // fanOD boş
    const h = wiz.veFeadWizStepHTML(5, wiz.veFeadWizBuild());
    expect(h).toMatch(/Yalnız bir çap girildi/);
    expect(wiz.veFeadWizBuild().drive.ratio).toBeCloseTo(1, 9);
  });

  // "Kademe yok" seçiliyken yarım çap uyarısı ÇIKMAMALI: orada çap zaten
  // sorulmuyor, uyarı kullanıcıyı olmayan bir alana yönlendirirdi.
  test('kademe yokken yarım-çap uyarısı çıkmıyor', () => {
    kabuk(); wiz.veFeadWizSeed('AG00976_GATES_2025');
    const s = wiz.veFeadWizState().solver;
    s.crankOD = 197.32; s.ratioMode = 'unity';
    expect(wiz.veFeadWizStepHTML(5, wiz.veFeadWizBuild()))
      .not.toMatch(/Yalnız bir çap girildi/);
  });

  test('iki çap doluyken oran onlardan çıkıyor', () => {
    kabuk(); wiz.veFeadWizSeed('BMC_FEAD_2026');
    const s = wiz.veFeadWizState().solver;
    expect(wiz.veFeadWizBuild().drive.ratio)
      .toBeCloseTo(Number(s.crankOD) / Number(s.fanOD), 9);
  });
});

// ── 7 · MOTOR DEVİRLERİ RPM ────────────────────────────────────────────────
test('motor devirleri RPM yazıyor, "d/dk" kalmadı', () => {
  kabuk(); wiz.veFeadWizSeed('BMC_FEAD_2026');
  const h = wiz.veFeadWizStepHTML(5, wiz.veFeadWizBuild());
  expect(h).not.toContain('d/dk');
  expect(h).toContain('Rölanti [RPM]');
  expect(h).toContain('Devir [RPM]');
  expect(WIZ_SRC).not.toContain('d/dk');
});

// ── 5 + 9 · KOL AÇISI: NİSPİ DİL VE GÖRSEL SEÇİCİ ─────────────────────────
describe('kol yönü — nispi gösterim', () => {
  test('çeviri GİDİŞ-DÖNÜŞ birebir ve (−180,180] aralığında', () => {
    [0, 90, 180, 270, 344, -11.9992, 359.9].forEach((abs) => {
      const g = M.veFeadArmShownDeg(abs);
      expect(g).toBeGreaterThan(-180);
      expect(g).toBeLessThanOrEqual(180);
      // Aynı açı (mod 360): kosinüs/sinüs birebir.
      const geri = M.veFeadArmFromShown(g);
      expect(Math.cos(geri * Math.PI / 180)).toBeCloseTo(Math.cos(abs * Math.PI / 180), 12);
      expect(Math.sin(geri * Math.PI / 180)).toBeCloseTo(Math.sin(abs * Math.PI / 180), 12);
    });
    expect(M.veFeadArmShownDeg(344)).toBeCloseTo(164, 9);   // 344 mutlak → 164 nispi
    expect(Number.isNaN(M.veFeadArmShownDeg(undefined))).toBe(true);
  });

  test('alan NİSPİ değeri gösteriyor, SAKLANAN mutlak kalıyor', () => {
    kabuk(); wiz.veFeadWizSeed('BMC_FEAD_2026');
    const st = wiz.veFeadWizState();
    st.ten.armMeanDeg = 344;
    const h = wiz.veFeadWizStepHTML(3, wiz.veFeadWizBuild());
    expect(h).toContain('value="164"');
    expect(h).toContain('veFeadWizArmShown(this.value)');
    expect(h).toContain('Kol yönü');
    wiz.veFeadWizArmShown('164');
    expect(st.ten.armMeanDeg).toBeCloseTo(344, 6);
    // Alan BOŞALTILIRSA kayıt da siliniyor — 0 yazmak "0° seçildi" olurdu.
    wiz.veFeadWizArmShown('');
    expect(st.ten.armMeanDeg).toBeUndefined();
  });

  test('çeviri ÇÖZÜMÜ değiştirmiyor — yalnız dil', () => {
    kabuk(); wiz.veFeadWizSeed('BMC_FEAD_2026');
    const st = wiz.veFeadWizState();
    const b0 = wiz.veFeadWizBuild();
    wiz.veFeadWizArmShown(String(M.veFeadArmShownDeg(st.ten.armMeanDeg)));
    const b1 = wiz.veFeadWizBuild();
    expect(b1.beltLengthMm).toBeCloseTo(b0.beltLengthMm, 6);
    expect(b1.springTensionN).toBeCloseTo(b0.springTensionN, 6);
  });

  test('PANEL de aynı çeviriden geçiyor — iki yüzey ayrışamaz', () => {
    const h = fead.getFeadTensionerPropertiesHTML(
      { id: 'n1', type: 'fead-tensioner', data: { cenX: -161.97, cenY: 91.29,
        armLen: 90, armMeanDeg: 344, preload: 8.6, kArm: 0.48, meanLoad: 22.07 } });
    expect(h).toContain('veFeadSetArmShown');
    expect(h).toContain('value="164"');
    expect(h).toContain('Kol yönü');
  });
});

describe('kol açısı seçici — koordinat düzlemi', () => {
  const sahne = () => { kabuk(); wiz.veFeadWizSeed('BMC_FEAD_2026'); return wiz.veFeadWizAngScene(); };

  test('sahne ÇÖZÜLMÜŞ model istemiyor — yarım modelde de kuruluyor', () => {
    kabuk(); wiz.veFeadWizReset();
    const st = wiz.veFeadWizState();
    st.ten.cenX = 10; st.ten.cenY = 20; st.ten.armLen = 90;
    const sc = wiz.veFeadWizAngScene();
    expect(sc).toBeTruthy();
    expect(sc.cx).toBe(10);
    expect(sc.armLen).toBe(90);
    expect(wiz.veFeadWizBuild().ok).toBe(false);      // model gerçekten çözülmüyor
  });

  test('merkez ya da kol boyu yoksa sahne YOK — sayı uydurulmuyor', () => {
    kabuk(); wiz.veFeadWizReset();
    expect(wiz.veFeadWizAngScene()).toBeNull();
    expect(wiz.veFeadWizAngHTML()).toMatch(/avara merkezi/i);
  });

  test('SVG kayışı, YEŞİL OKU ve eksenleri çiziyor', () => {
    const sc = sahne();
    const svg = wiz.veFeadWizAngSVG(sc, 164);
    expect(svg).toContain('<svg');
    expect(svg).toContain('data-k=');            // ölçek künyesi — fare için
    ['0°', '90°', '180°', '-90°'].forEach((e) => expect(svg).toContain('>' + e + '<'));
    expect(svg).toContain('164.0°');             // seçili açı yazılı
    // KOL YEŞİL OK (kullanıcı isteği, 2026-09-02): gövde + doldurulmuş uç.
    expect(svg).toMatch(/<line[^>]*stroke="var\(--accent-success\)"/);
    expect(svg).toMatch(/<path d="M[^"]*Z"\s+fill="var\(--accent-success\)"/);
    // Öteki kasnaklar bağlam olarak çizili, ADSIZ.
    expect((svg.match(/<circle/g) || []).length).toBeGreaterThan(3);
    expect(svg).not.toMatch(/Alternatör|Klima|Avara|Krank/);
  });

  test('GERÇEK KAYIŞ YOLU çiziliyor — kartla AYNI üreticiden', () => {
    // Kullanıcı isteği: *"Kayış görünsün, tıpkı topoloji üzerindeki kanvas
    // gibi olsun."* İkinci bir çizici iki yüzeyde iki farklı kayış demekti.
    const sc = sahne();
    expect(sc.geom).toBeTruthy();
    const svg = wiz.veFeadWizAngSVG(sc, 164);
    expect(svg).toMatch(/<path d="M[^"]*A[^"]*Z"[^>]*stroke="var\(--accent-warning\)"/);
    // YOL ÜRETİCİSİ TEK — seçici kendi çizicisini kurmuyor. Kapı hem çağrıyı
    // hem yolun ŞEKLİNİ tutuyor: kasnak sayısı kadar teğet + sarım yayı.
    expect(WIZ_SRC).toContain('veFeadBeltPathD(');
    const d = /<path d="(M[^"]*Z)"[^>]*accent-warning/.exec(svg)[1];
    expect((d.match(/ A/g) || []).length).toBe(sc.geom.pulleys.length);
    expect((d.match(/ L/g) || []).length).toBe(sc.geom.pulleys.length);
    // ...ve üreticinin kendisi aynı sahnede aynı sayıda parça veriyor.
    const bag = fead.veFeadBeltPathD(sc.geom, (mm) => mm, (mm) => mm, 1,
      (v) => Math.round(v * 100) / 100);
    expect((bag.match(/ A/g) || []).length).toBe((d.match(/ A/g) || []).length);
  });

  test('ÇÖZÜM YOKSA kayış yok ama sahne yine kuruluyor', () => {
    kabuk(); wiz.veFeadWizReset();
    const st = wiz.veFeadWizState();
    st.ten.cenX = 0; st.ten.cenY = 0; st.ten.armLen = 90;
    const sc = wiz.veFeadWizAngScene();
    expect(sc).toBeTruthy();
    expect(sc.geom).toBeNull();
    const svg = wiz.veFeadWizAngSVG(sc, 45);
    expect(svg).toContain('<svg');
    expect(svg).not.toContain('var(--accent-warning)');   // kayış UYDURULMUYOR
    // ...ve BOŞ bir geometri de kayış saymıyor: `' Z'` geçerli bir yol dizesi
    // gibi görünür ve görünmeyen ama VAR olan bir kayış üretirdi.
    expect(fead.veFeadBeltPathD({ pulleys: [], spans: [], wraps: [] },
      (v) => v, (v) => v, 1, (v) => v)).toBe('');
    expect(fead.veFeadBeltPathD({ pulleys: [1, 2], spans: [1], wraps: [] },
      (v) => v, (v) => v, 1, (v) => v)).toBe('');
    expect(svg).toMatch(/stroke="var\(--accent-success\)"/);  // kol yine var
  });

  test('YAKINLAŞTIRMA ölçeği çarpıyor ve fare çevirisi bozulmuyor', () => {
    const sc = sahne();
    const oku = (svg, a) => Number(new RegExp(a + '="([-\\d.]+)"').exec(svg)[1]);
    const k1 = oku(wiz.veFeadWizAngSVG(sc, 0, 1), 'data-k');
    const k2 = oku(wiz.veFeadWizAngSVG(sc, 0, 2), 'data-k');
    expect(k2 / k1).toBeCloseTo(2, 4);   // künye 1e−6'ya yuvarlı
    // Fare→açı çevirisi ölçeği SVG'DEN okuduğu için yakınlaştırmadan bağımsız.
    [1, 2, 0.6].forEach((z) => {
      const svg = wiz.veFeadWizAngSVG(sc, 0, z);
      const el = { getAttribute: (n) => new RegExp(n + '="([-\\d.]+)"').exec(svg)[1] };
      const k = oku(svg, 'data-k'), ox = oku(svg, 'data-ox'), oy = oku(svg, 'data-oy');
      expect(wiz.veFeadWizAngFromPoint(el, ox + (sc.cx + 30) * k, oy - sc.cy * k))
        .toBeCloseTo(0, 5);
      expect(wiz.veFeadWizAngFromPoint(el, ox + sc.cx * k, oy - (sc.cy + 30) * k))
        .toBeCloseTo(90, 5);
    });
  });

  test('yakınlaştırma basamakları uçlarda DURUYOR, ⤢ sığdırıyor', () => {
    sahne();
    wiz.veFeadWizAngOpen();
    const Z = wiz.VE_FW_ANG_ZOOM;
    expect(wiz.veFeadWizAngState().zoom).toBe(1);
    for (let i = 0; i < 20; i++) wiz.veFeadWizAngZoom(1);
    expect(wiz.veFeadWizAngState().zoom).toBe(Z[Z.length - 1]);
    for (let i = 0; i < 40; i++) wiz.veFeadWizAngZoom(-1);
    expect(wiz.veFeadWizAngState().zoom).toBe(Z[0]);
    expect(wiz.veFeadWizAngZoom(0)).toBe(1);
    expect(wiz.veFeadWizAngState().zoom).toBe(1);
    // Pencere kapalıyken çağrılsa da patlamıyor.
    wiz.veFeadWizAngClose();
    expect(wiz.veFeadWizAngZoom(1)).toBe(1);
  });

  test('yakınlaştırma düğmeleri pencerede VAR', () => {
    sahne();
    wiz.veFeadWizAngOpen();
    const h = wiz.veFeadWizAngHTML();
    expect(h).toContain('veFeadWizAngZoom(1)');
    expect(h).toContain('veFeadWizAngZoom(-1)');
    expect(h).toContain('veFeadWizAngZoom(0)');
    expect(CSS).toMatch(/\.ve-fw-ang-zoom\s*\{/);
  });

  test('fare → açı çevirisi ölçek künyesinden okunuyor', () => {
    const sc = sahne();
    const svg = wiz.veFeadWizAngSVG(sc, 0);
    const oku = (a) => (new RegExp(a + '="([-\\d.]+)"').exec(svg) || [])[1];
    const k = Number(oku('data-k')), ox = Number(oku('data-ox')), oy = Number(oku('data-oy'));
    const el = { getAttribute: (n) => oku(n) };
    // Merkezin TAM SAĞINDA bir nokta → 0°, TAM ÜSTÜNDE → +90°
    const X = (mm) => ox + mm * k, Y = (mm) => oy - mm * k;
    expect(wiz.veFeadWizAngFromPoint(el, X(sc.cx + 50), Y(sc.cy))).toBeCloseTo(0, 6);
    expect(wiz.veFeadWizAngFromPoint(el, X(sc.cx), Y(sc.cy + 50))).toBeCloseTo(90, 6);
    expect(wiz.veFeadWizAngFromPoint(el, X(sc.cx - 50), Y(sc.cy))).toBeCloseTo(180, 6);
    expect(wiz.veFeadWizAngFromPoint(el, X(sc.cx), Y(sc.cy - 50))).toBeCloseTo(-90, 6);
    // Tam merkezde açı YOK — uydurulmuyor.
    expect(Number.isNaN(wiz.veFeadWizAngFromPoint(el, X(sc.cx), Y(sc.cy)))).toBe(true);
  });

  test('"Uygula" seçilen açıyı SAKLANAN alana çeviriyor', () => {
    sahne();
    const st = wiz.veFeadWizState();
    // SEÇİLEN AÇI KAYITLIDAN FARKLI OLMALI: örnek zaten 344° taşıyor ve
    // ona eşit bir değer seçmek yazmayı hiç ölçmez (mutasyon yeşil geçer).
    expect(st.ten.armMeanDeg).toBeCloseTo(344, 4);
    wiz.veFeadWizAngOpen();
    expect(wiz.veFeadWizAngState()).toBeTruthy();
    wiz.veFeadWizAngType('-30');                        // 330 mutlak
    expect(wiz.veFeadWizAngOk()).toBe(true);
    expect(st.ten.armMeanDeg).toBeCloseTo(150, 4);
    expect(wiz.veFeadWizAngState()).toBeNull();          // pencere kapandı
    // Geçersiz değerle "Uygula" HİÇBİR ŞEY yazmıyor.
    wiz.veFeadWizAngOpen();
    wiz.veFeadWizAngType('abc');
    expect(wiz.veFeadWizAngOk()).toBe(true);             // son geçerli değer duruyor
    expect(st.ten.armMeanDeg).toBeCloseTo(150, 4);
  });

  test('"Vazgeç" HİÇBİR ŞEY yazmıyor', () => {
    sahne();
    const st = wiz.veFeadWizState();
    const once = st.ten.armMeanDeg;
    wiz.veFeadWizAngOpen();
    wiz.veFeadWizAngType('12.5');
    wiz.veFeadWizAngClose();
    expect(st.ten.armMeanDeg).toBe(once);
    expect(wiz.veFeadWizAngState()).toBeNull();
  });

  test('pencere MONTAJ KONUMUNU canlı okutuyor', () => {
    const sc = sahne();
    wiz.veFeadWizAngOpen();
    wiz.veFeadWizAngType('164');
    const h = wiz.veFeadWizAngHTML();
    const p = M.veFeadTensionerPivot({ cenX: sc.cx, cenY: sc.cy, armLen: sc.armLen,
                                       armMeanDeg: M.veFeadArmFromShown(164) });
    expect(h).toContain(p[0].toFixed(2));
    expect(h).toContain('montaj konumu');
  });

  test('4. adımda 📐 düğmesi var ve pencere kabı index.html\'de', () => {
    sahne();
    expect(wiz.veFeadWizStepHTML(3, wiz.veFeadWizBuild())).toContain('veFeadWizAngOpen()');
    expect(IDX).toContain('id="ve-fw-ang"');
    expect(CSS).toMatch(/\.ve-fw-ang\s*\{/);
    expect(CSS).toMatch(/\.ve-fw-ang-box\s*\{/);
  });
});


// ════════════════════════════════════════════════════════════════════════════
//  AÇIKLAMA YÜZEYİ YOK — ve geri gelemez
// ════════════════════════════════════════════════════════════════════════════
//
// Kullanıcı isteği (2026-09-02): *"her güncellemeden sonra nedense programa
// garip açıklamalar geliyor… Pencerenin sağ üst köşesine baksana, 'fareyle'
// yazıyor… Bu tarz garip açıklamaları lütfen 'Başlangıç Sihirbazı' kısmından
// TAMAMEN kaldıralım."*
//
// KUSUR BİR METİN DEĞİL, BİR YÜZEYDİ. Sihirbazda iki kanal vardı ve her tur
// yeniden dolduruluyorlardı, çünkü orada duruyorlardı:
//
//   `_fwCard(baslik, GÖZ_KIRPMA, accent, inner)`  → kart başlığının sağ ucu
//   `_fwHint(html)`                               → kart gövdesinin altı
//
// Metinleri boşaltmak yetmezdi — bir sonraki oturum boş kanalı görüp yeniden
// doldururdu. İkisi de PARAMETRE ve FONKSİYON olarak kaldırıldı; bu kapı da
// geri gelmelerini tutuyor.
//
// KALAN YÜZEYLER (ve neden kaldıkları):
//   · `title` ipucu   — üzerine gelince çıkar, ekranı doldurmaz
//   · `ve-fw-issue`   — canlı doğrulama çıktısı, açıklama değil
//   · `ve-fw-reads`   — sayı okuması
//   · adım alt başlığı — bölüm etiketi ("Tip · çap · koordinat · …")
describe('sihirbazda açıklama yüzeyi YOK', () => {
  test('`_fwHint` ne fonksiyon ne çağrı olarak var', () => {
    // ÇAĞRI/TANIM biçimi aranıyor (`_fwHint(`), çıplak ad değil: kaldırma
    // kararını anlatan yorum onu adıyla anıyor ve anmalı da.
    expect(WIZ_SRC).not.toMatch(/_fwHint\s*\(/);
    expect(CSS).not.toContain('ve-fw-hint');
  });

  test('`_fwCard` ÜÇ argümanlı — göz kırpma kanalı kapalı', () => {
    expect(WIZ_SRC).toMatch(/function _fwCard\(baslik, accent, inner\)/);
    // Üreticinin GÖVDESİNDE `<em>` yok ve kuralı da kalmadı.
    const govde = WIZ_SRC.slice(WIZ_SRC.indexOf('function _fwCard(baslik'));
    expect(govde.slice(0, govde.indexOf('\n}'))).not.toContain('<em>');
    expect(CSS).not.toMatch(/\.ve-fw-card-h em/);
  });

  test('YEDİ ADIMIN hiçbiri açıklama paragrafı basmıyor', () => {
    kabuk(); wiz.veFeadWizSeed('AG00976_GATES_2025');
    const b = wiz.veFeadWizBuild();
    for (let i = 0; i < 7; i++) {
      const h = wiz.veFeadWizStepHTML(i, b);
      expect(h).not.toContain('ve-fw-hint');
      // Kart başlığında göz kırpma yok: `<span>Ad</span>` hemen `</header>`.
      const basliklar = h.match(/<header class="ve-fw-card-h">[\s\S]*?<\/header>/g) || [];
      expect(basliklar.length).toBeGreaterThan(0);
      basliklar.forEach((x) => expect(x).not.toContain('<em>'));
    }
  });

  test('BOŞ sihirbazda da temiz — ve kart gövdesi boş kalmıyor', () => {
    kabuk(); wiz.veFeadWizReset();
    const b = wiz.veFeadWizBuild();
    for (let i = 0; i < 7; i++) {
      const h = wiz.veFeadWizStepHTML(i, b);
      expect(h).not.toContain('ve-fw-hint');
      // Gövdesi TAMAMEN boş bir kart, açıklaması sökülmüş bir karttır —
      // ya içerik ya da kartın kendisi gitmeliydi.
      expect(h).not.toMatch(/<div class="ve-fw-card-b"><\/div>/);
    }
  });

  test('açı seçici penceresinde de yok', () => {
    kabuk(); wiz.veFeadWizSeed('BMC_FEAD_2026');
    wiz.veFeadWizAngOpen();
    const h = wiz.veFeadWizAngHTML();
    expect(h).not.toContain('ve-fw-hint');
    expect(h).not.toMatch(/Fareyi düzlemde gezdirin/);
  });

  test('DURUM ÇIKTILARI kalıyor — sansür değil, sadeleştirme', () => {
    // Uyarı kutuları ve sayı okumaları bir açıklama değil; onları da silmek
    // kullanıcıyı modelin durumundan mahrum bırakırdı.
    kabuk(); wiz.veFeadWizReset();
    expect(wiz.veFeadWizStepHTML(1, wiz.veFeadWizBuild())).toContain('ve-fw-issue');
    kabuk(); wiz.veFeadWizSeed('AG00976_GATES_2025');
    expect(wiz.veFeadWizStepHTML(4, wiz.veFeadWizBuild())).toContain('ve-fw-reads');
    // Alan başına ipucu da duruyor (üzerine gelince çıkar).
    expect(wiz._fwTenRow(wiz.veFeadWizState())).toMatch(/title="[^"]*MERKEZ/);
  });
});
