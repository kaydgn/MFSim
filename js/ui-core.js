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
  // Çift tık → Özellikler modal'ını aç (tek tık sadece seçim yapar).
  nodeEl.addEventListener('dblclick', function(e) {
    if(e.target.classList.contains('ve-node-port')) return;
    if(e.target.classList.contains('ve-resize-handle')) return;
    e.preventDefault();
    e.stopPropagation();
    // Alt-sistem düğümü → çift tık doğrudan iç topolojisini açar
    if(node.type === 'arac-performans' && typeof veAracOpenEditor === 'function') {
      veAracOpenEditor(node.id);
      return;
    }
    if(node.type === 'mount-analysis' && typeof veMntOpenEditor === 'function') {
      veMntOpenEditor(node.id);
      return;
    }
    if(node.type === 'fead-analysis' && typeof veFeadOpenEditor === 'function') {
      veFeadOpenEditor(node.id);
      return;
    }
    if(node.type === 'structural-analysis' && typeof veStrOpenEditor === 'function') {
      veStrOpenEditor(node.id);
      return;
    }
    // BAŞLANGIÇ SİHİRBAZI — alt topoloji açmıyor ama aynı el alışkanlığını
    // kullanıyor: kutuya çift tık, iş yapan yüzeyi açar. Tek tık paneli
    // gösteriyor ve oradaki düğme de aynı yere gidiyor.
    if(node.type === 'fead-wizard' && typeof veFeadWizOpen === 'function') {
      veFeadWizOpen(node.id);
      return;
    }
    if(typeof veTogglePropertiesPanel === 'function') veTogglePropertiesPanel(true);
  });
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

    // HİZALAMA KENETLEMESİ FEAD KASNAĞINDA KAPALI.
    //
    // Kenetleme bir YERLEŞİM yardımı: kutuları birbirine hizalar. FEAD'de ise
    // konum artık FİZİKSEL VERİ — kenetleme, kullanıcının koyduğu koordinatı
    // sessizce kaydırmak demek.
    //
    // Kenetleme VARSAYILAN OLARAK KAPALI (SNAP_ENABLED, results.js), yani bu
    // ancak kullanıcı onu açtığında ya da Q'yu basılı tuttuğunda ateşlenir.
    // Ateşlendiğinde ÖLÇÜLDÜ (gerçek tarayıcı, BMC, alternatör Avara 2'nin
    // satırına doğru 16 ekran px yukarı, zoom 0.653):
    //
    //     kenetleme FEAD'de açıkken   Δy = 24.514 mm istendi →  3.940 mm oldu
    //     kenetleme FEAD'de kapalıyken Δy = 24.514 mm istendi → 24.514 mm oldu
    //
    // Yani 20.6 mm sessizce yutuluyor: kutu komşusunun kenarına yapışıyor ve
    // model kullanıcının hiç koymadığı bir koordinatla çözülüyor.
    //
    // Üstelik kenetleme kutu KENARLARINI hizalıyor ve bunu yaparken BÜTÜN
    // düğümler için sabit 65 px genişlik varsayıyor (checkAlignment); kasnak
    // kutuları 54…72 px olduğu için hizalanan şey merkez de değil, kenar da
    // değil. Kasnak koordinatı için anlamı yok.
    //
    // KONUM BAĞI KAPALIYKEN KENETLEME GERİ GELİR. İstisnanın tek gerekçesi
    // koordinatın kanvastan TÜREMESİYDİ; bağ kapalıyken kutu salt görsel,
    // yani kenetleme klasik topolojilerdeki anlamına (kenarları hizala)
    // dönüyor ve hiçbir sayıyı bozamaz — kenetlenen 20.6 mm artık
    // kenetlenecek bir mm değil.
    var _feadDrag = (typeof _feadIsPulley === 'function')
      && selectedNodes.some(function(n){ return _feadIsPulley(n); })
      && (typeof veFeadCoordLinkOn !== 'function' || typeof nodes === 'undefined'
          || veFeadCoordLinkOn(nodes));
    var snap = (!_feadDrag && typeof checkAlignment === 'function')
      ? checkAlignment(selectedNodes) : { snapX: 0, snapY: 0 };
    if(snap.snapX !== 0 || snap.snapY !== 0) {
      selectedNodes.forEach(function(n) { n.x += snap.snapX; n.y += snap.snapY; });
    }

    selectedNodes.forEach(function(n) {
      var el = document.getElementById(n.id);
      if(el) { el.style.left = n.x + 'px'; el.style.top = n.y + 'px'; }
    });

    _veNodeDrag.dragStart = { x: e.clientX - node.x * canvasZoom, y: e.clientY - node.y * canvasZoom };
    // FEAD: kasnak konumu FİZİKSEL — kanvasta taşımak kasnağı kayış düzleminde
    // taşımak demek. Kanvas → mm dönüşümü burada, kareden önce yapılıyor ki
    // updateAllConnections'ın tetiklediği kart tazelemesi YENİ geometriyi
    // görsün. FEAD dışındaki topolojilerde bedava (kasnak yoksa erken çıkar).
    if(typeof veFeadSyncDrag === 'function') veFeadSyncDrag(selectedNodes);
    if(typeof updateAllConnections === 'function') updateAllConnections();
    if(typeof veMinimapUpdate === 'function') veMinimapUpdate();
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
  // Sonsuz ızgara deseni kameradan türetilir (js/canvas-space.js) — transform ile
  // AYNI karede tazelenmezse ızgara içerikten kayar.
  if(typeof veApplyGridPattern === 'function') veApplyGridPattern();
  // Alt-topoloji çıkış çipi sınır çerçevesine tutunur; kamera her oynadığında
  // aynı karede yeniden konumlanmazsa çerçeveden kopup kayar.
  if(typeof veAnchorBoundaryChip === 'function') veAnchorBoundaryChip();
  // Alt durum çubuğundaki yakınlaştırma yüzdesini güncelle
  var _zoomStatus = document.getElementById('ve-status-zoom');
  if(_zoomStatus) _zoomStatus.textContent = '%' + Math.round(canvasZoom * 100);
  // Minimap'teki viewport dikdörtgenini tazele (pan/zoom)
  if(typeof veMinimapUpdate === 'function') veMinimapUpdate();
}

