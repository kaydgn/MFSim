// ═══════════════════════════════════════════════════════════════════════════
// FEAD KULLANIM KILAVUZU — "Detaylı FEAD raporu" kozmetiğinde, yönlendirici
// ═══════════════════════════════════════════════════════════════════════════
//
// Belge kabuğu js/guide-kit.js'ten gelir ve kozmetiğini gömülü rapor
// şablonundan ÇIKARIR — yani bu dosyada tek satır CSS yok. Rapor teması bir kez
// güncellendiğinde kılavuz onunla birlikte güncellenir.
//
// ── BU BELGENİN RAPORDAN İKİ FARKI ─────────────────────────────────────────
//
// 1 · ÇÖZÜLMÜŞ MODEL GEREKTİRMEZ. Rapor bir SONUÇ belgesidir ve çözülmemiş
//     modelde indirmeyi reddeder. Kılavuz bir ÖĞRETİ belgesidir: tuval bomboşken
//     — kullanıcının ona en çok ihtiyaç duyduğu anda — okunabilmek zorundadır.
//
// 2 · ÖRNEĞİN SAYILARI ELLE YAZILMAZ. §14'teki işlenmiş örnek, kayıt
//     defterindeki `AG00976_GATES_2025` sistemini BELLEKTE kurup gerçek zinciri
//     (veFeadBuildSystem → FEADCore → veFeadAnalyze) koşturuyor ve çıkan
//     sayıları basıyor. Kullanıcının tuvaline dokunulmaz: `veFeadBuildSystem`
//     açık düğüm listesi kabul ediyor, `veFeadBuildFromCanvas` gibi global
//     `nodes` okumuyor.
//
//     Sayıları elle yazmak bu belgeyi ilk çekirdek değişikliğinde SESSİZCE
//     yanlış yapardı: kılavuz "kayış boyu 1715,39 mm çıkar" der, program başka
//     bir sayı verir, kullanıcı hangisinin doğru olduğunu bilemez. Canlı hesap
//     bu sınıfı yapısal olarak yok ediyor.
//
// Ad öneki `_gf…` / `veGuideFead…` (source-hygiene: `_fr` raporun, `_fsr`
// özetin, `_fead` sunumun, `_gk` kabuğun).

// Sayı biçimi ve kaçış RAPORDAN alınır (js/cp-fead-report.js) — ikinci bir
// kopya iki belgenin aynı sayıyı farklı basması demekti. Yükleme sırasından
// bağımsız olsun diye çağrı anında çözülüyor.
function _gfF(v, d){ return (typeof _frF === 'function') ? _frF(v, d) : String(v); }
function _gfFs(v, d){ return (typeof _frFs === 'function') ? _frFs(v, d) : String(v); }
function _gfE(s){ return (typeof _gkEsc === 'function') ? _gkEsc(s) : String(s); }

// Tablo / şekil sayaçları — her üretimde sıfırlanır (raporun kuralının aynısı:
// elle "Tablo 4" yazmak, araya bir tablo girdiğinde sessizce kayardı).
var _gfTblNo = 0, _gfFigNo = 0;
function _gfTbl(){ return ++_gfTblNo; }
function _gfFig(){ return ++_gfFigNo; }

// ── KÜÇÜK YAPI TAŞLARI (raporun sınıflarıyla) ──────────────────────────────

// Adım listesi. Kılavuzun omurgası bu: her bölüm "şunu yap, sonra bunu yap"
// diye ilerler. <ol> raporun kendi liste stilini kullanır.
function _gfAdimlar(satirlar){
  return '<ol>' + satirlar.map(function(s){ return '<li>' + s + '</li>'; }).join('') + '</ol>';
}

// Alan tablosu — kılavuzun en çok tekrarlanan bileşeni: hangi alan, ne yazılır,
// nereden bulunur. Üç sütun sabit; dördüncü sütun (not) isteğe bağlı.
function _gfAlanTablo(baslik, satirlar, basliklar){
  var b = basliklar || ['Alan', 'Ne yazılır', 'Nereden bulunur'];
  var h = '<table><caption>Tablo ' + _gfTbl() + ' — ' + _gfE(baslik) + '</caption>';
  h += '<tr>' + b.map(function(t){ return '<th>' + _gfE(t) + '</th>'; }).join('') + '</tr>';
  satirlar.forEach(function(r){
    // HER SÜTUN `td.l`. Raporun `td` VARSAYILANI BİR SAYIDIR: mono, sağa
    // dayalı ve `white-space:nowrap`. Kılavuzun alan tablolarında üç sütun da
    // cümledir; ilk sütun bir dönem `td.c` ile basılıyordu ve nowrap yüzünden
    // uzun alan adları tabloyu 393 px taşırıyordu (gerçek tarayıcıda ölçüldü).
    // Vurgu gereken yerde çağıran <strong> koyar — sınıf değil içerik işi.
    h += '<tr>' + r.map(function(c){
      return '<td class="l">' + c + '</td>';
    }).join('') + '</tr>';
  });
  return h + '</table>';
}

// Sayısal tablo — örnek bölümünde kullanılıyor; hücreler HAM verilir.
function _gfTablo(baslik, basliklar, satirlar, hizalar){
  var h = '<table><caption>Tablo ' + _gfTbl() + ' — ' + _gfE(baslik) + '</caption>';
  h += '<tr>' + basliklar.map(function(t){ return '<th>' + _gfE(t) + '</th>'; }).join('') + '</tr>';
  satirlar.forEach(function(r){
    h += '<tr>' + r.map(function(c, i){
      var cls = (hizalar && hizalar[i]) ? ' class="' + hizalar[i] + '"' : '';
      return '<td' + cls + '>' + c + '</td>';
    }).join('') + '</tr>';
  });
  return h + '</table>';
}

function _gfNot(baslik, govde){ return veGuideNote('', baslik, govde); }
function _gfUyari(baslik, govde){ return veGuideNote('warn', baslik, govde); }
function _gfOnay(baslik, govde){ return veGuideNote('check', baslik, govde); }

// ── BÖLÜM KİMLİKLERİ — içindekiler ve başlıklar TEK KAYNAKTAN ──────────────
// Raporun kendi kuralı: iki yerde yazılsa biri kayardı.
var VE_GUIDE_FEAD_SECTIONS = [
  ['g1',  '1',    'Bu Kılavuz Nasıl Kullanılır'],
  ['g2',  '2',    'Modülün Haritası'],
  ['g3',  '3',    'Modüle Girmek'],
  ['g4',  '4',    'Kasnakları Yerleştirmek'],
  ['g5',  '5',    'Kayış Yolunu Kablolamak'],
  ['g6',  '6',    'Kasnak Künyelerini Girmek'],
  ['g7',  '7',    'Otomatik Gergiyi Tanımlamak'],
  ['g8',  '8',    'Kayış Künyesi ve Katalog'],
  ['g9',  '9',    'Çalışma Çevrimi ve Motor Künyesi'],
  ['g10', '10',   'Modeli Çözmek'],
  ['g11', '11',   'Sonuçları Okumak'],
  ['g12', '12',   'Rapor Üretmek'],
  ['g13', '13',   'Sık Yapılan Hatalar'],
  ['g14', '14',   'Sayısal Örnek: Sıfırdan Bir FEAD Modeli'],
  ['gEk', 'Ek A', 'Alan → Panel Hızlı Başvurusu']
];

function _gfH2(i){
  var s = VE_GUIDE_FEAD_SECTIONS[i];
  return veGuideH2(s[0], s[1], s[2]);
}

// ═══════════════════════════════════════════════════════════════════════════
//  BÖLÜMLER
// ═══════════════════════════════════════════════════════════════════════════

function _gfSec1(){
  var h = _gfH2(0);
  h += '<p>Bu belge, MFSim’in <strong>FEAD</strong> (Front End Accessory Drive — ön uç '
    + 'aksesuar kayış tahriki) modülünü kullanarak bir serpantin kayış sistemini modelleme '
    + 'işini <strong>adım adım</strong> anlatır. Bölümler programda izleyeceğiniz sırayla '
    + 'dizilmiştir: baştan sona okuyup uygularsanız çalışan bir modeliniz olur.</p>';
  h += '<p>Her bölüm aynı düzendedir: önce <em>ne yapacağınız</em> numaralı adımlarla, sonra '
    + '<em>hangi alana ne yazacağınız</em> bir tabloyla, en sonda da o adımda sessizce yanlış '
    + 'gidebilecek şeyler bir uyarı kutusuyla verilir. Uyarı kutularını atlamayın: bu modülde '
    + 'yanlış girilen bir alan çoğu zaman <strong>hata vermez</strong> — model yine çözülür, '
    + 'tablolar yine dolar, yalnızca sayılar başkadır.</p>';
  h += '<p><strong>Bölüm 14</strong> bütün kılavuzu tek bir örnek üzerinde tekrarlar: boş bir '
    + 'tuvalden başlayıp gerçek bir aracın FEAD sistemini kurar ve çıkan sayıları kayış '
    + 'tedarikçisinin kendi raporuyla karşılaştırır. Aceleniz varsa önce oraya bakın, sonra '
    + 'ilgili bölüme dönün.</p>';
  h += _gfNot('Bu belgedeki sayılar ölçülmüştür',
      'Bölüm 14’teki bütün değerler, belge üretilirken programın <strong>gerçek hesap '
    + 'zinciri</strong> koşturularak hesaplanır — kılavuza elle yazılmış tek bir sonuç yoktur. '
    + 'Çekirdek bir gün değişirse bu belgedeki sayılar da onunla değişir; kılavuz yapısal '
    + 'olarak bayatlayamaz. Örnek <strong>bellekte</strong> kurulur, açık olan projenize '
    + 'dokunmaz.');
  h += '<h3>1.1 Kim için</h3>';
  h += '<p>Kayış tahrik yerleşimi yapan, tedarikçiye gönderilecek bilgi sayfasını hazırlayan '
    + 'ya da tedarikçiden dönen raporu doğrulamak isteyen makine mühendisi için yazıldı. '
    + 'Kayış–kasnak teorisini bilmek gerekmez; gereken teori, üretilen '
    + '<strong>Detaylı FEAD raporunun</strong> 1–7. bölümlerinde ayrıca anlatılır.</p>';
  h += '<h3>1.2 Ne kadar sürer</h3>';
  h += '<p>Elinizde kasnak koordinatları, çaplar ve gergi künyesi varsa altı kasnaklı bir '
    + 'sistem <strong>15–20 dakikada</strong> kurulur. Hazır bir örnekten başlarsanız '
    + '(Bölüm 3.2) bir dakikada çözülmüş bir model elde eder, üzerinde değişiklik yaparak '
    + 'öğrenirsiniz — ilk kez kullanıyorsanız önerilen yol budur.</p>';
  return h;
}

