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

// KATALOG LİSTESİ = TAKOZ PENCERESİNİN EŞLEŞMESİ (kullanıcı turu 2026-10-19):
// örnekten doldurulan satır bağsız gelir; liste "— katalogdan seç —" derken
// satırın altı rijitliği bir tiple birebir aynıydı (ASFAT'ta 6/6 satır).
describe('KATALOG LİSTESİ — örnekten doldurulan satır tipini gösterir', () => {
  test('ASFAT: altı satırın listesi Takoz penceresinin eşleşmesi; bir değer değişince boş seçim', () => {
    const fs = require('fs'), path = require('path');
    const T = JSON.parse(fs.readFileSync(path.join(__dirname, '../../assets/examples/asfat_topoloji.json'), 'utf8'));
    const st = W.veMntWizFromNodes(T.nodes);
    expect(st.takozlar.length).toBe(6);
    expect(st.takozlar.every((t) => !t.libKey)).toBe(true);
    const sec = (t) => { const d = document.createElement('div'); d.innerHTML = W._mwKatalogSecHTML(t); return d.querySelector('select').value; };
    expect(st.takozlar.map(sec)).toEqual(st.takozlar.map((t) => cp._mntKutuphaneEslesme({ data: t }).e.key));
    expect([...new Set(st.takozlar.map(sec))].sort()).toEqual(['57RS313773-sr116', '57RS313774-sr116']);
    st.takozlar[0].kzs = 999;
    expect(sec(st.takozlar[0])).toBe('');
  });
});

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

