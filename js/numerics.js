// ============================================================================
// SAYISAL YONTEMLER KUTUPHANESI (VE Simulasyon Motoru icin)
// ============================================================================

// ────────── 1. PCHIP SPLINE INTERPOLASYONU ──────────
// Monotone Cubic Hermite (PCHIP): C1 surekli, sekil koruyucu
// Lineer interpolasyondaki turev sureksizligini giderir.
// Motor tork egrisi fiziksel olarak puruzuz → spline daha dogru temsil.

function veBuildPchipSpline(points) {
  // points: [{rpm, torque}, ...] sirali
  var n = points.length;
  if(n < 3) return null; // 2 nokta icin PCHIP anlamsiz, lineer yeter

  var x = points.map(function(p) { return p.rpm; });
  var y = points.map(function(p) { return p.torque; });

  // Aralik genislikleri ve egimler
  var h = new Array(n - 1);
  var delta = new Array(n - 1);
  for(var i = 0; i < n - 1; i++) {
    h[i] = x[i + 1] - x[i];
    delta[i] = (h[i] > 1e-12) ? (y[i + 1] - y[i]) / h[i] : 0;
  }

  // Dugum noktasi turevleri (Fritsch-Carlson yontemi)
  var m = new Array(n).fill(0);

  // Ic noktalar: agirlikli harmonik ortalama
  for(var i = 1; i < n - 1; i++) {
    var d0 = delta[i - 1];
    var d1 = delta[i];
    if(d0 * d1 <= 0) {
      m[i] = 0; // Monotonluk: farkli isaretli egimler → sifir turev
    } else {
      var w1 = 2 * h[i] + h[i - 1];
      var w2 = h[i] + 2 * h[i - 1];
      m[i] = (w1 + w2) / (w1 / d0 + w2 / d1);
    }
  }

  // Uc noktalar (karesel ekstrapolasyon, monotonluk korumali)
  m[0] = ((2 * h[0] + h[1]) * delta[0] - h[0] * delta[1]) / (h[0] + h[1]);
  if(m[0] * delta[0] <= 0) m[0] = 0;
  else if(Math.abs(m[0]) > 3 * Math.abs(delta[0])) m[0] = 3 * delta[0];

  if(n >= 3) {
    m[n-1] = ((2*h[n-2]+h[n-3])*delta[n-2] - h[n-2]*delta[n-3]) / (h[n-2]+h[n-3]);
    if(m[n-1] * delta[n-2] <= 0) m[n-1] = 0;
    else if(Math.abs(m[n-1]) > 3 * Math.abs(delta[n-2])) m[n-1] = 3 * delta[n-2];
  }

  // Hermite kubik katsayilari: y(t) = c0 + c1*t + c2*t^2 + c3*t^3
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

  // Sinir: tablo disi → uc deger (flat extrapolation)
  if(xq <= x[0]) return spline.y[0];
  if(xq >= x[n - 1]) return spline.y[n - 1];

  // Binary search (O(log n) — cok noktali tablolarda hizli)
  var lo = 0, hi = n - 2;
  while(lo < hi) {
    var mid = (lo + hi) >> 1;
    if(xq > x[mid + 1]) lo = mid + 1;
    else hi = mid;
  }

  var t = xq - x[lo];
  return spline.c0[lo] + spline.c1[lo] * t + spline.c2[lo] * t * t + spline.c3[lo] * t * t * t;
}

// PCHIP 1. turevi (dT/dRPM — hassasiyet analizi icin)
function veEvalPchipDeriv(spline, xq) {
  if(!spline) return 0;
  var x = spline.x;
  var n = spline.n;
  if(n < 2) return 0;
  if(xq <= x[0] || xq >= x[n - 1]) return 0; // uclarda turev = 0

  var lo = 0, hi = n - 2;
  while(lo < hi) {
    var mid = (lo + hi) >> 1;
    if(xq > x[mid + 1]) lo = mid + 1;
    else hi = mid;
  }

  var t = xq - x[lo];
  return spline.c1[lo] + 2 * spline.c2[lo] * t + 3 * spline.c3[lo] * t * t;
}

// ────────── 2. DORMAND-PRINCE RK45 ADAPTIF SOLVER ──────────
// MATLAB ode45, SciPy solve_ivp'nin varsayilan yontemi.
// 4. ve 5. mertebe cozumleri ayni anda hesaplar; farki hata tahmini olarak kullanir.
// Hata buyukse dt kuculur, duzgun bolgelerde dt buyur.
//
// Iyilestirmeler:
//   FSAL (First Same As Last): k[6] → k[0] tasima ile adim basina 7→6 degerlendirme
//   Dense Output: Hermite kubik interpolasyon (lineer yerine 3. derece)
//   Stiffness Detection: Ardi ardina red / dtMin'e yapisma algilama
//   onAccept/onReject: Saf f(t,v) destegi icin callback'ler

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

