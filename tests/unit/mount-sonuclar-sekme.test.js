/**
 * mount-sonuclar-sekme.test.js — SONUÇLAR SAYFASI TAKOZ ÇÖZÜMÜNÜN BAYATLIĞINI SÖYLER
 * ──────────────────────────────────────────────────────────────────────────────
 * Model hesaptan sonra değişince Takoz pencereleri "bayat" diyordu ama Sonuçlar
 * sayfası eski sayıları uyarısız göstermeye devam ediyordu; ağaçtaki rapor
 * bağlantısı da bayat çözümden uyarısız rapor üretiyordu (FEAD ikisini de
 * söylüyor). Bu dosya üç şeyi kilitler:
 *
 *   • DURUM ÇİPİ — Veri Gezgini'nin üstünde, FEAD sekmesinin sözlüğüyle:
 *     güncel · bayat · modeli projede yok. Hüküm PROJE ÇAPINDA: kullanıcı
 *     Sonuçlar'a Takoz alt topolojisinden, kökten ya da başka bir modülün
 *     içinden gelebilir. Eski yardımcı yalnız canlı tuvale bakıyordu; kökte
 *     çözücüyü bulamayıp DEĞİŞMEMİŞ modele "bayat" derdi.
 *   • RAPOR — bayat çözümden üretilir ama söylenir (toast), güncelken susar.
 *   • ORTAK DOSYA — results.js'te Takoz'a özgü HTML üreticisi kalmadı; satırlar
 *     js/cp-mount-results.js'te, kaynak tablosuna iki kancayla bağlı.
 */
const fs = require('fs');
const path = require('path');
const core = require('../../js/mount-core.js');
global.veMountCore = core;
global.veMntSignals = require('../../js/mount-signals.js');
global.veMntBrief = require('../../js/mount-brief.js');

const stubs = stubGlobals({ saveState: jest.fn(), showToast: jest.fn(), showNodeProperties: jest.fn() });
document.body.innerHTML = '<div id="ve-results-tree"></div><div id="ve-solver-tab-bar"></div>';
global.nodes = [];
global.connections = [];
eval(fs.readFileSync(path.join(__dirname, '../../js/components.js'), 'utf8'));
global.componentDefs = componentDefs;
const cp = require('../../js/cp-mount.js');
const rep = require('../../js/cp-mount-report.js');
const res = require('../../js/cp-mount-results.js');
// Tarayıcıda hepsi global: kancalar ve rapor üreticisi adlarıyla arıyor.
Object.assign(global, {
  veMntResultState: cp.veMntResultState,
  veMntResTreeTopHTML: res.veMntResTreeTopHTML,
  veMntResTreeReportHTML: res.veMntResTreeReportHTML,
  veMntGenerateReport: rep.veMntGenerateReport,
});

global.COMPONENT_SIGNALS = {};
global.veTabs = [{ id: 't1', name: 'T1', state: { simResults: null, nodes: [], connections: [] } }];
global.veActiveTabIdx = 0;
global.canvasOffset = { x: 0, y: 0 };
global.canvasZoom = 1;
global.compCounter = 0;
global.veProjectName = 'Test';
global.SENSOR_PACKAGES = [];
global.veSaveActiveTabState = jest.fn();
global.veSaveActiveTabStateKeepView = jest.fn();
eval(loadSource('measure-core.js'));
eval(loadSource('signal-tree.js'));
eval(loadSource('trace-view.js'));
eval(loadSource('results.js'));
eval(loadSource('graphics.js'));
global.veResultSources = veResultSources;
global.veResSets = veResSets;

const TULGA = JSON.parse(fs.readFileSync(path.join(__dirname, '../../assets/examples/tulga_topoloji.json'), 'utf8'));
const kopya = () => JSON.parse(JSON.stringify(TULGA.nodes)).map((n) => Object.assign(n, { def: componentDefs[n.type] }));

// Tulga'yı Takoz alt topolojisinde çöz; sonuç iki globale de yazılır.
function coz() {
  global.nodes = kopya();
  const R = cp._mntComputeResults(global.nodes.find((n) => n.type === 'mnt-solver').id);
  global._veMntLast = R;
  window.veMountResults = R;
  return R;
}
// Kökteki Takoz kartı: alt topoloji KAYITLI listede (o an canlı değil).
function kart(liste) {
  return { id: 'kart', type: 'mount-analysis', def: componentDefs['mount-analysis'],
           data: { subTopology: { nodes: liste, connections: [] } } };
}
function agac() {
  veActiveSolverTabId = 'mount';
  veUpdateResultsTree();
  return document.getElementById('ve-results-tree');
}
const cip = () => {
  const c = agac().querySelector('.ve-fr-tree-top .ve-fr-chip');
  return c ? c.getAttribute('data-d') + ' ' + c.textContent : null;
};
const ilkTakoz = (liste) => liste.find((n) => n.type === 'mnt-mount');

