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
  // İKİ tuzak kesilir:
  //   "</script" → bloğu erken kapatır.
  //   "<!--"     → tokenizer'ı ESCAPED kipe sokar; gövdede ayrıca "<script"
  //                geçiyorsa DOUBLE escaped kipe geçilir ve bizim kapanış
  //                etiketimiz artık KAPATMAZ (bkz. scanScriptBody). Tek başına
  //                zararsızdır, ama zinciri burada kesmek en ucuzu.
  // '<\!--' JS'te '<!--' ile aynı değeri üretir (tanınmayan kaçış karakterin
  // kendisine düşer). Kaynakta "<!--" ESKİ tarz tek satırlık JS yorumu olarak
  // kullanılıyorsa kaçış sözdizimini bozar — aşağıdaki yeniden derleme bunu
  // yakalar ve build durur, sessizce yanlış dosya üretilmez.
  if (!/<\/script/i.test(js) && js.indexOf('<!--') === -1) {
    return { code: js, escaped: 0 };
  }

  var escaped = (js.split(/<\/script/i).length - 1) + (js.split('<!--').length - 1);
  var out = js.replace(/<\/(script)/gi, '<\\/$1').replace(/<!--/g, '<\\!--');

  try {
    new vm.Script(out, { filename: label || 'shield' });
  } catch (e) {
    var err = new Error(
      'Kaçış ' + (label || 'kaynak') + ' dosyasının sözdizimini bozdu: ' + e.message +
      '\n  Kaynakta dizge/yorum DIŞINDA bir "</script" ya da "<!--" var.' +
      '\n  ("<!--" satır başında eski tarz JS yorumudur; "//" ile değiştirin.)' +
      '\n  Elle düzeltin — build bozuk dosya üretmemek için durdu.');
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

// Açılış etiketinin '>' konumu. Tırnaklı attribute değerleri atlanır, yoksa
// data-mfsim-label="… > …" gibi bir değer etiketi erken bitirirdi.
function endOfOpenTag(src, from) {
  var q = null;
  for (var i = from; i < src.length; i++) {
    var c = src[i];
    if (q) { if (c === q) q = null; }
    else if (c === '"' || c === "'") q = c;
    else if (c === '>') return i;
  }
  return -1;
}

// ── script gövdesinin GERÇEK kip makinesi ────────────────────────────────
//
// Script gövdesi TEK kipli değildir. HTML tokenizer'ında üç kip vardır ve
// geçişler şöyledir:
//
//   script data          --  "<!--"   -->  script data ESCAPED
//   script data escaped  --  "<script" -->  script data DOUBLE escaped
//   herhangi escaped kip --  "-->"    -->  script data
//
// KRİTİK: DOUBLE escaped kipte "</script>" elemanı KAPATMAZ — yalnızca
// escaped kipe geri döner. Yani bir gövdede "<!--" ve ardından "<script"
// geçiyorsa, bizim yazdığımız kapanış etiketi işe yaramaz: blok kapanmaz,
// belgenin GERİ KALANI o script'in metni olur ve sayfadan hiçbir şey çizilmez.
//
// Bu kapının ilk yazımı bu kipleri modellemiyordu ve tam bu durumu "temiz"
// diye geçiriyordu (gerçek Chromium ile ölçülüp doğrulandı). Bugün js/ içinde
// hiç "<!--" yok, ama js/loader.js, js/results.js ve viewer/js/app.js zaten
// "<script …>" dizgeleri kuruyor — tuzağın yarısı hazır. Bir geliştiricinin
// HTML yorumundan söz eden bir yoruma "<!--" yazması yeterdi. 2026-08 olayının
// kök nedeni de tam olarak buydu: ham dizge, tuzağı ANLATAN yorumun içindeydi.
//
// Ayrıca: kapanış "</script" dizisinden sonra tab/LF/FF/boşluk, '/' ya da '>'
// gelirse geçerlidir — yalnız "</script>" aramak yetmez ("</script " ve
// "</script/" da kapatır; Chromium ile ölçüldü).
function scanScriptBody(src, from) {
  var TOK = /<!--|-->|<\/script(?=[\t\n\f \/>]|$)|<script(?=[\t\n\f \/>]|$)/gi;
  TOK.lastIndex = from;
  var state = 0;              // 0 = data, 1 = escaped, 2 = double escaped
  var neutralized = 0;        // DOUBLE kipte yutulan kapanışlar
  var m;
  while ((m = TOK.exec(src))) {
    var t = m[0];
    if (t === '<!--') {
      if (state === 0) state = 1;
    } else if (t === '-->') {
      state = 0;
    } else if (t.charAt(1) === '/') {        // </script
      if (state === 2) { state = 1; neutralized++; }   // KAPATMAZ, escaped'e döner
      else return { end: m.index, neutralized: neutralized };
    } else {                                  // <script
      if (state === 1) state = 2;
    }
  }
  return { end: -1, neutralized: neutralized };   // blok hiç kapanmadı
}

// Belgeyi tarayıcı gibi gez: script ve style elemanlarını say, kapanmayanları
// bildir. Ham metin kipleri (<!-- -->, <style>, <script>) atlanır — gömülü
// CSS'te ya da bir HTML yorumunda geçen "<script" sahte alarm üretmesin.
// "</script" da bir jetondur: DATA kipinde (yani hiçbir elemanın içinde
// değilken) rastlanan bir kapanış etiketi ÖKSÜZDÜR ve erken kapanmanın
// doğrudan imzasıdır — bizim yazdığımız kapanış, bloğu bir başkası erkenden
// kapattığı için metne düşmüştür.
function scanDocument(src) {
  var OPEN = /<!--|<script(?=[\t\n\f \/>])|<style(?=[\t\n\f \/>])|<\/script(?=[\t\n\f \/>]|$)/gi;
  var scripts = 0, styles = 0, unclosed = [], stray = 0, neutralized = 0;
  var i = 0, m;
  while (true) {
    OPEN.lastIndex = i;
    m = OPEN.exec(src);
    if (!m) break;

    if (m[0] === '<!--') {
      // BELGE düzeyinde HTML yorumu — içindeki her şey metindir, atlanır.
      var ce = src.indexOf('-->', m.index + 4);
      i = (ce === -1) ? src.length : ce + 3;
      continue;
    }

    if (m[0].charAt(1) === '/') { stray++; i = m.index + 8; continue; }

    var gt = endOfOpenTag(src, m.index);
    if (gt === -1) break;

    if (/^<script$/i.test(m[0])) {
      scripts++;
      var r = scanScriptBody(src, gt + 1);
      neutralized += r.neutralized;
      if (r.end === -1) { unclosed.push('script'); break; }
      i = r.end + 8;
    } else {
      styles++;
      // <style> düz RAWTEXT'tir: escaped kip yok, yalnız "</style" bitirir.
      var ye = (function () {
        var re = /<\/style(?=[\t\n\f \/>]|$)/gi;
        re.lastIndex = gt + 1;
        var mm = re.exec(src);
        return mm ? mm.index : -1;
      })();
      if (ye === -1) { unclosed.push('style'); break; }
      i = ye + 7;
    }
  }
  return { scripts: scripts, styles: styles, unclosed: unclosed,
           stray: stray, neutralized: neutralized };
}

// Tarayıcının göreceği script ELEMANI sayısı.
function countScriptElements(src) {
  return scanDocument(src).scripts;
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
// TANI amaçlı ham sayaç. KAPI OLARAK KULLANILMAZ — konum bilgisi taşımadığı
// için hem sahte alarm hem kaçak üretir.
//
// Bunu bir kapı yapmayı iki kez denedim, ikisi de yanlıştı:
//   1) Düz sayım: yorumunda "</script>" geçen SAĞLAM belgeye "bozuk" dedi.
//   2) Regex ile /<!--[\s\S]*?-->/ maskelemesi: sahte alarmı giderdi ama
//      GERÇEK bir erken kapanmayı yuttu. Çünkü script GÖVDESİNDEKİ "<!--"
//      bir HTML yorumu DEĞİLDİR; tokenizer'ı yalnız escaped kipe sokar ve
//      o kipte "</script>" HÂLÂ KAPATIR. Gerçek Chromium'la ölçüldü: blok
//      erken kapanıyor, gövdeye ham kod dökülüyor, kapı "temiz" diyordu.
// Doğru ölçüt scanDocument().stray + .neutralized'dir — konumu ve kipi bilir.
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
function verifyScriptBlocks(html, intended, intendedStyles) {
  var doc = scanDocument(html);

  // (0) Hiç kapanmayan blok — DOUBLE escaped kip tuzağının imzası. Belgenin
  //     geri kalanı o script'in metni olur; sayfadan hiçbir şey çizilmez.
  if (doc.unclosed.length) {
    return 'Bir <' + doc.unclosed[0] + '> bloğu HİÇ KAPANMIYOR!\n' +
      '  Gövdede "<!--" ve ardından "<script" geçiyorsa tarayıcı DOUBLE escaped\n' +
      '  kipe girer ve kapanış etiketi artık kapatmaz. Belgenin geri kalanı o\n' +
      '  bloğun metni olur — sayfa bomboş açılır. Kaynakta "<\\!--" yazın.';
  }

  // (1) ERKEN KAPANMANIN DOĞRUDAN İMZASI: öksüz kapanış etiketi. Bizim
  //     yazdığımız kapanış, bloğu bir başkası erkenden kapattığı için metne
  //     düşmüştür. Konum duyarlı olduğu için ham sayımın iki kusuru da yok:
  //     yorumdaki kapanışı öksüz saymaz, gövdedeki gerçek kapanmayı yutmaz.
  if (doc.stray > 0) {
    return 'Script blokları bozuk! Belgede ' + doc.stray + ' adet ÖKSÜZ "</script" var.\n' +
      '  Gömülen bir kaynakta ham "</script>" dizisi bloğu ERKEN KAPATIYOR: kalan\n' +
      '  kaynak HTML olarak ayrıştırılır, ekrana ham kod dökülür ve sayfa\n' +
      '  tıklanamaz hâle gelir. Kaynakta "<\\/script>" yazın.';
  }

  // (2) DOUBLE escaped kipte YUTULAN kapanış: blok sonunda kapanmış olsa bile
  //     kapandığı yer bizim kastettiğimiz yer değildir.
  if (doc.neutralized > 0) {
    return 'Bir script gövdesinde ' + doc.neutralized + ' adet kapanış etiketi ETKİSİZ kaldı.\n' +
      '  Gövdede "<!--" ve ardından "<script" geçiyor: tarayıcı DOUBLE escaped\n' +
      '  kipe girdi ve kapanış bloğu kapatmadı. Kaynakta "<\\!--" yazın.';
  }

  // (2) Gömme mantığındaki başka bir sapma
  if (typeof intended === 'number' && doc.scripts !== intended) {
    return 'Script blok sayısı beklenenden farklı: ' + doc.scripts + ' bulundu, ' +
      intended + ' kastedildi.\n' +
      '  Gömme sırasında bir <script> bloğu kayboldu ya da fazladan eklendi.';
  }

  // (3) <style> tarafı: aynı tuzak, aynı sonuç (stilin kalanı sayfaya metin
  //     olarak dökülür, o noktadan sonraki tüm kurallar düşer).
  if (typeof intendedStyles === 'number' && doc.styles !== intendedStyles) {
    return 'Style blok sayısı beklenenden farklı: ' + doc.styles + ' bulundu, ' +
      intendedStyles + ' kastedildi.\n' +
      '  Gömülen bir CSS\'te ham "</style" dizisi bloğu ERKEN KAPATIYOR.';
  }

  return null;
}

module.exports = {
  shieldScriptEnd, shieldStyleEnd,
  scanDocument, countScriptElements, countScriptClosers, verifyScriptBlocks,
  indexOfCI,
};
