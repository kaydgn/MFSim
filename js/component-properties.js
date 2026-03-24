// ============================================================================
// INFO POPUP SİSTEMİ
// ============================================================================
var infoPopupData = {
  'motorVerileri': {
    title: 'Motor Verileri Hakkında',
    content: 'Bu bölümde motor freni veya motor tork-güç değerlerini girebilirsiniz. Bilgi içeriği kullanıcı tarafından düzenlenecek.'
  },
  'torkGucEgrisi': {
    title: 'Tork & Güç Eğrisi Hakkında',
    content: 'Girilen veriler grafiksel olarak gösterilir. Bilgi içeriği kullanıcı tarafından düzenlenecek.'
  },
  'egriYaklaşımı': {
    title: 'Eğri Yaklaşımı Hakkında',
    content: 'Verilerinize en uygun matematiksel modeli seçebilirsiniz. Bilgi içeriği kullanıcı tarafından düzenlenecek.'
  },
  'motorFreniParametreleri': {
    title: 'Motor Freni Parametreleri Hakkında',
    content: 'Motor freni verim ve governed RPM değerlerini ayarlayabilirsiniz. Bilgi içeriği kullanıcı tarafından düzenlenecek.'
  },
  'sanzimanVerileri': {
    title: 'Şanzıman Verileri Hakkında',
    content: 'Bu bölümde şanzıman vites oranlarını tanımlayabilirsiniz. Hazır şanzıman presetlerinden birini seçebilir veya manuel olarak kendi değerlerinizi girebilirsiniz. Her vites için oran ve isteğe bağlı not ekleyebilirsiniz.'
  },
  'testVitesi': {
    title: 'Test Başlangıç Vitesi Hakkında',
    content: 'Motor freni testinin hangi viteste başladığını belirler. Şanzıman verilerini girdikten sonra bu listeden ilgili vitesi seçin. Seçilen vitesin oranı otomatik olarak hesaplamalarda kullanılacaktır.'
  },
  'torkKonvertoru': {
    title: 'Tork Konvertörü Hakkında',
    content: 'Tork konvertörü, motor ile şanzıman arasında hidrolik bağlantı sağlar. Kilitli konvertör direkt mekanik bağlantı sağlar (oran 1.0). Kilitsiz durumda ise düşük hızlarda tork çarpanı (1.8-2.5), yüksek hızlarda ise yaklaşık 1.0 oran uygulanır.'
  },
  'ecMatching': {
    title: 'Motor-TC Eşleştirme Analizi Hakkında',
    content: 'Allison TD-148G standardına göre motor ile tüm mevcut tork konvertörlerinin uyumluluğunu otomatik analiz eder. C4 (Stall Speed), C5 (Min Motor Devri), C7 (Türbin Torku Limiti) ve C8 (SR @ Governed) kontrollerini uygulayarak en uygun konvertörü önerir.'
  },
  'transferKutusu': {
    title: 'Transfer Kutusu Hakkında',
    content: 'Transfer kutusu, çift kademe (High/Low) veya tek kademe olabilir. High kademe genellikle 1:1 oranında (veya çok yakın), Low kademe ise 2-3 kat daha yüksek orandadır. Arazi koşullarında Low kademe kullanılır.'
  },
  'diferansiyel': {
    title: 'Diferansiyel Hakkında',
    content: 'Diferansiyel (son tahrik), dönme hareketini tekerleklere aktarır ve virajlarda iç/dış tekerlek hız farkını sağlar. Diferansiyel oranı, motor devri ile tekerlek devri arasındaki son dönüşüm oranıdır.'
  },
  'propshaftVerileri': {
    title: 'Propşaft Hakkında',
    content: 'Propşaft (kardan mili), şanzıman çıkışı ile transfer kutusu veya transfer kutusu ile diferansiyel arasında tork aktarımı sağlayan güç aktarma milidir. Oran 1:1 olarak çalışır, sadece kardan mafsalı ve yatak kayıplarından kaynaklanan verim kaybı uygulanır.'
  },
  'tekerlek': {
    title: 'Tekerlek Parametreleri Hakkında',
    content: 'Tekerlek yarıçapı, hız ve devir hesaplamalarında kritiktir. Yuvarlanma direnci (Crr) yol yüzeyine ve lastik tipine bağlıdır. Döner kütle faktörü (δ), dönen parçaların ataletini hesaba katar.'
  }
};

function showInfoPopup(infoKey) {
  var info = infoPopupData[infoKey];
  if(!info) return;
  
  // Mevcut popup varsa kaldır
  var existingPopup = document.getElementById('ve-info-popup');
  if(existingPopup) existingPopup.remove();
  
  var popup = document.createElement('div');
  popup.id = 've-info-popup';
  popup.style.cssText = 'position:fixed; top:50%; left:50%; transform:translate(-50%,-50%); background:var(--bg-secondary); border:1px solid var(--border-color); border-radius:12px; box-shadow:0 8px 32px rgba(0,0,0,0.4); z-index:10005; max-width:400px; padding:20px;';
  
  popup.innerHTML = '<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">' +
    '<h3 style="margin:0; font-size:1rem; color:var(--text-heading);">' + info.title + '</h3>' +
    '<button onclick="closeInfoPopup()" style="background:none; border:none; color:var(--text-muted); cursor:pointer; font-size:1.2rem;">✕</button>' +
    '</div>' +
    '<p style="margin:0; font-size:0.85rem; color:var(--text-secondary); line-height:1.5;">' + info.content + '</p>';
  
  // Arka plan overlay
  var overlay = document.createElement('div');
  overlay.id = 've-info-overlay';
  overlay.style.cssText = 'position:fixed; top:0; left:0; right:0; bottom:0; background:rgba(0,0,0,0.5); z-index:10004;';
  overlay.onclick = closeInfoPopup;
  
  document.body.appendChild(overlay);
  document.body.appendChild(popup);
}

function closeInfoPopup() {
  var popup = document.getElementById('ve-info-popup');
  var overlay = document.getElementById('ve-info-overlay');
  if(popup) popup.remove();
  if(overlay) overlay.remove();
}

function deleteConnection(connId) {
  var conn = connections.find(function(c) { return c.id === connId; });
  if(!conn) return;
  
  // Bu bağlantıya bağlı sensörleri kopar
  nodes.forEach(function(n) {
    if(n.type === 'sensor' && n.data && n.data.attachedConnection === connId) {
      n.data.attachedConnection = '';
      n.data.selectedSignal = '';
    }
  });
  
  connections = connections.filter(function(c) { return c.id !== connId; });
  
  // Port işaretlerini güncelle
  updatePortStatus(conn.from);
  updatePortStatus(conn.to);
  
  updateAllConnections();
  updateNodeCount();
}

function updatePortStatus(nodeId) {
  var hasOutput = connections.some(function(c) { return c.from === nodeId; });
  var hasInput = connections.some(function(c) { return c.to === nodeId; });
  
  var outPort = document.querySelector('#' + nodeId + ' .ve-node-port.output');
  var inPort = document.querySelector('#' + nodeId + ' .ve-node-port.input');
  
  if(outPort) outPort.classList.toggle('connected', hasOutput);
  if(inPort) inPort.classList.toggle('connected', hasInput);
}

function addToSelection(node) {
  if(selectedNodes.indexOf(node) === -1) {
    selectedNodes.push(node);
  }
  var el = document.getElementById(node.id);
  if(el) el.classList.add('selected');
  
  if(selectedNodes.length === 1) {
    showNodeProperties(node);
  } else {
    showMultipleSelection();
  }
}

function clearSelection() {
  selectedNodes.forEach(function(n) {
    var el = document.getElementById(n.id);
    if(el) el.classList.remove('selected');
  });
  selectedNodes = [];
  if(typeof clearAnnotationSelection === 'function') clearAnnotationSelection();
  showEmptyProperties();
}

function showNodeProperties(node) {
  var content = document.querySelector('.ve-properties-content');
  var propertiesPanel = document.querySelector('.ve-properties');
  if(!content) return;
  
  // Panel genişliğini KORUYORUZ - kullanıcı değiştirmedikçe dokunmuyoruz
  // Sadece ilk açılışta varsayılan genişlik ayarlanır
  
  var html = '<div style="position:relative; text-align:center; margin-bottom:12px;">';
  html += node.def.svg.replace('width="50"', 'width="50"').replace('height="50"', 'height="50"');
  html += '<button onclick="deleteSelectedNodes()" style="position:absolute; top:-4px; right:-4px; width:22px; height:22px; border-radius:50%; background:var(--accent-danger); color:white; border:none; cursor:pointer; font-size:0.65rem; display:flex; align-items:center; justify-content:center; opacity:0.7; transition:opacity 0.15s;" onmouseenter="this.style.opacity=1" onmouseleave="this.style.opacity=0.7" title="Bileşeni Sil">🗑️</button>';
  html += '</div>';
  var displayName = node.customName || node.def.name;
  html += '<div style="font-weight:600; color:var(--text-heading); margin-bottom:4px; text-align:center; display:flex; align-items:center; justify-content:center; gap:6px;">';
  html += '<span id="ve-node-name-display-' + node.id + '">' + displayName + '</span>';
  html += '<button onclick="veEditNodeName(\'' + node.id + '\')" style="width:18px; height:18px; border:none; background:none; cursor:pointer; font-size:0.7rem; opacity:0.6; padding:0;" title="İsmi düzenle">✏️</button>';
  html += '</div>';
  html += '<div style="font-size:0.7rem; color:var(--text-muted); margin-bottom:12px; text-align:center;">ID: ' + node.id + '</div>';
  
  // Node tipine göre özel içerik
  if(node.type === 'engine') {
    html += getEnginePropertiesHTML(node);
  } else if(node.type === 'gearbox') {
    html += getGearboxPropertiesHTML(node);
  } else if(node.type === 'shift-controller') {
    html += getShiftControllerPropertiesHTML(node);
  } else if(node.type === 'torque-converter') {
    html += getTorqueConverterPropertiesHTML(node);
  } else if(node.type === 'ec-matching') {
    html += getECMatchingPropertiesHTML(node);
  } else if(node.type === 'engine-gearbox-matching') {
    html += getEngineGearboxMatchingHTML(node);
  } else if(node.type === 'transfer') {
    html += getTransferPropertiesHTML(node);
  } else if(node.type === 'propshaft') {
    html += getPropshaftPropertiesHTML(node);
  } else if(node.type === 'differential') {
    html += getDifferentialPropertiesHTML(node);
  } else if(node.type === 'wheel') {
    html += getWheelPropertiesHTML(node);
  } else if(node.type === 'vehicle') {
    html += getVehiclePropertiesHTML(node);
  } else if(node.type === 'sensor') {
    html += getSensorPropertiesHTML(node);
  } else if(node.type === 'scenario') {
    html += getScenarioPropertiesHTML(node);
  } else if(node.type === 'coast-down') {
    html += getCoastDownPropertiesHTML(node);
  } else if(node.type === 'obstacle-crossing') {
    html += getObstacleCrossingPropertiesHTML(node);
  } else if(node.type === 'solver') {
    html += getSolverPropertiesHTML(node);
  } else if(node.type === 'road') {
    html += getRoadPropertiesHTML(node);
  } else if(node.type === 'parametric') {
    html += getParametricPropertiesHTML(node);
  } else if(node.type === 'sensor-wizard') {
    html += getSensorWizardPropertiesHTML(node);
  } else if(node.type === 'terminator') {
    html += getTerminatorPropertiesHTML(node);
  } else if(node.type === 'gear-shift') {
    html += getGearShiftPropertiesHTML(node);
  } else {
    html += getDefaultPropertiesHTML(node);
  }
  
  
  content.innerHTML = html;
  
  // Motor bileşeni için grafik çiz ve kategori dropdown'ı doldur
  if(node.type === 'engine') {
    setTimeout(function() {
      // Kategori dropdown'ını doldur
      onVEMotorCategoryChange(node.id);
      // Grafiği güncelle
      updateVEMotorChart(node.id);
    }, 100);
  }
  
  // Tork konvertörü grafikleri
  if(node.type === 'torque-converter' && veActiveModule === 'full-throttle') {
    setTimeout(function() {
      updateVETCCharts(node.id);
    }, 100);
  }
  
  // Motor-TC Eşleştirme bileşeni: analizi çalıştır
  if(node.type === 'ec-matching') {
    setTimeout(function() {
      runECMatchingAnalysis(node.id);
    }, 150);
  }
  // Motor-Şanzıman Eşleştirme bileşeni: analizi çalıştır
  if(node.type === 'engine-gearbox-matching') {
    setTimeout(function() {
      runEngineGearboxMatchingAnalysis(node.id);
    }, 150);
  }
  
  // Yol/Ortam bileşeni: Leaflet haritayı otomatik yükle
  if(node.type === 'road') {
    setTimeout(function() {
      veInitRoadMap(node.id);
    }, 400);
  }
}

// Motor / Motor Freni özellikleri - TAM VERSİYON
function getEnginePropertiesHTML(node) {
  var nodeData = node.data || {};
  var rows = nodeData.torqueData || [];
  var verim = nodeData.verim || 100;
  var governedRpm = nodeData.governedRpm || 2100;
  var fitMethod = nodeData.fitMethod || 'linear';
  var polyDegree = nodeData.polyDegree || 5;
  var tableHeight = nodeData.tableHeight || 180;
  var hasData = rows.length > 0;
  
  var isFullThrottle = veActiveModule === 'full-throttle';
  
  var html = '<div style="border-top:1px solid var(--border-color); padding-top:12px;">';
  
  // ===== MOTOR VERİLERİ =====
  html += '<div style="font-size:0.8rem; font-weight:600; color:var(--text-heading); margin-bottom:8px; display:flex; align-items:center; gap:6px;">';
  html += '<span>Motor Verileri</span>';
  html += '<button onclick="showInfoPopup(\'motorVerileri\')" style="width:18px; height:18px; border-radius:50%; background:var(--accent-primary); color:white; border:none; cursor:pointer; font-size:0.65rem; display:flex; align-items:center; justify-content:center;" title="Bilgi">?</button>';
  html += '</div>';
  
  if(isFullThrottle) {
    // ── TAM GAZ HIZLANMA ──
    html += '<p style="font-size:0.68rem; color:var(--text-muted); margin-bottom:10px; line-height:1.4;">Motorun tam gaz brüt tork ve güç değerlerini girin veya kayıtlı bir motor seçin.</p>';
    
    // Motor seçici
    var savedPreset = nodeData.ftMotorPreset || '';
    html += '<div style="display:flex; gap:6px; margin-bottom:8px; align-items:center;">';
    html += '<select id="ve-ft-motor-select-' + node.id + '" onchange="onVEFTMotorSelect(\'' + node.id + '\', this.value)" style="flex:1; font-size:0.7rem; padding:4px 6px; background:var(--bg-input); color:var(--text-primary); border:1px solid var(--border-color); border-radius:4px;">';
    html += '<option value="">-- Motor Seçiniz (' + Object.keys(VE_FT_MOTOR_PRESETS).length + ' preset) --</option>';
    // Aile bazlı gruplama
    var _ftFamilies = [
      {label: 'BMC / AZRA', prefix: ['azra_', 'bmc_']},
      {label: 'Cummins ISB 4.5L', prefix: ['isb45']},
      {label: 'Cummins ISB 6.7L', prefix: ['isb67']},
      {label: 'Cummins ISL 8.9L', prefix: ['isl']},
      {label: 'Cummins ISG 12L', prefix: ['isg']},
      {label: 'Cummins ISM 10.8L', prefix: ['ism']},
      {label: 'Cummins ISX 15L', prefix: ['isx']},
      {label: 'Diğer', prefix: []}
    ];
    var _ftUsed = {};
    _ftFamilies.forEach(function(fam) {
      var keys = Object.keys(VE_FT_MOTOR_PRESETS).filter(function(k) {
        if(_ftUsed[k]) return false;
        if(fam.prefix.length === 0) return true;
        return fam.prefix.some(function(p) { return k.indexOf(p) === 0; });
      });
      if(keys.length === 0) return;
      html += '<optgroup label="' + fam.label + ' (' + keys.length + ')">';
      keys.forEach(function(key) {
        _ftUsed[key] = true;
        var sel = (key === savedPreset) ? ' selected' : '';
        html += '<option value="' + key + '"' + sel + '>' + VE_FT_MOTOR_PRESETS[key].name + '</option>';
      });
      html += '</optgroup>';
    });
    var manualSel = (savedPreset === '__new__') ? ' selected' : '';
    html += '<option value="__new__"' + manualSel + '>+ Manuel Giriş</option>';
    html += '</select>';
    html += '</div>';
    
    // Placeholder (veri yoksa)
    html += '<div id="ve-motor-placeholder-' + node.id + '" style="display:' + (hasData ? 'none' : 'block') + '; padding:20px; text-align:center; background:var(--bg-tertiary); border-radius:8px; margin-bottom:12px;">';
    html += '<div style="font-size:1.5rem; margin-bottom:8px;">⚡</div>';
    html += '<div style="font-size:0.75rem; color:var(--text-muted);">Yukarıdan bir motor seçin<br>veya Manuel Giriş ile veri girin.</div>';
    html += '</div>';
    
    // ── MOTOR PARAMETRELERİ (en üstte, motor seçilince görünür) ──
    var sp = nodeData.motorSpecs || {};
    html += '<div id="ve-ft-extra-' + node.id + '" style="display:' + (hasData ? 'block' : 'none') + ';">';
    
    html += '<div style="background:var(--bg-tertiary); border-radius:8px; padding:10px; margin-bottom:12px;">';
    html += '<div style="font-size:0.75rem; font-weight:600; color:var(--text-heading); margin-bottom:8px;">Motor Parametreleri</div>';
    html += '<table style="width:100%; font-size:0.68rem; border-collapse:collapse; border:1px solid var(--border-color);">';
    
    var specRows = [
      {id: 'displacement', label: 'Silindir Hacmi', unit: 'L', val: sp.displacement || '', step: '0.01'},
      {id: 'idleRpm', label: 'Rölanti Devri', unit: 'rpm', val: sp.idleRpm || '', step: '50'},
      {id: 'governedSpeed', label: 'Governed Speed', unit: 'rpm', val: sp.governedSpeed || '', step: '50'},
      {id: 'noLoadGoverned', label: 'No-Load Governed', unit: 'rpm', val: sp.noLoadGoverned || '', step: '50'},
      {id: 'inertia', label: 'Motor Ataleti', unit: 'kg·m²', val: sp.inertia || '', step: '0.001'}
    ];
    specRows.forEach(function(r) {
      html += '<tr style="border-bottom:1px solid var(--border-color);">';
      html += '<th style="padding:6px 8px; text-align:left; background:var(--bg-tertiary); border-right:1px solid var(--border-color); width:55%; font-weight:500; color:var(--text-secondary);">' + r.label + ' <span style="color:var(--text-muted); font-weight:400;">[' + r.unit + ']</span></th>';
      html += '<td style="padding:4px 6px; background:var(--bg-tertiary);"><input type="number" id="ve-ft-spec-' + r.id + '-' + node.id + '" value="' + r.val + '" step="' + r.step + '" min="0" style="width:100%; padding:4px; font-size:0.68rem; background:var(--bg-input); color:var(--text-primary); border:1px solid var(--border-color); border-radius:3px; text-align:right;" onchange="onVEFTSpecChange(\'' + node.id + '\')"></td>';
      html += '</tr>';
    });
    html += '</table>';
    html += '</div>';
    
    // ft-extra KAPATILMIYOR — data area ve aksesuar kayıpları da içinde olacak
  }
  
  // ===== VERİ ALANI (Motor seçildiğinde gösterilecek) =====
  var showDataArea = hasData;
  html += '<div id="ve-motor-data-area-' + node.id + '" style="display:' + (showDataArea ? 'block' : 'none') + ';">';
  
  // Veri Tablosu - resize edilebilir
  html += '<div id="ve-motor-table-wrapper-' + node.id + '" style="max-height:' + tableHeight + 'px; overflow-y:auto; margin-bottom:0; border:1px solid var(--border-color); border-radius:6px 6px 0 0; border-bottom:none;">';
  html += '<table style="width:100%; border-collapse:collapse; font-size:0.7rem;">';
  html += '<thead style="position:sticky; top:0; background:var(--bg-tertiary); z-index:1;">';
  html += '<tr>';
  html += '<th style="padding:6px; border-bottom:1px solid var(--border-color); text-align:center;">Devir<br>[rpm]</th>';
  html += '<th style="padding:6px; border-bottom:1px solid var(--border-color); text-align:center;">Tork<br>[Nm]</th>';
  html += '<th style="padding:6px; border-bottom:1px solid var(--border-color); text-align:center;">Güç<br>[kW]</th>';
  html += '<th style="padding:6px; border-bottom:1px solid var(--border-color); width:28px;"></th>';
  html += '</tr></thead>';
  html += '<tbody id="ve-motor-table-' + node.id + '">';
  
  // Sadece veri varsa satırları göster
  if(rows.length > 0) {
    rows.forEach(function(row) {
      html += getVEMotorRowHTML(node.id,
        row.rpm !== undefined && row.rpm !== null ? row.rpm : '',
        row.torque !== undefined && row.torque !== null ? row.torque : '',
        row.power !== undefined && row.power !== null ? row.power : '');
    });
  }
  
  html += '</tbody></table></div>';
  
  // Resize handle
  html += '<div id="ve-table-resizer-' + node.id + '" style="height:8px; background:var(--bg-tertiary); border:1px solid var(--border-color); border-top:none; border-radius:0 0 6px 6px; cursor:ns-resize; display:flex; align-items:center; justify-content:center;" onmousedown="startVETableResize(event, \'' + node.id + '\')">';
  html += '<div style="width:30px; height:3px; background:var(--border-color); border-radius:2px;"></div>';
  html += '</div>';
  
  // Tablo Butonları - Klasik Arayüz gibi
  html += '<div style="display:flex; gap:4px; margin-top:8px; margin-bottom:12px;">';
  html += '<button onclick="addVEMotorRow(\'' + node.id + '\')" style="flex:1; padding:5px; font-size:0.68rem; background:var(--bg-tertiary); color:var(--text-primary); border:1px solid var(--border-color); border-radius:4px; cursor:pointer;">+ Satır Ekle</button>';
  html += '<button onclick="clearVEMotorTable(\'' + node.id + '\')" style="flex:1; padding:5px; font-size:0.68rem; background:var(--bg-tertiary); color:var(--text-primary); border:1px solid var(--border-color); border-radius:4px; cursor:pointer;">Tümünü Sil</button>';
  html += '<button onclick="deleteVEMotorSavedSet(\'' + node.id + '\')" style="flex:1; padding:5px; font-size:0.68rem; background:var(--accent-danger); color:white; border:none; border-radius:4px; cursor:pointer;">Veriyi Temizle</button>';
  html += '<button onclick="saveVEMotorData(\'' + node.id + '\')" style="flex:1; padding:5px; font-size:0.68rem; background:#1e5a3f; color:white; border:none; border-radius:4px; cursor:pointer;">💾 Kaydet</button>';
  html += '</div>';
  
  // ===== GRAFİK =====
  html += '<div style="background:var(--bg-tertiary); border-radius:8px; padding:10px; margin-bottom:12px;">';
  html += '<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">';
  html += '<span style="font-size:0.75rem; font-weight:600; color:var(--text-heading);">Tork & Güç Eğrisi</span>';
  html += '<button onclick="showInfoPopup(\'torkGucEgrisi\')" style="width:16px; height:16px; border-radius:50%; background:var(--accent-primary); color:white; border:none; cursor:pointer; font-size:0.6rem; display:flex; align-items:center; justify-content:center;" title="Bilgi">?</button>';
  html += '<button onclick="updateVEMotorChart(\'' + node.id + '\')" style="padding:3px 8px; font-size:0.65rem; background:var(--accent-primary); color:white; border:none; border-radius:4px; cursor:pointer;">Güncelle</button>';
  html += '</div>';
  html += '<canvas id="ve-motor-chart-' + node.id + '" style="width:100%; height:200px; background:var(--bg-input); border-radius:6px;"></canvas>';
  html += '<div style="display:flex; justify-content:center; gap:16px; margin-top:6px; font-size:0.65rem;">';
  html += '<span style="color:#4aa3ff;">● Tork [Nm]</span>';
  html += '<span style="color:#ff6b6b;">● Güç [kW]</span>';
  html += '</div>';
  html += '</div>';
  
  // ===== EĞRİ YAKLAŞIMI =====
  html += '<div style="background:var(--bg-tertiary); border-radius:8px; padding:10px; margin-bottom:12px;">';
  html += '<div style="font-size:0.75rem; font-weight:600; color:var(--text-heading); margin-bottom:8px; display:flex; align-items:center; gap:6px;">Eğri Yaklaşımı <button onclick="showInfoPopup(\'egriYaklaşımı\')" style="width:16px; height:16px; border-radius:50%; background:var(--accent-primary); color:white; border:none; cursor:pointer; font-size:0.6rem; display:flex; align-items:center; justify-content:center;" title="Bilgi">?</button></div>';
  
  html += '<div style="display:flex; gap:8px; align-items:center; margin-bottom:8px;">';
  html += '<select id="ve-fit-method-' + node.id + '" onchange="onVEFitMethodChange(\'' + node.id + '\')" style="flex:1; font-size:0.7rem; padding:4px; background:var(--bg-input); color:var(--text-primary); border:1px solid var(--border-color); border-radius:4px;">';
  html += '<option value="linear"' + (fitMethod === 'linear' ? ' selected' : '') + '>Parça-parça Lineer (İnterpolasyon)</option>';
  html += '<option value="pchip"' + (fitMethod === 'pchip' ? ' selected' : '') + '>Kübik Spline (PCHIP)</option>';
  html += '<option value="poly"' + (fitMethod === 'poly' ? ' selected' : '') + '>Polinom</option>';
  html += '</select>';
  html += '</div>';
  
  html += '<div id="ve-poly-degree-wrapper-' + node.id + '" style="display:' + (fitMethod === 'poly' ? 'flex' : 'none') + '; gap:8px; align-items:center; margin-bottom:8px;">';
  html += '<span style="font-size:0.7rem; color:var(--text-muted);">Polinom derecesi:</span>';
  html += '<select id="ve-poly-degree-' + node.id + '" onchange="updateVEMotorChart(\'' + node.id + '\')" style="width:60px; font-size:0.7rem; padding:3px; background:var(--bg-input); color:var(--text-primary); border:1px solid var(--border-color); border-radius:4px;">';
  for(var d = 2; d <= 5; d++) {
    html += '<option value="' + d + '"' + (polyDegree == d ? ' selected' : '') + '>' + d + '</option>';
  }
  html += '</select>';
  html += '</div>';
  
  html += '<div id="ve-motor-fit-' + node.id + '" style="font-size:0.68rem; color:var(--text-muted); padding:8px; background:var(--bg-input); border-radius:4px; font-family:monospace; word-break:break-all;">';
  html += 'Veri girildikten sonra denklem gösterilecek.';
  html += '</div>';
  html += '</div>';
  
  // ===== MOTOR FRENİ PARAMETRELERİ =====
  html += '</div>'; // ve-motor-data-area kapatma
  
  if(isFullThrottle) {
    // ── TAM GAZ: AKSESUAR KAYIPLARI (ft-extra wrapper zaten üstte açıldı) ──
    var accessories = nodeData.accessories || [];
    html += '<div style="background:var(--bg-tertiary); border-radius:8px; padding:10px; margin-top:12px;">';
    html += '<div style="font-size:0.75rem; font-weight:600; color:var(--text-heading); margin-bottom:8px;">Aksesuar Kayıpları</div>';
    html += '<p style="font-size:0.58rem; color:var(--text-muted); margin-bottom:8px; line-height:1.3;">Brüt güçten net güce geçiş için aksesuar kayıplarını tanımlayın. Toplam kayıp, her devirdeki güçten düşülür.</p>';
    
    html += '<table style="width:100%; font-size:0.68rem; border-collapse:collapse; border:1px solid var(--border-color);">';
    html += '<thead><tr style="background:var(--bg-secondary);">';
    html += '<th style="padding:5px 6px; text-align:left; border:1px solid var(--border-color); font-weight:500; color:var(--text-secondary);">Aksesuar</th>';
    html += '<th style="padding:5px 6px; text-align:center; border:1px solid var(--border-color); font-weight:500; color:var(--text-secondary); width:75px;">Standart [kW]</th>';
    html += '<th style="padding:5px 6px; text-align:center; border:1px solid var(--border-color); font-weight:500; color:var(--text-secondary); width:75px;">Kullanıcı [kW]</th>';
    html += '</tr></thead><tbody id="ve-acc-table-' + node.id + '">';
    
    var defaultAcc = [
      {name: 'Fan (Kavramalı Fan)', standardLoss: 0, userLoss: 0},
      {name: 'Alternatör / Jeneratör', standardLoss: 0, userLoss: 0},
      {name: 'Hava Kompresörü', standardLoss: 0, userLoss: 0},
      {name: 'Direksiyon Pompası', standardLoss: 0, userLoss: 0},
      {name: 'Klima', standardLoss: 0, userLoss: 0},
      {name: 'Ek Tahrik', standardLoss: 0, userLoss: 0}
    ];
    var accData = accessories.length > 0 ? accessories : defaultAcc;
    
    accData.forEach(function(acc, idx) {
      html += '<tr style="border-bottom:1px solid var(--border-color);">';
      html += '<td style="padding:5px 6px; background:var(--bg-tertiary); border-right:1px solid var(--border-color); color:var(--text-secondary);">' + acc.name + '</td>';
      html += '<td style="padding:3px 4px; background:var(--bg-tertiary); border-right:1px solid var(--border-color); text-align:center;"><input type="number" class="ve-acc-std-' + node.id + '" data-idx="' + idx + '" value="' + (acc.standardLoss || 0) + '" step="0.1" min="0" style="width:100%; padding:3px; font-size:0.68rem; background:var(--bg-input); color:var(--text-primary); border:1px solid var(--border-color); border-radius:3px; text-align:right;" onchange="onVEAccChange(\'' + node.id + '\')"></td>';
      html += '<td style="padding:3px 4px; background:var(--bg-tertiary); text-align:center;"><input type="number" class="ve-acc-user-' + node.id + '" data-idx="' + idx + '" value="' + (acc.userLoss || 0) + '" step="0.1" min="0" style="width:100%; padding:3px; font-size:0.68rem; background:var(--bg-input); color:var(--text-primary); border:1px solid var(--border-color); border-radius:3px; text-align:right;" onchange="onVEAccChange(\'' + node.id + '\')"></td>';
      html += '</tr>';
    });
    
    var totalStd = accData.reduce(function(s, a) { return s + (a.standardLoss || 0); }, 0);
    var totalUser = accData.reduce(function(s, a) { return s + (a.userLoss || 0); }, 0);
    html += '<tr style="background:var(--bg-secondary); font-weight:600;">';
    html += '<td style="padding:5px 6px; border:1px solid var(--border-color); color:var(--text-heading);">Toplam</td>';
    html += '<td id="ve-acc-total-std-' + node.id + '" style="padding:5px 6px; border:1px solid var(--border-color); text-align:center; color:var(--text-heading);">' + totalStd.toFixed(1) + '</td>';
    html += '<td id="ve-acc-total-user-' + node.id + '" style="padding:5px 6px; border:1px solid var(--border-color); text-align:center; color:var(--text-heading);">' + totalUser.toFixed(1) + '</td>';
    html += '</tr>';
    
    html += '</tbody></table>';
    html += '<div style="margin-top:8px; text-align:right;">';
    html += '<button onclick="onVEApplyAccLosses(\'' + node.id + '\')" style="padding:6px 16px; font-size:0.7rem; font-weight:600; background:var(--accent-primary); color:white; border:none; border-radius:5px; cursor:pointer;">Kayıpları Uygula</button>';
    html += '</div>';
    html += '</div>';
    
    // ── NET DEĞERLER: Tablo + Diyagram ──
    var totalUserLoss = accData.reduce(function(s, a) { return s + (a.userLoss || 0); }, 0);
    var initGoverned = sp.governedSpeed || governedRpm || 2100;
    var netRows = [];
    if(rows.length > 0) {
      rows.forEach(function(r) {
        var grossP = parseFloat(r.power) || 0;
        var grossT = parseFloat(r.torque) || 0;
        var rpm = parseFloat(r.rpm) || 0;
        if(rpm <= 0) return;
        // RPM bağımlı kayıp: Fan → küp, diğerleri → lineer
        var lossAtRPM = 0;
        var ratio = rpm / initGoverned;
        accData.forEach(function(a) {
          var loss = a.userLoss || 0;
          if(loss <= 0) return;
          if(a.name && a.name.toLowerCase().indexOf('fan') >= 0) {
            lossAtRPM += loss * ratio * ratio * ratio;
          } else {
            lossAtRPM += loss * ratio;
          }
        });
        var netP = grossP - lossAtRPM;
        var netT = netP * 9549.3 / rpm;
        netRows.push({rpm: rpm, torque: netT, power: netP, grossTorque: grossT, grossPower: grossP, loss: lossAtRPM});
      });
    }
    
    html += '<div style="background:var(--bg-tertiary); border-radius:8px; padding:10px; margin-top:12px;">';
    html += '<div style="font-size:0.75rem; font-weight:600; color:var(--text-heading); margin-bottom:4px;">Net Değerler</div>';
    html += '<p style="font-size:0.56rem; color:var(--text-muted); margin-bottom:8px; line-height:1.3;">Governed Speed (' + initGoverned + ' rpm) değerindeki aksesuar kaybı: ' + totalUserLoss.toFixed(1) + ' kW. Fan → RPM³, diğerleri → RPM oranında ölçeklenir.</p>';
    
    // Net tablo
    html += '<div id="ve-net-table-wrapper-' + node.id + '" style="max-height:180px; overflow-y:auto; margin-bottom:8px; border:1px solid var(--border-color); border-radius:6px;">';
    html += '<table style="width:100%; border-collapse:collapse; font-size:0.68rem;">';
    html += '<thead style="position:sticky; top:0; background:var(--bg-secondary); z-index:1;">';
    html += '<tr>';
    html += '<th style="padding:5px; border-bottom:1px solid var(--border-color); text-align:center;">Devir<br>[rpm]</th>';
    html += '<th style="padding:5px; border-bottom:1px solid var(--border-color); text-align:center;">Brüt Tork<br>[Nm]</th>';
    html += '<th style="padding:5px; border-bottom:1px solid var(--border-color); text-align:center; color:#4ade80;">Net Tork<br>[Nm]</th>';
    html += '<th style="padding:5px; border-bottom:1px solid var(--border-color); text-align:center;">Brüt Güç<br>[kW]</th>';
    html += '<th style="padding:5px; border-bottom:1px solid var(--border-color); text-align:center; color:#f87171;">Net Güç<br>[kW]</th>';
    html += '</tr></thead><tbody id="ve-net-table-' + node.id + '">';
    
    if(netRows.length > 0) {
      netRows.forEach(function(nr) {
        html += '<tr style="border-bottom:1px solid var(--border-color);">';
        html += '<td style="padding:4px 5px; text-align:center; background:var(--bg-tertiary); font-weight:500;">' + nr.rpm.toFixed(0) + '</td>';
        html += '<td style="padding:4px 5px; text-align:center; background:var(--bg-tertiary); color:var(--text-muted);">' + nr.grossTorque.toFixed(1) + '</td>';
        html += '<td style="padding:4px 5px; text-align:center; background:var(--bg-tertiary); color:#4ade80; font-weight:500;">' + nr.torque.toFixed(1) + '</td>';
        html += '<td style="padding:4px 5px; text-align:center; background:var(--bg-tertiary); color:var(--text-muted);">' + nr.grossPower.toFixed(1) + '</td>';
        html += '<td style="padding:4px 5px; text-align:center; background:var(--bg-tertiary); color:#f87171; font-weight:500;">' + nr.power.toFixed(1) + '</td>';
        html += '</tr>';
      });
    } else {
      html += '<tr><td colspan="5" style="padding:12px; text-align:center; color:var(--text-muted);">Motor verisi girilmedi</td></tr>';
    }
    
    html += '</tbody></table></div>';
    
    // Net grafik
    html += '<div style="position:relative; background:var(--bg-input); border-radius:6px; border:1px solid var(--border-color); padding:4px;">';
    html += '<canvas id="ve-net-chart-' + node.id + '" style="width:100%; height:200px;"></canvas>';
    html += '</div>';
    html += '<div style="display:flex; gap:12px; justify-content:center; margin-top:4px; font-size:0.6rem; color:var(--text-muted);">';
    html += '<span style="color:var(--text-muted); opacity:0.5;">┅ Brüt Tork</span>';
    html += '<span style="color:#4ade80;">● Net Tork [Nm]</span>';
    html += '<span style="color:var(--text-muted); opacity:0.5;">┅ Brüt Güç</span>';
    html += '<span style="color:#f87171;">● Net Güç [kW]</span>';
    html += '</div>';
    
    html += '</div>';
    html += '</div>'; // close ve-ft-extra wrapper

    
  } else {
    // ── MOTOR FRENİ: Orijinal parametreler ──
    html += '<div style="background:var(--bg-tertiary); border-radius:8px; padding:10px; margin-top:12px;">';
  html += '<div style="font-size:0.75rem; font-weight:600; color:var(--text-heading); margin-bottom:10px; display:flex; align-items:center; gap:6px;">Motor Freni Parametreleri <button onclick="showInfoPopup(\'motorFreniParametreleri\')" style="width:16px; height:16px; border-radius:50%; background:var(--accent-primary); color:white; border:none; cursor:pointer; font-size:0.6rem; display:flex; align-items:center; justify-content:center;" title="Bilgi">?</button></div>';
  
  // Kenarlıklı tablo - daha okunaklı renkler
  html += '<table style="width:100%; font-size:0.7rem; border-collapse:collapse; border:1px solid var(--border-color);">';
  
  // Verim satırı
  html += '<tr style="border-bottom:1px solid var(--border-color);">';
  html += '<th style="padding:8px; text-align:left; background:var(--bg-tertiary); border-right:1px solid var(--border-color); width:65%; font-weight:500; color:var(--text-secondary);">Kabul edilen motor freni verimi [%]</th>';
  html += '<td style="padding:8px; background:var(--bg-tertiary);"><input type="number" id="ve-mf-verim-' + node.id + '" value="' + verim + '" min="0" max="100" step="1" style="width:100%; padding:5px; font-size:0.7rem; background:var(--bg-input); color:var(--text-primary); border:1px solid var(--border-color); border-radius:4px; text-align:right;" onchange="onVEMotorParamChange(\'' + node.id + '\')"></td>';
  html += '</tr>';
  
  // Verim açıklama satırı
  html += '<tr style="border-bottom:1px solid var(--border-color);">';
  html += '<td colspan="2" style="padding:6px 8px; font-size:0.65rem; color:var(--text-secondary); background:var(--bg-secondary); line-height:1.4;">Üretici katalog değerlerinin ne kadarının gerçek araca aktarılacağını ifade eder. Örneğin %95 girildiğinde, tork/güç değerleri 0,95 ile çarpılarak kullanılır.</td>';
  html += '</tr>';
  
  // Governed RPM satırı
  html += '<tr style="border-bottom:1px solid var(--border-color);">';
  html += '<th style="padding:8px; text-align:left; background:var(--bg-tertiary); border-right:1px solid var(--border-color); font-weight:500; color:var(--text-secondary);">Governed RPM [d/d]</th>';
  html += '<td style="padding:8px; background:var(--bg-tertiary);"><input type="number" id="ve-governed-rpm-' + node.id + '" value="' + governedRpm + '" min="500" max="5000" step="100" style="width:100%; padding:5px; font-size:0.7rem; background:var(--bg-input); color:var(--text-primary); border:1px solid var(--border-color); border-radius:4px; text-align:right;" onchange="onVEMotorParamChange(\'' + node.id + '\')"></td>';
  html += '</tr>';
  
  // Governed RPM açıklama satırı
  html += '<tr>';
  html += '<td colspan="2" style="padding:6px 8px; font-size:0.65rem; color:var(--text-secondary); background:var(--bg-secondary); line-height:1.4;">Motorun maksimum çalışma devri. Vites değişim mantığı:<br>• <b>Upshift:</b> Motor devri > Governed + 400 olunca üst vitese geçer<br>• <b>Downshift:</b> Motor devri < (Governed + 400) × (i<sub>mevcut</sub> / i<sub>alt</sub>) olunca alt vitese geçer</td>';
  html += '</tr>';
  
  html += '</table>';
  html += '</div>';
  } // end else (motor freni)
  
  html += '</div>';
  return html;
}

// Tablo resize fonksiyonları
var veTableResizing = null;

function startVETableResize(e, nodeId) {
  e.preventDefault();
  veTableResizing = {
    nodeId: nodeId,
    startY: e.clientY,
    startHeight: document.getElementById('ve-motor-table-wrapper-' + nodeId).offsetHeight
  };
  document.addEventListener('mousemove', doVETableResize);
  document.addEventListener('mouseup', stopVETableResize);
}

function doVETableResize(e) {
  if(!veTableResizing) return;
  var wrapper = document.getElementById('ve-motor-table-wrapper-' + veTableResizing.nodeId);
  if(!wrapper) return;
  
  var newHeight = veTableResizing.startHeight + (e.clientY - veTableResizing.startY);
  newHeight = Math.max(80, Math.min(400, newHeight)); // 80-400px arası
  wrapper.style.maxHeight = newHeight + 'px';
  
  // Node data güncelle
  var node = nodes.find(function(n) { return n.id === veTableResizing.nodeId; });
  if(node) {
    if(!node.data) node.data = {};
    node.data.tableHeight = newHeight;
  }
}

function stopVETableResize() {
  veTableResizing = null;
  document.removeEventListener('mousemove', doVETableResize);
  document.removeEventListener('mouseup', stopVETableResize);
}

// Tam Gaz Hızlanma modülü motor preset'leri (net değerler — aksesuar kayıpları düşülmüş)
// 34 VPA Motor Kataloğu + 2 ek preset = 36 motor
var VE_FT_MOTOR_PRESETS = {
  'azra_i6_3000': {
    name: 'AZRA I6 (3000 Nm) | 3000Nm&448kW',
    specs: {
      displacement: 12.00,
      idleRpm: 550,
      governedSpeed: 2100,
      noLoadGoverned: 2150,
      inertia: 2.8000
    },
    data: [
      {rpm: 550, torque: 750, power: 43.2},
      {rpm: 700, torque: 1356, power: 99.4},
      {rpm: 800, torque: 1777, power: 148.9},
      {rpm: 900, torque: 2234, power: 210.6},
      {rpm: 1000, torque: 2701.4, power: 282.9},
      {rpm: 1100, torque: 3000, power: 345.6},
      {rpm: 1200, torque: 3000, power: 377},
      {rpm: 1300, torque: 2895.6, power: 394.2},
      {rpm: 1400, torque: 2791.2, power: 409.2},
      {rpm: 1500, torque: 2686.8, power: 422.1},
      {rpm: 1600, torque: 2582.4, power: 432.7},
      {rpm: 1700, torque: 2478, power: 441.2},
      {rpm: 1800, torque: 2373.6, power: 447.4},
      {rpm: 1900, torque: 1950, power: 388},
      {rpm: 2000, torque: 1550, power: 324.6},
      {rpm: 2100, torque: 1000, power: 219.9},
      {rpm: 2150, torque: 0, power: 0}
    ],
    accessories: [
      {name: 'Fan (Kavramalı Fan)', standardLoss: 22.4, userLoss: 22.4},
      {name: 'Alternatör / Jeneratör', standardLoss: 2.8, userLoss: 2.8},
      {name: 'Hava Kompresörü', standardLoss: 1.4, userLoss: 1.4},
      {name: 'Direksiyon Pompası', standardLoss: 1.4, userLoss: 1.4},
      {name: 'Klima', standardLoss: 0, userLoss: 0},
      {name: 'Ek Tahrik', standardLoss: 0, userLoss: 0}
    ]
  },
  'azra_i6_2500_studio': {
    name: 'AZRA I6 Base Studio (2500 Nm) | 2500Nm&448kW',
    specs: {
      displacement: 12.00,
      idleRpm: 550,
      governedSpeed: 2100,
      noLoadGoverned: 2150,
      inertia: 2.8000
    },
    data: [
      {rpm: 550, torque: 750, power: 43.2},
      {rpm: 700, torque: 1356, power: 99.4},
      {rpm: 800, torque: 1777, power: 148.9},
      {rpm: 900, torque: 2234, power: 210.6},
      {rpm: 1000, torque: 2500, power: 261.8},
      {rpm: 1100, torque: 2500, power: 288},
      {rpm: 1200, torque: 2500, power: 314.2},
      {rpm: 1300, torque: 2500, power: 340.3},
      {rpm: 1400, torque: 2500, power: 366.5},
      {rpm: 1500, torque: 2500, power: 392.7},
      {rpm: 1600, torque: 2500, power: 418.9},
      {rpm: 1700, torque: 2415, power: 429.9},
      {rpm: 1800, torque: 2282, power: 430.2},
      {rpm: 1900, torque: 1950, power: 388},
      {rpm: 2000, torque: 1550, power: 324.6},
      {rpm: 2100, torque: 1000, power: 219.9},
      {rpm: 2150, torque: 0, power: 0}
    ],
    accessories: [
      {name: 'Fan (Kavramalı Fan)', standardLoss: 22.4, userLoss: 22.4},
      {name: 'Alternatör / Jeneratör', standardLoss: 2.8, userLoss: 2.8},
      {name: 'Hava Kompresörü', standardLoss: 1.4, userLoss: 1.4},
      {name: 'Direksiyon Pompası', standardLoss: 1.4, userLoss: 1.4},
      {name: 'Klima', standardLoss: 0, userLoss: 0},
      {name: 'Ek Tahrik', standardLoss: 0, userLoss: 0}
    ]
  },
  'azra_i6_2500_panter': {
    name: 'AZRA I6 Panter Obüs (2500 Nm) | 2500Nm&448kW',
    specs: {
      displacement: 12.00,
      idleRpm: 550,
      governedSpeed: 2100,
      noLoadGoverned: 2150,
      inertia: 2.8000
    },
    data: [
      {rpm: 550, torque: 750, power: 43.2},
      {rpm: 700, torque: 1356, power: 99.4},
      {rpm: 800, torque: 1777, power: 148.9},
      {rpm: 900, torque: 2175, power: 205},
      {rpm: 1000, torque: 2350, power: 246.1},
      {rpm: 1100, torque: 2500, power: 288},
      {rpm: 1200, torque: 2500, power: 314.2},
      {rpm: 1300, torque: 2500, power: 340.3},
      {rpm: 1400, torque: 2500, power: 366.5},
      {rpm: 1500, torque: 2500, power: 392.7},
      {rpm: 1600, torque: 2500, power: 418.9},
      {rpm: 1700, torque: 2447, power: 435.6},
      {rpm: 1800, torque: 2374, power: 447.5},
      {rpm: 1900, torque: 1950, power: 388},
      {rpm: 2000, torque: 1550, power: 324.6},
      {rpm: 2100, torque: 1000, power: 219.9},
      {rpm: 2150, torque: 0, power: 0}
    ],
    accessories: [
      {name: 'Fan (Kavramalı Fan)', standardLoss: 22.4, userLoss: 22.4},
      {name: 'Alternatör / Jeneratör', standardLoss: 2.8, userLoss: 2.8},
      {name: 'Hava Kompresörü', standardLoss: 1.4, userLoss: 1.4},
      {name: 'Direksiyon Pompası', standardLoss: 1.4, userLoss: 1.4},
      {name: 'Klima', standardLoss: 0, userLoss: 0},
      {name: 'Ek Tahrik', standardLoss: 0, userLoss: 0}
    ]
  },
  'bmc_i4_1600': {
    name: 'BMC Power I4 | 1600Nm&280kW',
    specs: {
      displacement: 8.40,
      idleRpm: 800,
      governedSpeed: 2100,
      noLoadGoverned: 2150,
      inertia: 1.4310
    },
    data: [
      {rpm: 800, torque: 1000, power: 83.8},
      {rpm: 900, torque: 1200, power: 113.1},
      {rpm: 1000, torque: 1400, power: 146.6},
      {rpm: 1100, torque: 1600, power: 184.3},
      {rpm: 1200, torque: 1600, power: 201.1},
      {rpm: 1300, torque: 1600, power: 217.8},
      {rpm: 1400, torque: 1600, power: 234.6},
      {rpm: 1500, torque: 1554, power: 244.1},
      {rpm: 1600, torque: 1508, power: 252.7},
      {rpm: 1700, torque: 1462, power: 260.3},
      {rpm: 1800, torque: 1416, power: 266.9},
      {rpm: 1900, torque: 1370, power: 272.6},
      {rpm: 2000, torque: 1324, power: 277.3},
      {rpm: 2100, torque: 1275, power: 280.4},
      {rpm: 2150, torque: 0, power: 0}
    ],
    accessories: [
      {name: 'Fan (Kavramalı Fan)', standardLoss: 22.4, userLoss: 22.4},
      {name: 'Alternatör / Jeneratör', standardLoss: 2.8, userLoss: 2.8},
      {name: 'Hava Kompresörü', standardLoss: 1.4, userLoss: 1.4},
      {name: 'Direksiyon Pompası', standardLoss: 1.4, userLoss: 1.4},
      {name: 'Klima', standardLoss: 0, userLoss: 0},
      {name: 'Ek Tahrik', standardLoss: 0, userLoss: 0}
    ]
  },
  'isb45_250_fr94257': {
    name: 'ISB4.5 250 | FR94257',
    specs: {
      displacement: 4.50,
      idleRpm: 700,
      governedSpeed: 2590,
      noLoadGoverned: 2895,
      inertia: 0.8000
    },
    data: [
      {rpm: 700, torque: 361, power: 26},
      {rpm: 800, torque: 361, power: 30},
      {rpm: 900, torque: 401, power: 38},
      {rpm: 1000, torque: 450, power: 47},
      {rpm: 1100, torque: 479, power: 55},
      {rpm: 1200, torque: 486, power: 61},
      {rpm: 1300, torque: 590, power: 80},
      {rpm: 1400, torque: 750, power: 110},
      {rpm: 1500, torque: 800, power: 126},
      {rpm: 1800, torque: 800, power: 151},
      {rpm: 1900, torque: 800, power: 159},
      {rpm: 2000, torque: 800, power: 168},
      {rpm: 2100, torque: 790, power: 174},
      {rpm: 2200, torque: 781, power: 180},
      {rpm: 2300, torque: 761, power: 183},
      {rpm: 2400, torque: 740, power: 186},
      {rpm: 2500, torque: 713, power: 187},
      {rpm: 2530, torque: 707, power: 187},
      {rpm: 2590, torque: 545, power: 148},
      {rpm: 2895, torque: 0, power: 0}
    ],
    accessories: [
      {name: 'Fan (Kavramalı Fan)', standardLoss: 22.4, userLoss: 22.4},
      {name: 'Alternatör / Jeneratör', standardLoss: 2.8, userLoss: 2.8},
      {name: 'Hava Kompresörü', standardLoss: 1.4, userLoss: 1.4},
      {name: 'Direksiyon Pompası', standardLoss: 1.4, userLoss: 1.4},
      {name: 'Klima', standardLoss: 0, userLoss: 0},
      {name: 'Ek Tahrik', standardLoss: 0, userLoss: 0}
    ]
  },
  'isb45_210_fr94198': {
    name: 'ISB4.5 210 | FR94198',
    specs: {
      displacement: 4.50,
      idleRpm: 800,
      governedSpeed: 2500,
      noLoadGoverned: 2850,
      inertia: 0.4993
    },
    data: [
      {rpm: 800, torque: 366.0, power: 30.7},
      {rpm: 900, torque: 400.8, power: 37.7},
      {rpm: 1000, torque: 446.0, power: 46.7},
      {rpm: 1100, torque: 495.0, power: 57.0},
      {rpm: 1200, torque: 527.0, power: 66.2},
      {rpm: 1300, torque: 576.0, power: 78.4},
      {rpm: 1400, torque: 702.0, power: 102.9},
      {rpm: 1500, torque: 759.0, power: 119.2},
      {rpm: 1600, torque: 759.0, power: 127.2},
      {rpm: 1700, torque: 759.0, power: 135.1},
      {rpm: 1800, torque: 759.0, power: 143.1},
      {rpm: 1900, torque: 739.0, power: 147.8},
      {rpm: 2000, torque: 719.0, power: 150.6},
      {rpm: 2100, torque: 698.0, power: 153.5},
      {rpm: 2200, torque: 678.0, power: 156.2},
      {rpm: 2300, torque: 650.0, power: 156.6},
      {rpm: 2400, torque: 621.0, power: 156.1},
      {rpm: 2500, torque: 550.0, power: 144.0},
      {rpm: 2530, torque: 515.0, power: 136.4},
      {rpm: 2600, torque: 400.0, power: 108.9},
      {rpm: 2850, torque: 0.0, power: 0.0}
    ],
    accessories: [
      {name: 'Fan (Kavramalı Fan)', standardLoss: 16.1, userLoss: 16.1},
      {name: 'Alternatör / Jeneratör', standardLoss: 1.6, userLoss: 1.6},
      {name: 'Hava Kompresörü', standardLoss: 0.8, userLoss: 0.8},
      {name: 'Direksiyon Pompası', standardLoss: 0.8, userLoss: 0.8},
      {name: 'Klima', standardLoss: 0, userLoss: 0},
      {name: 'Ek Tahrik', standardLoss: 0, userLoss: 0}
    ]
  },
  'isb45e3_185_fr92152': {
    name: 'ISB4.5e3 185 | FR92152',
    specs: {
      displacement: 4.50,
      idleRpm: 1000,
      governedSpeed: 2500,
      noLoadGoverned: 2850,
      inertia: 0.8000
    },
    data: [
      {rpm: 1000, torque: 490, power: 51.3},
      {rpm: 1200, torque: 650, power: 81.7},
      {rpm: 1500, torque: 650, power: 102.1},
      {rpm: 1700, torque: 650, power: 115.7},
      {rpm: 1900, torque: 618, power: 123},
      {rpm: 2100, torque: 585, power: 128.7},
      {rpm: 2400, torque: 536, power: 134.7},
      {rpm: 2500, torque: 520, power: 136.1},
      {rpm: 2850, torque: 0, power: 0}
    ],
    accessories: [
      {name: 'Fan (Kavramalı Fan)', standardLoss: 22.4, userLoss: 22.4},
      {name: 'Alternatör / Jeneratör', standardLoss: 2.8, userLoss: 2.8},
      {name: 'Hava Kompresörü', standardLoss: 1.4, userLoss: 1.4},
      {name: 'Direksiyon Pompası', standardLoss: 1.4, userLoss: 1.4},
      {name: 'Klima', standardLoss: 0, userLoss: 0},
      {name: 'Ek Tahrik', standardLoss: 0, userLoss: 0}
    ]
  },
  'isb45e3_185_fr92154': {
    name: 'ISB4.5e3 185 | FR92154',
    specs: {
      displacement: 4.50,
      idleRpm: 1000,
      governedSpeed: 2500,
      noLoadGoverned: 2850,
      inertia: 0.8000
    },
    data: [
      {rpm: 1000, torque: 490, power: 51.3},
      {rpm: 1200, torque: 550, power: 69.1},
      {rpm: 1500, torque: 550, power: 86.4},
      {rpm: 1700, torque: 550, power: 97.9},
      {rpm: 1900, torque: 543, power: 108},
      {rpm: 2100, torque: 535, power: 117.7},
      {rpm: 2400, torque: 524, power: 131.7},
      {rpm: 2500, torque: 520, power: 136.1},
      {rpm: 2850, torque: 0, power: 0}
    ],
    accessories: [
      {name: 'Fan (Kavramalı Fan)', standardLoss: 22.4, userLoss: 22.4},
      {name: 'Alternatör / Jeneratör', standardLoss: 2.8, userLoss: 2.8},
      {name: 'Hava Kompresörü', standardLoss: 1.4, userLoss: 1.4},
      {name: 'Direksiyon Pompası', standardLoss: 1.4, userLoss: 1.4},
      {name: 'Klima', standardLoss: 0, userLoss: 0},
      {name: 'Ek Tahrik', standardLoss: 0, userLoss: 0}
    ]
  },
  'isb45e5_207_fr92473': {
    name: 'ISB4.5e5 207 | FR92473',
    specs: {
      displacement: 4.50,
      idleRpm: 700,
      governedSpeed: 2525,
      noLoadGoverned: 2850,
      inertia: 0.8000
    },
    data: [
      {rpm: 700, torque: 400, power: 29},
      {rpm: 900, torque: 450, power: 42},
      {rpm: 1000, torque: 550, power: 58},
      {rpm: 1100, torque: 625, power: 72},
      {rpm: 1200, torque: 700, power: 88},
      {rpm: 1400, torque: 760, power: 111},
      {rpm: 1500, torque: 760, power: 119},
      {rpm: 1800, torque: 760, power: 143},
      {rpm: 2000, torque: 705, power: 148},
      {rpm: 2100, torque: 690, power: 152},
      {rpm: 2200, torque: 659, power: 152},
      {rpm: 2300, torque: 632, power: 152},
      {rpm: 2500, torque: 535, power: 140},
      {rpm: 2525, torque: 515, power: 136},
      {rpm: 2850, torque: 0, power: 0}
    ],
    accessories: [
      {name: 'Fan (Kavramalı Fan)', standardLoss: 22.4, userLoss: 22.4},
      {name: 'Alternatör / Jeneratör', standardLoss: 2.8, userLoss: 2.8},
      {name: 'Hava Kompresörü', standardLoss: 1.4, userLoss: 1.4},
      {name: 'Direksiyon Pompası', standardLoss: 1.4, userLoss: 1.4},
      {name: 'Klima', standardLoss: 0, userLoss: 0},
      {name: 'Ek Tahrik', standardLoss: 0, userLoss: 0}
    ]
  },
  'isb67_fr98387': {
    name: 'ISB6.7 - FR98387',
    specs: {
      displacement: 6.70,
      idleRpm: 600,
      governedSpeed: 2800,
      noLoadGoverned: 2830,
      inertia: 0.9562
    },
    data: [
      {rpm: 800, torque: 610.0, power: 51.1},
      {rpm: 900, torque: 695.0, power: 65.5},
      {rpm: 1000, torque: 780.0, power: 81.7},
      {rpm: 1100, torque: 875.0, power: 100.8},
      {rpm: 1200, torque: 1000.0, power: 125.7},
      {rpm: 1300, torque: 1050.0, power: 142.9},
      {rpm: 1400, torque: 1100.0, power: 161.3},
      {rpm: 1500, torque: 1100.0, power: 172.8},
      {rpm: 1600, torque: 1100.0, power: 184.3},
      {rpm: 1700, torque: 1100.0, power: 195.8},
      {rpm: 1800, torque: 1075.0, power: 202.6},
      {rpm: 1900, torque: 1050.0, power: 208.9},
      {rpm: 2000, torque: 1025.0, power: 214.7},
      {rpm: 2100, torque: 1000.0, power: 219.9},
      {rpm: 2200, torque: 985.0, power: 226.9},
      {rpm: 2300, torque: 960.0, power: 231.2},
      {rpm: 2400, torque: 950.0, power: 238.8},
      {rpm: 2500, torque: 940.0, power: 246.1},
      {rpm: 2600, torque: 915.0, power: 249.1},
      {rpm: 2700, torque: 887.5, power: 250.9},
      {rpm: 2800, torque: 860.0, power: 252.2},
      {rpm: 2830, torque: 0, power: 0}
    ],
    accessories: [
      {name: 'Fan (Kavramalı Fan)', standardLoss: 20.2, userLoss: 20.2},
      {name: 'Alternatör / Jeneratör', standardLoss: 2.1, userLoss: 2.1},
      {name: 'Hava Kompresörü', standardLoss: 1.4, userLoss: 1.4},
      {name: 'Direksiyon Pompası', standardLoss: 1.6, userLoss: 1.6},
      {name: 'Klima', standardLoss: 0, userLoss: 0},
      {name: 'Ek Tahrik', standardLoss: 0, userLoss: 0}
    ]
  },
  'isb67e3_185_fr95009': {
    name: 'ISB6.7e3 185 | FR95009',
    specs: {
      displacement: 6.70,
      idleRpm: 800,
      governedSpeed: 2500,
      noLoadGoverned: 2850,
      inertia: 1.2000
    },
    data: [
      {rpm: 800, torque: 600, power: 50.3},
      {rpm: 1000, torque: 650, power: 68.1},
      {rpm: 1200, torque: 700, power: 88},
      {rpm: 1400, torque: 700, power: 102.6},
      {rpm: 1600, torque: 700, power: 117.3},
      {rpm: 1700, torque: 700, power: 124.6},
      {rpm: 1900, torque: 660, power: 131.3},
      {rpm: 2100, torque: 617, power: 135.7},
      {rpm: 2500, torque: 520, power: 136.1},
      {rpm: 2850, torque: 0, power: 0}
    ],
    accessories: [
      {name: 'Fan (Kavramalı Fan)', standardLoss: 22.4, userLoss: 22.4},
      {name: 'Alternatör / Jeneratör', standardLoss: 2.8, userLoss: 2.8},
      {name: 'Hava Kompresörü', standardLoss: 1.4, userLoss: 1.4},
      {name: 'Direksiyon Pompası', standardLoss: 1.4, userLoss: 1.4},
      {name: 'Klima', standardLoss: 0, userLoss: 0},
      {name: 'Ek Tahrik', standardLoss: 0, userLoss: 0}
    ]
  },
  'isb67e3_210_fr95010': {
    name: 'ISB6.7e3 210 | FR95010',
    specs: {
      displacement: 6.70,
      idleRpm: 800,
      governedSpeed: 2500,
      noLoadGoverned: 2850,
      inertia: 1.2000
    },
    data: [
      {rpm: 800, torque: 600, power: 50.3},
      {rpm: 1000, torque: 700, power: 73.3},
      {rpm: 1200, torque: 800, power: 100.5},
      {rpm: 1400, torque: 800, power: 117.3},
      {rpm: 1600, torque: 800, power: 134},
      {rpm: 1700, torque: 800, power: 142.4},
      {rpm: 1900, torque: 748, power: 148.8},
      {rpm: 2100, torque: 694, power: 152.6},
      {rpm: 2500, torque: 590, power: 154.5},
      {rpm: 2850, torque: 0, power: 0}
    ],
    accessories: [
      {name: 'Fan (Kavramalı Fan)', standardLoss: 22.4, userLoss: 22.4},
      {name: 'Alternatör / Jeneratör', standardLoss: 2.8, userLoss: 2.8},
      {name: 'Hava Kompresörü', standardLoss: 1.4, userLoss: 1.4},
      {name: 'Direksiyon Pompası', standardLoss: 1.4, userLoss: 1.4},
      {name: 'Klima', standardLoss: 0, userLoss: 0},
      {name: 'Ek Tahrik', standardLoss: 0, userLoss: 0}
    ]
  },
  'isb67e3_230_fr95011': {
    name: 'ISB6.7e3 230 | FR95011',
    specs: {
      displacement: 6.70,
      idleRpm: 800,
      governedSpeed: 2500,
      noLoadGoverned: 2850,
      inertia: 1.2000
    },
    data: [
      {rpm: 800, torque: 600, power: 50.3},
      {rpm: 1000, torque: 750, power: 78.5},
      {rpm: 1200, torque: 900, power: 113.1},
      {rpm: 1400, torque: 900, power: 132},
      {rpm: 1600, torque: 900, power: 150.8},
      {rpm: 1700, torque: 900, power: 160.2},
      {rpm: 1900, torque: 838, power: 166.7},
      {rpm: 2100, torque: 774, power: 170.2},
      {rpm: 2500, torque: 646, power: 169.1},
      {rpm: 2850, torque: 0, power: 0}
    ],
    accessories: [
      {name: 'Fan (Kavramalı Fan)', standardLoss: 22.4, userLoss: 22.4},
      {name: 'Alternatör / Jeneratör', standardLoss: 2.8, userLoss: 2.8},
      {name: 'Hava Kompresörü', standardLoss: 1.4, userLoss: 1.4},
      {name: 'Direksiyon Pompası', standardLoss: 1.4, userLoss: 1.4},
      {name: 'Klima', standardLoss: 0, userLoss: 0},
      {name: 'Ek Tahrik', standardLoss: 0, userLoss: 0}
    ]
  },
  'isb67e3_245_fr95012': {
    name: 'ISB6.7e3 245 | FR95012',
    specs: {
      displacement: 6.70,
      idleRpm: 800,
      governedSpeed: 2500,
      noLoadGoverned: 2850,
      inertia: 1.2000
    },
    data: [
      {rpm: 800, torque: 600, power: 50.3},
      {rpm: 1000, torque: 750, power: 78.5},
      {rpm: 1200, torque: 925, power: 116.2},
      {rpm: 1400, torque: 925, power: 135.6},
      {rpm: 1600, torque: 925, power: 155},
      {rpm: 1700, torque: 925, power: 164.7},
      {rpm: 1900, torque: 867, power: 172.5},
      {rpm: 2100, torque: 808, power: 177.7},
      {rpm: 2500, torque: 688, power: 180.1},
      {rpm: 2850, torque: 0, power: 0}
    ],
    accessories: [
      {name: 'Fan (Kavramalı Fan)', standardLoss: 22.4, userLoss: 22.4},
      {name: 'Alternatör / Jeneratör', standardLoss: 2.8, userLoss: 2.8},
      {name: 'Hava Kompresörü', standardLoss: 1.4, userLoss: 1.4},
      {name: 'Direksiyon Pompası', standardLoss: 1.4, userLoss: 1.4},
      {name: 'Klima', standardLoss: 0, userLoss: 0},
      {name: 'Ek Tahrik', standardLoss: 0, userLoss: 0}
    ]
  },
  'isb67e3_285_fr95014': {
    name: 'ISB6.7e3 285 | FR95014',
    specs: {
      displacement: 6.70,
      idleRpm: 800,
      governedSpeed: 2500,
      noLoadGoverned: 2850,
      inertia: 1.2000
    },
    data: [
      {rpm: 800, torque: 600, power: 50.3},
      {rpm: 1000, torque: 780, power: 81.7},
      {rpm: 1200, torque: 970, power: 121.9},
      {rpm: 1400, torque: 970, power: 142.2},
      {rpm: 1600, torque: 970, power: 162.5},
      {rpm: 1700, torque: 970, power: 172.7},
      {rpm: 1900, torque: 928, power: 184.6},
      {rpm: 2100, torque: 886, power: 194.8},
      {rpm: 2500, torque: 801, power: 209.7},
      {rpm: 2850, torque: 0, power: 0}
    ],
    accessories: [
      {name: 'Fan (Kavramalı Fan)', standardLoss: 22.4, userLoss: 22.4},
      {name: 'Alternatör / Jeneratör', standardLoss: 2.8, userLoss: 2.8},
      {name: 'Hava Kompresörü', standardLoss: 1.4, userLoss: 1.4},
      {name: 'Direksiyon Pompası', standardLoss: 1.4, userLoss: 1.4},
      {name: 'Klima', standardLoss: 0, userLoss: 0},
      {name: 'Ek Tahrik', standardLoss: 0, userLoss: 0}
    ]
  },
  'isb67e3_360_fr93831': {
    name: 'ISB6.7e3 360 | FR93831',
    specs: {
      displacement: 6.70,
      idleRpm: 800,
      governedSpeed: 2630,
      noLoadGoverned: 2900,
      inertia: 1.2000
    },
    data: [
      {rpm: 800, torque: 670, power: 56},
      {rpm: 900, torque: 752, power: 71},
      {rpm: 1000, torque: 859, power: 90},
      {rpm: 1100, torque: 952, power: 110},
      {rpm: 1200, torque: 1000, power: 126},
      {rpm: 1400, torque: 1100, power: 161},
      {rpm: 1700, torque: 1100, power: 196},
      {rpm: 2000, torque: 1100, power: 230},
      {rpm: 2300, torque: 1100, power: 265},
      {rpm: 2400, torque: 1070, power: 269},
      {rpm: 2500, torque: 1027, power: 269},
      {rpm: 2600, torque: 985, power: 268},
      {rpm: 2630, torque: 930, power: 256},
      {rpm: 2900, torque: 0, power: 0}
    ],
    accessories: [
      {name: 'Fan (Kavramalı Fan)', standardLoss: 22.4, userLoss: 22.4},
      {name: 'Alternatör / Jeneratör', standardLoss: 2.8, userLoss: 2.8},
      {name: 'Hava Kompresörü', standardLoss: 1.4, userLoss: 1.4},
      {name: 'Direksiyon Pompası', standardLoss: 1.4, userLoss: 1.4},
      {name: 'Klima', standardLoss: 0, userLoss: 0},
      {name: 'Ek Tahrik', standardLoss: 0, userLoss: 0}
    ]
  },
  'isb67e3_360_fr97819': {
    name: 'ISB6.7e3 360 | FR97819',
    specs: {
      displacement: 6.70,
      idleRpm: 800,
      governedSpeed: 2630,
      noLoadGoverned: 2900,
      inertia: 1.2000
    },
    data: [
      {rpm: 800, torque: 670, power: 56},
      {rpm: 900, torque: 752, power: 71},
      {rpm: 1000, torque: 859, power: 90},
      {rpm: 1100, torque: 952, power: 110},
      {rpm: 1200, torque: 1000, power: 126},
      {rpm: 1400, torque: 1100, power: 161},
      {rpm: 1700, torque: 1100, power: 196},
      {rpm: 2000, torque: 1100, power: 230},
      {rpm: 2300, torque: 1100, power: 265},
      {rpm: 2400, torque: 1070, power: 269},
      {rpm: 2500, torque: 1027, power: 269},
      {rpm: 2600, torque: 985, power: 268},
      {rpm: 2630, torque: 930, power: 256},
      {rpm: 2900, torque: 0, power: 0}
    ],
    accessories: [
      {name: 'Fan (Kavramalı Fan)', standardLoss: 22.4, userLoss: 22.4},
      {name: 'Alternatör / Jeneratör', standardLoss: 2.8, userLoss: 2.8},
      {name: 'Hava Kompresörü', standardLoss: 1.4, userLoss: 1.4},
      {name: 'Direksiyon Pompası', standardLoss: 1.4, userLoss: 1.4},
      {name: 'Klima', standardLoss: 0, userLoss: 0},
      {name: 'Ek Tahrik', standardLoss: 0, userLoss: 0}
    ]
  },
  'isb67e3_360_fr97819_d2000': {
    name: 'ISB6.7e3 360 | FR97819 derate 2000m',
    specs: {
      displacement: 6.70,
      idleRpm: 800,
      governedSpeed: 2630,
      noLoadGoverned: 2900,
      inertia: 1.2000
    },
    data: [
      {rpm: 800, torque: 670, power: 56.1},
      {rpm: 900, torque: 730, power: 68.8},
      {rpm: 1000, torque: 800, power: 83.8},
      {rpm: 1100, torque: 950, power: 109.4},
      {rpm: 1200, torque: 1000, power: 125.7},
      {rpm: 1300, torque: 1050, power: 142.9},
      {rpm: 1400, torque: 1100, power: 161.3},
      {rpm: 1500, torque: 1100, power: 172.8},
      {rpm: 1600, torque: 1068, power: 179},
      {rpm: 1700, torque: 1036, power: 184.4},
      {rpm: 1800, torque: 1004, power: 189.3},
      {rpm: 1900, torque: 1021, power: 203.2},
      {rpm: 2000, torque: 1029, power: 215.5},
      {rpm: 2100, torque: 1044, power: 229.6},
      {rpm: 2200, torque: 982, power: 226.2},
      {rpm: 2300, torque: 965, power: 232.4},
      {rpm: 2400, torque: 887, power: 222.9},
      {rpm: 2630, torque: 750, power: 206.6},
      {rpm: 2900, torque: 0, power: 0}
    ],
    accessories: [
      {name: 'Fan (Kavramalı Fan)', standardLoss: 22.4, userLoss: 22.4},
      {name: 'Alternatör / Jeneratör', standardLoss: 2.8, userLoss: 2.8},
      {name: 'Hava Kompresörü', standardLoss: 1.4, userLoss: 1.4},
      {name: 'Direksiyon Pompası', standardLoss: 1.4, userLoss: 1.4},
      {name: 'Klima', standardLoss: 0, userLoss: 0},
      {name: 'Ek Tahrik', standardLoss: 0, userLoss: 0}
    ]
  },
  'isb67ex_300_fr93522': {
    name: 'ISB6.7ex 300 | FR93522',
    specs: {
      displacement: 6.70,
      idleRpm: 800,
      governedSpeed: 2800,
      noLoadGoverned: 3000,
      inertia: 1.2000
    },
    data: [
      {rpm: 800, torque: 695, power: 58},
      {rpm: 1000, torque: 731, power: 77},
      {rpm: 1200, torque: 813, power: 102},
      {rpm: 1400, torque: 813, power: 119},
      {rpm: 1600, torque: 813, power: 136},
      {rpm: 1800, torque: 813, power: 153},
      {rpm: 2000, torque: 813, power: 179},
      {rpm: 2200, torque: 813, power: 187},
      {rpm: 2400, torque: 813, power: 204},
      {rpm: 2500, torque: 813, power: 213},
      {rpm: 2600, torque: 813, power: 221},
      {rpm: 2700, torque: 755, power: 213},
      {rpm: 2800, torque: 719, power: 211},
      {rpm: 3000, torque: 0, power: 0}
    ],
    accessories: [
      {name: 'Fan (Kavramalı Fan)', standardLoss: 22.4, userLoss: 22.4},
      {name: 'Alternatör / Jeneratör', standardLoss: 2.8, userLoss: 2.8},
      {name: 'Hava Kompresörü', standardLoss: 1.4, userLoss: 1.4},
      {name: 'Direksiyon Pompası', standardLoss: 1.4, userLoss: 1.4},
      {name: 'Klima', standardLoss: 0, userLoss: 0},
      {name: 'Ek Tahrik', standardLoss: 0, userLoss: 0}
    ]
  },
  'isg12e3_380_fr20522': {
    name: 'ISG12e3 380 | FR20522',
    specs: {
      displacement: 11.80,
      idleRpm: 1000,
      governedSpeed: 1900,
      noLoadGoverned: 2100,
      inertia: 2.5000
    },
    data: [
      {rpm: 1000, torque: 2000, power: 209.4},
      {rpm: 1100, torque: 2000, power: 230.4},
      {rpm: 1200, torque: 2000, power: 251.3},
      {rpm: 1300, torque: 2000, power: 272.3},
      {rpm: 1400, torque: 1931, power: 283.1},
      {rpm: 1500, torque: 1803, power: 283.2},
      {rpm: 1600, torque: 1690, power: 283.2},
      {rpm: 1700, torque: 1591, power: 283.2},
      {rpm: 1800, torque: 1502, power: 283.1},
      {rpm: 1900, torque: 1405, power: 279.6},
      {rpm: 2100, torque: 0, power: 0}
    ],
    accessories: [
      {name: 'Fan (Kavramalı Fan)', standardLoss: 22.4, userLoss: 22.4},
      {name: 'Alternatör / Jeneratör', standardLoss: 2.8, userLoss: 2.8},
      {name: 'Hava Kompresörü', standardLoss: 1.4, userLoss: 1.4},
      {name: 'Direksiyon Pompası', standardLoss: 1.4, userLoss: 1.4},
      {name: 'Klima', standardLoss: 0, userLoss: 0},
      {name: 'Ek Tahrik', standardLoss: 0, userLoss: 0}
    ]
  },
  'isg12e3_400_fr20523': {
    name: 'ISG12e3 400 | FR20523',
    specs: {
      displacement: 11.80,
      idleRpm: 1000,
      governedSpeed: 1900,
      noLoadGoverned: 2100,
      inertia: 2.5000
    },
    data: [
      {rpm: 1000, torque: 2000, power: 209.4},
      {rpm: 1100, torque: 2000, power: 230.4},
      {rpm: 1200, torque: 2000, power: 251.3},
      {rpm: 1300, torque: 2000, power: 272.3},
      {rpm: 1400, torque: 2000, power: 293.2},
      {rpm: 1500, torque: 1896, power: 297.8},
      {rpm: 1600, torque: 1778, power: 297.9},
      {rpm: 1700, torque: 1673, power: 297.8},
      {rpm: 1800, torque: 1580, power: 297.8},
      {rpm: 1900, torque: 1479, power: 294.3},
      {rpm: 2100, torque: 0, power: 0}
    ],
    accessories: [
      {name: 'Fan (Kavramalı Fan)', standardLoss: 22.4, userLoss: 22.4},
      {name: 'Alternatör / Jeneratör', standardLoss: 2.8, userLoss: 2.8},
      {name: 'Hava Kompresörü', standardLoss: 1.4, userLoss: 1.4},
      {name: 'Direksiyon Pompası', standardLoss: 1.4, userLoss: 1.4},
      {name: 'Klima', standardLoss: 0, userLoss: 0},
      {name: 'Ek Tahrik', standardLoss: 0, userLoss: 0}
    ]
  },
  'isg12e3_430_fr20547': {
    name: 'ISG12e3 430 | FR20547',
    specs: {
      displacement: 11.80,
      idleRpm: 1000,
      governedSpeed: 1900,
      noLoadGoverned: 2100,
      inertia: 2.5000
    },
    data: [
      {rpm: 1000, torque: 2000, power: 209.4},
      {rpm: 1100, torque: 2000, power: 230.4},
      {rpm: 1200, torque: 2000, power: 251.3},
      {rpm: 1300, torque: 2000, power: 272.3},
      {rpm: 1400, torque: 2000, power: 293.2},
      {rpm: 1500, torque: 1955, power: 307.1},
      {rpm: 1600, torque: 1909, power: 319.9},
      {rpm: 1700, torque: 1797, power: 319.9},
      {rpm: 1800, torque: 1697, power: 319.9},
      {rpm: 1900, torque: 1589, power: 316.2},
      {rpm: 2100, torque: 0, power: 0}
    ],
    accessories: [
      {name: 'Fan (Kavramalı Fan)', standardLoss: 22.4, userLoss: 22.4},
      {name: 'Alternatör / Jeneratör', standardLoss: 2.8, userLoss: 2.8},
      {name: 'Hava Kompresörü', standardLoss: 1.4, userLoss: 1.4},
      {name: 'Direksiyon Pompası', standardLoss: 1.4, userLoss: 1.4},
      {name: 'Klima', standardLoss: 0, userLoss: 0},
      {name: 'Ek Tahrik', standardLoss: 0, userLoss: 0}
    ]
  },
  'isl89e3_375_fr94882': {
    name: 'ISL8.9e3 375 | FR94882',
    specs: {
      displacement: 8.90,
      idleRpm: 800,
      governedSpeed: 2100,
      noLoadGoverned: 2330,
      inertia: 1.6000
    },
    data: [
      {rpm: 800, torque: 950, power: 79.6},
      {rpm: 1000, torque: 1356, power: 142},
      {rpm: 1100, torque: 1550, power: 178.6},
      {rpm: 1200, torque: 1550, power: 194.8},
      {rpm: 1400, torque: 1550, power: 227.2},
      {rpm: 1500, torque: 1508, power: 236.9},
      {rpm: 1600, torque: 1466, power: 245.6},
      {rpm: 1700, torque: 1424, power: 253.5},
      {rpm: 1800, torque: 1380, power: 260.1},
      {rpm: 1900, torque: 1338, power: 266.2},
      {rpm: 2000, torque: 1296, power: 271.4},
      {rpm: 2100, torque: 1250, power: 274.9},
      {rpm: 2330, torque: 0, power: 0}
    ],
    accessories: [
      {name: 'Fan (Kavramalı Fan)', standardLoss: 22.4, userLoss: 22.4},
      {name: 'Alternatör / Jeneratör', standardLoss: 2.8, userLoss: 2.8},
      {name: 'Hava Kompresörü', standardLoss: 1.4, userLoss: 1.4},
      {name: 'Direksiyon Pompası', standardLoss: 1.4, userLoss: 1.4},
      {name: 'Klima', standardLoss: 0, userLoss: 0},
      {name: 'Ek Tahrik', standardLoss: 0, userLoss: 0}
    ]
  },
  'isle_t450_fr92598': {
    name: 'ISLe-T450 | FR92598',
    specs: {
      displacement: 8.90,
      idleRpm: 800,
      governedSpeed: 2200,
      noLoadGoverned: 2400,
      inertia: 1.6000
    },
    data: [
      {rpm: 800, torque: 1287, power: 107.8},
      {rpm: 900, torque: 1355, power: 127.7},
      {rpm: 1000, torque: 1423, power: 149},
      {rpm: 1100, torque: 1491, power: 171.8},
      {rpm: 1200, torque: 1559, power: 195.9},
      {rpm: 1300, torque: 1627, power: 221.5},
      {rpm: 1400, torque: 1627, power: 238.5},
      {rpm: 1500, torque: 1627, power: 255.6},
      {rpm: 1600, torque: 1603, power: 268.6},
      {rpm: 1700, torque: 1579, power: 281.1},
      {rpm: 1800, torque: 1555, power: 293.1},
      {rpm: 1900, torque: 1530, power: 304.4},
      {rpm: 2000, torque: 1506, power: 315.4},
      {rpm: 2100, torque: 1482, power: 325.9},
      {rpm: 2200, torque: 1458, power: 335.9},
      {rpm: 2400, torque: 0, power: 0}
    ],
    accessories: [
      {name: 'Fan (Kavramalı Fan)', standardLoss: 22.4, userLoss: 22.4},
      {name: 'Alternatör / Jeneratör', standardLoss: 2.8, userLoss: 2.8},
      {name: 'Hava Kompresörü', standardLoss: 1.4, userLoss: 1.4},
      {name: 'Direksiyon Pompası', standardLoss: 1.4, userLoss: 1.4},
      {name: 'Klima', standardLoss: 0, userLoss: 0},
      {name: 'Ek Tahrik', standardLoss: 0, userLoss: 0}
    ]
  },
  'isle3_400_fr95441': {
    name: 'ISLe3 400 | FR95441',
    specs: {
      displacement: 8.90,
      idleRpm: 700,
      governedSpeed: 2100,
      noLoadGoverned: 2330,
      inertia: 1.6000
    },
    data: [
      {rpm: 700, torque: 700, power: 51.3},
      {rpm: 800, torque: 950, power: 79.6},
      {rpm: 900, torque: 1153, power: 108.7},
      {rpm: 1000, torque: 1356, power: 142},
      {rpm: 1100, torque: 1550, power: 178.6},
      {rpm: 1200, torque: 1550, power: 194.8},
      {rpm: 1300, torque: 1550, power: 211},
      {rpm: 1400, torque: 1550, power: 227.2},
      {rpm: 1500, torque: 1508, power: 236.9},
      {rpm: 1600, torque: 1466, power: 245.6},
      {rpm: 1700, torque: 1424, power: 253.5},
      {rpm: 1800, torque: 1405, power: 264.8},
      {rpm: 1900, torque: 1389, power: 276.4},
      {rpm: 2000, torque: 1410, power: 295.3},
      {rpm: 2100, torque: 1355, power: 298},
      {rpm: 2330, torque: 0, power: 0}
    ],
    accessories: [
      {name: 'Fan (Kavramalı Fan)', standardLoss: 22.4, userLoss: 22.4},
      {name: 'Alternatör / Jeneratör', standardLoss: 2.8, userLoss: 2.8},
      {name: 'Hava Kompresörü', standardLoss: 1.4, userLoss: 1.4},
      {name: 'Direksiyon Pompası', standardLoss: 1.4, userLoss: 1.4},
      {name: 'Klima', standardLoss: 0, userLoss: 0},
      {name: 'Ek Tahrik', standardLoss: 0, userLoss: 0}
    ]
  },
  'ism_500_fr21020': {
    name: 'ISM 500 | FR21020',
    specs: {
      displacement: 10.80,
      idleRpm: 1100,
      governedSpeed: 2100,
      noLoadGoverned: 2300,
      inertia: 2.2000
    },
    data: [
      {rpm: 1100, torque: 1831, power: 210.9},
      {rpm: 1200, torque: 2102, power: 264.2},
      {rpm: 1300, torque: 2102, power: 286.2},
      {rpm: 1400, torque: 2102, power: 308.2},
      {rpm: 1500, torque: 2102, power: 330.2},
      {rpm: 1600, torque: 2102, power: 352.2},
      {rpm: 1700, torque: 2041, power: 363.4},
      {rpm: 1800, torque: 1980, power: 373.2},
      {rpm: 1900, torque: 1837, power: 365.5},
      {rpm: 2000, torque: 1709, power: 357.9},
      {rpm: 2100, torque: 1593, power: 350.3},
      {rpm: 2300, torque: 0, power: 0}
    ],
    accessories: [
      {name: 'Fan (Kavramalı Fan)', standardLoss: 22.4, userLoss: 22.4},
      {name: 'Alternatör / Jeneratör', standardLoss: 2.8, userLoss: 2.8},
      {name: 'Hava Kompresörü', standardLoss: 1.4, userLoss: 1.4},
      {name: 'Direksiyon Pompası', standardLoss: 1.4, userLoss: 1.4},
      {name: 'Klima', standardLoss: 0, userLoss: 0},
      {name: 'Ek Tahrik', standardLoss: 0, userLoss: 0}
    ]
  },
  'isme2_380_fr2695': {
    name: 'ISMe2 380 | FR2695',
    specs: {
      displacement: 10.80,
      idleRpm: 1000,
      governedSpeed: 1900,
      noLoadGoverned: 2130,
      inertia: 2.2000
    },
    data: [
      {rpm: 1000, torque: 1560, power: 163.4},
      {rpm: 1100, torque: 1763, power: 203.1},
      {rpm: 1200, torque: 1825, power: 229.3},
      {rpm: 1300, torque: 1817, power: 247.4},
      {rpm: 1400, torque: 1776, power: 260.4},
      {rpm: 1500, torque: 1708, power: 268.3},
      {rpm: 1600, torque: 1634, power: 273.8},
      {rpm: 1700, torque: 1558, power: 277.4},
      {rpm: 1800, torque: 1479, power: 278.8},
      {rpm: 1900, torque: 1406, power: 279.8},
      {rpm: 2130, torque: 0, power: 0}
    ],
    accessories: [
      {name: 'Fan (Kavramalı Fan)', standardLoss: 22.4, userLoss: 22.4},
      {name: 'Alternatör / Jeneratör', standardLoss: 2.8, userLoss: 2.8},
      {name: 'Hava Kompresörü', standardLoss: 1.4, userLoss: 1.4},
      {name: 'Direksiyon Pompası', standardLoss: 1.4, userLoss: 1.4},
      {name: 'Klima', standardLoss: 0, userLoss: 0},
      {name: 'Ek Tahrik', standardLoss: 0, userLoss: 0}
    ]
  },
  'isme2_440_fr2578': {
    name: 'ISMe2 440 | FR2578',
    specs: {
      displacement: 10.80,
      idleRpm: 800,
      governedSpeed: 1900,
      noLoadGoverned: 2130,
      inertia: 2.2000
    },
    data: [
      {rpm: 800, torque: 1250, power: 104.7},
      {rpm: 900, torque: 1464, power: 138},
      {rpm: 1000, torque: 1695, power: 177.5},
      {rpm: 1100, torque: 1910, power: 220},
      {rpm: 1200, torque: 2100, power: 263.9},
      {rpm: 1300, torque: 2100, power: 285.9},
      {rpm: 1400, torque: 2040, power: 299.1},
      {rpm: 1500, torque: 1975, power: 310.2},
      {rpm: 1600, torque: 1885, power: 315.8},
      {rpm: 1700, torque: 1798, power: 320.1},
      {rpm: 1800, torque: 1717, power: 323.7},
      {rpm: 1900, torque: 1600, power: 318.4},
      {rpm: 2130, torque: 0, power: 0}
    ],
    accessories: [
      {name: 'Fan (Kavramalı Fan)', standardLoss: 22.4, userLoss: 22.4},
      {name: 'Alternatör / Jeneratör', standardLoss: 2.8, userLoss: 2.8},
      {name: 'Hava Kompresörü', standardLoss: 1.4, userLoss: 1.4},
      {name: 'Direksiyon Pompası', standardLoss: 1.4, userLoss: 1.4},
      {name: 'Klima', standardLoss: 0, userLoss: 0},
      {name: 'Ek Tahrik', standardLoss: 0, userLoss: 0}
    ]
  },
  'isme3_385_fr20317': {
    name: 'ISMe3 385 | FR20317',
    specs: {
      displacement: 10.80,
      idleRpm: 1000,
      governedSpeed: 1900,
      noLoadGoverned: 2130,
      inertia: 2.2000
    },
    data: [
      {rpm: 1000, torque: 1572, power: 164},
      {rpm: 1100, torque: 1775, power: 204},
      {rpm: 1200, torque: 1835, power: 230},
      {rpm: 1300, torque: 1830, power: 249},
      {rpm: 1400, torque: 1790, power: 262},
      {rpm: 1500, torque: 1724, power: 270},
      {rpm: 1600, torque: 1652, power: 277},
      {rpm: 1700, torque: 1578, power: 281},
      {rpm: 1800, torque: 1501, power: 283},
      {rpm: 1900, torque: 1431, power: 283},
      {rpm: 2130, torque: 0, power: 0}
    ],
    accessories: [
      {name: 'Fan (Kavramalı Fan)', standardLoss: 22.4, userLoss: 22.4},
      {name: 'Alternatör / Jeneratör', standardLoss: 2.8, userLoss: 2.8},
      {name: 'Hava Kompresörü', standardLoss: 1.4, userLoss: 1.4},
      {name: 'Direksiyon Pompası', standardLoss: 1.4, userLoss: 1.4},
      {name: 'Klima', standardLoss: 0, userLoss: 0},
      {name: 'Ek Tahrik', standardLoss: 0, userLoss: 0}
    ]
  },
  'isme3_385_fr2855': {
    name: 'ISMe3 385 | FR2855',
    specs: {
      displacement: 10.80,
      idleRpm: 1000,
      governedSpeed: 1900,
      noLoadGoverned: 2130,
      inertia: 2.2000
    },
    data: [
      {rpm: 1000, torque: 1572, power: 164},
      {rpm: 1100, torque: 1775, power: 204},
      {rpm: 1200, torque: 1835, power: 230},
      {rpm: 1300, torque: 1830, power: 249},
      {rpm: 1400, torque: 1790, power: 262},
      {rpm: 1500, torque: 1724, power: 270},
      {rpm: 1600, torque: 1652, power: 277},
      {rpm: 1700, torque: 1578, power: 281},
      {rpm: 1800, torque: 1501, power: 283},
      {rpm: 1900, torque: 1431, power: 283},
      {rpm: 2130, torque: 0, power: 0}
    ],
    accessories: [
      {name: 'Fan (Kavramalı Fan)', standardLoss: 22.4, userLoss: 22.4},
      {name: 'Alternatör / Jeneratör', standardLoss: 2.8, userLoss: 2.8},
      {name: 'Hava Kompresörü', standardLoss: 1.4, userLoss: 1.4},
      {name: 'Direksiyon Pompası', standardLoss: 1.4, userLoss: 1.4},
      {name: 'Klima', standardLoss: 0, userLoss: 0},
      {name: 'Ek Tahrik', standardLoss: 0, userLoss: 0}
    ]
  },
  'isme3_420_fr2854': {
    name: 'ISMe3 420 | FR2854',
    specs: {
      displacement: 10.80,
      idleRpm: 1000,
      governedSpeed: 1900,
      noLoadGoverned: 2130,
      inertia: 2.2000
    },
    data: [
      {rpm: 1000, torque: 1707, power: 178.7},
      {rpm: 1100, torque: 1922, power: 221.4},
      {rpm: 1200, torque: 2010, power: 252.6},
      {rpm: 1300, torque: 1974, power: 268.7},
      {rpm: 1400, torque: 1942, power: 284.7},
      {rpm: 1500, torque: 1891, power: 297},
      {rpm: 1600, torque: 1785, power: 299.1},
      {rpm: 1700, torque: 1692, power: 301.2},
      {rpm: 1800, torque: 1607, power: 302.9},
      {rpm: 1900, torque: 1541, power: 306.6},
      {rpm: 2130, torque: 0, power: 0}
    ],
    accessories: [
      {name: 'Fan (Kavramalı Fan)', standardLoss: 22.4, userLoss: 22.4},
      {name: 'Alternatör / Jeneratör', standardLoss: 2.8, userLoss: 2.8},
      {name: 'Hava Kompresörü', standardLoss: 1.4, userLoss: 1.4},
      {name: 'Direksiyon Pompası', standardLoss: 1.4, userLoss: 1.4},
      {name: 'Klima', standardLoss: 0, userLoss: 0},
      {name: 'Ek Tahrik', standardLoss: 0, userLoss: 0}
    ]
  },
  'ism_380_fr20317': {
    name: 'ISM 380 | FR20317',
    specs: {
      displacement: 10.80,
      idleRpm: 1000,
      governedSpeed: 1900,
      noLoadGoverned: 2130,
      inertia: 2.2000
    },
    data: [
      {rpm: 1000, torque: 1530.7, power: 160.3},
      {rpm: 1100, torque: 1736.2, power: 200.0},
      {rpm: 1200, torque: 1798.2, power: 226.0},
      {rpm: 1300, torque: 1794.9, power: 244.4},
      {rpm: 1400, torque: 1756.4, power: 257.5},
      {rpm: 1500, torque: 1691.7, power: 265.7},
      {rpm: 1600, torque: 1620.8, power: 271.6},
      {rpm: 1700, torque: 1547.8, power: 275.6},
      {rpm: 1800, torque: 1471.7, power: 277.4},
      {rpm: 1900, torque: 1402.5, power: 279.1},
      {rpm: 2130, torque: 0, power: 0}
    ],
    accessories: [
      {name: 'Fan (Kavramalı Fan)', standardLoss: 0, userLoss: 0},
      {name: 'Alternatör / Jeneratör', standardLoss: 0, userLoss: 0},
      {name: 'Hava Kompresörü', standardLoss: 0, userLoss: 0},
      {name: 'Direksiyon Pompası', standardLoss: 0, userLoss: 0},
      {name: 'Klima', standardLoss: 0, userLoss: 0},
      {name: 'Ek Tahrik', standardLoss: 0, userLoss: 0}
    ]
  },
  'isl_330': {
    name: 'ISL 330',
    specs: {
      displacement: 8.90,
      idleRpm: 1200,
      governedSpeed: 2200,
      noLoadGoverned: 2400,
      inertia: 1.8000
    },
    data: [
      {rpm: 1200, torque: 1385.9, power: 174.2},
      {rpm: 1300, torque: 1461.9, power: 199.0},
      {rpm: 1400, torque: 1461.8, power: 214.3},
      {rpm: 1500, torque: 1430.3, power: 224.7},
      {rpm: 1600, torque: 1377.0, power: 230.7},
      {rpm: 1700, torque: 1356.9, power: 241.6},
      {rpm: 1900, torque: 1164.1, power: 231.6},
      {rpm: 2000, torque: 1073.5, power: 224.8},
      {rpm: 2200, torque: 883.9, power: 203.6},
      {rpm: 2400, torque: 0, power: 0}
    ],
    accessories: [
      {name: 'Fan (Kavramalı Fan)', standardLoss: 0, userLoss: 0},
      {name: 'Alternatör / Jeneratör', standardLoss: 0, userLoss: 0},
      {name: 'Hava Kompresörü', standardLoss: 0, userLoss: 0},
      {name: 'Direksiyon Pompası', standardLoss: 0, userLoss: 0},
      {name: 'Klima', standardLoss: 0, userLoss: 0},
      {name: 'Ek Tahrik', standardLoss: 0, userLoss: 0}
    ]
  },
  'isx_525_fr11926': {
    name: 'ISX 525 | FR11926',
    specs: {
      displacement: 15.00,
      idleRpm: 600,
      governedSpeed: 2000,
      noLoadGoverned: 2030,
      inertia: 3.0000
    },
    data: [
      {rpm: 600, torque: 1245, power: 78},
      {rpm: 700, torque: 1384, power: 101},
      {rpm: 800, torque: 1513, power: 127},
      {rpm: 900, torque: 1695, power: 160},
      {rpm: 965, torque: 1790, power: 181},
      {rpm: 1000, torque: 1871, power: 196},
      {rpm: 1100, torque: 2237, power: 258},
      {rpm: 1200, torque: 2237, power: 281},
      {rpm: 1300, torque: 2237, power: 305},
      {rpm: 1400, torque: 2237, power: 328},
      {rpm: 1500, torque: 2237, power: 351},
      {rpm: 1600, torque: 2237, power: 375},
      {rpm: 1700, torque: 2224, power: 396},
      {rpm: 1800, torque: 2101, power: 396},
      {rpm: 1900, torque: 1979, power: 394},
      {rpm: 2000, torque: 1868, power: 391},
      {rpm: 2030, torque: 0, power: 0}
    ],
    accessories: [
      {name: 'Fan (Kavramalı Fan)', standardLoss: 22.4, userLoss: 22.4},
      {name: 'Alternatör / Jeneratör', standardLoss: 2.8, userLoss: 2.8},
      {name: 'Hava Kompresörü', standardLoss: 1.4, userLoss: 1.4},
      {name: 'Direksiyon Pompası', standardLoss: 1.4, userLoss: 1.4},
      {name: 'Klima', standardLoss: 0, userLoss: 0},
      {name: 'Ek Tahrik', standardLoss: 0, userLoss: 0}
    ]
  },
  'isx_sig600_fr10149': {
    name: 'ISX Sig600 | FR10149',
    specs: {
      displacement: 15.00,
      idleRpm: 1100,
      governedSpeed: 2000,
      noLoadGoverned: 2030,
      inertia: 3.0000
    },
    data: [
      {rpm: 1100, torque: 2780, power: 320.2},
      {rpm: 1200, torque: 2780, power: 349.4},
      {rpm: 1300, torque: 2780, power: 378.5},
      {rpm: 1400, torque: 2780, power: 407.6},
      {rpm: 1500, torque: 2732, power: 429.2},
      {rpm: 1600, torque: 2679, power: 448.9},
      {rpm: 1700, torque: 2613, power: 465.2},
      {rpm: 1800, torque: 2496, power: 470.5},
      {rpm: 1900, torque: 2317, power: 461},
      {rpm: 2000, torque: 2137, power: 447.6},
      {rpm: 2030, torque: 0, power: 0}
    ],
    accessories: [
      {name: 'Fan (Kavramalı Fan)', standardLoss: 22.4, userLoss: 22.4},
      {name: 'Alternatör / Jeneratör', standardLoss: 2.8, userLoss: 2.8},
      {name: 'Hava Kompresörü', standardLoss: 1.4, userLoss: 1.4},
      {name: 'Direksiyon Pompası', standardLoss: 1.4, userLoss: 1.4},
      {name: 'Klima', standardLoss: 0, userLoss: 0},
      {name: 'Ek Tahrik', standardLoss: 0, userLoss: 0}
    ]
  },
  'isx15_600_fr11779': {
    name: 'ISX15 600 | FR11779',
    specs: {
      displacement: 15.00,
      idleRpm: 600,
      governedSpeed: 2000,
      noLoadGoverned: 2030,
      inertia: 3.0000
    },
    data: [
      {rpm: 600, torque: 1245, power: 78.2},
      {rpm: 700, torque: 1384, power: 101.5},
      {rpm: 800, torque: 1513, power: 126.8},
      {rpm: 900, torque: 1695, power: 159.8},
      {rpm: 965, torque: 1830, power: 184.9},
      {rpm: 1000, torque: 1966, power: 205.9},
      {rpm: 1100, torque: 2508, power: 288.9},
      {rpm: 1200, torque: 2508, power: 315.2},
      {rpm: 1400, torque: 2508, power: 367.7},
      {rpm: 1500, torque: 2508, power: 394},
      {rpm: 1600, torque: 2508, power: 420.2},
      {rpm: 1700, torque: 2429, power: 432.4},
      {rpm: 1800, torque: 2314, power: 436.2},
      {rpm: 1900, torque: 2230, power: 443.7},
      {rpm: 2000, torque: 2137, power: 447.6},
      {rpm: 2030, torque: 0, power: 0}
    ],
    accessories: [
      {name: 'Fan (Kavramalı Fan)', standardLoss: 22.4, userLoss: 22.4},
      {name: 'Alternatör / Jeneratör', standardLoss: 2.8, userLoss: 2.8},
      {name: 'Hava Kompresörü', standardLoss: 1.4, userLoss: 1.4},
      {name: 'Direksiyon Pompası', standardLoss: 1.4, userLoss: 1.4},
      {name: 'Klima', standardLoss: 0, userLoss: 0},
      {name: 'Ek Tahrik', standardLoss: 0, userLoss: 0}
    ]
  },
  'isx15_600_fr11860': {
    name: 'ISX15 600 | FR11860',
    specs: {
      displacement: 15.00,
      idleRpm: 600,
      governedSpeed: 2000,
      noLoadGoverned: 2030,
      inertia: 3.0000
    },
    data: [
      {rpm: 600, torque: 1245, power: 78.2},
      {rpm: 700, torque: 1383, power: 101.4},
      {rpm: 800, torque: 1695, power: 142},
      {rpm: 900, torque: 1966, power: 185.3},
      {rpm: 983, torque: 2229, power: 229.5},
      {rpm: 1150, torque: 2779, power: 334.7},
      {rpm: 1200, torque: 3000, power: 377},
      {rpm: 1300, torque: 2847, power: 387.6},
      {rpm: 1400, torque: 2712, power: 397.6},
      {rpm: 1500, torque: 2644, power: 415.3},
      {rpm: 1600, torque: 2576, power: 431.6},
      {rpm: 1700, torque: 2508, power: 446.5},
      {rpm: 1800, torque: 2434, power: 458.8},
      {rpm: 1900, torque: 2285, power: 454.7},
      {rpm: 2000, torque: 2137, power: 447.6},
      {rpm: 2030, torque: 0, power: 0}
    ],
    accessories: [
      {name: 'Fan (Kavramalı Fan)', standardLoss: 22.4, userLoss: 22.4},
      {name: 'Alternatör / Jeneratör', standardLoss: 2.8, userLoss: 2.8},
      {name: 'Hava Kompresörü', standardLoss: 1.4, userLoss: 1.4},
      {name: 'Direksiyon Pompası', standardLoss: 1.4, userLoss: 1.4},
      {name: 'Klima', standardLoss: 0, userLoss: 0},
      {name: 'Ek Tahrik', standardLoss: 0, userLoss: 0}
    ]
  },
  'isx15_675_fr12042': {
    name: 'ISX15 675 | FR12042',
    specs: {
      displacement: 15.00,
      idleRpm: 600,
      governedSpeed: 2000,
      noLoadGoverned: 2030,
      inertia: 3.0000
    },
    data: [
      {rpm: 600, torque: 1245, power: 78},
      {rpm: 700, torque: 1384, power: 101},
      {rpm: 800, torque: 1513, power: 127},
      {rpm: 900, torque: 1695, power: 160},
      {rpm: 965, torque: 1830, power: 185},
      {rpm: 1000, torque: 1966, power: 206},
      {rpm: 1100, torque: 2779, power: 320},
      {rpm: 1200, torque: 2779, power: 349},
      {rpm: 1300, torque: 2779, power: 378},
      {rpm: 1400, torque: 2779, power: 407},
      {rpm: 1500, torque: 2779, power: 436},
      {rpm: 1600, torque: 2752, power: 461},
      {rpm: 1700, torque: 2712, power: 483},
      {rpm: 1800, torque: 2671, power: 503},
      {rpm: 1900, torque: 2530, power: 503},
      {rpm: 2000, torque: 2403, power: 503},
      {rpm: 2030, torque: 0, power: 0}
    ],
    accessories: [
      {name: 'Fan (Kavramalı Fan)', standardLoss: 22.4, userLoss: 22.4},
      {name: 'Alternatör / Jeneratör', standardLoss: 2.8, userLoss: 2.8},
      {name: 'Hava Kompresörü', standardLoss: 1.4, userLoss: 1.4},
      {name: 'Direksiyon Pompası', standardLoss: 1.4, userLoss: 1.4},
      {name: 'Klima', standardLoss: 0, userLoss: 0},
      {name: 'Ek Tahrik', standardLoss: 0, userLoss: 0}
    ]
  },
  'weichai_i4': {
    name: 'Weichai I4',
    specs: {
      displacement: 4.50,
      idleRpm: 600,
      governedSpeed: 2100,
      noLoadGoverned: 2200,
      inertia: 0.8000
    },
    data: [
      {rpm: 600, torque: 671.6, power: 42.2},
      {rpm: 700, torque: 770.8, power: 56.5},
      {rpm: 800, torque: 875.0, power: 73.3},
      {rpm: 900, torque: 974.0, power: 91.8},
      {rpm: 1000, torque: 1095.3, power: 114.7},
      {rpm: 1100, torque: 1204.9, power: 138.8},
      {rpm: 1200, torque: 1192.1, power: 149.8},
      {rpm: 1300, torque: 1203.2, power: 163.8},
      {rpm: 1400, torque: 1204.6, power: 176.6},
      {rpm: 1500, torque: 1205.8, power: 189.4},
      {rpm: 1600, torque: 1205.6, power: 202.0},
      {rpm: 1700, torque: 1208.3, power: 215.1},
      {rpm: 1800, torque: 1180.9, power: 222.6},
      {rpm: 1900, torque: 1155.0, power: 229.8},
      {rpm: 2000, torque: 1107.2, power: 231.9},
      {rpm: 2100, torque: 1075.0, power: 236.4},
      {rpm: 2200, torque: 0, power: 0}
    ],
    accessories: [
      {name: 'Fan (Kavramalı Fan)', standardLoss: 22.4, userLoss: 22.4},
      {name: 'Alternatör / Jeneratör', standardLoss: 2.8, userLoss: 2.8},
      {name: 'Hava Kompresörü', standardLoss: 1.4, userLoss: 1.4},
      {name: 'Direksiyon Pompası', standardLoss: 1.4, userLoss: 1.4},
      {name: 'Klima', standardLoss: 0, userLoss: 0},
      {name: 'Ek Tahrik', standardLoss: 0, userLoss: 0}
    ]
  }
};

function onVEMotorCategoryChange(nodeId) {
  // Artık tek kategori — FT motor presetleri kullanılıyor
}

function getVEMotorRowHTML(nodeId, rpm, torque, power) {
  var html = '<tr>';
  html += '<td style="padding:3px; border-bottom:1px solid var(--border-color);"><input type="number" value="' + (rpm !== '' && rpm !== undefined ? rpm : '') + '" style="width:100%; padding:4px; font-size:0.7rem; background:var(--bg-input); color:var(--text-primary); border:1px solid var(--border-color); border-radius:3px; text-align:center;" onchange="onVEMotorDataChange(\'' + nodeId + '\')"></td>';
  html += '<td style="padding:3px; border-bottom:1px solid var(--border-color);"><input type="number" value="' + (torque !== '' && torque !== undefined ? torque : '') + '" style="width:100%; padding:4px; font-size:0.7rem; background:var(--bg-input); color:var(--text-primary); border:1px solid var(--border-color); border-radius:3px; text-align:center;" onchange="onVEMotorDataChange(\'' + nodeId + '\')"></td>';
  html += '<td style="padding:3px; border-bottom:1px solid var(--border-color);"><input type="number" value="' + (power !== '' && power !== undefined ? power : '') + '" style="width:100%; padding:4px; font-size:0.7rem; background:var(--bg-input); color:var(--text-primary); border:1px solid var(--border-color); border-radius:3px; text-align:center;" onchange="onVEMotorDataChange(\'' + nodeId + '\')"></td>';
  html += '<td style="padding:3px; border-bottom:1px solid var(--border-color); text-align:center;"><button onclick="removeVEMotorRow(this, \'' + nodeId + '\')" style="padding:2px 6px; font-size:0.6rem; background:var(--accent-danger); color:white; border:none; border-radius:3px; cursor:pointer;" title="Satırı sil">×</button></td>';
  html += '</tr>';
  return html;
}

function addVEMotorRow(nodeId) {
  var tbody = document.getElementById('ve-motor-table-' + nodeId);
  if(!tbody) return;
  
  var tr = document.createElement('tr');
  tr.innerHTML = getVEMotorRowHTML(nodeId, '', '', '').replace('<tr>', '').replace('</tr>', '');
  tbody.appendChild(tr);
}

function removeVEMotorRow(btn, nodeId) {
  var tr = btn.closest('tr');
  if(tr) {
    tr.remove();
    onVEMotorDataChange(nodeId);
    
    // Satır kalmadıysa placeholder göster
    var data = getVEMotorTableData(nodeId);
    if(data.length === 0) {
      showVEMotorPlaceholder(nodeId);
    }
  }
}

function showVEMotorPlaceholder(nodeId) {
  var dataArea = document.getElementById('ve-motor-data-area-' + nodeId);
  var placeholder = document.getElementById('ve-motor-placeholder-' + nodeId);
  if(dataArea) dataArea.style.display = 'none';
  if(placeholder) placeholder.style.display = 'block';
  
  // Motor dropdown'ını da sıfırla
  var selectEl = document.getElementById('ve-motor-select-' + nodeId);
  if(selectEl) selectEl.value = '';
}

function clearVEMotorTable(nodeId, skipConfirm) {
  var tbody = document.getElementById('ve-motor-table-' + nodeId);
  if(!tbody) return;
  
  function doClear() {
    tbody.innerHTML = '';
    
    // Node'un verisini temizle
    var node = nodes.find(function(n) { return n.id === nodeId; });
    if(node && node.data) {
      node.data.torqueData = [];
    }
    
    // TEK boş satır ekle (değer yok, sadece boş inputlar)
    addVEMotorRow(nodeId);
    
    // Dropdown'ı sıfırlama - veri alanı görünür kalsın
    // Grafiği güncelle
    updateVEMotorChart(nodeId);
    showToast('Tablo temizlendi');
  }
  
  if(skipConfirm) {
    doClear();
  } else {
    var data = getVEMotorTableData(nodeId);
    if(data.length > 0) {
      showConfirmToast('Tablodaki tüm verileri silmek istediğinize emin misiniz?', doClear);
    } else {
      showToast('Tablo zaten boş', 'warning');
    }
  }
}

function deleteVEMotorSavedSet(nodeId) {
  // Mevcut motor verisini temizle - toast onayı ile
  var node = nodes.find(function(n) { return n.id === nodeId; });
  if(!node) return;
  
  // Veri var mı kontrol et
  var data = getVEMotorTableData(nodeId);
  if(data.length === 0) {
    showToast('Temizlenecek veri yok', 'warning');
    return;
  }
  
  showConfirmToast('Tablodaki motor verilerini temizlemek istediğinize emin misiniz?', function() {
    // Onaylandı - temizle
    if(node.data) {
      node.data.torqueData = [];
      node.data.savedSetName = null;
    }
    
    // Tabloyu temizle ve TEK boş satır ekle
    var tbody = document.getElementById('ve-motor-table-' + nodeId);
    if(tbody) {
      tbody.innerHTML = '';
      addVEMotorRow(nodeId);
    }
    
    // Motor dropdown'ını sıfırla
    var selectEl = document.getElementById('ve-motor-select-' + nodeId);
    if(selectEl) selectEl.value = '';
    
    // Grafiği güncelle
    updateVEMotorChart(nodeId);
    showToast('Motor verisi temizlendi');
  });
}

function onVEMotorDataChange(nodeId) {
  var node = nodes.find(function(n) { return n.id === nodeId; });
  if(!node) return;
  
  if(!node.data) node.data = {};
  node.data.torqueData = getVEMotorTableData(nodeId);
}

function onVEMotorParamChange(nodeId) {
  var node = nodes.find(function(n) { return n.id === nodeId; });
  if(!node) return;
  
  if(!node.data) node.data = {};
  
  var verimEl = document.getElementById('ve-mf-verim-' + nodeId);
  var governedEl = document.getElementById('ve-governed-rpm-' + nodeId);
  
  var pf = function(v, def) { var n = parseFloat(v); return isNaN(n) ? def : n; };
  if(verimEl) node.data.verim = pf(verimEl.value, 100);
  if(governedEl) {
    node.data.governedRpm = pf(governedEl.value, 2100);
    // motorSpecs varsa orayı da güncelle
    if(node.data.motorSpecs) node.data.motorSpecs.governedSpeed = node.data.governedRpm;
    propagateGovernedSpeed();
  }
}

function onVEFitMethodChange(nodeId) {
  var node = nodes.find(function(n) { return n.id === nodeId; });
  var methodEl = document.getElementById('ve-fit-method-' + nodeId);
  var degreeWrapper = document.getElementById('ve-poly-degree-wrapper-' + nodeId);
  
  if(!node || !methodEl) return;
  
  if(!node.data) node.data = {};
  node.data.fitMethod = methodEl.value;
  
  if(degreeWrapper) {
    degreeWrapper.style.display = (methodEl.value === 'poly') ? 'flex' : 'none';
  }
  
  updateVEMotorChart(nodeId);
}

function saveVEMotorData(nodeId) {
  onVEMotorDataChange(nodeId);
  onVEMotorParamChange(nodeId);
  showToast('Motor freni verileri kaydedildi');
}

function getVEMotorTableData(nodeId) {
  var tbody = document.getElementById('ve-motor-table-' + nodeId);
  if(!tbody) return [];
  
  var data = [];
  var rows = tbody.querySelectorAll('tr');
  rows.forEach(function(tr) {
    var inputs = tr.querySelectorAll('input');
    if(inputs.length >= 3) {
      var rpm = parseFloat(inputs[0].value);
      var torque = parseFloat(inputs[1].value);
      var power = parseFloat(inputs[2].value);
      
      if(!isNaN(rpm) && rpm > 0) {
        data.push({
          rpm: rpm,
          torque: isNaN(torque) ? null : torque,
          power: isNaN(power) ? null : power
        });
      }
    }
  });
  
  return data.sort(function(a, b) { return a.rpm - b.rpm; });
}

function onVEMotorSelectChange(nodeId, value) {
  if(!value) return;
  
  // Seçilen preset key'i kaydet
  var node = nodes.find(function(n) { return n.id === nodeId; });
  if(node) {
    if(!node.data) node.data = {};
    node.data.mfMotorPreset = value;
  }
  
  var tbody = document.getElementById('ve-motor-table-' + nodeId);
  if(!tbody) return;
  
  // Veri alanını göster, placeholder'ı gizle
  var dataArea = document.getElementById('ve-motor-data-area-' + nodeId);
  var placeholder = document.getElementById('ve-motor-placeholder-' + nodeId);
  if(dataArea) dataArea.style.display = 'block';
  if(placeholder) placeholder.style.display = 'none';
  
  tbody.innerHTML = '';
  
  // Yeni Motor seçildiyse boş tablo oluştur
  if(value === '__new__') {
    for(var i = 0; i < 5; i++) {
      var tr = document.createElement('tr');
      tr.innerHTML = getVEMotorRowHTML(nodeId, '', '', '').replace('<tr>', '').replace('</tr>', '');
      tbody.appendChild(tr);
    }
    onVEMotorDataChange(nodeId);
    updateVEMotorChart(nodeId);
    showToast('Yeni motor verisi için tablo hazır');
    return;
  }
  
  // Preset motor seçildiyse verileri yükle — artık sadece FT preset sistemi var
  var presets = {};
  var preset = null;

  // FT motor presetlerini kontrol et
  if(typeof VE_FT_MOTOR_PRESETS !== 'undefined' && VE_FT_MOTOR_PRESETS[value]) {
    preset = VE_FT_MOTOR_PRESETS[value];
  }
  if(!preset) return;
  
  preset.data.forEach(function(row) {
    var tr = document.createElement('tr');
    tr.innerHTML = getVEMotorRowHTML(nodeId, row.rpm, row.torque, row.power).replace('<tr>', '').replace('</tr>', '');
    tbody.appendChild(tr);
  });
  
  onVEMotorDataChange(nodeId);
  updateVEMotorChart(nodeId);
  showToast('Motor verisi yüklendi: ' + preset.name);
}

// Tam Gaz Hızlanma — Motor Seçici
function onVEFTMotorSelect(nodeId, value) {
  if(!value) return;
  
  // Seçilen preset key'i kaydet
  var node = nodes.find(function(n) { return n.id === nodeId; });
  if(node) {
    if(!node.data) node.data = {};
    node.data.ftMotorPreset = value;
  }
  
  var tbody = document.getElementById('ve-motor-table-' + nodeId);
  if(!tbody) return;
  
  var dataArea = document.getElementById('ve-motor-data-area-' + nodeId);
  var placeholder = document.getElementById('ve-motor-placeholder-' + nodeId);
  var ftExtra = document.getElementById('ve-ft-extra-' + nodeId);
  if(dataArea) dataArea.style.display = 'block';
  if(placeholder) placeholder.style.display = 'none';
  if(ftExtra) ftExtra.style.display = 'block';
  
  tbody.innerHTML = '';
  
  if(value === '__new__') {
    for(var i = 0; i < 5; i++) {
      var tr = document.createElement('tr');
      tr.innerHTML = getVEMotorRowHTML(nodeId, '', '', '').replace('<tr>', '').replace('</tr>', '');
      tbody.appendChild(tr);
    }
    onVEMotorDataChange(nodeId);
    updateVEMotorChart(nodeId);
    showToast('Manuel veri girişi için tablo hazır');
    return;
  }
  
  var preset = VE_FT_MOTOR_PRESETS[value];
  if(!preset) return;
  
  // Tork/güç verilerini yükle
  preset.data.forEach(function(row) {
    var tr = document.createElement('tr');
    tr.innerHTML = getVEMotorRowHTML(nodeId, row.rpm, row.torque, row.power).replace('<tr>', '').replace('</tr>', '');
    tbody.appendChild(tr);
  });
  
  onVEMotorDataChange(nodeId);
  updateVEMotorChart(nodeId);
  
  // Motor parametrelerini yükle (specs)
  if(preset.specs) {
    var node = nodes.find(function(n) { return n.id === nodeId; });
    if(node) {
      if(!node.data) node.data = {};
      node.data.motorSpecs = JSON.parse(JSON.stringify(preset.specs));
      node.data.governedRpm = preset.specs.governedSpeed || 2100;
    }
    var specFields = ['displacement','idleRpm','governedSpeed','noLoadGoverned','inertia'];
    specFields.forEach(function(fld) {
      var el = document.getElementById('ve-ft-spec-' + fld + '-' + nodeId);
      if(el && preset.specs[fld] !== undefined) el.value = preset.specs[fld];
    });
  }
  
  // Aksesuar kayıplarını yükle
  if(preset.accessories) {
    var node = nodes.find(function(n) { return n.id === nodeId; });
    if(node) {
      if(!node.data) node.data = {};
      node.data.accessories = JSON.parse(JSON.stringify(preset.accessories));
    }
    // Tablo inputlarını güncelle
    var stdInputs = document.querySelectorAll('.ve-acc-std-' + nodeId);
    var userInputs = document.querySelectorAll('.ve-acc-user-' + nodeId);
    preset.accessories.forEach(function(acc, idx) {
      if(stdInputs[idx]) stdInputs[idx].value = acc.standardLoss;
      if(userInputs[idx]) userInputs[idx].value = acc.userLoss;
    });
    // Toplamları güncelle
    veUpdateAccTotals(nodeId);
  }
  
  // Governed speed'i tüm bağımlı bileşenlere yay
  propagateGovernedSpeed();
  
  showToast('Motor verisi yüklendi: ' + preset.name);
}

// ═══════════════════════════════════════════════════════════════
// GOVERNED SPEED PROPAGATION — Motor → Şanzıman & diğer bileşenler
// ═══════════════════════════════════════════════════════════════
function getEngineGovernedSpeed() {
  // Motor bileşeninden governed speed oku
  var engineNode = nodes.find(function(n) { return n.type === 'engine'; });
  if(!engineNode || !engineNode.data) return 0;
  var specs = engineNode.data.motorSpecs || {};
  return parseFloat(specs.governedSpeed) || parseFloat(engineNode.data.governedRpm) || 0;
}

function propagateGovernedSpeed() {
  var govSpeed = getEngineGovernedSpeed();
  if(!govSpeed) return;
  
  // Şanzıman bileşenine yay
  var gbNode = nodes.find(function(n) { return n.type === 'gearbox'; });
  if(gbNode) {
    if(!gbNode.data) gbNode.data = {};
    gbNode.data.gbGovernedSpeed = govSpeed;
    // UI alanını güncelle (görünürse)
    var govEl = document.getElementById('ve-gb-governed-' + gbNode.id);
    if(govEl) {
      govEl.value = govSpeed;
      govEl.placeholder = 'Motordan: ' + govSpeed;
    }
  }
}

// Aksesuar kayıpları değişiklik handler
function onVEAccChange(nodeId) {
  var node = nodes.find(function(n) { return n.id === nodeId; });
  if(!node) return;
  if(!node.data) node.data = {};
  
  var accNames = ['Fan (Kavramalı Fan)', 'Alternatör / Jeneratör', 'Hava Kompresörü', 'Direksiyon Pompası', 'Klima', 'Ek Tahrik'];
  var stdInputs = document.querySelectorAll('.ve-acc-std-' + nodeId);
  var userInputs = document.querySelectorAll('.ve-acc-user-' + nodeId);
  
  var accessories = [];
  accNames.forEach(function(name, idx) {
    accessories.push({
      name: name,
      standardLoss: stdInputs[idx] ? parseFloat(stdInputs[idx].value) || 0 : 0,
      userLoss: userInputs[idx] ? parseFloat(userInputs[idx].value) || 0 : 0
    });
  });
  
  node.data.accessories = accessories;
  veUpdateAccTotals(nodeId);
  updateVENetChart(nodeId);
}

// Kayıpları Uygula butonu
function onVEApplyAccLosses(nodeId) {
  // Önce aksesuar verilerini kaydet
  onVEAccChange(nodeId);
  // Sonra motor specs'ten governed speed'i al
  var node = nodes.find(function(n) { return n.id === nodeId; });
  if(!node) return;
  // Net chart ve tabloyu güncelle
  updateVENetChart(nodeId);
  showToast('Aksesuar kayıpları net değerlere uygulandı');
}

function veUpdateAccTotals(nodeId) {
  var stdInputs = document.querySelectorAll('.ve-acc-std-' + nodeId);
  var userInputs = document.querySelectorAll('.ve-acc-user-' + nodeId);
  var totalStd = 0, totalUser = 0;
  stdInputs.forEach(function(el) { totalStd += parseFloat(el.value) || 0; });
  userInputs.forEach(function(el) { totalUser += parseFloat(el.value) || 0; });
  
  var stdEl = document.getElementById('ve-acc-total-std-' + nodeId);
  var userEl = document.getElementById('ve-acc-total-user-' + nodeId);
  if(stdEl) stdEl.textContent = totalStd.toFixed(1);
  if(userEl) userEl.textContent = totalUser.toFixed(1);
}

// Motor parametreleri (specs) değişiklik handler — Tam Gaz modülü
function onVEFTSpecChange(nodeId) {
  var node = nodes.find(function(n) { return n.id === nodeId; });
  if(!node) return;
  if(!node.data) node.data = {};
  if(!node.data.motorSpecs) node.data.motorSpecs = {};
  
  var specFields = ['displacement','idleRpm','governedSpeed','noLoadGoverned','inertia'];
  specFields.forEach(function(fld) {
    var el = document.getElementById('ve-ft-spec-' + fld + '-' + nodeId);
    if(el) node.data.motorSpecs[fld] = parseFloat(el.value) || 0;
  });
  
  // governedSpeed'i ana governedRpm alanına da yaz (solver kullanıyor)
  if(node.data.motorSpecs.governedSpeed) {
    node.data.governedRpm = node.data.motorSpecs.governedSpeed;
  }
  
  // Governed speed değiştiyse tüm bileşenlere yay
  propagateGovernedSpeed();
}

function updateVEMotorChart(nodeId) {
  var canvas = document.getElementById('ve-motor-chart-' + nodeId);
  if(!canvas) return;
  
  var data = getVEMotorTableData(nodeId);
  var torquePoints = data.filter(function(d) { return d.torque !== null; }).map(function(d) { return {x: d.rpm, y: d.torque}; });
  var powerPoints = data.filter(function(d) { return d.power !== null; }).map(function(d) { return {x: d.rpm, y: d.power}; });
  
  // Canvas boyutunu ayarla
  var rect = canvas.getBoundingClientRect();
  canvas.width = rect.width * 2; // Retina desteği
  canvas.height = 200 * 2;
  canvas.style.height = '200px';
  
  var ctx = canvas.getContext('2d');
  ctx.scale(2, 2); // Retina
  ctx.clearRect(0, 0, rect.width, 200);
  
  if(torquePoints.length < 2 && powerPoints.length < 2) {
    ctx.fillStyle = '#666';
    ctx.font = '12px system-ui';
    ctx.textAlign = 'center';
    ctx.fillText('En az 2 veri noktası gerekli', rect.width / 2, 100);
    return;
  }
  
  // Grafik çizimi - çift eksen
  var margin = {left: 50, right: 50, top: 20, bottom: 30};
  var plotWidth = rect.width - margin.left - margin.right;
  var plotHeight = 200 - margin.top - margin.bottom;
  
  // X ekseni (RPM)
  var allX = torquePoints.concat(powerPoints).map(function(p) { return p.x; });
  var xMin = Math.min.apply(null, allX);
  var xMax = Math.max.apply(null, allX);
  
  // Y eksenleri
  var yMinTorque = 0;
  var yMaxTorque = torquePoints.length > 0 ? Math.max.apply(null, torquePoints.map(function(p) { return p.y; })) * 1.15 : 100;
  var yMinPower = 0;
  var yMaxPower = powerPoints.length > 0 ? Math.max.apply(null, powerPoints.map(function(p) { return p.y; })) * 1.15 : 100;
  
  function xScale(x) { return margin.left + (x - xMin) / (xMax - xMin) * plotWidth; }
  function yScaleTorque(y) { return margin.top + plotHeight - (y - yMinTorque) / (yMaxTorque - yMinTorque) * plotHeight; }
  function yScalePower(y) { return margin.top + plotHeight - (y - yMinPower) / (yMaxPower - yMinPower) * plotHeight; }
  
  // Arka plan grid
  ctx.strokeStyle = 'rgba(255,255,255,0.05)';
  ctx.lineWidth = 1;
  for(var i = 0; i <= 5; i++) {
    var gy = margin.top + plotHeight * i / 5;
    ctx.beginPath();
    ctx.moveTo(margin.left, gy);
    ctx.lineTo(margin.left + plotWidth, gy);
    ctx.stroke();
  }
  
  // Sol eksen (Tork) - Mavi
  ctx.strokeStyle = '#4aa3ff';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(margin.left, margin.top);
  ctx.lineTo(margin.left, margin.top + plotHeight);
  ctx.stroke();
  
  // Sağ eksen (Güç) - Kırmızı
  ctx.strokeStyle = '#ff6b6b';
  ctx.beginPath();
  ctx.moveTo(margin.left + plotWidth, margin.top);
  ctx.lineTo(margin.left + plotWidth, margin.top + plotHeight);
  ctx.stroke();
  
  // Alt eksen
  ctx.strokeStyle = '#444';
  ctx.beginPath();
  ctx.moveTo(margin.left, margin.top + plotHeight);
  ctx.lineTo(margin.left + plotWidth, margin.top + plotHeight);
  ctx.stroke();
  
  // X ekseni etiketleri
  ctx.fillStyle = '#888';
  ctx.font = '9px system-ui';
  ctx.textAlign = 'center';
  for(var i = 0; i <= 4; i++) {
    var xVal = xMin + (xMax - xMin) * i / 4;
    var xPos = xScale(xVal);
    ctx.fillText(Math.round(xVal), xPos, margin.top + plotHeight + 15);
  }
  ctx.fillText('Devir [rpm]', margin.left + plotWidth / 2, 200 - 5);
  
  // Sol Y ekseni etiketleri (Tork)
  ctx.fillStyle = '#4aa3ff';
  ctx.textAlign = 'right';
  for(var i = 0; i <= 4; i++) {
    var yVal = yMinTorque + (yMaxTorque - yMinTorque) * i / 4;
    var yPos = yScaleTorque(yVal);
    ctx.fillText(Math.round(yVal), margin.left - 5, yPos + 3);
  }
  
  // Sağ Y ekseni etiketleri (Güç)
  ctx.fillStyle = '#ff6b6b';
  ctx.textAlign = 'left';
  for(var i = 0; i <= 4; i++) {
    var yVal = yMinPower + (yMaxPower - yMinPower) * i / 4;
    var yPos = yScalePower(yVal);
    ctx.fillText(Math.round(yVal), margin.left + plotWidth + 5, yPos + 3);
  }
  
  // Tork eğrisi
  if(torquePoints.length >= 2) {
    ctx.strokeStyle = '#4aa3ff';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    torquePoints.forEach(function(p, i) {
      var x = xScale(p.x);
      var y = yScaleTorque(p.y);
      if(i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
    
    // Noktalar
    ctx.fillStyle = '#4aa3ff';
    torquePoints.forEach(function(p) {
      ctx.beginPath();
      ctx.arc(xScale(p.x), yScaleTorque(p.y), 4, 0, Math.PI * 2);
      ctx.fill();
    });
  }
  
  // Güç eğrisi
  if(powerPoints.length >= 2) {
    ctx.strokeStyle = '#ff6b6b';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    powerPoints.forEach(function(p, i) {
      var x = xScale(p.x);
      var y = yScalePower(p.y);
      if(i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();
    
    // Noktalar
    ctx.fillStyle = '#ff6b6b';
    powerPoints.forEach(function(p) {
      ctx.beginPath();
      ctx.arc(xScale(p.x), yScalePower(p.y), 4, 0, Math.PI * 2);
      ctx.fill();
    });
  }
  
  // Polinom fit bilgisi
  updateVEMotorFitEquation(nodeId, torquePoints, powerPoints);
  
  // Tam gaz modülündeyse net chart'ı da güncelle
  if(veActiveModule === 'full-throttle') {
    updateVENetChart(nodeId);
  }
}

// Net Değerler diyagramı — brüt + net overlay
// Aksesuar kaybı hesaplama — RPM bağımlı
// Fan (Kavramalı Fan): küp yasası (RPM/governed)^3
// Diğer aksesuarlar: lineer (RPM/governed)
function veCalcAccLossAtRPM(accessories, rpm, governedSpeed) {
  if(!accessories || accessories.length === 0 || !governedSpeed) return 0;
  var ratio = rpm / governedSpeed;
  var totalLoss = 0;
  accessories.forEach(function(acc) {
    var loss = acc.userLoss || 0;
    if(loss <= 0) return;
    // Fan (Kavramalı Fan) → küp yasası
    if(acc.name && acc.name.toLowerCase().indexOf('fan') >= 0) {
      totalLoss += loss * ratio * ratio * ratio;
    } else {
      // Diğer aksesuarlar → lineer
      totalLoss += loss * ratio;
    }
  });
  return totalLoss;
}

function updateVENetChart(nodeId) {
  var canvas = document.getElementById('ve-net-chart-' + nodeId);
  if(!canvas) return;
  
  var node = nodes.find(function(n) { return n.id === nodeId; });
  if(!node) return;
  var nd = node.data || {};
  var rows = nd.torqueData || [];
  if(rows.length < 2) return;
  
  var acc = nd.accessories || [];
  var specs = nd.motorSpecs || {};
  var governed = specs.governedSpeed || nd.governedRpm || 2100;
  
  // Brüt ve net veri
  var grossTorque = [], grossPower = [], netTorque = [], netPower = [];
  rows.forEach(function(r) {
    var rpm = parseFloat(r.rpm) || 0;
    var gT = parseFloat(r.torque) || 0;
    var gP = parseFloat(r.power) || 0;
    if(rpm <= 0) return;
    var lossAtRPM = veCalcAccLossAtRPM(acc, rpm, governed);
    var nP = gP - lossAtRPM;
    var nT = rpm > 0 ? (nP * 9549.3 / rpm) : 0;
    grossTorque.push({x: rpm, y: gT});
    grossPower.push({x: rpm, y: gP});
    netTorque.push({x: rpm, y: nT});
    netPower.push({x: rpm, y: nP});
  });
  
  if(grossTorque.length < 2) return;
  
  var rect = canvas.getBoundingClientRect();
  canvas.width = rect.width * 2;
  canvas.height = 200 * 2;
  canvas.style.height = '200px';
  
  var ctx = canvas.getContext('2d');
  ctx.scale(2, 2);
  ctx.clearRect(0, 0, rect.width, 200);
  
  var margin = {left: 50, right: 50, top: 20, bottom: 30};
  var plotWidth = rect.width - margin.left - margin.right;
  var plotHeight = 200 - margin.top - margin.bottom;
  
  var allX = grossTorque.map(function(p) { return p.x; });
  var xMin = Math.min.apply(null, allX);
  var xMax = Math.max.apply(null, allX);
  
  var yMaxTorque = Math.max.apply(null, grossTorque.map(function(p) { return p.y; })) * 1.15;
  var yMaxPower = Math.max.apply(null, grossPower.map(function(p) { return p.y; })) * 1.15;
  
  function xScale(x) { return margin.left + (x - xMin) / (xMax - xMin) * plotWidth; }
  function yScaleT(y) { return margin.top + plotHeight - y / yMaxTorque * plotHeight; }
  function yScaleP(y) { return margin.top + plotHeight - y / yMaxPower * plotHeight; }
  
  // Grid
  ctx.strokeStyle = 'rgba(255,255,255,0.05)';
  ctx.lineWidth = 1;
  for(var i = 0; i <= 5; i++) {
    var gy = margin.top + plotHeight * i / 5;
    ctx.beginPath(); ctx.moveTo(margin.left, gy); ctx.lineTo(margin.left + plotWidth, gy); ctx.stroke();
  }
  
  // Eksenler
  ctx.strokeStyle = '#4ade80'; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(margin.left, margin.top); ctx.lineTo(margin.left, margin.top + plotHeight); ctx.stroke();
  ctx.strokeStyle = '#f87171';
  ctx.beginPath(); ctx.moveTo(margin.left + plotWidth, margin.top); ctx.lineTo(margin.left + plotWidth, margin.top + plotHeight); ctx.stroke();
  ctx.strokeStyle = '#444';
  ctx.beginPath(); ctx.moveTo(margin.left, margin.top + plotHeight); ctx.lineTo(margin.left + plotWidth, margin.top + plotHeight); ctx.stroke();
  
  // X etiketleri
  ctx.fillStyle = '#888'; ctx.font = '9px system-ui'; ctx.textAlign = 'center';
  for(var i = 0; i <= 4; i++) {
    var xVal = xMin + (xMax - xMin) * i / 4;
    ctx.fillText(Math.round(xVal), xScale(xVal), margin.top + plotHeight + 15);
  }
  ctx.fillText('Devir [rpm]', margin.left + plotWidth / 2, 200 - 5);
  
  // Sol Y (Tork)
  ctx.fillStyle = '#4ade80'; ctx.textAlign = 'right';
  for(var i = 0; i <= 4; i++) { ctx.fillText(Math.round(yMaxTorque * i / 4), margin.left - 5, yScaleT(yMaxTorque * i / 4) + 3); }
  
  // Sağ Y (Güç)
  ctx.fillStyle = '#f87171'; ctx.textAlign = 'left';
  for(var i = 0; i <= 4; i++) { ctx.fillText(Math.round(yMaxPower * i / 4), margin.left + plotWidth + 5, yScaleP(yMaxPower * i / 4) + 3); }
  
  // Çizim yardımcısı
  function drawLine(pts, scaleFn, color, width, dash) {
    ctx.strokeStyle = color; ctx.lineWidth = width; ctx.setLineDash(dash || []);
    ctx.beginPath();
    pts.forEach(function(p, i) { var x = xScale(p.x), y = scaleFn(p.y); if(i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y); });
    ctx.stroke(); ctx.setLineDash([]);
  }
  function drawDots(pts, scaleFn, color, r) {
    ctx.fillStyle = color;
    pts.forEach(function(p) { ctx.beginPath(); ctx.arc(xScale(p.x), scaleFn(p.y), r, 0, Math.PI*2); ctx.fill(); });
  }
  
  // Brüt eğriler (kesik çizgi, soluk)
  drawLine(grossTorque, yScaleT, 'rgba(74,163,255,0.3)', 1.5, [5,4]);
  drawLine(grossPower, yScaleP, 'rgba(255,107,107,0.3)', 1.5, [5,4]);
  
  // Net eğriler (düz çizgi, parlak)
  drawLine(netTorque, yScaleT, '#4ade80', 2.5);
  drawDots(netTorque, yScaleT, '#4ade80', 3.5);
  drawLine(netPower, yScaleP, '#f87171', 2.5);
  drawDots(netPower, yScaleP, '#f87171', 3.5);
  
  // Net tablo da güncelle
  veUpdateNetTable(nodeId, rows, acc, governed);
}

function veUpdateNetTable(nodeId, rows, accessories, governed) {
  var tbody = document.getElementById('ve-net-table-' + nodeId);
  if(!tbody) return;
  var html = '';
  rows.forEach(function(r) {
    var rpm = parseFloat(r.rpm) || 0;
    var gT = parseFloat(r.torque) || 0;
    var gP = parseFloat(r.power) || 0;
    if(rpm <= 0) return;
    var lossAtRPM = veCalcAccLossAtRPM(accessories, rpm, governed);
    var nP = gP - lossAtRPM;
    var nT = nP * 9549.3 / rpm;
    html += '<tr style="border-bottom:1px solid var(--border-color);">';
    html += '<td style="padding:4px 5px; text-align:center; background:var(--bg-tertiary); font-weight:500;">' + rpm.toFixed(0) + '</td>';
    html += '<td style="padding:4px 5px; text-align:center; background:var(--bg-tertiary); color:var(--text-muted);">' + gT.toFixed(1) + '</td>';
    html += '<td style="padding:4px 5px; text-align:center; background:var(--bg-tertiary); color:#4ade80; font-weight:500;">' + nT.toFixed(1) + '</td>';
    html += '<td style="padding:4px 5px; text-align:center; background:var(--bg-tertiary); color:var(--text-muted);">' + gP.toFixed(1) + '</td>';
    html += '<td style="padding:4px 5px; text-align:center; background:var(--bg-tertiary); color:#f87171; font-weight:500;">' + nP.toFixed(1) + '</td>';
    html += '</tr>';
  });
  tbody.innerHTML = html;
}

function updateVEMotorFitEquation(nodeId, torquePoints, powerPoints) {
  var fitDiv = document.getElementById('ve-motor-fit-' + nodeId);
  var methodEl = document.getElementById('ve-fit-method-' + nodeId);
  if(!fitDiv) return;
  
  var method = methodEl ? methodEl.value : 'linear';
  
  if(torquePoints.length < 2) {
    fitDiv.innerHTML = 'Yeterli veri yok.';
    return;
  }
  
  var html = '';
  
  if(method === 'linear') {
    html = '<b>Lineer İnterpolasyon:</b><br>';
    html += '<span style="color:var(--text-muted);">Veri noktaları arasında doğrusal geçiş.</span>';
  } else if(method === 'pchip') {
    html = '<b>PCHIP Spline:</b><br>';
    html += '<span style="color:var(--text-muted);">Monoton kübik interpolasyon (pürüzsüz).</span>';
  } else if(method === 'poly') {
    var degreeEl = document.getElementById('ve-poly-degree-' + nodeId);
    var degree = degreeEl ? parseInt(degreeEl.value) : 3;
    
    // Tork için polinom fit
    var torqueCoeffs = polyFit(
      torquePoints.map(function(p) { return p.x; }), 
      torquePoints.map(function(p) { return p.y; }), 
      Math.min(degree, torquePoints.length - 1)
    );
    
    if(torqueCoeffs) {
      var torqueR2 = computeVER2(
        torquePoints.map(function(p) { return p.x; }),
        torquePoints.map(function(p) { return p.y; }),
        torqueCoeffs
      );
      
      html += '<b style="color:#4aa3ff;">Tork [Nm]</b> (' + torqueCoeffs.length + '. derece)';
      html += ' <span style="color:#4ade80;">R²=' + torqueR2.toFixed(4) + '</span><br>';
      html += '<span style="font-size:0.6rem;">T(n) = ' + formatVEPolynomial(torqueCoeffs) + '</span>';
    }
    
    // Güç için polinom fit
    if(powerPoints.length >= 2) {
      var powerCoeffs = polyFit(
        powerPoints.map(function(p) { return p.x; }), 
        powerPoints.map(function(p) { return p.y; }), 
        Math.min(degree, powerPoints.length - 1)
      );
      
      if(powerCoeffs) {
        var powerR2 = computeVER2(
          powerPoints.map(function(p) { return p.x; }),
          powerPoints.map(function(p) { return p.y; }),
          powerCoeffs
        );
        
        html += '<br><b style="color:#ff6b6b;">Güç [kW]</b> (' + powerCoeffs.length + '. derece)';
        html += ' <span style="color:#4ade80;">R²=' + powerR2.toFixed(4) + '</span><br>';
        html += '<span style="font-size:0.6rem;">P(n) = ' + formatVEPolynomial(powerCoeffs) + '</span>';
      }
    }
  }
  
  fitDiv.innerHTML = html;
}

// R² hesaplama
function computeVER2(xs, ys, coeffs) {
  var n = xs.length;
  if(!coeffs || !coeffs.length || n === 0) return 0;
  
  // Ortalama y
  var meanY = 0;
  for(var i = 0; i < n; i++) {
    meanY += ys[i];
  }
  meanY /= n;
  
  var sse = 0;
  var sst = 0;
  
  for(var i = 0; i < n; i++) {
    var x = xs[i];
    var y = ys[i];
    
    // Polinomu değerlendir
    var yPred = 0;
    var xPow = 1;
    for(var k = 0; k < coeffs.length; k++) {
      yPred += coeffs[k] * xPow;
      xPow *= x;
    }
    
    var e = y - yPred;
    sse += e * e;
    
    var dy = y - meanY;
    sst += dy * dy;
  }
  
  return sst > 0 ? 1 - (sse / sst) : 1;
}

// Polinom formatla
function formatVEPolynomial(coeffs) {
  var parts = [];
  for(var i = 0; i < coeffs.length; i++) {
    var c = coeffs[i];
    if(Math.abs(c) < 1e-10) continue;
    
    var term = '';
    if(i === 0) {
      term = c.toFixed(2);
    } else {
      var sign = c >= 0 ? '+' : '-';
      var absC = Math.abs(c);
      if(absC < 0.001) {
        term = sign + absC.toExponential(2) + '·n';
      } else {
        term = sign + absC.toFixed(4) + '·n';
      }
      if(i > 1) term += '^' + i;
    }
    parts.push(term);
  }
  return parts.join(' ') || '0';
}

// Basit polinom fit (en küçük kareler)
function polyFit(x, y, degree) {
  if(x.length < degree + 1) return null;
  
  var n = x.length;
  var matrixSize = degree + 1;
  
  // Vandermonde matrisi oluştur
  var X = [];
  for(var i = 0; i < n; i++) {
    var row = [];
    for(var j = 0; j <= degree; j++) {
      row.push(Math.pow(x[i], j));
    }
    X.push(row);
  }
  
  // X^T * X
  var XtX = [];
  for(var i = 0; i <= degree; i++) {
    var row = [];
    for(var j = 0; j <= degree; j++) {
      var sum = 0;
      for(var k = 0; k < n; k++) {
        sum += X[k][i] * X[k][j];
      }
      row.push(sum);
    }
    XtX.push(row);
  }
  
  // X^T * y
  var Xty = [];
  for(var i = 0; i <= degree; i++) {
    var sum = 0;
    for(var k = 0; k < n; k++) {
      sum += X[k][i] * y[k];
    }
    Xty.push(sum);
  }
  
  // Gauss eliminasyonu ile çöz
  for(var i = 0; i < matrixSize; i++) {
    var maxRow = i;
    for(var k = i + 1; k < matrixSize; k++) {
      if(Math.abs(XtX[k][i]) > Math.abs(XtX[maxRow][i])) maxRow = k;
    }
    var temp = XtX[i]; XtX[i] = XtX[maxRow]; XtX[maxRow] = temp;
    var t = Xty[i]; Xty[i] = Xty[maxRow]; Xty[maxRow] = t;
    
    for(var k = i + 1; k < matrixSize; k++) {
      var c = XtX[k][i] / XtX[i][i];
      for(var j = i; j < matrixSize; j++) {
        XtX[k][j] -= c * XtX[i][j];
      }
      Xty[k] -= c * Xty[i];
    }
  }
  
  // Geri yerine koyma
  var coeffs = new Array(matrixSize);
  for(var i = matrixSize - 1; i >= 0; i--) {
    coeffs[i] = Xty[i];
    for(var j = i + 1; j < matrixSize; j++) {
      coeffs[i] -= XtX[i][j] * coeffs[j];
    }
    coeffs[i] /= XtX[i][i];
  }
  
  return coeffs;
}

// Şanzıman özellikleri
// ===== ŞANZIMAN KONTROL ÖZELLİKLERİ =====
function getShiftControllerPropertiesHTML(node) {
  var html = '<div style="border-top:1px solid var(--border-color); padding-top:12px;">';
  
  html += '<div style="font-size:0.8rem; font-weight:600; color:var(--text-heading); margin-bottom:8px; display:flex; align-items:center; gap:6px;">';
  html += '<span>Shift Schedule (Vites Geçiş Takvimi)</span>';
  html += '<button onclick="showInfoPopup(\'shiftController\')" style="width:18px; height:18px; border-radius:50%; background:var(--accent-primary); color:white; border:none; cursor:pointer; font-size:0.65rem; display:flex; align-items:center; justify-content:center;" title="Bilgi">?</button>';
  html += '</div>';
  
  html += '<p style="font-size:0.62rem; color:var(--text-muted); margin-bottom:10px; line-height:1.4;">Bu bileşen otomatik şanzıman vites geçiş stratejisini kontrol eder. Converter modda SR eşiklerine göre upshift, lockup modda RPM eşiklerine göre shift kararı verilir.</p>';
  
  // Şanzıman ve motor bileşenlerinden veri çek
  var gbNode = nodes.find(function(n) { return n.type === 'gearbox'; });
  var engNode = nodes.find(function(n) { return n.type === 'engine'; });
  var diffNode = nodes.find(function(n) { return n.type === 'differential' && n.isMasterDiff; })
               || nodes.find(function(n) { return n.type === 'differential'; });
  var transNode = nodes.find(function(n) { return n.type === 'transfer'; });
  var wheelNode = nodes.find(function(n) { return n.type === 'wheel'; });
  
  var gbData = (gbNode && gbNode.data) || {};
  var engData = (engNode && engNode.data) || {};
  var diffData = (diffNode && diffNode.data) || {};
  var transData = (transNode && transNode.data) || {};
  var wheelData = (wheelNode && wheelNode.data) || {};
  
  // Shift profili bilgisi
  var shiftProfile = gbData.shiftProfile || 'allison3200sp_s1';
  var spData = VE_FT_SHIFT_PROFILES[shiftProfile] || {};
  var profileName = spData.name || 'Bilinmiyor';
  var lockupOffset = spData.lockupOffset || 75;
  
  // Governed speed — motor bileşeni her zaman öncelikli
  var esp = engData.motorSpecs || {};
  var governed = parseFloat(esp.governedSpeed) || parseFloat(engData.governedRpm) || 0;
  if(!governed) {
    governed = gbData.gbGovernedSpeed || 0;
  }
  // Shift referans RPM: profilde veya UI'da tanımlıysa onu kullan, yoksa motor governed
  var shiftRefRPM = spData.shiftRefRPM || gbData.shiftRefRPM || governed;
  
  // Driveline oranları
  var ftGears = gbData.ftGearData || VE_FT_GB_DEFAULT_GEARS;
  var i_diff = parseFloat(diffData.diffRatio) || 6.54;
  // Transfer: FT modda ftTrGears kullanır (ilk kademe referans)
  var i_trans = 1;
  if(transData.ftTrGears && transData.ftTrGears.length > 0) {
    var activeTr = transData.ftTrGears[0];
    i_trans = parseFloat(activeTr.ratio || activeTr.oran) || 1;
  } else {
    i_trans = parseFloat(transData.selectedRatio) || 1;
  }
  // Tekerlek yarıçapı → rev/km
  var r_tire = parseFloat(wheelData.ftTireRadius) || parseFloat(wheelData.dynamicRadius) || 0;
  var revPerKm = 0;
  if(r_tire > 0) {
    revPerKm = 1000 / (2 * Math.PI * r_tire);
  }
  if(!revPerKm) revPerKm = 507; // varsayılan
  
  var i_driveline = i_diff * i_trans;
  
  // Lockup shift RPM
  var N_shift_lockup = shiftRefRPM > 0 ? (shiftRefRPM - lockupOffset) : 0;
  
  // Profil adı
  html += '<div style="background:var(--bg-secondary); border-radius:6px; padding:8px 10px; margin-bottom:10px; border:1px solid var(--border-color);">';
  html += '<div style="font-size:0.62rem; color:var(--text-muted);">Aktif Shift Profili</div>';
  html += '<div style="font-size:0.72rem; font-weight:600; color:var(--text-heading);">' + profileName + '</div>';
  if(shiftRefRPM !== governed) {
    html += '<div style="font-size:0.58rem; color:var(--accent-warning); margin-top:2px;">Shift Ref. RPM: ' + shiftRefRPM + ' (motor governed: ' + governed + ')</div>';
  }
  html += '</div>';
  
  // Güncelle butonu
  html += '<div style="display:flex; justify-content:flex-end; margin-bottom:8px;">';
  html += '<button onclick="veRefreshShiftSchedule()" style="padding:4px 12px; font-size:0.68rem; background:var(--accent-primary); color:white; border:none; border-radius:4px; cursor:pointer;">Güncelle</button>';
  html += '</div>';
  
  // ── 5a. LOCKUP MODE SHIFT TABLOSU ──
  html += '<div style="background:var(--bg-tertiary); border-radius:8px; padding:10px; margin-bottom:10px;">';
  html += '<div style="font-size:0.72rem; font-weight:600; color:var(--text-heading); margin-bottom:4px;">Lockup Mode Shift Tablosu</div>';
  html += '<p style="font-size:0.58rem; color:var(--text-muted); margin-bottom:8px; line-height:1.3;">N<sub>shift_lockup</sub> = N<sub>shift_ref</sub> − Lockup_Shift_Offset = ' + shiftRefRPM + ' − ' + lockupOffset + ' = <b>' + N_shift_lockup + ' rpm</b></p>';
  
  if(governed <= 0) {
    html += '<div style="padding:10px; text-align:center; font-size:0.68rem; color:var(--accent-danger);">⚠ Governed speed tanımlı değil. Önce Motor veya Şanzıman bileşeninde Governed Speed giriniz.</div>';
  } else {
    // Lockup destekli ileri vitesler (F2 ve üstü lockup shift yapabilir)
    var lockupGears = ftGears.filter(function(g) { return g.lockup && g.name && g.name.charAt(0) === 'F'; });
    lockupGears.sort(function(a, b) {
      var na = parseInt(a.name.replace('F','')) || 0;
      var nb = parseInt(b.name.replace('F','')) || 0;
      return na - nb;
    });
    
    html += '<div style="max-height:200px; overflow-y:auto; border:1px solid var(--border-color); border-radius:6px;">';
    html += '<table style="width:100%; border-collapse:collapse; font-size:0.66rem;">';
    html += '<thead style="position:sticky; top:0; background:var(--bg-secondary); z-index:1;">';
    html += '<tr>';
    html += '<th style="padding:5px; border-bottom:1px solid var(--border-color); text-align:center;">Geçiş</th>';
    html += '<th style="padding:5px; border-bottom:1px solid var(--border-color); text-align:center;">N<sub>shift</sub><br>[rpm]</th>';
    html += '<th style="padding:5px; border-bottom:1px solid var(--border-color); text-align:center;">i<sub>gear</sub><br>(mevcut)</th>';
    html += '</tr></thead><tbody>';
    
    for(var gi = 0; gi < lockupGears.length - 1; gi++) {
      var fromGear = lockupGears[gi];
      var toGear = lockupGears[gi + 1];
      var fromNum = fromGear.name;
      var toNum = toGear.name;
      // Shift sırasında mevcut vitesteyiz, shift RPM'de çıkış vitesine geçeriz
      var i_gear_from = fromGear.ratio || 1;
      
      html += '<tr style="border-bottom:1px solid var(--border-color);">';
      html += '<td style="padding:4px 6px; text-align:center; font-weight:500;">' + fromNum + 'L → ' + toNum + 'L</td>';
      html += '<td style="padding:4px 6px; text-align:center;">' + N_shift_lockup + '</td>';
      html += '<td style="padding:4px 6px; text-align:center;">' + i_gear_from.toFixed(3) + '</td>';
      html += '</tr>';
    }
    
    html += '</tbody></table></div>';
    
    // Bilgilendirme
    if(!diffNode || (i_diff <= 1.01 && !diffData.diffRatio)) {
      html += '<p style="font-size:0.55rem; color:var(--accent-warning); margin-top:6px; line-height:1.3;">⚠ Diferansiyel oranı tanımlı değil (i_diff=' + i_diff.toFixed(3) + '). Diferansiyel bileşenini kontrol edin.</p>';
    }
  }
  
  html += '</div>';
  
  // ── 5b. CONVERTER MODE SHIFT MANTIĞI ──
  var shift1C2C_outRatio = spData.shift1C2C_outRatio || 0.2150;
  var shift2C2L_outRatio = spData.shift2C2L_outRatio || 0.3593;
  
  html += '<div style="background:var(--bg-tertiary); border-radius:8px; padding:10px; margin-bottom:10px;">';
  html += '<div style="font-size:0.72rem; font-weight:600; color:var(--text-heading); margin-bottom:6px;">Converter Mode Shift Mantığı</div>';
  html += '<p style="font-size:0.58rem; color:var(--text-muted); margin-bottom:8px; line-height:1.3;">Converter-mod geçişleri şanzıman çıkış devri oranına (N_out / N_shift_ref) göre belirlenir. Bu oranlar motordan bağımsızdır — farklı governed RPM\'li motorlarda da doğru shift noktası verir.</p>';
  
  // Parametre tablosu
  html += '<table style="width:100%; border-collapse:collapse; font-size:0.64rem; border:1px solid var(--border-color); margin-bottom:8px;">';
  html += '<thead><tr style="background:var(--bg-secondary);">';
  html += '<th style="padding:5px 6px; text-align:left; border-bottom:1px solid var(--border-color);">Parametre</th>';
  html += '<th style="padding:5px 6px; text-align:center; border-bottom:1px solid var(--border-color); width:20%;">Değer</th>';
  html += '<th style="padding:5px 6px; text-align:left; border-bottom:1px solid var(--border-color);">Açıklama</th>';
  html += '</tr></thead><tbody>';
  html += '<tr style="border-bottom:1px solid var(--border-color);">';
  html += '<td style="padding:4px 6px; font-weight:500;">1C→2C Oran (N_out/N_gov)</td>';
  html += '<td style="padding:4px 6px; text-align:center; font-weight:600; color:var(--accent-primary);">' + shift1C2C_outRatio + '</td>';
  html += '<td style="padding:4px 6px; color:var(--text-muted);">N_out ≥ ' + shift1C2C_outRatio + ' × N_shift_ref → 1C→2C shift</td>';
  html += '</tr>';
  html += '<tr>';
  html += '<td style="padding:4px 6px; font-weight:500;">2C→2L Oran (N_out/N_gov)</td>';
  html += '<td style="padding:4px 6px; text-align:center; font-weight:600; color:var(--accent-primary);">' + shift2C2L_outRatio + '</td>';
  html += '<td style="padding:4px 6px; color:var(--text-muted);">N_out ≥ ' + shift2C2L_outRatio + ' × N_shift_ref → lockup engage</td>';
  html += '</tr>';
  html += '</tbody></table>';
  
  // Shift mantığı kuralları
  html += '<div style="background:var(--bg-input); border-radius:5px; padding:8px 10px; margin-bottom:8px; border:1px solid var(--border-color); font-family:monospace; font-size:0.6rem; line-height:1.6; color:var(--text-secondary);">';
  html += '1C → 2C: shift @ N_out ≥ ' + shift1C2C_outRatio + ' × N_shift_ref<br>';
  html += '2C → 2L: shift @ N_out ≥ ' + shift2C2L_outRatio + ' × N_shift_ref (lockup engage)';
  html += '</div>';
  
  // Bilgi kutusu
  html += '<div style="background:var(--bg-secondary); border-left:3px solid var(--accent-primary); border-radius:0 5px 5px 0; padding:8px 10px; font-size:0.57rem; color:var(--text-muted); line-height:1.5; font-style:italic;">';
  html += '"N_out = N_engine × SR / i_gear (şanzıman çıkış devri). Geçiş oranları iSCAAN çapraz validasyondan türetilmiştir. 3200 SP: 2 motor, 4000 SP: 3 motor + 2 TC ile doğrulanmış."';
  html += '</div>';
  
  html += '</div>';

  // ── SHIFT CONTROLLER ALGORİTMASI (Görsel) ──
  html += '<div style="background:var(--bg-tertiary); border-radius:8px; padding:10px; margin-bottom:10px;">';
  html += '<div style="font-size:0.72rem; font-weight:600; color:var(--text-heading); margin-bottom:6px;">Shift Controller Algoritması</div>';
  
  var codeStyle = 'background:var(--bg-input); border-radius:5px; padding:10px; border:1px solid var(--border-color); font-family:monospace; font-size:0.55rem; line-height:1.7; color:var(--text-secondary); overflow-x:auto; white-space:pre;';
  
  html += '<div style="' + codeStyle + '">';
  html += '<span style="color:var(--text-muted);">Girdiler: N_engine, SR, V_vehicle, current_gear, mode</span>\n\n';
  html += '<span style="color:var(--accent-warning);">=== BAŞLANGIÇ DURUMU ===</span>\n';
  html += '  gear = F1, mode = CONVERTER, V = 0\n\n';
  html += '<span style="color:var(--accent-warning);">=== HER ZAMAN ADIMINDA ===</span>\n\n';
  
  html += '<span style="color:var(--accent-primary);">Adım 1: Converter modunda 1C → 2C upshift</span>\n';
  html += '  Eğer mode == CONVERTER VE gear == F1:\n';
  html += '    N_out = N_engine × SR / i_gear_F1\n';
  html += '    Eğer N_out >= ' + shift1C2C_outRatio + ' × N_shift_ref:\n';
  html += '      → gear = F2, mode = CONVERTER (2C)\n\n';
  
  html += '<span style="color:var(--accent-primary);">Adım 2: Converter → Lockup geçişi (2C → 2L)</span>\n';
  html += '  Eğer mode == CONVERTER VE gear == F2:\n';
  html += '    N_out = N_engine × SR / i_gear_F2\n';
  html += '    Eğer N_out >= ' + shift2C2L_outRatio + ' × N_shift_ref:\n';
  html += '      → mode = LOCKUP (2L)\n';
  html += '      → N_engine = N_turbine (1:1 mekanik kilit)\n\n';
  
  html += '<span style="color:var(--accent-primary);">Adım 3: Lockup modunda upshift (2L→3L→...→6L)</span>\n';
  html += '  Eğer mode == LOCKUP:\n';
  html += '    N_shift = N_shift_ref − ' + lockupOffset + '\n';
  html += '    Eğer N_engine >= N_shift:\n';
  html += '      next_gear = bir üst vites\n';
  html += '      Eğer next_gear var VE lockup destekliyse:\n';
  html += '        → gear = next_gear, mode = LOCKUP\n';
  html += '      Eğer next_gear yoksa:\n';
  html += '        → Shift yapma (son vites, governed\'a yaklaş)\n\n';
  
  html += '<span style="color:var(--accent-primary);">Adım 4: Shift sonrası devir düşüşü</span>\n';
  html += '  Shift gerçekleştiğinde:\n';
  html += '    N_engine_yeni = N_engine_eski × (i_eski / i_yeni)\n';
  html += '    Bu değer &lt; governed olmalı (kontrol)';
  html += '</div>';
  
  // Shift sırası görsel
  html += '<div style="font-size:0.65rem; font-weight:600; color:var(--text-heading); margin-top:10px; margin-bottom:6px;">Shift Sırası — ' + profileName + ', full throttle (WOT):</div>';
  
  html += '<div style="background:var(--bg-input); border-radius:5px; padding:10px; border:1px solid var(--border-color); font-family:monospace; font-size:0.55rem; line-height:1.8; color:var(--text-secondary); overflow-x:auto; white-space:pre;">';
  html += '<span style="color:var(--accent-primary); font-weight:600;">1C → 2C → 2L → 3L → 4L → 5L → 6L</span>\n';
  html += ' │                              └ Son vites, governed\'a kadar\n';
  html += ' │                     └ N_eng >= N_ref−' + lockupOffset + ' → 6L\n';
  html += ' │                └ N_eng >= N_ref−' + lockupOffset + ' → 5L\n';
  html += ' │           └ N_eng >= N_ref−' + lockupOffset + ' → 4L\n';
  html += ' │      └ N_eng >= N_ref−' + lockupOffset + ' → 3L\n';
  html += ' │ └ N_out >= ' + shift2C2L_outRatio + '×N_ref → lockup engage\n';
  html += ' └ N_out >= ' + shift1C2C_outRatio + '×N_ref → 2C';
  html += '</div>';
  
  html += '</div>';

  html += '</div>';
  return html;
}

// Shift Schedule panelini yenile (diğer bileşenlerden güncel veriyi çeker)
function veRefreshShiftSchedule() {
  var scNode = nodes.find(function(n) { return n.type === 'shift-controller'; });
  if(scNode) {
    selectedNodes = [scNode];
    showNodeProperties(scNode);
    showToast('Shift Schedule güncellendi');
  }
}

/**
 * Lockup shift eşiğini hesaplar (upshift ve downshift için ortak).
 * Desteklenen formatlar:
 *   { a, b }                                     → lineer: N_out = a × ESL + b
 *   { a, b, minCap }                             → min cap'li lineer
 *   { a, b, capValue, capBelow }                  → cap'li lineer (ESL < capBelow → capValue)
 *   { type:'piecewise', breakpoint, low, high }   → parçalı lineer (2 segment)
 *   { type:'segments', segments: [{maxESL, a, b, cap}, ...] } → çok segmentli
 */
function calcLockupShiftThreshold(ls, esl) {
  if(!ls) return 0;
  if(ls.type === 'piecewise') {
    if(esl <= ls.breakpoint) return ls.low.a * esl + (ls.low.b || 0);
    return ls.high.a * esl + (ls.high.b || 0);
  }
  if(ls.type === 'segments') {
    for(var si = 0; si < ls.segments.length; si++) {
      var seg = ls.segments[si];
      if(seg.maxESL !== undefined && esl <= seg.maxESL) {
        return seg.cap !== undefined ? seg.cap : (seg.a * esl + (seg.b || 0));
      }
      if(si === ls.segments.length - 1) {
        return seg.cap !== undefined ? seg.cap : (seg.a * esl + (seg.b || 0));
      }
    }
  }
  if(ls.capValue !== undefined && ls.capBelow !== undefined && esl < ls.capBelow) {
    return ls.capValue;
  }
  var thr = ls.a * esl + (ls.b || 0);
  if(ls.minCap !== undefined) thr = Math.max(thr, ls.minCap);
  return thr;
}

// ===== SHIFT CONTROLLER RUNTIME ALGORİTMASI =====
// Her simülasyon zaman adımında çağrılır
function veShiftControllerStep(state, params) {
  // state: { N_engine, SR, V_vehicle, gear, gearIndex, mode, tau }
  // params: { governed, lockupOffset, shift1C2C_outRatio, shift2C2L_outRatio, ftGears }
  // mode: 'CONVERTER' veya 'LOCKUP'
  // Returns: { gear, gearIndex, mode, shifted, shiftType }
  
  var result = {
    gear: state.gear,
    gearIndex: state.gearIndex,
    mode: state.mode,
    shifted: false,
    shiftType: null
  };
  
  var N_eng = state.N_engine;
  var SR = state.SR;
  var governed = params.governed;
  var refRPM = params.shiftRefRPM || governed;  // Shift referans RPM
  var gears = params.ftGears;
  var lockupGears = gears.filter(function(g) { return g.lockup && g.name && g.name.charAt(0) === 'F'; });
  lockupGears.sort(function(a, b) {
    return (parseInt(a.name.replace('F','')) || 0) - (parseInt(b.name.replace('F','')) || 0);
  });
  
  // Converter-mod geçiş sabitleri (fallback oran, converterShifts yoksa)
  var SHIFT_1C_2C_OUT_RATIO = params.shift1C2C_outRatio || 0.2150;
  var SHIFT_2C_2L_OUT_RATIO = params.shift2C2L_outRatio || 0.3594;
  var csParams = params.converterShifts || null;

  // Segmentli 2C→2L eşiği hesaplama
  function _calc2C2LThreshold(esl) {
    if(!csParams || !csParams['2C2L']) return SHIFT_2C_2L_OUT_RATIO * esl;
    var cs2L = csParams['2C2L'];
    if(cs2L.type === 'segmented') {
      if(esl >= cs2L.linear.validFrom) return cs2L.linear.a * esl + cs2L.linear.b;
      var lk = cs2L.lookup;
      if(!lk || lk.length === 0) return cs2L.linear.a * esl + cs2L.linear.b;
      if(esl <= lk[0][0]) return lk[0][1];
      for(var li = 0; li < lk.length - 1; li++) {
        if(esl >= lk[li][0] && esl <= lk[li + 1][0]) {
          var frac = (esl - lk[li][0]) / (lk[li + 1][0] - lk[li][0]);
          return lk[li][1] + frac * (lk[li + 1][1] - lk[li][1]);
        }
      }
      return lk[lk.length - 1][1];
    }
    return cs2L.a * esl + (cs2L.b || 0);
  }

  // Adım 1: Converter modunda 1C → 2C
  if(state.mode === 'CONVERTER' && state.gearIndex === 0) {
    var allFwdGears = gears.filter(function(g) { return g.name && g.name.charAt(0) === 'F'; });
    allFwdGears.sort(function(a, b) { return (parseInt(a.name.replace('F',''))||0) - (parseInt(b.name.replace('F',''))||0); });
    var i_gear_F1 = allFwdGears.length > 0 ? (parseFloat(allFwdGears[0].ratio) || 1.0) : 1.0;
    var N_out = N_eng * SR / i_gear_F1;
    var threshold_1C2C;
    if(csParams && csParams['1C2C']) {
      threshold_1C2C = csParams['1C2C'].a * refRPM + (csParams['1C2C'].b || 0);
    } else {
      threshold_1C2C = SHIFT_1C_2C_OUT_RATIO * refRPM;
    }
    if(N_out >= threshold_1C2C) {
      result.gear = lockupGears.length > 1 ? lockupGears[1].name : state.gear;
      result.gearIndex = 1;
      result.mode = 'CONVERTER';
      result.shifted = true;
      result.shiftType = 'N_out-ratio (' + N_out.toFixed(0) + ' >= ' + threshold_1C2C.toFixed(0) + ')';
      return result;
    }
  }

  // Adım 2: Converter → Lockup (2C → 2L)
  if(state.mode === 'CONVERTER' && state.gearIndex === 1) {
    var allFwdGears2 = gears.filter(function(g) { return g.name && g.name.charAt(0) === 'F'; });
    allFwdGears2.sort(function(a, b) { return (parseInt(a.name.replace('F',''))||0) - (parseInt(b.name.replace('F',''))||0); });
    var i_gear_F2 = allFwdGears2.length > 1 ? (parseFloat(allFwdGears2[1].ratio) || 1.0) : 1.0;
    var N_out_2 = N_eng * SR / i_gear_F2;
    var threshold_2C2L = _calc2C2LThreshold(refRPM);
    if(N_out_2 >= threshold_2C2L) {
      result.mode = 'LOCKUP';
      result.shifted = true;
      result.shiftType = 'lockup-engage (N_out=' + N_out_2.toFixed(0) + ')';
      return result;
    }
  }
  
  // Adım 3: Lockup modunda upshift (2L → 3L → ... → 6L)
  // Lineer formül: N_out >= a × ESL + b (per-gear kalibrasyon)
  // Fallback: N_engine >= refRPM - lockupOffset (eski sabit ofset)
  if(state.mode === 'LOCKUP') {
    var nextIdx = state.gearIndex + 1;
    if(nextIdx < lockupGears.length && lockupGears[nextIdx].lockup) {
      var i_gear_lu = parseFloat(lockupGears[state.gearIndex].ratio) || 1.0;
      var N_out_lu = N_eng / i_gear_lu;  // Lockup modda SR=1
      var fromName = (state.gearIndex + 1) + 'L';
      var toName = (state.gearIndex + 2) + 'L';
      var shiftKey = fromName + toName;
      var luTriggered = false;

      if(params.lockupShifts && params.lockupShifts[shiftKey]) {
        var ls = params.lockupShifts[shiftKey];
        var threshold_lu = calcLockupShiftThreshold(ls, refRPM);
        if(N_out_lu >= threshold_lu) luTriggered = true;
      } else {
        // Eski yöntem: sabit lockupOffset
        var N_shift = refRPM - params.lockupOffset;
        if(N_eng >= N_shift) luTriggered = true;
      }

      if(luTriggered) {
        result.gear = lockupGears[nextIdx].name;
        result.gearIndex = nextIdx;
        result.mode = 'LOCKUP';
        result.shifted = true;
        result.shiftType = 'lockup-upshift (' + shiftKey + ')';
        return result;
      }
    }
  }
  
  return result;
}

// Shift sonrası devir hesabı
function veCalcPostShiftRPM(N_engine_old, i_old, i_new) {
  return N_engine_old * (i_old / i_new);
}

function getGearboxPropertiesHTML(node) {
  var nodeData = node.data || {};
  var isFullThrottle = veActiveModule === 'full-throttle';
  
  var html = '<div style="border-top:1px solid var(--border-color); padding-top:12px;">';
  
  // Başlık
  html += '<div style="font-size:0.8rem; font-weight:600; color:var(--text-heading); margin-bottom:8px; display:flex; align-items:center; gap:6px;">';
  html += '<span>Şanzıman Verileri</span>';
  html += '<button onclick="showInfoPopup(\'sanzimanVerileri\')" style="width:18px; height:18px; border-radius:50%; background:var(--accent-primary); color:white; border:none; cursor:pointer; font-size:0.65rem; display:flex; align-items:center; justify-content:center;" title="Bilgi">?</button>';
  html += '</div>';
  
  if(isFullThrottle) {
    // ── TAM GAZ HIZLANMA: Şanzıman Parametreleri ──
    var gbName = nodeData.gbName || 'Allison 3200 SP';
    var shiftProfile = nodeData.shiftProfile || 'allison3200sp_s1';
    var forwardGears = nodeData.forwardGears !== undefined ? nodeData.forwardGears : 6;
    var reverseGears = nodeData.reverseGears !== undefined ? nodeData.reverseGears : 1;
    var gbGovernedSpeed = nodeData.gbGovernedSpeed !== undefined ? nodeData.gbGovernedSpeed : '';
    
    // Motordan governed speed çekmeye çalış
    var autoGoverned = '';
    var engineNode = nodes.find(function(n) { return n.type === 'engine'; });
    if(engineNode && engineNode.data) {
      var esp = engineNode.data.motorSpecs || {};
      autoGoverned = esp.governedSpeed || engineNode.data.governedRpm || '';
    }
    var displayGoverned = gbGovernedSpeed || autoGoverned || '';
    
    html += '<div style="background:var(--bg-tertiary); border-radius:8px; padding:10px;">';
    html += '<div style="font-size:0.75rem; font-weight:600; color:var(--text-heading); margin-bottom:8px;">Şanzıman Parametreleri</div>';
    
    // Şanzıman Preset Seçici
    var ftGBPreset = nodeData.ftGBPreset || '';
    var hasEGM = nodes.some(function(n) { return n.type === 'engine-gearbox-matching'; });
    html += '<div style="display:flex; gap:6px; margin-bottom:8px; align-items:center;">';
    html += '<select id="ve-ft-gb-preset-' + node.id + '"' + (hasEGM ? ' disabled' : '') + ' onchange="onVEFTGBPresetSelect(\'' + node.id + '\', this.value)" style="flex:1; font-size:0.68rem; padding:4px 6px; background:var(--bg-input); color:var(--text-primary); border:1px solid var(--border-color); border-radius:4px;' + (hasEGM ? ' opacity:0.6; cursor:not-allowed;' : '') + '">';
    html += '<option value="">-- Şanzıman Preset (' + Object.keys(VE_GEARBOX_PRESETS).length + ') --</option>';
    Object.keys(VE_GEARBOX_PRESETS).forEach(function(gk) {
      var gp = VE_GEARBOX_PRESETS[gk];
      var fwdC = gp.gears.filter(function(g) { return g.gear !== 'R'; }).length;
      var calM = (gp.calibrated ? ' ✦' : '') + (gp.downshiftCalibrated ? ' ✧' : '');
      var gSel = (gk === ftGBPreset) ? ' selected' : '';
      html += '<option value="' + gk + '"' + gSel + '>' + gp.name + ' (' + fwdC + 'V)' + calM + '</option>';
    });
    html += '</select>';
    html += '</div>';
    html += '<div style="font-size:0.55rem; color:var(--text-muted); margin:-4px 0 6px 2px; line-height:1.3;"><span style="color:var(--accent-warning);" title="Upshift kalibrasyon mevcut">✦</span> = Upshift kalibrasyon &nbsp; <span style="color:var(--accent-danger);" title="Downshift kalibrasyon mevcut">✧</span> = Downshift kalibrasyon</div>';
    if(hasEGM) {
      html += '<div style="padding:5px 8px; margin-bottom:6px; background:rgba(59,130,246,0.08); border:1px solid rgba(59,130,246,0.2); border-radius:4px; font-size:0.58rem; color:var(--accent-primary); line-height:1.4;">🔒 Şanzıman seçimi Motor-Şanzıman Eşleştirme bileşeni üzerinden yapılmaktadır.</div>';
    }

    // Şanzıman limitleri bilgi kutusu
    if(ftGBPreset && VE_GEARBOX_PRESETS[ftGBPreset]) {
      var _lp = VE_GEARBOX_PRESETS[ftGBPreset];
      if(_lp.grossInputPower || _lp.grossInputTorque || _lp.netTurbineTorque || _lp.maxOutputSpeed) {
        html += '<div style="background:var(--bg-secondary); border:1px solid var(--border-color); border-radius:6px; padding:6px 8px; margin-bottom:8px; font-size:0.6rem; line-height:1.5;">';
        html += '<div style="font-weight:600; color:var(--text-heading); margin-bottom:2px; font-size:0.62rem;">Şanzıman Limitleri</div>';
        html += '<div style="display:flex; flex-wrap:wrap; gap:4px 12px; color:var(--text-secondary);">';
        if(_lp.grossInputPower) html += '<span>Giriş Güç: <b style="color:var(--text-primary);">' + _lp.grossInputPower + ' kW</b></span>';
        if(_lp.grossInputTorque) html += '<span>Giriş Tork: <b style="color:var(--text-primary);">' + _lp.grossInputTorque + ' Nm</b></span>';
        if(_lp.netTurbineTorque) html += '<span>Türbin Tork: <b style="color:var(--text-primary);">' + _lp.netTurbineTorque + ' Nm</b></span>';
        if(_lp.maxOutputSpeed) html += '<span>Max Çıkış: <b style="color:var(--text-primary);">' + _lp.maxOutputSpeed + ' rpm</b></span>';
        html += '</div></div>';
      }
    }

    html += '<table style="width:100%; font-size:0.68rem; border-collapse:collapse; border:1px solid var(--border-color);">';
    
    // Shift Profili — şanzıman ailesine göre filtrelenmiş
    var gbFamily = '';
    if(ftGBPreset && VE_GEARBOX_PRESETS[ftGBPreset]) {
      gbFamily = VE_GEARBOX_PRESETS[ftGBPreset].family || '';
    }
    html += '<tr style="border-bottom:1px solid var(--border-color);">';
    html += '<th style="padding:6px 8px; text-align:left; background:var(--bg-tertiary); border-right:1px solid var(--border-color); font-weight:500; color:var(--text-secondary);">Shift Profili</th>';
    html += '<td style="padding:4px 6px; background:var(--bg-tertiary);">';
    html += '<select id="ve-gb-shift-' + node.id + '" style="width:100%; padding:4px; font-size:0.68rem; background:var(--bg-input); color:var(--text-primary); border:1px solid var(--border-color); border-radius:3px;" onchange="onVEFTGBParamChange(\'' + node.id + '\')">';
    var spCount = 0;
    var spFirstMatch = '';
    var spCurrentValid = false;
    Object.keys(VE_FT_SHIFT_PROFILES).forEach(function(spKey) {
      var sp = VE_FT_SHIFT_PROFILES[spKey];
      if(gbFamily && sp.family && sp.family !== gbFamily) return;
      if(!spFirstMatch) spFirstMatch = spKey;
      if(spKey === shiftProfile) spCurrentValid = true;
      spCount++;
    });
    // Eğer mevcut profil bu aileye ait değilse, ilk uyumlu profili seç
    if(!spCurrentValid && spFirstMatch) {
      shiftProfile = spFirstMatch;
      nodeData.shiftProfile = spFirstMatch;
    }
    Object.keys(VE_FT_SHIFT_PROFILES).forEach(function(spKey) {
      var sp = VE_FT_SHIFT_PROFILES[spKey];
      if(gbFamily && sp.family && sp.family !== gbFamily) return;
      var sel = (spKey === shiftProfile) ? ' selected' : '';
      html += '<option value="' + spKey + '"' + sel + '>' + sp.name + ' ✦</option>';
    });
    if(spCount === 0) {
      html += '<option value="" disabled selected>— Bu aile için profil tanımlı değil —</option>';
    }
    html += '</select>';
    html += '</td>';
    html += '</tr>';
    
    // Shift Referans RPM
    var shiftRefVal = nodeData.shiftRefRPM || '';
    html += '<tr style="border-bottom:1px solid var(--border-color);">';
    html += '<th style="padding:6px 8px; text-align:left; background:var(--bg-tertiary); border-right:1px solid var(--border-color); font-weight:500; color:var(--text-secondary);">Shift Ref. RPM</th>';
    html += '<td style="padding:4px 6px; background:var(--bg-tertiary);"><input type="number" id="ve-gb-shift-ref-' + node.id + '" value="' + shiftRefVal + '" placeholder="boş = motor governed" step="50" min="600" max="4000" style="width:100%; padding:4px; font-size:0.68rem; background:var(--bg-input); color:var(--text-primary); border:1px solid var(--border-color); border-radius:3px; text-align:right;" onchange="onVEFTGBParamChange(\'' + node.id + '\')"></td>';
    html += '</tr>';
    html += '<tr><td colspan="2" style="padding:3px 8px; font-size:0.52rem; color:var(--text-muted); background:var(--bg-secondary); line-height:1.3;"><span style="color:var(--accent-primary);">ℹ</span> iSCAAN raporlarındaki "Shift Speed &amp; Strategy" değeri. Genellikle motor governed hızına eşittir. Farklıysa buraya girin.</td></tr>';
    
    // Shift profili parametreleri (readonly)
    var spData = VE_FT_SHIFT_PROFILES[shiftProfile] || {lockupOffset: 75, shift1C2C_outRatio: 0.2150, shift2C2L_outRatio: 0.3594};
    var roStyle = 'width:100%; padding:4px; font-size:0.68rem; background:var(--bg-secondary); color:var(--text-secondary); border:1px solid var(--border-color); border-radius:3px; text-align:right; cursor:default;';

    // Converter-mod geçiş parametreleri
    if(spData.converterShifts) {
      // Lineer/segmentli converter model (örn. 4500SP)
      var cs = spData.converterShifts;
      html += '<tr style="border-bottom:1px solid var(--border-color);">';
      html += '<th colspan="2" style="padding:6px 8px; text-align:left; background:var(--bg-tertiary); font-weight:500; color:var(--text-secondary); font-size:0.66rem;">Converter Geçişleri <span style="color:var(--text-muted); font-weight:400;">[N_out = a×ESL + b]</span></th>';
      html += '</tr>';
      if(cs['1C2C']) {
        html += '<tr style="border-bottom:1px solid var(--border-color);">';
        html += '<th style="padding:4px 8px; text-align:left; background:var(--bg-tertiary); border-right:1px solid var(--border-color); font-weight:400; color:var(--text-secondary); font-size:0.64rem;">1C→2C</th>';
        html += '<td style="padding:4px 6px; background:var(--bg-tertiary); font-size:0.64rem; color:var(--text-secondary);">' + cs['1C2C'].a + ' × ESL ' + (cs['1C2C'].b >= 0 ? '+ ' : '− ') + Math.abs(cs['1C2C'].b || 0) + '</td>';
        html += '</tr>';
      }
      if(cs['2C2L']) {
        var cs2L = cs['2C2L'];
        html += '<tr style="border-bottom:1px solid var(--border-color);">';
        html += '<th style="padding:4px 8px; text-align:left; background:var(--bg-tertiary); border-right:1px solid var(--border-color); font-weight:400; color:var(--text-secondary); font-size:0.64rem;">2C→2L</th>';
        if(cs2L.type === 'segmented') {
          var linStr = cs2L.linear.a + ' × ESL ' + (cs2L.linear.b >= 0 ? '+ ' : '− ') + Math.abs(cs2L.linear.b);
          var lookupStr = cs2L.lookup.map(function(p) { return p[0] + ':' + p[1]; }).join(', ');
          html += '<td style="padding:4px 6px; background:var(--bg-tertiary); font-size:0.62rem; color:var(--text-secondary); line-height:1.3;">ESL ≥ ' + cs2L.linear.validFrom + ': ' + linStr + '<br>ESL &lt; ' + cs2L.linear.validFrom + ': Lookup [' + lookupStr + ']</td>';
        } else {
          html += '<td style="padding:4px 6px; background:var(--bg-tertiary); font-size:0.64rem; color:var(--text-secondary);">' + cs2L.a + ' × ESL ' + ((cs2L.b || 0) >= 0 ? '+ ' : '− ') + Math.abs(cs2L.b || 0) + '</td>';
        }
        html += '</tr>';
      }
      html += '<tr><td colspan="2" style="padding:5px 8px; font-size:0.56rem; color:var(--text-muted); background:var(--bg-secondary); line-height:1.4;">Converter-mod geçişleri lineer/segmentli model ile hesaplanır. N_out = N_engine × SR / i_gear.</td></tr>';
    } else {
      // Basit oran bazlı converter model (3200SP, 4000SP)
      html += '<tr style="border-bottom:1px solid var(--border-color);">';
      html += '<th style="padding:6px 8px; text-align:left; background:var(--bg-tertiary); border-right:1px solid var(--border-color); font-weight:500; color:var(--text-secondary);">1C→2C Oran <span style="color:var(--text-muted); font-weight:400;">[N_out/N_ref]</span></th>';
      html += '<td style="padding:4px 6px; background:var(--bg-tertiary);"><input type="text" id="ve-gb-sr-shift-' + node.id + '" value="' + (spData.shift1C2C_outRatio || 0.2150) + '" readonly style="' + roStyle + '" tabindex="-1"></td>';
      html += '</tr>';

      html += '<tr style="border-bottom:1px solid var(--border-color);">';
      html += '<th style="padding:6px 8px; text-align:left; background:var(--bg-tertiary); border-right:1px solid var(--border-color); font-weight:500; color:var(--text-secondary);">2C→2L Oran <span style="color:var(--text-muted); font-weight:400;">[N_out/N_ref]</span></th>';
      html += '<td style="padding:4px 6px; background:var(--bg-tertiary);"><input type="text" id="ve-gb-sr-lockup-' + node.id + '" value="' + (spData.shift2C2L_outRatio || 0.3594) + '" readonly style="' + roStyle + '" tabindex="-1"></td>';
      html += '</tr>';

      html += '<tr><td colspan="2" style="padding:5px 8px; font-size:0.56rem; color:var(--text-muted); background:var(--bg-secondary); line-height:1.4;">Converter-mod geçiş oranları iSCAAN çapraz validasyondan türetilmiştir. N_out = N_engine × SR / i_gear.</td></tr>';
    }

    // Lockup-mod geçiş parametreleri (per-gear kalibrasyon varsa göster)
    if(spData.lockupShifts) {
      html += '<tr style="border-bottom:1px solid var(--border-color);">';
      html += '<th colspan="2" style="padding:6px 8px; text-align:left; background:var(--bg-tertiary); font-weight:500; color:var(--text-secondary); font-size:0.66rem;">Lockup Geçişleri <span style="color:var(--text-muted); font-weight:400;">[N_out = a×ESL + b]</span></th>';
      html += '</tr>';
      Object.keys(spData.lockupShifts).forEach(function(sk) {
        var ls = spData.lockupShifts[sk];
        var label = sk.replace(/(\d+L)(\d+L)/, '$1→$2');
        var formula;
        if(ls.type === 'piecewise') {
          var lowF = ls.low.a + ' × ESL ' + ((ls.low.b || 0) >= 0 ? '+ ' : '− ') + Math.abs(ls.low.b || 0);
          var highF = ls.high.a + ' × ESL ' + ((ls.high.b || 0) >= 0 ? '+ ' : '− ') + Math.abs(ls.high.b || 0);
          formula = 'ESL ≤ ' + ls.breakpoint + ': ' + lowF + '<br>ESL &gt; ' + ls.breakpoint + ': ' + highF;
        } else if(ls.type === 'segments') {
          formula = ls.segments.map(function(seg, i) {
            if(seg.cap !== undefined) return 'ESL ≤ ' + seg.maxESL + ': ' + seg.cap + ' (cap)';
            var f = seg.a + ' × ESL ' + ((seg.b || 0) >= 0 ? '+ ' : '− ') + Math.abs(seg.b || 0);
            return seg.maxESL ? ('ESL ≤ ' + seg.maxESL + ': ' + f) : f;
          }).join('<br>');
        } else {
          formula = ls.a + ' × ESL ' + ((ls.b || 0) >= 0 ? '+ ' : '− ') + Math.abs(ls.b || 0);
          if(ls.capValue !== undefined) formula += ' (cap: ' + ls.capValue + ', ESL &lt; ' + ls.capBelow + ')';
          else if(ls.minCap !== undefined) formula += ' (min: ' + ls.minCap + ')';
        }
        html += '<tr style="border-bottom:1px solid var(--border-color);">';
        html += '<th style="padding:4px 8px; text-align:left; background:var(--bg-tertiary); border-right:1px solid var(--border-color); font-weight:400; color:var(--text-secondary); font-size:0.64rem;">' + label + '</th>';
        html += '<td style="padding:4px 6px; background:var(--bg-tertiary); font-size:0.64rem; color:var(--text-secondary);">' + formula + '</td>';
        html += '</tr>';
      });
    } else {
      // Eski sabit ofset göster
      html += '<tr style="border-bottom:1px solid var(--border-color);">';
      html += '<th style="padding:6px 8px; text-align:left; background:var(--bg-tertiary); border-right:1px solid var(--border-color); font-weight:500; color:var(--text-secondary);">Lockup Shift Offset <span style="color:var(--text-muted); font-weight:400;">[rpm]</span></th>';
      html += '<td style="padding:4px 6px; background:var(--bg-tertiary);"><input type="text" id="ve-gb-lockup-offset-' + node.id + '" value="' + spData.lockupOffset + '" readonly style="' + roStyle + '" tabindex="-1"></td>';
      html += '</tr>';
    }

    // Downshift eşikleri (varsa göster)
    if(spData.downshiftThresholds) {
      html += '<tr style="border-bottom:1px solid var(--border-color);">';
      html += '<th colspan="2" style="padding:6px 8px; text-align:left; background:var(--bg-tertiary); font-weight:500; color:var(--accent-warning); font-size:0.66rem;">Downshift Eşikleri <span style="color:var(--text-muted); font-weight:400;">[N_out &lt; threshold → alt vites]</span></th>';
      html += '</tr>';
      // Sıralı gösterim: büyük vitesten küçüğe
      var dsKeys = Object.keys(spData.downshiftThresholds).sort(function(a, b) {
        var na = parseInt(a); var nb = parseInt(b);
        return nb - na; // 6to5, 5to4, 4to3, 3to2, 2to1
      });
      dsKeys.forEach(function(dk) {
        var ds = spData.downshiftThresholds[dk];
        var label = dk.replace(/(\d+)to(\d+)/, '$1→$2');
        var formula;
        if(ds.type === 'piecewise') {
          var lowF = ds.low.a + ' × ESL ' + ((ds.low.b || 0) >= 0 ? '+ ' : '− ') + Math.abs(ds.low.b || 0);
          var highF = ds.high.a + ' × ESL ' + ((ds.high.b || 0) >= 0 ? '+ ' : '− ') + Math.abs(ds.high.b || 0);
          formula = 'ESL ≤ ' + ds.breakpoint + ': ' + lowF + '<br>ESL &gt; ' + ds.breakpoint + ': ' + highF;
        } else if(ds.type === 'segments') {
          formula = ds.segments.map(function(seg) {
            if(seg.cap !== undefined) return 'ESL ≤ ' + seg.maxESL + ': ' + seg.cap + ' (cap)';
            var f = seg.a + ' × ESL ' + ((seg.b || 0) >= 0 ? '+ ' : '− ') + Math.abs(seg.b || 0);
            return seg.maxESL ? ('ESL ≤ ' + seg.maxESL + ': ' + f) : f;
          }).join('<br>');
        } else {
          formula = ds.a + ' × ESL ' + ((ds.b || 0) >= 0 ? '+ ' : '− ') + Math.abs(ds.b || 0);
          if(ds.capValue !== undefined) formula += ' (cap: ' + ds.capValue + ', ESL &lt; ' + ds.capBelow + ')';
        }
        html += '<tr style="border-bottom:1px solid var(--border-color);">';
        html += '<th style="padding:4px 8px; text-align:left; background:var(--bg-tertiary); border-right:1px solid var(--border-color); font-weight:400; color:var(--accent-warning); font-size:0.64rem;">' + label + '</th>';
        html += '<td style="padding:4px 6px; background:var(--bg-tertiary); font-size:0.62rem; color:var(--text-secondary); line-height:1.3;">' + formula + '</td>';
        html += '</tr>';
      });
      html += '<tr><td colspan="2" style="padding:5px 8px; font-size:0.56rem; color:var(--text-muted); background:var(--bg-secondary); line-height:1.4;">Araç yavaşlarken N_out eşiğin altına düşerse alt vitese geçilir. Oran tabanlı formüller (N_engine = k × ESL). Histerezis: upshift &gt; downshift.</td></tr>';
    }

    // Vites Sayısı (İleri)
    html += '<tr style="border-bottom:1px solid var(--border-color);">';
    html += '<th style="padding:6px 8px; text-align:left; background:var(--bg-tertiary); border-right:1px solid var(--border-color); font-weight:500; color:var(--text-secondary);">Vites Sayısı (İleri)</th>';
    html += '<td style="padding:4px 6px; background:var(--bg-tertiary);"><input type="number" id="ve-gb-fwd-' + node.id + '" value="' + forwardGears + '" min="1" max="12" step="1" style="width:100%; padding:4px; font-size:0.68rem; background:var(--bg-input); color:var(--text-primary); border:1px solid var(--border-color); border-radius:3px; text-align:right;" onchange="onVEFTGBParamChange(\'' + node.id + '\')"></td>';
    html += '</tr>';
    
    // Geri Vites Sayısı
    html += '<tr style="border-bottom:1px solid var(--border-color);">';
    html += '<th style="padding:6px 8px; text-align:left; background:var(--bg-tertiary); border-right:1px solid var(--border-color); font-weight:500; color:var(--text-secondary);">Geri Vites Sayısı</th>';
    html += '<td style="padding:4px 6px; background:var(--bg-tertiary);"><input type="number" id="ve-gb-rev-' + node.id + '" value="' + reverseGears + '" min="0" max="4" step="1" style="width:100%; padding:4px; font-size:0.68rem; background:var(--bg-input); color:var(--text-primary); border:1px solid var(--border-color); border-radius:3px; text-align:right;" onchange="onVEFTGBParamChange(\'' + node.id + '\')"></td>';
    html += '</tr>';
    
    // Governed Speed — motordan otomatik alınır
    var govReadonly = autoGoverned ? true : false;
    var govStyle = govReadonly
      ? 'width:100%; padding:4px; font-size:0.68rem; background:var(--bg-secondary); color:var(--text-secondary); border:1px solid var(--border-color); border-radius:3px; text-align:right; cursor:default;'
      : 'width:100%; padding:4px; font-size:0.68rem; background:var(--bg-input); color:var(--text-primary); border:1px solid var(--border-color); border-radius:3px; text-align:right;';
    var govValue = autoGoverned || displayGoverned;
    // Motor varsa, gbGovernedSpeed'i de senkronize et
    if(autoGoverned) { nodeData.gbGovernedSpeed = parseFloat(autoGoverned); }
    html += '<tr style="border-bottom:1px solid var(--border-color);">';
    html += '<th style="padding:6px 8px; text-align:left; background:var(--bg-tertiary); border-right:1px solid var(--border-color); font-weight:500; color:var(--text-secondary);">Governed Speed <span style="color:var(--text-muted); font-weight:400;">[rpm]</span></th>';
    html += '<td style="padding:4px 6px; background:var(--bg-tertiary);"><input type="number" id="ve-gb-governed-' + node.id + '" value="' + govValue + '"' + (govReadonly ? ' readonly tabindex="-1"' : '') + ' placeholder="' + (autoGoverned ? 'Motordan: ' + autoGoverned : 'Giriniz') + '" step="1" min="0" style="' + govStyle + '"' + (govReadonly ? '' : ' onchange="onVEFTGBParamChange(\'' + node.id + '\')"') + '></td>';
    html += '</tr>';
    
    if(autoGoverned) {
      html += '<tr><td colspan="2" style="padding:4px 8px; font-size:0.58rem; color:var(--text-muted); background:var(--bg-secondary);"><span style="color:var(--accent-success);">✓</span> Motor bileşeninden otomatik alındı: ' + autoGoverned + ' rpm</td></tr>';
    }
    
    html += '</table>';
    html += '</div>'; // close Şanzıman Parametreleri
    
    // ── VİTES ORANLARI VE VERİMLER TABLOSU ──
    var ftGearData = nodeData.ftGearData || VE_FT_GB_DEFAULT_GEARS;
    var ftGearTableHeight = nodeData.ftGearTableHeight || 220;
    
    html += '<div style="margin-top:10px;">';
    html += '<div style="font-size:0.75rem; font-weight:600; color:var(--text-heading); margin-bottom:4px;">Vites Oranları ve Verimler</div>';
    html += '<p style="font-size:0.6rem; color:var(--text-muted); margin-bottom:8px; line-height:1.3;">Her vites için oranı, mekanik verimi ve lockup desteğini girin.</p>';
    
    html += '<div id="ve-ftgear-table-wrapper-' + node.id + '" style="max-height:' + ftGearTableHeight + 'px; overflow-y:auto; margin-bottom:0; border:1px solid var(--border-color); border-radius:6px 6px 0 0; border-bottom:none;">';
    html += '<table style="width:100%; border-collapse:collapse; font-size:0.68rem;">';
    html += '<thead style="position:sticky; top:0; background:var(--bg-tertiary); z-index:1;">';
    html += '<tr>';
    html += '<th style="padding:5px; border-bottom:1px solid var(--border-color); text-align:center; width:18%;">Vites</th>';
    html += '<th style="padding:5px; border-bottom:1px solid var(--border-color); text-align:center; width:24%;">Oran<br>(i_gear)</th>';
    html += '<th style="padding:5px; border-bottom:1px solid var(--border-color); text-align:center; width:24%;">Verim<br>(η) [%]</th>';
    html += '<th style="padding:5px; border-bottom:1px solid var(--border-color); text-align:center; width:14%;">Mod</th>';
    html += '<th style="padding:5px; border-bottom:1px solid var(--border-color); width:12%;"></th>';
    html += '</tr></thead>';
    html += '<tbody id="ve-ftgear-table-' + node.id + '">';
    
    ftGearData.forEach(function(row) {
      html += getVEFTGearRowHTML(node.id, row.name, row.ratio, row.eff, row.lockup);
    });
    
    html += '</tbody></table></div>';
    
    // Resize handle
    html += '<div style="height:8px; background:var(--bg-tertiary); border:1px solid var(--border-color); border-top:none; border-radius:0 0 6px 6px; cursor:ns-resize; display:flex; align-items:center; justify-content:center;" onmousedown="startVEFTGearTableResize(event, \'' + node.id + '\')">';
    html += '<div style="width:30px; height:3px; background:var(--border-color); border-radius:2px;"></div>';
    html += '</div>';
    
    // Butonlar
    html += '<div style="display:flex; gap:4px; margin-top:8px;">';
    html += '<button onclick="addVEFTGearRow(\'' + node.id + '\')" style="flex:1; padding:5px; font-size:0.68rem; background:var(--bg-tertiary); color:var(--text-primary); border:1px solid var(--border-color); border-radius:4px; cursor:pointer;">+ Satır Ekle</button>';
    html += '<button onclick="clearVEFTGearTable(\'' + node.id + '\')" style="flex:1; padding:5px; font-size:0.68rem; background:var(--bg-tertiary); color:var(--text-primary); border:1px solid var(--border-color); border-radius:4px; cursor:pointer;">Tümünü Sil</button>';
    html += '<button onclick="saveVEFTGearData(\'' + node.id + '\')" style="flex:1; padding:5px; font-size:0.68rem; background:#1e5a3f; color:white; border:none; border-radius:4px; cursor:pointer;">Kaydet</button>';
    html += '</div>';
    html += '</div>';
  } else {
    // ── MOTOR FRENİ: Mevcut parametreler ──
  var gearData = nodeData.gearData || [];
  var selectedGearbox = nodeData.selectedGearbox || '';
  var selectedGear = nodeData.selectedGear || '';
  var selectedGearRatio = nodeData.selectedGearRatio || '';
  var tableHeight = nodeData.tableHeight || 150;
  var hasData = gearData.length > 0;
  
  html += '<p style="font-size:0.68rem; color:var(--text-muted); margin-bottom:10px; line-height:1.4;">Test sırasında kullanılan şanzımanın vites oranlarını giriniz veya hazır şanzıman seçiniz.</p>';
  
  // Şanzıman Seçici
  var _hasEGM2 = nodes.some(function(n) { return n.type === 'engine-gearbox-matching'; });
  html += '<div style="display:flex; gap:6px; margin-bottom:8px; align-items:center;">';
  html += '<select id="ve-gearbox-select-' + node.id + '"' + (_hasEGM2 ? ' disabled' : '') + ' onchange="onVEGearboxSelectChange(\'' + node.id + '\', this.value)" style="flex:1; font-size:0.7rem; padding:4px 6px; background:var(--bg-input); color:var(--text-primary); border:1px solid var(--border-color); border-radius:4px;' + (_hasEGM2 ? ' opacity:0.6; cursor:not-allowed;' : '') + '">';
  html += '<option value="">-- Şanzıman Seçiniz (' + Object.keys(VE_GEARBOX_PRESETS).length + ' preset) --</option>';
  Object.keys(VE_GEARBOX_PRESETS).forEach(function(key) {
    var gp = VE_GEARBOX_PRESETS[key];
    var fwdCount = gp.gears.filter(function(g) { return g.gear !== 'R'; }).length;
    var calMark = (gp.calibrated ? ' ✦' : '') + (gp.downshiftCalibrated ? ' ✧' : '');
    var sel = (key === selectedGearbox) ? ' selected' : '';
    html += '<option value="' + key + '"' + sel + '>' + gp.name + ' (' + fwdCount + 'V)' + calMark + '</option>';
  });
  html += '<option value="__new__">➕ Manuel Giriş</option>';
  html += '</select>';
  html += '</div>';
  html += '<div style="font-size:0.55rem; color:var(--text-muted); margin:-4px 0 6px 2px; line-height:1.3;"><span style="color:var(--accent-warning);" title="Upshift kalibrasyon mevcut">✦</span> = Upshift kalibrasyon &nbsp; <span style="color:var(--accent-danger);" title="Downshift kalibrasyon mevcut">✧</span> = Downshift kalibrasyon</div>';
  if(_hasEGM2) {
    html += '<div style="padding:5px 8px; margin-bottom:6px; background:rgba(59,130,246,0.08); border:1px solid rgba(59,130,246,0.2); border-radius:4px; font-size:0.58rem; color:var(--accent-primary); line-height:1.4;">🔒 Şanzıman seçimi Motor-Şanzıman Eşleştirme bileşeni üzerinden yapılmaktadır.</div>';
  }

  // Veri alanı
  html += '<div id="ve-gearbox-data-area-' + node.id + '" style="display:' + (hasData || selectedGearbox ? 'block' : 'none') + ';">';
  
  // Vites Tablosu
  html += '<div id="ve-gearbox-table-wrapper-' + node.id + '" style="max-height:' + tableHeight + 'px; overflow-y:auto; margin-bottom:0; border:1px solid var(--border-color); border-radius:6px 6px 0 0; border-bottom:none;">';
  html += '<table style="width:100%; border-collapse:collapse; font-size:0.7rem;">';
  html += '<thead style="position:sticky; top:0; background:var(--bg-tertiary); z-index:1;">';
  html += '<tr>';
  html += '<th style="padding:6px; text-align:center; border-bottom:1px solid var(--border-color); width:25%;">Vites</th>';
  html += '<th style="padding:6px; text-align:center; border-bottom:1px solid var(--border-color); width:35%;">Oran [-]</th>';
  html += '<th style="padding:6px; text-align:center; border-bottom:1px solid var(--border-color); width:30%;">Not</th>';
  html += '<th style="padding:6px; text-align:center; border-bottom:1px solid var(--border-color); width:10%;">Sil</th>';
  html += '</tr>';
  html += '</thead>';
  html += '<tbody id="ve-gearbox-table-' + node.id + '">';
  
  if(gearData.length > 0) {
    gearData.forEach(function(row, idx) {
      html += getVEGearboxRowHTML(node.id, row.gear || '', row.ratio !== undefined && row.ratio !== null ? row.ratio : '', row.note || '');
    });
  } else {
    html += getVEGearboxRowHTML(node.id, '', '', '');
  }
  
  html += '</tbody></table></div>';
  
  // Tablo altı butonlar
  html += '<div style="display:flex; gap:4px; background:var(--bg-tertiary); padding:6px; border:1px solid var(--border-color); border-radius:0 0 6px 6px;">';
  html += '<button onclick="addVEGearboxRow(\'' + node.id + '\')" style="flex:1; padding:4px 8px; font-size:0.65rem; background:var(--accent-primary); color:white; border:none; border-radius:4px; cursor:pointer;">+ Satır Ekle</button>';
  html += '<button onclick="clearVEGearboxTable(\'' + node.id + '\')" style="flex:1; padding:4px 8px; font-size:0.65rem; background:var(--accent-warning); color:white; border:none; border-radius:4px; cursor:pointer;">Tümünü Sil</button>';
  html += '<button onclick="saveVEGearboxValues(\'' + node.id + '\')" style="flex:1; padding:4px 8px; font-size:0.65rem; background:var(--accent-success); color:white; border:none; border-radius:4px; cursor:pointer;">💾 Kaydet</button>';
  html += '</div>';
  
  html += '</div>'; // ve-gearbox-data-area
  
  // ===== TEST BAŞLANGIÇ VİTESİ =====
  html += '<div style="background:var(--bg-tertiary); border-radius:8px; padding:10px; margin-top:12px;">';
  html += '<div style="font-size:0.75rem; font-weight:600; color:var(--text-heading); margin-bottom:10px; display:flex; align-items:center; gap:6px;">Test Başlangıç Vitesi <button onclick="showInfoPopup(\'testVitesi\')" style="width:16px; height:16px; border-radius:50%; background:var(--accent-primary); color:white; border:none; cursor:pointer; font-size:0.6rem; display:flex; align-items:center; justify-content:center;" title="Bilgi">?</button></div>';
  
  html += '<table style="width:100%; font-size:0.7rem; border-collapse:collapse; border:1px solid var(--border-color);">';
  html += '<tr style="border-bottom:1px solid var(--border-color);">';
  html += '<th style="padding:8px; text-align:left; background:var(--bg-tertiary); border-right:1px solid var(--border-color); width:50%; font-weight:500; color:var(--text-secondary);">Kaçıncı vites?</th>';
  html += '<td style="padding:8px; background:var(--bg-tertiary);">';
  html += '<select id="ve-gear-select-' + node.id + '" onchange="onVEGearSelectChange(\'' + node.id + '\')" style="width:100%; padding:5px; font-size:0.7rem; background:var(--bg-input); color:var(--text-primary); border:1px solid var(--border-color); border-radius:4px;">';
  html += '<option value="">-- Vites Seçin --</option>';
  html += '</select>';
  html += '</td>';
  html += '</tr>';
  html += '<tr>';
  html += '<th style="padding:8px; text-align:left; background:var(--bg-tertiary); border-right:1px solid var(--border-color); font-weight:500; color:var(--text-secondary);">Seçili vites oranı</th>';
  html += '<td style="padding:8px; background:var(--bg-tertiary);"><input type="number" id="ve-gear-ratio-' + node.id + '" value="' + selectedGearRatio + '" readonly style="width:100%; padding:5px; font-size:0.7rem; background:var(--bg-secondary); color:var(--text-primary); border:1px solid var(--border-color); border-radius:4px; text-align:right; cursor:not-allowed;"></td>';
  html += '</tr>';
  html += '</table>';
  
  html += '<p style="font-size:0.62rem; color:var(--text-muted); margin-top:6px; line-height:1.4;">Önce yukarıdan şanzıman seçin, ardından test başlangıç vitesini belirleyin.</p>';
  
  html += '</div>';
  
  // ===== VERİM =====
  var gearboxEfficiency = nodeData.efficiency !== undefined ? nodeData.efficiency : 97;
  html += '<div style="background:var(--bg-tertiary); border-radius:8px; padding:10px; margin-top:12px;">';
  html += '<div style="font-size:0.75rem; font-weight:600; color:var(--text-heading); margin-bottom:8px;">Verim</div>';
  html += '<table style="width:100%; font-size:0.7rem; border-collapse:collapse; border:1px solid var(--border-color);">';
  html += '<tr style="border-bottom:1px solid var(--border-color);">';
  html += '<th style="padding:8px; text-align:left; background:var(--bg-tertiary); border-right:1px solid var(--border-color); width:55%; font-weight:500; color:var(--text-secondary);">Şanzıman verimi [%]</th>';
  html += '<td style="padding:8px; background:var(--bg-tertiary);"><input type="number" id="ve-gearbox-eff-' + node.id + '" value="' + gearboxEfficiency + '" step="0.5" min="80" max="100" style="width:100%; padding:5px; font-size:0.7rem; background:var(--bg-input); color:var(--text-primary); border:1px solid var(--border-color); border-radius:4px; text-align:right;" onchange="onVEGearboxEffChange(\'' + node.id + '\')"></td>';
  html += '</tr>';
  html += '<tr><td colspan="2" style="padding:5px 8px; font-size:0.62rem; color:var(--text-muted); background:var(--bg-secondary);">Tipik değer: %95–98</td></tr>';
  html += '</table></div>';
  
  } // end motor freni else

  html += '</div>';
  return html;
}

// ===== TAM GAZ VİTES VARSAYILAN VERİLERİ =====
var VE_FT_GB_DEFAULT_GEARS = [
  {name: 'F1', ratio: 3.487, eff: 98.11, lockup: false},
  {name: 'F2', ratio: 1.864, eff: 98.79, lockup: true},
  {name: 'F3', ratio: 1.409, eff: 99.00, lockup: true},
  {name: 'F4', ratio: 1.000, eff: 99.64, lockup: true},
  {name: 'F5', ratio: 0.750, eff: 98.62, lockup: true},
  {name: 'F6', ratio: 0.652, eff: 98.05, lockup: true},
  {name: 'R1', ratio: 5.026, eff: 97.50, lockup: false}
];

function getVEFTGearRowHTML(nodeId, name, ratio, eff, lockup) {
  var html = '<tr>';
  html += '<td style="padding:3px; border-bottom:1px solid var(--border-color);"><input type="text" value="' + (name || '') + '" style="width:100%; padding:4px; font-size:0.68rem; background:var(--bg-input); color:var(--text-primary); border:1px solid var(--border-color); border-radius:3px; text-align:center;" onchange="onVEFTGearDataChange(\'' + nodeId + '\')"></td>';
  html += '<td style="padding:3px; border-bottom:1px solid var(--border-color);"><input type="number" value="' + (ratio !== undefined && ratio !== '' ? ratio : '') + '" step="0.001" min="0" style="width:100%; padding:4px; font-size:0.68rem; background:var(--bg-input); color:var(--text-primary); border:1px solid var(--border-color); border-radius:3px; text-align:center;" onchange="onVEFTGearDataChange(\'' + nodeId + '\')"></td>';
  html += '<td style="padding:3px; border-bottom:1px solid var(--border-color);"><input type="number" value="' + (eff !== undefined && eff !== '' ? eff : '') + '" step="0.01" min="0" max="100" style="width:100%; padding:4px; font-size:0.68rem; background:var(--bg-input); color:var(--text-primary); border:1px solid var(--border-color); border-radius:3px; text-align:center;" onchange="onVEFTGearDataChange(\'' + nodeId + '\')"></td>';
  // Lockup: shift profilinden otomatik belirlenir, kullanıcı değiştiremez
  var lockupLabel = lockup ? '<span style="color:var(--accent-success); font-weight:600;">L</span>' : '<span style="color:var(--text-muted);">C</span>';
  html += '<td style="padding:3px; border-bottom:1px solid var(--border-color); text-align:center; font-size:0.64rem;">' + lockupLabel + '<input type="hidden" value="' + (lockup ? 'true' : 'false') + '"></td>';
  html += '<td style="padding:3px; border-bottom:1px solid var(--border-color); text-align:center;"><button onclick="removeVEFTGearRow(this, \'' + nodeId + '\')" style="padding:2px 6px; font-size:0.6rem; background:var(--accent-danger); color:white; border:none; border-radius:3px; cursor:pointer;" title="Sil">×</button></td>';
  html += '</tr>';
  return html;
}

function addVEFTGearRow(nodeId) {
  var tbody = document.getElementById('ve-ftgear-table-' + nodeId);
  if(!tbody) return;
  var tr = document.createElement('tr');
  tr.innerHTML = getVEFTGearRowHTML(nodeId, '', '', '', false).replace('<tr>', '').replace('</tr>', '');
  tbody.appendChild(tr);
}

function removeVEFTGearRow(btn, nodeId) {
  var tr = btn.closest('tr');
  if(tr) { tr.remove(); onVEFTGearDataChange(nodeId); }
}

function clearVEFTGearTable(nodeId) {
  var tbody = document.getElementById('ve-ftgear-table-' + nodeId);
  if(!tbody) return;
  tbody.innerHTML = '';
  for(var i = 0; i < 3; i++) addVEFTGearRow(nodeId);
  onVEFTGearDataChange(nodeId);
  showToast('Vites tablosu temizlendi');
}

function saveVEFTGearData(nodeId) {
  onVEFTGearDataChange(nodeId);
  var node = nodes.find(function(n) { return n.id === nodeId; });
  if(!node || !node.data || !node.data.ftGearData || node.data.ftGearData.length === 0) {
    showToast('Kaydedilecek veri yok', 'error'); return;
  }
  showToast('Vites verileri kaydedildi (' + node.data.ftGearData.length + ' vites)');
}

function onVEFTGearDataChange(nodeId) {
  var tbody = document.getElementById('ve-ftgear-table-' + nodeId);
  if(!tbody) return;
  var node = nodes.find(function(n) { return n.id === nodeId; });
  if(!node) return;
  if(!node.data) node.data = {};
  
  var ftGearData = [];
  var rows = tbody.querySelectorAll('tr');
  rows.forEach(function(tr) {
    var textInputs = tr.querySelectorAll('input[type="text"]');
    var numInputs = tr.querySelectorAll('input[type="number"]');
    var hiddenInput = tr.querySelector('input[type="hidden"]');
    if(textInputs.length >= 1 && numInputs.length >= 2) {
      var name = textInputs[0].value.trim();
      var ratio = parseFloat(numInputs[0].value);
      var eff = parseFloat(numInputs[1].value);
      var lockup = hiddenInput ? hiddenInput.value === 'true' : false;
      if(name || !isNaN(ratio)) {
        ftGearData.push({
          name: name,
          ratio: isNaN(ratio) ? null : ratio,
          eff: isNaN(eff) ? null : eff,
          lockup: lockup
        });
      }
    }
  });
  node.data.ftGearData = ftGearData;
}

// FT Gear tablo resize
var veFTGearResizing = null;
function startVEFTGearTableResize(e, nodeId) {
  e.preventDefault();
  veFTGearResizing = { nodeId: nodeId, startY: e.clientY, startHeight: document.getElementById('ve-ftgear-table-wrapper-' + nodeId).offsetHeight };
  document.addEventListener('mousemove', doVEFTGearResize);
  document.addEventListener('mouseup', stopVEFTGearResize);
}
function doVEFTGearResize(e) {
  if(!veFTGearResizing) return;
  var w = document.getElementById('ve-ftgear-table-wrapper-' + veFTGearResizing.nodeId);
  if(!w) return;
  var h = Math.max(80, Math.min(400, veFTGearResizing.startHeight + (e.clientY - veFTGearResizing.startY)));
  w.style.maxHeight = h + 'px';
  var nd = nodes.find(function(n) { return n.id === veFTGearResizing.nodeId; });
  if(nd) { if(!nd.data) nd.data = {}; nd.data.ftGearTableHeight = h; }
}
function stopVEFTGearResize() {
  veFTGearResizing = null;
  document.removeEventListener('mousemove', doVEFTGearResize);
  document.removeEventListener('mouseup', stopVEFTGearResize);
}

// ===== SHIFT PROFİLLERİ =====
// Lockup-mod geçişleri lineer formülle modellenir:
//   N_out_threshold = a × ESL + b
// Burada:
//   N_out = Şanzıman çıkış devri (lockup modda N_engine / i_gear)
//   ESL = Engine Speed Limit (governed RPM)
//   a = eğim (≈ 1 / i_gear), b = kalibrasyon ofseti
//   S4 için minCap: minimum N_out eşiği (formül altına düşmesini engeller)
var VE_FT_SHIFT_PROFILES = {
  allison3200sp_s1: {
    name: 'Allison 3200 SP — S1 Performance',
    family: '3000',
    lockupOffset: 75,    // Geriye uyumluluk (lockupShifts yoksa kullanılır)
    // Converter-mod geçiş oranları (N_out / N_shift_ref)
    // iSCAAN çapraz validasyondan türetildi (5 rapor, 3 motor, 2 TC)
    shift1C2C_outRatio: 0.2150,   // 1C→2C: N_out ≥ 0.2150 × N_shift_ref
    shift2C2L_outRatio: 0.3594,   // 2C→2L: N_out ≥ 0.3594 × N_shift_ref
    shiftRefRPM: null,    // null = motor governed kullan (varsayılan)
    // Lockup-mod geçişleri: N_out = a × ESL + b
    // S1: b ≈ -75 / i_gear → N_engine ≥ N_gov - 75 ile eşdeğer
    lockupShifts: {
      '2L3L': { a: 0.5361, b: -39.6 },   // 2L→3L, i_gear ≈ 1.8654, max hata ±0.4 rpm
      '3L4L': { a: 0.7100, b: -54.0 },   // 3L→4L, i_gear ≈ 1.4085, max hata ±0.0 rpm
      '4L5L': { a: 1.0000, b: -75.0 },   // 4L→5L, i_gear = 1.0000, max hata ±0.0 rpm
      '5L6L': { a: 1.3337, b: -100.1 }   // 5L→6L, i_gear ≈ 0.7498, max hata ±0.5 rpm
    },
    // Eski SR/η bazlı değerler (referans, artık kullanılmıyor)
    srShift1C2C: 0.78,
    srLockup2C2L: 0.85,
    etaLockup2C2L: 0.83
  },
  allison3200sp_s2: {
    name: 'Allison 3200 SP — S2 Performance',
    family: '3000',
    lockupOffset: 0,     // Geriye uyumluluk (b=0 → offset yok)
    shift1C2C_outRatio: 0.2150,   // 1C→2C: tüm kalibrasyonlarda aynı
    shift2C2L_outRatio: 0.3522,   // 2C→2L: N_out ≥ 0.3522 × N_shift_ref
    shiftRefRPM: null,
    // Lockup-mod geçişleri: N_out = a × ESL + b
    // S2: b = 0 → Geçiş tam N_gov'da, ofset yok
    lockupShifts: {
      '2L3L': { a: 0.4828, b: 0 },       // 2L→3L, i_gear ≈ 2.0712, max hata ±0.5 rpm
      '3L4L': { a: 0.6385, b: 0 },       // 3L→4L, i_gear ≈ 1.5663, max hata ±0.5 rpm
      '4L5L': { a: 0.9000, b: 0 },       // 4L→5L, i_gear ≈ 1.1111, max hata ±0.0 rpm
      '5L6L': { a: 1.2000, b: 0 }        // 5L→6L, i_gear ≈ 0.8333, max hata ±0.0 rpm
    },
    srShift1C2C: 0.78,
    srLockup2C2L: 0.85,
    etaLockup2C2L: 0.83
  },
  allison3200sp_s3: {
    name: 'Allison 3200 SP — S3 Economy',
    family: '3000',
    lockupOffset: -100,  // Geriye uyumluluk (pozitif b → erken geçiş)
    shift1C2C_outRatio: 0.2150,   // 1C→2C: tüm kalibrasyonlarda aynı
    shift2C2L_outRatio: 0.3468,   // 2C→2L: N_out ≥ 0.3468 × N_shift_ref
    shiftRefRPM: null,
    // Lockup-mod geçişleri: N_out = a × ESL + b
    // S3: b > 0 → Erken geçiş (ekonomik), düşük eğim (düşük efektif oran)
    // Not: 5L→6L nonlineer davranış gösterir (max hata 6.8 rpm)
    lockupShifts: {
      '2L3L': { a: 0.4258, b: 70.8 },    // 2L→3L, i_gear ≈ 2.3484, max hata ±0.4 rpm
      '3L4L': { a: 0.6000, b: 100.0 },   // 3L→4L, i_gear ≈ 1.6667, max hata ±0.0 rpm
      '4L5L': { a: 0.8000, b: 134.0 },   // 4L→5L, i_gear ≈ 1.2500, max hata ±0.0 rpm
      '5L6L': { a: 0.9256, b: 141.5 }    // 5L→6L, i_gear ≈ 1.0803, max hata ±6.8 rpm
    },
    srShift1C2C: 0.78,
    srLockup2C2L: 0.85,
    etaLockup2C2L: 0.83
  },
  allison3200sp_s4: {
    name: 'Allison 3200 SP — S4 Economy',
    family: '3000',
    lockupOffset: 50,    // Geriye uyumluluk (yaklaşık)
    shift1C2C_outRatio: 0.2150,   // 1C→2C: tüm kalibrasyonlarda aynı
    shift2C2L_outRatio: 0.3326,   // 2C→2L: N_out ≥ 0.3326 × N_shift_ref
    shiftRefRPM: null,
    // Lockup-mod geçişleri: N_out = a × ESL + b
    // S4: minCap tanımlı — formül düşük ESL'de minimum eşiğin altına düşmesini engeller
    // Not: 2L→3L nonlineer davranış gösterir (max hata 6.2 rpm)
    lockupShifts: {
      '2L3L': { a: 0.4088, b: 4.9, minCap: 724 },     // 2L→3L, i_gear ≈ 2.4460, max hata ±6.2 rpm
      '3L4L': { a: 0.6000, b: -50.0, minCap: 1020 },   // 3L→4L, i_gear ≈ 1.6667, max hata ±0.0 rpm
      '4L5L': { a: 0.8000, b: -66.0, minCap: 1360 },   // 4L→5L, i_gear ≈ 1.2500, max hata ±0.0 rpm
      '5L6L': { a: 1.0000, b: -45.0 }                   // 5L→6L, i_gear ≈ 1.0000, max hata ±0.0 rpm
    },
    srShift1C2C: 0.78,
    srLockup2C2L: 0.85,
    etaLockup2C2L: 0.83
  },
  allison3500sp_s1: {
    name: 'Allison 3500 SP — S1 Performance',
    family: '3000',
    lockupOffset: 75,    // Geriye uyumluluk
    shift1C2C_outRatio: 0.1635,   // Yaklaşık (converterShifts varsa o kullanılır)
    shift2C2L_outRatio: null,     // Lineer model — basit oran yok
    shiftRefRPM: null,
    // Converter-mod geçişleri: Lineer model
    // 1C→2C tüm kalibrasyonlarda aynı, 2C→2L kalibrasyon bazlı
    // Kaynak: 44 VEPS kalibrasyon raporu (CIN: CI-83000-91D-3)
    converterShifts: {
      '1C2C': { a: 0.1635, b: -0.3 },             // max hata ±0.4 rpm
      '2C2L': { a: 0.2915, b: 13.4 }               // max hata ±8.1 rpm
    },
    // Lockup-mod: N_engine = ESL - 75 (3200SP/4500SP S1 ile aynı kural)
    lockupShifts: {
      '2L3L': { a: 0.4439, b: -33.4 },   // i_gear ≈ 2.253, max hata ±0.4 rpm
      '3L4L': { a: 0.6514, b: -48.3 },   // i_gear ≈ 1.534, max hata ±0.5 rpm
      '4L5L': { a: 1.0000, b: -75.0 },   // i_gear = 1.000, max hata ±0.0 rpm
      '5L6L': { a: 1.3354, b: -99.9 }    // i_gear ≈ 0.749, max hata ±0.5 rpm
    },
    srShift1C2C: 0.78,
    srLockup2C2L: 0.85,
    etaLockup2C2L: 0.83
  },
  allison3500sp_s2: {
    name: 'Allison 3500 SP — S2 Performance',
    family: '3000',
    lockupOffset: 0,     // Geriye uyumluluk (b ≈ 0)
    shift1C2C_outRatio: 0.1635,
    shift2C2L_outRatio: null,
    shiftRefRPM: null,
    converterShifts: {
      '1C2C': { a: 0.1635, b: -0.3 },
      '2C2L': { a: 0.2862, b: 12.1 }               // max hata ±8.0 rpm
    },
    // Lockup-mod: N_engine = 0.9 × ESL (3200SP/4500SP S2 ile aynı kural)
    lockupShifts: {
      '2L3L': { a: 0.4000, b: -1.0, minCap: 665 },  // i_gear ≈ 2.253, max hata ±0.0 rpm
      '3L4L': { a: 0.5865, b: 0, minCap: 994 },      // i_gear ≈ 1.534, max hata ±0.4 rpm
      '4L5L': { a: 0.9000, b: 0 },                    // i_gear ≈ 1.000, max hata ±0.0 rpm
      '5L6L': { a: 1.2022, b: -0.6 }                  // i_gear ≈ 0.749, max hata ±0.4 rpm
    },
    srShift1C2C: 0.78,
    srLockup2C2L: 0.85,
    etaLockup2C2L: 0.83
  },
  allison3500sp_s3: {
    name: 'Allison 3500 SP — S3 Economy',
    family: '3000',
    lockupOffset: -100,  // Geriye uyumluluk (yaklaşık)
    shift1C2C_outRatio: 0.1635,
    shift2C2L_outRatio: null,
    shiftRefRPM: null,
    converterShifts: {
      '1C2C': { a: 0.1635, b: -0.3 },
      '2C2L': { a: 0.2800, b: 15.0 }
    },
    // Lockup-mod: Her viteste ayrı parametreler
    // Not: 2L→3L hafif nonlineer (6.1 rpm), 5L→6L yüksek ESL'de nonlineer (4.0 rpm)
    // Not: 3L→4L S1 ile birebir aynı (N_engine = ESL - 75)
    lockupShifts: {
      '2L3L': { a: 0.4015, b: 40.7 },    // i_gear ≈ 2.253, max hata ±6.1 rpm (nonlineer)
      '3L4L': { a: 0.6514, b: -48.3 },   // i_gear ≈ 1.534, max hata ±0.5 rpm (S1 ile aynı)
      '4L5L': { a: 0.8011, b: 134.0 },   // i_gear ≈ 1.000, max hata ±0.5 rpm
      '5L6L': { a: 0.9241, b: 148.4 }    // i_gear ≈ 0.749, max hata ±4.0 rpm (nonlineer)
    },
    srShift1C2C: 0.78,
    srLockup2C2L: 0.85,
    etaLockup2C2L: 0.83
  },
  allison3500sp_s4: {
    name: 'Allison 3500 SP — S4 Economy',
    family: '3000',
    lockupOffset: 50,    // Geriye uyumluluk (yaklaşık)
    shift1C2C_outRatio: 0.1635,
    shift2C2L_outRatio: null,
    shiftRefRPM: null,
    converterShifts: {
      '1C2C': { a: 0.1635, b: -0.3 },
      '2C2L': { a: 0.2691, b: 14.0 }               // max hata ±9.5 rpm
    },
    // Lockup-mod: minCap destekli (düşük ESL koruması)
    lockupShifts: {
      '2L3L': { a: 0.3915, b: -33.6, minCap: 665 },   // i_gear ≈ 2.253, max hata ±0.5 rpm
      '3L4L': { a: 0.6000, b: -50.0, minCap: 1020 },   // i_gear ≈ 1.534, max hata ±0.0 rpm
      '4L5L': { a: 0.8007, b: -65.4, minCap: 1362 },   // i_gear ≈ 1.000, max hata ±0.6 rpm
      '5L6L': { a: 1.0000, b: -45.0 }                   // i_gear ≈ 0.749, max hata ±0.0 rpm
    },
    srShift1C2C: 0.78,
    srLockup2C2L: 0.85,
    etaLockup2C2L: 0.83
  },
  allison4000sp_s1: {
    name: 'Allison 4000 SP — S1 Performance',
    family: '4000',
    lockupOffset: 75,
    shift1C2C_outRatio: 0.2137,   // 1C→2C: N_out ≥ 0.2137 × N_shift_ref
    shift2C2L_outRatio: 0.3516,   // 2C→2L: N_out ≥ 0.3516 × N_shift_ref
    shiftRefRPM: null,    // null = motor governed kullan (varsayılan)
    srShift1C2C: 0.78,
    srLockup2C2L: 0.85,
    etaLockup2C2L: 0.83
  },
  allison4500sp_s1: {
    name: 'Allison 4500 SP — S1 Performance',
    family: '4000',
    lockupOffset: 75,    // Geriye uyumluluk
    shift1C2C_outRatio: 0.1592,   // Yaklaşık (converterShifts varsa o kullanılır)
    shift2C2L_outRatio: null,     // Segmentli model — basit oran yok
    shiftRefRPM: null,
    // Converter-mod geçişleri: Lineer + segmentli model
    // 3200SP'den farklı olarak basit oran yerine N_out = a × ESL + b kullanır
    converterShifts: {
      '1C2C': { a: 0.1592, b: 0.9 },              // N_out ≥ 0.1592 × ESL + 0.9, max hata ±0.5 rpm
      '2C2L': {
        type: 'segmented',
        linear: { a: 0.0800, b: 111.0, validFrom: 1800 }, // ESL ≥ 1800: max hata ±0.0 rpm
        lookup: [[1600, 230], [1700, 242]]                  // ESL < 1800: lookup tablosu
      }
    },
    // Lockup-mod geçişleri: N_out = a × ESL + b
    // S1: N_engine = ESL - 75 (3200SP S1 ile birebir aynı kural)
    lockupShifts: {
      '2L3L': { a: 0.4522, b: -34.6 },   // i_gear ≈ 2.2115, max hata ±0.4 rpm
      '3L4L': { a: 0.6540, b: -49.0 },   // i_gear ≈ 1.5291, max hata ±0.4 rpm
      '4L5L': { a: 1.0000, b: -75.0 },   // i_gear = 1.0000, max hata ±0.0 rpm
      '5L6L': { a: 1.3086, b: -98.7 }    // i_gear ≈ 0.7642, max hata ±0.5 rpm
    },
    srShift1C2C: 0.78,
    srLockup2C2L: 0.85,
    etaLockup2C2L: 0.83
  },
  allison4500sp_s2: {
    name: 'Allison 4500 SP — S2 Performance',
    family: '4000',
    lockupOffset: 0,     // Geriye uyumluluk (b ≈ 0)
    shift1C2C_outRatio: 0.1592,
    shift2C2L_outRatio: null,
    shiftRefRPM: null,
    converterShifts: {
      '1C2C': { a: 0.1592, b: 0.9 },
      '2C2L': {
        type: 'segmented',
        linear: { a: 0.0800, b: 111.0, validFrom: 1800 },
        lookup: [[1600, 230], [1700, 242]]
      }
    },
    // Lockup-mod: N_engine = 0.9 × ESL (3200SP S2 ile birebir aynı kural)
    lockupShifts: {
      '2L3L': { a: 0.4067, b: -0.2, minCap: 667 },  // i_gear ≈ 2.2115, max hata ±0.4 rpm
      '3L4L': { a: 0.5888, b: -0.7, minCap: 997 },   // i_gear ≈ 1.5291, max hata ±0.5 rpm
      '4L5L': { a: 0.9000, b: 0 },                    // i_gear ≈ 1.0000, max hata ±0.0 rpm
      '5L6L': { a: 1.1776, b: -0.1 }                  // i_gear ≈ 0.7642, max hata ±0.4 rpm
    },
    srShift1C2C: 0.78,
    srLockup2C2L: 0.85,
    etaLockup2C2L: 0.83
  },
  allison4500sp_s3: {
    name: 'Allison 4500 SP — S3 Economy',
    family: '4000',
    lockupOffset: -100,  // Geriye uyumluluk (yaklaşık)
    shift1C2C_outRatio: 0.1592,
    shift2C2L_outRatio: null,
    shiftRefRPM: null,
    converterShifts: {
      '1C2C': { a: 0.1592, b: 0.9 },
      '2C2L': {
        type: 'segmented',
        linear: { a: 0.0800, b: 111.0, validFrom: 1800 },
        lookup: [[1600, 230], [1700, 242]]
      }
    },
    // Lockup-mod: Her viteste ayrı parametreler
    // Not: 2L→3L hafif nonlineerlik (2.8 rpm), 5L→6L önemli nonlineerlik (11.7 rpm)
    // Not: 3L→4L parametreleri S1 ile aynı
    lockupShifts: {
      '2L3L': { a: 0.3945, b: 60.6 },    // i_gear ≈ 2.2115, max hata ±2.8 rpm
      '3L4L': { a: 0.6540, b: -49.0 },   // i_gear ≈ 1.5291, max hata ±0.4 rpm (S1 ile aynı)
      '4L5L': { a: 0.7850, b: 130.8 },   // i_gear ≈ 1.0000, max hata ±0.3 rpm
      '5L6L': { a: 0.9843, b: -8.5 }     // i_gear ≈ 0.7642, max hata ±11.7 rpm (nonlineer)
    },
    srShift1C2C: 0.78,
    srLockup2C2L: 0.85,
    etaLockup2C2L: 0.83
  },
  allison4500sp_s4: {
    name: 'Allison 4500 SP — S4 Economy',
    family: '4000',
    lockupOffset: 50,    // Geriye uyumluluk (yaklaşık)
    shift1C2C_outRatio: 0.1592,
    shift2C2L_outRatio: null,
    shiftRefRPM: null,
    converterShifts: {
      '1C2C': { a: 0.1592, b: 0.9 },
      '2C2L': {
        type: 'segmented',
        linear: { a: 0.0800, b: 111.0, validFrom: 1800 },
        lookup: [[1600, 230], [1700, 242]]
      }
    },
    // Lockup-mod: minCap destekli (düşük ESL koruması)
    lockupShifts: {
      '2L3L': { a: 0.3923, b: -32.5, minCap: 667 },   // i_gear ≈ 2.2115, max hata ±0.4 rpm
      '3L4L': { a: 0.6000, b: -50.0, minCap: 1020 },   // i_gear ≈ 1.5291, max hata ±0.0 rpm
      '4L5L': { a: 0.7850, b: -65.2, minCap: 1335 },   // i_gear ≈ 1.0000, max hata ±0.3 rpm
      '5L6L': { a: 1.0000, b: -45.0 }                   // i_gear ≈ 0.7642, max hata ±0.0 rpm
    },
    srShift1C2C: 0.78,
    srLockup2C2L: 0.85,
    etaLockup2C2L: 0.83
  },
  // ════════════════════════════════════════════════════════════════════════
  // ALLISON 2500SP — 1000/2000 SERİSİ
  // ════════════════════════════════════════════════════════════════════════
  // Kaynak: 44 adet VEPS kalibrasyon raporu (CIN: B1-81000-43C-9, ESL 1600-2600 rpm, S1-S4)
  // Vites oranları (KaATCC): 1st=3.512, 2nd=1.896, 3rd=1.439, 4th=1.000, 5th=0.737, 6th=0.643
  // 1→2 tüm kalibrasyonlarda aynı: N_out = 0.2133 × ESL (konvertör modu, max hata ±0.4 rpm)
  allison2500sp_s1: {
    name: 'Allison 2500 SP — S1 Performance',
    family: '1000_2000',
    lockupOffset: 75,
    shift1C2C_outRatio: 0.2133,   // Tüm kalibrasyonlarda aynı (konvertör modu)
    shift2C2L_outRatio: 0.3594,
    shiftRefRPM: null,
    // Upshift: Lockup-mod — N_engine = ESL - 75 kuralı
    lockupShifts: {
      '2L3L': { a: 0.5275, b: -39.7 },   // max hata ±0.5 rpm
      '3L4L': { a: 0.6950, b: -52.2 },   // max hata ±0.3 rpm
      '4L5L': { a: 1.0000, b: -75.0 },   // max hata ±0.0 rpm
      '5L6L': { a: 1.3577, b: -101.8 }   // max hata ±0.5 rpm
    },
    // Downshift eşikleri: N_out < threshold → alt vitese düş
    downshiftThresholds: {
      '3to2': { a: 0.4171, b: 0 },    // max hata ±0.4 rpm
      '4to3': { a: 0.6100, b: 0 },    // max hata ±0.0 rpm
      '5to4': { a: 0.8826, b: 0 },    // max hata ±0.5 rpm
      '6to5': { type: 'piecewise', breakpoint: 2000,
        low:  { a: 1.3550, b: -300.8 },   // ESL ≤ 2000, max hata ±0.3 rpm
        high: { a: 1.2037, b: 1.4 }       // ESL ≥ 2100, max hata ±0.5 rpm
      },
      '2to1': { a: 0.1067, b: 150.8, capValue: 312, capBelow: 1700 }  // max hata ±0.5 rpm
    },
    srShift1C2C: 0.78,
    srLockup2C2L: 0.85,
    etaLockup2C2L: 0.83
  },
  // S2 Performance — N_engine = 0.90 × ESL kuralı (oransal, offset yok)
  // Histerezis: 4→5/5→4 = 100 rpm, 5→6/6→5 ≈ 203 rpm, 3→4/4→3 ≈ 69 rpm
  allison2500sp_s2: {
    name: 'Allison 2500 SP — S2 Performance',
    family: '1000_2000',
    lockupOffset: 0,
    shift1C2C_outRatio: 0.2133,
    shift2C2L_outRatio: 0.3594,
    shiftRefRPM: null,
    // Upshift: Lockup-mod — N_engine ≈ 0.90 × ESL
    lockupShifts: {
      '2L3L': { a: 0.4750, b: 0 },                                     // max hata ±1.0 rpm
      '3L4L': { a: 0.6257, b: -0.4, capValue: 1020, capBelow: 1700 },  // ESL=1600: cap 1020, max hata ±0.5 rpm
      '4L5L': { a: 0.9000, b: 0 },                                     // max hata ±0.0 rpm
      '5L6L': { a: 1.2221, b: 0 }                                      // max hata ±1.0 rpm
    },
    // Downshift eşikleri: S2 Performance
    downshiftThresholds: {
      '3to2': { a: 0.4171, b: 0 },                                     // S1 ile aynı, max hata ±0.4 rpm
      '4to3': { a: 0.6256, b: -69.6, capValue: 950, capBelow: 1700 },  // max hata ±0.5 rpm
      '5to4': { a: 0.9000, b: -100 },                                  // max hata ±0.0 rpm
      '6to5': { a: 1.2218, b: -203.2 },                                // max hata ±0.5 rpm (S2'de parçalı yok: tekil lineer)
      '2to1': { a: 0.1067, b: 150.8, capValue: 312, capBelow: 1700 }   // S1 ile aynı, max hata ±0.5 rpm
    },
    srShift1C2C: 0.78,
    srLockup2C2L: 0.85,
    etaLockup2C2L: 0.83
  },
  // S3 Economy — Her shift kendi formülüne sahip (tek bir kural yok)
  // Histerezis: 3→4/4→3 ≈ 99 rpm, 4→5/5→4 ≈ 136 rpm, 5→6/6→5 ≈ 136 rpm
  allison2500sp_s3: {
    name: 'Allison 2500 SP — S3 Economy',
    family: '1000_2000',
    lockupOffset: 0,
    shift1C2C_outRatio: 0.2133,
    shift2C2L_outRatio: 0.3594,
    shiftRefRPM: null,
    // Upshift: Lockup-mod — per-gear bağımsız formüller
    lockupShifts: {
      '2L3L': { a: 0.4171, b: 69.4 },    // max hata ±0.4 rpm
      '3L4L': { a: 0.6000, b: 100 },     // max hata ±0.0 rpm
      '4L5L': { a: 0.8146, b: 135.9 },   // max hata ±0.5 rpm
      '5L6L': { a: 0.9326, b: 154.8 }    // max hata ±1.0 rpm
    },
    // Downshift eşikleri: S3 Economy
    downshiftThresholds: {
      '3to2': { a: 0.4171, b: 0 },                                     // S1 ile aynı, max hata ±0.4 rpm
      '4to3': { a: 0.6000, b: 0, capValue: 976, capBelow: 1700 },      // ESL=1600: cap 976, max hata ±0.0 rpm
      '5to4': { a: 0.8150, b: 0 },                                     // max hata ±0.3 rpm
      '6to5': { type: 'piecewise', breakpoint: 2000,
        low:  { a: 0.9560, b: -39.8 },   // ESL ≤ 2000, max hata ±3.0 rpm
        high: { a: 1.0000, b: -125 }     // ESL ≥ 2100, max hata ±0.0 rpm
      },
      '2to1': { a: 0.1067, b: 150.8, capValue: 312, capBelow: 1700 }   // S1 ile aynı, max hata ±0.5 rpm
    },
    srShift1C2C: 0.78,
    srLockup2C2L: 0.85,
    etaLockup2C2L: 0.83
  },
  // S4 Economy — Düşük ESL'lerde cap paternli, en konservatif kalibrasyon
  // Histerezis: 3→4/4→3 ≈ 55 rpm, 4→5/5→4 ≈ 80 rpm, 5→6/6→5 ≈ 80 rpm
  allison2500sp_s4: {
    name: 'Allison 2500 SP — S4 Economy',
    family: '1000_2000',
    lockupOffset: 0,
    shift1C2C_outRatio: 0.2133,
    shift2C2L_outRatio: 0.3594,
    shiftRefRPM: null,
    // Upshift: Lockup-mod — düşük ESL'lerde cap paternli
    lockupShifts: {
      '2L3L': { type: 'segments', segments: [
        { maxESL: 1700, cap: 709 },                   // ESL ≤ 1700: cap
        { maxESL: 2100, a: 0.3540, b: 98.7 },         // 1800 ≤ ESL ≤ 2100, max hata ±0.3 rpm
        {              a: 0.4160, b: -32.4 }           // ESL ≥ 2200, max hata ±0.4 rpm
      ]},
      '3L4L': { a: 0.6000, b: -50, capValue: 1020, capBelow: 1800 },   // ESL ≤ 1700: cap, max hata ±0.0 rpm
      '4L5L': { a: 0.8143, b: -67.2, capValue: 1385, capBelow: 1800 }, // ESL ≤ 1700: cap, max hata ±0.0 rpm
      '5L6L': { a: 1.0000, b: -45 }                                    // max hata ±0.0 rpm
    },
    // Downshift eşikleri: S4 Economy
    downshiftThresholds: {
      '3to2': { type: 'segments', segments: [
        { maxESL: 1700, cap: 639 },                   // ESL ≤ 1700: cap
        { maxESL: 2100, a: 0.3530, b: 26.9 },         // 1800 ≤ ESL ≤ 2100, max hata ±0.4 rpm
        {              a: 0.4170, b: -69.4 }           // ESL ≥ 2200, max hata ±0.4 rpm
      ]},
      '4to3': { a: 0.6000, b: -100, capValue: 920, capBelow: 1800 },   // ESL ≤ 1700: cap, max hata ±0.0 rpm
      '5to4': { a: 0.8140, b: -134.4, capValue: 1249, capBelow: 1800 },// ESL ≤ 1700: cap, max hata ±0.4 rpm
      '6to5': { a: 1.0000, b: -125 },                                  // max hata ±0.0 rpm
      '2to1': { a: 0.1067, b: 150.8, capValue: 312, capBelow: 1700 }   // S1 ile aynı, max hata ±0.5 rpm
    },
    srShift1C2C: 0.78,
    srLockup2C2L: 0.85,
    etaLockup2C2L: 0.83
  }
};

// Tam Gaz — Şanzıman parametre değişikliği
function onVEFTGBParamChange(nodeId) {
  var node = nodes.find(function(n) { return n.id === nodeId; });
  if(!node) return;
  if(!node.data) node.data = {};
  
  var nameEl = document.getElementById('ve-gb-name-' + nodeId);
  var shiftEl = document.getElementById('ve-gb-shift-' + nodeId);
  var fwdEl = document.getElementById('ve-gb-fwd-' + nodeId);
  var revEl = document.getElementById('ve-gb-rev-' + nodeId);
  var govEl = document.getElementById('ve-gb-governed-' + nodeId);
  
  if(nameEl) node.data.gbName = nameEl.value;
  if(shiftEl) {
    node.data.shiftProfile = shiftEl.value;
    // Readonly alanları güncelle
    var spData = VE_FT_SHIFT_PROFILES[shiftEl.value];
    if(spData) {
      var offEl = document.getElementById('ve-gb-lockup-offset-' + nodeId);
      var srShEl = document.getElementById('ve-gb-sr-shift-' + nodeId);
      var srLkEl = document.getElementById('ve-gb-sr-lockup-' + nodeId);
      if(offEl) offEl.value = spData.lockupOffset;
      if(srShEl) srShEl.value = spData.shift1C2C_outRatio || 0.2150;
      if(srLkEl) srLkEl.value = spData.shift2C2L_outRatio || 0.3593;
      node.data.lockupOffset = spData.lockupOffset;
      node.data.shift1C2C_outRatio = spData.shift1C2C_outRatio || 0.2150;
      node.data.shift2C2L_outRatio = spData.shift2C2L_outRatio || 0.3594;
      // Lockup-mod per-gear kalibrasyon verilerini kopyala
      if(spData.lockupShifts) {
        node.data.lockupShifts = JSON.parse(JSON.stringify(spData.lockupShifts));
      } else {
        delete node.data.lockupShifts;
      }
      // Converter-mod lineer/segmentli model verilerini kopyala
      if(spData.converterShifts) {
        node.data.converterShifts = JSON.parse(JSON.stringify(spData.converterShifts));
      } else {
        delete node.data.converterShifts;
      }
      // Downshift eşiklerini kopyala
      if(spData.downshiftThresholds) {
        node.data.downshiftThresholds = JSON.parse(JSON.stringify(spData.downshiftThresholds));
      } else {
        delete node.data.downshiftThresholds;
      }
      // Eski parametreleri de koru (geriye uyumluluk)
      node.data.srShift1C2C = spData.srShift1C2C;
      node.data.srLockup2C2L = spData.srLockup2C2L;
      node.data.etaLockup2C2L = spData.etaLockup2C2L || 0.83;
    }
  }
  // Shift Referans RPM (boş = motor governed kullanılır)
  var shiftRefEl = document.getElementById('ve-gb-shift-ref-' + nodeId);
  if(shiftRefEl) {
    var val = parseFloat(shiftRefEl.value);
    node.data.shiftRefRPM = (val && val > 0) ? val : null;
  }
  if(fwdEl) node.data.forwardGears = parseInt(fwdEl.value) || 6;
  if(revEl) node.data.reverseGears = parseInt(revEl.value) || 1;
  if(govEl) node.data.gbGovernedSpeed = parseFloat(govEl.value) || 0;
}

// Tam Gaz — Şanzıman preset seçimi
function onVEFTGBPresetSelect(nodeId, value) {
  var node = nodes.find(function(n) { return n.id === nodeId; });
  if(!node) return;
  if(!node.data) node.data = {};
  
  if(!value) return;
  var preset = VE_GEARBOX_PRESETS[value];
  if(!preset) return;
  
  node.data.ftGBPreset = value;
  
  // Şanzıman adı güncelle
  var nameEl = document.getElementById('ve-gb-name-' + nodeId);
  if(nameEl) { nameEl.value = preset.name; node.data.gbName = preset.name; }
  
  // Vites sayıları güncelle
  var fwdGears = preset.gears.filter(function(g) { return g.gear !== 'R'; });
  var revGears = preset.gears.filter(function(g) { return g.gear === 'R'; });
  var fwdEl = document.getElementById('ve-gb-fwd-' + nodeId);
  var revEl = document.getElementById('ve-gb-rev-' + nodeId);
  if(fwdEl) { fwdEl.value = fwdGears.length; node.data.forwardGears = fwdGears.length; }
  if(revEl) { revEl.value = revGears.length; node.data.reverseGears = revGears.length; }
  
  // 3000SP/3200SP ise kalibre edilmiş veri kullan
  var ftGears = [];
  if(value === '3000SP' || value === '3200SP') {
    ftGears = VE_FT_GB_DEFAULT_GEARS.map(function(g) {
      return {name: g.name, ratio: g.ratio, eff: g.eff, lockup: g.lockup};
    });
  } else {
    // Diğer presetler: oran al, verim tahmin et
    // Direct drive vites bul (ratio === 1.00)
    var directIdx = -1;
    fwdGears.forEach(function(g, i) { if(Math.abs(g.ratio - 1.0) < 0.01) directIdx = i; });
    
    fwdGears.forEach(function(g, i) {
      var eff;
      if(directIdx >= 0 && i === directIdx) eff = 99.64; // Direct drive
      else if(i === 0) eff = 98.11; // 1. vites (yüksek tork yükü)
      else if(directIdx >= 0 && i < directIdx) eff = 98.5 + (i / directIdx) * 0.5; // Underdrive
      else eff = 98.62 - (i - directIdx) * 0.57; // Overdrive (artan kayıp)
      
      ftGears.push({
        name: 'F' + g.gear,
        ratio: g.ratio,
        eff: parseFloat(eff.toFixed(2)),
        lockup: (i > 0) // F1 = converter, geri kalan lockup
      });
    });
    revGears.forEach(function(g, i) {
      ftGears.push({
        name: 'R' + (i + 1),
        ratio: Math.abs(g.ratio),
        eff: 97.50,
        lockup: false
      });
    });
  }
  
  // Vites tablosunu güncelle
  node.data.ftGearData = ftGears;
  
  var tbody = document.getElementById('ve-ftgear-table-' + nodeId);
  if(tbody) {
    tbody.innerHTML = '';
    ftGears.forEach(function(row) {
      var tr = document.createElement('tr');
      tr.innerHTML = getVEFTGearRowHTML(nodeId, row.name, row.ratio, row.eff, row.lockup).replace('<tr>', '').replace('</tr>', '');
      tbody.appendChild(tr);
    });
  }
  
  saveVEFTGearData(nodeId);
  
  // Şanzıman ailesi değiştiğinde shift profilini otomatik eşleştir
  var newFamily = preset.family || '';
  var currentSP = node.data.shiftProfile || '';
  var currentSPData = VE_FT_SHIFT_PROFILES[currentSP];
  // Mevcut profil yeni aileyle uyumsuzsa → ilk uyumlu profili seç
  if(!currentSPData || (currentSPData.family && currentSPData.family !== newFamily)) {
    var matchKey = '';
    Object.keys(VE_FT_SHIFT_PROFILES).forEach(function(spk) {
      if(!matchKey && VE_FT_SHIFT_PROFILES[spk].family === newFamily) matchKey = spk;
    });
    if(matchKey) {
      node.data.shiftProfile = matchKey;
      var msp = VE_FT_SHIFT_PROFILES[matchKey];
      node.data.lockupOffset = msp.lockupOffset;
      node.data.shift1C2C_outRatio = msp.shift1C2C_outRatio;
      node.data.shift2C2L_outRatio = msp.shift2C2L_outRatio;
    }
  }
  
  // Şanzıman limitleri: netTurbineTorque → EC-Matching turbineRating otomatik güncelle
  if(preset.netTurbineTorque) {
    var ecmNode = nodes.find(function(n) { return n.type === 'ec-matching'; });
    if(ecmNode) {
      if(!ecmNode.data) ecmNode.data = {};
      ecmNode.data.turbineRating = preset.netTurbineTorque;
      var trEl = document.getElementById('ecm-turbine-rating-' + ecmNode.id);
      if(trEl) trEl.value = preset.netTurbineTorque;
    }
  }
  // Şanzıman limit verilerini gearbox node'a da kaydet
  node.data.gbGrossInputPower = preset.grossInputPower;
  node.data.gbGrossInputTorque = preset.grossInputTorque;
  node.data.gbNetTurbineTorque = preset.netTurbineTorque;
  node.data.gbMaxOutputSpeed = preset.maxOutputSpeed;

  // Şanzıman limitleri bilgi mesajı
  var limitsInfo = [];
  if(preset.grossInputPower) limitsInfo.push('Giriş Güç: ' + preset.grossInputPower + ' kW');
  if(preset.grossInputTorque) limitsInfo.push('Giriş Tork: ' + preset.grossInputTorque + ' Nm');
  if(preset.netTurbineTorque) limitsInfo.push('Türbin Tork: ' + preset.netTurbineTorque + ' Nm');
  if(preset.maxOutputSpeed) limitsInfo.push('Max Çıkış: ' + preset.maxOutputSpeed + ' rpm');
  if(limitsInfo.length > 0) {
    showToast('Şanzıman limitleri: ' + limitsInfo.join(' | '), 'info');
  }

  // Şanzıman ailesi değiştiğinde TC dropdown'ını güncelle
  veRefreshTCDropdownForFamily();

  // Shift profili dropdown'ını ve readonly parametreleri yenilemek için paneli yeniden çiz
  showNodeProperties(node);
}

function onVEGearboxEffChange(nodeId) {
  var node = nodes.find(function(n) { return n.id === nodeId; });
  if(!node) return;
  if(!node.data) node.data = {};
  var el = document.getElementById('ve-gearbox-eff-' + nodeId);
  if(el) { var n = parseFloat(el.value); node.data.efficiency = isNaN(n) ? 97 : n; }
}

// Şanzıman satır HTML'i
function getVEGearboxRowHTML(nodeId, gear, ratio, note) {
  var html = '<tr>';
  html += '<td style="padding:3px; border-bottom:1px solid var(--border-color);"><input type="text" value="' + gear + '" style="width:100%; padding:4px; font-size:0.7rem; background:var(--bg-input); color:var(--text-primary); border:1px solid var(--border-color); border-radius:3px; text-align:center;" onchange="onVEGearboxDataChange(\'' + nodeId + '\')"></td>';
  html += '<td style="padding:3px; border-bottom:1px solid var(--border-color);"><input type="number" step="0.001" value="' + ratio + '" style="width:100%; padding:4px; font-size:0.7rem; background:var(--bg-input); color:var(--text-primary); border:1px solid var(--border-color); border-radius:3px; text-align:center;" onchange="onVEGearboxDataChange(\'' + nodeId + '\')"></td>';
  html += '<td style="padding:3px; border-bottom:1px solid var(--border-color);"><input type="text" value="' + note + '" style="width:100%; padding:4px; font-size:0.7rem; background:var(--bg-input); color:var(--text-primary); border:1px solid var(--border-color); border-radius:3px; text-align:center;" onchange="onVEGearboxDataChange(\'' + nodeId + '\')"></td>';
  html += '<td style="padding:3px; border-bottom:1px solid var(--border-color); text-align:center;"><button onclick="removeVEGearboxRow(this, \'' + nodeId + '\')" style="padding:2px 6px; font-size:0.6rem; background:var(--accent-danger); color:white; border:none; border-radius:3px; cursor:pointer;" title="Satırı sil">×</button></td>';
  html += '</tr>';
  return html;
}

// Şanzıman preset verileri
var VE_GEARBOX_PRESETS = {
  '1000SP': {
    name: 'Allison | 1000SP',
    family: '1000_2000',
    calibrated: false,
    grossInputPower: null,
    grossInputTorque: null,
    netTurbineTorque: null,
    maxOutputSpeed: null,
    gears: [
      {gear: '1', ratio: 3.10, note: ''},
      {gear: '2', ratio: 1.81, note: ''},
      {gear: '3', ratio: 1.41, note: ''},
      {gear: '4', ratio: 1.00, note: ''},
      {gear: '5', ratio: 0.71, note: ''},
      {gear: '6', ratio: 0.61, note: ''},
      {gear: 'R', ratio: -4.49, note: 'Geri'}
    ]
  },
  '2100SP': {
    name: 'Allison | 2100SP',
    family: '1000_2000',
    calibrated: false,
    grossInputPower: null,
    grossInputTorque: null,
    netTurbineTorque: null,
    maxOutputSpeed: null,
    gears: [
      {gear: '1', ratio: 3.10, note: ''},
      {gear: '2', ratio: 1.81, note: ''},
      {gear: '3', ratio: 1.41, note: ''},
      {gear: '4', ratio: 1.00, note: ''},
      {gear: '5', ratio: 0.71, note: ''},
      {gear: '6', ratio: 0.61, note: ''},
      {gear: 'R', ratio: -4.49, note: 'Geri'}
    ]
  },
  '2200SP': {
    name: 'Allison | 2200SP',
    family: '1000_2000',
    calibrated: false,
    grossInputPower: null,
    grossInputTorque: null,
    netTurbineTorque: null,
    maxOutputSpeed: null,
    gears: [
      {gear: '1', ratio: 3.10, note: ''},
      {gear: '2', ratio: 1.81, note: ''},
      {gear: '3', ratio: 1.41, note: ''},
      {gear: '4', ratio: 1.00, note: ''},
      {gear: '5', ratio: 0.71, note: ''},
      {gear: '6', ratio: 0.61, note: ''},
      {gear: 'R', ratio: -4.49, note: 'Geri'}
    ]
  },
  '2350SP': {
    name: 'Allison | 2350SP',
    family: '1000_2000',
    calibrated: false,
    grossInputPower: null,
    grossInputTorque: null,
    netTurbineTorque: null,
    maxOutputSpeed: null,
    gears: [
      {gear: '1', ratio: 3.10, note: ''},
      {gear: '2', ratio: 1.81, note: ''},
      {gear: '3', ratio: 1.41, note: ''},
      {gear: '4', ratio: 1.00, note: ''},
      {gear: '5', ratio: 0.71, note: ''},
      {gear: '6', ratio: 0.61, note: ''},
      {gear: 'R', ratio: -4.49, note: 'Geri'}
    ]
  },
  '2500SP': {
    name: 'Allison | 2500SP',
    family: '1000_2000',
    calibrated: true,
    downshiftCalibrated: true,
    grossInputPower: null,
    grossInputTorque: null,
    netTurbineTorque: null,
    maxOutputSpeed: null,
    gears: [
      {gear: '1', ratio: 3.51, note: ''},
      {gear: '2', ratio: 1.90, note: ''},
      {gear: '3', ratio: 1.44, note: ''},
      {gear: '4', ratio: 1.00, note: ''},
      {gear: '5', ratio: 0.74, note: ''},
      {gear: '6', ratio: 0.64, note: ''},
      {gear: 'R', ratio: -5.09, note: 'Geri'}
    ]
  },
  '3000SP': {
    name: 'Allison | 3000SP',
    family: '3000',
    calibrated: true,
    grossInputPower: 261,
    grossInputTorque: 1424,
    netTurbineTorque: 2305,
    maxOutputSpeed: 3600,
    gears: [
      {gear: '1', ratio: 3.49, note: ''},
      {gear: '2', ratio: 1.86, note: ''},
      {gear: '3', ratio: 1.41, note: ''},
      {gear: '4', ratio: 1.00, note: ''},
      {gear: '5', ratio: 0.75, note: ''},
      {gear: '6', ratio: 0.65, note: ''},
      {gear: 'R', ratio: -5.03, note: 'Geri'}
    ]
  },
  '3200SP': {
    name: 'Allison | 3200SP',
    family: '3000',
    calibrated: true,
    grossInputPower: 336,
    grossInputTorque: 1695,
    netTurbineTorque: 2305,
    maxOutputSpeed: 3600,
    gears: [
      {gear: '1', ratio: 3.49, note: ''},
      {gear: '2', ratio: 1.86, note: ''},
      {gear: '3', ratio: 1.41, note: ''},
      {gear: '4', ratio: 1.00, note: ''},
      {gear: '5', ratio: 0.75, note: ''},
      {gear: '6', ratio: 0.65, note: ''},
      {gear: 'R', ratio: -5.03, note: 'Geri'}
    ]
  },
  '3500SP': {
    name: 'Allison | 3500SP',
    family: '3000',
    calibrated: true,
    grossInputPower: 246,
    grossInputTorque: 1335,
    netTurbineTorque: 2034,
    maxOutputSpeed: 3600,
    gears: [
      {gear: '1', ratio: 4.59, note: ''},
      {gear: '2', ratio: 2.25, note: ''},
      {gear: '3', ratio: 1.54, note: ''},
      {gear: '4', ratio: 1.00, note: ''},
      {gear: '5', ratio: 0.75, note: ''},
      {gear: '6', ratio: 0.65, note: ''},
      {gear: 'R', ratio: -5.00, note: 'Geri'}
    ]
  },
  '3700SP': {
    name: 'Allison | 3700SP',
    family: '3000',
    calibrated: false,
    grossInputPower: 246,
    grossInputTorque: 1186,
    netTurbineTorque: 1996,
    maxOutputSpeed: 3600,
    gears: [
      {gear: '1', ratio: 6.93, note: ''},
      {gear: '2', ratio: 4.18, note: ''},
      {gear: '3', ratio: 2.24, note: ''},
      {gear: '4', ratio: 1.69, note: ''},
      {gear: '5', ratio: 1.20, note: ''},
      {gear: '6', ratio: 0.90, note: ''},
      {gear: '7', ratio: 0.78, note: ''},
      {gear: 'R', ratio: -6.03, note: 'Geri'}
    ]
  },
  '4000SP': {
    name: 'Allison | 4000SP',
    family: '4000',
    calibrated: true,
    grossInputPower: 485,
    grossInputTorque: 2544,
    netTurbineTorque: 3795,
    maxOutputSpeed: 3600,
    gears: [
      {gear: '1', ratio: 3.51, note: ''},
      {gear: '2', ratio: 1.91, note: ''},
      {gear: '3', ratio: 1.43, note: ''},
      {gear: '4', ratio: 1.00, note: ''},
      {gear: '5', ratio: 0.74, note: ''},
      {gear: '6', ratio: 0.64, note: ''},
      {gear: 'R', ratio: -4.80, note: 'Geri'}
    ]
  },
  '4500SP': {
    name: 'Allison | 4500SP',
    family: '4000',
    calibrated: true,
    grossInputPower: 451,
    grossInputTorque: 2400,
    netTurbineTorque: 3525,
    maxOutputSpeed: 3525,
    gears: [
      {gear: '1', ratio: 4.70, note: ''},
      {gear: '2', ratio: 2.21, note: ''},
      {gear: '3', ratio: 1.53, note: ''},
      {gear: '4', ratio: 1.00, note: ''},
      {gear: '5', ratio: 0.76, note: ''},
      {gear: '6', ratio: 0.67, note: ''},
      {gear: 'R', ratio: -5.55, note: 'Geri'}
    ]
  },
  '4700SP': {
    name: 'Allison | 4700SP',
    family: '4000',
    calibrated: false,
    grossInputPower: 451,
    grossInputTorque: 2508,
    netTurbineTorque: 4067,
    maxOutputSpeed: null,
    gears: [
      {gear: '1', ratio: 7.63, note: ''},
      {gear: '2', ratio: 3.51, note: ''},
      {gear: '3', ratio: 1.91, note: ''},
      {gear: '4', ratio: 1.43, note: ''},
      {gear: '5', ratio: 1.00, note: ''},
      {gear: '6', ratio: 0.74, note: ''},
      {gear: '7', ratio: 0.64, note: ''},
      {gear: 'R', ratio: -4.80, note: 'Geri'}
    ]
  },
  '4800SP': {
    name: 'Allison | 4800SP',
    family: '4000',
    calibrated: false,
    grossInputPower: 597,
    grossInputTorque: 2644,
    netTurbineTorque: 4067,
    maxOutputSpeed: null,
    gears: [
      {gear: '1', ratio: 7.63, note: ''},
      {gear: '2', ratio: 3.51, note: ''},
      {gear: '3', ratio: 1.91, note: ''},
      {gear: '4', ratio: 1.43, note: ''},
      {gear: '5', ratio: 1.00, note: ''},
      {gear: '6', ratio: 0.74, note: ''},
      {gear: '7', ratio: 0.64, note: ''},
      {gear: 'R', ratio: -4.80, note: 'Geri'}
    ]
  },
  '4900SP': {
    name: 'Allison | 4900SP',
    family: '4000',
    calibrated: false,
    grossInputPower: null,
    grossInputTorque: null,
    netTurbineTorque: null,
    maxOutputSpeed: null,
    gears: [
      {gear: '1', ratio: 7.63, note: ''},
      {gear: '2', ratio: 3.51, note: ''},
      {gear: '3', ratio: 1.91, note: ''},
      {gear: '4', ratio: 1.43, note: ''},
      {gear: '5', ratio: 1.00, note: ''},
      {gear: '6', ratio: 0.74, note: ''},
      {gear: '7', ratio: 0.64, note: ''},
      {gear: 'R', ratio: -4.80, note: 'Geri'}
    ]
  }
};

// Şanzıman seçildiğinde
function onVEGearboxSelectChange(nodeId, value) {
  var node = nodes.find(function(n) { return n.id === nodeId; });
  if(!node) return;
  
  if(!node.data) node.data = {};
  node.data.selectedGearbox = value;
  
  var dataArea = document.getElementById('ve-gearbox-data-area-' + nodeId);
  var tbody = document.getElementById('ve-gearbox-table-' + nodeId);
  
  if(value === '' || value === '__new__') {
    if(dataArea) dataArea.style.display = value === '__new__' ? 'block' : 'none';
    if(value === '__new__' && tbody) {
      tbody.innerHTML = '';
      addVEGearboxRow(nodeId);
    }
    node.data.gearData = [];
    updateVEGearSelectOptions(nodeId);
    return;
  }
  
  // Preset verilerini yükle
  var preset = VE_GEARBOX_PRESETS[value];
  if(preset && tbody) {
    if(dataArea) dataArea.style.display = 'block';
    tbody.innerHTML = '';
    preset.gears.forEach(function(g) {
      var tr = document.createElement('tr');
      tr.innerHTML = getVEGearboxRowHTML(nodeId, g.gear, g.ratio, g.note).replace('<tr>', '').replace('</tr>', '');
      tbody.appendChild(tr);
    });
    node.data.gearData = JSON.parse(JSON.stringify(preset.gears));
    updateVEGearSelectOptions(nodeId);
    showToast(preset.name + ' yüklendi');
  }
}

// Vites seçim dropdown'ını güncelle
function updateVEGearSelectOptions(nodeId) {
  var node = nodes.find(function(n) { return n.id === nodeId; });
  if(!node) return;
  
  var selectEl = document.getElementById('ve-gear-select-' + nodeId);
  if(!selectEl) return;
  
  var gearData = node.data && node.data.gearData ? node.data.gearData : getVEGearboxTableData(nodeId);
  
  selectEl.innerHTML = '<option value="">-- Vites Seçin --</option>';
  gearData.forEach(function(g, idx) {
    if(g.gear && g.ratio && parseFloat(g.ratio) > 0) { // Geri vites hariç
      var opt = document.createElement('option');
      opt.value = idx;
      opt.textContent = g.gear + '. vites (oran: ' + g.ratio + ')';
      selectEl.appendChild(opt);
    }
  });
}

// Vites seçildiğinde
function onVEGearSelectChange(nodeId) {
  var node = nodes.find(function(n) { return n.id === nodeId; });
  if(!node) return;
  
  var selectEl = document.getElementById('ve-gear-select-' + nodeId);
  var ratioEl = document.getElementById('ve-gear-ratio-' + nodeId);
  if(!selectEl || !ratioEl) return;
  
  var idx = parseInt(selectEl.value);
  var gearData = node.data && node.data.gearData ? node.data.gearData : getVEGearboxTableData(nodeId);
  
  if(!isNaN(idx) && gearData[idx]) {
    ratioEl.value = gearData[idx].ratio;
    if(!node.data) node.data = {};
    node.data.selectedGear = selectEl.value;
    node.data.selectedGearRatio = gearData[idx].ratio;
  } else {
    ratioEl.value = '';
    if(node.data) {
      node.data.selectedGear = '';
      node.data.selectedGearRatio = '';
    }
  }
}

// Şanzıman tablosundan veri al
function getVEGearboxTableData(nodeId) {
  var tbody = document.getElementById('ve-gearbox-table-' + nodeId);
  if(!tbody) return [];
  
  var data = [];
  tbody.querySelectorAll('tr').forEach(function(tr) {
    var inputs = tr.querySelectorAll('input');
    if(inputs.length >= 2) {
      var gear = inputs[0].value.trim();
      var ratio = inputs[1].value.trim();
      var note = inputs[2] ? inputs[2].value.trim() : '';
      if(gear || ratio) {
        data.push({gear: gear, ratio: ratio, note: note});
      }
    }
  });
  return data;
}

// Şanzıman satır ekle
function addVEGearboxRow(nodeId) {
  var tbody = document.getElementById('ve-gearbox-table-' + nodeId);
  if(!tbody) return;
  
  var tr = document.createElement('tr');
  tr.innerHTML = getVEGearboxRowHTML(nodeId, '', '', '').replace('<tr>', '').replace('</tr>', '');
  tbody.appendChild(tr);
}

// Şanzıman satır sil
function removeVEGearboxRow(btn, nodeId) {
  var tr = btn.closest('tr');
  if(tr) {
    tr.remove();
    onVEGearboxDataChange(nodeId);
  }
}

// Şanzıman tablosu temizle
function clearVEGearboxTable(nodeId) {
  showConfirmToast('Tablodaki tüm verileri silmek istediğinize emin misiniz?', function() {
    var tbody = document.getElementById('ve-gearbox-table-' + nodeId);
    if(tbody) {
      tbody.innerHTML = '';
      addVEGearboxRow(nodeId);
    }
    var node = nodes.find(function(n) { return n.id === nodeId; });
    if(node && node.data) {
      node.data.gearData = [];
    }
    updateVEGearSelectOptions(nodeId);
    showToast('Tablo temizlendi');
  });
}

// Şanzıman değerleri kaydet
function saveVEGearboxValues(nodeId) {
  var node = nodes.find(function(n) { return n.id === nodeId; });
  if(!node) return;
  
  if(!node.data) node.data = {};
  node.data.gearData = getVEGearboxTableData(nodeId);
  updateVEGearSelectOptions(nodeId);
  showToast('Şanzıman verileri kaydedildi');
}

// Şanzıman veri değişikliği
function onVEGearboxDataChange(nodeId) {
  var node = nodes.find(function(n) { return n.id === nodeId; });
  if(!node) return;
  
  if(!node.data) node.data = {};
  node.data.gearData = getVEGearboxTableData(nodeId);
  updateVEGearSelectOptions(nodeId);
}

// ===== MOTOR-TC EŞLEŞTİRME BİLEŞENİ =====

function getECMatchingPropertiesHTML(node) {
  var nd = node.data || {};
  var html = '';
  
  // Başlık
  html += '<div style="padding:12px; border-bottom:2px solid var(--accent-warning); background:linear-gradient(135deg, rgba(245,158,11,0.08), transparent);">';
  html += '<div style="font-size:0.85rem; font-weight:700; color:var(--accent-warning); margin-bottom:4px;">⚙ Motor — Konvertör Eşleştirme Analizi</div>';
  html += '<div style="font-size:0.62rem; color:var(--text-secondary); line-height:1.4;">Motor çıkış portuna bağlanmalıdır. Allison TD-148G standardına göre motor-konvertör uyumluluğunu analiz eder. C4/C5/C7/C8/C9/C10 kontrollerini uygular.</div>';
  html += '</div>';
  
  // Motor algılama bilgisi
  html += '<div id="ecm-engine-info-' + node.id + '" style="padding:10px 12px; border-bottom:1px solid var(--border-color);">';
  html += '<div style="font-size:0.65rem; color:var(--text-muted);">Motor bileşeni aranıyor...</div>';
  html += '</div>';
  
  // Şanzıman Türbin Torku Rating
  var turbineRating = nd.turbineRating || 3320;
  html += '<div style="padding:10px 12px; border-bottom:1px solid var(--border-color);">';
  html += '<table style="width:100%; border-collapse:collapse; font-size:0.68rem;">';
  html += '<tr>';
  html += '<th style="padding:6px 8px; text-align:left; background:var(--bg-tertiary); border:1px solid var(--border-color); font-weight:500; color:var(--text-secondary); width:55%;">Şanzıman Türbin Torku Limiti [N·m]</th>';
  html += '<td style="padding:4px 6px; border:1px solid var(--border-color); background:var(--bg-secondary);"><input type="number" id="ecm-turbine-rating-' + node.id + '" value="' + turbineRating + '" step="10" min="500" style="width:100%; padding:4px; font-size:0.68rem; background:var(--bg-input); color:var(--text-primary); border:1px solid var(--border-color); border-radius:3px; text-align:right;" onchange="onECMParamChange(\'' + node.id + '\')"></td>';
  html += '</tr>';
  html += '<tr><td colspan="2" style="padding:4px 8px; font-size:0.58rem; color:var(--text-muted); background:var(--bg-secondary); line-height:1.3;">C7 kontrolü için kullanılır. Şanzıman preseti seçildiğinde otomatik güncellenir (Net Turbine Torque limiti).</td></tr>';
  html += '</table>';
  html += '</div>';
  
  // Analiz sonuç tablosu
  html += '<div id="ecm-results-' + node.id + '" style="padding:10px 12px;">';
  html += '<div style="text-align:center; padding:20px; color:var(--text-muted); font-size:0.68rem;">Analiz bekleniyor... Motor bileşeni tanımlandığında otomatik çalışır.</div>';
  html += '</div>';
  
  // Absorption chart canvas
  html += '<div style="padding:0 12px 12px 12px;">';
  html += '<div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:6px;">';
  html += '<div style="font-size:0.68rem; font-weight:600; color:var(--text-heading);">Motor Eğrisi × Konvertör Kapasiteleri</div>';
  html += '<button onclick="ecmExpandChart(\'' + node.id + '\')" title="Diyagramı büyüt" style="width:24px; height:24px; display:flex; align-items:center; justify-content:center; background:var(--bg-secondary); border:1px solid var(--border-color); border-radius:3px; cursor:pointer; font-size:0.8rem; color:var(--text-secondary); transition:all 0.12s; flex-shrink:0;" onmouseover="this.style.background=\'var(--accent-primary)\';this.style.color=\'#fff\';this.style.borderColor=\'var(--accent-primary)\'" onmouseout="this.style.background=\'var(--bg-secondary)\';this.style.color=\'var(--text-secondary)\';this.style.borderColor=\'var(--border-color)\'">⛶</button>';
  html += '</div>';
  html += '<canvas id="ecm-chart-' + node.id + '" width="440" height="300" style="width:100%; height:auto; background:var(--bg-input); border:1px solid var(--border-color); border-radius:6px;"></canvas>';
  html += '<div style="font-size:0.55rem; color:var(--text-muted); margin-top:4px; line-height:1.3;">Motor net tork eğrisi (sarı) ile tüm konvertörlerin stall ve 0.80 SR kapasite eğrileri gösterilmektedir. Kesişim noktaları stall devir ve 0.80 SR çalışma noktalarını verir.</div>';
  html += '</div>';
  
  return html;
}

function onECMParamChange(nodeId) {
  var node = nodes.find(function(n) { return n.id === nodeId; });
  if(!node) return;
  if(!node.data) node.data = {};
  var ratingEl = document.getElementById('ecm-turbine-rating-' + nodeId);
  if(ratingEl) { var n = parseFloat(ratingEl.value); node.data.turbineRating = isNaN(n) ? 3320 : n; }
  runECMatchingAnalysis(nodeId);
}

// ── ANA ANALİZ FONKSİYONU ──
function runECMatchingAnalysis(nodeId) {
  var node = nodes.find(function(n) { return n.id === nodeId; });
  if(!node) return;
  if(!node.data) node.data = {};
  
  var turbineRating = node.data.turbineRating || 3320;

  // Şanzıman limit verilerini al
  var gbNode = nodes.find(function(n) { return n.type === 'gearbox'; });
  var gbLimits = { grossInputPower: null, grossInputTorque: null, maxOutputSpeed: null };
  if(gbNode && gbNode.data) {
    var gbKey = gbNode.data.ftGBPreset || gbNode.data.selectedGearbox || '';
    if(gbKey && VE_GEARBOX_PRESETS[gbKey]) {
      var gbPreset = VE_GEARBOX_PRESETS[gbKey];
      gbLimits.grossInputPower = gbPreset.grossInputPower;
      gbLimits.grossInputTorque = gbPreset.grossInputTorque;
      gbLimits.maxOutputSpeed = gbPreset.maxOutputSpeed;
    }
  }

  // Bağlı motor bileşenini bul (önce bağlantı, yoksa global arama)
  var engineNode = findConnectedEngine(nodeId);
  if(!engineNode) {
    // Geri uyumluluk: bağlantı yoksa global arama
    engineNode = nodes.find(function(n) { return (n.type === 'engine') && n.data && n.data.torqueData && n.data.torqueData.length > 2; });
  }

  var infoEl = document.getElementById('ecm-engine-info-' + nodeId);
  var resultsEl = document.getElementById('ecm-results-' + nodeId);

  if(!engineNode || !engineNode.data || !engineNode.data.torqueData || engineNode.data.torqueData.length < 2) {
    if(infoEl) infoEl.innerHTML = '<div style="padding:8px; background:rgba(220,38,38,0.1); border:1px solid rgba(220,38,38,0.3); border-radius:6px; font-size:0.65rem; color:var(--accent-danger);">⚠ Motor bileşenine bağlı değil veya tork verisi girilmemiş. Lütfen bu bileşenin giriş portunu Motor bileşeninin çıkış portuna bağlayın.</div>';
    return;
  }
  
  // Motor verilerini al
  var torqueData = engineNode.data.torqueData || [];
  var motorSpecs = engineNode.data.motorSpecs || {};
  var governed = motorSpecs.governedSpeed || engineNode.data.governedRpm || 2100;
  var noLoadGov = motorSpecs.noLoadGoverned || governed + 200;
  var engineName = engineNode.data.motorName || engineNode.customName || 'Motor';
  var pumpDrop = 17.6; // Allison 3000 family default
  
  // Peak torque bul
  var peakT = 0, peakRPM = 0;
  torqueData.forEach(function(d) {
    if(d.torque > peakT) { peakT = d.torque; peakRPM = d.rpm; }
  });

  // Governed devirdeki tork ve güç hesabı (C9/C10 kontrolleri için)
  var torqueAtGov = 0;
  if(torqueData.length >= 2) {
    // İnterpolasyon
    if(governed <= torqueData[0].rpm) torqueAtGov = torqueData[0].torque;
    else if(governed >= torqueData[torqueData.length-1].rpm) torqueAtGov = torqueData[torqueData.length-1].torque;
    else {
      for(var ti = 0; ti < torqueData.length - 1; ti++) {
        if(torqueData[ti].rpm <= governed && governed <= torqueData[ti+1].rpm) {
          var tf = (governed - torqueData[ti].rpm) / (torqueData[ti+1].rpm - torqueData[ti].rpm);
          torqueAtGov = torqueData[ti].torque + tf * (torqueData[ti+1].torque - torqueData[ti].torque);
          break;
        }
      }
    }
  }
  var powerAtGov = torqueAtGov * governed * Math.PI / 30000; // kW = T(Nm) * RPM * π / 30000

  // C9/C10 kontrolleri
  var c9ok = true, c10ok = true;
  if(gbLimits.grossInputPower !== null) c9ok = powerAtGov <= gbLimits.grossInputPower;
  if(gbLimits.grossInputTorque !== null) c10ok = torqueAtGov <= gbLimits.grossInputTorque;

  // Motor bilgi paneli
  if(infoEl) {
    var c9c10html = '';
    if(gbLimits.grossInputPower !== null || gbLimits.grossInputTorque !== null) {
      c9c10html += '<div style="font-size:0.62rem; color:var(--text-secondary); display:flex; flex-wrap:wrap; gap:8px; margin-top:4px; padding-top:4px; border-top:1px solid var(--border-color);">';
      c9c10html += '<span>Governed Güç: <b style="color:' + (c9ok ? 'var(--text-primary)' : 'var(--accent-danger)') + ';">' + powerAtGov.toFixed(0) + ' kW</b>';
      if(gbLimits.grossInputPower !== null) c9c10html += ' <span style="font-size:0.55rem; color:' + (c9ok ? 'var(--text-muted)' : 'var(--accent-danger)') + ';">(limit: ' + gbLimits.grossInputPower + ' kW ' + (c9ok ? '✅' : '❌') + ')</span>';
      c9c10html += '</span>';
      c9c10html += '<span>Governed Tork: <b style="color:' + (c10ok ? 'var(--text-primary)' : 'var(--accent-danger)') + ';">' + torqueAtGov.toFixed(0) + ' Nm</b>';
      if(gbLimits.grossInputTorque !== null) c9c10html += ' <span style="font-size:0.55rem; color:' + (c10ok ? 'var(--text-muted)' : 'var(--accent-danger)') + ';">(limit: ' + gbLimits.grossInputTorque + ' Nm ' + (c10ok ? '✅' : '❌') + ')</span>';
      c9c10html += '</span>';
      c9c10html += '</div>';
    }
    infoEl.innerHTML = '<div style="background:var(--bg-tertiary); border:1px solid var(--border-color); border-radius:6px; padding:8px 10px;">' +
      '<div style="font-size:0.7rem; font-weight:600; color:var(--text-heading); margin-bottom:4px;">🔧 ' + engineName + '</div>' +
      '<div style="font-size:0.62rem; color:var(--text-secondary); display:flex; flex-wrap:wrap; gap:8px;">' +
      '<span>Peak Tork: <b style="color:var(--text-primary);">' + peakT.toFixed(0) + ' N·m @ ' + peakRPM + ' rpm</b></span>' +
      '<span>Governed: <b style="color:var(--text-primary);">' + governed + ' rpm</b></span>' +
      '<span>Pump Düşüm: <b style="color:var(--text-primary);">' + pumpDrop + ' N·m</b></span>' +
      '</div>' + c9c10html + '</div>';
  }
  
  // Motor tork interpolasyon fonksiyonu
  function interpT(rpm) {
    if(rpm <= torqueData[0].rpm) return torqueData[0].torque;
    if(rpm >= torqueData[torqueData.length-1].rpm) return torqueData[torqueData.length-1].torque;
    for(var i = 0; i < torqueData.length - 1; i++) {
      if(torqueData[i].rpm <= rpm && rpm <= torqueData[i+1].rpm) {
        var f = (rpm - torqueData[i].rpm) / (torqueData[i+1].rpm - torqueData[i].rpm);
        return torqueData[i].torque + f * (torqueData[i+1].torque - torqueData[i].torque);
      }
    }
    return 0;
  }
  
  // Governor droop interpolasyon (governed → noLoadGoverned arası lineer düşüş)
  function interpTWithDroop(rpm) {
    if(rpm <= governed) return interpT(rpm);
    if(rpm >= noLoadGov) return 0;
    var tAtGov = interpT(governed);
    var f = (rpm - governed) / (noLoadGov - governed);
    return tAtGov * (1 - f);
  }
  
  // TC veri interpolasyon
  function interpKp(tcData, sr) {
    sr = Math.max(0, Math.min(0.99, sr));
    if(sr <= tcData[0].sr) return tcData[0].kpump;
    if(sr >= tcData[tcData.length-1].sr) return tcData[tcData.length-1].kpump;
    for(var i = 0; i < tcData.length - 1; i++) {
      if(tcData[i].sr <= sr && sr <= tcData[i+1].sr) {
        var f = (sr - tcData[i].sr) / (tcData[i+1].sr - tcData[i].sr);
        return tcData[i].kpump + f * (tcData[i+1].kpump - tcData[i].kpump);
      }
    }
    return tcData[tcData.length-1].kpump;
  }
  function interpTau(tcData, sr) {
    sr = Math.max(0, Math.min(0.99, sr));
    if(sr <= tcData[0].sr) return tcData[0].tau;
    if(sr >= tcData[tcData.length-1].sr) return tcData[tcData.length-1].tau;
    for(var i = 0; i < tcData.length - 1; i++) {
      if(tcData[i].sr <= sr && sr <= tcData[i+1].sr) {
        var f = (sr - tcData[i].sr) / (tcData[i+1].sr - tcData[i].sr);
        return tcData[i].tau + f * (tcData[i+1].tau - tcData[i].tau);
      }
    }
    return tcData[tcData.length-1].tau;
  }
  
  // Stall speed hesabı (bisection)
  function findStallSpeed(tcData) {
    var kp0 = tcData[0].kpump;
    var lo = 600, hi = 3500;
    for(var i = 0; i < 50; i++) {
      var mid = (lo + hi) / 2;
      var tAvail = interpTWithDroop(mid) - pumpDrop;
      var tAbsorbed = (mid * mid) / (kp0 * kp0);
      if(tAvail > tAbsorbed) lo = mid; else hi = mid;
      if(hi - lo < 0.5) break;
    }
    return (lo + hi) / 2;
  }
  
  // SR at governed hesabı
  function findSRAtGoverned(tcData) {
    var tPump = interpT(governed) - pumpDrop;
    if(tPump <= 0) return 0;
    var kpNeeded = governed / Math.sqrt(tPump);
    for(var i = 0; i < tcData.length - 1; i++) {
      var kp1 = tcData[i].kpump, kp2 = tcData[i+1].kpump;
      var sr1 = tcData[i].sr, sr2 = tcData[i+1].sr;
      if((kp1 <= kpNeeded && kpNeeded <= kp2) || (kp2 <= kpNeeded && kpNeeded <= kp1)) {
        var f = (kpNeeded - kp1) / (kp2 - kp1);
        if(f >= 0 && f <= 1) return sr1 + f * (sr2 - sr1);
      }
    }
    if(kpNeeded > tcData[tcData.length-1].kpump) return 0.99;
    return 0.50;
  }
  
  // Min engine speed hesabı (converter fazında)
  function findMinEngineSpeed(tcData) {
    var minN = 9999;
    for(var nt = 0; nt <= governed * 1.05; nt += 15) {
      var lo = Math.max(nt + 1, 600), hi = noLoadGov + 100;
      for(var it = 0; it < 45; it++) {
        var mid = (lo + hi) / 2;
        if(mid <= nt) { lo = mid; continue; }
        var sr = nt / mid;
        sr = Math.max(0, Math.min(0.99, sr));
        var kp = interpKp(tcData, sr);
        var tAvail = interpTWithDroop(mid) - pumpDrop;
        var tAbsorbed = (mid * mid) / (kp * kp);
        if(tAvail > tAbsorbed) lo = mid; else hi = mid;
        if(hi - lo < 1) break;
      }
      var nEng = (lo + hi) / 2;
      if(nEng < minN && nEng > 500) minN = nEng;
    }
    return minN;
  }
  
  // Tüm konvertörleri analiz et (aileye göre filtrelenmiş)
  var results = [];
  veGetFamilyTCKeys().forEach(function(key) {
    var tc = VE_FT_TC_PRESETS[key];
    var tcData = tc.data;
    
    var stallSpeed = findStallSpeed(tcData);
    var srGov = findSRAtGoverned(tcData);
    var minSpeed = findMinEngineSpeed(tcData);
    var stallTau = tcData[0].tau;
    var tPumpStall = interpTWithDroop(stallSpeed) - pumpDrop;
    var tTurbineStall = tPumpStall * stallTau;
    
    // Coupling SR
    var couplingSR = 0.88;
    for(var ci = 0; ci < tcData.length; ci++) {
      if(tcData[ci].tau <= 1.005) { couplingSR = tcData[ci].sr; break; }
    }
    
    // C5: Min engine speed >= peak torque speed
    var c5ok = minSpeed >= peakRPM - 50; // 50 rpm tolerans
    // C7: Stall turbine torque <= rating
    var c7ok = tTurbineStall <= turbineRating;
    // C8: SR at governed >= 0.80
    var c8ok = srGov >= 0.80;

    var status, score;
    if(!c9ok || !c10ok) { status = 'unacceptable'; score = 0; }
    else if(!c7ok) { status = 'unacceptable'; score = 0; }
    else if(!c5ok) { status = 'not-recommended'; score = 1; }
    else if(!c8ok) { status = 'caution'; score = 2; }
    else { status = 'recommended'; score = 3; }

    results.push({
      key: key, name: tc.name, stallTau: stallTau,
      stallSpeed: stallSpeed, minSpeed: minSpeed,
      srGov: srGov, tTurbineStall: tTurbineStall,
      couplingSR: couplingSR,
      c5ok: c5ok, c7ok: c7ok, c8ok: c8ok, c9ok: c9ok, c10ok: c10ok,
      status: status, score: score
    });
  });
  
  // Score'a göre sırala (yüksek → düşük), eşitlerde SR'ye göre
  results.sort(function(a, b) { return b.score - a.score || b.srGov - a.srGov; });
  
  // Sonuç tablosunu oluştur
  if(resultsEl) {
    var h = '';
    h += '<div style="display:flex; align-items:center; gap:6px; margin-bottom:8px;">';
    h += '<div style="font-size:0.7rem; font-weight:600; color:var(--text-heading);">Konvertör Uyumluluk Tablosu</div>';
    h += '<div style="position:relative; display:inline-block;" onmouseenter="this.querySelector(\'.ecm-info-tip\').style.display=\'block\'" onmouseleave="this.querySelector(\'.ecm-info-tip\').style.display=\'none\'">';
    h += '<div style="width:16px; height:16px; border-radius:50%; background:var(--bg-tertiary); border:1px solid var(--border-color); display:flex; align-items:center; justify-content:center; cursor:help; font-size:0.55rem; font-weight:700; color:var(--text-secondary); transition:all 0.15s;" onmouseover="this.style.background=\'var(--accent-primary)\';this.style.color=\'#fff\';this.style.borderColor=\'var(--accent-primary)\'" onmouseout="this.style.background=\'var(--bg-tertiary)\';this.style.color=\'var(--text-secondary)\';this.style.borderColor=\'var(--border-color)\'">i</div>';
    h += '<div class="ecm-info-tip" style="display:none; position:absolute; left:20px; top:-8px; z-index:1000; width:320px; padding:10px 12px; background:var(--bg-secondary); border:1px solid var(--border-color); border-radius:6px; box-shadow:0 8px 24px rgba(0,0,0,0.4); font-size:0.6rem; color:var(--text-secondary); line-height:1.55;">';
    h += '<div style="font-weight:700; color:var(--text-heading); margin-bottom:6px; font-size:0.65rem;">Kontrol Kriterleri</div>';
    h += '<b style="color:var(--text-primary);">C4</b> — Stall Speed: Tam gaz, türbin çıkışı blokeli durumda motor devri (referans).<br>';
    h += '<b style="color:var(--text-primary);">C5</b> — Min Motor Devri ≥ Peak Tork Devri (' + peakRPM + ' rpm): Konvertör fazında motorun ulaştığı minimum devir. Altına düşerse motor lugging yapar.<br>';
    h += '<b style="color:var(--text-primary);">C7</b> — Stall Türbin Torku ≤ ' + turbineRating.toFixed(0) + ' N·m: Stall\'da türbin torku şanzıman limitini aşmamalı.<br>';
    h += '<b style="color:var(--text-primary);">C8</b> — SR @ Governed ≥ 0.80: Governed hızda kayma oranı. Düşükse loose match → performans kaybı (lockup\'ta sorun yok).<br>';
    if(gbLimits.grossInputPower !== null) h += '<b style="color:var(--text-primary);">C9</b> — Motor Gücü@Gov ≤ ' + gbLimits.grossInputPower + ' kW: Governed devirdeki motor gücü şanzıman giriş güç limitini aşmamalı.<br>';
    if(gbLimits.grossInputTorque !== null) h += '<b style="color:var(--text-primary);">C10</b> — Motor Torku@Gov ≤ ' + gbLimits.grossInputTorque + ' N·m: Governed devirdeki motor torku şanzıman giriş tork limitini aşmamalı.';
    h += '<div style="margin-top:6px; padding-top:5px; border-top:1px solid var(--border-color); font-size:0.55rem; color:var(--text-muted); font-style:italic;">Referans Doküman: TD-148G</div>';
    h += '</div></div></div>';
    
    // C9/C10 uyarı bandı (şanzıman seviyesi kontroller)
    if(!c9ok || !c10ok) {
      h += '<div style="margin-bottom:8px; padding:8px 10px; background:rgba(220,38,38,0.1); border:1px solid rgba(220,38,38,0.3); border-radius:6px;">';
      h += '<div style="font-size:0.68rem; font-weight:700; color:var(--accent-danger);">❌ Şanzıman Giriş Limiti Aşılıyor</div>';
      h += '<div style="font-size:0.6rem; color:var(--text-secondary); margin-top:2px;">';
      if(!c9ok) h += 'C9: Motor gücü (' + powerAtGov.toFixed(0) + ' kW) > Şanzıman giriş güç limiti (' + gbLimits.grossInputPower + ' kW)<br>';
      if(!c10ok) h += 'C10: Motor torku (' + torqueAtGov.toFixed(0) + ' Nm) > Şanzıman giriş tork limiti (' + gbLimits.grossInputTorque + ' Nm)';
      h += '</div></div>';
    }

    // Tablo
    h += '<div style="overflow-x:auto;">';
    h += '<table style="width:100%; border-collapse:collapse; font-size:0.62rem; min-width:420px;">';
    h += '<thead><tr style="background:var(--bg-tertiary);">';
    h += '<th style="padding:5px 4px; border:1px solid var(--border-color); text-align:left; font-weight:600; color:var(--text-heading);">Durum</th>';
    h += '<th style="padding:5px 4px; border:1px solid var(--border-color); text-align:left; font-weight:600; color:var(--text-heading);">Konvertör</th>';
    h += '<th style="padding:5px 4px; border:1px solid var(--border-color); text-align:center; font-weight:500; color:var(--text-secondary);">Stall τ</th>';
    h += '<th style="padding:5px 4px; border:1px solid var(--border-color); text-align:center; font-weight:500; color:var(--text-secondary);" title="C4: Stall Speed">Stall<br>rpm</th>';
    h += '<th style="padding:5px 4px; border:1px solid var(--border-color); text-align:center; font-weight:500; color:var(--text-secondary);" title="C5: Min Engine Speed">Min N<br>rpm</th>';
    h += '<th style="padding:5px 4px; border:1px solid var(--border-color); text-align:center; font-weight:500; color:var(--text-secondary);" title="C7: Stall Turbine Torque">T_turb<br>N·m</th>';
    h += '<th style="padding:5px 4px; border:1px solid var(--border-color); text-align:center; font-weight:500; color:var(--text-secondary);" title="C8: SR at Governed Speed">SR@<br>Gov</th>';
    h += '<th style="padding:5px 4px; border:1px solid var(--border-color); text-align:center; font-weight:500; color:var(--text-secondary);">C5</th>';
    h += '<th style="padding:5px 4px; border:1px solid var(--border-color); text-align:center; font-weight:500; color:var(--text-secondary);">C7</th>';
    h += '<th style="padding:5px 4px; border:1px solid var(--border-color); text-align:center; font-weight:500; color:var(--text-secondary);">C8</th>';
    h += '<th style="padding:5px 4px; border:1px solid var(--border-color); text-align:center; font-weight:500; color:var(--text-secondary);"></th>';
    h += '</tr></thead><tbody>';
    
    results.forEach(function(r, idx) {
      var bgColor = r.status === 'recommended' ? 'rgba(22,163,74,0.06)' :
                    r.status === 'caution' ? 'rgba(217,119,6,0.06)' :
                    r.status === 'not-recommended' ? 'rgba(217,119,6,0.08)' :
                    'rgba(220,38,38,0.06)';
      var statusIcon = r.status === 'recommended' ? '✅' :
                       r.status === 'caution' ? '⚠️' :
                       r.status === 'not-recommended' ? '⚠️' :
                       '❌';
      var statusText = r.status === 'recommended' ? 'Önerilen' :
                       r.status === 'caution' ? 'Dikkat' :
                       r.status === 'not-recommended' ? 'Önerilmez' :
                       'Uyumsuz';
      var statusColor = r.status === 'recommended' ? 'var(--accent-success)' :
                        r.status === 'caution' ? 'var(--accent-warning)' :
                        r.status === 'not-recommended' ? 'var(--accent-warning)' :
                        'var(--accent-danger)';
      var isBest = idx === 0 && r.status === 'recommended';
      var borderLeft = isBest ? '3px solid var(--accent-success)' : 'none';
      
      h += '<tr style="background:' + bgColor + '; border-left:' + borderLeft + ';">';
      h += '<td style="padding:4px; border:1px solid var(--border-color); white-space:nowrap;"><span style="font-size:0.6rem; font-weight:600; color:' + statusColor + ';">' + statusIcon + ' ' + statusText + '</span></td>';
      h += '<td style="padding:4px; border:1px solid var(--border-color); font-weight:600; color:var(--text-heading);">' + r.name + '</td>';
      h += '<td style="padding:4px; border:1px solid var(--border-color); text-align:center; color:var(--text-primary);">' + r.stallTau.toFixed(2) + '</td>';
      h += '<td style="padding:4px; border:1px solid var(--border-color); text-align:center; color:var(--text-primary);">' + r.stallSpeed.toFixed(0) + '</td>';
      h += '<td style="padding:4px; border:1px solid var(--border-color); text-align:center; color:' + (r.c5ok ? 'var(--text-primary)' : 'var(--accent-danger)') + ';">' + r.minSpeed.toFixed(0) + '</td>';
      h += '<td style="padding:4px; border:1px solid var(--border-color); text-align:center; color:' + (r.c7ok ? 'var(--text-primary)' : 'var(--accent-danger); font-weight:700') + ';">' + r.tTurbineStall.toFixed(0) + '</td>';
      h += '<td style="padding:4px; border:1px solid var(--border-color); text-align:center; color:' + (r.c8ok ? 'var(--text-primary)' : 'var(--accent-warning)') + ';">' + r.srGov.toFixed(3) + '</td>';
      h += '<td style="padding:4px; border:1px solid var(--border-color); text-align:center;">' + (r.c5ok ? '✅' : '❌') + '</td>';
      h += '<td style="padding:4px; border:1px solid var(--border-color); text-align:center;">' + (r.c7ok ? '✅' : '❌') + '</td>';
      h += '<td style="padding:4px; border:1px solid var(--border-color); text-align:center;">' + (r.c8ok ? '✅' : '⚠️') + '</td>';
      h += '<td style="padding:4px; border:1px solid var(--border-color); text-align:center;">';
      if(r.status !== 'unacceptable') {
        h += '<button onclick="ecmSelectConverter(\'' + nodeId + '\',\'' + r.key + '\')" style="padding:2px 8px; font-size:0.58rem; background:var(--accent-primary); color:white; border:none; border-radius:3px; cursor:pointer; white-space:nowrap;" title="Bu konvertörü TC bileşenine yükle">Seç</button>';
      }
      h += '</td>';
      h += '</tr>';
    });
    
    h += '</tbody></table></div>';
    
    // Önerilen konvertör özeti
    if(results.length > 0 && results[0].status === 'recommended') {
      h += '<div style="margin-top:8px; padding:8px 10px; background:rgba(22,163,74,0.08); border:1px solid rgba(22,163,74,0.25); border-radius:6px;">';
      h += '<div style="font-size:0.7rem; font-weight:700; color:var(--accent-success);">🏆 Önerilen: ' + results[0].name + '</div>';
      h += '<div style="font-size:0.6rem; color:var(--text-secondary); margin-top:2px;">Stall: ' + results[0].stallSpeed.toFixed(0) + ' rpm | SR@Gov: ' + results[0].srGov.toFixed(3) + ' | T_turb: ' + results[0].tTurbineStall.toFixed(0) + ' N·m</div>';
      h += '</div>';
    } else if(results.length > 0) {
      h += '<div style="margin-top:8px; padding:8px 10px; background:rgba(217,119,6,0.08); border:1px solid rgba(217,119,6,0.25); border-radius:6px;">';
      h += '<div style="font-size:0.7rem; font-weight:700; color:var(--accent-warning);">⚠ Tam uyumlu konvertör bulunamadı</div>';
      h += '<div style="font-size:0.6rem; color:var(--text-secondary); margin-top:2px;">En iyi seçenek: ' + results[0].name + ' (SR@Gov: ' + results[0].srGov.toFixed(3) + '). Lockup modunda çalışacağından performans kabul edilebilir olabilir.</div>';
      h += '</div>';
    }
    
    resultsEl.innerHTML = h;
  }
  
  // Absorption chart çiz
  drawECMAbsorptionChart(nodeId, torqueData, governed, noLoadGov, pumpDrop, results);
}

// ── ABSORPTION CHART ──
function drawECMAbsorptionChart(nodeId, torqueData, governed, noLoadGov, pumpDrop, results) {
  var canvas = document.getElementById('ecm-chart-' + nodeId);
  if(!canvas) return;
  var ctx = canvas.getContext('2d');
  var W = canvas.width, H = canvas.height;
  
  // Temizle
  var isDark = document.documentElement.getAttribute('data-theme') !== 'light' && 
               document.documentElement.getAttribute('data-theme') !== 'arctic' &&
               document.documentElement.getAttribute('data-theme') !== 'sand';
  ctx.fillStyle = isDark ? '#0a0c10' : '#f8f9fa';
  ctx.fillRect(0, 0, W, H);
  
  // Marjlar
  var ml = 52, mr = 16, mt = 16, mb = 36;
  var pw = W - ml - mr, ph = H - mt - mb;
  
  // Veri aralıkları
  var maxRPM = noLoadGov + 100;
  var minRPM = 400;
  var maxT = 0;
  torqueData.forEach(function(d) { if(d.torque > maxT) maxT = d.torque; });
  maxT = Math.ceil(maxT / 200) * 200 + 200;
  
  function xPos(rpm) { return ml + (rpm - minRPM) / (maxRPM - minRPM) * pw; }
  function yPos(t) { return mt + ph - (t / maxT) * ph; }
  
  // Grid
  ctx.strokeStyle = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.08)';
  ctx.lineWidth = 0.5;
  for(var gt = 0; gt <= maxT; gt += 200) {
    ctx.beginPath(); ctx.moveTo(ml, yPos(gt)); ctx.lineTo(ml + pw, yPos(gt)); ctx.stroke();
    ctx.fillStyle = isDark ? '#4a5568' : '#94a3b8'; ctx.font = '9px sans-serif'; ctx.textAlign = 'right';
    ctx.fillText(gt, ml - 4, yPos(gt) + 3);
  }
  for(var gr = minRPM; gr <= maxRPM; gr += 200) {
    ctx.beginPath(); ctx.moveTo(xPos(gr), mt); ctx.lineTo(xPos(gr), mt + ph); ctx.stroke();
    ctx.fillStyle = isDark ? '#4a5568' : '#94a3b8'; ctx.font = '9px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(gr, xPos(gr), mt + ph + 14);
  }
  
  // Eksen etiketleri
  ctx.fillStyle = isDark ? '#7a8599' : '#475569'; ctx.font = '10px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('Pump Speed — RPM', ml + pw/2, H - 4);
  ctx.save(); ctx.translate(12, mt + ph/2); ctx.rotate(-Math.PI/2);
  ctx.fillText('Pump Torque — N·m', 0, 0); ctx.restore();
  
  // Konvertör kapasite eğrileri (stall ve 0.80 SR)
  var tcColors = ['#ef4444','#f97316','#eab308','#22c55e','#06b6d4','#3b82f6','#8b5cf6'];
  var tcKeys = veGetFamilyTCKeys();
  
  tcKeys.forEach(function(key, ci) {
    var tc = VE_FT_TC_PRESETS[key];
    var tcData = tc.data;
    var color = tcColors[ci % tcColors.length];
    var kpStall = tcData[0].kpump;
    
    // Stall capacity curve: T = N² / Kp_stall²
    ctx.beginPath();
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([]);
    var first = true;
    for(var n = minRPM; n <= maxRPM; n += 10) {
      var t = (n * n) / (kpStall * kpStall);
      if(t > maxT * 1.1) break;
      var x = xPos(n), y = yPos(t);
      if(first) { ctx.moveTo(x, y); first = false; } else ctx.lineTo(x, y);
    }
    ctx.stroke();
    
    // 0.80 SR capacity curve
    var kp80 = 0;
    for(var di = 0; di < tcData.length - 1; di++) {
      if(tcData[di].sr <= 0.80 && tcData[di+1].sr >= 0.80) {
        var f = (0.80 - tcData[di].sr) / (tcData[di+1].sr - tcData[di].sr);
        kp80 = tcData[di].kpump + f * (tcData[di+1].kpump - tcData[di].kpump);
        break;
      }
    }
    if(kp80 > 0) {
      ctx.beginPath();
      ctx.strokeStyle = color;
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 3]);
      first = true;
      for(var n2 = minRPM; n2 <= maxRPM; n2 += 10) {
        var t2 = (n2 * n2) / (kp80 * kp80);
        if(t2 > maxT * 1.1) break;
        var x2 = xPos(n2), y2 = yPos(t2);
        if(first) { ctx.moveTo(x2, y2); first = false; } else ctx.lineTo(x2, y2);
      }
      ctx.stroke();
    }
    ctx.setLineDash([]);
    
    // Etiket (stall eğrisi üzerinde)
    var labelN = minRPM + (ci + 1) * (maxRPM - minRPM) / (tcKeys.length + 2);
    var labelT = (labelN * labelN) / (kpStall * kpStall);
    if(labelT < maxT * 0.9 && labelT > 50) {
      ctx.fillStyle = color; ctx.font = 'bold 8px sans-serif'; ctx.textAlign = 'left';
      ctx.fillText(tc.name, xPos(labelN) + 2, yPos(labelT) - 4);
    }
  });
  
  // Motor net tork eğrisi (pump torque = net - deduction)
  ctx.beginPath();
  ctx.strokeStyle = '#f59e0b';
  ctx.lineWidth = 2.5;
  ctx.setLineDash([]);
  var firstM = true;
  torqueData.forEach(function(d) {
    var tp = d.torque - pumpDrop;
    if(tp < 0) tp = 0;
    var x = xPos(d.rpm), y = yPos(tp);
    if(firstM) { ctx.moveTo(x, y); firstM = false; } else ctx.lineTo(x, y);
  });
  // Governor droop
  var tGov = 0;
  torqueData.forEach(function(d) { if(d.rpm <= governed) tGov = d.torque; });
  var tPumpGov = tGov - pumpDrop;
  ctx.lineTo(xPos(noLoadGov), yPos(0));
  ctx.stroke();
  
  // Motor eğrisi etiketi
  ctx.fillStyle = '#f59e0b'; ctx.font = 'bold 10px sans-serif'; ctx.textAlign = 'left';
  ctx.fillText('Motor (Net − ' + pumpDrop + ')', xPos(torqueData[0].rpm) + 4, yPos(torqueData[0].torque - pumpDrop) - 8);
  
  // Governed çizgisi
  ctx.beginPath();
  ctx.strokeStyle = isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.15)';
  ctx.lineWidth = 1;
  ctx.setLineDash([3, 3]);
  ctx.moveTo(xPos(governed), mt); ctx.lineTo(xPos(governed), mt + ph);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = isDark ? '#7a8599' : '#64748b'; ctx.font = '8px sans-serif'; ctx.textAlign = 'center';
  ctx.fillText('Gov ' + governed, xPos(governed), mt + ph + 26);
  
  // ── INTERSECTION DOTS (small chart) ──
  try {
    var _smPts = [];
    torqueData.forEach(function(dd) { _smPts.push({rpm: dd.rpm, torque: Math.max(0, dd.torque - pumpDrop)}); });
    _smPts.push({rpm: noLoadGov, torque: 0});
    
    // Build lookup
    var _smLookup = {};
    for(var sli = 0; sli < _smPts.length - 1; sli++) {
      var sp1 = _smPts[sli], sp2 = _smPts[sli+1];
      for(var slr = Math.ceil(sp1.rpm); slr <= Math.floor(sp2.rpm); slr++) {
        var slf = (sp2.rpm > sp1.rpm) ? (slr - sp1.rpm) / (sp2.rpm - sp1.rpm) : 0;
        _smLookup[slr] = sp1.torque + slf * (sp2.torque - sp1.torque);
      }
    }
    var _smFirst = Math.ceil(_smPts[0].rpm);
    var _smLast = Math.floor(_smPts[_smPts.length - 1].rpm);
    
    tcKeys.forEach(function(key, ci) {
      var tc = VE_FT_TC_PRESETS[key];
      var kpS = tc.data[0].kpump;
      var color = tcColors[ci % tcColors.length];
      if(!kpS || kpS <= 0) return;
      
      var wasAbove = false, fRPM = 0, fT = 0;
      for(var sr = _smFirst; sr <= _smLast; sr++) {
        var mV = _smLookup[sr] || 0;
        var cV = (sr * sr) / (kpS * kpS);
        if(mV > cV + 1) wasAbove = true;
        else if(wasAbove && mV > 0 && cV >= mV) { fRPM = sr; fT = cV; break; }
      }
      if(fRPM > 0 && fT > 0 && fT < maxT) {
        var sx = xPos(fRPM), sy = yPos(fT);
        ctx.beginPath(); ctx.arc(sx, sy, 4, 0, Math.PI * 2);
        ctx.fillStyle = color; ctx.fill();
        ctx.beginPath(); ctx.arc(sx, sy, 1.5, 0, Math.PI * 2);
        ctx.fillStyle = isDark ? '#0a0c10' : '#f8f9fa'; ctx.fill();
      }
    });
  } catch(err) { console.warn('ECM small chart dots error:', err); }
  
  // Legend (sağ üst)
  ctx.font = '7px sans-serif'; ctx.textAlign = 'left';
  var ly = mt + 8;
  ctx.fillStyle = isDark ? '#7a8599' : '#64748b';
  ctx.fillText('── Stall   --- 0.80 SR', ml + pw - 100, ly);
}

// ── Bağlantı üzerinden motor bileşenini bul ──
function findConnectedEngine(nodeId) {
  // Bu node'un input portuna bağlı connection'ı bul
  for(var ci = 0; ci < connections.length; ci++) {
    var conn = connections[ci];
    if(conn.to === nodeId) {
      // Bağlı kaynak node'u bul
      var srcNode = nodes.find(function(n) { return n.id === conn.from; });
      if(srcNode && (srcNode.type === 'engine')) {
        return srcNode;
      }
    }
  }
  return null;
}

// ════════════════════════════════════════════════════════════════════════════
// MOTOR-ŞANZIMAN EŞLEŞTİRME BİLEŞENİ
// ════════════════════════════════════════════════════════════════════════════

function getEngineGearboxMatchingHTML(node) {
  var html = '';

  // Başlık
  html += '<div style="padding:12px; border-bottom:2px solid var(--accent-primary); background:linear-gradient(135deg, rgba(59,130,246,0.08), transparent);">';
  html += '<div style="font-size:0.85rem; font-weight:700; color:var(--accent-primary); margin-bottom:4px;">⚙ Motor — Şanzıman Eşleştirme Analizi</div>';
  html += '<div style="font-size:0.62rem; color:var(--text-secondary); line-height:1.4;">Motor çıkış portuna bağlanmalıdır. Motor verilerine göre uyumlu şanzıman presetlerini C9/C10 kriterleri ile analiz eder.</div>';
  html += '</div>';

  // Motor bağlantı durumu
  html += '<div id="egm-engine-info-' + node.id + '" style="padding:10px 12px; border-bottom:1px solid var(--border-color);">';
  html += '<div style="font-size:0.65rem; color:var(--text-muted);">Motor bağlantısı kontrol ediliyor...</div>';
  html += '</div>';

  // Analiz sonuç tablosu
  html += '<div id="egm-results-' + node.id + '" style="padding:10px 12px;">';
  html += '<div style="text-align:center; padding:20px; color:var(--text-muted); font-size:0.68rem;">Analiz bekleniyor... Motor bileşenine bağlandığında otomatik çalışır.</div>';
  html += '</div>';

  return html;
}

function runEngineGearboxMatchingAnalysis(nodeId) {
  var node = nodes.find(function(n) { return n.id === nodeId; });
  if(!node) return;

  var infoEl = document.getElementById('egm-engine-info-' + nodeId);
  var resultsEl = document.getElementById('egm-results-' + nodeId);

  // Bağlı motoru bul
  var engineNode = findConnectedEngine(nodeId);
  if(!engineNode) {
    if(infoEl) infoEl.innerHTML = '<div style="padding:8px; background:rgba(220,38,38,0.1); border:1px solid rgba(220,38,38,0.3); border-radius:6px; font-size:0.65rem; color:var(--accent-danger);">⚠ Motor bileşenine bağlı değil. Lütfen bu bileşenin giriş portunu Motor bileşeninin çıkış portuna bağlayın.</div>';
    if(resultsEl) resultsEl.innerHTML = '';
    return;
  }

  var torqueData = engineNode.data ? (engineNode.data.torqueData || []) : [];
  if(torqueData.length < 2) {
    if(infoEl) infoEl.innerHTML = '<div style="padding:8px; background:rgba(217,119,6,0.1); border:1px solid rgba(217,119,6,0.3); border-radius:6px; font-size:0.65rem; color:var(--accent-warning);">⚠ Motor tork verisi girilmemiş. Önce motor bileşeninde tork-devir verilerini girin.</div>';
    if(resultsEl) resultsEl.innerHTML = '';
    return;
  }

  var motorSpecs = engineNode.data.motorSpecs || {};
  var governed = motorSpecs.governedSpeed || engineNode.data.governedRpm || 2100;
  var engineName = engineNode.data.motorName || engineNode.customName || 'Motor';

  // Peak torque
  var peakT = 0, peakRPM = 0;
  torqueData.forEach(function(d) { if(d.torque > peakT) { peakT = d.torque; peakRPM = d.rpm; } });

  // Governed devirdeki tork ve güç
  var torqueAtGov = 0;
  if(governed <= torqueData[0].rpm) torqueAtGov = torqueData[0].torque;
  else if(governed >= torqueData[torqueData.length-1].rpm) torqueAtGov = torqueData[torqueData.length-1].torque;
  else {
    for(var ti = 0; ti < torqueData.length - 1; ti++) {
      if(torqueData[ti].rpm <= governed && governed <= torqueData[ti+1].rpm) {
        var tf = (governed - torqueData[ti].rpm) / (torqueData[ti+1].rpm - torqueData[ti].rpm);
        torqueAtGov = torqueData[ti].torque + tf * (torqueData[ti+1].torque - torqueData[ti].torque);
        break;
      }
    }
  }
  var powerAtGov = torqueAtGov * governed * Math.PI / 30000;

  // Motor bilgi paneli
  if(infoEl) {
    infoEl.innerHTML = '<div style="background:var(--bg-tertiary); border:1px solid var(--border-color); border-radius:6px; padding:8px 10px;">' +
      '<div style="font-size:0.7rem; font-weight:600; color:var(--text-heading); margin-bottom:4px;">🔧 ' + engineName + '</div>' +
      '<div style="font-size:0.62rem; color:var(--text-secondary); display:flex; flex-wrap:wrap; gap:8px;">' +
      '<span>Peak Tork: <b style="color:var(--text-primary);">' + peakT.toFixed(0) + ' N·m @ ' + peakRPM + ' rpm</b></span>' +
      '<span>Governed: <b style="color:var(--text-primary);">' + governed + ' rpm</b></span>' +
      '</div>' +
      '<div style="font-size:0.62rem; color:var(--text-secondary); display:flex; flex-wrap:wrap; gap:8px; margin-top:4px; padding-top:4px; border-top:1px solid var(--border-color);">' +
      '<span>Güç@Gov: <b style="color:var(--text-primary);">' + powerAtGov.toFixed(0) + ' kW</b></span>' +
      '<span>Tork@Gov: <b style="color:var(--text-primary);">' + torqueAtGov.toFixed(0) + ' N·m</b></span>' +
      '</div></div>';
  }

  // Tüm şanzıman presetlerini analiz et
  var results = [];
  Object.keys(VE_GEARBOX_PRESETS).forEach(function(gbKey) {
    var preset = VE_GEARBOX_PRESETS[gbKey];

    var c9ok = true, c10ok = true;
    var c9detail = '—', c10detail = '—';
    var maxOutOk = true;

    if(preset.grossInputPower !== null) {
      c9ok = powerAtGov <= preset.grossInputPower;
      c9detail = preset.grossInputPower + ' kW';
    }
    if(preset.grossInputTorque !== null) {
      c10ok = torqueAtGov <= preset.grossInputTorque;
      c10detail = preset.grossInputTorque + ' N·m';
    }

    var status, score;
    if(preset.grossInputPower === null && preset.grossInputTorque === null) {
      status = 'no-data'; score = -1;
    } else if(!c9ok || !c10ok) {
      status = 'unacceptable'; score = 0;
    } else {
      // Marjları hesapla
      var powerMargin = preset.grossInputPower !== null ? ((preset.grossInputPower - powerAtGov) / preset.grossInputPower * 100) : 100;
      var torqueMargin = preset.grossInputTorque !== null ? ((preset.grossInputTorque - torqueAtGov) / preset.grossInputTorque * 100) : 100;
      var minMargin = Math.min(powerMargin, torqueMargin);
      if(minMargin >= 15) { status = 'recommended'; score = 3; }
      else if(minMargin >= 5) { status = 'caution'; score = 2; }
      else { status = 'tight'; score = 1; }
    }

    results.push({
      key: gbKey,
      name: preset.name,
      family: preset.family || '—',
      calibrated: preset.calibrated || false,
      downshiftCalibrated: preset.downshiftCalibrated || false,
      grossInputPower: preset.grossInputPower,
      grossInputTorque: preset.grossInputTorque,
      netTurbineTorque: preset.netTurbineTorque,
      maxOutputSpeed: preset.maxOutputSpeed,
      c9ok: c9ok, c10ok: c10ok,
      c9detail: c9detail, c10detail: c10detail,
      status: status, score: score,
      gearCount: preset.gears.filter(function(g) { return g.gear !== 'R'; }).length
    });
  });

  // Sıralama: score desc, sonra isim
  results.sort(function(a, b) { return b.score - a.score || a.name.localeCompare(b.name); });

  // Seçili şanzıman
  var gbNode = nodes.find(function(n) { return n.type === 'gearbox'; });
  var selectedGB = (gbNode && gbNode.data) ? (gbNode.data.ftGBPreset || '') : '';

  // Tablo oluştur
  if(resultsEl) {
    var h = '';
    h += '<div style="display:flex; align-items:center; gap:6px; margin-bottom:8px;">';
    h += '<div style="font-size:0.7rem; font-weight:600; color:var(--text-heading);">Şanzıman Uyumluluk Tablosu</div>';
    h += '<div style="position:relative; display:inline-block;" onmouseenter="this.querySelector(\'.egm-info-tip\').style.display=\'block\'" onmouseleave="this.querySelector(\'.egm-info-tip\').style.display=\'none\'">';
    h += '<div style="width:16px; height:16px; border-radius:50%; background:var(--bg-tertiary); border:1px solid var(--border-color); display:flex; align-items:center; justify-content:center; cursor:help; font-size:0.55rem; font-weight:700; color:var(--text-secondary);">i</div>';
    h += '<div class="egm-info-tip" style="display:none; position:absolute; left:20px; top:-8px; z-index:1000; width:300px; padding:10px 12px; background:var(--bg-secondary); border:1px solid var(--border-color); border-radius:6px; box-shadow:0 8px 24px rgba(0,0,0,0.4); font-size:0.6rem; color:var(--text-secondary); line-height:1.55;">';
    h += '<div style="font-weight:700; color:var(--text-heading); margin-bottom:6px; font-size:0.65rem;">Kontrol Kriterleri</div>';
    h += '<b style="color:var(--text-primary);">C9</b> — Motor Gücü@Gov (' + powerAtGov.toFixed(0) + ' kW) ≤ Şanzıman Giriş Güç Limiti: Governed devirdeki motor gücü şanzıman giriş güç limitini aşmamalı.<br>';
    h += '<b style="color:var(--text-primary);">C10</b> — Motor Torku@Gov (' + torqueAtGov.toFixed(0) + ' N·m) ≤ Şanzıman Giriş Tork Limiti: Governed devirdeki motor torku şanzıman giriş tork limitini aşmamalı.<br>';
    h += '<div style="margin-top:6px; padding-top:5px; border-top:1px solid var(--border-color);">';
    h += '<span style="color:var(--accent-success);">Önerilen</span>: ≥15% marj | <span style="color:var(--accent-warning);">Dikkat</span>: 5-15% marj | <span style="color:#f97316;">Sıkı</span>: &lt;5% marj | <span style="color:var(--accent-danger);">Uyumsuz</span>: Limit aşılıyor';
    h += '</div></div></div></div>';

    // Tablo
    h += '<div style="overflow-x:auto;">';
    h += '<table style="width:100%; border-collapse:collapse; font-size:0.58rem; table-layout:fixed;">';
    h += '<colgroup>';
    h += '<col style="width:28px;">';   // Durum (ikon)
    h += '<col style="width:auto;">';   // Şanzıman
    h += '<col style="width:32px;">';   // Vites
    h += '<col style="width:38px;">';   // Güç
    h += '<col style="width:40px;">';   // Tork
    h += '<col style="width:40px;">';   // Türbin
    h += '<col style="width:40px;">';   // Max Çkş
    h += '<col style="width:24px;">';   // C9
    h += '<col style="width:24px;">';   // C10
    h += '<col style="width:34px;">';   // Seç
    h += '</colgroup>';
    h += '<thead><tr style="background:var(--bg-tertiary);">';
    h += '<th style="padding:3px 2px; border:1px solid var(--border-color); text-align:center; font-weight:600; color:var(--text-heading); font-size:0.55rem;" title="Durum">⊘</th>';
    h += '<th style="padding:3px 2px; border:1px solid var(--border-color); text-align:left; font-weight:600; color:var(--text-heading);">Şanzıman</th>';
    h += '<th style="padding:3px 2px; border:1px solid var(--border-color); text-align:center; font-weight:500; color:var(--text-secondary);">V</th>';
    h += '<th style="padding:3px 2px; border:1px solid var(--border-color); text-align:center; font-weight:500; color:var(--text-secondary);" title="C9: Giriş Güç Limiti (kW)">Güç</th>';
    h += '<th style="padding:3px 2px; border:1px solid var(--border-color); text-align:center; font-weight:500; color:var(--text-secondary);" title="C10: Giriş Tork Limiti (Nm)">Tork</th>';
    h += '<th style="padding:3px 2px; border:1px solid var(--border-color); text-align:center; font-weight:500; color:var(--text-secondary);" title="Net Türbin Torku (Nm)">Türb.</th>';
    h += '<th style="padding:3px 2px; border:1px solid var(--border-color); text-align:center; font-weight:500; color:var(--text-secondary);" title="Maks. Çıkış Hızı (rpm)">Çkş</th>';
    h += '<th style="padding:3px 1px; border:1px solid var(--border-color); text-align:center; font-weight:500; color:var(--text-secondary);">C9</th>';
    h += '<th style="padding:3px 1px; border:1px solid var(--border-color); text-align:center; font-weight:500; color:var(--text-secondary);">C10</th>';
    h += '<th style="padding:3px 1px; border:1px solid var(--border-color); text-align:center; font-weight:500; color:var(--text-secondary);"></th>';
    h += '</tr></thead><tbody>';

    results.forEach(function(r) {
      var bgColor = r.status === 'recommended' ? 'rgba(22,163,74,0.06)' :
                    r.status === 'caution' ? 'rgba(217,119,6,0.06)' :
                    r.status === 'tight' ? 'rgba(249,115,22,0.06)' :
                    r.status === 'unacceptable' ? 'rgba(220,38,38,0.06)' :
                    'transparent';
      var statusIcon = r.status === 'recommended' ? '✅' :
                       r.status === 'caution' ? '⚠️' :
                       r.status === 'tight' ? '⚠️' :
                       r.status === 'unacceptable' ? '❌' : '—';
      var statusText = r.status === 'recommended' ? 'Önerilen' :
                       r.status === 'caution' ? 'Dikkat' :
                       r.status === 'tight' ? 'Sıkı' :
                       r.status === 'unacceptable' ? 'Uyumsuz' : 'Veri Yok';
      var statusColor = r.status === 'recommended' ? 'var(--accent-success)' :
                        r.status === 'caution' ? 'var(--accent-warning)' :
                        r.status === 'tight' ? '#f97316' :
                        r.status === 'unacceptable' ? 'var(--accent-danger)' : 'var(--text-muted)';
      var isSelected = r.key === selectedGB;
      var borderLeft = isSelected ? '3px solid var(--accent-primary)' : 'none';
      var calMark = (r.calibrated ? ' ✦' : '') + (r.downshiftCalibrated ? ' ✧' : '');

      // Şanzıman adını kısalt: "Allison | 4000SP" → "4000SP"
      var shortName = r.name.replace(/^Allison\s*\|\s*/i, '');
      h += '<tr style="background:' + bgColor + '; border-left:' + borderLeft + ';" title="' + statusText + ': ' + r.name + '">';
      h += '<td style="padding:2px; border:1px solid var(--border-color); text-align:center;" title="' + statusText + '"><span style="font-size:0.6rem;">' + statusIcon + '</span></td>';
      h += '<td style="padding:2px 3px; border:1px solid var(--border-color); font-weight:600; color:var(--text-heading); overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">' + shortName + calMark + (isSelected ? ' <span style="font-size:0.45rem; background:var(--accent-primary); color:white; padding:0 3px; border-radius:2px;">✔</span>' : '') + '</td>';
      h += '<td style="padding:2px; border:1px solid var(--border-color); text-align:center; color:var(--text-primary);">' + r.gearCount + '</td>';
      h += '<td style="padding:2px; border:1px solid var(--border-color); text-align:center; color:' + (r.c9ok ? 'var(--text-primary)' : 'var(--accent-danger); font-weight:700') + ';">' + (r.grossInputPower !== null ? r.grossInputPower : '—') + '</td>';
      h += '<td style="padding:2px; border:1px solid var(--border-color); text-align:center; color:' + (r.c10ok ? 'var(--text-primary)' : 'var(--accent-danger); font-weight:700') + ';">' + (r.grossInputTorque !== null ? r.grossInputTorque : '—') + '</td>';
      h += '<td style="padding:2px; border:1px solid var(--border-color); text-align:center; color:var(--text-primary);">' + (r.netTurbineTorque !== null ? r.netTurbineTorque : '—') + '</td>';
      h += '<td style="padding:2px; border:1px solid var(--border-color); text-align:center; color:var(--text-primary);">' + (r.maxOutputSpeed !== null ? r.maxOutputSpeed : '—') + '</td>';
      h += '<td style="padding:2px 1px; border:1px solid var(--border-color); text-align:center; font-size:0.55rem;">' + (r.score < 0 ? '—' : (r.c9ok ? '✅' : '❌')) + '</td>';
      h += '<td style="padding:2px 1px; border:1px solid var(--border-color); text-align:center; font-size:0.55rem;">' + (r.score < 0 ? '—' : (r.c10ok ? '✅' : '❌')) + '</td>';
      h += '<td style="padding:2px 1px; border:1px solid var(--border-color); text-align:center;">';
      h += '<button onclick="egmSelectGearbox(\'' + nodeId + '\',\'' + r.key + '\')" style="padding:1px 4px; font-size:0.52rem; background:' + (isSelected ? 'var(--bg-tertiary)' : 'var(--accent-primary)') + '; color:' + (isSelected ? 'var(--text-muted)' : 'white') + '; border:1px solid ' + (isSelected ? 'var(--border-color)' : 'transparent') + '; border-radius:2px; cursor:' + (isSelected ? 'default' : 'pointer') + ';"' + (isSelected ? ' disabled' : '') + '>' + (isSelected ? '✔' : 'Seç') + '</button>';
      h += '</td>';
      h += '</tr>';
    });

    h += '</tbody></table></div>';

    // Önerilen şanzıman özeti
    var recommended = results.filter(function(r) { return r.status === 'recommended'; });
    if(recommended.length > 0) {
      h += '<div style="margin-top:8px; padding:8px 10px; background:rgba(22,163,74,0.08); border:1px solid rgba(22,163,74,0.25); border-radius:6px;">';
      h += '<div style="font-size:0.68rem; font-weight:700; color:var(--accent-success);">🏆 Önerilen Şanzımanlar (' + recommended.length + ')</div>';
      h += '<div style="font-size:0.6rem; color:var(--text-secondary); margin-top:2px;">' + recommended.map(function(r) { return r.name; }).join(', ') + '</div>';
      h += '</div>';
    } else {
      var acceptable = results.filter(function(r) { return r.score > 0; });
      if(acceptable.length > 0) {
        h += '<div style="margin-top:8px; padding:8px 10px; background:rgba(217,119,6,0.08); border:1px solid rgba(217,119,6,0.25); border-radius:6px;">';
        h += '<div style="font-size:0.68rem; font-weight:700; color:var(--accent-warning);">⚠ Tam uyumlu şanzıman bulunamadı</div>';
        h += '<div style="font-size:0.6rem; color:var(--text-secondary); margin-top:2px;">En iyi seçenekler: ' + acceptable.map(function(r) { return r.name; }).join(', ') + '</div>';
        h += '</div>';
      }
    }

    resultsEl.innerHTML = h;
  }
}

// Şanzıman seçimi (Eşleştirme bileşeninden → Gearbox bileşenine)
function egmSelectGearbox(egmNodeId, gbPresetKey) {
  var gbNode = nodes.find(function(n) { return n.type === 'gearbox'; });
  if(!gbNode) {
    showToast('⚠ Şanzıman bileşeni bulunamadı. Önce canvas\'a ekleyin.', 'warning');
    return;
  }

  // Gearbox bileşenine preset yükle (mevcut fonksiyonu kullan)
  onVEFTGBPresetSelect(gbNode.id, gbPresetKey);

  // EC-Matching varsa turbineRating'i de güncelle
  var preset = VE_GEARBOX_PRESETS[gbPresetKey];
  if(preset && preset.netTurbineTorque) {
    var ecmNode = nodes.find(function(n) { return n.type === 'ec-matching'; });
    if(ecmNode) {
      if(!ecmNode.data) ecmNode.data = {};
      ecmNode.data.turbineRating = preset.netTurbineTorque;
      var trEl = document.getElementById('ecm-turbine-rating-' + ecmNode.id);
      if(trEl) trEl.value = preset.netTurbineTorque;
      // EC-Matching analizini yeniden çalıştır
      runECMatchingAnalysis(ecmNode.id);
    }
  }

  showToast('✅ ' + preset.name + ' → Şanzıman bileşenine yüklendi', 'success');

  // Tabloyu güncelle (seçili satırı göster)
  runEngineGearboxMatchingAnalysis(egmNodeId);
}

// ── TC bileşenine konvertör yükle ──
function ecmSelectConverter(ecmNodeId, tcPresetKey) {
  var tcNode = nodes.find(function(n) { return n.type === 'torque-converter'; });
  if(!tcNode) {
    showToast('⚠ Tork Konvertörü bileşeni bulunamadı. Önce canvas\'a ekleyin.', 'warning');
    return;
  }
  // TC bileşenine preset yükle
  onVEFTTCSelect(tcNode.id, tcPresetKey);
  
  // TC bileşeninin dropdown'ını güncelle
  var selEl = document.getElementById('ve-tc-select-' + tcNode.id);
  if(selEl) selEl.value = tcPresetKey;
  
  showToast('✅ ' + VE_FT_TC_PRESETS[tcPresetKey].name + ' → TC bileşenine yüklendi', 'success');
}

// ── FULLSCREEN INTERACTIVE CHART ──
var _ecmModalActive = null;
var _ecmModalData = null;
var _ecmZoom = { scale: 1.0, centerRPM: null, centerT: null };

function ecmExpandChart(nodeId) {
  var node = nodes.find(function(n) { return n.id === nodeId; });
  if(!node) return;
  
  // Motor verisini topla (önce bağlantı, yoksa global)
  var engineNode = findConnectedEngine(nodeId);
  if(!engineNode) engineNode = nodes.find(function(n) { return (n.type === 'engine') && n.data && n.data.torqueData && n.data.torqueData.length > 2; });
  if(!engineNode) { showToast('⚠ Motor bileşeni bulunamadı', 'warning'); return; }
  
  var torqueData = engineNode.data.torqueData || [];
  var motorSpecs = engineNode.data.motorSpecs || {};
  var governed = motorSpecs.governedSpeed || engineNode.data.governedRpm || 2100;
  var noLoadGov = motorSpecs.noLoadGoverned || governed + 200;
  var pumpDrop = 17.6;
  var engineName = engineNode.data.motorName || engineNode.customName || 'Motor';
  
  _ecmModalData = { torqueData: torqueData, governed: governed, noLoadGov: noLoadGov, pumpDrop: pumpDrop, engineName: engineName };
  _ecmModalActive = nodeId;
  _ecmZoom = { scale: 1.0, centerRPM: null, centerT: null };
  
  // Overlay
  var overlay = document.createElement('div');
  overlay.id = 'ecm-chart-modal-overlay';
  overlay.style.cssText = 'position:fixed; inset:0; z-index:100000; background:rgba(0,0,0,0.82); display:flex; align-items:center; justify-content:center; padding:20px; backdrop-filter:blur(4px);';
  
  // Modal
  var modal = document.createElement('div');
  modal.style.cssText = 'width:100%; max-width:1100px; height:85vh; max-height:820px; background:var(--bg-secondary, #0f1218); border:1px solid var(--border-color, #1c2333); border-radius:4px; display:flex; flex-direction:column; overflow:hidden; box-shadow:0 20px 60px rgba(0,0,0,0.6);';
  
  // Header
  var header = document.createElement('div');
  header.style.cssText = 'display:flex; align-items:center; justify-content:space-between; padding:8px 14px; background:var(--bg-tertiary); border-bottom:1px solid var(--border-color); flex-shrink:0;';
  header.innerHTML = '<span style="font-size:0.82rem; font-weight:700; color:var(--text-heading);">⚙ Motor Eğrisi × Konvertör Kapasiteleri — ' + engineName + '</span>' +
    '<button onclick="ecmCloseChartModal()" title="Kapat (ESC)" style="width:28px; height:28px; display:flex; align-items:center; justify-content:center; background:transparent; border:1px solid var(--border-color); border-radius:3px; cursor:pointer; font-size:0.9rem; color:var(--text-secondary); transition:all 0.12s;" onmouseover="this.style.background=\'var(--accent-danger)\';this.style.color=\'#fff\';this.style.borderColor=\'var(--accent-danger)\'" onmouseout="this.style.background=\'transparent\';this.style.color=\'var(--text-secondary)\';this.style.borderColor=\'var(--border-color)\'">✕</button>';
  modal.appendChild(header);
  
  // Chart container
  var chartBox = document.createElement('div');
  chartBox.style.cssText = 'flex:1; position:relative; min-height:0; padding:10px;';
  chartBox.innerHTML = '<canvas id="ecm-modal-canvas" style="width:100%; height:100%; display:block; border-radius:4px;"></canvas>' +
    '<div id="ecm-modal-tooltip" style="position:absolute; display:none; pointer-events:none; background:var(--bg-tertiary, #151a22); border:1px solid var(--border-light, #222b3a); border-radius:6px; padding:8px 12px; font-size:0.65rem; color:var(--text-primary, #c8d1dc); line-height:1.5; box-shadow:0 4px 16px rgba(0,0,0,0.5); z-index:10; max-width:260px; white-space:nowrap;"></div>' +
    '<div id="ecm-modal-crosshair-v" style="position:absolute; top:0; width:1px; height:100%; background:rgba(255,255,255,0.12); pointer-events:none; display:none; z-index:5;"></div>' +
    '<div id="ecm-modal-crosshair-h" style="position:absolute; left:0; width:100%; height:1px; background:rgba(255,255,255,0.12); pointer-events:none; display:none; z-index:5;"></div>';
  modal.appendChild(chartBox);
  
  // Footer — Legend
  var footer = document.createElement('div');
  footer.style.cssText = 'display:flex; align-items:center; gap:14px; padding:7px 14px; background:var(--bg-tertiary); border-top:1px solid var(--border-color); flex-shrink:0; font-size:0.65rem; color:var(--text-secondary);';
  
  var tcKeys = veGetFamilyTCKeys();
  var tcColors = ['#ef4444','#f97316','#eab308','#22c55e','#06b6d4','#3b82f6','#a855f7'];
  var legendItems = '';
  tcKeys.forEach(function(key, i) {
    var c = tcColors[i % tcColors.length];
    legendItems += '<span style="display:inline-flex; align-items:center; gap:3px;"><span style="width:14px; height:3px; background:' + c + '; border-radius:1px; flex-shrink:0;"></span><span style="font-weight:600; color:' + c + ';">' + VE_FT_TC_PRESETS[key].name + '</span></span>';
  });
  footer.innerHTML = '<span style="display:inline-flex; align-items:center; gap:4px;"><span style="width:18px; height:3px; background:#f59e0b; border-radius:1px;"></span><span style="font-weight:700; color:#f59e0b;">Motor</span></span>' +
    '<span style="opacity:0.3;">│</span>' + legendItems +
    '<span style="opacity:0.3; margin-left:4px;">│</span>' +
    '<span style="color:var(--text-muted); font-size:0.58rem;">── Stall &nbsp; <span style="border-bottom:1px dashed var(--text-muted);">┄┄</span> 0.80 SR &nbsp; ● Kesişim</span>' +
    '<span style="margin-left:auto; display:flex; align-items:center; gap:10px;">' +
    '<span id="ecm-zoom-indicator" style="display:none; color:#60a5fa; font-weight:600; font-size:0.62rem; cursor:pointer;" onclick="ecmResetZoom()" title="Tıklayarak sıfırlayın">🔍 1.0×</span>' +
    '<span style="color:var(--text-muted); font-size:0.56rem;">Scroll — Yakınlaştır &nbsp;│&nbsp; Sağ Tık + Sürükle — Kaydır</span>' +
    '<span style="color:var(--text-primary); font-weight:500;">ESC — Kapat</span></span>';
  modal.appendChild(footer);
  
  overlay.appendChild(modal);
  document.body.appendChild(overlay);
  
  // ESC handler
  overlay._escHandler = function(e) { if(e.key === 'Escape') ecmCloseChartModal(); };
  document.addEventListener('keydown', overlay._escHandler);
  overlay.addEventListener('mousedown', function(e) { if(e.button === 0 && e.target === overlay) ecmCloseChartModal(); });
  overlay.addEventListener('contextmenu', function(e) { e.preventDefault(); });
  
  // Global mouseup for pan — fires even when mouse is released outside canvas
  overlay._mouseupHandler = function(e) {
    if(e.button === 2 && _ecmPan.active) {
      _ecmPan.active = false;
      var c = document.getElementById('ecm-modal-canvas');
      if(c) c.style.cursor = 'crosshair';
    }
  };
  document.addEventListener('mouseup', overlay._mouseupHandler);
  
  // Draw after layout
  setTimeout(function() { ecmDrawModalChart(); }, 60);
}

function ecmCloseChartModal() {
  var overlay = document.getElementById('ecm-chart-modal-overlay');
  if(!overlay) return;
  if(overlay._escHandler) document.removeEventListener('keydown', overlay._escHandler);
  if(overlay._mouseupHandler) document.removeEventListener('mouseup', overlay._mouseupHandler);
  overlay.remove();
  _ecmModalActive = null;
  _ecmModalData = null;
  _ecmZoom = { scale: 1.0, centerRPM: null, centerT: null };
  _ecmPan.active = false;
}

function ecmDrawModalChart() {
  var canvas = document.getElementById('ecm-modal-canvas');
  if(!canvas || !_ecmModalData) return;
  
  var rect = canvas.parentElement.getBoundingClientRect();
  var dpr = window.devicePixelRatio || 1;
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  canvas.style.width = rect.width + 'px';
  canvas.style.height = rect.height + 'px';
  
  var ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  var W = rect.width, H = rect.height;
  
  var d = _ecmModalData;
  var isDark = document.documentElement.getAttribute('data-theme') !== 'light' && 
               document.documentElement.getAttribute('data-theme') !== 'arctic' &&
               document.documentElement.getAttribute('data-theme') !== 'sand';
  
  // Background
  ctx.fillStyle = isDark ? '#080a0e' : '#f8f9fa';
  ctx.fillRect(0, 0, W, H);
  
  // Margins
  var ml = 70, mr = 24, mt = 24, mb = 50;
  var pw = W - ml - mr, ph = H - mt - mb;
  
  // Data ranges — base
  var baseMaxRPM = d.noLoadGov + 100;
  var baseMinRPM = 400;
  var baseMaxT = 0;
  d.torqueData.forEach(function(dd) { if(dd.torque > baseMaxT) baseMaxT = dd.torque; });
  baseMaxT = Math.ceil(baseMaxT / 200) * 200 + 400;
  var baseMinT = 0;
  
  // Apply zoom
  var zs = _ecmZoom.scale || 1.0;
  var baseRPMRange = baseMaxRPM - baseMinRPM;
  var baseTRange = baseMaxT - baseMinT;
  var visRPMRange = baseRPMRange / zs;
  var visTRange = baseTRange / zs;
  
  // Center defaults
  if(_ecmZoom.centerRPM === null) _ecmZoom.centerRPM = (baseMinRPM + baseMaxRPM) / 2;
  if(_ecmZoom.centerT === null) _ecmZoom.centerT = baseMaxT / 2;
  
  var minRPM = _ecmZoom.centerRPM - visRPMRange / 2;
  var maxRPM = _ecmZoom.centerRPM + visRPMRange / 2;
  var minT = _ecmZoom.centerT - visTRange / 2;
  var maxT = _ecmZoom.centerT + visTRange / 2;
  
  // Clamp so we don't go beyond base bounds (only when zoomed in)
  if(zs >= 1.0) {
    if(minRPM < baseMinRPM) { minRPM = baseMinRPM; maxRPM = baseMinRPM + visRPMRange; }
    if(maxRPM > baseMaxRPM) { maxRPM = baseMaxRPM; minRPM = baseMaxRPM - visRPMRange; }
    if(minT < baseMinT) { minT = baseMinT; maxT = baseMinT + visTRange; }
    if(maxT > baseMaxT) { maxT = baseMaxT; minT = baseMaxT - visTRange; }
  }
  // Update center after clamping
  _ecmZoom.centerRPM = (minRPM + maxRPM) / 2;
  _ecmZoom.centerT = (minT + maxT) / 2;
  
  function xPos(rpm) { return ml + (rpm - minRPM) / (maxRPM - minRPM) * pw; }
  function yPos(t) { return mt + ph - ((t - minT) / (maxT - minT)) * ph; }
  function rpmFromX(x) { return minRPM + (x - ml) / pw * (maxRPM - minRPM); }
  function torqueFromY(y) { return minT + (mt + ph - y) / ph * (maxT - minT); }
  
  // Grid
  var gridColor = isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.06)';
  var textColor = isDark ? '#4a5568' : '#94a3b8';
  ctx.font = '11px system-ui, sans-serif';
  
  // Grid — adaptive step sizes based on visible range
  var tRange = maxT - minT;
  var tStep = tRange > 2000 ? 500 : tRange > 800 ? 200 : tRange > 400 ? 100 : 50;
  var rpmRange = maxRPM - minRPM;
  var rpmStep = rpmRange > 2000 ? 500 : rpmRange > 1000 ? 200 : 100;
  
  var tStart = Math.ceil(minT / tStep) * tStep;
  for(var gt = tStart; gt <= maxT; gt += tStep) {
    ctx.strokeStyle = gridColor; ctx.lineWidth = 0.5;
    ctx.beginPath(); ctx.moveTo(ml, yPos(gt)); ctx.lineTo(ml + pw, yPos(gt)); ctx.stroke();
    ctx.fillStyle = textColor; ctx.textAlign = 'right';
    ctx.fillText(gt, ml - 8, yPos(gt) + 4);
  }
  var rpmStart = Math.ceil(minRPM / rpmStep) * rpmStep;
  for(var gr = rpmStart; gr <= maxRPM; gr += rpmStep) {
    ctx.strokeStyle = gridColor; ctx.lineWidth = 0.5;
    ctx.beginPath(); ctx.moveTo(xPos(gr), mt); ctx.lineTo(xPos(gr), mt + ph); ctx.stroke();
    ctx.fillStyle = textColor; ctx.textAlign = 'center';
    ctx.fillText(gr, xPos(gr), mt + ph + 18);
  }
  
  // Axis labels
  ctx.fillStyle = isDark ? '#7a8599' : '#475569'; ctx.font = '12px system-ui, sans-serif'; ctx.textAlign = 'center';
  ctx.fillText('Pump Speed — RPM', ml + pw/2, H - 8);
  ctx.save(); ctx.translate(16, mt + ph/2); ctx.rotate(-Math.PI/2);
  ctx.fillText('Pump Torque — N·m', 0, 0); ctx.restore();
  
  // Converter capacity curves with hitmap data
  ctx.save();
  ctx.beginPath();
  ctx.rect(ml, mt, pw, ph);
  ctx.clip();
  var tcColors = ['#ef4444','#f97316','#eab308','#22c55e','#06b6d4','#3b82f6','#a855f7'];
  var tcKeys = veGetFamilyTCKeys();
  var _ecmCurves = [];
  
  tcKeys.forEach(function(key, ci) {
    var tc = VE_FT_TC_PRESETS[key];
    var tcData = tc.data;
    var color = tcColors[ci % tcColors.length];
    var kpStall = tcData[0].kpump;
    var stallTau = tcData[0].tau;
    
    // Stall curve
    var stallPts = [];
    ctx.beginPath();
    ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.setLineDash([]);
    var first = true;
    for(var n = minRPM; n <= maxRPM; n += 5) {
      var t = (n * n) / (kpStall * kpStall);
      if(t > maxT * 1.1) break;
      stallPts.push({rpm: n, torque: t});
      var x = xPos(n), y = yPos(t);
      if(first) { ctx.moveTo(x, y); first = false; } else ctx.lineTo(x, y);
    }
    ctx.stroke();
    
    // 0.80 SR curve
    var kp80 = 0;
    for(var di = 0; di < tcData.length - 1; di++) {
      if(tcData[di].sr <= 0.80 && tcData[di+1].sr >= 0.80) {
        var f = (0.80 - tcData[di].sr) / (tcData[di+1].sr - tcData[di].sr);
        kp80 = tcData[di].kpump + f * (tcData[di+1].kpump - tcData[di].kpump);
        break;
      }
    }
    var sr80Pts = [];
    if(kp80 > 0) {
      ctx.beginPath();
      ctx.strokeStyle = color; ctx.lineWidth = 1.2; ctx.setLineDash([6, 4]);
      first = true;
      for(var n2 = minRPM; n2 <= maxRPM; n2 += 5) {
        var t2 = (n2 * n2) / (kp80 * kp80);
        if(t2 > maxT * 1.1) break;
        sr80Pts.push({rpm: n2, torque: t2});
        var x2 = xPos(n2), y2 = yPos(t2);
        if(first) { ctx.moveTo(x2, y2); first = false; } else ctx.lineTo(x2, y2);
      }
      ctx.stroke();
    }
    ctx.setLineDash([]);
    
    // Label
    var labelIdx = Math.min(Math.floor(stallPts.length * 0.3) + ci * 15, stallPts.length - 1);
    if(labelIdx >= 0 && labelIdx < stallPts.length) {
      var lp = stallPts[labelIdx];
      if(lp.torque < maxT * 0.92) {
        ctx.fillStyle = color; ctx.font = 'bold 11px system-ui, sans-serif'; ctx.textAlign = 'left';
        ctx.fillText(tc.name, xPos(lp.rpm) + 4, yPos(lp.torque) - 6);
      }
    }
    
    _ecmCurves.push({ key: key, name: tc.name, color: color, stallTau: stallTau, kpStall: kpStall, kp80: kp80, stallPts: stallPts, sr80Pts: sr80Pts });
  });
  
  // Motor curve (pump torque = net - deduction)
  var motorPts = [];
  ctx.beginPath();
  ctx.strokeStyle = '#f59e0b'; ctx.lineWidth = 3; ctx.setLineDash([]);
  var firstM = true;
  d.torqueData.forEach(function(dd) {
    var tp = Math.max(0, dd.torque - d.pumpDrop);
    motorPts.push({rpm: dd.rpm, torque: tp});
    var x = xPos(dd.rpm), y = yPos(tp);
    if(firstM) { ctx.moveTo(x, y); firstM = false; } else ctx.lineTo(x, y);
  });
  // Governor droop
  var tGov = 0;
  d.torqueData.forEach(function(dd) { if(dd.rpm <= d.governed) tGov = dd.torque; });
  var tPumpGov = Math.max(0, tGov - d.pumpDrop);
  motorPts.push({rpm: d.noLoadGov, torque: 0});
  ctx.lineTo(xPos(d.noLoadGov), yPos(0));
  ctx.stroke();
  
  // Motor fill (subtle)
  ctx.beginPath();
  ctx.fillStyle = isDark ? 'rgba(245,158,11,0.06)' : 'rgba(245,158,11,0.08)';
  var fFirst = true;
  motorPts.forEach(function(p) { var x = xPos(p.rpm), y = yPos(p.torque); if(fFirst) { ctx.moveTo(x, y); fFirst = false; } else ctx.lineTo(x, y); });
  ctx.lineTo(xPos(motorPts[motorPts.length-1].rpm), yPos(0));
  ctx.lineTo(xPos(motorPts[0].rpm), yPos(0));
  ctx.closePath(); ctx.fill();
  
  // Motor label
  ctx.fillStyle = '#f59e0b'; ctx.font = 'bold 12px system-ui, sans-serif'; ctx.textAlign = 'left';
  ctx.fillText('Motor (Net − ' + d.pumpDrop + ' N·m)', xPos(d.torqueData[1].rpm) + 6, yPos(d.torqueData[1].torque - d.pumpDrop) - 12);
  
  // Governed line
  ctx.beginPath();
  ctx.strokeStyle = isDark ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.12)';
  ctx.lineWidth = 1; ctx.setLineDash([4, 4]);
  ctx.moveTo(xPos(d.governed), mt); ctx.lineTo(xPos(d.governed), mt + ph);
  ctx.stroke(); ctx.setLineDash([]);
  ctx.fillStyle = isDark ? '#7a8599' : '#64748b'; ctx.font = '10px system-ui, sans-serif'; ctx.textAlign = 'center';
  ctx.fillText('Governed ' + d.governed + ' rpm', xPos(d.governed), mt + ph + 34);
  
  // ── INTERSECTION DOTS: Motor eğrisi × Konvertör stall eğrileri ──
  try {
    // Build motor pump torque lookup array (dense, every 1 rpm)
    var _mLookup = {};
    for(var li = 0; li < motorPts.length - 1; li++) {
      var p1 = motorPts[li], p2 = motorPts[li+1];
      var rStart = Math.ceil(p1.rpm), rEnd = Math.floor(p2.rpm);
      for(var lr = rStart; lr <= rEnd; lr++) {
        var lf = (p2.rpm > p1.rpm) ? (lr - p1.rpm) / (p2.rpm - p1.rpm) : 0;
        _mLookup[lr] = p1.torque + lf * (p2.torque - p1.torque);
      }
    }
    
    var firstMotorRPM = Math.ceil(motorPts[0].rpm);
    var lastMotorRPM = Math.floor(motorPts[motorPts.length - 1].rpm);
    
    _ecmCurves.forEach(function(curve) {
      var kp = curve.kpStall;
      if(!kp || kp <= 0) return;
      
      // Scan: find where motor drops below converter stall curve
      var foundRPM = 0, foundT = 0;
      var wasAbove = false;
      for(var rr = firstMotorRPM; rr <= lastMotorRPM; rr++) {
        var mTorque = _mLookup[rr] || 0;
        var cTorque = (rr * rr) / (kp * kp);
        if(mTorque > cTorque + 1) {
          wasAbove = true;
        } else if(wasAbove && mTorque > 0 && cTorque >= mTorque) {
          // Crossing found — refine with 0.1 rpm steps
          for(var fr = rr - 1; fr <= rr; fr += 0.1) {
            var p1r = Math.floor(fr), p2r = p1r + 1;
            var mF = (_mLookup[p2r] !== undefined && _mLookup[p1r] !== undefined) ?
              _mLookup[p1r] + (fr - p1r) * (_mLookup[p2r] - _mLookup[p1r]) : 0;
            var cF = (fr * fr) / (kp * kp);
            if(cF >= mF && mF > 0) {
              foundRPM = fr;
              foundT = cF;
              break;
            }
          }
          break;
        }
      }
      
      if(foundRPM > 0 && foundT > 0 && foundT < maxT) {
        var px = xPos(foundRPM), py = yPos(foundT);
        
        // Glow ring
        ctx.beginPath();
        ctx.arc(px, py, 10, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255,255,255,0.08)';
        ctx.fill();
        
        // Main dot
        ctx.beginPath();
        ctx.arc(px, py, 6, 0, Math.PI * 2);
        ctx.fillStyle = curve.color;
        ctx.fill();
        
        // Inner highlight
        ctx.beginPath();
        ctx.arc(px, py, 2.5, 0, Math.PI * 2);
        ctx.fillStyle = '#ffffff';
        ctx.fill();
        
        // RPM label
        ctx.fillStyle = curve.color;
        ctx.font = 'bold 10px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(Math.round(foundRPM) + ' rpm', px, py - 13);
      }
      
      // 0.80 SR intersection
      if(curve.kp80 > 0) {
        var kp80 = curve.kp80;
        var foundRPM2 = 0, foundT2 = 0;
        var wasAbove2 = false;
        for(var rr2 = firstMotorRPM; rr2 <= lastMotorRPM; rr2++) {
          var mT2 = _mLookup[rr2] || 0;
          var cT2 = (rr2 * rr2) / (kp80 * kp80);
          if(mT2 > cT2 + 1) {
            wasAbove2 = true;
          } else if(wasAbove2 && mT2 > 0 && cT2 >= mT2) {
            foundRPM2 = rr2;
            foundT2 = cT2;
            break;
          }
        }
        
        if(foundRPM2 > 0 && foundT2 > 0 && foundT2 < maxT) {
          var px2 = xPos(foundRPM2), py2 = yPos(foundT2);
          
          // Hollow ring
          ctx.beginPath();
          ctx.arc(px2, py2, 4.5, 0, Math.PI * 2);
          ctx.strokeStyle = curve.color;
          ctx.lineWidth = 2;
          ctx.stroke();
          
          // Center
          ctx.beginPath();
          ctx.arc(px2, py2, 1.5, 0, Math.PI * 2);
          ctx.fillStyle = curve.color;
          ctx.fill();
        }
      }
    });
  } catch(err) {
    console.warn('ECM intersection dots error:', err);
  }
  
  // Restore clip
  ctx.restore();
  
  // Zoom indicator on chart
  if(_ecmZoom.scale > 1.05 || _ecmZoom.scale < 0.95) {
    ctx.fillStyle = isDark ? 'rgba(96,165,250,0.25)' : 'rgba(59,130,246,0.15)';
    ctx.font = '11px system-ui, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText('🔍 ' + _ecmZoom.scale.toFixed(1) + '× — scroll ile yakınlaştırın, tıklayarak sıfırlayın', ml + pw - 4, mt + 14);
  }
  
  // Store data for interaction
  canvas._ecmInteractive = {
    ml: ml, mr: mr, mt: mt, mb: mb, pw: pw, ph: ph,
    minRPM: minRPM, maxRPM: maxRPM, minT: minT, maxT: maxT,
    xPos: xPos, yPos: yPos, rpmFromX: rpmFromX, torqueFromY: torqueFromY,
    curves: _ecmCurves, motorPts: motorPts, governed: d.governed, pumpDrop: d.pumpDrop, dpr: dpr
  };
  
  // Attach mouse events
  canvas.onmousemove = ecmModalMouseMove;
  canvas.onmouseleave = ecmModalMouseLeave;
  canvas.onwheel = ecmModalWheel;
  canvas.onmousedown = ecmModalMouseDown;
  canvas.onmouseup = ecmModalMouseUp;
  canvas.oncontextmenu = function(e) { e.preventDefault(); };
  canvas.style.cursor = 'crosshair';
}

// ── ECM Pan state ──
var _ecmPan = { active: false, startX: 0, startY: 0, startCenterRPM: 0, startCenterT: 0, _raf: null };

function ecmModalMouseDown(e) {
  // Sağ tık (button=2) → pan başlat
  if(e.button !== 2) return;
  e.preventDefault();
  var canvas = e.target;
  var data = canvas._ecmInteractive;
  if(!data) return;
  
  _ecmPan.active = true;
  _ecmPan.startX = e.clientX;
  _ecmPan.startY = e.clientY;
  _ecmPan.startCenterRPM = _ecmZoom.centerRPM;
  _ecmPan.startCenterT = _ecmZoom.centerT;
  canvas.style.cursor = 'grabbing';
  
  // Hide tooltip during pan
  var tooltip = document.getElementById('ecm-modal-tooltip');
  if(tooltip) tooltip.style.display = 'none';
}

function ecmModalMouseUp(e) {
  if(e.button !== 2) return;
  if(!_ecmPan.active) return;
  _ecmPan.active = false;
  var canvas = e.target;
  canvas.style.cursor = 'crosshair';
}

function ecmModalWheel(e) {
  e.preventDefault();
  var canvas = e.target;
  var data = canvas._ecmInteractive;
  if(!data) return;
  
  var rect = canvas.getBoundingClientRect();
  var mx = e.clientX - rect.left;
  var my = e.clientY - rect.top;
  
  // Ignore if outside plot area
  if(mx < data.ml || mx > data.ml + data.pw || my < data.mt || my > data.mt + data.ph) return;
  
  // Center-based zoom (no mouse-position anchoring)
  var oldScale = _ecmZoom.scale;
  var delta = e.deltaY > 0 ? 0.85 : 1.18;
  var newScale = Math.max(0.3, Math.min(12.0, oldScale * delta));
  
  if(newScale === oldScale) return;
  
  _ecmZoom.scale = newScale;
  
  ecmDrawModalChart();
  ecmUpdateZoomIndicator(newScale);
}

function ecmUpdateZoomIndicator(scale) {
  var zoomEl = document.getElementById('ecm-zoom-indicator');
  if(!zoomEl) return;
  if(scale > 1.05 || scale < 0.95) {
    zoomEl.textContent = '🔍 ' + scale.toFixed(1) + '×';
    zoomEl.style.display = 'inline';
  } else {
    zoomEl.style.display = 'none';
  }
}

function ecmResetZoom() {
  _ecmZoom = { scale: 1.0, centerRPM: null, centerT: null };
  _ecmPan.active = false;
  ecmUpdateZoomIndicator(1.0);
  ecmDrawModalChart();
}

function ecmModalMouseMove(e) {
  var canvas = e.target;
  var data = canvas._ecmInteractive;
  if(!data) return;
  
  // ── Pan mode (sağ tık sürükleme) ──
  if(_ecmPan.active) {
    var d = _ecmModalData;
    if(!d) return;
    
    // Hide tooltip and crosshairs during pan
    var _tt = document.getElementById('ecm-modal-tooltip');
    var _cv = document.getElementById('ecm-modal-crosshair-v');
    var _ch = document.getElementById('ecm-modal-crosshair-h');
    if(_tt) _tt.style.display = 'none';
    if(_cv) _cv.style.display = 'none';
    if(_ch) _ch.style.display = 'none';
    
    // Pixel delta → data delta
    var dxPx = e.clientX - _ecmPan.startX;
    var dyPx = e.clientY - _ecmPan.startY;
    
    var visRPMRange = data.maxRPM - data.minRPM;
    var visTRange = data.maxT - data.minT;
    
    var dRPM = -dxPx / data.pw * visRPMRange;
    var dT = dyPx / data.ph * visTRange;
    
    _ecmZoom.centerRPM = _ecmPan.startCenterRPM + dRPM;
    _ecmZoom.centerT = _ecmPan.startCenterT + dT;
    
    if(!_ecmPan._raf) {
      _ecmPan._raf = requestAnimationFrame(function() {
        ecmDrawModalChart();
        _ecmPan._raf = null;
      });
    }
    return;
  }
  
  // ── Normal tooltip mode ──
  var rect = canvas.getBoundingClientRect();
  var mx = e.clientX - rect.left;
  var my = e.clientY - rect.top;
  
  var tooltip = document.getElementById('ecm-modal-tooltip');
  var crossV = document.getElementById('ecm-modal-crosshair-v');
  var crossH = document.getElementById('ecm-modal-crosshair-h');
  
  // Check bounds
  if(mx < data.ml || mx > data.ml + data.pw || my < data.mt || my > data.mt + data.ph) {
    if(tooltip) tooltip.style.display = 'none';
    if(crossV) crossV.style.display = 'none';
    if(crossH) crossH.style.display = 'none';
    return;
  }
  
  // Crosshairs
  if(crossV) { crossV.style.display = 'block'; crossV.style.left = mx + 'px'; }
  if(crossH) { crossH.style.display = 'block'; crossH.style.top = my + 'px'; }
  
  var rpm = data.rpmFromX(mx);
  var cursorT = data.torqueFromY(my);
  
  // Motor pump torque at this RPM
  var motorT = 0;
  var mpts = data.motorPts;
  for(var i = 0; i < mpts.length - 1; i++) {
    if(mpts[i].rpm <= rpm && rpm <= mpts[i+1].rpm) {
      var f = (rpm - mpts[i].rpm) / (mpts[i+1].rpm - mpts[i].rpm);
      motorT = mpts[i].torque + f * (mpts[i+1].torque - mpts[i].torque);
      break;
    }
  }
  
  // Calculate converter values at this RPM & find closest to cursor
  var items = [];
  data.curves.forEach(function(c) {
    var tStall = (rpm * rpm) / (c.kpStall * c.kpStall);
    var t80 = c.kp80 > 0 ? (rpm * rpm) / (c.kp80 * c.kp80) : null;
    var distStall = Math.abs(cursorT - tStall);
    var dist80 = t80 !== null ? Math.abs(cursorT - t80) : 9999;
    items.push({ name: c.name, color: c.color, tStall: tStall, t80: t80, stallTau: c.stallTau, minDist: Math.min(distStall, dist80) });
  });
  // Motor curve distance
  var motorDist = motorT > 0 ? Math.abs(cursorT - motorT) : 9999;
  
  // Sort by proximity to cursor
  items.sort(function(a, b) { return a.minDist - b.minDist; });
  
  // Nearest curve (converter or motor)
  var nearest = items[0];
  var nearestIsMotor = motorDist < nearest.minDist;
  
  // Build tooltip — compact
  var html = '<div style="display:flex; align-items:baseline; gap:8px; margin-bottom:5px; padding-bottom:4px; border-bottom:1px solid var(--border-color);">';
  html += '<span style="font-weight:700; color:var(--text-heading); font-size:0.72rem;">' + rpm.toFixed(0) + ' rpm</span>';
  html += '</div>';
  
  // Motor line
  if(motorT > 0) {
    var motorHL = nearestIsMotor ? 'background:rgba(245,158,11,0.12); margin:0 -8px; padding:2px 8px; border-radius:3px;' : '';
    html += '<div style="display:flex; align-items:center; gap:6px; padding:2px 0; ' + motorHL + '">';
    html += '<span style="width:16px; height:3px; background:#f59e0b; border-radius:1px; flex-shrink:0;"></span>';
    html += '<span style="color:#f59e0b; font-weight:600; min-width:65px;">Motor</span>';
    html += '<span style="color:var(--text-primary); font-weight:600;">' + motorT.toFixed(0) + ' N·m</span>';
    html += '</div>';
  }
  
  // Show top 3 nearest converters (not all 7)
  var shown = 0;
  items.forEach(function(c) {
    if(c.tStall > data.maxT * 1.2) return;
    if(shown >= 3) return;
    shown++;
    var isNearest = c === nearest && !nearestIsMotor;
    var hl = isNearest ? 'background:rgba(255,255,255,0.04); margin:0 -8px; padding:2px 8px; border-radius:3px;' : '';
    html += '<div style="display:flex; align-items:center; gap:6px; padding:2px 0; ' + hl + '">';
    html += '<span style="width:16px; height:3px; background:' + c.color + '; border-radius:1px; flex-shrink:0;"></span>';
    html += '<span style="color:' + c.color + '; font-weight:600; min-width:65px;">' + c.name + '</span>';
    html += '<span style="color:var(--text-primary);">' + c.tStall.toFixed(0) + '</span>';
    if(c.t80 !== null && c.t80 < data.maxT * 1.1) {
      html += '<span style="color:var(--text-muted); font-size:0.55rem;">(0.80: ' + c.t80.toFixed(0) + ')</span>';
    }
    html += '</div>';
  });
  
  // If motor intersects a converter stall curve at this RPM
  if(motorT > 0) {
    var intersections = items.filter(function(c) { return Math.abs(c.tStall - motorT) < motorT * 0.04; });
    if(intersections.length > 0) {
      html += '<div style="margin-top:4px; padding-top:3px; border-top:1px solid var(--border-color); color:var(--accent-success); font-weight:600; font-size:0.6rem;">';
      html += '⭐ Stall kesişim: ' + intersections.map(function(c) { return c.name; }).join(', ');
      html += '</div>';
    }
  }
  
  if(tooltip) {
    tooltip.innerHTML = html;
    tooltip.style.display = 'block';
    var tw = 260, th = tooltip.offsetHeight || 120;
    var tx = mx + 18, ty = my - 10;
    if(tx + tw > rect.width - 10) tx = mx - tw - 12;
    if(ty + th > rect.height - 10) ty = rect.height - th - 10;
    if(ty < 4) ty = 4;
    tooltip.style.left = tx + 'px';
    tooltip.style.top = ty + 'px';
  }
}

function ecmModalMouseLeave(e) {
  // Pan duruyorsa bitir
  if(_ecmPan.active) {
    _ecmPan.active = false;
    var canvas = document.getElementById('ecm-modal-canvas');
    if(canvas) canvas.style.cursor = 'crosshair';
  }
  var tooltip = document.getElementById('ecm-modal-tooltip');
  var crossV = document.getElementById('ecm-modal-crosshair-v');
  var crossH = document.getElementById('ecm-modal-crosshair-h');
  if(tooltip) tooltip.style.display = 'none';
  if(crossV) crossV.style.display = 'none';
  if(crossH) crossH.style.display = 'none';
}

// ===== TORK KONVERTÖRÜ ÖZELLİKLERİ =====
function getTorqueConverterPropertiesHTML(node) {
  var nodeData = node.data || {};
  var isFullThrottle = veActiveModule === 'full-throttle';
  
  var html = '<div style="border-top:1px solid var(--border-color); padding-top:12px;">';
  
  // Başlık
  html += '<div style="font-size:0.8rem; font-weight:600; color:var(--text-heading); margin-bottom:8px; display:flex; align-items:center; gap:6px;">';
  html += '<span>Tork Konvertörü</span>';
  html += '<button onclick="showInfoPopup(\'torkKonvertoru\')" style="width:18px; height:18px; border-radius:50%; background:var(--accent-primary); color:white; border:none; cursor:pointer; font-size:0.65rem; display:flex; align-items:center; justify-content:center;" title="Bilgi">?</button>';
  html += '</div>';
  
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
    
    var hasECM = nodes.some(function(n) { return n.type === 'ec-matching'; });
    html += '<div style="margin-bottom:10px;">';
    if(hasECM) {
      html += '<div style="padding:5px 8px; margin-bottom:6px; background:rgba(245,158,11,0.08); border:1px solid rgba(245,158,11,0.2); border-radius:4px; font-size:0.58rem; color:var(--accent-warning); line-height:1.4;">🔒 Konvertör seçimi Motor-Konvertör Eşleştirme bileşeni üzerinden yapılmaktadır.</div>';
    }
    html += '<select id="ve-tc-select-' + node.id + '"' + (hasECM ? ' disabled' : '') + ' onchange="onVEFTTCSelect(\'' + node.id + '\', this.value)" style="width:100%; font-size:0.7rem; padding:6px 8px; background:var(--bg-input); color:var(--text-primary); border:1px solid var(--border-color); border-radius:5px;' + (hasECM ? ' opacity:0.6; cursor:not-allowed;' : '') + '">';
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
    
    html += '<div style="background:var(--bg-tertiary); border-radius:8px; padding:10px;">';
    html += '<div style="font-size:0.75rem; font-weight:600; color:var(--text-heading); margin-bottom:8px;">Konvertör Parametreleri</div>';
    html += '<table style="width:100%; font-size:0.68rem; border-collapse:collapse; border:1px solid var(--border-color);">';
    
    html += '<tr style="border-bottom:1px solid var(--border-color);">';
    html += '<th style="padding:6px 8px; text-align:left; background:var(--bg-tertiary); border-right:1px solid var(--border-color); font-weight:500; color:var(--text-secondary);">Pump Tork Düşümü <span style="color:var(--text-muted); font-weight:400;">[N·m]</span></th>';
    html += '<td style="padding:4px 6px; background:var(--bg-tertiary);"><input type="number" id="ve-tc-pump-drop-' + node.id + '" value="' + pumpTorqueDrop + '" step="0.1" min="0" style="width:100%; padding:4px; font-size:0.68rem; background:var(--bg-input); color:var(--text-primary); border:1px solid var(--border-color); border-radius:3px; text-align:right;" onchange="onVEFTTCParamChange(\'' + node.id + '\')"></td>';
    html += '</tr>';
    
    html += '</table>';
    html += '</div>';
    
    // ── TC VERİ TABLOSU: SR, K_pump, τ ──
    var tcRows = nodeData.tcData || [];
    var tcTableHeight = nodeData.tcTableHeight || 180;
    
    html += '<div id="ve-tc-data-area-' + node.id + '" style="margin-top:10px;">';
    html += '<p style="font-size:0.62rem; color:var(--text-muted); margin-bottom:8px; line-height:1.4;">Tork konvertörünün absorption characteristics değerlerini girin. <b>SR</b> (Speed Ratio) = Türbin Devri / Pump Devri. <b>K<sub>pump</sub></b> = Pump K-Factor [rpm/√(N·m)]. <b>τ</b> = Tork Oranı (Türbin Torku / Pump Torku).</p>';
    html += '<div id="ve-tc-table-wrapper-' + node.id + '" style="max-height:' + tcTableHeight + 'px; overflow-y:auto; margin-bottom:0; border:1px solid var(--border-color); border-radius:6px 6px 0 0; border-bottom:none;">';
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
    html += '<div style="height:8px; background:var(--bg-tertiary); border:1px solid var(--border-color); border-top:none; border-radius:0 0 6px 6px; cursor:ns-resize; display:flex; align-items:center; justify-content:center;" onmousedown="startVETCTableResize(event, \'' + node.id + '\')">';
    html += '<div style="width:30px; height:3px; background:var(--border-color); border-radius:2px;"></div>';
    html += '</div>';
    
    // Butonlar
    html += '<div style="display:flex; gap:4px; margin-top:8px;">';
    html += '<button onclick="addVETCRow(\'' + node.id + '\')" style="flex:1; padding:5px; font-size:0.68rem; background:var(--bg-tertiary); color:var(--text-primary); border:1px solid var(--border-color); border-radius:4px; cursor:pointer;">+ Satır Ekle</button>';
    html += '<button onclick="clearVETCTable(\'' + node.id + '\')" style="flex:1; padding:5px; font-size:0.68rem; background:var(--bg-tertiary); color:var(--text-primary); border:1px solid var(--border-color); border-radius:4px; cursor:pointer;">Tümünü Sil</button>';
    html += '<button onclick="deleteVETCData(\'' + node.id + '\')" style="flex:1; padding:5px; font-size:0.68rem; background:var(--accent-danger); color:white; border:none; border-radius:4px; cursor:pointer;">Veriyi Temizle</button>';
    html += '<button onclick="saveVETCData(\'' + node.id + '\')" style="flex:1; padding:5px; font-size:0.68rem; background:#1e5a3f; color:white; border:none; border-radius:4px; cursor:pointer;">Kaydet</button>';
    html += '</div>';
    
    // Güncelle butonu
    html += '<div style="display:flex; justify-content:flex-end; margin-top:10px; margin-bottom:2px;">';
    html += '<button onclick="updateVETCCharts(\'' + node.id + '\')" style="padding:4px 12px; font-size:0.68rem; background:var(--accent-primary); color:white; border:none; border-radius:4px; cursor:pointer;">Güncelle</button>';
    html += '</div>';
    
    // ── GRAFİK 1: Tork Oranı & Verim Eğrisi ──
    html += '<div style="background:var(--bg-tertiary); border-radius:8px; padding:10px; margin-top:12px;">';
    html += '<div style="font-size:0.7rem; font-weight:600; color:var(--text-heading); margin-bottom:6px;">Tork Oranı & Verim Eğrisi</div>';
    html += '<div style="position:relative; background:var(--bg-input); border-radius:6px; border:1px solid var(--border-color); padding:4px;">';
    html += '<canvas id="ve-tc-chart-tau-' + node.id + '" style="width:100%; height:200px;"></canvas>';
    html += '</div>';
    html += '<div style="display:flex; gap:12px; justify-content:center; margin-top:4px; font-size:0.6rem; color:var(--text-muted);">';
    html += '<span style="color:#4aa3ff;">● τ Tork Oranı</span>';
    html += '<span style="color:#ff6b6b;">● η Verim [%]</span>';
    html += '<span style="color:var(--text-muted); opacity:0.5;">┆ Coupling (SR=0.88)</span>';
    html += '</div>';
    html += '</div>';
    
    // ── GRAFİK 2: K_pump Eğrisi ──
    html += '<div style="background:var(--bg-tertiary); border-radius:8px; padding:10px; margin-top:10px;">';
    html += '<div style="font-size:0.7rem; font-weight:600; color:var(--text-heading); margin-bottom:6px;">K<sub>pump</sub> Eğrisi</div>';
    html += '<div style="position:relative; background:var(--bg-input); border-radius:6px; border:1px solid var(--border-color); padding:4px;">';
    html += '<canvas id="ve-tc-chart-kpump-' + node.id + '" style="width:100%; height:180px;"></canvas>';
    html += '</div>';
    html += '<div style="display:flex; gap:12px; justify-content:center; margin-top:4px; font-size:0.6rem; color:var(--text-muted);">';
    html += '<span style="color:#a78bfa;">● K<sub>pump</sub> [rpm/√Nm]</span>';
    html += '</div>';
    html += '</div>';
    
    html += '</div>'; // tc-data-area close
    
  } else {
    // ── MOTOR FRENİ: Mevcut parametreler ──
    var tcRatio = nodeData.tcRatio !== undefined ? nodeData.tcRatio : 1.0;
    var isLocked = nodeData.isLocked !== undefined ? nodeData.isLocked : true;
    
    html += '<table style="width:100%; font-size:0.7rem; border-collapse:collapse; border:1px solid var(--border-color);">';
    
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
    html += '<td style="padding:8px; background:var(--bg-tertiary);"><input type="number" id="ve-tc-ratio-' + node.id + '" value="' + tcRatio + '" min="0.5" max="3" step="0.01" ' + (isLocked ? 'disabled' : '') + ' style="width:100%; padding:5px; font-size:0.7rem; background:var(--bg-input); color:var(--text-primary); border:1px solid var(--border-color); border-radius:4px; text-align:right;' + (isLocked ? ' opacity:0.5; cursor:not-allowed;' : '') + '" onchange="onVETCParamChange(\'' + node.id + '\')"></td>';
    html += '</tr>';
    
    html += '<tr>';
    html += '<td colspan="2" style="padding:6px 8px; font-size:0.65rem; color:var(--text-secondary); background:var(--bg-secondary); line-height:1.4;"><b>Kilitli tork konvertörü için 1.0 giriniz.</b> Eğer tork konvertörü kilidi yoksa veya aktif değilse, dönüştürme oranını giriniz. Tipik değerler: 1.8–2.5 (düşük hızda), yaklaşık 1.0 (yüksek hızda).</td>';
    html += '</tr>';
    
    html += '</table>';
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
  html += '<td style="padding:3px; border-bottom:1px solid var(--border-color);"><input type="number" value="' + (sr !== undefined && sr !== '' ? sr : '') + '" step="0.01" min="0" max="1" style="width:100%; padding:4px; font-size:0.7rem; background:var(--bg-input); color:var(--text-primary); border:1px solid var(--border-color); border-radius:3px; text-align:center;" onchange="onVETCDataChange(\'' + nodeId + '\')" oninput="onVETCDataChange(\'' + nodeId + '\')"></td>';
  html += '<td style="padding:3px; border-bottom:1px solid var(--border-color);"><input type="number" value="' + (kpump !== undefined && kpump !== '' ? kpump : '') + '" step="0.01" min="0" style="width:100%; padding:4px; font-size:0.7rem; background:var(--bg-input); color:var(--text-primary); border:1px solid var(--border-color); border-radius:3px; text-align:center;" onchange="onVETCDataChange(\'' + nodeId + '\')"></td>';
  html += '<td style="padding:3px; border-bottom:1px solid var(--border-color);"><input type="number" value="' + (tau !== undefined && tau !== '' ? tau : '') + '" step="0.001" min="0" style="width:100%; padding:4px; font-size:0.7rem; background:var(--bg-input); color:var(--text-primary); border:1px solid var(--border-color); border-radius:3px; text-align:center;" onchange="onVETCDataChange(\'' + nodeId + '\')" oninput="onVETCDataChange(\'' + nodeId + '\')"></td>';
  var etaVal = (sr !== '' && sr !== undefined && tau !== '' && tau !== undefined) ? (parseFloat(sr) * parseFloat(tau) * 100) : '';
  var etaStr = (!isNaN(etaVal) && etaVal !== '') ? etaVal.toFixed(1) : '';
  html += '<td style="padding:3px; border-bottom:1px solid var(--border-color);"><input type="text" value="' + etaStr + '" readonly style="width:100%; padding:4px; font-size:0.7rem; background:transparent; color:var(--accent-primary); border:1px solid var(--border-color); border-radius:3px; text-align:center; cursor:default; font-weight:500;" tabindex="-1"></td>';
  html += '<td style="padding:3px; border-bottom:1px solid var(--border-color); text-align:center;"><button onclick="removeVETCRow(this, \'' + nodeId + '\')" style="padding:2px 6px; font-size:0.6rem; background:var(--accent-danger); color:white; border:none; border-radius:3px; cursor:pointer;" title="Satırı sil">×</button></td>';
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

// ===== TRANSFER KUTUSU ÖZELLİKLERİ =====
function getTransferPropertiesHTML(node) {
  var nodeData = node.data || {};
  var isFullThrottle = veActiveModule === 'full-throttle';
  
  var html = '<div style="border-top:1px solid var(--border-color); padding-top:12px;">';
  
  // Başlık
  html += '<div style="font-size:0.8rem; font-weight:600; color:var(--text-heading); margin-bottom:8px; display:flex; align-items:center; gap:6px;">';
  html += '<span>Transfer Kutusu Verileri</span>';
  html += '<button onclick="showInfoPopup(\'transferKutusu\')" style="width:18px; height:18px; border-radius:50%; background:var(--accent-primary); color:white; border:none; cursor:pointer; font-size:0.65rem; display:flex; align-items:center; justify-content:center;" title="Bilgi">?</button>';
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
    
    html += '<div style="background:var(--bg-tertiary); border-radius:8px; padding:10px;">';
    html += '<div style="font-size:0.75rem; font-weight:600; color:var(--text-heading); margin-bottom:8px;">Transfer Case Parametreleri</div>';
    
    // Transfer Case Preset Seçici
    var ftTrPreset = nodeData.ftTrPreset || '';
    html += '<div style="display:flex; gap:6px; margin-bottom:8px; align-items:center;">';
    html += '<select id="ve-fttr-preset-' + node.id + '" onchange="onVEFTTransferPresetSelect(\'' + node.id + '\', this.value)" style="flex:1; font-size:0.68rem; padding:4px 6px; background:var(--bg-input); color:var(--text-primary); border:1px solid var(--border-color); border-radius:4px;">';
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
    var roStyle = 'width:100%; padding:4px; font-size:0.68rem; background:var(--bg-secondary); color:var(--text-secondary); border:1px solid var(--border-color); border-radius:3px; text-align:right; cursor:default;';
    html += '<tr style="border-bottom:1px solid var(--border-color);">';
    html += '<th style="padding:6px 8px; text-align:left; background:var(--bg-tertiary); border-right:1px solid var(--border-color); font-weight:500; color:var(--text-secondary);">Kademe Sayısı</th>';
    html += '<td style="padding:4px 6px; background:var(--bg-tertiary);"><input type="text" value="' + ftTrGears.length + '" readonly style="' + roStyle + '" tabindex="-1"></td>';
    html += '</tr>';
    
    html += '</table>';
    html += '</div>';
    
    // ── KADEME TABLOSU ──
    html += '<div style="margin-top:10px;">';
    html += '<div style="font-size:0.75rem; font-weight:600; color:var(--text-heading); margin-bottom:4px;">Kademe Tablosu</div>';
    
    html += '<div style="border:1px solid var(--border-color); border-radius:6px; overflow:hidden;">';
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
      html += '<td style="padding:3px 5px; background:var(--bg-tertiary);"><input type="number" id="ve-fttr-ratio-' + node.id + '-' + idx + '" value="' + g.ratio + '" step="0.001" min="0.1" style="width:100%; padding:3px; font-size:0.68rem; background:var(--bg-input); color:var(--text-primary); border:1px solid var(--border-color); border-radius:3px; text-align:right;" onchange="onVEFTTransferParamChange(\'' + node.id + '\')"></td>';
      html += '<td style="padding:3px 5px; background:var(--bg-tertiary);"><input type="number" id="ve-fttr-eff-' + node.id + '-' + idx + '" value="' + g.eff + '" step="0.01" min="80" max="100" style="width:100%; padding:3px; font-size:0.68rem; background:var(--bg-input); color:var(--text-primary); border:1px solid var(--border-color); border-radius:3px; text-align:right;" onchange="onVEFTTransferParamChange(\'' + node.id + '\')"></td>';
      html += '</tr>';
    });
    
    html += '</tbody></table>';
    html += '</div>';
    html += '</div>';
    
    // ── BİLGİ NOTU ──
    html += '<div style="background:var(--bg-secondary); border-radius:6px; padding:8px 10px; margin-top:10px; border:1px solid var(--border-color);">';
    html += '<p style="font-size:0.58rem; color:var(--text-muted); line-height:1.4; margin:0;">⚡ Tam Gaz Hızlanma simülasyonu tüm kademeler için ayrı ayrı çalıştırılır. Sonuçlar her kademe için ayrı iSCAAN tablosu olarak raporlanır.</p>';
    html += '</div>';
    
    html += '</div>';
    return html;
  }
  
  // ── MOTOR FRENİ / DİĞER MODÜLLER: Mevcut panel ──
  var transferData = nodeData.transferData || [];
  var selectedMode = nodeData.selectedMode || '';
  var selectedRatio = nodeData.selectedRatio || '';
  
  html += '<p style="font-size:0.68rem; color:var(--text-muted); margin-bottom:10px; line-height:1.4;">Transfer kutusu kademelerini ve oranlarını tanımlayınız.</p>';
  
  // Transfer Kutusu Marka/Model Seçici
  html += '<div style="display:flex; gap:4px; margin-bottom:8px; align-items:center;">';
  html += '<select id="ve-transfer-brand-' + node.id + '" onchange="veUpdateTransferModels(\'' + node.id + '\')" style="flex:1; font-size:0.68rem; padding:4px 4px; background:var(--bg-input); color:var(--text-primary); border:1px solid var(--border-color); border-radius:4px;">';
  html += '<option value="">-- Marka --</option>';
  html += '<option value="AxleTech">AxleTech</option>';
  html += '<option value="Base Studio">Base Studio</option>';
  html += '<option value="GHM">GHM</option>';
  html += '<option value="ZF">ZF</option>';
  html += '</select>';
  html += '<select id="ve-transfer-model-' + node.id + '" onchange="veLoadTransferModel(\'' + node.id + '\')" style="flex:1; font-size:0.68rem; padding:4px 4px; background:var(--bg-input); color:var(--text-primary); border:1px solid var(--border-color); border-radius:4px;">';
  html += '<option value="">-- Model --</option>';
  html += '</select>';
  html += '</div>';
  
  // Kademe Tablosu
  html += '<div id="ve-transfer-table-wrapper-' + node.id + '" style="max-height:150px; overflow-y:auto; margin-bottom:0; border:1px solid var(--border-color); border-radius:6px 6px 0 0; border-bottom:none;">';
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
  html += '<div style="display:flex; gap:4px; background:var(--bg-tertiary); padding:6px; border:1px solid var(--border-color); border-radius:0 0 6px 6px;">';
  html += '<button onclick="addVETransferRow(\'' + node.id + '\')" style="flex:1; padding:4px 8px; font-size:0.65rem; background:var(--accent-primary); color:white; border:none; border-radius:4px; cursor:pointer;">+ Satır Ekle</button>';
  html += '<button onclick="clearVETransferTable(\'' + node.id + '\')" style="flex:1; padding:4px 8px; font-size:0.65rem; background:var(--accent-warning); color:white; border:none; border-radius:4px; cursor:pointer;">Temizle</button>';
  html += '</div>';
  
  // Aktif Kademe Seçimi
  html += '<div style="background:var(--bg-tertiary); border-radius:8px; padding:10px; margin-top:12px;">';
  html += '<div style="font-size:0.75rem; font-weight:600; color:var(--text-heading); margin-bottom:8px;">Aktif Kademe</div>';
  
  html += '<table style="width:100%; font-size:0.7rem; border-collapse:collapse; border:1px solid var(--border-color);">';
  html += '<tr style="border-bottom:1px solid var(--border-color);">';
  html += '<th style="padding:8px; text-align:left; background:var(--bg-tertiary); border-right:1px solid var(--border-color); width:50%; font-weight:500; color:var(--text-secondary);">Seçili kademe</th>';
  html += '<td style="padding:8px; background:var(--bg-tertiary);">';
  html += '<select id="ve-transfer-mode-' + node.id + '" onchange="onVETransferModeChange(\'' + node.id + '\')" style="width:100%; padding:5px; font-size:0.7rem; background:var(--bg-input); color:var(--text-primary); border:1px solid var(--border-color); border-radius:4px;">';
  html += '<option value="">-- Seçin --</option>';
  html += '</select>';
  html += '</td>';
  html += '</tr>';
  html += '<tr>';
  html += '<th style="padding:8px; text-align:left; background:var(--bg-tertiary); border-right:1px solid var(--border-color); font-weight:500; color:var(--text-secondary);">Aktif oran</th>';
  html += '<td style="padding:8px; background:var(--bg-tertiary);"><input type="number" id="ve-transfer-ratio-' + node.id + '" value="' + selectedRatio + '" readonly style="width:100%; padding:5px; font-size:0.7rem; background:var(--bg-secondary); color:var(--text-primary); border:1px solid var(--border-color); border-radius:4px; text-align:right; cursor:not-allowed;"></td>';
  html += '</tr>';
  html += '</table>';
  html += '</div>';
  
  // ===== VERİM =====
  var transferEfficiency = nodeData.efficiency !== undefined ? nodeData.efficiency : 98;
  html += '<div style="background:var(--bg-tertiary); border-radius:8px; padding:10px; margin-top:12px;">';
  html += '<div style="font-size:0.75rem; font-weight:600; color:var(--text-heading); margin-bottom:8px;">Verim</div>';
  html += '<table style="width:100%; font-size:0.7rem; border-collapse:collapse; border:1px solid var(--border-color);">';
  html += '<tr style="border-bottom:1px solid var(--border-color);">';
  html += '<th style="padding:8px; text-align:left; background:var(--bg-tertiary); border-right:1px solid var(--border-color); width:55%; font-weight:500; color:var(--text-secondary);">Transfer kutusu verimi [%]</th>';
  html += '<td style="padding:8px; background:var(--bg-tertiary);"><input type="number" id="ve-transfer-eff-' + node.id + '" value="' + transferEfficiency + '" step="0.5" min="80" max="100" style="width:100%; padding:5px; font-size:0.7rem; background:var(--bg-input); color:var(--text-primary); border:1px solid var(--border-color); border-radius:4px; text-align:right;" onchange="onVETransferEffChange(\'' + node.id + '\')"></td>';
  html += '</tr>';
  html += '<tr><td colspan="2" style="padding:5px 8px; font-size:0.62rem; color:var(--text-muted); background:var(--bg-secondary);">Tipik değer: %95–98</td></tr>';
  html += '</table></div>';
  
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
  html += '<td style="padding:3px; border-bottom:1px solid var(--border-color);"><input type="text" value="' + mode + '" style="width:100%; padding:4px; font-size:0.7rem; background:var(--bg-input); color:var(--text-primary); border:1px solid var(--border-color); border-radius:3px; text-align:center;" onchange="onVETransferDataChange(\'' + nodeId + '\')"></td>';
  html += '<td style="padding:3px; border-bottom:1px solid var(--border-color);"><input type="number" step="0.001" value="' + ratio + '" style="width:100%; padding:4px; font-size:0.7rem; background:var(--bg-input); color:var(--text-primary); border:1px solid var(--border-color); border-radius:3px; text-align:center;" onchange="onVETransferDataChange(\'' + nodeId + '\')"></td>';
  html += '<td style="padding:3px; border-bottom:1px solid var(--border-color);"><input type="text" value="' + note + '" style="width:100%; padding:4px; font-size:0.7rem; background:var(--bg-input); color:var(--text-primary); border:1px solid var(--border-color); border-radius:3px; text-align:center;" onchange="onVETransferDataChange(\'' + nodeId + '\')"></td>';
  html += '<td style="padding:3px; border-bottom:1px solid var(--border-color); text-align:center;"><button onclick="removeVETransferRow(this, \'' + nodeId + '\')" style="padding:2px 6px; font-size:0.6rem; background:var(--accent-danger); color:white; border:none; border-radius:3px; cursor:pointer;">×</button></td>';
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
  
  var html = '<div style="border-top:1px solid var(--border-color); padding-top:12px;">';
  
  html += '<div style="font-size:0.8rem; font-weight:600; color:var(--text-heading); margin-bottom:8px; display:flex; align-items:center; gap:6px;">';
  html += '<span>Propşaft Verileri</span>';
  html += '<button onclick="showInfoPopup(\'propshaftVerileri\')" style="width:18px; height:18px; border-radius:50%; background:var(--accent-primary); color:white; border:none; cursor:pointer; font-size:0.65rem; display:flex; align-items:center; justify-content:center;" title="Bilgi">?</button>';
  html += '</div>';
  
  html += '<div style="background:var(--bg-tertiary); border-radius:8px; padding:10px;">';
  html += '<div style="font-size:0.75rem; font-weight:600; color:var(--text-heading); margin-bottom:8px;">Propşaft Parametreleri</div>';
  html += '<table style="width:100%; font-size:0.68rem; border-collapse:collapse; border:1px solid var(--border-color);">';
  
  // Propşaft Adı
  html += '<tr style="border-bottom:1px solid var(--border-color);">';
  html += '<th style="padding:6px 8px; text-align:left; background:var(--bg-tertiary); border-right:1px solid var(--border-color); width:45%; font-weight:500; color:var(--text-secondary);">Propşaft Adı</th>';
  html += '<td style="padding:4px 6px; background:var(--bg-tertiary);"><input type="text" id="ve-ps-name-' + node.id + '" value="' + psName + '" style="width:100%; padding:4px; font-size:0.68rem; background:var(--bg-input); color:var(--text-primary); border:1px solid var(--border-color); border-radius:3px;" onchange="onVEPropshaftParamChange(\'' + node.id + '\')"></td>';
  html += '</tr>';
  
  // Oran (readonly)
  var roStyle = 'width:100%; padding:4px; font-size:0.68rem; background:var(--bg-secondary); color:var(--text-secondary); border:1px solid var(--border-color); border-radius:3px; text-align:right; cursor:default;';
  html += '<tr style="border-bottom:1px solid var(--border-color);">';
  html += '<th style="padding:6px 8px; text-align:left; background:var(--bg-tertiary); border-right:1px solid var(--border-color); font-weight:500; color:var(--text-secondary);">Oran [-]</th>';
  html += '<td style="padding:4px 6px; background:var(--bg-tertiary);"><input type="text" value="' + psRatio.toFixed(3) + '" readonly style="' + roStyle + '" tabindex="-1"></td>';
  html += '</tr>';
  
  // Verim
  html += '<tr style="border-bottom:1px solid var(--border-color);">';
  html += '<th style="padding:6px 8px; text-align:left; background:var(--bg-tertiary); border-right:1px solid var(--border-color); font-weight:500; color:var(--text-secondary);">Verim <span style="color:var(--text-muted); font-weight:400;">[%]</span></th>';
  html += '<td style="padding:4px 6px; background:var(--bg-tertiary);"><input type="number" id="ve-ps-eff-' + node.id + '" value="' + psEff + '" step="0.01" min="90" max="100" style="width:100%; padding:4px; font-size:0.68rem; background:var(--bg-input); color:var(--text-primary); border:1px solid var(--border-color); border-radius:3px; text-align:right;" onchange="onVEPropshaftParamChange(\'' + node.id + '\')"></td>';
  html += '</tr>';
  
  // Atalet
  html += '<tr style="border-bottom:1px solid var(--border-color);">';
  html += '<th style="padding:6px 8px; text-align:left; background:var(--bg-tertiary); border-right:1px solid var(--border-color); font-weight:500; color:var(--text-secondary);">Atalet <span style="color:var(--text-muted); font-weight:400;">[kg·m²]</span></th>';
  html += '<td style="padding:4px 6px; background:var(--bg-tertiary);"><input type="number" id="ve-ps-inertia-' + node.id + '" value="' + psInertia + '" step="0.01" min="0" style="width:100%; padding:4px; font-size:0.68rem; background:var(--bg-input); color:var(--text-primary); border:1px solid var(--border-color); border-radius:3px; text-align:right;" onchange="onVEPropshaftParamChange(\'' + node.id + '\')"></td>';
  html += '</tr>';
  
  html += '</table>';
  html += '</div>';
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
      var html = '<div style="border-top:1px solid var(--border-color); padding-top:12px;">';
      html += '<div style="font-size:0.8rem; font-weight:600; color:var(--text-heading); margin-bottom:8px; display:flex; align-items:center; gap:6px;">';
      html += '<span>Diferansiyel Parametreleri</span>';
      html += '<span style="background:var(--bg-tertiary); color:var(--text-muted); font-size:0.55rem; font-weight:600; padding:1px 5px; border-radius:8px; border:1px solid var(--border-color);">SLAVE</span>';
      html += '</div>';
      html += '<div style="background:var(--bg-tertiary); border-radius:6px; padding:10px; font-size:0.65rem; color:var(--text-muted); line-height:1.5;">';
      html += 'Bu diferansiyel görsel amaçlıdır. Tüm parametreler Master diferansiyel' + (masterNode ? ' (' + (masterNode.customName || 'Diferansiyel') + ')' : '') + ' üzerinden tanımlanır.';
      html += '</div>';
      html += '</div>';
      return html;
    }
  }

  var diffRatio = nodeData.diffRatio;
  var efficiency = nodeData.efficiency;
  
  var html = '<div style="border-top:1px solid var(--border-color); padding-top:12px;">';
  
  // Başlık
  html += '<div style="font-size:0.8rem; font-weight:600; color:var(--text-heading); margin-bottom:8px; display:flex; align-items:center; gap:6px;">';
  html += '<span>Diferansiyel Parametreleri</span>';
  if(isFullThrottle) {
    html += '<span style="background:#f59e0b; color:#000; font-size:0.55rem; font-weight:700; padding:1px 5px; border-radius:8px;">★ MASTER</span>';
  }
  html += '<button onclick="showInfoPopup(\'diferansiyel\')" style="width:18px; height:18px; border-radius:50%; background:var(--accent-primary); color:white; border:none; cursor:pointer; font-size:0.65rem; display:flex; align-items:center; justify-content:center;' + (isFullThrottle ? ' margin-left:auto;' : '') + '" title="Bilgi">?</button>';
  html += '</div>';
  
  // Tablo
  html += '<table style="width:100%; font-size:0.7rem; border-collapse:collapse; border:1px solid var(--border-color);">';
  
  // Diferansiyel oranı
  html += '<tr style="border-bottom:1px solid var(--border-color);">';
  html += '<th style="padding:8px; text-align:left; background:var(--bg-tertiary); border-right:1px solid var(--border-color); width:60%; font-weight:500; color:var(--text-secondary);">Diferansiyel oranı [-]</th>';
  html += '<td style="padding:8px; background:var(--bg-tertiary);"><input type="number" id="ve-diff-ratio-' + node.id + '" value="' + diffRatio + '" step="0.01" min="1" max="20" style="width:100%; padding:5px; font-size:0.7rem; background:var(--bg-input); color:var(--text-primary); border:1px solid var(--border-color); border-radius:4px; text-align:right;" onchange="onVEDiffParamChange(\'' + node.id + '\')"></td>';
  html += '</tr>';
  
  html += '<tr style="border-bottom:1px solid var(--border-color);">';
  html += '<td colspan="2" style="padding:6px 8px; font-size:0.65rem; color:var(--text-secondary); background:var(--bg-secondary); line-height:1.4;">Son tahrik oranı. Askeri araçlarda tipik değer: 4.5–8.0 arası.</td>';
  html += '</tr>';
  
  // Verim
  html += '<tr style="border-bottom:1px solid var(--border-color);">';
  html += '<th style="padding:8px; text-align:left; background:var(--bg-tertiary); border-right:1px solid var(--border-color); font-weight:500; color:var(--text-secondary);">Diferansiyel verimi [%]</th>';
  html += '<td style="padding:8px; background:var(--bg-tertiary);"><input type="number" id="ve-diff-eff-' + node.id + '" value="' + efficiency + '" step="0.5" min="80" max="100" style="width:100%; padding:5px; font-size:0.7rem; background:var(--bg-input); color:var(--text-primary); border:1px solid var(--border-color); border-radius:4px; text-align:right;" onchange="onVEDiffParamChange(\'' + node.id + '\')"></td>';
  html += '</tr>';
  
  html += '<tr>';
  html += '<td colspan="2" style="padding:6px 8px; font-size:0.65rem; color:var(--text-secondary); background:var(--bg-secondary); line-height:1.4;">Diferansiyel mekanik verimi. Tipik değer: %95–98 arası.</td>';
  html += '</tr>';
  
  // Atalet
  var diffInertia = nodeData.diffInertia !== undefined ? nodeData.diffInertia : 1.0;
  html += '<tr style="border-bottom:1px solid var(--border-color);">';
  html += '<th style="padding:8px; text-align:left; background:var(--bg-tertiary); border-right:1px solid var(--border-color); font-weight:500; color:var(--text-secondary);">Atalet <span style="color:var(--text-muted); font-weight:400;">[kg·m²]</span></th>';
  html += '<td style="padding:8px; background:var(--bg-tertiary);"><input type="number" id="ve-diff-inertia-' + node.id + '" value="' + diffInertia + '" step="0.01" min="0" style="width:100%; padding:5px; font-size:0.7rem; background:var(--bg-input); color:var(--text-primary); border:1px solid var(--border-color); border-radius:4px; text-align:right;" onchange="onVEDiffParamChange(\'' + node.id + '\')"></td>';
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

// ===== TEKERLEK ÖZELLİKLERİ =====
function getSolverPropertiesHTML(node) {
  var d = node.data || {};
  var maxSimTime = d.maxSimTime !== undefined ? d.maxSimTime : 300;

  var html = '<div style="border-top:1px solid var(--border-color); padding-top:12px;">';

  // Başlık
  html += '<div style="display:flex; align-items:center; gap:8px; margin-bottom:10px;">';
  html += '<div style="font-size:0.78rem; font-weight:700; color:var(--text-heading);">Çözücü Ayarları</div>';
  html += '<span style="font-size:0.52rem; font-weight:600; color:#2e7d32; background:#2e7d3218; padding:2px 7px; border-radius:3px; border:1px solid #2e7d3230; letter-spacing:0.03em; text-transform:uppercase;">MFSim</span>';
  html += '</div>';
  
  // ===== ÇÖZÜM KÜMESİ =====
  var perfAnalysis = d.performanceAnalysis || false;
  html += '<div style="margin-bottom:10px;">';
  html += '<div style="font-size:0.72rem; font-weight:600; color:var(--text-heading); margin-bottom:6px;">Çözüm Kümesi</div>';
  html += '<label style="display:flex; align-items:center; gap:8px; padding:7px 10px; background:var(--bg-tertiary); border:1px solid var(--border-color); border-radius:4px; cursor:pointer; font-size:0.66rem; color:var(--text-primary);" onmouseenter="this.style.borderColor=\'var(--accent-primary)\'" onmouseleave="this.style.borderColor=\'var(--border-color)\'">';
  html += '<input type="checkbox" id="ve-solver-perfanalysis-' + node.id + '" ' + (perfAnalysis ? 'checked' : '') + ' onchange="onVESolverParamChange(\'' + node.id + '\')" style="accent-color:var(--accent-primary); width:15px; height:15px; cursor:pointer;">';
  html += '<div><div style="font-weight:600;">Performans Analizi</div><div style="font-size:0.54rem; color:var(--text-muted); margin-top:2px;">Tam gaz hızlanma, 0-100 km/h, elastik hızlanma, gradeability</div></div>';
  html += '</label>';

  // Hızlanma-Yavaşlama checkbox (segment bazlı sürüş)
  var accelDecel = d.accelDecelAnalysis || false;
  var scenNode = nodes.find(function(n) { return n.type === 'scenario'; });
  var hasRoadSegs = scenNode && scenNode.data && scenNode.data.roadSegments && scenNode.data.roadSegments.length > 0;
  if(hasRoadSegs) {
    html += '<label style="display:flex; align-items:center; gap:8px; padding:7px 10px; margin-top:6px; background:var(--bg-tertiary); border:1px solid var(--border-color); border-radius:4px; cursor:pointer; font-size:0.66rem; color:var(--text-primary);" onmouseenter="this.style.borderColor=\'var(--accent-primary)\'" onmouseleave="this.style.borderColor=\'var(--border-color)\'">';
    html += '<input type="checkbox" id="ve-solver-acceldecel-' + node.id + '" ' + (accelDecel ? 'checked' : '') + ' onchange="onVESolverParamChange(\'' + node.id + '\')" style="accent-color:var(--accent-primary); width:15px; height:15px; cursor:pointer;">';
    html += '<div><div style="font-weight:600;">Hızlanma-Yavaşlama</div><div style="font-size:0.54rem; color:var(--text-muted); margin-top:2px;">Segment bazlı sürüş analizi — güzergah üzerinde hızlanma/yavaşlama profili</div></div>';
    html += '</label>';
  }

  // Engel Atlama Analizi checkbox (obstacle-crossing bileşeni gerektirir)
  var obsCrossAnalysis = d.obstacleCrossingAnalysis || false;
  var obsNode = nodes.find(function(n) { return n.type === 'obstacle-crossing'; });
  if(obsNode) {
    html += '<label style="display:flex; align-items:center; gap:8px; padding:7px 10px; margin-top:6px; background:var(--bg-tertiary); border:1px solid var(--border-color); border-radius:4px; cursor:pointer; font-size:0.66rem; color:var(--text-primary);" onmouseenter="this.style.borderColor=\'var(--accent-primary)\'" onmouseleave="this.style.borderColor=\'var(--border-color)\'">';
    html += '<input type="checkbox" id="ve-solver-obscross-' + node.id + '" ' + (obsCrossAnalysis ? 'checked' : '') + ' onchange="onVESolverParamChange(\'' + node.id + '\')" style="accent-color:var(--accent-primary); width:15px; height:15px; cursor:pointer;">';
    html += '<div><div style="font-weight:600;">Engel Atlama Analizi</div><div style="font-size:0.54rem; color:var(--text-muted); margin-top:2px;">Engel geçme kabiliyeti analizi — hendek, rampa ve dikey engel hesaplamaları</div></div>';
    html += '</label>';
  }
  html += '</div>';

  html += '<table style="width:100%; font-size:0.68rem; border-collapse:collapse; border:1px solid var(--border-color);">';

  // Zaman modu: otomatik "maks hıza kadar"
  html += '<input type="hidden" id="ve-solver-timemode-' + node.id + '" value="stop">';
  html += '<input type="hidden" id="ve-solver-maxtime-' + node.id + '" value="' + maxSimTime + '">';

  // Çözüm yöntemi
  var method = d.method || 'rk4';
  var isAdaptive = method === 'rk45';
  html += '<tr style="border-bottom:1px solid var(--border-color);"><th style="padding:6px; text-align:left; background:var(--bg-tertiary); border-right:1px solid var(--border-color); font-weight:500; color:var(--text-secondary);">Çözüm yöntemi</th><td style="padding:6px; background:var(--bg-tertiary);"><select id="ve-solver-method-' + node.id + '" onchange="onVESolverParamChange(\'' + node.id + '\')" style="width:100%; padding:4px; font-size:0.68rem; background:var(--bg-input); color:var(--text-primary); border:1px solid var(--border-color); border-radius:4px;"><option value="euler"' + (method==='euler'?' selected':'') + '>Euler (1. derece)</option><option value="heun"' + (method==='heun'?' selected':'') + '>Heun (2. derece)</option><option value="ralston"' + (method==='ralston'?' selected':'') + '>Ralston (2. derece, optimal)</option><option value="rk4"' + (method==='rk4'?' selected':'') + '>RK4 (4. derece)</option><option value="rk45"' + (method==='rk45'?' selected':'') + '>⚡ RK45 Dormand-Prince (adaptif)</option></select></td></tr>';
  html += '<tr style="border-bottom:1px solid var(--border-color);"><td colspan="2" style="padding:3px 6px; font-size:0.54rem; color:var(--text-muted); background:var(--bg-secondary); line-height:1.3;"><b>Euler</b>: Hızlı, düşük doğruluk. <b>Heun</b>: İyi denge. <b>Ralston</b>: Optimal 2. derece. <b>RK4</b>: Yüksek doğruluk (önerilen). <b>RK45</b>: Adaptif adım — otomatik hassasiyet kontrolü.</td></tr>';

  // Sabit adım büyüklüğü (RK45 dışında)
  var ftDt = d.ftDt || 0.01;
  var showDtRow = method !== 'rk45';
  html += '<tr id="ve-solver-ftdt-row-' + node.id + '" style="border-bottom:1px solid var(--border-color);' + (!showDtRow ? 'display:none;' : '') + '"><th style="padding:6px; text-align:left; background:var(--bg-tertiary); border-right:1px solid var(--border-color); font-weight:500; color:var(--text-secondary);">Adım büyüklüğü Δt [s]</th><td style="padding:6px; background:var(--bg-tertiary);"><select id="ve-solver-ftdt-' + node.id + '" onchange="onVESolverParamChange(\'' + node.id + '\')" style="width:100%; padding:4px; font-size:0.68rem; background:var(--bg-input); color:var(--text-primary); border:1px solid var(--border-color); border-radius:4px;"><option value="0.05"' + (ftDt==0.05?' selected':'') + '>0.05 (hızlı)</option><option value="0.02"' + (ftDt==0.02?' selected':'') + '>0.02</option><option value="0.01"' + (ftDt==0.01?' selected':'') + '>0.01 (varsayılan)</option><option value="0.005"' + (ftDt==0.005?' selected':'') + '>0.005 (hassas)</option><option value="0.001"' + (ftDt==0.001?' selected':'') + '>0.001 (çok hassas)</option></select></td></tr>';

  // RK45 tolerans ayarları
  var ftAtol = d.ftAtol !== undefined ? d.ftAtol : 1e-6;
  var ftRtol = d.ftRtol !== undefined ? d.ftRtol : 1e-4;
  var showFtTol = method === 'rk45';
  html += '<tr id="ve-solver-fttol-row-' + node.id + '" style="border-bottom:1px solid var(--border-color);' + (!showFtTol ? 'display:none;' : '') + '"><th style="padding:6px; text-align:left; background:var(--bg-tertiary); border-right:1px solid var(--border-color); font-weight:500; color:var(--text-secondary);">Tolerans (ATol / RTol)</th><td style="padding:6px; background:var(--bg-tertiary);"><div style="display:flex; gap:4px; align-items:center;"><input type="text" id="ve-solver-ftatol-' + node.id + '" value="' + ftAtol + '" style="width:50%; padding:4px; font-size:0.68rem; background:var(--bg-input); color:var(--text-primary); border:1px solid var(--border-color); border-radius:4px; text-align:right; font-family:monospace;" onchange="onVESolverParamChange(\'' + node.id + '\')"><input type="text" id="ve-solver-ftrtol-' + node.id + '" value="' + ftRtol + '" style="width:50%; padding:4px; font-size:0.68rem; background:var(--bg-input); color:var(--text-primary); border:1px solid var(--border-color); border-radius:4px; text-align:right; font-family:monospace;" onchange="onVESolverParamChange(\'' + node.id + '\')"></div></td></tr>';
  html += '<tr id="ve-solver-fttol-desc-' + node.id + '" style="border-bottom:1px solid var(--border-color);' + (!showFtTol ? 'display:none;' : '') + '"><td colspan="2" style="padding:3px 6px; font-size:0.54rem; color:var(--text-muted); background:var(--bg-secondary); line-height:1.3;"><b>ATol</b>: Mutlak tolerans (hız m/s). <b>RTol</b>: Bağıl tolerans. Adaptif adım sayısı toleransa göre otomatik belirlenir.</td></tr>';
  
  html += '</table>';
  
  // ===== INTERPOLASYON BİLGİSİ =====
  html += '<div style="margin-top:10px; padding:8px 10px; background:var(--bg-secondary); border-radius:4px; border:1px solid var(--border-color);">';
  html += '<div style="display:flex; align-items:center; gap:5px; margin-bottom:5px;">';
  html += '<span style="font-size:0.62rem; font-weight:600; color:var(--text-heading);">Sayısal Yöntemler</span>';
  html += '</div>';
  html += '<div style="font-size:0.55rem; color:var(--text-muted); line-height:1.5;">';
  html += '<div style="display:flex; justify-content:space-between; padding:2px 0;"><span style="color:var(--text-secondary);">Tork interpolasyonu</span><span style="color:var(--text-primary); font-weight:500;">PCHIP Spline</span></div>';
  html += '<div style="display:flex; justify-content:space-between; padding:2px 0; border-top:1px solid var(--border-color);"><span style="color:var(--text-secondary);">Mesafe entegrasyonu</span><span style="color:var(--text-primary); font-weight:500;">Trapezoidal</span></div>';
  html += '<div style="display:flex; justify-content:space-between; padding:2px 0; border-top:1px solid var(--border-color);"><span style="color:var(--text-secondary);">Enerji dengesi</span><span style="color:var(--text-primary); font-weight:500;">Otomatik</span></div>';
  html += '</div></div>';
  
  // ===== TOPOLOJİ ZİNCİRİ ÖNİZLEME =====
  html += '<div style="margin-top:8px; padding:8px 10px; background:var(--bg-secondary); border-radius:4px; border:1px solid var(--border-color);">';
  html += '<div style="font-size:0.62rem; font-weight:600; color:var(--text-heading); margin-bottom:5px;">Güç Aktarma Zinciri</div>';
  html += '<div id="ve-solver-chain-' + node.id + '" style="font-size:0.56rem; color:var(--text-muted);">';
  
  var chain = veGetPowertrainChain();
  if(chain && chain.length > 0) {
    html += '<div style="display:flex; flex-wrap:wrap; align-items:center; gap:3px;">';
    chain.forEach(function(n, i) {
      if(i > 0) html += '<span style="color:var(--text-muted); font-size:0.48rem;">→</span>';
      html += '<span style="color:var(--accent-primary); font-weight:500; background:var(--bg-tertiary); padding:1px 6px; border-radius:3px; border:1px solid var(--border-color); font-size:0.54rem;">' + (n.customName || n.def.name) + '</span>';
    });
    html += '</div>';
  } else {
    html += '<span style="color:var(--accent-warning); font-size:0.54rem;">Bağlantılardan zincir oluşturulamadı. Bileşenleri bağlayın.</span>';
  }
  
  html += '</div></div>';
  
  // ===== HESAPLA BUTONU =====
  html += '<div style="margin-top:14px;">';
  html += '<button onclick="veSolverRunProfessional()" style="width:100%; padding:8px 12px; font-size:0.72rem; font-weight:600; background:linear-gradient(135deg, #1b5e20, #2e7d32); color:white; border:none; border-radius:4px; cursor:pointer; display:flex; align-items:center; justify-content:center; gap:6px; box-shadow:0 2px 6px rgba(27,94,32,0.25); transition:all 0.15s; letter-spacing:0.03em;" onmouseenter="this.style.transform=\'translateY(-1px)\';this.style.boxShadow=\'0 4px 12px rgba(27,94,32,0.35)\'" onmouseleave="this.style.transform=\'\';this.style.boxShadow=\'0 2px 6px rgba(27,94,32,0.25)\'">';
  html += '▶ Hesapla';
  html += '</button>';
  html += '</div>';
  
  html += '</div>';
  return html;
}

function onVESolverParamChange(nodeId) {
  var node = nodes.find(function(n) { return n.id === nodeId; });
  if(!node) return;
  if(!node.data) node.data = {};
  
  var el = function(id) { return document.getElementById(id); };
  var tmEl = el('ve-solver-timemode-' + nodeId);
  var durEl = el('ve-solver-duration-' + nodeId);
  var maxEl = el('ve-solver-maxtime-' + nodeId);
  var ssEl = el('ve-solver-stopspeed-' + nodeId);
  var resEl = el('ve-solver-resolution-' + nodeId);
  
  if(tmEl) {
    node.data.timeMode = tmEl.value;
    var isStop = tmEl.value === 'stop';
    var durRow = el('ve-solver-dur-row-' + nodeId);
    var maxRow = el('ve-solver-maxtime-row-' + nodeId);
    var stopRow = el('ve-solver-stopspeed-row-' + nodeId);
    if(durRow) durRow.style.display = isStop ? 'none' : '';
    if(maxRow) maxRow.style.display = isStop ? '' : 'none';
    if(stopRow) stopRow.style.display = 'none';
  }
  var pf = function(v, def) { var n = parseFloat(v); return isNaN(n) ? def : n; };
  if(durEl) node.data.duration = pf(durEl.value, 60);
  if(maxEl) node.data.maxSimTime = pf(maxEl.value, 300);
  if(ssEl) node.data.stopSpeed = pf(ssEl.value, 2);

  // Çözünürlük → dt hesapla
  if(resEl) {
    var steps = parseInt(resEl.value) || 200;
    node.data.resolution = steps;
    var simTime = node.data.timeMode === 'stop' ? (node.data.maxSimTime || 300) : (node.data.duration || 60);
    node.data.dt = simTime / steps;
  }
  
  var methodEl = el('ve-solver-method-' + nodeId);
  if(methodEl) {
    node.data.method = methodEl.value;
    
    // RK45 tolerans satırlarının görünürlüğü (MF modu)
    var isAdaptive = methodEl.value === 'rk45';
    var tolRow = el('ve-solver-tol-row-' + nodeId);
    var tolDesc = el('ve-solver-tol-desc-' + nodeId);
    if(tolRow) tolRow.style.display = isAdaptive ? '' : 'none';
    if(tolDesc) tolDesc.style.display = isAdaptive ? '' : 'none';
    
    // FT modu: Δt satırı ve RK45 tolerans satırlarının görünürlüğü
    var ftDtRow = el('ve-solver-ftdt-row-' + nodeId);
    var ftTolRow = el('ve-solver-fttol-row-' + nodeId);
    var ftTolDesc = el('ve-solver-fttol-desc-' + nodeId);
    if(ftDtRow) ftDtRow.style.display = isAdaptive ? 'none' : '';
    if(ftTolRow) ftTolRow.style.display = isAdaptive ? '' : 'none';
    if(ftTolDesc) ftTolDesc.style.display = isAdaptive ? '' : 'none';
  }
  
  // RK45 tolerans parametreleri (MF modu)
  var atolEl = el('ve-solver-atol-' + nodeId);
  var rtolEl = el('ve-solver-rtol-' + nodeId);
  if(atolEl) node.data.atol = pf(atolEl.value, 1e-6);
  if(rtolEl) node.data.rtol = pf(rtolEl.value, 1e-4);
  
  // Performans Analizi checkbox
  var perfEl = el('ve-solver-perfanalysis-' + nodeId);
  if(perfEl) node.data.performanceAnalysis = perfEl.checked;

  // Hızlanma-Yavaşlama checkbox
  var adEl = el('ve-solver-acceldecel-' + nodeId);
  if(adEl) node.data.accelDecelAnalysis = adEl.checked;

  // Engel Atlama Analizi checkbox
  var ocEl = el('ve-solver-obscross-' + nodeId);
  if(ocEl) node.data.obstacleCrossingAnalysis = ocEl.checked;

  // FT modu parametreleri
  var ftDtEl = el('ve-solver-ftdt-' + nodeId);
  if(ftDtEl) node.data.ftDt = pf(ftDtEl.value, 0.01);
  var ftAtolEl = el('ve-solver-ftatol-' + nodeId);
  var ftRtolEl = el('ve-solver-ftrtol-' + nodeId);
  if(ftAtolEl) node.data.ftAtol = pf(ftAtolEl.value, 1e-6);
  if(ftRtolEl) node.data.ftRtol = pf(ftRtolEl.value, 1e-4);
}

// ===== VİTES GEÇİŞLERİ ÖZELLİKLERİ =====
function getGearShiftPropertiesHTML(node) {
  var html = '<div style="border-top:1px solid var(--border-color); padding-top:12px;">';
  html += '<div style="font-size:0.7rem; color:var(--text-muted); text-transform:uppercase; margin-bottom:8px;">Parametreler</div>';
  html += '<div style="font-size:0.8rem; color:var(--text-secondary);">Bu bileşen için henüz parametre tanımlanmamış.</div>';
  html += '</div>';
  return html;
}