beforeEach(() => {
  resetStubs(stubs);
  cp._mntForgetResults();
  window.veMountResults = null;
  global._veMntLast = null;
  global.veTabs[0].state.nodes = [];
  veResultSlots = [{}, {}, {}, {}];
  veSolverTabSlots = {};
});

describe('DURUM ÇİPİ — hüküm proje çapında', () => {
  test('Takoz alt topolojisinde: hesaptan sonra güncel, model değişince bayat ve sebebi yazılı', () => {
    coz();
    expect(cip()).toBe('ok Güncel');
    expect(agac().querySelector('.ve-fr-tree-meta').textContent).toMatch(/\d+ yük durumu · \d+ mod$/);
    ilkTakoz(global.nodes).data.kzs = '300';
    expect(cip()).toBe('warn Model değişti');
    // Çip durumu söyler; ağaçta ikinci kez yazılmaz (aynı durum bir kez, çare kılavuzda).
    expect(agac().querySelector('.ve-fr-tree-uyari')).toBeNull();
  });

  test('kökteyken: kartın KAYITLI alt topolojisinden — değişmemiş model güncel, değişen bayat', () => {
    coz();
    const kayitli = global.nodes;
    global.nodes = [kart(kayitli)];
    expect(cip()).toBe('ok Güncel');
    ilkTakoz(kayitli).data.kzs = '300';
    expect(cip()).toBe('warn Model değişti');
  });

  test('başka bir modülün alt topolojisindeyken: sekmenin kayıtlı kökünden', () => {
    coz();
    global.veTabs[0].state.nodes = [kart(global.nodes)];
    global.nodes = [{ id: 'f1', type: 'fead-solver', data: {} }];
    expect(cip()).toBe('ok Güncel');
  });

  test('çözülen model projede yoksa "Modeli projede yok" — bayat değil', () => {
    coz();
    global.nodes = [];
    expect(cip()).toBe('off Modeli projede yok');
    expect(cp.veMntResultState().k).toBe('kayip');
  });

  test('pencerelerin hükmü değişmedi: başka topolojideki çözüm "bu topolojinin" değil', () => {
    coz();
    const kayitli = global.nodes;
    global.nodes = [kart(kayitli)];
    expect(cp.veMntResultState().k).toBe('guncel');      // Sonuçlar sayfası
    expect(cp.veMntSonucDurumu().durum).toBe('bayat');   // canlı tuvalde çözücü yok
  });
});

describe('RAPOR — bayat çözümden üretilir ama söylenir', () => {
  const uyari = () => stubs.showToast.mock.calls.filter((c) => /son çözümden; model sonra değişti/.test(c[0]) && c[1] === 'warning');

  test('güncel çözümde uyarı yok', () => {
    coz();
    rep.veMntGenerateReport(null);
    expect(uyari()).toEqual([]);
  });

  test('model değiştiyse uyarı — Sonuçlar ağacından, kökteyken de', () => {
    coz();
    const kayitli = global.nodes;
    ilkTakoz(kayitli).data.kzs = '300';
    global.nodes = [kart(kayitli)];
    rep.veMntGenerateReport(null);
    expect(uyari().length).toBe(1);
  });
});

describe('ORTAK DOSYA — Takoz satırları kendi dosyasında', () => {
  const kaynak = fs.readFileSync(path.join(__dirname, '../../js/results.js'), 'utf8');

  test('results.js Takoz\'a özgü HTML üretmiyor; kaynak iki kancayla bağlı', () => {
    expect(kaynak).not.toMatch(/function veMnt\w*HTML/);
    const src = veResultSources.find((s) => s.tab === 'mount');
    expect(typeof src.treeTop).toBe('function');
    expect(typeof src.treeBottom).toBe('function');
  });

  test('rapor bağlantısı ağacın altında, satır içi stil yok', () => {
    coz();
    const t = agac();
    const btn = t.querySelector('.ve-fr-tree-rep .ve-fr-tree-link');
    expect(btn && btn.getAttribute('onclick')).toBe('veMntGenerateReport(null)');
    expect(t.querySelectorAll('.ve-fr-tree-top [style], .ve-fr-tree-rep [style]').length).toBe(0);
  });
});
