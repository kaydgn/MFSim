/**
 * mount-cad.test.js — 3D GÖRÜNTÜLEYİCİ: CAD'İN EVİ (Takoz adım 4, 2026-10-20)
 * ─────────────────────────────────────────────────────────────────────────
 * Ölçülen önce (main 1ae9e2c, gerçek program, sentetik güç grubu, 7 rol):
 * pencerede yalnız "henüz yok" notu (0 düğme, 0 dosya girdisi); kaydedilen
 * projede 0 rol; aynı dosya — aynı oturumda kaldırılıp ya da proje
 * kaydedilip sayfa yeniden açılınca — 0 / 7 rolle geliyordu; "Yeni proje"den
 * sonraki ilk Takoz modülünde ÖNCEKİ projenin dosyası ve rolleri duruyordu
 * (kimlik `comp-1` iki projede aynı). Sonra: 7 / 7 · 7 / 7 · eski oturum yok.
 *
 *   · KAYIT — roller projeye ÖRNEK YOLUYLA (js/mount-step.js): aynı dosyada
 *     indisler bire bir, sırası ya da bir adı değişen dosyada yol eşleşir,
 *     eşleşmeyen satır sayılır; kütle rolüyle gider.
 *   · OTURUM ↔ KAYIT — rol ve kütle 3D Görüntüleyici'nin verisine yazılır
 *     (geri-al adımı değil); başka dosyanın kaydı rol verilene dek korunur;
 *     oturum modül ve sekme kimliğiyle, proje değişince düşer.
 *   · PENCERE — kitin bölümleri, tek eylem durumdan; sihirbazın kartıyla AYNI
 *     üreticiler (ağaç, hesap, kütle).
 *   · GERİ-AL — gerçek restoreState: geri yüklenen düğüm verisi canlı
 *     oturumun rollerini taşır.
 * Gerçek tarayıcı: tests/e2e/mount-cad.spec.js.
 */
const fs = require('fs');
const path = require('path');
const KOK = path.join(__dirname, '../..');
const oku = (f) => fs.readFileSync(path.join(KOK, f), 'utf8');

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
const cp = require('../../js/cp-mount.js');
Object.keys(cp).forEach((k) => { if (global[k] === undefined) global[k] = cp[k]; });
const STP = require('../../js/mount-step.js');
Object.keys(STP).forEach((k) => { global[k] = STP[k]; });
const W = require('../../js/cp-mount-wizard.js');
Object.keys(W).forEach((k) => { if (global[k] === undefined) global[k] = W[k]; });
const CAD = require('../../js/cp-mount-cad.js');
Object.keys(CAD).forEach((k) => { if (global[k] === undefined) global[k] = CAD[k]; });
const S = require('../helpers/step-takoz.js');

const ROLLER = { 'Motor bloğu': 'mnt-motor', 'Şanzıman gövdesi': 'mnt-gearbox', 'Arka braket': 'mnt-bracket' };
const dugumi = (s, ad) => s.sonuc.agac.filter((d) => d.ad === ad)[0].i;
function rolVer(s) {
  s.sonuc.agac.forEach((d) => {
    if (ROLLER[d.ad]) W.veMntWizStpRol(d.i, ROLLER[d.ad]);
    if (/takoz$/.test(d.ad)) W.veMntWizStpRol(d.i, 'mnt-mount');
  });
}
const rollu = (s) => s.roller.filter(Boolean).length;
const ad = (s) => s.sonuc.agac.filter((d) => s.roller[d.i]).map((d) => d.ad + ':' + s.roller[d.i]);
let ev = null;
function modul(id) {
  global.veMntStack = [{ nodeId: id || 'mod-1' }];
  ev = { id: 'v1', type: 'mnt-viewer', def: componentDefs['mnt-viewer'], data: {} };
  global.nodes = [ev];
}
// DEĞİŞTİRİLMİŞ DOSYA (yeniden dışa aktarım): parça sırası farklı, bir takozun
// örnek adı değişmiş, yeni bir parça eklenmiş — indisler kayar, yollar kalır.
function revizyon() {
  const t = S.GUC.takozlar;
  const p = [S.GUC.sanziman, { id: 'PTO', ad: 'PTO', sekil: 'kutu', olcu: [100, 100, 100], konum: [200, 300, 500] }, S.GUC.motor,
    t[0], t[1], t[2], Object.assign({}, t[3], { ornek: 'TK-SOL-ARKA.2' })]
    .concat(S.GUC.braket.parcalar.map((b) => Object.assign({ alt: S.GUC.braket.id }, b)));
  return S.guçGrubuStep(p, { altMontajlar: [{ id: S.GUC.braket.id, ad: S.GUC.braket.ad, konum: S.GUC.braket.konum }] });
}

