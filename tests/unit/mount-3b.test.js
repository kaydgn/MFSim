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
