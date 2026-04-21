// ===== TORK KONVERTÖRÜ ÖZELLİKLERİ =====
function getTorqueConverterPropertiesHTML(node) {
  var nodeData = node.data || {};
  var isFullThrottle = veActiveModule === 'full-throttle';
  
  var tcRows = nodeData.tcData || [];
  var hasData = tcRows.length > 0;

  var html = '<div class="sw-panel">';

  if(isFullThrottle) {
    // ── TAM GAZ HIZLANMA: Konvertör Parametreleri ──
    var tcPresetKey = nodeData.tcPresetKey || '';
    var tcName = nodeData.tcName || '';
    var pumpTorqueDrop = nodeData.pumpTorqueDrop !== undefined ? nodeData.pumpTorqueDrop : 17.6;
    
    // Konvertör seçici — şanzıman ailesine göre filtreleme
    // Şanzıman bileşeninden aile bilgisini oku
    var _gbFamily = '';
    var _gbNode = nodes.find(function(n) { return n.type === 'gearbox'; });
    if(_gbNode && _gbNode.data) {
      var _gbKey = _gbNode.data.ftGBPreset || _gbNode.data.selectedGearbox || '';
      if(_gbKey && VE_GEARBOX_PRESETS[_gbKey]) {
        _gbFamily = VE_GEARBOX_PRESETS[_gbKey].family || '';
      }
    }
    var _familyLabels = {'1000_2000': '1000/2000 Serisi', '3000': '3000 Serisi', '4000': '4000 Serisi'};
    
    html += '<div class="sw-section-title">Konvertör Seçimi</div>';

    var hasECM = nodes.some(function(n) { return n.type === 'ec-matching'; });
    html += '<div style="margin-bottom:10px;">';
    if(hasECM) {
      html += '<div class="sw-chain-bar fail" style="margin-bottom:6px;">🔒 Konvertör seçimi Motor-Konvertör Eşleştirme bileşeni üzerinden yapılmaktadır.</div>';
    }
    html += '<select id="ve-tc-select-' + node.id + '"' + (hasECM ? ' disabled' : '') + ' onchange="onVEFTTCSelect(\'' + node.id + '\', this.value)" style="width:100%; font-size:0.7rem; padding:6px 8px; background:var(--bg-input); color:var(--text-primary); border:1px solid var(--border-color); border-radius:0;' + (hasECM ? ' opacity:0.6; cursor:not-allowed;' : '') + '">';
    html += '<option value="">-- Konvertör Seçiniz --</option>';
    
    if(!_gbFamily) {
      // Şanzıman seçilmemiş → uyarı ve tüm konvertörleri göster
      html += '<option value="" disabled style="color:var(--accent-warning);">⚠ Önce şanzıman seçiniz (aile filtreleme)</option>';
      ['1000_2000','3000','4000'].forEach(function(fam) {
        var famTCs = Object.keys(VE_FT_TC_PRESETS).filter(function(k) { return VE_FT_TC_PRESETS[k].family === fam; });
        if(famTCs.length === 0) return;
        html += '<optgroup label="Allison ' + _familyLabels[fam] + '">';
        famTCs.forEach(function(key) {
          var p = VE_FT_TC_PRESETS[key];
          var stallInfo = (p.data.length > 0) ? ' (τ₀=' + p.data[0].tau.toFixed(2) + ')' : ' ⚠ Veri Eksik';
          var dis = p.incomplete ? ' disabled style="color:var(--text-muted);"' : '';
          html += '<option value="' + key + '"' + (tcPresetKey === key ? ' selected' : '') + dis + '>' + p.name + stallInfo + '</option>';
        });
        html += '</optgroup>';
      });
    } else {
      // Şanzıman seçili → sadece uyumlu konvertörleri göster
      var compatTCs = Object.keys(VE_FT_TC_PRESETS).filter(function(k) { return VE_FT_TC_PRESETS[k].family === _gbFamily; });
      html += '<optgroup label="Allison ' + _familyLabels[_gbFamily] + ' (' + compatTCs.length + ' konvertör)">';
      compatTCs.forEach(function(key) {
        var p = VE_FT_TC_PRESETS[key];
        var stallInfo = (p.data.length > 0) ? ' (τ₀=' + p.data[0].tau.toFixed(2) + ')' : ' ⚠ Veri Eksik';
        var dis = p.incomplete ? ' disabled style="color:var(--text-muted);"' : '';
        html += '<option value="' + key + '"' + (tcPresetKey === key ? ' selected' : '') + dis + '>' + p.name + stallInfo + '</option>';
      });
      html += '</optgroup>';
    }
    
    html += '<option value="manual"' + (tcPresetKey === 'manual' ? ' selected' : '') + '>Manuel Giriş</option>';
    html += '</select>';
    // Seçili konvertör açıklaması
    var selDesc = '';
    if(tcPresetKey && tcPresetKey !== 'manual' && VE_FT_TC_PRESETS[tcPresetKey]) {
      selDesc = VE_FT_TC_PRESETS[tcPresetKey].description || '';
    }
    html += '<div id="ve-tc-desc-' + node.id + '" style="font-size:0.52rem; color:var(--text-muted); margin-top:3px; line-height:1.3; min-height:12px;">' + selDesc + '</div>';
    html += '</div>';
    
    html += '<div class="sw-pkg-card" style="margin-bottom:10px;">';
    html += '<div class="sw-pkg-header" style="cursor:default;"><span class="sw-pkg-name">Konvertör Parametreleri</span></div>';
    html += '<div class="sw-pkg-body">';
    html += '<table style="width:100%; font-size:0.68rem; border-collapse:collapse; border:1px solid var(--border-color);">';
    
    html += '<tr style="border-bottom:1px solid var(--border-color);">';
    html += '<th style="padding:6px 8px; text-align:left; background:var(--bg-tertiary); border-right:1px solid var(--border-color); font-weight:500; color:var(--text-secondary);">Pump Tork Düşümü <span style="color:var(--text-muted); font-weight:400;">[N·m]</span></th>';
    html += '<td style="padding:4px 6px; background:var(--bg-tertiary);"><input type="number" id="ve-tc-pump-drop-' + node.id + '" value="' + pumpTorqueDrop + '" step="0.1" min="0" style="width:100%; padding:4px; font-size:0.68rem; background:var(--bg-input); color:var(--text-primary); border:1px solid var(--border-color); border-radius:0; text-align:right;" onchange="onVEFTTCParamChange(\'' + node.id + '\')"></td>';
    html += '</tr>';
    
    html += '</table>';
    html += '</div></div>'; // sw-pkg-body + sw-pkg-card

    // ── TC VERİ TABLOSU: SR, K_pump, τ ──
    var tcTableHeight = nodeData.tcTableHeight || 180;

    html += '<div id="ve-tc-data-area-' + node.id + '" style="margin-top:10px;">';
    html += '<div class="sw-section-title">Konvertör Veri Tablosu</div>';
    html += '<div class="sw-pkg-desc" style="margin-bottom:8px;"><b>SR</b> = Türbin/Pump Devir Oranı. <b>K<sub>pump</sub></b> = Pump K-Factor [rpm/√(N·m)]. <b>τ</b> = Tork Oranı.</div>';
    html += '<div id="ve-tc-table-wrapper-' + node.id + '" style="max-height:' + tcTableHeight + 'px; overflow-y:auto; margin-bottom:0; border:1px solid var(--border-color); border-radius:0; border-bottom:none;">';
    html += '<table style="width:100%; border-collapse:collapse; font-size:0.7rem;">';
    html += '<thead style="position:sticky; top:0; background:var(--bg-tertiary); z-index:1;">';
    html += '<tr>';
    html += '<th style="padding:6px; border-bottom:1px solid var(--border-color); text-align:center;">SR<br>[-]</th>';
    html += '<th style="padding:6px; border-bottom:1px solid var(--border-color); text-align:center;">K<sub>pump</sub><br>[rpm/√Nm]</th>';
    html += '<th style="padding:6px; border-bottom:1px solid var(--border-color); text-align:center;">τ<br>[-]</th>';
    html += '<th style="padding:6px; border-bottom:1px solid var(--border-color); text-align:center; color:var(--accent-primary);">η<br>[%]</th>';
    html += '<th style="padding:6px; border-bottom:1px solid var(--border-color); width:28px;"></th>';
    html += '</tr></thead>';
    html += '<tbody id="ve-tc-table-' + node.id + '">';
    
    if(tcRows.length > 0) {
      tcRows.forEach(function(row) {
        html += getVETCRowHTML(node.id, row.sr, row.kpump, row.tau);
      });
    }
    
    html += '</tbody></table></div>';
    
    // Resize handle
    html += '<div style="height:8px; background:var(--bg-tertiary); border:1px solid var(--border-color); border-top:none; border-radius:0; cursor:ns-resize; display:flex; align-items:center; justify-content:center;" onmousedown="startVETCTableResize(event, \'' + node.id + '\')">';
    html += '<div style="width:30px; height:3px; background:var(--border-color); border-radius:0;"></div>';
    html += '</div>';
    
    // Butonlar
    html += '<div class="sw-btn-row" style="margin:8px 0;">';
    html += '<button class="sw-btn sw-btn-outline" onclick="addVETCRow(\'' + node.id + '\')">+ Satır Ekle</button>';
    html += '<button class="sw-btn sw-btn-outline" onclick="clearVETCTable(\'' + node.id + '\')">Tümünü Sil</button>';
    html += '<button class="sw-btn sw-btn-danger" onclick="deleteVETCData(\'' + node.id + '\')">Veriyi Temizle</button>';
    html += '<button class="sw-btn sw-btn-primary" onclick="saveVETCData(\'' + node.id + '\')">Kaydet</button>';
    html += '</div>';

    // Güncelle butonu
    html += '<div class="sw-btn-row" style="justify-content:flex-end; margin-bottom:2px;">';
    html += '<button class="sw-btn sw-btn-primary" style="font-size:0.56rem;padding:3px 10px;" onclick="updateVETCCharts(\'' + node.id + '\')">Güncelle</button>';
    html += '</div>';
    
    // ── GRAFİK 1: Tork Oranı & Verim Eğrisi ──
    html += '<div class="sw-pkg-card" style="margin-top:10px;">';
    html += '<div class="sw-pkg-header" style="cursor:default;"><span class="sw-pkg-name">Tork Oranı & Verim Eğrisi</span></div>';
    html += '<div class="sw-pkg-body">';
    html += '<div style="position:relative; background:var(--bg-input); border:1px solid var(--border-color); padding:4px;">';
    html += '<canvas id="ve-tc-chart-tau-' + node.id + '" style="width:100%; height:200px;"></canvas>';
    html += '</div>';
    html += '<div style="display:flex; gap:12px; justify-content:center; margin-top:4px; font-size:0.56rem; color:var(--text-muted);">';
    html += '<span style="color:#4aa3ff;">● τ Tork Oranı</span>';
    html += '<span style="color:#ff6b6b;">● η Verim [%]</span>';
    html += '<span style="color:var(--text-muted); opacity:0.5;">┆ Coupling (SR=0.88)</span>';
    html += '</div>';
    html += '</div></div>';
    
    // ── GRAFİK 2: K_pump Eğrisi ──
    html += '<div class="sw-pkg-card" style="margin-top:10px;">';
    html += '<div class="sw-pkg-header" style="cursor:default;"><span class="sw-pkg-name">K<sub>pump</sub> Eğrisi</span></div>';
    html += '<div class="sw-pkg-body">';
    html += '<div style="position:relative; background:var(--bg-input); border:1px solid var(--border-color); padding:4px;">';
    html += '<canvas id="ve-tc-chart-kpump-' + node.id + '" style="width:100%; height:180px;"></canvas>';
    html += '</div>';
    html += '<div style="display:flex; gap:12px; justify-content:center; margin-top:4px; font-size:0.56rem; color:var(--text-muted);">';
    html += '<span style="color:#a78bfa;">● K<sub>pump</sub> [rpm/√Nm]</span>';
    html += '</div>';
    html += '</div></div>';
    
    html += '</div>'; // tc-data-area close
    
  } else {
    // ── MOTOR FRENİ: Mevcut parametreler ──
    var tcRatio = nodeData.tcRatio !== undefined ? nodeData.tcRatio : 1.0;
    var isLocked = nodeData.isLocked !== undefined ? nodeData.isLocked : true;

    html += '<div class="sw-pkg-card">';
    html += '<div class="sw-pkg-header" style="cursor:default;"><span class="sw-pkg-name">Konvertör Parametreleri</span></div>';
    html += '<div class="sw-pkg-body">';
    html += '<table style="width:100%; font-size:0.68rem; border-collapse:collapse; border:1px solid var(--border-color);">';
    
    html += '<tr style="border-bottom:1px solid var(--border-color);">';
    html += '<th style="padding:8px; text-align:left; background:var(--bg-tertiary); border-right:1px solid var(--border-color); width:60%; font-weight:500; color:var(--text-secondary);">Konvertör kilidi</th>';
    html += '<td style="padding:8px; background:var(--bg-tertiary);">';
    html += '<label style="display:flex; align-items:center; gap:6px; cursor:pointer;">';
    html += '<input type="checkbox" id="ve-tc-locked-' + node.id + '" ' + (isLocked ? 'checked' : '') + ' onchange="onVETCParamChange(\'' + node.id + '\')" style="width:16px; height:16px;">';
    html += '<span style="font-size:0.7rem; color:var(--text-primary);">Kilitli</span>';
    html += '</label>';
    html += '</td>';
    html += '</tr>';
    
    html += '<tr style="border-bottom:1px solid var(--border-color);">';
    html += '<td colspan="2" style="padding:6px 8px; font-size:0.65rem; color:var(--text-secondary); background:var(--bg-secondary); line-height:1.4;">Kilitli konvertör direkt bağlantı sağlar (oran 1.0). Kilitsiz durumda tork çarpanı uygulanır.</td>';
    html += '</tr>';
    
    html += '<tr style="border-bottom:1px solid var(--border-color);">';
    html += '<th style="padding:8px; text-align:left; background:var(--bg-tertiary); border-right:1px solid var(--border-color); font-weight:500; color:var(--text-secondary);">Tork konvertörü oranı [-]</th>';
    html += '<td style="padding:8px; background:var(--bg-tertiary);"><input type="number" id="ve-tc-ratio-' + node.id + '" value="' + tcRatio + '" min="0.5" max="3" step="0.01" ' + (isLocked ? 'disabled' : '') + ' style="width:100%; padding:5px; font-size:0.7rem; background:var(--bg-input); color:var(--text-primary); border:1px solid var(--border-color); border-radius:0; text-align:right;' + (isLocked ? ' opacity:0.5; cursor:not-allowed;' : '') + '" onchange="onVETCParamChange(\'' + node.id + '\')"></td>';
    html += '</tr>';
    
    html += '<tr>';
    html += '<td colspan="2" style="padding:6px 8px; font-size:0.65rem; color:var(--text-secondary); background:var(--bg-secondary); line-height:1.4;"><b>Kilitli tork konvertörü için 1.0 giriniz.</b> Eğer tork konvertörü kilidi yoksa veya aktif değilse, dönüştürme oranını giriniz. Tipik değerler: 1.8–2.5 (düşük hızda), yaklaşık 1.0 (yüksek hızda).</td>';
    html += '</tr>';
    
    html += '</table>';
    html += '</div></div>'; // sw-pkg-body + sw-pkg-card
  }

  html += '</div>';
  return html;
}

