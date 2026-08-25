/**
 * structural-materials.test.js — MALZEME KÜTÜPHANESİ (js/structural-materials.js)
 *
 * Bu kütüphanenin sayıları ÖLÇÜLEMEZ: standartların ve el kitaplarının nominal
 * değerleri. O yüzden buradaki kapı "değer doğru mu" diye soramaz — sorduğu
 * şey başka ve sorulabilir olanı: DEĞERLER KENDİ ARALARINDA TUTARLI MI, ve bir
 * YAZIM HATASI (ondalık kayması, ν yerine başka bir sayı, σ_ak ile σ_ç'nin yer
 * değiştirmesi) sessizce içeri sızabilir mi.
 *
 * Beş katman:
 *   1) YAPI       — kimlik tekilliği, kategori varlığı, zorunlu alanlar.
 *   2) FİZİK      — ν aralığı, σ_ak ≤ σ_ç, pozitiflik.
 *   3) SINIF      — E ve ρ, kategorinin fiziksel penceresinde mi; ve TÜRETİLEN
 *                   kayma modülü G = E/2(1+ν) sınıfın yayımlanmış aralığında
 *                   mı. Sonuncusu bir ν yazım hatasını yakalayan asıl kapıdır:
 *                   E doğru, ρ doğru, ama ν 0,30 yerine 0,03 yazılmışsa G
 *                   pencereden çıkar.
 *   4) UÇTAN UCA  — HER kayıt `veStrMatValidate`'ten HATASIZ geçmeli. Yani
 *                   kütüphaneden seçilen hiçbir malzeme "çözülemez" bir kayıt
 *                   üretemez. Gevrek ve elastomer kayıtlar ise kendi
 *                   UYARILARINI üretmek ZORUNDA.
 *   5) ARAMA      — Türkçe katlama ve gösterim eşleşmesi; sahada aynı malzeme
 *                   üç ayrı adla anılıyor ve üçüyle de bulunabilmeli.
 */
const L = require('../../js/structural-materials.js');
const str = require('../../js/cp-structural.js');

const CATS = L.VE_STR_MAT_CATS;
const LIB = L.VE_STR_MAT_LIB;
const catOf = (m) => CATS.find((c) => c.key === m.c);
const G = (m) => m.E / (2 * (1 + m.nu));
// test.each tablo satırı: [okunur ad, kayıt]
const HER = LIB.map((m) => [m.n + ' (' + m.id + ')', m]);

describe('kütüphane — yapı', () => {
  test('kapsam: en az 100 malzeme, 16 kategorinin hepsi dolu', () => {
    expect(LIB.length).toBeGreaterThanOrEqual(100);
    const say = L.veStrMatLibCounts();
    CATS.forEach((c) => expect(say[c.key] || 0).toBeGreaterThan(0));
  });

  test('kimlikler TEKİL — çakışan kimlik eski projenin izini başka malzemeye bağlardı', () => {
    const gorulen = new Set();
    LIB.forEach((m) => {
      expect(gorulen.has(m.id)).toBe(false);
      gorulen.add(m.id);
    });
    expect(gorulen.size).toBe(LIB.length);
  });

  test('kategori anahtarları tekil ve her malzemenin kategorisi TANIMLI', () => {
    expect(new Set(CATS.map((c) => c.key)).size).toBe(CATS.length);
    LIB.forEach((m) => expect(catOf(m)).toBeTruthy());
  });

  test.each(HER)('%s — ad, standart ve kategori adı dolu', (_ad, m) => {
    expect(typeof m.n).toBe('string');
    expect(m.n.trim().length).toBeGreaterThan(0);
    // Standart, DEĞERİN NEREDEN GELDİĞİDİR: boş bırakılan bir kayıt
    // "bu sayı nereden çıktı" sorusuna cevap veremez.
    expect(typeof m.std).toBe('string');
    expect(m.std.trim().length).toBeGreaterThan(0);
  });

  // Aynı gösterim iki farklı malzemede geçerse arama hangisini getireceğini
  // bilemez ve kullanıcı yanlış malzemeyi uygular — sessiz, ölçülemez bir hata.
  // ÖLÇÜLDÜ: bu kapı gerçek bir çakışma buldu — 'AL995' (alümina seramik) ile
  // 'Al99,5' (saf alüminyum) ayıraçlar atılınca aynı anahtara iniyordu. İki
  // malzeme farklı SINIFTAN ve ρ 3890 ↔ 2710; birbirinin yerine geçmesi sessiz
  // ve ciddi bir hata olurdu. AİLE terimleri (`fam`: 'sfero', 'pik döküm')
  // kapının dışında — onlar zaten bir aileyi birden getirsin diye var.
  test('GÖSTERİMLER çakışmıyor — bir ad yalnız bir malzemeye ait', () => {
    const sahip = {};
    const cakisan = [];
    LIB.forEach((m) => {
      new Set(L.veStrMatUniqueDesigs(m).map(L.veStrMatKey)).forEach((k) => {
        if (!k) return;
        if (sahip[k] && sahip[k] !== m.id) cakisan.push(k + ': ' + sahip[k] + ' ↔ ' + m.id);
        sahip[k] = m.id;
      });
    });
    expect(cakisan).toEqual([]);
  });
});

