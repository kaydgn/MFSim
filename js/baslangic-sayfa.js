// ════════════════════════════════════════════════════════════════════════════
//  BAŞLANGIÇ SAYFASI KİTİ — boş bir modül topolojisinin karşılaması (ORTAK)
// ════════════════════════════════════════════════════════════════════════════
//
// İki modül aynı sayfayı kurar: FEAD (js/cp-fead-baslangic.js) ve Takoz
// (js/cp-mount-baslangic.js). Kullanıcı isteği (2026-10-14): *"FEAD modülünün
// başlangıç ekranı çok güzel, aynı onun gibi bir ekran istiyorum."* — "aynı"
// sözcüğünün karşılığı TEK üretici ve TEK CSS ailesidir (`.ve-bas*`,
// css/styles.css). Takoz'a sayfanın bir kopyası kurulsaydı iki görünüm ilk
// rötuşta sessizce ayrışırdı.
//
// DÜZEN ÇALIŞMA MASASI (kullanıcı seçimi 2026-11-04, tasarım tuvali "Takoz
// başlangıç sayfası" · 1 — *"Çalışma masasını uygula. FEAD'da aynı olsun."*):
// solda PANEL (kimlik · kapılar · veri · Kılavuz), sağda MASA: seçili karonun
// ÖNİZLEMESİ (büyük çizim + künye föyü + Yükle) ve karoların grupları.
// Eski düzen ortalanmış dar bir sütundu: 1920 px ekranda içerik genişliğin
// %55'inde, yüksekliğin %75'inde kalıyordu.
//
// KİT YALNIZ SUNUMU KURAR. Hangi modülün sayfası olduğunu, sayfanın NE ZAMAN
// gerektiğini (görünürlük modelden türer, bayrak tutulmaz), kapıların NE
// YAPTIĞINI ve önizlemenin ÇİZİMİNİ modül söyler — kit bunları sormaz, yalnız
// çağırır.
//
// KURALLAR (FEAD kural 5'ten devralındı):
//  • SAYFA TUVALİ ÖRTER, FARE SAYFADA KALIR: tuvalin pan/seçim/yakınlaştırma
//    dinleyicileri kapta; sayfanın fare ve tekerlek olayları kaba sızmaz.
//    Sürükle-bırak SIZAR (bilinçli): paletten sayfanın üstüne bırakılan
//    bileşen tuvale kurulur ve sayfa modelden türediği için kendiliğinden
//    çekilir — dördüncü kapı.
//  • HER AÇILIŞTA YENİDEN BASILIR (tema, adım ve örnek listesi o an neyse);
//    açıkken yeniden basmak odağı ve kaydırmayı düşürürdü.
//  • KARO TIKI SEÇER, YÜKLEMEZ: önizleme değişir; model önizlemenin Yükle'siyle
//    ya da karoya çift tıkla kurulur (modülün eylemi). Seçim GÖRÜNÜM durumudur:
//    modelde değil, sayfa başına bellekte (`_veBasSecim`) — kaydedilmez, geri-al
//    yığınına girmez. Seçimde karolar yeniden kurulmaz (odak ve çift tık yerinde
//    kalır), yalnız önizleme.
//  • ÖNİZLEMENİN ÇİZİMİ KUTUNUN ÖLÇÜSÜNDE (`o.onizCiz(v, W, H)`): çizim 1:1
//    kurulur, yazısı arayüz ölçeğinde kalır — sabit ölçüde çizilip büyütülen ya
//    da küçültülen resim dar tuvalde yazıyı ölçek tabanının altına düşürürdü.
//    Kutu değişince (pencere, palet, ray) yeniden çizilir.
//  • SAYFA AÇIKKEN SAYFA RAYI (Topoloji · Sonuçlar) GİZLİ (kullanıcı
//    2026-11-04: *"pencere ilk açıldığında sol tarafta 'topoloji ve sonuçlar'
//    sütunu görünmesin. Gerek yok"*): kit kabına `ve-bas-acik` yazar
//    (`_veBasRayEsitle`), CSS rayı yalnız topoloji sayfasında gizler — öteki
//    sayfada ray dönüş yoludur. Sayfa SIĞDIRMADAN önce çekilir (Takoz ilk
//    düğümde, FEAD sonuçları unuturken), ray geri geldiğinde kadraj doğru
//    genişlikle kurulur.
//  • İkon ailesi tek (karar 10·B): kapının ikonu `veIkon`dan.

