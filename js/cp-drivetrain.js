// ===== TRANSFER KUTUSU ÖZELLİKLERİ =====
function getTransferPropertiesHTML(node) {
  var nodeData = node.data || {};
  var isFullThrottle = veActiveModule === 'full-throttle';
  
  var html = '<div class="sw-panel">';

  // Başlık
  html += '<div class="sw-status-bar installed">';
  html += '<span class="sw-status-dot"></span>';
  html += '<span>Transfer Kutusu Verileri</span>';
  html += '<button class="sw-info-btn" onclick="showInfoPopup(\'transferKutusu\')" title="Bilgi">?</button>';
  html += '</div>';

  if(isFullThrottle) {
    // ── TAM GAZ HIZLANMA: Transfer Case Parametreleri ──
    var ftTrName = nodeData.ftTrName || 'İki Kademeli';
    // Varsayılan değerleri node.data'ya yaz (ilk render'da)
    if(!nodeData.ftTrGears) {
      nodeData.ftTrGears = [
        { kademe: 'High', ratio: 1.054, eff: 97.00 },
        { kademe: 'Low', ratio: 2.337, eff: 97.00 }
      ];
    }
    var ftTrGears = nodeData.ftTrGears;
    
    html += '<div class="sw-pkg-card" style="margin-bottom:10px;">';
    html += '<div class="sw-pkg-header" style="cursor:default;"><span class="sw-pkg-name">Transfer Case Parametreleri</span></div>';
    html += '<div class="sw-pkg-body">';
    
    // Transfer Case Preset Seçici
    var ftTrPreset = nodeData.ftTrPreset || '';
    html += '<div style="display:flex; gap:6px; margin-bottom:8px; align-items:center;">';
    html += '<select id="ve-fttr-preset-' + node.id + '" onchange="onVEFTTransferPresetSelect(\'' + node.id + '\', this.value)" style="flex:1; font-size:0.68rem; padding:4px 6px; background:var(--bg-input); color:var(--text-primary); border:1px solid var(--border-color); border-radius:0;">';
    html += '<option value="">-- Transfer Case Preset (' + Object.keys(VE_TRANSFER_PRESETS).length + ') --</option>';
    var _trBrands = {};
    Object.keys(VE_TRANSFER_PRESETS).forEach(function(tk) { var b = VE_TRANSFER_PRESETS[tk].marka; if(!_trBrands[b]) _trBrands[b] = []; _trBrands[b].push(tk); });
    Object.keys(_trBrands).sort().forEach(function(brand) {
      html += '<optgroup label="' + brand + ' (' + _trBrands[brand].length + ')">';
      _trBrands[brand].forEach(function(tk) {
        var tp = VE_TRANSFER_PRESETS[tk];
        var kCount = tp.rows.length;
        var tSel = (tk === ftTrPreset) ? ' selected' : '';
        html += '<option value="' + tk + '"' + tSel + '>' + tp.model + ' (' + kCount + ' kademe)</option>';
      });
      html += '</optgroup>';
    });
    html += '</select>';
    html += '</div>';
    
    html += '<table style="width:100%; font-size:0.68rem; border-collapse:collapse; border:1px solid var(--border-color);">';
    
    // Kademe Sayısı (readonly)
    var roStyle = 'width:100%; padding:4px; font-size:0.68rem; background:var(--bg-secondary); color:var(--text-secondary); border:1px solid var(--border-color); border-radius:0; text-align:right; cursor:default;';
    html += '<tr style="border-bottom:1px solid var(--border-color);">';
    html += '<th style="padding:6px 8px; text-align:left; background:var(--bg-tertiary); border-right:1px solid var(--border-color); font-weight:500; color:var(--text-secondary);">Kademe Sayısı</th>';
    html += '<td style="padding:4px 6px; background:var(--bg-tertiary);"><input type="text" value="' + ftTrGears.length + '" readonly style="' + roStyle + '" tabindex="-1"></td>';
    html += '</tr>';
    
    html += '</table>';
    html += '</div></div>';

    // ── KADEME TABLOSU ──
    html += '<div style="margin-top:10px;">';
    html += '<div class="sw-section-title">Kademe Tablosu</div>';
    
    html += '<div style="border:1px solid var(--border-color); border-radius:0; overflow:hidden;">';
    html += '<table style="width:100%; border-collapse:collapse; font-size:0.68rem;">';
    html += '<thead style="background:var(--bg-tertiary);">';
    html += '<tr>';
    html += '<th style="padding:5px; border-bottom:1px solid var(--border-color); text-align:center; width:30%;">Kademe</th>';
    html += '<th style="padding:5px; border-bottom:1px solid var(--border-color); text-align:center; width:35%;">Oran</th>';
    html += '<th style="padding:5px; border-bottom:1px solid var(--border-color); text-align:center; width:35%;">Verim [%]</th>';
    html += '</tr>';
    html += '</thead>';
    html += '<tbody>';
    
    ftTrGears.forEach(function(g, idx) {
      var isLast = idx === ftTrGears.length - 1;
      html += '<tr style="' + (isLast ? '' : 'border-bottom:1px solid var(--border-color);') + '">';
      html += '<td style="padding:5px; text-align:center; background:var(--bg-tertiary); font-weight:500; color:var(--text-secondary);">' + g.kademe + '</td>';
      html += '<td style="padding:3px 5px; background:var(--bg-tertiary);"><input type="number" id="ve-fttr-ratio-' + node.id + '-' + idx + '" value="' + g.ratio + '" step="0.001" min="0.1" style="width:100%; padding:3px; font-size:0.68rem; background:var(--bg-input); color:var(--text-primary); border:1px solid var(--border-color); border-radius:0; text-align:right;" onchange="onVEFTTransferParamChange(\'' + node.id + '\')"></td>';
      html += '<td style="padding:3px 5px; background:var(--bg-tertiary);"><input type="number" id="ve-fttr-eff-' + node.id + '-' + idx + '" value="' + g.eff + '" step="0.01" min="80" max="100" style="width:100%; padding:3px; font-size:0.68rem; background:var(--bg-input); color:var(--text-primary); border:1px solid var(--border-color); border-radius:0; text-align:right;" onchange="onVEFTTransferParamChange(\'' + node.id + '\')"></td>';
      html += '</tr>';
    });
    
    html += '</tbody></table>';
    html += '</div>';
    html += '</div>';
    
    // ── BİLGİ NOTU ──
    html += '<div class="sw-pkg-desc">⚡ Tam Gaz Hızlanma simülasyonu tüm kademeler için ayrı ayrı çalıştırılır. Sonuçlar her kademe için ayrı iSCAAN tablosu olarak raporlanır.</div>';
    
    html += '</div>';
    return html;
  }
  
  // ── MOTOR FRENİ / DİĞER MODÜLLER: Mevcut panel ──
  var transferData = nodeData.transferData || [];
  var selectedMode = nodeData.selectedMode || '';
  var selectedRatio = nodeData.selectedRatio || '';
  
  html += '<div class="sw-pkg-desc">Transfer kutusu kademelerini ve oranlarını tanımlayınız.</div>';
  
  // Transfer Kutusu Marka/Model Seçici
  html += '<div style="display:flex; gap:4px; margin-bottom:8px; align-items:center;">';
  html += '<select id="ve-transfer-brand-' + node.id + '" onchange="veUpdateTransferModels(\'' + node.id + '\')" style="flex:1; font-size:0.68rem; padding:4px 4px; background:var(--bg-input); color:var(--text-primary); border:1px solid var(--border-color); border-radius:0;">';
  html += '<option value="">-- Marka --</option>';
  html += '<option value="AxleTech">AxleTech</option>';
  html += '<option value="Base Studio">Base Studio</option>';
  html += '<option value="GHM">GHM</option>';
  html += '<option value="ZF">ZF</option>';
  html += '</select>';
  html += '<select id="ve-transfer-model-' + node.id + '" onchange="veLoadTransferModel(\'' + node.id + '\')" style="flex:1; font-size:0.68rem; padding:4px 4px; background:var(--bg-input); color:var(--text-primary); border:1px solid var(--border-color); border-radius:0;">';
  html += '<option value="">-- Model --</option>';
  html += '</select>';
  html += '</div>';
  
  // Kademe Tablosu
  html += '<div id="ve-transfer-table-wrapper-' + node.id + '" style="max-height:150px; overflow-y:auto; margin-bottom:0; border:1px solid var(--border-color); border-radius:0; border-bottom:none;">';
  html += '<table style="width:100%; border-collapse:collapse; font-size:0.7rem;">';
  html += '<thead style="position:sticky; top:0; background:var(--bg-tertiary); z-index:1;">';
  html += '<tr>';
  html += '<th style="padding:6px; text-align:center; border-bottom:1px solid var(--border-color); width:30%;">Kademe</th>';
  html += '<th style="padding:6px; text-align:center; border-bottom:1px solid var(--border-color); width:35%;">Oran [-]</th>';
  html += '<th style="padding:6px; text-align:center; border-bottom:1px solid var(--border-color); width:25%;">Not</th>';
  html += '<th style="padding:6px; text-align:center; border-bottom:1px solid var(--border-color); width:10%;">Sil</th>';
  html += '</tr>';
  html += '</thead>';
  html += '<tbody id="ve-transfer-table-' + node.id + '">';
  
  if(transferData.length > 0) {
    transferData.forEach(function(row) {
      html += getVETransferRowHTML(node.id, row.mode || '', row.ratio !== undefined && row.ratio !== null ? row.ratio : '', row.note || '');
    });
  } else {
    // Varsayılan kademeler
    html += getVETransferRowHTML(node.id, 'High', '1.000', 'Yol kademesi');
    html += getVETransferRowHTML(node.id, 'Low', '2.480', 'Arazi kademesi');
  }
  
  html += '</tbody></table></div>';
  
  // Tablo altı butonlar
  html += '<div class="sw-btn-row">';
  html += '<button class="sw-btn sw-btn-primary" onclick="addVETransferRow(\'' + node.id + '\')">+ Satır Ekle</button>';
  html += '<button class="sw-btn" onclick="clearVETransferTable(\'' + node.id + '\')">Temizle</button>';
  html += '</div>';
  
  // Aktif Kademe Seçimi
  html += '<div class="sw-pkg-card" style="margin-bottom:10px; margin-top:12px;">';
  html += '<div class="sw-pkg-header" style="cursor:default;"><span class="sw-pkg-name">Aktif Kademe</span></div>';
  html += '<div class="sw-pkg-body">';
  
  html += '<table style="width:100%; font-size:0.7rem; border-collapse:collapse; border:1px solid var(--border-color);">';
  html += '<tr style="border-bottom:1px solid var(--border-color);">';
  html += '<th style="padding:8px; text-align:left; background:var(--bg-tertiary); border-right:1px solid var(--border-color); width:50%; font-weight:500; color:var(--text-secondary);">Seçili kademe</th>';
  html += '<td style="padding:8px; background:var(--bg-tertiary);">';
  html += '<select id="ve-transfer-mode-' + node.id + '" onchange="onVETransferModeChange(\'' + node.id + '\')" style="width:100%; padding:5px; font-size:0.7rem; background:var(--bg-input); color:var(--text-primary); border:1px solid var(--border-color); border-radius:0;">';
  html += '<option value="">-- Seçin --</option>';
  html += '</select>';
  html += '</td>';
  html += '</tr>';
  html += '<tr>';
  html += '<th style="padding:8px; text-align:left; background:var(--bg-tertiary); border-right:1px solid var(--border-color); font-weight:500; color:var(--text-secondary);">Aktif oran</th>';
  html += '<td style="padding:8px; background:var(--bg-tertiary);"><input type="number" id="ve-transfer-ratio-' + node.id + '" value="' + selectedRatio + '" readonly style="width:100%; padding:5px; font-size:0.7rem; background:var(--bg-secondary); color:var(--text-primary); border:1px solid var(--border-color); border-radius:0; text-align:right; cursor:not-allowed;"></td>';
  html += '</tr>';
  html += '</table>';
  html += '</div></div>';

  // ===== VERİM =====
  var transferEfficiency = nodeData.efficiency !== undefined ? nodeData.efficiency : 98;
  html += '<div class="sw-pkg-card" style="margin-bottom:10px; margin-top:12px;">';
  html += '<div class="sw-pkg-header" style="cursor:default;"><span class="sw-pkg-name">Verim</span></div>';
  html += '<div class="sw-pkg-body">';
  html += '<table style="width:100%; font-size:0.7rem; border-collapse:collapse; border:1px solid var(--border-color);">';
  html += '<tr style="border-bottom:1px solid var(--border-color);">';
  html += '<th style="padding:8px; text-align:left; background:var(--bg-tertiary); border-right:1px solid var(--border-color); width:55%; font-weight:500; color:var(--text-secondary);">Transfer kutusu verimi [%]</th>';
  html += '<td style="padding:8px; background:var(--bg-tertiary);"><input type="number" id="ve-transfer-eff-' + node.id + '" value="' + transferEfficiency + '" step="0.5" min="80" max="100" style="width:100%; padding:5px; font-size:0.7rem; background:var(--bg-input); color:var(--text-primary); border:1px solid var(--border-color); border-radius:0; text-align:right;" onchange="onVETransferEffChange(\'' + node.id + '\')"></td>';
  html += '</tr>';
  html += '<tr><td colspan="2" style="padding:5px 8px; font-size:0.62rem; color:var(--text-muted); background:var(--bg-secondary);">Tipik değer: %95–98</td></tr>';
  html += '</table></div></div>';
  
  html += '</div>';
  return html;
}
function onVETransferEffChange(nodeId) {
  var node = nodes.find(function(n) { return n.id === nodeId; });
  if(!node) return;
  if(!node.data) node.data = {};
  var el = document.getElementById('ve-transfer-eff-' + nodeId);
  if(el) { var n = parseFloat(el.value); node.data.efficiency = isNaN(n) ? 98 : n; }
}

