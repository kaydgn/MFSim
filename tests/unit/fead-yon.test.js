/**
 * fead-yon.test.js — YÖNLENDİRME, FEAD (E3, 2026-10-19)
 * ───────────────────────────────────────────────────────────────────────
 * Biçimi metin-dili.test.js ölçüyor (yön profili). Burada üç şey:
 *   · KÖPRÜNÜN İLETİSİ ÇARESİNE GERÇEK ÇIKTIDAN EŞLENİR. Çare sunumda
 *     (veFeadHataYonu) metinle eşleniyor ve köprünün cümlesi DEĞİŞMİYOR —
 *     sihirbaz onu adımına metinden eşliyor. Cümle bir gün değişirse eşleme
 *     SESSİZCE düşer: kapı iletiyi köprünün kendisine ürettirir.
 *   · YÖNLENDİRMEDEKİ AD EKRANDA VAR: Kayış Özellikleri, Gergi, Kasnak ekle,
 *     Kasnaklar ve Otomatik Gergi adımları, Devir sınırları kartı, Motor
 *     bölümü. Ad değişirse cümle olmayan bir yere gönderir.
 *   · KAPALI DENETİM SEBEBİNİ SÖYLER: Çözücü'nün ve Rapor'un düğmesi görünür
 *     sebebe bağlı (aria-describedby); sıra okları, STEP'in ve 3B'nin
 *     Hesapla'sı sebebi ipucunda. Eskiden her çözülemeyen model "Kasnak
 *     konumları eksik." diyordu — eksik kayış kanalı da, gergi künyesi de.
 */
const stubs = stubGlobals();
document.body.innerHTML = '<div id="ve-canvas-wrapper"><div id="ve-canvas"></div></div>';
global.nodes = [];
global.connections = [];
eval(loadSource('components.js'));
global.veIsCanvasHidden = veIsCanvasHidden;
global.componentDefs = componentDefs;
global.VE_MODULES = VE_MODULES;
eval(loadSource('cp-accessories.js'));
global.VE_ALTERNATOR_PRESETS = VE_ALTERNATOR_PRESETS;
global.VE_AC_PRESETS = VE_AC_PRESETS;
global.VE_AIRCOMP_PRESETS = VE_AIRCOMP_PRESETS;
global.veAccInterpCurve = veAccInterpCurve;
const P = require('../../js/step-p21.js');
const S = require('../../js/fead-step.js');
const U = require('../../js/step-ucgen.js');
[require('../../js/fead-duty.js'), require('../../js/fead-belts.js'), require('../../js/fead-tensioners.js'),
  require('../../js/fead-engines.js'), require('../../js/fead-accessories.js'), require('../../js/fead-checks.js'), P, S, U]
  .forEach((m) => { Object.keys(m).forEach((k) => { global[k] = m[k]; }); });
const F = require('../../js/fead-core.js');
const M = require('../../js/fead-model.js');
global.FEADCore = F;
Object.keys(M).forEach((k) => { global[k] = M[k]; });
require('../helpers/fead-motor').motorluOrnekler(M);
const fead = require('../../js/cp-fead.js');
Object.keys(fead).forEach((k) => { if (global[k] === undefined) global[k] = fead[k]; });
global.veFeadSignals = require('../../js/fead-signals.js');
const RS = require('../../js/cp-fead-results.js');
Object.keys(RS).forEach((k) => { if (global[k] === undefined) global[k] = RS[k]; });
const RP = require('../../js/cp-fead-report.js');
Object.keys(RP).forEach((k) => { if (global[k] === undefined) global[k] = RP[k]; });
const AR = require('../../js/cp-fead-araclar.js');
const wiz = require('../../js/cp-fead-wizard.js');
Object.keys(wiz).forEach((k) => { global[k] = wiz[k]; });
const G = require('../../js/cp-fead-3b.js');
const O = require('../helpers/step-ornek.js');

beforeEach(() => {
  resetStubs(stubs);
  global.nodes = [];
  global.connections = [];
  global.veFeadResults = null;
  document.body.innerHTML = '<div id="ve-canvas-wrapper"><div id="ve-canvas"></div></div>';
});