// ===== TORK KONVERTÖRÜ PRESTLERİ =====
// Allison 3000 Product Family — EM64-A (August 2008)
// K-Factor = Torque / Speed² [N·m / rpm²]
// τ (tau) = Torque Ratio = T_turbine / T_pump
// SR = Speed Ratio = N_turbine / N_pump
// Pump Torque Deduction: 3000 family = 17.6 N·m, 3700 family = 35.3 N·m
var VE_FT_TC_PRESETS = {
  // ═══ 1000/2000 Product Family ═══
  tc210: {
    name: 'TC-210',
    family: '1000_2000',
    pumpTorqueDrop: 14.9,
    description: '1000/2000 serisi. Yüksek stall tork oranı (2.05). Geniş yelpaze, genel amaçlı.',
    data: [
      {sr:0.00, kpump:101.50, tau:2.05},
      {sr:0.10, kpump:101.91, tau:1.96},
      {sr:0.20, kpump:102.14, tau:1.85},
      {sr:0.30, kpump:103.06, tau:1.73},
      {sr:0.40, kpump:104.30, tau:1.59},
      {sr:0.46, kpump:105.36, tau:1.52},
      {sr:0.50, kpump:106.23, tau:1.49},
      {sr:0.58, kpump:107.74, tau:1.38},
      {sr:0.60, kpump:108.03, tau:1.35},
      {sr:0.68, kpump:110.61, tau:1.26},
      {sr:0.75, kpump:115.22, tau:1.16},
      {sr:0.80, kpump:119.00, tau:1.10},
      {sr:0.85, kpump:123.18, tau:1.04},
      {sr:0.88, kpump:126.62, tau:0.99},
      {sr:0.93, kpump:151.54, tau:0.96},
      {sr:0.95, kpump:174.20, tau:0.95},
      {sr:0.98, kpump:246.36, tau:0.94},
      {sr:0.99, kpump:412.23, tau:0.94}
    ]
  },
  tc211: {
    name: 'TC-211',
    family: '1000_2000',
    pumpTorqueDrop: 14.9,
    description: '1000/2000 serisi. Orta-yüksek tork çarpanı (1.90). İyi kalkış performansı.',
    data: [
      {sr:0.00, kpump:91.67, tau:1.90},
      {sr:0.10, kpump:91.12, tau:1.85},
      {sr:0.20, kpump:90.07, tau:1.74},
      {sr:0.30, kpump:88.78, tau:1.64},
      {sr:0.40, kpump:88.60, tau:1.52},
      {sr:0.49, kpump:89.49, tau:1.43},
      {sr:0.62, kpump:93.18, tau:1.30},
      {sr:0.71, kpump:95.39, tau:1.20},
      {sr:0.75, kpump:97.74, tau:1.16},
      {sr:0.80, kpump:101.74, tau:1.10},
      {sr:0.85, kpump:106.56, tau:1.04},
      {sr:0.88, kpump:109.71, tau:1.00},
      {sr:0.91, kpump:119.28, tau:0.98},
      {sr:0.92, kpump:128.17, tau:0.97},
      {sr:0.93, kpump:135.34, tau:0.97},
      {sr:0.95, kpump:170.46, tau:0.95},
      {sr:0.98, kpump:248.91, tau:0.94},
      {sr:0.99, kpump:402.54, tau:0.94}
    ]
  },
  tc221: {
    name: 'TC-221',
    family: '1000_2000',
    pumpTorqueDrop: 14.9,
    description: '1000/2000 serisi. Orta tork çarpanı (1.73). Dengeli kalkış/cruise.',
    data: [
      {sr:0.00, kpump:84.01, tau:1.73},
      {sr:0.10, kpump:83.32, tau:1.66},
      {sr:0.20, kpump:83.23, tau:1.59},
      {sr:0.30, kpump:83.00, tau:1.52},
      {sr:0.40, kpump:83.32, tau:1.46},
      {sr:0.51, kpump:83.74, tau:1.36},
      {sr:0.63, kpump:84.91, tau:1.26},
      {sr:0.71, kpump:85.52, tau:1.20},
      {sr:0.75, kpump:87.49, tau:1.16},
      {sr:0.80, kpump:90.20, tau:1.12},
      {sr:0.83, kpump:92.01, tau:1.09},
      {sr:0.85, kpump:94.39, tau:1.06},
      {sr:0.88, kpump:96.83, tau:1.04},
      {sr:0.91, kpump:103.52, tau:1.00},
      {sr:0.93, kpump:105.63, tau:0.98},
      {sr:0.95, kpump:119.85, tau:0.98},
      {sr:0.98, kpump:204.14, tau:0.97},
      {sr:0.99, kpump:266.02, tau:0.97}
    ]
  },
  tc222: {
    name: 'TC-222',
    family: '1000_2000',
    pumpTorqueDrop: 14.9,
    description: '1000/2000 serisi. Düşük tork çarpanı (1.58). Yüksek hız, düşük stall.',
    data: [
      {sr:0.00, kpump:73.13, tau:1.58},
      {sr:0.10, kpump:73.36, tau:1.56},
      {sr:0.20, kpump:73.13, tau:1.51},
      {sr:0.30, kpump:72.44, tau:1.44},
      {sr:0.40, kpump:71.80, tau:1.36},
      {sr:0.50, kpump:71.43, tau:1.29},
      {sr:0.57, kpump:71.10, tau:1.24},
      {sr:0.69, kpump:71.76, tau:1.16},
      {sr:0.76, kpump:73.44, tau:1.12},
      {sr:0.80, kpump:75.15, tau:1.10},
      {sr:0.85, kpump:79.79, tau:1.05},
      {sr:0.90, kpump:86.99, tau:1.00},
      {sr:0.93, kpump:96.23, tau:0.98},
      {sr:0.95, kpump:112.30, tau:0.98},
      {sr:0.96, kpump:122.36, tau:0.98},
      {sr:0.97, kpump:134.03, tau:0.98},
      {sr:0.98, kpump:149.82, tau:0.98},
      {sr:0.99, kpump:219.45, tau:0.98}
    ]
  },
  // ═══ 3000 Product Family ═══
  tc411: {
    name: 'TC-411',
    family: '3000',
    pumpTorqueDrop: 17.6,
    description: 'Yüksek stall tork oranı (2.71). Düşük hızlı ağır yük uygulamaları.',
    data: [
      {sr:0.00, kpump:97.98, tau:2.71},
      {sr:0.10, kpump:96.79, tau:2.49},
      {sr:0.20, kpump:95.94, tau:2.24},
      {sr:0.30, kpump:95.25, tau:2.00},
      {sr:0.40, kpump:94.95, tau:1.77},
      {sr:0.50, kpump:95.63, tau:1.55},
      {sr:0.55, kpump:96.05, tau:1.45},
      {sr:0.70, kpump:98.17, tau:1.20},
      {sr:0.75, kpump:99.42, tau:1.13},
      {sr:0.80, kpump:101.08, tau:1.05},
      {sr:0.83, kpump:103.39, tau:1.00},
      {sr:0.86, kpump:109.52, tau:0.99},
      {sr:0.88, kpump:112.73, tau:0.99},
      {sr:0.90, kpump:121.83, tau:0.99},
      {sr:0.93, kpump:135.06, tau:0.99},
      {sr:0.95, kpump:167.14, tau:0.99},
      {sr:0.98, kpump:234.67, tau:0.99},
      {sr:0.99, kpump:380.21, tau:0.99}
    ]
  },
  tc413: {
    name: 'TC-413',
    family: '3000',
    pumpTorqueDrop: 17.6,
    description: 'Yüksek tork çarpanı (2.44). Orta-ağır yük, iyi kalkış performansı.',
    data: [
      {sr:0.00, kpump:73.33, tau:2.44},
      {sr:0.10, kpump:73.04, tau:2.27},
      {sr:0.20, kpump:73.33, tau:2.09},
      {sr:0.30, kpump:73.38, tau:1.90},
      {sr:0.41, kpump:73.93, tau:1.70},
      {sr:0.50, kpump:74.87, tau:1.54},
      {sr:0.55, kpump:75.77, tau:1.46},
      {sr:0.60, kpump:77.11, tau:1.39},
      {sr:0.64, kpump:78.51, tau:1.32},
      {sr:0.70, kpump:80.66, tau:1.24},
      {sr:0.75, kpump:82.75, tau:1.17},
      {sr:0.80, kpump:85.30, tau:1.10},
      {sr:0.88, kpump:95.19, tau:0.98},
      {sr:0.90, kpump:105.00, tau:0.97},
      {sr:0.93, kpump:118.41, tau:0.97},
      {sr:0.95, kpump:143.48, tau:0.96},
      {sr:0.98, kpump:208.25, tau:0.96},
      {sr:0.99, kpump:304.85, tau:0.96}
    ]
  },
  tc415: {
    name: 'TC-415',
    family: '3000',
    pumpTorqueDrop: 17.6,
    description: 'Orta tork çarpanı (2.35). Genel amaçlı ağır hizmet uygulamaları.',
    data: [
      {sr:0.00, kpump:68.18, tau:2.35},
      {sr:0.10, kpump:68.28, tau:2.20},
      {sr:0.20, kpump:68.92, tau:2.04},
      {sr:0.30, kpump:69.42, tau:1.88},
      {sr:0.42, kpump:70.87, tau:1.67},
      {sr:0.50, kpump:72.39, tau:1.54},
      {sr:0.55, kpump:73.49, tau:1.47},
      {sr:0.60, kpump:74.95, tau:1.38},
      {sr:0.65, kpump:76.63, tau:1.31},
      {sr:0.70, kpump:78.56, tau:1.24},
      {sr:0.75, kpump:81.23, tau:1.17},
      {sr:0.80, kpump:84.27, tau:1.09},
      {sr:0.87, kpump:92.89, tau:0.99},
      {sr:0.90, kpump:99.25, tau:0.99},
      {sr:0.93, kpump:111.63, tau:0.99},
      {sr:0.95, kpump:137.92, tau:0.98},
      {sr:0.98, kpump:201.64, tau:0.98},
      {sr:0.99, kpump:329.27, tau:0.98}
    ]
  },
  tc417: {
    name: 'TC-417',
    family: '3000',
    pumpTorqueDrop: 17.6,
    description: 'Orta tork çarpanı (2.20). Dengeli kalkış/cruise performansı.',
    data: [
      {sr:0.00, kpump:60.54, tau:2.20},
      {sr:0.10, kpump:60.99, tau:2.08},
      {sr:0.20, kpump:61.88, tau:1.95},
      {sr:0.30, kpump:62.48, tau:1.82},
      {sr:0.44, kpump:64.94, tau:1.61},
      {sr:0.50, kpump:66.44, tau:1.52},
      {sr:0.56, kpump:67.90, tau:1.44},
      {sr:0.60, kpump:69.06, tau:1.38},
      {sr:0.65, kpump:70.90, tau:1.31},
      {sr:0.70, kpump:72.72, tau:1.24},
      {sr:0.76, kpump:75.52, tau:1.16},
      {sr:0.85, kpump:80.49, tau:1.04},
      {sr:0.88, kpump:83.28, tau:1.00},
      {sr:0.90, kpump:90.40, tau:0.99},
      {sr:0.93, kpump:104.13, tau:0.99},
      {sr:0.95, kpump:127.53, tau:0.99},
      {sr:0.98, kpump:180.35, tau:0.99},
      {sr:0.99, kpump:304.85, tau:0.98}
    ]
  },
  tc418: {
    name: 'TC-418',
    family: '3000',
    pumpTorqueDrop: 17.6,
    description: 'Düşük stall tork oranı (1.98). Yüksek verimli, az kayıplı tasarım.',
    data: [
      {sr:0.00, kpump:61.14, tau:1.98},
      {sr:0.10, kpump:61.83, tau:1.94},
      {sr:0.20, kpump:61.96, tau:1.88},
      {sr:0.30, kpump:62.99, tau:1.79},
      {sr:0.44, kpump:64.85, tau:1.61},
      {sr:0.50, kpump:66.25, tau:1.52},
      {sr:0.55, kpump:67.64, tau:1.45},
      {sr:0.60, kpump:69.03, tau:1.39},
      {sr:0.64, kpump:70.26, tau:1.33},
      {sr:0.70, kpump:72.52, tau:1.25},
      {sr:0.75, kpump:74.52, tau:1.18},
      {sr:0.80, kpump:76.83, tau:1.11},
      {sr:0.83, kpump:79.07, tau:1.06},
      {sr:0.88, kpump:83.25, tau:1.00},
      {sr:0.93, kpump:97.99, tau:1.00},
      {sr:0.95, kpump:116.13, tau:1.00},
      {sr:0.98, kpump:162.95, tau:0.99},
      {sr:0.99, kpump:266.09, tau:0.99}
    ]
  },
  tc419: {
    name: 'TC-419',
    family: '3000',
    pumpTorqueDrop: 17.6,
    description: 'Orta-düşük tork çarpanı (2.02). İyi cruise verimliliği.',
    data: [
      {sr:0.00, kpump:54.94, tau:2.02},
      {sr:0.10, kpump:55.58, tau:1.94},
      {sr:0.20, kpump:56.53, tau:1.84},
      {sr:0.30, kpump:58.01, tau:1.72},
      {sr:0.40, kpump:59.60, tau:1.61},
      {sr:0.46, kpump:60.80, tau:1.54},
      {sr:0.50, kpump:61.93, tau:1.48},
      {sr:0.58, kpump:63.94, tau:1.38},
      {sr:0.67, kpump:67.25, tau:1.26},
      {sr:0.75, kpump:70.47, tau:1.17},
      {sr:0.78, kpump:71.80, tau:1.14},
      {sr:0.80, kpump:72.96, tau:1.11},
      {sr:0.84, kpump:75.56, tau:1.06},
      {sr:0.89, kpump:80.33, tau:1.00},
      {sr:0.93, kpump:92.28, tau:0.99},
      {sr:0.95, kpump:114.06, tau:0.99},
      {sr:0.98, kpump:161.31, tau:0.98},
      {sr:0.99, kpump:255.05, tau:0.98}
    ]
  },
  tc421: {
    name: 'TC-421',
    family: '3000',
    pumpTorqueDrop: 17.6,
    description: 'En düşük tork çarpanı (1.77). Yüksek hızlı uygulamalar, düşük stall.',
    data: [
      {sr:0.00, kpump:47.89, tau:1.77},
      {sr:0.10, kpump:48.12, tau:1.73},
      {sr:0.20, kpump:48.88, tau:1.67},
      {sr:0.30, kpump:50.08, tau:1.59},
      {sr:0.40, kpump:51.55, tau:1.49},
      {sr:0.50, kpump:54.06, tau:1.40},
      {sr:0.60, kpump:56.81, tau:1.30},
      {sr:0.63, kpump:58.01, tau:1.26},
      {sr:0.70, kpump:60.82, tau:1.20},
      {sr:0.73, kpump:62.21, tau:1.17},
      {sr:0.80, kpump:66.51, tau:1.09},
      {sr:0.83, kpump:67.96, tau:1.07},
      {sr:0.88, kpump:73.16, tau:1.00},
      {sr:0.90, kpump:77.93, tau:1.00},
      {sr:0.93, kpump:86.87, tau:1.00},
      {sr:0.95, kpump:106.46, tau:0.99},
      {sr:0.98, kpump:154.27, tau:0.99},
      {sr:0.99, kpump:254.77, tau:0.99}
    ]
  },
  // ═══ 4000 Product Family ═══
  tc521: {
    name: 'TC-521',
    family: '4000',
    pumpTorqueDrop: 36.6,
    description: '4000 serisi. Yüksek stall tork oranı (2.42). Ağır yük, düşük hız uygulamaları.',
    data: [
      {sr:0.00, kpump:50.68, tau:2.42},
      {sr:0.10, kpump:50.84, tau:2.22},
      {sr:0.20, kpump:51.00, tau:2.03},
      {sr:0.30, kpump:51.44, tau:1.85},
      {sr:0.40, kpump:52.03, tau:1.69},
      {sr:0.42, kpump:52.23, tau:1.65},
      {sr:0.49, kpump:52.90, tau:1.54},
      {sr:0.57, kpump:54.18, tau:1.40},
      {sr:0.70, kpump:57.11, tau:1.20},
      {sr:0.75, kpump:59.18, tau:1.12},
      {sr:0.80, kpump:62.08, tau:1.04},
      {sr:0.82, kpump:63.71, tau:1.00},
      {sr:0.85, kpump:66.37, tau:1.00},
      {sr:0.88, kpump:69.30, tau:1.00},
      {sr:0.90, kpump:73.84, tau:1.00},
      {sr:0.91, kpump:76.37, tau:1.00},
      {sr:0.93, kpump:79.47, tau:1.00},
      {sr:0.95, kpump:90.73, tau:1.00}
    ]
  },
  tc531: {
    name: 'TC-531',
    family: '4000',
    pumpTorqueDrop: 36.6,
    description: '4000 serisi. Yüksek tork çarpanı (2.34). İyi kalkış, geniş çalışma aralığı.',
    data: [
      {sr:0.00, kpump:44.82, tau:2.34},
      {sr:0.10, kpump:45.37, tau:2.15},
      {sr:0.20, kpump:46.11, tau:1.98},
      {sr:0.30, kpump:47.01, tau:1.80},
      {sr:0.40, kpump:48.10, tau:1.65},
      {sr:0.44, kpump:48.68, tau:1.58},
      {sr:0.50, kpump:49.48, tau:1.49},
      {sr:0.59, kpump:51.07, tau:1.35},
      {sr:0.65, kpump:52.41, tau:1.26},
      {sr:0.70, kpump:53.85, tau:1.19},
      {sr:0.75, kpump:55.29, tau:1.11},
      {sr:0.80, kpump:57.27, tau:1.04},
      {sr:0.83, kpump:59.40, tau:1.00},
      {sr:0.85, kpump:61.53, tau:1.00},
      {sr:0.90, kpump:71.57, tau:1.00},
      {sr:0.95, kpump:101.39, tau:1.00},
      {sr:0.96, kpump:112.53, tau:1.00},
      {sr:0.98, kpump:160.17, tau:1.00}
    ]
  },
  tc541: {
    name: 'TC-541',
    family: '4000',
    pumpTorqueDrop: 36.6,
    description: '4000 serisi. Orta tork çarpanı (1.90). Dengeli performans.',
    data: [
      {sr:0.00, kpump:39.71, tau:1.90},
      {sr:0.10, kpump:40.79, tau:1.79},
      {sr:0.20, kpump:41.56, tau:1.70},
      {sr:0.30, kpump:42.94, tau:1.63},
      {sr:0.40, kpump:44.13, tau:1.56},
      {sr:0.47, kpump:45.21, tau:1.48},
      {sr:0.60, kpump:47.46, tau:1.34},
      {sr:0.69, kpump:49.07, tau:1.23},
      {sr:0.75, kpump:50.51, tau:1.16},
      {sr:0.80, kpump:51.77, tau:1.10},
      {sr:0.85, kpump:53.39, tau:1.04},
      {sr:0.89, kpump:56.07, tau:0.98},
      {sr:0.91, kpump:61.80, tau:1.00},
      {sr:0.92, kpump:64.48, tau:1.00},
      {sr:0.93, kpump:67.33, tau:1.00},
      {sr:0.94, kpump:75.16, tau:0.99},
      {sr:0.95, kpump:82.15, tau:1.00},
      {sr:0.96, kpump:95.02, tau:0.99}
    ]
  },
  tc551: {
    name: 'TC-551',
    family: '4000',
    pumpTorqueDrop: 36.6,
    description: '4000 serisi. Orta-düşük tork çarpanı (1.79). İyi cruise verimliliği.',
    data: [
      {sr:0.00, kpump:38.22, tau:1.79},
      {sr:0.10, kpump:39.18, tau:1.69},
      {sr:0.20, kpump:39.75, tau:1.60},
      {sr:0.30, kpump:41.10, tau:1.54},
      {sr:0.40, kpump:42.36, tau:1.49},
      {sr:0.50, kpump:44.11, tau:1.41},
      {sr:0.63, kpump:46.63, tau:1.27},
      {sr:0.70, kpump:48.01, tau:1.20},
      {sr:0.73, kpump:48.64, tau:1.17},
      {sr:0.75, kpump:49.16, tau:1.14},
      {sr:0.80, kpump:50.43, tau:1.09},
      {sr:0.85, kpump:52.12, tau:1.03},
      {sr:0.89, kpump:54.54, tau:0.98},
      {sr:0.90, kpump:57.65, tau:0.99},
      {sr:0.93, kpump:66.21, tau:0.99},
      {sr:0.94, kpump:74.05, tau:0.99},
      {sr:0.95, kpump:81.58, tau:0.99},
      {sr:0.96, kpump:93.68, tau:0.99}
    ]
  },
  tc561: {
    name: 'TC-561',
    family: '4000',
    pumpTorqueDrop: 36.6,
    description: '4000 serisi. Düşük tork çarpanı (1.58). Yüksek hız uygulamaları.',
    data: [
      {sr:0.00, kpump:35.41, tau:1.58},
      {sr:0.10, kpump:35.72, tau:1.54},
      {sr:0.20, kpump:36.45, tau:1.50},
      {sr:0.30, kpump:37.52, tau:1.44},
      {sr:0.40, kpump:38.91, tau:1.39},
      {sr:0.50, kpump:40.52, tau:1.31},
      {sr:0.55, kpump:41.44, tau:1.28},
      {sr:0.60, kpump:42.63, tau:1.24},
      {sr:0.67, kpump:44.45, tau:1.19},
      {sr:0.77, kpump:47.16, tau:1.11},
      {sr:0.80, kpump:48.24, tau:1.08},
      {sr:0.86, kpump:50.65, tau:1.02},
      {sr:0.88, kpump:51.77, tau:1.00},
      {sr:0.90, kpump:56.34, tau:1.00},
      {sr:0.93, kpump:64.87, tau:1.00},
      {sr:0.94, kpump:73.13, tau:1.00},
      {sr:0.95, kpump:81.46, tau:1.00},
      {sr:0.96, kpump:93.94, tau:0.99}
    ]
  },
  tc571: {
    name: 'TC-571',
    family: '4000',
    pumpTorqueDrop: 36.6,
    description: '4000 serisi. En düşük tork çarpanı (1.62). Yüksek hız, düşük stall.',
    data: [
      {sr:0.00, kpump:32.45, tau:1.62},
      {sr:0.10, kpump:32.03, tau:1.56},
      {sr:0.20, kpump:31.53, tau:1.50},
      {sr:0.30, kpump:30.99, tau:1.44},
      {sr:0.40, kpump:31.49, tau:1.38},
      {sr:0.50, kpump:32.84, tau:1.31},
      {sr:0.55, kpump:33.81, tau:1.27},
      {sr:0.60, kpump:34.80, tau:1.23},
      {sr:0.70, kpump:37.64, tau:1.14},
      {sr:0.80, kpump:41.25, tau:1.06},
      {sr:0.82, kpump:42.13, tau:1.04},
      {sr:0.86, kpump:43.94, tau:1.00},
      {sr:0.87, kpump:44.97, tau:0.99},
      {sr:0.88, kpump:46.66, tau:0.99},
      {sr:0.89, kpump:48.51, tau:0.99},
      {sr:0.90, kpump:53.50, tau:0.99},
      {sr:0.93, kpump:57.53, tau:0.99},
      {sr:0.95, kpump:68.90, tau:0.99}
    ]
  }
};