describe('kütüphane — fizik', () => {
  test.each(HER)('%s — E, ν, ρ var ve pozitif', (_ad, m) => {
    expect(Number.isFinite(m.E)).toBe(true);
    expect(m.E).toBeGreaterThan(0);
    expect(Number.isFinite(m.nu)).toBe(true);
    expect(Number.isFinite(m.rho)).toBe(true);
    expect(m.rho).toBeGreaterThan(0);
  });

  // ν ≥ 0,5 rijitlik matrisini tekilleştirir (bkz. cp-structural.js). Kütüphane
  // BU SINIRIN İÇİNDE kalmak zorunda: dışarı taşan bir kayıt, kullanıcıya
  // "seç" diye sunulup sonra "çözülemez" diye reddedilirdi.
  test.each(HER)('%s — 0 ≤ ν < 0,5 (tekillik sınırının içinde)', (_ad, m) => {
    expect(m.nu).toBeGreaterThanOrEqual(0);
    expect(m.nu).toBeLessThan(0.5);
  });

  test.each(HER)('%s — σ_ak ≤ σ_ç (ikisi de varsa)', (_ad, m) => {
    if (m.sy == null || m.su == null) return;
    expect(m.sy).toBeGreaterThan(0);
    expect(m.su).toBeGreaterThan(0);
    expect(m.sy).toBeLessThanOrEqual(m.su);
  });

  // σ_ak GEVREK malzemede null olmalı, 0 DEĞİL: 0 "emniyet payı sıfır" demek
  // olurdu. Bu proje `Number(null) === 0` sınıfını belgeliyor.
  test.each(HER)('%s — σ_ak ya pozitif ya null, asla 0', (_ad, m) => {
    if (m.sy === null || m.sy === undefined) return;
    expect(m.sy).toBeGreaterThan(0);
  });

  test.each(HER)('%s — α (ısıl genleşme) makul aralıkta', (_ad, m) => {
    if (m.a == null) return;
    // Seramikten polimere: 3 (borosilikat) … 250 (silikon) ×10⁻⁶/K
    expect(m.a).toBeGreaterThan(1);
    expect(m.a).toBeLessThan(400);
  });
});

describe('kütüphane — sınıf pencereleri', () => {
  test.each(HER)('%s — E sınıfının penceresinde', (_ad, m) => {
    const c = catOf(m);
    expect(m.E).toBeGreaterThanOrEqual(c.eWin[0]);
    expect(m.E).toBeLessThanOrEqual(c.eWin[1]);
  });

  test.each(HER)('%s — ρ sınıfının penceresinde', (_ad, m) => {
    const c = catOf(m);
    expect(m.rho).toBeGreaterThanOrEqual(c.rhoWin[0]);
    expect(m.rho).toBeLessThanOrEqual(c.rhoWin[1]);
  });

  // ASIL KAPI: G üç sayıdan İKİSİNİ birden sınıyor. E doğru yazılıp ν yanlış
  // yazılsa (0,30 → 0,03 ya da 0,3 → 3) G pencereden çıkar ve bu test kırmızıya
  // döner. Tek başına ν aralığı (0 ≤ ν < 0,5) bunu yakalamaz: 0,03 da o
  // aralığın içindedir.
  test.each(HER)('%s — türetilen G sınıfının yayımlanmış aralığında', (_ad, m) => {
    const c = catOf(m);
    const g = G(m);
    expect(g).toBeGreaterThanOrEqual(c.gWin[0]);
    expect(g).toBeLessThanOrEqual(c.gWin[1]);
  });
});

describe('kütüphane — çözücüyle uçtan uca', () => {
  // EN GÜÇLÜ KAPI: kütüphaneden seçilen HİÇBİR malzeme "çözülemez" bir kayıt
  // üretemez. Üretebilseydi kullanıcı katalogdan seçer, panel kırmızı hata
  // basar ve suçu kendinde arardı.
  test.each(HER)('%s — kaydı veStrMatValidate\'ten HATASIZ geçiyor', (_ad, m) => {
    const rec = L.veStrMatLibRecord(m.id);
    expect(rec).toBeTruthy();
    const v = str.veStrMatValidate(rec);
    expect(v.errors).toEqual([]);
    expect(v.ok).toBe(true);
  });

  test.each(HER)('%s — türetilen G ve K sayı üretiyor (null değil)', (_ad, m) => {
    const d = str.veStrMatDerived(L.veStrMatLibRecord(m.id));
    expect(d.G).not.toBeNull();
    expect(d.K).not.toBeNull();
    expect(d.G).toBeCloseTo(G(m), 6);
    expect(d.rhoMM).toBeCloseTo(m.rho * 1e-12, 20);
  });

  test('GEVREK malzemede σ_ak kayda HİÇ yazılmıyor → panel kısıtı söylüyor', () => {
    // `sy: null` yazmak ile alanı hiç koymamak farklı: ikincisinde doğrulayıcı
    // "akma dayanımı yok, emniyet payı hükmü verilemez" uyarısını üretiyor.
    const gevrek = LIB.filter((m) => m.sy === null);
    expect(gevrek.length).toBeGreaterThan(0);
    gevrek.forEach((m) => {
      const rec = L.veStrMatLibRecord(m.id);
      expect('sy' in rec).toBe(false);
      expect(str.veStrMatValidate(rec).warns.join(' ')).toMatch(/Akma dayanımı/);
    });
  });

  test('ELASTOMERLER kilitlenme uyarısını ÜRETİYOR — sessiz geçemezler', () => {
    const el = L.veStrMatLibByCat('elastomer');
    expect(el.length).toBeGreaterThan(0);
    el.forEach((m) => {
      expect(m.nu).toBeGreaterThan(0.49);      // ν → 0,5
      const v = str.veStrMatValidate(L.veStrMatLibRecord(m.id));
      expect(v.ok).toBe(true);                 // durdurmuyor…
      expect(v.warns.join(' ')).toMatch(/kilitlen/); // …ama susmuyor da
      // Ve kaydın kendisi bu çözücüye uygun OLMADIĞINI yazıyor.
      expect(m.uyari).toMatch(/UYGUN DEĞİL/);
    });
  });

  test('gevrek sınıflar kendi kısıtlarını kayıtta TAŞIYOR', () => {
    // Gri dökme demir, seramik ve gevrek polimerlerde von Mises hükmü
    // yanıltır (asimetrik ya da Weibull dağılımlı dayanım) — kayıt bunu
    // söylemek zorunda, yoksa kullanıcı emniyet payını olduğu gibi okur.
    LIB.filter((m) => m.c === 'seramik' || m.id.indexOf('gjl-') === 0)
      .forEach((m) => expect(m.uyari).toMatch(/gevrek/i));
  });
});

