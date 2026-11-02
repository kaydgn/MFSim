/**
 * mount-3b.test.js — TAKOZ 3B GÖRÜNTÜLEYİCİSİNİN SAF PARÇALARI (js/cp-mount-3b.js)
 *
 * 2026-10-20, Takoz adım 3 (420 MB'lık deneme montajı ölçüldü): montaj çizim
 * kümelerinde çizilir (parça başına iki nesne 23.388 çizim çağrısıydı); fareyle
 * seçim önce parçaların KUTUSUNDAN süzülür, sonra yalnız o parçaların
 * üçgenlerine bakılır; kurulumun kutusu çubuk + Durdur. WebGL isteyen yarısı
 * (kümeler, aşamalı görünürlük, Durdur · Devam, tıklayıp seçme) gerçek
 * tarayıcıda: tests/e2e/mount-3b.spec.js.
 */
const stubs = stubGlobals();
global.nodes = [];
global.connections = [];
eval(loadSource('components.js'));
global.componentDefs = componentDefs;
global.veSayi = require('../../js/sayi.js').veSayi;
const PK = require('../../js/pencere-kabuk.js');
global.vePencereEylem = PK.vePencereEylem;
global.vePencereIlerlemeHTML = PK.vePencereIlerlemeHTML;
const STP = require('../../js/mount-step.js');
Object.keys(STP).forEach((k) => { global[k] = STP[k]; });
eval(loadSource('cp-mount-wizard.js'));
eval(loadSource('cp-mount-3b.js'));
beforeEach(() => resetStubs(stubs));

const v = (x, y, z) => ({ x, y, z });

describe('İSABET — ışın ↔ parçanın kutusu (dilim yöntemi)', () => {
  const K = [0, 0, 0, 1, 1, 1];
  test('dışarıdan giren ışın: giriş uzaklığı', () => {
    expect(_mw3bKutuKes(v(-10, 0.5, 0.5), v(1, 0, 0), K, 0)).toBeCloseTo(10, 12);
    expect(_mw3bKutuKes(v(0.5, 0.5, 5), v(0, 0, -1), K, 0)).toBeCloseTo(4, 12);
  });
  test('ıskalayan, arkada kalan ve eksene paralel dışarıdaki ışın: -1', () => {
    expect(_mw3bKutuKes(v(-10, 2, 0.5), v(1, 0, 0), K, 0)).toBe(-1);
    expect(_mw3bKutuKes(v(10, 0.5, 0.5), v(1, 0, 0), K, 0)).toBe(-1);
    expect(_mw3bKutuKes(v(-10, 0.5, 3), v(1, 0, 0), K, 0)).toBe(-1);
  });
  test('içeriden: 0; kutu dizide j. sırada okunur', () => {
    expect(_mw3bKutuKes(v(0.5, 0.5, 0.5), v(1, 0, 0), K, 0)).toBe(0);
    expect(_mw3bKutuKes(v(-10, 0.5, 0.5), v(1, 0, 0), [9, 9, 9, 9, 9, 9].concat(K), 6)).toBeCloseTo(10, 12);
  });
});

describe('İSABET — ışın ↔ üçgenler (Möller–Trumbore, iki yüzlü)', () => {
  const a = { uc: new Float32Array([5, 0, 0, 5, 1, 0, 5, 0, 1, 8, 0, 0, 8, 1, 0, 8, 0, 1]), ucgen: new Uint32Array([0, 1, 2, 3, 4, 5]) };
  test('en yakın üçgen; arka yüzden de isabet', () => {
    expect(_mw3bUcgenKes(v(0, 0.2, 0.2), v(1, 0, 0), a, Infinity)).toBeCloseTo(5, 6);
    expect(_mw3bUcgenKes(v(10, 0.2, 0.2), v(-1, 0, 0), a, Infinity)).toBeCloseTo(2, 6);
  });
  test('ıskalayan ışın ve sınırdan uzak isabet: sınır döner', () => {
    expect(_mw3bUcgenKes(v(0, 0.8, 0.8), v(1, 0, 0), a, Infinity)).toBe(Infinity);
    expect(_mw3bUcgenKes(v(0, 0.2, 0.2), v(1, 0, 0), a, 4)).toBe(4);
    expect(_mw3bUcgenKes(v(6, 0.2, 0.2), v(-1, 0, 0), a, Infinity)).toBeCloseTo(1, 6);
  });
});

