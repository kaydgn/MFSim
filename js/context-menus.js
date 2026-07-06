// ============================================================================
// NODE CONTEXT MENU — PORT DÜZEN İŞLEMLERİ
// ============================================================================
var nodeContextMenu = null;
var nodeContextTarget = null;

function createNodeContextMenu() {
  var menu = document.createElement('div');
  menu.id = 've-node-context-menu';
  menu.className = 've-context-menu';
  menu.style.cssText = 'display:none; position:fixed; background:var(--bg-secondary); border:1px solid var(--border-color); border-radius:0; box-shadow:0 4px 12px rgba(0,0,0,0.3); z-index:10001; min-width:200px; padding:4px 0;';
  
  menu.innerHTML = '<div class="ve-context-item" data-action="toggle-axis"><span><span class="mf-ico mf-ico-refresh"></span></span> Yatay ↔ Dikey</div>' +
    '<div class="ve-context-divider"></div>' +
    '<div class="ve-context-item" data-action="mirror-h"><span>↔</span> Yatay Aynala (Sol ↔ Sağ)</div>' +
    '<div class="ve-context-item" data-action="mirror-v"><span>↕</span> Dikey Aynala (Üst ↔ Alt)</div>' +
    '<div class="ve-context-divider"></div>' +
    '<div class="ve-context-item" data-action="reset-ports"><span>⟲</span> Varsayılana Dön</div>';
  
  document.body.appendChild(menu);
  nodeContextMenu = menu;
  
  menu.querySelectorAll('.ve-context-item').forEach(function(item) {
    item.addEventListener('click', function() {
      var action = this.getAttribute('data-action');
      handleNodeContextAction(action);
      hideNodeContextMenu();
    });
  });
  
  document.addEventListener('click', function(e) {
    if(nodeContextMenu && !nodeContextMenu.contains(e.target)) {
      hideNodeContextMenu();
    }
  });
}

function showNodeContextMenu(e, node) {
  e.preventDefault();
  e.stopPropagation();
  hidePortContextMenu();
  
  if(!nodeContextMenu) createNodeContextMenu();
  nodeContextTarget = node;
  
  // Menü etiketlerini güncelle — mevcut duruma göre
  var pp = (node.data && node.data.portPositions) || {};
  var inSide = pp.input ? pp.input.side : 'left';
  var outSide = pp.output ? pp.output.side : 'right';
  var isVertical = (inSide === 'top' || inSide === 'bottom' || outSide === 'top' || outSide === 'bottom');
  
  var items = nodeContextMenu.querySelectorAll('.ve-context-item');
  items[0].innerHTML = isVertical ? '<span><span class="mf-ico mf-ico-refresh"></span></span> Yataya Çevir (← →)' : '<span><span class="mf-ico mf-ico-refresh"></span></span> Dikeye Çevir (↑ ↓)';
  
  nodeContextMenu.style.display = 'block';
  nodeContextMenu.style.left = e.clientX + 'px';
  nodeContextMenu.style.top = e.clientY + 'px';
  
  // Ekran dışına taşmayı önle
  var rect = nodeContextMenu.getBoundingClientRect();
  if(rect.right > window.innerWidth) nodeContextMenu.style.left = (e.clientX - rect.width) + 'px';
  if(rect.bottom > window.innerHeight) nodeContextMenu.style.top = (e.clientY - rect.height) + 'px';
}

function hideNodeContextMenu() {
  if(nodeContextMenu) nodeContextMenu.style.display = 'none';
  nodeContextTarget = null;
}

