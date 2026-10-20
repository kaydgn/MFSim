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
