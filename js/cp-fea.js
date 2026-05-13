// ============================================================================
// YAPISAL ANALİZ (FEA) — Kontrol Paneli İskeletleri
// ============================================================================
// Bu dosya FEA zincirinin 4 alt bileşeninin (Geometri, Mesh, Sınır Koşulları,
// Çözücü) özellik panelini sağlar. F1 aşamasında yalnız iskelet vardır;
// gerçek işlev sonraki fazlarda (F2-F6) dolacak:
//   F2 → Geometri: Three.js viewer + OCCT.js + STEP/IGES/STL import
//   F3 → Mesh: tet4/tet10, mesh boyu, kalite metrikleri
//   F4 → Sınır Koşulları: fix/displacement/force/pressure
//   F5 → Çözücü: sparse assembly + PCG + von Mises
//   F6 → Post-process: kontur, deformasyon
// ============================================================================

function veFEAPhaseBadge(phase) {
  return '<span style="font-size:0.52rem; font-weight:600; color:#b45309; background:#fef3c720; padding:2px 7px; border-radius:0; border:1px solid #f59e0b40; letter-spacing:0.03em; text-transform:uppercase;">' + phase + ' — yapım aşamasında</span>';
}

function veFEASectionTitle(text) {
  return '<div style="font-size:0.72rem; font-weight:600; color:var(--text-heading); margin:10px 0 6px;">' + text + '</div>';
}

function veFEAReadOnlyRow(label, value) {
  return '<div style="display:flex; justify-content:space-between; align-items:center; padding:5px 8px; background:var(--bg-tertiary); border:1px solid var(--border-color); margin-bottom:4px; font-size:0.66rem;">' +
    '<span style="color:var(--text-secondary);">' + label + '</span>' +
    '<span style="font-weight:600; color:var(--text-primary);">' + value + '</span>' +
    '</div>';
}

