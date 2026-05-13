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
  html += '<button onclick="veFEAOpenFullscreenViewer(\'' + node.id + '\')" style="width:100%; padding:7px 10px; font-size:0.66rem; background:var(--bg-tertiary); color:var(--text-primary); border:1px solid var(--border-color); cursor:pointer; margin-bottom:10px;" onmouseenter="this.style.borderColor=\'var(--accent-primary)\'" onmouseleave="this.style.borderColor=\'var(--border-color)\'">🔍 Tam Ekran Görüntüleyici</button>';

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

  // CAD import — F2c/F2d/OCCT için yer tutucu
  html += veFEASectionTitle('CAD Dosya İçe Aktar');
  html += '<div style="display:flex; flex-direction:column; gap:6px; margin-bottom:10px;">';
  html += '<button disabled style="padding:6px 10px; font-size:0.62rem; background:var(--bg-tertiary); color:var(--text-muted); border:1px dashed var(--border-color); cursor:not-allowed; text-align:left;">📥 STL (sonraki PR)</button>';
  html += '<button disabled style="padding:6px 10px; font-size:0.62rem; background:var(--bg-tertiary); color:var(--text-muted); border:1px dashed var(--border-color); cursor:not-allowed; text-align:left;">📥 STEP / IGES (OCCT.js — Faz 2d)</button>';
  html += '</div>';

  // ─── DURUM ────────────────────────────────────────────────────────────
  html += veFEASectionTitle('Durum');
  if(hasGeom) {
    html += veFEAReadOnlyRow('Yüklenen geometri', geom.sourceLabel || veFEAPrimitiveLabel(geom.type));
    html += veFEAReadOnlyRow('Hacim',        (typeof veFEAFormatVolume === 'function') ? veFEAFormatVolume(geom.volume) : geom.volume + ' mm³');
    html += veFEAReadOnlyRow('Yüzey alanı',  (typeof veFEAFormatArea === 'function') ? veFEAFormatArea(geom.surfaceArea) : geom.surfaceArea + ' mm²');
    html += veFEAReadOnlyRow('Sınırlayıcı kutu', (typeof veFEAFormatBBox === 'function') ? veFEAFormatBBox(geom.bbox) : '—');
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
  var html = '<div style="border-top:1px solid var(--border-color); padding-top:12px;">';

  html += '<div style="display:flex; align-items:center; gap:8px; margin-bottom:10px;">';
  html += '<div style="font-size:0.78rem; font-weight:700; color:var(--text-heading);">Mesh</div>';
  html += veFEAPhaseBadge('Faz 3');
  html += '</div>';

  html += '<div style="font-size:0.62rem; color:var(--text-muted); line-height:1.5; margin-bottom:10px;">' +
    'Geometriyi sonlu elemanlara böler. Eleman tipi ve boyu kalite/doğruluk dengesini belirler. ' +
    'Önceki: <b>Geometri</b>, sonraki: <b>Sınır Koşulları</b>.</div>';

  html += veFEASectionTitle('Eleman Tipi (F3)');
  html += '<select disabled style="width:100%; padding:6px 8px; font-size:0.66rem; background:var(--bg-tertiary); color:var(--text-muted); border:1px dashed var(--border-color); margin-bottom:8px;">';
  html += '<option>Tet10 (kuadratik tetra — önerilen)</option>';
  html += '<option>Tet4 (lineer tetra — hızlı)</option>';
  html += '<option>Hex8 + Tet10 hibrit</option>';
  html += '</select>';

  html += veFEASectionTitle('Mesh Boyu');
  html += '<div style="display:flex; gap:4px; margin-bottom:8px;">';
  html += '<button disabled style="flex:1; padding:6px; font-size:0.62rem; background:var(--bg-tertiary); color:var(--text-muted); border:1px dashed var(--border-color); cursor:not-allowed;">Coarse</button>';
  html += '<button disabled style="flex:1; padding:6px; font-size:0.62rem; background:var(--bg-tertiary); color:var(--text-muted); border:1px dashed var(--border-color); cursor:not-allowed;">Medium</button>';
  html += '<button disabled style="flex:1; padding:6px; font-size:0.62rem; background:var(--bg-tertiary); color:var(--text-muted); border:1px dashed var(--border-color); cursor:not-allowed;">Fine</button>';
  html += '</div>';

  html += veFEASectionTitle('Kalite Metrikleri');
  html += veFEAReadOnlyRow('Düğüm sayısı', '—');
  html += veFEAReadOnlyRow('Eleman sayısı', '—');
  html += veFEAReadOnlyRow('Min. Jacobian', '—');
  html += veFEAReadOnlyRow('Maks. aspect ratio', '—');

  html += '</div>';
  return html;
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
