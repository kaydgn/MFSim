// ============================================================================
// BİLEŞEN MENÜSÜ — SAĞ TIK (kullanıcı 2026-11-11, Canlı Not 143: *"Bileşenlere sağ tık olayını
// getirelim. Sağ tıklayınca işte silme, yeniden boyutlandırma falan filan neler olabilirse olsun.
// Güzel kullanışlı olsun."*). Önce sağ tık yalnız port düzenini (yatay ↔ dikey, aynala) açıyordu.
// Şimdi: Aç · Yeniden adlandır · Çoğalt · Kopyala · Boyut (küçük · varsayılan · büyük) · Ad (üst ·
// alt · sol · sağ) · port düzeni (portlu bileşende) · Sil. Seçili değilse bileşen seçilir; Çoğalt,
// Kopyala, Boyut, Ad ve Sil SEÇİMİN TAMAMINA uygulanır (kısayollarla aynı işlev). Menü her açılışta
// durumdan kurulur (seçili boyut ve ad konumu basılı; silinmez tipte Sil kapalı, sebebi ipucunda).
// Sağ tık bileşen penceresini AÇMAZ ve konusunu DEĞİŞTİRMEZ (Canlı Not 156); pencereyi Aç açar.
// Kapı: bilesen-menusu.test.js + sag-tik-pencere.test.js.
// ============================================================================
var nodeContextMenu = null;
var nodeContextTarget = null;
var VE_BILESEN_BOYUT = { kucuk:0.75, varsayilan:1, buyuk:1.5 };

