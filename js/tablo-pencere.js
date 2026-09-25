// ════════════════════════════════════════════════════════════════════════════
//  tablo-pencere.js — SÜTUNA SIĞMAYAN TABLO KÜÇÜK BİR PENCEREDE AÇILIR
// ════════════════════════════════════════════════════════════════════════════
//
// Kullanıcı isteği (2026-09-23, Çözücü penceresinin ekran görüntüsüyle):
// *"Bileşen pencerelerini güncellememizin ardından, resimdeki gibi geniş
// tablolar bileşen pencerelerine sığmıyor. Bu pencereleri açılır ufak
// pencereler şeklinde yapmamız gerekiyor. Kullanıcı çok daha kolay bu
// tabloları doldurur."*
//
// Ölçüldü (380 px'lik müfettiş sütunu, üç modülün bütün pencereleri, her
// sekme): çalışma çevrimi tablosunun doğal genişliği 1162 px, görünen 359 px
// — tablonun üçte ikisi yatay kaydırmanın arkasındaydı.
//
// KURAL, LİSTE DEĞİL. Panel, tabloyu ve ONUN düğmelerini tek bir BİRİM
// olarak işaretler (`data-ve-tablo`). Birim çizildikten sonra ÖLÇÜLÜR:
// tablosu kabına sığmıyorsa yerinde bir özet kartı kalır ve "Tabloyu aç"
// birimi küçük bir pencereye taşır. Sığıyorsa (geniş modal, az sütun) hiçbir
// şey değişmez. Ölçüm bir `ResizeObserver`dan: sekme açılınca, pencere
// sütun ↔ modal değişince, ekran daralınca aynı karar yeniden verilir.
//
// TABLO KOPYALANMAZ, TAŞINIR. Hücrelerin olay işleyicileri satır içi ve
// düğüm kimliğini taşıyor (`onchange="veFeadDutySet('comp-10',…)"`); aynı DOM
// pencereye taşınınca aynı modeli yazar. Pencere içeriğini KENDİSİ ÜRETMEZ:
// ikinci bir üretici, panel ile pencerenin sessizce ayrışması demekti (bu
// deponun tekrar eden dersi). Panel yeniden çizilince (satır ekle / sil) yeni
// birim yeniden pencereye alınır.
//
// TEK ESC = TEK KATMAN: pencere açıkken ESC yalnız onu kapatır, alttaki
// müfettişe ulaşmaz (kimlik.js → `_veAvatarEsc`in kuralı). Hücre odaktayken
// basılan ESC önce hücreyi BIRAKIR (değer `onchange` ile yazılır), sonra
// pencereyi kapatır — odaktaki bir hücreyi DOM'dan sökmek, tarayıcıya son
// değeri hiç yazdırmamak olurdu.
// ════════════════════════════════════════════════════════════════════════════

var _veTabloAcik = null;     // { anahtar, birim } — açık pencere (en fazla BİR)

function _veTabloBul(anahtar){
  if(typeof document === 'undefined') return null;
  var liste = document.querySelectorAll('[data-ve-tablo]');
  for(var i = 0; i < liste.length; i++)
    if(liste[i].getAttribute('data-ve-tablo') === anahtar) return liste[i];
  return null;
}

