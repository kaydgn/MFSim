// ════════════════════════════════════════════════════════════════════════════
//  BİLEŞEN PENCERESİNİN KABUĞU — ORTAK KİT (FEAD · Takoz)
// ════════════════════════════════════════════════════════════════════════════
//
// TEK ÜRETİCİ (2026-10-16, kullanıcı: *"Tüm programda tek tip bir kozmetik
// yapımız olacak"*): FEAD ve Takoz pencereleri aynı kabuktan basar; ikinci bir
// yazım ilk rötuşta ayrışıyordu (başlangıç sayfası kitinin, js/baslangic-
// sayfa.js, gerekçesi).
//
// TEK GÖVDE, SEKME YOK (2026-10-16, kullanıcı: *"bir bileşen özelinde tek bir
// pencerede tamamı sığacak içerikleri genel olarak iki pencereye ayırmışız …
// Tek bir pencerede hepsi sığar … Tüm bileşenler için bunu uygulayalım.
// Kullanışlı ve kompakt bir tasarım olsun."*). Kategoriler artık SEKME değil:
// gövdede sırayla durur, hiçbiri gizli değil. Bölümü adlandıran şey kartın
// kendi başlığıdır (`.ve-fp-sect`); kategorinin adı ve durumu VERİ olarak
// kalır — eksik bandı onları okur, kategori kabı durumunu `data-d`de taşır.
//
// İSKELET — her pencere:
//   kimlik satırı (cp-core.js) → eksik bandı → kategoriler (alt alta)
//   sağ sütun: bağlam · uygunluk · pencerenin TEK eylemi
// Dar kapta (≤ 640 px, `@container vepanel`) sağ sütun gövdenin altına iner
// ve eylem kaydırma alanının dibine yapışır (css).
//
// KİT YALNIZ KABUĞU KURAR. Kategorilerin içeriğini, durumlarını, eksik
// bandının bağlantısının nereye gittiğini ve sağ sütunu modül verir. DOM
// sözleşmesi süs değil: modüllerin yerinde tazelemesi ve müfettiş, kontrast,
// sayı, yerleşim taramaları gövdeyi bu kimliklerle buluyor
// (`ve-fp-panes-<id>` · `.ve-fp-kat[data-k]` · `ve-fp-eksik-<id>`).
//
// Kapı: tests/unit/pencere-kabuk.test.js (iki modülün bütün pencereleri AYNI
// aile denetiminden geçer) + tests/unit/fead-pencere-ailesi.test.js.

