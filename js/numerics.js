// ============================================================================
// SAYISAL YÖNTEMLER KÜTÜPHANESİ (VE Simülasyon Motoru için)
// ============================================================================

// ────────── 1. PCHIP SPLİNE İNTERPOLASYONU ──────────
// Monotone Cubic Hermite (PCHIP): C¹ sürekli, şekil koruyucu
// Lineer interpolasyondaki türev süreksizliğini giderir.
// Motor tork eğrisi fiziksel olarak pürüzsüz → spline daha doğru temsil.

function veBuildPchipSpline(points) {
  // points: [{rpm, torque}, ...] sıralı
  var n = points.length;
  if(n < 3) return null; // 2 nokta için PCHIP anlamsız, lineer yeter
  
  var x = points.map(function(p) { return p.rpm; });
  var y = points.map(function(p) { return p.torque; });
  
  // Aralık genişlikleri ve eğimler
  var h = new Array(n - 1);
  var delta = new Array(n - 1);
  for(var i = 0; i < n - 1; i++) {
    h[i] = x[i + 1] - x[i];
    delta[i] = (h[i] > 1e-12) ? (y[i + 1] - y[i]) / h[i] : 0;
  }
  
  // Düğüm noktası türevleri (Fritsch-Carlson yöntemi)
  var m = new Array(n).fill(0);
  
  // İç noktalar: ağırlıklı harmonik ortalama
  for(var i = 1; i < n - 1; i++) {
    var d0 = delta[i - 1];
    var d1 = delta[i];
    if(d0 * d1 <= 0) {
      m[i] = 0; // Monotonluk: farklı işaretli eğimler → sıfır türev
    } else {
      var w1 = 2 * h[i] + h[i - 1];
      var w2 = h[i] + 2 * h[i - 1];
      m[i] = (w1 + w2) / (w1 / d0 + w2 / d1);
    }
  }
  
  // Uç noktalar (karesel ekstrapolasyon, monotonluk korumalı)
  m[0] = ((2 * h[0] + h[1]) * delta[0] - h[0] * delta[1]) / (h[0] + h[1]);
  if(m[0] * delta[0] <= 0) m[0] = 0;
  else if(Math.abs(m[0]) > 3 * Math.abs(delta[0])) m[0] = 3 * delta[0];
  
  if(n >= 3) {
    m[n-1] = ((2*h[n-2]+h[n-3])*delta[n-2] - h[n-2]*delta[n-3]) / (h[n-2]+h[n-3]);
    if(m[n-1] * delta[n-2] <= 0) m[n-1] = 0;
    else if(Math.abs(m[n-1]) > 3 * Math.abs(delta[n-2])) m[n-1] = 3 * delta[n-2];
  }
  
  // Hermite kübik katsayıları: y(t) = c0 + c1·t + c2·t² + c3·t³
  // t = (xq - x[i])
  var c0 = new Array(n - 1);
  var c1 = new Array(n - 1);
  var c2 = new Array(n - 1);
  var c3 = new Array(n - 1);
  
  for(var i = 0; i < n - 1; i++) {
    var hi = h[i];
    c0[i] = y[i];
    c1[i] = m[i];
    c2[i] = (3 * delta[i] - 2 * m[i] - m[i + 1]) / hi;
    c3[i] = (m[i] + m[i + 1] - 2 * delta[i]) / (hi * hi);
  }
  
  return { x: x, y: y, c0: c0, c1: c1, c2: c2, c3: c3, n: n };
}

function veEvalPchip(spline, xq) {
  if(!spline) return 0;
  var x = spline.x;
  var n = spline.n;
  if(n === 0) return 0;
  
  // Sınır: tablo dışı → uç değer (flat extrapolation)
  if(xq <= x[0]) return spline.y[0];
  if(xq >= x[n - 1]) return spline.y[n - 1];
  
  // Binary search (O(log n) — çok noktalı tablolarda hızlı)
  var lo = 0, hi = n - 2;
  while(lo < hi) {
    var mid = (lo + hi) >> 1;
    if(xq > x[mid + 1]) lo = mid + 1;
    else hi = mid;
  }
  
  var t = xq - x[lo];
  return spline.c0[lo] + spline.c1[lo] * t + spline.c2[lo] * t * t + spline.c3[lo] * t * t * t;
}

