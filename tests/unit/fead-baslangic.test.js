/**
 * fead-baslangic.test.js — FEAD BAŞLANGIÇ SAYFASI (js/cp-fead-baslangic.js)
 *
 * Kullanıcı kararı (2026-09-29, tasarım tuvali "İlk açılış" · B): *"İlk
 * açılış B başlangıç sayfası olacak."* İsteğin kendisi: *"FEAD modülünü açınca
 * sihirbaz anında karşımızda beliriyor. Bunun böyle olmasını istemiyorum."*
 *
 * Kapıların sorduğu şey:
 *   · sayfa MODELDEN mi türüyor (bayrak yok): kasnak yok VE kart yok → sayfa;
 *   · kapılar modülün KENDİ çağrılarına mı gidiyor (sayfa düğüm kurmaz);
 *   · rapor listesi sihirbazın listesinin KENDİSİ mi (ikinci liste yok);
 *   · küçük resimler çiziciden mi (hiçbiri "çizilemedi" değil);
 *   · FEAD araçları penceresi sayfa açıkken gizli mi, kapsam dışında ikisi de
 *     gizli mi.
 * Gerçek tarayıcı (sayfanın görünmesi, tekerlek, dönüş düğmesinin üstte
 * kalması, kurulum → çekilme → Ctrl+Z → geri gelme) tests/e2e/fead-baslangic.spec.js.
 */
const stubs = stubGlobals();
document.body.innerHTML = '<div id="ve-canvas-wrapper"><div id="ve-canvas"></div></div>';
global.nodes = [];
global.connections = [];
eval(loadSource('components.js'));
global.veIsCanvasHidden = veIsCanvasHidden;
global.componentDefs = componentDefs;
eval(loadSource('fead-belts.js'));
const F = require('../../js/fead-core.js');
const M = require('../../js/fead-model.js');
global.FEADCore = F;
Object.keys(M).forEach((k) => { global[k] = M[k]; });
const fead = require('../../js/cp-fead.js');
Object.keys(fead).forEach((k) => { if (global[k] === undefined) global[k] = fead[k]; });
global.veFeadSignals = require('../../js/fead-signals.js');
const RS = require('../../js/cp-fead-results.js');
Object.keys(RS).forEach((k) => { if (global[k] === undefined) global[k] = RS[k]; });
const RP = require('../../js/cp-fead-report.js');
Object.keys(RP).forEach((k) => { if (global[k] === undefined) global[k] = RP[k]; });
const WIZ = require('../../js/cp-fead-wizard.js');
global.VE_FW_STEPS = WIZ.VE_FW_STEPS;
const AR = require('../../js/cp-fead-araclar.js');
const BS = require('../../js/cp-fead-baslangic.js');
Object.keys(BS).forEach((k) => { global[k] = BS[k]; });

beforeEach(() => {
  resetStubs(stubs);
  global.nodes = [];
  global.connections = [];
  global.veFeadResults = null;
  try { localStorage.clear(); } catch (e) { /* jsdom */ }
  AR._feadAracSifirla();
  document.body.innerHTML = '<div id="ve-canvas-wrapper"><div id="ve-canvas"></div></div>';
});

const dugum = (type, data) => {
  const d = componentDefs[type] || {};
  return { id: type + '-' + Math.random().toString(36).slice(2, 7), type, def: d,
           x: 0, y: 0, width: d.defaultWidth || 65, height: d.defaultHeight || 60, data: data || {} };
};
const araclar = () => ['fead-belt', 'fead-solver', 'fead-report', 'fead-wizard'].map((t) => dugum(t));
// Çıplak adla çağrılan global'i bir casusla değiştir, sonra geri koy.
function casus(ad, fn) {
  const eski = global[ad];
  const c = jest.fn(fn || (() => true));
  global[ad] = c;
  return { c, geri: () => { global[ad] = eski; } };
}

