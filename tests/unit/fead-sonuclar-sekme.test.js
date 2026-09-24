/**
 * fead-sonuclar-sekme.test.js — FEAD'in Sonuçlar panosuna KABLOLANMASI
 *
 * FEAD, Sonuçlar panosuna veri yayınlayan İKİNCİ modül. Takoz'un dalları üç
 * ortak dosyaya (results.js · trace-view.js · graphics.js) 42 satır hâlinde
 * dağılmıştı; kopyalamak yerine KAYNAK TABLOSUNA (veResultSources) çevrildi.
 * Bu dosya o tablonun FEAD için de Takoz'daki kuralları taşıdığını kilitler:
 *
 *   • sekme FEAD'in KENDİ çözümüyle açılır (araç çözümüne bakmaz)
 *   • kanal kimliği TAM anahtar listesiyle eşleşir (bileşen tipi '~fead-crank'
 *     yakalanmaz)
 *   • X ekseni kümeden gelir, farklı eksendeki bırakma REDDEDİLİR
 *   • KUSUR 4: "Sonuçları Temizle" FEAD sonucunu da siler (eskiden silmiyordu)
 *   • Takoz aynı tablodan okumaya devam ediyor (iki kaynak birbirini ezmiyor)
 *
 * Kanal SAYILARININ doğruluğu fead-sonuclar.test.js'in işi.
 */
const wiz = require('../../js/cp-fead-wizard.js');
const fead = require('../../js/cp-fead.js');
const rapor = require('../../js/cp-fead-report.js');
const ozet = require('../../js/cp-fead-summary.js');
const M = require('../../js/fead-model.js');
const F = require('../../js/fead-core.js');
const TR = require('../../js/fead-transient.js');
const mcore = require('../../js/mount-core.js');
global.veMountCore = mcore;
global.veMntSignals = require('../../js/mount-signals.js');

const stubs = stubGlobals();
document.body.innerHTML = '<div id="ve-canvas"></div><div id="ve-results-tree"></div>'
  + '<div id="ve-solver-tab-bar"></div><div id="ve-report-overlay"></div>';
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
[require('../../js/fead-duty.js'), require('../../js/fead-belts.js'),
 require('../../js/fead-tensioners.js'), require('../../js/fead-accessories.js'),
 require('../../js/fead-engines.js'), require('../../js/fead-checks.js')].forEach((lib) => {
  Object.keys(lib).forEach((k) => { global[k] = lib[k]; });
});
global.FEADCore = F;
Object.keys(M).forEach((k) => { global[k] = M[k]; });
Object.keys(TR).forEach((k) => { global[k] = TR[k]; });
global.veFeadBrief = require('../../js/fead-brief.js');
global.veFeadSignals = require('../../js/fead-signals.js');
[fead, rapor, ozet, wiz].forEach((mod) => {
  Object.keys(mod).forEach((k) => { if (global[k] === undefined) global[k] = mod[k]; });
});
const RS = require('../../js/cp-fead-results.js');
Object.keys(RS).forEach((k) => { global[k] = RS[k]; });

global.COMPONENT_SIGNALS = {};
global.veTabs = [{ id: 't1', name: 'T1', state: { simResults: null, nodes: [], connections: [] } }];
global.veActiveTabIdx = 0;
global.canvasOffset = { x: 0, y: 0 };
global.canvasZoom = 1;
global.compCounter = 0;
global.veProjectName = 'Test';
global.SENSOR_PACKAGES = [];
// Ağaç GERÇEKTEN çiziliyor (#ve-results-tree var) — sekme durumu kaydedicisi
// toolbar/tabs katmanında, burada etkisiz bir taklit yeter.
global.veSaveActiveTabState = jest.fn();
global.veSaveActiveTabStateKeepView = jest.fn();
eval(loadSource('measure-core.js'));
eval(loadSource('signal-tree.js'));
eval(loadSource('trace-view.js'));
eval(loadSource('results.js'));
eval(loadSource('graphics.js'));
// results.js kendi showToast'ını modül kapsamında bildiriyor (bkz.
// mount-results-tab.test.js) — çıplak isme atanır.
let toasts = [];
showToast = jest.fn((msg, type) => toasts.push({ msg, type }));
// Kaynak tablosu cp-fead-results.js'in kancalarını GLOBAL'de arıyor.
global.veResultSources = veResultSources;
global.veResSets = veResSets;
global.veResSourceOf = veResSourceOf;
global.veResActiveSource = veResActiveSource;
// cp-fead-results.js AYRI modül olarak yüklendi; tarayıcıda global olan pano
// değişkenini ve yardımcıları burada global'e köprülemek gerekiyor. Pano bir
// ALICI/VERİCİ ile köprülenir — results.js onu yeniden atıyor (sekme takası).
Object.defineProperty(global, 'veResultSlots', {
  configurable: true, get: () => veResultSlots, set: (v) => { veResultSlots = v; } });
