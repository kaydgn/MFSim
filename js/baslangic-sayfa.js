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
// KİT YALNIZ SUNUMU KURAR. Hangi modülün sayfası olduğunu, sayfanın NE ZAMAN
// gerektiğini (görünürlük modelden türer, bayrak tutulmaz) ve kapıların NE
// YAPTIĞINI modül söyler — kit bunları sormaz, yalnız çağırır.
//
// KURALLAR (FEAD kural 5'ten devralındı):
//  • SAYFA TUVALİ ÖRTER, FARE SAYFADA KALIR: tuvalin pan/seçim/yakınlaştırma
//    dinleyicileri kapta; sayfanın fare ve tekerlek olayları kaba sızmaz.
//    Sürükle-bırak SIZAR (bilinçli): paletten sayfanın üstüne bırakılan
//    bileşen tuvale kurulur ve sayfa modelden türediği için kendiliğinden
//    çekilir — dördüncü kapı.
//  • HER AÇILIŞTA YENİDEN BASILIR (tema, adım ve örnek listesi o an neyse);
//    açıkken yeniden basmak odağı ve kaydırmayı düşürürdü.
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
    + '</div>'
    + (i.kilavuz ? '<button type="button" class="ve-bas-kilavuz" data-ey="kilavuz" data-v="' + veBasEsc(i.kilavuz) + '">'
        + _veBasIkon('file-text') + '<span>Kılavuz</span></button>' : '')
    + '</header>';
}

// v: [{ deger, ad, title }] — sayı yazıcısından geçmiş değer, ölçünün adı.
// Değeri boş satır basılmaz.
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

// ── KARO — örnek / rapor kartı ─────────────────────────────────────────────
// k: { ey, v, baslik (title, isteğe bağlı), resim (SVG), kod, yil, sag, alt }.
// Resim yoksa karo yine basılır, künyesiyle ("çizilemedi") — yükleme de yine
// çalışır. Resim modülün KENDİ çizicisinden gelir; kit çizim yapmaz.
// `baslik` karoda yazmayan VERİ içindir (gövde adları); komut eki yok.
function veBasKaroHTML(k){
  k = k || {};
  return '<button type="button" class="ve-bas-karo" data-ey="' + veBasEsc(k.ey) + '" data-v="' + veBasEsc(k.v) + '"'
    + (k.baslik ? ' title="' + veBasEsc(k.baslik) + '"' : '') + '>'
    + '<span class="ve-bas-resim">' + (k.resim || '<i class="ve-bas-resim-yok">çizilemedi</i>')
    + '<em>Yükle</em></span>'
    + '<span class="ve-bas-kunye"><span class="ve-bas-kunye-1"><b>' + veBasEsc(k.kod) + '</b>'
    + (k.yil ? '<span>' + veBasEsc(k.yil) + '</span>' : '')
    + (k.sag ? '<i>' + veBasEsc(k.sag) + '</i>' : '') + '</span>'
    + '<span class="ve-bas-kunye-2">' + veBasEsc(k.alt) + '</span>'
    + '</span></button>';
}

// ── SAYFA — kimlik · veri · kapılar · karolar ──────────────────────────────
// s: { kimlik, veriler:[…], kapilar:[kapı…], bolumler:[{ baslik, karolar:[karo…] }] }
// Tek bölüm `bolum` olarak da verilebilir (FEAD). Karosuz bölüm basılmaz.
// Sayfanın üst satırı, serbest başlığı (`baslik`), alt metni, bölüm notu ve
// dipnotu YOK (2026-10-16, kullanıcı kararı — metin temizliği aşama 1): beş
// yuva iki modülde on beş açıklama üretmişti ("Nereden başlayalım?" ·
// "Seçtiğin kapı modeli kurar ve bu sayfa çekilir …"). Başlık artık modülün
// ADI (`kimlik.ad`), cümle değil.
function veBasSayfaHTML(s){
  s = s || {};
  var h = '<div class="ve-bas-ic">'
    + veBasKimlikHTML(s.kimlik)
    + veBasVeriHTML(s.veriler)
    + '<div class="ve-bas-kapilar">' + (s.kapilar || []).map(veBasKapiHTML).join('') + '</div>';
  (s.bolumler || (s.bolum ? [s.bolum] : [])).forEach(function(b){
    if(!b || !b.karolar || !b.karolar.length) return;
    h += '<div class="ve-bas-baslik"><h2>' + veBasEsc(b.baslik) + '</h2></div>'
      + '<div class="ve-bas-raporlar">' + b.karolar.map(veBasKaroHTML).join('') + '</div>';
  });
  return h + '</div>';
}

// ── DOM — kurma ve görünürlük ──────────────────────────────────────────────
// o: { id, aria, html: function(): string, eylem: function(ad, v) }
function _veBasKap(){
  return (typeof document !== 'undefined') ? document.getElementById('ve-canvas-wrapper') : null;
}
function _veBasEl(id){
  return (typeof document !== 'undefined') ? document.getElementById(id) : null;
}

function veBasKur(o){
  var kap = _veBasKap();
  if(!kap || !o || !o.id) return null;
  var el = _veBasEl(o.id);
  if(el) return el;
  el = document.createElement('section');
  el.id = o.id;
  el.className = 've-bas';
  el.setAttribute('role', 'region');
  el.setAttribute('aria-label', o.aria || 'Başlangıç sayfası');
  el.hidden = true;
  el.innerHTML = (typeof o.html === 'function') ? o.html() : '';
  // TUVALE OLAY SIZDIRMA: kabın dinleyicileri pan/seçim/yakınlaştırma yapıyor.
  // Tekerlek pasif dinlenir — sayfa kendi kaydırmasını yapar, kadraj oynamaz.
  ['mousedown', 'pointerdown', 'dblclick', 'contextmenu', 'wheel', 'click'].forEach(function(t){
    el.addEventListener(t, function(e){ e.stopPropagation(); }, t === 'wheel' ? { passive: true } : false);
  });
  el.addEventListener('click', function(e){
    var b = e.target && e.target.closest && e.target.closest('[data-ey]');
    if(!b || typeof o.eylem !== 'function') return;
    o.eylem(b.getAttribute('data-ey'), b.getAttribute('data-v'));
  });
  kap.appendChild(el);
  return el;
}

// Döner: sayfa AÇIK mı. `acik` çağıranın kararı (kapsam + modelin sorusu);
// kapalıyken hiçbir şey kurulmaz.
function veBasTazele(o, acik){
  var el = _veBasEl(o && o.id);
  if(!acik){ if(el) el.hidden = true; return false; }
  el = el || veBasKur(o);
  if(!el) return false;
  if(el.hidden){
    el.innerHTML = (typeof o.html === 'function') ? o.html() : '';
    el.scrollTop = 0;
    el.hidden = false;
  }
  return true;
}

function veBasAcik(id){
  var el = _veBasEl(id);
  return !!(el && !el.hidden);
}

if(typeof module !== 'undefined' && module.exports){
  module.exports = {
    veBasEsc: veBasEsc, veBasKapiHTML: veBasKapiHTML, veBasKaroHTML: veBasKaroHTML,
    veBasKimlikHTML: veBasKimlikHTML, veBasVeriHTML: veBasVeriHTML,
    veBasSayfaHTML: veBasSayfaHTML, veBasKur: veBasKur, veBasTazele: veBasTazele, veBasAcik: veBasAcik
  };
}
