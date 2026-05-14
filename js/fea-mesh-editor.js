// ============================================================================
// FEA MESH EDITOR — MODAL PENCERESİ
// ============================================================================
// ANSYS Workbench Mesh deneyimini taklit eden modal pencere:
//   - Header (başlık + kapat)
//   - Toolbar (Mesh Oluştur + Boyut + Presetler + Export)
//   - Split body: SOL (resizable accordion paneli) + SAĞ (3D mesh viewer)
//   - Footer (mesh durumu)
//
// Side panel'de SADECE "Mesh Editörünü Aç" butonu var. Tüm kompleks UI
// (mesh ayarları, kalite metrikleri, heat map, named selections, export)
// burada modal içinde accordion'lar olarak organize edildi.
//
// Public API:
//   veFEAOpenMeshEditor(nodeId)   → modal aç
//   veFEACloseMeshEditor()        → modal kapat
//   veFEAToggleAccordion(key)     → accordion bölümünü aç/kapat
// ============================================================================

var _veFEAEditorActive = null;  // şu an açık olan mesh node ID
var _veFEAEditorOverlay = null;
var _veFEAEditorEscHandler = null;
var _veFEAEditorResizeObserver = null;  // modal viewer için container resize observer
var _veFEAEditorAccordionState = {};  // { sectionKey: true (open) | false (closed) }

// Default accordion durumu (ilk açılışta): Topology + Defaults + Sizing açık.
// Topology en ustte cunku ANSYS workflow: once geometriyi/yuzeyleri gor, sonra mesh.
function _veFEAEditorDefaultAccordionState() {
  return {
    topology: true,
    defaults: true,
    sizing: true,
    inflation: false,
    quality: false,
    namedSel: false,
    display: false,
    statistics: false,
    suggestions: false
  };
}

// ─── Accordion'ları + toolbar'ı yenile (mesh state değişimleri için) ───────
// Modal acikken mesh olusturulduğunda, silindiğinde veya named selection /
// heat map toggle edildiğinde accordion içerikleri "Mesh olusturulduktan
// sonra..." placeholder'ında takılı kalmasin diye tüm accordion body'lerini
// yeniden inşa eder. Accordion expand/collapse state korunur (DOM body
// elementi aynı, sadece içeriği değişir).
function veFEAEditorRefreshAccordions() {
  if (!_veFEAEditorActive || typeof nodes === 'undefined') return;
  var node = nodes.find(function(n) { return n.id === _veFEAEditorActive; });
  if (!node) return;

  var updates = {
    'topology':    _veFEAEditorTopologyHTML(node),
    'defaults':    _veFEAEditorDefaultsHTML(node),
    'sizing':      _veFEAEditorSizingHTML(node),
    'inflation':   _veFEAEditorInflationHTML(node),
    'quality':     _veFEAEditorQualityHTML(node),
    'namedSel':    _veFEAEditorNamedSelHTML(node),
    'display':     _veFEAEditorDisplayHTML(node),
    'statistics':  _veFEAEditorStatisticsHTML(node),
    'suggestions': _veFEAEditorSuggestionsHTML(node)
  };
  Object.keys(updates).forEach(function(k) {
    var body = document.getElementById('ve-fea-acc-body-' + k);
    if (body) body.innerHTML = updates[k];
  });

  // Toolbar — Mesh'i Sil + Export butonları mesh varlığına göre değişir
  var oldToolbar = document.getElementById('ve-fea-mesh-editor-toolbar');
  if (oldToolbar && oldToolbar.parentNode) {
    var newToolbar = _veFEAEditorBuildToolbar(node);
    oldToolbar.parentNode.replaceChild(newToolbar, oldToolbar);
  }

  // Footer — durum (düğüm/eleman/ms) güncellenir
  var oldFooter = document.getElementById('ve-fea-mesh-editor-footer');
  if (oldFooter && oldFooter.parentNode) {
    var newFooter = _veFEAEditorBuildFooter(node);
    oldFooter.parentNode.replaceChild(newFooter, oldFooter);
  }
}

// ─── Modal aç ──────────────────────────────────────────────────────────────
function veFEAOpenMeshEditor(nodeId) {
  if (_veFEAEditorActive) veFEACloseMeshEditor();
  if (typeof nodes === 'undefined') return;
  var node = nodes.find(function(n) { return n.id === nodeId; });
  if (!node || node.type !== 'fea-mesh') return;

  node.data = node.data || {};
  if (!node.data.editorAccordion) node.data.editorAccordion = _veFEAEditorDefaultAccordionState();
  _veFEAEditorAccordionState = node.data.editorAccordion;

  // Overlay
  var overlay = document.createElement('div');
  overlay.id = 've-fea-mesh-editor-overlay';
  overlay.style.cssText = 'position:fixed; inset:0; z-index:100000; background:rgba(0,0,0,0.82); display:flex; align-items:center; justify-content:center; padding:16px; backdrop-filter:blur(4px);';
  overlay.addEventListener('mousedown', function(e) {
    // Sadece overlay'in kendisine tıklandığında kapat (modal içine değil)
    if (e.target === overlay) veFEACloseMeshEditor();
  });

  // Modal
  var modal = document.createElement('div');
  modal.id = 've-fea-mesh-editor-modal';
  modal.style.cssText = 'width:95%; max-width:1700px; min-width:720px; height:92vh; max-height:1000px; background:var(--bg-secondary, #0f1218); border:1px solid var(--border-color, #1c2333); border-radius:0; display:flex; flex-direction:column; overflow:hidden; box-shadow:0 20px 60px rgba(0,0,0,0.6); position:relative;';

  // Header
  var header = _veFEAEditorBuildHeader(node);
  modal.appendChild(header);

  // Toolbar
  var toolbar = _veFEAEditorBuildToolbar(node);
  modal.appendChild(toolbar);

  // Body (split: sol accordion + resize handle + sağ viewer)
  var body = document.createElement('div');
  body.id = 've-fea-mesh-editor-body';
  body.style.cssText = 'flex:1; display:flex; flex-direction:row; min-height:0; overflow:hidden;';

  var leftPanel = _veFEAEditorBuildLeftPanel(node);
  body.appendChild(leftPanel);

  var divider = _veFEAEditorBuildResizeHandle();
  body.appendChild(divider);

  var rightPanel = _veFEAEditorBuildRightPanel(node);
  body.appendChild(rightPanel);

  modal.appendChild(body);

  // Footer
  var footer = _veFEAEditorBuildFooter(node);
  modal.appendChild(footer);

  // Modal kenar resize tutamacları (Rota pattern)
  _veFEAEditorAttachModalResize(modal, overlay);

  overlay.appendChild(modal);
  document.body.appendChild(overlay);
  _veFEAEditorActive = nodeId;
  _veFEAEditorOverlay = overlay;

  // ESC ile kapat
  _veFEAEditorEscHandler = function(e) {
    if (e.key === 'Escape') veFEACloseMeshEditor();
  };
  document.addEventListener('keydown', _veFEAEditorEscHandler);

  // 3D viewer'ı modal canvas'a yedir. Canvas layout'u flexbox tarafından
  // hesaplanmadan Three.js init edersek clientWidth=0 olur → WebGL renderer
  // tiny boyutta kalır → real browser'da context loss / GPU crash ("üzgün yüz").
  // requestAnimationFrame ile layout settle olmasını bekle, gerekirse retry.
  _veFEASafeInitModalViewer(nodeId, 6);
}

function _veFEASafeInitModalViewer(nodeId, retries) {
  if (_veFEAEditorActive !== nodeId) return; // modal kapanmış
  if (typeof veFEAInitMeshViewerForNode !== 'function') return;
  var canvas = document.getElementById('ve-fea-mesh-canvas-' + nodeId);
  if (!canvas) {
    if (retries > 0) {
      requestAnimationFrame(function() { _veFEASafeInitModalViewer(nodeId, retries - 1); });
    }
    return;
  }
  var w = canvas.clientWidth || (canvas.parentElement && canvas.parentElement.clientWidth) || 0;
  var h = canvas.clientHeight || (canvas.parentElement && canvas.parentElement.clientHeight) || 0;
  if ((w < 50 || h < 50) && retries > 0) {
    // Layout henüz hazır değil → bir frame daha bekle
    requestAnimationFrame(function() { _veFEASafeInitModalViewer(nodeId, retries - 1); });
    return;
  }
  // Boyutlar tamamen başarısızsa fallback (modal görünür ama boyut 0 — modal
  // kapalı olabilir veya görüntülenmiyor — sessizce çık)
  if (w < 50 || h < 50) return;

  // Canvas backing-buffer'ı explicit set et — WebGL renderer doğru başlatılsın
  canvas.width = w;
  canvas.height = h;

  try {
    veFEAInitMeshViewerForNode(nodeId);
  } catch (err) {
    console.error('[FEA Mesh Editor] viewer init hatası:', err);
    return;
  }

  // Container resize'larında viewer'ı senkronize et (modal/panel resize)
  if (typeof ResizeObserver !== 'undefined' && canvas.parentElement) {
    if (_veFEAEditorResizeObserver) {
      try { _veFEAEditorResizeObserver.disconnect(); } catch(e) {}
    }
    _veFEAEditorResizeObserver = new ResizeObserver(function() {
      var c = document.getElementById('ve-fea-mesh-canvas-' + nodeId);
      var v = veFEAViewerRegistry[nodeId];
      if (!c || !v || typeof v.resize !== 'function') return;
      var nw = c.clientWidth | 0;
      var nh = c.clientHeight | 0;
      if (nw > 0 && nh > 0) v.resize(nw, nh);
    });
    _veFEAEditorResizeObserver.observe(canvas.parentElement);
  }
}

