// ============================================================================
// UNDO / REDO SİSTEMİ
// ============================================================================
var undoStack = [];
var redoStack = [];
var MAX_UNDO_STEPS = 50;

// ── ŞEMA SÜRÜMÜ ──
// Bu sürümün ürettiği her state (undo/redo, sekme değiştirme, güncel kayıt)
// "migrasyon uygulanmış" damgasını taşır. Sürüm damgası taşımayan (veya daha
// eski) state'ler LEGACY kabul edilir ve eski varsayılanlar bir KEZ yeni
// değerlere yükseltilir (bkz. veMigrateNodeData). Sürümlü state'lerde
// migrasyon ÇALIŞMAZ — böylece kullanıcının bilerek girdiği değerler
// (ör. Cd=0.75) "eski varsayılan" sanılıp 0.90'a ezilmez.
var VE_SCHEMA_VERSION = 2;

function saveState() {
  var state = {
    schemaVersion: VE_SCHEMA_VERSION,
    nodes: JSON.parse(JSON.stringify(nodes.map(function(n) {
      return {
        id: n.id,
        type: n.type,
        x: n.x,
        y: n.y,
        width: n.width || 65,
        height: n.height || 60,
        customName: n.customName || '',
        mirrored: n.mirrored || false,
        isMasterWheel: n.isMasterWheel || false,
        isMasterDiff: n.isMasterDiff || false,
        data: n.data || {}
      };
    }))),
    connections: JSON.parse(JSON.stringify(connections.map(function(c) {
      return {
        id: c.id,
        from: c.from,
        to: c.to,
        fromPort: c.fromPort || 'output',
        toPort: c.toPort || 'input',
        lineType: c.lineType || 'curve',
        controlPoints: c.controlPoints || []
      };
    }))),
    annotations: (typeof serializeAnnotations === 'function') ? serializeAnnotations() : []
  };
  
  undoStack.push(state);
  if(undoStack.length > MAX_UNDO_STEPS) {
    undoStack.shift();
  }
  redoStack = []; // Yeni işlem yapılınca redo temizlenir
}

function undo() {
  if(undoStack.length < 2) {
    showToast('Geri alınacak işlem yok', 'warning');
    return;
  }
  
  var currentState = undoStack.pop();
  redoStack.push(currentState);
  
  var prevState = undoStack[undoStack.length - 1];
  restoreState(prevState);
  showToast('Geri alındı');
}

function redo() {
  if(redoStack.length === 0) {
    showToast('İleri alınacak işlem yok', 'warning');
    return;
  }
  
  var nextState = redoStack.pop();
  undoStack.push(nextState);
  restoreState(nextState);
  showToast('İleri alındı');
}

// ── LEGACY VERİ MİGRASYONU (SAF fonksiyon — DOM'a dokunmaz) ──
// Eski (binek araç) varsayılanlarını yeni (ağır vasıta) varsayılanlarına
// yükseltir. Değer-eşleşmesiyle çalıştığı için "eski varsayılan" ile
// "kullanıcının bilerek girdiği aynı değer"i ayırt EDEMEZ; bu yüzden YALNIZCA
// sürümsüz/eski state'ler için (bkz. restoreState) çağrılmalıdır. Sürümlü
// state'lerde çağrılırsa kullanıcının kasıtlı değerlerini (ör. Cd=0.75) ezer.
function veMigrateNodeData(node) {
  if(!node || !node.data) return node;
  // Eski varsayılan Crr=0.015 (binek araç) → 0.0035 (ağır vasıta) düzeltmesi
  if(node.type === 'wheel' && node.data.ftCrr === 0.015) {
    node.data.ftCrr = 0.0035;
  }
  // Eski varsayılan aerodinamik değerleri düzeltmesi
  // H=3.0→3.2, W=2.0→2.5, Cd=0.75→0.90 (CdA: 4.5→7.2 m²)
  if(node.type === 'vehicle') {
    if(node.data.ftHeight === 3 || node.data.ftHeight === 3.0 || node.data.ftHeight === 3.000) node.data.ftHeight = 3.200;
    if(node.data.ftWidth === 2 || node.data.ftWidth === 2.0 || node.data.ftWidth === 2.000) node.data.ftWidth = 2.500;
    if(node.data.ftCd === 0.75 || node.data.ftCd === 0.750) node.data.ftCd = 0.900;
  }
  // Eski varsayılan diferansiyel verimi 98→96 (ağır vasıta yük altı)
  if(node.type === 'differential' && node.data.efficiency === 98) {
    node.data.efficiency = 96;
  }
  return node;
}

