
// ===== SENSÖR BİLEŞENİ =====
function getSensorPropertiesHTML(node) {
  var d = node.data || {};
  var attachedConnId = d.attachedConnection || '';
  var attachedCompId = d.attachedComponent || '';
  var selectedSignal = d.selectedSignal || '';
  
  var html = '<div style="border-top:1px solid var(--border-color); padding-top:12px;">';
  html += '<div style="font-size:0.8rem; font-weight:600; color:#22c55e; margin-bottom:8px;">📌 Sensör</div>';
  
  // Bağlantı durumu kontrolü
  var conn = attachedConnId ? connections.find(function(c) { return c.id === attachedConnId; }) : null;
  var fromN = conn ? nodes.find(function(n) { return n.id === conn.from; }) : null;
  var toN = conn ? nodes.find(function(n) { return n.id === conn.to; }) : null;
  
  // Bileşen bağlantısı kontrolü
  var compNode = attachedCompId ? nodes.find(function(n) { return n.id === attachedCompId; }) : null;
  
  var sourceType = '';
  var availableSignals = [];
  
  if(compNode) {
    // Doğrudan bileşene bağlı
    sourceType = compNode.type;
    availableSignals = (COMPONENT_SIGNALS[sourceType] && COMPONENT_SIGNALS[sourceType].outputs) || [];
  } else if(fromN) {
    // Bağlantı üzerinden bağlı
    sourceType = fromN.type;
    availableSignals = (COMPONENT_SIGNALS[sourceType] && COMPONENT_SIGNALS[sourceType].outputs) || [];
  }
  
  html += '<table style="width:100%; font-size:0.7rem; border-collapse:collapse; border:1px solid var(--border-color);">';
  
  if(!conn && !compNode) {
    // Bağlı değil
    html += '<tr><td style="padding:10px; text-align:center; background:var(--bg-tertiary); color:var(--text-muted); font-size:0.65rem;">';
    html += '📡 Sensör portunu bir bağlantı çizgisine<br>veya bileşene bağlayın.<br>';
    html += '<span style="font-size:0.58rem; opacity:0.7;">Porta tıklayın → yeşil noktaya/bileşene tıklayın</span>';
    html += '</td></tr>';
  } else if(compNode) {
    // Doğrudan bileşene bağlı
    var compName = compNode.customName || (componentDefs[compNode.type] ? componentDefs[compNode.type].name : '?');
    
    html += '<tr style="border-bottom:1px solid var(--border-color);"><th style="padding:6px; text-align:left; background:var(--bg-tertiary); border-right:1px solid var(--border-color); width:35%; font-weight:500; color:var(--text-secondary); font-size:0.65rem;">Bağlı Bileşen</th>';
    html += '<td style="padding:6px; background:var(--bg-tertiary); font-size:0.65rem;"><span style="color:#f59e0b; font-weight:600;">⬤ ' + compName + '</span></td></tr>';
    
    html += '<tr style="border-bottom:1px solid var(--border-color);"><th style="padding:6px; text-align:left; background:var(--bg-tertiary); border-right:1px solid var(--border-color); font-weight:500; color:var(--text-secondary); font-size:0.65rem;">Tür</th>';
    html += '<td style="padding:6px; background:var(--bg-tertiary); font-size:0.65rem;">' + (componentDefs[compNode.type] ? componentDefs[compNode.type].name : compNode.type) + '</td></tr>';
    
    // Sinyal seçimi — çoklu seçim (checkbox)
    var selectedSignals = d.selectedSignals || (d.selectedSignal ? [d.selectedSignal] : []);
    // Hiç seçim yoksa tümünü otomatik seç
    if(selectedSignals.length === 0 && availableSignals.length > 0) {
      selectedSignals = availableSignals.map(function(s) { return s.id; });
      if(!node.data) node.data = {};
      node.data.selectedSignals = selectedSignals;
      node.data.selectedSignal = selectedSignals[0];
    }
    
    html += '<tr style="border-bottom:1px solid var(--border-color);"><th style="padding:6px; text-align:left; background:var(--bg-tertiary); border-right:1px solid var(--border-color); font-weight:500; color:var(--text-secondary); font-size:0.65rem; vertical-align:top;">Sinyaller</th>';
    html += '<td style="padding:6px; background:var(--bg-tertiary);">';
    html += '<div style="display:flex; gap:4px; margin-bottom:4px;">';
    html += '<button onclick="veToggleAllSensorSignals(\'' + node.id + '\', true)" style="flex:1; padding:2px 4px; font-size:0.55rem; background:var(--bg-input); color:var(--accent-success); border:1px solid var(--border-color); border-radius:3px; cursor:pointer;">✅ Tümü</button>';
    html += '<button onclick="veToggleAllSensorSignals(\'' + node.id + '\', false)" style="flex:1; padding:2px 4px; font-size:0.55rem; background:var(--bg-input); color:var(--text-muted); border:1px solid var(--border-color); border-radius:3px; cursor:pointer;">⬜ Hiçbiri</button>';
    html += '</div>';
    availableSignals.forEach(function(sig) {
      var isChecked = selectedSignals.indexOf(sig.id) >= 0;
      html += '<label style="display:flex; align-items:center; gap:4px; font-size:0.6rem; padding:2px 0; cursor:pointer; color:' + (isChecked ? '#22c55e' : 'var(--text-secondary)') + ';">';
      html += '<input type="checkbox" data-signal="' + sig.id + '" ' + (isChecked ? 'checked' : '') + ' onchange="onVESensorSignalToggle(\'' + node.id + '\')" style="margin:0; width:12px; height:12px; accent-color:#22c55e;">';
      html += sig.name + ' <span style="opacity:0.6;">[' + sig.unit + ']</span></label>';
    });
    html += '</td></tr>';
    
    // Seçili sinyal sayısı
    html += '<tr style="border-bottom:1px solid var(--border-color);"><td colspan="2" style="padding:4px 8px; font-size:0.55rem; color:var(--text-muted); background:var(--bg-secondary);">';
    html += '📊 <b>' + selectedSignals.length + '</b> / ' + availableSignals.length + ' sinyal aktif — Sonuçlara sürüklendiğinde tüm aktif sinyaller okunur.';
    html += '</td></tr>';
    
    // Koparma
    html += '<tr><td colspan="2" style="padding:6px; background:var(--bg-tertiary); text-align:center;">';
    html += '<button onclick="var sn=nodes.find(function(n){return n.id==\'' + node.id + '\'});if(sn){veDetachSensor(sn);updateAllConnections();showNodeProperties(sn);}" style="padding:4px 12px; font-size:0.6rem; background:var(--accent-danger); color:white; border:none; border-radius:4px; cursor:pointer;">🔗 Bağlantıyı Kopar</button>';
    html += '</td></tr>';
  } else {
    // Bağlantı üzerinden bağlı
    var fromName = fromN ? (fromN.customName || componentDefs[fromN.type].name) : '?';
    var toName = toN ? (toN.customName || componentDefs[toN.type].name) : '?';
    
    // Sensör yönü: hangi tarafa bakıyor?
    var sensorDirection = d.sensorDirection || 'from'; // 'from' veya 'to'
    var directionNode = sensorDirection === 'to' ? toN : fromN;
    sourceType = directionNode ? directionNode.type : (fromN ? fromN.type : '');
    var allSignals = (COMPONENT_SIGNALS[sourceType] && COMPONENT_SIGNALS[sourceType].outputs) || [];
    
    // ====== YÖN BAZLI SİNYAL FİLTRELEME ======
    // "from" (çıkış) yönü: _in ile biten sinyalleri hariç tut (çıkış + durum sinyalleri kalır)
    // "to" (giriş) yönü: sadece _in ile biten sinyalleri göster
    availableSignals = allSignals.filter(function(sig) {
      var id = sig.id;
      var hasIn = id.length > 3 && id.substring(id.length - 3) === '_in';
      var hasOut = id.length > 4 && id.substring(id.length - 4) === '_out';
      
      if(sensorDirection === 'from') {
        // Çıkış yönü: giriş sinyallerini (_in) hariç tut
        return !hasIn;
      } else {
        // Giriş yönü: sadece giriş sinyallerini (_in) göster
        return hasIn;
      }
    });
    
    html += '<tr style="border-bottom:1px solid var(--border-color);"><th style="padding:6px; text-align:left; background:var(--bg-tertiary); border-right:1px solid var(--border-color); width:35%; font-weight:500; color:var(--text-secondary); font-size:0.65rem;">Bağlantı</th>';
    html += '<td style="padding:6px; background:var(--bg-tertiary); font-size:0.65rem;"><span style="color:#22c55e; font-weight:600;">' + fromName + '</span> → <span style="color:var(--accent-primary);">' + toName + '</span></td></tr>';
    
    // Yön seçici
    html += '<tr style="border-bottom:1px solid var(--border-color);"><th style="padding:6px; text-align:left; background:var(--bg-tertiary); border-right:1px solid var(--border-color); font-weight:500; color:var(--text-secondary); font-size:0.65rem;">Okuma Yönü</th>';
    html += '<td style="padding:6px; background:var(--bg-tertiary);"><select id="ve-sensor-direction-' + node.id + '" onchange="onVESensorDirectionChange(\'' + node.id + '\')" style="width:100%; padding:4px; font-size:0.65rem; background:var(--bg-input); color:var(--text-primary); border:1px solid var(--border-color); border-radius:4px;">';
    html += '<option value="from"' + (sensorDirection === 'from' ? ' selected' : '') + '>◀ ' + fromName + ' (çıkış)</option>';
    html += '<option value="to"' + (sensorDirection === 'to' ? ' selected' : '') + '>▶ ' + toName + ' (giriş)</option>';
    html += '</select></td></tr>';
    
    // Yön açıklama
    var dirLabel = sensorDirection === 'from' ? fromName + ' çıkış' : toName + ' giriş';
    html += '<tr style="border-bottom:1px solid var(--border-color);"><td colspan="2" style="padding:4px 8px; font-size:0.55rem; color:var(--text-muted); background:var(--bg-secondary); line-height:1.3;">';
    html += '📐 Sensör <b>' + dirLabel + '</b> değerlerini okuyor. Yönü değiştirerek diğer bileşenin sinyallerini görebilirsiniz.';
    html += '</td></tr>';
    
    html += '<tr style="border-bottom:1px solid var(--border-color);"><th style="padding:6px; text-align:left; background:var(--bg-tertiary); border-right:1px solid var(--border-color); font-weight:500; color:var(--text-secondary); font-size:0.65rem; vertical-align:top;">Sinyaller</th>';
    if(availableSignals.length === 0) {
      html += '<td style="padding:6px; background:var(--bg-tertiary); font-size:0.6rem; color:#f59e0b; font-style:italic;">⚠ Bu yönde okunabilir sinyal yok — yönü değiştirin</td></tr>';
    } else {
      var selectedSignals = d.selectedSignals || (d.selectedSignal ? [d.selectedSignal] : []);
      if(selectedSignals.length === 0 && availableSignals.length > 0) {
        selectedSignals = availableSignals.map(function(s) { return s.id; });
        if(!node.data) node.data = {};
        node.data.selectedSignals = selectedSignals;
        node.data.selectedSignal = selectedSignals[0];
      }
      html += '<td style="padding:6px; background:var(--bg-tertiary);">';
      html += '<div style="display:flex; gap:4px; margin-bottom:4px;">';
      html += '<button onclick="veToggleAllSensorSignals(\'' + node.id + '\', true)" style="flex:1; padding:2px 4px; font-size:0.55rem; background:var(--bg-input); color:var(--accent-success); border:1px solid var(--border-color); border-radius:3px; cursor:pointer;">✅ Tümü</button>';
      html += '<button onclick="veToggleAllSensorSignals(\'' + node.id + '\', false)" style="flex:1; padding:2px 4px; font-size:0.55rem; background:var(--bg-input); color:var(--text-muted); border:1px solid var(--border-color); border-radius:3px; cursor:pointer;">⬜ Hiçbiri</button>';
      html += '</div>';
      availableSignals.forEach(function(sig) {
        var isChecked = selectedSignals.indexOf(sig.id) >= 0;
        html += '<label style="display:flex; align-items:center; gap:4px; font-size:0.6rem; padding:2px 0; cursor:pointer; color:' + (isChecked ? '#22c55e' : 'var(--text-secondary)') + ';">';
        html += '<input type="checkbox" data-signal="' + sig.id + '" ' + (isChecked ? 'checked' : '') + ' onchange="onVESensorSignalToggle(\'' + node.id + '\')" style="margin:0; width:12px; height:12px; accent-color:#22c55e;">';
        html += sig.name + ' <span style="opacity:0.6;">[' + sig.unit + ']</span></label>';
      });
      html += '</td></tr>';
    }
    
    html += '<tr style="border-bottom:1px solid var(--border-color);"><td colspan="2" style="padding:4px 8px; background:var(--bg-secondary);">';
    html += '<div style="font-size:0.55rem; color:var(--text-muted);">📊 Okunabilir Sinyaller (' + dirLabel + '): <b>' + availableSignals.length + '</b> sinyal</div>';
    html += '</td></tr>';
    
    html += '<tr><td colspan="2" style="padding:6px; background:var(--bg-tertiary); text-align:center;">';
    html += '<button onclick="var sn=nodes.find(function(n){return n.id==\'' + node.id + '\'});if(sn){veDetachSensor(sn);updateAllConnections();showNodeProperties(sn);}" style="padding:4px 12px; font-size:0.6rem; background:var(--accent-danger); color:white; border:none; border-radius:4px; cursor:pointer;">🔗 Bağlantıyı Kopar</button>';
    html += '</td></tr>';
  }
  
  html += '</table>';
  html += '<div style="margin-top:6px; font-size:0.5rem; color:var(--text-muted);">💡 Simülasyonda seçili sinyal zamana bağlı kaydedilir.</div>';
  html += '</div>';
  return html;
}

function onVESensorChange(nodeId) {
  var node = nodes.find(function(n) { return n.id === nodeId; });
  if(!node) return;
  if(!node.data) node.data = {};
  var sigEl = document.getElementById('ve-sensor-signal-' + nodeId);
  if(sigEl) {
    node.data.selectedSignal = sigEl.value;
    node.data.selectedSignals = sigEl.value ? [sigEl.value] : [];
  }
}

// Checkbox-based multi-signal toggle
function onVESensorSignalToggle(nodeId) {
  var node = nodes.find(function(n) { return n.id === nodeId; });
  if(!node) return;
  if(!node.data) node.data = {};
  
  // Read all checkboxes for this sensor
  var checkboxes = document.querySelectorAll('input[type="checkbox"][data-signal]');
  var selected = [];
  checkboxes.forEach(function(cb) {
    if(cb.checked) selected.push(cb.getAttribute('data-signal'));
  });
  
  node.data.selectedSignals = selected;
  node.data.selectedSignal = selected.length > 0 ? selected[0] : '';
  
  // Update sensor name
  _veUpdateSensorName(node);
  
  // Refresh panel
  showNodeProperties(node);
}

function veToggleAllSensorSignals(nodeId, selectAll) {
  var node = nodes.find(function(n) { return n.id === nodeId; });
  if(!node) return;
  if(!node.data) node.data = {};
  
  var checkboxes = document.querySelectorAll('input[type="checkbox"][data-signal]');
  var selected = [];
  checkboxes.forEach(function(cb) {
    cb.checked = selectAll;
    if(selectAll) selected.push(cb.getAttribute('data-signal'));
  });
  
  node.data.selectedSignals = selected;
  node.data.selectedSignal = selected.length > 0 ? selected[0] : '';
  
  _veUpdateSensorName(node);
  showNodeProperties(node);
}

function _veUpdateSensorName(node) {
  var sourceName = '';
  var sourceType = '';
  if(node.data.attachedComponent) {
    var compN = nodes.find(function(n) { return n.id === node.data.attachedComponent; });
    if(compN) { sourceName = compN.customName || (componentDefs[compN.type] ? componentDefs[compN.type].name : ''); sourceType = compN.type; }
  } else if(node.data.attachedConnection) {
    var conn = connections.find(function(c) { return c.id === node.data.attachedConnection; });
    if(conn) {
      var sDir = node.data.sensorDirection || 'from';
      var srcN = nodes.find(function(n) { return n.id === (sDir === 'to' ? conn.to : conn.from); });
      if(srcN) { sourceName = srcN.customName || (componentDefs[srcN.type] ? componentDefs[srcN.type].name : ''); sourceType = srcN.type; }
    }
  }
  var sels = node.data.selectedSignals || [];
  if(sels.length > 0 && sourceName) {
    var signals = (COMPONENT_SIGNALS[sourceType] && COMPONENT_SIGNALS[sourceType].outputs) || [];
    if(sels.length === 1) {
      var sig = signals.find(function(s) { return s.id === sels[0]; });
      node.customName = sourceName + ' — ' + (sig ? sig.name : sels[0]);
    } else {
      node.customName = sourceName + ' (' + sels.length + ' sinyal)';
    }
    var labelEl = document.getElementById(node.id);
    if(labelEl) { var lbl = labelEl.querySelector('.ve-node-label'); if(lbl) lbl.textContent = node.customName; }
  }
}

function onVESensorDirectionChange(nodeId) {
  var node = nodes.find(function(n) { return n.id === nodeId; });
  if(!node) return;
  if(!node.data) node.data = {};
  var dirEl = document.getElementById('ve-sensor-direction-' + nodeId);
  if(dirEl) {
    node.data.sensorDirection = dirEl.value;
    // Sinyal seçimini sıfırla (yön değiştiğinde eski sinyal geçersiz olabilir)
    node.data.selectedSignal = '';
    // Properties panelini yeniden çiz
    showNodeProperties(node);
  }
}

