// ============================================================================
// CAD EDITOR — Modal Pencere (FAZ-1: çoklu primitif kompozisyonu)
// ============================================================================
// fea-mesh-editor.js pattern'ini takip eder, ama daha basit. Layout:
//   - Header (başlık + kapat)
//   - Toolbar (Primitif ekle | Kaydet | İptal)
//   - Split body: SOL (feature tree + seçili feature params) + SAĞ (3D viewer)
//   - Footer (model özet: feature count, hacim)
//
// Public API:
//   veCADOpenEditor(nodeId)       → modal aç (geometry node için)
//   veCADCloseEditor()            → kapat
//   veCADSaveModelToNode(nodeId)  → modeli node.data.geometry'ye yaz
//
// Modal içi state (window-level):
//   _veCADActiveNodeId    → düzenlenen node ID
//   _veCADActiveModel     → düzenlenen model (henüz commit edilmemiş)
//   _veCADSelectedFeature → seçili feature ID
// ============================================================================

var _veCADActiveNodeId = null;
var _veCADActiveModel = null;
var _veCADSelectedFeature = null;
var _veCADOverlay = null;
var _veCADEscHandler = null;
var _veCADViewerHandle = null;   // veFEAInitViewer döner; dispose için
var _veCADResizeObserver = null;

// ─── Modal aç ──────────────────────────────────────────────────────────────
function veCADOpenEditor(nodeId) {
  if (_veCADActiveNodeId) veCADCloseEditor();
  if (typeof nodes === 'undefined') return;
  var node = nodes.find(function(n) { return n.id === nodeId; });
  if (!node) return;
  if (typeof THREE === 'undefined') {
    alert('CAD Editörü için Three.js gerekli — sayfa yenileyin.');
    return;
  }
  if (typeof veCADCreateModel !== 'function' || typeof veFEABuildPrimitiveMesh !== 'function') {
    alert('CAD Engine yüklenmedi.');
    return;
  }

  node.data = node.data || {};
  // Mevcut CAD modeli var mı? (önceden bu node CAD olarak kaydedilmiş)
  // Yoksa boş model + (varsa) mevcut primitifi otomatik ilk feature olarak ekle.
  var model;
  if (node.data.geometry && node.data.geometry.type === 'cad' && node.data.geometry.cadModel) {
    model = veCADDeserialize(node.data.geometry.cadModel);
  } else {
    model = veCADCreateModel();
    // Mevcut tek primitifi feature olarak migrate et (kullanıcı geçmiş çalışmasını
    // kaybetmesin). STEP geometrisi migrate edilmez (henüz tessellated mesh
    // editör'e import edilemiyor — Faz-3'te BREP entegrasyonuyla gelecek).
    var g = node.data.geometry;
    if (g && g.type && g.type !== 'step' && g.type !== 'cad' && g.params) {
      veCADAddFeature(model, g.type, g.params);
    }
  }
  _veCADActiveModel = model;
  _veCADActiveNodeId = nodeId;
  _veCADSelectedFeature = model.features.length > 0 ? model.features[0].id : null;

  // ─── Overlay ────────────────────────────────────────────────────────────
  var overlay = document.createElement('div');
  overlay.id = 've-cad-editor-overlay';
  overlay.style.cssText = 'position:fixed; inset:0; z-index:100000; background:rgba(0,0,0,0.82); display:flex; align-items:center; justify-content:center; padding:16px; backdrop-filter:blur(4px);';
  overlay.addEventListener('mousedown', function(e) {
    if (e.target === overlay) veCADCloseEditor();
  });

  // ─── Modal ───────────────────────────────────────────────────────────────
  var modal = document.createElement('div');
  modal.id = 've-cad-editor-modal';
  modal.style.cssText = 'width:95%; max-width:1500px; min-width:720px; height:88vh; max-height:950px; background:var(--bg-secondary, #0f1218); border:1px solid var(--border-color, #1c2333); border-radius:0; display:flex; flex-direction:column; overflow:hidden; box-shadow:0 20px 60px rgba(0,0,0,0.6);';

  modal.appendChild(_veCADBuildHeader(node));
  modal.appendChild(_veCADBuildToolbar());

  var body = document.createElement('div');
  body.id = 've-cad-editor-body';
  body.style.cssText = 'flex:1; display:flex; flex-direction:row; min-height:0; overflow:hidden;';
  body.appendChild(_veCADBuildLeftPanel());
  body.appendChild(_veCADBuildRightPanel());
  modal.appendChild(body);

  modal.appendChild(_veCADBuildFooter());

  overlay.appendChild(modal);
  document.body.appendChild(overlay);
  _veCADOverlay = overlay;

  // ESC ile kapat
  _veCADEscHandler = function(e) {
    if (e.key === 'Escape') veCADCloseEditor();
  };
  document.addEventListener('keydown', _veCADEscHandler);

  // Layout settle olduktan sonra viewer init
  _veCADSafeInitViewer(6);
}