// Şanzıman ailesi değiştiğinde TC dropdown'ını yenile
function veRefreshTCDropdownForFamily() {
  var tcNode = nodes.find(function(n) { return n.type === 'torque-converter'; });
  if(!tcNode) return;
  
  // TC paneli açıksa yeniden render et
  if(selectedNodes && selectedNodes.length > 0 && selectedNodes[0].id === tcNode.id) {
    showNodeProperties(tcNode);
  } else {
    // Panel açık değilse — mevcut seçim uyumluluğunu kontrol et
    var _gbNode = nodes.find(function(n) { return n.type === 'gearbox'; });
    if(!_gbNode || !_gbNode.data) return;
    var _gbKey = _gbNode.data.ftGBPreset || _gbNode.data.selectedGearbox || '';
    if(!_gbKey || !VE_GEARBOX_PRESETS[_gbKey]) return;
    var newFamily = VE_GEARBOX_PRESETS[_gbKey].family || '';
    
    // Mevcut TC seçimi bu aileye ait mi?
    var currentTC = (tcNode.data || {}).tcPresetKey || '';
    if(currentTC && currentTC !== 'manual' && VE_FT_TC_PRESETS[currentTC]) {
      if(VE_FT_TC_PRESETS[currentTC].family !== newFamily) {
        showToast('⚠ Seçili konvertör (' + VE_FT_TC_PRESETS[currentTC].name + ') yeni şanzıman ailesiyle uyumsuz. Lütfen konvertörü güncelleyin.', 'warn');
      }
    }
  }
}