// Sensörü bir bağlantının orta noktasına snap et
// Sensörü bağlantı orta noktasına yapıştır
function veAttachSensorToConnection(sensorNode, connId) {
  if(!sensorNode.data) sensorNode.data = {};
  sensorNode.data.attachedConnection = connId;
  sensorNode.data.attachedComponent = '';
  
  var conn = connections.find(function(c) { return c.id === connId; });
  if(conn) {
    conn.sensorId = sensorNode.id;
    
    // Otomatik ilk sinyal seçimi
    var dir = sensorNode.data.sensorDirection || 'from';
    var srcId = (dir === 'to') ? conn.to : conn.from;
    var srcNode = nodes.find(function(n) { return n.id === srcId; });
    if(srcNode && COMPONENT_SIGNALS[srcNode.type]) {
      var sigs = COMPONENT_SIGNALS[srcNode.type].outputs || [];
      if(sigs.length > 0 && !sensorNode.data.selectedSignal) {
        sensorNode.data.selectedSignal = sigs[0].id;
        var srcName = srcNode.customName || (componentDefs[srcNode.type] ? componentDefs[srcNode.type].name : '');
        sensorNode.customName = srcName + ' - ' + sigs[0].name;
      }
    }
  }
  
  showToast('Sensör bağlantıya eklendi');
}

// Sensörü doğrudan bir bileşene bağla (vehicle, road vb.)
function veAttachSensorToComponent(sensorNode, compId) {
  if(!sensorNode.data) sensorNode.data = {};
  sensorNode.data.attachedComponent = compId;
  sensorNode.data.attachedConnection = '';
  
  var compNode = nodes.find(function(n) { return n.id === compId; });
  var compName = compNode ? (compNode.customName || (componentDefs[compNode.type] ? componentDefs[compNode.type].name : '')) : '';
  
  // Otomatik ilk sinyal seçimi
  if(compNode && COMPONENT_SIGNALS[compNode.type]) {
    var sigs = COMPONENT_SIGNALS[compNode.type].outputs || [];
    if(sigs.length > 0 && !sensorNode.data.selectedSignal) {
      sensorNode.data.selectedSignal = sigs[0].id;
      sensorNode.customName = compName + ' - ' + sigs[0].name;
    }
  }
  
  showToast('Sensör bileşene bağlandı: ' + compName);
}

// Sensörü bağlantıdan/bileşenden ayır
function veDetachSensor(sensorNode) {
  if(!sensorNode.data) return;
  
  var oldConnId = sensorNode.data.attachedConnection;
  sensorNode.data.attachedConnection = '';
  sensorNode.data.attachedComponent = '';
  sensorNode.data.selectedSignal = '';
  
  if(oldConnId) {
    var conn = connections.find(function(c) { return c.id === oldConnId; });
    if(conn) delete conn.sensorId;
  }
}

// ===== SENARYOLAR BİLEŞENİ =====
function getScenarioPropertiesHTML(node) {
  var d = node.data || {};
  var throttle = d.throttle !== undefined ? d.throttle : 0;
  var brakeForce = d.brakeForce !== undefined ? d.brakeForce : 0;
  
  // Modüle göre izin verilen senaryolar
  var mod = veGetActiveModule();
  var allowedScenarios = mod.scenarios || ['coast','full_brake','full_throttle','partial_throttle','custom'];
  
  // Varsayılan senaryo: modülün default'u veya kayıtlı değer (izinli ise)
  var scenarioType = d.scenarioType || mod.defaultScenario || 'coast';
  if(allowedScenarios.indexOf(scenarioType) === -1) {
    scenarioType = allowedScenarios[0];
    if(!d.scenarioType) { if(!node.data) node.data = {}; node.data.scenarioType = scenarioType; }
  }
  
  var scenarioLabels = {
    coast: 'Boşta sürüş (Coast)',
    full_brake: 'Tam fren',
    partial_throttle: 'Kısmi gaz',
    full_throttle: 'Tam gaz',
    performance_analysis: 'Performans Analizi',
    custom: 'Özel'
  };
  
  var html = '<div style="border-top:1px solid var(--border-color); padding-top:12px;">';
  
  html += '<div style="font-size:0.8rem; font-weight:600; color:var(--text-heading); margin-bottom:8px;">Senaryo Parametreleri</div>';
  html += '<p style="font-size:0.58rem; color:var(--text-muted); margin-bottom:10px; line-height:1.3;">Sürüş senaryosunu tanımlayın. Bu bileşen topolojiye dahilse ilgili parametreler aktif olur.</p>';
  
  html += '<table style="width:100%; font-size:0.7rem; border-collapse:collapse; border:1px solid var(--border-color);">';
  
  // Senaryo tipi — sadece izin verilen seçenekler
  html += '<tr style="border-bottom:1px solid var(--border-color);"><th style="padding:7px; text-align:left; background:var(--bg-tertiary); border-right:1px solid var(--border-color); width:45%; font-weight:500; color:var(--text-secondary);">Senaryo tipi</th><td style="padding:7px; background:var(--bg-tertiary);"><select id="ve-scenario-type-' + node.id + '" onchange="onVEScenarioChange(\'' + node.id + '\')" style="width:100%; padding:4px; font-size:0.7rem; background:var(--bg-input); color:var(--text-primary); border:1px solid var(--border-color); border-radius:4px;">';
  allowedScenarios.forEach(function(sc) {
    html += '<option value="' + sc + '"' + (scenarioType === sc ? ' selected' : '') + '>' + (scenarioLabels[sc] || sc) + '</option>';
  });
  html += '</select></td></tr>';
  
  // Gaz pedal oranı
  var showThrottle = ['partial_throttle','full_throttle','custom'].indexOf(scenarioType) > -1;
  html += '<tr id="ve-scenario-throttle-row-' + node.id + '" style="border-bottom:1px solid var(--border-color);' + (!showThrottle?'display:none;':'') + '"><th style="padding:7px; text-align:left; background:var(--bg-tertiary); border-right:1px solid var(--border-color); font-weight:500; color:var(--text-secondary);">Gaz pedal oranı [%]</th><td style="padding:7px; background:var(--bg-tertiary);"><input type="number" id="ve-scenario-throttle-' + node.id + '" value="' + throttle + '" step="5" min="0" max="100" style="width:100%; padding:4px; font-size:0.7rem; background:var(--bg-input); color:var(--text-primary); border:1px solid var(--border-color); border-radius:4px; text-align:right;" onchange="onVEScenarioChange(\'' + node.id + '\')"></td></tr>';
  
  // Fren kuvveti
  var showBrake = scenarioType === 'full_brake' || scenarioType === 'custom';
  html += '<tr id="ve-scenario-brake-row-' + node.id + '" style="border-bottom:1px solid var(--border-color);' + (!showBrake?'display:none;':'') + '"><th style="padding:7px; text-align:left; background:var(--bg-tertiary); border-right:1px solid var(--border-color); font-weight:500; color:var(--text-secondary);">Fren kuvveti [N]</th><td style="padding:7px; background:var(--bg-tertiary);"><input type="number" id="ve-scenario-brake-' + node.id + '" value="' + brakeForce + '" step="100" min="0" style="width:100%; padding:4px; font-size:0.7rem; background:var(--bg-input); color:var(--text-primary); border:1px solid var(--border-color); border-radius:4px; text-align:right;" onchange="onVEScenarioChange(\'' + node.id + '\')"></td></tr>';
  
  html += '<tr><td colspan="2" style="padding:5px 8px; font-size:0.56rem; color:var(--text-muted); background:var(--bg-secondary); line-height:1.3;">Senaryo tipi seçimi simülasyon davranışını belirler.</td></tr>';
  
  html += '</table></div>';
  return html;
}

function onVEScenarioChange(nodeId) {
  var node = nodes.find(function(n) { return n.id === nodeId; });
  if(!node) return;
  if(!node.data) node.data = {};
  
  var el = function(id) { return document.getElementById(id); };
  var typeEl = el('ve-scenario-type-' + nodeId);
  if(typeEl) {
    node.data.scenarioType = typeEl.value;
    var t = typeEl.value;
    var thRow = el('ve-scenario-throttle-row-' + nodeId);
    var brRow = el('ve-scenario-brake-row-' + nodeId);
    if(thRow) thRow.style.display = ['partial_throttle','full_throttle','custom'].indexOf(t) > -1 ? '' : 'none';
    if(brRow) brRow.style.display = (t === 'full_brake' || t === 'custom') ? '' : 'none';
    // Tam gaz: otomatik 100%
    if(t === 'full_throttle') { var thEl = el('ve-scenario-throttle-' + nodeId); if(thEl) thEl.value = 100; node.data.throttle = 100; }
  }
  var thEl2 = el('ve-scenario-throttle-' + nodeId);
  var brEl = el('ve-scenario-brake-' + nodeId);
  if(thEl2) node.data.throttle = parseFloat(thEl2.value) || 0;
  if(brEl) node.data.brakeForce = parseFloat(brEl.value) || 0;
}

// ===== COAST-DOWN BİLEŞENİ =====
function getCoastDownPropertiesHTML(node) {
  var d = node.data || {};
  var method = d.cdMethod || 'manual';
  var crr = d.crr !== undefined ? d.crr : '';
  var v1 = d.v1 !== undefined ? d.v1 : '';
  var v2 = d.v2 !== undefined ? d.v2 : '';
  var t1 = d.t1 !== undefined ? d.t1 : '';
  var t2 = d.t2 !== undefined ? d.t2 : '';
  
  var html = '<div style="border-top:1px solid var(--border-color); padding-top:12px;">';
  
  html += '<div style="font-size:0.8rem; font-weight:600; color:var(--text-heading); margin-bottom:8px;">📉 Coast-Down Parametreleri</div>';
  html += '<p style="font-size:0.56rem; color:var(--text-muted); margin-bottom:10px; line-height:1.3;">Coast-Down test verilerinden yuvarlanma direnci katsayısı (Crr) hesaplanır. Bu değer Tekerlek bileşenine otomatik aktarılır.</p>';
  
  html += '<table style="width:100%; font-size:0.68rem; border-collapse:collapse; border:1px solid var(--border-color);">';
  
  // Yöntem seçimi
  html += '<tr style="border-bottom:1px solid var(--border-color);"><th style="padding:6px; text-align:left; background:var(--bg-tertiary); border-right:1px solid var(--border-color); width:45%; font-weight:500; color:var(--text-secondary);">Giriş yöntemi</th><td style="padding:6px; background:var(--bg-tertiary);"><select id="ve-cd-method-' + node.id + '" onchange="onVECoastDownChange(\'' + node.id + '\')" style="width:100%; padding:4px; font-size:0.68rem; background:var(--bg-input); color:var(--text-primary); border:1px solid var(--border-color); border-radius:4px;"><option value="manual"' + (method==='manual'?' selected':'') + '>Manuel Crr girişi</option><option value="test"' + (method==='test'?' selected':'') + '>Test verisinden hesapla</option></select></td></tr>';
  
  // Manuel Crr
  html += '<tr id="ve-cd-crr-row-' + node.id + '" style="border-bottom:1px solid var(--border-color);' + (method==='test'?'display:none;':'') + '"><th style="padding:6px; text-align:left; background:var(--bg-tertiary); border-right:1px solid var(--border-color); font-weight:500; color:var(--text-secondary);">Crr [-]</th><td style="padding:6px; background:var(--bg-tertiary);"><input type="number" id="ve-cd-crr-' + node.id + '" value="' + crr + '" step="0.001" min="0" placeholder="0.015" style="width:100%; padding:4px; font-size:0.68rem; background:var(--bg-input); color:var(--text-primary); border:1px solid var(--border-color); border-radius:4px; text-align:right;" onchange="onVECoastDownChange(\'' + node.id + '\')"></td></tr>';
  
  // Sihirbaz butonu - sadece test modunda
  html += '<tr id="ve-cd-wizard-row-' + node.id + '" style="' + (method!=='test'?'display:none;':'') + '"><td colspan="2" style="padding:8px 6px; background:var(--bg-tertiary);"><button onclick="veOpenCoastDownWizard(\'' + node.id + '\')" style="width:100%; padding:8px 10px; font-size:0.72rem; font-weight:600; background:linear-gradient(135deg, var(--accent-primary), #2563eb); color:white; border:none; border-radius:6px; cursor:pointer; display:flex; align-items:center; justify-content:center; gap:6px; transition:opacity 0.15s;" onmouseenter="this.style.opacity=\'0.85\'" onmouseleave="this.style.opacity=\'1\'">🧙 Sihirbazı Çalıştır</button></td></tr>';

  // Sonuç - sadece test modunda anlamlı
  html += '<tr id="ve-cd-result-row-' + node.id + '" style="border-bottom:1px solid var(--border-color);' + (method!=='test'?'display:none;':'') + '"><th style="padding:6px; text-align:left; background:var(--bg-tertiary); border-right:1px solid var(--border-color); font-weight:500; color:var(--text-secondary);">Hesaplanan Crr</th><td style="padding:6px; background:var(--bg-tertiary);"><span id="ve-cd-result-' + node.id + '" style="font-weight:600; color:var(--accent-primary);">' + (method==='test' && crr ? crr : '—') + '</span></td></tr>';
  
  html += '<tr><td colspan="2" style="padding:4px 6px; font-size:0.54rem; color:var(--text-muted); background:var(--bg-secondary); line-height:1.3;">⚡ Coast-Down modülü topolojiye dahilse, Tekerlek bileşenindeki Crr alanı otomatik doldurulur ve kilitlenir.</td></tr>';
  
  html += '</table></div>';
  return html;
}

function onVECoastDownChange(nodeId) {
  var node = nodes.find(function(n) { return n.id === nodeId; });
  if(!node) return;
  if(!node.data) node.data = {};
  
  var el = function(id) { return document.getElementById(id); };
  var methodEl = el('ve-cd-method-' + nodeId);
  if(methodEl) {
    node.data.cdMethod = methodEl.value;
    var crrRow = el('ve-cd-crr-row-' + nodeId);
    var wizardRow = el('ve-cd-wizard-row-' + nodeId);
    var resultRow = el('ve-cd-result-row-' + nodeId);
    if(crrRow) crrRow.style.display = methodEl.value === 'test' ? 'none' : '';
    if(wizardRow) wizardRow.style.display = methodEl.value === 'test' ? '' : 'none';
    if(resultRow) resultRow.style.display = methodEl.value === 'test' ? '' : 'none';
  }
  
  if(node.data.cdMethod !== 'test') {
    var crrEl = el('ve-cd-crr-' + nodeId);
    if(crrEl) node.data.crr = parseFloat(crrEl.value) || '';
    var resultEl = el('ve-cd-result-' + nodeId);
    if(resultEl) resultEl.textContent = '—';
  }
}

// ===== COAST-DOWN SİHİRBAZI =====
var _veCDWizardActive = null;