// ─── Modal kapat ───────────────────────────────────────────────────────────
function veCADCloseEditor() {
  if (_veCADEscHandler) {
    document.removeEventListener('keydown', _veCADEscHandler);
    _veCADEscHandler = null;
  }
  if (_veCADResizeObserver) {
    try { _veCADResizeObserver.disconnect(); } catch(e) {}
    _veCADResizeObserver = null;
  }
  if (_veCADViewerHandle && typeof _veCADViewerHandle.dispose === 'function') {
    try { _veCADViewerHandle.dispose(); } catch(e) {}
  }
  _veCADViewerHandle = null;

  if (_veCADOverlay && _veCADOverlay.parentNode) {
    _veCADOverlay.parentNode.removeChild(_veCADOverlay);
  }
  _veCADOverlay = null;
  _veCADActiveNodeId = null;
  _veCADActiveModel = null;
  _veCADSelectedFeature = null;
}

// ─── Header ────────────────────────────────────────────────────────────────
function _veCADBuildHeader(node) {
  var hdr = document.createElement('div');
  hdr.style.cssText = 'flex:0 0 auto; display:flex; align-items:center; justify-content:space-between; padding:10px 16px; background:var(--bg-primary, #0a0d14); border-bottom:1px solid var(--border-color, #1c2333);';

  var title = document.createElement('div');
  title.style.cssText = 'font-size:0.88rem; font-weight:700; color:var(--text-heading, #fff); letter-spacing:0.04em;';
  var nodeName = (node.customName) || (node.def && node.def.name) || 'Geometri';
  title.innerHTML = '🎨 CAD Editörü — <span style="font-weight:400; color:var(--text-secondary, #888);">' + _veCADEscape(nodeName) + '</span>';

  var sub = document.createElement('div');
  sub.style.cssText = 'font-size:0.6rem; color:var(--text-muted, #777); font-style:italic;';
  sub.textContent = 'Backend: ' + veCADBackendLabel();

  var left = document.createElement('div');
  left.appendChild(title);
  left.appendChild(sub);

  var close = document.createElement('button');
  close.textContent = '✕';
  close.title = 'Kapat (ESC)';
  close.style.cssText = 'width:28px; height:28px; padding:0; font-size:1rem; background:transparent; color:var(--text-secondary, #888); border:1px solid var(--border-color, #1c2333); cursor:pointer;';
  close.onmouseenter = function() { close.style.borderColor = 'var(--accent-danger, #ef4444)'; close.style.color = 'var(--accent-danger, #ef4444)'; };
  close.onmouseleave = function() { close.style.borderColor = 'var(--border-color, #1c2333)'; close.style.color = 'var(--text-secondary, #888)'; };
  close.onclick = veCADCloseEditor;

  hdr.appendChild(left);
  hdr.appendChild(close);
  return hdr;
}

