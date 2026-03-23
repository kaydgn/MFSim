// ============================================================================
// BİLEŞEN BAZLI SİMÜLASYON MOTORU
// ============================================================================
// Her bileşen kendi matematiğini bilir. Topoloji bağlantılarından güç aktarma
// zinciri çıkarılır ve her zaman adımında zincir boyunca hesap yapılır.

function veRunSimulationEngine() {
  // Eski grafik görünümlerini sıfırla (yeni simülasyon = temiz görünüm)
  for(var _vi = 0; _vi < 4; _vi++) veResetChartView(_vi);
  
  var chain = veGetPowertrainChain();
  if(chain.length === 0) throw new Error('Güç aktarma zinciri bulunamadı');
  
  var isPartial = chain._isPartial || false;
  
  // Bileşenleri bul
  var engineNode = chain.find(function(n) { return n.type === 'engine'; });
  var tcNode = chain.find(function(n) { return n.type === 'torque-converter'; });
  var gearboxNode = chain.find(function(n) { return n.type === 'gearbox'; });
  var propshaftNodes = chain.filter(function(n) { return n.type === 'propshaft'; });
  var transferNode = chain.find(function(n) { return n.type === 'transfer'; });
  var diffNode = chain.find(function(n) { return n.type === 'differential' && n.isMasterDiff; })
                || chain.find(function(n) { return n.type === 'differential'; });
  var wheelNode = chain.find(function(n) { return n.type === 'wheel' && n.isMasterWheel; }) || chain.find(function(n) { return n.type === 'wheel'; });
  var vehicleNode = nodes.find(function(n) { return n.type === 'vehicle'; });
  var roadNode = nodes.find(function(n) { return n.type === 'road'; });
  var scenarioNode = nodes.find(function(n) { return n.type === 'scenario'; });
  var solverNode = nodes.find(function(n) { return n.type === 'solver'; });
  
  if(!engineNode) throw new Error('Motor bileşeni eksik');
  
  // Propşaft konumları: zincirdeki sıraya göre transfer öncesi/sonrası ayır
  var propshaftPreTransfer = [];  // Şanzıman → Transfer arası
  var propshaftPostTransfer = []; // Transfer → Diferansiyel arası
  if(propshaftNodes.length > 0) {
    var transferIdx = transferNode ? chain.indexOf(transferNode) : 9999;
    propshaftNodes.forEach(function(ps) {
      var psIdx = chain.indexOf(ps);
      if(psIdx < transferIdx) {
        propshaftPreTransfer.push(ps);
      } else {
        propshaftPostTransfer.push(ps);
      }
    });
  }
  
  // ====== MOTOR PARAMETRELERİ ======
  var ed = engineNode.data || {};
  var torqueTable = ed.torqueData || [];
  if(torqueTable.length < 2) throw new Error('Motor tork tablosu eksik (en az 2 veri noktası)');
  
  var governedRpm = parseFloat(ed.governedRpm) || 2100;
  var idleRpm = 800;
  var J_engine = 1.5;
  var engineEff = (parseFloat(ed.verim) || 100) / 100;
  
  // ====== TORK İNTERPOLASYONU — PCHIP SPLİNE ======
  // PCHIP modeli bir kez inşa edilir, her çağrıda O(log n) ile değerlendirilir.
  // Monoton kübik Hermite: C¹ sürekli, şekil koruyucu (overshoot yok).
  // Lineer interpolasyondaki türev süreksizliğini giderir → pürüzsüz kuvvet geçişi.
  
  var _torqueSpline = (torqueTable.length >= 3) ? veBuildPchipSpline(torqueTable) : null;
  
  function interpTorque(rpm) {
    if(_torqueSpline) {
      // PCHIP spline (3+ veri noktası)
      return veEvalPchip(_torqueSpline, rpm) * engineEff;
    }
    // Fallback: lineer interpolasyon (2 nokta)
    if(rpm <= torqueTable[0].rpm) return torqueTable[0].torque * engineEff;
    if(rpm >= torqueTable[torqueTable.length - 1].rpm) return torqueTable[torqueTable.length - 1].torque * engineEff;
    for(var i = 0; i < torqueTable.length - 1; i++) {
      if(rpm >= torqueTable[i].rpm && rpm <= torqueTable[i + 1].rpm) {
        var t = (rpm - torqueTable[i].rpm) / (torqueTable[i + 1].rpm - torqueTable[i].rpm);
        return (torqueTable[i].torque + t * (torqueTable[i + 1].torque - torqueTable[i].torque)) * engineEff;
      }
    }
    return 0;
  }
  
  // Tork türevi (dT/dRPM) — RK45 adım boyutu tahmini için
  function interpTorqueDeriv(rpm) {
    if(_torqueSpline) return veEvalPchipDeriv(_torqueSpline, rpm) * engineEff;
    return 0;
  }
  
  // ====== SENARYO ======
  var scd = scenarioNode ? (scenarioNode.data || {}) : {};
  var scenarioType = scd.scenarioType || 'full_throttle';
  var throttlePct = scenarioType === 'partial_throttle' ? ((parseFloat(scd.throttle) || 50) / 100) : 1.0;
  
  // ====== ÇÖZÜCÜ PARAMETRELERİ ======
  var sd = solverNode ? (solverNode.data || {}) : {};
  var timeMode = sd.timeMode || 'manual';
  var duration = parseFloat(sd.duration) || 60;
  var maxSimTime = parseFloat(sd.maxSimTime) || 300;
  var stopSpeed = (parseFloat(sd.stopSpeed) || 2) / 3.6;
  var method = sd.method || 'euler';
  var simTime = timeMode === 'stop' ? maxSimTime : duration;
  
  // dt: resolution varsa hesapla, yoksa doğrudan al
  var dt;
  var resolution = parseInt(sd.resolution) || 0;
  if(resolution > 0) {
    dt = simTime / resolution;
  } else if(sd.dt) {
    dt = parseFloat(sd.dt);
  } else {
    dt = simTime / 200; // varsayılan 200 adım
  }
  if(dt < 0.001) dt = 0.001;
  
  // ====== PER-COMPONENT SONUÇ DİZİLERİ ======
  var nodeData = {};
  chain.forEach(function(n) { nodeData[n.id] = {}; });
  if(vehicleNode) nodeData[vehicleNode.id] = {};
  if(roadNode) nodeData[roadNode.id] = {};
  
  // Her sinyal için boş dizi oluştur
  function initSignals(nodeId, type) {
    var sigs = COMPONENT_SIGNALS[type];
    if(!sigs || !sigs.outputs) return;
    sigs.outputs.forEach(function(s) {
      if(!nodeData[nodeId]) nodeData[nodeId] = {};
      nodeData[nodeId][s.id] = [];
    });
  }
  chain.forEach(function(n) { initSignals(n.id, n.type); });
  if(vehicleNode) initSignals(vehicleNode.id, 'vehicle');
  if(roadNode) initSignals(roadNode.id, 'road');
  
  var timeArr = [];
  
  // ====== AKTARMA ORANLARI VE VERİMLER ======
  var tcData = tcNode ? (tcNode.data || {}) : null;
  var tcIsLocked = tcData ? (tcData.isLocked !== false) : true; // default kilitli
  var tcRatio = tcData ? (parseFloat(tcData.tcRatio) || 1.0) : 1.0;
  // Kilitli TC: tork çarpanı = 1, hız oranı = 1 (direkt bağlantı)
  // Kilitsiz TC: tork çarpanı = tcRatio, hız oranı ≈ 1/tcRatio (enerji korunumu)
  var tcEffSpeedRatio = tcIsLocked ? 1.0 : Math.min(0.98, 1.0 / tcRatio);
  var tcEffTorqueRatio = tcIsLocked ? 1.0 : tcRatio;
  
  var gbData = gearboxNode ? (gearboxNode.data || {}) : null;
  // gearRatios: önce doğrudan, yoksa gearData'dan türet
  var gearRatios = null;
  if(gbData) {
    if(gbData.gearRatios) {
      gearRatios = gbData.gearRatios;
    } else if(gbData.gearData && gbData.gearData.length > 0) {
      gearRatios = gbData.gearData.map(function(g) { return parseFloat(g.ratio) || 1.0; });
    }
  }
  var currentGear = gbData ? (parseInt(gbData.selectedGear) || 1) : 1;
  var gearRatio = 1.0;
  if(gbData) {
    gearRatio = parseFloat(gbData.selectedGearRatio) || (gearRatios ? (parseFloat(gearRatios[currentGear - 1]) || 1.0) : 1.0);
  }
  var gbEff = gbData ? (parseFloat(gbData.efficiency) || 97) / 100 : 0.97;
  var autoShift = vehicleNode && vehicleNode.data ? (vehicleNode.data.autoShift || false) : false;
  
  var trData = transferNode ? (transferNode.data || {}) : null;
  var transferRatio = trData ? (parseFloat(trData.selectedRatio) || parseFloat(trData.ratio) || 1.0) : 1.0;
  var trEff = trData ? (parseFloat(trData.efficiency) || 98) / 100 : 0.98;
  
  var dfData = diffNode ? (diffNode.data || {}) : null;
  var diffRatio = dfData ? (parseFloat(dfData.diffRatio) || 6.54) : 6.54;
  var dfEff = dfData ? (parseFloat(dfData.efficiency) || 96) / 100 : 0.96;
  
  // Propşaft verimleri (birden fazla olabilir)
  var psEffArr = [];
  var psTotalEff = 1.0;
  propshaftNodes.forEach(function(psn) {
    var psd = psn.data || {};
    var eff = (parseFloat(psd.psEff) || 98.60) / 100;
    psEffArr.push(eff);
    psTotalEff *= eff;
  });
  
  // ====== TEKERLEK & ARAÇ PARAMETRELERİ ======
  var wd = wheelNode ? (wheelNode.data || {}) : {};
  var rWheel = parseFloat(wd.wheelRadius) || 0.60876;
  var Crr = parseFloat(wd.rollingResistance) || 0.015;
  var rotMass = parseFloat(wd.rotatingMass) || 1.08;
  
  var vd = vehicleNode ? (vehicleNode.data || {}) : {};
  var mass = parseFloat(vd.mass) || 20000;
  var v0_kmh = parseFloat(vd.initialSpeed) || 0;
  var Cd = parseFloat(vd.cd) || 0.65;
  var A = parseFloat(vd.frontalArea) || 6.7;
  
  var rd = roadNode ? (roadNode.data || {}) : {};
  var grade = parseFloat(rd.grade) || 0;
  var gradeRad = Math.atan(grade / 100);
  var g = 9.81;
  var rho = parseFloat(rd.airDensity) || 1.225;
  
  // ═══ SEGMENT BAZLI DİNAMİK EĞİM SİSTEMİ ═══
  var isSegmentMode = rd.egimMode === 'segment' && rd.routeSegments && rd.routeSegments.length > 0;
  var segmentLookup = []; // [{distStart, distEnd, grade%, gradeRad, mesafe, deltaH}]
  var segmentTotalDist = 0;
  var currentSegmentIdx = 0;
  
  if(isSegmentMode) {
    var cumD = 0;
    rd.routeSegments.forEach(function(seg) {
      segmentLookup.push({
        distStart: cumD,
        distEnd: cumD + seg.mesafe,
        gradePct: seg.egim,
        gradeRad: Math.atan(seg.egim / 100),
        mesafe: seg.mesafe,
        deltaH: seg.deltaH || 0
      });
      cumD += seg.mesafe;
    });
    segmentTotalDist = cumD;
    
    // İlk segment ile başla
    gradeRad = segmentLookup[0].gradeRad;
    grade = segmentLookup[0].gradePct;
    
    // RK45 segment modunda desteklenmiyor — RK4'e düşür
    if(method === 'rk45') {
      method = 'rk4';
    }
  }
  
  // Mesafeye göre eğim ve segment indeksini döndür
  function getGradeAtDist(d) {
    if(!isSegmentMode || segmentLookup.length === 0) return { gradeRad: gradeRad, gradePct: grade, segIdx: 0 };
    for(var si = 0; si < segmentLookup.length; si++) {
      if(d <= segmentLookup[si].distEnd || si === segmentLookup.length - 1) {
        return { gradeRad: segmentLookup[si].gradeRad, gradePct: segmentLookup[si].gradePct, segIdx: si };
      }
    }
    var last = segmentLookup[segmentLookup.length - 1];
    return { gradeRad: last.gradeRad, gradePct: last.gradePct, segIdx: segmentLookup.length - 1 };
  }
  
  // ====== TOPLAM ORAN (tam mod için) ======
  // Klasik: iTotal = iDiff * iTfer * iGear * iTC
  var totalRatio = gearRatio * transferRatio * diffRatio * tcEffTorqueRatio;
  var totalEff = gbEff * trEff * dfEff * psTotalEff;
  
  // ====== TC MODEL ======
  // Kilitli: direkt bağlantı (ratio 1:1)
  // Kilitsiz: tork çarpanı ve hız oranı uygulanır
  function tcCalcValues(rpm_in, torque_in) {
    var rpm_out = rpm_in * tcEffSpeedRatio;
    var torque_out = torque_in * tcEffTorqueRatio;
    var slip = (1 - tcEffSpeedRatio) * 100;
    return {
      rpm_in: rpm_in,
      torque_in: torque_in,
      rpm_out: rpm_out,
      torque_out: torque_out,
      slip: slip,
      torque_ratio: tcEffTorqueRatio,
      speed_ratio: tcEffSpeedRatio
    };
  }
  
  // ═══ Propşaft veri kayıt yardımcısı ═══
  function recordPropshaftNodes(psArray, inRpm, inTorque) {
    var rpm = inRpm, torque = inTorque;
    psArray.forEach(function(ps) {
      if(!nodeData[ps.id]) return;
      var nd = nodeData[ps.id];
      var eff = psEffArr[propshaftNodes.indexOf(ps)] || 0.986;
      var pIn = torque * rpm * Math.PI / 30 / 1000;
      var outTorque = torque * eff;
      var pOut = outTorque * rpm * Math.PI / 30 / 1000;
      nd.rpm_in.push(rpm);
      nd.torque_in.push(torque);
      nd.rpm_out.push(rpm);
      nd.torque_out.push(outTorque);
      nd.power_in.push(pIn);
      nd.power_out.push(pOut);
      nd.power_loss.push(pIn - pOut);
      torque = outTorque;
    });
    return { rpm: rpm, torque: torque };
  }
  
  // ========================================================================
  // KISMİ ANALİZ MODU (Sonlandırıcı)
  // Durum değişkeni: motor devri (ω rad/s)
  // Newton: J_total · dω/dt = T_engine(ω) · throttle
  // ========================================================================
  if(isPartial || (!wheelNode && !vehicleNode)) {
    
    // Başlangıç: rölanti devri
    var omega = idleRpm * 2 * Math.PI / 60; // rad/s
    var steps = Math.ceil(simTime / dt);
    
    // Zincirdeki downstream bileşenleri belirle — etkili atalet
    // TC varsa: pompa + türbin ataleti ekle (basitleştirilmiş)
    var J_total = J_engine;
    // TC pompa/türbin ataleti yaklaşık olarak eklenir
    if(tcNode) J_total += 0.3; // yaklaşık TC ataleti
    
    function computePartialAccel(omega_e) {
      var rpm = omega_e * 60 / (2 * Math.PI);
      
      // Governor: governed RPM üstünde tork kesilir
      var effRpm = Math.min(rpm, governedRpm);
      var T_engine_raw = interpTorque(effRpm);
      
      // Governor tepkisi: rpm > governedRpm → tork = 0
      if(rpm > governedRpm * 1.02) {
        T_engine_raw = 0;
      } else if(rpm > governedRpm) {
        // Yumuşak kesme
        var overshoot = (rpm - governedRpm) / (governedRpm * 0.02);
        T_engine_raw *= (1 - overshoot);
      }
      
      // Senaryo bazlı tork
      var T_net = 0;
      if(scenarioType === 'full_throttle') {
        T_net = T_engine_raw;
      } else if(scenarioType === 'partial_throttle') {
        T_net = T_engine_raw * throttlePct;
      }
      
      return {
        alpha: T_net / J_total, // açısal ivme rad/s²
        T_engine: T_engine_raw,
        T_net: T_net,
        rpm: rpm
      };
    }
    
    // ====== ZAMAN ADIMI DÖNGÜSÜ ======
    for(var step = 0; step <= steps; step++) {
      var t = step * dt;
      var rpm = omega * 60 / (2 * Math.PI);
      
      // Rölanti altına düşmesin
      if(rpm < idleRpm * 0.5) {
        rpm = idleRpm * 0.5;
        omega = rpm * 2 * Math.PI / 60;
      }
      
      // ====== OTOMATİK VİTES DEĞİŞİMİ ======
      if(autoShift && gearRatios && gearRatios.length > 1 && step > 0) {
        var upshiftThreshold = governedRpm + 400;
        // Upshift: RPM > eşik ve üst vites varsa
        if(rpm > upshiftThreshold && currentGear < gearRatios.length) {
          // Önce mevcut araç hızını hesapla (omega → v_vehicle)
          var v_veh = omega * rWheel / totalRatio;
          currentGear++;
          gearRatio = parseFloat(gearRatios[currentGear - 1]) || gearRatio;
          totalRatio = gearRatio * transferRatio * diffRatio * tcEffTorqueRatio;
          // Aynı araç hızında yeni motor devri
          omega = v_veh * totalRatio / rWheel;
          rpm = omega * 60 / (2 * Math.PI);
        }
        // Downshift: RPM < alt vitesin eşiği ve alt vites varsa
        else if(currentGear > 1 && gearRatios[currentGear - 2]) {
          var lowerGearRatio = parseFloat(gearRatios[currentGear - 2]) || gearRatio;
          var downshiftThreshold = upshiftThreshold * (gearRatio / lowerGearRatio);
          if(rpm < downshiftThreshold) {
            var v_veh2 = omega * rWheel / totalRatio;
            currentGear--;
            gearRatio = lowerGearRatio;
            totalRatio = gearRatio * transferRatio * diffRatio * tcEffTorqueRatio;
            omega = v_veh2 * totalRatio / rWheel;
            rpm = omega * 60 / (2 * Math.PI);
          }
        }
      }
      
      // Durum hesapla
      var st = computePartialAccel(omega);
      
      timeArr.push(parseFloat(t.toFixed(4)));
      
      // ====== PER-COMPONENT KAYIT ======
      // Motor
      var nd_eng = nodeData[engineNode.id];
      if(nd_eng) {
        nd_eng.rpm.push(st.rpm);
        nd_eng.torque.push(st.T_engine);
        nd_eng.power.push(st.T_engine * st.rpm * Math.PI / 30 / 1000); // kW

        if(nd_eng.angular_vel) nd_eng.angular_vel.push(omega);
      }
      
      // Zincirdeki sonraki bileşenler — tork/devir propagasyonu
      var propRpm = st.rpm;
      var propTorque = st.T_engine;
      
      // Tork Konvertörü
      if(tcNode && nodeData[tcNode.id]) {
        var nd_tc = nodeData[tcNode.id];
        var tcR = tcCalcValues(propRpm, propTorque);
        
        nd_tc.rpm_in.push(tcR.rpm_in);
        nd_tc.torque_in.push(tcR.torque_in);
        nd_tc.rpm_out.push(tcR.rpm_out);
        nd_tc.torque_out.push(tcR.torque_out);
        nd_tc.power_out.push(tcR.torque_out * tcR.rpm_out * Math.PI / 30 / 1000);
        nd_tc.slip.push(tcR.slip);
        nd_tc.torque_ratio.push(tcR.torque_ratio);
        nd_tc.speed_ratio.push(tcR.speed_ratio);
        
        propRpm = tcR.rpm_out;
        propTorque = tcR.torque_out;
      }
      
      // Şanzıman
      if(gearboxNode && nodeData[gearboxNode.id]) {
        var nd_gb = nodeData[gearboxNode.id];
        var gbOutRpm = propRpm / gearRatio;
        var gbOutTorque = propTorque * gearRatio * gbEff;
        
        nd_gb.rpm_in.push(propRpm);
        nd_gb.torque_in.push(propTorque);
        nd_gb.rpm_out.push(gbOutRpm);
        nd_gb.torque_out.push(gbOutTorque);
        nd_gb.power_out.push(gbOutTorque * gbOutRpm * Math.PI / 30 / 1000);
        nd_gb.gear.push(currentGear);
        nd_gb.ratio.push(gearRatio);
        
        propRpm = gbOutRpm;
        propTorque = gbOutTorque;
      }
      
      // Propşaft (Şanzıman → Transfer arası)
      if(propshaftPreTransfer.length > 0) {
        var psRes = recordPropshaftNodes(propshaftPreTransfer, propRpm, propTorque);
        propRpm = psRes.rpm; propTorque = psRes.torque;
      }
      
      // Transfer Kutusu
      if(transferNode && nodeData[transferNode.id]) {
        var nd_tr = nodeData[transferNode.id];
        var trOutRpm = propRpm / transferRatio;
        var trOutTorque = propTorque * transferRatio * trEff;
        
        nd_tr.rpm_in.push(propRpm);
        nd_tr.torque_in.push(propTorque);
        nd_tr.rpm_out.push(trOutRpm);
        nd_tr.torque_out.push(trOutTorque);
        nd_tr.power_out.push(trOutTorque * trOutRpm * Math.PI / 30 / 1000);
        
        propRpm = trOutRpm;
        propTorque = trOutTorque;
      }
      
      // Propşaft (Transfer → Diferansiyel arası)
      if(propshaftPostTransfer.length > 0) {
        var psRes2 = recordPropshaftNodes(propshaftPostTransfer, propRpm, propTorque);
        propRpm = psRes2.rpm; propTorque = psRes2.torque;
      }
      
      // Diferansiyel
      if(diffNode && nodeData[diffNode.id]) {
        var nd_df = nodeData[diffNode.id];
        var dfOutRpm = propRpm / diffRatio;
        var dfOutTorque = propTorque * diffRatio * dfEff;
        
        nd_df.rpm_in.push(propRpm);
        nd_df.torque_in.push(propTorque);
        nd_df.rpm_out.push(dfOutRpm);
        nd_df.torque_out.push(dfOutTorque);
        nd_df.power_out.push(dfOutTorque * dfOutRpm * Math.PI / 30 / 1000);
        
        propRpm = dfOutRpm;
        propTorque = dfOutTorque;
      }
      
      // Tekerlek (varsa ama araç yoksa)
      if(wheelNode && nodeData[wheelNode.id]) {
        var nd_wh = nodeData[wheelNode.id];
        var wheelSpeed_ms = propRpm * 2 * Math.PI * rWheel / 60;
        var tractionForce = propTorque / rWheel;
        
        nd_wh.rpm_in.push(propRpm);
        nd_wh.torque_in.push(propTorque);
        nd_wh.speed.push(wheelSpeed_ms * 3.6);
        nd_wh.force.push(tractionForce);
        nd_wh.power_out.push(tractionForce * wheelSpeed_ms / 1000);
      }
      
      // Entegrasyon — omega güncelle
      if(step < steps) {
        var dalpha;
        if(method === 'euler') {
          dalpha = st.alpha * dt;
        } else if(method === 'heun') {
          var st2 = computePartialAccel(omega + st.alpha * dt);
          dalpha = (st.alpha + st2.alpha) / 2 * dt;
        } else if(method === 'ralston') {
          var stR = computePartialAccel(omega + st.alpha * dt * 2/3);
          dalpha = (st.alpha / 4 + stR.alpha * 3/4) * dt;
        } else { // rk4
          var k1 = st.alpha;
          var k2 = computePartialAccel(omega + k1 * dt / 2).alpha;
          var k3 = computePartialAccel(omega + k2 * dt / 2).alpha;
          var k4 = computePartialAccel(omega + k3 * dt).alpha;
          dalpha = (k1 + 2 * k2 + 2 * k3 + k4) / 6 * dt;
        }
        omega += dalpha;
        if(omega < 0) omega = 0;
      }
    }
    
    // Sonuç — eski format uyumluluğu + nodeData
    return {
      time: timeArr,
      mode: 'partial',
      chainNodeIds: chain.map(function(n) { return n.id; }),
      nodeData: nodeData,
      // Uyumluluk: motor verileri
      speed: nodeData[engineNode.id].rpm.map(function(r) { return r; }), // RPM as fallback
      rpm: nodeData[engineNode.id].rpm,
      engineTorque: nodeData[engineNode.id].torque,
      F_grade: timeArr.map(function() { return 0; }),
      F_rolling: timeArr.map(function() { return 0; }),
      F_aero: timeArr.map(function() { return 0; }),
      F_net: timeArr.map(function() { return 0; }),
      distance: timeArr.map(function() { return 0; }),
      accel: timeArr.map(function() { return 0; })
    };
  }
  
  // ========================================================================
  // TAM ANALİZ MODU (Motor → ... → Tekerlek → Araç)
  // Durum değişkeni: araç hızı (v m/s)
  // Newton: m_eff · dv/dt = F_çekiş - F_direnç
  // ========================================================================
  if(!vehicleNode) throw new Error('Tam analiz için Araç bileşeni gerekli');
  
  // Hız → RPM dönüşümü
  function speedToRpm(v_ms) {
    return (v_ms / rWheel) * totalRatio * 60 / (2 * Math.PI);
  }
  
  // İvme hesaplama (ana fizik) — tam mod
  function computeAccelFull(v_ms) {
    if(v_ms < 0.01) v_ms = 0.01;
    
    var rpm = speedToRpm(v_ms);
    var v_kmh = v_ms * 3.6;
    
    // Motor torku
    var T_engine_raw, T_engine = 0;

    // Governor RPM sınırlaması geçerli
    var effRpm = Math.min(rpm, governedRpm);
    T_engine_raw = interpTorque(effRpm);

    // Governor tepkisi: rpm > governedRpm → tork kademeli kesme
    if(rpm > governedRpm * 1.02) {
      T_engine_raw = 0;
    } else if(rpm > governedRpm) {
      var overshoot = (rpm - governedRpm) / (governedRpm * 0.02);
      T_engine_raw *= (1 - overshoot);
    }

    if(scenarioType === 'full_throttle') {
      T_engine = T_engine_raw;
    } else if(scenarioType === 'partial_throttle') {
      T_engine = T_engine_raw * throttlePct;
    }
    
    // Tekerlekteki kuvvet
    var F_engine = T_engine * totalRatio * totalEff / rWheel;
    
    // Dirençler
    var F_grade = mass * g * Math.sin(gradeRad);
    var Crr_eff = (typeof FT_SOLVER !== 'undefined' && FT_SOLVER.getCrrEffective) ? FT_SOLVER.getCrrEffective(Crr, v_ms) : Crr;
    var F_rolling = mass * g * Math.cos(gradeRad) * Crr_eff;
    var F_aero = 0.5 * rho * Cd * A * v_ms * v_ms;

    var F_net = F_grade - F_rolling - F_aero + F_engine;
    var m_eff = mass * rotMass;
    
    return {
      accel: F_net / m_eff,
      rpm: rpm,
      T_engine: Math.abs(T_engine_raw),
      T_engine_signed: T_engine,
      F_engine: F_engine,
      F_grade: F_grade,
      F_rolling: F_rolling,
      F_aero: F_aero,
      F_net: F_net,
      v_ms: v_ms
    };
  }
  
  // ====== ZAMAN ADIMI DÖNGÜSÜ — TAM MOD ======
  var v = v0_kmh / 3.6;
  var dist = 0;
  var steps2 = Math.ceil(simTime / dt);
  
  // Legacy arrays
  var res_speed = [], res_rpm = [], res_engineTorque = [], res_accel = [];
  var res_F_grade = [], res_F_rolling = [], res_F_aero = [], res_F_net = [];
  var res_distance = [];
  
  // Enerji dengesi takibi
  var energyTracker = veEnergyBalance();
  energyTracker.init(mass * rotMass, v); // Efektif kütle × v₀
  
  // Solver istatistikleri
  var solverStats = { method: method, steps: 0, rejected: 0, events: [], dtMin: dt, dtMax: dt, energyError: null };
  
  if(method === 'rk45') {
    // ════════════════════════════════════════════════════════
    // RK45 DORMAND-PRINCE ADAPTİF SOLVER
    // ════════════════════════════════════════════════════════
    
    // Solver parametreleri
    var sd_tol = solverNode ? (solverNode.data || {}) : {};
    var rk45_atol = parseFloat(sd_tol.atol) || 1e-6;
    var rk45_rtol = parseFloat(sd_tol.rtol) || 1e-4;
    var outputSteps = parseInt(sd_tol.resolution) || 500;
    var outputDt = simTime / outputSteps;
    
    // İvme fonksiyonu — gear shift dahil
    // RK45 solver'a tek değişkenli f(t,v) olarak veriyoruz
    var _rk45_lastGear = currentGear;
    var _rk45_lastRatio = gearRatio;
    var _rk45_lastTotalRatio = totalRatio;
    var _rk45_gearEvents = [];
    
    function rk45AccelFn(t_eval, v_eval) {
      if(v_eval < 0.01) v_eval = 0.01;
      
      // Vites kontrolü (süreksizlik kaynaklarından biri)
      if(autoShift && gearRatios && gearRatios.length > 1) {
        var rpm_check = (v_eval / rWheel) * _rk45_lastTotalRatio * 60 / (2 * Math.PI);
        var upT = governedRpm + 400;
        
        if(rpm_check > upT && _rk45_lastGear < gearRatios.length) {
          _rk45_lastGear++;
          _rk45_lastRatio = parseFloat(gearRatios[_rk45_lastGear - 1]) || _rk45_lastRatio;
          _rk45_lastTotalRatio = _rk45_lastRatio * transferRatio * diffRatio * tcEffTorqueRatio;
          _rk45_gearEvents.push({ t: t_eval, gear: _rk45_lastGear, type: 'up' });
        } else if(_rk45_lastGear > 1 && gearRatios[_rk45_lastGear - 2]) {
          var lwGR = parseFloat(gearRatios[_rk45_lastGear - 2]) || _rk45_lastRatio;
          var dnT = upT * (_rk45_lastRatio / lwGR);
          if(rpm_check < dnT) {
            _rk45_lastGear--;
            _rk45_lastRatio = lwGR;
            _rk45_lastTotalRatio = _rk45_lastRatio * transferRatio * diffRatio * tcEffTorqueRatio;
            _rk45_gearEvents.push({ t: t_eval, gear: _rk45_lastGear, type: 'down' });
          }
        }
      }
      
      // Fizik hesabı
      var rpm = (v_eval / rWheel) * _rk45_lastTotalRatio * 60 / (2 * Math.PI);
      var T_raw, T_engine = 0;
      var v_kmh = v_eval * 3.6;
      
      // Governor geçerli
      var effRpm = Math.min(rpm, governedRpm);
      T_raw = interpTorque(effRpm);
      if(rpm > governedRpm * 1.02) T_raw = 0;
      else if(rpm > governedRpm) T_raw *= (1 - (rpm - governedRpm) / (governedRpm * 0.02));
      if(scenarioType === 'full_throttle') T_engine = T_raw;
      else if(scenarioType === 'partial_throttle') T_engine = T_raw * throttlePct;
      
      var F_engine = T_engine * _rk45_lastTotalRatio * totalEff / rWheel;
      var F_grade = mass * g * Math.sin(gradeRad);
      var Crr_eff_rk = (typeof FT_SOLVER !== 'undefined' && FT_SOLVER.getCrrEffective) ? FT_SOLVER.getCrrEffective(Crr, v_eval) : Crr;
      var F_rolling = mass * g * Math.cos(gradeRad) * Crr_eff_rk;
      var F_aero = 0.5 * rho * Cd * A * v_eval * v_eval;
      var F_net = F_grade - F_rolling - F_aero + F_engine;
      
      return F_net / (mass * rotMass);
    }
    
    // Event fonksiyonu: 20 km/h cutoff geçişi
    function rk45EventFn(t_eval, v_eval) {
      return v_eval * 3.6 - 20.0; // sıfır geçişi = 20 km/h
    }
    
    // RK45 çözümü çalıştır
    var rk45Result = veRK45Solve(rk45AccelFn, 0, v, simTime, {
      atol: rk45_atol,
      rtol: rk45_rtol,
      dtMin: 1e-6,
      dtMax: simTime / 20,
      dtInit: simTime / 200,
      outputDt: outputDt,
      maxSteps: 50000,
      eventFn: rk45EventFn,
      stopAtZero: (timeMode === 'stop')
    });
    
    // Solver istatistikleri
    solverStats.steps = rk45Result.totalSteps;
    solverStats.rejected = rk45Result.rejected;
    solverStats.events = rk45Result.events.concat(_rk45_gearEvents);
    solverStats.dtMin = Math.min.apply(null, rk45Result.dt_used.filter(function(d) { return d > 0; }));
    solverStats.dtMax = Math.max.apply(null, rk45Result.dt_used);
    solverStats.maxError = Math.max.apply(null, rk45Result.errors);
    
    // ── Çıktı dizilerini oluştur + per-component kayıt ──
    // RK45 uniform çıktı noktalarından her bileşenin verilerini hesapla
    _rk45_lastGear = currentGear;
    _rk45_lastRatio = gearRatio;
    _rk45_lastTotalRatio = totalRatio;
    
    for(var ri = 0; ri < rk45Result.t.length; ri++) {
      var t_ri = rk45Result.t[ri];
      var v_ri = rk45Result.v[ri];
      
      // Vites durumunu güncelle (event log'dan)
      for(var gi = 0; gi < _rk45_gearEvents.length; gi++) {
        if(_rk45_gearEvents[gi].t <= t_ri) {
          _rk45_lastGear = _rk45_gearEvents[gi].gear;
          _rk45_lastRatio = parseFloat(gearRatios[_rk45_lastGear - 1]) || _rk45_lastRatio;
          _rk45_lastTotalRatio = _rk45_lastRatio * transferRatio * diffRatio * tcEffTorqueRatio;
        }
      }
      currentGear = _rk45_lastGear;
      gearRatio = _rk45_lastRatio;
      totalRatio = _rk45_lastTotalRatio;
      
      var st_ri = computeAccelFull(v_ri);
      
      timeArr.push(t_ri);
      res_speed.push(v_ri * 3.6);
      res_rpm.push(st_ri.rpm);
      res_engineTorque.push(st_ri.T_engine);
      res_accel.push(st_ri.accel);
      res_F_grade.push(st_ri.F_grade);
      res_F_rolling.push(st_ri.F_rolling);
      res_F_aero.push(st_ri.F_aero);
      res_F_net.push(st_ri.F_net);
      
      // Mesafe (trapezoidal)
      if(ri > 0) {
        var v_prev = rk45Result.v[ri - 1];
        var dt_ri = t_ri - rk45Result.t[ri - 1];
        dist += 0.5 * (v_prev + v_ri) * dt_ri;
        
        // Enerji dengesi
        energyTracker.addStep(v_prev, v_ri, dt_ri, st_ri.F_engine, st_ri.F_rolling, st_ri.F_aero, st_ri.F_grade);
      }
      res_distance.push(dist);
      
      // ── Per-component kayıt ──
      var propRpmR = st_ri.rpm;
      var propTorqueR = st_ri.T_engine;
      
      if(nodeData[engineNode.id]) {
        var ne = nodeData[engineNode.id];
        ne.rpm.push(st_ri.rpm);
        ne.torque.push(st_ri.T_engine);
        ne.power.push(st_ri.T_engine * st_ri.rpm * Math.PI / 30 / 1000);

        if(ne.angular_vel) ne.angular_vel.push(st_ri.rpm * 2 * Math.PI / 60);
      }
      
      if(tcNode && nodeData[tcNode.id]) {
        var nd_tcR = nodeData[tcNode.id];
        var tcRR = tcCalcValues(propRpmR, propTorqueR);
        nd_tcR.rpm_in.push(tcRR.rpm_in); nd_tcR.torque_in.push(tcRR.torque_in);
        nd_tcR.rpm_out.push(tcRR.rpm_out); nd_tcR.torque_out.push(tcRR.torque_out);
        nd_tcR.power_out.push(tcRR.torque_out * tcRR.rpm_out * Math.PI / 30 / 1000);
        nd_tcR.slip.push(tcRR.slip); nd_tcR.torque_ratio.push(tcRR.torque_ratio); nd_tcR.speed_ratio.push(tcRR.speed_ratio);
        propRpmR = tcRR.rpm_out; propTorqueR = tcRR.torque_out;
      }
      
      if(gearboxNode && nodeData[gearboxNode.id]) {
        var ngR = nodeData[gearboxNode.id];
        ngR.rpm_in.push(propRpmR); ngR.torque_in.push(propTorqueR);
        ngR.rpm_out.push(propRpmR / gearRatio); ngR.torque_out.push(propTorqueR * gearRatio * gbEff);
        ngR.power_out.push(propTorqueR * gearRatio * gbEff * (propRpmR / gearRatio) * Math.PI / 30 / 1000);
        ngR.gear.push(currentGear); ngR.ratio.push(gearRatio);
        propRpmR = propRpmR / gearRatio; propTorqueR = propTorqueR * gearRatio * gbEff;
      }
      
      if(propshaftPreTransfer.length > 0) {
        var psRR = recordPropshaftNodes(propshaftPreTransfer, propRpmR, propTorqueR);
        propRpmR = psRR.rpm; propTorqueR = psRR.torque;
      }
      
      if(transferNode && nodeData[transferNode.id]) {
        var ntR = nodeData[transferNode.id];
        ntR.rpm_in.push(propRpmR); ntR.torque_in.push(propTorqueR);
        ntR.rpm_out.push(propRpmR / transferRatio); ntR.torque_out.push(propTorqueR * transferRatio * trEff);
        ntR.power_out.push(propTorqueR * transferRatio * trEff * (propRpmR / transferRatio) * Math.PI / 30 / 1000);
        propRpmR = propRpmR / transferRatio; propTorqueR = propTorqueR * transferRatio * trEff;
      }
      
      if(propshaftPostTransfer.length > 0) {
        var psRR2 = recordPropshaftNodes(propshaftPostTransfer, propRpmR, propTorqueR);
        propRpmR = psRR2.rpm; propTorqueR = psRR2.torque;
      }
      
      if(diffNode && nodeData[diffNode.id]) {
        var ndfR = nodeData[diffNode.id];
        ndfR.rpm_in.push(propRpmR); ndfR.torque_in.push(propTorqueR);
        ndfR.rpm_out.push(propRpmR / diffRatio); ndfR.torque_out.push(propTorqueR * diffRatio * dfEff);
        ndfR.power_out.push(propTorqueR * diffRatio * dfEff * (propRpmR / diffRatio) * Math.PI / 30 / 1000);
        propRpmR = propRpmR / diffRatio; propTorqueR = propTorqueR * diffRatio * dfEff;
      }
      
      if(wheelNode && nodeData[wheelNode.id]) {
        var nwR = nodeData[wheelNode.id];
        nwR.rpm_in.push(propRpmR); nwR.torque_in.push(propTorqueR);
        nwR.speed.push(v_ri * 3.6); nwR.force.push(propTorqueR / rWheel);
        nwR.power_out.push((propTorqueR / rWheel) * v_ri / 1000);
      }
      
      if(vehicleNode && nodeData[vehicleNode.id]) {
        var nvR = nodeData[vehicleNode.id];
        nvR.v_speed.push(v_ri * 3.6); nvR.v_accel.push(st_ri.accel);
        nvR.v_distance.push(dist); nvR.v_decel_g.push(st_ri.accel / g);
        nvR.v_kinetic_energy.push(0.5 * mass * v_ri * v_ri / 1000);
      }
      
      if(roadNode && nodeData[roadNode.id]) {
        var nrR = nodeData[roadNode.id];
        nrR.r_grade_force.push(st_ri.F_grade); nrR.r_rolling_force.push(st_ri.F_rolling);
        nrR.r_aero_force.push(st_ri.F_aero); nrR.r_total_resist.push(st_ri.F_rolling + st_ri.F_aero);
        nrR.r_net_force.push(st_ri.F_net);
        nrR.r_current_grade.push(parseFloat(rd.grade) || 0);
        nrR.r_current_segment.push(1);
      }
      
      // Durma kontrolü
      if(timeMode === 'stop' && v_ri * 3.6 < (parseFloat((solverNode && solverNode.data || {}).stopSpeed) || 2) && ri > 0) break;
    }
    
    v = rk45Result.v[rk45Result.v.length - 1];
    
  } else {
  // ════════════════════════════════════════════════════════
  // KLASİK SOLVERLAR (Euler / Heun / RK4) — Sabit dt
  // ════════════════════════════════════════════════════════
  
  for(var step2 = 0; step2 <= steps2; step2++) {
    var t2 = step2 * dt;
    
    // ====== SEGMENT BAZLI EĞİM GÜNCELLEMESİ ======
    if(isSegmentMode) {
      var segInfo = getGradeAtDist(dist);
      gradeRad = segInfo.gradeRad;
      grade = segInfo.gradePct;
      currentSegmentIdx = segInfo.segIdx;
    }
    
    // ====== OTOMATİK VİTES DEĞİŞİMİ (full mode) ======
    if(autoShift && gearRatios && gearRatios.length > 1 && step2 > 0) {
      var curRpm = speedToRpm(v);
      var upshiftThresh = governedRpm + 400;
      if(curRpm > upshiftThresh && currentGear < gearRatios.length) {
        currentGear++;
        gearRatio = parseFloat(gearRatios[currentGear - 1]) || gearRatio;
        totalRatio = gearRatio * transferRatio * diffRatio * tcEffTorqueRatio;
      } else if(currentGear > 1 && gearRatios[currentGear - 2]) {
        var lowerGR = parseFloat(gearRatios[currentGear - 2]) || gearRatio;
        var downThresh = upshiftThresh * (gearRatio / lowerGR);
        if(curRpm < downThresh) {
          currentGear--;
          gearRatio = lowerGR;
          totalRatio = gearRatio * transferRatio * diffRatio * tcEffTorqueRatio;
        }
      }
    }
    
    var st2 = computeAccelFull(v);
    
    timeArr.push(parseFloat(t2.toFixed(4)));
    res_speed.push(v * 3.6);
    res_rpm.push(st2.rpm);
    res_engineTorque.push(st2.T_engine);
    res_accel.push(st2.accel);
    res_F_grade.push(st2.F_grade);
    res_F_rolling.push(st2.F_rolling);
    res_F_aero.push(st2.F_aero);
    res_F_net.push(st2.F_net);
    res_distance.push(dist);
    
    // ====== PER-COMPONENT KAYIT ======
    var propRpm2 = st2.rpm;
    var propTorque2 = st2.T_engine;
    
    // Motor
    if(nodeData[engineNode.id]) {
      var ne = nodeData[engineNode.id];
      ne.rpm.push(st2.rpm);
      ne.torque.push(st2.T_engine);
      ne.power.push(st2.T_engine * st2.rpm * Math.PI / 30 / 1000);

      if(ne.angular_vel) ne.angular_vel.push(st2.rpm * 2 * Math.PI / 60);
    }
    
    // TC
    if(tcNode && nodeData[tcNode.id]) {
      var nd_tc2 = nodeData[tcNode.id];
      var tcR2 = tcCalcValues(propRpm2, propTorque2);
      nd_tc2.rpm_in.push(tcR2.rpm_in);
      nd_tc2.torque_in.push(tcR2.torque_in);
      nd_tc2.rpm_out.push(tcR2.rpm_out);
      nd_tc2.torque_out.push(tcR2.torque_out);
      nd_tc2.power_out.push(tcR2.torque_out * tcR2.rpm_out * Math.PI / 30 / 1000);
      nd_tc2.slip.push(tcR2.slip);
      nd_tc2.torque_ratio.push(tcR2.torque_ratio);
      nd_tc2.speed_ratio.push(tcR2.speed_ratio);
      propRpm2 = tcR2.rpm_out;
      propTorque2 = tcR2.torque_out;
    }
    
    // Şanzıman
    if(gearboxNode && nodeData[gearboxNode.id]) {
      var ng = nodeData[gearboxNode.id];
      ng.rpm_in.push(propRpm2);
      ng.torque_in.push(propTorque2);
      ng.rpm_out.push(propRpm2 / gearRatio);
      ng.torque_out.push(propTorque2 * gearRatio * gbEff);
      ng.power_out.push(propTorque2 * gearRatio * gbEff * (propRpm2 / gearRatio) * Math.PI / 30 / 1000);
      ng.gear.push(currentGear);
      ng.ratio.push(gearRatio);
      propRpm2 = propRpm2 / gearRatio;
      propTorque2 = propTorque2 * gearRatio * gbEff;
    }
    
    // Propşaft (Şanzıman → Transfer arası)
    if(propshaftPreTransfer.length > 0) {
      var psF = recordPropshaftNodes(propshaftPreTransfer, propRpm2, propTorque2);
      propRpm2 = psF.rpm; propTorque2 = psF.torque;
    }
    
    // Transfer
    if(transferNode && nodeData[transferNode.id]) {
      var nt = nodeData[transferNode.id];
      nt.rpm_in.push(propRpm2);
      nt.torque_in.push(propTorque2);
      nt.rpm_out.push(propRpm2 / transferRatio);
      nt.torque_out.push(propTorque2 * transferRatio * trEff);
      nt.power_out.push(propTorque2 * transferRatio * trEff * (propRpm2 / transferRatio) * Math.PI / 30 / 1000);
      propRpm2 = propRpm2 / transferRatio;
      propTorque2 = propTorque2 * transferRatio * trEff;
    }
    
    // Propşaft (Transfer → Diferansiyel arası)
    if(propshaftPostTransfer.length > 0) {
      var psF2 = recordPropshaftNodes(propshaftPostTransfer, propRpm2, propTorque2);
      propRpm2 = psF2.rpm; propTorque2 = psF2.torque;
    }
    
    // Diferansiyel
    if(diffNode && nodeData[diffNode.id]) {
      var ndf = nodeData[diffNode.id];
      ndf.rpm_in.push(propRpm2);
      ndf.torque_in.push(propTorque2);
      ndf.rpm_out.push(propRpm2 / diffRatio);
      ndf.torque_out.push(propTorque2 * diffRatio * dfEff);
      ndf.power_out.push(propTorque2 * diffRatio * dfEff * (propRpm2 / diffRatio) * Math.PI / 30 / 1000);
      propRpm2 = propRpm2 / diffRatio;
      propTorque2 = propTorque2 * diffRatio * dfEff;
    }
    
    // Tekerlek
    if(wheelNode && nodeData[wheelNode.id]) {
      var nw = nodeData[wheelNode.id];
      nw.rpm_in.push(propRpm2);
      nw.torque_in.push(propTorque2);
      nw.speed.push(v * 3.6);
      nw.force.push(propTorque2 / rWheel);
      nw.power_out.push((propTorque2 / rWheel) * v / 1000);
    }
    
    // Araç
    if(vehicleNode && nodeData[vehicleNode.id]) {
      var nv = nodeData[vehicleNode.id];
      nv.v_speed.push(v * 3.6);
      nv.v_accel.push(st2.accel);
      nv.v_distance.push(dist);
      nv.v_decel_g.push(st2.accel / g);
      nv.v_kinetic_energy.push(0.5 * mass * v * v / 1000);
    }
    
    // Yol
    if(roadNode && nodeData[roadNode.id]) {
      var nr = nodeData[roadNode.id];
      nr.r_grade_force.push(st2.F_grade);
      nr.r_rolling_force.push(st2.F_rolling);
      nr.r_aero_force.push(st2.F_aero);
      nr.r_total_resist.push(st2.F_rolling + st2.F_aero);
      nr.r_net_force.push(st2.F_net);
      nr.r_current_grade.push(isSegmentMode ? grade : (parseFloat(rd.grade) || 0));
      nr.r_current_segment.push(isSegmentMode ? (currentSegmentIdx + 1) : 1);
    }
    
    // Entegrasyon
    if(step2 < steps2) {
      var v_old = v;
      var dv2;
      if(method === 'euler') {
        dv2 = st2.accel * dt;
      } else if(method === 'heun') {
        var s2a = computeAccelFull(v + st2.accel * dt);
        dv2 = (st2.accel + s2a.accel) / 2 * dt;
      } else if(method === 'ralston') {
        var sRa = computeAccelFull(v + st2.accel * dt * 2/3);
        dv2 = (st2.accel / 4 + sRa.accel * 3/4) * dt;
      } else { // rk4
        var ka1 = st2.accel;
        var ka2 = computeAccelFull(Math.max(0.01, v + ka1 * dt / 2)).accel;
        var ka3 = computeAccelFull(Math.max(0.01, v + ka2 * dt / 2)).accel;
        var ka4 = computeAccelFull(Math.max(0.01, v + ka3 * dt)).accel;
        dv2 = (ka1 + 2 * ka2 + 2 * ka3 + ka4) / 6 * dt;
      }
      v += dv2;
      if(v < 0) v = 0;
      dist += 0.5 * (v_old + v) * dt;
      
      // Enerji dengesi (klasik solverlar)
      energyTracker.addStep(v_old, v, dt, st2.F_engine, st2.F_rolling, st2.F_aero, st2.F_grade);
    }
    
    // Durma kontrolü
    if(timeMode === 'stop' && v < stopSpeed && step2 > 0) break;
    // Segment bazlı: güzergah tamamlandı mı?
    if(isSegmentMode && dist >= segmentTotalDist && step2 > 0) {
      solverStats.events.push({ t: t2, type: 'route_end', dist: dist });
      break;
    }
  }
  
  solverStats.steps = steps2;
  
  } // ← else bloğu sonu (klasik solverlar)
  
  // ====== ENERJİ DENGESİ SONUCU ======
  solverStats.energyError = energyTracker.getError(v);
  
  return {
    time: timeArr,
    mode: 'full',
    chainNodeIds: chain.map(function(n) { return n.id; }),
    nodeData: nodeData,
    // Legacy uyumluluk
    speed: res_speed,
    rpm: res_rpm,
    engineTorque: res_engineTorque,
    F_grade: res_F_grade,
    F_rolling: res_F_rolling,
    F_aero: res_F_aero,
    F_net: res_F_net,
    distance: res_distance,
    accel: res_accel,
    // Yeni: solver istatistikleri
    solverStats: solverStats
  };
}

