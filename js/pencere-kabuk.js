// ════════════════════════════════════════════════════════════════════════════
//  BİLEŞEN PENCERESİNİN KABUĞU — ORTAK KİT (FEAD · Takoz)
// ════════════════════════════════════════════════════════════════════════════
//
// Kullanıcı isteği (2026-10-16): *"Tüm programda tek tip bir kozmetik yapımız
// olacak. Takoz Çökme ve Titreşim modeli için kozmetik yapıyı FEAD modülü ile
// aynı yapmanı istiyorum."* Kabuk iki ayrı üreticideydi (FEAD
// `veFeadPanelShell` · Takoz `_mntPencereKabuk`) ve aynı sözleşmeyi iki kez
// yazıyordu; ikinci yazım iki istisna biriktirmişti — sekmelerin ÜSTÜNE kroki
// ve kütüphane seçicisi koyan `ust` yuvası, tek bölmeli pencerede sekme
// şeridini hiç çizmeyen dal. Ölçüldü (Tulga + AG00976, gerçek tarayıcı):
// Takoz'un on üç penceresinden altısında sekmelerin üstünde içerik, dördünde
// şerit yoktu; FEAD'in on birinde ikisi de sıfır. "Aynı" sözcüğünün karşılığı
// TEK üretici (başlangıç sayfası kitinin, js/baslangic-sayfa.js, gerekçesi).
//
// İSKELET (FEAD kural 31) — her pencere:
//   kimlik satırı (cp-core.js) → KATEGORİ SEKMELERİ → eksik bandı → gövdeler
//   sağ sütun: sekmeden bağımsız bağlam · uygunluk · pencerenin TEK eylemi
// Sekmelerin üstünde hiçbir şey durmaz; sekmeden bağımsız kalması gereken
// bağlam sağ sütundadır. Dar kapta (≤ 640 px, `@container vepanel`) sağ sütun
// gövdenin altına iner ve eylem kaydırma alanının dibine yapışır (css).
//
// KİT YALNIZ KABUĞU KURAR. Sekmelerin içeriğini, durumlarını, eksik bandının
// bağlantısının nereye gittiğini ve sağ sütunu modül verir. DOM sözleşmesi
// süs değil: müfettiş, kontrast, sayı ve yerleşim taramaları sekmeleri bu
// kimliklerle geziyor (`ve-fp-tabs-<id>` · `ve-fp-panes-<id>` ·
// `.ve-fp-tab[data-k]`), gizli sekme ölçüye girmez.
//
// Kapı: tests/unit/pencere-kabuk.test.js (iki modülün bütün pencereleri AYNI
// aile denetiminden geçer) + tests/unit/fead-pencere-ailesi.test.js.

// Açık sekme MODELDE DEĞİL (FEAD kural 15'in gerekçesi): kaydedilmez, geri-al
// yığınına yazılmaz — ama pencere her seçimde yeniden kurulduğu için bir yerde
// durmak ZORUNDA, yoksa her açılış ilk sekmeye dönerdi.
var VE_PENCERE_SEKME = {};

