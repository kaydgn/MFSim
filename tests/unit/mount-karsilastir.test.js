/**
 * mount-karsilastir.test.js — MODEL ↔ CAD: KARŞILAŞTIR VE UYGULA (Takoz adım 7, 2026-10-23)
 * ─────────────────────────────────────────────────────────────────────────
 * Ölçülen önce (main eff29b8): 3D Görüntüleyici modeli hiç görmüyordu —
 * STEP'in değerleri yalnız sihirbazın "Sihirbaza aktar"ıyla ve durumu BAŞTAN
 * kurarak modele girebiliyordu: tuvaldeki Tulga'ya aktarım 13 kütle/takoz
 * bileşenini çıkarıp yerine 8 rijitliksiz birim koyuyordu. Gerçek Tulga
 * dosyasında model ile dosya (0; 39,976; 28,596) mm ötelenmiş (sunu başka bir
 * referansla ölçülmüş) ve ön takoz sunuda 2 mm yukarıda.
 *
 *   · ÖTELEME — takozlardan; sıfır eşitlikte kazanır; iki takozdan azı
 *     uyuşursa sıfır; model dosyadan kurulduysa tam sıfır.
 *   · EŞLEME — tip içinde, ötelemeyle en yakın; eşi olmayan satır.
 *   · PENCERE — föy, varsayılan seçim (takoz seçili, gövde değil), uygulama ve
 *     dosyanın sistemine taşıma: TEK geri-al adımı, yalnız seçili satır.
 *   · SİHİRBAZ — aynı föy; tuvalden kurulan durum BİRLEŞTİRİLİR (rijitlik,
 *     braket, düğüm bağı yerinde); boş ya da STEP'ten kurulan durum baştan.
 *   · ADAMS ÖLÇÜTÜ — yalnız takozlar uygulanınca Tulga'nın statik uyumu.
 * Gerçek tarayıcı: tests/e2e/mount-cad.spec.js → *MODEL*.
 */
const fs = require('fs');
const path = require('path');
const KOK = path.join(__dirname, '../..');

const stubs = stubGlobals({
  vePortStyleAttr: jest.fn(() => ''), escapeHTML: jest.fn((s) => String(s)),
  updateNodeHandles: jest.fn(), startResize: jest.fn(), enablePortContextMenu: jest.fn(),
  veAttachNodeDrag: jest.fn(), veAttachPortConnect: jest.fn(), getPortPosition: jest.fn(() => ({ x: 0, y: 0 })),
  updatePortPosition: jest.fn(), applyNodeLabelPos: jest.fn(), showLabelContextMenu: jest.fn(),
  updateNodeCount: jest.fn(), clearSelection: jest.fn(), veMinimapUpdate: jest.fn(), veUpdateBoundary: jest.fn(),
});
global.nodes = [];
global.connections = [];
global.compCounter = 0;
eval(loadSource('components.js'));
global.componentDefs = componentDefs;
global.veMountCore = require('../../js/mount-core.js');
global.veMntSignals = require('../../js/mount-signals.js');
global.veMntBrief = require('../../js/mount-brief.js');
const cp = require('../../js/cp-mount.js');
Object.keys(cp).forEach((k) => { if (global[k] === undefined) global[k] = cp[k]; });
const STP = require('../../js/mount-step.js');
Object.keys(STP).forEach((k) => { global[k] = STP[k]; });
const W = require('../../js/cp-mount-wizard.js');
Object.keys(W).forEach((k) => { if (global[k] === undefined) global[k] = W[k]; });
const CAD = require('../../js/cp-mount-cad.js');
Object.keys(CAD).forEach((k) => { if (global[k] === undefined) global[k] = CAD[k]; });
const S = require('../helpers/step-takoz.js');
const REF = require('../fixtures/adams-tulga.js');

const TOPO = JSON.parse(fs.readFileSync(path.join(KOK, 'assets/examples/tulga_topoloji.json'), 'utf8'));
const KAY = S.TULGA_OTELEME;
const uz = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
const topla = (a, b) => a.map((v, i) => v + b[i]);