function veOpenCoastDownWizard(nodeId) {
  var node = nodes.find(function(n) { return n.id === nodeId; });
  if(!node) return;

  if(_veCDWizardActive) veCloseCoastDownWizard();

  // Topolojiden araç ve yol parametrelerini çek
  var vehicleNode = nodes.find(function(n) { return n.type === 'vehicle'; });
  var roadNode = nodes.find(function(n) { return n.type === 'road'; });
  var vd = vehicleNode ? (vehicleNode.data || {}) : {};
  var rd = roadNode ? (roadNode.data || {}) : {};

  var defMass = vd.mass || '';
  var defArea = vd.frontalArea || '';
  var defRho = rd.airDensity || '1.225';
  var defCd = vd.cd || '';

  // Overlay
  var overlay = document.createElement('div');
  overlay.id = 've-cd-wizard-overlay';
  overlay.style.cssText = 'position:fixed; inset:0; z-index:100000; background:rgba(0,0,0,0.82); display:flex; align-items:center; justify-content:center; padding:20px; backdrop-filter:blur(4px);';

  // Modal
  var modal = document.createElement('div');
  modal.style.cssText = 'width:100%; max-width:1100px; height:85vh; max-height:820px; background:var(--bg-secondary, #0f1218); border:1px solid var(--border-color, #1c2333); border-radius:4px; display:flex; flex-direction:column; overflow:hidden; box-shadow:0 20px 60px rgba(0,0,0,0.6);';

  // Header
  var header = document.createElement('div');
  header.style.cssText = 'display:flex; align-items:center; justify-content:space-between; padding:10px 16px; background:var(--bg-tertiary); border-bottom:1px solid var(--border-color); flex-shrink:0;';
  header.innerHTML = '<div style="display:flex; align-items:center; gap:8px;">' +
    '<div style="font-size:0.88rem; font-weight:700; color:var(--text-heading);">🧙 Coast-Down Test Sihirbazı</div>' +
    '<div style="font-size:0.62rem; color:var(--text-muted);">— Crr & Cd analizi</div></div>' +
    '<div style="display:flex; align-items:center; gap:8px;">' +
    '<button onclick="cdwLoadExample()" style="padding:5px 12px; font-size:0.7rem; font-weight:600; background:var(--bg-secondary); color:var(--text-secondary); border:1px solid var(--border-color); border-radius:4px; cursor:pointer; transition:all 0.12s;" onmouseover="this.style.background=\'var(--accent-primary)\';this.style.color=\'#fff\';this.style.borderColor=\'var(--accent-primary)\'" onmouseout="this.style.background=\'var(--bg-secondary)\';this.style.color=\'var(--text-secondary)\';this.style.borderColor=\'var(--border-color)\'">📋 Örnek Yükle</button>' +
    '<button onclick="veCloseCoastDownWizard()" title="Kapat (ESC)" style="width:30px; height:30px; display:flex; align-items:center; justify-content:center; background:transparent; border:1px solid var(--border-color); border-radius:4px; cursor:pointer; font-size:1rem; color:var(--text-secondary); transition:all 0.12s;" onmouseover="this.style.background=\'var(--accent-danger)\';this.style.color=\'#fff\';this.style.borderColor=\'var(--accent-danger)\'" onmouseout="this.style.background=\'transparent\';this.style.color=\'var(--text-secondary)\';this.style.borderColor=\'var(--border-color)\'">✕</button>' +
    '</div>';
  modal.appendChild(header);

  // Content area
  var content = document.createElement('div');
  content.id = 've-cd-wizard-content';
  content.style.cssText = 'flex:1; overflow:auto; position:relative; min-height:0; padding:18px 20px;';

  // === Section 1: Araç & Ortam Parametreleri ===
  var pRowStyle = 'border-bottom:1px solid var(--border-color);';
  var pThStyle = 'padding:4px 8px; font-size:0.68rem; font-weight:500; color:var(--text-secondary); text-align:left; white-space:nowrap; width:45%;';
  var pTdStyle = 'padding:4px 8px;';
  var pInpStyle = 'width:80px; padding:3px 6px; font-size:0.72rem; background:var(--bg-input); color:var(--text-primary); border:1px solid var(--border-color); border-radius:3px; text-align:right;';

  var paramHtml = '<div style="margin-bottom:14px; border:1px solid var(--border-color); border-radius:4px; overflow:hidden;">' +
    '<div style="padding:6px 12px; background:var(--bg-tertiary); border-bottom:1px solid var(--border-color);">' +
    '<div style="font-size:0.78rem; font-weight:700; color:var(--text-heading);">📐 Araç ve Ortam Parametreleri</div></div>' +
    '<div style="display:grid; grid-template-columns:1fr 1fr; ">' +

    // Sol sütun
    '<table style="border-collapse:collapse; font-size:0.68rem; border-right:1px solid var(--border-color);">' +
    '<tr style="' + pRowStyle + '"><th style="' + pThStyle + '">Araç kütlesi m</th><td style="' + pTdStyle + '"><input type="number" id="cdw-mass" value="' + defMass + '" step="1" placeholder="18000" style="' + pInpStyle + '"> <span style="font-size:0.6rem; color:var(--text-muted);">kg</span></td></tr>' +
    '<tr><th style="' + pThStyle + '">Frontal alan A</th><td style="' + pTdStyle + '"><input type="number" id="cdw-area" value="' + defArea + '" step="0.01" placeholder="7.8" style="' + pInpStyle + '"> <span style="font-size:0.6rem; color:var(--text-muted);">m²</span></td></tr>' +
    '</table>' +

    // Sağ sütun
    '<table style="border-collapse:collapse; font-size:0.68rem;">' +
    '<tr style="' + pRowStyle + '"><th style="' + pThStyle + '">Hava yoğunluğu ρ</th><td style="' + pTdStyle + '"><input type="number" id="cdw-rho" value="' + defRho + '" step="0.01" placeholder="1.225" style="' + pInpStyle + '"> <span style="font-size:0.6rem; color:var(--text-muted);">kg/m³</span></td></tr>' +
    '<tr><th style="' + pThStyle + '">CFD Cd</th><td style="' + pTdStyle + '"><input type="number" id="cdw-cd-input" value="' + defCd + '" step="0.001" placeholder="0.65" style="' + pInpStyle + '"> <span style="font-size:0.6rem; color:var(--text-muted);">[-]</span></td></tr>' +
    '</table>' +

    '</div></div>';

  // === Section 2: Test Veri Tablosu ===
  var thInp = 'padding:6px 5px; border-bottom:1px solid var(--border-color); color:var(--text-secondary); font-weight:600; font-size:0.78rem; text-align:center;';
  var thCalc = 'padding:6px 10px; border-bottom:1px solid var(--border-color); color:var(--text-muted); font-weight:500; font-size:0.76rem; text-align:center;';
  var u = ' <span style="font-weight:400; opacity:0.6;">';

  var tableHtml = '<div style="margin-bottom:14px; border:1px solid var(--border-color); border-radius:4px; overflow:hidden;">' +
    '<div style="padding:8px 12px; background:var(--bg-tertiary); border-bottom:1px solid var(--border-color); display:flex; align-items:center; justify-content:space-between;">' +
    '<div><div style="font-size:0.78rem; font-weight:700; color:var(--text-heading);">📉 Coast-Down Test Verileri</div>' +
    '<div style="font-size:0.62rem; color:var(--text-muted);">Her satır tek bir coast-down testi.</div></div>' +
    '<div style="display:flex; gap:6px;">' +
    '<button onclick="cdwAddRow()" style="padding:3px 10px; font-size:0.66rem; font-weight:600; background:var(--bg-secondary); color:var(--text-secondary); border:1px solid var(--border-color); border-radius:3px; cursor:pointer;">+ Satır</button>' +
    '<button onclick="cdwClearRows()" style="padding:3px 10px; font-size:0.66rem; font-weight:600; background:var(--bg-secondary); color:var(--text-secondary); border:1px solid var(--border-color); border-radius:3px; cursor:pointer;">🗑️ Sil</button>' +
    '</div></div>' +
    '<div style="overflow-x:auto; display:flex; justify-content:center; padding:4px 0;">' +
    '<table style="border-collapse:collapse;">' +
    '<thead><tr style="background:var(--bg-tertiary);">' +
    '<th style="padding:6px 2px; border-bottom:1px solid var(--border-color); width:22px;"></th>' +
    '<th style="' + thInp + '">v₁' + u + 'km/h</span></th>' +
    '<th style="' + thInp + '">v₂' + u + 'km/h</span></th>' +
    '<th style="' + thInp + '">Δt' + u + 's</span></th>' +
    '<th style="' + thInp + '">z₁' + u + 'm</span></th>' +
    '<th style="' + thInp + '">z₂' + u + 'm</span></th>' +
    '<th style="' + thInp + '">Δx' + u + 'm</span></th>' +
    '<th style="' + thCalc + '">v<sub>ort</sub>' + u + 'km/h</span></th>' +
    '<th style="' + thCalc + '">a' + u + 'm/s²</span></th>' +
    '<th style="' + thCalc + '">Eğim' + u + '%</span></th>' +
    '<th style="' + thCalc + ' color:#4ade80;">Crr</th>' +
    '</tr></thead>' +
    '<tbody id="cdw-data-body"></tbody>' +
    '</table></div>' +
    '<div style="display:flex; gap:6px; padding:6px 12px; justify-content:flex-end; border-top:1px solid var(--border-color);">' +
    '<button onclick="cdwComputeCrr()" style="padding:5px 14px; font-size:0.7rem; font-weight:700; background:#1b5e20; color:white; border:none; border-radius:3px; cursor:pointer;">▶ Crr Hesapla</button>' +
    '</div></div>';

  // === Section 3: Özet Sonuçlar ===
  var summaryHtml = '<div style="margin-bottom:14px; border:1px solid var(--border-color); border-radius:4px; overflow:hidden;">' +
    '<div style="padding:8px 12px; background:var(--bg-tertiary); border-bottom:1px solid var(--border-color);">' +
    '<div style="font-size:0.82rem; font-weight:700; color:var(--text-heading);">📊 Crr Sonuçları</div>' +
    '<div style="font-size:0.62rem; color:var(--text-muted);">CFD Cd sabit kabul edilerek, tüm test verilerinden Crr hesaplanır.</div></div>' +
    '<div style="padding:10px 12px;">' +

    '<div style="display:grid; grid-template-columns:1fr 1fr; gap:4px 24px; font-size:0.72rem; color:var(--text-secondary); margin-bottom:8px;">' +
    '<div style="display:flex; justify-content:space-between; padding:3px 0; border-bottom:1px dotted var(--border-color);"><span>Ortalama Crr:</span><span id="cdw-crr-mean" style="font-weight:700; color:var(--text-primary);">—</span></div>' +
    '<div style="display:flex; justify-content:space-between; padding:3px 0; border-bottom:1px dotted var(--border-color);"><span>Kullanılan Cd (CFD):</span><span id="cdw-used-cd" style="font-weight:700; color:var(--text-primary);">—</span></div>' +
    '<div style="display:flex; justify-content:space-between; padding:3px 0; border-bottom:1px dotted var(--border-color);"><span>Std sapma:</span><span id="cdw-crr-std">—</span></div>' +
    '<div style="display:flex; justify-content:space-between; padding:3px 0; border-bottom:1px dotted var(--border-color);"><span>Kullanılan satır:</span><span id="cdw-crr-count">0</span></div>' +
    '<div style="display:flex; justify-content:space-between; padding:3px 0; border-bottom:1px dotted var(--border-color);"><span>Min / Maks:</span><span id="cdw-crr-minmax">—</span></div>' +
    '<div style="display:flex; justify-content:space-between; padding:3px 0; border-bottom:1px dotted var(--border-color);"><span>R²:</span><span id="cdw-crr-r2" style="font-weight:700; color:var(--text-primary);">—</span></div>' +
    '<div style="display:flex; justify-content:space-between; padding:3px 0;"><span>RMS hata [m/s²]:</span><span id="cdw-crr-rms">—</span></div>' +
    '</div>' +
    '<div id="cdw-crr-hint" style="font-size:0.62rem; color:var(--text-muted); padding-top:5px; border-top:1px dashed var(--border-color);">CFD Cd değerini girin ve "Crr Hesapla" basın.</div>' +

    '</div></div>';

  // === Sonucu Aktar butonu ===
  var applyHtml = '<div style="display:flex; gap:10px; justify-content:flex-end; align-items:center; margin-bottom:8px;">' +
    '<span style="font-size:0.64rem; color:var(--text-muted);">Crr → Tekerlek, CFD Cd → Araç bileşenine aktarılır</span>' +
    '<button onclick="cdwApplyResults(\'' + nodeId + '\')" style="padding:7px 20px; font-size:0.76rem; font-weight:700; background:#16a34a; color:white; border:none; border-radius:4px; cursor:pointer;">✅ Sonuçları Bileşene Aktar</button>' +
    '</div>';

  var footerNote = '<div style="font-size:0.6rem; color:var(--text-muted); border-top:1px dashed var(--border-color); padding-top:8px;">⚠️ Basitleştirilmiş coast-down modeli. Çok düşük hızlar, kısa süreler veya ölçüm hataları sonuçları etkileyebilir.</div>';

  content.innerHTML = paramHtml + tableHtml + summaryHtml + applyHtml + footerNote;
  modal.appendChild(content);

  // Footer
  var footer = document.createElement('div');
  footer.style.cssText = 'display:flex; align-items:center; gap:10px; padding:6px 16px; background:var(--bg-tertiary); border-top:1px solid var(--border-color); flex-shrink:0; font-size:0.66rem; color:var(--text-muted);';
  footer.innerHTML = '<span>g = 9.81 m/s² sabit</span><span style="opacity:0.3;">│</span><span>Coast-Down Crr & Cd Analizi</span><span style="margin-left:auto; color:var(--text-secondary);">ESC — Kapat</span>';
  modal.appendChild(footer);

  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  _veCDWizardActive = nodeId;

  // Başlangıçta 5 boş satır ekle
  for(var i = 0; i < 5; i++) cdwAddRow();

  // ESC handler
  overlay._veEscHandler = function(e) { if(e.key === 'Escape') veCloseCoastDownWizard(); };
  document.addEventListener('keydown', overlay._veEscHandler);

  // Overlay tıklama ile kapat
  overlay.addEventListener('mousedown', function(e) { if(e.target === overlay) veCloseCoastDownWizard(); });
}

function veCloseCoastDownWizard() {
  var overlay = document.getElementById('ve-cd-wizard-overlay');
  if(!overlay) return;
  if(overlay._veEscHandler) document.removeEventListener('keydown', overlay._veEscHandler);
  overlay.remove();
  _veCDWizardActive = null;
}

// --- Sihirbaz: Satır ekleme / silme ---
function cdwAddRow() {
  var tbody = document.getElementById('cdw-data-body');
  if(!tbody) return;
  var tr = document.createElement('tr');
  var rowIdx = tbody.children.length;
  var bgColor = rowIdx % 2 === 0 ? '' : 'background:var(--bg-tertiary);';
  tr.style.cssText = 'border-bottom:1px solid var(--border-color);' + bgColor;
  var inpStyle = 'width:84px; padding:5px 6px; font-size:0.78rem; background:var(--bg-input); color:var(--text-primary); border:1px solid var(--border-color); border-radius:3px; text-align:right;';
  var spanStyle = 'font-size:0.76rem; color:var(--text-muted);';
  var tdInp = 'padding:4px 3px; text-align:center;';
  var tdCalc = 'padding:4px 10px; text-align:center;';
  tr.innerHTML = '<td style="padding:4px 3px; text-align:center; width:22px;"><button onclick="this.closest(\'tr\').remove()" style="background:none; border:none; color:var(--accent-danger); cursor:pointer; font-size:0.7rem; padding:0; opacity:0.4;" onmouseover="this.style.opacity=\'1\'" onmouseout="this.style.opacity=\'0.4\'">✕</button></td>' +
    '<td style="' + tdInp + '"><input type="number" step="0.1" class="cdw-v1" style="' + inpStyle + '"></td>' +
    '<td style="' + tdInp + '"><input type="number" step="0.1" class="cdw-v2" style="' + inpStyle + '"></td>' +
    '<td style="' + tdInp + '"><input type="number" step="0.01" class="cdw-dt" style="' + inpStyle + '"></td>' +
    '<td style="' + tdInp + '"><input type="number" step="0.01" class="cdw-z1" style="' + inpStyle + '"></td>' +
    '<td style="' + tdInp + '"><input type="number" step="0.01" class="cdw-z2" style="' + inpStyle + '"></td>' +
    '<td style="' + tdInp + '"><input type="number" step="0.01" class="cdw-dx" style="' + inpStyle + '"></td>' +
    '<td style="' + tdCalc + '"><span class="cdw-vavg" style="' + spanStyle + '"></span></td>' +
    '<td style="' + tdCalc + '"><span class="cdw-acc" style="' + spanStyle + '"></span></td>' +
    '<td style="' + tdCalc + '"><span class="cdw-grade" style="' + spanStyle + '"></span></td>' +
    '<td style="' + tdCalc + '"><span class="cdw-crr" style="font-size:0.76rem; font-weight:700; color:#4ade80;"></span></td>';
  tbody.appendChild(tr);
}

function cdwClearRows() {
  var tbody = document.getElementById('cdw-data-body');
  if(tbody) tbody.innerHTML = '';
  cdwResetSummaries();
}

function cdwResetSummaries() {
  var ids = ['cdw-crr-mean','cdw-crr-std','cdw-crr-minmax','cdw-crr-rms','cdw-crr-r2','cdw-used-cd'];
  ids.forEach(function(id) { var el = document.getElementById(id); if(el) el.textContent = '—'; });
  var countIds = ['cdw-crr-count'];
  countIds.forEach(function(id) { var el = document.getElementById(id); if(el) el.textContent = '0'; });
  var hintEl = document.getElementById('cdw-crr-hint'); if(hintEl) hintEl.textContent = 'CFD Cd değerini girin ve "Crr Hesapla" basın.';
}

// --- Sihirbaz: İstatistik yardımcıları ---
function cdwMean(arr) {
  if(!arr.length) return NaN;
  var s = 0; for(var i=0; i<arr.length; i++) s += arr[i];
  return s / arr.length;
}
function cdwStd(arr, m) {
  if(!arr.length) return NaN;
  var meanVal = isFinite(m) ? m : cdwMean(arr);
  var v = 0; for(var i=0; i<arr.length; i++) v += Math.pow(arr[i] - meanVal, 2);
  return Math.sqrt(v / arr.length);
}