describe('KURULUMUN KUTUSU ve BEKLEYEN HESAP', () => {
  test('çubuğun verisi: işlenen / toplam parça, oran yüzden', () => {
    expect(_mw3bKurVeri({ islenen: 4512, toplam: 11694, yuz: 50, yuzToplam: 200 }))
      .toEqual({ ad: '3B kurulumu', metin: 'Parça 4.512 / 11.694', oran: 0.25 });
    expect(_mw3bKurVeri({ islenen: 0, toplam: 0, yuz: 0, yuzToplam: 0 }).oran).toBe(0);
  });
  test('hesap beklerken alttaki düğme kapalı, meşgul ve sebebi ipucunda', () => {
    const s = veMntStpOku(require('../helpers/step-takoz.js').gucGrubu());
    const st = { sonuc: s, roller: s.agac.map(() => null), coz: null, hesapBekliyor: { liste: [0], toplam: 1 } };
    st.roller[1] = 'mnt-motor';
    const d = document.createElement('div');
    d.innerHTML = veMntWiz3bAltHTML(st, -1);
    const b = d.querySelector('#ve-mw-3b-hesapla');
    expect(b.disabled).toBe(true);
    expect(b.getAttribute('aria-busy')).toBe('true');
    expect(b.getAttribute('title')).toBe('Parçaların ağı hazırlanıyor.');
    expect(b.textContent.trim()).toBe('Hesaplanıyor…');
    delete st.hesapBekliyor;
    d.innerHTML = veMntWiz3bAltHTML(st, -1);
    expect(d.querySelector('#ve-mw-3b-hesapla').disabled).toBe(false);
  });
});

// İKİ YER (2026-10-20, Takoz adım 4): 3B sihirbazın içinde ya da 3D
// Görüntüleyici penceresinin kendi perdesinde açılır; "Sihirbaza aktar"
// yalnız sihirbazın içinde — pencereden açılan 3B'de sihirbaz yok.
describe('ALT DİZİ — aktarım yalnız sihirbazın 3B\'sinde', () => {
  test('hesap sonrası aktarım düğmesi: varsayılan ve sihirbazda var, pencerede yok', () => {
    const s = veMntStpOku(require('../helpers/step-takoz.js').gucGrubu());
    const st = { sonuc: s, roller: s.agac.map(() => null), coz: { ok: true, birimler: [] } };
    st.roller[1] = 'mnt-motor';
    expect(veMntWiz3bAltHTML(st, -1)).toMatch(/id="ve-mw-3b-aktar"/);
    expect(veMntWiz3bAltHTML(st, -1, { aktar: true })).toMatch(/id="ve-mw-3b-aktar"/);
    expect(veMntWiz3bAltHTML(st, -1, { aktar: false })).not.toMatch(/ve-mw-3b-aktar/);
    expect(veMntWiz3bAltHTML(st, -1, { aktar: false })).toMatch(/id="ve-mw-3b-hesapla"/);
  });
});

