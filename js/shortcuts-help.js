// ═══════════════════════════════════════════════════════════════════════════
// MFSim Klavye Kısayolları Yardımı — "?" ile açılan gruplu kısayol listesi
// ───────────────────────────────────────────────────────────────────────────
// GitHub/Linear/Gmail tarzı: editör aktifken "?" tuşu (ya da komut paleti /
// Dosya menüsü) programın GERÇEK klavye kısayollarını gösterir. Platform-duyarlı
// (Mac'te ⌘, diğerlerinde Ctrl). Kendi DOM'unu kurar; yalnız #sayfa2 aktif ve
// bir metin alanına yazmıyorken "?" yakalanır.
//
// Buradaki kısayollar uygulamadaki gerçek dinleyicilerle eşleşir:
//   ui-core.js  → Ctrl+C/V/A/D, Delete/Backspace, Esc
//   state.js    → Ctrl+Z, Ctrl+Y / Ctrl+Shift+Z
//   command-palette.js → Ctrl/⌘+K
// ═══════════════════════════════════════════════════════════════════════════

var _veHelpBuilt = false;
var _VE_IS_MAC = (typeof navigator !== 'undefined') &&
  /Mac|iPhone|iPad|iPod/.test((navigator.platform || '') + ' ' + (navigator.userAgent || ''));
var _VE_MOD = _VE_IS_MAC ? '⌘' : 'Ctrl';

function _veHelpGroups() {
  return [
    { title: 'Düzen', items: [
      { keys: [_VE_MOD, 'Z'], label: 'Geri al' },
      { keys: [_VE_MOD, 'Y'], label: 'İleri al' },
      { keys: [_VE_MOD, 'C'], label: 'Kopyala' },
      { keys: [_VE_MOD, 'V'], label: 'Yapıştır' },
      { keys: [_VE_MOD, 'D'], label: 'Çoğalt' },
      { keys: ['Delete'], label: 'Seçili bileşenleri sil' }
    ]},
    { title: 'Seçim', items: [
      { keys: [_VE_MOD, 'A'], label: 'Tümünü seç' },
      { keys: [_VE_MOD, 'tık'], label: 'Seçime ekle / çıkar' },
      { keys: ['Sol', 'sürükle'], label: 'Seçim kutusu' },
      { keys: ['Esc'], label: 'Seçimi temizle' }
    ]},
    { title: 'Görünüm', items: [
      { keys: ['Fare tekerleği'], label: 'Yakınlaştır / uzaklaştır' },
      { keys: ['Sağ tık', 'sürükle'], label: 'Görünümü kaydır (pan)' }
    ]},
    { title: 'Genel', items: [
      { keys: [_VE_MOD, 'K'], label: 'Komut paleti' },
      { keys: ['?'], label: 'Bu yardım penceresi' }
    ]}
  ];
}

function _veHelpEsc(s) {
  return ('' + (s == null ? '' : s)).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

function _veHelpBuild() {
  if(_veHelpBuilt) return;
  var ov = document.createElement('div');
  ov.className = 've-help-overlay';
  ov.id = 've-help';
  ov.setAttribute('hidden', '');

  var body = '';
  _veHelpGroups().forEach(function(g) {
    body += '<div class="ve-help-group"><div class="ve-help-group-title">' + _veHelpEsc(g.title) + '</div>';
    g.items.forEach(function(it) {
      var keys = it.keys.map(function(k) { return '<kbd>' + _veHelpEsc(k) + '</kbd>'; }).join('<span class="ve-help-plus">+</span>');
      body += '<div class="ve-help-row"><span class="ve-help-label">' + _veHelpEsc(it.label) + '</span><span class="ve-help-keys">' + keys + '</span></div>';
    });
    body += '</div>';
  });

  ov.innerHTML =
    '<div class="ve-help-panel" role="dialog" aria-modal="true" aria-label="Klavye kısayolları">' +
      '<div class="ve-help-head">' +
        '<h3>Klavye Kısayolları</h3>' +
        '<button class="ve-help-close" type="button" title="Kapat (Esc)" aria-label="Kapat" onclick="veShortcutsHelpClose()">' +
          '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>' +
        '</button>' +
      '</div>' +
      '<div class="ve-help-body">' + body + '</div>' +
      '<div class="ve-help-foot"><span><kbd>?</kbd> aç · <kbd>Esc</kbd> kapat</span><span class="ve-help-brand">MFSim</span></div>' +
    '</div>';
  document.body.appendChild(ov);
  ov.addEventListener('mousedown', function(e) { if(e.target === ov) veShortcutsHelpClose(); });
  _veHelpBuilt = true;
}

function veShortcutsHelpOpen() {
  _veHelpBuild();
  var ov = document.getElementById('ve-help');
  if(!ov) return;
  ov.removeAttribute('hidden');
  void ov.offsetWidth;
  ov.classList.add('open');
}

function veShortcutsHelpClose() {
  var ov = document.getElementById('ve-help');
  if(!ov || !ov.classList.contains('open')) return;
  ov.classList.remove('open');
  setTimeout(function() { if(ov && !ov.classList.contains('open')) ov.setAttribute('hidden', ''); }, 200);
}

function veShortcutsHelpToggle() {
  var ov = document.getElementById('ve-help');
  if(ov && ov.classList.contains('open')) veShortcutsHelpClose();
  else veShortcutsHelpOpen();
}

// "?" ile aç (editör aktif + metin alanında değilken); Esc ile kapat.
if(typeof document !== 'undefined' && typeof document.addEventListener === 'function') {
  document.addEventListener('keydown', function(e) {
    // Açıkken Esc → kapat (öncelikli)
    if(e.key === 'Escape') {
      var ovOpen = document.getElementById('ve-help');
      if(ovOpen && ovOpen.classList.contains('open')) { e.preventDefault(); veShortcutsHelpClose(); }
      return;
    }
    if(e.key !== '?' || e.ctrlKey || e.metaKey || e.altKey) return;
    var sayfa2 = document.getElementById('sayfa2');
    if(!sayfa2 || !sayfa2.classList.contains('active')) return;
    var t = e.target;
    if(t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return;
    e.preventDefault();
    veShortcutsHelpToggle();
  });
}

if(typeof module !== 'undefined' && module.exports) {
  module.exports = { veShortcutsHelpOpen: veShortcutsHelpOpen, veShortcutsHelpClose: veShortcutsHelpClose, veShortcutsHelpToggle: veShortcutsHelpToggle };
}
