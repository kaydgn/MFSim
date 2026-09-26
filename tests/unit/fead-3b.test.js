/**
 * fead-3b.test.js — STEP'İN 3B GÖRÜNTÜLEYİCİSİ (js/cp-fead-3b.js)
 *
 * Kullanıcı akışı (2026-09-26): STEP aktarılır → parçalar 3B'de ELLE seçilir →
 * bir düğmeyle çap ve merkezler çıkar. WebGL'in kendisi Node'da koşmaz
 * (tests/e2e/fead-step.spec.js); burada kilitlenenler:
 *   · BİRİM: parça en yakın rollü ataya aittir — renk ve seçim onu okur
 *   · RENK TEK KAYNAKTAN: her rolün jetonu var ve iki temada da tanımlı
 *   · PANEL kartın durumunu okur (rol, hesap, tablo)
 *   · SİHİRBAZ BAĞLANTISI: dosya okununca açılır (yalnız başarıda), Esc önce
 *     3B'yi kapatır (tek Esc tek katman), her çizim pencereyi tazeler,
 *     sihirbaz kapanınca WebGL bırakılır
 *   · OKUYUCU → ÜÇGENLEYİCİ: okuma sonucu parça başına geometriyi taşır
 */
const fs = require('fs');
const path = require('path');
const wiz = require('../../js/cp-fead-wizard.js');
const fead = require('../../js/cp-fead.js');
const M = require('../../js/fead-model.js');
const F = require('../../js/fead-core.js');
const P = require('../../js/step-p21.js');
const S = require('../../js/fead-step.js');
const U = require('../../js/step-ucgen.js');
const O = require('../helpers/step-ornek.js');
const Y = require('../helpers/step-yaz.js');

const stubs = stubGlobals();
document.body.innerHTML = '<div id="ve-canvas"></div>';
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
[require('../../js/fead-duty.js'), require('../../js/fead-belts.js'), require('../../js/fead-tensioners.js'),
  require('../../js/fead-engines.js'), require('../../js/fead-accessories.js'), require('../../js/fead-checks.js'), P, S, U]
  .forEach((m) => { Object.keys(m).forEach((k) => { global[k] = m[k]; }); });
global.FEADCore = F;
Object.keys(M).forEach((k) => { global[k] = M[k]; });
Object.keys(fead).forEach((k) => { if (global[k] === undefined) global[k] = fead[k]; });
Object.keys(wiz).forEach((k) => { global[k] = wiz[k]; });
const G = require('../../js/cp-fead-3b.js');

beforeEach(() => {
  resetStubs(stubs);
  global.nodes = [];
  global.connections = [];
  ['veFeadWiz3bAc', 'veFeadWiz3bAcik', 'veFeadWiz3bKapat', 'veFeadWiz3bTazele'].forEach((k) => { delete global[k]; });
});

const kabuk = () => {
  document.body.innerHTML = '<div id="ve-canvas"></div>'
    + '<div id="ve-feadwiz-overlay" style="display:none;">'
    + '<div id="ve-fw-nav"></div><div id="ve-fw-body"></div><div id="ve-fw-foot"></div></div>';
};
const oku = (metin) => { kabuk(); wiz.veFeadWizReset(); return wiz.veFeadWizStpOku(metin || O.ag00686Step(), 'AG00686.stp'); };
const dugum = (s, re) => s.sonuc.agac.findIndex((d) => re.test(d.ad));

