/**
 * mount-param-marka.test.js — Parametrik Analiz · ÖZEL KOMBİNASYON: MARKAYA GÖRE SEÇİM
 * ─────────────────────────────────────────────────────────────────────────
 * Kullanıcı (2026-11-13, Canlı Not 1010): "Parametrik analiz kısmında 'özel kombinasyon' yaparken,
 * markaya göre de seçim yapabilelim. 'Takoz Ara' kısmına tıkladığımız zaman tablo halinde marka ve
 * takozlar gelsin. Örneğin ben ön takozlar için tüm AMC modellerini seçmek istiyorum."
 *
 * Kapılar (js/cp-mount-param.js → veMntParamAra · veMntParamGrupMarka):
 *   TABLO     — boş kutuda tık ve odak tabloyu açar: marka başlıkları kütüphanenin marka sırasıyla,
 *               başlığın tip sayısı ve "Hepsini ekle (n)"; altında markanın tipleri; sorgu tabloyu süzer
 *   EYLEM     — başlık markanın aday tiplerini gruba toplu ekler (tek geri-al adımı, kütüphane sırası,
 *               tekrar yok, öteki grup yerinde); hepsi grupta ise "Hepsini çıkar"; elenen tip girmez
 *   KLAVYE    — Enter etkin satırın eylemi: tip satırı tipi, başlık satırı markayı; yazınca etkin satır
 *               ilk tip satırı; →/← başlığı açar ve kapatır (boş kutuda başlıklar kapalı)
 */
const H = require('../helpers/takoz-dogrulama.js');

const { cp } = H.kur();
Object.keys(cp).forEach((k) => { if (global[k] === undefined) global[k] = cp[k]; });
global.veMntKatalog = require('../../js/mount-katalog.js');
const P = require('../../js/cp-mount-param.js');
Object.keys(P).forEach((k) => { if (global[k] === undefined) global[k] = P[k]; });
global.veSayi = global.veSayi || require('../../js/sayi.js').veSayi;
global.veMntAkso = global.veMntAkso || require('../../js/mount-akso.js');
global.veIkon = global.veIkon || require('../../js/ikon.js').veIkon;

function kur(data, cozum) {
  const t = H.ornek('tulga');
  let R = null;
  if (cozum) { R = H.coz(t); expect(R && !R.error).toBe(true); }
  else { global.nodes = JSON.parse(JSON.stringify(t.nodes)); global.connections = t.connections || []; }
  cp._veMntLast = R;
  const n = { id: 'pm', type: 'mnt-parametric', data: Object.assign({ adaylarKip: 'ozel' }, data || {}) };
  global.nodes.push(n);
  global.saveState = jest.fn(() => cp.veMntPencereTazele());
  document.body.innerHTML = '<div class="ve-properties-content">' + P.getMntParamPropertiesHTML(n) + '</div>';
  const ara = (no) => ({
    kutu: document.getElementById('ve-mnt-param-ara-pm-' + no),
    liste: document.getElementById('ve-mnt-param-ara-l-pm-' + no),
    satir: () => [...document.querySelectorAll('#ve-mnt-param-oz-pm-' + no + ' li button')].map((b) => b.dataset.key),
  });
  return { n, ara, Y: () => P._mntParamYeni(n) };
}
const n_eylem = (f) => f.mock.calls.length;
const baslik = (liste) => [...liste.querySelectorAll('.ve-prm-ara-m')];
const tip = (liste) => [...liste.querySelectorAll('.ve-prm-ara-o')];
const eylem = (b) => b.querySelector('.ve-prm-ara-h').textContent;
const yaz = (kutu, q) => { kutu.value = q; kutu.dispatchEvent(new Event('input', { bubbles: true })); };
const tus = (kutu, key) => { const e = new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }); kutu.dispatchEvent(e); return e; };
// Boş kutuda başlıklar kapalı açılır: okla açılır (markayı verirsen yalnız o)
const ac = (liste, ad) => {
  baslik(liste).map((b) => b.dataset.marka).filter((m) => !ad || m === ad).forEach((m) => {
    const b = baslik(liste).find((x) => x.dataset.marka === m);
    if (b.dataset.acik !== 'true') b.querySelector('.ve-prm-ara-ok').click();
  });
};
const marka = (a) => (a.e && a.e.marka) || 'Diğer';
// Bağımsız hakem: markanın aday tipleri kütüphane sırasında
const markaTipleri = (Y, ad) => Y.A.filter((a) => marka(a) === ad).map((a) => a.key);
// tablonun sırası: Tip listesinin sırası (markanın içinde adın sayı sırası); kayıt kütüphane sırasında
const markaSira = (Y, ad) => P._mntParamListeSira(Y.A).filter((a) => marka(a) === ad).map((a) => a.key);
const AMC = 'AMC Mecanocaucho';

