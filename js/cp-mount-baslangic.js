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
//    eylemleri ve örneklerin künyesi.
//  • GÖRÜNÜRLÜK MODELDEN TÜRER, BAYRAK TUTULMAZ: Takoz topolojisinde
//    kullanıcının seçtiği bir yol yoksa sayfa (`veMntBaslangicGerekli`). Kapı
//    modeli kurar, sayfa kendiliğinden çekilir; Ctrl+Z kurulumu geri alırsa
//    sayfa geri gelir. Bayrak olsaydı kaydedilmek zorunda kalırdı ve geri-al
//    ile ayrışırdı.
//  • KAPILAR MODÜLÜN ÇAĞRILARI, sayfa düğüm KURMAZ: Sihirbaz `veMntWizAc`,
//    STEP `veMntCadAcStep` (dosya seçici AYNI tıklamada; dosya 3B'de okunur,
//    sihirbaz açılmaz — kullanıcı kararı 2026-11-02), Boş kanvas
//    `veMntKanvasBos`, örnek `veMntOrnekYukle`. İkinci bir kurucu, iki yolun
//    sessizce ayrışması demekti.
//  • ÖRNEKLER DİZİNDE, RESİMSİZ (kitin Çalışma masası; kullanıcı seçimi
//    2026-11-04, tasarım tuvali "sade seçenekler" · D): satır araç · gövde ve
//    takoz sayısı · kütle · kaynak; satırın Yükle'si TEK TIKLA
//    `veMntOrnekYukle`, adı ayrıntıyı açar (gövdeler kütleleriyle, takozlar).
//    Satırın her yazısı örneğin KENDİ kaydından — ikinci bir künye listesi
//    tutulmaz. Önizleme ve resimli karolar aynı gün emekli (*"Ortada falan
//    kocaman şekil olmuş, çirkin duruyor"*).
//  • Paletten sayfanın üstüne bırakılan bileşen tuvale kurulur (kit
//    sürükle-bırakı sızdırır) ve sayfa çekilir: dördüncü kapı.
//  • Tazeleme iki noktadan: kapsam değişimi (`veSyncSidebarScope` →
//    `veMntBaslangicKapsam`) ve düğüm kümesi değişimi (`updateNodeCount` →
//    `veMntBaslangicTazele` — ekleme, silme, geri yükleme, sekme yükleme).

var VE_MNT_BAS_ID = 've-mnt-baslangic';
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
// Sabit tarayıcıda global, Node'da kendi dosyasının dışa aktarımı — kitin yolu.
function _mntBasG(ad, dosya){
  if(typeof window !== 'undefined' && window[ad] !== undefined) return window[ad];
  if(typeof require === 'function'){
    try { return require(dosya)[ad]; } catch(e){ return undefined; }
  }
  return undefined;
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
// Künye örneğin kaydından okunur: araç · toplam kütle · gövde ve takoz sayısı ·
// gövdeler (ad, kütle) · takozların adı · kaynak.
// KAYNAK: gerçek örnekte kaydın "Kaynak" satırı, yoksa açıklaması ("Kaynak: "
// öneki düşer); kurgu örnekte açıklaması — kurgu kaydın "Kaynak" satırı
// ("Kurgu — …") bölüm başlığının söylediğini tekrar ederdi.
function _mntBasKaynak(ex){
  var sat = ((ex && ex.specs) || []).filter(function(x){ return x && x[0] === 'Kaynak'; })[0];
  if(sat && !ex.kurgu && sat[1]) return String(sat[1]);
  return String((ex && ex.description) || '').replace(/^Kaynak:\s*/, '');
}
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
      govdeler: M.components.map(function(c){ return { ad: c.name, kg: Number(c.mass) || 0 }; }),
      takozAdlari: (M.mounts || []).map(function(m){ return String((m && m.name) || '').trim(); }).filter(Boolean),
      kaynak: _mntBasKaynak(ex),
      kurgu: !!ex.kurgu
    });
  });
  return out;
}