// --- Sihirbaz: Crr hesabı (CFD Cd sabit, tüm satırlardan) ---
// Model: m·a = -m·g·Crr - ½·ρ·A·Cd·v² - m·g·sinθ
// Crr_i = -a/g - grade - (½·ρ·A·Cd·v²)/(m·g)
function cdwComputeCrr() {
  var mass = parseFloat(document.getElementById('cdw-mass').value);
  var area = parseFloat(document.getElementById('cdw-area').value);
  var rho = parseFloat(document.getElementById('cdw-rho').value) || 1.225;
  var g = 9.81;
  var cdCFD = parseFloat(document.getElementById('cdw-cd-input').value);

  var rows = Array.from(document.querySelectorAll('#cdw-data-body tr'));

  // Tüm hücreleri temizle
  rows.forEach(function(row) {
    var el = function(cls) { return row.querySelector('.' + cls); };
    if(el('cdw-vavg')) el('cdw-vavg').textContent = '';
    if(el('cdw-acc')) el('cdw-acc').textContent = '';
    if(el('cdw-grade')) el('cdw-grade').textContent = '';
    if(el('cdw-crr')) el('cdw-crr').textContent = '';
  });

  cdwResetSummaries();

  if(!mass || !area) {
    document.getElementById('cdw-crr-hint').textContent = 'Araç kütlesi ve frontal alan girilmeden hesap yapılamaz.';
    return;
  }
  if(!isFinite(cdCFD)) {
    document.getElementById('cdw-crr-hint').textContent = 'CFD Cd değeri girilmeden Crr hesaplanamaz.';
    return;
  }

  var k = 0.5 * rho * area / mass;
  var crrValues = [];
  var aObsArr = [];     // gözlenen ivme
  var gradeArr = [];    // eğim
  var vavgArr = [];     // ortalama hız [m/s]

  rows.forEach(function(row) {
    var v1 = parseFloat(row.querySelector('.cdw-v1').value);
    var v2 = parseFloat(row.querySelector('.cdw-v2').value);
    var dt = parseFloat(row.querySelector('.cdw-dt').value);
    var z1 = parseFloat(row.querySelector('.cdw-z1').value);
    var z2 = parseFloat(row.querySelector('.cdw-z2').value);
    var dx = parseFloat(row.querySelector('.cdw-dx').value);

    if(!isFinite(v1) || !isFinite(v2) || !isFinite(dt) || dt <= 0 || !isFinite(dx) || dx === 0) return;

    var v1_ms = v1 / 3.6;
    var v2_ms = v2 / 3.6;
    var vavg_ms = (v1_ms + v2_ms) / 2;
    var vavg_kmh = vavg_ms * 3.6;
    var a = (v2_ms - v1_ms) / dt;
    var grade = (isFinite(z1) && isFinite(z2)) ? (z2 - z1) / dx : 0;

    // Ara değerleri tabloya yaz
    var vavgEl = row.querySelector('.cdw-vavg'); if(vavgEl) vavgEl.textContent = vavg_kmh.toFixed(2);
    var accEl = row.querySelector('.cdw-acc'); if(accEl) accEl.textContent = a.toFixed(4);
    var gradeEl = row.querySelector('.cdw-grade'); if(gradeEl) gradeEl.textContent = (grade * 100).toFixed(3);

    // Crr hesapla: aero düzeltmeli
    var aeroTerm = k * cdCFD * vavg_ms * vavg_ms / g;
    var crr = -a / g - grade - aeroTerm;

    if(isFinite(crr)) {
      crrValues.push(crr);
      aObsArr.push(a);
      gradeArr.push(grade);
      vavgArr.push(vavg_ms);
      var crrEl = row.querySelector('.cdw-crr'); if(crrEl) crrEl.textContent = crr.toFixed(5);
    }
  });

  // Özet
  if(crrValues.length > 0) {
    var crrMean = cdwMean(crrValues);
    var crrStd_ = cdwStd(crrValues, crrMean);
    var crrMin = Math.min.apply(null, crrValues);
    var crrMax = Math.max.apply(null, crrValues);

    document.getElementById('cdw-crr-mean').textContent = crrMean.toFixed(5);
    document.getElementById('cdw-crr-std').textContent = crrStd_.toFixed(5);
    document.getElementById('cdw-crr-minmax').textContent = crrMin.toFixed(5) + ' / ' + crrMax.toFixed(5);
    document.getElementById('cdw-crr-count').textContent = String(crrValues.length);
    document.getElementById('cdw-used-cd').textContent = cdCFD.toFixed(4);

    // R² ve RMS: gözlenen ivme vs model ivmesi üzerinden
    // a_model_i = -g·Crr_mean - g·grade_i - k·Cd·vavg_i²
    var n = crrValues.length;
    var aMean = cdwMean(aObsArr);
    var ssTot = 0, ssRes = 0;
    for(var i = 0; i < n; i++) {
      var a_model = -g * crrMean - g * gradeArr[i] - k * cdCFD * vavgArr[i] * vavgArr[i];
      ssTot += (aObsArr[i] - aMean) * (aObsArr[i] - aMean);
      ssRes += (aObsArr[i] - a_model) * (aObsArr[i] - a_model);
    }
    var rms = Math.sqrt(ssRes / n);
    var r2 = (ssTot > 0) ? (1 - ssRes / ssTot) : 0;

    document.getElementById('cdw-crr-rms').textContent = rms.toFixed(6);
    document.getElementById('cdw-crr-r2').textContent = r2.toFixed(5);

    document.getElementById('cdw-crr-hint').textContent = 'Crr hesaplandı. CFD Cd=' + cdCFD.toFixed(4) + ' ile aero düzeltme uygulandı. ' + crrValues.length + ' satır, R²=' + r2.toFixed(4);
  } else {
    document.getElementById('cdw-crr-hint').textContent = 'Geçerli veri bulunamadı.';
  }
}

// --- Sihirbaz: Örnek veri yükle ---
function cdwLoadExample() {
  var massEl=document.getElementById('cdw-mass');
  var areaEl=document.getElementById('cdw-area');
  var rhoEl=document.getElementById('cdw-rho');
  var cdEl=document.getElementById('cdw-cd-input');

  if(massEl) massEl.value=18000;
  if(areaEl) areaEl.value=7.8;
  if(rhoEl) rhoEl.value=1.225;
  if(cdEl) cdEl.value=0.65;

  var tbody=document.getElementById('cdw-data-body');
  if(tbody) tbody.innerHTML='';
  cdwResetSummaries();

  var samples=[
    {v1:40.0, v2:21.38, dt:22, z1:237, z2:235, dx:166.0},
    {v1:31.44, v2:22.0, dt:12, z1:235, z2:234, dx:84.2},
    {v1:50.0, v2:21.0, dt:29, z1:228, z2:226, dx:-275.5},
    {v1:60.0, v2:22.0, dt:30, z1:241, z2:244, dx:-331.0},
    {v1:72.0, v2:42.31, dt:50, z1:235, z2:226, dx:758.2},
    {v1:50.0, v2:20.0, dt:43, z1:66, z2:64, dx:423.3},
    {v1:42.0, v2:20.0, dt:42, z1:73, z2:69, dx:396.0}
  ];

  samples.forEach(function(s) {
    cdwAddRow();
    var row=tbody.lastElementChild;
    row.querySelector('.cdw-v1').value=s.v1;
    row.querySelector('.cdw-v2').value=s.v2;
    row.querySelector('.cdw-dt').value=s.dt;
    row.querySelector('.cdw-z1').value=s.z1;
    row.querySelector('.cdw-z2').value=s.z2;
    row.querySelector('.cdw-dx').value=s.dx;
  });

  cdwComputeCrr();
}

// --- Sihirbaz: Sonuçları coast-down bileşenine aktar ---
function cdwApplyResults(nodeId) {
  var node = nodes.find(function(n) { return n.id === nodeId; });
  if(!node) return;
  if(!node.data) node.data = {};

  var meanCrr = parseFloat((document.getElementById('cdw-crr-mean') || {}).textContent);

  if(!isFinite(meanCrr)) {
    showToast('Aktarılacak Crr değeri bulunamadı. Önce hesaplama yapın.', 'warning');
    return;
  }

  // Crr → Coast-Down bileşenine aktar
  node.data.crr = parseFloat(meanCrr.toFixed(5));
  node.data.cdMethod = 'test';

  var crrEl = document.getElementById('ve-cd-crr-' + nodeId);
  if(crrEl) crrEl.value = meanCrr.toFixed(5);
  var resultEl = document.getElementById('ve-cd-result-' + nodeId);
  if(resultEl) resultEl.textContent = meanCrr.toFixed(5);

  // CFD Cd → Vehicle bileşenine otomatik aktar
  var cdCFD = parseFloat(document.getElementById('cdw-cd-input').value);
  var vehicleNode = nodes.find(function(n) { return n.type === 'vehicle'; });
  var cdTransferred = false;
  if(isFinite(cdCFD) && vehicleNode) {
    if(!vehicleNode.data) vehicleNode.data = {};
    vehicleNode.data.cd = cdCFD;
    cdTransferred = true;
    // Eğer Vehicle properties açıksa input'u güncelle
    var vCdEl = document.getElementById('ve-vehicle-cd-' + vehicleNode.id);
    if(vCdEl) vCdEl.value = cdCFD;
  }

  var msg = 'Crr = ' + meanCrr.toFixed(5) + ' aktarıldı';
  if(cdTransferred) msg += ' · Cd = ' + cdCFD.toFixed(4) + ' → Araç bileşenine aktarıldı';
  showToast(msg, 'success');
  veCloseCoastDownWizard();
}

// ===== UYARI PANELİ =====
function veToggleWarnings() {
  var body = document.getElementById('ve-warnings-body');
  var toggle = document.getElementById('ve-warnings-toggle');
  if(body) {
    body.classList.toggle('collapsed');
    if(toggle) toggle.textContent = body.classList.contains('collapsed') ? '▼' : '▲';
  }
}

function veUpdateWarnings() {
  var warnings = [];
  if(nodes.length === 0) { /* Boş topoloji - uyarı yok */ }
  else {
    var hasEngine = nodes.some(function(n) { return n.type === 'engine' || n.type === 'engine-brake'; });
    var hasGearbox = nodes.some(function(n) { return n.type === 'gearbox'; });
    var hasWheel = nodes.some(function(n) { return n.type === 'wheel'; });
    var hasVehicle = nodes.some(function(n) { return n.type === 'vehicle'; });
    var hasSolver = nodes.some(function(n) { return n.type === 'solver'; });
    var hasRoad = nodes.some(function(n) { return n.type === 'road'; });
    var hasDiff = nodes.some(function(n) { return n.type === 'differential'; });
    var hasTerminator = nodes.some(function(n) { return n.type === 'terminator'; });
    
    // Sonlandırıcıya bağlı node'ları bul
    var terminatedNodeIds = {};
    nodes.forEach(function(n) {
      if(n.type === 'terminator') {
        connections.forEach(function(c) {
          if(c.to === n.id) terminatedNodeIds[c.from] = true;
        });
      }
    });
    
    // Elzem bileşen uyarıları - sonlandırıcı varsa kısmi model uyarıları gösterme
    if(!hasTerminator) {
      if(hasEngine && !hasGearbox && !hasWheel) warnings.push({type:'info', msg:'Motor eklendi. Şanzıman ve Tekerlek ekleyerek güç zinciri kurun.'});
      if(hasEngine && hasGearbox && !hasWheel) warnings.push({type:'warn', msg:'Tekerlek bileşeni eksik.'});
      if(hasWheel && !hasEngine) warnings.push({type:'warn', msg:'Motor bileşeni eksik.'});
      if(!hasVehicle && nodes.length >= 3) warnings.push({type:'info', msg:'Araç bileşeni önerilir (kütle, Cd, alan parametreleri için).'});
      if(!hasSolver && nodes.length >= 3) warnings.push({type:'info', msg:'Çözücü bileşeni eklenmemiş.'});
      if(!hasRoad && nodes.length >= 4) warnings.push({type:'info', msg:'Yol/Ortam bileşeni önerilir.'});
    } else {
      if(!hasEngine) warnings.push({type:'warn', msg:'Motor bileşeni eksik.'});
      warnings.push({type:'info', msg:'✂️ Sonlandırıcı aktif — kısmi analiz modu.'});
    }
    
    // Bağlantı uyarıları - aktarma bileşenleri bağlantısız olmamalı
    var driveTypes = ['engine','engine-brake','gearbox','transfer','differential','torque-converter','wheel'];
    nodes.forEach(function(n) {
      if(driveTypes.indexOf(n.type) === -1) return;
      var def = componentDefs[n.type];
      var hasIn = connections.some(function(c) { return c.to === n.id; });
      var hasOut = connections.some(function(c) { return c.from === n.id; });
      var name = n.customName || (def ? def.name : n.type);
      
      if(def && def.inputs > 0 && !hasIn) {
        warnings.push({type:'warn', msg: name + ': giriş portu bağlanmamış'});
      }
      // Çıkış portu: sonlandırıcıya bağlıysa uyarı verme
      if(def && def.outputs > 0 && !hasOut && !terminatedNodeIds[n.id]) {
        warnings.push({type:'warn', msg: name + ': çıkış portu bağlanmamış'});
      }
    });
  }
  
  // Uyarı panelini güncelle
  var body = document.getElementById('ve-warnings-body');
  var countEl = document.getElementById('ve-warnings-count');
  
  if(countEl) {
    countEl.textContent = warnings.length;
    countEl.style.background = warnings.some(function(w){return w.type==='error';}) ? 'var(--accent-danger)' : (warnings.length > 0 ? 'var(--accent-warning)' : 'var(--accent-success)');
    countEl.style.color = warnings.length > 0 ? '#000' : '#fff';
  }
  
  if(body) {
    if(warnings.length === 0) {
      body.innerHTML = '<div style="padding:10px 14px;font-size:0.75rem;color:var(--accent-success);">✅ Uyarı yok. Topoloji hazır görünüyor.</div>';
    } else {
      body.innerHTML = warnings.map(function(w) {
        var icon = w.type === 'error' ? '🔴' : (w.type === 'warn' ? '🟡' : '🔵');
        return '<div class="ve-warning-item ' + w.type + '">' + icon + ' <span>' + w.msg + '</span></div>';
      }).join('');
    }
  }
}

// Bileşen eklendiğinde/silindiğinde uyarıları güncelle
var _origUpdateNodeCount = typeof updateNodeCount === 'function' ? updateNodeCount : function(){};
updateNodeCount = function() {
  _origUpdateNodeCount();
  veUpdateWarnings();
};