describe('TABLO — boş kutu marka başlıklı tabloyu açar', () => {
  test('tık ve odak: markalar kütüphanenin marka sırasıyla, başlıkta tip sayısı ve Hepsini ekle (n); altında markanın tipleri', () => {
    const { ara, Y } = kur();
    const { kutu, liste } = ara(1);
    expect(liste.hidden).toBe(true);
    kutu.focus();
    expect([document.activeElement === kutu, liste.hidden, kutu.getAttribute('aria-expanded')]).toEqual([true, false, 'true']);
    const A = Y().A;
    const sira = cp.veMntLibMarkalar(A.map((a) => a.e)).map((m) => m.ad);
    expect(sira.length).toBeGreaterThanOrEqual(3);
    expect(baslik(liste).map((b) => b.dataset.marka)).toEqual(sira);
    baslik(liste).forEach((b) => {
      const say = markaTipleri(Y(), b.dataset.marka).length;
      expect(say).toBeGreaterThan(0);
      expect(b.querySelector('.ve-prm-kz').textContent).toBe(cp._mntS(say, 0) + ' tip');
      expect(eylem(b)).toBe('Hepsini ekle (' + cp._mntS(say, 0) + ')');
      expect(b.dataset.eylem).toBe('ekle');
    });
    // boş kutuda başlıklar kapalı: yalnız markalar (tek bakışta), etkin satır yok
    expect([tip(liste).length, baslik(liste).every((b) => b.dataset.acik === 'false'), kutu.hasAttribute('aria-activedescendant')]).toEqual([0, true, false]);
    // okla açılır; başlık satırlarının eylemi ve etkin satır başlıkta; kapanınca satırlar gider
    const m0 = baslik(liste)[0].dataset.marka;
    ac(liste, m0);
    expect(tip(liste).map((o) => o.dataset.key)).toEqual(markaSira(Y(), m0));
    expect(baslik(liste)[0].getAttribute('aria-selected')).toBe('true');
    expect(liste.querySelectorAll('.ve-prm-ara-ok .mf-ico-chevron-down').length).toBe(1);
    baslik(liste)[0].querySelector('.ve-prm-ara-ok').click();
    expect(tip(liste).length).toBe(0);
    expect(n_eylem(global.saveState)).toBe(0);                                                  // açma kapama seçim değil
    // başlıkların altında markanın tipleri, Tip listesinin sırasıyla; hepsi aday tip
    ac(liste);
    expect(tip(liste).map((o) => o.dataset.key)).toEqual(P._mntParamListeSira(A).map((a) => a.key));
    // her başlıktan sonra yalnız o markanın satırları gelir
    const dizi = [...liste.querySelectorAll('[role="option"]')];
    baslik(liste).forEach((b) => {
      let k = dizi.indexOf(b) + 1, say = 0;
      while (dizi[k] && dizi[k].classList.contains('ve-prm-ara-o')) {
        expect(markaTipleri(Y(), b.dataset.marka)).toContain(dizi[k].dataset.key); k++; say++;
      }
      expect(say).toBe(markaTipleri(Y(), b.dataset.marka).length);
    });
    // açıkken ikinci tık tabloyu yeniden kurmaz
    const o = tip(liste)[3];
    kutu.click();
    expect(tip(liste)[3]).toBe(o);
    // odak çıkınca boşalır, kutuya tık yeniden açar
    kutu.blur();
    expect([liste.hidden, liste.innerHTML]).toEqual([true, '']);
    kutu.click();
    expect(liste.hidden).toBe(false);
  });

  test('SÜZME: sorgu tabloyu süzer — eşleşmeyen marka düşer, başlığın sayısı sorguyu taşıyan tiplerinki; marka adı sorgusu o markanın tamamı', () => {
    const { ara, Y } = kur();
    const { kutu, liste } = ara(1), A = Y().A;
    kutu.focus();
    const amc = markaTipleri(Y(), AMC);
    yaz(kutu, 'mecanocaucho');
    expect(baslik(liste).map((b) => b.dataset.marka)).toEqual([AMC]);
    expect(eylem(baslik(liste)[0])).toBe('Hepsini ekle (' + cp._mntS(amc.length, 0) + ')');
    expect(tip(liste).map((o) => o.dataset.key)).toEqual(markaSira(Y(), AMC));
    // tip adı sorgusu: başlık yalnız eşleşen tiplerin sayısını söyler (hakem: ara işlevi)
    yaz(kutu, 'cone 60');
    const eslesen = P._mntParamAra(P._mntParamListeSira(A), 'cone 60', []);
    expect(eslesen.length).toBeGreaterThan(1);
    expect(baslik(liste).map((b) => b.dataset.marka)).toEqual([...new Set(eslesen.map(marka))]);
    baslik(liste).forEach((b) => {
      const n = eslesen.filter((a) => marka(a) === b.dataset.marka).length;
      expect(eylem(b)).toBe('Hepsini ekle (' + cp._mntS(n, 0) + ')');
    });
    expect(tip(liste).map((o) => o.dataset.key)).toEqual(eslesen.map((a) => a.key));
    yaz(kutu, 'zzz');
    expect([baslik(liste).length, tip(liste).length, liste.textContent]).toEqual([0, 0, 'Eşleşen takoz yok.']);
  });

  test('tek tip tıkı eskisi gibi: gruba ekler, kutuyu boşaltır, tabloyu kapatır; eklenen tip tabloda yok', () => {
    const { n, ara, Y } = kur();
    const { kutu, liste, satir } = ara(1), A = Y().A;
    kutu.focus(); ac(liste);
    const o = tip(liste)[2], k = o.dataset.key;
    o.click();
    expect(n.data.adaylar[Y().M.G[0].anahtar]).toEqual([k]);
    expect([liste.hidden, kutu.value, document.activeElement === kutu]).toEqual([true, '', true]);
    expect(satir()).toEqual([k]);
    kutu.click(); ac(liste);
    expect(tip(liste).map((x) => x.dataset.key)).toEqual(P._mntParamListeSira(A).map((a) => a.key).filter((x) => x !== k));
  });
});