// ─── Toolbar ───────────────────────────────────────────────────────────────
function _veCADBuildToolbar() {
  var bar = document.createElement('div');
  bar.id = 've-cad-editor-toolbar';
  bar.style.cssText = 'flex:0 0 auto; display:flex; align-items:center; gap:8px; padding:8px 16px; background:var(--bg-secondary, #0f1218); border-bottom:1px solid var(--border-color, #1c2333); flex-wrap:wrap;';

  // Primitif ekle dropdown
  var types = (typeof veFEAPrimitiveTypes === 'function') ? veFEAPrimitiveTypes() : [];
  var sel = document.createElement('select');
  sel.id = 've-cad-add-primitive-select';
  sel.style.cssText = 'padding:6px 8px; font-size:0.7rem; background:var(--bg-tertiary, #14181f); color:var(--text-primary, #ddd); border:1px solid var(--border-color, #1c2333); cursor:pointer;';
  sel.innerHTML = '<option value="">+ Primitif Ekle...</option>' +
    types.map(function(t) {
      var label = (typeof veFEAPrimitiveLabel === 'function') ? veFEAPrimitiveLabel(t) : t;
      return '<option value="' + t + '">' + _veCADEscape(label) + '</option>';
    }).join('');
  sel.onchange = function() {
    if (sel.value) {
      _veCADAddFeatureUI(sel.value);
      sel.value = '';
    }
  };

  // Boolean (yakında) — Faz-2 için placeholder
  var boolBtn = document.createElement('button');
  boolBtn.textContent = '∪ Boolean (yakında)';
  boolBtn.title = 'Faz-2: union / sub / intersect (three-bvh-csg ile)';
  boolBtn.disabled = true;
  boolBtn.style.cssText = 'padding:6px 10px; font-size:0.7rem; background:var(--bg-tertiary, #14181f); color:var(--text-muted, #777); border:1px solid var(--border-color, #1c2333); cursor:not-allowed; opacity:0.55;';

  // Sketch (yakında) — Faz-3 için placeholder
  var sketchBtn = document.createElement('button');
  sketchBtn.textContent = '✏ Sketch (yakında)';
  sketchBtn.title = 'Faz-3: 2D sketch + extrude/revolve (Replicad / OpenCascade.js)';
  sketchBtn.disabled = true;
  sketchBtn.style.cssText = boolBtn.style.cssText;

  // Spacer
  var spacer = document.createElement('div');
  spacer.style.cssText = 'flex:1;';

  // Save / Cancel
  var saveBtn = document.createElement('button');
  saveBtn.textContent = '💾 Kaydet ve Kapat';
  saveBtn.title = 'Modeli geometry olarak node\'a yaz';
  saveBtn.style.cssText = 'padding:7px 14px; font-size:0.72rem; font-weight:700; background:var(--accent-primary, #3b82f6); color:#fff; border:none; cursor:pointer; letter-spacing:0.03em;';
  saveBtn.onmouseenter = function() { saveBtn.style.filter = 'brightness(1.15)'; };
  saveBtn.onmouseleave = function() { saveBtn.style.filter = 'none'; };
  saveBtn.onclick = function() { veCADSaveModelToNode(_veCADActiveNodeId); };

  var cancelBtn = document.createElement('button');
  cancelBtn.textContent = 'İptal';
  cancelBtn.style.cssText = 'padding:7px 14px; font-size:0.72rem; background:var(--bg-tertiary, #14181f); color:var(--text-primary, #ddd); border:1px solid var(--border-color, #1c2333); cursor:pointer;';
  cancelBtn.onclick = veCADCloseEditor;

  bar.appendChild(sel);
  bar.appendChild(boolBtn);
  bar.appendChild(sketchBtn);
  bar.appendChild(spacer);
  bar.appendChild(cancelBtn);
  bar.appendChild(saveBtn);
  return bar;
}

// ─── Sol panel: feature tree + seçili feature parametreleri ────────────────
function _veCADBuildLeftPanel() {
  var panel = document.createElement('div');
  panel.id = 've-cad-editor-left';
  panel.style.cssText = 'flex:0 0 320px; min-width:260px; max-width:50%; border-right:1px solid var(--border-color, #1c2333); display:flex; flex-direction:column; overflow:hidden;';

  // Feature tree başlık
  var treeHdr = document.createElement('div');
  treeHdr.style.cssText = 'flex:0 0 auto; padding:10px 14px; font-size:0.7rem; font-weight:700; color:var(--text-heading, #fff); background:var(--bg-primary, #0a0d14); border-bottom:1px solid var(--border-color, #1c2333); letter-spacing:0.04em;';
  treeHdr.textContent = 'Feature Tree';

  var tree = document.createElement('div');
  tree.id = 've-cad-feature-tree';
  tree.style.cssText = 'flex:0 0 auto; max-height:40%; overflow-y:auto; background:var(--bg-secondary, #0f1218); border-bottom:1px solid var(--border-color, #1c2333);';

  var paramHdr = document.createElement('div');
  paramHdr.style.cssText = 'flex:0 0 auto; padding:10px 14px; font-size:0.7rem; font-weight:700; color:var(--text-heading, #fff); background:var(--bg-primary, #0a0d14); border-bottom:1px solid var(--border-color, #1c2333); letter-spacing:0.04em;';
  paramHdr.textContent = 'Parametreler';

  var paramBody = document.createElement('div');
  paramBody.id = 've-cad-param-body';
  paramBody.style.cssText = 'flex:1; overflow-y:auto; padding:12px 14px; background:var(--bg-secondary, #0f1218);';

  panel.appendChild(treeHdr);
  panel.appendChild(tree);
  panel.appendChild(paramHdr);
  panel.appendChild(paramBody);

  // İçerikleri ilk render
  setTimeout(function() {
    _veCADRefreshTree();
    _veCADRefreshParamPanel();
  }, 0);
  return panel;
}

