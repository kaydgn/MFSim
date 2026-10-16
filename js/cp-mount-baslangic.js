// ════════════════════════════════════════════════════════════════════════════
//  TAKOZ BAŞLANGIÇ SAYFASI — boş bir güç grubu modelinin karşılaması
// ════════════════════════════════════════════════════════════════════════════
//
// Kullanıcı isteği (2026-10-14): *"FEAD modülünün başlangıç ekranı çok güzel,
// aynı onun gibi bir ekran istiyorum. Takoz modülüne de 'Başlangıç Sihirbazı',
// 'STEP dosyadan başlama' ve 'Boş kanvas' gibi özellikler kuracağız."*
//
// Önceki açılış iç topolojiye tek bir "Başlangıç ve Örnekler" bileşeni
// koyuyordu; kullanıcı ne yapacağını o bileşene çift tıklayıp panelini açınca
// öğreniyordu. Sayfa aynı soruyu tuvalin tamamında, kapılarla sorar.
//
// KURALLAR (FEAD kural 5'in aynısı — iki modül aynı sayfayı kurar):
//  • GÖRÜNÜM VE DOM ORTAK KİTTEN (js/baslangic-sayfa.js · `.ve-bas*`). Bu
//    dosyada kalan şey Takoz'un kendisi: görünürlük sorusu, kapıların
//    eylemleri, örneklerin künyesi ve küçük resmi.
//  • GÖRÜNÜRLÜK MODELDEN TÜRER, BAYRAK TUTULMAZ: Takoz topolojisinde
//    kullanıcının seçtiği bir yol yoksa sayfa (`veMntBaslangicGerekli`). Kapı
//    modeli kurar, sayfa kendiliğinden çekilir; Ctrl+Z kurulumu geri alırsa
//    sayfa geri gelir. Bayrak olsaydı kaydedilmek zorunda kalırdı ve geri-al
//    ile ayrışırdı.
//  • KAPILAR MODÜLÜN ÇAĞRILARI, sayfa düğüm KURMAZ: Sihirbaz `veMntWizAc`,
//    STEP sihirbazın 1. adımının dosya seçicisi (AYNI tıklamada), Boş kanvas
//    `veMntKanvasBos`, örnek `veMntOrnekYukle`. İkinci bir kurucu, iki yolun
//    sessizce ayrışması demekti.
//  • KÜÇÜK RESİM Görünümler'in çizicisinden (`veMntAkso.ciz`,
//    sade kip) ve kurucusundan (`veMntAksoOrnekModel`), örneğin KENDİ
//    modelinden — sunum kendi geometrisini kurmaz.
//  • Paletten sayfanın üstüne bırakılan bileşen tuvale kurulur (kit
//    sürükle-bırakı sızdırır) ve sayfa çekilir: dördüncü kapı.
//  • Tazeleme iki noktadan: kapsam değişimi (`veSyncSidebarScope` →
//    `veMntBaslangicKapsam`) ve düğüm kümesi değişimi (`updateNodeCount` →
//    `veMntBaslangicTazele` — ekleme, silme, geri yükleme, sekme yükleme).

var VE_MNT_BAS_ID = 've-mnt-baslangic';
// Küçük resmin tuvali (kullanıcı birimi) — karonun resim kutusunun oranı
// (1440 px'te 228 × 79 px). FEAD'in 330 × 150'si aksonometride yüksekliği
// sınırlıyordu: çizim kutunun eninin %76'sında kalıyordu (Siper'de ölçek
// 0,033 → 0,043 px/mm).
var VE_MNT_BAS_RESIM = { w: 330, h: 114 };
var _mntBasResimler = {};        // anahtar → SVG (örnekler durağan: oturumluk önbellek)
var _mntBasKapsam = false;       // Takoz alt topolojisinde miyiz (veSyncSidebarScope yazar)

// Kit global'de (index.html onu bu dosyadan ÖNCE yükler); Node'da modül.
function _mntBasKit(){
  if(typeof veBasSayfaHTML === 'function')
    return { sayfa: veBasSayfaHTML, kur: veBasKur, tazele: veBasTazele, acik: veBasAcik };
  if(typeof require === 'function'){
    try {
      var K = require('./baslangic-sayfa.js');
      return { sayfa: K.veBasSayfaHTML, kur: K.veBasKur, tazele: K.veBasTazele, acik: K.veBasAcik };
    } catch(e){ return null; }
  }
  return null;
}
function _mntBasTip(n){
  return (typeof componentDefs !== 'undefined' && n && componentDefs[n.type]) || (n && n.def) || {};
}

