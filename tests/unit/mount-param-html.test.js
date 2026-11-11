/**
 * @jest-environment jsdom
 */
// TAKOZ · PARAMETRİK ANALİZ — HTML RAPORU (js/mount-param-html.js)
// Kullanıcı kararı (2026-11-11): "HTML raporunun temelini kur … sadece temel yapıyı oluştur."
// Kapılar:
//   VERİ     — belge Excel'in girdisini (E) taşır: Özet'in K'ları, Tarama'nın satırları, Veri
//              kodu (sehim mm/100) ikili ve base64 — Int16'ya sığarsa Int16, sığmazsa Int32;
//              "sonuç yok" korunur
//   DİLİMLİ  — adım adım kurulum tek çağrının aynısı; parçalar birleşince aynı belge
//   SAYFA    — açılış Özet; Tarama sayaç · sıralama · sayfa; satıra tık Sonuç'u o
//              konfigürasyonla açar (sehim gömülü veriden); K'nın sonucu kendi yük durumları;
//              adres (#T2 · #tarama) görünümü seçer; geri · ileri
//   OKUR     — belge hesaplamaz: programın çözücüsüne ve penceresine başvuru yok; sayı
//              programın yazıcısıyla (js/sayi.js'in kaynağı gömülü)
const H = require('../../js/mount-param-html.js');
const { veSayi } = require('../../js/sayi.js');