// ── ÖTELEME VE EŞLEME — saf çekirdek (js/mount-step.js) ───────────────────
describe('ÖTELEME — takozlardan, sıfır eşitlikte kazanır', () => {
  // Gerçek dosyanın ilişkisi: sunu = dosya − KAY; ön takoz sunuda 2 mm yukarıda
  const sunu = S.TULGA_TAKOZ.map(([id, ad, p]) => ({ id, ad, p }));
  const cadTakoz = (gurultu) => sunu.map((t, i) => ({ dugum: 10 + i, tip: 'mnt-mount', ad: t.ad,
    konum: topla(topla(t.p, KAY), t.id === 'TK-ON' ? [0, 0, -2] : [0.0004 * (i - 2) * gurultu, -0.0003 * gurultu, 0]) }));
  const modelTakoz = () => sunu.map((t) => ({ id: t.id, tip: 'mnt-mount', ad: t.ad, p: t.p.slice(), m: NaN }));

  test('Tulga: öteleme dörde ortanca, µm\'de; ön takoz 2,000 mm; her takoz kendi eşinde', () => {
    const K = STP.veMntStpKarsilastir(cadTakoz(1), modelTakoz());
    expect(K.T).toEqual(KAY);
    expect([K.uyusan, K.takoz]).toEqual([4, 5]);
    K.satirlar.forEach((r) => expect(r.modelAd).toBe(r.ad));
    expect(K.satirlar[0].fark).toBeCloseTo(2, 6);                 // ön takoz
    K.satirlar.slice(1).forEach((r) => expect(r.fark).toBeLessThanOrEqual(0.001));
  });

  test('model bu dosyadan kurulduysa öteleme TAM sıfır (ortanca gürültüsü yazılmaz)', () => {
    const cad = cadTakoz(0).map((c) => Object.assign({}, c, { konum: c.konum.slice() }));
    const model = cad.map((c, i) => ({ id: 'm' + i, tip: 'mnt-mount', ad: c.ad, p: c.konum.map((v) => v + 0.0004), m: NaN }));
    const K = STP.veMntStpKarsilastir(cad, model);
    expect(K.T).toEqual([0, 0, 0]);
    expect(K.uyusan).toBe(5);
  });

  test('iki takozdan azı uyuşursa öteleme yok; eşitlikte sıfır kazanır', () => {
    const cad = cadTakoz(0);
    const tek = modelTakoz().map((m, i) => i ? Object.assign({}, m, { p: topla(m.p, [i * 37, 0, 0]) }) : m);
    expect(STP.veMntStpKarsilastir(cad, tek).T).toEqual([0, 0, 0]);       // her aday tek takozu oturtur
    // iki takoz sıfırla, iki takoz başka bir ötelemeyle uyuşuyor: sıfır
    const d = [100, 0, 0];
    const cad4 = cad.slice(1).map((c) => Object.assign({}, c, { konum: c.konum.slice() }));
    const model4 = cad4.map((c, i) => ({ id: 'm' + i, tip: 'mnt-mount', ad: c.ad, p: i < 2 ? c.konum.slice() : topla(c.konum, d.map((v) => -v)) }));
    const K = STP.veMntStpKarsilastir(cad4, model4);
    expect(K.T).toEqual([0, 0, 0]);
    expect(K.uyusan).toBe(2);
  });

  test('gövde tip içinde, ötelemeyle en yakın; aynı tipten birden çok (braket); konumsuz eş; eşi olmayan', () => {
    const cad = cadTakoz(0).concat([
      { dugum: 1, tip: 'mnt-motor', ad: 'Motor', konum: topla([125, 0, 550], KAY) },
      { dugum: 2, tip: 'mnt-bracket', ad: 'Braket A', konum: topla([480, 293, 529], KAY) },
      { dugum: 3, tip: 'mnt-bracket', ad: 'Braket B', konum: topla([480, -296, 529], KAY) },
      { dugum: 4, tip: 'mnt-transfer', ad: 'Transfer', konum: [1431, 54, 202] },
      { dugum: 5, tip: 'mnt-pto', ad: 'PTO', konum: [0, 0, 0] }]);
    const model = modelTakoz().concat([
      { id: 'g1', tip: 'mnt-motor', ad: 'Motor', p: [124.96, 0.05, 550.03], m: 418 },
      { id: 'b2', tip: 'mnt-bracket', ad: 'Sol', p: [480, -295.7, 528.9], m: 3.5 },
      { id: 'b1', tip: 'mnt-bracket', ad: 'Sağ', p: [480, 293.5, 528.9], m: 3.5 },
      { id: 'g3', tip: 'mnt-transfer', ad: 'Transfer', p: null, m: 184 }]);
    const K = STP.veMntStpKarsilastir(cad, model);
    const r = (ad) => K.satirlar.filter((x) => x.ad === ad)[0];
    expect([r('Motor').id, r('Braket A').id, r('Braket B').id]).toEqual(['g1', 'b1', 'b2']);
    expect(r('Motor').fark).toBeCloseTo(uz([125, 0, 550], [124.96, 0.05, 550.03]), 9);
    expect([r('Transfer').id, r('Transfer').fark, r('Transfer').model]).toEqual(['g3', null, null]);   // konumsuz eş
    expect([r('PTO').id, r('PTO').fark, r('PTO').modelAd]).toEqual([null, null, '']);
    expect(r('Motor').mModel).toBe(418);
  });

  test('KAYIT ötelemeyle: konumlar modelin sisteminde, µm; satır düğümünü taşır', () => {
    const c = { birimler: [
      { dugum: 7, tip: 'mnt-mount', ad: 'T', konum: [1, 40.5, 30.0004] },
      { dugum: 9, tip: 'mnt-motor', ad: 'M', konum: [10, 50, 60], kapali: false }] };
    const k = STP.veMntStpKayit(c, {}, {}, [0, 39.976, 28.596]);
    expect(k.liste.map((n) => [n.dugum, n.data])).toEqual([[7, { x: 1, y: 0.524, z: 1.404 }], [9, { cgx: 10, cgy: 10.024, cgz: 31.404 }]]);
    expect(STP.veMntStpKayit(c).liste[0].data).toEqual({ x: 1, y: 40.5, z: 30 });   // ötelemesiz: bugünkü kayıt
  });
});

