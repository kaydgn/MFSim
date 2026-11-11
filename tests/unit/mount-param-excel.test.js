/**
 * @jest-environment jsdom
 */
// TAKOZ · PARAMETRİK ANALİZ — EXCEL ÇIKTISI (js/mount-param-excel.js · js/xlsx-yaz.js)
// Kullanıcı kararları: 2026-11-09 "Kullanıcı bu Excel formatında çıktı alacak" (düzen
// Canlı Not'ta 19 notla, 10 Ton TTA, R12); 2026-11-10 sıralamanın ana ölçütü statik
// sehim, Tarama'nın her satırının sonucu görülebilir, K sonuçları açık sayfa değil. Kapılar:
//   DÜZEN     — Özet · Tarama · Sonuç · K0…Kn · gizli Veri · gizli Seçim; sekme çubuğu gizli
//               (kullanıcı 2026-11-10: Sonuç açılışta boş, tıklanan konfigürasyon yalnız o);
//               Özet'in sütunları ve başlık notları; ızgara kapalı; kullanılmayan satır/sütun gizli
//   UYGUNLUK  — tek renkli sütun: en uygun koyu yeşil (beyaz yazı), öteki uygunlar
//               sırayla açılan yeşil, uygun olmayan renksiz; başka hücre boyanmaz
//   SONUÇ     — tek konfigürasyon: Tarama'nın süzgecinde tek satır kalınca o (Seçim!A2), yoksa
//               boş; açılışta boş (önbellek), başlık yönlendirme
//   K SAYFALARI — Özet'in K'sı kendi sayfasına; sayfada yalnız o (Özet · geri · ileri)
//   VERİ      — Tarama'nın her satırı bir satır; yük durumu başına tek hücre
//               (mm'nin yüzde biri, ';' ayraçlı); panonun formülü doğru belirteci okur
//   AD        — "ASR…" eki hiçbir yerde yok
//   SAYI      — frekans payı ve kapasite onaylanan Excel'in değerleri (R12)
//   SIĞAR     — her kenarlıklı hücrenin yazısı sütun genişliğine sığar (Calibri ölçüsü)
const X = require('../../js/xlsx-yaz.js');
const E_ = require('../../js/mount-param-excel.js');
const R = require('../../js/xlsx-read.js');

