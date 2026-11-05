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
eval(loadSource('cp-mount-3b-agac.js'));
eval(loadSource('cp-mount-3b-arac.js'));
eval(loadSource('cp-mount-3b-menu.js'));
const CAD = require('../../js/cp-mount-cad.js');
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
  test('hesap beklerken komut çubuğunun düğmesi kapalı, meşgul ve sebebi ipucunda', () => {
    const s = veMntStpOku(require('../helpers/step-takoz.js').gucGrubu());
    const st = { sonuc: s, roller: s.agac.map(() => null), coz: null, hesapBekliyor: { liste: [0], toplam: 1 } };
    st.roller[1] = 'mnt-motor';
    const d = document.createElement('div');
    d.innerHTML = veMntWiz3bEylemHTML(st);
    const b = d.querySelector('#ve-mw-3b-hesapla');
    expect(b.disabled).toBe(true);
    expect(b.getAttribute('aria-busy')).toBe('true');
    expect(b.getAttribute('title')).toBe('Parçaların ağı hazırlanıyor.');
    expect(b.textContent.trim()).toBe('Hesaplanıyor…');
    delete st.hesapBekliyor;
    d.innerHTML = veMntWiz3bEylemHTML(st);
    expect(d.querySelector('#ve-mw-3b-hesapla').disabled).toBe(false);
    // Seçimin bölümleri hesabı ve aktarımı taşımaz (komut çubuğunda)
    expect(veMntWiz3bAltHTML(st, -1)).not.toMatch(/ve-mw-3b-hesapla|ve-mw-3b-aktar/);
  });
});