// Şanzıman ailesine göre filtrelenmiş TC key listesi döndür
function veGetFamilyTCKeys() {
  var gbNode = nodes.find(function(n) { return n.type === 'gearbox'; });
  var gbFamily = '';
  if(gbNode && gbNode.data) {
    var gbKey = gbNode.data.ftGBPreset || gbNode.data.selectedGearbox || '';
    if(gbKey && VE_GEARBOX_PRESETS[gbKey]) {
      gbFamily = VE_GEARBOX_PRESETS[gbKey].family || '';
    }
  }
  var allKeys = Object.keys(VE_FT_TC_PRESETS);
  if(!gbFamily) return allKeys.filter(function(k) { return !VE_FT_TC_PRESETS[k].incomplete; }); // Şanzıman seçilmemişse sadece veri olanlar
  return allKeys.filter(function(k) { return VE_FT_TC_PRESETS[k].family === gbFamily && !VE_FT_TC_PRESETS[k].incomplete; });
}

function onVEFTTCSelect(nodeId, value) {
  var node = nodes.find(function(n) { return n.id === nodeId; });
  if(!node) return;
  if(!node.data) node.data = {};
  
  node.data.tcPresetKey = value;
  
  var nameEl = document.getElementById('ve-tc-name-' + nodeId);
  var dropEl = document.getElementById('ve-tc-pump-drop-' + nodeId);
  var tbody = document.getElementById('ve-tc-table-' + nodeId);
  var descEl = document.getElementById('ve-tc-desc-' + nodeId);
  
  if(value && value !== 'manual' && VE_FT_TC_PRESETS[value]) {
    var preset = VE_FT_TC_PRESETS[value];
    
    // Parametreleri doldur
    if(nameEl) { nameEl.value = preset.name; node.data.tcName = preset.name; }
    if(dropEl) { dropEl.value = preset.pumpTorqueDrop; node.data.pumpTorqueDrop = preset.pumpTorqueDrop; }
    if(descEl) { descEl.textContent = preset.description || ''; }
    
    // Tabloyu doldur
    if(tbody) {
      tbody.innerHTML = '';
      preset.data.forEach(function(row) {
        var tr = document.createElement('tr');
        tr.innerHTML = getVETCRowHTML(nodeId, row.sr, row.kpump, row.tau).replace('<tr>', '').replace('</tr>', '');
        tbody.appendChild(tr);
      });
    }
    node.data.tcData = JSON.parse(JSON.stringify(preset.data));
    
    // Grafikleri güncelle
    setTimeout(function() { updateVETCCharts(nodeId); }, 50);
    showToast(preset.name + ' verileri yüklendi (' + preset.data.length + ' nokta)');
    
  } else if(value === 'manual') {
    // Manuel: temizle
    if(nameEl) { nameEl.value = ''; node.data.tcName = ''; }
    if(dropEl) { dropEl.value = 0; node.data.pumpTorqueDrop = 0; }
    if(descEl) { descEl.textContent = ''; }
    if(tbody) {
      tbody.innerHTML = '';
      for(var i = 0; i < 5; i++) addVETCRow(nodeId);
    }
    node.data.tcData = [];
  } else {
    if(descEl) descEl.textContent = '';
  }
}

