/**
 * mount-param-secim.test.js — Parametrik Analiz · ÖZEL KOMBİNASYON: MARKA BAŞLIKLI SEÇİM LİSTESİ
 * ─────────────────────────────────────────────────────────────────────────
 * Kullanıcı (2026-11-13, Canlı Not 1012): "Bak pencere yapısını tamamen bozmuşsun abi. Yani, özel
 * kombinasyonda, takoz markası seçiyorum, seçtiğim zaman marka seçtiğim pencere gitmediği için
 * seçemiyorum takozları. Ayrıca bu seçilen takozlar da kutucuk şeklinde olsun hızlı hızlı seçilsin."
 * Canlı Not 1010'un açılır tablosu (marka başlığının tıkı tabloyu açık bırakıyor, tablo eklenenlerin
 * listesini örtüyordu) ve eklenenlerin ✕'li satırları yerine.
 *
 * Kapılar (js/cp-mount-param.js → _mntParamSecListeHTML · veMntParamSecMarka · veMntParamSecTip ·
 * veMntParamSecAc · veMntParamSecAra):
 *   AKIŞTA   — liste yüzmez: açılır tablo, gizli liste ve ✕'li satır yok; CSS'te liste akışta
 *   MARKA    — satırlar marka sırasıyla; üç durumlu kutu (false · mixed · true) ve seçili / toplam; kutu
 *              markanın aday tiplerini seçer ve bırakır (tek geri-al adımı), karışıkta hepsini seçer
 *   TİP      — satırın tıkı tek tipi seçer ve bırakır (tek adım, kayıt kütüphane sırasında)
 *   AÇIKLIK  — seçili tipi olan marka açık, öteki kapalı; ok açar ve kapatır, modele yazılmaz
 *   ARAMA    — sorgu listeyi süzer; marka kutusu yalnız görünen tipleri seçer; Esc temizler
 *   YERİNDE  — tık listeyi yerinde tazeler; pencere kurulmaz; odak tıklanan denetimin yeni öğesinde
 *   ELENEN   — sehim aralığı dışındaki tip listede ve sayaçta yok; kayıtta kalan elenen bırakılmaz
 */
const fs = require('fs');
const path = require('path');
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
  Object.keys(P._MNT_PARAM_SEC).forEach((k) => { delete P._MNT_PARAM_SEC[k]; });   // görünüm durumu testten teste taşınmaz
  const n = { id: 'pm', type: 'mnt-parametric', data: Object.assign({ adaylarKip: 'ozel' }, data || {}) };
  global.nodes.push(n);
  global.saveState = jest.fn(() => cp.veMntPencereTazele());
  document.body.innerHTML = '<div class="ve-properties-content">' + P.getMntParamPropertiesHTML(n) + '</div>';
  return { n, Y: () => P._mntParamYeni(n) };
}
const liste = (no) => document.getElementById('ve-mnt-param-sec-pm-' + no);
const marka = (no) => [...liste(no).querySelectorAll('.ve-prm-sec-g')];
const mSatir = (no, ad) => marka(no).find((g) => g.dataset.marka === ad);
const kutu = (g) => g.querySelector('.ve-prm-sec-m .vsig-ck');
const ok = (g) => g.querySelector('.ve-prm-sec-ac');
const sayac = (g) => g.querySelector('.ve-prm-sec-m .ve-prm-kz').textContent;
const tipler = (g) => [...g.querySelectorAll('.ve-prm-sec-o')];
const secili = (g) => tipler(g).filter((b) => b.getAttribute('aria-checked') === 'true').map((b) => b.dataset.key);
const markaAd = (a) => (a.e && a.e.marka) || 'Diğer';
// Bağımsız hakem: markanın aday tipleri kütüphane sırasında (kaydın sırası) …
const markaTipleri = (Y, ad) => Y.A.filter((a) => markaAd(a) === ad).map((a) => a.key);
// … ve listenin sırası: Takoz Özellikleri'nin Tip listesininki
const markaSira = (Y, ad) => P._mntParamListeSira(Y.A).filter((a) => markaAd(a) === ad).map((a) => a.key);
const sayi = (v) => cp._mntS(v, 0);
const AMC = 'AMC Mecanocaucho';
const LP = 'LASPAR';

