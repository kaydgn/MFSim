/**
 * karsilama-slayt.test.js — karşılama ekranının arkasındaki slayt
 *
 * KULLANICI İSTEĞİ (2026-09-08): "Modüllerin arkasına bu resimleri karışık ve
 * slayt halinde koy, yumuşak geçişlerle."
 *
 * DÖRT SESSİZ HATA SINIFI — dördü de "program çalışır, kimse uyarmaz":
 *
 * 1) LİSTE ↔ KLASÖR AYRIŞMASI. Kare listesi (js/karsilama-gorseller.js) ile
 *    assets/karsilama/ içeriği birbirinden habersiz. Bir dosya silinirse slayt
 *    404'e düşer (modüler kopyada boş kare, tek dosyada gömülmemiş ad); yeni bir
 *    dosya eklenip listeye yazılmazsa hiç görünmez. İki yönlü tutuluyor.
 *
 * 2) BOYUT KAÇAĞI. Kareler tek dosyaya base64 gömülüyor (×1,34). Klasöre 5 MB'lık
 *    bir fotoğraf düşerse indirilen program sessizce şişer. Kare başına ve toplam
 *    tavan burada.
 *
 * 3) KAYNAK SEÇİMİ. Gömülü künye varsa data URI, yoksa dosya yolu kullanılmalı.
 *    Ters giderse tek dosya çevrimdışı açıldığında slayt HİÇ çıkmaz.
 *
 * 4) ZAMANLAYICI SIZINTISI. Slayt modül seçilince durmazsa arka planda kare
 *    değiştirmeye devam eder; iki kez başlatılırsa iki zamanlayıcı birden koşar.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '../..');
const DIR = path.join(ROOT, 'assets/karsilama');
const CSS = fs.readFileSync(path.join(ROOT, 'css/styles.css'), 'utf8');
const BUILD = fs.readFileSync(path.join(ROOT, 'build.js'), 'utf8');
const COMP = fs.readFileSync(path.join(ROOT, 'js/components.js'), 'utf8');
const LISTE = require('../../js/karsilama-gorseller.js').VE_KARSILAMA_GORSELLER;

// Kareler ÖZGÜN ölçülerinde duruyor (1015–1920 px). Küçültme denendi ve geri
// alındı: 1280 px'e indirmek görünür biçimde bulanıklaştırıyordu ve kullanıcı
// boyut için kaliteden ödün vermeme kararını verdi (CLAUDE.md › teslim kuralı:
// dosya gzip'lenerek gönderiliyor). Tavanlar buna göre.
const KARE_TAVAN = 560 * 1024;          // kare başına (ölçülen en büyük: 519 KB)
const TOPLAM_TAVAN = 6.5 * 1024 * 1024; // klasör toplamı (ölçülen: 5,80 MB)

function setupDOM() {
  document.body.innerHTML =
    '<div id="sayfa2-content"><div class="ve-main">' +
    '  <div class="ve-doc-dock"></div>' +
    '  <div class="ve-module-overlay" id="ve-module-overlay">' +
    '    <div class="ve-welcome">' +
    '      <div class="ve-welcome-slayt" id="ve-welcome-slayt"></div>' +
    '      <div class="ve-welcome-id"></div>' +
    '    </div>' +
    '  </div>' +
    '</div></div>';
}

// matchMedia jsdom'da yok; varsayılan "hareket açık".
let hareketKapali = false;
global.matchMedia = (q) => ({ matches: hareketKapali && /reduce/.test(q), media: q });

setupDOM();
global.VE_KARSILAMA_GORSELLER = LISTE;   // eval edilen kod BUNU görür
eval(loadSource('canvas-space.js'));
eval(loadSource('components.js'));
// components.js'teki yüklem GLOBAL'e yazılır: cp-fead.js / state.js require ile
// yükleniyor, dolayısıyla çıplak `veIsCanvasHidden` referansı bu dosyanın
// kapsamını DEĞİL global'i arar. Yazılmazsa kutusuz düğüm kapısı sessizce
// atlanır ve testler kutuların hâlâ kurulduğu bir dünyayı ölçer.
global.veIsCanvasHidden = veIsCanvasHidden;

beforeEach(() => {
  setupDOM();
  hareketKapali = false;
  delete window.__MFSIM_KARSILAMA;
  veWelcomeSlaytDurdur();
});
afterEach(() => veWelcomeSlaytDurdur());

// ═══ 1) LİSTE ↔ KLASÖR ═════════════════════════════════════════════════════
describe('Kare listesi ile klasör ayrışamaz', () => {
  const diskte = fs.readdirSync(DIR).filter((f) => f.endsWith('.webp')).sort();

  test('klasördeki her kare listede var (öksüz dosya yok)', () => {
    expect(diskte.filter((f) => LISTE.indexOf(f) < 0)).toEqual([]);
  });

  test('listedeki her kare diskte var (kırık ad yok)', () => {
    expect(LISTE.filter((f) => diskte.indexOf(f) < 0)).toEqual([]);
  });

  test('en az iki kare var (tek kare slayt değildir)', () => {
    expect(LISTE.length).toBeGreaterThanOrEqual(2);
  });

  test('adlar düzenli: karsilama-NN.webp', () => {
    LISTE.forEach((f) => expect(f).toMatch(/^karsilama-\d{2}\.webp$/));
  });
});

// ═══ 2) BOYUT KAPISI ═══════════════════════════════════════════════════════
describe('Boyut — kareler tek dosyaya base64 gömülüyor', () => {
  test('hiçbir kare 560 KB\'ı geçmiyor', () => {
    const buyuk = LISTE
      .map((f) => ({ f, b: fs.statSync(path.join(DIR, f)).size }))
      .filter((x) => x.b > KARE_TAVAN)
      .map((x) => x.f + ' (' + Math.round(x.b / 1024) + ' KB)');
    expect(buyuk).toEqual([]);
  });

  test('klasör toplamı 6,5 MB\'ı geçmiyor', () => {
    const toplam = LISTE
      .reduce((t, f) => t + fs.statSync(path.join(DIR, f)).size, 0);
    expect(toplam).toBeLessThanOrEqual(TOPLAM_TAVAN);
  });

  test('build.js kareleri gömüyor (çevrimdışı tek dosyanın tek yolu)', () => {
    expect(BUILD).toContain('window.__MFSIM_KARSILAMA');
    expect(BUILD).toMatch(/assets['"\s,]+karsilama/);
  });
});

// ═══ 3) KAYNAK SEÇİMİ ══════════════════════════════════════════════════════
describe('Kare kaynağı — gömülü varsa data URI, yoksa dosya yolu', () => {
  test('gömülü künye varken data URI kullanılır', () => {
    window.__MFSIM_KARSILAMA = { 'karsilama-01.webp': 'data:image/webp;base64,AAA' };
    expect(veSlaytKaynak('karsilama-01.webp')).toBe('data:image/webp;base64,AAA');
  });

  test('künye yoksa modüler yola düşer', () => {
    expect(veSlaytKaynak('karsilama-07.webp')).toBe('assets/karsilama/karsilama-07.webp');
  });

  test('künye var ama o kare eksikse yine dosya yoluna düşer', () => {
    window.__MFSIM_KARSILAMA = { 'karsilama-01.webp': 'data:x' };
    expect(veSlaytKaynak('karsilama-02.webp')).toBe('assets/karsilama/karsilama-02.webp');
  });
});

// ═══ 4) SLAYT DAVRANIŞI ════════════════════════════════════════════════════
describe('veWelcomeSlaytBaslat', () => {
  const kap = () => document.getElementById('ve-welcome-slayt');
  const kareler = () => Array.from(kap().querySelectorAll('.ve-welcome-kare'));

  test('iki katman kurar, ilki görünür ve resmi yüklü', () => {
    expect(veWelcomeSlaytBaslat()).toBe(true);
    expect(kareler().length).toBe(2);
    const acik = kareler().filter((k) => k.classList.contains('is-on'));
    expect(acik.length).toBe(1);
    expect(acik[0].style.backgroundImage).toContain('assets/karsilama/karsilama-');
  });

  test('kap yoksa FALSE döner, hata atmaz', () => {
    document.body.innerHTML = '';
    expect(veWelcomeSlaytBaslat()).toBe(false);
  });

  test('kare listesi boşsa kap temizlenir ve FALSE döner', () => {
    const yedek = global.VE_KARSILAMA_GORSELLER;
    global.VE_KARSILAMA_GORSELLER = [];
    expect(veWelcomeSlaytBaslat()).toBe(false);
    expect(kap().innerHTML).toBe('');
    global.VE_KARSILAMA_GORSELLER = yedek;
  });

  test('sıra KARIŞTIRILIYOR — liste sırası korunmuyor', () => {
    // Math.random sabitlenince Fisher-Yates deterministik: sonuç liste sırası OLMAMALI.
    const gercek = Math.random;
    Math.random = () => 0.42;
    const ilkKare = [];
    for (let i = 0; i < 6; i++) { veWelcomeSlaytBaslat(); 
      ilkKare.push(kareler().find((k) => k.classList.contains('is-on')).style.backgroundImage); }
    Math.random = gercek;
    // Karılmamış olsaydı her seferinde listenin ilk karesi çıkardı.
    expect(ilkKare[0]).not.toContain(LISTE[0]);
  });

  test('karılan liste bir PERMÜTASYON — kare kaybolmuyor, çoğalmıyor', () => {
    const gercek = Math.random;
    let n = 0;
    Math.random = () => ((n = (n * 9301 + 49297) % 233280) / 233280);
    const k = _veSlaytKarilmis();
    Math.random = gercek;
    expect(k.slice().sort()).toEqual(LISTE.slice().sort());
  });
});

// ═══ 5) ZAMANLAYICI ════════════════════════════════════════════════════════
describe('Zamanlayıcı — sızıntı ve gereksiz koşu yok', () => {
  test('hareket kapalıyken zamanlayıcı KURULMAZ (tek kare durur)', () => {
    hareketKapali = true;
    const spy = jest.spyOn(global, 'setInterval');
    expect(veWelcomeSlaytBaslat()).toBe(true);
    expect(spy).not.toHaveBeenCalled();
    spy.mockRestore();
  });

  test('iki kez başlatmak iki zamanlayıcı BIRAKMAZ', () => {
    const temizle = jest.spyOn(global, 'clearInterval');
    veWelcomeSlaytBaslat();
    veWelcomeSlaytBaslat();
    expect(temizle).toHaveBeenCalled();       // ikinci başlatış öncekini kapatıyor
    temizle.mockRestore();
  });

  test('modül seçilince (karşılama gizlenince) slayt durur', () => {
    document.getElementById('ve-module-overlay').style.display = '';
    veSyncModuleShell();                      // karşılama görünür → slayt döner
    const temizle = jest.spyOn(global, 'clearInterval');
    document.getElementById('ve-module-overlay').style.display = 'none';
    veSyncModuleShell();                      // modül seçildi → durmalı
    expect(temizle).toHaveBeenCalled();
    temizle.mockRestore();
  });
});

// ═══ 6) NETLİK VE TEMPO ════════════════════════════════════════════════════
// Kullanıcı iki kez "resimler orijinal kalitesinde değil" dedi. Ölçüldü:
// boru hattı KAYIPSIZ (24 karenin tamamı docs/gorseller ile bayt bayt aynı,
// build.js yeniden kodlamıyor) — yumuşama iki yerden geliyor:
//   (a) kaynak çözünürlüğü: 24 karenin 14'ü 1015–1600 px, kutu 1600 px+
//   (b) CSS'in KENDİ eklediği büyütme — tek düzeltilebilir olan bu
// Buradaki kapılar (b)'yi tutuyor. Bozulunca ekran yine açılır, resim yalnız
// yumuşar; hiçbir uyarı çıkmaz.
// Yorumları at: bu bölümdeki gerekçeler kuralların KENDİ değerlerini metin
// olarak anıyor ("eskiden -3%'ti", "feConvolveMatrix denendi") ve çıplak bir
// desen yorumu bildirim sanıp kapıyı sessizce kapatıyor.
const yorumsuz = (t) => t.replace(/\/\*[\s\S]*?\*\//g, '');
const CSS_Y = yorumsuz(CSS);

describe('CSS — kareyi gereksiz büyütmüyor', () => {
  const KARE = yorumsuz(CSS.slice(CSS.indexOf('.ve-welcome-kare{'), CSS.indexOf('.ve-welcome-kare.is-on{')));

  test('kare kutusundan BÜYÜK değil (inset negatif olamaz)', () => {
    // inset:-3% "Ken Burns'ün payı" diye konmuştu ama gereksizdi: yakınlaşma
    // merkeze göre ve ölçek her an >= 1, kenarda boşluk açılamıyor. Bedeli
    // ölçüldü: %6 fazladan büyütme, netlikte (Laplace varyansı) %14,3 kayıp.
    const m = KARE.match(/inset:\s*([^;]+);/);
    expect(m).toBeTruthy();
    expect(m[1].trim()).toBe('0');
  });

  test('Ken Burns 1\'den BAŞLAR — kare geldiği an en net hâlinde', () => {
    // Ters yönde (1.05 -> 1) kare tam göründüğü anda en büyütülmüş, yani en
    // yumuşak hâlindeydi; en net anına ancak kaybolurken ulaşıyordu.
    const i = CSS_Y.indexOf('@keyframes ve-slayt-kb{');
    expect(i).toBeGreaterThan(-1);
    const kb = CSS_Y.slice(i, CSS_Y.indexOf('\n}', i));
    const bas = kb.match(/from\{\s*transform:scale\(([\d.]+)\)/);
    const bit = kb.match(/to\{\s*transform:scale\(([\d.]+)\)/);
    expect(parseFloat(bas[1])).toBe(1);
    expect(parseFloat(bit[1])).toBeGreaterThan(1);
  });

  test('kareye SVG süzgeci bağlanmamış — ölçülmüş bir REDDEDİŞ', () => {
    // feConvolveMatrix ile keskinleştirme denendi: görüntüde işe yarıyordu
    // (en zor karede Laplace varyansı x3,4, halesiz) ama Chromium süzgeci HER
    // karede yeniden koşturuyor. Ortanca kare süresi 16,7 ms -> ~295 ms, yani
    // 60 fps -> ~3 fps; yalnız Ken Burns değil çapraz geçiş de tetikliyor.
    expect(KARE).not.toMatch(/filter:[^;]*url\(/);
    expect(CSS_Y).not.toContain('feConvolveMatrix');
  });
});

describe('Tempo — bekleme (js) ile geçiş (css) tutarlı', () => {
  const bekleme = parseInt(COMP.match(/var VE_SLAYT_BEKLEME = (\d+);/)[1], 10);
  const gecis = parseInt(CSS_Y.match(/--dur-slayt-gecis:\s*(\d+)ms/)[1], 10);
  const kb = parseInt(CSS_Y.match(/--dur-slayt-kb:\s*(\d+)s/)[1], 10) * 1000;

  test('geçiş beklemeden KISA — yoksa kare oturmadan bir sonraki başlar', () => {
    // İkisi AYRI dosyada: biri değişip öteki unutulursa slayt sürekli iki
    // resmin ortasında görünür. Bugün 11000 > 2600.
    expect(gecis).toBeLessThan(bekleme);
    expect(bekleme - gecis).toBeGreaterThanOrEqual(4000);   // kare gerçekten dursun
  });

  test('Ken Burns karenin ömründen UZUN — yakınlaşma bitip donmaz', () => {
    // Kare ekranda bekleme + geçiş kadar kalıyor; animasyon `forwards` olduğu
    // için daha kısa olsaydı son saniyeler donmuş bir yakın plan olurdu.
    expect(kb).toBeGreaterThan(bekleme + gecis);
  });
});

// ═══ 6) GÖRSEL KATMAN KURALLARI ════════════════════════════════════════════
describe('CSS — okunurluk ve kırpma', () => {
  // Slayt artık SAĞ SÜTUNUN değil, karşılamanın kendi çocuğu (P4): fotoğraf
  // sol panelin de altından geçiyor. Kırpma kabın kendisine düştü — düşerse
  // Ken Burns kareyi ekranın dışına taşırır ve kaydırma çubuğu açar.
  test('karşılama kabı konumlanmış ve taşmayı kırpıyor (Ken Burns sızmasın)', () => {
    const blok = CSS.slice(CSS.indexOf('.ve-welcome{'), CSS.indexOf('@keyframes ve-welcome-in'));
    expect(blok).toMatch(/position:\s*relative/);
    expect(blok).toMatch(/overflow:\s*hidden/);
  });

  test('kart slaytın ÜSTÜNDE ve akıştan ÇIKMIŞ (Vitrin)', () => {
    const blok = CSS.slice(CSS.indexOf('.ve-welcome-id{'), CSS.indexOf('.ve-welcome-logo{'));
    expect(blok).toMatch(/z-index:\s*1/);
    expect(blok).toMatch(/position:\s*absolute/);
  });

  // Kart TRANSFORM'la ortalanamaz: giriş koreografisi
  // (.ve-welcome-enter .ve-welcome-id) transform'u kullanıyor ve `both`
  // doldurmasıyla bitiş karesini kalıcı kılıp ortalamayı eziyor. Ölçüldü:
  // üst kenar y=450 çıkıyordu, olması gereken 134. Sessiz — kart yalnızca
  // aşağı kayıyor, hata yok.
  test('kart MARJLA ortalanıyor, transform ile DEĞİL', () => {
    const blok = yorumsuz(CSS.slice(CSS.indexOf('.ve-welcome-id{'), CSS.indexOf('.ve-welcome-logo{')));
    expect(blok).toMatch(/margin-top:\s*auto/);
    expect(blok).toMatch(/margin-bottom:\s*auto/);
    expect(blok).not.toMatch(/transform:/);
  });

  // Kısa pencerede (ör. 1440×620) kart ekrandan taşıyor ve alttaki
  // "Kayıtlı proje aç" / Kılavuzlar / Ayarlar / künye ULAŞILAMAZ kalıyordu:
  // kaplamanın kaydırması kartın DIŞINDA. Kaydırma kartın içine indi.
  test('kart pencereye sığmazsa KENDİ İÇİNDE kayıyor', () => {
    const blok = yorumsuz(CSS.slice(CSS.indexOf('.ve-welcome-id{'), CSS.indexOf('.ve-welcome-logo{')));
    expect(blok).toMatch(/max-height:\s*calc\(100% -/);
    expect(blok).toMatch(/overflow:\s*auto/);
  });

  // Reçete (kullanıcı, 2026-09-08): "örtü %0 · resim %100 · keskin ·
  // cam %25 / net". Dördü de tek jetondan sürülüyor; biri elle ezilirse
  // ekran yine açılır, yalnız başka bir ekran olur.
  test('reçete jetonları: örtü 0, resim tam, bulanıklık yok, cam %25', () => {
    // Satır başına ÇİVİLİ + noktalı virgülle biter: gevşek desen aynı adı
    // geçiren bir YORUMU da yakalıyor ve kapı sessizce kapanıyordu.
    expect(CSS).toMatch(/^\s*--slayt-ortu:\s*0%;/m);
    expect(CSS).toMatch(/^\s*--slayt-opaklik:\s*1;/m);
    expect(CSS).toMatch(/^\s*--slayt-bulanik:\s*0px;/m);
    expect(CSS).toMatch(/^\s*--karsilama-cam:\s*42%;/m);
  });

  test('kart camı: OPAK yedek ÖNCE, cam payı sonra; bulanıklık jetondan', () => {
    const blok = CSS.slice(CSS.indexOf('.ve-welcome-id{'), CSS.indexOf('.ve-welcome-logo{'));
    // color-mix desteklenmeyen tarayıcıda kart opak kalmalı — yoksa metin
    // fotoğrafın üstünde çıplak kalır.
    const yedek = blok.indexOf('background:var(--bg-secondary);');
    const cam = blok.indexOf('background:color-mix(');
    expect(yedek).toBeGreaterThan(-1);
    expect(cam).toBeGreaterThan(yedek);
    expect(blok).toContain('var(--karsilama-cam)');
    // Buzlu cam Vitrin'in kendisi. Ölçüldü: durgun bir yüzeyde bedeli küçük
    // (ortanca kare süresi 16,9 → 20,6 ms), feConvolveMatrix'in ~295 ms'i değil.
    // Satır başına ÇİVİLİ: gevşek desen `-webkit-backdrop-filter`in içine de
    // uyuyor ve standart bildirim silinince kapı sessizce açık kalıyordu.
    expect(blok).toMatch(/(^|\n)\s*backdrop-filter:blur\(var\(--karsilama-cam-blur\)\)/);
    expect(blok).toMatch(/(^|\n)\s*-webkit-backdrop-filter:blur\(/);   // Safari
    expect(CSS).toMatch(/^\s*--karsilama-cam-blur:\s*\d+px;/m);
  });

  // Kart fotoğrafın üstünde yüzüyor: gölge her iki temada da KOYU olmalı.
  // --shadow-color açık temalarda 0,06 alfa — kâğıt üstünde doğru, fotoğraf
  // üstünde gölge diye okunmuyor.
  test('kart gölgesi kendi jetonundan — tema gölgesine bağlı DEĞİL', () => {
    const blok = yorumsuz(CSS.slice(CSS.indexOf('.ve-welcome-id{'), CSS.indexOf('.ve-welcome-logo{')));
    expect(blok).toContain('box-shadow:var(--karsilama-kart-golge)');
    expect(blok).not.toContain('var(--shadow-color)');
    expect(CSS).toMatch(/^\s*--karsilama-kart-golge:\s*[^;]+rgba\(0, ?0, ?0/m);
  });

  test('örtü TEMA JETONUNDAN türer — sabit renk yazılmaz', () => {
    const ortu = CSS.slice(CSS.indexOf('.ve-welcome-slayt::after{'));
    const blok = ortu.slice(0, ortu.indexOf('}\n'));
    expect(blok).toContain('var(--bg-primary)');
    expect(blok).not.toMatch(/#[0-9a-f]{3,8}\b/i);
  });

  test('hareket kapalıyken kare hareketi duruyor', () => {
    expect(CSS).toMatch(/prefers-reduced-motion[\s\S]{0,400}\.ve-welcome-kare\.is-on\{[^}]*animation:\s*none/);
  });
});