function _veBmEsc(t){ return String(t == null ? '' : t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
function _veBmIkon(ad){ return (typeof veIkon === 'function') ? veIkon(ad) : '<span class="mf-ico mf-ico-' + ad + '" aria-hidden="true"></span>'; }
function _veBmMod(){ return (typeof _VE_MOD !== 'undefined') ? _VE_MOD : 'Ctrl'; }
// Bileşenin şimdiki boyutu hangi kademeye oturuyor (yoksa '')
function veBilesenBoyutu(node){
  if(!node || typeof veNodeDefaultSize !== 'function') return '';
  var d = veNodeDefaultSize(node.type), k = Object.keys(VE_BILESEN_BOYUT);
  for(var i = 0; i < k.length; i++){
    var f = VE_BILESEN_BOYUT[k[i]];
    if(Math.abs((node.width || d.w) - Math.round(d.w * f)) < 1 && Math.abs((node.height || d.h) - Math.round(d.h * f)) < 1) return k[i];
  }
  return '';
}
function _veBmPortlu(node){
  var el = (typeof document !== 'undefined') ? document.getElementById(node.id) : null;
  return !!(el && el.querySelector('.ve-node-port'));
}
function _veBmSecim(node){
  var sec = (typeof selectedNodes !== 'undefined' && Array.isArray(selectedNodes)) ? selectedNodes : [];
  return sec.indexOf(node) >= 0 ? sec.slice() : [node];
}
// Menünün içi — durumdan (DOM'suz da kurulur: test)
function veBilesenMenuHTML(node, secim){
  secim = secim || [node];
  var n = secim.length, def = node.def || ((typeof componentDefs !== 'undefined') ? componentDefs[node.type] : null) || {};
  var oge = function(eylem, ikon, ad, kisayol, sinif, kapali){
    return '<div class="ve-context-item' + (sinif ? ' ' + sinif : '') + '" role="menuitem" tabindex="-1" data-action="' + eylem + '"'
      + (kapali ? ' aria-disabled="true" title="' + _veBmEsc(kapali) + '"' : '') + '>'
      + _veBmIkon(ikon) + '<span class="ve-context-ad">' + ad + '</span>'
      + (kisayol ? '<kbd class="ve-context-kbd">' + kisayol + '</kbd>' : '') + '</div>';
  };
  var seg = function(ad, eylem, secenek, secili){
    return '<div class="ve-context-seg" role="group" aria-label="' + ad + '"><span class="ve-context-seg-ad">' + ad + '</span>'
      + secenek.map(function(s){
          return '<button type="button" class="ve-context-seg-b" role="menuitemradio" data-action="' + eylem + ':' + s[0] + '"'
            + ' aria-checked="' + (secili === s[0]) + '">' + s[1] + '</button>';
        }).join('') + '</div>';
  };
  var adPos = (node.data && node.data.labelPos) || 'bottom';
  var h = (n > 1 ? '<div class="ve-context-bas">' + n + ' bileşen</div>' : '')
    + (n === 1 ? oge('ac', 'external-link', 'Aç', 'Çift tık') + oge('adlandir', 'edit', 'Yeniden adlandır') + '<div class="ve-context-divider"></div>' : '')
    + oge('cogalt', 'copy', 'Çoğalt', _veBmMod() + '+D')
    + oge('kopyala', 'clipboard', 'Kopyala', _veBmMod() + '+C')
    + '<div class="ve-context-divider"></div>'
    + seg('Boyut', 'boyut', [['kucuk', 'Küçük'], ['varsayilan', 'Varsayılan'], ['buyuk', 'Büyük']], n === 1 ? veBilesenBoyutu(node) : '')
    + seg('Ad', 'ad', [['top', 'Üst'], ['bottom', 'Alt'], ['left', 'Sol'], ['right', 'Sağ']], n === 1 ? adPos : '');
  if(n === 1 && _veBmPortlu(node)){
    var pp = (node.data && node.data.portPositions) || {};
    var dikey = [pp.input && pp.input.side, pp.output && pp.output.side].some(function(x){ return x === 'top' || x === 'bottom'; });
    h += '<div class="ve-context-divider"></div>'
      + oge('toggle-axis', 'refresh', dikey ? 'Portları yataya çevir' : 'Portları dikeye çevir')
      + oge('mirror-h', 'arrow-left-right', 'Yatay aynala')
      + oge('mirror-v', 'arrow-up-down', 'Dikey aynala')
      + oge('reset-ports', 'rotate-ccw', 'Portları varsayılana döndür');
  }
  var silinmez = secim.filter(function(x){ var d = x.def || ((typeof componentDefs !== 'undefined') ? componentDefs[x.type] : null) || {}; return !!d.noDelete; });
  h += '<div class="ve-context-divider"></div>'
    + oge('sil', 'trash', n > 1 ? n + ' bileşeni sil' : 'Sil', 'Delete', 've-context-danger',
        silinmez.length === n ? ((silinmez[0].def || componentDefs[silinmez[0].type] || {}).noDelete || 'Silinemez') : '');
  return h;
}

function createNodeContextMenu() {
  var menu = document.createElement('div');
  menu.id = 've-node-context-menu';
  menu.className = 've-context-menu ve-bilesen-menu';
  menu.setAttribute('role', 'menu');
  menu.style.display = 'none';
  document.body.appendChild(menu);
  nodeContextMenu = menu;
  menu.addEventListener('click', function(e) {
    var o = e.target.closest ? e.target.closest('[data-action]') : null;
    if(!o || o.getAttribute('aria-disabled') === 'true') return;
    var hedef = nodeContextTarget;
    hideNodeContextMenu();
    veBilesenMenuEylem(o.getAttribute('data-action'), hedef);
  });
  document.addEventListener('click', function(e) {
    if(nodeContextMenu && !nodeContextMenu.contains(e.target)) hideNodeContextMenu();
  });
  document.addEventListener('keydown', function(e) {
    if(e.key === 'Escape' && nodeContextMenu && nodeContextMenu.style.display !== 'none'){ e.stopPropagation(); hideNodeContextMenu(); }
  }, true);
}

function showNodeContextMenu(e, node) {
  e.preventDefault();
  e.stopPropagation();
  hidePortContextMenu();
  if(typeof hideLabelContextMenu === 'function') hideLabelContextMenu();
  if(!nodeContextMenu || !nodeContextMenu.isConnected) createNodeContextMenu();
  // Seçili değilse bileşen seçilir; seçimin içindeyse seçim korunur (işlem seçime uygulanır).
  // Sağ tık yalnız menüyü açar: pencere ne açılır ne konusunu değiştirir (Canlı Not 156) — açan Aç.
  if(typeof selectedNodes !== 'undefined' && selectedNodes.indexOf(node) < 0 && typeof clearSelection === 'function'){
    clearSelection();
    if(typeof addToSelection === 'function') addToSelection(node, { pencere: false });
  }
  nodeContextTarget = node;
  nodeContextMenu.innerHTML = veBilesenMenuHTML(node, _veBmSecim(node));
  nodeContextMenu.style.display = 'block';
  nodeContextMenu.style.left = e.clientX + 'px';
  nodeContextMenu.style.top = e.clientY + 'px';
  // Ekran dışına taşmayı önle
  var rect = nodeContextMenu.getBoundingClientRect();
  if(rect.right > window.innerWidth) nodeContextMenu.style.left = Math.max(4, e.clientX - rect.width) + 'px';
  if(rect.bottom > window.innerHeight) nodeContextMenu.style.top = Math.max(4, e.clientY - rect.height) + 'px';
}

function hideNodeContextMenu() {
  if(nodeContextMenu) nodeContextMenu.style.display = 'none';
  nodeContextTarget = null;
}

// Bileşenin boyutunu ve ad konumunu DOM'a yaz (tutamakla aynı yol: kutu, tutamaklar, teller, çerçeve)
function _veBmBoyutYaz(node){
  var el = (typeof document !== 'undefined') ? document.getElementById(node.id) : null;
  if(el){
    el.style.width = node.width + 'px';
    var box = el.querySelector('.ve-node-box');
    if(box){ box.style.width = node.width + 'px'; box.style.height = node.height + 'px'; }
    if(typeof updateNodeHandles === 'function') updateNodeHandles(el, node.width, node.height);
    el.querySelectorAll('.ve-node-port').forEach(function(p){ updatePortPosition(p, node, p.getAttribute('data-port')); });
  }
}
function veBilesenMenuEylem(eylem, node){
  if(!node || !eylem) return false;
  var secim = _veBmSecim(node), p = String(eylem).split(':');
  switch(p[0]){
    case 'ac':
      if(node.type === 'arac-performans' && typeof veAracOpenEditor === 'function'){ veAracOpenEditor(node.id); return true; }
      if(node.type === 'mount-analysis' && typeof veMntOpenEditor === 'function'){ veMntOpenEditor(node.id); return true; }
      if(node.type === 'fead-analysis' && typeof veFeadOpenEditor === 'function'){ veFeadOpenEditor(node.id); return true; }
      if(typeof veTekTikEylem === 'function' && veTekTikEylem(node)) return true;
      // Önce konu, sonra açılış (çift tıkın sırası): sütunu açan çağrı konuyu kadrajda tutar.
      if(typeof showNodeProperties === 'function') showNodeProperties(node);
      if(typeof veTogglePropertiesPanel === 'function') veTogglePropertiesPanel(true);
      return true;
    case 'adlandir': return veBilesenAdDuzenle(node);
    case 'cogalt': return (typeof veSeciliCogalt === 'function') ? veSeciliCogalt() : false;
    case 'kopyala': return (typeof veSeciliKopyala === 'function') ? veSeciliKopyala() : false;
    case 'boyut':
      if(!VE_BILESEN_BOYUT[p[1]] || typeof veNodeDefaultSize !== 'function') return false;
      secim.forEach(function(x){
        var d = veNodeDefaultSize(x.type), m = (typeof veNodeMinSize === 'function') ? veNodeMinSize(x) : { w:0, h:0 };
        x.width = Math.max(m.w, Math.round(d.w * VE_BILESEN_BOYUT[p[1]]));
        x.height = Math.max(m.h, Math.round(d.h * VE_BILESEN_BOYUT[p[1]]));
        _veBmBoyutYaz(x);
      });
      if(typeof updateAllConnections === 'function') updateAllConnections();
      if(typeof veFeadRefreshLayoutCards === 'function') veFeadRefreshLayoutCards();
      if(typeof veUpdateBoundary === 'function') veUpdateBoundary();
      if(typeof saveState === 'function') saveState();  // kayıt değişiklikten SONRA (yığının tepesi = şimdiki hâl)
      return true;
    case 'ad':
      if(['top', 'bottom', 'left', 'right'].indexOf(p[1]) < 0) return false;
      secim.forEach(function(x){
        if(!x.data) x.data = {};
        if(p[1] === 'bottom') delete x.data.labelPos; else x.data.labelPos = p[1];
        applyNodeLabelPos(x);
      });
      if(typeof veUpdateBoundary === 'function') veUpdateBoundary();
      if(typeof saveState === 'function') saveState();
      return true;
    case 'sil':
      if(typeof deleteSelectedNodes === 'function') deleteSelectedNodes();
      return true;
    case 'toggle-axis': case 'mirror-h': case 'mirror-v': case 'reset-ports':
      nodeContextTarget = node;
      handleNodeContextAction(p[0]);
      nodeContextTarget = null;
      return true;
  }
  return false;
}
// YENİDEN ADLANDIR — tuvalde, adın yerinde: Enter uygular, Esc vazgeçer; boş ad tipin adına döner.
function veBilesenAdDuzenle(node){
  var el = (typeof document !== 'undefined') ? document.getElementById(node.id) : null;
  var lbl = el && el.querySelector('.ve-node-label');
  if(!lbl || lbl.querySelector('input')) return false;
  var def = node.def || componentDefs[node.type] || {}, eski = node.customName || def.name || '';
  var inp = document.createElement('input');
  inp.type = 'text'; inp.value = eski; inp.className = 've-node-ad-inp'; inp.setAttribute('aria-label', 'Ad');
  lbl.textContent = ''; lbl.appendChild(inp);
  inp.focus(); inp.select();
  var bitti = false;
  var bitir = function(uygula){
    if(bitti) return; bitti = true;
    var yeni = uygula ? inp.value.trim() : eski;
    if(!yeni) yeni = def.name || eski;
    var degisti = uygula && yeni !== eski;
    if(degisti) node.customName = yeni;
    lbl.textContent = node.customName || def.name || '';
    var gor = document.getElementById('ve-node-name-display-' + node.id);
    if(gor) gor.textContent = lbl.textContent;
    if(typeof veUpdateBoundary === 'function') veUpdateBoundary();
    if(degisti && typeof saveState === 'function') saveState();  // kayıt değişiklikten SONRA (yığının tepesi = şimdiki hâl)
  };
  inp.addEventListener('keydown', function(e){
    e.stopPropagation();
    if(e.key === 'Enter'){ e.preventDefault(); bitir(true); }
    if(e.key === 'Escape'){ e.preventDefault(); bitir(false); }
  });
  inp.addEventListener('blur', function(){ bitir(true); });
  ['mousedown', 'dblclick', 'click'].forEach(function(t){ inp.addEventListener(t, function(e){ e.stopPropagation(); }); });
  return true;
}

function handleNodeContextAction(action) {
  if(!nodeContextTarget) return;
  var node = nodeContextTarget;
  if(!node.data) node.data = {};
  if(!node.data.portPositions) node.data.portPositions = {};

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
  saveState();  // kayıt değişiklikten SONRA (yığının tepesi = şimdiki hâl)
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
  menu.style.cssText = 'display:none; z-index:10001; min-width:140px;';   // yüzey `.ve-context-menu`den
  
  menu.innerHTML = `
    <div class="ve-context-item" data-action="top">
      <span class="mf-ico mf-ico-arrow-up" aria-hidden="true"></span> Üste taşı
    </div>
    <div class="ve-context-item" data-action="right">
      <span class="mf-ico mf-ico-arrow-right" aria-hidden="true"></span> Sağa taşı
    </div>
    <div class="ve-context-item" data-action="bottom">
      <span class="mf-ico mf-ico-arrow-down" aria-hidden="true"></span> Alta taşı
    </div>
    <div class="ve-context-item" data-action="left">
      <span class="mf-ico mf-ico-arrow-left" aria-hidden="true"></span> Sola taşı
    </div>
    <div class="ve-context-divider"></div>
    <div class="ve-context-item" data-action="addPort">
      <span class="mf-ico mf-ico-plus" aria-hidden="true"></span> Aynı tipten port ekle
    </div>
    <div class="ve-context-item ve-context-danger" data-action="removePort">
      <span class="mf-ico mf-ico-minus" aria-hidden="true"></span> Bu portu kaldır
    </div>
    <div class="ve-context-divider"></div>
    <div class="ve-context-item" data-action="reset">
      <span class="mf-ico mf-ico-refresh" aria-hidden="true"></span> Varsayılana dön
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
      // Motor'un 3 aksesuar GİRİŞ portu sabittir (input-0=Klima, input-1=Alternatör,
      // input-2=Hava Komp. — VE_ACC_PORT_MAP'e kilitli). Port ekle/kaldır id'leri
      // yeniden numaralar → tip eşlemesini bozardı. Çıkış portu düzenlenebilir kalır.
      if(node.type === 'engine' && portKey.indexOf('input') === 0) {
        showToast('Motor\'un aksesuar giriş portları sabittir (Klima / Alternatör / Hava Komp.).', 'warning');
        return;
      }
      addNodePort(node, portKey);
      return;   // kendi rebuild/toast'ını yapar
    case 'removePort':
      if(node.type === 'engine' && portKey.indexOf('input') === 0) {
        showToast('Motor\'un aksesuar giriş portları kaldırılamaz.', 'warning');
        return;
      }
      removeNodePort(node, portKey);
      return;
  }

  // Port pozisyonunu güncelle
  updatePortPosition(portEl, node, portKey);
  updateAllConnections();
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
}

// Port DOM'unu yerine oturt. Geometri TEK kaynaktan gelir (components.js
// vePortBoxStyle) — bağlantı eğrisinin ucu da (getPortPosition) aynı yerden
// okur. Eskiden burada ayrı sayılar (-9px / margin -7px) vardı: port ekle/
// kaldır ya da kenar değiştir sonrası daireler ilk çizimdeki yerlerinden
// 4px dışarı, 2px yukarı zıplıyordu.
function updatePortPosition(portEl, node, portType) {
  // Pozisyon stillerini tamamen sıfırla (sınıftan gelen left/right dâhil)
  portEl.style.left = 'auto';
  portEl.style.right = 'auto';
  portEl.style.top = 'auto';
  portEl.style.bottom = 'auto';
  portEl.style.marginLeft = '0';
  portEl.style.marginTop = '0';

  if(typeof vePortBoxStyle !== 'function') return;
  var s = vePortBoxStyle(node, portType);
  portEl.style.left = s.left + 'px';
  portEl.style.top = s.top + 'px';
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
  menu.style.cssText = 'display:none; z-index:10001; min-width:150px;';   // yüzey `.ve-context-menu`den
  menu.innerHTML = `
    <div class="ve-context-item" data-action="top"><span class="mf-ico mf-ico-arrow-up" aria-hidden="true"></span> Etiketi üste</div>
    <div class="ve-context-item" data-action="bottom"><span class="mf-ico mf-ico-arrow-down" aria-hidden="true"></span> Etiketi alta</div>
    <div class="ve-context-item" data-action="left"><span class="mf-ico mf-ico-arrow-left" aria-hidden="true"></span> Etiketi sola</div>
    <div class="ve-context-item" data-action="right"><span class="mf-ico mf-ico-arrow-right" aria-hidden="true"></span> Etiketi sağa</div>
    <div class="ve-context-divider"></div>
    <div class="ve-context-item" data-action="reset"><span class="mf-ico mf-ico-refresh" aria-hidden="true"></span> Varsayılana dön</div>
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
  if(action === 'reset') delete node.data.labelPos;
  else node.data.labelPos = action;   // top / bottom / left / right
  applyNodeLabelPos(node, el);
  // Sınır çerçevesi adın taşmasını da sarıyor (canvas-space.js
  // veNodeLabelOverflow) → ad kenar değiştirince ÇERÇEVE DE değişmeli;
  // tek tazeleme noktası veUpdateBoundary.
  if(typeof veUpdateBoundary === 'function') veUpdateBoundary();
  if(typeof saveState === 'function') saveState();   // kayıt değişiklikten SONRA (bileşen menüsünün Ad'ı gibi)
}

// ============================================================================
// OK (CONNECTION) CONTEXT MENU SİSTEMİ
// ============================================================================
var connectionContextMenu = null;

function createConnectionContextMenu() {
  var menu = document.createElement('div');
  menu.id = 've-connection-context-menu';
  menu.className = 've-context-menu';
  menu.style.cssText = 'display:none; z-index:10001; min-width:150px;';   // yüzey `.ve-context-menu`den
  
  menu.innerHTML = `
    <div class="ve-context-item" data-action="curve">
      <span><span class="mf-ico mf-ico-shuffle"></span></span> Eğri çizgi
    </div>
    <div class="ve-context-item" data-action="straight">
      <span><span class="mf-ico mf-ico-ruler"></span></span> Düz çizgi
    </div>
    <div class="ve-context-item" data-action="stepped">
      <span><span class="mf-ico mf-ico-ruler"></span></span> Kademeli çizgi
    </div>
    <div class="ve-context-divider"></div>
    <div class="ve-context-item" data-action="addPoint">
      <span><span class="mf-ico mf-ico-plus"></span></span> Kontrol noktası ekle
    </div>
    <div class="ve-context-divider"></div>
    <div class="ve-context-item ve-context-danger" data-action="delete">
      <span><span class="mf-ico mf-ico-trash"></span></span> Bağlantıyı sil
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
      break;
    case 'straight':
      conn.lineType = 'straight';
      conn.controlPoints = [];
      break;
    case 'stepped':
      conn.lineType = 'stepped';
      conn.controlPoints = [];
      break;
    case 'addPoint':
      addControlPointToConnection(conn);
      break;
    case 'delete':
      deleteConnection(conn.id);
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
  module.exports = { _computePortRemap: _computePortRemap, _portIdOf: _portIdOf,
    veBilesenMenuHTML: veBilesenMenuHTML, veBilesenMenuEylem: veBilesenMenuEylem, veBilesenBoyutu: veBilesenBoyutu,
    veBilesenAdDuzenle: veBilesenAdDuzenle, showNodeContextMenu: showNodeContextMenu, VE_BILESEN_BOYUT: VE_BILESEN_BOYUT };
}

