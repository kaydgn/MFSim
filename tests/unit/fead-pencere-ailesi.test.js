/**
 * fead-pencere-ailesi.test.js — HER FEAD PENCERESİ KRANK KASNAĞI AİLESİNDE
 *
 * Kullanıcı isteği (2026-09-23): bileşen pencereleri Krank Kasnağı'nın
 * yapısında, KATEGORİ KATEGORİ — kategori sekmeleri ve sekmeden bağımsız sağ
 * sütun. (Tepedeki özet şeridi aynı gün kullanıcı kararıyla KALKTI; küçük
 * resim yalnız kasnak pencerelerinde kaldı — ikisinin de kapısı burada.)
 * Kural (FEAD skill'i, kural 31) "HER FEAD penceresi" diyordu ama onu tutan
 * bir kapı YOKTU: turun ilk yarısı kapandığında üç
 * pencere (modül kartı · Dönüş Yönü · Sihirbaz) hâlâ eski düz paneldeydi ve
 * hiçbir test kırmızıya dönmedi.
 *
 * Kapı bir LİSTE değil bir KURAL: tipler `componentDefs`ten, her tipin
 * penceresini kuran işlev `cp-core.js`'in panel dağıtımından OKUNUR. Yeni bir
 * FEAD tipi gelir de penceresi ailenin dışında kalırsa bu dosya onu ADIYLA
 * söyler; elle tutulan bir tip listesi onu sessizce atlardı.
 *
 * Pencereler GERÇEK bir modelle çizilir (AG00976): Kayış Tablosu ve Kayış Yolu
 * boş modelde bilerek ailenin dışında bir "önce kasnak ekleyin" yüzeyi basıyor
 * — boş modelle ölçmek o iki pencereyi yanlış sebepten düşürürdü.
 */
const fs = require('fs');
const path = require('path');
const wiz = require('../../js/cp-fead-wizard.js');
const fead = require('../../js/cp-fead.js');
const rapor = require('../../js/cp-fead-report.js');
const M = require('../../js/fead-model.js');
const F = require('../../js/fead-core.js');

const stubs = stubGlobals();
document.body.innerHTML = '<div id="ve-canvas"></div>';
global.nodes = [];
global.connections = [];
eval(loadSource('components.js'));
// components.js'in bildirimleri bu dosyanın kapsamında kalır; require ile
// yüklenen modüller onları GLOBAL'de arıyor.
global.veIsCanvasHidden = veIsCanvasHidden;
global.componentDefs = componentDefs;
global.VE_MODULES = VE_MODULES;
// Aksesuar panelinin katalog kartı bunları okuyor.
eval(loadSource('cp-accessories.js'));
global.VE_ALTERNATOR_PRESETS = VE_ALTERNATOR_PRESETS;
global.VE_AC_PRESETS = VE_AC_PRESETS;
global.VE_AIRCOMP_PRESETS = VE_AIRCOMP_PRESETS;
global.veAccInterpCurve = veAccInterpCurve;
[require('../../js/fead-duty.js'), require('../../js/fead-belts.js'),
 require('../../js/fead-tensioners.js'), require('../../js/fead-accessories.js'),
 require('../../js/fead-engines.js')].forEach((lib) => {
  Object.keys(lib).forEach((k) => { global[k] = lib[k]; });
});
global.FEADCore = F;
Object.keys(M).forEach((k) => { global[k] = M[k]; });
// Uygunluk kapıları: sağ sütun onları soruyor. Yüklenmezse sütun kapıları
// SESSİZCE atlar ve kabuk yine kurulur — kapı yanlış sebepten geçerdi.
const K = require('../../js/fead-checks.js');
Object.keys(K).forEach((k) => { global[k] = K[k]; });
Object.keys(fead).forEach((k) => { if (global[k] === undefined) global[k] = fead[k]; });
Object.keys(rapor).forEach((k) => { if (global[k] === undefined) global[k] = rapor[k]; });
Object.keys(wiz).forEach((k) => { if (global[k] === undefined) global[k] = wiz[k]; });