// ─── Sağ panel: 3D viewer ──────────────────────────────────────────────────
function _veCADBuildRightPanel() {
  var panel = document.createElement('div');
  panel.id = 've-cad-editor-right';
  panel.style.cssText = 'flex:1; display:flex; flex-direction:column; min-width:0;';

  var hdr = document.createElement('div');
  hdr.style.cssText = 'flex:0 0 auto; padding:8px 14px; font-size:0.66rem; color:var(--text-secondary, #888); background:var(--bg-primary, #0a0d14); border-bottom:1px solid var(--border-color, #1c2333); display:flex; justify-content:space-between; align-items:center;';
  hdr.innerHTML = '<span>3D Önizleme — Sol drag: orbit · Sağ drag: pan · Wheel: zoom</span>' +
    '<button id="ve-cad-fit-btn" style="padding:4px 8px; font-size:0.6rem; background:var(--bg-tertiary, #14181f); color:var(--text-primary, #ddd); border:1px solid var(--border-color, #1c2333); cursor:pointer;">⛶ Sığdır</button>';

  var canvasWrap = document.createElement('div');
  canvasWrap.style.cssText = 'flex:1; position:relative; min-height:0; background:#1a1a1a;';
  var canvas = document.createElement('canvas');
  canvas.id = 've-cad-editor-canvas';
  canvas.style.cssText = 'display:block; width:100%; height:100%; cursor:grab;';
  canvasWrap.appendChild(canvas);

  panel.appendChild(hdr);
  panel.appendChild(canvasWrap);

  // Fit butonu — viewer init'ten sonra bağlanır
  setTimeout(function() {
    var fitBtn = document.getElementById('ve-cad-fit-btn');
    if (fitBtn) fitBtn.onclick = function() {
      if (_veCADViewerHandle && typeof _veCADViewerHandle.fitToGeometry === 'function') {
        _veCADViewerHandle.fitToGeometry();
      } else if (_veCADViewerHandle && typeof _veCADViewerHandle.zoomToFit === 'function') {
        var root = _veCADViewerHandle._geometryRoot;
        if (root) _veCADViewerHandle.zoomToFit(root);
      }
    };
  }, 0);

  return panel;
}

// ─── Footer ────────────────────────────────────────────────────────────────
function _veCADBuildFooter() {
  var foot = document.createElement('div');
  foot.id = 've-cad-editor-footer';
  foot.style.cssText = 'flex:0 0 auto; padding:8px 16px; background:var(--bg-primary, #0a0d14); border-top:1px solid var(--border-color, #1c2333); font-size:0.62rem; color:var(--text-secondary, #888); display:flex; gap:18px; align-items:center;';
  _veCADRefreshFooter(foot);
  return foot;
}

function _veCADRefreshFooter(footEl) {
  var foot = footEl || document.getElementById('ve-cad-editor-footer');
  if (!foot || !_veCADActiveModel) return;
  var stats = veCADComputeStats(_veCADActiveModel);
  var volStr = (typeof veFEAFormatVolume === 'function') ? veFEAFormatVolume(stats.volume) : (stats.volume.toFixed(1) + ' mm³');
  var areaStr = (typeof veFEAFormatArea === 'function') ? veFEAFormatArea(stats.surfaceArea) : (stats.surfaceArea.toFixed(1) + ' mm²');
  var bbxStr = (typeof veFEAFormatBBox === 'function') ? veFEAFormatBBox(stats.bbox) : '—';
  foot.innerHTML =
    '<span><b>' + _veCADActiveModel.features.length + '</b> feature</span>' +
    '<span>Hacim: <b>' + volStr + '</b></span>' +
    '<span>Yüzey: <b>' + areaStr + '</b></span>' +
    '<span>BBox: <b>' + bbxStr + '</b></span>' +
    (veCADHasBoolean() ? '' : '<span style="color:var(--accent-warning, #f59e0b); font-style:italic;">⚠ Çakışan parça hacmi 2× sayılabilir (boolean Faz-2\'de)</span>');
}

