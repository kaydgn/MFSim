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
    const svg = cp.veMnt2DGorunusSVG(c.veri, o.w, o.h, { gorunus: 'ust', secim: true, pay: W._mwMasaPay(o, 'ozet') });
    const d = div(svg);
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
    expect(dug).toEqual([['3B', 'true'], ['Üstten', 'false'], ['Yandan', 'false'], ['Önden', 'false']]);
    W.veMntWizGorunus('ust');
    expect(document.querySelector('#ve-mw-masa-cizim > svg.ve-mnt2d-gorunus')).toBeTruthy();
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
  test('işarete tık satırı seçer; seçili perdesiz vurgulu', () => {
    tulga();
    W.veMntWizGoto(OZET);
    const st = W.veMntWizState();
    const t = st.takozlar.find((x) => /Sağ Ön/.test(x.ad));
    const c3 = cp._mntAksoCizim[W.VE_MW_AKSO];
    const tk = c3.m.takoz.find((x) => x.id === 'mw:' + t.key).k;
    expect(W._mwMasa3BSec(tk)).toBe(true);                                              // takoz adımına geçer
    const svg = document.querySelector('#' + W.VE_MW_AKSO + ' svg.ve-mnt2d-akso');
    expect(svg.querySelector('g.ve-ak-t[data-sec]').getAttribute('data-ak')).toBe(tk);
    expect(svg.querySelector('.ve-ak-perde')).toBeNull();
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
    const d = div(cp.veMnt2DGorunusSVG(c.veri, 1000, 700, { gorunus: g, secim: true }));
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
    const d = div(cp.veMnt2DGorunusSVG(c.veri, 1000, 700, { gorunus: 'yan', secim: true, secili: { tur: 'govde', i } }));
    expect(d.querySelector('[data-mnt-sec="govde:' + i + '"].ve-mnt2d-kutu > rect').getAttribute('stroke')).toBe('var(--accent-primary)');
    W.veMntWizGorunus('yan');
    expect([...document.querySelectorAll('#ve-mw-masa .ve-fw-lj')].map((e) => e.textContent)).toEqual(['Gövde', 'Takoz', 'Gövde CG', 'Birleşik CG']);
    expect(CSS).toMatch(/\.ve-mw-lj-kutu\{[^}]*border:1px solid var\(--text-secondary\)/);
  });
});
