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