function _veTabloEsc(t){
  return String(t == null ? '' : t).replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// Birimin tablosu kabına SIĞIYOR MU. Tablo kendi kaydırma kabının içindeyse
// genişliği doğal genişliğidir (`width:100%` yalnız sığdığında geçerli), yani
// iki sayı yan yana konunca cevap çıkar. Gizli sekmede (genişlik 0) soru
// sorulmaz — karar sekme açılınca verilir.
function _veTabloOlc(birim){
  if(!birim || !birim.parentElement) return;
  if(birim.closest && birim.closest('.ve-tablo-pencere')) return;     // pencerede
  var kap = birim.parentElement.clientWidth;
  if(!(kap > 10)) return;
  var katli = birim.classList.contains('ve-tablo--katli');
  var dogal;
  if(!katli){
    var tbl = birim.querySelector('table');
    if(!tbl) return;
    dogal = tbl.offsetWidth;
    birim.setAttribute('data-ve-tablo-dogal', String(dogal));
  } else {
    dogal = parseFloat(birim.getAttribute('data-ve-tablo-dogal')) || 0;
  }
  var sigmaz = dogal > kap + 1;
  birim.classList.toggle('ve-tablo--katli', sigmaz);
  if(birim._veKart) birim._veKart.hidden = !sigmaz;
}

// GÖZLEMCİ KARARI BİR SONRAKİ KAREDE VERİR. Geri çağrının içinde birimi
// katlamak GÖZLENEN kabın boyunu değiştiriyor ve tarayıcı bunu aynı karede
// teslim edemeyince "ResizeObserver loop completed with undelivered
// notifications" hatası atıyor — uygulamanın hata yakalayıcısı onu kullanıcıya
// "Beklenmeyen hata" diye gösterdi (ölçüldü, gerçek tarayıcı). İlk karar
// `veTabloKatla`da eşzamanlı verildiği için erteleme bir kare bile geniş
// tablo göstermez; ertelenen yalnız SONRAKİ genişlik değişimleri.
function _veTabloGozle(birim){
  if(birim._veRo || typeof ResizeObserver !== 'function' || !birim.parentElement) return;
  var ro = new ResizeObserver(function(){
    if(birim._veKare) return;
    var sonra = (typeof requestAnimationFrame === 'function') ? requestAnimationFrame
      : function(f){ return setTimeout(f, 16); };
    birim._veKare = sonra(function(){ birim._veKare = 0; _veTabloOlc(birim); });
  });
  ro.observe(birim.parentElement);
  birim._veRo = ro;
}

// ÖZET KARTI — birimin yerinde kalan şey. Başlık ve özet panelden gelir
// (`data-ve-tablo-baslik` / `-ozet`); kart kendi cümlesini uydurmaz.
function _veTabloKart(birim){
  var kart = document.createElement('div');
  kart.className = 've-tablo-kart';
  kart.hidden = true;
  var anahtar = birim.getAttribute('data-ve-tablo');
  // Kartın başlığı özetin İLK parçası ("5 devir noktası"), tablonun adı
  // DEĞİL: ad hemen üstteki bölüm başlığında zaten yazılı — ikinci kez
  // basmak aynı sözcüğü 20 px arayla iki kez okutmaktı.
  var parca = String(birim.getAttribute('data-ve-tablo-ozet') || '').split(' · ');
  var ilk = parca.shift() || birim.getAttribute('data-ve-tablo-baslik') || 'Tablo';
  kart.innerHTML = '<div class="ve-tablo-kart-yazi"><b>' + _veTabloEsc(ilk) + '</b>'
    + (parca.length ? '<span>' + _veTabloEsc(parca.join(' · ')) + '</span>' : '') + '</div>'
    + '<button type="button" class="ve-tablo-ac">'
    + '<svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><path d="M7 1.5h3.5V5M10.5 1.5 6 6M5 2.5H2.5a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V7"'
    + ' fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>'
    + 'Tabloyu aç</button>';
  kart.querySelector('.ve-tablo-ac').onclick = function(){ veTabloAc(anahtar); };
  birim.parentElement.insertBefore(kart, birim);
  birim._veKart = kart;
  return kart;
}

// SEKME AÇILINCA KARAR AYNI KAREDE (2026-09-25). Gizli sekmedeki birim
// ölçülemiyor (genişlik 0) ve kararı gözlemcinin bir SONRAKİ karesine
// kalıyordu: sekmeye geçince geniş tablo en az bir kare yatay kaydırmayla
// görünüyordu. Yazı bir basamak büyüyünce bu, yük altında 60 ms'yi aştı
// (mufettis-sigma.spec, FEAD Çözücü "Çevrim": 1217/359 px). Sekmeyi açan
// kod bunu çağırır; gözlemci sonraki genişlik değişimleri için kalır.
function veTabloOlcIcinde(kok){
  if(typeof document === 'undefined' || !kok) return;
  Array.prototype.forEach.call(kok.querySelectorAll('[data-ve-tablo]'), function(birim){
    if(birim._veTabloHazir) _veTabloOlc(birim);
  });
}

// Panel çizildikten sonra çağrılır (cp-core.js → showNodeProperties).
// Birimleri kartlar, gözlemciyi bağlar; açık bir pencere varsa ve panel
// yeniden çizildiyse YENİ birimi pencereye alır, yoksa pencereyi kapatır.
function veTabloKatla(kok){
  if(typeof document === 'undefined' || !kok) return;
  var birimler = kok.querySelectorAll('[data-ve-tablo]');
  var acikBulundu = false;
  Array.prototype.forEach.call(birimler, function(birim){
    if(birim._veTabloHazir) return;
    birim._veTabloHazir = true;
    _veTabloKart(birim);
    if(_veTabloAcik && birim.getAttribute('data-ve-tablo') === _veTabloAcik.anahtar){
      acikBulundu = true;
      _veTabloPencereyeAl(birim);
      return;
    }
    _veTabloGozle(birim);
    _veTabloOlc(birim);
  });
  // Panel BAŞKA bir düğümü gösteriyorsa (seçim değişti) açık pencerenin
  // birimi yeni içerikte YOK: pencere de kapanır — sahipsiz bir tablo
  // bırakılmaz. Aynı içerik ikinci kez taranıyorsa (kart hâlâ bu kökte)
  // pencere yerinde kalır. Belgenin tamamında aramak YANLIŞ olurdu: eski
  // birim pencerenin içinde durduğu için her zaman "bulunur".
  if(_veTabloAcik && !acikBulundu){
    var eski = _veTabloAcik.birim;
    if(!(eski && eski._veKart && kok.contains(eski._veKart))) veTabloKapat();
  }
}

function _veTabloPencereyeAl(birim){
  var govde = document.querySelector('#ve-tablo-perde .ve-tablo-govde');
  if(!govde) return;
  if(_veTabloAcik.birim && _veTabloAcik.birim !== birim && _veTabloAcik.birim.parentElement === govde)
    govde.removeChild(_veTabloAcik.birim);
  birim.classList.remove('ve-tablo--katli');
  if(birim._veKart){ birim._veKart.hidden = false; birim._veKart.classList.add('ve-tablo-kart--acik'); }
  govde.appendChild(birim);
  _veTabloAcik.birim = birim;
}

function veTabloAc(anahtar){
  if(typeof document === 'undefined') return false;
  var birim = _veTabloBul(anahtar);
  if(!birim) return false;
  if(_veTabloAcik) veTabloKapat();
  var perde = document.createElement('div');
  perde.id = 've-tablo-perde';
  perde.className = 've-tablo-perde';
  var baslik = birim.getAttribute('data-ve-tablo-baslik') || 'Tablo';
  var ozet = birim.getAttribute('data-ve-tablo-ozet') || '';
  perde.innerHTML = '<div class="ve-tablo-pencere" role="dialog" aria-modal="true" aria-labelledby="ve-tablo-baslik">'
    + '<div class="ve-tablo-bas"><b id="ve-tablo-baslik">' + _veTabloEsc(baslik) + '</b>'
    + (ozet ? '<em>' + _veTabloEsc(ozet) + '</em>' : '')
    + '<button type="button" class="ve-tablo-kapat" aria-label="Kapat" title="Kapat (Esc)">'
    + '<svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><path d="M2 2l8 8M10 2l-8 8" stroke="currentColor"'
    + ' stroke-width="1.6" stroke-linecap="round"/></svg></button></div>'
    + '<div class="ve-tablo-govde"></div></div>';
  document.body.appendChild(perde);
  // Perdenin kendisine tıklamak kapatır; pencerenin içine tıklamak değil.
  perde.addEventListener('mousedown', function(e){ if(e.target === perde) veTabloKapat(); });
  perde.querySelector('.ve-tablo-kapat').onclick = function(){ veTabloKapat(); };
  _veTabloAcik = { anahtar: anahtar, birim: null };
  _veTabloPencereyeAl(birim);
  document.addEventListener('keydown', _veTabloTus, true);
  var ilk = birim.querySelector('input, select, textarea, button');
  if(ilk && typeof ilk.focus === 'function') ilk.focus();
  return true;
}

function veTabloKapat(){
  if(!_veTabloAcik || typeof document === 'undefined') return;
  var birim = _veTabloAcik.birim;
  var odak = document.activeElement;
  if(birim && odak && birim.contains(odak) && typeof odak.blur === 'function') odak.blur();
  var perde = document.getElementById('ve-tablo-perde');
  // Birim yerine döner: kartın hemen arkasına. Kart panelden gitmişse
  // (panel başka bir düğüme geçti) birimin de dönecek yeri yok.
  if(birim && birim._veKart && birim._veKart.isConnected){
    birim._veKart.classList.remove('ve-tablo-kart--acik');
    birim._veKart.parentElement.insertBefore(birim, birim._veKart.nextSibling);
    _veTabloOlc(birim);
    _veTabloGozle(birim);
    var dugme = birim._veKart.querySelector('.ve-tablo-ac');
    if(dugme && !birim._veKart.hidden && typeof dugme.focus === 'function') dugme.focus();
  }
  if(perde && perde.parentElement) perde.parentElement.removeChild(perde);
  document.removeEventListener('keydown', _veTabloTus, true);
  _veTabloAcik = null;
}

// YAKALAMA evresinde: alttaki müfettişin ESC dinleyicisi (map.js) bu tuşu
// hiç görmesin — tek tuş, tek katman.
function _veTabloTus(e){
  if(e.key !== 'Escape' || !_veTabloAcik) return;
  e.stopPropagation();
  e.preventDefault();
  veTabloKapat();
}

function veTabloAcikMi(){ return !!_veTabloAcik; }

if(typeof module !== 'undefined' && module.exports){
  module.exports = { veTabloKatla: veTabloKatla, veTabloAc: veTabloAc, veTabloKapat: veTabloKapat,
    veTabloAcikMi: veTabloAcikMi, veTabloOlcIcinde: veTabloOlcIcinde, _veTabloOlc: _veTabloOlc };
}