// ===== TORK KONVERTÖRÜ TABLO FONKSİYONLARI (Tam Gaz) =====

function getVETCRowHTML(nodeId, sr, kpump, tau) {
  var html = '<tr>';
  html += '<td style="padding:3px; border-bottom:1px solid var(--border-color);"><input type="number" value="' + (sr !== undefined && sr !== '' ? sr : '') + '" step="0.01" min="0" max="1" style="width:100%; padding:4px; font-size:0.7rem; background:var(--bg-input); color:var(--text-primary); border:1px solid var(--border-color); border-radius:0; text-align:center;" onchange="onVETCDataChange(\'' + nodeId + '\')" oninput="onVETCDataChange(\'' + nodeId + '\')"></td>';
  html += '<td style="padding:3px; border-bottom:1px solid var(--border-color);"><input type="number" value="' + (kpump !== undefined && kpump !== '' ? kpump : '') + '" step="0.01" min="0" style="width:100%; padding:4px; font-size:0.7rem; background:var(--bg-input); color:var(--text-primary); border:1px solid var(--border-color); border-radius:0; text-align:center;" onchange="onVETCDataChange(\'' + nodeId + '\')"></td>';
  html += '<td style="padding:3px; border-bottom:1px solid var(--border-color);"><input type="number" value="' + (tau !== undefined && tau !== '' ? tau : '') + '" step="0.001" min="0" style="width:100%; padding:4px; font-size:0.7rem; background:var(--bg-input); color:var(--text-primary); border:1px solid var(--border-color); border-radius:0; text-align:center;" onchange="onVETCDataChange(\'' + nodeId + '\')" oninput="onVETCDataChange(\'' + nodeId + '\')"></td>';
  var etaVal = (sr !== '' && sr !== undefined && tau !== '' && tau !== undefined) ? (parseFloat(sr) * parseFloat(tau) * 100) : '';
  var etaStr = (!isNaN(etaVal) && etaVal !== '') ? etaVal.toFixed(1) : '';
  html += '<td style="padding:3px; border-bottom:1px solid var(--border-color);"><input type="text" value="' + etaStr + '" readonly style="width:100%; padding:4px; font-size:0.7rem; background:transparent; color:var(--accent-primary); border:1px solid var(--border-color); border-radius:0; text-align:center; cursor:default; font-weight:500;" tabindex="-1"></td>';
  html += '<td style="padding:3px; border-bottom:1px solid var(--border-color); text-align:center;"><button onclick="removeVETCRow(this, \'' + nodeId + '\')" style="padding:2px 6px; font-size:0.6rem; background:var(--accent-danger); color:white; border:none; border-radius:0; cursor:pointer;" title="Satırı sil">×</button></td>';
  html += '</tr>';
  return html;
}

