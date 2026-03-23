// ============================================================================
// UNDO / REDO SİSTEMİ
// ============================================================================
var undoStack = [];
var redoStack = [];
var MAX_UNDO_STEPS = 50;

function saveState() {
  var state = {
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

function restoreState(state) {
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

    // ── VERİ MİGRASYONU ──
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
    nodes.push(node);
    
    // Node element oluştur (createNode ile uyumlu)
    var nodeEl = document.createElement('div');
    nodeEl.className = 've-node';
    nodeEl.id = node.id;
    nodeEl.style.left = node.x + 'px';
    nodeEl.style.top = node.y + 'px';
    nodeEl.setAttribute('data-type', node.type);
    
    var html = '<div class="ve-node-box" style="width:' + node.width + 'px; height:' + node.height + 'px;">';
    
    // Giriş portları - createNode ile aynı çoklu port desteği
    if(def.inputs > 0) {
      for(var pi = 0; pi < def.inputs; pi++) {
        var inputPortId = def.inputs === 1 ? 'input' : 'input-' + pi;
        var inputTopPct = ((pi + 1) / (def.inputs + 1) * 100);
        html += '<div class="ve-node-port input" data-node="' + node.id + '" data-port="' + inputPortId + '" data-port-index="' + pi + '" title="Giriş ' + (pi+1) + '" style="top:' + inputTopPct + '%; margin-top:-5px;"></div>';
      }
    }
    
    html += def.svg;
    
    // Çıkış portları
    if(def.outputs > 0) {
      for(var po = 0; po < def.outputs; po++) {
        var outputPortId = def.outputs === 1 ? 'output' : 'output-' + po;
        var outputTopPct = ((po + 1) / (def.outputs + 1) * 100);
        html += '<div class="ve-node-port output" data-node="' + node.id + '" data-port="' + outputPortId + '" data-port-index="' + po + '" title="Çıkış ' + (po+1) + '" style="top:' + outputTopPct + '%; margin-top:-5px;"></div>';
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
    html += '<div class="ve-node-label">' + (node.customName || def.name) + '</div>';
    
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
    
    // Node sürükleme (tam destek - createNode ile aynı)
    (function(theNode) {
      var isDragging = false;
      var dragStart = {x: 0, y: 0};
      
      nodeEl.addEventListener('mousedown', function(e) {
        if(e.target.classList.contains('ve-node-port')) return;
        if(e.target.classList.contains('ve-resize-handle')) return;
        if(e.button !== 0) return;
        
        isDragging = true;
        dragStart = {x: e.clientX - theNode.x * canvasZoom, y: e.clientY - theNode.y * canvasZoom};
        
        if(!e.ctrlKey && selectedNodes.indexOf(theNode) === -1) clearSelection();
        addToSelection(theNode);
        e.stopPropagation();
      });
      
      document.addEventListener('mousemove', function(e) {
        if(!isDragging) return;
        
        var dx = (e.clientX - dragStart.x) / canvasZoom - theNode.x;
        var dy = (e.clientY - dragStart.y) / canvasZoom - theNode.y;
        
        selectedNodes.forEach(function(n) {
          n.x += dx;
          n.y += dy;
        });
        
        var snap = checkAlignment(selectedNodes);
        if(snap.snapX !== 0 || snap.snapY !== 0) {
          selectedNodes.forEach(function(n) {
            n.x += snap.snapX;
            n.y += snap.snapY;
          });
        }
        
        selectedNodes.forEach(function(n) {
          var el = document.getElementById(n.id);
          if(el) {
            el.style.left = n.x + 'px';
            el.style.top = n.y + 'px';
          }
        });
        
        dragStart = {x: e.clientX - theNode.x * canvasZoom, y: e.clientY - theNode.y * canvasZoom};
        updateAllConnections();
      });
      
      document.addEventListener('mouseup', function() {
        if(isDragging) { showAlignmentGuides(null); saveState(); }
        isDragging = false;
      });
    })(node);
    
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

  // Annotasyonları geri yükle
  if(typeof restoreAnnotations === 'function') {
    restoreAnnotations(state.annotations || []);
  }

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