// ── TAKOZ NOKTASI — daireden seçim (Takoz adım 5) ─────────────────────────
// Kip ve kenar araması WebGL ister (tests/e2e/mount-nokta.spec.js); burada
// kipin düğmeleri, takoz tablosunun Nokta sütunu ve ekran izdüşümü.
describe('DAİREDEN NOKTA — alttaki dizi, tablo, izdüşüm', () => {
  const S = require('../helpers/step-takoz.js');
  const son = veMntStpOku(S.tulgaKalibi({}));
  const i = (ad) => son.agac.findIndex((d) => d.ad === ad);
  const st = () => {
    const s = { sonuc: son, roller: son.agac.map(() => null), coz: null, kutle: {}, nokta: {} };
    s.roller[i('Sol ön takoz')] = 'mnt-mount';
    s.roller[i('Motor bloğu')] = 'mnt-motor';
    return s;
  };
  const alt = (s, sec, opt) => { const d = document.createElement('div'); d.innerHTML = veMntWiz3bAltHTML(s, sec, opt); return d; };

  test('düğme yalnız seçimin birimi takozken; parçası seçilince de (birim ata)', () => {
    const s = st();
    expect(alt(s, i('Sol ön takoz')).querySelector('#ve-mw-3b-nokta')).not.toBe(null);
    expect(alt(s, i('Sol ön takoz taban flanşı')).querySelector('#ve-mw-3b-nokta')).not.toBe(null);
    expect(alt(s, i('Motor bloğu')).querySelector('#ve-mw-3b-nokta')).toBe(null);
    expect(alt(s, i('Ön takoz')).querySelector('#ve-mw-3b-nokta')).toBe(null);          // rolsüz
    expect(alt(s, -1).querySelector('#ve-mw-3b-nokta')).toBe(null);
  });

  test('iç içe rol: kendi rolü olan düğüm atasının biriminde sayılmaz (panel · alt dizi)', () => {
    const s = st(), fl = i('Sol ön takoz taban flanşı'), d = document.createElement('div');
    s.roller[fl] = 'mnt-bracket';
    d.innerHTML = veMntWiz3bPanelHTML(s, fl);
    expect(d.textContent).not.toContain('biriminin içinde');
    expect(alt(s, fl).querySelector('#ve-mw-3b-nokta')).toBe(null);                    // birimi braket
    s.roller[fl] = null;
    d.innerHTML = veMntWiz3bPanelHTML(s, fl);
    expect(d.textContent).toContain('Sol ön takoz biriminin içinde');
  });

  test('kip basılı ve yönlendirmesi yalnız kipte; "Öneriye dön" yalnız seçilmiş dairede', () => {
    const s = st(), d0 = alt(s, i('Sol ön takoz'));
    expect(d0.querySelector('#ve-mw-3b-nokta').getAttribute('aria-pressed')).toBe('false');
    expect(d0.querySelector('.ve-mw-3b-nokta .ve-fw-3b-dizi-ad')).toBe(null);
    expect(d0.querySelector('#ve-mw-3b-nokta-oneri')).toBe(null);
    const d1 = alt(s, i('Sol ön takoz'), { nokta: true });
    expect(d1.querySelector('#ve-mw-3b-nokta').getAttribute('aria-pressed')).toBe('true');
    expect(d1.querySelector('.ve-mw-3b-nokta .ve-fw-3b-dizi-ad').textContent).toBe('Takozun dairesel kenarını seçin.');
    s.nokta[i('Sol ön takoz')] = { yol: ['A.1'], c: [0, 0, 0], r: 5 };
    const d2 = alt(s, i('Sol ön takoz taban flanşı'));
    expect(d2.querySelector('#ve-mw-3b-nokta-oneri').getAttribute('onclick')).toBe('veMntWizStpNokta(' + i('Sol ön takoz') + ', null)');
  });

  test('takoz tablosu: konum 0,001 mm, Nokta sütunu kaynağı; gövde 0,1 mm', () => {
    const s = st();
    s.coz = veMntStpCoz(son, s.roller);
    const d = document.createElement('div');
    d.innerHTML = veMntWiz3bPanelHTML(s, -1);
    const tr = d.querySelector('[data-ve-3b-takozlar] tbody tr');
    expect(Array.from(d.querySelectorAll('[data-ve-3b-takozlar] th')).map((x) => x.firstChild.textContent)).toEqual(['Takoz', 'Konum', 'Nokta']);
    expect(Array.from(tr.cells).map((c) => c.textContent.trim())).toEqual(['Sol ön takoz', '439,957; −355,957; 499,855', 'Üst yüz Ø 70,0']);
    expect(tr.getAttribute('data-ve-3b-nokta')).toBe('eksen');
    expect(tr.hasAttribute('data-uyari')).toBe(false);
    expect(d.querySelector('[data-ve-3b-govdeler] tbody tr td:nth-child(2)').textContent).toBe('125,0; 0,1; 750,0');
  });

  test('gövde tablosunda kütle: elle → alan; malzeme ya da dosya → türetilen değer + "S" (dayanağı ipucunda)', () => {
    const k = veMntStpOku(S.kutleKalibi());
    const j = (ad) => k.agac.findIndex((d) => d.ad === ad);
    const s = { sonuc: k, roller: k.agac.map(() => null), coz: null, kutle: {}, nokta: {}, yogunluk: {} };
    s.roller[j('Motor')] = 'mnt-motor'; s.roller[j('Şanzıman')] = 'mnt-gearbox'; s.roller[j('Arka braket')] = 'mnt-bracket';
    s.kutle[j('Motor')] = 418;
    s.yogunluk[j('Şanzıman')] = 'dosya'; s.yogunluk[j('Arka braket')] = 'celik';
    s.coz = veMntStpCoz(k, s.roller, { yogunluk: s.yogunluk });
    const d = document.createElement('div');
    d.innerHTML = veMntWiz3bPanelHTML(s, -1);
    const hucre = (ad) => d.querySelector('[data-ve-3b-govdeler] tr[data-ve-3b-birim="' + j(ad) + '"] td:nth-child(3)');
    expect(hucre('Motor').querySelector('input[data-mw-stp-kutle]').value).toBe('418');
    expect(hucre('Şanzıman').textContent).toBe('654,8S');
    expect(hucre('Arka braket').querySelector('[data-mw-stp-kutle-deger]').textContent).toBe('22,6');
    expect(hucre('Arka braket').querySelector('sup.ve-fw-kun').getAttribute('title')).toBe('STEP geometrisinden · Çelik · 7.850 kg/m³');
    // açık parçalı motorun satırı uyarılı; başlıkta yoğunluğun durumu yok (dosyada var)
    expect(d.querySelector('[data-ve-3b-govdeler] tr[data-ve-3b-birim="' + j('Motor') + '"]').hasAttribute('data-uyari')).toBe(true);
    expect(d.querySelectorAll('[data-ve-3b-govdeler] th')[2].getAttribute('title')).toBe(null);
  });

  test('ekran izdüşümü: kameranın önündeki nokta piksele, arkasındaki null', () => {
    // Birim izdüşüm (sütun düzeni): x, y doğrudan NDC; w = −z
    const e = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, -1, 0, 0, 0, 0];
    expect(_mw3bEkran(e, 0, 0, -1, 200, 100)).toEqual([100, 50]);
    expect(_mw3bEkran(e, 0.5, -0.5, -1, 200, 100)).toEqual([150, 75]);
    expect(_mw3bEkran(e, 0, 0, 1, 200, 100)).toBe(null);
  });
});

