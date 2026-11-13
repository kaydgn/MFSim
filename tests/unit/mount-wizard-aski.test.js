/**
 * mount-wizard-aski.test.js — BAŞLANGIÇ SİHİRBAZI: ŞANZIMAN ASKISI (2026-11-13)
 * ─────────────────────────────────────────────────────────────────────────
 * Kullanıcı: *"'Başlangıç Sihirbazı' kısmında 'askı' özelinde hiç bir ekleme, hiç bir
 * görselleştirme, hiç bir arayüz görmüyorum … Programa 'askılı' seçeneğini entegre eder misin?"*
 *   · SEÇENEK — Takozlar adımında "Şanzıman askısı": Askısız · Askılı; askılıda yaylar (ilk
 *     seçimde sol ve sağ), konum, katalog yayı ya da k · L0 · Lc, kurulum ve karşılığı; askı ile
 *     takozun seçimi birbirini bırakır (adımda tek düzenleyici). Ayrı adım ve talimatı kullanıcının
 *     kararını bekliyor (talimat metni tabana yalnız onun kararıyla girer).
 *   · DENETİM — eksik konum; yay ve kurulum Çözücü'nün kapısıyla AYNI cümle; engel çözümü durdurur
 *   · TUVAL ↔ SİHİRBAZ — Askı Yayı düğümleri duruma, durum düğümlere birebir; Askısız modele girmez
 *   · KURULUM — Modeli kur askı yaylarını kurar, tuvalden açılınca yerinde günceller, Askısız çıkarır
 *   · MASA — 2B'de yandan · önden zikzak, üstten halka, tık askıyı seçer; 3B modelinde askı
 */
const fs = require('fs');
const path = require('path');
const stubs = stubGlobals();
global.nodes = [];
global.connections = [];
eval(loadSource('components.js'));
global.componentDefs = componentDefs;
const core = require('../../js/mount-core.js');
global.veMountCore = core;
const cp = require('../../js/cp-mount.js');
Object.keys(cp).forEach((k) => { if (global[k] === undefined) global[k] = cp[k]; });
Object.assign(global, require('../../js/mount-yay.js'));
global.veSayi = global.veSayi || require('../../js/sayi.js').veSayi;
const W = require('../../js/cp-mount-wizard.js');

const KABUK = '<div id="ve-canvas-wrapper"></div>'
  + '<div id="ve-mntwiz-overlay" style="display:none;"><div class="ve-fw-shell">'
  + '<nav id="ve-mw-nav"></nav><div id="ve-mw-body"></div></div><div id="ve-mw-foot"></div>'
  + '<div id="ve-mw-3b" style="display:none;"></div></div>';
const TAKOZ = W.VE_MW_STEPS.findIndex((s) => s.key === 'takoz');
const TTA = () => JSON.parse(fs.readFileSync(path.join(__dirname, '../../assets/examples/tta10askili_topoloji.json'), 'utf8'));

let k = 0;
beforeEach(() => {
  resetStubs(stubs);
  document.body.innerHTML = KABUK;
  global.nodes = [];
  global.connections = [];
  W._mwTaslakSifirla();
  global.createNode = jest.fn((type, x, y) => {
    const n = { id: 'n' + (++k), type, def: componentDefs[type] || {}, x, y, data: {} };
    global.nodes.push(n);
    return n;
  });
  global._mntRemoveNode = jest.fn((id) => { global.nodes = global.nodes.filter((n) => n.id !== id); });
  global.veStateBatch = jest.fn((fn) => fn());
  global.confirm = jest.fn(() => true);
});
afterEach(() => {
  if (W.veMntWizAcik()) W.veMntWizKapat(false);
  delete global.createNode;
  delete global._mntRemoveNode;
  delete global.veStateBatch;
  delete global.confirm;
});
const govde = () => document.getElementById('ve-mw-body');
const sorun = (st) => W.veMntWizSorunlar(st).filter((s) => s.adim === 'takoz' && /askı/i.test(s.m)).map((s) => s.m);