// ── OTURUM: Tulga modeli tuvalde, dosya ötelenmiş ──────────────────────────
let ev = null;
function tulgaTuval() {
  global.veMntStack = [{ nodeId: 'mod-1' }];
  ev = { id: 'v1', type: 'mnt-viewer', def: componentDefs['mnt-viewer'], data: {} };
  const t = JSON.parse(JSON.stringify(TOPO));
  global.nodes = [ev].concat(t.nodes);
  global.connections = t.connections;
  return t;
}
const TAKOZ_AD = S.TULGA_TAKOZ.map((t) => t[1]);
const GOVDE = { 'Motor bloğu': 'mnt-motor', 'Şanzıman gövdesi': 'mnt-gearbox', 'Transfer gövdesi': 'mnt-transfer' };
function oturum(opt) {
  const s = W.veMntWizStpOku(S.tulgaKalibi(Object.assign({ oteleme: KAY, onFark: [0, 0, -2] }, opt)), 'tulga.stp');
  s.sonuc.agac.forEach((d) => {
    if (TAKOZ_AD.indexOf(d.ad) >= 0) W.veMntWizStpRol(d.i, 'mnt-mount');
    if (GOVDE[d.ad]) W.veMntWizStpRol(d.i, GOVDE[d.ad]);
  });
  W.veMntWizStpHesapla();
  expect(s.coz.ok).toBe(true);
  return s;
}
const dugum = (ad) => global.nodes.filter((n) => n.customName === ad)[0];
const takozXYZ = (ad) => { const d = dugum(ad).data; return [+d.x, +d.y, +d.z]; };
function dom() {
  const el = document.createElement('div');
  el.innerHTML = CAD.getMntViewerPropertiesHTML(ev);
  return el;
}