function addVETCRow(nodeId) {
  var tbody = document.getElementById('ve-tc-table-' + nodeId);
  if(!tbody) return;
  var tr = document.createElement('tr');
  tr.innerHTML = getVETCRowHTML(nodeId, '', '', '').replace('<tr>', '').replace('</tr>', '');
  tbody.appendChild(tr);
}

function removeVETCRow(btn, nodeId) {
  var tr = btn.closest('tr');
  if(tr) {
    tr.remove();
    onVETCDataChange(nodeId);
  }
}

function clearVETCTable(nodeId) {
  var tbody = document.getElementById('ve-tc-table-' + nodeId);
  if(!tbody) return;
  tbody.innerHTML = '';
  for(var i = 0; i < 5; i++) addVETCRow(nodeId);
  onVETCDataChange(nodeId);
  showToast('TC tablosu temizlendi');
}

function deleteVETCData(nodeId) {
  var node = nodes.find(function(n) { return n.id === nodeId; });
  if(!node) return;
  if(!node.data) node.data = {};
  node.data.tcData = [];
  var tbody = document.getElementById('ve-tc-table-' + nodeId);
  if(tbody) tbody.innerHTML = '';
  showToast('TC verisi silindi');
}

function saveVETCData(nodeId) {
  onVETCDataChange(nodeId);
  var node = nodes.find(function(n) { return n.id === nodeId; });
  if(!node || !node.data || !node.data.tcData || node.data.tcData.length === 0) {
    showToast('Kaydedilecek veri yok', 'error');
    return;
  }
  showToast('TC verisi kaydedildi (' + node.data.tcData.length + ' satır)');
}