function vePencereEsc(s){
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function _vePencereIkon(ad){ return (typeof veIkon === 'function') ? veIkon(ad) : ''; }

// Geçerli sekme: hafızadaki anahtar bu pencerede varsa o, yoksa ilki.
function vePencereSekmeOf(nodeId, keys){
  var k = VE_PENCERE_SEKME[nodeId];
  return (k && keys.indexOf(k) >= 0) ? k : keys[0];
}

// SEKME DEĞİŞİNCE PENCERE KURULMAZ, yalnız `hidden` çevrilir: düzenlenen
// alanın odağı ve sağ sütun (uygunluk, eylem) yerinde kalır — sağ sütunun
// bütün iddiası sekmeden BAĞIMSIZ durması. Açılan sekmedeki tablo birimi AYNI
// karede karar alır (js/tablo-pencere.js): gözlemciye kalsaydı geniş tablo bir
// kare yatay kaydırmayla görünürdü.
function vePencereSekme(nodeId, key){
  if(typeof document === 'undefined') return false;
  var kap = document.getElementById('ve-fp-tabs-' + nodeId);
  var gov = document.getElementById('ve-fp-panes-' + nodeId);
  if(!kap || !gov) return false;
  VE_PENCERE_SEKME[nodeId] = key;
  Array.prototype.forEach.call(kap.querySelectorAll('.ve-fp-tab'), function(b){
    b.setAttribute('aria-selected', String(b.getAttribute('data-k') === key));
  });
  Array.prototype.forEach.call(gov.children, function(p){
    p.hidden = (p.getAttribute('data-k') !== key);
  });
  if(typeof veTabloOlcIcinde === 'function') veTabloOlcIcinde(gov);
  return true;
}

// Sekmenin durum satırı — D: { d: ok|eksik|bos|yok, yazi }. Nokta süs değil:
// renk körlüğünde ve gri basımda dört durumu BİÇİM ayırır (css).
function vePencereSekmeDurumHTML(D){
  return '<span class="ve-fp-tab-d" data-d="' + D.d + '"><i aria-hidden="true"></i>'
    + vePencereEsc(D.yazi) + '</span>';
}

// EKSİK BANDI — şeridin altında, yalnız eksik varken: her eksiğin SONUCU
// (`durum.neden`) ve oraya giden bağlantı. `durum.bant === false` bir BULGU
// (ör. üç durumda çekme): sekmede görünür, "Doldur" bandına girmez. Sonuç
// sekmesinin (`sonuc: true`) bağlantısı "Aç"tır — doldurulacak alanı yok.
// `git`: bağlantının işleyicisinin ADI — (düğüm, sekme[, hedef kimlik]).
function vePencereEksikBandi(nodeId, sekmeler, git){
  var eks = (sekmeler || []).filter(function(s){
    return s.durum && s.durum.d === 'eksik' && s.durum.bant !== false;
  });
  if(!eks.length) return '';
  return '<div class="ve-fp-eksik" role="status" id="ve-fp-eksik-' + nodeId + '">'
    + eks.map(function(s){
        return '<div class="ve-fp-eksik-s">' + _vePencereIkon('alert-triangle')
          + '<span class="ve-fp-eksik-t"><b>' + vePencereEsc(s.ad) + '</b> — '
          + vePencereEsc(s.durum.neden || '') + '</span>'
          + '<button type="button" onclick="' + git + '(\'' + nodeId + '\',\'' + s.k + '\''
          + (s.durum.hedef ? ',\'' + vePencereEsc(s.durum.hedef) + '\'' : '') + ')">'
          + (s.sonuc ? 'Aç' : 'Doldur') + ' ' + _vePencereIkon('arrow-right') + '</button></div>';
      }).join('')
    + '</div>';
}

// Şerit + eksik bandı + gövdeler. Her sekme ADININ altında DURUMUNU taşır
// (`s.durum`); durumu olmayan pencerede (araç pencereleri) yalnız ad basılır.
// o: { sekmeFn, git } — sekme ve bant işleyicilerinin adları.
function vePencereSekmeleriHTML(nodeId, sekmeler, aktif, o){
  o = o || {};
  var fn = o.sekmeFn || 'vePencereSekme';
  var h = '<div class="ve-fp-tabs" role="tablist" id="ve-fp-tabs-' + nodeId + '">';
  sekmeler.forEach(function(s){
    var D = s.durum || null;
    h += '<button type="button" class="ve-fp-tab" role="tab" data-k="' + s.k + '"'
      + (D ? ' data-d="' + D.d + '"' : '')
      + ' aria-selected="' + (s.k === aktif ? 'true' : 'false') + '"'
      + ' onclick="' + fn + '(\'' + nodeId + '\',\'' + s.k + '\')">'
      + '<span class="ve-fp-tab-ad">' + vePencereEsc(s.ad) + '</span>'
      + (D ? vePencereSekmeDurumHTML(D) : '')
      + '</button>';
  });
  h += '</div>' + vePencereEksikBandi(nodeId, sekmeler, o.git || 'vePencereSekme')
     + '<div id="ve-fp-panes-' + nodeId + '">';
  sekmeler.forEach(function(s){
    h += '<div data-k="' + s.k + '" role="tabpanel"' + (s.k === aktif ? '' : ' hidden') + '>' + s.govde + '</div>';
  });
  return h + '</div>';
}

// PENCERE — sekmeler: [{ k, ad, govde, durum, sonuc }], yan: sağ sütunun
// HTML'i. o: { sinif, nitelik, sekmeFn, git } — modülün kök sınıfı ve
// niteliği (Takoz'un yerinde tazelemesi kökü `data-mnt-pencere`den bulur).
// Kabuk TEK SEKMEYİ de şeritle çizer: şerit sekmenin durumunu taşıyor ve
// iskelet her pencerede aynı kalıyor (aile kuralı ≥ 2 kategori ister; tek
// sekmeli bir pencere kurmak modülün kendi kusurudur, kapı onu adıyla söyler).
function vePencereKabuk(node, sekmeler, yan, o){
  o = o || {};
  var id = node && node.id;
  var aktif = vePencereSekmeOf(id, sekmeler.map(function(s){ return s.k; }));
  return '<div class="sw-panel ve-fp' + (o.sinif ? ' ' + o.sinif : '') + '"' + (o.nitelik || '') + '>'
    + '<div class="ve-fp-split"><div class="ve-fp-main">'
    + vePencereSekmeleriHTML(id, sekmeler, aktif, o)
    + '</div><div class="ve-fp-side">' + (yan || '') + '</div></div></div>';
}

if(typeof module !== 'undefined' && module.exports){
  module.exports = {
    VE_PENCERE_SEKME: VE_PENCERE_SEKME, vePencereEsc: vePencereEsc,
    vePencereSekmeOf: vePencereSekmeOf, vePencereSekme: vePencereSekme,
    vePencereSekmeDurumHTML: vePencereSekmeDurumHTML, vePencereEksikBandi: vePencereEksikBandi,
    vePencereSekmeleriHTML: vePencereSekmeleriHTML, vePencereKabuk: vePencereKabuk
  };
}
