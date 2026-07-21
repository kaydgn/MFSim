// ═══════════════════════════════════════════════════════════════════════════
// MFSim Boş Tuval İpucu — tuval boşken merkezde müdahaleci-olmayan yönlendirme
// ───────────────────────────────────────────────────────────────────────────
// nodes.length === 0 ve modül seçim overlay'i kapalıyken (yeni proje/sekme)
// tuvalin ortasında yumuşak bir ipucu gösterir: bileşen sürükle · Ctrl+K ·  ?.
// pointer-events:none → tuvale bırakmayı engellemez. Kamera dönüşümünden
// bağımsız (wrapper çocuğu, #ve-canvas dışında) → ekran-merkezli kalır.
//
// Görünürlük updateNodeCount (topoloji değişimi) çoklu-noktasından tazelenir.
// ═══════════════════════════════════════════════════════════════════════════

var _veEmptyMod = ((typeof navigator !== 'undefined') &&
  /Mac|iPhone|iPad|iPod/.test((navigator.platform || '') + ' ' + (navigator.userAgent || ''))) ? '⌘' : 'Ctrl';

function veEmptyHintInit() {
  var wrap = document.getElementById('ve-canvas-wrapper');
  if(!wrap || document.getElementById('ve-empty-hint')) { veEmptyHintUpdate(); return; }
  var el = document.createElement('div');
  el.className = 've-empty-hint';
  el.id = 've-empty-hint';
  el.setAttribute('aria-hidden', 'true');
  el.innerHTML =
    '<div class="ve-empty-hint-inner">' +
      '<div class="ve-empty-hint-icon">' +
        '<svg viewBox="0 0 48 48" width="46" height="46" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
          '<rect x="5" y="9" width="38" height="30" rx="3" stroke-dasharray="4 4" opacity="0.7"/>' +
          '<rect x="14" y="19" width="9" height="9" rx="1.5"/><rect x="27" y="19" width="7" height="7" rx="1.5" opacity="0.6"/>' +
          '<path d="M23.5 23.5h3.5" opacity="0.6"/>' +
        '</svg>' +
      '</div>' +
      '<div class="ve-empty-hint-title">Tuval boş</div>' +
      '<div class="ve-empty-hint-sub">Başlamak için bir bileşen ekleyin</div>' +
      '<div class="ve-empty-hint-rows">' +
        '<div class="ve-empty-hint-row"><span class="ve-empty-hint-ic"><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 3v16l4-4h5l6-6-8-8z" opacity="0"/><path d="M13 2 3 6l7 2 2 7 4-10z"/><path d="M12 12l6 6"/></svg></span>Soldan bileşen <b>sürükleyin</b></div>' +
        '<div class="ve-empty-hint-row"><span class="ve-empty-hint-keys"><kbd>' + _veEmptyMod + '</kbd><kbd>K</kbd></span>komut paleti ile ekleyin</div>' +
        '<div class="ve-empty-hint-row"><span class="ve-empty-hint-keys"><kbd>?</kbd></span>klavye kısayolları</div>' +
      '</div>' +
    '</div>';
  wrap.appendChild(el);
  veEmptyHintUpdate();
}

function veEmptyHintUpdate() {
  var el = document.getElementById('ve-empty-hint');
  if(!el) return;
  var empty = (typeof nodes !== 'undefined' && nodes) ? nodes.length === 0 : false;
  var overlay = document.getElementById('ve-module-overlay');
  var overlayVisible = overlay && overlay.style.display !== 'none' && overlay.offsetParent !== null;
  var show = empty && !overlayVisible;
  el.classList.toggle('visible', show);
}

if(typeof document !== 'undefined' && typeof document.addEventListener === 'function') {
  document.addEventListener('DOMContentLoaded', veEmptyHintInit);
}

if(typeof module !== 'undefined' && module.exports) {
  module.exports = { veEmptyHintInit: veEmptyHintInit, veEmptyHintUpdate: veEmptyHintUpdate };
}
