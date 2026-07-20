// ============================================================================
// GRAFİK VE TABLO RENDERLAMA
// ============================================================================

function veGetSensorData(sensorId, signalOverride, dataSource) {
  // Cross-tab sensör desteği: @tabIdx:sensorId formatı
  var tabNodes = nodes;
  var tabConns = connections;
  var r = window.veSimResults;

  if(sensorId.charAt(0) === '@') {
    var parts = sensorId.substring(1).split(':');
    var tabIdx = parseInt(parts[0]);
    sensorId = parts.slice(1).join(':');

    var tab = veTabs[tabIdx];
    if(!tab || !tab.state) return null;
    tabNodes = tab.state.nodes || [];
    tabConns = tab.state.connections || [];
    r = tab.state.simResults || null;
  }

  // ====== ENGEL ATLAMA matchTable ERİŞİMİ ======
  // obs-match hedefi: obstacleDynamic.matchTable'dan sütun okur
  if(sensorId === '~obs-match') {
    var sig = signalOverride;
    if(!r || !sig) return null;
    var dynResult = r.obstacleDynamic;
    if(!dynResult || !dynResult.matchTable || dynResult.matchTable.length === 0) return null;
    var col = [];
    dynResult.matchTable.forEach(function(row) {
      if(row[sig] !== undefined) col.push(row[sig]);
    });
    return col.length > 0 ? col : null;
  }

  // obs-log hedefi: obstacleDynamic.log dizisinden sütun okur
  if(sensorId === '~obs-log') {
    var sig = signalOverride;
    if(!r || !sig) return null;
    var dynResult = r.obstacleDynamic;
    if(!dynResult || !dynResult.log || dynResult.log.length === 0) return null;
    var col = [];
    dynResult.log.forEach(function(row) {
      if(row[sig] !== undefined) col.push(row[sig]);
    });
    return col.length > 0 ? col : null;
  }

  // ====== SIHIRBAZ DOĞRUDAN BİLEŞEN ERİŞİMİ ======
  // ~compType formatı: fiziksel sensör olmadan doğrudan bileşen verisine erişim
  if(sensorId.charAt(0) === '~') {
    var compType = sensorId.substring(1);
    var sig = signalOverride;
    if(!r || !sig) return null;

    // dataSource belirtilmişse alt sonuç kümesinden oku
    var src = r;
    if(dataSource === 'segmentDrive' && r.segmentDrive) {
      src = r.segmentDrive;
    }

    // Engel Atlama tab'ı aktifse, obstacleDynamic.log dizisinden oku
    if(typeof veActiveSolverTabId !== 'undefined' && veActiveSolverTabId === 'obstacle'
       && r.obstacleDynamic && r.obstacleDynamic.log && r.obstacleDynamic.log.length > 1) {
      var obsLog = r.obstacleDynamic.log;
      // log[].property → sinyal eşleme
      var obsMap = {
        'rpm': 'N_engine', 'torque': 'T_engine', 'power': null,
        'v_speed': 'v', 'speed': 'v',
        'T_wheel': 'T_wheel', 'T_req': 'T_req', 'T_pump': 'T_pump', 'T_turbine': 'T_turbine',
        'speed_ratio': 'SR', 'torque_ratio': 'TR',
        'phi_deg': 'phi_deg', 'F_itme': 'F_itme', 'F_engel': 'F_engel', 'F_net': 'F_net',
        'DD': 'DD', 'KE': 'KE', 'T_gb_out': 'T_gb_out', 'T_gb_lim': 'T_gb_lim'
      };
      var obsKey = obsMap[sig];
      if(obsKey && obsLog[0][obsKey] !== undefined) {
        return obsLog.map(function(e) { return e[obsKey]; });
      }
      // power = T_engine * N_engine / 9549
      if(sig === 'power' && obsLog[0].T_engine !== undefined && obsLog[0].N_engine !== undefined) {
        return obsLog.map(function(e) { return e.T_engine * e.N_engine / 9549; });
      }
      // v_speed → km/h dönüşümü (log'da m/s)
      if(sig === 'v_speed' && obsLog[0].v !== undefined) {
        return obsLog.map(function(e) { return e.v * 3.6; });
      }
    }

    // Hedef bileşeni bul
    var compNode = tabNodes.find(function(n) {
      return n.type === compType;
    });

    // nodeData'dan doğrudan oku (yalnızca ana sonuçlar için — segmentDrive'da nodeData yok)
    if(!dataSource && compNode && r.nodeData && r.nodeData[compNode.id]) {
      var compData = r.nodeData[compNode.id];
      if(compData[sig] && compData[sig].length > 0) return compData[sig];
    }

    // Fallback: top-level dizilerden oku
    // Araç sinyalleri
    if(sig === 'v_speed') return src.speed || null;
    if(sig === 'v_accel') return src.accel || null;
    if(sig === 'v_distance') return src.distance || null;
    // Yol sinyalleri
    if(sig === 'r_rolling_force') return src.F_rolling || null;
    if(sig === 'r_aero_force') return src.F_aero || null;
    if(sig === 'r_grade_force') return src.F_grade || null;
    if(sig === 'r_net_force') return src.F_net || null;
    if(sig === 'r_total_resist' && src.F_rolling && src.F_aero) {
      var tr2 = [];
      for(var j2 = 0; j2 < src.F_rolling.length; j2++) tr2.push(src.F_rolling[j2] + src.F_aero[j2] + (src.F_grade ? src.F_grade[j2] : 0));
      return tr2;
    }
    // Solver sinyalleri
    if(sig === 'tractive_effort' && src.TE) return src.TE;
    if(sig === 'drawbar_pull' && src.DP) return src.DP;
    if(sig === 'wheel_power') return src.WP || src.P_wheel || null;
    if(sig === 'engine_drag_force') return src.F_engine_drag || null;
    // Motor sinyalleri
    if(sig === 'rpm' && src.rpm) return src.rpm;
    if(sig === 'torque' && src.engineTorque) return src.engineTorque;
    if(sig === 'power' && src.rpm && src.engineTorque) {
      var pw2 = [];
      for(var i2 = 0; i2 < src.rpm.length; i2++) pw2.push(src.engineTorque[i2] * src.rpm[i2] / 9549);
      return pw2;
    }
    if(sig === 'power' && src.P_engine) return src.P_engine;
    // TC sinyalleri
    if(sig === 'speed_ratio' && src.SR) return src.SR;
    if(sig === 'torque_ratio' && src.tau) return src.tau;
    if(sig === 'efficiency' && src.tcEta) return src.tcEta.map(function(e) { return e * 100; });
    if(sig === 'slip' && src.SR) return src.SR.map(function(sr) { return (1 - sr) * 100; });
    if(sig === 'heat_rejection') return src.heatRejection || null;
    // Şanzıman Kontrol
    if(sig === 'current_gear' && src.gearMode) {
      return src.gearMode.map(function(g) {
        if(typeof g === 'number') return g;
        var m = String(g).match(/(\d+)/);
        return m ? parseInt(m[1]) : 0;
      });
    }
    // Zaman
    if(sig === 'time') {
      if(typeof veActiveSolverTabId !== 'undefined' && veActiveSolverTabId === 'obstacle'
         && r.obstacleDynamic && r.obstacleDynamic.log && r.obstacleDynamic.log.length > 1) {
        return r.obstacleDynamic.log.map(function(e) { return e.t; });
      }
      if(src.time) return src.time;
    }

    return null;
  }

  var sensor = tabNodes.find(function(n) { return n.id === sensorId; });
  if(!sensor || !(sensor.data)) return null;
  
  var sig = signalOverride || sensor.data.selectedSignal;
  if(!r || !sig) return null;
  
  // Kaynak bileşeni bul
  var sourceNodeId = null;
  var sourceType = '';
  
  if(sensor.data.attachedConnection) {
    var conn = tabConns.find(function(c) { return c.id === sensor.data.attachedConnection; });
    if(conn) {
      var dir = sensor.data.sensorDirection || 'from';
      sourceNodeId = (dir === 'to') ? conn.to : conn.from;
      var srcNode = tabNodes.find(function(n) { return n.id === sourceNodeId; });
      if(srcNode) sourceType = srcNode.type;
    }
  }
  
  if(!sourceNodeId && sensor.data.attachedComponent) {
    sourceNodeId = sensor.data.attachedComponent;
    var srcNode2 = tabNodes.find(function(n) { return n.id === sourceNodeId; });
    if(srcNode2) sourceType = srcNode2.type;
  }
  
  // ====== NODEDATA YOLU (birincil — en doğru sonuç) ======
  if(r.nodeData && sourceNodeId && r.nodeData[sourceNodeId]) {
    var compData = r.nodeData[sourceNodeId];
    if(compData[sig] && compData[sig].length > 0) {
      return compData[sig];
    }
  }
  
  // ====== HESAPLAMALI SİNYALLER ======
  // Güç hesaplama (tork * rpm / 9549)
  if(sig === 'power' || sig === 'brake_power') {
    if(r.engineTorque && r.rpm) {
      var pw = [];
      for(var i = 0; i < r.rpm.length; i++) {
        pw.push(r.engineTorque[i] * r.rpm[i] / 9549);
      }
      return pw;
    }
  }
  
  // Güç çıkışı (downstream bileşenler)
  if(sig === 'power_out' && r.nodeData && sourceNodeId) {
    // Tork ve devir verisinden hesapla
    var cd = r.nodeData[sourceNodeId];
    if(cd) {
      var tArr = cd.torque_out || cd.torque;
      var rArr = cd.rpm_out || cd.rpm;
      if(tArr && rArr && tArr.length > 0) {
        var pArr = [];
        for(var pi = 0; pi < tArr.length; pi++) {
          pArr.push(tArr[pi] * (rArr[pi] || 0) * Math.PI / 30 / 1000);
        }
        return pArr;
      }
    }
  }
  
  // Açısal hız (rpm → rad/s)
  if(sig === 'angular_vel') {
    if(r.nodeData && sourceNodeId && r.nodeData[sourceNodeId]) {
      var rpmArr = r.nodeData[sourceNodeId].rpm;
      if(rpmArr && rpmArr.length > 0) {
        return rpmArr.map(function(rpm) { return rpm * 2 * Math.PI / 60; });
      }
    }
    if(r.rpm) return r.rpm.map(function(rpm) { return rpm * 2 * Math.PI / 60; });
  }
  
  // ====== ARAÇ SİNYALLERİ ======
  if(sig === 'v_speed') return r.speed || null;
  if(sig === 'v_accel') return r.accel || null;
  if(sig === 'v_accel_g' && r.accel) {
    return r.accel.map(function(a) { return a / 9.81; });
  }
  if(sig === 'v_distance') return r.distance || null;
  if(sig === 'v_decel_g' && r.accel) {
    return r.accel.map(function(a) { return a / 9.81; });
  }
  if(sig === 'v_kinetic_energy' && r.speed) {
    var vehicleN = tabNodes.find(function(n) { return n.type === 'vehicle'; });
    var m = vehicleN && vehicleN.data ? (parseFloat(vehicleN.data.ftGVW) || parseFloat(vehicleN.data.mass) || 20000) : 20000;
    return r.speed.map(function(v_kmh) {
      var v_ms = v_kmh / 3.6;
      return 0.5 * m * v_ms * v_ms / 1000;
    });
  }
  
  // ====== YOL SİNYALLERİ ======
  if(sig === 'r_grade_force') return r.F_grade || null;
  if(sig === 'r_rolling_force') return r.F_rolling || null;
  if(sig === 'r_aero_force') return r.F_aero || null;
  if(sig === 'r_net_force') return r.F_net || null;
  if(sig === 'r_total_resist' && r.F_rolling && r.F_aero) {
    var tr = [];
    for(var j = 0; j < r.F_rolling.length; j++) {
      tr.push(r.F_rolling[j] + r.F_aero[j]);
    }
    return tr;
  }
  
  // ====== LEGACY FALLBACK — Solver dizilerinden ======
  if(sig === 'tractive_effort' && r.TE) return r.TE;
  if(sig === 'drawbar_pull' && r.DP) return r.DP;
  if(sig === 'wheel_power' && r.WP) return r.WP;
  if(sig === 'net_grade' && r.netGrade) return r.netGrade;
  if(sig === 'heat_rejection' && r.heatRejection) return r.heatRejection;
  if(sig === 'time') {
    if(typeof veActiveSolverTabId !== 'undefined' && veActiveSolverTabId === 'obstacle'
       && r.obstacleDynamic && r.obstacleDynamic.log && r.obstacleDynamic.log.length > 1) {
      return r.obstacleDynamic.log.map(function(e) { return e.t; });
    }
    if(r.time) return r.time;
  }
  
  // ====== SHIFT CONTROLLER FALLBACK ======
  if(sig === 'gear_mode' && r.gearMode) return r.gearMode;
  if(sig === 'n_output' && r.outputSpeed) return r.outputSpeed;
  
  // ====== MOTOR SİNYALLERİ FALLBACK ======
  if(sig === 'rpm' && r.rpm && r.rpm.length > 0) return r.rpm;
  if(sig === 'torque' && r.engineTorque && r.engineTorque.length > 0) return r.engineTorque;
  // ====== TC SİNYALLERİ FALLBACK ======
  if(sig === 'speed_ratio' && r.SR) return r.SR;
  if(sig === 'torque_ratio' && r.tau) return r.tau;
  if(sig === 'efficiency' && r.tcEta) {
    return r.tcEta.map(function(e) { return e * 100; });
  }
  
  // ====== TEKERLEK / ARAÇ HIZ FALLBACK ======
  if(sig === 'speed' && r.speed) return r.speed;
  if(sig === 'force' && r.F_net) return r.F_net;
  
  // ====== VERİ BULUNAMADI ======
  // Asla yanlış veri döndürme! Boş dizi = "Sinyal verisi yok"
  console.warn('[MFSim] Sensör verisi bulunamadı: sensorId=' + sensorId + 
    ', sig=' + sig + ', sourceNode=' + sourceNodeId + ', sourceType=' + sourceType);
  return null;
}

// ═══════════════════════════════════════════════════════════════════════════════
// GRAFİK RENDERLAMA — PAN / ZOOM / TOOLTIP
// ═══════════════════════════════════════════════════════════════════════════════

// Per-slot görünüm durumu (pan/zoom)
var veChartViews = [{}, {}, {}, {}];

function veResetChartView(slotIdx) {
  veChartViews[slotIdx] = { panX: 0, panY: 0, zoomX: 1, zoomY: 1 };
}

// ── Y-Axis Manuel Kontrol (N-eksen destekli) ──
function veSetAxisLock(slotIdx) {
  var slot = veResultSlots[slotIdx];
  if(!slot) return;
  if(!slot.yAxisLock) slot.yAxisLock = {};
  // Tüm eksen lock'larını oku
  for(var ai = 0; ai < 8; ai++) {
    var minEl = document.getElementById('ve-ymin-ax' + ai + '-' + slotIdx);
    var maxEl = document.getElementById('ve-ymax-ax' + ai + '-' + slotIdx);
    if(minEl) slot.yAxisLock['min' + ai] = (minEl.value !== '') ? parseFloat(minEl.value) : undefined;
    if(maxEl) slot.yAxisLock['max' + ai] = (maxEl.value !== '') ? parseFloat(maxEl.value) : undefined;
  }
  veChartViews[slotIdx] = { panX: 0, panY: 0, zoomX: 1, zoomY: 1 };
  veRenderChart(slotIdx);
}

function veClearAxisLock(slotIdx) {
  var slot = veResultSlots[slotIdx];
  if(!slot) return;
  slot.yAxisLock = {};
  for(var ai = 0; ai < 8; ai++) {
    var minEl = document.getElementById('ve-ymin-ax' + ai + '-' + slotIdx);
    var maxEl = document.getElementById('ve-ymax-ax' + ai + '-' + slotIdx);
    if(minEl) minEl.value = '';
    if(maxEl) maxEl.value = '';
  }
  veChartViews[slotIdx] = { panX: 0, panY: 0, zoomX: 1, zoomY: 1 };
  veRenderChart(slotIdx);
}

// ── Y-Axis Min/Max Popup (birime çift tıklayınca açılır) ──
function veShowYAxisLockPopup(slotIdx, axIdx, color, unit, e) {
  // Mevcut popup varsa kaldır
  var old = document.getElementById('ve-yaxis-popup');
  if(old) old.remove();

  var slot = veResultSlots[slotIdx];
  if(!slot) return;
  var yLk = slot.yAxisLock || {};
  var minVal = yLk['min' + axIdx] !== undefined ? yLk['min' + axIdx] : '';
  var maxVal = yLk['max' + axIdx] !== undefined ? yLk['max' + axIdx] : '';

  var popup = document.createElement('div');
  popup.id = 've-yaxis-popup';
  popup.style.cssText = 'position:fixed; z-index:10000; background:var(--bg-primary,#fff); border:1.5px solid ' + color + '; border-radius:6px; padding:8px 10px; box-shadow:0 4px 16px rgba(0,0,0,0.18); font-size:0.72rem; display:flex; flex-direction:column; gap:6px;';
  popup.style.left = e.clientX + 'px';
  popup.style.top = e.clientY + 'px';

  popup.innerHTML =
    '<div style="font-weight:700; color:' + color + '; font-size:0.7rem; text-align:center; border-bottom:1px solid ' + color + '30; padding-bottom:4px;">[' + unit + '] Eksen Aralığı</div>' +
    '<div style="display:flex; align-items:center; gap:4px;">' +
      '<label style="font-size:0.65rem; opacity:0.8; width:28px; color:' + color + '; font-weight:600;">Min</label>' +
      '<input type="number" id="ve-yp-min" value="' + minVal + '" step="any" placeholder="Oto" style="width:70px; padding:2px 4px; font-size:0.68rem; border:1px solid ' + color + '60; border-radius:3px; background:var(--bg-input,#fff); color:var(--text-primary,#333); text-align:center; outline-color:' + color + ';">' +
    '</div>' +
    '<div style="display:flex; align-items:center; gap:4px;">' +
      '<label style="font-size:0.65rem; opacity:0.8; width:28px; color:' + color + '; font-weight:600;">Max</label>' +
      '<input type="number" id="ve-yp-max" value="' + maxVal + '" step="any" placeholder="Oto" style="width:70px; padding:2px 4px; font-size:0.68rem; border:1px solid ' + color + '60; border-radius:3px; background:var(--bg-input,#fff); color:var(--text-primary,#333); text-align:center; outline-color:' + color + ';">' +
    '</div>' +
    '<div style="display:flex; gap:4px; justify-content:center;">' +
      '<button id="ve-yp-apply" style="padding:2px 10px; font-size:0.65rem; background:' + color + '; color:#fff; border:none; border-radius:3px; cursor:pointer; transition:opacity 0.15s;" onmouseover="this.style.opacity=\'0.8\'" onmouseout="this.style.opacity=\'1\'">Uygula</button>' +
      '<button id="ve-yp-auto" style="padding:2px 10px; font-size:0.65rem; background:transparent; color:' + color + '; border:1px solid ' + color + '60; border-radius:3px; cursor:pointer; transition:background 0.15s;" onmouseover="this.style.background=\'' + color + '10\'" onmouseout="this.style.background=\'transparent\'">↺ Oto</button>' +
    '</div>';

  document.body.appendChild(popup);

  // Ekran dışına taşmasını engelle
  var pr = popup.getBoundingClientRect();
  if(pr.right > window.innerWidth) popup.style.left = (window.innerWidth - pr.width - 8) + 'px';
  if(pr.bottom > window.innerHeight) popup.style.top = (window.innerHeight - pr.height - 8) + 'px';

  // Uygula butonu
  document.getElementById('ve-yp-apply').onclick = function() {
    if(!slot.yAxisLock) slot.yAxisLock = {};
    var mv = document.getElementById('ve-yp-min').value;
    var xv = document.getElementById('ve-yp-max').value;
    slot.yAxisLock['min' + axIdx] = mv !== '' ? parseFloat(mv) : undefined;
    slot.yAxisLock['max' + axIdx] = xv !== '' ? parseFloat(xv) : undefined;
    veChartViews[slotIdx] = { panX: 0, panY: 0, zoomX: 1, zoomY: 1 };
    veRenderChart(slotIdx);
    popup.remove();
  };

  // Oto butonu
  document.getElementById('ve-yp-auto').onclick = function() {
    if(slot.yAxisLock) {
      delete slot.yAxisLock['min' + axIdx];
      delete slot.yAxisLock['max' + axIdx];
    }
    veChartViews[slotIdx] = { panX: 0, panY: 0, zoomX: 1, zoomY: 1 };
    veRenderChart(slotIdx);
    popup.remove();
  };

  // Dışına tıklayınca kapat
  setTimeout(function() {
    document.addEventListener('mousedown', function _close(ev) {
      if(!popup.contains(ev.target)) {
        popup.remove();
        document.removeEventListener('mousedown', _close);
      }
    });
  }, 0);

  // Enter tuşu ile uygula
  popup.addEventListener('keydown', function(ev) {
    if(ev.key === 'Enter') document.getElementById('ve-yp-apply').click();
    if(ev.key === 'Escape') popup.remove();
  });

  // Min input'a odaklan
  setTimeout(function() { document.getElementById('ve-yp-min').focus(); }, 50);
}

function veRenderChart(slotIdx) {
  var slot = veResultSlots[slotIdx];
  if(!slot || !slot.sensors || slot.sensors.length === 0) return;
  
  var canvas = document.getElementById('ve-chart-canvas-' + slotIdx);
  var placeholder = document.getElementById('ve-chart-placeholder-' + slotIdx);
  if(!canvas) return;
  
  // X ekseni verisini belirle
  var r = window.veSimResults;
  var timeArr = null;

  // dataSource: slot veya X-axis'te tanımlı veri kaynağı
  var slotDataSource = slot._dataSource || null;
  var xAxisDS = (slot.xAxis && slot.xAxis._dataSource) ? slot.xAxis._dataSource : slotDataSource;

  // Özel X ekseni desteği (sanal sensör veya fiziksel sensör)
  if(slot.xAxis && slot.xAxis.id && slot.xAxis.id !== 'time') {
    if(slot.xAxis.id.charAt(0) === '~') {
      // ~compType:signal formatı (sanal sensör / bileşen verisi)
      var xParts = slot.xAxis.id.substring(1).split(':');
      var xCompType = xParts[0];
      var xSignal = xParts.slice(1).join(':');
      timeArr = veGetSensorData('~' + xCompType, xSignal, xAxisDS);
    } else {
      // sensorId:signal formatı (fiziksel sensör verisi)
      var xColonIdx = slot.xAxis.id.indexOf(':');
      if(xColonIdx > 0) {
        var xSensorId = slot.xAxis.id.substring(0, xColonIdx);
        var xSigId = slot.xAxis.id.substring(xColonIdx + 1);
        timeArr = veGetSensorData(xSensorId, xSigId);
      }
    }
  }

  // Standart zaman ekseni — dataSource'a göre doğru time dizisini seç
  if(!timeArr) {
    if(slotDataSource === 'segmentDrive' && r && r.segmentDrive && r.segmentDrive.time) {
      timeArr = r.segmentDrive.time;
    } else if(typeof veActiveSolverTabId !== 'undefined' && veActiveSolverTabId === 'obstacle'
       && r && r.obstacleDynamic && r.obstacleDynamic.log && r.obstacleDynamic.log.length > 1) {
      timeArr = r.obstacleDynamic.log.map(function(e) { return e.t; });
    } else {
      timeArr = (r && r.time) ? r.time : null;
    }
  }

  // Cross-tab sensör varsa, her sensörün kaynağından zaman dizisi ara
  slot.sensors.forEach(function(s) {
    if(s.id.charAt(0) === '@') {
      var parts = s.id.substring(1).split(':');
      var tIdx = parseInt(parts[0]);
      var tab = veTabs[tIdx];
      var tr = (tab && tab.state && tab.state.simResults) ? tab.state.simResults : null;
      if(tr && tr.time && (!timeArr || tr.time.length > timeArr.length)) {
        timeArr = tr.time;
        r = tr;
      }
    }
  });

  if(!timeArr || timeArr.length < 2) return;
  
  if(placeholder) placeholder.style.display = 'none';
  
  var parent = canvas.parentElement;
  var w = parent.clientWidth;
  var h = parent.clientHeight;
  if(w < 60 || h < 60) return;
  
  var dpr = window.devicePixelRatio || 1;
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  canvas.style.width = w + 'px';
  canvas.style.height = h + 'px';
  
  var ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  
  var colors = ['#3b82f6','#ef4444','#22c55e','#f59e0b','#8b5cf6','#ec4899'];
  
  // ====== VERİ TOPLA ======
  var datasets = [];
  slot.sensors.forEach(function(s, idx) {
    var sDS = s._dataSource || slotDataSource;
    var data = veGetSensorData(s.id, s.signal, sDS);
    // Veri bulunamadıysa boş dizi — asla başka sensörün verisini kullanma!
    if(!data || data.length === 0) data = null;
    datasets.push({data: data, color: colors[idx % colors.length], name: s.name, unit: s.unit || '', _noData: !data});
  });

  // Tüm sensörler boşsa çık
  var hasAnyData = datasets.some(function(ds) { return !ds._noData; });
  if(!hasAnyData) return;

  // ====== X EKSENİ SIRALAMA (zaman dışı X ekseni için) ======
  // X ekseni zaman değilse (ör. RPM), veri noktalarını X değerine göre sırala
  // Böylece çizgiler doğru sırada çizilir (ileri-geri gitmez)
  var isCustomXAxis = slot.xAxis && slot.xAxis.id && slot.xAxis.id !== 'time';
  if(isCustomXAxis && timeArr && timeArr.length > 1) {
    // Sıralı indeks dizisi oluştur
    var sortedIndices = [];
    for(var si = 0; si < timeArr.length; si++) sortedIndices.push(si);
    var origTimeArr = timeArr;
    sortedIndices.sort(function(a, b) { return origTimeArr[a] - origTimeArr[b]; });

    // timeArr'ı sıralı kopyala
    var sortedTime = new Array(timeArr.length);
    for(var si = 0; si < sortedIndices.length; si++) {
      sortedTime[si] = timeArr[sortedIndices[si]];
    }
    timeArr = sortedTime;

    // Her dataset'in verisini aynı sırayla yeniden düzenle
    datasets.forEach(function(ds) {
      if(ds._noData || !ds.data) return;
      var sortedData = new Array(ds.data.length);
      for(var si = 0; si < sortedIndices.length && si < ds.data.length; si++) {
        sortedData[si] = ds.data[sortedIndices[si]];
      }
      ds.data = sortedData;
    });
  }
  
  // ====== DUAL Y-AXIS: Birimlere göre grupla ======
  var unitGroups = [];
  datasets.forEach(function(ds, di) {
    if(ds._noData) return; // Verisi olmayan sensörü atla
    var u = ds.unit || '';
    var grp = unitGroups.find(function(g) { return g.unit === u; });
    if(!grp) {
      unitGroups.push({unit: u, dsIndices: [di], yMin: Infinity, yMax: -Infinity});
    } else {
      grp.dsIndices.push(di);
    }
  });
  
  if(unitGroups.length === 0) return;
  
  // Her grup için min/max hesapla
  unitGroups.forEach(function(grp) {
    grp.dsIndices.forEach(function(di) {
      var ds = datasets[di];
      for(var i = 0; i < ds.data.length; i++) {
        var v = ds.data[i];
        if(isFinite(v)) {
          if(v < grp.yMin) grp.yMin = v;
          if(v > grp.yMax) grp.yMax = v;
        }
      }
    });
    if(!isFinite(grp.yMin)) grp.yMin = 0;
    if(!isFinite(grp.yMax)) grp.yMax = 1;
    var range = grp.yMax - grp.yMin || 1;
    var pad = range * 0.08;
    grp.yMin -= pad;
    grp.yMax += pad;
  });
  
  // ====== Y-AXIS LOCK OVERRIDE (N-eksen) ======
  var yLock = slot.yAxisLock || {};
  unitGroups.forEach(function(grp, gi) {
    var mkMin = yLock['min' + gi], mkMax = yLock['max' + gi];
    if(mkMin !== undefined && isFinite(mkMin)) grp.yMin = mkMin;
    if(mkMax !== undefined && isFinite(mkMax)) grp.yMax = mkMax;
    grp._locked = (mkMin !== undefined || mkMax !== undefined);
  });

  // ====== N-EKSEN DAĞITIMI (sol/sağ alternating) ======
  var hasDualAxis = unitGroups.length >= 2;
  // Eksen renkleri: her grup için ilk dataset'in rengini kullan
  unitGroups.forEach(function(grp) {
    grp._color = datasets[grp.dsIndices[0]] ? datasets[grp.dsIndices[0]].color : '#888';
  });
  // Sol/sağ taraf ataması: 0→sol, 1→sağ, 2→sol, 3→sağ, ...
  var leftAxes = [], rightAxes = [];
  unitGroups.forEach(function(grp, gi) {
    grp._globalIdx = gi;
    if(gi % 2 === 0) { grp._side = 'left'; grp._sideIdx = leftAxes.length; leftAxes.push(grp); }
    else { grp._side = 'right'; grp._sideIdx = rightAxes.length; rightAxes.push(grp); }
  });

  // Dataset → axis mapping
  datasets.forEach(function(ds, di) {
    ds._axisIdx = 0;
    for(var gi = 0; gi < unitGroups.length; gi++) {
      if(unitGroups[gi].dsIndices.indexOf(di) >= 0) { ds._axisIdx = gi; break; }
    }
  });

  // ====== MARJİN (dinamik — eksen sayısına göre) ======
  var AXIS_W = 52; // Her eksen için piksel genişlik
  var margin = {
    left: Math.max(58, 14 + leftAxes.length * AXIS_W),
    right: rightAxes.length > 0 ? Math.max(58, 14 + rightAxes.length * AXIS_W) : 14,
    top: 16, bottom: 38
  };
  var pw = w - margin.left - margin.right;
  var ph = h - margin.top - margin.bottom;
  if(pw < 20 || ph < 20) return;
  
  // ====== X EKSENİ ======
  var dataXMin = timeArr[0];
  var dataXMax = timeArr[timeArr.length - 1];
  var dataXRange = dataXMax - dataXMin || 1;
  
  // ====== PAN / ZOOM ======
  var view = veChartViews[slotIdx];
  if(!view || !view.zoomX) { veResetChartView(slotIdx); view = veChartViews[slotIdx]; }
  
  var xRange = dataXRange / view.zoomX;
  var xCenter = (dataXMin + dataXMax) / 2 - view.panX * dataXRange;
  var xMin = xCenter - xRange / 2;
  var xMax = xCenter + xRange / 2;
  
  // Her eksen için zoom/pan uygula
  var axes = unitGroups; // tüm eksenler
  
  axes.forEach(function(ax) {
    if(ax._locked) {
      ax._viewMin = ax.yMin;
      ax._viewMax = ax.yMax;
    } else {
      var origRange = ax.yMax - ax.yMin || 1;
      var range = origRange / view.zoomY;
      var center = (ax.yMin + ax.yMax) / 2 - view.panY * origRange;
      ax._viewMin = center - range / 2;
      ax._viewMax = center + range / 2;
    }
    
    // Nice ticks — sadece etiket/grid çizimi için, viewMin/viewMax DEĞİŞMEZ
    var tickCount = Math.max(3, Math.min(8, Math.floor(ph / 40)));
    ax._yStep = veNiceStep((ax._viewMax - ax._viewMin) / tickCount);
    // Tick başlangıcı: viewMin'e en yakın yuvarlak değer
    ax._tickStart = Math.ceil(ax._viewMin / ax._yStep) * ax._yStep;
  });
  
  var xTickCount = Math.max(3, Math.min(10, Math.floor(pw / 70)));
  var xStep = veNiceStep((xMax - xMin) / xTickCount);
  
  // Pozisyon fonksiyonları
  function xPos(t) { return margin.left + (t - xMin) / (xMax - xMin) * pw; }
  function yPosAxis(v, axIdx) {
    var ax = axes[axIdx] || axes[0];
    return margin.top + ph - (v - ax._viewMin) / (ax._viewMax - ax._viewMin) * ph;
  }
  
  // ====== META KAYDET (Tooltip için) ======
  slot._chartMeta = {
    margin: margin, pw: pw, ph: ph, w: w, h: h,
    xMin: xMin, xMax: xMax,
    yMin: axes[0]._viewMin, yMax: axes[0]._viewMax,
    dataXMin: dataXMin, dataXMax: dataXMax,
    dataYMin: axes[0].yMin, dataYMax: axes[0].yMax,
    datasets: datasets,
    timeArr: timeArr,
    hasDualAxis: hasDualAxis,
    axes: axes.map(function(ax) {
      return { unit: ax.unit, yMin: ax._viewMin, yMax: ax._viewMax, yStep: ax._yStep, color: ax._color };
    })
  };
  
  // ====== ÇİZİM ======
  // Arka plan (hafif gradient)
  var bgGrad = ctx.createLinearGradient(margin.left, margin.top, margin.left, margin.top + ph);
  bgGrad.addColorStop(0, 'rgba(0,0,0,0.02)');
  bgGrad.addColorStop(1, 'rgba(0,0,0,0.005)');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(margin.left, margin.top, pw, ph);

  // Clip region
  ctx.save();
  ctx.beginPath();
  ctx.rect(margin.left, margin.top, pw, ph);
  ctx.clip();

  // Y grid (ilk eksen referanslı)
  var lyStep = axes[0]._yStep;
  for(var yv = axes[0]._tickStart; yv <= axes[0]._viewMax + lyStep * 0.01; yv += lyStep) {
    var gy = yPosAxis(yv, 0);
    if(gy < margin.top - 1 || gy > margin.top + ph + 1) continue;
    ctx.strokeStyle = 'rgba(128,128,128,0.12)';
    ctx.lineWidth = 0.6; ctx.setLineDash([4,4]);
    ctx.beginPath(); ctx.moveTo(margin.left, gy); ctx.lineTo(margin.left + pw, gy); ctx.stroke();
    ctx.setLineDash([]);
  }

  // X grid
  for(var xv = Math.ceil(xMin / xStep) * xStep; xv <= xMax + xStep * 0.01; xv += xStep) {
    var gx = xPos(xv);
    ctx.strokeStyle = 'rgba(128,128,128,0.12)';
    ctx.lineWidth = 0.6; ctx.setLineDash([4,4]);
    ctx.beginPath(); ctx.moveTo(gx, margin.top); ctx.lineTo(gx, margin.top + ph); ctx.stroke();
    ctx.setLineDash([]);
  }

  // ====== VERİ ÇİZGİLERİ ======
  var activeCount = datasets.filter(function(d) { return !d._noData; }).length;
  datasets.forEach(function(ds, di) {
    if(ds._noData) return;
    var n = Math.min(ds.data.length, timeArr.length);
    var step = Math.max(1, Math.floor(n / (pw * 2)));
    var axIdx = ds._axisIdx;

    // Gradient dolgu (max 3 aktif dataset)
    if(activeCount <= 3) {
      ctx.beginPath();
      var first = true;
      for(var i = 0; i < n; i += step) {
        var x = xPos(timeArr[i]); var y = yPosAxis(ds.data[i], axIdx);
        if(first) { ctx.moveTo(x, y); first = false; } else ctx.lineTo(x, y);
      }
      var lastI = Math.min(n - 1, timeArr.length - 1);
      ctx.lineTo(xPos(timeArr[lastI]), margin.top + ph);
      ctx.lineTo(xPos(timeArr[0]), margin.top + ph);
      ctx.closePath();
      var grad = ctx.createLinearGradient(0, margin.top, 0, margin.top + ph);
      grad.addColorStop(0, ds.color + '20');
      grad.addColorStop(0.6, ds.color + '08');
      grad.addColorStop(1, ds.color + '01');
      ctx.fillStyle = grad; ctx.fill();
    }

    // Çizgi
    ctx.strokeStyle = ds.color;
    ctx.lineWidth = 2; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    ctx.beginPath();
    for(var i = 0; i < n; i += step) {
      var x = xPos(timeArr[i]); var y = yPosAxis(ds.data[i], axIdx);
      if(i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
    }
    ctx.stroke();
  });

  ctx.restore(); // clip kaldır
  
  // ====== SOL Y ETİKETLERİ (N-eksen) ======
  ctx.textBaseline = 'middle';
  leftAxes.forEach(function(ax, li) {
    var axColor = (unitGroups.length >= 2) ? ax._color : 'rgba(160,160,180,0.85)';
    var labelX = margin.left - 6 - li * AXIS_W;
    var unitX = margin.left - 40 - li * AXIS_W;
    var aStep = ax._yStep;
    for(var yv = ax._tickStart; yv <= ax._viewMax + aStep * 0.01; yv += aStep) {
      var gy = yPosAxis(yv, ax._globalIdx);
      if(gy < margin.top - 2 || gy > margin.top + ph + 2) continue;
      // Küçük tick çizgisi
      ctx.strokeStyle = axColor; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(margin.left - li * AXIS_W, gy); ctx.lineTo(margin.left - li * AXIS_W - 4, gy); ctx.stroke();
      ctx.fillStyle = axColor;
      ctx.font = '10.5px -apple-system,system-ui,sans-serif';
      ctx.textAlign = 'right';
      ctx.fillText(veFormatAxisVal(yv), labelX, gy);
    }
    if(ax.unit) {
      ctx.save();
      ctx.translate(unitX, margin.top + ph / 2);
      ctx.rotate(-Math.PI / 2);
      ctx.fillStyle = axColor;
      ctx.font = '600 10px -apple-system,system-ui,sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('[' + ax.unit + ']', 0, 0);
      var uTw = ctx.measureText('[' + ax.unit + ']').width;
      ctx.restore();
      // Y ekseni birim hit alanını kaydet (çift tıklama için)
      if(!slot._chartMeta.yUnitHits) slot._chartMeta.yUnitHits = [];
      slot._chartMeta.yUnitHits.push({
        x: unitX - 7, y: margin.top + ph / 2 - uTw / 2 - 4,
        w: 14, h: uTw + 8,
        axIdx: ax._globalIdx, side: 'left', color: axColor, unit: ax.unit
      });
    }
    // İç eksenler için ayırıcı çizgi
    if(li > 0) {
      var lineX = margin.left - li * AXIS_W + 4;
      ctx.strokeStyle = axColor + '30';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(lineX, margin.top); ctx.lineTo(lineX, margin.top + ph); ctx.stroke();
    }
  });

  // ====== SAĞ Y ETİKETLERİ (N-eksen) ======
  rightAxes.forEach(function(ax, ri) {
    var axColor = ax._color;
    var labelX = margin.left + pw + 6 + ri * AXIS_W;
    var unitX = margin.left + pw + 40 + ri * AXIS_W;
    var aStep = ax._yStep;
    for(var yv = ax._tickStart; yv <= ax._viewMax + aStep * 0.01; yv += aStep) {
      var gy = yPosAxis(yv, ax._globalIdx);
      if(gy < margin.top - 2 || gy > margin.top + ph + 2) continue;
      // Küçük tick çizgisi
      ctx.strokeStyle = axColor; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(margin.left + pw + ri * AXIS_W, gy); ctx.lineTo(margin.left + pw + ri * AXIS_W + 4, gy); ctx.stroke();
      ctx.fillStyle = axColor;
      ctx.font = '10.5px -apple-system,system-ui,sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(veFormatAxisVal(yv), labelX, gy);
    }
    if(ax.unit) {
      ctx.save();
      ctx.translate(unitX, margin.top + ph / 2);
      ctx.rotate(Math.PI / 2);
      ctx.fillStyle = axColor;
      ctx.font = '600 10px -apple-system,system-ui,sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('[' + ax.unit + ']', 0, 0);
      var uTw = ctx.measureText('[' + ax.unit + ']').width;
      ctx.restore();
      // Y ekseni birim hit alanını kaydet (çift tıklama için)
      if(!slot._chartMeta.yUnitHits) slot._chartMeta.yUnitHits = [];
      slot._chartMeta.yUnitHits.push({
        x: unitX - 7, y: margin.top + ph / 2 - uTw / 2 - 4,
        w: 14, h: uTw + 8,
        axIdx: ax._globalIdx, side: 'right', color: axColor, unit: ax.unit
      });
    }
    // Sağ eksen çerçeve çizgisi
    var lineX = margin.left + pw + ri * AXIS_W;
    if(ri === 0) lineX = margin.left + pw;
    ctx.strokeStyle = axColor + '40';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(lineX, margin.top); ctx.lineTo(lineX, margin.top + ph); ctx.stroke();
  });
  
  // ====== X ETİKETLERİ ======
  ctx.textBaseline = 'top';
  for(var xv = Math.ceil(xMin / xStep) * xStep; xv <= xMax + xStep * 0.01; xv += xStep) {
    var gx = xPos(xv);
    if(gx < margin.left - 2 || gx > margin.left + pw + 2) continue;
    // Küçük tick çizgisi
    ctx.strokeStyle = 'rgba(160,160,180,0.5)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(gx, margin.top + ph); ctx.lineTo(gx, margin.top + ph + 4); ctx.stroke();
    ctx.fillStyle = 'rgba(160,160,180,0.85)';
    ctx.font = '10.5px -apple-system,system-ui,sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(veFormatAxisVal(xv), gx, margin.top + ph + 7);
  }

  // X ekseni başlığı (canvas üzerinde, altta ortada) — tıklanabilir
  var xAxisName = (slot.xAxis ? slot.xAxis.name : 'Zaman [s]');
  ctx.fillStyle = 'rgba(59,130,246,0.85)';
  ctx.font = '600 11px -apple-system,system-ui,sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'top';
  var xTitleX = margin.left + pw / 2;
  var xTitleY = margin.top + ph + 22;
  var xTitleW = ctx.measureText(xAxisName).width;
  var xArrowStr = ' \u25B2';
  var xFullStr = xAxisName + xArrowStr;
  var xFullW = ctx.measureText(xFullStr).width;
  var xArrowW = ctx.measureText(xArrowStr).width;
  // Eksen ismi ve ok işareti çiz
  ctx.fillText(xFullStr, xTitleX, xTitleY);
  // Tıklama alanı sadece ok (▲) sembolünü kapsar
  slot._chartMeta.xTitleHit = {
    x: xTitleX + xFullW / 2 - xArrowW - 2,
    y: xTitleY - 2,
    w: xArrowW + 6,
    h: 16
  };

  // Sol eksen çerçeve + alt çerçeve
  ctx.strokeStyle = 'rgba(128,128,128,0.35)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(margin.left, margin.top); ctx.lineTo(margin.left, margin.top + ph);
  ctx.lineTo(margin.left + pw, margin.top + ph); ctx.stroke();
  
  // Zoom göstergesi
  if(view.zoomX > 1.01 || view.zoomY > 1.01 || Math.abs(view.panX) > 0.001 || Math.abs(view.panY) > 0.001) {
    var zoomText = 'x' + view.zoomX.toFixed(1) + ' | Cift tik: sifirla';
    ctx.font = '9px -apple-system,system-ui,sans-serif';
    var ztw = ctx.measureText(zoomText).width;
    // Arka plan kutusu
    ctx.fillStyle = 'rgba(59,130,246,0.12)';
    ctx.beginPath();
    var zx = w - 8 - ztw - 8, zy = 4;
    if(ctx.roundRect) { ctx.roundRect(zx, zy, ztw + 16, 18, 4); } else { ctx.rect(zx, zy, ztw + 16, 18); }
    ctx.fill();
    ctx.strokeStyle = 'rgba(59,130,246,0.3)'; ctx.lineWidth = 1; ctx.stroke();
    ctx.fillStyle = 'rgba(59,130,246,0.85)';
    ctx.textAlign = 'right'; ctx.textBaseline = 'top';
    ctx.fillText(zoomText, w - 8, 8);
  }
  
  // Eksen kontrolü: Y birim etiketine çift tıklayınca popup açılır (veShowYAxisLockPopup)
}

// ═══════ CHART İNTERAKTİVİTE — PAN / ZOOM / TOOLTIP ═══════

function veInitChartInteraction(slotIdx) {
  var area = document.getElementById('ve-chart-area-' + slotIdx);
  if(!area || area._veInit) return;
  area._veInit = true;

  var isPanning = false;
  var panPending = false; // sol tık: threshold'u aşana kadar bekle
  var panStartX = 0, panStartY = 0;
  var panStartPanX = 0, panStartPanY = 0;
  var _panRAF = null;
  var PAN_THRESHOLD = 4; // piksel — bu mesafe aşılmadan pan başlamaz

  // Fare hareketi: tooltip veya pan
  area.addEventListener('mousemove', function(e) {
    // Threshold kontrolü (sol tık pan için)
    if(panPending && !isPanning) {
      var dx = Math.abs(e.clientX - panStartX);
      var dy = Math.abs(e.clientY - panStartY);
      if(dx > PAN_THRESHOLD || dy > PAN_THRESHOLD) {
        isPanning = true;
        area.style.cursor = 'grabbing';
        veChartHideTooltip(slotIdx);
      } else {
        veChartShowTooltip(slotIdx, e);
        return;
      }
    }
    if(isPanning) {
      var slot = veResultSlots[slotIdx];
      var m = slot && slot._chartMeta;
      if(!m) return;
      var view = veChartViews[slotIdx];
      var ddx = (e.clientX - panStartX) / m.pw;
      var ddy = (e.clientY - panStartY) / m.ph;
      view.panX = panStartPanX + ddx / view.zoomX;
      view.panY = panStartPanY - ddy / view.zoomY;
      if(!_panRAF) {
        _panRAF = requestAnimationFrame(function() {
          veRenderChart(slotIdx);
          _panRAF = null;
        });
      }
      return;
    }
    veChartShowTooltip(slotIdx, e);
    // X eksen başlığı üzerinde cursor değiştir
    var slotM = veResultSlots[slotIdx];
    var metaM = slotM && slotM._chartMeta;
    if(metaM && !isPanning && !panPending) {
      var rectM = area.getBoundingClientRect();
      var scMx = rectM.width / metaM.w;
      var scMy = rectM.height / metaM.h;
      var mxM = e.clientX - rectM.left;
      var myM = e.clientY - rectM.top;
      var hitCursor = '';
      // X ekseni ok hit kontrolü
      if(metaM.xTitleHit) {
        var hitM = metaM.xTitleHit;
        if(mxM >= hitM.x * scMx && mxM <= (hitM.x + hitM.w) * scMx &&
           myM >= hitM.y * scMy && myM <= (hitM.y + hitM.h) * scMy) {
          hitCursor = 'pointer';
        }
      }
      // Y ekseni birim hit kontrolü
      if(!hitCursor && metaM.yUnitHits) {
        for(var _yh = 0; _yh < metaM.yUnitHits.length; _yh++) {
          var _uh = metaM.yUnitHits[_yh];
          if(mxM >= _uh.x * scMx && mxM <= (_uh.x + _uh.w) * scMx &&
             myM >= _uh.y * scMy && myM <= (_uh.y + _uh.h) * scMy) {
            hitCursor = 'pointer';
            break;
          }
        }
      }
      area.style.cursor = hitCursor;
    }
  });

  area.addEventListener('mouseleave', function() {
    if(!isPanning && !panPending) veChartHideTooltip(slotIdx);
    area.style.cursor = '';
  });

  // Sol tık veya sağ tık: pan başlat
  area.addEventListener('mousedown', function(e) {
    if(e.button !== 0 && e.button !== 2) return;
    var slot = veResultSlots[slotIdx];
    if(!slot || !slot._chartMeta) return;
    var m = slot._chartMeta;
    var rect = area.getBoundingClientRect();
    var mx = e.clientX - rect.left;
    var my = e.clientY - rect.top;
    if(mx < m.margin.left || mx > m.margin.left + m.pw) return;
    if(my < m.margin.top || my > m.margin.top + m.ph) return;

    panStartX = e.clientX;
    panStartY = e.clientY;
    var view = veChartViews[slotIdx];
    panStartPanX = view.panX;
    panStartPanY = view.panY;

    if(e.button === 0) {
      // Sol tık: threshold ile pan
      panPending = true;
    } else {
      // Sağ tık: hemen pan
      isPanning = true;
      area.style.cursor = 'grabbing';
      veChartHideTooltip(slotIdx);
    }
    e.preventDefault();
  });

  document.addEventListener('mouseup', function(e) {
    if(isPanning || panPending) {
      isPanning = false;
      panPending = false;
      area.style.cursor = '';
    }
  });

  // X ekseni başlığına tıklama (plot alanı dışında, ayrı click handler gerekli)
  area.addEventListener('click', function(e) {
    var slot2 = veResultSlots[slotIdx];
    var m2 = slot2 && slot2._chartMeta;
    if(!m2 || !m2.xTitleHit) return;
    var rect2 = area.getBoundingClientRect();
    var scX = rect2.width / m2.w;
    var scY = rect2.height / m2.h;
    var cx = e.clientX - rect2.left;
    var cy = e.clientY - rect2.top;
    var hit = m2.xTitleHit;
    if(cx >= hit.x * scX && cx <= (hit.x + hit.w) * scX &&
       cy >= hit.y * scY && cy <= (hit.y + hit.h) * scY) {
      e.stopPropagation();
      veShowXAxisPicker(slotIdx, e);
    }
  });
  
  // Context menüyü engelle (sağ tık = pan)
  area.addEventListener('contextmenu', function(e) {
    e.preventDefault();
  });
  
  // Çift tık: Y ekseni birimine tıklanırsa min/max popup, değilse görünümü sıfırla
  area.addEventListener('dblclick', function(e) {
    e.preventDefault();
    var slot2 = veResultSlots[slotIdx];
    var m2 = slot2 && slot2._chartMeta;
    if(m2 && m2.yUnitHits && m2.yUnitHits.length > 0) {
      var rect2 = area.getBoundingClientRect();
      var scX = rect2.width / m2.w;
      var scY = rect2.height / m2.h;
      var cx = e.clientX - rect2.left;
      var cy = e.clientY - rect2.top;
      for(var hi = 0; hi < m2.yUnitHits.length; hi++) {
        var uh = m2.yUnitHits[hi];
        if(cx >= uh.x * scX && cx <= (uh.x + uh.w) * scX &&
           cy >= uh.y * scY && cy <= (uh.y + uh.h) * scY) {
          veShowYAxisLockPopup(slotIdx, uh.axIdx, uh.color, uh.unit, e);
          return;
        }
      }
    }
    veResetChartView(slotIdx);
    veRenderChart(slotIdx);
  });
  
  // Fare tekerlegi: zoom
  var _zoomRAF = null;
  area.addEventListener('wheel', function(e) {
    e.preventDefault();
    var slot = veResultSlots[slotIdx];
    if(!slot || !slot._chartMeta) return;
    var m = slot._chartMeta;
    var view = veChartViews[slotIdx];
    
    var rect = area.getBoundingClientRect();
    var mx = e.clientX - rect.left;
    var my = e.clientY - rect.top;
    
    var factor = e.deltaY < 0 ? 1.15 : 1 / 1.15;
    
    // Shift: sadece Y, normal: ikisi birden
    var zoomXFactor = e.shiftKey ? 1 : factor;
    var zoomYFactor = factor;
    
    // Zoom merkezi
    var fxNorm = (mx - m.margin.left) / m.pw;
    var fyNorm = 1 - (my - m.margin.top) / m.ph;
    
    if(zoomXFactor !== 1) {
      var xFrac = (fxNorm - 0.5) / view.zoomX;
      view.zoomX *= zoomXFactor;
      view.panX += ((fxNorm - 0.5) / view.zoomX - xFrac);
    }
    if(zoomYFactor !== 1) {
      var yFrac = (fyNorm - 0.5) / view.zoomY;
      view.zoomY *= zoomYFactor;
      view.panY += ((fyNorm - 0.5) / view.zoomY - yFrac);
    }
    
    view.zoomX = Math.max(0.5, Math.min(50, view.zoomX));
    view.zoomY = Math.max(0.5, Math.min(50, view.zoomY));
    
    if(!_zoomRAF) {
      _zoomRAF = requestAnimationFrame(function() {
        veRenderChart(slotIdx);
        _zoomRAF = null;
      });
    }
    veChartHideTooltip(slotIdx);
  });
}

function veChartShowTooltip(slotIdx, e) {
  var slot = veResultSlots[slotIdx];
  if(!slot || !slot._chartMeta) return;
  var m = slot._chartMeta;
  var tArr = m.timeArr;
  if(!tArr || tArr.length === 0) return;
  
  var canvas = document.getElementById('ve-chart-canvas-' + slotIdx);
  var tooltip = document.getElementById('ve-tooltip-' + slotIdx);
  var crosshair = document.getElementById('ve-crosshair-' + slotIdx);
  var crossV = document.getElementById('ve-crosshair-v-' + slotIdx);
  if(!canvas || !tooltip || !crosshair) return;
  
  // Canvas bounding rect kullan
  var cRect = canvas.getBoundingClientRect();
  var cw = cRect.width;
  var ch = cRect.height;
  if(cw < 10 || ch < 10) return;
  
  var mx = e.clientX - cRect.left;
  var my = e.clientY - cRect.top;
  
  // Canvas CSS boyutu ile meta boyutu ölçek farkı
  var scaleX = cw / m.w;
  var scaleY = ch / m.h;
  
  // Plot alanı sınırları (CSS px)
  var plotLeft = m.margin.left * scaleX;
  var plotRight = (m.margin.left + m.pw) * scaleX;
  var plotTop = m.margin.top * scaleY;
  var plotBottom = (m.margin.top + m.ph) * scaleY;
  
  if(mx < plotLeft - 2 || mx > plotRight + 2 || my < plotTop - 2 || my > plotBottom + 2) {
    tooltip.classList.remove('visible');
    crosshair.style.display = 'none';
    return;
  }
  
  // X → zaman
  var tVal = m.xMin + (mx - plotLeft) / (plotRight - plotLeft) * (m.xMax - m.xMin);
  
  // Binary search
  var idx = 0, lo = 0, hi = tArr.length - 1;
  while(lo <= hi) { var mid = (lo + hi) >> 1; if(tArr[mid] < tVal) lo = mid + 1; else hi = mid - 1; }
  idx = lo;
  if(idx > 0 && idx < tArr.length && Math.abs(tArr[idx - 1] - tVal) < Math.abs(tArr[idx] - tVal)) idx--;
  if(idx >= tArr.length) idx = tArr.length - 1;
  
  var snapX = plotLeft + (tArr[idx] - m.xMin) / (m.xMax - m.xMin) * (plotRight - plotLeft);
  
  crosshair.style.display = '';
  crosshair.style.width = cw + 'px';
  crosshair.style.height = ch + 'px';
  crossV.style.left = snapX + 'px';
  crossV.style.top = plotTop + 'px';
  crossV.style.height = (plotBottom - plotTop) + 'px';
  
  crosshair.querySelectorAll('.ve-chart-crosshair-dot').forEach(function(d) { d.remove(); });
  
  var xLabel = 't';
  var xUnit = 's';
  if(slot.xAxis && slot.xAxis.id && slot.xAxis.id !== 'time') {
    xLabel = slot.xAxis.name || 'X';
    xUnit = slot.xAxis.unit || '';
  }
  var html = '<div style="font-weight:700; font-size:0.65rem; color:var(--text-secondary); margin-bottom:4px; border-bottom:1px solid var(--border-color); padding-bottom:3px; letter-spacing:0.2px;">' + xLabel + ' = ' + tArr[idx].toFixed(3) + (xUnit ? ' ' + xUnit : '') + '</div>';
  
  // Dual axis bilgisi
  var axesInfo = m.axes || [{ yMin: m.yMin, yMax: m.yMax }];
  
  m.datasets.forEach(function(ds) {
    if(ds._noData) {
      // Verisi olmayan sensör — sadece tooltip'te uyarı göster
      html += '<div class="ve-chart-tooltip-row">';
      html += '<div class="ve-chart-tooltip-dot" style="background:' + ds.color + '; opacity:0.3;"></div>';
      html += '<span style="font-size:0.65rem; opacity:0.5;">' + ds.name + '</span>';
      html += '<span class="ve-chart-tooltip-val" style="opacity:0.4;">— veri yok</span>';
      html += '</div>';
      return;
    }
    var val = (ds.data && idx < ds.data.length) ? ds.data[idx] : 0;
    
    // Dataset'in bağlı olduğu eksen
    var axIdx = ds._axisIdx || 0;
    var ax = axesInfo[axIdx] || axesInfo[0];
    
    // Y pozisyonu: kendi eksenine göre hesapla
    var plotH = plotBottom - plotTop;
    var valY = plotTop + plotH - (val - ax.yMin) / (ax.yMax - ax.yMin) * plotH;
    
    var dot = document.createElement('div');
    dot.className = 've-chart-crosshair-dot';
    dot.style.left = snapX + 'px';
    dot.style.top = valY + 'px';
    dot.style.borderColor = ds.color;
    crosshair.appendChild(dot);
    
    // Eksen tarafı göstergesi (çoklu eksen modunda)
    var axisBadge = '';
    if(m.hasDualAxis && axesInfo[axIdx]) {
      var axUnit = axesInfo[axIdx].unit;
      var axClr = axesInfo[axIdx].color || ds.color;
      axisBadge = ' <span style="opacity:0.5;font-size:0.5rem;color:' + axClr + ';">[' + (axUnit || ('Y' + (axIdx+1))) + ']</span>';
    }
    
    html += '<div class="ve-chart-tooltip-row">';
    html += '<div class="ve-chart-tooltip-dot" style="background:' + ds.color + ';"></div>';
    html += '<span style="font-size:0.65rem;">' + ds.name + axisBadge + '</span>';
    html += '<span class="ve-chart-tooltip-val">' + veFormatTooltipVal(val) + ' <span style="opacity:0.5;">' + ds.unit + '</span></span>';
    html += '</div>';
  });
  
  tooltip.innerHTML = html;
  tooltip.classList.add('visible');
  
  var tw = tooltip.offsetWidth || 160;
  var th = tooltip.offsetHeight || 60;
  var tx = snapX + 14;
  var ty = my - th / 2;
  if(tx + tw > cw - 4) tx = snapX - tw - 14;
  if(ty < 4) ty = 4;
  if(ty + th > ch - 4) ty = ch - th - 4;
  tooltip.style.left = tx + 'px';
  tooltip.style.top = ty + 'px';
}

function veChartHideTooltip(slotIdx) {
  var tooltip = document.getElementById('ve-tooltip-' + slotIdx);
  var crosshair = document.getElementById('ve-crosshair-' + slotIdx);
  if(tooltip) tooltip.classList.remove('visible');
  if(crosshair) crosshair.style.display = 'none';
}

function veFormatTooltipVal(v) {
  var a = Math.abs(v);
  if(a >= 10000) return v.toFixed(0);
  if(a >= 100) return v.toFixed(1);
  if(a >= 1) return v.toFixed(2);
  if(a >= 0.01) return v.toFixed(3);
  return v.toExponential(2);
}

function veNiceStep(rough) {
  if(rough <= 0 || !isFinite(rough)) return 1;
  var mag = Math.pow(10, Math.floor(Math.log10(rough)));
  var norm = rough / mag;
  if(norm <= 1.5) return mag;
  if(norm <= 3) return 2 * mag;
  if(norm <= 7) return 5 * mag;
  return 10 * mag;
}

function veFormatAxisVal(v) {
  var a = Math.abs(v);
  if(a >= 10000) return (v/1000).toFixed(0) + 'k';
  if(a >= 100) return v.toFixed(0);
  if(a >= 10) return v.toFixed(1);
  if(a >= 1) return v.toFixed(1);
  if(a >= 0.01) return v.toFixed(2);
  return v.toFixed(3);
}

// ═══════ TABLO RENDERLAMA ═══════

function veRenderTable(slotIdx) {
  var slot = veResultSlots[slotIdx];
  if(!slot || !slot.sensors || slot.sensors.length === 0) return;
  
  var tbody = document.getElementById('ve-table-body-' + slotIdx);
  if(!tbody) return;
  
  // X ekseni verisini belirle
  var r = window.veSimResults;
  var timeArr = null;
  var slotDataSource = slot._dataSource || null;
  var xAxisDS = (slot.xAxis && slot.xAxis._dataSource) ? slot.xAxis._dataSource : slotDataSource;

  // Özel X ekseni desteği (sanal sensör veya fiziksel sensör)
  if(slot.xAxis && slot.xAxis.id && slot.xAxis.id !== 'time') {
    if(slot.xAxis.id.charAt(0) === '~') {
      var xParts = slot.xAxis.id.substring(1).split(':');
      var xCompType = xParts[0];
      var xSignal = xParts.slice(1).join(':');
      timeArr = veGetSensorData('~' + xCompType, xSignal, xAxisDS);
    } else {
      var xColonIdx = slot.xAxis.id.indexOf(':');
      if(xColonIdx > 0) {
        var xSensorId = slot.xAxis.id.substring(0, xColonIdx);
        var xSigId = slot.xAxis.id.substring(xColonIdx + 1);
        timeArr = veGetSensorData(xSensorId, xSigId);
      }
    }
  }

  if(!timeArr) {
    if(slotDataSource === 'segmentDrive' && r && r.segmentDrive && r.segmentDrive.time) {
      timeArr = r.segmentDrive.time;
    } else {
      timeArr = (r && r.time) ? r.time : null;
    }
  }

  slot.sensors.forEach(function(s) {
    if(s.id.charAt(0) === '@') {
      var parts = s.id.substring(1).split(':');
      var tIdx = parseInt(parts[0]);
      var tab = veTabs[tIdx];
      var tr = (tab && tab.state && tab.state.simResults) ? tab.state.simResults : null;
      if(tr && tr.time && (!timeArr || tr.time.length > timeArr.length)) {
        timeArr = tr.time;
      }
    }
  });

  if(!timeArr || timeArr.length === 0) return;

  var colors = ['#3b82f6','#ef4444','#22c55e','#f59e0b','#8b5cf6','#ec4899'];
  var datasets = [];
  slot.sensors.forEach(function(s) {
    var sDS = s._dataSource || slotDataSource;
    var data = veGetSensorData(s.id, s.signal, sDS);
    datasets.push(data); // null olabilir
  });
  
  var n = timeArr.length;
  var maxRows = 200;
  var step = Math.max(1, Math.floor(n / maxRows));
  
  var rows = [];
  var rowNum = 0;
  for(var i = 0; i < n; i += step) {
    rowNum++;
    var row = '<tr><td>' + rowNum + '</td>';
    row += '<td style="font-weight:600;">' + timeArr[i].toFixed(3) + '</td>';
    datasets.forEach(function(ds, di) {
      var val = (ds && i < ds.length) ? ds[i] : 0;
      row += '<td style="color:' + colors[di % colors.length] + ';">' + (ds ? veFormatTooltipVal(val) : '—') + '</td>';
    });
    row += '</tr>';
    rows.push(row);
  }
  
  if((n - 1) % step !== 0 && n > 1) {
    rowNum++;
    var row = '<tr style="border-top:2px solid var(--border-color);"><td>' + rowNum + '</td>';
    row += '<td style="font-weight:700;">' + timeArr[n - 1].toFixed(3) + '</td>';
    datasets.forEach(function(ds, di) {
      var val = (ds && n - 1 < ds.length) ? ds[n - 1] : 0;
      row += '<td style="color:' + colors[di % colors.length] + '; font-weight:700;">' + (ds ? veFormatTooltipVal(val) : '—') + '</td>';
    });
    row += '</tr>';
    rows.push(row);
  }
  
  // MIN / MAX / ORT
  var sumRow = function(label, borderTop, fn) {
    var r2 = '<tr style="background:var(--bg-tertiary);' + (borderTop ? ' border-top:2px solid var(--accent-primary);' : '') + '"><td colspan="2" style="font-weight:700; color:var(--text-muted);">' + label + '</td>';
    datasets.forEach(function(ds, di) {
      r2 += '<td style="color:' + colors[di % colors.length] + '; font-weight:700;">' + veFormatTooltipVal(fn(ds)) + '</td>';
    });
    return r2 + '</tr>';
  };
  rows.push(sumRow('MIN', true, function(ds) { var m = Infinity; for(var j = 0; j < ds.length; j++) if(ds[j] < m) m = ds[j]; return m; }));
  rows.push(sumRow('MAX', false, function(ds) { var m = -Infinity; for(var j = 0; j < ds.length; j++) if(ds[j] > m) m = ds[j]; return m; }));
  rows.push(sumRow('ORT', false, function(ds) { var s = 0; for(var j = 0; j < ds.length; j++) s += ds[j]; return ds.length > 0 ? s / ds.length : 0; }));
  
  tbody.innerHTML = rows.join('');
}

function veExportResults() {
  veShowRaporModal();
}

function veShowRaporModal() {
  var r = window.veSimResults;
  if(!r || !r.time || r.time.length === 0) {
    showToast('Rapor oluşturulacak sonuç yok — önce simülasyon çalıştırın', 'warning');
    return;
  }
  
  var existing = document.getElementById('ve-rapor-modal-overlay');
  if(existing) existing.remove();
  
  var overlay = document.createElement('div');
  overlay.id = 've-rapor-modal-overlay';
  overlay.style.cssText = 'position:fixed; inset:0; z-index:100000; background:rgba(0,0,0,0.82); display:flex; align-items:center; justify-content:center; padding:20px; backdrop-filter:blur(4px);';
  overlay.addEventListener('mousedown', function(e) { if(e.target === overlay) veCloseRaporModal(); });
  
  var modal = document.createElement('div');
  modal.style.cssText = 'width:360px; background:var(--bg-secondary); border:1px solid var(--border-color); border-radius:0; overflow:hidden; box-shadow:0 20px 60px rgba(0,0,0,0.6);';
  
  modal.innerHTML = '' +
    '<div style="padding:12px 16px; background:linear-gradient(135deg, #1a365d 0%, #2c5282 100%); display:flex; align-items:center; justify-content:space-between;">' +
      '<span style="font-size:0.88rem; font-weight:700; color:#e2e8f0; display:flex; align-items:center; gap:8px;"><span class="mf-ico mf-ico-bar-chart"></span> BMC Detaylı Hesap Raporu</span>' +
      '<button onclick="veCloseRaporModal()" style="width:26px; height:26px; background:transparent; border:1px solid rgba(255,255,255,0.2); border-radius:0; color:#e2e8f0; cursor:pointer; font-size:0.9rem;">✕</button>' +
    '</div>' +
    '<div style="padding:16px;">' +
      '<div style="text-align:center; margin-bottom:14px; padding:8px; background:linear-gradient(135deg, #0d1b2a 0%, #1b263b 100%); border-radius:0; border:1px solid var(--border-color);">' +
        '<div style="font-size:0.85rem; font-weight:700; color:#63b3ed; letter-spacing:2px;">BMC</div>' +
        '<div style="font-size:0.6rem; color:var(--text-muted); margin-top:2px;">Güç Grubu Müdürlüğü — Görsel Editör</div>' +
      '</div>' +
      '<div style="margin-bottom:12px;">' +
        '<label style="color:var(--text-muted); font-size:0.68rem; display:block; margin-bottom:3px;">Raporu Hazırlayan:</label>' +
        '<input type="text" id="ve-rapor-hazirlayan" value="Kerem Aydoğan" placeholder="İsim Soyisim" style="width:100%; padding:6px 8px; font-size:0.72rem; background:var(--bg-input); color:var(--text-primary); border:1px solid var(--border-color); border-radius:0;">' +
      '</div>' +
      '<hr style="border:none; border-top:1px solid var(--border-color); margin:12px 0;">' +
      '<div id="ve-rapor-zaman-wrap" style="margin-bottom:12px; display:none;">' +
        '<label style="color:var(--text-muted); font-size:0.68rem; display:block; margin-bottom:3px;">Zaman Adımı (Motor Freni CSV):</label>' +
        '<select id="ve-rapor-zaman-adimi" style="width:100%; padding:6px 8px; font-size:0.72rem; background:var(--bg-input); color:var(--text-primary); border:1px solid var(--border-color); border-radius:0;">' +
          '<option value="0.5" selected>0.5 saniye</option>' +
          '<option value="1.0">1.0 saniye</option>' +
        '</select>' +
      '</div>' +
      '<div style="margin-bottom:14px;">' +
        '<label style="color:var(--text-muted); font-size:0.68rem; display:block; margin-bottom:3px;">Rapor Formatı:</label>' +
        '<select id="ve-rapor-format" onchange="var w=document.getElementById(\'ve-rapor-zaman-wrap\');if(w)w.style.display=this.value===\'csv\'?\'block\':\'none\';" style="width:100%; padding:6px 8px; font-size:0.72rem; background:var(--bg-input); color:var(--text-primary); border:1px solid var(--border-color); border-radius:0;">' +
          (veActiveModule === 'full-throttle' ? '<option value="txt" selected>TXT (Metin Dosyası — Tam Rapor)</option>' : '') +
          '<option value="csv"' + (veActiveModule !== 'full-throttle' ? ' selected' : '') + '>CSV (Excel Uyumlu — Sadece Veri)</option>' +
        '</select>' +
      '</div>' +
      '<button onclick="veGenerateReport()" style="width:100%; padding:10px; background:linear-gradient(135deg, #1a365d 0%, #2b6cb0 100%); color:#fff; border:none; border-radius:0; font-size:0.82rem; font-weight:700; cursor:pointer; display:flex; align-items:center; justify-content:center; gap:6px;"><span class="mf-ico mf-ico-download"></span> BMC Raporu Oluştur ve İndir</button>' +
      '<div style="text-align:center; color:var(--text-muted); font-size:0.6rem; margin-top:8px;">Rapor BMC kurumsal formatında oluşturulacaktır</div>' +
    '</div>';
  
  overlay.appendChild(modal);
  document.body.appendChild(overlay);
  
  document.addEventListener('keydown', function handler(e) {
    if(e.key === 'Escape') { veCloseRaporModal(); document.removeEventListener('keydown', handler); }
  });
}

function veCloseRaporModal() {
  var ov = document.getElementById('ve-rapor-modal-overlay');
  if(ov) ov.remove();
}

function veGenerateReport() {
  var r = window.veSimResults;
  if(!r || !r.time || r.time.length === 0) {
    showToast('Sonuç yok', 'warning'); return;
  }
  
  var zamanAdimi = parseFloat(document.getElementById('ve-rapor-zaman-adimi').value) || 0.5;
  var format = (document.getElementById('ve-rapor-format') || {}).value || 'txt';
  var hazirlayan = (document.getElementById('ve-rapor-hazirlayan') || {}).value || 'Belirtilmemiş';
  var now = new Date();
  

  
  if(format === 'txt' && veActiveModule === 'full-throttle') {
    var ftReport = veGenerateFTTxtReport(window.veSimResults);
    var blob = new Blob([ftReport], { type: 'text/plain;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'BMC_TamGaz_Rapor_' + now.getFullYear() +
      String(now.getMonth()+1).padStart(2,'0') +
      String(now.getDate()).padStart(2,'0') + '_' +
      String(now.getHours()).padStart(2,'0') +
      String(now.getMinutes()).padStart(2,'0') + '.txt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    veCloseRaporModal();
    showToast('TXT rapor indirildi', 'success');
    return;
  }
  
  // Bileşen verilerini topla
  var engineNode = nodes.find(function(n) { return n.type === 'engine'; });
  var gearboxNode = nodes.find(function(n) { return n.type === 'gearbox'; });
  var tcNode = nodes.find(function(n) { return n.type === 'torque-converter'; });
  var transferNode = nodes.find(function(n) { return n.type === 'transfer'; });
  var diffNode = nodes.find(function(n) { return n.type === 'differential' && n.isMasterDiff; })
               || nodes.find(function(n) { return n.type === 'differential'; });
  var wheelNode = nodes.find(function(n) { return n.type === 'wheel'; });
  var vehicleNode = nodes.find(function(n) { return n.type === 'vehicle'; });
  var roadNode = nodes.find(function(n) { return n.type === 'road'; });
  var scenarioNode = nodes.find(function(n) { return n.type === 'scenario'; });
  var solverNode = nodes.find(function(n) { return n.type === 'solver'; });
  
  var ed = engineNode ? (engineNode.data || {}) : {};
  var gd = gearboxNode ? (gearboxNode.data || {}) : {};
  var td = tcNode ? (tcNode.data || {}) : {};
  var trd = transferNode ? (transferNode.data || {}) : {};
  var dd = diffNode ? (diffNode.data || {}) : {};
  var wd = wheelNode ? (wheelNode.data || {}) : {};
  var vd = vehicleNode ? (vehicleNode.data || {}) : {};
  var rd = roadNode ? (roadNode.data || {}) : {};
  var scd = scenarioNode ? (scenarioNode.data || {}) : {};
  var sd = solverNode ? (solverNode.data || {}) : {};
  
  // Parametreleri çıkar
  var mass = parseFloat(vd.mass) || 20000;
  var r_wheel = parseFloat(wd.radius) || 0.5;
  var i_diff = parseFloat(dd.ratio) || 1;
  var i_transfer = parseFloat(trd.ratio) || 1;
  var i_torque = parseFloat(td.ratio) || 1;
  var slopePercent = parseFloat(rd.grade) || 0;
  var Crr = parseFloat(rd.crr) || parseFloat(vd.crr) || 0.008;
  var Cd = parseFloat(vd.cd) || 0.7;
  var A = parseFloat(vd.frontalArea) || 8;
  var rho = parseFloat(vd.airDensity) || 1.225;
  var delta = parseFloat(vd.rotatingMassFactor) || 1.08;
  var aktarmaVerim = parseFloat(gd.efficiency) || parseFloat(dd.efficiency) || 93;
  var mfVerim = (parseFloat(ed.verim) || 100);
  
  // Vites bilgisi
  var gearRatios = gd.gearRatios || [];
  var currentGear = r.gearUsed || 1;
  var i_gear = gearRatios.length >= currentGear ? (parseFloat(gearRatios[currentGear - 1]) || 1) : 1;
  var vitesAdi = currentGear + '. Vites';
  
  var i_total = i_diff * i_transfer * i_gear * i_torque;
  var thetaRad = Math.atan(slopePercent / 100);
  var thetaDeg = thetaRad * 180 / Math.PI;
  
  var v_start_kmh = r.speed ? r.speed[0] : 0;
  var simSure = r.time[r.time.length - 1];
  
  // Adımları oluştur (simülasyon sonuçlarından belirtilen zaman adımıyla örnekle)
  var steps = [];
  var tIdx = 0;
  for(var t = 0; t <= simSure + 0.0001; t += zamanAdimi) {
    // En yakın zaman indeksini bul
    while(tIdx < r.time.length - 1 && r.time[tIdx + 1] <= t + zamanAdimi * 0.01) tIdx++;
    if(tIdx >= r.time.length) break;
    
    var v_kmh = r.speed ? r.speed[tIdx] : 0;
    var rpm = r.rpm ? r.rpm[tIdx] : 0;
    var T_mf = r.engineTorque ? Math.abs(r.engineTorque[tIdx]) : 0;
    var F_grade_val = r.F_grade ? r.F_grade[tIdx] : 0;
    var F_roll_val = r.F_rolling ? r.F_rolling[tIdx] : 0;
    var F_aero_val = r.F_aero ? r.F_aero[tIdx] : 0;
    var F_net_val = r.F_net ? r.F_net[tIdx] : 0;
    var accel_val = r.accel ? r.accel[tIdx] : 0;
    var dist_val = r.distance ? r.distance[tIdx] : 0;
    var v_ms = v_kmh / 3.6;
    var F_brake_val = (T_mf * i_total * (aktarmaVerim / 100) * (mfVerim / 100)) / r_wheel;
    
    steps.push({
      t: r.time[tIdx],
      v_kmh: v_kmh,
      rpm: rpm,
      T_mf: T_mf,
      F_brake: F_brake_val,
      F_roll: Math.abs(F_roll_val),
      F_aero: Math.abs(F_aero_val),
      F_grade: Math.abs(F_grade_val),
      F_net: F_net_val,
      a: accel_val,
      dv: v_kmh - v_start_kmh,
      s: dist_val
    });
  }
  
  if(steps.length === 0) { showToast('Adım oluşturulamadı', 'warning'); return; }
  
  var now = new Date();
  var report = '';
  
  // CSV format
  report = 'Zaman [s];Hız [km/sa];Motor Devri [d/d];Tork [Nm];F_brake [N];F_roll [N];F_aero [N];F_grade [N];F_net [N];İvme [m/s²];Δv [km/sa];Mesafe [m]\n';
  steps.forEach(function(s) {
    report += s.t.toFixed(2) + ';' + s.v_kmh.toFixed(2) + ';' + s.rpm.toFixed(0) + ';' + s.T_mf.toFixed(0) + ';' +
      s.F_brake.toFixed(0) + ';' + s.F_roll.toFixed(0) + ';' + s.F_aero.toFixed(0) + ';' + s.F_grade.toFixed(0) + ';' +
      s.F_net.toFixed(0) + ';' + s.a.toFixed(4) + ';' + s.dv.toFixed(2) + ';' + s.s.toFixed(1) + '\n';
  });

  var mimeType = 'text/csv;charset=utf-8';
  var blob = new Blob([report], { type: mimeType });
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url;
  a.download = 'BMC_MotorFreni_VE_Rapor_' + now.getFullYear() + String(now.getMonth()+1).padStart(2,'0') + String(now.getDate()).padStart(2,'0') + '_' + String(now.getHours()).padStart(2,'0') + String(now.getMinutes()).padStart(2,'0') + '.csv';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  
  veCloseRaporModal();
  showToast('Rapor indirildi (' + steps.length + ' adım)', 'success');
}

function veNameToEmail(name) {
  var tr = {'ç':'c','ğ':'g','ı':'i','ö':'o','ş':'s','ü':'u','Ç':'c','Ğ':'g','İ':'i','Ö':'o','Ş':'s','Ü':'u'};
  var s = name.trim().toLowerCase().replace(/[çğıöşüÇĞİÖŞÜ]/g, function(c){ return tr[c] || c; });
  var parts = s.split(/\s+/).filter(function(p){ return p.length > 0; });
  if(parts.length === 0) return '';
  return parts.join('.') + '@bmc.com.tr';
}

function veGenerateFTTxtReport(sim, optHazirlayan) {
  var W = 80;
  var WW = 130;

  // ── YARDIMCI FONKSIYONLAR ──
  function ln(ch, len) { var s = ''; for (var i = 0; i < len; i++) s += ch; return s; }
  function pad(str, len, align) {
    str = String(str);
    if (align === 'right') { while (str.length < len) str = ' ' + str; return str; }
    if (align === 'center') {
      var l = Math.floor((len - str.length) / 2);
      var r2 = len - str.length - l;
      var sp = ''; for (var i = 0; i < l; i++) sp += ' ';
      var sp2 = ''; for (var i = 0; i < r2; i++) sp2 += ' ';
      return sp + str + sp2;
    }
    while (str.length < len) str += ' ';
    return str;
  }
  function num(v, d) { return isFinite(v) ? v.toFixed(d) : '-'; }
  function numI(v) { return isFinite(v) ? Math.round(v).toString() : '-'; }
  function pRow(label, value, indent) {
    indent = indent || '  ';
    var labelW = 32;
    return indent + pad(label, labelW) + ': ' + value + '\n';
  }
  function ascii(s) {
    return String(s)
      .replace(/ğ/g,'g').replace(/Ğ/g,'G')
      .replace(/ü/g,'u').replace(/Ü/g,'U')
      .replace(/ş/g,'s').replace(/Ş/g,'S')
      .replace(/ı/g,'i').replace(/İ/g,'I')
      .replace(/ö/g,'o').replace(/Ö/g,'O')
      .replace(/ç/g,'c').replace(/Ç/g,'C');
  }

  // ── UNICODE KUTU-CIZIMI YARDIMCILARI (UTF-8; hepsi tek kod-birimi → pad hizasi korunur) ──
  // Gercek Turkce metni oldugu gibi birak (ascii() sadelestirmesinin tersi).
  function tr(s) { return s == null ? '' : String(s); }
  function rep(ch, n) { var s = ''; for (var i = 0; i < n; i++) s += ch; return s; }

  // Metni w genisligine gore kelime bazli sar.
  function wrap(text, w) {
    var words = tr(text).split(/\s+/), lines = [], cur = '';
    for (var i = 0; i < words.length; i++) {
      var word = words[i];
      if (!cur) cur = word;
      else if ((cur + ' ' + word).length <= w) cur += ' ' + word;
      else { lines.push(cur); cur = word; }
    }
    if (cur) lines.push(cur);
    return lines;
  }

  // Tablo yatay cizgisi: widths = kolon ic-genislikleri (bar'lar arasi toplam).
  function tRule(widths, l, m, rt, fill) {
    var s = '  ' + l;
    for (var i = 0; i < widths.length; i++) { s += rep(fill, widths[i]); s += (i < widths.length - 1 ? m : rt); }
    return s + '\n';
  }
  // Tablo veri satiri: cells + widths + aligns (left/right/center). Tasan hucre '…' ile kirpilir.
  function tRow(cells, widths, aligns) {
    var s = '  │';
    for (var i = 0; i < cells.length; i++) {
      var w = widths[i], a = (aligns && aligns[i]) || 'left', t = tr(cells[i]);
      if (t.length > w - 2) t = t.slice(0, Math.max(0, w - 3)) + '…';
      var cell = a === 'right'  ? pad(t, w - 1, 'right') + ' '
               : a === 'center' ? pad(t, w, 'center')
               :                  ' ' + pad(t, w - 1, 'left');
      s += cell + '│';
    }
    return s + '\n';
  }

  // Agir cerceveli bolum baslik bandi (tam genislik, sol hizali).
  function sectionBanner(label, width) {
    var inner = width - 2;
    return '┏' + rep('━', inner) + '┓\n' +
           '┃' + pad(' ' + label, inner, 'left') + '┃\n' +
           '┗' + rep('━', inner) + '┛\n\n';
  }

  // Baslikli hafif kutu (2 girinti). bodyLines onceden bicimlenmis satirlar.
  function titledBox(title, bodyLines, width) {
    var inner = width - 4;              // '  ┌' + inner + '┐'
    var head = '─ ' + tr(title) + ' ';
    var s = '  ┌' + head + rep('─', Math.max(0, inner - head.length)) + '┐\n';
    for (var i = 0; i < bodyLines.length; i++) {
      var t = tr(bodyLines[i]);
      if (t.length > inner - 2) t = t.slice(0, inner - 3) + '…';
      s += '  │ ' + pad(t, inner - 2, 'left') + ' │\n';
    }
    return s + '  └' + rep('─', inner) + '┘\n';
  }

  // Yorum/not kutusu: metni kutu icine sarar, sol ustte ► baslik etiketi.
  function noteBox(title, text, width) {
    var inner = width - 4;
    var head = '─ ► ' + tr(title) + ' ';
    var s = '  ┌' + head + rep('─', Math.max(0, inner - head.length)) + '┐\n';
    var lines = wrap(text, inner - 2);
    for (var i = 0; i < lines.length; i++) {
      s += '  │ ' + pad(lines[i], inner - 2, 'left') + ' │\n';
    }
    return s + '  └' + rep('─', inner) + '┘\n';
  }

  // Kosul seridi: "  ETIKET │ a · b · c"
  function condStrip(label, pairs) {
    var prefix = '  ' + pad(tr(label), 10, 'left') + '│ ';
    var cont   = '  ' + pad('', 10, 'left') + '│ ';
    var maxW = W;
    var out = '', line = prefix;
    for (var i = 0; i < pairs.length; i++) {
      var atStart = (line === prefix || line === cont);
      var seg = (atStart ? '' : '  ·  ') + pairs[i];
      if (!atStart && (line + seg).length > maxW) { out += line + '\n'; line = cont + pairs[i]; }
      else line += seg;
    }
    return out + line + '\n';
  }

  // ── VERI KAYNAKLARI ──
  var R = sim.reportSnapshot;
  if (!R) {
    console.warn('[MFSim] FT TXT rapor: reportSnapshot bulunamadı — yanlış modül ile çağrılmış olabilir');
    return '(Rapor oluşturulamadı: Tam Gaz simülasyon verisi bulunamadı.)\n';
  }
  var G = sim.gradeability;
  var A = sim.acceleration;
  var ss = sim.solverStats || {};
  var hazirlayan = optHazirlayan || (document.getElementById('ve-rapor-hazirlayan') || {}).value || 'Belirtilmemis';
  var now = new Date();
  var tarih = String(now.getDate()).padStart(2,'0') + '.' + String(now.getMonth()+1).padStart(2,'0') + '.' + now.getFullYear();
  var saat = String(now.getHours()).padStart(2,'0') + ':' + String(now.getMinutes()).padStart(2,'0') + ':' + String(now.getSeconds()).padStart(2,'0');
  var raporNo = 'BMC-FT-' + now.getFullYear() + '-' + String(Math.floor(Math.random() * 9000) + 1000);

  // Motor hesaplamalari
  var peakTorque = 0, peakTorqueRpm = 0, peakPower = 0, peakPowerRpm = 0, govPower = 0;
  (R.torqueData || []).forEach(function(p) {
    if (p.torque > peakTorque) { peakTorque = p.torque; peakTorqueRpm = p.rpm; }
    var pw = p.power || (p.torque * p.rpm * Math.PI / 30000);
    if (pw > peakPower) { peakPower = pw; peakPowerRpm = p.rpm; }
    if (Math.abs(p.rpm - R.governed) < 5) govPower = pw;
  });
  var peakHP = peakPower * 1.341;

  // FT Steps — High range: ana simülasyondan
  var stepsHigh = (typeof veBuildFTStepsFromSim === 'function') ? veBuildFTStepsFromSim(sim, 'high') : [];
  // Low range: gerçek düşük kademe simülasyonundan (ölçekleme yerine)
  var _allRangeRes = (typeof window !== 'undefined') ? window._veFTAllRangeResults : null;
  var _lowKademe = (R.transferGears && R.transferGears.length > 1) ? (R.transferGears[1].kademe || 'Low') : 'Low';
  var _lowSim = _allRangeRes ? _allRangeRes[_lowKademe] : null;
  var stepsLow = (typeof veBuildFTStepsFromSim === 'function' && _lowSim && _lowSim.speed && _lowSim.speed.length > 2)
    ? veBuildFTStepsFromSim(_lowSim, 'low')
    : [];

  // ECM hesaplamasi
  var _ecmResults = [];
  // Şanzıman giriş limitleri
  var _gbLimits = { grossInputPower: R.gbGrossInputPower || null, grossInputTorque: R.gbGrossInputTorque || null, maxOutputSpeed: R.gbMaxOutputSpeed || null };
  // Governed devirdeki tork ve güç
  var _torqueAtGov = 0;
  if (R.torqueData && R.torqueData.length >= 2) {
    var _tdg = R.torqueData;
    if (R.governed <= _tdg[0].rpm) _torqueAtGov = _tdg[0].torque;
    else if (R.governed >= _tdg[_tdg.length-1].rpm) _torqueAtGov = _tdg[_tdg.length-1].torque;
    else { for (var _gi = 0; _gi < _tdg.length - 1; _gi++) { if (_tdg[_gi].rpm <= R.governed && R.governed <= _tdg[_gi+1].rpm) { var _gf = (R.governed - _tdg[_gi].rpm) / (_tdg[_gi+1].rpm - _tdg[_gi].rpm); _torqueAtGov = _tdg[_gi].torque + _gf * (_tdg[_gi+1].torque - _tdg[_gi].torque); break; } } }
  }
  var _powerAtGov = _torqueAtGov * R.governed * Math.PI / 30000;
  var _c9ok = _gbLimits.grossInputPower !== null ? _powerAtGov <= _gbLimits.grossInputPower : true;
  var _c10ok = _gbLimits.grossInputTorque !== null ? _torqueAtGov <= _gbLimits.grossInputTorque : true;
  try {
    if (R.torqueData && R.torqueData.length > 2 && typeof VE_FT_TC_PRESETS !== 'undefined' && typeof veGetFamilyTCKeys === 'function') {
      var _tcKeys = veGetFamilyTCKeys();
      var motorFn = FT_SOLVER.createMotorTorqueFn(R.torqueData, R.governed, R.noLoad);
      var ptd = R.pumpDrop || 17.6;
      _tcKeys.forEach(function(key) {
        try {
        var tc = VE_FT_TC_PRESETS[key];
        if (!tc || !tc.data || tc.data.length < 3) return;
        var tcFns = FT_SOLVER.createTCFunctions(tc.data);
        if (typeof tcFns.kpump !== 'function' || typeof tcFns.tau !== 'function') {
          console.warn('[MFSim] ECM: TC fonksiyonları oluşturulamadı, atlanıyor: ' + key);
          return;
        }
        var K0 = tcFns.kpump(0);
        var sTau = tcFns.tau(0);
        if (!motorFn || !K0 || K0 <= 0) return;
        var sSpeed = 0;
        for (var nr = (R.idleRpm || 700); nr <= R.governed + 200; nr += 5) {
          var Te = motorFn(nr); var Cp = (nr * nr) / (K0 * K0) + ptd;
          if (Te <= Cp) { sSpeed = nr; break; }
        }
        if (sSpeed === 0) sSpeed = R.governed;
        var minN = 0;
        for (var nr2 = R.governed + 200; nr2 >= (R.idleRpm || 700); nr2 -= 5) {
          var Te2 = motorFn(nr2); var Cp2 = (nr2 * nr2) / (K0 * K0) + ptd;
          if (Te2 >= Cp2) { minN = nr2; break; }
        }
        // SR at governed: kpump(SR) = N_gov / sqrt(T_pump_gov) ters çözüm
        var srG = 0;
        var _tPumpGov = motorFn(R.governed) - ptd;
        if (_tPumpGov > 0) {
          var _kpNeeded = R.governed / Math.sqrt(_tPumpGov);
          var _tcD = tc.data;
          for (var _si = 0; _si < _tcD.length - 1; _si++) {
            var _kp1 = _tcD[_si].kpump, _kp2 = _tcD[_si + 1].kpump;
            if ((_kp1 <= _kpNeeded && _kpNeeded <= _kp2) || (_kp2 <= _kpNeeded && _kpNeeded <= _kp1)) {
              var _f = (_kpNeeded - _kp1) / (_kp2 - _kp1);
              if (_f >= 0 && _f <= 1) { srG = _tcD[_si].sr + _f * (_tcD[_si + 1].sr - _tcD[_si].sr); break; }
            }
          }
          if (srG === 0 && _kpNeeded > _tcD[_tcD.length - 1].kpump) srG = 0.99;
        }
        var tTS = motorFn(sSpeed) * sTau;
        var c5 = minN >= (peakTorqueRpm - 50);
        var c7 = tTS <= (R.turbineRating || 3320);
        var c8 = srG >= 0.80;
        var st, sc;
        if (!_c9ok || !_c10ok) { st = 'unacceptable'; sc = 0; }
        else if (!c7) { st = 'unacceptable'; sc = 0; }
        else if (!c5) { st = 'not-recommended'; sc = 1; }
        else if (!c8) { st = 'caution'; sc = 2; }
        else { st = 'recommended'; sc = 3; }
        _ecmResults.push({ key: key, name: tc.name || key, stallTau: sTau, stallSpeed: sSpeed, minSpeed: minN, srGov: srG, tTurbineStall: tTS, c5ok: c5, c7ok: c7, c8ok: c8, c9ok: _c9ok, c10ok: _c10ok, status: st, score: sc });
        } catch(tcErr) { console.warn('[MFSim] ECM hesaplama hatası (' + key + '):', tcErr.message); }
      });
      _ecmResults.sort(function(a, b) { return b.score - a.score || b.srGov - a.srGov; });
    }
  } catch (e) { console.warn('ECM calc error:', e); }

  // Transfer bilgisi
  var hasTransfer = R.hasTransfer && R.transferGears && R.transferGears.length > 1;
  var trHighRatio = hasTransfer ? (R.transferGears[0].ratio || 1.0) : (R.transferGears && R.transferGears.length > 0 ? R.transferGears[0].ratio : 1.0);
  var trLowRatio = hasTransfer ? (R.transferGears[1].ratio || 1.0) : 1.0;

  // Shift profili
  var shiftProfile = R.shiftProfile || 'S1 PERFORMANCE';
  var lockupOffset = R.lockupOffset || 75;
  var shiftRefRPM = R.shiftRefRPM || R.governed || 2200;
  var lockupRPM = shiftRefRPM - lockupOffset;
  var spDataReport = VE_FT_SHIFT_PROFILES[R.shiftProfile] || {};

  // Aksesuar toplami
  var accTotal = 0, accTotalStd = 0;
  (R.accessories || []).forEach(function(a) { accTotalStd += (a.standardLoss || 0); accTotal += (a.userLoss || 0); });

  // Solver metodu
  var solverMethod = ss.method || 'rk4';
  var solverLabel = solverMethod === 'rk45' ? 'RK4/5 Adaptif' : solverMethod === 'rk4' ? 'RK4' : solverMethod === 'heun' ? 'Heun' : solverMethod === 'ralston' ? 'Ralston' : 'Euler';

  var r = '';

  // ════════════════════════════════════════════════════════════════════════
  // BMC BASLIK
  // ════════════════════════════════════════════════════════════════════════
  var _mInner = W - 2;
  function _mLine(c) { return '║' + pad(c, _mInner, 'left') + '║\n'; }
  function _mCenter(c) { return '║' + pad(c, _mInner, 'center') + '║\n'; }
  var _fig = [
    '██████╗ ███╗   ███╗ ██████╗',
    '██╔══██╗████╗ ████║██╔════╝',
    '██████╔╝██╔████╔██║██║     ',
    '██╔══██╗██║╚██╔╝██║██║     ',
    '██████╔╝██║ ╚═╝ ██║╚██████╗',
    '╚═════╝ ╚═╝     ╚═╝ ╚═════╝'
  ];
  var _figW = 0; for (var _fi = 0; _fi < _fig.length; _fi++) if (_fig[_fi].length > _figW) _figW = _fig[_fi].length;
  var _figSide = ['', '', 'BMC Otomotiv Sanayi ve Ticaret A.Ş.', 'Güç Grubu Müdürlüğü', '', ''];

  r += '\n';
  r += '╔' + rep('═', _mInner) + '╗\n';
  r += _mLine('');
  for (var _mi = 0; _mi < _fig.length; _mi++) {
    r += _mLine('   ' + pad(_fig[_mi], _figW, 'left') + '     ' + (_figSide[_mi] || ''));
  }
  r += _mLine('');
  r += '╟' + rep('─', _mInner) + '╢\n';
  r += _mCenter('TAM GAZ HIZLANMA  ·  PERFORMANS HESAP RAPORU');
  r += '╚' + rep('═', _mInner) + '╝\n\n';

  // ── RAPOR BILGILERI (baslikli panel, iki kolon) ──
  function _kv(k, v, kw) { return pad(tr(k), kw || 15, 'left') + ': ' + tr(v); }
  var _infoLines = [
    pad(_kv('Rapor Tarihi', tarih), 40) + _kv('Hazırlayan', tr(hazirlayan)),
    pad(_kv('Rapor Saati', saat), 40) + _kv('Çözücü', solverLabel),
    pad(_kv('Rapor No', raporNo), 40) + _kv('Shift Profili', tr(shiftProfile)),
    _kv('Hesaplama Modu', 'MFSim Tam Gaz Hızlanma')
  ];
  r += titledBox('RAPOR BİLGİLERİ', _infoLines, W) + '\n';

  // ── PERFORMANS ÖZETİ (girişte özet tablo — Derecelendirme panelinden önce) ──
  // Performans Özet Tablosu — Unicode kutu, kategori başlıklı.
  function boxTable(sections) {
    function clip(s, w) { s = tr(s); return s.length > w ? s.slice(0, w - 1) + '…' : s; }
    var inner = W - 4, L = 32, V = 40;   // '  │ ' + L + '│ ' + V + ' │' = 80
    var hd = '─ PERFORMANS ÖZET TABLOSU ';
    function mid() { return '  ├' + rep('─', inner) + '┤\n'; }
    var rb = '  ┌' + hd + rep('─', Math.max(0, inner - hd.length)) + '┐\n';
    sections.forEach(function(sec) {
      rb += mid();
      rb += '  │ ' + pad(clip(sec.title, inner - 2), inner - 2, 'left') + ' │\n';
      rb += mid();
      sec.rows.forEach(function(row) {
        rb += '  │ ' + pad(clip(row.label, L), L) + '│ ' + pad(clip(row.value, V), V) + ' │\n';
      });
    });
    return rb + '  └' + rep('─', inner) + '┘\n';
  }

  var gvwTon = R.gvw / 1000;
  var pwRatio = peakPower / gvwTon;
  var tqRatio = peakTorque / gvwTon;

  var boxSections = [];

  // Genel Bilgiler — motor adındaki " | tork&güç" etiketini ayır (yalnız görünen ad)
  var genelRows = [
    { label: 'Motor', value: tr(String(R.engineName).split(' | ')[0]) },
    { label: 'Şanzıman', value: tr(R.gbName) }
  ];
  if (R.hasTC) genelRows.push({ label: 'Tork Konvertörü', value: tr(R.tcName) });
  genelRows.push({ label: 'Brüt Ağırlık (GVW)', value: numI(R.gvw) + ' kg' });
  genelRows.push({ label: 'Güç / Ağırlık Oranı', value: num(pwRatio, 2) + ' kW/ton' });
  genelRows.push({ label: 'Tork / Ağırlık Oranı', value: num(tqRatio, 1) + ' N·m/ton' });
  boxSections.push({ title: 'GENEL BİLGİLER', rows: genelRows });

  boxSections.push({ title: 'MOTOR PERFORMANSI', rows: [
    { label: 'Maksimum Güç', value: num(peakPower, 1) + ' kW @ ' + numI(peakPowerRpm) + ' rpm' },
    { label: 'Maksimum Tork', value: numI(peakTorque) + ' N·m @ ' + numI(peakTorqueRpm) + ' rpm' },
    { label: 'Governed Devir', value: numI(R.governed) + ' rpm' },
    { label: 'Governed Güç', value: num(govPower, 1) + ' kW' }
  ]});

  if (G && G.high) {
    var gH2 = G.high;
    var eRows = [
      { label: 'Stall Eğim (Durma)', value: '%' + num(gH2.stallGrade, 1) },
      { label: 'Launch Eğim (Kalkış)', value: '%' + num(gH2.launchGrade, 1) },
      { label: 'Düz Yol Maks. Hız', value: num(gH2.maxSpeedFlat, 1) + ' km/h' }
    ];
    [5, 10, 20].forEach(function(gr) {
      (gH2.gradeTable || []).forEach(function(row) {
        if (Math.abs(row.grade - gr) < 0.1 && row.v_max > 0) {
          eRows.push({ label: '%' + gr + ' Eğimde Maks. Hız', value: num(row.v_max, 1) + ' km/h' });
        }
      });
    });
    boxSections.push({ title: 'EĞİM KABİLİYETİ', rows: eRows });
  }

  if (A && A.high) {
    var aRows = [];
    [30, 60, 80].forEach(function(spd) {
      (A.high.rows || []).forEach(function(row) {
        if (row.targetSpeed === spd) {
          if (row.time !== null && row.time !== undefined) {
            aRows.push({ label: '0 → ' + spd + ' km/h Süresi', value: num(row.time, 1) + ' sn / ' + numI(row.distance) + ' m' });
          } else {
            aRows.push({ label: '0 → ' + spd + ' km/h Süresi', value: 'Ulaşılamıyor' });
          }
        }
      });
    });
    var lastRow = null;
    (A.high.rows || []).forEach(function(row) { if (row.time !== null && row.time !== undefined) lastRow = row; });
    if (lastRow) {
      aRows.push({ label: '0 → Maks. Hız Süresi', value: num(lastRow.time, 1) + ' sn / ' + numI(lastRow.distance) + ' m' });
    }
    boxSections.push({ title: 'HIZLANMA PERFORMANSI', rows: aRows });
  }

  if (stepsHigh.length > 0) {
    // numGears/govStep/maxHeat — bu blok artık Bölüm 4'ten ÖNCE olduğundan burada hesaplanır.
    var _pgSet = {};
    stepsHigh.forEach(function(s) { _pgSet[s.gear.replace(/[CL]$/, '')] = true; });
    var numGears = Object.keys(_pgSet).length;
    var govStep = null, maxHeat = 0;
    stepsHigh.forEach(function(s) { if (s.matchPoint === 'Governed') govStep = s; if (s.heatRejection > maxHeat) maxHeat = s.heatRejection; });
    var firstTransition = null, lastTransition = null;
    for (var t = 1; t < stepsHigh.length; t++) {
      if (stepsHigh[t - 1].gear !== stepsHigh[t].gear) {
        if (!firstTransition) firstTransition = { speed: stepsHigh[t].speed };
        lastTransition = { speed: stepsHigh[t].speed };
      }
    }
    var vRows = [
      { label: 'Toplam Vites Sayısı (Kullanılan)', value: String(numGears) }
    ];
    if (firstTransition) vRows.push({ label: '1 → 2 Geçiş Hızı', value: num(firstTransition.speed, 1) + ' km/h' });
    if (lastTransition) vRows.push({ label: 'Son Vites Geçiş Hızı', value: num(lastTransition.speed, 1) + ' km/h' });
    vRows.push({ label: 'Stall Çekiş Kuvveti', value: num(stepsHigh[0].te, 2) + ' kN' });
    if (govStep) vRows.push({ label: 'Governed Hız', value: num(govStep.speed, 1) + ' km/h' });
    if (maxHeat > 0) vRows.push({ label: 'Maks. Isı Reddi', value: num(maxHeat, 1) + ' kW' });
    boxSections.push({ title: 'VİTES GEÇİŞLERİ', rows: vRows });
  }

  // Konvertör Eşleşmesi — YALNIZ tork konvertörü varsa
  if (R.hasTC && _ecmResults.length > 0) {
    var selEC = _ecmResults.find(function(e) { return e.name === R.tcName; }) || _ecmResults[0];
    var durStr = selEC.status === 'recommended' ? 'Önerilen' : selEC.status === 'caution' ? 'Dikkat' : 'Önerilmez';
    boxSections.push({ title: 'KONVERTÖR EŞLEŞMESİ', rows: [
      { label: 'Eşleme Durumu', value: durStr + ' (' + tr(selEC.name) + ')' },
      { label: 'SR @ Governed', value: num(selEC.srGov, 3) },
      { label: 'Türbin Torku @ Stall', value: numI(selEC.tTurbineStall) + ' N·m' }
    ]});
  }

  r += boxTable(boxSections) + '\n';

  // ── DERECELENDİRME VE KILAVUZ KONTROLÜ (girişte özet uygunluk paneli) ──
  // Özgün MFSim şeması: K=Konvertör, S=Şanzıman, A=Araç. Tüm değerler kendi
  // simülasyonumuzdan (ECM / şanzıman limitleri / gradeability) — validasyonlu
  // mevcut hesaplar yeniden sunulur, yeni numerik icat edilmez.
  r += (function(){
    function clip(x, w){ x = tr(x); return x.length > w ? x.slice(0, w-1) + '…' : x; }
    function mk(code, label, detail, st, stLabel){ return { code:code, label:label, detail:detail, st:st, stLabel:stLabel }; }
    var cats = [];

    // KONVERTÖR — ECM sonucundan. YALNIZ seçili TK gerçekten değerlendirildiyse
    // göster; eşleşme yoksa (ör. preset dışı özel TK) yanıltıcı fallback yerine
    // kategoriyi hiç gösterme.
    var ec = (R.hasTC && _ecmResults.length > 0) ? _ecmResults.find(function(e){ return e.name === R.tcName; }) : null;
    if (ec) {
      var k1st = ec.status === 'recommended' ? 'ok' : ec.status === 'caution' ? 'warn' : 'bad';
      var k1lb = ec.status === 'recommended' ? 'Uygun' : ec.status === 'caution' ? 'Dikkat' : ec.status === 'not-recommended' ? 'Önerilmez' : 'Uygun Değil';
      var thrMin = Math.round(peakTorqueRpm - 50);
      var thrTurb = Math.round(R.turbineRating || 3320);
      cats.push({ title:'KONVERTÖR', rows:[
        mk('K01', 'Motor–Konvertör Eşleşmesi', clip(ec.name, 24), k1st, k1lb),
        mk('K02', 'Stall Tork Oranı (TR)', num(ec.stallTau, 3), 'ref'),
        mk('K03', 'Stall Motor Devri', numI(ec.stallSpeed) + ' rpm', 'ref'),
        mk('K04', 'Min. Konvertör Çalışma Devri', numI(ec.minSpeed) + ' ≥ ' + thrMin + ' rpm', ec.c5ok ? 'ok' : 'warn'),
        mk('K05', 'Stall Türbin Torku', numI(ec.tTurbineStall) + ' ≤ ' + thrTurb + ' N·m', ec.c7ok ? 'ok' : 'bad'),
        mk('K06', 'Governed Hız Oranı (SR)', num(ec.srGov, 3) + ' ≥ 0.80', ec.c8ok ? 'ok' : 'warn')
      ]});
    }

    // ŞANZIMAN — preset giriş/çıkış limitlerinden
    var sRows = [];
    if (_gbLimits.grossInputTorque != null) {
      sRows.push(mk('S01', 'Giriş Torku (Brüt)', numI(_torqueAtGov) + ' ≤ ' + numI(_gbLimits.grossInputTorque) + ' N·m', _c10ok ? 'ok' : 'bad'));
    }
    if (_gbLimits.grossInputPower != null) {
      sRows.push(mk('S02', 'Giriş Gücü (Brüt)', numI(_powerAtGov) + ' ≤ ' + numI(_gbLimits.grossInputPower) + ' kW', _c9ok ? 'ok' : 'bad'));
    }
    if (_gbLimits.maxOutputSpeed != null && stepsHigh.length > 0) {
      var maxOut = 0; for (var _oi = 0; _oi < stepsHigh.length; _oi++) if (stepsHigh[_oi].outputRPM > maxOut) maxOut = stepsHigh[_oi].outputRPM;
      sRows.push(mk('S03', 'Maks. Çıkış Devri', numI(maxOut) + ' ≤ ' + numI(_gbLimits.maxOutputSpeed) + ' rpm', maxOut <= _gbLimits.maxOutputSpeed ? 'ok' : 'bad'));
    }
    if (sRows.length) cats.push({ title:'ŞANZIMAN', rows:sRows });

    // ARAÇ — gradeability referansları (eşiksiz, bilgi)
    if (G && G.high) {
      var aRows = [ mk('A01', 'Düz Yolda Maks. Hız', num(G.high.maxSpeedFlat, 1) + ' km/h', 'ref') ];
      if (G.high.stallGrade != null) aRows.push(mk('A02', 'Stall Tırmanış Kabiliyeti', '%' + num(G.high.stallGrade, 1), 'ref'));
      if (G.high.lowSpeedGrade != null) aRows.push(mk('A03', 'Düşük Hız Tırmanış (%80)', '%' + num(G.high.lowSpeedGrade, 1) + ' @ ' + num(G.high.lowSpeedV, 1) + ' km/h', 'ref'));
      cats.push({ title:'ARAÇ', rows:aRows });
    }

    if (!cats.length) return '';

    // NOT: ✓ ✗ ⚠ (Dingbat/emoji) bazı monospace fontlarda çift-genişlik çizilip
    // çerçeveyi taşırır. Hizada güvenli (tek-genişlik) ASCII/Latin-1 işaretler.
    var STG = { ok:'+', warn:'!', bad:'×', ref:'·' };
    var STL = { ok:'Uygun', warn:'Dikkat', bad:'Uygun Değil', ref:'Referans' };
    var inner = W - 4;                                  // '  ┌' + inner + '┐'
    var CW = { code:5, label:32, detail:24, st:13 };    // 5+32+24+13 = 74 = inner-2
    function bLine(t){ if (t.length > inner-2) t = t.slice(0, inner-3) + '…'; return '  │ ' + pad(t, inner-2, 'left') + ' │\n'; }
    function mRule(){ return '  ├' + rep('─', inner) + '┤\n'; }

    var hd = '─ DERECELENDİRME VE KILAVUZ KONTROLÜ ';
    var s = '  ┌' + hd + rep('─', Math.max(0, inner - hd.length)) + '┐\n';

    for (var ci = 0; ci < cats.length; ci++) {
      var cat = cats[ci], hasBad = false, hasWarn = false, hasPF = false;
      for (var ri = 0; ri < cat.rows.length; ri++) {
        var st = cat.rows[ri].st;
        if (st !== 'ref') { hasPF = true; if (st === 'bad') hasBad = true; else if (st === 'warn') hasWarn = true; }
      }
      var score = !hasPF ? '' : hasBad ? '× İNCELE' : hasWarn ? '! DİKKAT' : '+ UYGUN';
      s += mRule();
      s += bLine(pad(cat.title, (inner-2) - score.length) + score);
      s += mRule();
      for (var ri2 = 0; ri2 < cat.rows.length; ri2++) {
        var rw = cat.rows[ri2];
        var stStr = STG[rw.st] + ' ' + (rw.stLabel || STL[rw.st]);
        s += bLine(pad(rw.code, CW.code) + pad(clip(rw.label, CW.label), CW.label) + pad(clip(rw.detail, CW.detail), CW.detail) + pad(stStr, CW.st, 'right'));
      }
    }
    s += '  └' + rep('─', inner) + '┘\n';
    return s + '\n';
  })();

  // ════════════════════════════════════════════════════════════════════════
  // 1. PLATFORM VE ARAC OZELLIKLERI
  // ════════════════════════════════════════════════════════════════════════
  r += '\n' + sectionBanner('1  ·  PLATFORM VE ARAÇ ÖZELLİKLERİ', W);

  var revPerKm = Math.round(1000 / (2 * Math.PI * R.tireRadius));

  r += titledBox('ALAN VE AĞIRLIK', [
    _kv('Alın Alanı', num(R.frontalArea, 3) + ' m²', 22),
    _kv('Yükseklik / Genişlik', num(R.height, 3) + ' / ' + num(R.width, 3) + ' m', 22),
    _kv('Aerodinamik Cd', num(R.cd, 3), 22),
    _kv('Brüt Ağırlık (GVW)', numI(R.gvw) + ' kg', 22)
  ], W) + '\n';

  r += titledBox('LASTİKLER', [
    _kv('Seçili Lastik', tr(R.tireName), 22),
    _kv('Lastik Devir/km', revPerKm + ' devir/km', 22),
    _kv('Yuvarlanma Yarıçapı', num(R.tireRadius, 3) + ' m', 22),
    _kv('Yuvarlanma Direnci (Crr)', num(R.crr, 4), 22),
    _kv('Yüzey Faktörü', num(R.surfFactor || 1.0, 2), 22),
    _kv('Lastik/Teker Ataleti', num(R.tireInertia, 4) + ' kg·m²', 22)
  ], W) + '\n';


  // ════════════════════════════════════════════════════════════════════════
  // 2. TAM GAZ EGIM KABILIYETI
  // ════════════════════════════════════════════════════════════════════════
  r += sectionBanner('2  ·  TAM GAZ EĞİM KABİLİYETİ', W);

  var _c2 = ['Motor Fanı: Açık', 'Klima: Kapalı', 'Motor Gücü: Standart Güç Eğrisi', 'Araç Parametreleri: Standart', 'Aks Oranı: ' + num(R.diffRatio, 3)];
  if (hasTransfer) _c2.push('Transfer Kutusu: ' + num(trHighRatio, 3));
  r += condStrip('KOŞULLAR', _c2) + '\n';

  function renderGradeSection(gd) {
    var rg = '';
    var _w = [29, 9, 12, 8, 12];
    var _al = ['left', 'right', 'right', 'right', 'right'];
    if (hasTransfer) {
      rg += '  ▸ Transfer Kutusu: ' + tr(gd.label).replace(/^Transfer Kutusu:\s*/i, '') + '\n';
    }
    rg += tRule(_w, '┌', '┬', '┐', '─');
    rg += tRow(['Eğim Kabiliyeti', '% Eğim', 'Hız (km/h)', 'Vites', 'Eşleme'], _w, _al);
    rg += tRule(_w, '├', '┼', '┤', '─');
    rg += tRow(['Durma Eğim Kab. (Stall)', num(gd.stallGrade, 1), '–', gd.stallGear, 'Stall'], _w, _al);
    rg += tRow(['Kalkış Eğim Kab. (Launch)', num(gd.launchGrade, 1), '–', gd.launchGear, ''], _w, _al);
    rg += tRow(['Düşük Hız Eğim Kabiliyeti', num(gd.lowSpeedGrade, 1), num(gd.lowSpeedV, 1), gd.lowSpeedGear, '%80'], _w, _al);
    rg += tRow(['Düz Yolda Maksimum Hız', '0.0', num(gd.maxSpeedFlat, 1), gd.maxSpeedFlatGear, 'Yol Yükü'], _w, _al);
    (gd.gradeTable || []).forEach(function(row) {
      if (row.v_max <= 0 && row.grade > 0) return;
      rg += tRow(['', num(row.grade, 1), num(row.v_max, 1), row.gear, ''], _w, _al);
    });
    rg += tRule(_w, '└', '┴', '┘', '─');
    return rg;
  }

  if (G && G.high) {
    r += renderGradeSection(G.high);
    if (G.low) {
      r += '\n';
      r += renderGradeSection(G.low);
    }

    var gH = G.high;
    var _y2 = 'Bu araç, durma konumundan ';
    if (gH.stallGrade >= 60) _y2 += 'çok dik eğimlerde (>%60) dahi kalkış yapabilecek çekiş kuvvetine sahiptir.';
    else if (gH.stallGrade >= 30) _y2 += 'yüksek arazi eğimlerinde (%' + num(gH.stallGrade, 0) + ') kalkış yapabilecek çekiş kuvvetine sahiptir.';
    else _y2 += 'orta eğimlerde (%' + num(gH.stallGrade, 0) + ') kalkış yapabilir.';
    _y2 += ' Düz yolda (%0 eğim) araç maksimum ' + num(gH.maxSpeedFlat, 1) + ' km/h hıza ulaşabilir.';
    var v5 = '–', v10 = '–';
    (gH.gradeTable || []).forEach(function(row) {
      if (Math.abs(row.grade - 5.0) < 0.1) v5 = num(row.v_max, 0);
      if (Math.abs(row.grade - 10.0) < 0.1) v10 = num(row.v_max, 0);
    });
    _y2 += ' %5 eğimde (tipik karayolu rampası) araç ' + v5 + ' km/h ile seyredebilir. %10 eğimde (dik yokuş) araç ' + v10 + ' km/h ile ilerleyebilir.';
    r += '\n' + noteBox('YORUM', _y2, W);
  } else {
    r += '  Eğim kabiliyeti verisi bulunamadı.\n';
  }
  r += '\n\n';

  // ════════════════════════════════════════════════════════════════════════
  // 3. TAM GAZ HIZLANMA
  // ════════════════════════════════════════════════════════════════════════
  r += sectionBanner('3  ·  TAM GAZ HIZLANMA', W);

  var _c3 = ['Motor Fanı: Açık', 'Klima: Kapalı', 'Aks Oranı: ' + num(R.diffRatio, 3)];
  if (hasTransfer) _c3.push('Transfer: ' + num(trHighRatio, 3));
  r += condStrip('KOŞULLAR', _c3) + '\n';

  function renderAccelSection(ad) {
    var ra = '';
    var _w = [26, 16, 16];
    if (A.low) {
      ra += '  ▸ Transfer Kutusu: ' + tr(ad.label).replace(/^Transfer Kutusu:\s*/i, '') + '\n';
    }
    ra += tRule(_w, '┌', '┬', '┐', '─');
    ra += tRow(['Hedef Hız', 'Süre (sn)', 'Mesafe (m)'], _w, ['left', 'right', 'right']);
    ra += tRule(_w, '├', '┼', '┤', '─');
    (ad.rows || []).forEach(function(row) {
      var label = '0 → ' + pad(String(row.targetSpeed), 3, 'right') + ' km/h';
      if (row.time === null || row.time === undefined) {
        ra += tRow([label, 'ulaşılamıyor', '–'], _w, ['left', 'right', 'right']);
      } else {
        ra += tRow([label, num(row.time, 1), numI(row.distance)], _w, ['left', 'right', 'right']);
      }
    });
    ra += tRule(_w, '└', '┴', '┘', '─');
    return ra;
  }

  if (A && A.high) {
    r += renderAccelSection(A.high);
    if (A.low) {
      r += '\n';
      r += renderAccelSection(A.low);
    }

    // Hizlanma yorumu → not kutusu
    var aH = A.high;
    var a60 = null, a100 = null;
    (aH.rows || []).forEach(function(row) {
      if (row.targetSpeed === 60 && row.time !== null) a60 = row;
      if (row.targetSpeed === 100 && row.time !== null) a100 = row;
    });
    var _yorum = '';
    if (a60) _yorum += 'Araç, 0\'dan 60 km/h hıza ' + num(a60.time, 1) + ' saniyede, ' + numI(a60.distance) + ' metre mesafede ulaşmaktadır. ';
    if (a100) _yorum += '0–100 km/h hızlanma ' + num(a100.time, 1) + ' saniyede ' + numI(a100.distance) + ' metrede tamamlanmaktadır.';
    else if (a60) _yorum += 'Araç 100 km/h hıza ulaşamamaktadır.';
    if (_yorum) r += '\n' + noteBox('YORUM', _yorum, W);
  } else {
    r += '  Hızlanma verisi bulunamadı.\n';
  }
  r += '\n\n';

  // ════════════════════════════════════════════════════════════════════════
  // KONVERTOR MODU (MOTOR-KONVERTOR ESLEME TABLOSU)
  // ════════════════════════════════════════════════════════════════════════
  if (R.tcData && R.tcData.length >= 2 && R.torqueData && R.torqueData.length >= 2) {
    var _cmTcFns = FT_SOLVER.createTCFunctions(R.tcData);
    var _cmGrossMotorFn = FT_SOLVER.createMotorTorqueFn(R.torqueData, R.governed, R.noLoad);
    var _cmPumpDrop = R.pumpDrop || 17.6;
    var _cmIdleRpm = R.idleRpm || 700;
    var _cmGovSpeed = R.governed || 2100;
    var _cmNoLoad = R.noLoad || 2350;
    var _cmFanLoss = R.fanLossGov || 0;
    var _cmOtherLoss = R.otherLossGov || 0;
    var _cmFanMode = R.accFanMode || 'on';
    var _cmHasAccLoss = (_cmFanLoss + _cmOtherLoss) > 0;

    // NET motor tork fonksiyonu (brut - aksesuar kayiplari)
    // iSCAAN "Net Torque Fan On" egrisine karsilik gelir
    function _cmNetMotorFn(rpm) {
      var T_gross = _cmGrossMotorFn(rpm);
      if (!_cmHasAccLoss || rpm <= 0) return T_gross;
      var ratio = rpm / _cmGovSpeed;
      var P_fan_kW = (_cmFanMode === 'on') ? _cmFanLoss : _cmFanLoss * ratio * ratio * ratio;
      var P_loss_kW = P_fan_kW + _cmOtherLoss * ratio;
      var omega = 2 * Math.PI * rpm / 60;
      var T_loss = omega > 0 ? P_loss_kW * 1000 / omega : 0;
      return Math.max(0, T_gross - T_loss);
    }

    // Coupling SR — interpolasyonla hassas hesapla (tau = 1.0 gecis noktasi)
    var _cmCouplingSR = 0.88;
    var _cmTcD = R.tcData.slice().sort(function(a, b) { return a.sr - b.sr; });
    for (var _cpi = 0; _cpi < _cmTcD.length - 1; _cpi++) {
      var _t1 = _cmTcD[_cpi].tau, _t2 = _cmTcD[_cpi + 1].tau;
      if (_t1 > 1.0 && _t2 <= 1.0) {
        var _f = (_t1 - 1.0) / (_t1 - _t2);
        _cmCouplingSR = _cmTcD[_cpi].sr + _f * (_cmTcD[_cpi + 1].sr - _cmTcD[_cpi].sr);
        break;
      }
      if (Math.abs(_t1 - 1.0) < 0.005) { _cmCouplingSR = _cmTcD[_cpi].sr; break; }
    }
    _cmCouplingSR = Math.round(_cmCouplingSR * 1000) / 1000;

    // Temel SR listesi
    var _cmBaseSRs = [0.00, 0.10, 0.20, 0.30, 0.40, 0.50, 0.60, 0.634, 0.70, 0.75, 0.80, 0.825, 0.90, 0.925, 0.935, 0.945, 0.950, 0.975, 0.99];

    // Match point SR'lerini bul (eta = SR x TR hedef degerlere ulastigi noktalar)
    var _cmSpecialSRs = [];
    var _cmTargets = [{ eta: 0.70 }, { eta: 0.80 }, { eta: 0.85 }];
    for (var _ti = 0; _ti < _cmTargets.length; _ti++) {
      var _target = _cmTargets[_ti].eta;
      var _srLo = 0.01, _srHi = _cmCouplingSR;
      for (var _bi = 0; _bi < 50; _bi++) {
        var _srMid = (_srLo + _srHi) / 2;
        var _etaMid = _srMid * _cmTcFns.tau(_srMid);
        if (_etaMid < _target) _srLo = _srMid; else _srHi = _srMid;
        if (Math.abs(_srHi - _srLo) < 0.0005) break;
      }
      _cmSpecialSRs.push(Math.round((_srLo + _srHi) / 2 * 1000) / 1000);
    }
    // Coupling noktasi
    _cmSpecialSRs.push(_cmCouplingSR);

    // Ozel SR'leri temel listeye ekle (henuz yoksa)
    for (var _si = 0; _si < _cmSpecialSRs.length; _si++) {
      var _exists = false;
      for (var _ei = 0; _ei < _cmBaseSRs.length; _ei++) {
        if (Math.abs(_cmBaseSRs[_ei] - _cmSpecialSRs[_si]) < 0.003) { _exists = true; break; }
      }
      if (!_exists) _cmBaseSRs.push(_cmSpecialSRs[_si]);
    }
    _cmBaseSRs.sort(function(a, b) { return a - b; });

    // Governed SR'yi bul: T_net(gov) - pumpDrop = (gov / K_pump(SR))^2
    var _cmTnetGov = _cmNetMotorFn(_cmGovSpeed);
    var _cmTpumpGov = _cmTnetGov - _cmPumpDrop;
    if (_cmTpumpGov > 0) {
      var _cmKneeded = _cmGovSpeed / Math.sqrt(_cmTpumpGov);
      var _cmSrGov = 0;
      for (var _ki = 0; _ki < 990; _ki++) {
        var _srTest = _ki / 1000;
        if (_cmTcFns.kpump(_srTest) >= _cmKneeded) { _cmSrGov = _srTest; break; }
      }
      if (_cmSrGov > 0) {
        var _sgLo = Math.max(0, _cmSrGov - 0.01), _sgHi = Math.min(0.99, _cmSrGov + 0.01);
        for (var _sgi = 0; _sgi < 30; _sgi++) {
          var _sgMid = (_sgLo + _sgHi) / 2;
          if (_cmTcFns.kpump(_sgMid) < _cmKneeded) _sgLo = _sgMid; else _sgHi = _sgMid;
        }
        _cmSrGov = Math.round((_sgLo + _sgHi) / 2 * 1000) / 1000;
        var _govExists = false;
        for (var _ge = 0; _ge < _cmBaseSRs.length; _ge++) {
          if (Math.abs(_cmBaseSRs[_ge] - _cmSrGov) < 0.003) { _govExists = true; break; }
        }
        if (!_govExists) {
          _cmBaseSRs.push(_cmSrGov);
          _cmBaseSRs.sort(function(a, b) { return a - b; });
        }
      }
    }

    // Her SR icin denge noktasini hesapla
    var _cmTable = [];
    for (var _ci = 0; _ci < _cmBaseSRs.length; _ci++) {
      var _sr = _cmBaseSRs[_ci];
      var _Km = _cmTcFns.kpump(_sr);
      var _TRm = _cmTcFns.tau(_sr);

      // Bisection: T_net(N) - pumpDrop - (N / K_pump)^2 = 0
      // Droop bolgesi dahil — ust sinir noLoadGoverned
      var _bLo = _cmIdleRpm, _bHi = _cmNoLoad;
      var _fLo = _cmNetMotorFn(_bLo) - _cmPumpDrop - (_bLo / _Km) * (_bLo / _Km);
      var _fHi = _cmNetMotorFn(_bHi) - _cmPumpDrop - (_bHi / _Km) * (_bHi / _Km);

      // noLoad'da tork=0 oldugu icin fHi her zaman negatif olmali.
      // Eger idle'da bile motor torku yetersizse, idle kullan.
      var _Nm;
      if (_fLo < 0) {
        _Nm = _cmIdleRpm;
      } else {
        // Bisection cozumu
        for (var _it = 0; _it < 60; _it++) {
          var _bMid = (_bLo + _bHi) / 2;
          var _fMid = _cmNetMotorFn(_bMid) - _cmPumpDrop - (_bMid / _Km) * (_bMid / _Km);
          if (Math.abs(_fMid) < 0.05) { _bLo = _bMid; _bHi = _bMid; break; }
          if (_fLo * _fMid > 0) { _bLo = _bMid; _fLo = _fMid; } else { _bHi = _bMid; _fHi = _fMid; }
        }
        _Nm = (_bLo + _bHi) / 2;
      }

      var _TeF = _cmNetMotorFn(_Nm);
      var _TpF = (_Nm / _Km) * (_Nm / _Km);
      var _TtF = _TpF * _TRm;
      var _NtF = _Nm * _sr;
      var _PeF = _TeF * _Nm * 2 * Math.PI / 60 / 1000;
      var _PtF = _TtF * _NtF * 2 * Math.PI / 60 / 1000;
      var _QrF = _PeF - _PtF;
      var _etaF = _sr * _TRm;

      // Match point belirleme
      var _mpF = '';
      if (_sr === 0) _mpF = 'Durma';
      else if (Math.abs(_etaF - 0.70) < 0.015) _mpF = 'Yuzde 70';
      else if (Math.abs(_etaF - 0.80) < 0.015) _mpF = 'Yuzde 80';
      else if (Math.abs(_etaF - 0.85) < 0.015) _mpF = 'Yuzde 85';
      else if (Math.abs(_TRm - 1.0) < 0.01) _mpF = 'Kavrama';
      if (_Nm >= _cmGovSpeed - 5 && _mpF === '') _mpF = 'Governed';

      _cmTable.push({
        SR: _sr, TR: _TRm, N_engine: Math.round(_Nm), T_engine: Math.round(_TeF * 10) / 10,
        P_engine: Math.round(_PeF * 10) / 10, N_turbine: Math.round(_NtF),
        T_turbine: Math.round(_TtF * 10) / 10, P_turbine: Math.round(_PtF * 10) / 10,
        Q_reject: Math.round(_QrF * 100) / 100, matchPoint: _mpF
      });
    }

    // Banner + kosul seridi + kutulu 10-kolon tablo
    r += sectionBanner('KONVERTÖR MODU  —  TÜM KADEMELER', W);
    r += condStrip('KOŞULLAR', ['Motor Fanı: Açık', 'Klima: Kapalı', 'Motor Gücü: Standart Güç Eğrisi', 'Araç Parametreleri: Standart']) + '\n';

    var _cw = [8, 8, 9, 11, 11, 9, 11, 10, 12, 14];
    var _cal = ['right','right','right','right','right','right','right','right','right','right'];
    r += tRule(_cw, '┌', '┬', '┐', '─');
    r += tRow(['Hız', 'Tork', 'Motor', 'Net Motor', 'Net Motor', 'Türbin', 'Türbin', 'Türbin', 'Konvertör', 'Eşleme'], _cw, _cal);
    r += tRow(['Oranı', 'Oranı', 'Devri', 'Torku', 'Gücü', 'Devri', 'Torku', 'Gücü', 'Isı Reddi', 'Noktası'], _cw, _cal);
    r += tRow(['', '', '(rpm)', '(N·m)', '(kW)', '(rpm)', '(N·m)', '(kW)', '(kW)', ''], _cw, _cal);
    r += tRule(_cw, '├', '┼', '┤', '─');
    for (var _ri = 0; _ri < _cmTable.length; _ri++) {
      var _row = _cmTable[_ri];
      r += tRow([num(_row.SR, 3), num(_row.TR, 3), numI(_row.N_engine), num(_row.T_engine, 1), num(_row.P_engine, 1), numI(_row.N_turbine), num(_row.T_turbine, 1), num(_row.P_turbine, 1), num(_row.Q_reject, 2), _row.matchPoint || ''], _cw, _cal);
    }
    r += tRule(_cw, '└', '┴', '┘', '─');
    r += '\n  Not: T_türbin = T_pompa × TR  ·  T_pompa = (N_motor / K_pompa)²  ·  Düşürme = ' + num(_cmPumpDrop, 1) + ' N·m\n';
    r += '       T_motor(N) − Düşürme = T_pompa(N) denklemi bisection ile çözülmüştür.\n\n';

    // ── ŞANZIMAN ÇIKIŞ PERFORMANSI — Konvertör Modu (vites başına) ──
    var _pgGears = R.allGearData || R.gearData || [];
    if (_pgGears.length > 0 && _cmTable.length > 0) {
      var _pw = [8, 9, 11, 11, 11, 11, 10, 11, 14];
      var _pal = ['right','right','right','right','right','right','right','right','right'];
      for (var _gi = 0; _gi < _pgGears.length; _gi++) {
        var _gear = _pgGears[_gi];
        var _gName = _gear.name || ('F' + (_gi + 1));
        var _gRatio = parseFloat(_gear.ratio) || 1.0;
        var _effStall = FT_SOLVER.calcGearEfficiency(_gRatio, 0);
        var _effGov = FT_SOLVER.calcGearEfficiency(_gRatio, _cmTable.length > 0 ? _cmTable[_cmTable.length - 1].N_turbine : 0);

        r += '  ▸ Vites ' + tr(_gName) + '  (Oran = ' + num(_gRatio, 3) + ')  —  Konvertör Modu\n';
        r += tRule(_pw, '┌', '┬', '┐', '─');
        r += tRow(['Hız', 'Motor', 'Net Motor', 'Net Motor', 'Şanzıman', 'Şanzıman', 'Şanzıman', 'Şanzıman', 'Eşleme'], _pw, _pal);
        r += tRow(['Oranı', 'Devri', 'Torku', 'Gücü', 'Çıkış', 'Çıkış', 'Çıkış', 'Isı', 'Noktası'], _pw, _pal);
        r += tRow(['', '(rpm)', '(N·m)', '(kW)', '(rpm)', '(N·m)', '(kW)', '(kW)', ''], _pw, _pal);
        r += tRule(_pw, '├', '┼', '┤', '─');
        for (var _pri = 0; _pri < _cmTable.length; _pri++) {
          var _pr = _cmTable[_pri];
          var _N_turb_pg = _pr.N_turbine;
          var _gEff = FT_SOLVER.calcGearEfficiency(_gRatio, _N_turb_pg);
          var _N_out = _N_turb_pg / _gRatio;
          var _T_out = _pr.T_turbine * _gRatio * _gEff;
          var _P_out = _T_out * (2 * Math.PI * _N_out / 60) / 1000;
          var _Q_gb = _pr.P_engine - _P_out;
          r += tRow([num(_pr.SR, 3), numI(_pr.N_engine), num(_pr.T_engine, 1), num(_pr.P_engine, 1), numI(Math.round(_N_out)), num(_T_out, 1), num(_P_out, 1), num(_Q_gb, 2), _pr.matchPoint || ''], _pw, _pal);
        }
        r += tRule(_pw, '└', '┴', '┘', '─');
        r += '  Dişli Verimi: %' + num(_effStall * 100, 2) + ' (stall) ~ %' + num(_effGov * 100, 2) + ' (governed)  ·  η = 1 − |ln(i)| × (0.0175 + 2.93e-6 × N_türbin)\n\n';
      }
    }
  }

  // ════════════════════════════════════════════════════════════════════════
  // 4. TAM GAZ OTOMATIK VITES GECISLERI (DETAYLI)
  // ════════════════════════════════════════════════════════════════════════
  r += sectionBanner('4  ·  TAM GAZ OTOMATİK VİTES GEÇİŞLERİ (DETAYLI)', W);

  var _c4 = ['Motor Fanı: Açık', 'Klima: Kapalı', 'Aks Oranı: ' + num(R.diffRatio, 3)];
  if (hasTransfer) _c4.push('Transfer Kutusu: ' + num(trHighRatio, 3));
  r += condStrip('KOŞULLAR', _c4) + '\n';

  function renderFTSection(steps, label) {
    var rf = '';
    var _w = [8, 9, 9, 9, 10, 11, 11, 10, 11, 18];
    var _al = ['left', 'right', 'right', 'right', 'right', 'right', 'right', 'right', 'right', 'right'];
    var _inner = 0; for (var _k = 0; _k < _w.length; _k++) _inner += _w[_k]; _inner += _w.length - 1;
    function _span(lbl) { var t = ' ' + lbl + ' '; var f = _inner - t.length; var l = Math.floor(f / 2); return '  ├' + rep('─', Math.max(0, l)) + t + rep('─', Math.max(0, f - l)) + '┤\n'; }
    if (hasTransfer && label) {
      rf += '  ▸ Transfer Kutusu: ' + tr(label).replace(/^Transfer Kutusu:\s*/i, '') + '\n';
    }
    rf += tRule(_w, '┌', '┬', '┐', '─');
    rf += tRow(['Vites', 'Hız', 'Motor', 'Çıkış', 'Çekiş', 'Net Çekiş', 'Tekerlek', 'Net Eğim', 'Isı Reddi', 'Eşleme'], _w, _al);
    rf += tRow(['Kademe', '(km/h)', '(rpm)', '(rpm)', '(kN)', '(kN)', 'Gücü (kW)', '(%)', '(kW)', 'Noktası'], _w, _al);
    rf += tRule(_w, '├', '┼', '┤', '─');

    var prevGear = '', hasNegative = false;
    for (var i = 0; i < steps.length; i++) {
      var s = steps[i];
      if (prevGear && s.gear !== prevGear) {
        rf += _span('vites geçişi: ' + prevGear + ' → ' + s.gear);
      }
      var dpStr = num(s.dp, 2), ngStr = num(s.netGrade, 2);
      if (s.dp < 0) { dpStr += '*'; hasNegative = true; }
      if (s.netGrade < 0) { ngStr += '*'; hasNegative = true; }
      rf += tRow([s.gear, num(s.speed, 1), numI(s.engineRPM), numI(s.outputRPM), num(s.te, 2), dpStr, num(s.wheelPower, 1), ngStr, num(s.heatRejection, 2), s.matchPoint || ''], _w, _al);
      prevGear = s.gear;
    }
    rf += tRule(_w, '└', '┴', '┘', '─');
    if (hasNegative) rf += '  * Negatif değerler aracın bu hızda ek dirence maruz kaldığını gösterir.\n';
    return rf;
  }

  if (stepsHigh.length > 0) {
    r += renderFTSection(stepsHigh, hasTransfer ? (G && G.high ? G.high.label : 'Yüksek Kademe') : '');
    if (stepsLow.length > 0) {
      r += '\n';
      r += renderFTSection(stepsLow, G && G.low ? G.low.label : 'Düşük Kademe');
    }

    r += '\n' + titledBox('SÜTUN AÇIKLAMALARI', [
      _kv('Vites Kademe', 'Vites no + mod (C = Konvertör, L = Lockup)', 15),
      _kv('Hız (km/h)', 'Araç hızı', 15),
      _kv('Motor (rpm)', 'Motor devri (konv. modda slip ile yüksek, lockup çıkışa eşit)', 15),
      _kv('Çıkış (rpm)', 'Şanzıman çıkış devri', 15),
      _kv('Çekiş (kN)', 'Tekerlek çevresindeki toplam çekiş kuvveti', 15),
      _kv('Net Çekiş (kN)', 'Çekişten tüm dirençler düşülünce kalan net kuvvet', 15),
      _kv('Tekerlek Gücü', 'Tekerlek çevresi gücü (kW)', 15),
      _kv('Net Eğim (%)', 'Bu hız/kuvvette tırmanılabilecek maks. eğim', 15),
      _kv('Isı Reddi (kW)', 'TK kayıp ısısı (lockup 0, konv. modda kaymayla orantılı)', 15),
      _kv('Eşleme Nokt.', 'Kritik referanslar (Durma, %70/80/85, Governed)', 15)
    ], W) + '\n';

    var numGears = 1, gearSet = {};
    stepsHigh.forEach(function(s) { gearSet[s.gear.replace(/[CL]$/, '')] = true; });
    numGears = Object.keys(gearSet).length;
    var s0 = stepsHigh[0];
    var govStep = null, maxHeat = 0;
    stepsHigh.forEach(function(s) {
      if (s.matchPoint === 'Governed') govStep = s;
      if (s.heatRejection > maxHeat) maxHeat = s.heatRejection;
    });

    var _y4 = 'Araç toplam ' + numGears + ' viteste tam gaz ivmelenme yapmaktadır. Stall noktasında (0 km/h) toplam çekiş kuvveti ' + num(s0.te, 1) + ' kN olup, bu koşulda araç %' + num(s0.netGrade, 1) + ' eğimi aşabilir.';
    if (govStep) _y4 += ' Motor governed devire (' + numI(govStep.engineRPM) + ' rpm) ' + num(govStep.speed, 1) + ' km/h hızda ulaşmaktadır.';
    if (maxHeat > 0) _y4 += ' Tork konvertörü maksimum ' + num(maxHeat, 1) + ' kW ısı reddi üretmektedir.';
    r += noteBox('YORUM', _y4, W);
  } else {
    r += '  FT vites geçişi verisi bulunamadı.\n';
  }
  r += '\n\n';

  // ════════════════════════════════════════════════════════════════════════
  // 5. ENERJI DENGESI ANALIZI
  // ════════════════════════════════════════════════════════════════════════
  r += sectionBanner('5  ·  ENERJİ DENGESİ ANALİZİ', W);

  var eb = ss.energyBalance;
  if (eb) {
    r += '  Motor  →  Tork Konv.  →  Şanzıman  →  Tekerlek  →  Yol\n\n';

    var _ew = [32, 13, 13], _eal = ['left', 'right', 'right'];
    r += '  GÜÇ AKIŞI DAĞILIMI\n';
    r += tRule(_ew, '┌', '┬', '┐', '─');
    r += tRow(['Güç Bileşeni', 'Maks (kW)', 'Ort. (kW)'], _ew, _eal);
    r += tRule(_ew, '├', '┼', '┤', '─');
    r += tRow(['Motor Gücü (P_engine)', num(eb.maxP_engine, 1), num(eb.avgP_engine, 1)], _ew, _eal);
    r += tRow(['TK Isı Kaybı (P_TC)', num(eb.maxP_TC_heat, 1), num(eb.avgP_TC_heat, 1)], _ew, _eal);
    r += tRow(['Güç Aktarma Kaybı (P_dt)', num(eb.maxP_drivetrain, 1), num(eb.avgP_drivetrain, 1)], _ew, _eal);
    r += tRow(['Tekerlek Gücü (P_wheel)', num(eb.maxP_wheel, 1), num(eb.avgP_wheel, 1)], _ew, _eal);
    r += tRule(_ew, '└', '┴', '┘', '─');
    r += '\n';

    var _tw = [40, 16];
    r += '  TEKERLEK GÜCÜ DAĞILIMI (Ortalama)\n';
    r += tRule(_tw, '┌', '┬', '┐', '─');
    r += tRow(['Yuvarlanma Direnci (P_rolling)', num(eb.avgP_rolling, 1) + ' kW'], _tw, ['left', 'right']);
    r += tRow(['Aerodinamik Sürüklenme (P_aero)', num(eb.avgP_aero, 1) + ' kW'], _tw, ['left', 'right']);
    r += tRow(['Eğim Direnci (P_grade)', num(eb.avgP_grade, 1) + ' kW'], _tw, ['left', 'right']);
    r += tRow(['Hızlanma Gücü (P_accel)', num(eb.avgP_accel, 1) + ' kW'], _tw, ['left', 'right']);
    r += tRule(_tw, '└', '┴', '┘', '─');
    r += '\n';

    r += titledBox('TOPLAM VERİM', [
      _kv('Ortalama Verim (η_avg)', '%' + num(eb.eta_avg, 1), 30),
      _kv('Minimum Verim (η_min)', '%' + num(eb.eta_min, 1), 30),
      _kv('Maksimum Verim (η_max)', '%' + num(eb.eta_max, 1), 30)
    ], W) + '\n';

    if (eb.avgP_engine > 0.1) {
      var pctTC = eb.avgP_TC_heat / eb.avgP_engine * 100;
      var pctDT = eb.avgP_drivetrain / eb.avgP_engine * 100;
      var pctWheel = eb.avgP_wheel / eb.avgP_engine * 100;
      r += titledBox('KAYIP DAĞILIMI (Motor gücüne oranla)', [
        _kv('Tekerleğe aktarılan', '%' + num(pctWheel, 1), 30),
        _kv('TK ısı kaybı', '%' + num(pctTC, 1), 30),
        _kv('Güç aktarma kaybı', '%' + num(pctDT, 1), 30)
      ], W) + '\n';
    }

    var _okDenge = eb.maxResidual_kW < 0.5;
    r += titledBox('DOĞRULAMA', [
      _kv('Newton dengesi artığı (maks)', num(eb.maxResidual_kW, 3) + ' kW', 30),
      _kv('Durum', (_okDenge ? '+ Başarılı' : '! Sapma tespit edildi'), 30),
      _kv('Analiz edilen nokta sayısı', String(eb.samples), 30)
    ], W) + '\n';
  } else {
    r += '  Enerji dengesi verisi bulunamadı.\n';
  }
  r += '\n\n';

  // ════════════════════════════════════════════════════════════════════════
  // TOPOLOJİ DETAYI  (eskiden ayrı "Topoloji Raporu" idi — artık bu rapora dahil)
  // ════════════════════════════════════════════════════════════════════════
  if (typeof veGenerateTopologyTxtReport === 'function' &&
      typeof nodes !== 'undefined' && nodes && nodes.length > 0) {
    r += sectionBanner('TOPOLOJİ DETAYI', W);
    r += veGenerateTopologyTxtReport(hazirlayan, { bodyOnly: true });
    r += '\n';
  }

  // ════════════════════════════════════════════════════════════════════════
  // RAPOR SONU
  // ════════════════════════════════════════════════════════════════════════
  r += rep('━', W) + '\n';
  r += pad('RAPOR SONU', W, 'center') + '\n';
  r += rep('━', W) + '\n\n';

  r += pad('BMC OTOMOTİV SANAYİ VE TİCARET A.Ş.', W, 'center') + '\n';
  r += pad('GÜÇ GRUBU MÜDÜRLÜĞÜ', W, 'center') + '\n\n';

  r += titledBox('İMZA', [
    _kv('Hazırlayan', tr(hazirlayan), 12),
    _kv('İletişim', veNameToEmail(hazirlayan), 12)
  ], W) + '\n';

  r += pad('Bu rapor BMC MFSim Tam Gaz Hızlanma Performans Hesaplama Programı ile', W, 'center') + '\n';
  r += pad('otomatik oluşturulmuştur. Hesaplamalar teorik modellere dayanmaktadır;', W, 'center') + '\n';
  r += pad('gerçek test sonuçları ile doğrulama yapılması önerilir.', W, 'center') + '\n\n';

  r += pad('© ' + now.getFullYear() + ' BMC Otomotiv — Tüm Hakları Saklıdır', W, 'center') + '\n';

  return r;
}

// ════════════════════════════════════════════════════════════════════════════
// TAM GAZ — DETAYLI HESAPLAMA İZİ (calcTrace → TXT)
// ════════════════════════════════════════════════════════════════════════════
// Programın Tam Gaz simülasyonunda GERÇEKTEN yaptığı hesapların adım adım,
// formül + sayı-ikamesi düzeyinde dökümü. Amaç: matematiğin doğrulanması / hata
// avı. Veri, simülasyonun izli (window._veFTTraceEnabled) bir yeniden koşusundan
// toplanır → gösterilen değerler ekrandaki sonuçlarla birebir tutarlıdır.
function veGenerateFTCalcTraceReport(sim, optHazirlayan, rangeSel) {
  var W = 90;
  function ln(ch, len) { var s = ''; for (var i = 0; i < len; i++) s += ch; return s; }
  function pad(str, len, align) {
    str = String(str);
    if (align === 'right') { while (str.length < len) str = ' ' + str; return str.slice(-Math.max(len, str.length)); }
    if (align === 'center') { var t = len - str.length; if (t <= 0) return str; var l = Math.floor(t / 2); return ln(' ', l) + str + ln(' ', t - l); }
    while (str.length < len) str += ' '; return str;
  }
  function ascii(s) {
    return String(s).replace(/ğ/g,'g').replace(/Ğ/g,'G').replace(/ü/g,'u').replace(/Ü/g,'U')
      .replace(/ş/g,'s').replace(/Ş/g,'S').replace(/ı/g,'i').replace(/İ/g,'I')
      .replace(/ö/g,'o').replace(/Ö/g,'O').replace(/ç/g,'c').replace(/Ç/g,'C');
  }
  function n(v, d) { d = (d == null) ? 2 : d; return isFinite(v) ? Number(v).toFixed(d) : '-'; }
  function ni(v) { return isFinite(v) ? Math.round(v).toString() : '-'; }
  function h1(title) { return '\n' + ln('=', W) + '\n' + pad(ascii(title), W, 'center') + '\n' + ln('=', W) + '\n\n'; }
  function h2(title) { return '\n  ' + ascii(title) + '\n  ' + ln('-', W - 4) + '\n'; }
  function kv(label, val, unit) { return '  ' + pad(ascii(label), 32) + ' : ' + val + (unit ? (' ' + unit) : '') + '\n'; }
  function fx(label, expr) { return '    ' + pad(ascii(label), 22) + ' = ' + expr + '\n'; }

  // ── HANGİ TRANSFER KADEMESİ ──
  // rangeSel = 'low' → düşük kademe; aksi halde yüksek (varsayılan/ilk).
  var wantLow = (rangeSel === 'low' || rangeSel === 'Low');
  var trGears = null;
  try {
    var trN = (typeof nodes !== 'undefined') ? nodes.find(function (nd) { return nd.type === 'transfer'; }) : null;
    if (trN && trN.data && trN.data.ftTrGears && trN.data.ftTrGears.length) trGears = trN.data.ftTrGears;
  } catch (eTr) { /* yok say */ }
  var kademe = null;
  if (trGears && trGears.length) {
    if (wantLow) {
      if (trGears.length < 2) return '(Dusuk kademe izi uretilemedi: bu araçta tek transfer kademesi mevcut.)\n';
      kademe = trGears[1].kademe || trGears[1].mode || 'Low';
    } else {
      kademe = trGears[0].kademe || trGears[0].mode || 'High';
    }
  } else if (wantLow) {
    return '(Dusuk kademe izi uretilemedi: araçta transfer kutusu yok — yalnizca tek kademe var.)\n';
  }

  // ── İZLİ YENİDEN KOŞU ──
  var traced = null;
  var hasWin = (typeof window !== 'undefined');
  var prevFlag = hasWin ? window._veFTTraceEnabled : undefined;
  try {
    if (hasWin) window._veFTTraceEnabled = true;
    if (typeof veFTRunSimulationEngine === 'function') traced = veFTRunSimulationEngine(kademe);
  } catch (e) {
    if (typeof console !== 'undefined') console.error('[MFSim] Hesaplama izi koşusu hatası:', e);
  } finally {
    if (hasWin) window._veFTTraceEnabled = prevFlag;
  }
  var T = traced && traced.calcTrace;
  if (!T || !T.params) {
    return '(Hesaplama izi uretilemedi: iz verisi toplanamadi.\n Once Tam Gaz simulasyonu calistirin, sonra tekrar deneyin.)\n';
  }
  var P = T.params;
  var _hazEl = (hasWin && typeof document !== 'undefined' && document.getElementById) ? document.getElementById('ve-rapor-hazirlayan') : null;
  var hazirlayan = optHazirlayan || (_hazEl ? _hazEl.value : '') || 'Belirtilmemis';
  var now = new Date();
  var tarih = String(now.getDate()).padStart(2, '0') + '.' + String(now.getMonth() + 1).padStart(2, '0') + '.' + now.getFullYear();
  var saat = String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0');
  var solverLabel = P.method === 'rk45' ? 'RK4/5 Adaptif (Dormand-Prince)' : P.method === 'rk4' ? 'RK4 (Klasik)' : P.method === 'heun' ? 'Heun' : P.method === 'ralston' ? 'Ralston' : 'Euler';

  var r = '';

  // ── BAŞLIK ──
  r += '\n' + ln('=', W) + '\n';
  r += pad('BMC Otomotiv -- Guc Grubu Mudurlugu', W, 'center') + '\n';
  r += pad('TAM GAZ HIZLANMA -- DETAY MATEMATIK HESAPLARI', W, 'center') + '\n';
  r += ln('=', W) + '\n';
  r += kv('Rapor Tarihi / Saati', tarih + ' ' + saat);
  r += kv('Hazirlayan', ascii(hazirlayan));
  r += kv('Cozucu Metodu', solverLabel + '  (dt=' + n(P.dt, 4) + ' s)');
  r += kv('Transfer Kademesi', ascii(P.transferRange || 'High') + '  (oran ' + n(P.i_transfer, 4) + ')');
  r += kv('Yakalanan Kilit Adim', String(T.steps.length));
  r += ln('=', W) + '\n';

  // ── BÖLÜM 0: OKUMA KILAVUZU ──
  r += h1('0. OKUMA KILAVUZU');
  r += '  Bu belge simulasyonun HER kilit noktasinda uygulanan formulleri, sayilari\n';
  r += '  yerine konmus halde gosterir. Boylece her sonucun nasil ciktigi elle izlenebilir.\n\n';
  r += '  Notasyon:  *=carpma  /=bolme  ^2=kare  sqrt=karekok  ->=sonuc/gecis\n';
  r += '  Birimler:  N (Newton), N.m (tork), kW (guc), rpm (devir/dk), m/s & km/h (hiz)\n';
  r += '  Kilit adimlar: kalkis (v=0), her ~10 km/h hiz izgarasi, her vites gecisi ve\n';
  r += '  maksimum hiz (V_max). Ara adimlar (~50 ms) ekranda/CSV raporundadir.\n';

  // ── BÖLÜM A: GİRDİLER VE SABİTLER ──
  r += h1('A. GIRDILER VE SABITLER');
  r += h2('A.1 Arac ve Aerodinamik');
  r += kv('Brut agirlik (GVW)  m', ni(P.m_vehicle), 'kg');
  r += kv('Tahrikli agirlik orani', n(P.drivenPct * 100, 0), '%');
  r += kv('Yukseklik / Genislik', n(P.ftHeight, 3) + ' / ' + n(P.ftWidth, 3), 'm');
  r += kv('Alin alani  A = H*W', n(P.A_frontal, 3), 'm^2');
  r += kv('Aerodinamik katsayi  Cd', n(P.Cd, 3));
  r += kv('Hava yogunlugu  rho', n(P.rho, 3), 'kg/m^3');
  r += kv('Yol egimi', n(P.grade_pct, 2), '%');
  r += h2('A.2 Lastik ve Zemin');
  r += kv('Yuvarlanma yaricapi  r_tire', n(P.r_tire, 4), 'm');
  r += kv('Lastik/teker ataleti  I_tire', n(P.I_tire, 3), 'kg.m^2');
  r += kv('Yuvarlanma direnci  Crr (statik)', n(P.Crr, 5));
  r += kv('Hiz duzeltme K1 / K2', n(P.crrK1, 6) + ' / ' + n(P.crrK2, 8));
  r += kv('Yuzey faktoru', n(P.surfFactor, 3));
  r += h2('A.3 Motor');
  r += kv('Governed devir', ni(P.governedSpeed), 'rpm');
  r += kv('Bosta (idle) devir', ni(P.idleRpm), 'rpm');
  r += kv('Yuksuz governed (no-load)', ni(P.noLoadGoverned), 'rpm');
  r += kv('Motor ataleti  I_engine', n(P.I_engine, 4), 'kg.m^2');
  r += kv('Aksesuar: Fan / Diger kaybi', n(P.accFanLoss, 2) + ' / ' + n(P.accOtherLoss, 2), 'kW @gov');
  r += kv('Fan modeli', P.accFanMode === 'on' ? 'sabit (on)' : 'kavramali N^3 (clutch)');
  if (P.hasTC) {
    r += h2('A.4 Tork Konvertoru');
    r += kv('Pompa tork dususu  drop', n(P.pumpTorqueDrop, 2), 'N.m');
    r += kv('TC ataleti (lockup/turbin)', n(P.I_conv, 3) + ' / ' + n(P.I_conv_turbine, 3), 'kg.m^2');
    r += kv('Rev-up ataleti  I_eng_rev', n(P.I_eng_rev, 4), 'kg.m^2');
    r += kv('Kavrama noktasi  couplingSR', n(P.couplingSR, 3));
    r += kv('Dusuk-dal kopus esigi', n(P.CONV_MATCH_THRESHOLD, 1), 'N.m');
  }
  r += h2('A.5 Sanziman ve Vites Oranlari');
  r += kv('Shift profili', ascii(P.shiftProfile));
  r += kv('Shift referans devri  ESL', ni(P.shiftRefRPM), 'rpm');
  r += kv('Lockup ofseti', ni(P.lockupOffset), 'rpm');
  r += '  ' + pad('Vites', 8) + pad('Oran', 12, 'right') + pad('Verim %', 12, 'right') + '\n';
  P.forwardGears.forEach(function (g) {
    r += '  ' + pad(ascii(g.name), 8) + pad(n(g.ratio, 4), 12, 'right') + pad(n(g.eff, 2), 12, 'right') + '\n';
  });
  r += h2('A.6 Aktarma Organlari');
  r += kv('Propsaft verimi / ataleti', n(P.psEff * 100, 2) + '% / ' + n(P.I_propshaft, 3), 'kg.m^2');
  r += kv('Transfer orani / verimi', n(P.i_transfer, 4) + ' / ' + n(P.eta_transfer * 100, 2) + '%');
  r += kv('Aks orani / verimi', n(P.i_axle, 4) + ' / ' + n(P.eta_axle * 100, 2) + '%');
  r += kv('Aks / Transfer ataleti', n(P.I_axle, 3) + ' / ' + n(P.I_tc, 3), 'kg.m^2');
  r += kv('Sanziman ic ataleti  I_trans', n(P.I_trans, 3), 'kg.m^2');
  r += h2('A.7 Tutunma ve Cozucu — Turetilen');
  r += kv('Tutunma katsayisi  mu', n(P.mu_traction, 3));
  r += '    F_grip = mu * m * tahrik% * g\n';
  r += '           = ' + n(P.mu_traction, 2) + ' * ' + ni(P.m_vehicle) + ' * ' + n(P.drivenPct, 2) + ' * 9.81  =  ' + ni(P.F_grip) + ' N\n';
  r += kv('Cozucu / dt', solverLabel + ' / ' + n(P.dt, 4) + ' s');
  if (P.method === 'rk45') r += kv('RK45 atol / rtol', n(P.ftAtol, 8) + ' / ' + n(P.ftRtol, 6));

  // ── BÖLÜM B: FORMÜL SÖZLÜĞÜ ──
  r += h1('B. FORMUL SOZLUGU (kod konumlariyla)');
  r += '  Motor devri (kinematik):  N = (v/r_tire) * i_total * 60/(2*pi)      [ft-performance.js: speedToTurbineRpm]\n';
  r += '  Motor torku (net):        T_net = T_gross(N) - T_aksesuar(N)         [motorTorqueFn]\n';
  r += '  Aksesuar kaybi:           P = Fan*(N/Ngov)^k + Diger*(N/Ngov) ; T=P/omega\n';
  r += '  Pompa emisi (converter):  T_pump = N_engine^2 / K_pump(SR)^2         [calcStepPhysics]\n';
  r += '  Turbin torku (converter): T_cikis(ham) = T_pump * tau(SR)            (etaConvIc yok; yalniz isi)\n';
  r += '  Lockup cikis:             T_cikis(ham) = T_net - dT_lockup           (pompa drop YOK, SR=1)\n';
  r += '   (dT_lockup = 10 + 0.00367*N ; kilit-klac surtunmesi)\n';
  r += '  Disli verimi (TK modu):   T_cikis = T_cikis(ham) * eta_gear          [calcGearEfficiency]\n';
  r += '   (eta_gear = 1 - |ln(i_gear)| * (0.0175 + 2.93e-6 * N_turb) ; TEK uygulama)\n';
  r += '  Dusuk-dal eslesme:        excess(N)=T_net-drop-N^2/K_pump^2 vadisi, N in [idle, noLoad]\n';
  r += '  Rev-up (yuksek dal):      dN/dt = (T_net - drop - T_pump)/I_eng_rev * 60/(2pi)\n';
  r += '  Cekis kuvveti:            F = T_cikis * i_ps*eta_ps * i_tr*eta_tr * i_ax*eta_ax / r_tire  [calcTractiveEffort]\n';
  r += '  Yuvarlanma direnci:       F_roll = Crr_eff * yuzey * m * g * cos(theta)   [calcResistForces]\n';
  r += '   (Crr_eff = Crr*(1 + K1*v + K2*v^2))                                  [getCrrEffective]\n';
  r += '  Aerodinamik direnc:       F_aero = 0.5 * rho * Cd * A * v^2\n';
  r += '  Egim direnci:             F_grade = m * g * sin(theta) ; theta=atan(egim/100)\n';
  r += '  Esdeger kutle:            m_eff = m + I_eff/r_tire^2 ; I_eff = SUM(I_k * i_k^2)  [calcEquivalentMass]\n';
  r += '  Ivme:                     a = (F_cekis - F_direnc) / m_eff\n';
  r += '  Entegrasyon (RK4):        dv = (k1+2k2+2k3+k4)/6 * dt ; k=a(v+...)\n';

  // ── BÖLÜM C: OTURMUŞ STALL ──
  if (T.settledStall && T.settledStall.scan) {
    var SS = T.settledStall, sc = SS.scan;
    r += h1('C. OTURMUS STALL (v=0) — kalkis/egim metrigi');
    r += '  Motor kalkista anlik dengeye ATLAMAZ; teget bolgesinde asili kalir (surunur).\n';
    r += '  Tarama: N=idle..' + ni(sc.iterations && sc.iterations.length ? sc.iterations[sc.iterations.length - 1].N : 0) + ', fazlalik = T_net(N) - drop - N^2/K0^2\n';
    r += '  K0=K_pump(0)=' + n(sc.K0, 3) + '   tau0=tau(0)=' + n(sc.tau0, 3) + '   drop=' + n(sc.pumpDrop, 2) + '   tol=' + n(sc.tol, 1) + ' N.m\n\n';
    r += '  ' + pad('N (rpm)', 10, 'right') + pad('T_net', 12, 'right') + pad('T_pump_emis', 14, 'right') + pad('Fazlalik', 12, 'right') + '\n';
    r += '  ' + ln('-', 48) + '\n';
    (sc.iterations || []).forEach(function (it) {
      r += '  ' + pad(ni(it.N), 10, 'right') + pad(n(it.Te, 1), 12, 'right') + pad(n(it.T_pump_absorb, 1), 14, 'right') + pad(n(it.excess, 1), 12, 'right') + '\n';
    });
    r += '  ' + ln('-', 48) + '\n';
    r += '  -> Secilen N = ' + ni(sc.chosenN) + ' rpm   (' + ascii(sc.reason || '') + ')\n';
    r += '     T_pump = N^2/K0^2 = ' + ni(sc.chosenN) + '^2 / ' + n(sc.K0, 2) + '^2 = ' + n(sc.T_pump, 1) + ' N.m\n';
    r += '     T_turbine = T_pump * tau0 = ' + n(sc.T_pump, 1) + ' * ' + n(sc.tau0, 3) + ' = ' + n(SS.T_turbine, 1) + ' N.m\n';
    r += '     T_output = T_turbine * eta_gear = ' + n(SS.T_turbine, 1) + ' * ' + n(SS.etaGear, 3) + ' = ' + n(SS.T_output, 1) + ' N.m   (calcGearEfficiency, SR=0)\n';
    r += '     TE = ' + n(SS.TE_kN, 2) + ' kN (grip-limitsiz kapasite' + (SS.slip ? '; TE>F_grip -> kayma bayragi "!"' : '') + ')   DP(duz yol) = TE - F_roll0 = ' + n(SS.DP_kN, 2) + ' kN\n';
  }

  // ── BÖLÜM D: DÜŞÜK-HIZ ÇALIŞMA NOKTASI ──
  if (T.lowSpeedOp && T.lowSpeedOp.bisection) {
    var LO = T.lowSpeedOp, bi = LO.bisection;
    r += h1('D. DUSUK-HIZ CALISMA NOKTASI (~10 km/h) — bisection');
    r += '  Turbin devri: N_turb = ' + ni(LO.N_turbine) + ' rpm  (v=' + n(LO.v_ms, 3) + ' m/s)\n';
    r += '  Bisection: motor devri N icin  hata(N) = (T_net(N)-drop) - N^2/K_pump(SR)^2 = 0\n';
    r += '  Baslangic araligi: [' + ni(bi.N_lo0) + ', ' + ni(bi.N_hi0) + ']  hata=[' + n(bi.f_lo0, 1) + ', ' + n(bi.f_hi0, 1) + ']\n\n';
    r += '  ' + pad('#', 5, 'right') + pad('N_lo', 10, 'right') + pad('N_hi', 10, 'right') + pad('N_mid', 10, 'right') + pad('hata(N_mid)', 14, 'right') + '\n';
    r += '  ' + ln('-', 49) + '\n';
    (bi.iterations || []).forEach(function (it) {
      r += '  ' + pad(String(it.iter), 5, 'right') + pad(ni(it.N_lo), 10, 'right') + pad(ni(it.N_hi), 10, 'right') + pad(ni(it.N_mid), 10, 'right') + pad(n(it.f_mid, 2), 14, 'right') + '\n';
    });
    r += '  ' + ln('-', 49) + '\n';
    r += '  -> N_engine=' + ni(LO.op.N_engine) + '  SR=' + n(LO.op.SR, 3) + '  tau=' + n(LO.op.tau, 3) + '  T_turbine=' + n(LO.op.T_turbine, 1) + ' N.m\n';
    r += '     TE=' + n(LO.TE_kN, 2) + ' kN   DP=' + n(LO.DP_kN, 2) + ' kN\n';
  }

  // ── BÖLÜM E: ADIM ADIM HIZLANMA İZİ ──
  r += h1('E. ADIM ADIM HIZLANMA IZI (kilit noktalar)');
  T.steps.forEach(function (s, idx) { r += veFTTraceRenderStep(s, idx, { n: n, ni: ni, pad: pad, ln: ln, ascii: ascii, W: W }); });

  // ── SON ──
  r += '\n' + ln('=', W) + '\n';
  r += pad('RAPOR SONU — ' + T.steps.length + ' kilit adim gosterildi', W, 'center') + '\n';
  r += pad('Bu belge dogrulama/hata-avi amaclidir. Hesaplar teorik modellere dayanir.', W, 'center') + '\n';
  r += ln('=', W) + '\n';
  return r;
}

// Tek bir iz adımını (kilit nokta) detaylı formül+sayı dökümüyle render eder.
// Düzen: her hesap "isim = formul / = sayilar / = sonuc" biçiminde hizalı,
// bloklar arası boşluklu — okumasi ferah olsun diye.
function veFTTraceRenderStep(s, idx, H) {
  var n = H.n, ni = H.ni, pad = H.pad, ln = H.ln, ascii = H.ascii, W = H.W;
  var gnum = String(s.gearName || '').replace(/[^0-9]/g, '') || '?';
  var mode = s.hasTC ? (s.isLockup ? 'L' : 'C') : '';
  var gLabel = gnum + mode;
  var d = s.driveline || {};
  var IND = '      ';   // 6-boşluk içerik girintisi
  var LW = 11;          // hizalı '=' için etiket kolon genişliği

  // Hizalı çok-satırlı denklem:  isim = rhs[0] / (girinti) = rhs[1] / ...
  function E(name, rhs) {
    var o = '';
    for (var i = 0; i < rhs.length; i++) o += IND + (i === 0 ? pad(name, LW) : pad('', LW)) + ' = ' + rhs[i] + '\n';
    return o;
  }
  function NT(label, text) { return IND + pad(label, LW) + ' : ' + text + '\n'; }   // "isim : metin"
  function TX(text) { return IND + text + '\n'; }                                   // düz girintili satır
  function BH(num, title) { return '\n  [' + num + '] ' + ascii(title) + '\n\n'; }  // blok başlığı (üstte boşluk)

  var r = '';
  r += '\n' + ln('=', W) + '\n';
  r += '  E.' + (idx + 1) + '   [ ' + ascii(s.reason || '') + ' ]\n';
  r += '  ' + ln('-', W - 2) + '\n';
  r += '  t = ' + n(s.t, 3) + ' s      v = ' + n(s.v_kmh, 2) + ' km/h (' + n(s.v_ms, 3) + ' m/s)      vites = ' + gLabel + '\n';
  r += ln('=', W) + '\n';

  // ── [1] MOTOR DEVRİ + TORK ──
  r += BH(1, 'MOTOR DEVRI VE TORKU');
  var iTot = s.i_gear * d.i_propshaft * d.i_transfer * d.i_axle;
  if (s.branch === 'converter') {
    r += E('i_total', ['i_gear * i_ps * i_tr * i_axle',
                       n(s.i_gear, 4) + ' * ' + n(d.i_propshaft, 3) + ' * ' + n(d.i_transfer, 4) + ' * ' + n(d.i_axle, 4),
                       n(iTot, 4)]);
    r += E('N_turbine', ['(v / r_tire) * i_total * 60/(2pi)', ni(s.N_turbine) + ' rpm']);
    r += '\n';
    if (s.lowBranchScan) {
      var sbs = s.lowBranchScan;
      var _sr0 = (sbs.rows && sbs.rows.length) ? sbs.rows[0].N : 0;
      var _sr1 = (sbs.rows && sbs.rows.length) ? sbs.rows[sbs.rows.length - 1].N : 0;
      r += TX('Dusuk-dal eslesme (teget vadisi) taramasi — excess(N)=T_net-drop-N^2/K^2, N=idle..noLoad:');
      r += TX('  tarandi N = ' + ni(_sr0) + '..' + ni(_sr1) + ' rpm (vadi tabaninda durur)');
      r += TX('  min fazlalik = ' + n(sbs.minExcess, 1) + ' N.m  @ N = ' + ni(sbs.minN) + '   (kopus esigi ' + n(sbs.threshold, 1) + ' N.m)');
      if (sbs.onLowBranch) {
        r += TX('  -> DUSUK DAL (surunme): N_engine eslesme noktasinda tutulur = ' + ni(s.N_engine) + ' rpm');
      } else {
        r += TX('  -> YUKSEK DAL (kopmus): N_engine = dinamik rev-up durumu = ' + ni(s.N_engine) + ' rpm');
      }
      r += '\n';
    }
    r += NT('T_gross', n(s.motorGross, 1) + ' N.m   (PCHIP tork egrisi @ N)');
    r += E('T_net', ['T_gross - T_aksesuar', n(s.motorGross, 1) + ' - ' + n(s.motorGross - s.T_engine, 1), n(s.T_engine, 1) + ' N.m']);
  } else {
    r += E('N_engine', ['(v / r_tire) * i_total * 60/(2pi)',
                        ni(s.N_engine_kinematic != null ? s.N_engine_kinematic : s.N_engine) + ' rpm' + (s.N_engine_clampedIdle ? '   -> taban devrine kelepcelendi (' + ni(s.floorRpm != null ? s.floorRpm : s.N_engine) + ' rpm; TK-yok=kalkis-stall, lockup=idle)' : '')]);
    r += '\n';
    r += NT('T_gross', n(s.motorGross, 1) + ' N.m   (PCHIP tork egrisi @ N)');
    r += E('T_net', ['T_gross - T_aksesuar', n(s.motorGross, 1) + ' - ' + n(s.motorGross - s.T_engine, 1), n(s.T_engine, 1) + ' N.m']);
  }

  // ── [2] KONVERTÖR / LOCKUP / DOĞRUDAN ──
  if (s.branch === 'converter') {
    r += BH(2, 'TORK KONVERTORU (converter mod)');
    r += E('SR', ['N_turbine / N_engine', ni(s.N_turbine) + ' / ' + ni(s.N_engine), n(s.SR, 4)]);
    r += NT('tau(SR)', n(s.tau, 4));
    r += NT('K_pump(SR)', n(s.Kp, 3) + '   (SR bagimli K-faktoru)');
    r += E('T_pump', ['N_engine^2 / K_pump^2', ni(s.N_engine) + '^2 / ' + n(s.Kp, 2) + '^2', n(s.T_pump_absorbed, 1) + ' N.m']);
    r += E('T_turbine', ['T_pump * tau', n(s.T_pump_absorbed, 1) + ' * ' + n(s.tau, 3), n(s.T_turbine_raw, 1) + ' N.m']);
    r += NT('T_cikis (ham)', n(s.T_output_pre_gear != null ? s.T_output_pre_gear : s.T_turbine_raw, 1) + ' N.m   (= T_turbine; disli verimi [2b]\'de ayrica)');
    r += '\n';
    if (s.engRate) r += NT('Rev-up', 'dN/dt = (T_net - drop - T_pump)/I_eng_rev * 60/(2pi) = ' + n(s.engRate, 1) + ' rpm/s');
    r += NT('Isi reddi', n(s.heatRejection_kW, 2) + ' kW   (TC slip ' + n(s.P_heat_converter, 2) + ' + gear-mek ' + n(s.P_heat_gear_mech, 2) + '; etaConvIc yalniz isi terimi)');
  } else if (s.branch === 'lockup') {
    r += BH(2, 'KILITLI KONVERTOR (lockup)');
    r += TX('SR = 1,  tau = 1   (motor-turbin rijit; hidrolik pompa emisi=0 -> pompa drop UYGULANMAZ)');
    r += E('dT_lockup', ['10 + 0.00367 * N', '10 + 0.00367 * ' + ni(s.N_engine), n(s.deltaT_lockup, 1) + ' N.m   (kilit-klac surtunmesi)']);
    r += E('T_net_lockup', ['T_net - dT_lockup', n(s.T_engine, 1) + ' - ' + n(s.deltaT_lockup, 1), n(s.T_net_lockup, 1) + ' N.m']);
    r += NT('T_cikis (ham)', n(s.T_output_pre_gear != null ? s.T_output_pre_gear : s.T_net_lockup, 1) + ' N.m   (= T_net_lockup; disli verimi [2b]\'de ayrica)');
    r += NT('kilit verimi', 'T_net_lockup / T_net = ' + n(s.tcEtaLockup, 3));
    r += '\n';
    r += NT('Isi reddi', 'a*N + b = ' + (s.heatCoeff ? (n(s.heatCoeff.a, 5) + '*' + ni(s.N_engine) + ' + (' + n(s.heatCoeff.b, 3) + ')') : '') + ' = ' + n(s.heatRejection_kW, 2) + ' kW  (vites ' + (s.heatGearNum || '?') + ')');
  } else {
    r += BH(2, 'DOGRUDAN TAHRIK (TK yok)');
    r += TX('Rijit dogrudan tahrik  (eta_direct = ' + n(s.eta_direct, 3) + ')');
    r += E('T_output', ['T_net * eta_direct', n(s.T_engine, 1) + ' * ' + n(s.eta_direct, 3), n(s.T_output_geared != null ? s.T_output_geared : s.T_output, 1) + ' N.m']);
    r += '\n';
    r += NT('Isi reddi', n(s.heatRejection_kW, 2) + ' kW   (dishli mekanik kaybi)');
  }

  // ── [2b] DİŞLİ VERİMİ — TK'li modda tek uygulama (converter+lockup ortak) ──
  if (s.gearEffApplied) {
    r += BH('2b', 'DISLI VERIMI (calcGearEfficiency — TK\'li modda tek uygulama)');
    r += E('eta_gear', ['1 - |ln(i_gear)| * (0.0175 + 2.93e-6 * N_turb)', n(s.eta_gear, 4) + '   (N_turb = ' + ni(s.N_turb_for_eff) + ' rpm)']);
    r += E('T_cikis', ['T_cikis(ham) * eta_gear', n(s.T_output_pre_gear, 1) + ' * ' + n(s.eta_gear, 4), n(s.T_output_geared, 1) + ' N.m']);
  }

  // ── [3] ÇEKİŞ ──
  r += BH(3, 'CEKIS KUVVETI (tekerlekte)');
  r += E('F_ham', ['T_out * i_gear * i_ps*eta_ps * i_tr*eta_tr * i_ax*eta_ax / r_tire',
                   n(s.T_output_geared != null ? s.T_output_geared : s.T_output, 1) + ' * ' + n(s.i_gear, 3) + ' * ' + n(d.i_propshaft, 3) + '*' + n(d.psEff, 4) + ' * ' + n(d.i_transfer, 3) + '*' + n(d.eta_transfer, 4) + ' * ' + n(d.i_axle, 3) + '*' + n(d.eta_axle, 4) + ' / ' + n(d.r_tire, 4),
                   ni(s.F_traction_raw) + ' N']);
  r += '\n';
  r += NT('Tutunma', 'F_grip = ' + ni(s.F_grip) + ' N   ->   ' + (s.gripLimited ? 'SINIRLANDI (tekerlek kaymasi)' : 'serbest (limit asilmadi)'));
  r += NT('F_cekis', ni(s.F_traction) + ' N   (' + n(s.F_traction / 1000, 2) + ' kN)');

  // ── [4] DİRENÇLER ──
  r += BH(4, 'DIRENC KUVVETLERI');
  r += E('Crr_eff', ['Crr * (1 + K1*v + K2*v^2)', n(s.Crr_static, 5) + ' * (1 + K1*' + n(s.v_ms, 2) + ' + K2*' + n(s.v_ms, 2) + '^2)', n(s.Crr_eff, 5)]);
  r += E('F_roll', ['Crr_eff * yuzey * m * g * cos(theta)', ni(s.F_rolling) + ' N']);
  r += E('F_aero', ['0.5 * rho * Cd * A * v^2', '0.5 * ' + n(s.rho, 3) + ' * ' + n(s.Cd, 3) + ' * ' + n(s.A_frontal, 3) + ' * ' + n(s.v_ms, 2) + '^2', ni(s.F_aero) + ' N']);
  r += E('F_grade', ['m * g * sin(theta)', ni(s.F_grade) + ' N   (egim ' + n(s.grade_pct, 1) + '%)']);
  r += E('F_direnc', ['F_roll + F_aero + F_grade', ni(s.F_rolling) + ' + ' + ni(s.F_aero) + ' + ' + ni(s.F_grade), ni(s.F_resist) + ' N']);

  // ── [5] EŞDEĞER KÜTLE + İVME ──
  var mt = s.massTerms || {};
  r += BH(5, 'ESDEGER KUTLE VE IVME');
  r += TX('I_eff = SUM(I_k * i_k^2)  — her atalet teriminin katkisi:');
  function term(lbl, val) { return IND + '  ' + pad(lbl, 14) + n(val, 1) + '\n'; }
  if (mt.isLockup) {
    r += term('motor', mt.I_engine);
    r += term('konvertor', mt.I_conv);
  } else {
    r += term('konv-turbin', mt.I_conv_turbine);
  }
  r += term('sanziman', mt.I_trans);
  r += term('propsaft', mt.I_propshaft);
  r += term('transfer', mt.I_tc);
  r += term('aks', mt.I_axle);
  r += term('teker', mt.I_tire);
  r += IND + '  ' + ln('-', 20) + '\n';
  r += IND + '  ' + pad('toplam', 14) + n(s.I_eff, 1) + ' kg.m^2    (i_total = ' + n(mt.i_total, 3) + ')\n';
  r += '\n';
  r += E('m_eff', ['m + I_eff / r_tire^2', ni(s.m_vehicle) + ' + ' + n(s.I_eff, 1) + ' / ' + n(d.r_tire, 4) + '^2', ni(s.m_eff) + ' kg   (x' + n(s.massRatio, 3) + ')']);
  r += E('a', ['(F_cekis - F_direnc) / m_eff', '(' + ni(s.F_traction) + ' - ' + ni(s.F_resist) + ') / ' + ni(s.m_eff), n(s.accel, 4) + ' m/s^2   (' + n(s.accel_g, 4) + ' g)']);

  // ── [6] VİTES KARARI (varsa) ──
  var lastNum = 5;
  if (s.shiftEvent) {
    var se = s.shiftEvent;
    r += BH(6, 'VITES GECISI KARARI');
    r += NT('Gecis', ascii(se.fromMode) + '  ->  ' + ascii(se.toMode) + (se.isDownshift ? '   (DOWNSHIFT)' : ''));
    if (se.reason === 'governed-safety') {
      r += NT('Kural', 'governed ust-vites guvenligi (over-rev korumasi)');
      r += NT('Karar', 'N_engine = ' + ni(se.N_engine) + ' >= governed   ->  ust vitese ZORUNLU GECIS');
    } else if (se.threshold != null) {
      r += NT('Kural', ascii(se.thresholdBasis || ''));
      r += NT('Karar', 'N_out = ' + ni(se.N_out) + '   vs   esik = ' + ni(se.threshold) + '   ->  GECIS');
    } else {
      r += NT('Kural', ascii(se.thresholdBasis || se.reason || ''));
      r += NT('Karar', 'N_out = ' + ni(se.N_out) + '   ->  GECIS');
    }
    lastNum = 6;
  }

  // ── [n] ENTEGRASYON ──
  if (s.integration) {
    var ig = s.integration;
    r += BH(lastNum + 1, 'SAYISAL ENTEGRASYON (' + ig.method.toUpperCase() + ', dt = ' + n(ig.dt, 4) + ' s)');
    (ig.stages || []).forEach(function (st) {
      r += IND + pad(ascii(String(st.label).replace(/·/g, '*')), 22) + ' = ' + n(st.accel, 5) + ' m/s^2\n';
    });
    r += '\n';
    var _fdisp = ascii(String(ig.formula || '').replace(/·/g, '*')).replace(/^dv\s*=\s*/, '');
    r += NT('dv', _fdisp + ' = ' + n(ig.dv, 5) + ' m/s');
    r += NT('v_sonraki', 'v + dv = ' + n(ig.v_next, 4) + ' m/s');
  }

  return r;
}

function veGenerateTopologyTxtReport(optHazirlayan, opts) {
  opts = opts || {};
  // bodyOnly: yalnızca bileşen bölümlerini üret (BMC başlığı, RAPOR BILGILERI ve
  // RAPOR SONU olmadan) — Tam Gaz Hızlanma raporuna gömme için kullanılır.
  var bodyOnly = !!opts.bodyOnly;
  var W = 80;

  function ln(ch, len) { var s = ''; for (var i = 0; i < len; i++) s += ch; return s; }
  function pad(str, len, align) {
    str = String(str);
    if (align === 'right') { while (str.length < len) str = ' ' + str; return str; }
    if (align === 'center') {
      var l = Math.floor((len - str.length) / 2);
      var r2 = len - str.length - l;
      var sp = ''; for (var i = 0; i < l; i++) sp += ' ';
      var sp2 = ''; for (var i = 0; i < r2; i++) sp2 += ' ';
      return sp + str + sp2;
    }
    while (str.length < len) str += ' ';
    return str;
  }
  function num(v, d) { return isFinite(v) ? v.toFixed(d) : '-'; }
  function numI(v) { return isFinite(v) ? Math.round(v).toString() : '-'; }
  function pRow(label, value, indent) {
    indent = indent || '  ';
    var labelW = 32;
    return indent + pad(label, labelW) + ': ' + value + '\n';
  }
  function ascii(s) {
    return String(s || '')
      .replace(/ğ/g,'g').replace(/Ğ/g,'G')
      .replace(/ü/g,'u').replace(/Ü/g,'U')
      .replace(/ş/g,'s').replace(/Ş/g,'S')
      .replace(/ı/g,'i').replace(/İ/g,'I')
      .replace(/ö/g,'o').replace(/Ö/g,'O')
      .replace(/ç/g,'c').replace(/Ç/g,'C');
  }

  var hazirlayan = optHazirlayan || 'Belirtilmemis';
  var now = new Date();
  var tarih = String(now.getDate()).padStart(2,'0') + '.' + String(now.getMonth()+1).padStart(2,'0') + '.' + now.getFullYear();
  var saat = String(now.getHours()).padStart(2,'0') + ':' + String(now.getMinutes()).padStart(2,'0') + ':' + String(now.getSeconds()).padStart(2,'0');
  var raporNo = 'BMC-TOPO-' + now.getFullYear() + '-' + String(Math.floor(Math.random() * 9000) + 1000);

  // Topoloji bilesenlerini topla
  var engineNode = nodes.find(function(n) { return n.type === 'engine'; });
  var gbNode = nodes.find(function(n) { return n.type === 'gearbox'; });
  var tcNode = nodes.find(function(n) { return n.type === 'torque-converter'; });
  var trNode = nodes.find(function(n) { return n.type === 'transfer'; });
  var diffNode = nodes.find(function(n) { return n.type === 'differential' && n.isMasterDiff; }) || nodes.find(function(n) { return n.type === 'differential'; });
  var wheelNode = nodes.find(function(n) { return n.type === 'wheel' && n.isMasterWheel; }) || nodes.find(function(n) { return n.type === 'wheel'; });
  var vehNode = nodes.find(function(n) { return n.type === 'vehicle'; });
  var roadNode = nodes.find(function(n) { return n.type === 'road'; });
  var scenNode = nodes.find(function(n) { return n.type === 'scenario'; });
  var solverNode = nodes.find(function(n) { return n.type === 'solver'; });
  var propNode = nodes.find(function(n) { return n.type === 'propshaft'; });
  var obsNode = nodes.find(function(n) { return n.type === 'obstacle-crossing'; });
  var brakeNode = nodes.find(function(n) { return n.type === 'retarder' || n.type === 'brake'; });

  var ed = engineNode ? (engineNode.data || {}) : {};
  var gd = gbNode ? (gbNode.data || {}) : {};
  var td = tcNode ? (tcNode.data || {}) : {};
  var trd = trNode ? (trNode.data || {}) : {};
  var dd = diffNode ? (diffNode.data || {}) : {};
  var wd = wheelNode ? (wheelNode.data || {}) : {};
  var vd = vehNode ? (vehNode.data || {}) : {};
  var rd = roadNode ? (roadNode.data || {}) : {};
  var scd = scenNode ? (scenNode.data || {}) : {};
  var sd = solverNode ? (solverNode.data || {}) : {};
  var psd = propNode ? (propNode.data || {}) : {};

  var modNames = {'engine-brake':'Motor Freni Performans','full-throttle':'Tam Gaz Hizlanma','performance':'Arac Performans','fuel':'Yakit Tuketimi'};
  var modLabel = modNames[veActiveModule] || veActiveModule || '-';

  var r = '';

  if (!bodyOnly) {
  // ═══ BMC BASLIK ═══
  r += '\n' + ln('=', W) + '\n\n';
  r += pad(' ######   ##    ##    ###### ', W, 'center') + '\n';
  r += pad(' ##   ##  ###  ###   ##      ', W, 'center') + '\n';
  r += pad(' ######   ## ## ##   ##      ', W, 'center') + '\n';
  r += pad(' ##   ##  ##    ##   ##      ', W, 'center') + '\n';
  r += pad(' ######   ##    ##    ###### ', W, 'center') + '\n\n';
  r += pad('BMC Otomotiv Sanayi ve Ticaret A.S.', W, 'center') + '\n';
  r += pad('Guc Grubu Mudurlugu', W, 'center') + '\n\n';
  r += ln('=', W) + '\n\n';
  r += pad('+' + ln('-', 40) + '+', W, 'center') + '\n';
  r += pad('|       TOPOLOJI DETAY RAPORU       |', W, 'center') + '\n';
  r += pad('+' + ln('-', 40) + '+', W, 'center') + '\n\n';

  // ═══ RAPOR BILGILERI ═══
  r += ln('-', W) + '\n  RAPOR BILGILERI\n' + ln('-', W) + '\n';
  r += pRow('Rapor Tarihi', tarih);
  r += pRow('Rapor Saati', saat);
  r += pRow('Rapor No', raporNo);
  r += pRow('Hazirlayan', ascii(hazirlayan));
  r += pRow('Proje Adi', ascii(veProjectName || 'Belirtilmemis'));
  r += pRow('Aktif Modul', modLabel);
  r += pRow('Bilesen Sayisi', String(nodes.length));
  r += pRow('Baglanti Sayisi', String(connections.length));
  r += ln('-', W) + '\n\n';
  }

  var secNo = 1;

  // ════════════════════════════════════════════════════════════════════════
  // ARAC
  // ════════════════════════════════════════════════════════════════════════
  if (vehNode) {
    r += ln('=', W) + '\n';
    r += pad(secNo + '. ARAC', W, 'center') + '\n';
    r += ln('=', W) + '\n\n';

    r += '  ARAC OZELLIKLERI\n';
    r += '  ' + ln('-', 38) + '\n';
    if (vd.ftVehName || vd.ftVehicleName) r += pRow('Arac Adi', ascii(vd.ftVehName || vd.ftVehicleName));
    var mass = vd.ftGVW || vd.mass || 0;
    if (mass) r += pRow('Brut Arac Agirligi (GVW)', numI(mass) + ' kg');
    if (vd.initialSpeed !== undefined) r += pRow('Baslangic Hizi', num(vd.initialSpeed, 1) + ' km/sa');
    r += '\n';

    r += '  AERODINAMIK\n';
    r += '  ' + ln('-', 38) + '\n';
    var cd = vd.ftCd || vd.cd || 0;
    if (cd) r += pRow('Suruklenme Katsayisi (Cd)', num(cd, 3));
    var fa = vd.frontalArea || ((vd.ftHeight || 0) * (vd.ftWidth || 0)) || 0;
    if (fa) r += pRow('Alin Alani (A)', num(fa, 2) + ' m2');
    if (vd.ftHeight) r += pRow('Yukseklik', num(vd.ftHeight, 3) + ' m');
    if (vd.ftWidth) r += pRow('Genislik', num(vd.ftWidth, 3) + ' m');
    var rho = vd.ftRho || vd.airDensity || 0;
    if (rho) r += pRow('Hava Yogunlugu (rho)', num(rho, 3) + ' kg/m3');
    if (cd && fa) r += pRow('CdA', num(cd * fa, 3) + ' m2');
    if (vd.autoShift !== undefined) r += pRow('Otomatik Vites', vd.autoShift ? 'Evet' : 'Hayir');
    r += '\n\n';
    secNo++;
  }


  // ════════════════════════════════════════════════════════════════════════
  // MOTOR
  // ════════════════════════════════════════════════════════════════════════
  if (engineNode) {
    var ms = ed.motorSpecs || {};
    var engName = engineNode.customName || ascii(ed.ftMotorPreset || ed.mfMotorPreset || '-');
    r += ln('=', W) + '\n';
    r += pad(secNo + '. MOTOR', W, 'center') + '\n';
    r += ln('=', W) + '\n\n';

    r += '  MOTOR OZELLIKLERI\n';
    r += '  ' + ln('-', 38) + '\n';
    r += pRow('Motor Tanimi', ascii(engName));
    if (ms.displacement) r += pRow('Silindir Hacmi', num(ms.displacement, 2) + ' L');
    if (ms.governedSpeed) r += pRow('Governed Devir', numI(ms.governedSpeed) + ' rpm');
    if (ms.noLoadGoverned) r += pRow('No-Load Governed', numI(ms.noLoadGoverned) + ' rpm');
    if (ms.idleRpm) r += pRow('Rolanti Devri', numI(ms.idleRpm) + ' rpm');
    if (ms.inertia) r += pRow('Motor Ataleti', num(ms.inertia, 4) + ' kg.m2');
    if (ed.verim !== undefined) r += pRow('Motor Freni Verimi', num(ed.verim, 0) + '%');
    r += '\n';

    // Tork/Guc tablosu + Aksesuar kayiplari (yan yana)
    var tData = ed.torqueData || [];
    if (tData.length > 0) {
      // Pik değerleri hesapla
      var pkT = 0, pkTr = 0, pkP = 0, pkPr = 0;
      tData.forEach(function(p) {
        var rpm = p.rpm || p.x || 0;
        var torque = p.torque || p.y || 0;
        var pw = p.power || (torque * rpm * Math.PI / 30000);
        if (torque > pkT) { pkT = torque; pkTr = rpm; }
        if (pw > pkP) { pkP = pw; pkPr = rpm; }
      });
      r += pRow('Pik Tork', num(pkT, 1) + ' N.m @ ' + numI(pkTr) + ' rpm');
      r += pRow('Pik Guc', num(pkP, 1) + ' kW (' + numI(pkP * 1.341) + ' HP) @ ' + numI(pkPr) + ' rpm');
      r += '\n';

      // Sol taraf: tork tablosu satırları
      var leftLines = [];
      var LW = 46;
      leftLines.push('  MOTOR TORK / GUC VERISI');
      leftLines.push('  ' + ln('-', 40));
      leftLines.push('  ' + pad('Devir', 9, 'right') + pad('Tork', 14, 'right') + pad('Guc', 14, 'right'));
      leftLines.push('  ' + pad('[rpm]', 9, 'right') + pad('[N.m]', 14, 'right') + pad('[kW]', 14, 'right'));
      leftLines.push('  ' + ln('-', 40));
      tData.forEach(function(p) {
        var rpm = p.rpm || p.x || 0;
        var torque = p.torque || p.y || 0;
        var pw = p.power || (torque * rpm * Math.PI / 30000);
        var tag = '';
        if (Math.abs(rpm - pkTr) < 5) tag = ' *T';
        else if (Math.abs(rpm - pkPr) < 5) tag = ' *P';
        else if (ms.governedSpeed && Math.abs(rpm - ms.governedSpeed) < 5) tag = ' *G';
        leftLines.push('  ' + pad(numI(rpm), 9, 'right') + pad(num(torque, 1), 14, 'right') + pad(num(pw, 1), 14, 'right') + tag);
      });
      leftLines.push('  ' + ln('-', 40));
      leftLines.push('  *T=Pik Tork  *P=Pik Guc  *G=Governed');

      // Sağ taraf: aksesuar kayıpları satırları
      var rightLines = [];
      if (ed.accessories && ed.accessories.length > 0) {
        var aStd = 0, aUsr = 0;
        rightLines.push('AKSESUAR KAYIPLARI');
        rightLines.push(ln('-', 36));
        rightLines.push(pad('Aksesuar', 20) + pad('Std', 8, 'right') + pad('Usr', 8, 'right'));
        rightLines.push(pad('', 20) + pad('[kW]', 8, 'right') + pad('[kW]', 8, 'right'));
        rightLines.push(ln('-', 36));
        ed.accessories.forEach(function(a) {
          var aName = ascii(a.name);
          if (aName.length > 20) aName = aName.substring(0, 18) + '..';
          rightLines.push(pad(aName, 20) + pad(num(a.standardLoss, 1), 8, 'right') + pad(num(a.userLoss, 1), 8, 'right'));
          aStd += (a.standardLoss || 0);
          aUsr += (a.userLoss || 0);
        });
        rightLines.push(ln('-', 36));
        rightLines.push(pad('TOPLAM', 20) + pad(num(aStd, 1), 8, 'right') + pad(num(aUsr, 1), 8, 'right'));
        rightLines.push(ln('-', 36));
      }

      // Yan yana birleştir
      var maxLen = Math.max(leftLines.length, rightLines.length);
      for (var li = 0; li < maxLen; li++) {
        var left = li < leftLines.length ? leftLines[li] : '';
        var right = li < rightLines.length ? rightLines[li] : '';
        r += pad(left, LW) + right + '\n';
      }
    } else if (ed.accessories && ed.accessories.length > 0) {
      // Tork verisi yok ama aksesuar var
      r += '  AKSESUAR KAYIPLARI\n';
      r += '  ' + ln('-', 34) + '\n';
      r += '  ' + pad('Aksesuar', 16) + pad('Std [kW]', 9, 'right') + pad('Usr [kW]', 9, 'right') + '\n';
      r += '  ' + ln('-', 34) + '\n';
      var aStd2 = 0, aUsr2 = 0;
      ed.accessories.forEach(function(a) {
        r += '  ' + pad(ascii(a.name), 16) + pad(num(a.standardLoss, 1), 9, 'right') + pad(num(a.userLoss, 1), 9, 'right') + '\n';
        aStd2 += (a.standardLoss || 0);
        aUsr2 += (a.userLoss || 0);
      });
      r += '  ' + ln('-', 34) + '\n';
      r += '  ' + pad('TOPLAM', 16) + pad(num(aStd2, 1), 9, 'right') + pad(num(aUsr2, 1), 9, 'right') + '\n';
    }
    r += '\n\n';
    secNo++;
  }

  // ════════════════════════════════════════════════════════════════════════
  // 2. TORK KONVERTORU
  // ════════════════════════════════════════════════════════════════════════
  if (tcNode) {
    r += ln('=', W) + '\n';
    r += pad(secNo + '. TORK KONVERTORU', W, 'center') + '\n';
    r += ln('=', W) + '\n\n';

    r += '  KONVERTOR OZELLIKLERI\n';
    r += '  ' + ln('-', 38) + '\n';
    r += pRow('Konvertor Adi', ascii(td.tcName || td.tcPresetKey || '-'));
    if (td.pumpTorqueDrop !== undefined) r += pRow('Pompa Tork Dusumu', num(td.pumpTorqueDrop, 1) + ' N.m');
    if (td.tcRatio !== undefined) r += pRow('TC Orani (M.Freni)', num(td.tcRatio, 2));
    r += pRow('Kilit Durumu', td.isLocked ? 'Kilitli' : 'Acik');
    r += '\n';

    var tcData = td.tcData || [];
    if (tcData.length > 0) {
      r += '  KONVERTOR KARAKTERISTIK VERISI\n';
      r += '  ' + ln('-', 52) + '\n';
      r += '  ' + pad('SR', 10, 'right') + pad('K_pump', 14, 'right') + pad('Tork Orani', 14, 'right') + pad('Verim', 14, 'right') + '\n';
      r += '  ' + pad('[-]', 10, 'right') + pad('[rpm/sqrt(Nm)]', 14, 'right') + pad('(tau) [-]', 14, 'right') + pad('[%]', 14, 'right') + '\n';
      r += '  ' + ln('-', 52) + '\n';
      tcData.forEach(function(p) {
        var eff = (p.sr && p.tau) ? (p.sr * p.tau * 100) : (p.efficiency || 0);
        r += '  ' + pad(num(p.sr, 3), 10, 'right') + pad(num(p.kpump, 3), 14, 'right') + pad(num(p.tau, 3), 14, 'right') + pad(num(eff, 1), 14, 'right') + '\n';
      });
      r += '  ' + ln('-', 52) + '\n';
    }

    // Motor-Konvertör Eşleşme Tablosu (topoloji verilerinden)
    if (engineNode && tcData.length > 0 && tData.length > 0) {
      var ptd = td.pumpTorqueDrop || 0;
      // Motor tork interpolasyon fonksiyonu
      function motorTorkAt(rpm) {
        if (tData.length === 0) return 0;
        if (rpm <= (tData[0].rpm || tData[0].x || 0)) return tData[0].torque || tData[0].y || 0;
        if (rpm >= (tData[tData.length-1].rpm || tData[tData.length-1].x || 0)) return tData[tData.length-1].torque || tData[tData.length-1].y || 0;
        for (var ti = 0; ti < tData.length - 1; ti++) {
          var r1 = tData[ti].rpm || tData[ti].x || 0;
          var r2 = tData[ti+1].rpm || tData[ti+1].x || 0;
          if (rpm >= r1 && rpm <= r2) {
            var f = (rpm - r1) / (r2 - r1);
            return (tData[ti].torque || tData[ti].y || 0) + f * ((tData[ti+1].torque || tData[ti+1].y || 0) - (tData[ti].torque || tData[ti].y || 0));
          }
        }
        return 0;
      }
      // Stall noktasını bul (SR=0)
      var stallKp = tcData[0].kpump || 0;
      var stallTau = tcData[0].tau || 0;
      if (stallKp > 0) {
        // N_stall^2 = T_pump / Kp^2 → bisection ile çöz
        var sLo = (ms.idleRpm || 600), sHi = (ms.governedSpeed || 2200);
        for (var bsi = 0; bsi < 40; bsi++) {
          var sMid = (sLo + sHi) / 2;
          var tAtMid = motorTorkAt(sMid) - ptd;
          var tNeeded = stallKp * stallKp * sMid * sMid;
          if (tAtMid > tNeeded) sLo = sMid; else sHi = sMid;
        }
        var stallSpeed = (sLo + sHi) / 2;
        var stallTorque = motorTorkAt(stallSpeed) - ptd;
        var turbineTorque = stallTorque * stallTau;

        r += '\n  MOTOR-KONVERTOR ESLESMESI\n';
        r += '  ' + ln('-', 48) + '\n';
        r += pRow('Pompa Tork Dusumu', num(ptd, 1) + ' N.m');
        r += pRow('Stall Devri', numI(stallSpeed) + ' rpm');
        r += pRow('Stall Motor Torku', numI(stallTorque) + ' N.m');
        r += pRow('Stall Tork Orani (tau)', num(stallTau, 3));
        r += pRow('Stall Turbin Torku', numI(turbineTorque) + ' N.m');

        // Governed'da SR hesapla
        var govRpm = ms.governedSpeed || 0;
        if (govRpm > 0) {
          var govTorque = motorTorkAt(govRpm) - ptd;
          if (govTorque > 0) {
            var kpNeeded = govRpm / Math.sqrt(govTorque);
            var srAtGov = 0;
            for (var si = 0; si < tcData.length - 1; si++) {
              var kp1 = tcData[si].kpump, kp2 = tcData[si+1].kpump;
              if ((kp1 <= kpNeeded && kpNeeded <= kp2) || (kp2 <= kpNeeded && kpNeeded <= kp1)) {
                var sf = (kpNeeded - kp1) / (kp2 - kp1);
                if (sf >= 0 && sf <= 1) { srAtGov = tcData[si].sr + sf * (tcData[si+1].sr - tcData[si].sr); break; }
              }
            }
            if (srAtGov === 0 && kpNeeded > tcData[tcData.length-1].kpump) srAtGov = 0.99;
            r += pRow('Governed Devir', numI(govRpm) + ' rpm');
            r += pRow('SR @ Governed', num(srAtGov, 3));
            r += pRow('Governed Durumu', srAtGov >= 0.80 ? 'OK (SR >= 0.80)' : 'DIKKAT (SR < 0.80)');
          }
        }
        r += '  ' + ln('-', 48) + '\n';
      }
    }

    r += '\n\n';
    secNo++;
  }

  // ════════════════════════════════════════════════════════════════════════
  // 3. SANZIMAN
  // ════════════════════════════════════════════════════════════════════════
  if (gbNode) {
    r += ln('=', W) + '\n';
    r += pad(secNo + '. SANZIMAN', W, 'center') + '\n';
    r += ln('=', W) + '\n\n';

    r += '  SANZIMAN OZELLIKLERI\n';
    r += '  ' + ln('-', 38) + '\n';
    r += pRow('Sanziman Modeli', ascii(gd.gbName || gd.selectedGearbox || gd.ftGBPreset || '-'));
    if (gd.efficiency !== undefined) r += pRow('Verim', num(gd.efficiency, 1) + '%');
    if (gd.forwardGears) r += pRow('Ileri Vites Sayisi', String(gd.forwardGears));
    if (gd.reverseGears) r += pRow('Geri Vites Sayisi', String(gd.reverseGears));
    if (gd.shiftProfile) r += pRow('Shift Profili', ascii(gd.shiftProfile));
    if (gd.shiftRefRPM) r += pRow('Shift Referans RPM', numI(gd.shiftRefRPM) + ' rpm');
    r += '\n';

    // FT gear data
    var gears = gd.ftGearData || gd.gearData || [];
    if (gears.length > 0) {
      r += '  VITES ORANLARI\n';
      r += '  ' + ln('-', 44) + '\n';
      r += '  ' + pad('Vites', 8) + pad('Oran', 14, 'right') + pad('Verim (%)', 14, 'right') + '\n';
      r += '  ' + ln('-', 44) + '\n';
      gears.forEach(function(g, i) {
        var ratio = g.ratio || g.y || parseFloat(g) || 0;
        var eff = g.eff || g.efficiency || '-';
        r += '  ' + pad(String(g.name || g.gear || (i + 1)), 8) + pad(num(ratio, 3), 14, 'right') + pad(eff !== '-' ? num(eff, 1) : '-', 14, 'right') + '\n';
      });
      r += '  ' + ln('-', 44) + '\n';
    } else if (gd.gearRatios && gd.gearRatios.length > 0) {
      r += '  VITES ORANLARI\n';
      r += '  ' + ln('-', 30) + '\n';
      r += '  ' + pad('Vites', 8) + pad('Oran', 14, 'right') + '\n';
      r += '  ' + ln('-', 30) + '\n';
      gd.gearRatios.forEach(function(ratio, i) {
        r += '  ' + pad(String(i + 1), 8) + pad(num(parseFloat(ratio), 3), 14, 'right') + '\n';
      });
      r += '  ' + ln('-', 30) + '\n';
    }
    r += '\n\n';
    secNo++;
  }

  // ════════════════════════════════════════════════════════════════════════
  // 4. TRANSFER KUTUSU
  // ════════════════════════════════════════════════════════════════════════
  if (trNode) {
    r += ln('=', W) + '\n';
    r += pad(secNo + '. TRANSFER KUTUSU', W, 'center') + '\n';
    r += ln('=', W) + '\n\n';

    r += '  TRANSFER OZELLIKLERI\n';
    r += '  ' + ln('-', 38) + '\n';
    var trName = trNode.customName || trd.ftTrName || trd.ftTrPreset || '-';
    r += pRow('Transfer Adi', ascii(trName));
    if (trd.efficiency !== undefined) r += pRow('Verim', num(trd.efficiency, 1) + '%');
    r += '\n';

    var trGears = trd.ftTrGears || trd.transferData || [];
    if (trGears.length > 0) {
      r += '  TRANSFER KADEMELERI\n';
      r += '  ' + ln('-', 44) + '\n';
      r += '  ' + pad('Kademe', 16) + pad('Oran', 14, 'right') + pad('Verim (%)', 14, 'right') + '\n';
      r += '  ' + ln('-', 44) + '\n';
      trGears.forEach(function(tg) {
        var kd = tg.kademe || tg.mode || '-';
        var ratio = tg.ratio || tg.oran || 0;
        var eff = tg.eff || tg.verim || trd.efficiency || '-';
        r += '  ' + pad(ascii(kd), 16) + pad(num(ratio, 3), 14, 'right') + pad(eff !== '-' ? num(eff, 1) : '-', 14, 'right') + '\n';
      });
      r += '  ' + ln('-', 44) + '\n';
    } else {
      if (trd.selectedMode) r += pRow('Secili Mod', ascii(trd.selectedMode));
      if (trd.selectedRatio) r += pRow('Secili Oran', num(trd.selectedRatio, 3));
    }
    r += '\n\n';
    secNo++;
  }

  // ════════════════════════════════════════════════════════════════════════
  // 5. PROPSAFT
  // ════════════════════════════════════════════════════════════════════════
  if (propNode) {
    r += ln('=', W) + '\n';
    r += pad(secNo + '. PROPSAFT (KARDAN MILI)', W, 'center') + '\n';
    r += ln('=', W) + '\n\n';

    r += '  PROPSAFT OZELLIKLERI\n';
    r += '  ' + ln('-', 38) + '\n';
    r += pRow('Tanim', ascii(psd.psName || propNode.customName || '-'));
    r += pRow('Oran', '1.000 (Direkt)');
    if (psd.psEff !== undefined) r += pRow('Verim', num(psd.psEff, 2) + '%');
    if (psd.psInertia !== undefined) r += pRow('Atalet', num(psd.psInertia, 4) + ' kg.m2');
    r += '\n\n';
    secNo++;
  }

  // ════════════════════════════════════════════════════════════════════════
  // 6. DIFERANSIYEL
  // ════════════════════════════════════════════════════════════════════════
  if (diffNode) {
    r += ln('=', W) + '\n';
    r += pad(secNo + '. DIFERANSIYEL', W, 'center') + '\n';
    r += ln('=', W) + '\n\n';

    r += '  DIFERANSIYEL OZELLIKLERI\n';
    r += '  ' + ln('-', 38) + '\n';
    r += pRow('Tanim', ascii(diffNode.customName || '-'));
    if (dd.diffRatio !== undefined) r += pRow('Diferansiyel Orani', num(dd.diffRatio, 3));
    else if (dd.ratio !== undefined) r += pRow('Diferansiyel Orani', num(dd.ratio, 3));
    if (dd.efficiency !== undefined) r += pRow('Verim', num(dd.efficiency, 1) + '%');
    if (dd.diffInertia !== undefined) r += pRow('Atalet', num(dd.diffInertia, 4) + ' kg.m2');
    r += '\n\n';
    secNo++;
  }

  // ════════════════════════════════════════════════════════════════════════
  // 7. TEKERLEK / LASTIK
  // ════════════════════════════════════════════════════════════════════════
  if (wheelNode) {
    r += ln('=', W) + '\n';
    r += pad(secNo + '. TEKERLEK / LASTIK', W, 'center') + '\n';
    r += ln('=', W) + '\n\n';

    r += '  LASTIK OZELLIKLERI\n';
    r += '  ' + ln('-', 38) + '\n';
    if (wd.ftTireName) r += pRow('Lastik Adi', ascii(wd.ftTireName));
    var tireR = wd.ftTireRadius || wd.wheelRadius || wd.radius || 0;
    if (tireR) {
      r += pRow('Yuvarlanma Yaricapi', num(tireR, 4) + ' m');
      r += pRow('Lastik Devir/km', numI(Math.round(1000 / (2 * Math.PI * tireR))) + ' devir/km');
    }
    var crr = wd.ftCrr || wd.rollingResistance || wd.crr || 0;
    if (crr) r += pRow('Yuvarlanma Direnci (Crr)', num(crr, 4));
    if (wd.ftSurfaceFactor !== undefined) r += pRow('Yuzey Faktoru', num(wd.ftSurfaceFactor, 2));
    if (wd.ftTireInertia !== undefined) r += pRow('Lastik/Tekerlek Ataleti', num(wd.ftTireInertia, 4) + ' kg.m2');
    if (wd.rotatingMass !== undefined) r += pRow('Doner Kutle Faktoru', num(wd.rotatingMass, 2));
    r += '\n\n';
    secNo++;
  }

  // ════════════════════════════════════════════════════════════════════════
  // 9. YOL / ORTAM
  // ════════════════════════════════════════════════════════════════════════
  if (roadNode) {
    r += ln('=', W) + '\n';
    r += pad(secNo + '. YOL / ORTAM', W, 'center') + '\n';
    r += ln('=', W) + '\n\n';

    r += '  YOL OZELLIKLERI\n';
    r += '  ' + ln('-', 38) + '\n';
    if (rd.grade !== undefined) r += pRow('Yol Egimi', num(rd.grade, 1) + '%');
    if (rd.egimMode) r += pRow('Egim Modu', rd.egimMode === 'segment' ? 'Segment (Rota)' : 'Manuel (Sabit)');
    if (rd.altitude !== undefined) r += pRow('Rakım', num(rd.altitude, 0) + ' m');
    if (rd.temperature !== undefined) r += pRow('Sicaklik', num(rd.temperature, 1) + ' C');
    if (rd.airDensity !== undefined) r += pRow('Hava Yogunlugu', num(rd.airDensity, 4) + ' kg/m3');
    r += '\n';

    // Yol segmentleri
    var segs = rd.roadSegments || [];
    if (segs.length > 0) {
      r += '  YOL SEGMENTLERI (' + segs.length + ' segment)\n';
      r += '  ' + ln('-', 58) + '\n';
      r += '  ' + pad('No', 5) + pad('Mesafe [m]', 12, 'right') + pad('Egim [%]', 11, 'right') + pad('Delta H [m]', 13, 'right') + pad('Komut', 17) + '\n';
      r += '  ' + ln('-', 58) + '\n';
      segs.forEach(function(s, i) {
        r += '  ' + pad(String(s.no || (i+1)), 5) + pad(num(s.distance, 1), 12, 'right') + pad(num(s.grade, 1), 11, 'right') + pad(num(s.deltaH, 1), 13, 'right') + pad(ascii(s.command || '-'), 17) + '\n';
      });
      r += '  ' + ln('-', 58) + '\n';
    }
    r += '\n\n';
    secNo++;
  }

  // ════════════════════════════════════════════════════════════════════════
  // 10. SENARYO
  // ════════════════════════════════════════════════════════════════════════
  if (scenNode) {
    r += ln('=', W) + '\n';
    r += pad(secNo + '. SENARYO', W, 'center') + '\n';
    r += ln('=', W) + '\n\n';

    r += '  SENARYO OZELLIKLERI\n';
    r += '  ' + ln('-', 38) + '\n';
    var stMap = {'full_throttle':'Tam Gaz','partial_throttle':'Kismi Gaz','custom':'Ozel'};
    r += pRow('Senaryo Tipi', stMap[scd.scenarioType] || scd.scenarioType || '-');
    if (scd.throttle !== undefined) r += pRow('Gaz Pedali', num(scd.throttle, 0) + '%');
    if (scd.segInitSpeed !== undefined) r += pRow('Baslangic Hizi', num(scd.segInitSpeed, 1) + ' km/sa');
    r += '\n\n';
    secNo++;
  }

  // ════════════════════════════════════════════════════════════════════════
  // 11. COZUCU
  // ════════════════════════════════════════════════════════════════════════
  if (solverNode) {
    r += ln('=', W) + '\n';
    r += pad(secNo + '. COZUCU', W, 'center') + '\n';
    r += ln('=', W) + '\n\n';

    r += '  COZUCU OZELLIKLERI\n';
    r += '  ' + ln('-', 38) + '\n';
    var mMap = {'euler':'Euler (1. derece)','heun':'Heun (2. derece)','ralston':'Ralston (2. derece)','rk4':'RK4 (4. derece)','rk45':'RK4/5 Adaptif (Dormand-Prince)'};
    r += pRow('Sayisal Yontem', mMap[sd.method] || sd.method || 'euler');
    if (sd.maxSimTime !== undefined) r += pRow('Maks. Simulasyon Suresi', num(sd.maxSimTime, 0) + ' s');
    if (sd.ftDt !== undefined) r += pRow('Zaman Adimi (dt)', num(sd.ftDt, 4) + ' s');
    if (sd.ftAtol !== undefined) r += pRow('Mutlak Tolerans (atol)', sd.ftAtol);
    if (sd.ftRtol !== undefined) r += pRow('Bagil Tolerans (rtol)', sd.ftRtol);
    r += '\n\n';
    secNo++;
  }

  // ════════════════════════════════════════════════════════════════════════
  // 12. ENGEL GECME (varsa)
  // ════════════════════════════════════════════════════════════════════════
  if (obsNode) {
    var od = obsNode.data || {};
    r += ln('=', W) + '\n';
    r += pad(secNo + '. ENGEL GECME', W, 'center') + '\n';
    r += ln('=', W) + '\n\n';

    r += '  ENGEL GECME PARAMETRELERI\n';
    r += '  ' + ln('-', 38) + '\n';
    if (od.obstacleHeight !== undefined) r += pRow('Engel Yuksekligi', num(od.obstacleHeight, 3) + ' m');
    if (od.a1 !== undefined) r += pRow('Agirlik Merkezi - On Aks', num(od.a1, 3) + ' m');
    if (od.a2 !== undefined) r += pRow('Agirlik Merkezi - Arka Aks', num(od.a2, 3) + ' m');
    if (od.a1 && od.a2) r += pRow('Aks Acikligi (L)', num(od.a1 + od.a2, 3) + ' m');
    if (od.loadedTireRadius !== undefined) r += pRow('Yuklu Lastik Yari.', num(od.loadedTireRadius, 4) + ' m');
    if (od.cornerDeflection !== undefined) r += pRow('Kose Defleksiyonu', num(od.cornerDeflection, 1) + ' mm');
    if (od.gbTorqueLimit !== undefined) r += pRow('Sanziman Tork Limiti', numI(od.gbTorqueLimit) + ' N.m');
    r += '\n\n';
    secNo++;
  }

  // ════════════════════════════════════════════════════════════════════════
  // FREN / RETARDER (varsa)
  // ════════════════════════════════════════════════════════════════════════
  if (brakeNode) {
    var bd = brakeNode.data || {};
    r += ln('=', W) + '\n';
    r += pad(secNo + '. FREN / RETARDER', W, 'center') + '\n';
    r += ln('=', W) + '\n\n';

    r += '  FREN OZELLIKLERI\n';
    r += '  ' + ln('-', 38) + '\n';
    r += pRow('Bilesen Tipi', brakeNode.type === 'retarder' ? 'Retarder' : 'Fren');
    r += pRow('Tanim', ascii(brakeNode.customName || '-'));
    r += '\n\n';
    secNo++;
  }

  // ════════════════════════════════════════════════════════════════════════
  // TOPLAM AKTARMA ORANLARI (özet)
  // ════════════════════════════════════════════════════════════════════════
  var diffR = dd.diffRatio || dd.ratio || 0;
  if (diffR > 0) {
    r += ln('=', W) + '\n';
    r += pad(secNo + '. TOPLAM AKTARMA OZETI', W, 'center') + '\n';
    r += ln('=', W) + '\n\n';

    var trGsum = trd.ftTrGears || trd.transferData || [];
    var gearsSum = gd.ftGearData || gd.gearData || [];
    var gearRatiosArr = gd.gearRatios || [];
    var tireRsum = wd.ftTireRadius || wd.wheelRadius || wd.radius || 0.5;
    var psEffSum = psd.psEff ? (psd.psEff / 100) : 1.0;
    var diffEffSum = dd.efficiency ? (dd.efficiency / 100) : 1.0;

    if (trGsum.length > 0) {
      r += '  ' + ln('-', 68) + '\n';
      r += '  ' + pad('Kademe', 14) + pad('Diff', 10, 'right') + pad('Transfer', 10, 'right') + pad('Toplam', 12, 'right') + pad('N/V', 12, 'right') + pad('Verim', 10, 'right') + '\n';
      r += '  ' + pad('', 14) + pad('Orani', 10, 'right') + pad('Orani', 10, 'right') + pad('Oran', 12, 'right') + pad('[rpm/kph]', 12, 'right') + pad('[%]', 10, 'right') + '\n';
      r += '  ' + ln('-', 68) + '\n';
      trGsum.forEach(function(tg) {
        var trR = tg.ratio || tg.oran || 1;
        var trE = tg.eff || tg.verim || (trd.efficiency || 97);
        var totalR = diffR * trR;
        var totalEff = diffEffSum * (trE / 100) * psEffSum * 100;
        var nv = (totalR * 1000) / (tireRsum * 2 * Math.PI * 60);
        r += '  ' + pad(ascii(tg.kademe || tg.mode || '-'), 14) + pad(num(diffR, 3), 10, 'right') + pad(num(trR, 3), 10, 'right') + pad(num(totalR, 3), 12, 'right') + pad(num(nv, 3), 12, 'right') + pad(num(totalEff, 1), 10, 'right') + '\n';
      });
      r += '  ' + ln('-', 68) + '\n';
    } else {
      var totalSingle = diffR;
      var nvSingle = (totalSingle * 1000) / (tireRsum * 2 * Math.PI * 60);
      r += pRow('Diferansiyel Orani', num(diffR, 3));
      r += pRow('Toplam Aktarma Orani', num(totalSingle, 3));
      r += pRow('N/V (rpm/kph)', num(nvSingle, 3));
      r += pRow('Toplam Verim', num(diffEffSum * psEffSum * 100, 1) + '%');
    }
    r += '\n\n';
    secNo++;
  }

  if (!bodyOnly) {
  // ═══ RAPOR SONU ═══
  r += ln('-', W) + '\n';
  r += pad('RAPOR SONU', W, 'center') + '\n';
  r += ln('=', W) + '\n\n';
  r += ln('-', W) + '\n';
  r += pad('BMC OTOMOTIV SANAYI VE TICARET A.S.', W, 'center') + '\n';
  r += pad('GUC GRUBU MUDURLUGU', W, 'center') + '\n';
  r += ln('-', W) + '\n\n';
  r += pRow('Hazirlayan', ascii(hazirlayan));
  r += pRow('Iletisim', veNameToEmail(hazirlayan));
  r += '\n';
  r += ln('-', W) + '\n';
  r += pad('Bu rapor BMC MFSim Topoloji Detay Raporu olarak', W, 'center') + '\n';
  r += pad('otomatik olusturulmustur.', W, 'center') + '\n';
  r += ln('-', W) + '\n\n';
  r += pad('(c) ' + now.getFullYear() + ' BMC Otomotiv -- Tum Haklari Saklidir', W, 'center') + '\n';
  }

  return r;
}


function veClearAllResults() {
  // Tüm slotları temizle
  for(var i = 0; i < 4; i++) {
    veResultSlots[i] = {};
    veSlotCollapsed[i] = false;
    var el = document.getElementById('ve-rslot-' + i);
    if(el) { el.classList.remove('collapsed'); el.style.flex = ''; }
    var btn = el ? el.querySelector('.btn-collapse') : null;
    if(btn) btn.textContent = '\u25BC';
    var tab = document.getElementById('ve-rslot-tab-' + i);
    if(tab) tab.textContent = 'Panel ' + (i + 1);
    veRenderSlotPicker(i);
  }
  
  // Simülasyon verilerini temizle
  window.veSimResults = null;

  // Solver tab state'ini temizle
  veSolverTabSlots = {};
  veSolverTabCollapsed = {};
  veActiveSolverTabId = 'performance';
  if(typeof veUpdateSolverTabs === 'function') veUpdateSolverTabs();

  // Chart view'ları sıfırla
  for(var j = 0; j < 4; j++) veResetChartView(j);

  showToast('Tüm sonuçlar temizlendi', 'success');
}

function veExportResultsCSV() {
  var r = window.veSimResults;
  if(!r || !r.time || r.time.length === 0) {
    showToast('Dışa aktarılacak sonuç yok — önce simülasyon çalıştırın', 'warning');
    return;
  }
  
  // Tüm slotlardaki sensörleri topla
  var allSensors = [];
  var allData = [];
  var colors = ['#3b82f6','#ef4444','#22c55e','#f59e0b','#8b5cf6','#ec4899'];
  
  for(var si = 0; si < 4; si++) {
    var slot = veResultSlots[si];
    if(!slot || !slot.sensors || slot.sensors.length === 0) continue;
    slot.sensors.forEach(function(s) {
      var data = veGetSensorData(s.id, s.signal);
      if(!data || data.length === 0) return; // Verisi olmayan sensörü atla
      allSensors.push(s.name + (s.unit ? ' [' + s.unit + ']' : ''));
      allData.push(data);
    });
  }
  
  if(allSensors.length === 0) {
    // Varsayılan: hız, devir, tork
    allSensors = ['Hız [km/h]', 'Devir [rpm]', 'Motor Torku [Nm]'];
    allData = [r.speed || [], r.rpm || [], r.engineTorque || []];
  }
  
  // CSV oluştur
  var csv = 'Zaman [s],' + allSensors.join(',') + '\n';
  
  var n = r.time.length;
  var step = Math.max(1, Math.floor(n / 500)); // max 500 satır
  
  for(var i = 0; i < n; i += step) {
    var row = r.time[i].toFixed(4);
    allData.forEach(function(ds) {
      var val = (i < ds.length) ? ds[i] : 0;
      row += ',' + val.toFixed(4);
    });
    csv += row + '\n';
  }
  // Son satır
  if((n - 1) % step !== 0) {
    var row = r.time[n - 1].toFixed(4);
    allData.forEach(function(ds) {
      row += ',' + ((n - 1 < ds.length) ? ds[n - 1] : 0).toFixed(4);
    });
    csv += row + '\n';
  }
  
  // İndir
  var blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url;
  a.download = 'motorfren_sonuc_' + new Date().toISOString().slice(0, 10) + '.csv';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  
  showToast('CSV dosyası indirildi (' + allSensors.length + ' kanal, ~' + Math.ceil(n / step) + ' satır)', 'success');
}

// Pencere boyut degisikliginde grafikleri yeniden ciz
window.addEventListener('resize', function() {
  clearTimeout(window._veResizeTimer);
  window._veResizeTimer = setTimeout(veRefreshAllCharts, 150);
});


// ═══════ HIZLANMA-YAVASLAMA SEGMENT ANALIZI TXT RAPOR ═══════
function veGenerateSegmentDriveTxtReport(sim, optHazirlayan) {
  var W = 80;
  var WW = 140;

  // ── YARDIMCI FONKSIYONLAR ──
  function ln(ch, len) { var s = ''; for (var i = 0; i < len; i++) s += ch; return s; }
  function pad(str, len, align) {
    str = String(str);
    if (align === 'right') { while (str.length < len) str = ' ' + str; return str; }
    if (align === 'center') {
      var l = Math.floor((len - str.length) / 2);
      var r2 = len - str.length - l;
      var sp = ''; for (var i = 0; i < l; i++) sp += ' ';
      var sp2 = ''; for (var i = 0; i < r2; i++) sp2 += ' ';
      return sp + str + sp2;
    }
    while (str.length < len) str += ' ';
    return str;
  }
  function num(v, d) { return isFinite(v) ? v.toFixed(d) : '-'; }
  function numI(v) { return isFinite(v) ? Math.round(v).toString() : '-'; }
  function pRow(label, value, indent) {
    indent = indent || '  ';
    var labelW = 32;
    return indent + pad(label, labelW) + ': ' + value + '\n';
  }
  function ascii(s) {
    return String(s)
      .replace(/ğ/g,'g').replace(/Ğ/g,'G')
      .replace(/ü/g,'u').replace(/Ü/g,'U')
      .replace(/ş/g,'s').replace(/Ş/g,'S')
      .replace(/ı/g,'i').replace(/İ/g,'I')
      .replace(/ö/g,'o').replace(/Ö/g,'O')
      .replace(/ç/g,'c').replace(/Ç/g,'C');
  }

  // ── VERİ KAYNAKLARI ──
  var sdAll = sim.segmentDriveAllRanges;
  var sdTrGears = sim.segmentDriveTransferGears || [];
  var sdPrimary = sim.segmentDrive;
  if (!sdPrimary || !sdPrimary.segmentSummary) {
    return '(Rapor olusturulamadi: Hizlanma-Yavaslama simulasyon verisi bulunamadi.)\n';
  }

  var R = sim.reportSnapshot || {};
  var hazirlayan = optHazirlayan || (document.getElementById('ve-rapor-hazirlayan') || {}).value || 'Belirtilmemis';
  var now = new Date();
  var tarih = String(now.getDate()).padStart(2,'0') + '.' + String(now.getMonth()+1).padStart(2,'0') + '.' + now.getFullYear();
  var saat = String(now.getHours()).padStart(2,'0') + ':' + String(now.getMinutes()).padStart(2,'0') + ':' + String(now.getSeconds()).padStart(2,'0');
  var raporNo = 'BMC-SD-' + now.getFullYear() + '-' + String(Math.floor(Math.random() * 9000) + 1000);

  var ss0 = sdPrimary.solverStats || {};
  var solverMethod = ss0.method || 'rk4';
  var solverLabel = solverMethod === 'rk45' ? 'RK4/5 Adaptif' : solverMethod === 'rk4' ? 'RK4' : solverMethod === 'heun' ? 'Heun' : solverMethod === 'ralston' ? 'Ralston' : 'Euler';

  var r = '';

  // ════════════════════════════════════════════════════════════════════════
  // BMC BASLIK
  // ════════════════════════════════════════════════════════════════════════
  r += '\n' + ln('=', W) + '\n\n';
  r += pad(' ######   ##    ##    ###### ', W, 'center') + '\n';
  r += pad(' ##   ##  ###  ###   ##      ', W, 'center') + '\n';
  r += pad(' ######   ## ## ##   ##      ', W, 'center') + '\n';
  r += pad(' ##   ##  ##    ##   ##      ', W, 'center') + '\n';
  r += pad(' ######   ##    ##    ###### ', W, 'center') + '\n\n';
  r += pad('BMC Otomotiv Sanayi ve Ticaret A.S.', W, 'center') + '\n';
  r += pad('Guc Grubu Mudurlugu', W, 'center') + '\n\n';
  r += ln('=', W) + '\n\n';
  r += pad('+' + ln('-', 52) + '+', W, 'center') + '\n';
  r += pad('|   HIZLANMA-YAVASLAMA SEGMENT ANALIZI RAPORU   |', W, 'center') + '\n';
  r += pad('+' + ln('-', 52) + '+', W, 'center') + '\n\n';

  // ── 1. RAPOR BILGILERI ──
  r += ln('-', W) + '\n  RAPOR BILGILERI\n' + ln('-', W) + '\n';
  r += pRow('Rapor Tarihi', tarih);
  r += pRow('Rapor Saati', saat);
  r += pRow('Rapor No', raporNo);
  r += pRow('Hazirlayan', ascii(hazirlayan));
  r += pRow('Hesaplama Modu', 'Hizlanma-Yavaslama Segment Analizi');
  r += pRow('Cozucu Metodu', solverLabel);
  r += pRow('Zaman Adimi (dt)', num(ss0.dt, 4) + ' s');
  r += ln('-', W) + '\n\n';


  // ════════════════════════════════════════════════════════════════════════
  // 2. SEGMENT TANIMI (GIRDI)
  // ════════════════════════════════════════════════════════════════════════
  r += ln('=', W) + '\n';
  r += pad('1. SEGMENT TANIMI (GIRDI)', W, 'center') + '\n';
  r += ln('=', W) + '\n\n';

  // Orijinal segment girdi verisi (simülasyon sonucundan bağımsız)
  var inputSegments = sim.segmentDriveInputSegments || [];
  var segSummary = sdPrimary.segmentSummary;
  var routeWaypoints = sim.routeWaypoints || [];

  r += pRow('Baslangic Hizi', num(ss0.initSpeed_kmh, 1) + ' km/h');
  r += pRow('Toplam Segment Sayisi', String(inputSegments.length || ss0.segments || segSummary.length));
  if(routeWaypoints.length > 0) {
    r += pRow('Referans Nokta Sayisi', String(routeWaypoints.length));
  }
  r += '\n';

  // Referans noktaları özeti (varsa)
  if(routeWaypoints.length > 0) {
    r += '  REFERANS NOKTALARI (GUZERGAH)\n';
    var wpTW = 60;
    r += '  ' + ln('-', wpTW) + '\n';
    r += '  ' + pad('#', 4) + pad('Ad', 28) + pad('Mesafe [km]', 14, 'right') + pad('Rakim [m]', 14, 'right') + '\n';
    r += '  ' + ln('-', wpTW) + '\n';
    routeWaypoints.forEach(function(wp, idx) {
      r += '  ' + pad(String(idx + 1), 4);
      r += pad(ascii(wp.name), 28);
      r += pad(num(wp.dist / 1000, 2), 14, 'right');
      r += pad(numI(wp.elev), 14, 'right');
      r += '\n';
    });
    r += '  ' + ln('-', wpTW) + '\n\n';
  }

  // Girdi tablosu — orijinal segment verisinden oluştur
  var inputSegs = inputSegments.length > 0 ? inputSegments : segSummary;
  var segTW = 74;
  r += '  ' + ln('-', segTW) + '\n';
  r += '  ' + pad('No', 5) + pad('Mesafe [m]', 12, 'right') + pad('Egim [%]', 10, 'right');
  r += pad('dH [m]', 9, 'right') + pad('Komut', 16, 'right') + pad('Yon', 22, 'right') + '\n';
  r += '  ' + ln('-', segTW) + '\n';

  var toplamMesafe = 0, toplamDeltaH = 0;
  inputSegs.forEach(function(seg, idx) {
    var komutStr = seg.command === 'coast' ? 'Gaz Kesme' : 'Tam Gaz';
    var grade = seg.grade || 0;
    // Orijinal girdi: seg.distance, segmentSummary: seg.targetDist
    var mesafe = seg.distance || seg.targetDist || seg.actualDist || 0;
    var dH = seg.deltaH || (mesafe * Math.sin(Math.atan(grade / 100)));
    var yonStr = grade > 0.01 ? 'Yokus asagi' : (grade < -0.01 ? 'Yokus yukari' : 'Duz');
    toplamMesafe += mesafe;
    toplamDeltaH += dH;

    r += '  ' + pad(String(seg.no || (idx + 1)), 5);
    r += pad(numI(mesafe), 12, 'right');
    r += pad(num(grade, 2), 10, 'right');
    r += pad(num(dH, 1), 9, 'right');
    r += pad(komutStr, 16, 'right');
    r += pad(yonStr, 22, 'right');
    r += '\n';
  });
  r += '  ' + ln('-', segTW) + '\n';
  r += '  ' + pad('TOPLAM', 5) + pad(numI(toplamMesafe), 12, 'right');
  r += pad('', 10) + pad(num(toplamDeltaH, 1), 9, 'right') + '\n';
  r += '  ' + ln('-', segTW) + '\n\n';

  r += '  EGIM ISARET KONVANSIYONU\n';
  r += '  Pozitif egim (+) = yokus asagi (arac potansiyel enerji kazanir)\n';
  r += '  Negatif egim (-) = yokus yukari (arac potansiyel enerji harcar)\n\n\n';


  // ════════════════════════════════════════════════════════════════════════
  // 3. GUC AKTARMA ZINCIRI PARAMETRELERI
  // ════════════════════════════════════════════════════════════════════════
  r += ln('=', W) + '\n';
  r += pad('2. GUC AKTARMA ZINCIRI PARAMETRELERI', W, 'center') + '\n';
  r += ln('=', W) + '\n\n';

  r += '  ARAC VE YOL\n';
  r += '  ' + ln('-', 38) + '\n';
  r += pRow('Arac Agirligi (GVW)', numI(ss0.m_vehicle || R.gvw) + ' kg');
  r += pRow('Alin Alani (A)', num(ss0.A_frontal || (R.frontalArea), 3) + ' m2');
  r += pRow('Aerodinamik Direnc (Cd)', num(ss0.Cd || R.cd, 3));
  r += pRow('Yuvarlanma Direnci (Crr)', num(ss0.Crr || R.crr, 4));
  r += pRow('Lastik Yaricapi (r)', num(ss0.r_tire || R.tireRadius, 4) + ' m');
  r += '\n';

  r += '  AKTARMA ORANLARI\n';
  r += '  ' + ln('-', 38) + '\n';
  r += pRow('Aks Orani (i_axle)', num(ss0.i_axle || R.diffRatio, 3));
  r += pRow('Aks Verimi', num((ss0.eta_axle || R.diffEff || 97), 2) + '%');
  r += pRow('Transfer Orani (i_transfer)', num(ss0.i_transfer, 3));
  r += pRow('Transfer Verimi', num((ss0.eta_transfer || 97), 2) + '%');
  r += '\n';

  // Vites tablosu
  var fwGears = ss0.forwardGears || [];
  if (fwGears.length > 0) {
    r += '  SANZIMAN VITESLERI\n';
    r += '  ' + ln('-', 42) + '\n';
    r += '  ' + pad('No', 5) + pad('Kademe', 14) + pad('Oran', 12, 'right') + pad('Verim (%)', 11, 'right') + '\n';
    r += '  ' + ln('-', 42) + '\n';
    fwGears.forEach(function(g, i) {
      r += '  ' + pad(String(i + 1), 5) + pad(ascii(g.name || ''), 14);
      r += pad(num(g.ratio, 3), 12, 'right') + pad(num(g.eff, 1), 11, 'right') + '\n';
    });
    r += '  ' + ln('-', 42) + '\n';
  }
  r += '\n\n';


  var sectionNum = 3;


  // ════════════════════════════════════════════════════════════════════════
  // Raporun geri kalanını her transfer kademesi için oluştur
  // ════════════════════════════════════════════════════════════════════════
  var trGearKeys = [];
  if (sdAll && sdTrGears.length > 0) {
    sdTrGears.forEach(function(g) { trGearKeys.push(g.kademe); });
  } else {
    trGearKeys.push('__primary__');
  }
  var hasMultiTransfer = trGearKeys.length > 1 && sdAll;

  // sectionNum zaten yukarıda rota bölümü varlığına göre ayarlandı (3 veya 4)

  trGearKeys.forEach(function(trKey, trIdx) {
    var sd = (trKey === '__primary__') ? sdPrimary : (sdAll[trKey] || sdPrimary);
    var ssSd = sd.solverStats || {};
    var segSum = sd.segmentSummary || [];
    var _noLoadGov = ssSd.noLoadGoverned || 0;

    if (hasMultiTransfer) {
      r += ln('*', W) + '\n';
      r += pad('TRANSFER KADEMESI: ' + ascii(String(trKey)).toUpperCase() + ' (i=' + num(ssSd.i_transfer, 3) + ')', W, 'center') + '\n';
      r += ln('*', W) + '\n\n';
    }

    // ── GUZERGAH BAZLI SONUC OZETI ──
    r += ln('=', W) + '\n';
    r += pad(sectionNum + '. GUZERGAH BAZLI SONUC OZETI', W, 'center') + '\n';
    r += ln('=', W) + '\n\n';

    // Kümülatif mesafe ve süre hesapla (segment bazında)
    var cumDist = 0, cumTime = 0;
    var segCumDist = []; // her segmentin başlangıç kümülatif mesafesi
    segSum.forEach(function(seg) {
      segCumDist.push(cumDist);
      cumDist += (seg.actualDist || seg.targetDist || 0);
      cumTime += (seg.duration || 0);
    });
    var totalTime = cumTime;
    var v0 = segSum.length > 0 ? segSum[0].startSpeed_kmh : 0;
    var vF = segSum.length > 0 ? segSum[segSum.length - 1].endSpeed_kmh : 0;

    // Waypoint'ler varsa: guzergah anlatimi
    if(routeWaypoints.length >= 2) {
      // Her waypoint icin: o noktaya en yakin segment'i bul ve aracin durumunu yaz
      var wpCumTime = [];
      var wpSpeed = [];
      var wpGear = [];
      for(var wi = 0; wi < routeWaypoints.length; wi++) {
        var wpDist = routeWaypoints[wi].dist;
        // Bu mesafeye en yakin segmenti ve icindeki durumu bul
        var bestSegIdx = 0;
        var d2 = 0;
        for(var si = 0; si < segSum.length; si++) {
          var segStart = segCumDist[si];
          var segEnd = segStart + (segSum[si].actualDist || segSum[si].targetDist || 0);
          if(wpDist >= segStart && wpDist <= segEnd + 0.1) { bestSegIdx = si; break; }
          if(segEnd < wpDist) bestSegIdx = si;
        }
        // Segment icindeki ilerleme orani
        var bSeg = segSum[bestSegIdx];
        var segStartD = segCumDist[bestSegIdx];
        var segLen = bSeg.actualDist || bSeg.targetDist || 1;
        var ratio = Math.max(0, Math.min(1, (wpDist - segStartD) / segLen));
        // Interpolasyon: hiz
        var spd = bSeg.startSpeed_kmh + ratio * (bSeg.endSpeed_kmh - bSeg.startSpeed_kmh);
        wpSpeed.push(spd);
        // Sure: onceki segmentlerin toplam suresi + bu segmentteki oran
        var tBefore = 0;
        for(var si2 = 0; si2 < bestSegIdx; si2++) tBefore += (segSum[si2].duration || 0);
        tBefore += ratio * (bSeg.duration || 0);
        wpCumTime.push(tBefore);
        // Vites
        wpGear.push(ratio < 0.5 ? (bSeg.startGear || '') : (bSeg.endGear || ''));
      }

      r += '  GUZERGAH AKISI\n';
      r += '  ' + ln('-', W - 4) + '\n\n';

      for(var wi2 = 0; wi2 < routeWaypoints.length; wi2++) {
        var wp = routeWaypoints[wi2];
        var wpDistKm = wp.dist / 1000;

        r += '  >> Arac "' + ascii(wp.name) + '" noktasinda\n';
        r += '     Konum   : km ' + num(wpDistKm, 2) + ' | Rakim: ' + numI(wp.elev) + ' m\n';
        r += '     Hiz     : ' + num(wpSpeed[wi2], 1) + ' km/h';
        if(wpGear[wi2]) r += ' | Vites: ' + ascii(String(wpGear[wi2]));
        r += '\n';
        r += '     Sure    : ' + num(wpCumTime[wi2], 1) + ' s\n';

        // Sonraki waypoint'e olan bolum bilgisi
        if(wi2 < routeWaypoints.length - 1) {
          var wpNext = routeWaypoints[wi2 + 1];
          var aradaki = wpNext.dist - wp.dist;
          var araSure = wpCumTime[wi2 + 1] - wpCumTime[wi2];
          var dhFark = wp.elev - wpNext.elev;
          var ortEgim = aradaki > 0.1 ? (dhFark / aradaki * 100) : 0;
          var egimYon = ortEgim > 0.5 ? 'inis' : (ortEgim < -0.5 ? 'cikis' : 'duz');

          r += '\n     ' + ln('.', 40) + '\n';
          r += '     ' + ascii(wp.name) + '  -->  ' + ascii(wpNext.name) + '\n';
          r += '     Mesafe: ' + num(aradaki / 1000, 2) + ' km';
          r += ' | dh: ' + num(dhFark, 0) + ' m';
          r += ' | Ort. egim: %' + num(ortEgim, 2) + ' (' + egimYon + ')';
          r += '\n     Gecis suresi: ' + num(araSure, 1) + ' s';
          var ortHiz = araSure > 0 ? (aradaki / 1000) / (araSure / 3600) : 0;
          r += ' | Ort. hiz: ' + num(ortHiz, 1) + ' km/h';
          r += '\n\n';
        } else {
          r += '\n';
        }
      }

      r += '  ' + ln('-', W - 4) + '\n\n';

      // Genel ozet
      r += '  GENEL OZET\n';
      r += '  ' + ln('-', 50) + '\n';
      r += pRow('Toplam Mesafe', num(cumDist / 1000, 2) + ' km');
      r += pRow('Toplam Sure', num(totalTime, 1) + ' s (' + num(totalTime / 60, 1) + ' dk)');
      r += pRow('Baslangic Hizi', num(v0, 1) + ' km/h');
      r += pRow('Bitis Hizi', num(vF, 1) + ' km/h');
      r += pRow('Hiz Degisimi', (vF - v0 >= 0 ? '+' : '') + num(vF - v0, 1) + ' km/h');
      var totalDownshifts = 0;
      segSum.forEach(function(s) { totalDownshifts += (s.downshiftCount || 0); });
      r += pRow('Toplam Vites Dususu', String(totalDownshifts));
      r += '  ' + ln('-', 50) + '\n\n\n';

    } else {
      // Waypoint yoksa: eski segment tablosu
      var sumTW = 120;
      r += '  ' + ln('-', sumTW) + '\n';
      r += '  ' + pad('No', 4) + pad('Komut', 12) + pad('Egim %', 8, 'right');
      r += pad('Mesafe m', 10, 'right') + pad('V_giris', 10, 'right') + pad('V_cikis', 10, 'right');
      r += pad('dV', 8, 'right') + pad('V_max', 9, 'right') + pad('V_min', 9, 'right');
      r += pad('Sure s', 9, 'right') + pad('Bas.Vites', 10, 'right') + pad('Bit.Vites', 10, 'right') + pad('DS', 4, 'right') + pad('Durum', 10) + '\n';
      r += '  ' + ln('-', sumTW) + '\n';

      var totalTime = 0;
      segSum.forEach(function(seg) {
        var komut = seg.command === 'coast' ? 'Gaz Kesme' : 'Tam Gaz';
        var dv = seg.endSpeed_kmh - seg.startSpeed_kmh;
        var durum = '';
        if (seg.endSpeed_kmh < 1.0) durum = 'DURDU';
        else if (dv > 1) durum = 'HIZLANDI';
        else if (dv < -1) durum = 'YAVASLADI';
        else durum = 'SABIT';
        totalTime += seg.duration || 0;

        r += '  ' + pad(String(seg.no), 4);
        r += pad(ascii(komut), 12);
        r += pad(num(seg.grade, 2), 8, 'right');
        r += pad(numI(seg.actualDist || seg.targetDist), 10, 'right');
        r += pad(num(seg.startSpeed_kmh, 1), 10, 'right');
        r += pad(num(seg.endSpeed_kmh, 1), 10, 'right');
        r += pad((dv >= 0 ? '+' : '') + num(dv, 1), 8, 'right');
        r += pad(num(seg.maxSpeed_kmh, 1), 9, 'right');
        r += pad(num(seg.minSpeed_kmh, 1), 9, 'right');
        r += pad(num(seg.duration, 1), 9, 'right');
        r += pad(ascii(String(seg.startGear || '')), 10, 'right');
        r += pad(ascii(String(seg.endGear || '')), 10, 'right');
        r += pad(String(seg.downshiftCount || 0), 4, 'right');
        r += '  ' + durum;
        r += '\n';
      });
      r += '  ' + ln('-', sumTW) + '\n';
      var v0 = segSum.length > 0 ? segSum[0].startSpeed_kmh : 0;
      var vF = segSum.length > 0 ? segSum[segSum.length - 1].endSpeed_kmh : 0;
      var dvTotal = vF - v0;
      var totalDownshifts = 0;
      segSum.forEach(function(s) { totalDownshifts += (s.downshiftCount || 0); });
      r += '  ' + pad('TOPLAM', 4 + 12);
      r += pad('', 8);
      r += pad(numI(ssSd.totalDistance || 0), 10, 'right');
      r += pad(num(v0, 1), 10, 'right');
      r += pad(num(vF, 1), 10, 'right');
      r += pad((dvTotal >= 0 ? '+' : '') + num(dvTotal, 1), 8, 'right');
      r += pad('', 9);
      r += pad('', 9);
      r += pad(num(totalTime, 1), 9, 'right');
      r += pad('', 10);
      r += pad('', 10);
      r += pad(String(totalDownshifts), 4, 'right');
      r += '\n';
      r += '  ' + ln('-', sumTW) + '\n\n';

      r += '  DURUM KODLARI\n';
      r += '  HIZLANDI  : Segment sonunda hiz artisi > 1 km/h\n';
      r += '  YAVASLADI : Segment sonunda hiz dususu > 1 km/h\n';
      r += '  SABIT     : Hiz degisimi +/-1 km/h araliginda\n';
      r += '  DURDU     : Arac durma noktasina geldi (< 1 km/h)\n\n\n';
    }


    // ── ZAMANSAL DIFERANSIYEL HESAPLAMA TABLOSU ──
    r += ln('=', WW) + '\n';
    r += pad((sectionNum + 1) + '. ZAMANSAL DIFERANSIYEL HESAPLAMA TABLOSU', WW, 'center') + '\n';
    r += ln('=', WW) + '\n\n';

    // Tablo başlığı
    r += '  ' + pad('t', 7, 'right') + pad('Seg', 5, 'right') + pad('Komut', 10);
    r += pad('v', 9, 'right') + pad('n', 8, 'right') + pad('Vites', 7);
    r += pad('F_cekis', 10, 'right');
    r += pad('F_yuv', 9, 'right') + pad('F_aero', 9, 'right') + pad('F_egim', 9, 'right');
    r += pad('F_net', 9, 'right') + pad('a', 8, 'right') + pad('s', 10, 'right');
    r += pad('P_mot', 9, 'right') + pad('P_tek', 9, 'right') + '\n';

    r += '  ' + pad('[s]', 7, 'right') + pad('', 5) + pad('', 10);
    r += pad('[km/h]', 9, 'right') + pad('[rpm]', 8, 'right') + pad('', 7);
    r += pad('[N]', 10, 'right');
    r += pad('[N]', 9, 'right') + pad('[N]', 9, 'right') + pad('[N]', 9, 'right');
    r += pad('[N]', 9, 'right') + pad('[m/s2]', 8, 'right') + pad('[m]', 10, 'right');
    r += pad('[kW]', 9, 'right') + pad('[kW]', 9, 'right') + '\n';
    r += '  ' + ln('-', WW - 4) + '\n';

    // Veri satırları — kullanıcı tarafından belirlenen zaman adımıyla örnekleme
    var timeArr = sd.time || [];
    var sampleInterval = sim.sdReportInterval || 0.5;
    var prevSeg = -1;

    for (var tTarget = 0; tTarget <= (timeArr[timeArr.length - 1] || 0) + 0.001; tTarget += sampleInterval) {
      // En yakın index'i bul
      var idx = 0;
      while (idx < timeArr.length - 1 && timeArr[idx + 1] <= tTarget + sampleInterval * 0.01) idx++;
      if (idx >= timeArr.length) break;

      var segIdx = sd.segment ? sd.segment[idx] : 0;
      var cmdStr = sd.command ? (sd.command[idx] === 'coast' ? 'Gaz Kes.' : 'Tam Gaz') : '';

      // Segment geçişinde ayırıcı — waypoint varsa noktayı belirt
      if (prevSeg >= 0 && segIdx !== prevSeg) {
        var _segTransDist = sd.distance ? sd.distance[idx] : 0;
        var _segTransLabel = '';
        if(routeWaypoints.length >= 2) {
          // Gecis mesafesine en yakin waypoint'i bul
          var _closestWp = null, _closestD = Infinity;
          for(var _wi = 0; _wi < routeWaypoints.length; _wi++) {
            var _wd = Math.abs(routeWaypoints[_wi].dist - _segTransDist);
            if(_wd < _closestD) { _closestD = _wd; _closestWp = routeWaypoints[_wi]; }
          }
          if(_closestWp && _closestD < 2000) {
            _segTransLabel = '  >> ' + ascii(_closestWp.name) + ' civari (km ' + num(_segTransDist / 1000, 2) + ')';
          } else {
            _segTransLabel = '  [km ' + num(_segTransDist / 1000, 2) + ' | egim degisimi]';
          }
        } else {
          _segTransLabel = '  [Seg ' + (prevSeg + 1) + ' -> ' + (segIdx + 1) + ']';
        }
        r += '  ' + ln('.', Math.floor((WW - 4) / 2)) + _segTransLabel + '\n';
      }
      prevSeg = segIdx;

      var v_kmh = sd.speed ? sd.speed[idx] : 0;
      var rpm = sd.rpm ? sd.rpm[idx] : 0;
      var gear = sd.gearMode ? sd.gearMode[idx] : '';
      // Vites değişim işareti: önceki satırla karşılaştır
      if (idx > 0 && sd.gearMode && sd.gearMode[idx] !== sd.gearMode[idx - 1]) {
        var prevGearNum = parseInt(sd.gearMode[idx - 1]) || 0;
        var curGearNum = parseInt(sd.gearMode[idx]) || 0;
        if (curGearNum < prevGearNum) gear = gear + 'v';
        else if (curGearNum > prevGearNum) gear = gear + '^';
      }
      var F_te = sd.TE ? (sd.TE[idx] * 1000) : 0;  // kN → N
      var F_roll = sd.F_rolling ? sd.F_rolling[idx] : 0;
      var F_aero = sd.F_aero ? sd.F_aero[idx] : 0;
      var F_grade = sd.F_grade ? sd.F_grade[idx] : 0;
      var F_net = sd.F_net ? sd.F_net[idx] : 0;
      var accel = sd.accel ? sd.accel[idx] : 0;
      var dist = sd.distance ? sd.distance[idx] : 0;
      var P_eng = sd.P_engine ? sd.P_engine[idx] : 0;
      var P_whl = sd.P_wheel ? sd.P_wheel[idx] : 0;

      r += '  ' + pad(num(sd.time[idx], 2), 7, 'right');
      r += pad(String(segIdx + 1), 5, 'right');
      r += ' ' + pad(ascii(cmdStr), 9);
      r += pad(num(v_kmh, 1), 9, 'right');
      var rpmStr = numI(rpm);
      if(_noLoadGov > 0 && rpm > _noLoadGov) rpmStr += '!';
      r += pad(rpmStr, 8, 'right');
      r += ' ' + pad(ascii(String(gear)), 6);
      r += pad(numI(F_te), 10, 'right');
      r += pad(numI(F_roll), 9, 'right');
      r += pad(numI(F_aero), 9, 'right');
      r += pad(numI(F_grade), 9, 'right');
      r += pad(numI(F_net), 9, 'right');
      r += pad(num(accel, 3), 8, 'right');
      r += pad(num(dist, 1), 10, 'right');
      r += pad(num(P_eng, 1), 9, 'right');
      r += pad(num(P_whl, 1), 9, 'right');
      r += '\n';
    }
    r += '  ' + ln('-', WW - 4) + '\n\n';

    // Sütun açıklamaları
    r += '  SUTUN ACIKLAMALARI\n';
    r += '  t            : Zaman [saniye]\n';
    r += '  Seg          : Aktif segment numarasi\n';
    r += '  Komut        : Surucu komutu (Tam Gaz / Gaz Kesme)\n';
    r += '  v [km/h]     : Arac hizi\n';
    r += '  n [rpm]      : Motor devri (! = no-load governed ustu, yakit yok)\n';
    r += '  Vites        : Aktif vites kademesi (C=Konvertor, L=Lockup)\n';
    r += '  F_cekis [N]  : Tekerlek cevresindeki cekis kuvveti\n';
    r += '  F_yuv [N]    : Yuvarlanma direnc kuvveti\n';
    r += '  F_aero [N]   : Aerodinamik suruklenme kuvveti\n';
    r += '  F_egim [N]   : Egim kuvveti (pozitif = direnc / negatif = itici)\n';
    r += '  F_net [N]    : Net kuvvet (m_eff * a)\n';
    r += '  a [m/s2]     : Ivme (pozitif = hizlanma, negatif = yavaslanma)\n';
    r += '  s [m]        : Toplam kat edilen mesafe\n';
    r += '  P_mot [kW]   : Motor gucu\n';
    r += '  P_tek [kW]   : Tekerlek gucu\n\n\n';


    // ── VITES GECIS OLAYLARI (SHIFT LOG) ──
    var shiftHist = ssSd.shiftHistory || [];
    if (shiftHist.length > 0) {
      r += ln('=', WW) + '\n';
      r += pad((sectionNum + 2) + '. VITES GECIS OLAYLARI (SHIFT LOG)', WW, 'center') + '\n';
      r += ln('=', WW) + '\n\n';

      var slTW = 90;
      r += '  ' + ln('-', slTW) + '\n';
      r += '  ' + pad('t [s]', 9, 'right') + pad('Seg', 5, 'right') + pad('Gecis', 14);
      r += pad('v [km/h]', 10, 'right') + pad('N_eng [rpm]', 12, 'right') + pad('N_out [rpm]', 12, 'right');
      r += pad('Tip', 14) + pad('F_cek/F_dir', 14, 'right') + '\n';
      r += '  ' + ln('-', slTW) + '\n';

      var totalUpshifts = 0, totalDownshiftsLog = 0;
      var minGear = 99, minGearSeg = 0, minGearTime = 0;
      var maxGear = 0;

      shiftHist.forEach(function(sh) {
        var isDS = sh.isDownshift;
        if (isDS) totalDownshiftsLog++; else totalUpshifts++;

        // Segment bul
        var shSeg = 1;
        for (var si2 = 0; si2 < segSum.length; si2++) {
          var segEnd = 0;
          for (var sj = 0; sj <= si2; sj++) segEnd += (segSum[sj].duration || 0);
          if (sh.t <= segEnd + 0.001) { shSeg = segSum[si2].no || (si2 + 1); break; }
        }

        var gecisStr = ascii(sh.fromMode + ' -> ' + sh.toMode);
        var tipStr = isDS ? 'Downshift' : (sh.toMode && sh.toMode.indexOf('L') >= 0 && sh.fromMode && sh.fromMode.indexOf('C') >= 0 ? 'Lockup' : 'Upshift');
        if (sh.fromMode === '1C' && sh.toMode === '2C') tipStr = 'Baslangic';

        var fStr = '';
        if (isDS && sh.F_traction !== undefined && sh.F_resist !== undefined) {
          fStr = numI(sh.F_traction) + '/' + numI(sh.F_resist);
        }

        // Min/max gear tracking
        var toGearNum = sh.toGear;
        if (toGearNum < minGear) { minGear = toGearNum; minGearSeg = shSeg; minGearTime = sh.t; }
        if (toGearNum > maxGear) { maxGear = toGearNum; }

        r += '  ' + pad(num(sh.t, 2), 9, 'right');
        r += pad(String(shSeg), 5, 'right');
        r += ' ' + pad(gecisStr, 13);
        r += pad(num(sh.v_kmh, 1), 10, 'right');
        r += pad(numI(sh.N_engine), 12, 'right');
        r += pad(numI(sh.N_out), 12, 'right');
        r += ' ' + pad(tipStr, 13);
        r += pad(fStr, 14, 'right');
        r += '\n';
      });
      r += '  ' + ln('-', slTW) + '\n\n';

      // Özet
      r += '  OZET:\n';
      r += pRow('Toplam Upshift', String(totalUpshifts));
      r += pRow('Toplam Downshift', String(totalDownshiftsLog));

      // Minimum vites bilgisi
      if (minGear < 99) {
        var minGearName = (minGear + 1) + 'L';
        r += pRow('Minimum Vites', minGearName + ' (Segment ' + minGearSeg + ', t=' + num(minGearTime, 1) + 's)');
      }
      var maxGearName = (maxGear + 1) + 'L';
      r += pRow('Maksimum Vites', maxGearName);

      // Kaskad downshift kontrolü
      var hasCascade = false, cascadeInfo = '';
      for (var ci = 1; ci < shiftHist.length; ci++) {
        if (shiftHist[ci].isDownshift && shiftHist[ci - 1].isDownshift) {
          hasCascade = true;
          cascadeInfo = ascii(shiftHist[ci - 1].fromMode + '->' + shiftHist[ci - 1].toMode + ', ' + shiftHist[ci].fromMode + '->' + shiftHist[ci].toMode);
          break;
        }
      }
      r += pRow('Kaskad Downshift', hasCascade ? ('Evet (' + cascadeInfo + ')') : 'Hayir');
      r += '\n\n';
    }

    // ── PERFORMANS DEGERLENDIRME ──
    r += ln('=', W) + '\n';
    r += pad((sectionNum + 2 + (shiftHist.length > 0 ? 1 : 0)) + '. PERFORMANS DEGERLENDIRME', W, 'center') + '\n';
    r += ln('=', W) + '\n\n';

    // Genel özet
    r += '  GENEL OZET\n';
    r += '  ' + ln('-', 50) + '\n';
    r += pRow('Baslangic Hizi', num(v0, 1) + ' km/h');
    r += pRow('Bitis Hizi', num(vF, 1) + ' km/h');
    r += pRow('Toplam Hiz Degisimi', (dvTotal >= 0 ? '+' : '') + num(dvTotal, 1) + ' km/h');
    r += pRow('Toplam Mesafe', num(ssSd.totalDistance || 0, 1) + ' m');
    r += pRow('Toplam Sure', num(totalTime, 1) + ' s');
    if (totalTime > 0 && ssSd.totalDistance > 0) {
      var avgSpeed = (ssSd.totalDistance / totalTime) * 3.6;
      r += pRow('Ortalama Hiz', num(avgSpeed, 1) + ' km/h');
    }
    r += '\n';

    // Segment bazlı değerlendirme
    r += '  SEGMENT BAZLI DEGERLENDIRME\n';
    r += '  ' + ln('-', 70) + '\n';
    segSum.forEach(function(seg) {
      var komut = seg.command === 'coast' ? 'Gaz Kesme' : 'Tam Gaz';
      var dv = seg.endSpeed_kmh - seg.startSpeed_kmh;
      var grade = seg.grade || 0;

      r += '  Segment ' + seg.no + ' (' + ascii(komut) + ', %' + num(grade, 1) + ' egim):\n';
      r += '    Hiz: ' + num(seg.startSpeed_kmh, 1) + ' -> ' + num(seg.endSpeed_kmh, 1) + ' km/h';
      r += ' (dV = ' + (dv >= 0 ? '+' : '') + num(dv, 1) + ' km/h)\n';
      r += '    Mesafe: ' + numI(seg.actualDist || seg.targetDist) + ' m, Sure: ' + num(seg.duration, 1) + ' s\n';
      if (seg.startGear || seg.endGear) {
        r += '    Vites: ' + ascii(String(seg.startGear || '?')) + ' -> ' + ascii(String(seg.endGear || '?'));
        if (seg.downshiftCount > 0) r += ' (' + seg.downshiftCount + ' downshift)';
        r += '\n';
      }

      // Yorum
      if (seg.endSpeed_kmh < 1.0) {
        r += '    >> UYARI: Arac bu segmentte durma noktasina gelmistir!\n';
      } else if (seg.command === 'coast' && dv > 5) {
        r += '    >> NOT: Gaz kesme modunda belirgin hizlanma -- yokus asagi etkisi.\n';
      } else if (seg.command === 'full_throttle' && dv < -5) {
        r += '    >> NOT: Tam gaz modunda belirgin yavaslanma -- yuksek egim direnci.\n';
      }
      r += '\n';
    });

    // Kritik noktalar
    r += '  KRITIK NOKTALAR\n';
    r += '  ' + ln('-', 50) + '\n';
    var hasStall = segSum.some(function(seg) { return seg.endSpeed_kmh < 1.0; });
    var allSpeeds = sd.speed || [];
    var globalMaxSpeed = allSpeeds.length > 0 ? Math.max.apply(null, allSpeeds) : 0;
    var globalMinSpeed = allSpeeds.length > 0 ? Math.min.apply(null, allSpeeds) : 0;

    r += pRow('Maksimum Hiz', num(globalMaxSpeed, 1) + ' km/h');
    r += pRow('Minimum Hiz', num(globalMinSpeed, 1) + ' km/h');

    // Vites bilgileri
    var shHistCrit = ssSd.shiftHistory || [];
    var critTotalDS = 0;
    var critMinGear = 99, critMinGearSeg = 0, critMinGearTime = 0;
    shHistCrit.forEach(function(sh) {
      if (sh.isDownshift) critTotalDS++;
      if (sh.toGear < critMinGear) {
        critMinGear = sh.toGear;
        // Segment bul
        for (var si3 = 0; si3 < segSum.length; si3++) {
          var sEnd = 0;
          for (var sj3 = 0; sj3 <= si3; sj3++) sEnd += (segSum[sj3].duration || 0);
          if (sh.t <= sEnd + 0.001) { critMinGearSeg = segSum[si3].no || (si3 + 1); break; }
        }
        critMinGearTime = sh.t;
      }
    });
    if (critTotalDS > 0) {
      r += pRow('Toplam Downshift Sayisi', String(critTotalDS));
      if (critMinGear < 99) {
        r += pRow('Minimum Vites', (critMinGear + 1) + 'L (Segment ' + critMinGearSeg + ', t=' + num(critMinGearTime, 1) + 's)');
      }
      // Kaskad downshift
      var critCascade = false, critCascadeInfo = '';
      for (var ci2 = 1; ci2 < shHistCrit.length; ci2++) {
        if (shHistCrit[ci2].isDownshift && shHistCrit[ci2 - 1].isDownshift) {
          critCascade = true;
          critCascadeInfo = ascii(shHistCrit[ci2].fromMode + '->' + shHistCrit[ci2].toMode);
          break;
        }
      }
      if (critCascade) {
        r += pRow('Kaskad Downshift', 'Evet (' + critCascadeInfo + ')');
      }
    }

    if (hasStall) {
      r += '  >> UYARI: Arac bir veya daha fazla segmentte durma noktasina gelmistir.\n';
      r += '     Daha uygun vites veya guzergah secimi degerlendirilmelidir.\n';
    } else if (globalMinSpeed < 10) {
      r += '  >> DIKKAT: Minimum hiz 10 km/h altina dusmustur.\n';
    } else {
      r += '  >> Arac tum segmentleri basarili bir sekilde tamamlamistir.\n';
    }
    r += '\n\n';

    // Segment arasında ayırıcı (multi-transfer)
    if (hasMultiTransfer && trIdx < trGearKeys.length - 1) {
      r += '\n' + ln('#', W) + '\n\n';
      // Bölüm numarasını artır (3 bölüm per transfer kademe)
    }
  }); // trGearKeys.forEach end

  sectionNum = sectionNum + 3; // son bölüm numarasını güncelle


  // ════════════════════════════════════════════════════════════════════════
  // TRANSFER KADEMESI KARSILASTIRMA (çoklu kademe varsa)
  // ════════════════════════════════════════════════════════════════════════
  if (hasMultiTransfer) {
    r += ln('=', W) + '\n';
    r += pad(sectionNum + '. TRANSFER KADEMESI KARSILASTIRMA', W, 'center') + '\n';
    r += ln('=', W) + '\n\n';

    var cmpW = 58;
    // Başlık
    r += '  ' + ln('-', cmpW + (trGearKeys.length - 1) * 24) + '\n';
    r += '  ' + pad('Parametre', 34);
    trGearKeys.forEach(function(trKey) {
      r += pad(ascii(String(trKey)), 24, 'right');
    });
    r += '\n';
    r += '  ' + ln('-', cmpW + (trGearKeys.length - 1) * 24) + '\n';

    // Transfer oranı
    r += '  ' + pad('Transfer Orani', 34);
    trGearKeys.forEach(function(trKey) {
      var sd2 = sdAll[trKey] || sdPrimary;
      var ss2 = sd2.solverStats || {};
      r += pad(num(ss2.i_transfer, 3), 24, 'right');
    });
    r += '\n';

    // Başlangıç/bitiş hızı
    r += '  ' + pad('Baslangic Hizi [km/h]', 34);
    trGearKeys.forEach(function(trKey) {
      var sd2 = sdAll[trKey] || sdPrimary;
      var sum2 = sd2.segmentSummary || [];
      var v02 = sum2.length > 0 ? sum2[0].startSpeed_kmh : 0;
      r += pad(num(v02, 1), 24, 'right');
    });
    r += '\n';

    r += '  ' + pad('Bitis Hizi [km/h]', 34);
    trGearKeys.forEach(function(trKey) {
      var sd2 = sdAll[trKey] || sdPrimary;
      var sum2 = sd2.segmentSummary || [];
      var vF2 = sum2.length > 0 ? sum2[sum2.length - 1].endSpeed_kmh : 0;
      r += pad(num(vF2, 1), 24, 'right');
    });
    r += '\n';

    r += '  ' + pad('Hiz Degisimi [km/h]', 34);
    trGearKeys.forEach(function(trKey) {
      var sd2 = sdAll[trKey] || sdPrimary;
      var sum2 = sd2.segmentSummary || [];
      var v02 = sum2.length > 0 ? sum2[0].startSpeed_kmh : 0;
      var vF2 = sum2.length > 0 ? sum2[sum2.length - 1].endSpeed_kmh : 0;
      var dv2 = vF2 - v02;
      r += pad((dv2 >= 0 ? '+' : '') + num(dv2, 1), 24, 'right');
    });
    r += '\n';

    // Toplam süre
    r += '  ' + pad('Toplam Sure [s]', 34);
    trGearKeys.forEach(function(trKey) {
      var sd2 = sdAll[trKey] || sdPrimary;
      var sum2 = sd2.segmentSummary || [];
      var tT = 0;
      sum2.forEach(function(s) { tT += s.duration || 0; });
      r += pad(num(tT, 1), 24, 'right');
    });
    r += '\n';

    // Minimum hız
    r += '  ' + pad('Minimum Hiz [km/h]', 34);
    trGearKeys.forEach(function(trKey) {
      var sd2 = sdAll[trKey] || sdPrimary;
      var spArr = sd2.speed || [];
      var vMin2 = spArr.length > 0 ? Math.min.apply(null, spArr) : 0;
      r += pad(num(vMin2, 1), 24, 'right');
    });
    r += '\n';

    // Maksimum hız
    r += '  ' + pad('Maksimum Hiz [km/h]', 34);
    trGearKeys.forEach(function(trKey) {
      var sd2 = sdAll[trKey] || sdPrimary;
      var spArr = sd2.speed || [];
      var vMax2 = spArr.length > 0 ? Math.max.apply(null, spArr) : 0;
      r += pad(num(vMax2, 1), 24, 'right');
    });
    r += '\n';

    // Durma durumu
    r += '  ' + pad('Arac Durumu', 34);
    trGearKeys.forEach(function(trKey) {
      var sd2 = sdAll[trKey] || sdPrimary;
      var sum2 = sd2.segmentSummary || [];
      var ss2 = sd2.solverStats || {};
      var stalled = sum2.some(function(s) { return s.endSpeed_kmh < 1.0; });
      var totalRouteDist = 0, totalActualDist = 0, totalTime2 = 0;
      sum2.forEach(function(s) {
        totalRouteDist += s.targetDist || 0;
        totalActualDist += s.actualDist || 0;
        totalTime2 += s.duration || 0;
      });
      var routeComplete = totalActualDist >= totalRouteDist - 1;
      var timeExceeded = totalTime2 >= (ss2.maxTime || 9999) - 0.1;
      var status;
      if(stalled) status = 'DURDU';
      else if(!routeComplete && timeExceeded) status = 'SURE LIMITI';
      else if(!routeComplete) status = 'EKSIK';
      else status = 'TAMAMLADI';
      r += pad(status, 24, 'right');
    });
    r += '\n';

    r += '  ' + ln('-', cmpW + (trGearKeys.length - 1) * 24) + '\n\n';

    // Segment bazlı karşılaştırma
    r += '  SEGMENT BAZLI HIZ KARSILASTIRMASI (Cikis Hizlari [km/h])\n';
    r += '  ' + ln('-', cmpW + (trGearKeys.length - 1) * 24) + '\n';
    r += '  ' + pad('Segment', 10) + pad('Egim %', 10, 'right') + pad('Komut', 14);
    trGearKeys.forEach(function(trKey) {
      r += pad(ascii(String(trKey)), 24, 'right');
    });
    r += '\n';
    r += '  ' + ln('-', cmpW + (trGearKeys.length - 1) * 24) + '\n';

    var refSegSum = sdPrimary.segmentSummary || [];
    refSegSum.forEach(function(seg, si) {
      var komut = seg.command === 'coast' ? 'Gaz Kesme' : 'Tam Gaz';
      r += '  ' + pad('Seg ' + seg.no, 10) + pad(num(seg.grade, 1), 10, 'right') + pad(ascii(komut), 14);
      trGearKeys.forEach(function(trKey) {
        var sd2 = sdAll[trKey] || sdPrimary;
        var sum2 = sd2.segmentSummary || [];
        var segD = sum2[si];
        if (segD) {
          r += pad(num(segD.endSpeed_kmh, 1), 24, 'right');
        } else {
          r += pad('-', 24, 'right');
        }
      });
      r += '\n';
    });
    r += '  ' + ln('-', cmpW + (trGearKeys.length - 1) * 24) + '\n\n\n';

    sectionNum++;
  }


  // ════════════════════════════════════════════════════════════════════════
  // HESAPLAMA YONTEMI
  // ════════════════════════════════════════════════════════════════════════
  r += ln('=', W) + '\n';
  r += pad(sectionNum + '. HESAPLAMA YONTEMI', W, 'center') + '\n';
  r += ln('=', W) + '\n\n';

  r += '  DIFERANSIYEL DENKLEM\n';
  r += '  ' + ln('-', 60) + '\n';
  r += '  m_eff * dv/dt = F_cekis - F_yuvarlanma - F_aero - F_egim\n\n';
  r += '  m_eff : Efektif kutle (donerlik ataleti dahil, vites bagimli)\n';
  r += '  F_cekis = T_turbin * i_gear * i_ps * i_tr * i_axle * eta / r_tire\n';
  r += '  F_yuv = Crr * m * g * cos(theta)\n';
  r += '  F_aero = 0.5 * rho * Cd * A * v^2\n';
  r += '  F_egim = m * g * sin(theta)\n\n';

  r += '  GAZ KESME (COAST) MODELI\n';
  r += '  ' + ln('-', 60) + '\n';
  r += '  F_cekis = 0 (motor gaz kesmede)\n';
  r += '  F_motor_surukleme = T_motoring * i_total / r_tire\n';
  r += '  T_motoring = BMEP_motoring * V_d / (4 * pi)\n';
  r += '  BMEP_motoring ~ 50 kPa (tipik dizel motor kompresyon suruklemesi)\n\n';

  r += '  SEGMENT GECISLERI\n';
  r += '  ' + ln('-', 60) + '\n';
  r += '  Her segment sonunda hiz surekliligi saglanir (v_cikis = v_giris).\n';
  r += '  Egim ve komut degisiklikleri anlik uygulanir.\n';
  r += '  Vites durumu segment gecisinde korunur.\n\n';

  r += '  COZUCU PARAMETRELERI\n';
  r += '  ' + ln('-', 60) + '\n';
  r += pRow('Entegrasyon Metodu', solverLabel);
  r += pRow('Zaman Adimi (dt)', num(ss0.dt, 4) + ' s');
  r += pRow('Toplam Adim', String(ss0.steps || '-'));
  r += pRow('Maks. Simulasyon Suresi', num(ss0.maxTime, 0) + ' s');
  r += '\n\n';
  sectionNum++;


  // ════════════════════════════════════════════════════════════════════════
  // RAPOR SONU
  // ════════════════════════════════════════════════════════════════════════
  r += ln('-', W) + '\n';
  r += pad('RAPOR SONU', W, 'center') + '\n';
  r += ln('=', W) + '\n\n';

  r += ln('-', W) + '\n';
  r += pad('BMC OTOMOTIV SANAYI VE TICARET A.S.', W, 'center') + '\n';
  r += pad('GUC GRUBU MUDURLUGU', W, 'center') + '\n';
  r += ln('-', W) + '\n\n';

  r += pRow('Hazirlayan', ascii(hazirlayan));
  r += pRow('Iletisim', veNameToEmail(hazirlayan));
  r += '\n';

  r += ln('-', W) + '\n';
  r += pad('Bu rapor BMC MFSim Hizlanma-Yavaslama Segment Analizi Programi', W, 'center') + '\n';
  r += pad('ile otomatik olusturulmustur. Hesaplamalar', W, 'center') + '\n';
  r += pad('teorik modellere dayanmaktadir. Gercek test sonuclari ile', W, 'center') + '\n';
  r += pad('dogrulama yapilmasi onerilir.', W, 'center') + '\n';
  r += ln('-', W) + '\n\n';

  r += pad('(c) ' + now.getFullYear() + ' BMC Otomotiv -- Tum Haklari Saklidir', W, 'center') + '\n';

  return r;
}

// ===== ENGEL ATLAMA TXT RAPORU =====
function veGenerateObstacleCrossingTxtReport(sim, optHazirlayan) {
  var W = 80;

  function ln(ch, len) { var s = ''; for (var i = 0; i < len; i++) s += ch; return s; }
  function pad(str, len, align) {
    str = String(str);
    if (align === 'right') { while (str.length < len) str = ' ' + str; return str; }
    if (align === 'center') {
      var l = Math.floor((len - str.length) / 2);
      var r2 = len - str.length - l;
      var sp = ''; for (var i = 0; i < l; i++) sp += ' ';
      var sp2 = ''; for (var i = 0; i < r2; i++) sp2 += ' ';
      return sp + str + sp2;
    }
    while (str.length < len) str += ' ';
    return str;
  }
  function num(v, d) { return isFinite(v) ? v.toFixed(d) : '-'; }
  function numI(v) { return isFinite(v) ? Math.round(v).toString() : '-'; }
  function pRow(label, value, indent) {
    indent = indent || '  ';
    var labelW = 32;
    return indent + pad(label, labelW) + ': ' + value + '\n';
  }
  function ascii(s) {
    return String(s)
      .replace(/ğ/g,'g').replace(/Ğ/g,'G')
      .replace(/ü/g,'u').replace(/Ü/g,'U')
      .replace(/ş/g,'s').replace(/Ş/g,'S')
      .replace(/ı/g,'i').replace(/İ/g,'I')
      .replace(/ö/g,'o').replace(/Ö/g,'O')
      .replace(/ç/g,'c').replace(/Ç/g,'C');
  }

  var obs = sim.obstacleCrossing;
  if (!obs) {
    return '(Rapor olusturulamadi: Engel Atlama simulasyon verisi bulunamadi.)\n';
  }

  var inp = obs.inputParams || {};
  var geo = obs.geometry || {};
  var hazirlayan = optHazirlayan || (document.getElementById('ve-rapor-hazirlayan') || {}).value || 'Belirtilmemis';
  var now = new Date();
  var tarih = String(now.getDate()).padStart(2,'0') + '.' + String(now.getMonth()+1).padStart(2,'0') + '.' + now.getFullYear();
  var saat = String(now.getHours()).padStart(2,'0') + ':' + String(now.getMinutes()).padStart(2,'0') + ':' + String(now.getSeconds()).padStart(2,'0');
  var raporNo = 'BMC-OBS-' + now.getFullYear() + '-' + String(Math.floor(Math.random() * 9000) + 1000);

  var r = '';

  // BASLIK
  r += '\n' + ln('=', W) + '\n\n';
  r += pad(' ######   ##    ##    ###### ', W, 'center') + '\n';
  r += pad(' ##   ##  ###  ###   ##      ', W, 'center') + '\n';
  r += pad(' ######   ## ## ##   ##      ', W, 'center') + '\n';
  r += pad(' ##   ##  ##    ##   ##      ', W, 'center') + '\n';
  r += pad(' ######   ##    ##    ###### ', W, 'center') + '\n\n';
  r += pad('BMC Otomotiv Sanayi ve Ticaret A.S.', W, 'center') + '\n';
  r += pad('Guc Grubu Mudurlugu', W, 'center') + '\n\n';
  r += ln('=', W) + '\n\n';
  r += pad('+' + ln('-', 44) + '+', W, 'center') + '\n';
  r += pad('|   ENGEL ATLAMA ANALIZI RAPORU   |', W, 'center') + '\n';
  r += pad('+' + ln('-', 44) + '+', W, 'center') + '\n\n';

  // Topoloji bileşen isimlerini topla
  var _vehNode = nodes.find(function(n) { return n.type === 'vehicle'; });
  var _vehD = _vehNode ? (_vehNode.data || {}) : {};
  var _engNodeR = nodes.find(function(n) { return n.type === 'engine'; });
  var _gbNodeR = nodes.find(function(n) { return n.type === 'gearbox'; });
  var _tcNodeR = nodes.find(function(n) { return n.type === 'torque-converter'; });
  var _trNodeR = nodes.find(function(n) { return n.type === 'transfer'; });
  var _diffNodeR = nodes.find(function(n) { return n.type === 'differential'; });
  var _wheelNodeR = nodes.find(function(n) { return n.type === 'wheel'; });
  var _propNodeR = nodes.find(function(n) { return n.type === 'propshaft'; });
  var _brakeNodeR = nodes.find(function(n) { return n.type === 'retarder' || n.type === 'brake'; });
  var _obsNodeR = nodes.find(function(n) { return n.type === 'obstacle-crossing'; });

  // Bileşen adı alma yardımcısı: customName → tipe özel preset/model adı → def.name → type
  function _cName(nd) {
    if(!nd) return '';
    var cn = nd.customName || '';
    if(!cn) {
      var d = nd.data || {};
      // Tipe özel anlamlı isim araması
      if(nd.type === 'engine') cn = d.ftMotorPreset || d.mfMotorPreset || (d.motorSpecs && d.motorSpecs.displacement ? d.motorSpecs.displacement + 'L Motor' : '');
      else if(nd.type === 'gearbox') cn = d.gbName || d.selectedGearbox || d.ftGBPreset || '';
      else if(nd.type === 'torque-converter') cn = d.tcName || d.tcPresetKey || '';
      else if(nd.type === 'transfer') cn = d.ftTrName || d.ftTrPreset || '';
      else if(nd.type === 'differential') cn = d.diffRatio ? ('i=' + parseFloat(d.diffRatio).toFixed(3)) : '';
      else if(nd.type === 'wheel') cn = d.ftTireName || (d.ftTireRadius ? ('R=' + parseFloat(d.ftTireRadius).toFixed(3) + 'm') : '') || (d.wheelRadius ? ('R=' + parseFloat(d.wheelRadius).toFixed(3) + 'm') : '');
      else if(nd.type === 'propshaft') cn = d.psName || '';
      else if(nd.type === 'vehicle') cn = d.ftVehName || d.ftVehicleName || '';
      else if(nd.type === 'obstacle-crossing') cn = d.obstacleHeight ? ('h=' + parseFloat(d.obstacleHeight).toFixed(3) + 'm') : '';
    }
    if(!cn && nd.data && nd.data.motorName) cn = nd.data.motorName;
    if(!cn && typeof componentDefs !== 'undefined' && componentDefs[nd.type]) cn = componentDefs[nd.type].name;
    if(!cn) cn = nd.type;
    return ascii(cn);
  }

  var vehicleName = _vehNode ? (_vehNode.customName || _vehD.ftVehicleName || '') : '';

  // 1. RAPOR BILGILERI
  r += ln('-', W) + '\n  RAPOR BILGILERI\n' + ln('-', W) + '\n';
  r += pRow('Rapor Tarihi', tarih);
  r += pRow('Rapor Saati', saat);
  r += pRow('Rapor No', raporNo);
  r += pRow('Arac', vehicleName ? ascii(vehicleName) : 'Belirtilmemis');
  r += pRow('Hazirlayan', ascii(hazirlayan));
  var hazEmail = (typeof veNameToEmail === 'function') ? veNameToEmail(hazirlayan) : '';
  if(hazEmail) r += pRow('Iletisim', hazEmail);
  r += pRow('Hesaplama Modu', 'Engel Atlama Analizi');
  r += '\n';

  // ════════════════════════════════════════════════════════════════════════
  // 1. ARAC PARAMETRELERI
  // ════════════════════════════════════════════════════════════════════════
  r += '\n' + ln('=', W) + '\n';
  r += pad('1. ARAC PARAMETRELERI', W, 'center') + '\n';
  r += ln('=', W) + '\n\n';
  r += pRow('Arac Kutle (GVW)', num(inp.mass, 0) + ' kg');
  r += pRow('Ag. Merkezi-On Aks (a1)', num(inp.a1, 3) + ' m');
  r += pRow('Ag. Merkezi-Arka Aks (a2)', num(inp.a2, 3) + ' m');
  r += pRow('Dingil Mesafesi (L=a1+a2)', num(inp.wheelbase, 3) + ' m');
  r += '\n';

  // KONFIGURASYON alt bölümü
  r += '\n';
  r += '  KONFIGURASYON\n';
  r += '  ' + ln('-', 38) + '\n';
  if(_engNodeR) r += pRow('Motor', _cName(_engNodeR));
  if(_tcNodeR) r += pRow('Tork Konvertor', _cName(_tcNodeR));
  if(_gbNodeR) r += pRow('Sanziman', _cName(_gbNodeR));
  if(_trNodeR) r += pRow('Transfer Kutusu', _cName(_trNodeR));
  if(_propNodeR) r += pRow('Propshaft', _cName(_propNodeR));
  if(_diffNodeR) r += pRow('Diferansiyel', _cName(_diffNodeR));
  if(_wheelNodeR) r += pRow('Tekerlek / Lastik', _cName(_wheelNodeR));
  r += pRow('Lastik', ascii(inp.tireName));
  if(_brakeNodeR) r += pRow('Fren / Retarder', _cName(_brakeNodeR));
  if(_obsNodeR) r += pRow('Engel Gecme', _cName(_obsNodeR));
  // Topolojideki diğer bileşenler
  var _listedTypes = ['vehicle','engine','torque-converter','gearbox','transfer','propshaft','differential','wheel','retarder','brake','obstacle-crossing','solver'];
  nodes.forEach(function(nd) {
    if(_listedTypes.indexOf(nd.type) < 0 && nd.type !== 'road') {
      r += pRow(ascii(nd.type), _cName(nd));
    }
  });
  r += '\n';

  // ════════════════════════════════════════════════════════════════════════
  // 2. ENGEL PARAMETRELERI
  // ════════════════════════════════════════════════════════════════════════
  r += '\n' + ln('=', W) + '\n';
  r += pad('2. ENGEL VE LASTIK PARAMETRELERI', W, 'center') + '\n';
  r += ln('=', W) + '\n\n';
  r += '  ENGEL PARAMETRELERI\n';
  r += '  ' + ln('-', 38) + '\n';
  r += pRow('Engel Yuksekligi (h)', num(inp.h, 3) + ' m');
  r += '\n';

  r += '\n';
  r += '  LASTIK PARAMETRELERI\n';
  r += '  ' + ln('-', 38) + '\n';
  r += pRow('Lastik', ascii(inp.tireName));
  r += pRow('Yuvarlanma Yaricapi', num(inp.rollingRadius, 3) + ' m');
  r += pRow('Yuklu Lastik Yaricapi (R_eff)', num(inp.R_eff, 3) + ' m');
  if(inp.cornerDeflection) {
    var R_corner_val = inp.R_eff - inp.cornerDeflection / 1000;
    r += pRow('Kose Defleksiyonu (delta)', num(inp.cornerDeflection, 0) + ' mm');
    r += pRow('Kose Yaricapi (R_corner)', num(R_corner_val, 4) + ' m');
  }
  r += '\n';

  // 5-6. MOTOR & TORK KONVERTOR VERILERI (yan yana)
  var _engNode = nodes.find(function(n) { return n.type === 'engine'; });
  var _engD = _engNode ? (_engNode.data || {}) : {};
  var _engSpecs = _engD.motorSpecs || {};
  var _engTorqueData = _engD.torqueData || [];
  var _tcNode = nodes.find(function(n) { return n.type === 'torque-converter'; });
  var _tcD = _tcNode ? (_tcNode.data || {}) : {};
  var _tcDataArr = _tcD.tcData || [];

  var motorAdi = _engNode ? (_engNode.customName || '') : '';
  var tcAdi = _tcNode ? (_tcNode.customName || '') : '';

  // ════════════════════════════════════════════════════════════════════════
  // 3. MOTOR & TORK KONVERTOR VERILERI
  // ════════════════════════════════════════════════════════════════════════
  r += '\n' + ln('=', W) + '\n';
  r += pad('3. MOTOR & TORK KONVERTOR VERILERI', W, 'center') + '\n';
  r += ln('=', W) + '\n\n';

  // Üst bilgiler yan yana
  var cL = 38, cR = 38;
  if(motorAdi) r += '  ' + pad('Motor: ' + ascii(motorAdi), cL) + (tcAdi ? 'TC: ' + ascii(tcAdi) : '') + '\n';
  var govStr = _engSpecs.governedSpeed ? num(parseFloat(_engSpecs.governedSpeed), 0) + ' RPM' : '-';
  var idlStr = _engSpecs.idleRpm ? num(parseFloat(_engSpecs.idleRpm), 0) + ' RPM' : '-';
  var ineStr = _engSpecs.inertia ? num(parseFloat(_engSpecs.inertia), 4) + ' kg.m2' : '-';
  var pdStr = _tcD.pumpTorqueDrop !== undefined ? num(parseFloat(_tcD.pumpTorqueDrop), 1) + ' Nm' : '-';
  r += '  ' + pad('Governed: ' + govStr, cL) + 'Pump Dusumu: ' + pdStr + '\n';
  r += '  ' + pad('Rolanti: ' + idlStr, cL) + '\n';
  r += '  ' + pad('Atalet: ' + ineStr, cL) + '\n';
  r += '\n';

  // Tablolar yan yana
  var maxRows = Math.max(_engTorqueData.length, _tcDataArr.length);
  if(maxRows > 0) {
    // Başlıklar
    r += '  ' + pad('Motor Tork Egrisi', cL) + 'TC Karakteristik\n';
    r += '  ' + pad(pad('RPM', 7, 'right') + pad('Tork(Nm)', 11, 'right'), cL);
    r += pad('SR', 7, 'right') + pad('K_pump', 9, 'right') + pad('TR', 7, 'right') + '\n';
    r += '  ' + pad(ln('-', 18), cL) + ln('-', 23) + '\n';

    for(var ri = 0; ri < maxRows; ri++) {
      var leftStr = '';
      if(ri < _engTorqueData.length) {
        var tp = _engTorqueData[ri];
        leftStr = pad(num(tp.rpm || tp.x, 0), 7, 'right') + pad(num(tp.torque || tp.y, 1), 11, 'right');
      }
      var rightStr = '';
      if(ri < _tcDataArr.length) {
        var tc = _tcDataArr[ri];
        rightStr = pad(num(tc.sr, 3), 7, 'right') + pad(num(tc.kpump, 2), 9, 'right') + pad(num(tc.tau, 3), 7, 'right');
      }
      r += '  ' + pad(leftStr, cL) + rightStr + '\n';
    }
    r += '\n';
  }

  // MOTOR-KONVERTÖR EŞLEŞME TABLOSU + ŞANZIMAN ÇIKIŞ TABLOSU
  var dyn = sim.obstacleDynamic;
  var mt = dyn ? dyn.matchTable : null;
  if(mt && mt.length > 0) {
    // FT raporuyla aynı kolon genişlikleri
    var _c = [9, 9, 9, 12, 12, 10, 12, 10, 14, 16];
    var _cmTW = 0; for (var _wi = 0; _wi < _c.length; _wi++) _cmTW += _c[_wi];

    r += ln('=', _cmTW + 4) + '\n';
    r += pad('KONVERTOR MODU (Tum Kademeler)', _cmTW + 4, 'center') + '\n';
    r += ln('=', _cmTW + 4) + '\n\n';

    r += '  ' + pad('Motor Fani', 16) + pad('Klima', 16) + pad('Motor Gucu', 30) + 'Arac Parametreleri\n';
    r += '  ' + ln('-', _cmTW) + '\n';
    r += '  ' + pad('Acik', 16) + pad('Kapali', 16) + pad('Standart Guc Egrisi', 30) + 'Standart\n\n';

    // Tablo basligi — satir 1
    r += '  ' + pad('Hiz', _c[0], 'right') + pad('Tork', _c[1], 'right') + pad('Motor', _c[2], 'right');
    r += pad('Net Motor', _c[3], 'right') + pad('Net Motor', _c[4], 'right');
    r += pad('Turbin', _c[5], 'right') + pad('Turbin', _c[6], 'right') + pad('Turbin', _c[7], 'right');
    r += pad('Konvertor Isi', _c[8], 'right') + pad('Esleme', _c[9], 'right') + '\n';
    // Tablo basligi — satir 2
    r += '  ' + pad('Orani', _c[0], 'right') + pad('Orani', _c[1], 'right') + pad('Devri', _c[2], 'right');
    r += pad('Torku (N-m)', _c[3], 'right') + pad('Gucu (kW)', _c[4], 'right');
    r += pad('Devri', _c[5], 'right') + pad('Torku (N-m)', _c[6], 'right') + pad('Gucu (kW)', _c[7], 'right');
    r += pad('Reddi (kW)', _c[8], 'right') + pad('Noktasi', _c[9], 'right') + '\n';
    // Tablo basligi — satir 3 (birimler)
    r += '  ' + pad('', _c[0], 'right') + pad('', _c[1], 'right') + pad('(rpm)', _c[2], 'right');
    r += pad('', _c[3], 'right') + pad('', _c[4], 'right');
    r += pad('(rpm)', _c[5], 'right') + pad('', _c[6], 'right') + pad('', _c[7], 'right');
    r += pad('', _c[8], 'right') + pad('', _c[9], 'right') + '\n';
    r += '  ' + ln('-', _cmTW) + '\n';

    for(var mti = 0; mti < mt.length; mti++) {
      var mp = mt[mti];
      var _Nt = Math.round(mp.N_engine * mp.SR);
      r += '  ' + pad(num(mp.SR, 3), _c[0], 'right') + pad(num(mp.TR, 3), _c[1], 'right');
      r += pad(numI(mp.N_engine), _c[2], 'right') + pad(num(mp.T_engine, 1), _c[3], 'right');
      r += pad(num(mp.P_engine_kW, 1), _c[4], 'right') + pad(numI(_Nt), _c[5], 'right');
      r += pad(num(mp.T_turbine, 1), _c[6], 'right') + pad(num(mp.P_turbine_kW, 1), _c[7], 'right');
      r += pad(num(mp.Q_reject_kW, 2), _c[8], 'right');
      r += pad(mp.matchPoint || '', _c[9], 'right') + '\n';
    }
    r += '  ' + ln('-', _cmTW) + '\n\n';

    var _ptd = (inp.pumpTorqueDrop !== undefined) ? inp.pumpTorqueDrop : 17.6;
    r += '  Not: T_turbin = T_pompa x TR.  T_pompa = (N_motor / K_pompa)^2.  Dusurme = ' + num(_ptd, 1) + ' N.m.\n';
    r += '       T_motor(N) - Dusurme = T_pompa(N)  denklemi bisection ile cozulmustur.\n';
    r += '\n\n';

    // ŞANZIMAN ÇIKIŞ TABLOSU
    var gearLabel = inp.gearName ? ascii(inp.gearName) : '1C';
    r += '\n  SANZIMAN CIKIS TABLOSU (Gear ' + gearLabel + ' - Converter Mode)\n';
    r += '  ' + ln('-', 60) + '\n\n';

    r += '  ' + pad('SR', 7, 'right') + pad('N_eng', 7, 'right') + pad('T_eng', 8, 'right') + pad('P_eng', 8, 'right');
    r += pad('N_out', 8, 'right') + pad('T_gb', 8, 'right') + pad('P_gb', 8, 'right');
    r += pad('Q_rej', 8, 'right') + '  Match Point\n';
    r += '  ' + ln('-', 70) + '\n';

    for(var mti2 = 0; mti2 < mt.length; mti2++) {
      var mp2 = mt[mti2];
      var N_out = Math.round(mp2.N_engine * mp2.SR * (inp.gearRatio || 1));
      var P_gb_kW = mp2.T_gb_out > 0 && N_out > 0 ? (mp2.T_gb_out * N_out * 2 * Math.PI / 60 / 1000) : mp2.P_turbine_kW;
      r += '  ' + pad(num(mp2.SR, 3), 7, 'right') + pad(num(mp2.N_engine, 0), 7, 'right');
      r += pad(num(mp2.T_engine, 1), 8, 'right') + pad(num(mp2.P_engine_kW, 1), 8, 'right');
      r += pad(num(N_out, 0), 8, 'right') + pad(num(mp2.T_gb_out, 1), 8, 'right');
      r += pad(num(P_gb_kW, 1), 8, 'right') + pad(num(mp2.Q_reject_kW, 2), 8, 'right');
      r += (mp2.matchPoint ? '  ' + mp2.matchPoint : '') + '\n';
    }
    r += '\n';
  }

  // 7. AKTARMA PARAMETRELERI
  var stl = obs.stallAnalysis;
  r += ln('-', W) + '\n  AKTARMA PARAMETRELERI\n' + ln('-', W) + '\n';
  r += pRow('Secilen Vites', '1C  (' + ascii(inp.gearName) + ', i_g = ' + num(inp.gearRatio, 3) + ')');
  if(stl && stl.hasData) {
    r += pRow('Transfer Kademe', ascii(stl.transferName) + '  (i_tr = ' + num(stl.i_transfer, 3) + ', eta = ' + num(stl.eta_transfer * 100, 1) + '%)');
    r += pRow('Diferansiyel Orani', 'i_diff = ' + num(stl.i_axle, 3) + '  (eta = ' + num(stl.eta_axle * 100, 1) + '%)');
    r += pRow('Propshaft Verimi', num(stl.eta_prop * 100, 2) + '%');
    r += pRow('Toplam Verim (eta_total)', num(stl.eta_total * 100, 2) + '%');
    r += pRow('Tahrikli Teker Sayisi (n_d)', stl.n_d);
  }
  r += '\n';

  // 8. TORK GEREKSINIMI — Ön ve Arka yan yana
  var trq = obs.torqueAnalysis;

  if(obs.geometryFail) {
    r += '  *** GEOMETRIK GECERLILIK BASARISIZ ***\n\n';
    r += '  Sebep: ' + ascii(obs.geometryFailReason) + '\n\n';
    r += '  Hesaplama bu noktada durduruldu.\n';
  } else if(trq) {
    r += ln('=', W) + '\n';
    r += pad('5. TORK GEREKSINIMI ANALIZI (Statik)', W, 'center') + '\n';
    r += ln('=', W) + '\n\n';
    r += '  W = ' + num(inp.mass, 0) + ' kg x 9.81 = ' + num(trq.W, 0) + ' N\n';
    r += '  x = sqrt(2*R*h - h^2) = ' + num(geo.x, 4) + ' m\n\n';

    // Yan yana tablo
    var colW = 36;
    r += '  ' + pad('ON TEKER ENGELDE', colW) + 'ARKA TEKER ENGELDE\n';
    r += '  ' + ln('-', colW) + ln('-', colW) + '\n';
    r += '  ' + pad('D = L + x = ' + num(trq.D_front, 4) + ' m', colW);
    if(trq.D_rear > 0) {
      r += 'D = L - x = ' + num(trq.D_rear, 4) + ' m\n';
    } else {
      r += '*** L-x <= 0 ***\n';
    }
    r += '  ' + pad('N_f = W*a2/D = ' + num(trq.N_f, 0) + ' N', colW);
    if(trq.D_rear > 0) {
      r += 'N_r = W*a1/D = ' + num(trq.N_r, 0) + ' N\n';
    } else {
      r += '\n';
    }
    r += '  ' + pad('N_f1 = N_f/2 = ' + num(trq.N_f1, 0) + ' N', colW);
    if(trq.D_rear > 0) {
      r += 'N_r1 = N_r/2 = ' + num(trq.N_r1, 0) + ' N\n';
    } else {
      r += '\n';
    }
    r += '  ' + ln('-', colW) + ln('-', colW) + '\n';
    r += '  ' + pad('T_req_on = ' + num(trq.T_req_front, 1) + ' Nm', colW);
    if(isFinite(trq.T_req_rear)) {
      r += 'T_req_arka = ' + num(trq.T_req_rear, 1) + ' Nm\n';
    } else {
      r += 'Hesaplanamadi\n';
    }
    r += '\n';
    r += '  Kritik senaryo: ' + ascii(trq.criticalScenario) + ' (' + num(trq.T_req_critical, 1) + ' Nm)\n';
    if(isFinite(trq.T_req_rear) && trq.T_req_front > 0) {
      var ratio = trq.T_req_rear / trq.T_req_front;
      r += '  Arka/On oran: ' + num(ratio, 2) + 'x\n';
    }
    r += '\n';
  }
  r += '\n';

  // ════════════════════════════════════════════════════════════════════════
  // 6. DİNAMİK SİMÜLASYON SONUÇLARI
  // ════════════════════════════════════════════════════════════════════════
  var dyn = sim.obstacleDynamic;
  if(dyn) {
    r += '\n' + ln('=', W) + '\n';
    r += pad('6. DINAMIK SIMULASYON SONUCLARI', W, 'center') + '\n';
    r += ln('=', W) + '\n\n';
    r += '  ' + pad('Zaman Adimli Engel Atlama Modeli', W - 4, 'center') + '\n\n';

    if(!dyn.success && !dyn.log) {
      r += '  *** ' + ascii(dyn.reason) + ' ***\n\n';
    } else {

      // ┌─────────────────────────────────────────────┐
      //  SIMULASYON PARAMETRELERI
      // └─────────────────────────────────────────────┘
      r += '  +' + ln('-', 64) + '+\n';
      r += '  |' + pad(' SIMULASYON PARAMETRELERI', 64) + '|\n';
      r += '  +' + ln('-', 64) + '+\n';
      r += pRow('Zaman Adimi (dt)', num(dyn.dt * 1000, 1) + ' ms');
      r += pRow('Surucu Talebi (DD)', '%100 sabit (tam gaz)');
      r += pRow('Yuvarlanma Direnci (Cr)', num(dyn.params.Cr, 4));
      r += pRow('Motor Ataleti (J_engine)', num(dyn.params.J_engine, 4) + ' kg.m2  (' + (dyn.params.J_engine_source || 'varsayilan') + ')');
      r += pRow('TC Pump Ataleti (J_tc)', num(dyn.params.J_tc, 2) + ' kg.m2');
      r += pRow('TC Sivi Ataleti (J_fluid)', num(dyn.params.J_fluid, 2) + ' kg.m2');
      r += pRow('J_eff (toplam)', num(dyn.params.J_engine + dyn.params.J_tc + dyn.params.J_fluid, 2) + ' kg.m2  [J_engine + J_tc + J_fluid]');
      r += pRow('Baslangic Acisi (phi_start)', num(dyn.params.phi_start_deg, 2) + ' derece');
      r += pRow('Arka Teker Baslangic', 'v=0 (momentum tasinmaz, durustan baslar)');
      if(dyn.params.gbTorqueLimit && dyn.params.gbTorqueLimit > 0) {
        r += pRow('Sanziman Cikis Tork Limiti', num(dyn.params.gbTorqueLimit, 0) + ' Nm');
        if(dyn.params.motorTorquePct && dyn.params.motorTorquePct < 1.0) {
          r += pRow('Motor Tork Yuzdesi', '%' + num(dyn.params.motorTorquePct * 100, 1) + '  (T_gb limitinden hesaplandi)');
        }
      }
      r += '\n';

      // ┌─────────────────────────────────────────────┐
      //  GENEL SONUC BANNER
      // └─────────────────────────────────────────────┘
      r += '  +' + ln('=', 64) + '+\n';
      if(dyn.success) {
        r += '  |' + pad('>>> BASARILI — ENGEL ASILDI <<<', 64, 'center') + '|\n';
      } else {
        r += '  |' + pad('>>> BASARISIZ — ENGEL ASILAMADI <<<', 64, 'center') + '|\n';
      }
      r += '  |' + pad('Toplam Sure: ' + num(dyn.totalTime, 3) + ' s  |  Adim Sayisi: ' + dyn.totalSteps, 64, 'center') + '|\n';
      r += '  +' + ln('=', 64) + '+\n';
      if(!dyn.success) {
        r += '  Sebep: ' + ascii(dyn.reason) + '\n';
      }
      r += '\n';

      // ┌─────────────────────────────────────────────┐
      //  ZAMAN SERISI VERILERI — her transfer kademesi icin ayri tablo
      // └─────────────────────────────────────────────┘
      var _transferRuns = sim.obstacleByTransfer;
      if(!_transferRuns || _transferRuns.length === 0) {
        // Geriye donuk: tek kademe (mevcut dyn/obs)
        _transferRuns = [{
          kademe: (dyn.stallAnalysis && dyn.stallAnalysis.transferName) || (obs.stallAnalysis && obs.stallAnalysis.transferName) || 'Varsayilan',
          ratio: (obs.stallAnalysis && obs.stallAnalysis.i_transfer) || null,
          obstacleDynamic: dyn,
          obstacleCrossing: obs
        }];
      }

      for(var _tri = 0; _tri < _transferRuns.length; _tri++) {
        var _trRun = _transferRuns[_tri];
        var _trDyn = _trRun.obstacleDynamic;
        if(!_trDyn || !_trDyn.log || _trDyn.log.length === 0) continue;
        var _trObs = _trRun.obstacleCrossing || obs;
        var _trInp = (_trObs && _trObs.inputParams) || inp;
        var logData = _trDyn.log;
        var ms = _trDyn.milestones || [];

        // Bolum basligi (kademe bilgisiyle)
        r += '  +' + ln('-', 64) + '+\n';
        var _trLbl = ' ZAMAN SERISI VERILERI';
        if(_transferRuns.length > 1 || _trRun.ratio != null) {
          _trLbl += ' -- ' + ascii(_trRun.kademe) + ' KADEME';
          if(_trRun.ratio != null) _trLbl += ' (i_tr=' + num(_trRun.ratio, 3) + ')';
        }
        r += '  |' + pad(_trLbl, 64) + '|\n';
        r += '  +' + ln('-', 64) + '+\n\n';

        // Mini sonuc banner — birden fazla kademe varken her birinin durumu
        if(_transferRuns.length > 1) {
          var _miniLbl = _trDyn.success
            ? '>>> BASARILI: Engel asildi'
            : '>>> BASARISIZ: Engel asilamadi';
          r += '  ' + pad(_miniLbl + '  |  Sure: ' + num(_trDyn.totalTime, 3) + ' s  |  Adim: ' + _trDyn.totalSteps, 64, 'center') + '\n';
          if(!_trDyn.success && _trDyn.reason) {
            r += '  ' + pad('Sebep: ' + ascii(_trDyn.reason), 64, 'center') + '\n';
          }
          r += '\n';
        }

        // Milestone'lari log satirlariyla eslestir
        var msForRow = {};  // logIndex → [milestone, ...]
        if(ms.length > 0) {
          for(var msi = 0; msi < ms.length; msi++) {
            var msTime = ms[msi].t;
            var bestIdx = 0;
            var bestDiff = Infinity;
            for(var si = 0; si < logData.length; si++) {
              var diff = Math.abs(logData[si].t - msTime);
              if(diff < bestDiff) { bestDiff = diff; bestIdx = si; }
            }
            if(!msForRow[bestIdx]) msForRow[bestIdx] = [];
            msForRow[bestIdx].push(ms[msi]);
          }
        }

        // Kolon tanimlari
        var hasGbLimit = _trDyn.params && _trDyn.params.gbTorqueLimit && _trDyn.params.gbTorqueLimit > 0;
        var cols = [
          { h: 't(s)',     w: 7 },
          { h: 'v(km/h)',  w: 8 },
          { h: 'N_eng',    w: 7 },
          { h: 'T_eng',    w: 7 },
          { h: 'TR',       w: 6 },
          { h: 'SR',       w: 6 },
          { h: 'T_gb',     w: 8 },
          { h: 'T_whl',    w: 8 },
          { h: 'T_whl_e',  w: 8 },
          { h: 'T_req',    w: 8 },
          { h: 'phi(d)',   w: 8 },
          { h: 'F_net',    w: 9 },
          { h: 'KE(J)',    w: 9 }
        ];

        // Baslik satirlari
        var hdr = '  ';
        for(var ci = 0; ci < cols.length; ci++) {
          hdr += pad(cols[ci].h, cols[ci].w, 'right') + ' ';
        }
        r += hdr + '\n';
        r += '  ' + ln('=', hdr.length - 2) + '\n';

        // Veri satirlari
        var prevPhase = '';
        for(var li = 0; li < logData.length; li++) {
          var d = logData[li];

          // Faz degisim ayraci
          if(d.phase !== prevPhase && prevPhase !== '') {
            r += '  ' + ln('.', hdr.length - 2) + '\n';
            r += '  ' + pad('>>> FAZ GECISI: ' + (d.phase === 'rear' ? 'ON TEKER -> ARKA TEKER' : 'ARKA TEKER TAMAMLANDI') + ' <<<', hdr.length - 2, 'center') + '\n';
            r += '  ' + ln('.', hdr.length - 2) + '\n';
          }
          prevPhase = d.phase;

          // Milestone annotation
          var rowMilestones = msForRow[li] || [];
          for(var rmi = 0; rmi < rowMilestones.length; rmi++) {
            var matchedMs = rowMilestones[rmi];
            var mLbl = '>>> ' + ascii(matchedMs.label);
            var mDet = [];
            if(matchedMs.T_wheel !== undefined && matchedMs.T_req !== undefined) {
              mDet.push('T_whl=' + num(matchedMs.T_wheel, 0) + ' Nm');
              mDet.push('T_req=' + (isFinite(matchedMs.T_req) ? num(matchedMs.T_req, 0) : '---') + ' Nm');
            }
            if(matchedMs.v !== undefined) {
              mDet.push('v=' + num(matchedMs.v * 3.6, 2) + ' km/h');
            }
            if(matchedMs.N_engine !== undefined) {
              mDet.push('N=' + num(matchedMs.N_engine, 0) + ' RPM');
            }
            if(matchedMs.KE !== undefined && matchedMs.KE > 0) {
              mDet.push('KE=' + num(matchedMs.KE, 0) + ' J');
            }
            if(matchedMs.margin_pct !== undefined) {
              mDet.push('marj=' + (matchedMs.margin_pct >= 0 ? '+' : '') + num(matchedMs.margin_pct, 1) + '%');
            }
            if(matchedMs.duration !== undefined) {
              mDet.push('sure=' + num(matchedMs.duration, 3) + ' s');
            }
            if(matchedMs.T_gb_out !== undefined) {
              mDet.push('T_gb=' + num(matchedMs.T_gb_out, 0) + ' Nm');
            }
            r += '  ' + ln('-', hdr.length - 2) + '\n';
            r += '  ' + mLbl + '\n';
            if(mDet.length > 0) {
              r += '  ' + pad('', 4) + mDet.join('  |  ') + '\n';
            }
            r += '  ' + ln('-', hdr.length - 2) + '\n';
          }

          // Veri satiri
          var row = '  ';
          row += pad(num(d.t, 3), 7, 'right') + ' ';
          row += pad(num(d.v * 3.6, 2), 8, 'right') + ' ';
          row += pad(num(d.N_engine, 0), 7, 'right') + ' ';
          row += pad(num(d.T_engine, 0), 7, 'right') + ' ';
          row += pad(num(d.TR, 3), 6, 'right') + ' ';
          row += pad(num(d.SR, 3), 6, 'right') + ' ';
          var gbStr = num(d.T_gb_out, 0);
          if(d.T_gb_lim) gbStr += '*';
          row += pad(gbStr, 8, 'right') + ' ';
          row += pad(num(d.T_wheel, 0), 8, 'right') + ' ';
          // T_whl_eff(φ) = T_whl × [1 + (R_corner / R_eff) × cos(φ)]
          var phi_rad = (d.phi_deg || 0) * Math.PI / 180;
          var R_c = (_trObs.cornerCorrection && _trObs.cornerCorrection.R_corner > 0) ? _trObs.cornerCorrection.R_corner : _trInp.R_eff;
          var T_whl_eff = d.T_wheel * (1 + (R_c / (_trInp.R_eff || 1)) * Math.cos(phi_rad));
          row += pad(num(T_whl_eff, 0), 8, 'right') + ' ';
          row += pad(isFinite(d.T_req) ? num(d.T_req, 0) : '---', 8, 'right') + ' ';
          row += pad(num(d.phi_deg, 2), 8, 'right') + ' ';
          row += pad(num(d.F_net, 0), 9, 'right') + ' ';
          row += pad(num(d.KE, 0), 9, 'right') + ' ';
          r += row + '\n';
        }
        r += '  ' + ln('=', hdr.length - 2) + '\n';
        r += '\n';
        var logMs = (_trDyn.params && _trDyn.params.logIntervalSec) ? _trDyn.params.logIntervalSec * 1000 : 10;
        r += '  Toplam ' + logData.length + ' kayit, ~' + num(_trDyn.totalTime, 2) + ' s surec.\n';
        r += '  (Veriler ' + num(logMs, 0) + ' ms aralikla kaydedilmistir. ">>>" ile baslayan satirlar onemli olaylari gosterir.)\n';
        r += '\n';

        // Kolon aciklamalari
        r += '  Kolon Aciklamalari:\n';
        r += '    t(s)     = Simulasyon zamani (saniye)\n';
        r += '    v(km/h)  = Arac hizi (kilometre/saat)\n';
        r += '    N_eng    = Motor devri (RPM)\n';
        r += '    T_eng    = Motor torku (Nm)\n';
        r += '    TR       = Tork konvertor tork orani\n';
        r += '    SR       = Tork konvertor hiz orani (N_turbin/N_motor)\n';
        r += '    T_gb     = Sanziman cikis torku (Nm)' + (hasGbLimit ? '  (* = motor tork yuzdesi %' + num(((_trDyn.params && _trDyn.params.motorTorquePct) || 1) * 100, 1) + ' uygulanmis)' : '') + '\n';
        r += '    T_whl    = Tek teker torku (Nm)\n';
        r += '    T_whl_e  = Efektif tek teker torku (Nm) = T_whl x [1 + (R_corner/R_eff) x cos(phi)]\n';
        r += '    T_req    = Anlik gerekli tork — tek teker (Nm)\n';
        r += '    phi(d)   = Acisal konum (derece, +: tirmanis, 0: tepe, -: inis)\n';
        r += '    F_net    = Net kuvvet (N) = F_itme - F_engel - F_yuvarlanma\n';
        r += '    KE(J)    = Kinetik enerji (Joule) = 0.5 x m x v2\n';
        r += '    >>>      = Onemli olay (milestone)\n';
        r += '\n';
      }
    }
  }

  // ── PARAMETRIK ÇALIŞMA: YÜK TRANSFERİ ANALİZİ ──
  var _pDec = obs ? obs.decision : null;
  var _pCc = obs ? obs.cornerCorrection : null;
  var _pFinalDec = _pCc ? _pCc.decision : _pDec;
  var _pTrq = obs ? obs.torqueAnalysis : null;
  var _pStl = obs ? obs.stallAnalysis : null;

  var _loadTransferEnabled = inp.loadTransferAnalysis || false;
  var _dynResult = sim.obstacleDynamic;
  var _dynSuccess = _dynResult && _dynResult.success;
  if(_loadTransferEnabled && _pFinalDec && _pTrq && _pStl && _pStl.hasData && isFinite(_pFinalDec.T_req_rear)) {
    // Geçti/geçmedi kararı: dinamik sonuç varsa onu kullan
    var onGecti = _pFinalDec.frontPass;
    var arkaGecti = _pFinalDec.rearPass;
    if(_dynResult) {
      onGecti = onGecti || (_dynResult.frontCompleted || false);
      arkaGecti = arkaGecti || _dynSuccess;
    }
    var tekTarafGecti = (onGecti && !arkaGecti) || (!onGecti && arkaGecti);

    if(tekTarafGecti) {
      r += '\n';
      r += ln('=', W) + '\n';
      r += pad('7. PARAMETRIK CALISMA: YUK TRANSFERI ANALIZI', W, 'center') + '\n';
      r += ln('=', W) + '\n\n';

      if(onGecti && !arkaGecti) {
        r += '  Mevcut durumda on teker engeli asiyor ancak arka teker asamiyor.\n';
      } else {
        r += '  Mevcut durumda arka teker engeli asiyor ancak on teker asamiyor.\n';
      }
      r += '  Agirlik merkezi kaydirarak her iki tekerin de engeli asabilecegi\n';
      r += '  kosullar arastirilmaktadir.\n\n';

      // Geometri ve parametreler
      var _pGeo = _pCc ? _pCc.geometry : geo;
      var _pR = _pCc ? _pCc.R_corner : inp.R_eff;
      var _px = _pGeo.x;
      var _pL = inp.wheelbase;
      var _pW = inp.mass * 9.81;
      var _pA1 = inp.a1;
      var _pA2 = inp.a2;
      var _pMass = inp.mass;

      // Dinamik simülasyondan T_wheel peak al (en yüksek teker torku)
      var _pTwPeak = _pFinalDec.T_wheel;
      if(_dynResult && _dynResult.frontStats && _dynResult.rearStats) {
        _pTwPeak = Math.max(_dynResult.frontStats.peakTwheel || 0, _dynResult.rearStats.peakTwheel || 0);
        if(_pTwPeak <= 0) _pTwPeak = _pFinalDec.T_wheel;
      }

      // n_eff başlangıç açısında (en kötü durum)
      var _phi_start = Math.asin(_px / _pR);
      var _cos_phi_start = Math.cos(_phi_start);
      var _n_eff_start = 1 + (_pR / (inp.R_eff || _pR)) * _cos_phi_start;
      var _pTwEff = _pTwPeak * _n_eff_start;

      // ── MEVCUT DURUM ──
      r += '  +' + ln('-', 64) + '+\n';
      r += '  |' + pad(' MEVCUT DURUM', 64) + '|\n';
      r += '  +' + ln('-', 64) + '+\n';
      r += pRow('a1 (AG merkezi-On aks)', num(_pA1, 3) + ' m');
      r += pRow('a2 (AG merkezi-Arka aks)', num(_pA2, 3) + ' m');
      r += pRow('T_wheel (pik, dinamik)', num(_pTwPeak, 0) + ' Nm');
      r += pRow('T_wheel_eff (n_eff x T_whl)', num(_pTwEff, 0) + ' Nm  (n_eff/2 = ' + num(_n_eff_start, 3) + ')');
      var _pTrOn = _pW * _pA2 * _px / (2 * (_pL + _px));
      var _pTrArka = _pW * _pA1 * _px / (2 * (_pL - _px));
      var _pMarjOn = _pTrOn > 0 ? ((_pTwEff - _pTrOn) / _pTrOn * 100) : 0;
      var _pMarjArka = _pTrArka > 0 ? ((_pTwEff - _pTrArka) / _pTrArka * 100) : 0;
      r += pRow('T_req_on', num(_pTrOn, 0) + ' Nm  (marj: ' + (_pMarjOn >= 0 ? '+' : '') + num(_pMarjOn, 1) + '%)' + (_pMarjOn < 0 ? '  <- YETERSIZ' : ''));
      r += pRow('T_req_arka', num(_pTrArka, 0) + ' Nm  (marj: ' + (_pMarjArka >= 0 ? '+' : '') + num(_pMarjArka, 1) + '%)' + (_pMarjArka < 0 ? '  <- YETERSIZ' : ''));
      r += '\n';

      // ── AG MERKEZİ TARAMASI ──
      r += '  +' + ln('-', 64) + '+\n';
      r += '  |' + pad(' AGIRLIK MERKEZI TARAMASI', 64) + '|\n';
      r += '  +' + ln('-', 64) + '+\n\n';

      // Tablo başlığı
      r += '  ' + pad('a1(m)', 8) + pad('a2(m)', 8);
      r += pad('T_req_on', 10) + pad('T_req_ar', 10);
      r += pad('On', 8) + pad('Arka', 8) + 'Durum\n';
      r += '  ' + ln('-', 60) + '\n';

      // a₂'yi 0.025m adımlarla tara
      var _pOptA2 = null, _pOptMarjMin = -Infinity;
      var _pMinPassA2 = null;
      var _pMaxPassA2 = null;

      var _a2min = Math.max(0.1, _pA2 - 0.5);
      var _a2max = Math.min(_pL - 0.1, _pA2 + 0.5);

      for(var _a2s = _a2min; _a2s <= _a2max + 0.001; _a2s += 0.025) {
        var _a2n = Math.round(_a2s * 1000) / 1000;
        var _a1n = Math.round((_pL - _a2n) * 1000) / 1000;
        if(_a1n <= 0 || _a2n <= 0) continue;

        var _trOn = _pW * _a2n * _px / (2 * (_pL + _px));
        var _trArka = _pW * _a1n * _px / (2 * (_pL - _px));
        var _onOk = _pTwEff >= _trOn;
        var _arkaOk = isFinite(_trArka) && _pTwEff >= _trArka;
        var _durum = (_onOk && _arkaOk) ? 'OK' : '-';
        var _etiket = '';
        if(Math.abs(_a2n - _pA2) < 0.005) _etiket = '  [mevcut]';

        if(_onOk && _arkaOk) {
          var _mOn = (_pTwEff - _trOn) / _trOn * 100;
          var _mArka = (_pTwEff - _trArka) / _trArka * 100;
          var _minM = Math.min(_mOn, _mArka);
          if(_minM > _pOptMarjMin) { _pOptMarjMin = _minM; _pOptA2 = _a2n; }
          if(_pMinPassA2 === null) _pMinPassA2 = _a2n;
          _pMaxPassA2 = _a2n;
        }

        r += '  ' + pad(num(_a1n, 3), 8) + pad(num(_a2n, 3), 8);
        r += pad(num(_trOn, 0), 10) + pad(num(_trArka, 0), 10);
        r += pad(_onOk ? 'ASAR' : 'ASAMAZ', 8) + pad(_arkaOk ? 'ASAR' : 'ASAMAZ', 8);
        r += _durum + _etiket + '\n';
      }
      r += '\n';

      // ── SONUÇ ──
      r += '  +' + ln('-', 64) + '+\n';
      r += '  |' + pad(' SONUC', 64) + '|\n';
      r += '  +' + ln('-', 64) + '+\n';

      if(_pMinPassA2 !== null) {
        var _deltaA2min = _pMinPassA2 - _pA2;
        var _yonMin = _deltaA2min > 0 ? 'one' : 'arkaya';
        r += '  Her iki tekerin de asmasi icin:\n';
        r += '    a2 en az ' + num(_pMinPassA2, 3) + ' m olmali (Da2 = ' + (_deltaA2min >= 0 ? '+' : '') + num(_deltaA2min, 3) + ' m ' + _yonMin + ')\n';

        if(_pOptA2 !== null) {
          var _a1opt = _pL - _pOptA2;
          var _trOnOpt = _pW * _pOptA2 * _px / (2 * (_pL + _px));
          var _trArkaOpt = _pW * _a1opt * _px / (2 * (_pL - _px));
          var _mOnOpt = (_pTwEff - _trOnOpt) / _trOnOpt * 100;
          var _mArkaOpt = (_pTwEff - _trArkaOpt) / _trArkaOpt * 100;
          r += '    Optimum: a1=' + num(_a1opt, 3) + ', a2=' + num(_pOptA2, 3) + ' (On: +' + num(_mOnOpt, 1) + '%, Arka: +' + num(_mArkaOpt, 1) + '%)\n';
        }
        r += '\n';

        // ── YÜK YAKINSAMASI ──
        // Hedef Δa₂'ye ulaşmak için: P × d = m_total × Δa₂
        var _deltaA2opt = (_pOptA2 || _pMinPassA2) - _pA2;
        var _momentOpt = Math.abs(_pMass * _deltaA2opt);
        var _yonOpt = _deltaA2opt > 0 ? 'one' : 'arkaya';

        if(_momentOpt > 0.1) {
          r += '  +' + ln('-', 64) + '+\n';
          r += '  |' + pad(' YUK YAKINSAMASI', 64) + '|\n';
          r += '  +' + ln('-', 64) + '+\n';
          r += '  AG merkezini ' + num(Math.abs(_deltaA2opt), 3) + ' m ' + _yonOpt + ' kaydirmak icin:\n';
          r += '  Gerekli moment: P x d = ' + num(_momentOpt, 0) + ' kg.m\n';
          r += '  Dingil mesafesi (L): ' + num(_pL, 3) + ' m\n\n';

          // Mesafe-yük tablosu
          r += '    ' + pad('Mesafe (m)', 14) + pad('Min. Yuk (kg)', 16) + pad('Yon', 10) + '\n';
          r += '    ' + ln('-', 40) + '\n';
          for(var _mStep = 0.5; _mStep <= _pL + 0.01; _mStep += 0.5) {
            var _d = Math.min(Math.round(_mStep * 100) / 100, _pL);
            var _minP = Math.ceil(_momentOpt / _d);
            var _sinir = (Math.abs(_d - _pL) < 0.01) ? '  (L)' : '';
            r += '    ' + pad(num(_d, 2), 14) + pad(_minP.toString(), 16) + pad(_yonOpt, 10) + _sinir + '\n';
            if(Math.abs(_d - _pL) < 0.01) break;
          }
          r += '\n';
          r += '  NOT: Tasima mesafesi dingil mesafesini (L=' + num(_pL, 3) + ' m) asmamalidir.\n';
        }
      } else {
        r += '  Agirlik merkezi kaydirarak cozum bulunamadi.\n';
        r += '  Teker torku her iki teker icin de yetersiz.\n';
      }
      r += '\n';
    }
  }

  // ════════════════════════════════════════════════════════════════════════
  // 8. MATEMATIKSEL ALTYAPI — Hesaplama Teorisi ve Formuller
  // ════════════════════════════════════════════════════════════════════════
  r += '\n' + ln('=', W) + '\n';
  r += pad('8. MATEMATIKSEL ALTYAPI', W, 'center') + '\n';
  r += ln('=', W) + '\n\n';
  r += '  Bu bolumde raporun dayandigi fiziksel model ve matematiksel\n';
  r += '  formuller aciklanmaktadir. Her adimda sizin kendi girdileriniz\n';
  r += '  ile somut sayisal ornekler gosterilmistir.\n\n';

  // --- A. GEOMETRIK TEMEL ---
  r += ln('-', W) + '\n';
  r += '  A. GEOMETRIK TEMEL — Teker-Engel Temas Noktasi\n';
  r += ln('-', W) + '\n\n';
  r += '  Dairesel bir tekerin dik engel kosesine temas ettigi anda, teker ile\n';
  r += '  engel arasindaki tek temas noktasi kosenin kendisidir (P noktasi).\n';
  r += '  Teker merkezi (M) ile P arasindaki yatay uzaklik "moment kolu" olup\n';
  r += '  Pisagor bagintisi ile hesaplanir:\n\n';
  r += '      x^2 + (R - h)^2 = R^2    =>    x = sqrt(2*R*h - h*h)\n\n';
  r += '  Merkez-kose acisi:  theta = arccos(x / R)\n';
  r += '  Zorluk kriteri   :  h/R orani  ( <0.50 Kolay, <0.75 Orta, >=0.75 Zor )\n\n';
  if(!obs.geometryFail && geo && isFinite(geo.x)) {
    r += '  Sizin degerleriniz:\n';
    r += '    R_eff = ' + num(inp.R_eff, 3) + ' m,   h = ' + num(inp.h, 3) + ' m\n';
    r += '    x     = sqrt(2 * ' + num(inp.R_eff, 3) + ' * ' + num(inp.h, 3) + ' - '
      + num(inp.h, 3) + '^2) = ' + num(geo.x, 4) + ' m\n';
    r += '    theta = arccos(' + num(geo.x, 4) + ' / ' + num(inp.R_eff, 3) + ') = '
      + num(geo.theta_deg, 2) + ' derece\n';
    r += '    h/R   = ' + num(geo.hR_ratio, 3) + '   =>   Zorluk: '
      + ascii(geo.difficultyLabel) + '\n';
  } else {
    r += '  (Geometrik gecerlilik saglanmadigi icin sayisal ornek gosterilemedi.)\n';
  }
  r += '\n';

  // --- B. STATIK TORK GEREKSINIMI ---
  r += ln('-', W) + '\n';
  r += '  B. STATIK TORK GEREKSINIMI — Moment Dengesi\n';
  r += ln('-', W) + '\n\n';
  r += '  Teker engele dayandigi anda arac, karsi aksin yer temas noktasi\n';
  r += '  etrafinda donmeye direnir. Bu pivot etrafinda moment dengesi\n';
  r += '  kurulursa engele gelen dusey yuk bulunur; buradan tekerin uretmesi\n';
  r += '  gereken cevirme torku cikarilir.\n\n';
  r += '  SENARYO A — On Teker Engelde:\n';
  r += '    Pivot = arka teker temas noktasi\n';
  r += '    Pivot-P yatay uzakligi :  D = L + x\n';
  r += '    On akstaki toplam yuk  :  N_f   = W * a2 / (L + x)\n';
  r += '    Tek tekere dusen yuk   :  N_f1  = N_f / 2\n';
  r += '    Gerekli teker torku    :  T_req_on = N_f1 * x\n\n';
  r += '  SENARYO B — Arka Teker Engelde:\n';
  r += '    Pivot = on teker temas noktasi,  D = L - x\n';
  r += '    N_r = W * a1 / (L - x),  T_req_arka = (N_r / 2) * x\n';
  r += '    L - x <= 0 ise arka senaryo matematiksel olarak cozulemez.\n\n';
  r += '  Simetri nedeniyle genelde |N_r| > |N_f| oldugundan ARKA teker\n';
  r += '  senaryosu kritik (daha yuksek T_req gerektiren) senaryodur.\n\n';
  if(trq && !obs.geometryFail) {
    r += '  Sizin degerleriniz:\n';
    r += '    W = m*g = ' + num(inp.mass, 0) + ' * 9.81 = ' + num(trq.W, 0) + ' N\n';
    r += '    L = a1 + a2 = ' + num(inp.a1, 3) + ' + ' + num(inp.a2, 3) + ' = '
      + num(inp.wheelbase, 3) + ' m,    x = ' + num(geo.x, 4) + ' m\n\n';
    r += '    On teker :  D = ' + num(trq.D_front, 4) + ' m\n';
    r += '                N_f  = ' + num(trq.W, 0) + ' * ' + num(inp.a2, 3) + ' / '
      + num(trq.D_front, 4) + ' = ' + num(trq.N_f, 0) + ' N\n';
    r += '                T_req_on   = ' + num(trq.N_f1, 0) + ' * ' + num(geo.x, 4)
      + ' = ' + num(trq.T_req_front, 1) + ' Nm\n';
    if(isFinite(trq.T_req_rear)) {
      r += '    Arka teker: D = ' + num(trq.D_rear, 4) + ' m\n';
      r += '                N_r  = ' + num(trq.W, 0) + ' * ' + num(inp.a1, 3) + ' / '
        + num(trq.D_rear, 4) + ' = ' + num(trq.N_r, 0) + ' N\n';
      r += '                T_req_arka = ' + num(trq.N_r1, 0) + ' * ' + num(geo.x, 4)
        + ' = ' + num(trq.T_req_rear, 1) + ' Nm\n';
    } else {
      r += '    Arka teker: L - x <= 0, senaryo cozulemedi.\n';
    }
    r += '    Kritik   : ' + ascii(trq.criticalScenario) + ' (T_req = '
      + num(trq.T_req_critical, 1) + ' Nm)\n';
  }
  r += '\n';

  // --- C. MEVCUT TEKER TORKU ---
  r += ln('-', W) + '\n';
  r += '  C. MEVCUT TEKER TORKU — Motor/Konvertor/Aktarma Zinciri\n';
  r += ln('-', W) + '\n\n';
  r += '  Arac durdugunda (v=0, SR=0) motor, tork konvertor pompasina yuk\n';
  r += '  bindirir. Pompa yuku kuadratiktir:\n\n';
  r += '      T_pump(N) = (N / K_pump)^2\n\n';
  r += '  Motor governed devrine ulasamaz; stall denge noktasi:\n\n';
  r += '      T_motor_net(N) - pump_drop = T_pump(N)   =>   N_stall\n\n';
  r += '  Bu denklem 1 RPM adimla taranir (bisection/iteratif olarak cozulur).\n\n';
  r += '  ONEMLI FIZIKSEL AYRIM (SCAAN dogrulamasi):\n';
  r += '    Motor torkunun bir kismi donen kutlelerin ivmelenmesine gider.\n';
  r += '    Akiskan yoluyla turbine aktarilan sadece pompa torkudur:\n\n';
  r += '        T_turbine = T_pump x TR        (T_engine x TR DEGIL!)\n\n';
  r += '    TR: torque ratio (tau), TC karakteristik egrisinden okunur.\n\n';
  r += '  Aktarma zinciri (stall anindaki teker torku):\n\n';
  r += '      T_wheel = T_turbine * i_g * eta_gear\n';
  r += '                         * i_tr  * eta_tr\n';
  r += '                         * i_diff * eta_diff\n';
  r += '                         * eta_propshaft\n';
  r += '                         / n_d\n\n';
  r += '  n_d: tahrikli teker sayisi (transfer+diff kilitli 4x4 => n_d = 4).\n\n';
  if(stl && stl.hasData) {
    r += '  Sizin konfigurasyonunuz (stall):\n';
    r += '    N_stall              = ' + num(stl.N_stall, 0) + ' RPM\n';
    r += '    K_pump(SR=0)         = ' + num(stl.K_pump_stall, 2) + '\n';
    r += '    T_pump               = (' + num(stl.N_stall, 0) + ' / '
      + num(stl.K_pump_stall, 2) + ')^2 = ' + num(stl.T_pump_stall, 1) + ' Nm\n';
    r += '    TR (SR=0)            = ' + num(stl.TR_stall, 3) + '\n';
    r += '    T_turbine            = ' + num(stl.T_pump_stall, 1) + ' * '
      + num(stl.TR_stall, 3) + ' = ' + num(stl.T_pump_stall * stl.TR_stall, 1) + ' Nm\n';
    r += '    i_g (' + ascii(stl.gearName) + ')        = ' + num(stl.gearRatio, 3) + '\n';
    r += '    i_tr (' + ascii(stl.transferName) + ')      = ' + num(stl.i_transfer, 3)
      + '    (eta = ' + num(stl.eta_transfer * 100, 1) + '%)\n';
    r += '    i_diff               = ' + num(stl.i_axle, 3)
      + '    (eta = ' + num(stl.eta_axle * 100, 1) + '%)\n';
    r += '    eta_total            = ' + num(stl.eta_total * 100, 2) + '%\n';
    r += '    n_d                  = ' + stl.n_d + '\n';
    r += '    T_wheel (tek teker)  = ' + num(stl.T_wheel, 1) + ' Nm\n';
  } else {
    r += '  (Motor/TC verisi eksik oldugu icin sayisal ornek gosterilemedi.)\n';
  }
  r += '\n';

  // --- D. DINAMIK SIMULASYON ---
  r += ln('-', W) + '\n';
  r += '  D. DINAMIK SIMULASYON — Zaman Adimli Model\n';
  r += ln('-', W) + '\n\n';
  r += '  Statik analiz "teorik olarak gecer mi?" sorusunu, dinamik sim ise\n';
  r += '  "zaman icinde gercekten gecebilir mi, hizlanma profili nasil?"\n';
  r += '  sorusunu cevaplar. Her dt (tipik 1 ms) adimda su denklemler\n';
  r += '  entegre edilir:\n\n';
  r += '  1) KINEMATIK:\n';
  r += '       v_new   = max(0, v + a*dt)\n';
  r += '       phi_new = phi - (v / R_eff) * dt        (phi: teker-kose acisi)\n\n';
  r += '  2) ANLIK MOMENT KOLU (phi degistikce degisir):\n';
  r += '       moment_kolu = R_eff * sin(phi)\n';
  r += '       T_req(t)    = (N_aks / 2) * moment_kolu\n';
  r += '     phi=phi_start iken moment_kolu=x (statikle ayni), phi=0 tepede\n';
  r += '     moment_kolu=0 ve T_req=0 olur.\n\n';
  r += '  3) EFEKTIF TAHRIKLI TEKER SAYISI n_eff(phi):\n';
  r += '     Engeldeki 2 teker kose etrafinda DOGRUDAN moment uygular.\n';
  r += '     Duz zemindeki 2 teker ise araci yatay iter; bu itme de P kosesi\n';
  r += '     etrafinda moment uretir, moment kolu ~ R*cos(phi):\n\n';
  r += '       n_eff(phi) = 2 * [ 1 + (R_corner / R_flat) * cos(phi) ]\n\n';
  r += '     phi = phi_start (temas)  : cos kucuk, n_eff ~ 2.5\n';
  r += '     phi = 0          (tepe)  : cos = 1, n_eff ~ 4.0\n\n';
  r += '  4) KUVVET DENGESI:\n';
  r += '       F_itme  = T_wheel * n_eff / R_eff\n';
  r += '       F_engel = N_aks * moment_kolu / R_eff\n';
  r += '       F_net   = F_itme - F_engel\n';
  r += '       a       = F_net / m\n';
  r += '     (Yuvarlanma direnci engel kuvveti yaninda ihmal edilir.)\n\n';
  r += '  5) MOTOR DINAMIGI (Newton rotasyonel):\n';
  r += '       T_net   = T_engine(N) - T_pump(N) - pump_drop\n';
  r += '       J_eff   = J_engine + J_tc + J_fluid\n';
  r += '       alpha   = T_net / J_eff\n';
  r += '       N_new   = N + alpha * dt * 60/(2*pi)\n\n';
  r += '     J_fluid ~ 3.0 kg.m2 = TC kabugundaki ATF sivi ataleti,\n';
  r += '     CAN-bus dN/dt olcumleriyle kalibre edilmistir.\n\n';
  r += '  6) FAZ GECISI:\n';
  r += '     phi <= -phi_start olunca on teker engeli asmistir. Arka faz\n';
  r += '     baslar; arka teker engele degdiginde arac duracagi icin v ve\n';
  r += '     motor devri sifirlanir (momentum tasinmaz varsayimi).\n\n';
  r += '  7) STALL TESPITI:\n';
  r += '     v ~ 0 ve DD=%100 ve T_wheel < T_req ve motor dN/dt < 5 RPM/s\n';
  r += '     kosulu 0.5 s boyunca saglanirsa arac "takildi" (stall).\n\n';
  if(dyn && dyn.params) {
    r += '  Sizin dinamik simulasyonunuzda kullanilan degerler:\n';
    r += '    dt       = ' + num(dyn.dt * 1000, 1) + ' ms\n';
    r += '    J_engine = ' + num(dyn.params.J_engine, 3) + ' kg.m2\n';
    r += '    J_tc     = ' + num(dyn.params.J_tc, 3) + ' kg.m2\n';
    r += '    J_fluid  = ' + num(dyn.params.J_fluid, 3) + ' kg.m2\n';
    r += '    J_eff    = ' + num(dyn.params.J_engine + dyn.params.J_tc + dyn.params.J_fluid, 3)
      + ' kg.m2  (toplam)\n';
    r += '    phi_start= ' + num(dyn.params.phi_start_deg, 2) + ' derece\n';
  } else {
    r += '  (Dinamik simulasyon calistirilmadigi icin sayisal ornek yok.)\n';
  }
  r += '\n';

  // --- E. KARAR KRITERI ---
  r += ln('-', W) + '\n';
  r += '  E. KARAR KRITERI\n';
  r += ln('-', W) + '\n\n';
  r += '  Basari kosulu: HER IKI teker de engeli asmalidir.\n\n';
  r += '      On teker gecer   <=>   T_wheel >= T_req_on\n';
  r += '      Arka teker gecer <=>   T_wheel >= T_req_arka\n';
  r += '      Genel basari     <=>   Her iki kosul birden saglanir\n\n';
  r += '  Marj yuzdesi:  marj% = (T_wheel - T_req) / T_req * 100\n';
  r += '      < 0 %     : Yetersiz  (kirmizi)\n';
  r += '      0 - 5 %   : Sinirda   (sari)\n';
  r += '      > 5 %     : Guvenli   (yesil)\n\n';

  // --- F. KAYNAK VE DOGRULAMA ---
  r += ln('-', W) + '\n';
  r += '  F. KAYNAK VE DOGRULAMA\n';
  r += ln('-', W) + '\n\n';
  r += '  - Geometri : Klasik Pisagor analizi (askeri arac literaturu).\n';
  r += '  - TC modeli: T_turbine = T_pump x TR — SCAAN (Allison) dogrulamasi.\n';
  r += '  - Vites verimi (evrensel): eta = 1 - |ln(i_g)|*(0.0175 + 2.93e-6*N),\n';
  r += '    iSCAAN performans modeli ile 7 vites 2 mod dogrulamasi (<=0.1% hata).\n';
  r += '  - J_fluid kalibrasyonu: CAN-bus dN/dt olcumleriyle fit edilmistir.\n';
  r += '  - Tum interpolasyonlar PCHIP (monoton-korumali kubik) spline ile\n';
  r += '    yapilmistir (tork egrisi, K_pump(SR), tau(SR)).\n';
  r += '\n';

  // FERAGAT
  r += ln('-', W) + '\n';
  r += pad('FERAGATNAME', W, 'center') + '\n';
  r += ln('=', W) + '\n\n';
  r += ln('-', W) + '\n';
  r += pad('Bu rapor MFSim Engel Atlama Analizi Programi', W, 'center') + '\n';
  r += pad('ile otomatik olusturulmustur. Hesaplamalar', W, 'center') + '\n';
  r += pad('teorik modellere dayanmaktadir. Gercek test sonuclari ile', W, 'center') + '\n';
  r += pad('dogrulama yapilmasi onerilir.', W, 'center') + '\n';
  r += ln('-', W) + '\n\n';

  r += pad('(c) ' + now.getFullYear() + ' BMC Otomotiv -- Tum Haklari Saklidir', W, 'center') + '\n';

  return r;
}

// ═══════════════════════════════════════════════════════════════
// 3D SCATTER GRAFİK (Plotly.js)
// ═══════════════════════════════════════════════════════════════

function veRender3DScatter(slotIdx) {
  var slot = veResultSlots[slotIdx];
  if(!slot || !slot.sensors || slot.sensors.length < 2) return;

  var container = document.getElementById('ve-3d-container-' + slotIdx);
  var placeholder = document.getElementById('ve-chart-placeholder-' + slotIdx);
  if(!container) return;

  // Plotly yüklü mü kontrol et
  if(typeof Plotly === 'undefined') {
    if(placeholder) {
      placeholder.innerHTML = '<div style="font-size:1.5rem; margin-bottom:6px;">⚠️</div>Plotly.js yüklenemedi.<br>İnternet bağlantınızı kontrol edin.';
      placeholder.style.display = '';
    }
    return;
  }

  var r = window.veSimResults;
  if(!r) return;

  var sensors = slot.sensors;
  var slotDataSource = slot._dataSource || null;

  // Zaman dizisini al (varsayılan Z ekseni veya 2-sensörlü modda Z olarak kullanılır)
  var timeArr = null;
  if(r && r.time) timeArr = r.time;
  if(slotDataSource === 'segmentDrive' && r.segmentDrive && r.segmentDrive.time) timeArr = r.segmentDrive.time;

  // Sensör verilerini topla
  var sensorData = [];
  sensors.forEach(function(s) {
    var sDS = s._dataSource || slotDataSource;
    var data = veGetSensorData(s.id, s.signal, sDS);
    sensorData.push(data);
  });

  // X ve Y ekseni verileri (ilk 2 sensör)
  var xData = sensorData[0];
  var yData = sensorData[1];
  if(!xData || !yData || xData.length === 0 || yData.length === 0) return;

  // Z ekseni: 3. sensör varsa kullan, yoksa zaman dizisi
  var zData = null;
  var zSensor = null;
  if(sensors.length >= 3 && sensorData[2] && sensorData[2].length > 0) {
    zData = sensorData[2];
    zSensor = sensors[2];
  } else if(timeArr) {
    zData = timeArr;
    zSensor = { name: 'Zaman', unit: 's' };
  }
  if(!zData) return;

  var n = Math.min(xData.length, yData.length, zData.length);
  if(n < 2) return;

  // Veriyi sample et (performans için maks 5000 nokta)
  var maxPts = 5000;
  var step = Math.max(1, Math.floor(n / maxPts));
  var xVals = [], yVals = [], zVals = [];
  for(var i = 0; i < n; i += step) {
    var xv = xData[i], yv = yData[i], zv = zData[i];
    if(isFinite(xv) && isFinite(yv) && isFinite(zv)) {
      xVals.push(xv);
      yVals.push(yv);
      zVals.push(zv);
    }
  }

  if(xVals.length < 2) return;
  if(placeholder) placeholder.style.display = 'none';

  // Tema — koyu/açık tespiti arka plan parlaklığından yapılır (tema ID'sine bağlı değil)
  var _bg = getComputedStyle(document.documentElement).getPropertyValue('--bg-primary').trim();
  var _bgM = _bg.match(/#?([0-9a-fA-F]{6})/);
  var isDark = true;
  if (_bgM) {
    var _bgH = _bgM[1];
    isDark = (parseInt(_bgH.substr(0,2),16) + parseInt(_bgH.substr(2,2),16) + parseInt(_bgH.substr(4,2),16)) / 3 < 128;
  }
  var sceneBg = isDark ? 'rgb(26,28,35)' : 'rgb(248,250,252)';
  var gridColor = isDark ? 'rgba(148,163,184,0.12)' : 'rgba(100,116,139,0.12)';
  var lineColor = isDark ? 'rgba(148,163,184,0.25)' : 'rgba(100,116,139,0.25)';
  var textColor = isDark ? '#94a3b8' : '#475569';
  var paperBg = isDark ? 'rgb(22,24,30)' : 'rgb(255,255,255)';

  var xLabel = sensors[0].name + (sensors[0].unit ? ' [' + sensors[0].unit + ']' : '');
  var yLabel = sensors[1].name + (sensors[1].unit ? ' [' + sensors[1].unit + ']' : '');
  var zLabel = zSensor.name + (zSensor.unit ? ' [' + zSensor.unit + ']' : '');

  // Renk skalası: Z değerine göre, profesyonel görünüm
  var colorscale = [
    [0,    '#0ea5e9'],
    [0.2,  '#3b82f6'],
    [0.4,  '#6366f1'],
    [0.6,  '#8b5cf6'],
    [0.8,  '#d946ef'],
    [1,    '#f43e5c']
  ];

  // Ana scatter trace
  var trace = {
    x: xVals, y: yVals, z: zVals,
    mode: 'markers',
    type: 'scatter3d',
    marker: {
      size: 3,
      color: zVals,
      colorscale: colorscale,
      opacity: 0.85,
      line: { width: 0.3, color: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)' },
      colorbar: {
        title: { text: zLabel, font: { size: 10, color: textColor, family: 'system-ui, -apple-system, sans-serif' } },
        thickness: 14,
        len: 0.55,
        y: 0.5,
        tickfont: { size: 9, color: textColor, family: 'system-ui, -apple-system, sans-serif' },
        outlinewidth: 0,
        bgcolor: 'rgba(0,0,0,0)',
        xpad: 8,
        tickformat: '.4~g'
      }
    },
    hovertemplate:
      '<b>%{xaxis.title.text}:</b> %{x:.4~g}<br>' +
      '<b>%{yaxis.title.text}:</b> %{y:.4~g}<br>' +
      '<b>%{zaxis.title.text}:</b> %{z:.4~g}<extra></extra>',
    hoverlabel: {
      bgcolor: isDark ? 'rgba(30,32,40,0.95)' : 'rgba(255,255,255,0.95)',
      bordercolor: isDark ? 'rgba(99,102,241,0.5)' : 'rgba(99,102,241,0.4)',
      font: { size: 11, color: isDark ? '#e2e8f0' : '#1e293b', family: 'system-ui, -apple-system, sans-serif' }
    }
  };

  // XY düzlemine projeksiyon (gölge) trace
  var zMin = Math.min.apply(null, zVals);
  var projTrace = {
    x: xVals, y: yVals,
    z: xVals.map(function() { return zMin; }),
    mode: 'markers',
    type: 'scatter3d',
    marker: {
      size: 1.5,
      color: isDark ? 'rgba(99,102,241,0.10)' : 'rgba(99,102,241,0.08)',
      symbol: 'circle'
    },
    hoverinfo: 'skip',
    showlegend: false
  };

  var axisTemplate = {
    gridcolor: gridColor,
    zerolinecolor: lineColor,
    showbackground: true,
    backgroundcolor: sceneBg,
    showspikes: false,
    tickfont: { size: 9, color: textColor, family: 'system-ui, -apple-system, sans-serif' },
    titlefont: { size: 11, color: textColor, family: 'system-ui, -apple-system, sans-serif' },
    tickformat: '.4~g',
    linecolor: lineColor,
    linewidth: 1
  };

  var layout = {
    scene: {
      xaxis: Object.assign({}, axisTemplate, {
        title: { text: xLabel, font: axisTemplate.titlefont }
      }),
      yaxis: Object.assign({}, axisTemplate, {
        title: { text: yLabel, font: axisTemplate.titlefont }
      }),
      zaxis: Object.assign({}, axisTemplate, {
        title: { text: zLabel, font: axisTemplate.titlefont }
      }),
      bgcolor: sceneBg,
      camera: {
        eye: { x: 1.5, y: 1.5, z: 0.9 },
        center: { x: 0, y: 0, z: -0.08 },
        up: { x: 0, y: 0, z: 1 }
      },
      aspectmode: 'auto'
    },
    paper_bgcolor: paperBg,
    plot_bgcolor: paperBg,
    margin: { l: 0, r: 0, t: 0, b: 0 },
    showlegend: false,
    font: { family: 'system-ui, -apple-system, sans-serif' }
  };

  var config = {
    responsive: true,
    displayModeBar: true,
    modeBarButtonsToRemove: ['toImage', 'sendDataToCloud', 'hoverClosest3d'],
    modeBarStyle: { bgcolor: 'transparent' },
    displaylogo: false
  };

  Plotly.newPlot(container, [trace, projTrace], layout, config);

  // Plotly modebar'ı uygulamanın temasına uyumlu hale getir
  var modeBar = container.querySelector('.modebar');
  if(modeBar) {
    modeBar.style.opacity = '0.5';
    modeBar.style.transition = 'opacity 0.2s';
    container.addEventListener('mouseenter', function() { if(modeBar) modeBar.style.opacity = '0.9'; });
    container.addEventListener('mouseleave', function() { if(modeBar) modeBar.style.opacity = '0.5'; });
  }
}

