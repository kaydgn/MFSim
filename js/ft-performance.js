// ============================================================================
// FULL THROTTLE SOLVER — ÇEKIRDEK MATEMATİK FONKSİYONLARI
// ============================================================================
// Tam gaz hızlanma simülasyonu için tüm matematiksel alt yapı.
// Motor-konvertör eşleştirmesi, eşdeğer kütle, PCHIP interpolasyon.
// Mevcut motor freni solver'ından bağımsız çalışır.
// ============================================================================

// Eğim kabiliyeti gösterimi — fiziksel sınır senteli (≥900: "çekiş kuvveti
// ağırlığı aşıyor, araç her eğimi tırmanır") kullanıcıya HAM SAYI olarak
// gösterilmez; raporlarda ve panellerde "%999.0" görünüyordu. Hesap değerleri
// (999/997) değişmez — yalnız sunum. pctPrefix=true panel/özet biçimi (≥%100),
// false tablo sütunu biçimidir (≥100).
function veGradeDisplay(v, dec, pctPrefix) {
  if (v == null || isNaN(v)) return pctPrefix ? '%—' : '—';
  if (v >= 900) return pctPrefix ? '≥%100' : '≥100';
  if (v <= -900) return pctPrefix ? '≤−%100' : '≤−100';
  var s = Number(v).toFixed(dec == null ? 1 : dec);
  return pctPrefix ? '%' + s : s;
}