function _gfSec2(){
  var h = _gfH2(1);
  h += '<p>FEAD modülünde <strong>dört çalışma yüzeyi</strong> vardır. Hangi bilginin nerede '
    + 'durduğunu bilmek, kılavuzun geri kalanını takip etmeyi kolaylaştırır.</p>';
  h += _gfAlanTablo('Dört çalışma yüzeyi ve sorumlulukları', [
    ['Tuval', 'Kasnaklar, aralarındaki kayış telleri ve araç kutuları. <strong>Tuval bir blok '
      + 'diyagramı değil, kayış düzleminin kendisidir</strong>: 1 px = 1 mm, orijin sürücü '
      + 'kasnaktır. Bir kutuyu sürüklemek kasnağı gerçekten kaydırır.',
      'Bölüm 4 ve 5'],
    ['Paneller', 'Bir kutuya çift tıklayınca açılan özellik pencereleri. Bütün sayısal '
      + 'girdiler buradan girilir.', 'Bölüm 6–9'],
    ['Kayış Yolu kartı', 'Tuvalin üstünde duran, girdi değiştikçe <strong>canlı</strong> '
      + 'yeniden çizilen ölçekli şema. Modelin tutarlı olup olmadığını panel açmadan '
      + 'gösterir.', 'Bölüm 11.1'],
    ['Rapor', 'Tek dosyalık, çevrimdışı açılan HTML belge. İki tür: Detaylı ve Özet.',
      'Bölüm 12']
  ], ['Yüzey', 'Ne taşır', 'Kılavuzda']);
  h += '<h3>2.1 Renk dili — mavi girdi, amber türeyen</h3>';
  h += '<p>Tuvaldeki rozetlerde ve panellerde renk anlam taşır ve kılavuz boyunca aynı '
    + 'anlamı korur:</p>';
  h += '<ul>'
    + '<li><strong>Mavi</strong> — bu bir <em>girdidir</em>, siz yazarsınız.</li>'
    + '<li><strong>Amber</strong> — bu bir <em>türeyen</em> değerdir, program hesaplar.</li>'
    + '<li><strong>Kırmızı</strong> — hesabı doğrudan bozan, hata vermeden yanlış sonuç '
    + 'üretebilecek alan.</li>'
    + '</ul>';
  h += '<h3>2.2 Neyi siz verirsiniz, neyi program hesaplar</h3>';
  h += '<p>Modülün son sürümünde girdi kümesi bilinçli olarak küçültüldü. Aynı bilgiyi iki '
    + 'ayrı yerden sormak (gergi kasnağının merkezi <em>ve</em> pivotu; kayış boyu <em>ve</em> '
    + 'kol açısı; tasarım gerginliği <em>ve</em> yay künyesi) çeliştiğinde modeli sessizce '
    + 'yanlış çözüyordu. Bugün her büyüklüğün tek bir kaynağı var.</p>';
  h += _gfAlanTablo('Girdi / türeyen ayrımı', [
    ['Kasnaklar', 'merkez koordinatı (X, Y) · dış çap · temas tarafı · sürücü rolü',
      'teğet noktaları · sarım açıları · açıklık boyları · hız oranları'],
    ['Gergi', '<strong>montaj cıvatası koordinatı (pivot)</strong> · kol boyu · yay künyesi',
      '<strong>kol çalışma açısı</strong> → kasnak merkezi → <strong>kayış boyu</strong> → '
      + 'tasarım gerginliği'],
    ['Kayış', 'profil (PK / PJ / PH / PL / PM) ve marka',
      'gereken efektif boy · katalogdan uygun aday boylar'],
    ['Çalışma çevrimi', 'devir · %zaman · sıcaklık · aksesuar başına kW',
      'sürücü gücü · açıklık gerilmeleri · hubload · kayma emniyeti · titreşim']
  ], ['Konu', 'Siz verirsiniz', 'Program hesaplar']);
  h += _gfNot('Yön neden bu şekilde',
      'Montajda <strong>sabit</strong> olan gergi gövdesinin cıvatalandığı noktadır; gergi '
    + 'kasnağının merkezi ise kolun o anki açısıyla değişen bir konumdur. Program sabit olanı '
    + 'sorar, değişkeni hesaplar. Kayış boyu da bu zincirin sonunda bir <strong>sonuç</strong> '
    + 'olarak çıkar — çünkü tasarım aşamasında kayış henüz seçilmemiştir.');
  return h;
}

function _gfSec3(){
  var h = _gfH2(2);
  h += '<h3>3.1 Modülü açmak</h3>';
  h += _gfAdimlar([
    'Karşılama ekranında <strong>FEAD</strong> kartına tıklayın. Ana tuvale tek bir '
      + 'alt-sistem kutusu düşer.',
    'O kutuya <strong>çift tıklayın</strong>. Modülün iç topolojisi açılır; sol paletteki '
      + 'bileşen listesi FEAD bileşenlerine döner ve üstte bir gezinme çipi belirir.',
    'İç topolojiden çıkmak için aynı çipi ya da çerçevenin alt kenarındaki çıkış düğmesini '
      + 'kullanın. Çıkarken modeliniz alt-sistem kutusunun içine kaydedilir.'
  ]);
  h += '<p>İç topoloji boşken tuvalde <strong>iki açılış kutusu</strong> gelir: '
    + '<strong>Başlangıç Sihirbazı</strong> ve <strong>Başlangıç ve Örnekler</strong>. '
    + 'İkisi farklı soruya cevap verir — biri “kendi motorumun verisini nasıl gireceğim”, '
    + 'öbürü “çalışan bir model neye benziyor”. Buradan üç yol ayrılır.</p>';

  h += '<h3>3.2 Yol A — Başlangıç Sihirbazı <span class="chip">önerilen</span></h3>';
  h += '<p>Sihirbaz, bir modeli kurmak için gereken bütün girdileri <strong>doğru sırayla</strong> '
    + 'sorar ve her adımda modeli canlı doğrular. Boş bir iç topolojide “önce ne koyayım” '
    + 'sorusunu ortadan kaldırır.</p>';
  h += _gfAdimlar([
    '<strong>Başlangıç Sihirbazı</strong> kutusuna çift tıklayın.',
    'Adımları sırayla doldurun. Her adımın rozeti o adımda kalan eksik/uyarı sayısını '
      + 'gösterir, yani nereye dönmeniz gerektiğini okursunuz.',
    'Son adımda canlı çözümü ve kayış yolu şemasını görün, sonra <strong>modeli kurun</strong> '
      + '— sihirbaz kasnakları, kabloları ve künyeleri iç topolojiye bir anda yazar.'
  ]);
  h += _gfAlanTablo('Sihirbaz adımları ↔ bu kılavuzun bölümleri', [
    ['1 · Başlangıç', 'Sistem adı ve gerginin tanım biçimi', '—'],
    ['2 · Kasnaklar', 'Tip · çap · koordinat · temas tarafı · sürücü', 'Bölüm 4 ve 6'],
    ['3 · Kayış Yolu', 'Serpantin sırası — kablolamayı bu belirler', 'Bölüm 5'],
    ['4 · Otomatik Gergi', 'Montaj referans noktası · kol boyu · yay künyesi', 'Bölüm 7'],
    ['5 · Kayış', 'Profil · kanal sayısı · katalog sonuçları', 'Bölüm 8'],
    ['6 · Motor ve Çevrim', 'Tahrik oranı · motor künyesi · çalışma çevrimi', 'Bölüm 9'],
    ['7 · Özet ve Kurulum', 'Canlı çözüm · kayış yolu şeması · modeli kur', 'Bölüm 10 ve 11']
  ], ['Adım', 'Ne sorar', 'Ayrıntısı']);
  h += _gfNot('Sihirbaz ayrı bir model kurmaz',
      'Sorduğu her alan panellerdeki alanların ta kendisidir ve doğrulamayı da aynı çözücü '
    + 'yapar. Yani sihirbazda gördüğünüz uyarı, panelde göreceğinizin aynısıdır — kurulduktan '
    + 'sonra her şeyi panellerden düzenlemeye devam edersiniz.');

  h += '<h3>3.3 Yol B — hazır bir örnekten başlamak</h3>';
  h += _gfAdimlar([
    '<strong>Başlangıç ve Örnekler</strong> kutusuna çift tıklayın.',
    'Panelde iki kayıtlı sistem görürsünüz. Birini seçip <strong>“İç topolojiye kur”</strong> '
      + 'düğmesine basın.',
    'Kasnaklar, kayış telleri, gergi künyesi, kayış künyesi ve çalışma çevrimi bir anda kurulur. '
      + '“Başlangıç ve Örnekler” kutusu silinir, yerine <strong>Rapor</strong> kutusu gelir — '
      + 'model kullanıma hazırdır.'
  ]);
  h += _gfAlanTablo('Kayıtlı örnekler', [
    ['<code>BMC_FEAD_2026</code>', 'Tedarikçiye <em>giden</em> bilgi sayfası (FEAD_INFORMATION). '
      + 'Gergi satırı kasnak merkezini verir, pivot yoktur.',
      'Bilgi sayfası biçimini öğrenmek için'],
    ['<code>AG00976_GATES_2025</code>', 'Tedarikçiden <em>dönen</em> rapor. Gergi pivotunu, '
      + 'kayış toleransını ve aşınma payını taşır.',
      'Doğrulama yapmak, rapor sayılarını geri üretmek için']
  ], ['Örnek', 'Nedir', 'Ne zaman kullanılır']);
  h += _gfUyari('Örnek eklenir, silmez',
      'Örnek yükleme mevcut kasnakların <strong>üzerine ekler</strong>. Dolu bir tuvale ikinci '
    + 'bir örnek kurmak kasnakları üst üste bindirir. Temiz bir başlangıç için önce '
    + 'tuvali boşaltın.');
  h += '<h3>3.4 Yol C — sıfırdan elle kurmak</h3>';
  h += '<p>Sol paletten sürükleyip bırakın. FEAD bileşenleri iki kategoridedir:</p>';
  h += _gfAlanTablo('Palet kategorileri', [
    ['FEAD Kasnakları', 'Krank Kasnağı · Alternatör · Klima Kompresörü · Su Pompası · '
      + 'Direksiyon Pompası · Hava Kompresörü · Fan Kavraması · Avara Kasnak · Gergi',
      'Kayış yoluna giren, konumu ve çapı olan bileşenler'],
    ['FEAD Araçları', 'Kayış Özellikleri · Kayış Yolu · Çözücü · Rapor · Başlangıç ve Örnekler '
      + '· Dönüş Yönü · Konum Bağı',
      'Kayış yoluna girmez, bağlantısı yoktur; ayar ve okuma yüzeyleridir']
  ], ['Kategori', 'İçerdikleri', 'Ne işe yarar']);
  h += '<p>Bir modeli kurmak için en az şunlar gerekir: <strong>üç kasnak</strong> (biri sürücü, '
    + 'biri gergi), <strong>Kayış Özellikleri</strong>, <strong>Çözücü</strong>. Kayış Yolu '
    + 'kartını ve Raporu istediğiniz zaman ekleyebilirsiniz.</p>';
  return h;
}

function _gfSec4(){
  var h = _gfH2(3);
  h += '<p>Kasnakları tedarikçi bilgi sayfasındaki koordinat tablosunun sırasına göre bırakın; '
    + 'kaba yerleşim yeterlidir, ince ayarı panelden yaparsınız.</p>';
  h += _gfAdimlar([
    'Paletten kasnak tiplerini tuvale sürükleyin. Tip yalnızca sembolü ve varsayılan temas '
      + 'tarafını belirler — hesaba giren şey <em>çap</em> ve <em>konumdur</em>.',
    'Bir kasnağın adını değiştirmek için kutuya sağ tıklayıp <strong>Yeniden Adlandır</strong> '
      + 'deyin. Adlar sonuç tablolarında sütun başlığı olur; kısa ve ayırt edici seçin.',
    'Kasnakları yaklaşık gerçek yerlerine yerleştirin. Tuval kayış düzlemi olduğu için '
      + 'gördüğünüz yerleşim modelin ta kendisidir.'
  ]);
  h += '<h3>4.1 Tuval kayış düzlemidir</h3>';
  h += _gfAlanTablo('Tuval ↔ model ilişkisi', [
    ['Ölçek', '1 piksel = 1 milimetre', 'Hassasiyet yakınlaştırmadan gelir; konum 0,01 mm’ye '
      + 'yuvarlanır'],
    ['Orijin', 'Sürücü kasnak', 'Rol, tip değil — sürücü kim işaretlenmişse orijin odur'],
    ['Y ekseni', 'Tuvalde aşağı, milimetrede yukarı', 'Program çevirir; siz sayfadaki '
      + 'koordinatı olduğu gibi yazarsınız'],
    ['Sürükleme', 'Kasnağı kayış düzleminde taşır', 'Kayış Yolu kartı ve gereken kayış boyu '
      + 'anında güncellenir']
  ], ['Konu', 'Kural', 'Not']);
  h += '<h3>4.2 Kutuları modeli bozmadan dizmek — Konum Bağı</h3>';
  h += '<p>Bağ açıkken kutular fiziksel yerlerinde durmak zorundadır, yani okunurluk için '
    + 'kaydırılamazlar. Bunu istemiyorsanız:</p>';
  h += _gfAdimlar([
    'Paletten <strong>Konum Bağı</strong> kutusunu tuvale bırakın (bir kopya yeter).',
    'Üzerindeki rozete tıklayın. <strong>AÇIK</strong> (amber) ↔ <strong>KAPALI</strong> '
      + '(mavi) arasında geçer.',
    'Kapalıyken kutuları istediğiniz gibi dizebilirsiniz; koordinat yalnız panelden girilir '
      + 've kutu yerinden oynamaz.',
    'Yeniden açtığınızda kutular koordinatlarına <strong>geri döner</strong> — model doğrudur, '
      + 'diziliş geçicidir.'
  ]);
  h += _gfUyari('Konum Bağı kapalıyken kasnak paneli farklı davranır',
      'X/Y alanlarına yazdığınız değer modele işler ama <strong>kutu yerinden oynamaz</strong>. '
    + 'Panel bunu ayrıca yazar. Bağ düğümünü silerseniz bağ açılır ve kutular koordinatlarına '
    + 'oturtulur; bu uzlaştırma yapılmasaydı sonraki ilk sürükleme birikmiş kaymanın tamamını '
    + 'tek karede modele yazardı.');
  return h;
}