// 5. mertebe katsayilari (ana cozum)
var DOPRI_B5 = [35/384, 0, 500/1113, 125/192, -2187/6784, 11/84, 0];

// 4. mertebe katsayilari (hata tahmini icin)
var DOPRI_B4 = [5179/57600, 0, 7571/16695, 393/640, -92097/339200, 187/2100, 1/40];

// Hata katsayilari: E = B5 - B4
var DOPRI_E = DOPRI_B5.map(function(b5, i) { return b5 - DOPRI_B4[i]; });

// ── Dense Output: Hermite Kubik Interpolasyon ──
// Adim ici 3. derece dogrulukla ara deger hesaplar.
// FSAL sayesinde k_start (= k[0]) ve k_end (= k[6]) zaten mevcut — ek maliyet yok.
// Lineer interpolasyona gore cok daha duzgun egri ve hassas event tespiti saglar.
//
// Hermite bazis fonksiyonlari:
//   h00(θ) = 2θ³ - 3θ² + 1    (sol deger)
//   h10(θ) = θ³ - 2θ² + θ      (sol turev)
//   h01(θ) = -2θ³ + 3θ²        (sag deger)
//   h11(θ) = θ³ - θ²            (sag turev)
//
// u(θ) = h00·v₀ + h10·h·f₀ + h01·v₁ + h11·h·f₁
// θ = (t - t_n) / h,  h = adim boyutu

function veDenseOutputHermite(v0, v1, h, f0, f1, theta) {
  var theta2 = theta * theta;
  var theta3 = theta2 * theta;
  var h00 = 2 * theta3 - 3 * theta2 + 1;
  var h10 = theta3 - 2 * theta2 + theta;
  var h01 = -2 * theta3 + 3 * theta2;
  var h11 = theta3 - theta2;
  return h00 * v0 + h10 * h * f0 + h01 * v1 + h11 * h * f1;
}

/**
 * RK45 Dormand-Prince adaptif integrator
 * @param {function} f - dv/dt = f(t, v) → ivme hesaplayan fonksiyon (SAF olmali)
 * @param {number} t0 - baslangic zamani
 * @param {number} v0 - baslangic degeri (hiz m/s)
 * @param {number} tEnd - bitis zamani
 * @param {object} opts - Secenekler:
 *   {number} atol       - Mutlak tolerans (varsayilan: 1e-6)
 *   {number} rtol       - Bagil tolerans (varsayilan: 1e-4)
 *   {number} dtMin      - Minimum adim boyutu (varsayilan: 1e-6)
 *   {number} dtMax      - Maksimum adim boyutu
 *   {number} dtInit     - Baslangic adim boyutu
 *   {number} maxSteps   - Maksimum adim sayisi (varsayilan: 50000)
 *   {number} outputDt   - Cikti aralig (varsayilan: tEnd/500)
 *   {function} eventFn  - Event detection: g(t,v), isaret degisiminde olay
 *   {function} onStep   - Her kabul edilen adimda callback
 *   {function} onAccept - Adim kabul sonrasi callback: onAccept(t, v, dt)
 *                         true donerse FSAL gecersizlestirilir (ornegin vites degisimi)
 *   {function} onReject - Adim reddedildiginde callback (durum geri alma icin)
 *   {boolean} stopAtZero - v≈0'da dur
 * @returns {object} - {t[], v[], dt_used[], errors[], rejected, events[],
 *                      totalSteps, finalDt, stiffnessDetected}
 */
