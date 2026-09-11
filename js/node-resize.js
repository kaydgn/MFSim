// ============================================================================
// NODE RESIZE SİSTEMİ
// ============================================================================
var isResizing = false;
var resizeNode = null;
var resizeHandle = '';
var resizeStart = {x: 0, y: 0, width: 0, height: 0, nodeX: 0, nodeY: 0};

function addResizeHandles(nodeEl, node) {
  var handles = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'];
  
  handles.forEach(function(h) {
    var handle = document.createElement('div');
    handle.className = 've-resize-handle ve-resize-' + h;
    handle.setAttribute('data-handle', h);
    handle.addEventListener('mousedown', function(e) {
      e.stopPropagation();
      startResize(e, node, h);
    });
    nodeEl.querySelector('.ve-node-box').appendChild(handle);
  });
}

function startResize(e, node, handle) {
  isResizing = true;
  resizeNode = node;
  resizeHandle = handle;
  resizeStart = {
    x: e.clientX,
    y: e.clientY,
    width: node.width || 65,
    height: node.height || 60,
    nodeX: node.x,
    nodeY: node.y
  };
  
  saveState();
  
  document.addEventListener('mousemove', doResize);
  document.addEventListener('mouseup', stopResize);
}

// ── EN KÜÇÜK ÖLÇÜ TİPİN KENDİSİNDEN ────────────────────────────────────────
//
// Genel taban 50×50'ydi ve bu, İÇERİĞİ OLAN bir kart için anlamsız: Kayış
// Tablosu 130 px yüksekliğe indirildiğinde yapışkan başlık ile Σ satırı
// (50 + 24 px) gövde için yer bırakmıyor — ALTI SATIRIN ALTISI DA görünmez
// oluyor, ama Σ satırı hâlâ 663,4 · 1048,7 yazıyor. Yani kart boş görünüyor
// ve boş OLMADIĞINI yalnız toplamlar söylüyor: sessiz ve yanıltıcı.
// Genişlikte aynısı: 560 px'e daraltılınca on bir sütunun altısı kayıyor ve
// ölçülen yatay kaydırma çubuğu 0 px yer kaplıyor — yani kaybın işareti YOK.
//
// Bu yüzden ölçünün tabanını TİP söyler (`componentDefs.minWidth/minHeight`);
// beyan etmeyen tip eski 50×50 tabanında kalır.
function veNodeMinSize(node) {
  var def = (node && node.type && typeof componentDefs !== 'undefined')
    ? componentDefs[node.type] : null;
  if(!def && node && node.def) def = node.def;
  return { w: (def && def.minWidth) || 50, h: (def && def.minHeight) || 50 };
}

function doResize(e) {
  if(!isResizing || !resizeNode) return;
  
  var dx = (e.clientX - resizeStart.x) / canvasZoom;
  var dy = (e.clientY - resizeStart.y) / canvasZoom;
  
  var newWidth = resizeStart.width;
  var newHeight = resizeStart.height;
  var newX = resizeStart.nodeX;
  var newY = resizeStart.nodeY;
  var enAz = veNodeMinSize(resizeNode);
  
  // Handle'a göre boyut ve pozisyon hesapla
  if(resizeHandle.includes('e')) {
    newWidth = Math.max(enAz.w, resizeStart.width + dx);
  }
  if(resizeHandle.includes('w')) {
    newWidth = Math.max(enAz.w, resizeStart.width - dx);
    newX = resizeStart.nodeX + (resizeStart.width - newWidth);
  }
  if(resizeHandle.includes('s')) {
    newHeight = Math.max(enAz.h, resizeStart.height + dy);
  }
  if(resizeHandle.includes('n')) {
    newHeight = Math.max(enAz.h, resizeStart.height - dy);
    newY = resizeStart.nodeY + (resizeStart.height - newHeight);
  }
  
  // Hizalama kontrolü - kenar snap
  var snapThreshold = 6;
  var guides = {vertical: [], horizontal: []};
  
  nodes.forEach(function(other) {
    if(other.id === resizeNode.id) return;
    var ow = other.width || 65, oh = other.height || 60;
    
    // Sağ kenar hizalama (e, se, ne handle)
    if(resizeHandle.includes('e')) {
      if(Math.abs((newX + newWidth) - (other.x + ow)) < snapThreshold) {
        newWidth = (other.x + ow) - newX;
        guides.vertical.push(other.x + ow);
      }
      if(Math.abs((newX + newWidth) - other.x) < snapThreshold) {
        newWidth = other.x - newX;
        guides.vertical.push(other.x);
      }
    }
    // Sol kenar
    if(resizeHandle.includes('w')) {
      if(Math.abs(newX - other.x) < snapThreshold) {
        var diff = newX - other.x;
        newX = other.x;
        newWidth += diff;
        guides.vertical.push(other.x);
      }
    }
    // Alt kenar
    if(resizeHandle.includes('s')) {
      if(Math.abs((newY + newHeight) - (other.y + oh)) < snapThreshold) {
        newHeight = (other.y + oh) - newY;
        guides.horizontal.push(other.y + oh);
      }
    }
    // Üst kenar
    if(resizeHandle.includes('n')) {
      if(Math.abs(newY - other.y) < snapThreshold) {
        var diff2 = newY - other.y;
        newY = other.y;
        newHeight += diff2;
        guides.horizontal.push(other.y);
      }
    }
  });
  
  // Guide çizgilerini göster
  showAlignmentGuides(guides);

  // KENAR YAPIŞMASI TABANI EZEMEZ. Snap, genişliği komşunun kenarına
  // çekiyor ve bu hesap tabandan habersiz: yakınında dar bir düğüm olan bir
  // kart, snap eşiğine girdiği anda tabanın altına düşerdi.
  newWidth = Math.max(enAz.w, newWidth);
  newHeight = Math.max(enAz.h, newHeight);
  
  resizeNode.width = newWidth;
  resizeNode.height = newHeight;
  resizeNode.x = newX;
  resizeNode.y = newY;
  
  // DOM güncelle
  var nodeEl = document.getElementById(resizeNode.id);
  if(nodeEl) {
    nodeEl.style.left = newX + 'px';
    nodeEl.style.top = newY + 'px';
    nodeEl.style.width = newWidth + 'px';
    var box = nodeEl.querySelector('.ve-node-box');
    if(box) {
      box.style.width = newWidth + 'px';
      box.style.height = newHeight + 'px';
    }
    // Handle ve border pozisyonlarını güncelle
    updateNodeHandles(nodeEl, newWidth, newHeight);
  }
  
  updateAllConnections();
}

