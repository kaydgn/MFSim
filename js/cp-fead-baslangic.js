// ════════════════════════════════════════════════════════════════════════════
//  FEAD BAŞLANGIÇ SAYFASI — boş bir kayış sisteminin karşılaması
// ════════════════════════════════════════════════════════════════════════════
//
// Kullanıcı kararı (2026-09-29, tasarım tuvali "İlk açılış" · B): *"İlk
// açılış B başlangıç sayfası olacak."* İsteğin kendisi: *"FEAD modülünü açınca
// sihirbaz anında karşımızda beliriyor. Bunun böyle olmasını istemiyorum."*
//
// ÖLÇÜLEN KUSUR (1440×900): sihirbaz ekranın %77'sini kaplıyor ve arkayı %62
// karartıyordu; ilk görülen şey model değil HATA'ydı ("7 eksik/çelişkili
// girdi", kırmızı "çözülemiyor"). Boş bir sistemde eksik girdi bir arıza değil,
// başlangıçtır — sayfa bu yüzden kapı gösterir, hüküm göstermez.
//
// KURALLAR:
//  • GÖRÜNÜRLÜK MODELDEN TÜRER, BAYRAK TUTULMAZ: kasnak yok VE Kayış Yolu kartı
//    yok → sayfa (`veFeadBaslangicGerekli`). Kapıyı seçen kullanıcı modeli
//    kurar ve sayfa kendiliğinden çekilir; Ctrl+Z kurulumu geri alırsa sayfa
//    geri gelir. Bayrak olsaydı kaydedilmek zorunda kalırdı ve geri-al ile
//    ayrışırdı. Açılış yüzeyi bu yüzden Kayış Yolu kartı KURMAZ
//    (veFeadPopulateStarter): boş kartın işi — "buradan başla" — bu sayfanın.
//  • KAPILAR MODÜLÜN VAR OLAN ÇAĞRILARI: Sihirbaz `veFeadWizOpenAny`, STEP
//    sihirbazın 1. adımının dosya seçicisi, boş çizim masası `veFeadKanvasEkle`,
//    rapor `veFeadLoadExample`. Sayfa hiçbir düğüm kendisi KURMAZ — ikinci bir
//    kurucu, iki yolun sessizce ayrışması demekti (modülün tekrar eden kuralı).
//  • KÜÇÜK RESİM ÇİZİCİDEN (`veFeadLayoutSVG`), rapor örneğinin KENDİ
//    modelinden: sunum kendi geometrisini hesaplamaz (üç katman kuralı).
//  • SAYFA TUVALİ ÖRTER: FEAD araçları penceresi o süre GİZLİ
//    (js/cp-fead-araclar.js → `_feadAracBaslangic`) — iki yüzey aynı kapıları
//    aynı anda göstermesin. Ana topolojiye dönüş düğmesi (breadcrumb, z 60)
//    sayfanın ÜSTÜNDE kalır: alt topolojiden çıkmanın tek yolu o.
//  • FARE SAYFADA KALIR: tuvalin sürükleme/seçme/yakınlaştırma dinleyicileri
//    kap üzerinde; tekerlek sayfayı kaydırır, kadrajı değil.
// Görünüm CSS'te (`css/styles.css` → `.ve-fead-bas*`).

var VE_FEAD_BAS_ID = 've-fead-baslangic';
// Küçük resmin tuvali (kullanıcı birimi). Ad, açı ve gül ÇİZİLMEZ: 240 px'lik
// bir karede hiçbiri okunmuyor; karenin sorusu "bu kayış yolu neye benziyor".
var VE_FEAD_BAS_RESIM = { w: 330, h: 150 };
var _feadBasResimler = {};        // anahtar → SVG (örnekler durağan: oturumluk önbellek)

function _feadBasEsc(s){
  return String(s == null ? '' : s).replace(/[&<>"']/g, function(c){
    return { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c];
  });
}
function _feadBasIkon(ad){ return (typeof veIkon === 'function') ? veIkon(ad) : ''; }
function _feadBasTip(n){
  return (typeof componentDefs !== 'undefined' && n && componentDefs[n.type]) || (n && n.def) || {};
}