// ─── Modal kapat ───────────────────────────────────────────────────────────
function veFEACloseMeshEditor() {
  if (!_veFEAEditorActive) return;
  // ResizeObserver disconnect (canvas dispose'undan önce)
  if (_veFEAEditorResizeObserver) {
    try { _veFEAEditorResizeObserver.disconnect(); } catch (e) {}
    _veFEAEditorResizeObserver = null;
  }
  // Viewer dispose — canvas modal'la birlikte kaybolacak
  if (typeof veFEAViewerRegistry !== 'undefined' && veFEAViewerRegistry[_veFEAEditorActive]) {
    try { veFEAViewerRegistry[_veFEAEditorActive].dispose(); } catch (e) {}
    delete veFEAViewerRegistry[_veFEAEditorActive];
  }
  if (_veFEAEditorOverlay && _veFEAEditorOverlay.parentNode) {
    _veFEAEditorOverlay.parentNode.removeChild(_veFEAEditorOverlay);
  }
  if (_veFEAEditorEscHandler) {
    document.removeEventListener('keydown', _veFEAEditorEscHandler);
  }
  _veFEAEditorActive = null;
  _veFEAEditorOverlay = null;
  _veFEAEditorEscHandler = null;
  // Side panel'i tazele (mesh durumu güncellenmiş olabilir)
  if (typeof nodes !== 'undefined' && typeof showNodeProperties === 'function') {
    var node = nodes.find(function(n) { return n.id === arguments[0]; });
    if (node) showNodeProperties(node);
  }
}

// ─── Accordion bölümünü aç/kapat ───────────────────────────────────────────
function veFEAToggleAccordion(sectionKey) {
  if (!_veFEAEditorActive) return;
  _veFEAEditorAccordionState[sectionKey] = !_veFEAEditorAccordionState[sectionKey];
  // node.data'ya persist
  if (typeof nodes !== 'undefined') {
    var node = nodes.find(function(n) { return n.id === _veFEAEditorActive; });
    if (node) {
      node.data = node.data || {};
      node.data.editorAccordion = _veFEAEditorAccordionState;
      if (typeof saveState === 'function') saveState();
    }
  }
  // Sadece tetiklenen bölümün body'sini toggle et — viewer/state korunur
  var body = document.getElementById('ve-fea-acc-body-' + sectionKey);
  var arrow = document.getElementById('ve-fea-acc-arrow-' + sectionKey);
  if (body) body.style.display = _veFEAEditorAccordionState[sectionKey] ? 'block' : 'none';
  if (arrow) arrow.textContent = _veFEAEditorAccordionState[sectionKey] ? '▼' : '▶';
}

// ═══════════════════════════════════════════════════════════════════════════
// HEADER / TOOLBAR / FOOTER builder'ları
// ═══════════════════════════════════════════════════════════════════════════
function _veFEAEditorBuildHeader(node) {
  var header = document.createElement('div');
  header.style.cssText = 'display:flex; align-items:center; justify-content:space-between; padding:10px 16px; background:var(--bg-tertiary); border-bottom:1px solid var(--border-color); flex-shrink:0;';
  var nodeLabel = node.customName || (node.def && node.def.name) || 'Mesh';
  header.innerHTML = '<div style="display:flex; align-items:center; gap:8px;">' +
    '<div style="font-size:0.88rem; font-weight:700; color:var(--text-heading);">🔷 Mesh Editörü</div>' +
    '<div style="font-size:0.62rem; color:var(--text-muted);">— ' + nodeLabel + ' (' + node.id + ')</div>' +
    '<span style="font-size:0.52rem; font-weight:600; color:#b45309; background:#fef3c720; padding:2px 7px; border:1px solid #f59e0b40; letter-spacing:0.03em; text-transform:uppercase;">Faz 3a</span>' +
    '</div>' +
    '<button onclick="veFEACloseMeshEditor()" title="Kapat (ESC)" style="width:30px; height:30px; display:flex; align-items:center; justify-content:center; background:transparent; border:1px solid var(--border-color); cursor:pointer; font-size:1rem; color:var(--text-secondary); transition:all 0.12s;" onmouseover="this.style.background=\'var(--accent-danger)\';this.style.color=\'#fff\';this.style.borderColor=\'var(--accent-danger)\'" onmouseout="this.style.background=\'transparent\';this.style.color=\'var(--text-secondary)\';this.style.borderColor=\'var(--border-color)\'">✕</button>';
  return header;
}

function _veFEAEditorBuildToolbar(node) {
  var d = node.data || {};
  var settings = d.meshSettings || { size: 10 };
  var hasMesh = !!d.meshActive;
  // Upstream geometri var mı?
  var geomOk = false;
  if (typeof veFEAFindUpstreamGeometryNode === 'function') {
    var gn = veFEAFindUpstreamGeometryNode(node.id);
    geomOk = !!(gn && gn.data && gn.data.geometry && gn.data.geometry.type);
  }

  var toolbar = document.createElement('div');
  toolbar.id = 've-fea-mesh-editor-toolbar';
  toolbar.style.cssText = 'display:flex; align-items:center; gap:8px; padding:8px 14px; background:var(--bg-secondary); border-bottom:1px solid var(--border-color); flex-shrink:0; flex-wrap:wrap;';

  // Mesh Oluştur (primary)
  var buildBtnStyle = geomOk
    ? 'background:var(--accent-primary); color:#fff; cursor:pointer;'
    : 'background:var(--bg-tertiary); color:var(--text-muted); cursor:not-allowed;';
  toolbar.innerHTML = '<button ' + (geomOk ? '' : 'disabled ') +
    'onclick="veFEASubmitMeshBuild(\'' + node.id + '\')" style="padding:7px 14px; font-size:0.7rem; font-weight:700; border:1px solid var(--border-color); ' + buildBtnStyle + '">▶ Mesh Oluştur</button>';

  // Mesh boyu input (toolbar'da hızlı erişim)
  toolbar.innerHTML += '<span style="font-size:0.62rem; color:var(--text-muted);">Boyut:</span>' +
    '<input id="ve-fea-mesh-size-' + node.id + '" type="number" min="0.5" max="500" step="0.5" value="' + settings.size + '" style="width:72px; padding:5px 8px; font-size:0.66rem; background:var(--bg-input); color:var(--text-primary); border:1px solid var(--border-color);">' +
    '<span style="font-size:0.6rem; color:var(--text-muted);">mm</span>';

  // Presetler
  toolbar.innerHTML += '<div style="display:flex; gap:0; margin-left:6px;">' +
    '<button onclick="veFEASetMeshSizePreset(\'' + node.id + '\', 20)" style="padding:5px 10px; font-size:0.62rem; background:var(--bg-tertiary); color:var(--text-primary); border:1px solid var(--border-color); cursor:pointer;">Coarse</button>' +
    '<button onclick="veFEASetMeshSizePreset(\'' + node.id + '\', 10)" style="padding:5px 10px; font-size:0.62rem; background:var(--bg-tertiary); color:var(--text-primary); border:1px solid var(--border-color); border-left:none; cursor:pointer;">Medium</button>' +
    '<button onclick="veFEASetMeshSizePreset(\'' + node.id + '\', 5)" style="padding:5px 10px; font-size:0.62rem; background:var(--bg-tertiary); color:var(--text-primary); border:1px solid var(--border-color); border-left:none; cursor:pointer;">Fine</button>' +
    '</div>';

  toolbar.innerHTML += '<span style="flex:1;"></span>';

  // Mesh sil (mesh varsa)
  if (hasMesh) {
    toolbar.innerHTML += '<button onclick="veFEAClearMeshForNode(\'' + node.id + '\')" style="padding:6px 10px; font-size:0.62rem; background:var(--bg-tertiary); color:var(--accent-danger); border:1px solid var(--accent-danger); cursor:pointer;">🗑 Mesh\'i Sil</button>';
  }

  // Export dropdown
  if (hasMesh) {
    toolbar.innerHTML += '<select onchange="if(this.value){veFEAExportMeshForNode(\'' + node.id + '\', this.value); this.value=\'\';}" style="padding:5px 8px; font-size:0.62rem; background:var(--bg-tertiary); color:var(--text-primary); border:1px solid var(--border-color); cursor:pointer;">' +
      '<option value="">📦 Export...</option>' +
      '<option value="abaqus">Abaqus (.inp)</option>' +
      '<option value="nastran">NASTRAN (.nas)</option>' +
      '<option value="vtk">VTK (.vtk)</option>' +
      '</select>';
  }

  return toolbar;
}

