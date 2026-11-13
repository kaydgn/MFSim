/**
 * mount-sihirbaz-doku.test.js — TAKOZ SİHİRBAZININ DOKUSU (Tur 6, 2026-10-15)
 * ─────────────────────────────────────────────────────────────────────────
 * Gerçek tarayıcıda ölçülen kusurların Node'da düşebilen halkaları; yerleşimin
 * kendisi (etiket satırı, örtülen düğme, seçicinin yazısı) tarayıcıda:
 * tests/e2e/mount-sihirbaz.spec.js. Ölçülen eski hâl:
 *   · özet adımı rayda ✓ taşıyordu — model çözülemezken ("Çözülemiyor")
 *   · tork masasında üç sonuç iki ayrı x'te, sola yaslı (178 · 298)
 *   · aynı tork Çözücü'de "−18.482", sihirbazda "-18.482"
 *   · özette mod biçimi İngilizce ("lateral+roll"), Çözücü'de Türkçe
 *   · özet masasının çizimi yüzen panelin altına giriyordu (3 işaret)
 *   · takoz listesinde rijitlik birimsiz ("k_z 290")
 *   · ateşleme uyarısı "Kriter 1" diyordu, Motor penceresi "Kriter 1 ve 2"
 * 2026-10-16 (kullanıcı kararı: "kullanıcı sadece detaylı sonuç raporu ile
 * yetinecek"): sihirbaz SONUÇ GÖSTERMEZ — özetin statik denge ve doğal
 * frekans tabloları, masadaki sehim etiketi, sehim ve f₁ hapları kalktı;
 * canlı denetim yalnız "çözülüyor / çözülemiyor" hükmünü verir.
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
global.veMntBrief = require('../../js/mount-brief.js');
const cp = require('../../js/cp-mount.js');
Object.keys(cp).forEach((k) => { if (global[k] === undefined) global[k] = cp[k]; });
const W = require('../../js/cp-mount-wizard.js');

const CSS = fs.readFileSync(path.join(__dirname, '../../css/styles.css'), 'utf8');
const KABUK = '<div id="ve-canvas-wrapper"></div>'
  + '<div id="ve-mntwiz-overlay" style="display:none;"><div class="ve-fw-shell">'
  + '<nav id="ve-mw-nav"></nav><div id="ve-mw-body"></div></div><div id="ve-mw-foot"></div>'
  + '<div id="ve-mw-3b" style="display:none;"></div></div>';
const OZET = W.VE_MW_STEPS.findIndex((s) => s.key === 'ozet');
const TORK = W.VE_MW_STEPS.findIndex((s) => s.key === 'tork');

beforeEach(() => {
  resetStubs(stubs);
  document.body.innerHTML = KABUK;
  global.nodes = [];
  global.connections = [];
  W._mwTaslakSifirla();
  W._mwStpSifirla();
});
afterEach(() => { if (W.veMntWizAcik()) W.veMntWizKapat(false); });

// Tulga: sihirbaz örnekten (çekirdeğin kaydından) doldurulur — Sonuçlar'daki
// örnekle aynı model.
function tulga() {
  W.veMntWizAc();
  const cozucu = global._mntResolveTopology;
  delete global._mntResolveTopology;            // yol: çekirdeğin model kaydı (eşzamanlı)
  try { expect(W.veMntWizOrnek('tulga')).toBe(true); } finally { if (cozucu) global._mntResolveTopology = cozucu; }
  const c = W.veMntWizCoz();
  expect(c.ok).toBe(true);
  return c;
}
const div = (html) => { const d = document.createElement('div'); d.innerHTML = html; return d; };

describe('ÖZET ADIMI — çözülmeyen model "tamam" değil', () => {
  test('boş model: özet rayda HATA, sebebi engelin adımları; Tulga: tamam', () => {
    const bos = W.veMntWizCoz(W.veMntWizDefault());
    expect(bos.ok).toBe(false);
    const d = W.veMntWizStepState(bos, OZET);
    expect(d.durum).toBe('err');
    const m = W.veMntWizIssues(bos, OZET).map((x) => x.m).join(' ');
    expect(m).toContain('Kütle gövdeleri · Takozlar eksik');
    expect(W.veMntWizStepState(tulga(), OZET).durum).toBe('ok');
  });

  test('yalnız takoz eksik: engel tek adım, eksikler ikinci kez sayılmıyor', () => {
    const c = tulga();
    const st = W.veMntWizState();
    st.takozlar = st.takozlar.slice(0, 2);       // üç takozdan az → takoz adımında hata
    const c2 = W.veMntWizCoz(st);
    expect(c2.ok).toBe(false);
    const l = W.veMntWizIssues(c2, OZET);
    expect(l).toHaveLength(1);
    expect(l[0].m).toContain('Model çözülemiyor: Takozlar eksik.');
    expect(l[0].m).not.toContain('Kütle gövdeleri');
    expect(c.ok).toBe(true);
  });

  test('ray: özet satırının rozeti hata rengi ve sebebi yazıyor', () => {
    W.veMntWizAc();
    const d = div(W.veMntWizNavHTML(W.veMntWizCoz()));
    const li = d.querySelectorAll('li.ve-fw-step')[OZET];
    expect(li.className).toContain('ve-fw-st-err');
    expect(li.querySelector('.ve-fw-step-n').getAttribute('title')).toContain('Model çözülemiyor');
  });
});

describe('TORK MASASI — sonuçlar tek sütunda, sağa yaslı, gerçek eksiyle', () => {
  test('üç sonuç AYNI x\'te ve sağa yaslı', () => {
    const c = tulga();
    for (const Wm of [1160, 700]) {
      const t = [...div(W._mwTorkZincirSVG(c, Wm, 820)).querySelectorAll('text.ve-mw-tz-sonuc')];
      expect(t).toHaveLength(3);
      expect(new Set(t.map((e) => e.getAttribute('x'))).size).toBe(1);
      t.forEach((e) => expect(e.getAttribute('text-anchor')).toBe('end'));
    }
  });

  test('geri tork Çözücü\'deki yazımla AYNI ("−", U+2212) — masa ve sağ sütun', () => {
    const c = tulga();
    expect(c.tork.geri).toBeLessThan(0);
    // Çözücü penceresinin yazıcısı (`_mntS`, dışa açık değil) kaynağından
    const kay = fs.readFileSync(path.join(__dirname, '../../js/cp-mount.js'), 'utf8');
    const mntS = new Function('veSayi', kay.match(/function _mntS\(v, d\)\{[\s\S]*?\n\}/)[0] + '\nreturn _mntS;')(veSayi);
    const beklenen = mntS(c.tork.geri, 0) + ' N·m';
    expect(beklenen).toContain('−');
    expect(div(W._mwTorkZincirSVG(c, 1160, 820)).textContent).toContain(beklenen);
    expect(div(W._mwStepTork(c)).textContent).toContain(beklenen);
    expect(div(W._mwTorkZincirSVG(c, 1160, 820)).textContent).not.toMatch(/-\d/);
  });
});

describe('ÖZET MASASI — çizim yüzen panelin SOLUNDA', () => {
  test('geniş masada sağ pay panel kadar; dar masada değil', () => {
    const o = { w: 1490, h: 820 };
    expect(W._mwMasaPay(o, 'ozet').sag).toBeGreaterThanOrEqual(W.VE_MW_OZET_PANEL + 24);
    expect(W._mwMasaPay(o, 'takoz').sag).toBeLessThan(W.VE_MW_OZET_PANEL);
    expect(W._mwMasaPay({ w: 700, h: 820 }, 'ozet').sag).toBeLessThan(W.VE_MW_OZET_PANEL);
  });

  test('Tulga özeti: hiçbir işaret panelin altına girmiyor (sağ 12 + 288 px)', () => {
    const c = tulga();
    const o = { w: 1490, h: 820 };
    const d = div(cp.veMnt2BSayfa(c.veri, o.w, o.h, { secim: true, pay: W._mwMasaPay(o, 'ozet') }).svg);
    const sag = [];
    d.querySelectorAll('[data-mnt-sec] rect, [data-mnt-sec] circle').forEach((e) => {
      if (e.tagName === 'rect') sag.push(+e.getAttribute('x') + +e.getAttribute('width'));
      else sag.push(+e.getAttribute('cx') + +e.getAttribute('r'));
    });
    expect(sag.length).toBeGreaterThan(5);
    expect(Math.max(...sag)).toBeLessThanOrEqual(o.w - W.VE_MW_OZET_PANEL - 12);
  });

  test('panelin eni JS ile CSS\'te birebir', () => {
    expect(CSS).toMatch(new RegExp('\\[data-adim="ozet"\\] > \\.ve-fw-yan\\{[^}]*width:' + W.VE_MW_OZET_PANEL + 'px'));
  });
});

describe('BİRİM VE DİL — aynı şey modülün her yerinde aynı sözle', () => {
  test('takoz listesinde rijitliğin birimi var', () => {
    tulga();
    const d = div(W._mwTakozListeHTML(W.veMntWizCoz()));
    const satir = [...d.querySelectorAll('.ve-fw-kl-n')].map((e) => e.textContent.trim());
    expect(satir.length).toBe(5);
    satir.forEach((t) => expect(t).toMatch(/^kz [\d.]+ N\/mm$/));
  });

  test('ateşleme frekansının eksiği: sihirbaz ve Motor penceresi AYNI kriterleri sayıyor', () => {
    const st = W.veMntWizDefault();
    const m = W.veMntWizSorunlar(st).filter((s) => /^Rölanti ya da silindir yok/.test(s.m)).map((s) => s.m)[0];
    const motor = fs.readFileSync(path.join(__dirname, '../../js/cp-mount.js'), 'utf8')
      .match(/'Silindir sayısı boş: (Kriter[^.']*)/)[1];
    const kriter = (t) => (t.match(/Kriter [\d–]+\d [\p{L}]+/u) || [''])[0];
    expect(kriter(motor)).toBe('Kriter 1–2 değerlendirilemiyor');
    expect(kriter(m)).toBe(kriter(motor));
  });
});

// SONUÇ YOK (kullanıcı kararı 2026-10-16): sihirbaz modelin ÇÖZÜLEBİLİR
// olduğunu söyler (Çözücü'nün yoluyla), sonucunu değil — sehim, takoz yükü,
// kapasite ve doğal frekanslar yalnız ayrıntılı raporda.
describe('SONUÇ YOK — sihirbaz sehim, yük ve frekans göstermez', () => {
  test('canlı denetim yalnız hüküm döner; haplar modelin büyüklüğü', () => {
    const c = tulga();
    expect([c.ok, c.statik, c.modlar]).toEqual([true, undefined, undefined]);
    W.veMntWizGoto(OZET);
    const hap = [...document.querySelectorAll('#ve-mw-live .ve-fw-damga, #ve-mw-live .ve-fw-pill')].map((e) => e.textContent.trim());
    expect(hap).toEqual(['Çözülüyor', 'm 788,4 kg', 'takoz 5']);
  });

  test('özet: Kurulacaklar ve modelin girdiden türeyen özeti; tablo ve sonuç kartı yok', () => {
    const c = tulga();
    const d = div(W._mwStepOzet(c));
    expect([...d.querySelectorAll('.ve-fw-card-h span')].map((e) => e.textContent)).toEqual(['Kurulacaklar', 'Model']);
    expect(d.querySelectorAll('table').length).toBe(0);
    expect(d.textContent).not.toMatch(/[Ss]ehim|Doğal frekans|Statik denge|Kap\./);
    expect(d.textContent).toContain('Birleşik CG(582; 22; 423) mm');
  });

  // `_mwFigurVeri` özette takozun etiketine 1 g sehimini yazıyordu ("Sağ Ön
  // Takoz · 7,12 mm"); 2026-10-16'dan beri her adımda yalnız ad.
  test('özet masasında takozun etiketi yalnız adı', () => {
    tulga();
    W.veMntWizGoto(OZET);
    const yazi = document.getElementById('ve-mw-masa-cizim').textContent;
    expect(yazi).toContain('Sağ Ön Takoz');
    expect(yazi).not.toMatch(/Takoz · [\d,]+ mm/);
  });
});

// 3B (Canlı Not 37, kullanıcı 2026-11-05: *"'Sihirbaz ile kur' dediğimiz zaman …
// 2B görünüm görünüyor. Buraya tıpkı 3B önizleme gibi sistem kuralım … kutu
// şeklinde, hatta yeni braket görselleştirmesini değiştirdik"*): masanın
// varsayılan görünüşü Görünümler'in aksonometrisi — aynı çizici, aynı kurucu,
// model sihirbazın durumundan. Çizici yoksa düz görünüşe düşer (yukarıdaki
// testler çizicisiz koşar).
describe('3B — masada Görünümler\'in aksonometrisi', () => {
  beforeAll(() => { global.veMntAkso = require('../../js/mount-akso.js'); });
  afterAll(() => { delete global.veMntAkso; });
  test('varsayılan 3B: kutular, köşebent braketler, takozlar adıyla; düz görünüşler yanında', () => {
    tulga();
    W.veMntWizGoto(OZET);
    expect(W._mw3B()).toBe(true);
    const masa = document.getElementById('ve-mw-masa');
    expect(masa.getAttribute('data-gorunus')).toBe('3b');
    expect(masa.hasAttribute('data-gezin')).toBe(false);          // düz görünüşün kaydırması değil, çizimin eli
    const svg = masa.querySelector('#' + W.VE_MW_AKSO + ' svg.ve-mnt2d-akso');
    expect(svg).toBeTruthy();
    expect(svg.querySelectorAll('g.ve-ak-g:not(.ve-ak-br)').length).toBe(3);            // motor · şanzıman · transfer
    expect(svg.querySelectorAll('g.ve-ak-g.ve-ak-br').length).toBe(5);                 // dört köşebent, bir kaide
    expect(svg.querySelectorAll('circle.ve-ak-nokta').length).toBe(0);
    expect(svg.querySelectorAll('g.ve-ak-t').length).toBe(5);
    // geniş kip: takoz numarası ve adıyla (gövdenin ardındaki takozun yazısı yok — GİZLİ YÜZEY)
    expect(svg.textContent).toContain('T1 Ön Takoz');
    expect(svg.textContent).toContain('Motor');
    expect(masa.querySelector('.ve-mnt-kroki-bas')).toBeNull();                         // başlık masada
    const lej = [...masa.querySelectorAll('#ve-mw-masa-lej .ve-fw-lj')].map((e) => e.textContent);
    expect(lej).toEqual(['Gövde', 'Takoz', 'Birleşik CG', 'Braket']);
    const dug = [...masa.querySelectorAll('.ve-fw-masa-arac button')].map((b) => [b.textContent, b.getAttribute('aria-pressed')]);
    expect(dug).toEqual([['3B', 'true'], ['2B', 'false']]);
    W.veMntWizGorunus('2b');
    expect(document.querySelector('#ve-mw-masa-cizim > svg.ve-mnt2b')).toBeTruthy();
    expect(document.getElementById('ve-mw-masa').getAttribute('data-gorunus')).toBe('2b');
    expect(document.getElementById('ve-mw-masa').hasAttribute('data-gezin')).toBe(true);
    W.veMntWizGorunus('3b');
  });
  // Canlı Not 40 · 41: masanın 3B'si yazıları çerçeveli ÇİP yapar, kısa kırık
  // kılavuzla (mount-akso.test.js → ÇİP) ve çizimin üstünde yüzen şerit ile
  // düğmeleri yazıya engel bildirir.
  test('çip ve masanın örtüleri çizime gider', () => {
    tulga();
    W.veMntWizGoto(OZET);
    const kap = document.getElementById(W.VE_MW_AKSO);
    expect(kap.getAttribute('data-balon')).toBe('1');
    expect(cp._mntAksoCizim[W.VE_MW_AKSO].o.balon).toBe(true);
    expect(cp._mntAksoCizim[W.VE_MW_AKSO].o.ortu).toBeUndefined();               // jsdom'da örtü ölçülmez
    kap.setAttribute('data-ortu', '8,8,240,40;748,320,782,408;x,1,2,3');
    cp._mntAksoKur(W.VE_MW_AKSO, 790, cp._mntAksoKaynak[W.VE_MW_AKSO]());
    expect(cp._mntAksoCizim[W.VE_MW_AKSO].o.ortu).toEqual([{ l: 8, t: 8, r: 240, b: 40 }, { l: 748, t: 320, r: 782, b: 408 }]);
    expect(document.querySelector('#' + W.VE_MW_AKSO + ' circle.ve-ak-kilavuz-uc')).toBeTruthy();
    // her yazı çip: gövdenin yazısı da çerçeveli
    const svg = document.querySelector('#' + W.VE_MW_AKSO + ' svg.ve-mnt2d-akso');
    expect([...svg.querySelectorAll(':scope > g[data-ak]')].filter((g) => g.querySelector('text') && !g.classList.contains('ve-ak-cip'))).toEqual([]);
  });
  // SEÇİLİ ÖNDE (kullanıcı 2026-11-10, Canlı Not 119: *"Takoz seçildiğinde … öne doğru çıksın,
  // belirginleşsin … arka tarafta kalmış"*): seçili perdenin ÜSTÜNDE, kalan model gölgede.
  test('SEÇİLİ ÖNDE: işarete tık satırı seçer; seçili perdenin üstünde, kalan model altında', () => {
    tulga();
    W.veMntWizGoto(OZET);
    const st = W.veMntWizState();
    const t = st.takozlar.find((x) => /Sağ Ön/.test(x.ad));
    const c3 = cp._mntAksoCizim[W.VE_MW_AKSO];
    const tk = c3.m.takoz.find((x) => x.id === 'mw:' + t.key).k;
    expect(W._mwMasa3BSec(tk)).toBe(true);                                              // takoz adımına geçer
    const svg = document.querySelector('#' + W.VE_MW_AKSO + ' svg.ve-mnt2d-akso');
    expect(svg.querySelector('g.ve-ak-t[data-sec]').getAttribute('data-ak')).toBe(tk);
    const perde = svg.querySelector(':scope > rect.ve-ak-perde'), odak = svg.querySelector(':scope > g.ve-ak-odak');
    expect(perde).not.toBeNull();
    expect(odak.querySelector('g.ve-ak-t[data-sec]').getAttribute('data-ak')).toBe(tk);      // seçili perdenin üstünde
    expect(perde.compareDocumentPosition(odak) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(document.getElementById(W.VE_MW_AKSO).getAttribute('data-perde')).toBe('1');
    W.veMntWizGoto(OZET);                                                               // özette seçim yok: perde de yok
    expect(document.querySelector('#' + W.VE_MW_AKSO + ' svg.ve-mnt2d-akso .ve-ak-perde')).toBeNull();
    // konumu eksik takoz çizilmez (düz görünüşün kuralı)
    t.x = '';
    expect(W._mwAksoDugumler(st).some((n) => n.key === t.key)).toBe(false);
  });
});


// GÖVDENİN ÇERÇEVESİ (kullanıcı 2026-11-09, Canlı Not 79: "Üstten-Yandan-Önden görünüşlerde en
// azından komponentlerin bir çerçevesi çıksın. Yani dikdörtgen, kare falan şekiller çıksın ki,
// neyin nerede olduğu anlaşılsın. Sanki 3B'ya yandan üstten bakıyormuş gibi olsun.") Önce: düz
// görünüş yalnız ağırlık merkezinin dairesini çiziyordu. Şimdi atalet taşıyan her gövdenin eşdeğer
// kutusu (3B'nin kutusu) izdüşümüyle; nokta kütle yalnız dairesiyle.
describe('DÜZ GÖRÜNÜŞTE GÖVDENİN ÇERÇEVESİ (Canlı Not 79)', () => {
  const EKS = { x: 0, y: 1, z: 2 };
  test.each(['ust', 'yan', 'on'])('Tulga · %s: kutusu olan her gövdeye bir çerçeve, ölçüsü kutunun izdüşümü, ağırlık merkezi ortasında', (g) => {
    const c = tulga();
    const G = cp.VE_MNT2D_GORUNUS[g];
    const kutulu = c.veri.comps.filter((x) => x.kutu);
    expect(kutulu.length).toBeGreaterThanOrEqual(2);
    expect(c.veri.comps.filter((x) => !x.kutu).length).toBeGreaterThan(0);              // nokta kütleler
    const d = div(cp.veMnt2BSayfa(c.veri, 1000, 700, { secim: true }).svg).querySelector('[data-mnt2b="' + g + '"]');
    const rect = [...d.querySelectorAll('.ve-mnt2d-kutu > rect')];
    expect(rect).toHaveLength(kutulu.length);
    // ölçek: iki çerçevenin genişlik oranı kutuların oranı; ağırlık merkezi çerçevenin ortasında
    const r = (i) => ({ x: +rect[i].getAttribute('x'), y: +rect[i].getAttribute('y'), w: +rect[i].getAttribute('width'), h: +rect[i].getAttribute('height') });
    const s = r(0).w / kutulu[0].kutu[EKS[G.h]];
    kutulu.forEach((k, i) => {
      expect(r(i).w / k.kutu[EKS[G.h]]).toBeCloseTo(s, 1);
      expect(r(i).h / k.kutu[EKS[G.v]]).toBeCloseTo(s, 1);
      const cer = rect[i].parentNode.getAttribute('data-mnt-sec');
      const daire = [...d.querySelectorAll('[data-mnt-sec="' + cer + '"] circle')][0];
      expect(Math.abs(+daire.getAttribute('cx') - (r(i).x + r(i).w / 2))).toBeLessThan(0.6);
      expect(Math.abs(+daire.getAttribute('cy') - (r(i).y + r(i).h / 2))).toBeLessThan(0.6);
    });
    // çerçeveler işaretlerin altında: ilk takozdan önce çizilir
    const html = d.innerHTML;
    expect(html.indexOf('ve-mnt2d-kutu')).toBeLessThan(html.indexOf('data-mnt-sec="takoz:'));
  });
  test('seçili gövdenin çerçevesi vurgu; göstergede Gövde', () => {
    const c = tulga();
    const i = c.veri.comps.findIndex((x) => x.kutu);
    const d = div(cp.veMnt2BSayfa(c.veri, 1000, 700, { secim: true, secili: { tur: 'govde', i } }).svg);
    ['yan', 'on', 'ust'].forEach((g) => expect(d.querySelector('[data-mnt2b="' + g + '"] [data-mnt-sec="govde:' + i + '"].ve-mnt2d-kutu > rect').getAttribute('stroke')).toBe('var(--accent-primary)'));
    W.veMntWizGorunus('2b');
    expect([...document.querySelectorAll('#ve-mw-masa .ve-fw-lj')].map((e) => e.textContent)).toEqual(['Gövde', 'Takoz', 'Gövde CG', 'Birleşik CG']);
    expect(CSS).toMatch(/\.ve-mw-lj-kutu\{[^}]*border:1px solid var\(--text-secondary\)/);
  });
});


// 2B SAYFASI (kullanıcı 2026-11-11, Canlı Not 137: *"Üstten Yandan Önden görünümler sanki resim
// alınmış gibi olmuş. Koordinat düzlemi falan resimler ile beraber hareket ediyor. Ayrıca bu
// görünümlerin tek sayfada olmasını istiyorum. 2B olarak isimlendirilebilir. Arkadaki grid yapısını
// da istemiyorum."*). Önce: üç ayrı sayfa; yakınlaştırma SVG'nin viewBox'ını büyütüyordu — eksen
// değerleri, yazılar ve çerçeve resimle birlikte büyüyüp kayıyordu; arkada ızgara. Gerçek tarayıcı
// tarafı (tekerlek, sürükleme): tests/e2e/mount-sihirbaz.spec.js → 2B SAYFASI.
describe('2B SAYFASI (Canlı Not 137)', () => {
  const EKS = { x: 0, y: 1, z: 2 };
  // panelin işaretlerinin ekran konumu: takozun karesinin ve gövde CG dairesinin merkezi
  const isaret = (pn, sec) => {
    const g = pn.querySelector('[data-mnt-sec="' + sec + '"]:not(.ve-mnt2d-kutu)');
    const c = g.querySelector('circle'), r = g.querySelector('rect');
    if (c) return { x: +c.getAttribute('cx'), y: +c.getAttribute('cy') };
    return { x: +r.getAttribute('x') + +r.getAttribute('width') / 2, y: +r.getAttribute('y') + +r.getAttribute('height') / 2 };
  };
  const yazilar = (el) => [...el.querySelectorAll('text')];
  test('üç görünüş tek sayfada: Yandan · Önden · Üstten; ortak eksen hizalı, ölçek tek', () => {
    const c = tulga();
    const R = cp.veMnt2BSayfa(c.veri, 1100, 760, { secim: true });
    expect(R.paneller.map((p) => p.g)).toEqual(['yan', 'on', 'ust']);
    const d = div(R.svg);
    const pn = (g) => d.querySelector('[data-mnt2b="' + g + '"]');
    expect(['yan', 'on', 'ust'].map((g) => yazilar(pn(g)).some((t) => t.textContent === cp.VE_MNT2D_GORUNUS[g].ad))).toEqual([true, true, true]);
    const [yan, on, ust] = R.paneller;
    expect(on.x0).toBeGreaterThan(yan.x0 + yan.w);              // Önden Yandan'ın sağında
    expect(ust.y0).toBeGreaterThan(yan.y0 + yan.h);             // Üstten Yandan'ın altında
    expect(on.t).toBeCloseTo(yan.t, 6); expect(on.b).toBeCloseTo(yan.b, 6);     // Z satırı ortak
    expect(ust.l).toBeCloseTo(yan.l, 6); expect(ust.r).toBeCloseTo(yan.r, 6);   // X sütunu ortak
    // her gövdenin CG'si: Yandan ↔ Üstten aynı ekran x'i, Yandan ↔ Önden aynı ekran y'si (takozun
    // işareti üst üste binen çiftte yelpazelenir — o kayma görünürlük içindir, konum değil)
    const secler = [...pn('yan').querySelectorAll('[data-mnt-sec^="govde:"]:not(.ve-mnt2d-kutu)')].map((g) => g.getAttribute('data-mnt-sec'));
    expect(secler.length).toBeGreaterThan(4);
    secler.forEach((sec) => {
      expect(Math.abs(isaret(pn('yan'), sec).x - isaret(pn('ust'), sec).x)).toBeLessThan(0.2);
      expect(Math.abs(isaret(pn('yan'), sec).y - isaret(pn('on'), sec).y)).toBeLessThan(0.2);
    });
    // tek ölçek: aynı gövdenin kutusu Yandan ve Üstten'de aynı enle, Yandan ve Önden'de aynı boyla
    const kutu = (g, i) => { const r = pn(g).querySelector('[data-mnt-sec="govde:' + i + '"].ve-mnt2d-kutu > rect'); return { w: +r.getAttribute('width'), h: +r.getAttribute('height') }; };
    const i = c.veri.comps.findIndex((x) => x.kutu);
    expect(kutu('yan', i).w).toBeCloseTo(kutu('ust', i).w, 0);
    expect(kutu('yan', i).h).toBeCloseTo(kutu('on', i).h, 0);
    expect(kutu('yan', i).w / c.veri.comps[i].kutu[EKS.x]).toBeCloseTo(R.kamera.s, 3);
  });
  test('YAKINLAŞTIRMA YENİDEN ÇİZER: yazı boyu ve çerçeve yerinde, değerler görünen aralıktan', () => {
    const c = tulga();
    const A = cp.veMnt2BSayfa(c.veri, 1100, 760, { secim: true });
    const K2 = { s: A.kamera.s * 2.5, x: A.kamera.x, y: A.kamera.y, z: A.kamera.z };
    const B = cp.veMnt2BSayfa(c.veri, 1100, 760, { secim: true, kamera: K2 });
    const da = div(A.svg), db = div(B.svg);
    const boy = (d) => [...new Set(yazilar(d).map((t) => t.getAttribute('font-size')))].sort();
    expect(boy(db)).toEqual(boy(da));                                                    // yazı büyümez
    const cer = (d) => [...d.querySelectorAll('rect.ve-mnt2b-cerceve')].map((r) => ['x', 'y', 'width', 'height'].map((k) => r.getAttribute(k)).join(','));
    expect(cer(da)).toHaveLength(3);
    expect(cer(db)).toEqual(cer(da));                                                    // çerçeve yerinde
    expect(B.paneller).toEqual(A.paneller);
    const deger = (d, g) => yazilar(d.querySelector('[data-mnt2b="' + g + '"]')).map((t) => t.textContent).filter((t) => /^[−-]?[\d.]+$/.test(t));
    expect(deger(db, 'yan')).not.toEqual(deger(da, 'yan'));                              // değerler görünen aralıktan
    // işaret merkezden 2,5 kat uzaklaşır; çizim alanının dışına düşen kesilir ve etiketlenmez
    const p = A.paneller[0];
    const a = isaret(da.querySelector('[data-mnt2b="yan"]'), 'takoz:0'), b = isaret(db.querySelector('[data-mnt2b="yan"]'), 'takoz:0');
    expect(b.x - p.cx).toBeCloseTo((a.x - p.cx) * 2.5, 0);
    expect(db.querySelectorAll('clipPath')).toHaveLength(3);
    expect(db.querySelector('[data-mnt2b="yan"] g[clip-path] [data-mnt-sec="takoz:0"]')).toBeTruthy();
    const disari = c.veri.mounts.map((m, k) => k).filter((k) => {
      const q = isaret(db.querySelector('[data-mnt2b="yan"]'), 'takoz:' + k);
      return q.x < p.l || q.x > p.r || q.y < p.t || q.y > p.b;
    });
    expect(disari.length).toBeGreaterThan(0);
    const yaziYan = yazilar(db.querySelector('[data-mnt2b="yan"]')).map((t) => t.textContent);
    disari.forEach((k) => expect(yaziYan).not.toContain(c.veri.mounts[k].name));
  });
  test('IZGARA YOK: çizgi ızgarası yerine çerçeve ve çentik; masanın kâğıdı ızgarasız', () => {
    const c = tulga();
    const svg = cp.veMnt2BSayfa(c.veri, 1100, 760, {}).svg;
    expect(svg).not.toMatch(/opacity="0\.4"/);                                          // ızgara çizgisi
    const d = div(svg);
    // çentik 5 px: çerçevenin kenarından içeri
    const centik = [...d.querySelectorAll('line.ve-mnt2b-centik')];
    expect(centik.length).toBeGreaterThan(12);
    centik.forEach((l) => expect(Math.hypot(l.getAttribute('x2') - l.getAttribute('x1'), l.getAttribute('y2') - l.getAttribute('y1'))).toBeCloseTo(5, 3));
    expect(CSS).toMatch(/\.ve-fw-masa\[data-gorunus="2b"\]\{ background-image:none; \}/);
  });
  test('sihirbaz: 2B düğmesi; yakınlaştırma kamerayı değiştirir, sığdır sıfırlar; eski adlar 2B açar', () => {
    tulga();
    W.veMntWizGoto(W.VE_MW_STEPS.findIndex((x) => x.key === 'govde'));
    W.veMntWizGorunus('yan');                                                            // eski ad
    const masa = () => document.getElementById('ve-mw-masa');
    expect(masa().getAttribute('data-gorunus')).toBe('2b');
    const L0 = W._mw2BSonGetir();
    expect(L0 && L0.paneller.length).toBe(3);
    expect(W._mw2BKameraGetir()).toBeNull();                                             // sığdırma
    const boy0 = yazilar(masa()).map((t) => t.getAttribute('font-size')).sort().join();
    W.veMntWizZoom(1); W._mw2BYenile(true);
    const K = W._mw2BKameraGetir();
    expect(K.s).toBeCloseTo(L0.s0 * 1.25, 6);
    expect(new Set(yazilar(masa()).map((t) => t.getAttribute('font-size')))).toEqual(new Set(boy0.split(',')));
    // Yandan'da sürükleme X ve Z'yi kaydırır; Y yerinde
    const x0 = K.x, y0 = K.y, z0 = K.z;
    W._mw2BKaydir('yan', 100, -50); W._mw2BYenile(true);
    const K2 = W._mw2BKameraGetir();
    expect(K2.x).toBeCloseTo(x0 - 100 / K.s, 6); expect(K2.z).toBeCloseTo(z0 - 50 / K.s, 6); expect(K2.y).toBeCloseTo(y0, 9);
    // imlecin altındaki nokta yerinde kalır (Önden'in ortasından 40 px sağı: Y ve Z)
    const p = W._mw2BSonGetir().paneller[1], sx = p.cx + 40, sy = p.cy - 30;
    const hm = K2.y + (sx - p.cx) / K2.s, vm = K2.z - (sy - p.cy) / K2.s;
    W._mw2BZoom(2, sx, sy); W._mw2BYenile(true);
    const K3 = W._mw2BKameraGetir();
    expect(K3.y + (sx - p.cx) / K3.s).toBeCloseTo(hm, 6);
    expect(K3.z - (sy - p.cy) / K3.s).toBeCloseTo(vm, 6);
    expect(K3.x).toBeCloseTo(K2.x, 9);
    W.veMntWizZoom(0); W._mw2BYenile(true);
    expect(W._mw2BKameraGetir()).toBeNull();
    W.veMntWizGorunus('3b');
  });
});


// BOŞLUĞA TIK SEÇİMİ BIRAKIR (kullanıcı 2026-11-11, Canlı Not 153: *"Kütle gövdeleri ve Takozlar
// kısmında bileşene tıkladıktan sonra, boş yere tıkladığımda tıklamamdan vaz geçemiyorum. Yani kalıyor
// öyle."*). Önce: masada işaretsiz yere tık hiçbir şey yapmıyordu — seçili gövde perdenin üstünde, kalan
// model gölgede kalıyordu; adım her çizimde ilk satırı yeniden seçtiği için seçimsiz hâl de yoktu. Şimdi
// 3B'de ve 2B'de boşluğa tık seçimi bırakır: perde ve halka kalkar, liste yerinde, Seçili gövde · Seçili
// takoz bölümü çekilir; işarete tık yine seçer, sürükleme (imleç geri dönse de) ne seçer ne bırakır.
// Gerçek fare: tests/e2e/mount-sihirbaz.spec.js → BOŞLUĞA TIK.
describe('BOŞLUĞA TIK SEÇİMİ BIRAKIR (Canlı Not 153)', () => {
  beforeAll(() => { global.veMntAkso = require('../../js/mount-akso.js'); });
  afterAll(() => { delete global.veMntAkso; });
  const GOVDE = W.VE_MW_STEPS.findIndex((s) => s.key === 'govde');
  const TAKOZ = W.VE_MW_STEPS.findIndex((s) => s.key === 'takoz');
  // basış → (hareketler) → bırakış. Noktanın öğesi (elementFromPoint — jsdom'da yok) her olayda
  // yeniden bulunur: döndürmenin bitişi çizimi yeniden kurar ve tarayıcıda nokta YENİ çizimin öğesini
  // verir — olayın eski hedefi belgeden düşmüştür, ona bakan bir sınama dönen çizimi hiç ölçmezdi.
  const tik = (hedef, yol = []) => {
    document.elementFromPoint = () => hedef();
    try {
      const ev = (t, [x, y]) => hedef().dispatchEvent(new MouseEvent(t, { bubbles: true, cancelable: true, button: 0, clientX: x, clientY: y }));
      const bas = [200, 200];
      ev('pointerdown', bas);
      yol.forEach((p) => ev('pointermove', p));
      ev('pointerup', yol.length ? yol[yol.length - 1] : bas);
    } finally { delete document.elementFromPoint; }
  };
  const secili = () => [...document.querySelectorAll('#ve-mw-liste .ve-fw-kl.on')].map((b) => b.getAttribute('data-mw-satir'));
  const kartlar = () => [...document.querySelectorAll('#ve-mw-yan .ve-fw-card-h')].map((h) => h.textContent);
  const ak = () => document.querySelector('#' + W.VE_MW_AKSO + ' svg.ve-mnt2d-akso');
  const ikiB = () => document.querySelector('#ve-mw-masa-cizim > svg.ve-mnt2b');

  test('3B: işarete tık seçer; çizimin boşluğuna tık bırakır — perde kalkar, Seçili gövde çekilir, liste kalır', () => {
    tulga();
    W.veMntWizGoto(GOVDE);
    const st = W.veMntWizState();
    const sanz = st.govdeler.find((g) => g.type === 'mnt-gearbox');
    expect(secili()).toEqual([st.govdeler[0].key]);                                     // adım ilk satırı seçer (değişmedi)
    const k = cp._mntAksoCizim[W.VE_MW_AKSO].m.govde.find((g) => g.id === 'mw:' + sanz.key).k;
    tik(() => ak().querySelector('[data-ak="' + k + '"]'));
    expect(secili()).toEqual([sanz.key]);
    expect(kartlar()).toEqual(['Kütle gövdeleri', 'Seçili gövde']);
    expect(ak().querySelector('g.ve-ak-odak [data-sec]').getAttribute('data-ak')).toBe(k);
    // çizimin zemini: işaret yok → seçim bırakılır
    tik(() => ak().querySelector(':scope > rect.ve-ak-zem'));
    expect(secili()).toEqual([]);
    expect(kartlar()).toEqual(['Kütle gövdeleri']);
    expect(document.querySelectorAll('#ve-mw-liste .ve-fw-kl')).toHaveLength(st.govdeler.length);
    expect(document.getElementById(W.VE_MW_AKSO).getAttribute('data-perde')).toBe('0');
    expect(ak().querySelector('[data-sec], rect.ve-ak-perde, g.ve-ak-odak')).toBeNull();
    // bırakılan seçim yeniden çizimde ve adım dönüşünde ilk satıra dönmez
    W.veMntWizRender();
    W.veMntWizGoto(TAKOZ); W.veMntWizGoto(GOVDE);
    expect(secili()).toEqual([]);
    // çizimin dışı bırakmaz: gösterge, durum çipi
    tik(() => ak().querySelector('[data-ak="' + k + '"]'));
    tik(() => document.getElementById('ve-mw-masa-lej'));
    tik(() => document.querySelector('#ve-mw-live .ve-fw-damga'));
    expect(secili()).toEqual([sanz.key]);
    // takoz adımında da: ilk takoz seçili, boşluğa tık bırakır
    W.veMntWizGoto(TAKOZ);
    expect(secili()).toEqual([st.takozlar[0].key]);
    tik(() => ak());
    expect(secili()).toEqual([]);
    expect(kartlar()).toEqual(['Takozlar', 'Şanzıman askısı']);   // askının seçeneği adımda kalır
    expect(ak().querySelector('[data-sec]')).toBeNull();
    // seçimsiz adımda (özet) boşluk bir şey yapmaz
    W.veMntWizGoto(OZET);
    expect(W._mwMasaBirak()).toBe(false);
  });

  test('3B: sürükleme döndürür, seçimi oynatmaz — imleç basılan yere dönse de', () => {
    tulga();
    W.veMntWizGoto(GOVDE);
    const st = W.veMntWizState();
    const az0 = cp.VE_MNT_AKSO3B.az;
    tik(() => ak().querySelector(':scope > rect.ve-ak-zem'), [[230, 210], [201, 200]]);
    expect(cp.VE_MNT_AKSO3B.az).not.toBe(az0);                                         // döndü
    expect(secili()).toEqual([st.govdeler[0].key]);
    // çizicinin eşiğinde (|dx| + |dy| = 3) çizim döner: tık değil
    tik(() => ak().querySelector(':scope > rect.ve-ak-zem'), [[202, 201]]);
    expect(secili()).toEqual([st.govdeler[0].key]);
    // eşiğin altı tıktır
    tik(() => ak().querySelector(':scope > rect.ve-ak-zem'), [[201, 201]]);
    expect(secili()).toEqual([]);
    cp.veMntAksoAyar(W.VE_MW_AKSO, 'sifirla');
  });

  test('2B: işarete tık seçer; boşluğa tık bırakır — halka kalkar; sürükleme kaydırır, seçimi oynatmaz', () => {
    tulga();
    W.veMntWizGoto(GOVDE);
    W.veMntWizGorunus('2b');
    const st = W.veMntWizState();
    const konumlu = st.govdeler.filter((g) => [g.cgx, g.cgy, g.cgz].every((v) => v !== '' && v != null && Number.isFinite(Number(v))));
    expect(konumlu.length).toBeGreaterThan(2);
    const halka = () => ikiB().querySelectorAll('circle[stroke-width="2.2"], rect[stroke-width="1.6"]').length;
    tik(() => ikiB().querySelector('[data-mnt2b="yan"] [data-mnt-sec="govde:1"]:not(.ve-mnt2d-kutu) circle'));
    expect(secili()).toEqual([konumlu[1].key]);
    expect(halka()).toBeGreaterThan(0);
    tik(() => ikiB().querySelector('[data-mnt2b="on"] rect.ve-mnt2b-cerceve'));            // panelin boş alanı
    expect(secili()).toEqual([]);
    expect(kartlar()).toEqual(['Kütle gövdeleri']);
    expect(halka()).toBe(0);
    // sürükleme kaydırır (kamera yazılır), seçim yerinde; imleç basılan yere dönse de
    tik(() => ikiB().querySelector('[data-mnt2b="yan"] [data-mnt-sec="govde:1"]:not(.ve-mnt2d-kutu) circle'));
    tik(() => ikiB(), [[240, 220], [201, 200]]);
    W._mw2BYenile(true);
    expect(W._mw2BKameraGetir()).not.toBeNull();
    expect(secili()).toEqual([konumlu[1].key]);
    // takoz adımında da
    W.veMntWizGoto(TAKOZ);
    expect(secili()).toEqual([st.takozlar[0].key]);
    tik(() => ikiB());
    expect(secili()).toEqual([]);
    expect(kartlar()).toEqual(['Takozlar', 'Şanzıman askısı']);   // askının seçeneği adımda kalır
    tik(() => ikiB().querySelector('[data-mnt2b="ust"] [data-mnt-sec="takoz:2"]'));
    expect(secili()).toEqual([st.takozlar[2].key]);
    W.veMntWizGorunus('3b');
  });
});