describe('AKIŞTA — liste pencerenin içinde, üstünde yüzen tablo yok', () => {
  test('her grupta arama kutusu ve liste; açılır tablo, gizli liste ve ✕ yok; CSS\'te liste akışta ve kaydırılır', () => {
    const { Y } = kur();
    const G = Y().M.G;
    G.forEach((g) => {
      const L = liste(g.no), inp = document.getElementById('ve-mnt-param-ara-pm-' + g.no);
      expect([L.hidden, L.getAttribute('aria-label'), inp.getAttribute('aria-controls'), inp.getAttribute('placeholder')])
        .toEqual([false, g.ad, L.id, 'Takoz ara']);
    });
    const oz = document.querySelector('.ve-prm-oz-l');
    expect(oz.querySelectorAll('[hidden], [role="listbox"], [role="combobox"], .ve-prm-oz-x, ul').length).toBe(0);
    const css = fs.readFileSync(path.join(__dirname, '../../css/styles.css'), 'utf8');
    const kural = /\.ve-prm-sec\{([^}]*)\}/.exec(css);
    expect(kural).not.toBeNull();
    expect(kural[1]).not.toMatch(/position:\s*(absolute|fixed)/);
    expect(kural[1]).toMatch(/overflow-y:\s*auto/);
    expect(css).not.toMatch(/\.ve-prm-ara-l\b/);                                    // eski açılır tablonun kuralı yok
  });
});

describe('MARKA — üç durumlu kutu', () => {
  test('satırlar marka sırasıyla, kutu boş ve marka kapalı; kutu markanın aday tiplerini seçer (tek adım): kutu dolu, sayaç n / n, marka açık; ikinci tık bırakır', () => {
    const { n, Y } = kur();
    const y = Y(), G = y.M.G, amc = markaTipleri(y, AMC);
    expect(marka(1).map((g) => g.dataset.marka)).toEqual([...new Set(P._mntParamListeSira(y.A).map(markaAd))]);
    marka(1).forEach((g) => {
      expect([kutu(g).getAttribute('role'), kutu(g).getAttribute('aria-checked'), kutu(g).getAttribute('aria-label'),
        ok(g).getAttribute('aria-expanded'), tipler(g).length]).toEqual(['checkbox', 'false', g.dataset.marka, 'false', 0]);
      expect(sayac(g)).toBe('0 / ' + sayi(markaTipleri(y, g.dataset.marka).length));
    });
    expect(amc.length).toBeGreaterThan(10);
    kutu(mSatir(1, AMC)).click();
    expect(global.saveState).toHaveBeenCalledTimes(1);
    expect(n.data.adaylar).toEqual({ [G[0].anahtar]: amc });
    const g = mSatir(1, AMC);
    expect([kutu(g).getAttribute('aria-checked'), kutu(g).classList.contains('all'), ok(g).getAttribute('aria-expanded')])
      .toEqual(['true', true, 'true']);
    expect(sayac(g)).toBe(sayi(amc.length) + ' / ' + sayi(amc.length));
    expect(tipler(g).map((b) => b.dataset.key)).toEqual(markaSira(y, AMC));
    expect(secili(g)).toEqual(markaSira(y, AMC));
    expect(document.getElementById('ve-mnt-param-oz-n-pm-1').textContent).toBe(amc.length + ' tip');
    expect(marka(2).every((x) => kutu(x).getAttribute('aria-checked') === 'false')).toBe(true);   // öteki grup yerinde
    expect(marka(1).filter((x) => x.dataset.marka !== AMC).every((x) => kutu(x).getAttribute('aria-checked') === 'false')).toBe(true);
    kutu(mSatir(1, AMC)).click();                                                  // ikinci tık bırakır
    expect(global.saveState).toHaveBeenCalledTimes(2);
    expect(n.data).toEqual({ adaylarKip: 'ozel' });
    expect([kutu(mSatir(1, AMC)).getAttribute('aria-checked'), tipler(mSatir(1, AMC)).length]).toEqual(['false', 0]);
    expect(document.getElementById('ve-mnt-param-oz-n-pm-1').textContent).toBe('Mevcut tip');
  });

  test('geçersiz girdi yazmaz: olmayan marka, olmayan grup, olmayan düğüm, eşleşmeyen sorgu', () => {
    const { n } = kur();
    expect(P.veMntParamGrupMarka('pm', 1, 'Yok marka', true, '')).toBe(false);
    expect(P.veMntParamGrupMarka('pm', 9, LP, true, '')).toBe(false);
    expect(P.veMntParamGrupMarka('yok', 1, LP, true, '')).toBe(false);
    expect(P.veMntParamGrupMarka('pm', 1, LP, true, 'zzzz')).toBe(false);
    expect(global.saveState).not.toHaveBeenCalled();
    expect(n.data).toEqual({ adaylarKip: 'ozel' });
  });
});