// Handle ve selection border pozisyonlarını güncelle
function updateNodeHandles(nodeEl, width, height) {
  var offset = 10; // Bileşenden uzaklık
  // CSS'teki .ve-resize-handle ölçüsüyle AYNI olmalı (keskin sadelik geçişinde
  // 10px'ten 7px'e indi); burası konumlandırmayı o ölçüye göre hesaplıyor.
  var handleSize = 7;
  var halfHandle = handleSize / 2;
  
  // Küçük bileşenler (sensör, sonlandırıcı) için daha geniş offset
  var nodeType = nodeEl.getAttribute('data-type');
  var isTiny = (nodeType === 'sensor' || nodeType === 'terminator');
  var borderOffset = isTiny ? 14 : offset;
  
  // Selection border
  var border = nodeEl.querySelector('.ve-selection-border');
  if(border) {
    border.style.top = (-borderOffset) + 'px';
    border.style.left = (-borderOffset) + 'px';
    border.style.width = (width + borderOffset * 2) + 'px';
    border.style.height = (height + borderOffset * 2) + 'px';
  }
  
  // Köşe handle'ları
  var nw = nodeEl.querySelector('.ve-resize-nw');
  var ne = nodeEl.querySelector('.ve-resize-ne');
  var sw = nodeEl.querySelector('.ve-resize-sw');
  var se = nodeEl.querySelector('.ve-resize-se');
  
  if(nw) { nw.style.top = (-offset - halfHandle) + 'px'; nw.style.left = (-offset - halfHandle) + 'px'; }
  if(ne) { ne.style.top = (-offset - halfHandle) + 'px'; ne.style.left = (width + offset - halfHandle) + 'px'; }
  if(sw) { sw.style.top = (height + offset - halfHandle) + 'px'; sw.style.left = (-offset - halfHandle) + 'px'; }
  if(se) { se.style.top = (height + offset - halfHandle) + 'px'; se.style.left = (width + offset - halfHandle) + 'px'; }
  
  // Kenar handle'ları
  var n = nodeEl.querySelector('.ve-resize-n');
  var s = nodeEl.querySelector('.ve-resize-s');
  var e = nodeEl.querySelector('.ve-resize-e');
  var w = nodeEl.querySelector('.ve-resize-w');
  
  if(n) { n.style.top = (-offset - halfHandle) + 'px'; n.style.left = (width / 2 - halfHandle) + 'px'; }
  if(s) { s.style.top = (height + offset - halfHandle) + 'px'; s.style.left = (width / 2 - halfHandle) + 'px'; }
  if(e) { e.style.top = (height / 2 - halfHandle) + 'px'; e.style.left = (width + offset - halfHandle) + 'px'; }
  if(w) { w.style.top = (height / 2 - halfHandle) + 'px'; w.style.left = (-offset - halfHandle) + 'px'; }
}

function stopResize() {
  if(isResizing) showAlignmentGuides(null);
  var bittiMi = isResizing;
  isResizing = false;
  resizeNode = null;
  document.removeEventListener('mousemove', doResize);
  document.removeEventListener('mouseup', stopResize);

  // ÖLÇÜYE GÖRE YENİDEN ÇİZİLMESİ GEREKEN KARTLAR (Kayış Yolu) burada tazelenir.
  // Kart bir SVG ve viewBox'ı düğümün ölçüsünden üretiliyor; yeniden çizilmezse
  // yeni kutuya ESKİ çizim ölçeklenerek oturuyor: en-boy oranı değiştiyse boş
  // bantlar, yazılar ve çizgi kalınlıkları orantısız. Kullanıcı bunu ancak
  // başka bir alana dokunup saveState'i tetikleyince düzelmiş görüyordu.
  //
  // saveState BURADA ÇAĞRILMAZ: yığına ön-durum zaten startResize'da kondu,
  // ikinci bir çağrı tek bir yeniden boyutlandırma için iki geri-al adımı olurdu.
  // Kart yokken fonksiyon hiçbir şey yapmıyor, yani diğer modüllerde bedava.
  if(bittiMi && typeof veFeadRefreshLayoutCards === 'function') veFeadRefreshLayoutCards();
}