function onVEFTTransferParamChange(nodeId) {
  var node = nodes.find(function(n) { return n.id === nodeId; });
  if(!node) return;
  if(!node.data) node.data = {};
  
  var pf = function(v, def) { var n = parseFloat(v); return isNaN(n) ? def : n; };
  var nameEl = document.getElementById('ve-fttr-name-' + nodeId);
  if(nameEl) node.data.ftTrName = nameEl.value || 'İki Kademeli';

  // Kademe tablosunu oku
  var gears = node.data.ftTrGears || [
    { kademe: 'High', ratio: 1.054, eff: 97.00 },
    { kademe: 'Low', ratio: 2.337, eff: 97.00 }
  ];
  gears.forEach(function(g, idx) {
    var rEl = document.getElementById('ve-fttr-ratio-' + nodeId + '-' + idx);
    var eEl = document.getElementById('ve-fttr-eff-' + nodeId + '-' + idx);
    if(rEl) g.ratio = pf(rEl.value, g.ratio);
    if(eEl) g.eff = pf(eEl.value, g.eff);
  });
  node.data.ftTrGears = gears;
}

// Tam Gaz — Transfer Case preset seçimi
function onVEFTTransferPresetSelect(nodeId, value) {
  var node = nodes.find(function(n) { return n.id === nodeId; });
  if(!node) return;
  if(!node.data) node.data = {};
  
  if(!value) return;
  var preset = VE_TRANSFER_PRESETS[value];
  if(!preset) return;
  
  node.data.ftTrPreset = value;
  
  // Transfer case adı güncelle
  var nameEl = document.getElementById('ve-fttr-name-' + nodeId);
  var fullName = preset.marka + ' ' + preset.model;
  if(nameEl) { nameEl.value = fullName; node.data.ftTrName = fullName; }
  
  // Kademe tablosunu güncelle
  var ftTrGears = preset.rows.map(function(r) {
    return { kademe: r.mode, ratio: parseFloat(r.ratio) || 1.0, eff: 97.00 };
  });
  node.data.ftTrGears = ftTrGears;
  
  // Panel'i yeniden render et
  showNodeProperties(node);
  showToast('Transfer Case: ' + fullName);
}

