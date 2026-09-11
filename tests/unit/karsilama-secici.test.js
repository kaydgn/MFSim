/**
 * karsilama-secici.test.js — karşılama SEÇİM TAHTASININ kaynak üçlüsü
 *
 * Araç (tools/karsilama-secici.js) üç parçadan sayfa üretiyor: klasör
 * (assets/karsilama/), künye (tools/karsilama-kunye.json) ve şablon
 * (tools/karsilama-secici.html). Üretilen sayfa git'e dâhil DEĞİL, yani
 * bayatlığını yakalayacak bir tazelik kapısı yok — bu dosya KAYNAKLARI tutuyor.
 *
 * ÜÇ SESSİZ HATA SINIFI:
 *
 * 1) KÜNYE ↔ KLASÖR AYRIŞMASI. Sayfanın tek işi "hangi resim hangisi"
 *    sorusunu çözmek. Yeni bir kare künyeye yazılmazsa üreteç durur (iyi), ama
 *    KALDIRILAN bir karenin künyesi geride kalırsa hiçbir şey durmaz: kayıt
 *    sessizce olmayan bir dosyayı anlatmaya devam eder ve bir sonraki oturum
 *    ona güvenir. İki yönlü tutuluyor.
 *
 * 2) GEÇERSİZ GRUP. Künyedeki 'grup' şablonun GRUPLAR tablosunda yoksa o kare
 *    sayfada HİÇ çizilmez — 28 kare bekleyip 27 görmek gözle yakalanmaz.
 *
 * 3) ŞABLON ÇAPASI. Üreteç veriyi '/*__VERI__*\/[]' yuvasına basıyor. Şablon
 *    elden geçerken çapa kaybolursa üreteç durur; çapanın burada da yazılı
 *    olması, kaybının SEBEBİNİ bir sonraki oturuma anlatır.
 *
 * 'es' (benzer kare) alanı bir HÜKÜM değil ipucu, ama işaret ettiği kare
 * yoksa sayfada "olmayan kare ile benzer" yazar — o yüzden o da bağlı.
 */

const fs = require('fs');
const path = require('path');

const KOK = path.join(__dirname, '../..');
const KLASOR = path.join(KOK, 'assets/karsilama');
const KUNYE = JSON.parse(fs.readFileSync(path.join(KOK, 'tools/karsilama-kunye.json'), 'utf8'));
const SABLON = fs.readFileSync(path.join(KOK, 'tools/karsilama-secici.html'), 'utf8');
const URETEC = fs.readFileSync(path.join(KOK, 'tools/karsilama-secici.js'), 'utf8');
// Aday tarafı: Commons'tan gelen adayların seçim sayfası (ayrı şablon).
const SLAYT_TEST = fs.readFileSync(path.join(KOK, 'tests/unit/karsilama-slayt.test.js'), 'utf8');
const ADAY_SABLON = fs.readFileSync(path.join(KOK, 'tools/karsilama-aday-secici.html'), 'utf8');
const ADAY_URETEC = fs.readFileSync(path.join(KOK, 'tools/karsilama-aday-secici.js'), 'utf8');
const BUL = fs.readFileSync(path.join(KOK, 'tools/karsilama-bul.js'), 'utf8');
const WEBP = fs.readFileSync(path.join(KOK, 'tools/karsilama-webp.js'), 'utf8');

const dosyaNolari = fs.readdirSync(KLASOR)
  .filter((f) => /^karsilama-\d+\.webp$/.test(f))
  .map((f) => /(\d+)/.exec(f)[1])
  .sort();
const kunyeNolari = Object.keys(KUNYE.kareler).sort();

describe('künye ↔ klasör iki yönlü', () => {
  test('her karenin künyesi var', () => {
    const eksik = dosyaNolari.filter((n) => !KUNYE.kareler[n]);
    expect(eksik).toEqual([]);
  });

  test('künyede karşılığı olmayan kayıt yok (öksüz künye)', () => {
    const oksuz = kunyeNolari.filter((n) => !dosyaNolari.includes(n));
    expect(oksuz).toEqual([]);
  });

  test('klasör boş değil ve sayılar örtüşüyor', () => {
    expect(dosyaNolari.length).toBeGreaterThan(0);
    expect(kunyeNolari).toEqual(dosyaNolari);
  });
});