// ─── Feature tree render ───────────────────────────────────────────────────
function _veCADRefreshTree() {
  var tree = document.getElementById('ve-cad-feature-tree');
  if (!tree || !_veCADActiveModel) return;
  if (_veCADActiveModel.features.length === 0) {
    tree.innerHTML = '<div style="padding:14px; font-size:0.66rem; color:var(--text-muted, #777); font-style:italic; text-align:center;">Henüz feature yok — Toolbar\'dan primitif ekleyin.</div>';
    return;
  }
  var html = '';
  _veCADActiveModel.features.forEach(function(f, idx) {
    var isSel = (f.id === _veCADSelectedFeature);
    var label = (typeof veFEAPrimitiveLabel === 'function') ? veFEAPrimitiveLabel(f.type) : f.type;
    html += '<div data-feat="' + f.id + '" onclick="_veCADSelectFeature(\'' + f.id + '\')" style="display:flex; align-items:center; gap:6px; padding:7px 12px; cursor:pointer; font-size:0.66rem; color:' + (isSel ? '#fff' : 'var(--text-primary, #ddd)') + '; background:' + (isSel ? 'var(--accent-primary, #3b82f6)' : 'transparent') + '; border-bottom:1px solid var(--border-color, #1c2333);">' +
      '<span onclick="event.stopPropagation(); _veCADToggleVisible(\'' + f.id + '\')" title="Görünürlük" style="width:14px; text-align:center; cursor:pointer; opacity:' + (f.visible ? 1 : 0.35) + ';">' + (f.visible ? '👁' : '⊘') + '</span>' +
      '<span style="flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;"><b>' + _veCADEscape(f.name) + '</b> <span style="color:' + (isSel ? 'rgba(255,255,255,0.7)' : 'var(--text-muted, #777)') + ';">· ' + _veCADEscape(label) + '</span></span>' +
      '<button onclick="event.stopPropagation(); _veCADMoveFeatureUI(\'' + f.id + '\', \'up\')" title="Yukarı" style="width:18px; height:18px; padding:0; font-size:0.6rem; background:transparent; color:inherit; border:none; cursor:pointer; opacity:' + (idx === 0 ? 0.25 : 0.7) + ';">▲</button>' +
      '<button onclick="event.stopPropagation(); _veCADMoveFeatureUI(\'' + f.id + '\', \'down\')" title="Aşağı" style="width:18px; height:18px; padding:0; font-size:0.6rem; background:transparent; color:inherit; border:none; cursor:pointer; opacity:' + (idx === _veCADActiveModel.features.length - 1 ? 0.25 : 0.7) + ';">▼</button>' +
      '<button onclick="event.stopPropagation(); _veCADDeleteFeatureUI(\'' + f.id + '\')" title="Sil" style="width:18px; height:18px; padding:0; font-size:0.7rem; background:transparent; color:' + (isSel ? '#fff' : 'var(--accent-danger, #ef4444)') + '; border:none; cursor:pointer; opacity:0.85;">✕</button>' +
      '</div>';
  });
  tree.innerHTML = html;
}

