/**
 * build-shield.js — tek dosya build'lerinin ortak "ham metin sonlandırıcı" kalkanı
 * ═══════════════════════════════════════════════════════════════════════════════
 *
 * NEDEN VAR
 * ─────────
 * Geliştirmede (index.html, viewer/index.html) modüller HARİCİ dosyadır:
 * `<script src="js/results.js">`. İçeriklerinde ne geçerse geçsin HTML'i
 * ilgilendirmez.
 *
 * Tek dosya build'inde ise aynı içerik bir `<script>` etiketinin İÇİNE girer.
 * HTML ayrıştırıcısı script gövdesini "script data" kipinde okur ve gördüğü
 * İLK `</script` dizisinde elemanı KAPATIR — dizgenin JS'te bir string, regex
 * ya da yorum içinde olması hiç fark etmez. Kapandıktan sonra kaynağın geri
 * kalanı HTML olarak ayrıştırılır:
 *   • ham kod ekrana metin olarak dökülür,
 *   • dizgelerdeki `<div ...>` parçaları GERÇEK elemana dönüşür,
 *   • bu elemanlar ekranı kaplayıp tüm tıklamaları yutar,
 *   • modülün kalanı sözdizimi hatası verir, hiç yüklenmez.
 *
 * 2026-08 olayı: js/results.js'e KaTeX gömülürken üç ham `</script>` girdi
 * (biri, tam da bu tuzağı anlatan yorumun içindeydi). MFSim_Code.html 12775.
 * satırda erken kapandı; ~90 KB kaynak sayfaya döküldü ve gövdeye giren
 * `<div class="ve-trace-empty">` ana ekranı tıklanamaz yaptı. index.html'de
 * hata GÖRÜNMÜYORDU — kırılan yalnızca yayınlanan tek dosyaydı. Bu modül, o
 * asimetriyi build tarafında kapatır.
 *
 * İKİ KATMAN
 * ──────────
 *   1) shieldScriptEnd() — GİRDİ tarafı: gömülecek JS'teki `</script` dizisini
 *      `<\/script` yapar. Kaçış anlamı değiştirmez (aşağıda gerekçe).
 *   2) countScriptElements() — ÇIKTI tarafı: üretilen HTML'de tarayıcının
 *      göreceği script elemanı sayısını, kasten yazdığımız sayıyla karşılaştırır.
 *      Kaçış bir şekilde atlanırsa build DURUR, bozuk dosya yayınlanmaz.
 *
 * TÜRKÇE TUZAĞI — toLowerCase() KULLANMAYIN
 * ─────────────────────────────────────────
 * 'İ' (U+0130) küçültülünce 'i' + U+0307 olur: dizge UZAR, tüm indeksler kayar.
 * Bu depo Türkçe yorumlarla dolu. Bu yüzden aramalar küçük harfe çevirerek
 * değil, 'i' bayraklı regex + lastIndex ile yapılır.
 */

var vm = require('vm');

// `</script` dizisini kaçır. Dönen kod, HTML'e gömüldüğünde bloğu erken
// kapatamaz.
//
// GÜVENLİ Mİ: evet. `</script` dizisi geçerli JS'te ancak dizge, regex ya da
// yorum içinde bulunabilir. Dizgede '<\/script>' ile ham hâli AYNI değeri
// üretir (JS'te tanınmayan kaçışlar karakterin kendisine düşer); regexte '\/'
// zaten '/' demektir; yorumda tamamen etkisizdir.
//
// Yine de varsayımla yetinilmez: kaçış bir şey değiştirdiyse kod YENİDEN
// derlenir. Anlam bozulduysa build sessizce geçmez.
function shieldScriptEnd(js, label) {
  if (!/<\/script/i.test(js)) return { code: js, escaped: 0 };

  var escaped = js.split(/<\/script/i).length - 1;
  var out = js.replace(/<\/(script)/gi, '<\\/$1');

  try {
    new vm.Script(out, { filename: label || 'shield' });
  } catch (e) {
    var err = new Error(
      '"</script>" kaçışı ' + (label || 'kaynak') + ' dosyasının sözdizimini bozdu: ' + e.message +
      '\n  Kaynakta dizge/yorum dışında bir "</script" var. Elle düzeltin.');
    err.mfsimShield = true;
    throw err;
  }

  return { code: out, escaped: escaped };
}