// Transfer kutusu preset verileri - Klasik Arayüz ile aynı veri seti
var VE_TRANSFER_PRESETS = {
  'ZF|VG750': { marka:'ZF', model:'VG750', rows:[{mode:'OnRoad',ratio:'1.086',note:''},{mode:'OffRoad',ratio:'2.103',note:''}] },
  'ZF|VG1600': { marka:'ZF', model:'VG1600', rows:[{mode:'OnRoad',ratio:'0.89',note:''},{mode:'OffRoad',ratio:'1.536',note:''}] },
  'ZF|VG2000': { marka:'ZF', model:'VG2000', rows:[{mode:'OnRoad',ratio:'0.89',note:''},{mode:'OffRoad',ratio:'1.536',note:''}] },
  'ZF|VG2700': { marka:'ZF', model:'VG2700', rows:[{mode:'OnRoad',ratio:'0.913',note:''},{mode:'OffRoad',ratio:'1.407',note:''}] },
  'ZF|TC27': { marka:'ZF', model:'TC27', rows:[{mode:'OnRoad',ratio:'0.874',note:''},{mode:'OffRoad',ratio:'1.536',note:''}] },
  'GHM|MTC60': { marka:'GHM', model:'MTC60', rows:[{mode:'OnRoad',ratio:'1.09',note:''},{mode:'OffRoad',ratio:'2.47',note:''}] },
  'GHM|RTC 60': { marka:'GHM', model:'RTC 60', rows:[{mode:'OnRoad',ratio:'1.09',note:''},{mode:'OffRoad',ratio:'2.47',note:''}] },
  'Base Studio|TKB-420/10': { marka:'Base Studio', model:'TKB-420/10', rows:[{mode:'OnRoad',ratio:'1.054',note:''},{mode:'OffRoad',ratio:'2.19',note:''}] },
  'Base Studio|TKB-420/20': { marka:'Base Studio', model:'TKB-420/20', rows:[{mode:'OnRoad',ratio:'0.936',note:''},{mode:'OffRoad',ratio:'1.922',note:''}] },
  'Base Studio|TKB-420/30': { marka:'Base Studio', model:'TKB-420/30', rows:[{mode:'OnRoad',ratio:'0.936',note:''},{mode:'OffRoad',ratio:'1.922',note:''}] },
  'Base Studio|TKA-420/50': { marka:'Base Studio', model:'TKA-420/50', rows:[{mode:'OnRoad',ratio:'1.054',note:''},{mode:'OffRoad',ratio:'2.337',note:''}] },
  'Base Studio|TKA-423/10': { marka:'Base Studio', model:'TKA-423/10', rows:[{mode:'OnRoad',ratio:'1.145',note:''},{mode:'OffRoad',ratio:'1.917',note:''}] },
  'Base Studio|TKA-423/20': { marka:'Base Studio', model:'TKA-423/20', rows:[{mode:'OnRoad',ratio:'1.229',note:''},{mode:'OffRoad',ratio:'1.917',note:''}] },
  'Base Studio|TKA-423/30': { marka:'Base Studio', model:'TKA-423/30', rows:[{mode:'OnRoad',ratio:'1.229',note:''},{mode:'OffRoad',ratio:'1.917',note:''}] },
  'Base Studio|TKB-330': { marka:'Base Studio', model:'TKB-330', rows:[{mode:'OnRoad',ratio:'3.428',note:''}] },
  'AxleTech|T600': { marka:'AxleTech', model:'T600', rows:[{mode:'OnRoad',ratio:'1.0',note:''},{mode:'OffRoad',ratio:'2.45',note:''}] }
};
var VE_TRANSFER_BRANDS = ['AxleTech','Base Studio','GHM','ZF'];

