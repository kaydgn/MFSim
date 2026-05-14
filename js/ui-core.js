// HTML escape — kullanıcı girdisini innerHTML'e güvenli ekleme
function escapeHTML(str) {
  if(typeof str !== 'string') return str;
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// ═══════════════════════════════════════════════════════════════════════════
// NODE DRAG: paylasilan state + tek seferlik global dinleyiciler
// Her node icin document.addEventListener('mousemove'/'mouseup') eklemek yerine
// tek sefer baglanan dinleyiciler bu state uzerinden calisir. Undo/redo veya
// yeni node olusturmanin dinleyici yigmasini engeller.
// ═══════════════════════════════════════════════════════════════════════════
var _veNodeDrag = { active: false, anchor: null, dragStart: { x: 0, y: 0 } };

function veAttachNodeDrag(nodeEl, node) {
  nodeEl.addEventListener('mousedown', function(e) {
    if(e.target.classList.contains('ve-node-port')) return;
    if(e.target.classList.contains('ve-resize-handle')) return;
    if(e.button !== 0) return;

    _veNodeDrag.active = true;
    _veNodeDrag.anchor = node;
    _veNodeDrag.dragStart = { x: e.clientX - node.x * canvasZoom, y: e.clientY - node.y * canvasZoom };

    if(!e.ctrlKey && selectedNodes.indexOf(node) === -1) clearSelection();
    addToSelection(node);
    e.stopPropagation();
  });
}

(function() {
  if(typeof document === 'undefined' || typeof document.addEventListener !== 'function') return;

  document.addEventListener('mousemove', function(e) {
    if(!_veNodeDrag.active) return;
    if(typeof isResizing !== 'undefined' && isResizing) return;
    var node = _veNodeDrag.anchor;
    if(!node) return;

    var dx = (e.clientX - _veNodeDrag.dragStart.x) / canvasZoom - node.x;
    var dy = (e.clientY - _veNodeDrag.dragStart.y) / canvasZoom - node.y;

    selectedNodes.forEach(function(n) { n.x += dx; n.y += dy; });

    var snap = (typeof checkAlignment === 'function') ? checkAlignment(selectedNodes) : { snapX: 0, snapY: 0 };
    if(snap.snapX !== 0 || snap.snapY !== 0) {
      selectedNodes.forEach(function(n) { n.x += snap.snapX; n.y += snap.snapY; });
    }

    selectedNodes.forEach(function(n) {
      var el = document.getElementById(n.id);
      if(el) { el.style.left = n.x + 'px'; el.style.top = n.y + 'px'; }
    });

    _veNodeDrag.dragStart = { x: e.clientX - node.x * canvasZoom, y: e.clientY - node.y * canvasZoom };
    if(typeof updateAllConnections === 'function') updateAllConnections();
  });

  document.addEventListener('mouseup', function() {
    if(!_veNodeDrag.active) return;
    if(typeof showAlignmentGuides === 'function') showAlignmentGuides(null);
    if(typeof saveState === 'function') saveState();
    _veNodeDrag.active = false;
    _veNodeDrag.anchor = null;
  });
})();

// Canvas transform uygula
function updateCanvasTransform() {
  var canvas = document.getElementById('ve-canvas');
  if(canvas) {
    canvas.style.transform = 'translate(' + canvasOffset.x + 'px, ' + canvasOffset.y + 'px) scale(' + canvasZoom + ')';
  }
}

// Drag başlangıcı
document.querySelectorAll('.ve-component').forEach(function(comp) {
  comp.addEventListener('dragstart', function(e) {
    e.dataTransfer.setData('component-type', this.getAttribute('data-type'));
  });
});

// Canvas event'leri
document.addEventListener('DOMContentLoaded', function() {
  var canvas = document.getElementById('ve-canvas');
  var canvasWrapper = document.getElementById('ve-canvas-wrapper');
  var selectionBox = document.getElementById('ve-selection-box');
  
  if(!canvas || !canvasWrapper) return;
  
  // Tek modül — veActiveModule sabit
  veActiveModule = 'full-throttle';

  // Overlay gösteriliyorsa bileşenleri gizle, değilse tümünü göster
  var moduleOverlay = document.getElementById('ve-module-overlay');
  var overlayVisible = moduleOverlay && moduleOverlay.style.display !== 'none';

  if(overlayVisible) {
    document.querySelectorAll('.ve-component[data-type]').forEach(function(el) {
      el.style.display = 'none';
    });
    document.querySelectorAll('.ve-category').forEach(function(cat) {
      if(cat.getAttribute('data-always-visible')) return;
      cat.style.display = 'none';
    });
  } else {
    veShowAllSidebarComponents();
  }
  
  // Başlangıç transform
  updateCanvasTransform();
  
  // Drop event
  canvasWrapper.addEventListener('dragover', function(e) {
    e.preventDefault();
  });
  
  canvasWrapper.addEventListener('drop', function(e) {
    e.preventDefault();
    var type = e.dataTransfer.getData('component-type');
    if(!type || !componentDefs[type]) return;

    var rect = canvasWrapper.getBoundingClientRect();
    // Canvas başlangıç offseti (CSS'de top:-3000px, left:-3000px)
    var canvasInitialOffset = 3000;
    // Mouse pozisyonunu canvas koordinatlarına çevir
    var x = (e.clientX - rect.left - canvasOffset.x) / canvasZoom + canvasInitialOffset - 40;
    var y = (e.clientY - rect.top - canvasOffset.y) / canvasZoom + canvasInitialOffset - 50;

    // FEA ebeveyni: tek bir node yerine 2×2 alt-blok zinciri üret
    if(componentDefs[type].isFEAParent) {
      spawnFEAChain(x, y);
      return;
    }

    createNode(type, x, y);
  });
  
  // ===== ZOOM - Mouse tekerleği =====
  canvasWrapper.addEventListener('wheel', function(e) {
    e.preventDefault();
    
    var rect = canvasWrapper.getBoundingClientRect();
    var mouseX = e.clientX - rect.left;
    var mouseY = e.clientY - rect.top;
    
    var oldZoom = canvasZoom;
    var zoomDelta = e.deltaY > 0 ? 0.9 : 1.1;
    canvasZoom = Math.max(0.2, Math.min(3, canvasZoom * zoomDelta));
    
    // Zoom merkezini mouse pozisyonuna göre ayarla
    var zoomRatio = canvasZoom / oldZoom;
    canvasOffset.x = mouseX - (mouseX - canvasOffset.x) * zoomRatio;
    canvasOffset.y = mouseY - (mouseY - canvasOffset.y) * zoomRatio;
    
    updateCanvasTransform();
  });
  
  // ===== PAN - Sağ tık =====
  var isPanning = false;
  var panStart = {x: 0, y: 0};
  
  canvasWrapper.addEventListener('contextmenu', function(e) {
    e.preventDefault();
  });
  
  canvasWrapper.addEventListener('mousedown', function(e) {
    if(e.button === 2) { // Sağ tık - pan (ama node üzerinde değilse)
      if(e.target.closest('.ve-node')) return; // Node sağ tık → context menu
      isPanning = true;
      panStart = {x: e.clientX - canvasOffset.x, y: e.clientY - canvasOffset.y};
      canvasWrapper.style.cursor = 'grabbing';
      e.preventDefault();
      return;
    }
    
    if(e.button === 0) { // Sol tık
      // Bağlantı çizme modundaysak ve port'a DEĞİL boş alana tıkladıysak iptal et
      var clickedPort = e.target.classList.contains('ve-node-port');
      var clickedSvgInteractive = e.target.classList.contains('ve-conn-midpoint') || 
                                   e.target.classList.contains('ve-comp-attach-point') ||
                                   e.target.classList.contains('ve-sensor-dot');
      if((isConnecting || tempLine) && !clickedPort && !clickedSvgInteractive) {
        cleanupTempLine();
      }
      
      // Node veya port'a tıklandıysa seçim başlatma
      var clickedNode = e.target.closest('.ve-node');
      var clickedPort = e.target.classList.contains('ve-node-port');
      
      if(!clickedNode && !clickedPort) {
        // Boş alana tıklandı - çoklu seçim başlat
        isSelecting = true;
        var rect = canvasWrapper.getBoundingClientRect();
        selectionStart = {
          x: e.clientX - rect.left,
          y: e.clientY - rect.top
        };
        selectionBox.style.left = selectionStart.x + 'px';
        selectionBox.style.top = selectionStart.y + 'px';
        selectionBox.style.width = '0';
        selectionBox.style.height = '0';
        selectionBox.style.display = 'block';
        
        // Seçimi temizle (Ctrl basılı değilse)
        if(!e.ctrlKey) {
          clearSelection();
        }
        
        e.preventDefault();
      }
    }
  });
  
  document.addEventListener('mousemove', function(e) {
    // Pan
    if(isPanning) {
      canvasOffset.x = e.clientX - panStart.x;
      canvasOffset.y = e.clientY - panStart.y;
      updateCanvasTransform();
    }
    
    // Çoklu seçim kutusu
    if(isSelecting) {
      var rect = canvasWrapper.getBoundingClientRect();
      var currentX = e.clientX - rect.left;
      var currentY = e.clientY - rect.top;
      
      var x = Math.min(selectionStart.x, currentX);
      var y = Math.min(selectionStart.y, currentY);
      var w = Math.abs(currentX - selectionStart.x);
      var h = Math.abs(currentY - selectionStart.y);
      
      selectionBox.style.left = x + 'px';
      selectionBox.style.top = y + 'px';
      selectionBox.style.width = w + 'px';
      selectionBox.style.height = h + 'px';
    }
    
    // Bağlantı çizgisi
    if(isConnecting && tempLine && connectingFrom && connectingFrom.node) {
      var wRect = canvasWrapper.getBoundingClientRect();
      
      // Mouse pozisyonunu canvas koordinatlarına çevir
      var canvasInitialOffset = 3000;
      var x2 = (e.clientX - wRect.left - canvasOffset.x) / canvasZoom + canvasInitialOffset;
      var y2 = (e.clientY - wRect.top - canvasOffset.y) / canvasZoom + canvasInitialOffset;
      
      // Başlangıç noktası - port pozisyonunu al
      var fromPortPos = getPortPosition(connectingFrom.node, connectingFrom.port);
      var x1 = fromPortPos.x;
      var y1 = fromPortPos.y;
      
      tempLine.setAttribute('d', createCurvedPath(x1, y1, x2, y2));
    }
  });
  
  document.addEventListener('mouseup', function(e) {
    // Pan bitti
    if(isPanning) {
      isPanning = false;
      canvasWrapper.style.cursor = '';
    }
    
    // Çoklu seçim bitti
    if(isSelecting) {
      isSelecting = false;
      
      // Seçim kutusunun boyutunu kontrol et (minimum 5x5 piksel olmalı)
      var boxWidth = parseInt(selectionBox.style.width) || 0;
      var boxHeight = parseInt(selectionBox.style.height) || 0;
      
      if(boxWidth > 5 && boxHeight > 5) {
        // Seçim kutusundaki node'ları bul
        var boxRect = selectionBox.getBoundingClientRect();
        
        nodes.forEach(function(node) {
          var nodeEl = document.getElementById(node.id);
          if(nodeEl) {
            var nodeRect = nodeEl.getBoundingClientRect();

            if(nodeRect.left < boxRect.right && nodeRect.right > boxRect.left &&
               nodeRect.top < boxRect.bottom && nodeRect.bottom > boxRect.top) {
              addToSelection(node);
            }
          }
        });

        // Annotations da seçim kutusuna dahil
        if(typeof annotations !== 'undefined' && typeof selectAnnotation === 'function') {
          annotations.forEach(function(annot) {
            var annotEl = document.getElementById(annot.id);
            if(annotEl) {
              var annotRect = annotEl.getBoundingClientRect();
              if(annotRect.left < boxRect.right && annotRect.right > boxRect.left &&
                 annotRect.top < boxRect.bottom && annotRect.bottom > boxRect.top) {
                selectAnnotation(annot);
              }
            }
          });
        }
      }
      
      // Seçim kutusunu gizle ve sıfırla
      selectionBox.style.display = 'none';
      selectionBox.style.width = '0';
      selectionBox.style.height = '0';
    }
    
    // Bağlantı oluşturma - sadece boş alana mouseup olursa iptal et
    if(isConnecting) {
      var overPort = e.target && e.target.classList && e.target.classList.contains('ve-node-port');
      if(!overPort) {
        cleanupTempLine();
      }
    }
  });
  
  // ===== KLAVYE KISAYOLLARI =====
  // Clipboard için
  var clipboard = [];
  var clipboardOffset = {x: 0, y: 0};
  
  document.addEventListener('keydown', function(e) {
    // Input alanında mıyız?
    var activeEl = document.activeElement;
    var isInput = activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || activeEl.isContentEditable);
    
    // Sayfa 2'de miyiz? (Görsel Editör)
    var sayfa2 = document.getElementById('sayfa2');
    var isEditorActive = sayfa2 && sayfa2.classList.contains('active');
    
    if(isInput || !isEditorActive) return;
    
    // Ctrl+C - Kopyala
    if((e.ctrlKey || e.metaKey) && e.key === 'c') {
      if(selectedNodes.length > 0) {
        e.preventDefault();
        
        // Seçili node'ları clipboard'a kopyala
        clipboard = selectedNodes.map(function(node) {
          return {
            type: node.type,
            x: node.x,
            y: node.y
          };
        });
        
        // Offset için ilk node'un pozisyonunu sakla
        clipboardOffset = {
          x: selectedNodes[0].x,
          y: selectedNodes[0].y
        };
        
        // Kullanıcıya bilgi ver
        showToast(clipboard.length + ' bileşen kopyalandı');
      }
    }
    
    // Ctrl+V - Yapıştır
    if((e.ctrlKey || e.metaKey) && e.key === 'v') {
      if(clipboard.length > 0) {
        e.preventDefault();
        
        // Mevcut seçimi temizle
        clearSelection();
        
        // Her yapıştırmada biraz offset ekle (üst üste binmesin)
        var pasteOffset = 40;
        
        // Clipboard'daki node'ları yapıştır
        var newNodes = [];
        clipboard.forEach(function(item) {
          var newX = item.x + pasteOffset;
          var newY = item.y + pasteOffset;
          
          createNode(item.type, newX, newY);
          
          // Son oluşturulan node'u bul ve seçime ekle
          var newNode = nodes[nodes.length - 1];
          if(newNode) {
            newNodes.push(newNode);
          }
        });
        
        // Yapıştırılan node'ları seç
        newNodes.forEach(function(n) {
          addToSelection(n);
        });
        
        // Bir sonraki yapıştırma için offset'i güncelle
        clipboardOffset.x += pasteOffset;
        clipboardOffset.y += pasteOffset;
        
        showToast(clipboard.length + ' bileşen yapıştırıldı');
      }
    }
    
    // Ctrl+A - Tümünü seç
    if((e.ctrlKey || e.metaKey) && e.key === 'a') {
      e.preventDefault();
      clearSelection();
      nodes.forEach(function(node) {
        addToSelection(node);
      });
      if(nodes.length > 0) {
        showToast(nodes.length + ' bileşen seçildi');
      }
    }
    
    // Ctrl+D - Duplicate (seçilileri hızlı kopyala)
    if((e.ctrlKey || e.metaKey) && e.key === 'd') {
      if(selectedNodes.length > 0) {
        e.preventDefault();
        
        var toDuplicate = selectedNodes.slice();
        clearSelection();
        
        toDuplicate.forEach(function(node) {
          createNode(node.type, node.x + 40, node.y + 40);
          var newNode = nodes[nodes.length - 1];
          if(newNode) {
            addToSelection(newNode);
          }
        });
        
        showToast(toDuplicate.length + ' bileşen kopyalandı');
      }
    }
    
    // Delete veya Backspace tuşu
    if(e.key === 'Delete' || e.key === 'Backspace') {
      if(selectedNodes.length > 0) {
        e.preventDefault();
        deleteSelectedNodes();
      }
      if(typeof selectedAnnotations !== 'undefined' && selectedAnnotations.length > 0) {
        e.preventDefault();
        deleteSelectedAnnotations();
      }
    }
    
    // Escape tuşu - seçimi temizle ve tempLine'ı sil
    if(e.key === 'Escape') {
      clearSelection();
      cleanupTempLine();
    }
  });
  
});