beforeEach(() => {
  resetStubs(stubs);
  W._mwStpSifirla();
  tulgaTuval();
});
afterEach(() => { delete global.veMntStack; });

describe('PENCERE — föy, varsayılan seçim, uygula ve taşı', () => {
  test('Model bölümü: öteleme künyesi, 8 satır; takozlar seçili, gövdeler değil; sayılar modelin sisteminde', () => {
    oturum();
    const d = dom();
    const kat = d.querySelector('.ve-fp-kat[data-k="model"]');
    expect(kat).not.toBeNull();
    expect(kat.querySelector('.ve-fp-sect em').textContent).toBe('8 / 8 birim');
    expect(kat.querySelector('[data-mw-stp-oteleme="var"]').textContent).toMatch(/Öteleme \(0,000; 39,976; 28,596\) mm\s+4 \/ 5 takoz/);
    const satir = [...kat.querySelectorAll('tr[data-mw-stp-satir]')].map((r) => ({
      ad: r.cells[1].textContent, bilesen: r.cells[2].textContent, fark: r.cells[3].textContent,
      secili: r.querySelector('input').checked }));
    const al = (ad) => satir.filter((x) => x.ad === ad)[0];
    TAKOZ_AD.forEach((a) => expect(al(a).secili).toBe(true));
    expect(al('Ön takoz').fark).toBe('2,000');
    expect(al('Sağ ön takoz').bilesen).toBe('Sağ Ön Takoz');
    ['Motor bloğu', 'Şanzıman gövdesi', 'Transfer gövdesi'].forEach((a) => expect(al(a).secili).toBe(false));
    expect(al('Transfer gövdesi').fark).toBe('100,0');           // kutunun merkezi 100 mm yukarıda (kalıp)
    expect(d.querySelector('#ve-mnt-cad-uygula').disabled).toBe(false);
    expect(d.querySelector('#ve-mnt-cad-tasi')).not.toBeNull();
    expect(kat.textContent).toMatch(/5 seçili/);
  });

  test('Modele uygula: yalnız seçili satır, TEK geri-al adımı; rijitlik ve öteki bileşenler yerinde', () => {
    oturum();
    const once = JSON.parse(JSON.stringify(global.nodes));
    stubs.saveState.mockClear();
    // ön takoz 2 mm; örneğin iki sol takozu CATIA ölçüsünden 4 ve 1 µm ayrık (örnek
    // Adams tablosunun sayısını taşıyor); iki sağ takoz µm'de aynı: yazılmaz
    expect(W.veMntWizStpModeleUygula()).toBe(3);
    expect(stubs.saveState).toHaveBeenCalledTimes(1);
    expect(takozXYZ('Ön Takoz')).toEqual([-196.034, 0.047, 177.682]);
    expect([takozXYZ('Sol Ön Takoz')[0], takozXYZ('Sol Arka Takoz')[0]]).toEqual([439.957, 1381.671]);
    const degisen = global.nodes.filter((n, i) => JSON.stringify(n.data) !== JSON.stringify(once[i].data)).map((n) => n.customName);
    expect(degisen).toEqual(['Ön Takoz', 'Sol Ön Takoz', 'Sol Arka Takoz']);
    expect(dugum('Sağ Ön Takoz').data.x).toBe('439.961');           // aynı değer: alan dokunulmadı (metin kaldı)
    const on = dugum('Ön Takoz').data, on0 = once.filter((n) => n.customName === 'Ön Takoz')[0].data;
    ['kxs', 'kys', 'kzs', 'kxd', 'kyd', 'kzd', 'libKey'].forEach((k) => expect(on[k]).toEqual(on0[k]));
    // ikinci uygulama: değişen yok, adım da yok
    stubs.saveState.mockClear();
    expect(W.veMntWizStpModeleUygula()).toBe(0);
    expect(stubs.saveState).not.toHaveBeenCalled();
  });

  test('gövde seçilince ağırlık merkezi modelin sisteminde ve yazılan kütle; seçim kaldırılan takoz yazılmaz', () => {
    const s = oturum();
    const motor = s.coz.birimler.filter((b) => b.tip === 'mnt-motor')[0];
    const on = s.coz.birimler.filter((b) => b.ad === 'Ön takoz')[0];
    W.veMntWizStpKutle(motor.dugum, '418');
    W.veMntWizStpSec(motor.dugum, true);
    W.veMntWizStpSec(on.dugum, false);
    expect(W.veMntWizStpModeleUygula()).toBe(3);                  // motor + iki sol takoz
    const m = global.nodes.filter((n) => n.type === 'mnt-motor')[0].data;
    expect([m.cgx, m.cgy, m.cgz].map((v) => +(+v).toFixed(3))).toEqual([124.96, 0.05, 750.03]);   // kutunun merkezi − KAY
    expect(+m.mass).toBe(418);
    expect(takozXYZ('Ön Takoz')).toEqual([-196.034, 0.047, 179.682]);   // seçili değildi
  });

  test('seçili satır yoksa düğme kapalı ve sebebi ipucunda', () => {
    const s = oturum();
    s.coz.birimler.forEach((b) => W.veMntWizStpSec(b.dugum, false));
    const b = dom().querySelector('#ve-mnt-cad-uygula');
    expect([b.disabled, b.getAttribute('title')]).toEqual([true, 'Seçili satır yok.']);
  });

  test('Dosyanın sistemine taşı: bütün konumlar T kadar, göreli konum aynı, TEK adım; öteleme sıfırlanır', () => {
    const s = oturum();
    const once = JSON.parse(JSON.stringify(global.nodes));
    stubs.saveState.mockClear();
    expect(W.veMntWizStpSistemeTasi()).toBe(13);                  // 5 takoz + 3 gövde + 5 braket
    expect(stubs.saveState).toHaveBeenCalledTimes(1);
    global.nodes.forEach((n, i) => {
      const al = componentDefs[n.type] && componentDefs[n.type].isMount ? ['x', 'y', 'z']
        : (componentDefs[n.type] && componentDefs[n.type].isMountBody ? ['cgx', 'cgy', 'cgz'] : null);
      if (!al) { expect(n.data).toEqual(once[i].data); return; }
      al.forEach((k, j) => expect(+n.data[k]).toBeCloseTo(+once[i].data[k] + KAY[j], 9));
    });
    const K = W.veMntWizStpKarsilastirma(s, 'tuval');
    expect([K.T, K.uyusan]).toEqual([[0, 0, 0], 4]);
    expect(dom().querySelector('#ve-mnt-cad-tasi')).toBeNull();
    expect(dom().querySelector('[data-mw-stp-oteleme="yok"]').textContent).toMatch(/Öteleme yok\s+4 \/ 5 takoz/);
  });

  test('tuvalde gövde ya da takoz yoksa föy yerine durum ve tek yönlendirme', () => {
    global.nodes = [ev];
    oturum();
    const kat = dom().querySelector('.ve-fp-kat[data-k="model"]');
    expect(kat.querySelector('table')).toBeNull();
    expect(kat.textContent).toMatch(/Modelde eşleşen gövde ya da takoz yok\. Sihirbaz’da STEP’ten modeli kurun\./);
  });
});