Object.assign(global, { veTrKey, VE_BOARD, VE_TR, veTrResetView, veSyncBoardState,
  veSigRefreshTree, veRepHeadHTML, veCloseDetailedReport });

function kur(key) {
  const pack = M.veFeadExampleNodes(key || 'AG00976_GATES_2025');
  global.nodes = pack.nodes.map((n) => {
    const d = componentDefs[n.type] || {};
    return { id: n.id, type: n.type, customName: n.customName || null, def: d,
             x: 0, y: 0, width: d.defaultWidth || 65, height: d.defaultHeight || 60,
             data: JSON.parse(JSON.stringify(n.data || {})) };
  });
}
// Çözüm + kullanıcı FEAD sekmesinde (gerçek akış). Sekme 'performance'ta
// kalsaydı ağaç tazelenirken veUpdateSolverTabs panoyu geçerli tek sekmeye
// (fead) DEVREDERDİ ve bırakılan kanal eski sekmenin panosunda kalırdı —
// sekme takasının kendi kuralı, bu dosyanın konusu değil.
function coz(key) {
  kur(key);
  const sv = global.nodes.find((n) => n.type === 'fead-solver');
  const R = fead.veFeadSolve(sv.id);
  global.veFeadResults = window.veFeadResults;
  veActiveSolverTabId = 'fead';
  return R;
}
const ids = (slot) => (slot.sensors || []).map((s) => s.signal);

beforeEach(() => {
  resetStubs(stubs);
  toasts = [];
  showToast.mockClear();
  window.veSimResults = null;
  window.veMountResults = null;
  window.veFeadResults = null;
  global.veFeadResults = null;
  veResultSlots = [{}, {}, {}, {}];
  veSolverTabSlots = {};
  veActiveSolverTabId = 'performance';
});

describe('kaynak tablosu — kimlik TAM anahtarla', () => {
  test('FEAD kümeleri FEAD kaynağına, Takoz kümeleri Takoz kaynağına', () => {
    expect(veResSourceOf('~fead-cevrim').tab).toBe('fead');
    expect(veResSourceOf('~fead-senaryo').tab).toBe('fead');
    expect(veResSourceOf('~mnt-frf').tab).toBe('mount');
  });
  test('bileşen TİPİ kanal sayılmaz (sihirbazın sanal sensörü "~" + tip)', () => {
    expect(veResSourceOf('~fead-crank')).toBeNull();
    expect(veResSourceOf('~fead-solver')).toBeNull();
    expect(veResSourceOf('~mnt-motor')).toBeNull();
  });
});

describe('FEAD sekmesi FEAD\'in KENDİ çözümüyle açılır', () => {
  test('çözüm yokken sekme yok, çözülünce var — araç çözümü gerekmez', () => {
    expect(veGetAvailableSolverTabs().map((t) => t.id)).toEqual([]);
    coz();
    expect(veGetAvailableSolverTabs().map((t) => t.id)).toEqual(['fead']);
  });
  test('başarısız çözüm sekme AÇMAZ', () => {
    window.veFeadResults = { ok: false, error: 'x', signals: [{}] };
    expect(veGetAvailableSolverTabs().map((t) => t.id)).toEqual([]);
  });
  test('veri çözümden okunur: pano X eksenini de normal bir sinyal gibi çözer', () => {
    const R = coz();
    const ds = R.signals.find((d) => d.key === 'cevrim');
    expect(veGetSensorData('~fead-cevrim', 'rpm')).toBe(ds.x.data);
    expect(veGetSensorData('~fead-cevrim', ds.channels[0].id)).toBe(ds.channels[0].data);
    expect(veGetSensorData('~fead-cevrim', 'yok-boyle-kanal')).toBeNull();
  });
});

describe('tek X ekseni kuralı FEAD kümelerinde de geçerli', () => {
  test('boş panoya bırakılan kanal kümenin eksenini getirir', () => {
    const R = coz();
    const ds = R.signals.find((d) => d.key === 'cevrim');
    veAddSignalToSlot(0, '~fead-cevrim', ds.channels[0].id);
    expect(veResultSlots[0].xAxis.id).toBe('~fead-cevrim:rpm');
    expect(ids(veResultSlots[0])).toEqual([ds.channels[0].id]);
  });
  test('farklı eksendeki küme REDDEDİLİR ve sebebi söylenir', () => {
    const R = coz();
    const ds = R.signals.find((d) => d.key === 'cevrim');
    veAddSignalToSlot(0, '~fead-cevrim', ds.channels[0].id);
    veAddSignalToSlot(0, '~fead-campbell', 'ord.1');   // aynı birim (d/dk) ama başka ızgara
    expect(ids(veResultSlots[0])).toEqual([ds.channels[0].id]);
    expect(toasts.some((t) => /Pano X ekseni/.test(t.msg))).toBe(true);
  });
  test('FEAD sekmesinde X seçici YALNIZ kümelerin eksenlerini sunar (zaman yok)', () => {
    coz();
    veActiveSolverTabId = 'fead';
    const opts = veGetAvailableXAxisOptions(0).map((o) => o.id);
    expect(opts).toEqual(['~fead-cevrim:rpm', '~fead-campbell:rpm', '~fead-kol:rel', '~fead-senaryo:t']);
  });
});