const BOS = -2147483648;
function E_(buyuk) {
  // 3 satır × 2 yük durumu × 3 takoz × X/Y/Z (mm/100)
  const kod = new Int32Array(3 * 2 * 3 * 3).fill(BOS);
  const yaz = (i, q, m, xyz) => xyz.forEach((v, a) => { kod[((i * 2 + q) * 3 + m) * 3 + a] = v; });
  yaz(0, 0, 0, [-30, 10, -390]); yaz(0, 0, 1, [1, 0, -543]); yaz(0, 0, 2, [4, 0, -592]);
  yaz(0, 1, 0, [-172, 3, -502]); yaz(0, 1, 1, [15, 0, -1504]);                // 3. takozun Max Bump'ı yok
  yaz(1, 0, 0, [-12, 0, -1500]); yaz(1, 0, 1, [2, 0, -1200]); yaz(1, 0, 2, [2, 0, -1210]);
  yaz(2, 0, 0, [0, 0, -1510]); yaz(2, 0, 1, [0, 0, -900]); yaz(2, 0, 2, [0, 0, -905]);
  if (buyuk) yaz(2, 1, 0, [-123456, 234567, -345678]);
  const modF = new Float64Array(18).fill(NaN), modAd = new Uint16Array(18).fill(65535);
  [[6.82, 7.98, 11.41, 12.04, 14.21, 15.21], [3.58, 4.45, 6.0, 7.78, 10.11, 12.13], [3.7, 4.42, 6.0, 7.01, 8.9, 12.0]]
    .forEach((f, i) => f.forEach((v, j) => { modF[i * 6 + j] = v; modAd[i * 6 + j] = j % 2; }));
  const vaka = (ad, dz) => ({ ad, d: [[0.2, 0, dz[0]], [-0.5, 0.0044, dz[1]], [-0.45, 0.0044, dz[2]]] });
  return {
    baslik: '10 Ton TTA — takoz konfigürasyonları', fAtes: 35, trSinir: 0.15, rolanti: 700, silindir: 6, zeta: 0.02, kutle: 1739.1,
    gruplar: ['Ön takoz · 57RS313774', 'Sağ/Sol arka takoz · 57RS313773'],
    takozlar: [{ ad: 'Ön takoz · 57RS313774', grup: 0 }, { ad: 'Sağ arka takoz · 57RS313773', grup: 1 }, { ad: 'Sol arka takoz · 57RS313773', grup: 1 }],
    konfig: [
      { K: 0, mevcut: true, tipler: ['57RS313774 (ASR-SR-116)', '57RS313773 (ASR-SR-116)'], uygunluk: 'Uygun değil',
        kriter: [true, true, false, true], d: 2.9001, f: [5.11, 5.70, 6.53, 8.49, 10.79, 15.47], T: 0.10309,
        takozTip: ['57RS313774 (ASR-SR-116)', '57RS313773 (ASR-SR-116)', '57RS313773 (ASR-SR-116)'],
        vakalar: [vaka('Static', [-2.69, -2.66, -2.9]), vaka('Max Bump', [-15.1, -8.9, -9.7])],
        modlar: [{ f: 5.70, ad: 'roll' }, { f: 5.11, ad: 'pitch+bounce' }] },
      { K: 1, tipler: ['TK040 45 ShA (57RS329001M)', 'Cone 121 NP 55 ShA (AMC 137829)'], uygunluk: 'En uygun',
        kriter: [true, true, true, true], d: 5.9178, f: [6.82, 7.98, 11.41, 12.04, 14.21, 15.21], T: 0.121701,
        takozTip: ['TK040 45 ShA (57RS329001M)', 'Cone 121 NP 55 ShA (AMC 137829)', 'Cone 121 NP 55 ShA (AMC 137829)'],
        vakalar: [vaka('Static', [-3.9, -5.43, -5.92])], modlar: [{ f: 6.82, ad: 'roll' }] },
      { K: 2, tipler: ['Mount 1 70 ShA', 'Cone 39 50 ShA (AMC 137982)'], uygunluk: 'Uygun',
        kriter: [true, true, true, true], d: 6.0128, f: [5.69, 7.03, 7.86, 10.53, 11.06, 13.16], T: 0.051,
        takozTip: ['Mount 1 70 ShA', 'Cone 39 50 ShA (AMC 137982)', 'Cone 39 50 ShA (AMC 137982)'],
        vakalar: [vaka('Static', [-3.1, -6.0, -6.01])], modlar: [{ f: 5.69, ad: 'yaw+lateral' }] }
    ],
    tarama: {
      N: 4, gruplar: [1], adaylar: [['Cone 121 NP 55 ShA (AMC 137829)', 'Cone 39 50 ShA (AMC 137982)', 'Mount 1 40 ShA']],
      satirlar: [
        { tipler: ['Cone 121 NP 55 ShA (AMC 137829)'], f: [6.82, 7.98, 11.41, 12.04, 14.21, 15.21], fB: 9.1, T: 0.1217, d: 5.9178, k: [true, true, true, true], yuk: [210], azami: [null] },
        { tipler: ['Cone 39 50 ShA (AMC 137982)'], f: [3.58, 4.45, 6.0, 7.78, 10.11, 12.13], fB: 8.2, T: 0.2, d: 15.0, k: [true, false, true, false], yuk: [205], azami: [null] },
        { tipler: ['Mount 1 40 ShA'], f: [3.7, 4.42, 6.0, 7.01, 8.9, 12.0], fB: 7.4, T: 0.31, d: 15.1, k: [true, false, false, false], yuk: [199], azami: [null] }
      ],
      veri: { vakaAdlari: ['Static', 'Max Bump'], nT: 3, nM: 6, kod, modF, modAd, modAdlar: ['bounce+pitch', 'roll'] }
    }
  };
}
const TARIH = { tarih: new Date(2026, 10, 11) };
function veriOku(html) {
  const m = /<script type="application\/json" id="ve-veri">([\s\S]*?)<\/script>/.exec(html);
  return JSON.parse(m[1]);
}
function coz(x) {
  const s = atob(x.b), u = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i);
  return x.t === 'i16' ? new Int16Array(u.buffer) : x.t === 'i32' ? new Int32Array(u.buffer) : x.t === 'u16' ? new Uint16Array(u.buffer) : new Float32Array(u.buffer);
}
// Belge kendi penceresinde (iframe): betiği çalışır, dinleyicileri öteki testlere taşmaz.
function ac(html, adres) {
  const f = document.createElement('iframe');
  document.body.appendChild(f);
  const d = f.contentDocument;
  d.open(); d.write(html); d.close();
  const w = f.contentWindow;
  if (adres) { w.location.hash = adres; w.veRapor.goster(); }
  return w;
}
const metin = (el) => el.textContent.replace(/\s+/g, ' ').trim();

