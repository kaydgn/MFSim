/**
 * step-ucgen-dilim.test.js — ÜÇGENLEME DİLİM DİLİM (js/step-ucgen.js işleri)
 *
 * Takoz'un ağ işi ("Konumları hesapla", 3B) gerçek dosyada tek yüzde arayüzü
 * 0,8 sn tutuyordu (motor bloğunun 9.345 köşeli düz yüzü) ve parçanın sonu
 * (914.595 üçgen) bir dilimi 0,1–0,8 sn. Yüzün işi, kulak kırpma, çevirme,
 * bölme ve parçanın sonu artık birer İŞ: adim(bitis) saat dolunca yarım işi
 * saklayıp döner. Kapılar:
 *   · AYNI ÇIKTI — en sık bırakmayla (her parçadan sonra saat dolu) her yüz
 *     eşzamanlı yolun BİT BİT aynısı; parçanın sonu (bitirAdim) bitir()'in
 *   · BIRAKIR — büyük yüz tek adimda bitmez; saat dolmadıkça bölünmez
 *   · Z-SIRASI — kulak sınaması üçgenin kutusunun Z aralığına bakar: tam
 *     taramanın aynı üçgenleri (delikli, eşdoğrusal, zorla kırpılan halka)
 *   · AĞ İŞİ — Takoz'un işi bırakarak da aynı ağı ve kütle özelliğini üretir
 */
const fs = require('fs');
const path = require('path');
const P = require('../../js/step-p21.js');
const U = require('../../js/step-ucgen.js');
const Y = require('../helpers/step-yaz.js');
const S = require('../helpers/step-takoz.js');
const STP = require('../../js/mount-step.js');

// Saat hep dolu: iş her parçadan (evre, kenar öbeği, kırpma turu…) sonra döner
const DOLU = -1;
const ayni = (a, b) => expect(Array.from(a)).toEqual(Array.from(b));   // toEqual: −0 ≠ +0

const delikliPlaka = S.delikliPlaka;

// Tek parçalı dosya: yüzleri `kur(yz)` yazar
function parca(kur) {
  const yz = new Y.StepYaz();
  const yuzler = kur(yz);
  const u = yz.urun('P', 'PARCA');
  yz.govde(u, yuzler, 'kabuk');
  yz.temsil(u);
  const metin = yz.metin(), m = P.veStepP21Oku(metin);
  return { m, p: P.veStepP21Montaj(m).parcalar[0], metin };
}
const ORNEK = {
  plaka: () => parca((yz) => delikliPlaka(yz)),
  'şişkin kutu': () => parca((yz) => S.bsKutuYuzleri(yz, 120, 80, 60, 10, 6)),
  silindir: () => parca((yz) => S.silindirYuzleri(yz, 40, 90)),
  kutu: () => parca((yz) => S.kutuYuzleri(yz, 50, 40, 30))
};

// En sık bırakmayla yüz: döner { r, adim (çağrı sayısı) }
function dilimli(B, f, birim) {
  const is = U._suYuzIs(B, f, birim.mm, birim.derece);
  let adim = 1;
  while (!is.adim(DOLU)) adim++;
  return { r: is.r, adim };
}