function _gfSec5(){
  var h = _gfH2(4);
  h += '<p>Kasnaklar arasına çektiğiniz tel <strong>kayışın kendisidir</strong> ve sırası '
    + 'serpantin sırasıdır: sürücü kasnağın çıkışından başlar, halkayı dolaşır, aynı kasnağın '
    + 'girişine döner. Çevrim <strong>kapanmak zorundadır</strong>.</p>';
  h += _gfAdimlar([
    'Bir kasnağın <strong>çıkış portuna</strong> tıklayın, sonra kayış sırasında ondan sonra '
      + 'gelen kasnağın <strong>giriş portuna</strong> tıklayın. Tel kurulur.',
    'Bunu halka kapanana kadar sürdürün: son kasnağın çıkışı ilk kasnağın girişine bağlanmalı.',
    'Telin ortasındaki ok <strong>gidiş yönünü</strong> gösterir. Yön, kabloları hangi sırada '
      + 'çektiğinizin sonucudur; ayrı bir ayar değildir.',
    'Bir teli silmek için üzerine sağ tıklayın.'
  ]);
  h += _gfNot('Port kenarları komşuya bakar',
      'FEAD kasnaklarında portlar klasik “giriş solda, çıkış sağda” kuralını izlemez: bir '
    + 'çevrimde bu kural yolun yarısında ters düşerdi. Portlar <strong>komşu kasnağa bakan '
    + 'kenardan</strong> çıkar. Yanlış bir port çiftine tıklarsanız (iki çıkış, iki giriş ya '
    + 'da kasnağın kendisi) bağlantı kurulmaz ve program sebebini yazar.');
  h += '<h3>5.1 Dönüş yönünü çevirmek</h3>';
  h += _gfAdimlar([
    'Paletten <strong>Dönüş Yönü</strong> kutusunu tuvale bırakın.',
    'Rozetine tıklayın: <code>↺ CCW</code> ↔ <code>↻ CW</code>. Kablolar yerinde çevrilir.',
    'Rozetin <strong>rengine</strong> bakın — durumu glif, hükmü renk taşır.'
  ]);
  h += _gfAlanTablo('Dönüş Yönü rozetinin rengi', [
    ['Yeşil', 'Gergi kayışın <strong>gevşek</strong> tarafında', 'Doğru yerleşim — devam edin'],
    ['Kırmızı', 'Gergi kayışın <strong>gergin</strong> tarafında', 'Yönü çevirin ya da gergiyi '
      + 'kayış sırasında sürücünün önüne alın'],
    ['Nötr', 'Henüz çözüm yok', 'Model tamamlanınca renk gelir']
  ], ['Renk', 'Ne demek', 'Ne yapmalı']);
  h += _gfUyari('Ters yerleşim hata vermez',
      'Gergi gergin tarafa düştüğünde geometri <strong>kusursuz çözülür</strong>: kapalı çevrim '
    + 'tutar, Σ sarım yine 360° çıkar, kart yeşil görünür. Bozulan tek şey gerilme zinciridir — '
    + 'açıklık gerilmeleri ankrajın altına iner ve bir kısmı negatife döner. Ölçülen 14 '
    + 'tedarikçi sisteminin <strong>14’ünde de</strong> gergi gevşek taraftadır; istisna yoktur. '
    + 'Bu durumda program kayma emniyeti hükmü de <strong>vermez</strong>: çöken bir zincirde '
    + 'çıkan emniyet faktörü bir marj değil, sayısal bir gölgedir.');
  h += '<h3>5.2 Modelin kurulu olduğunu doğrulamak</h3>';
  h += '<p>Kayış Yolu kartının alt şeridine bakın. Orada <strong>✓</strong>, kasnak sayısı, '
    + 'efektif kayış boyu ve <strong>Σ sarım</strong> yazar. Σ sarım <strong>360,00°</strong> '
    + 'olmak zorundadır. Kart bunun yerine bir sebep yazıyorsa (“Kayış yoluna bağlı olmayan '
    + 'kasnak var: …”, “Kayış yolu KAPANMIYOR”) önce onu giderin.</p>';
  return h;
}

function _gfSec6(){
  var h = _gfH2(5);
  h += '<p>Her kasnağa çift tıklayın ve künyesini girin. Sıra önemli değildir, ama '
    + '<strong>temas tarafıyla başlamak</strong> iyi bir alışkanlıktır: hesabı en çok etkileyen '
    + 've en sessiz biçimde yanlış girilebilen alan odur.</p>';
  h += _gfAlanTablo('Kasnak paneli — alanlar', [
    ['Temas Tarafı', '“Kaburgalı yüzden değiyor” ya da “Sırttan değiyor”',
      'Yerleşim çiziminden okunur. Aksesuarlar tipik olarak kaburgalı, avara ve gergi sırttan '
      + 'temas eder.'],
    ['Dış çap (OD)', 'Kasnağın dış çapı, mm', 'Koordinat tablosu. <strong>Pitch çapı '
      + 'girilmez</strong> — program onu kayış profilinden türetir.'],
    ['Konum X', 'Kayış düzleminde merkez, mm', 'Koordinat tablosu; orijin sürücü kasnaktır'],
    ['Konum Y', 'Kayış düzleminde merkez, mm', 'Aynı tablo; işareti sayfadaki gibi yazın'],
    ['Sürücü kasnak', 'Tek kasnakta işaretlenir', 'Kayışı hangi kasnağın döndürdüğü. Bir '
      + '<strong>roldür</strong>, tip değil: ikincil tahrikte fan kasnağı da sürücü olabilir.'],
    ['Atalet J', 'kg·m²', 'Tepe yük ve burulma titreşimi hesabına girer'],
    ['Katalog Modeli', 'Alternatör / klima / hava kompresörü için hazır devir → kW eğrisi',
      'Araç Performans modülüyle ortak katalog'],
    ['Güç Eğrisi', 'Aksesuar devri → kW tablosu', 'Bilgi sayfasındaki grafiğin altındaki '
      + 'tablo. Girilirse <strong>katalog modelinin önüne geçer</strong>.']
  ]);
  h += _gfUyari('Temas tarafı — hata vermeyen alan',
      'Ters verirseniz program <strong>geçerli ama başka</strong> bir kayış yolu çözer. '
    + 'Kapalı çevrim tutar, sarım değişmezi tutar, hiçbir uyarı çıkmaz — ne kod ne göz yakalar. '
    + 'Ölçülen bir örnekte krank sarımı 207,7° yerine 172,2° çıkıyordu, yani <strong>35,5° '
    + 'fark</strong>, ve model yine “çözüldü” diyordu.<br><br>'
    + 'Bu yüzden temas tarafı üç ayrı yerde görünür: panelde kendi kartında, tuvalde '
    + 'kasnak rozetinde (<strong>K</strong> / <strong>S</strong>), ve Kayış Yolu kartında '
    + '<strong>kayışın kaburgalı yüzü çizilerek</strong> — kaburgalı temas eden kasnakta '
    + 'dişler kasnağın içine, sırttan temas edende dışarı bakar. Şemaya bakıp dişlerin yönünü '
    + 'kontrol etmek, tabloyu okumaktan hızlıdır.');
  h += '<h3>6.1 Aksesuar gücünü nereden vereceksiniz</h3>';
  h += '<p>Aksesuarın çektiği güç iki yoldan gelebilir ve <strong>ikisini birden girmeniz '
    + 'gerekmez</strong>:</p>';
  h += _gfAlanTablo('Aksesuar gücünün iki kaynağı', [
    ['Güç Eğrisi', 'Kasnak panelinde, aksesuar devri → kW tablosu',
      'Bilgi sayfası her aksesuar için kendi ölçülmüş eğrisini veriyorsa'],
    ['Çalışma çevrimi hücresi', 'Çözücü panelinde, devir satırı × kasnak sütunu',
      'Tedarikçi raporu güçleri doğrudan devir noktası başına veriyorsa'],
    ['Katalog Modeli', 'Kasnak panelinde hazır eğri seçimi',
      'Elinizde ölçülmüş eğri yoksa; boş bırakılan kW hücreleri buradan dolar']
  ], ['Kaynak', 'Nerede', 'Ne zaman']);
  h += _gfNot('Aksesuar devri çaptan hesaplanır',
      'Aksesuarın kaç devirde döndüğü <strong>kasnak pitch çaplarından</strong> gelir; elle '
    + 'hız oranı girilmez. Elle yazılmış hız oranları, bu modülün öncülü olan hesap '
    + 'tablosundaki en ciddi hataydı ve bütün gerilmeleri sistematik olarak düşürüyordu. '
    + 'Kasnak panelindeki güç eğrisi tablosunun yanında, o aksesuar devrini veren '
    + '<em>motor devri</em> de bilgi olarak gösterilir; sayfanızın motor-devri sütunuyla '
    + 'karşılaştırabilirsiniz.');
  return h;
}