// ── GÖRÜNÜM (2026-11-02) ────────────────────────────────────────────────────
// Kullanıcı: "3D parçaları seçtiğimiz zaman görselleştirme güzel değil" ·
// "Ağırlık merkezi ve orta nokta görselleştirmesi güzel değil". Ölçülen önce
// (deneme montajı, 151 parça, şanzıman seçili): tül her soluk yüzeyi üst üste
// karıştırıyordu — ışın başına en çok 12, ortanca 3 katman; sonuçta yedi
// etiketten iki çift üst üste; ağırlık merkezi ve takoz noktası aynı koyu
// noktaydı; takoz tablosunda adın yerinde yalnız "…".
const ucMat = () => {
  class Color { constructor(c){ this.c = c; this.r = 0.5; this.g = 0.5; this.b = 0.5; } lerp(){ return this; } clone(){ return new Color(this.c); } }
  class Mat { constructor(o){ Object.assign(this, o || {}); } }
  return { Color, MeshStandardMaterial: Mat, MeshBasicMaterial: Mat, DoubleSide: 2 };
};
const V0 = 'void main() {\n#include <begin_vertex>\n#include <project_vertex>\n}';
const F0 = 'void main() {\n#include <emissivemap_fragment>\n}';
const derle = (m) => { const sh = { uniforms: {}, vertexShader: V0, fragmentShader: F0 }; m.onBeforeCompile(sh); return sh; };

