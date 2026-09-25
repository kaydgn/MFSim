// ============================================================================
// TEMA YÖNETİMİ — İKİ ZEMİN, ÜÇ KİP
// ============================================================================
// Burada bir zamanlar ondokuz tema vardı ve Ayarlar > Görünüm onları kart kart
// listeliyordu. Hepsi kaldırıldı: program artık TEK tasarim dili taşıyor ve o
// dilin iki zemini var. Kullanıcının seçtiği şey bir palet değil bir KİP:
//
//     acik · koyu · sistem        (sistem = işletim sistemini izle)
//
// Kip ile KİMLİK ayrı şeylerdir. localStorage bir KİP tutar; `data-theme`
// attribute'una yazılan ise çözülmüş KİMLİK ('acik' ya da 'koyu') — 'sistem'
// diye bir CSS bloğu yoktur ve yazılsaydı belge sessizce :root'a düşerdi.
//
// KİMLİKLER TEK KELİME VE TİRESİZ: js/loader.js'in ilk-kare süzgeci /^[a-z]+$/
// ve tireli bir kimlik oradan geçmez — geçmezse loader'ın ölçüp kapattığı
// açılış renk sıçraması geri gelir.
// Kapı: tests/unit/theme-consistency.test.js › "süzgeci GEÇERLİ her tema
// kimliğini kabul ediyor".

var MF_ACIK = 'acik';
var MF_KOYU = 'koyu';
var MF_ANAHTAR = 'mf-theme';

// Geçerli kipler. Ayarlar > Görünüm menüsü bununla senkron olmak zorunda
// (kapı: theme-consistency.test.js).
var MF_KIPLER = ['acik', 'koyu', 'sistem'];

// VARSAYILAN TEK YERDE. Kullanıcı kararı (2026-09-09, karşılama reçetesi):
// hiç seçim yapmamış kopya AÇIK açılır — 'sistem' DEĞİL. Bu sabit programda
// başka hiçbir yerde tekrarlanmaz; Ayarlar penceresi de kendi varsayılanını
// tutmaz, aşağıdaki veThemeStoredKip()'i çağırır. Eskiden tutuyordu ve
// ayrışmıştı: program pearl açılıyor, pencere Midnight işaretli gösteriyordu.
var MF_VARSAYILAN = MF_ACIK;

// ── Eski kimlik göçü ────────────────────────────────────────────────────────
// Ondokuz temanın kayıtlı seçimleri tarayıcılarda duruyor. Göç yapılmazsa
// o kopyalar tanınmayan bir kimlik taşır, belge :root'a düşer ve kullanıcı
// koyu tema seçmişken AÇIK açılır — hiçbir şey patlamaz, yani sessiz.
// Eşleme ailelere göre: hangi tema light, hangisi dark bildiriyorduysa.
var MF_ESKI_KIMLIK = {
  slate: MF_KOYU, cream: MF_KOYU, claude: MF_KOYU, ansys: MF_KOYU,
  fusion: MF_KOYU, vscode: MF_KOYU, navy: MF_KOYU, graphite: MF_KOYU,
  ink: MF_KOYU, basalt: MF_KOYU, mono: MF_KOYU, contrast: MF_KOYU,
  amber: MF_KOYU, scope: MF_KOYU,
  pearl: MF_ACIK, steel: MF_ACIK, solidworks: MF_ACIK, paper: MF_ACIK,
  zinc: MF_ACIK
};

// Ham bir depolama değerini geçerli bir KİPE çevirir. Tanınmayan her şey
// varsayılana düşer — bozuk kayıt programı durdurmaz.
function veThemeKip(ham) {
  if (MF_KIPLER.indexOf(ham) >= 0) return ham;
  if (MF_ESKI_KIMLIK[ham]) return MF_ESKI_KIMLIK[ham];
  return MF_VARSAYILAN;
}

