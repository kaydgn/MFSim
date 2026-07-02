// ============================================================================
// TAKOZ ÇÖKME-TİTREŞİM MODÜLÜ — Özellik Paneli (pencere)
// ============================================================================
// Motor-şanzıman bağlantı yapıları (takozlar) için çökme (statik oturma) ve
// titreşim (doğal frekans / iletim oranı) analizi bileşeni.
//
// NOT: Bu dosya ŞİMDİLİK yalnızca pencere iskeletini içerir. Matematiksel
// model (çökme ve titreşim hesapları) daha sonra bu dosyada
// veMountAnalysisCompute() içine eklenecektir. Girdiler node.data'ya kaydedilir.
//
// Bileşen kaydı: js/components.js componentDefs['mount-analysis'] + VE_MODULES
//   components dizisi; sidebar kutusu index.html "Analiz" kategorisi.
// Dispatch: js/cp-core.js showNodeProperties → getMountAnalysisPropertiesHTML.
// ----------------------------------------------------------------------------

// Küçük yardımcı: etiketli sayısal girdi satırı üretir (obstacle-crossing stili).
// base: input id ön eki (nid otomatik eklenir), nid: node.id (onchange için).
function veMountInputRow(label, sub, unit, base, nid, val, ph, step, min) {
  var id = base + '-' + nid;
  var subHtml = sub ? ' <span style="color:var(--text-muted); font-weight:400;">' + sub + (unit ? ' [' + unit + ']' : '') + '</span>'
                    : (unit ? ' <span style="color:var(--text-muted); font-weight:400;">[' + unit + ']</span>' : '');
  var h = '<tr style="border-bottom:1px solid var(--border-color);">';
  h += '<th style="padding:6px 8px; text-align:left; background:var(--bg-tertiary); border-right:1px solid var(--border-color); width:55%; font-weight:500; color:var(--text-secondary);">' + label + subHtml + '</th>';
  h += '<td style="padding:4px 6px; background:var(--bg-tertiary);"><input type="number" id="' + id + '" value="' + (val === undefined || val === null ? '' : val) + '"'
     + (step !== undefined ? ' step="' + step + '"' : '')
     + (min !== undefined ? ' min="' + min + '"' : '')
     + ' placeholder="' + (ph || '') + '" style="width:100%; padding:4px; font-size:0.68rem; background:var(--bg-input); color:var(--text-primary); border:1px solid var(--border-color); border-radius:0; text-align:right;" onchange="onVEMountAnalysisChange(\'' + nid + '\')"></td>';
  h += '</tr>';
  return h;
}

// Sonuç satırı (salt-okunur, şimdilik '—').
function veMountResultRow(label, sub, unit, id) {
  var subHtml = sub ? ' <span style="color:var(--text-muted); font-weight:400;">' + sub + (unit ? ' [' + unit + ']' : '') + '</span>'
                    : (unit ? ' <span style="color:var(--text-muted); font-weight:400;">[' + unit + ']</span>' : '');
  var h = '<tr style="border-bottom:1px solid var(--border-color);">';
  h += '<th style="padding:6px 8px; text-align:left; background:var(--bg-tertiary); border-right:1px solid var(--border-color); width:55%; font-weight:500; color:var(--text-secondary);">' + label + subHtml + '</th>';
  h += '<td style="padding:6px 8px; background:var(--bg-secondary); color:var(--text-primary); font-weight:500; text-align:right;"><span id="' + id + '">—</span></td>';
  h += '</tr>';
  return h;
}