function handleNodeContextAction(action) {
  if(!nodeContextTarget) return;
  var node = nodeContextTarget;
  if(!node.data) node.data = {};
  if(!node.data.portPositions) node.data.portPositions = {};
  
  saveState();
  
  var pp = node.data.portPositions;
  var inSide = pp.input ? pp.input.side : 'left';
  var outSide = pp.output ? pp.output.side : 'right';
  
  switch(action) {
    case 'toggle-axis':
      // Yatay ise dikeye, dikey ise yataya
      var isVertical = (inSide === 'top' || inSide === 'bottom' || outSide === 'top' || outSide === 'bottom');
      if(isVertical) {
        pp.input = {side: 'left'};
        pp.output = {side: 'right'};
      } else {
        pp.input = {side: 'top'};
        pp.output = {side: 'bottom'};
      }
      break;
    case 'mirror-h':
      // Sol↔Sağ aynala
      if(inSide === 'left' && outSide === 'right') {
        pp.input = {side: 'right'};
        pp.output = {side: 'left'};
      } else if(inSide === 'right' && outSide === 'left') {
        pp.input = {side: 'left'};
        pp.output = {side: 'right'};
      } else {
        // Karışık durumda — yatay aynala mantığı
        var flipH = function(s) { return s === 'left' ? 'right' : s === 'right' ? 'left' : s; };
        pp.input = {side: flipH(inSide)};
        pp.output = {side: flipH(outSide)};
      }
      break;
    case 'mirror-v':
      // Üst↔Alt aynala
      if(inSide === 'top' && outSide === 'bottom') {
        pp.input = {side: 'bottom'};
        pp.output = {side: 'top'};
      } else if(inSide === 'bottom' && outSide === 'top') {
        pp.input = {side: 'top'};
        pp.output = {side: 'bottom'};
      } else {
        // Karışık durumda — dikey aynala mantığı
        var flipV = function(s) { return s === 'top' ? 'bottom' : s === 'bottom' ? 'top' : s; };
        pp.input = {side: flipV(inSide)};
        pp.output = {side: flipV(outSide)};
      }
      break;
    case 'reset-ports':
      delete node.data.portPositions;
      break;
  }
  
  // Tüm portları güncelle
  var nodeEl = document.getElementById(node.id);
  if(nodeEl) {
    nodeEl.querySelectorAll('.ve-node-port').forEach(function(portEl) {
      var portType = portEl.getAttribute('data-port');
      updatePortPosition(portEl, node, portType);
    });
  }
  updateAllConnections();
  
  var labels = {
    'toggle-axis': 'Port yönü değiştirildi',
    'mirror-h': 'Yatay aynalama uygulandı',
    'mirror-v': 'Dikey aynalama uygulandı',
    'reset-ports': 'Portlar varsayılana döndü'
  };
  showToast(labels[action] || 'Port düzeni güncellendi');
}

// ============================================================================
// PORT POZİSYON MENÜSÜ SİSTEMİ
// ============================================================================
var portContextMenu = null;
var selectedPort = null;

function createPortContextMenu() {
  var menu = document.createElement('div');
  menu.id = 've-port-context-menu';
  menu.className = 've-context-menu';
  menu.style.cssText = 'display:none; position:fixed; background:var(--bg-secondary); border:1px solid var(--border-color); border-radius:0; box-shadow:0 4px 12px rgba(0,0,0,0.3); z-index:10001; min-width:140px; padding:4px 0;';
  
  menu.innerHTML = `
    <div class="ve-context-item" data-action="top">
      <span>⬆️</span> Üste Taşı
    </div>
    <div class="ve-context-item" data-action="right">
      <span>➡️</span> Sağa Taşı
    </div>
    <div class="ve-context-item" data-action="bottom">
      <span>⬇️</span> Alta Taşı
    </div>
    <div class="ve-context-item" data-action="left">
      <span>⬅️</span> Sola Taşı
    </div>
    <div class="ve-context-divider"></div>
    <div class="ve-context-item" data-action="addPort">
      <span>➕</span> Aynı Tipten Port Ekle
    </div>
    <div class="ve-context-item ve-context-danger" data-action="removePort">
      <span>➖</span> Bu Portu Kaldır
    </div>
    <div class="ve-context-divider"></div>
    <div class="ve-context-item" data-action="reset">
      <span><span class="mf-ico mf-ico-refresh"></span></span> Varsayılana Dön
    </div>
  `;
  
  document.body.appendChild(menu);
  portContextMenu = menu;
  
  // Tıklama olayları
  menu.querySelectorAll('.ve-context-item').forEach(function(item) {
    item.addEventListener('click', function() {
      var action = this.getAttribute('data-action');
      handlePortContextAction(action);
      hidePortContextMenu();
    });
  });
  
  // Dışarı tıklayınca kapat
  document.addEventListener('click', function(e) {
    if(portContextMenu && !portContextMenu.contains(e.target)) {
      hidePortContextMenu();
    }
  });
}