function onVETCDataChange(nodeId) {
  var tbody = document.getElementById('ve-tc-table-' + nodeId);
  if(!tbody) return;
  
  var node = nodes.find(function(n) { return n.id === nodeId; });
  if(!node) return;
  if(!node.data) node.data = {};
  
  var tcData = [];
  var rows = tbody.querySelectorAll('tr');
  rows.forEach(function(tr) {
    var inputs = tr.querySelectorAll('input');
    if(inputs.length >= 4) {
      var sr = parseFloat(inputs[0].value);
      var kpump = parseFloat(inputs[1].value);
      var tau = parseFloat(inputs[2].value);
      // η hesapla ve readonly alana yaz
      var eta = (!isNaN(sr) && !isNaN(tau)) ? (sr * tau * 100) : NaN;
      inputs[3].value = !isNaN(eta) ? eta.toFixed(1) : '';
      
      if(!isNaN(sr) || !isNaN(kpump) || !isNaN(tau)) {
        tcData.push({
          sr: isNaN(sr) ? null : sr,
          kpump: isNaN(kpump) ? null : kpump,
          tau: isNaN(tau) ? null : tau
        });
      }
    }
  });
  node.data.tcData = tcData;
  updateVETCCharts(nodeId);
}

// ===== TC GRAFİKLERİ =====
function updateVETCCharts(nodeId) {
  var node = nodes.find(function(n) { return n.id === nodeId; });
  if(!node) return;
  var tcData = (node.data && node.data.tcData) || [];
  
  // Geçerli veriyi filtrele
  var pts = [];
  tcData.forEach(function(d) {
    if(d.sr !== null && d.tau !== null && d.kpump !== null) {
      pts.push({sr: d.sr, kpump: d.kpump, tau: d.tau, eta: d.sr * d.tau * 100});
    }
  });
  pts.sort(function(a, b) { return a.sr - b.sr; });
  
  drawVETCTauChart(nodeId, pts);
  drawVETCKpumpChart(nodeId, pts);
}

function drawVETCTauChart(nodeId, pts) {
  var canvas = document.getElementById('ve-tc-chart-tau-' + nodeId);
  if(!canvas) return;
  
  var rect = canvas.getBoundingClientRect();
  canvas.width = rect.width * 2;
  canvas.height = 200 * 2;
  canvas.style.height = '200px';
  var ctx = canvas.getContext('2d');
  ctx.scale(2, 2);
  ctx.clearRect(0, 0, rect.width, 200);
  
  var margin = {left: 45, right: 45, top: 20, bottom: 30};
  var pw = rect.width - margin.left - margin.right;
  var ph = 200 - margin.top - margin.bottom;
  
  if(pts.length < 2) {
    ctx.fillStyle = '#666'; ctx.font = '12px system-ui'; ctx.textAlign = 'center';
    ctx.fillText('En az 2 veri noktası gerekli', rect.width / 2, 100);
    return;
  }
  
  // Eksen aralıkları
  var xMin = 0, xMax = 1.0;
  var tauMax = Math.max.apply(null, pts.map(function(p) { return p.tau; })) * 1.15;
  var etaMax = Math.min(110, Math.max.apply(null, pts.map(function(p) { return p.eta; })) * 1.15);
  
  function xS(x) { return margin.left + (x - xMin) / (xMax - xMin) * pw; }
  function yT(y) { return margin.top + ph - y / tauMax * ph; }
  function yE(y) { return margin.top + ph - y / etaMax * ph; }
  
  // Grid
  ctx.strokeStyle = 'rgba(255,255,255,0.05)'; ctx.lineWidth = 1;
  for(var i = 0; i <= 5; i++) {
    var gy = margin.top + ph * i / 5;
    ctx.beginPath(); ctx.moveTo(margin.left, gy); ctx.lineTo(margin.left + pw, gy); ctx.stroke();
  }
  
  // Coupling dikey çizgi (SR = 0.88)
  var couplingX = xS(0.88);
  ctx.strokeStyle = 'rgba(255,255,255,0.25)'; ctx.lineWidth = 1; ctx.setLineDash([5, 4]);
  ctx.beginPath(); ctx.moveTo(couplingX, margin.top); ctx.lineTo(couplingX, margin.top + ph); ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = 'rgba(255,255,255,0.4)'; ctx.font = '8px system-ui'; ctx.textAlign = 'center';
  ctx.fillText('Coupling', couplingX, margin.top - 5);
  
  // Sol eksen (τ) - Mavi
  ctx.strokeStyle = '#4aa3ff'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(margin.left, margin.top); ctx.lineTo(margin.left, margin.top + ph); ctx.stroke();
  // Sağ eksen (η) - Kırmızı
  ctx.strokeStyle = '#ff6b6b';
  ctx.beginPath(); ctx.moveTo(margin.left + pw, margin.top); ctx.lineTo(margin.left + pw, margin.top + ph); ctx.stroke();
  // Alt eksen
  ctx.strokeStyle = '#444';
  ctx.beginPath(); ctx.moveTo(margin.left, margin.top + ph); ctx.lineTo(margin.left + pw, margin.top + ph); ctx.stroke();
  
  // X etiketleri
  ctx.fillStyle = '#888'; ctx.font = '9px system-ui'; ctx.textAlign = 'center';
  for(var i = 0; i <= 5; i++) {
    var xv = i * 0.2;
    ctx.fillText(xv.toFixed(1), xS(xv), margin.top + ph + 15);
  }
  ctx.fillText('SR [-]', margin.left + pw / 2, 200 - 5);
  
  // Sol Y etiketleri (τ)
  ctx.fillStyle = '#4aa3ff'; ctx.textAlign = 'right';
  for(var i = 0; i <= 4; i++) { var yv = tauMax * i / 4; ctx.fillText(yv.toFixed(1), margin.left - 5, yT(yv) + 3); }
  
  // Sağ Y etiketleri (η)
  ctx.fillStyle = '#ff6b6b'; ctx.textAlign = 'left';
  for(var i = 0; i <= 4; i++) { var yv = etaMax * i / 4; ctx.fillText(Math.round(yv), margin.left + pw + 5, yE(yv) + 3); }
  
  // τ eğrisi
  ctx.strokeStyle = '#4aa3ff'; ctx.lineWidth = 2.5; ctx.beginPath();
  pts.forEach(function(p, i) { var x = xS(p.sr), y = yT(p.tau); if(i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y); });
  ctx.stroke();
  ctx.fillStyle = '#4aa3ff';
  pts.forEach(function(p) { ctx.beginPath(); ctx.arc(xS(p.sr), yT(p.tau), 3.5, 0, Math.PI * 2); ctx.fill(); });
  
  // η eğrisi
  ctx.strokeStyle = '#ff6b6b'; ctx.lineWidth = 2.5; ctx.beginPath();
  pts.forEach(function(p, i) { var x = xS(p.sr), y = yE(p.eta); if(i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y); });
  ctx.stroke();
  ctx.fillStyle = '#ff6b6b';
  pts.forEach(function(p) { ctx.beginPath(); ctx.arc(xS(p.sr), yE(p.eta), 3.5, 0, Math.PI * 2); ctx.fill(); });
}