describe('kütüphane — çapa değerler', () => {
  // Sınıf pencereleri geniş; bu blok bilinen birkaç kaydı NOKTA olarak
  // tutuyor. Biri kayarsa kütüphane sessizce başka bir malzeme anlatmaya
  // başlamış demektir.
  const capalar = [
    ['s355jr',      { E: 210000, nu: 0.30, rho: 7850, sy: 355 }],
    ['s235jr',      { sy: 235 }],
    ['42crmo4',     { sy: 900, su: 1100 }],
    ['1.4301',      { E: 200000, rho: 7900, a: 16.0 }],
    ['1.4016',      { E: 220000, a: 10.0 }],   // ferritik: α östenitiğin yarısı
    ['aw6082-t6',   { E: 70000, nu: 0.33, rho: 2700, sy: 260 }],
    ['aw7075-t6',   { sy: 503, su: 572 }],
    ['ti-6al-4v',   { E: 113800, rho: 4430, sy: 880 }],
    ['gjs-400-15',  { E: 169000, nu: 0.275, sy: 250, su: 400 }],
    ['gjl-250',     { E: 110000, sy: null, su: 250 }],
    ['az91d',       { E: 45000, rho: 1810 }],
    ['inconel718',  { sy: 1034, su: 1276 }],
    ['ac43000-t6',  { rho: 2650, sy: 220 }],
  ];
  test.each(capalar)('%s çapası kaymamış', (id, bekle) => {
    const m = L.veStrMatLibById(id);
    expect(m).toBeTruthy();
    Object.keys(bekle).forEach((k) => expect(m[k]).toBe(bekle[k]));
  });

  test('çelik E ≈ 210 GPa, alüminyum ≈ 70 GPa, titanyum ≈ 114 GPa', () => {
    const ort = (key) => {
      const g = L.veStrMatLibByCat(key);
      return g.reduce((s, m) => s + m.E, 0) / g.length;
    };
    expect(ort('celik-yapi')).toBeCloseTo(210000, -2);
    expect(ort('alu-dovme')).toBeGreaterThan(68000);
    expect(ort('alu-dovme')).toBeLessThan(73000);
    expect(ort('titanyum')).toBeGreaterThan(108000);
  });

  test('ÖZGÜL DAYANIM sıralaması fiziği yansıtıyor: Ti > Al > çelik', () => {
    // Kütüphanenin en çok işe yarayan karşılaştırması bu. Sayılar birbirinden
    // bağımsız kaynaklardan geldiği için, sıralamanın tutması onların
    // birbiriyle tutarlı olduğunun bağımsız bir işareti.
    const oz = (id) => { const m = L.veStrMatLibById(id); return m.sy / m.rho; };
    expect(oz('ti-6al-4v')).toBeGreaterThan(oz('aw7075-t6'));
    expect(oz('aw7075-t6')).toBeGreaterThan(oz('s355jr'));
    expect(oz('s690ql')).toBeGreaterThan(oz('s235jr'));
  });
});