describe('EYLEM — markanın hepsi gruba', () => {
  test('Hepsini ekle: markanın aday tipleri o gruba, kütüphane sırasında, TEK geri-al adımı; öteki grup yerinde; tablo açık, başlık Hepsini çıkar', () => {
    const { n, ara, Y } = kur();
    const { kutu, liste, satir } = ara(1), G = Y().M.G, amc = markaTipleri(Y(), AMC);
    kutu.focus();
    expect(amc.length).toBeGreaterThan(20);
    baslik(liste).find((x) => x.dataset.marka === AMC).click();
    expect(global.saveState).toHaveBeenCalledTimes(1);
    expect(n.data.adaylar).toEqual({ [G[0].anahtar]: amc });                          // yalnız o grup, kütüphane sırası
    expect(Y().say).toEqual([amc.length, 0, 0]);
    expect(satir().slice().sort()).toEqual(amc.slice().sort());
    expect(document.getElementById('ve-mnt-param-oz-n-pm-1').textContent).toBe(amc.length + ' tip');
    expect(document.getElementById('ve-mnt-param-oz-n-pm-2').textContent).toBe('Mevcut tip');
    // tablo açık, kutu ve odak yerinde; başlık artık Hepsini çıkar, tip satırı kalmadı
    expect([liste.hidden, document.activeElement === kutu]).toEqual([false, true]);
    const b2 = baslik(liste).find((x) => x.dataset.marka === AMC);
    expect([b2.dataset.eylem, eylem(b2)]).toEqual(['cikar', 'Hepsini çıkar (' + cp._mntS(amc.length, 0) + ')']);
    expect(b2.getAttribute('aria-selected')).toBe('true');
    ac(liste, AMC);
    expect(tip(liste).some((o) => amc.includes(o.dataset.key))).toBe(false);                    // markanın hiçbir tipi kalmadı
    // ikinci marka da eklenir; kayıt kütüphane sırasında kalır
    const lpk = markaTipleri(Y(), 'LASPAR');
    baslik(liste).find((x) => x.dataset.marka === 'LASPAR').click();
    expect(global.saveState).toHaveBeenCalledTimes(2);
    expect(n.data.adaylar[G[0].anahtar]).toEqual(Y().Atum.map((a) => a.key).filter((k) => amc.includes(k) || lpk.includes(k)));
  });

  test('kısmen grupta: Hepsini ekle (eksik sayısı) yalnız eksikleri ekler; yeniden uygulamak adım düşürmez', () => {
    const { n, ara, Y } = kur();
    const { kutu, liste } = ara(2), G = Y().M.G, amc = markaTipleri(Y(), AMC);
    P.veMntParamGrupAday('pm', 2, amc[3], true);
    global.saveState.mockClear();
    kutu.focus();
    const b = baslik(liste).find((x) => x.dataset.marka === AMC);
    expect(eylem(b)).toBe('Hepsini ekle (' + cp._mntS(amc.length - 1, 0) + ')');
    expect(b.querySelector('.ve-prm-kz').textContent).toBe(cp._mntS(amc.length, 0) + ' tip');   // marka toplamı
    b.click();
    expect(n.data.adaylar[G[1].anahtar]).toEqual(amc);
    expect(global.saveState).toHaveBeenCalledTimes(1);
    expect(P.veMntParamGrupMarka('pm', 2, AMC, true, '')).toBe(false);                          // idempotent
    expect(global.saveState).toHaveBeenCalledTimes(1);
  });

  test('Hepsini çıkar: markanın tipleri gruptan çıkar (tek adım); başka marka ve başka grup yerinde; boşalan alan silinir', () => {
    const { n, ara, Y } = kur();
    const { kutu, liste } = ara(1), G = Y().M.G, amc = markaTipleri(Y(), AMC), lp = markaTipleri(Y(), 'LASPAR');
    P.veMntParamGrupMarka('pm', 1, AMC, true, '');
    P.veMntParamGrupMarka('pm', 1, 'LASPAR', true, '');
    P.veMntParamGrupMarka('pm', 3, 'LASPAR', true, '');
    global.saveState.mockClear();
    kutu.focus();
    const b = baslik(liste).find((x) => x.dataset.marka === AMC);
    expect(b.dataset.eylem).toBe('cikar');
    b.click();
    expect(global.saveState).toHaveBeenCalledTimes(1);
    expect(n.data.adaylar[G[0].anahtar]).toEqual(lp);
    expect(n.data.adaylar[G[2].anahtar]).toEqual(lp);                                           // öteki grup yerinde
    expect(baslik(liste).find((x) => x.dataset.marka === AMC).dataset.eylem).toBe('ekle');
    ac(liste, AMC);
    expect(tip(liste).filter((o) => amc.includes(o.dataset.key)).length).toBe(amc.length);      // tipleri tabloya döndü
    P.veMntParamGrupMarka('pm', 1, 'LASPAR', false, '');
    P.veMntParamGrupMarka('pm', 3, 'LASPAR', false, '');
    expect(n.data).toEqual({ adaylarKip: 'ozel' });
  });

  test('SORGU: başlığın eylemi sorguyu taşıyan tipler için — ekler ve çıkarır; sayı eylemin sayısı', () => {
    const { n, ara, Y } = kur();
    const { kutu, liste } = ara(1), G = Y().M.G;
    const eslesen = P._mntParamAra(P._mntParamListeSira(Y().A), 'cone 60', []).filter((a) => marka(a) === AMC).map((a) => a.key);
    expect(eslesen.length).toBeGreaterThan(1);
    kutu.focus(); yaz(kutu, 'cone 60');
    const b = baslik(liste).find((x) => x.dataset.marka === AMC);
    expect(eylem(b)).toBe('Hepsini ekle (' + eslesen.length + ')');
    b.click();
    expect(n.data.adaylar[G[0].anahtar]).toEqual(Y().Atum.map((a) => a.key).filter((k) => eslesen.includes(k)));   // yalnız sorguyu taşıyanlar
    expect(kutu.value).toBe('cone 60');                                                         // sorgu yerinde
    const b2 = baslik(liste).find((x) => x.dataset.marka === AMC);
    expect(eylem(b2)).toBe('Hepsini çıkar (' + eslesen.length + ')');
    expect(tip(liste).some((o) => eslesen.includes(o.dataset.key))).toBe(false);
    b2.click();
    expect(n.data.adaylar).toBeUndefined();
  });

  test('ELENEN TİP girmez ve sayılmaz: sehim aralığı dışındaki tip tabloda yok, başlığın sayısı kalanların; kayıtta kalan elenen çıkarılmaz', () => {
    const { n, ara, Y } = kur({ sehim: { alt: 3, ust: 5 } }, true);
    const { kutu, liste } = ara(1), G = Y().M.G;
    const y = Y(), elenen = y.E.elenen.map((a) => a.key);
    expect(y.E.aktif).toBe(true);
    expect(elenen.length).toBeGreaterThan(0);
    const tam6 = (e) => ['sx', 'sy', 'sz', 'dx', 'dy', 'dz'].every((f) => Number(e[f]) > 0);   // bağımsız hakem: çözülebilen tip
    const amcTum = Object.values(cp.veMntGetLibraryMap()).filter((e) => e.marka === AMC && e.aday !== false && tam6(e)).map((e) => e.key);
    const amc = markaTipleri(y, AMC);
    expect(amc.length).toBeLessThan(amcTum.length);
    expect(amc.some((k) => elenen.includes(k))).toBe(false);
    kutu.focus();
    const b = baslik(liste).find((x) => x.dataset.marka === AMC);
    expect(eylem(b)).toBe('Hepsini ekle (' + cp._mntS(amc.length, 0) + ')');
    ac(liste);
    expect(tip(liste).length).toBeGreaterThan(0);
    expect(tip(liste).some((o) => elenen.includes(o.dataset.key))).toBe(false);
    baslik(liste).find((x) => x.dataset.marka === AMC).click();
    expect(n.data.adaylar[G[0].anahtar]).toEqual(amc);
    expect(Y().say[0]).toBe(amc.length);
    // kayıtta kalan elenen tip: Hepsini çıkar yalnız görünenleri çıkarır
    const ek = elenen.slice(0, 1);
    n.data.adaylar = { [G[0].anahtar]: ek.concat(amc) };
    P.veMntParamGrupMarka('pm', 1, AMC, false, '');
    expect(n.data.adaylar[G[0].anahtar]).toEqual(Y().Atum.map((a) => a.key).filter((k) => ek.includes(k)));
    // aralık kalkınca elenen tipler markanın sayısına geri girer
    delete n.data.sehim;
    expect(markaTipleri(Y(), AMC).length).toBe(amcTum.length);
  });

  test('geçersiz girdi yazmaz: olmayan marka, olmayan grup, olmayan düğüm, eşleşmeyen sorgu', () => {
    const { n } = kur();
    expect(P.veMntParamGrupMarka('pm', 1, 'Yok marka', true, '')).toBe(false);
    expect(P.veMntParamGrupMarka('pm', 9, 'LASPAR', true, '')).toBe(false);
    expect(P.veMntParamGrupMarka('yok', 1, 'LASPAR', true, '')).toBe(false);
    expect(P.veMntParamGrupMarka('pm', 1, 'LASPAR', true, 'zzzz')).toBe(false);
    expect(global.saveState).not.toHaveBeenCalled();
    expect(n.data).toEqual({ adaylarKip: 'ozel' });
  });
});