// 10 Ton TTA'nın (üç takozlu kurulum) konfigürasyonları — onaylanan Excel'in (R12) değerleri
const F_K0 = [5.1126, 5.7046, 6.5321, 8.4885, 10.7892, 15.4683];
const F_K1 = [6.8219, 7.9806, 11.4077, 12.0372, 14.2101, 15.2143];
function vaka(ad, dz) { return { ad, d: [[0.2, 0, dz[0]], [-0.5, 0.0044, dz[1]], [-0.45, 0.0044, dz[2]]] }; }
const BOS = -2147483648;
// Veri: 3 satır × 2 yük durumu × 3 takoz × X/Y/Z (mm/100)
const kod = new Int32Array(3 * 2 * 3 * 3).fill(BOS);
const yaz = (i, q, m, xyz) => xyz.forEach((v, a) => { kod[((i * 2 + q) * 3 + m) * 3 + a] = v; });
yaz(0, 0, 0, [-30, 10, -390]); yaz(0, 0, 1, [1, 0, -543]); yaz(0, 0, 2, [4, 0, -592]);
yaz(0, 1, 0, [-172, 3, -502]); yaz(0, 1, 1, [15, 0, -1504]);                // 3. takozun Max Bump'ı yok
yaz(1, 0, 0, [-12, 0, -1500]); yaz(1, 0, 1, [2, 0, -1200]); yaz(1, 0, 2, [2, 0, -1210]);
yaz(2, 0, 0, [0, 0, -1510]); yaz(2, 0, 1, [0, 0, -900]); yaz(2, 0, 2, [0, 0, -905]);
// uzun belirteçler (öncekilerin toplam boyu 40'ı aşar): sabit pencere 7. belirteçten sonrasını kaydırırdı
yaz(2, 1, 0, [-123456, 234567, -345678]); yaz(2, 1, 1, [-456789, 567891, -678912]); yaz(2, 1, 2, [-789123, 891234, -912345]);
const modF = new Float64Array(18).fill(NaN), modAd = new Uint16Array(18).fill(65535);
[F_K1, [3.58, 4.45, 6.0, 7.78, 10.11, 12.13], [3.7, 4.42, 6.0, 7.01, 8.9, 12.0]].forEach((f, i) => f.forEach((v, j) => {
  modF[i * 6 + j] = v; modAd[i * 6 + j] = j % 2;
}));
const E = {
  baslik: '10 Ton TTA — takoz konfigürasyonları', fAtes: 35, rolanti: 700, silindir: 6, zeta: 0.02, kutle: 1739.1,
  gruplar: ['Ön takoz · 57RS313774', 'Sağ/Sol arka takoz · 57RS313773'],
  takozlar: [{ ad: 'Ön takoz · 57RS313774', grup: 0 }, { ad: 'Sağ arka takoz · 57RS313773', grup: 1 }, { ad: 'Sol arka takoz · 57RS313773', grup: 1 }],
  konfig: [
    { K: 0, mevcut: true, tipler: ['57RS313774 (ASR-SR-116)', '57RS313773 (ASR-SR-116)'], uygunluk: 'Uygun değil',
      kriter: [true, true, false, true], d: 2.9001, f: F_K0, T: 0.10309,
      takozTip: ['57RS313774 (ASR-SR-116)', '57RS313773 (ASR-SR-116)', '57RS313773 (ASR-SR-116)'],
      vakalar: [vaka('Static', [-2.69, -2.66, -2.9]), vaka('Max Bump', [-15.1, -8.9, -9.7])],
      modlar: F_K0.map((f, i) => ({ f, ad: ['pitch+bounce', 'roll', 'bounce', 'lateral+yaw', 'fore-aft', 'roll'][i] })) },
    { K: 1, tipler: ['TK040 45 ShA (57RS329001M)', 'Cone 121 NP 55 ShA (AMC 137829)'], uygunluk: 'En uygun',
      kriter: [true, true, true, true], d: 5.9178, f: F_K1, T: 0.121701,
      takozTip: ['TK040 45 ShA (57RS329001M)', 'Cone 121 NP 55 ShA (AMC 137829)', 'Cone 121 NP 55 ShA (AMC 137829)'],
      vakalar: [vaka('Static', [-3.9, -5.43, -5.92])], modlar: F_K1.map((f) => ({ f, ad: 'roll' })) },
    { K: 2, tipler: ['Mount 1 70 ShA', 'Cone 39 50 ShA (AMC 137982)'], uygunluk: 'Uygun',
      kriter: [true, true, true, true], d: 6.0128, f: [5.69, 7.03, 7.86, 10.53, 11.06, 13.16], T: 0.051,
      takozTip: ['Mount 1 70 ShA', 'Cone 39 50 ShA (AMC 137982)', 'Cone 39 50 ShA (AMC 137982)'],
      vakalar: [vaka('Static', [-3.1, -6.0, -6.01])], modlar: [{ f: 5.69, ad: 'yaw+lateral' }] },
    { K: 3, tipler: ['LMT-1433-00 55 ShA', '57RS313773 (A26)'], uygunluk: 'Uygun',
      kriter: [true, true, true, true], d: 6.368, f: [4.25, 5.03, 6.42, 7.31, 10.66, 16.1], T: 0.0881,
      takozTip: ['LMT-1433-00 55 ShA', '57RS313773 (A26)', '57RS313773 (A26)'], vakalar: [], modlar: [] }
  ],
  tarama: { N: 576, gruplar: [0, 1], adaylar: [['TK040 45 ShA (57RS329001M)', 'Cone 121 NP 55 ShA (AMC 137829)', 'Mount 1 40 ShA']],
    satirlar: [
      { tipler: ['TK040 45 ShA (57RS329001M)', 'Cone 121 NP 55 ShA (AMC 137829)'], f: F_K1, fB: 11.49, T: 0.121701, d: 5.918,
        k: [true, true, true, true], yuk: [496, 648], azami: [null, 1200] },
      { tipler: ['Mount 1 40 ShA', 'Cone 39 50 ShA (AMC 137982)'], f: [3.58, 4.45, 6.0, 7.78, 10.11, 12.13], fB: 7.16, T: 0.045, d: 15.0,
        k: [true, true, true, true], yuk: [470, 661], azami: [null, 600] },
      { tipler: ['57RS313774 (ASR-SR-116)', 'Cone 38 60 ShA (AMC 137963)'], f: [3.7, 4.42, 6.0, 7.01, 8.9, 12.0], fB: 3.62, T: 0.012, d: 15.1,
        k: [true, false, false, true], yuk: [497.3, 647.8], azami: [null, 650] }
    ],
    veri: { vakaAdlari: ['Static', 'Max Bump'], nT: 3, nM: 6, kod, modF, modAd, modAdlar: ['pitch+bounce', 'roll'] } }
};
E.tarama.adaylar.push(E.tarama.adaylar[0]);

const KITAP = E_.kitap(E);
const sayfa = (ad) => KITAP.sayfalar.find((s) => s.ad === ad);
const hucre = (S, r, c) => S.hucre.find((h) => h[0] === r && h[1] === c);
const metinler = (S) => S.hucre.map((h) => (h[2] && typeof h[2] === 'object') ? h[2].f + ' ' + h[2].v : h[2])
  .filter((v) => typeof v === 'string').concat((S.not || []).map((n) => n[2]));
