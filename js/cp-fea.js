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

// Histogram bar chart — kalite metrikleri için inline SVG-free render
function veFEAHistogramHTML(hist, label, color, axisFmt) {
  if (!hist || !hist.bins || hist.bins.length === 0) return '';
  var maxCount = 0;
  for (var i = 0; i < hist.bins.length; i++) if (hist.bins[i] > maxCount) maxCount = hist.bins[i];
  var fmt = axisFmt || function(v) { return v.toFixed(1); };
  var html = '<div style="margin-bottom:8px;">';
  html += '<div style="font-size:0.6rem; color:var(--text-secondary); margin-bottom:3px;">' + label + '</div>';
  html += '<div style="display:flex; align-items:flex-end; height:36px; gap:1px; background:var(--bg-secondary); padding:3px; border:1px solid var(--border-color);">';
  hist.bins.forEach(function(b, idx) {
    var pct = maxCount > 0 ? (b / maxCount * 100) : 0;
    var binMin = hist.min + (hist.max - hist.min) * (idx / hist.binCount);
    var binMax = hist.min + (hist.max - hist.min) * ((idx + 1) / hist.binCount);
    var title = fmt(binMin) + '–' + fmt(binMax) + ': ' + b + ' eleman';
    html += '<div title="' + title + '" style="flex:1; background:' + color + '; height:' + pct + '%; min-height:1px; opacity:' + (b > 0 ? 0.9 : 0.18) + ';"></div>';
  });
  html += '</div>';
  html += '<div style="display:flex; justify-content:space-between; font-size:0.52rem; color:var(--text-muted); margin-top:2px;">' +
    '<span>' + fmt(hist.min) + '</span><span>' + fmt(hist.max) + '</span></div>';
  html += '</div>';
  return html;
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

  // Kuadratik enrichment — orta-kenar düğümler (Tet10/Hex20/Wedge15)
  var midSideOn = settings.midSideNodes === true;
  html += '<label style="display:flex; align-items:center; gap:6px; padding:5px 8px; margin-bottom:8px; background:var(--bg-secondary); border:1px solid var(--border-color); cursor:pointer; font-size:0.62rem; color:var(--text-primary);">' +
    '<input type="checkbox" id="ve-fea-mesh-midnodes-' + node.id + '"' + (midSideOn ? ' checked' : '') + ' style="margin:0;">' +
    '<span>Orta-kenar düğümler <span style="color:var(--text-muted);">(Quadratic: Tet10 / Hex20 / Wedge15)</span></span>' +
  '</label>';

  // Lokal sizing (boundary bias) — auto named selection'a doğru kümele
  var local = settings.localSizing || { selection: 'none', biasMode: 'power', biasStrength: 0, firstLayerThickness: 1, growthRate: 1.2, layerCount: 5 };
  var biasMode = local.biasMode || 'power';
  html += veFEASectionTitle('Lokal Yoğunlaştırma / Inflation (Beta)');
  html += '<div style="font-size:0.58rem; color:var(--text-muted); line-height:1.4; margin-bottom:6px;">' +
    'Mesh düğümlerini hedef yüzeye doğru kümeler. Power: sürekli güç fonksiyonu, ' +
    'Inflation: geometric progression ile katmanlar (ANSYS-style).</div>';
  html += '<div style="display:flex; gap:6px; align-items:center; margin-bottom:6px;">' +
    '<label for="ve-fea-mesh-local-sel-' + node.id + '" style="flex:0 0 auto; font-size:0.6rem; color:var(--text-secondary);">Hedef</label>' +
    '<select id="ve-fea-mesh-local-sel-' + node.id + '" style="flex:1; padding:4px 6px; font-size:0.62rem; background:var(--bg-input); color:var(--text-primary); border:1px solid var(--border-color);">';
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
    var selectedAttr = (local.selection === f[0]) ? ' selected' : '';
    html += '<option value="' + f[0] + '"' + selectedAttr + '>' + f[1] + '</option>';
  });
  html += '</select></div>';
  html += '<div style="display:flex; gap:6px; align-items:center; margin-bottom:6px;">' +
    '<label for="ve-fea-mesh-local-mode-' + node.id + '" style="flex:0 0 auto; font-size:0.6rem; color:var(--text-secondary);">Mod</label>' +
    '<select id="ve-fea-mesh-local-mode-' + node.id + '" style="flex:1; padding:4px 6px; font-size:0.62rem; background:var(--bg-input); color:var(--text-primary); border:1px solid var(--border-color);">' +
      '<option value="power"' + (biasMode === 'power' ? ' selected' : '') + '>Güç fonksiyonu</option>' +
      '<option value="inflation"' + (biasMode === 'inflation' ? ' selected' : '') + '>Inflation katmanları</option>' +
    '</select></div>';
  if (biasMode === 'power') {
    html += '<div style="display:flex; gap:6px; align-items:center; margin-bottom:8px;">' +
      '<label for="ve-fea-mesh-local-bias-' + node.id + '" style="flex:0 0 auto; font-size:0.6rem; color:var(--text-secondary);">Yığılma</label>' +
      '<input id="ve-fea-mesh-local-bias-' + node.id + '" type="range" min="0" max="100" step="5" value="' + Math.round((local.biasStrength || 0) * 100) + '" style="flex:1;">' +
      '<span style="font-size:0.6rem; color:var(--text-muted); width:34px; text-align:right;">' + Math.round((local.biasStrength || 0) * 100) + '%</span>' +
    '</div>';
  } else {
    // Inflation params
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

  // Curvature-based refinement (silindir/şaft için çevresel)
  var curv = settings.curvatureRefinement || { enabled: false, normalAngleDeg: 18 };
  html += '<label style="display:flex; align-items:center; gap:6px; padding:5px 8px; margin-bottom:6px; background:var(--bg-secondary); border:1px solid var(--border-color); cursor:pointer; font-size:0.62rem; color:var(--text-primary);">' +
    '<input type="checkbox" id="ve-fea-mesh-curv-' + node.id + '"' + (curv.enabled ? ' checked' : '') + ' style="margin:0;">' +
    '<span>Eğrilik tabanlı incelt <span style="color:var(--text-muted);">(silindir/şaft çevresel)</span></span>' +
  '</label>';
  html += '<div style="display:flex; gap:6px; align-items:center; margin-bottom:8px; padding-left:24px;">' +
    '<label for="ve-fea-mesh-curv-ang-' + node.id + '" style="flex:1; font-size:0.6rem; color:var(--text-secondary);">Maks yüzey açısı</label>' +
    '<input id="ve-fea-mesh-curv-ang-' + node.id + '" type="number" min="1" max="90" step="1" value="' + (curv.normalAngleDeg || 18) + '" style="width:60px; padding:3px 6px; font-size:0.62rem; background:var(--bg-input); color:var(--text-primary); border:1px solid var(--border-color);">' +
    '<span style="font-size:0.55rem; color:var(--text-muted);">°</span>' +
  '</div>';

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
    if (metrics.sweepAxis) {
      html += veFEAReadOnlyRow('Sweep ekseni', metrics.sweepAxis + ' (axial)');
    }
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

  // ─── Jacobian / Geçerlilik Kontrolü ─────────────────────────────────────
  html += veFEASectionTitle('Jacobian / Geçerlilik');
  if (hasMesh && metrics.jacobian) {
    var jm = metrics.jacobian;
    var statusColor = jm.valid ? 'var(--accent-success, #22c55e)' : 'var(--accent-danger, #ef4444)';
    var statusText = jm.valid ? '✓ GEÇERLİ (tüm Jacobianlar pozitif)' : '✗ HATALI (ters/dejenere eleman var)';
    html += '<div style="padding:6px 8px; background:' + (jm.valid ? 'rgba(34,197,94,0.08)' : 'rgba(239,68,68,0.08)') +
      '; border:1px solid ' + statusColor + '; font-size:0.62rem; color:' + statusColor + '; margin-bottom:6px; font-weight:600;">' +
      statusText + '</div>';
    html += veFEAReadOnlyRow('Ters dönmüş eleman', (jm.invertedCount || 0).toLocaleString('tr-TR'));
    html += veFEAReadOnlyRow('Dejenere eleman', (jm.degenerateCount || 0).toLocaleString('tr-TR'));
    html += veFEAReadOnlyRow('Min Jacobian oranı', (jm.minJacRatio || 0).toFixed(2));
    html += veFEAReadOnlyRow('Maks Jacobian oranı', (jm.maxJacRatio || 0).toFixed(2));
    html += veFEAReadOnlyRow('Ortalama Jacobian oranı', (jm.avgJacRatio || 0).toFixed(2));
    if (jm.poorCount > 0) {
      html += '<div style="padding:6px 8px; background:rgba(245,158,11,0.08); border-left:2px solid var(--accent-warning, #f59e0b); font-size:0.58rem; color:var(--accent-warning, #f59e0b); margin-top:4px;">' +
        '⚠ ' + jm.poorCount.toLocaleString('tr-TR') + ' eleman düşük kaliteli (Jac oranı > ' + jm.ratioWarnThreshold + ')</div>';
    }
  } else {
    html += veFEAReadOnlyRow('Durum', '—');
  }

  // ─── Eleman Kalite Metrikleri (Aspect / Skewness / Açı) ─────────────────
  html += veFEASectionTitle('Kalite Metrikleri (Aspect / Skewness / Açı)');
  if (hasMesh && metrics.quality) {
    var q = metrics.quality;
    // Aspect ratio
    html += veFEAReadOnlyRow('Aspect Min / Maks / Ort', (q.aspectRatio.min || 0).toFixed(2) + ' / ' + (q.aspectRatio.max || 0).toFixed(2) + ' / ' + (q.aspectRatio.avg || 0).toFixed(2));
    if (q.aspectRatio.poorCount > 0) {
      html += '<div style="padding:4px 8px; font-size:0.58rem; color:var(--accent-warning, #f59e0b); border-left:2px solid var(--accent-warning, #f59e0b); margin-bottom:6px; background:rgba(245,158,11,0.06);">' +
        '⚠ ' + q.aspectRatio.poorCount.toLocaleString('tr-TR') + ' eleman aspect > ' + q.aspectRatio.warnThreshold + '</div>';
    }
    html += veFEAHistogramHTML(q.aspectRatio.histogram, 'Aspect Ratio histogramı', '#3b82f6', function(v){return v.toFixed(1);});

    // Skewness
    html += veFEAReadOnlyRow('Skewness Min / Maks / Ort', (q.skewness.min || 0).toFixed(3) + ' / ' + (q.skewness.max || 0).toFixed(3) + ' / ' + (q.skewness.avg || 0).toFixed(3));
    if (q.skewness.poorCount > 0) {
      html += '<div style="padding:4px 8px; font-size:0.58rem; color:var(--accent-warning, #f59e0b); border-left:2px solid var(--accent-warning, #f59e0b); margin-bottom:6px; background:rgba(245,158,11,0.06);">' +
        '⚠ ' + q.skewness.poorCount.toLocaleString('tr-TR') + ' eleman skewness > ' + q.skewness.warnThreshold + '</div>';
    }
    html += veFEAHistogramHTML(q.skewness.histogram, 'Skewness histogramı (0=ideal, 1=dejenere)', '#f59e0b', function(v){return v.toFixed(2);});

    // İç açı
    html += veFEAReadOnlyRow('Min / Maks iç açı', (q.angle.min || 0).toFixed(1) + '° / ' + (q.angle.max || 0).toFixed(1) + '°');
    html += veFEAHistogramHTML(q.angle.histogram, 'Min iç açı histogramı (derece)', '#22c55e', function(v){return v.toFixed(0) + '°';});
  } else {
    html += '<div style="padding:6px 8px; background:var(--bg-tertiary); border:1px solid var(--border-color); font-size:0.62rem; color:var(--text-muted);">Mesh oluşturulduktan sonra otomatik hesaplanır.</div>';
  }

  // ─── Adaptive Refinement Önerileri ─────────────────────────────────────
  html += veFEASectionTitle('Adaptive Refinement Önerileri');
  if (hasMesh && typeof veFEAComputeRefinementSuggestions === 'function') {
    var suggestions = veFEAComputeRefinementSuggestions(metrics);
    suggestions.forEach(function(s) {
      var color, bg, icon;
      if (s.severity === 'critical') { color = 'var(--accent-danger, #ef4444)'; bg = 'rgba(239,68,68,0.08)'; icon = '✗'; }
      else if (s.severity === 'warn') { color = 'var(--accent-warning, #f59e0b)'; bg = 'rgba(245,158,11,0.08)'; icon = '⚠'; }
      else if (s.severity === 'info')  { color = 'var(--accent-info, #3b82f6)';  bg = 'rgba(59,130,246,0.08)'; icon = 'ℹ'; }
      else { color = 'var(--accent-success, #22c55e)'; bg = 'rgba(34,197,94,0.08)'; icon = '✓'; }
      html += '<div style="padding:6px 8px; background:' + bg + '; border-left:2px solid ' + color + '; font-size:0.6rem; color:' + color + '; margin-bottom:6px;">' +
        icon + ' ' + s.message;
      if (s.action) {
        var actionType = s.action.type;
        var actionDataJson = JSON.stringify(s.action).replace(/"/g, '&quot;');
        html += '<button onclick=\'veFEAApplyRefinementSuggestion("' + node.id + '", "' + actionType + '", ' + JSON.stringify(s.action) + ')\' style="display:block; margin-top:4px; padding:4px 8px; font-size:0.58rem; background:' + color + '; color:#fff; border:none; cursor:pointer;">Uygula →</button>';
      }
      html += '</div>';
    });
  } else {
    html += '<div style="padding:6px 8px; background:var(--bg-tertiary); border:1px solid var(--border-color); font-size:0.62rem; color:var(--text-muted);">Mesh oluşturulduktan sonra öneriler gösterilir.</div>';
  }

  // ─── Mesh Export (Abaqus / NASTRAN / VTK) ───────────────────────────────
  html += veFEASectionTitle('Mesh Export');
  if (hasMesh) {
    html += '<div style="font-size:0.58rem; color:var(--text-muted); line-height:1.5; margin-bottom:6px;">' +
      'Mesh\'i standart FEA format\'ında dışa aktar. ANSYS, Abaqus, ParaView gibi araçlarda açılabilir.</div>';
    html += '<div style="display:grid; grid-template-columns:repeat(3, 1fr); gap:4px; margin-bottom:8px;">';
    html += '<button onclick="veFEAExportMeshForNode(\'' + node.id + '\', \'abaqus\')" style="padding:6px; font-size:0.6rem; background:var(--bg-tertiary); color:var(--text-primary); border:1px solid var(--border-color); cursor:pointer;" title="Abaqus .inp">📦 Abaqus<br><span style="font-size:0.5rem; color:var(--text-muted);">.inp</span></button>';
    html += '<button onclick="veFEAExportMeshForNode(\'' + node.id + '\', \'nastran\')" style="padding:6px; font-size:0.6rem; background:var(--bg-tertiary); color:var(--text-primary); border:1px solid var(--border-color); cursor:pointer;" title="NASTRAN .nas">📦 NASTRAN<br><span style="font-size:0.5rem; color:var(--text-muted);">.nas</span></button>';
    html += '<button onclick="veFEAExportMeshForNode(\'' + node.id + '\', \'vtk\')" style="padding:6px; font-size:0.6rem; background:var(--bg-tertiary); color:var(--text-primary); border:1px solid var(--border-color); cursor:pointer;" title="VTK ParaView">📦 VTK<br><span style="font-size:0.5rem; color:var(--text-muted);">.vtk</span></button>';
    html += '</div>';
  } else {
    html += '<div style="padding:6px 8px; background:var(--bg-tertiary); border:1px solid var(--border-color); font-size:0.62rem; color:var(--text-muted);">Mesh oluşturulduktan sonra export edilebilir.</div>';
  }

  // ─── Görünüm Modu (Wireframe / Solid / Heat Map) ───────────────────────
  html += veFEASectionTitle('Görünüm Modu');
  if (hasMesh) {
    var displayMode = d.heatMapMetric || 'off';
    html += '<div style="font-size:0.58rem; color:var(--text-muted); line-height:1.5; margin-bottom:6px;">' +
      'Mesh\'in 3D önizlemede nasıl gösterileceğini seçin. Heat Map modları: ' +
      'mavi = iyi kalite, kırmızı = kötü.</div>';
    html += '<select onchange="veFEAApplyHeatMap(\'' + node.id + '\', this.value)" style="width:100%; padding:5px 8px; font-size:0.66rem; background:var(--bg-input); color:var(--text-primary); border:1px solid var(--border-color); margin-bottom:6px;">';
    html += '<optgroup label="Standart">';
    html += '<option value="off"' + (displayMode === 'off' || !d.heatMapMetric ? ' selected' : '') + '>Wireframe (kenarlar)</option>';
    html += '<option value="solid"' + (displayMode === 'solid' ? ' selected' : '') + '>Solid (yüzey)</option>';
    html += '<option value="solid-edges"' + (displayMode === 'solid-edges' ? ' selected' : '') + '>Solid + Edges</option>';
    html += '</optgroup>';
    html += '<optgroup label="Heat Map (Kalite)">';
    html += '<option value="aspect"' + (displayMode === 'aspect' ? ' selected' : '') + '>Aspect Ratio</option>';
    html += '<option value="skewness"' + (displayMode === 'skewness' ? ' selected' : '') + '>Skewness</option>';
    html += '<option value="minAngle"' + (displayMode === 'minAngle' ? ' selected' : '') + '>Min İç Açı</option>';
    html += '<option value="jacobianRatio"' + (displayMode === 'jacobianRatio' ? ' selected' : '') + '>Jacobian Oranı</option>';
    html += '</optgroup>';
    html += '</select>';
    // Heat map modunda renk legend'ı
    var isHeatMap = (displayMode === 'aspect' || displayMode === 'skewness' || displayMode === 'minAngle' || displayMode === 'jacobianRatio');
    if (isHeatMap) {
      html += '<div style="display:flex; align-items:center; gap:6px; margin-bottom:4px;">' +
        '<span style="font-size:0.55rem; color:var(--text-muted);">İyi</span>' +
        '<div style="flex:1; height:8px; background:linear-gradient(to right, #0000ff, #00ffff, #00ff00, #ffff00, #ff0000); border:1px solid var(--border-color);"></div>' +
        '<span style="font-size:0.55rem; color:var(--text-muted);">Kötü</span>' +
      '</div>';
    }
  } else {
    html += '<div style="padding:6px 8px; background:var(--bg-tertiary); border:1px solid var(--border-color); font-size:0.62rem; color:var(--text-muted);">Mesh oluşturulduktan sonra kullanılabilir.</div>';
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
  var midSideEl = document.getElementById('ve-fea-mesh-midnodes-' + nodeId);
  var midSideNodes = !!(midSideEl && midSideEl.checked);
  var curvEl = document.getElementById('ve-fea-mesh-curv-' + nodeId);
  var curvAngEl = document.getElementById('ve-fea-mesh-curv-ang-' + nodeId);
  var curvEnabled = !!(curvEl && curvEl.checked);
  var curvAngDeg = curvAngEl ? parseFloat(curvAngEl.value) : 18;
  if (!isFinite(curvAngDeg) || curvAngDeg <= 0) curvAngDeg = 18;
  if (curvAngDeg > 90) curvAngDeg = 90;
  if (curvAngDeg < 1) curvAngDeg = 1;
  var localSelEl = document.getElementById('ve-fea-mesh-local-sel-' + nodeId);
  var localModeEl = document.getElementById('ve-fea-mesh-local-mode-' + nodeId);
  var localBiasEl = document.getElementById('ve-fea-mesh-local-bias-' + nodeId);
  var localFirstEl = document.getElementById('ve-fea-mesh-local-first-' + nodeId);
  var localGrowEl = document.getElementById('ve-fea-mesh-local-grow-' + nodeId);
  var localNlayEl = document.getElementById('ve-fea-mesh-local-nlay-' + nodeId);
  var localSelection = (localSelEl && localSelEl.value) ? localSelEl.value : 'none';
  var localBiasMode = (localModeEl && localModeEl.value) ? localModeEl.value : 'power';
  if (localBiasMode !== 'power' && localBiasMode !== 'inflation') localBiasMode = 'power';
  var localBias = localBiasEl ? (parseFloat(localBiasEl.value) / 100) : 0;
  if (!isFinite(localBias) || localBias < 0) localBias = 0;
  if (localBias > 1) localBias = 1;
  var localFirst = localFirstEl ? parseFloat(localFirstEl.value) : 1;
  if (!isFinite(localFirst) || localFirst <= 0) localFirst = 1;
  var localGrow = localGrowEl ? parseFloat(localGrowEl.value) : 1.2;
  if (!isFinite(localGrow) || localGrow < 1) localGrow = 1.2;
  if (localGrow > 5) localGrow = 5;
  var localNlay = localNlayEl ? parseInt(localNlayEl.value, 10) : 5;
  if (!isFinite(localNlay) || localNlay < 1) localNlay = 5;
  if (localNlay > 50) localNlay = 50;
  var meshNode = nodes.find(function(n) { return n.id === nodeId; });
  if (meshNode) {
    meshNode.data = meshNode.data || {};
    meshNode.data.meshSettings = meshNode.data.meshSettings || {};
    meshNode.data.meshSettings.size = size;
    meshNode.data.meshSettings.mode = mode;
    meshNode.data.meshSettings.elementType = elementType;
    meshNode.data.meshSettings.midSideNodes = midSideNodes;
    meshNode.data.meshSettings.curvatureRefinement = { enabled: curvEnabled, normalAngleDeg: curvAngDeg };
    meshNode.data.meshSettings.localSizing = {
      selection: localSelection,
      biasMode: localBiasMode,
      biasStrength: localBias,
      firstLayerThickness: localFirst,
      growthRate: localGrow,
      layerCount: localNlay
    };
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
