// ============================================================================
// ANNOTATIONS — Gruplama Çerçeveleri ve Yazı Etiketleri
// ============================================================================
var annotations = [];
var annotCounter = 0;
var selectedAnnotations = [];

// ── Annotation Oluşturma ──
function createAnnotation(type, x, y, opts) {
  opts = opts || {};
  annotCounter++;
  var id = 'annot-' + annotCounter;

  var annot = {
    id: id,
    type: type,
    x: x,
    y: y,
    width: opts.width || (type === 'frame' ? 250 : 120),
    height: opts.height || (type === 'frame' ? 150 : 30),
    text: opts.text || (type === 'frame' ? 'Grup' : 'Yazı'),
    color: opts.color || (type === 'frame' ? 'var(--text-muted)' : 'var(--text-secondary)'),
    fontSize: opts.fontSize || (type === 'text' ? 13 : 11)
  };

  annotations.push(annot);
  renderAnnotation(annot);
  if(typeof saveState === 'function') saveState();
  return annot;
}

// ── DOM Render ──
function renderAnnotation(annot) {
  var canvas = document.getElementById('ve-canvas');
  if(!canvas) return;

  var el = document.createElement('div');
  el.className = 've-annotation ve-annotation-' + annot.type;
  el.id = annot.id;
  el.style.left = annot.x + 'px';
  el.style.top = annot.y + 'px';

  if(annot.type === 'frame') {
    el.style.width = annot.width + 'px';
    el.style.height = annot.height + 'px';
    el.style.borderColor = annot.color;
    el.innerHTML =
      '<div class="ve-annotation-label" style="color:' + annot.color + '; font-size:' + annot.fontSize + 'px;">' +
        escapeHtml(annot.text) +
      '</div>' +
      '<div class="ve-annotation-drag" title="Sürükle">✥</div>' +
      '<div class="ve-annotation-resize" data-annot="' + annot.id + '"></div>';
  } else {
    el.style.color = annot.color;
    el.innerHTML =
      '<span class="ve-annotation-content" style="font-size:' + annot.fontSize + 'px;">' +
        escapeHtml(annot.text) +
      '</span>';
  }

  // SVG bağlantı katmanından sonra ekle (node'ların arkasında)
  var svgLayer = canvas.querySelector('.ve-connections-layer');
  if(svgLayer && svgLayer.nextSibling) {
    canvas.insertBefore(el, svgLayer.nextSibling);
  } else {
    canvas.appendChild(el);
  }

  setupAnnotationInteractions(el, annot);
}

function escapeHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ── Etkileşimler (sürükleme, boyutlandırma, düzenleme) ──
function setupAnnotationInteractions(el, annot) {
  var isDragging = false;
  var dragStart = {x: 0, y: 0};

  // Frame: sürükleme sadece drag handle ve label'dan başlar
  // Text: tüm elemandan sürüklenebilir (zaten küçük)
  var dragTargetSelector = annot.type === 'frame'
    ? '.ve-annotation-drag, .ve-annotation-label'
    : null;

  el.addEventListener('mousedown', function(e) {
    if(e.target.classList.contains('ve-annotation-resize')) return;
    if(e.button !== 0) return;

    // Frame ise sadece drag handle veya label'dan sürükleme başlasın
    if(dragTargetSelector && !e.target.closest(dragTargetSelector)) return;

    isDragging = true;
    dragStart = {x: e.clientX - annot.x * canvasZoom, y: e.clientY - annot.y * canvasZoom};

    if(!e.ctrlKey) {
      clearSelection();
      clearAnnotationSelection();
    }
    selectAnnotation(annot);

    e.stopPropagation();
    e.preventDefault();
  });

  var onMove = function(e) {
    if(!isDragging) return;
    var newX = (e.clientX - dragStart.x) / canvasZoom;
    var newY = (e.clientY - dragStart.y) / canvasZoom;

    // Seçili tüm annotasyonları taşı
    var dx = newX - annot.x;
    var dy = newY - annot.y;
    selectedAnnotations.forEach(function(a) {
      a.x += dx;
      a.y += dy;
      var ael = document.getElementById(a.id);
      if(ael) {
        ael.style.left = a.x + 'px';
        ael.style.top = a.y + 'px';
      }
    });
  };

  var onUp = function() {
    if(isDragging) {
      isDragging = false;
      if(typeof saveState === 'function') saveState();
    }
  };

  document.addEventListener('mousemove', onMove);
  document.addEventListener('mouseup', onUp);

  // Çift tıklama → metin düzenleme (frame: label üzerinden, text: tüm eleman)
  var dblTarget = (annot.type === 'frame') ? el.querySelector('.ve-annotation-label') : el;
  if(dblTarget) {
    dblTarget.addEventListener('dblclick', function(e) {
      e.stopPropagation();
      e.preventDefault();
      editAnnotationText(annot);
    });
  }

  // Boyutlandırma (sadece frame)
  if(annot.type === 'frame') {
    var resizeHandle = el.querySelector('.ve-annotation-resize');
    if(resizeHandle) {
      var isResizing = false;
      var resizeStart = {x: 0, y: 0, w: 0, h: 0};

      resizeHandle.addEventListener('mousedown', function(e) {
        e.stopPropagation();
        e.preventDefault();
        isResizing = true;
        resizeStart = {x: e.clientX, y: e.clientY, w: annot.width, h: annot.height};
      });

      document.addEventListener('mousemove', function(e) {
        if(!isResizing) return;
        annot.width = Math.max(80, resizeStart.w + (e.clientX - resizeStart.x) / canvasZoom);
        annot.height = Math.max(40, resizeStart.h + (e.clientY - resizeStart.y) / canvasZoom);
        el.style.width = annot.width + 'px';
        el.style.height = annot.height + 'px';
      });

      document.addEventListener('mouseup', function() {
        if(isResizing) {
          isResizing = false;
          if(typeof saveState === 'function') saveState();
        }
      });
    }
  }

  // Sağ tık → bağlam menüsü (frame: label ve drag handle üzerinden, text: tüm eleman)
  var ctxTargets = annot.type === 'frame'
    ? el.querySelectorAll('.ve-annotation-label, .ve-annotation-drag')
    : [el];
  Array.prototype.forEach.call(ctxTargets, function(target) {
    target.addEventListener('contextmenu', function(e) {
      e.preventDefault();
      e.stopPropagation();
      showAnnotationContextMenu(e, annot);
    });
  });
}

// ── Metin Düzenleme (inline) ──
function editAnnotationText(annot) {
  var el = document.getElementById(annot.id);
  if(!el) return;

  var textEl = el.querySelector('.ve-annotation-label, .ve-annotation-content');
  if(!textEl) return;

  // Input oluştur
  var input = document.createElement('input');
  input.type = 'text';
  input.value = annot.text;
  input.className = 've-annotation-edit-input';
  input.style.fontSize = annot.fontSize + 'px';
  input.style.color = annot.color;

  textEl.style.display = 'none';
  el.appendChild(input);
  input.focus();
  input.select();

  var finish = function() {
    var val = input.value.trim();
    if(val) annot.text = val;
    textEl.textContent = annot.text;
    textEl.style.display = '';
    if(input.parentNode) input.remove();
    if(typeof saveState === 'function') saveState();
  };

  input.addEventListener('blur', finish);
  input.addEventListener('keydown', function(e) {
    if(e.key === 'Enter') { e.preventDefault(); input.blur(); }
    if(e.key === 'Escape') { input.value = annot.text; input.blur(); }
    e.stopPropagation();
  });
}

// ── Seçim Sistemi ──
function selectAnnotation(annot) {
  if(selectedAnnotations.indexOf(annot) === -1) {
    selectedAnnotations.push(annot);
  }
  var el = document.getElementById(annot.id);
  if(el) el.classList.add('annot-selected');
}

