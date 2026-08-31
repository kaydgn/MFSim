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
const BELTS = require('../../js/fead-belts.js');
const TENS = require('../../js/fead-tensioners.js');
Object.keys(BELTS).forEach((k) => { global[k] = BELTS[k]; });
Object.keys(TENS).forEach((k) => { global[k] = TENS[k]; });
global.FEADCore = F;
Object.keys(M).forEach((k) => { global[k] = M[k]; });
Object.keys(fead).forEach((k) => { if (global[k] === undefined) global[k] = fead[k]; });
Object.keys(wiz).forEach((k) => { global[k] = wiz[k]; });

const IDX = fs.readFileSync(path.join(__dirname, '../../index.html'), 'utf8');
const CSS = fs.readFileSync(path.join(__dirname, '../../css/styles.css'), 'utf8');

beforeEach(() => {
  resetStubs(stubs);
  global.nodes = [];
  global.connections = [];
});

// Sihirbazı düğümsüz açmak için: durum doğrudan kurulur (render DOM ister,
// o yüzden kabuk da enjekte ediliyor).
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
    expect(sb.beltLengthMm).toBeCloseTo(1714.6, 3);
    expect(sb.springTensionN).toBeCloseTo(544.05, 1);
    expect(sb.relDeg).toBeCloseTo(28.075, 2);
  });

  test('BMC — kanonik taban (CLAUDE.md kaydı)', () => {
    const { sb } = cift('BMC_FEAD_2026');
    expect(sb.relDeg).toBeCloseTo(28.4271, 3);
    expect(sb.beltLengthMm).toBeCloseTo(1715.0, 3);
    expect(sb.springTensionN).toBeCloseTo(532.142, 2);
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
  const durum = (mod) => {
    kabuk();
    wiz.veFeadWizSeed('AG00976_GATES_2025');
    const st = wiz.veFeadWizState();
    st.tenMode = mod;
    return st;
  };
  const gergi = (st) => wiz.veFeadWizNodes(st).nodes.find((n) => n.type === 'fead-tensioner');

  test('zarf kipinde montaj merkezi TAŞINMAZ', () => {
    // Taşınsaydı köprü "iki koordinat da var" uyarısını basar ve kullanıcı
    // GİRMEDİĞİ bir alandan uyarı alırdı (zarf kipi yalnız pivotu kullanıyor).
    const st = durum('envelope');
    const t = gergi(st);
    expect(t.data.angleMode).toBe('envelope');
    expect(t.data.pivotX).toBeCloseTo(-250, 6);
    expect(t.data.cenX).toBeUndefined();
    expect(t.data.cenY).toBeUndefined();
  });

  test('mount kipinde montaj merkezi TAŞINIR', () => {
    const t = gergi(durum('mount'));
    expect(t.data.angleMode).toBe('mount');
    expect(t.data.cenX).toBeCloseTo(-161.97, 6);
  });

  test('kip AÇIKÇA yazılıyor — veriden çözülmesine bırakılmıyor', () => {
    // Yarım doldurulmuş bir formda kip, kullanıcının seçtiğinden BAŞKA
    // çıkabilirdi (veFeadAngleMode veriden çözüyor).
    kabuk();
    wiz.veFeadWizSeed('AG00976_GATES_2025');
    const st = wiz.veFeadWizState();
    st.tenMode = 'direct';
    st.ten.freeAngleDeg = 16.1;
    const t = gergi(st);
    expect(t.data.angleMode).toBe('direct');
    expect(M.veFeadAngleMode(t.data)).toBe('direct');
  });

  test('zarf kipinde kayış BOY KİPİ yazılmaz (yapısal olarak çıktı)', () => {
    const st = durum('envelope');
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
    expect(tenSatiri(kasnakHTML())).toContain('veFeadWizTenLib');
    kur('AG00976_GATES_2025');
    expect(tenSatiri(kasnakHTML())).toContain('veFeadWizTenLib');
  });

  test('silinemez ve SÜRÜCÜ OLAMAZ — iki düğme de devre dışı', () => {
    kur('AG00976_GATES_2025');
    const r = tenSatiri(kasnakHTML());
    expect(r).toMatch(/<input type="radio" disabled/);
    expect(r).toMatch(/class="ve-fw-x" disabled/);
  });

  test('X/Y KİPE GÖRE başka alana yazar ve satır bunu ADIYLA söyler', () => {
    // Bu modülün en pahalı sessiz hatası: kasnak merkezi ↔ pivot karışması
    // (ölçüldü: gerginlik −%48,6, sarım en kötü +27,9°, model YİNE çözülür).
    const st = kur('AG00976_GATES_2025');
    st.tenMode = 'mount';
    expect(wiz.veFeadWizTenCoordKeys(st)).toEqual(['cenX', 'cenY']);
    let r = tenSatiri(kasnakHTML());
    expect(r).toContain("veFeadWizTenSet('cenX'");
    expect(r).toMatch(/X\/Y = montaj merkezi/);

    st.tenMode = 'envelope';
    expect(wiz.veFeadWizTenCoordKeys(st)).toEqual(['pivotX', 'pivotY']);
    r = tenSatiri(kasnakHTML());
    expect(r).toContain("veFeadWizTenSet('pivotX'");
    expect(r).toMatch(/X\/Y = pivot/);
  });

  test('tablodan yazılan değer GERGİ ADIMINDA görünür — tek kayıt', () => {
    // İki yüzey ikinci bir durum kopyası tutsaydı biri ötekini sessizce
    // eskitirdi ("panel ile kart AYNI alanı okur").
    const st = kur('AG00976_GATES_2025');
    st.tenMode = 'mount';
    wiz.veFeadWizTenSet('cenX', -165.5);
    expect(st.ten.cenX).toBe(-165.5);
    expect(wiz.veFeadWizStepHTML(3, wiz.veFeadWizBuild())).toContain('-165.5');
    // ve çözüme de gidiyor
    const t = wiz.veFeadWizNodes(st).nodes.find((n) => n.type === 'fead-tensioner');
    expect(t.data.cenX).toBe(-165.5);
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
    wiz.veFeadWizTenLib('AG0868-4PK');
    expect(st.ten.tenLib).toBe('AG0868-4PK');
    expect(st.ten.armLen).toBe(90);
    expect(st.ten.meanLoad).toBeCloseTo(16.07, 3);
    // Künye MOTORUN verisini yazmaz: pivot ve kol açısı elde kalır.
    expect(st.ten.pivotX).toBeUndefined();
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
    et.forEach((e) => expect(e).toMatch(/^kol \d+(\.\d+)? mm · \d+\.\d{2} Nm$/));
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
    const cek = (s) => (s.match(/>kol [^<]*<\/option>/g) || []).map((x) => x.slice(1, -10));
    const a = cek(h), bb = cek(panel);
    expect(a.length).toBe(14);
    expect(new Set(a)).toEqual(new Set(bb));
    // <option value> hâlâ ANAHTAR — etiket kimlik taşımıyor
    expect(h).toContain('value="AG0868-8PK"');
  });
});