describe('GÖRÜNÜRLÜK MODELDEN TÜRER — bayrak yok', () => {
  test('boş ve yalnız araçlı topolojide sayfa gerekir', () => {
    expect(BS.veFeadBaslangicGerekli([])).toBe(true);
    expect(BS.veFeadBaslangicGerekli(araclar())).toBe(true);
  });

  test('bir kasnak (gergi de bir kasnak) ya da bir Kayış Yolu kartı sayfayı kaldırır', () => {
    expect(BS.veFeadBaslangicGerekli(araclar().concat([dugum('fead-alternator')]))).toBe(false);
    expect(BS.veFeadBaslangicGerekli(araclar().concat([dugum('fead-tensioner')]))).toBe(false);
    // "Boş çizim masası" kapısının kurduğu şey: kasnaksız bir kart. Kullanıcı
    // bir yol seçti — sayfa geri gelmemeli.
    expect(BS.veFeadBaslangicGerekli(araclar().concat([dugum('fead-layout')]))).toBe(false);
  });

  test('liste verilmezse CANLI modeli okur', () => {
    global.nodes = araclar();
    expect(BS.veFeadBaslangicGerekli()).toBe(true);
    global.nodes.push(dugum('fead-crank'));
    expect(BS.veFeadBaslangicGerekli()).toBe(false);
  });
});

describe('RAPORLAR SİHİRBAZIN LİSTESİNİN KENDİSİ', () => {
  test('aynı anahtarlar, gizli kayıt yok, yeni rapor önce', () => {
    const r = BS.veFeadBaslangicRaporlar();
    expect(r.map((x) => x.key).sort()).toEqual(M.veFeadExampleKeys().slice().sort());
    // Gizli kayıt (BMC tedarikçi sayfası, kullanıcı kararıyla listeden çıktı)
    // sayfada da yok.
    const gizli = M.veFeadExampleKeysAll().filter((k) => M.veFeadExampleOf(k).hidden);
    expect(gizli.length).toBeGreaterThan(0);
    gizli.forEach((k) => expect(r.map((x) => x.key)).not.toContain(k));
    for (let i = 1; i < r.length; i++) expect(r[i - 1].yil >= r[i].yil).toBe(true);
  });

  test('künye örneğin KENDİ kaydından: kod · yıl · kasnak · kayış', () => {
    BS.veFeadBaslangicRaporlar().forEach((x) => {
      const ex = M.veFeadExampleOf(x.key);
      expect(x.kod).toMatch(/^AG\d+$/);
      expect(x.yil).toMatch(/^20\d\d$/);
      expect(x.kasnak).toBe(ex.pulleys.length);
      expect(x.kayis).toBe(ex.belt.beltType);
      expect(ex.name).toContain(x.kod);
    });
  });
});

describe('KÜÇÜK RESİM ÇİZİCİDEN — sunum kendi geometrisini hesaplamaz', () => {
  test('her raporun kayış yolu çiziliyor (hiçbiri "çizilemedi" değil)', () => {
    BS._feadBasSifirla();
    const eksik = [];
    BS.veFeadBaslangicRaporlar().forEach((x) => {
      const svg = BS.veFeadBaslangicResim(x.key);
      if (!/data-ve="belt"/.test(svg)) eksik.push(x.key);
    });
    expect(eksik).toEqual([]);
  });

  test('çizici veFeadLayoutSVG — kopya bir çizim yolu yok', () => {
    BS._feadBasSifirla();
    const c = casus('veFeadLayoutSVG', (b, W, H, o) => '<svg data-casus="' + W + 'x' + H + '"></svg>');
    try {
      const key = M.veFeadExampleKeys()[0];
      expect(BS.veFeadBaslangicResim(key)).toContain('data-casus');
      expect(c.c).toHaveBeenCalledTimes(1);
      // Önbellek: ikinci çağrı çizmez.
      BS.veFeadBaslangicResim(key);
      expect(c.c).toHaveBeenCalledTimes(1);
      // Ad, sarım açısı, gül ve pivot kapalı — 240 px'lik karede okunmuyorlar.
      const o = c.c.mock.calls[0][3];
      expect(o).toMatchObject({ nameLabels: false, wrapLabels: false, compass: false, pivot: false });
    } finally { c.geri(); BS._feadBasSifirla(); }
  });
});

