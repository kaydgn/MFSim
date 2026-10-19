// ═══════════════════════════════════════════════════════════════════════════
// BOŞ TUVAL — topolojinin boş durumu (ARAYÜZ ANLATMAZ → yönlendirme yuvası,
// kullanıcı kararı 2026-10-19). Durum + tek yönlendirme cümlesi; kökte ayrıca
// kısayol satırı — kısayol penceresinin listesinden (`_veHelpGroups`), elle
// yazılmaz. Komut paleti satırda YOK: üst bant onu "Komut ara · Ctrl K" ile
// zaten gösteriyor (tekrar).
//
// Görünürlük kapsamdan ve modelden türer, bayrak tutulmaz:
//   top              hiç düğüm yok
//   arac-performans  yalnız "Başlangıç ve Örnekler" (ap-example)
//   mount-analysis   başlangıç sayfası kapalı; kütle gövdesi ve takoz yok
//                    (Boş kanvas yalnız analiz araçlarını kurar)
//   fead-analysis    yok — başlangıç sayfası ve çizim masası kendi yolunu taşır
// Tuvalde düğüm varsa yazı alta iner (kart ortada durur). pointer-events yok:
// tuvale bırakmayı engellemez. Kamera dönüşümünün dışında, kabın çocuğu.
// Tazeleme updateNodeCount'tan (topoloji değişimi) ve veSyncSidebarScope'tan
// (modül aç/kapa). Kapı: tests/unit/bos-tuval.test.js.
// ═══════════════════════════════════════════════════════════════════════════

var VE_BOS_TUVAL_ID = 've-bos-tuval';

var VE_BOS_TUVAL = {
  'top': { durum: 'Tuval boş', yon: veYon('Bileşenler’den bir modülü tuvale sürükleyin.'),
           kisayol: ['Klavye kısayolları'] },
  'arac-performans': { durum: 'Model boş', yon: veYon('Bileşenler’den bileşen sürükleyin.') },
  'mount-analysis': { durum: 'Model boş', yon: veYon('Bileşenler’den kütle gövdesi ve takoz sürükleyin.') }
};

function _veBosTip(n) {
  return (typeof componentDefs !== 'undefined' && n && componentDefs[n.type]) || {};
}

// SAF: kapsam + düğüm listesi (+ Takoz başlangıç sayfasının açıklığı) →
// gösterilecek kaydın anahtarı ya da null.
function veBosTuvalKapsami(scope, liste, mntBaslangicAcik) {
  liste = liste || [];
  if(scope === 'top') return liste.length === 0 ? 'top' : null;
  if(scope === 'arac-performans') {
    return liste.every(function(n) { return _veBosTip(n).isApExample; }) ? scope : null;
  }
  if(scope === 'mount-analysis') {
    if(mntBaslangicAcik) return null;
    var arac = (typeof VE_MNT_ARAC_TIPLERI !== 'undefined') ? VE_MNT_ARAC_TIPLERI : [];
    return liste.every(function(n) {
      return arac.indexOf(n.type) >= 0 || _veBosTip(n).isMountExample;
    }) ? scope : null;
  }
  return null;
}

function _veBosKisayolHTML(adlar) {
  if(!adlar || typeof _veHelpGroups !== 'function') return '';
  var esc = (typeof escapeHTML === 'function') ? escapeHTML : function(s) { return String(s); };
  var satir = [];
  _veHelpGroups().forEach(function(g) {
    g.items.forEach(function(it) {
      if(adlar.indexOf(it.label) < 0) return;
      satir.push('<span class="ve-bos-tuval-tus">'
        + it.keys.map(function(k) { return '<kbd>' + esc(k) + '</kbd>'; }).join('')
        + ' ' + esc(it.label) + '</span>');
    });
  });
  return satir.length ? '<div class="ve-bos-tuval-kisayol">' + satir.join('') + '</div>' : '';
}

function veBosTuvalHTML(anahtar) {
  var k = VE_BOS_TUVAL[anahtar];
  if(!k) return '';
  return '<div class="ve-bos-tuval-durum">' + k.durum + '</div>'
    + '<div class="ve-bos-tuval-yon">' + k.yon + '</div>'
    + _veBosKisayolHTML(k.kisayol);
}

// Döner: gösterilen kaydın anahtarı ya da null.
function veBosTuvalTazele() {
  if(typeof document === 'undefined') return null;
  var kap = document.getElementById('ve-canvas-wrapper');
  if(!kap) return null;
  var scope = (typeof veSidebarScope !== 'undefined') ? veSidebarScope : 'top';
  var liste = (typeof nodes !== 'undefined' && nodes) ? nodes : [];
  var acik = (typeof veMntBaslangicAcik === 'function') && veMntBaslangicAcik();
  var anahtar = veBosTuvalKapsami(scope, liste, acik);
  var el = document.getElementById(VE_BOS_TUVAL_ID);
  if(!anahtar) { if(el) el.hidden = true; return null; }
  if(!el) {
    el = document.createElement('div');
    el.id = VE_BOS_TUVAL_ID;
    el.className = 've-bos-tuval';
    kap.appendChild(el);
  }
  if(el.getAttribute('data-k') !== anahtar) {
    el.innerHTML = veBosTuvalHTML(anahtar);
    el.setAttribute('data-k', anahtar);
  }
  el.classList.toggle('ve-bos-tuval--alt', liste.length > 0);
  el.hidden = false;
  return anahtar;
}

if(typeof module !== 'undefined' && module.exports) {
  module.exports = { VE_BOS_TUVAL: VE_BOS_TUVAL, veBosTuvalKapsami: veBosTuvalKapsami,
    veBosTuvalHTML: veBosTuvalHTML, veBosTuvalTazele: veBosTuvalTazele };
}