function veRK45Solve(f, t0, v0, tEnd, opts) {
  opts = opts || {};
  var atol = opts.atol || 1e-6;
  var rtol = opts.rtol || 1e-4;
  var dtMin = opts.dtMin || 1e-6;
  var dtMax = opts.dtMax || (tEnd - t0) / 10;
  var dtInit = opts.dtInit || (tEnd - t0) / 200;
  var maxSteps = opts.maxSteps || 50000;
  var outputDt = opts.outputDt || (tEnd - t0) / 500;
  var eventFn = opts.eventFn || null;
  var onStep = opts.onStep || null;
  var onAccept = opts.onAccept || null;
  var onReject = opts.onReject || null;

  // Sonuc dizileri (sabit aralikli cikti)
  var out_t = [];
  var out_v = [];
  var out_dt = [];
  var out_err = [];

  // Ic degiskenler
  var t = t0;
  var v = v0;
  var dt = Math.min(dtInit, dtMax);
  var rejected = 0;
  var totalSteps = 0;
  var events = [];

  // Sabit aralikli cikti icin sonraki hedef zaman
  var nextOutput = t0;

  // Safety factor (standart: 0.84 = 0.9 * (4/5)^(1/4))
  var SAFETY = 0.84;
  var MIN_SCALE = 0.2;  // dt en fazla 5x kuculebilir
  var MAX_SCALE = 5.0;  // dt en fazla 5x buyuyebilir

  // ── FSAL (First Same As Last) ──
  // Dormand-Prince'in k[6] degeri, sonraki adimin k[0] degeri ile aynidir.
  // Bu ozellik sayesinde adim basina 7 yerine 6 fonksiyon degerlendirmesi yeterlidir.
  var k_fsal = null;     // Onceki kabul edilen adimin k[6] degeri
  var fsalValid = false;  // FSAL gecerli mi? (vites degisimi gibi durumlarda gecersiz olur)

  // ── Stiffness Detection ──
  // Ardi ardina cok fazla adim reddi veya surekli dtMin'e yapisma,
  // problemin sert (stiff) oldugunu gosterir.
  // Bu durumda acik yontemler (RK45) verimsiz calisir — kullaniciya uyari verilir.
  var consecutiveRejects = 0;
  var consecutiveMinDt = 0;
  var STIFFNESS_REJECT_THRESH = 10;  // Ardi ardina 10 red → sertlik suphesi
  var STIFFNESS_MINDT_THRESH = 20;   // Ardi ardina 20 adim dtMin'de → sertlik suphesi
  var stiffnessDetected = false;

  // Ilk cikti noktasi
  out_t.push(t);
  out_v.push(v);
  out_dt.push(dt);
  out_err.push(0);

  while(t < tEnd - dtMin && totalSteps < maxSteps) {
    // dt'yi tEnd'e tasirma
    if(t + dt > tEnd) dt = tEnd - t;
    if(dt < dtMin) dt = dtMin;

    // ====== Dormand-Prince 7 asama ======
    var k = new Array(7);

    // FSAL: onceki adimin k[6] degerini k[0] olarak kullan
    if(fsalValid && k_fsal !== null) {
      k[0] = k_fsal;
    } else {
      k[0] = f(t, v);
    }

    for(var s = 1; s < 7; s++) {
      var v_s = v;
      for(var j = 0; j < s; j++) {
        v_s += DOPRI_A[s][j] * k[j] * dt;
      }
      if(v_s < 0) v_s = 0;
      k[s] = f(t + DOPRI_C[s] * dt, v_s);
    }

    // 5. mertebe cozum (ana)
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

    // Tolerans karsilastirmasi
    var sc = atol + rtol * Math.max(Math.abs(v), Math.abs(v_new));
    var errRatio = err / sc;

    if(errRatio <= 1.0) {
      // ====== ADIM KABUL ======
      var t_old = t;
      var v_old = v;
      var k0_step = k[0];  // Dense output icin sakla
      var k6_step = k[6];  // Dense output + FSAL icin sakla

      t += dt;
      if(v_new < 0) v_new = 0;
      v = v_new;
      totalSteps++;

      // FSAL: k[6]'yi sonraki adim icin sakla
      k_fsal = k6_step;
      fsalValid = true;

      // ── Stiffness: red sayacini sifirla, dtMin kontrolu ──
      consecutiveRejects = 0;
      if(dt <= dtMin * 1.5) {
        consecutiveMinDt++;
        if(consecutiveMinDt >= STIFFNESS_MINDT_THRESH) stiffnessDetected = true;
      } else {
        consecutiveMinDt = 0;
      }

      // ── onAccept callback: durum guncellemesi (ornegin vites degisimi) ──
      // true donerse FSAL gecersizlesir (dinamikler degisti, k[0] yeniden hesaplanmali)
      if(onAccept) {
        var fsalInvalid = onAccept(t, v, dt);
        if(fsalInvalid) fsalValid = false;
      }

      // ── Event Detection: sureksizlik yakalama (Dense Output ile) ──
      if(eventFn) {
        var ev_old = eventFn(t_old, v_old);
        var ev_new = eventFn(t, v);

        // Isaret degisimi → bisection ile tam ani bul
        if(ev_old * ev_new < 0) {
          var tA = t_old, vA = v_old;
          var tB = t, vB = v;
          // Bisection (12 iterasyon ≈ dt/4096 hassasiyet)
          for(var bi = 0; bi < 12; bi++) {
            var tM = (tA + tB) / 2;
            var theta = (tM - t_old) / dt;
            // Dense Output: Hermite kubik ara deger (lineer yerine)
            var vM = veDenseOutputHermite(v_old, v, dt, k0_step, k6_step, theta);
            var ev_mid = eventFn(tM, vM);
            if(ev_old * ev_mid < 0) { tB = tM; vB = vM; }
            else { tA = tM; vA = vM; ev_old = ev_mid; }
          }
          events.push({ t: (tA + tB) / 2, v: (vA + vB) / 2, type: 'crossing' });
        }
      }

      // ── Sabit aralikli cikti uretimi (Dense Output ile) ──
      while(nextOutput <= t + 1e-12 && nextOutput <= tEnd + 1e-12) {
        if(nextOutput >= t_old - 1e-12) {
          var theta = (dt > 1e-15) ? (nextOutput - t_old) / dt : 0;
          // Dense Output: Hermite kubik ara deger
          var v_interp = veDenseOutputHermite(v_old, v, dt, k0_step, k6_step, theta);
          out_t.push(parseFloat(nextOutput.toFixed(6)));
          out_v.push(Math.max(0, v_interp));
          out_dt.push(dt);
          out_err.push(err);
        }
        nextOutput += outputDt;
      }

      // Callback
      if(onStep) onStep(t, v, dt, err, totalSteps);

      // ── Yeni dt hesabi ──
      var scale;
      if(errRatio < 1e-10) {
        scale = MAX_SCALE;
      } else {
        // Optimal olcek faktoru: (1/errRatio)^(1/5) * safety
        scale = SAFETY * Math.pow(1.0 / errRatio, 0.2);
        scale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, scale));
      }
      dt = Math.min(dt * scale, dtMax);

    } else {
      // ====== ADIM REDDEDILDI — dt kucult ======
      rejected++;
      consecutiveRejects++;
      if(consecutiveRejects >= STIFFNESS_REJECT_THRESH) stiffnessDetected = true;

      // onReject callback: durum geri alma
      if(onReject) onReject();

      // FSAL hala gecerli: ayni (t,v) noktasindan tekrar deniyoruz

      var scale = SAFETY * Math.pow(1.0 / errRatio, 0.2);
      scale = Math.max(MIN_SCALE, scale);
      dt = Math.max(dt * scale, dtMin);
    }

    // Durma kosulu
    if(v < 1e-4 && opts.stopAtZero) break;
  }

  // Son noktayi ekle (tEnd'e ulasildiysa)
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
    finalDt: dt,
    stiffnessDetected: stiffnessDetected
  };
}

