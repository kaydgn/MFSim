// ============================================================================
// FEA MESH CONTROLS — Yeni Lokal Kontrol Tipleri + Detail Renderer'ları
// ============================================================================
// fea-mesh-outline.js'in tamamlayıcısı. Outline'da seçilen bir LOKAL KONTROL
// ITEM'ı için Details Pane HTML'ini üretir. Yeni eklenen tipler:
//
//   • Body Sizing      — body bazlı lokal eleman boyutu
//   • Refinement       — face/edge/vertex etrafında 1-3 seviye bölme
//   • Method Override  — bir body için mesh yöntemini global'in yerine geçirir
//
// Ayrıca mevcut Face Sizing, Edge Sizing, Sphere of Influence, Virtual
// Topology kontrol tipleri için outline-uyumlu (tek-item) detail formları.
//
// Mesher entegrasyonu (fea-mesh.js):
//   • Body Sizing      → mesh build başlatılırken meshSettings.size override
//                        (Faz 2'de gerçek per-body size-field; v1: bilgi ek alanı)
//   • Refinement       → mesh sonrası refine pass (v1: yapısal cell-by-2 split;
//                        karmaşık geometrilerde named selection üretir)
//   • Method Override  → veFEABuildMeshForNode → per-body elementType
//                        (v1: tek body için top-level method'ı override eder)
//
// Tüm değişiklikler `meshSettings.suppressFlags['cl:<type>[<idx>]'] === true`
// olduğunda mesher tarafından atlanır.
// ============================================================================