function getWheelPropertiesHTML(node) {
  var nodeData = node.data || {};
  var isFullThrottle = veActiveModule === 'full-throttle';
  
  if(isFullThrottle) {
    // ── TAM GAZ HIZLANMA: Master/Slave kontrolü ──
    var wheelNodes = nodes.filter(function(n) { return n.type === 'wheel'; });
    var hasMaster = wheelNodes.some(function(n) { return n.isMasterWheel; });
    if(!hasMaster && wheelNodes.length > 0) {
      wheelNodes[0].isMasterWheel = true;
      var firstEl = document.getElementById(wheelNodes[0].id);
      if(firstEl && !firstEl.querySelector('.ve-wheel-master-badge')) {
        var badge = document.createElement('div');
        badge.className = 've-wheel-master-badge';
        badge.title = 'Master Tekerlek';
        badge.textContent = '★';
        var box = firstEl.querySelector('.ve-node-box');
        if(box) box.appendChild(badge);
      }
    }
    var isMaster = node.isMasterWheel || false;
    var masterNode = isMaster ? node : wheelNodes.find(function(n) { return n.isMasterWheel; });
    
    // Slave tekerlek: sadece görsel
    if(!isMaster) {
      var html = '<div style="border-top:1px solid var(--border-color); padding-top:12px;">';
      html += '<div style="font-size:0.8rem; font-weight:600; color:var(--text-heading); margin-bottom:8px; display:flex; align-items:center; gap:6px;">';
      html += '<span>Tekerlek Verileri</span>';
      html += '<span style="background:var(--bg-tertiary); color:var(--text-muted); font-size:0.55rem; font-weight:600; padding:1px 5px; border-radius:8px; border:1px solid var(--border-color);">SLAVE</span>';
      html += '</div>';
      html += '<div style="background:var(--bg-tertiary); border-radius:6px; padding:10px; font-size:0.65rem; color:var(--text-muted); line-height:1.5;">';
      html += 'Bu tekerlek görsel amaçlıdır. Tüm parametreler Master tekerlek' + (masterNode ? ' (' + (masterNode.customName || 'Tekerlek') + ')' : '') + ' üzerinden tanımlanır.';
      html += '</div>';
      html += '</div>';
      return html;
    }
    
    // ── TAM GAZ HIZLANMA: Tekerlek Parametreleri (Master) ──
    var ftTireName = nodeData.ftTireName || 'Michelin XZL 395/85R20';
    var ftTireRadius = nodeData.ftTireRadius !== undefined ? nodeData.ftTireRadius : 0.573;
    var ftTireCount = nodes.filter(function(n) { return n.type === 'wheel'; }).length;
    var ftTireInertia = nodeData.ftTireInertia !== undefined ? nodeData.ftTireInertia : 56.0;
    var ftCrr = nodeData.ftCrr !== undefined ? nodeData.ftCrr : 0.0035;
    var ftSurfaceFactor = nodeData.ftSurfaceFactor !== undefined ? nodeData.ftSurfaceFactor : 1.00;
    var revPerKm = ftTireRadius > 0 ? (1000 / (2 * Math.PI * ftTireRadius)).toFixed(1) : '—';
    
    var html = '<div style="border-top:1px solid var(--border-color); padding-top:12px;">';
    
    html += '<div style="font-size:0.8rem; font-weight:600; color:var(--text-heading); margin-bottom:8px; display:flex; align-items:center; gap:6px;">';
    html += '<span>Tekerlek Verileri</span>';
    html += '<span style="background:#f59e0b; color:#000; font-size:0.55rem; font-weight:700; padding:1px 5px; border-radius:8px;">★ MASTER</span>';
    html += '<button onclick="showInfoPopup(\'tekerlek\')" style="width:18px; height:18px; border-radius:50%; background:var(--accent-primary); color:white; border:none; cursor:pointer; font-size:0.65rem; display:flex; align-items:center; justify-content:center; margin-left:auto;" title="Bilgi">?</button>';
    html += '</div>';
    
    html += '<div style="background:var(--bg-tertiary); border-radius:8px; padding:10px;">';
    html += '<div style="font-size:0.75rem; font-weight:600; color:var(--text-heading); margin-bottom:8px;">Tekerlek Parametreleri</div>';
    
    // Lastik Preset Seçici
    var ftTirePresetId = nodeData.ftTirePreset || '';
    html += '<div style="display:flex; gap:6px; margin-bottom:8px; align-items:center;">';
    html += '<select id="ve-ft-tire-preset-' + node.id + '" onchange="onVEFTTirePresetChange(\'' + node.id + '\', this.value)" style="flex:1; font-size:0.68rem; padding:4px 6px; background:var(--bg-input); color:var(--text-primary); border:1px solid var(--border-color); border-radius:4px;">';
    html += veBuildTirePresetOptions(ftTirePresetId);
    html += '</select>';
    html += '</div>';
    
    html += '<table style="width:100%; font-size:0.68rem; border-collapse:collapse; border:1px solid var(--border-color);">';
    
    // Yuvarlanma Yarıçapı
    html += '<tr style="border-bottom:1px solid var(--border-color);">';
    html += '<th style="padding:6px 8px; text-align:left; background:var(--bg-tertiary); border-right:1px solid var(--border-color); font-weight:500; color:var(--text-secondary);">Yuvarlanma Yarıçapı <span style="color:var(--text-muted); font-weight:400;">[m]</span></th>';
    html += '<td style="padding:4px 6px; background:var(--bg-tertiary);"><input type="number" id="ve-ftwh-radius-' + node.id + '" value="' + ftTireRadius + '" step="0.001" min="0.1" max="2" style="width:100%; padding:4px; font-size:0.68rem; background:var(--bg-input); color:var(--text-primary); border:1px solid var(--border-color); border-radius:3px; text-align:right;" onchange="onVEFTWheelParamChange(\'' + node.id + '\')"></td>';
    html += '</tr>';
    
    // rev/km (readonly)
    var roStyle = 'width:100%; padding:4px; font-size:0.68rem; background:var(--bg-secondary); color:var(--text-secondary); border:1px solid var(--border-color); border-radius:3px; text-align:right; cursor:default;';
    html += '<tr style="border-bottom:1px solid var(--border-color);">';
    html += '<th style="padding:6px 8px; text-align:left; background:var(--bg-tertiary); border-right:1px solid var(--border-color); font-weight:500; color:var(--text-secondary);">rev/km</th>';
    html += '<td style="padding:4px 6px; background:var(--bg-tertiary);"><input type="text" id="ve-ftwh-revkm-' + node.id + '" value="' + revPerKm + '" readonly style="' + roStyle + '" tabindex="-1"></td>';
    html += '</tr>';
    
    // Tekerlek Sayısı (readonly, topolojiden sayılır)
    html += '<tr style="border-bottom:1px solid var(--border-color);">';
    html += '<th style="padding:6px 8px; text-align:left; background:var(--bg-tertiary); border-right:1px solid var(--border-color); font-weight:500; color:var(--text-secondary);">Tekerlek Sayısı</th>';
    html += '<td style="padding:4px 6px; background:var(--bg-tertiary);"><input type="text" id="ve-ftwh-count-' + node.id + '" value="' + ftTireCount + '" readonly style="' + roStyle + '" tabindex="-1"></td>';
    html += '</tr>';
    
    // Toplam Lastik/Jant Ataleti
    html += '<tr style="border-bottom:1px solid var(--border-color);">';
    html += '<th style="padding:6px 8px; text-align:left; background:var(--bg-tertiary); border-right:1px solid var(--border-color); font-weight:500; color:var(--text-secondary);">Toplam Lastik/Jant Ataleti <span style="color:var(--text-muted); font-weight:400;">[kg·m²]</span></th>';
    html += '<td style="padding:4px 6px; background:var(--bg-tertiary);"><input type="number" id="ve-ftwh-inertia-' + node.id + '" value="' + ftTireInertia + '" step="0.01" min="0" style="width:100%; padding:4px; font-size:0.68rem; background:var(--bg-input); color:var(--text-primary); border:1px solid var(--border-color); border-radius:3px; text-align:right;" onchange="onVEFTWheelParamChange(\'' + node.id + '\')"></td>';
    html += '</tr>';
    
    // Yuvarlanma Direnci Katsayısı
    html += '<tr style="border-bottom:1px solid var(--border-color);">';
    html += '<th style="padding:6px 8px; text-align:left; background:var(--bg-tertiary); border-right:1px solid var(--border-color); font-weight:500; color:var(--text-secondary);">Yuvarlanma Direnci Katsayısı <span style="color:var(--text-muted); font-weight:400;">(Crr)</span></th>';
    html += '<td style="padding:4px 6px; background:var(--bg-tertiary);"><input type="number" id="ve-ftwh-crr-' + node.id + '" value="' + ftCrr + '" step="0.001" min="0.001" max="0.1" style="width:100%; padding:4px; font-size:0.68rem; background:var(--bg-input); color:var(--text-primary); border:1px solid var(--border-color); border-radius:3px; text-align:right;" onchange="onVEFTWheelParamChange(\'' + node.id + '\')"></td>';
    html += '</tr>';
    html += '<tr><td colspan="2" style="padding:4px 8px; font-size:0.52rem; color:var(--text-muted); background:var(--bg-secondary); line-height:1.4;"><span style="color:var(--accent-primary);">ℹ</span> Yuvarlanma direnci hızla birlikte otomatik olarak artırılır (iSCAAN evrensel düzeltme modeli: 80 km/h\'de ~%50 artış).</td></tr>';
    
    // Yüzey Faktörü
    html += '<tr>';
    html += '<th style="padding:6px 8px; text-align:left; background:var(--bg-tertiary); border-right:1px solid var(--border-color); font-weight:500; color:var(--text-secondary);">Yüzey Faktörü</th>';
    html += '<td style="padding:4px 6px; background:var(--bg-tertiary);"><input type="number" id="ve-ftwh-surface-' + node.id + '" value="' + ftSurfaceFactor + '" step="0.01" min="0.5" max="3" style="width:100%; padding:4px; font-size:0.68rem; background:var(--bg-input); color:var(--text-primary); border:1px solid var(--border-color); border-radius:3px; text-align:right;" onchange="onVEFTWheelParamChange(\'' + node.id + '\')"></td>';
    html += '</tr>';
    
    html += '</table>';
    html += '</div>';
    html += '</div>';
    return html;
  }
  
  // ── MOTOR FRENİ / DİĞER MODÜLLER: Mevcut panel ──
  
  // Master tekerlek kontrolü: eğer master yoksa veya silinmişse, ilk tekerleği master yap
  var wheelNodes = nodes.filter(function(n) { return n.type === 'wheel'; });
  var hasMaster = wheelNodes.some(function(n) { return n.isMasterWheel; });
  if(!hasMaster && wheelNodes.length > 0) {
    wheelNodes[0].isMasterWheel = true;
    // Badge ekle
    var firstEl = document.getElementById(wheelNodes[0].id);
    if(firstEl && !firstEl.querySelector('.ve-wheel-master-badge')) {
      var badge = document.createElement('div');
      badge.className = 've-wheel-master-badge';
      badge.title = 'Master Tekerlek — diğer tekerlekleri kontrol eder';
      badge.textContent = '★';
      firstEl.querySelector('.ve-node-box').appendChild(badge);
    }
  }
  
  var isMaster = node.isMasterWheel || false;
  var masterNode = isMaster ? node : wheelNodes.find(function(n) { return n.isMasterWheel; });
  
  // Slave tekerlek → master'ın değerlerini oku
  if(!isMaster && masterNode && masterNode.data) {
    nodeData = masterNode.data;
  }
  
  var html = '<div style="border-top:1px solid var(--border-color); padding-top:12px;">';
  
  // Slave tekerlek: sadece görsel, veri girdisi yok
  if(!isMaster) {
    html += '<div style="font-size:0.8rem; font-weight:600; color:var(--text-heading); margin-bottom:8px; display:flex; align-items:center; gap:6px;">';
    html += '<span>Tekerlek Parametreleri</span>';
    html += '<span style="background:var(--bg-tertiary); color:var(--text-muted); font-size:0.55rem; font-weight:600; padding:1px 5px; border-radius:8px; border:1px solid var(--border-color);">SLAVE</span>';
    html += '</div>';
    html += '<div style="background:var(--bg-tertiary); border-radius:6px; padding:10px; font-size:0.65rem; color:var(--text-muted); line-height:1.5;">';
    html += 'Bu tekerlek görsel amaçlıdır. Tüm parametreler Master tekerlek' + (masterNode ? ' (' + (masterNode.customName || 'Tekerlek') + ')' : '') + ' üzerinden tanımlanır.';
    html += '</div>';
    html += '</div>';
    return html;
  }
  
  var wheelRadius = nodeData.wheelRadius !== undefined ? nodeData.wheelRadius : 0.60876;
  var rollingResistance = nodeData.rollingResistance !== undefined ? nodeData.rollingResistance : 0.010;
  var rotatingMass = nodeData.rotatingMass !== undefined ? nodeData.rotatingMass : 1.08;
  
  var html = '<div style="border-top:1px solid var(--border-color); padding-top:12px;">';
  
  // Başlık
  html += '<div style="font-size:0.8rem; font-weight:600; color:var(--text-heading); margin-bottom:8px; display:flex; align-items:center; gap:6px;">';
  html += '<span>Tekerlek Parametreleri</span>';
  html += '<span style="background:#f59e0b; color:#000; font-size:0.55rem; font-weight:700; padding:1px 5px; border-radius:8px;">★ MASTER</span>';
  html += '<button onclick="showInfoPopup(\'tekerlek\')" style="width:18px; height:18px; border-radius:50%; background:var(--accent-primary); color:white; border:none; cursor:pointer; font-size:0.65rem; display:flex; align-items:center; justify-content:center; margin-left:auto;" title="Bilgi">?</button>';
  html += '</div>';
  
  // Lastik Preset Seçici
  var mfTirePresetId = nodeData.tirePreset || '';
  html += '<div style="display:flex; gap:6px; margin-bottom:8px; align-items:center;">';
  html += '<select id="ve-tire-preset-' + node.id + '" onchange="onVETirePresetChange(\'' + node.id + '\', this.value)" style="flex:1; font-size:0.68rem; padding:4px 6px; background:var(--bg-input); color:var(--text-primary); border:1px solid var(--border-color); border-radius:4px;">';
  html += veBuildTirePresetOptions(mfTirePresetId);
  html += '</select>';
  html += '</div>';
  
  // Tablo
  html += '<table style="width:100%; font-size:0.7rem; border-collapse:collapse; border:1px solid var(--border-color);">';
  
  // Tekerlek yarıçapı
  html += '<tr style="border-bottom:1px solid var(--border-color);">';
  html += '<th style="padding:8px; text-align:left; background:var(--bg-tertiary); border-right:1px solid var(--border-color); width:60%; font-weight:500; color:var(--text-secondary);">Tekerlek yarıçapı [m]</th>';
  html += '<td style="padding:8px; background:var(--bg-tertiary);"><input type="number" id="ve-wheel-radius-' + node.id + '" value="' + wheelRadius + '" step="0.00001" min="0.1" max="2" style="width:100%; padding:5px; font-size:0.7rem; background:var(--bg-input); color:var(--text-primary); border:1px solid var(--border-color); border-radius:4px; text-align:right;" onchange="onVEWheelParamChange(\'' + node.id + '\')"></td>';
  html += '</tr>';
  
  html += '<tr style="border-bottom:1px solid var(--border-color);">';
  html += '<td colspan="2" style="padding:6px 8px; font-size:0.65rem; color:var(--text-secondary); background:var(--bg-secondary); line-height:1.4;">Dinamik tekerlek yarıçapı. Lastik boyutundan hesaplanır veya ölçülür.</td>';
  html += '</tr>';
  
  // Yuvarlanma direnci - Coast-Down modülü varsa kilitli
  var hasCoastDown = nodes.some(function(n) { return n.type === 'coast-down'; });
  var cdNode = nodes.find(function(n) { return n.type === 'coast-down'; });
  var cdCrr = (cdNode && cdNode.data && cdNode.data.crr) ? cdNode.data.crr : null;
  var crrValue = hasCoastDown && cdCrr ? cdCrr : rollingResistance;
  var crrLocked = hasCoastDown && cdCrr;
  
  html += '<tr style="border-bottom:1px solid var(--border-color);">';
  html += '<th style="padding:8px; text-align:left; background:var(--bg-tertiary); border-right:1px solid var(--border-color); font-weight:500; color:var(--text-secondary);">Yuvarlanma direnci Crr [-]' + (crrLocked ? ' 🔒' : '') + '</th>';
  html += '<td style="padding:8px; background:var(--bg-tertiary);"><input type="number" id="ve-wheel-crr-' + node.id + '" value="' + crrValue + '" step="0.001" min="0.001" max="0.1" ' + (crrLocked ? 'readonly' : '') + ' style="width:100%; padding:5px; font-size:0.7rem; background:' + (crrLocked ? 'var(--bg-secondary)' : 'var(--bg-input)') + '; color:' + (crrLocked ? 'var(--accent-primary)' : 'var(--text-primary)') + '; border:1px solid var(--border-color); border-radius:4px; text-align:right;' + (crrLocked ? ' cursor:not-allowed; font-weight:600;' : '') + '" onchange="onVEWheelParamChange(\'' + node.id + '\')"></td>';
  html += '</tr>';
  
  html += '<tr style="border-bottom:1px solid var(--border-color);">';
  if(crrLocked) {
    html += '<td colspan="2" style="padding:6px 8px; font-size:0.65rem; color:var(--accent-primary); background:var(--bg-secondary); line-height:1.4;">🔗 Coast-Down modülünden alınıyor (Crr = ' + cdCrr + ')</td>';
  } else {
    html += '<td colspan="2" style="padding:6px 8px; font-size:0.65rem; color:var(--text-secondary); background:var(--bg-secondary); line-height:1.4;">Yuvarlanma direnci katsayısı. Tipik: Asfalt 0.008–0.012, Arazi 0.02–0.05.</td>';
  }
  html += '</tr>';
  html += '<tr><td colspan="2" style="padding:4px 8px; font-size:0.52rem; color:var(--text-muted); background:var(--bg-secondary); line-height:1.4;"><span style="color:var(--accent-primary);">ℹ</span> Yuvarlanma direnci hızla birlikte otomatik olarak artırılır (iSCAAN evrensel düzeltme modeli: 80 km/h\'de ~%50 artış).</td></tr>';
  
  // Döner kütle faktörü
  html += '<tr style="border-bottom:1px solid var(--border-color);">';
  html += '<th style="padding:8px; text-align:left; background:var(--bg-tertiary); border-right:1px solid var(--border-color); font-weight:500; color:var(--text-secondary);">Döner kütle faktörü δ [-]</th>';
  html += '<td style="padding:8px; background:var(--bg-tertiary);"><input type="number" id="ve-wheel-delta-' + node.id + '" value="' + rotatingMass + '" step="0.01" min="1" max="1.5" style="width:100%; padding:5px; font-size:0.7rem; background:var(--bg-input); color:var(--text-primary); border:1px solid var(--border-color); border-radius:4px; text-align:right;" onchange="onVEWheelParamChange(\'' + node.id + '\')"></td>';
  html += '</tr>';
  
  html += '<tr>';
  html += '<td colspan="2" style="padding:6px 8px; font-size:0.65rem; color:var(--text-secondary); background:var(--bg-secondary); line-height:1.4;">Dönen parçaların (tekerlek, şaft, motor) etkili kütle artışı. Tipik: 1.05–1.15.</td>';
  html += '</tr>';
  
  html += '</table>';
  html += '</div>';
  return html;
}

function onVEWheelParamChange(nodeId) {
  var node = nodes.find(function(n) { return n.id === nodeId; });
  if(!node) return;
  if(!node.data) node.data = {};
  
  var radiusEl = document.getElementById('ve-wheel-radius-' + nodeId);
  var crrEl = document.getElementById('ve-wheel-crr-' + nodeId);
  var deltaEl = document.getElementById('ve-wheel-delta-' + nodeId);
  
  if(radiusEl) node.data.wheelRadius = parseFloat(radiusEl.value) || 0.60876;
  if(crrEl) node.data.rollingResistance = parseFloat(crrEl.value) || 0.010;
  if(deltaEl) node.data.rotatingMass = parseFloat(deltaEl.value) || 1.08;
  
  // Master tekerlek → diğer tekerlekleri senkronize et
  if(node.isMasterWheel) {
    var otherWheels = nodes.filter(function(n) { return n.type === 'wheel' && n.id !== nodeId; });
    otherWheels.forEach(function(w) {
      if(!w.data) w.data = {};
      w.data.wheelRadius = node.data.wheelRadius;
      w.data.rollingResistance = node.data.rollingResistance;
      w.data.rotatingMass = node.data.rotatingMass;
    });
    if(otherWheels.length > 0) {
      showToast('Master tekerlek: ' + otherWheels.length + ' tekerlek senkronize edildi', 'info');
    }
  }
}

function onVEFTWheelParamChange(nodeId) {
  var node = nodes.find(function(n) { return n.id === nodeId; });
  if(!node) return;
  if(!node.data) node.data = {};
  
  var nameEl = document.getElementById('ve-ftwh-tirename-' + nodeId);
  var radiusEl = document.getElementById('ve-ftwh-radius-' + nodeId);
  var inertiaEl = document.getElementById('ve-ftwh-inertia-' + nodeId);
  var crrEl = document.getElementById('ve-ftwh-crr-' + nodeId);
  var surfaceEl = document.getElementById('ve-ftwh-surface-' + nodeId);
  
  if(nameEl) node.data.ftTireName = nameEl.value || 'Michelin XZL 395/85R20';
  if(radiusEl) node.data.ftTireRadius = parseFloat(radiusEl.value) || 0.573;
  if(inertiaEl) node.data.ftTireInertia = parseFloat(inertiaEl.value) || 56.0;
  if(crrEl) node.data.ftCrr = parseFloat(crrEl.value) || 0.0035;
  if(surfaceEl) node.data.ftSurfaceFactor = parseFloat(surfaceEl.value) || 1.00;
  
  // rev/km güncelle
  var r = node.data.ftTireRadius;
  var revKmEl = document.getElementById('ve-ftwh-revkm-' + nodeId);
  if(revKmEl && r > 0) revKmEl.value = (1000 / (2 * Math.PI * r)).toFixed(1);
}