function _veFEAEditorBuildFooter(node) {
  var d = node.data || {};
  var metrics = d.meshMetrics;
  var hasMesh = !!(d.meshActive && metrics);
  var footer = document.createElement('div');
  footer.id = 've-fea-mesh-editor-footer';
  footer.style.cssText = 'display:flex; align-items:center; gap:12px; padding:6px 14px; background:var(--bg-tertiary); border-top:1px solid var(--border-color); flex-shrink:0; font-size:0.6rem; color:var(--text-muted);';
  if (hasMesh) {
    var jacStatus = (metrics.jacobian && metrics.jacobian.valid) ? '<span style="color:var(--accent-success, #22c55e);">✓ Geçerli</span>' : (metrics.jacobian ? '<span style="color:var(--accent-danger, #ef4444);">✗ Hatalı</span>' : '');
    footer.innerHTML =
      jacStatus +
      '<span style="opacity:0.4;">│</span>' +
      '<span>' + metrics.nodeCount.toLocaleString('tr-TR') + ' düğüm</span>' +
      '<span style="opacity:0.4;">│</span>' +
      '<span>' + metrics.elementCount.toLocaleString('tr-TR') + ' eleman</span>' +
      '<span style="opacity:0.4;">│</span>' +
      '<span>' + (metrics.computeMs || 0) + ' ms</span>' +
      '<span style="margin-left:auto;">ESC — Kapat</span>';
  } else {
    footer.innerHTML = '<span>Henüz mesh hesaplanmadı</span><span style="margin-left:auto;">ESC — Kapat</span>';
  }
  return footer;
}

// ═══════════════════════════════════════════════════════════════════════════
// SOL PANEL (Accordion'lar)
// ═══════════════════════════════════════════════════════════════════════════
function _veFEAEditorBuildLeftPanel(node) {
  var panel = document.createElement('div');
  panel.id = 've-fea-mesh-editor-left-panel';
  panel.style.cssText = 'flex:0 0 400px; min-width:280px; max-width:720px; overflow-y:auto; overflow-x:hidden; background:var(--bg-primary, #0a0d14); border-right:1px solid var(--border-color);';

  var html = '';
  html += _veFEAEditorAccordionSection('topology',    'Geometri Topolojisi',           _veFEAEditorTopologyHTML(node));
  html += _veFEAEditorAccordionSection('defaults',    'Varsayılanlar',                 _veFEAEditorDefaultsHTML(node));
  html += _veFEAEditorAccordionSection('sizing',      'Boyutlandırma',                 _veFEAEditorSizingHTML(node));
  html += _veFEAEditorAccordionSection('inflation',   'Lokal Yoğunlaştırma / Inflation', _veFEAEditorInflationHTML(node));
  html += _veFEAEditorAccordionSection('quality',     'Kalite Metrikleri (Aspect / Skewness / Açı + Jacobian / Geçerlilik)', _veFEAEditorQualityHTML(node));
  html += _veFEAEditorAccordionSection('namedSel',    'Atanmış Yüzeyler (Düğüm Grupları)', _veFEAEditorNamedSelHTML(node));
  html += _veFEAEditorAccordionSection('display',     'Görünüm Modu',                  _veFEAEditorDisplayHTML(node));
  html += _veFEAEditorAccordionSection('statistics',  'İstatistikler',                 _veFEAEditorStatisticsHTML(node));
  html += _veFEAEditorAccordionSection('suggestions', 'Adaptif İnceltme Önerileri',    _veFEAEditorSuggestionsHTML(node));
  panel.innerHTML = html;
  return panel;
}

function _veFEAEditorAccordionSection(key, title, bodyHTML) {
  var open = _veFEAEditorAccordionState[key];
  var arrow = open ? '▼' : '▶';
  var bodyStyle = 'padding:10px 14px; background:var(--bg-secondary); display:' + (open ? 'block' : 'none') + ';';
  return '' +
    '<div data-acc-section="' + key + '" style="border-bottom:1px solid var(--border-color);">' +
      '<button onclick="veFEAToggleAccordion(\'' + key + '\')" style="display:flex; align-items:center; justify-content:space-between; width:100%; padding:8px 12px; background:var(--bg-tertiary); border:none; border-bottom:1px solid var(--border-color); cursor:pointer; font-size:0.72rem; font-weight:600; color:var(--text-heading); text-align:left;">' +
        '<span>' + title + '</span>' +
        '<span id="ve-fea-acc-arrow-' + key + '" style="font-size:0.6rem; color:var(--text-secondary);">' + arrow + '</span>' +
      '</button>' +
      '<div id="ve-fea-acc-body-' + key + '" style="' + bodyStyle + '">' +
        bodyHTML +
      '</div>' +
    '</div>';
}

// ─── SAĞ PANEL (3D Viewer) ─────────────────────────────────────────────────
function _veFEAEditorBuildRightPanel(node) {
  var panel = document.createElement('div');
  panel.id = 've-fea-mesh-editor-right-panel';
  panel.style.cssText = 'flex:1; min-width:300px; display:flex; flex-direction:column; background:#0a0a0a;';
  panel.innerHTML =
    // Viewer toolbar (üst, mini)
    '<div style="display:flex; align-items:center; gap:6px; padding:6px 10px; background:var(--bg-secondary); border-bottom:1px solid var(--border-color); flex-shrink:0;">' +
      '<button onclick="veFEAFitPreviewForNode(\'' + node.id + '\')" style="padding:5px 10px; font-size:0.62rem; background:var(--bg-tertiary); color:var(--text-primary); border:1px solid var(--border-color); cursor:pointer;">⛶ Sığdır</button>' +
      '<span style="font-size:0.58rem; color:var(--text-muted); margin-left:8px;">Sol drag: orbit · Sağ drag: pan · Wheel: zoom</span>' +
    '</div>' +
    // Canvas — mevcut viewer ID konvansiyonunu kullan
    '<div style="flex:1; position:relative; min-height:0; background:#1a1a1a;">' +
      '<canvas id="ve-fea-mesh-canvas-' + node.id + '" style="display:block; width:100%; height:100%; cursor:grab;"></canvas>' +
    '</div>';
  return panel;
}

// ─── DİKEY RESIZE HANDLE (sol panel genişliği) ─────────────────────────────
function _veFEAEditorBuildResizeHandle() {
  var handle = document.createElement('div');
  handle.id = 've-fea-mesh-editor-divider';
  handle.style.cssText = 'flex:0 0 5px; cursor:ew-resize; background:var(--border-color); transition:background 0.15s;';
  handle.addEventListener('mouseenter', function() { this.style.background = 'rgba(59,130,246,0.6)'; });
  handle.addEventListener('mouseleave', function() { this.style.background = 'var(--border-color)'; });
  handle.addEventListener('mousedown', function(e) {
    e.preventDefault();
    var startX = e.clientX;
    var leftPanel = document.getElementById('ve-fea-mesh-editor-left-panel');
    if (!leftPanel) return;
    var startW = leftPanel.offsetWidth;
    function onMove(ev) {
      var dx = ev.clientX - startX;
      var newW = Math.max(280, Math.min(720, startW + dx));
      leftPanel.style.flexBasis = newW + 'px';
      // Viewer'a tekrar size signal at
      if (typeof veFEAViewerRegistry !== 'undefined' && _veFEAEditorActive && veFEAViewerRegistry[_veFEAEditorActive]) {
        var v = veFEAViewerRegistry[_veFEAEditorActive];
        var canvas = document.getElementById('ve-fea-mesh-canvas-' + _veFEAEditorActive);
        if (canvas && v.resize) v.resize(canvas.clientWidth || 1, canvas.clientHeight || 1);
      }
    }
    function onUp() {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    }
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  });
  return handle;
}