// PCHIP 1. türevi (dT/dRPM — hassasiyet analizi için)
function veEvalPchipDeriv(spline, xq) {
  if(!spline) return 0;
  var x = spline.x;
  var n = spline.n;
  if(n < 2) return 0;
  if(xq <= x[0] || xq >= x[n - 1]) return 0; // uçlarda türev = 0
  
  var lo = 0, hi = n - 2;
  while(lo < hi) {
    var mid = (lo + hi) >> 1;
    if(xq > x[mid + 1]) lo = mid + 1;
    else hi = mid;
  }
  
  var t = xq - x[lo];
  return spline.c1[lo] + 2 * spline.c2[lo] * t + 3 * spline.c3[lo] * t * t;
}

// ────────── 2. DORMAND-PRINCE RK45 ADAPTİF SOLVER ──────────
// MATLAB ode45, SciPy solve_ivp'nin varsayılan yöntemi.
// 4. ve 5. mertebe çözümleri aynı anda hesaplar; farkı hata tahmini olarak kullanır.
// Hata büyükse dt küçülür, düzgün bölgelerde dt büyür.

var DOPRI_A = [
  [],
  [1/5],
  [3/40, 9/40],
  [44/45, -56/15, 32/9],
  [19372/6561, -25360/2187, 64448/6561, -212/729],
  [9017/3168, -355/33, 46732/5247, 49/176, -5103/18656],
  [35/384, 0, 500/1113, 125/192, -2187/6784, 11/84]
];

var DOPRI_C = [0, 1/5, 3/10, 4/5, 8/9, 1, 1];

// 5. mertebe katsayıları (ana çözüm)
var DOPRI_B5 = [35/384, 0, 500/1113, 125/192, -2187/6784, 11/84, 0];

// 4. mertebe katsayıları (hata tahmini için)
var DOPRI_B4 = [5179/57600, 0, 7571/16695, 393/640, -92097/339200, 187/2100, 1/40];

// Hata katsayıları: E = B5 - B4
var DOPRI_E = DOPRI_B5.map(function(b5, i) { return b5 - DOPRI_B4[i]; });

/**
 * RK45 Dormand-Prince adaptif integratör
 * @param {function} f - dv/dt = f(t, v) → ivme hesaplayan fonksiyon
 * @param {number} t0 - başlangıç zamanı
 * @param {number} v0 - başlangıç değeri (hız m/s)
 * @param {number} tEnd - bitiş zamanı
 * @param {object} opts - {atol, rtol, dtMin, dtMax, dtInit, maxSteps, outputDt, eventFn}
 * @returns {object} - {t[], v[], dt_used[], errors[], rejected, events[]}
 */