function veBasEsc(s){
  return String(s == null ? '' : s).replace(/[&<>"']/g, function(c){
    return { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c];
  });
}
function _veBasIkon(ad){ return (typeof veIkon === 'function') ? veIkon(ad) : ''; }

// ── KİMLİK, VERİ, KÜNYE — sayfanın AD ve VERİ yuvaları (2026-10-19) ─────────
// Kullanıcı isteği: *"… çok sade olmuş. Güzel durmuyor. Bir şeyler ekleyelim
// … profesyonel dursun."* Eklenen her yuva YAPILI: modülün adı, analizlerinin
// programdaki ADLARI, kataloğun ölçülen SAYILARI, kapının künyesi (adımların
// adı, dosya biçimi). Yuva bir ad listesi ya da {ad, deger} çifti alır, cümle
// almaz — serbest metin yuvası (üst satır, alt metin, not, rozet) YİNE YOK.
// Kapı: mount-baslangic.test.js → KİMLİK VE VERİ.

// i: { ad, ikon (SVG — modülün componentDefs ikonu), yetenekler:[ad…],
//      kilavuz (kılavuz kimliği; verilmezse düğme yok) }
function veBasKimlikHTML(i){
  if(!i || !i.ad) return '';
  var y = (i.yetenekler || []).filter(Boolean);
  return '<header class="ve-bas-kimlik">'
    + (i.ikon ? '<span class="ve-bas-kimlik-ik" aria-hidden="true">' + i.ikon + '</span>' : '')
    + '<div class="ve-bas-kimlik-t"><h1>' + veBasEsc(i.ad) + '</h1>'
    + (y.length ? '<ul class="ve-bas-yetenek" aria-label="Analizler">'
        + y.map(function(a){ return '<li>' + veBasEsc(a) + '</li>'; }).join('') + '</ul>' : '')
    + '</div></header>';
}

// Kılavuz panelin dibinde (Çalışma masası); kimliğin ikinci okuması.
function veBasKilavuzHTML(i){
  if(!i || !i.kilavuz) return '';
  return '<button type="button" class="ve-bas-kilavuz" data-ey="kilavuz" data-v="' + veBasEsc(i.kilavuz) + '">'
    + _veBasIkon('file-text') + '<span>Kılavuz</span></button>';
}

// v: [{ deger, ad, title }] — sayı yazıcısından geçmiş değer, ölçünün adı.
// Değeri boş satır basılmaz. Panelde satır satır: ad solda, sayı sağda.
function veBasVeriHTML(v){
  v = (v || []).filter(function(x){ return x && x.ad && x.deger != null && x.deger !== ''; });
  if(!v.length) return '';
  return '<dl class="ve-bas-veri">' + v.map(function(x){
    return '<div' + (x.title ? ' title="' + veBasEsc(x.title) + '"' : '') + '>'
      + '<dt>' + veBasEsc(x.ad) + '</dt><dd>' + veBasEsc(x.deger) + '</dd></div>';
  }).join('') + '</dl>';
}

