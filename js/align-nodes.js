// ═══════════════════════════════════════════════════════════════════════════
// MFSim Hizalama & Dağıtma — çoklu seçimde bileşenleri hizala / eşit dağıt
// ───────────────────────────────────────────────────────────────────────────
// Figma/draw.io tarzı hizalama araçları. Çoklu-seçim özellik panelinde görünür
// (showMultipleSelection). Salt konum değiştirir; boyut/veri/DOM yapısına
// dokunmaz ve GERİ ALINABİLİR (önce saveState). Sürükleme sistemiyle aynı
// sözleşme: node.x/y + el.style.left/top + updateAllConnections.
// ═══════════════════════════════════════════════════════════════════════════

// Seçili düğümlerin sınır kutusu + w/h yardımcıları.
function _veSelBBox(sel) {
  var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  sel.forEach(function(n) {
    var w = n.width || 65, h = n.height || 60;
    if(n.x < minX) minX = n.x;
    if(n.y < minY) minY = n.y;
    if(n.x + w > maxX) maxX = n.x + w;
    if(n.y + h > maxY) maxY = n.y + h;
  });
  return { minX: minX, minY: minY, maxX: maxX, maxY: maxY };
}

function _veApplyPositions() {
  selectedNodes.forEach(function(n) {
    n.x = Math.round(n.x); n.y = Math.round(n.y);
    var el = document.getElementById(n.id);
    if(el) { el.style.left = n.x + 'px'; el.style.top = n.y + 'px'; }
  });
  if(typeof updateAllConnections === 'function') updateAllConnections();
  if(typeof updateNodeCount === 'function') updateNodeCount();
}

// mode: 'left' | 'hcenter' | 'right' | 'top' | 'vcenter' | 'bottom'
function veAlignNodes(mode) {
  if(typeof selectedNodes === 'undefined' || !selectedNodes || selectedNodes.length < 2) {
    if(typeof showToast === 'function') showToast('Hizalamak için en az 2 bileşen seçin', 'warning');
    return;
  }
  if(typeof saveState === 'function') saveState();
  var bb = _veSelBBox(selectedNodes);
  selectedNodes.forEach(function(n) {
    var w = n.width || 65, h = n.height || 60;
    switch(mode) {
      case 'left':    n.x = bb.minX; break;
      case 'right':   n.x = bb.maxX - w; break;
      case 'hcenter': n.x = (bb.minX + bb.maxX) / 2 - w / 2; break;
      case 'top':     n.y = bb.minY; break;
      case 'bottom':  n.y = bb.maxY - h; break;
      case 'vcenter': n.y = (bb.minY + bb.maxY) / 2 - h / 2; break;
    }
  });
  _veApplyPositions();
  if(typeof showToast === 'function') showToast('Hizalandı', 'success');
}

// axis: 'h' | 'v' — merkezleri ilk ve son eleman arasında eşit aralıklı dağıtır.
function veDistributeNodes(axis) {
  if(typeof selectedNodes === 'undefined' || !selectedNodes || selectedNodes.length < 3) {
    if(typeof showToast === 'function') showToast('Dağıtmak için en az 3 bileşen seçin', 'warning');
    return;
  }
  if(typeof saveState === 'function') saveState();
  var horiz = (axis === 'h');
  var arr = selectedNodes.slice().sort(function(a, b) {
    var ca = horiz ? (a.x + (a.width || 65) / 2) : (a.y + (a.height || 60) / 2);
    var cb = horiz ? (b.x + (b.width || 65) / 2) : (b.y + (b.height || 60) / 2);
    return ca - cb;
  });
  function center(n) { return horiz ? (n.x + (n.width || 65) / 2) : (n.y + (n.height || 60) / 2); }
  var first = center(arr[0]), last = center(arr[arr.length - 1]);
  var step = (last - first) / (arr.length - 1);
  arr.forEach(function(n, i) {
    var target = first + step * i;
    if(horiz) n.x = target - (n.width || 65) / 2;
    else      n.y = target - (n.height || 60) / 2;
  });
  _veApplyPositions();
  if(typeof showToast === 'function') showToast('Eşit dağıtıldı', 'success');
}