function kur(key) {
  const pack = M.veFeadExampleNodes(key || 'AG00976_GATES_2025');
  const ns = pack.nodes.map((n) => {
    const d = componentDefs[n.type] || {};
    return { id: n.id, type: n.type, customName: n.customName || null, def: d,
             x: 0, y: 0, width: d.defaultWidth || 65, height: d.defaultHeight || 60,
             data: JSON.parse(JSON.stringify(n.data || {})) };
  });
  ns.push({ id: 'ex-wiz', type: 'fead-wizard', def: componentDefs['fead-wizard'], data: {} });
  global.nodes = ns;
  return ns;
}
const tip = (t) => global.nodes.find((n) => n.type === t);
const isPulley = (n) => !!(componentDefs[n.type] || {}).isFeadPulley;
const isTen = (n) => !!(componentDefs[n.type] || {}).isFeadTensioner;
const dom = (h) => { const d = document.createElement('div'); d.innerHTML = h; document.body.appendChild(d); return d; };
const hatalar = () => M.veFeadBuildSystem(global.nodes).errors;

describe('köprünün iletisi çaresine eşlenir — ileti köprünün kendisinden', () => {
  const durum = [
    ['kayış kanal sayısı', () => { tip('fead-belt').data.ribs = ''; },
      'Kayış kanal (kaburga) sayısı girilmedi.', 'Kayış Özellikleri’nden girin.'],
    ['kasnağın konumu', () => { global.nodes.find((n) => isPulley(n) && !isTen(n) && !n.data.driver).data.x = ''; },
      /^".+" kasnağının konumu \(X \/ Y\) girilmedi\.$/, 'Kayış Tablosu’nda X ve Y’yi girin.'],
    ['gerginin merkezi', () => { tip('fead-tensioner').data.cenX = ''; },
      'Gergi avarasının merkez koordinatı (X / Y) girilmedi.', 'Kayış Tablosu’nda X ve Y’yi girin.'],
    ['gergi kol boyu', () => { tip('fead-tensioner').data.armLen = ''; },
      'Gergi kol boyu girilmedi.', 'Gergi penceresinde girin.'],
    ['gergi yokken', () => { global.nodes = global.nodes.filter((n) => !isTen(n)); },
      'Gergi yok.', 'Kasnak ekle’den Gergi’yi seçin.'],
    ['iki kasnak (gergisiz)', () => {
      const tut = global.nodes.filter((n) => isPulley(n) && !isTen(n)).slice(0, 2).map((n) => n.id);
      global.nodes = global.nodes.filter((n) => !isPulley(n) || tut.indexOf(n.id) >= 0);
    }, /^En az 3 kasnak gerekli; şu an 2\.$/, 'Kasnak ekle’den bir kasnak seçin.'],
  ];
  test.each(durum)('%s', (ad, boz, ileti, yon) => {
    kur();
    boz();
    const e = hatalar();
    const ilk = e.find((x) => (ileti instanceof RegExp ? ileti.test(x) : x === ileti));
    expect(ilk).toBeTruthy();                                   // köprü bu cümleyi hâlâ yazıyor
    expect(fead.veFeadHataYonu(ilk)).toBe(yon);
    expect(fead.veFeadHataYonlu(ilk)).toBe(ilk + ' ' + yon);
  });

  test('gerginin künyesinin her eksiği Gergi penceresine gider', () => {
    const tum = ['Gergi kol boyu girilmedi.', 'Gergi kolunun çalışma açısı (mutlak, +X\'ten CCW) girilmedi.',
      'Gergi yay ön yük momenti girilmedi.', 'Gergi yay katsayısı (Nm/°) girilmedi.',
      'Yay çalışma momenti (Spring Mean Load) girilmedi.'];
    // Köprü beş cümlenin beşini de yazıyor (boş gergi künyesi)
    kur();
    const t = tip('fead-tensioner');
    Object.keys(t.data).forEach((k) => { if (!/^(cenX|cenY|od|contact|name)$/.test(k)) delete t.data[k]; });
    const e = hatalar();
    tum.forEach((c) => {
      expect(e).toContain(c);
      expect(fead.veFeadHataYonu(c)).toBe('Gergi penceresinde girin.');
    });
  });

  test('çaresi tek olmayan ileti eşleşmez — olduğu gibi kalır', () => {
    ['Kayış yolu kapanmıyor (kasnak sırası · temas tarafı).', 'Kayış kasnağın içinden geçiyor.',
      'Teğet çözülemedi (kasnak çakışması · temas tarafı).', 'Gergi kolu bu kayış boyuna ulaşamıyor.',
      'Tasarım gerginliği türetilemedi (gergi künyesi · kol geometrisi).', '', null].forEach((m) => {
      expect(fead.veFeadHataYonu(m)).toBe('');
      expect(fead.veFeadHataYonlu(m)).toBe(String(m || ''));
    });
  });

  test('köprünün cümlesi değişmedi — sihirbaz onu adımına METİNDEN eşliyor', () => {
    kur();
    tip('fead-belt').data.ribs = '';
    expect(hatalar()).toContain('Kayış kanal (kaburga) sayısı girilmedi.');
    expect(hatalar().some((x) => /girin\.$/.test(x))).toBe(false);
  });
});

