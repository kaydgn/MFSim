// ============================================================================
//  TAKOZ — SONUÇLAR SEKMESİ (sunum)
// ============================================================================
// Sonuçlar sayfasındaki "Takoz Çökme-Titreşim" sekmesinin modüle ait satırları:
//   • Veri Gezgini'nin üst satırı   sonuç durumu (güncel / bayat / …) + künye
//   • Veri Gezgini'nin alt satırı   rapor bağlantısı
//
// HESAP YOK. Durum çözücünün imzasından (veMntResultState, js/cp-mount.js):
// Sonuçlar sayfası ve rapor aynı hükmü okur. Bu satırlar yokken sayfa,
// model hesaptan sonra değişse de eski sayıları uyarısız gösteriyordu —
// pencereler "bayat" derken.
//
// Görünüm FEAD sekmesinin satırlarıyla AYNI sınıflardan (.ve-fr-chip ·
// .ve-fr-tree-*): iki modülün Veri Gezgini satırı aynı görünür ve kopya sınıf
// ailesi kurulmaz (Takoz pencereleri de FEAD'in .ve-fp-* kabuğunu taşır).
// Kaynak tablosuna (js/results.js veResultSources) iki kancayla bağlı:
// treeTop · treeBottom. Ortak dosyada Takoz'a özgü dal YOK.
// ----------------------------------------------------------------------------

function _mntResR() { return (typeof window !== 'undefined') ? window.veMountResults : null; }
function _mntResEsc(s) {
  return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function _mntResIkon(ad) { return (typeof veIkon === 'function') ? veIkon(ad) : ''; }

// Durum çipi — FEAD'in sözlüğüyle aynı tonlar (ok · warn · no · off).
var VE_MNT_RES_DURUM = {
  guncel: { d: 'ok',   t: 'Güncel' },
  bayat:  { d: 'warn', t: 'Model değişti' },
  kayip:  { d: 'off',  t: 'Modeli projede yok' },
  hata:   { d: 'no',   t: 'Çözüm hatası' },
  yok:    { d: 'off',  t: 'Sonuç yok' }
};
function veMntResChipHTML(st) {
  var c = VE_MNT_RES_DURUM[st && st.k] || VE_MNT_RES_DURUM.yok;
  return '<span class="ve-fr-chip" data-d="' + c.d + '">' + _mntResEsc(c.t) + '</span>';
}

// "Lineer · 14 yük durumu · 6 mod" — sonucun künyesi.
function _mntResMeta(R) {
  if(!R || R.error) return '';
  var p = [];
  if(R.solveMode) p.push(R.solvedNL ? 'Nonlineer' : 'Lineer');
  p.push(((R.allCases || []).length) + ' yük durumu');
  p.push(((R.modes || []).length) + ' mod');
  return p.join(' · ');
}

// ── VERİ GEZGİNİ — üst satır: durum + künye ────────────────────────────────
function veMntResTreeTopHTML() {
  var R = _mntResR();
  if(!R || R.error) return '';
  var st = (typeof veMntResultState === 'function') ? veMntResultState(R) : { k: 'yok', R: R };
  var not = st.k === 'kayip' ? 'Sinyaller son çözümden.' : '';
  return '<div class="ve-fr-tree-top">'
    + '<div class="ve-fr-tree-row">' + veMntResChipHTML(st)
    + '<span class="ve-fr-tree-meta">' + _mntResEsc(_mntResMeta(R)) + '</span></div>'
    + (not ? '<div class="ve-fr-tree-uyari">' + _mntResEsc(not) + '</div>' : '')
    + '</div>';
}

// ── VERİ GEZGİNİ — alt satır: rapor ────────────────────────────────────────
function veMntResTreeReportHTML() {
  if(typeof veMntGenerateReport !== 'function') return '';
  return '<div class="ve-fr-tree-rep">'
    + '<button type="button" class="ve-fr-tree-link" onclick="veMntGenerateReport(null)"'
    + '>'
    + _mntResIkon('file-text') + 'Takoz Çökme-Titreşim raporu (HTML)</button>'
    + '</div>';
}

if(typeof module !== 'undefined' && module.exports) {
  module.exports = {
    VE_MNT_RES_DURUM: VE_MNT_RES_DURUM,
    veMntResChipHTML: veMntResChipHTML,
    veMntResTreeTopHTML: veMntResTreeTopHTML,
    veMntResTreeReportHTML: veMntResTreeReportHTML,
    _mntResMeta: _mntResMeta
  };
}