// ── 3 · KATALOG ÖNERİSİ SİHİRBAZDAN KALKTI ─────────────────────────────────
describe('kayış adımı — katalog önerisi yok, gereken boy okuması var', () => {
  test('zarf kipinde katalog önerisi basılmaz ama gereken boy DURUR', () => {
    kabuk(); wiz.veFeadWizSeed('AG00976_GATES_2025');
    const st = wiz.veFeadWizState();
    st.tenMode = 'envelope';
    delete st.ten.cenX; delete st.ten.cenY; delete st.ten.armMeanDeg;
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
    // ALT ve KK katalogu var (Araç Performans ile ORTAK kaynak)
    expect((h.match(/veFeadWizAccPreset/g) || []).length).toBe(2);
    expect(h).toContain('katalog yok');                // avaralar
    expect(st.pulleys.filter((p) => veFeadPresetLib(p.type)).length).toBe(2);
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

  test('sayı KAYBOLMUYOR — gergi adımının okuması hâlâ basıyor', () => {
    kabuk(); wiz.veFeadWizSeed('AG00976_GATES_2025');
    const st = wiz.veFeadWizState();
    st.tenMode = 'envelope';
    delete st.ten.cenX; delete st.ten.cenY; delete st.ten.armMeanDeg;
    const h = wiz.veFeadWizStepHTML(3, wiz.veFeadWizBuild());
    expect(h).toMatch(/Kol çalışma açısı/);
  });
});