function showPortContextMenu(e, portEl, node, portType) {
  e.preventDefault();
  e.stopPropagation();
  hideNodeContextMenu();
  
  if(!portContextMenu) {
    createPortContextMenu();
  }
  
  selectedPort = {
    element: portEl,
    node: node,
    type: portType
  };
  
  portContextMenu.style.display = 'block';
  portContextMenu.style.left = e.clientX + 'px';
  portContextMenu.style.top = e.clientY + 'px';
}

function hidePortContextMenu() {
  if(portContextMenu) {
    portContextMenu.style.display = 'none';
  }
  selectedPort = null;
}

function handlePortContextAction(action) {
  if(!selectedPort) return;
  
  var portEl = selectedPort.element;
  var node = selectedPort.node;
  var portKey = selectedPort.type; // 'input' veya 'output'
  
  // Port data'sını node.data'ya kaydet (getPortPosition ile uyumlu)
  if(!node.data) node.data = {};
  if(!node.data.portPositions) node.data.portPositions = {};
  
  saveState();
  
  switch(action) {
    case 'top':
      node.data.portPositions[portKey] = {side: 'top'};
      break;
    case 'right':
      node.data.portPositions[portKey] = {side: 'right'};
      break;
    case 'bottom':
      node.data.portPositions[portKey] = {side: 'bottom'};
      break;
    case 'left':
      node.data.portPositions[portKey] = {side: 'left'};
      break;
    case 'reset':
      delete node.data.portPositions[portKey];
      break;
    case 'addPort':
      addNodePort(node, portKey);
      return;   // kendi rebuild/toast'ını yapar
    case 'removePort':
      removeNodePort(node, portKey);
      return;
  }

  // Port pozisyonunu güncelle
  updatePortPosition(portEl, node, portKey);
  updateAllConnections();
  showToast('Port pozisyonu güncellendi');
}

// ── Dinamik port ekle / kaldır (tüm düğümler için) ───────────────────────────
// Port sayısını örnek-başı override eder (node.data.portOverride), DOM'u yeniden
// kurar (veRebuildNodePorts) ve bağlantı/portPositions id'lerini yeniden numaralar.
// portKey: 'input' | 'output' | 'input-N' | 'output-N'.
function _portIdOf(kind, idx, count){ return count <= 1 ? kind : kind + '-' + idx; }

// SAF: port sayısı değişince eski→yeni port id eşlemesi + kaldırılan id. removedIdx<0 = ekleme.
function _computePortRemap(kind, oldCount, newCount, removedIdx){
  var survivors = [];
  for(var i = 0; i < oldCount; i++){ if(i !== removedIdx) survivors.push(i); }
  var map = {};
  for(var k = 0; k < survivors.length; k++){
    var oldId = _portIdOf(kind, survivors[k], oldCount);
    var newId = _portIdOf(kind, k, newCount);
    if(oldId !== newId) map[oldId] = newId;
  }
  var removedId = (removedIdx >= 0 && removedIdx < oldCount) ? _portIdOf(kind, removedIdx, oldCount) : null;
  return { map: map, removedId: removedId };
}