// ── KAPI — sayfanın birincil eylemleri ─────────────────────────────────────
// k: { ey, ikon, ad, kunye:[ad…], title, birincil, onclick }. `ey` kapının
// eylem anahtarı — sayfanın tek tıklama dinleyicisi onu modülün eylemine
// verir. `onclick` yalnız sayfanın DIŞINDA basılan kapı için (bir bileşen
// penceresi aynı kapıyı gösterir, dinleyicisi yoktur). `kunye` VERİ: ad ve
// biçim listesi — her ad kendi öğesinde, ayraç CSS'ten (" · " ile birleşmiş
// bir dize cümle gibi okunur ve metin tarayıcısı onu uzun metin sayar);
// `title` künyede yazmayan veri.
// AÇIKLAMA YUVASI YOK (ARAYÜZ ANLATMAZ, kök CLAUDE.md): kapının not satırı ve
// "önerilen" rozeti iki modülde altı açıklama üretmişti.
function veBasKapiHTML(k){
  k = k || {};
  var ky = (k.kunye || []).filter(Boolean);
  return '<button type="button" class="ve-bas-kapi' + (k.birincil ? ' birincil' : '') + '" data-ey="' + veBasEsc(k.ey) + '"'
    + (k.title ? ' title="' + veBasEsc(k.title) + '"' : '')
    + (k.onclick ? ' onclick="' + veBasEsc(k.onclick) + '"' : '') + '>'
    + '<span class="ve-bas-kapi-ik">' + _veBasIkon(k.ikon) + '</span>'
    + '<span class="ve-bas-kapi-t"><b>' + veBasEsc(k.ad) + '</b>'
    + (ky.length ? '<span class="ve-bas-kapi-k">'
        + ky.map(function(a){ return '<span>' + veBasEsc(a) + '</span>'; }).join('') + '</span>' : '')
    + '</span></button>';
}

// ── KARO — örnek / rapor seçicisi ──────────────────────────────────────────
// k: { ey (YÜKLEME eylemi), v, baslik (title, isteğe bağlı), resim (SVG), kod,
//      yil, onizleme }. Resim yoksa karo yine basılır, künyesiyle
// ("çizilemedi") — yükleme de yine çalışır. Resim modülün KENDİ çizicisinden
// gelir; kit çizim yapmaz. `baslik` karoda yazmayan VERİ içindir (gövde
// adları); komut eki yok. Karonun tıkı SEÇER (`data-ey="sec"`); yükleme
// eylemi `data-yukle`de durur ve önizlemenin Yükle'si ile çift tık onu çağırır.
function veBasKaroHTML(k, secili){
  k = k || {};
  return '<button type="button" class="ve-bas-karo" data-ey="sec" data-v="' + veBasEsc(k.v) + '"'
    + ' data-yukle="' + veBasEsc(k.ey) + '" aria-pressed="' + (secili ? 'true' : 'false') + '"'
    + (k.baslik ? ' title="' + veBasEsc(k.baslik) + '"' : '') + '>'
    + '<span class="ve-bas-resim">' + (k.resim || '<i class="ve-bas-resim-yok">çizilemedi</i>') + '</span>'
    + '<span class="ve-bas-kunye"><b>' + veBasEsc(k.kod) + '</b>'
    + (k.yil ? '<span>' + veBasEsc(k.yil) + '</span>' : '') + '</span>'
    + '</button>';
}

// ── ÖNİZLEME — seçili karonun büyük çizimi ve künye föyü ───────────────────
// k.onizleme: { ad, etiket, foy:[{ ad, deger }], liste:{ baslik, adlar:[…] } }.
// Yuvaların hepsi AD ya da VERİ (ARAYÜZ ANLATMAZ); değeri boş satır ve boş
// liste basılmaz. Çizim kutusu BOŞ basılır: kutu yerleşince modülün çizicisi
// onu kendi ölçüsünde doldurur (`_veBasOnizCiz`).
function veBasOnizlemeHTML(k){
  if(!k) return '';
  var o = k.onizleme || {};
  var foy = (o.foy || []).filter(function(x){ return x && x.ad && x.deger != null && x.deger !== ''; });
  var adlar = (o.liste && o.liste.adlar || []).filter(Boolean);
  return '<section class="ve-bas-oniz" data-v="' + veBasEsc(k.v) + '">'
    + '<div class="ve-bas-oniz-resim" data-v="' + veBasEsc(k.v) + '"></div>'
    + '<div class="ve-bas-oniz-foy">'
    +   '<div class="ve-bas-oniz-ad"><h2>' + veBasEsc(o.ad || k.kod) + '</h2>'
    +     (o.etiket ? '<i>' + veBasEsc(o.etiket) + '</i>' : '') + '</div>'
    +   (foy.length ? '<dl class="ve-bas-oniz-dl">' + foy.map(function(x){
          return '<div><dt>' + veBasEsc(x.ad) + '</dt><dd>' + veBasEsc(x.deger) + '</dd></div>';
        }).join('') + '</dl>' : '')
    +   (adlar.length ? '<div class="ve-bas-oniz-liste"><h3>' + veBasEsc(o.liste.baslik) + '</h3><ul>'
          + adlar.map(function(a){ return '<li>' + veBasEsc(a) + '</li>'; }).join('') + '</ul></div>' : '')
    +   '<button type="button" class="ve-bas-yukle" data-ey="' + veBasEsc(k.ey) + '" data-v="' + veBasEsc(k.v) + '">'
    +     _veBasIkon('download') + '<span>Yükle</span></button>'
    + '</div></section>';
}