const SON = sayfa('Sonuç');
// Sonuç akışlı sayfa: satırlar sırayla üretilir; hücreler 'r,c' → [değer, stil], bağlantılar geçişin sonunda.
function sonucGecis() {
  const H = new Map(), ht = {};
  for (let r = 1; r <= SON.akis.n; r++) {
    (SON.akis.hucre(r) || []).forEach((x) => H.set(r + ',' + x[0], [x[1], x[2]]));
    ht[r] = SON.akis.ht(r);
  }
  return { H, ht, bag: SON.bag(), d: (r, c) => (H.get(r + ',' + c) || [])[0], st: (r, c) => (H.get(r + ',' + c) || [])[1] };
}
const G = sonucGecis();
// Düzen: 4 konfigürasyon + 3 tarama satırı; blok boyu 2 yük durumu + 6 mod + 16 = 24, adım 26.
// j. bloğun ilk satırı 7 + 26j (boşluk), başlığı bir altında; şerit A sütunu, 24 satır.
const ILK = (j) => 7 + 26 * j, BASL = (j) => ILK(j) + 1, SERIT = (j) => '$A$' + ILK(j) + ':$A$' + (ILK(j) + 23);

describe('DÜZEN', () => {
  test('sayfalar: Özet, Tarama, Sonuç; hiçbiri gizli değil, sekmeler görünür', () => {
    expect(KITAP.sayfalar.map((s) => s.ad)).toEqual(['Özet', 'Tarama', 'Sonuç']);
    expect(KITAP.sayfalar.map((s) => !!s.gizli)).toEqual([false, false, false]);
    expect(KITAP.sekmeGizli).toBeUndefined();
    const wb = X.dosyalar(KITAP).find((f) => f[0] === 'xl/workbook.xml')[1];
    expect(wb).toContain('<workbookView activeTab="0"/>');
    expect(wb).not.toMatch(/showSheetTabs|state="hidden"/);
    expect(wb).toContain('fullCalcOnLoad="1"');                                  // Tarama'nın bağlantı formülleri
  });

  test('Özet: başlık B2 (14 pt), "Tarama →" 4. satırda, tablo 6. satırda; Uygunluk\'un yanında Statik sehim', () => {
    const S = sayfa('Özet');
    expect(hucre(S, 2, 2)[2]).toBe('10 Ton TTA — takoz konfigürasyonları');
    expect(hucre(S, 2, 2)[3].boy).toBe(14);
    expect(hucre(S, 4, 3)[2]).toBe('Tarama →');
    expect(S.bag).toEqual(expect.arrayContaining([[4, 3, 'Tarama', 'A1']]));
    const bas = S.hucre.filter((h) => h[0] === 6).sort((a, b) => a[1] - b[1]).map((h) => h[2]);
    expect(bas).toEqual(['K', 'Sonuç', 'Ön takoz', 'Sağ/Sol arka takoz', 'Uygunluk', 'Statik sehim [mm]',
      'Kriter 1 · Modal bant < 17,50 Hz', 'Kriter 1a · Mod ayrıklığı > 0,5 Hz', 'Kriter 1b · 8–10 Hz bandında mod yok',
      'Kriter 2 · TR < %50', 'Frekans payı [Hz]', 'TR [%]', 'En düşük mod [Hz]']);
    expect(hucre(S, 8, 7)[2]).toBeCloseTo(5.9178, 4);
    expect(hucre(S, 8, 7)[3].bicim).toBe('0.00');
  });

  test('kriterlerin tanımı başlığın notunda; Uygunluk notu statik sehim sırasını söyler', () => {
    const S = sayfa('Özet');
    expect(S.not.map((n) => n[1])).toEqual([6, 7, 8, 9, 10, 11, 12]);   // Uygunluk · Statik sehim · 1 · 1a · 1b · 2 · Frekans payı
    expect(new Set(S.not.map((n) => n[0]))).toEqual(new Set([6]));
    const u = S.not.find((n) => n[1] === 6)[2];
    expect(u).toContain('En uygun: dört kesin kriteri sağlayanlar arasında statik sehimi en küçük olan.');
    expect(u).toContain('Sıra: statik sehim küçükten büyüğe');
    expect(u).not.toMatch(/Kısmen uygun/);
    expect(S.not.find((n) => n[1] === 7)[2]).toContain('max |δz|');
    expect(S.not.find((n) => n[1] === 8)[2]).toContain('f_ateş = 700 d/dk (rölanti) / 60 × 6 silindir / 2 = 35,00 Hz');
    expect(S.not.find((n) => n[1] === 11)[2]).toContain('ζ = 0,020;  m = 1.739,1 kg');
    expect(Math.max(...S.hucre.map((h) => h[0]))).toBe(10);
  });

  test('her sayfada ızgara kapalı, kullanılmayan sütun gizli; satırlar Özet ve Tarama\'da (Sonuç yalnız yazılan satırlarla)', () => {
    expect(KITAP.sayfalar.map((S) => [S.ad, S.izgara, S.gizle])).toEqual([['Özet', false, true], ['Tarama', false, true], ['Sonuç', false, 'sutun']]);
    const F = X.dosyalar(KITAP);
    [1, 2, 3].forEach((i) => {
      const x = F.find((f) => f[0] === 'xl/worksheets/sheet' + i + '.xml')[1];
      expect(x).toContain('showGridLines="0"');
      expect(x).toMatch(/max="16384" width="9.140625" hidden="1"/);
      expect([i, x.includes('zeroHeight="1"')]).toEqual([i, i < 3]);
    });
  });

  test('Tarama: "← Özet"; statik sehim sütunu', () => {
    const S = sayfa('Tarama');
    expect(hucre(S, 2, 6)[2]).toBe('← Özet');
    expect(hucre(S, 3, 6)).toBeUndefined();
    expect(S.bag).toEqual([[2, 6, 'Özet', 'A1']]);
    const bas = S.hucre.filter((h) => h[0] === 5).map((h) => h[2]);
    expect(bas).toContain('Statik sehim [mm]');
    expect(bas).not.toContain('Statik sehim maks [mm]');
  });
});