// OKUMA ARAYÜZÜ KİLİTLEMEZ (kökteki kural; Takoz STEP adım 2): kart okunurken
// ilerlemeyi ve Vazgeç'i taşır; Vazgeç, başka dosya ve sihirbazın kapanması
// süren okumayı bırakır. Okumanın dilimleri js/step-p21.js'te
// (tests/unit/step-p21.test.js → DİLİMLİ).
describe('STEP OKUMASI — çubuk, Vazgeç, bırakma', () => {
  const PK = require('../../js/pencere-kabuk.js');
  beforeAll(() => {
    global.vePencereEylem = PK.vePencereEylem;
    global.vePencereIlerleme = PK.vePencereIlerleme;
    global.vePencereIlerlemeHTML = PK.vePencereIlerlemeHTML;
    global.veSayi = global.veSayi || require('../../js/sayi.js').veSayi;
  });
  afterAll(() => { delete global.vePencereEylem; delete global.vePencereIlerleme; delete global.vePencereIlerlemeHTML; });
  // Baytları sonradan verilen dosya (okunurken durum gözlenebilsin)
  const bekleyen = (ad, metin) => {
    let ver;
    const p = new Promise((ok) => { ver = () => ok(Uint8Array.from(Buffer.from(metin, 'utf8')).buffer); });
    return { dosya: { name: ad, arrayBuffer: () => p }, ver };
  };
  const kart = () => { const d = document.createElement('div'); d.innerHTML = W._mwStpKartHTML(); return d; };

  test('okunurken: çubuk + Vazgeç, kart dosyayı adıyla söyler; bitince parça tablosu ve toplam süre', async () => {
    W.veMntWizAc();
    const f = bekleyen('guc.stp', S.gucGrubu());
    const bitis = W.veMntWizStpDosya(f.dosya);
    expect(W.veMntWizStp().durum).toBe('okunuyor');
    let k = kart();
    expect(k.querySelector('.ve-fw-stp-wait b').textContent).toBe('guc.stp');
    const cubuk = k.querySelector('.ve-fp-yurut[data-is] .ve-fp-ilerleme[role="progressbar"]');
    expect(cubuk).not.toBeNull();
    expect(cubuk.getAttribute('aria-label')).toBe('STEP okuma');
    expect(k.querySelector('#ve-mw-stp-vazgec').textContent.trim()).toBe('Vazgeç');
    f.ver();
    const s = await bitis;
    expect(s.durum).toBe('hazir');
    expect(W.veMntWizStp()).toBe(s);
    expect(s.sonuc.sureMs.toplam).toBeGreaterThanOrEqual(0);
    k = kart();
    expect(k.querySelector('#ve-mw-stp-vazgec')).toBeNull();
    expect(k.querySelectorAll('table.ve-mw-tbl-stp tbody tr')).toHaveLength(s.sonuc.agac.length - 1);
  });

  test('çubuğun verisi evreden: dosya · açma · kayıtlar (MB) · montaj ağacı · parçalar', () => {
    const v = (o) => W._mwStpIlerlemeVeri({ ilerleme: o }).metin;
    const MB = 1048576;
    expect(v({ evre: 'dosya', bayt: 212 * MB, toplam: 403 * MB })).toBe('Dosya 212 / 403 MB');
    expect(v({ evre: 'ac', bayt: 120 * MB, toplam: 403 * MB })).toBe('Açma 120 / 403 MB');
    expect(v({ evre: 'tara', bayt: 1.5 * MB, toplam: 3 * MB })).toBe('Kayıtlar 1,5 / 3,0 MB');
    expect(v({ evre: 'montaj' })).toBe('Montaj ağacı');
    expect(v({ evre: 'agac', parca: 4512, parcaToplam: 11694 })).toBe('Parçalar 4.512 / 11.694');
  });

  test('Vazgeç: kart boşalır; dosya sonradan okunsa da sonuç yazılmaz', async () => {
    W.veMntWizAc();
    const f = bekleyen('guc.stp', S.gucGrubu());
    const bitis = W.veMntWizStpDosya(f.dosya);
    expect(W.veMntWizStpVazgec()).toBe(true);
    expect(W.veMntWizStp()).toBeNull();
    expect(W._mwStpKartHTML()).toMatch(/STEP dosyası seç/);
    f.ver();
    expect(await bitis).toBeNull();
    expect(W.veMntWizStp()).toBeNull();
    expect(W.veMntWizStpVazgec()).toBe(false);                 // süren okuma yok
  });

  // Saat her okumada 1 ms ilerler: okuma kesin olarak birçok dilim sürer;
  // Vazgeç ilk ilerlemede basılır.
  test('okuma sürerken: Vazgeç işi bırakır (okuyucunun vazgec\'i çağrılır, ilerleme durur)', async () => {
    W.veMntWizAc();
    let t = 0;
    jest.spyOn(performance, 'now').mockImplementation(() => (t += 1));
    const asil = global.veMntStpOkuDilimli;
    let is = null, il = 0;
    global.veMntStpOkuDilimli = (b, bildir) => {
      is = asil(b, (o) => { il++; bildir(o); if (il === 1) W.veMntWizStpVazgec(); });
      jest.spyOn(is, 'vazgec');
      return is;
    };
    try {
      const f = bekleyen('guc.stp', S.gucGrubu());
      const bitis = W.veMntWizStpDosya(f.dosya);
      f.ver();
      expect(await bitis).toBeNull();
      expect(is.vazgec).toHaveBeenCalledTimes(1);
      expect(il).toBe(1);
      expect(W.veMntWizStp()).toBeNull();
    } finally { global.veMntStpOkuDilimli = asil; jest.restoreAllMocks(); }
  });

  test('başka dosya seçmek süren okumayı bırakır; son seçilen okunur, eskisi hiç ayrıştırılmaz', async () => {
    W.veMntWizAc();
    const asil = global.veMntStpOkuDilimli, oku = jest.fn(asil);
    global.veMntStpOkuDilimli = oku;
    try {
      const a = bekleyen('eski.stp', S.gucGrubu());
      const b = bekleyen('yeni.stp', S.gucGrubu());
      const ba = W.veMntWizStpDosya(a.dosya);
      const bb = W.veMntWizStpDosya(b.dosya);
      b.ver(); a.ver();
      expect(await ba).toBeNull();
      expect((await bb).dosya).toBe('yeni.stp');
      expect(W.veMntWizStp().dosya).toBe('yeni.stp');
      expect(oku).toHaveBeenCalledTimes(1);
    } finally { global.veMntStpOkuDilimli = asil; }
  });

  test('sihirbaz kapanınca süren okuma bırakılır', async () => {
    W.veMntWizAc();
    const f = bekleyen('guc.stp', S.gucGrubu());
    const bitis = W.veMntWizStpDosya(f.dosya);
    W.veMntWizKapat(false);
    expect(W.veMntWizStp()).toBeNull();
    f.ver();
    expect(await bitis).toBeNull();
    expect(W.veMntWizStp()).toBeNull();
  });

  test('okunamayan dosya: kart hata durumunda, sebep adresli', async () => {
    W.veMntWizAc();
    const s = await W.veMntWizStpDosya({ name: 'kotu.stp', arrayBuffer: () => Promise.reject(new Error('izin yok')) });
    expect(s.durum).toBe('hata');
    expect(s.hata).toBe('Dosya okunamadı: izin yok');
    const z = await W.veMntWizStpDosya({ name: 'yarim.stpZ', arrayBuffer: () => Promise.resolve(Uint8Array.from([0x1f, 0x8b, 8, 0, 0]).buffer) });
    expect(z.durum).toBe('hata');
    expect(z.hata).toMatch(/gzip/);
  });
});