function clearAnnotationSelection() {
  selectedAnnotations.forEach(function(a) {
    var el = document.getElementById(a.id);
    if(el) el.classList.remove('annot-selected');
  });
  selectedAnnotations = [];
}

function deleteSelectedAnnotations() {
  if(selectedAnnotations.length === 0) return;
  selectedAnnotations.forEach(function(a) {
    var el = document.getElementById(a.id);
    if(el) el.remove();
    annotations = annotations.filter(function(x) { return x.id !== a.id; });
  });
  var count = selectedAnnotations.length;
  selectedAnnotations = [];
  if(typeof saveState === 'function') saveState();
  if(typeof showToast === 'function') showToast(count + ' açıklama silindi');
}

function deleteAnnotation(annot) {
  var el = document.getElementById(annot.id);
  if(el) el.remove();
  annotations = annotations.filter(function(x) { return x.id !== annot.id; });
  selectedAnnotations = selectedAnnotations.filter(function(x) { return x.id !== annot.id; });
  if(typeof saveState === 'function') saveState();
}

// ── Bağlam Menüsü ──
function showAnnotationContextMenu(e, annot) {
  // Önceki menüyü kapat
  var prev = document.getElementById('ve-annot-ctx-menu');
  if(prev) prev.remove();

  var menu = document.createElement('div');
  menu.id = 've-annot-ctx-menu';
  menu.className = 've-file-menu';
  menu.style.cssText = 'position:fixed; left:' + e.clientX + 'px; top:' + e.clientY + 'px; display:block; z-index:999999;';

  var items = '';
  items += '<div class="ve-menu-item" data-action="edit"><span class="mf-ico mf-ico-edit"></span> Metni Düzenle</div>';
  items += '<div class="ve-menu-divider"></div>';

  // Renk seçenekleri
  var colors = [
    {name: 'Gri', value: 'var(--text-muted)'},
    {name: 'Mavi', value: 'var(--accent-primary)'},
    {name: 'Yeşil', value: 'var(--accent-success)'},
    {name: 'Turuncu', value: 'var(--accent-warning)'},
    {name: 'Kırmızı', value: 'var(--accent-danger)'}
  ];
  colors.forEach(function(c) {
    items += '<div class="ve-menu-item" data-action="color" data-color="' + c.value + '">🎨 ' + c.name + '</div>';
  });

  if(annot.type === 'text') {
    items += '<div class="ve-menu-divider"></div>';
    items += '<div class="ve-menu-item" data-action="size-up">🔠 Yazıyı Büyüt</div>';
    items += '<div class="ve-menu-item" data-action="size-down">🔡 Yazıyı Küçült</div>';
  }

  items += '<div class="ve-menu-divider"></div>';
  items += '<div class="ve-menu-item" data-action="delete" style="color:var(--accent-danger);"><span class="mf-ico mf-ico-trash"></span> Sil</div>';

  menu.innerHTML = items;
  document.body.appendChild(menu);

  menu.addEventListener('click', function(ev) {
    var item = ev.target.closest('.ve-menu-item');
    if(!item) return;
    var action = item.getAttribute('data-action');

    if(action === 'edit') {
      editAnnotationText(annot);
    } else if(action === 'color') {
      var color = item.getAttribute('data-color');
      annot.color = color;
      var el = document.getElementById(annot.id);
      if(el) {
        if(annot.type === 'frame') {
          el.style.borderColor = color;
          var label = el.querySelector('.ve-annotation-label');
          if(label) label.style.color = color;
        } else {
          el.style.color = color;
        }
      }
      if(typeof saveState === 'function') saveState();
    } else if(action === 'size-up') {
      annot.fontSize = Math.min(48, annot.fontSize + 2);
      var contentEl = document.getElementById(annot.id);
      if(contentEl) {
        var span = contentEl.querySelector('.ve-annotation-content');
        if(span) span.style.fontSize = annot.fontSize + 'px';
      }
      if(typeof saveState === 'function') saveState();
    } else if(action === 'size-down') {
      annot.fontSize = Math.max(8, annot.fontSize - 2);
      var contentEl2 = document.getElementById(annot.id);
      if(contentEl2) {
        var span2 = contentEl2.querySelector('.ve-annotation-content');
        if(span2) span2.style.fontSize = annot.fontSize + 'px';
      }
      if(typeof saveState === 'function') saveState();
    } else if(action === 'delete') {
      deleteAnnotation(annot);
    }

    menu.remove();
  });

  // Dışarı tıklayınca kapat
  setTimeout(function() {
    document.addEventListener('click', function closeMenu() {
      menu.remove();
      document.removeEventListener('click', closeMenu);
    }, {once: true});
  }, 10);
}