function _gfSec7(){
  var h = _gfH2(6);
  h += '<p>Otomatik gergi, modelin en çok girdi isteyen ve en dikkat gerektiren bileşenidir. '
    + 'Gergiye çift tıklayın; panel varsayılan olarak <strong>montaj koordinatını</strong> '
    + 'sorar.</p>';
  h += _gfAdimlar([
    'Önce <strong>Gergi Künye Kütüphanesi</strong> kartına bakın: elinizdeki gergi bu 14 '
      + 'ölçülmüş künyeden biriyse seçin, kol boyu · ön yük · yay katsayısı · kasnak çapı · '
      + 'temas tarafı bir anda dolar.',
    'Kütüphanede yoksa <strong>Yay Künyesi</strong> kartına üç sayıyı elle girin: ön yük, '
      + 'yay katsayısı, çalışma momenti.',
    '<strong>Kol Künyesi</strong> kartına kol boyunu yazın.',
    '<strong>Otomatik Gergi Montaj Koordinatları</strong> kartına gergi gövdesinin motora '
      + 'cıvatalandığı noktanın X ve Y’sini yazın.',
    'Panelin alt kısmındaki <strong>zarf okumasına</strong> bakın: program hangi kol açısını '
      + 'seçti, kasnak merkezi nereye düştü, gereken kayış boyu ne çıktı.'
  ]);
  h += _gfAlanTablo('Gergi paneli — alanlar', [
    ['Temas Tarafı', 'Genelde “Sırttan değiyor”', 'Yerleşim çizimi'],
    ['Dış çap (OD)', 'Gergi kasnağının dış çapı, mm', 'Parça künyesi'],
    ['Atalet J', 'kg·m²', 'Parça künyesi; burulma modeline girer'],
    ['<strong>Montaj X / Y</strong>', 'Gergi <strong>gövdesinin</strong> motora bağlandığı '
      + 'nokta — kolun döndüğü pivot',
      'Tedarikçiden <em>dönen</em> raporun <em>Pivot Point {X, Y}</em> satırı'],
    ['Kol boyu', 'Pivot ile kasnak merkezi arasındaki sabit mesafe, mm',
      'Raporun <em>Tensioner Data</em> bölümü; 56–90 mm aralığında doğrulandı'],
    ['<strong>Kasnak merkezi (doğrulama)</strong>', '<em>Opsiyonel</em> — gergi kasnağının '
      + 'çalışma merkezi', 'Raporun <em>Layout Data</em> tablosundaki gergi satırı. '
      + 'Girerseniz program ters girişi <strong>sayısal olarak</strong> yakalar'],
    ['Ön yük (Pre-Load)', 'Nm', 'Bilgi sayfasının Tensioner tablosu'],
    ['Yay katsayısı (Rate)', 'Nm/°', 'Aynı tablo'],
    ['Çalışma momenti (Mean Load)', 'Nm', 'Aynı tablo. Kolun montajda ne kadar kurulduğunu '
      + 'söyler: göreli açı = (Mean − Pre) / Rate'],
    ['Kol açısı', '<strong>Alan yok</strong> — program zarftan seçer',
      'İsterseniz “Kol açısını SABİTLE” anahtarıyla kendiniz verirsiniz'],
    ['Load stop', 'Mekanik durdurucunun göreli açısı, °', 'Raporun Tensioner Data satırı; '
      + 'boş bırakılabilir'],
    ['Kol ataleti', 'kg·m²', 'Burulma modeline girer'],
    ['Kasnak kütlesi', 'kg', 'Burulma modeline girer — <strong>girilmezse birinci mod '
      + 'belirgin şekilde yüksek çıkar</strong>']
  ]);
  h += _gfUyari('Buraya kasnak merkezi yazılmaz',
      'Gergi kasnağının merkezi ile gövdenin montaj noktası kolun <strong>iki ayrı ucudur</strong> '
    + 've aralarında tam kol boyu kadar mesafe vardır (14 sistemin 81 konumunda ölçüldü, sapma '
    + '≤ 0,065 mm). Tedarikçiye <em>giden</em> bilgi sayfasındaki gergi satırı '
    + '<strong>kasnak merkezidir</strong>; pivot yalnız <em>dönen</em> raporda bulunur.<br><br>'
    + 'İkisi karıştırılırsa model <strong>yine çözülür ve uyarı çıkmaz</strong> — ölçüldü: '
    + 'gerginlik <strong>−%48,6</strong>, sarım açısı en kötü <strong>+27,9°</strong> kayıyor. '
    + 'Her iki koordinatı birlikte girerseniz program aradaki mesafeye bakıp “aynı nokta '
    + 'girilmiş” ya da “biri yanlış okunmuş” diye ayrıca uyarır.');
  h += '<h3>7.1 Doğru noktayı girdiğinizi doğrulamak</h3>';
  h += '<p>Program, girdiğiniz tek koordinatın montaj referans noktası mı yoksa kasnağın '
    + 'çalışma merkezi mi olduğunu <strong>kendi başına ayırt edemez</strong> — ikisi de '
    + 'geçerli bir çözüm üretir. Panelin <strong>Doğrulama</strong> kartı bunu iki şekilde '
    + 'kapatır:</p>';
  h += _gfAdimlar([
    'Kart, girdiğiniz noktadan <strong>türeyen kasnak merkezini</strong> her durumda basar. '
      + 'Bu sayıyı tedarikçi raporunun <em>Layout Data</em> tablosundaki gergi satırıyla '
      + 'karşılaştırın — tutuyorsa doğru alana girmişsinizdir.',
    'İsterseniz o satırı <strong>Kasnak merkezi (doğrulama)</strong> alanlarına girin. '
      + 'O zaman program iki nokta arasındaki mesafeyi kol boyuyla karşılaştırır ve ters '
      + 'girişi sayısal olarak yakalar: tutuyorsa <em>“Tutarlı”</em>, ters girilmişse '
      + '<em>“Ayrışıyor”</em> der.'
  ]);
  h += _gfNot('Doğrulama alanı çözüme girmez',
      'Oraya yazdığınız sayı yalnız <strong>denetim</strong> içindir; kayış yolu, kol açısı '
    + 've gerginlik hesabı yine <em>yalnız montaj referans noktasından</em> kurulur. Alanı '
    + 'boş bırakmak modeli değiştirmez.');
  h += '<h3>7.2 Kol açısını program nasıl seçiyor</h3>';
  h += '<p>Pivot verildikten sonra geriye tek bir serbestlik derecesi kalır: gergi gövdesinin '
    + 'montajdaki saat konumu, yani kolun mutlak açısı. Program 360°’lik zarfı tarar ve '
    + '<strong>en küçük take-up’ı en büyük yapan</strong> açıyı seçer.</p>';
  h += '<p>Fiziksel karşılığı şudur: kolun taşıdığı gerginlik <em>T = M / (dL/dθ)</em> '
    + 'olduğundan, take-up oranının en küçük olduğu yer gerginliğin en büyük olduğu yerdir. '
    + 'Ölçüt, kayışın servis zarfı boyunca (yeni ve uzun kayıştan yıpranmış ve kısa kayışa) '
    + 'görülen <strong>tepe gerginliği en küçük</strong> yapan montaj konumunu bulur — klasik '
    + 'gergi yerleşim kuralı.</p>';
  h += '<p>Ölçüt tahminle seçilmedi: altı aday ölçüt 14 tedarikçi sisteminde tarandı, kazananı '
    + 'bu oldu. Açı farkının medyanı <strong>4,5°</strong>, 14 sistemin <strong>9’unda ±5° '
    + 'içinde</strong>; aynı ölçüt kayış boyunu 11 sistemde <strong>±%0,35 içinde</strong> '
    + 'geri veriyor.</p>';
  h += _gfNot('Sonuç bir öneridir — paketleme modelde yok',
      'Zarfın hangi yayının motor bloğunda fiziksel olarak kullanılabilir olduğunu program '
    + 'bilmez. Ölçülen 14 sistemin birinde en iyi nokta motorun öteki yanında kaldı. Gövdenin '
    + 'montajdaki saati bir imalat kararıysa (konum pimi, cıvata deseni) panelde '
    + '<strong>“Kol açısını SABİTLE”</strong> anahtarını açın: zarf o zaman bir seçici değil '
    + 'bir <strong>teşhis</strong> yüzeyi olur — program sizin açınızla çözer, zarf eğrisi '
    + 'yalnız o açının nerede durduğunu gösterir.');
  h += '<h3>7.3 Panelde ne okuyacaksınız</h3>';
  h += _gfAlanTablo('Gergi panelinin zarf okuması', [
    ['Yay kurulması', '(M<sub>çalışma</sub> − M<sub>ön</sub>) / k — kolun bağıl dönmesi',
      'Salt yay künyesinden; geometriye hiç bakmaz'],
    ['Kol çalışma açısı', 'Zarftan <strong>seçilen</strong> mutlak açı',
      'Sabitlerseniz sizin verdiğiniz açı'],
    ['Kasnak merkezi', 'Pivottan kol boyu kadar uzakta, seçilen açıda',
      '<strong>Türeyen</strong> — bu bir girdi değildir'],
    ['Gereken kayış boyu', 'Bu yerleşim için ısmarlanması gereken efektif boy',
      'Bölüm 8’de katalogla eşleştirilir'],
    ['Tasarım gerginliği', 'Yay dengesinden türeyen ankraj gerginliği',
      'Bütün gerilme zinciri bu değerden kurulur'],
    ['Zarfın çözülebilen yayı', '360°’nin kaç derecesinde geçerli geometri çıkıyor',
      'Çok küçükse (< 20°) yerleşimi gözden geçirin']
  ], ['Satır', 'Ne gösterir', 'Not']);
  return h;
}

function _gfSec8(){
  var h = _gfH2(7);
  h += '<p><strong>Kayış Özellikleri</strong> kutusuna çift tıklayın. İç topolojide bu kutudan '
    + 'yalnız bir tane bulunur.</p>';
  h += _gfAdimlar([
    '<strong>Profil ve Marka</strong> kartında kayış profilini seçin (PK · PJ · PH · PL · PM) '
      + 've markayı işaretleyin. Bu seçim kapatılamaz: pitch yarıçapı '
      + '<em>OD/2 + h<sub>b</sub></em> olduğu için teğet geometrisi profil sabitine dayanır.',
    '<strong>Künye</strong> kartına kanal (kaburga) sayısını girin. Gergi montaj '
      + 'koordinatından çözülüyorsa <strong>efektif boy alanı yoktur</strong> — yerine '
      + 'türetilen boyun okuması durur.',
    '<strong>Katalog</strong> kartına bakın: program gereken boya en yakın stok ve ızgara '
      + 'boylarını, her biri için kolun oturacağı açı ve çıkacak gerginlikle birlikte '
      + 'listeler.',
    'Bir satıra tıklayarak o boyu seçin. Kip <strong>SABİT</strong>e döner ve model artık o '
      + 'kayışla çözülür.'
  ]);
  h += '<h3>8.1 Kayış boyu kipi</h3>';
  h += _gfAlanTablo('İki kip, iki soru', [
    ['SERBEST', 'Kayış boyu bir <strong>çıktıdır</strong>; kol nominal yay açısına oturur',
      '“Bu düzen için hangi kayışı ısmarlamalıyım?”'],
    ['SABİT', 'Girilen boy kullanılır; kol o boya oturan açıya gider, gerginlik oradan çıkar',
      '“Elimdeki bu kayış bu düzene uyar mı?”']
  ], ['Kip', 'Ne yapar', 'Hangi soruya cevap verir']);
  h += _gfNot('Zarf kipinde kayış kipi kilitlidir',
      'Gergi montaj koordinatından zarf çözerek çalışıyorsa kayış boyu <strong>yapısal '
    + 'olarak</strong> bir sonuçtur ve seçilemez. Panel bunu “SERBEST (kilitli)” diye yazar, '
    + 'tuvaldeki rozet de tıklamayı reddeder. Kayış boyunu girdi yapmak isterseniz gergi '
    + 'panelinden kol açısı kipini değiştirin.');
  h += '<h3>8.2 Katalog bir kısıt değil, bir öneridir</h3>';
  h += '<p>Katalog iki ayrı küme gösterir ve bunları karıştırmaz:</p>';
  h += _gfAlanTablo('Katalog kümeleri', [
    ['Stok boyları', 'ISO 9982 / DIN 7867 endüstriyel boylar', 'İşaretsiz satırlar'],
    ['Otomotiv ızgarası', '5 mm adımlı üretim pratiği', '<strong>◇</strong> ile işaretli']
  ], ['Küme', 'Nedir', 'Listede nasıl görünür']);
  h += '<p>Ayrım gerçek bir boşluktan doğdu: ölçülen bir aracın kendi kayışı '
    + '(<code>8PK 1715</code>) endüstriyel stok listesinde <strong>yoktur</strong> — komşuları '
    + '1690 ve 1755, arada 65 mm’lik bir boşluk var. Yalnız stok listesi gösterilseydi '
    + 'kullanıcının elindeki kayış “katalogda yok” görünürdü. Ara boy ısmarlanabilir; boyu '
    + 'elle de girebilirsiniz.</p>';
  h += '<p>Sığmayan aday bir sayı basmaz, <strong>“sığmıyor”</strong> yazar: kolun sınıra '
    + 'kenetlendiği noktada gerginlik matematiksel olarak tekilleşir ve oradan okunan sayı '
    + 'fiziksel değildir.</p>';
  h += '<h3>8.3 Kayış tipine bağlı çıktılar anahtarı</h3>';
  h += '<p>Aynı panelde bir anahtar daha vardır ve gergi zarf kipindeyken varsayılan olarak '
    + '<strong>kapalıdır</strong>. Kapalıyken şu dört çıktı <strong>üretilmez</strong>:</p>';
  h += '<ul>'
    + '<li>B10 kayış ömrü</li>'
    + '<li>Kaburga yorulma dağılımı</li>'
    + '<li>Açıklık doğal frekansları ve çırpınma hükmü</li>'
    + '<li>Kol konum tablosunun tolerans / aşınma zarfı</li>'
    + '</ul>';
  h += '<p>Dördü de kayış katalogundan gelen sabitlere dayanır (efektif boy, birim kütle, '
    + 'yorulma sabitleri, tolerans ve aşınma payı). Kayış henüz seçilmemişken bu sayıları '
    + 'üretmek, olmayan bir seçimi varsaymak olurdu. Kayışı seçtikten sonra anahtarı '
    + '<strong>Açık</strong>a alın; panel neyin kapalı olduğunu her zaman listeleyerek '
    + 'yazar.</p>';
  return h;
}