beforeEach(() => {
  resetStubs(stubs);
  W._mwStpSifirla();
  modul('mod-1');
});
afterEach(() => { delete global.veMntStack; delete global.veTabs; delete global.veActiveTabIdx; });

// ── KAYIT — saf çekirdek (js/mount-step.js) ────────────────────────────────
describe('KAYIT — roller projeye örnek yoluyla', () => {
  const P = () => STP.veMntStpOku(S.gucGrubu());

  test('yol kökten düğüme örnek adları; kök boş yol; anahtar okuyucunun anahtarıyla aynı ayrımda', () => {
    const p = P();
    const i = (a) => p.agac.filter((d) => d.ad === a)[0].i;
    expect(STP.veMntStpYol(p, 0)).toEqual([]);
    expect(STP.veMntStpYol(p, i('Motor bloğu'))).toEqual(['MOTOR.1']);
    expect(STP.veMntStpYol(p, i('Braket üst'))).toEqual(['BRAKET_ASM.1', 'BRK-UST.1']);
  });

  test('imza aynı dosyada aynı; bir örnek adı değişince farklı; sayılar imzada', () => {
    expect(STP.veMntStpImza(P())).toBe(STP.veMntStpImza(P()));
    expect(STP.veMntStpImza(P())).toMatch(/^[0-9a-f]{8}-10-8$/);
    expect(STP.veMntStpImza(STP.veMntStpOku(revizyon()))).not.toBe(STP.veMntStpImza(P()));
  });

  test('kayıt yalnız rollü düğümler, ağaç sırasıyla; kütle yalnız yazılmışsa; dosya künyesi', () => {
    const p = P(), r = p.agac.map(() => null), m = {};
    const i = (a) => p.agac.filter((d) => d.ad === a)[0].i;
    r[i('Arka braket')] = 'mnt-bracket'; r[i('Motor bloğu')] = 'mnt-motor';
    m[i('Motor bloğu')] = 412; m[i('Şanzıman gövdesi')] = 99;   // rolsüz düğümün kütlesi yazılmaz
    const k = STP.veMntStpRolKaydi(p, r, m, { dosya: 'g.stp', bayt: 2048 });
    expect(k).toEqual({ surum: 1, dosya: 'g.stp', bayt: 2048, imza: STP.veMntStpImza(p), parca: 8, roller: [
      { yol: ['MOTOR.1'], rol: 'mnt-motor', ad: 'Motor bloğu', kg: 412 },
      { yol: ['BRAKET_ASM.1'], rol: 'mnt-bracket', ad: 'Arka braket' }] });
    expect(JSON.stringify(k)).not.toMatch(/ISO-10303|FACE|#\d+=/);   // dosyanın kendisi yok
  });

  test('AYNI DOSYA: roller ve kütleler aynı indislere, imza aynı', () => {
    const p = P(), r = p.agac.map(() => null);
    p.agac.forEach((d) => { if (/takoz$/.test(d.ad)) r[d.i] = 'mnt-mount'; });
    const k = STP.veMntStpRolKaydi(p, r, {}, {});
    const u = STP.veMntStpRolKaydiUygula(P(), k);
    expect(u.roller).toEqual(r);
    expect([u.eslesen, u.toplam, u.eksik.length, u.ayni]).toEqual([4, 4, 0, true]);
  });

  test('DEĞİŞEN DOSYA: indisler kayar, yollar eşleşir; adı değişen örnek EKSİK sayılır', () => {
    const p = P(), r = p.agac.map(() => null), m = {};
    p.agac.forEach((d) => { if (/takoz$/.test(d.ad)) r[d.i] = 'mnt-mount'; if (ROLLER[d.ad]) r[d.i] = ROLLER[d.ad]; });
    m[p.agac.filter((d) => d.ad === 'Motor bloğu')[0].i] = 412;
    const k = STP.veMntStpRolKaydi(p, r, m, {});
    const q = STP.veMntStpOku(revizyon());
    const u = STP.veMntStpRolKaydiUygula(q, k);
    const i = (a) => q.agac.filter((d) => d.ad === a)[0].i;
    expect(i('Motor bloğu')).not.toBe(p.agac.filter((d) => d.ad === 'Motor bloğu')[0].i);   // indis gerçekten kaydı
    expect([u.eslesen, u.toplam, u.ayni]).toEqual([6, 7, false]);
    expect(u.eksik.map((x) => x.yol.join('/'))).toEqual(['TK-SOL-ARKA.1']);
    expect(u.roller[i('Motor bloğu')]).toBe('mnt-motor');
    expect(u.roller[i('Arka braket')]).toBe('mnt-bracket');
    expect(u.roller[i('PTO')]).toBe(null);
    expect(u.kutle).toEqual({ [i('Motor bloğu')]: 412 });
  });

  test('bilinmeyen rol ve bozuk satır eksik; ata ile torun ikisi de kayıtlıysa sonraki kazanır, düşenin kütlesi gider', () => {
    const p = P();
    const i = (a) => p.agac.filter((d) => d.ad === a)[0].i;
    const u = STP.veMntStpRolKaydiUygula(p, { roller: [
      { yol: ['BRAKET_ASM.1', 'BRK-UST.1'], rol: 'mnt-bracket', kg: 5 },
      { yol: ['BRAKET_ASM.1'], rol: 'mnt-bracket' },
      { yol: ['MOTOR.1'], rol: 'fead-crank' },
      { rol: 'mnt-motor' }] });
    expect(u.roller[i('Arka braket')]).toBe('mnt-bracket');
    expect(u.roller[i('Braket üst')]).toBe(null);
    expect(u.kutle).toEqual({});
    expect([u.eslesen, u.eksik.length]).toEqual([1, 2]);
    expect(STP.veMntStpRolKaydiUygula(p, null).eslesen).toBe(0);
  });
});

// ── OTURUM ↔ KAYIT (js/cp-mount-wizard.js) ───────────────────────────────
describe('OTURUM ↔ KAYIT — rol ve kütle 3D Görüntüleyici\'ye, dosya değil', () => {
  test('rol ve kütle her değişimde kayda yazılır; geri-al adımı DEĞİL; rolü düşenin kütlesi de düşer', () => {
    const s = W.veMntWizStpOku(S.gucGrubu(), 'guc.stp', 'duz');
    expect(ev.data.cad).toBeUndefined();                        // okumak kayıt değil
    rolVer(s);
    expect(ev.data.cad.roller.map((r) => r.rol)).toEqual(['mnt-motor', 'mnt-gearbox', 'mnt-mount', 'mnt-mount', 'mnt-mount', 'mnt-mount', 'mnt-bracket']);
    expect(ev.data.cad.dosya).toBe('guc.stp');
    expect(global.saveState).not.toHaveBeenCalled();
    W.veMntWizStpHesapla();
    const mot = dugumi(s, 'Motor bloğu');
    W.veMntWizStpKutle(mot, '412');
    expect(ev.data.cad.roller[0].kg).toBe(412);
    W.veMntWizStpRol(mot, '');
    expect(s.kutle[mot]).toBeUndefined();
    expect(ev.data.cad.roller.map((r) => r.rol)).not.toContain('mnt-motor');
  });

  test('AYNI DOSYA yeniden okununca roller ve kütleler geri gelir; durum "Kayıtlı roller: 7 / 7"', () => {
    const s = W.veMntWizStpOku(S.gucGrubu(), 'guc.stp', 'duz');
    rolVer(s);
    W.veMntWizStpHesapla();
    W.veMntWizStpKutle(dugumi(s, 'Motor bloğu'), '412');
    const once = ad(s);
    W.veMntWizStpKapat();
    expect(W.veMntWizStp()).toBe(null);
    expect(ev.data.cad.roller).toHaveLength(7);                 // dosya kalktı, kayıt kaldı
    const t = W.veMntWizStpOku(S.gucGrubu(), 'guc.stp', 'duz');
    expect(ad(t)).toEqual(once);
    expect(t.kutle).toEqual({ [dugumi(t, 'Motor bloğu')]: 412 });
    expect(W.veMntWizStpKayitDurum(t)).toEqual({ tur: 'ok', metin: 'Kayıtlı roller: 7 / 7' });
    expect(t.kayit.ayni).toBe(true);
  });

  test('BAŞKA DOSYA kaydı silmez — rol verilene dek; sonra kayıt onunki', () => {
    const s = W.veMntWizStpOku(S.gucGrubu(), 'guc.stp', 'duz');
    rolVer(s);
    const kayit = JSON.stringify(ev.data.cad);
    const t = W.veMntWizStpOku(S.tekrarliMontaj(), 'baska.stp', 'duz');
    expect(rollu(t)).toBe(0);
    expect(W.veMntWizStpKayitDurum(t)).toEqual({ tur: 'warn', metin: 'Kayıtlı roller başka bir dosyanın (guc.stp).' });
    W.veMntWizStpKayitTazele();                                  // geri-al / kayıt yolu da yazmaz
    expect(JSON.stringify(ev.data.cad)).toBe(kayit);
    W.veMntWizStpRol(dugumi(t, 'Gövde'), 'mnt-motor');
    expect(ev.data.cad.dosya).toBe('baska.stp');
    expect(ev.data.cad.roller).toHaveLength(1);
  });

  test('DEĞİŞEN DOSYA: eşleşenler gelir, durum kaç rolün olmadığını söyler; kayıt ilk rol değişimine dek korunur', () => {
    const s = W.veMntWizStpOku(S.gucGrubu(), 'guc.stp', 'duz');
    rolVer(s);
    const t = W.veMntWizStpOku(revizyon(), 'guc-r2.stp', 'duz');
    expect(rollu(t)).toBe(6);
    expect(W.veMntWizStpKayitDurum(t)).toEqual({ tur: 'warn', metin: 'Kayıtlı roller: 6 / 7 — 1 rol bu dosyada yok.' });
    expect(ev.data.cad.roller).toHaveLength(7);
    W.veMntWizStpRol(dugumi(t, 'PTO'), 'mnt-pto');
    expect(ev.data.cad.roller).toHaveLength(7);                 // 6 eşleşen + PTO
    expect(ev.data.cad.dosya).toBe('guc-r2.stp');
  });

  test('3D Görüntüleyici yoksa kayıt yazılmaz (sihirbaz akışı: "Modeli Kur" onu kurar)', () => {
    global.nodes = [];
    const s = W.veMntWizStpOku(S.gucGrubu(), 'guc.stp', 'duz');
    rolVer(s);
    expect(W._mwStpKayitYaz(s)).toBe(false);
    global.nodes = [ev];
    expect(W.veMntWizStpKayitTazele()).toBe(true);
    expect(ev.data.cad.roller).toHaveLength(7);
  });

  test('OTURUM MODÜLÜN VE SEKMENİN: başka modülde ya da sekmede görünmez, yazmaz', () => {
    global.veTabs = [{ id: 'tab-1' }, { id: 'tab-2' }]; global.veActiveTabIdx = 0;
    const s = W.veMntWizStpOku(S.gucGrubu(), 'guc.stp', 'duz');
    expect(s.modul).toBe('tab-1/mod-1');
    expect(W.veMntWizStpBurada()).toBe(s);
    global.veActiveTabIdx = 1;                                    // aynı kimlikli modül, başka sekme
    expect(W.veMntWizStpBurada()).toBe(null);
    W.veMntWizStpRol(1, 'mnt-motor');
    expect(ev.data.cad).toBeUndefined();
    global.veActiveTabIdx = 0;
    global.veMntStack = [{ nodeId: 'mod-2' }];
    expect(W.veMntWizStpBurada()).toBe(null);
  });

  test('PROJE DEĞİŞİMİ oturumu düşürür: veResetSubtopoNav ve Yeni proje yolu', () => {
    W.veMntWizStpOku(S.gucGrubu(), 'guc.stp', 'duz');
    W.veMntWizStpUnut();
    expect(W.veMntWizStp()).toBe(null);
    const topo = oku('js/topology.js');
    const reset = topo.slice(topo.indexOf('function veResetSubtopoNav'), topo.indexOf('\n}', topo.indexOf('function veResetSubtopoNav')));
    expect(reset).toMatch(/veMntWizStpUnut\(\)/);
    const tb = oku('js/toolbar.js');
    const yeni = tb.slice(tb.indexOf('var doNew = function'), tb.indexOf('veAddTab(', tb.indexOf('var doNew = function')));
    expect(yeni).toMatch(/veResetSubtopoNav\(\)/);
    const kaydet = tb.slice(tb.indexOf('function veSaveTopology'), tb.indexOf('veSaveActiveTabState', tb.indexOf('function veSaveTopology')));
    expect(kaydet).toMatch(/veMntWizStpKayitTazele\(\)/);       // kayıt sekme yazılmadan ÖNCE tazelenir
  });
});

// ── PENCERE (js/cp-mount-cad.js) ──────────────────────────────────────────
describe('PENCERE — kitin bölümleri, tek eylem, sihirbazla AYNI üreticiler', () => {
  const dom = () => { const d = document.createElement('div'); d.innerHTML = CAD.getMntViewerPropertiesHTML(ev); return d; };
  const kat = (d) => [...d.querySelectorAll('.ve-fp-govde > .ve-fp-kat')].map((k) => k.getAttribute('data-k'));
  const eylem = (d) => {
    const e = d.querySelectorAll('.ve-fp-solve');
    expect(e.length).toBe(1);
    expect(d.querySelector('.ve-fp-side > .ve-fp-yurut:last-child > .ve-fp-solve')).toBe(e[0]);
    return e[0];
  };
  const basliklar = (d) => [...d.querySelectorAll('.ve-fp-govde > .ve-fp-kat')].every((k) => k.querySelector('.ve-fp-sect > b'));

  test('dosyasız: tek bölüm, bırakma alanı ve yönlendirme; eylem dosya seçici; sahne kurulmaz', () => {
    const d = dom();
    expect(kat(d)).toEqual(['dosya']);
    expect(basliklar(d)).toBe(true);
    expect(d.querySelector('[data-ve-dropzone="step"][ondrop^="veMntCadDrop"]')).not.toBeNull();
    expect(d.querySelector('[data-ve-yon]') || d.textContent.indexOf('STEP dosyasını seçin ya da buraya bırakın.') >= 0).toBeTruthy();
    const e = eylem(d);
    expect([e.tagName, e.id, e.getAttribute('onclick')]).toEqual(['BUTTON', 've-mnt-cad-sec', 'veMntCadSec()']);
    expect(d.querySelectorAll('input[type="file"], canvas, svg.ve-mnt2d-akso').length).toBe(0);   // gizli girdi yok
    // Seçici anlık girdi kurar; seçilen dosya pencerenin yoluyla okunur
    const tikla = jest.spyOn(HTMLInputElement.prototype, 'click').mockImplementation(function () { this.__tik = true; });
    const oku0 = global.veMntWizStpDosya, cagri = [];
    global.veMntWizStpDosya = (f, yer) => { cagri.push([f.name, yer]); return null; };
    try {
      let girdi = null;
      const kur = document.createElement.bind(document);
      const yakala = jest.spyOn(document, 'createElement').mockImplementation((t) => { const el = kur(t); if (t === 'input') girdi = el; return el; });
      expect(CAD.veMntCadSec()).toBe(true);
      yakala.mockRestore();
      expect([girdi.type, girdi.accept, girdi.__tik]).toEqual(['file', CAD.VE_MNT_CAD_UZANTI, true]);
      Object.defineProperty(girdi, 'files', { value: [new File(['x'], 'tulga.stp')] });
      girdi.dispatchEvent(new Event('change'));
      expect(cagri).toEqual([['tulga.stp', 'pencere']]);
    } finally { tikla.mockRestore(); global.veMntWizStpDosya = oku0; }
  });

  test('kayıtlı roller, dosya açık değil: künye + föy; yönlendirme rollerin dosyasını ister', () => {
    ev.data.cad = { surum: 1, dosya: 'tulga.stp', bayt: 440401920, imza: 'x', parca: 11694, roller: [
      { yol: ['MOTOR.1'], rol: 'mnt-motor', ad: 'Motor', kg: 1120 }, { yol: ['TK.1'], rol: 'mnt-mount', ad: 'Sağ ön' }] };
    const d = dom();
    expect(kat(d)).toEqual(['dosya', 'kayit']);
    expect(d.querySelector('[data-mnt-cad-kayit]').textContent).toMatch(/tulga\.stp\s+11\.694 parça · 2 rol · 420 MB/);
    const satir = [...d.querySelectorAll('.ve-fp-kat[data-k="kayit"] tbody tr')].map((r) => [...r.cells].map((c) => c.textContent));
    expect(satir).toEqual([['Motor', 'Motor', '1.120,0'], ['Sağ ön', 'Takoz', '—']]);
    expect(d.textContent).toMatch(/Rollerin STEP dosyasını seçin ya da buraya bırakın\./);
  });

  test('okunurken: eylem çubuk + Vazgeç (nitelikle tazelenir); bölüm dosyanın adını söyler', () => {
    const s = { dosya: 'big.stp', durum: 'okunuyor', modul: W._mwStpAnahtar(), ilerleme: { evre: 'tara', oran: 0.3, bayt: 1, toplam: 10 } };
    global.veMntWizStpBurada = () => s;
    try {
      const d = dom();
      const e = eylem(d);
      expect([e.id, e.hasAttribute('data-durdur'), e.hasAttribute('data-mw-stp-vazgec')]).toEqual(['ve-mnt-cad-vazgec', true, true]);
      expect(d.querySelector('.ve-fp-yurut[data-is] .ve-fp-ilerleme')).not.toBeNull();
      expect(d.querySelector('.ve-fp-kat[data-k="dosya"]').textContent).toMatch(/big\.stp okunuyor…/);
    } finally { global.veMntWizStpBurada = W.veMntWizStpBurada; }
  });

  test('hazır: Parçalar bölümü KARTIN ağacı; hesaptan sonra Kütle; eylem "3B\'de aç"', () => {
    const s = W.veMntWizStpOku(S.gucGrubu(), 'guc.stp', 'duz');
    rolVer(s);
    let d = dom();
    expect(kat(d)).toEqual(['dosya', 'parca']);
    expect(basliklar(d)).toBe(true);
    expect(d.querySelector('.ve-fp-kat[data-k="parca"] .ve-fp-sect em').textContent).toBe('7 rol');
    // Ağaç sihirbazın kartıyla aynı üreticiden: aynı satırlar, aynı seçili roller
    const kart = document.createElement('div'); kart.innerHTML = W._mwStpKartHTML();
    const satir = (x) => [...x.querySelectorAll('table.ve-mw-tbl-stp tr[data-ve-stp]')].map((r) => r.getAttribute('data-ve-stp') + '=' + r.querySelector('select').value);
    expect(satir(d)).toEqual(satir(kart));
    expect(satir(d).filter((x) => !/=$/.test(x))).toHaveLength(7);
    expect(eylem(d).id).toBe('ve-mnt-cad-3b');
    expect(d.querySelector('#ve-mnt-cad-hesapla')).not.toBeNull();
    expect(d.querySelector('#ve-mw-stp-aktar')).toBeNull();        // aktarım sihirbazın işi
    W.veMntWizStpHesapla();
    d = dom();
    expect(kat(d)).toEqual(['dosya', 'parca', 'kutle']);
    expect(d.querySelectorAll('input[data-mw-stp-kutle]')).toHaveLength(3);
    expect(d.querySelector('[data-mw-stp-kayit]')).toBeNull();       // kayıt bu oturumdan: durum satırı yok
  });

  test('aynı dosya yeniden: künyede kaydın durumu; bekleyen hesapta eylem hesap çubuğu + Vazgeç', () => {
    const s = W.veMntWizStpOku(S.gucGrubu(), 'guc.stp', 'duz');
    rolVer(s);
    W.veMntWizStpKapat();
    const t = W.veMntWizStpOku(S.gucGrubu(), 'guc.stp', 'duz');
    let d = dom();
    expect(d.querySelector('[data-mw-stp-kayit="ok"]').textContent.trim()).toBe('Kayıtlı roller: 7 / 7');
    t.hesapBekliyor = { liste: [0], toplam: 1, son: 0 };
    t.agIs = { eksik: () => 1, iste: () => {} };
    d = dom();
    const e = eylem(d);
    expect([e.id, e.hasAttribute('data-mw-stp-hesap-vazgec')]).toEqual(['ve-mnt-cad-hesap-vazgec', true]);
    expect(d.querySelector('.ve-fp-kat[data-k="parca"]').textContent).toMatch(/Hesaplanıyor…/);
    expect(d.querySelector('#ve-mnt-cad-hesapla')).toBeNull();
  });

  test('okunamayan dosya: bölümde sebebi, eylem yine dosya seçici', () => {
    W.veMntWizStpOku('bu bir STEP değil', 'bozuk.stp', 'duz');
    const d = dom();
    expect(d.querySelector('.ve-fp-kat[data-k="dosya"] .ve-fw-issue-err').textContent).toMatch(/bozuk\.stp/);
    expect(eylem(d).id).toBe('ve-mnt-cad-sec');
  });

  test('tip tek kopya; yer tutucu beyanı yok; pencere sonuç taşımaz (Takoz kuralı)', () => {
    expect(componentDefs['mnt-viewer'].maxInstances).toBe(1);
    expect(componentDefs['mnt-viewer'].yerTutucu).toBeUndefined();
    const s = W.veMntWizStpOku(S.gucGrubu(), 'guc.stp', 'duz');
    rolVer(s); W.veMntWizStpHesapla();
    expect(dom().textContent).not.toMatch(/Uygunluk|sehim|Sehim|mod |Hz/);
  });
});

// ── 3B'NİN YERİ (js/cp-mount-3b.js) ───────────────────────────────────────
describe('3B — iki yer (aktarımın kapısı: mount-3b.test.js → ALT DİZİ)', () => {
  const B3 = require('../../js/cp-mount-3b.js');
  test('yerler: sihirbazın kaplaması · pencerenin kendi perdesi (index.html\'de)', () => {
    expect(B3.VE_MW_3B_YER).toEqual({ sihirbaz: { kap: 've-mw-3b', perde: null }, pencere: { kap: 've-mnt-3b', perde: 've-mnt-3b-overlay' } });
    const html = oku('index.html');
    const i = html.indexOf('id="ve-mnt-3b-overlay"');
    expect(i).toBeGreaterThan(0);
    expect(html.slice(i, html.indexOf('</div>\n</div>', i))).toMatch(/id="ve-mnt-3b" class="ve-fw-3b"/);
    expect(html.indexOf('src="js/cp-mount-cad.js"')).toBeGreaterThan(html.indexOf('src="js/cp-mount-3b.js"'));
  });
});

// ── GERİ-AL — gerçek restoreState ────────────────────────────────────────
describe('GERİ-AL — geri yüklenen düğüm canlı oturumun rollerini taşır', () => {
  test('rol değişimi yığına girmez; model geri alınınca kayıt eski anlık görüntünün değil oturumun', () => {
    document.body.innerHTML = '<div id="ve-canvas"></div><svg id="ve-connections-layer"></svg>';
    global.selectedNodes = [];
    global.canvasOffset = { x: 0, y: 0 };
    global.canvasZoom = 1;
    eval(loadSource('state.js'));
    global.saveState = saveState;
    global.updateAllConnections = jest.fn();
    // mount-step/sihirbaz nodes'u GLOBAL'den okur; state.js de
    const n = { id: 'v1', type: 'mnt-viewer', x: 0, y: 0, width: 60, height: 56, def: componentDefs['mnt-viewer'], data: {} };
    const m = { id: 'm1', type: 'mnt-motor', x: 100, y: 0, width: 50, height: 46, def: componentDefs['mnt-motor'], data: { mass: 400 } };
    global.nodes = [n, m];
    undoStack = []; redoStack = [];
    saveState();                                                  // açılış
    const s = W.veMntWizStpOku(S.gucGrubu(), 'guc.stp', 'duz');
    rolVer(s);                                                    // yığına girmez
    expect(undoStack).toHaveLength(1);
    global.nodes[1].data.mass = 500; saveState();                 // model düzenlemesi
    W.veMntWizStpRol(dugumi(s, 'Motor bloğu'), '');               // rol, düzenlemeden SONRA
    undo();                                                       // açılışa: kayıt yoktu
    const v = global.nodes.find((x) => x.type === 'mnt-viewer');
    expect(global.nodes.find((x) => x.type === 'mnt-motor').data.mass).toBe(400);
    expect(v.data.cad.roller).toHaveLength(6);                    // oturumun rolleri, motor yok
    expect(v.data.cad.roller.map((r) => r.rol)).not.toContain('mnt-motor');
    expect(oku('js/state.js').indexOf('veMntWizStpKayitTazele()')).toBeLessThan(oku('js/state.js').indexOf("if(typeof veMufettisTazele === 'function') veMufettisTazele();"));
  });
});