// ── GÖRÜNÜRLÜK — SAF: yalnız modeli okur ───────────────────────────────────
// Liste verilmezse canlı `nodes`. Herhangi bir düğüm kullanıcının bir yol
// seçtiğini söyler — "Başlangıç ve Örnekler" (mnt-example) DIŞINDA: eski
// açılış onu kendiliğinden kuruyordu (2026-10-14'e kadar), yani o tek düğümü
// taşıyan kayıtlı bir topoloji aslında boştur.
function veMntBaslangicGerekli(liste){
  if(!liste) liste = (typeof nodes !== 'undefined' && nodes) ? nodes : [];
  for(var i = 0; i < liste.length; i++){
    if(!_mntBasTip(liste[i]).isMountExample) return false;
  }
  return true;
}

// ── ÖRNEKLER — "Başlangıç ve Örnekler" panelinin listesinin KENDİSİ ────────
// Kayıt defteri `veMountCore.getMountExampleList`; ikinci bir liste tutulmaz.
// Künye örneğin kaydından okunur: araç · toplam kütle · takoz sayısı · gövde adları.
function veMntBaslangicOrnekler(){
  var C = (typeof veMountCore !== 'undefined') ? veMountCore : null;
  if(!C || typeof C.getMountExampleList !== 'function') return [];
  var out = [];
  C.getMountExampleList().forEach(function(ex){
    var M = ex && ex.model;
    if(!M || !M.components) return;
    var kutle = 0;
    M.components.forEach(function(c){ kutle += (Number(c.mass) || 0); });
    out.push({
      key: ex.id, ad: ex.name || ex.id, arac: ex.vehicle || ex.name || ex.id,
      govde: M.components.length, takoz: (M.mounts || []).length, kutle: kutle,
      govdeAdlari: M.components.map(function(c){ return c.name; }),
      kurgu: !!ex.kurgu
    });
  });
  return out;
}

// Örneğin AKSONOMETRİSİ — Görünümler'in resmi (kullanıcı
// seçimi 2026-10-15: "seçtiklerimizi bileşene aktar", sonra karolar). Çizici
// de model de TEK KAYNAK: veMntAkso.ciz (sade kip: yazısız, cetvelsiz) ve
// veMntAksoOrnekModel (pencerenin kurucusu, örneğin KENDİ kaydından).
// Görünüş pencerenin varsayılanı: dimetrik, önden-soldan-yukarıdan, gölge.
// Çizilemezse boş (karo yine basılır, künyesiyle; yükleme de yine çalışır).
function veMntBaslangicResim(key){
  if(Object.prototype.hasOwnProperty.call(_mntBasResimler, key)) return _mntBasResimler[key];
  var svg = '';
  try {
    var ex = (typeof veMountCore !== 'undefined' && veMountCore.getMountExample) ? veMountCore.getMountExample(key) : null;
    var Ak = (typeof veMntAkso !== 'undefined' && veMntAkso && veMntAkso.ciz) ? veMntAkso : null;
    var m = (ex && ex.model && typeof veMntAksoOrnekModel === 'function') ? veMntAksoOrnekModel(ex.model) : null;
    if(Ak && m && (m.govde.length || m.takoz.length))
      svg = Ak.ciz(m, { W: VE_MNT_BAS_RESIM.w, H: VE_MNT_BAS_RESIM.h, sade: true }).svg || '';
  } catch(e){ svg = ''; }
  _mntBasResimler[key] = svg;
  return svg;
}

