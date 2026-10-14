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

// ── KAPI — sayfanın birincil eylemleri ─────────────────────────────────────
// k: { ey, ikon, ad, not, birincil, rozet, onclick }. `ey` kapının eylem
// anahtarı — sayfanın tek tıklama dinleyicisi onu modülün eylemine verir.
// `onclick` yalnız sayfanın DIŞINDA basılan kapı için (bir bileşen penceresi
// aynı kapıyı gösterir, dinleyicisi yoktur).
function veBasKapiHTML(k){
  k = k || {};
  return '<button type="button" class="ve-bas-kapi' + (k.birincil ? ' birincil' : '') + '" data-ey="' + veBasEsc(k.ey) + '"'
    + (k.onclick ? ' onclick="' + veBasEsc(k.onclick) + '"' : '') + '>'
    + '<span class="ve-bas-kapi-ik">' + _veBasIkon(k.ikon) + '</span>'
    + '<span class="ve-bas-kapi-t"><b>' + veBasEsc(k.ad)
    + (k.rozet ? '<i>' + veBasEsc(k.rozet) + '</i>' : '') + '</b>'
    + '<span>' + veBasEsc(k.not) + '</span></span></button>';
}

// ── KARO — örnek / rapor kartı ─────────────────────────────────────────────
// k: { ey, v, baslik (title), resim (SVG), kod, yil, sag, alt }. Resim yoksa
// karo yine basılır, künyesiyle ("çizilemedi") — yükleme de yine çalışır.
// Resim modülün KENDİ çizicisinden gelir; kit çizim yapmaz.
function veBasKaroHTML(k){
  k = k || {};
  return '<button type="button" class="ve-bas-karo" data-ey="' + veBasEsc(k.ey) + '" data-v="' + veBasEsc(k.v) + '"'
    + ' title="' + veBasEsc(k.baslik) + ' — yükle">'
    + '<span class="ve-bas-resim">' + (k.resim || '<i class="ve-bas-resim-yok">çizilemedi</i>')
    + '<em>Yükle</em></span>'
    + '<span class="ve-bas-kunye"><span class="ve-bas-kunye-1"><b>' + veBasEsc(k.kod) + '</b>'
    + (k.yil ? '<span>' + veBasEsc(k.yil) + '</span>' : '')
    + (k.sag ? '<i>' + veBasEsc(k.sag) + '</i>' : '') + '</span>'
    + '<span class="ve-bas-kunye-2">' + veBasEsc(k.alt) + '</span>'
    + '</span></button>';
}

// ── SAYFA — üst satır · başlık · alt metin · kapılar · karolar · not ───────
// s: { ust, baslik, alt, kapilar:[kapı…], bolum:{ baslik, not, karolar:[karo…] }, not }
function veBasSayfaHTML(s){
  s = s || {};
  var h = '<div class="ve-bas-ic">'
    + '<span class="ve-bas-ust">' + veBasEsc(s.ust) + '</span>'
    + '<h1>' + veBasEsc(s.baslik) + '</h1>'
    + '<p class="ve-bas-alt">' + veBasEsc(s.alt) + '</p>'
    + '<div class="ve-bas-kapilar">' + (s.kapilar || []).map(veBasKapiHTML).join('') + '</div>';
  var b = s.bolum;
  if(b && b.karolar && b.karolar.length){
    h += '<div class="ve-bas-baslik"><h2>' + veBasEsc(b.baslik) + '</h2>'
      + (b.not ? '<span>' + veBasEsc(b.not) + '</span>' : '') + '</div>'
      + '<div class="ve-bas-raporlar">' + b.karolar.map(veBasKaroHTML).join('') + '</div>';
  }
  if(s.not) h += '<p class="ve-bas-not">' + veBasEsc(s.not) + '</p>';
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
    veBasSayfaHTML: veBasSayfaHTML, veBasKur: veBasKur, veBasTazele: veBasTazele, veBasAcik: veBasAcik
  };
}