function onVETransferSelectChange(nodeId, value) {
  if(!value || value === '__new__') return;
  var preset = VE_TRANSFER_PRESETS[value];
  if(!preset) return;
  var tbody = document.getElementById('ve-transfer-table-' + nodeId);
  if(!tbody) return;
  tbody.innerHTML = '';
  preset.rows.forEach(function(row) {
    var tr = document.createElement('tr');
    tr.innerHTML = getVETransferRowHTML(nodeId, row.mode, row.ratio, row.note).replace('<tr>','').replace('</tr>','');
    tbody.appendChild(tr);
  });
  var node = nodes.find(function(n) { return n.id === nodeId; });
  if(node) { if(!node.data) node.data = {}; node.data.selectedTransfer = value; }
  onVETransferDataChange(nodeId);
  showToast('Transfer kutusu: ' + preset.marka + ' ' + preset.model);
}

function veUpdateTransferModels(nodeId) {
  var brandSel = document.getElementById('ve-transfer-brand-' + nodeId);
  var modelSel = document.getElementById('ve-transfer-model-' + nodeId);
  if(!brandSel || !modelSel) return;
  var brand = brandSel.value;
  modelSel.innerHTML = '<option value="">-- Model --</option>';
  if(!brand) return;
  Object.keys(VE_TRANSFER_PRESETS).forEach(function(key) {
    var p = VE_TRANSFER_PRESETS[key];
    if(p.marka === brand) {
      var opt = document.createElement('option'); opt.value = key; opt.textContent = p.model;
      modelSel.appendChild(opt);
    }
  });
}