describe('BİRİM: parça rollü atasına aittir — bir yolda tek rol', () => {
  test('rolsüz parça birimsiz; alt montaja rol verilince bütün parçaları onun; içindeki parçaya rol verilince birimin rolü kalkar', () => {
    const s = oku(O.gergiAltMontaj());
    const pi = (ad) => s.sonuc.parcalar.findIndex((p) => p.ad === ad);
    expect(G.veFeadWiz3bBirim(s, pi('KASNAK'))).toBe(-1);
    wiz.veFeadWizStpRol(dugum(s, /GERG/), 'fead-tensioner');
    const g = dugum(s, /GERG/);
    expect(G.veFeadWiz3bBirim(s, pi('KASNAK'))).toBe(g);
    expect(G.veFeadWiz3bBirim(s, pi('KOL'))).toBe(g);
    expect(G.veFeadWiz3bBirim(s, pi('KRANK'))).toBe(-1);
    expect(G.veFeadWiz3bParcalar(s, g).sort()).toEqual([pi('KASNAK'), pi('KOL')].sort());
    // Yol kökten: MONTAJ › OTOMATİK GERGİ › KASNAK
    expect(G.veFeadWiz3bYol(s, s.sonuc.parcalar[pi('KASNAK')].dugum).map((d) => s.sonuc.agac[d].ad))
      .toEqual(['MONTAJ', 'OTOMATİK GERGİ', 'KASNAK']);
    // Birimin içindeki parçaya rol: birim dağılır (panel bunu "birimin rolü kalkar" diye söyler)
    const kd = s.sonuc.parcalar[pi('KASNAK')].dugum;
    document.body.insertAdjacentHTML('beforeend', '<div id="b">' + G.veFeadWiz3bPanelHTML(s, kd) + '</div>');
    expect(document.getElementById('b').textContent).toMatch(/OTOMATİK GERGİ biriminin içinde.*birimin rolü kalkar/);
    wiz.veFeadWizStpRol(kd, 'fead-idler');
    expect(s.roller[g]).toBeNull();
    expect(G.veFeadWiz3bBirim(s, pi('KASNAK'))).toBe(kd);
    expect(G.veFeadWiz3bBirim(s, pi('KOL'))).toBe(-1);
  });
});

describe('RENK TEK KAYNAKTAN', () => {
  test('her rol tipinin jetonu var ve jeton iki temada da tanımlı', () => {
    const css = fs.readFileSync(path.join(__dirname, '../../css/styles.css'), 'utf8');
    const tipler = wiz.VE_FW_PULLEY_TYPES.concat(['fead-tensioner']);
    tipler.forEach((t) => {
      const j = G.VE_FW_3B_ROL_RENK[t];
      expect(j).toBeDefined();
      // açık tema (:root) ve koyu tema bloğunda ayrı ayrı yazılı
      expect((css.match(new RegExp(j + '\\s*:', 'g')) || []).length).toBeGreaterThanOrEqual(2);
    });
    // Rolsüz parçanın jetonu da tanımlı
    expect(G.veFeadWiz3bRolJeton('')).toBe('--text-muted');
  });
});

describe('PANEL kartın durumunu okur', () => {
  const ROL = [[/GERG/, 'fead-tensioner'], [/KRANK/, 'fead-crank'], [/KL[İI]MA/, 'fead-ac'], [/AVARA/, 'fead-idler']];
  test('seçili düğümün rol düğmeleri (her tip + "Rol yok"), basılı olan rolü; kök düğüm düğme değil', () => {
    const s = oku();
    const k = dugum(s, /KRANK/);
    wiz.veFeadWizStpRol(k, 'fead-crank');
    document.body.insertAdjacentHTML('beforeend', '<div id="panel">' + G.veFeadWiz3bPanelHTML(s, k) + '</div>');
    const p = document.getElementById('panel');
    const roller = [...p.querySelectorAll('[data-ve-3b-rol]')];
    expect(roller).toHaveLength(wiz.VE_FW_PULLEY_TYPES.length + 2);
    expect(roller.filter((b) => b.getAttribute('aria-pressed') === 'true').map((b) => b.getAttribute('data-ve-3b-rol'))).toEqual(['fead-crank']);
    // Yol: kök bütün montaj — rol verilmez, tıklanmaz
    expect(p.querySelector('button[data-ve-3b-yol="0"]')).toBeNull();
    expect(p.querySelector('b[data-ve-3b-yol="' + k + '"]')).not.toBeNull();
  });
  test('hesaptan sonra kasnak tablosu; iki krank rolüyle hesap düğmesi kapalı', () => {
    const s = oku();
    ROL.forEach(([re, t]) => wiz.veFeadWizStpRol(dugum(s, re), t));
    wiz.veFeadWizStpHesapla();
    document.body.insertAdjacentHTML('beforeend', '<div id="p2">' + G.veFeadWiz3bPanelHTML(s, -1) + '</div>');
    const p = document.getElementById('p2');
    const satir = [...p.querySelectorAll('tr[data-ve-3b-kasnak]')];
    expect(satir).toHaveLength(4);
    expect(satir.map((r) => +r.children[1].textContent.replace(',', '.')).sort((a, b) => a - b)).toEqual([75, 75, 127, 160]);
    expect(p.querySelector('#ve-fw-3b-aktar')).not.toBeNull();
    // İki krank: kartın rol kapısı → düğme kapalı
    wiz.veFeadWizStpRol(dugum(s, /AVARA/), 'fead-crank');
    const h = G.veFeadWiz3bPanelHTML(s, -1);
    expect(h).toMatch(/id="ve-fw-3b-hesapla" disabled/);
  });
});