describe('KLAVYE — Enter etkin satırın eylemi', () => {
  test('yazınca etkin satır ilk tip: Enter tipi ekler; ↑ başlığa çıkar, Enter markayı ekler, yeniden Enter çıkarır; Esc temizler ve kapatır', () => {
    const { n, ara, Y } = kur();
    const { kutu, liste } = ara(1), G = Y().M.G;
    kutu.focus();
    yaz(kutu, 'cone');
    const ilk = tip(liste)[0].dataset.key;
    expect(kutu.getAttribute('aria-activedescendant')).toBe(tip(liste)[0].id);
    expect(tus(kutu, 'Enter').defaultPrevented).toBe(true);
    expect(n.data.adaylar[G[0].anahtar]).toEqual([ilk]);
    expect([liste.hidden, kutu.value]).toEqual([true, '']);
    // ↓ tabloyu yeniden açar (başlıklar kapalı, etkin satır yok); yazınca ilk tip satırı etkin; ↑ onun başlığına çıkar
    tus(kutu, 'ArrowDown');
    expect([liste.hidden, tip(liste).length]).toEqual([false, 0]);
    yaz(kutu, 'cone');
    const dizi = () => [...liste.querySelectorAll('[role="option"]')];
    const etkin = () => dizi().filter((o) => o.getAttribute('aria-selected') === 'true');
    expect(etkin().length).toBe(1);
    expect(etkin()[0].classList.contains('ve-prm-ara-o')).toBe(true);
    const yer = dizi().indexOf(etkin()[0]);
    tus(kutu, 'ArrowUp');
    const ust = etkin()[0];
    expect(ust.classList.contains('ve-prm-ara-m')).toBe(true);
    expect(dizi().indexOf(ust)).toBe(yer - 1);
    const ad = ust.dataset.marka, mt = P._mntParamAra(P._mntParamListeSira(Y().A).filter((a) => marka(a) === ad), 'cone', []).map((a) => a.key);
    tus(kutu, 'Enter');
    expect(global.saveState).toHaveBeenCalledTimes(2);
    expect(Y().ham[G[0].anahtar]).toEqual(expect.arrayContaining(mt));
    expect([liste.hidden, etkin()[0].dataset.marka, etkin()[0].dataset.eylem]).toEqual([false, ad, 'cikar']);   // tablo açık, etkin satır aynı başlık
    tus(kutu, 'Enter');
    expect(global.saveState).toHaveBeenCalledTimes(3);
    expect(Y().ham[G[0].anahtar] || []).toEqual(mt.includes(ilk) ? [] : [ilk]);
    tus(kutu, 'Escape');
    expect([kutu.value, liste.hidden]).toEqual(['', true]);
  });

  test('→ ve ← başlığı açar ve kapatır (boş kutuda); sorgu varken markalar hep açık; etkin satır başlıkta kalır', () => {
    const { ara, Y } = kur();
    const { kutu, liste } = ara(1);
    kutu.focus();
    tus(kutu, 'ArrowDown');                                                                    // ilk başlık
    const ad = baslik(liste)[0].dataset.marka;
    expect(baslik(liste)[0].getAttribute('aria-selected')).toBe('true');
    tus(kutu, 'ArrowRight');
    expect(tip(liste).map((o) => o.dataset.key)).toEqual(markaSira(Y(), ad));
    expect(baslik(liste)[0].getAttribute('aria-selected')).toBe('true');
    expect(global.saveState).not.toHaveBeenCalled();
    tus(kutu, 'ArrowLeft');
    expect(tip(liste).length).toBe(0);
    yaz(kutu, 'cone');
    expect(baslik(liste).every((b) => b.dataset.acik === 'true')).toBe(true);
    baslik(liste)[0].querySelector('.ve-prm-ara-ok').click();                                  // sorguyla kapanmaz
    expect(baslik(liste)[0].dataset.acik).toBe('true');
  });

  test('tip satırı kalmadıysa etkin satır yok: Enter hiçbir şey yapmaz (başlığı kazara çalıştırmaz)', () => {
    const { n, ara, Y } = kur();
    const { kutu, liste } = ara(1), G = Y().M.G;
    Y().Atum.forEach((a) => P.veMntParamGrupAday('pm', 1, a.key, true));
    global.saveState.mockClear();
    kutu.focus();
    expect([tip(liste).length, baslik(liste).every((b) => b.dataset.eylem === 'cikar'), kutu.hasAttribute('aria-activedescendant')]).toEqual([0, true, false]);
    expect(tus(kutu, 'Enter').defaultPrevented).toBe(true);
    expect(global.saveState).not.toHaveBeenCalled();
    expect(n.data.adaylar[G[0].anahtar].length).toBe(Y().A.length);
  });

  test('Kaldır odağı kutuya döndürünce tablo kendiliğinden açılmaz', () => {
    const { ara, Y } = kur();
    const { kutu, liste } = ara(1);
    P.veMntParamGrupAday('pm', 1, Y().A[0].key, true);
    document.querySelector('#ve-mnt-param-oz-pm-1 li button').click();
    expect([document.activeElement === kutu, liste.hidden]).toEqual([true, true]);
  });
});