function veLoadTransferModel(nodeId) {
  var modelSel = document.getElementById('ve-transfer-model-' + nodeId);
  if(!modelSel || !modelSel.value) return;
  onVETransferSelectChange(nodeId, modelSel.value);
}

function getVETransferRowHTML(nodeId, mode, ratio, note) {
  var html = '<tr>';
  html += '<td style="padding:3px; border-bottom:1px solid var(--border-color);"><input type="text" value="' + mode + '" style="width:100%; padding:4px; font-size:0.7rem; background:var(--bg-input); color:var(--text-primary); border:1px solid var(--border-color); border-radius:0; text-align:center;" onchange="onVETransferDataChange(\'' + nodeId + '\')"></td>';
  html += '<td style="padding:3px; border-bottom:1px solid var(--border-color);"><input type="number" step="0.001" value="' + ratio + '" style="width:100%; padding:4px; font-size:0.7rem; background:var(--bg-input); color:var(--text-primary); border:1px solid var(--border-color); border-radius:0; text-align:center;" onchange="onVETransferDataChange(\'' + nodeId + '\')"></td>';
  html += '<td style="padding:3px; border-bottom:1px solid var(--border-color);"><input type="text" value="' + note + '" style="width:100%; padding:4px; font-size:0.7rem; background:var(--bg-input); color:var(--text-primary); border:1px solid var(--border-color); border-radius:0; text-align:center;" onchange="onVETransferDataChange(\'' + nodeId + '\')"></td>';
  html += '<td style="padding:3px; border-bottom:1px solid var(--border-color); text-align:center;"><button onclick="removeVETransferRow(this, \'' + nodeId + '\')" style="padding:2px 6px; font-size:0.6rem; background:var(--accent-danger); color:white; border:none; border-radius:0; cursor:pointer;">×</button></td>';
  html += '</tr>';
  return html;
}

function addVETransferRow(nodeId) {
  var tbody = document.getElementById('ve-transfer-table-' + nodeId);
  if(!tbody) return;
  var tr = document.createElement('tr');
  tr.innerHTML = getVETransferRowHTML(nodeId, '', '', '').replace('<tr>', '').replace('</tr>', '');
  tbody.appendChild(tr);
}

function removeVETransferRow(btn, nodeId) {
  btn.closest('tr').remove();
  onVETransferDataChange(nodeId);
}

function clearVETransferTable(nodeId) {
  var tbody = document.getElementById('ve-transfer-table-' + nodeId);
  if(tbody) {
    tbody.innerHTML = '';
    addVETransferRow(nodeId);
  }
  onVETransferDataChange(nodeId);
}

