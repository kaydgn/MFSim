/**
 * mount-wizard.test.js — TAKOZ BAŞLANGIÇ SİHİRBAZI (js/cp-mount-wizard.js)
 *
 * Kullanıcı isteği (2026-10-14): Takoz'a FEAD'inki gibi bir başlangıç —
 * sihirbaz, STEP'ten başla, boş kanvas. Kullanıcı kararı (aynı gün): bu tur
 * ARAYÜZ; sihirbazın ve 3B görüntüleyicinin ayrıntıları sonraki oturumlarda.
 * Bu yüzden kapılar yalnız arayüzün sözlerini tutar:
 *   · pencere FEAD sihirbazının kabuğuyla açılıyor, ray VE_MW_STEPS'in KENDİSİ;
 *   · bir kurulum = BİR geri-al adımı (veStateBatch, kökteki kural);
 *   · STEP kartı: rol → hesap → kütle → aktar zinciri sihirbazın durumunu
 *     kuruyor ve geometriden gelen alanlar "S" işaretini taşıyor;
 *   · Boş kanvas araçları TEK kez kurar (iki Çözücü olmaz), tek adımda.
 * Sayısal çekirdek (hacim merkezi, atalet) tests/unit/mount-step.test.js'te.
 */
const stubs = stubGlobals();
global.nodes = [];
global.connections = [];
eval(loadSource('components.js'));
global.componentDefs = componentDefs;
const core = require('../../js/mount-core.js');
global.veMountCore = core;
const cp = require('../../js/cp-mount.js');
Object.keys(cp).forEach((k) => { if (global[k] === undefined) global[k] = cp[k]; });
const STP = require('../../js/mount-step.js');
Object.keys(STP).forEach((k) => { global[k] = STP[k]; });
const W = require('../../js/cp-mount-wizard.js');
const S = require('../helpers/step-takoz.js');

const KABUK = '<div id="ve-canvas-wrapper"></div>'
  + '<div id="ve-mntwiz-overlay" style="display:none;"><div class="ve-fw-shell">'
  + '<nav id="ve-mw-nav"></nav><div id="ve-mw-body"></div></div><div id="ve-mw-foot"></div>'
  + '<div id="ve-mw-3b" style="display:none;"></div></div>';

let k = 0;
beforeEach(() => {
  resetStubs(stubs);
  document.body.innerHTML = KABUK;
  global.nodes = [];
  global.connections = [];
  W._mwTaslakSifirla();
  W._mwStpSifirla();
  global.createNode = jest.fn((type, x, y) => {
    const n = { id: 'n' + (++k), type, def: componentDefs[type] || {}, x, y, data: {} };
    global.nodes.push(n);
    return n;
  });
  global.veStateBatch = jest.fn((fn) => fn());
});
afterEach(() => {
  if (W.veMntWizAcik()) W.veMntWizKapat(false);
  delete global.createNode;
  delete global.veStateBatch;
});

// Sentetik güç grubu: 2 gövde + braket alt montajı + 4 takoz, rolleriyle
function stepYukle() {
  const s = W.veMntWizStpOku(S.gucGrubu(), 'guc.stp', 'duz');
  const rol = { 'Motor bloğu': 'mnt-motor', 'Şanzıman gövdesi': 'mnt-gearbox', 'Arka braket': 'mnt-bracket' };
  s.sonuc.agac.forEach((d) => {
    if (rol[d.ad]) W.veMntWizStpRol(d.i, rol[d.ad]);
    if (/takoz$/.test(d.ad)) W.veMntWizStpRol(d.i, 'mnt-mount');
  });
  return s;
}
const dugumi = (s, ad) => s.sonuc.agac.filter((d) => d.ad === ad)[0].i;

// KATALOG LİSTESİ = TAKOZ PENCERESİNİN EŞLEŞMESİ (kullanıcı turu 2026-10-19):
// örnekten doldurulan satır bağsız gelir; liste "— katalogdan seç —" derken
// satırın altı rijitliği bir tiple birebir aynıydı (ASFAT'ta 6/6 satır).
describe('KATALOG LİSTESİ — örnekten doldurulan satır tipini gösterir', () => {
  test('ASFAT: altı satırın listesi Takoz penceresinin eşleşmesi; bir değer değişince boş seçim', () => {
    const fs = require('fs'), path = require('path');
    const T = JSON.parse(fs.readFileSync(path.join(__dirname, '../../assets/examples/asfat_topoloji.json'), 'utf8'));
    const st = W.veMntWizFromNodes(T.nodes);
    expect(st.takozlar.length).toBe(6);
    expect(st.takozlar.every((t) => !t.libKey)).toBe(true);
    const sec = (t) => { const d = document.createElement('div'); d.innerHTML = W._mwKatalogSecHTML(t); return d.querySelector('select').value; };
    expect(st.takozlar.map(sec)).toEqual(st.takozlar.map((t) => cp._mntKutuphaneEslesme({ data: t }).e.key));
    expect([...new Set(st.takozlar.map(sec))].sort()).toEqual(['asfat-a', 'asfat-b']);
    st.takozlar[0].kzs = 999;
    expect(sec(st.takozlar[0])).toBe('');
  });
});