// Modal kenar resize (sol/sağ tutamaçlar — Rota pattern)
function _veFEAEditorAttachModalResize(modal, overlay) {
  var handleCSS = 'position:absolute; top:0; width:6px; height:100%; cursor:ew-resize; z-index:10; background:transparent; transition:background 0.15s;';
  var leftH = document.createElement('div');
  leftH.style.cssText = handleCSS + 'left:-3px;';
  var rightH = document.createElement('div');
  rightH.style.cssText = handleCSS + 'right:-3px;';
  [leftH, rightH].forEach(function(h) {
    h.addEventListener('mouseenter', function() { this.style.background = 'rgba(59,130,246,0.5)'; });
    h.addEventListener('mouseleave', function() { this.style.background = 'transparent'; });
  });
  function startResize(e, side) {
    e.preventDefault();
    e.stopPropagation();
    var startX = e.clientX;
    var startW = modal.offsetWidth;
    var overlayW = overlay.clientWidth;
    function onMove(ev) {
      var dx = ev.clientX - startX;
      var newW = side === 'left' ? startW - dx : startW + dx;
      newW = Math.max(720, Math.min(newW, overlayW - 32));
      modal.style.width = newW + 'px';
      modal.style.maxWidth = newW + 'px';
    }
    function onUp() {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    }
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }
  leftH.addEventListener('mousedown', function(e) { startResize(e, 'left'); });
  rightH.addEventListener('mousedown', function(e) { startResize(e, 'right'); });
  modal.appendChild(leftH);
  modal.appendChild(rightH);
}

// ═══════════════════════════════════════════════════════════════════════════
// ACCORDION İÇERİK BUILDER'LARI
// ═══════════════════════════════════════════════════════════════════════════
// (Mevcut cp-fea.js'teki control HTML'leri buraya taşındı)

// Face label resolver — kullanıcı custom rename yaptıysa onu, yoksa topology
// default label'ını döndür. ANSYS'de kullanıcı her yüze anlamlı isim verebilir
// (örn. "Sabit Mesnet Yüzü", "Yük Uygulanan Yüz").
function _veFEAResolveFaceLabel(node, faceId, defaultLabel) {
  if (!node || !node.data || !node.data.faceRenames) return defaultLabel;
  return node.data.faceRenames[faceId] || defaultLabel;
}

// Face rename bridge — UI'dan prompt ile çağrılır.
function veFEARenameGeometryFace(meshNodeId, faceId, defaultLabel) {
  if (typeof nodes === 'undefined') return;
  var meshNode = nodes.find(function(n) { return n.id === meshNodeId; });
  if (!meshNode) return;
  meshNode.data = meshNode.data || {};
  meshNode.data.faceRenames = meshNode.data.faceRenames || {};
  var current = meshNode.data.faceRenames[faceId] || defaultLabel || faceId;
  var input = (typeof prompt === 'function') ? prompt('Yüz için yeni isim:', current) : null;
  if (input === null) return; // iptal
  input = String(input).trim();
  if (input === '' || input === defaultLabel || input === faceId) {
    delete meshNode.data.faceRenames[faceId];
  } else {
    meshNode.data.faceRenames[faceId] = input;
  }
  if (typeof saveState === 'function') saveState();
  if (typeof veFEAEditorRefreshAccordions === 'function') veFEAEditorRefreshAccordions();
}

// Geometri Topolojisi — ANSYS-style "geometriyi/yüzeyleri tanımla → mesh at"
// workflow'unun ilk aşaması. Upstream Geometry node'undan topology okunur
// (mesh ÖNCESI tespit edilmiş face listesi).
function _veFEAEditorTopologyHTML(node) {
  // Upstream geometri node'unu bul
  var geomNode = (typeof veFEAFindUpstreamGeometryNode === 'function')
    ? veFEAFindUpstreamGeometryNode(node.id) : null;
  if (!geomNode || !geomNode.data || !geomNode.data.geometry) {
    return '<div style="padding:8px 10px; background:var(--bg-primary); border:1px solid var(--border-color); font-size:0.62rem; color:var(--text-muted);">Upstream Geometri bağlantısı yok. Önce bir Geometri bileşeni tanımlayın ve bu Mesh node\'una bağlayın.</div>';
  }
  var geom = geomNode.data.geometry;
  // Topology henuz hesaplanmadiysa on-the-fly hesapla (eski projeler icin)
  var topo = geom.topology;
  if (!topo && typeof veFEAComputeGeometryTopology === 'function') {
    topo = veFEAComputeGeometryTopology(geom);
  }
  if (!topo || !topo.faces || topo.faces.length === 0) {
    return '<div style="padding:8px 10px; background:var(--bg-primary); border:1px solid var(--border-color); font-size:0.62rem; color:var(--text-muted);">Bu geometri tipinde topology bilgisi yok.</div>';
  }

  var html = '<div style="font-size:0.58rem; color:var(--text-muted); line-height:1.5; margin-bottom:8px;">' +
    'Mesh atmadan önce geometriden otomatik tespit edilen yüzeyler. Mesher bu yüzeylere ' +
    '<b>conforming</b> şekilde eleman üretir; her yüze ait düğümler otomatik named selection olur.</div>';

  // Özet kutusu — alan/hacim/face/edge/vertex sayıları
  function _fmtArea(a)  { return a >= 1e6 ? (a/1e6).toFixed(2)+' m²' : a >= 1e4 ? (a/1e4).toFixed(2)+' dm²' : a >= 1e2 ? (a/1e2).toFixed(2)+' cm²' : a.toFixed(1)+' mm²'; }
  function _fmtVol(v)   { return v >= 1e9 ? (v/1e9).toFixed(3)+' m³' : v >= 1e6 ? (v/1e6).toFixed(2)+' dm³' : v >= 1e3 ? (v/1e3).toFixed(2)+' cm³' : v.toFixed(1)+' mm³'; }
  html += '<div style="padding:6px 8px; background:var(--bg-primary); border:1px solid var(--border-color); margin-bottom:8px; font-size:0.6rem; display:grid; grid-template-columns:1fr 1fr; gap:3px 12px;">' +
    '<span style="color:var(--text-secondary);">Yüzey sayısı</span><span style="text-align:right; font-weight:600;">' + topo.faces.length + '</span>' +
    '<span style="color:var(--text-secondary);">Kenar sayısı</span><span style="text-align:right; font-weight:600;">' + (topo.edges ? topo.edges.count : 0) + '</span>' +
    '<span style="color:var(--text-secondary);">Köşe sayısı</span><span style="text-align:right; font-weight:600;">' + (topo.vertices ? topo.vertices.count : 0) + '</span>' +
    '<span style="color:var(--text-secondary);">Hacim</span><span style="text-align:right; font-weight:600;">' + _fmtVol(topo.volume || 0) + '</span>' +
    '<span style="color:var(--text-secondary);">Toplam yüzey alanı</span><span style="text-align:right; font-weight:600;">' + _fmtArea(topo.totalSurfaceArea || 0) + '</span>' +
  '</div>';

  // Face listesi tablosu — her satır tıklanabilir (3D viewer'da face highlight)
  var selectedFaceId = node.data && node.data.selectedFaceId || null;
  var localSizingFaceId = (node.data && node.data.meshSettings && node.data.meshSettings.localSizing && node.data.meshSettings.localSizing.selection) || null;
  var localBiasActive = !!(node.data && node.data.meshSettings && node.data.meshSettings.localSizing &&
    ((node.data.meshSettings.localSizing.biasStrength || 0) > 0 ||
     (node.data.meshSettings.localSizing.biasMode === 'inflation' && (node.data.meshSettings.localSizing.firstLayerThickness || 0) > 0)));
  var faceRenames = (node.data && node.data.faceRenames) || {};
  html += '<div style="font-size:0.58rem; color:var(--text-secondary); margin-bottom:4px;">' +
    'Yüzeyler <span style="color:var(--text-muted);">(satıra tıkla → 3D\'de seç · ✏ → yeniden adlandır)</span>:</div>';
  topo.faces.forEach(function(f) {
    var typeLabel = (typeof veFEATopologyFaceTypeLabel === 'function') ? veFEATopologyFaceTypeLabel(f.type) : f.type;
    var typeColor = '#3b82f6';
    if (f.type === 'cylindrical') typeColor = '#8b5cf6';
    else if (f.type === 'planar-annular') typeColor = '#06b6d4';
    else if (f.type === 'triangulated') typeColor = '#f59e0b';
    var holeIcon = f.isHole ? '<span title="Delik / iç yüzey" style="color:#ef4444; margin-left:4px;">⌀</span>' : '';
    var extra = '';
    if (f.radius !== undefined) extra += ' · r=' + f.radius.toFixed(1) + 'mm';
    if (f.length !== undefined) extra += ' · L=' + f.length.toFixed(1) + 'mm';
    if (f.outerRadius !== undefined && f.innerRadius !== undefined) extra += ' · R=' + f.outerRadius.toFixed(1) + ' / r=' + f.innerRadius.toFixed(1) + 'mm';
    if (f.normal) extra += ' · n=[' + f.normal.map(function(v){return v.toFixed(0);}).join(',') + ']';

    var isSelected = (selectedFaceId === f.id);
    var hasLocal = localBiasActive && localSizingFaceId === f.id;
    var rowBg = isSelected ? '#fbbf2420' : 'var(--bg-tertiary)';
    var rowBorder = isSelected ? '#fbbf24' : 'var(--border-color)';
    var selIcon = isSelected ? '<span style="color:#fbbf24; margin-right:4px;">◉</span>' : '<span style="color:var(--text-muted); margin-right:4px;">○</span>';

    var customLabel = faceRenames[f.id];
    var displayLabel = customLabel || f.label;
    var labelHTML = customLabel
      ? '<span style="font-weight:600; color:#22c55e;" title="Yeniden adlandırıldı (varsayılan: ' + f.label + ')">' + customLabel + '</span>'
      : '<span style="font-weight:600; color:var(--text-primary);">' + f.label + '</span>';
    var localBadge = hasLocal
      ? '<span title="Bu yüze lokal yoğunlaştırma uygulanmış" style="font-size:0.5rem; padding:1px 5px; background:#a855f720; color:#a855f7; font-weight:600; margin-left:4px;">◆ LOKAL</span>'
      : '';

    html += '<div style="display:flex; align-items:stretch; margin-bottom:3px;">';
    // Ana satır butonu (face select + 3D highlight)
    html += '<button onclick="veFEASelectGeometryFace(\'' + node.id + '\', \'' + f.id + '\')" style="flex:1; text-align:left; padding:5px 8px; background:' + rowBg + '; border:1px solid ' + rowBorder + '; border-right:none; font-size:0.6rem; cursor:pointer; transition:background 0.12s;" onmouseover="this.style.background=\'' + (isSelected ? '#fbbf2435' : 'var(--bg-secondary)') + '\'" onmouseout="this.style.background=\'' + rowBg + '\'">' +
      '<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:2px;">' +
        '<span style="display:flex; align-items:center; gap:4px;">' +
          selIcon +
          '<span style="font-family:monospace; font-size:0.56rem; padding:1px 5px; background:var(--bg-primary); color:var(--text-muted);">' + f.id + '</span>' +
          labelHTML +
          holeIcon +
          localBadge +
        '</span>' +
        '<span style="font-size:0.52rem; padding:1px 6px; background:' + typeColor + '20; color:' + typeColor + '; font-weight:600;">' + typeLabel + '</span>' +
      '</div>' +
      '<div style="font-size:0.55rem; color:var(--text-muted); padding-left:18px;">' +
        'Alan: <b style="color:var(--text-secondary);">' + _fmtArea(f.area || 0) + '</b>' + extra +
      '</div>' +
    '</button>';
    // Yeniden adlandır (✏️) butonu
    var defaultLabelEsc = f.label.replace(/'/g, '\\\'');
    html += '<button onclick="veFEARenameGeometryFace(\'' + node.id + '\', \'' + f.id + '\', \'' + defaultLabelEsc + '\')" title="Yüzü yeniden adlandır" style="padding:0 8px; background:' + rowBg + '; border:1px solid ' + rowBorder + '; cursor:pointer; font-size:0.72rem; color:var(--text-muted);" onmouseover="this.style.color=\'#22c55e\'" onmouseout="this.style.color=\'var(--text-muted)\'">✏</button>';
    html += '</div>';
  });

  if (selectedFaceId) {
    html += '<div style="margin-top:6px; padding:5px 8px; background:#fbbf2418; border-left:3px solid #fbbf24; font-size:0.6rem; color:var(--text-primary);">' +
      '<b>Seçili yüz:</b> ' + selectedFaceId +
      ' <button onclick="veFEASelectGeometryFace(\'' + node.id + '\', null)" style="float:right; padding:1px 6px; font-size:0.52rem; background:var(--bg-tertiary); color:var(--text-muted); border:1px solid var(--border-color); cursor:pointer;">Seçimi Kaldır</button>' +
    '</div>';
  }

  html += '<div style="font-size:0.52rem; color:var(--text-muted); margin-top:6px; line-height:1.4;">' +
    'ℹ Mesh oluşturulduktan sonra her yüze ait düğümler <b>Atanmış Yüzeyler</b> bölümünde göz atılabilir. ' +
    'Sınır koşulları (F4) bu yüzeylere referansla uygulanır.</div>';

  return html;
}