// ─── Parametre panel render (seçili feature) ───────────────────────────────
function _veCADRefreshParamPanel() {
  var body = document.getElementById('ve-cad-param-body');
  if (!body || !_veCADActiveModel) return;
  if (!_veCADSelectedFeature) {
    body.innerHTML = '<div style="font-size:0.64rem; color:var(--text-muted, #777); font-style:italic;">Bir feature seçin.</div>';
    return;
  }
  var f = veCADGetFeature(_veCADActiveModel, _veCADSelectedFeature);
  if (!f) {
    body.innerHTML = '<div style="font-size:0.64rem; color:var(--text-muted, #777);">Feature bulunamadı.</div>';
    return;
  }
  var schema = (typeof veFEAPrimitiveSchema === 'function') ? veFEAPrimitiveSchema(f.type) : null;
  if (!schema) {
    body.innerHTML = '<div style="font-size:0.64rem; color:var(--accent-danger, #ef4444);">Şema yok: ' + _veCADEscape(f.type) + '</div>';
    return;
  }

  var html = '';
  // İsim
  html += '<div style="margin-bottom:10px;">';
  html += '<label style="display:block; font-size:0.6rem; color:var(--text-secondary, #888); margin-bottom:3px;">İsim</label>';
  html += '<input type="text" id="ve-cad-feat-name" value="' + _veCADEscapeAttr(f.name) + '" oninput="_veCADCommitName(this.value)" style="width:100%; padding:5px 7px; font-size:0.7rem; background:var(--bg-input, #14181f); color:var(--text-primary, #ddd); border:1px solid var(--border-color, #1c2333);">';
  html += '</div>';

  // Parametreler
  html += '<div style="font-size:0.6rem; color:var(--text-secondary, #888); margin-bottom:5px; padding-top:6px; border-top:1px solid var(--border-color, #1c2333);">Geometri Parametreleri (mm)</div>';
  schema.forEach(function(p) {
    var iid = 've-cad-param-' + p.key;
    html += '<div style="display:flex; align-items:center; justify-content:space-between; gap:8px; margin-bottom:5px;">';
    html += '<label for="' + iid + '" style="font-size:0.62rem; color:var(--text-secondary, #888); flex:1;">' + _veCADEscape(p.label) + '</label>';
    html += '<input id="' + iid + '" type="number" value="' + (f.params[p.key] !== undefined ? f.params[p.key] : p.default) + '" min="' + (p.min !== undefined ? p.min : '') + '" max="' + (p.max !== undefined ? p.max : '') + '" step="' + (p.integer ? '1' : '0.1') + '" oninput="_veCADCommitParam(\'' + _veCADEscapeAttr(p.key) + '\', this.value)" style="width:80px; padding:3px 6px; font-size:0.62rem; background:var(--bg-input, #14181f); color:var(--text-primary, #ddd); border:1px solid var(--border-color, #1c2333);">';
    html += '<span style="font-size:0.55rem; color:var(--text-muted, #777); width:18px;">' + _veCADEscape(p.unit) + '</span>';
    html += '</div>';
  });

  // Transform
  html += '<div style="font-size:0.6rem; color:var(--text-secondary, #888); margin:12px 0 5px; padding-top:6px; border-top:1px solid var(--border-color, #1c2333);">Konum (mm) / Rotasyon (°)</div>';
  ['tx','ty','tz'].forEach(function(k, i) {
    var lbl = ['X','Y','Z'][i] + ' (konum)';
    html += '<div style="display:flex; align-items:center; gap:8px; margin-bottom:4px;">';
    html += '<label style="font-size:0.62rem; color:var(--text-secondary, #888); flex:1;">' + lbl + '</label>';
    html += '<input type="number" value="' + (f.transform[k] || 0) + '" step="1" oninput="_veCADCommitTransform(\'' + k + '\', this.value)" style="width:80px; padding:3px 6px; font-size:0.62rem; background:var(--bg-input, #14181f); color:var(--text-primary, #ddd); border:1px solid var(--border-color, #1c2333);">';
    html += '<span style="font-size:0.55rem; color:var(--text-muted, #777); width:18px;">mm</span>';
    html += '</div>';
  });
  ['rx','ry','rz'].forEach(function(k, i) {
    var lbl = ['X','Y','Z'][i] + ' (dönüş)';
    html += '<div style="display:flex; align-items:center; gap:8px; margin-bottom:4px;">';
    html += '<label style="font-size:0.62rem; color:var(--text-secondary, #888); flex:1;">' + lbl + '</label>';
    html += '<input type="number" value="' + (f.transform[k] || 0) + '" step="5" oninput="_veCADCommitTransform(\'' + k + '\', this.value)" style="width:80px; padding:3px 6px; font-size:0.62rem; background:var(--bg-input, #14181f); color:var(--text-primary, #ddd); border:1px solid var(--border-color, #1c2333);">';
    html += '<span style="font-size:0.55rem; color:var(--text-muted, #777); width:18px;">°</span>';
    html += '</div>';
  });

  body.innerHTML = html;
}

// ─── Feature ekle (UI handler) ─────────────────────────────────────────────
function _veCADAddFeatureUI(type) {
  if (!_veCADActiveModel) return;
  var f = veCADAddFeature(_veCADActiveModel, type);
  if (f) {
    _veCADSelectedFeature = f.id;
    _veCADRefreshAll();
  }
}

// ─── Seç ───────────────────────────────────────────────────────────────────
function _veCADSelectFeature(featureId) {
  if (_veCADSelectedFeature === featureId) return;
  _veCADSelectedFeature = featureId;
  _veCADRefreshTree();
  _veCADRefreshParamPanel();
}

