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
      ctx.restore();
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
      ctx.restore();
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

  // X ekseni başlığı (canvas üzerinde, altta ortada)
  var xAxisName = (slot.xAxis ? slot.xAxis.name : 'Zaman [s]');
  ctx.fillStyle = 'rgba(160,160,180,0.9)';
  ctx.font = '600 11px -apple-system,system-ui,sans-serif';
  ctx.textAlign = 'center'; ctx.textBaseline = 'top';
  ctx.fillText(xAxisName, margin.left + pw / 2, margin.top + ph + 22);

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
  
  // Eksen kontrol panelini dinamik güncelle
  var axCtrlWrap = document.getElementById('ve-axis-ctrl-' + slotIdx);
  if(axCtrlWrap) {
    var ctrlHTML = '';
    unitGroups.forEach(function(grp, gi) {
      var yLk = slot.yAxisLock || {};
      var label = grp._side === 'left' ? 'Y' : 'Y';
      if(unitGroups.length > 1) label = grp.unit ? ('[' + grp.unit + ']') : ('Y' + (gi + 1));
      ctrlHTML += '<span style="display:inline-flex; align-items:center; gap:2px;' + (gi > 0 ? ' margin-left:4px; padding-left:4px; border-left:1px solid var(--border-color);' : '') + '">';
      ctrlHTML += '<span style="font-weight:600; opacity:0.7; color:' + grp._color + '; font-size:0.55rem; margin-right:1px;">' + label + '</span>';
      ctrlHTML += '<input type="number" id="ve-ymin-ax' + gi + '-' + slotIdx + '" placeholder="Min" value="' + (yLk['min' + gi] !== undefined ? yLk['min' + gi] : '') + '" step="any" style="width:50px; padding:1px 2px; font-size:0.55rem; background:var(--bg-input); color:' + grp._color + '; border:1px solid ' + grp._color + '40; border-radius:2px; text-align:center;" onchange="veSetAxisLock(' + slotIdx + ')">';
      ctrlHTML += '<span style="opacity:0.4;">—</span>';
      ctrlHTML += '<input type="number" id="ve-ymax-ax' + gi + '-' + slotIdx + '" placeholder="Max" value="' + (yLk['max' + gi] !== undefined ? yLk['max' + gi] : '') + '" step="any" style="width:50px; padding:1px 2px; font-size:0.55rem; background:var(--bg-input); color:' + grp._color + '; border:1px solid ' + grp._color + '40; border-radius:2px; text-align:center;" onchange="veSetAxisLock(' + slotIdx + ')">';
      ctrlHTML += '</span>';
    });
    ctrlHTML += '<button onclick="veClearAxisLock(' + slotIdx + ')" title="Otomatik aralığa dön" style="padding:1px 4px; font-size:0.56rem; background:transparent; border:1px solid var(--border-color); border-radius:2px; cursor:pointer; color:var(--text-muted); margin-left:4px;" onmouseover="this.style.color=\'var(--accent-primary)\';this.style.borderColor=\'var(--accent-primary)\'" onmouseout="this.style.color=\'var(--text-muted)\';this.style.borderColor=\'var(--border-color)\'">↺ Oto</button>';
    axCtrlWrap.innerHTML = ctrlHTML;
  }
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
  });

  area.addEventListener('mouseleave', function() {
    if(!isPanning && !panPending) veChartHideTooltip(slotIdx);
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
  
  // Context menüyü engelle (sağ tık = pan)
  area.addEventListener('contextmenu', function(e) {
    e.preventDefault();
  });
  
  // Çift tık: görünümü sıfırla
  area.addEventListener('dblclick', function(e) {
    e.preventDefault();
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
  modal.style.cssText = 'width:360px; background:var(--bg-secondary); border:1px solid var(--border-color); border-radius:6px; overflow:hidden; box-shadow:0 20px 60px rgba(0,0,0,0.6);';
  
  modal.innerHTML = '' +
    '<div style="padding:12px 16px; background:linear-gradient(135deg, #1a365d 0%, #2c5282 100%); display:flex; align-items:center; justify-content:space-between;">' +
      '<span style="font-size:0.88rem; font-weight:700; color:#e2e8f0; display:flex; align-items:center; gap:8px;">📊 BMC Detaylı Hesap Raporu</span>' +
      '<button onclick="veCloseRaporModal()" style="width:26px; height:26px; background:transparent; border:1px solid rgba(255,255,255,0.2); border-radius:3px; color:#e2e8f0; cursor:pointer; font-size:0.9rem;">✕</button>' +
    '</div>' +
    '<div style="padding:16px;">' +
      '<div style="text-align:center; margin-bottom:14px; padding:8px; background:linear-gradient(135deg, #0d1b2a 0%, #1b263b 100%); border-radius:6px; border:1px solid var(--border-color);">' +
        '<div style="font-size:0.85rem; font-weight:700; color:#63b3ed; letter-spacing:2px;">BMC</div>' +
        '<div style="font-size:0.6rem; color:var(--text-muted); margin-top:2px;">Güç Grubu Müdürlüğü — Görsel Editör</div>' +
      '</div>' +
      '<div style="margin-bottom:12px;">' +
        '<label style="color:var(--text-muted); font-size:0.68rem; display:block; margin-bottom:3px;">Raporu Hazırlayan:</label>' +
        '<input type="text" id="ve-rapor-hazirlayan" value="Kerem Aydoğan" placeholder="İsim Soyisim" style="width:100%; padding:6px 8px; font-size:0.72rem; background:var(--bg-input); color:var(--text-primary); border:1px solid var(--border-color); border-radius:4px;">' +
      '</div>' +
      '<hr style="border:none; border-top:1px solid var(--border-color); margin:12px 0;">' +
      '<div id="ve-rapor-zaman-wrap" style="margin-bottom:12px; display:none;">' +
        '<label style="color:var(--text-muted); font-size:0.68rem; display:block; margin-bottom:3px;">Zaman Adımı (Motor Freni CSV):</label>' +
        '<select id="ve-rapor-zaman-adimi" style="width:100%; padding:6px 8px; font-size:0.72rem; background:var(--bg-input); color:var(--text-primary); border:1px solid var(--border-color); border-radius:4px;">' +
          '<option value="0.5" selected>0.5 saniye</option>' +
          '<option value="1.0">1.0 saniye</option>' +
        '</select>' +
      '</div>' +
      '<div style="margin-bottom:14px;">' +
        '<label style="color:var(--text-muted); font-size:0.68rem; display:block; margin-bottom:3px;">Rapor Formatı:</label>' +
        '<select id="ve-rapor-format" onchange="var w=document.getElementById(\'ve-rapor-zaman-wrap\');if(w)w.style.display=this.value===\'csv\'?\'block\':\'none\';" style="width:100%; padding:6px 8px; font-size:0.72rem; background:var(--bg-input); color:var(--text-primary); border:1px solid var(--border-color); border-radius:4px;">' +
          '<option value="txt" selected>TXT (Metin Dosyası — Tam Rapor)</option>' +
          '<option value="csv">CSV (Excel Uyumlu — Sadece Veri)</option>' +
        '</select>' +
      '</div>' +
      '<button onclick="veGenerateReport()" style="width:100%; padding:10px; background:linear-gradient(135deg, #1a365d 0%, #2b6cb0 100%); color:#fff; border:none; border-radius:6px; font-size:0.82rem; font-weight:700; cursor:pointer; display:flex; align-items:center; justify-content:center; gap:6px;">📥 BMC Raporu Oluştur ve İndir</button>' +
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
  var tarih = now.toLocaleDateString('tr-TR');
  var saat = now.toLocaleTimeString('tr-TR');
  var report = '';
  
  var reportParams = {
    tarih: tarih, saat: saat, hazirlayan: hazirlayan,
    mass: mass, r_wheel: r_wheel, i_diff: i_diff, i_transfer: i_transfer,
    i_gear: i_gear, i_torque: i_torque, i_total: i_total,
    delta: delta, aktarmaVerim: aktarmaVerim, mfVerim: mfVerim,
    slopePercent: slopePercent, thetaDeg: thetaDeg,
    Crr: Crr, Cd: Cd, A: A, rho: rho,
    v_start_kmh: v_start_kmh, simSure: simSure,
    vitesAdi: vitesAdi, zamanAdimi: zamanAdimi,
    motorAdi: engineNode ? (engineNode.customName || (componentDefs[engineNode.type] ? componentDefs[engineNode.type].name : '')) : '',
    senaryoAdi: scd.scenarioType === 'partial_throttle' ? 'Kısmi Gaz' : 'Tam Gaz Analizi',
    solverMethod: sd.method || 'euler',
    gearRatios: gearRatios, currentGear: currentGear
  };

  if(format === 'txt') {
    report = veGenerateTXTReport(steps, reportParams);
  } else {
    // CSV format
    report = 'Zaman [s];Hız [km/sa];Motor Devri [d/d];Tork [Nm];F_brake [N];F_roll [N];F_aero [N];F_grade [N];F_net [N];İvme [m/s²];Δv [km/sa];Mesafe [m]\n';
    steps.forEach(function(s) {
      report += s.t.toFixed(2) + ';' + s.v_kmh.toFixed(2) + ';' + s.rpm.toFixed(0) + ';' + s.T_mf.toFixed(0) + ';' +
        s.F_brake.toFixed(0) + ';' + s.F_roll.toFixed(0) + ';' + s.F_aero.toFixed(0) + ';' + s.F_grade.toFixed(0) + ';' +
        s.F_net.toFixed(0) + ';' + s.a.toFixed(4) + ';' + s.dv.toFixed(2) + ';' + s.s.toFixed(1) + '\n';
    });
  }

  var mimeType = format === 'txt' ? 'text/plain;charset=utf-8' : 'text/csv;charset=utf-8';
  var blob = new Blob([report], { type: mimeType });
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url;
  a.download = 'BMC_MotorFreni_VE_Rapor_' + now.getFullYear() + String(now.getMonth()+1).padStart(2,'0') + String(now.getDate()).padStart(2,'0') + '_' + String(now.getHours()).padStart(2,'0') + String(now.getMinutes()).padStart(2,'0') + '.' + format;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  
  veCloseRaporModal();
  showToast('Rapor indirildi (' + steps.length + ' adım)', 'success');
}

function veGenerateTXTReport(steps, p) {
  var W = 80;
  var WW = 120;
  function ln(ch, len) { var s = ''; for(var i = 0; i < len; i++) s += ch; return s; }
  function pad(str, len, align) {
    str = String(str);
    if(align === 'right') { while(str.length < len) str = ' ' + str; return str; }
    if(align === 'center') { var l = Math.floor((len - str.length) / 2); var r = len - str.length - l; var sp = ''; for(var i=0;i<l;i++) sp+=' '; var sp2=''; for(var i=0;i<r;i++) sp2+=' '; return sp + str + sp2; }
    while(str.length < len) str += ' '; return str;
  }
  function num(v, d) { return isFinite(v) ? v.toFixed(d) : '-'; }
  function numI(v) { return isFinite(v) ? Math.round(v).toString() : '-'; }
  
  var r = '';
  
  // ── BMC BAŞLIK ──
  r += '\n' + ln('=', W) + '\n\n';
  r += pad(' ######   ##    ##    ###### ', W, 'center') + '\n';
  r += pad(' ##   ##  ###  ###   ##      ', W, 'center') + '\n';
  r += pad(' ######   ## ## ##   ##      ', W, 'center') + '\n';
  r += pad(' ##   ##  ##    ##   ##      ', W, 'center') + '\n';
  r += pad(' ######   ##    ##    ###### ', W, 'center') + '\n\n';
  r += pad('BMC Otomotiv Sanayi ve Ticaret A.S.', W, 'center') + '\n';
  r += pad('Guc Grubu Mudurlugu', W, 'center') + '\n\n';
  r += ln('=', W) + '\n\n';
  r += pad('+' + ln('-', 45) + '+', W, 'center') + '\n';
  r += pad('|     MOTOR FRENI PERFORMANS HESAP RAPORU     |', W, 'center') + '\n';

  r += pad('+' + ln('-', 45) + '+', W, 'center') + '\n\n';
  
  // ── RAPOR BİLGİLERİ ──
  r += ln('-', W) + '\n  RAPOR BILGILERI\n' + ln('-', W) + '\n';
  r += '  Rapor Tarihi       : ' + p.tarih + '\n';
  r += '  Rapor Saati        : ' + p.saat + '\n';
  r += '  Senaryo Adi        : ' + p.senaryoAdi + '\n';
  r += '  Hesaplama Modu     : MFSim Zamana Bagli Analiz\n';
  r += '  Cozucu Metodu      : ' + (p.solverMethod === 'rk45' ? 'RK4/5 Adaptif' : p.solverMethod === 'rk4' ? 'RK4' : p.solverMethod === 'heun' ? 'Heun' : 'Euler') + '\n';
  r += '  Rapor Zaman Adimi  : ' + p.zamanAdimi + ' sn\n';
  r += '  Rapor No           : BMC-VE-' + new Date().getFullYear() + '-' + String(Math.floor(Math.random() * 9000) + 1000) + '\n';
  r += ln('-', W) + '\n\n';
  
  // ── GİRDİ PARAMETRELERİ ──
  r += ln('-', W) + '\n' + pad('GIRDI PARAMETRELERI', W, 'center') + '\n' + ln('-', W) + '\n\n';
  
  r += 'ARAC OZELLIKLERI\n';
  r += '  Arac Agirligi (m)         : ' + num(p.mass, 0) + ' kg\n';
  r += '  Teker Yaricapi (r)        : ' + num(p.r_wheel, 4) + ' m\n';
  if(p.motorAdi) r += '  Motor / Motor Freni       : ' + p.motorAdi + '\n';
  r += '  Diferansiyel Orani        : ' + num(p.i_diff, 2) + '\n';
  r += '  Transfer Kutusu Orani     : ' + num(p.i_transfer, 2) + '\n';
  r += '  Sanziman Orani            : ' + num(p.i_gear, 2) + '  [' + p.vitesAdi + ']\n';
  r += '  Tork Konvertoru Orani     : ' + num(p.i_torque, 2) + '\n';
  r += '  Toplam Aktarma Orani      : ' + num(p.i_total, 2) + '\n';
  r += '  Doner Kutle Faktoru (d)   : ' + num(p.delta, 2) + '\n';
  r += '  Aktarma Verimi (n_tr)     : ' + num(p.aktarmaVerim, 0) + '%\n';
  r += '  Motor Freni Verimi (n_mf) : ' + num(p.mfVerim, 0) + '%\n\n';
  
  r += 'ARAZI OZELLIKLERI\n';
  r += '  Yol Egimi                 : ' + num(p.slopePercent, 1) + ' %\n';
  r += '  Egim Acisi (theta)        : ' + num(p.thetaDeg, 3) + ' derece\n';
  r += '  Yuvarlanma Direnci (Crr)  : ' + num(p.Crr, 4) + '\n';
  r += '  Hava Yogunlugu (rho)      : ' + num(p.rho, 3) + ' kg/m3\n\n';
  
  r += 'AERODINAMIK\n';
  r += '  Suruklenme Katsayisi (Cd) : ' + num(p.Cd, 2) + '\n';
  r += '  Frontal Alan (A)          : ' + num(p.A, 2) + ' m2\n\n';
  r += ln('-', W) + '\n\n';
  
  // ── BAŞLANGIÇ KUVVET ANALİZİ ──
  if(steps.length > 0) {
    var s0 = steps[0];
    r += ln('-', W) + '\n' + pad('BASLANGIC KUVVET ANALIZI (t=0)', W, 'center') + '\n' + ln('-', W) + '\n\n';
    r += 'Baslangic Hizi (v0)         : ' + num(s0.v_kmh, 1) + ' km/sa (' + num(s0.v_kmh / 3.6, 2) + ' m/s)\n';
    r += 'Motor Devri (n0)            : ' + numI(s0.rpm) + ' d/d\n\n';
    
    r += 'KUVVETLER\n';
    r += '  Egim Kuvveti (F_grade)    : +' + numI(s0.F_grade) + ' N  (araci hizlandirir)\n';
    r += '  Yuvarlanma Direnci (F_roll): -' + numI(s0.F_roll) + ' N  (frenleme)\n';
    r += '  Hava Direnci (F_aero)     : -' + numI(s0.F_aero) + ' N  (frenleme)\n';
    r += '  Motor Freni (F_brake)     : -' + numI(s0.F_brake) + ' N  (frenleme)\n';
    r += '  ' + ln('-', 45) + '\n';
    var F_toplam = s0.F_roll + s0.F_aero + s0.F_brake;
    r += '  TOPLAM DIRENC             : ' + numI(F_toplam) + ' N\n';
    r += '  NET KUVVET (F_net)        : ' + (s0.F_net >= 0 ? '+' : '') + numI(s0.F_net) + ' N';
    r += s0.F_net > 0 ? '  (arac hizlaniyor)\n' : (s0.F_net < 0 ? '  (arac yavasliyor)\n' : '  (denge)\n');
    r += '\n';
    
    r += 'MOTOR FRENI DETAYI\n';
    r += '  Motor Freni Torku (T_mf)  : ' + numI(s0.T_mf) + ' Nm @ ' + numI(s0.rpm) + ' d/d\n';
    r += '  Tekerlek Freni Kuvveti    : ' + numI(s0.F_brake) + ' N\n\n';
    
    if(s0.F_grade > 0) {
      var kapasite = (F_toplam / s0.F_grade) * 100;
      r += 'PERFORMANS DEGERLENDIRMESI\n';
      r += '  Motor Freni Kapasitesi    : ' + num(kapasite, 1) + '%\n';
      if(kapasite >= 100) r += '  Durum                     : YETERLI - Motor freni araci kontrol edebilir\n';
      else r += '  Durum                     : YETERSIZ - Arac yavasca hizlanacak\n';
    }
    r += '\n' + ln('-', W) + '\n\n';
  }
  
  // ── ZAMAN ADIMLI TABLO ──
  r += ln('=', WW) + '\n' + pad('ZAMAN ADIMLI DIFERANSIYEL HESAPLAMA', WW, 'center') + '\n' + ln('=', WW) + '\n';
  r += pad('t', 7, 'right') + pad('v', 10, 'right') + pad('n', 9, 'right');
  r += pad('T_mf', 9, 'right') + pad('F_brake', 10, 'right') + pad('F_roll', 9, 'right');
  r += pad('F_aero', 9, 'right') + pad('F_grade', 10, 'right') + pad('F_net', 10, 'right');
  r += pad('a', 9, 'right') + pad('dv', 10, 'right') + pad('s', 9, 'right') + '\n';
  r += pad('[s]', 7, 'right') + pad('[km/sa]', 10, 'right') + pad('[d/d]', 9, 'right');
  r += pad('[Nm]', 9, 'right') + pad('[N]', 10, 'right') + pad('[N]', 9, 'right');
  r += pad('[N]', 9, 'right') + pad('[N]', 10, 'right') + pad('[N]', 10, 'right');
  r += pad('[m/s2]', 9, 'right') + pad('[km/sa]', 10, 'right') + pad('[m]', 9, 'right') + '\n';
  r += ln('-', WW) + '\n';
  
  steps.forEach(function(s) {
    r += pad(num(s.t, 1), 7, 'right');
    r += pad(num(s.v_kmh, 2), 10, 'right');
    r += pad(numI(s.rpm), 9, 'right');
    r += pad(numI(s.T_mf), 9, 'right');
    r += pad('-' + numI(s.F_brake), 10, 'right');
    r += pad('-' + numI(s.F_roll), 9, 'right');
    r += pad('-' + numI(s.F_aero), 9, 'right');
    r += pad('+' + numI(s.F_grade), 10, 'right');
    r += pad((s.F_net >= 0 ? '+' : '') + numI(s.F_net), 10, 'right');
    r += pad((s.a >= 0 ? '+' : '') + num(s.a, 3), 9, 'right');
    r += pad((s.dv >= 0 ? '+' : '') + num(s.dv, 2), 10, 'right');
    r += pad(num(s.s, 1), 9, 'right') + '\n';
  });
  r += ln('=', WW) + '\n\n';
  
  // ── SÜTUN AÇIKLAMALARI ──
  r += 'SUTUN ACIKLAMALARI:\n';
  r += '  t       : Zaman [saniye]\n';
  r += '  v       : Anlik hiz [km/sa]\n';
  r += '  n       : Motor devri [d/d]\n';
  r += '  T_mf    : Motor freni torku [Nm]\n';
  r += '  F_brake : Motor freni kuvveti [N] (negatif = frenleme)\n';
  r += '  F_roll  : Yuvarlanma direnci [N]\n';
  r += '  F_aero  : Hava direnci [N]\n';
  r += '  F_grade : Egim kuvveti [N] (pozitif = yokus asagi ivme)\n';
  r += '  F_net   : Net kuvvet [N]\n';
  r += '  a       : Ivme [m/s2]\n';
  r += '  dv      : Baslangictan hiz farki [km/sa]\n';
  r += '  s       : Toplam kat edilen mesafe [m]\n\n';
  
  // ── SONUÇLAR ──
  if(steps.length > 1) {
    var sL = steps[steps.length - 1];
    var vArr = steps.map(function(s) { return s.v_kmh; });
    var aArr = steps.map(function(s) { return s.a; });
    var rArr = steps.map(function(s) { return s.rpm; });
    var tArr = steps.map(function(s) { return s.T_mf; });
    function avg(arr) { var s=0; for(var i=0;i<arr.length;i++) s+=arr[i]; return arr.length>0?s/arr.length:0; }
    function minV(arr) { var m=Infinity; for(var i=0;i<arr.length;i++) if(arr[i]<m) m=arr[i]; return m; }
    function maxV(arr) { var m=-Infinity; for(var i=0;i<arr.length;i++) if(arr[i]>m) m=arr[i]; return m; }
    
    r += ln('-', W) + '\n' + pad('HESAPLAMA SONUCLARI', W, 'center') + '\n' + ln('-', W) + '\n\n';
    
    r += 'SIMULASYON OZETI\n';
    r += '  Toplam Sure               : ' + num(sL.t, 1) + ' sn\n';
    r += '  Toplam Mesafe             : ' + num(sL.s, 1) + ' m\n';
    r += '  Baslangic Hizi            : ' + num(p.v_start_kmh, 2) + ' km/sa\n';
    r += '  Bitis Hizi                : ' + num(sL.v_kmh, 2) + ' km/sa\n';
    var hizDeg = sL.v_kmh - p.v_start_kmh;
    r += '  Hiz Degisimi              : ' + (hizDeg >= 0 ? '+' : '') + num(hizDeg, 2) + ' km/sa';
    r += hizDeg > 0.5 ? ' (hizlandi)\n' : (hizDeg < -0.5 ? ' (yavasladi)\n' : ' (dengede)\n');
    r += '\n';
    
    r += 'ORTALAMA DEGERLER\n';
    r += '  Ortalama Hiz              : ' + num(avg(vArr), 1) + ' km/sa\n';
    r += '  Ortalama Ivme             : ' + (avg(aArr) >= 0 ? '+' : '') + num(avg(aArr), 4) + ' m/s2\n';
    r += '  Ortalama Motor Devri      : ' + numI(avg(rArr)) + ' d/d\n';
    r += '  Ortalama Motor Freni Torku: ' + numI(avg(tArr)) + ' Nm\n\n';
    
    r += 'MINIMUM / MAKSIMUM\n';
    r += '  Min Hiz                   : ' + num(minV(vArr), 2) + ' km/sa\n';
    r += '  Max Hiz                   : ' + num(maxV(vArr), 2) + ' km/sa\n';
    r += '  Min Motor Devri           : ' + numI(minV(rArr)) + ' d/d\n';
    r += '  Max Motor Devri           : ' + numI(maxV(rArr)) + ' d/d\n\n';
    
    r += 'SONUC DEGERLENDIRMESI\n';
    if(hizDeg > 2) {
      r += '  UYARI: Motor freni bu kosullarda yetersiz kalmaktadir.\n';
      r += '  Arac simulasyon suresince ' + num(hizDeg, 2) + ' km/sa hizlanmistir.\n\n';
      r += '  ONERILER:\n';
      r += '  - Bir alt vitese gecilmesi onerilir\n';
      r += '  - Servis freni destegi gerekebilir\n';
    } else if(hizDeg < -2) {
      r += '  BASARILI: Motor freni etkili bir sekilde calismaktadir.\n';
      r += '  Arac simulasyon suresince ' + num(Math.abs(hizDeg), 2) + ' km/sa yavasmistir.\n';
    } else {
      r += '  DENGE: Arac yaklasik sabit hizda ilerlemektedir.\n';
      r += '  Motor freni egim kuvvetini dengelemektedir.\n';
    }
    r += '\n';
  }
  
  // ── VİTES KARŞILAŞTIRMA ──
  if(p.gearRatios && p.gearRatios.length > 0 && p.slopePercent > 0 && steps.length > 0) {
    r += ln('-', W) + '\n' + pad('VITES BAZLI PERFORMANS KARSILASTIRMASI', W, 'center') + '\n' + ln('-', W) + '\n\n';
    r += pad('Vites', 12) + pad('Oran', 10, 'right') + pad('Kapasite', 12, 'right') + pad('Durum', 16, 'right') + '\n';
    r += ln('-', 50) + '\n';
    
    var g = 9.81;
    var F_gr = p.mass * g * Math.sin(Math.atan(p.slopePercent / 100));
    
    for(var gi = 0; gi < p.gearRatios.length; gi++) {
      var gr = parseFloat(p.gearRatios[gi]) || 0;
      if(gr <= 0) continue;
      var iT = p.i_diff * p.i_transfer * gr * p.i_torque;
      var s0rpm = (p.v_start_kmh / 3.6 / p.r_wheel) * iT * 9.549;
      var s0T = steps[0].T_mf;
      var s0Fb = (s0T * iT * (p.aktarmaVerim / 100) * (p.mfVerim / 100)) / p.r_wheel;
      var s0Fr = p.Crr * p.mass * g;
      var s0Fa = 0.5 * p.rho * p.Cd * p.A * Math.pow(p.v_start_kmh / 3.6, 2);
      var kap = ((s0Fb + s0Fr + s0Fa) / F_gr) * 100;
      var durum = kap >= 120 ? 'Fazlasiyla' : (kap >= 100 ? 'Yeterli' : (kap >= 80 ? 'Sinirda' : 'Yetersiz'));
      var mevcut = (gi + 1) === p.currentGear;
      r += pad((gi + 1) + '. Vites' + (mevcut ? ' *' : ''), 12) + pad(num(gr, 2), 10, 'right') + pad('%' + num(kap, 0), 12, 'right') + pad(durum, 16, 'right') + '\n';
    }
    r += ln('-', 50) + '\n';
    r += '* = Mevcut secili vites\n\n';
  }
  
  // ── FORMÜLLER ──
  r += ln('-', W) + '\n' + pad('HESAPLAMA METODOLOJISI', W, 'center') + '\n' + ln('-', W) + '\n\n';
  r += 'KULLANILAN FORMULLER\n\n';
  r += '1. Egim Kuvveti:       F_grade = m x g x sin(theta)\n';
  r += '2. Yuvarlanma Direnci: F_roll  = Crr x m x g x cos(theta)\n';
  r += '3. Hava Direnci:       F_aero  = 0.5 x rho x Cd x A x v^2\n';
  r += '4. Motor Freni:        T_wheel = T_mf x i_total x n_tr x n_mf\n';
  r += '                       F_brake = T_wheel / r_wheel\n';
  r += '5. Hareket Denklemi:   F_net   = F_grade - F_roll - F_aero - F_brake\n';
  r += '                       a       = F_net / (m x delta)\n\n';
  
  r += 'SAYISAL COZUM PARAMETRELERI\n';
  r += '  Integrasyon Metodu        : ' + (p.solverMethod === 'rk45' ? 'RK4/5 Adaptif' : p.solverMethod === 'rk4' ? 'RK4' : p.solverMethod === 'heun' ? 'Heun' : 'Euler') + '\n';
  r += '  Rapor Zaman Adimi (dt)    : ' + p.zamanAdimi + ' sn\n';
  r += '  Toplam Adim Sayisi        : ' + steps.length + '\n\n';
  
  // ── RAPOR SONU ──
  r += ln('-', W) + '\n' + pad('RAPOR SONU', W, 'center') + '\n' + ln('=', W) + '\n\n';
  r += ln('-', W) + '\n';
  r += pad('BMC OTOMOTIV SANAYI VE TICARET A.S.', W, 'center') + '\n';
  r += pad('GUC GRUBU MUDURLUGU', W, 'center') + '\n';
  r += ln('-', W) + '\n\n';
  r += '  Hazirlayan        : ' + (p.hazirlayan || 'Belirtilmemis') + '\n';
  r += '  Iletisim          : ' + veNameToEmail(p.hazirlayan || '') + '\n\n';
  r += ln('-', W) + '\n';
  r += pad('Bu rapor BMC Motor Freni Performans Hesaplama Programi', W, 'center') + '\n';
  r += pad('ile olusturulmustur. Hesaplamalar teorik modellere dayanmaktadir.', W, 'center') + '\n';
  r += pad('Gercek test sonuclari ile dogrulama yapilmasi onerilir.', W, 'center') + '\n';
  r += ln('-', W) + '\n\n';
  r += pad('(c) ' + new Date().getFullYear() + ' BMC Otomotiv - Tum Haklari Saklidir', W, 'center') + '\n\n';
  
  return r;
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
  r += '\n' + ln('=', W) + '\n\n';
  r += pad(' ######   ##    ##    ###### ', W, 'center') + '\n';
  r += pad(' ##   ##  ###  ###   ##      ', W, 'center') + '\n';
  r += pad(' ######   ## ## ##   ##      ', W, 'center') + '\n';
  r += pad(' ##   ##  ##    ##   ##      ', W, 'center') + '\n';
  r += pad(' ######   ##    ##    ###### ', W, 'center') + '\n\n';
  r += pad('BMC Otomotiv Sanayi ve Ticaret A.S.', W, 'center') + '\n';
  r += pad('Guc Grubu Mudurlugu', W, 'center') + '\n\n';
  r += ln('=', W) + '\n\n';
  r += pad('+' + ln('-', 46) + '+', W, 'center') + '\n';
  r += pad('|   TAM GAZ HIZLANMA PERFORMANS HESAP RAPORU   |', W, 'center') + '\n';
  r += pad('+' + ln('-', 46) + '+', W, 'center') + '\n\n';

  // ── RAPOR BILGILERI ──
  r += ln('-', W) + '\n  RAPOR BILGILERI\n' + ln('-', W) + '\n';
  r += pRow('Rapor Tarihi', tarih);
  r += pRow('Rapor Saati', saat);
  r += pRow('Rapor No', raporNo);
  r += pRow('Hazirlayan', ascii(hazirlayan));
  r += pRow('Hesaplama Modu', 'MFSim Tam Gaz Hizlanma');
  r += pRow('Cozucu Metodu', solverLabel);
  r += pRow('Shift Profili', ascii(shiftProfile));
  r += ln('-', W) + '\n\n';

  // ════════════════════════════════════════════════════════════════════════
  // 1. PLATFORM VE ARAC OZELLIKLERI
  // ════════════════════════════════════════════════════════════════════════
  r += '\n' + ln('=', W) + '\n';
  r += pad('1. PLATFORM VE ARAC OZELLIKLERI', W, 'center') + '\n';
  r += ln('=', W) + '\n\n';

  r += '  ALAN VE AGIRLIK\n';
  r += '  ' + ln('-', 38) + '\n';
  r += pRow('Alin Alani', num(R.frontalArea, 3) + ' m2');
  r += pRow('Yukseklik / Genislik', num(R.height, 3) + ' m / ' + num(R.width, 3) + ' m');
  r += pRow('Aerodinamik Direnc (Cd)', num(R.cd, 3));
  r += pRow('Brut Arac Agirligi (GVW)', numI(R.gvw) + ' kg');
  r += '\n';

  var revPerKm = Math.round(1000 / (2 * Math.PI * R.tireRadius));
  r += '  LASTIKLER\n';
  r += '  ' + ln('-', 38) + '\n';
  r += pRow('Secili Lastik', ascii(R.tireName));
  r += pRow('Lastik Devir/km', revPerKm + ' devir/km');
  r += pRow('Lastik Yuvarlanma Yari.', num(R.tireRadius, 3) + ' m');
  r += pRow('Yuvarlanma Direnci (Crr)', num(R.crr, 4));
  r += pRow('Yuzey Faktoru', num(R.surfFactor || 1.0, 2));
  r += pRow('Lastik/Tekerlek Ataleti', num(R.tireInertia, 4) + ' kg.m2');
  r += '\n\n';

  // ════════════════════════════════════════════════════════════════════════
  // 2. MOTOR
  // ════════════════════════════════════════════════════════════════════════
  r += ln('=', W) + '\n';
  r += pad('2. MOTOR', W, 'center') + '\n';
  r += ln('=', W) + '\n\n';

  r += '  MOTOR OZELLIKLERI\n';
  r += '  ' + ln('-', 38) + '\n';
  r += pRow('Motor Tanimi', ascii(R.engineName));
  r += pRow('Silindir Hacmi', num(R.displacement, 2) + ' L');
  r += pRow('Pik Tork', num(peakTorque, 1) + ' N.m @ ' + numI(peakTorqueRpm) + ' rpm');
  r += pRow('Pik Guc', num(peakPower, 1) + ' kW (' + numI(peakHP) + ' HP) @ ' + numI(peakPowerRpm) + ' rpm');
  r += pRow('Governed Guc', num(govPower, 1) + ' kW @ ' + numI(R.governed) + ' rpm');
  r += pRow('Governed Devir', numI(R.governed) + ' rpm');
  r += pRow('No-Load Governed', numI(R.noLoad) + ' rpm');
  r += pRow('Rolanti Devri', numI(R.idleRpm) + ' rpm');
  r += pRow('Motor Ataleti', num(R.engineInertia, 4) + ' kg.m2');
  r += '\n';

  // Aksesuar kayiplari
  r += '  AKSESUAR KAYIPLARI\n';
  r += '  ' + ln('-', 62) + '\n';
  r += '  ' + pad('Aksesuar', 30) + pad('Standart (kW)', 16, 'right') + pad('Kullanici (kW)', 16, 'right') + '\n';
  r += '  ' + ln('-', 62) + '\n';
  (R.accessories || []).forEach(function(a) {
    r += '  ' + pad(ascii(a.name), 30) + pad(num(a.standardLoss, 1), 16, 'right') + pad(num(a.userLoss, 1), 16, 'right') + '\n';
  });
  r += '  ' + ln('-', 62) + '\n';
  r += '  ' + pad('TOPLAM', 30) + pad(num(accTotalStd, 1), 16, 'right') + pad(num(accTotal, 1), 16, 'right') + '\n';
  r += '  ' + ln('-', 62) + '\n\n';

  // Motor tork/guc tablosu
  r += '  MOTOR TORK / GUC VERISI\n';
  r += '  ' + ln('-', 76) + '\n';
  r += '  ' + pad('Devir', 7, 'right') + pad('Brut Guc', 10, 'right') + pad('Brut Tork', 11, 'right');
  r += pad('Net(FanAcik)', 12, 'right') + pad('Net(FanAcik)', 12, 'right');
  r += pad('Net(FanKpli)', 12, 'right') + pad('Net(FanKpli)', 12, 'right') + '\n';
  r += '  ' + pad('[rpm]', 7, 'right') + pad('[kW]', 10, 'right') + pad('[N.m]', 11, 'right');
  r += pad('Guc [kW]', 12, 'right') + pad('Tork [N.m]', 12, 'right');
  r += pad('Guc [kW]', 12, 'right') + pad('Tork [N.m]', 12, 'right') + '\n';
  r += '  ' + ln('-', 76) + '\n';

  var fanLoss = R.fanLossGov || 0;
  var otherLoss = R.otherLossGov || 0;
  var totalAccLoss = fanLoss + otherLoss;

  (R.torqueData || []).forEach(function(p) {
    var pw = p.power || (p.torque * p.rpm * Math.PI / 30000);
    var netFanOnPower = pw - totalAccLoss;
    var netFanOnTorque = (p.rpm > 0) ? (netFanOnPower * 30000 / (p.rpm * Math.PI)) : 0;
    var netFanOffPower = pw - otherLoss;
    var netFanOffTorque = (p.rpm > 0) ? (netFanOffPower * 30000 / (p.rpm * Math.PI)) : 0;

    var tag = '';
    if (Math.abs(p.rpm - peakTorqueRpm) < 5) tag = '  Pik Tork';
    else if (Math.abs(p.rpm - peakPowerRpm) < 5) tag = '  Pik Guc';
    else if (Math.abs(p.rpm - R.governed) < 5) tag = '  Governed';
    else if (Math.abs(p.rpm - R.noLoad) < 5) tag = '  Yuksuz Gov';

    r += '  ' + pad(numI(p.rpm), 7, 'right');
    r += pad(num(pw, 1), 10, 'right');
    r += pad(num(p.torque, 1), 11, 'right');
    r += pad(num(netFanOnPower, 1), 12, 'right');
    r += pad(num(netFanOnTorque, 1), 12, 'right');
    r += pad(num(netFanOffPower, 1), 12, 'right');
    r += pad(num(netFanOffTorque, 1), 12, 'right');
    r += tag + '\n';
  });
  r += '  ' + ln('-', 76) + '\n\n';

  // Motor yorum
  r += '  YORUM: ' + ascii(R.engineName) + ' motoru, ' + numI(peakTorqueRpm) + ' rpm\'de ' + num(peakTorque, 1) + ' N.m pik tork\n';
  r += '  ve ' + numI(peakPowerRpm) + ' rpm\'de ' + num(peakPower, 1) + ' kW (' + numI(peakHP) + ' HP) pik guc uretmektedir.\n';
  r += '  Governed devirde (' + numI(R.governed) + ' rpm) motor ' + num(govPower, 1) + ' kW guc saglamaktadir.\n\n\n';

  // ════════════════════════════════════════════════════════════════════════
  // 3. SANZIMAN VE KONTROL
  // ════════════════════════════════════════════════════════════════════════
  r += ln('=', W) + '\n';
  r += pad('3. SANZIMAN VE KONTROL', W, 'center') + '\n';
  r += ln('=', W) + '\n\n';

  r += '  SANZIMAN OZELLIKLERI\n';
  r += '  ' + ln('-', 38) + '\n';
  r += pRow('Sanziman Modeli', ascii(R.gbName));
  r += pRow('Sanziman Ailesi', ascii(R.gbFamily));
  r += pRow('Sanziman Verimi', num(R.gbEff, 1) + '%');
  r += pRow('Tork Konvertoru', ascii(R.tcName));
  r += '\n';

  // Vites oranlari
  r += '  VITES ORANLARI\n';
  r += '  ' + ln('-', 34) + '\n';
  r += '  ' + pad('Vites', 8) + pad('Kademe', 14) + pad('Oran', 12, 'right') + '\n';
  r += '  ' + ln('-', 34) + '\n';
  (R.gearData || []).forEach(function(g, i) {
    var gNum = i + 1;
    var kademe = 'Konvertor';
    // Lockup viteslerinde "Lockup" yaz
    if (ss.forwardGears && ss.forwardGears[i] && ss.forwardGears[i].lockup) kademe = 'Lockup';
    r += '  ' + pad(String(gNum), 8) + pad(kademe, 14) + pad(num(g.ratio, 3), 12, 'right') + '\n';
  });
  r += '  ' + ln('-', 34) + '\n\n';

  // Shift kontrol parametreleri
  r += '  SHIFT KONTROL PARAMETRELERI\n';
  r += '  ' + ln('-', 38) + '\n';
  r += pRow('Shift Profili', ascii(shiftProfile));
  r += pRow('Shift Referans RPM', numI(shiftRefRPM) + ' rpm');
  // Converter geçişleri
  if(spDataReport.converterShifts) {
    var csR = spDataReport.converterShifts;
    if(csR['1C2C']) r += pRow('1C->2C', 'N_out >= ' + num(csR['1C2C'].a * shiftRefRPM + (csR['1C2C'].b || 0), 1) + ' (a=' + csR['1C2C'].a + ', b=' + (csR['1C2C'].b || 0) + ')');
    if(csR['2C2L'] && csR['2C2L'].type === 'segmented') {
      r += pRow('2C->2L (ESL>=' + csR['2C2L'].linear.validFrom + ')', 'N_out >= ' + num(csR['2C2L'].linear.a * shiftRefRPM + csR['2C2L'].linear.b, 1) + ' (a=' + csR['2C2L'].linear.a + ', b=' + csR['2C2L'].linear.b + ')');
      if(csR['2C2L'].lookup) r += pRow('2C->2L (lookup)', csR['2C2L'].lookup.map(function(p) { return 'ESL=' + p[0] + ':' + p[1]; }).join(', '));
    }
  }
  // Lockup geçişleri
  if(spDataReport.lockupShifts) {
    r += '  Lockup Gecisleri (N_out = a x ESL + b):\n';
    Object.keys(spDataReport.lockupShifts).forEach(function(sk) {
      var ls = spDataReport.lockupShifts[sk];
      var thr = (typeof calcLockupShiftThreshold === 'function') ? calcLockupShiftThreshold(ls, shiftRefRPM) : (ls.a * shiftRefRPM + (ls.b || 0));
      var label = sk.replace(/(\d+L)(\d+L)/, '$1->$2');
      var detail = '';
      if(ls.type === 'segments') { detail = 'segments'; }
      else if(ls.type === 'piecewise') { detail = 'piecewise'; }
      else { detail = 'a=' + ls.a + ', b=' + ls.b; if(ls.capValue !== undefined) detail += ', cap=' + ls.capValue; else if(ls.minCap !== undefined) detail += ', cap=' + ls.minCap; }
      r += pRow('  ' + label, 'N_out >= ' + numI(thr) + ' rpm (' + detail + ')');
    });
  } else {
    r += pRow('Kilitleme Ofseti', numI(lockupOffset) + ' rpm');
    r += pRow('Kilitleme Gecis RPM', numI(lockupRPM) + ' rpm');
  }
  var lowGear = 1, highGear = (R.gearData || []).length;
  r += pRow('Vites Araligi', 'Dusuk=' + lowGear + ', Basla=' + lowGear + ', Yuksek=' + highGear);
  r += '\n\n';

  // ════════════════════════════════════════════════════════════════════════
  // 4. MOTOR-KONVERTOR ESLESMESI
  // ════════════════════════════════════════════════════════════════════════
  r += ln('=', W) + '\n';
  r += pad('4. MOTOR-KONVERTOR ESLESMESI', W, 'center') + '\n';
  r += ln('=', W) + '\n\n';

  r += '  MOTOR BILGISI\n';
  r += '  ' + ln('-', 38) + '\n';
  r += pRow('Motor', ascii(R.engineName));
  r += pRow('Pik Tork', numI(peakTorque) + ' N.m @ ' + numI(peakTorqueRpm) + ' rpm');
  r += pRow('Governed Devir', numI(R.governed) + ' rpm');
  r += pRow('Pompa Dusumu', num(R.pumpDrop || 17.6, 1) + ' N.m');
  r += pRow('Turbin Limiti', numI(R.turbineRating || 3320) + ' N.m');
  if (_gbLimits.grossInputPower !== null) r += pRow('Giris Guc Limiti', _gbLimits.grossInputPower + ' kW');
  if (_gbLimits.grossInputTorque !== null) r += pRow('Giris Tork Limiti', _gbLimits.grossInputTorque + ' N.m');
  r += pRow('Gov. Guc', numI(_powerAtGov) + ' kW' + (_gbLimits.grossInputPower !== null ? ' (C9: ' + (_c9ok ? 'OK' : 'ASILIYOR') + ')' : ''));
  r += pRow('Gov. Tork', numI(_torqueAtGov) + ' N.m' + (_gbLimits.grossInputTorque !== null ? ' (C10: ' + (_c10ok ? 'OK' : 'ASILIYOR') + ')' : ''));
  r += '\n';

  if (_ecmResults.length > 0) {
    var ecmW = 97;

    if (!_c9ok || !_c10ok) {
      r += '  *** UYARI: SANZIMAN GIRIS LIMITI ASILIYOR ***\n';
      if (!_c9ok) r += '  C9 : Motor gucu (' + numI(_powerAtGov) + ' kW) > Giris guc limiti (' + _gbLimits.grossInputPower + ' kW)\n';
      if (!_c10ok) r += '  C10: Motor torku (' + numI(_torqueAtGov) + ' N.m) > Giris tork limiti (' + _gbLimits.grossInputTorque + ' N.m)\n';
      r += '\n';
    }

    r += '  ECM SONUCLARI\n';
    r += '  ' + ln('-', ecmW) + '\n';
    r += '  ' + pad('Durum', 15) + pad('Konvertor', 18) + pad('Stall t', 9, 'right') + pad('Stall rpm', 11, 'right');
    r += pad('Min N rpm', 11, 'right') + pad('T_turb N.m', 12, 'right') + pad('SR@Gov', 8, 'right');
    r += pad('C5', 5, 'right') + pad('C7', 5, 'right') + pad('C8', 5, 'right') + '\n';
    r += '  ' + ln('-', ecmW) + '\n';

    _ecmResults.forEach(function(ec) {
      var durumStr = ec.status === 'recommended' ? '[ONERILEN]' : ec.status === 'caution' ? '[DIKKAT]' : ec.score === 0 ? '[UYUMSUZ]' : '[ONERILMEZ]';
      r += '  ' + pad(durumStr, 15);
      r += pad(ascii(ec.name), 18);
      r += pad(num(ec.stallTau, 2), 9, 'right');
      r += pad(numI(ec.stallSpeed), 11, 'right');
      r += pad(numI(ec.minSpeed), 11, 'right');
      r += pad(numI(ec.tTurbineStall), 12, 'right');
      r += pad(num(ec.srGov, 3), 8, 'right');
      r += pad(ec.c5ok ? 'OK' : 'NO', 5, 'right');
      r += pad(ec.c7ok ? 'OK' : 'NO', 5, 'right');
      r += pad(ec.c8ok ? 'OK' : (ec.srGov >= 0.75 ? '!!' : 'NO'), 5, 'right');
      r += '\n';
    });
    r += '  ' + ln('-', ecmW) + '\n\n';

    r += '  KRITER ACIKLAMALARI\n';
    r += '  C5 : Minimum pump hizi >= pik tork devri (OK/NO)\n';
    r += '  C7 : Stall\'da turbin torku <= turbin limiti (OK/NO)\n';
    r += '  C8 : Governed\'da hiz orani >= 0.80 (OK/!!)\n';
    if (_gbLimits.grossInputPower !== null) r += '  C9 : Motor gucu@governed <= giris guc limiti (OK/ASILIYOR)\n';
    if (_gbLimits.grossInputTorque !== null) r += '  C10: Motor torku@governed <= giris tork limiti (OK/ASILIYOR)\n';
    r += '\n';

    // Secili TC yorum
    var selTC = _ecmResults.find(function(e) { return e.name === R.tcName; }) || _ecmResults[0];
    if (selTC) {
      var durumTR = selTC.status === 'recommended' ? 'uygun' : selTC.status === 'caution' ? 'dikkatli' : 'uyumsuz';
      r += '  YORUM: ' + ascii(selTC.name) + ' tork konvertoru, ' + ascii(R.engineName) + ' motoru ile ' + durumTR + ' uyum gostermektedir.\n';
      r += '  Durma tork orani t=' + num(selTC.stallTau, 2) + ', governed\'da hiz orani SR=' + num(selTC.srGov, 3) + '.\n\n\n';
    }
  } else {
    r += '  ECM verisi bulunamadi — EC Matching node topolojiye eklenmemis.\n\n\n';
  }

  // ════════════════════════════════════════════════════════════════════════
  // 5. AKTARMA ORGANLARI
  // ════════════════════════════════════════════════════════════════════════
  r += ln('=', W) + '\n';
  r += pad('5. AKTARMA ORGANLARI', W, 'center') + '\n';
  r += ln('=', W) + '\n\n';

  r += '  BILESEN DETAYLARI\n';
  var aktW = 69;
  r += '  ' + ln('-', aktW) + '\n';
  r += '  ' + pad('Bilesen', 28) + pad('Aciklama', 16) + pad('Oran', 11, 'right') + pad('Verim (%)', 14, 'right') + '\n';
  r += '  ' + ln('-', aktW) + '\n';

  // Kardan milleri
  (R.propshafts || []).forEach(function(ps) {
    r += '  ' + pad(ascii(ps.name), 28) + pad('Tek', 16) + pad('1.000', 11, 'right') + pad(num(ps.eff, 2), 14, 'right') + '\n';
  });
  // Aks
  r += '  ' + pad('Aks', 28) + pad('Tek', 16) + pad(num(R.diffRatio, 3), 11, 'right') + pad(num(R.diffEff, 2), 14, 'right') + '\n';
  // Transfer kademeleri
  if (R.transferGears && R.transferGears.length > 0) {
    R.transferGears.forEach(function(tr) {
      var kd = ascii(tr.kademe || 'Standart');
      r += '  ' + pad('Transfer Kutusu', 28) + pad(kd, 16) + pad(num(tr.ratio, 3), 11, 'right') + pad(num(tr.eff, 2), 14, 'right') + '\n';
    });
  }
  r += '  ' + ln('-', aktW) + '\n\n';

  // Toplam aktarma oranlari
  r += '  TOPLAM AKTARMA ORANLARI';
  if (hasTransfer) r += ' (Transfer Kademelerine Gore)';
  r += '\n';
  r += '  ' + ln('-', aktW) + '\n';
  r += '  ' + pad('Kademe', 20) + pad('Oran', 14, 'right') + pad('Verim (%)', 14, 'right') + pad('N/V (rpm/kph)', 21, 'right') + '\n';
  r += '  ' + ln('-', aktW) + '\n';

  function calcDrivelineTotal(trRatio, trEff) {
    var psEff = 1.0;
    (R.propshafts || []).forEach(function(ps) { psEff *= (ps.eff / 100); });
    var ratio = R.diffRatio * trRatio;
    // Şanzıman verimi dahil değil — per-gear tork kaybı modeli ile hesaplanıyor (iSCAAN uyumu)
    var eff = (R.diffEff / 100) * (trEff / 100) * psEff * 100;
    var nv = (ratio * 1000) / (R.tireRadius * 2 * Math.PI * 60);
    return { ratio: ratio, eff: eff, nv: nv };
  }

  if (hasTransfer) {
    var dHigh = calcDrivelineTotal(R.transferGears[0].ratio, R.transferGears[0].eff);
    var dLow = calcDrivelineTotal(R.transferGears[1].ratio, R.transferGears[1].eff);
    r += '  ' + pad('Yuksek Kademe', 20) + pad(num(dHigh.ratio, 3), 14, 'right') + pad(num(dHigh.eff, 2), 14, 'right') + pad(num(dHigh.nv, 3), 21, 'right') + '\n';
    r += '  ' + pad('Dusuk Kademe', 20) + pad(num(dLow.ratio, 3), 14, 'right') + pad(num(dLow.eff, 2), 14, 'right') + pad(num(dLow.nv, 3), 21, 'right') + '\n';
  } else {
    var dSingle = calcDrivelineTotal(trHighRatio, (R.transferGears && R.transferGears[0]) ? R.transferGears[0].eff : 97);
    r += '  ' + pad('Standart', 20) + pad(num(dSingle.ratio, 3), 14, 'right') + pad(num(dSingle.eff, 2), 14, 'right') + pad(num(dSingle.nv, 3), 21, 'right') + '\n';
  }
  r += '  ' + ln('-', aktW) + '\n\n';

  r += '\n\n';

  // ════════════════════════════════════════════════════════════════════════
  // 6. TAM GAZ EGIM KABILIYETI
  // ════════════════════════════════════════════════════════════════════════
  r += ln('=', W) + '\n';
  r += pad('6. TAM GAZ EGIM KABILIYETI', W, 'center') + '\n';
  r += ln('=', W) + '\n\n';

  // Kosullar
  r += '  KOSULLAR\n';
  r += '  ' + ln('-', 38) + '\n';
  r += pRow('Motor Fani', 'Acik');
  r += pRow('Klima', 'Kapali');
  r += pRow('Motor Gucu', 'Standart Guc Egrisi');
  r += pRow('Arac Parametreleri', 'Standart');
  r += pRow('Aks Orani', num(R.diffRatio, 3));
  if (hasTransfer) {
    r += pRow('Transfer Kutusu Orani', num(trHighRatio, 3));
  }
  r += '\n';

  function renderGradeSection(gd) {
    var rg = '';
    if (hasTransfer) {
      rg += '  TRANSFER KUTUSU: ' + ascii(gd.label).toUpperCase() + '\n';
    }
    rg += '  ' + ln('-', 78) + '\n';
    rg += '  ' + pad('Egim Kabiliyeti', 36) + pad('% Egim', 10, 'right');
    rg += pad('Hiz (km/h)', 12, 'right') + pad('Vites', 8, 'right');
    rg += pad('Esleme Nokt.', 14, 'right') + '\n';
    rg += '  ' + ln('-', 78) + '\n';

    // Stall
    rg += '  ' + pad('Durma Egim Kab. (Stall)', 36);
    rg += pad(num(gd.stallGrade, 1), 10, 'right');
    rg += pad('-', 12, 'right') + pad(gd.stallGear, 8, 'right');
    rg += pad('Stall', 14, 'right') + '\n';

    // Launch
    rg += '  ' + pad('Kalkis Egim Kab. (Launch)', 36);
    rg += pad(num(gd.launchGrade, 1), 10, 'right');
    rg += pad('-', 12, 'right') + pad(gd.launchGear, 8, 'right');
    rg += pad('', 14, 'right') + '\n';

    // Low speed
    rg += '  ' + pad('Dusuk Hiz Egim Kabiliyeti', 36);
    rg += pad(num(gd.lowSpeedGrade, 1), 10, 'right');
    rg += pad(num(gd.lowSpeedV, 1), 12, 'right') + pad(gd.lowSpeedGear, 8, 'right');
    rg += pad('%80', 14, 'right') + '\n';

    // Duz yol maks hiz
    rg += '  ' + pad('Duz Yolda Maksimum Hiz', 36);
    rg += pad('0.0', 10, 'right');
    rg += pad(num(gd.maxSpeedFlat, 1), 12, 'right') + pad(gd.maxSpeedFlatGear, 8, 'right');
    rg += pad('Yol Yuku', 14, 'right') + '\n';

    // Grade tablosu
    (gd.gradeTable || []).forEach(function(row) {
      if (row.v_max <= 0 && row.grade > 0) return;
      rg += '  ' + pad('', 36);
      rg += pad(num(row.grade, 1), 10, 'right');
      rg += pad(num(row.v_max, 1), 12, 'right') + pad(row.gear, 8, 'right');
      rg += '\n';
    });

    rg += '  ' + ln('-', 78) + '\n';
    return rg;
  }

  if (G && G.high) {
    r += renderGradeSection(G.high);
    if (G.low) {
      r += '\n';
      r += renderGradeSection(G.low);
    }

    // Egim yorumu
    var gH = G.high;
    r += '\n  YORUM: Bu arac, durma konumundan ';
    if (gH.stallGrade >= 60) r += 'cok dik egimlerde (>%60) dahi kalkis\n  yapabilecek cekis kuvvetine sahiptir.';
    else if (gH.stallGrade >= 30) r += 'yuksek arazi egimlerinde (%' + num(gH.stallGrade, 0) + ') kalkis\n  yapabilecek cekis kuvvetine sahiptir.';
    else r += 'orta egimlerde (%' + num(gH.stallGrade, 0) + ') kalkis yapabilir.';
    r += ' Duz yolda (0% egim) arac maksimum\n';
    r += '  ' + num(gH.maxSpeedFlat, 1) + ' km/h hiza ulasabilir.';

    // %5 ve %10 egim hizlari bul
    var v5 = '-', v10 = '-';
    (gH.gradeTable || []).forEach(function(row) {
      if (Math.abs(row.grade - 5.0) < 0.1) v5 = num(row.v_max, 0);
      if (Math.abs(row.grade - 10.0) < 0.1) v10 = num(row.v_max, 0);
    });
    r += ' %5 egimde (tipik karayolu rampasi) arac\n';
    r += '  ' + v5 + ' km/h ile seyredebilir. %10 egimde (dik yokus) arac ' + v10 + ' km/h ile\n';
    r += '  ilerleyebilir.\n';
  } else {
    r += '  Egim kabiliyeti verisi bulunamadi.\n';
  }
  r += '\n\n';

  // ════════════════════════════════════════════════════════════════════════
  // 7. TAM GAZ HIZLANMA
  // ════════════════════════════════════════════════════════════════════════
  r += ln('=', W) + '\n';
  r += pad('7. TAM GAZ HIZLANMA', W, 'center') + '\n';
  r += ln('=', W) + '\n\n';

  r += '  KOSULLAR\n';
  r += '  ' + ln('-', 38) + '\n';
  r += pRow('Motor Fani', 'Acik');
  r += pRow('Klima', 'Kapali');
  r += pRow('Aks Orani', num(R.diffRatio, 3));
  if (hasTransfer) {
    r += pRow('Transfer Kutusu Orani', num(trHighRatio, 3));
  }
  r += '\n';

  function renderAccelSection(ad) {
    var ra = '';
    if (A.low) {
      ra += '  TRANSFER KUTUSU: ' + ascii(ad.label).toUpperCase() + '\n';
    }
    ra += '  ' + ln('-', 58) + '\n';
    ra += '  ' + pad('Hedef Hiz', 26) + pad('Sure (saniye)', 18, 'right');
    ra += pad('Mesafe (m)', 14, 'right') + '\n';
    ra += '  ' + ln('-', 58) + '\n';

    (ad.rows || []).forEach(function(row) {
      var label = '0 -- ' + pad(String(row.targetSpeed), 3, 'right') + ' km/h';
      ra += '  ' + pad(label, 26);
      if (row.time === null || row.time === undefined) {
        ra += pad('Hiza ulasilamiyor', 18, 'right');
        ra += pad('-', 14, 'right');
      } else {
        ra += pad(num(row.time, 1), 18, 'right');
        ra += pad(numI(row.distance), 14, 'right');
      }
      ra += '\n';
    });

    ra += '  ' + ln('-', 58) + '\n';
    return ra;
  }

  if (A && A.high) {
    r += renderAccelSection(A.high);
    if (A.low) {
      r += '\n';
      r += renderAccelSection(A.low);
    }

    // Hizlanma yorumu
    var aH = A.high;
    var a60 = null, a100 = null;
    (aH.rows || []).forEach(function(row) {
      if (row.targetSpeed === 60 && row.time !== null) a60 = row;
      if (row.targetSpeed === 100 && row.time !== null) a100 = row;
    });
    r += '\n  YORUM: ';
    if (a60) {
      r += 'Arac, 0\'dan 60 km/h hiza ' + num(a60.time, 1) + ' saniyede, ' + numI(a60.distance) + ' metre mesafede\n  ulasmaktadir. ';
    }
    if (a100) {
      r += '0-100 km/h hizlanma ' + num(a100.time, 1) + ' saniyede ' + numI(a100.distance) + ' metrede\n  tamamlanmaktadir.';
    } else if (a60) {
      r += 'Arac 100 km/h hiza ulasamamaktadir.';
    }
    r += '\n';
  } else {
    r += '  Hizlanma verisi bulunamadi.\n';
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

    // Kolon genislikleri (sabit)
    var _c = [9, 9, 9, 12, 12, 10, 12, 10, 14, 16];
    var _cmTW = 0; for (var _wi = 0; _wi < _c.length; _wi++) _cmTW += _c[_wi];

    // Tabloyu renderla
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

    for (var _ri = 0; _ri < _cmTable.length; _ri++) {
      var _row = _cmTable[_ri];
      r += '  ' + pad(num(_row.SR, 3), _c[0], 'right') + pad(num(_row.TR, 3), _c[1], 'right');
      r += pad(numI(_row.N_engine), _c[2], 'right') + pad(num(_row.T_engine, 1), _c[3], 'right');
      r += pad(num(_row.P_engine, 1), _c[4], 'right') + pad(numI(_row.N_turbine), _c[5], 'right');
      r += pad(num(_row.T_turbine, 1), _c[6], 'right') + pad(num(_row.P_turbine, 1), _c[7], 'right');
      r += pad(num(_row.Q_reject, 2), _c[8], 'right');
      r += pad(_row.matchPoint || '', _c[9], 'right') + '\n';
    }

    r += '  ' + ln('-', _cmTW) + '\n\n';
    r += '  Not: T_turbin = T_pompa x TR.  T_pompa = (N_motor / K_pompa)^2.  Dusurme = ' + num(_cmPumpDrop, 1) + ' N.m.\n';
    r += '       T_motor(N) - Dusurme = T_pompa(N)  denklemi Newton-Raphson ile cozulmustur.\n';
    r += '\n\n';
  }

  // ════════════════════════════════════════════════════════════════════════
  // 8. TAM GAZ OTOMATIK VITES GECISLERI (DETAYLI)
  // ════════════════════════════════════════════════════════════════════════
  r += ln('=', WW) + '\n';
  r += pad('8. TAM GAZ OTOMATIK VITES GECISLERI (DETAYLI)', WW, 'center') + '\n';
  r += ln('=', WW) + '\n\n';

  r += '  KOSULLAR\n';
  r += '  ' + ln('-', 38) + '\n';
  r += pRow('Motor Fani', 'Acik');
  r += pRow('Klima', 'Kapali');
  r += pRow('Aks Orani', num(R.diffRatio, 3));
  if (hasTransfer) {
    r += pRow('Transfer Kutusu Orani', num(trHighRatio, 3));
  }
  r += '\n';

  function renderFTSection(steps, label) {
    var rf = '';
    if (hasTransfer && label) {
      rf += '  TRANSFER KUTUSU: ' + ascii(label).toUpperCase() + '\n';
    }
    rf += '  ' + ln('=', WW - 4) + '\n';
    rf += '  ' + pad('Vites', 6) + pad('Hiz', 10, 'right') + pad('Motor', 10, 'right');
    rf += pad('Cikis', 10, 'right') + pad('Cekis', 11, 'right') + pad('Net Cekis', 12, 'right');
    rf += pad('Tekerlek', 11, 'right') + pad('Net Egim', 11, 'right') + pad('Isi Reddi', 11, 'right');
    rf += '   Esleme Noktasi\n';
    rf += '  ' + pad('Kademe', 6) + pad('(km/h)', 10, 'right') + pad('(rpm)', 10, 'right');
    rf += pad('(rpm)', 10, 'right') + pad('(kN)', 11, 'right') + pad('(kN)', 12, 'right');
    rf += pad('Gucu (kW)', 11, 'right') + pad('(%)', 11, 'right') + pad('(kW)', 11, 'right') + '\n';
    rf += '  ' + ln('-', WW - 4) + '\n';

    var prevGear = '';
    var hasNegative = false;

    for (var i = 0; i < steps.length; i++) {
      var s = steps[i];

      // Vites degisimi ayiricisi
      if (prevGear && s.gear !== prevGear) {
        rf += '  ';
        var dashCount = Math.floor((WW - 4) / 2);
        for (var d = 0; d < dashCount - 15; d++) rf += '- ';
        rf += ' [vites gecisi: ' + prevGear + ' -> ' + s.gear + ']\n';
      }

      // Negatif deger kontrolu
      var dpStr = num(s.dp, 2);
      var ngStr = num(s.netGrade, 2);
      if (s.dp < 0) { dpStr += '*'; hasNegative = true; }
      if (s.netGrade < 0) { ngStr += '*'; hasNegative = true; }

      rf += '  ' + pad(s.gear, 6);
      rf += pad(num(s.speed, 1), 10, 'right');
      rf += pad(numI(s.engineRPM), 10, 'right');
      rf += pad(numI(s.outputRPM), 10, 'right');
      rf += pad(num(s.te, 2), 11, 'right');
      rf += pad(dpStr, 12, 'right');
      rf += pad(num(s.wheelPower, 1), 11, 'right');
      rf += pad(ngStr, 11, 'right');
      rf += pad(num(s.heatRejection, 2), 11, 'right');
      rf += '   ' + (s.matchPoint || '') + '\n';

      prevGear = s.gear;
    }

    rf += '  ' + ln('=', WW - 4) + '\n';

    if (hasNegative) {
      rf += '\n  * Negatif degerler aragin bu hizda ek dirence maruz kaldigini gosterir.\n';
    }
    return rf;
  }

  if (stepsHigh.length > 0) {
    r += renderFTSection(stepsHigh, hasTransfer ? (G && G.high ? G.high.label : 'Yuksek Kademe') : '');
    if (stepsLow.length > 0) {
      r += '\n';
      r += renderFTSection(stepsLow, G && G.low ? G.low.label : 'Dusuk Kademe');
    }

    // Sutun aciklamalari
    r += '\n  SUTUN ACIKLAMALARI\n';
    r += '  Vites Kademe   : Vites numarasi + mod (C=Konvertor, L=Lockup)\n';
    r += '  Hiz (km/h)     : Arac hizi\n';
    r += '  Motor (rpm)    : Motor devri -- konvertor modunda slip nedeniyle yuksek,\n';
    r += '                   lockup modunda cikis devri ile esit\n';
    r += '  Cikis (rpm)    : Sanziman cikis devri\n';
    r += '  Cekis (kN)     : Cekis Kuvveti -- tekerlek cevresindeki toplam cekis kuvveti\n';
    r += '  Net Cekis (kN) : Net Cekis -- cekis kuvvetinden tum direncler (yuvarlanma +\n';
    r += '                   aerodinamik) dusuldukten sonra kalan net kuvvet\n';
    r += '  Tekerlek Gucu  : Tekerlek cevresi gucu (kW)\n';
    r += '  Net Egim (%)   : Aragin bu hiz ve kuvvette tirmanabilecegi maks. egim yuzdesi\n';
    r += '  Isi Reddi (kW) : Tork konvertoru kayip isisi -- kilitleme modunda 0, konvertor\n';
    r += '                   modunda kayma oranina oranli\n';
    r += '  Esleme Noktasi : Referans kritik noktalar (Durma, %60 Cekis/Agirlik, %70/%80/%85\n';
    r += '                   governed RPM yuzdesi, Governed)\n';

    // FT Yorum
    var transitions = [];
    for (var i = 1; i < stepsHigh.length; i++) {
      if (stepsHigh[i - 1].gear !== stepsHigh[i].gear) {
        transitions.push({ from: stepsHigh[i - 1].gear, to: stepsHigh[i].gear, speed: stepsHigh[i].speed });
      }
    }
    var numGears = 1;
    var gearSet = {};
    stepsHigh.forEach(function(s) { gearSet[s.gear.replace(/[CL]$/, '')] = true; });
    numGears = Object.keys(gearSet).length;

    var s0 = stepsHigh[0];
    var govStep = null, maxHeat = 0;
    stepsHigh.forEach(function(s) {
      if (s.matchPoint === 'Governed') govStep = s;
      if (s.heatRejection > maxHeat) maxHeat = s.heatRejection;
    });

    r += '\n  YORUM: Arac toplam ' + numGears + ' viteste tam gaz ivmelenme yapmaktadir.\n';
    r += '  Stall noktasinda (0 km/h) toplam cekis kuvveti ' + num(s0.te, 1) + ' kN olup,\n';
    r += '  bu kosulda arac %' + num(s0.netGrade, 1) + ' egimi asabilir.\n';
    if (govStep) {
      r += '  Motor governed devire (' + numI(govStep.engineRPM) + ' rpm) ' + num(govStep.speed, 1) + ' km/h hizda ulasmaktadir.\n';
    }
    if (maxHeat > 0) {
      r += '  Tork konvertoru maksimum ' + num(maxHeat, 1) + ' kW isi reddi\n';
      r += '  uretmektedir.\n';
    }
  } else {
    r += '  FT vites gecisi verisi bulunamadi.\n';
  }
  r += '\n\n';

  // ════════════════════════════════════════════════════════════════════════
  // 9. ENERJI DENGESI ANALIZI
  // ════════════════════════════════════════════════════════════════════════
  r += ln('=', W) + '\n';
  r += pad('9. ENERJI DENGESI ANALIZI', W, 'center') + '\n';
  r += ln('=', W) + '\n\n';

  var eb = ss.energyBalance;
  if (eb) {
    r += '  Motor → Tork Konv. → Sanziman → Tekerlek → Yol\n';
    r += '  ' + ln('-', 60) + '\n\n';

    // Güç akışı tablosu
    r += '  GUC AKISI DAGILIMI\n';
    r += '  ' + ln('-', 60) + '\n';
    r += '  ' + pad('Guc Bileseni', 30) + pad('Maks [kW]', 12, 'right') + pad('Ort [kW]', 12, 'right') + '\n';
    r += '  ' + ln('-', 60) + '\n';
    r += '  ' + pad('Motor Gucu (P_engine)', 30) + pad(num(eb.maxP_engine, 1), 12, 'right') + pad(num(eb.avgP_engine, 1), 12, 'right') + '\n';
    r += '  ' + pad('TC Isi Kaybi (P_TC)', 30) + pad(num(eb.maxP_TC_heat, 1), 12, 'right') + pad(num(eb.avgP_TC_heat, 1), 12, 'right') + '\n';
    r += '  ' + pad('Guc Aktarma Kaybi (P_dt)', 30) + pad(num(eb.maxP_drivetrain, 1), 12, 'right') + pad(num(eb.avgP_drivetrain, 1), 12, 'right') + '\n';
    r += '  ' + pad('Tekerlek Gucu (P_wheel)', 30) + pad(num(eb.maxP_wheel, 1), 12, 'right') + pad(num(eb.avgP_wheel, 1), 12, 'right') + '\n';
    r += '  ' + ln('-', 60) + '\n\n';

    // Tekerlek güç dağılımı
    r += '  TEKERLEK GUCU DAGILIMI (Ortalama)\n';
    r += '  ' + ln('-', 60) + '\n';
    r += '  ' + pad('Yuvarlanma Direnci (P_rolling)', 38) + pad(num(eb.avgP_rolling, 1), 10, 'right') + ' kW\n';
    r += '  ' + pad('Aerodinamik Suruklenme (P_aero)', 38) + pad(num(eb.avgP_aero, 1), 10, 'right') + ' kW\n';
    r += '  ' + pad('Egim Direnci (P_grade)', 38) + pad(num(eb.avgP_grade, 1), 10, 'right') + ' kW\n';
    r += '  ' + pad('Hizlanma Gucu (P_accel)', 38) + pad(num(eb.avgP_accel, 1), 10, 'right') + ' kW\n';
    r += '  ' + ln('-', 60) + '\n\n';

    // Verim
    r += '  TOPLAM VERIM\n';
    r += '  ' + ln('-', 60) + '\n';
    r += pRow('Ortalama Verim (eta_avg)', '%' + num(eb.eta_avg, 1));
    r += pRow('Minimum Verim (eta_min)', '%' + num(eb.eta_min, 1));
    r += pRow('Maksimum Verim (eta_max)', '%' + num(eb.eta_max, 1));
    r += '\n';

    // Kayıp dağılım yüzdeleri
    if (eb.avgP_engine > 0.1) {
      var pctTC = eb.avgP_TC_heat / eb.avgP_engine * 100;
      var pctDT = eb.avgP_drivetrain / eb.avgP_engine * 100;
      var pctWheel = eb.avgP_wheel / eb.avgP_engine * 100;
      r += '  KAYIP DAGILIMI (Motor gucune oranla)\n';
      r += '  ' + ln('-', 60) + '\n';
      r += pRow('Tekerlege aktarilan', '%' + num(pctWheel, 1));
      r += pRow('TC isi kaybi', '%' + num(pctTC, 1));
      r += pRow('Guc aktarma kaybi', '%' + num(pctDT, 1));
      r += '\n';
    }

    // Newton dengesi doğrulama
    r += '  DOGRULAMA\n';
    r += '  ' + ln('-', 60) + '\n';
    r += pRow('Newton dengesi artigi (maks)', num(eb.maxResidual_kW, 3) + ' kW');
    r += pRow('Durum', eb.maxResidual_kW < 0.5 ? 'BASARILI' : 'SAPMA TESPIT EDILDI');
    r += pRow('Analiz edilen nokta sayisi', String(eb.samples));
  } else {
    r += '  Enerji dengesi verisi bulunamadi.\n';
  }
  r += '\n\n';

  // ════════════════════════════════════════════════════════════════════════
  // 10. PERFORMANS OZETI
  // ════════════════════════════════════════════════════════════════════════
  r += ln('=', W) + '\n';
  r += pad('10. PERFORMANS OZETI', W, 'center') + '\n';
  r += ln('=', W) + '\n\n';

  // Box table
  var LW = 42;
  var RW = 33;
  var TW = LW + RW + 3;

  function boxTable(sections) {
    var rb = '';
    rb += '  +' + ln('-', TW) + '+\n';
    rb += '  |' + pad('PERFORMANS OZET TABLOSU', TW, 'center') + '|\n';

    sections.forEach(function(sec) {
      rb += '  +' + ln('-', LW) + '+' + ln('-', RW) + '+\n';
      rb += '  | ' + pad(sec.title, LW - 1) + '|' + pad('', RW) + '|\n';
      rb += '  +' + ln('-', LW) + '+' + ln('-', RW) + '+\n';

      sec.rows.forEach(function(row) {
        rb += '  | ' + pad(ascii(row.label), LW - 1) + '| ' + pad(ascii(row.value), RW - 2) + ' |\n';
      });
    });

    rb += '  +' + ln('-', LW) + '+' + ln('-', RW) + '+\n';
    return rb;
  }

  var gvwTon = R.gvw / 1000;
  var pwRatio = peakPower / gvwTon;
  var tqRatio = peakTorque / gvwTon;

  var boxSections = [];

  // Genel Bilgiler
  boxSections.push({ title: 'GENEL BILGILER', rows: [
    { label: 'Motor', value: ascii(R.engineName) },
    { label: 'Sanziman', value: ascii(R.gbName) },
    { label: 'Tork Konvertoru', value: ascii(R.tcName) },
    { label: 'Brut Agirlik (GVW)', value: numI(R.gvw) + ' kg' },
    { label: 'Guc / Agirlik Orani', value: num(pwRatio, 2) + ' kW/ton' },
    { label: 'Tork / Agirlik Orani', value: num(tqRatio, 1) + ' N.m/ton' }
  ]});

  // Motor Performansi
  boxSections.push({ title: 'MOTOR PERFORMANSI', rows: [
    { label: 'Maksimum Guc', value: num(peakPower, 1) + ' kW @ ' + numI(peakPowerRpm) + ' rpm' },
    { label: 'Maksimum Tork', value: numI(peakTorque) + ' N.m @ ' + numI(peakTorqueRpm) + ' rpm' },
    { label: 'Governed Devir', value: numI(R.governed) + ' rpm' },
    { label: 'Governed Guc', value: num(govPower, 1) + ' kW' }
  ]});

  // Egim Kabiliyeti
  if (G && G.high) {
    var gH2 = G.high;
    var eRows = [
      { label: 'Stall Egim (Durma)', value: '%' + num(gH2.stallGrade, 1) },
      { label: 'Launch Egim (Kalkis)', value: '%' + num(gH2.launchGrade, 1) },
      { label: 'Duz Yol Maks. Hiz', value: num(gH2.maxSpeedFlat, 1) + ' km/h' }
    ];
    // %5, %10, %20 hiz
    [5, 10, 20].forEach(function(gr) {
      (gH2.gradeTable || []).forEach(function(row) {
        if (Math.abs(row.grade - gr) < 0.1 && row.v_max > 0) {
          eRows.push({ label: '%' + gr + ' Egimde Maks. Hiz', value: num(row.v_max, 1) + ' km/h' });
        }
      });
    });
    boxSections.push({ title: 'EGIM KABILIYETI', rows: eRows });
  }

  // Hizlanma Performansi
  if (A && A.high) {
    var aRows = [];
    [30, 60, 80].forEach(function(spd) {
      (A.high.rows || []).forEach(function(row) {
        if (row.targetSpeed === spd) {
          if (row.time !== null && row.time !== undefined) {
            aRows.push({ label: '0 -> ' + spd + ' km/h Suresi', value: num(row.time, 1) + ' sn / ' + numI(row.distance) + ' m' });
          } else {
            aRows.push({ label: '0 -> ' + spd + ' km/h Suresi', value: 'Ulasilamiyor' });
          }
        }
      });
    });
    // Maks hiz suresi (son satir)
    var lastRow = null;
    (A.high.rows || []).forEach(function(row) { if (row.time !== null && row.time !== undefined) lastRow = row; });
    if (lastRow) {
      aRows.push({ label: '0 -> Maks. Hiz Suresi', value: num(lastRow.time, 1) + ' sn / ' + numI(lastRow.distance) + ' m' });
    }
    boxSections.push({ title: 'HIZLANMA PERFORMANSI', rows: aRows });
  }

  // Vites Gecisleri
  if (stepsHigh.length > 0) {
    var firstTransition = null, lastTransition = null;
    for (var t = 1; t < stepsHigh.length; t++) {
      if (stepsHigh[t - 1].gear !== stepsHigh[t].gear) {
        if (!firstTransition) firstTransition = { speed: stepsHigh[t].speed };
        lastTransition = { speed: stepsHigh[t].speed };
      }
    }
    var vRows = [
      { label: 'Toplam Vites Sayisi (Kullanilan)', value: String(numGears) }
    ];
    if (firstTransition) vRows.push({ label: '1->2 Gecis Hizi', value: num(firstTransition.speed, 1) + ' km/h' });
    if (lastTransition) vRows.push({ label: 'Son Vites Gecis Hizi', value: num(lastTransition.speed, 1) + ' km/h' });
    vRows.push({ label: 'Stall Cekis Kuvveti', value: num(stepsHigh[0].te, 2) + ' kN' });
    if (govStep) vRows.push({ label: 'Governed Hiz', value: num(govStep.speed, 1) + ' km/h' });
    if (maxHeat > 0) vRows.push({ label: 'Maks. Isi Reddi', value: num(maxHeat, 1) + ' kW' });
    boxSections.push({ title: 'VITES GECISLERI', rows: vRows });
  }

  // Konvertor Eslesmesi
  if (_ecmResults.length > 0) {
    var selEC = _ecmResults.find(function(e) { return e.name === R.tcName; }) || _ecmResults[0];
    var durStr = selEC.status === 'recommended' ? 'Onerilen' : selEC.status === 'caution' ? 'Dikkat' : 'Onerilmez';
    boxSections.push({ title: 'KONVERTOR ESLESMESI', rows: [
      { label: 'Esleme Durumu', value: durStr + ' (' + ascii(selEC.name) + ')' },
      { label: 'SR @ Governed', value: num(selEC.srGov, 3) },
      { label: 'Turbin Torku @ Stall', value: numI(selEC.tTurbineStall) + ' N.m' }
    ]});
  }

  r += boxTable(boxSections);
  r += '\n\n';

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
  r += pad('Bu rapor BMC MFSim Tam Gaz Hizlanma Performans Hesaplama Programi', W, 'center') + '\n';
  r += pad('ile otomatik olusturulmustur. Hesaplamalar', W, 'center') + '\n';
  r += pad('teorik modellere dayanmaktadir. Gercek test sonuclari ile', W, 'center') + '\n';
  r += pad('dogrulama yapilmasi onerilir.', W, 'center') + '\n';
  r += ln('-', W) + '\n\n';

  r += pad('(c) ' + now.getFullYear() + ' BMC Otomotiv -- Tum Haklari Saklidir', W, 'center') + '\n';

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

  r += pRow('Baslangic Hizi', num(ss0.initSpeed_kmh, 1) + ' km/h');
  r += pRow('Toplam Segment Sayisi', String(inputSegments.length || ss0.segments || segSummary.length));
  r += '\n';

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

    if (hasMultiTransfer) {
      r += ln('*', W) + '\n';
      r += pad('TRANSFER KADEMESI: ' + ascii(String(trKey)).toUpperCase() + ' (i=' + num(ssSd.i_transfer, 3) + ')', W, 'center') + '\n';
      r += ln('*', W) + '\n\n';
    }

    // ── SEGMENT BAZLI OZET TABLO ──
    r += ln('=', W) + '\n';
    r += pad(sectionNum + '. SEGMENT BAZLI SONUC OZETI', W, 'center') + '\n';
    r += ln('=', W) + '\n\n';

    var sumTW = 106;
    r += '  ' + ln('-', sumTW) + '\n';
    r += '  ' + pad('No', 4) + pad('Komut', 12) + pad('Egim %', 8, 'right');
    r += pad('Mesafe m', 10, 'right') + pad('V_giris', 10, 'right') + pad('V_cikis', 10, 'right');
    r += pad('dV', 8, 'right') + pad('V_max', 9, 'right') + pad('V_min', 9, 'right');
    r += pad('Sure s', 9, 'right') + pad('Son Vites', 11, 'right') + pad('Durum', 8) + '\n';
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
      r += pad('', 11, 'right');  // Son vites — segment summary'de yok, boş bırak
      r += '  ' + durum;
      r += '\n';
    });
    r += '  ' + ln('-', sumTW) + '\n';

    // Toplam satırı
    var v0 = segSum.length > 0 ? segSum[0].startSpeed_kmh : 0;
    var vF = segSum.length > 0 ? segSum[segSum.length - 1].endSpeed_kmh : 0;
    var dvTotal = vF - v0;
    r += '  ' + pad('TOPLAM', 4 + 12);
    r += pad('', 8);
    r += pad(numI(ssSd.totalDistance || 0), 10, 'right');
    r += pad(num(v0, 1), 10, 'right');
    r += pad(num(vF, 1), 10, 'right');
    r += pad((dvTotal >= 0 ? '+' : '') + num(dvTotal, 1), 8, 'right');
    r += pad('', 9);
    r += pad('', 9);
    r += pad(num(totalTime, 1), 9, 'right');
    r += '\n';
    r += '  ' + ln('-', sumTW) + '\n\n';

    // Durum açıklamaları
    r += '  DURUM KODLARI\n';
    r += '  HIZLANDI  : Segment sonunda hiz artisi > 1 km/h\n';
    r += '  YAVASLADI : Segment sonunda hiz dususu > 1 km/h\n';
    r += '  SABIT     : Hiz degisimi +/-1 km/h araliginda\n';
    r += '  DURDU     : Arac durma noktasina geldi (< 1 km/h)\n\n\n';


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

    // Veri satırları — her 0.5 saniyede bir örnekleme
    var timeArr = sd.time || [];
    var sampleInterval = 0.5;
    var prevSeg = -1;

    for (var tTarget = 0; tTarget <= (timeArr[timeArr.length - 1] || 0) + 0.001; tTarget += sampleInterval) {
      // En yakın index'i bul
      var idx = 0;
      while (idx < timeArr.length - 1 && timeArr[idx + 1] <= tTarget + sampleInterval * 0.01) idx++;
      if (idx >= timeArr.length) break;

      var segIdx = sd.segment ? sd.segment[idx] : 0;
      var cmdStr = sd.command ? (sd.command[idx] === 'coast' ? 'Gaz Kes.' : 'Tam Gaz') : '';

      // Segment geçişinde ayırıcı
      if (prevSeg >= 0 && segIdx !== prevSeg) {
        r += '  ' + ln('.', Math.floor((WW - 4) / 2)) + '  [Seg ' + (prevSeg + 1) + ' -> ' + (segIdx + 1) + ']\n';
      }
      prevSeg = segIdx;

      var v_kmh = sd.speed ? sd.speed[idx] : 0;
      var rpm = sd.rpm ? sd.rpm[idx] : 0;
      var gear = sd.gearMode ? sd.gearMode[idx] : '';
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
      r += pad(numI(rpm), 8, 'right');
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
    r += '  n [rpm]      : Motor devri\n';
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


    // ── PERFORMANS DEGERLENDIRME ──
    r += ln('=', W) + '\n';
    r += pad((sectionNum + 2) + '. PERFORMANS DEGERLENDIRME', W, 'center') + '\n';
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
      var stalled = sum2.some(function(s) { return s.endSpeed_kmh < 1.0; });
      r += pad(stalled ? 'DURDU' : 'TAMAMLADI', 24, 'right');
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

  // Bileşen adı alma yardımcısı: customName → data.motorName → def.name → type
  function _cName(nd) {
    if(!nd) return '';
    var cn = nd.customName || '';
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

  // 2. ARAC PARAMETRELERI
  r += ln('-', W) + '\n  ARAC PARAMETRELERI\n' + ln('-', W) + '\n';
  r += pRow('Arac Kutle (GVW)', num(inp.mass, 0) + ' kg');
  r += pRow('Ag. Merkezi-On Aks (a1)', num(inp.a1, 3) + ' m');
  r += pRow('Ag. Merkezi-Arka Aks (a2)', num(inp.a2, 3) + ' m');
  r += pRow('Dingil Mesafesi (L=a1+a2)', num(inp.wheelbase, 3) + ' m');
  r += '\n';

  // 2b. KONFIGURASYON — topolojideki tüm bileşenler
  r += ln('-', W) + '\n  KONFIGURASYON\n' + ln('-', W) + '\n';
  if(_engNodeR) r += pRow('Motor', _cName(_engNodeR));
  if(_tcNodeR) r += pRow('Tork Konvertor', _cName(_tcNodeR));
  if(_gbNodeR) r += pRow('Sanziman', _cName(_gbNodeR));
  if(_trNodeR) r += pRow('Transfer Kutusu', _cName(_trNodeR));
  if(_propNodeR) r += pRow('Propshaft', _cName(_propNodeR));
  if(_diffNodeR) r += pRow('Diferansiyel', _cName(_diffNodeR));
  if(_wheelNodeR) r += pRow('Teker', _cName(_wheelNodeR));
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

  // 3. ENGEL PARAMETRELERI
  r += ln('-', W) + '\n  ENGEL PARAMETRELERI\n' + ln('-', W) + '\n';
  r += pRow('Engel Yuksekligi (h)', num(inp.h, 3) + ' m');
  r += '\n';

  // 4. LASTIK PARAMETRELERI
  r += ln('-', W) + '\n  LASTIK PARAMETRELERI\n' + ln('-', W) + '\n';
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

  r += ln('-', W) + '\n  MOTOR & TORK KONVERTOR VERILERI\n' + ln('-', W) + '\n';

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
    r += ln('-', W) + '\n  MOTOR-KONVERTOR ESLEME TABLOSU (Converter Mode)\n' + ln('-', W) + '\n\n';

    // Başlık
    r += '  ' + pad('SR', 7, 'right') + pad('TR', 7, 'right') + pad('N_eng', 7, 'right');
    r += pad('T_eng', 8, 'right') + pad('P_eng', 8, 'right');
    r += pad('T_turb', 8, 'right') + pad('P_turb', 8, 'right');
    r += pad('Q_rej', 8, 'right') + '  Match Point\n';
    r += '  ' + ln('-', 69) + '\n';

    for(var mti = 0; mti < mt.length; mti++) {
      var mp = mt[mti];
      r += '  ' + pad(num(mp.SR, 3), 7, 'right') + pad(num(mp.TR, 3), 7, 'right') + pad(num(mp.N_engine, 0), 7, 'right');
      r += pad(num(mp.T_engine, 1), 8, 'right') + pad(num(mp.P_engine_kW, 1), 8, 'right');
      r += pad(num(mp.T_turbine, 1), 8, 'right') + pad(num(mp.P_turbine_kW, 1), 8, 'right');
      r += pad(num(mp.Q_reject_kW, 2), 8, 'right');
      r += (mp.matchPoint ? '  ' + mp.matchPoint : '') + '\n';
    }
    r += '\n';
    r += '  Not: T_turbine = T_pump x TR (SCAAN dogrulama). T_pump = (N / K_pump)^2.\n';
    r += '\n';

    // ŞANZIMAN ÇIKIŞ TABLOSU
    var gearLabel = inp.gearName ? ascii(inp.gearName) : '1C';
    r += ln('-', W) + '\n  SANZIMAN CIKIS TABLOSU (Gear ' + gearLabel + ' - Converter Mode)\n' + ln('-', W) + '\n\n';

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
    r += ln('=', W) + '\n  TORK GEREKSINIMI ANALIZI (Statik)\n' + ln('=', W) + '\n\n';
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

  // ── ADIM 6: DİNAMİK SİMÜLASYON SONUÇLARI ──
  var dyn = sim.obstacleDynamic;
  if(dyn) {
    r += '\n';
    r += '  ' + ln('*', 68) + '\n';
    r += '  *' + pad('', 66) + '*\n';
    r += '  *' + pad('DINAMIK SIMULASYON', 66, 'center') + '*\n';
    r += '  *' + pad('Zaman Adimli Engel Atlama Modeli', 66, 'center') + '*\n';
    r += '  *' + pad('', 66) + '*\n';
    r += '  ' + ln('*', 68) + '\n\n';

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

      // Milestones — zaman serisi tablosunda annotate edilecek
      var ms = dyn.milestones || [];

      // ┌─────────────────────────────────────────────┐
      //  ZAMAN SERISI VERILERI
      // └─────────────────────────────────────────────┘
      var logData = dyn.log || [];
      if(logData.length > 0) {
        r += '  +' + ln('-', 64) + '+\n';
        r += '  |' + pad(' ZAMAN SERISI VERILERI', 64) + '|\n';
        r += '  +' + ln('-', 64) + '+\n\n';

        // Milestone'ları log satırlarıyla eşleştir
        // Her milestone için en yakın log satırının index'ini bul
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

        // Kolon tanımları
        var hasGbLimit = dyn.params.gbTorqueLimit && dyn.params.gbTorqueLimit > 0;
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

        // Başlık satırları
        var hdr = '  ';
        for(var ci = 0; ci < cols.length; ci++) {
          hdr += pad(cols[ci].h, cols[ci].w, 'right') + ' ';
        }
        r += hdr + '\n';
        r += '  ' + ln('=', hdr.length - 2) + '\n';

        // Veri satırları
        var prevPhase = '';
        for(var li = 0; li < logData.length; li++) {
          var d = logData[li];

          // Faz değişim ayracı
          if(d.phase !== prevPhase && prevPhase !== '') {
            r += '  ' + ln('.', hdr.length - 2) + '\n';
            r += '  ' + pad('>>> FAZ GECISI: ' + (d.phase === 'rear' ? 'ON TEKER -> ARKA TEKER' : 'ARKA TEKER TAMAMLANDI') + ' <<<', hdr.length - 2, 'center') + '\n';
            r += '  ' + ln('.', hdr.length - 2) + '\n';
          }
          prevPhase = d.phase;

          // Milestone annotation — bu satıra eşleşmiş tüm milestone'ları göster
          var rowMilestones = msForRow[li] || [];
          for(var rmi = 0; rmi < rowMilestones.length; rmi++) {
            var matchedMs = rowMilestones[rmi];
            var mLbl = '>>> ' + ascii(matchedMs.label);
            // Detay bilgilerini topla
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

          // Veri satırı
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
          var R_c = (obs.cornerCorrection && obs.cornerCorrection.R_corner > 0) ? obs.cornerCorrection.R_corner : inp.R_eff;
          var T_whl_eff = d.T_wheel * (1 + (R_c / (inp.R_eff || 1)) * Math.cos(phi_rad));
          row += pad(num(T_whl_eff, 0), 8, 'right') + ' ';
          row += pad(isFinite(d.T_req) ? num(d.T_req, 0) : '---', 8, 'right') + ' ';
          row += pad(num(d.phi_deg, 2), 8, 'right') + ' ';
          row += pad(num(d.F_net, 0), 9, 'right') + ' ';
          row += pad(num(d.KE, 0), 9, 'right') + ' ';
          r += row + '\n';
        }
        r += '  ' + ln('=', hdr.length - 2) + '\n';
        r += '\n';
        var logMs = dyn.params.logIntervalSec ? dyn.params.logIntervalSec * 1000 : 10;
        r += '  Toplam ' + logData.length + ' kayit, ~' + num(dyn.totalTime, 2) + ' s surec.\n';
        r += '  (Veriler ' + num(logMs, 0) + ' ms aralikla kaydedilmistir. ">>>" ile baslayan satirlar onemli olaylari gosterir.)\n';
        r += '\n';

        // Kolon açıklamaları
        r += '  Kolon Aciklamalari:\n';
        r += '    t(s)     = Simulasyon zamani (saniye)\n';
        r += '    v(km/h)  = Arac hizi (kilometre/saat)\n';
        r += '    N_eng    = Motor devri (RPM)\n';
        r += '    T_eng    = Motor torku (Nm)\n';
        r += '    TR       = Tork konvertor tork orani\n';
        r += '    SR       = Tork konvertor hiz orani (N_turbin/N_motor)\n';
        r += '    T_gb     = Sanziman cikis torku (Nm)' + (hasGbLimit ? '  (* = motor tork yuzdesi %' + num((dyn.params.motorTorquePct || 1) * 100, 1) + ' uygulanmis)' : '') + '\n';
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
      r += ln('=', W) + '\n  PARAMETRIK CALISMA: YUK TRANSFERI ANALIZI\n' + ln('=', W) + '\n\n';

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

  // FERAGAT
  r += ln('-', W) + '\n';
  r += pad('FERAGATNAME', W, 'center') + '\n';
  r += ln('-', W) + '\n';
  r += pad('Bu rapor MFSim Engel Atlama Analizi Programi', W, 'center') + '\n';
  r += pad('ile otomatik olusturulmustur. Hesaplamalar', W, 'center') + '\n';
  r += pad('teorik modellere dayanmaktadir. Gercek test sonuclari ile', W, 'center') + '\n';
  r += pad('dogrulama yapilmasi onerilir.', W, 'center') + '\n';
  r += ln('-', W) + '\n\n';

  r += pad('(c) ' + now.getFullYear() + ' BMC Otomotiv -- Tum Haklari Saklidir', W, 'center') + '\n';

  return r;
}