// Eşlemeyi bağlantılara + node.data.portPositions'a uygula (kaldırılanı temizle).
function _remapNodePorts(node, kind, oldCount, newCount, removedIdx){
  var r = _computePortRemap(kind, oldCount, newCount, removedIdx);
  var isInput = (kind === 'input');
  if(typeof connections !== 'undefined'){
    if(r.removedId){
      connections = connections.filter(function(c){
        return isInput ? !(c.to === node.id && c.toPort === r.removedId)
                       : !(c.from === node.id && c.fromPort === r.removedId);
      });
    }
    connections.forEach(function(c){
      if(isInput && c.to === node.id && r.map[c.toPort]) c.toPort = r.map[c.toPort];
      if(!isInput && c.from === node.id && r.map[c.fromPort]) c.fromPort = r.map[c.fromPort];
    });
  }
  var pp = node.data && node.data.portPositions;
  if(pp){
    if(r.removedId && pp[r.removedId] !== undefined) delete pp[r.removedId];
    var moves = [];
    Object.keys(r.map).forEach(function(oldId){ if(pp[oldId] !== undefined) moves.push([r.map[oldId], pp[oldId]]); });
    Object.keys(r.map).forEach(function(oldId){ if(pp[oldId] !== undefined) delete pp[oldId]; });
    moves.forEach(function(mv){ pp[mv[0]] = mv[1]; });
  }
}

function addNodePort(node, portKey){
  var kind = portKey.indexOf('input') === 0 ? 'input' : 'output';
  var kindP = kind + 's';
  var oldC = nodePortCount(node, kindP), newC = oldC + 1;
  if(!node.data) node.data = {};
  node.data.portOverride = node.data.portOverride || {};
  node.data.portOverride[kindP] = newC;
  _remapNodePorts(node, kind, oldC, newC, -1);
  veRebuildNodePorts(node);
  updateAllConnections();
  showToast(kind === 'input' ? 'Giriş portu eklendi' : 'Çıkış portu eklendi');
}

function removeNodePort(node, portKey){
  var kind = portKey.indexOf('input') === 0 ? 'input' : 'output';
  var kindP = kind + 's';
  var oldC = nodePortCount(node, kindP);
  if(oldC <= 0) return;
  var idx = 0; if(portKey.indexOf('-') > -1) idx = parseInt(portKey.split('-')[1]) || 0;
  if(!node.data) node.data = {};
  node.data.portOverride = node.data.portOverride || {};
  node.data.portOverride[kindP] = oldC - 1;
  _remapNodePorts(node, kind, oldC, oldC - 1, idx);
  veRebuildNodePorts(node);
  updateAllConnections();
  showToast('Port kaldırıldı');
}

function updatePortPosition(portEl, node, portType) {
  var pos = (node.data && node.data.portPositions && node.data.portPositions[portType]) || null;
  var isInput = portType.indexOf('input') === 0;
  var side = pos ? pos.side
    : ((typeof defaultPortSide === 'function') ? defaultPortSide(node, portType) : (isInput ? 'left' : 'right'));

  // Kenar üzerindeki konum: aynı kenardaki portların sırasına göre (getPortPosition
  // ile birebir). Tek port → %50 (kenarın ortası); aynı kenarda çoklu → yan yana.
  var perp = (typeof portPerpPercent === 'function') ? portPerpPercent(node, portType) : 50;

  // Pozisyon stillerini tamamen sıfırla
  portEl.style.left = 'auto';
  portEl.style.right = 'auto';
  portEl.style.top = 'auto';
  portEl.style.bottom = 'auto';
  portEl.style.marginLeft = '0';
  portEl.style.marginTop = '0';

  switch(side) {
    case 'top':
      portEl.style.top = '-9px';
      portEl.style.left = perp + '%';
      portEl.style.marginLeft = '-7px';
      break;
    case 'right':
      portEl.style.right = '-9px';
      portEl.style.top = perp + '%';
      portEl.style.marginTop = '-7px';
      break;
    case 'bottom':
      portEl.style.bottom = '-9px';
      portEl.style.left = perp + '%';
      portEl.style.marginLeft = '-7px';
      break;
    case 'left':
      portEl.style.left = '-9px';
      portEl.style.top = perp + '%';
      portEl.style.marginTop = '-7px';
      break;
  }
}

function enablePortContextMenu(portEl, node, portType) {
  portEl.addEventListener('contextmenu', function(e) {
    e.preventDefault();
    e.stopPropagation();
    showPortContextMenu(e, portEl, node, portType);
  });
}

// ============================================================================
// ETİKET (LABEL) KONUM MENÜSÜ — düğüm adını üst/alt/sağ/sol konumlandır
// ============================================================================
var labelContextMenu = null;
var labelContextTarget = null;

