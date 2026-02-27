// ============================================================================
// GRAFİK VE TABLO RENDERLAMA
// ============================================================================

function veGetSensorData(sensorId, signalOverride) {
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

  // ====== SIHIRBAZ DOĞRUDAN BİLEŞEN ERİŞİMİ ======
  // ~compType formatı: fiziksel sensör olmadan doğrudan bileşen verisine erişim
  if(sensorId.charAt(0) === '~') {
    var compType = sensorId.substring(1);
    var sig = signalOverride;
    if(!r || !sig) return null;

    // Hedef bileşeni bul
    var compNode = tabNodes.find(function(n) {
      return n.type === compType || (compType === 'engine' && n.type === 'engine-brake');
    });

    // nodeData'dan doğrudan oku
    if(compNode && r.nodeData && r.nodeData[compNode.id]) {
      var compData = r.nodeData[compNode.id];
      if(compData[sig] && compData[sig].length > 0) return compData[sig];
    }

    // Fallback: top-level veSimResults'tan oku (aşağıdaki fallback mantığı)
    // Araç sinyalleri
    if(sig === 'v_speed') return r.speed || null;
    if(sig === 'v_accel') return r.accel || null;
    if(sig === 'v_distance') return r.distance || null;
    // Yol sinyalleri
    if(sig === 'r_rolling_force') return r.F_rolling || null;
    if(sig === 'r_aero_force') return r.F_aero || null;
    if(sig === 'r_total_resist' && r.F_rolling && r.F_aero) {
      var tr2 = [];
      for(var j2 = 0; j2 < r.F_rolling.length; j2++) tr2.push(r.F_rolling[j2] + r.F_aero[j2]);
      return tr2;
    }
    // Solver sinyalleri
    if(sig === 'tractive_effort' && r.TE) return r.TE;
    if(sig === 'drawbar_pull' && r.DP) return r.DP;
    if(sig === 'wheel_power' && r.WP) return r.WP;
    // Motor sinyalleri
    if(sig === 'rpm' && r.rpm) return r.rpm;
    if(sig === 'torque' && r.engineTorque) return r.engineTorque;
    if(sig === 'power' && r.rpm && r.engineTorque) {
      var pw2 = [];
      for(var i2 = 0; i2 < r.rpm.length; i2++) pw2.push(r.engineTorque[i2] * r.rpm[i2] / 9549);
      return pw2;
    }
    // TC sinyalleri
    if(sig === 'speed_ratio' && r.SR) return r.SR;
    if(sig === 'torque_ratio' && r.tau) return r.tau;
    if(sig === 'efficiency' && r.tcEta) return r.tcEta.map(function(e) { return e * 100; });
    if(sig === 'slip' && r.SR) return r.SR.map(function(sr) { return (1 - sr) * 100; });
    // Zaman
    if(sig === 'time' && r.time) return r.time;

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
  if(sig === 'time' && r.time) return r.time;
  
  // ====== SHIFT CONTROLLER FALLBACK ======
  if(sig === 'gear_mode' && r.gearMode) return r.gearMode;
  if(sig === 'n_output' && r.outputSpeed) return r.outputSpeed;
  
  // ====== MOTOR SİNYALLERİ FALLBACK ======
  if(sig === 'rpm' && r.rpm && r.rpm.length > 0) return r.rpm;
  if(sig === 'torque' && r.engineTorque && r.engineTorque.length > 0) return r.engineTorque;
  if(sig === 'brake_torque' && r.engineTorque && r.engineTorque.length > 0) return r.engineTorque;
  
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

  // Özel X ekseni desteği (sanal sensör veya fiziksel sensör)
  if(slot.xAxis && slot.xAxis.id && slot.xAxis.id !== 'time') {
    if(slot.xAxis.id.charAt(0) === '~') {
      // ~compType:signal formatı (sanal sensör / bileşen verisi)
      var xParts = slot.xAxis.id.substring(1).split(':');
      var xCompType = xParts[0];
      var xSignal = xParts.slice(1).join(':');
      timeArr = veGetSensorData('~' + xCompType, xSignal);
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

  // Standart zaman ekseni
  if(!timeArr) {
    timeArr = (r && r.time) ? r.time : null;
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
    var data = veGetSensorData(s.id, s.signal);
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

  // Özel X ekseni desteği (sanal sensör veya fiziksel sensör)
  if(slot.xAxis && slot.xAxis.id && slot.xAxis.id !== 'time') {
    if(slot.xAxis.id.charAt(0) === '~') {
      // ~compType:signal formatı (sanal sensör / bileşen verisi)
      var xParts = slot.xAxis.id.substring(1).split(':');
      var xCompType = xParts[0];
      var xSignal = xParts.slice(1).join(':');
      timeArr = veGetSensorData('~' + xCompType, xSignal);
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

  if(!timeArr) {
    timeArr = (r && r.time) ? r.time : null;
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
    var data = veGetSensorData(s.id, s.signal);
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
  var engineNode = nodes.find(function(n) { return n.type === 'engine' || n.type === 'engine-brake'; });
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
  
  if(format === 'txt') {
    report = veGenerateTXTReport(steps, {
      tarih: tarih, saat: saat, hazirlayan: hazirlayan,
      mass: mass, r_wheel: r_wheel, i_diff: i_diff, i_transfer: i_transfer,
      i_gear: i_gear, i_torque: i_torque, i_total: i_total,
      delta: delta, aktarmaVerim: aktarmaVerim, mfVerim: mfVerim,
      slopePercent: slopePercent, thetaDeg: thetaDeg,
      Crr: Crr, Cd: Cd, A: A, rho: rho,
      v_start_kmh: v_start_kmh, simSure: simSure,
      vitesAdi: vitesAdi, zamanAdimi: zamanAdimi,
      motorAdi: engineNode ? (engineNode.customName || (componentDefs[engineNode.type] ? componentDefs[engineNode.type].name : '')) : '',
      senaryoAdi: scd.scenarioType === 'coast' ? 'Serbest İniş' : (scd.scenarioType === 'partial_throttle' ? 'Kısmi Gaz' : 'Motor Freni Analizi'),
      solverMethod: sd.method || 'euler',
      gearRatios: gearRatios, currentGear: currentGear
    });
  } else {
    // CSV format
    report = 'Zaman [s];Hız [km/sa];Motor Devri [d/d];Tork [Nm];F_brake [N];F_roll [N];F_aero [N];F_grade [N];F_net [N];İvme [m/s²];Δv [km/sa];Mesafe [m]\n';
    steps.forEach(function(s) {
      report += s.t.toFixed(2) + ';' + s.v_kmh.toFixed(2) + ';' + s.rpm.toFixed(0) + ';' + s.T_mf.toFixed(0) + ';' +
        s.F_brake.toFixed(0) + ';' + s.F_roll.toFixed(0) + ';' + s.F_aero.toFixed(0) + ';' + s.F_grade.toFixed(0) + ';' +
        s.F_net.toFixed(0) + ';' + s.a.toFixed(4) + ';' + s.dv.toFixed(2) + ';' + s.s.toFixed(1) + '\n';
    });
  }
  
  var blob = new Blob([report], { type: format === 'txt' ? 'text/plain;charset=utf-8' : 'text/csv;charset=utf-8' });
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
  r += pad(' ######    ###  ###    ######', W, 'center') + '\n';
  r += pad(' ##   ##   ## ## ##   ##     ', W, 'center') + '\n';
  r += pad(' ######    ##    ##   ##     ', W, 'center') + '\n';
  r += pad(' ##   ##   ##    ##   ##     ', W, 'center') + '\n';
  r += pad(' ######    ##    ##    ######', W, 'center') + '\n\n';
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
  r += '  Iletisim          : kerem.aydogan@bmc.com.tr\n\n';
  r += ln('-', W) + '\n';
  r += pad('Bu rapor BMC Motor Freni Performans Hesaplama Programi', W, 'center') + '\n';
  r += pad('ile olusturulmustur. Hesaplamalar teorik modellere dayanmaktadir.', W, 'center') + '\n';
  r += pad('Gercek test sonuclari ile dogrulama yapilmasi onerilir.', W, 'center') + '\n';
  r += ln('-', W) + '\n\n';
  r += pad('(c) ' + new Date().getFullYear() + ' BMC Otomotiv - Tum Haklari Saklidir', W, 'center') + '\n\n';
  
  return r;
}

function veGenerateFTTxtReport(sim) {
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
  var hazirlayan = (document.getElementById('ve-rapor-hazirlayan') || {}).value || 'Belirtilmemis';
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

  // FT Steps
  var stepsHigh = (typeof veBuildFTStepsFromSim === 'function') ? veBuildFTStepsFromSim(sim, 'high') : [];
  var stepsLow = (typeof veBuildFTStepsFromSim === 'function') ? veBuildFTStepsFromSim(sim, 'low') : [];

  // ECM hesaplamasi
  var _ecmResults = [];
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
        var sc = (c5 ? 1 : 0) + (c7 ? 1 : 0) + (c8 ? 1 : 0);
        var st = sc === 3 ? 'recommended' : sc === 2 ? 'caution' : 'not-recommended';
        _ecmResults.push({ key: key, name: tc.name || key, stallTau: sTau, stallSpeed: sSpeed, minSpeed: minN, srGov: srG, tTurbineStall: tTS, c5ok: c5, c7ok: c7, c8ok: c8, status: st, score: sc });
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
  r += pad('######    ##   ##    ######', W, 'center') + '\n';
  r += pad('##   ##   ### ###   ##     ', W, 'center') + '\n';
  r += pad('######    ## # ##   ##     ', W, 'center') + '\n';
  r += pad('##   ##   ##   ##   ##     ', W, 'center') + '\n';
  r += pad('######    ##   ##    ######', W, 'center') + '\n\n';
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
  r += pRow('Kilitleme Ofseti', numI(lockupOffset) + ' rpm');
  r += pRow('Kilitleme Gecis RPM', numI(lockupRPM) + ' rpm');
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
  r += '\n';

  if (_ecmResults.length > 0) {
    var ecmW = 97;
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
    r += '  C8 : Governed\'da hiz orani >= 0.80 (OK/!!)\n\n';

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
    var eff = (R.diffEff / 100) * (trEff / 100) * psEff * (R.gbEff / 100) * 100;
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
  // 9. PERFORMANS OZETI
  // ════════════════════════════════════════════════════════════════════════
  r += ln('=', W) + '\n';
  r += pad('9. PERFORMANS OZETI', W, 'center') + '\n';
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
  r += pRow('Iletisim', 'kerem.aydogan@bmc.com.tr');
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