// ── KİMLİK VE VERİ — sayfanın üst şeridi (kullanıcı isteği 2026-10-19) ─────
// Analizlerin adı PROGRAMDAKİ adıdır: raporun adımı (Statik sehim · Modal
// analiz · Frekans yerleşimi ve iletilebilirlik), Sonuçlar'ın kanalı (Şok
// yanıtı), Parametrik Analiz'in analizi (Katalogdan seçim). Sayılar
// kaynağından ÖLÇÜLÜR — elle yazılmış bir sayı kütüphane büyüyünce sessizce
// bayatlardı. Kapı: mount-baslangic.test.js → KİMLİK VE VERİ.
var VE_MNT_BAS_YETENEK = ['Statik sehim', 'Modal analiz', 'İletilebilirlik', 'Şok yanıtı', 'Katalogdan seçim'];
// Güç grubu tek katı gövde: serbestlik derecesi çekirdeğin rijitlik
// matrisinin boyutu (6 × 6 — kapı onu çekirdekten ölçer).
var VE_MNT_BAS_SD = 6;

function veMntBaslangicKimlik(){
  var def = (typeof componentDefs !== 'undefined' && componentDefs['mount-analysis']) || {};
  var kitOf = _mntBasG('veGuideKitOf', './guide-kit.js'), hazir = _mntBasG('veGuideKitReady', './guide-kit.js');
  var kilavuz = (typeof kitOf === 'function' && typeof hazir === 'function' && hazir(kitOf('mount'))) ? 'mount' : '';
  return { ad: def.name || 'Takoz Çökme-Titreşim', ikon: def.svg || '', yetenekler: VE_MNT_BAS_YETENEK, kilavuz: kilavuz };
}

function veMntBaslangicVeri(){
  var n = function(x){ return (typeof veSayi === 'function') ? veSayi(x, 0) : String(x); };
  var lib = _mntBasG('VE_MOUNT_LIBRARY', './cp-mount.js') || {};
  var tip = Object.keys(lib);
  var yasa = tip.filter(function(k){ var m = lib[k] || {}; return !!(m.fits || m.curves); });
  var govde = _mntBasG('VE_MW_GOVDE_TIPLERI', './cp-mount-wizard.js') || [];
  var govdeAd = govde.map(function(t){
    return (typeof componentDefs !== 'undefined' && componentDefs[t] && componentDefs[t].name) || t;
  });
  return [
    { deger: n(tip.length), ad: 'Takoz tipi' },
    { deger: n(yasa.length), ad: 'Kuvvet–sehim yasası',
      title: yasa.map(function(k){ return (lib[k] && lib[k].name) || k; }).join(' · ') },
    { deger: n(govde.length), ad: 'Gövde tipi', title: govdeAd.join(' · ') },
    { deger: n(veMntBaslangicOrnekler().length), ad: 'Örnek model' },
    { deger: n(VE_MNT_BAS_SD), ad: 'Serbestlik derecesi' }
  ].filter(function(x){ return x.deger !== '0'; });
}

// Kapıların künyesi — sihirbazın adımları RAYIN KENDİ ADLARIYLA (ilk adım
// "Başlangıç" bu sayfanın ta kendisi, listede yok), STEP'in biçimi okuyucunun
// başlığı ve dosya seçicinin uzantıları, boş kanvasın kurduğu araçlar.
var VE_MNT_BAS_STEP = ['ISO 10303-21', '.stp', '.step', '.stpz', '.p21'];
function veMntBaslangicKapilar(){
  var adim = (_mntBasG('VE_MW_STEPS', './cp-mount-wizard.js') || []).slice(1)
    .map(function(s){ return s.ad; });
  var arac = (_mntBasG('VE_MNT_ARAC_TIPLERI', './cp-mount.js') || []).map(function(t){
    return (typeof componentDefs !== 'undefined' && componentDefs[t] && componentDefs[t].name) || t;
  });
  return [
    { ey: 'sihirbaz', ikon: 'wand', ad: 'Sihirbazla kur', birincil: true, kunye: adim },
    { ey: 'step', ikon: 'box', ad: 'STEP\'ten başla', kunye: VE_MNT_BAS_STEP },
    { ey: 'bos', ikon: 'grid', ad: 'Boş kanvas', kunye: arac.length ? [arac.length + ' araç'] : [],
      title: arac.join(' · ') }
  ];
}