describe('PENCERE — FEAD sihirbazının kabuğu', () => {
  test('boş topolojide açılır: ray VE_MW_STEPS, 1. adımda STEP kartı ve örnek seçici', () => {
    expect(W.veMntWizAc()).toBe(true);
    expect(W.veMntWizAcik()).toBe(true);
    expect(document.getElementById('ve-mntwiz-overlay').style.display).toBe('flex');
    const ray = [...document.querySelectorAll('#ve-mw-nav .ve-fw-step-t b')].map((b) => b.textContent);
    expect(ray).toEqual(W.VE_MW_STEPS.map((s) => s.ad));
    const govde = document.getElementById('ve-mw-body');
    expect(govde.querySelector('.ve-fw-stp[data-ve-dropzone="step"] input.ve-mw-stp-file')).not.toBeNull();
    expect(govde.querySelector('select[aria-label="Örnek"]')).not.toBeNull();
    expect(govde.querySelector('.ve-fw-masa')).not.toBeNull();
  });
  test('kapanınca gövde boşalır (FEAD sihirbazının `.ve-fw-*` öğeleriyle karışmasın)', () => {
    W.veMntWizAc();
    W.veMntWizKapat(true);
    expect(W.veMntWizAcik()).toBe(false);
    expect(document.getElementById('ve-mw-body').innerHTML).toBe('');
  });
  // Canlı Not 58 (kullanıcı 2026-11-06): "ileri geri butonları çok gizli kalmış. Ayrıca çirkin
  // duruyor. Onları güzel bir yere taşıyalım mı?" Önce: 22 px'lik Kapat · Geri · İleri alt çubuğun
  // köşesindeydi. Şimdi girdilerin sütununun dibinde, yapışık eylem şeridinde, 32 px.
  test('EYLEM ŞERİDİ: Geri · İleri (son adımda Modeli kur) sütunun son öğesi; ilk adımda Geri yok; Kapat yok; alt çubuk yok', () => {
    W.veMntWizAc();
    const dugmeler = () => [...document.querySelectorAll('#ve-mw-yan > #ve-mw-eylem button')].map((b) => b.textContent.trim());
    const yan = () => document.getElementById('ve-mw-yan');
    expect(yan().lastElementChild.id).toBe('ve-mw-eylem');
    expect(dugmeler()).toEqual(['İleri']);
    expect(document.querySelector('#ve-mw-eylem #ve-mw-foot-state').textContent).toBe('model boş');
    W.veMntWizGoto(1);
    expect(dugmeler()).toEqual(['Geri', 'İleri']);
    expect(document.querySelector('#ve-mw-eylem .ve-mw-eylem-ileri').classList.contains('ve-fw-btn-primary')).toBe(true);
    W.veMntWizGoto(W.VE_MW_STEPS.length - 1);
    expect(dugmeler()).toEqual(['Geri', 'Modeli kur']);
    expect(document.querySelector('#ve-mw-eylem #ve-mw-create').disabled).toBe(true);        // boş modelde kurulmaz
    expect(document.querySelector('#ve-mw-eylem #ve-mw-create').title).not.toBe('');           // sebebi ipucunda
    expect(document.getElementById('ve-mw-foot').innerHTML).toBe('');                         // alt çubuğa yazılmaz
    const fs = require('fs'), path = require('path');
    const html = fs.readFileSync(path.join(__dirname, '../../index.html'), 'utf8');
    expect(html).not.toMatch(/id="ve-mw-foot"/);
    const css = fs.readFileSync(path.join(__dirname, '../../css/styles.css'), 'utf8');
    const kural = (sec) => { const i = css.indexOf('\n' + sec + '{'); return i < 0 ? '' : css.slice(i + 1, css.indexOf('}', i)).replace(/\s+/g, ' '); };
    expect(kural('.ve-fw-yan > .ve-mw-eylem')).toMatch(/position:sticky; bottom:0; z-index:2; margin-top:auto;/);
    expect(kural('.ve-fw-yan .ve-mw-eylem .ve-fw-btn')).toMatch(/height:32px;/);
    expect(kural('.ve-fw-yan .ve-mw-eylem .ve-mw-eylem-ileri')).toMatch(/flex:1 1 auto;/);
    expect(kural('.ve-fw-foot .ve-fw-btn')).toMatch(/height:22px/);                              // FEAD'in alt çubuğu değişmez
  });
  // Canlı Not 69 (kullanıcı 2026-11-09): "Şu 'yüklendi' açıklamasına gerek var mı? Veya bunun
  // altta olmasına gerek var mı?" Önce: Örnekten doldur kartının dibinde "ASFAT 8x8 Obüs yüklendi"
  // — listenin seçilisini ve gezinmenin "3 / 7"sini tekrarlıyordu.
  test('YÜKLENDİ YOK: örnek yüklenince kartta "yüklendi" satırı yok; adı listenin seçilisi söyler', () => {
    W.veMntWizAc();
    W.veMntWizOrnekSec('asfat');
    const yan = document.getElementById('ve-mw-yan');
    expect(yan.textContent).not.toMatch(/yüklendi/);
    const sec = yan.querySelector('select[aria-label="Örnek"]');
    expect(sec.value).toBe('asfat');
    expect(sec.options[sec.selectedIndex].textContent).toMatch(/^ASFAT/);
    expect(yan.querySelector('.ve-fw-seednav-n').textContent).toMatch(/^\d+ \/ \d+$/);
    W.veMntWizOrnekSec('');                                              // Boş başla
    expect(document.getElementById('ve-mw-yan').textContent).not.toMatch(/yüklendi/);
    // GEZİNME LİSTENİN SATIRINDA (Canlı Not 78: "Şu butonları da yukarı taşıyalım. Bir satır aşağıda
    // olmasının bir anlamı yok."): ↑ ↓ ve sayaç listeyle aynı kapta, alanın kendisi etiket değil
    // (düğmeler etiketin içinde kalmasın); önce gezinme alanın ARDINDA ayrı bir satırdı
    const alan = document.querySelector('#ve-mw-yan .ve-mw-ornek');
    expect([alan.tagName, alan.querySelectorAll('.ve-mw-ornek-d > select[aria-label="Örnek"] + .ve-fw-seednav .ve-fw-mini').length]).toEqual(['DIV', 2]);
    expect(document.querySelectorAll('#ve-mw-yan .ve-fw-card-b > .ve-fw-seednav')).toHaveLength(0);
    const css = require('fs').readFileSync(require('path').join(__dirname, '../../css/styles.css'), 'utf8');
    expect(css).toMatch(/\.ve-fw-yan \.ve-fw-card-b > \.ve-fw-field\.ve-mw-ornek\{ grid-template-columns:auto minmax\(0, 1fr\); \}/);
    expect(css).toMatch(/\.ve-mw-ornek-d > \.ve-fw-seednav\{ flex:none; margin-top:0; \}/);
    W.veMntWizKapat(true);
    // tuvaldeki modelden: kartın başlığı adlandırır, satır yalnız sayılar
    global.nodes = [{ id: 'g1', type: 'mnt-motor', x: 0, y: 0, data: { mass: 1000, cgx: 0, cgy: 0, cgz: 600 } },
      { id: 't1', type: 'mnt-mount', x: 0, y: 0, data: { x: 0, y: 300, z: 500, kxs: 1, kys: 1, kzs: 1, kxd: 1, kyd: 1, kzd: 1 } }];
    global.nodes.forEach((n) => { n.def = componentDefs[n.type]; });
    W.veMntWizAc();
    const tuval = document.getElementById('ve-mw-yan');
    expect(tuval.textContent).not.toMatch(/yüklendi/);
    expect(tuval.querySelector('.ve-fw-seeded').textContent.trim()).toBe('1 gövde · 1 takoz');
    W.veMntWizKapat(true);
  });
  // TUVALİN ÖRNEĞİ (kullanıcı 2026-11-11, Canlı Not 135: *"BMC Siper örneğini açtım … 'başlangıç
  // sihirbazı' bileşenini açtığım zaman, sanki sıfırdan bir başlangıç sihirbazı açmışım gibi oluyor
  // … seçilen örneğin ne olduğu belli olsun. Kullanıcı değiştirmek isterse daha sonra değiştirir"*):
  // örnek yüklenince anahtarı sihirbaz bileşenine yazılır; tuvalden açılan sihirbaz örneği adıyla
  // gösterir, liste ve gezinme o örnekte — yeniden doldurmaz (tuvaldeki değişiklik kalır).
  test('TUVALİN ÖRNEĞİ: örnekten kurulan tuvalde sihirbaz örneğin adıyla açılır; liste ve gezinme o örnekte', () => {
    global.nodes = [{ id: 'w1', type: 'mnt-wizard', x: 0, y: 0, data: {} },
      { id: 'g1', type: 'mnt-motor', x: 0, y: 0, data: { mass: 1000, cgx: 0, cgy: 0, cgz: 600 } },
      { id: 't1', type: 'mnt-mount', x: 0, y: 0, data: { x: 0, y: 300, z: 500, kxs: 1, kys: 1, kzs: 1, kxd: 1, kyd: 1, kzd: 1 } }];
    global.nodes.forEach((n) => { n.def = componentDefs[n.type]; });
    expect(cp.veMntTuvalOrnegi()).toBeNull();                                  // işaretsiz tuval
    expect(cp.veMntOrnekIsaretle('siper')).toBe(true);
    expect(global.nodes[0].data.ornek).toBe('siper');
    expect(cp.veMntTuvalOrnegi()).toBe('siper');
    W.veMntWizAc();
    const yan = document.getElementById('ve-mw-yan');
    expect(yan.querySelector('.ve-fw-seeded b').textContent).toMatch(/Siper/);
    expect(yan.querySelector('.ve-fw-seeded').textContent.trim()).toMatch(/· 1 gövde · 1 takoz$/);
    const sec = yan.querySelector('select[aria-label="Örnek"]');
    expect(sec.value).toBe('siper');                                           // liste örnekte
    expect(sec.options[0].textContent).toBe('— değiştir —');
    expect(yan.querySelector('.ve-fw-seednav-n').textContent).toMatch(/^[1-9]\d* \/ \d+$/);
    expect(W.veMntWizState().govdeler).toHaveLength(1);                        // tuvalin modeli, örneğin değil
    expect(W._mwOrnekGosterilen({ seededFrom: 'tuval', tuvalOrnek: 'siper' })).toBe('siper');
    expect(W._mwOrnekGosterilen({ seededFrom: 'tuval' })).toBeNull();
    expect(W._mwOrnekGosterilen({ seededFrom: 'step' })).toBeNull();
    expect(W._mwOrnekGosterilen({ seededFrom: '' })).toBe('');
    W.veMntWizKapat(true);
    expect(cp.veMntOrnekIsaretle(null)).toBe(true);                            // STEP'ten ya da boştan kurulum siler
    expect(global.nodes[0].data.ornek).toBeUndefined();
    global.nodes = [];
  });
  // Canlı Not 81 · 82 · 83 (kullanıcı 2026-11-09): "Arada bir boşluk var. Fazla satırlı bir boşluk
  // o." · "Açıklamayı yana alalım." · "Açıklamaları düzeltelim, gereksiz açıklamaları kaldıralım."
  // Önce: adımın satırında adın altında iki satırlık içerik listesi; STEP kartının yönlendirmesi
  // düğmelerin altında ayrı paragraf; Seçilen örnek'te künyenin ve tablonun alt payı kartın
  // aralığını ikiye katlıyordu (yerleşimi mount-sihirbaz.spec.js → BAŞLANGIÇ SÜTUNU ölçer).
  // ADIMIN SATIRI: AD VE GİRİLENLER (kullanıcı 2026-11-09, Canlı Not 96: *"bu başlıklarda neler
  // girildiği yazılsın. Böylesi de çok sade olmuş."*): adın altında adımda girilenlerin ADLARI —
  // cümle değil (nokta yok, ' · ' ayraçlı ad listesi). Canlı Not 83'te kalkmıştı (adım yalnız ad).
  test('ADIMDA AD VE GİRİLENLER · YÖNLENDİRME DÜĞMENİN YANINDA · künye ile tablonun arası kartın aralığı', () => {
    W.veMntWizAc();
    // talimat (Canlı Not 93) satırda değil, listenin altındaki bölümde
    expect(W.VE_MW_STEPS.every((s) => Object.keys(s).join() === 'key,ad,girdi,talimat')).toBe(true);
    W.VE_MW_STEPS.forEach((s) => expect([s.key, /[.!?]$/.test(s.girdi), s.girdi.split(' · ').length >= 2,
      s.girdi.replace(/ · /g, ' ').split(/\s+/).length < 8]).toEqual([s.key, false, true, true]));
    expect([...document.querySelectorAll('#ve-mw-nav .ve-fw-step-t')].map((t) => [t.querySelector('b').textContent, t.querySelector('em').textContent.replace(/\u00a0/g, ' ')]))
      .toEqual(W.VE_MW_STEPS.map((s) => [s.ad, s.girdi]));
    // satır maddeden kırılır: her madde bölünmez, ayraç önceki maddeye yapışık
    const em = document.querySelector('#ve-mw-nav .ve-fw-step-t em');
    expect([...em.querySelectorAll('span.ve-mw-nw')].map((x) => x.textContent)).toEqual(W.VE_MW_STEPS[0].girdi.split(' · '));
    expect(em.innerHTML).toMatch(/<\/span>&nbsp;· <span/);
    const satir = document.querySelector('#ve-mw-yan .ve-fw-stp[data-ve-dropzone="step"] > .ve-fw-rowbtns');
    expect([...satir.children].map((e) => e.className)).toEqual(['ve-fw-btn ve-fw-stp-sec', 've-fw-dim ve-fw-stp-yon']);
    expect(satir.querySelector('.ve-fw-stp-yon').textContent).toBe('STEP dosyasını seçin ya da buraya bırakın.');
    expect(document.querySelectorAll('#ve-mw-yan p.ve-fw-stp-yon')).toHaveLength(0);
    const css = require('fs').readFileSync(require('path').join(__dirname, '../../css/styles.css'), 'utf8');
    expect(css).toMatch(/\n\.ve-fw-rowbtns > \.ve-fw-stp-yon\{ flex:1 1 0; min-width:0; margin:0; text-wrap:balance; \}/);
    expect(css).toMatch(/\n#ve-mw-yan \.ve-fw-exnote, #ve-mw-yan \.ve-fw-exspec\{ margin-bottom:0; \}/);
    expect(css).not.toMatch(/#ve-mw-nav \.ve-fw-step\{/);               // satır FEAD'in kabuğunun düzeninde (ad + girilenler)
  });
  // TALİMAT VE EKSİKLER (kullanıcı 2026-11-09, Canlı Not 93: *"hangi adımdaysak neler yapılması
  // gerektiğini talimat gibi yazsak … Adım eksikliklerini de ekleyelim. Yani güzel ayrı bir yapı
  // olsun."*): adım listesinin altında açık adımın talimatı ve eksikleri. Önce eksikler girdilerin
  // sütunundaydı (Başlangıç ve Özet'te hiç yoktu) ve talimat yoktu; şimdi tek yerde, beş adımda da.
  // DÜZENLEYİCİ BÖLÜMLÜ (kullanıcı 2026-11-10, Canlı Not 117 · 118: *"Çok düz olmuş … Başlıklar yok,
  // bold yazılar yok. Neyin ne olduğu belli olmadığı için karışık duruyor"* · *"Diğer kısımları da"*):
  // Seçili gövde ve Seçili takoz başlıklı bölümlerde; üçlünün her kutusu kendi eksenini taşır.
  test('DÜZENLEYİCİ BÖLÜMLÜ: gövde ve takoz düzenleyicisinde başlıklı bölümler, kalın etiket, üçlüde eksen', () => {
    W.veMntWizAc();
    const bolumler = () => [...document.querySelectorAll('#ve-mw-yan .ve-mw-ed > .ve-mw-ed-bolum > .ve-mw-ed-bas')].map((b) => b.textContent);
    const eksenler = () => [...document.querySelectorAll('#ve-mw-yan .ve-mw-ed .ve-mw-ed-xyz')].map((r) => [...r.querySelectorAll('.ve-mw-eks > i')].map((i) => i.textContent));
    W.veMntWizGoto(W.VE_MW_STEPS.findIndex((x) => x.key === 'govde'));
    W.veMntWizGovdeEkle('mnt-motor');
    // birim bölümün başlığında: etiket kutuların yanında tek satır (Canlı Not 136)
    expect(bolumler()).toEqual(['Kimlik', 'Kütle ve ağırlık merkezi', 'Atalet [kg·m²]']);
    expect(eksenler()).toEqual([['x', 'y', 'z'], ['xx', 'yy', 'zz'], ['xy', 'xz', 'yz']]);
    // her kutu kendi etiketinin içinde: ekran okuyucunun adı girdide
    [...document.querySelectorAll('#ve-mw-yan .ve-mw-eks')].forEach((l) => {
      expect(l.querySelector('input.ve-fw-inp').getAttribute('aria-label')).toBeTruthy();
      expect(l.querySelector('i').getAttribute('aria-hidden')).toBe('true');
    });
    W.veMntWizGoto(W.VE_MW_STEPS.findIndex((x) => x.key === 'takoz'));
    W.veMntWizTakozEkle();
    expect(bolumler()).toEqual(['Kimlik', 'Konum [mm]', 'Rijitlik [N/mm]', 'Kapasite [kg]']);
    expect(eksenler()).toEqual([['x', 'y', 'z'], ['x', 'y', 'z'], ['x', 'y', 'z']]);
    const css = require('fs').readFileSync(require('path').join(__dirname, '../../css/styles.css'), 'utf8');
    expect(css).toMatch(/\.ve-mw-ed \.ve-fw-ed-alan > span:first-child\{ font-weight:600;/);
    expect(css).toMatch(/\.ve-mw-ed-bas\{[^}]*text-transform:uppercase/);
    W.veMntWizKapat(false);
  });

  // TAKOZ İŞLEMLERİ (kullanıcı 2026-11-10, Canlı Not 120: *"'Aynalı Eşini Ekle' gibi bir saçmalığı
  // kaldıralım."*): takozun düzenleyicisinde yalnız Sil; takoz Takoz ekle ile eklenir.
  test('TAKOZ İŞLEMLERİ: Aynalı eşini ekle yok — düzenleyicide yalnız Sil, listede Takoz ekle; talimatta da yok', () => {
    W.veMntWizAc();
    W.veMntWizGoto(W.VE_MW_STEPS.findIndex((x) => x.key === 'takoz'));
    W.veMntWizTakozEkle();
    const yan = document.getElementById('ve-mw-yan');
    const ops = [...yan.querySelectorAll('.ve-fw-ed-ops')].map((o) => [...o.querySelectorAll('button')].map((b) => b.textContent.trim()));
    expect(ops).toEqual([['Takoz ekle'], ['Sil']]);
    expect(yan.textContent).not.toMatch(/Aynal/);
    expect(W.veMntWizTakozAyna).toBeUndefined();
    expect(W.VE_MW_STEPS.find((x) => x.key === 'takoz').talimat.join(' ')).not.toMatch(/Aynal/);
    W.veMntWizKapat(false);
  });

  test('TALİMAT: adım listesinin altında açık adımın talimatı ve eksikleri; eksikler sütunda ikinci kez yok', () => {
    W.veMntWizAc();
    W.VE_MW_STEPS.forEach((s) => {
      expect([s.key, s.talimat.length >= 3 && s.talimat.length <= 4]).toEqual([s.key, true]);
      s.talimat.forEach((t) => expect([t, /\.$/.test(t), t.split(/\s+/).length <= 12]).toEqual([t, true, true]));
    });
    W.VE_MW_STEPS.forEach((s, i) => {
      W.veMntWizGoto(i);
      const b = document.querySelector('#ve-mw-nav > .ve-mw-talimat');
      expect(b).not.toBeNull();
      expect(b.previousElementSibling.matches('ol.ve-fw-steps')).toBe(true);   // listenin hemen altında
      // talimatın başlığı yok, liste bölümün ilk öğesi; tek başlık Eksikler (Canlı Not 95)
      expect(b.firstElementChild.matches('ol.ve-mw-talimat-liste')).toBe(true);
      expect([...b.querySelectorAll('.ve-mw-talimat-bas')].map((h) => h.firstChild.textContent.trim())).toEqual(['Eksikler']);
      expect([...b.querySelectorAll('.ve-mw-talimat-liste li')].map((l) => l.textContent)).toEqual(s.talimat);
      const sorun = W.veMntWizIssues(W.veMntWizCoz(W.veMntWizDefault()), i);
      const eksik = [...b.querySelectorAll('.ve-mw-eksik-liste .ve-mw-eksik')];
      expect(eksik.map((e) => e.textContent)).toEqual(sorun.map((x) => x.m));
      expect(eksik.map((e) => e.className.replace('ve-mw-eksik ve-mw-eksik-', ''))).toEqual(sorun.map((x) => x.tur));
      if (!sorun.length) expect(b.querySelector('.ve-mw-eksik-ok').textContent).toBe('Eksik yok.');
      expect(document.getElementById('ve-mw-issue')).toBeNull();        // girdilerin sütununda ikinci kopya yok
    });
    // boş modelde gövde adımı eksik söyler; örnek doldurulunca eksik kalmaz (canlı yama rayı tazeler)
    W.veMntWizGoto(1);
    expect(document.querySelectorAll('#ve-mw-nav .ve-mw-eksik-err').length).toBeGreaterThan(0);
    const ilk = core.getMountExampleList()[0].id;
    W.veMntWizOrnek(ilk);
    W.veMntWizGoto(1);
    expect(document.querySelectorAll('#ve-mw-nav .ve-mw-eksik-err')).toHaveLength(0);
    W.veMntWizKapat(true);
    // Eksikler'in başlığı KALIN ve başlık renginde (Canlı Not 95: *"Başlık olduğu belli olsun."* —
    // önce 10 px, 600, soluk)
    const css = require('fs').readFileSync(require('path').join(__dirname, '../../css/styles.css'), 'utf8');
    const i = css.indexOf('\n.ve-mw-talimat-bas{'), kural = css.slice(i, css.indexOf('}', i)).replace(/\s+/g, ' ');
    expect(kural).toMatch(/font-size:var\(--fs-tiny\); font-weight:700;/);
    expect(kural).toMatch(/color:var\(--text-heading\);/);
  });
  test('boş durumun eksikleri gövde ve takoz adımında', () => {
    const l = W.veMntWizSorunlar(W.veMntWizDefault());
    expect(l.filter((s) => s.tur === 'err').map((s) => s.adim).sort()).toEqual(['govde', 'takoz']);
  });
  test('tek doğru üzerindeki üç takoz MEKANİZMA: çözücünün kuralı ve cümlesi (çekirdekten)', () => {
    const takoz = (x, y) => ({ ad: 'T' + x, x, y, z: 450, kxs: 900, kys: 700, kzs: 400, kxd: 1400, kyd: 1050, kzd: 600 });
    const st = (dy) => ({ govdeler: [{ type: 'mnt-motor', ad: 'Motor', mass: 1200, cgx: 300, cgy: 20, cgz: 650, Ixx: 90, Iyy: 140, Izz: 120 }],
      takozlar: [takoz(-200, 20), takoz(300, 20), takoz(900, 20 + dy)], tork: {} });
    const hata = (l) => l.filter((s) => s.tur === 'err');
    expect(hata(W.veMntWizSorunlar(st(0)))).toEqual([{ adim: 'takoz', tur: 'err', m: core.mechanismProblem('dogru', 3) }]);
    expect(hata(W.veMntWizSorunlar(st(20)))).toEqual([]);
  });
});

describe('STEP KARTI — rol → hesap → kütle → aktar', () => {
  test('roller BOŞ açılır; AYNI rol iç içe olmaz, başka rol iç içe kalır — parça en yakın rollü atanın biriminde', () => {
    W.veMntWizAc();
    const s = W.veMntWizStpOku(S.gucGrubu(), 'guc.stp', 'duz');
    expect(s.durum).toBe('hazir');
    expect(s.roller.every((r) => r === null)).toBe(true);
    const asm = dugumi(s, 'Arka braket'), ust = dugumi(s, 'Braket üst'), alt = dugumi(s, 'Braket alt');
    W.veMntWizStpRol(ust, 'mnt-bracket');
    W.veMntWizStpRol(asm, 'mnt-bracket');
    expect(s.roller[ust]).toBe(null);
    expect(s.roller[asm]).toBe('mnt-bracket');
    expect(W.veMntWizStpRol(asm, 'fead-crank')).toBe(false);     // Takoz rolü değil
    // gerçek dosyanın kalıbı: takoz motor alt montajının İÇİNDE
    W.veMntWizStpRol(ust, 'mnt-mount');
    expect([s.roller[asm], s.roller[ust]]).toEqual(['mnt-bracket', 'mnt-mount']);
    const B = STP.veMntStpBirimler(s.sonuc, s.roller), ad = (pi) => s.sonuc.parcalar[pi].ad;
    expect(B.map((b) => [b.tip, b.parcalar.map(ad)])).toEqual([['mnt-bracket', ['Braket alt']], ['mnt-mount', ['Braket üst']]]);
    expect(s.sonuc.agac[alt].parcalar.map(ad)).toEqual(['Braket alt']);
    // ağaçta kendi rolü olan düğüm atasının "birimi" sayılmaz
    const d = document.createElement('div');
    d.innerHTML = W._mwStpAgacHTML(s);
    const satir = Array.from(d.querySelectorAll('tr[data-ve-stp]')).find((x) => x.cells[0].textContent.trim() === 'Braket üst');
    expect([satir.cells[2].textContent.trim(), satir.classList.contains('ve-fw-stp-off')]).toEqual(['—', false]);
    W.veMntWizStpRol(asm, 'mnt-mount');                           // aynı rol: içteki düşer
    expect([s.roller[asm], s.roller[ust]]).toEqual(['mnt-mount', null]);
  });

  test('hesap → kütle → aktar: sihirbaz STEP\'in durumuyla dolar, "S" işaretleri taşınır', () => {
    W.veMntWizAc();
    const s = stepYukle();
    expect(W.veMntWizStpDenetim(s).engel).toEqual(['Henüz hesaplanmadı.']);
    const coz = W.veMntWizStpHesapla();
    expect(coz.ok).toBe(true);
    expect(W._mwStpOnizleme()).toBe(true);                       // masa STEP'i çiziyor
    W.veMntWizStpKutle(dugumi(s, 'Motor bloğu'), '400');
    expect(W.veMntWizStpKutle(dugumi(s, 'Braket üst'), '5')).toBe(false);   // birim değil
    const kayit = W.veMntWizStpAktar();
    expect(kayit).not.toBeNull();
    const st = W.veMntWizState();
    expect(st.seededFrom).toBe('step');
    expect(st.govdeler.map((g) => g.type)).toEqual(['mnt-motor', 'mnt-gearbox', 'mnt-bracket']);
    expect(st.takozlar).toHaveLength(4);
    const mot = st.govdeler[0];
    expect(mot.mass).toBe(400);
    expect(mot.kaynak).toEqual({ cg: true, I: true, not: 'homojen yoğunluk' });
    expect(st.govdeler[1].kaynak).toEqual({ cg: true, not: 'homojen yoğunluk' });   // kütle yok → atalet yok
    expect(st.takozlar[0].kaynak).toEqual({ konum: true });
    expect(W._mwStpOnizleme()).toBe(false);                      // aktarıldı: masa durumu çizer
    // Elle yazılan değer geometriden geleni geçer: işaret düşer
    W._mwSet('govde.' + mot.key + '.cgx', '-310');
    expect(W.veMntWizState().govdeler[0].kaynak).toEqual({ I: true, not: 'homojen yoğunluk' });
  });

  test('kart: dosya, parça tablosu, hesap ve aktar düğmeleri; az takoz UYARI (engel değil)', () => {
    W.veMntWizAc();
    const s = W.veMntWizStpOku(S.gucGrubu(), 'guc.stp', 'duz');
    W.veMntWizStpRol(dugumi(s, 'Motor bloğu'), 'mnt-motor');
    W.veMntWizStpRol(dugumi(s, 'Sağ ön takoz'), 'mnt-mount');
    W.veMntWizStpHesapla();
    const kap = document.createElement('div');
    kap.innerHTML = W._mwStpKartHTML();
    // açılışta yalnız kökün çocukları, dallar kapalı (Canlı Not 7)
    expect(kap.querySelectorAll('table.ve-mw-tbl-stp tbody tr')).toHaveLength(s.sonuc.agac.find((d) => d.ebeveyn < 0).cocuklar.length);
    expect(kap.querySelector('#ve-mw-stp-hesapla')).not.toBeNull();
    expect(kap.querySelector('#ve-mw-stp-aktar').disabled).toBe(false);
    expect(kap.querySelector('input[data-mw-stp-kutle]')).not.toBeNull();
    const d = W.veMntWizStpDenetim(s);
    expect(d.engel).toEqual([]);
    expect(d.uyari.join(' ')).toMatch(/1 takoz rolü/);
  });

  test('dosya karttan kaldırılınca durum kalır, kart boşalır', () => {
    W.veMntWizAc();
    stepYukle();
    W.veMntWizStpHesapla();
    W.veMntWizStpAktar();
    W.veMntWizStpKapat();
    expect(W.veMntWizStp()).toBe(null);
    expect(W.veMntWizState().govdeler).toHaveLength(3);
    expect(W._mwStpKartHTML()).toMatch(/guc\.stp<\/b> aktarılmıştı/);
  });
});

// OKUMA ARAYÜZÜ KİLİTLEMEZ (kökteki kural; Takoz STEP adım 2): kart okunurken
// ilerlemeyi ve Vazgeç'i taşır; Vazgeç, başka dosya ve sihirbazın kapanması
// süren okumayı bırakır. Okumanın dilimleri js/step-p21.js'te
// (tests/unit/step-p21.test.js → DİLİMLİ).
describe('STEP OKUMASI — çubuk, Vazgeç, bırakma', () => {
  const PK = require('../../js/pencere-kabuk.js');
  beforeAll(() => {
    global.vePencereEylem = PK.vePencereEylem;
    global.vePencereIlerleme = PK.vePencereIlerleme;
    global.vePencereIlerlemeHTML = PK.vePencereIlerlemeHTML;
    global.veSayi = global.veSayi || require('../../js/sayi.js').veSayi;
  });
  afterAll(() => { delete global.vePencereEylem; delete global.vePencereIlerleme; delete global.vePencereIlerlemeHTML; });
  // Baytları sonradan verilen dosya (okunurken durum gözlenebilsin)
  const bekleyen = (ad, metin) => {
    let ver;
    const p = new Promise((ok) => { ver = () => ok(Uint8Array.from(Buffer.from(metin, 'utf8')).buffer); });
    return { dosya: { name: ad, arrayBuffer: () => p }, ver };
  };
  const kart = () => { const d = document.createElement('div'); d.innerHTML = W._mwStpKartHTML(); return d; };

  test('okunurken: çubuk + Vazgeç, kart dosyayı adıyla söyler; bitince parça tablosu ve toplam süre', async () => {
    W.veMntWizAc();
    const f = bekleyen('guc.stp', S.gucGrubu());
    const bitis = W.veMntWizStpDosya(f.dosya);
    expect(W.veMntWizStp().durum).toBe('okunuyor');
    let k = kart();
    expect(k.querySelector('.ve-fw-stp-wait b').textContent).toBe('guc.stp');
    const cubuk = k.querySelector('.ve-fp-yurut[data-is] .ve-fp-ilerleme[role="progressbar"]');
    expect(cubuk).not.toBeNull();
    expect(cubuk.getAttribute('aria-label')).toBe('STEP okuma');
    expect(k.querySelector('#ve-mw-stp-vazgec').textContent.trim()).toBe('Vazgeç');
    f.ver();
    const s = await bitis;
    expect(s.durum).toBe('hazir');
    expect(W.veMntWizStp()).toBe(s);
    expect(s.sonuc.sureMs.toplam).toBeGreaterThanOrEqual(0);
    k = kart();
    expect(k.querySelector('#ve-mw-stp-vazgec')).toBeNull();
    expect(k.querySelectorAll('table.ve-mw-tbl-stp tbody tr')).toHaveLength(s.sonuc.agac.find((d) => d.ebeveyn < 0).cocuklar.length);
  });

  test('çubuğun verisi evreden: dosya · açma · kayıtlar (MB) · montaj ağacı · parçalar', () => {
    const v = (o) => W._mwStpIlerlemeVeri({ ilerleme: o }).metin;
    const MB = 1048576;
    expect(v({ evre: 'dosya', bayt: 212 * MB, toplam: 403 * MB })).toBe('Dosya 212 / 403 MB');
    expect(v({ evre: 'ac', bayt: 120 * MB, toplam: 403 * MB })).toBe('Açma 120 / 403 MB');
    expect(v({ evre: 'tara', bayt: 1.5 * MB, toplam: 3 * MB })).toBe('Kayıtlar 1,5 / 3,0 MB');
    expect(v({ evre: 'montaj' })).toBe('Montaj ağacı');
    expect(v({ evre: 'agac', parca: 4512, parcaToplam: 11694 })).toBe('Parçalar 4.512 / 11.694');
  });

  test('Vazgeç: kart boşalır; dosya sonradan okunsa da sonuç yazılmaz', async () => {
    W.veMntWizAc();
    const f = bekleyen('guc.stp', S.gucGrubu());
    const bitis = W.veMntWizStpDosya(f.dosya);
    expect(W.veMntWizStpVazgec()).toBe(true);
    expect(W.veMntWizStp()).toBeNull();
    expect(W._mwStpKartHTML()).toMatch(/STEP dosyası seç/);
    f.ver();
    expect(await bitis).toBeNull();
    expect(W.veMntWizStp()).toBeNull();
    expect(W.veMntWizStpVazgec()).toBe(false);                 // süren okuma yok
  });

  // Saat her okumada 1 ms ilerler: okuma kesin olarak birçok dilim sürer;
  // Vazgeç ilk ilerlemede basılır.
  test('okuma sürerken: Vazgeç işi bırakır (okuyucunun vazgec\'i çağrılır, ilerleme durur)', async () => {
    W.veMntWizAc();
    let t = 0;
    jest.spyOn(performance, 'now').mockImplementation(() => (t += 1));
    const asil = global.veMntStpOkuDilimli;
    let is = null, il = 0;
    global.veMntStpOkuDilimli = (b, bildir) => {
      is = asil(b, (o) => { il++; bildir(o); if (il === 1) W.veMntWizStpVazgec(); });
      jest.spyOn(is, 'vazgec');
      return is;
    };
    try {
      const f = bekleyen('guc.stp', S.gucGrubu());
      const bitis = W.veMntWizStpDosya(f.dosya);
      f.ver();
      expect(await bitis).toBeNull();
      expect(is.vazgec).toHaveBeenCalledTimes(1);
      expect(il).toBe(1);
      expect(W.veMntWizStp()).toBeNull();
    } finally { global.veMntStpOkuDilimli = asil; jest.restoreAllMocks(); }
  });

  test('başka dosya seçmek süren okumayı bırakır; son seçilen okunur, eskisi hiç ayrıştırılmaz', async () => {
    W.veMntWizAc();
    const asil = global.veMntStpOkuDilimli, oku = jest.fn(asil);
    global.veMntStpOkuDilimli = oku;
    try {
      const a = bekleyen('eski.stp', S.gucGrubu());
      const b = bekleyen('yeni.stp', S.gucGrubu());
      const ba = W.veMntWizStpDosya(a.dosya);
      const bb = W.veMntWizStpDosya(b.dosya);
      b.ver(); a.ver();
      expect(await ba).toBeNull();
      expect((await bb).dosya).toBe('yeni.stp');
      expect(W.veMntWizStp().dosya).toBe('yeni.stp');
      expect(oku).toHaveBeenCalledTimes(1);
    } finally { global.veMntStpOkuDilimli = asil; }
  });

  test('sihirbaz kapanınca süren okuma bırakılır', async () => {
    W.veMntWizAc();
    const f = bekleyen('guc.stp', S.gucGrubu());
    const bitis = W.veMntWizStpDosya(f.dosya);
    W.veMntWizKapat(false);
    expect(W.veMntWizStp()).toBeNull();
    f.ver();
    expect(await bitis).toBeNull();
    expect(W.veMntWizStp()).toBeNull();
  });

  test('okunamayan dosya: kart hata durumunda, sebep adresli', async () => {
    W.veMntWizAc();
    const s = await W.veMntWizStpDosya({ name: 'kotu.stp', arrayBuffer: () => Promise.reject(new Error('izin yok')) });
    expect(s.durum).toBe('hata');
    expect(s.hata).toBe('Dosya okunamadı: izin yok');
    const z = await W.veMntWizStpDosya({ name: 'yarim.stpZ', arrayBuffer: () => Promise.resolve(Uint8Array.from([0x1f, 0x8b, 8, 0, 0]).buffer) });
    expect(z.durum).toBe('hata');
    expect(z.hata).toMatch(/gzip/);
  });
});

// AĞAÇ DAL DAL (kullanıcının montajı ~11.700 parça): her satırı rol listesiyle
// çizmek kartı 6,6 sn donduruyordu ve kart her rol değişiminde yeniden
// kuruluyor (ölçüldü). AÇILIŞTA KAPALI (kullanıcı 2026-11-05, Canlı Not 7:
// "dosyayı yüklediğimizde ürün ağacı açık olarak geliyor. Kapalı olarak
// gelsin."): yalnız kökün çocukları görünür, her dal kapalı — küçük montaj
// da (eskiden tam açık, büyüğünde 120 satıra sığan üst düzeyler açıktı).
describe('AĞAÇ DAL DAL — açılışta kapalı, dal sayfa sayfa', () => {
  // kök → A (300 parça) · B (10 parça) · iki kök parçası: 315 satır > sınır
  function buyuk() {
    const alt = [{ id: 'ALT_A', ad: 'Alt montaj A', konum: [0, 0, 0] }, { id: 'ALT_B', ad: 'Alt montaj B', konum: [2000, 0, 0] }];
    const p = [];
    for (let i = 0; i < 300; i++) p.push({ id: 'A' + i, ad: 'A parça ' + i, sekil: 'kutu', olcu: [20, 20, 20], konum: [i * 30, 0, 0], alt: 'ALT_A' });
    for (let i = 0; i < 10; i++) p.push({ id: 'B' + i, ad: 'B parça ' + i, sekil: 'kutu', olcu: [20, 20, 20], konum: [i * 30, 0, 0], alt: 'ALT_B' });
    p.push({ id: 'K1', ad: 'Kök parçası 1', sekil: 'kutu', olcu: [10, 10, 10], konum: [0, 500, 0] });
    p.push({ id: 'K2', ad: 'Kök parçası 2', sekil: 'kutu', olcu: [10, 10, 10], konum: [0, 600, 0] });
    return S.guçGrubuStep(p, { altMontajlar: alt });
  }
  let s, METIN;
  beforeAll(() => { METIN = buyuk(); });
  beforeEach(() => { W.veMntWizAc(); s = W.veMntWizStpOku(METIN, 'buyuk.stp', 'duz'); });
  const satir = () => W._mwStpSatirlar(s);
  const adlar = () => satir().map((d) => (d.daha ? '+' + d.kalan : d.ad));
  const dug = (ad) => s.sonuc.agac.filter((d) => d.ad === ad)[0].i;

  test('varsayılan: yalnız kökün çocukları, her dal KAPALI', () => {
    const a = adlar();
    expect([...a].sort()).toEqual(['Alt montaj A', 'Alt montaj B', 'Kök parçası 1', 'Kök parçası 2']);
    const k = document.createElement('div'); k.innerHTML = W._mwStpKartHTML();
    expect(k.querySelectorAll('table.ve-mw-tbl-stp tbody tr')).toHaveLength(4);
    ['Alt montaj A', 'Alt montaj B'].forEach((ad) => {
      const ac = k.querySelector('tr[data-ve-stp="' + dug(ad) + '"] .ve-mw-stp-ac');
      expect(ac.getAttribute('aria-expanded')).toBe('false');
      expect(ac.getAttribute('aria-label')).toBe('Aç — ' + ad);
    });
    expect(k.querySelectorAll('.ve-mw-stp-yaprak').length).toBe(2);
    expect(W.VE_MW_STP_SATIR).toBeUndefined();               // satır sınırıyla açılan üst düzeyler emekli
  });

  test('dal açılır: ilk sayfa + "… düğüm daha"; daha → bir sayfa daha; kapat', () => {
    const A = dug('Alt montaj A');
    W.veMntWizStpAc(A);
    expect(adlar().filter((x) => /^A parça/.test(x))).toHaveLength(W.VE_MW_STP_SAYFA);
    expect(adlar()).toContain('+' + (300 - W.VE_MW_STP_SAYFA));
    let k = document.createElement('div'); k.innerHTML = W._mwStpKartHTML();
    expect(k.querySelector('.ve-mw-stp-dahabtn').textContent.trim()).toBe('250 düğüm daha');
    W.veMntWizStpDaha(A);
    expect(adlar().filter((x) => /^A parça/.test(x))).toHaveLength(2 * W.VE_MW_STP_SAYFA);
    W.veMntWizStpAc(A);
    expect(adlar().filter((x) => /^A parça/.test(x))).toHaveLength(0);
    // satır sırası ağacın sırası: A'nın parçaları A'dan sonra, B'den önce
    W.veMntWizStpAc(A);
    const a = adlar();
    expect(a.indexOf('A parça 0')).toBe(a.indexOf('Alt montaj A') + 1);
    expect(a.indexOf('Alt montaj B')).toBeGreaterThan(a.indexOf('+250'));
  });

  test('rol verilen düğüm dal kapalıyken de görünür (ve sırası ağaçtaki yeri)', () => {
    W.veMntWizStpRol(dug('A parça 250'), 'mnt-mount');
    const a = adlar();
    expect(a).toContain('A parça 250');
    expect(a.indexOf('A parça 250')).toBe(a.indexOf('Alt montaj A') + 1);
    expect(a.filter((x) => /^A parça/.test(x))).toHaveLength(1);
  });

  test('küçük montaj da kapalı gelir: kökün çocukları, alt montaj kapalı', () => {
    const k = W.veMntWizStpOku(S.gucGrubu(), 'guc.stp', 'duz');
    const kok = k.sonuc.agac.find((d) => d.ebeveyn < 0);
    const sat = W._mwStpSatirlar(k);
    expect(sat.map((d) => d.i)).toEqual(kok.cocuklar);
    expect(sat.some((d) => d.daha)).toBe(false);
    expect(sat.filter((d) => d.cocuklar.length).length).toBeGreaterThan(0);
    sat.filter((d) => d.cocuklar.length).forEach((d) => expect(k.acik[d.i]).toBeUndefined());
  });
});

describe('BİR KURULUM = BİR GERİ-AL ADIMI', () => {
  test('"Modeli kur": gövdeler, takozlar ve eksik araçlar TEK veStateBatch içinde', () => {
    W.veMntWizAc();
    stepYukle();
    W.veMntWizStpHesapla();
    W.veMntWizStpAktar();
    const sonuc = W.veMntWizKur();
    expect(sonuc).not.toBeNull();
    expect(global.veStateBatch).toHaveBeenCalledTimes(1);
    const tipler = global.nodes.map((n) => n.type);
    expect(tipler.filter((t) => t === 'mnt-mount')).toHaveLength(4);
    ['mnt-motor', 'mnt-gearbox', 'mnt-bracket'].forEach((t) => expect(tipler).toContain(t));
    cp.VE_MNT_ARAC_TIPLERI.forEach((t) => expect(tipler.filter((x) => x === t)).toHaveLength(1));
    const takoz = global.nodes.filter((n) => n.type === 'mnt-mount')[0];
    expect([takoz.data.x, takoz.data.y, takoz.data.z]).toEqual([-650, 380, 450]);   // üst yüzün merkezi (adım 5)
    expect(W.veMntWizAcik()).toBe(false);
  });

  // Kullanım notu T02: STEP'ten başla şeridi kurmuştu; model başka tabana kurulup
  // iki takoz Takoz Özellikleri'nin ve Çözücü'nün üstüne düşüyordu
  test('"Modeli kur": tuvaldeki araç şeridinin TABANINA kurar — hiçbir kutu şeridin kutusuna binmez', () => {
    const SER = cp.VE_MNT_STARTER_LAYOUT.filter((it) => it.ly === 20);
    const taban = { x: 5137, y: 4211 };
    SER.forEach((it) => global.createNode(it.type, taban.x + it.lx, taban.y + it.ly));
    const once = global.nodes.length;
    W.veMntWizAc();
    stepYukle();
    W.veMntWizStpHesapla();
    W.veMntWizStpAktar();
    expect(W.veMntWizKur()).not.toBeNull();
    const yeni = global.nodes.slice(once), arac = global.nodes.slice(0, once);
    expect(yeni.length).toBeGreaterThan(5);
    expect(global.nodes.length - yeni.length).toBe(SER.length);                     // şerit ikinci kez kurulmaz
    const kutu = (n) => { const d = veNodeDefaultSize(n.type); return [n.x, n.y, n.x + d.w, n.y + d.h + 20]; };   // +20: ad
    const ciftler = [];
    yeni.forEach((a) => arac.forEach((b) => {
      const A = kutu(a), B = kutu(b);
      if (A[0] < B[2] && B[0] < A[2] && A[1] < B[3] && B[1] < A[3]) ciftler.push(a.type + ' ↔ ' + b.type);
    }));
    expect(ciftler).toEqual([]);
    // sıralar şeridin tabanından (TEMEL YERLEŞİM, Canlı Not 80): aktarma hattı 320; braket ve
    // taşınan kütle hattın üstünde (sağ) ya da altında (sol) 100 px; yan takozlar dış sırada
    // (kutular sırada ORTALARINDAN hizalı)
    const HAT = ['mnt-motor', 'mnt-gearbox', 'mnt-transfer', 'mnt-shaft'];
    const mrk = (n) => n.y - taban.y + veNodeDefaultSize(n.type).h / 2;
    const hat = yeni.filter((n) => HAT.includes(n.type)), hm = mrk(hat[0]);
    hat.forEach((n) => expect([n.type, mrk(n)]).toEqual([n.type, hm]));
    yeni.forEach((n) => {
      const d = n.data || {};
      if (n.type === 'mnt-mount') expect([n.data.y > 0 ? 'üst' : 'alt', mrk(n) < hm - 100 ? 'üst' : mrk(n) > hm + 100 ? 'alt' : 'hat'])
        .toEqual([n.data.y > 0 ? 'üst' : 'alt', n.data.y > 0 ? 'üst' : 'alt']);
      else if (!HAT.includes(n.type)) expect([n.type, n.y - taban.y]).toEqual([n.type, d.cgy > 0 ? 220 : 420]);
    });
    // yan sıradaki takozun adı yanda, dışa doğru (bağlantı çizgisi adın içinden geçmesin)
    const yan = yeni.filter((n) => n.type === 'mnt-mount' && n.y - taban.y !== 320).sort((a, b) => a.y - b.y || a.x - b.x);
    expect(yan.map((n) => n.data.labelPos)).toEqual(['left', 'right', 'left', 'right'].slice(0, yan.length));
  });

  // TEMEL YERLEŞİM (kullanıcı 2026-11-09, Canlı Not 80: "Bu 10TON TTA'nın topolojisi. Çok çirkin
  // duruyor … Temel metodolojiye de uygun olsun.") Önce: 11 gövde hattın sırasında (kulaklar, PTO
  // ve aksesuarlar motorla şanzımanın arasında, hat çizgisi içlerinden geçiyordu) ve 31 mm yandaki
  // ön takoz sağ takozların sırasındaydı (şasiye çapraz yay).
  test('TEMEL YERLEŞİM: 10 Ton TTA — hat ortada, braket ve aksesuar üstte/altta, iki ön takoz hattın solunda, yan takozlar dışta', () => {
    W.veMntWizAc();
    const cozucu = global._mntResolveTopology;
    delete global._mntResolveTopology;                                     // çekirdeğin kaydından (eşzamanlı)
    try { expect(W.veMntWizOrnek('tta10')).toBe(true); } finally { if (cozucu) global._mntResolveTopology = cozucu; }
    const L = W.veMntWizNodes();
    const HAT = ['mnt-motor', 'mnt-gearbox', 'mnt-transfer', 'mnt-shaft'];
    const mrk = (n) => n.ly + veNodeDefaultSize(n.type).h / 2;               // kutular sırada ortalarından hizalı
    const govde = L.filter((n) => n.rol === 'govde'), hat = govde.filter((n) => HAT.includes(n.type)), hm = mrk(hat[0]);
    expect(hat.map((n) => mrk(n))).toEqual(hat.map(() => hm));                                // hat çizgisi yatay
    expect(govde.filter((n) => mrk(n) === hm)).toHaveLength(3);                                // motor · şanzıman · kardan payı (11 → 3)
    govde.filter((n) => !HAT.includes(n.type)).forEach((n) => expect([n.customName, n.ly]).toEqual([n.customName, n.data.cgy > 0 ? 220 : 420]));
    // iki ön takoz (y = −49 · +53 mm, föyün Mount 1 · 2'si — Canlı Not 68) hattın sırasında,
    // şasinin çerçevesinin dışında yan yana (çerçeve gövdeleri adlarıyla sarar + 26 px); adları
    // altta ve çerçeveye değmez (dış yanında zeminin taraması); yan takozlar dış sıralarda
    const onler = L.filter((n) => n.rol === 'takoz' && / ön takoz$/.test(n.customName));
    expect(onler.map((n) => n.customName)).toEqual(['Sol ön takoz', 'Sağ ön takoz']);
    const cerceveSol = Math.min(...govde.map((n) => { const w = veNodeDefaultSize(n.type).w, g = Math.max(60, n.customName.length * 7.8);
      return n.lx + Math.min(0, w / 2 - g / 2); })) - 26;
    const tw = veNodeDefaultSize('mnt-mount').w;
    onler.forEach((on) => {
      const tg = Math.max(60, on.customName.length * 7.8);
      expect([on.customName, mrk(on), on.adYer]).toEqual([on.customName, hm, 'bottom']);
      expect(on.lx + tw).toBeLessThanOrEqual(cerceveSol - 20);                                      // yay payı
      expect(on.lx + tw / 2 + tg / 2).toBeLessThanOrEqual(cerceveSol - 4);                           // ad çerçeveye değmez
    });
    L.filter((n) => n.rol === 'takoz' && !onler.includes(n)).forEach((n) => expect([n.customName, n.ly]).toEqual([n.customName, n.data.y > 0 ? 130 : 510]));
    // hiçbir kutu (adıyla) ötekine binmez
    // kutu ve adı: yan ad yanda (7 px payla), alttaki ad kutunun ortasında; ad 12 px · harf başına ≤ 7,2 px
    const kutu = (n) => {
      const g = Math.max(60, n.customName.length * 7.2), h = veNodeDefaultSize(n.type).h + 20;
      const yatay = n.adYer === 'left' ? [n.lx - 7 - g, n.lx + 60] : n.adYer === 'right' ? [n.lx, n.lx + 67 + g]
        : [Math.min(n.lx, n.lx + 30 - g / 2), Math.max(n.lx + 60, n.lx + 30 + g / 2)];
      return [yatay[0], n.ly, yatay[1], n.ly + h];
    };
    const ciftler = [];
    L.forEach((a, i) => L.slice(i + 1).forEach((b) => {
      const A = kutu(a), B = kutu(b);
      if (A[0] < B[2] && B[0] < A[2] && A[1] < B[3] && B[1] < A[3]) ciftler.push(a.customName + ' ↔ ' + b.customName);
    }));
    expect(ciftler).toEqual([]);
    W.veMntWizKapat(false);
  });

  test('ADLAR BİRBİRİNE GİRMEZ: uzun STEP adlarıyla aynı sıradaki iki adın arası ≥ 4 px', () => {
    const st = W.veMntWizDefault();
    st.govdeler = [
      { key: 'a', type: 'mnt-motor', ad: 'MOTOR ISB6.7', cgx: 0, cgy: 0, cgz: 600 },
      { key: 'b', type: 'mnt-alternator', ad: 'ALTERNATOR 24V 150A', cgx: 100, cgy: 0, cgz: 700 },
      { key: 'c', type: 'mnt-alt-bracket', ad: 'ALTERNATOR BRAKETI', cgx: 130, cgy: 0, cgz: 690 },
      { key: 'd', type: 'mnt-ac', ad: 'KLIMA KOMPRESORU', cgx: 160, cgy: 0, cgz: 720 },
      { key: 'e', type: 'mnt-gearbox', ad: 'SANZIMAN', cgx: 1200, cgy: 0, cgz: 450 }
    ];
    st.takozlar = [];
    // aksesuarlar (y = 0) hattın altındaki sırada, motor ve şanzıman hatta: iki sırada da kural aynı
    const N = W.veMntWizNodes(st);
    expect(N.filter((n) => n.ly === 420).map((n) => n.customName)).toEqual(['ALTERNATOR 24V 150A', 'ALTERNATOR BRAKETI', 'KLIMA KOMPRESORU']);
    const L = N.filter((n) => n.ly === 420).sort((p, q) => p.lx - q.lx);
    const gen = (ad) => ad.length * 7.2;                                    // 12 px Inter büyük harf ortalaması (ölçüldü ≤ 7,2)
    for (let i = 1; i < L.length; i++) {
      const a = L[i - 1], b = L[i];
      const bosluk = (b.lx + 30 - gen(b.customName) / 2) - (a.lx + 30 + gen(a.customName) / 2);
      expect([a.customName, b.customName, bosluk >= 4]).toEqual([a.customName, b.customName, true]);
    }
  });

  test('Boş kanvas: araçlar tek adımda; ikinci çağrı ikinci Çözücü KURMAZ', () => {
    const ilk = cp.veMntKanvasBos();
    expect(global.veStateBatch).toHaveBeenCalledTimes(1);
    expect(ilk.map((n) => n.type).sort()).toEqual(cp.VE_MNT_ARAC_TIPLERI.slice().sort());
    expect(cp.veMntKanvasBos()).toEqual([]);
    expect(global.nodes.filter((n) => n.type === 'mnt-solver')).toHaveLength(1);
  });

  test('Boş kanvas bildirimsiz ortamda da kurduğunu döndürür', () => {
    // Aşama 6 bildirimi silerken koşulunu bırakmıştı: `if(typeof showToast…)`
    // dönüş satırını yönetiyordu — bildirimsiz ortamda dönüş undefined, başlangıç
    // sayfasının `veMntKanvasBos().length` çağrısı patlıyordu.
    const asil = global.showToast;
    delete global.showToast;
    try {
      global.nodes = global.nodes.filter((n) => cp.VE_MNT_ARAC_TIPLERI.indexOf(n.type) < 0);
      const kurulan = cp.veMntKanvasBos();
      expect(Array.isArray(kurulan)).toBe(true);
      expect(kurulan.length).toBe(cp.VE_MNT_ARAC_TIPLERI.length);
    } finally { global.showToast = asil; }
  });
});

// ── HESAP BEKLER (2026-10-20, Takoz adım 3) ──────────────────────────────
// 3B kurulumu durdurulabiliyor: rol verilen birimin parçalarının ağı henüz
// yoksa eşzamanlı hesap büyük montajda arayüzü dakikalarca dondururdu (420
// MB'lık montajda motor %55). Eksik ağ eşiği aşınca hesap BEKLER — kartta
// çubuk ve Vazgeç — ağı ORTAK İŞ üretir, bitince hesap kendiliğinden yapılır.
describe('HESAP BEKLER — eksik ağ büyükse kart çubukla bekler, sonra kendiliğinden hesaplar', () => {
  const PK = require('../../js/pencere-kabuk.js');
  beforeAll(() => {
    global.vePencereEylem = PK.vePencereEylem;
    global.vePencereIlerleme = PK.vePencereIlerleme;
    global.vePencereIlerlemeHTML = PK.vePencereIlerlemeHTML;
    global.veSayi = global.veSayi || require('../../js/sayi.js').veSayi;
  });
  afterAll(() => { delete global.vePencereEylem; delete global.vePencereIlerleme; delete global.vePencereIlerlemeHTML; });
  const esik = W.VE_MW_STP_AG.eszaman;
  afterEach(() => { W.VE_MW_STP_AG.eszaman = esik; });
  const kart = () => { const d = document.createElement('div'); d.innerHTML = W._mwStpKartHTML(); return d; };
  const bekle = async (f) => { for (let i = 0; i < 400 && !f(); i++) await new Promise((r) => setTimeout(r, 0)); };
  const oku = () => W.veMntWizStpOku(S.gucGrubu(), 'guc.stp', 'duz');

  test('eşiğin altında eski davranış: eşzamanlı, bekleme yok', () => {
    W.veMntWizAc();
    const s = oku();
    W.veMntWizStpRol(dugumi(s, 'Motor bloğu'), 'mnt-motor');
    const coz = W.veMntWizStpHesapla();
    expect(coz && coz.ok).toBe(true);
    expect(s.hesapBekliyor || null).toBeNull();
  });

  test('eşik aşılınca: hesap null döner, kartta çubuk + Vazgeç; ağlar bitince sonuç eşzamanlıyla aynı', async () => {
    W.veMntWizAc();
    const ref = oku();
    W.veMntWizStpRol(dugumi(ref, 'Motor bloğu'), 'mnt-motor');
    W.veMntWizStpRol(dugumi(ref, 'Arka braket'), 'mnt-bracket');
    const beklenen = W.veMntWizStpHesapla();
    W.VE_MW_STP_AG.eszaman = 0;
    const s = oku();
    W.veMntWizStpRol(dugumi(s, 'Motor bloğu'), 'mnt-motor');
    W.veMntWizStpRol(dugumi(s, 'Arka braket'), 'mnt-bracket');
    expect(W.veMntWizStpHesapla()).toBeNull();
    expect(s.hesapBekliyor).toBeTruthy();
    expect(s.hesapBekliyor.toplam).toBe(3);                       // motor + braketin iki parçası
    const k = kart();
    expect(k.querySelector('#ve-mw-stp-hesapla')).toBeNull();
    expect(k.querySelector('.ve-fp-yurut[data-is] .ve-fp-ilerleme').getAttribute('aria-label')).toBe('Hesap');
    expect(k.querySelector('#ve-mw-stp-hesap-vazgec').textContent.trim()).toBe('Vazgeç');
    expect(W._mwStpHesapVeri(s).metin).toMatch(/^Parça \d \/ 3$/);
    expect(W.veMntWizStpHesapla()).toBeNull();                    // beklerken ikinci istek yok sayılır
    await bekle(() => !!s.coz);
    expect(s.hesapBekliyor).toBeNull();
    expect(s.coz.ok).toBe(true);
    expect(s.coz.birimler.map((b) => [b.ad, b.konum])).toEqual(beklenen.birimler.map((b) => [b.ad, b.konum]));
    expect(kart().querySelector('#ve-mw-stp-hesapla')).not.toBeNull();
  });

  test('Vazgeç: bekleyen hesap düşer, iş öncelikli listeyi bırakır, sonuç yazılmaz', async () => {
    W.VE_MW_STP_AG.eszaman = 0;
    W.veMntWizAc();
    const s = oku();
    W.veMntWizStpRol(dugumi(s, 'Motor bloğu'), 'mnt-motor');
    expect(W.veMntWizStpHesapla()).toBeNull();
    expect(W.veMntWizStpHesapVazgec()).toBe(true);
    expect(s.hesapBekliyor).toBeNull();
    expect(s.agIs.oncelik).toEqual([]);
    await bekle(() => !s.agDongu);
    expect(s.coz).toBeNull();
    expect(W.veMntWizStpHesapVazgec()).toBe(false);
  });

  test('rol değişince bekleyen hesap düşer; yeni rollerin hesabı bekler ve yapılır', async () => {
    W.VE_MW_STP_AG.eszaman = 0;
    W.veMntWizAc();
    const s = oku();
    W.veMntWizStpRol(dugumi(s, 'Motor bloğu'), 'mnt-motor');
    W.veMntWizStpHesapla();
    const ilk = s.hesapBekliyor;
    W.veMntWizStpRol(dugumi(s, 'Şanzıman gövdesi'), 'mnt-gearbox');
    expect(s.hesapBekliyor).not.toBe(ilk);
    expect(s.hesapBekliyor.toplam).toBeGreaterThan(0);
    await bekle(() => !!s.coz);
    expect(s.coz.birimler.map((b) => b.ad).sort()).toEqual(['Motor bloğu', 'Şanzıman gövdesi']);
  });

  test('bütün roller kalkınca bekleyen hesap düşer, sonuç yazılmaz', async () => {
    W.VE_MW_STP_AG.eszaman = 0;
    W.veMntWizAc();
    const s = oku();
    const m = dugumi(s, 'Motor bloğu');
    W.veMntWizStpRol(m, 'mnt-motor');
    W.veMntWizStpHesapla();
    expect(s.hesapBekliyor).toBeTruthy();
    W.veMntWizStpRol(m, '');
    expect(s.hesapBekliyor).toBeNull();
    await bekle(() => !s.agDongu);
    expect(s.coz).toBeNull();
  });

  test('3B görüntüleyicinin isteği: bütün montaj üretilir, istek kalkınca iş durur', async () => {
    W.veMntWizAc();
    const s = oku();
    expect(W.veMntWizStpAgTum(true)).toBe(true);
    await bekle(() => !s.agDongu);
    expect(s.ag.filter(Boolean)).toHaveLength(s.sonuc.parcalar.length);
    const s2 = oku();
    W.veMntWizStpAgTum(true);
    W.veMntWizStpAgTum(false);
    await bekle(() => !s2.agDongu);
    expect(s2.ag.filter(Boolean).length).toBeLessThan(s2.sonuc.parcalar.length);
  });
});