// ─── Görünürlük toggle ─────────────────────────────────────────────────────
function _veCADToggleVisible(featureId) {
  if (!_veCADActiveModel) return;
  var f = veCADGetFeature(_veCADActiveModel, featureId);
  if (!f) return;
  veCADUpdateFeature(_veCADActiveModel, featureId, { visible: !f.visible });
  _veCADRefreshAll();
}

// ─── Sırala ────────────────────────────────────────────────────────────────
function _veCADMoveFeatureUI(featureId, direction) {
  if (!_veCADActiveModel) return;
  if (veCADMoveFeature(_veCADActiveModel, featureId, direction)) {
    _veCADRefreshTree();
    // Sıralama 3D görünümü değiştirmiyor (boolean yok) ama gelecek için
    // viewer'ı tutarlı tutmak için yine de yeniden çiz.
    _veCADRefreshViewer();
  }
}

// ─── Sil ───────────────────────────────────────────────────────────────────
function _veCADDeleteFeatureUI(featureId) {
  if (!_veCADActiveModel) return;
  if (!confirm('Bu feature silinsin mi?')) return;
  veCADRemoveFeature(_veCADActiveModel, featureId);
  if (_veCADSelectedFeature === featureId) {
    _veCADSelectedFeature = _veCADActiveModel.features.length > 0 ? _veCADActiveModel.features[0].id : null;
  }
  _veCADRefreshAll();
}

// ─── İsim commit ───────────────────────────────────────────────────────────
function _veCADCommitName(val) {
  if (!_veCADActiveModel || !_veCADSelectedFeature) return;
  veCADUpdateFeature(_veCADActiveModel, _veCADSelectedFeature, { name: val });
  _veCADRefreshTree();
}

// ─── Param commit (debounce'siz; her tuş basımında viewer güncellenir) ─────
function _veCADCommitParam(key, valStr) {
  if (!_veCADActiveModel || !_veCADSelectedFeature) return;
  var v = parseFloat(valStr);
  if (!isFinite(v)) return;
  var update = { params: {} };
  update.params[key] = v;
  veCADUpdateFeature(_veCADActiveModel, _veCADSelectedFeature, update);
  _veCADRefreshViewer();
  _veCADRefreshFooter();
}

// ─── Transform commit ──────────────────────────────────────────────────────
function _veCADCommitTransform(key, valStr) {
  if (!_veCADActiveModel || !_veCADSelectedFeature) return;
  var v = parseFloat(valStr);
  if (!isFinite(v)) return;
  var update = { transform: {} };
  update.transform[key] = v;
  veCADUpdateFeature(_veCADActiveModel, _veCADSelectedFeature, update);
  _veCADRefreshViewer();
  _veCADRefreshFooter();
}

// ─── Tüm UI'yi yenile ──────────────────────────────────────────────────────
function _veCADRefreshAll() {
  _veCADRefreshTree();
  _veCADRefreshParamPanel();
  _veCADRefreshViewer();
  _veCADRefreshFooter();
}

// ─── Viewer içeriğini güncelle ─────────────────────────────────────────────
// Yeni THREE.Group inşa eder, viewer._geometryRoot'a koyar, fit eder.
function _veCADRefreshViewer() {
  if (!_veCADViewerHandle || !_veCADActiveModel) return;
  var root = _veCADViewerHandle._geometryRoot;
  if (!root) return;

  // Eski içeriği temizle ve dispose et
  while (root.children.length > 0) {
    var child = root.children[0];
    root.remove(child);
    child.traverse(function(o) {
      if (o.geometry && o.geometry.dispose) try { o.geometry.dispose(); } catch(e) {}
      if (o.material) {
        var mats = Array.isArray(o.material) ? o.material : [o.material];
        mats.forEach(function(m) { if (m.dispose) try { m.dispose(); } catch(e) {} });
      }
    });
  }

  var sceneGroup = veCADBuildScene(_veCADActiveModel);
  if (sceneGroup && sceneGroup.children.length > 0) {
    // Children'ları doğrudan root'a aktar (group içinde group olmasın)
    while (sceneGroup.children.length > 0) {
      root.add(sceneGroup.children[0]);
    }
    if (typeof _veCADViewerHandle.zoomToFit === 'function') {
      _veCADViewerHandle.zoomToFit(root);
    }
  }
  if (typeof _veCADViewerHandle._collectFaceMaterials === 'function') {
    _veCADViewerHandle._collectFaceMaterials();
  }
}