describe('TİP — satırın tıkı tek tipi seçer ve bırakır', () => {
  test('bırakılan tip: satır boş, marka kutusu karışık, sayaç düşer; yeniden seçilen tip kütüphane sırasında; karışık kutunun tıkı hepsini seçer', () => {
    const { n, Y } = kur();
    const y = Y(), G = y.M.G, amc = markaTipleri(y, AMC), S = markaSira(y, AMC);
    kutu(mSatir(1, AMC)).click();
    const satir = (k) => tipler(mSatir(1, AMC)).find((b) => b.dataset.key === k);
    satir(S[1]).click();
    expect(n.data.adaylar[G[0].anahtar]).toEqual(amc.filter((k) => k !== S[1]));
    expect([satir(S[1]).getAttribute('aria-checked'), satir(S[1]).querySelector('.vsig-ck').classList.contains('on')]).toEqual(['false', false]);
    expect([satir(S[0]).getAttribute('aria-checked'), satir(S[0]).querySelector('.vsig-ck').classList.contains('on')]).toEqual(['true', true]);
    const g = mSatir(1, AMC);
    expect([kutu(g).getAttribute('aria-checked'), kutu(g).classList.contains('some')]).toEqual(['mixed', true]);
    expect(sayac(g)).toBe(sayi(amc.length - 1) + ' / ' + sayi(amc.length));
    satir(S[3]).click();
    satir(S[1]).click();                                                           // yeniden seçer
    expect(n.data.adaylar[G[0].anahtar]).toEqual(amc.filter((k) => k !== S[3]));   // kayıt kütüphane sırasında
    expect(global.saveState).toHaveBeenCalledTimes(4);                              // her tık bir adım
    kutu(mSatir(1, AMC)).click();                                                  // karışık → hepsi
    expect(n.data.adaylar[G[0].anahtar]).toEqual(amc);
    expect(kutu(mSatir(1, AMC)).getAttribute('aria-checked')).toBe('true');
    // satırın tamamı tıklanır: ad ve kz satırın içinde; grubun bugünkü tipi işaretli
    const lp = markaSira(y, LP);
    ok(mSatir(1, LP)).click();
    tipler(mSatir(1, LP)).forEach((b, i) => {
      expect([b.tagName, b.getAttribute('role'), b.dataset.key]).toEqual(['BUTTON', 'checkbox', lp[i]]);
      expect(b.querySelector('.ve-prm-kz').textContent).toBe(P._mntParamKz(cp.veMntGetLibraryMap()[lp[i]]));
    });
    expect(tipler(mSatir(1, LP)).filter((b) => b.querySelector('.ve-prm-mev')).map((b) => b.dataset.key))
      .toEqual(lp.filter((k) => k === G[0].tip));
  });
});

