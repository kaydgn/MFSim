// ============================================================================
// FULL THROTTLE SOLVER — ÇEKIRDEK MATEMATİK FONKSİYONLARI
// ============================================================================
// Tam gaz hızlanma simülasyonu için tüm matematiksel alt yapı.
// Motor-konvertör eşleştirmesi, eşdeğer kütle, PCHIP interpolasyon.
// Mevcut motor freni solver'ından bağımsız çalışır.
// ============================================================================

var FT_SOLVER = (function() {
  'use strict';

  // ═══════════════════════════════════════════════════════════════════════════
  // 1. PCHIP SPLINE İNTERPOLASYON
  // ═══════════════════════════════════════════════════════════════════════════

  function pchipCreate(xs, ys) {
    var n = xs.length;
    if(n < 2) throw new Error('PCHIP: en az 2 veri noktası gerekli');
    if(n === 2) {
      var slope = (ys[1] - ys[0]) / (xs[1] - xs[0]);
      return { xs: xs, ys: ys, ds: [slope, slope] };
    }
    var deltas = [], hs = [];
    for(var i = 0; i < n - 1; i++) {
      hs.push(xs[i + 1] - xs[i]);
      deltas.push((ys[i + 1] - ys[i]) / hs[i]);
    }
    var ds = new Array(n);
    ds[0] = deltas[0];
    ds[n - 1] = deltas[n - 2];
    for(var i = 1; i < n - 1; i++) {
      if(deltas[i - 1] * deltas[i] <= 0) {
        ds[i] = 0;
      } else {
        var w1 = 2 * hs[i] + hs[i - 1];
        var w2 = hs[i] + 2 * hs[i - 1];
        ds[i] = (w1 + w2) / (w1 / deltas[i - 1] + w2 / deltas[i]);
      }
    }
    if(n >= 3) {
      ds[0] = _pchipEndSlope(hs[0], hs[1], deltas[0], deltas[1]);
      ds[n - 1] = _pchipEndSlope(hs[n - 2], hs[n - 3], deltas[n - 2], deltas[n - 3]);
    }
    return { xs: xs, ys: ys, ds: ds };
  }

  function _pchipEndSlope(h1, h2, del1, del2) {
    var d = ((2 * h1 + h2) * del1 - h1 * del2) / (h1 + h2);
    if(d * del1 < 0) d = 0;
    else if(del1 * del2 < 0 && Math.abs(d) > 3 * Math.abs(del1)) d = 3 * del1;
    return d;
  }

  function pchipEval(spline, x) {
    var xs = spline.xs, ys = spline.ys, ds = spline.ds;
    var n = xs.length;
    if(x <= xs[0]) return ys[0];
    if(x >= xs[n - 1]) return ys[n - 1];
    var lo = 0, hi = n - 1;
    while(hi - lo > 1) {
      var mid = (lo + hi) >> 1;
      if(xs[mid] > x) hi = mid; else lo = mid;
    }
    var h = xs[hi] - xs[lo];
    var t = (x - xs[lo]) / h;
    var t2 = t * t, t3 = t2 * t;
    return (2*t3 - 3*t2 + 1) * ys[lo] + (t3 - 2*t2 + t) * h * ds[lo]
         + (-2*t3 + 3*t2) * ys[hi] + (t3 - t2) * h * ds[hi];
  }

  function lerpTable(table, xKey, yKey, xVal) {
    if(!table || table.length === 0) return 0;
    if(table.length === 1) return table[0][yKey];
    if(xVal <= table[0][xKey]) return table[0][yKey];
    if(xVal >= table[table.length - 1][xKey]) return table[table.length - 1][yKey];
    for(var i = 0; i < table.length - 1; i++) {
      if(xVal >= table[i][xKey] && xVal <= table[i + 1][xKey]) {
        var t = (xVal - table[i][xKey]) / (table[i + 1][xKey] - table[i][xKey]);
        return table[i][yKey] + t * (table[i + 1][yKey] - table[i][yKey]);
      }
    }
    return table[table.length - 1][yKey];
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 2. MOTOR TORK İNTERPOLASYON FABRİKASI
  // ═══════════════════════════════════════════════════════════════════════════

  function createMotorTorqueFn(torqueData, governedSpeed, noLoadGoverned) {
    if(!torqueData || torqueData.length < 2) return function() { return 0; };
    var sorted = torqueData.slice().sort(function(a, b) { return a.rpm - b.rpm; });
    var rpms = sorted.map(function(d) { return d.rpm; });
    var torques = sorted.map(function(d) { return d.torque; });
    var spline = pchipCreate(rpms, torques);

    return function(rpm) {
      if(rpm <= 0) return 0;
      var T_net = pchipEval(spline, rpm);
      if(noLoadGoverned > governedSpeed && rpm > governedSpeed) {
        if(rpm >= noLoadGoverned) return 0;
        var frac = (rpm - governedSpeed) / (noLoadGoverned - governedSpeed);
        T_net = T_net * (1 - frac);
      }
      return Math.max(0, T_net);
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 3. TORK KONVERTÖRÜ MATEMATİĞİ
  // ═══════════════════════════════════════════════════════════════════════════

  function createTCFunctions(tcData) {
    if(!tcData || tcData.length < 2) {
      return {
        kpump: function() { return 999; }, tau: function() { return 1.0; },
        eta: function(sr) { return sr; }, couplingSR: 0.88, data: []
      };
    }
    var sorted = tcData.slice().sort(function(a, b) { return a.sr - b.sr; });
    var srs = sorted.map(function(d) { return d.sr; });
    var kps = sorted.map(function(d) { return d.kpump; });
    var taus = sorted.map(function(d) { return d.tau; });
    var spKp = pchipCreate(srs, kps);
    var spTau = pchipCreate(srs, taus);

    return {
      kpump: function(sr) { return pchipEval(spKp, Math.max(0, Math.min(0.99, sr))); },
      tau:   function(sr) { return pchipEval(spTau, Math.max(0, Math.min(0.99, sr))); },
      eta:   function(sr) { var s = Math.max(0, Math.min(0.99, sr)); return pchipEval(spTau, s) * s; },
      couplingSR: (function() {
        for(var i = 0; i < sorted.length; i++) { if(sorted[i].tau <= 1.005) return sorted[i].sr; }
        return 0.88;
      })(),
      data: sorted
    };
  }

  // Motor-Konvertör Eşleştirmesi (Bisection)
  // T_pump_available(N) = T_engine(N) - pumpTorqueDrop
  // T_pump_absorbed(N)  = N² / K_pump(SR)²    (SR = N_turbine / N)
  // Hata = 0 olacak N_engine'i bulur.
  function solveTCOperatingPoint(N_turbine, motorTorqueFn, tcFns, pumpTorqueDrop, options) {
    var opts = options || {};
    var maxIter = opts.maxIter || 50;
    var tol = opts.tol || 0.5;
    var N_min = opts.N_min || 700;
    var N_max = opts.N_max || 2500;

    if(N_turbine <= 0) {
      var K0 = tcFns.kpump(0);
      var N_stall = _findStallSpeed(motorTorqueFn, K0, pumpTorqueDrop, N_min, N_max);
      var T_eng = motorTorqueFn(N_stall);
      var T_pmp = T_eng - pumpTorqueDrop;
      var tau0 = tcFns.tau(0);
      return { N_engine: N_stall, T_engine: T_eng, T_pump: T_pmp,
               T_turbine: T_pmp * tau0, SR: 0, tau: tau0, eta: 0,
               converged: true, iterations: 0 };
    }

    var N_lo = Math.max(N_turbine + 1, N_min), N_hi = N_max;
    function errorFn(N) {
      var sr = Math.min(0.99, Math.max(0, N_turbine / N));
      return (motorTorqueFn(N) - pumpTorqueDrop) - (N * N) / (tcFns.kpump(sr) * tcFns.kpump(sr));
    }
    var f_lo = errorFn(N_lo), f_hi = errorFn(N_hi);

    if(f_lo * f_hi > 0) {
      var bestN = N_lo, bestErr = Math.abs(f_lo);
      for(var p = N_lo; p <= N_hi; p += 50) {
        var fe = Math.abs(errorFn(p));
        if(fe < bestErr) { bestErr = fe; bestN = p; }
      }
      var sr_f = N_turbine / bestN, T_e = motorTorqueFn(bestN), T_p = T_e - pumpTorqueDrop;
      return { N_engine: bestN, T_engine: T_e, T_pump: T_p,
               T_turbine: T_p * tcFns.tau(sr_f), SR: sr_f,
               tau: tcFns.tau(sr_f), eta: tcFns.eta(sr_f),
               converged: false, iterations: -1 };
    }

    var N_mid, f_mid, iter;
    for(iter = 0; iter < maxIter; iter++) {
      N_mid = (N_lo + N_hi) / 2;
      f_mid = errorFn(N_mid);
      if(Math.abs(N_hi - N_lo) < tol || Math.abs(f_mid) < 0.1) break;
      if(f_lo * f_mid < 0) { N_hi = N_mid; f_hi = f_mid; }
      else { N_lo = N_mid; f_lo = f_mid; }
    }
    var N_sol = (N_lo + N_hi) / 2;
    var SR_sol = Math.min(0.99, N_turbine / N_sol);
    var T_eng_sol = motorTorqueFn(N_sol);
    var T_pump_sol = Math.max(0, T_eng_sol - pumpTorqueDrop);
    var tau_sol = tcFns.tau(SR_sol);
    return { N_engine: N_sol, T_engine: T_eng_sol, T_pump: T_pump_sol,
             T_turbine: T_pump_sol * tau_sol, SR: SR_sol, tau: tau_sol,
             eta: tcFns.eta(SR_sol), converged: true, iterations: iter + 1 };
  }

  function _findStallSpeed(motorTorqueFn, K0, drop, N_min, N_max) {
    var lo = N_min, hi = N_max;
    for(var i = 0; i < 40; i++) {
      var mid = (lo + hi) / 2;
      if(motorTorqueFn(mid) - (mid * mid) / (K0 * K0) - drop > 0) lo = mid; else hi = mid;
      if(hi - lo < 0.5) break;
    }
    return (lo + hi) / 2;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 4. EŞDEĞER KÜTLE HESABI (DİNAMİK)
  // ═══════════════════════════════════════════════════════════════════════════
  // Lockup:    I_eff = I_eng×i²_total + I_conv×i²_total + I_trans×i²_down + ...
  // Converter: Motor ataleti devre dışı → I_conv_turbine×i²_total + ...
  // m_eff = m_vehicle + I_eff / r²_tire

  function calcEquivalentMass(p) {
    var i_total = p.i_gear * p.i_propshaft * p.i_transfer * p.i_axle;
    var i_down = p.i_propshaft * p.i_transfer * p.i_axle;
    var r2 = p.r_tire * p.r_tire;
    var I_eff;
    if(p.isLockup) {
      I_eff = p.I_engine * i_total * i_total
            + p.I_conv * i_total * i_total
            + p.I_trans * i_down * i_down
            + p.I_propshaft * i_down * i_down
            + p.I_tc * p.i_axle * p.i_axle
            + p.I_axle + p.I_tire;
    } else {
      I_eff = p.I_conv_turbine * i_total * i_total
            + p.I_trans * i_down * i_down
            + p.I_propshaft * i_down * i_down
            + p.I_tc * p.i_axle * p.i_axle
            + p.I_axle + p.I_tire;
    }
    var m_eff = p.m_vehicle + I_eff / r2;
    return { m_eff: m_eff, I_eff: I_eff, ratio: m_eff / p.m_vehicle };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 5. DİRENÇ KUVVETLERİ
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Hıza bağlı yuvarlanma direnci katsayısı hesaplar.
   * iSCAAN doğrulamasıyla türetilmiş evrensel hız düzeltme faktörü uygular.
   *
   * Fiziksel temel: Lastik viskoelastik deformasyon kayıpları hızla artar.
   * Kaynak: 4 iSCAAN raporu, 71 veri noktası, R² = 0.9994
   * Geçerli aralık: 0–33 m/s (0–120 km/h)
   *
   * @param {number} Crr_static – Kullanıcının girdiği nominal Crr değeri
   * @param {number} V_ms – Araç hızı [m/s]
   * @returns {number} Hıza bağlı efektif Crr değeri
   */
  function getCrrEffective(Crr_static, V_ms) {
    var K1 = 0.026909;       // hız lineer katsayısı [1/(m/s)]
    var K2 = -0.00018893;    // hız kare katsayısı [1/(m/s)²]
    var f = 1.0 + K1 * V_ms + K2 * V_ms * V_ms;
    return Crr_static * f;
  }

  function calcResistForces(v_ms, p) {
    var g = 9.81;
    var gradeRad = Math.atan(p.grade_pct / 100);
    var Crr_eff = getCrrEffective(p.Crr, v_ms);
    var F_rolling = Crr_eff * (p.surfFactor || 1.0) * p.m * g * Math.cos(gradeRad);
    var F_aero = 0.5 * p.rho * p.Cd * p.A * v_ms * v_ms;
    var F_grade = p.m * g * Math.sin(gradeRad);
    return { F_rolling: F_rolling, F_aero: F_aero, F_grade: F_grade,
             F_total: F_rolling + F_aero + F_grade };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 6. DRİVELİNE HESAPLAMALARI
  // ═══════════════════════════════════════════════════════════════════════════

  function speedToTurbineRpm(v_ms, i_gear, i_ps, i_tr, i_axle, r_tire) {
    return (v_ms / r_tire) * (i_gear * i_ps * i_tr * i_axle) * 60 / (2 * Math.PI);
  }

  function turbineRpmToSpeed(N, i_gear, i_ps, i_tr, i_axle, r_tire) {
    var i = i_gear * i_ps * i_tr * i_axle;
    return i > 0 ? N * r_tire * 2 * Math.PI / (i * 60) : 0;
  }

  // Tekerlekteki çekme kuvveti — per-gear verim destekli
  function calcTractiveEffort(T_output, i_gear, eta_gear, i_ps, eta_ps,
                               i_tr, eta_tr, i_axle, eta_axle, r_tire) {
    return T_output * i_gear * eta_gear * i_ps * eta_ps
                    * i_tr * eta_tr * i_axle * eta_axle / r_tire;
  }

  function limitByGrip(F_traction, F_grip) {
    return Math.min(F_traction, F_grip);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 7. AKSESUAR KAYIPLARI — RPM BAZLI
  // ═══════════════════════════════════════════════════════════════════════════
  // Fan: P ∝ N³ (centrifugal) | Diğerleri: P ∝ N (doğrusal)

  function calcAccessoryTorque(rpm, accData) {
    if(!accData || rpm <= 0) return 0;
    var ref = accData.refRpm || 2100;
    var ratio = rpm / ref;
    var P_total = (accData.fanLoss || 0) * ratio * ratio * ratio
                + (accData.otherLoss || 0) * ratio;
    var omega = 2 * Math.PI * rpm / 60;
    return omega > 0 ? P_total * 1000 / omega : 0;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 8. EVRENSEL SANZIMAN DISLI VERIMI
  // ═══════════════════════════════════════════════════════════════════════════
  // η_gear = 1 − |ln(i_gear)| × (0.0175 + 0.00000293 × N_turbine)
  // i_gear = 1.000 (direct drive) → η = 1.000 (kayıpsız)
  // iSCAAN doğrulaması: 7 vites, 2 mod, ≤0.1% hata.
  function calcGearEfficiency(i_gear, N_turbine) {
    if(!i_gear || i_gear === 1.0) return 1.0;
    var absLnRatio = Math.abs(Math.log(i_gear));
    var eta = 1 - absLnRatio * (0.0175 + 0.00000293 * (N_turbine || 0));
    return Math.max(0.90, Math.min(1.0, eta));
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // 9. YARDIMCI
  // ═══════════════════════════════════════════════════════════════════════════
  function msToKmh(v) { return v * 3.6; }
  function kmhToMs(v) { return v / 3.6; }

  // ═══════════════════════════════════════════════════════════════════════════
  // PUBLIC API
  // ═══════════════════════════════════════════════════════════════════════════
  return {
    pchipCreate: pchipCreate, pchipEval: pchipEval, lerpTable: lerpTable,
    createMotorTorqueFn: createMotorTorqueFn,
    createTCFunctions: createTCFunctions, solveTCOperatingPoint: solveTCOperatingPoint,
    calcEquivalentMass: calcEquivalentMass,
    calcResistForces: calcResistForces, calcTractiveEffort: calcTractiveEffort,
    limitByGrip: limitByGrip,
    getCrrEffective: getCrrEffective,
    speedToTurbineRpm: speedToTurbineRpm, turbineRpmToSpeed: turbineRpmToSpeed,
    calcAccessoryTorque: calcAccessoryTorque,
    calcGearEfficiency: calcGearEfficiency,
    msToKmh: msToKmh, kmhToMs: kmhToMs
  };
})();

// ============================================================================
// FULL THROTTLE SİMÜLASYON MOTORU
// ============================================================================
// Tam gaz hızlanma simülasyonu: 1C→2C→2L→3L→4L→5L→6L
// TC bisection eşleştirmesi, per-gear verim, dinamik eşdeğer kütle.
// ============================================================================

function veFTRunSimulationEngine(transferRangeOverride) {
  // ── BİLEŞEN DÜĞÜMLERİNİ BUL ──
  var chain = veGetPowertrainChain();
  if(chain.length === 0) throw new Error('Güç aktarma zinciri bulunamadı');

  var engineNode = chain.find(function(n) { return n.type === 'engine'; });
  var tcNode = chain.find(function(n) { return n.type === 'torque-converter'; });
  var gearboxNode = chain.find(function(n) { return n.type === 'gearbox'; });
  var shiftCtrlNode = nodes.find(function(n) { return n.type === 'shift-controller'; });
  var propshaftNodes = chain.filter(function(n) { return n.type === 'propshaft'; });
  var transferNode = chain.find(function(n) { return n.type === 'transfer'; });
  var diffNode = chain.find(function(n) { return n.type === 'differential' && n.isMasterDiff; })
                || chain.find(function(n) { return n.type === 'differential'; });
  var wheelNode = chain.find(function(n) { return n.type === 'wheel' && n.isMasterWheel; })
                || chain.find(function(n) { return n.type === 'wheel'; });
  var vehicleNode = nodes.find(function(n) { return n.type === 'vehicle'; });
  var roadNode = nodes.find(function(n) { return n.type === 'road'; });
  var solverNode = nodes.find(function(n) { return n.type === 'solver'; });

  if(!engineNode) throw new Error('Motor bileşeni eksik');
  if(!vehicleNode) throw new Error('Araç bileşeni eksik');
  if(!wheelNode) throw new Error('Tekerlek bileşeni eksik');

  // Grafik görünümlerini sıfırla
  for(var _vi = 0; _vi < 4; _vi++) veResetChartView(_vi);

  // ── MOTOR PARAMETRELERİ ──
  var ed = engineNode.data || {};
  var specs = ed.motorSpecs || {};
  var torqueTable = ed.torqueData || [];
  if(torqueTable.length < 2) throw new Error('Motor tork tablosu eksik (en az 2 veri noktası)');

  var governedSpeed = parseFloat(specs.governedSpeed) || parseFloat(ed.governedRpm) || 2100;
  var noLoadGoverned = parseFloat(specs.noLoadGoverned) || 2350;
  var idleRpm = parseFloat(specs.idleRpm) || 700;
  var I_engine = parseFloat(specs.inertia) || 1.431;

  // Motor tork fonksiyonu (PCHIP + governor) — BRÜT
  var grossMotorTorqueFn = FT_SOLVER.createMotorTorqueFn(torqueTable, governedSpeed, noLoadGoverned);

  // ── AKSESUAR KAYIPLARI ──
  // Fan: P ∝ N³ (kavramalı/clutch) veya sabit (on) | Diğerleri: P ∝ N (doğrusal)
  var accList = ed.accessories || [];
  var accTotalFanLoss = 0;   // Fan kayıp [kW] @ governed
  var accTotalOtherLoss = 0; // Diğer kayıp [kW] @ governed
  var accFanMode = 'clutch'; // 'on' = sabit (iSCAAN uyumlu), 'clutch' = N³ ölçekli
  accList.forEach(function(a) {
    var loss = parseFloat(a.userLoss) || 0;
    if(loss <= 0) return;
    if(a.name && a.name.toLowerCase().indexOf('fan') >= 0) {
      accTotalFanLoss += loss;
      if(a.fanMode) accFanMode = a.fanMode;
    } else {
      accTotalOtherLoss += loss;
    }
  });
  var hasAccessoryLoss = (accTotalFanLoss + accTotalOtherLoss) > 0;

  // NET motor tork fonksiyonu (brüt − aksesuar kayıpları)
  function motorTorqueFn(rpm) {
    var T_gross = grossMotorTorqueFn(rpm);
    if(!hasAccessoryLoss || rpm <= 0) return T_gross;
    var ratio = rpm / governedSpeed;
    var P_fan_kW;
    if(accFanMode === 'on') {
      // iSCAAN uyumlu: Fan kaybı tüm devirlerde sabit (governed hızdaki değer)
      P_fan_kW = accTotalFanLoss;
    } else {
      // Kavramalı fan: P ∝ N³
      P_fan_kW = accTotalFanLoss * ratio * ratio * ratio;
    }
    var P_loss_kW = P_fan_kW + accTotalOtherLoss * ratio;
    var omega = 2 * Math.PI * rpm / 60;
    var T_loss = P_loss_kW * 1000 / omega;
    return Math.max(0, T_gross - T_loss);
  }

  // ── TORK KONVERTÖRÜ ──
  var tcd = tcNode ? (tcNode.data || {}) : {};
  var tcDataArr = tcd.tcData || [];
  var pumpTorqueDrop = tcd.pumpTorqueDrop !== undefined ? parseFloat(tcd.pumpTorqueDrop) : 17.6;
  var I_conv = 0.5;           // TC toplam atalet (lockup modda)
  var I_conv_turbine = 0.3;   // TC türbin ataleti (converter modda)

  var tcFns = FT_SOLVER.createTCFunctions(tcDataArr);
  var hasTCData = tcDataArr.length >= 2;

  // ── ŞANZIMAN ──
  var gbd = gearboxNode ? (gearboxNode.data || {}) : {};
  var ftGearData = gbd.ftGearData || VE_FT_GB_DEFAULT_GEARS;
  // Sadece ileri vitesler (R hariç)
  var forwardGears = ftGearData.filter(function(g) { return g.name && g.name.charAt(0) !== 'R'; });
  if(forwardGears.length === 0) throw new Error('İleri vites verisi bulunamadı');

  // Shift profili
  var shiftProfile = gbd.shiftProfile || 'allison3200sp_s1';
  var spData = VE_FT_SHIFT_PROFILES[shiftProfile] || { lockupOffset: 75, shift1C2C_outRatio: 0.2150, shift2C2L_outRatio: 0.3594 };
  var lockupOffset = spData.lockupOffset || 75;
  // Shift Referans RPM: profilde tanımlıysa onu kullan, yoksa motor governed
  var shiftRefRPM = spData.shiftRefRPM || gbd.shiftRefRPM || governedSpeed;
  // Converter-mod geçiş oranları (N_out / N_shift_ref)
  var SHIFT_1C_2C_OUT_RATIO = spData.shift1C2C_outRatio || 0.2150;
  var SHIFT_2C_2L_OUT_RATIO = spData.shift2C2L_outRatio || 0.3594;
  var N_shift_lockup = shiftRefRPM - lockupOffset; // Lockup moddaki shift RPM'i (lockupShifts yoksa fallback)

  // Şanzıman iç ataleti (basitleştirilmiş — gearbox bileşeninde yok, sabit varsayım)
  var I_trans = 1.0;

  // ── PROPŞAFT ──
  var psEff = 1.0;
  var I_propshaft = 0.0;
  propshaftNodes.forEach(function(ps) {
    var psd = ps.data || {};
    psEff *= (parseFloat(psd.psEff) || 98.60) / 100;
    I_propshaft += parseFloat(psd.psInertia) || 0.5;
  });
  var i_propshaft = 1.0; // Propşaft oranı (her zaman 1.0)

  // ── TRANSFER CASE ──
  var trd = transferNode ? (transferNode.data || {}) : {};
  var ftTrGears = trd.ftTrGears || [
    { kademe: 'High', ratio: 1.054, eff: 97.00 },
    { kademe: 'Low', ratio: 2.337, eff: 97.00 }
  ];
  // transferRangeOverride parametresi varsa o kademeyi kullan
  var ftTrActive = transferRangeOverride || ftTrGears[0].kademe;
  var activeTransfer = ftTrGears.find(function(r) { return r.kademe === ftTrActive; }) || ftTrGears[0];
  var i_transfer = parseFloat(activeTransfer.ratio || activeTransfer.oran) || 1.054;
  var eta_transfer = (parseFloat(activeTransfer.eff || activeTransfer.verim) || 97) / 100;
  var I_tc = 0.3; // Transfer case ataleti

  // ── DİFERANSİYEL ──
  var dfd = diffNode ? (diffNode.data || {}) : {};
  // Diff node varsa ama diffRatio tanımsızsa → varsayılan yaz
  if(diffNode && !dfd.diffRatio) {
    if(!diffNode.data) diffNode.data = {};
    diffNode.data.diffRatio = 6.54;
    dfd = diffNode.data;
  }
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
  var ftHeight = parseFloat(vd.ftHeight) || 3.200;
  var ftWidth = parseFloat(vd.ftWidth) || 2.500;
  var A_frontal = ftHeight * ftWidth;
  var Cd = parseFloat(vd.ftCd) || 0.900;
  var rho = parseFloat(vd.ftRho) || 1.225;
  var grade_pct = parseFloat(vd.ftGrade) || 0.0;

  // Tutunma limiti
  var mu_traction = 0.70; // On-road default
  var F_grip = mu_traction * m_vehicle * drivenPct * 9.81;

  // ── ÇÖZÜCÜ PARAMETRELERİ ──
  var sd = solverNode ? (solverNode.data || {}) : {};
  var maxTime = parseFloat(sd.maxSimTime) || 120;  // Güvenlik limiti [s]
  var dt = parseFloat(sd.ftDt) || 0.01;  // Kullanıcı seçimi (varsayılan 10 ms)
  var method = sd.method || 'rk4';  // Kullanıcı seçimi (varsayılan RK4)

  // ═══════════════════════════════════════════════════════════════════════════
  // SHIFT CONTROLLER — VİTES GEÇİŞ DURUMU MAKİNESİ
  // ═══════════════════════════════════════════════════════════════════════════
  //
  // Shift sırası: 1C → 2C → 2L → 3L → 4L → 5L → 6L
  //
  // State = { gearIdx, isLockup }
  //   gearIdx 0 = F1 (1C/1L), gearIdx 1 = F2 (2C/2L), ...
  //   isLockup: false = converter mod, true = lockup mod
  //
  // Kurallar (N_out = Şanzıman çıkış devri = N_engine × SR / i_gear):
  //   1C→2C: converterShifts varsa a×ESL+b, yoksa oran × N_shift_ref
  //   2C→2L: converterShifts varsa segmentli/lineer, yoksa oran × N_shift_ref
  //   2L→3L...6L: N_out ≥ a × ESL + b (per-gear) veya N_engine ≥ N_governed - lockupOffset (fallback)

  // Converter geçiş eşiği hesaplama (converterShifts desteği)
  var csData = spData.converterShifts || null;

  /**
   * Segmentli 2C→2L eşiğini hesaplar.
   * ESL ≥ validFrom → lineer model, ESL < validFrom → lookup interpolasyon.
   */
  function calc2C2LThreshold(esl) {
    if(!csData || !csData['2C2L']) return SHIFT_2C_2L_OUT_RATIO * esl;
    var cs2L = csData['2C2L'];
    if(cs2L.type === 'segmented') {
      if(esl >= cs2L.linear.validFrom) {
        return cs2L.linear.a * esl + cs2L.linear.b;
      }
      // Lookup tablosu interpolasyonu
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
    // Basit lineer model
    return cs2L.a * esl + (cs2L.b || 0);
  }

  // Downshift eşik verileri
  var dsData = spData.downshiftThresholds || null;

  /**
   * Downshift N_out eşiğini hesaplar.
   * Desteklenen formatlar:
   *   { a, b }                                     → lineer: N_out = a × ESL + b
   *   { a, b, capValue, capBelow }                  → cap'li lineer
   *   { type:'piecewise', breakpoint, low, high }   → parçalı lineer (2 segment)
   *   { type:'segments', segments: [{maxESL, a, b, cap}, ...] } → çok segmentli
   * @param {object} ds   — downshift threshold tanımı
   * @param {number} esl  — Engine Speed Limit (governed)
   * @returns {number}    — N_out eşik değeri
   */
  function calcDownshiftThreshold(ds, esl) {
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
    return ds.a * esl + (ds.b || 0);
  }

  var shiftState = {
    gearIdx: 0,
    isLockup: false,   // Başlangıç: 1C (converter mod)
    shiftHistory: []    // [{t, fromGear, toGear, fromMode, toMode, v_kmh, N_engine, SR}]
  };

  function getCurrentGearData() {
    return forwardGears[shiftState.gearIdx] || forwardGears[0];
  }

  /**
   * Shift kararı — her adımda çağrılır.
   * Converter-mod: converterShifts varsa lineer/segmentli, yoksa oran bazlı.
   * Lockup-mod: lockupShifts varsa per-gear lineer, yoksa sabit ofset.
   * @returns {boolean} — shift yapıldı mı
   */
  function checkShift(t, N_engine, SR, tau, v_kmh) {
    var g = shiftState.gearIdx;
    var isLU = shiftState.isLockup;
    var maxGear = forwardGears.length - 1;
    var shifted = false;

    if(!isLU) {
      // ── CONVERTER MOD ──
      // N_out = şanzıman çıkış devri = N_turbine / i_gear = N_engine × SR / i_gear
      var i_gear_current = parseFloat(getCurrentGearData().ratio) || 1.0;
      var N_out = N_engine * SR / i_gear_current;

      if(g === 0) {
        // 1C → 2C: converterShifts varsa a×ESL+b, yoksa oran×N_ref
        var threshold_1C2C;
        if(csData && csData['1C2C']) {
          threshold_1C2C = csData['1C2C'].a * shiftRefRPM + (csData['1C2C'].b || 0);
        } else {
          threshold_1C2C = SHIFT_1C_2C_OUT_RATIO * shiftRefRPM;
        }
        if(N_out >= threshold_1C2C) {
          shiftState.shiftHistory.push({
            t: t, fromGear: g, toGear: 1, fromMode: '1C', toMode: '2C',
            v_kmh: v_kmh, N_engine: N_engine, SR: SR, N_out: N_out
          });
          shiftState.gearIdx = 1;
          shifted = true;
        }
      } else if(g === 1) {
        // 2C → 2L: converterShifts varsa segmentli/lineer, yoksa oran×N_ref
        var threshold_2C2L = calc2C2LThreshold(shiftRefRPM);
        if(N_out >= threshold_2C2L) {
          shiftState.shiftHistory.push({
            t: t, fromGear: 1, toGear: 1, fromMode: '2C', toMode: '2L',
            v_kmh: v_kmh, N_engine: N_engine, SR: SR, N_out: N_out,
            eta: SR * tau
          });
          shiftState.isLockup = true;
          shifted = true;
        }
      }
    } else {
      // ── LOCKUP MOD ──
      // Lineer formül: N_out >= a × ESL + b (per-gear kalibrasyon)
      // Fallback: N_engine >= N_shift_lockup (eski sabit ofset yöntemi)
      if(g < maxGear) {
        var i_gear_lu = parseFloat(getCurrentGearData().ratio) || 1.0;
        var N_out_lu = N_engine / i_gear_lu;  // Lockup modda SR=1
        var fromName = (g + 1) + 'L';
        var toName = (g + 2) + 'L';
        var shiftKey = fromName + toName;     // örn. '2L3L', '3L4L'
        var luShiftTriggered = false;

        if(spData.lockupShifts && spData.lockupShifts[shiftKey]) {
          var ls = spData.lockupShifts[shiftKey];
          var threshold_lu = calcDownshiftThreshold(ls, shiftRefRPM);
          if(N_out_lu >= threshold_lu) luShiftTriggered = true;
        } else {
          // Eski yöntem: sabit lockupOffset
          if(N_engine >= N_shift_lockup) luShiftTriggered = true;
        }

        if(luShiftTriggered) {
          shiftState.shiftHistory.push({
            t: t, fromGear: g, toGear: g + 1, fromMode: fromName, toMode: toName,
            v_kmh: v_kmh, N_engine: N_engine, SR: SR, N_out: N_out_lu
          });
          shiftState.gearIdx = g + 1;
          shifted = true;
        }
      }
    }

    // ── DOWNSHIFT KONTROLÜ ──
    // Lockup modda: N_out < downshift eşiği → alt vitese düş
    // Converter modda: downshift uygulanmaz (henüz hızlanma aşamasında)
    if(!shifted && dsData && isLU && g > 0) {
      var i_gear_ds = parseFloat(getCurrentGearData().ratio) || 1.0;
      var N_out_ds = N_engine / i_gear_ds;  // Lockup modda SR=1
      // Downshift key: (g+1)to(g) formatında, örn. gear 5 (6. vites) → '6to5'
      var dsKey = (g + 1) + 'to' + g;
      var dsEntry = dsData[dsKey];

      if(dsEntry) {
        var dsThreshold = calcDownshiftThreshold(dsEntry, shiftRefRPM);
        if(N_out_ds < dsThreshold) {
          var dsFromName = (g + 1) + 'L';
          var dsToName = g + 'L';
          // 2→1 özel durum: converter moda geçiş (1C)
          if(g === 1) {
            dsToName = '1C';
            shiftState.isLockup = false;
          }
          shiftState.shiftHistory.push({
            t: t, fromGear: g, toGear: g - 1, fromMode: dsFromName, toMode: dsToName,
            v_kmh: v_kmh, N_engine: N_engine, SR: SR, N_out: N_out_ds,
            isDownshift: true
          });
          shiftState.gearIdx = g - 1;
          shifted = true;
        }
      }
    }

    return shifted;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PER-STEP FİZİK HESAPLAMA
  // ═══════════════════════════════════════════════════════════════════════════

  function calcStepPhysics(v_ms) {
    if(v_ms < 0) v_ms = 0;
    var gearData = getCurrentGearData();
    var i_gear = parseFloat(gearData.ratio) || 1.0;
    var isLU = shiftState.isLockup;

    var N_engine, T_engine, T_output, T_pump, SR, tau, tcEta;

    var heatRejection_kW = 0;  // TC/Lockup ısı reddi [kW]

    // Lockup modda per-gear lineer ısı reddi katsayıları (iSCAAN validasyonu, 71 nokta fit)
    // Heat_lockup = a × N_engine_rpm + b  [kW]
    // Motor bağımsız — şanzıman mekanik kayıpları (dişli sürtünmesi, yatak, yağ kesme) devire bağlı
    var LOCKUP_HEAT_COEFFICIENTS = {
      1: { a: 0.002995, b: 0.5519 },   // Veri yok, 2L ile aynı varsayıldı
      2: { a: 0.002995, b: 0.5519 },   // Underdrive
      3: { a: 0.003071, b: 0.0304 },   // Underdrive
      4: { a: 0.003470, b: -2.1427 },  // Direct drive
      5: { a: 0.004852, b: -1.9591 },  // Overdrive
      6: { a: 0.006967, b: -4.1326 }   // Overdrive (en yüksek eğim)
    };

    if(!hasTCData || isLU) {
      // ── LOCKUP MOD (veya TC verisi yoksa) ──
      // N_engine = N_turbine (doğrudan bağlantı)
      N_engine = FT_SOLVER.speedToTurbineRpm(v_ms, i_gear, i_propshaft, i_transfer, i_axle, r_tire);
      if(N_engine < idleRpm) N_engine = idleRpm;
      T_engine = motorTorqueFn(N_engine);
      // Lockup kayıpları: pump torque drop + lockup klaç sürtünmesi
      var deltaT_lockup = 10.0 + 0.00367 * N_engine;
      T_pump = T_engine - pumpTorqueDrop;
      var T_net_lockup = T_pump - deltaT_lockup;
      if(T_net_lockup < 0) T_net_lockup = 0;
      // Lockup iç verim: pompa drag + klaç sürtünmesi + gear mekanik kayıp
      var eta_lockup = tcd.etaLockup || 0.965;
      T_output = T_net_lockup * eta_lockup;
      SR = 1.0;
      tau = 1.0;
      tcEta = eta_lockup;
      // Lockup ısı reddi: per-gear RPM-bağımlı lineer model (iSCAAN uyumu)
      // Heat_lockup = a × N_engine + b  [kW]
      // Şanzıman mekanik kayıpları (dişli sürtünmesi, yatak, yağ kesme) devire bağlı artar
      var gearNum = shiftState.gearIdx + 1; // 1-indexed
      var hrCoeff = LOCKUP_HEAT_COEFFICIENTS[gearNum] || LOCKUP_HEAT_COEFFICIENTS[2];
      heatRejection_kW = Math.max(0, hrCoeff.a * N_engine + hrCoeff.b);
    } else {
      // ── CONVERTER MOD ──
      // N_turbine'i hızdan hesapla
      var N_turbine = FT_SOLVER.speedToTurbineRpm(v_ms, i_gear, i_propshaft, i_transfer, i_axle, r_tire);
      if(N_turbine < 0) N_turbine = 0;

      // TC bisection ile motor çalışma noktasını bul
      var tcResult = FT_SOLVER.solveTCOperatingPoint(
        N_turbine, motorTorqueFn, tcFns, pumpTorqueDrop,
        { N_min: idleRpm, N_max: noLoadGoverned + 100 }
      );
      N_engine = tcResult.N_engine;
      T_engine = tcResult.T_engine;
      T_pump = tcResult.T_pump;
      var T_turbine_raw = tcResult.T_turbine;  // Türbin torku (TC çıkışı)
      SR = tcResult.SR;
      tau = tcResult.tau;
      // Konvertör iç verim: pompa verimsizliği + gear mekanik kayıp
      var eta_conv_internal = tcd.etaConvInternal || 0.975;
      T_output = T_turbine_raw * eta_conv_internal;
      tcEta = tcResult.eta * eta_conv_internal;
      // Converter ısı reddi: TC kaybı + gear mekanik kayıp ısısı
      var omega_eng = N_engine * 2 * Math.PI / 60;
      var P_heat_converter = T_pump * omega_eng * (1 - SR * tau) / 1000;
      var P_turbine_kW = T_turbine_raw * (N_engine * SR) * 2 * Math.PI / 60 / 1000;
      var P_heat_gear_mech = P_turbine_kW * (1 - eta_conv_internal);
      heatRejection_kW = Math.max(0, P_heat_converter) + Math.max(0, P_heat_gear_mech);
    }

    // Evrensel dişli verimi: η = 1 − |ln(i)| × (0.0175 + 2.93e-6 × N_turbine)
    var _N_turb_for_eff = isLU ? N_engine : (N_engine * SR);
    var eta_gear = FT_SOLVER.calcGearEfficiency(i_gear, _N_turb_for_eff);

    // Çekme kuvveti — şanzıman kayıpları tork kaybı modeli (deltaT_lockup / TC eta)
    // ile zaten hesaplandığından eta_gear TE formülünden çıkarıldı (iSCAAN uyumu).
    // eta_gear sadece rapor/sinyal amaçlı saklanıyor.
    var F_traction = FT_SOLVER.calcTractiveEffort(
      T_output, i_gear, 1.0, i_propshaft, psEff,
      i_transfer, eta_transfer, i_axle, eta_axle, r_tire
    );

    // Wheel slip kontrolü
    F_traction = FT_SOLVER.limitByGrip(F_traction, F_grip);

    // Direnç kuvvetleri
    var resist = FT_SOLVER.calcResistForces(v_ms, {
      m: m_vehicle, Crr: Crr, surfFactor: surfFactor,
      Cd: Cd, A: A_frontal, rho: rho, grade_pct: grade_pct
    });

    // Net kuvvet
    var F_net = F_traction - resist.F_total;

    // Eşdeğer kütle (dinamik — vites ve mod bağımlı)
    var mEff = FT_SOLVER.calcEquivalentMass({
      m_vehicle: m_vehicle, r_tire: r_tire,
      i_gear: i_gear, i_propshaft: i_propshaft, i_transfer: i_transfer, i_axle: i_axle,
      I_engine: I_engine, I_conv: I_conv, I_conv_turbine: I_conv_turbine,
      I_trans: I_trans, I_propshaft: I_propshaft, I_tc: I_tc,
      I_axle: I_axle_inertia, I_tire: I_tire,
      isLockup: isLU
    });

    // İvme
    var accel = F_net / mEff.m_eff;

    return {
      accel: accel,
      N_engine: N_engine,
      T_engine: T_engine,
      T_pump: T_pump,
      T_output: T_output,
      SR: SR,
      tau: tau,
      tcEta: tcEta,
      heatRejection_kW: heatRejection_kW,
      F_traction: F_traction,
      F_rolling: resist.F_rolling,
      F_aero: resist.F_aero,
      F_grade: resist.F_grade,
      F_resist: resist.F_total,
      F_net: F_net,
      m_eff: mEff.m_eff,
      i_gear: i_gear,
      eta_gear: eta_gear,
      gearIdx: shiftState.gearIdx,
      gearName: gearData.name,
      isLockup: isLU
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PER-COMPONENT SONUÇ DİZİLERİ
  // ═══════════════════════════════════════════════════════════════════════════
  var nodeData = {};
  chain.forEach(function(n) { nodeData[n.id] = {}; });
  if(vehicleNode && !nodeData[vehicleNode.id]) nodeData[vehicleNode.id] = {};
  if(roadNode && !nodeData[roadNode.id]) nodeData[roadNode.id] = {};

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
  if(shiftCtrlNode && !nodeData[shiftCtrlNode.id]) { nodeData[shiftCtrlNode.id] = {}; initSignals(shiftCtrlNode.id, 'shift-controller'); }
  if(solverNode && !nodeData[solverNode.id]) { nodeData[solverNode.id] = {}; initSignals(solverNode.id, 'solver'); }

  // Legacy sonuç dizileri
  var timeArr = [];
  var res_speed = [], res_rpm = [], res_engineTorque = [];
  var res_F_grade = [], res_F_rolling = [], res_F_aero = [], res_F_net = [];
  var res_distance = [], res_accel = [];

  // ── iSCAAN KOLON DİZİLERİ ──
  var res_gearMode = [];       // Vites modu: "1C", "2C", "2L", "3L"...
  var res_outputSpeed = [];    // Şanzıman çıkış devri [rpm]
  var res_SR = [];             // Speed Ratio (TC veya 1.0 lockup)
  var res_tcEta = [];          // TC verimi: η = SR × τ (match point için)
  var res_N_turbine = [];      // Türbin devri [rpm] (TC çıkışı = şanzıman girişi)
  var res_tau = [];            // Tork oranı τ (TC veya 1.0 lockup)
  var res_TE = [];             // Tractive Effort [kN]
  var res_DP = [];             // Drawbar Pull [kN] = TE - F_rolling - F_aero
  var res_WP = [];             // Wheel Power [kW] = TE × V
  var res_netGrade = [];       // Net Grade [%] = DP / (m×g) × 100
  var res_heatRej = [];        // Heat Rejection [kW]
  var res_T_output = [];       // TC/Lockup çıkış torku [Nm]

  // ── ENERJİ DENGESİ DİZİLERİ ──
  var res_P_engine = [];       // Motor gücü [kW] = T_engine × ω_engine
  var res_P_wheel = [];        // Tekerlek gücü [kW] = F_traction × V (= WP)
  var res_P_TC_heat = [];      // TC ısı kaybı [kW]
  var res_P_rolling = [];      // Yuvarlanma direnci gücü [kW]
  var res_P_aero = [];         // Aerodinamik kayıp gücü [kW]
  var res_P_grade = [];        // Eğim gücü [kW]
  var res_P_accel = [];        // Hızlanma gücü [kW] = m_eff × a × V
  var res_P_drivetrain = [];   // Güç aktarma kaybı [kW] = P_engine - P_TC - P_wheel
  var res_eta_total = [];      // Toplam verim [%] = P_wheel / P_engine

  // ═══════════════════════════════════════════════════════════════════════════
  // ANA SİMÜLASYON DÖNGÜSÜ — RK4
  // ═══════════════════════════════════════════════════════════════════════════

  var t = 0;
  var v = 0;       // m/s — başlangıç hızı = 0 (tam gaz kalkış)
  var dist = 0;    // m
  var step = 0;
  var maxSteps = Math.ceil(maxTime / dt);
  var reachedMaxSpeed = false;

  // Örnekleme: her adımı kaydetmek çok fazla veri üretir (12000 adım @ 120s/0.01s)
  // Her N adımda bir kayıt al
  var sampleInterval = Math.max(1, Math.round(0.05 / dt)); // ~50 ms aralıkla
  var lastSampleStep = -sampleInterval; // İlk adımda kaydet

  // Kayıt fonksiyonu
  function recordStep(t_rec, v_rec, dist_rec, ph) {
    timeArr.push(t_rec);
    var v_kmh = v_rec * 3.6;
    res_speed.push(v_kmh);
    res_rpm.push(ph.N_engine);
    res_engineTorque.push(ph.T_engine);
    res_F_grade.push(ph.F_grade);
    res_F_rolling.push(ph.F_rolling);
    res_F_aero.push(ph.F_aero);
    res_F_net.push(ph.F_net);
    res_distance.push(dist_rec);
    res_accel.push(ph.accel);

    // ── iSCAAN KOLONLARI ──
    var gearNum = ph.gearName.replace(/[^0-9]/g, '');
    res_gearMode.push(gearNum + (ph.isLockup ? 'L' : 'C'));
    res_SR.push(ph.isLockup ? 1.0 : ph.SR);
    res_tcEta.push(ph.isLockup ? 1.0 : (ph.SR * ph.tau));
    res_N_turbine.push(ph.isLockup ? ph.N_engine : ph.N_engine * ph.SR);
    res_tau.push(ph.isLockup ? 1.0 : ph.tau);

    // Output Speed: şanzıman çıkış mili devri [rpm]
    // Doğrudan araç hızından hesapla (TC solver'dan bağımsız — kinematik)
    // N_output = (V / r_tire) × (i_propshaft × i_transfer × i_axle) × 60 / (2π)
    var N_output_kinematic = (v_rec / r_tire) * (i_propshaft * i_transfer * i_axle) * 60 / (2 * Math.PI);
    res_outputSpeed.push(N_output_kinematic);

    // TC/Lockup çıkış torku
    res_T_output.push(ph.T_output);

    // Tractive Effort [kN]
    var TE_kN = ph.F_traction / 1000;
    res_TE.push(TE_kN);

    // Drawbar Pull [kN] = TE - Rolling - Aero (eğim hariç — tırmanma kapasitesi)
    var DP_N = ph.F_traction - Math.abs(ph.F_rolling) - Math.abs(ph.F_aero);
    res_DP.push(DP_N / 1000);

    // Wheel Power [kW] = F_traction × V
    res_WP.push(ph.F_traction * v_rec / 1000);

    // Net Grade [%] = tan(θ) × 100 (Allison/iSCAAN standardı)
    // DP = m×g×sin(θ) → sin(θ) = DP/(m×g) → Grade% = tan(θ)×100
    var sinTheta = DP_N / (m_vehicle * 9.81);
    var netGr;
    if(Math.abs(sinTheta) >= 1.0) {
      netGr = sinTheta > 0 ? 999.9 : -999.9;  // Fiziksel sınır
    } else {
      // tan(θ) = sin(θ) / √(1 − sin²(θ))
      netGr = sinTheta / Math.sqrt(1 - sinTheta * sinTheta) * 100;
    }
    res_netGrade.push(netGr);

    // Heat Rejection [kW]
    res_heatRej.push(ph.heatRejection_kW);

    // ── ENERJİ DENGESİ HESABI ──
    var omega_eng_eb = ph.N_engine * 2 * Math.PI / 60;
    var P_eng_kW = ph.T_engine * omega_eng_eb / 1000;
    var P_whl_kW = ph.F_traction * v_rec / 1000;
    var P_roll_kW = Math.abs(ph.F_rolling) * v_rec / 1000;
    var P_aero_kW = Math.abs(ph.F_aero) * v_rec / 1000;
    var P_grade_kW = ph.F_grade * v_rec / 1000;        // İşaretli: pozitif = yokuş yukarı
    var P_accel_kW = ph.m_eff * ph.accel * v_rec / 1000;
    var P_tc_kW = ph.heatRejection_kW;
    var P_dt_kW = P_eng_kW - P_tc_kW - P_whl_kW;       // Güç aktarma kaybı (dolaylı)
    if(P_dt_kW < 0) P_dt_kW = 0;                        // Sayısal kararlılık
    var eta_tot = P_eng_kW > 0.1 ? (P_whl_kW / P_eng_kW * 100) : 0;

    res_P_engine.push(P_eng_kW);
    res_P_wheel.push(P_whl_kW);
    res_P_TC_heat.push(P_tc_kW);
    res_P_rolling.push(P_roll_kW);
    res_P_aero.push(P_aero_kW);
    res_P_grade.push(P_grade_kW);
    res_P_accel.push(P_accel_kW);
    res_P_drivetrain.push(P_dt_kW);
    res_eta_total.push(eta_tot);

    // Per-component signals
    if(engineNode && nodeData[engineNode.id]) {
      var ne = nodeData[engineNode.id];
      if(ne.rpm) ne.rpm.push(ph.N_engine);
      if(ne.torque) ne.torque.push(ph.T_engine);
      if(ne.power) ne.power.push(ph.T_engine * ph.N_engine * Math.PI / 30 / 1000);
      if(ne.angular_vel) ne.angular_vel.push(ph.N_engine * 2 * Math.PI / 60);
    }

    if(tcNode && nodeData[tcNode.id]) {
      var nt = nodeData[tcNode.id];
      var N_turb = ph.isLockup ? ph.N_engine : ph.N_engine * ph.SR;
      var P_tc_in = ph.T_pump * ph.N_engine * Math.PI / 30 / 1000;
      var P_tc_out = ph.T_output * N_turb * Math.PI / 30 / 1000;
      var tc_eta_pct = ph.isLockup ? 100 : (ph.SR * ph.tau * 100);
      var tc_kfac = ph.N_engine > 0 && ph.T_pump > 0 ? ph.N_engine / Math.sqrt(ph.T_pump) : 0;
      if(nt.rpm_in) nt.rpm_in.push(ph.N_engine);
      if(nt.torque_in) nt.torque_in.push(ph.T_pump);
      if(nt.rpm_out) nt.rpm_out.push(N_turb);
      if(nt.torque_out) nt.torque_out.push(ph.T_output);
      if(nt.power_in) nt.power_in.push(P_tc_in);
      if(nt.power_out) nt.power_out.push(P_tc_out);
      if(nt.power_loss) nt.power_loss.push(Math.max(0, P_tc_in - P_tc_out));
      if(nt.efficiency) nt.efficiency.push(tc_eta_pct);
      if(nt.slip) nt.slip.push((1 - ph.SR) * 100);
      if(nt.torque_ratio) nt.torque_ratio.push(ph.tau);
      if(nt.speed_ratio) nt.speed_ratio.push(ph.SR);
      if(nt.heat_rejection) nt.heat_rejection.push(ph.heatRejection_kW);
      if(nt.kfactor) nt.kfactor.push(tc_kfac);
    }

    if(gearboxNode && nodeData[gearboxNode.id]) {
      var ng = nodeData[gearboxNode.id];
      var N_turb2 = ph.isLockup ? ph.N_engine : ph.N_engine * ph.SR;
      var gbOutRpm = N_turb2 / ph.i_gear;
      var gbOutTorque = ph.T_output * ph.i_gear * ph.eta_gear;
      var gbP_in = ph.T_output * N_turb2 * Math.PI / 30 / 1000;
      var gbP_out = gbOutTorque * gbOutRpm * Math.PI / 30 / 1000;
      var gearNum2 = ph.gearName.replace(/[^0-9]/g, '');
      if(ng.rpm_in) ng.rpm_in.push(N_turb2);
      if(ng.torque_in) ng.torque_in.push(ph.T_output);
      if(ng.rpm_out) ng.rpm_out.push(gbOutRpm);
      if(ng.torque_out) ng.torque_out.push(gbOutTorque);
      if(ng.power_in) ng.power_in.push(gbP_in);
      if(ng.power_out) ng.power_out.push(gbP_out);
      if(ng.power_loss) ng.power_loss.push(Math.max(0, gbP_in - gbP_out));
      if(ng.gear) ng.gear.push(ph.gearIdx + 1);
      if(ng.ratio) ng.ratio.push(ph.i_gear);
      if(ng.gear_mode) ng.gear_mode.push(gearNum2 + (ph.isLockup ? 'L' : 'C'));
      if(ng.efficiency) ng.efficiency.push(ph.eta_gear * 100);
    }

    // ── PROPŞAFT, TRANSFER, DİFERANSİYEL SİNYALLERİ ──
    var N_turb_rec = ph.isLockup ? ph.N_engine : ph.N_engine * ph.SR;
    var gbOutRpm_rec = N_turb_rec / ph.i_gear;
    var gbOutTorque_rec = ph.T_output * ph.i_gear * ph.eta_gear;

    // Shift Controller
    if(shiftCtrlNode && nodeData[shiftCtrlNode.id]) {
      var nsc = nodeData[shiftCtrlNode.id];
      var gearNum3 = ph.gearName.replace(/[^0-9]/g, '');
      var N_out_rec = gbOutRpm_rec;  // Şanzıman çıkış devri
      if(nsc.current_gear) nsc.current_gear.push(ph.gearIdx + 1);
      if(nsc.gear_mode) nsc.gear_mode.push(gearNum3 + (ph.isLockup ? 'L' : 'C'));
      if(nsc.lockup_state) nsc.lockup_state.push(ph.isLockup ? 1 : 0);
      if(nsc.n_output) nsc.n_output.push(N_out_rec);
      if(nsc.n_out_ratio) nsc.n_out_ratio.push(shiftRefRPM > 0 ? N_out_rec / shiftRefRPM : 0);
    }

    // Propshaft (şanzıman çıkışı = propshaft girişi)
    propshaftNodes.forEach(function(ps) {
      if(!nodeData[ps.id]) return;
      var np = nodeData[ps.id];
      var psE = (parseFloat((ps.data||{}).psEff) || 98.60) / 100;
      if(np.rpm_in)    np.rpm_in.push(gbOutRpm_rec);
      if(np.torque_in) np.torque_in.push(gbOutTorque_rec);
      if(np.rpm_out)   np.rpm_out.push(gbOutRpm_rec);  // oran = 1
      var psOutT = gbOutTorque_rec * psE;
      if(np.torque_out) np.torque_out.push(psOutT);
      var psP_in = gbOutTorque_rec * gbOutRpm_rec * Math.PI / 30 / 1000;
      var psP_out = psOutT * gbOutRpm_rec * Math.PI / 30 / 1000;
      if(np.power_in)   np.power_in.push(psP_in);
      if(np.power_out)  np.power_out.push(psP_out);
      if(np.power_loss) np.power_loss.push(psP_in - psP_out);
    });

    // Transfer case
    if(transferNode && nodeData[transferNode.id]) {
      var ntr = nodeData[transferNode.id];
      var psOutTorque = gbOutTorque_rec * psEff;  // propshaft verim uygulanmış
      var trInRpm = gbOutRpm_rec;
      var trOutRpm = trInRpm / i_transfer;
      var trOutTorque = psOutTorque * i_transfer * eta_transfer;
      var trP_in = psOutTorque * trInRpm * Math.PI / 30 / 1000;
      var trP_out = trOutTorque * trOutRpm * Math.PI / 30 / 1000;
      if(ntr.rpm_in)    ntr.rpm_in.push(trInRpm);
      if(ntr.torque_in) ntr.torque_in.push(psOutTorque);
      if(ntr.rpm_out)   ntr.rpm_out.push(trOutRpm);
      if(ntr.torque_out)ntr.torque_out.push(trOutTorque);
      if(ntr.power_in)  ntr.power_in.push(trP_in);
      if(ntr.power_out) ntr.power_out.push(trP_out);
      if(ntr.power_loss)ntr.power_loss.push(Math.max(0, trP_in - trP_out));
    }

    // Differential
    if(diffNode && nodeData[diffNode.id]) {
      var ndf = nodeData[diffNode.id];
      var psOutTorque2 = gbOutTorque_rec * psEff;
      var trOutTorque2 = psOutTorque2 * i_transfer * eta_transfer;
      var diffInRpm = gbOutRpm_rec / i_transfer;
      var diffOutRpm = diffInRpm / i_axle;
      var diffOutTorque = trOutTorque2 * i_axle * eta_axle;
      var diffP_in = trOutTorque2 * diffInRpm * Math.PI / 30 / 1000;
      var diffP_out = diffOutTorque * diffOutRpm * Math.PI / 30 / 1000;
      if(ndf.rpm_in)    ndf.rpm_in.push(diffInRpm);
      if(ndf.torque_in) ndf.torque_in.push(trOutTorque2);
      if(ndf.rpm_out)   ndf.rpm_out.push(diffOutRpm);
      if(ndf.torque_out)ndf.torque_out.push(diffOutTorque);
      if(ndf.power_in)  ndf.power_in.push(diffP_in);
      if(ndf.power_out) ndf.power_out.push(diffP_out);
      if(ndf.power_loss)ndf.power_loss.push(Math.max(0, diffP_in - diffP_out));
    }

    // Tekerlek
    if(wheelNode && nodeData[wheelNode.id]) {
      var nw = nodeData[wheelNode.id];
      var TE_rec = ph.F_traction / 1000;
      var DP_rec = (ph.F_traction - Math.abs(ph.F_rolling) - Math.abs(ph.F_aero)) / 1000;
      var sinTh = DP_rec * 1000 / (m_vehicle * 9.81);
      var ngr = Math.abs(sinTh) >= 1 ? (sinTh > 0 ? 999.9 : -999.9) : sinTh / Math.sqrt(1 - sinTh * sinTh) * 100;
      if(nw.rpm_in) nw.rpm_in.push(v_rec / r_tire * 60 / (2 * Math.PI));
      if(nw.torque_in) nw.torque_in.push(ph.F_traction * r_tire);
      if(nw.speed) nw.speed.push(v_kmh);
      if(nw.force) nw.force.push(ph.F_traction);
      if(nw.power_out) nw.power_out.push(ph.F_traction * v_rec / 1000);
      if(nw.tractive_effort) nw.tractive_effort.push(TE_rec);
      if(nw.drawbar_pull) nw.drawbar_pull.push(DP_rec);
      if(nw.net_grade) nw.net_grade.push(ngr);
    }

    // Araç
    if(vehicleNode && nodeData[vehicleNode.id]) {
      var nv = nodeData[vehicleNode.id];
      if(nv.v_speed) nv.v_speed.push(v_kmh);
      if(nv.v_accel) nv.v_accel.push(ph.accel);
      if(nv.v_accel_g) nv.v_accel_g.push(ph.accel / 9.81);
      if(nv.v_distance) nv.v_distance.push(dist_rec);
      if(nv.v_decel_g) nv.v_decel_g.push(ph.accel / 9.81);
      if(nv.v_kinetic_energy) nv.v_kinetic_energy.push(0.5 * m_vehicle * v_rec * v_rec / 1000);
      if(nv.v_effective_mass) nv.v_effective_mass.push(ph.m_eff);
    }

    // Yol
    if(roadNode && nodeData[roadNode.id]) {
      var nr = nodeData[roadNode.id];
      if(nr.r_grade_force) nr.r_grade_force.push(ph.F_grade);
      if(nr.r_rolling_force) nr.r_rolling_force.push(ph.F_rolling);
      if(nr.r_aero_force) nr.r_aero_force.push(ph.F_aero);
      if(nr.r_total_resist) nr.r_total_resist.push(ph.F_resist);
      if(nr.r_net_force) nr.r_net_force.push(ph.F_net);
      if(nr.r_current_grade) nr.r_current_grade.push(grade_pct);
      if(nr.r_current_segment) nr.r_current_segment.push(0);
    }

    // Solver (global sinyaller)
    if(solverNode && nodeData[solverNode.id]) {
      var ns = nodeData[solverNode.id];
      var TE_s = ph.F_traction / 1000;
      var DP_s = (ph.F_traction - Math.abs(ph.F_rolling) - Math.abs(ph.F_aero)) / 1000;
      var sinS = DP_s * 1000 / (m_vehicle * 9.81);
      var ngS = Math.abs(sinS) >= 1 ? (sinS > 0 ? 999.9 : -999.9) : sinS / Math.sqrt(1 - sinS * sinS) * 100;
      if(ns.time) ns.time.push(t_rec);
      if(ns.tractive_effort) ns.tractive_effort.push(TE_s);
      if(ns.drawbar_pull) ns.drawbar_pull.push(DP_s);
      if(ns.wheel_power) ns.wheel_power.push(ph.F_traction * v_rec / 1000);
      if(ns.net_grade) ns.net_grade.push(ngS);
      if(ns.heat_rejection) ns.heat_rejection.push(ph.heatRejection_kW);
    }
  }

  // ── RK4 Entegrasyon ──
  for(step = 0; step < maxSteps; step++) {
    // Fizik hesapla (mevcut durumda)
    var ph = calcStepPhysics(v);

    // Kayıt (örnekleme aralığında)
    if(step - lastSampleStep >= sampleInterval || step === 0) {
      recordStep(t, v, dist, ph);
      lastSampleStep = step;
    }

    // Vites geçiş kontrolü
    var v_kmh = v * 3.6;
    var shifted = checkShift(t, ph.N_engine, ph.SR, ph.tau, v_kmh);

    // ── SHIFT ANINDA ZORUNLU KAYIT ──
    // Vites geçişinde hem eski vitesin son noktasını hem yeni vitesin ilk noktasını kaydet
    if(shifted) {
      // ph hâlâ ESKİ vites verileriyle hesaplanmış → shift anını kaydet
      recordStep(t, v, dist, ph);
      lastSampleStep = step;
      // Yeni vitesle tekrar hesapla ve kaydet (RPM düşüşünü göster)
      var phNew = calcStepPhysics(v);
      recordStep(t, v, dist, phNew);
    }

    // Max hız kontrolü — pratik eşik ile (asimptotik yaklaşma sorunu)
    // F_net küçük + son vites + ivme çok düşük → maks hıza ulaşıldı
    var isLastGear = shiftState.gearIdx >= forwardGears.length - 1;
    if(isLastGear && v > 1) {
      var accelAbs = Math.abs(ph.accel);
      if(ph.F_net <= 0 || accelAbs < 0.005) {  // 0.005 m/s² ≈ pratik sıfır
        reachedMaxSpeed = true;
        if(step - lastSampleStep > 0) {
          recordStep(t, v, dist, ph);
        }
        break;
      }
    }

    // Sayısal entegrasyon adımı: dv/dt = a(v)
    // Not: shift olduysa yeni vitesle hesaplar (doğru davranış)
    var dv;
    if(method === 'euler') {
      dv = calcStepPhysics(v).accel * dt;
    } else if(method === 'heun') {
      var a1 = calcStepPhysics(v).accel;
      var a2 = calcStepPhysics(v + a1 * dt).accel;
      dv = (a1 + a2) / 2 * dt;
    } else if(method === 'ralston') {
      // Ralston yöntemi: optimal 2. derece RK (en küçük hata sınırı)
      var r1 = calcStepPhysics(v).accel;
      var r2 = calcStepPhysics(v + r1 * dt * 2/3).accel;
      dv = (r1 / 4 + r2 * 3/4) * dt;
    } else if(method === 'rk45') {
      // RK45 Dormand-Prince: adaptif adım boyutu
      var ftAtol = parseFloat(sd.ftAtol) || 1e-6;
      var ftRtol = parseFloat(sd.ftRtol) || 1e-4;
      var dt_min = 1e-5;
      var dt_max = 0.1;
      var accepted = false;
      var dt_used = dt; // Bu adımda kullanılan dt'yi sakla
      while(!accepted) {
        // Dormand-Prince katsayıları (Butcher tablosu)
        var dk1 = calcStepPhysics(v).accel;
        var dk2 = calcStepPhysics(v + dk1 * dt / 5).accel;
        var dk3 = calcStepPhysics(v + dk1 * dt * 3/40 + dk2 * dt * 9/40).accel;
        var dk4 = calcStepPhysics(v + dk1 * dt * 44/45 - dk2 * dt * 56/15 + dk3 * dt * 32/9).accel;
        var dk5 = calcStepPhysics(v + dk1 * dt * 19372/6561 - dk2 * dt * 25360/2187 + dk3 * dt * 64448/6561 - dk4 * dt * 212/729).accel;
        var dk6 = calcStepPhysics(v + dk1 * dt * 9017/3168 - dk2 * dt * 355/33 + dk3 * dt * 46732/5247 + dk4 * dt * 49/176 - dk5 * dt * 5103/18656).accel;
        
        // 4. derece çözüm (hata tahmini için)
        var dv4 = (dk1 * 5179/57600 + dk3 * 7571/16695 + dk4 * 393/640 - dk5 * 92097/339200 + dk6 * 187/2100) * dt;
        // 5. derece çözüm
        var dv5 = (dk1 * 35/384 + dk3 * 500/1113 + dk4 * 125/192 - dk5 * 2187/6784 + dk6 * 11/84) * dt;
        
        var err = Math.abs(dv5 - dv4);
        var tol = ftAtol + ftRtol * Math.abs(v);
        
        if(err <= tol || dt <= dt_min) {
          dv = dv5;  // 5. derece çözümü kullan
          dt_used = dt; // Kabul edilen adımın dt'sini sakla
          accepted = true;
          // Sonraki adım için dt ayarla
          if(err > 0) {
            var factor = 0.84 * Math.pow(tol / err, 0.2);
            factor = Math.max(0.3, Math.min(factor, 2.5));
            dt = Math.max(dt_min, Math.min(dt * factor, dt_max));
          }
        } else {
          // Adımı küçült ve tekrar dene
          var shrink = 0.84 * Math.pow(tol / err, 0.25);
          dt = Math.max(dt_min, dt * Math.max(0.2, shrink));
        }
      }
    } else { // rk4 (default)
      var k1 = calcStepPhysics(v).accel;
      var k2 = calcStepPhysics(v + k1 * dt / 2).accel;
      var k3 = calcStepPhysics(v + k2 * dt / 2).accel;
      var k4 = calcStepPhysics(v + k3 * dt).accel;
      dv = (k1 + 2 * k2 + 2 * k3 + k4) / 6 * dt;
    }

    // Hız ve mesafe güncelle
    var v_new = v + dv;
    if(v_new < 0) v_new = 0;
    var dt_step = (method === 'rk45') ? dt_used : dt; // RK45: kabul edilen adım boyutu
    dist += (v + v_new) / 2 * dt_step;  // Trapez kuralı ile mesafe
    v = v_new;
    t += dt_step;
  }

  // Son adımı kaydet (eğer henüz kaydedilmediyse)
  if(timeArr.length === 0 || timeArr[timeArr.length - 1] < t - dt/2) {
    var phFinal = calcStepPhysics(v);
    recordStep(t, v, dist, phFinal);
  }

  // Gerçek maks hız (dinamik simülasyondan)
  var actualMaxSpeed_kmh = Math.max.apply(null, res_speed);

  // ═══════════════════════════════════════════════════════════════════════════
  // STATİK UZANTI: V_max ötesi (Allison formatı — droop bölgesi)
  // Son viteste governed → noLoadGoverned arası RPM droop
  // Motor torku azalır, DP negatife döner, WP → 0 olana kadar devam eder
  // ═══════════════════════════════════════════════════════════════════════════
  // Koşul: maks hıza ulaşıldı VEYA sim sona erdi ve son viteste
  var shouldExtend = reachedMaxSpeed || (shiftState.gearIdx >= forwardGears.length - 1 && v > 1);
  if(shouldExtend) {
    if(!reachedMaxSpeed) reachedMaxSpeed = true;  // istatistik için
    var vExtStep = 3.2 / 3.6;  // 3.2 km/h → m/s
    var vExt = v + vExtStep;
    var maxExtSteps = 30;
    for(var extI = 0; extI < maxExtSteps; extI++) {
      var phExt = calcStepPhysics(vExt);
      var WP_ext = phExt.F_traction * vExt / 1000;  // Wheel Power [kW]
      recordStep(t + (extI + 1) * 0.1, vExt, dist, phExt);
      // WP=0 satırını da dahil et, sonra dur
      if(WP_ext <= 0) break;
      vExt += vExtStep;
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SOLVER İSTATİSTİKLERİ
  // ═══════════════════════════════════════════════════════════════════════════
  var solverStats = {
    method: method,
    dt: dt,
    steps: step,
    maxTime: maxTime,
    events: [],
    shiftHistory: shiftState.shiftHistory,
    reachedMaxSpeed: reachedMaxSpeed,
    maxSpeed_kmh: actualMaxSpeed_kmh,
    finalGear: getCurrentGearData().name,
    transferRange: activeTransfer,
    i_axle: i_axle,
    N_governed: governedSpeed,
    accFanLoss: accTotalFanLoss,
    accOtherLoss: accTotalOtherLoss,
    // Doğrulama için güç aktarma parametreleri
    r_tire: r_tire,
    i_propshaft: i_propshaft,
    i_transfer: i_transfer,
    m_vehicle: m_vehicle,
    forwardGears: forwardGears.map(function(g) { return {name: g.name, ratio: g.ratio, eff: g.eff, lockup: g.lockup}; }),
    srShift1C2C: SHIFT_1C_2C_OUT_RATIO,  // N_out/N_shift_ref oranı
    srLockup2C2L: SHIFT_2C_2L_OUT_RATIO, // N_out/N_shift_ref oranı
    shift1C2C_outRatio: SHIFT_1C_2C_OUT_RATIO,
    shift2C2L_outRatio: SHIFT_2C_2L_OUT_RATIO,
    N_shift_lockup: N_shift_lockup,
    shiftRefRPM: shiftRefRPM,
    pumpTorqueDrop: pumpTorqueDrop,
    // Enerji dengesi özet istatistikleri
    energyBalance: (function() {
      var n = res_P_engine.length;
      if(n === 0) return null;
      var maxPeng = 0, maxPwhl = 0, maxPtc = 0, maxPdt = 0;
      var sumPeng = 0, sumPwhl = 0, sumPtc = 0, sumPdt = 0;
      var sumProll = 0, sumPaero = 0, sumPgrade = 0, sumPaccel = 0;
      var maxEta = 0, minEta = 100, sumEta = 0, etaCount = 0;
      var maxResidual = 0;
      for(var ei = 0; ei < n; ei++) {
        var pe = res_P_engine[ei];
        var pw = res_P_wheel[ei];
        var pt = res_P_TC_heat[ei];
        var pd = res_P_drivetrain[ei];
        if(pe > maxPeng) maxPeng = pe;
        if(pw > maxPwhl) maxPwhl = pw;
        if(pt > maxPtc) maxPtc = pt;
        if(pd > maxPdt) maxPdt = pd;
        sumPeng += pe; sumPwhl += pw; sumPtc += pt; sumPdt += pd;
        sumProll += res_P_rolling[ei];
        sumPaero += res_P_aero[ei];
        sumPgrade += res_P_grade[ei];
        sumPaccel += res_P_accel[ei];
        var eta = res_eta_total[ei];
        if(pe > 1) {
          if(eta > maxEta) maxEta = eta;
          if(eta < minEta) minEta = eta;
          sumEta += eta; etaCount++;
        }
        // Artık: P_wheel - (P_roll + P_aero + P_grade + P_accel)
        var residual = Math.abs(pw - (res_P_rolling[ei] + res_P_aero[ei] + res_P_grade[ei] + res_P_accel[ei]));
        if(residual > maxResidual) maxResidual = residual;
      }
      return {
        maxP_engine: maxPeng, maxP_wheel: maxPwhl, maxP_TC_heat: maxPtc, maxP_drivetrain: maxPdt,
        avgP_engine: sumPeng / n, avgP_wheel: sumPwhl / n, avgP_TC_heat: sumPtc / n, avgP_drivetrain: sumPdt / n,
        avgP_rolling: sumProll / n, avgP_aero: sumPaero / n, avgP_grade: sumPgrade / n, avgP_accel: sumPaccel / n,
        eta_max: maxEta, eta_min: etaCount > 0 ? minEta : 0, eta_avg: etaCount > 0 ? sumEta / etaCount : 0,
        maxResidual_kW: maxResidual,
        samples: n
      };
    })()
  };

  return {
    time: timeArr,
    mode: 'full-throttle',
    chainNodeIds: chain.map(function(n) { return n.id; }),
    nodeData: nodeData,
    speed: res_speed,
    rpm: res_rpm,
    engineTorque: res_engineTorque,
    F_grade: res_F_grade,
    F_rolling: res_F_rolling,
    F_aero: res_F_aero,
    F_net: res_F_net,
    distance: res_distance,
    accel: res_accel,
    // ── iSCAAN Kolonları ──
    gearMode: res_gearMode,
    outputSpeed: res_outputSpeed,
    SR: res_SR,
    tcEta: res_tcEta,
    N_turbine: res_N_turbine,
    tau: res_tau,
    T_output: res_T_output,
    TE: res_TE,
    DP: res_DP,
    WP: res_WP,
    netGrade: res_netGrade,
    heatRejection: res_heatRej,
    // ── Enerji Dengesi ──
    P_engine: res_P_engine,
    P_wheel: res_P_wheel,
    P_TC_heat: res_P_TC_heat,
    P_rolling: res_P_rolling,
    P_aero: res_P_aero,
    P_grade: res_P_grade,
    P_accel: res_P_accel,
    P_drivetrain: res_P_drivetrain,
    eta_total: res_eta_total,
    solverStats: solverStats,
    reportSnapshot: (function() {
      var _vd = vehicleNode ? (vehicleNode.data || {}) : {};
      var _wd = wheelNode ? (wheelNode.data || {}) : {};
      var _ed = engineNode ? (engineNode.data || {}) : {};
      var _specs = _ed.motorSpecs || {};
      var _tcd = tcNode ? (tcNode.data || {}) : {};
      var _gbd = gearboxNode ? (gearboxNode.data || {}) : {};
      var _dfd = diffNode ? (diffNode.data || {}) : {};
      var _trd = transferNode ? (transferNode.data || {}) : {};
      var _ftH = parseFloat(_vd.ftHeight) || 3.200;
      var _ftW = parseFloat(_vd.ftWidth) || 2.500;
      var _engName = 'Motor';
      var _pk = _ed.ftMotorPreset || _ed.mfMotorPreset || '';
      if(_pk && typeof VE_FT_MOTOR_PRESETS !== 'undefined' && VE_FT_MOTOR_PRESETS[_pk]) _engName = VE_FT_MOTOR_PRESETS[_pk].name;
      else if(engineNode && engineNode.customName) _engName = engineNode.customName;
      var _gbK = _gbd.ftGBPreset || '';
      var _gbP = _gbK && typeof VE_GEARBOX_PRESETS !== 'undefined' && VE_GEARBOX_PRESETS[_gbK] ? VE_GEARBOX_PRESETS[_gbK] : null;
      var _tcK = _tcd.tcPresetKey || '';
      var _tcN = _tcd.tcName || (_tcK && typeof VE_FT_TC_PRESETS !== 'undefined' && VE_FT_TC_PRESETS[_tcK] ? VE_FT_TC_PRESETS[_tcK].name : '—');
      var _trK = _trd.ftTrPreset || '';
      var _trP = _trK && typeof VE_TRANSFER_PRESETS !== 'undefined' ? VE_TRANSFER_PRESETS[_trK] : null;
      var _trN = transferNode ? (transferNode.customName || (_trP ? _trP.marka+' '+_trP.model : 'Transfer Case')) : '';
      return {
        height: _ftH, width: _ftW, frontalArea: _ftH*_ftW, cd: parseFloat(_vd.ftCd)||0.900, gvw: parseFloat(_vd.ftGVW)||14900,
        tireName: _wd.ftTireName||'Michelin XZL 395/85R20', tireRadius: r_tire, tireInertia: I_tire, crr: Crr, surfFactor: surfFactor,
        engineName: _engName, displacement: parseFloat(_specs.displacement)||0, governed: governedSpeed, noLoad: noLoadGoverned,
        idleRpm: parseFloat(_specs.idleRpm)||700, engineInertia: I_engine,
        accessories: (_ed.accessories||[]).map(function(a){return{name:a.name,standardLoss:parseFloat(a.standardLoss)||0,userLoss:parseFloat(a.userLoss)||0};}),
        torqueData: (ed.torqueData||ed.motorData||[]).map(function(p){return{rpm:p.rpm,torque:p.torque,power:p.power};}),
        fanLossGov: accTotalFanLoss, otherLossGov: accTotalOtherLoss, accFanMode: accFanMode,
        gbName: _gbP ? _gbP.name : (_gbd.gbName||'—'), gbFamily: _gbP ? (_gbP.family||'—') : '—', gbEff: parseFloat(_gbd.efficiency)||97, tcName: _tcN,
        shiftProfile: shiftProfile, shiftRefRPM: shiftRefRPM, lockupOffset: lockupOffset,
        gearData: forwardGears.map(function(g){return{name:g.name,ratio:g.ratio,eff:g.eff};}),
        allGearData: ftGearData.map(function(g){return{name:g.name,ratio:g.ratio,eff:g.eff};}),
        propshafts: propshaftNodes.map(function(ps,i){var psd=ps.data||{};return{name:ps.customName||('Kardan Mili'+(propshaftNodes.length>1?' '+(i+1):'')),eff:parseFloat(psd.psEff)||98.60};}),
        diffName: diffNode?(diffNode.customName||'Aks'):'Aks', diffRatio: i_axle, diffEff: (eta_axle*100),
        transferName: _trN, transferGears: ftTrGears.map(function(tr){return{kademe:tr.kademe||tr.mode||'',ratio:parseFloat(tr.ratio||tr.oran)||1.0,eff:parseFloat(tr.eff||tr.verim)||97};}),
        hasTransfer: !!transferNode,
        pumpDrop: pumpTorqueDrop,
        tcData: tcDataArr.map(function(d){return{sr:d.sr,kpump:d.kpump,tau:d.tau};}),
        turbineRating: (function(){ var ecmN = nodes.find(function(n){return n.type==='ec-matching';}); return ecmN && ecmN.data ? (ecmN.data.turbineRating||3320) : 3320; })(),
        gbGrossInputPower: _gbP ? (_gbP.grossInputPower || null) : null,
        gbGrossInputTorque: _gbP ? (_gbP.grossInputTorque || null) : null,
        gbMaxOutputSpeed: _gbP ? (_gbP.maxOutputSpeed || null) : null
      };
    })()
  };
}

// ════════════════════════════════════════════════════════════════════════════
// GRADEABILITY (EĞİM TIRMANMA KAPASİTESİ) HESAPLAMA
// ════════════════════════════════════════════════════════════════════════════
var VE_DEFAULT_GRADE_LIST = [0.0, 0.3, 0.5, 1.0, 2.0, 3.0, 4.0, 5.0,
                              6.0, 7.0, 8.0, 9.0, 10.0, 12.0, 15.0, 20.0,
                              25.0, 30.0, 40.0, 50.0, 60.0];

// DP interpolasyon yardımcısı
function veInterpolateDP(ftData, targetV) {
  if(targetV <= ftData[0].v_kmh) return ftData[0].dp_kN;
  if(targetV >= ftData[ftData.length-1].v_kmh) return ftData[ftData.length-1].dp_kN;
  for(var i = 0; i < ftData.length - 1; i++) {
    var v1 = ftData[i].v_kmh, v2 = ftData[i+1].v_kmh;
    if(v1 <= targetV && v2 >= targetV) {
      var frac = (v2 > v1) ? (targetV - v1) / (v2 - v1) : 0;
      return ftData[i].dp_kN + frac * (ftData[i+1].dp_kN - ftData[i].dp_kN);
    }
  }
  return ftData[ftData.length-1].dp_kN;
}

// Grade için max hız arama (yüksek hızdan düşük hıza)
function veFindMaxSpeedForGrade(ftData, gradePct, m_kg) {
  var g = 9.81;
  var theta = Math.atan(gradePct / 100);
  var F_grade_kN = m_kg * g * Math.sin(theta) / 1000;
  for(var i = ftData.length - 1; i >= 1; i--) {
    var curr = ftData[i], prev = ftData[i-1];
    if(Math.abs(curr.v_kmh - prev.v_kmh) < 0.05) continue;
    if(curr.dp_kN >= F_grade_kN) return { v_max: Math.round(curr.v_kmh * 10) / 10, gear: curr.gear };
    if(prev.dp_kN >= F_grade_kN && curr.dp_kN < F_grade_kN) {
      var frac = (F_grade_kN - prev.dp_kN) / (curr.dp_kN - prev.dp_kN);
      var vi = prev.v_kmh + frac * (curr.v_kmh - prev.v_kmh);
      return { v_max: Math.round(vi * 10) / 10, gear: prev.gear };
    }
  }
  return { v_max: 0.0, gear: 'X' };
}

// TC 80% çalışma noktası hızını bul (1C vitesindeki DP stall'ın %60'ına düştüğü hız)
function veFindTC80PercentSpeed(ftData) {
  var dp_stall = ftData[0].dp_kN;
  var target_dp = dp_stall * 0.60;
  for(var i = 0; i < ftData.length - 1; i++) {
    if(ftData[i].gear !== '1C') continue;
    if(ftData[i].dp_kN >= target_dp && ftData[i+1].dp_kN < target_dp) {
      var frac = (target_dp - ftData[i].dp_kN) / (ftData[i+1].dp_kN - ftData[i].dp_kN);
      return ftData[i].v_kmh + frac * (ftData[i+1].v_kmh - ftData[i].v_kmh);
    }
  }
  return 10.0;
}

// Tek kademe gradeability hesabı
function veCalcGradeForRatio(ftData, m_kg, transferRatio, isLowGear) {
  var g = 9.81;
  var mg_kN = m_kg * g / 1000;
  
  // Stall
  var dp_stall = ftData[0].dp_kN;
  var stallGrade, launchGrade;
  if(dp_stall >= mg_kN) {
    stallGrade = 999.0;
    launchGrade = 997.0;
  } else {
    stallGrade = Math.tan(Math.asin(dp_stall / mg_kN)) * 100;
    stallGrade = Math.round(stallGrade * 10) / 10;
    // Launch
    if(ftData.length > 1 && ftData[1].v_kmh > 0.5 && ftData[1].v_kmh <= 3.0) {
      var dp_launch = ftData[1].dp_kN;
      if(dp_launch >= mg_kN) { launchGrade = 997.0; }
      else { launchGrade = Math.tan(Math.asin(dp_launch / mg_kN)) * 100; }
      launchGrade = Math.round(launchGrade * 10) / 10;
    } else {
      launchGrade = Math.round((stallGrade - 2.0) * 10) / 10;
    }
  }
  
  // Low Speed referans hız
  var maxSpeedResult = veFindMaxSpeedForGrade(ftData, 0.0, m_kg);
  var v_max_flat = maxSpeedResult.v_max;
  var v_lowspd = 10.0;
  if(isLowGear && v_max_flat < 70) {
    v_lowspd = Math.round(veFindTC80PercentSpeed(ftData) * 10) / 10;
  }
  
  var dp_lowspd = veInterpolateDP(ftData, v_lowspd);
  var lowSpeedGrade;
  if(dp_lowspd / mg_kN >= 1.0) { lowSpeedGrade = 999.0; }
  else { lowSpeedGrade = Math.tan(Math.asin(dp_lowspd / mg_kN)) * 100; }
  lowSpeedGrade = Math.round(lowSpeedGrade * 10) / 10;
  
  // Gear lookup
  function gearAtV(tv) {
    var best = ftData[0].gear, md = 99999;
    for(var i = 0; i < ftData.length; i++) { var d = Math.abs(ftData[i].v_kmh - tv); if(d < md){md=d;best=ftData[i].gear;} }
    return best;
  }
  
  // Grade → Speed tablosu
  var gradeTable = [];
  for(var i = 0; i < VE_DEFAULT_GRADE_LIST.length; i++) {
    var gPct = VE_DEFAULT_GRADE_LIST[i];
    var res = veFindMaxSpeedForGrade(ftData, gPct, m_kg);
    if(res.v_max > 0) gradeTable.push({ grade: gPct, v_max: res.v_max, gear: res.gear });
    else break;
  }
  
  return {
    transferRatio: transferRatio,
    label: isLowGear ? 'Transfer Kutusu: Düşük Kademe (' + transferRatio.toFixed(3) + ')' :
                        'Transfer Kutusu: Yüksek Kademe (' + transferRatio.toFixed(3) + ')',
    stallGrade: stallGrade, stallGear: ftData[0].gear,
    launchGrade: launchGrade, launchGear: ftData[0].gear,
    lowSpeedGrade: lowSpeedGrade, lowSpeedV: v_lowspd, lowSpeedGear: gearAtV(v_lowspd),
    maxSpeedFlat: v_max_flat, maxSpeedFlatGear: maxSpeedResult.gear,
    gradeTable: gradeTable
  };
}

// FT verisini farklı transfer oranı için ölçekle
function veScaleFTDataForTransfer(ftDataOrig, ratioOrig, ratioNew, etaOrig, etaNew, m_kg, Cd, A, Crr) {
  var rho = 1.18;
  var g = 9.81;
  var rFactor = ratioNew / ratioOrig;
  var scaled = [];
  for(var i = 0; i < ftDataOrig.length; i++) {
    var orig = ftDataOrig[i];
    var v_new = orig.v_kmh / rFactor;
    var te_new = orig.te_kN * rFactor * (etaNew / etaOrig);
    var v_ms = v_new / 3.6;
    var f_aero = 0.5 * rho * Cd * A * v_ms * v_ms / 1000;
    var Crr_eff = FT_SOLVER.getCrrEffective(Crr, v_ms);
    var f_roll = Crr_eff * m_kg * g / 1000;
    var dp_new = te_new - f_roll - f_aero;
    scaled.push({ gear: orig.gear, v_kmh: Math.round(v_new * 100) / 100, dp_kN: dp_new, te_kN: te_new });
  }
  return scaled;
}

// Ana gradeability hesabı — transfer kademelerine göre high/low
function veCalculateGradeability(simResult) {
  var speed = simResult.speed, DP = simResult.DP, gearMode = simResult.gearMode;
  var ss = simResult.solverStats || {};
  var rs = simResult.reportSnapshot || {};
  var m_kg = ss.m_vehicle || rs.gvw || 15000;
  
  // FT tablo verisi (shift noktalarında üst vites)
  var ftData = [];
  for(var i = 0; i < speed.length; i++) {
    if(typeof DP[i] !== 'number' || isNaN(DP[i])) continue;
    ftData.push({ gear: gearMode[i]||'', v_kmh: speed[i], dp_kN: DP[i], te_kN: simResult.TE ? simResult.TE[i] : 0 });
  }
  if(ftData.length < 2) return null;
  
  // Shift noktalarını temizle
  var cleaned = [];
  for(var ci = 0; ci < ftData.length; ci++) {
    if(ci < ftData.length - 1 && Math.abs(ftData[ci+1].v_kmh - ftData[ci].v_kmh) < 0.05) continue;
    cleaned.push(ftData[ci]);
  }
  ftData = cleaned;
  
  // Aktif transfer oranı
  var trGears = rs.transferGears || [];
  var activeRatio = ss.transferRange ? (parseFloat(ss.transferRange.ratio || ss.transferRange.oran) || 1.0) : (trGears.length > 0 ? trGears[0].ratio : 1.0);
  var activeEta = ss.transferRange ? (parseFloat(ss.transferRange.eff || ss.transferRange.verim) || 97) : (trGears.length > 0 ? trGears[0].eff : 97);
  
  // High kademe (mevcut FT verisi)
  var result = {};
  result.high = veCalcGradeForRatio(ftData, m_kg, activeRatio, false);
  result.high.label = rs.hasTransfer && trGears.length > 1 ?
    'Transfer Kutusu: Yüksek Kademe (' + activeRatio.toFixed(3) + ')' :
    'Transfer Kutusu: Yüksek Kademe (' + activeRatio.toFixed(3) + ')';
  
  // Düşük kademe (ikinci transfer oranı varsa)
  result.low = null;
  if(rs.hasTransfer && trGears.length > 1) {
    var lowGear = trGears[1]; // İkinci kademe = düşük kademe (yüksek oran)
    var lowRatio = lowGear.ratio;
    var lowEta = lowGear.eff;

    // Gerçek Low range simülasyon sonuçları varsa onları kullan (ölçekleme yerine)
    var allRangeRes = typeof window !== 'undefined' ? window._veFTAllRangeResults : null;
    var lowKademe = lowGear.kademe || 'Low';
    var lowSimResult = allRangeRes ? allRangeRes[lowKademe] : null;

    var ftDataLow;
    if(lowSimResult && lowSimResult.speed && lowSimResult.DP && lowSimResult.DP.length > 2) {
      // Gerçek simülasyon verisinden FT tablo oluştur
      ftDataLow = [];
      for(var li = 0; li < lowSimResult.speed.length; li++) {
        if(typeof lowSimResult.DP[li] !== 'number' || isNaN(lowSimResult.DP[li])) continue;
        ftDataLow.push({
          gear: lowSimResult.gearMode ? lowSimResult.gearMode[li] : '',
          v_kmh: lowSimResult.speed[li],
          dp_kN: lowSimResult.DP[li],
          te_kN: lowSimResult.TE ? lowSimResult.TE[li] : 0
        });
      }
      // Shift noktalarını temizle
      var cleanedLow = [];
      for(var cli = 0; cli < ftDataLow.length; cli++) {
        if(cli < ftDataLow.length - 1 && Math.abs(ftDataLow[cli+1].v_kmh - ftDataLow[cli].v_kmh) < 0.05) continue;
        cleanedLow.push(ftDataLow[cli]);
      }
      ftDataLow = cleanedLow.length > 2 ? cleanedLow : ftDataLow;
    } else {
      // Fallback: ölçekleme (gerçek sim yoksa)
      var Cd = rs.cd || 0.9;
      var A = rs.frontalArea || (rs.height * rs.width) || 8.0;
      var Crr = rs.crr || 0.0035;
      ftDataLow = veScaleFTDataForTransfer(ftData, activeRatio, lowRatio, activeEta, lowEta, m_kg, Cd, A, Crr);
    }

    if(ftDataLow.length >= 2) {
      result.low = veCalcGradeForRatio(ftDataLow, m_kg, lowRatio, true);
      result.low.label = 'Transfer Kutusu: Düşük Kademe (' + lowRatio.toFixed(3) + ')';
      result.low.source = lowSimResult ? 'simulation' : 'scaling';
    }
  }
  
  return result;
}

// ============================================================================
// ════════════════════════════════════════════════════════════════════════════
// HIZLANMA (ACCELERATION) MILESTONE HESAPLAMA
// ════════════════════════════════════════════════════════════════════════════
var VE_ACCEL_SPEED_TARGETS = [20, 30, 40, 60, 80, 100]; // km/h

function veExtractAccelMilestones(speed, time, distance, maxSpeed) {
  var rows = [];
  for(var ti = 0; ti < VE_ACCEL_SPEED_TARGETS.length; ti++) {
    var target = VE_ACCEL_SPEED_TARGETS[ti];
    if(target > maxSpeed) {
      rows.push({ targetSpeed: target, time: null, distance: null });
      continue;
    }
    // Lineer interpolasyon ile hedef hıza ulaşma anını bul
    var found = false;
    for(var si = 1; si < speed.length; si++) {
      if(speed[si-1] <= target && speed[si] >= target) {
        var frac = (speed[si] > speed[si-1]) ? (target - speed[si-1]) / (speed[si] - speed[si-1]) : 0;
        var t = time[si-1] + frac * (time[si] - time[si-1]);
        var d = distance[si-1] + frac * (distance[si] - distance[si-1]);
        rows.push({ targetSpeed: target, time: Math.round(t * 10) / 10, distance: Math.round(d) });
        found = true;
        break;
      }
    }
    if(!found) rows.push({ targetSpeed: target, time: null, distance: null });
  }
  return rows;
}

function veCalculateAcceleration(simResult) {
  var speed = simResult.speed;
  var time = simResult.time;
  var distance = simResult.distance;
  var ss = simResult.solverStats || {};
  var rs = simResult.reportSnapshot || {};
  
  var maxSpeed = ss.maxSpeed_kmh || Math.max.apply(null, speed);
  
  // Yüksek kademe (mevcut FT verisi)
  var trGears = rs.transferGears || [];
  var activeRatio = ss.transferRange ? (parseFloat(ss.transferRange.ratio || ss.transferRange.oran) || 1.0) : (trGears.length > 0 ? trGears[0].ratio : 1.0);
  
  var result = {};
  result.high = {
    transferRatio: activeRatio,
    label: 'Transfer Kutusu: Yüksek Kademe (' + activeRatio.toFixed(3) + ')',
    maxSpeed: Math.round(maxSpeed * 10) / 10,
    rows: veExtractAccelMilestones(speed, time, distance, maxSpeed)
  };
  
  // Düşük kademe (ikinci transfer oranı varsa)
  result.low = null;
  if(rs.hasTransfer && trGears.length > 1) {
    var lowGear = trGears[1];
    var lowRatio = lowGear.ratio;

    // Gerçek düşük kademe simülasyon sonuçları varsa onları kullan
    var allRangeRes = typeof window !== 'undefined' ? window._veFTAllRangeResults : null;
    var lowKademe = lowGear.kademe || 'Low';
    var lowSimResult = allRangeRes ? allRangeRes[lowKademe] : null;

    if(lowSimResult && lowSimResult.speed && lowSimResult.time && lowSimResult.distance) {
      // Gerçek simülasyon verisi — doğru ivme, doğru eşdeğer kütle
      var lowSS = lowSimResult.solverStats || {};
      var lowMaxSpeed = lowSS.maxSpeed_kmh || Math.max.apply(null, lowSimResult.speed);
      result.low = {
        transferRatio: lowRatio,
        label: 'Transfer Kutusu: Düşük Kademe (' + lowRatio.toFixed(3) + ')',
        maxSpeed: Math.round(lowMaxSpeed * 10) / 10,
        rows: veExtractAccelMilestones(lowSimResult.speed, lowSimResult.time, lowSimResult.distance, lowMaxSpeed),
        source: 'simulation'
      };
    } else {
      // Fallback: ölçekleme (gerçek sim yoksa)
      // Tork artışı ivmeyi artırır, eşdeğer kütle artışını hesaba kat
      var rFactor = lowRatio / activeRatio;
      var maxSpeedLow = maxSpeed / rFactor;
      // Süre ölçekleme: düşük kademede net ivme ≈ rFactor kat daha yüksek (tork artışı > atalet artışı)
      // Basit yaklaşım: süreyi rFactor'e böl (tork orantılı ivme artışı)
      var lowSpeed = speed.map(function(v) { return v / rFactor; });
      var lowTime = time.map(function(t) { return t / rFactor; });
      var lowDist = distance.map(function(d) { return d / (rFactor * rFactor); });
      var lowMaxSpeedRound = Math.round(maxSpeedLow * 10) / 10;
      result.low = {
        transferRatio: lowRatio,
        label: 'Transfer Kutusu: Düşük Kademe (' + lowRatio.toFixed(3) + ')',
        maxSpeed: lowMaxSpeedRound,
        rows: veExtractAccelMilestones(lowSpeed, lowTime, lowDist, lowMaxSpeedRound),
        source: 'scaling'
      };
    }
  }

  return result;
}

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
  var rho = parseFloat(vd.ftRho) || 1.225;
  var F_grip = 0.70 * m_vehicle * drivenPct * 9.81;

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

  function checkShift(t_s, N_engine, SR, tau, v_kmh) {
    var g = shiftState.gearIdx, isLU = shiftState.isLockup, maxGear = forwardGears.length - 1, shifted = false;
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
        T_pump = T_engine - pumpTorqueDrop;
        var T_net_lu2 = T_pump - (10.0 + 0.00367 * N_engine);
        if(T_net_lu2 < 0) T_net_lu2 = 0;
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
      // Motor sürükleme torku: displacement bazlı ampirik model
      // T_motoring = C_drag × N_engine [Nm], C_drag ≈ displacement [L] × 0.012
      var displacement_L = parseFloat(specs.displacement) || 7.0; // Varsayılan 7L dizel
      var T_motoring = displacement_L * 0.012 * N_engine / 60; // Basitleştirilmiş
      // Daha gerçekçi: BMEP_motoring ≈ 50 kPa → T = BMEP × V_d / (4π)
      var V_d = displacement_L / 1000; // m³
      var BMEP_motoring = 50000; // Pa (50 kPa — tipik dizel motoring pressure)
      T_motoring = BMEP_motoring * V_d / (4 * Math.PI); // Nm
      // Tekerlekteki frenleme kuvveti (güç aktarma zinciri üzerinden)
      var i_total_coast = i_gear * i_propshaft * i_transfer * i_axle;
      F_engine_drag = T_motoring * i_total_coast / r_tire;
    }

    // Evrensel dişli verimi
    var _N_turb_eff2 = isLU ? N_engine : (N_engine * SR);
    var eta_gear = FT_SOLVER.calcGearEfficiency(i_gear, _N_turb_eff2);

    var F_traction = isCoast ? 0 : FT_SOLVER.limitByGrip(
      FT_SOLVER.calcTractiveEffort(T_output, i_gear, 1.0, i_propshaft, psEff, i_transfer, eta_transfer, i_axle, eta_axle, r_tire),
      F_grip
    );

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

    var segStartSpeed = v * 3.6, segStartTime = t, segDist = 0;
    var segMaxSpeed = v * 3.6, segMinSpeed = v * 3.6;

    var stallCounter = 0;
    while(segDist < seg_dist && globalStep < maxSteps) {
      var ph = calcStepPhysics(v, seg_command);

      if(globalStep - lastSampleStep >= sampleInterval || globalStep === 0) {
        recordStep(t, v, totalDist + segDist, ph, si);
        lastSampleStep = globalStep;
      }

      if(seg_command === 'full_throttle') {
        checkShift(t, ph.N_engine, ph.SR, ph.tau, v * 3.6);
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

    segmentSummary.push({
      segIdx: si, no: seg.no || (si + 1), command: seg_command, grade: seg.grade || 0,
      targetDist: seg_dist, actualDist: segDist,
      startSpeed_kmh: segStartSpeed, endSpeed_kmh: v * 3.6,
      maxSpeed_kmh: segMaxSpeed, minSpeed_kmh: segMinSpeed, duration: t - segStartTime
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
      Crr: Crr, Cd: Cd, A_frontal: A_frontal,
      forwardGears: forwardGears.map(function(g) { return {name: g.name, ratio: g.ratio, eff: g.eff}; }),
      finalGear: getCurrentGearData().name,
      finalGearIdx: shiftState.gearIdx,
      isLockup: shiftState.isLockup
    }
  };
}

// ===== ENGEL ATLAMA ANALİZİ =====
function veFTRunObstacleCrossingAnalysis(obsData) {
  // Araç ve tekerlek verilerini topla
  var vehicleNode = nodes.find(function(n) { return n.type === 'vehicle'; });
  var wheelNode = nodes.find(function(n) { return n.type === 'wheel' && n.isMasterWheel; })
                || nodes.find(function(n) { return n.type === 'wheel'; });

  if(!vehicleNode) throw new Error('Engel Atlama: Araç bileşeni eksik');
  if(!wheelNode) throw new Error('Engel Atlama: Tekerlek bileşeni eksik');

  var vd = vehicleNode.data || {};
  var wd = wheelNode.data || {};

  // Parametreleri oku
  var mass = parseFloat(vd.ftGVW) || 14900;
  var a1 = parseFloat(obsData.a1) || 0;
  var a2 = parseFloat(obsData.a2) || 0;
  var wheelbase = a1 + a2;
  var h = parseFloat(obsData.obstacleHeight) || 0;
  var R_eff = parseFloat(obsData.loadedTireRadius) || 0;
  var cornerDeflection = (obsData.cornerDeflection !== undefined && obsData.cornerDeflection !== null)
    ? parseFloat(obsData.cornerDeflection) : NaN;
  var hasCornerDefl = isFinite(cornerDeflection) && cornerDeflection > 0;

  // Şanzıman çıkış tork limiti
  var gbTorqueLimit = (obsData.gbTorqueLimit !== undefined && obsData.gbTorqueLimit !== null)
    ? parseFloat(obsData.gbTorqueLimit) : NaN;
  var hasGbTorqueLimit = isFinite(gbTorqueLimit) && gbTorqueLimit > 0;

  // Şanzıman vites oranı
  var gearboxNode = nodes.find(function(n) { return n.type === 'gearbox'; });
  var gd = gearboxNode ? (gearboxNode.data || {}) : {};
  var ftGears = gd.ftGearData || (typeof VE_FT_GB_DEFAULT_GEARS !== 'undefined' ? VE_FT_GB_DEFAULT_GEARS : []);
  var selectedGearIdx = obsData.selectedGearIdx !== undefined ? obsData.selectedGearIdx : 0;
  var selectedGear = ftGears.length > 0 && selectedGearIdx < ftGears.length ? ftGears[selectedGearIdx] : null;
  var gearRatio = selectedGear ? selectedGear.ratio : 0;
  var gearName = selectedGear ? selectedGear.name : '—';

  // Lastik bilgileri (otomatik)
  var tireName = wd.ftTireName || 'Michelin XZL 395/85R20';
  var rollingRadius = wd.ftTireRadius !== undefined ? wd.ftTireRadius : 0.573;

  // Sonuç objesi
  var result = {
    inputParams: {
      mass: mass,
      a1: a1,
      a2: a2,
      wheelbase: wheelbase,
      h: h,
      R_eff: R_eff,
      tireName: tireName,
      rollingRadius: rollingRadius,
      gearName: gearName,
      gearRatio: gearRatio,
      cornerDeflection: hasCornerDefl ? cornerDeflection : null,
      gbTorqueLimit: hasGbTorqueLimit ? gbTorqueLimit : null,
      loadTransferAnalysis: obsData.loadTransferAnalysis || false
    },
    geometry: {},
    canCross: false,
    geometryFail: false,
    geometryFailReason: '',
    notes: []
  };

  // ── GEOMETRİK GEÇERLİLİK KONTROLÜ ──
  if(R_eff <= 0) {
    result.geometryFail = true;
    result.geometryFailReason = 'Yüklü lastik yarıçapı (R_eff) tanımlı değil veya sıfır.';
    return result;
  }
  if(h <= 0) {
    result.geometryFail = true;
    result.geometryFailReason = 'Engel yüksekliği (h) tanımlı değil veya sıfır.';
    return result;
  }
  if(h > R_eff) {
    result.geometryFail = true;
    result.geometryFailReason = 'Engel yüksekliği teker yarıçapını aşıyor (h=' + h.toFixed(3) + ' m > R_eff=' + R_eff.toFixed(3) + ' m), geometrik olarak aşılamaz.';
    return result;
  }
  if(h === R_eff) {
    result.geometryFail = true;
    result.geometryFailReason = 'Engel yüksekliği teker yarıçapına eşit (h=R_eff=' + R_eff.toFixed(3) + ' m). Moment kolu x=0, pratikte aşılamaz.';
    return result;
  }

  // ── GEOMETRİ HESAPLARI (h < R_eff) ──

  // 1) Köşe moment kolu x = √(2·R_eff·h − h²)
  var x = Math.sqrt(2 * R_eff * h - h * h);

  // 2) Merkez-köşe açısı θ = arccos(x / R_eff)
  var theta_rad = Math.acos(x / R_eff);
  var theta_deg = theta_rad * 180 / Math.PI;

  // 3) h/R oranı
  var hR_ratio = h / R_eff;

  // Zorluk değerlendirmesi
  var difficultyLabel;
  if(hR_ratio < 0.5) {
    difficultyLabel = 'Kolay';
  } else if(hR_ratio < 0.75) {
    difficultyLabel = 'Orta';
  } else {
    difficultyLabel = 'Zor';
  }

  result.geometry = {
    x: x,
    theta_rad: theta_rad,
    theta_deg: theta_deg,
    hR_ratio: hR_ratio,
    difficultyLabel: difficultyLabel
  };

  // ── ADIM 3: TORK GEREKSİNİMİ HESABI ──
  var g = 9.81;
  var W = mass * g; // Toplam ağırlık kuvveti [N]
  var L = wheelbase;

  // Dingil mesafesi kontrolü
  if(L <= 0) {
    result.geometryFail = true;
    result.geometryFailReason = 'Dingil mesafesi (L=a1+a2) tanımlı değil veya sıfır.';
    return result;
  }

  // Senaryo A — Ön teker engelde
  // Arka teker temas noktası etrafında moment dengesi
  // D_ön = L + x  (P noktası ön aksın x kadar ilerisinde)
  var D_front = L + x;
  var N_f = W * a2 / D_front;          // Ön akstaki toplam reaksiyon [N]
  var N_f1 = N_f / 2;                   // Tek tekere düşen yük [N]
  var T_req_front = N_f1 * x;           // Tek teker tork gereksinimi [Nm]

  // Senaryo B — Arka teker engelde
  // Ön teker temas noktası etrafında moment dengesi
  // D_arka = L - x  (P noktası arka aksın x kadar gerisinde)
  var D_rear = L - x;

  // L - x <= 0 kontrolü (çok küçük dingil mesafeli araçlarda teorik)
  var N_r, N_r1, T_req_rear;
  if(D_rear <= 0) {
    N_r = Infinity;
    N_r1 = Infinity;
    T_req_rear = Infinity;
  } else {
    N_r = W * a1 / D_rear;             // Arka akstaki toplam reaksiyon [N]
    N_r1 = N_r / 2;                     // Tek tekere düşen yük [N]
    T_req_rear = N_r1 * x;              // Tek teker tork gereksinimi [Nm]
  }

  // Kritik senaryo belirleme (daha yüksek tork gereksinimi)
  var T_req_critical = Math.max(T_req_front, T_req_rear);
  var criticalScenario = T_req_rear >= T_req_front ? 'Arka teker' : 'Ön teker';

  result.torqueAnalysis = {
    g: g,
    W: W,
    L: L,
    // Senaryo A — Ön teker
    D_front: D_front,
    N_f: N_f,
    N_f1: N_f1,
    T_req_front: T_req_front,
    // Senaryo B — Arka teker
    D_rear: D_rear,
    N_r: N_r,
    N_r1: N_r1,
    T_req_rear: T_req_rear,
    // Özet
    T_req_critical: T_req_critical,
    criticalScenario: criticalScenario
  };

  // ── ADIM 4: STALL DENGE NOKTASI & MEVCUT TEKER TORKU ──

  // Motor bileşeni
  var engineNode = nodes.find(function(n) { return n.type === 'engine'; });
  var ed = engineNode ? (engineNode.data || {}) : {};
  var torqueTable = ed.torqueData || [];
  var specs = ed.motorSpecs || {};
  var governedSpeed = parseFloat(specs.governedSpeed || ed.governedRpm) || 2100;
  var noLoadGoverned = parseFloat(specs.noLoadGoverned) || (governedSpeed + 200);
  var idleRpm = parseFloat(specs.idleRpm) || 700;

  // Motor tork fonksiyonu (PCHIP + governor) — BRÜT
  var grossMotorTorqueFn = FT_SOLVER.createMotorTorqueFn(torqueTable, governedSpeed, noLoadGoverned);

  // Aksesuar kayıpları (net motor torku)
  var accList = ed.accessories || [];
  var accTotalFanLoss = 0, accTotalOtherLoss = 0;
  var accFanMode = 'clutch';
  accList.forEach(function(a) {
    var loss = parseFloat(a.userLoss) || 0;
    if(loss <= 0) return;
    if(a.name && a.name.toLowerCase().indexOf('fan') >= 0) {
      accTotalFanLoss += loss;
      if(a.fanMode) accFanMode = a.fanMode;
    } else {
      accTotalOtherLoss += loss;
    }
  });
  var hasAccessoryLoss = (accTotalFanLoss + accTotalOtherLoss) > 0;

  function motorTorqueFn(rpm) {
    var T_gross = grossMotorTorqueFn(rpm);
    if(!hasAccessoryLoss || rpm <= 0) return T_gross;
    var ratio = rpm / governedSpeed;
    var P_fan_kW = (accFanMode === 'on') ? accTotalFanLoss : accTotalFanLoss * ratio * ratio * ratio;
    var P_loss_kW = P_fan_kW + accTotalOtherLoss * ratio;
    var omega = 2 * Math.PI * rpm / 60;
    var T_loss = P_loss_kW * 1000 / omega;
    return Math.max(0, T_gross - T_loss);
  }

  // Tork konvertörü bileşeni
  var tcNode = nodes.find(function(n) { return n.type === 'torque-converter'; });
  var tcd = tcNode ? (tcNode.data || {}) : {};
  var tcDataArr = tcd.tcData || [];
  var pumpTorqueDrop = tcd.pumpTorqueDrop !== undefined ? parseFloat(tcd.pumpTorqueDrop) : 17.6;
  var tcFns = FT_SOLVER.createTCFunctions(tcDataArr);
  var hasTCData = tcDataArr.length >= 2;
  var hasEngineData = torqueTable.length >= 2;

  // Stall K_pump (SR=0)
  var K_pump_stall = tcFns.kpump(0);
  var TR_stall = tcFns.tau(0);

  // Transfer case bileşeni
  var transferNode = nodes.find(function(n) { return n.type === 'transfer'; });
  var trd = transferNode ? (transferNode.data || {}) : {};
  var ftTrGears = trd.ftTrGears || [
    { kademe: 'High', ratio: 1.054, eff: 97.00 },
    { kademe: 'Low', ratio: 2.337, eff: 97.00 }
  ];
  // Engel aşma için Low kademe kullan (varsayılan)
  var activeTransfer = ftTrGears.length > 1 ? ftTrGears[ftTrGears.length - 1] : ftTrGears[0];
  // Eğer obsData'da transferIdx belirtilmişse onu kullan
  if(obsData.transferIdx !== undefined && obsData.transferIdx < ftTrGears.length) {
    activeTransfer = ftTrGears[obsData.transferIdx];
  }
  var i_transfer = parseFloat(activeTransfer.ratio || activeTransfer.oran) || 1.054;
  var eta_transfer = (parseFloat(activeTransfer.eff || activeTransfer.verim) || 97) / 100;
  var transferName = activeTransfer.kademe || 'High';

  // Diferansiyel bileşeni
  var diffNode = nodes.find(function(n) { return n.type === 'differential'; });
  var dfd = diffNode ? (diffNode.data || {}) : {};
  var i_axle = parseFloat(dfd.diffRatio) || 6.54;
  var eta_axle = (parseFloat(dfd.efficiency) || 96) / 100;

  // Propşaft verimi
  var propshaftNodes = nodes.filter(function(n) { return n.type === 'propshaft'; });
  var eta_prop = 1.0;
  propshaftNodes.forEach(function(ps) {
    var psd = ps.data || {};
    eta_prop *= (parseFloat(psd.psEff) || 98.60) / 100;
  });

  // Vites verimi — evrensel formül (stall'da N_turbine=0)
  var eta_gear = selectedGear ? FT_SOLVER.calcGearEfficiency(parseFloat(selectedGear.ratio) || 1.0, 0) : 0.98;

  // Tahrikli teker sayısı (transfer kilitli + diff kilitli = 4, değilse 2)
  var n_d = 4; // Askeri araç varsayımı: 4x4, transfer ve diff kilitli
  var drivenPct = (parseFloat(vd.ftDrivenWeight) || 100) / 100;
  if(drivenPct < 1.0) n_d = 2;

  // Stall denge noktası hesabı
  var stallResult = null;
  if(hasEngineData && hasTCData) {
    // Rölantiden governed RPM'e kadar tarama: T_motor_mevcut ≥ T_pump olan son RPM
    var N_stall = idleRpm;
    var T_engine_stall = 0;
    var T_pump_stall = 0;

    for(var rpm = Math.ceil(idleRpm); rpm <= governedSpeed; rpm += 1) {
      var T_motor_mevcut = motorTorqueFn(rpm) - pumpTorqueDrop;
      var T_pump_abs = (rpm * rpm) / (K_pump_stall * K_pump_stall); // T_pump = (N / K_pump)²
      if(T_motor_mevcut >= T_pump_abs) {
        N_stall = rpm;
        T_engine_stall = motorTorqueFn(rpm); // Eğriden okunan tork (düşüm öncesi)
        T_pump_stall = T_pump_abs;
      } else {
        break; // Pump yükü motoru geçti, denge bulundu
      }
    }

    // Toplam mekanik verim: η_total = η_prop × η_axle × η_tc(transfer)
    var eta_total = eta_prop * eta_axle * eta_transfer * eta_gear;

    // Aktarma zincirinden teker torkuna:
    // T_turbine = T_pump × TR (T_engine × TR DEĞİL — SCAAN doğrulaması)
    // Motor torkun bir kısmı dönen kütlelerin ivmelenmesine gider,
    // sadece T_pump sıvı üzerinden türbine aktarılır.
    // Stall dengesinde T_pump ≈ T_engine - pump_drop, fark küçük ama prensip önemli.
    var T_turbine_stall = T_pump_stall * TR_stall;
    var T_wheel = T_turbine_stall * gearRatio * eta_total * i_transfer * i_axle / n_d;

    stallResult = {
      hasData: true,
      N_stall: N_stall,
      T_engine_stall: T_engine_stall,
      T_pump_stall: T_pump_stall,
      pumpTorqueDrop: pumpTorqueDrop,
      K_pump_stall: K_pump_stall,
      TR_stall: TR_stall,
      // Aktarma zinciri parametreleri
      gearName: gearName,
      gearRatio: gearRatio,
      eta_gear: eta_gear,
      transferName: transferName,
      i_transfer: i_transfer,
      eta_transfer: eta_transfer,
      i_axle: i_axle,
      eta_axle: eta_axle,
      eta_prop: eta_prop,
      eta_total: eta_total,
      n_d: n_d,
      T_wheel: T_wheel
    };
  } else {
    stallResult = {
      hasData: false,
      missingEngine: !hasEngineData,
      missingTC: !hasTCData
    };
  }

  result.stallAnalysis = stallResult;

  // ── ADIM 5: KARŞILAŞTIRMA & NİHAİ KARAR ──
  if(stallResult && stallResult.hasData) {
    var Tw = stallResult.T_wheel;

    // Ön teker: T_wheel vs T_req_ön
    var frontPass = Tw >= T_req_front;
    var frontMarginPct = T_req_front > 0 ? ((Tw - T_req_front) / T_req_front) * 100 : Infinity;

    // Arka teker: T_wheel vs T_req_arka
    var rearPass, rearMarginPct;
    if(isFinite(T_req_rear) && T_req_rear > 0) {
      rearPass = Tw >= T_req_rear;
      rearMarginPct = ((Tw - T_req_rear) / T_req_rear) * 100;
    } else {
      rearPass = false;
      rearMarginPct = -Infinity;
    }

    // Genel karar: her iki teker de aşmalı
    var overallPass = frontPass && rearPass;

    // Marj renk sınıflandırması: <0 kırmızı, 0-5 sarı, >5 yeşil
    function marginColor(pct) {
      if(pct < 0) return 'red';
      if(pct <= 5) return 'yellow';
      return 'green';
    }

    result.decision = {
      T_wheel: Tw,
      // Ön teker
      frontPass: frontPass,
      frontMarginNm: Tw - T_req_front,
      frontMarginPct: frontMarginPct,
      frontColor: marginColor(frontMarginPct),
      T_req_front: T_req_front,
      // Arka teker
      rearPass: rearPass,
      rearMarginNm: isFinite(T_req_rear) ? Tw - T_req_rear : -Infinity,
      rearMarginPct: rearMarginPct,
      rearColor: isFinite(rearMarginPct) ? marginColor(rearMarginPct) : 'red',
      T_req_rear: T_req_rear,
      // Genel
      overallPass: overallPass
    };

    result.canCross = overallPass;
    result.torqueMargin = Math.min(Tw - T_req_front, isFinite(T_req_rear) ? Tw - T_req_rear : -Infinity);
    result.torqueRatio = isFinite(T_req_rear) && T_req_rear > 0
      ? Math.min(Tw / T_req_front, Tw / T_req_rear)
      : (T_req_front > 0 ? Tw / T_req_front : 0);
  } else {
    result.canCross = true; // Veri eksik, geometrik geçerlilik yeterli
    result.decision = null;
  }

  // ── ADIM 5b: KÖŞE DEFLEKSİYONU DÜZELTMESİ (opsiyonel) ──
  if(hasCornerDefl && stallResult && stallResult.hasData) {
    var R_corner = R_eff - (cornerDeflection / 1000);

    // Geçerlilik kontrolü
    if(R_corner > 0 && h < R_corner && h !== R_corner) {
      var Tw_c = stallResult.T_wheel; // T_wheel değişmez
      var x_c = Math.sqrt(2 * R_corner * h - h * h);
      var theta_c_rad = Math.acos(x_c / R_corner);
      var theta_c_deg = theta_c_rad * 180 / Math.PI;
      var hR_c = h / R_corner;
      var diffLabel_c;
      if(hR_c < 0.5) diffLabel_c = 'Kolay';
      else if(hR_c < 0.75) diffLabel_c = 'Orta';
      else diffLabel_c = 'Zor';

      // Tork gereksinimleri
      var D_front_c = L + x_c;
      var N_f_c = W * a2 / D_front_c;
      var T_req_front_c = (N_f_c / 2) * x_c;

      var D_rear_c = L - x_c;
      var T_req_rear_c;
      if(D_rear_c <= 0) {
        T_req_rear_c = Infinity;
      } else {
        var N_r_c = W * a1 / D_rear_c;
        T_req_rear_c = (N_r_c / 2) * x_c;
      }

      // Karar
      var frontPass_c = Tw_c >= T_req_front_c;
      var frontMarginPct_c = T_req_front_c > 0 ? ((Tw_c - T_req_front_c) / T_req_front_c) * 100 : Infinity;
      var rearPass_c, rearMarginPct_c;
      if(isFinite(T_req_rear_c) && T_req_rear_c > 0) {
        rearPass_c = Tw_c >= T_req_rear_c;
        rearMarginPct_c = ((Tw_c - T_req_rear_c) / T_req_rear_c) * 100;
      } else {
        rearPass_c = false;
        rearMarginPct_c = -Infinity;
      }
      var overallPass_c = frontPass_c && rearPass_c;

      function marginColor_c(pct) {
        if(pct < 0) return 'red';
        if(pct <= 5) return 'yellow';
        return 'green';
      }

      result.cornerCorrection = {
        R_corner: R_corner,
        cornerDeflection: cornerDeflection,
        geometry: {
          x: x_c,
          theta_rad: theta_c_rad,
          theta_deg: theta_c_deg,
          hR_ratio: hR_c,
          difficultyLabel: diffLabel_c
        },
        torqueAnalysis: {
          D_front: D_front_c,
          T_req_front: T_req_front_c,
          D_rear: D_rear_c,
          T_req_rear: T_req_rear_c
        },
        decision: {
          T_wheel: Tw_c,
          frontPass: frontPass_c,
          frontMarginNm: Tw_c - T_req_front_c,
          frontMarginPct: frontMarginPct_c,
          frontColor: marginColor_c(frontMarginPct_c),
          T_req_front: T_req_front_c,
          rearPass: rearPass_c,
          rearMarginNm: isFinite(T_req_rear_c) ? Tw_c - T_req_rear_c : -Infinity,
          rearMarginPct: rearMarginPct_c,
          rearColor: isFinite(rearMarginPct_c) ? marginColor_c(rearMarginPct_c) : 'red',
          T_req_rear: T_req_rear_c,
          overallPass: overallPass_c
        }
      };
    }
  }

  result.timestamp = new Date().toISOString();
  return result;
}

// ══════════════════════════════════════════════════════════════════════════════
// ENGEL ATLAMA — DİNAMİK SİMÜLASYON (Zaman Adımlı)
// ══════════════════════════════════════════════════════════════════════════════
// Mevcut statik analizin sonuçlarını ve aktarma zinciri verilerini kullanarak
// zaman adımlı dinamik modelleme yapar.
// obsResult: veFTRunObstacleCrossingAnalysis() sonucu
// dynOpts: { dt, rampTime, Cr, J_engine, J_tc, momentumCarry }
function veFTRunObstacleDynamicSim(obsResult, dynOpts) {
  var opts = dynOpts || {};
  var dt = opts.dt || 0.001;                  // Zaman adımı (s) — varsayılan 1 ms
  var rampTime = opts.rampTime || 0.42;       // Gaz pedalı rampa süresi (s)
  var DD_initial = opts.DD_initial || 9;      // DD başlangıç değeri (%) — sürücü ayağı pedalde
  var Cr = opts.Cr || 0.015;                  // Yuvarlanma direnci katsayısı

  // Motor ataleti: önce opts'tan, yoksa motor bileşeninden oku
  var engineNode_dyn = nodes.find(function(n) { return n.type === 'engine'; });
  var ed_dyn = engineNode_dyn ? (engineNode_dyn.data || {}) : {};
  var specs_dyn = ed_dyn.motorSpecs || {};
  var J_engine_from_spec = parseFloat(specs_dyn.inertia);
  var J_engine = opts.J_engine || (isFinite(J_engine_from_spec) && J_engine_from_spec > 0 ? J_engine_from_spec : 0.50);

  var J_tc = opts.J_tc || 0.3;               // TC pump ataleti (kg·m²)
  var momentumCarry = false;                  // Arka teker her zaman v=0'dan başlar
  var maxTime = opts.maxTime || 30.0;         // Maksimum simülasyon süresi (s)
  var stallTimeout = opts.stallTimeout || 2.0; // Stall tespit süresi (s)

  // TC Sıvı Ataleti parametresi
  // Konvertör kabuğu içindeki ATF sıvısının rotasyonel ataleti.
  // CAN-bus doğrulaması: motor tork artışı ile TC pump quadratic yükü birbirini
  // dengelediğinden T_net ≈ sabit kalır → sabit J_eff ile doğrusal RPM artışı elde edilir.
  // SR'ye bağlı model gereksiz — CAN verisindeki doğrusal profille uyumsuz S-eğrisi üretir.
  // Kalibrasyon: CAN dN/dt ~700 RPM/s, sim ~490 → oran 1.4x → J_eff = 5.3/1.4 ≈ 3.8 → J_fluid ≈ 3.0
  var J_fluid = opts.J_fluid || 3.0;         // TC sıvı ataleti (kg·m²) — CAN dN/dt kalibrasyonu

  var inp = obsResult.inputParams;
  var stl = obsResult.stallAnalysis;
  if(!stl || !stl.hasData) {
    return { success: false, reason: 'Stall analiz verisi eksik.' };
  }

  var mass = inp.mass;
  // Köşe defleksiyonu varsa R_corner kullan (statik analizle tutarlılık)
  var R_eff = (obsResult.cornerCorrection && obsResult.cornerCorrection.R_corner > 0)
            ? obsResult.cornerCorrection.R_corner
            : inp.R_eff;
  var h = inp.h;
  var a1 = inp.a1;
  var a2 = inp.a2;
  var L = inp.wheelbase;
  var g_const = 9.81;
  var W = mass * g_const;
  var n_d = stl.n_d;
  var gbTorqueLimit_dyn = (inp.gbTorqueLimit && inp.gbTorqueLimit > 0) ? inp.gbTorqueLimit : null;

  // Aktarma oranları
  var i_g = stl.gearRatio;
  var i_tr = stl.i_transfer;
  var i_diff = stl.i_axle;
  var eta_total = stl.eta_total;
  var i_total = i_g * i_tr * i_diff;

  // Motor ve TC bileşenlerini yeniden oluştur
  var engineNode = nodes.find(function(n) { return n.type === 'engine'; });
  var ed = engineNode ? (engineNode.data || {}) : {};
  var torqueTable = ed.torqueData || [];
  var specs = ed.motorSpecs || {};
  var governedSpeed = parseFloat(specs.governedSpeed || ed.governedRpm) || 2100;
  var noLoadGoverned = parseFloat(specs.noLoadGoverned) || (governedSpeed + 200);
  var idleRpm = parseFloat(specs.idleRpm) || 700;

  var grossMotorTorqueFn = FT_SOLVER.createMotorTorqueFn(torqueTable, governedSpeed, noLoadGoverned);

  // Aksesuar kayıpları
  var accList = ed.accessories || [];
  var accTotalFanLoss = 0, accTotalOtherLoss = 0, accFanMode = 'clutch';
  accList.forEach(function(a) {
    var loss = parseFloat(a.userLoss) || 0;
    if(loss <= 0) return;
    if(a.name && a.name.toLowerCase().indexOf('fan') >= 0) {
      accTotalFanLoss += loss;
      if(a.fanMode) accFanMode = a.fanMode;
    } else {
      accTotalOtherLoss += loss;
    }
  });
  var hasAccessoryLoss = (accTotalFanLoss + accTotalOtherLoss) > 0;

  function motorTorqueFn(rpm) {
    var T_gross = grossMotorTorqueFn(rpm);
    if(!hasAccessoryLoss || rpm <= 0) return T_gross;
    var ratio = rpm / governedSpeed;
    var P_fan_kW = (accFanMode === 'on') ? accTotalFanLoss : accTotalFanLoss * ratio * ratio * ratio;
    var P_loss_kW = P_fan_kW + accTotalOtherLoss * ratio;
    var omega = 2 * Math.PI * rpm / 60;
    var T_loss = P_loss_kW * 1000 / omega;
    return Math.max(0, T_gross - T_loss);
  }

  // TC fonksiyonları
  var tcNode = nodes.find(function(n) { return n.type === 'torque-converter'; });
  var tcd = tcNode ? (tcNode.data || {}) : {};
  var tcDataArr = tcd.tcData || [];
  var pumpTorqueDrop = tcd.pumpTorqueDrop !== undefined ? parseFloat(tcd.pumpTorqueDrop) : 14.9;
  var tcFns = FT_SOLVER.createTCFunctions(tcDataArr);

  // ══════════════════════════════════════════════════════════════════════════
  // MOTOR-KONVERTÖR EŞLEŞME TABLOSU (SCAAN Tarzı)
  // ══════════════════════════════════════════════════════════════════════════
  // Her SR için steady-state denge noktasını hesapla:
  //   T_engine(N) = T_pump(N, SR) + pump_drop  →  N_match bulunur
  //   T_turbine = T_pump × TR(SR)   (T_engine × TR DEĞİL — SCAAN doğrulaması)
  //   T_gb = T_turbine × i_g × η_gear
  //   T_wheel = T_gb × i_tr × i_diff × η_downstream / n_d
  // ══════════════════════════════════════════════════════════════════════════

  var matchTable = [];
  var K_pump_0 = (tcFns.data && tcFns.data.length > 0) ? tcFns.kpump(0) : 84.0;

  // Verim ayrıştırması
  var eta_gear_val = stl.eta_gear || 1.0;
  var eta_downstream_base = eta_gear_val > 0 ? eta_total / eta_gear_val : eta_total;

  // ── T_gb limit → Motor tork yüzdesi dönüşümü ──
  // Kullanıcı T_gb_limit girerse, program iteratif olarak motor tork yüzdesini bulur.
  // T_gb = T_pump × TR_stall × i_g × η_gear  ve  T_pump = (N / K_pump_0)²
  // T_motor_limited(N) = T_gross(N) × pct
  // Stall dengesi: T_gross(N) × pct = T_pump(N) + pump_drop  iterasyonla çözülür.
  var motorTorquePct = 1.0;  // varsayılan: %100 (limit yok)
  if(gbTorqueLimit_dyn) {
    var TR_0 = tcFns.tau(0);
    // İlk tahmin: stall'dan ters hesap
    var T_pump_target = gbTorqueLimit_dyn / (TR_0 * i_g * eta_gear_val);
    var N_stall_est = K_pump_0 * Math.sqrt(Math.max(0, T_pump_target));
    N_stall_est = Math.max(idleRpm, Math.min(governedSpeed, N_stall_est));

    // İteratif çözüm (2-5 iterasyon yeterli)
    for(var pctIter = 0; pctIter < 10; pctIter++) {
      var T_gross_at_stall = motorTorqueFn(N_stall_est);
      if(T_gross_at_stall <= 0) break;
      var T_motor_needed = T_pump_target + pumpTorqueDrop;
      motorTorquePct = T_motor_needed / T_gross_at_stall;
      motorTorquePct = Math.max(0.1, Math.min(1.0, motorTorquePct));

      // Yeni stall RPM hesapla: T_gross(N) × pct = (N/K)² + pump_drop
      var N_new = idleRpm;
      for(var rpm2 = Math.ceil(idleRpm); rpm2 <= governedSpeed; rpm2 += 1) {
        var T_lim = motorTorqueFn(rpm2) * motorTorquePct;
        var T_p = (rpm2 / K_pump_0) * (rpm2 / K_pump_0);
        if(T_lim >= T_p + pumpTorqueDrop) {
          N_new = rpm2;
        } else {
          break;
        }
      }

      // Yakınsama kontrolü
      if(Math.abs(N_new - N_stall_est) < 1) break;
      N_stall_est = N_new;

      // T_pump_target'ı güncelle (stall RPM değişti)
      T_pump_target = (N_stall_est / K_pump_0) * (N_stall_est / K_pump_0);
    }
  }

  // Limitli motor tork fonksiyonu
  var motorTorqueLimitedFn = function(rpm) {
    return motorTorqueFn(rpm) * motorTorquePct;
  };

  var matchSRs = [0.00, 0.10, 0.20, 0.30, 0.40, 0.50, 0.60, 0.634, 0.70, 0.75, 0.80, 0.825, 0.85, 0.875, 0.91, 0.924, 0.939, 0.95, 0.975, 0.99];
  for(var mi = 0; mi < matchSRs.length; mi++) {
    var sr_m = matchSRs[mi];
    var K_m = (tcFns.data && tcFns.data.length > 0) ? tcFns.kpump(sr_m) : 84.0;
    var TR_m = tcFns.tau(sr_m);

    // Denge noktası: T_engine_limited(N) = (N / K_m)² + pump_drop
    var N_m = 2000;
    for(var iter = 0; iter < 100; iter++) {
      var T_eng_m = motorTorqueLimitedFn(N_m);
      var T_pump_m = (N_m / K_m) * (N_m / K_m);
      var residual = T_eng_m - T_pump_m - pumpTorqueDrop;
      var dTe = (motorTorqueLimitedFn(N_m + 1) - motorTorqueLimitedFn(N_m - 1)) / 2;
      var dTp = 2 * N_m / (K_m * K_m);
      var dR = dTe - dTp;
      if(Math.abs(dR) < 1e-8) break;
      N_m = N_m - residual / dR;
      N_m = Math.max(idleRpm, Math.min(noLoadGoverned, N_m));
      if(Math.abs(residual) < 0.1) break;
    }

    // Denge bulunamadıysa (motor torku her yerde pump'tan yüksek): governed hız kullan
    var T_eng_check = motorTorqueLimitedFn(N_m);
    var T_pump_check = (N_m / K_m) * (N_m / K_m);
    if(N_m <= idleRpm + 5 || (T_eng_check - T_pump_check - pumpTorqueDrop) > 50) {
      N_m = governedSpeed;
    }

    var T_eng_final = motorTorqueLimitedFn(N_m);
    var T_pump_final = (N_m / K_m) * (N_m / K_m);
    var T_turbine_m = T_pump_final * TR_m;
    var _eta_gear_m = FT_SOLVER.calcGearEfficiency(i_g, N_m * sr_m);
    var T_gb_m = T_turbine_m * i_g * _eta_gear_m;
    var T_wheel_m = T_gb_m * i_tr * i_diff * eta_downstream_base / n_d;

    var eta_tc_m = sr_m > 0 ? (sr_m * TR_m) : 0;
    var P_eng_kW = T_eng_final * N_m * 2 * Math.PI / 60 / 1000;
    var P_turb_kW = T_turbine_m * (N_m * sr_m) * 2 * Math.PI / 60 / 1000;
    var Q_reject_kW = P_eng_kW - P_turb_kW;

    var matchPoint = '';
    if(sr_m === 0) matchPoint = 'Stall';
    else if(eta_tc_m >= 0.69 && eta_tc_m < 0.71) matchPoint = '70 Percent';
    else if(eta_tc_m >= 0.79 && eta_tc_m < 0.81) matchPoint = '80 Percent';
    else if(eta_tc_m >= 0.84 && eta_tc_m < 0.86) matchPoint = '85 Percent';
    else if(Math.abs(TR_m - 1.0) < 0.02) matchPoint = 'Coupling';
    else if(N_m >= governedSpeed - 10) matchPoint = 'Governed';

    matchTable.push({
      SR: sr_m,
      TR: TR_m,
      K_pump: K_m,
      N_engine: Math.round(N_m),
      T_engine: Math.round(T_eng_final * 10) / 10,
      P_engine_kW: Math.round(P_eng_kW * 10) / 10,
      T_pump: Math.round(T_pump_final * 10) / 10,
      T_turbine: Math.round(T_turbine_m * 10) / 10,
      T_gb_out: Math.round(T_gb_m * 10) / 10,
      T_wheel: Math.round(T_wheel_m * 10) / 10,
      P_turbine_kW: Math.round(P_turb_kW * 10) / 10,
      Q_reject_kW: Math.round(Q_reject_kW * 100) / 100,
      eta_tc: Math.round(eta_tc_m * 1000) / 1000,
      matchPoint: matchPoint
    });
  }

  // Başlangıç açısı
  var x0 = Math.sqrt(2 * R_eff * h - h * h);
  var phi_start = Math.asin(x0 / R_eff);

  // Durum değişkenleri
  var v = 0;
  var N_engine = idleRpm;
  var t = 0;
  var phi = phi_start;
  var phase = 'front'; // 'front' veya 'rear'
  var frontCompleted = false;
  var frontCompletionTime = 0;
  var frontCompletionSpeed = 0;
  var stallDetected = false;
  var stallPhase = '';
  var simComplete = false;
  var simSuccess = false;
  var reason = '';
  var stallCheckStart = -1; // Gaz %100 ve v=0 olduğu ilk an

  // Zaman serisi verileri (kullanıcı seçimine göre kaydet)
  var log = [];
  var logIntervalSec = opts.logInterval || 0.01; // varsayılan 10 ms
  var logInterval = Math.max(1, Math.round(logIntervalSec / dt));
  var stepCount = 0;
  var maxSteps = Math.ceil(maxTime / dt);

  // Rölanti torku yaklaşımı
  var T_idle_ratio = 0.21;

  // Faz özet verileri
  var frontPeakTreq = 0, frontPeakTwheel = 0, frontMaxSpeed = 0;
  var rearPeakTreq = 0, rearPeakTwheel = 0, rearMaxSpeed = 0;
  var frontPeakTreqTime = 0, rearPeakTreqTime = 0;

  // Milestone (önemli olay) takibi
  var milestones = [];
  var _ms = {}; // tekrar eklememek için bayraklar

  function addMilestone(key, label, data) {
    if(_ms[key]) return;
    _ms[key] = true;
    var m = { key: key, t: t, label: label, phase: phase };
    if(data) {
      for(var k in data) { if(data.hasOwnProperty(k)) m[k] = data[k]; }
    }
    milestones.push(m);
  }

  // Önceki adımdaki bazı değerler (değişim tespiti için)
  var gbLimitActivated = false;  // T_gb henüz limite ulaşmadı
  var prev_v = 0;
  var prev_phi = phi_start;
  var prev_T_wheel_vs_req = false; // T_wheel >= T_req miydi?

  // ── ANA DÖNGÜ ──
  while(stepCount < maxSteps && !simComplete) {
    stepCount++;

    // ── Hesap 1: Sürücü talebi (DD) ──
    // Engel senaryosunda sürücü tam gaz — DD her zaman %100
    var DD = 100;

    // ── Hesap 2: TC hız oranı (SR) ──
    var N_turbin = (v > 1e-6) ? (v / R_eff) * i_total * 60 / (2 * Math.PI) : 0;
    var SR = (N_engine > 0) ? Math.min(0.99, N_turbin / N_engine) : 0;

    // ── Hesap 3: TC tork oranı (TR) ──
    var TR = tcFns.tau(SR);

    // ── Hesap 4b: Pump torku (TC sıvı yükü) — önce hesaplanır ──
    // T_pump = (N / K_pump_stall)² — pump'ın sıvıya uyguladığı tork
    // Stall K-factor kullanılır (SR=0): transient'te TC sıvı ataleti
    // K_pump'ın SR ile değişimini geciktirir → sabit K_pump yaklaşımı.
    var T_pump_absorbed = (N_engine / K_pump_0) * (N_engine / K_pump_0);

    // ── T_gb limit aktivasyon kontrolü ──
    // T_gb'yi tam yükte hesapla, limite ulaştı mı bak
    var T_turbine_check = T_pump_absorbed * TR;
    var T_gb_check = T_turbine_check * i_g * eta_gear_val;
    if(gbTorqueLimit_dyn && !gbLimitActivated && T_gb_check >= gbTorqueLimit_dyn) {
      gbLimitActivated = true;
      addMilestone(msPrefix + 'gb_limit', (phase === 'front' ? 'On' : 'Arka') + ' teker: T_gb limite ulasti (' + Math.round(gbTorqueLimit_dyn) + ' Nm), motor tork %' + (motorTorquePct * 100).toFixed(1) + ' ile sinirlandirildi', {
        T_gb_out: T_gb_check, N_engine: N_engine
      });
    }

    // ── Hesap 4: Motor torku ──
    // T_gb limite ulaşmadan: motor tam yükte çalışır (%100)
    // T_gb limite ulaştıktan sonra: motor tork yüzdesi uygulanır
    var T_full_load = motorTorqueFn(N_engine);
    var T_engine = gbLimitActivated ? (T_full_load * motorTorquePct) : T_full_load;

    // ── Hesap 5: Şanzıman çıkış torku ve teker torku ──
    // SCAAN doğrulaması: T_turbine = T_pump × TR  (T_engine × TR DEĞİL!)
    // Motor torkun bir kısmı dönen kütlelerin ivmelenmesine gider (J_eff × α).
    // Sadece T_pump sıvı üzerinden türbine aktarılır.
    var T_turbine = T_pump_absorbed * TR;
    var T_gb_out = T_turbine * i_g * eta_gear_val;
    var T_gb_limited = gbLimitActivated;
    // T_wheel = T_gb_out × i_tr × i_diff × η_downstream / n_d
    var T_wheel = T_gb_out * eta_downstream_base * i_tr * i_diff / n_d;

    // ── Hesap 6: Anlık gerekli tork ──
    var moment_kolu = R_eff * Math.sin(phi);
    var T_req_anlik = 0;
    var N_aks = 0; // Aktif akstaki toplam reaksiyon (ikiye bölünmemiş)
    if(moment_kolu > 0) {
      if(phase === 'front') {
        var D_on = L + moment_kolu;
        N_aks = W * a2 / D_on;
        T_req_anlik = (N_aks / 2) * moment_kolu;
      } else {
        var D_arka = L - moment_kolu;
        if(D_arka > 0) {
          N_aks = W * a1 / D_arka;
          T_req_anlik = (N_aks / 2) * moment_kolu;
        } else {
          N_aks = Infinity;
          T_req_anlik = Infinity;
        }
      }
    }
    // moment_kolu <= 0: tepeyi geçmiş, T_req = 0

    // ── Hesap 7: Net kuvvet ve ivme ──
    // İtme kuvveti: engeldeki aks + düz zemindeki aksın katkısı (φ-bağımlı)
    // Engeldeki 2 teker: direkt tork → moment = T_wheel × 2
    // Düz zemindeki 2 teker: yatay kuvvet, P'ye moment kolu = R_corner × cos(φ)
    //   φ=75.5° (başlangıç): cos=0.244 → düşük katkı
    //   φ=0° (tepe): cos=1.0 → maksimum katkı
    // n_eff(φ) = 2 × [1 + (R_corner / R_eff) × cos(φ)]
    var R_corner_val = R_eff;  // dinamik simde R_eff zaten R_corner olabilir
    var R_flat_val = inp.R_eff;  // düz zemindeki teker yarıçapı
    var cos_phi = Math.cos(phi);
    var n_eff = 2 * (1 + (R_corner_val / R_flat_val) * cos_phi);
    var F_itme = T_wheel * n_eff / R_eff;
    var F_engel = 0;
    if(moment_kolu > 0 && isFinite(N_aks)) {
      F_engel = N_aks * moment_kolu / R_eff;
    }
    // Yuvarlanma direnci: engel senaryosunda ihmal edilebilir (~%2.6)
    // Engel direnci ~42kN, yuvarlanma ~1.1kN — ayrıca v=0'da chatter yaratıyor
    var F_yuvarlanma = 0;
    var F_net = F_itme - F_engel - F_yuvarlanma;
    var acc = F_net / mass;

    // Durma koruması: hız sıfır ve net kuvvet negatifse ivme sıfır
    if(v < 1e-9 && F_net <= 0) {
      acc = 0;
    }

    // ── Hesap 8: Hız ve açı güncelleme ──
    var v_new = Math.max(0, v + acc * dt);
    var phi_new = phi;
    if(v_new > 1e-9) {
      var dPhi = v_new / R_eff * dt;
      phi_new = phi - dPhi;
    }

    // ── Hesap 9: Motor devri güncelleme — TC sıvı dinamiği modeli ──
    //
    // Fizik: Motor, TC pump'ın quadratic yükü ve sıvı ataleti ile dengelenir.
    //   T_pump(N) = (N / K_pump_stall)²  — Hesap 4b'de hesaplandı
    //   T_net = T_engine(N) - T_pump(N) - pump_drop
    //   J_eff = J_mech + J_fluid (sabit)
    //   alpha = T_net / J_eff              — açısal ivmelenme
    //
    // Motor doğal olarak stall devrinde (~N_stall) stabilize olur.
    // Governed devrine (2500 RPM) asla ulaşamaz — TC pump yükü baskın.
    // ECM rate limiter YOK — yavaş devir artışı tamamen sıvı ataleti.

    // T_pump_absorbed zaten Hesap 4b'de hesaplandı: (N_engine / K_pump_0)²

    // Net tork: motor çıkışı - pump yükü - mekanik kayıplar
    var T_net_engine = T_engine - T_pump_absorbed - pumpTorqueDrop;

    // Efektif atalet: mekanik parçalar + TC sıvı ataleti (sabit)
    // CAN-bus doğrulaması: T_net ≈ sabit olduğundan sabit J_eff
    // doğrusal RPM artış profili üretir (CAN ile uyumlu).
    var J_mech = J_engine + J_tc;
    var J_eff = J_mech + J_fluid;

    // Açısal ivmelenme
    var alpha_engine = 0;
    if(T_net_engine > 0) {
      alpha_engine = T_net_engine / J_eff;
    } else if(T_net_engine < 0 && N_engine > idleRpm) {
      // Negatif net tork: motor yavaşlıyor (stall üzerindeyse)
      alpha_engine = T_net_engine / J_eff;
    }

    // RPM güncelleme
    var omega_engine = N_engine * 2 * Math.PI / 60;
    var omega_new = omega_engine + alpha_engine * dt;
    var N_engine_new = omega_new * 60 / (2 * Math.PI);

    // Sınırla: rölanti altına düşmesin
    N_engine_new = Math.max(idleRpm, N_engine_new);

    // ── Faz özet istatistikler ──
    if(phase === 'front') {
      if(T_req_anlik > frontPeakTreq) { frontPeakTreq = T_req_anlik; frontPeakTreqTime = t; }
      if(T_wheel > frontPeakTwheel) frontPeakTwheel = T_wheel;
      if(v_new > frontMaxSpeed) frontMaxSpeed = v_new;
    } else {
      if(T_req_anlik > rearPeakTreq) { rearPeakTreq = T_req_anlik; rearPeakTreqTime = t; }
      if(T_wheel > rearPeakTwheel) rearPeakTwheel = T_wheel;
      if(v_new > rearMaxSpeed) rearMaxSpeed = v_new;
    }

    // ── Milestone tespitleri ──
    var msPrefix = phase === 'front' ? 'f_' : 'r_';

    // Teker engele dokunuyor (simülasyon başlangıcı)
    if(stepCount === 1) {
      addMilestone('f_contact', 'On teker engel kosesine temas', {
        phi_deg: phi * 180 / Math.PI, T_req: T_req_anlik, T_wheel: T_wheel
      });
    }

    // İlk hareket anı (v sıfırdan pozitife geçiş)
    if(prev_v < 1e-9 && v_new > 1e-6) {
      addMilestone(msPrefix + 'first_move', (phase === 'front' ? 'On' : 'Arka') + ' teker harekete basladi', {
        v: v_new, T_wheel: T_wheel, T_req: T_req_anlik, N_engine: N_engine_new, DD: DD
      });
    }

    // T_wheel ilk kez T_req'i aştı (yeterli tork anı)
    var currentTwVsReq = isFinite(T_req_anlik) && T_wheel >= T_req_anlik;
    if(currentTwVsReq && !prev_T_wheel_vs_req && T_req_anlik > 0) {
      addMilestone(msPrefix + 'torque_sufficient', (phase === 'front' ? 'On' : 'Arka') + ' teker: T_wheel >= T_req', {
        T_wheel: T_wheel, T_req: T_req_anlik, margin_pct: ((T_wheel - T_req_anlik) / T_req_anlik * 100)
      });
    }
    prev_T_wheel_vs_req = currentTwVsReq;

    // Gaz pedalı %100'e ulaştı
    if(DD >= 100 && !_ms['gas_100']) {
      addMilestone('gas_100', 'Gaz pedali %100 (tam yuk)', {
        N_engine: N_engine_new, T_engine: T_engine, T_wheel: T_wheel
      });
    }

    // Tepe noktası (φ sıfırı geçiyor, teker P'nin tam üstüne geliyor)
    if(prev_phi > 0 && phi_new <= 0) {
      addMilestone(msPrefix + 'apex', (phase === 'front' ? 'On' : 'Arka') + ' teker tepe noktasina ulasti (phi=0)', {
        v: v_new, phi_deg: phi_new * 180 / Math.PI, T_wheel: T_wheel, KE: 0.5 * mass * v_new * v_new
      });
    }

    // Arka teker fazına geçiş milestone'u (faz geçişi kodundan sonra eklenir, aşağıda)

    prev_v = v_new;
    prev_phi = phi_new;

    // ── Veri kaydı ──
    if(stepCount % logInterval === 0 || stepCount === 1) {
      log.push({
        t: t,
        v: v_new,
        N_engine: N_engine_new,
        T_engine: T_engine,
        T_pump: T_pump_absorbed,
        T_turbine: T_turbine,
        TR: TR,
        SR: SR,
        T_gb_out: T_gb_out,
        T_gb_lim: T_gb_limited,
        T_wheel: T_wheel,
        T_req: T_req_anlik,
        phi_deg: phi_new * 180 / Math.PI,
        F_itme: F_itme,
        F_engel: F_engel,
        F_net: F_net,
        KE: 0.5 * mass * v_new * v_new,
        DD: DD,
        phase: phase
      });
    }

    // ── Hesap 10: Faz geçişi kontrolü ──
    if(phi_new <= -phi_start) {
      if(phase === 'front') {
        frontCompleted = true;
        frontCompletionTime = t;
        frontCompletionSpeed = v_new;
        addMilestone('f_complete', 'On teker engeli asti', {
          v: v_new, duration: t, KE: 0.5 * mass * v_new * v_new
        });
        // Arka teker fazına geç
        phase = 'rear';
        phi_new = phi_start; // Arka teker için sıfırla
        // Arka teker engele değdiğinde araç durur — momentum taşınmaz
        v_new = 0;
        N_engine_new = idleRpm;
        stallCheckStart = -1; // Stall sayacını sıfırla
        prev_T_wheel_vs_req = false; // Arka teker için sıfırla
        gbLimitActivated = false;   // Arka teker için T_gb limiti tekrar tetiklenebilir
        // (ECM kaldırıldı — TC sıvı dinamiği modeli kullanılıyor)
        addMilestone('r_contact', 'Arka teker engel kosesine temas', {
          phi_deg: phi_new * 180 / Math.PI, v: v_new, N_engine: N_engine_new
        });
      } else {
        // Arka teker de aştı — başarılı
        addMilestone('r_complete', 'Arka teker engeli asti', {
          v: v_new, totalTime: t, KE: 0.5 * mass * v_new * v_new
        });
        simComplete = true;
        simSuccess = true;
        reason = 'Her iki teker de engeli basariyla asti.';
      }
    }

    // ── Stall kontrolü ──
    // Motor devri artarken T_wheel de artıyor — stall kararı vermek için
    // motorun stall dengesine oturmasını beklemek gerekir.
    // Koşul: v=0 VE T_wheel < T_req VE motor devri artışı durmuş (dN/dt ≈ 0)
    var motorSettled = (N_engine_new > 0 && Math.abs(N_engine_new - N_engine) / dt < 5.0);
    if(!simComplete && v_new < 1e-9 && DD >= 99.9 && isFinite(T_req_anlik) && T_wheel < T_req_anlik) {
      if(motorSettled) {
        // Motor stall dengesine ulaştı ve T_wheel hâlâ yetersiz → gerçek stall
        if(stallCheckStart < 0) {
          stallCheckStart = t;
        } else if(t - stallCheckStart >= 0.5) {
          // Motor settle olduktan sonra 0.5s daha bekle (kararlılık)
          stallDetected = true;
          stallPhase = phase;
          simComplete = true;
          simSuccess = false;
          reason = (phase === 'front' ? 'On' : 'Arka') + ' teker fazinda arac takildi (stall). T_wheel (' +
                   T_wheel.toFixed(0) + ' Nm) < T_req (' + T_req_anlik.toFixed(0) + ' Nm).';
          addMilestone(phase === 'front' ? 'f_stall' : 'r_stall',
            (phase === 'front' ? 'On' : 'Arka') + ' teker: STALL — arac takildi', {
            T_wheel: T_wheel, T_req: T_req_anlik, N_engine: N_engine_new, phi_deg: phi_new * 180 / Math.PI
          });
        }
      } else {
        // Motor hâlâ devir artırıyor — stall sayacını sıfırla
        stallCheckStart = -1;
      }
    } else {
      if(v_new > 1e-6) stallCheckStart = -1;
    }

    // Zaman aşımı kontrolü
    if(!simComplete && t >= maxTime) {
      simComplete = true;
      simSuccess = false;
      reason = 'Maksimum simulasyon suresi asildi (' + maxTime + ' s).';
    }

    // Durumları güncelle
    v = v_new;
    phi = phi_new;
    N_engine = N_engine_new;
    t += dt;
  }

  // Son kayıt
  log.push({
    t: t,
    v: v,
    N_engine: N_engine,
    T_engine: 0,
    TR: 0,
    SR: 0,
    T_wheel: 0,
    T_req: 0,
    phi_deg: phi * 180 / Math.PI,
    F_itme: 0,
    F_engel: 0,
    F_net: 0,
    KE: 0.5 * mass * v * v,
    DD: 100,
    phase: phase
  });

  return {
    success: simSuccess,
    reason: reason,
    totalTime: t,
    totalSteps: stepCount,
    dt: dt,
    // Faz bilgileri
    frontCompleted: frontCompleted,
    frontCompletionTime: frontCompletionTime,
    frontCompletionSpeed: frontCompletionSpeed,
    stallDetected: stallDetected,
    stallPhase: stallPhase,
    // Faz istatistikleri
    frontStats: {
      peakTreq: frontPeakTreq,
      peakTreqTime: frontPeakTreqTime,
      peakTwheel: frontPeakTwheel,
      maxSpeed: frontMaxSpeed
    },
    rearStats: {
      peakTreq: rearPeakTreq,
      peakTreqTime: rearPeakTreqTime,
      peakTwheel: rearPeakTwheel,
      maxSpeed: rearMaxSpeed
    },
    // Milestone olayları
    milestones: milestones,
    // Motor-Konvertör Eşleşme Tablosu
    matchTable: matchTable,
    // Parametreler
    params: {
      rampTime: rampTime,
      DD_initial: DD_initial,
      Cr: Cr,
      J_engine: J_engine,
      J_engine_source: (isFinite(J_engine_from_spec) && J_engine_from_spec > 0) ? 'motor bileseni' : 'varsayilan',
      J_tc: J_tc,
      momentumCarry: false,
      phi_start_deg: phi_start * 180 / Math.PI,
      J_fluid: J_fluid,
      gbTorqueLimit: gbTorqueLimit_dyn,
      motorTorquePct: motorTorquePct,
      logIntervalSec: logIntervalSec
    },
    // Zaman serisi
    log: log
  };
}