describe('SEÇENEK — Takozlar adımında Şanzıman askısı', () => {
  test('rayın Takozlar satırı askıyı adlandırır; adım sayısı değişmez', () => {
    expect(W.VE_MW_STEPS.map((s) => s.key)).toEqual(['kaynak', 'govde', 'takoz', 'tork', 'ozet']);
    expect(W.VE_MW_STEPS[TAKOZ].girdi.split(' · ')).toEqual(['Konum', 'katalog', 'rijitlik', 'şanzıman askısı']);
  });
  test('Askısız varsayılan: yalnız seçenek; Askılı ilk seçimde sol ve sağ yayı ekler, takozun düzenleyicisi çekilir', () => {
    W.veMntWizAc();
    W.veMntWizGoto(TAKOZ);
    const seg = () => [...govde().querySelectorAll('.ve-fw-seg[aria-label="Şanzıman askısı"] button')].map((b) => [b.textContent, b.getAttribute('aria-pressed')]);
    expect(seg()).toEqual([['Askısız', 'true'], ['Askılı', 'false']]);
    expect(govde().querySelector('#ve-mw-aski-liste')).toBeNull();
    expect(sorun(W.veMntWizState())).toEqual([]);
    W.veMntWizAskili(true);
    expect(seg()).toEqual([['Askısız', 'false'], ['Askılı', 'true']]);
    expect(W.veMntWizState().askilar.map((a) => a.ad)).toEqual(['Sol askı yayı', 'Sağ askı yayı']);
    expect([...govde().querySelectorAll('#ve-mw-aski-liste [data-mw-satir]')].length).toBe(2);
    expect([...govde().querySelectorAll('.ve-fw-card-h')].map((h) => h.textContent))
      .toEqual(['Takozlar', 'Şanzıman askısı', 'Askı yayları', 'Seçili askı yayı']);
    const ed = govde().querySelectorAll('.ve-mw-ed')[0];
    expect([...ed.querySelectorAll('.ve-mw-ed-bas')].map((b) => b.textContent)).toEqual(['Kimlik', 'Konum [mm]', 'Yay', 'Kurulum']);
    expect([...ed.querySelectorAll('select[aria-label="Yay kataloğu"] option')].map((o) => o.value)).toEqual(['', 'tta-aski']);
    expect([...ed.querySelectorAll('select[aria-label="Kurulum biçimi"] option')].map((o) => o.value)).toEqual(['kuvvet', 'boy', 'tasarim']);
    // ikinci kez Askılı: çift ikinci kez eklenmez; Askısız liste durur, modele girmez
    W.veMntWizAskili(false); W.veMntWizAskili(true);
    expect(W.veMntWizState().askilar.length).toBe(2);
    W.veMntWizAskiEkle();
    expect(W.veMntWizState().askilar.map((a) => a.ad)).toEqual(['Sol askı yayı', 'Sağ askı yayı', 'Askı yayı 3']);
    W.veMntWizAskiSil(W.veMntWizState().askilar[2].key);
    expect(W.veMntWizState().askilar.length).toBe(2);
    // takoz seçilince askının düzenleyicisi çekilir, tersi de
    W.veMntWizTakozEkle();
    expect([...govde().querySelectorAll('.ve-fw-card-h')].map((h) => h.textContent))
      .toEqual(['Takozlar', 'Seçili takoz', 'Şanzıman askısı', 'Askı yayları']);
    W.veMntWizSec('aski', W.veMntWizState().askilar[1].key);
    expect([...govde().querySelectorAll('.ve-fw-card-h')].map((h) => h.textContent))
      .toEqual(['Takozlar', 'Şanzıman askısı', 'Askı yayları', 'Seçili askı yayı']);
  });
});