function vePencereEsc(s){
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function _vePencereIkon(ad){ return (typeof veIkon === 'function') ? veIkon(ad) : ''; }

// KATEGORİYE GİT — gövdedeki kategoriyi görüş alanına alır; pencere
// KURULMAZ (düzenlenen alanın odağı ve sağ sütun yerinde kalır). Eksik
// bandının bağlantısı ve kılavuzun "şuraya bak"ı buradan geçer.
function vePencereKategori(nodeId, key){
  if(typeof document === 'undefined') return null;
  var gov = document.getElementById('ve-fp-panes-' + nodeId);
  if(!gov) return null;
  return gov.querySelector('.ve-fp-kat[data-k="' + key + '"]');
}
function vePencereKategoriGit(nodeId, key){
  var kat = vePencereKategori(nodeId, key);
  if(!kat) return false;
  if(kat.scrollIntoView) kat.scrollIntoView({ block: 'start' });
  return true;
}

// EKSİK BANDI — gövdenin üstünde, yalnız eksik varken: her eksiğin SONUCU
// (`durum.neden`) ve oraya giden bağlantı. `durum.bant === false` bir BULGU
// (ör. üç durumda çekme): bant onu almaz. Sonuç kategorisinin (`sonuc: true`)
// bağlantısı "Göster"dir — doldurulacak alanı yok.
// `git`: bağlantının işleyicisinin ADI — (düğüm, kategori[, hedef kimlik]).
function vePencereEksikBandi(nodeId, kategoriler, git){
  var eks = (kategoriler || []).filter(function(s){
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
          + (s.sonuc ? 'Göster' : 'Doldur') + ' ' + _vePencereIkon('arrow-right') + '</button></div>';
      }).join('')
    + '</div>';
}

// Bandın bağlantısının ortak gövdesi: kategoriye gider ve eksiğin alanına —
// durum bir HEDEF taşımıyorsa kategorinin İLK BOŞ girdisine — odaklanır. Boş
// girdi yoksa (sonuç, tablo) odak kategorinin kabına gider: klavyeyle gelen
// kullanıcı nerede olduğunu kaybetmesin. `girdi`: boş girdiyi seçen CSS.
function vePencereEksikGit(nodeId, key, hedefId, girdi){
  var kat = vePencereKategori(nodeId, key);
  if(!kat) return false;
  var hedef = hedefId ? kat.querySelector('[id="' + hedefId + '"]') : null;
  if(!hedef){
    hedef = Array.prototype.filter.call(kat.querySelectorAll(girdi || 'input:not([readonly]):not([disabled])'),
      function(i){ return String(i.value).trim() === ''; })[0] || null;
  }
  if(!hedef) hedef = kat;
  if(hedef.scrollIntoView) hedef.scrollIntoView({ block: hedef === kat ? 'start' : 'center' });
  if(hedef.focus) hedef.focus({ preventScroll: true });
  return true;
}

// Eksik bandı + gövde. Kategori kabı DURUMUNU taşır (`data-d`: ok · eksik ·
// bos · yok) — eksik kategori kenarında işaretlenir (css); kap odak alabilir
// (`tabindex=-1`), bandın bağlantısı boş girdi bulamazsa oraya gelir.
function vePencereGovdeHTML(nodeId, kategoriler, git){
  var h = vePencereEksikBandi(nodeId, kategoriler, git || 'vePencereKategoriGit')
    + '<div class="ve-fp-govde" id="ve-fp-panes-' + nodeId + '">';
  kategoriler.forEach(function(s){
    var D = s.durum || null;
    h += '<div class="ve-fp-kat" data-k="' + s.k + '"' + (D ? ' data-d="' + D.d + '"' : '')
      + ' tabindex="-1" aria-label="' + vePencereEsc(s.ad) + '">' + s.govde + '</div>';
  });
  return h + '</div>';
}

// PENCERE — kategoriler: [{ k, ad, govde, durum, sonuc }], yan: sağ sütunun
// HTML'i. o: { sinif, nitelik, git } — modülün kök sınıfı ve niteliği
// (Takoz'un yerinde tazelemesi kökü `data-mnt-pencere`den bulur) ve bandın
// bağlantısının işleyicisi.
// BOŞ SAĞ SÜTUN ÇİZİLMEZ: bağlamı ya da eylemi olmayan pencerede iki sütunlu
// modal boş bir sütun bırakıyordu — kabuk tek sütuna iner (`.ve-fp-split--tek`).
function vePencereKabuk(node, kategoriler, yan, o){
  o = o || {};
  var id = node && node.id;
  var tek = !String(yan == null ? '' : yan).trim();
  return '<div class="sw-panel ve-fp' + (o.sinif ? ' ' + o.sinif : '') + '"' + (o.nitelik || '') + '>'
    + '<div class="ve-fp-split' + (tek ? ' ve-fp-split--tek' : '') + '"><div class="ve-fp-main">'
    + vePencereGovdeHTML(id, kategoriler, o.git)
    + '</div>' + (tek ? '' : '<div class="ve-fp-side">' + yan + '</div>') + '</div></div>';
}

// DURUM YERİNDE TAZELENİR, PENCERE KURULMAZ: sayı alanları pencereyi yeniden
// kurmuyor (kursaydı Sekme ile geçilen alanın odağı düşerdi), ama kategori
// durumu ve bant o zaman bir düzenleme geride kalırdı. Modül yeni durumları
// verir ([{ k, ad, durum }]; `durum` undefined ise kabın durumu yerinde
// kalır), kit kabın `data-d`sini ve bandı yazar; girdi elemanlarına DOKUNMAZ.
// Döner: değişen öğe sayısı.
function vePencereDurumTazele(nodeId, kategoriler, git){
  if(typeof document === 'undefined') return 0;
  var gov = document.getElementById('ve-fp-panes-' + nodeId);
  if(!gov) return 0;
  var n = 0;
  (kategoriler || []).forEach(function(s){
    var kat = gov.querySelector('.ve-fp-kat[data-k="' + s.k + '"]');
    if(!kat || s.durum === undefined) return;          // söylenmeyen durum yerinde kalır
    var d = s.durum ? s.durum.d : null;
    if((kat.getAttribute('data-d') || null) === d) return;
    if(d) kat.setAttribute('data-d', d); else kat.removeAttribute('data-d');
    n++;
  });
  var bant = document.getElementById('ve-fp-eksik-' + nodeId);
  var html = vePencereEksikBandi(nodeId, kategoriler, git || 'vePencereKategoriGit');
  if(bant){
    if(!html){ bant.remove(); n++; }
    else if(bant.outerHTML !== html){ bant.outerHTML = html; n++; }
  } else if(html){ gov.insertAdjacentHTML('beforebegin', html); n++; }
  return n;
}

if(typeof module !== 'undefined' && module.exports){
  module.exports = {
    vePencereEsc: vePencereEsc, vePencereKategori: vePencereKategori,
    vePencereKategoriGit: vePencereKategoriGit, vePencereEksikBandi: vePencereEksikBandi,
    vePencereEksikGit: vePencereEksikGit, vePencereGovdeHTML: vePencereGovdeHTML,
    vePencereKabuk: vePencereKabuk, vePencereDurumTazele: vePencereDurumTazele
  };
}
