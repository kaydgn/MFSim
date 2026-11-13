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
//   SAYFA    — açılış Özet; künyenin başı aracın kimliği, yalnız bilinen (Canlı not 2008);
//              Tarama sayaç · sıralama · sayfa; satıra tık Sonuç'u o
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
    baslik: 'Takoz konfigürasyonları', arac: '10 Ton TTA', motor: 'Cummins ISM11', sanziman: 'Allison 4500 SP',
    fAtes: 35, trSinir: 0.15, rolanti: 700, silindir: 6, zeta: 0.02, kutle: 1739.1,
    gruplar: ['Ön takoz', 'Sağ/Sol arka takoz'],
    takozlar: [{ ad: 'Ön takoz', grup: 0 }, { ad: 'Sağ arka takoz', grup: 1 }, { ad: 'Sol arka takoz', grup: 1 }],
    konfig: [
      { K: 0, mevcut: true, tipler: ['ASFAT takozu B', 'ASFAT takozu A'], uygunluk: 'Uygun değil',
        kriter: [true, true, false, true], d: 2.9001, f: [5.11, 5.70, 6.53, 8.49, 10.79, 15.47], T: 0.10309,
        takozTip: ['ASFAT takozu B', 'ASFAT takozu A', 'ASFAT takozu A'],
        vakalar: [vaka('Static', [-2.69, -2.66, -2.9]), vaka('Max Bump', [-15.1, -8.9, -9.7])],
        modlar: [{ f: 5.70, ad: 'roll' }, { f: 5.11, ad: 'pitch+bounce' }] },
      { K: 1, tipler: ['TK040 45 ShA', 'Cone 121 NP 55 ShA (AMC 137829)'], uygunluk: 'En uygun',
        kriter: [true, true, true, true], d: 5.9178, f: [6.82, 7.98, 11.41, 12.04, 14.21, 15.21], T: 0.121701,
        takozTip: ['TK040 45 ShA', 'Cone 121 NP 55 ShA (AMC 137829)', 'Cone 121 NP 55 ShA (AMC 137829)'],
        vakalar: [vaka('Static', [-3.9, -5.43, -5.92])], modlar: [{ f: 6.82, ad: 'roll' }] },
      { K: 2, tipler: ['LMT-1433-20 70 ShA', 'Cone 39 50 ShA (AMC 137982)'], uygunluk: 'Uygun',
        kriter: [true, true, true, true], d: 6.0128, f: [5.69, 7.03, 7.86, 10.53, 11.06, 13.16], T: 0.051,
        takozTip: ['LMT-1433-20 70 ShA', 'Cone 39 50 ShA (AMC 137982)', 'Cone 39 50 ShA (AMC 137982)'],
        vakalar: [vaka('Static', [-3.1, -6.0, -6.01])], modlar: [{ f: 5.69, ad: 'yaw+lateral' }] }
    ],
    tarama: {
      N: 4, gruplar: [1], adaylar: [['Cone 121 NP 55 ShA (AMC 137829)', 'Cone 39 50 ShA (AMC 137982)', 'LMT-1433-20 40 ShA']],
      satirlar: [
        { tipler: ['Cone 121 NP 55 ShA (AMC 137829)'], f: [6.82, 7.98, 11.41, 12.04, 14.21, 15.21], fB: 9.1, T: 0.1217, d: 5.9178, k: [true, true, true, true], yuk: [210], azami: [null] },
        { tipler: ['Cone 39 50 ShA (AMC 137982)'], f: [3.58, 4.45, 6.0, 7.78, 10.11, 12.13], fB: 8.2, T: 0.2, d: 15.0, k: [true, false, true, false], yuk: [205], azami: [null] },
        { tipler: ['LMT-1433-20 40 ShA'], f: [3.7, 4.42, 6.0, 7.01, 8.9, 12.0], fB: 7.4, T: 0.31, d: 15.1, k: [true, false, false, false], yuk: [199], azami: [null] }
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
    expect(html).toMatch(/<title>10 Ton TTA — Takoz konfigürasyonları<\/title>/);
    expect(D.konfig.map((k) => [k.K, k.u, k.tip])).toEqual([
      [0, 'Uygun değil', ['ASFAT takozu B', 'ASFAT takozu A']],
      [1, 'En uygun', ['TK040 45 ShA', 'Cone 121 NP 55 ShA (AMC 137829)']],
      [2, 'Uygun', ['LMT-1433-20 70 ShA', 'Cone 39 50 ShA (AMC 137982)']]]);
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
    expect(c.slice(1, 5)).toEqual(['ASFAT takozu B', 'ASFAT takozu A', 'Uygun değil', '2,90']);
    expect(c.slice(5, 9)).toEqual(['✓', '✓', '✗', '✓']);
    expect(c[9]).toBe('%10,3');
    // Canlı not 2004 ("Daha güzel bir şekilde … yayalım bu bilgileri"): künye ad · değer hücreleri
    expect([...d.querySelectorAll('.kunye > div')].map((x) => [metin(x.querySelector('dt')), metin(x.querySelector('dd'))])).toEqual([
      ['Araç', '10 Ton TTA'], ['Motor', 'Cummins ISM11'], ['Şanzıman', 'Allison 4500 SP'],
      ['Ateşleme frekansı [Hz]', '35,00'], ['Rölanti [dev/dk]', '700'], ['Silindir', '6'], ['Sönüm oranı ζ', '0,020'],
      ['Kütle [kg]', '1.739,1'], ['Kombinasyon', '4'], ['Tarih', '11.11.2026']]);
  });

  // Canlı not 2008: "Buraya aracın ismini falan da yazalım. Yani bilgi versin kullanıcıya." — künyenin
  // başı aracın kimliği (Araç · Motor · Şanzıman), yalnız bilinen; başlık aynı, belgenin adında araç
  test('künyenin başı aracın kimliği: Araç · Motor · Şanzıman; bilinmeyen hücre yok; belgenin adında araç', () => {
    const hucre = (h) => [...ac(h).document.querySelectorAll('.kunye > div')].map((x) => metin(x.querySelector('dt')) + ' · ' + metin(x.querySelector('dd')));
    expect(hucre(html).slice(0, 4)).toEqual(['Araç · 10 Ton TTA', 'Motor · Cummins ISM11', 'Şanzıman · Allison 4500 SP', 'Ateşleme frekansı [Hz] · 35,00']);
    expect(metin(ac(html).document.querySelector('h1'))).toBe('Takoz konfigürasyonları');
    expect(veriOku(html)).toMatchObject({ arac: '10 Ton TTA', motor: 'Cummins ISM11', sanziman: 'Allison 4500 SP' });
    const E = E_(); delete E.motor; delete E.sanziman;
    expect(hucre(H.belge(E, TARIH)).slice(0, 2)).toEqual(['Araç · 10 Ton TTA', 'Ateşleme frekansı [Hz] · 35,00']);
    E.arac = 'TULGA <4x4>';                                                  // ad yazı olarak, kaçışlı
    const h1 = H.belge(E, TARIH);
    expect(hucre(h1)[0]).toBe('Araç · TULGA <4x4>');
    expect(h1).toContain('<title>TULGA &lt;4x4&gt; — Takoz konfigürasyonları</title>');
    delete E.arac;                                                           // kimlik bilinmiyor: künye eskisi gibi
    const h0 = H.belge(E, TARIH);
    expect(hucre(h0)[0]).toBe('Ateşleme frekansı [Hz] · 35,00');
    expect(hucre(h0).some((x) => /^(Araç|Motor|Şanzıman) · /.test(x))).toBe(false);
    expect(h0).toContain('<title>Takoz konfigürasyonları</title>');
    expect(veriOku(h0)).toMatchObject({ arac: null, motor: null, sanziman: null });
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
    d.querySelector('#ve-tarama button[data-suz="kr"]').click();             // kriterler: panelden çoktan aza
    d.querySelector('#ve-suz [data-suz-is="azalan"]').click();
    expect(no()).toEqual(['1', '2', '3']);
    d.querySelector('#ve-tarama th[data-sira="no"]').click();                // No süzgeçsiz, başlığı sıralar
    d.querySelector('#ve-tarama th[data-sira="no"]').click();
    expect(no()).toEqual(['3', '2', '1']);
    expect([...d.querySelectorAll('#ve-tarama button[data-sayfa]')].map((b) => b.disabled)).toEqual([true, true]);
  });

  test('Tarama\'nın satırına tık: Sonuç o konfigürasyon — sehim gömülü veriden (mm/100), modlar, geri · ileri', () => {
    const w = ac(html, '#tarama'), d = w.document;
    d.querySelectorAll('#ve-tarama tbody tr')[1].children[2].click();        // No 2'nin statik sehimi
    expect(w.location.hash).toBe('#T2');
    expect(d.getElementById('v-sonuc').hidden).toBe(false);
    expect(metin(d.querySelector('#ve-sonuc h2'))).toBe('No 2');
    expect(metin(d.querySelector('#ve-sonuc .tipler'))).toBe('Ön takoz: ASFAT takozu B · Sağ/Sol arka takoz: Cone 39 50 ShA (AMC 137982)');
    const [sehim, mod] = d.querySelectorAll('#ve-sonuc table');
    // Canlı not 2002 ("Sonuç kısmını aynı Excel gibi … Sütun aralarını çizgili … Yük durumu sütununu da
    // ayıralım"): iki tablo ızgara, Yük durumu sütunu ayrık (başlığı ve her satırın ilk hücresi)
    expect([sehim.className, mod.className]).toEqual(['izg', 'izg']);
    expect([...sehim.querySelectorAll('tr')].every((r) => r.querySelector('.yuk') === r.querySelector('th, td') || !r.querySelector('.yuk'))).toBe(true);
    expect([...sehim.querySelectorAll('tbody tr')].map((r) => r.children[0].classList.contains('yuk'))).toEqual([true, true]);
    expect(sehim.querySelector('thead th').classList.contains('yuk')).toBe(true);
    const st = [...sehim.querySelectorAll('tbody tr')].map((r) => [...r.children].map(metin));
    // takozların blokları arasında boş sütun (Canlı not 2009, aşağıda)
    expect(st[0]).toEqual(['Static', '−0,12', '0,00', '−15,00', '', '0,02', '0,00', '−12,00', '', '0,02', '0,00', '−12,10']);
    expect(st[1].slice(1)).toEqual(['—', '—', '—', '', '—', '—', '—', '', '—', '—', '—']);   // sonuç yok
    expect([...mod.querySelectorAll('tbody tr')].map((r) => [...r.children].map(metin))[0]).toEqual(['1', 'Bounce + Pitch', '3,58']);
    const a = [...d.querySelectorAll('#ve-sonuc .arac a')].map((x) => [metin(x), x.getAttribute('href')]);
    expect(a).toEqual([['← Tarama', '#tarama'], ['← No 1', '#T1'], ['No 3 →', '#T3']]);
    const oz = [...d.querySelectorAll('#ve-sonuc .izgara div')].map((x) => metin(x));
    // Canlı not 2003 ("Frekans payı kısmını kaldıralım"): Özet'te, Tarama'da ve Sonuç'ta yok
    expect(oz).toEqual(['Statik sehim [mm]15,00', 'TR [%]%20,0', 'Zıplama fb [Hz]8,20',
      'Kriter 1✓', 'Kriter 1a✗', 'Kriter 1b✓', 'Kriter 2✗']);
    expect(d.body.textContent).not.toMatch(/Frekans payı/);
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

  // Canlı not 2009: "Her takoz çiftini ayır. Yan yana olunca okuması zorlanıyor. Arada bir sütun kadar
  // boşluk olsun. Okunması kolay olsun." — Sehim tablosunda her takozun X · Y · Z bloğu bir sonrakinden
  // boş bir sütunla ayrık: iki başlık satırında ve her yük durumunda aynı sütunda; Yük durumu ile ilk
  // takoz arasında boşluk yok (ilk takozun Z'si satırın 4. hücresi). Boşluk yazısız, çizgisiz, sayfanın
  // zemininde (satırın üstündeki fare de boyamaz), genişliği bir sayı sütunu kadar; kap çerçevesiz,
  // bloklar kendi ızgarasıyla. Modlar tablosu aynı.
  test('Sehim: takozların blokları arasında bir sütunluk boşluk — iki başlık satırında ve her satırda; çizgisiz, sayfanın zemininde; Modlar aynı', () => {
    const w = ac(html, '#T2'), d = w.document, cs = (e) => w.getComputedStyle(e);
    const [sehim, mod] = d.querySelectorAll('#ve-sonuc table');
    // satırın dizilişi: Y = Yük durumu, x = takozun bir sütunu (grup başlığı üç), | = boşluk
    const dizilis = (r) => [...r.children].map((c) => (c.classList.contains('bosluk') ? '|' : c.classList.contains('yuk') ? 'Y' : 'x'.repeat(c.colSpan))).join('');
    const SATIRLAR = ['Yxxx|xxx|xxx', 'xxx|xxx|xxx', 'Yxxx|xxx|xxx', 'Yxxx|xxx|xxx'];   // ikinci başlık satırı Yük durumunun altında
    expect([...sehim.rows].map(dizilis)).toEqual(SATIRLAR);
    expect([...ac(html, '#K0').document.querySelector('#ve-sonuc table').rows].map(dizilis)).toEqual(SATIRLAR);
    const bos = [...sehim.querySelectorAll('td.bosluk')];
    expect(bos.length).toBe(2 * 4);                                           // iki aralık × dört satır
    expect(bos.every((c) => c.textContent === '' && c.colSpan === 1 && c.rowSpan === 1)).toBe(true);
    expect(metin(sehim.tBodies[0].rows[0].children[3])).toBe('−15,00');
    const b = bos[0], kok = cs(d.documentElement);
    const px = (v) => { const m = /^var\((--[\w-]+)\)$/.exec(v); return parseFloat(m ? kok.getPropertyValue(m[1]) : v); };   // jeton ya da değer
    expect(['Top', 'Right', 'Bottom', 'Left'].map((k) => cs(b)['border' + k + 'Width'])).toEqual(['0px', '0px', '0px', '0px']);
    // zeminsiz: boşluktan sayfaya dek her kap saydam (aralıkta sayfanın zemini görünür); sayının hücresi zeminli
    const saydam = (e) => /^(rgba\(0, 0, 0, 0\)|transparent|none)(\s|$)/.test(cs(e).background);
    for (let e = b; e !== d.body; e = e.parentElement) expect([e.tagName, e.className, saydam(e)]).toEqual([e.tagName, e.className, true]);
    expect(saydam(d.body)).toBe(false);
    expect(saydam(sehim.tBodies[0].rows[0].children[1])).toBe(false);
    const kural = [...d.styleSheets].flatMap((s) => [...s.cssRules]).find((r) => /td\.bosluk/.test(r.selectorText || ''));
    expect(kural.selectorText).toMatch(/tr:hover td\.bosluk/);
    const sutun = px(cs(sehim.tBodies[0].rows[0].children[1]).minWidth), bosluk = px(cs(b).minWidth);
    expect(bosluk / sutun).toBeGreaterThanOrEqual(0.8);
    expect(bosluk).toBeLessThanOrEqual(sutun);
    expect(['Top', 'Right', 'Bottom', 'Left'].map((k) => cs(sehim.parentElement)['border' + k + 'Width'])).toEqual(['0px', '0px', '0px', '0px']);
    expect(mod.querySelectorAll('.bosluk').length).toBe(0);
    expect(mod.parentElement.className).toBe('kap dar');
  });

  // Canlı not 2010: "Şuradaki kalın çizginin amacı ne? Diğerleri gibi olsun, kalın olmasın." — Yük
  // durumu sütununun sağındaki kalın, koyu çizgi (Canlı not 2002) yok: sütunun iki kenarı öteki
  // hücrelerin çizgisiyle (ızgaranın kalınlığı ve rengi), hücrenin İÇİNDE (iç gölge; birleşik kenarlık
  // bastırılır) — birleşik kenarlık yapışık hücreyle gitmez, gerçek tarayıcıda tablo yana kayınca sütunun
  // iki kenarı da kayboluyordu. Sütun yapışık, kalın yazılı, gri zeminde kalır. Belgenin hiçbir tablo
  // kuralında ızgaradan kalın ya da koyu çizgi yok (Modlar · Özet · Tarama dâhil).
  test('Sehim: Yük durumu sütununun çizgisi öteki hücrelerinki gibi — kalın çizgi yok; sütun yapışık, kalın yazılı, gri zeminde', () => {
    const w = ac(html, '#T2'), d = w.document, cs = (e) => w.getComputedStyle(e);
    const kurallar = [...d.styleSheets].flatMap((s) => [...s.cssRules]).filter((r) => r.selectorText);
    // öteki hücrelerin çizgisi: kalınlık · tür · renk
    const izgara = kurallar.find((r) => r.selectorText.replace(/\s*,\s*/g, ',') === 'table.izg th,table.izg td').style.getPropertyValue('border');
    expect(izgara).toBe('1px solid var(--cizgi)');
    const [kal, , renk] = izgara.split(' ');
    const yuk = [...d.querySelector('#ve-sonuc table').querySelectorAll('.yuk')];
    expect(yuk.map((c) => c.tagName)).toEqual(['TH', 'TD', 'TD']);              // başlık + iki yük durumu
    // hücreye uyan kuralların bildirdiği değer (jsdom'un hesabı değişkenli kısa yazımın yanında
    // kenarın türünü vermiyor)
    const bildirim = (c, ad) => kurallar.filter((r) => c.matches(r.selectorText)).map((r) => r.style.getPropertyValue(ad)).filter(Boolean);
    yuk.forEach((c) => {
      const s = cs(c);
      expect([bildirim(c, 'border-left-style'), bildirim(c, 'border-right-style')]).toEqual([['hidden'], ['hidden']]);
      expect(s.boxShadow.split(/,\s*/)).toEqual(['inset ' + kal + ' 0 0 ' + renk, 'inset -' + kal + ' 0 0 ' + renk]);
      expect([s.position, s.left, s.fontWeight, s.background]).toEqual(['sticky', '0px', '600', 'var(--zemin)']);
    });
    // belgenin tablo kuralları: hiçbir çizgi ızgaradan kalın ya da koyu değil
    const tablo = /(^|[\s,>+~])(table|thead|tbody|tr|th|td)\b|\.(yuk|izg)\b/;
    const cizgi = [], kalin = [];
    kurallar.filter((r) => tablo.test(r.selectorText)).forEach((r) => {
      for (let i = 0; i < r.style.length; i++) {
        const ad = r.style[i], v = r.style.getPropertyValue(ad);
        if (!/^(border|box-shadow|outline)/.test(ad)) continue;
        cizgi.push(ad);
        if ((v.match(/\d*\.?\d+px/g) || []).some((x) => parseFloat(x) > parseFloat(kal)) || /cizgi-koyu/.test(v)) kalin.push(r.selectorText + ' → ' + ad + ': ' + v);
      }
    });
    expect(kalin).toEqual([]);
    expect(cizgi).toEqual(expect.arrayContaining(['border', 'border-bottom', 'box-shadow']));   // tarama boş değil
  });

  // Belge Canlı Not'ta çerçevede (srcdoc) açılır: "#tarama" üst sayfanın adresine çözülür ve
  // varsayılan gezinme çerçeveyi sayfanın kendisine götürüyordu ("MFSim açılıyor", 2026-11-11).
  test('bağlantı varsayılan yoldan GİTMEZ: tık yakalanır, görünüm belgenin içinde değişir', () => {
    const w = ac(html), d = w.document;
    const tik = (el) => { const e = new w.MouseEvent('click', { bubbles: true, cancelable: true }); el.dispatchEvent(e); return e.defaultPrevented; };
    expect(tik(d.getElementById('n-tarama'))).toBe(true);
    expect(d.getElementById('v-tarama').hidden).toBe(false);
    expect(tik(d.querySelector('#ve-tarama tbody tr a'))).toBe(true);
    expect(metin(d.querySelector('#ve-sonuc h2'))).toBe('No 1');
    expect(tik(d.querySelector('#ve-sonuc .arac a[href="#tarama"]'))).toBe(true);
    expect(d.getElementById('v-tarama').hidden).toBe(false);
    expect(w.location.hash).toBe('#tarama');
  });

  // SÜZGEÇ (Canlı not 2001: "Tarama kısmında Excel'deki gibi 'Filtrele' özelliği koyalım"): her
  // başlıkta düğme; liste sütununda değerler (satır sayısıyla, öteki süzgeçlerden geçenler), sayı
  // sütununda en az · en çok; sayaç, geri · ileri ve sıralama süzülmüş listeyi izler.
  describe('SÜZGEÇ', () => {
    const no = (d) => [...d.querySelectorAll('#ve-tarama tbody tr[data-s]')].map((r) => metin(r.children[0]));
    const ac_ = (d, k) => d.querySelector('#ve-tarama button[data-suz="' + k + '"]').click();
    const isaret = (w, kutu, on) => { kutu.checked = on; kutu.dispatchEvent(new w.Event('change', { bubbles: true })); };

    test('tip sütunu: değerler satır sayısıyla; birini kaldırıp Tamam — satırlar, sayaç, özet, düğme; Filtreleri temizle', () => {
      const w = ac(html, '#tarama'), d = w.document, p = d.getElementById('ve-suz');
      // Canlı not 2005: "'No' kısmında filtre olmasın." — No'nun başlığında düğme yok, öteki her başlıkta var
      expect(d.querySelector('#ve-tarama th[data-sira="no"] button')).toBeNull();
      expect(d.querySelectorAll('#ve-tarama thead button[data-suz]').length).toBe(d.querySelectorAll('#ve-tarama thead th').length - 1);
      ac_(d, 'g0');
      expect(p.hidden).toBe(false);
      expect([...p.querySelectorAll('label[data-deger]')].map((l) => [l.getAttribute('data-deger'), metin(l.querySelector('.say'))])).toEqual([
        ['Cone 39 50 ShA (AMC 137982)', '1'], ['Cone 121 NP 55 ShA (AMC 137829)', '1'], ['LMT-1433-20 40 ShA', '1']]);
      expect(p.querySelector('[data-suz-hep]').checked).toBe(true);
      isaret(w, p.querySelector('input[data-suz-deger="LMT-1433-20 40 ShA"]'), false);
      expect(p.querySelector('[data-suz-hep]').indeterminate).toBe(true);
      p.querySelector('[data-suz-is="tamam"]').click();
      expect(p.hidden).toBe(true);
      expect(no(d)).toEqual(['1', '2']);
      expect(metin(d.querySelector('#ve-tarama .sayac'))).toBe('1–2 / 2 (4 kombinasyon)');
      expect(metin(d.querySelector('#ve-tarama .suz-ozet'))).toBe('2 / 3');
      expect(d.querySelector('#ve-tarama button[data-suz="g0"]').getAttribute('aria-pressed')).toBe('true');
      d.querySelector('#ve-tarama [data-suz-hepsi]').click();
      expect(no(d)).toEqual(['1', '2', '3']);
      expect(d.querySelector('#ve-tarama .suz-ozet')).toBeNull();
    });

    test('sayı sütunu: en az (virgüllü) · en çok; panel değeri hatırlar; Filtreyi temizle', () => {
      const w = ac(html, '#tarama'), d = w.document, p = d.getElementById('ve-suz');
      ac_(d, 'd');
      p.querySelector('[data-suz-min]').value = '15,05';
      p.querySelector('[data-suz-is="tamam"]').click();
      expect(no(d)).toEqual(['3']);
      ac_(d, 'd');
      expect(p.querySelector('[data-suz-min]').value).toBe('15,05');
      p.querySelector('[data-suz-max]').value = '15,08';                  // aralıkta satır yok
      p.querySelector('[data-suz-is="tamam"]').click();
      expect(no(d)).toEqual([]);
      expect(metin(d.querySelector('#ve-tarama td.bos'))).toBe('Süzgece uyan satır yok.');
      ac_(d, 'd');
      p.querySelector('[data-suz-is="temizle"]').click();
      expect(no(d)).toEqual(['1', '2', '3']);
    });

    // Kriterler tek sütun (Canlı not 2007): panelde sağlanan sayısı ve kriter kriter ✓ · ✗ — sayılar
    // öteki sütunların süzgecinden geçen satırlardan, panelin kendi seçiminden bağımsız.
    test('kriterler: sağlanan sayısı ve kriter kriter ✓ · ✗ (satır sayısıyla); süzülmüş listede geri · ileri; panelden Z’den A’ya; boş seçimde Tamam kapalı; Filtreyi temizle hepsini; Esc kapatır', () => {
      const w = ac(html, '#tarama'), d = w.document, p = d.getElementById('ve-suz');
      const kutu = (j, m) => p.querySelector('input[data-suz-kr="' + j + '"][value="' + m + '"]');
      const tamam = () => p.querySelector('[data-suz-is="tamam"]');
      ac_(d, 'kr');
      expect([...p.querySelectorAll('label[data-deger]')].map((l) => [l.getAttribute('data-deger'), metin(l.querySelector('.say'))]))
        .toEqual([['4 / 4', '1'], ['2 / 4', '1'], ['1 / 4', '1']]);
      expect([...p.querySelectorAll('.suz-kr .ad')].map((x) => [metin(x), x.getAttribute('title')])).toEqual([
        ['Kriter 1', 'Modal bant < 17,50 Hz'], ['Kriter 1a', 'Mod ayrıklığı > 0,5 Hz'],
        ['Kriter 1b', '8–10 Hz bandında mod yok'], ['Kriter 2', 'TR < %15']]);
      expect([...p.querySelectorAll('.suz-kr label')].map(metin)).toEqual(['✓3', '✗0', '✓1', '✗2', '✓2', '✗1', '✓1', '✗2']);
      isaret(w, kutu(1, '✓'), false);
      isaret(w, kutu(1, '✗'), false);
      expect(tamam().disabled).toBe(true);                                // kriterin iki kutusu da boş
      isaret(w, kutu(1, '✗'), true);
      expect(tamam().disabled).toBe(false);
      tamam().click();                                                    // Kriter 1a ✗: No 2 · 3
      expect(no(d)).toEqual(['2', '3']);
      expect(d.querySelector('#ve-tarama button[data-suz="kr"]').getAttribute('aria-pressed')).toBe('true');
      d.querySelectorAll('#ve-tarama tbody tr')[0].children[2].click();
      expect([...d.querySelectorAll('#ve-sonuc .arac a')].map((x) => x.getAttribute('href'))).toEqual(['#tarama', '#T3']);
      w.location.hash = '#tarama'; w.veRapor.goster();
      ac_(d, 'g0');
      p.querySelector('[data-suz-is="azalan"]').click();
      expect(no(d)).toEqual(['3', '2']);                                  // LMT-1433-20 › Cone 39 (Z'den A'ya)
      ac_(d, 'g0');
      d.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      expect(p.hidden).toBe(true);
      ac_(d, 'kr');                                                       // panel seçimi hatırlar; sayı listesi tam
      expect([kutu(1, '✓').checked, kutu(1, '✗').checked]).toEqual([false, true]);
      expect([...p.querySelectorAll('label[data-deger]')].map((l) => l.getAttribute('data-deger'))).toEqual(['4 / 4', '2 / 4', '1 / 4']);
      isaret(w, p.querySelector('input[data-suz-deger="1 / 4"]'), false);
      tamam().click();
      expect(no(d)).toEqual(['2']);
      ac_(d, 'kr');
      isaret(w, p.querySelector('[data-suz-hep]'), false);
      expect(tamam().disabled).toBe(true);                                // hiçbir sayı seçili değil
      p.querySelector('[data-suz-is="temizle"]').click();                 // sayı da kriter de
      expect(no(d)).toEqual(['3', '1', '2']);
      expect(d.querySelector('#ve-tarama button[data-suz="kr"]').hasAttribute('aria-pressed')).toBe(false);
      expect(d.querySelector('#ve-tarama .suz-ozet')).toBeNull();
    });

    // Canlı not 2006: "Takozların üstüne tıklayınca sıralıyor, onu da istemiyorum. Filtreleyince çıkan
    // sonuç sıralanır zaten." — takozun başlığı sıralamaz (tık sırayı ve oku değiştirmez, el imleci
    // yok); takoz Filtrele'nin panelinden sıralanır, ok başlıkta; sayı sütununun başlığı sıralar.
    test('takozun başlığı sıralamaz: tık sırayı ve oku değiştirmez, el imleci yok; panelden sıralanınca ok başlıkta', () => {
      const w = ac(html, '#tarama'), d = w.document, p = d.getElementById('ve-suz');
      const takoz = () => d.querySelector('#ve-tarama button[data-suz="g0"]').closest('th');
      const sehim = () => d.querySelector('#ve-tarama th[data-sira="d"]');
      expect(takoz().hasAttribute('data-sira')).toBe(false);
      expect(w.getComputedStyle(takoz()).cursor).not.toBe('pointer');
      expect(w.getComputedStyle(sehim()).cursor).toBe('pointer');
      sehim().click(); sehim().click();                                    // statik sehim: büyükten küçüğe
      expect(no(d)).toEqual(['3', '2', '1']);
      takoz().querySelector('.bas').click();
      takoz().click();
      expect(no(d)).toEqual(['3', '2', '1']);
      expect(takoz().hasAttribute('aria-sort')).toBe(false);
      expect(sehim().getAttribute('aria-sort')).toBe('descending');
      ac_(d, 'g0');
      p.querySelector('[data-suz-is="artan"]').click();                  // A'dan Z'ye: Cone 39 · Cone 121 · LMT-1433-20
      expect(no(d)).toEqual(['2', '1', '3']);
      expect(takoz().getAttribute('aria-sort')).toBe('ascending');
      takoz().click();                                                    // başlık yönü çevirmez
      expect(no(d)).toEqual(['2', '1', '3']);
      expect(takoz().getAttribute('aria-sort')).toBe('ascending');
      expect(takoz().querySelector('button[data-suz]')).not.toBeNull();   // Filtrele yerinde
    });

    // Canlı not 2007: "Şunları tek sütuna alalım. Kullanıcı merak ederse faresini üstüne getirsin ve
    // kriterlerin ne olduğunu görsün." — Tarama'da Kriter 1 · 1a · 1b · 2 ve Sağlanan TEK sütun
    // (Kriterler): hücre dört ✓ · ✗ (sırayla) ve sağlanan sayısı; başlığın ipucu dört kriterin adı ve
    // tanımı, hücreninki satırın kriter kriter sonucu. Başlık sıralamaz (Canlı not 2006), panel
    // sıralar ve ok başlıkta. Özet ve Sonuç kriterleri ayrı tutar.
    test('kriterler tek sütun: dört ✓ · ✗ ve sağlanan sayısı; tanımlar başlığın ve hücrenin ipucunda; başlık sıralamaz, panel sıralar', () => {
      const w = ac(html, '#tarama'), d = w.document, p = d.getElementById('ve-suz');
      const bas = [...d.querySelectorAll('#ve-tarama thead th')];
      expect(bas.map((x) => metin(x.querySelector('.bas')))).toEqual(['No', 'Sağ/Sol arka takoz', 'Statik sehim [mm]', 'TR [%]', 'Zıplama fb [Hz]', 'Kriterler']);
      const kr = bas[5];
      expect(kr.getAttribute('title')).toBe('Kriter 1: Modal bant < 17,50 Hz\nKriter 1a: Mod ayrıklığı > 0,5 Hz\n'
        + 'Kriter 1b: 8–10 Hz bandında mod yok\nKriter 2: TR < %15');
      const hucre = [...d.querySelectorAll('#ve-tarama tbody tr')].map((r) => r.lastElementChild);
      expect(hucre.map((x) => x.parentNode.children.length)).toEqual([6, 6, 6]);
      expect(hucre.map(metin)).toEqual(['✓✓✓✓4 / 4', '✓✗✓✗2 / 4', '✓✗✗✗1 / 4']);
      expect([...hucre[1].querySelectorAll('.kr-i span')].map((x) => x.className)).toEqual(['ok', 'no', 'ok', 'no']);
      expect(hucre[1].getAttribute('title')).toBe('✓ Kriter 1: Modal bant < 17,50 Hz\n✗ Kriter 1a: Mod ayrıklığı > 0,5 Hz\n'
        + '✓ Kriter 1b: 8–10 Hz bandında mod yok\n✗ Kriter 2: TR < %15');
      expect(kr.hasAttribute('data-sira')).toBe(false);
      expect(w.getComputedStyle(kr).cursor).not.toBe('pointer');
      d.querySelector('#ve-tarama th[data-sira="d"]').click();
      d.querySelector('#ve-tarama th[data-sira="d"]').click();             // statik sehim: büyükten küçüğe
      expect(no(d)).toEqual(['3', '2', '1']);
      kr.querySelector('.bas').click();
      expect(no(d)).toEqual(['3', '2', '1']);
      ac_(d, 'kr');
      expect([...p.querySelectorAll('.suz-is button')].map(metin)).toEqual(['Azdan çoğa sırala', 'Çoktan aza sırala', 'Filtreyi temizle']);
      p.querySelector('[data-suz-is="azalan"]').click();
      expect(no(d)).toEqual(['1', '2', '3']);
      expect(d.querySelector('#ve-tarama button[data-suz="kr"]').closest('th').getAttribute('aria-sort')).toBe('descending');
      ac_(d, 'kr');
      p.querySelector('[data-suz-is="artan"]').click();
      expect(no(d)).toEqual(['3', '2', '1']);
      // Özet ve Sonuç: kriterler ayrı
      expect([...d.querySelectorAll('#ve-ozet thead th')].map(metin).filter((x) => /^Kriter/.test(x))).toEqual(['Kriter 1', 'Kriter 1a', 'Kriter 1b', 'Kriter 2']);
      expect(d.body.textContent).not.toMatch(/Sağlanan|Sağlanıyor/);
    });
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
