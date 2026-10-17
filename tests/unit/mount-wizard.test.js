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
  test('roller BOŞ açılır; ata/torun rolü düşer (bir parça tek birime ait)', () => {
    W.veMntWizAc();
    const s = W.veMntWizStpOku(S.gucGrubu(), 'guc.stp', 'duz');
    expect(s.durum).toBe('hazir');
    expect(s.roller.every((r) => r === null)).toBe(true);
    const asm = dugumi(s, 'Arka braket'), ust = dugumi(s, 'Braket üst');
    W.veMntWizStpRol(ust, 'mnt-bracket');
    W.veMntWizStpRol(asm, 'mnt-bracket');
    expect(s.roller[ust]).toBe(null);
    expect(s.roller[asm]).toBe('mnt-bracket');
    expect(W.veMntWizStpRol(asm, 'fead-crank')).toBe(false);     // Takoz rolü değil
  });

  test('hesap → kütle → aktar: sihirbaz STEP\'in durumuyla dolar, "S" işaretleri taşınır', () => {
    W.veMntWizAc();
    const s = stepYukle();
    expect(W.veMntWizStpDenetim(s).engel).toEqual(['Konumlar henüz hesaplanmadı.']);
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
    expect(mot.kaynak).toEqual({ cg: true, I: true });
    expect(st.govdeler[1].kaynak).toEqual({ cg: true });          // kütle yok → atalet yok
    expect(st.takozlar[0].kaynak).toEqual({ konum: true });
    expect(W._mwStpOnizleme()).toBe(false);                      // aktarıldı: masa durumu çizer
    // Elle yazılan değer geometriden geleni geçer: işaret düşer
    W._mwSet('govde.' + mot.key + '.cgx', '-310');
    expect(W.veMntWizState().govdeler[0].kaynak).toEqual({ I: true });
  });

  test('kart: dosya, parça tablosu, hesap ve aktar düğmeleri; az takoz UYARI (engel değil)', () => {
    W.veMntWizAc();
    const s = W.veMntWizStpOku(S.gucGrubu(), 'guc.stp', 'duz');
    W.veMntWizStpRol(dugumi(s, 'Motor bloğu'), 'mnt-motor');
    W.veMntWizStpRol(dugumi(s, 'Sağ ön takoz'), 'mnt-mount');
    W.veMntWizStpHesapla();
    const kap = document.createElement('div');
    kap.innerHTML = W._mwStpKartHTML();
    expect(kap.querySelectorAll('table.ve-mw-tbl-stp tbody tr')).toHaveLength(s.sonuc.agac.length - 1);
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
    expect([takoz.data.x, takoz.data.y, takoz.data.z]).toEqual([-650, 380, 420]);
    expect(W.veMntWizAcik()).toBe(false);
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