describe('SAYFANIN HTML\'İ', () => {
  const kur = () => { const d = document.createElement('div'); d.innerHTML = BS.veFeadBaslangicHTML(); return d; };

  test('üç kapı ve rapor başına bir karo', () => {
    const d = kur();
    expect([...d.querySelectorAll('.ve-fead-bas-kapi')].map((b) => b.getAttribute('data-ey')))
      .toEqual(['sihirbaz', 'step', 'bos']);
    expect(d.querySelector('.ve-fead-bas-kapi.birincil').getAttribute('data-ey')).toBe('sihirbaz');
    const karo = [...d.querySelectorAll('.ve-fead-bas-karo')];
    expect(karo.map((b) => b.getAttribute('data-v')).sort()).toEqual(M.veFeadExampleKeys().slice().sort());
    karo.forEach((b) => expect(b.getAttribute('data-ey')).toBe('rapor'));
  });

  test('sihirbazın adımları RAYIN KENDİ ADLARIYLA — elle yazılmış sayı yok', () => {
    const t = kur().textContent;
    WIZ.VE_FW_STEPS.slice(1).forEach((s) => expect(t).toContain(s.ad));
    // Ölçülen bayat metin sınıfı ("7. adımdaki iki kapı", adım sayısı 6):
    // sayfa adım numarası ya da adım SAYISI yazmıyor.
    expect(t).not.toMatch(/\d+\s*adım/);
  });

  test('ikon ailesi tek: kapılar çizgi ikon taşır, sembol karakteri değil', () => {
    const d = kur();
    d.querySelectorAll('.ve-fead-bas-kapi-ik').forEach((ik) => {
      expect(ik.querySelector('.mf-ico')).not.toBeNull();
    });
  });
});

describe('KAPILAR MODÜLÜN VAR OLAN ÇAĞRILARINA GİDER', () => {
  test('Sihirbazla kur → veFeadWizOpenAny', () => {
    const c = casus('veFeadWizOpenAny');
    try { expect(BS.veFeadBaslangicEylem('sihirbaz')).toBe(true); expect(c.c).toHaveBeenCalledTimes(1); }
    finally { c.geri(); }
  });

  test('STEP\'ten başla → sihirbaz + 1. adımın dosya seçicisi AYNI tıklamada', () => {
    const tik = jest.fn();
    const c = casus('veFeadWizOpenAny', () => {
      // Sihirbaz 1. adımda açılır ve STEP kartının dosya girişi gövdede durur.
      document.body.insertAdjacentHTML('beforeend',
        '<div id="ve-fw-body"><input type="file" class="ve-fw-stp-file"></div>');
      document.querySelector('.ve-fw-stp-file').click = tik;
      return true;
    });
    try {
      expect(BS.veFeadBaslangicEylem('step')).toBe(true);
      expect(c.c).toHaveBeenCalledTimes(1);
      expect(tik).toHaveBeenCalledTimes(1);
    } finally { c.geri(); }
  });

  test('Boş çizim masası → veFeadKanvasEkle({ bos: true })', () => {
    const c = casus('veFeadKanvasEkle', () => ({ id: 'k' }));
    try {
      expect(BS.veFeadBaslangicEylem('bos')).toBe(true);
      expect(c.c).toHaveBeenCalledWith({ bos: true });
    } finally { c.geri(); }
  });

  test('rapor karosu → veFeadLoadExample(anahtar)', () => {
    const c = casus('veFeadLoadExample', () => [{ id: 'x' }]);
    try {
      const key = M.veFeadExampleKeys()[2];
      expect(BS.veFeadBaslangicEylem('rapor', key)).toBe(true);
      expect(c.c).toHaveBeenCalledWith(key);
      expect(BS.veFeadBaslangicEylem('rapor', '')).toBe(false);
    } finally { c.geri(); }
  });

  test('tıklama kapının data-ey\'inden eyleme gider (tek dinleyici)', () => {
    global.nodes = araclar();
    const c = casus('veFeadWizOpenAny');
    try {
      AR.veFeadAraclarKapsam('fead-analysis');
      document.querySelector('#ve-fead-baslangic .ve-fead-bas-kapi[data-ey="sihirbaz"]').click();
      expect(c.c).toHaveBeenCalledTimes(1);
    } finally { c.geri(); }
  });
});