function _veFEAEditorDefaultsHTML(node) {
  var d = node.data || {};
  var settings = d.meshSettings || { size: 10 };
  var html = '';
  var currentMode = settings.mode || 'auto';
  html += '<div style="font-size:0.62rem; color:var(--text-secondary); margin-bottom:4px;">Mesh Modu</div>';
  html += '<select id="ve-fea-mesh-mode-' + node.id + '" style="width:100%; padding:5px 8px; font-size:0.66rem; background:var(--bg-input); color:var(--text-primary); border:1px solid var(--border-color); margin-bottom:10px;">';
  html += '<option value="auto"' + (currentMode === 'auto' ? ' selected' : '') + '>Otomatik (Primitif → yapısal, STL/STEP → voxel)</option>';
  html += '<option value="volume"' + (currentMode === 'volume' ? ' selected' : '') + '>Hacim (Heks8 voxel — FEA için)</option>';
  html += '<option value="surface"' + (currentMode === 'surface' ? ' selected' : '') + '>Yüzey (Tri3 — sadece önizleme)</option>';
  html += '</select>';

  var currentElType = settings.elementType || 'auto';
  html += '<div style="font-size:0.62rem; color:var(--text-secondary); margin-bottom:4px;">Eleman Tipi</div>';
  html += '<select id="ve-fea-mesh-eltype-' + node.id + '" style="width:100%; padding:5px 8px; font-size:0.66rem; background:var(--bg-input); color:var(--text-primary); border:1px solid var(--border-color); margin-bottom:10px;">';
  html += '<option value="auto"' + (currentElType === 'auto' ? ' selected' : '') + '>Otomatik (Heks8 / Wedge6)</option>';
  html += '<option value="tet4"' + (currentElType === 'tet4' ? ' selected' : '') + '>Tet4 (Tetra — decomposition)</option>';
  html += '</select>';

  var midSideOn = settings.midSideNodes === true;
  html += '<label style="display:flex; align-items:center; gap:6px; padding:6px 8px; margin-bottom:8px; background:var(--bg-primary); border:1px solid var(--border-color); cursor:pointer; font-size:0.62rem; color:var(--text-primary);">' +
    '<input type="checkbox" id="ve-fea-mesh-midnodes-' + node.id + '"' + (midSideOn ? ' checked' : '') + ' style="margin:0;">' +
    '<span>Orta-kenar düğümler <span style="color:var(--text-muted);">(Quadratic: Tet10 / Hex20 / Wedge15)</span></span>' +
  '</label>';

  // Disk Topolojisi (sadece silindir/şaft için anlamlı) — O-grid butterfly
  // dairesel yakınsamada altın standart (ICEM CFD).
  var crossSection = settings.crossSection || 'wedge';
  html += '<div style="font-size:0.62rem; color:var(--text-secondary); margin-bottom:4px;">Disk Topolojisi <span style="color:var(--text-muted);">(silindir / şaft için)</span></div>';
  html += '<select id="ve-fea-mesh-cross-' + node.id + '" style="width:100%; padding:5px 8px; font-size:0.66rem; background:var(--bg-input); color:var(--text-primary); border:1px solid var(--border-color); margin-bottom:10px;">';
  html += '<option value="wedge"' + (crossSection === 'wedge' ? ' selected' : '') + '>Wedge6 (merkez fan, varsayılan)</option>';
  html += '<option value="ogrid"' + (crossSection === 'ogrid' ? ' selected' : '') + '>Hex8 O-grid (Butterfly — dairesel yakınsama ↑)</option>';
  html += '</select>';

  return html;
}