describe('AYNI ÇIKTI — en sık bırakmayla eşzamanlı yolun bit bit aynısı', () => {
  test.each(Object.keys(ORNEK))('%s: her yüz', (ad) => {
    const { m, p } = ORNEK[ad]();
    const B1 = U.veStepUcgenBaglam(m, { kiris: 0.1 }), B2 = U.veStepUcgenBaglam(m, { kiris: 0.1 });
    let toplamAdim = 0;
    p.yuzler.forEach((f) => {
      const a = U._suYuz(B1, f, p.birim.mm, p.birim.derece), d = dilimli(B2, f, p.birim);
      expect(d.r.durum).toBe('tamam');
      expect([d.r.durum, d.r.neden, d.r.tip]).toEqual([a.durum, a.neden, a.tip]);
      ayni(d.r.uc, a.uc); ayni(d.r.nor, a.nor); ayni(d.r.ucg, a.ucg); ayni(d.r.kenarlar, a.kenarlar);
      toplamAdim += d.adim;
      // biten yüz önbellekte; ikinci iş beklemeden döner
      expect(U._suYuzIs(B2, f, p.birim.mm, p.birim.derece).r).toBe(d.r);
    });
    expect(toplamAdim).toBeGreaterThan(p.yuzler.length);
    expect(B2.sayac).toEqual(B1.sayac);
  });

  test('parçanın sonu: bitirAdim bitir()\'in aynısı (dünya ağı, kutu, yerel ağ)', () => {
    const { m, p } = parca((yz) => delikliPlaka(yz, { n: 4 }).concat(S.kutuYuzleri(yz, 50, 40, 30, [0, 0, 60])));
    const M = { R: [[0.6, -0.8, 0], [0.8, 0.6, 0], [0, 0, 1]], t: [12.5, -3, 7] };
    const yap = () => {
      const B = U.veStepUcgenBaglam(m, { kiris: 0.1 }), t = U.veStepUcgenTopla(B, M, p.birim);
      p.yuzler.forEach((f, i) => t.ekle(f, i === 1));
      return t;
    };
    const a = yap().bitir({ yerel: true });
    const t = yap();
    let r, adim = 0;
    while (!(r = t.bitirAdim(DOLU, { yerel: true }))) adim++;
    expect(adim).toBeGreaterThan(3);                       // evreler arasında döndü
    ['uc', 'normal', 'ucgen', 'cizgi', 'daire', 'yuzUcgen'].forEach((k) => ayni(r[k], a[k]));
    ['uc', 'nor', 'ucgen', 'cizgi', 'daire', 'yuzUcgen'].forEach((k) => ayni(r.yerel[k], a.yerel[k]));
    expect(r.kutu).toEqual(a.kutu);
    expect(r.ucgen).toBe(r.yerel.ucgen);                   // ortak dizi
    expect([r.yuz, r.ucgenli, r.kenarYuz]).toEqual([a.yuz, a.ucgenli, a.kenarYuz]);
    // dünya ağı = yerel ağın dönüşümü (veStepUcgenTasi'nin aynısı)
    const T = U.veStepUcgenTasi(a.yerel, M);
    ayni(r.uc, T.uc); ayni(r.normal, T.normal); expect(r.kutu).toEqual(T.kutu);
  });

  test('ekleAdim: yarım yüz saklanır, aynı yüzle sürer; ekle() ile aynı parça', () => {
    const { m, p } = ORNEK.plaka();
    const B1 = U.veStepUcgenBaglam(m), B2 = U.veStepUcgenBaglam(m);
    const t1 = U.veStepUcgenTopla(B1, p.M, p.birim), t2 = U.veStepUcgenTopla(B2, p.M, p.birim);
    p.yuzler.forEach((f) => t1.ekle(f));
    let donus = 0;
    p.yuzler.forEach((f) => { while (!t2.ekleAdim(f, false, DOLU)) donus++; });
    expect(donus).toBeGreaterThan(20);
    const a = t1.bitir(), b = t2.bitir();
    ['uc', 'normal', 'ucgen', 'cizgi', 'daire'].forEach((k) => ayni(b[k], a[k]));
  });
});