describe('AÇIKLIK — görünüm durumu, modelde değil', () => {
  test('ok açar ve kapatır (model ve geri-al yığını değişmez); kapatılan marka seçili tipiyle kapalı kalır, pencere yeniden kurulunca da; öteki grup ayrı', () => {
    const { n, Y } = kur();
    const S = markaSira(Y(), LP);
    ok(mSatir(1, LP)).click();
    expect(global.saveState).not.toHaveBeenCalled();
    expect(n.data).toEqual({ adaylarKip: 'ozel' });
    expect([ok(mSatir(1, LP)).getAttribute('aria-expanded'), tipler(mSatir(1, LP)).map((b) => b.dataset.key)]).toEqual(['true', S]);
    expect(secili(mSatir(1, LP))).toEqual([]);
    expect(document.activeElement).toBe(ok(mSatir(1, LP)));                         // odak okta kalır
    tipler(mSatir(1, LP))[0].click();                                              // seçince açık kalır
    expect(ok(mSatir(1, LP)).getAttribute('aria-expanded')).toBe('true');
    ok(mSatir(1, LP)).click();                                                     // kapat
    expect([ok(mSatir(1, LP)).getAttribute('aria-expanded'), tipler(mSatir(1, LP)).length]).toEqual(['false', 0]);
    expect(sayac(mSatir(1, LP))).toBe('1 / ' + sayi(S.length));
    expect(kutu(mSatir(1, LP)).getAttribute('aria-checked')).toBe(S.length > 1 ? 'mixed' : 'true');
    document.body.innerHTML = '<div class="ve-properties-content">' + P.getMntParamPropertiesHTML(n) + '</div>';
    expect(tipler(mSatir(1, LP)).length).toBe(0);
    expect(ok(mSatir(2, LP)).getAttribute('aria-expanded')).toBe('false');
    expect(global.saveState).toHaveBeenCalledTimes(1);                             // yalnız seçim
  });
});

describe('ARAMA — liste süzülür', () => {
  test('sorgu: eşleşen markalar açık ve yalnız eşleşen tipler; marka kutusu yalnız görünenleri seçer; ok sorguda da kapatır; eşleşme yoksa durum; Esc temizler', () => {
    const { n, Y } = kur();
    const y = Y(), G = y.M.G;
    const inp = document.getElementById('ve-mnt-param-ara-pm-1');
    const yaz = (q) => { inp.value = q; inp.dispatchEvent(new Event('input', { bubbles: true })); };
    const tus = (k) => { const e = new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true }); inp.dispatchEvent(e); return e; };
    // bağımsız hakem: düz küçük harf, sözcüklerin hepsi adda ya da markada
    const hakem = (q) => P._mntParamListeSira(y.A).filter((a) => q.toLowerCase().split(/\s+/).filter(Boolean)
      .every((w) => (a.name + ' ' + markaAd(a)).toLowerCase().includes(w)));
    const es = hakem('cone 60');
    expect(es.length).toBeGreaterThan(2);
    yaz('cone 60');
    expect(document.getElementById('ve-mnt-param-ara-pm-1')).toBe(inp);           // kutu yerinde
    expect(marka(1).map((g) => g.dataset.marka)).toEqual([...new Set(es.map(markaAd))]);
    expect(marka(1).flatMap((g) => tipler(g).map((b) => b.dataset.key))).toEqual(es.map((a) => a.key));
    const esAmc = es.filter((a) => markaAd(a) === AMC).map((a) => a.key);
    expect(sayac(mSatir(1, AMC))).toBe('0 / ' + sayi(esAmc.length));
    kutu(mSatir(1, AMC)).click();
    expect(n.data.adaylar[G[0].anahtar]).toEqual(y.A.map((a) => a.key).filter((k) => esAmc.includes(k)));
    expect(kutu(mSatir(1, AMC)).getAttribute('aria-checked')).toBe('true');
    expect([inp.value, marka(1).flatMap((g) => tipler(g).map((b) => b.dataset.key))]).toEqual(['cone 60', es.map((a) => a.key)]);
    ok(mSatir(1, AMC)).click();                                                    // sorguda da kapatır
    expect(tipler(mSatir(1, AMC)).length).toBe(0);
    yaz('cone 6');                                                                 // sorgu değişince yeniden açık
    expect(tipler(mSatir(1, AMC)).length).toBe(hakem('cone 6').filter((a) => markaAd(a) === AMC).length);
    yaz('zzzz');
    expect([marka(1).length, liste(1).textContent]).toEqual([0, 'Eşleşen takoz yok.']);
    expect(tus('Escape').defaultPrevented).toBe(true);                              // Esc temizler, pencereye gitmez
    expect(inp.value).toBe('');
    expect(marka(1).length).toBe(new Set(y.A.map(markaAd)).size);
    expect(ok(mSatir(1, AMC)).getAttribute('aria-expanded')).toBe('true');          // seçili tipi var: açık
    expect(tus('Escape').defaultPrevented).toBe(false);                             // boş kutuda Esc pencereye gider
  });
});