function getMountAnalysisPropertiesHTML(node) {
  var d = node.data || {};
  var nid = node.id;

  var html = '<div class="sw-panel">';

  // ═══════ BİLGİ NOTU ═══════
  html += '<div style="padding:8px 10px; margin-bottom:10px; font-size:0.62rem; line-height:1.4; color:var(--text-secondary); background:var(--bg-secondary); border:1px solid var(--border-color); border-left:3px solid var(--accent-primary);">'
        + '<b style="color:var(--text-heading);">Takoz Çökme-Titreşim Analizi.</b> '
        + 'Motor-şanzıman grubunun bağlantı takozları üzerindeki statik çökme (oturma) ve '
        + 'titreşim davranışını (doğal frekans, iletim oranı) inceler. '
        + '<span style="color:var(--text-muted);">Matematiksel model daha sonra eklenecektir; şu an yalnızca girdi penceresidir.</span>'
        + '</div>';

  // ═══════ MOTOR-ŞANZIMAN GRUBU ═══════
  html += '<div class="sw-section-title">Motor-Şanzıman Grubu</div>';
  html += '<table style="width:100%; font-size:0.68rem; border-collapse:collapse; border:1px solid var(--border-color); margin-bottom:10px;">';
  html += veMountInputRow('Grup Kütlesi', 'm', 'kg', 've-mount-group-mass', nid, d.groupMass, 'ör: 650', '1', '0');
  html += veMountInputRow('Ağırlık Merkezi Yüksekliği', 'h<sub>cg</sub>', 'mm', 've-mount-cg-height', nid, d.cgHeight, 'ör: 320', '1', '0');
  html += '</table>';

  // ═══════ TAKOZ DÜZENİ ═══════
  html += '<div class="sw-section-title" style="margin-top:10px;">Takoz Düzeni & Rijitlik</div>';
  html += '<table style="width:100%; font-size:0.68rem; border-collapse:collapse; border:1px solid var(--border-color); margin-bottom:10px;">';
  html += veMountInputRow('Takoz Sayısı', 'n', '', 've-mount-count', nid, d.mountCount, 'ör: 4', '1', '1');
  html += veMountInputRow('Statik Rijitlik', 'k<sub>stat</sub>', 'N/mm', 've-mount-k-static', nid, d.kStatic, 'ör: 250', '1', '0');
  html += veMountInputRow('Dinamik/Statik Rijitlik Oranı', 'k<sub>dyn</sub>/k<sub>stat</sub>', '', 've-mount-k-dyn-ratio', nid, d.kDynRatio, 'ör: 1.4', '0.01', '1');
  html += veMountInputRow('Sönüm Oranı', 'ζ', '', 've-mount-damping', nid, d.dampingRatio, 'ör: 0.05', '0.01', '0');
  html += '</table>';

  // ═══════ UYARIM / İŞLETME KOŞULLARI ═══════
  html += '<div class="sw-section-title" style="margin-top:10px;">Uyarım (İşletme Koşulları)</div>';
  html += '<table style="width:100%; font-size:0.68rem; border-collapse:collapse; border:1px solid var(--border-color); margin-bottom:10px;">';
  html += veMountInputRow('Rölanti Devri', '', 'rpm', 've-mount-idle-rpm', nid, d.idleRpm, 'ör: 600', '10', '0');
  html += veMountInputRow('Maksimum Devir', '', 'rpm', 've-mount-max-rpm', nid, d.maxRpm, 'ör: 2400', '10', '0');
  html += veMountInputRow('Silindir Sayısı', 'z', '', 've-mount-cylinders', nid, d.cylinders, 'ör: 6', '1', '1');
  // Çevrim tipi (dropdown) — ateşleme mertebesi için
  var stroke = d.strokeType !== undefined ? d.strokeType : '4';
  html += '<tr style="border-bottom:1px solid var(--border-color);">';
  html += '<th style="padding:6px 8px; text-align:left; background:var(--bg-tertiary); border-right:1px solid var(--border-color); width:55%; font-weight:500; color:var(--text-secondary);">Çevrim Tipi</th>';
  html += '<td style="padding:4px 6px; background:var(--bg-tertiary);"><select id="ve-mount-stroke-' + nid + '" onchange="onVEMountAnalysisChange(\'' + nid + '\')" style="width:100%; padding:4px; font-size:0.68rem; background:var(--bg-input); color:var(--text-primary); border:1px solid var(--border-color); border-radius:0;">';
  html += '<option value="4"' + (stroke === '4' ? ' selected' : '') + '>4 Zamanlı</option>';
  html += '<option value="2"' + (stroke === '2' ? ' selected' : '') + '>2 Zamanlı</option>';
  html += '</select></td>';
  html += '</tr>';
  html += '</table>';

  // ═══════ SONUÇLAR (PLACEHOLDER) ═══════
  html += '<div class="sw-section-title" style="margin-top:10px;">Sonuçlar</div>';
  html += '<table style="width:100%; font-size:0.68rem; border-collapse:collapse; border:1px solid var(--border-color); margin-bottom:8px;">';
  html += veMountResultRow('Statik Çökme', 'δ<sub>stat</sub>', 'mm', 've-mount-res-settling-' + nid);
  html += veMountResultRow('Sistem Doğal Frekansı', 'f<sub>n</sub>', 'Hz', 've-mount-res-fn-' + nid);
  html += veMountResultRow('Uyarım Frekansı (rölanti)', 'f<sub>exc</sub>', 'Hz', 've-mount-res-fexc-' + nid);
  html += veMountResultRow('İletim Oranı', 'TR', '', 've-mount-res-tr-' + nid);
  html += '</table>';
  html += '<button onclick="veMountAnalysisCompute(\'' + nid + '\')" style="width:100%; padding:8px; font-size:0.72rem; font-weight:600; background:var(--accent-primary); color:#fff; border:none; border-radius:0; cursor:pointer;"><span class="mf-ico mf-ico-play"></span> Hesapla</button>';
  html += '<div style="margin-top:6px; font-size:0.55rem; color:var(--text-muted); text-align:center; line-height:1.3;">Matematiksel model henüz eklenmedi — girdiler kaydedilir, hesaplama altyapısı sonraki adımda tanımlanacaktır.</div>';

  html += '</div>'; // .sw-panel
  return html;
}