function _veFEAEditorSizingHTML(node) {
  var d = node.data || {};
  var settings = d.meshSettings || { size: 10 };
  var curv = settings.curvatureRefinement || { enabled: false, normalAngleDeg: 18 };
  var useWorker = settings.useWorker === true;
  var html = '';
  html += '<div style="font-size:0.62rem; color:var(--text-secondary); margin-bottom:4px;">Mesh Boyu</div>';
  html += '<div style="font-size:0.55rem; color:var(--text-muted); margin-bottom:6px;">Yukarıdaki toolbar\'dan da değiştirebilirsiniz. Global element size.</div>';
  // Boyut input modal'da iki yerde olamaz → toolbar'dakini kullan. Burada sadece açıklama.
  html += '<label style="display:flex; align-items:center; gap:6px; padding:6px 8px; margin-bottom:8px; background:var(--bg-primary); border:1px solid var(--border-color); cursor:pointer; font-size:0.62rem; color:var(--text-primary);">' +
    '<input type="checkbox" id="ve-fea-mesh-curv-' + node.id + '"' + (curv.enabled ? ' checked' : '') + ' style="margin:0;">' +
    '<span>Eğrilik tabanlı incelt <span style="color:var(--text-muted);">(silindir/şaft çevresel)</span></span>' +
  '</label>';
  html += '<div style="display:flex; gap:6px; align-items:center; margin-bottom:8px; padding-left:24px;">' +
    '<label for="ve-fea-mesh-curv-ang-' + node.id + '" style="flex:1; font-size:0.6rem; color:var(--text-secondary);">Maks yüzey açısı</label>' +
    '<input id="ve-fea-mesh-curv-ang-' + node.id + '" type="number" min="1" max="90" step="1" value="' + (curv.normalAngleDeg || 18) + '" style="width:60px; padding:3px 6px; font-size:0.62rem; background:var(--bg-input); color:var(--text-primary); border:1px solid var(--border-color);">' +
    '<span style="font-size:0.55rem; color:var(--text-muted);">°</span>' +
  '</div>';
  html += '<label style="display:flex; align-items:center; gap:6px; padding:6px 8px; margin-bottom:6px; background:var(--bg-primary); border:1px solid var(--border-color); cursor:pointer; font-size:0.62rem; color:var(--text-primary);">' +
    '<input type="checkbox" id="ve-fea-mesh-worker-' + node.id + '"' + (useWorker ? ' checked' : '') + ' style="margin:0;">' +
    '<span>Web Worker\'da hesapla <span style="color:var(--text-muted);">(büyük mesh için)</span></span>' +
  '</label>';
  return html;
}

function _veFEAEditorInflationHTML(node) {
  var d = node.data || {};
  var settings = d.meshSettings || {};
  var local = settings.localSizing || { selection: 'none', biasMode: 'power', biasStrength: 0, firstLayerThickness: 1, growthRate: 1.2, layerCount: 5 };
  var biasMode = local.biasMode || 'power';
  var html = '';
  html += '<div style="font-size:0.58rem; color:var(--text-muted); line-height:1.4; margin-bottom:8px;">' +
    'Hedef yüzeye doğru düğüm kümeleme. Power: sürekli güç fonksiyonu, Inflation: ANSYS-style geometric progression katmanları.</div>';
  html += '<div style="display:flex; gap:6px; align-items:center; margin-bottom:6px;">' +
    '<label for="ve-fea-mesh-local-sel-' + node.id + '" style="flex:0 0 60px; font-size:0.6rem; color:var(--text-secondary);">Hedef</label>' +
    '<select id="ve-fea-mesh-local-sel-' + node.id + '" onchange="veFEAOnLocalSelectionChange(\'' + node.id + '\', this.value)" style="flex:1; padding:4px 6px; font-size:0.62rem; background:var(--bg-input); color:var(--text-primary); border:1px solid var(--border-color);">';
  var localFaces = [
    ['none', '— Yok —'],
    ['faceXMin', 'X− Yüzeyi'],
    ['faceXMax', 'X+ Yüzeyi'],
    ['faceYMin', 'Y− / Alt'],
    ['faceYMax', 'Y+ / Üst'],
    ['faceZMin', 'Z− Yüzeyi'],
    ['faceZMax', 'Z+ Yüzeyi'],
    ['faceBottom', 'Alt (silindir/şaft)'],
    ['faceTop', 'Üst (silindir/şaft)']
  ];
  localFaces.forEach(function(f) {
    var sel = (local.selection === f[0]) ? ' selected' : '';
    html += '<option value="' + f[0] + '"' + sel + '>' + f[1] + '</option>';
  });
  html += '</select></div>';
  html += '<div style="display:flex; gap:6px; align-items:center; margin-bottom:6px;">' +
    '<label for="ve-fea-mesh-local-mode-' + node.id + '" style="flex:0 0 60px; font-size:0.6rem; color:var(--text-secondary);">Mod</label>' +
    '<select id="ve-fea-mesh-local-mode-' + node.id + '" style="flex:1; padding:4px 6px; font-size:0.62rem; background:var(--bg-input); color:var(--text-primary); border:1px solid var(--border-color);">' +
      '<option value="power"' + (biasMode === 'power' ? ' selected' : '') + '>Güç fonksiyonu</option>' +
      '<option value="inflation"' + (biasMode === 'inflation' ? ' selected' : '') + '>Inflation katmanları</option>' +
    '</select></div>';
  if (biasMode === 'power') {
    html += '<div style="display:flex; gap:6px; align-items:center; margin-bottom:8px;">' +
      '<label for="ve-fea-mesh-local-bias-' + node.id + '" style="flex:0 0 60px; font-size:0.6rem; color:var(--text-secondary);">Yığılma</label>' +
      '<input id="ve-fea-mesh-local-bias-' + node.id + '" type="range" min="0" max="100" step="5" value="' + Math.round((local.biasStrength || 0) * 100) + '" style="flex:1;">' +
      '<span style="font-size:0.6rem; color:var(--text-muted); width:34px; text-align:right;">' + Math.round((local.biasStrength || 0) * 100) + '%</span>' +
    '</div>';
  } else {
    html += '<div style="display:flex; gap:6px; align-items:center; margin-bottom:4px;">' +
      '<label for="ve-fea-mesh-local-first-' + node.id + '" style="flex:1; font-size:0.6rem; color:var(--text-secondary);">İlk katman kalınlığı</label>' +
      '<input id="ve-fea-mesh-local-first-' + node.id + '" type="number" min="0.05" max="500" step="0.1" value="' + (local.firstLayerThickness || 1) + '" style="width:70px; padding:3px 6px; font-size:0.62rem; background:var(--bg-input); color:var(--text-primary); border:1px solid var(--border-color);">' +
      '<span style="font-size:0.55rem; color:var(--text-muted);">mm</span>' +
    '</div>';
    html += '<div style="display:flex; gap:6px; align-items:center; margin-bottom:4px;">' +
      '<label for="ve-fea-mesh-local-grow-' + node.id + '" style="flex:1; font-size:0.6rem; color:var(--text-secondary);">Büyüme oranı</label>' +
      '<input id="ve-fea-mesh-local-grow-' + node.id + '" type="number" min="1.0" max="5.0" step="0.05" value="' + (local.growthRate || 1.2) + '" style="width:70px; padding:3px 6px; font-size:0.62rem; background:var(--bg-input); color:var(--text-primary); border:1px solid var(--border-color);">' +
      '<span style="font-size:0.55rem; color:var(--text-muted);">×</span>' +
    '</div>';
    html += '<div style="display:flex; gap:6px; align-items:center; margin-bottom:8px;">' +
      '<label for="ve-fea-mesh-local-nlay-' + node.id + '" style="flex:1; font-size:0.6rem; color:var(--text-secondary);">Katman sayısı</label>' +
      '<input id="ve-fea-mesh-local-nlay-' + node.id + '" type="number" min="1" max="50" step="1" value="' + (local.layerCount || 5) + '" style="width:70px; padding:3px 6px; font-size:0.62rem; background:var(--bg-input); color:var(--text-primary); border:1px solid var(--border-color);">' +
      '<span style="font-size:0.55rem; color:var(--text-muted);">−</span>' +
    '</div>';
  }
  return html;
}