describe('künye alanları', () => {
  // Şablonun kendi grup tablosundan okunuyor — ikinci bir kopya tutulmuyor.
  const gruplar = Array.from(SABLON.matchAll(/\{\s*k:\s*'([a-z]+)'/g)).map((m) => m[1]);

  test('şablon grup tablosu okunabiliyor', () => {
    expect(gruplar.length).toBeGreaterThanOrEqual(2);
  });

  test('her kaydın grubu şablonda tanımlı', () => {
    const kacak = kunyeNolari.filter((n) => !gruplar.includes(KUNYE.kareler[n].grup));
    expect(kacak).toEqual([]);
  });

  test('her kaydın başlığı dolu', () => {
    const bos = kunyeNolari.filter((n) => !String(KUNYE.kareler[n].baslik || '').trim());
    expect(bos).toEqual([]);
  });

  test('es alanı var olan bir kareyi gösteriyor (ya da boş)', () => {
    const kirik = kunyeNolari.filter((n) => {
      const es = KUNYE.kareler[n].es;
      return es && !dosyaNolari.includes(es);
    });
    expect(kirik).toEqual([]);
  });

  test('kaynak bloğu varsa ÜÇ alanı birden dolu (yarım künye yok)', () => {
    // Dışarıdan gelen karelerde (Commons taraması) lisans + sahip + Commons
    // dosya adı birlikte anlam taşıyor: biri eksikse "bu kare nereden geldi"
    // sorusu cevapsız kalır ve eksikliği hiçbir şey söylemez. Kullanıcının
    // kendi verdiği karelerde blok HİÇ olmaz — o normaldir, yarımı değil.
    const yarim = kunyeNolari.filter((n) => {
      const k = KUNYE.kareler[n].kaynak;
      if (!k) return false;
      return !['lisans', 'sahip', 'commons'].every((a) => String(k[a] || '').trim());
    });
    expect(yarim).toEqual([]);
  });

  test('es karşılıklı — A B diyorsa B de A demeli', () => {
    const tekYonlu = kunyeNolari.filter((n) => {
      const es = KUNYE.kareler[n].es;
      return es && KUNYE.kareler[es] && KUNYE.kareler[es].es !== n;
    });
    expect(tekYonlu).toEqual([]);
  });
});

describe('şablon ↔ üreteç sözleşmesi', () => {
  test('veri çapası şablonda ve üretecte aynı', () => {
    expect(SABLON).toContain('/*__VERI__*/[]');
    expect(URETEC).toContain("CAPA = '/*__VERI__*/[]'");
  });

  test('şablon kendi başına da [hidden] perdesini kapatıyor', () => {
    // .perde{display:grid} sınıf seçicisi tarayıcının [hidden] kuralını ezer.
    // Yayın kabuğundaki !important bunu maskeliyor; şablon o kabuk olmadan da
    // doğru açılmalı (yerel önizleme, dosyayı doğrudan açmak).
    expect(SABLON).toMatch(/\.perde\[hidden\]\s*\{\s*display:\s*none/);
  });

  test('kareler kaçışlanıyor — başlıkta tırnak/işaret HTML kırmıyor', () => {
    expect(SABLON).toMatch(/function kacir\(/);
    expect(SABLON).toContain('kacir(k.baslik)');
  });
});


describe('aday seçici — şablon ↔ üreteç sözleşmesi', () => {
  test('iki çapa da şablonda ve üretecte aynı', () => {
    expect(ADAY_SABLON).toContain('/*__VERI__*/[]');
    expect(ADAY_URETEC).toContain("CAPA_VERI = '/*__VERI__*/[]'");
    // Durum çapası tam metin eşleşmesiyle basılıyor; biri elden geçerse üreteç
    // "şablonda durum çapası yok" diye DURUR, sessizce boş sayfa üretmez.
    const capa = /CAPA_DURUM = '(.+?)';/.exec(ADAY_URETEC);
    expect(capa).not.toBeNull();
    expect(ADAY_SABLON).toContain(capa[1]);
  });

  test('kendi başına da [hidden] perdesini kapatıyor', () => {
    expect(ADAY_SABLON).toMatch(/\.perde\[hidden\]\s*\{\s*display:\s*none/);
  });

  test('başlık ve künye kaçışlanıyor', () => {
    expect(ADAY_SABLON).toMatch(/function kacir\(/);
    expect(ADAY_SABLON).toContain('kacir(a.baslik)');
    expect(ADAY_SABLON).toContain('kacir(a.sahip)');
  });

  test('kurulu kare seçicisinden AYRI db dokümanı kullanıyor', () => {
    // Aynı dokümana yazsalar biri ötekinin kararını ezerdi: biri "kaldır",
    // öteki "ekle" listesi tutuyor.
    expect(SABLON).toContain("db.doc('karar/secim')");
    expect(ADAY_SABLON).toContain("db.doc('aday/secim')");
    expect(ADAY_SABLON).not.toContain("db.doc('karar/secim')");
  });
});

describe('tavan sabitleri tek kaynaktan', () => {
  // Tavanlar karsilama-slayt.test.js'te yaşıyor; iki araç onları KOPYALIYOR.
  // Kopya sessizce ayrıştı ve bir kez yakalandı: klasör tavanı 6,5 → 7,3 MB
  // yükseltildiğinde karsilama-webp.js 6,5'te kaldı, yani geçerli bir eklemede
  // "tavanı aştı" diye uyarıp çıkış kodunu 1 yapıyordu. Sayılar KB'ye
  // indirgenip karşılaştırılıyor.
  const kb = (kaynak, ad, birim) => {
    const m = new RegExp('\\b' + ad + '\\s*=\\s*([^;\\n]+)').exec(kaynak);
    if (!m) return null;
    const sayilar = (m[1].match(/[0-9]+(?:\.[0-9]+)?/g) || []).map(Number);
    if (!sayilar.length) return null;
    const carpim = sayilar.reduce((t, v) => t * v, 1);
    return birim === 'bayt' ? carpim / 1024 : carpim;   // hepsi KB'ye
  };

  test('klasör toplam tavanı üç yerde de aynı', () => {
    const testKb = kb(SLAYT_TEST, 'TOPLAM_TAVAN', 'bayt');
    expect(testKb).toBeGreaterThan(0);
    expect(kb(ADAY_URETEC, 'TAVAN_KB', 'kb')).toBeCloseTo(testKb, 3);
    expect(kb(WEBP, 'TOPLAM_TAVAN', 'bayt')).toBeCloseTo(testKb, 3);
  });

  test('kare başına tavan üç yerde de aynı', () => {
    const testKb = kb(SLAYT_TEST, 'KARE_TAVAN', 'bayt');
    expect(testKb).toBeGreaterThan(0);
    expect(kb(ADAY_URETEC, 'KARE_TAVAN_KB', 'kb')).toBeCloseTo(testKb, 3);
    expect(kb(WEBP, 'KARE_TAVAN', 'bayt')).toBeCloseTo(testKb, 3);
  });
});

describe('aday tarayıcısı', () => {
  test('lisans süzgeci varsayılan KAPALI ama bayrakla açılabiliyor', () => {
    expect(BUL).toMatch(/lisansSuzgeci:\s*false/);
    expect(BUL).toContain("--lisans-suzgeci");
    expect(BUL).toMatch(/o\.lisansSuzgeci\s*&&\s*!lis\.tamam/);
  });

  test('lisans künyesi her adayda kaydediliyor', () => {
    for (const alan of ['lisans:', 'sahip:', 'sayfa:', 'lisansSerbest:']) {
      expect(BUL).toContain(alan);
    }
  });

  test('Wikimedia politikası gereği tanımlı User-Agent gönderiliyor', () => {
    expect(BUL).toMatch(/UA\s*=\s*'MFSim/);
    expect(BUL).toContain("'User-Agent': UA");
  });
});
