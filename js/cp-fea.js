// ============================================================================
// YAPISAL ANALİZ (FEA) — Kontrol Paneli İskeletleri
// ============================================================================
// Bu dosya FEA zincirinin 4 alt bileşeninin (Geometri, Mesh, Sınır Koşulları,
// Çözücü) özellik panelini sağlar. F1 aşamasında yalnız iskelet vardır;
// gerçek işlev sonraki fazlarda (F2-F6) dolacak:
//   F2 → Geometri: Three.js viewer + OCCT.js + STEP import
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

// Histogram bar chart — kalite metrikleri için inline SVG-free render.
// thresholds (opsiyonel): { warnLimit, errLimit, inverted } → her bin'i ANSYS
// Mesh Quality Worksheet renkleriyle boyar (yeşil/sarı/kırmızı). thresholds
// yoksa tüm bar'lar tek renk (`color`).
// onBarClickJSExpr (opsiyonel): string JS ifadesi — örn.
//   'veFEAHighlightQualityBin("node-1", "aspectRatio")'
// Her bar'a onclick="(<expr>)(binIdx)" eklenir; ANSYS-style bin-selection.
function veFEAHistogramHTML(hist, label, color, axisFmt, thresholds, onBarClickJSExpr) {
  if (!hist || !hist.bins || hist.bins.length === 0) return '';
  var maxCount = 0;
  for (var i = 0; i < hist.bins.length; i++) if (hist.bins[i] > maxCount) maxCount = hist.bins[i];
  var fmt = axisFmt || function(v) { return v.toFixed(1); };
  var clickable = !!onBarClickJSExpr;
  var html = '<div style="margin-bottom:8px;">';
  html += '<div style="font-size:0.6rem; color:var(--text-secondary); margin-bottom:3px;">' + label +
    (clickable ? ' <span style="color:var(--text-muted); font-size:0.55rem;">(bin tıkla → 3D vurgu)</span>' : '') + '</div>';
  html += '<div style="display:flex; align-items:flex-end; height:36px; gap:1px; background:var(--bg-secondary); padding:3px; border:1px solid var(--border-color);">';
  hist.bins.forEach(function(b, idx) {
    var pct = maxCount > 0 ? (b / maxCount * 100) : 0;
    var binMin = hist.min + (hist.max - hist.min) * (idx / hist.binCount);
    var binMax = hist.min + (hist.max - hist.min) * ((idx + 1) / hist.binCount);
    var binCenter = (binMin + binMax) / 2;
    var title = fmt(binMin) + '–' + fmt(binMax) + ': ' + b + ' eleman' + (clickable && b > 0 ? ' (tıkla)' : '');
    var binColor = color;
    if (thresholds && typeof veFEAThresholdColor === 'function') {
      var rgb = veFEAThresholdColor(binCenter, thresholds.warnLimit, thresholds.errLimit, !!thresholds.inverted);
      binColor = 'rgb(' + Math.round(rgb[0]*255) + ',' + Math.round(rgb[1]*255) + ',' + Math.round(rgb[2]*255) + ')';
    }
    var clickAttr = (clickable && b > 0)
      ? ' onclick="(' + onBarClickJSExpr + ')(' + idx + ', this)" style="flex:1; background:' + binColor +
        '; height:' + pct + '%; min-height:1px; opacity:' + (b > 0 ? 0.9 : 0.18) + '; cursor:pointer;"'
        + ' onmouseenter="this.style.outline=\'2px solid #fbbf24\'" onmouseleave="this.style.outline=\'none\'"'
      : ' style="flex:1; background:' + binColor + '; height:' + pct + '%; min-height:1px; opacity:' + (b > 0 ? 0.9 : 0.18) + ';"';
    html += '<div title="' + title + '"' + clickAttr + '></div>';
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
  // 10 primitif için buton grid'i (5×2) dar sidebar'da sıkışık duruyordu;
  // tek bir dropdown daha temiz + tüm primitiflere kolay erişim sağlar.
  // onchange ile form açma davranışı: ilk seçimde form gözükür.
  var types = (typeof veFEAPrimitiveTypes === 'function') ? veFEAPrimitiveTypes() : [];
  var activeTypeSel = hasGeom ? geom.type : '';
  html += '<select onchange="veFEASelectParamForm(\'' + node.id + '\', this.value)" style="width:100%; padding:7px 8px; font-size:0.66rem; background:var(--bg-tertiary); color:var(--text-primary); border:1px solid var(--border-color); cursor:pointer; margin-bottom:8px;">';
  html += '<option value=""' + (activeTypeSel === '' ? ' selected' : '') + '>— Primitif türü seçin —</option>';
  types.forEach(function(t) {
    var label = (typeof veFEAPrimitiveLabel === 'function') ? veFEAPrimitiveLabel(t) : t;
    var sel = (activeTypeSel === t) ? ' selected' : '';
    html += '<option value="' + t + '"' + sel + '>' + label + '</option>';
  });
  html += '</select>';

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

  // CAD import — sadece STEP
  html += veFEASectionTitle('CAD Dosya İçe Aktar');
  html += '<input type="file" id="ve-fea-step-input-' + node.id + '" accept=".step,.stp" style="display:none" onchange="veFEAOnSTEPFileSelected(this, \'' + node.id + '\')">';
  html += '<div style="display:flex; flex-direction:column; gap:6px; margin-bottom:10px;">';
  html += '<button onclick="document.getElementById(\'ve-fea-step-input-' + node.id + '\').click()" style="padding:7px 10px; font-size:0.66rem; background:var(--bg-tertiary); color:var(--text-primary); border:1px solid var(--border-color); cursor:pointer; text-align:left;" onmouseenter="this.style.borderColor=\'var(--accent-primary)\'" onmouseleave="this.style.borderColor=\'var(--border-color)\'">📥 STEP Yükle (.step / .stp)</button>';
  html += '<div style="font-size:0.55rem; color:var(--text-muted); padding:0 4px;">STEP OpenCascade WebAssembly ile yüklenir (~7 MB). İlk dosyada birkaç saniye sürer.</div>';
  html += '</div>';

  // ─── DURUM ────────────────────────────────────────────────────────────
  html += veFEASectionTitle('Durum');
  if(hasGeom) {
    var sourceName = geom.sourceLabel || (typeof veFEAPrimitiveLabel === 'function' ? veFEAPrimitiveLabel(geom.type) : geom.type);
    html += veFEAReadOnlyRow('Yüklenen geometri', sourceName);
    if(geom.type === 'step' && geom.triangleCount) {
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
    // ANSYS-style tespit edilen yuzey ozellikleri ozeti (STEP icin)
    if (geom.detectedFeatures && geom.detectedFeatures.summary) {
      var s = geom.detectedFeatures.summary;
      var parts = [];
      if (s.planar)      parts.push(s.planar + ' düzlemsel');
      if (s.cylindrical) parts.push(s.cylindrical + ' silindirik');
      if (s.spherical)   parts.push(s.spherical + ' küresel');
      if (s.conical)     parts.push(s.conical + ' konik');
      if (s.freeform)    parts.push(s.freeform + ' serbest form');
      if (parts.length) {
        // Primitif inference dene
        var inferred = null;
        if (typeof veFEAInferPrimitiveFromFeatures === 'function') {
          inferred = veFEAInferPrimitiveFromFeatures(geom.detectedFeatures, geom.bbox);
        }
        html += '<div style="margin-top:8px; padding:7px 9px; font-size:0.6rem; color:var(--text-primary); background:rgba(34,197,94,0.08); border-left:3px solid var(--accent-success,#22c55e); border-radius:2px;">';
        html += '<div style="font-weight:600; color:var(--accent-success,#22c55e); margin-bottom:3px;">✓ Geometri tanındı</div>';
        html += '<div style="color:var(--text-muted); line-height:1.5;">' + parts.join(', ') + '</div>';
        if (geom.detectedFeatures.edgeStats) {
          html += '<div style="color:var(--text-muted); font-size:0.55rem; margin-top:3px;">Kenarlar: ' +
            geom.detectedFeatures.edgeStats.sharp + ' keskin, ' +
            geom.detectedFeatures.edgeStats.smooth + ' yumuşak</div>';
        }
        if (inferred && inferred.confidence > 0.85 && typeof veFEAInferredPrimitiveLabel === 'function') {
          html += '<div style="margin-top:6px; padding-top:6px; border-top:1px solid rgba(34,197,94,0.25);">';
          html += '<div style="font-weight:600; color:var(--accent-success,#22c55e); font-size:0.58rem;">★ Primitif eşleşmesi: ' + veFEAInferredPrimitiveLabel(inferred) + '</div>';
          html += '<div style="color:var(--text-muted); font-size:0.55rem; margin-top:2px;">' +
            'Yapısal Hex8 mesh uygulanacak (' + (inferred.confidence * 100).toFixed(0) + '% güvenle)</div>';
          html += '</div>';
        }
        html += '</div>';
      }
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

// Dropdown'dan çağrılır. Toggle yerine her zaman açar — kullanıcı dropdown'dan
// bir tür seçtiğinde formun "kapanması" UX hatası olur (aynı türü tekrar
// seçmesi gerekir). Boş value gelirse tüm formları kapat.
function veFEASelectParamForm(nodeId, type) {
  var types = (typeof veFEAPrimitiveTypes === 'function') ? veFEAPrimitiveTypes() : [];
  types.forEach(function(t) {
    var el = document.getElementById('ve-fea-form-' + nodeId + '-' + t);
    if(el) el.style.display = (t === type) ? 'block' : 'none';
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
// Side panel sadeleştirildi (Tier UI refactor). Tüm mesh ayarları, kalite
// metrikleri, named selections, heat map ve export modal pencerede:
//   js/fea-mesh-editor.js → veFEAOpenMeshEditor(nodeId)
function getFEAMeshPropertiesHTML(node) {
  var d = node.data || {};
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

  html += '<div style="font-size:0.62rem; color:var(--text-muted); line-height:1.5; margin-bottom:12px;">' +
    'Tüm mesh ayarları, kalite metrikleri, named selections, heat map ve export ' +
    '<b>Mesh Editörü</b> penceresinde. Aşağıdaki butona tıklayın.</div>';

  // Geometri Girdisi durumu
  html += veFEASectionTitle('Geometri Girdisi');
  html += '<div style="padding:6px 8px; background:' + (geomOk ? 'var(--bg-tertiary)' : 'rgba(245,158,11,0.08)') +
    '; border:1px solid ' + (geomOk ? 'var(--border-color)' : 'var(--accent-warning, #f59e0b)') +
    '; font-size:0.62rem; color:var(--text-primary); margin-bottom:10px;">' +
    (geomOk ? '✓ ' : '⚠ ') + geomLabel + '</div>';

  // Mesh Durumu
  html += veFEASectionTitle('Mesh Durumu');
  if (hasMesh) {
    var typeLabel = (typeof veFEAMeshLabel === 'function') ? veFEAMeshLabel(metrics.elementType) : metrics.elementType;
    var jacOk = metrics.jacobian ? metrics.jacobian.valid : true;
    var jacColor = jacOk ? 'var(--accent-success, #22c55e)' : 'var(--accent-danger, #ef4444)';
    html += '<div style="padding:8px 10px; background:var(--bg-tertiary); border:1px solid var(--border-color); font-size:0.62rem; color:var(--text-primary); margin-bottom:10px;">' +
      '<div style="display:flex; justify-content:space-between; margin-bottom:3px;">' +
        '<span style="color:var(--text-secondary);">Eleman tipi</span>' +
        '<span style="font-weight:600;">' + typeLabel + '</span>' +
      '</div>' +
      '<div style="display:flex; justify-content:space-between; margin-bottom:3px;">' +
        '<span style="color:var(--text-secondary);">Düğüm / Eleman</span>' +
        '<span style="font-weight:600;">' + metrics.nodeCount.toLocaleString('tr-TR') + ' / ' + metrics.elementCount.toLocaleString('tr-TR') + '</span>' +
      '</div>' +
      '<div style="display:flex; justify-content:space-between;">' +
        '<span style="color:var(--text-secondary);">Geçerlilik</span>' +
        '<span style="font-weight:600; color:' + jacColor + ';">' + (jacOk ? '✓ Geçerli' : '✗ Hatalı') + '</span>' +
      '</div>' +
    '</div>';
  } else {
    html += '<div style="padding:8px 10px; background:var(--bg-tertiary); border:1px solid var(--border-color); font-size:0.62rem; color:var(--text-muted); margin-bottom:10px;">— Henüz mesh hesaplanmadı</div>';
  }

  // ÇALIŞTIR — Mesh Editörünü Aç
  html += '<button onclick="veFEAOpenMeshEditor(\'' + node.id + '\')" style="width:100%; padding:14px 16px; font-size:0.82rem; font-weight:700; background:var(--accent-primary); color:#fff; border:none; cursor:pointer; letter-spacing:0.04em; transition:all 0.12s;" onmouseover="this.style.filter=\'brightness(1.15)\'" onmouseout="this.style.filter=\'none\'">▶ ÇALIŞTIR — Mesh Editörünü Aç</button>';

  html += '<div style="font-size:0.55rem; color:var(--text-muted); line-height:1.5; margin-top:8px; padding:0 2px;">' +
    'Modal pencerede: <b>Defaults</b> (eleman tipi, sırası) · <b>Sizing</b> (boyut, curvature, worker) · ' +
    '<b>Inflation</b> (power / inflation katmanları) · <b>Quality</b> (Jacobian, aspect, skewness, histogramlar) · ' +
    '<b>Named Selections</b> · <b>Display</b> (heat map) · <b>Statistics</b> · <b>Adaptive Önerileri</b></div>';

  html += '</div>';
  return html;
}

// Mesh paneli UI köprüleri — modal içinden DOM ID\'leri okuyup state\'i günceller.
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
  if (elementType !== 'auto' && elementType !== 'tet4' && elementType !== 'pyramid5') elementType = 'auto';
  var midSideEl = document.getElementById('ve-fea-mesh-midnodes-' + nodeId);
  var midSideNodes = !!(midSideEl && midSideEl.checked);
  // crossSection: kullanici 'wedge' opsiyonunu acikca secmis ise pass, aksi
  // takdirde 'auto' (default O-grid Hex8) — _veFEAMeshCylinder bunu O-grid'e cevirir.
  var crossSel = document.getElementById('ve-fea-mesh-cross-' + nodeId);
  var crossSection = (crossSel && crossSel.value === 'wedge') ? 'wedge' : 'auto';
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
    meshNode.data.meshSettings.crossSection = crossSection;
    meshNode.data.meshSettings.curvatureRefinement = { enabled: curvEnabled, normalAngleDeg: curvAngDeg };
    meshNode.data.meshSettings.localSizing = {
      selection: localSelection,
      biasMode: localBiasMode,
      biasStrength: localBias,
      firstLayerThickness: localFirst,
      growthRate: localGrow,
      layerCount: localNlay
    };
    var workerEl = document.getElementById('ve-fea-mesh-worker-' + nodeId);
    meshNode.data.meshSettings.useWorker = !!(workerEl && workerEl.checked);
    // Delaunay tet mesher ayarları (STEP karmaşık geometriler için tet4)
    var tetMesherEl = document.getElementById('ve-fea-mesh-tetmesher-' + nodeId);
    var tetMesherInteriorEl = document.getElementById('ve-fea-mesh-tetmesher-interior-' + nodeId);
    meshNode.data.meshSettings.useTetMesher = tetMesherEl ? !!tetMesherEl.checked : true;
    meshNode.data.meshSettings.delaunayAddInteriorPoints = tetMesherInteriorEl ? !!tetMesherInteriorEl.checked : true;
  }
  veFEABuildMeshForNode(nodeId);
}
// ─── 3. SINIR KOŞULLARI ─────────────────────────────────────────────────────
function getFEABCPropertiesHTML(node) {
  var d = node.data || {};
  if (!d.bc) d.bc = { materialId: 'steel-st37', assignments: [] };

  // Yukarı akıştaki geometri/mesh + face listesi
  var meshNode = _veFEAFindUpstreamMeshNode(node);
  var geomNode = meshNode ? _veFEAFindUpstreamGeometryNode(meshNode) : null;
  var topology = null;
  if (geomNode && geomNode.data && geomNode.data.geometry && typeof veFEAComputeGeometryTopology === 'function') {
    topology = veFEAComputeGeometryTopology(geomNode.data.geometry);
  }
  var faces = (topology && Array.isArray(topology.faces)) ? topology.faces : [];

  var html = '<div style="border-top:1px solid var(--border-color); padding-top:12px;">';
  html += '<div style="display:flex; align-items:center; gap:8px; margin-bottom:10px;">';
  html += '<div style="font-size:0.78rem; font-weight:700; color:var(--text-heading);">Sınır Koşulları</div>';
  html += '</div>';

  // ─── Malzeme seçici ───
  html += veFEASectionTitle('Malzeme');
  if (typeof veFEAMaterialsByCategory === 'function') {
    html += '<select onchange="veFEABCSetMaterial(\'' + node.id + '\', this.value)" style="width:100%; padding:6px 8px; font-size:0.66rem; background:var(--bg-secondary); color:var(--text-primary); border:1px solid var(--border-color); margin-bottom:6px;">';
    var groups = veFEAMaterialsByCategory();
    Object.keys(groups).forEach(function (cat) {
      html += '<optgroup label="' + veFEAMaterialCategoryLabel(cat) + '">';
      groups[cat].forEach(function (m) {
        var sel = (d.bc.materialId === m.id) ? ' selected' : '';
        html += '<option value="' + m.id + '"' + sel + '>' + m.label + '</option>';
      });
      html += '</optgroup>';
    });
    html += '</select>';
    var matSel = veFEAMaterialById(d.bc.materialId) || veFEAMaterialById('steel-st37');
    if (matSel) {
      html += '<div style="font-size:0.6rem; color:var(--text-muted); margin-bottom:10px; line-height:1.5;">';
      html += 'E = ' + Math.round(matSel.youngsModulus) + ' MPa, ν = ' + matSel.poissonsRatio.toFixed(2) +
              ', ρ = ' + matSel.density + ' kg/m³, σ<sub>y</sub> = ' + matSel.yieldStrength + ' MPa';
      html += '</div>';
    }
  } else {
    html += '<div style="font-size:0.62rem; color:var(--text-muted);">Malzeme kütüphanesi yüklenmedi.</div>';
  }

  // ─── Yüzey atamaları ───
  html += veFEASectionTitle('Yüzeye Sınır Koşulu Ata');
  if (!faces.length) {
    html += '<div style="padding:8px; background:var(--bg-tertiary); border:1px dashed var(--border-color); font-size:0.62rem; color:var(--text-muted); margin-bottom:8px;">';
    html += 'Önce yukarı akışta geometri tanımlanmalı (Geometri → Mesh → Sınır Koşulu).';
    html += '</div>';
  } else {
    html += '<div style="display:grid; grid-template-columns:1fr 110px 60px; gap:4px; margin-bottom:6px; font-size:0.6rem; color:var(--text-muted); font-weight:600;">';
    html += '<div>Yüzey</div><div>Tip</div><div>İşlem</div>';
    html += '</div>';
    (d.bc.assignments || []).forEach(function (a, idx) {
      var face = faces.filter(function (f) { return f.id === a.faceId; })[0];
      var faceLabel = face ? face.label : a.faceId;
      var kindLabel = ({
        'fixed': 'Fixed Support',
        'force': 'Kuvvet (N)',
        'pressure': 'Basınç (MPa)',
        'displacement': 'Yer Değişt.'
      })[a.kind] || a.kind;
      html += '<div style="display:grid; grid-template-columns:1fr 110px 60px; gap:4px; margin-bottom:4px; font-size:0.6rem; align-items:center;">';
      html += '<div style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="' + faceLabel + '">' + faceLabel + '</div>';
      html += '<div style="color:var(--accent-primary);">' + kindLabel + '</div>';
      html += '<button onclick="veFEABCRemoveAssignment(\'' + node.id + '\', ' + idx + ')" style="padding:2px 6px; font-size:0.6rem; background:var(--accent-danger,#ef4444); color:white; border:none; cursor:pointer;">Sil</button>';
      html += '</div>';
      // Detay satırı (vector / magnitude görünür)
      if (a.value) {
        var detail = '';
        if (a.kind === 'force' && a.value) {
          detail = 'F = (' + (a.value.fx || 0) + ', ' + (a.value.fy || 0) + ', ' + (a.value.fz || 0) + ') N';
        } else if (a.kind === 'pressure') {
          detail = 'p = ' + (a.value.magnitude || 0) + ' MPa';
        } else if (a.kind === 'displacement' && a.value) {
          detail = 'u = (' + (a.value.ux || 0) + ', ' + (a.value.uy || 0) + ', ' + (a.value.uz || 0) + ') mm';
        }
        if (detail) {
          html += '<div style="grid-column:1/4; padding-left:6px; font-size:0.58rem; color:var(--text-muted); margin-bottom:6px;">' + detail + '</div>';
        }
      }
    });

    // Yeni atama formu
    html += '<div style="margin-top:8px; padding:8px; background:var(--bg-tertiary); border:1px solid var(--border-color);">';
    html += '<div style="font-size:0.62rem; color:var(--text-heading); font-weight:600; margin-bottom:6px;">+ Yeni Atama</div>';
    html += '<select id="ve-fea-bc-face-' + node.id + '" style="width:100%; padding:5px 6px; font-size:0.62rem; background:var(--bg-primary); color:var(--text-primary); border:1px solid var(--border-color); margin-bottom:6px;">';
    faces.forEach(function (f) {
      html += '<option value="' + f.id + '">' + f.label + '</option>';
    });
    html += '</select>';
    html += '<select id="ve-fea-bc-kind-' + node.id + '" onchange="veFEABCToggleKindForm(\'' + node.id + '\')" style="width:100%; padding:5px 6px; font-size:0.62rem; background:var(--bg-primary); color:var(--text-primary); border:1px solid var(--border-color); margin-bottom:6px;">';
    html += '<option value="fixed">Fixed Support (tüm DoF sabit)</option>';
    html += '<option value="force">Kuvvet (Force)</option>';
    html += '<option value="pressure">Basınç (Pressure)</option>';
    html += '<option value="displacement">Yer Değiştirme</option>';
    html += '</select>';
    // Force input alanı (default gizli, kullanıcı seçince açılır)
    html += '<div id="ve-fea-bc-form-force-' + node.id + '" style="display:none; gap:4px; margin-bottom:6px;">';
    html += '<div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:4px;">';
    html += '<input type="number" id="ve-fea-bc-fx-' + node.id + '" placeholder="Fx (N)" style="width:100%; padding:4px 6px; font-size:0.62rem; background:var(--bg-primary); color:var(--text-primary); border:1px solid var(--border-color);">';
    html += '<input type="number" id="ve-fea-bc-fy-' + node.id + '" placeholder="Fy (N)" style="width:100%; padding:4px 6px; font-size:0.62rem; background:var(--bg-primary); color:var(--text-primary); border:1px solid var(--border-color);">';
    html += '<input type="number" id="ve-fea-bc-fz-' + node.id + '" placeholder="Fz (N)" style="width:100%; padding:4px 6px; font-size:0.62rem; background:var(--bg-primary); color:var(--text-primary); border:1px solid var(--border-color);">';
    html += '</div></div>';
    // Pressure input
    html += '<div id="ve-fea-bc-form-pressure-' + node.id + '" style="display:none; margin-bottom:6px;">';
    html += '<input type="number" step="0.1" id="ve-fea-bc-pmag-' + node.id + '" placeholder="p (MPa)" style="width:100%; padding:4px 6px; font-size:0.62rem; background:var(--bg-primary); color:var(--text-primary); border:1px solid var(--border-color);">';
    html += '</div>';
    // Displacement input
    html += '<div id="ve-fea-bc-form-displacement-' + node.id + '" style="display:none; gap:4px; margin-bottom:6px;">';
    html += '<div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:4px;">';
    html += '<input type="number" step="0.01" id="ve-fea-bc-ux-' + node.id + '" placeholder="Δx (mm)" style="width:100%; padding:4px 6px; font-size:0.62rem; background:var(--bg-primary); color:var(--text-primary); border:1px solid var(--border-color);">';
    html += '<input type="number" step="0.01" id="ve-fea-bc-uy-' + node.id + '" placeholder="Δy (mm)" style="width:100%; padding:4px 6px; font-size:0.62rem; background:var(--bg-primary); color:var(--text-primary); border:1px solid var(--border-color);">';
    html += '<input type="number" step="0.01" id="ve-fea-bc-uz-' + node.id + '" placeholder="Δz (mm)" style="width:100%; padding:4px 6px; font-size:0.62rem; background:var(--bg-primary); color:var(--text-primary); border:1px solid var(--border-color);">';
    html += '</div></div>';
    html += '<button onclick="veFEABCAddAssignment(\'' + node.id + '\')" style="width:100%; padding:6px 8px; font-size:0.66rem; background:var(--accent-primary,#3b82f6); color:white; border:none; cursor:pointer;">+ Ekle</button>';
    html += '</div>';
  }

  // ─── Özet ───
  if (d.bc.assignments && d.bc.assignments.length) {
    var counts = { fixed: 0, force: 0, pressure: 0, displacement: 0 };
    d.bc.assignments.forEach(function (a) { counts[a.kind] = (counts[a.kind] || 0) + 1; });
    html += '<div style="margin-top:10px; padding:6px 8px; background:var(--bg-tertiary); border-left:3px solid var(--accent-success,#22c55e); font-size:0.6rem; color:var(--text-muted);">';
    html += counts.fixed + ' fixed, ' + counts.force + ' force, ' + counts.pressure + ' pressure, ' + counts.displacement + ' displacement';
    html += '</div>';
  }

  html += '</div>';
  return html;
}

// ─── BC modifikasyon API'leri ─────────────────────────────────────────────
function _veFEAFindUpstreamMeshNode(bcNode) {
  if (typeof connections === 'undefined' || typeof nodes === 'undefined') return null;
  var src = connections.filter(function (c) { return c.to === bcNode.id; })[0];
  if (!src) return null;
  return nodes.filter(function (n) { return n.id === src.from; })[0] || null;
}
function _veFEAFindUpstreamGeometryNode(meshNode) {
  if (typeof connections === 'undefined' || typeof nodes === 'undefined') return null;
  var src = connections.filter(function (c) { return c.to === meshNode.id; })[0];
  if (!src) return null;
  return nodes.filter(function (n) { return n.id === src.from; })[0] || null;
}

function veFEABCSetMaterial(nodeId, matId) {
  var node = nodes.filter(function (n) { return n.id === nodeId; })[0];
  if (!node) return;
  if (!node.data) node.data = {};
  if (!node.data.bc) node.data.bc = { materialId: 'steel-st37', assignments: [] };
  node.data.bc.materialId = matId;
  if (typeof saveState === 'function') saveState();
  if (typeof showNodeProperties === 'function') showNodeProperties(node);
}

// BC marker'larini upstream mesh viewer'ina uygula
function _veFEAPushBCMarkersToMeshViewer(bcNode) {
  if (!bcNode || !bcNode.data || !bcNode.data.bc) return;
  if (typeof veFEAViewerRegistry === 'undefined') return;
  var meshNode = _veFEAFindUpstreamMeshNode(bcNode);
  if (!meshNode) return;
  var viewer = veFEAViewerRegistry[meshNode.id];
  if (!viewer || typeof viewer.addBCMarkers !== 'function') return;
  var meshData = (typeof veFEAMeshCache !== 'undefined') ? veFEAMeshCache[meshNode.id] : null;
  if (!meshData) return;
  var geomNode = _veFEAFindUpstreamGeometryNode(meshNode);
  var topology = (geomNode && geomNode.data && geomNode.data.geometry && typeof veFEAComputeGeometryTopology === 'function')
    ? veFEAComputeGeometryTopology(geomNode.data.geometry) : null;
  viewer.addBCMarkers(meshData, bcNode.data.bc.assignments, topology);
}

function veFEABCAddAssignment(nodeId) {
  var node = nodes.filter(function (n) { return n.id === nodeId; })[0];
  if (!node) return;
  if (!node.data) node.data = {};
  if (!node.data.bc) node.data.bc = { materialId: 'steel-st37', assignments: [] };
  var faceSel = document.getElementById('ve-fea-bc-face-' + nodeId);
  var kindSel = document.getElementById('ve-fea-bc-kind-' + nodeId);
  if (!faceSel || !kindSel) return;
  var faceId = faceSel.value;
  var kind = kindSel.value;
  var value = null;
  if (kind === 'force') {
    value = {
      fx: Number(document.getElementById('ve-fea-bc-fx-' + nodeId).value) || 0,
      fy: Number(document.getElementById('ve-fea-bc-fy-' + nodeId).value) || 0,
      fz: Number(document.getElementById('ve-fea-bc-fz-' + nodeId).value) || 0
    };
  } else if (kind === 'pressure') {
    value = { magnitude: Number(document.getElementById('ve-fea-bc-pmag-' + nodeId).value) || 0 };
  } else if (kind === 'displacement') {
    value = {
      ux: Number(document.getElementById('ve-fea-bc-ux-' + nodeId).value) || 0,
      uy: Number(document.getElementById('ve-fea-bc-uy-' + nodeId).value) || 0,
      uz: Number(document.getElementById('ve-fea-bc-uz-' + nodeId).value) || 0
    };
  }
  node.data.bc.assignments.push({ faceId: faceId, kind: kind, value: value, enabled: true });
  if (typeof saveState === 'function') saveState();
  _veFEAPushBCMarkersToMeshViewer(node);
  if (typeof showNodeProperties === 'function') showNodeProperties(node);
}

function veFEABCRemoveAssignment(nodeId, idx) {
  var node = nodes.filter(function (n) { return n.id === nodeId; })[0];
  if (!node || !node.data || !node.data.bc) return;
  node.data.bc.assignments.splice(idx, 1);
  if (typeof saveState === 'function') saveState();
  _veFEAPushBCMarkersToMeshViewer(node);
  if (typeof showNodeProperties === 'function') showNodeProperties(node);
}

function veFEABCToggleKindForm(nodeId) {
  var kind = document.getElementById('ve-fea-bc-kind-' + nodeId);
  if (!kind) return;
  ['force', 'pressure', 'displacement'].forEach(function (k) {
    var el = document.getElementById('ve-fea-bc-form-' + k + '-' + nodeId);
    if (el) el.style.display = (kind.value === k) ? 'block' : 'none';
  });
}

// ─── 4. FEA ÇÖZÜCÜ ──────────────────────────────────────────────────────────
function getFEASolverPropertiesHTML(node) {
  var d = node.data || {};
  if (!d.solver) d.solver = { tolerance: 1e-8, maxIter: 0 }; // 0 → auto

  // Yukarı akış: BC → Mesh → Geometry
  var bcNode = _veFEAFindUpstreamBCNode(node);
  var meshNode = bcNode ? _veFEAFindUpstreamMeshNode(bcNode) : null;
  var pipelineReady = !!(bcNode && meshNode && meshNode.data && meshNode.data.meshData);

  var html = '<div style="border-top:1px solid var(--border-color); padding-top:12px;">';
  html += '<div style="display:flex; align-items:center; gap:8px; margin-bottom:10px;">';
  html += '<div style="font-size:0.78rem; font-weight:700; color:var(--text-heading);">FEA Çözücü</div>';
  html += '</div>';

  html += '<div style="font-size:0.62rem; color:var(--text-muted); line-height:1.5; margin-bottom:10px;">' +
    'Lineer statik yapısal analiz: <code>[K]{u}={F}</code>. ' +
    'PCG (Jacobi precond.) ile sparse Hex8 çözümü.</div>';

  // Pipeline durumu
  html += veFEASectionTitle('Bağlantı Durumu');
  html += '<div style="display:grid; grid-template-columns:auto 1fr; gap:6px 10px; font-size:0.62rem; margin-bottom:10px;">';
  html += _veFEAPipelineRow('Geometri', bcNode && meshNode && _veFEAFindUpstreamGeometryNode(meshNode) ? 'ok' : 'missing');
  html += _veFEAPipelineRow('Mesh', meshNode && meshNode.data && meshNode.data.meshData ? 'ok' : 'missing');
  html += _veFEAPipelineRow('Sınır Koşulları', bcNode && bcNode.data && bcNode.data.bc && bcNode.data.bc.assignments && bcNode.data.bc.assignments.length ? 'ok' : 'missing');
  html += '</div>';

  // Tolerance
  html += veFEASectionTitle('Çözücü Ayarları');
  html += '<div style="display:grid; grid-template-columns:1fr 80px; gap:6px; margin-bottom:6px; font-size:0.62rem; align-items:center;">';
  html += '<div>Yakınsama toleransı</div>';
  html += '<input type="number" step="0.0000001" value="' + (d.solver.tolerance || 1e-8) +
          '" onchange="veFEASolverSetTol(\'' + node.id + '\', this.value)" style="width:100%; padding:4px 6px; font-size:0.62rem; background:var(--bg-primary); color:var(--text-primary); border:1px solid var(--border-color);">';
  html += '</div>';

  // Çöz button
  var canSolve = pipelineReady && bcNode.data && bcNode.data.bc && bcNode.data.bc.assignments && bcNode.data.bc.assignments.length > 0;
  if (canSolve) {
    html += '<button onclick="veFEASolverRun(\'' + node.id + '\')" style="width:100%; padding:8px 10px; font-size:0.72rem; font-weight:600; background:var(--accent-success,#22c55e); color:white; border:none; cursor:pointer; margin-bottom:10px;">▶ ÇÖZ</button>';
  } else {
    html += '<button disabled style="width:100%; padding:8px 10px; font-size:0.72rem; background:var(--bg-tertiary); color:var(--text-muted); border:1px dashed var(--border-color); cursor:not-allowed; margin-bottom:10px;">▶ Çöz (yukari akış eksik)</button>';
  }

  // Sonuçlar
  html += veFEASectionTitle('Sonuçlar');
  var r = d.solver.results || null;
  if (!r) {
    html += '<div style="padding:8px; background:var(--bg-tertiary); border:1px dashed var(--border-color); font-size:0.62rem; color:var(--text-muted); text-align:center;">Henüz çözüm yapılmadı.</div>';
  } else {
    html += '<div style="font-size:0.62rem;">';
    html += veFEAReadOnlyRow('Maks. von Mises',     _veFEAFmtMPa(r.maxVonMises));
    html += veFEAReadOnlyRow('Maks. deplasman',     _veFEAFmtMm(r.maxDisplacement));
    html += veFEAReadOnlyRow('Maks. asal gerilme',  _veFEAFmtMPa(r.maxPrincipalStress));
    html += veFEAReadOnlyRow('Min. asal gerilme',   _veFEAFmtMPa(r.minPrincipalStress));
    html += veFEAReadOnlyRow('Güvenlik faktörü',    (isFinite(r.safetyFactor) ? r.safetyFactor.toFixed(2) : '∞'));
    html += veFEAReadOnlyRow('Toplam kütle',        _veFEAFmtKg(r.totalMass));
    if (r.iterations) {
      html += veFEAReadOnlyRow('PCG iterasyon', r.iterations + ' / res=' + r.residual.toExponential(2));
    }
    if (r.solveTime) {
      html += veFEAReadOnlyRow('Çözüm süresi', r.solveTime.toFixed(2) + ' ms');
    }
    html += '</div>';
    // Sonuç görselleştirme moduna geçiş
    html += '<div style="margin-top:10px; display:grid; grid-template-columns:1fr 1fr; gap:6px;">';
    html += '<button onclick="veFEASolverShowResult(\'' + node.id + '\', \'vonMises\')" style="padding:6px 8px; font-size:0.62rem; background:var(--accent-primary,#3b82f6); color:white; border:none; cursor:pointer;">von Mises Haritası</button>';
    html += '<button onclick="veFEASolverShowResult(\'' + node.id + '\', \'displacement\')" style="padding:6px 8px; font-size:0.62rem; background:var(--accent-primary,#3b82f6); color:white; border:none; cursor:pointer;">Deplasman Haritası</button>';
    html += '<button onclick="veFEASolverShowResult(\'' + node.id + '\', \'deformed\')" style="padding:6px 8px; font-size:0.62rem; background:var(--accent-primary,#3b82f6); color:white; border:none; cursor:pointer;">Deforme Şekil</button>';
    html += '<button onclick="veFEASolverShowResult(\'' + node.id + '\', \'principalMax\')" style="padding:6px 8px; font-size:0.62rem; background:var(--accent-primary,#3b82f6); color:white; border:none; cursor:pointer;">Maks. Asal Gerilme</button>';
    html += '</div>';
  }

  html += '</div>';
  return html;
}

function _veFEAPipelineRow(label, status) {
  var ok = status === 'ok';
  var dotColor = ok ? 'var(--accent-success,#22c55e)' : 'var(--accent-danger,#ef4444)';
  var icon = ok ? '✓' : '✗';
  return '<div style="color:' + dotColor + '; font-weight:700;">' + icon + '</div>' +
         '<div style="color:var(--text-primary);">' + label + (ok ? '' : ' — eksik') + '</div>';
}

function _veFEAFmtMPa(v) {
  if (!isFinite(v)) return '—';
  if (Math.abs(v) >= 1000) return (v / 1000).toFixed(2) + ' GPa';
  if (Math.abs(v) >= 1)    return v.toFixed(2) + ' MPa';
  return (v * 1000).toFixed(2) + ' kPa';
}
function _veFEAFmtMm(v) {
  if (!isFinite(v)) return '—';
  if (Math.abs(v) >= 1)    return v.toFixed(4) + ' mm';
  if (Math.abs(v) >= 1e-3) return (v * 1000).toFixed(2) + ' µm';
  return v.toExponential(2) + ' mm';
}
function _veFEAFmtKg(v) {
  if (!isFinite(v)) return '—';
  if (v >= 1)    return v.toFixed(3) + ' kg';
  if (v >= 1e-3) return (v * 1000).toFixed(2) + ' g';
  return (v * 1e6).toFixed(2) + ' mg';
}

function _veFEAFindUpstreamBCNode(solverNode) {
  if (typeof connections === 'undefined' || typeof nodes === 'undefined') return null;
  var src = connections.filter(function (c) { return c.to === solverNode.id; })[0];
  if (!src) return null;
  return nodes.filter(function (n) { return n.id === src.from; })[0] || null;
}

function veFEASolverSetTol(nodeId, val) {
  var node = nodes.filter(function (n) { return n.id === nodeId; })[0];
  if (!node) return;
  if (!node.data) node.data = {};
  if (!node.data.solver) node.data.solver = { tolerance: 1e-8 };
  node.data.solver.tolerance = Number(val) || 1e-8;
}

function veFEASolverRun(nodeId) {
  var node = nodes.filter(function (n) { return n.id === nodeId; })[0];
  if (!node) return;
  var bcNode = _veFEAFindUpstreamBCNode(node);
  var meshNode = bcNode ? _veFEAFindUpstreamMeshNode(bcNode) : null;
  var geomNode = meshNode ? _veFEAFindUpstreamGeometryNode(meshNode) : null;
  if (!bcNode || !meshNode || !meshNode.data || !meshNode.data.meshData) {
    if (typeof showToast === 'function') showToast('FEA: yukarı akışta mesh veya BC bulunamadı', 'error');
    return;
  }
  var mesh = meshNode.data.meshData;
  if (mesh.type !== 'hex8') {
    if (typeof showToast === 'function') showToast('FEA: şu an sadece Hex8 mesh çözülebilir', 'error');
    return;
  }
  var bcData = bcNode.data.bc;
  if (!bcData || !bcData.assignments || !bcData.assignments.length) {
    if (typeof showToast === 'function') showToast('FEA: en az bir sınır koşulu gerekli', 'error');
    return;
  }
  var material = veFEAMaterialById(bcData.materialId);
  if (!material) {
    if (typeof showToast === 'function') showToast('FEA: geçersiz malzeme', 'error');
    return;
  }

  // Topology (face → nodeIds mapping)
  var topology = (geomNode && geomNode.data && geomNode.data.geometry) ?
    veFEAComputeGeometryTopology(geomNode.data.geometry) : null;

  var t0 = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();

  // K assemble
  var K = veFEAAssembleGlobalK(mesh, material);
  if (!K) {
    if (typeof showToast === 'function') showToast('FEA: K matrisi hesaplanamadı', 'error');
    return;
  }
  var F = new Float64Array(K.nDoF);

  // BC enforcement: her atamayı yüzeyin node listesine uygula
  bcData.assignments.forEach(function (a) {
    if (!a.enabled) return;
    var faceNodes = _veFEAGetFaceNodeIds(mesh, a.faceId);
    if (!faceNodes || !faceNodes.length) return;
    if (a.kind === 'fixed') {
      faceNodes.forEach(function (nIdx) {
        veFEAApplyFixedSupport(K, F, nIdx * 3);
        veFEAApplyFixedSupport(K, F, nIdx * 3 + 1);
        veFEAApplyFixedSupport(K, F, nIdx * 3 + 2);
      });
    } else if (a.kind === 'force' && a.value) {
      var fxPer = (a.value.fx || 0) / faceNodes.length;
      var fyPer = (a.value.fy || 0) / faceNodes.length;
      var fzPer = (a.value.fz || 0) / faceNodes.length;
      faceNodes.forEach(function (nIdx) {
        F[nIdx * 3]     += fxPer;
        F[nIdx * 3 + 1] += fyPer;
        F[nIdx * 3 + 2] += fzPer;
      });
    } else if (a.kind === 'pressure' && a.value) {
      // Pressure: p·A·n (uniform yüzeye dağılım)
      var face = (topology && topology.faces) ? topology.faces.filter(function (f) { return f.id === a.faceId; })[0] : null;
      if (face && face.area && face.normal) {
        var area = face.area;
        var nrm = face.normal;
        var totalF = a.value.magnitude * area; // p × A
        var fxP = totalF * nrm[0] / faceNodes.length;
        var fyP = totalF * nrm[1] / faceNodes.length;
        var fzP = totalF * nrm[2] / faceNodes.length;
        faceNodes.forEach(function (nIdx) {
          F[nIdx * 3]     += fxP;
          F[nIdx * 3 + 1] += fyP;
          F[nIdx * 3 + 2] += fzP;
        });
      }
    } else if (a.kind === 'displacement' && a.value) {
      faceNodes.forEach(function (nIdx) {
        veFEAApplyPrescribedDisplacement(K, F, nIdx * 3,     a.value.ux || 0);
        veFEAApplyPrescribedDisplacement(K, F, nIdx * 3 + 1, a.value.uy || 0);
        veFEAApplyPrescribedDisplacement(K, F, nIdx * 3 + 2, a.value.uz || 0);
      });
    }
  });

  // PCG solver
  var tol = (node.data.solver && node.data.solver.tolerance) || 1e-8;
  var sol = veFEAPCGSolve(K, F, { tol: tol });

  // Stress recovery
  var results = veFEAHex8ComputeNodalStresses(mesh, sol.u, material);
  var summary = veFEABuildResultSummary(mesh, sol.u, material, results);

  var t1 = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
  summary.iterations = sol.iterations;
  summary.residual = sol.residual;
  summary.converged = sol.converged;
  summary.solveTime = t1 - t0;

  if (!node.data) node.data = {};
  if (!node.data.solver) node.data.solver = {};
  node.data.solver.results = summary;
  // Tüm vektörleri saklama isteğe bağlı (büyük olabilir), şimdilik tutuyoruz
  node.data.solver.displacement = sol.u;
  node.data.solver.vonMises = results.vonMises;
  node.data.solver.principal = results.principal;

  if (typeof saveState === 'function') saveState();
  if (typeof showNodeProperties === 'function') showNodeProperties(node);
  if (typeof showToast === 'function') {
    showToast('FEA çözüm tamamlandı: ' + summary.iterations + ' iter, ' + summary.solveTime.toFixed(0) + ' ms', 'success');
  }
}

// Face ID → nodeIds: meshte hazır namedSelections varsa kullan,
// yoksa topology + node konumlarından çıkar.
function _veFEAGetFaceNodeIds(mesh, faceId) {
  if (mesh && mesh.namedSelections && mesh.namedSelections[faceId]) {
    return mesh.namedSelections[faceId].nodeIds;
  }
  return null;
}

function veFEASolverShowResult(nodeId, kind) {
  var node = nodes.filter(function (n) { return n.id === nodeId; })[0];
  if (!node) return;
  // Yukarı akış: solver → BC → mesh
  var bcNode = _veFEAFindUpstreamBCNode(node);
  var meshNode = bcNode ? _veFEAFindUpstreamMeshNode(bcNode) : null;
  if (!meshNode) {
    if (typeof showToast === 'function') showToast('Mesh node bulunamadı', 'error');
    return;
  }
  // viewer üzerinde heat map mode'u aktive et
  var mode = (kind === 'vonMises') ? 'result-vonMises'
           : (kind === 'displacement') ? 'result-displacement'
           : (kind === 'principalMax') ? 'result-principalMax'
           : (kind === 'principalMin') ? 'result-principalMin'
           : (kind === 'deformed') ? 'result-deformed'
           : null;
  if (!mode) return;
  node.data.solver.activeResultView = kind;
  if (typeof veFEAApplyHeatMap === 'function') {
    veFEAApplyHeatMap(meshNode.id, mode);
  }
  if (typeof showToast === 'function') {
    showToast('Sonuç görüntüleniyor: ' + kind, 'success');
  }
}