// ── SAYFA — panel (kimlik · kapılar · veri · Kılavuz) · masa (önizleme · gruplar)
// s: { kimlik, veriler:[…], kapilar:[kapı…], bolumler:[{ baslik, karolar:[karo…] }] }
// Tek bölüm `bolum` olarak da verilebilir (FEAD). Karosuz bölüm basılmaz.
// `secV` seçili karonun anahtarı; yoksa ya da listede değilse ilk karo.
// Sayfanın üst satırı, serbest başlığı (`baslik`), alt metni, bölüm notu ve
// dipnotu YOK (2026-10-16, kullanıcı kararı — metin temizliği aşama 1): beş
// yuva iki modülde on beş açıklama üretmişti ("Nereden başlayalım?" ·
// "Seçtiğin kapı modeli kurar ve bu sayfa çekilir …"). Başlık artık modülün
// ADI (`kimlik.ad`), cümle değil.
function _veBasBolumler(s){
  return ((s && (s.bolumler || (s.bolum ? [s.bolum] : []))) || [])
    .filter(function(b){ return b && b.karolar && b.karolar.length; });
}
function _veBasKaroBul(s, v){
  var bul = null, ilk = null;
  _veBasBolumler(s).forEach(function(b){
    b.karolar.forEach(function(k){
      if(!ilk) ilk = k;
      if(!bul && v != null && String(k.v) === String(v)) bul = k;
    });
  });
  return bul || ilk;
}
function veBasSayfaHTML(s, secV){
  s = s || {};
  var bolumler = _veBasBolumler(s);
  var sec = _veBasKaroBul(s, secV);
  var h = '<div class="ve-bas-ic">'
    + '<aside class="ve-bas-panel">'
    +   veBasKimlikHTML(s.kimlik)
    +   '<div class="ve-bas-kapilar">' + (s.kapilar || []).map(veBasKapiHTML).join('') + '</div>'
    +   veBasVeriHTML(s.veriler)
    +   veBasKilavuzHTML(s.kimlik)
    + '</aside>'
    + '<div class="ve-bas-masa">' + veBasOnizlemeHTML(sec);
  if(bolumler.length){
    h += '<div class="ve-bas-gruplar">';
    bolumler.forEach(function(b){
      h += '<section class="ve-bas-grup"><div class="ve-bas-baslik"><h2>' + veBasEsc(b.baslik) + '</h2></div>'
        + '<div class="ve-bas-raporlar">' + b.karolar.map(function(k){
            return veBasKaroHTML(k, !!(sec && String(k.v) === String(sec.v)));
          }).join('') + '</div></section>';
    });
    h += '</div>';
  }
  return h + '</div></div>';
}

// ── DOM — kurma, seçim, önizleme ve görünürlük ─────────────────────────────
// o: { id, aria, sayfa: function(): s (sayfanın tanımı), eylem: function(ad, v),
//      onizCiz: function(v, W, H): svg }  —  `html: function(): string` eski yol
//      (tanımsız sayfa: önizleme çizilmez).
var _veBasSecim = {};          // sayfa kimliği → seçili karonun anahtarı (görünüm durumu)
// Ölçülemeyen kutu (gizli kap, jsdom): önizleme bu ölçüde çizilir.
var VE_BAS_ONIZ_NOMINAL = { w: 720, h: 400 };