// ═══════════════════════════════════════════════════════════════
// VPA TEKERLEk/LASTİK KATALOG PRESETLERİ (28 lastik)
// ═══════════════════════════════════════════════════════════════
var VE_TIRE_PRESETS = [
  { id:'205_75r175',  name:'205/75 R17,5',  radius:0.370, inertia:3.50,  group:'R17.5', usage:'Hafif Ticari / Dağıtım' },
  { id:'215_75r175',  name:'215/75 R17,5',  radius:0.379, inertia:3.90,  group:'R17.5', usage:'Hafif Ticari / Dağıtım' },
  { id:'225_75r175',  name:'225/75 R17,5',  radius:0.385, inertia:4.00,  group:'R17.5', usage:'Hafif Ticari / Dağıtım' },
  { id:'235_75r175',  name:'235/75 R17,5',  radius:0.393, inertia:4.50,  group:'R17.5', usage:'Hafif Ticari / Dağıtım' },
  { id:'245_70r175',  name:'245/70 R17,5',  radius:0.389, inertia:5.20,  group:'R17.5', usage:'Hafif Ticari / Dağıtım' },
  { id:'245_70r195',  name:'245/70 R19,5',  radius:0.412, inertia:6.00,  group:'R19.5', usage:'Orta Ticari / Bölgesel' },
  { id:'265_70r195',  name:'265/70 R19,5',  radius:0.423, inertia:6.50,  group:'R19.5', usage:'Orta Ticari / Bölgesel' },
  { id:'285_70r195',  name:'285/70 R19,5',  radius:0.435, inertia:7.90,  group:'R19.5', usage:'Orta Ticari / Bölgesel' },
  { id:'305_70r195',  name:'305/70 R19,5',  radius:0.450, inertia:9.20,  group:'R19.5', usage:'Orta Ticari / Bölgesel' },
  { id:'335_80r20',   name:'335/80 R20',    radius:0.494, inertia:15.84, group:'R20',   usage:'Ağır Ticari / Uzun Yol' },
  { id:'365_80r20',   name:'365/80 R20',    radius:0.521, inertia:21.00, group:'R20',   usage:'Ağır Askeri / Özel' },
  { id:'1200_r20',    name:'12,00 R20',     radius:0.547, inertia:19.50, group:'R20',   usage:'Ağır Askeri / Özel' },
  { id:'365_85r20',   name:'365/85 R20',    radius:0.552, inertia:22.50, group:'R20',   usage:'Ağır Askeri / Özel' },
  { id:'395_85r20',   name:'395/85 R20',    radius:0.574, inertia:27.90, group:'R20',   usage:'Ekstra Ağır / Arazi' },
  { id:'1400_r20',    name:'14,00 R20',     radius:0.604, inertia:30.80, group:'R20',   usage:'Ekstra Ağır / Arazi' },
  { id:'1600_r20',    name:'16,00 R20',     radius:0.645, inertia:35.00, group:'R20',   usage:'Ekstra Ağır / Arazi' },
  { id:'295_60r225',  name:'295/60 R22,5',  radius:0.448, inertia:10.80, group:'R22.5', usage:'Orta Ticari / Bölgesel' },
  { id:'315_60r225',  name:'315/60 R22,5',  radius:0.463, inertia:12.80, group:'R22.5', usage:'Orta Ticari / Bölgesel' },
  { id:'275_70r225',  name:'275/70 R22,5',  radius:0.469, inertia:11.90, group:'R22.5', usage:'Orta Ticari / Bölgesel' },
  { id:'385_55r225',  name:'385/55 R22,5',  radius:0.484, inertia:15.90, group:'R22.5', usage:'Ağır Ticari / Uzun Yol' },
  { id:'305_70r225',  name:'305/70 R22,5',  radius:0.493, inertia:13.90, group:'R22.5', usage:'Ağır Ticari / Uzun Yol' },
  { id:'315_70r225',  name:'315/70 R22,5',  radius:0.499, inertia:14.90, group:'R22.5', usage:'Ağır Ticari / Uzun Yol' },
  { id:'385_65r225',  name:'385/65 R22,5',  radius:0.519, inertia:19.20, group:'R22.5', usage:'Ağır Ticari / Uzun Yol' },
  { id:'295_80r225',  name:'295/80 R22,5',  radius:0.519, inertia:15.50, group:'R22.5', usage:'Ağır Ticari / Uzun Yol' },
  { id:'315_80r225',  name:'315/80 R22,5',  radius:0.531, inertia:17.60, group:'R22.5', usage:'Ağır Askeri / Özel' },
  { id:'12_r225',     name:'12 R22,5',      radius:0.532, inertia:16.85, group:'R22.5', usage:'Ağır Askeri / Özel' },
  { id:'13_r225',     name:'13 R22,5',      radius:0.550, inertia:20.00, group:'R22.5', usage:'Ağır Askeri / Özel' },
  { id:'1200_r24',    name:'12,00 R24',     radius:0.596, inertia:27.70, group:'R24',   usage:'Ekstra Ağır / Arazi' }
];

// Lastik preset seçici HTML'i oluştur (optgroup ile jant çapına göre gruplu)
function veBuildTirePresetOptions(selectedId) {
  var html = '<option value="">-- Lastik Seçiniz (' + VE_TIRE_PRESETS.length + ' preset) --</option>';
  var groups = ['R17.5','R19.5','R20','R22.5','R24'];
  groups.forEach(function(grp) {
    var tires = VE_TIRE_PRESETS.filter(function(t) { return t.group === grp; });
    if(tires.length === 0) return;
    html += '<optgroup label="' + grp + ' Jant (' + tires.length + ')">';
    tires.forEach(function(t) {
      var sel = (t.id === selectedId) ? ' selected' : '';
      html += '<option value="' + t.id + '"' + sel + '>' + t.name + ' — r=' + t.radius + 'm, I=' + t.inertia + 'kg·m²</option>';
    });
    html += '</optgroup>';
  });
  return html;
}

// Tam Gaz Hızlanma — Lastik preset değişimi
function onVEFTTirePresetChange(nodeId, value) {
  if(!value) return;
  var preset = VE_TIRE_PRESETS.find(function(t) { return t.id === value; });
  if(!preset) return;
  
  var node = nodes.find(function(n) { return n.id === nodeId; });
  if(!node) return;
  if(!node.data) node.data = {};
  node.data.ftTirePreset = value;
  node.data.ftTireName = preset.name;
  node.data.ftTireRadius = preset.radius;
  node.data.ftTireInertia = preset.inertia;
  
  // Toplam atalet: tek lastik ataleti × tekerlek sayısı
  var wheelCount = nodes.filter(function(n) { return n.type === 'wheel'; }).length;
  var totalInertia = preset.inertia * (wheelCount > 0 ? wheelCount : 4);
  node.data.ftTireInertia = totalInertia;
  
  // UI güncelle
  var nameEl = document.getElementById('ve-ftwh-tirename-' + nodeId);
  var radiusEl = document.getElementById('ve-ftwh-radius-' + nodeId);
  var inertiaEl = document.getElementById('ve-ftwh-inertia-' + nodeId);
  var revKmEl = document.getElementById('ve-ftwh-revkm-' + nodeId);
  
  if(nameEl) nameEl.value = preset.name;
  if(radiusEl) radiusEl.value = preset.radius;
  if(inertiaEl) inertiaEl.value = totalInertia;
  if(revKmEl && preset.radius > 0) revKmEl.value = (1000 / (2 * Math.PI * preset.radius)).toFixed(1);
  
  showToast('Lastik yüklendi: ' + preset.name + ' (r=' + preset.radius + 'm, I=' + preset.inertia + '×' + (wheelCount||4) + '=' + totalInertia.toFixed(1) + ' kg·m²)', 'success');
}

// Motor Freni — Lastik preset değişimi
function onVETirePresetChange(nodeId, value) {
  if(!value) return;
  var preset = VE_TIRE_PRESETS.find(function(t) { return t.id === value; });
  if(!preset) return;
  
  var node = nodes.find(function(n) { return n.id === nodeId; });
  if(!node) return;
  if(!node.data) node.data = {};
  node.data.tirePreset = value;
  node.data.wheelRadius = preset.radius;
  
  // UI güncelle
  var radiusEl = document.getElementById('ve-wheel-radius-' + nodeId);
  if(radiusEl) radiusEl.value = preset.radius;
  
  // Master tekerlek → diğer tekerlekleri senkronize et
  if(node.isMasterWheel) {
    var otherWheels = nodes.filter(function(n) { return n.type === 'wheel' && n.id !== nodeId; });
    otherWheels.forEach(function(w) {
      if(!w.data) w.data = {};
      w.data.wheelRadius = preset.radius;
      w.data.tirePreset = value;
    });
  }
  
  showToast('Lastik yüklendi: ' + preset.name + ' (r=' + preset.radius + 'm)', 'success');
}

// Araç özellikleri - Klasik arayüzdeki tüm parametreler
function getVehiclePropertiesHTML(node) {
  var d = node.data || {};
  var isFullThrottle = veActiveModule === 'full-throttle';
  
  if(isFullThrottle) {
    // ── TAM GAZ HIZLANMA: Araç Parametreleri ──
    var ftVehName = d.ftVehName || 'BMC 4x4 2.5T';
    var ftGVW = d.ftGVW !== undefined ? d.ftGVW : 14900;
    var ftDrivenWeight = d.ftDrivenWeight !== undefined ? d.ftDrivenWeight : 100;
    var ftHeight = d.ftHeight !== undefined ? d.ftHeight : 3.200;
    var ftWidth = d.ftWidth !== undefined ? d.ftWidth : 2.500;
    var ftCd = d.ftCd !== undefined ? d.ftCd : 0.900;
    var ftRho = d.ftRho !== undefined ? d.ftRho : 1.225;
    var ftGrade = d.ftGrade !== undefined ? d.ftGrade : 0.0;
    
    var ftA = ftHeight * ftWidth;
    var ftCdA = ftCd * ftA;
    var ftGradeAngle = Math.atan(ftGrade / 100) * 180 / Math.PI;
    
    var roStyle = 'width:100%; padding:4px; font-size:0.68rem; background:var(--bg-secondary); color:var(--text-secondary); border:1px solid var(--border-color); border-radius:3px; text-align:right; cursor:default;';
    
    var html = '<div style="border-top:1px solid var(--border-color); padding-top:12px;">';
    
    html += '<div style="font-size:0.8rem; font-weight:600; color:var(--text-heading); margin-bottom:8px; display:flex; align-items:center; gap:6px;">';
    html += '<span>Araç Verileri</span>';
    html += '</div>';
    
    // ── 1. ARAÇ PARAMETRELERİ ──
    html += '<div style="background:var(--bg-tertiary); border-radius:8px; padding:10px;">';
    html += '<div style="font-size:0.75rem; font-weight:600; color:var(--text-heading); margin-bottom:8px;">Araç Parametreleri</div>';
    html += '<table style="width:100%; font-size:0.68rem; border-collapse:collapse; border:1px solid var(--border-color);">';
    
    html += '<tr style="border-bottom:1px solid var(--border-color);">';
    html += '<th style="padding:6px 8px; text-align:left; background:var(--bg-tertiary); border-right:1px solid var(--border-color); width:45%; font-weight:500; color:var(--text-secondary);">Araç Adı</th>';
    html += '<td style="padding:4px 6px; background:var(--bg-tertiary);"><input type="text" id="ve-ftv-name-' + node.id + '" value="' + ftVehName + '" style="width:100%; padding:4px; font-size:0.68rem; background:var(--bg-input); color:var(--text-primary); border:1px solid var(--border-color); border-radius:3px;" onchange="onVEFTVehicleParamChange(\'' + node.id + '\')"></td>';
    html += '</tr>';
    
    html += '<tr style="border-bottom:1px solid var(--border-color);">';
    html += '<th style="padding:6px 8px; text-align:left; background:var(--bg-tertiary); border-right:1px solid var(--border-color); font-weight:500; color:var(--text-secondary);">Toplam Kütle (GVW) <span style="color:var(--text-muted); font-weight:400;">[kg]</span></th>';
    html += '<td style="padding:4px 6px; background:var(--bg-tertiary);"><input type="number" id="ve-ftv-gvw-' + node.id + '" value="' + ftGVW + '" step="100" min="100" style="width:100%; padding:4px; font-size:0.68rem; background:var(--bg-input); color:var(--text-primary); border:1px solid var(--border-color); border-radius:3px; text-align:right;" onchange="onVEFTVehicleParamChange(\'' + node.id + '\')"></td>';
    html += '</tr>';
    
    html += '<tr>';
    html += '<th style="padding:6px 8px; text-align:left; background:var(--bg-tertiary); border-right:1px solid var(--border-color); font-weight:500; color:var(--text-secondary);">Tahrikli Tekerleklerdeki Ağırlık <span style="color:var(--text-muted); font-weight:400;">[%]</span></th>';
    html += '<td style="padding:4px 6px; background:var(--bg-tertiary);"><input type="number" id="ve-ftv-driven-' + node.id + '" value="' + ftDrivenWeight + '" step="1" min="0" max="100" style="width:100%; padding:4px; font-size:0.68rem; background:var(--bg-input); color:var(--text-primary); border:1px solid var(--border-color); border-radius:3px; text-align:right;" onchange="onVEFTVehicleParamChange(\'' + node.id + '\')"></td>';
    html += '</tr>';
    
    html += '</table>';
    html += '</div>';
    
    // ── 2. AERODİNAMİK PARAMETRELERİ ──
    html += '<div style="background:var(--bg-tertiary); border-radius:8px; padding:10px; margin-top:10px;">';
    html += '<div style="font-size:0.75rem; font-weight:600; color:var(--text-heading); margin-bottom:8px;">Aerodinamik Parametreleri</div>';
    html += '<table style="width:100%; font-size:0.68rem; border-collapse:collapse; border:1px solid var(--border-color);">';
    
    html += '<tr style="border-bottom:1px solid var(--border-color);">';
    html += '<th style="padding:6px 8px; text-align:left; background:var(--bg-tertiary); border-right:1px solid var(--border-color); width:45%; font-weight:500; color:var(--text-secondary);">Yükseklik <span style="color:var(--text-muted); font-weight:400;">[m]</span></th>';
    html += '<td style="padding:4px 6px; background:var(--bg-tertiary);"><input type="number" id="ve-ftv-height-' + node.id + '" value="' + ftHeight + '" step="0.001" min="0.1" style="width:100%; padding:4px; font-size:0.68rem; background:var(--bg-input); color:var(--text-primary); border:1px solid var(--border-color); border-radius:3px; text-align:right;" onchange="onVEFTVehicleParamChange(\'' + node.id + '\')"></td>';
    html += '</tr>';
    
    html += '<tr style="border-bottom:1px solid var(--border-color);">';
    html += '<th style="padding:6px 8px; text-align:left; background:var(--bg-tertiary); border-right:1px solid var(--border-color); font-weight:500; color:var(--text-secondary);">Genişlik <span style="color:var(--text-muted); font-weight:400;">[m]</span></th>';
    html += '<td style="padding:4px 6px; background:var(--bg-tertiary);"><input type="number" id="ve-ftv-width-' + node.id + '" value="' + ftWidth + '" step="0.001" min="0.1" style="width:100%; padding:4px; font-size:0.68rem; background:var(--bg-input); color:var(--text-primary); border:1px solid var(--border-color); border-radius:3px; text-align:right;" onchange="onVEFTVehicleParamChange(\'' + node.id + '\')"></td>';
    html += '</tr>';
    
    html += '<tr style="border-bottom:1px solid var(--border-color);">';
    html += '<th style="padding:6px 8px; text-align:left; background:var(--bg-tertiary); border-right:1px solid var(--border-color); font-weight:500; color:var(--text-secondary);">Alın Alanı (A) <span style="color:var(--text-muted); font-weight:400;">[m²]</span></th>';
    html += '<td style="padding:4px 6px; background:var(--bg-tertiary);"><input type="text" id="ve-ftv-area-' + node.id + '" value="' + ftA.toFixed(3) + '" readonly style="' + roStyle + '" tabindex="-1"></td>';
    html += '</tr>';
    
    html += '<tr style="border-bottom:1px solid var(--border-color);">';
    html += '<th style="padding:6px 8px; text-align:left; background:var(--bg-tertiary); border-right:1px solid var(--border-color); font-weight:500; color:var(--text-secondary);">Cd <span style="color:var(--text-muted); font-weight:400;">(Aerodinamik Sürtünme Katsayısı)</span></th>';
    html += '<td style="padding:4px 6px; background:var(--bg-tertiary);"><input type="number" id="ve-ftv-cd-' + node.id + '" value="' + ftCd + '" step="0.001" min="0" max="2" style="width:100%; padding:4px; font-size:0.68rem; background:var(--bg-input); color:var(--text-primary); border:1px solid var(--border-color); border-radius:3px; text-align:right;" onchange="onVEFTVehicleParamChange(\'' + node.id + '\')"></td>';
    html += '</tr>';
    
    html += '<tr style="border-bottom:1px solid var(--border-color);">';
    html += '<th style="padding:6px 8px; text-align:left; background:var(--bg-tertiary); border-right:1px solid var(--border-color); font-weight:500; color:var(--text-secondary);">CdA <span style="color:var(--text-muted); font-weight:400;">[m²]</span></th>';
    html += '<td style="padding:4px 6px; background:var(--bg-tertiary);"><input type="text" id="ve-ftv-cda-' + node.id + '" value="' + ftCdA.toFixed(3) + '" readonly style="' + roStyle + '" tabindex="-1"></td>';
    html += '</tr>';
    
    html += '<tr>';
    html += '<th style="padding:6px 8px; text-align:left; background:var(--bg-tertiary); border-right:1px solid var(--border-color); font-weight:500; color:var(--text-secondary);">Hava Yoğunluğu (ρ) <span style="color:var(--text-muted); font-weight:400;">[kg/m³]</span></th>';
    html += '<td style="padding:4px 6px; background:var(--bg-tertiary);"><input type="number" id="ve-ftv-rho-' + node.id + '" value="' + ftRho + '" step="0.001" min="0.1" style="width:100%; padding:4px; font-size:0.68rem; background:var(--bg-input); color:var(--text-primary); border:1px solid var(--border-color); border-radius:3px; text-align:right;" onchange="onVEFTVehicleParamChange(\'' + node.id + '\')"></td>';
    html += '</tr>';
    
    html += '</table>';
    html += '</div>';
    
    // ── 3. YOL KOŞULLARI ──
    html += '<div style="background:var(--bg-tertiary); border-radius:8px; padding:10px; margin-top:10px;">';
    html += '<div style="font-size:0.75rem; font-weight:600; color:var(--text-heading); margin-bottom:8px;">Yol Koşulları</div>';
    html += '<table style="width:100%; font-size:0.68rem; border-collapse:collapse; border:1px solid var(--border-color);">';
    
    html += '<tr style="border-bottom:1px solid var(--border-color);">';
    html += '<th style="padding:6px 8px; text-align:left; background:var(--bg-tertiary); border-right:1px solid var(--border-color); width:45%; font-weight:500; color:var(--text-secondary);">Yol Eğimi <span style="color:var(--text-muted); font-weight:400;">[%]</span></th>';
    html += '<td style="padding:4px 6px; background:var(--bg-tertiary);"><input type="number" id="ve-ftv-grade-' + node.id + '" value="' + ftGrade + '" step="0.1" style="width:100%; padding:4px; font-size:0.68rem; background:var(--bg-input); color:var(--text-primary); border:1px solid var(--border-color); border-radius:3px; text-align:right;" onchange="onVEFTVehicleParamChange(\'' + node.id + '\')"></td>';
    html += '</tr>';
    
    html += '<tr style="border-bottom:1px solid var(--border-color);">';
    html += '<th style="padding:6px 8px; text-align:left; background:var(--bg-tertiary); border-right:1px solid var(--border-color); font-weight:500; color:var(--text-secondary);">Eğim Açısı <span style="color:var(--text-muted); font-weight:400;">[°]</span></th>';
    html += '<td style="padding:4px 6px; background:var(--bg-tertiary);"><input type="text" id="ve-ftv-grade-angle-' + node.id + '" value="' + ftGradeAngle.toFixed(2) + '" readonly style="' + roStyle + '" tabindex="-1"></td>';
    html += '</tr>';
    
    html += '<tr><td colspan="2" style="padding:5px 8px; font-size:0.58rem; color:var(--text-muted); background:var(--bg-secondary); line-height:1.4;">Pozitif değer = yokuş yukarı, negatif = yokuş aşağı. %100 eğim = 45°.</td></tr>';
    
    html += '</table>';
    html += '</div>';
    
    html += '</div>';
    return html;
  }
  
  // ── MOTOR FRENİ / DİĞER MODÜLLER: Mevcut panel ──
  var mass = d.mass !== undefined ? d.mass : '';
  var initialSpeed = d.initialSpeed !== undefined ? d.initialSpeed : '';
  var cd = d.cd !== undefined ? d.cd : 0.65;
  var frontalArea = d.frontalArea !== undefined ? d.frontalArea : 6.7;
  var autoShift = d.autoShift !== undefined ? d.autoShift : false;
  
  var html = '<div style="border-top:1px solid var(--border-color); padding-top:12px;">';
  
  html += '<div style="font-size:0.8rem; font-weight:600; color:var(--text-heading); margin-bottom:8px;">Araç Parametreleri</div>';
  
  html += '<table style="width:100%; font-size:0.7rem; border-collapse:collapse; border:1px solid var(--border-color);">';
  
  // Araç ağırlığı
  html += '<tr style="border-bottom:1px solid var(--border-color);">';
  html += '<th style="padding:8px; text-align:left; background:var(--bg-tertiary); border-right:1px solid var(--border-color); width:55%; font-weight:500; color:var(--text-secondary);">Araç ağırlığı [kg]</th>';
  html += '<td style="padding:8px; background:var(--bg-tertiary);"><input type="number" id="ve-vehicle-mass-' + node.id + '" value="' + mass + '" step="100" min="100" placeholder="Örn. 20900" style="width:100%; padding:5px; font-size:0.7rem; background:var(--bg-input); color:var(--text-primary); border:1px solid var(--border-color); border-radius:4px; text-align:right;" onchange="onVEVehicleParamChange(\'' + node.id + '\')"></td>';
  html += '</tr>';
  
  // İlk hız
  html += '<tr style="border-bottom:1px solid var(--border-color);">';
  html += '<th style="padding:8px; text-align:left; background:var(--bg-tertiary); border-right:1px solid var(--border-color); font-weight:500; color:var(--text-secondary);">İlk hız [km/h]</th>';
  html += '<td style="padding:8px; background:var(--bg-tertiary);"><input type="number" id="ve-vehicle-speed-' + node.id + '" value="' + initialSpeed + '" step="0.01" min="0" placeholder="Örn. 49.97" style="width:100%; padding:5px; font-size:0.7rem; background:var(--bg-input); color:var(--text-primary); border:1px solid var(--border-color); border-radius:4px; text-align:right;" onchange="onVEVehicleParamChange(\'' + node.id + '\')"></td>';
  html += '</tr>';
  
  // Sürüklenme katsayısı
  html += '<tr style="border-bottom:1px solid var(--border-color);">';
  html += '<th style="padding:8px; text-align:left; background:var(--bg-tertiary); border-right:1px solid var(--border-color); font-weight:500; color:var(--text-secondary);">Sürüklenme katsayısı Cd [-]</th>';
  html += '<td style="padding:8px; background:var(--bg-tertiary);"><input type="number" id="ve-vehicle-cd-' + node.id + '" value="' + cd + '" step="0.01" min="0" max="2" style="width:100%; padding:5px; font-size:0.7rem; background:var(--bg-input); color:var(--text-primary); border:1px solid var(--border-color); border-radius:4px; text-align:right;" onchange="onVEVehicleParamChange(\'' + node.id + '\')"></td>';
  html += '</tr>';
  html += '<tr style="border-bottom:1px solid var(--border-color);">';
  html += '<td colspan="2" style="padding:5px 8px; font-size:0.62rem; color:var(--text-muted); background:var(--bg-secondary); line-height:1.3;">Şirket içinde yapılan CFD analizlerinden elde edebilirsiniz. Askeri araçlar için tipik 0.63–0.67 aralığındadır.</td>';
  html += '</tr>';
  
  // Frontal alan
  html += '<tr style="border-bottom:1px solid var(--border-color);">';
  html += '<th style="padding:8px; text-align:left; background:var(--bg-tertiary); border-right:1px solid var(--border-color); font-weight:500; color:var(--text-secondary);">Araç frontal alanı [m²]</th>';
  html += '<td style="padding:8px; background:var(--bg-tertiary);"><input type="number" id="ve-vehicle-area-' + node.id + '" value="' + frontalArea + '" step="0.1" min="0" style="width:100%; padding:5px; font-size:0.7rem; background:var(--bg-input); color:var(--text-primary); border:1px solid var(--border-color); border-radius:4px; text-align:right;" onchange="onVEVehicleParamChange(\'' + node.id + '\')"></td>';
  html += '</tr>';
  html += '<tr style="border-bottom:1px solid var(--border-color);">';
  html += '<td colspan="2" style="padding:5px 8px; font-size:0.62rem; color:var(--text-muted); background:var(--bg-secondary); line-height:1.3;">CAD datadan, aracın en kalın kesitinin alanı olarak girilebilir.</td>';
  html += '</tr>';
  
  // Otomatik vites değişimi
  html += '<tr style="border-bottom:1px solid var(--border-color);">';
  html += '<th style="padding:8px; text-align:left; background:var(--bg-tertiary); border-right:1px solid var(--border-color); font-weight:500; color:var(--text-secondary);">Otomatik vites değişimi</th>';
  html += '<td style="padding:8px; background:var(--bg-tertiary);">';
  html += '<label style="display:flex;align-items:center;gap:6px;cursor:pointer;">';
  html += '<input type="checkbox" id="ve-vehicle-autoshift-' + node.id + '" ' + (autoShift ? 'checked' : '') + ' onchange="onVEVehicleParamChange(\'' + node.id + '\')" style="width:16px;height:16px;">';
  html += '<span style="font-size:0.7rem;color:var(--text-primary);">Aktif</span>';
  html += '</label>';
  html += '</td>';
  html += '</tr>';
  html += '<tr style="border-bottom:1px solid var(--border-color);">';
  html += '<td colspan="2" style="padding:5px 8px; font-size:0.62rem; color:var(--text-muted); background:var(--bg-secondary); line-height:1.3;">İşaretlenirse, motor devri RPM eşiğine ulaştığında otomatik vites değişimi simüle edilir. 1. ve 2. viteslerde motor freni devre dışıdır.</td>';
  html += '</tr>';
  
  // Aktarma organları toplam verimi (hesaplanan - read only)
  // Bağlı bileşenlerin verimlerini çarp
  var calcEff = veCalcTotalDriveEfficiency();
  html += '<tr style="border-bottom:1px solid var(--border-color);">';
  html += '<th style="padding:8px; text-align:left; background:var(--bg-tertiary); border-right:1px solid var(--border-color); font-weight:500; color:var(--text-secondary);">Aktarma organları toplam verimi [%]</th>';
  html += '<td style="padding:8px; background:var(--bg-tertiary);"><input type="number" id="ve-vehicle-eff-' + node.id + '" value="' + calcEff.toFixed(1) + '" readonly style="width:100%; padding:5px; font-size:0.7rem; background:var(--bg-secondary); color:var(--text-muted); border:1px solid var(--border-color); border-radius:4px; text-align:right; cursor:not-allowed; font-weight:600;"></td>';
  html += '</tr>';
  html += '<tr>';
  html += '<td colspan="2" style="padding:5px 8px; font-size:0.62rem; color:var(--text-muted); background:var(--bg-secondary); line-height:1.3;">Şanzıman, transfer kutusu ve diferansiyelin toplam mekanik verimi. Her bileşenin kendi veriminden otomatik hesaplanır. Tipik değer: %92–95 arası.</td>';
  html += '</tr>';
  
  html += '</table>';
  html += '</div>';
  return html;
}

