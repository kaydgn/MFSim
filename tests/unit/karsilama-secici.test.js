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