// ── GÖRÜNÜRLÜK — SAF: yalnız modeli okur ───────────────────────────────────
// Liste verilmezse canlı `nodes`. Kasnak (gergi dâhil — `isFeadPulley`) ya da
// Kayış Yolu kartı (`isFeadLayout`) varsa kullanıcı zaten bir yol seçmiş.
function veFeadBaslangicGerekli(liste){
  if(!liste) liste = (typeof nodes !== 'undefined' && nodes) ? nodes : [];
  for(var i = 0; i < liste.length; i++){
    var d = _feadBasTip(liste[i]);
    if(d.isFeadPulley || d.isFeadLayout) return false;
  }
  return true;
}

// ── RAPORLAR — sihirbazın örnek listesinin KENDİSİ ─────────────────────────
// `veFeadExampleKeys` kullanıcıya gösterilen liste (gizli kayıt dışarıda);
// ikinci bir liste tutulmaz. Künye örneğin adından ve kaydından okunur:
// "BMC Otomotif FEAD 5 — Gates AG00976 raporu" → sistem + rapor kodu, yıl
// anahtardan (AG00976_GATES_2025). Sıra: yeni rapor önce, aynı yılda kod.
function veFeadBaslangicRaporlar(){
  if(typeof veFeadExampleKeys !== 'function' || typeof veFeadExampleOf !== 'function') return [];
  var out = [];
  veFeadExampleKeys().forEach(function(k, sira){
    var ex = veFeadExampleOf(k);
    if(!ex) return;
    var ad = String(ex.name || k);
    var parca = ad.split(' — ');
    var kodM = /\b(AG\d+)\b/.exec(ad) || /^(AG\d+)/.exec(k);
    var yilM = /_(\d{4})$/.exec(k);
    // Parantezdeki niteleyici YALNIZ kaydın kendi ayırt edicisiyse yazılır
    // ("iki klima"); boy ya da kaburga (1475 · 4PK) kayış kodunda zaten var.
    var nitM = parca[1] ? /\(([^)]+)\)\s*$/.exec(parca[1]) : null;
    var nit = nitM && !/^\d+$|^\d+PK$/i.test(nitM[1]) ? nitM[1] : '';
    var b = ex.belt || {};
    out.push({
      key: k, sira: sira,
      kod: kodM ? kodM[1] : k,
      yil: yilM ? yilM[1] : '',
      kasnak: (ex.pulleys || []).length,
      kayis: b.beltType || ((b.ribs || '') + (b.profile || '')),
      sistem: parca[0] + (nit ? ', ' + nit : ''),
      ad: ad
    });
  });
  out.sort(function(a, b){
    if(a.yil !== b.yil) return a.yil < b.yil ? 1 : -1;
    var na = parseInt(String(a.kod).replace(/\D/g, ''), 10) || 0;
    var nb = parseInt(String(b.kod).replace(/\D/g, ''), 10) || 0;
    if(na !== nb) return nb - na;
    return a.sira - b.sira;
  });
  return out;
}

// Rapor örneğinin kayış yolu — çizici TEK KAYNAK. Çözülemezse boş (kare yine
// basılır, künyesiyle; yükleme de yine çalışır).
function veFeadBaslangicResim(key){
  if(Object.prototype.hasOwnProperty.call(_feadBasResimler, key)) return _feadBasResimler[key];
  var svg = '';
  try {
    if(typeof veFeadExampleNodes === 'function' && typeof veFeadBuildSystem === 'function'
       && typeof veFeadLayoutSVG === 'function'){
      var pack = veFeadExampleNodes(key);
      var b = pack ? veFeadBuildSystem(pack.nodes) : null;
      svg = (b && b.ok) ? (veFeadLayoutSVG(b, VE_FEAD_BAS_RESIM.w, VE_FEAD_BAS_RESIM.h, {
        posMode: 'mean', compass: false, pivot: false, arrows: false,
        nameLabels: false, wrapLabels: false, spanLabels: false, ghostLabels: false,
        frame: false }) || '') : '';
    }
  } catch(e){ svg = ''; }
  _feadBasResimler[key] = svg;
  return svg;
}

// ── HTML — SAF: yalnız sabitlerden ve örnek kaydından ─────────────────────
function _feadBasKapi(ey, ikon, ad, not, birincil, rozet){
  return '<button type="button" class="ve-fead-bas-kapi' + (birincil ? ' birincil' : '') + '" data-ey="' + ey + '">'
    + '<span class="ve-fead-bas-kapi-ik">' + _feadBasIkon(ikon) + '</span>'
    + '<span class="ve-fead-bas-kapi-t"><b>' + _feadBasEsc(ad)
    + (rozet ? '<i>' + _feadBasEsc(rozet) + '</i>' : '') + '</b>'
    + '<span>' + _feadBasEsc(not) + '</span></span></button>';
}