// ─── 1. GEOMETRİ ────────────────────────────────────────────────────────────
function getFEAGeometryPropertiesHTML(node) {
  var d = node.data || {};
  var geom = d.geometry; // { type, params, volume, surfaceArea, bbox, sourceLabel }
  var hasGeom = !!(geom && geom.type);

  var html = '<div style="border-top:1px solid var(--border-color); padding-top:12px;">';

  html += '<div style="display:flex; align-items:center; gap:8px; margin-bottom:10px;">';
  html += '<div style="font-size:0.78rem; font-weight:700; color:var(--text-heading);">Geometri</div>';
  html += veFEAPhaseBadge('Faz 2');
  html += '</div>';

  html += '<div style="font-size:0.62rem; color:var(--text-muted); line-height:1.5; margin-bottom:10px;">' +
    'Parametrik primitif tanımlayın veya CAD geometrisi yükleyin. ' +
    'Sonraki adım: <b>Mesh</b>.</div>';

  // ─── 3D ÖNİZLEME ──────────────────────────────────────────────────────
  html += veFEASectionTitle('3D Önizleme');
  html += '<div style="position:relative; border:1px solid var(--border-color); background:#1a1a1a; margin-bottom:8px;">';
  html += '<canvas id="ve-fea-geom-canvas-' + node.id + '" width="240" height="180" style="display:block; width:100%; height:180px; cursor:grab;"></canvas>';
  html += '<div style="position:absolute; bottom:6px; left:8px; font-size:0.55rem; color:#888; pointer-events:none;">Sol drag: orbit · Sağ drag: pan · Wheel: zoom</div>';
  html += '</div>';
  html += '<div style="display:flex; gap:6px; margin-bottom:10px;">';
  html += '<button onclick="veFEAFitPreviewForNode(\'' + node.id + '\')" style="flex:0 0 auto; padding:7px 10px; font-size:0.66rem; background:var(--bg-tertiary); color:var(--text-primary); border:1px solid var(--border-color); cursor:pointer; white-space:nowrap;" onmouseenter="this.style.borderColor=\'var(--accent-primary)\'" onmouseleave="this.style.borderColor=\'var(--border-color)\'" title="Geometriyi sığdır">⛶ Sığdır</button>';
  html += '<button onclick="veFEAOpenFullscreenViewer(\'' + node.id + '\')" style="flex:1 1 auto; padding:7px 10px; font-size:0.66rem; background:var(--bg-tertiary); color:var(--text-primary); border:1px solid var(--border-color); cursor:pointer;" onmouseenter="this.style.borderColor=\'var(--accent-primary)\'" onmouseleave="this.style.borderColor=\'var(--border-color)\'">🔍 Tam Ekran Görüntüleyici</button>';
  html += '</div>';

  // ─── GEOMETRİ KAYNAĞI ─────────────────────────────────────────────────
  html += veFEASectionTitle('Parametrik Primitif');
  html += '<div style="display:flex; gap:4px; margin-bottom:8px;">';
  var types = (typeof veFEAPrimitiveTypes === 'function') ? veFEAPrimitiveTypes() : [];
  types.forEach(function(t) {
    var label = (typeof veFEAPrimitiveLabel === 'function') ? veFEAPrimitiveLabel(t).split(' ')[0] : t;
    var active = hasGeom && geom.type === t;
    var border = active ? 'var(--accent-primary)' : 'var(--border-color)';
    var bg = active ? 'var(--accent-primary)' : 'var(--bg-tertiary)';
    var color = active ? '#fff' : 'var(--text-primary)';
    html += '<button onclick="veFEAToggleParamForm(\'' + node.id + '\', \'' + t + '\')" style="flex:1; padding:7px; font-size:0.64rem; background:' + bg + '; color:' + color + '; border:1px solid ' + border + '; cursor:pointer;">' + label + '</button>';
  });
  html += '</div>';

  // Aktif form (geometri yüklüyse onun formu açık; aksi halde gizli)
  var activeType = hasGeom ? geom.type : null;
  types.forEach(function(t) {
    var schema = (typeof veFEAPrimitiveSchema === 'function') ? veFEAPrimitiveSchema(t) : null;
    if(!schema) return;
    var visible = activeType === t;
    var params = (activeType === t && geom.params) ? geom.params
               : ((typeof veFEAPrimitiveDefaults === 'function') ? veFEAPrimitiveDefaults(t) : {});

    html += '<div id="ve-fea-form-' + node.id + '-' + t + '" style="display:' + (visible ? 'block' : 'none') + '; padding:8px; background:var(--bg-secondary); border:1px solid var(--border-color); margin-bottom:8px;">';
    html += '<div style="font-size:0.62rem; color:var(--text-muted); margin-bottom:6px;">' + veFEAPrimitiveLabel(t) + ' parametreleri</div>';
    schema.forEach(function(p) {
      var iid = 've-fea-param-' + node.id + '-' + t + '-' + p.key;
      html += '<div style="display:flex; align-items:center; justify-content:space-between; gap:8px; margin-bottom:5px;">';
      html += '<label for="' + iid + '" style="font-size:0.62rem; color:var(--text-secondary); flex:1;">' + p.label + '</label>';
      html += '<input id="' + iid + '" type="number" value="' + params[p.key] + '" min="' + (p.min !== undefined ? p.min : '') + '" max="' + (p.max !== undefined ? p.max : '') + '" step="' + (p.integer ? '1' : '0.1') + '" style="width:75px; padding:3px 6px; font-size:0.62rem; background:var(--bg-input); color:var(--text-primary); border:1px solid var(--border-color);">';
      html += '<span style="font-size:0.55rem; color:var(--text-muted); width:18px;">' + p.unit + '</span>';
      html += '</div>';
    });
    var btnLabel = visible ? '🔄 Güncelle' : '✓ Oluştur';
    html += '<button onclick="veFEASubmitParamForm(\'' + node.id + '\', \'' + t + '\')" style="width:100%; padding:6px; margin-top:4px; font-size:0.65rem; background:var(--accent-primary); color:#fff; border:none; cursor:pointer;">' + btnLabel + '</button>';
    html += '</div>';
  });

  if(hasGeom) {
    html += '<button onclick="veFEAClearGeometryForNode(\'' + node.id + '\')" style="width:100%; padding:6px 10px; font-size:0.62rem; background:var(--bg-tertiary); color:var(--accent-danger); border:1px solid var(--accent-danger); cursor:pointer; margin-bottom:10px;">🗑 Geometriyi Sil</button>';
  }

  // CAD import — STL ve STEP aktif
  html += veFEASectionTitle('CAD Dosya İçe Aktar');
  html += '<input type="file" id="ve-fea-stl-input-' + node.id + '" accept=".stl" style="display:none" onchange="veFEAOnSTLFileSelected(this, \'' + node.id + '\')">';
  html += '<input type="file" id="ve-fea-step-input-' + node.id + '" accept=".step,.stp" style="display:none" onchange="veFEAOnSTEPFileSelected(this, \'' + node.id + '\')">';
  html += '<div style="display:flex; flex-direction:column; gap:6px; margin-bottom:10px;">';
  html += '<button onclick="document.getElementById(\'ve-fea-stl-input-' + node.id + '\').click()" style="padding:7px 10px; font-size:0.66rem; background:var(--bg-tertiary); color:var(--text-primary); border:1px solid var(--border-color); cursor:pointer; text-align:left;" onmouseenter="this.style.borderColor=\'var(--accent-primary)\'" onmouseleave="this.style.borderColor=\'var(--border-color)\'">📥 STL Yükle (binary veya ASCII)</button>';
  html += '<button onclick="document.getElementById(\'ve-fea-step-input-' + node.id + '\').click()" style="padding:7px 10px; font-size:0.66rem; background:var(--bg-tertiary); color:var(--text-primary); border:1px solid var(--border-color); cursor:pointer; text-align:left;" onmouseenter="this.style.borderColor=\'var(--accent-primary)\'" onmouseleave="this.style.borderColor=\'var(--border-color)\'">📥 STEP Yükle (.step / .stp)</button>';
  html += '<div style="font-size:0.55rem; color:var(--text-muted); padding:0 4px;">STEP OpenCascade WebAssembly ile yüklenir (~7 MB). İlk dosyada birkaç saniye sürer.</div>';
  html += '</div>';

  // ─── DURUM ────────────────────────────────────────────────────────────
  html += veFEASectionTitle('Durum');
  if(hasGeom) {
    var sourceName = geom.sourceLabel || (typeof veFEAPrimitiveLabel === 'function' ? veFEAPrimitiveLabel(geom.type) : geom.type);
    html += veFEAReadOnlyRow('Yüklenen geometri', sourceName);
    if((geom.type === 'stl' || geom.type === 'step') && geom.triangleCount) {
      html += veFEAReadOnlyRow('Üçgen sayısı', geom.triangleCount.toLocaleString('tr-TR'));
    }
    if(geom.type === 'step' && geom.meshCount && geom.meshCount > 1) {
      html += veFEAReadOnlyRow('Parça sayısı', String(geom.meshCount));
    }
    html += veFEAReadOnlyRow('Hacim',        (typeof veFEAFormatVolume === 'function') ? veFEAFormatVolume(geom.volume) : (geom.volume + ' mm³'));
    html += veFEAReadOnlyRow('Yüzey alanı',  (typeof veFEAFormatArea === 'function') ? veFEAFormatArea(geom.surfaceArea) : (geom.surfaceArea + ' mm²'));
    html += veFEAReadOnlyRow('Sınırlayıcı kutu', (typeof veFEAFormatBBox === 'function') ? veFEAFormatBBox(geom.bbox) : '—');
    if(geom.persistNote) {
      html += '<div style="margin-top:6px; padding:6px 8px; font-size:0.58rem; color:var(--accent-warning, #f59e0b); border-left:2px solid var(--accent-warning, #f59e0b); background:rgba(245,158,11,0.08);">⚠ ' + geom.persistNote + '</div>';
    }
  } else {
    html += veFEAReadOnlyRow('Yüklenen geometri', '— (henüz yok)');
    html += veFEAReadOnlyRow('Hacim', '—');
    html += veFEAReadOnlyRow('Yüzey alanı', '—');
    html += veFEAReadOnlyRow('Sınırlayıcı kutu', '—');
  }

  html += '</div>';
  return html;
}