function onVETransferDataChange(nodeId) {
  var node = nodes.find(function(n) { return n.id === nodeId; });
  if(!node) return;
  if(!node.data) node.data = {};
  
  var tbody = document.getElementById('ve-transfer-table-' + nodeId);
  if(!tbody) return;
  
  var data = [];
  tbody.querySelectorAll('tr').forEach(function(tr) {
    var inputs = tr.querySelectorAll('input');
    if(inputs.length >= 2 && inputs[0].value.trim()) {
      data.push({mode: inputs[0].value.trim(), ratio: inputs[1].value.trim(), note: inputs[2] ? inputs[2].value.trim() : ''});
    }
  });
  node.data.transferData = data;
  
  // Kademe seçici güncelle
  var selectEl = document.getElementById('ve-transfer-mode-' + nodeId);
  if(selectEl) {
    selectEl.innerHTML = '<option value="">-- Seçin --</option>';
    data.forEach(function(d, idx) {
      var opt = document.createElement('option');
      opt.value = idx;
      opt.textContent = d.mode + ' (oran: ' + d.ratio + ')';
      selectEl.appendChild(opt);
    });
  }
}

function onVETransferModeChange(nodeId) {
  var node = nodes.find(function(n) { return n.id === nodeId; });
  if(!node) return;
  
  var selectEl = document.getElementById('ve-transfer-mode-' + nodeId);
  var ratioEl = document.getElementById('ve-transfer-ratio-' + nodeId);
  if(!selectEl || !ratioEl) return;
  
  var idx = parseInt(selectEl.value);
  var data = node.data && node.data.transferData ? node.data.transferData : [];
  
  if(!isNaN(idx) && data[idx]) {
    ratioEl.value = data[idx].ratio;
    if(!node.data) node.data = {};
    node.data.selectedMode = selectEl.value;
    node.data.selectedRatio = data[idx].ratio;
  } else {
    ratioEl.value = '';
  }
}

// ===== PROPŞAFT ÖZELLİKLERİ =====
function getPropshaftPropertiesHTML(node) {
  var d = node.data || {};
  var psName = d.psName || 'Tek Parça — Çift Mafsal';
  var psRatio = 1.000;
  var psEff = d.psEff !== undefined ? d.psEff : 98.60;
  var psInertia = d.psInertia !== undefined ? d.psInertia : 0.5;
  
  var html = '<div class="sw-panel">';

  html += '<div class="sw-status-bar installed">';
  html += '<span class="sw-status-dot"></span>';
  html += '<span>Propşaft Verileri</span>';
  html += '<button class="sw-info-btn" onclick="showInfoPopup(\'propshaftVerileri\')" title="Bilgi">?</button>';
  html += '</div>';

  html += '<div class="sw-pkg-card" style="margin-bottom:10px;">';
  html += '<div class="sw-pkg-header" style="cursor:default;"><span class="sw-pkg-name">Propşaft Parametreleri</span></div>';
  html += '<div class="sw-pkg-body">';
  html += '<table style="width:100%; font-size:0.68rem; border-collapse:collapse; border:1px solid var(--border-color);">';
  
  // Propşaft Adı
  html += '<tr style="border-bottom:1px solid var(--border-color);">';
  html += '<th style="padding:6px 8px; text-align:left; background:var(--bg-tertiary); border-right:1px solid var(--border-color); width:45%; font-weight:500; color:var(--text-secondary);">Propşaft Adı</th>';
  html += '<td style="padding:4px 6px; background:var(--bg-tertiary);"><input type="text" id="ve-ps-name-' + node.id + '" value="' + psName + '" style="width:100%; padding:4px; font-size:0.68rem; background:var(--bg-input); color:var(--text-primary); border:1px solid var(--border-color); border-radius:0;" onchange="onVEPropshaftParamChange(\'' + node.id + '\')"></td>';
  html += '</tr>';
  
  // Oran (readonly)
  var roStyle = 'width:100%; padding:4px; font-size:0.68rem; background:var(--bg-secondary); color:var(--text-secondary); border:1px solid var(--border-color); border-radius:0; text-align:right; cursor:default;';
  html += '<tr style="border-bottom:1px solid var(--border-color);">';
  html += '<th style="padding:6px 8px; text-align:left; background:var(--bg-tertiary); border-right:1px solid var(--border-color); font-weight:500; color:var(--text-secondary);">Oran [-]</th>';
  html += '<td style="padding:4px 6px; background:var(--bg-tertiary);"><input type="text" value="' + psRatio.toFixed(3) + '" readonly style="' + roStyle + '" tabindex="-1"></td>';
  html += '</tr>';
  
  // Verim
  html += '<tr style="border-bottom:1px solid var(--border-color);">';
  html += '<th style="padding:6px 8px; text-align:left; background:var(--bg-tertiary); border-right:1px solid var(--border-color); font-weight:500; color:var(--text-secondary);">Verim <span style="color:var(--text-muted); font-weight:400;">[%]</span></th>';
  html += '<td style="padding:4px 6px; background:var(--bg-tertiary);"><input type="number" id="ve-ps-eff-' + node.id + '" value="' + psEff + '" step="0.01" min="90" max="100" style="width:100%; padding:4px; font-size:0.68rem; background:var(--bg-input); color:var(--text-primary); border:1px solid var(--border-color); border-radius:0; text-align:right;" onchange="onVEPropshaftParamChange(\'' + node.id + '\')"></td>';
  html += '</tr>';
  
  // Atalet
  html += '<tr style="border-bottom:1px solid var(--border-color);">';
  html += '<th style="padding:6px 8px; text-align:left; background:var(--bg-tertiary); border-right:1px solid var(--border-color); font-weight:500; color:var(--text-secondary);">Atalet <span style="color:var(--text-muted); font-weight:400;">[kg·m²]</span></th>';
  html += '<td style="padding:4px 6px; background:var(--bg-tertiary);"><input type="number" id="ve-ps-inertia-' + node.id + '" value="' + psInertia + '" step="0.01" min="0" style="width:100%; padding:4px; font-size:0.68rem; background:var(--bg-input); color:var(--text-primary); border:1px solid var(--border-color); border-radius:0; text-align:right;" onchange="onVEPropshaftParamChange(\'' + node.id + '\')"></td>';
  html += '</tr>';
  
  html += '</table>';
  html += '</div></div>';
  html += '</div>';
  return html;
}