function _gfSec9(){
  var h = _gfH2(8);
  h += '<p><strong>Çözücü</strong> kutusuna çift tıklayın. Modelin geri kalanı burada '
    + 'toplanır.</p>';
  h += '<h3>9.1 Birinci kademe — krank ile sürücü kasnak arasındaki oran</h3>';
  h += '<p>FEAD kayışının sürücü kasnağı krank milinde olmak zorunda değildir: yaygın bir '
    + 'düzende krank ayrı bir kademeyle fan kasnağını döndürür, FEAD kayışı da onun üzerinden '
    + 'tahrik edilir.</p>';
  h += _gfAdimlar([
    'Tedarikçi sayfanız oranı <strong>iki çapla</strong> veriyorsa “Krank ve fan kasnağı '
      + 'çapından türet” seçin ve iki çapı yazın.',
    'Tek kademeli bir sistemse (kayış doğrudan krank kasnağından tahrikli) “Oranı elle gir” '
      + 'seçip <strong>1</strong> yazın.',
    'Kartın altındaki “Kullanılan tahrik oranı” satırından doğruladığınız değeri okuyun.'
  ]);
  h += _gfUyari('Bu oran bütün sonuçları ölçekler',
      'Aksesuar devri = motor devri × <strong>tahrik oranı</strong> × (sürücü kasnak pitch '
    + 'çapı / aksesuar pitch çapı). Yanlış girilirse bütün güç ve gerilme sonuçları aynı '
    + 'oranda kayar ve hiçbir uyarı çıkmaz.');
  h += '<h3>9.2 Motor künyesi</h3>';
  h += _gfAlanTablo('Motor Künyesi kartı', [
    ['Silindir sayısı', 'Adet', 'Ateşleme frekansını verir (dört zamanlıda '
      + 'f = devir/60 × silindir/2); açıklık rezonans kontrolünde kullanılır'],
    ['Servis faktörü', 'Boyutsuz, tipik 1,3', 'Kayma emniyetinin istenen alt sınırı; sonuç '
      + 'tablosunda hüküm verir'],
    ['Krank ataleti', 'kg·m²', 'Burulma titreşimi modeline girer — kasnağın değil '
      + '<strong>krank milinin</strong> ataleti'],
    ['İvmelenme', 'RPM/s', 'Tepe yük taramasına girer'],
    ['Yavaşlama', 'RPM/s', 'Aynı taramanın diğer dalı']
  ]);
  h += '<h3>9.3 Çalışma çevrimi tablosu</h3>';
  h += _gfAdimlar([
    '<strong>+ Devir satırı</strong> düğmesiyle bir devir noktası ekleyin.',
    'Satıra <strong>devir</strong>, o devirde geçirilen <strong>%zaman</strong> ve kayış '
      + '<strong>sıcaklığını</strong> yazın.',
    'Aksesuar sütunlarına o devirdeki <strong>kW</strong> değerlerini girin. Boş bıraktığınız '
      + 'hücre, o aksesuarda katalog modeli seçiliyse eğriden dolar; seçili değilse 0 sayılır.',
    'Bütün devir noktalarını girdikten sonra <strong>%zaman toplamının 100</strong> olduğunu '
      + 'doğrulayın.'
  ]);
  h += _gfNot('Sürücü sütunu yoktur',
      'Sürücü kasnağın gücü diğerlerinin <strong>toplamı</strong> olarak hesaplanır; çevrim '
    + 'ancak böyle kapanır. Elle girilseydi çekirdek reddederdi. Aynı gerekçeyle '
    + '%zaman toplamı 100 değilse dağılım yüzdeleri etkilenmez ama mutlak ömür ölçeklenir — '
    + 'panel bunu uyarır.');
  h += _gfNot('Sıcaklık satır başına girilir, tek sayıya indirgenir',
      'Ömür hesabı sıcaklığı tek bir eşdeğer değer olarak ister. Program bunu '
    + '<strong>hasar-eşdeğer</strong> olarak indirger, aritmetik ortalamayla değil: yüksek '
    + 'sıcaklıklı satırlar hak ettikleri ağırlığı alır. Tek sıcaklıklı bir tabloda iki yöntem '
    + 'aynı sonucu verir; dağılmış bir tabloda aritmetik ortalama ömrü sistematik olarak '
    + '<strong>uzun</strong> gösterirdi.');
  return h;
}

function _gfSec10(){
  var h = _gfH2(9);
  h += '<p>Geometri sonuçları <strong>Hesapla’ya basmadan</strong> hazırdır. Kayış Yolu kartı, '
    + 'gergi panelindeki zarf okuması ve gergi konum tablosu çalışma çevrimi gerektirmez — '
    + 'geometriden ve yay dengesinden gelirler.</p>';
  h += _gfAdimlar([
    'Çözücü panelinde <strong>Algılanan Model</strong> tablosuna bakın: kasnak sayısı, sürücü, '
      + 'gergi, kayış künyesi, temas tarafı dağılımı, tahrik oranı, türetilen tasarım '
      + 'gerginliği ve “Geometri: çözüldü” satırı.',
    'Bir satır sarı ise o eksiği giderin. “Geometri: çözülemedi” yazıyorsa altındaki sebep '
      + 'kutusunu okuyun.',
    'Model tamamsa ve en az bir devir noktası girdiyseniz <strong>▶ Hesapla</strong> düğmesi '
      + 'etkinleşir. Basın.',
    'Düğmenin altında sonuç blokları belirir. Bir hata varsa sebep aynı yerde yazılır.'
  ]);
  h += _gfAlanTablo('“Hesapla” pasifse', [
    ['Model veya çevrim eksik', 'Geometri çözülmedi ya da hiç devir noktası yok',
      'Algılanan Model tablosundaki sarı satırı giderin; çalışma çevrimine en az bir satır '
      + 'ekleyin'],
    ['Kayış yoluna bağlı olmayan kasnak var', 'Bir kasnağın telleri kopuk',
      'Kasnağı zincire bağlayın ya da tuvalden kaldırın'],
    ['Kayış yolu kapanmıyor', 'Zincir halka oluşturmuyor', 'Son kasnağın çıkışını ilk kasnağın '
      + 'girişine bağlayın'],
    ['Kasnaklar çakışıyor', 'İki kasnağın çemberi kesişiyor — ortak teğet yok',
      'Koordinatları ya da çapları düzeltin; program hangi çift olduğunu yazar'],
    ['Tasarım gerginliği türetilemedi', 'Kayış, gergi kolunun erişemeyeceği kadar kısa/uzun',
      'Yerleşimi ya da kayış boyunu gözden geçirin']
  ], ['Belirti', 'Sebep', 'Ne yapmalı']);
  return h;
}

function _gfSec11(){
  var h = _gfH2(10);
  h += '<p>Sonuçların <strong>üç okuma yüzeyi</strong> vardır. Hangi sayının nerede durduğunu '
    + 'bilmek, panel panel aramaktan hızlıdır.</p>';
  h += '<h3>11.1 Kayış Yolu kartı — tuvalde, canlı</h3>';
  h += '<p>Bu kart bir düğme değil, tuvalin üstünde duran ölçekli bir şemadır ve girdi '
    + 'değiştikçe yeniden çizilir.</p>';
  h += _gfAlanTablo('Kartta ne var', [
    ['Turuncu yol', 'Çözücünün teğet noktaları ve işaretli sarım yayları'],
    ['Yol üstündeki dişler', 'Kayışın <strong>kaburgalı yüzü</strong> — kaburgalı temas edende '
      + 'kasnağın içine, sırttan temas edende dışarı bakar'],
    ['Kesikli çember', 'Kayış o kasnağa <strong>sırttan</strong> değiyor'],
    ['Kasnak içi ok', 'Dönüş yönü (sırttan temas edende ters döner)'],
    ['Yeşil artı ve kesikli çizgi', 'Gergi <strong>pivotu</strong> ve kolu'],
    ['Yön gülü', 'Açı konvansiyonu — sürüklenebilir, çift tıkla varsayılana döner'],
    ['Soluk gri yollar', 'Kolun gezdiği diğer konumlar (“TÜMÜ” kipinde)'],
    ['Üst künye', 'Çizilen konumun adı · kol açısı · gerginlik'],
    ['<strong>Alt şerit</strong>', '<strong>✓/✗ · kasnak sayısı · efektif boy · Σ sarım</strong> '
      + '— Σ sarım 360,00° olmak zorundadır'],
    ['Alt şeritteki seçiciler', 'Gergi kol konumu ve animasyon devri']
  ], ['İşaret', 'Ne söylüyor']);
  h += _gfNot('Kart çalışır',
      'Alt şeritteki devir seçicisinden bir çalışma noktası seçerseniz kayış akar ve kasnaklar '
    + 'döner. Hareket <strong>ağır çekimdir</strong> ama oranlar birebir doğrudur: hangi kasnak '
    + 'ne kadar hızlı döner, hangisi <strong>ters</strong> döner, kayış ne kadar hızlı gider — '
    + 'üçü de gerçek çözümden gelir. Gerçek zamanlı gösterilseydi en yavaş çalışma noktasında '
    + 'bile kayış kare başına on diş atlar, alternatör de görsel olarak ters yönde dönüyor '
    + 'görünürdü.');
  h += '<h3>11.2 Tuval rozetleri</h3>';
  h += _gfAlanTablo('Rozetler', [
    ['Kayış kutusu', '<code>SABİT</code> (mavi) ↔ <code>SERBEST</code> (amber)',
      'Tıklanabilir; zarf kipinde kilitli'],
    ['Konum Bağı kutusu', '<code>AÇIK</code> (amber) ↔ <code>KAPALI</code> (mavi)',
      'Tıklanabilir'],
    ['Dönüş Yönü kutusu', '<code>↺ CCW</code> ↔ <code>↻ CW</code>',
      'Tıklanabilir; <strong>rengi</strong> gergi tarafı hükmünü taşır'],
    ['Kasnak kutuları', '<strong>K</strong> / <strong>S</strong> (temas tarafı), sürücüde ►',
      'Salt gösterge']
  ], ['Nerede', 'Ne yazar', 'Not']);
  h += '<h3>11.3 Paneller</h3>';
  h += _gfAlanTablo('Hangi sonuç hangi panelde', [
    ['Gergi paneli', 'Seçilen kol açısı · türeyen kasnak merkezi · gereken kayış boyu · '
      + 'tasarım gerginliği · ölçüt değeri · zarfın çözülebilen yayı', 'Hayır'],
    ['Kayış paneli', 'Türetilen boy ve hangi kol açısından geldiği · katalog aday tablosu · '
      + 'kapatılan çıktıların listesi', 'Hayır'],
    ['Kayış Yolu paneli', 'Geometri tablosu: kasnak · temas · çıkış açıklığı · sarım · hız '
      + 'oranı; altında efektif boy, pitch boyu ve Σ sarım', 'Hayır'],
    ['Çözücü paneli — üst', 'Algılanan Model · <strong>Gergi Konum Tablosu</strong> (altı '
      + 'konum × kol açısı, gerginlik, hubload, yön, β, sarım) · uyarılar', 'Hayır'],
    ['Çözücü paneli — alt', 'Çıkış gerilmeleri ve min. kayma emniyeti hükmü · hubload · '
      + 'burulma titreşimi · kaburga yorulma dağılımı · B10 ömür · geçerlilik sınırları',
      '<strong>Evet</strong>'],
    ['Rapor kutusu', 'Detaylı ya da Özet HTML belge', '<strong>Evet</strong>']
  ], ['Panel', 'Ne okunur', 'Hesapla gerekir mi']);
  h += '<h3>11.4 Kayma emniyetini doğru okumak</h3>';
  h += '<p>Çıkış gerilmeleri tablosunun son sütunu <strong>Min SF</strong>’dir ve bütün '
    + 'kasnakların en küçüğünü basar. Bu sayı servis faktörünün altına düştüğünde önce '
    + '<strong>hangi kasnak</strong> olduğuna bakın.</p>';
  h += _gfUyari('Oran ≈ 1 iken emniyet faktörü bir marj değildir',
      'Avara ve gergi kasnakları kayıştan <strong>güç çekmez</strong>: giriş ve çıkış '
    + 'gerilmeleri neredeyse eşittir, yani gerginlik oranı 1’e çok yakındır. Orada emniyet '
    + 'faktörü bir <em>marj</em> değil, o sarım açısının <strong>kapasitesidir</strong> — '
    + 'taşıyabileceği azami oran. Servis faktörü ise talebin üzerine konan bir marjdır; talep '
    + 'yokken anlamsızdır.<br><br>'
    + 'Yük taşıyan kasnaklarda oran belirgin biçimde 1’in üstündedir ve emniyet faktörleri '
    + 'çoğunlukla iki mertebe yüksektir. <strong>Rapor hükmünü yalnız yük taşıyanların en '
    + 'küçüğünden verir</strong>; panel tablosu ise ham en küçüğü gösterir. Bölüm 14’te bu '
    + 'ayrımın sayısal karşılığı var.');
  return h;
}