describe('uygunluk kapısının notu — çare yalnız tek olduğunda', () => {
  test('devir penceresi ve motor devri notları; ötekiler eşleşmez', () => {
    expect(fead.veFeadKapiYonu('Devir penceresi bilinen aksesuar yok.')).toBe('Aksesuar kasnaklarının Devir sınırları’nı doldurun.');
    expect(fead.veFeadKapiYonu('Motorun overspeed devri girilmedi — o noktadaki sınır denetlenmedi.'))
      .toBe('Sürücü kasnağın Motor bölümünde girin.');
    expect(fead.veFeadKapiYonu('Devir sınırı bilinen aksesuar ya da karşılaştırılacak motor devri yok.')).toBe('');
    expect(fead.veFeadKapiYonu('Değerlendirilebilir kasnak çifti yok.')).toBe('');
  });
  test('notların kaynağı: veFeadChecks bu cümleleri yazıyor', () => {
    const src = require('fs').readFileSync(require('path').join(__dirname, '../../js/fead-checks.js'), 'utf8');
    expect(src).toContain("out.note = 'Devir penceresi bilinen aksesuar yok.';");
    expect(src).toMatch(/out\.note = 'Motorun ' \+ eksikler\.join\(' ve '\) \+ ' devri girilmedi/);
  });
});

describe('yönlendirmedeki ad ekranda var', () => {
  test('pencere ve bileşen adları', () => {
    expect(componentDefs['fead-belt'].name).toBe('Kayış Özellikleri');
    expect(componentDefs['fead-tensioner'].name).toBe('Gergi');
    expect(fead.VE_FEAD_TABLE_COLS.map((c) => c.t)).toEqual(expect.arrayContaining(['X', 'Y']));
  });
  test('Kasnak ekle ve listesindeki Gergi — gergi yokken listede', () => {
    kur();
    const liste = () => [...dom(fead.veFeadTableAddHTML(tip('fead-layout').id)).querySelectorAll('.ve-fead-ek-liste .ad')]
      .map((s) => s.textContent);
    const d = dom(fead.veFeadTableAddHTML(tip('fead-layout').id));
    expect(d.querySelector('.ve-fead-ek-dugme').textContent.trim()).toBe('Kasnak ekle');
    expect(liste()).not.toContain('Gergi');               // gergi tekil: varken listede yok
    global.nodes = global.nodes.filter((n) => !isTen(n));
    expect(liste()).toContain('Gergi');                   // "Gergi yok." hâlinde yönlendirmenin hedefi
  });
  test('sihirbazın adımları ve ekleyicisi', () => {
    const adlar = wiz.VE_FW_STEPS.map((s) => s.ad);
    expect(adlar).toEqual(expect.arrayContaining(['Kasnaklar', 'Otomatik Gergi']));
    const src = require('fs').readFileSync(require('path').join(__dirname, '../../js/cp-fead-wizard.js'), 'utf8');
    expect(src).toContain('aria-label="Kasnak ekle"');
    expect(src).toContain("'<option value=\"\">＋ Kasnak ekle…</option>'");
  });
  test('Devir sınırları kartı aksesuarda, Motor bölümü sürücüde', () => {
    kur();
    const acc = global.nodes.find((n) => n.type === 'fead-alternator');
    expect(fead.veFeadAccLimitCard(acc)).toContain('Devir sınırları');
    const drv = global.nodes.find((n) => isPulley(n) && n.data.driver);
    const d = dom(fead.getFeadPulleyPropertiesHTML(drv));
    expect([...d.querySelectorAll('.ve-fp-kat')].map((k) => k.getAttribute('aria-label'))).toContain('Motor');
  });
  test('FEAD araçları: Hesapla ve Yön aynı pencerede', () => {
    kur();
    const d = dom(AR.veFeadAraclarGovdeHTML(AR.veFeadAraclarDurum()));
    expect(d.querySelector('[data-ey="hesapla"]').textContent.trim()).toBe('Hesapla');
    expect(d.querySelector('[role="radiogroup"][aria-label="Kayış dönüş yönü"]')).toBeTruthy();
  });
});

describe('kapalı denetim sebebini söyler', () => {
  const RIBS = 'Kayış kanal (kaburga) sayısı girilmedi. Kayış Özellikleri’nden girin.';
  test('FEAD araçları: sebep köprünün ilk iletisi ve çaresi — "Kasnak konumları eksik." değil', () => {
    kur();
    tip('fead-belt').data.ribs = '';
    const d = AR.veFeadAraclarDurum();
    expect(d.hazir).toBe(false);
    expect(d.neden).toBe(RIBS);
    const g = dom(AR.veFeadAraclarGovdeHTML(d));
    expect(g.querySelector('[data-ey="hesapla"]').getAttribute('title')).toBe(RIBS);
    expect(g.querySelector('.ve-fead-arac-not').textContent).toBe(RIBS);
    global.nodes = global.nodes.filter((n) => !isPulley(n));   // araçlar ve kayış kalır (silinmez)
    expect(AR.veFeadAraclarDurum().neden).toBe('Kasnak yok.');
  });
  test('Çözücü: Hesapla görünür sebebe bağlı', () => {
    kur();
    tip('fead-belt').data.ribs = '';
    const d = dom(fead.getFeadSolverPropertiesHTML(tip('fead-solver')));
    const b = d.querySelector('.ve-fp-solve');
    expect(b.disabled).toBe(true);
    expect(document.getElementById(b.getAttribute('aria-describedby')).textContent).toBe(RIBS);
  });
  test('Rapor: düğme durum yazısına bağlı, yazı yolu söylüyor', () => {
    kur();
    const d = dom(RP.getFeadReportPropertiesHTML(tip('fead-report')));
    const b = d.querySelector('.ve-fp-solve');
    expect(b.disabled).toBe(true);
    expect(document.getElementById(b.getAttribute('aria-describedby')).textContent)
      .toBe('Model çözülmedi. FEAD araçları’nda Hesapla ile çözün.');
  });
  test('Kayış Tablosu: kapalı sıra okunun ipucu sebebi söyler, eylemi değil', () => {
    kur();
    const d = dom(fead.veFeadTableCardHTML(null));
    const kapali = [...d.querySelectorAll('button.ve-fead-tbl-mv[disabled]')];
    expect(kapali.length).toBeGreaterThanOrEqual(3);
    kapali.forEach((b) => expect(b.getAttribute('title')).toMatch(/^(Sürücü ilk satırda kilitli|Gergi son satırda kilitli|Son satır)\.$/));
    const acik = [...d.querySelectorAll('button.ve-fead-tbl-mv:not([disabled])')];
    acik.forEach((b) => expect(b.getAttribute('title')).toMatch(/^Kayış sırasında (yukarı|aşağı) taşı$/));
  });
  test('sıra kilidinin sebebi tek yerden — tablo ve sihirbaz aynı cümle', () => {
    const f = fead.veFeadSiraKilitSebebi;
    expect(f(-1, 0, 5, false, true)).toBe('Sürücü ilk satırda kilitli.');
    expect(f(-1, 1, 5, false, true)).toBe('Sürücü ilk satırda kilitli.');
    expect(f(1, 0, 5, false, true)).toBe('Sürücü ilk satırda kilitli.');
    expect(f(-1, 4, 5, true, true)).toBe('Gergi son satırda kilitli.');
    expect(f(1, 4, 5, true, true)).toBe('Gergi son satırda kilitli.');
    expect(f(1, 3, 5, false, true)).toBe('Gergi son satırda kilitli.');
    expect(f(1, 4, 5, false, false)).toBe('Son satır.');
    expect(f(-1, 2, 5, false, true)).toBe('');
  });
});

describe('Sonuçlar: künye satırı kısalınca tam metni ipucunda', () => {
  test('gezginin üst satırı', () => {
    kur();
    fead.veFeadSolve(tip('fead-solver').id);
    expect(global.veFeadResults && global.veFeadResults.ok).toBe(true);
    const m = dom(RS.veFeadResTreeTopHTML()).querySelector('.ve-fr-tree-meta');
    expect(m.textContent.length).toBeGreaterThan(5);
    expect(m.getAttribute('title')).toBe(m.textContent);
  });
});

describe('sihirbaz ve STEP', () => {
  const kabuk = () => {
    document.body.innerHTML = '<div id="ve-canvas"></div>'
      + '<div id="ve-feadwiz-overlay" style="display:none;">'
      + '<div id="ve-fw-nav"></div><div id="ve-fw-body"></div><div id="ve-fw-foot"></div></div>';
  };
  test('sıra okları: her kapalı ok sebebini ipucunda taşır', () => {
    kabuk();
    wiz.veFeadWizReset();
    ['fead-crank', 'fead-alternator', 'fead-idler'].forEach((t) => wiz.veFeadWizKasnakEkle(t));
    const st = wiz.veFeadWizState();
    const keys = st.pulleys.map((p) => p.key).concat(['__ten__']);
    expect(keys).toHaveLength(4);
    const sebepler = [];
    keys.forEach((k) => {
      wiz.veFeadWizSec(k);
      const d = dom(wiz.veFeadWizStepHTML(1, wiz.veFeadWizBuild()));
      d.querySelectorAll('.ve-fw-ed-ops button[disabled]').forEach((b) => sebepler.push(b.getAttribute('title')));
    });
    // sürücü: iki ok · ikinci satır: yukarı · gerginin önündeki: aşağı · gergi: iki ok + Sil
    expect(sebepler.length).toBeGreaterThanOrEqual(6);
    sebepler.forEach((t) => expect(t).toMatch(/^(Sürücü ilk satırda kilitli|Gergi son satırda kilitli|Son satır|Gergi silinemez)\.$/));
  });
  test('gerginin "Sürücü kasnak" kutusu kapalı ve sebebi kutunun kendisinde', () => {
    kabuk();
    wiz.veFeadWizReset();
    wiz.veFeadWizKasnakEkle('fead-crank');
    wiz.veFeadWizSec('__ten__');
    const d = dom(wiz.veFeadWizStepHTML(1, wiz.veFeadWizBuild()));
    const r = d.querySelector('#ve-fw-ed input[type="radio"][disabled]');
    expect(r.getAttribute('title')).toBe('Gergi sürücü olamaz.');
  });
  test('STEP kartı: dosya yokken bırakma alanını söyleyen tek satır', () => {
    kabuk();
    wiz.veFeadWizReset();
    const d = dom(wiz._fwStpKartHTML());
    expect(d.querySelector('[data-ve-dropzone="step"] .ve-fw-stp-yon').textContent).toBe('STEP dosyasını seçin ya da buraya bırakın.');
  });
  test('STEP ve 3B: rol yokken Hesapla sebebini ipucunda taşır; seçili parça yokken yol yazılı', () => {
    kabuk();
    wiz.veFeadWizReset();
    const s = wiz.veFeadWizStpOku(O.ag00686Step(), 'AG00686.stp');
    s.roller = s.roller.map(() => '');
    s.coz = null;
    const kart = dom(wiz._fwStpKartHTML());
    const kb = kart.querySelector('#ve-fw-stp-hesapla');
    expect(kb.disabled).toBe(true);
    expect(kb.getAttribute('title')).toBe('Hiçbir parçaya rol verilmedi.');
    const alt = dom(G.veFeadWiz3bAltHTML(s, -1));
    const ub = alt.querySelector('#ve-fw-3b-hesapla');
    expect(ub.disabled).toBe(true);
    expect(ub.getAttribute('title')).toBe('Hiçbir parçaya rol verilmedi.');
    expect(alt.querySelector('.ve-fw-3b-dizi-ad.ve-fw-dim').textContent).toBe('Seçili parça yok. Modelde bir parça seçin.');
  });
});