describe('kütüphane — arama', () => {
  test('TÜRKÇE katlama: toLowerCase tek başına yetmez', () => {
    // 'I'.toLowerCase() JS'te 'i' verir (Türkçe\'de 'ı' olmalıydı) ve 'İ' de
    // birleşik noktalı bir 'i' üretir. Katlama ikisini de ASCII 'i'ye indirir.
    expect(L.veStrMatFold('ISLAH')).toBe('islah');
    expect(L.veStrMatFold('İNCONEL')).toBe('inconel');
    expect(L.veStrMatFold('Çelik')).toBe('celik');
    expect(L.veStrMatFold('PİRİNÇ')).toBe('pirinc');
    expect(L.veStrMatFold('Şğüö')).toBe('sguo');
    // Katlama olmasaydı bu eşitlik TUTMAZDI:
    expect(L.veStrMatFold('PIRINC')).toBe(L.veStrMatFold('pirinç'));
  });

  test('AYIRAÇ önemsiz: 1.4301 = 1,4301 = 14301', () => {
    const a = L.veStrMatLibSearch('1.4301');
    const b = L.veStrMatLibSearch('1,4301');
    const c = L.veStrMatLibSearch('14301');
    expect(a[0].id).toBe('1.4301');
    expect(b[0].id).toBe('1.4301');
    expect(c[0].id).toBe('1.4301');
  });

  test('AYNI malzeme ÜÇ ayrı adla bulunuyor — kütüphanenin varlık sebebi', () => {
    ['1.4301', 'X5CrNi18-10', 'AISI 304', '18/10'].forEach((q) => {
      expect(L.veStrMatLibSearch(q)[0].id).toBe('1.4301');
    });
    ['1.7225', '42CrMo4', 'AISI 4140', '708M40'].forEach((q) => {
      expect(L.veStrMatLibSearch(q)[0].id).toBe('42crmo4');
    });
  });

  // ÖLÇÜLDÜ: parça eşleşmesi eklenmeden önce "304" araması AISI 304L'yi
  // (X2CrNi18-9) AISI 304'ten ÖNCE getiriyordu — ikisi de aynı puanı alıyor,
  // eşitliği alfabetik sıra bozuyordu.
  test('"304" AISI 304L\'yi değil AISI 304\'ü ÖNE getiriyor', () => {
    const r = L.veStrMatLibSearch('304');
    expect(r[0].id).toBe('1.4301');
    expect(r.map((m) => m.id)).toContain('1.4307');   // 304L de listede
  });

  test('AİLE terimi bütün aileyi getiriyor (tekillik beklenmez)', () => {
    // 'sfero' beş GJS kalitesini birden getirmeli — `alt` yerine `fam`'da
    // olmasının sebebi bu. Tekillik kapısına takılsaydı ya terimi atmak ya da
    // kapıyı gevşetmek gerekirdi; ikisi de kayıptı.
    expect(L.veStrMatLibSearch('sfero').length).toBe(5);
    expect(L.veStrMatLibSearch('pik döküm').length).toBe(4);
  });

  test('atölyede kullanılan Türkçe adlar da buluyor', () => {
    expect(L.veStrMatLibSearch('sfero').every((m) => m.id.indexOf('gjs-') === 0)).toBe(true);
    expect(L.veStrMatLibSearch('pik').every((m) => m.id.indexOf('gjl-') === 0)).toBe(true);
    expect(L.veStrMatLibSearch('pirinç').length).toBeGreaterThan(0);
    expect(L.veStrMatLibSearch('naylon').length).toBeGreaterThan(0);
  });

  test('standart numarası bütün ailesini getiriyor', () => {
    const r = L.veStrMatLibSearch('10025');
    expect(r.length).toBeGreaterThanOrEqual(9);
    expect(r.every((m) => m.c === 'celik-yapi')).toBe(true);
  });

  test('kategori süzgeci arama ile birlikte çalışıyor', () => {
    expect(L.veStrMatLibSearch('', 'titanyum').length).toBe(3);
    expect(L.veStrMatLibSearch('grade', 'titanyum').length).toBeGreaterThan(0);
    expect(L.veStrMatLibSearch('S355', 'titanyum').length).toBe(0);
  });

  // ÖLÇÜLDÜ (gerçek tarayıcı): sıralama düz alfabetikken 16 kategori için
  // 30 AİLE BAŞLIĞI basılıyordu — aileler birbirinin içine giriyor, yapışkan
  // başlık her birkaç satırda değişiyor ve 112 kayıtlık katalog gezilemez
  // oluyordu. Arama YOKKEN sıra aileye göre olmak zorunda.
  test('boş sorgu TAM listeyi AİLEYE göre sıralı veriyor', () => {
    const hepsi = L.veStrMatLibSearch('');
    expect(hepsi.length).toBe(LIB.length);
    // Her aile listede TEK bir blok hâlinde: bir aileden çıkıp geri dönülmüyor.
    const gorulen = new Set();
    let son = null;
    hepsi.forEach((m) => {
      if (m.c !== son) {
        expect(gorulen.has(m.c)).toBe(false);
        gorulen.add(m.c);
        son = m.c;
      }
    });
    expect(gorulen.size).toBe(CATS.length);
    // Aile sırası VE_STR_MAT_CATS'in sırası
    expect(Array.from(gorulen)).toEqual(CATS.map((c) => c.key));
    // Aile İÇİNDE alfabetik
    CATS.forEach((c) => {
      const adlar = hepsi.filter((m) => m.c === c.key).map((m) => m.n);
      expect(adlar).toEqual(adlar.slice().sort((a, b) => a.localeCompare(b, 'tr')));
    });
  });

  test('bulunmayan sorgu boş dizi — patlamıyor', () => {
    expect(L.veStrMatLibSearch('zzzyokbunuböylebirşey')).toEqual([]);
    expect(L.veStrMatLibSearch(null).length).toBe(LIB.length);
    expect(L.veStrMatLibById('yok')).toBeNull();
  });
});