describe('SİHİRBAZ — aynı föy; tuvalden kurulan durum birleştirilir', () => {
  const kart = () => { const el = document.createElement('div'); el.innerHTML = W._mwStpKartHTML(); return el; };
  beforeEach(() => {
    document.body.innerHTML = '<div id="ve-canvas-wrapper"></div><div id="ve-mntwiz-overlay" style="display:none;">'
      + '<div class="ve-fw-shell"><nav id="ve-mw-nav"></nav><div id="ve-mw-body"></div></div><div id="ve-mw-foot"></div></div>';
  });
  afterEach(() => { if (W.veMntWizAcik()) W.veMntWizKapat(false); document.body.innerHTML = ''; });

  test('tuvalden açılan sihirbaz: föy sihirbazın satırlarıyla; aktarım takozu yazar, rijitlik, braket ve düğüm bağı kalır', () => {
    W.veMntWizAc();
    const st0 = JSON.parse(JSON.stringify(W.veMntWizState()));
    expect(st0.seededFrom).toBe('tuval');
    oturum();
    const t = kart().querySelector('table.ve-mw-tbl-model');
    expect(t.getAttribute('data-mw-stp-model')).toBe('sihirbaz');
    expect([...t.querySelectorAll('input:checked')]).toHaveLength(5);
    expect(W.veMntWizStpAktar()).not.toBeNull();
    const st = W.veMntWizState();
    expect(st.seededFrom).toBe('tuval');
    expect([st.govdeler.length, st.takozlar.length]).toEqual([st0.govdeler.length, st0.takozlar.length]);
    const on = st.takozlar.filter((x) => x.ad === 'Ön Takoz')[0], on0 = st0.takozlar.filter((x) => x.ad === 'Ön Takoz')[0];
    expect([on.x, on.y, on.z]).toEqual([-196.034, 0.047, 177.682]);
    expect([on.kxs, on.kzd, on._dugum]).toEqual([on0.kxs, on0.kzd, on0._dugum]);
    expect(on.kaynak).toEqual({ konum: true });
    st.govdeler.forEach((g, i) => expect(g).toEqual(st0.govdeler[i]));   // gövdeler seçili değildi
    expect(st.stepKaynak).toEqual({ dosya: 'tulga.stp', govde: 0, takoz: 5 });
  });

  test('eşi olmayan seçili birim EKLENİR; seçimi kaldırılan aktarılmaz; seçim değişince "Aktarımdan sonra seçimler değişti"', () => {
    global.nodes = [ev].concat(global.nodes.filter((n) => n.type !== 'mnt-transfer'));
    W.veMntWizAc();
    const s = oturum();
    const tc = s.coz.birimler.filter((b) => b.tip === 'mnt-transfer')[0];
    expect(W.veMntWizStpKarsilastirma(s, 'sihirbaz').satirlar.filter((r) => r.dugum === tc.dugum)[0]).toMatchObject({ id: null, secili: true });
    W.veMntWizStpSec(s.coz.birimler.filter((b) => b.ad === 'Sol arka takoz')[0].dugum, false);
    W.veMntWizStpAktar();
    const st = W.veMntWizState();
    const yeni = st.govdeler.filter((g) => g.type === 'mnt-transfer');
    expect(yeni).toHaveLength(1);
    expect(yeni[0]).toMatchObject({ ad: 'Transfer gövdesi', cgx: 1431.449, cgy: 54.419, cgz: 302.336 });
    expect(yeni[0]._dugum).toBeUndefined();
    expect(st.takozlar.filter((x) => x.ad === 'Sol Arka Takoz')[0].kaynak).toBeUndefined();
    expect(st.stepKaynak).toMatchObject({ govde: 1, takoz: 4 });
    W.veMntWizStpSec(s.coz.birimler.filter((b) => b.ad === 'Sol arka takoz')[0].dugum, true);
    expect(kart().textContent).toMatch(/Aktarımdan sonra seçimler değişti\./);
  });

  test('boş sihirbaz: durum baştan, bütün birimler (bugünkü aktarım); STEP\'ten kurulan durum yeniden aktarımda baştan', () => {
    global.nodes = [ev];
    W.veMntWizAc();
    const s = oturum();
    expect(W.veMntWizStpKarsilastirma(s, 'sihirbaz').satirlar.every((r) => r.id === null && r.secili)).toBe(true);
    W.veMntWizStpAktar();
    let st = W.veMntWizState();
    expect([st.seededFrom, st.govdeler.length, st.takozlar.length]).toEqual(['step', 3, 5]);
    // STEP'ten kurulan durumda model boş sayılır: seçimi kaldırılan birim düşer
    W.veMntWizStpSec(s.coz.birimler.filter((b) => b.tip === 'mnt-gearbox')[0].dugum, false);
    W.veMntWizStpAktar();
    st = W.veMntWizState();
    expect([st.govdeler.length, st.takozlar.length]).toEqual([2, 5]);
    // takozun konumu dosyanın sisteminde (öteleme yok)
    expect([st.takozlar[0].x, st.takozlar[0].z]).toEqual([-196.034, 179.682 + KAY[2] - 2]);
  });

  test('birleştirmede "S": yazılan kütle işaretsiz (önceki işaret düşer), malzemeden türeyen işaretli', () => {
    W.veMntWizAc();
    const s = oturum();
    const motor = s.coz.birimler.filter((b) => b.tip === 'mnt-motor')[0];
    W.veMntWizState().govdeler.filter((g) => g.type === 'mnt-motor')[0].kaynak = { mass: true, cg: true, I: true };
    W.veMntWizStpKutle(motor.dugum, '418');
    W.veMntWizStpSec(motor.dugum, true);
    W.veMntWizStpAktar();
    let g = W.veMntWizState().govdeler.filter((x) => x.type === 'mnt-motor')[0];
    expect([g.mass, g.kaynak.mass, g.kaynak.cg, g.kaynak.I]).toEqual([418, undefined, true, true]);
    W.veMntWizStpYogunluk(motor.dugum, 'celik');
    W.veMntWizStpAktar();
    g = W.veMntWizState().govdeler.filter((x) => x.type === 'mnt-motor')[0];
    expect(g.mass).toBeCloseTo(7850 * 600 * 500 * 600 * 1e-9, 3);
    expect(g.kaynak.mass).toBe(true);
  });

  test('masanın önizlemesi aktarımın YAZACAĞI durum: birleştirmede 13 bileşen, takoz noktası modelin sisteminde', () => {
    W.veMntWizAc();
    const s = oturum();
    const A = W._mwStpAktarDurumu(s);
    expect(A.birlestir).toBe(true);
    expect(A.st.govdeler.length + A.st.takozlar.length).toBe(13);
    expect(W.veMntWizState().takozlar.filter((x) => x.ad === 'Ön Takoz')[0].z).not.toBe(177.682);   // önizleme durumu değiştirmez
  });
});