function createCurvedPath(x1, y1, x2, y2) {
  var midX = (x1 + x2) / 2;
  var cp1x = midX;
  var cp1y = y1;
  var cp2x = midX;
  var cp2y = y2;
  return 'M ' + x1 + ' ' + y1 + ' C ' + cp1x + ' ' + cp1y + ', ' + cp2x + ' ' + cp2y + ', ' + x2 + ' ' + y2;
}

function createNode(type, x, y, width, height) {
  var def = componentDefs[type];
  if(!def) return;

  // FEA ebeveyni asla doğrudan node olamaz — yalnız spawnFEAChain ile zincir üretir
  if(def.isFEAParent) {
    spawnFEAChain(x, y);
    return;
  }

  // maxInstances kontrolü
  if(def.maxInstances) {
    var existingCount = nodes.filter(function(n) { return n.type === type; }).length;
    if(existingCount >= def.maxInstances) {
      if(typeof showNotification === 'function') showNotification('⚠️ ' + def.name + ' topolojide en fazla ' + def.maxInstances + ' tane olabilir.', 'warning');
      return;
    }
  }
  
  compCounter++;
  var nodeId = 'comp-' + compCounter;
  
  // Sensör/Sonlandırıcı küçük, özel boyutlu bileşenler
  var defaultW = def.defaultWidth || ((def.isSensor || def.isTerminator) ? 33 : 65);
  var defaultH = def.defaultHeight || ((def.isSensor || def.isTerminator) ? 33 : 60);
  
  var node = {
    id: nodeId,
    type: type,
    x: x,
    y: y,
    width: width || defaultW,
    height: height || defaultH,
    def: def
  };
  nodes.push(node);
  
  // Bileşen tiplerine göre varsayılan veri ataması
  if(!node.data) node.data = {};
  if(type === 'differential') {
    if(node.data.diffRatio === undefined) node.data.diffRatio = 6.54;
    if(node.data.efficiency === undefined) node.data.efficiency = 96;
    if(node.data.diffInertia === undefined) node.data.diffInertia = 1.0;
  }
  
  // State kaydet
  if(typeof saveState === 'function') saveState();
  
  // Node HTML oluştur
  var nodeEl = document.createElement('div');
  nodeEl.className = 've-node';
  nodeEl.id = nodeId;
  nodeEl.style.left = x + 'px';
  nodeEl.style.top = y + 'px';
  nodeEl.style.width = node.width + 'px';
  nodeEl.setAttribute('data-type', type);
  
  var html = '<div class="ve-node-box" style="width:' + node.width + 'px; height:' + node.height + 'px;">';
  
  // Giriş portları
  if(def.inputs > 0) {
    for(var pi = 0; pi < def.inputs; pi++) {
      var inputPortId = def.inputs === 1 ? 'input' : 'input-' + pi;
      var inputTopPct = ((pi + 1) / (def.inputs + 1) * 100);
      html += '<div class="ve-node-port input" data-node="' + nodeId + '" data-port="' + inputPortId + '" data-port-index="' + pi + '" title="Giriş ' + (pi+1) + '" style="top:' + inputTopPct + '%; margin-top:-5px;"></div>';
    }
  }
  
  // Sembol
  html += def.svg;
  
  // Çıkış portları
  if(def.outputs > 0) {
    for(var po = 0; po < def.outputs; po++) {
      var outputPortId = def.outputs === 1 ? 'output' : 'output-' + po;
      var outputTopPct = ((po + 1) / (def.outputs + 1) * 100);
      html += '<div class="ve-node-port output" data-node="' + nodeId + '" data-port="' + outputPortId + '" data-port-index="' + po + '" title="Çıkış ' + (po+1) + '" style="top:' + outputTopPct + '%; margin-top:-5px;"></div>';
    }
  }
  
  html += '</div>';
  
  // Selection border (kesikli çerçeve)
  html += '<div class="ve-selection-border"></div>';
  
  // Resize handles - node-box dışında
  html += '<div class="ve-resize-handle ve-resize-nw" data-handle="nw"></div>';
  html += '<div class="ve-resize-handle ve-resize-n" data-handle="n"></div>';
  html += '<div class="ve-resize-handle ve-resize-ne" data-handle="ne"></div>';
  html += '<div class="ve-resize-handle ve-resize-e" data-handle="e"></div>';
  html += '<div class="ve-resize-handle ve-resize-se" data-handle="se"></div>';
  html += '<div class="ve-resize-handle ve-resize-s" data-handle="s"></div>';
  html += '<div class="ve-resize-handle ve-resize-sw" data-handle="sw"></div>';
  html += '<div class="ve-resize-handle ve-resize-w" data-handle="w"></div>';
  
  html += '<div class="ve-node-label">' + def.name + '</div>';
  
  if(type === 'differential') {
    if(node.data.diffRatio === undefined) node.data.diffRatio = 6.54;
    var existingDiffs = nodes.filter(function(n) { return n.type === 'differential' && n.id !== nodeId; });
    if(existingDiffs.length === 0 && !node.isMasterDiff) {
      node.isMasterDiff = true;
    }
    if(node.isMasterDiff) {
      html += '<div class="ve-wheel-master-badge" title="Master Diferansiyel — parametreleri bu bileşenden okunur">★</div>';
    }
  }

  // Tekerlek master yıldız badge'i: ilk eklenen tekerlek master olur
  if(type === 'wheel') {
    var existingWheels = nodes.filter(function(n) { return n.type === 'wheel' && n.id !== nodeId; });
    if(existingWheels.length === 0 && !node.isMasterWheel) {
      // Bu ilk tekerlek → master
      node.isMasterWheel = true;
    }
    // Badge her zaman master ise göster
    if(node.isMasterWheel) {
      html += '<div class="ve-wheel-master-badge" title="Master Tekerlek — diğer tekerlekleri kontrol eder">★</div>';
    }
  }
  
  nodeEl.innerHTML = html;
  
  // Handle ve border pozisyonlarını ayarla
  updateNodeHandles(nodeEl, node.width, node.height);
  
  // Resize handle event'leri
  nodeEl.querySelectorAll('.ve-resize-handle').forEach(function(handle) {
    handle.addEventListener('mousedown', function(e) {
      e.stopPropagation();
      var h = this.getAttribute('data-handle');
      startResize(e, node, h);
    });
  });
  
  // Port sağ tık sürükleme
  nodeEl.querySelectorAll('.ve-node-port').forEach(function(port) {
    var portType = port.getAttribute('data-port');
    enablePortContextMenu(port, node, portType);
  });
  
  // Node sağ tık - port düzeni menüsü
  nodeEl.addEventListener('contextmenu', function(e) {
    if(e.target.classList.contains('ve-node-port')) return; // Port menüsü ayrı
    e.preventDefault();
    e.stopPropagation();
    showNodeContextMenu(e, node);
  });
  
  // Node sürükleme — paylasilan tek-dinleyicili sistem (bkz. veAttachNodeDrag)
  veAttachNodeDrag(nodeEl, node);
  
  // Port olayları - bağlantı oluşturma
  nodeEl.querySelectorAll('.ve-node-port').forEach(function(port) {
    // mousedown'da stopPropagation - node drag'ı engelle
    port.addEventListener('mousedown', function(e) {
      e.stopPropagation();
    });
    port.addEventListener('click', function(e) {
      if(e.button !== 0) return;
      e.stopPropagation();
      e.preventDefault();
      
      var portType = this.getAttribute('data-port');
      var portNodeId = this.getAttribute('data-node');
      
      if(!isConnecting) {
        // Bağlantı başlat (output'tan veya input'tan)
        isConnecting = true;
        connectingFrom = {
          nodeId: portNodeId,
          port: portType,
          element: this,
          node: node
        };
        this.style.background = 'var(--accent-primary)';
        this.style.transform = 'scale(1.5)';
        
        // Geçici çizgi oluştur
        var svg = document.getElementById('ve-connections-layer');
        var portPos = getPortPosition(node, portType);
        tempLine = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        tempLine.setAttribute('class', 've-connection-temp');
        tempLine.setAttribute('d', 'M ' + portPos.x + ' ' + portPos.y + ' L ' + portPos.x + ' ' + portPos.y);
        tempLine.addEventListener('click', function(ev) { ev.stopPropagation(); cleanupTempLine(); });
        svg.appendChild(tempLine);
        
        // Sensör ise midpoint'leri göster
        if(node.type === 'sensor') {
          updateAllConnections();
        }
      } else {
        // Bağlantı tamamla
        var fromPort = connectingFrom.port;
        var fromNodeId = connectingFrom.nodeId;
        
        // Farklı node'a ve uyumlu port'a bağla (output→input veya input→output)
        if(portNodeId !== fromNodeId) {
          if(fromPort.startsWith('output') && portType.startsWith('input')) {
            createConnection(fromNodeId, portNodeId, fromPort, portType);
          } else if(fromPort.startsWith('input') && portType.startsWith('output')) {
            createConnection(portNodeId, fromNodeId, portType, fromPort);
          }
        }
        
        // Önceki port stilini sıfırla
        if(connectingFrom.element) {
          connectingFrom.element.style.background = '';
          connectingFrom.element.style.transform = '';
        }
        cleanupTempLine();
      }
    });
  });
  
  document.getElementById('ve-canvas').appendChild(nodeEl);
  updateNodeCount();
  
  // Bileşeni hemen seç — setTimeout ile DOM render'ın tamamlanmasını garanti et
  var _newNode = node;
  setTimeout(function() {
    clearSelection();
    addToSelection(_newNode);
    // Selection border pozisyonunu tekrar hesapla (render sonrası)
    var el = document.getElementById(_newNode.id);
    if(el) updateNodeHandles(el, _newNode.width, _newNode.height);
  }, 20);
}