function _veBasKap(){
  return (typeof document !== 'undefined') ? document.getElementById('ve-canvas-wrapper') : null;
}
function _veBasEl(id){
  return (typeof document !== 'undefined') ? document.getElementById(id) : null;
}
function _veBasBas(el, o){
  if(typeof o.sayfa === 'function'){
    el._veBasSpec = o.sayfa() || {};
    var sec = _veBasKaroBul(el._veBasSpec, _veBasSecim[o.id]);
    if(sec) _veBasSecim[o.id] = sec.v;
    return veBasSayfaHTML(el._veBasSpec, _veBasSecim[o.id]);
  }
  el._veBasSpec = null;
  return (typeof o.html === 'function') ? o.html() : '';
}

// Önizlemenin çizimi kutunun ölçüsünde; aynı karo ve ölçüde yeniden çizilmez.
function _veBasOnizCiz(el){
  var o = el && el._veBasO;
  var kutu = el && el.querySelector('.ve-bas-oniz-resim');
  if(!kutu || !o || typeof o.onizCiz !== 'function') return false;
  var v = kutu.getAttribute('data-v');
  var W = Math.floor(kutu.clientWidth || 0), H = Math.floor(kutu.clientHeight || 0);
  if(!(W > 40 && H > 40)){ W = VE_BAS_ONIZ_NOMINAL.w; H = VE_BAS_ONIZ_NOMINAL.h; }
  var imza = v + '|' + W + 'x' + H;
  if(kutu.getAttribute('data-imza') === imza) return true;
  var svg = '';
  try { svg = o.onizCiz(v, W, H) || ''; } catch(e){ svg = ''; }
  kutu.innerHTML = svg || '<i class="ve-bas-resim-yok">çizilemedi</i>';
  kutu.setAttribute('data-imza', imza);
  return !!svg;
}

// Karo seçimi: karoların basılılığı eşitlenir, önizleme yerinde değişir.
function _veBasSec(el, v){
  if(!el || v == null) return false;
  var s = el._veBasSpec;
  var k = s ? _veBasKaroBul(s, v) : null;
  if(!k || String(k.v) !== String(v)) return false;
  var eski = el.querySelector('.ve-bas-oniz');
  if(eski && eski.getAttribute('data-v') === String(v)) return true;
  _veBasSecim[el.id] = k.v;
  Array.prototype.forEach.call(el.querySelectorAll('.ve-bas-karo'), function(b){
    b.setAttribute('aria-pressed', b.getAttribute('data-v') === String(v) ? 'true' : 'false');
  });
  if(eski){
    var tmp = document.createElement('div');
    tmp.innerHTML = veBasOnizlemeHTML(k);
    if(tmp.firstChild) eski.parentNode.replaceChild(tmp.firstChild, eski);
  }
  _veBasOnizCiz(el);
  return true;
}

// Sayfa rayının görünürlüğü: herhangi bir başlangıç sayfası açık mı.
function _veBasRayEsitle(){
  if(typeof document === 'undefined') return false;
  var acik = false;
  var hepsi = document.querySelectorAll('.ve-bas');
  for(var i = 0; i < hepsi.length; i++){ if(!hepsi[i].hidden){ acik = true; break; } }
  var kab = document.getElementById('sayfa2-content');
  if(kab) kab.classList.toggle('ve-bas-acik', acik);
  // Ray gelip gidince kap kayar: dönüş düğmesi paletin açma sekmesinin sağına
  // yeniden oturur (js/canvas-space.js → veChipSolOrtu).
  if(typeof veAnchorBoundaryChip === 'function') veAnchorBoundaryChip();
  return acik;
}