function veRK45Solve(f, t0, v0, tEnd, opts) {
  opts = opts || {};
  var atol = opts.atol || 1e-6;       // Mutlak tolerans
  var rtol = opts.rtol || 1e-4;       // Bağıl tolerans
  var dtMin = opts.dtMin || 1e-6;     // Minimum dt
  var dtMax = opts.dtMax || (tEnd - t0) / 10;
  var dtInit = opts.dtInit || (tEnd - t0) / 200;
  var maxSteps = opts.maxSteps || 50000;
  var outputDt = opts.outputDt || (tEnd - t0) / 500;  // Çıktı aralığı
  var eventFn = opts.eventFn || null;  // Event detection fonksiyonu
  var onStep = opts.onStep || null;    // Her adımda çağrılacak callback
  
  // Sonuç dizileri (sabit aralıklı çıktı)
  var out_t = [];
  var out_v = [];
  var out_dt = [];
  var out_err = [];
  
  // İç değişkenler
  var t = t0;
  var v = v0;
  var dt = Math.min(dtInit, dtMax);
  var rejected = 0;
  var totalSteps = 0;
  var events = [];
  
  // Sabit aralıklı çıktı için sonraki hedef zaman
  var nextOutput = t0;
  var lastOutputV = v0;
  var lastOutputT = t0;
  
  // Safety factor (standart: 0.84 = 0.9 × (4/5)^(1/4))
  var SAFETY = 0.84;
  var MIN_SCALE = 0.2;  // dt en fazla 5x küçülebilir
  var MAX_SCALE = 5.0;  // dt en fazla 5x büyüyebilir
  
  // İlk çıktı noktası
  out_t.push(t);
  out_v.push(v);
  out_dt.push(dt);
  out_err.push(0);
  
  while(t < tEnd - dtMin && totalSteps < maxSteps) {
    // dt'yi tEnd'e taşırma
    if(t + dt > tEnd) dt = tEnd - t;
    if(dt < dtMin) dt = dtMin;
    
    // ====== Dormand-Prince 7 aşama ======
    var k = new Array(7);
    k[0] = f(t, v);
    
    for(var s = 1; s < 7; s++) {
      var v_s = v;
      for(var j = 0; j < s; j++) {
        v_s += DOPRI_A[s][j] * k[j] * dt;
      }
      if(v_s < 0) v_s = 0;
      k[s] = f(t + DOPRI_C[s] * dt, v_s);
    }
    
    // 5. mertebe çözüm (ana)
    var v_new = v;
    for(var i = 0; i < 7; i++) {
      v_new += DOPRI_B5[i] * k[i] * dt;
    }
    
    // Hata tahmini: |5. mertebe - 4. mertebe|
    var err = 0;
    for(var i = 0; i < 7; i++) {
      err += DOPRI_E[i] * k[i] * dt;
    }
    err = Math.abs(err);
    
    // Tolerans karşılaştırması
    var sc = atol + rtol * Math.max(Math.abs(v), Math.abs(v_new));
    var errRatio = err / sc;
    
    if(errRatio <= 1.0) {
      // ====== ADIM KABUL ======
      var t_old = t;
      var v_old = v;
      
      t += dt;
      if(v_new < 0) v_new = 0;
      v = v_new;
      totalSteps++;
      
      // ── Event Detection: süreksizlik yakalama ──
      if(eventFn) {
        var ev_old = eventFn(t_old, v_old);
        var ev_new = eventFn(t, v);
        
        // İşaret değişimi → bisection ile tam anı bul
        if(ev_old * ev_new < 0) {
          var tA = t_old, vA = v_old;
          var tB = t, vB = v;
          // Bisection (12 iterasyon ≈ dt/4096 hassasiyet)
          for(var bi = 0; bi < 12; bi++) {
            var tM = (tA + tB) / 2;
            // Hermite interpolasyon ile ara değer
            var frac = (tM - t_old) / dt;
            var vM = v_old + frac * (v - v_old); // basit lineer ara değer
            var ev_mid = eventFn(tM, vM);
            if(ev_old * ev_mid < 0) { tB = tM; vB = vM; }
            else { tA = tM; vA = vM; ev_old = ev_mid; }
          }
          events.push({ t: (tA + tB) / 2, v: (vA + vB) / 2, type: 'crossing' });
        }
      }
      
      // ── Sabit aralıklı çıktı üretimi ──
      while(nextOutput <= t + 1e-12 && nextOutput <= tEnd + 1e-12) {
        if(nextOutput >= t_old - 1e-12) {
          // Adım içi lineer interpolasyon
          var alpha = (dt > 1e-15) ? (nextOutput - t_old) / dt : 0;
          var v_interp = v_old + alpha * (v - v_old);
          out_t.push(parseFloat(nextOutput.toFixed(6)));
          out_v.push(Math.max(0, v_interp));
          out_dt.push(dt);
          out_err.push(err);
        }
        nextOutput += outputDt;
      }
      
      // Callback
      if(onStep) onStep(t, v, dt, err, totalSteps);
      
      // ── Yeni dt hesabı ──
      var scale;
      if(errRatio < 1e-10) {
        scale = MAX_SCALE;
      } else {
        // Optimal ölçek faktörü: (1/errRatio)^(1/5) × safety
        scale = SAFETY * Math.pow(1.0 / errRatio, 0.2);
        scale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, scale));
      }
      dt = Math.min(dt * scale, dtMax);
      
    } else {
      // ====== ADIM REDDEDİLDİ — dt küçült ======
      rejected++;
      var scale = SAFETY * Math.pow(1.0 / errRatio, 0.2);
      scale = Math.max(MIN_SCALE, scale);
      dt = Math.max(dt * scale, dtMin);
    }
    
    // Durma koşulu
    if(v < 1e-4 && opts.stopAtZero) break;
  }
  
  // Son noktayı ekle (tEnd'e ulaşıldıysa)
  if(out_t[out_t.length - 1] < tEnd - outputDt * 0.5) {
    out_t.push(parseFloat(tEnd.toFixed(6)));
    out_v.push(Math.max(0, v));
    out_dt.push(dt);
    out_err.push(0);
  }
  
  return {
    t: out_t,
    v: out_v,
    dt_used: out_dt,
    errors: out_err,
    totalSteps: totalSteps,
    rejected: rejected,
    events: events,
    finalDt: dt
  };
}