function drawVETCKpumpChart(nodeId, pts) {
  var canvas = document.getElementById('ve-tc-chart-kpump-' + nodeId);
  if(!canvas) return;
  
  var rect = canvas.getBoundingClientRect();
  canvas.width = rect.width * 2;
  canvas.height = 180 * 2;
  canvas.style.height = '180px';
  var ctx = canvas.getContext('2d');
  ctx.scale(2, 2);
  ctx.clearRect(0, 0, rect.width, 180);
  
  var margin = {left: 50, right: 20, top: 20, bottom: 30};
  var pw = rect.width - margin.left - margin.right;
  var ph = 180 - margin.top - margin.bottom;
  
  if(pts.length < 2) {
    ctx.fillStyle = '#666'; ctx.font = '12px system-ui'; ctx.textAlign = 'center';
    ctx.fillText('En az 2 veri noktası gerekli', rect.width / 2, 90);
    return;
  }
  
  var xMin = 0, xMax = 1.0;
  var kMin = Math.min.apply(null, pts.map(function(p) { return p.kpump; })) * 0.9;
  var kMax = Math.max.apply(null, pts.map(function(p) { return p.kpump; })) * 1.1;
  
  function xS(x) { return margin.left + (x - xMin) / (xMax - xMin) * pw; }
  function yS(y) { return margin.top + ph - (y - kMin) / (kMax - kMin) * ph; }
  
  // Grid
  ctx.strokeStyle = 'rgba(255,255,255,0.05)'; ctx.lineWidth = 1;
  for(var i = 0; i <= 5; i++) {
    var gy = margin.top + ph * i / 5;
    ctx.beginPath(); ctx.moveTo(margin.left, gy); ctx.lineTo(margin.left + pw, gy); ctx.stroke();
  }
  
  // Sol eksen
  ctx.strokeStyle = '#a78bfa'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(margin.left, margin.top); ctx.lineTo(margin.left, margin.top + ph); ctx.stroke();
  // Alt eksen
  ctx.strokeStyle = '#444';
  ctx.beginPath(); ctx.moveTo(margin.left, margin.top + ph); ctx.lineTo(margin.left + pw, margin.top + ph); ctx.stroke();
  
  // X etiketleri
  ctx.fillStyle = '#888'; ctx.font = '9px system-ui'; ctx.textAlign = 'center';
  for(var i = 0; i <= 5; i++) {
    var xv = i * 0.2;
    ctx.fillText(xv.toFixed(1), xS(xv), margin.top + ph + 15);
  }
  ctx.fillText('SR [-]', margin.left + pw / 2, 180 - 5);
  
  // Y etiketleri
  ctx.fillStyle = '#a78bfa'; ctx.textAlign = 'right';
  for(var i = 0; i <= 4; i++) {
    var yv = kMin + (kMax - kMin) * i / 4;
    ctx.fillText(yv.toFixed(1), margin.left - 5, yS(yv) + 3);
  }
  
  // K_pump eğrisi
  ctx.strokeStyle = '#a78bfa'; ctx.lineWidth = 2.5; ctx.beginPath();
  pts.forEach(function(p, i) { var x = xS(p.sr), y = yS(p.kpump); if(i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y); });
  ctx.stroke();
  ctx.fillStyle = '#a78bfa';
  pts.forEach(function(p) { ctx.beginPath(); ctx.arc(xS(p.sr), yS(p.kpump), 3.5, 0, Math.PI * 2); ctx.fill(); });
}

// TC tablo resize
var veTCTableResizing = null;

function startVETCTableResize(e, nodeId) {
  e.preventDefault();
  veTCTableResizing = {
    nodeId: nodeId,
    startY: e.clientY,
    startHeight: document.getElementById('ve-tc-table-wrapper-' + nodeId).offsetHeight
  };
  document.addEventListener('mousemove', doVETCTableResize);
  document.addEventListener('mouseup', stopVETCTableResize);
}

function doVETCTableResize(e) {
  if(!veTCTableResizing) return;
  var wrapper = document.getElementById('ve-tc-table-wrapper-' + veTCTableResizing.nodeId);
  if(!wrapper) return;
  var newHeight = veTCTableResizing.startHeight + (e.clientY - veTCTableResizing.startY);
  newHeight = Math.max(80, Math.min(400, newHeight));
  wrapper.style.maxHeight = newHeight + 'px';
  var node = nodes.find(function(n) { return n.id === veTCTableResizing.nodeId; });
  if(node) { if(!node.data) node.data = {}; node.data.tcTableHeight = newHeight; }
}

function stopVETCTableResize() {
  veTCTableResizing = null;
  document.removeEventListener('mousemove', doVETCTableResize);
  document.removeEventListener('mouseup', stopVETCTableResize);
}

// Tam Gaz — Tork konvertörü parametre değişikliği
function onVEFTTCParamChange(nodeId) {
  var node = nodes.find(function(n) { return n.id === nodeId; });
  if(!node) return;
  if(!node.data) node.data = {};
  
  var nameEl = document.getElementById('ve-tc-name-' + nodeId);
  var dropEl = document.getElementById('ve-tc-pump-drop-' + nodeId);
  
  if(nameEl) node.data.tcName = nameEl.value;
  if(dropEl) node.data.pumpTorqueDrop = parseFloat(dropEl.value) || 0;
}

// Tork konvertörü parametre değişikliği
function onVETCParamChange(nodeId) {
  var node = nodes.find(function(n) { return n.id === nodeId; });
  if(!node) return;
  
  var lockedEl = document.getElementById('ve-tc-locked-' + nodeId);
  var ratioEl = document.getElementById('ve-tc-ratio-' + nodeId);
  
  if(!node.data) node.data = {};
  
  if(lockedEl) {
    node.data.isLocked = lockedEl.checked;
    if(ratioEl) {
      ratioEl.disabled = lockedEl.checked;
      ratioEl.style.opacity = lockedEl.checked ? '0.5' : '1';
      ratioEl.style.cursor = lockedEl.checked ? 'not-allowed' : 'text';
      if(lockedEl.checked) {
        ratioEl.value = '1';
        node.data.tcRatio = 1.0;
      }
    }
  }
  
  if(ratioEl && !lockedEl.checked) {
    var n = parseFloat(ratioEl.value); node.data.tcRatio = isNaN(n) ? 1.0 : n;
  }
}