function _veFEAEditorQualityHTML(node) {
  var d = node.data || {};
  var metrics = d.meshMetrics;
  var hasMesh = !!(d.meshActive && metrics);
  if (!hasMesh) {
    return '<div style="padding:8px 10px; background:var(--bg-primary); border:1px solid var(--border-color); font-size:0.62rem; color:var(--text-muted);">Mesh oluşturulduktan sonra otomatik hesaplanır.</div>';
  }
  var html = '';
  // Jacobian
  if (metrics.jacobian) {
    var jm = metrics.jacobian;
    var color = jm.valid ? 'var(--accent-success, #22c55e)' : 'var(--accent-danger, #ef4444)';
    var bg = jm.valid ? 'rgba(34,197,94,0.08)' : 'rgba(239,68,68,0.08)';
    var label = jm.valid ? '✓ GEÇERLİ (tüm Jacobianlar pozitif)' : '✗ HATALI (ters/dejenere eleman var)';
    html += '<div style="padding:6px 8px; background:' + bg + '; border:1px solid ' + color + '; font-size:0.62rem; color:' + color + '; margin-bottom:8px; font-weight:600;">' + label + '</div>';
    html += veFEAReadOnlyRow('Ters dönmüş eleman', (jm.invertedCount || 0).toLocaleString('tr-TR'));
    html += veFEAReadOnlyRow('Dejenere eleman', (jm.degenerateCount || 0).toLocaleString('tr-TR'));
    html += veFEAReadOnlyRow('Jacobian oranı (min/maks/ort)', (jm.minJacRatio || 0).toFixed(2) + ' / ' + (jm.maxJacRatio || 0).toFixed(2) + ' / ' + (jm.avgJacRatio || 0).toFixed(2));
    if (jm.poorCount > 0) {
      html += '<div style="padding:6px 8px; background:rgba(245,158,11,0.08); border-left:2px solid var(--accent-warning, #f59e0b); font-size:0.58rem; color:var(--accent-warning, #f59e0b); margin:4px 0 10px;">' +
        '⚠ ' + jm.poorCount.toLocaleString('tr-TR') + ' eleman düşük kaliteli (Jac oranı > ' + jm.ratioWarnThreshold + ')</div>';
    }
  }
  // Quality (aspect / skewness / angle)
  if (metrics.quality) {
    var q = metrics.quality;
    html += '<div style="margin-top:6px; font-size:0.62rem; color:var(--text-secondary); margin-bottom:4px;">Aspect Ratio / Skewness / Açı</div>';
    html += veFEAReadOnlyRow('Aspect Min / Maks / Ort', (q.aspectRatio.min || 0).toFixed(2) + ' / ' + (q.aspectRatio.max || 0).toFixed(2) + ' / ' + (q.aspectRatio.avg || 0).toFixed(2));
    if (q.aspectRatio.poorCount > 0) {
      html += '<div style="padding:4px 8px; font-size:0.58rem; color:var(--accent-warning, #f59e0b); border-left:2px solid var(--accent-warning, #f59e0b); margin-bottom:6px; background:rgba(245,158,11,0.06);">⚠ ' + q.aspectRatio.poorCount.toLocaleString('tr-TR') + ' eleman aspect > ' + q.aspectRatio.warnThreshold + '</div>';
    }
    html += veFEAHistogramHTML(q.aspectRatio.histogram, 'Aspect Ratio histogramı (yeşil=iyi, sarı=uyarı, kırmızı=hata)', '#3b82f6', function(v){return v.toFixed(1);}, { warnLimit: 5, errLimit: q.aspectRatio.warnThreshold || 20, inverted: false });
    html += veFEAReadOnlyRow('Skewness Min / Maks / Ort', (q.skewness.min || 0).toFixed(3) + ' / ' + (q.skewness.max || 0).toFixed(3) + ' / ' + (q.skewness.avg || 0).toFixed(3));
    if (q.skewness.poorCount > 0) {
      html += '<div style="padding:4px 8px; font-size:0.58rem; color:var(--accent-warning, #f59e0b); border-left:2px solid var(--accent-warning, #f59e0b); margin-bottom:6px; background:rgba(245,158,11,0.06);">⚠ ' + q.skewness.poorCount.toLocaleString('tr-TR') + ' eleman skewness > ' + q.skewness.warnThreshold + '</div>';
    }
    html += veFEAHistogramHTML(q.skewness.histogram, 'Skewness histogramı (yeşil=iyi, sarı=uyarı, kırmızı=hata)', '#f59e0b', function(v){return v.toFixed(2);}, { warnLimit: 0.5, errLimit: q.skewness.warnThreshold || 0.85, inverted: false });
    html += veFEAReadOnlyRow('Min / Maks iç açı', (q.angle.min || 0).toFixed(1) + '° / ' + (q.angle.max || 0).toFixed(1) + '°');
    html += veFEAHistogramHTML(q.angle.histogram, 'Min iç açı histogramı (derece — düşük=kötü, ters threshold)', '#22c55e', function(v){return v.toFixed(0) + '°';}, { warnLimit: 30, errLimit: 15, inverted: true });
  }
  return html;
}

function _veFEAEditorNamedSelHTML(node) {
  var d = node.data || {};
  var hasMesh = !!d.meshActive;
  if (!hasMesh) {
    return '<div style="padding:8px 10px; background:var(--bg-primary); border:1px solid var(--border-color); font-size:0.62rem; color:var(--text-muted);">Mesh oluşturulduktan sonra atanmış yüzey grupları gösterilir.</div>';
  }
  if (!d.namedSelectionsSummary || Object.keys(d.namedSelectionsSummary).length === 0) {
    return '<div style="padding:8px 10px; background:var(--bg-primary); border:1px solid var(--border-color); font-size:0.62rem; color:var(--text-muted);">— (yüzey grubu üretilmedi)</div>';
  }
  var highlightKey = d.highlightedSelection || null;
  var html = '<div style="font-size:0.58rem; color:var(--text-muted); line-height:1.4; margin-bottom:8px;">Otomatik üretilen düğüm grupları. BC bu yüzeylere referansla uygulanır.</div>';
  Object.keys(d.namedSelectionsSummary).forEach(function(k) {
    var ns = d.namedSelectionsSummary[k];
    var isActive = (highlightKey === k);
    var bg = isActive ? 'var(--accent-primary)' : 'var(--bg-tertiary)';
    var fg = isActive ? '#fff' : 'var(--text-primary)';
    var iconColor = isActive ? '#fff' : 'var(--accent-warning, #f59e0b)';
    var border = isActive ? 'var(--accent-primary)' : 'var(--border-color)';
    var srcBadge = (ns.source === 'auto') ? 'AUTO' : 'MANUEL';
    var srcBg = (ns.source === 'auto') ? '#64748b40' : '#22c55e40';
    html += '<button onclick="veFEAToggleNamedSelection(\'' + node.id + '\', \'' + k + '\')" style="display:flex; align-items:center; justify-content:space-between; width:100%; padding:6px 8px; margin-bottom:3px; background:' + bg + '; color:' + fg + '; border:1px solid ' + border + '; cursor:pointer; font-size:0.62rem; text-align:left;">' +
      '<span style="display:flex; align-items:center; gap:6px;">' +
        '<span style="color:' + iconColor + '; font-size:0.7rem;">' + (isActive ? '◉' : '○') + '</span>' +
        '<span>' + ns.label + '</span>' +
      '</span>' +
      '<span style="display:flex; align-items:center; gap:6px;">' +
        '<span style="font-size:0.5rem; padding:1px 5px; background:' + srcBg + '; color:' + fg + ';">' + srcBadge + '</span>' +
        '<span style="font-weight:600; opacity:0.85;">' + ns.nodeCount.toLocaleString('tr-TR') + ' düğüm</span>' +
      '</span>' +
    '</button>';
  });
  return html;
}