// Panel girdilerini node.data'ya kaydeder.
function onVEMountAnalysisChange(nodeId) {
  var node = nodes.find(function(n) { return n.id === nodeId; });
  if(!node) return;
  if(!node.data) node.data = {};

  var elFn = function(id) { return document.getElementById(id); };
  // Boş → undefined, dolu → sayı. (Kısmi girişte NaN kaydını önler.)
  var setNum = function(base, key) {
    var el = elFn(base + '-' + nodeId);
    if(!el) return;
    var v = el.value.trim();
    node.data[key] = (v === '') ? undefined : parseFloat(v);
  };

  setNum('ve-mount-group-mass', 'groupMass');
  setNum('ve-mount-cg-height', 'cgHeight');
  setNum('ve-mount-count', 'mountCount');
  setNum('ve-mount-k-static', 'kStatic');
  setNum('ve-mount-k-dyn-ratio', 'kDynRatio');
  setNum('ve-mount-damping', 'dampingRatio');
  setNum('ve-mount-idle-rpm', 'idleRpm');
  setNum('ve-mount-max-rpm', 'maxRpm');
  setNum('ve-mount-cylinders', 'cylinders');

  var strokeEl = elFn('ve-mount-stroke-' + nodeId);
  if(strokeEl) node.data.strokeType = strokeEl.value;

  if(typeof saveState === 'function') saveState();
}

// Hesaplama STUB — matematiksel model buraya eklenecek.
// Şimdilik yalnızca kullanıcıyı bilgilendirir; sonuç alanlarını '—' bırakır.
function veMountAnalysisCompute(nodeId) {
  var msg = 'Takoz çökme-titreşim matematiksel modeli henüz eklenmedi. Girdiler kaydedildi.';
  if(typeof showToast === 'function') showToast(msg, 'info');
  else if(typeof showNotification === 'function') showNotification('ℹ️ ' + msg, 'info');
}