describe('SEÇİM GÖRÜNÜMÜ — tek kat tül, köşede ayıklama', () => {
  let M;
  beforeAll(() => { global.THREE = ucMat(); M = { opak: _mw3bMalzeme('opak'), tul: _mw3bMalzeme('soluk'), on: _mw3bMalzeme('derinlik') }; });
  afterAll(() => { delete global.THREE; });

  test('ön geçiş renk yazmaz, derinlik yazar, tülün bir birim gerisinde; tül derinlik yazmaz', () => {
    expect(M.on.colorWrite).toBe(false);
    expect(M.on.depthWrite).not.toBe(false);
    expect(M.on.polygonOffsetUnits).toBeGreaterThan(M.tul.polygonOffsetUnits);
    expect(M.on.polygonOffsetFactor).toBe(M.tul.polygonOffsetFactor);
    expect(M.tul.transparent).toBe(true);
    expect(M.tul.depthWrite).toBe(false);
    expect(M.tul.opacity).toBe(VE_MW_3B_TUL.a);
    expect(M.opak.transparent).toBeFalsy();
  });

  test('her geçiş köşeyi durumuna göre kırpma alanının dışına atar; parça içinde discard yok', () => {
    const sh = { opak: derle(M.opak), tul: derle(M.tul), on: derle(M.on) };
    expect(sh.opak.vertexShader).toContain('if(mod(mwD, 2.0) > 0.5) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);');   // soluk köşe opakta yok
    expect(sh.tul.vertexShader).toContain('if(mod(mwD, 2.0) < 0.5) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);');    // soluk olmayan tülde yok
    expect(sh.on.vertexShader).toContain('if(mod(mwD, 2.0) < 0.5) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);');
    // ayıklama izdüşümden SONRA (gl_Position'ı project_vertex yazar)
    expect(sh.opak.vertexShader.indexOf('#include <project_vertex>')).toBeLessThan(sh.opak.vertexShader.indexOf('gl_Position = vec4(2.0'));
    Object.values(sh).forEach((s) => expect(s.fragmentShader).not.toContain('discard'));
    expect(['mw3b-opak', 'mw3b-tul', 'mw3b-derinlik']).toEqual([M.opak, M.tul, M.on].map((m) => m.customProgramCacheKey()));
  });

  test('parça içi durum yuvarlanarak okunur — aradeğerlenen 1,9999 seçimi düşürmüyor (kumlanma)', () => {
    [derle(M.opak), derle(M.tul)].forEach((s) => {
      expect(s.fragmentShader).toContain('float mwD = floor(vDurum + 0.5)');
      expect(s.fragmentShader).not.toMatch(/floor\(vDurum \/ 2\.0\)/);
    });
  });

  test('görünüş: seçili kenar başlık tonunda tam; rolsüz seçili parça vurgu tonunda; tülde kenar soluk', () => {
    const R = { bos: [1, 1, 1], bosSec: [2, 2, 2], cizgi: [3, 3, 3], cizgiSec: [4, 4, 4], cizgiFare: [5, 5, 5] }, rol = [9, 9, 9], A = VE_MW_3B_CIZGI_A;
    expect(veMntWiz3bGorunus(0, rol, R)).toEqual({ yuz: rol, cizgi: R.cizgi, a: A.olagan });
    expect(veMntWiz3bGorunus(VE_MW_3B_SECIK, rol, R)).toEqual({ yuz: rol, cizgi: R.cizgiSec, a: A.secili });
    expect(veMntWiz3bGorunus(VE_MW_3B_SECIK, R.bos, R).yuz).toBe(R.bosSec);
    expect(veMntWiz3bGorunus(VE_MW_3B_SOLUK, rol, R)).toEqual({ yuz: rol, cizgi: R.cizgi, a: A.soluk });
    expect(veMntWiz3bGorunus(VE_MW_3B_SOLUK | VE_MW_3B_FARE, rol, R).a).toBe(A.olagan);
    expect(veMntWiz3bGorunus(VE_MW_3B_FARE, rol, R)).toEqual({ yuz: rol, cizgi: R.cizgiFare, a: A.fare });
    expect(A.secili).toBeGreaterThan(A.fare);
    expect(A.fare).toBeGreaterThan(A.olagan);
    expect(A.olagan).toBeGreaterThan(A.soluk);
  });
});

