// ════════════════════════════════════════════════════════════════════════════
// SEGMENT BAZLI SÜRÜŞ ANALİZİ (HIZLANMA-YAVAŞLAMA)
// ════════════════════════════════════════════════════════════════════════════
// Her segmentte "Tam gaz" veya "Gaz kesme" komutu uygulanır.
// Segment sınırlarında hız sürekli, eğim ve komut süreksiz.
// Entegratör her segment sınırında sıfırlanır (restart).
// ════════════════════════════════════════════════════════════════════════════

function veFTRunSegmentDrive(segments, initSpeed_kmh, transferRangeOverride) {
  if(!segments || segments.length === 0) throw new Error('Segment verisi bulunamadı');

  // ── BİLEŞEN DÜĞÜMLERİNİ BUL ──
  var chain = veGetPowertrainChain();
  if(chain.length === 0) throw new Error('Güç aktarma zinciri bulunamadı');

  var engineNode = chain.find(function(n) { return n.type === 'engine'; });
  var tcNode = chain.find(function(n) { return n.type === 'torque-converter'; });
  var gearboxNode = chain.find(function(n) { return n.type === 'gearbox'; });
  var propshaftNodes = chain.filter(function(n) { return n.type === 'propshaft'; });
  var transferNode = chain.find(function(n) { return n.type === 'transfer'; });
  var diffNode = chain.find(function(n) { return n.type === 'differential' && n.isMasterDiff; })
                || chain.find(function(n) { return n.type === 'differential'; });
  var wheelNode = chain.find(function(n) { return n.type === 'wheel' && n.isMasterWheel; })
                || chain.find(function(n) { return n.type === 'wheel'; });
  var vehicleNode = nodes.find(function(n) { return n.type === 'vehicle'; });
  var solverNode = nodes.find(function(n) { return n.type === 'solver'; });

  if(!engineNode) throw new Error('Motor bileşeni eksik');
  if(!vehicleNode) throw new Error('Araç bileşeni eksik');
  if(!wheelNode) throw new Error('Tekerlek bileşeni eksik');

  for(var _vi = 0; _vi < 4; _vi++) veResetChartView(_vi);

  // ── MOTOR PARAMETRELERİ ──
  var ed = engineNode.data || {};
  var specs = ed.motorSpecs || {};
  var torqueTable = ed.torqueData || [];
  if(torqueTable.length < 2) throw new Error('Motor tork tablosu eksik');

  var governedSpeed = parseFloat(specs.governedSpeed) || parseFloat(ed.governedRpm) || 2100;
  var noLoadGoverned = parseFloat(specs.noLoadGoverned) || 2350;
  var idleRpm = parseFloat(specs.idleRpm) || 700;
  var I_engine = parseFloat(specs.inertia) || 1.431;
  var displacement_L = parseFloat(specs.displacement) || 7.0;
  var V_d_m3 = displacement_L / 1000; // Motor hacmi [m³]
  var mechanicalLimit = governedSpeed * 1.30; // Motorun mekanik devir sınırı

  var grossMotorTorqueFn = FT_SOLVER.createMotorTorqueFn(torqueTable, governedSpeed, noLoadGoverned);

  // ── AKSESUAR KAYIPLARI ──
  var accList = ed.accessories || [];
  var accTotalFanLoss = 0, accTotalOtherLoss = 0;
  var accFanMode = 'clutch';
  accList.forEach(function(a) {
    var loss = parseFloat(a.userLoss) || 0;
    if(loss <= 0) return;
    if(a.name && a.name.toLowerCase().indexOf('fan') >= 0) {
      accTotalFanLoss += loss;
      if(a.fanMode) accFanMode = a.fanMode;
    } else accTotalOtherLoss += loss;
  });
  var hasAccessoryLoss = (accTotalFanLoss + accTotalOtherLoss) > 0;

  function motorTorqueFn(rpm) {
    var T_gross = grossMotorTorqueFn(rpm);
    if(!hasAccessoryLoss || rpm <= 0) return T_gross;
    var ratio = rpm / governedSpeed;
    var P_fan_kW = (accFanMode === 'on') ? accTotalFanLoss : accTotalFanLoss * ratio * ratio * ratio;
    var P_loss_kW = P_fan_kW + accTotalOtherLoss * ratio;
    var omega = 2 * Math.PI * rpm / 60;
    return Math.max(0, T_gross - P_loss_kW * 1000 / omega);
  }

  // ── TORK KONVERTÖRÜ ──
  var tcd = tcNode ? (tcNode.data || {}) : {};
  var tcDataArr = tcd.tcData || [];
  var pumpTorqueDrop = tcd.pumpTorqueDrop !== undefined ? parseFloat(tcd.pumpTorqueDrop) : 17.6;
  var I_conv = 0.5, I_conv_turbine = 0.3;
  var tcFns = FT_SOLVER.createTCFunctions(tcDataArr);
  var hasTCData = tcDataArr.length >= 2;

  // ── ŞANZIMAN ──
  var gbd = gearboxNode ? (gearboxNode.data || {}) : {};
  var ftGearData = gbd.ftGearData || VE_FT_GB_DEFAULT_GEARS;
  var forwardGears = ftGearData.filter(function(g) { return g.name && g.name.charAt(0) !== 'R'; });
  if(forwardGears.length === 0) throw new Error('İleri vites verisi bulunamadı');

  var shiftProfile = gbd.shiftProfile || 'allison3200sp_s1';
  var spData = VE_FT_SHIFT_PROFILES[shiftProfile] || { lockupOffset: 75, shift1C2C_outRatio: 0.2150, shift2C2L_outRatio: 0.3594 };
  var lockupOffset = spData.lockupOffset || 75;
  var shiftRefRPM = spData.shiftRefRPM || gbd.shiftRefRPM || governedSpeed;
  var SHIFT_1C_2C_OUT_RATIO = spData.shift1C2C_outRatio || 0.2150;
  var SHIFT_2C_2L_OUT_RATIO = spData.shift2C2L_outRatio || 0.3594;
  var N_shift_lockup = shiftRefRPM - lockupOffset;
  var I_trans = 1.0;

  var csData = spData.converterShifts || null;
  var dsData = spData.downshiftThresholds || null;

  function _sdCalcDownshiftThreshold(ds, esl) {
    if(!ds) return 0;
    if(ds.type === 'piecewise') {
      if(esl <= ds.breakpoint) return ds.low.a * esl + (ds.low.b || 0);
      return ds.high.a * esl + (ds.high.b || 0);
    }
    if(ds.type === 'segments') {
      for(var si = 0; si < ds.segments.length; si++) {
        var seg = ds.segments[si];
        if(seg.maxESL !== undefined && esl <= seg.maxESL) {
          return seg.cap !== undefined ? seg.cap : (seg.a * esl + (seg.b || 0));
        }
        if(si === ds.segments.length - 1) {
          return seg.cap !== undefined ? seg.cap : (seg.a * esl + (seg.b || 0));
        }
      }
    }
    if(ds.capValue !== undefined && ds.capBelow !== undefined && esl < ds.capBelow) {
      return ds.capValue;
    }
    var thr = ds.a * esl + (ds.b || 0);
    if(ds.minCap !== undefined) thr = Math.max(thr, ds.minCap);
    return thr;
  }

  function _sdCalc2C2LThreshold(esl) {
    if(!csData || !csData['2C2L']) return SHIFT_2C_2L_OUT_RATIO * esl;
    var cs2L = csData['2C2L'];
    if(cs2L.type === 'segmented') {
      if(esl >= cs2L.linear.validFrom) return cs2L.linear.a * esl + cs2L.linear.b;
      var lk = cs2L.lookup;
      if(!lk || lk.length === 0) return cs2L.linear.a * esl + cs2L.linear.b;
      if(esl <= lk[0][0]) return lk[0][1];
      if(esl >= lk[lk.length - 1][0]) return lk[lk.length - 1][1];
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

  // ── PROPŞAFT ──
  var psEff = 1.0, I_propshaft = 0.0;
  propshaftNodes.forEach(function(ps) {
    var psd = ps.data || {};
    psEff *= (parseFloat(psd.psEff) || 98.60) / 100;
    I_propshaft += parseFloat(psd.psInertia) || 0.5;
  });
  var i_propshaft = 1.0;

  // ── TRANSFER CASE ──
  var trd = transferNode ? (transferNode.data || {}) : {};
  var ftTrGears = trd.ftTrGears || [
    { kademe: 'High', ratio: 1.054, eff: 97.00 },
    { kademe: 'Low', ratio: 2.337, eff: 97.00 }
  ];
  var ftTrActive = transferRangeOverride || ftTrGears[0].kademe;
  var activeTransfer = ftTrGears.find(function(r) { return r.kademe === ftTrActive; }) || ftTrGears[0];
  var i_transfer = parseFloat(activeTransfer.ratio || activeTransfer.oran) || 1.054;
  var eta_transfer = (parseFloat(activeTransfer.eff || activeTransfer.verim) || 97) / 100;
  var I_tc = 0.3;

  // ── DİFERANSİYEL ──
  var dfd = diffNode ? (diffNode.data || {}) : {};
  var i_axle = parseFloat(dfd.diffRatio) || 6.54;
  var eta_axle = (parseFloat(dfd.efficiency) || 96) / 100;
  var I_axle_inertia = parseFloat(dfd.diffInertia) || 1.0;

  // ── TEKERLEK ──
  var wd = wheelNode ? (wheelNode.data || {}) : {};
  var r_tire = parseFloat(wd.ftTireRadius) || 0.573;
  var I_tire = parseFloat(wd.ftTireInertia) || 56.0;
  var Crr = parseFloat(wd.ftCrr) || 0.0035;
  var surfFactor = parseFloat(wd.ftSurfaceFactor) || 1.00;

  // ── ARAÇ ──
  var vd = vehicleNode.data || {};
  var m_vehicle = parseFloat(vd.ftGVW) || 14900;
  var drivenPct = (parseFloat(vd.ftDrivenWeight) || 100) / 100;
  var A_frontal = (parseFloat(vd.ftHeight) || 3.200) * (parseFloat(vd.ftWidth) || 2.500);
  var Cd = parseFloat(vd.ftCd) || 0.900;
  var F_grip = 0.70 * m_vehicle * drivenPct * 9.81;

  // ── DİNAMİK HAVA YOĞUNLUĞU (ISA MODELİ) ──
  // Yol bileşeninden başlangıç yüksekliğini al, yoksa araç verisindeki rho'yu kullan
  var roadNode = nodes.find(function(n) { return n.type === 'road'; });
  var rdData = roadNode ? (roadNode.data || {}) : {};
  var _isaP0 = 101325, _isaT0 = 288.15, _isaL = 0.0065, _isaR = 287.05, _isaG = 9.80665;
  var _isaTamb = 20; // Varsayılan ortam sıcaklığı [°C]
  var currentAltitude = parseFloat(rdData.altitude) || 0;
  function calcISADensity(h) {
    var Tk = _isaTamb + 273.15;
    var P = _isaP0 * Math.pow(1 - _isaL * h / _isaT0, _isaG / (_isaR * _isaL));
    return P / (_isaR * Tk);
  }
  var rho = calcISADensity(currentAltitude);

  // ── ÇÖZÜCÜ ──
  var sd = solverNode ? (solverNode.data || {}) : {};
  var dt = parseFloat(sd.ftDt) || 0.01;
  var method = sd.method || 'rk4';
  // Segment sayısına göre maxTime — her segment için en az 60s ayır
  var baseMaxTime = parseFloat(sd.maxSimTime) || 300;
  var maxTime = Math.max(baseMaxTime, segments.length * 60);

  // ═══ VİTES GEÇİŞ DURUMU MAKİNESİ ═══
  var shiftState = { gearIdx: 0, isLockup: false, shiftHistory: [] };

  function getCurrentGearData() {
    return forwardGears[shiftState.gearIdx] || forwardGears[0];
  }

  function checkShift(t_s, N_engine, SR, tau, v_kmh, ph, command) {
    var g = shiftState.gearIdx, isLU = shiftState.isLockup, maxGear = forwardGears.length - 1, shifted = false;

    // ── UPSHIFT (sadece tam gaz modda) ──
    if(command !== 'coast') {
      if(!isLU) {
        var i_gc = parseFloat(getCurrentGearData().ratio) || 1.0;
        var N_out = N_engine * SR / i_gc;
        if(g === 0) {
          var th1C = (csData && csData['1C2C']) ? csData['1C2C'].a * shiftRefRPM + (csData['1C2C'].b || 0) : SHIFT_1C_2C_OUT_RATIO * shiftRefRPM;
          if(N_out >= th1C) { shiftState.shiftHistory.push({t:t_s,fromGear:g,toGear:1,fromMode:'1C',toMode:'2C',v_kmh:v_kmh,N_engine:N_engine,SR:SR,N_out:N_out}); shiftState.gearIdx = 1; shifted = true; }
        } else if(g === 1) {
          if(N_out >= _sdCalc2C2LThreshold(shiftRefRPM)) { shiftState.shiftHistory.push({t:t_s,fromGear:1,toGear:1,fromMode:'2C',toMode:'2L',v_kmh:v_kmh,N_engine:N_engine,SR:SR,N_out:N_out,eta:SR*tau}); shiftState.isLockup = true; shifted = true; }
        }
      } else if(g < maxGear) {
        var i_glu = parseFloat(getCurrentGearData().ratio) || 1.0;
        var N_out_lu = N_engine / i_glu;
        var fN = (g+1)+'L', tN = (g+2)+'L', sK = fN+tN, triggered = false;
        if(spData.lockupShifts && spData.lockupShifts[sK]) { var ls = spData.lockupShifts[sK]; var thlu = ls.a*shiftRefRPM+ls.b; if(ls.minCap!==undefined) thlu=Math.max(thlu,ls.minCap); if(N_out_lu>=thlu) triggered=true; }
        else { if(N_engine>=N_shift_lockup) triggered=true; }
        if(triggered) { shiftState.shiftHistory.push({t:t_s,fromGear:g,toGear:g+1,fromMode:fN,toMode:tN,v_kmh:v_kmh,N_engine:N_engine,SR:SR,N_out:N_out_lu}); shiftState.gearIdx=g+1; shifted=true; }
      }
    }

    // ── DOWNSHIFT (her iki modda da) ──
    if(!shifted && dsData && g > 0) {
      var tractionDeficit = ph && ph.F_traction < ph.F_resist;

      if(isLU) {
        // Lockup modda downshift
        var i_gear_ds = parseFloat(getCurrentGearData().ratio) || 1.0;
        var N_out_ds = N_engine / i_gear_ds;
        var dsKey = (g + 1) + 'to' + g;
        var dsEntry = dsData[dsKey];

        if(dsEntry && tractionDeficit) {
          var dsThreshold = _sdCalcDownshiftThreshold(dsEntry, shiftRefRPM);
          if(N_out_ds < dsThreshold) {
            // Over-rev koruması: alt viteste motor governed'ı aşar mı?
            if(g > 0) {
              var i_lower = parseFloat(forwardGears[g - 1].ratio) || 1.0;
              var N_eng_after = N_out_ds * i_lower;
              if(N_eng_after > governedSpeed * 1.05) {
                return false; // Over-rev riski
              }
            }

            var dsFromName = (g + 1) + 'L';
            var dsToName = g + 'L';
            if(g === 1) {
              dsToName = '1C';
              shiftState.isLockup = false;
            }

            shiftState.shiftHistory.push({
              t: t_s, fromGear: g, toGear: g - 1,
              fromMode: dsFromName, toMode: dsToName,
              v_kmh: v_kmh, N_engine: N_engine, SR: 1.0, N_out: N_out_ds,
              isDownshift: true,
              F_traction: ph ? ph.F_traction : 0,
              F_resist: ph ? ph.F_resist : 0
            });
            shiftState.gearIdx = g - 1;
            shifted = true;
          }
        }
      } else if(g === 1) {
        // Converter modda 2C → 1C downshift
        var i_gear_conv = parseFloat(getCurrentGearData().ratio) || 1.0;
        var N_out_conv = N_engine * SR / i_gear_conv;
        var dsEntry2C = dsData['2to1'];

        if(dsEntry2C && tractionDeficit) {
          var dsThreshold2C = _sdCalcDownshiftThreshold(dsEntry2C, shiftRefRPM);
          if(N_out_conv < dsThreshold2C) {
            shiftState.shiftHistory.push({
              t: t_s, fromGear: 1, toGear: 0,
              fromMode: '2C', toMode: '1C',
              v_kmh: v_kmh, N_engine: N_engine, SR: SR, N_out: N_out_conv,
              isDownshift: true,
              F_traction: ph ? ph.F_traction : 0,
              F_resist: ph ? ph.F_resist : 0
            });
            shiftState.gearIdx = 0;
            shifted = true;
          }
        }
      }
    }

    return shifted;
  }

  // ═══ BAŞLANGIÇ HIZINDAN VİTES BELİRLEME ═══
  function initializeFromSpeed(v_ms) {
    if(v_ms < 0.1) { shiftState.gearIdx = 0; shiftState.isLockup = false; return; }
    for(var gi = forwardGears.length - 1; gi >= 0; gi--) {
      var i_g = parseFloat(forwardGears[gi].ratio) || 1.0;
      var N_eng = FT_SOLVER.speedToTurbineRpm(v_ms, i_g, i_propshaft, i_transfer, i_axle, r_tire);
      if(N_eng >= idleRpm && N_eng <= governedSpeed + 200) { shiftState.gearIdx = gi; shiftState.isLockup = true; return; }
    }
    shiftState.gearIdx = 0;
    shiftState.isLockup = (v_ms > 2.0);
  }

  // Aktif segment eğimi
  var active_grade_pct = 0;

  // ═══ PER-STEP FİZİK ═══
  var LOCKUP_HEAT_COEFFICIENTS = {
    1:{a:0.002995,b:0.5519}, 2:{a:0.002995,b:0.5519}, 3:{a:0.003071,b:0.0304},
    4:{a:0.003470,b:-2.1427}, 5:{a:0.004852,b:-1.9591}, 6:{a:0.006967,b:-4.1326}
  };

  function calcStepPhysics(v_ms, command) {
    if(v_ms < 0) v_ms = 0;
    var gearData = getCurrentGearData();
    var i_gear = parseFloat(gearData.ratio) || 1.0;
    var isLU = shiftState.isLockup;
    var isCoast = (command === 'coast');

    var N_engine, T_engine, T_output, T_pump, SR, tau, tcEta, heatRejection_kW = 0;

    if(!hasTCData || isLU) {
      N_engine = FT_SOLVER.speedToTurbineRpm(v_ms, i_gear, i_propshaft, i_transfer, i_axle, r_tire);
      if(N_engine < idleRpm) N_engine = idleRpm;
      if(isCoast) { T_engine = 0; T_pump = 0; T_output = 0; }
      else {
        T_engine = motorTorqueFn(N_engine);
        // (b) Governed üstünde motor motoring direnci (kompresyon + sürtünme + pompalama)
        // motorTorqueFn daima ≥ 0 döndürür, ama noLoadGoverned üstünde yakıt kesilir
        // ve tekerlekler motoru sürer → kompresör gibi çalışır → negatif tork
        if(N_engine > noLoadGoverned && T_engine <= 0) {
          var BMEP_mot = 50000; // 50 kPa bazal motoring basıncı
          // (a) Mekanik limit: governed×1.30 üstünde sert duvar
          if(N_engine > mechanicalLimit) {
            var overRevFrac = Math.min((N_engine - mechanicalLimit) / 200, 5.0);
            BMEP_mot *= (1 + 10 * overRevFrac);
          }
          T_engine = -(BMEP_mot * V_d_m3 / (4 * Math.PI));
        }
        T_pump = T_engine - pumpTorqueDrop;
        var T_net_lu2 = T_pump - (10.0 + 0.00367 * N_engine);
        // (b) Negatif T_net = motor freni — clamping kaldırıldı
        // Governed üstünde veya yüksek TC kayıplarında motor enerji emer
        var eta_lockup2 = tcd.etaLockup || 0.965;
        T_output = T_net_lu2 * eta_lockup2;
      }
      SR = 1.0; tau = 1.0;
      var eta_lu2_val = tcd.etaLockup || 0.965;
      tcEta = isCoast ? 1.0 : eta_lu2_val;
      // Per-gear RPM-bağımlı lockup HR (iSCAAN uyumu)
      var gearNum2 = shiftState.gearIdx + 1;
      var hrCoeff2 = LOCKUP_HEAT_COEFFICIENTS[gearNum2] || LOCKUP_HEAT_COEFFICIENTS[2];
      heatRejection_kW = isCoast ? 0 : Math.max(0, hrCoeff2.a * N_engine + hrCoeff2.b);
    } else {
      var N_turbine = FT_SOLVER.speedToTurbineRpm(v_ms, i_gear, i_propshaft, i_transfer, i_axle, r_tire);
      if(N_turbine < 0) N_turbine = 0;
      if(isCoast) {
        N_engine = N_turbine > 0 ? N_turbine * 1.05 : idleRpm;
        T_engine = 0; T_pump = 0; T_output = 0;
        SR = N_turbine > 0 ? N_turbine / N_engine : 0;
        tau = tcFns.tau(SR); tcEta = SR * tau;
      } else {
        var tcR = FT_SOLVER.solveTCOperatingPoint(N_turbine, motorTorqueFn, tcFns, pumpTorqueDrop, {N_min:idleRpm, N_max:noLoadGoverned+100});
        N_engine = tcR.N_engine; T_engine = tcR.T_engine; T_pump = tcR.T_pump;
        var T_turb_raw2 = tcR.T_turbine;
        var eta_ci2 = tcd.etaConvInternal || 0.975;
        T_output = T_turb_raw2 * eta_ci2;
        SR = tcR.SR; tau = tcR.tau; tcEta = tcR.eta * eta_ci2;
      }
      var omE = N_engine * 2 * Math.PI / 60;
      if(isCoast) {
        heatRejection_kW = 0;
      } else {
        var P_heat_conv2 = T_pump > 0 ? Math.max(0, T_pump * omE * (1 - SR * tau) / 1000) : 0;
        var P_turb2_kW = T_turb_raw2 * (N_engine * SR) * 2 * Math.PI / 60 / 1000;
        var P_heat_gm2 = P_turb2_kW * (1 - (tcd.etaConvInternal || 0.975));
        heatRejection_kW = P_heat_conv2 + Math.max(0, P_heat_gm2);
      }
    }

    // Motor sürükleme kuvveti (coast modunda motor kompresyon direnci)
    // Motor tekerlek tarafından çevriliyor: kompresyon + sürtünme + pompa kaybı
    // Ampirik: T_drag ≈ 0.025 × V_displacement × (N/1000)  [Nm]
    // Basitleştirilmiş: BMEP motoring ≈ 40-80 kPa (tipik dizel)
    var F_engine_drag = 0;
    if(isCoast && v_ms > 0.5) {
      // RPM-bağımlı motoring torku: sürtünme ve pompalama kayıpları devirle artar
      var rpmRatio = N_engine / governedSpeed;
      var BMEP_coast = 50000 * (0.5 + 0.5 * rpmRatio); // ~25 kPa @ idle, 50 kPa @ governed
      // Mekanik limit: governed×1.30 üstünde sert duvar
      if(N_engine > mechanicalLimit) {
        var overRevFrac_c = Math.min((N_engine - mechanicalLimit) / 200, 5.0);
        BMEP_coast *= (1 + 10 * overRevFrac_c);
      }
      var T_motoring = BMEP_coast * V_d_m3 / (4 * Math.PI);
      var i_total_coast = i_gear * i_propshaft * i_transfer * i_axle;
      F_engine_drag = T_motoring * i_total_coast / r_tire;
    }

    // Evrensel dişli verimi
    var _N_turb_eff2 = isLU ? N_engine : (N_engine * SR);
    var eta_gear = FT_SOLVER.calcGearEfficiency(i_gear, _N_turb_eff2);

    // (c) Negatif F_traction = motor freni → driving grip limiti uygulanmaz
    var F_traction_raw = isCoast ? 0 : FT_SOLVER.calcTractiveEffort(
      T_output, i_gear, 1.0, i_propshaft, psEff, i_transfer, eta_transfer, i_axle, eta_axle, r_tire
    );
    var F_traction = F_traction_raw < 0 ? F_traction_raw : FT_SOLVER.limitByGrip(F_traction_raw, F_grip);

    var resist = FT_SOLVER.calcResistForces(v_ms, { m: m_vehicle, Crr: Crr, surfFactor: surfFactor, Cd: Cd, A: A_frontal, rho: rho, grade_pct: active_grade_pct });
    var F_net = F_traction - resist.F_total - F_engine_drag;

    var mEff = FT_SOLVER.calcEquivalentMass({
      m_vehicle: m_vehicle, r_tire: r_tire, i_gear: i_gear, i_propshaft: i_propshaft, i_transfer: i_transfer, i_axle: i_axle,
      I_engine: I_engine, I_conv: I_conv, I_conv_turbine: I_conv_turbine, I_trans: I_trans, I_propshaft: I_propshaft,
      I_tc: I_tc, I_axle: I_axle_inertia, I_tire: I_tire, isLockup: isLU
    });

    return {
      accel: F_net / mEff.m_eff, N_engine: N_engine, T_engine: T_engine, T_pump: T_pump || 0,
      T_output: T_output, SR: SR, tau: tau, tcEta: tcEta, heatRejection_kW: heatRejection_kW,
      F_traction: F_traction, F_engine_drag: F_engine_drag, F_rolling: resist.F_rolling, F_aero: resist.F_aero,
      F_grade: resist.F_grade, F_resist: resist.F_total, F_net: F_net,
      m_eff: mEff.m_eff, i_gear: i_gear, eta_gear: eta_gear,
      gearIdx: shiftState.gearIdx, gearName: gearData.name, isLockup: isLU, command: command
    };
  }

  // ═══ SONUÇ DİZİLERİ ═══
  var timeArr = [], res_speed = [], res_rpm = [], res_engineTorque = [], res_accel = [];
  var res_F_grade = [], res_F_rolling = [], res_F_aero = [], res_F_net = [], res_distance = [];
  var res_gearMode = [], res_SR = [], res_TE = [], res_DP = [];
  var res_segment = [], res_command = [], res_heatRej = [], res_T_output = [];
  var res_P_engine = [], res_P_wheel = [], res_F_engine_drag = [];

  var sampleInterval = Math.max(1, Math.round(0.05 / dt));
  var lastSampleStep = -sampleInterval;
  var globalStep = 0;

  function recordStep(t_rec, v_rec, dist_rec, ph, segIdx) {
    timeArr.push(parseFloat(t_rec.toFixed(4)));
    var v_kmh = v_rec * 3.6;
    res_speed.push(v_kmh); res_rpm.push(ph.N_engine); res_engineTorque.push(ph.T_engine);
    res_F_grade.push(ph.F_grade); res_F_rolling.push(ph.F_rolling); res_F_aero.push(ph.F_aero);
    res_F_net.push(ph.F_net); res_distance.push(dist_rec); res_accel.push(ph.accel);
    var gNum = ph.gearName.replace(/[^0-9]/g, '');
    res_gearMode.push(gNum + (ph.isLockup ? 'L' : 'C'));
    res_SR.push(ph.isLockup ? 1.0 : ph.SR);
    res_TE.push(ph.F_traction / 1000);
    res_DP.push((ph.F_traction - Math.abs(ph.F_rolling) - Math.abs(ph.F_aero)) / 1000);
    res_segment.push(segIdx); res_command.push(ph.command || 'full_throttle');
    res_heatRej.push(ph.heatRejection_kW); res_T_output.push(ph.T_output);
    res_F_engine_drag.push(ph.F_engine_drag || 0);
    var omE = ph.N_engine * 2 * Math.PI / 60;
    res_P_engine.push(ph.T_engine * omE / 1000); res_P_wheel.push(ph.F_traction * v_rec / 1000);
  }

  // ═══ ANA SEGMENT DÖNGÜSÜ ═══
  var v = (initSpeed_kmh || 0) / 3.6;
  var t = 0, totalDist = 0;
  var maxSteps = Math.ceil(maxTime / dt);
  var segmentSummary = [];

  initializeFromSpeed(v);

  for(var si = 0; si < segments.length; si++) {
    var seg = segments[si];
    // Harita konvansiyonu: grade > 0 = yokuş aşağı, grade < 0 = yokuş yukarı
    // Fizik motoru konvansiyonu: grade_pct > 0 = yokuş yukarı (direnç artar)
    // İşaret çevirisi gerekli
    active_grade_pct = -(seg.grade || 0);
    var seg_dist = seg.distance || 0;
    var seg_command = seg.command || 'full_throttle';

    // İrtifa değişimine göre hava yoğunluğunu güncelle (ISA modeli)
    // deltaH konvansiyonu: pozitif = iniş (yükseklik azalır), negatif = çıkış (yükseklik artar)
    // Gerçek irtifa değişimi = -deltaH (iniş → irtifa düşer, çıkış → irtifa artar)
    if(seg.deltaH) {
      currentAltitude -= seg.deltaH;
      rho = calcISADensity(Math.max(0, currentAltitude));
    }

    var segStartSpeed = v * 3.6, segStartTime = t, segDist = 0;
    var segMaxSpeed = v * 3.6, segMinSpeed = v * 3.6;
    var segStartGear = res_gearMode.length > 0 ? res_gearMode[res_gearMode.length - 1] : ((shiftState.gearIdx + 1) + (shiftState.isLockup ? 'L' : 'C'));
    var segDownshiftCount = 0;

    var stallCounter = 0;
    while(segDist < seg_dist && globalStep < maxSteps) {
      var ph = calcStepPhysics(v, seg_command);

      if(globalStep - lastSampleStep >= sampleInterval || globalStep === 0) {
        recordStep(t, v, totalDist + segDist, ph, si);
        lastSampleStep = globalStep;
      }

      // Her iki modda da shift kontrolü yap (upshift sadece full_throttle, downshift her ikisinde)
      var shiftHistLenBefore = shiftState.shiftHistory.length;
      checkShift(t, ph.N_engine, ph.SR, ph.tau, v * 3.6, ph, seg_command);
      // Downshift sayacını güncelle
      if(shiftState.shiftHistory.length > shiftHistLenBefore) {
        var lastShift = shiftState.shiftHistory[shiftState.shiftHistory.length - 1];
        if(lastShift.isDownshift) segDownshiftCount++;
      }

      // Entegrasyon
      var dv;
      if(method === 'euler') { dv = ph.accel * dt; }
      else if(method === 'heun') {
        var a2h = calcStepPhysics(v + ph.accel * dt, seg_command).accel;
        dv = (ph.accel + a2h) / 2 * dt;
      } else {
        var k1 = ph.accel;
        var k2 = calcStepPhysics(v + k1 * dt / 2, seg_command).accel;
        var k3 = calcStepPhysics(v + k2 * dt / 2, seg_command).accel;
        var k4 = calcStepPhysics(v + k3 * dt, seg_command).accel;
        dv = (k1 + 2*k2 + 2*k3 + k4) / 6 * dt;
      }

      var v_new = Math.max(0, v + dv);
      segDist += (v + v_new) / 2 * dt;
      v = v_new; t += dt; globalStep++;

      var vk = v * 3.6;
      if(vk > segMaxSpeed) segMaxSpeed = vk;
      if(vk < segMinSpeed) segMinSpeed = vk;

      // Araç durduysa: ivme pozitifse (tam gaz veya yokuş aşağı) devam edebilir,
      // aksi halde bu segmentte ilerleme yok → segmenti bitir (sonrakine geç)
      if(v <= 0.01) {
        if(ph.accel <= 0.001) {
          // Net kuvvet negatif veya sıfır — bu segmentte araç hareket edemez
          v = 0;
          stallCounter++;
          if(stallCounter > 10) break; // Sonsuz döngü koruması
        } else {
          // Pozitif ivme var — sıfıra çekme, kalkışa izin ver
          stallCounter = 0;
        }
      } else {
        stallCounter = 0;
      }
    }

    totalDist += segDist;
    var phEnd = calcStepPhysics(v, seg_command);
    recordStep(t, v, totalDist, phEnd, si);
    lastSampleStep = globalStep;

    var segEndGear = res_gearMode.length > 0 ? res_gearMode[res_gearMode.length - 1] : ((shiftState.gearIdx + 1) + (shiftState.isLockup ? 'L' : 'C'));
    segmentSummary.push({
      segIdx: si, no: seg.no || (si + 1), command: seg_command, grade: seg.grade || 0,
      targetDist: seg_dist, actualDist: segDist,
      startSpeed_kmh: segStartSpeed, endSpeed_kmh: v * 3.6,
      maxSpeed_kmh: segMaxSpeed, minSpeed_kmh: segMinSpeed, duration: t - segStartTime,
      startGear: segStartGear, endGear: segEndGear, downshiftCount: segDownshiftCount,
      altitude: currentAltitude, rho: rho
    });

    if(globalStep >= maxSteps) break;
    // Araç durduysa (v≈0): sonraki segmente geç — tam gaz segmentinde sıfırdan
    // kalkış mümkün, yokuş aşağı gaz kesme segmentinde yerçekimi ile hareket mümkün.
    // Bu yüzden döngüyü kırmıyoruz, sadece sonraki segmentte v=0'dan devam ediyoruz.
  }

  return {
    time: timeArr, mode: 'segment-drive',
    speed: res_speed, rpm: res_rpm, engineTorque: res_engineTorque,
    F_grade: res_F_grade, F_rolling: res_F_rolling, F_aero: res_F_aero, F_net: res_F_net,
    distance: res_distance, accel: res_accel,
    gearMode: res_gearMode, SR: res_SR, TE: res_TE, DP: res_DP,
    heatRejection: res_heatRej, T_output: res_T_output,
    P_engine: res_P_engine, P_wheel: res_P_wheel, F_engine_drag: res_F_engine_drag,
    segment: res_segment, command: res_command, segmentSummary: segmentSummary,
    solverStats: {
      method: method, dt: dt, steps: globalStep, maxTime: maxTime,
      shiftHistory: shiftState.shiftHistory, transferRange: activeTransfer,
      segments: segments.length, totalDistance: totalDist,
      initSpeed_kmh: initSpeed_kmh || 0, finalSpeed_kmh: v * 3.6,
      // Güç aktarma zinciri parametreleri (doğrulama için)
      i_transfer: i_transfer, eta_transfer: eta_transfer,
      i_axle: i_axle, eta_axle: eta_axle,
      r_tire: r_tire, m_vehicle: m_vehicle,
      Crr: Crr, Cd: Cd, A_frontal: A_frontal, rho_initial: calcISADensity(parseFloat(rdData.altitude) || 0), rho_final: rho,
      initAltitude: parseFloat(rdData.altitude) || 0, finalAltitude: currentAltitude, ambientTemp_C: _isaTamb,
      forwardGears: forwardGears.map(function(g) { return {name: g.name, ratio: g.ratio, eff: g.eff}; }),
      finalGear: getCurrentGearData().name,
      finalGearIdx: shiftState.gearIdx,
      isLockup: shiftState.isLockup,
      governedSpeed: governedSpeed,
      noLoadGoverned: noLoadGoverned,
      mechanicalLimit: mechanicalLimit
    }
  };
}