describe('DENETİM — konum, yay ve kurulum', () => {
  test('boş yaylar: konum ve yay sabiti eksik; Çözücü\'nün cümlesi', () => {
    const st = W.veMntWizDefault();
    st.askili = true;
    st.askilar = [{ key: 'a1', ad: 'Sol askı yayı', kurulum: 'kuvvet' }];
    expect(sorun(st)).toEqual(['Sol askı yayı: konum eksik.', 'Sol askı yayı: yay sabiti girilmedi.', 'Sol askı yayı: serbest boy girilmedi.']);
    st.askilar = [];
    expect(sorun(st)).toEqual(['Askı yayı yok.']);
    st.askili = false;
    expect(sorun(st)).toEqual([]);
  });
  test('katalog yayı ve kurulum: karşılık ve blok boyu denetimi', () => {
    W.veMntWizAc();
    W.veMntWizAskili(true);
    const a = W.veMntWizState().askilar[0];
    W.veMntWizAskiYay(a.key, 'tta-aski');
    expect(a).toMatchObject({ yay: 'tta-aski', k: 57.39, L0: 90, Lc: 63, d: 9, D: 61, n: 5, Rm: 1481 });
    Object.assign(a, { x: 1365, y: -350, z: 672.5, montajF: 80 });
    expect(W._mwAskiKarsi(a)).toBe('76,33');                               // L = 90 − 80·9,81/57,39
    a.montajF = 300;                                                       // 90 − 51,3 < 63: blok
    expect(sorun(W.veMntWizState())).toContain('Sol askı yayı: montaj kuvveti yayı blok boyuna indiriyor.');
    W.veMntWizAskiKurulum(a.key, 'tasarim'); a.tasarimL = 74;
    expect(W._mwAskiKarsi(a)).toBe('93,6');                                // 57,39·16/9,81 kgf
    W.veMntWizAskiKurulum(a.key, 'yok');
    expect(a.kurulum).toBe('tasarim');
  });
});

describe('TUVAL ↔ SİHİRBAZ — Askı Yayı düğümleri', () => {
  test('10 Ton TTA askılı: iki askı birebir duruma, durumdan düğüme; Askısız modele girmez', () => {
    const T = TTA();
    const st = W.veMntWizFromNodes(T.nodes);
    expect(st.askili).toBe(true);
    expect(st.askilar.map((a) => a.ad)).toEqual(['Sol askı yayı', 'Sağ askı yayı']);
    const asT = T.nodes.filter((n) => n.type === 'mnt-aski');
    const out = W.veMntWizNodes(st).filter((n) => n.type === 'mnt-aski');
    expect(out.map((n) => n.customName)).toEqual(asT.map((n) => n.customName));
    out.forEach((n, i) => {
      const beklenen = {};
      W.VE_MW_ASKI_ALAN.forEach((f) => { if (asT[i].data[f] !== undefined) beklenen[f] = asT[i].data[f]; });
      expect(n.data).toEqual(beklenen);
      expect(n.rol).toBe('aski');
    });
    st.askili = false;
    expect(W.veMntWizNodes(st).some((n) => n.type === 'mnt-aski')).toBe(false);
    expect(st.askilar.length).toBe(2);
  });
  test('örneğin kaydı (topolojisiz yol) askıları da taşır', () => {
    const liste = W._mwOrnekModelden(core.getMountExample('tta10askili').model);
    const st = W.veMntWizFromNodes(liste);
    expect(st.askilar.map((a) => [a.ad, a.yay, a.kurulum, a.montajF, a.k])).toEqual([
      ['Sol askı yayı', 'tta-aski', 'kuvvet', 80, 57.39], ['Sağ askı yayı', 'tta-aski', 'kuvvet', 80, 57.39]]);
  });
  test('canlı çözüm askıyla; eksik yay çözümü durdurur', () => {
    const st = W.veMntWizFromNodes(TTA().nodes);
    expect(W.veMntWizCoz(st).ok).toBe(true);
    delete st.askilar[0].k;
    const c = W.veMntWizCoz(st);
    expect(c.ok).toBe(false);
    expect(W.veMntWizIssues(c, TAKOZ).map((s) => s.m)).toContain('Sol askı yayı: yay sabiti girilmedi.');
  });
});

