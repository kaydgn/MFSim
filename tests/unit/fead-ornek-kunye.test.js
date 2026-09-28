/**
 * fead-ornek-kunye.test.js — ÖRNEK SEÇİLİNCE KATALOG BAĞLARI DA GELİR
 *
 * Kullanıcı isteği (2026-09-28): *"Örnek seçtiğim zaman gelebilenlerin
 * otomatik gelmesini istiyorum."* — Gates raporunun söylediği bileşen
 * kimliklerinin (gergi künyesi · parça kodu · aksesuar modeli) örnekle
 * birlikte gelmesi.
 *
 * ÖLÇÜLDÜ (düzeltmeden önce): on iki örneğin ON İKİSİ de gergi künyesi
 * (`tenLib`) ve parça kodu (`tenPart`) taşımıyordu. Sayılar künyenin
 * sayılarıydı ama BAĞ yoktu, dolayısıyla:
 *   · sihirbazın "Gergi tipi" seçicisi "— elle gir —" gösteriyor, alanlar
 *     kilitsiz açılıyordu (künye seçilmemiş bir gergi gibi);
 *   · pim satırı on iki örneğin on ikisinde "Gergi parça kodu yok" diyordu —
 *     oysa E9843'ün pim çizimi kütüphanede duruyor ve yedi örnek o parçayı
 *     kullanıyor.
 *
 * BAĞ BİR SEÇİM DEĞİL, SAYILARIN SONUCU: her örnek için on dört künyeden
 * TAM OLARAK BİRİ sıfır sapma veriyor (parça + montaj) ve o, örneğin kendi
 * raporunun künyesi. Kapı bunu ayrı bir eşleme tablosu tutmadan ölçüyor —
 * tablo ikinci bir kaynak olur ve sessizce eskirdi.
 */
const M = require('../../js/fead-model.js');
const F = require('../../js/fead-core.js');
const T = require('../../js/fead-tensioners.js');

const stubs = stubGlobals();
document.body.innerHTML = '<div id="ve-canvas"></div>';
global.nodes = [];
global.connections = [];
eval(loadSource('components.js'));
global.componentDefs = componentDefs;
global.VE_MODULES = VE_MODULES;
global.veIsCanvasHidden = veIsCanvasHidden;
eval(loadSource('cp-accessories.js'));
global.VE_ALTERNATOR_PRESETS = VE_ALTERNATOR_PRESETS;
global.VE_AC_PRESETS = VE_AC_PRESETS;
global.VE_AIRCOMP_PRESETS = VE_AIRCOMP_PRESETS;
global.veAccInterpCurve = veAccInterpCurve;
[require('../../js/fead-duty.js'), require('../../js/fead-belts.js'), T,
 require('../../js/fead-accessories.js'), require('../../js/fead-engines.js')]
  .forEach((mod) => Object.keys(mod).forEach((k) => { global[k] = mod[k]; }));
global.FEADCore = F;
Object.keys(M).forEach((k) => { global[k] = M[k]; });
const fead = require('../../js/cp-fead.js');
Object.keys(fead).forEach((k) => { if (global[k] === undefined) global[k] = fead[k]; });
const wiz = require('../../js/cp-fead-wizard.js');
Object.keys(wiz).forEach((k) => { global[k] = wiz[k]; });

beforeEach(() => { resetStubs(stubs); global.nodes = []; global.connections = []; });

const ORNEK = Object.keys(M.VE_FEAD_EXAMPLES);
const GATES = ORNEK.filter((k) => /_GATES_/.test(k));
const tenOf = (key) => M.VE_FEAD_EXAMPLES[key].pulleys
  .find((p) => p.type === 'fead-tensioner').data;

// Sıfır sapma: parça (kol · ön yük · katsayı · çap · atalet · stop · temas)
// VE montaj (çalışma momenti) aynı. `veFeadTensionerDrift` panelin kullandığı
// fonksiyonun kendisi — ikinci bir karşılaştırma yazılmıyor.
const sifirSapma = (td) => T.VE_FEAD_TENSIONER_DB.filter((rec) => {
  const d = T.veFeadTensionerDrift(Object.assign({}, td, { tenLib: rec.key }));
  return d && d.drift.length === 0 && d.montaj.length === 0;
});

describe('gergi künyesi SAYILARDAN belirli — tek aday', () => {
  test('süpürme gerçekten on iki örneğe bakıyor', () => {
    expect(ORNEK.length).toBe(12);
    expect(GATES.length).toBe(11);
  });

  test.each(ORNEK)('%s — on dört künyeden TAM OLARAK BİRİ sıfır sapma veriyor', (key) => {
    // İki aday çıksaydı bağ bir SEÇİM olurdu ve örneğe yazmak doğrulanamayan
    // bir iddia olurdu; hiç aday çıkmasaydı örneğin sayıları kütüphaneden
    // ayrışmış demekti (ikisi de sessiz).
    expect(sifirSapma(tenOf(key)).length).toBe(1);
  });
});