// LEGACY migrasyonu bir STATE'in tüm düğümlerine uygular — AMA yalnızca state
// sürüm damgası taşımıyorsa (veya daha eskiyse). Güncel state'ler (undo/redo,
// sekme değiştirme, bu sürümle kaydedilen dosyalar) VE_SCHEMA_VERSION taşır →
// migrasyon ATLANIR, böylece kullanıcının kasıtlı girdileri (ör. Cd=0.75)
// korunur. Yalnızca gerçekten eski dosyalar bir kez yeni varsayılanlara
// yükseltilir. SAF fonksiyon (DOM'a dokunmaz); state.nodes[i].data'yı yerinde
// günceller ve state'i döndürür.
function veApplyLegacyMigrations(state) {
  if(!state || !state.nodes) return state;
  if(typeof state.schemaVersion === 'number' && state.schemaVersion >= VE_SCHEMA_VERSION) {
    return state; // Sürümlü/güncel → migrasyon yok
  }
  state.nodes.forEach(veMigrateNodeData);
  return state;
}

// Tuval açıklamaları (gruplama çerçevesi / yazı etiketi) düğüm-bağlantı geri
// yüklemesinin SONUNDA değil, try/finally ile HER DURUMDA geri yüklenir.
// Gerekçe: _veRestoreStateNodes içinde tek bir bozuk düğüm (tanımı kaldırılmış
// tip, eksik/bozuk data, panel senkron hatası) istisna atarsa, akış eski hâlde
// annotasyon adımına HİÇ ulaşmıyordu → kullanıcı topolojiyi yüklenmiş görüyor
// ama gruplama çerçeveleri sessizce kayboluyordu. İstisna yutulmaz; yalnızca
// çerçeveler ondan ÖNCE kurtarılır.
function restoreState(state) {
  try {
    _veRestoreStateNodes(state);
  } finally {
    if(typeof restoreAnnotations === 'function') {
      restoreAnnotations((state && state.annotations) || []);
    }
  }
}