beforeEach(() => {
  resetStubs(stubs);
  global.nodes = [];
  global.connections = [];
  global.veFeadResults = null;
});

// Örnek modeli tuvale kur — fead-spin.test.js'teki kurucunun aynısı.
function kur(key) {
  const pack = M.veFeadExampleNodes(key);
  global.nodes = pack.nodes.map((n) => {
    const d = componentDefs[n.type] || {};
    return { id: n.id, type: n.type, customName: n.customName || null, def: d,
             x: 0, y: 0, width: d.defaultWidth || 65, height: d.defaultHeight || 60,
             data: JSON.parse(JSON.stringify(n.data || {})) };
  });
  return global.nodes;
}

// cp-core.js'in panel dağıtımından tip → kurucu eşlemesi. Kaynaktan okunur:
// dağıtıma eklenen her FEAD tipi kendiliğinden bu kapıya girer.
const CORE = fs.readFileSync(path.join(__dirname, '../../js/cp-core.js'), 'utf8');
function dagitim() {
  const harita = {};
  const re = /else if\(([^{]*?)\)\s*\{\s*(?:\/\/[^\n]*\n\s*)*html \+= (\w+)\(node\);/g;
  let m;
  while ((m = re.exec(CORE))) {
    (m[1].match(/'fead-[a-z-]+'/g) || []).forEach((t) => { harita[t.slice(1, -1)] = m[2]; });
  }
  return harita;
}
const TIPLER = Object.keys(componentDefs).filter((t) => /^fead-/.test(t));
const KURUCU = dagitim();

describe('HER FEAD PENCERESİ KRANK KASNAĞI AİLESİNDE', () => {
  test('dağıtım her FEAD tipini bir kurucuya bağlıyor — ve kurucu erişilebilir', () => {
    // BOŞA ÇALIŞMIYOR: düzenli ifade dağıtımı okuyamazsa harita boş kalır ve
    // aşağıdaki halka hiçbir pencere ölçmeden geçerdi.
    expect(TIPLER.length).toBeGreaterThanOrEqual(15);
    expect(TIPLER.filter((t) => !KURUCU[t])).toEqual([]);
    expect(TIPLER.filter((t) => typeof global[KURUCU[t]] !== 'function')
      .map((t) => t + ' → ' + KURUCU[t])).toEqual([]);
  });

  // Tipin penceresini GERÇEK modelle çizer. Modül kartı KÖK tuvalde durur;
  // alt topolojisi bu modelin kendisi. Örnekte olmayan tip (su pompası,
  // dönüş yönü, …) MODELE EKLENMEZ — eklenseydi ölçülen model her tipte
  // başka olurdu.
  function pencere(t) {
    let n = global.nodes.find((x) => x.type === t);
    if (!n && t === 'fead-analysis') {
      n = { id: 'mod-1', type: t, def: componentDefs[t],
            data: { subTopology: { nodes: JSON.parse(JSON.stringify(global.nodes)) } } };
    }
    if (!n) n = { id: 'yeni-' + t, type: t, def: componentDefs[t], data: {} };
    const d = document.createElement('div');
    d.innerHTML = global[KURUCU[t]](n);
    return d;
  }

  test('her tipin penceresi kabuğu kuruyor: ≥2 kategori · sağ sütun', () => {
    kur('AG00976_GATES_2025');
    const disarida = [];
    TIPLER.forEach((t) => {
      const d = pencere(t);
      const eksik = [];
      if (d.querySelectorAll('.ve-fp-tabs .ve-fp-tab').length < 2) eksik.push('kategori sekmeleri');
      if (!d.querySelector('.ve-fp-split > .ve-fp-side')) eksik.push('sağ sütun');
      if (eksik.length) disarida.push(t + ' (' + KURUCU[t] + '): ' + eksik.join(', '));
    });
    expect(disarida).toEqual([]);
  });

  // KULLANICI KARARI (2026-09-23): "tepede böyle özet bir açıklamaya gerek
  // yok". Şerit çap · konum · rol · temas · sıra çiplerini sekmelerin ÜSTÜNDE
  // yazıyordu; beşinin de yeri pencerenin kendisinde. Kapı geri dönüşe karşı:
  // hiçbir FEAD penceresi sekmelerden önce bir şerit basmaz — pencerenin ilk
  // çocuğu bölünmüş gövdenin kendisi.
  test('ÖZET ŞERİDİ YOK — pencere doğrudan sekmelerle başlıyor', () => {
    kur('AG00976_GATES_2025');
    const serit = [];
    TIPLER.forEach((t) => {
      const kabuk = pencere(t).querySelector('.ve-fp');
      if (!kabuk) return;                         // kabuğu yoksa üstteki halka söyler
      const ilk = kabuk.firstElementChild;
      if (!ilk || !ilk.classList.contains('ve-fp-split')) {
        serit.push(t + ': ' + (ilk ? ilk.className : 'boş'));
      }
    });
    expect(serit).toEqual([]);
  });

  // KÜÇÜK RESİM YALNIZ KASNAK PENCERESİNDE (kullanıcı, 2026-09-23: "gerekli
  // gereksiz her yere 'Kayış Yolundaki Yeri' eklemişsin — Sonuç'ta buna ne
  // ihtiyaç var?"). Bölümün sorusu "BU kasnak nerede"; kasnağı olmayan
  // pencerede vurgulanacak yer yok. KURAL, liste değil: beklenen tipten okunur
  // (`isFeadPulley` — gergi de bir kasnak), yeni bir tip kendiliğinden girer.
  test('"Kayış Yolundaki Yeri" YALNIZ kasnak penceresinde — kural tipten', () => {
    kur('AG00976_GATES_2025');
    const yanlis = [];
    let kasnakli = 0;
    TIPLER.forEach((t) => {
      const beklenen = !!componentDefs[t].isFeadPulley;
      const d = pencere(t);
      const var_ = !!d.querySelector('.ve-fp-side .ve-fp-thumb');
      const baslik = [...d.querySelectorAll('.ve-fp-sect b')]
        .some((b) => /Kayış Yolundaki Yeri/.test(b.textContent));
      if (beklenen) kasnakli++;
      if (var_ !== beklenen || baslik !== beklenen) {
        yanlis.push(t + ': ' + (beklenen ? 'olmalı, yok' : 'olmamalı, var'));
      }
    });
    // BOŞA ÇALIŞMIYOR: kasnak tipleri gerçekten ölçülüyor (9 tip).
    expect(kasnakli).toBeGreaterThanOrEqual(9);
    expect(yanlis).toEqual([]);
  });

  test('pencerenin EYLEMİ sağ sütunda ve tek — sekme değişince kaybolmasın', () => {
    kur('AG00976_GATES_2025');
    // Eylemi olan pencereler: düğmesi kategori sekmesine gömülseydi öteki
    // sekmedeyken görünmezdi (çözücüdeki Hesapla'nın gerekçesi).
    const eylemli = ['fead-analysis', 'fead-solver', 'fead-report', 'fead-spin', 'fead-wizard'];
    const sorun = [];
    eylemli.forEach((t) => {
      let n = global.nodes.find((x) => x.type === t)
        || { id: 'yeni-' + t, type: t, def: componentDefs[t], data: {} };
      if (t === 'fead-analysis') {
        n = { id: 'mod-1', type: t, data: { subTopology: { nodes: JSON.parse(JSON.stringify(global.nodes)) } } };
      }
      const d = document.createElement('div');
      d.innerHTML = global[KURUCU[t]](n);
      const hepsi = d.querySelectorAll('.ve-fp-solve');
      const sutunda = d.querySelectorAll('.ve-fp-side > .ve-fp-solve');
      if (hepsi.length !== 1 || sutunda.length !== 1) sorun.push(t + ': ' + hepsi.length + ' eylem, sütunda ' + sutunda.length);
    });
    expect(sorun).toEqual([]);
  });
});