function _gfSec12(){
  var h = _gfH2(11);
  h += '<p><strong>Rapor</strong> kutusuna çift tıklayın. Rapor çözülmüş modelden üretilir; '
    + 'model çözülmemişse düğme pasiftir ve sebebi yazılır.</p>';
  h += _gfAdimlar([
    'Rapor türünü seçin: <strong>Detaylı</strong> ya da <strong>Özet</strong>.',
    '<strong>Doküman künyesi</strong> alanlarını doldurun: hazırlayan, doküman no, revizyon, '
      + 'tasarım notları. Bunlar antete ve belgenin sonundaki notlar bölümüne akar.',
    '<strong>Raporu Oluştur ve İndir</strong> düğmesine basın. İlk üretimde yazı tipleri ve '
      + 'formül dizgisi (~1 MB) bir kez yüklenir.',
    'İnen dosya tek parçadır ve çevrimdışı açılır; yazdırırsanız A4’e sığar.'
  ]);
  h += _gfAlanTablo('İki rapor türü', [
    ['Detaylı', 'Teori bölümleri 1–7 ve 9–10 · Ek A · çözümün sayısal bölümü (18 alt bölüm) · '
      + 'uygunluk hükmü', 'Yöntemi de belgelemek, hesabı denetletmek'],
    ['Özet', 'Tedarikçi çıktısının biçiminde altı sayfa: Genel Bakış · Geometri · Gergi '
      + 'Çalışma Zarfı · Çalışma Çevrimi ve Torklar · Gerginlik ve Hubload · Dayanım ve '
      + 'Titreşim', 'Sonuçları paylaşmak, tedarikçi raporuyla yan yana koymak']
  ], ['Tür', 'İçerik', 'Ne zaman']);
  h += _gfNot('Rapor çözülen modeli anlatır',
      'Belge, <strong>Hesapla</strong>’ya bastığınız andaki modeli anlatır. Çözümden sonra bir '
    + 'alanı değiştirirseniz o değişiklik rapora sızmaz — belge kendi sayılarıyla çelişmez. '
    + 'Değişikliği rapora yansıtmak için yeniden çözün.');
  return h;
}

function _gfSec13(){
  var h = _gfH2(12);
  h += '<p>Bu modülde en pahalı hata sınıfı çöken model değil, <strong>“makul ama yanlış” '
    + 'sayıdır</strong>: model çözülür, tablolar dolar, hiçbir uyarı çıkmaz. Aşağıdakiler '
    + 'ölçülmüş bedelleriyle birlikte duruyor.</p>';
  h += _gfTablo('Sessiz hata sınıfları',
    ['Alan', 'Yanlış verilirse ne olur', 'Ölçülen bedel'],
    [
      ['Temas tarafı', 'Geçerli ama <strong>başka</strong> bir kayış yolu çözülür; Σ sarım '
        + 'yine 360 çıkar', 'Bir sistemde sarım 207,7° yerine 172,2° — <strong>−35,5°</strong>'],
      ['Gergi montaj koordinatı', 'Kasnak merkezi pivot sanılırsa model yine çözülür',
        'Gerginlik <strong>−%48,6</strong> · sarım en kötü <strong>+27,9°</strong>'],
      ['Kol açısı kipi', 'Montaj açısı “serbest kol açısı” alanına yazılırsa yay yalnız ön '
        + 'yükünde bulunur', 'Moment 22,07 yerine 8,81 Nm · gerginlik 650 yerine '
        + '<strong>251 N</strong>'],
      ['Birinci kademe oranı', 'Elle yazılmış hız oranı çaptan hesaplananla çelişir',
        'Bütün gerilmeler aynı oranda kayar — bir veri setinde <strong>%2,7</strong>'],
      ['Dönüş yönü', 'Gergi kayışın gergin tarafına düşer',
        'Açıklık gerilmeleri ankrajın altına iner, bir kısmı <strong>negatife</strong> döner'],
      ['Gergi kasnak kütlesi', 'Girilmezse nokta kütle terimi eksik kalır',
        'Birinci burulma modu <strong>+%32</strong> (15,3 yerine 20,3 Hz)'],
      ['Aşınma payı', '<strong>Oran</strong> olarak girilir (0,007), yüzde olarak değil',
        'Yüz kat sapma'],
      ['Künye karışımı', 'Gergi koordinatı bir belgeden, kayış künyesi başka belgeden alınır',
        'Model iki farklı sistemi anlatır — sapma <strong>üç katına</strong> çıkar']
    ], ['c', 'l', 'l']);
  h += _gfNot('Ortak kural: geçerlilik sınırı sonucun içinde taşınır',
      'Bir sayı kalibre edilmemişse başlığında damgası, altında ölçülen sapma bandı vardır; '
    + 'kapatılmış bir çıktı listelenerek yazılır. “Boş görünmeyen ama denetlenmemiş” bir tablo '
    + 'bu modülde bilerek bırakılmaz. Panelde ya da raporda bir uyarı görürseniz onu bir '
    + 'ayrıntı değil, sonucun parçası sayın.');
  return h;
}

// ═══════════════════════════════════════════════════════════════════════════
//  §14 — İŞLENMİŞ ÖRNEK (sayılar üretim anında hesaplanır)
// ═══════════════════════════════════════════════════════════════════════════

// Örneği BELLEKTE kur ve çöz. Kullanıcının tuvaline dokunulmaz: örnek düğümleri
// `veFeadExampleNodes` düz nesne olarak üretiyor ve `veFeadBuildSystem` açık
// liste kabul ediyor (global `nodes` okuyan `veFeadBuildFromCanvas` DEĞİL).
//
// Örnek ZARF KİPİNE alınır: kayıtlı hâli montaj merkezini de taşıyor, ama
// kılavuzun anlattığı akış pivottan başlıyor. Kasnak merkezi ve kayış boyu
// siliniyor ki ikisi de gerçekten TÜREYEN olsun — kalmış olsalardı belge
// "program bunları hesaplıyor" derken aslında girdiyi okuyor olurdu.
function _gfOrnekCoz(){
  if(typeof veFeadExampleNodes !== 'function' || typeof veFeadBuildSystem !== 'function'
     || typeof componentDefs === 'undefined')
    return null;
  var pack;
  try { pack = veFeadExampleNodes('AG00976_GATES_2025'); } catch(e){ return null; }
  if(!pack || !pack.nodes) return null;
  pack.nodes.forEach(function(n){ n.def = componentDefs[n.type]; });

  var gergi = null, kayis = null, cozucu = null;
  pack.nodes.forEach(function(n){
    var d = componentDefs[n.type] || {};
    if(d.isFeadTensioner) gergi = n;
    if(d.isFeadBelt) kayis = n;
    if(d.isFeadSolver) cozucu = n;
  });
  if(!gergi || !kayis || !cozucu) return null;

  delete gergi.data.cenX; delete gergi.data.cenY;
  delete kayis.data.effLength;

  var build;
  try { build = veFeadBuildSystem(pack.nodes, pack.connections); } catch(e){ return null; }
  if(!build || !build.ok) return null;

  var R = null;
  try {
    R = veFeadAnalyze(build, {
      rows: veFeadDutyRows(cozucu),
      cylinders: Number(cozucu.data.cylinders) || 6,
      crankInertia: Number(cozucu.data.crankInertia) || 0,
      fatigueModel: cozucu.data.fatigueModel || 'PK-2_2p-MT3',
      accelRpmS: Number(cozucu.data.accelRpmS),
      decelRpmS: Number(cozucu.data.decelRpmS)
    });
  } catch(e){ R = null; }

  return { pack: pack, build: build, R: R, gergi: gergi, kayis: kayis, cozucu: cozucu };
}

// Gates AG00976 raporunun kendi sayıları — KARŞILAŞTIRMA için. Bunlar dış bir
// belgenin basılı değerleridir, modelin çıktısı değil; bu yüzden burada sabit
// dururlar ve öyle kalmalıdırlar. Model tarafındaki her sayı canlı hesaplanıyor.
var VE_GUIDE_FEAD_GATES = {
  belt: 1714.6, design: 544, freeAbsDeg: 16.1, NF: 12.52,
  // Raporun gergi için bastığı İKİ AYRI koordinat. Bunlar aynı şeyin iki
  // yazımı değil, kolun iki ucu: aralarındaki mesafe 14 sistemin 14'ünde de
  // tam kol boyu (en büyük sapma 0,0054 mm — basım yuvarlaması).
  //   pivot  → "Tensioner Data / Pivot Point {X, Y Coordinates} mm"  = GİRDİ
  //   tenXY  → "Layout Data" tablosunun gergi satırı (çalışma merkezi) = ÇIKTI
  pivot: [-250, 110], tenXY: [-161.97, 91.29], arm: 90,
  wrap: [156.2, 52.8, 198.4, 64.3, 157.1, 34.6],
  span: [148.0, 141.4, 150.8, 272.7, 194.4, 141.3],
  T880: [1381, 1380, 1023, 1022, 545, 544],
  H880: [1891, 1228, 2372, 1088, 1539, 324]
};

function _gfSapma(bizim, gates){
  if(!Number.isFinite(bizim) || !Number.isFinite(gates) || gates === 0) return '—';
  var p = (bizim - gates) / gates * 100;
  return (p >= 0 ? '+' : '') + _gfFs(p, 2) + '%';
}