// node.data.labelPos'a göre etiket elemanına konum sınıfını uygula (yoksa: alt).
function applyNodeLabelPos(node, labelEl){
  if(!labelEl){
    var nodeEl = (typeof document !== 'undefined') ? document.getElementById(node.id) : null;
    labelEl = nodeEl && nodeEl.querySelector('.ve-node-label');
  }
  if(!labelEl) return;
  labelEl.classList.remove('lbl-top', 'lbl-left', 'lbl-right');
  var pos = node.data && node.data.labelPos;
  if(pos === 'top') labelEl.classList.add('lbl-top');
  else if(pos === 'left') labelEl.classList.add('lbl-left');
  else if(pos === 'right') labelEl.classList.add('lbl-right');
  // 'bottom' / tanımsız → temel kural (alt)
}

function createLabelContextMenu(){
  var menu = document.createElement('div');
  menu.id = 've-label-context-menu';
  menu.className = 've-context-menu';
  menu.style.cssText = 'display:none; position:fixed; background:var(--bg-secondary); border:1px solid var(--border-color); border-radius:0; box-shadow:0 4px 12px rgba(0,0,0,0.3); z-index:10001; min-width:150px; padding:4px 0;';
  menu.innerHTML = `
    <div class="ve-context-item" data-action="top"><span>⬆️</span> Etiketi Üste</div>
    <div class="ve-context-item" data-action="bottom"><span>⬇️</span> Etiketi Alta</div>
    <div class="ve-context-item" data-action="left"><span>⬅️</span> Etiketi Sola</div>
    <div class="ve-context-item" data-action="right"><span>➡️</span> Etiketi Sağa</div>
    <div class="ve-context-divider"></div>
    <div class="ve-context-item" data-action="reset"><span><span class="mf-ico mf-ico-refresh"></span></span> Varsayılana Dön</div>
  `;
  document.body.appendChild(menu);
  labelContextMenu = menu;
  menu.querySelectorAll('.ve-context-item').forEach(function(item){
    item.addEventListener('click', function(){
      handleLabelContextAction(this.getAttribute('data-action'));
      hideLabelContextMenu();
    });
  });
  document.addEventListener('click', function(e){
    if(labelContextMenu && !labelContextMenu.contains(e.target)) hideLabelContextMenu();
  });
}

function showLabelContextMenu(e, node, labelEl){
  if(typeof hidePortContextMenu === 'function') hidePortContextMenu();
  if(typeof hideNodeContextMenu === 'function') hideNodeContextMenu();
  if(!labelContextMenu) createLabelContextMenu();
  labelContextTarget = { node: node, el: labelEl };
  labelContextMenu.style.display = 'block';
  labelContextMenu.style.left = e.clientX + 'px';
  labelContextMenu.style.top = e.clientY + 'px';
  var rect = labelContextMenu.getBoundingClientRect();
  if(rect.right > window.innerWidth) labelContextMenu.style.left = (e.clientX - rect.width) + 'px';
  if(rect.bottom > window.innerHeight) labelContextMenu.style.top = (e.clientY - rect.height) + 'px';
}

function hideLabelContextMenu(){
  if(labelContextMenu) labelContextMenu.style.display = 'none';
  labelContextTarget = null;
}

function handleLabelContextAction(action){
  if(!labelContextTarget) return;
  var node = labelContextTarget.node, el = labelContextTarget.el;
  if(!node.data) node.data = {};
  if(typeof saveState === 'function') saveState();
  if(action === 'reset') delete node.data.labelPos;
  else node.data.labelPos = action;   // top / bottom / left / right
  applyNodeLabelPos(node, el);
  if(typeof showToast === 'function') showToast('Etiket konumu güncellendi');
}

// ============================================================================
// OK (CONNECTION) CONTEXT MENU SİSTEMİ
// ============================================================================
var connectionContextMenu = null;