// ── SAYFA — SAF: yalnız sabitlerden ve örnek kaydından ────────────────────
// Kapıların adı ve örneklerin dizini. İki grup: gerçek araçlar ve KURGU
// doğrulama modelleri (kayıtta `kurgu`) — kurgu model gerçek bir aracı temsil
// etmez; bölüm başlığı bunu söyler, gerçek örneklerle aynı grupta karışmaz.
// Satır araç · gövde ve takoz sayısı · kütle · kaynak; ayrıntısı gövdeler
// (kütleleriyle, tek ondalık) ve takozların adı.
function veMntBaslangicSayfa(){
  var ornekler = veMntBaslangicOrnekler();
  var n = function(x, b){ return (typeof veSayi === 'function') ? veSayi(x, b || 0) : String(Math.round(x)); };
  var satir = function(o){
    return { ey: 'ornek', v: o.key, ad: o.arac,
             sayi: n(o.govde) + ' gövde · ' + n(o.takoz) + ' takoz',
             kutle: n(o.kutle) + ' kg', kaynak: o.kaynak,
             detay: [
               { baslik: 'Gövdeler', ogeler: o.govdeler.map(function(g){ return { ad: g.ad, deger: n(g.kg, 1) + ' kg' }; }) },
               { baslik: 'Takozlar', ogeler: o.takozAdlari.map(function(a){ return { ad: a }; }) }
             ] };
  };
  var gercek = ornekler.filter(function(o){ return !o.kurgu; });
  var kurgu = ornekler.filter(function(o){ return o.kurgu; });
  return {
    kimlik: veMntBaslangicKimlik(),
    veriler: veMntBaslangicVeri(),
    kapilar: veMntBaslangicKapilar(),
    basliklar: { ad: 'Araç', sayi: 'Gövde · takoz', kutle: 'Kütle', kaynak: 'Kaynak' },
    bolumler: [
      { baslik: 'Örnek modellerden başla', satirlar: gercek.map(satir) },
      { baslik: 'Doğrulama örnekleri — kurgu', satirlar: kurgu.map(satir) }
    ]
  };
}

function veMntBaslangicHTML(){
  var K = _mntBasKit();
  if(!K) return '';
  return K.sayfa(veMntBaslangicSayfa());
}

// ── EYLEMLER — hepsi modülün var olan çağrılarına gider ────────────────────
function veMntBaslangicEylem(ad, v){
  if(ad === 'sihirbaz')
    return !!(typeof veMntWizAc === 'function' && veMntWizAc());
  if(ad === 'step')
    return !!(typeof veMntCadAcStep === 'function' && veMntCadAcStep());
  if(ad === 'bos')
    return !!(typeof veMntKanvasBos === 'function' && veMntKanvasBos().length);
  if(ad === 'ornek'){
    if(!v || typeof veMntOrnekYukle !== 'function') return false;
    return !!veMntOrnekYukle(v);
  }
  if(ad === 'kilavuz'){
    if(!v || typeof veGuideOpen !== 'function') return false;
    veGuideOpen(v);
    return true;
  }
  return false;
}

// ── DOM — kurma ve görünürlük (kit) ────────────────────────────────────────
function _mntBasSecenek(){
  return { id: VE_MNT_BAS_ID, aria: 'Takoz başlangıç sayfası',
           sayfa: veMntBaslangicSayfa, eylem: veMntBaslangicEylem };
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
    veMntBaslangicHTML: veMntBaslangicHTML, veMntBaslangicSayfa: veMntBaslangicSayfa,
    veMntBaslangicEylem: veMntBaslangicEylem, veMntBaslangicKapsam: veMntBaslangicKapsam,
    veMntBaslangicTazele: veMntBaslangicTazele, veMntBaslangicAcik: veMntBaslangicAcik,
    veMntBaslangicKimlik: veMntBaslangicKimlik, veMntBaslangicVeri: veMntBaslangicVeri,
    veMntBaslangicKapilar: veMntBaslangicKapilar,
    VE_MNT_BAS_ID: VE_MNT_BAS_ID,
    VE_MNT_BAS_YETENEK: VE_MNT_BAS_YETENEK, VE_MNT_BAS_SD: VE_MNT_BAS_SD, VE_MNT_BAS_STEP: VE_MNT_BAS_STEP,
    _mntBasSifirla: function(){ _mntBasKapsam = false; }
  };
}