function veFeadBaslangicHTML(){
  // Sihirbazın adımları RAYIN KENDİ ADLARIYLA (ilk adım "Başlangıç" bu
  // sayfanın ta kendisi, listede yok) — elle yazılmış bir sayı ya da liste,
  // adım eklenince/kalkınca sessizce bayatlardı (ölçüldü: sihirbazın kendi
  // metinlerinde "7. adım" yazıyordu, adım sayısı 6).
  var adimlar = (typeof VE_FW_STEPS !== 'undefined' && VE_FW_STEPS)
    ? VE_FW_STEPS.slice(1).map(function(s){ return s.ad; }).join(' · ') : '';
  var raporlar = veFeadBaslangicRaporlar();
  var h = '<div class="ve-fead-bas-ic">'
    + '<span class="ve-fead-bas-ust">FEAD · yeni kayış sistemi</span>'
    + '<h1>Nereden başlayalım?</h1>'
    + '<p class="ve-fead-bas-alt">Kayış yolu henüz boş. Seçtiğin kapı modeli kurar ve bu sayfa çekilir — '
    + 'sonra her şey çizimde ve Kayış Tablosu\'nda değişir.</p>'
    + '<div class="ve-fead-bas-kapilar">'
    + _feadBasKapi('sihirbaz', 'wand', 'Sihirbazla kur',
        adimlar ? ('Adım adım: ' + adimlar + '.') : 'Modeli adım adım kurar.', true, 'önerilen')
    + _feadBasKapi('step', 'box', 'STEP\'ten başla',
        'CATIA/3DEXPERIENCE montajını oku; kasnak rollerini 3B görüntüleyicide sen ver.')
    + _feadBasKapi('bos', 'ruler', 'Boş çizim masası',
        'Kayış Yolu kartını boş kur; kasnakları Kayış Tablosu\'ndan ekle.')
    + '</div>';
  if(raporlar.length){
    h += '<div class="ve-fead-bas-baslik"><h2>Gates raporlarından başla</h2>'
      + '<span>' + raporlar.length + ' rapor · raporun modeli birebir yüklenir, sonra her şey değiştirilebilir</span></div>'
      + '<div class="ve-fead-bas-raporlar">'
      + raporlar.map(function(r){
          var svg = veFeadBaslangicResim(r.key);
          return '<button type="button" class="ve-fead-bas-karo" data-ey="rapor" data-v="' + _feadBasEsc(r.key) + '"'
            + ' title="' + _feadBasEsc(r.ad) + ' — yükle">'
            + '<span class="ve-fead-bas-resim">' + (svg || '<i class="ve-fead-bas-resim-yok">çizilemedi</i>')
            + '<em>Yükle</em></span>'
            + '<span class="ve-fead-bas-kunye"><span class="ve-fead-bas-kunye-1"><b>' + _feadBasEsc(r.kod) + '</b>'
            + (r.yil ? '<span>' + _feadBasEsc(r.yil) + '</span>' : '')
            + '<i>' + r.kasnak + ' kasnak</i></span>'
            + '<span class="ve-fead-bas-kunye-2">' + _feadBasEsc([r.kayis, r.sistem].filter(Boolean).join(' · ')) + '</span>'
            + '</span></button>';
        }).join('')
      + '</div>';
  }
  h += '<p class="ve-fead-bas-not">Sayfa bir kapı seçilince çekilir. Aynı yollar sonra da açık: '
    + 'Sihirbaz ve yeni kanvas FEAD araçları penceresinde, STEP ve raporlar sihirbazın ilk adımında.</p>'
    + '</div>';
  return h;
}