describe('KURULUM — Modeli kur askı yaylarını kurar', () => {
  test('boştan: iki Askı Yayı düğümü, verisiyle; bildirim sayar', () => {
    W.veMntWizAc();
    const st = W.veMntWizFromNodes(TTA().nodes);
    Object.assign(W.veMntWizState(), st);
    W.veMntWizKur();
    const as = global.nodes.filter((n) => n.type === 'mnt-aski');
    expect(as.map((n) => n.data.montajF)).toEqual([80, 80]);
    expect(as.map((n) => [n.data.x, n.data.y, n.data.z])).toEqual(st.askilar.map((a) => [a.x, a.y, a.z]));
    expect(stubs.showToast.mock.calls.pop()[0]).toMatch(/· 2 askı yayı$/);
  });
  test('tuvalden açılınca yerinde günceller; Askısız seçilirse çıkarır', () => {
    W.veMntWizAc();
    Object.assign(W.veMntWizState(), W.veMntWizFromNodes(TTA().nodes));
    W.veMntWizKur();
    const ilk = global.nodes.filter((n) => n.type === 'mnt-aski').map((n) => n.id);
    W.veMntWizAc();
    expect(W.veMntWizState().askilar.map((a) => a._dugum)).toEqual(ilk);
    W.veMntWizState().askilar[0].montajF = 85;
    W.veMntWizKur();
    expect(global.nodes.filter((n) => n.type === 'mnt-aski').map((n) => [n.id, n.data.montajF])).toEqual([[ilk[0], 85], [ilk[1], 80]]);
    W.veMntWizAc();
    W.veMntWizAskili(false);
    expect(W._mwKurulumPlani().sil).toBe(2);
    W.veMntWizKur();
    expect(global.nodes.some((n) => n.type === 'mnt-aski')).toBe(false);
  });
});

describe('MASA — 2B ve 3B askıyı çizer', () => {
  test('2B: yandan ve önden zikzak, üstten halka; seçilen askının halkası; tık askıyı seçer', () => {
    const st = W.veMntWizFromNodes(TTA().nodes);
    const veri = cp._mnt2DGather(W.veMntWizNodes(st));
    expect(veri.askilar.map((a) => [a.name, Math.round(a.L * 100) / 100])).toEqual([['Sol askı yayı', 76.33], ['Sağ askı yayı', 76.33]]);
    const d = document.createElement('div');
    d.innerHTML = cp.veMnt2BSayfa(veri, 900, 600, { secim: true, secili: { tur: 'aski', i: 1 } }).svg;
    const g = (p) => [...d.querySelectorAll('[data-mnt2b="' + p + '"] g.ve-mnt2d-aski')];
    expect(g('yan').map((x) => x.getAttribute('data-mnt-sec'))).toEqual(['aski:0', 'aski:1']);
    expect(g('yan').every((x) => x.querySelector('polyline'))).toBe(true);
    expect(g('on').every((x) => x.querySelector('polyline'))).toBe(true);
    expect(g('ust').some((x) => x.querySelector('polyline'))).toBe(false);
    expect(d.querySelectorAll('circle[stroke="var(--accent-primary)"][r="11"]').length).toBe(3);   // seçilen: üç görünüşte
    W.veMntWizAc();
    Object.assign(W.veMntWizState(), st);
    W._mwMasaSec('aski:1');
    expect(W.VE_MW_STEPS[[...document.querySelectorAll('.ve-fw-step')].findIndex((li) => li.classList.contains('on'))].key).toBe('takoz');
    expect(document.querySelector('#ve-mw-aski-liste .ve-fw-kl.on').getAttribute('data-mw-satir')).toBe(st.askilar[1].key);
    expect(document.querySelector('#ve-mw-liste .ve-fw-kl.on')).toBeNull();
    W._mwMasaSec('takoz:0');
    expect(document.querySelector('#ve-mw-aski-liste .ve-fw-kl.on')).toBeNull();
  });
  test('3B: düğüm listesinde askılar, modelin askısı; gösterge askıyı adlandırır', () => {
    const st = W.veMntWizFromNodes(TTA().nodes);
    const liste = W._mwAksoDugumler(st);
    expect(liste.filter((n) => n.rol === 'aski').map((n) => n.id)).toEqual(st.askilar.map((a) => 'mw:' + a.key));
    const P = cp.veMntAksoListeVeri(liste);
    expect(P.M.g.askilar.map((a) => a.id)).toEqual(st.askilar.map((a) => 'mw:' + a.key));
  });
  test('özet: Askı yayı satırı; çip askıyı sayar', () => {
    W.veMntWizAc();
    Object.assign(W.veMntWizState(), W.veMntWizFromNodes(TTA().nodes));
    W.veMntWizGoto(W.VE_MW_STEPS.length - 1);
    const reads = [...govde().querySelectorAll('.ve-fw-read')].map((r) => r.textContent);
    expect(reads).toContain('Askı yayı2');
    expect(document.getElementById('ve-mw-live').textContent).toContain('askı 2');
  });
});