// ── HTML — SAF: yalnız sabitlerden ve örnek kaydından ─────────────────────
// Kapıların adı ve örneklerin künyesi. İki grup: gerçek araçlar ve KURGU
// doğrulama modelleri (kayıtta `kurgu`) — kurgu model gerçek bir aracı temsil
// etmez; bölüm başlığı ve karonun "kurgu" işareti bunu söyler, gerçek
// örneklerle aynı listede karışmaz.
function veMntBaslangicHTML(){
  var ornekler = veMntBaslangicOrnekler();
  var K = _mntBasKit();
  if(!K) return '';
  var kg = function(x){ return (typeof veSayi === 'function') ? veSayi(x, 0) : String(Math.round(x)); };
  // Alt satır SIĞAN künye: gövde adlarının listesi karoda üç noktayla
  // kesiliyordu (yerleşim kapısı, 3 karonun 3'ü) — adlar ipucunda (VERİ).
  var karo = function(o){
    return { ey: 'ornek', v: o.key, baslik: o.ad + ' — ' + o.govdeAdlari.join(' · '),
             resim: veMntBaslangicResim(o.key), kod: o.arac, yil: kg(o.kutle) + ' kg',
             sag: o.kurgu ? 'kurgu' : '', alt: o.govde + ' gövde · ' + o.takoz + ' takoz' };
  };
  var gercek = ornekler.filter(function(o){ return !o.kurgu; });
  var kurgu = ornekler.filter(function(o){ return o.kurgu; });
  return K.sayfa({
    kapilar: [
      { ey: 'sihirbaz', ikon: 'wand', ad: 'Sihirbazla kur', birincil: true },
      { ey: 'step', ikon: 'box', ad: 'STEP\'ten başla' },
      { ey: 'bos', ikon: 'grid', ad: 'Boş kanvas' }
    ],
    bolumler: [
      { baslik: 'Örnek modellerden başla', karolar: gercek.map(karo) },
      { baslik: 'Doğrulama örnekleri — kurgu', karolar: kurgu.map(karo) }
    ]
  });
}

// ── EYLEMLER — hepsi modülün var olan çağrılarına gider ────────────────────
function veMntBaslangicEylem(ad, v){
  if(ad === 'sihirbaz')
    return !!(typeof veMntWizAc === 'function' && veMntWizAc());
  if(ad === 'step')
    return !!(typeof veMntWizAcStep === 'function' && veMntWizAcStep());
  if(ad === 'bos')
    return !!(typeof veMntKanvasBos === 'function' && veMntKanvasBos().length);
  if(ad === 'ornek'){
    if(!v || typeof veMntOrnekYukle !== 'function') return false;
    return !!veMntOrnekYukle(v);
  }
  return false;
}

// ── DOM — kurma ve görünürlük (kit) ────────────────────────────────────────
function _mntBasSecenek(){
  return { id: VE_MNT_BAS_ID, aria: 'Takoz başlangıç sayfası',
           html: veMntBaslangicHTML, eylem: veMntBaslangicEylem };
}

// Kapsam: yalnız Takoz alt topolojisinde. Kapsamın tek noktası
// veSyncSidebarScope (components.js) — modül aç/kapa, sekme, proje yükleme.
function veMntBaslangicKapsam(scope){
  _mntBasKapsam = (scope === 'mount-analysis');
  return veMntBaslangicTazele();
}

// Döner: sayfa AÇIK mı. Kapsam dışında hiçbir şey kurulmaz.
function veMntBaslangicTazele(){
  var K = _mntBasKit();
  if(!K) return false;
  return K.tazele(_mntBasSecenek(), _mntBasKapsam && veMntBaslangicGerekli());
}

function veMntBaslangicAcik(){
  var K = _mntBasKit();
  return K ? K.acik(VE_MNT_BAS_ID) : false;
}

if(typeof module !== 'undefined' && module.exports){
  module.exports = {
    veMntBaslangicGerekli: veMntBaslangicGerekli, veMntBaslangicOrnekler: veMntBaslangicOrnekler,
    veMntBaslangicResim: veMntBaslangicResim, veMntBaslangicHTML: veMntBaslangicHTML,
    veMntBaslangicEylem: veMntBaslangicEylem, veMntBaslangicKapsam: veMntBaslangicKapsam,
    veMntBaslangicTazele: veMntBaslangicTazele, veMntBaslangicAcik: veMntBaslangicAcik,
    VE_MNT_BAS_ID: VE_MNT_BAS_ID, VE_MNT_BAS_RESIM: VE_MNT_BAS_RESIM,
    _mntBasSifirla: function(){ _mntBasResimler = {}; _mntBasKapsam = false; }
  };
}