function createConnection(fromNodeId, toNodeId, fromPort, toPort) {
  fromPort = fromPort || 'output';
  toPort = toPort || 'input';
  
  // Aynı bağlantı var mı kontrol et
  var exists = connections.some(function(c) {
    return c.from === fromNodeId && c.to === toNodeId && c.fromPort === fromPort && c.toPort === toPort;
  });
  if(exists) return;
  
  var conn = {
    id: 'conn-' + Date.now(),
    from: fromNodeId,
    to: toNodeId,
    fromPort: fromPort,
    toPort: toPort
  };
  connections.push(conn);
  
  // Portları işaretle
  var fromPortEl = document.querySelector('#' + fromNodeId + ' .ve-node-port[data-port="' + fromPort + '"]');
  var toPortEl = document.querySelector('#' + toNodeId + ' .ve-node-port[data-port="' + toPort + '"]');
  if(fromPortEl) fromPortEl.classList.add('connected');
  if(toPortEl) toPortEl.classList.add('connected');
  
  updateAllConnections();
  updateNodeCount();

  // TC ↔ Şanzıman bağlantısı kontrolü: Şanzıman Kontrol zorunluluğu
  veCheckShiftControllerRequired();
}

// ═══ Yapısal Analiz zinciri ═══════════════════════════════════════════════
// 2×2 grid:  Geometri → Mesh   (üst sıra)
//                ↓
//            Sınır Koş. → Çözücü (alt sıra)
// Bağlantı topolojisi (akış sırası): Geometri → Mesh → Sınır Koş. → Çözücü
function spawnFEAChain(x, y) {
  // Tekrar eklemeyi engelle (zincir başına bir kez kontrol)
  var hasChain = nodes.some(function(n) {
    return n.type === 'fea-geometry' || n.type === 'fea-mesh' ||
           n.type === 'fea-bc' || n.type === 'fea-solver';
  });
  if(hasChain) {
    if(typeof showToast === 'function') showToast('Yapısal Analiz zinciri zaten mevcut. Aynı projede bir tane bulundurabilirsiniz.', 'warning');
    else if(typeof showNotification === 'function') showNotification('⚠️ Yapısal Analiz zinciri zaten mevcut.', 'warning');
    return;
  }

  // 2×2 grid yerleşimi
  var cellW = 65, cellH = 60;
  var gapX = 80, gapY = 70;
  var positions = {
    'fea-geometry': { x: x,                   y: y },
    'fea-mesh':     { x: x + cellW + gapX,    y: y },
    'fea-bc':       { x: x,                   y: y + cellH + gapY },
    'fea-solver':   { x: x + cellW + gapX,    y: y + cellH + gapY }
  };

  // Önce 4 node oluştur, sonra ID'leri toplayıp bağlantıları çek
  var created = {};
  ['fea-geometry','fea-mesh','fea-bc','fea-solver'].forEach(function(t) {
    var idBefore = compCounter;
    createNode(t, positions[t].x, positions[t].y);
    // En son eklenen node'u yakala (createNode sonunda push edilir)
    var newNode = nodes[nodes.length - 1];
    if(newNode && newNode.type === t) {
      created[t] = newNode.id;
    }
  });

  // Mesh → Sınır Koşulları bağlantısı dikey aksta olduğundan portları üst/alt yönlere sabitle.
  // Aksi halde varsayılan sağ→sol yönelim çapraz/eğri bir çizgi üretir.
  var meshNode = nodes.find(function(n){ return n.id === created['fea-mesh']; });
  if(meshNode) {
    if(!meshNode.data) meshNode.data = {};
    if(!meshNode.data.portPositions) meshNode.data.portPositions = {};
    meshNode.data.portPositions['output'] = { side: 'bottom' };
  }
  var bcNode = nodes.find(function(n){ return n.id === created['fea-bc']; });
  if(bcNode) {
    if(!bcNode.data) bcNode.data = {};
    if(!bcNode.data.portPositions) bcNode.data.portPositions = {};
    bcNode.data.portPositions['input'] = { side: 'top' };
  }

  // Bağlantılar: akış sırasına göre. Tüm 4 node oluştuysa kur.
  if(created['fea-geometry'] && created['fea-mesh']) {
    createConnection(created['fea-geometry'], created['fea-mesh'], 'output', 'input');
  }
  if(created['fea-mesh'] && created['fea-bc']) {
    createConnection(created['fea-mesh'], created['fea-bc'], 'output', 'input');
  }
  if(created['fea-bc'] && created['fea-solver']) {
    createConnection(created['fea-bc'], created['fea-solver'], 'output', 'input');
  }

  if(typeof showToast === 'function') {
    showToast('Yapısal Analiz zinciri eklendi (4 bileşen, 3 bağlantı).', 'success');
  }
}

// ═══ TC ↔ Şanzıman bağlantısında Şanzıman Kontrol zorunluluğu ═══
function veIsTCConnectedToGearbox() {
  return connections.some(function(c) {
    var fromNode = nodes.find(function(n) { return n.id === c.from; });
    var toNode = nodes.find(function(n) { return n.id === c.to; });
    if(!fromNode || !toNode) return false;
    var types = [fromNode.type, toNode.type];
    return types.indexOf('torque-converter') > -1 && types.indexOf('gearbox') > -1;
  });
}

function veCheckShiftControllerRequired() {
  if(!veIsTCConnectedToGearbox()) return;
  var hasShiftCtrl = nodes.some(function(n) { return n.type === 'shift-controller'; });
  if(!hasShiftCtrl) {
    showToast('⚠ Tork Konvertörü → Şanzıman bağlantısı otomatik şanzıman gerektirir. Lütfen "Şanzıman Kontrol" bileşenini ekleyin.', 'warning');
  }
}

// updateAllConnections fonksiyonu dosyanın sonunda tanımlı (getPortPosition ile)