describe('KUSUR 4 · "Sonuçları Temizle" FEAD sonucunu da siler', () => {
  // Eskiden veClearAllResults yalnız araç + Takoz sonucunu siliyordu; FEAD
  // çözücü penceresi ve raporu eski çözümü göstermeye devam ediyordu.
  test('temizlemeden sonra FEAD sonucu ve sekmesi yok', () => {
    coz();
    expect(window.veFeadResults).toBeTruthy();
    veClearAllResults();
    expect(window.veFeadResults).toBeNull();
    expect(veGetAvailableSolverTabs().map((t) => t.id)).toEqual([]);
  });
});

describe('pano uzlaştırması kaynak BAŞINA', () => {
  test('FEAD sonucu unutulunca FEAD kanalları düşer ve eksen serbest kalır', () => {
    const R = coz();
    const ds = R.signals.find((d) => d.key === 'kol');
    veAddSignalToSlot(0, '~fead-kol', 'T');
    veAddSignalToSlot(0, '~fead-kol', 'tk');
    expect(veResSyncBoard('fead')).toBe(0);
    window.veFeadResults = null;
    expect(veResSyncBoard('fead')).toBe(2);
    expect(veResultSlots[0].sensors).toEqual([]);
    expect(veResultSlots[0].xAxis).toBeUndefined();
    expect(ds).toBeTruthy();
  });
  test('Takoz uzlaştırması FEAD kanalına DOKUNMAZ (iki kaynak birbirini ezmez)', () => {
    coz();
    veAddSignalToSlot(0, '~fead-kol', 'T');
    expect(veMntSyncBoard()).toBe(0);
    expect(ids(veResultSlots[0])).toEqual(['T']);
  });
});

describe('Sonuçlar sayfası yüzleri', () => {
  test('ağaç: durum satırı, gruplar ve rapor satırları', () => {
    coz();
    veActiveSolverTabId = 'fead';
    veUpdateResultsTree();
    const h = document.getElementById('ve-results-tree').innerHTML;
    expect(h).toContain('FEAD Kayış Tahriki');
    expect(h).toContain('Güncel');
    expect(h).toContain('Çevrim · Açıklık gerginlikleri');
    expect(h).toContain('Campbell · Burulma modları');
    expect(h).toContain('FEAD Sonuç Özeti');
    expect(h).toContain('FEAD Detaylı Rapor (HTML)');
  });
  test('boş pano FEAD sekmesinde başlangıç kartını gösterir', () => {
    coz();
    veActiveSolverTabId = 'fead';
    expect(veTrEmptyHTML()).toContain('ve-fr-start');
    veActiveSolverTabId = 'performance';
    expect(veTrEmptyHTML()).not.toContain('ve-fr-start');
  });
  test('hazır diyagram panoyu tek eksende, şeritleriyle kurar — ve yorum şeridi onu okur', () => {
    const R = coz();
    veActiveSolverTabId = 'fead';
    expect(veFeadResPreset('camp')).toBe(true);
    const slot = veResultSlots[0];
    const cb = R.signals.find((d) => d.key === 'campbell');
    expect(slot.xAxis.id).toBe('~fead-campbell:rpm');
    expect(ids(slot)).toEqual(cb.channels.map((c) => c.id));
    expect(slot.lanes.length).toBe(1);
    expect(veTrMarks().length).toBe(cb.brief.marks.length);
    const not = veTrNoteEntries();
    expect(not.length).toBe(1);
    expect(not[0].paras.join(' ')).toMatch(/Çalışma bandı/);
    expect(veTrNoteLead().lead).toBe(cb.brief.lead);
  });
  test('Sonuç Özeti rapor penceresine basılır, bant tek üreticiden', () => {
    coz();
    expect(veFeadResSummaryOpen()).toBe(true);
    const ov = document.getElementById('ve-report-overlay');
    expect(ov.style.display).toBe('flex');
    expect((ov.innerHTML.match(/class="ve-rep-head"/g) || []).length).toBe(1);
    expect(ov.innerHTML).toContain('FEAD Sonuç Özeti');
    veCloseDetailedReport();
  });
});