function _gfSec14(){
  var h = _gfH2(13);
  h += '<p>Bu bölüm kılavuzun tamamını tek bir örnek üzerinde tekrarlar. Modellenen sistem '
    + 'gerçek bir araca aittir: altı kasnaklı, ikincil tahrikli bir FEAD düzeni. Çıkan sayılar, '
    + 'aynı sistem için kayış tedarikçisinin ürettiği rapordaki değerlerle yan yana '
    + 'konuyor.</p>';

  var O = _gfOrnekCoz();
  if(!O){
    h += _gfUyari('Örnek bu oturumda çözülemedi',
        'İşlenmiş örnek belge üretilirken canlı hesaplanır ve bu kez zincir kurulamadı. '
      + 'Kılavuzun geri kalanı etkilenmez; örneği programda <strong>Başlangıç ve Örnekler → '
      + 'AG00976</strong> ile kendiniz kurabilirsiniz.');
    return h;
  }
  var b = O.build, R = O.R, G = VE_GUIDE_FEAD_GATES;
  var td = O.gergi.data;

  // ── 14.1 Girdiler ────────────────────────────────────────────────────────
  h += '<h3>14.1 Elimizdeki veri</h3>';
  h += '<p>Tedarikçi raporundan okunan koordinatlar ve künyeler. Bu tabloya girmeyen hiçbir '
    + 'şey modele girmez — geri kalan her sayı bunlardan türeyecek.</p>';

  // KOORDİNATIN NE OLDUĞU KENDİ SÜTUNUNDA. Gergi satırı diğer beşiyle AYNI
  // sütunda ama BAŞKA bir noktayı taşıyor: beşi kasnak merkezi, gergininki
  // montaj referans noktası (kolun döndüğü pivot) — ve aradaki mesafe tam kol
  // boyu, yani 90 mm. Fark bir dönem X hücresine sıkıştırılmış "pivot"
  // kelimesiyle anlatılıyordu; tek sütunun iki anlam taşıması bu modülün
  // "sessiz tuzak" saydığı şeyin ta kendisi. Artık yapısal olarak ayrı.
  var satirlar = [];
  var pulleys = b.order || [];
  pulleys.forEach(function(n, i){
    var d = n.data || {};
    var ad = (typeof _feadNodeName === 'function') ? _feadNodeName(n) : (b.names[i] || '—');
    var gergiMi = !!(componentDefs[n.type] && componentDefs[n.type].isFeadTensioner);
    satirlar.push([
      _gfE(ad),
      _gfF(d.od, 0),
      gergiMi ? _gfF(d.pivotX, 2) : _gfF(d.x, 1),
      gergiMi ? _gfF(d.pivotY, 2) : _gfF(d.y, 1),
      gergiMi ? '<strong>montaj referans noktası</strong>' : 'kasnak merkezi',
      (typeof veFeadContactOf === 'function' && veFeadContactOf(n) === 'grooved')
        ? 'kaburgalı' : 'sırttan',
      // ROL SÜTUNU GERGİYİ DE ADLANDIRIR. Bir dönem yalnız `driver`a bakıyordu,
      // yani gergi satırında '—' yazıyordu ve o satırı diğerlerinden ayıran tek
      // şey kasnağın ADIYDI — kullanıcı düğümü yeniden adlandırınca kaybolan
      // bir sinyal. Detaylı raporun aynı tablosu orada 'gergi' yazıyor.
      d.driver ? '<span class="ok">sürücü</span>'
        : (gergiMi ? 'gergi'
        : (_feadDefOf(n).isFeadIdler ? 'avara' : 'aksesuar'))
    ]);
  });
  h += _gfTablo('Kasnak künyeleri — girilen değerler',
    ['Kasnak', 'OD [mm]', 'X [mm]', 'Y [mm]', 'Koordinat neyi gösteriyor', 'Temas', 'Rol'],
    satirlar, ['l', '', '', '', 'l', 'c', 'c']);

  h += _gfUyari('Gergi satırı diğerlerinden BAŞKA bir noktadır',
      'Beş kasnakta X/Y <strong>kasnağın merkezidir</strong>. Gergide ise girilen koordinat '
    + '<strong>montaj referans noktasıdır</strong> — gövdenin motora cıvatalandığı, kolun '
    + 'etrafında döndüğü nokta. Gergi kasnağının merkezi bir girdi değil, bu noktadan '
    + '<em>türeyen</em> bir sonuçtur (14.2).<br><br>'
    + 'Tedarikçi raporu ikisini de basar ve <strong>ayrı yerlerde</strong>: montaj referans '
    + 'noktası <em>Tensioner Data → Pivot Point {X, Y Coordinates}</em> satırında, gergi '
    + 'kasnağının çalışma merkezi ise <em>Layout Data</em> tablosunun gergi satırında. '
    + 'Aralarında tam kol boyu kadar mesafe vardır — arşivdeki 14 sistemin 14’ünde de '
    + 'ölçüldü, en büyük sapma <strong>0,0054 mm</strong> (basım yuvarlaması).<br><br>'
    + '<strong>Karıştırılırsa model yine çözülür ve uyarı çıkmaz.</strong> Ölçüldü: '
    + '<em>Layout Data</em> satırı montaj koordinatı sanılıp girilince kol 112,30°’ye '
    + 'gidiyor, türeyen kasnak merkezi doğrusundan <strong>90,00 mm</strong> sapıyor, '
    + 'gerginlik <strong>−%47,9</strong> düşüyor.');

  h += _gfTablo('Gergi ve kayış künyeleri — girilen değerler',
    ['Alan', 'Değer', 'Nereden'],
    [
      ['Montaj referans noktası',
        _gfF(td.pivotX, 2) + ' / ' + _gfF(td.pivotY, 2) + ' mm',
        'Raporun <em>Tensioner Data → Pivot Point</em> satırı — panelde '
        + '“Otomatik Gergi Montaj Koordinatları”'],
      ['Kol boyu', _gfF(td.armLen, 1) + ' mm', 'Raporun <em>Tensioner Data</em> bölümü'],
      ['Yay ön yükü', _gfF(td.preload, 2) + ' Nm', 'Aynı bölüm'],
      ['Yay katsayısı', _gfF(td.kArm, 3) + ' Nm/°', 'Aynı bölüm'],
      ['Çalışma momenti', _gfF(td.meanLoad, 2) + ' Nm', 'Aynı bölüm'],
      ['Kayış profili', _gfE((O.kayis.data.profile || '—') + ' · '
        + (O.kayis.data.ribs || '—') + ' kanal'), 'Kayış künyesi'],
      ['Kayış efektif boyu', '<em>girilmedi — çıktı olacak</em>', '—']
    ], ['l', 'c', 'l']);

  h += _gfOnay('Kayış boyu bilerek boş bırakıldı',
      'Bu örnek gergi <strong>zarf kipinde</strong> kuruluyor: montaj koordinatı bir girdi, '
    + 'kayış boyu bir çıktı. Boy girilseydi program onu kullanır ve aşağıdaki karşılaştırma '
    + 'anlamını yitirirdi — model, bulması gereken sayıyı zaten okumuş olurdu.');

  // ── 14.2 Zarf çözümü ─────────────────────────────────────────────────────
  h += '<h3>14.2 Program neyi hesapladı</h3>';
  h += '<p>Kasnaklar yerleştirilip kayış yolu kablolandıktan ve gergi künyesi girildikten '
    + 'sonra gergi panelinin okuduğu değerler. Üçüncü satır 14.1’deki ayrımın karşılığıdır: '
    + '<strong>gergi kasnağının merkezi bir girdi değil, montaj referans noktasından türeyen '
    + 'bir sonuçtur</strong> — ve tedarikçi raporunun <em>Layout Data</em> satırına '
    + 'oturur.</p>';

  var m = (typeof veFeadSpringSetup === 'function') ? veFeadSpringSetup(td) : {};
  var a = Number(td.armLen), th = Number(b.armAbsDeg) * Math.PI / 180;
  var cenX = Number(td.pivotX) + a * Math.cos(th);
  var cenY = Number(td.pivotY) + a * Math.sin(th);
  var env = b.envelope || {};

  h += _gfTablo('Zarf çözümü — gergi panelindeki okuma',
    ['Büyüklük', 'Değer', 'Nasıl çıktı'],
    [
      ['Yay kurulması', _gfFs(m.relMeanDeg, 2) + '°',
        '(M<sub>çalışma</sub> − M<sub>ön</sub>) / k — salt yay künyesinden'],
      ['<strong>Kol çalışma açısı</strong>', '<strong>' + _gfFs(b.armAbsDeg, 2) + '°</strong>',
        '360°’lik zarf tarandı; en küçük take-up’ı en büyük yapan açı seçildi'],
      ['Gergi kasnağının merkezi', _gfFs(cenX, 2) + ' / ' + _gfFs(cenY, 2) + ' mm',
        'Pivottan kol boyu kadar uzakta, seçilen açıda'],
      ['<strong>Gereken kayış boyu</strong>',
        '<strong>' + _gfFs(b.beltLengthMm, 2) + ' mm</strong>',
        'Seçilen kol açısında kapanan kayış yolunun efektif boyu'],
      ['Tasarım gerginliği', _gfFs(b.springTensionN, 2) + ' N',
        'Yay dengesinden: T = M / (dL/dθ)'],
      ['Ölçüt değeri', _gfFs(env.best && env.best.takeupMin, 4) + ' mm/°',
        'Servis zarfı boyunca görülen en küçük take-up'],
      ['Zarfın çözülebilen yayı', _gfFs(env.feasibleDeg, 0) + '° / 360°',
        'Geçerli geometri veren montaj açıları']
    ], ['l', 'c', 'l']);

  var dMerkez = Math.sqrt(Math.pow(cenX - G.tenXY[0], 2) + Math.pow(cenY - G.tenXY[1], 2));
  h += _gfTablo('Türeyen değerler ↔ tedarikçi raporu',
    ['Büyüklük', 'MFSim', 'Tedarikçi raporu', 'Fark'],
    [
      ['Kayış efektif boyu', _gfFs(b.beltLengthMm, 2) + ' mm', _gfFs(G.belt, 1) + ' mm',
        _gfSapma(b.beltLengthMm, G.belt)],
      ['Tasarım gerginliği', _gfFs(b.springTensionN, 2) + ' N', _gfFs(G.design, 0) + ' N',
        _gfSapma(b.springTensionN, G.design)],
      // Bu satır 14.1'deki uyarının SAYISAL kapanışı: girilen nokta gerçekten
      // pivot olarak kullanılıyorsa, ondan türeyen kasnak merkezi raporun
      // KENDİ Layout Data satırına oturmalı. Oturuyor.
      ['Gergi kasnağının merkezi', _gfFs(cenX, 2) + ' / ' + _gfFs(cenY, 2) + ' mm',
        _gfFs(G.tenXY[0], 2) + ' / ' + _gfFs(G.tenXY[1], 2) + ' mm',
        _gfFs(dMerkez, 2) + ' mm']
    ], ['l', '', '', 'c']);

  h += _gfOnay('İki bağımsız doğrulama',
      '<strong>Bir:</strong> program kayışı <strong>hiç görmeden</strong> tedarikçinin kendi '
    + 'kayışını geri verdi. Seçim ölçütü kayış verisine girmez — kolun gezinme aralığı yalnız '
    + 'yay künyesinden (M<sub>çalışma</sub>, M<sub>ön</sub>, k) türetilir. Bu, kayış boyunun '
    + 'bir çıktı olabilmesinin ön koşuludur: aksi hâlde döngü kurulurdu.<br><br>'
    + '<strong>İki:</strong> yalnız montaj referans noktası verilerek türetilen gergi kasnağı '
    + 'merkezi, raporun <em>Layout Data</em> tablosundaki gergi satırından '
    + _gfFs(dMerkez, 2) + ' mm uzakta. O satır modele hiç girmedi; girilen noktanın '
    + 'gerçekten <strong>kolun döndüğü nokta</strong> olarak kullanıldığının kanıtı bu.');

  // ── 14.3 Şema ────────────────────────────────────────────────────────────
  var svg = null;
  try {
    if(typeof veFeadLayoutSVG === 'function')
      svg = veFeadLayoutSVG(b, 820, 380, { posMode:'mean', compass:true, pivot:true, arrows:true });
  } catch(e){ svg = null; }
  if(svg){
    h += '<h3>14.3 Çözülmüş kayış yolu</h3>';
    h += '<figure class="appfig">' + svg + '<figcaption><b>Şekil ' + _gfFig() + ' —</b> '
      + 'Programın Kayış Yolu kartında gördüğünüz şemanın aynısı. Çizimde elle yerleştirilmiş '
      + 'tek bir koordinat yoktur: kasnak çemberleri girilen konum ve çaplardan, kayış yolu '
      + 'çözücünün teğet noktaları ve işaretli sarım yaylarından üretilir. Yol üstündeki '
      + 'dişler kayışın kaburgalı yüzünü gösterir; yeşil artı gergi pivotudur ve kesikli '
      + 'çizgi koldur.</figcaption></figure>';
  }

  // ── 14.4 Geometri ────────────────────────────────────────────────────────
  var geom = null;
  try { geom = FEADCore.tensionerState(b.sys, FEADCore.meanRel(b.sys)).geom; }
  catch(e){ geom = null; }
  if(geom){
    h += '<h3>14.4 Geometri</h3>';
    h += '<p>Kayış Yolu panelindeki geometri tablosu. Sağdaki iki sütun tedarikçi raporunun '
      + 'kendi değerleridir.</p>';
    var gsat = geom.names.map(function(nm, i){
      return [
        _gfE(nm),
        _gfFs(geom.wrapDeg(i), 1),
        _gfFs(G.wrap[i], 1),
        _gfFs(geom.exitSpanLen(i), 1),
        _gfFs(G.span[i], 1),
        _gfFs(FEADCore.speedRatio(b.sys, i), 3)
      ];
    });
    h += _gfTablo('Sarım açıları ve açıklık boyları',
      ['Kasnak', 'Sarım [°]', 'Rapor', 'Açıklık [mm]', 'Rapor', 'Hız oranı'],
      gsat, ['l', '', '', '', '', '']);
    h += _gfNot('İki farklı uzunluk — karıştırmayın',
        'Kayışın <strong>kendi efektif boyu</strong> ' + _gfFs(b.beltLengthMm, 2) + ' mm; '
      + 'kayışın bu güzergâhta kat ettiği <strong>efektif tahrik boyu</strong> ise '
      + _gfFs(geom.LeffMm, 1) + ' mm. Aradaki fark Çözücü panelindeki <em>boy ofsetidir</em> '
      + '(bu örnekte ' + _gfF(O.cozucu.data.lengthOffsetMm, 2) + ' mm). Rapor ikisini ayrı '
      + 'adlandırır; antette yan yana durdukları için bir dönem aynı sayının iki kez basıldığı '
      + 'sanılıyordu.<br><br>'
      + 'Σ işaretli sarım <strong>' + _gfFs(geom.signedWrapDeg, 2) + '°</strong> — çevrim '
      + 'kapandı. Bu sayı 360 değilse geometri geçersizdir ve kartın alt şeridi ✗ yazar.');
  }

  // ── 14.5 Çözüm ───────────────────────────────────────────────────────────
  if(R && R.ok && R.analysis && R.analysis.duty && R.analysis.duty.length){
    var d0 = R.analysis.duty[0];
    var isim = R.pulleyNames || b.names || [];
    h += '<h3>14.5 Çalışma çevrimi ve çözüm</h3>';
    h += '<p>Çalışma çevrimi tablosuna ' + R.analysis.duty.length + ' devir noktası girildi ve '
      + '<strong>▶ Hesapla</strong>’ya basıldı. Aşağıda ilk devir noktasının sonuçları var; '
      + 'panelde bütün noktalar tek tabloda görünür.</p>';
    var ssat = isim.map(function(nm, i){
      var p = d0.perPulley[i] || {}, hb = d0.hubloads[i] || {}, sl = d0.slip[i] || {};
      return [
        _gfE(nm),
        _gfFs(p.exitTensionN, 0), _gfFs(G.T880[i], 0),
        _gfFs(hb.FN, 0), _gfFs(G.H880[i], 0),
        _gfFs(sl.tensionRatio, 4),
        _gfFs(sl.SF, 2)
      ];
    });
    h += _gfTablo('Çıkış gerilmeleri, hubload ve kayma emniyeti — ' + d0.engineRpm + ' rpm',
      ['Kasnak', 'Gerilme [N]', 'Rapor', 'Hubload [N]', 'Rapor', 'Gerginlik oranı', 'SF'],
      ssat, ['l', '', '', '', '', '', '']);

    // Kayma emniyeti hükmü — YÜK TAŞIYAN ayrımıyla. Bu, kılavuzun §11.4'te
    // anlattığı okuma kuralının sayısal karşılığı; ayrım yapılmasaydı belge
    // kendi tavsiyesiyle çelişirdi.
    var esik = (typeof VE_FEAD_SLIP_LOADED_RATIO === 'number') ? VE_FEAD_SLIP_LOADED_RATIO : 1.01;
    var yuklu = [], hepsi = [];
    d0.slip.forEach(function(s, i){
      hepsi.push({ ad: isim[i], SF: s.SF, oran: s.tensionRatio });
      if(s.tensionRatio > esik) yuklu.push({ ad: isim[i], SF: s.SF, oran: s.tensionRatio });
    });
    function enKucuk(liste){
      var b0 = null;
      liste.forEach(function(x){ if(!b0 || x.SF < b0.SF) b0 = x; });
      return b0;
    }
    var gEn = enKucuk(hepsi), yEn = enKucuk(yuklu);
    var sfIst = Number(O.cozucu.data.serviceFact) || 0;
    if(gEn && yEn){
      h += _gfUyari('Aynı tablodan iki farklı hüküm çıkar',
          'Ham en küçük emniyet faktörü <strong>' + _gfFs(gEn.SF, 2) + '</strong> ve '
        + '<strong>' + _gfE(gEn.ad) + '</strong> kasnağına ait; servis faktörü '
        + _gfFs(sfIst, 2) + ' ile karşılaştırılırsa '
        + (gEn.SF >= sfIst ? 'geçer' : '<strong>kalır</strong>') + '. Ama o kasnağın '
        + 'gerginlik oranı <strong>' + _gfFs(gEn.oran, 4) + '</strong>, yani ~1: kayıştan '
        + 'güç çekmiyor, dolayısıyla oradaki sayı bir marj değil o sarım açısının '
        + '<strong>kapasitesidir</strong>.<br><br>'
        + 'Yük taşıyan kasnakların en küçüğü <strong>' + _gfFs(yEn.SF, 2) + '</strong> '
        + '(<strong>' + _gfE(yEn.ad) + '</strong>, oran ' + _gfFs(yEn.oran, 4) + ') ve '
        + 'servis faktörünü <strong>' + (yEn.SF >= sfIst ? 'karşılıyor' : 'karşılamıyor')
        + '</strong>. Rapor hükmünü bu ikinci sayıdan verir. Panelde ilk sütuna değil, '
        + '<strong>gerginlik oranına</strong> bakma alışkanlığı edinin.');
    }

    var ek = [];
    if(R.torsional && Number.isFinite(R.torsional.firstElasticHz))
      ek.push(['Burulma — 1. elastik mod', _gfFs(R.torsional.firstElasticHz, 2) + ' Hz',
        'Rapor ' + _gfFs(G.NF, 2) + ' Hz — sapma ' + _gfSapma(R.torsional.firstElasticHz, G.NF)]);
    if(R.tensionerSide)
      ek.push(['Gergi hangi tarafta',
        R.tensionerSide.ok ? '<span class="ok">gevşek ✓</span>' : 'gergin ✗',
        R.tensionerSide.ok ? 'Doğru yerleşim' : 'Dönüş yönünü çevirin']);
    ek.push(['Kayış hızı', _gfFs(d0.vMs, 2) + ' m/s', d0.engineRpm + ' rpm’de']);
    ek.push(['Ateşleme frekansı', _gfFs(d0.firingHz, 1) + ' Hz',
      'Silindir sayısından; açıklık rezonans kontrolünde kullanılır']);
    if(Array.isArray(R.beltDataOff) && R.beltDataOff.length)
      ek.push(['Üretilmeyen çıktılar', _gfE(R.beltDataOff.join(' · ')),
        'Kayış tipine bağlı çıktılar anahtarı <strong>kapalı</strong> (Bölüm 8.3)']);
    // 'Değer' sütunu yalnız sayı taşımıyor: kapatılan çıktıların listesi de
    // buraya giriyor ve nowrap bir `td.c`'de tabloyu taşırıyordu.
    h += _gfTablo('Diğer sonuçlar', ['Büyüklük', 'Değer', 'Not'], ek, ['l', 'l', 'l']);
  }

  // ── 14.6 Katalog ─────────────────────────────────────────────────────────
  if(typeof veFeadBeltOptions === 'function'){
    var o = null;
    try { o = veFeadBeltOptions(b, { count: 3 }); } catch(e){ o = null; }
    if(o && o.ok){
      h += '<h3>14.6 Hangi kayışı ısmarlamalı</h3>';
      h += '<p>Gereken boy <strong>' + _gfFs(o.targetMm, 2) + ' mm</strong>. Kayış panelinin '
        + 'katalog kartı, aday boyların her biri için kolun oturacağı açıyı ve çıkacak '
        + 'gerginliği hesaplar:</p>';
      var liste = o.stock.slice();
      if(o.grid && !liste.some(function(x){ return x.lengthMm === o.grid.lengthMm; }))
        liste.push(o.grid);
      liste.sort(function(x, y){ return x.lengthMm - y.lengthMm; });
      var ksat = liste.map(function(c){
        var f = c.fit || {};
        var sigar = !!(f.ok && f.fits);
        return [
          _gfF(c.lengthMm, 0),
          (c.deltaMm >= 0 ? '+' : '−') + _gfFs(Math.abs(c.deltaMm), 1),
          _gfE(c.code),
          (c.kind === 'grid') ? '◇ ızgara' : 'stok',
          sigar ? _gfFs(f.relDeg, 2) + '°' : '<em>sığmıyor</em>',
          sigar ? _gfFs(f.tensionN, 0) + ' N' : '—'
        ];
      });
      h += _gfTablo('Katalog adayları', ['Boy [mm]', 'Δ [mm]', 'Kod', 'Küme', 'Kol açısı',
        'Gerginlik'], ksat, ['', '', 'c', 'c', '', '']);
      h += _gfNot('Üç bağımsız yol tek noktada buluşuyor',
          'Zarf çözümü geometriden bir boy söyledi, katalog o boya en yakın adayı önerdi, ve '
        + 'önerilen kod tedarikçinin sisteme gerçekten taktığı kayıştır. Üç yol da aynı yere '
        + 'çıkmasaydı biri sessizce yanlış olurdu.');
    }
  }

  h += '<h3>14.7 Bu örneği kendiniz koşturmak</h3>';
  h += _gfAdimlar([
    'FEAD modülünün iç topolojisinde <strong>Başlangıç ve Örnekler</strong> kutusunu açın.',
    '<code>AG00976_GATES_2025</code> örneğini <strong>“İç topolojiye kur”</strong> ile '
      + 'yükleyin.',
    'Gergiye çift tıklayın; kol açısı kipini <strong>“Montaj koordinatından ZARFI ÇÖZ”</strong> '
      + 'yapın ve montaj merkezi alanlarını boşaltın.',
    'Kayış panelinde efektif boy alanını boşaltın — kip kendiliğinden SERBEST’e kilitlenir.',
    'Çözücüde <strong>▶ Hesapla</strong>’ya basın ve yukarıdaki sayıları karşılaştırın.'
  ]);
  return h;
}