// ── Tüm Annotasyonları Sil (canvas temizlerken) ──
function clearAnnotationDOM() {
  annotations.forEach(function(a) {
    var el = document.getElementById(a.id);
    if(el) el.remove();
  });
}

// ── Annotasyonları Seri/Deseri ──
function serializeAnnotations() {
  return JSON.parse(JSON.stringify(annotations.map(function(a) {
    return {
      id: a.id, type: a.type, x: a.x, y: a.y,
      width: a.width, height: a.height,
      text: a.text, color: a.color, fontSize: a.fontSize
    };
  })));
}

function restoreAnnotations(arr) {
  // Mevcut DOM'u temizle
  clearAnnotationDOM();
  annotations = [];
  selectedAnnotations = [];

  if(!arr || !Array.isArray(arr)) return;

  // annotCounter güncelle
  arr.forEach(function(a) {
    var numMatch = a.id.match(/annot-(\d+)/);
    if(numMatch) {
      var num = parseInt(numMatch[1]);
      if(num > annotCounter) annotCounter = num;
    }
  });

  // Her birini yeniden oluştur
  arr.forEach(function(a) {
    var annot = {
      id: a.id,
      type: a.type,
      x: a.x,
      y: a.y,
      width: a.width || (a.type === 'frame' ? 250 : 120),
      height: a.height || (a.type === 'frame' ? 150 : 30),
      text: a.text || '',
      color: a.color || 'var(--text-muted)',
      fontSize: a.fontSize || (a.type === 'text' ? 13 : 11)
    };
    annotations.push(annot);
    renderAnnotation(annot);
  });
}

// ── Drag-and-drop handler (sidebar'dan canvas'a) ──
document.addEventListener('DOMContentLoaded', function() {
  // Sidebar annotation araçlarına drag event ekle
  document.querySelectorAll('.ve-annotation-tool').forEach(function(tool) {
    tool.addEventListener('dragstart', function(e) {
      e.dataTransfer.setData('annotation-type', this.getAttribute('data-annotation-type'));
    });
  });

  // Canvas'a drop handler
  var canvasWrapper = document.getElementById('ve-canvas-wrapper');
  if(canvasWrapper) {
    canvasWrapper.addEventListener('drop', function(e) {
      var annotType = e.dataTransfer.getData('annotation-type');
      if(!annotType) return; // Normal bileşen drop'u, müdahale etme

      e.preventDefault();
      e.stopPropagation();

      var rect = canvasWrapper.getBoundingClientRect();
      var canvasInitialOffset = 3000;
      var x = (e.clientX - rect.left - canvasOffset.x) / canvasZoom + canvasInitialOffset;
      var y = (e.clientY - rect.top - canvasOffset.y) / canvasZoom + canvasInitialOffset;

      // Frame için biraz offset (sol üst köşe bırakma noktası olsun)
      if(annotType === 'frame') {
        x -= 20;
        y -= 20;
      }

      createAnnotation(annotType, x, y);
    });
  }
});