function _veRestoreStateNodes(state) {
  // Yüklenen state LEGACY ise (sürümsüz/eski) eski varsayılanları bir kez
  // yeni değerlere yükselt; sürümlüyse dokunma (kasıtlı girdiler korunur).
  veApplyLegacyMigrations(state);

  // Mevcut node'ları temizle
  nodes.forEach(function(n) {
    var el = document.getElementById(n.id);
    if(el) el.remove();
  });

  nodes = [];
  connections = [];
  
  // compCounter'ı yüklenen en yüksek ID'ye güncelle
  state.nodes.forEach(function(n) {
    var numMatch = n.id.match(/comp-(\d+)/);
    if(numMatch) {
      var num = parseInt(numMatch[1]);
      if(num > compCounter) compCounter = num;
    }
  });
  
  // Node'ları geri yükle
  state.nodes.forEach(function(n) {
    var def = componentDefs[n.type];
    if(!def) return;
    
    var node = {
      id: n.id,
      type: n.type,
      x: n.x,
      y: n.y,
      width: n.width || 65,
      height: n.height || 60,
      def: def,
      customName: n.customName || '',
      mirrored: n.mirrored || false,
      isMasterWheel: n.isMasterWheel || false,
      isMasterDiff: n.isMasterDiff || false,
      data: n.data || {}
    };

    // Alt-sistem (modül) düğümü kart ölçüsüne yükseltilir — ama YALNIZ ölçüsü
    // kart öncesi varsayılana (80×66) BİREBİR eşitse. Bu, şema sürümünden
    // bağımsız yürümek zorunda: sürüm kapısı (veApplyLegacyMigrations) yalnız
    // sürümsüz dosyaları geçirir, oysa 80×66 modül düğümü GÜNCEL sürümle
    // kaydedilmiş dosyalarda da var. Kullanıcının bilerek verdiği her ölçü
    // (yeniden boyutlandırılmış modül) olduğu gibi kalır.
    if(typeof veNormalizeModuleSize === 'function') veNormalizeModuleSize(node);

    // NOT: Eski varsayılan → yeni varsayılan migrasyonu artık restoreState
    // başında veApplyLegacyMigrations(state) ile YALNIZCA legacy state'lere
    // uygulanır (bkz. yukarı). Burada tekrar uygulanmaz.
    nodes.push(node);
    
    // Node element oluştur (createNode ile uyumlu)
    var nodeEl = document.createElement('div');
    nodeEl.className = 've-node' + (VE_STANDALONE_TYPES.indexOf(node.type) >= 0 ? ' ve-node--standalone' : '');
    nodeEl.id = node.id;
    nodeEl.style.left = node.x + 'px';
    nodeEl.style.top = node.y + 'px';
    nodeEl.setAttribute('data-type', node.type);
    
    // Aynalama sınıfı geri yüklemede de gelsin: eskiden burada hiç uygulanmıyordu,
    // undo/redo sonrası aynalanmış düğümün sembolü düzleşiyordu.
    var html = '<div class="ve-node-box' + (node.mirrored ? ' ve-mirrored' : '') + '" style="width:' + node.width + 'px; height:' + node.height + 'px;">';
    
    // Giriş portları - createNode ile aynı (nodePortCount → portOverride'ı korur)
    var inCount = (typeof nodePortCount === 'function') ? nodePortCount(node, 'inputs') : (def.inputs || 0);
    if(inCount > 0) {
      for(var pi = 0; pi < inCount; pi++) {
        var inputPortId = inCount === 1 ? 'input' : 'input-' + pi;
        html += '<div class="ve-node-port input" data-node="' + node.id + '" data-port="' + inputPortId + '" data-port-index="' + pi + '" title="Giriş ' + (pi+1) + '" style="' + vePortStyleAttr(node, inputPortId) + '"></div>';
      }
    }
    
    html += def.svg;
    
    // Çıkış portları
    var outCount = (typeof nodePortCount === 'function') ? nodePortCount(node, 'outputs') : (def.outputs || 0);
    if(outCount > 0) {
      for(var po = 0; po < outCount; po++) {
        var outputPortId = outCount === 1 ? 'output' : 'output-' + po;
        html += '<div class="ve-node-port output" data-node="' + node.id + '" data-port="' + outputPortId + '" data-port-index="' + po + '" title="Çıkış ' + (po+1) + '" style="' + vePortStyleAttr(node, outputPortId) + '"></div>';
      }
    }
    
    html += '</div>';
    html += '<div class="ve-selection-border"></div>';
    html += '<div class="ve-resize-handle ve-resize-nw" data-handle="nw"></div>';
    html += '<div class="ve-resize-handle ve-resize-n" data-handle="n"></div>';
    html += '<div class="ve-resize-handle ve-resize-ne" data-handle="ne"></div>';
    html += '<div class="ve-resize-handle ve-resize-e" data-handle="e"></div>';
    html += '<div class="ve-resize-handle ve-resize-se" data-handle="se"></div>';
    html += '<div class="ve-resize-handle ve-resize-s" data-handle="s"></div>';
    html += '<div class="ve-resize-handle ve-resize-sw" data-handle="sw"></div>';
    html += '<div class="ve-resize-handle ve-resize-w" data-handle="w"></div>';
    html += '<div class="ve-node-label">' + escapeHTML(node.customName || def.name) + '</div>';
    
    // Master tekerlek badge'i
    if(node.type === 'wheel' && node.isMasterWheel) {
      html += '<div class="ve-wheel-master-badge" title="Master Tekerlek — diğer tekerlekleri kontrol eder">★</div>';
    }
    // Master diferansiyel badge'i
    if(node.type === 'differential' && node.isMasterDiff) {
      html += '<div class="ve-wheel-master-badge" title="Master Diferansiyel — parametreleri bu bileşenden okunur">★</div>';
    }
    nodeEl.innerHTML = html;
    
    // Handle ve border pozisyonlarını ayarla
    updateNodeHandles(nodeEl, node.width, node.height);
    
    // Resize event'leri
    nodeEl.querySelectorAll('.ve-resize-handle').forEach(function(handle) {
      handle.addEventListener('mousedown', function(e) {
        e.stopPropagation();
        startResize(e, node, this.getAttribute('data-handle'));
      });
    });
    
    // Port event'leri - sağ tık menüsü ve bağlantı oluşturma
    nodeEl.querySelectorAll('.ve-node-port').forEach(function(port) {
      var portType = port.getAttribute('data-port');
      
      // Sağ tık menüsü
      enablePortContextMenu(port, node, portType);
      
      // mousedown'da stopPropagation - node drag'ı engelle
      port.addEventListener('mousedown', function(e) {
        e.stopPropagation();
      });
      // Sol tık - bağlantı oluştur (click-based)
      port.addEventListener('click', function(e) {
        if(e.button !== 0) return;
        e.stopPropagation();
        e.preventDefault();
        
        var pType = this.getAttribute('data-port');
        var pNodeId = this.getAttribute('data-node');
        
        if(!isConnecting) {
          isConnecting = true;
          connectingFrom = { nodeId: pNodeId, port: pType, element: this, node: node };
          this.style.background = 'var(--accent-primary)';
          this.style.transform = 'scale(1.5)';
          
          var svg = document.getElementById('ve-connections-layer');
          var portPos = getPortPosition(node, pType);
          tempLine = document.createElementNS('http://www.w3.org/2000/svg', 'path');
          tempLine.setAttribute('class', 've-connection-temp');
          tempLine.setAttribute('d', 'M ' + portPos.x + ' ' + portPos.y + ' L ' + portPos.x + ' ' + portPos.y);
          tempLine.addEventListener('click', function(ev) { ev.stopPropagation(); cleanupTempLine(); });
          svg.appendChild(tempLine);
          // Sensör ise midpoint'leri göster
          if(node.type === 'sensor') { updateAllConnections(); }
        } else {
          if(pNodeId !== connectingFrom.nodeId) {
            var fp = connectingFrom.port;
            if(fp.startsWith('output') && pType.startsWith('input')) {
              createConnection(connectingFrom.nodeId, pNodeId, fp, pType);
            } else if(fp.startsWith('input') && pType.startsWith('output')) {
              createConnection(pNodeId, connectingFrom.nodeId, pType, fp);
            }
          }
          if(connectingFrom.element) { connectingFrom.element.style.background = ''; connectingFrom.element.style.transform = ''; }
          cleanupTempLine();
        }
      });
    });
    
    // Node sürükleme — paylasilan tek-dinleyicili sistem (ui-core.js)
    veAttachNodeDrag(nodeEl, node);

    // portLayout / kayıtlı taşımalar → port kenarlarını uygula (createNode ile aynı)
    if((def.portLayout || (node.data && node.data.portPositions)) && typeof updatePortPosition === 'function') {
      nodeEl.querySelectorAll('.ve-node-port').forEach(function(port) {
        updatePortPosition(port, node, port.getAttribute('data-port'));
      });
    }
    // Etiket: konumlandırılabilir + sağ-tık menüsü (createNode ile aynı) → YÜKLÜ
    // örneklerin/geri-yüklenen düğümlerin etiketleri de taşınabilir olsun.
    var _lbl = nodeEl.querySelector('.ve-node-label');
    if(_lbl) {
      _lbl.style.pointerEvents = 'auto';
      if(typeof applyNodeLabelPos === 'function') applyNodeLabelPos(node, _lbl);
      _lbl.addEventListener('contextmenu', function(e) {
        e.preventDefault();
        e.stopPropagation();
        if(typeof showLabelContextMenu === 'function') showLabelContextMenu(e, node, _lbl);
      });
    }

    // Alt-sistem (modül) kartı — createNode ile aynı (bkz. veApplyModuleCard).
    // Alt topolojiden ÇIKIŞ da bu yoldan geçer (veAracCloseEditor →
    // veLoadTabState → restoreState), dolayısıyla karttaki "N bileşen · M
    // bağlantı" özeti kullanıcı dışarı çıkar çıkmaz kendiliğinden tazelenir.
    if(typeof veApplyModuleCard === 'function') veApplyModuleCard(nodeEl, node);
    if(typeof veFeadApplyBadge === 'function') veFeadApplyBadge(nodeEl, node);

    document.getElementById('ve-canvas').appendChild(nodeEl);
  });
  
  // Bağlantıları geri yükle (fromPort/toPort dahil)
  state.connections.forEach(function(c) {
    connections.push({
      id: c.id,
      from: c.from,
      to: c.to,
      fromPort: c.fromPort || 'output',
      toPort: c.toPort || 'input',
      lineType: c.lineType || 'curve',
      controlPoints: c.controlPoints || []
    });
  });
  
  updateAllConnections();
  updateNodeCount();
  clearSelection();

  // Motor aksesuar modelini canlı bağlantılara göre uzlaştır — yükleme/geri-al
  // yolu createConnection'ı atlar; kayıtlı node.data.accessories bayat/orphan
  // eğri taşıyabilir (ör. aksesuar silindikten sonra kaydedilmiş proje).
  if(typeof veSyncAllEngineAccessories === 'function') veSyncAllEngineAccessories();

  // Annotasyonlar burada DEĞİL, restoreState'in finally bloğunda geri yüklenir
  // (bkz. restoreState) — böylece buraya kadarki adımlardan biri patlarsa bile
  // gruplama çerçeveleri kaybolmaz.

  // Sensör sihirbazı görsellerini güncelle
  if(typeof swRefreshAllWizardVisuals === 'function') swRefreshAllWizardVisuals();
}

// Ctrl+Z ve Ctrl+Y için event listener güncelle
document.addEventListener('keydown', function(e) {
  // Sayfa 2 aktif mi kontrol et
  var sayfa2 = document.getElementById('sayfa2');
  var isEditorActive = sayfa2 && sayfa2.classList.contains('active');
  if(!isEditorActive) return;
  
  // Input alanındaysa çalışmasın
  if(e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') {
    return;
  }
  
  // Ctrl+Z - Undo
  if(e.ctrlKey && (e.key === 'z' || e.key === 'Z') && !e.shiftKey) {
    e.preventDefault();
    undo();
    return;
  }
  
  // Ctrl+Y veya Ctrl+Shift+Z - Redo
  if((e.ctrlKey && (e.key === 'y' || e.key === 'Y')) || (e.ctrlKey && e.shiftKey && (e.key === 'z' || e.key === 'Z'))) {
    e.preventDefault();
    redo();
    return;
  }
});