// Büyük/küçük harf duyarsız arama — dizgeyi küçültmeden (bkz. 'İ' tuzağı).
function indexOfCI(src, needle, from) {
  var re = new RegExp(needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
  re.lastIndex = from;
  var m = re.exec(src);
  return m ? m.index : -1;
}

// HTML ayrıştırıcısını taklit ederek script ELEMANI say.
//
// Üç yapı önemlidir, çünkü üçü de kendi "ham metin" kipini kurar ve içlerindeki
// '<' bir etiket BAŞLATMAZ:
//   <!-- … -->            yorum    → '-->' ile biter
//   <style> … </style>    RAWTEXT  → '</style' ile biter
//   <script> … </script>  script   → '</script' ile biter
// Bunları atlamazsak, gömülü CSS'te ya da bir yorumda geçen "<script" sahte
// alarm üretir.
function countScriptElements(src) {
  var TOKEN = /<!--|<style\b|<script\b/gi;
  var n = 0, end;
  TOKEN.lastIndex = 0;
  var m;
  while ((m = TOKEN.exec(src))) {
    var tok = m[0].slice(0, 6).toLowerCase();   // '<!--' | '<style' | '<scrip'
    if (tok === '<!--') {
      end = src.indexOf('-->', m.index);
      if (end === -1) break;
      TOKEN.lastIndex = end + 3;
    } else if (tok === '<style') {
      end = indexOfCI(src, '</style', m.index);
      if (end === -1) break;
      TOKEN.lastIndex = end + 7;
    } else {
      n++;
      end = indexOfCI(src, '</script', m.index);
      if (end === -1) break;
      TOKEN.lastIndex = end + 8;
    }
  }
  return n;
}

// Belgedeki TOPLAM `</script` dizisi sayısı (nerede geçtiğine bakmaksızın).
//
// KANIT ARACI: sağlam bir belgede her script elemanı kapanışını TAM BİR KEZ
// yazar, ve `</script` başka hiçbir yerde geçemez (geçseydi zaten bir elemanı
// kapatırdı). Yani
//
//     countScriptClosers(html) === countScriptElements(html)
//
// Bir gövdede ham `</script` kaldıysa o dizi elemanı erken kapatır, asıl
// kapanış ise ARTIK METİN olur: kapanış sayısı eleman sayısını AŞAR. Eşitlik
// bu yüzden "hiçbir blok erken kapanmıyor"un doğrudan kanıtıdır — eleman
// sayısını kıyaslamaktan farklı olarak kandırılamaz. (İlk yazımda yalnızca
// eleman sayısı kıyaslanıyordu; bir gövdede hem ham `</script` hem ham
// `<script>` varsa sayı tesadüfen tutabiliyordu.)
function countScriptClosers(src) {
  return (src.match(/<\/script/gi) || []).length;
}

// <style> blokları için aynı tuzak: gömülen CSS'te ham `</style` varsa stil
// bloğu erken kapanır ve CSS'in kalanı sayfaya metin olarak dökülür.
function shieldStyleEnd(css) {
  if (!/<\/style/i.test(css)) return { code: css, escaped: 0 };
  // CSS'te ters bölü kaçışı JS'teki gibi çalışmaz; güvenli yol, '/' karakterini
  // CSS'in kendi kaçışıyla yazmaktır: '\2f ' → '/'. Yalnızca kapanış dizisinde.
  var escaped = css.split(/<\/style/i).length - 1;
  return { code: css.replace(/<\/(style)/gi, '<\\2f $1'), escaped: escaped };
}

// Üretilen tek dosyanın script blokları sağlam mı? Sağlamsa null, değilse
// insan okuyabilir bir hata metni döner. İki bağımsız iddia:
//
//   1) kapanış sayısı === eleman sayısı  → hiçbir blok erken kapanmıyor (kanıt)
//   2) eleman sayısı === kastedilen sayı → hiçbir blok kaybolmamış/eklenmemiş
//
// (1) asıl kapıdır; (2) gömme mantığındaki başka bir sapmayı yakalar.
function verifyScriptBlocks(html, intended) {
  var elements = countScriptElements(html);
  var closers = countScriptClosers(html);

  if (closers !== elements) {
    return 'Script blokları bozuk! Belgede ' + closers + ' adet "</script" var ama ' +
      'tarayıcı yalnızca ' + elements + ' script elemanı görüyor.\n' +
      '  Gömülen bir kaynakta ham "</script>" dizisi bloğu ERKEN KAPATIYOR: kalan\n' +
      '  kaynak HTML olarak ayrıştırılır, ekrana ham kod dökülür ve sayfa\n' +
      '  tıklanamaz hâle gelir. Kaynakta "<\\/script>" yazın.';
  }
  if (typeof intended === 'number' && elements !== intended) {
    return 'Script blok sayısı beklenenden farklı: ' + elements + ' bulundu, ' +
      intended + ' kastedildi.\n' +
      '  Gömme sırasında bir <script> bloğu kayboldu ya da fazladan eklendi.';
  }
  return null;
}

module.exports = {
  shieldScriptEnd, shieldStyleEnd,
  countScriptElements, countScriptClosers, verifyScriptBlocks,
  indexOfCI,
};