describe('kütüphane — kayda çevirme ve iz', () => {
  test('kayıt KOPYADIR, referans değil — katalog güncellemesi eski projeyi bozmaz', () => {
    const rec = L.veStrMatLibRecord('s355jr');
    rec.E = 999;
    expect(L.veStrMatLibById('s355jr').E).toBe(210000);  // katalog etkilenmedi
  });

  test('iz alanları yazılı: lib + libVer + source', () => {
    const rec = L.veStrMatLibRecord('1.4404');
    expect(rec.lib).toBe('1.4404');
    expect(rec.source).toBe('library');
    expect(rec.libVer).toBe(L.VE_STR_MAT_LIB_VERSION);
    expect(rec.name).toBe('X2CrNiMo17-12-2');
  });

  test('REFERANS alanlar (k, cp) kayda GEÇMİYOR — ölü veri olurdu', () => {
    // Çözücü ısıl iletkenliği kullanmıyor; düğüme kopyalamak ileride
    // "bu sayı nereden geldi, güncel mi" sorusunu doğururdu.
    const rec = L.veStrMatLibRecord('s355jr');
    expect('k' in rec).toBe(false);
    expect('cp' in rec).toBe(false);
    expect(Object.keys(rec).sort()).toEqual(
      ['E', 'alpha', 'lib', 'libVer', 'name', 'nu', 'rho', 'source', 'su', 'sy'].sort());
  });

  test('veStrMatLibMatches: elle değişen kayıt artık katalog kaydı DEĞİL', () => {
    const rec = L.veStrMatLibRecord('s355jr');
    expect(L.veStrMatLibMatches(rec)).toBe(true);
    rec.E = 205000;
    expect(L.veStrMatLibMatches(rec)).toBe(false);
  });

  test('veStrMatLibMatches: alan SİLİNİRSE de eşleşme bozulur', () => {
    const rec = L.veStrMatLibRecord('s355jr');
    delete rec.sy;
    expect(L.veStrMatLibMatches(rec)).toBe(false);
  });

  test('izsiz ya da bilinmeyen kimlikli kayıt eşleşmez', () => {
    expect(L.veStrMatLibMatches({ E: 210000 })).toBe(false);
    expect(L.veStrMatLibMatches({ lib: 'yok' })).toBe(false);
    expect(L.veStrMatLibMatches(null)).toBe(false);
    expect(L.veStrMatLibRecord('yok')).toBeNull();
  });

  test('gevrek kaydın eşleşmesi de tutuyor (null alan ↔ eksik alan)', () => {
    expect(L.veStrMatLibMatches(L.veStrMatLibRecord('gjl-250'))).toBe(true);
    expect(L.veStrMatLibMatches(L.veStrMatLibRecord('al2o3-995'))).toBe(true);
  });
});

// ════════════════════════════════════════════════════════════════════════════
//  GENİŞLETİLMİŞ VERİ — SICAKLIK · YORULMA · SERTLİK
// ════════════════════════════════════════════════════════════════════════════
// Bu üç blok kataloğun "Ansys kıvamı" kısmını tutuyor. Ortak ilke aynı:
// sayıların kendisi ölçülemez, ama ARALARINDAKİ İLİŞKİ ölçülür — eğri
// monoton mu, 20 °C'de 1,000 mi, σ_W gerçekten f_W·Rm mi, Rm/HB oranı sınıfın
// penceresinde mi.

describe('genişletilmiş alanlar — hepsi dolu ve makul', () => {
  test.each(HER)('%s — uzama (A) ve azami servis sıcaklığı var', (_ad, m) => {
    expect(typeof m.A).toBe('number');
    expect(m.A).toBeGreaterThanOrEqual(0);
    expect(m.A).toBeLessThanOrEqual(700);      // elastomerlerde %550'ye çıkıyor
    expect(typeof m.tmax).toBe('number');
    expect(m.tmax).toBeGreaterThan(40);
    expect(m.tmax).toBeLessThanOrEqual(2000);  // tungsten
  });

  test.each(HER)('%s — bir SERTLİK ölçeği taşıyor', (_ad, m) => {
    const h = L.veStrMatHardness(m);
    expect(h).toBeTruthy();
    expect(h.deger).toBeGreaterThan(0);
    expect(['HBW', 'HV', 'Shore D', 'Shore A']).toContain(h.birim);
  });

  // Sertlik ÖLÇEĞİ sınıfa göre: metalde Brinell, seramikte Vickers,
  // termoplastikte Shore D, elastomerde Shore A. Hepsini tek sayıya indirmek
  // yanlış olurdu — Shore A 70 ile HB 70 aynı büyüklük bile değil.
  test('sertlik ölçeği sınıfa uygun', () => {
    const olcek = (id) => L.veStrMatHardness(L.veStrMatLibById(id)).olcek;
    expect(olcek('s355jr')).toBe('hb');
    expect(olcek('al2o3-995')).toBe('hv');
    expect(olcek('pa66')).toBe('shD');
    expect(olcek('nbr70')).toBe('shA');
    L.veStrMatLibByCat('elastomer').forEach((m) => expect(m.shA).toBeGreaterThan(0));
    L.veStrMatLibByCat('seramik').forEach((m) => expect(m.hv).toBeGreaterThan(0));
  });

  // ASIL KAPI: Rm ≈ 3,38·HB (ISO 18265) alaşımsız çelikte geçerli; başka
  // sınıflarda oran BAŞKA — gri dökme demirde grafit lamelleri yüzünden
  // 1,2–1,5, titanyumda ≈ 2,8. Oran penceresi bir σ_ç ya da HB yazım
  // hatasını yakalar: ikisinden biri on kat kayarsa oran pencereden çıkar.
  test.each(HER)('%s — Rm/HB oranı sınıfının penceresinde', (_ad, m) => {
    const r = L.veStrMatHardnessRatio(m);
    if (r === null) return;                    // Brinell'i olmayan sınıflar
    const c = catOf(m);
    expect(c.hbWin).toBeTruthy();
    expect(r).toBeGreaterThanOrEqual(c.hbWin[0]);
    expect(r).toBeLessThanOrEqual(c.hbWin[1]);
  });

  test('gri dökme demirin oranı çelikten AÇIKÇA farklı — grafit lamelleri', () => {
    // Aynı pencereye sıkıştırılsalardı kapı hiçbir şey yakalamazdı.
    expect(L.veStrMatHardnessRatio(L.veStrMatLibById('gjl-150'))).toBeLessThan(2);
    expect(L.veStrMatHardnessRatio(L.veStrMatLibById('s355jr'))).toBeGreaterThan(2.9);
  });
});