describe('UYGUNLUK — tek renkli sütun', () => {
  const S = sayfa('Özet');
  test('en uygun koyu yeşil ve beyaz yazı; uygunlar sırayla açılan yeşil; uygun olmayan renksiz', () => {
    expect(hucre(S, 7, 6)[2]).toBe('Uygun değil');
    expect(hucre(S, 7, 6)[3].dolgu).toBeUndefined();
    expect(hucre(S, 8, 6)[3]).toMatchObject({ dolgu: '1F7A3D', renk: 'FFFFFF', b: true });
    expect(hucre(S, 9, 6)[3].dolgu).toBe('6BC782');
    expect(hucre(S, 10, 6)[3].dolgu).toBe('7BCD90');
  });
  test('tabloda Uygunluk sütunundan başka hiçbir hücre boyanmaz (Not 15); tablonun dışında yalnız "Tarama →" düğmesi', () => {
    const boyali = S.hucre.filter((h) => h[0] >= 6 && h[3] && h[3].dolgu).map((h) => h[1]);
    expect(new Set(boyali)).toEqual(new Set([6]));
    expect(S.hucre.filter((h) => h[0] < 6 && h[3] && h[3].dolgu).map((h) => h[2])).toEqual(['Tarama →']);
  });
});

describe('TIKLA — konfigürasyonun yazısı Sonuç\'taki bloğunu açar', () => {
  test('Tarama: No ve grupların tipi mavi bağlantı (formül: süzgeç ve sıralama hücreyle taşır), değer satırınki', () => {
    const S = sayfa('Tarama');
    E.tarama.satirlar.forEach((x, i) => {
      const r = 6 + i, hedef = '#\'Sonuç\'!' + SERIT(4 + i);
      expect(hucre(S, r, 1)[2]).toEqual({ f: 'HYPERLINK("' + hedef + '",' + (i + 1) + ')', v: i + 1 });
      x.tipler.forEach((ad, j) => {
        const t = ad.replace(/\s*\(ASR[^)]*\)/, '');
        expect(hucre(S, r, 2 + j)[2]).toEqual({ f: 'HYPERLINK("' + hedef + '","' + t + '")', v: t });
      });
      [1, 2, 3].forEach((c) => expect(hucre(S, r, c)[3]).toMatchObject({ renk: '0563C1', alt: true }));
      expect(hucre(S, r, 4)[3].renk).toBeUndefined();                           // bağlantı yalnız konfigürasyonun yazısında
    });
  });

  test('Özet: K ve adı Sonuç\'taki K bloğunun şeridine', () => {
    const Oz = sayfa('Özet');
    [0, 1, 2, 3].forEach((n) => {
      expect(Oz.bag).toEqual(expect.arrayContaining([[7 + n, 2, 'Sonuç', SERIT(n)], [7 + n, 3, 'Sonuç', SERIT(n)]]));
      expect(G.d(BASL(n), 3)).toMatch(new RegExp('^K' + n + ' — '));
    });
    expect(hucre(Oz, 8, 3)[2]).toBe('K1 TK040-45 + Cone121NP-55');
  });

  test('her bağlantının şeridi o konfigürasyonun bloğunu kaplar: boşluk satırından TR\'ye', () => {
    for (let j = 0; j < 7; j++) {
      const ilk = ILK(j);
      expect([j, G.ht[ilk], G.ht[ilk + 1], G.d(ilk + 1, 3) != null]).toEqual([j, 30, 24, true]);  // boşluk, başlık
      const tr = [...G.H.keys()].map((k) => k.split(',').map(Number)).filter(([r]) => r >= ilk && r < ilk + 26)
        .reduce((m, [r]) => Math.max(m, r), 0);
      expect(tr).toBeLessThanOrEqual(ilk + 23);
      expect(G.ht[ilk + 24]).toBe(409); expect(G.ht[ilk + 25]).toBe(409);        // iki yüksek boş satır
      expect(G.d(ilk + 24, 3)).toBeUndefined();
    }
  });
});