var FT_SOLVER = (function() {
  'use strict';

  // ═══════════════════════════════════════════════════════════════════════════
  // 1. PCHIP SPLINE İNTERPOLASYON
  // ═══════════════════════════════════════════════════════════════════════════

  function pchipCreate(xs, ys, label) {
    var n = xs.length;
    var who = label ? (label + ' — ') : 'PCHIP: ';
    if(n < 2) throw new Error(who + 'en az 2 veri noktası gerekli');
    // xs KESİN ARTAN, tüm değerler SONLU olmalı.
    //
    // Neden burada patlıyoruz (sessiz NaN yerine): yinelenen bir x — örneğin motor
    // tork tablosuna iki kez girilmiş aynı devir — hs[i]=0 yapar, deltas'ta 0/0
    // oluşur ve ds[] üzerinden spline'ın TAMAMI NaN'a düşer (yalnız o satır değil).
    // O NaN çözücüde SESSİZCE yayılır: NaN karşılaştırmaları hep false döndüğü
    // için ne düşük-dal taramasının break'leri (satır ~995) ne de ana döngünün
    // maks-hız erken çıkışı (satır ~1650) tetiklenebilir. Sonuç: koşum 300 s
    // güvenlik limitine kadar, her fizik çağrısında tam tarama yaparak sürer.
    // Ölçüm (RK4, dt=0.01, iki transfer kademesi): temiz veri 0.4 s → yinelenen
    // devirli veri 248 s. Kullanıcı bunu "program takıldı" olarak görüyor, çünkü
    // hesap tek senkron blokta ve ilerleme çubuğu boyanamıyor.
    for(var _v = 0; _v < n; _v++) {
      if(!isFinite(xs[_v]) || !isFinite(ys[_v])) {
        throw new Error(who + 'sayısal olmayan veri noktası (satır ' + (_v + 1) +
                        ': x=' + xs[_v] + ', y=' + ys[_v] + ')');
      }
      if(_v > 0 && xs[_v] <= xs[_v - 1]) {
        throw new Error(who + 'x değerleri kesin artan olmalı — yinelenen/azalan değer: ' +
                        xs[_v] + ' (satır ' + (_v + 1) + ')');
      }
    }
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
    var spline = pchipCreate(rpms, torques, 'Motor tork tablosu');
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
    var spKp = pchipCreate(srs, kps, 'Konvertör tablosu (K-faktör)');
    var spTau = pchipCreate(srs, taus, 'Konvertör tablosu (tork oranı τ)');

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
    var trace = opts.traceSink || null;   // iz için bisection iterasyon kaydı (hesaba etkisiz)
    if(trace) { trace.N_turbine = N_turbine; trace.N_lo0 = N_lo; trace.N_hi0 = N_hi; trace.f_lo0 = f_lo; trace.f_hi0 = f_hi; trace.pumpDrop = pumpTorqueDrop; trace.iterations = []; }

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
      if(trace) trace.iterations.push({ iter: iter, N_lo: N_lo, N_hi: N_hi, N_mid: N_mid, f_mid: f_mid });
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
  // arasındaki FAZLALIĞ'ın (excess = T_net − drop − emiş) İLK SIFIR GEÇİŞİ = motorun tam
  // gazda fiilen oturduğu STALL DENGESİDİR (excess + → − ⇒ kararlı denge). Bu, denge kökü
  // _findStallSpeed (§3.3) ve solveTCOperatingPoint(N_türbin=0) ile AYNI noktadır — üç yol
  // tek denge tanımını paylaşır (§2.7 birleşme ilkesi). Düşük-rpm'de excess'in yaptığı SIĞ
  // POZİTİF vadi (yerel min > 0) bir stall DEĞİL, motorun rev-up sırasında GEÇTİĞİ bir
  // near-hang'dir; excess orada ≤ 0 OLMADIKÇA kabul EDİLMEZ → motor yüksek dengeye tırmanır
  // (ör. L5D+TC-415: ~2410; isb67+TC-413: ~2265). Referans: Allison C4 tam-gaz konvertör
  // stall'ı (EM64-A / TD-148-G). [Rev1 düzeltmesi: eski "teğetlik/asılma ~1025" kabulü kaldırıldı.]
  function computeSettledStall(motorTorqueFn, tcFns, pumpDrop, idleRpm, options) {
    var opts = options || {};
    var tol = (opts.tol != null) ? opts.tol : 15;   // N·m — yalnız iz/geriye-uyum; kabul KAPISI DEĞİL
    var nMax = opts.nMax || 2600;
    var stepN = opts.step || 5;
    var K0 = tcFns.kpump(0);
    var tau0 = tcFns.tau(0);
    var trace = opts.traceSink || null;   // iz için iterasyon kaydı (hesaba etkisiz)
    if(trace) { trace.K0 = K0; trace.tau0 = tau0; trace.tol = tol; trace.pumpDrop = pumpDrop; trace.idleRpm = idleRpm; trace.iterations = []; trace.reason = ''; }
    var minExcess = Infinity, minN = idleRpm, chosenN = null;
    for(var N = idleRpm; N <= nMax; N += stepN) {
      var Te_s = motorTorqueFn(N);
      var Tpa_s = (N * N) / (K0 * K0);
      var excess = Te_s - pumpDrop - Tpa_s;
      if(trace) trace.iterations.push({ N: N, Te: Te_s, T_pump_absorb: Tpa_s, excess: excess });
      if(excess < minExcess) { minExcess = excess; minN = N; }
      // TEK KABUL KURALI (§2.5/§2.7): yalnız GERÇEK denge = excess'in İLK ≤ 0 geçişi. Sığ
      // pozitif vadi (near-hang) stall değildir → geçilir; motor yüksek dengeye tırmanır.
      if(excess <= 0) { chosenN = N; if(trace) trace.reason = 'denge koku (excess ilk <=0)'; break; }
    }
    if(chosenN === null) { chosenN = minN; if(trace) trace.reason = 'kesisim yok — min excess noktasi (fallback)'; }   // sıfır geçişi yoksa en düşük fazlalık noktası
    var T_pump = (chosenN * chosenN) / (K0 * K0);
    if(trace) { trace.chosenN = chosenN; trace.minExcess = minExcess; trace.T_pump = T_pump; trace.T_turbine = T_pump * tau0; }
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
    // Terim dökümü (yalnız rapor/iz için — hesaba etkisi yok). Her atalet teriminin
    // eşdeğer kütleye (I_term / r²_tire) katkısını ayrı ayrı gösterir.
    var terms = {
      i_total: i_total, i_down: i_down, r2: r2, isLockup: !!p.isLockup,
      I_engine: p.isLockup ? p.I_engine * i_total * i_total : 0,
      I_conv:   p.isLockup ? p.I_conv * i_total * i_total : 0,
      I_conv_turbine: p.isLockup ? 0 : p.I_conv_turbine * i_total * i_total,
      I_trans:  p.I_trans * i_down * i_down,
      I_propshaft: p.I_propshaft * i_down * i_down,
      I_tc:     p.I_tc * p.i_axle * p.i_axle,
      I_axle:   p.I_axle,
      I_tire:   p.I_tire
    };
    return { m_eff: m_eff, I_eff: I_eff, ratio: m_eff / p.m_vehicle, terms: terms };
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
  // Kayıp L = 1 − η üç terimden kurulur:
  //   a  : devirden bağımsız sabit — çalkalama/yatak/mesh sayısı. Direkt viteste (i=1)
  //        TEK çalışan terim; iSCAAN gerçekten ≈%0.6–1.0 kayıp gösteriyor (eski model 0).
  //   b  : diş teması kaybı, türbin devriyle doğrusal artar → b·|ln i|·N_türbin
  //   c  : yalnız overdrive'da — çıkış şaftı girişten hızlı döner → c·OD·N_çıkış²
  //        (OD = max(0, −ln i))
  //
  // Sabit terim (a) İKİ ŞEKİLDE gelebilir:
  //   • co.a          — orana göre düz model. Altı vitesli Allison ailelerinde yeterli.
  //   • co.perGear[]  — VİTES BAŞINA ölçülmüş sabit. 9 vitesli 2957 SP gibi bileşik
  //     planet yollu şanzımanlarda kayıp orandan çözülmüyor (i=4.822 → %7.24 ama
  //     i=3.512 → %2.72); orada tek çare her vitesi ayrı ölçmek. Tabloda karşılığı
  //     olmayan bir orana rastlanırsa evrensel formüle düşülür — ölçülmemiş vites
  //     için ölçülmüş komşusunun sabiti UYDURULMAZ.
  //
  // Ölçüm: 13 iSCAAN raporunun Lockup-mod vites tabloları, η = T_çıkış/(T_türbin·i),
  // governor düşüş bölgesi elenmiş (1239 nokta). Kalibresiz şanzımanlar evrensel
  // formülle çalışır: L = |ln i| × (0.0175 + 2.93e-6 × N_türbin), i=1 → η=1.
  // Ölçülen ailelerde evrensel formülün RMS'i %1.07–%2.38, kalibreli model %0.14–0.34.
  //
  // i_gear negatif olabilir (geri vites) — büyüklük alınır, yoksa Math.log NaN üretirdi.
  function calcGearEfficiency(i_gear, N_turbine, co) {
    if(!i_gear) return 1.0;
    var absRatio = Math.abs(i_gear);
    var lnRatio = Math.log(absRatio);
    var N = N_turbine || 0;
    var a = null;
    if(co) {
      if(co.perGear) {
        for(var k = 0; k < co.perGear.length; k++) {
          if(Math.abs(co.perGear[k].ratio - absRatio) <= 0.01 * absRatio) { a = co.perGear[k].a; break; }
        }
      } else if(co.a != null) {
        a = co.a;
      }
    }
    if(a != null) {
      var N_out = N / absRatio;
      var loss = a + (co.b || 0) * Math.abs(lnRatio) * N
                   + (co.c || 0) * Math.max(0, -lnRatio) * N_out * N_out;
      return Math.max(0.85, Math.min(1.0, 1 - loss));
    }
    if(absRatio === 1.0) return 1.0;
    var eta = 1 - Math.abs(lnRatio) * (0.0175 + 0.00000293 * N);
    return Math.max(0.90, Math.min(1.0, eta));
  }

  // Şanzıman düğümünün verisinden dişli verim katsayılarını çöz.
  // Öncelik: doğrudan seçilen preset → vites geçiş profilinin bağlı olduğu preset.
  // (Örnek topolojilerde preset seçili değil, vites geçiş profili var — ikinci yol
  // olmadan kalibrasyon o dosyalarda sessizce devre dışı kalırdı.)
  function resolveGearEff(gbData) {
    if(!gbData || typeof VE_GEARBOX_PRESETS === 'undefined') return null;
    var key = gbData.ftGBPreset || '';
    if(!key && gbData.shiftProfile && typeof veGetGearboxKeyFromShiftProfile === 'function') {
      key = veGetGearboxKeyFromShiftProfile(gbData.shiftProfile) || '';
    }
    var preset = key ? VE_GEARBOX_PRESETS[key] : null;
    return preset && preset.gearEff ? preset.gearEff : null;
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
    calcGearEfficiency: calcGearEfficiency, resolveGearEff: resolveGearEff,
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

  // ── DETAYLI HESAPLAMA İZİ ──
  // window._veFTTraceEnabled açıksa bu koşu "izli" olur: her kilit adımda ara
  // değerler ve iterasyonlar toplanır (rapor için). İz açıkken bu SESSİZ bir
  // yeniden-koşudur → grafik görünümlerini sıfırlama gibi yan etkileri atla.
  var traceMode = (typeof window !== 'undefined' && window._veFTTraceEnabled) ? true : false;
  var calcTrace = traceMode ? { params: null, steps: [], settledStall: null, lowSpeedOp: null, meta: {} } : null;

  // Grafik görünümlerini sıfırla (izli sessiz koşuda atlanır)
  if(!traceMode && typeof veTrResetView === 'function') veTrResetView();

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
  // Aksesuar kaybı: eğrili (Klima/Alternatör/Hava Komp. → aksesuar_devri=rpm×oran,
  // kW=interp(eğri)) + manuel (sabit kW) + legacy scalar (fan N³ / diğer lineer).
  // Tek doğruluk kaynağı veAccessoryLossKw (cp-accessories.js).
  function motorTorqueFn(rpm) {
    var T_gross = grossMotorTorqueFn(rpm);
    if(rpm <= 0) return T_gross;
    var P_loss_kW = (typeof veAccessoryLossKw === 'function')
      ? veAccessoryLossKw(accList, rpm, governedSpeed, accFanMode)
      : (function(){
          if(!hasAccessoryLoss) return 0;
          var ratio = rpm / governedSpeed;
          var Pf = (accFanMode === 'on') ? accTotalFanLoss : accTotalFanLoss * ratio * ratio * ratio;
          return Pf + accTotalOtherLoss * ratio;
        })();
    if(P_loss_kW <= 0) return T_gross;
    var omega = 2 * Math.PI * rpm / 60;
    return Math.max(0, T_gross - P_loss_kW * 1000 / omega);
  }

  // ── TORK KONVERTÖRÜ ──
  var tcd = tcNode ? (tcNode.data || {}) : {};
  var tcDataArr = tcd.tcData || [];
  // Pompa (şarj pompası) tork düşümü [N·m] — TD-148 §5.1: konvertör çoğaltmadan ÖNCE düşülür.
  // Varsayılan 17.6 N·m (≈13 lb-ft) = Allison EM64-A, 3000 ailesi. K/τ tablolarını da EM64'ten
  // aldığımız için tutarlı. (TD-159: 3700-dışı 3000 ailesi = 19 N·m; kalibrasyon EM64 olduğundan
  // 17.6 kullanılır — karar §4.1, 2026-07-14.) Kullanıcı TK verisinde geçersiz kılabilir.
  var pumpTorqueDrop = tcd.pumpTorqueDrop !== undefined ? parseFloat(tcd.pumpTorqueDrop) : 17.6;
  var I_conv = tcNode ? 0.5 : 0.0;           // TC toplam atalet (lockup modda) — TK yoksa 0
  var I_conv_turbine = tcNode ? 0.3 : 0.0;   // TC türbin ataleti (converter modda) — TK yoksa 0
  // Converter-mod rev-up ataleti: motor krank+volan + konvertör pompası (impeller tarafı).
  // Kalkışta motorun idle→stall tırmanma hızını (dolayısıyla ~1 sn avansı) belirler.
  var I_eng_rev = I_engine + Math.max(0, I_conv - I_conv_turbine);
  // [Rev1] Eski konvertör-eşleşme "düşük dal tutma" eşiği [N·m]. Artık kabul KAPISI DEĞİL:
  // düşük/yüksek denge kararı excess ≤ 0 (gerçek denge) ile verilir (§2.5/§2.7 birleşme).
  // Yalnız hesaplama izinde (trace) referans olarak taşınır — davranışa etkisi yoktur.
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
  // Şanzımanın GERÇEK (kayıtlı) bir shift profili var mı? Yoksa yukarıdaki
  // fallback ('allison3200sp_s1') devreye girer; raporda "Governed" gösterilir.
  var shiftProfileRegistered = !!(gbd.shiftProfile && typeof VE_FT_SHIFT_PROFILES !== 'undefined' && VE_FT_SHIFT_PROFILES[gbd.shiftProfile]);
  var spData = VE_FT_SHIFT_PROFILES[shiftProfile] || { lockupOffset: 75, shift1C2C_outRatio: 0.2150, shift2C2L_outRatio: 0.3594 };
  var lockupOffset = spData.lockupOffset || 75;
  // Shift Referans RPM: profilde tanımlıysa onu kullan, yoksa motor governed
  var shiftRefRPM = spData.shiftRefRPM || gbd.shiftRefRPM || governedSpeed;
  // Converter-mod geçiş oranları (N_out / N_shift_ref)
  var SHIFT_1C_2C_OUT_RATIO = spData.shift1C2C_outRatio || 0.2150;
  var SHIFT_2C_2L_OUT_RATIO = spData.shift2C2L_outRatio || 0.3594;
  var N_shift_lockup = shiftRefRPM - lockupOffset; // Lockup moddaki shift RPM'i (lockupShifts yoksa fallback)

  // Dişli verim katsayıları — bu şanzıman ölçülmüşse; yoksa null (evrensel formül).
  var _gearEffCo = FT_SOLVER.resolveGearEff(gbd);

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
  // Güvenlik limiti [s] — varsayılan, çözücü panelininkiyle AYNI kaynaktan
  // gelir (cp-solver.js: VE_DEFAULT_MAX_SIM_TIME). Burada 120 sabitlenince
  // panel 300 gösterirken çözücü 120'de kesiyordu.
  var maxTime = parseFloat(sd.maxSimTime) || (typeof VE_DEFAULT_MAX_SIM_TIME !== 'undefined' ? VE_DEFAULT_MAX_SIM_TIME : 300);
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
    shiftHistory: [],   // [{t, fromGear, toGear, fromMode, toMode, v_kmh, N_engine, SR}]
    lastShiftT: -Infinity, // son vites değişiminin zamanı [s]
    lastShiftDir: 0,       // +1 = yukarı, -1 = aşağı, 0 = henüz yok
    suppressedHunts: 0     // anti-hunt tarafından engellenen ters yön denemesi sayısı
  };

  // Ters yön kilidi [s]: bir üst-vites geçişinden hemen sonra alt-vitese (veya
  // tersi) dönmek gerçek şanzıman kontrolcülerinde de yasaktır. Kalibre eşikler
  // şanzıman donanımıyla uyuşmadığında (farklı vites sayısı/oranları için
  // ayarlanmış profil) iki kural birbirini kovalayıp adım başına gidiş-dönüş
  // üretebiliyor; bu kilit onu tek bir geçişe indirir. Aynı YÖNDEKI ardışık
  // geçişler etkilenmez — tam gaz hızlanmada hızlı seri yukarı vites normaldir.
  var SHIFT_REVERSAL_LOCKOUT = 0.5;

  // Bu adımda `dir` yönünde vites değiştirmek serbest mi?
  function shiftReversalAllowed(t, dir) {
    if(shiftState.lastShiftDir === 0) return true;
    if(dir === shiftState.lastShiftDir) return true;             // aynı yön — serbest
    return (t - shiftState.lastShiftT) >= SHIFT_REVERSAL_LOCKOUT;
  }

  function noteShift(t, dir) {
    shiftState.lastShiftT = t;
    shiftState.lastShiftDir = dir;
  }

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
            v_kmh: v_kmh, N_engine: N_engine, SR: SR, N_out: N_out,
            threshold: threshold_1C2C, thresholdBasis: (csData && csData['1C2C']) ? 'a·ESL+b' : 'oran·N_ref'
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
            eta: SR * tau, threshold: threshold_2C2L, thresholdBasis: '2C2L esik'
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
        var lu_threshold = null, lu_basis = '';

        if(spData.lockupShifts && spData.lockupShifts[shiftKey]) {
          var ls = spData.lockupShifts[shiftKey];
          var threshold_lu = calcDownshiftThreshold(ls, shiftRefRPM);
          lu_threshold = threshold_lu; lu_basis = 'N_out_lu >= esik';
          if(N_out_lu >= threshold_lu) luShiftTriggered = true;
        } else {
          // Eski yöntem: sabit lockupOffset
          lu_threshold = N_shift_lockup; lu_basis = 'N_engine >= N_shift_lockup';
          if(N_engine >= N_shift_lockup) luShiftTriggered = true;
        }

        if(luShiftTriggered && !shiftReversalAllowed(t, +1)) {
          luShiftTriggered = false;              // ters yön kilidi — hunt bastırıldı
          shiftState.suppressedHunts++;
        }
        if(luShiftTriggered) {
          shiftState.shiftHistory.push({
            t: t, fromGear: g, toGear: g + 1, fromMode: veGearModeLabel(g + 1, true), toMode: veGearModeLabel(g + 2, true),
            v_kmh: v_kmh, N_engine: N_engine, SR: SR, N_out: N_out_lu,
            threshold: lu_threshold, thresholdBasis: lu_basis
          });
          shiftState.gearIdx = g + 1;
          noteShift(t, +1);
          shifted = true;
        }
      }
    }

    // ── GOVERNED ÜST-VİTES GÜVENLİĞİ (over-rev / vites-atmama koruması) ──
    // Motor governed devrini geçemez (üstünde tork droop'a girer, net çekiş → 0). Per-gear
    // ÇIKIŞ eşikleri shift profili FARKLI bir motor/vites-oranı için kalibre olduğundan motor
    // governed'a ulaşmadan tetiklenmeyebilir; özellikle TK-yok + derin vites oranlarında
    // converter→lockup (2C→2L) çıkış eşiği, governed'daki çıkış devrinin ÜSTÜNDE kalıp mode-
    // flip'i (ve dolayısıyla üst-vites geçişini) TAMAMEN bloke eder → motor no-load'a dayanıp
    // 0 çekişte takılır. Bu güvenlik: motor governed'a ulaşınca ve üst vites varsa, mod/eşik
    // ne olursa olsun ÜST vitese (lockup) geç. İyi kalibre profillerde normal eşik governed'ın
    // altında tetiklendiğinden bu koşul no-op'tur (kalibre shift hızlarını etkilemez).
    // KALKIŞ İSTİSNASI: araç henüz duruyorken bu güvenlik ÇALIŞMAZ. Konvertörlü
    // bir kalkışta motorun stall devrinde governed'ın ÜSTÜNDE olması normaldir
    // (türbin duruyor, motor konvertöre karşı devir alıyor) — burada üst vitese
    // atmak hem fiziksel olarak yanlış (0 km/h'te lockup) hem de downshift kuralı
    // ile birlikte kalkışta salınım üretiyor. Güvenliğin asıl hedefi hareket
    // hâlindeyken eşiklerin tetiklenmemesi durumudur.
    if(!shifted && g < maxGear && N_engine >= governedSpeed && v_kmh > 1 && shiftReversalAllowed(t, +1)) {
      var _iGcur = parseFloat(getCurrentGearData().ratio) || 1.0;
      // TK VAR: yüksek viteste lockup'a geç. TK YOK: mode-flag anlamsız (converter yok) →
      // false bırak; aksi halde downshift dalı (isLU gerektirir) her governed-güvenlik
      // yükseltmesinden sonra hemen alt vitese düşürüp up/down HUNT üretir.
      if(tcNode) shiftState.isLockup = true;
      shiftState.shiftHistory.push({
        t: t, fromGear: g, toGear: g + 1,
        fromMode: veGearModeLabel(g + 1, shiftState.isLockup), toMode: veGearModeLabel(g + 2, shiftState.isLockup),
        v_kmh: v_kmh, N_engine: N_engine, SR: SR, N_out: N_engine / _iGcur, reason: 'governed-safety'
      });
      shiftState.gearIdx = g + 1;
      noteShift(t, +1);
      shifted = true;
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
        // ── OVER-REV KİLİDİ (anti-hunt) ──
        // Alt vitese düşmek motoru governed'ın ÜSTÜNE çıkaracaksa o düşüş fiziksel
        // olarak geçersizdir — ve yukarıdaki "governed güvenliği" onu bir sonraki
        // adımda hemen geri yukarı atacağı için sonsuz salınım (hunt) üretir.
        //
        // Gözlenen vaka (Allison 2500SP S1 profili + 9 vitesli şanzıman, ESL=2500):
        // 5L'de N_out=2425 → N_engine=2425×1.439=3489 > 2500 → governed güvenliği
        // 6L'ye atıyor; 6L'de N_out=2425 < 3011 ('6to5' eşiği) → downshift 5L'ye
        // geri atıyor → adım başına bir gidiş-dönüş, 25.134 vites geçişi.
        // Profilin kendi histerezis bantları DOĞRU; kavga eden iki AYRI kural.
        //
        // N_out lockup'ta vitesten bağımsızdır (araç hızına bağlı), bu yüzden alt
        // vitesteki motor devri doğrudan N_out × i_alt olur.
        var _iGearLower = parseFloat((forwardGears[g - 1] || {}).ratio) || 1.0;
        var _nEngAfterDs = N_out_ds * _iGearLower;
        var _dsWouldOverRev = _nEngAfterDs >= governedSpeed;

        var _dsWanted = N_out_ds < dsThreshold && !_dsWouldOverRev;
        if(_dsWanted && !shiftReversalAllowed(t, -1)) {
          _dsWanted = false;                     // ters yön kilidi — hunt bastırıldı
          shiftState.suppressedHunts++;
        }
        if(_dsWanted) {
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
            isDownshift: true, threshold: dsThreshold, thresholdBasis: 'N_out_ds < esik (downshift)'
          });
          shiftState.gearIdx = g - 1;
          noteShift(t, -1);
          shifted = true;
        }
      }
    }

    return shifted;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // PER-STEP FİZİK HESAPLAMA
  // ═══════════════════════════════════════════════════════════════════════════

  // İkinci parametre `tr` (opsiyonel iz nesnesi) VERİLDİĞİNDE tüm ara değerler
  // ve iterasyonlar tr'ye yazılır (yalnız "Detaylı Hesaplama İzi" raporu için).
  // tr verilmediğinde (normal koşu) hiçbir ek maliyet/davranış yoktur.
  function calcStepPhysics(v_ms, tr) {
    if(v_ms < 0) v_ms = 0;
    var gearData = getCurrentGearData();
    var i_gear = parseFloat(gearData.ratio) || 1.0;
    var isLU = shiftState.isLockup;
    if(tr) {
      tr.v_ms = v_ms; tr.v_kmh = v_ms * 3.6;
      tr.gearName = gearData.name; tr.gearIdx = shiftState.gearIdx;
      tr.i_gear = i_gear; tr.gearEff = parseFloat(gearData.eff) || 98.0;
      tr.isLockup = (tcNode ? isLU : true); tr.hasTCData = hasTCData; tr.hasTC = !!tcNode;
      tr.idleRpm = idleRpm; tr.pumpTorqueDrop = pumpTorqueDrop;
      tr.driveline = { i_propshaft: i_propshaft, psEff: psEff, i_transfer: i_transfer,
                       eta_transfer: eta_transfer, i_axle: i_axle, eta_axle: eta_axle, r_tire: r_tire };
    }

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
      var _N_pre = FT_SOLVER.speedToTurbineRpm(v_ms, i_gear, i_propshaft, i_transfer, i_axle, r_tire);
      N_engine = _N_pre;
      // TK yok: kalkışta debriyaj kaydırarak motor, kalkış-stall (torque-peak) devrinde TUTULUR
      // (rölanti değil); araç hızlanıp rijit-bağlantı devri stall'ı aşınca motor onu izler.
      // Lockup'ta (TK var, kilitli) taban rölanti — converter fazı stall'ı ayrıca ele alır.
      var _floorRpm = (!tcNode) ? _noTcLaunchStall : idleRpm;
      if(N_engine < _floorRpm) N_engine = _floorRpm;
      T_engine = motorTorqueFn(N_engine);
      SR = 1.0;
      tau = 1.0;
      if(tr) {
        tr.branch = (!hasTCData ? 'no-tc-direct' : 'lockup');
        tr.N_engine_kinematic = _N_pre; tr.N_engine_clampedIdle = (_N_pre < _floorRpm);
        tr.floorRpm = _floorRpm;
        tr.N_engine = N_engine; tr.T_engine = T_engine; tr.SR = SR; tr.tau = tau;
        tr.motorGross = grossMotorTorqueFn(N_engine);
      }
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
        if(tr) { tr.eta_direct = eta_direct; tr.T_pump = T_pump; tr.T_output = T_output;
                 tr.omega_eng = omega_dir; tr.heatRejection_kW = heatRejection_kW; }
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
        if(tr) { tr.deltaT_lockup = deltaT_lockup; tr.T_pump = T_pump; tr.T_net_lockup = T_net_lockup;
                 tr.tcEtaLockup = tcEta; tr.T_output = T_output; tr.heatGearNum = gearNum;
                 tr.heatCoeff = { a: hrCoeff.a, b: hrCoeff.b }; tr.heatRejection_kW = heatRejection_kW; }
      }
    } else {
      // ── CONVERTER MOD — KONFİG-BAĞIMSIZ konvertör çalışma noktası ──
      // Motor her adımda konvertör ÇALIŞMA NOKTASINDA tutulur. Nokta, fazlalık
      // excess(N)=net−drop−emiş fonksiyonunun GERÇEK denge tanımıyla (excess'in ≤ 0 geçişi)
      // belirlenir — computeSettledStall (§3.4) ve _findStallSpeed (§3.3) ile TEK VE AYNI
      // tanım (§2.7 birleşme):
      //   • GERÇEK DÜŞÜK DENGE: excess düşük-rpm'de ≤ 0'ı GEÇİYORSA (motor o noktayı aşamaz)
      //     motor orada oturur (düşük dal). Sığ POZİTİF vadi (yerel min > 0) denge DEĞİLDİR.
      //   • YÜKSEK DENGE (stall): excess düşük-rpm'de ≤ 0'a inmiyorsa (yalnız sığ pozitif vadi
      //     ya da monoton) motor near-hang'i GEÇİP yüksek stall dengesine tırmanır — N_eng_dynamic
      //     (computeSettledStall'dan başlatılan entegre durum) bu dengeyi taşır (JMMA/L5D: ~2410;
      //     BMC/isb67: ~2265). [Rev1: eski sığ-vadi "~1010 oyalama" tutması KALDIRILDI.]
      var N_turbine = FT_SOLVER.speedToTurbineRpm(v_ms, i_gear, i_propshaft, i_transfer, i_axle, r_tire);
      if(N_turbine < 0) N_turbine = 0;

      // Düşük dal taraması — idle→noLoad. GERÇEK düşük denge yalnız excess düşük-rpm'de ≤ 0'ı
      // GEÇİYORSA vardır (motor o noktayı aşamaz → orada oturur). Sığ pozitif vadi tabanı
      // (yerel min > 0) bir near-hang'dir, stall DEĞİL → onLowBranch=false, motor yüksek
      // dengeye çıkar (§2.7 birleşme). CONV_MATCH_THRESHOLD artık kabul KAPISI DEĞİL (yalnız iz);
      // kabul kapısı excess ≤ 0'dır → computeSettledStall/_findStallSpeed ile aynı tanım.
      var _lmN = idleRpm, _lmE = Infinity, _prevE = Infinity;
      onLowBranch = false;
      var _scanRows = tr ? [] : null;
      for(var _nS = idleRpm; _nS <= noLoadGoverned; _nS += 10) {
        var _srS = Math.min(0.99, Math.max(0, N_turbine / _nS));
        var _kpS = tcFns.kpump(_srS);
        var _eS = motorTorqueFn(_nS) - pumpTorqueDrop - (_nS * _nS) / (_kpS * _kpS);
        if(_scanRows) _scanRows.push({ N: _nS, SR: _srS, kpump: _kpS, excess: _eS });
        // NaN KALKANI: _eS sonlu değilse aşağıdaki üç karşılaştırma da false döner
        // ve tarama hiç kırılmadan tam sweep (motora göre ~214 iterasyon) yapar.
        // Bu, ölçülen donmanın %98'inin kaynağıydı. Sonlu değilse hemen çık —
        // asıl teşhis zaten pchipCreate'in attığı adresli hatadan geliyor.
        if(!isFinite(_eS)) { onLowBranch = false; break; }
        if(_eS < _lmE) { _lmE = _eS; _lmN = _nS; }
        if(_eS <= 0) { onLowBranch = true; break; }       // GERÇEK denge: excess ilk ≤0 geçişi → o noktada (_lmN) tut
        if(_eS > _prevE) { onLowBranch = false; break; }  // sığ pozitif vadi (near-hang) — düşük denge yok → yüksek dala
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

      var _T_eng_net_cv = null;
      if(onLowBranch) {
        engRate = 0;   // düşük dalda motor devri eşleşme noktasında tutulur (dinamik yok)
      } else {
        // Motor NET (ivmelendirici) torku → dönme ataletini hızlandırır (kopuş rev-up).
        var T_eng_net = T_engine - pumpTorqueDrop - T_pump_absorbed;
        engRate = (T_eng_net / I_eng_rev) * (60 / (2 * Math.PI));  // [rpm/s]
        _T_eng_net_cv = T_eng_net;
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
      if(tr) {
        tr.branch = 'converter'; tr.N_turbine = N_turbine;
        tr.lowBranchScan = { rows: _scanRows, minN: _lmN, minExcess: _lmE,
                             threshold: CONV_MATCH_THRESHOLD, onLowBranch: onLowBranch };
        tr.N_eng_dynamic_state = N_eng_dynamic; tr.N_engine = N_engine;
        tr.SR = SR; tr.tau = tau; tr.Kp = _Kp; tr.T_engine = T_engine;
        tr.motorGross = grossMotorTorqueFn(N_engine);
        tr.T_pump_absorbed = T_pump_absorbed; tr.T_pump = T_pump;
        tr.T_eng_net = _T_eng_net_cv; tr.I_eng_rev = I_eng_rev; tr.engRate = engRate;
        tr.T_turbine_raw = T_turbine_raw; tr.eta_conv_internal = eta_conv_internal;
        tr.T_output = T_output; tr.omega_eng = omega_eng;
        tr.P_heat_converter = P_heat_converter; tr.P_turbine_kW = P_turbine_kW;
        tr.P_heat_gear_mech = P_heat_gear_mech; tr.heatRejection_kW = heatRejection_kW;
      }
    }

    // Dişli verimi — şanzıman kalibreliyse ölçülmüş katsayılarla, değilse evrensel formül.
    var _N_turb_for_eff = isLU ? N_engine : (N_engine * SR);
    var eta_gear = FT_SOLVER.calcGearEfficiency(i_gear, _N_turb_for_eff, _gearEffCo);

    // TK'li modlarda (converter + lockup) dişli mekanik kaybı BURADA bir kez uygulanır —
    // her iki dalın çıkış torku ham bırakıldı (converter: türbin torku; lockup: motor − klaç
    // drag). Böylece eski düz 0.975/0.965 çarpanları yerine devire-bağlı TEK dişli verimi
    // (calcGearEfficiency) kullanılır → çift/üçlü kayıp sayımı yok. TK YOK (doğrudan tahrik)
    // dalında T_output zaten gearData.eff içerdiğinden dokunulmaz.
    var _T_output_pre_gear = T_output;   // iz: dişli verimi UYGULANMADAN önceki çıkış torku
    if(tcNode) T_output = T_output * eta_gear;

    // Çekme kuvveti (ham, grip öncesi) — dişli verimi T_output'a yukarıda uygulandığından
    // calcTractiveEffort çağrısında gear arg = 1.0 (çift-sayım yok).
    var F_traction_raw = FT_SOLVER.calcTractiveEffort(
      T_output, i_gear, 1.0, i_propshaft, psEff,
      i_transfer, eta_transfer, i_axle, eta_axle, r_tire
    );

    // Wheel slip kontrolü
    var F_traction = FT_SOLVER.limitByGrip(F_traction_raw, F_grip);

    // Direnç kuvvetleri
    var resist = FT_SOLVER.calcResistForces(v_ms, {
      m: m_vehicle, Crr: Crr, surfFactor: surfFactor,
      Cd: Cd, A: A_frontal, rho: rho, grade_pct: grade_pct
    });

    // Net kuvvet
    var F_net = F_traction - resist.F_total;

    if(tr) {
      tr.N_turb_for_eff = _N_turb_for_eff; tr.eta_gear = eta_gear;
      tr.T_output_pre_gear = _T_output_pre_gear;   // dişli verimi öncesi (branch [2] çıkışı)
      tr.T_output_geared = T_output;               // dişli verimi sonrası (TE'de kullanılan)
      tr.gearEffApplied = !!tcNode;                // TK'li modda eta_gear T_output'a uygulandı
      tr.F_traction_raw = F_traction_raw; tr.F_grip = F_grip;
      tr.gripLimited = (F_traction_raw > F_grip); tr.F_traction = F_traction;
      tr.Crr_eff = FT_SOLVER.getCrrEffective(Crr, v_ms);
      tr.Crr_static = Crr; tr.surfFactor = surfFactor; tr.grade_pct = grade_pct;
      tr.Cd = Cd; tr.A_frontal = A_frontal; tr.rho = rho; tr.m_vehicle = m_vehicle;
      tr.F_rolling = resist.F_rolling; tr.F_aero = resist.F_aero;
      tr.F_grade = resist.F_grade; tr.F_resist = resist.F_total; tr.F_net = F_net;
    }

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

    if(tr) {
      tr.m_eff = mEff.m_eff; tr.I_eff = mEff.I_eff; tr.massRatio = mEff.ratio;
      tr.massTerms = mEff.terms; tr.accel = accel; tr.accel_g = accel / 9.81;
    }

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
  // TK YOK (doğrudan tahrik) kalkış-stall devri: tam gazda debriyaj kaydırarak motor, net
  // motor torkunun (dolayısıyla TE'nin) MAKSİMUM olduğu devri (torque-peak) tutar. Kalkış
  // rölantiden DEĞİL bu stall noktasından başlar — WITH-TC evrensel çalışma noktasının
  // doğrudan-tahrik karşılığı (konvertör oranı 1:1, stall başlangıç).
  var _noTcLaunchStall = idleRpm;
  if(!tcNode) {
    var _pkT = -Infinity;
    for(var _nP = idleRpm; _nP <= governedSpeed; _nP += 10) {
      var _tP = motorTorqueFn(_nP);
      if(_tP > _pkT) { _pkT = _tP; _noTcLaunchStall = _nP; }
    }
  }
  var N_eng_dynamic = _settledOp ? _settledOp.N_engine
                    : (!tcNode ? _noTcLaunchStall : idleRpm);   // MOTOR DEVRİ — dinamik durum
  var dist = 0;    // m
  var step = 0;
  // Adım bütçesi. Sabit adımlı yöntemlerde maxTime/dt tam doğru sayıdır.
  // RK45'te DEĞİL: adaptif adım kalkışta dt'yi dt_min'e (1e-5) kadar küçültüyor,
  // bu yüzden başlangıç dt'sinden hesaplanan bütçe koşumu SESSİZCE erken kesiyordu
  // (ölçüm: limit 30 s iken yalnız 0.71 s simüle edilip "tamamlandı" gibi
  // döndürülüyordu). Gerçek sonlandırıcı ana döngüdeki `t >= maxTime` koşulu;
  // buradaki sayaç yalnız kaçak korumasıdır → RK45'e bol bütçe ver.
  var maxSteps = Math.ceil(maxTime / dt);
  if(method === 'rk45') maxSteps = Math.min(maxSteps * 50, 2000000);
  var reachedMaxSpeed = false;
  var truncatedByStepBudget = false;   // adım bütçesi bitti mi (sessiz kalmasın)

  // Örnekleme: her adımı kaydetmek çok fazla veri üretir (12000 adım @ 120s/0.01s)
  // Her N adımda bir kayıt al
  var sampleInterval = Math.max(1, Math.round(0.05 / dt)); // ~50 ms aralıkla
  var lastSampleStep = -sampleInterval; // İlk adımda kaydet

  // ── İZ: parametre & sabit dökümü (kilit-adım seçimi için de kullanılır) ──
  var TRACE_SPEED_STEP = 10;   // km/h — kaç km/h'te bir kilit adım yakalansın
  var _lastTraceBand = -1;
  if(traceMode) {
    calcTrace.params = {
      // Araç / aerodinamik
      m_vehicle: m_vehicle, drivenPct: drivenPct, ftHeight: ftHeight, ftWidth: ftWidth,
      A_frontal: A_frontal, Cd: Cd, rho: rho, grade_pct: grade_pct,
      // Lastik / zemin
      r_tire: r_tire, I_tire: I_tire, Crr: Crr, surfFactor: surfFactor,
      crrK1: 0.026909, crrK2: -0.00018893,
      // Motor
      governedSpeed: governedSpeed, noLoadGoverned: noLoadGoverned, idleRpm: idleRpm,
      I_engine: I_engine, accFanLoss: accTotalFanLoss, accOtherLoss: accTotalOtherLoss,
      accFanMode: accFanMode, hasAccessoryLoss: hasAccessoryLoss,
      // Motor tork eğrisi ham verisi (rapor: PCHIP + governor bölümü için)
      torqueData: torqueTable.slice().sort(function(a,b){ return a.rpm - b.rpm; }),
      // Tork konvertörü
      hasTC: !!tcNode, hasTCData: hasTCData, pumpTorqueDrop: pumpTorqueDrop,
      I_conv: I_conv, I_conv_turbine: I_conv_turbine, I_eng_rev: I_eng_rev,
      CONV_MATCH_THRESHOLD: CONV_MATCH_THRESHOLD, couplingSR: tcFns.couplingSR,
      // Konvertör karakteristik ham verisi (rapor: K_pump/τ/η eğrileri için)
      tcData: tcDataArr.slice().sort(function(a,b){ return a.sr - b.sr; }),
      tcName: (tcNode ? (tcd.tcName || '') : ''),
      // Şanzıman / shift
      forwardGears: forwardGears.map(function(g){ return { name:g.name, ratio:parseFloat(g.ratio)||1.0, eff:parseFloat(g.eff)||98.0 }; }),
      shiftProfile: shiftProfile, shiftRefRPM: shiftRefRPM, lockupOffset: lockupOffset,
      shift1C2C_outRatio: SHIFT_1C_2C_OUT_RATIO, shift2C2L_outRatio: SHIFT_2C_2L_OUT_RATIO,
      N_shift_lockup: N_shift_lockup,
      // Aktarma organları
      psEff: psEff, I_propshaft: I_propshaft, i_propshaft: i_propshaft,
      i_transfer: i_transfer, eta_transfer: eta_transfer, transferRange: (activeTransfer && (activeTransfer.kademe||activeTransfer.mode)) || 'High',
      I_tc: I_tc, i_axle: i_axle, eta_axle: eta_axle, I_axle: I_axle_inertia, I_trans: I_trans,
      // Tutunma / çözücü
      mu_traction: mu_traction, F_grip: F_grip,
      method: method, dt: dt, maxTime: maxTime,
      ftAtol: parseFloat(sd.ftAtol) || 1e-6, ftRtol: parseFloat(sd.ftRtol) || 1e-4
    };
  }

  // İZ: bir adım için tüm ara değerleri + entegrasyon iç adımlarını topla.
  function _traceStep(reason, tStep, vStep, distStep, dtStep) {
    var stepTr = { reason: reason, step: step, t: tStep, dist: distStep, dt: dtStep };
    calcStepPhysics(vStep, stepTr);   // aynı v, aynı durum → ph ile birebir; ara değerleri stepTr'ye yazar
    stepTr.N_eng_dynamic_before = N_eng_dynamic;
    // Entegrasyon iç adımları (aktif yönteme göre) — "programın gerçekten yaptığı"
    var integ = { method: method, dt: dtStep, stages: [] };
    if(method === 'euler') {
      var e1 = calcStepPhysics(vStep).accel;
      integ.stages.push({ label: 'a(v)', v_in: vStep, accel: e1 });
      integ.dv = e1 * dtStep; integ.formula = 'dv = a(v)·dt';
    } else if(method === 'heun') {
      var h1 = calcStepPhysics(vStep).accel;
      var h2 = calcStepPhysics(vStep + h1 * dtStep).accel;
      integ.stages.push({ label: 'a1 = a(v)', v_in: vStep, accel: h1 });
      integ.stages.push({ label: 'a2 = a(v+a1·dt)', v_in: vStep + h1 * dtStep, accel: h2 });
      integ.dv = (h1 + h2) / 2 * dtStep; integ.formula = 'dv = (a1+a2)/2·dt';
    } else if(method === 'ralston') {
      var r1 = calcStepPhysics(vStep).accel;
      var r2 = calcStepPhysics(vStep + r1 * dtStep * 2/3).accel;
      integ.stages.push({ label: 'a1 = a(v)', v_in: vStep, accel: r1 });
      integ.stages.push({ label: 'a2 = a(v+2/3·a1·dt)', v_in: vStep + r1 * dtStep * 2/3, accel: r2 });
      integ.dv = (r1 / 4 + r2 * 3/4) * dtStep; integ.formula = 'dv = (a1/4 + 3a2/4)·dt';
    } else if(method === 'rk45') {
      var q1 = calcStepPhysics(vStep).accel;
      var q2 = calcStepPhysics(vStep + q1 * dtStep / 5).accel;
      var q3 = calcStepPhysics(vStep + q1 * dtStep * 3/40 + q2 * dtStep * 9/40).accel;
      var q4 = calcStepPhysics(vStep + q1 * dtStep * 44/45 - q2 * dtStep * 56/15 + q3 * dtStep * 32/9).accel;
      var q5 = calcStepPhysics(vStep + q1 * dtStep * 19372/6561 - q2 * dtStep * 25360/2187 + q3 * dtStep * 64448/6561 - q4 * dtStep * 212/729).accel;
      var q6 = calcStepPhysics(vStep + q1 * dtStep * 9017/3168 - q2 * dtStep * 355/33 + q3 * dtStep * 46732/5247 + q4 * dtStep * 49/176 - q5 * dtStep * 5103/18656).accel;
      integ.stages.push({ label: 'k1', accel: q1 }); integ.stages.push({ label: 'k2', accel: q2 });
      integ.stages.push({ label: 'k3', accel: q3 }); integ.stages.push({ label: 'k4', accel: q4 });
      integ.stages.push({ label: 'k5', accel: q5 }); integ.stages.push({ label: 'k6', accel: q6 });
      var dv5 = (q1 * 35/384 + q3 * 500/1113 + q4 * 125/192 - q5 * 2187/6784 + q6 * 11/84) * dtStep;
      integ.dv = dv5; integ.formula = 'Dormand-Prince 5. derece'; integ.adaptive = true;
    } else { // rk4
      var k1 = calcStepPhysics(vStep).accel;
      var k2 = calcStepPhysics(vStep + k1 * dtStep / 2).accel;
      var k3 = calcStepPhysics(vStep + k2 * dtStep / 2).accel;
      var k4 = calcStepPhysics(vStep + k3 * dtStep).accel;
      integ.stages.push({ label: 'k1 = a(v)', v_in: vStep, accel: k1 });
      integ.stages.push({ label: 'k2 = a(v+k1·dt/2)', v_in: vStep + k1 * dtStep / 2, accel: k2 });
      integ.stages.push({ label: 'k3 = a(v+k2·dt/2)', v_in: vStep + k2 * dtStep / 2, accel: k3 });
      integ.stages.push({ label: 'k4 = a(v+k3·dt)', v_in: vStep + k3 * dtStep, accel: k4 });
      integ.dv = (k1 + 2 * k2 + 2 * k3 + k4) / 6 * dtStep;
      integ.formula = 'dv = (k1+2k2+2k3+k4)/6·dt';
    }
    integ.v_next = vStep + integ.dv;
    stepTr.integration = integ;
    calcTrace.steps.push(stepTr);
    return stepTr;
  }

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
    // GÜVENLİK LİMİTİ — zaman tabanlı. maxSteps yalnız BAŞLANGIÇ dt'sinden
    // hesaplanıyor; RK45 dalı dt'yi adım adım büyütebildiği için adım sayacı tek
    // başına limiti korumuyordu (300 s ayarlıyken 2586 s simüle edilebiliyordu).
    if(t >= maxTime) break;

    // Fizik hesapla (mevcut durumda)
    var ph = calcStepPhysics(v);

    // NaN KALKANI: durum bir kez sonlu olmaktan çıkarsa aşağıdaki hiçbir erken
    // çıkış koşulu (F_net ≤ 0, |accel| < 0.005) bir daha tetiklenemez — NaN
    // karşılaştırmaları hep false. Sessizce maxSteps'i yakıp NaN dolu bir sonuç
    // döndürmek yerine, nerede bozulduğunu söyleyen bir hata at.
    if(!isFinite(v) || !isFinite(ph.accel)) {
      throw new Error('Sayısal çözüm bozuldu (adım ' + step + ', t=' + t.toFixed(2) + ' s): ' +
                      'hız=' + v + ', ivme=' + ph.accel + '. ' +
                      'Genellikle motor tork tablosu veya konvertör tablosundaki geçersiz/yinelenen ' +
                      'satırdan kaynaklanır — ilgili bileşenin verisini kontrol edin.');
    }

    // Kayıt (örnekleme aralığında)
    if(step - lastSampleStep >= sampleInterval || step === 0) {
      recordStep(t, v, dist, ph);
      lastSampleStep = step;
    }

    // ── İZ: kilit adım (kalkış + her TRACE_SPEED_STEP km/h) ──
    if(traceMode) {
      var _band = Math.floor((v * 3.6) / TRACE_SPEED_STEP);
      if(step === 0 || _band > _lastTraceBand) {
        _lastTraceBand = _band;
        _traceStep(step === 0 ? 'kalkis (v=0)' : ('hiz-izgarasi (~' + (_band * TRACE_SPEED_STEP) + ' km/h)'), t, v, dist, dt);
      }
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
      // ── İZ: vites geçişi — YENİ vites durumuyla tam yakalama + geçiş olayı ──
      if(traceMode) {
        var _shTr = _traceStep('vites-gecisi', t, v, dist, dt);
        _shTr.shiftEvent = shiftState.shiftHistory[shiftState.shiftHistory.length - 1] || null;
      }
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
        if(traceMode) _traceStep('maks-hiz (V_max)', t, v, dist, dt);
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
      // Toleranslar POZİTİF olmalı. `parseFloat(x) || varsayılan` negatifi elemez
      // (negatif sayı truthy'dir); tol < 0 iken `err <= tol` asla sağlanmaz ve
      // Math.pow(negatif, 0.25) = NaN üzerinden dt kalıcı NaN olur → aşağıdaki
      // kabul döngüsü sonsuza kadar döner.
      var ftAtol = Math.abs(parseFloat(sd.ftAtol)) || 1e-6;
      var ftRtol = Math.abs(parseFloat(sd.ftRtol)) || 1e-4;
      var dt_min = 1e-5;
      var dt_max = 0.1;
      var accepted = false;
      var dt_used = dt; // Bu adımda kullanılan dt'yi sakla
      // Adım-küçültme denemesi için ÜST SINIR. dt_min'e inmek en kötü ihtimalle
      // ~40 yarılama alır (0.1 → 1e-5, çarpan ≥ 0.2); 100 fazlasıyla yeterli.
      // Sınır olmadan bu döngü tek gerçek sonsuz döngüydü: err/dt NaN olduğunda
      // iki çıkış koşulu da (err <= tol, dt <= dt_min) kalıcı olarak false kalır.
      var rk45Tries = 0;
      while(!accepted) {
        if(!isFinite(dt) || dt <= 0) dt = dt_min;   // NaN/0 dt'yi tabana çek
        if(++rk45Tries > 100) {
          throw new Error('RK45 adaptif adım yakınsamadı (adım ' + step + ', t=' + t.toFixed(2) +
                          ' s, dt=' + dt + '). Sabit adımlı bir yöntem (RK4) deneyin ya da ' +
                          'motor/konvertör tablolarını kontrol edin.');
        }
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

  // Adım bütçesi, hedef süreye VARILMADAN ve maks hıza ULAŞILMADAN bittiyse sonuç
  // eksiktir. Sessizce "tamamlandı" gibi dönmesin — solverStats üzerinden raporlansın.
  // Bir adımdan fazla geride kaldıysa gerçekten kesilmiştir; kayan nokta birikmesi
  // yüzünden t'nin maxTime'ın kıl payı altında kalması yanlış uyarı üretmesin.
  if(step >= maxSteps && t < maxTime - Math.max(dt, 1e-9) && !reachedMaxSpeed) {
    truncatedByStepBudget = true;
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
    truncatedByStepBudget: truncatedByStepBudget,
    simEndTime: t,
    suppressedHunts: shiftState.suppressedHunts,
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
    // İz modunda tarama iterasyonlarını yakalamak için traceSink ile YENİDEN hesapla
    // (aynı opsiyonlar → _settledOp ile birebir aynı sonuç). Normalde _settledOp yeniden kullanılır.
    var _ssTrace = traceMode ? {} : null;
    var _ss = (traceMode || !_settledOp)
      ? FT_SOLVER.computeSettledStall(motorTorqueFn, tcFns, pumpTorqueDrop, idleRpm,
                                      { nMax: noLoadGoverned, tol: CONV_MATCH_THRESHOLD, traceSink: _ssTrace })
      : _settledOp;
    var _iGear1 = parseFloat(forwardGears[0].ratio) || 1.0;
    // Dişli verimi sim converter dalıyla tutarlı (calcGearEfficiency; stall'da türbin=0 → SR=0).
    var _etaG1 = FT_SOLVER.calcGearEfficiency(_iGear1, 0, _gearEffCo);
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
    if(traceMode) {
      calcTrace.settledStall = {
        scan: _ssTrace, i_gear: _iGear1, etaGear: _etaG1, T_turbine: _ss.T_turbine,
        T_output: _Tout, TE_N: _TE, F_grip: F_grip, F_roll0: _Froll0, slip: (_TE > F_grip),
        TE_kN: _TE / 1000, DP_kN: (_TE - _Froll0) / 1000,
        driveline: { i_propshaft: i_propshaft, psEff: psEff, i_transfer: i_transfer,
                     eta_transfer: eta_transfer, i_axle: i_axle, eta_axle: eta_axle, r_tire: r_tire }
      };
    }
  }

  // ── DÜŞÜK-HIZ (~10 km/h) QUASİ-STATİK ÇALIŞMA NOKTASI — düşük-hız eğim metriği için ──
  // Transient iz o hızda motor henüz tam oturmadığından (kopuş yeni bitmiş) çekişi düşük
  // okur. Düşük-hız eğim kabiliyeti motorun O HIZDA oturduğu dengeden hesaplanmalı.
  var lowSpeedOp = null;
  if(tcNode && hasTCData) {
    var _vRef = 10 / 3.6;  // m/s
    var _iG1 = parseFloat(forwardGears[0].ratio) || 1.0;
    var _Nturb = FT_SOLVER.speedToTurbineRpm(_vRef, _iG1, i_propshaft, i_transfer, i_axle, r_tire);
    var _opTrace = traceMode ? {} : null;
    var _op = FT_SOLVER.solveTCOperatingPoint(_Nturb, motorTorqueFn, tcFns, pumpTorqueDrop,
                                              { N_min: idleRpm, N_max: noLoadGoverned + 100, traceSink: _opTrace });
    var _etaG2 = FT_SOLVER.calcGearEfficiency(_iG1, _op.SR ? _op.N_engine * _op.SR : 0, _gearEffCo);
    var _To2 = _op.T_turbine * _etaG2;
    // GRİP-LİMİTSİZ (drivetrain kapasitesi) — düşük-hız eğim metriği de kapasite raporlar.
    var _TE2 = FT_SOLVER.calcTractiveEffort(_To2, _iG1, 1.0, i_propshaft, psEff,
                                            i_transfer, eta_transfer, i_axle, eta_axle, r_tire);
    var _Froll10 = FT_SOLVER.getCrrEffective(Crr, _vRef) * (surfFactor || 1.0) * m_vehicle * 9.81;
    var _Faero10 = 0.5 * rho * Cd * A_frontal * _vRef * _vRef;
    lowSpeedOp = { v_kmh: 10, TE_kN: _TE2 / 1000, DP_kN: (_TE2 - _Froll10 - _Faero10) / 1000,
                   slip: (_TE2 > F_grip) };
    if(traceMode) {
      calcTrace.lowSpeedOp = {
        v_kmh: 10, v_ms: _vRef, N_turbine: _Nturb, bisection: _opTrace,
        op: { N_engine: _op.N_engine, SR: _op.SR, tau: _op.tau, T_pump: _op.T_pump, T_turbine: _op.T_turbine, converged: _op.converged },
        i_gear: _iG1, etaGear: _etaG2, T_output: _To2, TE_N: _TE2, F_grip: F_grip, slip: (_TE2 > F_grip),
        F_roll10: _Froll10, F_aero10: _Faero10, TE_kN: _TE2 / 1000, DP_kN: (_TE2 - _Froll10 - _Faero10) / 1000
      };
    }
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
    gearEffCo: _gearEffCo,        // dişli verim katsayıları — rapor/diyagram çözücüyle aynı modeli kullansın
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
    calcTrace: calcTrace,   // Detaylı Hesaplama İzi (yalnız window._veFTTraceEnabled açıkken dolu)
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
        accessories: (_ed.accessories||[]).map(function(a){return{name:a.name,standardLoss:parseFloat(a.standardLoss)||0,userLoss:parseFloat(a.userLoss)||0,curve:a.curve?a.curve.slice():undefined,driveRatio:a.driveRatio,kwConst:a.kwConst};}),
        torqueData: (ed.torqueData||ed.motorData||[]).map(function(p){return{rpm:p.rpm,torque:p.torque,power:p.power};}),
        fanLossGov: accTotalFanLoss, otherLossGov: accTotalOtherLoss, accFanMode: accFanMode,
        gbName: _gbP ? _gbP.name : (_gbd.gbName||'—'), gbFamily: _gbP ? (_gbP.family||'—') : '—', gbEff: parseFloat(_gbd.efficiency)||97, tcName: _tcN,
        shiftProfile: shiftProfile, shiftProfileRegistered: shiftProfileRegistered, shiftRefRPM: shiftRefRPM, lockupOffset: lockupOffset,
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

// ── Transfer kademelerinin YÜKSEK/DÜŞÜK rolünü ORANDAN çözer ────────────────
// Eskiden rol DİZİ KONUMUNDAN alınıyordu (trGears[0] = yüksek, trGears[1] = düşük)
// ve bu varsayım hiçbir yerde doğrulanmıyordu. Oysa iSCAAN raporlarında bile
// High/Low ETİKETLERİ başvurudan başvuruya ters dönebiliyor — aynı BMC 10TON 6×6
// aracının iki raporu buna örnek:
//     497-A355435-1 : Low = 1.536, High = 0.874
//     497-A355294-1 : Low = 0.874, High = 1.536
// Rapordaki etiket sırasını kopyalayan kullanıcı diziyi ters girdiğinde fizik
// doğru kalıyordu ama "Yüksek/Düşük Kademe" adlandırması sessizce ters dönüyor,
// bu da sonuç paneline, eğim grafiğine, TXT ve HTML raporlarına yayılıyordu.
//
// Kural: KÜÇÜK oran = yüksek (hızlı) kademe. İkiden çok kademe verilirse uçlar
// (en küçük / en büyük oran) esas alınır.
// Dönüş: null (tek kademe) | { other, otherRatio, activeIsLow }
function veResolveTransferRoles(trGears, activeRatio) {
  if(!trGears || trGears.length < 2) return null;
  var num = function(g) { return parseFloat(g.ratio != null ? g.ratio : g.oran) || 0; };
  var fast = trGears[0], slow = trGears[0];
  for(var i = 1; i < trGears.length; i++) {
    if(num(trGears[i]) < num(fast)) fast = trGears[i];
    if(num(trGears[i]) > num(slow)) slow = trGears[i];
  }
  if(num(fast) === num(slow)) return null;            // tüm oranlar aynı → rol yok
  // Aktif kademe hangisine daha yakınsa o roldedir.
  var activeIsLow = Math.abs(activeRatio - num(slow)) < Math.abs(activeRatio - num(fast));
  var other = activeIsLow ? fast : slow;
  return { other: other, otherRatio: num(other), activeIsLow: activeIsLow };
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
  
  // Rolleri ORANDAN çöz (dizi konumundan DEĞİL — bkz. veResolveTransferRoles).
  var _roles = (rs.hasTransfer && trGears.length > 1) ? veResolveTransferRoles(trGears, activeRatio) : null;
  var activeIsLow = !!(_roles && _roles.activeIsLow);

  // Simüle edilmiş (aktif) kademe
  var result = {};
  var resActive = veCalcGradeForRatio(ftData, m_kg, activeRatio, activeIsLow, rs.hasTC);
  resActive.label = 'Transfer Kutusu: ' + (activeIsLow ? 'Düşük' : 'Yüksek') +
    ' Kademe (' + activeRatio.toFixed(3) + ')';

  // Düşük-hız eğimini quasi-statik (~10 km/h oturmuş) noktadan override et (Fix A §1.3.3) —
  // transient iz o hızda motoru tam oturmamış gösterip çekişi düşük okuyor.
  // simResult.lowSpeedOp AKTİF kademeye aittir → aktif sonuca uygulanır.
  if(simResult.lowSpeedOp) {
    var _mgH = m_kg * 9.81 / 1000;
    var _dpL = simResult.lowSpeedOp.DP_kN;
    resActive.lowSpeedGrade = (_dpL / _mgH >= 1.0) ? 999.0
      : Math.round(Math.tan(Math.asin(_dpL / _mgH)) * 100 * 10) / 10;
    resActive.lowSpeedV = simResult.lowSpeedOp.v_kmh;
  }

  // Diğer kademe (ikinci transfer oranı varsa)
  var resOther = null;
  if(_roles) {
    var lowGear = _roles.other;
    var lowRatio = _roles.otherRatio;
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
      resOther = veCalcGradeForRatio(ftDataLow, m_kg, lowRatio, !activeIsLow, rs.hasTC);
      resOther.label = 'Transfer Kutusu: ' + (activeIsLow ? 'Yüksek' : 'Düşük') +
        ' Kademe (' + lowRatio.toFixed(3) + ')';
      resOther.source = lowSimResult ? 'simulation' : 'scaling';
    }
  }

  // Rollere göre yerleştir: high = hızlı (küçük oran), low = yavaş (büyük oran).
  if(activeIsLow) { result.high = resOther; result.low = resActive; }
  else            { result.high = resActive; result.low = resOther; }
  // Yalnız aktif kademe hesaplanabildiyse (diğeri veri yetersizliğinden düştü)
  // high boş kalmasın — tüketiciler G.high'ı zorunlu sayıyor.
  if(!result.high) { result.high = resActive; result.low = null; }

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
  
  // Rolleri ORANDAN çöz (dizi konumundan DEĞİL — bkz. veResolveTransferRoles).
  var _rolesA = (rs.hasTransfer && trGears.length > 1) ? veResolveTransferRoles(trGears, activeRatio) : null;
  var activeIsLowA = !!(_rolesA && _rolesA.activeIsLow);

  var result = {};
  var accActive = {
    transferRatio: activeRatio,
    label: 'Transfer Kutusu: ' + (activeIsLowA ? 'Düşük' : 'Yüksek') +
      ' Kademe (' + activeRatio.toFixed(3) + ')',
    maxSpeed: Math.round(maxSpeed * 10) / 10,
    rows: veExtractAccelMilestones(speed, time, distance, maxSpeed)
  };

  // Diğer kademe (ikinci transfer oranı varsa)
  var accOther = null;
  if(_rolesA) {
    var lowGear = _rolesA.other;
    var lowRatio = _rolesA.otherRatio;

    // Gerçek düşük kademe simülasyon sonuçları varsa onları kullan
    var allRangeRes = typeof window !== 'undefined' ? window._veFTAllRangeResults : null;
    var lowKademe = lowGear.kademe || 'Low';
    var lowSimResult = allRangeRes ? allRangeRes[lowKademe] : null;

    if(lowSimResult && lowSimResult.speed && lowSimResult.time && lowSimResult.distance) {
      // Gerçek simülasyon verisi — doğru ivme, doğru eşdeğer kütle
      var lowSS = lowSimResult.solverStats || {};
      var lowMaxSpeed = lowSS.maxSpeed_kmh || Math.max.apply(null, lowSimResult.speed);
      accOther = {
        transferRatio: lowRatio,
        label: 'Transfer Kutusu: ' + (activeIsLowA ? 'Yüksek' : 'Düşük') +
          ' Kademe (' + lowRatio.toFixed(3) + ')',
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
      accOther = {
        transferRatio: lowRatio,
        label: 'Transfer Kutusu: ' + (activeIsLowA ? 'Yüksek' : 'Düşük') +
          ' Kademe (' + lowRatio.toFixed(3) + ')',
        maxSpeed: lowMaxSpeedRound,
        rows: veExtractAccelMilestones(lowSpeed, lowTime, lowDist, lowMaxSpeedRound),
        source: 'scaling'
      };
    }
  }

  // Rollere göre yerleştir: high = hızlı (küçük oran), low = yavaş (büyük oran).
  if(activeIsLowA) { result.high = accOther; result.low = accActive; }
  else             { result.high = accActive; result.low = accOther; }
  if(!result.high) { result.high = accActive; result.low = null; }

  return result;
}