// ── EYLEMLER — hepsi modülün var olan çağrılarına gider ────────────────────
function veFeadBaslangicEylem(ad, v){
  if(ad === 'sihirbaz')
    return !!(typeof veFeadWizOpenAny === 'function' && veFeadWizOpenAny());
  if(ad === 'step'){
    if(!(typeof veFeadWizOpenAny === 'function' && veFeadWizOpenAny())) return false;
    // Sihirbaz 1. adımda açılır ve STEP kartı oradadır. Dosya seçici AYNI
    // tıklamanın içinde açılır (tarayıcı kullanıcı hareketi ister); açılamazsa
    // kart yerinde durur, kullanıcı oradan seçer.
    try {
      var f = (typeof document !== 'undefined') ? document.querySelector('#ve-fw-body .ve-fw-stp-file') : null;
      if(f && typeof f.click === 'function') f.click();
    } catch(e){ /* dosya seçici açılamadı: kart yine görünür */ }
    return true;
  }
  if(ad === 'bos')
    return !!(typeof veFeadKanvasEkle === 'function' && veFeadKanvasEkle({ bos: true }));
  if(ad === 'rapor'){
    if(!v || typeof veFeadLoadExample !== 'function') return false;
    return !!veFeadLoadExample(v);
  }
  return false;
}

// ── DOM — kurma ve görünürlük ──────────────────────────────────────────────
function _feadBasKap(){
  return (typeof document !== 'undefined') ? document.getElementById('ve-canvas-wrapper') : null;
}
function _feadBasEl(){
  return (typeof document !== 'undefined') ? document.getElementById(VE_FEAD_BAS_ID) : null;
}

function veFeadBaslangicKur(){
  var kap = _feadBasKap();
  if(!kap) return null;
  var el = _feadBasEl();
  if(el) return el;
  el = document.createElement('section');
  el.id = VE_FEAD_BAS_ID;
  el.className = 've-fead-bas';
  el.setAttribute('role', 'region');
  el.setAttribute('aria-label', 'FEAD başlangıç sayfası');
  el.hidden = true;
  el.innerHTML = veFeadBaslangicHTML();
  // TUVALE OLAY SIZDIRMA: kabın dinleyicileri pan/seçim/yakınlaştırma yapıyor.
  // Tekerlek pasif dinlenir — sayfa kendi kaydırmasını yapar, kadraj oynamaz.
  ['mousedown', 'pointerdown', 'dblclick', 'contextmenu', 'wheel', 'click'].forEach(function(t){
    el.addEventListener(t, function(e){ e.stopPropagation(); }, t === 'wheel' ? { passive: true } : false);
  });
  el.addEventListener('click', function(e){
    var b = e.target && e.target.closest && e.target.closest('[data-ey]');
    if(!b) return;
    veFeadBaslangicEylem(b.getAttribute('data-ey'), b.getAttribute('data-v'));
  });
  kap.appendChild(el);
  return el;
}

// Kapsamda mıyız sorusu çağıranın (FEAD araçları penceresi kapsamı tutuyor).
// Döner: sayfa AÇIK mı. Kapsam dışında hiçbir şey kurulmaz.
function veFeadBaslangicTazele(kapsamda){
  var el = _feadBasEl();
  var acik = !!kapsamda && veFeadBaslangicGerekli();
  if(!acik){ if(el) el.hidden = true; return false; }
  el = el || veFeadBaslangicKur();
  if(!el) return false;
  if(el.hidden){
    // Her AÇILIŞTA yeniden basılır (tema, adım listesi ve örnek listesi
    // o an neyse); açıkken yeniden basmak odağı ve kaydırmayı düşürürdü.
    el.innerHTML = veFeadBaslangicHTML();
    el.scrollTop = 0;
    el.hidden = false;
  }
  return true;
}

function veFeadBaslangicAcik(){
  var el = _feadBasEl();
  return !!(el && !el.hidden);
}

if(typeof module !== 'undefined' && module.exports){
  module.exports = {
    veFeadBaslangicGerekli: veFeadBaslangicGerekli, veFeadBaslangicRaporlar: veFeadBaslangicRaporlar,
    veFeadBaslangicResim: veFeadBaslangicResim, veFeadBaslangicHTML: veFeadBaslangicHTML,
    veFeadBaslangicEylem: veFeadBaslangicEylem, veFeadBaslangicKur: veFeadBaslangicKur,
    veFeadBaslangicTazele: veFeadBaslangicTazele, veFeadBaslangicAcik: veFeadBaslangicAcik,
    VE_FEAD_BAS_ID: VE_FEAD_BAS_ID, VE_FEAD_BAS_RESIM: VE_FEAD_BAS_RESIM,
    _feadBasSifirla: function(){ _feadBasResimler = {}; }
  };
}