describe('FEAD ARAÇLARI PENCERESİYLE BİRLİKTE — sayfa açıkken pencere gizli', () => {
  const bas = () => document.getElementById('ve-fead-baslangic');
  const arac = () => document.getElementById('ve-fead-araclar');

  test('boş topolojide sayfa AÇIK, pencere GİZLİ', () => {
    global.nodes = araclar();
    AR.veFeadAraclarKapsam('fead-analysis');
    expect(bas()).not.toBeNull();
    expect(bas().hidden).toBe(false);
    expect(arac().hidden).toBe(true);
  });

  test('model kurulunca (kasnak) tazeleme sayfayı kapatır, pencereyi açar — ve geri', () => {
    global.nodes = araclar();
    AR.veFeadAraclarKapsam('fead-analysis');
    global.nodes.push(dugum('fead-crank'));
    AR.veFeadAraclarTazele();
    expect(bas().hidden).toBe(true);
    expect(arac().hidden).toBe(false);
    // Geri-al kasnağı sökerse (restoreState → veFeadRefreshLayoutCards →
    // veFeadAraclarTazele) sayfa geri gelir.
    global.nodes = global.nodes.filter((n) => n.type !== 'fead-crank');
    AR.veFeadAraclarTazele();
    expect(bas().hidden).toBe(false);
    expect(arac().hidden).toBe(true);
  });

  test('kapsam dışında ikisi de gizli; ana topolojide sayfa hiç KURULMAZ', () => {
    global.nodes = [];
    AR.veFeadAraclarKapsam('top');
    expect(bas()).toBeNull();
    global.nodes = araclar();
    AR.veFeadAraclarKapsam('fead-analysis');
    AR.veFeadAraclarKapsam('top');
    expect(bas().hidden).toBe(true);
    expect(arac().hidden).toBe(true);
  });

  test('FEAD\'e girişin kablolaması: tazeleme sayfayı SORAR (tek soru yeri)', () => {
    // Kaynak kapısı: pencerenin kapsamı ve tazelemesi sayfanın görünürlüğünü
    // aynı yardımcıdan soruyor. Biri atlanırsa sayfa bir düzenleme geride kalır
    // (örnek yüklenir, sayfa hâlâ örter) — sessiz değil ama tuvali kapatır.
    const src = require('fs').readFileSync(require('path').join(__dirname, '../../js/cp-fead-araclar.js'), 'utf8');
    const govde = (ad) => src.slice(src.indexOf('function ' + ad + '('), src.indexOf('\n}\n', src.indexOf('function ' + ad + '(')));
    expect(govde('veFeadAraclarTazele')).toContain('_feadAracBaslangic()');
    expect(govde('veFeadAraclarKapsam')).toContain('_feadAracBaslangic()');
  });
});

describe('TUVALE OLAY SIZDIRMAZ', () => {
  test('fare ve tekerlek sayfada kalır', () => {
    global.nodes = araclar();
    AR.veFeadAraclarKapsam('fead-analysis');
    const kap = document.getElementById('ve-canvas-wrapper');
    const gelen = [];
    ['mousedown', 'wheel', 'dblclick', 'contextmenu'].forEach((t) => kap.addEventListener(t, () => gelen.push(t)));
    const el = document.getElementById('ve-fead-baslangic');
    ['mousedown', 'wheel', 'dblclick', 'contextmenu'].forEach((t) => {
      el.dispatchEvent(new Event(t, { bubbles: true }));
    });
    expect(gelen).toEqual([]);
  });
});