// ─── Geometri formu açıp/kapayıcı (sadece bir form bir anda açık olsun) ────
function veFEAToggleParamForm(nodeId, type) {
  var types = (typeof veFEAPrimitiveTypes === 'function') ? veFEAPrimitiveTypes() : [];
  var clicked = document.getElementById('ve-fea-form-' + nodeId + '-' + type);
  var willOpen = clicked && clicked.style.display === 'none';
  types.forEach(function(t) {
    var el = document.getElementById('ve-fea-form-' + nodeId + '-' + t);
    if(el) el.style.display = (t === type && willOpen) ? 'block' : 'none';
  });
}

// ─── Form değerlerini topla, normalize et, viewer'a uygula ─────────────────
function veFEASubmitParamForm(nodeId, type) {
  var schema = (typeof veFEAPrimitiveSchema === 'function') ? veFEAPrimitiveSchema(type) : null;
  if(!schema) return;
  var params = {};
  schema.forEach(function(p) {
    var el = document.getElementById('ve-fea-param-' + nodeId + '-' + type + '-' + p.key);
    if(el) params[p.key] = parseFloat(el.value);
  });
  if(typeof veFEAApplyPrimitive === 'function') {
    veFEAApplyPrimitive(nodeId, type, params);
  }
}

// ─── 2. MESH ────────────────────────────────────────────────────────────────
function getFEAMeshPropertiesHTML(node) {
  var d = node.data || {};
  var settings = d.meshSettings || { size: 10 };
  var metrics = d.meshMetrics;
  var hasMesh = !!(d.meshActive && metrics);

  // Upstream geometri bağlantısını kontrol et
  var geomLabel = '— (bağlı değil)';
  var geomOk = false;
  if (typeof veFEAFindUpstreamGeometryNode === 'function') {
    var gn = veFEAFindUpstreamGeometryNode(node.id);
    if (gn && gn.data && gn.data.geometry && gn.data.geometry.type) {
      geomLabel = (gn.customName || gn.def && gn.def.name || 'Geometri') + ' → ' + (gn.data.geometry.sourceLabel ||
        (typeof veFEAPrimitiveLabel === 'function' ? veFEAPrimitiveLabel(gn.data.geometry.type) : gn.data.geometry.type));
      geomOk = true;
    }
  }

  var html = '<div style="border-top:1px solid var(--border-color); padding-top:12px;">';

  html += '<div style="display:flex; align-items:center; gap:8px; margin-bottom:10px;">';
  html += '<div style="font-size:0.78rem; font-weight:700; color:var(--text-heading);">Mesh</div>';
  html += veFEAPhaseBadge('Faz 3a');
  html += '</div>';

  html += '<div style="font-size:0.62rem; color:var(--text-muted); line-height:1.5; margin-bottom:10px;">' +
    'Geometriyi sonlu elemanlara böler. Yapısal mesh: kutu → Heks8, silindir → Wedge6, ' +
    'şaft → Heks8 annulus. STL/STEP → Tri3 yüzey ağı. Hacim tetrahedralization F3b\'de.</div>';

  // Upstream bağlantı durumu
  html += veFEASectionTitle('Geometri Girdisi');
  html += '<div style="padding:6px 8px; background:' + (geomOk ? 'var(--bg-tertiary)' : 'rgba(245,158,11,0.08)') +
    '; border:1px solid ' + (geomOk ? 'var(--border-color)' : 'var(--accent-warning, #f59e0b)') +
    '; font-size:0.62rem; color:var(--text-primary); margin-bottom:10px;">' +
    (geomOk ? '✓ ' : '⚠ ') + geomLabel + '</div>';

  // Mesh modu — STL/STEP için kritik (Otomatik = voxel hacim Heks8)
  var currentMode = settings.mode || 'auto';
  html += veFEASectionTitle('Mesh Modu');
  html += '<select id="ve-fea-mesh-mode-' + node.id + '" style="width:100%; padding:5px 8px; font-size:0.66rem; background:var(--bg-input); color:var(--text-primary); border:1px solid var(--border-color); margin-bottom:8px;">';
  html += '<option value="auto"' + (currentMode === 'auto' ? ' selected' : '') + '>Otomatik (Primitif → yapısal, STL/STEP → voxel hacim)</option>';
  html += '<option value="volume"' + (currentMode === 'volume' ? ' selected' : '') + '>Hacim (Heks8 voxel — FEA için)</option>';
  html += '<option value="surface"' + (currentMode === 'surface' ? ' selected' : '') + '>Yüzey (Tri3 — sadece önizleme)</option>';
  html += '</select>';

  // Eleman tipi — auto (native hex8/wedge6) veya tet4 decomposition
  var currentElType = settings.elementType || 'auto';
  html += veFEASectionTitle('Eleman Tipi');
  html += '<select id="ve-fea-mesh-eltype-' + node.id + '" style="width:100%; padding:5px 8px; font-size:0.66rem; background:var(--bg-input); color:var(--text-primary); border:1px solid var(--border-color); margin-bottom:8px;">';
  html += '<option value="auto"' + (currentElType === 'auto' ? ' selected' : '') + '>Otomatik (Heks8 / Wedge6 — native)</option>';
  html += '<option value="tet4"' + (currentElType === 'tet4' ? ' selected' : '') + '>Tet4 (Tetra — decomposition)</option>';
  html += '</select>';

  // Mesh boyu input
  html += veFEASectionTitle('Mesh Boyu');
  html += '<div style="display:flex; gap:6px; align-items:center; margin-bottom:8px;">';
  html += '<input id="ve-fea-mesh-size-' + node.id + '" type="number" min="0.5" max="500" step="0.5" value="' + settings.size + '" style="flex:1; padding:5px 8px; font-size:0.66rem; background:var(--bg-input); color:var(--text-primary); border:1px solid var(--border-color);">';
  html += '<span style="font-size:0.6rem; color:var(--text-muted);">mm</span>';
  html += '</div>';
  // Hızlı preset
  html += '<div style="display:flex; gap:4px; margin-bottom:10px;">';
  ['Coarse:20', 'Medium:10', 'Fine:5'].forEach(function(item) {
    var parts = item.split(':');
    html += '<button onclick="veFEASetMeshSizePreset(\'' + node.id + '\', ' + parts[1] + ')" style="flex:1; padding:5px; font-size:0.6rem; background:var(--bg-tertiary); color:var(--text-primary); border:1px solid var(--border-color); cursor:pointer;">' + parts[0] + '</button>';
  });
  html += '</div>';

  // Oluştur butonu
  var buildBtnStyle = geomOk
    ? 'background:var(--accent-primary); color:#fff; cursor:pointer;'
    : 'background:var(--bg-tertiary); color:var(--text-muted); cursor:not-allowed;';
  html += '<button ' + (geomOk ? '' : 'disabled ') +
    'onclick="veFEASubmitMeshBuild(\'' + node.id + '\')" style="width:100%; padding:8px; font-size:0.68rem; font-weight:600; border:1px solid var(--border-color); ' + buildBtnStyle + ' margin-bottom:10px;">▶ Mesh Oluştur</button>';

  // 3D Preview
  html += veFEASectionTitle('3D Önizleme');
  html += '<div style="position:relative; border:1px solid var(--border-color); background:#1a1a1a; margin-bottom:8px;">';
  html += '<canvas id="ve-fea-mesh-canvas-' + node.id + '" width="240" height="180" style="display:block; width:100%; height:180px; cursor:grab;"></canvas>';
  html += '<div style="position:absolute; bottom:6px; left:8px; font-size:0.55rem; color:#888; pointer-events:none;">Sol drag: orbit · Sağ drag: pan · Wheel: zoom</div>';
  html += '</div>';
  html += '<div style="display:flex; gap:6px; margin-bottom:10px;">';
  html += '<button onclick="veFEAFitPreviewForNode(\'' + node.id + '\')" style="flex:0 0 auto; padding:7px 10px; font-size:0.66rem; background:var(--bg-tertiary); color:var(--text-primary); border:1px solid var(--border-color); cursor:pointer;">⛶ Sığdır</button>';
  html += '<button onclick="veFEAOpenFullscreenViewer(\'' + node.id + '\')" style="flex:1 1 auto; padding:7px 10px; font-size:0.66rem; background:var(--bg-tertiary); color:var(--text-primary); border:1px solid var(--border-color); cursor:pointer;">🔍 Tam Ekran Görüntüleyici</button>';
  html += '</div>';

  if (hasMesh) {
    html += '<button onclick="veFEAClearMeshForNode(\'' + node.id + '\')" style="width:100%; padding:6px 10px; font-size:0.62rem; background:var(--bg-tertiary); color:var(--accent-danger); border:1px solid var(--accent-danger); cursor:pointer; margin-bottom:10px;">🗑 Mesh\'i Sil</button>';
  }

  // Metrikler
  html += veFEASectionTitle('Kalite Metrikleri');
  if (hasMesh) {
    var typeLabel = (typeof veFEAMeshLabel === 'function') ? veFEAMeshLabel(metrics.elementType) : metrics.elementType;
    html += veFEAReadOnlyRow('Eleman tipi', typeLabel);
    html += veFEAReadOnlyRow('Düğüm sayısı', metrics.nodeCount.toLocaleString('tr-TR'));
    html += veFEAReadOnlyRow('Eleman sayısı', metrics.elementCount.toLocaleString('tr-TR'));
    html += veFEAReadOnlyRow('Min eleman boyu', metrics.minSize.toFixed(2) + ' mm');
    html += veFEAReadOnlyRow('Maks eleman boyu', metrics.maxSize.toFixed(2) + ' mm');
    html += veFEAReadOnlyRow('Ortalama eleman boyu', metrics.avgSize.toFixed(2) + ' mm');
    if (metrics.computeMs !== undefined) {
      html += veFEAReadOnlyRow('Hesaplama süresi', metrics.computeMs + ' ms');
    }
  } else {
    html += veFEAReadOnlyRow('Düğüm sayısı', '—');
    html += veFEAReadOnlyRow('Eleman sayısı', '—');
    html += veFEAReadOnlyRow('Min eleman boyu', '—');
    html += veFEAReadOnlyRow('Maks eleman boyu', '—');
  }

  // ─── Named Selections (Atanmış Yüzeyler) ────────────────────────────────
  html += veFEASectionTitle('Atanmış Yüzeyler (Named Selections)');
  if (hasMesh && d.namedSelectionsSummary && Object.keys(d.namedSelectionsSummary).length > 0) {
    html += '<div style="font-size:0.58rem; color:var(--text-muted); line-height:1.5; margin-bottom:6px;">' +
      'Otomatik üretilen düğüm grupları. Sınır koşulları bu yüzeylere referansla uygulanır. ' +
      'Yüzeyi 3D önizlemede görüntülemek için satıra tıklayın.</div>';
    var highlightKey = d.highlightedSelection || null;
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
          '<span style="font-size:0.5rem; padding:1px 5px; background:' + srcBg + '; color:' + fg + '; border-radius:0; letter-spacing:0.05em;">' + srcBadge + '</span>' +
          '<span style="font-weight:600; opacity:0.85;">' + ns.nodeCount.toLocaleString('tr-TR') + ' düğüm</span>' +
        '</span>' +
      '</button>';
    });
  } else if (hasMesh) {
    html += '<div style="padding:6px 8px; background:var(--bg-tertiary); border:1px solid var(--border-color); font-size:0.62rem; color:var(--text-muted);">— (yüzey grubu üretilmedi)</div>';
  } else {
    html += '<div style="padding:6px 8px; background:var(--bg-tertiary); border:1px solid var(--border-color); font-size:0.62rem; color:var(--text-muted);">Mesh oluşturulduktan sonra otomatik atanır.</div>';
  }

  html += '</div>';
  return html;
}