describe('YERİNDE — tık pencereyi kurmaz', () => {
  test('liste yerinde tazelenir: gövde, çizim ve arama kutusu aynı öğe; odak tıklanan denetimin yeni öğesinde; sayılar ve Analiz değişir', () => {
    const { Y } = kur();
    const govde = document.querySelector('#ve-fp-panes-pm'), cizim = document.querySelector('#ve-mnt-param-ak-pm');
    const inp = document.getElementById('ve-mnt-param-ara-pm-1'), L0 = liste(1);
    kutu(mSatir(1, AMC)).focus();
    kutu(mSatir(1, AMC)).click();
    expect(liste(1)).not.toBe(L0);
    expect(document.querySelector('#ve-fp-panes-pm')).toBe(govde);
    expect(document.querySelector('#ve-mnt-param-ak-pm')).toBe(cizim);
    expect(document.getElementById('ve-mnt-param-ara-pm-1')).toBe(inp);
    expect(document.activeElement).toBe(kutu(mSatir(1, AMC)));
    const t = tipler(mSatir(1, AMC))[2];
    t.focus(); t.click();
    expect(document.activeElement).toBe(tipler(mSatir(1, AMC))[2]);
    expect(document.activeElement.getAttribute('aria-checked')).toBe('false');
    const N = Y().say[0];
    expect(N).toBe(markaTipleri(Y(), AMC).length - 1);
    const A = Object.fromEntries([...document.querySelectorAll('.ve-fp-side .ve-fp-f')]
      .map((f) => [f.querySelector('.ve-fp-l').textContent, f.querySelector('input').value]));
    expect([A['Taranan grup'], A['Kombinasyon']]).toEqual(['1 / ' + Y().M.G.length, sayi(N)]);
  });
});

describe('ELENEN — beklenen takoz sehimiyle', () => {
  test('sehim aralığı dışındaki tip listede ve sayaçta yok, seçilmez; kutunun bırakması kayıtta kalan elenen tipi çıkarmaz; aralık kalkınca geri gelir', () => {
    const { n, Y } = kur({ sehim: { alt: 3, ust: 5 } }, true);
    const y = Y(), G = y.M.G, elenen = y.E.elenen.map((a) => a.key);
    expect(y.E.aktif).toBe(true);
    expect(elenen.length).toBeGreaterThan(0);
    const tam6 = (e) => ['sx', 'sy', 'sz', 'dx', 'dy', 'dz'].every((f) => Number(e[f]) > 0);   // bağımsız hakem
    const amcTum = Object.values(cp.veMntGetLibraryMap()).filter((e) => e.marka === AMC && e.aday !== false && tam6(e)).map((e) => e.key);
    const amc = markaTipleri(y, AMC);
    expect(amc.length).toBeLessThan(amcTum.length);
    expect(amc.some((k) => elenen.includes(k))).toBe(false);
    expect(sayac(mSatir(1, AMC))).toBe('0 / ' + sayi(amc.length));
    kutu(mSatir(1, AMC)).click();
    expect(n.data.adaylar[G[0].anahtar]).toEqual(amc);
    expect(tipler(mSatir(1, AMC)).some((b) => elenen.includes(b.dataset.key))).toBe(false);
    n.data.adaylar = { [G[0].anahtar]: elenen.slice(0, 1).concat(amc) };
    document.body.innerHTML = '<div class="ve-properties-content">' + P.getMntParamPropertiesHTML(n) + '</div>';
    expect(kutu(mSatir(1, AMC)).getAttribute('aria-checked')).toBe('true');
    kutu(mSatir(1, AMC)).click();
    expect(n.data.adaylar[G[0].anahtar]).toEqual(elenen.slice(0, 1));
    delete n.data.sehim;
    expect(markaTipleri(Y(), AMC).length).toBe(amcTum.length);
  });
});