describe('BIRAKIR — her evre iş birimi başına saate bakar', () => {
  test('saat dolmadıkça yüz tek adimda biter', () => {
    const { m, p } = ORNEK.plaka();
    const is = U._suYuzIs(U.veStepUcgenBaglam(m), p.yuzler[0], p.birim.mm, p.birim.derece);
    expect(is.adim(Infinity)).toBe(true);
    expect(is.r.ucg.length / 3).toBeGreaterThan(1500);
  });
  // Aynı kaynak, öbekler değiştirilmiş: bir evrenin öbeği 1, ötekilerinki 1e9.
  // En sık bırakmayla adim sayısının tabandan (hepsi 1e9) farkı o evrenin iş
  // birimi sayısıdır — saate bakmayan evre farkı sıfıra indirir.
  const kaynak = fs.readFileSync(path.join(__dirname, '../../js/step-ucgen.js'), 'utf8');
  const ADIM = /var VE_STEP_UCGEN_ADIM = \{[^}]*\};/;
  const ANAH = ['kenar', 'ters', 'kose', 'kulak', 'cevir', 'aday', 'bol'];
  const okuyucu = { Varlik: P.veStepP21Varlik, Tip: P.veStepP21Tip, Parca: P.veStepP21Parca, Cerceve: P.veStepP21Cerceve };
  function say(bir, o) {
    expect(kaynak).toMatch(ADIM);
    const ayar = ANAH.map((k) => k + ': ' + (k === bir ? 1 : 1e9)).join(', ');
    const V = new Function(kaynak.replace(ADIM, 'var VE_STEP_UCGEN_ADIM = { ' + ayar + ' };')
      + '\nreturn { veStepUcgenBaglam: veStepUcgenBaglam, _suYuzIs: _suYuzIs };')();
    const B = V.veStepUcgenBaglam(o.m, { kiris: 0.1 });
    B.P = okuyucu; B.iz = true;
    const is = V._suYuzIs(B, o.p.yuzler[0], o.p.birim.mm, o.p.birim.derece);
    let adim = 1;
    while (!is.adim(DOLU)) adim++;
    return { r: is.r, adim };
  }
  const plaka = ORNEK.plaka(), kutu = ORNEK['şişkin kutu']();
  // Düz yüz: E kenar, n köşe (iç köşe yok), h delik, t üçgen, iç kenar (3t − n)/2
  const birim = {
    plaka: (r) => {
      const E = r.kenarlar.length, n = r.uc.length / 3, h = r._halkalar.length - 1, t = r.ucg.length / 3;
      return { E, n, h, t, ic: (3 * t - n) / 2 };
    },
    // Eğri yüz: sınır köşesi, inceltmenin eklediği köşe
    kutu: (r) => {
      const sinir = r._halkalar.reduce((s, x) => s + x.length, 0), t = r.ucg.length / 3;
      return { sinir, bolme: r.uc.length / 3 - sinir, ic: (3 * t - sinir) / 2 };
    }
  };
  test('örnekler ağır; öbeksiz de döngü, delik ve evre başına döner', () => {
    const t = say(null, plaka), a = birim.plaka(t.r), b = birim.kutu(say(null, kutu).r);
    expect(a.h).toBe(64); expect(a.t).toBe(a.n + 2 * a.h - 2); expect(a.t).toBeGreaterThan(1500);
    expect(b.bolme).toBeGreaterThan(50);
    // döngü başına: kenar öbeği 1 · ters çevirme 2 · köşe 1; delik başına köprü 1;
    // evreler arası 7 (h + 1 döngü)
    expect(t.adim).toBeGreaterThanOrEqual(5 * a.h + 10);
  });
  test.each([
    ['kenar', 'plaka', (x) => x.E - x.h - 2],                // döngü başına bir öbek → kenar başına
    ['ters', 'plaka', (x) => x.n - x.h - 2],                 // nokta başına Newton
    ['kose', 'plaka', (x) => 2 * x.n - x.h - 3],             // köşe evresi + çıktı evresi
    ['kulak', 'plaka', (x) => x.n + 2 * x.h - 6],            // kırpma turu ≥ halkanın köşesi
    ['cevir', 'plaka', (x) => x.ic - 2],                     // her iç kenar en az bir kez yığından
    ['aday', 'kutu', (x) => x.ic - 41],                      // son tur bütün iç kenarları sınar
    ['bol', 'kutu', (x) => x.bolme - 41]                     // her bölme bir aday
  ])('%s öbeği 1 → adim farkı ≥ birim sayısı', (anah, ad, en) => {
    const o = ad === 'plaka' ? plaka : kutu;
    const taban = say(null, o), bir = say(anah, o);
    ayni(bir.r.ucg, taban.r.ucg); ayni(bir.r.uc, taban.r.uc);
    expect(bir.adim - taban.adim).toBeGreaterThanOrEqual(en(birim[ad](taban.r)));
  });
});