function createConnectionContextMenu() {
  var menu = document.createElement('div');
  menu.id = 've-connection-context-menu';
  menu.className = 've-context-menu';
  menu.style.cssText = 'display:none; position:fixed; background:var(--bg-secondary); border:1px solid var(--border-color); border-radius:0; box-shadow:0 4px 12px rgba(0,0,0,0.3); z-index:10001; min-width:150px; padding:4px 0;';
  
  menu.innerHTML = `
    <div class="ve-context-item" data-action="curve">
      <span>🔀</span> Eğri Çizgi
    </div>
    <div class="ve-context-item" data-action="straight">
      <span><span class="mf-ico mf-ico-ruler"></span></span> Düz Çizgi
    </div>
    <div class="ve-context-item" data-action="stepped">
      <span><span class="mf-ico mf-ico-ruler"></span></span> Kademeli Çizgi
    </div>
    <div class="ve-context-divider"></div>
    <div class="ve-context-item" data-action="addPoint">
      <span>➕</span> Kontrol Noktası Ekle
    </div>
    <div class="ve-context-divider"></div>
    <div class="ve-context-item ve-context-danger" data-action="delete">
      <span><span class="mf-ico mf-ico-trash"></span></span> Bağlantıyı Sil
    </div>
  `;
  
  document.body.appendChild(menu);
  connectionContextMenu = menu;
  
  // Tıklama olayları
  menu.querySelectorAll('.ve-context-item').forEach(function(item) {
    item.addEventListener('click', function() {
      var action = this.getAttribute('data-action');
      handleConnectionContextAction(action);
      hideConnectionContextMenu();
    });
  });
  
  // Dışarı tıklayınca kapat
  document.addEventListener('click', function(e) {
    if(!menu.contains(e.target)) {
      hideConnectionContextMenu();
    }
  });
}

var selectedConnectionId = null;

function showConnectionContextMenu(e, connId) {
  e.preventDefault();
  e.stopPropagation();
  
  if(!connectionContextMenu) {
    createConnectionContextMenu();
  }
  
  selectedConnectionId = connId;
  
  connectionContextMenu.style.display = 'block';
  connectionContextMenu.style.left = e.clientX + 'px';
  connectionContextMenu.style.top = e.clientY + 'px';
}

function hideConnectionContextMenu() {
  if(connectionContextMenu) {
    connectionContextMenu.style.display = 'none';
  }
  selectedConnectionId = null;
}

function handleConnectionContextAction(action) {
  if(!selectedConnectionId) return;
  
  var conn = connections.find(function(c) { return c.id === selectedConnectionId; });
  if(!conn) return;
  
  saveState();
  
  switch(action) {
    case 'curve':
      conn.lineType = 'curve';
      showToast('Eğri çizgi yapıldı');
      break;
    case 'straight':
      conn.lineType = 'straight';
      conn.controlPoints = [];
      showToast('Düz çizgi yapıldı');
      break;
    case 'stepped':
      conn.lineType = 'stepped';
      conn.controlPoints = [];
      showToast('Kademeli çizgi yapıldı');
      break;
    case 'addPoint':
      addControlPointToConnection(conn);
      showToast('Kontrol noktası eklendi');
      break;
    case 'delete':
      deleteConnection(conn.id);
      showToast('Bağlantı silindi');
      break;
  }
  
  updateAllConnections();
}

function addControlPointToConnection(conn) {
  var fromNode = nodes.find(function(n) { return n.id === conn.from; });
  var toNode = nodes.find(function(n) { return n.id === conn.to; });
  if(!fromNode || !toNode) return;
  
  // Orta noktayı hesapla
  var midX = (fromNode.x + (fromNode.width || 65) + toNode.x) / 2;
  var midY = (fromNode.y + toNode.y) / 2 + ((fromNode.height || 60) + (toNode.height || 60)) / 4;
  
  if(!conn.controlPoints) conn.controlPoints = [];
  conn.controlPoints.push({x: midX, y: midY, id: 'cp-' + Date.now()});
}

// Jest/Node: saf port-remap yardımcılarını test edilebilir kıl (tarayıcıda no-op).
if(typeof module !== 'undefined' && module.exports){
  module.exports = { _computePortRemap: _computePortRemap, _portIdOf: _portIdOf };
}