// Görünümü mevcut TÜM bileşenlere ortalar ve sığdırır (fit-to-content).
// Otomatik yüklenen/kurulan topolojiler ızgaranın kenarına yapışmasın diye
// kullanılır. Node koordinatlarına DOKUNMAZ — yalnız kamerayı (canvasOffset/
// canvasZoom) ayarlar. maxZoom=1: küçük topolojilerde yakınlaştırmaz, sadece ortalar.
function veFitViewToContent(opts) {
  opts = opts || {};
  if(typeof nodes === 'undefined' || !nodes || nodes.length === 0) return;
  var wrapper = document.getElementById('ve-canvas-wrapper');
  if(!wrapper) return;
  var W = wrapper.clientWidth, H = wrapper.clientHeight;
  if(W < 20 || H < 20) return;
  var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  nodes.forEach(function(n) {
    var w = n.width || 65, h = n.height || 60;
    if(n.x < minX) minX = n.x;
    if(n.y < minY) minY = n.y;
    if(n.x + w > maxX) maxX = n.x + w;
    if(n.y + h > maxY) maxY = n.y + h;
  });
  if(!isFinite(minX)) return;
  var bw = Math.max(1, maxX - minX), bh = Math.max(1, maxY - minY);
  var ccx = (minX + maxX) / 2, ccy = (minY + maxY) / 2;
  var margin = (opts.margin != null) ? opts.margin : 90;   // içerik çevresi boşluk (px)
  var fitZoom = Math.min((W - margin * 2) / bw, (H - margin * 2) / bh);
  var zoom = Math.max(0.2, Math.min(opts.maxZoom || 1, fitZoom));
  // #ve-canvas top/left -3000 + transform-origin center → wrapper (0,0)'a göre:
  //   ekran(cx) = (cx - 3000) * zoom + offset  ⇒  içerik merkezi ekran merkezine.
  var CANVAS_OFFSET = 3000;
  canvasZoom = zoom;
  canvasOffset.x = W / 2 - (ccx - CANVAS_OFFSET) * zoom;
  canvasOffset.y = H / 2 - (ccy - CANVAS_OFFSET) * zoom;
  updateCanvasTransform();
}