function veBasKur(o){
  var kap = _veBasKap();
  if(!kap || !o || !o.id) return null;
  var el = _veBasEl(o.id);
  if(el){ el._veBasO = o; return el; }
  el = document.createElement('section');
  el.id = o.id;
  el.className = 've-bas';
  el.setAttribute('role', 'region');
  el.setAttribute('aria-label', o.aria || 'Başlangıç sayfası');
  el.hidden = true;
  el._veBasO = o;
  el.innerHTML = _veBasBas(el, o);
  // TUVALE OLAY SIZDIRMA: kabın dinleyicileri pan/seçim/yakınlaştırma yapıyor.
  // Tekerlek pasif dinlenir — sayfa kendi kaydırmasını yapar, kadraj oynamaz.
  ['mousedown', 'pointerdown', 'dblclick', 'contextmenu', 'wheel', 'click'].forEach(function(t){
    el.addEventListener(t, function(e){ e.stopPropagation(); }, t === 'wheel' ? { passive: true } : false);
  });
  el.addEventListener('click', function(e){
    var b = e.target && e.target.closest && e.target.closest('[data-ey]');
    if(!b) return;
    var ey = b.getAttribute('data-ey'), v = b.getAttribute('data-v');
    if(ey === 'sec'){ _veBasSec(el, v); return; }
    var oo = el._veBasO;
    if(oo && typeof oo.eylem === 'function') oo.eylem(ey, v);
  });
  // Çift tık karonun YÜKLEME eylemini çağırır (ilk tık seçmişti).
  el.addEventListener('dblclick', function(e){
    var b = e.target && e.target.closest && e.target.closest('.ve-bas-karo');
    var oo = el._veBasO;
    if(!b || !oo || typeof oo.eylem !== 'function') return;
    oo.eylem(b.getAttribute('data-yukle'), b.getAttribute('data-v'));
  });
  // Kutu değişince (pencere, palet, ray) önizleme kendi ölçüsünde yeniden
  // çizilir ve dönüş düğmesi yeniden oturur: sayfa kabın tamamı, kap kayınca
  // (ray, palet) düğmenin paletin açma sekmesine göre yeri değişir.
  if(typeof ResizeObserver === 'function'){
    var bekle = 0;
    var sonraki = (typeof requestAnimationFrame === 'function') ? requestAnimationFrame : function(f){ return setTimeout(f, 16); };
    el._veBasRO = new ResizeObserver(function(){
      if(el.hidden || bekle) return;
      bekle = sonraki(function(){
        bekle = 0;
        if(el.hidden) return;
        _veBasOnizCiz(el);
        if(typeof veAnchorBoundaryChip === 'function') veAnchorBoundaryChip();
      });
    });
    el._veBasRO.observe(el);
  }
  kap.appendChild(el);
  return el;
}

// Döner: sayfa AÇIK mı. `acik` çağıranın kararı (kapsam + modelin sorusu);
// kapalıyken hiçbir şey kurulmaz.
function veBasTazele(o, acik){
  var el = _veBasEl(o && o.id);
  if(!acik){
    if(el) el.hidden = true;
    _veBasRayEsitle();
    return false;
  }
  el = el || veBasKur(o);
  if(!el) return false;
  el._veBasO = o;
  if(el.hidden){
    el.innerHTML = _veBasBas(el, o);
    el.scrollTop = 0;
    el.hidden = false;
    _veBasRayEsitle();
    _veBasOnizCiz(el);
    return true;
  }
  _veBasRayEsitle();
  return true;
}

function veBasAcik(id){
  var el = _veBasEl(id);
  return !!(el && !el.hidden);
}

// Sayfa başına seçili karo (görünüm durumu) — modülün HTML üreticisi okur.
function veBasSecili(id){
  return Object.prototype.hasOwnProperty.call(_veBasSecim, id) ? _veBasSecim[id] : null;
}

if(typeof module !== 'undefined' && module.exports){
  module.exports = {
    veBasEsc: veBasEsc, veBasKapiHTML: veBasKapiHTML, veBasKaroHTML: veBasKaroHTML,
    veBasKimlikHTML: veBasKimlikHTML, veBasKilavuzHTML: veBasKilavuzHTML, veBasVeriHTML: veBasVeriHTML,
    veBasOnizlemeHTML: veBasOnizlemeHTML, veBasSayfaHTML: veBasSayfaHTML,
    veBasKur: veBasKur, veBasTazele: veBasTazele, veBasAcik: veBasAcik, veBasSecili: veBasSecili,
    VE_BAS_ONIZ_NOMINAL: VE_BAS_ONIZ_NOMINAL,
    _veBasSec: _veBasSec, _veBasRayEsitle: _veBasRayEsitle,
    _veBasSifirla: function(){ _veBasSecim = {}; }
  };
}