// Mesh paneli UI köprüleri
function veFEASetMeshSizePreset(nodeId, size) {
  var input = document.getElementById('ve-fea-mesh-size-' + nodeId);
  if (input) input.value = size;
}
function veFEASubmitMeshBuild(nodeId) {
  if (typeof nodes === 'undefined' || typeof veFEABuildMeshForNode !== 'function') return;
  var input = document.getElementById('ve-fea-mesh-size-' + nodeId);
  var modeSel = document.getElementById('ve-fea-mesh-mode-' + nodeId);
  var elTypeSel = document.getElementById('ve-fea-mesh-eltype-' + nodeId);
  var size = input ? parseFloat(input.value) : 10;
  if (!isFinite(size) || size <= 0) size = 10;
  var mode = (modeSel && modeSel.value) ? modeSel.value : 'auto';
  if (mode !== 'auto' && mode !== 'volume' && mode !== 'surface') mode = 'auto';
  var elementType = (elTypeSel && elTypeSel.value) ? elTypeSel.value : 'auto';
  if (elementType !== 'auto' && elementType !== 'tet4') elementType = 'auto';
  var meshNode = nodes.find(function(n) { return n.id === nodeId; });
  if (meshNode) {
    meshNode.data = meshNode.data || {};
    meshNode.data.meshSettings = meshNode.data.meshSettings || {};
    meshNode.data.meshSettings.size = size;
    meshNode.data.meshSettings.mode = mode;
    meshNode.data.meshSettings.elementType = elementType;
  }
  veFEABuildMeshForNode(nodeId);
}