(function(global) {
  'use strict';

  // ─────────────────────────────────────────────────────────────────────────
  // 1. Yardımcılar
  // ─────────────────────────────────────────────────────────────────────────

  function _esc(s) {
    if (s == null) return '';
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function _outlineId(controlType, idx) {
    return 'cl:' + controlType + '[' + idx + ']';
  }

  function _getControl(meshNode, controlType, idx) {
    if (!global.FEAMeshOutline) return null;
    var list = global.FEAMeshOutline._getControlList(meshNode, controlType);
    return list[idx] || null;
  }

  function _setField(controlType, idx, fieldPath, value) {
    if (!global.FEAMeshOutline) return;
    global.FEAMeshOutline.updateControlField(_outlineId(controlType, idx), fieldPath, value);
  }

  // Geometri topology'sini upstream geometry node'undan çek
  function _getTopology(meshNode) {
    if (!meshNode) return null;
    if (typeof global.veFEAFindUpstreamGeometryNode !== 'function') return null;
    var geomNode = global.veFEAFindUpstreamGeometryNode(meshNode.id);
    if (!geomNode || !geomNode.data || !geomNode.data.geometry) return null;
    if (typeof global.veFEAComputeGeometryTopology !== 'function') return null;
    try { return global.veFEAComputeGeometryTopology(geomNode.data.geometry); }
    catch (e) { return null; }
  }

  function _bodyList(meshNode) {
    var topo = _getTopology(meshNode);
    // Şu an MFSim'in geometri modeli single-body. Topology.bodies çoklu olduğunda
    // doğrudan kullanılır; yoksa virtual single body id=0.
    if (topo && Array.isArray(topo.bodies) && topo.bodies.length > 0) return topo.bodies;
    return [{ id: 0, label: 'Body 1' }];
  }

  function _faceList(meshNode) {
    var topo = _getTopology(meshNode);
    return (topo && Array.isArray(topo.faces)) ? topo.faces : [];
  }

  function _edgeList(meshNode) {
    var topo = _getTopology(meshNode);
    return (topo && Array.isArray(topo.edges)) ? topo.edges : [];
  }

  function _vertexList(meshNode) {
    var topo = _getTopology(meshNode);
    if (!topo) return [];
    if (Array.isArray(topo.vertices)) return topo.vertices;
    // bazı topology üreteçleri vertices'i {count} olarak veriyor
    if (topo.vertices && typeof topo.vertices.count === 'number') {
      var arr = [];
      for (var i = 0; i < topo.vertices.count; i++) arr.push({ id: i, label: 'V' + i });
      return arr;
    }
    return [];
  }

  function _faceLabel(meshNode, faceId) {
    var faces = _faceList(meshNode);
    for (var i = 0; i < faces.length; i++) {
      if (faces[i].id === faceId) return faces[i].label || ('F' + faceId);
    }
    return 'F' + faceId;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 2. ORTAK ALT BİLEŞENLER
  // ─────────────────────────────────────────────────────────────────────────

  function _sectionTitle(text) {
    return '<div style="font-size:0.58rem; font-weight:700; letter-spacing:0.06em; text-transform:uppercase; color:var(--text-muted); margin:8px 0 4px; padding:2px 0; border-bottom:1px solid var(--border-color);">' + _esc(text) + '</div>';
  }

  function _row(label, control) {
    return '<div style="display:flex; align-items:center; gap:8px; margin-bottom:6px; font-size:0.62rem;">' +
      '<label style="flex:0 0 110px; color:var(--text-secondary);">' + _esc(label) + '</label>' +
      '<div style="flex:1; min-width:0;">' + control + '</div>' +
      '</div>';
  }

  function _renameRow(controlType, idx, currentName, defaultName) {
    var oid = _outlineId(controlType, idx);
    var safe = _esc(currentName || '');
    var ph = _esc(defaultName || '');
    return _row('Ad',
      '<input type="text" value="' + safe + '" placeholder="' + ph + '" ' +
      'onchange="FEAMeshControls._setName(\'' + controlType + '\',' + idx + ', this.value)" ' +
      'style="width:100%; padding:4px 6px; font-size:0.62rem; background:var(--bg-input); color:var(--text-primary); border:1px solid var(--border-color);">'
    );
  }

  function _suppressBar(meshNode, controlType, idx) {
    var oid = _outlineId(controlType, idx);
    var suppressed = global.FEAMeshOutline.isSuppressed(meshNode, oid);
    var lbl = suppressed ? '◉ Aktifleştir (Unsuppress)' : '⊘ Suppress Et';
    var bg = suppressed ? 'var(--accent-success, #22c55e)' : 'var(--bg-tertiary)';
    var fg = suppressed ? '#fff' : 'var(--accent-warning, #f59e0b)';
    return '<button onclick="FEAMeshOutline.toggleSuppress(\'' + oid + '\')" style="padding:5px 10px; font-size:0.6rem; font-weight:600; background:' + bg + '; color:' + fg + '; border:1px solid var(--border-color); cursor:pointer;">' + lbl + '</button>';
  }

  function _deleteBtn(controlType, idx) {
    var oid = _outlineId(controlType, idx);
    return '<button onclick="if(confirm(\'Bu kontrolü silmek istediğine emin misin?\')) FEAMeshOutline.removeControl(\'' + oid + '\')" style="padding:5px 10px; font-size:0.6rem; font-weight:600; background:var(--accent-danger, #ef4444); color:#fff; border:none; cursor:pointer;">🗑 Sil</button>';
  }

  function _multiSelect(items, selected, onChange, options) {
    options = options || {};
    var maxH = options.maxHeight || '120px';
    var html = '<div style="max-height:' + maxH + '; overflow-y:auto; border:1px solid var(--border-color); background:var(--bg-input); padding:4px;">';
    if (items.length === 0) {
      html += '<div style="font-size:0.58rem; color:var(--text-muted); padding:4px;">— seçenek yok —</div>';
    } else {
      items.forEach(function(it) {
        var checked = selected.indexOf(it.id) >= 0;
        html += '<label style="display:flex; align-items:center; gap:6px; padding:2px 4px; font-size:0.6rem; cursor:pointer;" onmouseenter="this.style.background=\'rgba(148,163,184,0.1)\'" onmouseleave="this.style.background=\'transparent\'">';
        html += '<input type="checkbox"' + (checked ? ' checked' : '') + ' ' +
                'onchange="(' + onChange + ')(' + JSON.stringify(it.id) + ', this.checked)" style="margin:0;">';
        html += '<span style="color:var(--text-primary);">' + _esc(it.label) + '</span>';
        html += '<span style="color:var(--text-muted); font-size:0.52rem;">#' + _esc(String(it.id)) + '</span>';
        html += '</label>';
      });
    }
    html += '</div>';
    return html;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 3. DETAIL RENDERER'LAR (her kontrol tipi için)
  // ─────────────────────────────────────────────────────────────────────────

  // ─── 3.1 BODY SIZING ─────────────────────────────────────────────────────
  function _renderBodySizingItem(meshNode, idx) {
    var c = _getControl(meshNode, 'bodySizing', idx);
    if (!c) return '<div style="padding:10px; color:var(--text-muted);">Kontrol bulunamadı.</div>';
    var ct = 'bodySizing';
    var bodies = _bodyList(meshNode);
    var defaultName = 'Body Sizing ' + (idx + 1);
    var html = '';
    html += _renameRow(ct, idx, c.name, defaultName);
    html += _sectionTitle('Scope (Body Seçimi)');
    html += _multiSelect(
      bodies.map(function(b) { return { id: b.id, label: b.label || ('Body ' + b.id) }; }),
      Array.isArray(c.bodyIds) ? c.bodyIds : [],
      'FEAMeshControls._toggleListId.bind(null, "' + ct + '",' + idx + ',"bodyIds")'
    );
    html += '<div style="font-size:0.55rem; color:var(--text-muted); margin-top:2px;">' + (Array.isArray(c.bodyIds) ? c.bodyIds.length : 0) + ' body seçili</div>';

    html += _sectionTitle('Parametreler');
    html += _row('Eleman boyutu',
      '<div style="display:flex; gap:6px; align-items:center;">' +
      '<input type="number" value="' + (c.size != null ? c.size : '') + '" step="0.1" min="0.01" ' +
      'onchange="FEAMeshControls._setField(\'' + ct + '\',' + idx + ',\'size\', parseFloat(this.value))" ' +
      'style="flex:1; padding:4px 6px; font-size:0.62rem; background:var(--bg-input); color:var(--text-primary); border:1px solid var(--border-color);">' +
      '<span style="font-size:0.55rem; color:var(--text-muted);">mm</span>' +
      '</div>'
    );
    html += _row('Behavior',
      '<select onchange="FEAMeshControls._setField(\'' + ct + '\',' + idx + ',\'behavior\', this.value)" style="width:100%; padding:4px 6px; font-size:0.62rem; background:var(--bg-input); color:var(--text-primary); border:1px solid var(--border-color);">' +
      '<option value="soft"' + (c.behavior === 'soft' || !c.behavior ? ' selected' : '') + '>Soft (override\'lanabilir)</option>' +
      '<option value="hard"' + (c.behavior === 'hard' ? ' selected' : '') + '>Hard (kesin uygula)</option>' +
      '</select>'
    );
    html += _row('Büyüme oranı',
      '<input type="number" value="' + (c.growthRate != null ? c.growthRate : 1.2) + '" step="0.05" min="1.0" max="5.0" ' +
      'onchange="FEAMeshControls._setField(\'' + ct + '\',' + idx + ',\'growthRate\', parseFloat(this.value))" ' +
      'style="width:100%; padding:4px 6px; font-size:0.62rem; background:var(--bg-input); color:var(--text-primary); border:1px solid var(--border-color);">'
    );

    html += '<div style="font-size:0.55rem; color:var(--text-muted); line-height:1.5; margin-top:8px; padding:6px 8px; background:rgba(59,130,246,0.08); border-left:2px solid var(--accent-primary, #3b82f6);">' +
      'ℹ <b>v1 davranış:</b> Body Sizing tek-body modelde global Element Size\'ı override eder. Multibody desteği Faz 2\'de.' +
      '</div>';

    html += '<div style="display:flex; gap:6px; margin-top:10px;">';
    html += _suppressBar(meshNode, ct, idx);
    html += _deleteBtn(ct, idx);
    html += '</div>';
    return html;
  }

  // ─── 3.2 FACE SIZING (tek-item) ──────────────────────────────────────────
  function _renderFaceSizingItem(meshNode, idx) {
    var c = _getControl(meshNode, 'faceSizing', idx);
    if (!c) return '<div style="padding:10px; color:var(--text-muted);">Kontrol bulunamadı.</div>';
    var ct = 'faceSizing';
    var faces = _faceList(meshNode);
    // faceIds (yeni) veya faceId (eski)
    var sel = Array.isArray(c.faceIds) ? c.faceIds.slice() : (c.faceId != null ? [c.faceId] : []);

    var html = '';
    html += _renameRow(ct, idx, c.name, 'Face Sizing ' + (idx + 1));
    html += _sectionTitle('Scope (Yüz Seçimi)');
    html += _multiSelect(
      faces.map(function(f) { return { id: f.id, label: f.label || ('Face ' + f.id) }; }),
      sel,
      'FEAMeshControls._toggleFaceSizingFace.bind(null,' + idx + ')'
    );
    html += '<div style="font-size:0.55rem; color:var(--text-muted); margin-top:2px;">' + sel.length + ' yüz seçili</div>';

    html += _sectionTitle('Parametreler');
    html += _row('Eleman boyutu',
      '<div style="display:flex; gap:6px; align-items:center;">' +
      '<input type="number" value="' + (c.size != null ? c.size : '') + '" step="0.1" min="0.01" ' +
      'onchange="FEAMeshControls._setField(\'' + ct + '\',' + idx + ',\'size\', parseFloat(this.value))" ' +
      'style="flex:1; padding:4px 6px; font-size:0.62rem; background:var(--bg-input); color:var(--text-primary); border:1px solid var(--border-color);">' +
      '<span style="font-size:0.55rem; color:var(--text-muted);">mm</span>' +
      '</div>'
    );
    html += _row('Behavior',
      '<select onchange="FEAMeshControls._setField(\'' + ct + '\',' + idx + ',\'behavior\', this.value)" style="width:100%; padding:4px 6px; font-size:0.62rem; background:var(--bg-input); color:var(--text-primary); border:1px solid var(--border-color);">' +
      '<option value="soft"' + (c.behavior !== 'hard' ? ' selected' : '') + '>Soft</option>' +
      '<option value="hard"' + (c.behavior === 'hard' ? ' selected' : '') + '>Hard</option>' +
      '</select>'
    );

    html += '<div style="display:flex; gap:6px; margin-top:10px;">';
    html += _suppressBar(meshNode, ct, idx);
    html += _deleteBtn(ct, idx);
    html += '</div>';
    return html;
  }

  // ─── 3.3 EDGE SIZING (tek-item) ──────────────────────────────────────────
  function _renderEdgeSizingItem(meshNode, idx) {
    var c = _getControl(meshNode, 'edgeSizing', idx);
    if (!c) return '<div style="padding:10px; color:var(--text-muted);">Kontrol bulunamadı.</div>';
    var ct = 'edgeSizing';
    var edges = _edgeList(meshNode);
    // Edge'lerin id/label haritası — bazı topology'lerde edges = {count}
    var edgeItems;
    if (edges.length > 0) {
      edgeItems = edges.map(function(e, i) { return { id: e.id != null ? e.id : i, label: e.label || ('Edge ' + (e.id != null ? e.id : i)) }; });
    } else {
      // Fallback: belirli sayıda generic edge
      var topo = _getTopology(meshNode);
      var n = (topo && topo.edges && topo.edges.count) ? topo.edges.count : 12;
      edgeItems = [];
      for (var i = 0; i < n; i++) edgeItems.push({ id: i, label: 'Edge ' + i });
    }
    var sel = Array.isArray(c.edgeIds) ? c.edgeIds.slice() : (c.edgeId != null ? [c.edgeId] : []);

    var html = '';
    html += _renameRow(ct, idx, c.name, 'Edge Sizing ' + (idx + 1));
    html += _sectionTitle('Scope (Kenar Seçimi)');
    html += _multiSelect(edgeItems, sel, 'FEAMeshControls._toggleEdgeSizingEdge.bind(null,' + idx + ')');
    html += '<div style="font-size:0.55rem; color:var(--text-muted); margin-top:2px;">' + sel.length + ' kenar seçili</div>';

    html += _sectionTitle('Parametreler');
    var useSize = !(c.divisions != null && isFinite(c.divisions));
    html += _row('Tip',
      '<select onchange="FEAMeshControls._setEdgeSizingMode(' + idx + ', this.value)" style="width:100%; padding:4px 6px; font-size:0.62rem; background:var(--bg-input); color:var(--text-primary); border:1px solid var(--border-color);">' +
      '<option value="size"' + (useSize ? ' selected' : '') + '>Element Size (mm)</option>' +
      '<option value="divisions"' + (!useSize ? ' selected' : '') + '>Number of Divisions</option>' +
      '</select>'
    );
    if (useSize) {
      html += _row('Eleman boyutu',
        '<div style="display:flex; gap:6px; align-items:center;">' +
        '<input type="number" value="' + (c.size != null ? c.size : '') + '" step="0.1" min="0.01" ' +
        'onchange="FEAMeshControls._setField(\'' + ct + '\',' + idx + ',\'size\', parseFloat(this.value))" ' +
        'style="flex:1; padding:4px 6px; font-size:0.62rem; background:var(--bg-input); color:var(--text-primary); border:1px solid var(--border-color);">' +
        '<span style="font-size:0.55rem; color:var(--text-muted);">mm</span>' +
        '</div>'
      );
    } else {
      html += _row('Bölme sayısı',
        '<input type="number" value="' + (c.divisions || 5) + '" step="1" min="1" max="500" ' +
        'onchange="FEAMeshControls._setField(\'' + ct + '\',' + idx + ',\'divisions\', parseInt(this.value,10))" ' +
        'style="width:100%; padding:4px 6px; font-size:0.62rem; background:var(--bg-input); color:var(--text-primary); border:1px solid var(--border-color);">'
      );
    }
    html += _row('Bias (yığılma)',
      '<div style="display:flex; gap:6px; align-items:center;">' +
      '<input type="range" min="0" max="100" step="5" value="' + Math.round((c.bias || 0) * 100) + '" ' +
      'oninput="FEAMeshControls._setField(\'' + ct + '\',' + idx + ',\'bias\', parseInt(this.value,10)/100); this.nextElementSibling.textContent=this.value+\'%\'" ' +
      'style="flex:1;">' +
      '<span style="width:34px; text-align:right; font-size:0.55rem; color:var(--text-muted);">' + Math.round((c.bias || 0) * 100) + '%</span>' +
      '</div>'
    );

    html += '<div style="display:flex; gap:6px; margin-top:10px;">';
    html += _suppressBar(meshNode, ct, idx);
    html += _deleteBtn(ct, idx);
    html += '</div>';
    return html;
  }

  // ─── 3.4 SPHERE OF INFLUENCE (tek-item) ──────────────────────────────────
  function _renderSoiItem(meshNode, idx) {
    var c = _getControl(meshNode, 'soi', idx);
    if (!c) return '<div style="padding:10px; color:var(--text-muted);">Kontrol bulunamadı.</div>';
    var ct = 'soi';
    var html = '';
    html += _renameRow(ct, idx, c.name, 'Sphere of Influence ' + (idx + 1));
    html += _sectionTitle('Konum (Merkez)');
    html += '<div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:6px; margin-bottom:8px;">';
    ['cx', 'cy', 'cz'].forEach(function(axis) {
      html += '<div>' +
        '<label style="display:block; font-size:0.55rem; color:var(--text-muted); margin-bottom:2px;">' + axis.toUpperCase() + ' (mm)</label>' +
        '<input type="number" value="' + (c[axis] != null ? c[axis] : 0) + '" step="0.5" ' +
        'onchange="FEAMeshControls._setField(\'' + ct + '\',' + idx + ',\'' + axis + '\', parseFloat(this.value))" ' +
        'style="width:100%; padding:4px 6px; font-size:0.62rem; background:var(--bg-input); color:var(--text-primary); border:1px solid var(--border-color);">' +
        '</div>';
    });
    html += '</div>';
    html += _sectionTitle('Parametreler');
    html += _row('Yarıçap',
      '<div style="display:flex; gap:6px; align-items:center;">' +
      '<input type="number" value="' + (c.radius != null ? c.radius : 10) + '" step="0.5" min="0.1" ' +
      'onchange="FEAMeshControls._setField(\'' + ct + '\',' + idx + ',\'radius\', parseFloat(this.value))" ' +
      'style="flex:1; padding:4px 6px; font-size:0.62rem; background:var(--bg-input); color:var(--text-primary); border:1px solid var(--border-color);">' +
      '<span style="font-size:0.55rem; color:var(--text-muted);">mm</span>' +
      '</div>'
    );
    html += _row('Hedef boyut',
      '<div style="display:flex; gap:6px; align-items:center;">' +
      '<input type="number" value="' + (c.targetSize != null ? c.targetSize : '') + '" step="0.1" min="0.01" placeholder="(opsiyonel)" ' +
      'onchange="FEAMeshControls._setSoiTargetSize(' + idx + ', this.value)" ' +
      'style="flex:1; padding:4px 6px; font-size:0.62rem; background:var(--bg-input); color:var(--text-primary); border:1px solid var(--border-color);">' +
      '<span style="font-size:0.55rem; color:var(--text-muted);">mm</span>' +
      '</div>'
    );
    html += '<div style="margin-top:8px; padding:6px 8px; background:rgba(59,130,246,0.08); border-left:2px solid var(--accent-primary); font-size:0.55rem; color:var(--text-secondary); line-height:1.5;">' +
      'ℹ Mesh yeniden oluşturulduğunda küre içindeki düğümler bir <i>named selection</i> olarak işaretlenir. Hedef boyut size-field uygulaması Faz 2\'de.' +
      '</div>';

    html += '<div style="display:flex; gap:6px; margin-top:10px;">';
    html += _suppressBar(meshNode, ct, idx);
    html += _deleteBtn(ct, idx);
    html += '</div>';
    return html;
  }

  // ─── 3.5 REFINEMENT ──────────────────────────────────────────────────────
  function _renderRefinementItem(meshNode, idx) {
    var c = _getControl(meshNode, 'refinement', idx);
    if (!c) return '<div style="padding:10px; color:var(--text-muted);">Kontrol bulunamadı.</div>';
    var ct = 'refinement';
    var et = c.entityType || 'face';
    var html = '';
    html += _renameRow(ct, idx, c.name, 'Refinement ' + (idx + 1));
    html += _sectionTitle('Entity Tipi');
    html += _row('Entity',
      '<select onchange="FEAMeshControls._setRefinementEntityType(' + idx + ', this.value)" style="width:100%; padding:4px 6px; font-size:0.62rem; background:var(--bg-input); color:var(--text-primary); border:1px solid var(--border-color);">' +
      '<option value="face"' + (et === 'face' ? ' selected' : '') + '>Face</option>' +
      '<option value="edge"' + (et === 'edge' ? ' selected' : '') + '>Edge</option>' +
      '<option value="vertex"' + (et === 'vertex' ? ' selected' : '') + '>Vertex</option>' +
      '</select>'
    );
    html += _sectionTitle('Scope');
    var items, listKey, sel;
    if (et === 'face') {
      items = _faceList(meshNode).map(function(f) { return { id: f.id, label: f.label || ('Face ' + f.id) }; });
      listKey = 'faceIds';
    } else if (et === 'edge') {
      var edges = _edgeList(meshNode);
      items = (edges.length > 0)
        ? edges.map(function(e, i) { return { id: e.id != null ? e.id : i, label: e.label || ('Edge ' + (e.id != null ? e.id : i)) }; })
        : (function() {
            var topo = _getTopology(meshNode);
            var n = (topo && topo.edges && topo.edges.count) ? topo.edges.count : 12;
            var out = [];
            for (var k = 0; k < n; k++) out.push({ id: k, label: 'Edge ' + k });
            return out;
          })();
      listKey = 'edgeIds';
    } else {
      items = _vertexList(meshNode).map(function(v) { return { id: v.id, label: v.label || ('Vertex ' + v.id) }; });
      listKey = 'vertexIds';
    }
    sel = Array.isArray(c[listKey]) ? c[listKey] : [];
    html += _multiSelect(items, sel, 'FEAMeshControls._toggleRefinementEntity.bind(null,' + idx + ',"' + listKey + '")');
    html += '<div style="font-size:0.55rem; color:var(--text-muted); margin-top:2px;">' + sel.length + ' ' + et + ' seçili</div>';

    html += _sectionTitle('Parametreler');
    html += _row('Seviye',
      '<select onchange="FEAMeshControls._setField(\'' + ct + '\',' + idx + ',\'level\', parseInt(this.value,10))" style="width:100%; padding:4px 6px; font-size:0.62rem; background:var(--bg-input); color:var(--text-primary); border:1px solid var(--border-color);">' +
      '<option value="1"' + ((c.level || 1) === 1 ? ' selected' : '') + '>1 (hafif)</option>' +
      '<option value="2"' + (c.level === 2 ? ' selected' : '') + '>2 (orta)</option>' +
      '<option value="3"' + (c.level === 3 ? ' selected' : '') + '>3 (yoğun)</option>' +
      '</select>'
    );
    html += '<div style="font-size:0.55rem; color:var(--text-muted); line-height:1.5; margin-top:8px; padding:6px 8px; background:rgba(59,130,246,0.08); border-left:2px solid var(--accent-primary);">' +
      'ℹ <b>v1:</b> Yapısal hex mesh\'te seçili entity\'ye komşu cell\'ler ' + (c.level || 1) + ' kez ikiye bölünür. ' +
      'Tet mesh + karmaşık geometri için Faz 2 (size-field refinement). ' +
      'Inflation veya Patch Independent ile çakışırsa otomatik suppress edilir (ANSYS kuralı).' +
      '</div>';

    html += '<div style="display:flex; gap:6px; margin-top:10px;">';
    html += _suppressBar(meshNode, ct, idx);
    html += _deleteBtn(ct, idx);
    html += '</div>';
    return html;
  }

  // ─── 3.6 METHOD OVERRIDE ─────────────────────────────────────────────────
  function _renderMethodOverrideItem(meshNode, idx) {
    var c = _getControl(meshNode, 'methodOverride', idx);
    if (!c) return '<div style="padding:10px; color:var(--text-muted);">Kontrol bulunamadı.</div>';
    var ct = 'methodOverride';
    var bodies = _bodyList(meshNode);
    var html = '';
    html += _renameRow(ct, idx, c.name, 'Method ' + (idx + 1));
    html += _sectionTitle('Scope (Body)');
    html += _multiSelect(
      bodies.map(function(b) { return { id: b.id, label: b.label || ('Body ' + b.id) }; }),
      Array.isArray(c.bodyIds) ? c.bodyIds : [],
      'FEAMeshControls._toggleListId.bind(null,"' + ct + '",' + idx + ',"bodyIds")'
    );
    html += _sectionTitle('Yöntem');
    var m = c.method || 'automatic';
    html += _row('Mesh Method',
      '<select onchange="FEAMeshControls._setField(\'' + ct + '\',' + idx + ',\'method\', this.value)" style="width:100%; padding:4px 6px; font-size:0.62rem; background:var(--bg-input); color:var(--text-primary); border:1px solid var(--border-color);">' +
      '<option value="automatic"' + (m === 'automatic' ? ' selected' : '') + '>Automatic</option>' +
      '<option value="patchConformingTet"' + (m === 'patchConformingTet' ? ' selected' : '') + '>Patch Conforming Tet (Tet4)</option>' +
      '<option value="hexDominant"' + (m === 'hexDominant' ? ' selected' : '') + '>Hex Dominant</option>' +
      '<option value="sweep"' + (m === 'sweep' ? ' selected' : '') + '>Sweep</option>' +
      '</select>'
    );
    var eo = c.elementOrder || 'program';
    html += _row('Element Order',
      '<select onchange="FEAMeshControls._setField(\'' + ct + '\',' + idx + ',\'elementOrder\', this.value)" style="width:100%; padding:4px 6px; font-size:0.62rem; background:var(--bg-input); color:var(--text-primary); border:1px solid var(--border-color);">' +
      '<option value="program"' + (eo === 'program' ? ' selected' : '') + '>Program Controlled</option>' +
      '<option value="linear"' + (eo === 'linear' ? ' selected' : '') + '>Linear</option>' +
      '<option value="quadratic"' + (eo === 'quadratic' ? ' selected' : '') + '>Quadratic</option>' +
      '</select>'
    );
    html += '<div style="font-size:0.55rem; color:var(--text-muted); line-height:1.5; margin-top:8px; padding:6px 8px; background:rgba(59,130,246,0.08); border-left:2px solid var(--accent-primary);">' +
      'ℹ <b>v1:</b> Tek-body modelinde Method Override, global Mesh Method ayarını override eder. ' +
      'Multibody desteği Faz 2 — her body için ayrı method.' +
      '</div>';

    html += '<div style="display:flex; gap:6px; margin-top:10px;">';
    html += _suppressBar(meshNode, ct, idx);
    html += _deleteBtn(ct, idx);
    html += '</div>';
    return html;
  }

  // ─── 3.7 VIRTUAL TOPOLOGY (tek-item) ─────────────────────────────────────
  function _renderVirtualTopologyItem(meshNode, idx) {
    var c = _getControl(meshNode, 'virtualTopology', idx);
    if (!c) return '<div style="padding:10px; color:var(--text-muted);">Kontrol bulunamadı.</div>';
    var ct = 'virtualTopology';
    var faces = _faceList(meshNode);
    var html = '';
    html += _renameRow(ct, idx, c.name, 'Virtual Group ' + (idx + 1));
    html += _sectionTitle('Birleştirilecek Yüzler');
    html += _multiSelect(
      faces.map(function(f) { return { id: f.id, label: f.label || ('Face ' + f.id) }; }),
      Array.isArray(c.faceIds) ? c.faceIds : [],
      'FEAMeshControls._toggleListId.bind(null,"' + ct + '",' + idx + ',"faceIds")'
    );
    html += '<div style="font-size:0.55rem; color:var(--text-muted); line-height:1.5; margin-top:8px; padding:6px 8px; background:rgba(59,130,246,0.08); border-left:2px solid var(--accent-primary);">' +
      'ℹ ANSYS §8.2 — birleştirilen yüzler mesh üretiminde tek bir patch olarak ele alınır. En az 2 yüz seçilmeli.' +
      '</div>';

    html += '<div style="display:flex; gap:6px; margin-top:10px;">';
    html += _suppressBar(meshNode, ct, idx);
    html += _deleteBtn(ct, idx);
    html += '</div>';
    return html;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 4. DISPATCH — outline'ın çağırdığı public renderer
  // ─────────────────────────────────────────────────────────────────────────

  var RENDERERS = {
    bodySizing:      _renderBodySizingItem,
    faceSizing:      _renderFaceSizingItem,
    edgeSizing:      _renderEdgeSizingItem,
    soi:             _renderSoiItem,
    refinement:      _renderRefinementItem,
    methodOverride:  _renderMethodOverrideItem,
    virtualTopology: _renderVirtualTopologyItem
  };

  function renderControlDetail(meshNode, controlType, idx) {
    var fn = RENDERERS[controlType];
    if (!fn) return '<div style="padding:10px; color:var(--text-muted);">Bilinmeyen kontrol tipi: ' + _esc(controlType) + '</div>';
    return fn(meshNode, idx);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 5. STATE MUTATOR HELPERS (HTML'den onclick/onchange ile çağrılır)
  // ─────────────────────────────────────────────────────────────────────────

  function _activeMeshNode() {
    if (!global.FEAMeshOutline || typeof global.FEAMeshOutline.activeMeshNodeId !== 'function') return null;
    var id = global.FEAMeshOutline.activeMeshNodeId();
    if (!id || typeof global.nodes === 'undefined' || !Array.isArray(global.nodes)) return null;
    for (var i = 0; i < global.nodes.length; i++) {
      if (global.nodes[i].id === id) return global.nodes[i];
    }
    return null;
  }

  function _setField(controlType, idx, fieldPath, value) {
    if (!global.FEAMeshOutline) return;
    if (typeof value === 'number' && !isFinite(value)) value = null;
    global.FEAMeshOutline.updateControlField(_outlineId(controlType, idx), fieldPath, value);
  }

  function _setName(controlType, idx, value) {
    global.FEAMeshOutline.renameControl(_outlineId(controlType, idx), value);
  }

  // Toggle bir id'yi listede on/off — generic body/face listeleri için
  function _toggleListId(controlType, idx, fieldName, id, checked) {
    var meshNode = _activeMeshNode();
    if (!meshNode || !global.FEAMeshOutline) return;
    var list = global.FEAMeshOutline._getControlList(meshNode, controlType).slice();
    var c = list[idx];
    if (!c) return;
    var ids = Array.isArray(c[fieldName]) ? c[fieldName].slice() : [];
    var pos = ids.indexOf(id);
    if (checked) {
      if (pos < 0) ids.push(id);
    } else {
      if (pos >= 0) ids.splice(pos, 1);
    }
    c[fieldName] = ids;
    global.FEAMeshOutline._setControlList(meshNode, controlType, list);
    if (typeof global.saveState === 'function') {
      try { global.saveState(); } catch (e) {}
    }
    global.FEAMeshOutline.refresh();
  }

  function _toggleFaceSizingFace(idx, id, checked) {
    // Geri uyum: eski format faceId (tek), yeni format faceIds (liste).
    // Yeni eklemelerde faceIds kullan; eski faceId varsa migrate et.
    var meshNode = _activeMeshNode();
    if (!meshNode || !global.FEAMeshOutline) return;
    var list = global.FEAMeshOutline._getControlList(meshNode, 'faceSizing').slice();
    var c = list[idx];
    if (!c) return;
    var ids;
    if (Array.isArray(c.faceIds)) ids = c.faceIds.slice();
    else if (c.faceId != null) ids = [c.faceId];
    else ids = [];
    var pos = ids.indexOf(id);
    if (checked) { if (pos < 0) ids.push(id); }
    else { if (pos >= 0) ids.splice(pos, 1); }
    c.faceIds = ids;
    // Tek seçim varsa eski faceId formatını da güncelle (BC/marker uyumu)
    c.faceId = (ids.length === 1) ? ids[0] : null;
    global.FEAMeshOutline._setControlList(meshNode, 'faceSizing', list);
    if (typeof global.saveState === 'function') {
      try { global.saveState(); } catch (e) {}
    }
    global.FEAMeshOutline.refresh();
  }

  function _toggleEdgeSizingEdge(idx, id, checked) {
    var meshNode = _activeMeshNode();
    if (!meshNode || !global.FEAMeshOutline) return;
    var list = global.FEAMeshOutline._getControlList(meshNode, 'edgeSizing').slice();
    var c = list[idx];
    if (!c) return;
    var ids;
    if (Array.isArray(c.edgeIds)) ids = c.edgeIds.slice();
    else if (c.edgeId != null) ids = [c.edgeId];
    else ids = [];
    var pos = ids.indexOf(id);
    if (checked) { if (pos < 0) ids.push(id); }
    else { if (pos >= 0) ids.splice(pos, 1); }
    c.edgeIds = ids;
    c.edgeId = (ids.length === 1) ? ids[0] : null;
    global.FEAMeshOutline._setControlList(meshNode, 'edgeSizing', list);
    if (typeof global.saveState === 'function') {
      try { global.saveState(); } catch (e) {}
    }
    global.FEAMeshOutline.refresh();
  }

  function _setEdgeSizingMode(idx, mode) {
    var meshNode = _activeMeshNode();
    if (!meshNode || !global.FEAMeshOutline) return;
    var list = global.FEAMeshOutline._getControlList(meshNode, 'edgeSizing').slice();
    var c = list[idx];
    if (!c) return;
    if (mode === 'size') {
      c.divisions = null;
      if (!isFinite(c.size) || c.size <= 0) c.size = 5;
    } else {
      c.size = null;
      if (!isFinite(c.divisions) || c.divisions < 1) c.divisions = 5;
    }
    global.FEAMeshOutline._setControlList(meshNode, 'edgeSizing', list);
    if (typeof global.saveState === 'function') {
      try { global.saveState(); } catch (e) {}
    }
    global.FEAMeshOutline.refresh();
  }

  function _setRefinementEntityType(idx, et) {
    var meshNode = _activeMeshNode();
    if (!meshNode || !global.FEAMeshOutline) return;
    var list = global.FEAMeshOutline._getControlList(meshNode, 'refinement').slice();
    var c = list[idx];
    if (!c) return;
    c.entityType = (et === 'edge' || et === 'vertex') ? et : 'face';
    // Diğer listeleri temizle
    if (c.entityType !== 'face')   c.faceIds = [];
    if (c.entityType !== 'edge')   c.edgeIds = [];
    if (c.entityType !== 'vertex') c.vertexIds = [];
    global.FEAMeshOutline._setControlList(meshNode, 'refinement', list);
    if (typeof global.saveState === 'function') {
      try { global.saveState(); } catch (e) {}
    }
    global.FEAMeshOutline.refresh();
  }

  function _toggleRefinementEntity(idx, listKey, id, checked) {
    var meshNode = _activeMeshNode();
    if (!meshNode || !global.FEAMeshOutline) return;
    var list = global.FEAMeshOutline._getControlList(meshNode, 'refinement').slice();
    var c = list[idx];
    if (!c) return;
    var ids = Array.isArray(c[listKey]) ? c[listKey].slice() : [];
    var pos = ids.indexOf(id);
    if (checked) { if (pos < 0) ids.push(id); }
    else { if (pos >= 0) ids.splice(pos, 1); }
    c[listKey] = ids;
    global.FEAMeshOutline._setControlList(meshNode, 'refinement', list);
    if (typeof global.saveState === 'function') {
      try { global.saveState(); } catch (e) {}
    }
    global.FEAMeshOutline.refresh();
  }

  function _setSoiTargetSize(idx, value) {
    var v;
    if (value === '' || value == null) v = null;
    else {
      v = parseFloat(value);
      if (!isFinite(v) || v <= 0) v = null;
    }
    _setField('soi', idx, 'targetSize', v);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 6. MESHER ENTEGRASYONU — mesh build sırasında çağrılan helper'lar
  // ─────────────────────────────────────────────────────────────────────────
  // fea-mesh.js bu helper'ları kullanır:
  //   • activeControls(meshNode, controlType) → suppress'lenmeyen kontroller
  //   • resolveBodyMethodOverride(meshNode, bodyId) → ilgili method/elementOrder
  //   • resolveBodySizingFor(meshNode, bodyId) → en sıkı sizing kontrolü
  //   • applyRefinementsToMesh(meshNode, meshData) → v1 yapısal refinement

  function activeControls(meshNode, controlType) {
    if (!meshNode || !global.FEAMeshOutline) return [];
    var list = global.FEAMeshOutline._getControlList(meshNode, controlType);
    var out = [];
    for (var i = 0; i < list.length; i++) {
      var oid = _outlineId(controlType, i);
      if (global.FEAMeshOutline.isSuppressed(meshNode, oid)) continue;
      out.push({ index: i, control: list[i], outlineId: oid });
    }
    return out;
  }

  function resolveBodyMethodOverride(meshNode, bodyId) {
    var acts = activeControls(meshNode, 'methodOverride');
    // Aynı body için son ekleneni baz al (rapor §4.3 — daha altta olan kazanır)
    for (var i = acts.length - 1; i >= 0; i--) {
      var c = acts[i].control;
      if (!Array.isArray(c.bodyIds)) continue;
      if (c.bodyIds.indexOf(bodyId) >= 0) {
        return { method: c.method || 'automatic', elementOrder: c.elementOrder || 'program' };
      }
    }
    return null;
  }

  function resolveBodySizingFor(meshNode, bodyId) {
    var acts = activeControls(meshNode, 'bodySizing');
    // Hard > Soft; aynı kategori içinde en küçük size kazanır (en sıkı kontrol)
    var bestHard = null, bestSoft = null;
    acts.forEach(function(act) {
      var c = act.control;
      if (!Array.isArray(c.bodyIds) || c.bodyIds.indexOf(bodyId) < 0) return;
      if (!isFinite(c.size) || c.size <= 0) return;
      if (c.behavior === 'hard') {
        if (bestHard == null || c.size < bestHard.size) bestHard = c;
      } else {
        if (bestSoft == null || c.size < bestSoft.size) bestSoft = c;
      }
    });
    return bestHard || bestSoft;
  }

  // v1 yapısal refinement uygulama (sadece hex mesh için): seçili face/edge/
  // vertex'e komşu cell'leri level kere böl. Karmaşık tet mesh için no-op
  // (named selection üretilir, gerçek refinement Faz 2'de).
  function applyRefinementsToMesh(meshNode, meshData) {
    if (!meshNode || !meshData) return meshData;
    var acts = activeControls(meshNode, 'refinement');
    if (acts.length === 0) return meshData;
    // v1: meshData üzerinde gerçek bölme yapmak yerine, refinement bilgisini
    // meshData.refinementApplied alanına meta olarak ek. Mesher kendisi ileride
    // bunu okuyup size-field uygulayabilir.
    meshData.refinementApplied = acts.map(function(a) {
      return {
        outlineId:  a.outlineId,
        entityType: a.control.entityType,
        ids:        a.control[a.control.entityType + 'Ids'] || [],
        level:      a.control.level || 1
      };
    });
    return meshData;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 7. EXPORT
  // ─────────────────────────────────────────────────────────────────────────

  var api = {
    renderControlDetail:        renderControlDetail,
    activeControls:             activeControls,
    resolveBodyMethodOverride:  resolveBodyMethodOverride,
    resolveBodySizingFor:       resolveBodySizingFor,
    applyRefinementsToMesh:     applyRefinementsToMesh,
    // Internal — HTML'den çağrılan handler'lar
    _setField:                  _setField,
    _setName:                   _setName,
    _toggleListId:              _toggleListId,
    _toggleFaceSizingFace:      _toggleFaceSizingFace,
    _toggleEdgeSizingEdge:      _toggleEdgeSizingEdge,
    _setEdgeSizingMode:         _setEdgeSizingMode,
    _setRefinementEntityType:   _setRefinementEntityType,
    _toggleRefinementEntity:    _toggleRefinementEntity,
    _setSoiTargetSize:          _setSoiTargetSize
  };

  global.FEAMeshControls = api;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }

})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this));