describe('VERİ', () => {
  test('belge tek dosya: doctype, lang="tr", başlık; veri JSON\'u K\'ları ve Tarama\'nın satırlarını taşır', () => {
    const E = E_(), html = H.belge(E, TARIH), D = veriOku(html);
    expect(html.startsWith('<!doctype html>\n<html lang="tr">')).toBe(true);
    expect(html).toMatch(/<title>10 Ton TTA — takoz konfigürasyonları<\/title>/);
    expect(D.konfig.map((k) => [k.K, k.u, k.tip])).toEqual([
      [0, 'Uygun değil', ['57RS313774', '57RS313773']],                        // "ASR…" eki yazılmaz
      [1, 'En uygun', ['TK040 45 ShA (57RS329001M)', 'Cone 121 NP 55 ShA (AMC 137829)']],
      [2, 'Uygun', ['Mount 1 70 ShA', 'Cone 39 50 ShA (AMC 137982)']]]);
    expect(D.konfig[0].k).toBe(0b1011);                                       // dört kriter bit bit
    expect(D.konfig[0].mod.map((m) => m[0])).toEqual([5.11, 5.7]);            // modlar frekansa göre
    expect(D.gruplar).toEqual(['Ön takoz', 'Sağ/Sol arka takoz']);
    expect(D.tarama.n).toBe(3);
    expect(D.tarama.N).toBe(4);
    expect(D.tarama.adlar[0][D.tarama.tip[0][1]]).toBe('Cone 39 50 ShA (AMC 137982)');
    expect(D.tarama.d).toEqual([5.9178, 15, 15.1]);
    expect(D.tarama.k).toEqual([15, 0b0101, 0b0001]);
    expect(D.kriter.map((q) => q.ad + ' · ' + q.s)).toEqual(['Kriter 1 · Modal bant < 17,50 Hz',
      'Kriter 1a · Mod ayrıklığı > 0,5 Hz', 'Kriter 1b · 8–10 Hz bandında mod yok', 'Kriter 2 · TR < %15']);
  });

  test('Veri kodu Int16\'ya sığıyorsa Int16 — değerler ve "sonuç yok" birebir', () => {
    const E = E_(), D = veriOku(H.belge(E, TARIH)), k = coz(D.tarama.kod);
    expect(D.tarama.kod.t).toBe('i16');
    expect(k.length).toBe(E.tarama.veri.kod.length);
    expect(Array.from(k, (v) => (v === -32768 ? BOS : v))).toEqual(Array.from(E.tarama.veri.kod));
    expect(Array.from(coz(D.tarama.modAd))).toEqual(Array.from(E.tarama.veri.modAd));
    const f = coz(D.tarama.modF);
    Array.from(E.tarama.veri.modF).forEach((v, i) => expect(f[i]).toBeCloseTo(v, 4));
  });

  test('sığmayan değer varsa Int32 — dizi olduğu gibi', () => {
    const E = E_(true), D = veriOku(H.belge(E, TARIH));
    expect(D.tarama.kod.t).toBe('i32');
    expect(Array.from(coz(D.tarama.kod))).toEqual(Array.from(E.tarama.veri.kod));
  });

  test('taramasız E: Özet ve Sonuç, Tarama yok', () => {
    const E = E_(); delete E.tarama;
    const D = veriOku(H.belge(E, TARIH));
    expect(D.tarama).toBeNull();
    const w = ac(H.belge(E, TARIH));
    expect(w.document.getElementById('n-tarama').hidden).toBe(true);
    expect(w.document.querySelectorAll('#ve-ozet tbody tr').length).toBe(3);
  });
});