// İşletim sistemi koyu mu? Tarayıcı bilmiyorsa AÇIK kabul edilir —
// belirsizlikte kâğıt, ekranın varsayılanı.
function veThemeOsKoyu() {
  try {
    return !!(window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
  } catch (e) { return false; }
}

// KİP → data-theme KİMLİĞİ. 'sistem' burada çözülür.
function veThemeKimlik(kip) {
  if (kip === MF_KOYU) return MF_KOYU;
  if (kip === MF_ACIK) return MF_ACIK;
  return veThemeOsKoyu() ? MF_KOYU : MF_ACIK;
}

// Kayıtlı kip — göç dâhil. Ayarlar penceresi de bunu okur; ikinci bir
// varsayılan doğmasın diye.
function veThemeStoredKip() {
  var v = null;
  try { v = localStorage.getItem(MF_ANAHTAR); } catch (e) {}
  return veThemeKip(v);
}

// ── Uygulama ────────────────────────────────────────────────────────────────
// TEK GİRİŞ. js/results.js bu fonksiyonu SARMALAYARAK grafik önbelleğini
// temizliyor (_drTC); tema değişimi için ikinci bir yol açılırsa panolar
// sayfa yenilenene kadar eski renklerde kalır. Sistem takibi de buradan
// geçer, kendi başına attribute yazmaz.
function changeTheme(kip) {
  if (!kip) return;
  var k = veThemeKip(kip);
  document.documentElement.setAttribute('data-theme', veThemeKimlik(k));
  try { localStorage.setItem(MF_ANAHTAR, k); } catch (e) {}
  // Ayarlar > Görünüm'deki kip düğmelerinin aktif (✓) durumu
  document.querySelectorAll('[data-mf-theme]').forEach(function (el) {
    el.classList.toggle('active', el.getAttribute('data-mf-theme') === k);
  });
}

// Tema değişkenini canvas'ın anlayacağı 'rgba(r,g,b,a)' dizgesine çevirir.
// Canvas API'si (fillStyle/strokeStyle/addColorStop) CSS değişkeni çözemez;
// bu yardımcı çizim anında çağrılır → tema değişince bir sonraki çizimde
// yeni renk gelir (minimap'in kullandığı teknikle aynı). Tüm temalar 6 haneli
// hex tanımlar; çözülemeyen değerde fallback döner ki grafik hiç renksiz
// kalmasın.
// ÖNBELLEKSİZ, BİLEREK. Çizim döngüsünde kare başına onlarca çağrı olduğu için
// bir önbellek denendi ve GERİ ALINDI: jeton değeri `changeTheme` dışında bir
// yoldan değişirse (bir testin kurduğu sahne, ileride bir kullanıcı teması)
// önbellek bayat kalıyor ve köprü "şu anki değeri oku" sözünü bozuyor.
// Kazanç ÖLÇÜLMEDEN eklenmişti; sözleşme ölçülmüş bir kazanç için bile
// bozulmazdı. Çağıran tarafta önbellek meşru ve zaten var —
// `js/results.js` → `_drThemeColors()` tema değişiminde sıfırlanıyor.
function veThemeRgba(varName, alpha, fallback) {
  var v = '';
  try {
    v = getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
  } catch(e) {}
  var m = /^#([0-9a-fA-F]{6})$/.exec(v);
  if(!m) return fallback || v || '#888888';
  var n = parseInt(m[1], 16);
  return 'rgba(' + (n >> 16 & 255) + ',' + (n >> 8 & 255) + ',' + (n & 255) + ',' + alpha + ')';
}

// TUVALİN YAZI YÜZÜ — CSS'teki `--font-sans`ı okur (tek yüz, 2026-09-23).
// Canvas'ın `font` özelliği `var()` çözemez (renk köprüsünün gerekçesinin
// aynısı). Grafikler yüzü kendileri yazıyordu ve dört aile doğmuştu —
// Segoe UI · Arial · system-ui · sans-serif: Windows'ta her grafik arayüzden
// farklı bir yüzle çiziliyordu. Önbelleksiz, `veThemeRgba` ile aynı sözleşme.
// Yedek aile yalnız jeton okunamazsa (test ortamı) devreye girer.
function veThemeFontFamily() {
  var aile = '';
  try {
    aile = getComputedStyle(document.documentElement).getPropertyValue('--font-sans').trim();
  } catch(e) {}
  return aile || "'Segoe UI', Inter, -apple-system, sans-serif";
}
// Tuvalin `font` kısaltması: '600 11px <aile>'. Grafik kütüphaneleri (Plotly)
// yalnız aileyi ister → `veThemeFontFamily()`.
function veThemeFont(px, weight) {
  return (weight ? weight + ' ' : '') + px + 'px ' + veThemeFontFamily();
}

// BELGEYE GİDEN YÜZ — indirilen rapor ve kılavuz uygulamanın stil sayfasını
// kullanamaz (tek başına açılıyor), arayüzün yüzünü KENDİ İÇİNE gömmek
// zorunda. Kaynak ikinci bir kopya DEĞİL: arayüzün kendi @font-face kuralları
// (css/fonts.css — build onu <style> olarak gömüyor, yani tek dosya ürününde
// kurallar her zaman okunur). Eskiden raporlar kendi üç yüzünü (Archivo ·
// Source Serif 4 · IBM Plex Mono) ayrı bir pakette taşıyordu: aynı program
// ekranda bir, kâğıtta üç aileyle yazıyordu (2026-09-23).
// Okunamazsa (modüler kopya file:// üzerinde — tarayıcı başka dosyanın
// kurallarını vermiyor) boş döner ve belge sistem yazısına düşer.
// Gömülen, yığında @font-face kuralı OLAN ailedir, ilk aile değil: yığının
// başı Segoe UI (2026-09-25) ve o gömülemez — sistemde kurulu. İlk aileye
// bakılsaydı belge sessizce yazı tipsiz kalırdı.
function veThemeFontFaceCss() {
  var aileler = veThemeFontFamily().split(',').map(function(a) {
    return a.replace(/["']/g, '').trim().toLowerCase();
  });
  var out = [];
  try {
    var ss = document.styleSheets;
    for (var i = 0; i < ss.length; i++) {
      var kurallar = null;
      try { kurallar = ss[i].cssRules; } catch (e) { kurallar = null; }
      if (!kurallar) continue;
      for (var j = 0; j < kurallar.length; j++) {
        var r = kurallar[j];
        if (r.type !== 5) continue;                       // CSSRule.FONT_FACE_RULE
        var ad = String((r.style && r.style.getPropertyValue('font-family')) || '').replace(/["']/g, '').trim();
        if (ad && aileler.indexOf(ad.toLowerCase()) >= 0) out.push(r.cssText);
      }
    }
  } catch (e) {}
  return out.join('\n');
}

// Sayfa yüklendiğinde kayıtlı kipi uygula. İlk kare ZATEN boyandı
// (index.html'in satır içi betiği + js/loader.js); bu çağrı kipi normalleştirir
// ve eski kimlik kaydını yeni sözlüğe yazar.
document.addEventListener('DOMContentLoaded', function() {
  changeTheme(veThemeStoredKip());
});

// SİSTEM kipindeyken işletim sistemi gün batımında koyuya dönerse program da
// o anda dönmeli — "sistem gibi davranmak" bu. Elle seçim yapılmışsa
// dokunulmaz. changeTheme üzerinden geçer, yani grafik önbelleği de temizlenir.
(function () {
  var mq;
  try { mq = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)'); } catch (e) { return; }
  if (!mq) return;
  var onChange = function () {
    if (veThemeStoredKip() === 'sistem') changeTheme('sistem');
  };
  // addEventListener eski Safari'de yok; addListener kaldırıldı ama hâlâ
  // çalışıyor. İkisi de yoksa takip sessizce devre dışı kalır, program çalışır.
  if (mq.addEventListener) mq.addEventListener('change', onChange);
  else if (mq.addListener) mq.addListener(onChange);
})();

// Birim testleri için (tarayıcıda etkisiz)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    MF_ACIK: MF_ACIK,
    MF_KOYU: MF_KOYU,
    MF_KIPLER: MF_KIPLER,
    MF_VARSAYILAN: MF_VARSAYILAN,
    MF_ESKI_KIMLIK: MF_ESKI_KIMLIK,
    veThemeKip: veThemeKip,
    veThemeKimlik: veThemeKimlik,
    veThemeStoredKip: veThemeStoredKip,
    changeTheme: changeTheme,
    veThemeRgba: veThemeRgba
  };
}