// AĞAÇ DAL DAL (kullanıcının montajı ~11.700 parça): her satırı rol listesiyle
// çizmek kartı 6,6 sn donduruyordu ve kart her rol değişiminde yeniden
// kuruluyor (ölçüldü). Küçük montaj eskisi gibi tam açık gelir.
describe('AĞAÇ DAL DAL — büyük montajda üst düzeyler, sayfa sayfa', () => {
  // kök → A (300 parça) · B (10 parça) · iki kök parçası: 315 satır > sınır
  function buyuk() {
    const alt = [{ id: 'ALT_A', ad: 'Alt montaj A', konum: [0, 0, 0] }, { id: 'ALT_B', ad: 'Alt montaj B', konum: [2000, 0, 0] }];
    const p = [];
    for (let i = 0; i < 300; i++) p.push({ id: 'A' + i, ad: 'A parça ' + i, sekil: 'kutu', olcu: [20, 20, 20], konum: [i * 30, 0, 0], alt: 'ALT_A' });
    for (let i = 0; i < 10; i++) p.push({ id: 'B' + i, ad: 'B parça ' + i, sekil: 'kutu', olcu: [20, 20, 20], konum: [i * 30, 0, 0], alt: 'ALT_B' });
    p.push({ id: 'K1', ad: 'Kök parçası 1', sekil: 'kutu', olcu: [10, 10, 10], konum: [0, 500, 0] });
    p.push({ id: 'K2', ad: 'Kök parçası 2', sekil: 'kutu', olcu: [10, 10, 10], konum: [0, 600, 0] });
    return S.guçGrubuStep(p, { altMontajlar: alt });
  }
  let s, METIN;
  beforeAll(() => { METIN = buyuk(); });
  beforeEach(() => { W.veMntWizAc(); s = W.veMntWizStpOku(METIN, 'buyuk.stp', 'duz'); });
  const satir = () => W._mwStpSatirlar(s);
  const adlar = () => satir().map((d) => (d.daha ? '+' + d.kalan : d.ad));
  const dug = (ad) => s.sonuc.agac.filter((d) => d.ad === ad)[0].i;

  test('varsayılan: kökün çocukları; bütün çocukları sığan dal açık, sığmayan kapalı', () => {
    expect(s.sonuc.agac.length - 1).toBeGreaterThan(W.VE_MW_STP_SATIR);
    const a = adlar();
    expect(a).toContain('Alt montaj A');
    expect(a.filter((x) => /^A parça/.test(x))).toHaveLength(0);
    expect(a.filter((x) => /^B parça/.test(x))).toHaveLength(10);
    expect(a.length).toBe(2 + 10 + 2);
    const k = document.createElement('div'); k.innerHTML = W._mwStpKartHTML();
    expect(k.querySelectorAll('table.ve-mw-tbl-stp tbody tr')).toHaveLength(14);
    const ac = k.querySelector('tr[data-ve-stp="' + dug('Alt montaj A') + '"] .ve-mw-stp-ac');
    expect(ac.getAttribute('aria-expanded')).toBe('false');
    expect(ac.getAttribute('aria-label')).toBe('Aç — Alt montaj A');
    expect(k.querySelectorAll('.ve-mw-stp-yaprak').length).toBe(12);
  });

  test('dal açılır: ilk sayfa + "… düğüm daha"; daha → bir sayfa daha; kapat', () => {
    const A = dug('Alt montaj A');
    W.veMntWizStpAc(A);
    expect(adlar().filter((x) => /^A parça/.test(x))).toHaveLength(W.VE_MW_STP_SAYFA);
    expect(adlar()).toContain('+' + (300 - W.VE_MW_STP_SAYFA));
    let k = document.createElement('div'); k.innerHTML = W._mwStpKartHTML();
    expect(k.querySelector('.ve-mw-stp-dahabtn').textContent.trim()).toBe('250 düğüm daha');
    W.veMntWizStpDaha(A);
    expect(adlar().filter((x) => /^A parça/.test(x))).toHaveLength(2 * W.VE_MW_STP_SAYFA);
    W.veMntWizStpAc(A);
    expect(adlar().filter((x) => /^A parça/.test(x))).toHaveLength(0);
    // satır sırası ağacın sırası: A'nın parçaları A'dan sonra, B'den önce
    W.veMntWizStpAc(A);
    const a = adlar();
    expect(a.indexOf('A parça 0')).toBe(a.indexOf('Alt montaj A') + 1);
    expect(a.indexOf('Alt montaj B')).toBeGreaterThan(a.indexOf('+250'));
  });

  test('rol verilen düğüm dal kapalıyken de görünür (ve sırası ağaçtaki yeri)', () => {
    W.veMntWizStpRol(dug('A parça 250'), 'mnt-mount');
    const a = adlar();
    expect(a).toContain('A parça 250');
    expect(a.indexOf('A parça 250')).toBe(a.indexOf('Alt montaj A') + 1);
    expect(a.filter((x) => /^A parça/.test(x))).toHaveLength(1);
  });

  test('küçük montaj tam açık gelir (eski davranış)', () => {
    const k = W.veMntWizStpOku(S.gucGrubu(), 'guc.stp', 'duz');
    expect(W._mwStpSatirlar(k).filter((d) => !d.daha)).toHaveLength(k.sonuc.agac.length - 1);
    expect(W._mwStpSatirlar(k).some((d) => d.daha)).toBe(false);
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

// ── HESAP BEKLER (2026-10-20, Takoz adım 3) ──────────────────────────────
// 3B kurulumu durdurulabiliyor: rol verilen birimin parçalarının ağı henüz
// yoksa eşzamanlı hesap büyük montajda arayüzü dakikalarca dondururdu (420
// MB'lık montajda motor %55). Eksik ağ eşiği aşınca hesap BEKLER — kartta
// çubuk ve Vazgeç — ağı ORTAK İŞ üretir, bitince hesap kendiliğinden yapılır.
describe('HESAP BEKLER — eksik ağ büyükse kart çubukla bekler, sonra kendiliğinden hesaplar', () => {
  const PK = require('../../js/pencere-kabuk.js');
  beforeAll(() => {
    global.vePencereEylem = PK.vePencereEylem;
    global.vePencereIlerleme = PK.vePencereIlerleme;
    global.vePencereIlerlemeHTML = PK.vePencereIlerlemeHTML;
    global.veSayi = global.veSayi || require('../../js/sayi.js').veSayi;
  });
  afterAll(() => { delete global.vePencereEylem; delete global.vePencereIlerleme; delete global.vePencereIlerlemeHTML; });
  const esik = W.VE_MW_STP_AG.eszaman;
  afterEach(() => { W.VE_MW_STP_AG.eszaman = esik; });
  const kart = () => { const d = document.createElement('div'); d.innerHTML = W._mwStpKartHTML(); return d; };
  const bekle = async (f) => { for (let i = 0; i < 400 && !f(); i++) await new Promise((r) => setTimeout(r, 0)); };
  const oku = () => W.veMntWizStpOku(S.gucGrubu(), 'guc.stp', 'duz');

  test('eşiğin altında eski davranış: eşzamanlı, bekleme yok', () => {
    W.veMntWizAc();
    const s = oku();
    W.veMntWizStpRol(dugumi(s, 'Motor bloğu'), 'mnt-motor');
    const coz = W.veMntWizStpHesapla();
    expect(coz && coz.ok).toBe(true);
    expect(s.hesapBekliyor || null).toBeNull();
  });

  test('eşik aşılınca: hesap null döner, kartta çubuk + Vazgeç; ağlar bitince sonuç eşzamanlıyla aynı', async () => {
    W.veMntWizAc();
    const ref = oku();
    W.veMntWizStpRol(dugumi(ref, 'Motor bloğu'), 'mnt-motor');
    W.veMntWizStpRol(dugumi(ref, 'Arka braket'), 'mnt-bracket');
    const beklenen = W.veMntWizStpHesapla();
    W.VE_MW_STP_AG.eszaman = 0;
    const s = oku();
    W.veMntWizStpRol(dugumi(s, 'Motor bloğu'), 'mnt-motor');
    W.veMntWizStpRol(dugumi(s, 'Arka braket'), 'mnt-bracket');
    expect(W.veMntWizStpHesapla()).toBeNull();
    expect(s.hesapBekliyor).toBeTruthy();
    expect(s.hesapBekliyor.toplam).toBe(3);                       // motor + braketin iki parçası
    const k = kart();
    expect(k.querySelector('#ve-mw-stp-hesapla')).toBeNull();
    expect(k.querySelector('.ve-fp-yurut[data-is] .ve-fp-ilerleme').getAttribute('aria-label')).toBe('Hesap');
    expect(k.querySelector('#ve-mw-stp-hesap-vazgec').textContent.trim()).toBe('Vazgeç');
    expect(W._mwStpHesapVeri(s).metin).toMatch(/^Parça \d \/ 3$/);
    expect(W.veMntWizStpHesapla()).toBeNull();                    // beklerken ikinci istek yok sayılır
    await bekle(() => !!s.coz);
    expect(s.hesapBekliyor).toBeNull();
    expect(s.coz.ok).toBe(true);
    expect(s.coz.birimler.map((b) => [b.ad, b.konum])).toEqual(beklenen.birimler.map((b) => [b.ad, b.konum]));
    expect(kart().querySelector('#ve-mw-stp-hesapla')).not.toBeNull();
  });

  test('Vazgeç: bekleyen hesap düşer, iş öncelikli listeyi bırakır, sonuç yazılmaz', async () => {
    W.VE_MW_STP_AG.eszaman = 0;
    W.veMntWizAc();
    const s = oku();
    W.veMntWizStpRol(dugumi(s, 'Motor bloğu'), 'mnt-motor');
    expect(W.veMntWizStpHesapla()).toBeNull();
    expect(W.veMntWizStpHesapVazgec()).toBe(true);
    expect(s.hesapBekliyor).toBeNull();
    expect(s.agIs.oncelik).toEqual([]);
    await bekle(() => !s.agDongu);
    expect(s.coz).toBeNull();
    expect(W.veMntWizStpHesapVazgec()).toBe(false);
  });

  test('rol değişince bekleyen hesap düşer; yeni rollerin hesabı bekler ve yapılır', async () => {
    W.VE_MW_STP_AG.eszaman = 0;
    W.veMntWizAc();
    const s = oku();
    W.veMntWizStpRol(dugumi(s, 'Motor bloğu'), 'mnt-motor');
    W.veMntWizStpHesapla();
    const ilk = s.hesapBekliyor;
    W.veMntWizStpRol(dugumi(s, 'Şanzıman gövdesi'), 'mnt-gearbox');
    expect(s.hesapBekliyor).not.toBe(ilk);
    expect(s.hesapBekliyor.toplam).toBeGreaterThan(0);
    await bekle(() => !!s.coz);
    expect(s.coz.birimler.map((b) => b.ad).sort()).toEqual(['Motor bloğu', 'Şanzıman gövdesi']);
  });

  test('bütün roller kalkınca bekleyen hesap düşer, sonuç yazılmaz', async () => {
    W.VE_MW_STP_AG.eszaman = 0;
    W.veMntWizAc();
    const s = oku();
    const m = dugumi(s, 'Motor bloğu');
    W.veMntWizStpRol(m, 'mnt-motor');
    W.veMntWizStpHesapla();
    expect(s.hesapBekliyor).toBeTruthy();
    W.veMntWizStpRol(m, '');
    expect(s.hesapBekliyor).toBeNull();
    await bekle(() => !s.agDongu);
    expect(s.coz).toBeNull();
  });

  test('3B görüntüleyicinin isteği: bütün montaj üretilir, istek kalkınca iş durur', async () => {
    W.veMntWizAc();
    const s = oku();
    expect(W.veMntWizStpAgTum(true)).toBe(true);
    await bekle(() => !s.agDongu);
    expect(s.ag.filter(Boolean)).toHaveLength(s.sonuc.parcalar.length);
    const s2 = oku();
    W.veMntWizStpAgTum(true);
    W.veMntWizStpAgTum(false);
    await bekle(() => !s2.agDongu);
    expect(s2.ag.filter(Boolean).length).toBeLessThan(s2.sonuc.parcalar.length);
  });
});