function _veFEAEditorDisplayHTML(node) {
  var d = node.data || {};
  var hasMesh = !!d.meshActive;
  if (!hasMesh) {
    return '<div style="padding:8px 10px; background:var(--bg-primary); border:1px solid var(--border-color); font-size:0.62rem; color:var(--text-muted);">Mesh oluşturulduktan sonra kullanılabilir.</div>';
  }
  // ANSYS-style default: Body Color = Geometri + Mesh Çizgileri
  var displayMode = d.heatMapMetric || 'geom-mesh';
  var html = '<div style="font-size:0.58rem; color:var(--text-muted); line-height:1.5; margin-bottom:6px;">Mesh\'in 3D viewer\'da nasıl gösterileceğini seçin. ANSYS-style: <b>Body Color</b> (geometri + siyah mesh çizgileri) varsayılan.</div>';
  html += '<select onchange="veFEAApplyHeatMap(\'' + node.id + '\', this.value)" style="width:100%; padding:5px 8px; font-size:0.66rem; background:var(--bg-input); color:var(--text-primary); border:1px solid var(--border-color); margin-bottom:6px;">';
  html += '<optgroup label="Standart">';
  html += '<option value="geom-mesh"' + (displayMode === 'geom-mesh' ? ' selected' : '') + '>Body Color (Geometri + Mesh Çizgileri)</option>';
  html += '<option value="solid-edges"' + (displayMode === 'solid-edges' ? ' selected' : '') + '>Solid + Edges (Mesh yüzeyi)</option>';
  html += '<option value="solid"' + (displayMode === 'solid' ? ' selected' : '') + '>Solid (Mesh yüzeyi)</option>';
  html += '<option value="off"' + (displayMode === 'off' ? ' selected' : '') + '>Wireframe (sadece kenarlar)</option>';
  html += '</optgroup>';
  html += '<optgroup label="Kalite Eşiği (Mesh Quality Worksheet)">';
  html += '<option value="threshold-aspect"' + (displayMode === 'threshold-aspect' ? ' selected' : '') + '>Aspect Ratio (yeşil/sarı/kırmızı)</option>';
  html += '<option value="threshold-skewness"' + (displayMode === 'threshold-skewness' ? ' selected' : '') + '>Skewness (yeşil/sarı/kırmızı)</option>';
  html += '<option value="threshold-minAngle"' + (displayMode === 'threshold-minAngle' ? ' selected' : '') + '>Min İç Açı (yeşil/sarı/kırmızı)</option>';
  html += '<option value="threshold-jacobian"' + (displayMode === 'threshold-jacobian' ? ' selected' : '') + '>Jacobian Oranı (yeşil/sarı/kırmızı)</option>';
  html += '</optgroup>';
  html += '<optgroup label="Heat Map (Sürekli Rainbow)">';
  html += '<option value="aspect"' + (displayMode === 'aspect' ? ' selected' : '') + '>Aspect Ratio</option>';
  html += '<option value="skewness"' + (displayMode === 'skewness' ? ' selected' : '') + '>Skewness</option>';
  html += '<option value="minAngle"' + (displayMode === 'minAngle' ? ' selected' : '') + '>Min İç Açı</option>';
  html += '<option value="jacobianRatio"' + (displayMode === 'jacobianRatio' ? ' selected' : '') + '>Jacobian Oranı</option>';
  html += '</optgroup>';
  // Solver sonuçları varsa "Sonuçlar" grubunu göster
  var solverNode = (typeof _veFEAFindSolverNodeForMesh === 'function') ? _veFEAFindSolverNodeForMesh(node.id) : null;
  if (solverNode && solverNode.data && solverNode.data.solver && solverNode.data.solver.results) {
    html += '<optgroup label="Sonuçlar (Static Structural)">';
    html += '<option value="result-vonMises"' + (displayMode === 'result-vonMises' ? ' selected' : '') + '>von Mises Stress (MPa)</option>';
    html += '<option value="result-displacement"' + (displayMode === 'result-displacement' ? ' selected' : '') + '>Deplasman büyüklüğü (mm)</option>';
    html += '<option value="result-principalMax"' + (displayMode === 'result-principalMax' ? ' selected' : '') + '>Maks. asal gerilme</option>';
    html += '<option value="result-principalMin"' + (displayMode === 'result-principalMin' ? ' selected' : '') + '>Min. asal gerilme</option>';
    html += '<option value="result-deformed"' + (displayMode === 'result-deformed' ? ' selected' : '') + '>Deforme şekil (auto scale, gri ref)</option>';
    html += '</optgroup>';
  }
  html += '</select>';
  var isHeatMap = (displayMode === 'aspect' || displayMode === 'skewness' || displayMode === 'minAngle' || displayMode === 'jacobianRatio');
  var isThreshold = (displayMode === 'threshold-aspect' || displayMode === 'threshold-skewness' || displayMode === 'threshold-minAngle' || displayMode === 'threshold-jacobian');
  var isResultMap = (displayMode === 'result-vonMises' || displayMode === 'result-displacement' ||
                     displayMode === 'result-principalMax' || displayMode === 'result-principalMin' ||
                     displayMode === 'result-deformed');
  if (isResultMap) {
    var rLabel = (displayMode === 'result-vonMises') ? 'von Mises (MPa)'
               : (displayMode === 'result-displacement') ? 'Deplasman (mm)'
               : (displayMode === 'result-principalMax') ? 'σ_max (MPa)'
               : (displayMode === 'result-principalMin') ? 'σ_min (MPa)'
               : 'Deforme şekil';
    html += '<div style="font-size:0.55rem; color:var(--text-muted); margin-bottom:4px;">' + rLabel + '</div>';
    html += '<div style="display:flex; align-items:center; gap:6px; margin-bottom:4px;">' +
      '<span style="font-size:0.55rem; color:var(--text-muted);">Düşük</span>' +
      '<div style="flex:1; height:8px; background:linear-gradient(to right, #0000ff, #00ffff, #00ff00, #ffff00, #ff0000); border:1px solid var(--border-color);"></div>' +
      '<span style="font-size:0.55rem; color:var(--text-muted);">Yüksek</span>' +
    '</div>';
  }
  if (isHeatMap) {
    html += '<div style="display:flex; align-items:center; gap:6px; margin-bottom:4px;">' +
      '<span style="font-size:0.55rem; color:var(--text-muted);">İyi</span>' +
      '<div style="flex:1; height:8px; background:linear-gradient(to right, #0000ff, #00ffff, #00ff00, #ffff00, #ff0000); border:1px solid var(--border-color);"></div>' +
      '<span style="font-size:0.55rem; color:var(--text-muted);">Kötü</span>' +
    '</div>';
  } else if (isThreshold) {
    html += '<div style="display:flex; align-items:center; gap:6px; margin-bottom:4px;">' +
      '<span style="display:inline-block; width:14px; height:10px; background:#22c55e;"></span>' +
      '<span style="font-size:0.55rem; color:var(--text-muted);">İyi</span>' +
      '<span style="display:inline-block; width:14px; height:10px; background:#f59e0b;"></span>' +
      '<span style="font-size:0.55rem; color:var(--text-muted);">Uyarı</span>' +
      '<span style="display:inline-block; width:14px; height:10px; background:#ef4444;"></span>' +
      '<span style="font-size:0.55rem; color:var(--text-muted);">Hata</span>' +
    '</div>';
  }
  return html;
}

function _veFEAEditorStatisticsHTML(node) {
  var d = node.data || {};
  var metrics = d.meshMetrics;
  var hasMesh = !!(d.meshActive && metrics);
  if (!hasMesh) {
    return '<div style="padding:8px 10px; background:var(--bg-primary); border:1px solid var(--border-color); font-size:0.62rem; color:var(--text-muted);">Mesh oluşturulduktan sonra istatistikler dolar.</div>';
  }
  var typeLabel = (typeof veFEAMeshLabel === 'function') ? veFEAMeshLabel(metrics.elementType) : metrics.elementType;
  var html = '';
  html += veFEAReadOnlyRow('Eleman tipi', typeLabel);
  if (metrics.sweepAxis) html += veFEAReadOnlyRow('Sweep ekseni', metrics.sweepAxis + ' (axial)');
  html += veFEAReadOnlyRow('Düğüm sayısı', metrics.nodeCount.toLocaleString('tr-TR'));
  html += veFEAReadOnlyRow('Eleman sayısı', metrics.elementCount.toLocaleString('tr-TR'));
  html += veFEAReadOnlyRow('Min eleman boyu', metrics.minSize.toFixed(2) + ' mm');
  html += veFEAReadOnlyRow('Maks eleman boyu', metrics.maxSize.toFixed(2) + ' mm');
  html += veFEAReadOnlyRow('Ortalama eleman boyu', metrics.avgSize.toFixed(2) + ' mm');
  if (metrics.computeMs !== undefined) html += veFEAReadOnlyRow('Hesaplama süresi', metrics.computeMs + ' ms');
  return html;
}

function _veFEAEditorSuggestionsHTML(node) {
  var d = node.data || {};
  var metrics = d.meshMetrics;
  var hasMesh = !!(d.meshActive && metrics);
  if (!hasMesh || typeof veFEAComputeRefinementSuggestions !== 'function') {
    return '<div style="padding:8px 10px; background:var(--bg-primary); border:1px solid var(--border-color); font-size:0.62rem; color:var(--text-muted);">Mesh oluşturulduktan sonra öneriler gösterilir.</div>';
  }
  var suggestions = veFEAComputeRefinementSuggestions(metrics);
  var html = '';
  suggestions.forEach(function(s) {
    var color, bg, icon;
    if (s.severity === 'critical') { color = 'var(--accent-danger, #ef4444)'; bg = 'rgba(239,68,68,0.08)'; icon = '✗'; }
    else if (s.severity === 'warn') { color = 'var(--accent-warning, #f59e0b)'; bg = 'rgba(245,158,11,0.08)'; icon = '⚠'; }
    else if (s.severity === 'info')  { color = 'var(--accent-info, #3b82f6)';  bg = 'rgba(59,130,246,0.08)'; icon = 'ℹ'; }
    else { color = 'var(--accent-success, #22c55e)'; bg = 'rgba(34,197,94,0.08)'; icon = '✓'; }
    html += '<div style="padding:6px 8px; background:' + bg + '; border-left:2px solid ' + color + '; font-size:0.6rem; color:' + color + '; margin-bottom:6px;">' +
      icon + ' ' + s.message;
    if (s.action) {
      html += '<button onclick=\'veFEAApplyRefinementSuggestion("' + node.id + '", "' + s.action.type + '", ' + JSON.stringify(s.action) + ')\' style="display:block; margin-top:4px; padding:4px 8px; font-size:0.58rem; background:' + color + '; color:#fff; border:none; cursor:pointer;">Uygula →</button>';
    }
    html += '</div>';
  });
  return html;
}