// Toplam aktarma verimi hesapla (bağlı bileşenlerden)
function veCalcTotalDriveEfficiency() {
  var eff = 1.0;
  var isFT = veActiveModule === 'full-throttle';
  nodes.forEach(function(n) {
    if(n.type === 'gearbox' && n.data && n.data.efficiency) eff *= (parseFloat(n.data.efficiency) || 97) / 100;
    else if(n.type === 'gearbox') eff *= 0.97;
    if(n.type === 'transfer' && n.data && n.data.efficiency) eff *= (parseFloat(n.data.efficiency) || 98) / 100;
    else if(n.type === 'transfer') eff *= 0.97;
    // FT modda sadece master diff sayılır
    if(n.type === 'differential') {
      if(!isFT || n.isMasterDiff) {
        if(n.data && n.data.efficiency) eff *= (parseFloat(n.data.efficiency) || 96) / 100;
        else eff *= 0.96;
      }
    }
  });
  return eff * 100;
}

function onVEVehicleParamChange(nodeId) {
  var node = nodes.find(function(n) { return n.id === nodeId; });
  if(!node) return;
  if(!node.data) node.data = {};
  
  var el = function(suffix) { return document.getElementById('ve-vehicle-' + suffix + '-' + nodeId); };
  
  if(el('mass')) node.data.mass = parseFloat(el('mass').value) || '';
  if(el('speed')) node.data.initialSpeed = parseFloat(el('speed').value) || '';
  if(el('cd')) node.data.cd = parseFloat(el('cd').value) || 0.65;
  if(el('area')) node.data.frontalArea = parseFloat(el('area').value) || 6.7;
  if(el('autoshift')) node.data.autoShift = el('autoshift').checked;
}

function onVEFTVehicleParamChange(nodeId) {
  var node = nodes.find(function(n) { return n.id === nodeId; });
  if(!node) return;
  if(!node.data) node.data = {};
  
  var g = function(suffix) { return document.getElementById('ve-ftv-' + suffix + '-' + nodeId); };
  
  if(g('name')) node.data.ftVehName = g('name').value || 'BMC 4x4 2.5T';
  if(g('gvw')) node.data.ftGVW = parseFloat(g('gvw').value) || 14900;
  if(g('driven')) node.data.ftDrivenWeight = parseFloat(g('driven').value) || 100;
  if(g('height')) node.data.ftHeight = parseFloat(g('height').value) || 3.200;
  if(g('width')) node.data.ftWidth = parseFloat(g('width').value) || 2.500;
  if(g('cd')) node.data.ftCd = parseFloat(g('cd').value) || 0.900;
  if(g('rho')) node.data.ftRho = parseFloat(g('rho').value) || 1.225;
  if(g('grade')) node.data.ftGrade = parseFloat(g('grade').value) || 0.0;
  
  // Readonly alanları güncelle
  var h = node.data.ftHeight || 3.200;
  var w = node.data.ftWidth || 2.500;
  var cd = node.data.ftCd || 0.900;
  var A = h * w;
  var grade = node.data.ftGrade || 0.0;
  
  if(g('area')) g('area').value = A.toFixed(3);
  if(g('cda')) g('cda').value = (cd * A).toFixed(3);
  if(g('grade-angle')) g('grade-angle').value = (Math.atan(grade / 100) * 180 / Math.PI).toFixed(2);
}