describe('SİHİRBAZ BAĞLANTISI', () => {
  test('dosya okununca görüntüleyici açılır — okunamayan dosyada açılmaz', () => {
    global.veFeadWiz3bAc = jest.fn(() => true);
    oku();
    expect(global.veFeadWiz3bAc).toHaveBeenCalledTimes(1);
    global.veFeadWiz3bAc.mockClear();
    oku('ISO-10303-21;\nDATA;\nENDSEC;\nEND-ISO-10303-21;');
    expect(global.veFeadWiz3bAc).not.toHaveBeenCalled();
  });
  test('TEK ESC TEK KATMAN: 3B açıksa Esc yalnız onu kapatır, sihirbaz açık kalır', () => {
    kabuk();
    wiz.veFeadWizReset();
    const ov = document.getElementById('ve-feadwiz-overlay');
    ov.style.display = 'flex';
    global.veFeadWiz3bAcik = () => true;
    global.veFeadWiz3bKapat = jest.fn();
    wiz.veFeadWizKey({ key: 'Escape' });
    expect(global.veFeadWiz3bKapat).toHaveBeenCalledTimes(1);
    expect(ov.style.display).toBe('flex');
    // 3B kapalıyken Esc sihirbazı kapatır
    global.veFeadWiz3bAcik = () => false;
    wiz.veFeadWizKey({ key: 'Escape' });
    expect(ov.style.display).toBe('none');
  });
  test('her sihirbaz çizimi pencereyi tazeler; sihirbaz kapanınca pencere (WebGL) kapanır', () => {
    global.veFeadWiz3bTazele = jest.fn();
    global.veFeadWiz3bKapat = jest.fn();
    oku();
    const n = global.veFeadWiz3bTazele.mock.calls.length;
    wiz.veFeadWizStpRol(dugum(wiz.veFeadWizStp(), /KRANK/), 'fead-crank');
    expect(global.veFeadWiz3bTazele.mock.calls.length).toBe(n + 1);
    wiz.veFeadWizClose(false);
    expect(global.veFeadWiz3bKapat).toHaveBeenCalled();
  });
  test('pencere kapalıyken tazeleme bir şey yapmaz', () => {
    expect(() => G.veFeadWiz3bTazele && G.veFeadWiz3bTazele()).not.toThrow();
  });
});

describe('OKUYUCU → ÜÇGENLEYİCİ', () => {
  test('okuma sonucu parça başına geometriyi taşır ve her parça üçgenlenir', () => {
    const o = S.veFeadStpOku(O.ag00686Step());
    expect(o._model).toBeTruthy();
    expect(o._geo).toHaveLength(o.parcalar.length);
    const B = U.veStepUcgenBaglam(o._model, { kiris: 0.2 });
    o._geo.forEach((g, i) => {
      expect(g.yuzler.length).toBe(o.parcalar[i].yuzSayisi);
      const r = U.veStepUcgenParca(B, g.yuzler, g.M, g.birim);
      expect(r.ucgen.length).toBeGreaterThan(0);
      expect(r.kenarYuz).toBe(0);
    });
    // Parçanın ağı dünyada: kayış düzlemi X = −250'nin çevresinde (step-ornek)
    const kr = o.parcalar.findIndex((p) => /KRANK/.test(p.ad));
    const r = U.veStepUcgenParca(B, o._geo[kr].yuzler, o._geo[kr].M, o._geo[kr].birim);
    expect(r.kutu[0]).toBeLessThan(-250);
    expect(r.kutu[3]).toBeGreaterThan(-250);
  });
});