describe('SONUÇ — bütün konfigürasyonlar, sekmeden açılınca boş', () => {
  test('sayfanın başı: yönlendirme, Özet ve Tarama düğmesi, iki yüksek boş satır; ilk blok 7. satırda', () => {
    expect(G.d(2, 3)).toBe('Özet’te ya da Tarama’da konfigürasyonu seçin.');
    expect([G.ht[2], G.ht[4], G.ht[5], G.ht[6]]).toEqual([24, 22, 409, 409]);
    expect([G.d(4, 3), G.d(4, 4), G.d(4, 5), G.d(4, 6)]).toEqual(['← Özet sayfasına dön', '← Tarama', '', '']);
    expect([...G.H.keys()].filter((k) => +k.split(',')[0] <= 6).length).toBe(5);
    expect(G.bag.slice(0, 2)).toEqual([[4, 3, 'Özet', 'A1'], [4, 4, 'Tarama', 'A1', 6]]);
    expect(SON.akis.n).toBe(6 + 7 * 26);
  });

  test('bloklar: önce K0…K3, sonra No 1…3; başlık grupların tipi', () => {
    expect([0, 1, 2, 3, 4, 5, 6].map((j) => G.d(BASL(j), 3).split(' — ')[0])).toEqual(['K0', 'K1', 'K2', 'K3', 'No 1', 'No 2', 'No 3']);
    expect(G.d(BASL(1), 3)).toBe('K1 — Ön takoz: TK040 45 ShA (57RS329001M) · Sağ/Sol arka takoz: Cone 121 NP 55 ShA (AMC 137829)');
    expect(G.d(BASL(6), 3)).toBe('No 3 — Ön takoz: 57RS313774 · Sağ/Sol arka takoz: Cone 38 60 ShA (AMC 137963)');
  });

  test('düğmeler: dönüş (K → Özet, No → Tarama\'daki satırı), geri ve ileri komşu bloğun şeridine; uçlarda yok', () => {
    const b1 = BASL(1), b5 = BASL(5);
    expect([G.d(b1 + 2, 3), G.d(b1 + 2, 4), G.d(b1 + 2, 12)]).toEqual(['← Özet sayfasına dön', '← Geri konfigürasyon (K0)', 'İleri konfigürasyon (K2) →']);
    expect(G.bag).toEqual(expect.arrayContaining([[b1 + 2, 3, 'Özet', 'A1'], [b1 + 2, 4, 'Sonuç', SERIT(0), 6], [b1 + 2, 12, 'Sonuç', SERIT(2), 14]]));
    expect([G.d(b5 + 2, 3), G.d(b5 + 2, 4), G.d(b5 + 2, 12)]).toEqual(['← Tarama sayfasına dön', '← Geri konfigürasyon (No 1)', 'İleri konfigürasyon (No 3) →']);
    expect(G.bag).toEqual(expect.arrayContaining([[b5 + 2, 3, 'Tarama', '$A$7'], [b5 + 2, 4, 'Sonuç', SERIT(4), 6], [b5 + 2, 12, 'Sonuç', SERIT(6), 14]]));
    expect([G.d(BASL(0) + 2, 4), G.d(BASL(3) + 2, 12), G.d(BASL(4) + 2, 4), G.d(BASL(6) + 2, 12)]).toEqual([undefined, undefined, undefined, undefined]);
    expect(G.bag).toHaveLength(2 + 7 + 2 * 3 + 2 * 2);                          // baş · dönüş · iç bloklarda iki, uçlarda bir
  });

  test('K bloğu çözümün değerleri (tam duyarlık), tarama satırının bloğu veri.kod\'dan (mm/100); modlar sıralı, TR', () => {
    const b1 = BASL(1);
    expect([G.d(b1 + 4, 8), G.d(b1 + 4, 9), G.d(b1 + 4, 10)]).toEqual([undefined, 'Cone 121 NP 55 ShA (AMC 137829)', undefined]);
    expect(G.d(b1 + 5, 8)).toBe('Sağ arka takoz');
    expect([8, 9, 10].map((c) => G.d(b1 + 6, c))).toEqual(['X', 'Y', 'Z']);
    expect([G.d(b1 + 7, 3), G.d(b1 + 7, 10)]).toEqual(['Static', -5.43]);
    expect(G.d(b1 + 12, 2)).toBe('Mod');
    expect(G.d(b1 + 12 + 6 + 3, 3)).toBeCloseTo(12.1701, 4);
    const t1 = BASL(4), t3 = BASL(6);
    expect([4, 5, 6, 8, 9, 10, 12, 13, 14].map((c) => G.d(t1 + 7, c))).toEqual([-0.3, 0.1, -3.9, 0.01, 0, -5.43, 0.04, 0, -5.92]);
    expect([12, 13, 14].map((c) => G.d(t1 + 8, c))).toEqual(['', '', '']);         // 3. takozun Max Bump'ı yok
    expect([4, 5, 6].map((c) => G.d(t3 + 8, c))).toEqual([-1234.56, 2345.67, -3456.78]);
    const mh = t1 + 7 + 2 + 4;
    expect(G.d(mh + 1, 3)).toBe('Pitch + Bounce'); expect(G.d(mh + 2, 3)).toBe('Roll');
    F_K1.forEach((f, j) => expect(G.d(mh + 1 + j, 4)).toBe(f));
    expect(G.d(mh + 6 + 3, 3)).toBeCloseTo(12.1701, 4);
    expect(G.d(t3 + 4, 5)).toBe('57RS313774');                                   // taranan grubun tipi, "ASR" eki yok
    expect([...G.H.values()].some((x) => x[0] && typeof x[0] === 'object')).toBe(false);   // formülsüz
  });

  test('kutular birleştirmesiz: üç hücre ortalanmış, kenarlık dıştan; sayfada birleştirme yok, bağlantı düğmeyi kaplar', () => {
    const b1 = BASL(1);
    expect([8, 9, 10].map((c) => [G.st(b1 + 5, c).yatay, G.st(b1 + 5, c).kenar])).toEqual([['centerContinuous', 'ltb'], ['centerContinuous', 'tb'], ['centerContinuous', 'trb']]);
    expect([4, 5, 6].map((c) => G.st(b1 + 2, c).kenar)).toEqual(['ltb', 'tb', 'trb']);
    expect(G.st(b1 + 2, 4).dolgu).toBe('EDEDED');
    expect(G.st(b1 + 4, 5).yatay).toBe('center');                               // tip: ortadaki hücre, yazı komşulara taşar
    const x = X.dosyalar(KITAP).find((f) => f[0] === 'xl/worksheets/sheet3.xml')[1];
    expect(x).not.toContain('<mergeCells');
    expect(x).toContain('<hyperlink ref="D' + (b1 + 2) + ':F' + (b1 + 2) + '" location="\'Sonuç\'!' + SERIT(0) + '"/>');
    expect(x).toContain('<row r="' + (ILK(0) + 24) + '" ht="409" customHeight="1"/>');
    const st = X.dosyalar(KITAP).find((f) => f[0] === 'xl/styles.xml')[1];
    expect(st).toContain('horizontal="centerContinuous"');
    expect(st).toContain('<border><left style="thin"><color rgb="FF000000"/></left><right/><top style="thin"><color rgb="FF000000"/></top><bottom style="thin"><color rgb="FF000000"/></bottom><diagonal/></border>');
  });
});