function _gfEkA(){
  var h = _gfH2(14);
  h += '<p>Bir alanı nerede bulacağınızı hatırlamak için. Panel adları programdaki '
    + 'başlıklarla birebir aynıdır.</p>';
  h += _gfTablo('Alan → panel eşlemesi',
    ['Aradığınız', 'Panel', 'Kart'],
    [
      ['Kasnak çapı, konumu, temas tarafı', 'Kasnak', 'Temas Tarafı · Kasnak Geometrisi'],
      ['Sürücü kasnak seçimi', 'Kasnak', 'Rol'],
      ['Aksesuar güç eğrisi', 'Kasnak', 'Katalog Modeli · Güç Eğrisi'],
      ['Gergi montaj koordinatı (pivot)', 'Gergi', 'Otomatik Gergi Montaj Koordinatları'],
      ['Kol boyu', 'Gergi', 'Kol Künyesi'],
      ['Yay ön yükü, katsayısı, çalışma momenti', 'Gergi', 'Yay Künyesi'],
      ['Hazır gergi künyeleri', 'Gergi', 'Gergi Künye Kütüphanesi'],
      ['Kol açısını sabitleme', 'Gergi', 'Kol Açısı'],
      ['Gergi kasnak kütlesi, kol ataleti, load stop', 'Gergi', 'Mekanik Sınır ve Atalet'],
      ['Kayış profili ve markası', 'Kayış Özellikleri', 'Profil ve Marka'],
      ['Kanal sayısı, tolerans, aşınma payı', 'Kayış Özellikleri', 'Künye'],
      ['Kayış boyu kipi', 'Kayış Özellikleri', 'Kayış Boyu (ya da tuvaldeki rozet)'],
      ['Katalog aday boyları', 'Kayış Özellikleri', 'Katalog'],
      ['Kayış tipine bağlı çıktılar anahtarı', 'Kayış Özellikleri',
        'Kayış Tipine Bağlı Çıktılar'],
      ['Tahrik oranı / krank ve fan çapı', 'Çözücü', 'Birinci Kademe'],
      ['Silindir sayısı, servis faktörü, krank ataleti', 'Çözücü', 'Motor Künyesi'],
      ['Devir, %zaman, sıcaklık, aksesuar kW', 'Çözücü', 'Çalışma Çevrimi'],
      ['Yorulma modeli ve boy ofseti', 'Çözücü', 'Tasarım'],
      ['Türeyen tasarım gerginliği', 'Çözücü', 'Algılanan Model'],
      ['Gergi kol konumları (altı konum)', 'Çözücü', 'Gergi Konum Tablosu'],
      ['Sarım, açıklık, hız oranı', 'Kayış Yolu', 'Geometri'],
      ['Gergi kol konumu seçici, yön gülü', 'Kayış Yolu', 'Şema'],
      ['Rapor türü ve doküman künyesi', 'Rapor', '—'],
      ['Dönüş yönü, konum bağı', '—', 'Tuvaldeki rozetler']
    ], ['l', 'c', 'l']);
  return h;
}

// ═══════════════════════════════════════════════════════════════════════════
//  BELGE MONTAJI
// ═══════════════════════════════════════════════════════════════════════════

function veGuideFeadHTML(){
  _gfTblNo = 0; _gfFigNo = 0;

  var tarih = new Date().toLocaleDateString('tr-TR',
    { year: 'numeric', month: 'long', day: 'numeric' });

  var govde = veGuideAntet({
    eyebrow: 'MFSim · FEAD Modülü · Kullanım Kılavuzu',
    h1: 'FEAD Modelleme Kılavuzu',
    sub: 'Kasnak yerleşiminden rapora: adım adım modelleme, girdi haritası, '
       + 'sonuçların okunması ve işlenmiş örnek',
    fields: [
      ['Belge', 'Kullanım kılavuzu'],
      ['Modül', 'FEAD — kayış-kasnak'],
      ['Kapsam', VE_GUIDE_FEAD_SECTIONS.length + ' bölüm'],
      ['Örnek', 'canlı hesaplanır'],
      ['Tarih', tarih]
    ]
  });

  govde += veGuideToc(VE_GUIDE_FEAD_SECTIONS);

  govde += _gfSec1() + _gfSec2() + _gfSec3() + _gfSec4() + _gfSec5() + _gfSec6()
         + _gfSec7() + _gfSec8() + _gfSec9() + _gfSec10() + _gfSec11() + _gfSec12()
         + _gfSec13() + _gfSec14() + _gfEkA();

  return veGuideDocHTML({
    title: 'MFSim — FEAD Modelleme Kılavuzu',
    body: govde
  });
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    VE_GUIDE_FEAD_SECTIONS: VE_GUIDE_FEAD_SECTIONS,
    VE_GUIDE_FEAD_GATES: VE_GUIDE_FEAD_GATES,
    _gfOrnekCoz: _gfOrnekCoz, _gfSapma: _gfSapma,
    veGuideFeadHTML: veGuideFeadHTML
  };
}