// Yol özellikleri - eğim, mesafe, zaman
function getRoadPropertiesHTML(node) {
  var d = node.data || {};
  var grade = d.grade !== undefined ? d.grade : '';
  var timeMode = d.timeMode || 'manual';
  var duration = d.duration !== undefined ? d.duration : '';
  var maxSimTime = d.maxSimTime !== undefined ? d.maxSimTime : 300;
  var altitude = d.altitude !== undefined ? d.altitude : '';
  var temperature = d.temperature !== undefined ? d.temperature : '';
  var airDensity = d.airDensity !== undefined ? d.airDensity : '';
  var egimMode = d.egimMode || 'manuel';
  
  var html = '<div style="border-top:1px solid var(--border-color); padding-top:12px;">';
  
  // ===== GÜZERGAH / HARİTA =====
  html += '<div style="background:var(--bg-tertiary); border-radius:8px; padding:10px; margin-bottom:12px; border:1px solid var(--border-color);">';
  html += '<div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:6px;">';
  html += '<div style="font-size:0.72rem; font-weight:600; color:var(--text-heading);">🗺️ Güzergah Haritası</div>';
  html += '<button onclick="veExpandRoadMap(\'' + node.id + '\')" title="Haritayı büyüt" style="width:24px; height:24px; display:flex; align-items:center; justify-content:center; background:var(--bg-secondary); border:1px solid var(--border-color); border-radius:3px; cursor:pointer; font-size:0.8rem; color:var(--text-secondary); transition:all 0.12s; flex-shrink:0;" onmouseover="this.style.background=\'var(--accent-primary)\';this.style.color=\'#fff\';this.style.borderColor=\'var(--accent-primary)\'" onmouseout="this.style.background=\'var(--bg-secondary)\';this.style.color=\'var(--text-secondary)\';this.style.borderColor=\'var(--border-color)\'">⛶</button>';
  html += '</div>';
  html += '<p style="font-size:0.56rem; color:var(--text-muted); margin-bottom:6px; line-height:1.3;">Haritada noktaları tıklayarak güzergah belirleyin. OSRM ile otomatik rota ve yükseklik hesabı yapılır.</p>';
  
  // Harita container
  html += '<div id="ve-road-map-' + node.id + '" style="width:100%; height:220px; border-radius:6px; border:1px solid var(--border-color); margin-bottom:6px; background:var(--bg-secondary); position:relative;"></div>';
  
  // Harita butonları
  html += '<div style="display:flex; gap:3px; margin-bottom:6px; flex-wrap:wrap;">';
  html += '<button onclick="veCalcRouteOSRM(\'' + node.id + '\')" style="flex:1; padding:4px 5px; font-size:0.58rem; background:#1b5e20; color:white; border:none; border-radius:3px; cursor:pointer;">🛣️ OSRM Rota</button>';
  html += '<button onclick="veCalcElevation(\'' + node.id + '\')" style="flex:1; padding:4px 5px; font-size:0.58rem; background:#e65100; color:white; border:none; border-radius:3px; cursor:pointer;">📐 Eğim Hesapla</button>';
  html += '<button onclick="veClearRoute(\'' + node.id + '\')" style="padding:4px 6px; font-size:0.58rem; background:var(--accent-danger); color:white; border:none; border-radius:3px; cursor:pointer;">🗑️</button>';
  html += '</div>';
  
  // Segment aralığı
  html += '<div style="display:flex; align-items:center; gap:4px; margin-bottom:6px; font-size:0.58rem;">';
  html += '<label style="color:var(--text-muted); white-space:nowrap;">Segment aralığı:</label>';
  html += '<select id="ve-road-segment-' + node.id + '" style="padding:2px 3px; background:var(--bg-input); color:var(--text-primary); border:1px solid var(--border-color); border-radius:3px; font-size:0.58rem;">';
  html += '<option value="100">~100m</option><option value="200">~200m</option><option value="300" selected>~300m</option><option value="500">~500m</option>';
  html += '</select></div>';
  
  // Sonuç kutusu
  html += '<div id="ve-road-route-result-' + node.id + '" style="display:none; background:var(--bg-secondary); padding:8px; border-radius:6px; border:1px solid var(--border-color); margin-top:4px;">';
  html += '<div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:6px; text-align:center; font-size:0.62rem;">';
  html += '<div><div style="color:var(--text-muted); font-size:0.56rem;">Mesafe</div><div id="ve-road-dist-' + node.id + '" style="color:var(--accent-primary); font-weight:600;">-</div></div>';
  html += '<div><div style="color:var(--text-muted); font-size:0.56rem;">Δh</div><div id="ve-road-dh-' + node.id + '" style="color:var(--accent-success); font-weight:600;">-</div></div>';
  html += '<div><div style="color:var(--text-muted); font-size:0.56rem;">Ort. Eğim</div><div id="ve-road-avggrade-' + node.id + '" style="color:var(--accent-warning); font-weight:600;">-</div></div>';
  html += '</div></div>';
  
  html += '</div>'; // harita wrapper

  // ===== YOL PROFİLLERİ =====
  html += '<div id="ve-road-profiles-' + node.id + '" style="display:none; background:var(--bg-tertiary); border-radius:8px; padding:10px; margin-bottom:12px; border:1px solid var(--border-color);">';
  html += '<div style="display:flex; align-items:center; justify-content:space-between; margin-bottom:6px;">';
  html += '<div style="font-size:0.72rem; font-weight:600; color:var(--text-heading);">📊 Yol Profilleri</div>';
  html += '</div>';
  html += '<div id="ve-road-profiles-content-' + node.id + '"></div>';
  html += '</div>';

  // ===== EĞİM PARAMETRELERİ =====
  html += '<div style="font-size:0.72rem; font-weight:600; color:var(--text-heading); margin:8px 0 6px 0;">📐 Eğim Parametreleri</div>';
  html += '<table style="width:100%; font-size:0.68rem; border-collapse:collapse; border:1px solid var(--border-color);">';
  
  // Eğim modu
  html += '<tr style="border-bottom:1px solid var(--border-color);"><th style="padding:6px; text-align:left; background:var(--bg-tertiary); border-right:1px solid var(--border-color); width:45%; font-weight:500; color:var(--text-secondary);">Eğim modu</th><td style="padding:6px; background:var(--bg-tertiary);"><select id="ve-road-egimmode-' + node.id + '" onchange="onVERoadEgimModeChange(\'' + node.id + '\')" style="width:100%; padding:4px; font-size:0.68rem; background:var(--bg-input); color:var(--text-primary); border:1px solid var(--border-color); border-radius:4px;"><option value="manuel"' + (egimMode==='manuel'?' selected':'') + '>Manuel (Tek değer)</option><option value="segment"' + (egimMode==='segment'?' selected':'') + '>Segment Bazlı</option></select></td></tr>';
  html += '<tr style="border-bottom:1px solid var(--border-color);"><td colspan="2" style="padding:4px 6px; font-size:0.56rem; color:var(--text-muted); background:var(--bg-secondary);">"Manuel": Sabit eğim. "Segment": Güzergah eğimlerini kullanır.</td></tr>';
  
  // Manuel eğim girişi
  html += '<tr id="ve-road-grade-row-' + node.id + '" style="border-bottom:1px solid var(--border-color);' + (egimMode==='segment'?'display:none;':'') + '"><th style="padding:6px; text-align:left; background:var(--bg-tertiary); border-right:1px solid var(--border-color); font-weight:500; color:var(--text-secondary);">Arazi eğimi [%]</th><td style="padding:6px; background:var(--bg-tertiary);"><input type="number" id="ve-road-grade-' + node.id + '" value="' + grade + '" step="0.1" placeholder="Örn. 12" style="width:100%; padding:4px; font-size:0.68rem; background:var(--bg-input); color:var(--text-primary); border:1px solid var(--border-color); border-radius:4px; text-align:right;" onchange="onVERoadParamChange(\'' + node.id + '\')"></td></tr>';
  html += '<tr id="ve-road-grade-hint-' + node.id + '" style="border-bottom:1px solid var(--border-color);' + (egimMode==='segment'?'display:none;':'') + '"><td colspan="2" style="padding:4px 6px; font-size:0.56rem; color:var(--text-muted); background:var(--bg-secondary);">Pozitif=iniş (yokuş aşağı), negatif=çıkış (yokuş yukarı)</td></tr>';
  
  // Segment bilgi kutusu
  html += '<tr id="ve-road-segment-info-' + node.id + '" style="border-bottom:1px solid var(--border-color);' + (egimMode!=='segment'?'display:none;':'') + '"><td colspan="2" style="padding:6px; background:var(--bg-secondary);"><div id="ve-road-segment-bilgi-' + node.id + '" style="font-size:0.62rem; color:var(--text-muted);">Henüz güzergah hesaplanmadı. Haritadan rota belirleyip "Eğim Hesapla" yapın.</div></td></tr>';
  
  
  html += '</table>';
  
  // ===== ORTAM PARAMETRELERİ =====
  html += '<div style="font-size:0.72rem; font-weight:600; color:var(--text-heading); margin:10px 0 6px 0;">🌡️ Ortam</div>';
  html += '<table style="width:100%; font-size:0.68rem; border-collapse:collapse; border:1px solid var(--border-color);">';
  html += '<tr style="border-bottom:1px solid var(--border-color);"><th style="padding:6px; text-align:left; background:var(--bg-tertiary); border-right:1px solid var(--border-color); width:45%; font-weight:500; color:var(--text-secondary);">Yükseklik [m]</th><td style="padding:6px; background:var(--bg-tertiary);"><input type="number" id="ve-road-alt-' + node.id + '" value="' + altitude + '" step="50" min="0" placeholder="500" style="width:100%; padding:4px; font-size:0.68rem; background:var(--bg-input); color:var(--text-primary); border:1px solid var(--border-color); border-radius:4px; text-align:right;" onchange="onVERoadParamChange(\'' + node.id + '\')"></td></tr>';
  html += '<tr style="border-bottom:1px solid var(--border-color);"><th style="padding:6px; text-align:left; background:var(--bg-tertiary); border-right:1px solid var(--border-color); font-weight:500; color:var(--text-secondary);">Sıcaklık [°C]</th><td style="padding:6px; background:var(--bg-tertiary);"><input type="number" id="ve-road-temp-' + node.id + '" value="' + temperature + '" step="1" placeholder="25" style="width:100%; padding:4px; font-size:0.68rem; background:var(--bg-input); color:var(--text-primary); border:1px solid var(--border-color); border-radius:4px; text-align:right;" onchange="onVERoadParamChange(\'' + node.id + '\')"></td></tr>';
  html += '<tr style="border-bottom:1px solid var(--border-color);"><th style="padding:6px; text-align:left; background:var(--bg-tertiary); border-right:1px solid var(--border-color); font-weight:500; color:var(--text-secondary);">Hava yoğ. [kg/m³]</th><td style="padding:6px; background:var(--bg-tertiary);"><div style="display:flex;gap:3px;"><input type="number" id="ve-road-density-' + node.id + '" value="' + airDensity + '" readonly style="flex:1; padding:4px; font-size:0.68rem; background:var(--bg-secondary); color:var(--text-primary); border:1px solid var(--border-color); border-radius:4px; text-align:right; cursor:not-allowed;"><button onclick="veCalcAirDensityRoad(\'' + node.id + '\')" style="padding:4px 6px; font-size:0.56rem; background:var(--accent-primary); color:white; border:none; border-radius:3px; cursor:pointer; white-space:nowrap;">ISA</button></div></td></tr>';
  html += '<tr><td colspan="2" style="padding:3px 6px; font-size:0.54rem; color:var(--text-muted); background:var(--bg-secondary);">ISA: Yükseklik+Sıcaklık ile otomatik hesaplanır</td></tr>';
  html += '</table>';
  
  html += '</div>';
  
  // Haritayı otomatik yükle (showNodeProperties çağrıldığında)
  html += '<div id="ve-road-autoinit-' + node.id + '" data-autoinit="roadmap" data-node="' + node.id + '" style="display:none;"></div>';
  
  return html;
}

function onVERoadParamChange(nodeId) {
  var node = nodes.find(function(n) { return n.id === nodeId; });
  if(!node) return;
  if(!node.data) node.data = {};
  
  var el = function(id) { return document.getElementById(id); };
  var gradeEl = el('ve-road-grade-' + nodeId);
  var timeModeEl = el('ve-road-timemode-' + nodeId);
  var durationEl = el('ve-road-duration-' + nodeId);
  var maxTimeEl = el('ve-road-maxtime-' + nodeId);
  var altEl = el('ve-road-alt-' + nodeId);
  var tempEl = el('ve-road-temp-' + nodeId);
  var densEl = el('ve-road-density-' + nodeId);
  var egimEl = el('ve-road-egimmode-' + nodeId);
  
  if(gradeEl) node.data.grade = parseFloat(gradeEl.value);
  if(timeModeEl) node.data.timeMode = timeModeEl.value;
  if(durationEl) node.data.duration = parseFloat(durationEl.value) || '';
  if(maxTimeEl) node.data.maxSimTime = parseFloat(maxTimeEl.value) || 300;
  if(altEl) node.data.altitude = parseFloat(altEl.value) || '';
  if(tempEl) node.data.temperature = parseFloat(tempEl.value) || '';
  if(densEl) node.data.airDensity = parseFloat(densEl.value) || '';
  if(egimEl) node.data.egimMode = egimEl.value;
}

function onVERoadTimeModeChange(nodeId) {
  var timeModeEl = document.getElementById('ve-road-timemode-' + nodeId);
  if(!timeModeEl) return;
  var mode = timeModeEl.value;
  var durRow = document.getElementById('ve-road-duration-row-' + nodeId);
  var maxRow = document.getElementById('ve-road-maxtime-row-' + nodeId);
  if(durRow) durRow.style.display = (mode === 'stop') ? 'none' : '';
  if(maxRow) maxRow.style.display = (mode === 'stop') ? '' : 'none';
  onVERoadParamChange(nodeId);
}

// Leaflet harita sistemi - her node için ayrı harita instance
var veRoadMaps = {};

// ===== PARAMETRİK ANALİZ BİLEŞENİ =====
function getParametricPropertiesHTML(node) {
  var d = node.data || {};
  var params = d.params || []; // [{compId, compType, fieldKey, fieldLabel, min, max, step}]
  
  var html = '<div style="border-top:1px solid var(--border-color); padding-top:12px;">';
  
  html += '<div style="font-size:0.8rem; font-weight:600; color:var(--accent-primary); margin-bottom:8px; display:flex; align-items:center; gap:6px;">';
  html += '<span style="display:inline-flex; align-items:center; justify-content:center; width:22px; height:22px; border-radius:6px; background:var(--accent-primary); color:white; font-weight:800; font-size:0.7rem;">P</span>';
  html += ' Parametrik Analiz</div>';
  
  html += '<p style="font-size:0.6rem; color:var(--text-muted); margin-bottom:12px; line-height:1.4;">';
  html += 'Bileşen parametrelerini farklı değerlerle tarayarak otomatik çoklu simülasyon çalıştırır. ';
  html += 'Parametre eklemek için bileşen özelliklerindeki <span style="display:inline-flex;align-items:center;justify-content:center;width:14px;height:14px;border-radius:50%;background:var(--accent-primary);color:white;font-size:0.5rem;font-weight:800;">P</span> butonlarını kullanın.</p>';
  
  // Durum göstergesi
  html += '<div style="background:var(--bg-tertiary); border:1px solid var(--border-color); border-radius:8px; padding:10px; margin-bottom:12px;">';
  
  if(params.length === 0) {
    html += '<div style="text-align:center; padding:12px 0;">';
    html += '<div style="font-size:1.6rem; margin-bottom:6px; opacity:0.4;">📊</div>';
    html += '<div style="font-size:0.68rem; color:var(--text-muted); font-weight:500;">Henüz parametre eklenmedi</div>';
    html += '<div style="font-size:0.58rem; color:var(--text-muted); margin-top:4px; opacity:0.7;">Bileşen özelliklerindeki ⓟ butonları ile parametre ekleyin</div>';
    html += '</div>';
  } else {
    html += '<div style="font-size:0.68rem; font-weight:600; color:var(--text-heading); margin-bottom:8px;">📋 Taranacak Parametreler (' + params.length + ')</div>';
    
    params.forEach(function(p, idx) {
      var compNode = nodes.find(function(n) { return n.id === p.compId; });
      var compName = compNode ? (compNode.customName || (componentDefs[compNode.type] ? componentDefs[compNode.type].name : p.compType)) : p.compType;
      
      html += '<div style="background:var(--bg-secondary); border:1px solid var(--border-color); border-radius:6px; padding:8px; margin-bottom:6px; position:relative;">';
      
      // Başlık satırı
      html += '<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">';
      html += '<div style="font-size:0.65rem; font-weight:600; color:var(--text-heading);">' + compName + ' → ' + p.fieldLabel + '</div>';
      html += '<button onclick="veRemoveParametric(\'' + node.id + '\',' + idx + ')" style="width:16px;height:16px;border:none;background:var(--accent-danger);color:white;border-radius:50%;cursor:pointer;font-size:0.5rem;line-height:1;padding:0;" title="Kaldır">✕</button>';
      html += '</div>';
      
      // Min / Max / Adım
      html += '<div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:4px;">';
      
      html += '<div>';
      html += '<label style="font-size:0.52rem; color:var(--text-muted); display:block;">Min</label>';
      html += '<input type="number" value="' + (p.min !== undefined ? p.min : '') + '" onchange="veUpdateParametric(\'' + node.id + '\',' + idx + ',\'min\',this.value)" style="width:100%;padding:3px 5px;font-size:0.65rem;background:var(--bg-input);color:var(--text-primary);border:1px solid var(--border-color);border-radius:4px;box-sizing:border-box;">';
      html += '</div>';
      
      html += '<div>';
      html += '<label style="font-size:0.52rem; color:var(--text-muted); display:block;">Max</label>';
      html += '<input type="number" value="' + (p.max !== undefined ? p.max : '') + '" onchange="veUpdateParametric(\'' + node.id + '\',' + idx + ',\'max\',this.value)" style="width:100%;padding:3px 5px;font-size:0.65rem;background:var(--bg-input);color:var(--text-primary);border:1px solid var(--border-color);border-radius:4px;box-sizing:border-box;">';
      html += '</div>';
      
      html += '<div>';
      html += '<label style="font-size:0.52rem; color:var(--text-muted); display:block;">Adım</label>';
      html += '<input type="number" value="' + (p.step !== undefined ? p.step : '') + '" onchange="veUpdateParametric(\'' + node.id + '\',' + idx + ',\'step\',this.value)" style="width:100%;padding:3px 5px;font-size:0.65rem;background:var(--bg-input);color:var(--text-primary);border:1px solid var(--border-color);border-radius:4px;box-sizing:border-box;">';
      html += '</div>';
      
      html += '</div>';
      
      // Hesaplanan koşu sayısı
      if(p.min !== undefined && p.max !== undefined && p.step > 0) {
        var runCount = Math.floor((p.max - p.min) / p.step) + 1;
        html += '<div style="font-size:0.52rem; color:var(--accent-primary); margin-top:4px; text-align:right;">' + runCount + ' koşu</div>';
      }
      
      html += '</div>';
    });
    
    // Toplam koşu hesabı
    var totalRuns = 1;
    var allValid = true;
    params.forEach(function(p) {
      if(p.min !== undefined && p.max !== undefined && p.step > 0) {
        totalRuns *= Math.floor((p.max - p.min) / p.step) + 1;
      } else {
        allValid = false;
      }
    });
    
    if(allValid && params.length > 0) {
      html += '<div style="margin-top:8px; padding:6px 10px; background:linear-gradient(135deg,rgba(59,130,246,0.1),rgba(139,92,246,0.1)); border:1px solid var(--accent-primary); border-radius:6px; text-align:center;">';
      html += '<span style="font-size:0.65rem; font-weight:600; color:var(--accent-primary);">Toplam: ' + totalRuns + ' simülasyon koşusu</span>';
      if(totalRuns > 100) {
        html += '<div style="font-size:0.52rem; color:var(--accent-warning); margin-top:2px;">⚠️ Yüksek koşu sayısı — uzun sürebilir</div>';
      }
      html += '</div>';
    }
  }
  
  html += '</div>';
  
  // Açıklama
  html += '<div style="font-size:0.52rem; color:var(--text-muted); line-height:1.4; padding:8px; background:var(--bg-tertiary); border-radius:6px; border:1px solid var(--border-color);">';
  html += '💡 <strong>Kullanım:</strong> Bileşen özelliklerindeki sayısal girdilerin yanındaki ';
  html += '<span style="display:inline-flex;align-items:center;justify-content:center;width:12px;height:12px;border-radius:50%;background:var(--accent-primary);color:white;font-size:0.45rem;font-weight:800;">P</span>';
  html += ' butonuna tıklayarak parametreleri buraya ekleyin. Simülasyon tüm kombinasyonları otomatik çalıştırır.';
  html += '</div>';
  
  html += '</div>';
  return html;
}

function veRemoveParametric(nodeId, idx) {
  var node = nodes.find(function(n) { return n.id === nodeId; });
  if(!node || !node.data || !node.data.params) return;
  node.data.params.splice(idx, 1);
  showNodeProperties(node);
  showToast('Parametre kaldırıldı');
}

function veUpdateParametric(nodeId, idx, field, value) {
  var node = nodes.find(function(n) { return n.id === nodeId; });
  if(!node || !node.data || !node.data.params) return;
  node.data.params[idx][field] = parseFloat(value);
}

// Bileşen inputlarına parametre ekleme (ⓟ butonundan çağrılır)
function veAddParametricParam(compId, fieldKey, fieldLabel) {
  // Parametrik analiz bileşenini bul
  var paramNode = nodes.find(function(n) { return n.type === 'parametric'; });
  if(!paramNode) {
    showToast('Topolojiye Parametrik Analiz bileşeni ekleyin', 'error');
    return;
  }
  
  if(!paramNode.data) paramNode.data = {};
  if(!paramNode.data.params) paramNode.data.params = [];
  
  // Zaten ekli mi kontrol et
  var exists = paramNode.data.params.some(function(p) {
    return p.compId === compId && p.fieldKey === fieldKey;
  });
  if(exists) {
    showToast('Bu parametre zaten ekli', 'error');
    return;
  }
  
  var compNode = nodes.find(function(n) { return n.id === compId; });
  var compType = compNode ? compNode.type : '';
  
  paramNode.data.params.push({
    compId: compId,
    compType: compType,
    fieldKey: fieldKey,
    fieldLabel: fieldLabel,
    min: undefined,
    max: undefined,
    step: undefined
  });
  
  showToast('Parametre eklendi: ' + fieldLabel, 'success');
  
  // Parametrik analiz paneli açıksa güncelle
  if(selectedNodes.indexOf(paramNode) > -1) {
    showNodeProperties(paramNode);
  }
}
var veRoadMarkers = {};
var veRoadPolylines = {};
var veRoadOSRMlines = {};
var veRoadSegMarkers = {}; // segment sınır noktaları (circleMarker)

