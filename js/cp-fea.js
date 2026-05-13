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
  var html = '<div style="border-top:1px solid var(--border-color); padding-top:12px;">';

  html += '<div style="display:flex; align-items:center; gap:8px; margin-bottom:10px;">';
  html += '<div style="font-size:0.78rem; font-weight:700; color:var(--text-heading);">Geometri</div>';
  html += veFEAPhaseBadge('Faz 2');
  html += '</div>';

  html += '<div style="font-size:0.62rem; color:var(--text-muted); line-height:1.5; margin-bottom:10px;">' +
    'CAD geometrisi (STEP, IGES, STL) yükleyin veya parametrik primitif tanımlayın. ' +
    'Sonraki adım: <b>Mesh</b>.</div>';

  html += veFEASectionTitle('Geometri Kaynağı');
  html += '<div style="display:flex; flex-direction:column; gap:6px; margin-bottom:10px;">';
  html += '<button class="ve-fea-btn-disabled" disabled style="padding:7px 10px; font-size:0.66rem; background:var(--bg-tertiary); color:var(--text-muted); border:1px dashed var(--border-color); cursor:not-allowed; text-align:left;">📥 Dosya İçe Aktar (STEP / IGES / STL) — F2</button>';
  html += '<button class="ve-fea-btn-disabled" disabled style="padding:7px 10px; font-size:0.66rem; background:var(--bg-tertiary); color:var(--text-muted); border:1px dashed var(--border-color); cursor:not-allowed; text-align:left;">📐 Parametrik Primitif (kutu / silindir / şaft) — F2</button>';
  html += '</div>';

  html += veFEASectionTitle('Durum');
  html += veFEAReadOnlyRow('Yüklenen geometri', d.geometryName || '— (henüz yok)');
  html += veFEAReadOnlyRow('Hacim', '—');
  html += veFEAReadOnlyRow('Yüzey alanı', '—');
  html += veFEAReadOnlyRow('Sınırlayıcı kutu', '—');

  html += '</div>';
  return html;
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