describe('DİLİMLİ', () => {
  test('adım adım kurulum tek çağrının aynısı; oran artar; parçalar birleşince aynı belge', () => {
    const E = E_(), J = H.is(E, TARIH), oran = [];
    while (J.adim()) oran.push(J.oran());
    expect(oran.length).toBeGreaterThan(1);
    oran.forEach((v, i) => { if (i) expect(v).toBeGreaterThanOrEqual(oran[i - 1]); });
    expect(J.oran()).toBe(1);
    const p = J.parcalar();
    expect(p.length).toBeGreaterThan(3);
    expect(p.join('')).toBe(H.belge(E, TARIH));
  });
});

describe('SAYFA', () => {
  const html = H.belge(E_(), TARIH);

  test('açılış Özet: K0…K2, Uygunluk sütunu, kriter ✓/✗, TR yüzdesi önde; Tarama ve Sonuç gizli', () => {
    const w = ac(html), d = w.document;
    expect(['v-ozet', 'v-tarama', 'v-sonuc'].map((id) => d.getElementById(id).hidden)).toEqual([false, true, true]);
    expect(d.getElementById('n-ozet').getAttribute('aria-current')).toBe('page');
    const tr = [...d.querySelectorAll('#ve-ozet tbody tr')];
    expect(tr.map((r) => metin(r.children[0]))).toEqual(['K0', 'K1', 'K2']);
    expect(tr.map((r) => r.querySelector('.u-en, .u-uy') ? r.querySelector('.u-en, .u-uy').className : '')).toEqual(['', 'sol u-en', 'sol u-uy']);
    const c = [...tr[0].children].map(metin);
    expect(c.slice(1, 5)).toEqual(['57RS313774', '57RS313773', 'Uygun değil', '2,90']);
    expect(c.slice(5, 9)).toEqual(['✓', '✓', '✗', '✓']);
    expect(c[10]).toBe('%10,3');
    expect(metin(d.querySelector('.kunye'))).toBe('Ateşleme frekansı 35,00 Hz · Rölanti 700 dev/dk · 6 silindir · ζ 0,020 · Kütle 1.739,1 kg · 4 kombinasyon · 11.11.2026');
  });

  test('Tarama: sayaç, satırlar; statik sehim başlığı sıralar (iki yön), sayfa düğmeleri kapalı', () => {
    const w = ac(html, '#tarama'), d = w.document;
    expect(d.getElementById('v-tarama').hidden).toBe(false);
    expect(metin(d.querySelector('#ve-tarama .sayac'))).toBe('1–3 / 3 (4 kombinasyon)');
    const no = () => [...d.querySelectorAll('#ve-tarama tbody tr')].map((r) => metin(r.children[0]));
    expect(no()).toEqual(['1', '2', '3']);
    d.querySelector('#ve-tarama th[data-sira="d"]').click();
    expect(no()).toEqual(['1', '2', '3']);
    expect(d.querySelector('#ve-tarama th[data-sira="d"]').getAttribute('aria-sort')).toBe('ascending');
    d.querySelector('#ve-tarama th[data-sira="d"]').click();
    expect(no()).toEqual(['3', '2', '1']);
    d.querySelector('#ve-tarama th[data-sira="sag"]').click();               // sağlanan: çoktan aza
    expect(no()).toEqual(['1', '2', '3']);
    expect([...d.querySelectorAll('#ve-tarama button[data-sayfa]')].map((b) => b.disabled)).toEqual([true, true]);
  });

  test('Tarama\'nın satırına tık: Sonuç o konfigürasyon — sehim gömülü veriden (mm/100), modlar, geri · ileri', () => {
    const w = ac(html, '#tarama'), d = w.document;
    d.querySelectorAll('#ve-tarama tbody tr')[1].children[2].click();        // No 2'nin statik sehimi
    expect(w.location.hash).toBe('#T2');
    expect(d.getElementById('v-sonuc').hidden).toBe(false);
    expect(metin(d.querySelector('#ve-sonuc h2'))).toBe('No 2');
    expect(metin(d.querySelector('#ve-sonuc .tipler'))).toBe('Ön takoz: 57RS313774 · Sağ/Sol arka takoz: Cone 39 50 ShA (AMC 137982)');
    const [sehim, mod] = d.querySelectorAll('#ve-sonuc table');
    const st = [...sehim.querySelectorAll('tbody tr')].map((r) => [...r.children].map(metin));
    expect(st[0]).toEqual(['Static', '−0,12', '0,00', '−15,00', '0,02', '0,00', '−12,00', '0,02', '0,00', '−12,10']);
    expect(st[1].slice(1)).toEqual(Array(9).fill('—'));                      // sonuç yok
    expect([...mod.querySelectorAll('tbody tr')].map((r) => [...r.children].map(metin))[0]).toEqual(['1', 'Bounce + Pitch', '3,58']);
    const a = [...d.querySelectorAll('#ve-sonuc .arac a')].map((x) => [metin(x), x.getAttribute('href')]);
    expect(a).toEqual([['← Tarama', '#tarama'], ['← No 1', '#T1'], ['No 3 →', '#T3']]);
    const oz = [...d.querySelectorAll('#ve-sonuc .izgara div')].map((x) => metin(x));
    expect(oz).toEqual(['Statik sehim [mm]15,00', 'TR [%]%20,0', 'Zıplama fb [Hz]8,20', 'Frekans payı [Hz]' + veSayi(
      require('../../js/mount-param-excel.js').frekansPayi([3.58, 4.45, 6.0, 7.78, 10.11, 12.13], 35), 3),
    'Kriter 1✓', 'Kriter 1a✗', 'Kriter 1b✓', 'Kriter 2✗']);
  });

  test('K\'nın satırına tık: Sonuç K\'nın kendi yük durumları ve modları; geri Özet\'e', () => {
    const w = ac(html), d = w.document;
    d.querySelectorAll('#ve-ozet tbody tr')[0].children[3].click();
    expect(w.location.hash).toBe('#K0');
    expect(metin(d.querySelector('#ve-sonuc h2'))).toBe('K0 · Mevcut');
    const st = [...d.querySelectorAll('#ve-sonuc table')[0].querySelectorAll('tbody tr')].map((r) => [...r.children].map(metin));
    expect(st.map((r) => r[0])).toEqual(['Static', 'Max Bump']);
    expect(st[1].slice(1, 4)).toEqual(['0,20', '0,00', '−15,10']);
    expect([...d.querySelectorAll('#ve-sonuc .arac a')].map((x) => x.getAttribute('href'))).toEqual(['#ozet', '#K1']);
    expect(metin(d.querySelector('#ve-sonuc .izgara div'))).toBe('UygunlukUygun değil');
  });

  test('adres görünümü seçer: #T3 o sonuç; #sonuc son seçilen (varsayılan K1); bozuk adres Özet', () => {
    expect(metin(ac(html, '#T3').document.querySelector('#ve-sonuc h2'))).toBe('No 3');
    const w = ac(html, '#sonuc');
    expect(w.document.getElementById('v-sonuc').hidden).toBe(false);
    expect(metin(w.document.querySelector('#ve-sonuc h2'))).toBe('K1');
    const b = ac(html, '#T99').document;
    expect(b.getElementById('v-ozet').hidden).toBe(false);
  });
});

describe('OKUR', () => {
  test('belge programın çözücüsüne ve penceresine başvurmaz; sayı yazıcısı js/sayi.js\'in kaynağı', () => {
    const html = H.belge(E_(), TARIH);
    const betik = html.slice(html.lastIndexOf('<script>'));
    expect(betik).not.toMatch(/veMntKatalog|_mntParam|mount-core|veMntParamExcel/);
    expect(betik).toContain(veSayi.toString());
    expect(betik).toContain(require('../../js/sayi.js').veSayiUstel.toString());
  });
});