// ─── 3. SINIR KOŞULLARI ─────────────────────────────────────────────────────
function getFEABCPropertiesHTML(node) {
  var d = node.data || {};
  var html = '<div style="border-top:1px solid var(--border-color); padding-top:12px;">';

  html += '<div style="display:flex; align-items:center; gap:8px; margin-bottom:10px;">';
  html += '<div style="font-size:0.78rem; font-weight:700; color:var(--text-heading);">Sınır Koşulları</div>';
  html += veFEAPhaseBadge('Faz 4');
  html += '</div>';

  html += '<div style="font-size:0.62rem; color:var(--text-muted); line-height:1.5; margin-bottom:10px;">' +
    'Malzeme, mesnetler ve yükler. Statik analiz için en az bir fix-support ve bir yük gereklidir.</div>';

  html += veFEASectionTitle('Malzeme (F4)');
  html += '<select disabled style="width:100%; padding:6px 8px; font-size:0.66rem; background:var(--bg-tertiary); color:var(--text-muted); border:1px dashed var(--border-color); margin-bottom:8px;">';
  html += '<option>Yapısal Çelik (E=200 GPa, ν=0.30)</option>';
  html += '<option>Alüminyum 6061 (E=69 GPa, ν=0.33)</option>';
  html += '<option>Özel — manuel giriş…</option>';
  html += '</select>';

  html += veFEASectionTitle('Mesnetler');
  html += '<button disabled style="width:100%; padding:7px 10px; font-size:0.66rem; background:var(--bg-tertiary); color:var(--text-muted); border:1px dashed var(--border-color); cursor:not-allowed; text-align:left; margin-bottom:6px;">+ Fixed Support — F4</button>';
  html += '<button disabled style="width:100%; padding:7px 10px; font-size:0.66rem; background:var(--bg-tertiary); color:var(--text-muted); border:1px dashed var(--border-color); cursor:not-allowed; text-align:left; margin-bottom:8px;">+ Displacement — F4</button>';

  html += veFEASectionTitle('Yükler');
  html += '<button disabled style="width:100%; padding:7px 10px; font-size:0.66rem; background:var(--bg-tertiary); color:var(--text-muted); border:1px dashed var(--border-color); cursor:not-allowed; text-align:left; margin-bottom:6px;">+ Force (N) — F4</button>';
  html += '<button disabled style="width:100%; padding:7px 10px; font-size:0.66rem; background:var(--bg-tertiary); color:var(--text-muted); border:1px dashed var(--border-color); cursor:not-allowed; text-align:left; margin-bottom:6px;">+ Pressure (MPa) — F4</button>';
  html += '<button disabled style="width:100%; padding:7px 10px; font-size:0.66rem; background:var(--bg-tertiary); color:var(--text-muted); border:1px dashed var(--border-color); cursor:not-allowed; text-align:left;">+ Moment (Nm) — F4</button>';

  html += '</div>';
  return html;
}