// Çoklu-seçim panelindeki hizalama araç HTML'i (showMultipleSelection çağırır).
function veAlignPanelHTML() {
  var G = 'stroke="currentColor" stroke-width="2" stroke-linecap="round" fill="none"';
  var Rf = 'fill="currentColor"';
  var ic = {
    left:   '<svg viewBox="0 0 24 24" width="16" height="16"><line x1="4" y1="3" x2="4" y2="21" ' + G + '/><rect x="4" y="6" width="11" height="4" rx="1" ' + Rf + '/><rect x="4" y="14" width="16" height="4" rx="1" ' + Rf + '/></svg>',
    hcenter:'<svg viewBox="0 0 24 24" width="16" height="16"><line x1="12" y1="3" x2="12" y2="21" ' + G + '/><rect x="6.5" y="6" width="11" height="4" rx="1" ' + Rf + '/><rect x="4" y="14" width="16" height="4" rx="1" ' + Rf + '/></svg>',
    right:  '<svg viewBox="0 0 24 24" width="16" height="16"><line x1="20" y1="3" x2="20" y2="21" ' + G + '/><rect x="9" y="6" width="11" height="4" rx="1" ' + Rf + '/><rect x="4" y="14" width="16" height="4" rx="1" ' + Rf + '/></svg>',
    top:    '<svg viewBox="0 0 24 24" width="16" height="16"><line x1="3" y1="4" x2="21" y2="4" ' + G + '/><rect x="6" y="4" width="4" height="11" rx="1" ' + Rf + '/><rect x="14" y="4" width="4" height="16" rx="1" ' + Rf + '/></svg>',
    vcenter:'<svg viewBox="0 0 24 24" width="16" height="16"><line x1="3" y1="12" x2="21" y2="12" ' + G + '/><rect x="6" y="6.5" width="4" height="11" rx="1" ' + Rf + '/><rect x="14" y="4" width="4" height="16" rx="1" ' + Rf + '/></svg>',
    bottom: '<svg viewBox="0 0 24 24" width="16" height="16"><line x1="3" y1="20" x2="21" y2="20" ' + G + '/><rect x="6" y="9" width="4" height="11" rx="1" ' + Rf + '/><rect x="14" y="4" width="4" height="16" rx="1" ' + Rf + '/></svg>',
    disth:  '<svg viewBox="0 0 24 24" width="16" height="16"><rect x="3" y="6" width="3.5" height="12" rx="1" ' + Rf + '/><rect x="10.25" y="6" width="3.5" height="12" rx="1" ' + Rf + '/><rect x="17.5" y="6" width="3.5" height="12" rx="1" ' + Rf + '/></svg>',
    distv:  '<svg viewBox="0 0 24 24" width="16" height="16"><rect x="6" y="3" width="12" height="3.5" rx="1" ' + Rf + '/><rect x="6" y="10.25" width="12" height="3.5" rx="1" ' + Rf + '/><rect x="6" y="17.5" width="12" height="3.5" rx="1" ' + Rf + '/></svg>'
  };
  var canDist = (typeof selectedNodes !== 'undefined' && selectedNodes && selectedNodes.length >= 3);
  var h = '<div class="ve-align-tools">';
  h += '<div class="ve-align-sec">Hizala</div><div class="ve-align-grid">';
  h += '<button class="ve-align-btn" title="Sola hizala" onclick="veAlignNodes(\'left\')">' + ic.left + '</button>';
  h += '<button class="ve-align-btn" title="Yatay ortala" onclick="veAlignNodes(\'hcenter\')">' + ic.hcenter + '</button>';
  h += '<button class="ve-align-btn" title="Sağa hizala" onclick="veAlignNodes(\'right\')">' + ic.right + '</button>';
  h += '<button class="ve-align-btn" title="Üste hizala" onclick="veAlignNodes(\'top\')">' + ic.top + '</button>';
  h += '<button class="ve-align-btn" title="Dikey ortala" onclick="veAlignNodes(\'vcenter\')">' + ic.vcenter + '</button>';
  h += '<button class="ve-align-btn" title="Alta hizala" onclick="veAlignNodes(\'bottom\')">' + ic.bottom + '</button>';
  h += '</div>';
  h += '<div class="ve-align-sec">Dağıt' + (canDist ? '' : ' <span class="ve-align-hint">(3+ bileşen)</span>') + '</div><div class="ve-align-grid two">';
  h += '<button class="ve-align-btn" title="Yatay eşit dağıt" onclick="veDistributeNodes(\'h\')"' + (canDist ? '' : ' disabled') + '>' + ic.disth + '</button>';
  h += '<button class="ve-align-btn" title="Dikey eşit dağıt" onclick="veDistributeNodes(\'v\')"' + (canDist ? '' : ' disabled') + '>' + ic.distv + '</button>';
  h += '</div></div>';
  return h;
}

if(typeof module !== 'undefined' && module.exports) {
  module.exports = { veAlignNodes: veAlignNodes, veDistributeNodes: veDistributeNodes, veAlignPanelHTML: veAlignPanelHTML };
}