// ─── Modeli node'a kaydet ──────────────────────────────────────────────────
function veCADSaveModelToNode(nodeId) {
  if (!_veCADActiveModel || typeof nodes === 'undefined') return;
  var node = nodes.find(function(n) { return n.id === nodeId; });
  if (!node) return;

  if (_veCADActiveModel.features.length === 0) {
    if (!confirm('Boş CAD modeli kaydedilecek (geometri silinir). Devam edilsin mi?')) return;
    node.data = node.data || {};
    delete node.data.geometry;
  } else {
    var parsed = veCADTessellate(_veCADActiveModel);
    var stats = (typeof veFEAComputeMeshStats === 'function')
      ? veFEAComputeMeshStats({ vertices: parsed.vertices, triangleCount: parsed.triangleCount })
      : { volume: 0, surfaceArea: 0, bbox: { x: 0, y: 0, z: 0 } };

    node.data = node.data || {};
    node.data.geometry = {
      type: 'cad',
      cadModel: veCADSerialize(_veCADActiveModel),
      // FEA mesh pipeline'ı veFEABuildTriangleMesh / veFEAMesh için
      // STEP ile aynı formatta üçgenler bekler.
      vertices: parsed.vertices,
      normals:  parsed.normals,
      triangleCount: parsed.triangleCount,
      volume:        stats.volume,
      surfaceArea:   stats.surfaceArea,
      bbox:          stats.bbox,
      sourceLabel:   (typeof veCADSummaryLabel === 'function') ? veCADSummaryLabel(_veCADActiveModel) : 'CAD Modeli',
      persistNote:   'Üçgen mesh büyük dosyalarda proje JSON\'una dahil edilmez; CAD model tanımı yeniden tessellate edilir.'
    };
    if (typeof saveState === 'function') saveState();
  }

  veCADCloseEditor();

  // Side panel'i yenile (mevcut viewer'ı dispose edip yeniden yedirsin)
  if (typeof veFEAViewerRegistry !== 'undefined' && veFEAViewerRegistry[nodeId]) {
    try { veFEAViewerRegistry[nodeId].dispose(); } catch(e) {}
    delete veFEAViewerRegistry[nodeId];
  }
  if (typeof showNodeProperties === 'function') showNodeProperties(node);
}

// ─── Viewer init (layout settle'ı bekle) ───────────────────────────────────
function _veCADSafeInitViewer(retries) {
  if (!_veCADActiveNodeId) return;
  if (typeof veFEAInitViewer !== 'function') return;
  var canvas = document.getElementById('ve-cad-editor-canvas');
  if (!canvas) {
    if (retries > 0) requestAnimationFrame(function() { _veCADSafeInitViewer(retries - 1); });
    return;
  }
  var w = canvas.clientWidth || (canvas.parentElement && canvas.parentElement.clientWidth) || 0;
  var h = canvas.clientHeight || (canvas.parentElement && canvas.parentElement.clientHeight) || 0;
  if ((w < 50 || h < 50) && retries > 0) {
    requestAnimationFrame(function() { _veCADSafeInitViewer(retries - 1); });
    return;
  }
  if (w < 50 || h < 50) return;

  canvas.width = w;
  canvas.height = h;

  try {
    _veCADViewerHandle = veFEAInitViewer(canvas, { width: w, height: h, gizmo: true });
  } catch (e) {
    console.error('[CAD Editor] viewer init hatası:', e);
    return;
  }
  if (!_veCADViewerHandle) return;

  _veCADRefreshViewer();

  // Container resize'larında senkronize tut
  if (typeof ResizeObserver !== 'undefined' && canvas.parentElement) {
    _veCADResizeObserver = new ResizeObserver(function() {
      var c = document.getElementById('ve-cad-editor-canvas');
      if (!c || !_veCADViewerHandle || typeof _veCADViewerHandle.resize !== 'function') return;
      var nw = c.clientWidth | 0;
      var nh = c.clientHeight | 0;
      if (nw > 0 && nh > 0) _veCADViewerHandle.resize(nw, nh);
    });
    _veCADResizeObserver.observe(canvas.parentElement);
  }
}

// ─── HTML escape yardımcıları ──────────────────────────────────────────────
function _veCADEscape(s) {
  if (s === null || s === undefined) return '';
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function _veCADEscapeAttr(s) {
  if (s === null || s === undefined) return '';
  return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