describe('sıcaklık eğrileri', () => {
  const SETS = Object.keys(L.VE_STR_MAT_TEMP_SETS).map((k) => [k, L.VE_STR_MAT_TEMP_SETS[k]]);

  test.each(SETS)('%s — 20 °C\'de bütün oranlar 1,000', (_k, set) => {
    const ref = set.p.find((q) => q[0] === 20 || q[0] === 23);
    expect(ref).toBeTruthy();
    expect(ref[1]).toBeCloseTo(1, 6);          // kE
    expect(ref[2]).toBeCloseTo(1, 6);          // kY
  });

  test.each(SETS)('%s — sıcaklık arttıkça kE ve kY MONOTON düşüyor', (_k, set) => {
    // Bir noktanın yanlış yere yazılması (ör. 0,31 yerine 0,81) eğriyi
    // monotonluktan çıkarır; gözle grafikte de görünür ama kapı burada.
    for (let i = 1; i < set.p.length; i++) {
      expect(set.p[i][0]).toBeGreaterThan(set.p[i - 1][0]);
      expect(set.p[i][1]).toBeLessThanOrEqual(set.p[i - 1][1] + 1e-9);
      expect(set.p[i][2]).toBeLessThanOrEqual(set.p[i - 1][2] + 1e-9);
    }
  });

  // HANGİ EĞRİNİN STANDART OLDUĞU SABİTLENMİŞ. Üstteki test yalnız "tur alanı
  // std ya da tipik" diyor; bir el kitabı eğrisini sessizce 'std'ye
  // yükseltmek ondan GEÇERDİ (mutasyonla ölçüldü) — ve panel o eğriyi
  // standardın tablosuymuş gibi, daha yüksek bir yetkiyle basardı.
  test('std ↔ tipik SINIFLANDIRMASI sabitlenmiş', () => {
    const beklenen = {
      'karbon-celik': 'std',   'ostenitik': 'std',
      'alu-6xxx-t6': 'std',    'alu-5xxx': 'std',
      'ferritik-mart': 'tipik','dokme-demir': 'tipik', 'titanyum': 'tipik',
      'nikel': 'tipik',        'bakir': 'tipik',       'magnezyum': 'tipik',
      'polimer': 'tipik',      'seramik': 'tipik',
    };
    // Yeni bir takım eklenirse burada da sınıflandırılmak ZORUNDA
    expect(Object.keys(L.VE_STR_MAT_TEMP_SETS).sort()).toEqual(Object.keys(beklenen).sort());
    Object.keys(beklenen).forEach((k) => {
      expect(L.VE_STR_MAT_TEMP_SETS[k].tur).toBe(beklenen[k]);
    });
    // 'std' olanların kaynağı bir STANDARDI adıyla anmalı
    Object.keys(beklenen).filter((k) => beklenen[k] === 'std').forEach((k) => {
      expect(L.VE_STR_MAT_TEMP_SETS[k].kaynak).toMatch(/EN \d/);
    });
    // 'tipik' olanlar standart numarası VERMEMELİ — yetki taklidi olurdu
    Object.keys(beklenen).filter((k) => beklenen[k] === 'tipik').forEach((k) => {
      expect(L.VE_STR_MAT_TEMP_SETS[k].kaynak).not.toMatch(/EN \d/);
    });
  });

  // Yorulma takımlarında da aynı ayrım: FKM'in kendi sabiti mi, tipik mi.
  test('yorulma takımlarında FKM ↔ tipik ayrımı sabitlenmiş', () => {
    const fkm = ['celik', 'paslanmaz', 'dokme-celik', 'gjs', 'gjm', 'gjl', 'alu-dovme', 'alu-dokum'];
    const tipik = ['titanyum', 'bakir', 'magnezyum', 'nikel', 'polimer'];
    expect(Object.keys(L.VE_STR_MAT_FAT_SETS).sort()).toEqual(fkm.concat(tipik).sort());
    fkm.forEach((k) => expect(L.VE_STR_MAT_FAT_SETS[k].kaynak).toBe('FKM'));
    tipik.forEach((k) => expect(L.VE_STR_MAT_FAT_SETS[k].kaynak).toBe('tipik'));
  });

  test.each(SETS)('%s — kaynağı ve türü (std/tipik) yazılı', (_k, set) => {
    // İKİ AYRI GÜVEN DÜZEYİ: bir standardın tablosu ile el kitabının tipik
    // seyri aynı ağırlıkta okunmamalı. Ayrım gizlenseydi kullanıcı ikisini
    // aynı sayarak tasarım yapardı.
    expect(typeof set.kaynak).toBe('string');
    expect(set.kaynak.length).toBeGreaterThan(0);
    expect(['std', 'tipik']).toContain(set.tur);
    expect(typeof set.ad).toBe('string');
  });

  // ÇIPA: EN 1993-1-2 Tablo 3.1'in doğrulanmış değerleri.
  test('EN 1993-1-2 karbon çeliği çıpaları kaymamış', () => {
    const s355 = L.veStrMatLibById('s355jr');
    const f = (t) => L.veStrMatTempFactors(s355, t);
    expect(f(500).kY).toBeCloseTo(0.780, 6);
    expect(f(600).kY).toBeCloseTo(0.470, 6);
    expect(f(700).kY).toBeCloseTo(0.230, 6);
    expect(f(400).kE).toBeCloseTo(0.700, 6);
    expect(f(20).kE).toBeCloseTo(1.000, 6);
    expect(f(1200).kY).toBeCloseTo(0.000, 6);
  });

  // kY'nin 400 °C'ye kadar 1,000 kalması ŞAŞIRTICI ama DOĞRU: EN 1993-1-2'nin
  // kY'si %2 gerinimdeki ETKİN akma dayanımı. Elastik sınır (kP) çoktan
  // düşmeye başlamıştır. İkisi birden basılmasaydı kullanıcı "400 °C'ye kadar
  // hiçbir şey olmuyor" diye okurdu.
  test('karbon çeliğinde kY 400 °C\'ye kadar 1,000 ama kP ÇOKTAN düşüyor', () => {
    const s = L.veStrMatLibById('s355jr');
    expect(L.veStrMatTempFactors(s, 400).kY).toBeCloseTo(1.0, 6);
    expect(L.veStrMatTempFactors(s, 400).kP).toBeCloseTo(0.420, 6);
    expect(L.veStrMatTempFactors(s, 200).kP).toBeCloseTo(0.807, 6);
    expect(L.veStrMatTempFactors(s, 400).kP).toBeLessThan(0.5);
  });

  test('ara değerleme DOĞRUSAL — standardın kendi kuralı', () => {
    const s = L.veStrMatLibById('s355jr');
    // 550 °C: 500 (0.780) ile 600 (0.470) arasının tam ortası
    expect(L.veStrMatTempFactors(s, 550).kY).toBeCloseTo((0.780 + 0.470) / 2, 9);
    expect(L.veStrMatTempFactors(s, 450).kE).toBeCloseTo((0.700 + 0.600) / 2, 9);
  });

  test('aralık DIŞINDA ekstrapolasyon YOK — uçtaki değere sabitleniyor', () => {
    // Ekstrapolasyon 1200 °C'nin ötesinde NEGATİF dayanım üretirdi.
    const s = L.veStrMatLibById('s355jr');
    const ust = L.veStrMatTempFactors(s, 2000);
    expect(ust.kY).toBe(0);
    expect(ust.disarida).toBe(true);
    const alt = L.veStrMatTempFactors(s, -100);
    expect(alt.kY).toBe(1);
    expect(alt.disarida).toBe(true);
    expect(L.veStrMatTempFactors(s, 500).disarida).toBe(false);
  });

  test('MUTLAK değerler 20 °C tabanıyla çarpılıyor', () => {
    const s = L.veStrMatLibById('s355jr');
    const at = L.veStrMatAtTemp(s, 500);
    expect(at.E).toBeCloseTo(210000 * 0.600, 6);
    expect(at.sy).toBeCloseTo(355 * 0.780, 6);
    expect(at.rp).toBeCloseTo(355 * 0.360, 6);
  });

  // ALÜMİNYUMUN ÇÖKÜŞÜ ÇOK ERKEN — kütüphanenin en öğretici karşılaştırması.
  test('6082-T6 200 °C\'de dayanımının üçte ikisini kaybediyor, çelik kaybetmiyor', () => {
    const al = L.veStrMatLibById('aw6082-t6');
    const st = L.veStrMatLibById('s355jr');
    expect(L.veStrMatTempFactors(al, 200).kY).toBeLessThan(0.45);
    expect(L.veStrMatTempFactors(st, 200).kY).toBeCloseTo(1.0, 6);
  });

  test('5xxx (AlMg) 6xxx-T6\'dan ISIDA DAHA İYİ — çökelme sertleşmesi yok', () => {
    const a5 = L.veStrMatLibById('aw5083-h111');
    const a6 = L.veStrMatLibById('aw6082-t6');
    expect(L.veStrMatTempSet(a5).ad).toMatch(/5xxx/);
    expect(L.veStrMatTempFactors(a5, 200).kY)
      .toBeGreaterThan(L.veStrMatTempFactors(a6, 200).kY);
  });

  test('ferritik/martenzitik paslanmaz ÖSTENİTİĞİN eğrisini kullanmıyor', () => {
    ['1.4016', '1.4021', '1.4542', '1.4462'].forEach((id) => {
      expect(L.veStrMatTempSet(L.veStrMatLibById(id)).ad).toMatch(/Ferritik/);
    });
    ['1.4301', '1.4404'].forEach((id) => {
      expect(L.veStrMatTempSet(L.veStrMatLibById(id)).ad).toMatch(/Östenitik/);
    });
  });

  test('eğrisi OLMAYAN sınıfta null dönüyor — uydurma eğri çizilmiyor', () => {
    L.veStrMatLibByCat('elastomer').forEach((m) => {
      expect(L.veStrMatTempSet(m)).toBeNull();
      expect(L.veStrMatTempFactors(m, 100)).toBeNull();
      expect(L.veStrMatAtTemp(m, 100)).toBeNull();
    });
  });

  test('HER kaydın eğrisi ya var ya AÇIKÇA yok — sessiz üçüncü durum yok', () => {
    LIB.forEach((m) => {
      const set = L.veStrMatTempSet(m);
      expect(set === null || (set && Array.isArray(set.p))).toBe(true);
    });
    // Ve metallerin ezici çoğunluğunun eğrisi VAR
    const metal = LIB.filter((m) => m.hb != null);
    const egrili = metal.filter((m) => L.veStrMatTempSet(m));
    expect(egrili.length / metal.length).toBeGreaterThan(0.9);
  });
});