describe('Gates örnekleri künyeyi TAŞIYOR', () => {
  test.each(GATES)('%s — tenLib · sürüm · parça kodu', (key) => {
    const td = tenOf(key);
    const rec = sifirSapma(td)[0];
    expect(td.tenLib).toBe(rec.key);
    // Sürüm İZDİR: kütüphane değişirse bu kapı kırmızıya döner ve örneğin
    // sayılarının yeni sürüme karşı yeniden ölçülmesini İSTER.
    expect(td.tenLibVer).toBe(T.VE_FEAD_TEN_LIB_VERSION);
    // Kod künyeninkiyle aynı; künyede yoksa örnekte de yok (uydurulmaz).
    expect(td.tenPart).toBe(rec.part);
    // Rapor numarası aynı rapor: AG00902_1275_… ↔ AG00902-1275.
    expect(key.split('_')[0]).toBe(rec.key.split('-')[0]);
  });

  test('BMC tedarikçi sayfası künye TAŞIMIYOR — kaynağı rapor değil', () => {
    // Sayıları AG00976-1715 künyesiyle birebir (aynı araç, giden sayfa ↔ dönen
    // rapor), ama sayfa künyenin kaynağı DEĞİL ve parça kodunu kendisi
    // yazmıyor. Kullanıcı listesinde de yok (`hidden`).
    expect(M.VE_FEAD_EXAMPLES.BMC_FEAD_2026.hidden).toBe(true);
    expect(tenOf('BMC_FEAD_2026').tenLib).toBeUndefined();
    expect(tenOf('BMC_FEAD_2026').tenPart).toBeUndefined();
  });
});

// ── UÇTAN UCA: örnek kurulunca pim satırı DOLU ──────────────────────────────
// Kodu taşımak yetmez; kurulan modelin pim planına ULAŞMASI gerekir. Pim
// künyesi yalnız çizimi elde olan parçada var (E9843) — öteki kodlarda sebep
// "parça kodu yok" DEĞİL "parça çizimi yok" olmalı: kod gelmiş, sayı
// uydurulmamış.
describe('örnek kurulunca pim planı', () => {
  const kur = (key) => {
    const pack = M.veFeadExampleNodes(key);
    pack.nodes.forEach((n) => { n.def = componentDefs[n.type]; });
    return M.veFeadBuildSystem(pack.nodes);
  };

  test.each(GATES)('%s — pim satırı parça koduyla', (key) => {
    const b = kur(key);
    expect(b.ok).toBe(true);
    expect(b.pin).toBeTruthy();
    expect(String(b.pin.reason || '')).not.toMatch(/parça kodu yok/i);
    if (tenOf(key).tenPart === 'E9843') {
      expect(b.pin.ok).toBe(true);
      expect(b.pin.part).toBe('E9843');
      expect(Number.isFinite(b.pin.angleDeg)).toBe(true);
    } else {
      expect(b.pin.ok).toBe(false);
      expect(b.pin.reason).toMatch(/parça çizimi yok/i);
    }
  });

  test('E9843 kullanan YEDİ örneğin yedisinde pim çözülüyor', () => {
    const cozulen = GATES.filter((k) => kur(k).pin.ok);
    expect(cozulen.sort()).toEqual([
      'AG00894_GATES_2023', 'AG00902_1275_GATES_2023', 'AG00902_1300_GATES_2023',
      'AG00976_GATES_2025',
      'AG0868_4PK_GATES_2022', 'AG0868_6PK_GATES_2022', 'AG0868_8PK_GATES_2022'].sort());
  });
});

// ── SİHİRBAZ YOLU: "Örnekten doldur" künyeyi SEÇİLİ getiriyor ──────────────
// Kullanıcının örneği seçtiği yüzey sihirbazın 1. adımı. Tohum gerginin
// verisini topluca kopyalıyor; kapı bağın durumdan düğüme, düğümden pime
// ulaştığını ve 3. adımdaki seçicinin künyeyi SEÇİLİ bastığını ölçüyor.
describe('sihirbaz: örnekten doldur → künye seçili gelir', () => {
  const kabuk = () => {
    document.body.innerHTML = '<div id="ve-canvas"></div>'
      + '<div id="ve-feadwiz-overlay" style="display:none;">'
      + '<div id="ve-fw-nav"></div><div id="ve-fw-body"></div><div id="ve-fw-foot"></div></div>'
      + '<div id="ve-fw-ang" style="display:none;"></div>';
  };

  test.each(M.veFeadExampleKeys())('%s — seçici künyeyi gösteriyor, alanlar kilitli', (key) => {
    kabuk();
    expect(wiz.veFeadWizSeed(key)).toBe(true);
    const st = wiz.veFeadWizState();
    const td = tenOf(key);
    expect(st.ten.tenLib).toBe(td.tenLib);
    expect(st.ten.tenPart).toBe(td.tenPart);

    const node = wiz.veFeadWizNodes(st).nodes.find((n) => n.type === 'fead-tensioner');
    expect(node.data.tenLib).toBe(td.tenLib);
    expect(node.data.tenPart).toBe(td.tenPart);

    const b = wiz.veFeadWizBuild();
    const h = wiz.veFeadWizStepHTML(2, b);
    const rec = T.veFeadTensionerOf(td.tenLib);
    // Seçili seçenek künyenin KENDİ etiketi (tek üretici: veFeadTenLabel).
    const secili = /<option value="([^"]*)" selected>/.exec(h);
    expect(secili && secili[1]).toBe(rec.key);
    expect(h).toContain(T.veFeadTenLabel(rec).replace(/&/g, '&amp;'));
    // Künye seçiliyken parçanın alanları kilitli (readonly — disabled değil).
    // Kilit ALANIN kendisinde ölçülüyor: sayfada başka bir readonly okuma
    // bulunabilir ve "sayfada readonly var" kilidi kanıtlamaz.
    const kol = /<input[^>]*oninput="_fwSet\('ten\.armLen'[^>]*>/.exec(h);
    expect(kol && kol[0]).toMatch(/\breadonly\b/);
    expect(kol && kol[0]).toContain('ve-fw-lock');
  });
});