describe('Z-SIRASI — kulak sınaması tam taramanın aynı üçgenleri', () => {
  // Aynı kaynak, Z sırası kapalı (eşik sonsuz): tam tarama
  const kaynak = fs.readFileSync(path.join(__dirname, '../../js/step-ucgen.js'), 'utf8');
  const esik = 'var VE_STEP_UCGEN_ZSIRA = 80;';
  expect(kaynak).toContain(esik);
  const TAM = new Function(kaynak.replace(esik, 'var VE_STEP_UCGEN_ZSIRA = Infinity;') + '\nreturn { _suKulak: _suKulak };')();
  let tohum = 7;
  const rasgele = () => (tohum = (tohum * 16807) % 2147483647) / 2147483647;
  // Yıldız halka (saat yönünün tersine) + içinde saat yönünde delikler
  function halka(n, r0, oyuk, cx = 0, cy = 0, ters = false) {
    const X = [], Yy = [];
    for (let i = 0; i < n; i++) {
      const a = 2 * Math.PI * i / n, r = r0 * (1 - oyuk * rasgele());
      X.push(cx + r * Math.cos(a)); Yy.push(cy + r * Math.sin(a));
    }
    if (ters) { X.reverse(); Yy.reverse(); }
    return [X, Yy];
  }
  function sor(parcalar) {
    const X = [], Yy = [], h = [];
    parcalar.forEach(([x, y]) => { const b = X.length; h.push(x.map((_, i) => b + i)); X.push(...x); Yy.push(...y); });
    return { X, Y: Yy, dis: h[0], delikler: h.slice(1) };
  }
  test.each([
    ['yıldız 600 köşe', () => sor([halka(600, 100, 0.6)])],
    ['yıldız 2000 köşe + 12 delik', () => sor([halka(2000, 100, 0.3)].concat(
      Array.from({ length: 12 }, (_, i) => halka(40, 6, 0.2, 55 * Math.cos(i / 2), 55 * Math.sin(i / 2), true))))],
    ['kümeli yıldız (dörderli küme, aynı Z kodu)', () => {
      const x = [], y = [];
      for (let i = 0; i < 300; i++) {
        const a = 2 * Math.PI * i / 300, r = 100 * (1 - 0.5 * rasgele());
        for (let k = 0; k < 4; k++) { x.push(r * Math.cos(a) + 1e-7 * k); y.push(r * Math.sin(a) + 1e-7 * (k % 2)); }
      }
      return sor([[x, y]]);
    }],
    ['eşdoğrusal kenarlı dikdörtgen (zorla kırpma)', () => {
      const x = [], y = [];
      for (let i = 0; i <= 200; i++) { x.push(i); y.push(0); }
      for (let i = 199; i >= 1; i--) { x.push(i); y.push(1e-9 * (i % 3)); }
      return sor([[x, y]]);
    }]
  ])('%s', (ad, kur) => {
    const o = kur();
    const s1 = { zorla: 0 }, s2 = { zorla: 0 };
    const a = U._suKulak(o.X, o.Y, o.dis, o.delikler, s1), b = TAM._suKulak(o.X, o.Y, o.dis, o.delikler, s2);
    expect(a.length).toBeGreaterThan(o.X.length / 2);
    expect(a).toEqual(b);
    expect(s1).toEqual(s2);
  });
});

describe('AĞ İŞİ — Takoz\'un işi bırakarak da aynı ağı ve kütle özelliğini üretir', () => {
  test('tek yüzlü ağır parça: işin adimi = yüzün adimi + sonun adimi', () => {
    const son = STP.veMntStpOku(ORNEK.plaka().metin);
    const pi = son._geo.findIndex((g) => g && g.yuzler && g.yuzler.length), g = son._geo[pi];
    const B = U.veStepUcgenBaglam(son._model, STP.VE_MNT_STP_UCGEN), t = U.veStepUcgenTopla(B, g.M, g.birim);
    let yuz = 1, sonu = 1;
    while (!t.ekleAdim(g.yuzler[0], false, DOLU)) yuz++;
    while (!t.bitirAdim(DOLU, { yerel: false })) sonu++;
    expect(yuz).toBeGreaterThan(100); expect(sonu).toBeGreaterThan(3);
    const J = STP.veMntStpAgIs(son, []);
    J.iste([pi]);
    let is = 1;
    while (!J.adim(DOLU)) is++;
    expect(is).toBeGreaterThanOrEqual(yuz + sonu - 2);
    expect(is).toBeLessThanOrEqual(yuz + sonu + 2);
  });
  test('güç grubu: en sık bırakmayla iş = eşzamanlı üretim', () => {
    const son = STP.veMntStpOku(S.gucGrubu());
    const liste = son._geo.map((g, i) => i).filter((i) => son._geo[i] && son._geo[i].yuzler && son._geo[i].yuzler.length);
    const ag1 = STP.veMntStpAgUret(son, [], liste);
    const ag2 = [], oz = {};
    const J = STP.veMntStpAgIs(son, ag2, { oz });
    J.iste(liste);
    let adim = 0;
    while (!J.adim(DOLU)) adim++;
    expect(adim).toBeGreaterThan(liste.length);
    liste.forEach((i) => {
      ['uc', 'normal', 'ucgen', 'cizgi', 'daire', 'yuzUcgen'].forEach((k) => ayni(ag2[i][k], ag1[i][k]));
      expect(ag2[i].kutu).toEqual(ag1[i].kutu);
      expect(oz[i]).toBeTruthy();
    });
  });
});
