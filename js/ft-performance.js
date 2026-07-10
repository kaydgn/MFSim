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
    var tableMaxRpm = rpms[rpms.length - 1];   // tablo verisinin en yüksek devri

    return function(rpm) {
      if(rpm <= 0) return 0;
      var T_net = pchipEval(spline, rpm);
      // Sentetik governor droop YALNIZCA tablo governor bölgesini KAPSAMIYORSA uygulanır.
      // L5D gibi tablo governed'ı aşıp no-load'da sıfıra iniyorsa (ör. 3600→0), droop
      // zaten veridedir → çift-droop olmaması için sentetik olanı UYGULAMA (PCHIP tabloyu izler).
      // Tablo yalnız governed'a kadarsa (üstü düz ekstrapolasyon) sentetik droop gerekir.
      if(noLoadGoverned > governedSpeed && rpm > governedSpeed && tableMaxRpm < noLoadGoverned) {
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

  // OTURMUŞ STALL çalışma noktası (v=0, türbin kilitli, SR=0) — eğim/kalkış METRİKLERİ için.
  // Motor rölantiden yukarı taranır; net motor torku ile pompa emişi (N/K_pump(0))²
  // arasındaki FAZLALIK'ın ilk YEREL MİNİMUMU = teğetlik/asılma noktası (motorun kalkışta
  // fiilen oturduğu devir, ör. L5D+TC-415'te ~1000-1050). Bu, tam gaz stall'ında motorun
  // 2334'e kaçmadan asılı kaldığı yerdir. Teğetlik toleransı (tol), fazlalık tam sıfırı
  // kesmese de (marjinal kombinasyon) yüksek köke kaçmayı önler; fazlalık sıfırı geçerse
  // (gerçek düşük denge) o kesişim kullanılır.
  function computeSettledStall(motorTorqueFn, tcFns, pumpDrop, idleRpm, options) {
    var opts = options || {};
    var tol = (opts.tol != null) ? opts.tol : 15;   // N·m — teğetlik eşiği
    var nMax = opts.nMax || 2600;
    var stepN = opts.step || 5;
    var K0 = tcFns.kpump(0);
    var tau0 = tcFns.tau(0);
    var prevExcess = Infinity, minExcess = Infinity, minN = idleRpm, chosenN = null;
    for(var N = idleRpm; N <= nMax; N += stepN) {
      var excess = motorTorqueFn(N) - pumpDrop - (N * N) / (K0 * K0);
      if(excess < minExcess) { minExcess = excess; minN = N; }
      if(excess <= 0) { chosenN = N; break; }                                 // gerçek düşük denge
      if(excess > prevExcess && minExcess <= tol) { chosenN = minN; break; }  // teğetlik/asılma
      prevExcess = excess;
    }
    if(chosenN === null) chosenN = minN;   // teğetlik yoksa en düşük fazlalık noktası
    var T_pump = (chosenN * chosenN) / (K0 * K0);
    return { N_engine: chosenN, T_pump: T_pump, T_turbine: T_pump * tau0, tau: tau0, SR: 0, minExcess: minExcess };
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
    computeSettledStall: computeSettledStall,
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
  var I_conv = tcNode ? 0.5 : 0.0;           // TC toplam atalet (lockup modda) — TK yoksa 0
  var I_conv_turbine = tcNode ? 0.3 : 0.0;   // TC türbin ataleti (converter modda) — TK yoksa 0
  // Converter-mod rev-up ataleti: motor krank+volan + konvertör pompası (impeller tarafı).
  // Kalkışta motorun idle→stall tırmanma hızını (dolayısıyla ~1 sn avansı) belirler.
  var I_eng_rev = I_engine + Math.max(0, I_conv - I_conv_turbine);
  // Konvertör-eşleşme (düşük dal) kopuş eşiği [N·m]: kalkışta motor, teğet bölgesindeki
  // net-tork fazlalığı bu eşiğin ALTINDA olduğu sürece eşleşme noktasında TUTULUR (oyalanır,
  // iSCAAN gibi). Fazlalık eşiği aşınca (araç ~5-6 km/h) düşük dal bozulur → motor KOPAR ve
  // serbest rev-up ile yüksek dala tırmanır. Değer iSCAAN kopuş hızına göre kalibre.
  var CONV_MATCH_THRESHOLD = 45;

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
    var result;
    if(ds.type === 'piecewise') {
      result = (esl <= ds.breakpoint) ? (ds.low.a * esl + (ds.low.b || 0)) : (ds.high.a * esl + (ds.high.b || 0));
    } else if(ds.type === 'segments') {
      for(var si = 0; si < ds.segments.length; si++) {
        var seg = ds.segments[si];
        if((seg.maxESL !== undefined && esl <= seg.maxESL) || si === ds.segments.length - 1) {
          result = seg.cap !== undefined ? seg.cap : (seg.a * esl + (seg.b || 0));
          break;
        }
      }
      if(result === undefined) result = 0;
    } else if(ds.capValue !== undefined && ds.capBelow !== undefined && esl < ds.capBelow) {
      result = ds.capValue;
    } else {
      result = ds.a * esl + (ds.b || 0);
    }
    // minCap: minimum eşik değeri (formül altına düşmesini engeller)
    if(ds.minCap !== undefined && result < ds.minCap) result = ds.minCap;
    return result;
  }

  var shiftState = {
    gearIdx: 0,
    isLockup: false,   // Başlangıç: 1C (converter mod) — TK varsa; TK yoksa etiket salt vites no
    shiftHistory: []    // [{t, fromGear, toGear, fromMode, toMode, v_kmh, N_engine, SR}]
  };

  // Vites-modu etiketi. TK VARSA 'C' (converter) / 'L' (lockup) soneki; TK YOKSA
  // konvertör/kilit kavramı olmadığından SALT vites numarası (doğrudan tahrik).
  // NOT: lockup anahtar araması (shiftKey) ayrı hesaplanır — bu yalnızca ETİKET üretir.
  function veGearModeLabel(gearNum, isLU) {
    return tcNode ? (gearNum + (isLU ? 'L' : 'C')) : String(gearNum);
  }

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
      // N_out = şanzıman çıkış devri. KİNEMATİK (araç hızından) — dinamik motor
      // devrinde SR 0.99'a kısılabildiği için N_engine×SR/i_gear güvenilmez;
      // çıkış mili devri yalnız araç hızına + downstream oranlara bağlıdır.
      // (SR kısılmadığında N_engine×SR/i_gear ile birebir aynı değer.)
      var i_gear_current = parseFloat(getCurrentGearData().ratio) || 1.0;
      var N_out = (v_kmh / 3.6 / r_tire) * (i_propshaft * i_transfer * i_axle) * 60 / (2 * Math.PI);

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
            t: t, fromGear: g, toGear: 1, fromMode: veGearModeLabel(1, false), toMode: veGearModeLabel(2, false),
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
            t: t, fromGear: 1, toGear: 1, fromMode: veGearModeLabel(2, false), toMode: veGearModeLabel(2, true),
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
            t: t, fromGear: g, toGear: g + 1, fromMode: veGearModeLabel(g + 1, true), toMode: veGearModeLabel(g + 2, true),
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
          var dsFromName = veGearModeLabel(g + 1, true);
          var dsToName = veGearModeLabel(g, true);
          // 2→1 özel durum: converter moda geçiş (yalnız TK varsa; TK yoksa kilit yok)
          if(g === 1 && tcNode) {
            dsToName = veGearModeLabel(1, false);
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
    var engRate = null;   // converter modda motor devri değişim hızı [rpm/s]; lockup/no-TC'de null (hıza kilitli)
    var onLowBranch = false;   // converter modda motor konvertör-eşleşme (düşük dal) noktasında mı TUTULUYOR

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
      SR = 1.0;
      tau = 1.0;
      if(!tcNode) {
        // ── TK YOK: gerçek doğrudan tahrik (Motor ⇄ Şanzıman rijit) ──
        // Olmayan bir konvertörün pompa tork düşüşü / kilit-klaç sürtünmesi / konvertör
        // verimi UYGULANMAZ. Tek kayıp: dişli mekanik verimi (ftGearData.eff) — tork kaybı.
        var eta_direct = (parseFloat(gearData.eff) || 98.0) / 100;
        if(eta_direct <= 0 || eta_direct > 1) eta_direct = 0.98;
        T_pump = T_engine;
        T_output = T_engine * eta_direct;
        tcEta = eta_direct;
        // Isı reddi: yalnız dişli mekanik kaybı (motor gücü × (1−η))
        var omega_dir = N_engine * 2 * Math.PI / 60;
        heatRejection_kW = Math.max(0, T_engine * omega_dir * (1 - eta_direct) / 1000);
      } else {
        // ── KİLİTLİ KONVERTÖR (lockup) — YALNIZ kilit-klaç sürtünmesi ──
        // SR=1, τ=1: pompa ve türbin BİRLİKTE döner → hidrolik pompa emişi (N²/K²) sıfırdır →
        // pompa tork düşümü (17.6) UYGULANMAZ (yalnız kayma varken / converter modda oluşur).
        // Tek konvertör-kaynaklı kayıp kilit-klaç sürtünmesidir. Dişli mekanik kaybı düz 0.965
        // çarpanı yerine aşağıda calcGearEfficiency ile bir kez uygulanır. Eski ÜÇLÜ kayıp
        // sayımı (pompa drop + klaç + 0.965) kaldırıldı → türbin düzlemindeki ~%5.7 açık giderilir.
        var deltaT_lockup = 10.0 + 0.00367 * N_engine;   // iSCAAN ~19.6 N·m sürtünme (DEĞİŞMEZ)
        var T_net_lockup = T_engine - deltaT_lockup;
        if(T_net_lockup < 0) T_net_lockup = 0;
        T_pump = T_net_lockup;
        T_output = T_net_lockup;                          // dişli verimi aşağıda (calcGearEfficiency)
        tcEta = (T_engine > 0) ? (T_net_lockup / T_engine) : 1.0;   // kilit-klaç tork verimi (~0.98)
        // Lockup ısı reddi: per-gear RPM-bağımlı lineer model (iSCAAN uyumu)
        // Heat_lockup = a × N_engine + b  [kW] — şanzıman mekanik kayıpları devire bağlı
        var gearNum = shiftState.gearIdx + 1; // 1-indexed
        var hrCoeff = LOCKUP_HEAT_COEFFICIENTS[gearNum] || LOCKUP_HEAT_COEFFICIENTS[2];
        heatRejection_kW = Math.max(0, hrCoeff.a * N_engine + hrCoeff.b);
      }
    } else {
      // ── CONVERTER MOD — KONFİG-BAĞIMSIZ konvertör çalışma noktası ──
      // Motor her adımda konvertör ÇALIŞMA NOKTASINDA tutulur (iSCAAN'ın quasi-statik
      // eşleşme taramasıyla örtüşür). İki olasılık, motor+TK kombinasyonuna göre kendi
      // kendine ayrışır:
      //   • DÜŞÜK DAL (teğet/oyalanma): fazlalık excess(N)=net−drop−emiş bir "vadi" (önce
      //     azalıp sonra artan yerel min) yapıyor ve tabanı eşiğin altındaysa motor orada
      //     oturur (JMMA/L5D: ~1010 → iSCAAN 1023-1011). Vadi tabanı eşiği aşınca (araç
      //     hızlanınca) kopar → serbest rev-up ile yüksek dala tırmanır (iSCAAN 1804→2406).
      //   • YÜKSEK DENGE (temiz stall): vadi yok (excess idle'dan itibaren artıyor) → motor
      //     doğrudan yüksek stall/eşleşme dengesinde oturur (BMC/isb67: ~2204 → iSCAAN 2204).
      //     N_eng_dynamic bu dengeden başlatıldığından (idle değil) launch transientinin
      //     (~0.5 s) yalancı düşük çekişi tabloya SIZMAZ.
      var N_turbine = FT_SOLVER.speedToTurbineRpm(v_ms, i_gear, i_propshaft, i_transfer, i_axle, r_tire);
      if(N_turbine < 0) N_turbine = 0;

      // Düşük dal (konvertör-eşleşme teğet) vadisi — SABİT devir penceresi YOK; teğet devri
      // motora+TK'ye göre değiştiğinden idle→noLoad tam aralığı taranır. excess önce azalıp
      // sonra artıyorsa vadi tabanı bulunmuştur; excess idle'dan itibaren artıyorsa (ya da
      // sıfırı geçiyorsa) düşük dal yoktur → yüksek denge.
      var _lmN = idleRpm, _lmE = Infinity, _prevE = Infinity;
      onLowBranch = false;
      for(var _nS = idleRpm; _nS <= noLoadGoverned; _nS += 10) {
        var _srS = Math.min(0.99, Math.max(0, N_turbine / _nS));
        var _kpS = tcFns.kpump(_srS);
        var _eS = motorTorqueFn(_nS) - pumpTorqueDrop - (_nS * _nS) / (_kpS * _kpS);
        if(_eS < _lmE) { _lmE = _eS; _lmN = _nS; }
        if(_eS > _prevE) { onLowBranch = (_lmE < CONV_MATCH_THRESHOLD); break; }  // vadi tabanı geçildi
        if(_eS <= 0) break;   // sıfır geçişi (temiz yüksek denge) — düşük vadi yok
        _prevE = _eS;
      }

      if(onLowBranch) {
        N_engine = _lmN;            // DÜŞÜK DAL — eşleşme noktasında TUT (quasi-statik oyalanma)
      } else {
        N_engine = N_eng_dynamic;   // YÜKSEK DAL — serbest rev-up ataleti (entegre edilen durum)
        if(N_engine < idleRpm) N_engine = idleRpm;
      }
      SR = Math.min(0.99, Math.max(0, N_turbine / N_engine));
      tau = tcFns.tau(SR);
      T_engine = motorTorqueFn(N_engine);

      // Konvertörün emdiği pompa torku (anlık, SR'ye bağlı K-faktör)
      var _Kp = tcFns.kpump(SR);
      var T_pump_absorbed = (N_engine * N_engine) / (_Kp * _Kp);
      T_pump = T_pump_absorbed;

      if(onLowBranch) {
        engRate = 0;   // düşük dalda motor devri eşleşme noktasında tutulur (dinamik yok)
      } else {
        // Motor NET (ivmelendirici) torku → dönme ataletini hızlandırır (kopuş rev-up).
        var T_eng_net = T_engine - pumpTorqueDrop - T_pump_absorbed;
        engRate = (T_eng_net / I_eng_rev) * (60 / (2 * Math.PI));  // [rpm/s]
      }

      var T_turbine_raw = T_pump_absorbed * tau;  // türbine aktarılan tork (tork çarpımı)
      // Konvertör çıkış torku = HAM türbin torku. Dişli mekanik kaybı düz 0.975 çarpanı yerine
      // aşağıda calcGearEfficiency ile bir kez uygulanır (lockup ile AYNI yol → çift-sayım yok).
      // F1'de calcGearEfficiency(3.487)≈0.978≈0.975 → converter 1C/2C satırları ve F1 stall
      // çıkışı (~7538 N·m) pratikte korunur. eta_conv_internal yalnız ısı-reddi gear-mek terimi için.
      var eta_conv_internal = tcd.etaConvInternal || 0.975;
      T_output = T_turbine_raw;
      tcEta = SR * tau;
      // Converter ısı reddi: TC slip kaybı + gear mekanik kayıp ısısı
      var omega_eng = N_engine * 2 * Math.PI / 60;
      var P_heat_converter = T_pump_absorbed * omega_eng * (1 - SR * tau) / 1000;
      var P_turbine_kW = T_turbine_raw * (N_engine * SR) * 2 * Math.PI / 60 / 1000;
      var P_heat_gear_mech = P_turbine_kW * (1 - eta_conv_internal);
      heatRejection_kW = Math.max(0, P_heat_converter) + Math.max(0, P_heat_gear_mech);
    }

    // Evrensel dişli verimi: η = 1 − |ln(i)| × (0.0175 + 2.93e-6 × N_turbine)
    var _N_turb_for_eff = isLU ? N_engine : (N_engine * SR);
    var eta_gear = FT_SOLVER.calcGearEfficiency(i_gear, _N_turb_for_eff);

    // TK'li modlarda (converter + lockup) dişli mekanik kaybı BURADA bir kez uygulanır —
    // her iki dalın çıkış torku ham bırakıldı (converter: türbin torku; lockup: motor − klaç
    // drag). Böylece eski düz 0.975/0.965 çarpanları yerine devire-bağlı TEK dişli verimi
    // (calcGearEfficiency) kullanılır → çift/üçlü kayıp sayımı yok. TK YOK (doğrudan tahrik)
    // dalında T_output zaten gearData.eff içerdiğinden dokunulmaz.
    if(tcNode) T_output = T_output * eta_gear;

    // Çekme kuvveti — dişli verimi T_output'a yukarıda uygulandığından çağrıda gear arg = 1.0.
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
      // TK yok → motor rijit bağlı: kütle hesabında daima lockup ataleti (motor dahil).
      // TK varsa gerçek mod (converter modda motor ataleti akışkan ayrıştırma ile devre dışı).
      isLockup: (tcNode ? isLU : true)
    });

    // İvme
    var accel = F_net / mEff.m_eff;

    return {
      accel: accel,
      engRate: engRate,
      onLowBranch: onLowBranch,
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
      // TK yok → doğrudan tahrik rijit "kilitli" sayılır (converter fazı yok).
      // Bu, gearMode/SR/N_turbine türevlerinin no-TC'de kilitli değerler almasını sağlar.
      isLockup: (tcNode ? isLU : true)
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
  // MOTOR DEVRİ — dinamik durum. Konvertör modunda motor, kalkıştaki anlık idle→stall
  // rev-up geçişini (≲0.5 s; iSCAAN'ın tam-gaz tablosunda ihmal ettiği) atlamak için OTURMUŞ
  // konvertör çalışma noktasından başlatılır (idle değil): düşük dalı olmayan kombinasyonda
  // v=0'da stall (BMC/isb67 ~2204), teğet-dallı kombinasyonda düşük dal (JMMA/L5D ~1010). TK
  // yoksa motor hıza kilitli → idle başlangıcı korunur.
  var _settledOp = (tcNode && hasTCData)
    ? FT_SOLVER.computeSettledStall(motorTorqueFn, tcFns, pumpTorqueDrop, idleRpm,
                                    { nMax: noLoadGoverned, tol: CONV_MATCH_THRESHOLD })
    : null;
  var N_eng_dynamic = _settledOp ? _settledOp.N_engine : idleRpm;   // MOTOR DEVRİ — dinamik durum
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
    res_gearMode.push(veGearModeLabel(gearNum, ph.isLockup));
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
      // Dişli verimi TE/fizik formülünde uygulanmaz (T_output zaten dişli mek.
      // kaybını içerir; calcTractiveEffort gearbox slot=1.0). Sinyalde de çift
      // uygulamamak için T_output·i_gear kullanılır → sinyal zinciri F_traction ile birebir.
      var gbOutTorque = ph.T_output * ph.i_gear;
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
      if(ng.gear_mode) ng.gear_mode.push(veGearModeLabel(gearNum2, ph.isLockup));
      // Dişli kaybı T_output'ta (motor→şanzıman-giriş torku düşüşünde) modellenir;
      // sinyal aşamasında şanzıman saf oran (P_out=P_in) → verim gerçek güç oranından.
      if(ng.efficiency) ng.efficiency.push(gbP_in > 0 ? (gbP_out / gbP_in * 100) : 100);
    }

    // ── PROPŞAFT, TRANSFER, DİFERANSİYEL SİNYALLERİ ──
    var N_turb_rec = ph.isLockup ? ph.N_engine : ph.N_engine * ph.SR;
    var gbOutRpm_rec = N_turb_rec / ph.i_gear;
    var gbOutTorque_rec = ph.T_output * ph.i_gear;  // dişli verimi T_output'ta (çift-sayım yok)

    // Shift Controller
    if(shiftCtrlNode && nodeData[shiftCtrlNode.id]) {
      var nsc = nodeData[shiftCtrlNode.id];
      var gearNum3 = ph.gearName.replace(/[^0-9]/g, '');
      var N_out_rec = gbOutRpm_rec;  // Şanzıman çıkış devri
      if(nsc.current_gear) nsc.current_gear.push(ph.gearIdx + 1);
      if(nsc.gear_mode) nsc.gear_mode.push(veGearModeLabel(gearNum3, ph.isLockup));
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

    // ── MOTOR DEVRİ DİNAMİĞİ (rev-up ataleti) ──
    // Converter modda: net motor torku devri değiştirir (idle→stall tırmanışı,
    // teğetlikte asılma, kopuş). Denge yakınında hız hızlı olduğundan eski
    // yarı-statik sonuçlarla örtüşür → orta/üst hız davranışı korunur.
    // Lockup / no-TC modda motor devri hıza kilitlidir (engRate=null).
    if(ph.onLowBranch) {
      // DÜŞÜK DAL: motor devri konvertör-eşleşme noktasında tutulur. N_eng_dynamic'i
      // buna eşitle → kopuş anında serbest rev-up bu noktadan (sürekli) başlar.
      N_eng_dynamic = ph.N_engine;
    } else if(ph.engRate !== null && ph.engRate !== undefined) {
      N_eng_dynamic += ph.engRate * dt_step;
      var _nMax = Math.max(noLoadGoverned, governedSpeed) + 100;
      if(N_eng_dynamic < idleRpm) N_eng_dynamic = idleRpm;
      else if(N_eng_dynamic > _nMax) N_eng_dynamic = _nMax;
    } else {
      N_eng_dynamic = ph.N_engine;  // lockup / no-TC: motor hıza kilitli
    }
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

  // ── OTURMUŞ STALL (v=0) — eğim/kalkış METRİKLERİ için (transient t=0 satırı yerine) ──
  // Motor kalkışta anlık dengeye atlamaz; teğetlikte ~1000-1050 rpm'de oturur. Eğim
  // kabiliyeti bu OTURMUŞ noktadan hesaplanmalı (iSCAAN C03: ~1023 rpm / türbin ~553).
  // Çekiş, sim converter dalıyla BİREBİR aynı formülle üretilir → tutarlı.
  var settledStall = null;
  if(tcNode && hasTCData) {
    var _ss = _settledOp || FT_SOLVER.computeSettledStall(motorTorqueFn, tcFns, pumpTorqueDrop, idleRpm,
                                                          { nMax: noLoadGoverned, tol: CONV_MATCH_THRESHOLD });
    var _iGear1 = parseFloat(forwardGears[0].ratio) || 1.0;
    // Dişli verimi sim converter dalıyla tutarlı (calcGearEfficiency; stall'da türbin=0 → SR=0).
    var _etaG1 = FT_SOLVER.calcGearEfficiency(_iGear1, 0);
    var _Tout = _ss.T_turbine * _etaG1;
    // GRİP-LİMİTSİZ çekiş (drivetrain KAPASİTESİ) — gradeability metriği bunu kullanır (iSCAAN
    // konvansiyonu: eğim kabiliyeti aktarma-organı kapasitesidir; tutunma AYRI "!" bayrağıyla).
    var _TE = FT_SOLVER.calcTractiveEffort(_Tout, _iGear1, 1.0, i_propshaft, psEff,
                                           i_transfer, eta_transfer, i_axle, eta_axle, r_tire);
    var _Froll0 = FT_SOLVER.getCrrEffective(Crr, 0) * (surfFactor || 1.0) * m_vehicle * 9.81; // v=0, düz yol
    settledStall = {
      N_engine: _ss.N_engine, T_turbine: _ss.T_turbine, T_pump: _ss.T_pump,
      TE_kN: _TE / 1000, DP_kN: (_TE - _Froll0) / 1000,
      slip: (_TE > F_grip),                              // TE > tutunma limiti → tekerlek kayması olası ("!" bayrağı)
      TE_gripLimited_kN: Math.min(_TE, F_grip) / 1000    // tutunma-sınırlı efektif değer (ayrıca saklanır)
    };
  }

  // ── DÜŞÜK-HIZ (~10 km/h) QUASİ-STATİK ÇALIŞMA NOKTASI — düşük-hız eğim metriği için ──
  // Transient iz o hızda motor henüz tam oturmadığından (kopuş yeni bitmiş) çekişi düşük
  // okur. Düşük-hız eğim kabiliyeti motorun O HIZDA oturduğu dengeden hesaplanmalı.
  var lowSpeedOp = null;
  if(tcNode && hasTCData) {
    var _vRef = 10 / 3.6;  // m/s
    var _iG1 = parseFloat(forwardGears[0].ratio) || 1.0;
    var _Nturb = FT_SOLVER.speedToTurbineRpm(_vRef, _iG1, i_propshaft, i_transfer, i_axle, r_tire);
    var _op = FT_SOLVER.solveTCOperatingPoint(_Nturb, motorTorqueFn, tcFns, pumpTorqueDrop,
                                              { N_min: idleRpm, N_max: noLoadGoverned + 100 });
    var _etaG2 = FT_SOLVER.calcGearEfficiency(_iG1, _op.SR ? _op.N_engine * _op.SR : 0);
    var _To2 = _op.T_turbine * _etaG2;
    // GRİP-LİMİTSİZ (drivetrain kapasitesi) — düşük-hız eğim metriği de kapasite raporlar.
    var _TE2 = FT_SOLVER.calcTractiveEffort(_To2, _iG1, 1.0, i_propshaft, psEff,
                                            i_transfer, eta_transfer, i_axle, eta_axle, r_tire);
    var _Froll10 = FT_SOLVER.getCrrEffective(Crr, _vRef) * (surfFactor || 1.0) * m_vehicle * 9.81;
    var _Faero10 = 0.5 * rho * Cd * A_frontal * _vRef * _vRef;
    lowSpeedOp = { v_kmh: 10, TE_kN: _TE2 / 1000, DP_kN: (_TE2 - _Froll10 - _Faero10) / 1000,
                   slip: (_TE2 > F_grip) };
  }

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
    settledStall: settledStall,   // v=0 oturmuş stall (eğim metrikleri için)
    lowSpeedOp: lowSpeedOp,       // ~10 km/h quasi-statik nokta (düşük-hız eğim metriği için)
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
        hasTC: !!tcNode,
        hasECM: nodes.some(function(n){ return n.type === 'ec-matching'; }),
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
function veCalcGradeForRatio(ftData, m_kg, transferRatio, isLowGear, hasTC) {
  var g = 9.81;
  var mg_kN = m_kg * g / 1000;

  // Stall/Launch DP kaynağı:
  //  TK VAR → v=0 noktası (konvertör stall = maks. tork çarpımı → gerçek startability).
  //  TK YOK → doğrudan tahrikte çözücü v=0'da motoru RÖLANTİYE kelepçeler (debriyaj
  //           modeli yok) → v=0 DP kalkış kabiliyetini YANSITMAZ (rölanti torku çok düşük).
  //           Gerçek kalkış debriyaj kaydırarak tork tepesine dek devir alır; bu yüzden
  //           stall/launch kabiliyeti = 1. VİTESTEKİ ULAŞILABİLİR MAKS. DP olarak alınır.
  var dp_stall = ftData[0].dp_kN;
  var stallIdx = 0;
  if(!hasTC) {
    for(var qi = 0; qi < ftData.length; qi++) {
      var gnq = parseInt(String(ftData[qi].gear).replace(/[^0-9]/g, ''), 10) || 99;
      if(gnq <= 1 && ftData[qi].dp_kN > dp_stall) { dp_stall = ftData[qi].dp_kN; stallIdx = qi; }
    }
  }
  var stallGrade, launchGrade;
  if(dp_stall >= mg_kN) {
    stallGrade = 999.0;
    launchGrade = 997.0;
  } else {
    stallGrade = Math.round(Math.tan(Math.asin(dp_stall / mg_kN)) * 100 * 10) / 10;
    if(hasTC) {
      // TK: kalkış eğimi = stall − 2 (iSCAAN konvansiyonu; kalkış stall'a yakın, aynı
      // torque-çarpım bölgesinde). GRİP-LİMİTSİZ stall'dan türetilir — trace'in v~1-3 km/h
      // noktası grip-limitli okunacağından (metrik kapasite ister) KULLANILMAZ.
      launchGrade = Math.round((stallGrade - 2.0) * 10) / 10;
    } else {
      // TK yok: launch = stall (aynı kalkış kabiliyeti — 1. viteste ulaşılabilir maks. DP)
      launchGrade = stallGrade;
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
    stallGrade: stallGrade, stallGear: ftData[stallIdx].gear,
    launchGrade: launchGrade, launchGear: ftData[stallIdx].gear,
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

  // ── OTURMUŞ STALL enjeksiyonu (Fix A) ──
  // ftData[0] transient t=0 satırıdır (motor rölantide, ~700 rpm) → v=0 stall eğimi
  // yanlış (düşük) çıkar. Stall eğimi motorun OTURDUĞU teğet noktadan (~1023 rpm)
  // hesaplanmalı. simResult.settledStall bu noktanın çekiş/DP'sini taşır (sim ile tutarlı).
  if(simResult.settledStall && ftData.length > 0 && ftData[0].v_kmh < 0.5) {
    ftData[0] = { gear: ftData[0].gear, v_kmh: 0,
                  dp_kN: simResult.settledStall.DP_kN, te_kN: simResult.settledStall.TE_kN };
  }

  // Aktif transfer oranı
  var trGears = rs.transferGears || [];
  var activeRatio = ss.transferRange ? (parseFloat(ss.transferRange.ratio || ss.transferRange.oran) || 1.0) : (trGears.length > 0 ? trGears[0].ratio : 1.0);
  var activeEta = ss.transferRange ? (parseFloat(ss.transferRange.eff || ss.transferRange.verim) || 97) : (trGears.length > 0 ? trGears[0].eff : 97);
  
  // High kademe (mevcut FT verisi)
  var result = {};
  result.high = veCalcGradeForRatio(ftData, m_kg, activeRatio, false, rs.hasTC);
  result.high.label = rs.hasTransfer && trGears.length > 1 ?
    'Transfer Kutusu: Yüksek Kademe (' + activeRatio.toFixed(3) + ')' :
    'Transfer Kutusu: Yüksek Kademe (' + activeRatio.toFixed(3) + ')';

  // Düşük-hız eğimini quasi-statik (~10 km/h oturmuş) noktadan override et (Fix A §1.3.3) —
  // transient iz o hızda motoru tam oturmamış gösterip çekişi düşük okuyor.
  if(simResult.lowSpeedOp) {
    var _mgH = m_kg * 9.81 / 1000;
    var _dpL = simResult.lowSpeedOp.DP_kN;
    result.high.lowSpeedGrade = (_dpL / _mgH >= 1.0) ? 999.0
      : Math.round(Math.tan(Math.asin(_dpL / _mgH)) * 100 * 10) / 10;
    result.high.lowSpeedV = simResult.lowSpeedOp.v_kmh;
  }

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

    // OTURMUŞ STALL enjeksiyonu (düşük kademe) — yüksek kademeyle AYNI quasi-statik stall.
    // Stall TK'nin ÖNCESİNDE olduğundan transfer kademesinden BAĞIMSIZDIR; düşük kademe de
    // grip-limitsiz quasi-statik stall'ı kullanmalı (rölanti/transient v=0 okuması DEĞİL).
    if(lowSimResult && lowSimResult.settledStall && ftDataLow.length > 0 && ftDataLow[0].v_kmh < 0.5) {
      ftDataLow[0] = { gear: ftDataLow[0].gear, v_kmh: 0,
                       dp_kN: lowSimResult.settledStall.DP_kN, te_kN: lowSimResult.settledStall.TE_kN };
    }

    if(ftDataLow.length >= 2) {
      result.low = veCalcGradeForRatio(ftDataLow, m_kg, lowRatio, true, rs.hasTC);
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