// ─── 4. FEA ÇÖZÜCÜ ──────────────────────────────────────────────────────────
function getFEASolverPropertiesHTML(node) {
  var d = node.data || {};
  var html = '<div style="border-top:1px solid var(--border-color); padding-top:12px;">';

  html += '<div style="display:flex; align-items:center; gap:8px; margin-bottom:10px;">';
  html += '<div style="font-size:0.78rem; font-weight:700; color:var(--text-heading);">FEA Çözücü</div>';
  html += veFEAPhaseBadge('Faz 5');
  html += '</div>';

  html += '<div style="font-size:0.62rem; color:var(--text-muted); line-height:1.5; margin-bottom:10px;">' +
    'Lineer statik yapısal analiz: <code>[K]{u}={F}</code>. ' +
    'Çözüm sonrası von Mises, asal gerilmeler ve deplasman hesaplanır.</div>';

  html += veFEASectionTitle('Çözüm Türü');
  html += '<div style="padding:6px 10px; background:var(--bg-tertiary); border:1px solid var(--border-color); font-size:0.66rem; color:var(--text-primary); margin-bottom:8px;">Lineer Statik (Static Structural)</div>';

  html += veFEASectionTitle('Çözücü Ayarları (F5)');
  html += '<select disabled style="width:100%; padding:6px 8px; font-size:0.66rem; background:var(--bg-tertiary); color:var(--text-muted); border:1px dashed var(--border-color); margin-bottom:6px;">';
  html += '<option>Conjugate Gradient (Jacobi preconditioner) — varsayılan</option>';
  html += '<option>Direct LDLᵀ (küçük modeller için)</option>';
  html += '</select>';

  html += '<button disabled style="width:100%; padding:8px 10px; font-size:0.7rem; font-weight:600; background:var(--bg-tertiary); color:var(--text-muted); border:1px dashed var(--border-color); cursor:not-allowed; margin-bottom:10px;">▶ Çöz — F5</button>';

  html += veFEASectionTitle('Sonuçlar (F5/F6 — sensörle okunabilir)');
  html += veFEAReadOnlyRow('Maks. von Mises', '—');
  html += veFEAReadOnlyRow('Maks. deplasman', '—');
  html += veFEAReadOnlyRow('Maks. asal gerilme', '—');
  html += veFEAReadOnlyRow('Min. asal gerilme', '—');
  html += veFEAReadOnlyRow('Güvenlik faktörü', '—');
  html += veFEAReadOnlyRow('Toplam kütle', '—');

  html += '</div>';
  return html;
}