// ────────── 3. ENERJİ DENGESİ HESAPLAYICI ──────────
// Her zaman adımında enerji muhasebesi: ΔKE + W_dissipation + W_grade = W_engine
// Sapma = sayısal hata birikimi

function veEnergyBalance() {
  // Factory: parametre alıp tracker döndürür
  return {
    KE_initial: 0,
    W_engine: 0,        // Motor işi
    W_rolling: 0,       // Yuvarlanma kayıp
    W_aero: 0,          // Hava direnci kayıp
    W_grade: 0,         // Eğim potansiyel enerji değişimi
    
    init: function(mass, v0) {
      this.KE_initial = 0.5 * mass * v0 * v0;
      this.mass = mass;
    },
    
    // Her zaman adımında çağır
    addStep: function(v_old, v_new, dt, F_engine, F_rolling, F_aero, F_grade) {
      var ds = 0.5 * (v_old + v_new) * dt; // Trapezoidal mesafe
      this.W_engine += F_engine * ds;
      this.W_rolling += F_rolling * ds;
      this.W_aero += F_aero * ds;
      this.W_grade += F_grade * ds;
    },
    
    // Enerji hatası hesapla
    getError: function(v_final) {
      var KE_final = 0.5 * this.mass * v_final * v_final;
      var deltaKE = KE_final - this.KE_initial;
      
      // Enerji korunumu: ΔKE = W_grade - W_rolling - W_aero + W_engine
      var W_net = this.W_grade - this.W_rolling - this.W_aero + this.W_engine;
      var error = deltaKE - W_net;
      var totalEnergy = Math.abs(this.KE_initial) + Math.abs(this.W_grade) + Math.abs(this.W_rolling) + Math.abs(this.W_aero) + Math.abs(this.W_engine);
      var relError = totalEnergy > 0 ? Math.abs(error) / totalEnergy : 0;
      
      return {
        deltaKE: deltaKE,
        W_net: W_net,
        error_J: error,
        error_rel: relError,
        error_pct: relError * 100,
        breakdown: {
          KE_initial: this.KE_initial,
          KE_final: KE_final,
          W_engine: this.W_engine,
          W_rolling: this.W_rolling,
          W_aero: this.W_aero,
          W_grade: this.W_grade
        }
      };
    }
  };
}