// Yakınlaştırmayı %100'e sıfırlar — görünüm MERKEZİNİ sabit tutarak (pan korunur).
// Durum çubuğundaki %zoom göstergesine tıklanınca çağrılır.
function veResetZoom() {
  if(typeof canvasZoom === 'undefined' || canvasZoom === 1) return; // zaten %100
  var wrapper = document.getElementById('ve-canvas-wrapper');
  if(!wrapper) return;
  var W = wrapper.clientWidth, H = wrapper.clientHeight;
  var CANVAS_OFFSET = 3000;
  // Şu an ekran merkezinde duran canvas noktası — zoom=1 sonrası orada kalsın
  var cx = (W / 2 - canvasOffset.x) / canvasZoom + CANVAS_OFFSET;
  var cy = (H / 2 - canvasOffset.y) / canvasZoom + CANVAS_OFFSET;
  canvasZoom = 1;
  canvasOffset.x = W / 2 - (cx - CANVAS_OFFSET);
  canvasOffset.y = H / 2 - (cy - CANVAS_OFFSET);
  updateCanvasTransform();
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
  
  // Başlangıç kamerası: kanvasın MERKEZİ görünümün ortasında (bkz. canvas-space.js).
  // Eski varsayılan {3000,3000} yerel (0,0)'ı sol-üst köşeye koyuyordu; sürüklenen
  // /kurulan her şey ızgaranın köşesinden başlıyordu. Yüklenmiş bir topoloji varsa
  // (proje/sekme geri yüklemesi) kameraya DOKUNMA — yalnız transform'u uygula.
  if(typeof veCameraHome === 'function' && (typeof nodes === 'undefined' || !nodes || !nodes.length)) {
    veCameraHome();
  } else {
    updateCanvasTransform();
  }
  
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
        
        // Seçili node'ları clipboard'a kopyala — DEĞERLER (data) + ad/ayna/boyut
        // dahil derin kopya, ki sonradan kaynak değişse bile yapıştırma bozulmasın.
        clipboard = selectedNodes.map(function(node) {
          return {
            type: node.type,
            x: node.x,
            y: node.y,
            data: node.data ? JSON.parse(JSON.stringify(node.data)) : {},
            customName: node.customName || '',
            mirrored: !!node.mirrored,
            width: node.width,
            height: node.height
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
          // TÜM özellikleriyle klonla (data/değerler dahil) → boş yapıştırma bug'ı biter
          var newNode = veCloneNodeFrom(item, item.x + pasteOffset, item.y + pasteOffset);
          if(newNode) {
            newNodes.push(newNode);
          }
        });
        if(typeof updateAllConnections === 'function') updateAllConnections();
        
        // Yapıştırılan node'ları seç
        newNodes.forEach(function(n) {
          addToSelection(n);
        });
        
        // Bir sonraki yapıştırma için offset'i güncelle
        clipboardOffset.x += pasteOffset;
        clipboardOffset.y += pasteOffset;

        // GERÇEKTEN yapıştırılan sayıyı bildir — maxInstances dolu bileşenler
        // reddedilir; clipboard.length'i raporlamak kullanıcıya yalan söylerdi.
        if(newNodes.length === clipboard.length) {
          showToast(newNodes.length + ' bileşen yapıştırıldı');
        } else if(newNodes.length === 0) {
          showToast('Yapıştırılamadı — bileşen sınırı dolu', 'warning');
        } else {
          showToast(newNodes.length + '/' + clipboard.length + ' bileşen yapıştırıldı — kalanı sınır dolu', 'warning');
        }
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

        var duplicated = 0;
        toDuplicate.forEach(function(node) {
          // TÜM özellikleriyle klonla (data/değerler dahil)
          var newNode = veCloneNodeFrom(node, node.x + 40, node.y + 40);
          if(newNode) {
            duplicated++;
            addToSelection(newNode);
          }
        });
        if(typeof updateAllConnections === 'function') updateAllConnections();

        // GERÇEKTEN kopyalanan sayıyı bildir (bkz. Ctrl+V'deki aynı gerekçe).
        if(duplicated === toDuplicate.length) {
          showToast(duplicated + ' bileşen kopyalandı');
        } else if(duplicated === 0) {
          showToast('Kopyalanamadı — bileşen sınırı dolu', 'warning');
        } else {
          showToast(duplicated + '/' + toDuplicate.length + ' bileşen kopyalandı — kalanı sınır dolu', 'warning');
        }
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
    
    // Escape tuşu - önce üstteki katmanı kapat, sonra seçimi temizle.
    // Uyarı paneli tuvalin üzerine açılan yüzen bir katman olduğu için ilk Esc
    // onu kapatır; seçim ikinci Esc'te temizlenir (alışılmış katman sırası).
    if(e.key === 'Escape') {
      if(typeof veWarningsPanelOpen === 'function' && veWarningsPanelOpen()) {
        veToggleWarnings();
        return;
      }
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

// Yeni bileşen düğümü oluşturur.
// DÖNÜŞ SÖZLEŞMESİ: başarıda oluşturulan düğüm nesnesi, başarısızlıkta null.
// Çağıranlar dönüşü KONTROL ETMELİ — özellikle veCloneNodeFrom, aksi halde
// erken dönüşte nodes[nodes.length-1] alakasız bir düğüme denk gelir ve
// o düğümün verisi ezilir.
function createNode(type, x, y, width, height) {
  var def = componentDefs[type];
  if(!def) return null;

  // maxInstances kontrolü
  if(def.maxInstances) {
    var existingCount = nodes.filter(function(n) { return n.type === type; }).length;
    if(existingCount >= def.maxInstances) {
      // showToast: tanımlı olan bildirim yolu (eskiden burada hiç tanımlanmamış
      // showNotification çağrılıyordu → typeof guard'ı yutuyor, reddetme
      // tamamen sessiz kalıyordu).
      if(typeof showToast === 'function') showToast(def.name + ' topolojide en fazla ' + def.maxInstances + ' tane olabilir.', 'warning');
      return null;
    }
  }
  
  compCounter++;
  var nodeId = 'comp-' + compCounter;
  
  // Varsayılan ölçü tek yerden (components.js veNodeDefaultSize) — sınır
  // çerçevesi de aynı kuralı okur.
  var _ds = veNodeDefaultSize(type);
  var defaultW = _ds.w;
  var defaultH = _ds.h;
  
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
  if(typeof VE_ACC_TYPES !== 'undefined' && VE_ACC_TYPES[type]) {
    if(node.data.accDriveRatio === undefined) node.data.accDriveRatio = VE_ACC_TYPES[type].defRatio;
    if(node.data.accPreset === undefined) node.data.accPreset = '';
  }
  // State kaydet
  if(typeof saveState === 'function') saveState();
  
  // Node HTML oluştur
  var nodeEl = document.createElement('div');
  nodeEl.className = 've-node' + (VE_STANDALONE_TYPES.indexOf(node.type) >= 0 ? ' ve-node--standalone' : '');
  nodeEl.id = nodeId;
  nodeEl.style.left = x + 'px';
  nodeEl.style.top = y + 'px';
  nodeEl.style.width = node.width + 'px';
  nodeEl.setAttribute('data-type', type);
  
  var html = '<div class="ve-node-box" style="width:' + node.width + 'px; height:' + node.height + 'px;">';
  
  // Giriş portları (sayı: tip tanımı VEYA örnek-başı override — nodePortCount)
  var inCount = (typeof nodePortCount==='function') ? nodePortCount(node, 'inputs') : (def.inputs||0);
  if(inCount > 0) {
    for(var pi = 0; pi < inCount; pi++) {
      var inputPortId = inCount === 1 ? 'input' : 'input-' + pi;
      html += '<div class="ve-node-port input" data-node="' + nodeId + '" data-port="' + inputPortId + '" data-port-index="' + pi + '" title="Giriş ' + (pi+1) + '" style="' + vePortStyleAttr(node, inputPortId) + '"></div>';
    }
  }

  // Sembol
  html += def.svg;

  // Çıkış portları
  var outCount = (typeof nodePortCount==='function') ? nodePortCount(node, 'outputs') : (def.outputs||0);
  if(outCount > 0) {
    for(var po = 0; po < outCount; po++) {
      var outputPortId = outCount === 1 ? 'output' : 'output-' + po;
      html += '<div class="ve-node-port output" data-node="' + nodeId + '" data-port="' + outputPortId + '" data-port-index="' + po + '" title="Çıkış ' + (po+1) + '" style="' + vePortStyleAttr(node, outputPortId) + '"></div>';
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

  // Etiket: konumlandırılabilir (üst/alt/sağ/sol) + sağ-tık menüsü. pointerEvents
  // auto → sağ-tık yakalanır; sol-tık nodeEl'e bubble eder (sürükleme bozulmaz).
  var _lblEl = nodeEl.querySelector('.ve-node-label');
  if(_lblEl) {
    _lblEl.style.pointerEvents = 'auto';
    if(typeof applyNodeLabelPos === 'function') applyNodeLabelPos(node, _lblEl);
    _lblEl.addEventListener('contextmenu', function(e) {
      e.preventDefault();
      e.stopPropagation();
      if(typeof showLabelContextMenu === 'function') showLabelContextMenu(e, node, _lblEl);
    });
  }

  // Alt-sistem (modül) düğümü → kutunun içi karta çevrilir. Etiket elemanı
  // KOPYALANMAZ, kartın içine taşınır (bkz. components.js veApplyModuleCard) →
  // yeniden adlandırma yolları aynen çalışmaya devam eder.
  if(typeof veApplyModuleCard === 'function') veApplyModuleCard(nodeEl, node);
  // FEAD kasnağı → temas tarafı / sürücü rozeti (bkz. cp-fead.js). Rozet
  // KRİTİK: temas tarafı ters verilirse hesap sessizce başka bir güzergâh
  // çözer; kanvasta görünür olması gözle yakalanmasının tek yolu.
  if(typeof veFeadApplyBadge === 'function') veFeadApplyBadge(nodeEl, node);
  if(typeof veStrApplyBadge === 'function') veStrApplyBadge(nodeEl, node);
  // FEAD Kayış Yolu → kanvasta CANLI ŞEMA kartı (bkz. cp-fead.js
  // veFeadApplyLayoutCard). Girdiler değiştikçe saveState üzerinden tazelenir.
  if(typeof veFeadApplyLayoutCard === 'function') veFeadApplyLayoutCard(nodeEl, node);

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
  
  // Port olayları — bağlantı oluşturma (paylaşılan: veRebuildNodePorts de kullanır)
  nodeEl.querySelectorAll('.ve-node-port').forEach(function(port) {
    veAttachPortConnect(port, node);
  });
  
  // portLayout (ör. Motor ön/sağ/sol) veya kayıtlı taşımalar (portPositions) varsa
  // port DOM'unu ilgili kenarlara yerleştir. Aksi halde klasik davranış (değişmez).
  if((def.portLayout || (node.data && node.data.portPositions)) && typeof updatePortPosition === 'function') {
    nodeEl.querySelectorAll('.ve-node-port').forEach(function(port) {
      updatePortPosition(port, node, port.getAttribute('data-port'));
    });
  }

  document.getElementById('ve-canvas').appendChild(nodeEl);
  // Drop-in animasyonu: yeni bileşen yaylanarak belirir (yalnızca kullanıcı
  // eklemesi; restore/load bu yolu kullanmaz). reduced-motion'da CSS ile kapalı.
  nodeEl.classList.add('ve-node-dropin');
  nodeEl.addEventListener('animationend', function(){ nodeEl.classList.remove('ve-node-dropin'); }, { once:true });
  updateNodeCount();

  // Yeni düğüm topoloji sınır ÇERÇEVESİNİ de büyütmeli. Çerçeve tek yerden
  // tazeleniyordu: updateAllConnections (connections.js). Bırakma (drop) yolu
  // ve palet tıklaması onu ÇAĞIRMIYOR — dolayısıyla bir bileşen eklendiğinde
  // çerçeve olduğu yerde kalıyordu. Bağlanan bileşenlerde fark edilmiyordu,
  // çünkü ilk bağlantı zaten çerçeveyi tazeliyor; PORTU OLMAYAN bileşenler
  // (Sensör Sihirbazı: 0 giriş / 0 çıkış) ise hiç bağlanmadığı için sonsuza
  // kadar çerçevenin dışında kalıyordu (kullanıcı şikâyeti, 2026-08-13).
  // Silme yolu (map.js) ve sürükleme zaten updateAllConnections çağırıyor.
  if(typeof veUpdateBoundary === 'function') veUpdateBoundary();
  if(typeof veMinimapUpdate === 'function') veMinimapUpdate();


  // Bileşeni hemen seç — setTimeout ile DOM render'ın tamamlanmasını garanti et
  var _newNode = node;
  setTimeout(function() {
    clearSelection();
    addToSelection(_newNode);
    // Selection border pozisyonunu tekrar hesapla (render sonrası)
    var el = document.getElementById(_newNode.id);
    if(el) updateNodeHandles(el, _newNode.width, _newNode.height);
  }, 20);

  return node;
}

// İki porta arka arkaya tıklandığında bağlantıyı KUR — ya da NEDEN kurulmadığını
// SÖYLE. Eskiden bu karar iki yerde (createNode kancası ve restoreState kancası)
// ayrı ayrı yazılıydı ve geçersiz çift SESSİZCE yutuluyordu: kullanıcı iki çıkışa
// tıklıyor, hiçbir şey olmuyor, hiçbir mesaj çıkmıyor.
//
// Sessizlik özellikle FEAD'de yanıltıcı: orada port kenarı KOMŞUYA BAKACAK
// şekilde dinamik (bkz. veFeadPortSideFor), yani klasik "giriş solda / çıkış
// sağda" ipucu YOK — kullanıcı hangisinin giriş hangisinin çıkış olduğunu
// konumdan okuyamıyor ve yanlış çifte tıklaması olağan. ÖLÇÜLDÜ: çıkış→çıkış
// tıklamasında ne bağlantı kuruluyordu ne de uyarı çıkıyordu.
function veTryConnectPorts(fromNodeId, fromPort, toNodeId, toPort) {
  if(!fromNodeId || !toNodeId || !fromPort || !toPort) return false;
  if(fromNodeId === toNodeId) {
    if(typeof showToast === 'function')
      showToast('Bir bileşen kendisine bağlanamaz.', 'warning');
    return false;
  }
  var fOut = fromPort.indexOf('output') === 0, tOut = toPort.indexOf('output') === 0;
  if(fOut && !tOut) { createConnection(fromNodeId, toNodeId, fromPort, toPort); return true; }
  if(!fOut && tOut) { createConnection(toNodeId, fromNodeId, toPort, fromPort); return true; }
  if(typeof showToast === 'function')
    showToast(fOut
      ? 'İki ÇIKIŞ portu birbirine bağlanmaz — çıkışı karşı bileşenin GİRİŞ portuna bağlayın.'
      : 'İki GİRİŞ portu birbirine bağlanmaz — girişe karşı bileşenin ÇIKIŞ portundan gelin.',
      'warning');
  return false;
}

// Bir port DOM elemanına bağlantı-oluşturma (tıkla-bağla) dinleyicilerini ekler.
// createNode + veRebuildNodePorts ortak kullanır (davranış birebir aynı).
function veAttachPortConnect(port, node) {
  port.addEventListener('mousedown', function(e) { e.stopPropagation(); });
  port.addEventListener('click', function(e) {
    if(e.button !== 0) return;
    e.stopPropagation();
    e.preventDefault();
    var portType = this.getAttribute('data-port');
    var portNodeId = this.getAttribute('data-node');
    if(!isConnecting) {
      isConnecting = true;
      connectingFrom = { nodeId: portNodeId, port: portType, element: this, node: node };
      this.style.background = 'var(--accent-primary)';
      this.style.transform = 'scale(1.5)';
      var svg = document.getElementById('ve-connections-layer');
      var portPos = getPortPosition(node, portType);
      tempLine = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      tempLine.setAttribute('class', 've-connection-temp');
      tempLine.setAttribute('d', 'M ' + portPos.x + ' ' + portPos.y + ' L ' + portPos.x + ' ' + portPos.y);
      tempLine.addEventListener('click', function(ev) { ev.stopPropagation(); cleanupTempLine(); });
      svg.appendChild(tempLine);
      if(node.type === 'sensor') { updateAllConnections(); }
    } else {
      veTryConnectPorts(connectingFrom.nodeId, connectingFrom.port, portNodeId, portType);
      if(connectingFrom.element) {
        connectingFrom.element.style.background = '';
        connectingFrom.element.style.transform = '';
      }
      cleanupTempLine();
    }
  });
}

// Bir düğümün port DOM'unu GÜNCEL port sayısına göre yeniden kurar (ekle/kaldır
// sonrası). Bağlantı dinleyicileri + port menüsü yeniden bağlanır, kayıtlı kenarlar
// (portPositions / portLayout) uygulanır, bağlı portlar işaretlenir.
function veRebuildNodePorts(node) {
  var nodeEl = document.getElementById(node.id);
  if(!nodeEl) return;
  var box = nodeEl.querySelector('.ve-node-box');
  if(!box) return;
  box.querySelectorAll('.ve-node-port').forEach(function(p){ p.remove(); });
  function mk(cls, portId, idx, titleBase) {
    var d = document.createElement('div');
    d.className = 've-node-port ' + cls;
    d.setAttribute('data-node', node.id);
    d.setAttribute('data-port', portId);
    d.setAttribute('data-port-index', idx);
    d.setAttribute('title', titleBase + ' ' + (idx + 1));
    box.appendChild(d);
    enablePortContextMenu(d, node, portId);
    veAttachPortConnect(d, node);
    updatePortPosition(d, node, portId);
  }
  var inC = nodePortCount(node, 'inputs');
  for(var i = 0; i < inC; i++) mk('input', inC === 1 ? 'input' : 'input-' + i, i, 'Giriş');
  var outC = nodePortCount(node, 'outputs');
  for(var o = 0; o < outC; o++) mk('output', outC === 1 ? 'output' : 'output-' + o, o, 'Çıkış');
  connections.forEach(function(c){
    if(c.from === node.id) { var pe = box.querySelector('.ve-node-port[data-port="' + c.fromPort + '"]'); if(pe) pe.classList.add('connected'); }
    if(c.to === node.id)   { var pt = box.querySelector('.ve-node-port[data-port="' + c.toPort + '"]'); if(pt) pt.classList.add('connected'); }
  });
}

// Bir düğümü TÜM özellikleriyle klonlar: createNode + kopyalanan veri/ad/ayna/boyut
// + port ve etiket düzeni + DOM tazeleme. Kopyala-Yapıştır ve Ctrl+D bunu kullanır
// → yapıştırılan bileşenin DEĞERLERİ (takoz konum/rijitlik, kütle/CG vb.) kaybolmaz.
// src: canlı düğüm VEYA clipboard snapshot'ı ({type,x,y,data,customName,mirrored,width,height}).
// Master bayrakları (isMasterWheel/isMasterDiff) KOPYALANMAZ — topolojide tekil olmalı.
function veCloneNodeFrom(src, x, y) {
  if(!src || typeof createNode !== 'function') return null;
  // createNode'un DÖNÜŞÜNÜ kullan — nodes[nodes.length-1] DEĞİL. createNode
  // maxInstances dolduğunda null döner; dizinin sonuna bakmak o durumda
  // ALAKASIZ bir düğüm seçer ve aşağıdaki n.data ataması o düğümün verisini
  // sessizce yok eder (Ctrl+D / yapıştır ile tetiklenebilir veri kaybı).
  var n = createNode(src.type, x, y);
  if(!n) return null;
  n.data = src.data ? JSON.parse(JSON.stringify(src.data)) : {};
  if(src.customName) n.customName = src.customName;
  if(src.mirrored) n.mirrored = true;
  if(src.width) n.width = src.width;
  if(src.height) n.height = src.height;

  var el = (typeof document !== 'undefined') ? document.getElementById(n.id) : null;
  if(el) {
    var box = el.querySelector('.ve-node-box');
    if(box) {
      if(src.width) box.style.width = n.width + 'px';
      if(src.height) box.style.height = n.height + 'px';
      // Yansıma yalnız SEMBOLE (bkz. .ve-node-box.ve-mirrored > svg): kutunun
      // tamamı çevrilseydi portlar bir kez daha yansır, bağlantı ucundan kopardı.
      box.classList.toggle('ve-mirrored', !!n.mirrored);
    }
    if(src.width) el.style.width = n.width + 'px';
    if((src.width || src.height) && typeof updateNodeHandles === 'function') updateNodeHandles(el, n.width, n.height);
    var lbl = el.querySelector('.ve-node-label');
    if(lbl) lbl.textContent = n.customName || (componentDefs[n.type] && componentDefs[n.type].name) || n.type;
    if(typeof veRebuildNodePorts === 'function') veRebuildNodePorts(n);   // portOverride/portPositions uygula
    if(typeof applyNodeLabelPos === 'function') applyNodeLabelPos(n);      // labelPos uygula
  }
  return n;
}

function createConnection(fromNodeId, toNodeId, fromPort, toPort) {
  fromPort = fromPort || 'output';
  toPort = toPort || 'input';
  
  // Aynı bağlantı var mı kontrol et
  var exists = connections.some(function(c) {
    return c.from === fromNodeId && c.to === toNodeId && c.fromPort === fromPort && c.toPort === toPort;
  });
  if(exists) return;

  // ── Aksesuar bağlantı-tipi doğrulaması ──
  // Motor'un ön portları (input-0/1/2) yalnız eşleşen aksesuar tipini kabul eder;
  // aksesuar çıkışı da yalnız Motor'un aksesuar portuna gider. (Yükleme yolu
  // createConnection'ı atlar → kayıtlı topolojiler reddedilmez.)
  if(typeof VE_ACC_PORT_MAP !== 'undefined') {
    var _fromNode = nodes.find(function(n){ return n.id === fromNodeId; });
    var _toNode = nodes.find(function(n){ return n.id === toNodeId; });
    var _expectAcc = (_toNode && _toNode.type === 'engine') ? VE_ACC_PORT_MAP[toPort] : null;
    var _fromIsAcc = (typeof veAccIsAccessoryType === 'function') && _fromNode && veAccIsAccessoryType(_fromNode.type);
    if(_expectAcc) {
      if(!_fromNode || _fromNode.type !== _expectAcc) {
        var _lbl = (typeof VE_ACC_TYPES !== 'undefined' && VE_ACC_TYPES[_expectAcc]) ? VE_ACC_TYPES[_expectAcc].label : _expectAcc;
        if(typeof showToast === 'function') showToast('Bu port yalnızca "' + _lbl + '" bileşenine bağlanır.', 'error');
        return;
      }
    } else if(_fromIsAcc) {
      if(typeof showToast === 'function') showToast(VE_ACC_TYPES[_fromNode.type].label + ' yalnızca Motor\'un ön aksesuar portuna bağlanır.', 'error');
      return;
    }
  }

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

  // Aksesuar bağlandıysa → Motor'un net-tork modelini güncelle
  if(typeof VE_ACC_PORT_MAP !== 'undefined' && VE_ACC_PORT_MAP[toPort] && typeof veSyncEngineAccessories === 'function') {
    var _engN = nodes.find(function(n){ return n.id === toNodeId && n.type === 'engine'; });
    if(_engN) {
      veSyncEngineAccessories(_engN);
      if(typeof updateVENetChart === 'function') { try { updateVENetChart(_engN.id); } catch(e){} }
    }
    if(typeof veSolverValidate === 'function' && document.getElementById('ve-solver-validation')) { try { veSolverValidate(); } catch(e){} }
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