// İKİ YER (2026-10-20, Takoz adım 4): 3B sihirbazın içinde ya da 3D
// Görüntüleyici penceresinin kendi perdesinde açılır; "Sihirbaza aktar"
// yalnız sihirbazın içinde — pencereden açılan 3B'de sihirbaz yok.
// 2026-11-02'ye dek aktarım yalnız sihirbazın 3B'sindeydi; "STEP'ten başla" dosyayı
// 3B'nin kendi perdesinde okuduğundan (kullanıcı kararı: "3B açılsın, sonra
// sihirbaz") aktarım iki yerde de var — pencereden sihirbazı açar.
describe('EYLEM — aktarım iki yerde de', () => {
  test('hesap sonrası aktarım düğmesi: varsayılan var; gizleme seçeneği yalnız açıkça istenince', () => {
    const s = veMntStpOku(require('../helpers/step-takoz.js').gucGrubu());
    const st = { sonuc: s, roller: s.agac.map(() => null), coz: { ok: true, birimler: [] } };
    st.roller[1] = 'mnt-motor';
    expect(veMntWiz3bEylemHTML(st)).toMatch(/id="ve-mw-3b-aktar"/);
    expect(veMntWiz3bEylemHTML(st, { aktar: true })).toMatch(/id="ve-mw-3b-aktar"/);
    expect(veMntWiz3bEylemHTML(st, { aktar: false })).not.toMatch(/ve-mw-3b-aktar/);
    expect(veMntWiz3bEylemHTML(st, { aktar: false })).toMatch(/id="ve-mw-3b-hesapla"/);
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

  test('iç içe rol: kendi rolü olan düğüm atasının biriminde sayılmaz (kimlik · bölümler)', () => {
    const s = st(), fl = i('Sol ön takoz taban flanşı'), d = document.createElement('div');
    s.roller[fl] = 'mnt-bracket';
    d.innerHTML = veMntWiz3bKimlikHTML(s, fl);
    expect(d.textContent).not.toContain('biriminin içinde');
    expect(alt(s, fl).querySelector('#ve-mw-3b-nokta')).toBe(null);                    // birimi braket
    s.roller[fl] = null;
    d.innerHTML = veMntWiz3bKimlikHTML(s, fl);
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

  test('birim satırı: takozda nokta 0,001 mm, kaynağı satırın ipucunda; gövdede CG 0,1 mm', () => {
    const s = st();
    s.coz = veMntStpCoz(son, s.roller);
    const d = document.createElement('div');
    d.innerHTML = veMntWiz3bPanelHTML(s, -1);
    const tk = d.querySelector('[data-ve-3b-grup="takoz"] [data-ve-3b-birim]');
    expect(tk.querySelector('.ve-mw-3b-birim-ad').textContent).toBe('Sol ön takoz');
    expect(tk.querySelector('.ve-mw-3b-birim-xyz').textContent).toBe('Nokta 439,957; −355,957; 499,855');
    expect(tk.getAttribute('title')).toBe('Üst yüz Ø 70,0');
    expect(tk.getAttribute('data-ve-3b-nokta')).toBe('eksen');
    expect(tk.hasAttribute('data-uyari')).toBe(false);
    const gv = d.querySelector('[data-ve-3b-grup="govde"] [data-ve-3b-birim]');
    expect(gv.querySelector('.ve-mw-3b-birim-xyz').textContent).toBe('CG 125,0; 0,1; 750,0');
  });

  test('gövde tablosunda kütle OKUNUR: elle → değer, türetilmiş → değer + "S" (dayanağı ipucunda); alan seçili birimin bölümünde', () => {
    const k = veMntStpOku(S.kutleKalibi());
    const j = (ad) => k.agac.findIndex((d) => d.ad === ad);
    const s = { sonuc: k, roller: k.agac.map(() => null), coz: null, kutle: {}, nokta: {}, yogunluk: {} };
    s.roller[j('Motor')] = 'mnt-motor'; s.roller[j('Şanzıman')] = 'mnt-gearbox'; s.roller[j('Arka braket')] = 'mnt-bracket';
    s.kutle[j('Motor')] = 418;
    s.yogunluk[j('Şanzıman')] = 'dosya'; s.yogunluk[j('Arka braket')] = 'celik';
    s.coz = veMntStpCoz(k, s.roller, { yogunluk: s.yogunluk });
    const d = document.createElement('div');
    d.innerHTML = veMntWiz3bPanelHTML(s, -1);
    const hucre = (ad) => d.querySelector('[data-ve-3b-birimler] [data-ve-3b-kg="' + j(ad) + '"]');
    expect(hucre('Motor').textContent).toBe('418,0 kg');
    expect(d.querySelector('[data-ve-3b-birimler] input')).toBe(null);
    expect(hucre('Şanzıman').textContent).toBe('654,8S kg');
    expect(hucre('Arka braket').textContent).toBe('22,6S kg');
    expect(hucre('Arka braket').querySelector('sup.ve-fw-kun').getAttribute('title')).toBe('STEP geometrisinden · Çelik · 7.850 kg/m³');
    // Kütlenin alanı seçili birimin bölümünde (kartın ve pencerenin alanıyla aynı nitelik)
    const b = document.createElement('div');
    b.innerHTML = veMntWiz3bBirimKutleHTML(s, j('Motor'));
    expect(b.querySelector('input[data-mw-stp-kutle="' + j('Motor') + '"]').value).toBe('418');
    b.innerHTML = veMntWiz3bBirimKutleHTML(s, j('Arka braket'));
    expect(b.querySelector('input')).toBe(null);
    expect(b.querySelector('[data-mw-stp-kutle-deger]').textContent).toBe('22,6');
    // açık parçalı motorun satırı uyarılı; başlıkta yoğunluğun durumu yok (dosyada var)
    expect(d.querySelector('[data-ve-3b-birimler] [data-ve-3b-birim="' + j('Motor') + '"]').hasAttribute('data-uyari')).toBe(true);
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

// ── GEZİNME — tekerlek imlecin altını tutar (kullanım notu T04) ───────────
// Önce tekerlek bakışın merkezine yakınlaşıyordu: iki arka takozun ortası 6
// adımda 626 px kayıp görüntüden çıkıyordu.
describe('İMLECİN ALTINDA YAKINLAŞMA — kamera P\'ye giden ışında kalır', () => {
  const ekle = (a, b, k = 1) => a.map((x, i) => x + k * b[i]);
  const fark = (a, b) => a.map((x, i) => x - b[i]);
  test('bakış yönü sabit; yeni kamera P\'ye aynı doğrultuda, uzaklık k katı', () => {
    const hedef = [100, -40, 300], u = [0.6, 0.48, 0.64], r = 2500, P = [380, 120, 410];
    [0.5, 0.887, 1.2].forEach((k) => {
      const h2 = veMntWiz3bYakinHedef(hedef, P, k);
      const c1 = ekle(hedef, u, r), c2 = ekle(h2, u, r * k);
      const a = fark(P, c1), b = fark(P, c2);
      // aynı doğrultu: çapraz çarpım sıfır, yön aynı, boy k katı
      const x = [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
      expect(Math.hypot(...x) / (Math.hypot(...a) * Math.hypot(...b))).toBeLessThan(1e-12);
      expect(a[0] * b[0] + a[1] * b[1] + a[2] * b[2]).toBeGreaterThan(0);
      expect(Math.hypot(...b) / Math.hypot(...a)).toBeCloseTo(k, 12);
    });
    // P hedefin kendisiyse hedef yerinde (eski davranış: bakışın merkezi)
    expect(veMntWiz3bYakinHedef(hedef, hedef, 0.5)).toEqual(hedef);
  });
});

// ── SEÇİM KİPİNDE ODAK (kullanım notu T05) ────────────────────────────────
describe('SEÇİM KİPİNDE ODAK — yalnız kipteki birimin işaretleri', () => {
  const I = [{ t: 'govde', u: 3 }, { t: 'ref', u: 3 }, { t: 'govde', u: 7 }, { t: 'takoz', u: 9 }, { t: 'model' }];
  test('referans ve daire kipinde birim, ölçüde hiçbiri, kip yokken hepsi', () => {
    expect(_mw3bSecimOdak({ ref: { birim: 3, tur: 'yuz' }, nokta: -1 })).toBe(3);
    expect(_mw3bSecimOdak({ ref: null, nokta: 9 })).toBe(9);
    expect(_mw3bSecimOdak({ ref: null, nokta: -1, olcu: { a: null } })).toBe(-1);
    expect(_mw3bSecimOdak({ ref: null, nokta: -1, olcu: null })).toBe(null);
    expect(veMntWiz3bOdakIsaret(I, 3).map((m) => m.t)).toEqual(['govde', 'ref']);
    expect(veMntWiz3bOdakIsaret(I, 9).map((m) => m.t)).toEqual(['takoz']);
    expect(veMntWiz3bOdakIsaret(I, -1)).toEqual([]);
    expect(veMntWiz3bOdakIsaret(I, null)).toBe(I);
  });
});

// ── ETİKET YALNIZ FARE ÜSTÜNDE (Canlı Not 12, 2026-11-05) ──────────────────
// Kullanıcı: "Konumları hesapla dediğimde program üzerine etiketler geliyor.
// Bunlar görünüyor sürekli. Bunların gölgeli olmasını ve sadece fare ile
// üzerine geldiğimde görünür olmasını istiyorum." Önce: hesaptan sonra her
// birimin etiketi (sınama montajında 7) sürekli; sonra 0 — yalnız farenin ve
// seçimin birimi.
describe('ETİKET YALNIZ FARE ÜSTÜNDE — işaret hep, etiket farenin ve seçimin birimine', () => {
  // kök(0) → Motor(1, rol) → blok(2) · kafa(3); Takoz(4, rol); başıboş parça(5)
  const agac = [
    { i: 0, ebeveyn: -1, cocuklar: [1, 4, 5] }, { i: 1, ebeveyn: 0, cocuklar: [2, 3] },
    { i: 2, ebeveyn: 1, cocuklar: [] }, { i: 3, ebeveyn: 1, cocuklar: [] }, { i: 4, ebeveyn: 0, cocuklar: [] }, { i: 5, ebeveyn: 0, cocuklar: [] }];
  const s = { sonuc: { agac, parcalar: [{ dugum: 2 }, { dugum: 3 }, { dugum: 4 }, { dugum: 5 }] },
              roller: [null, 'mnt-motor', null, null, 'mnt-mount', null] };
  test('kimse yokken boş; seçim, farenin parçası, ağacın satırı ve işaret birimini getirir', () => {
    expect(veMntWiz3bEtiketGoster(s, [], -1, -1, -1)).toEqual({});
    expect(veMntWiz3bEtiketGoster(s, [3], -1, -1, -1)).toEqual({ 1: 1 });       // seçili parçanın birimi
    expect(veMntWiz3bEtiketGoster(s, [], 0, -1, -1)).toEqual({ 1: 1 });         // fare motorun bloğunda
    expect(veMntWiz3bEtiketGoster(s, [], 3, -1, -1)).toEqual({});               // rolsüz parça: birimi yok
    expect(veMntWiz3bEtiketGoster(s, [], -1, 4, -1)).toEqual({ 4: 1 });         // ağaçta takozun satırı
    expect(veMntWiz3bEtiketGoster(s, [2, 4], -1, -1, 1)).toEqual({ 1: 1, 4: 1 });
  });
  test('farenin altındaki işaret: yarıçap içinde en yakını, dışında -1', () => {
    const L = [{ u: 1, x: 100, y: 100 }, { u: 4, x: 110, y: 100 }];
    expect(veMntWiz3bIsaretBul(L, 103, 100, 12)).toBe(1);
    expect(veMntWiz3bIsaretBul(L, 108, 101, 12)).toBe(4);
    expect(veMntWiz3bIsaretBul(L, 140, 100, 12)).toBe(-1);
    expect(veMntWiz3bIsaretBul(undefined, 0, 0, 12)).toBe(-1);
  });
  test('etiket yüzen kart: gölge boş değil; katı etiketi süzen tek çağrıdan', () => {
    const css = require('fs').readFileSync(require('path').join(__dirname, '../../css/styles.css'), 'utf8');
    expect(css).toMatch(/\.ve-mw-3b \.ve-fw-3b-etk\{[^}]*box-shadow:var\(--shadow-lg\);/);
    const src = loadSource('cp-mount-3b.js');
    expect(src).toMatch(/var B = Q\.filter\(function\(q\)\{ return q\.m\.b && G\[q\.m\.b\.dugum\]; \}\)/);
  });
});

// ── HAREKET VEKİLİ (kullanım notu T15) ────────────────────────────────────
describe('HAREKET VEKİLİ — yavaş karede sürüklerken parçaların kutuları', () => {
  test('kutu başına 12 kenar, köşeler kutunun köşeleri; sonlu olmayan kutu atlanır', () => {
    const K = [0, 0, 0, 1, 2, 3, NaN, 0, 0, 1, 1, 1, -1, -1, -1, 1, 1, 1];
    const L = veMntWiz3bKutuCizgi(K, 3);
    expect(L.length).toBe(2 * 72);
    const kose = new Set();
    for (let i = 0; i < 72; i += 3) kose.add([L[i], L[i + 1], L[i + 2]].join(','));
    expect([...kose].sort()).toEqual(['0,0,0', '0,0,3', '0,2,0', '0,2,3', '1,0,0', '1,0,3', '1,2,0', '1,2,3']);
    // her kenar tek eksende değişir, boyu o eksenin boyu
    for (let i = 0; i < 72; i += 6) {
      const d = [L[i + 3] - L[i], L[i + 4] - L[i + 1], L[i + 5] - L[i + 2]].map(Math.abs);
      expect(d.filter((x) => x > 0).length).toBe(1);
    }
    expect(VE_MW_3B_VEKIL.ms).toBeGreaterThanOrEqual(100);         // ekran kartlı karede (≤ 30 ms) vekil kurulmaz
  });
});

// ── ROL RENKLERİ — her rol ayrı renk, iki temada (kullanım notu T03) ────────
// Önce: klima kompresörü = şanzıman, ısı sacı = transfer kutusu, alternatör
// braketi = braket (aynı jeton), alternatör = PTO; mil = takoz ve pompa =
// transfer aynı hex. Ölçüt OKLab ΔE (×100): paletin kendi en yakın çifti
// (motor ↔ transfer, açık temada 6,6) eşiğin üstünde kalır.
describe('ROL RENKLERİ — her rolün rengi ötekilerden ayrı, iki temada', () => {
  const fs = require('fs');
  const path = require('path');
  const css = fs.readFileSync(path.join(__dirname, '../../css/styles.css'), 'utf8');
  const tema = (bas) => {
    const i = css.indexOf(bas), j = css.indexOf('}', i), t = {};
    const re = /--([\w-]+):\s*([^;]+);/g;
    let m;
    while ((m = re.exec(css.slice(i, j))) !== null) t[m[1]] = m[2].trim();
    return t;
  };
  const TEMA = { acik: tema(':root, [data-theme="acik"] {'), koyu: tema('[data-theme="koyu"] {') };
  const coz = (t, k) => { const v = t[k]; const m = v && v.match(/^var\(--([\w-]+)\)$/); return m ? coz(t, m[1]) : v; };
  const rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
  const lin = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const oklab = (h) => {
    const [r, g, b] = rgb(h).map(lin);
    const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
    const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
    const q = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
    return [0.2104542553 * l + 0.793617785 * m - 0.0040720468 * q, 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * q,
      0.0259040371 * l + 0.7827717662 * m - 0.808675766 * q];
  };
  const dE = (a, b) => { const A = oklab(a), B = oklab(b); return 100 * Math.hypot(A[0] - B[0], A[1] - B[1], A[2] - B[2]); };
  const lum = (h) => { const [r, g, b] = rgb(h).map(lin); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
  const oran = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  const ROLLER = Object.keys(VE_MW_3B_ROL_RENK);

  test('her rol ayrı jeton; her jeton iki temada 6 haneli hex', () => {
    expect(ROLLER.length).toBe(13);
    expect(new Set(ROLLER.map((r) => VE_MW_3B_ROL_RENK[r])).size).toBe(ROLLER.length);
    Object.keys(TEMA).forEach((t) => ROLLER.forEach((r) => {
      expect([t, r, coz(TEMA[t], VE_MW_3B_ROL_RENK[r].slice(2))]).toEqual([t, r, expect.stringMatching(/^#[0-9a-f]{6}$/i)]);
    }));
  });

  test('iki temada her çift OKLab ΔE ≥ 6,5; her renk zeminde ≥ 3:1', () => {
    Object.keys(TEMA).forEach((t) => {
      const T = TEMA[t], h = (r) => coz(T, VE_MW_3B_ROL_RENK[r].slice(2));
      const yakin = [];
      ROLLER.forEach((a, i) => ROLLER.slice(i + 1).forEach((b) => { if (dE(h(a), h(b)) < 6.5) yakin.push([t, a, b, +dE(h(a), h(b)).toFixed(1)]); }));
      expect(yakin).toEqual([]);
      ROLLER.forEach((r) => {
        expect([t, r, Math.min(oran(h(r), T['bg-primary']), oran(h(r), T['bg-secondary'])) >= 3]).toEqual([t, r, true]);
      });
    });
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

  test('açılış bakışında +Z yukarı; üç ok, üç eksi yarı, düzlem yok, altı yazı', () => {
    const s = kur(kamera(VE_MW_3B_ACILIS.theta, VE_MW_3B_ACILIS.phi)), E = VE_MW_3B_EKSEN;
    expect(Array.from(s.querySelectorAll('text.ad')).map((t) => t.textContent).sort())
      .toEqual(['+X · Arka', '+Y · Sağ', '+Z · Yukarı', 'Aşağı', 'Ön', 'Sol'].sort());
    expect(s.querySelectorAll('polygon.dz').length).toBe(0);
    expect(s.querySelectorAll('line.ek:not(.eksi)').length).toBe(3);
    expect(s.querySelectorAll('line.ek.eksi').length).toBe(3);
    expect(s.querySelectorAll('polygon.uc').length).toBe(3);
    const z = s.querySelector('line.ek-z:not(.eksi)');
    expect(+z.getAttribute('y2')).toBeLessThan(E.h / 2 - E.L * 0.5);      // yukarı (ekranda y azalır)
    expect(Math.abs(+z.getAttribute('x2') - E.w / 2)).toBeLessThan(1e-6);  // düşey
    expect(s.querySelector('text.ad-z').getAttribute('dominant-baseline')).toBe('auto');
  });

  // Kullanıcı 2026-11-05 (Canlı Not 14): "Şu koordinat görünümü çok çirkin
  // olmuş … üzerindeki yazıların sadece fare ile üstüne geldiğimde görünür".
  test('SADE: zemin dairesi ve düzlem yok; isabet dairesi ilk; yazılar yalnız fare üstünde', () => {
    const s = kur(kamera(0.3, 0.5));
    expect(s.querySelectorAll('.zm, polygon.dz').length).toBe(0);
    expect(s.firstElementChild.getAttribute('class')).toBe('hit');
    expect(+s.firstElementChild.getAttribute('r')).toBe(VE_MW_3B_EKSEN.zemin);
    const css = require('fs').readFileSync(require('path').join(__dirname, '../../css/styles.css'), 'utf8');
    expect(css).toMatch(/\.ve-mw-3b-eksen text\{[^}]*opacity:0;/);
    expect(css).toMatch(/\.ve-mw-3b-eksen:hover text\{ opacity:1; \}/);
    expect(css).toMatch(/\.ve-mw-3b-eksen\{[^}]*pointer-events:none;/);
    expect(css).toMatch(/\.ve-mw-3b-eksen \.hit\{ fill:transparent; pointer-events:all; \}/);
    expect(css).not.toMatch(/\.ve-mw-3b-eksen \.(zm|dz)/);
  });

  test('oklar önce, yazılar en son (zemin hâlesi altındaki çizgiyi örter); oklar arkadan öne', () => {
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

  // Kullanım notu T11: X bakışa dik gelince "+X · Arka" ile "Sol" aynı yere, "Ön"
  // Y'nin çizgisinin üstüne yazılıyordu. Bütün bakışlar taranır (5° adım).
  test('YAZILAR ÜST ÜSTE BİNMEZ: her bakışta iki yazının kutusu çakışmaz, eksi uç öteki eksenin çizgisine binmez', () => {
    const E = VE_MW_3B_EKSEN, cx = E.w / 2, c = E.h / 2;
    const kutu = (t) => _mw3bEksenKutu(+t.getAttribute('x'), +t.getAttribute('y'), t.getAttribute('text-anchor'),
      t.getAttribute('dominant-baseline'), t.textContent);
    let once = 0, sonra = 0, cizgide = 0, bakis = 0;
    for (let th = 0; th < 360; th += 5) {
      for (let ph = -85; ph <= 85; ph += 5) {
        const me = kamera(th * Math.PI / 180, ph * Math.PI / 180);
        bakis++;
        // ÖNCE: yazılar yerinde (ucun 6 · 5 px dışında), bakana dönük eksen ayrı
        const eski = [];
        [0, 1, 2].forEach((i) => {
          const sx = me[i], sy = me[4 + i], boy = Math.hypot(sx, sy);
          if (boy < 0.25) return;
          const ux = sx / boy, uy = -sy / boy, ad = VE_MW_3B_EKSEN_AD[i];
          const yer = (px, py, vx, vy, k, m) => eski.push(_mw3bEksenKutu(px + vx * k, py + vy * k,
            vx > 0.35 ? 'start' : vx < -0.35 ? 'end' : 'middle', vy > 0.35 ? 'hanging' : vy < -0.35 ? 'auto' : 'central', m));
          yer(cx + sx * E.L, c - sy * E.L, ux, uy, 6, ad[1]);
          yer(cx - sx * E.eksi * E.L, c + sy * E.eksi * E.L, -ux, -uy, 5, ad[2]);
        });
        eski.forEach((a, i) => eski.slice(i + 1).forEach((b) => { if (_mw3bKutuCakisir(a, b)) once++; }));
        const s = kur(me), yazi = Array.from(s.querySelectorAll('text')), K = yazi.map(kutu);
        K.forEach((a, i) => K.slice(i + 1).forEach((b) => { if (_mw3bKutuCakisir(a, b)) sonra++; }));
        yazi.forEach((t, i) => {
          if (t.hasAttribute('data-arka')) return;                        // orijinin yanında, eksenlerden uzak yönde
          const ad0 = t.textContent;
          if (!t.classList.contains('eksi') && !VE_MW_3B_EKSEN_AD.some((x) => x[1] === ad0)) return;
          const ad = t.textContent, e = VE_MW_3B_EKSEN_AD.findIndex((x) => x[2] === ad || x[1] === ad);
          Array.from(s.querySelectorAll('line.ek:not(.eksi)')).forEach((l) => {
            const j = 'xyz'.indexOf(l.getAttribute('class').match(/ek-([xyz])/)[1]);
            if (j === e) return;
            if (_mw3bKutuCizgi(K[i], { x1: cx, y1: c, x2: +l.getAttribute('x2'), y2: +l.getAttribute('y2') })) cizgide++;
          });
        });
      }
    }
    expect(bakis).toBe(72 * 35);
    expect(once).toBeGreaterThan(100);                   // önce: yüzlerce bakışta iki yazı üst üste
    expect([sonra, cizgide]).toEqual([0, 0]);                       // pozitif uçlar da öteki eksenin çizgisinde değil
  });

  test('üstten bakış: Z bakana doğru — ok başı yok; yalnız bakana dönük ucun yazısı, soluk ve orijinin yanında', () => {
    const s = kur(kamera(0.75 * Math.PI, 1.5)), E = VE_MW_3B_EKSEN;
    expect(s.querySelector('polygon.uc-z')).toBe(null);
    const z = s.querySelectorAll('text.ad-z');
    expect(z.length).toBe(1);
    expect(z[0].textContent).toBe('+Z · Yukarı');
    expect(z[0].getAttribute('data-arka')).toBe('1');
    // köşegende, öteki eksenlerin iki ucundan da uzak: açıların en küçüğü ≥ 40°
    const zx = +z[0].getAttribute('x') - E.w / 2, zy = +z[0].getAttribute('y') - E.h / 2;
    const me = kamera(0.75 * Math.PI, 1.5);
    [0, 1].forEach((i) => {
      const ux = me[i], uy = -me[4 + i], l = Math.hypot(ux, uy), cos = Math.abs(zx * ux + zy * uy) / (l * Math.hypot(zx, zy));
      expect(cos).toBeLessThan(Math.cos(40 * Math.PI / 180));
    });
    // iki uç ortada üst üste binerdi (kurulurken ölçüldü: "Ör+ZAşağıarı")
    expect(Array.from(s.querySelectorAll('text')).map((t) => t.textContent)).not.toContain('Aşağı');
    expect(s.querySelectorAll('text').length).toBe(5);
    expect(s.querySelector('text.ad-x').hasAttribute('data-arka')).toBe(false);
  });
});

// ── ÜRÜN AĞACI VE ÇOKLU SEÇİM (2026-11-02) ─────────────────────────────────
// Kullanıcı: "Ürün ağacının tıpkı 3D Experience programı gibi sol tarafta
// gösterilmesini istiyorum." · "Modelde birden fazla braket, birden fazla
// takoz olduğu için tek tek seçmek yerine CTRL tuşunu aktif edelim."
// Önce (main a8dd3a4): 3B'de ağaç yoktu, seçim tek düğümdü — dört takoza rol
// dört ayrı seçim + dört ayrı tık, her tıkta hesap yeniden koşuyordu.
const STK = require('../helpers/step-takoz.js');
const oturum = () => { _mwStp = null; return veMntWizStpOku(STK.gucGrubu(), 'guc.stp', 'duz'); };
const ad2i = (s, ad) => s.sonuc.agac.find((d) => d.ad === ad).i;
const takozlar = (s) => s.sonuc.agac.filter((d) => /takoz$/.test(d.ad)).map((d) => d.i);

describe('ÜRÜN AĞACI — kartla ortak açıklık, rol çipi, seçili satırlar', () => {
  test('satırlar kartın satırları; seçim işaretli, rol çipi rol renginde, rollü birimin içi soluk noktayla', () => {
    const s = oturum(), asm = ad2i(s, 'Arka braket'), ust = ad2i(s, 'Braket üst'), tk = takozlar(s);
    veMntWizStpRol(asm, 'mnt-bracket');
    // açılışta dal kapalı (Canlı Not 7): içi görünmez, düğme "Aç"
    let d = document.createElement('div');
    d.innerHTML = veMntWiz3bAgacHTML(s, []);
    expect(d.querySelector('[data-ve-3b-agac="' + ust + '"]')).toBeNull();
    expect(d.querySelector('[data-ve-3b-agac="' + asm + '"]').getAttribute('aria-expanded')).toBe('false');
    veMntWizStpAc(asm);
    d = document.createElement('div');
    d.innerHTML = veMntWiz3bAgacHTML(s, [tk[0], tk[1]]);
    const satir = Array.from(d.querySelectorAll('[data-ve-3b-agac]')).map((r) => +r.getAttribute('data-ve-3b-agac'));
    expect(satir).toEqual(_mwStpSatirlar(s).filter((x) => !x.daha).map((x) => x.i));
    expect(Array.from(d.querySelectorAll('[aria-selected="true"]')).map((r) => +r.getAttribute('data-ve-3b-agac'))).toEqual([tk[0], tk[1]]);
    expect(d.querySelectorAll('.ve-mw-3b-agac-r.on').length).toBe(2);
    const cip = d.querySelector('[data-ve-3b-agac="' + asm + '"] .ve-mw-3b-agac-rol');
    expect(cip.textContent).toBe('Braket');
    expect(cip.getAttribute('style')).toBe('--renk:var(' + VE_MW_3B_ROL_RENK['mnt-bracket'] + ')');
    const ic = d.querySelector('[data-ve-3b-agac="' + ust + '"]');
    expect(ic.classList.contains('ic')).toBe(true);
    expect(ic.querySelector('.ve-mw-3b-agac-ata').getAttribute('title')).toBe('Arka braket');
    // alt montaj simgesi paket, parça kutu; dal düğmesi açıklığı söyler
    const asmR = d.querySelector('[data-ve-3b-agac="' + asm + '"]');
    expect(asmR.getAttribute('aria-expanded')).toBe('true');
    expect(asmR.querySelector('.mf-ico-package')).not.toBe(null);
    expect(ic.querySelector('.mf-ico-box')).not.toBe(null);
  });

  test('sayfası bitmeyen dal "… düğüm daha" satırıyla biter; satırın tıkı seçime, Ctrl ekler', () => {
    const s = oturum(), kok = s.sonuc.agac.find((x) => x.ebeveyn < 0);
    s.acik[kok.i] = 1;
    const d = document.createElement('div');
    d.innerHTML = veMntWiz3bAgacHTML(s, []);
    expect(d.querySelector('.ve-mw-3b-agac-daha').textContent).toBe(' ' + veSayi(kok.cocuklar.length - 1, 0) + ' düğüm daha');
    expect(d.querySelector('.ve-mw-3b-agac-ad').getAttribute('onclick')).toMatch(/^veMntWiz3bAgacTik\(\d+, event\)$/);
  });

  test('3B\'de seçilen düğüm için açılacak dallar: her ata, yoldaki çocuğun sayfasına kadar', () => {
    const s = oturum(), ust = ad2i(s, 'Braket üst'), asm = ad2i(s, 'Arka braket');
    Object.keys(s.acik).forEach((k) => delete s.acik[k]);
    const ac = veMntWiz3bAgacAcilacak(s, ust);
    const atalar = []; for (let e = s.sonuc.agac[ust].ebeveyn; e >= 0; e = s.sonuc.agac[e].ebeveyn) atalar.push(String(e));
    expect(Object.keys(ac).sort()).toEqual(atalar.sort());
    expect(ac[asm]).toBe(Math.min(s.sonuc.agac[asm].cocuklar.length, VE_MW_STP_SAYFA));
    // zaten açık dal yeniden açılmaz; sayfanın ötesindeki çocuk sayfasını ister
    s.acik[asm] = s.sonuc.agac[asm].cocuklar.length;
    expect(veMntWiz3bAgacAcilacak(s, ust)[asm]).toBeUndefined();
    const sahte = { acik: { 0: 50 }, sonuc: { agac: [{ i: 0, ebeveyn: -1, cocuklar: Array.from({ length: 200 }, (_, k) => k + 1) }]
      .concat(Array.from({ length: 200 }, (_, k) => ({ i: k + 1, ebeveyn: 0, cocuklar: [] }))) } };
    expect(veMntWiz3bAgacAcilacak(sahte, 121)).toEqual({ 0: 150 });
    expect(veMntWiz3bAgacAcilacak(sahte, 30)).toEqual({});
  });
});

// ── SAĞ TIK MENÜSÜ (Canlı Not 8, 2026-11-05) ──────────────────────────────
// Kullanıcı: "3D görüntüleyicinin içine 'sağ klik' özelliğini getirelim … İşte
// parçayı hide yapma, seçilen parçayı ürün ağacında gösterme vs." Önce: tuvalde
// sağ tık hiçbir şey açmıyordu (yalnız tarayıcının menüsü engelliydi), gizleme yoktu.
describe('SAĞ TIK MENÜSÜ — satırlar seçimden, gizleme görünüm durumu', () => {
  const kok = (L) => L.map((o) => (o === '-' ? '-' : o.k));
  test('boşlukta yalnız görünüm; seçimde gizle · yalıt · ağaç · yakınlaştır · rol · temizle', () => {
    const s = oturum();
    expect(kok(veMntWiz3bMenuOgeleri(s, [], {}))).toEqual(['tumu', '-', 'sigdir']);
    expect(veMntWiz3bMenuOgeleri(s, [], {})[0].kapali).toBe(true);           // gizli yokken "Tümünü göster" kapalı
    const brk = ad2i(s, 'Arka braket');
    const L = veMntWiz3bMenuOgeleri(s, [brk], {});
    expect(kok(L)).toEqual(['gizle', 'yalniz', 'tumu', '-', 'agac', 'odak', 'sigdir', '-', 'rol', 'malzeme', '-', 'temizle']);
    expect(L.find((o) => o.k === 'yalniz').ad).toBe('Yalnız bunu göster');
    expect(veMntWiz3bMenuOgeleri(s, [brk, ad2i(s, 'Motor bloğu')], {}).find((o) => o.k === 'yalniz').ad).toBe('Yalnız seçimi göster');
    // Rol alt menüsü: rol listesinin HER rolü bir kez, gruplu; Rolü kaldır rolsüzken kapalı
    const rol = L.find((o) => o.k === 'rol').alt.filter((o) => o !== '-');
    expect(rol.filter((o) => o.rol).map((o) => o.rol).sort()).toEqual(VE_MNT_STP_ROLLER.slice().sort());
    expect(rol.find((o) => o.k === 'rol:').kapali).toBe(true);
    expect(veMntWiz3bRolGruplari().map((g) => g.ad)).toEqual(['Gövdeler', 'Takoz', 'Aktarma', 'Motor aksesuarları']);
  });
  test('malzeme yalnız kütlesi malzemeden gelebilen düğümde — takoz, motor, şanzıman ve içleri hariç', () => {
    const s = oturum(), motor = ad2i(s, 'Motor bloğu'), brk = ad2i(s, 'Arka braket'), tk = takozlar(s)[0];
    s.roller[motor] = 'mnt-motor'; s.roller[tk] = 'mnt-mount'; s.roller[brk] = 'mnt-bracket';
    expect([motor, tk, brk, ad2i(s, 'Braket üst')].map((d) => veMntWiz3bMalzemeAlir(s, d))).toEqual([false, false, true, true]);
    expect(kok(veMntWiz3bMenuOgeleri(s, [motor], {}))).not.toContain('malzeme');
    expect(kok(veMntWiz3bMenuOgeleri(s, [motor, brk], {}))).not.toContain('malzeme');   // biri almıyorsa yok
    const mz = veMntWiz3bMenuOgeleri(s, [brk], {}).find((o) => o.k === 'malzeme').alt.filter((o) => o !== '-');
    expect(mz.map((o) => o.k)).toEqual(VE_MNT_STP_MALZEME.map((m) => 'malzeme:' + m.k).concat(['malzeme:']));
  });
  test('gizle · göster · yalnız bunu · tümünü: seçimin parçaları üstünde; gizli düğüm ağaçta soluk', () => {
    const s = oturum(), brk = ad2i(s, 'Arka braket'), P = veMntWiz3bParcalar(s, brk);
    let G = veMntWiz3bGizliKume(s, [brk], {}, 'gizle');
    expect(Object.keys(G).map(Number).sort()).toEqual(P.slice().sort());
    expect(kok(veMntWiz3bMenuOgeleri(s, [brk], G))[0]).toBe('goster');
    expect(veMntWiz3bMenuOgeleri(s, [brk], G).find((o) => o.k === 'tumu').kapali).toBe(false);
    expect(veMntWiz3bDugumGizli(s, brk, G)).toBe(true);
    expect(veMntWiz3bDugumGizli(s, ad2i(s, 'Motor bloğu'), G)).toBe(false);
    expect(veMntWiz3bGizliKume(s, [brk], G, 'goster')).toEqual({});
    G = veMntWiz3bGizliKume(s, [brk], {}, 'yalniz');
    expect(Object.keys(G).length).toBe(s.sonuc.parcalar.length - P.length);
    expect(P.every((i) => !G[i])).toBe(true);
    expect(veMntWiz3bGizliKume(s, [], G, 'tumu')).toEqual({});
    // Ağaçta: gizli düğümün satırı soluk ve gizli simgeli; her satır sağ tıkla menüyü açar
    s.acik[brk] = s.sonuc.agac[brk].cocuklar.length;
    const d = document.createElement('div');
    d.innerHTML = veMntWiz3bAgacHTML(s, [], veMntWiz3bGizliKume(s, [brk], {}, 'gizle'));
    expect(d.querySelector('[data-ve-3b-agac="' + brk + '"]').classList.contains('gizli')).toBe(true);
    expect(d.querySelector('[data-ve-3b-agac="' + brk + '"] .ve-mw-3b-agac-gz .mf-ico-eye-off')).not.toBe(null);
    expect(d.querySelector('[data-ve-3b-agac="' + ad2i(s, 'Motor bloğu') + '"]').classList.contains('gizli')).toBe(false);
    d.querySelectorAll('.ve-mw-3b-agac-ad').forEach((b) => expect(b.getAttribute('oncontextmenu')).toMatch(/^veMntWiz3bAgacMenu\(\d+, event\)$/));
  });
  test('gizli parça her geçişte atılır, kenarı çizilmez, isabet almaz; menünün HTML\'i rol renkli, seçili işaretli', () => {
    const sh = { vertexShader: 'x\n#include <project_vertex>\ny' };
    _mw3bKoseAyikla(sh, false, false);
    expect(sh.vertexShader).toMatch(/if\(mwD > 7\.5\) gl_Position/);
    expect(VE_MW_3B_GIZLI).toBe(8);
    const src = loadSource('cp-mount-3b.js');
    expect(src).toMatch(/if\(V\.gizli && V\.gizli\[V\.ekli\[e\]\]\) continue;/);
    expect(src).toMatch(/if\(gizli\) G\.a = 0;/);
    const s = oturum(), tk = takozlar(s)[0];
    s.roller[tk] = 'mnt-mount';
    const d = document.createElement('div');
    d.innerHTML = veMntWiz3bMenuHTML(veMntWiz3bMenuOgeleri(s, [tk], {}));
    const m = d.querySelector('#ve-mw-3b-menu[role="menu"]');
    expect(m).not.toBe(null);
    expect(d.querySelector('[data-k="rol:mnt-mount"]').getAttribute('aria-checked')).toBe('true');
    expect(d.querySelector('[data-k="rol:mnt-mount"] .ve-mw-3b-menu-renk').getAttribute('style')).toBe('--renk:var(' + VE_MW_3B_ROL_RENK['mnt-mount'] + ')');
    expect(d.querySelector('[data-k="rol"]').getAttribute('aria-haspopup')).toBe('menu');
    expect(d.querySelector('[data-k="gizle"] .mf-ico-eye-off')).not.toBe(null);
  });
});

describe('ÇOKLU SEÇİM — rol seçimin hepsine, tek hesap', () => {
  test('dört takoz tek çağrıda: hepsi takoz, hesap BİR kez koşar (tek tek dört kez)', () => {
    const s = oturum(), tk = takozlar(s);
    veMntWizStpRol(ad2i(s, 'Motor bloğu'), 'mnt-motor');
    veMntWizStpHesapla();
    expect(s.coz && s.coz.ok).toBe(true);
    const asil = global.veMntStpCoz, say = { n: 0 };
    global.veMntStpCoz = function(){ say.n++; return asil.apply(this, arguments); };
    try {
      expect(veMntWizStpRolCok(tk, 'mnt-mount')).toBe(true);
      expect(tk.map((i) => s.roller[i])).toEqual(tk.map(() => 'mnt-mount'));
      expect(say.n).toBe(1);
      expect(s.coz.birimler.filter((b) => b.tip === 'mnt-mount').length).toBe(tk.length);
      say.n = 0;
      tk.forEach((i) => veMntWizStpRol(i, ''));
      expect(say.n).toBe(tk.length);
    } finally { global.veMntStpCoz = asil; }
    expect(veMntWizStpRolCok([], 'mnt-mount')).toBe(false);
    expect(veMntWizStpRolCok(tk, 'fead-crank')).toBe(false);
  });

  test('alttaki dizi: "Rol — N düğüm", liste yalnız hepsi o roldeyse o rolde, ayrışınca "Karışık"; takoz noktası ve veri sayfası yok', () => {
    const s = oturum(), tk = takozlar(s);
    veMntWizStpRol(tk[0], 'mnt-mount');
    const kur = (secim) => { const d = document.createElement('div'); d.innerHTML = veMntWiz3bAltHTML(s, secim[secim.length - 1], { secim }); return d; };
    const secili = (d) => d.querySelector('#ve-mw-3b-rol').selectedOptions[0];
    let d = kur([tk[0], tk[1]]);
    expect(d.querySelector('.ve-fw-3b-roller').getAttribute('aria-label')).toBe('Rol — 2 düğüm');
    expect([secili(d).textContent, secili(d).disabled]).toEqual(['Karışık', true]);
    expect(d.querySelector('#ve-mw-3b-rol option[value=""][data-ve-3b-rol=""]').disabled).toBe(false);   // "—" rolleri kaldırır
    // karışık seçimde son eklenen rollü olsa da liste o rolde değil
    expect(secili(kur([tk[1], tk[0]])).textContent).toBe('Karışık');
    veMntWizStpRol(tk[1], 'mnt-mount');
    d = kur([tk[0], tk[1]]);
    expect(d.querySelector('#ve-mw-3b-rol').value).toBe('mnt-mount');
    expect(d.querySelector('#ve-mw-3b-nokta')).toBe(null);
    expect(kur([tk[1]]).querySelector('#ve-mw-3b-nokta')).not.toBe(null);      // tek takozda var
  });

  test('kimlik: "N düğüm", düğümler ve birleşik parça sayısı; satırdan seçimden çıkarılır', () => {
    const s = oturum(), tk = takozlar(s);
    const d = document.createElement('div');
    d.innerHTML = veMntWiz3bKimlikHTML(s, tk[2], [tk[0], tk[2]]);
    const b = d.querySelector('[data-ve-3b-secili]');
    expect(b.getAttribute('data-ve-3b-secili')).toBe('2');
    expect(b.querySelectorAll('li').length).toBe(2);
    expect(b.querySelector('li.on .ve-fw-3b-yolb').textContent).toBe(s.sonuc.agac[tk[2]].ad);
    const ps = new Set(s.sonuc.agac[tk[0]].parcalar.concat(s.sonuc.agac[tk[2]].parcalar));
    expect(b.querySelector('.ve-mw-3b-kimlik-ad b').textContent).toBe('2 düğüm');
    expect(b.querySelector('.ve-mw-3b-kimlik-ad .ve-fw-dim').textContent).toBe(veSayi(ps.size, 0) + ' parça');
    expect(b.querySelector('li .ve-fw-mini').getAttribute('onclick')).toBe('veMntWiz3bSec(' + tk[0] + ', true)');
    // tek seçimde ad, tür ve yol
    d.innerHTML = veMntWiz3bKimlikHTML(s, tk[2], [tk[2]]);
    expect(d.querySelector('[data-ve-3b-secili]').getAttribute('data-ve-3b-secili')).toBe('1');
    expect(d.querySelector('.ve-fw-3b-yol')).not.toBe(null);
  });

  test('etiket soldaki ağacın şeridine girmez: sola taşan etiket sağa geçer', () => {
    const Y = veMntWiz3bEtiketYerlesim([{ x: 360, y: 100, gen: 120 }, { x: 800, y: 100, gen: 50 }], 1200, 700, 0, 300);
    expect(Y[0].sol).toBe(false);
    expect(veMntWiz3bEtiketYerlesim([{ x: 360, y: 100, gen: 120 }, { x: 800, y: 100, gen: 50 }], 1200, 700, 0, 0)[0].sol).toBe(true);
  });
});

// ── STEP'TEN BAŞLA (2026-11-02) ─────────────────────────────────────────────
// Kullanıcı: "Stepten başla butonuna tıkladığım zaman, ilk baştaki yükleme
// sihirbazı üzerinden okuyor. Bunu istemiyorum." → "3B açılsın, sonra sihirbaz".
// Önce (main 8f83e73): kapı sihirbazı açıp dosyayı kartında okuyordu.
describe('STEP\'TEN BAŞLA — dosya 3B\'nin perdesinde, sihirbazsız', () => {
  test('dosya seçilince sıra: araç şeridi (rollerin evi) → okuma pencerede → 3B; sihirbaz açılmaz', () => {
    const sira = [], ad = ['veMntKanvasBos', 'veMntWizStpDosya', 'veMntWiz3bAc', 'veMntWizAc'];
    const eski = ad.map((k) => global[k]);
    global.veMntKanvasBos = () => { sira.push('kanvas'); return [{}]; };
    global.veMntWizStpDosya = (f, yer) => { sira.push('oku:' + yer); };
    global.veMntWiz3bAc = (yer) => { sira.push('3b:' + yer); return true; };
    global.veMntWizAc = () => { sira.push('SİHİRBAZ'); return true; };
    try {
      expect(CAD.veMntCadStepBasla({ name: 'guc.stp' })).toBe(true);
      expect(sira).toEqual(['kanvas', 'oku:pencere', '3b:pencere']);
      expect(CAD.veMntCadStepBasla(null)).toBe(false);
    } finally { ad.forEach((k, i) => { if (eski[i] === undefined) delete global[k]; else global[k] = eski[i]; }); }
  });

  test('okuma kartı: işin adı ve okumanın eylem satırı (Vazgeç) — dosyanın adı komut çubuğunda; hata durumunda sebebi', () => {
    const d = document.createElement('div');
    d.innerHTML = _mw3bOkumaHTML({ dosya: 'guc.stp', durum: 'okunuyor', bayt: 100, ilerleme: { evre: 'dosya', oran: 0, bayt: 0, toplam: 100 } });
    expect(d.querySelector('.ve-mw-3b-is-bas').textContent.trim()).toBe('STEP okuma');
    expect(_mw3bKimlikHTML({ dosya: 'guc.stp' })).toMatch(/<b title="guc\.stp">guc\.stp<\/b>/);
    const v = d.querySelector('button[data-mw-stp-vazgec]');
    expect(v.id).toBe('ve-mw-3b-okuma-vazgec');
    expect(v.getAttribute('onclick')).toBe('veMntWizStpVazgec()');
    d.innerHTML = _mw3bOkumaHTML({ dosya: 'bozuk.stp', durum: 'hata', hata: 'ISO-10303-21 başlığı yok' });
    expect(d.querySelector('.ve-fw-issue-err').textContent).toBe(' bozuk.stp — ISO-10303-21 başlığı yok');
    expect(d.querySelector('[data-mw-stp-vazgec]')).toBe(null);
  });
});

// ── CAD ARAÇLARI: GÖRÜNÜŞLER VE KESİT (2026-11-02) ──────────────────────────
// Kullanıcı: "3D görüntüleyici tıpkı bir CAD programı gibi olmalı. Ölçümler,
// kesit alma vb. kullanışlı özellikleri ekleyeceğiz." Önce (main 6d04652):
// hazır bakış yoktu (yalnız Sığdır, yükseliş en çok ±1,5 rad), kesit yoktu.
describe('BAKIŞLAR — araç ekseninde hazır görünüşler', () => {
  // Görüntüleyicinin yörünge kamerası: geri = (cosφcosθ, cosφsinθ, sinφ), sağ = z × geri
  const taban = (g) => {
    const b = [Math.cos(g.phi) * Math.cos(g.theta), Math.cos(g.phi) * Math.sin(g.theta), Math.sin(g.phi)];
    let r = [-b[1], b[0], 0]; const l = Math.hypot(r[0], r[1]); r = r.map((v) => v / l);
    const u = [b[1] * r[2] - b[2] * r[1], b[2] * r[0] - b[0] * r[2], b[0] * r[1] - b[1] * r[0]];
    return { geri: b, sag: r, ust: u };
  };
  const yakin = (a, b) => a.every((v, i) => Math.abs(v - b[i]) < 2e-3);
  test('yedi bakış: Ön −X\'ten, Arka +X\'ten, Sol −Y\'den, Sağ +Y\'den, Üst ve Alt tam düşey, İzometrik eşit kısalma', () => {
    expect(VE_MW_3B_BAKIS.map((g) => g.ad)).toEqual(['Ön', 'Arka', 'Sol', 'Sağ', 'Üst', 'Alt', 'İzometrik']);
    const T = (k) => taban(veMntWiz3bBakisBul(k));
    expect(yakin(T('on').geri, [-1, 0, 0])).toBe(true);
    expect(yakin(T('on').sag, [0, -1, 0])).toBe(true);           // önden bakınca aracın sağı solda
    expect(yakin(T('arka').geri, [1, 0, 0])).toBe(true);
    expect(yakin(T('sol').geri, [0, -1, 0])).toBe(true);
    expect(yakin(T('sag').geri, [0, 1, 0])).toBe(true);
    expect(T('ust').geri[2]).toBeGreaterThan(0.99999);
    expect(T('alt').geri[2]).toBeLessThan(-0.99999);
    expect(T('ust').ust[0]).toBeGreaterThan(0.99);                // üstten: arka yukarıda
    const iz = T('izo').geri.map(Math.abs);
    expect(Math.max(...iz) - Math.min(...iz)).toBeLessThan(1e-12); // üç eksen eşit kısalır
    expect(VE_MW_3B_PHI).toBeGreaterThan(1.5);                    // sürükleme de tam düşeye dek
    expect(VE_MW_3B_PHI).toBeLessThan(Math.PI / 2);
  });
});

describe('KESİT — düzlem, aralık, çubuk, kesilen yanda seçilmez', () => {
  test('düzlem: eksenin küçük yanı kalır, Ters büyük yanı', () => {
    expect(veMntWiz3bKesitDuzlem({ eksen: 0, d: 100, ters: false })).toEqual([-1, 0, 0, 100]);
    expect(veMntWiz3bKesitDuzlem({ eksen: 2, d: -40, ters: true })).toEqual([0, 0, 1, 40]);
    const K = veMntWiz3bKesitDuzlem({ eksen: 1, d: 10, ters: false });
    expect(veMntWiz3bKesitKalir(K, 0, 9.9, 0)).toBe(true);
    expect(veMntWiz3bKesitKalir(K, 0, 10.1, 0)).toBe(false);
    expect(veMntWiz3bKesitKalir(null, 0, 1e9, 0)).toBe(true);
    expect(veMntWiz3bKesitDuzlem(null)).toBe(null);
    expect(veMntWiz3bKesitDuzlem({ eksen: 3, d: 0 })).toBe(null);
  });

  test('aralık montajın o eksendeki boyu, iki yanda %1 pay', () => {
    const kutu = { min: { x: 0, y: -50, z: 10 }, max: { x: 1000, y: 50, z: 10 } };
    expect(veMntWiz3bKesitAralik(kutu, 0)).toEqual([-10, 1010]);
    expect(veMntWiz3bKesitAralik(kutu, 1)).toEqual([-51, 51]);
    expect(veMntWiz3bKesitAralik(kutu, 2)).toEqual([9, 11]);       // sıfır boyda 1 mm pay
  });

  test('çubuk: yedi bakış ve Kesit; kesit açıkken eksen, kaydırıcı ve Ters', () => {
    const d = document.createElement('div');
    d.innerHTML = veMntWiz3bAracHTML({ kesit: null });
    expect(d.querySelectorAll('[data-ve-3b-bakis]').length).toBe(7);
    expect(d.querySelector('#ve-mw-3b-kesit').getAttribute('aria-pressed')).toBe('false');
    expect(d.querySelector('.ve-mw-3b-kesit')).toBe(null);
    d.innerHTML = veMntWiz3bAracHTML({ kesit: { eksen: 1, d: 12.34, ters: true }, aralik: [-51, 51] });
    expect(d.querySelector('#ve-mw-3b-kesit').getAttribute('aria-pressed')).toBe('true');
    expect(Array.from(d.querySelectorAll('[data-ve-3b-kesit-eksen]')).map((b) => b.getAttribute('aria-pressed'))).toEqual(['false', 'true', 'false']);
    const r = d.querySelector('#ve-mw-3b-kesit-d');
    expect([r.type, r.min, r.max, r.value]).toEqual(['range', '-51', '51', '12.34']);
    // değer yazılır (kullanım notu T12): sayı alanı, makine biçiminde, 0,1 mm
    const g = d.querySelector('#ve-mw-3b-kesit-gir');
    expect([g.type, g.getAttribute('inputmode'), g.getAttribute('value'), g.getAttribute('aria-label')])
      .toEqual(['text', 'decimal', '12.3', 'Kesit konumu [mm]']);
    expect(d.querySelector('#ve-mw-3b-kesit-deger').textContent).toBe('y =mm');
    expect(veMntWiz3bKesitMakine(-81.94)).toBe('-81.9');
    expect(d.querySelector('#ve-mw-3b-kesit-ters').getAttribute('aria-pressed')).toBe('true');
  });

  test('ışın kesilen yandaki üçgeni atlar, kalan yandakini bulur', () => {
    // x = 5 düzleminde bir üçgen; ışın −x'ten +x'e
    const ag = { uc: new Float32Array([5, -1, -1, 5, 1, -1, 5, 0, 2]), ucgen: new Uint32Array([0, 1, 2]) };
    const o = v(0, 0, 0), dir = v(1, 0, 0);
    expect(_mw3bUcgenKes(o, dir, ag, Infinity)).toBeCloseTo(5, 9);
    expect(_mw3bUcgenKes(o, dir, ag, Infinity, veMntWiz3bKesitDuzlem({ eksen: 0, d: 4, ters: false }))).toBe(Infinity);
    expect(_mw3bUcgenKes(o, dir, ag, Infinity, veMntWiz3bKesitDuzlem({ eksen: 0, d: 4, ters: true }))).toBeCloseTo(5, 9);
    expect(_mw3bUcgenKesK(o, dir, ag, Infinity, veMntWiz3bKesitDuzlem({ eksen: 0, d: 4, ters: false })).k).toBe(-1);
    expect(_mw3bUcgenKesK(o, dir, ag, Infinity, veMntWiz3bKesitDuzlem({ eksen: 0, d: 6, ters: false })).k).toBe(0);
  });
});


// 4b (2026-11-02): "Modelde yüzey seçme özelliğini de getirelim." · "Ölçümler…"
// Yüz tıklanan üçgenin ağdaki yüz aralığından, tanımı ve köşeleri DOSYADAN;
// ölçü iki nokta arası. Fareyle seçim ve yapışma gerçek tarayıcıda:
// tests/e2e/mount-3b.spec.js → YÜZEY · ÖLÇÜ.
describe('YÜZEY SEÇİMİ — tıklanan üçgenin yüzü, tanımı ve köşeleri dosyadan', () => {
  const P21 = require('../../js/step-p21.js');
  beforeAll(() => { Object.assign(global, P21); });              // veStepP21Yuz · Varlik · NoktaUygula
  const son = veMntStpOku(require('../helpers/step-takoz.js').gucGrubu());
  const ag = veMntStpAgUret(son, [], son.parcalar.map((p) => p.i));
  const s = { sonuc: son, ag };
  const parca = (ad) => son.parcalar.filter((p) => p.ad === ad)[0].i;
  const yuvarla = (P) => P.map((p) => p.map((x) => Math.round(x * 1000) / 1000)).sort();

  test('üçgenin yüzü ikili aramayla: aralığın başı dâhil, sonu hariç; boş yüz atlanır', () => {
    const Y = [0, 2, 5, 9];
    expect([0, 1, 2, 4, 5, 8].map((t) => veMntWiz3bYuzSira(Y, t))).toEqual([0, 0, 1, 1, 2, 2]);
    expect([9, -1, NaN].map((t) => veMntWiz3bYuzSira(Y, t))).toEqual([-1, -1, -1]);
    expect(veMntWiz3bYuzSira([0], 0)).toBe(-1);
    expect(veMntWiz3bYuzSira(null, 0)).toBe(-1);
    expect(veMntWiz3bYuzSira([0, 3, 3, 6], 3)).toBe(2);
  });

  test('motor kutusu: altı düzlem, normal dışa, alan ve dört köşe dosyadaki ölçüyle', () => {
    const pi = parca('Motor bloğu'), a = ag[pi], g = son._geo[pi];
    expect(a.yuzUcgen.length).toBe(7);
    const B = [0, 1, 2, 3, 4, 5].map((f) => veMntWiz3bYuzBilgi(s, pi, (a.yuzUcgen[f] + 1) * 3));   // yüzün ikinci üçgeni
    expect(B.map((b) => [b.f, b.tip])).toEqual([0, 1, 2, 3, 4, 5].map((f) => [f, 'PLANE']));
    // Kutu 900 × 700 × 800, merkezi (−300; 5; 850): her yüz kendi yanına bakar
    B.forEach((b) => {
      const j = b.n.findIndex((x) => Math.abs(x) === 1), c = [-300, 5, 850][j], yari = [450, 350, 400][j];
      expect(b.o[j]).toBeCloseTo(c + b.n[j] * yari, 9);
      expect(b.alan).toBeCloseTo(900 * 700 * 800 / (2 * yari), 6);     // hacim / o eksendeki boy
    });
    const ust = B.filter((b) => b.n[2] === 1)[0];
    expect(veMntWiz3bYuzYazi(ust)).toBe('Düzlem · z = 1.250,0 mm');
    expect(ust.aralik).toEqual([a.yuzUcgen[ust.f], a.yuzUcgen[ust.f + 1]]);
    expect(yuvarla(veMntWiz3bYuzKoseler(son._model, g.yuzler[ust.f], g.M, g.birim)))
      .toEqual(yuvarla([[-750, -345, 1250], [150, -345, 1250], [150, 355, 1250], [-750, 355, 1250]]));
  });

  test('silindir: Ø ve eksen dosyadan, alan ağdan (≈, iç teğet çokgen); köşeler dikişte', () => {
    const pi = parca('Sağ ön takoz'), a = ag[pi], g = son._geo[pi];
    const b = veMntWiz3bYuzBilgi(s, pi, a.yuzUcgen[0] * 3);
    expect(b.tip).toBe('CYLINDRICAL_SURFACE');
    expect(b.r).toBeCloseTo(45, 9);
    expect(Math.abs(b.eksen[2])).toBeCloseTo(1, 9);
    expect(b.n).toBeUndefined();
    expect(veMntWiz3bYuzYazi(b)).toBe('Silindir · Ø 90,0 mm');
    const tam = Math.PI * 45 * 60;                                  // yarım silindir, 60 mm boy
    expect(b.alan).toBeLessThan(tam);
    expect(b.alan).toBeGreaterThan(0.99 * tam);
    const L = veMntWiz3bYuzSatirlar(b);
    expect(L.map((r) => r[0])).toEqual(['Tip', 'Ø', 'Eksen', 'Eksen noktası', 'Alan']);
    expect(L[1][1]).toBe('90,000 mm');
    expect(L[4][1]).toMatch(/^≈ \d{1,3}(\.\d{3})* mm²$/);
    // Üst kapak: tek dikiş köşesi üst çemberin üstünde, z = 450
    const kapak = [0, 1, 2, 3].map((f) => veMntWiz3bYuzBilgi(s, pi, a.yuzUcgen[f] * 3)).filter((x) => x.tip === 'PLANE' && x.n[2] === 1)[0];
    const K = veMntWiz3bYuzKoseler(son._model, g.yuzler[kapak.f], g.M, g.birim);
    K.forEach((q) => {
      expect(q[2]).toBeCloseTo(450, 9);
      expect(Math.hypot(q[0] + 650, q[1] - 380)).toBeCloseTo(45, 9);
    });
  });

  test('düzlemin normali dışa: yüzün yönü yüzeyinkine ters ise (.F.) normal de ters', () => {
    const pi = parca('Motor bloğu'), asil = global.veStepP21Yuz;
    try {
      global.veStepP21Yuz = () => ({ tip: 'PLANE', ayni: false, o: [0, 0, 5], z: [0, 0, 1] });
      expect(veMntWiz3bYuzBilgi(s, pi, 0).n.map((x) => x + 0)).toEqual([0, 0, -1]);
      global.veStepP21Yuz = () => ({ tip: 'PLANE', ayni: true, o: [0, 0, 5], z: [0, 0, 1] });
      expect(veMntWiz3bYuzBilgi(s, pi, 0).n).toEqual([0, 0, 1]);
      global.veStepP21Yuz = () => { throw new Error('okunamadı'); };
      expect(veMntWiz3bYuzBilgi(s, pi, 0)).toMatchObject({ tip: '', ad: 'Serbest yüz' });
    } finally { global.veStepP21Yuz = asil; }
  });

  test('yüz yok: ağsız parça, dizinin dışı, yüz aralığı taşımayan ağ → null; okuyucusuz köşe yok', () => {
    const pi = parca('Motor bloğu');
    expect(veMntWiz3bYuzBilgi({ sonuc: son, ag: [] }, pi, 0)).toBe(null);
    expect(veMntWiz3bYuzBilgi(s, pi, ag[pi].ucgen.length)).toBe(null);
    const yalin = Object.assign({}, ag[pi]);
    delete yalin.yuzUcgen;
    const ag2 = ag.slice();
    ag2[pi] = yalin;
    expect(veMntWiz3bYuzBilgi({ sonuc: son, ag: ag2 }, pi, 0)).toBe(null);
    expect(veMntWiz3bYuzKoseler(null, 1, null, null)).toEqual([]);
  });

  test('ölçü: uzaklık ve bileşenleri', () => {
    expect(veMntWiz3bOlcuDeger([0, 0, 0], [3, 4, 12])).toEqual({ d: 13, dx: 3, dy: 4, dz: 12 });
    expect(veMntWiz3bOlcuDeger(null, [1, 2, 3])).toBe(null);
  });

  test('kart: ölçü ve yüzey bölümleri; boşken bölümün tek yönlendirmesi', () => {
    const d = document.createElement('div');
    d.innerHTML = veMntWiz3bAracKartHTML({ olcu: { a: null, b: null }, suzgec: 'parca' });
    expect(d.querySelector('[data-ve-3b-olcu] h4').textContent).toBe('Ölçü');
    expect(d.querySelector('[data-ve-3b-olcu] .ve-fw-dim').textContent).toBe('Modelde iki nokta seçin.');
    expect(d.querySelector('[data-ve-3b-yuz]')).toBe(null);
    d.innerHTML = veMntWiz3bAracKartHTML({ olcu: { a: { p: [-650, 380, 450], tur: 'daire', r: 45 }, b: null }, suzgec: 'parca' });
    expect(d.querySelector('[data-ve-3b-olcu-d]')).toBe(null);
    expect(d.textContent).toContain('Daire merkezi · Ø 90,000 mm');
    d.innerHTML = veMntWiz3bAracKartHTML({ olcu: { a: { p: [-650, 380, 450], tur: 'daire', r: 45 }, b: { p: [-650, -380, 450], tur: 'kose' } } });
    const u = d.querySelector('[data-ve-3b-olcu-d]');
    expect(+u.getAttribute('data-ve-3b-olcu-d')).toBe(760);
    expect(u.textContent).toBe('Uzaklık760,000 mm');
    const satir = Array.from(d.querySelectorAll('tr')).map((r) => Array.from(r.cells).map((c) => c.textContent));
    expect(satir).toContainEqual(['2', 'Köşe']);
    expect(satir).toContainEqual(['', '(−650,000; −380,000; 450,000)']);
    expect(satir).toContainEqual(['Δy', '−760,000 mm']);
    // Yüzey süzgeci: yüz yok → yönlendirme; yüz seçili → parça ve yüzün tablosu
    d.innerHTML = veMntWiz3bAracKartHTML({ olcu: null, suzgec: 'yuz', yuz: null });
    expect(d.querySelector('[data-ve-3b-olcu]')).toBe(null);
    expect(d.querySelector('[data-ve-3b-yuz] .ve-fw-dim').textContent).toBe('Modelde bir yüz seçin.');
    const pi = parca('Motor bloğu'), a = ag[pi];
    const ust = [0, 1, 2, 3, 4, 5].map((f) => veMntWiz3bYuzBilgi(s, pi, a.yuzUcgen[f] * 3)).filter((b) => b.n[2] === 1)[0];
    d.innerHTML = veMntWiz3bAracKartHTML({ suzgec: 'yuz', yuz: ust, parcaAd: 'Motor bloğu' });
    expect(Array.from(d.querySelectorAll('[data-ve-3b-yuz] tr')).map((r) => Array.from(r.cells).map((c) => c.textContent))).toEqual([
      ['Parça', 'Motor bloğu'], ['Tip', 'Düzlem'], ['Konum', 'z = 1.250,000 mm'], ['Normal', '(0,000; 0,000; 1,000)'], ['Alan', '≈ 630.000 mm²']
    ]);
    expect(d.querySelector('[data-ve-3b-yuz]').getAttribute('data-ve-3b-yuz')).toBe(String(ust.f));
  });

  test('alt dizi: ölçü ya da yüzey süzgecinde parça ağaçtan seçilir — yönlendirme onu söyler', () => {
    const st = { sonuc: son, roller: son.agac.map(() => null), coz: null };
    const d = document.createElement('div');
    d.innerHTML = veMntWiz3bAltHTML(st, -1, {});
    expect(d.querySelector('.ve-fw-3b-dizi-ad').textContent).toBe('Seçili parça yok. Modelde bir parça seçin.');
    d.innerHTML = veMntWiz3bAltHTML(st, -1, { agactan: true });
    expect(d.querySelector('.ve-fw-3b-dizi-ad').textContent).toBe('Seçili parça yok. Ürün ağacından bir parça seçin.');
  });

  test('çubuk: Parça · Yüzey süzgeci ve Ölçü; basılılık durumdan', () => {
    const d = document.createElement('div'), bas = () => ['[data-ve-3b-suzgec="parca"]', '[data-ve-3b-suzgec="yuz"]', '#ve-mw-3b-olcu']
      .map((q) => d.querySelector(q).getAttribute('aria-pressed'));
    d.innerHTML = veMntWiz3bAracHTML({ kesit: null });
    expect(bas()).toEqual(['true', 'false', 'false']);
    d.innerHTML = veMntWiz3bAracHTML({ kesit: null, suzgec: 'yuz', olcu: true });
    expect(bas()).toEqual(['false', 'true', 'true']);
    expect(d.querySelector('[role="group"][aria-label="Seçim"]').querySelectorAll('button').length).toBe(2);
  });
});

// ── TAM EKRAN ve İŞ KARTI (2026-11-04) ───────────────────────────────────────
// Kullanıcı: "3D görüntüleyici popup şeklinde açılır pencere halinde geliyor …
// Tam ekran olsun. Kapatma olayı başka yere taşınsın" ve "STEP yükleme ekranı …
// yazılar büyük, tam ortada … sağ alta çekelim". Önce: perde 12 px payla modal,
// başlık bandı + ✕; okuma tuvalin ortasında 460 px'lik kart, başlığı 16 px;
// kurulum kutusu sol üstte. Gerçek tarayıcı: tests/e2e/mount-3b.spec.js →
// *DURDUR · DEVAM* (kartın yeri, tam ekran) · tests/e2e/mount-cad.spec.js (Kapat).
describe('TAM EKRAN ve İŞ KARTI — başlık bandı yok, Kapat komut çubuğunda, iş sağ altta', () => {
  const fs = require('fs'), path = require('path');
  const css = fs.readFileSync(path.join(__dirname, '../../css/styles.css'), 'utf8');
  const html = fs.readFileSync(path.join(__dirname, '../../index.html'), 'utf8');
  const kaynak = fs.readFileSync(path.join(__dirname, '../../js/cp-mount-3b.js'), 'utf8');
  const kural = (sec) => { const i = css.indexOf('\n' + sec + '{'); return i < 0 ? null : css.slice(i + 1, css.indexOf('}', i)).replace(/\s+/g, ' '); };
  const kur = (h) => { const d = document.createElement('div'); d.innerHTML = h; return d; };

  test('tam ekran: perde payı, kabuğun köşesi ve gölgesi yok; pencerenin perdesi sınıfı taşır, sihirbazınkine 3B açıkken yazılır', () => {
    expect(kural('.ve-settings-overlay.ve-mw-3b-tam')).toMatch(/padding:0/);
    const m = kural('.ve-mw-3b-tam .ve-fw-modal');
    expect(m).toMatch(/width:100vw; max-width:none; height:100vh; max-height:none/);
    expect(m).toMatch(/border:0; border-radius:0; box-shadow:none/);
    const i = html.indexOf('id="ve-mnt-3b-overlay"'), etiket = html.slice(i, html.indexOf('>', i));
    expect(etiket).toMatch(/class="ve-settings-overlay ve-mw-3b-tam"/);
    expect(etiket).not.toMatch(/ve-fw-3b-genis/);                       // FEAD'in sınıfı FEAD'de kalır
    const o = document.createElement('div'); o.id = 've-mntwiz-overlay'; document.body.appendChild(o);
    _mw3bTam(true);
    expect([o.classList.contains('ve-mw-3b-tam'), o.classList.contains('ve-fw-3b-genis')]).toEqual([true, false]);
    _mw3bTam(false);
    expect(o.classList.contains('ve-mw-3b-tam')).toBe(false);
    o.remove();
  });

  test('başlık bandı yok: pencere ailesinin başlığı ve ✕\'i kurulmaz; dosyanın adı ve Kapat komut çubuğunun iki ucunda', () => {
    expect(kaynak).not.toMatch(/ve-settings-header|ve-settings-close/);
    const k = kur(_mw3bKimlikHTML({ dosya: 'tulga_guc_grubu_cok_uzun_bir_ad.stp', sonuc: { parcalar: [1, 2, 3] } }));
    const b = k.querySelector('#ve-mw-3b-dosya b');
    expect(b.textContent).toBe('tulga_guc_grubu_cok_uzun_bir_ad.stp');
    expect(b.getAttribute('title')).toBe(b.textContent);                // kısalan ad tam hâliyle ipucunda
    expect(k.textContent).not.toMatch(/parça/);                         // parça sayısı ağacın başlığında, tekrar yok
    const c = kur(_mw3bKapatHTML()).querySelector('button');
    expect([c.id, c.getAttribute('onclick'), c.textContent.trim()]).toEqual(['ve-mw-3b-kapat', 'veMntWiz3bKapat()', 'Kapat']);
    // Sıra: kimlik · araçlar · Kapat (eylem çubukta DEĞİL — Canlı Not 11); okunurken kimlik · Kapat
    expect(kaynak).toMatch(/'<div class="ve-mw-3b-komut">' \+ _mw3bKimlikHTML\(s\) \+ '<div class="ve-mw-3b-arac" id="ve-mw-3b-arac"><\/div>'\s*\+ _mw3bKapatHTML\(\) \+ '<\/div>'/);
    expect(kaynak).toMatch(/'<div class="ve-mw-3b-komut">' \+ _mw3bKimlikHTML\(s\) \+ _mw3bKapatHTML\(\) \+ '<\/div>'/);
    expect(kural('.ve-mw-3b-dosya + .ve-mw-3b-kapat')).toMatch(/margin-left:auto/);
    // Çubuğun dosya kimliği Özellikler'in seçim kimliğiyle sınıf PAYLAŞMAZ (2026-11-05:
    // çubuğun 26 px'lik kutusu seçimin adını ve yolunu Rol satırının üstüne bindiriyordu)
    expect(css).not.toMatch(/\n\.ve-mw-3b-kimlik\{/);
    expect(k.querySelector('#ve-mw-3b-dosya').className).toBe('ve-mw-3b-dosya');
  });

  test('iş kartı tuvalin SAĞ ALTINDA, ortada değil; adı gövde puntosunda; okuma ve kurulum AYNI kart', () => {
    const k = kural('.ve-mw-3b-is');
    expect(k).toMatch(/position:absolute; right:16px; bottom:16px/);
    expect(k).not.toMatch(/left:|top:|transform/);
    expect(kural('.ve-mw-3b-is-bas')).toMatch(/font-size:var\(--fs-body\)/);
    expect(css).not.toMatch(/\.ve-mw-3b-okuma\{|\.ve-mw-3b-kur\{/);          // ortadaki kart ve sol üstteki kutu emekli
    expect(kaynak).toMatch(/class="ve-mw-3b-okuma ve-mw-3b-is" id="ve-mw-3b-okuma"/);
    expect(kaynak).toMatch(/class="ve-mw-3b-kur ve-mw-3b-is" id="ve-mw-3b-kur" hidden/);
    // Kartın adı ilerlemenin adı (çubuğun erişilebilir adıyla aynı): 'STEP okuma' · '3B kurulumu'
    const d = kur(_mw3bOkumaHTML({ dosya: 'guc.stp', durum: 'okunuyor', bayt: 100, ilerleme: { evre: 'dosya', oran: 0.5, bayt: 50, toplam: 100 } }));
    expect(d.querySelector('.ve-mw-3b-is-bas').textContent.trim()).toBe(d.querySelector('.ve-fp-ilerleme').getAttribute('aria-label'));
    expect(_mw3bKurVeri({ islenen: 0, toplam: 0, yuz: 0, yuzToplam: 0 }).ad).toBe('3B kurulumu');
  });
});

// ── ÇALIŞMA MASASI (2026-11-03) ──────────────────────────────────────────────
// Kullanıcı: "3B görüntüleyicinin arayüzü, kullanımı, görünümü çok çok amatör
// seviyede" → tasarım tuvalinden "Çalışma masası" seçildi. Önce (main f84be2e):
// ağaç, kart ve rol dizisi tuvalin ÜSTÜNDE yüzüyordu; görünüş tek, bakış yalnız
// düğme sırası, ağaçta arama yok; birimin kütlesi kaynağıyla yalnız pencerede,
// toplam yok. Ölçümler PR gövdesinde; gerçek tarayıcı: tests/e2e/mount-3b.spec.js
// → *ÇALIŞMA MASASI*.
describe('ÇALIŞMA MASASI — paneller tuvalin yanında, eylem, kimlik, kütle, görünüş, arama', () => {
  const fs = require('fs'), path = require('path');
  const css = fs.readFileSync(path.join(__dirname, '../../css/styles.css'), 'utf8');
  const kural = (sec) => { const i = css.indexOf('\n' + sec + '{'); return i < 0 ? null : css.slice(i + 1, css.indexOf('}', i)); };
  const kutleDurumu = () => {
    const k = veMntStpOku(STK.kutleKalibi());
    const j = (ad) => k.agac.findIndex((d) => d.ad === ad);
    const s = { sonuc: k, roller: k.agac.map(() => null), coz: null, kutle: {}, nokta: {}, yogunluk: {} };
    s.roller[j('Motor')] = 'mnt-motor'; s.roller[j('Şanzıman')] = 'mnt-gearbox'; s.roller[j('Arka braket')] = 'mnt-bracket';
    s.kutle[j('Motor')] = 418;
    s.yogunluk[j('Şanzıman')] = 'dosya'; s.yogunluk[j('Arka braket')] = 'celik';
    s.coz = veMntStpCoz(k, s.roller, { yogunluk: s.yogunluk });
    return { s, j };
  };
  const kur = (h) => { const d = document.createElement('div'); d.innerHTML = h; return d; };

  test('yerleşim: tuval ile iki panel tek ızgarada, tuval göreli, paneller yüzmez — FEAD\'in ortak kuralları yüzen kartta', () => {
    expect(kural('.ve-mw-3b > .ve-fw-3b-govde.ve-mw-3b-masa')).toMatch(/display:grid; grid-template-columns:var\(--mw3b-agac\) minmax\(0, 1fr\) var\(--mw3b-yan\)/);
    expect(kural('.ve-mw-3b-masa > .ve-fw-3b-tuval')).toMatch(/position:relative; inset:auto/);
    expect(kural('.ve-mw-3b-yan')).not.toMatch(/position:\s*absolute/);
    expect(kural('.ve-mw-3b-agac')).not.toMatch(/position:\s*absolute/);
    expect(kural('.ve-mw-3b-komut')).not.toMatch(/position:\s*absolute/);
    // Dar pencere kararı pencereye sorulur; değişkenler kabın kendisine değil ızgaraya yazılır
    expect(css).toMatch(/@container vefw3b \(max-width: 1120px\)\{\n  \.ve-mw-3b > \.ve-fw-3b-govde\.ve-mw-3b-masa\{ --mw3b-agac/);
    expect(kural('.ve-fw-3b-tuval')).toMatch(/position:absolute; inset:0/);
    expect(kural('.ve-fw-3b-yan')).toMatch(/position:absolute/);
  });

  // Kullanıcı 2026-11-05 (Canlı Not 11): "'konumları hesapla' butonu var. Bu
  // butonun burada olmasına gerek yok … tanımları yaptıktan sonra programın sağ
  // alt köşesinde ortaya falan çıksın." Eylem tuvalin sağ altındaki kartta, iş
  // kartıyla aynı köşede; rol verilmeden kart yok; düğmenin adı "Hesapla".
  test('EYLEM KARTI: tuvalin sağ altında, iş kartıyla aynı dizide; rolsüz gizli; "Hesapla"; durum satırı yalnız engel ve rol eksiği', () => {
    expect(loadSource('cp-mount-3b.js')).toMatch(/'<div class="ve-mw-3b-sagalt"><div class="ve-mw-3b-kur ve-mw-3b-is" id="ve-mw-3b-kur" hidden><\/div>'\s*\+ '<div class="ve-mw-3b-eylem ve-mw-3b-is" id="ve-mw-3b-eylem" hidden><\/div><\/div>'/);
    expect(kural('.ve-mw-3b-sagalt')).toMatch(/position:absolute; right:16px; bottom:16px;/);
    expect(kural('.ve-mw-3b-sagalt > .ve-mw-3b-is')).toMatch(/position:static/);
    const S = veMntStpOku(STK.gucGrubu());
    const st = { sonuc: S, roller: S.agac.map(() => null), coz: null };
    expect(veMntWiz3bEylemGorunur(st)).toBe(false);
    st.roller[1] = 'mnt-motor';
    expect(veMntWiz3bEylemGorunur(st)).toBe(true);
    let d = kur(veMntWiz3bEylemHTML(st));
    expect(d.querySelector('#ve-mw-3b-hesapla').textContent.trim()).toBe('Hesapla');
    expect(d.querySelector('.ve-fw-issue')).toBe(null);                      // hesaptan önce durum satırı yok
    // Hesaptan sonra: rolün eksiği (takoz sayısı) kartta; ağın kapatma payı (dosya ayrıntısı) yazılmaz
    st.durum = 'hazir';
    st.coz = { ok: true, birimler: [{ tip: 'mnt-motor', dugum: 1 }], hatalar: [], uyarilar: ['"Motor": 3 gövdenin açıklığı kapatıldı; birim yüzeyindeki payı %0,1.'] };
    expect(veMntWizStpDenetim(st).uyari).toHaveLength(2);                    // pencerenin kartı ikisini de yazar
    d = kur(veMntWiz3bEylemHTML(st));
    expect(Array.from(d.querySelectorAll('.ve-fw-issue')).map((x) => x.textContent.trim())).toEqual(['0 takoz rolü (en az 3).']);
  });

  test('eylem: SIRADAKİ adım vurgulu — hesaptan önce hesapla, sonra aktar; ölçülemeyince yine hesap; rolsüzken kapalı ve sebebi ipucunda', () => {
    const S = veMntStpOku(STK.gucGrubu());
    const st = { sonuc: S, roller: S.agac.map(() => null), coz: null };
    const ana = (d, id) => d.querySelector(id).classList.contains('ve-mw-3b-hap-ana');
    let d = kur(veMntWiz3bEylemHTML(st));
    expect(d.querySelector('#ve-mw-3b-hesapla').disabled).toBe(true);
    expect(d.querySelector('#ve-mw-3b-hesapla').getAttribute('title')).toBe('Hiçbir parçaya rol verilmedi.');
    st.roller[1] = 'mnt-motor';
    d = kur(veMntWiz3bEylemHTML(st));
    expect([ana(d, '#ve-mw-3b-hesapla'), d.querySelector('#ve-mw-3b-aktar')]).toEqual([true, null]);
    st.coz = { ok: true, birimler: [] };
    d = kur(veMntWiz3bEylemHTML(st));
    expect([ana(d, '#ve-mw-3b-hesapla'), ana(d, '#ve-mw-3b-aktar')]).toEqual([false, true]);
    expect(d.querySelector('#ve-mw-3b-hesapla').textContent.trim()).toBe('Yeniden hesapla');
    st.coz = { ok: false, birimler: [] };
    d = kur(veMntWiz3bEylemHTML(st));
    expect([ana(d, '#ve-mw-3b-hesapla'), d.querySelector('#ve-mw-3b-aktar')]).toEqual([true, null]);
  });

  test('kimlik: alt montajda tür ve parça sayısı, parçada "Parça", yol atayı seçer; seçimsiz boş', () => {
    const s = oturum(), asm = ad2i(s, 'Arka braket'), ust = ad2i(s, 'Braket üst');
    let d = kur(veMntWiz3bKimlikHTML(s, asm, [asm]));
    expect(d.querySelector('.ve-mw-3b-kimlik-ad b').textContent).toBe('Arka braket');
    expect(d.querySelector('.ve-mw-3b-kimlik-ad .ve-fw-dim').textContent)
      .toBe('Alt montaj · ' + veSayi(s.sonuc.agac[asm].parcalar.length, 0) + ' parça');
    expect(d.querySelector('.ve-mw-3b-kimlik-ik .mf-ico-package')).not.toBe(null);
    d = kur(veMntWiz3bKimlikHTML(s, ust, [ust]));
    expect(d.querySelector('.ve-mw-3b-kimlik-ad .ve-fw-dim').textContent).toBe('Parça');
    expect(d.querySelector('.ve-mw-3b-kimlik-ik .mf-ico-box')).not.toBe(null);
    expect(d.querySelector('[data-ve-3b-yol="' + asm + '"]').getAttribute('onclick')).toBe('veMntWiz3bSec(' + asm + ')');
    expect(veMntWiz3bKimlikHTML(s, -1, [])).toBe('');
  });

  test('birimin kütlesi: gövdede kaynak · kütle · ağırlık merkezi (üç hücre); takozda nokta ve konum; çoklu seçimde ve hesapsız yok', () => {
    const { s, j } = kutleDurumu();
    let d = kur(veMntWiz3bBirimKutleHTML(s, j('Şanzıman')));
    expect(Array.from(d.querySelectorAll('.ve-mw-3b-alan-ad')).map((x) => x.textContent)).toEqual(['Kaynak', 'Kütle', 'Ağırlık merkezi']);
    expect(d.querySelector('.ve-mw-3b-kaynak').textContent).toBe('Dosyadan');
    const b = s.coz.birimler.find((x) => x.ad === 'Şanzıman');
    expect(Array.from(d.querySelectorAll('.ve-mw-3b-xyz-h')).map((x) => x.lastChild.textContent))
      .toEqual(b.konum.map((v) => veSayi(Math.round(v * 10) / 10, 1)));
    d = kur(veMntWiz3bBirimKutleHTML(s, j('Motor')));
    expect(d.querySelector('.ve-mw-3b-kaynak').textContent).toBe('Elle');
    expect(veMntWiz3bBirimKutleHTML(s, j('Motor'), [j('Motor'), j('Şanzıman')])).toBe('');
    s.coz = null;
    expect(veMntWiz3bBirimKutleHTML(s, j('Motor'))).toBe('');
    // Takoz: noktanın kaynağı ve konumu 0,001 mm
    const son = veMntStpOku(STK.tulgaKalibi({})), i = (ad) => son.agac.findIndex((x) => x.ad === ad);
    const t = { sonuc: son, roller: son.agac.map(() => null), coz: null, kutle: {}, nokta: {} };
    t.roller[i('Sol ön takoz')] = 'mnt-mount';
    t.coz = veMntStpCoz(son, t.roller);
    d = kur(veMntWiz3bBirimKutleHTML(t, i('Sol ön takoz taban flanşı')));
    expect(d.querySelector('h4').textContent).toBe('Konum');
    expect(d.textContent).toContain('Üst yüz Ø 70,0');
    expect(Array.from(d.querySelectorAll('.ve-mw-3b-xyz-h')).map((x) => x.lastChild.textContent)).toEqual(['439,957', '−355,957', '499,855']);
  });

  test('toplam: bütün gövdelerin kütlesi biliniyorsa kütle ve ortak ağırlık merkezi; biri eksikse yok, satırı işaretli', () => {
    const { s, j } = kutleDurumu(), gs = _mwStpGovdeler(s);
    const K = gs.map((b) => _mwStpKutleK(s, b)), m = K.reduce((a, k) => a + k.m, 0);
    const T = veMntWiz3bToplam(s, gs);
    expect(T.m).toBeCloseTo(m, 9);
    [0, 1, 2].forEach((a) => expect(T.p[a]).toBeCloseTo(gs.reduce((t, b, k) => t + K[k].m * b.konum[a], 0) / m, 9));
    let d = kur(veMntWiz3bPanelHTML(s, -1));
    const top = d.querySelector('[data-ve-3b-toplam]');
    expect(top.textContent).toBe('Toplam' + veSayi(Math.round(m * 10) / 10, 1) + ' kgCG' + T.p.map((v) => veSayi(Math.round(v * 10) / 10, 1)).join('; '));
    delete s.kutle[j('Motor')];
    expect(veMntWiz3bToplam(s, gs)).toBe(null);
    d = kur(veMntWiz3bPanelHTML(s, -1));
    expect(d.querySelector('[data-ve-3b-toplam]')).toBe(null);
    expect(d.querySelector('[data-ve-3b-birimler] [data-eksik]').getAttribute('data-ve-3b-birim')).toBe(String(j('Motor')));
  });

  // Kullanıcı 2026-11-05 — Canlı Not 17: "motor aksesuarları için değerler, motor
  // komplesinin altında görünsün … en aşağıdaki uyarıların ne anlama geldiğini
  // anlamadım … Kaldıralım"; Not 18: "uzun uzun görünmesine gerek yok … kategorize,
  // açılır kapanır". Önce: iki tablo + uyarılar + ayrı "Rol verilenler" listesi.
  test('BİRİMLER: tek liste, role göre gruplar kapalı açılır; seçilenin grubu açık; aksesuarlar motorun altında; uyarı yok', () => {
    const son = veMntStpOku(STK.tulgaKalibi({})), i = (ad) => son.agac.findIndex((x) => x.ad === ad);
    const t = { durum: 'hazir', sonuc: son, roller: son.agac.map(() => null), coz: null, kutle: {}, nokta: {}, yogunluk: {}, malzeme: {} };
    t.roller[i('Motor bloğu')] = 'mnt-motor'; t.roller[i('Sol ön takoz')] = 'mnt-mount'; t.roller[i('Sağ ön takoz')] = 'mnt-mount';
    const aks = son.agac.findIndex((x) => !x.cocuklar.length && !t.roller[x.i] && x.i !== i('Motor bloğu') && x.ebeveyn >= 0);
    t.roller[aks] = 'mnt-alternator';
    t.coz = veMntStpCoz(son, t.roller);
    let d = kur(veMntWiz3bPanelHTML(t, -1));
    expect(d.querySelector('[data-ve-3b-birimler] h4').textContent).toBe('Birimler');
    expect(Array.from(d.querySelectorAll('[data-ve-3b-grup]')).map((g) => g.getAttribute('data-ve-3b-grup'))).toEqual(['govde', 'takoz']);
    expect(Array.from(d.querySelectorAll('.ve-mw-3b-grup-bas')).map((b) => [b.textContent, b.getAttribute('aria-expanded')]))
      .toEqual([['Gövdeler2', 'false'], ['Takozlar2', 'false']]);            // aksesuar motorun grubunda sayılır
    d.querySelectorAll('.ve-mw-3b-birim-l').forEach((u) => expect(u.hidden).toBe(true));
    // aksesuar motorun satırının altında, kendi grubu yok
    const motorS = d.querySelector('[data-ve-3b-birim="' + i('Motor bloğu') + '"]');
    expect(motorS.querySelector('.ve-mw-3b-birim-alt [data-ve-3b-birim="' + aks + '"]')).not.toBe(null);
    expect(d.querySelector('[data-ve-3b-grup="aksesuar"]')).toBe(null);
    // uyarı yok (ağın kapatma payı vb.); "Rol verilenler" ayrı listesi yok
    expect(d.querySelector('.ve-fw-issue, .ve-fw-3b-atanan')).toBe(null);
    expect(d.textContent).not.toMatch(/Rol verilenler|Ölçülen birimler/);
    // seçili birimin grubu açık; elle açılan grup açık, elle kapatılan kapalı kalır
    d = kur(veMntWiz3bPanelHTML(t, i('Sol ön takoz')));
    expect(d.querySelector('[data-ve-3b-grup="takoz"] .ve-mw-3b-grup-bas').getAttribute('aria-expanded')).toBe('true');
    expect(d.querySelector('[data-ve-3b-grup="takoz"] [data-ve-3b-birim="' + i('Sol ön takoz') + '"]').classList.contains('on')).toBe(true);
    d = kur(veMntWiz3bPanelHTML(t, i('Sol ön takoz'), { takoz: false, govde: true }));
    expect(Array.from(d.querySelectorAll('.ve-mw-3b-grup-bas')).map((b) => b.getAttribute('aria-expanded'))).toEqual(['true', 'false']);
    // her satırda rolü kaldır; satırın üstü 3B'de vurgular
    const r = d.querySelector('[data-ve-3b-birim="' + i('Motor bloğu') + '"]');
    expect(r.querySelector('.ve-fw-mini').getAttribute('onclick')).toBe("veMntWizStpRol(" + i('Motor bloğu') + ", '')");
    expect(r.getAttribute('onpointerenter')).toBe('veMntWiz3bAgacFare(' + i('Motor bloğu') + ')');
    // motor yokken aksesuar kendi grubunda
    t.roller[i('Motor bloğu')] = null; t.coz = veMntStpCoz(son, t.roller);
    d = kur(veMntWiz3bPanelHTML(t, -1));
    expect(Array.from(d.querySelectorAll('[data-ve-3b-grup]')).map((g) => g.getAttribute('data-ve-3b-grup'))).toEqual(['takoz', 'aksesuar']);
  });

  // Kullanıcı 2026-11-05 — Canlı Not 10: "rol kısmı … çok amatör"; Not 9: "her
  // parçanın malzeme tanımı olmayacak"; Not 16: "motor için bir malzeme girdimiz
  // olmayacak". Satır başına ad · değer; Malzeme yalnız atanmışsa, motorda hiç.
  test('özellik ızgarası: takozda Rol · Takoz noktası; motorda malzeme yok; gövdede Malzeme yalnız atanmışsa', () => {
    const son = veMntStpOku(STK.tulgaKalibi({})), i = (ad) => son.agac.findIndex((x) => x.ad === ad);
    const t = { durum: 'hazir', sonuc: son, roller: son.agac.map(() => null), coz: null, kutle: {}, nokta: {}, malzeme: {}, yogunluk: {} };
    t.roller[i('Sol ön takoz')] = 'mnt-mount'; t.roller[i('Motor bloğu')] = 'mnt-motor';
    const kb = (sec) => Array.from(kur(veMntWiz3bAltHTML(t, sec, {})).querySelectorAll('.ve-mw-3b-kb')).map((x) => x.textContent);
    expect(kb(i('Sol ön takoz'))).toEqual(['Rol', 'Takoz noktası']);
    t.yogunluk[i('Motor bloğu')] = 'celik';                                   // eski kayıtta malzeme olsa da
    expect(kb(i('Motor bloğu'))).not.toContain('Malzeme');                     // motorda malzeme satırı yok (Not 16)
    const brk = son.agac.findIndex((x) => x.cocuklar.length && x.ebeveyn >= 0 && !t.roller[x.i]);
    t.roller[brk] = 'mnt-bracket';
    expect(kb(brk)).toEqual(['Rol']);
    t.yogunluk[brk] = 'celik';
    expect(kb(brk)).toEqual(['Rol', 'Malzeme']);
    // Rol tek liste, gruplu; rengi solundaki noktada; çip ve "Diğer…" yok
    const d = kur(veMntWiz3bAltHTML(t, brk, {}));
    expect(d.querySelector('#ve-mw-3b-rol').value).toBe('mnt-bracket');
    expect(Array.from(d.querySelectorAll('#ve-mw-3b-rol optgroup')).map((g) => g.label)).toEqual(veMntWiz3bRolGruplari().map((g) => g.ad));
    expect(d.querySelectorAll('#ve-mw-3b-rol option[data-ve-3b-rol]:not([value=""])').length).toBe(VE_MNT_STP_ROLLER.length);
    expect(d.querySelector('.ve-mw-3b-oz-renk').getAttribute('style')).toBe('--renk:var(' + VE_MW_3B_ROL_RENK['mnt-bracket'] + ')');
    expect(d.querySelector('button[data-ve-3b-rol], [data-ve-3b-diger]')).toBe(null);
    expect(kural('.ve-mw-3b-yan .ve-fw-3b-roller.ve-mw-3b-oz-s')).toMatch(/grid-template-columns:96px minmax\(0, 1fr\)/);
  });

  // Kullanıcı 2026-11-05 (Canlı Not 15): görünüm küpü ve yakınlık düğmeleri
  // "Şunları kaldıralım." Bakış komut çubuğunun listesinde, yakınlık tekerlekte.
  // Kullanıcı 2026-11-05 (Canlı Not 13): "boyuna çok geniş olmuş. Biraz
  // daraltalım ve alan kazanalım." Denetimler 26 px, dolgu 3 px (çubuk 45 → 33 px).
  test('komut çubuğu ince: dolgu 3 px, her denetim 26 px', () => {
    expect(kural('.ve-mw-3b-komut')).toMatch(/padding:3px 10px;/);
    ['.ve-mw-3b-arac-b', '.ve-mw-3b-sec', '.ve-mw-3b-dosya', '.ve-mw-3b-hap'].forEach((k) => expect(kural(k)).toMatch(/height:26px;/));
    expect(kural('.ve-mw-3b-bolme .ve-mw-3b-arac-b')).toMatch(/height:22px;/);
  });
  test('görünüm küpü ve yakınlık düğmeleri YOK — ne üretici ne kural', () => {
    const src = loadSource('cp-mount-3b.js');
    expect(src).not.toMatch(/ve-mw-3b-kup|ve-mw-3b-yakin|ve-mw-3b-gez|veMntWiz3bKupSVG|veMntWiz3bYakinlas/);
    expect(css).not.toMatch(/\.ve-mw-3b-kup|\.ve-mw-3b-yakin|\.ve-mw-3b-gez/);
  });

  // Kullanıcı 2026-11-05 (Canlı Not 21): "Yüzeyi seçtiğimde önündeki ve arkasındaki
  // CAD parçalardan dolayı, yüzeyin tam olarak ne olduğunu göremiyorum. Hem
  // seçtiğimde, hem de seçmeden önce yüzeyin görünür olmasını, diğer parçaların da
  // bulanıklaşmasını istiyorum." Önce: yüzün vurgusu derinlik sınamalı (önündeki
  // parçanın ardında kayboluyordu), öteki parçalar olağan.
  test('YÜZEY ODAĞI: fare altındaki ya da seçili yüzün parçası odakta, ötekiler tül; yüzün vurgusu derinlik sınamasız', () => {
    expect(veMntWiz3bDurumBiti({ odak: { 4: 1 }, sec: null }, 4)).toBe(0);
    expect(veMntWiz3bDurumBiti({ odak: { 4: 1 }, sec: null }, 5)).toBe(VE_MW_3B_SOLUK);
    expect(veMntWiz3bDurumBiti({ odak: { 4: 1 }, sec: { 5: 1 } }, 5)).toBe(VE_MW_3B_SOLUK);   // odak seçimden önce
    expect(veMntWiz3bDurumBiti({ odak: null, sec: { 5: 1 } }, 5)).toBe(VE_MW_3B_SECIK);
    const arac = loadSource('cp-mount-3b-arac.js');
    expect(arac).toMatch(/side: THREE\.DoubleSide, depthWrite: false, depthTest: false \}\);/);
    expect(arac).toMatch(/var f = V\.suzgec === 'yuz' \? \(V\.yuzOn \|\| V\.yuzSec\) : null/);
    expect(loadSource('cp-mount-3b.js')).toMatch(/V\.solukVar = !!R\.sec \|\| !!R\.odak \|\| R\.xray;/);
  });

  test('görünüş: x-ışınında seçimsiz her parça tül, seçimde dışı; kenar x-ışınında belirgin; listeler', () => {
    expect(VE_MW_3B_GORUNUS.map((g) => g.k)).toEqual(['kenar', 'golge', 'xray']);
    expect(veMntWiz3bDurumBiti({ sec: null }, 3)).toBe(0);
    expect(veMntWiz3bDurumBiti({ sec: null, xray: true }, 3)).toBe(VE_MW_3B_SOLUK);
    expect(veMntWiz3bDurumBiti({ sec: { 3: 1 }, xray: true }, 3)).toBe(VE_MW_3B_SECIK);
    expect(veMntWiz3bDurumBiti({ sec: { 3: 1 } }, 4)).toBe(VE_MW_3B_SOLUK);
    const R = { cizgi: [1, 1, 1], cizgiSec: [2, 2, 2], cizgiFare: [3, 3, 3], bos: [9, 9, 9], bosSec: [8, 8, 8] };
    expect(veMntWiz3bGorunus(VE_MW_3B_SOLUK, [5, 5, 5], R).a).toBe(VE_MW_3B_CIZGI_A.soluk);
    expect(veMntWiz3bGorunus(VE_MW_3B_SOLUK, [5, 5, 5], Object.assign({ xray: true }, R)).a).toBe(VE_MW_3B_CIZGI_A.xray);
    expect(VE_MW_3B_CIZGI_A.xray).toBeGreaterThan(VE_MW_3B_CIZGI_A.soluk);
    expect(VE_MW_3B_CIZGI_A.xray).toBeLessThan(VE_MW_3B_CIZGI_A.olagan);
    const d = kur(veMntWiz3bAracHTML({ kesit: null, gorunus: 'xray' }));
    expect(d.querySelector('#ve-mw-3b-gorunus').value).toBe('xray');
    const bk = d.querySelector('#ve-mw-3b-bakis');
    expect([bk.options[0].disabled, bk.options[0].textContent]).toEqual([true, 'Bakış']);
    expect(Array.from(bk.options).slice(1).map((o) => o.value)).toEqual(VE_MW_3B_BAKIS.map((g) => g.k));
    // Seçilen bakış uygulanır (görüntüleyici kapalı: uygulanmaz), liste adına döner
    bk.value = 'ust';
    expect(veMntWiz3bBakisSec(bk)).toBe(false);
    expect(bk.selectedIndex).toBe(0);
  });

  test('ağaçta ara: ad ya da örnek adı, Türkçe büyük-küçük harf; atanın adı, rol çipi; en çok VE_MW_3B_ARA_EN satır; sonuçsuz durum', () => {
    const a = [{ i: 0, ad: 'KÖK', ebeveyn: -1, cocuklar: [1, 2, 3], parcalar: [] },
      { i: 1, ad: 'İç gövde', ebeveyn: 0, cocuklar: [], parcalar: [0] },
      { i: 2, ad: 'Islak kasnak', ornek: 'KASNAK_A.1', ebeveyn: 0, cocuklar: [], parcalar: [1] },
      { i: 3, ad: 'Takoz', ebeveyn: 0, cocuklar: [], parcalar: [2] }];
    const s = { sonuc: { agac: a }, roller: [null, null, 'mnt-mount', null] };
    expect(veMntWiz3bAraBul(s, 'iç')).toEqual([1]);
    expect(veMntWiz3bAraBul(s, 'ISL')).toEqual([2]);
    expect(veMntWiz3bAraBul(s, 'kasnak_a')).toEqual([2]);
    expect(veMntWiz3bAraBul(s, '  ')).toEqual([]);
    let d = kur(veMntWiz3bAraHTML(s, 'k', [3]));
    expect(Array.from(d.querySelectorAll('[data-ve-3b-agac]')).map((r) => +r.getAttribute('data-ve-3b-agac'))).toEqual([0, 2, 3]);
    expect(d.querySelector('[data-ve-3b-agac="2"] .ve-mw-3b-ara-yol').textContent).toBe('KÖK');
    expect(d.querySelector('[data-ve-3b-agac="2"] .ve-mw-3b-agac-rol').textContent).toBe(_mwAd('mnt-mount'));
    expect(d.querySelector('[data-ve-3b-agac="3"]').getAttribute('aria-selected')).toBe('true');
    expect(d.querySelector('[data-ve-3b-agac="2"] .ve-mw-3b-agac-ad').getAttribute('onclick')).toBe('veMntWiz3bAgacTik(2, event)');
    expect(kur(veMntWiz3bAraHTML(s, 'yok', [])).textContent).toBe('Sonuç yok.');
    const cok = { sonuc: { agac: Array.from({ length: VE_MW_3B_ARA_EN + 50 }, (_, k) => ({ i: k, ad: 'Parça ' + k, ebeveyn: -1, cocuklar: [], parcalar: [k] })) }, roller: [] };
    d = kur(veMntWiz3bAraHTML(cok, 'parça', []));
    expect(d.querySelectorAll('[data-ve-3b-agac]').length).toBe(VE_MW_3B_ARA_EN);
    expect(d.querySelector('.ve-mw-3b-ara-daha').textContent).toBe('50 sonuç daha');
  });
});