describe('İŞARETLER — ağırlık merkezi CAD simgesi; takoz noktası ağırlık merkezi DEĞİL', () => {
  const svg = (t) => { const d = document.createElement('div'); d.innerHTML = '<svg>' + veMntWiz3bIsaretSVG(t, 10.04, 20) + '</svg>'; return d.querySelector('g'); };

  test('ağırlık merkezi dörde bölünmüş daire: iki koyu çeyrek (sağ üst · sol alt) ve çevre', () => {
    const g = svg('govde'), r = VE_MW_3B_ISARET.govde;
    expect(g.getAttribute('data-ve-3b-isaret')).toBe('govde');
    expect(g.getAttribute('transform')).toBe('translate(10 20)');
    expect(g.querySelector('path.d').getAttribute('d')).toBe('M0 0H' + r + 'A' + r + ' ' + r + ' 0 0 0 0 ' + (-r) + 'ZM0 0H' + (-r) + 'A' + r + ' ' + r + ' 0 0 0 0 ' + r + 'Z');
    expect(g.querySelectorAll('circle').length).toBe(2);
  });

  test('takoz noktası artılı halka: çeyrek yok, artı ve merkez; hâlesi zemin tonunda', () => {
    const g = svg('takoz');
    expect(g.querySelector('path.d')).toBe(null);
    expect(g.querySelector('path.a').getAttribute('d')).toMatch(/^M-\d+ 0H/);
    expect(g.querySelector('path.ha').getAttribute('d')).toBe(g.querySelector('path.a').getAttribute('d'));
    expect(g.querySelector('circle.m')).not.toBe(null);
  });

  test('modelin noktası kesikli halka, ağırlık merkezinden büyük; referans eşkenar dörtgen', () => {
    expect(+svg('model').querySelector('circle.h').getAttribute('r')).toBeGreaterThan(VE_MW_3B_ISARET.govde);
    expect(svg('ref').querySelector('path.r').getAttribute('d')).toBe('M0 -5L5 0L0 5L-5 0Z');
  });

  test('stiller: iki tonlu simge ve rol renginde halka jetondan; satır içi sabit renk yok', () => {
    const css = require('fs').readFileSync(require('path').join(__dirname, '../../css/styles.css'), 'utf8');
    expect(css).toMatch(/\.ve-mw-3b-is-govde \.d\{ fill:var\(--text-heading\); \}/);
    expect(css).toMatch(/\.ve-mw-3b-is-takoz \.z\{[^}]*stroke:var\(--accent-success\)/);
    expect(['govde', 'takoz', 'model', 'ref'].map((t) => veMntWiz3bIsaretSVG(t, 0, 0)).join('')).not.toMatch(/#[0-9a-f]{3,6}|style=/i);
  });
});

describe('ETİKET YERLEŞİMİ — üst üste binmez, kartın altına girmez', () => {
  const E = VE_MW_3B_ETK;
  const kesisir = (a, b) => a.sol === b.sol && Math.abs(a.y - b.y) < E.h + E.ara - 1e-9;

  test('aynı yere yığılan beş işaret: aynı yandaki etiketler arasında en az kutu boyu + ara', () => {
    const Q = [[400, 300], [402, 301], [398, 299], [401, 298], [399, 302]].map(([x, y]) => ({ x, y, gen: 120 }));
    const Y = veMntWiz3bEtiketYerlesim(Q, 1000, 700, 0);
    for (let i = 0; i < Y.length; i++) for (let j = i + 1; j < Y.length; j++) expect(kesisir(Y[i], Y[j])).toBe(false);
    Y.forEach((o) => { expect(o.y).toBeGreaterThanOrEqual(E.pay + E.h / 2); expect(o.y).toBeLessThanOrEqual(700 - E.pay - E.h / 2); });
  });

  test('dibe yığılan dizi birlikte yukarı kayar; kabın içinde kalır', () => {
    const Q = [0, 1, 2, 3].map((k) => ({ x: 600, y: 690 - k, gen: 80 }));
    const Y = veMntWiz3bEtiketYerlesim(Q, 1000, 700, 0);
    Y.forEach((o) => expect(o.y).toBeLessThanOrEqual(700 - E.pay - E.h / 2 + 1e-9));
    const sirali = Y.map((o) => o.y).sort((a, b) => a - b);
    for (let k = 1; k < sirali.length; k++) expect(sirali[k] - sirali[k - 1]).toBeGreaterThanOrEqual(E.h + E.ara - 1e-9);
  });

  test('sağdaki kartın şeridine taşan etiket sola geçer; sola sığmayan sağda kalır', () => {
    const Y = veMntWiz3bEtiketYerlesim([{ x: 500, y: 100, gen: 50 }, { x: 900, y: 200, gen: 150 }], 1000, 700, 300);
    expect(Y[1].sol).toBe(true);
    expect(Y[1].x).toBe(900 - E.dx);
    const Z = veMntWiz3bEtiketYerlesim([{ x: 30, y: 100, gen: 150 }, { x: 600, y: 100, gen: 50 }], 1000, 700, 0);
    expect(Z[0].sol).toBe(false);
    expect(veMntWiz3bEtiketYerlesim([], 100, 100, 0)).toEqual([]);
  });
});

describe('KOORDİNAT EKSENİ — Koordinat Düzlemi\'nin dili, kamerayla döner', () => {
  // Görüntüleyicinin yörünge kamerası (z yukarı): dünya matrisinin sütunları sağ · yukarı · geri
  const kamera = (theta, phi) => {
    const b = [Math.cos(phi) * Math.cos(theta), Math.cos(phi) * Math.sin(theta), Math.sin(phi)];
    let r = [-b[1], b[0], 0]; const l = Math.hypot(r[0], r[1]); r = r.map((v) => v / l);
    const u = [b[1] * r[2] - b[2] * r[1], b[2] * r[0] - b[0] * r[2], b[0] * r[1] - b[1] * r[0]];
    return [r[0], r[1], r[2], 0, u[0], u[1], u[2], 0, b[0], b[1], b[2], 0, 0, 0, 0, 1];
  };
  const kur = (me) => { const d = document.createElement('div'); d.innerHTML = '<svg>' + veMntWiz3bEksenSVG(me) + '</svg>'; return d.querySelector('svg'); };

  test('açılış bakışında +Z yukarı; üç ok, üç eksi yarı, üç düzlem, altı yazı', () => {
    const s = kur(kamera(VE_MW_3B_ACILIS.theta, VE_MW_3B_ACILIS.phi)), E = VE_MW_3B_EKSEN;
    expect(Array.from(s.querySelectorAll('text.ad')).map((t) => t.textContent).sort())
      .toEqual(['+X · Arka', '+Y · Sağ', '+Z · Yukarı', 'Aşağı', 'Ön', 'Sol'].sort());
    expect(s.querySelectorAll('polygon.dz').length).toBe(3);
    expect(s.querySelectorAll('line.ek:not(.eksi)').length).toBe(3);
    expect(s.querySelectorAll('line.ek.eksi').length).toBe(3);
    expect(s.querySelectorAll('polygon.uc').length).toBe(3);
    const z = s.querySelector('line.ek-z:not(.eksi)');
    expect(+z.getAttribute('y2')).toBeLessThan(E.h / 2 - E.L * 0.5);      // yukarı (ekranda y azalır)
    expect(Math.abs(+z.getAttribute('x2') - E.w / 2)).toBeLessThan(1e-6);  // düşey
    expect(s.querySelector('text.ad-z').getAttribute('dominant-baseline')).toBe('auto');
  });

  test('düzlemler ve oklar önce, yazılar en son (zemin hâlesi altındaki çizgiyi örter); oklar arkadan öne', () => {
    const s = kur(kamera(0.3, 0.5)), cocuk = Array.from(s.children);
    const ilkYazi = cocuk.findIndex((c) => c.tagName === 'text');
    expect(cocuk.slice(ilkYazi).every((c) => c.tagName === 'text')).toBe(true);
    // geri sütunu: x ekseninin derinliği me[8] — pozitif uç öne
    const me = kamera(0.3, 0.5), d = [me[8], me[9], me[10]];
    const okSira = cocuk.filter((c) => c.tagName === 'line').map((c) => {
      const i = 'xyz'.indexOf(c.getAttribute('class').match(/ek-([xyz])/)[1]);
      return c.classList.contains('eksi') ? -d[i] : d[i];
    });
    for (let k = 1; k < okSira.length; k++) expect(okSira[k]).toBeGreaterThanOrEqual(okSira[k - 1]);
  });

  test('üstten bakış: Z bakana doğru — ok başı yok, yazısı soluk işaretli', () => {
    const s = kur(kamera(0.75 * Math.PI, 1.5));
    expect(s.querySelector('polygon.uc-z')).toBe(null);
    expect(s.querySelector('text.ad-z').getAttribute('data-arka')).toBe('1');
    expect(s.querySelector('text.ad-x').hasAttribute('data-arka')).toBe(false);
  });
});