describe('Wöhler (S-N) eğrisi', () => {
  const FATLI = LIB.filter((m) => L.veStrMatFatigue(m)).map((m) => [m.n + ' (' + m.id + ')', m]);

  test('yorulma modeli olan kayıt sayısı anlamlı', () => {
    expect(FATLI.length).toBeGreaterThan(80);
  });

  test.each(FATLI)('%s — σ_W = f_W · Rm ve f_W 0,25–0,45 arasında', (_ad, m) => {
    const f = L.veStrMatFatigue(m);
    expect(f.sw).toBeCloseTo(f.fw * m.su, 9);
    expect(f.fw).toBeGreaterThanOrEqual(0.25);
    expect(f.fw).toBeLessThanOrEqual(0.45);
    expect(f.sw).toBeLessThan(m.su);          // dayanma sınırı Rm'nin altında
  });

  test.each(FATLI)('%s — S-N eğrisi MONOTON düşüyor ve Rm\'de kesiliyor', (_ad, m) => {
    const N = [1e3, 1e4, 1e5, 1e6, 1e7, 1e8];
    let onceki = Infinity;
    N.forEach((n) => {
      const s = L.veStrMatSN(m, n);
      expect(s).toBeLessThanOrEqual(onceki + 1e-9);
      expect(s).toBeLessThanOrEqual(m.su + 1e-9);   // KESİM: Rm aşılmıyor
      expect(s).toBeGreaterThan(0);
      onceki = s;
    });
  });

  test('ÇELİKTE gerçek dayanma sınırı var, ALÜMİNYUMDA yok', () => {
    // Alüminyumun S-N eğrisi dizden sonra da düşer (k2). "Sonsuz ömür"
    // bölgesi çizilseydi olmayan bir güvenlik anlatılmış olurdu.
    const st = L.veStrMatLibById('s355jr');
    const al = L.veStrMatLibById('aw6082-t6');
    expect(L.veStrMatFatigue(st).sinirVar).toBe(true);
    expect(L.veStrMatFatigue(al).sinirVar).toBe(false);
    expect(L.veStrMatSN(st, 1e8)).toBeCloseTo(L.veStrMatSN(st, 1e6), 9);
    expect(L.veStrMatSN(al, 1e8)).toBeLessThan(L.veStrMatSN(al, 1e6) - 1);
  });

  test('dizde (N_D) süreklilik — eğri sıçramıyor', () => {
    LIB.filter((m) => L.veStrMatFatigue(m)).forEach((m) => {
      const f = L.veStrMatFatigue(m);
      const a = L.veStrMatSN(m, f.nd * 0.999);
      const b = L.veStrMatSN(m, f.nd * 1.001);
      expect(Math.abs(a - b)).toBeLessThan(Math.max(0.01, f.sw * 0.002));
    });
  });

  // MODELİN GEÇERLİLİK SINIRI: Basquin doğrusu geriye uzatılınca Rm'yi aşar;
  // orası düşük çevrimli yorulma (LCF) bölgesi ve bu model orada geçerli
  // DEĞİL. Sınır hesaplanabiliyor ve çizimde işaretleniyor.
  test('LCF sınırı hesaplanıyor ve makul bir çevrim sayısında', () => {
    const s = L.veStrMatLibById('s355jr');
    const n = L.veStrMatSNlimit(s);
    expect(n).toBeGreaterThan(1e3);
    expect(n).toBeLessThan(1e6);
    // Tam o noktada eğri Rm'ye eşit
    expect(L.veStrMatSN(s, n)).toBeCloseTo(s.su, 6);
  });

  test('σ_ç OLMAYAN kayıtta yorulma modeli YOK — uydurulmuyor', () => {
    const yok = { c: 'celik-yapi', E: 210000, nu: 0.3, su: null };
    expect(L.veStrMatFatigue(yok)).toBeNull();
    // Elastomer ve seramikte de model yok (fset tanımsız)
    L.veStrMatLibByCat('elastomer').forEach((m) => expect(L.veStrMatFatigue(m)).toBeNull());
    L.veStrMatLibByCat('seramik').forEach((m) => expect(L.veStrMatFatigue(m)).toBeNull());
  });

  test('gri dökme demirin f_W\'si çelikten DÜŞÜK — grafit çentik etkisi', () => {
    expect(L.veStrMatFatigue(L.veStrMatLibById('gjl-250')).fw)
      .toBeLessThan(L.veStrMatFatigue(L.veStrMatLibById('s355jr')).fw);
  });

  test.each(FATLI)('%s — kaynağı yazılı', (_ad, m) => {
    expect(['FKM', 'tipik']).toContain(L.veStrMatFatigue(m).kaynak);
  });
});