describe('ADIM ADIM — kitabın kurulumu dilimli', () => {
  const sur = (I) => { let n = 0; const oran = []; while (I.adim()) { n++; oran.push(I.oran()); } return { n, oran }; };
  test('kitapIs adımları kitap(E) ile aynı dosyaları verir', () => {
    const I = E_.kitapIs(E);
    expect(() => I.kitap()).toThrow('Kitap kurulmadı');
    const { n, oran } = sur(I);
    expect(n).toBe(4);                                                            // Özet+Sonuç · baş · 3 satır · son
    expect(oran[oran.length - 1]).toBe(1);
    expect(X.dosyalar(I.kitap())).toEqual(X.dosyalar(KITAP));
  });
  test('büyük tarama çok adımda; sütun ölçüsü satırlar boyunca birikir (tek seferlikle aynı)', () => {
    const satirlar = [];
    for (let i = 0; i < 1000; i++) satirlar.push(Object.assign({}, E.tarama.satirlar[i % 3], { d: 5 + i / 7, T: 0.001 * (i % 211) }));
    satirlar[777] = Object.assign({}, satirlar[777], { fB: 1234567.891 });          // en geniş sayı sonlarda
    const E2 = Object.assign({}, E, { tarama: Object.assign({}, E.tarama, { N: 1000, satirlar, veri: undefined }) });
    const I = E_.kitapIs(E2), { n, oran } = sur(I);
    expect(n).toBe(1 + 1 + 10 + 1);
    for (let i = 1; i < oran.length; i++) expect(oran[i]).toBeGreaterThanOrEqual(oran[i - 1]);
    const K = I.kitap(), K1 = E_.kitap(E2);
    expect(X.dosyalar(K)).toEqual(X.dosyalar(K1));
    const ta = K.sayfalar.find((x) => x.ad === 'Tarama'), c = 1 + 2 + 6 + 1;     // No · 2 grup · 6 mod · f_b
    expect(ta.sutun[c]).toBe(E_.olc(Object.assign({}, ta, { sutun: {}, satir: {} })).sutun[c]);
    expect(ta.sutun[c]).toBeGreaterThan(9);                                      // 1.234.567,891'in genişliği
  });
});