function onVEPropshaftParamChange(nodeId) {
  var node = nodes.find(function(n) { return n.id === nodeId; });
  if(!node) return;
  if(!node.data) node.data = {};
  var nameEl = document.getElementById('ve-ps-name-' + nodeId);
  var effEl = document.getElementById('ve-ps-eff-' + nodeId);
  var inerEl = document.getElementById('ve-ps-inertia-' + nodeId);
  var pf = function(v, def) { var n = parseFloat(v); return isNaN(n) ? def : n; };
  if(nameEl) node.data.psName = nameEl.value || 'Tek Parça — Çift Mafsal';
  if(effEl) node.data.psEff = pf(effEl.value, 98.60);
  if(inerEl) node.data.psInertia = pf(inerEl.value, 0.5);
}

// ===== DİFERANSİYEL ÖZELLİKLERİ =====
function getDifferentialPropertiesHTML(node) {
  var nodeData = node.data || {};
  // Varsayılan değerleri node.data'ya yaz (ilk render'da)
  if(nodeData.diffRatio === undefined) nodeData.diffRatio = 6.54;
  if(nodeData.efficiency === undefined) nodeData.efficiency = 96;
  if(nodeData.diffInertia === undefined) nodeData.diffInertia = 1.0;

  var isFullThrottle = veActiveModule === 'full-throttle';

  if(isFullThrottle) {
    // ── TAM GAZ HIZLANMA: Master/Slave kontrolü ──
    var diffNodes = nodes.filter(function(n) { return n.type === 'differential'; });
    var hasMaster = diffNodes.some(function(n) { return n.isMasterDiff; });
    if(!hasMaster && diffNodes.length > 0) {
      diffNodes[0].isMasterDiff = true;
      var firstEl = document.getElementById(diffNodes[0].id);
      if(firstEl && !firstEl.querySelector('.ve-wheel-master-badge')) {
        var badge = document.createElement('div');
        badge.className = 've-wheel-master-badge';
        badge.title = 'Master Diferansiyel';
        badge.textContent = '★';
        var box = firstEl.querySelector('.ve-node-box');
        if(box) box.appendChild(badge);
      }
    }
    var isMaster = node.isMasterDiff || false;
    var masterNode = isMaster ? node : diffNodes.find(function(n) { return n.isMasterDiff; });

    // Slave diferansiyel: sadece görsel
    if(!isMaster) {
      var html = '<div class="sw-panel">';
      html += '<div class="sw-status-bar not-installed">';
      html += '<span class="sw-status-dot"></span>';
      html += '<span>Diferansiyel Parametreleri</span>';
      html += '<span style="background:var(--bg-tertiary); color:var(--text-muted); font-size:0.55rem; font-weight:600; padding:1px 5px; border-radius:0; border:1px solid var(--border-color);">SLAVE</span>';
      html += '</div>';
      html += '<div class="sw-pkg-desc">';
      html += 'Bu diferansiyel görsel amaçlıdır. Tüm parametreler Master diferansiyel' + (masterNode ? ' (' + (masterNode.customName || 'Diferansiyel') + ')' : '') + ' üzerinden tanımlanır.';
      html += '</div>';
      html += '</div>';
      return html;
    }
  }

  var diffRatio = nodeData.diffRatio;
  var efficiency = nodeData.efficiency;
  
  var html = '<div class="sw-panel">';

  // Başlık
  html += '<div class="sw-status-bar installed">';
  html += '<span class="sw-status-dot"></span>';
  html += '<span>Diferansiyel Parametreleri</span>';
  if(isFullThrottle) {
    html += '<span style="background:#f59e0b; color:#000; font-size:0.55rem; font-weight:700; padding:1px 5px; border-radius:0;">★ MASTER</span>';
  }
  html += '<button class="sw-info-btn" onclick="showInfoPopup(\'diferansiyel\')" title="Bilgi">?</button>';
  html += '</div>';
  
  // Tablo
  html += '<table style="width:100%; font-size:0.7rem; border-collapse:collapse; border:1px solid var(--border-color);">';
  
  // Diferansiyel oranı
  html += '<tr style="border-bottom:1px solid var(--border-color);">';
  html += '<th style="padding:8px; text-align:left; background:var(--bg-tertiary); border-right:1px solid var(--border-color); width:60%; font-weight:500; color:var(--text-secondary);">Diferansiyel oranı [-]</th>';
  html += '<td style="padding:8px; background:var(--bg-tertiary);"><input type="number" id="ve-diff-ratio-' + node.id + '" value="' + diffRatio + '" step="0.01" min="1" max="20" style="width:100%; padding:5px; font-size:0.7rem; background:var(--bg-input); color:var(--text-primary); border:1px solid var(--border-color); border-radius:0; text-align:right;" onchange="onVEDiffParamChange(\'' + node.id + '\')"></td>';
  html += '</tr>';
  
  html += '<tr style="border-bottom:1px solid var(--border-color);">';
  html += '<td colspan="2" style="padding:6px 8px; font-size:0.65rem; color:var(--text-secondary); background:var(--bg-secondary); line-height:1.4;">Son tahrik oranı. Askeri araçlarda tipik değer: 4.5–8.0 arası.</td>';
  html += '</tr>';
  
  // Verim
  html += '<tr style="border-bottom:1px solid var(--border-color);">';
  html += '<th style="padding:8px; text-align:left; background:var(--bg-tertiary); border-right:1px solid var(--border-color); font-weight:500; color:var(--text-secondary);">Diferansiyel verimi [%]</th>';
  html += '<td style="padding:8px; background:var(--bg-tertiary);"><input type="number" id="ve-diff-eff-' + node.id + '" value="' + efficiency + '" step="0.5" min="80" max="100" style="width:100%; padding:5px; font-size:0.7rem; background:var(--bg-input); color:var(--text-primary); border:1px solid var(--border-color); border-radius:0; text-align:right;" onchange="onVEDiffParamChange(\'' + node.id + '\')"></td>';
  html += '</tr>';
  
  html += '<tr>';
  html += '<td colspan="2" style="padding:6px 8px; font-size:0.65rem; color:var(--text-secondary); background:var(--bg-secondary); line-height:1.4;">Diferansiyel mekanik verimi. Tipik değer: %95–98 arası.</td>';
  html += '</tr>';
  
  // Atalet
  var diffInertia = nodeData.diffInertia !== undefined ? nodeData.diffInertia : 1.0;
  html += '<tr style="border-bottom:1px solid var(--border-color);">';
  html += '<th style="padding:8px; text-align:left; background:var(--bg-tertiary); border-right:1px solid var(--border-color); font-weight:500; color:var(--text-secondary);">Atalet <span style="color:var(--text-muted); font-weight:400;">[kg·m²]</span></th>';
  html += '<td style="padding:8px; background:var(--bg-tertiary);"><input type="number" id="ve-diff-inertia-' + node.id + '" value="' + diffInertia + '" step="0.01" min="0" style="width:100%; padding:5px; font-size:0.7rem; background:var(--bg-input); color:var(--text-primary); border:1px solid var(--border-color); border-radius:0; text-align:right;" onchange="onVEDiffParamChange(\'' + node.id + '\')"></td>';
  html += '</tr>';
  
  html += '</table>';
  html += '</div>';
  return html;
}

function onVEDiffParamChange(nodeId) {
  var node = nodes.find(function(n) { return n.id === nodeId; });
  if(!node) return;
  if(!node.data) node.data = {};
  
  var ratioEl = document.getElementById('ve-diff-ratio-' + nodeId);
  var effEl = document.getElementById('ve-diff-eff-' + nodeId);
  
  var pf = function(v, def) { var n = parseFloat(v); return isNaN(n) ? def : n; };
  if(ratioEl) node.data.diffRatio = pf(ratioEl.value, 6.54);
  if(effEl) node.data.efficiency = pf(effEl.value, 96);
  var inerEl = document.getElementById('ve-diff-inertia-' + nodeId);
  if(inerEl) node.data.diffInertia = pf(inerEl.value, 1.0);
}