// ────────── 3. ENERJI DENGESI HESAPLAYICI ──────────
// Her zaman adiminda enerji muhasebesi: deltaKE + W_dissipation + W_grade = W_engine
// Sapma = sayisal hata birikimi

function veEnergyBalance() {
  // Factory: parametre alip tracker dondurur
  return {
    KE_initial: 0,
    W_engine: 0,        // Motor freni isi (negatif = enerji cekme)
    W_rolling: 0,       // Yuvarlanma kayip
    W_aero: 0,          // Hava direnci kayip
    W_grade: 0,         // Egim potansiyel enerji degisimi
    W_brake: 0,         // Mekanik fren isi

    init: function(mass, v0) {
      this.KE_initial = 0.5 * mass * v0 * v0;
      this.mass = mass;
    },

    // Her zaman adiminda cagir
    addStep: function(v_old, v_new, dt, F_engine, F_rolling, F_aero, F_grade, F_brake) {
      var ds = 0.5 * (v_old + v_new) * dt; // Trapezoidal mesafe
      this.W_engine += F_engine * ds;
      this.W_rolling += F_rolling * ds;
      this.W_aero += F_aero * ds;
      this.W_grade += F_grade * ds;
      this.W_brake += F_brake * ds;
    },

    // Enerji hatasi hesapla
    getError: function(v_final) {
      var KE_final = 0.5 * this.mass * v_final * v_final;
      var deltaKE = KE_final - this.KE_initial;

      // Enerji korunumu: deltaKE = W_grade - W_rolling - W_aero - W_brake + W_engine
      var W_net = this.W_grade - this.W_rolling - this.W_aero - this.W_brake + this.W_engine;
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
          W_grade: this.W_grade,
          W_brake: this.W_brake
        }
      };
    }
  };
}