// ── ÖLÇÜT: Tulga'nın Adams'la statik uyumu ────────────────────────────────
describe('ADAMS ÖLÇÜTÜ — yalnız takozlar uygulanınca', () => {
  function adamsRms() {
    const solver = global.nodes.filter((n) => n.type === 'mnt-solver')[0];
    global.veUpdateResultsTree = jest.fn();
    const R = cp._mntComputeResults(solver.id);
    expect(R.error).toBeUndefined();
    const names = R.mounts.map((m) => m.name), idx = REF.COLUMNS.map((c) => names.indexOf(c.mount));
    const e = [];
    REF.ROWS.forEach((r, ri) => {
      if (r.gap) return;
      const c = R.allCases.find((x) => x.name === r.lc);
      for (let k = 0; k < 5; k++) for (let a = 0; a < 3; a++) e.push(c.res.perMount[idx[k]].delta[a] * 1000 - REF.TABLE1[ri][k][a]);
    });
    return Math.sqrt(e.reduce((t, v) => t + v * v, 0) / e.length);
  }

  // Ölçülen: 0,0670 → 0,0662 mm (en büyük hücre 0,234 → 0,229 mm); sehim en çok
  // 0,039 mm, modlar en çok 0,03 Hz değişiyor. Uyum KORUNUYOR — hatta CAD'in ön
  // takozuyla biraz iyileşiyor (sunudaki ön takoz yanlış ölçülmüş, kullanıcı).
  test('önce 0,067 mm; takozlar uygulanınca 0,066 mm — uyum korunur', () => {
    const once = adamsRms();
    expect(once).toBeCloseTo(0.067, 3);
    oturum();
    expect(W.veMntWizStpModeleUygula()).toBe(3);
    const sonra = adamsRms();
    expect(sonra).toBeCloseTo(0.0662, 4);
    expect(sonra).toBeLessThan(once);
  });
});