describe('AD', () => {
  test('"ASR" hiçbir hücrede, notta, formülde, sayfa adında ve dosyanın içinde yok', () => {
    KITAP.sayfalar.filter((S) => !S.akis).forEach((S) => {
      expect(S.ad).not.toMatch(/ASR/i);
      metinler(S).forEach((m) => expect(m).not.toMatch(/ASR/));
    });
    G.H.forEach(([v]) => expect(String(v)).not.toMatch(/ASR/));
    const F = X.dosyalar(KITAP);
    F.forEach(([ad, m]) => expect([ad, /ASR/.test(m)]).toEqual([ad, false]));
    expect(hucre(sayfa('Özet'), 7, 4)[2]).toBe('57RS313774');
  });

  test('kısa tip adı ve konfigürasyonun adı (bütün grupların tipi)', () => {
    expect(E_.kisa('Cone 39 50 ShA (AMC 137982)')).toBe('Cone39-50');
    expect(E_.kisa('57RS313773 (A26)')).toBe('57RS313773 A26');
    expect(E_.kisa('57RS313773 (ASR-SR-116)')).toBe('57RS313773');
    expect(E_.kisa('LMT-1433-00 55 ShA')).toBe('LMT-55');
    expect(E_.kisa('Cone 121 NG 65 ShA (AMC 137833)')).toBe('Cone121NG-65');
    expect(E_.sayfaAdi({ K: 7 }, ['57RS313773 (A26)', 'Cone 39 60 ShA (AMC 137983)', '57RS313774 (A26)']))
      .toBe('K7 57RS313773 A26 + Cone39-60 + 57RS313774 A26');
    expect(E_.sayfaAdi({ K: 0, mevcut: true }, [])).toBe('K0 Mevcut');
  });

  // AYIRT EDİCİ (2026-11-11, Tulga): "LMT-1433-37 55 ShA" ile "LMT-1433-00 55 ShA" ikisi de
  // "LMT-55" oluyordu — K6 ile K7 aynı adla görünüyordu. Ailede birden çok kod varsa ailenin
  // bütün tipleri kodlu; tek kodlu aile onaylanan kısa adında kalır.
  test('AYIRT EDİCİ kısa ad: aynı kısa adı alan iki tip ayrı; ailede tek kod varsa kısa ad değişmez', () => {
    const U = ['LMT-1433-37 55 ShA', 'LMT-1433-00 55 ShA', 'LMT-1433-00 40 ShA', '57RS313773 (A26)', '57RS313773 (ASR-SR-116)',
      'Cone 39 50 ShA (AMC 137982)', 'Mount 1 55 ShA', 'TK035 35 ShA (57RS328045)'];
    const f = E_.ayirici(U);
    expect(U.map(f)).toEqual(['LMT-1433-37-55', 'LMT-1433-00-55', 'LMT-1433-00-40', '57RS313773 A26', '57RS313773',
      'Cone39-50', 'Mount1-55', 'TK035-35']);
    expect(new Set(U.map(f)).size).toBe(U.length);
    const g = E_.ayirici(['LMT-1433-00 55 ShA', 'LMT-1433-00 40 ShA', 'Cone 39 50 ShA (AMC 137982)']);
    expect(['LMT-1433-00 55 ShA', 'LMT-1433-00 40 ShA'].map(g)).toEqual(['LMT-55', 'LMT-40']);
    expect(g('Kümede olmayan 70 ShA')).toBe(E_.kisa('Kümede olmayan 70 ShA'));
    expect(E_.sayfaAdi({ K: 6 }, ['LMT-1433-37 55 ShA', '57RS313774 (A26)', 'LMT-1433-00 55 ShA'], f))
      .toBe('K6 LMT-1433-37-55 + 57RS313774 A26 + LMT-1433-00-55');
    // iki kodu da kısa adında çakışan tip adın kendisine çıkar
    const h = E_.ayirici(['X 50 ShA (AMC 137001)', 'X 50 ShA (AMC 137002)']);
    expect(['X 50 ShA (AMC 137001)', 'X 50 ShA (AMC 137002)'].map(h)).toEqual(['X 50 ShA (AMC 137001)', 'X 50 ShA (AMC 137002)']);
  });

  test('mod adı onaylanan biçimde', () => {
    expect(E_.modAdi('pitch+bounce')).toBe('Pitch + Bounce');
    expect(E_.modAdi('fore-aft')).toBe('Fore-aft');
  });
});

describe('SAYI — onaylanan Excel\'in (R12) değerleri', () => {
  test('frekans payı: K0 −0,488 (Özet)', () => {
    expect(E_.frekansPayi(F_K0, 35)).toBeCloseTo(-0.4885, 4);
    expect(hucre(sayfa('Özet'), 7, 12)[2]).toBeCloseTo(-0.4885, 4);
    expect(hucre(sayfa('Özet'), 8, 13)[2]).toBeCloseTo(12.1701, 4);    // TR [%]
    expect(hucre(sayfa('Özet'), 8, 14)[2]).toBeCloseTo(6.8219, 4);     // en düşük mod
  });
  test('kapasite: grup başına yük ↔ azami yük', () => {
    expect(E_.kapasite([470, 661], [null, 600])).toBe('Aşıyor');
    expect(E_.kapasite([496, 648], [null, 1200])).toBe('Bilinen yeter');
    expect(E_.kapasite([497, 647], [900, 650])).toBe('Yeter');
    expect(E_.kapasite([497, 647], [null, null])).toBe('Katalogda yok');
  });
  test('Tarama: dört kriter ✓/✗, satır sırası ve filtre', () => {
    const S = sayfa('Tarama');
    expect(hucre(S, 1, 1)[2]).toBe('Tarama — ilk 3 / 576 kombinasyon (Ön takoz × Sağ/Sol arka takoz)');
    const bas = S.hucre.filter((h) => h[0] === 5).sort((a, b) => a[1] - b[1]).map((h) => h[2]);
    expect(bas.slice(0, 3)).toEqual(['No', 'Ön takoz', 'Sağ/Sol arka takoz']);
    const i1 = bas.indexOf('Kriter 1') + 1;
    expect([0, 1, 2, 3].map((j) => hucre(S, 8, i1 + j)[2])).toEqual(['✓', '✗', '✗', '✓']);
    expect(hucre(S, 8, i1 + 4)[2]).toBe('—');
    expect(hucre(S, 6, i1 + 4)[2]).toBe('Uygun');
    expect(S.filtre).toBe('A5:' + X.harf(bas.length) + '8');
  });
});

describe('SIĞAR — kenarlıklı her hücrenin yazısı sütununa sığar', () => {
  test('Sonuç: kenarlıklı yazı sütununa, ortalanmış kutunun yazısı üç sütununa sığar', () => {
    const gen = (c) => (SON.sutun[c] || 8.43) * 7 + 5 - 6;
    G.H.forEach(([v, st], k) => {
      const [r, c] = k.split(',').map(Number);
      if (!st || !st.kenar || v === '' || v == null) return;
      const yazi = typeof v === 'number' ? String(v.toFixed(3)).replace('.', ',') : v;   // makine: en uzun gösterim
      const w = st.yatay === 'centerContinuous' ? gen(c) + gen(c + 1) + gen(c + 2) + 12 : gen(c);
      expect([r, c, E_.px(yazi, st.b) <= w + 6]).toEqual([r, c, true]);
    });
  });

  test('tek satırlık yazı sütun genişliğinin içinde (formülde önbellek ya da ölçü ipucu)', () => {
    KITAP.sayfalar.filter((S) => !S.akis).forEach((S) => {
      const kapali = {};
      (S.birlesik || []).forEach((b) => {
        const m = /^([A-Z]+)(\d+):([A-Z]+)(\d+)$/.exec(b);
        const c = (h) => [...h].reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0);
        for (let x = c(m[1]); x <= c(m[3]); x++) kapali[m[2] + ',' + x] = true;
      });
      S.hucre.forEach((h) => {
        const st = h[3] || {};
        let v = h[2];
        if (v && typeof v === 'object') v = v.olc != null ? v.olc : v.v;
        if (!st.kenar || st.sar || kapali[h[0] + ',' + h[1]] || v === '' || v == null) return;
        const gen = (S.sutun[h[1]] || 8.43) * 7 + 5 - 6;
        const yazi = typeof v === 'number' ? String(v.toFixed(3)).replace('.', ',') : v;   // makine: en uzun gösterim
        expect([S.ad, h[0], h[1], E_.px(yazi, st.b) <= gen + 6]).toEqual([S.ad, h[0], h[1], true]);
      });
    });
  });
});

describe('DOSYA — programın okuyucusuyla gidiş-dönüş', () => {
  test('okunan Özet, Tarama\'nın bağlantı formülü ve Sonuç\'un blokları kurucunun değerlerini taşır', () => {
    const b = X.yaz(KITAP), wb = R.veXlsOpen(b);
    expect(wb.sheets.map((s) => s.name)).toEqual(['Özet', 'Tarama', 'Sonuç']);
    const oz = wb.readSheet(0).rows;
    expect(oz[7].slice(1, 6)).toEqual(['K1', 'K1 TK040-45 + Cone121NP-55', 'TK040 45 ShA (57RS329001M)', 'Cone 121 NP 55 ShA (AMC 137829)', 'En uygun']);
    const ta = wb.readSheet(1).rows;
    expect(ta[5].slice(0, 3)).toEqual([1, 'TK040 45 ShA (57RS329001M)', 'Cone 121 NP 55 ShA (AMC 137829)']);
    const z = R.veXlsZipRead(b), s2 = R.veXlsUtf8(z.read('xl/worksheets/sheet2.xml'));
    expect(s2).toContain('<f>HYPERLINK(&quot;#\'Sonuç\'!' + SERIT(4) + '&quot;,1)</f><v>1</v>');
    const son = wb.readSheet(2).rows;
    expect(son[1][2]).toBe('Özet’te ya da Tarama’da konfigürasyonu seçin.');
    expect([son[BASL(1) - 1][2], son[BASL(1) + 6][2], son[BASL(1) + 6][9]]).toEqual([
      'K1 — Ön takoz: TK040 45 ShA (57RS329001M) · Sağ/Sol arka takoz: Cone 121 NP 55 ShA (AMC 137829)', 'Static', -5.43]);
    expect(son[BASL(4) + 6].slice(3, 6)).toEqual([-0.3, 0.1, -3.9]);
    expect(R.veXlsUtf8(z.read('xl/workbook.xml'))).not.toContain('showSheetTabs');
  });
});
