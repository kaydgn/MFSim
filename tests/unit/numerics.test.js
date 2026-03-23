/**
 * numerics.js birim testleri
 * PCHIP spline, RK45 solver (FSAL, Dense Output, Stiffness Detection) ve enerji dengesi testleri
 */

const fs = require('fs');
const path = require('path');

// numerics.js'yi Node ortamına yükle
const code = fs.readFileSync(path.join(__dirname, '../../js/numerics.js'), 'utf8');
eval(code);

// ── PCHIP Spline ──

describe('veBuildPchipSpline', () => {
  const samplePoints = [
    { rpm: 1000, torque: 100 },
    { rpm: 2000, torque: 180 },
    { rpm: 3000, torque: 220 },
    { rpm: 4000, torque: 200 },
    { rpm: 5000, torque: 150 }
  ];

  test('en az 3 nokta gerektirir', () => {
    expect(veBuildPchipSpline([{ rpm: 0, torque: 0 }])).toBeNull();
    expect(veBuildPchipSpline([{ rpm: 0, torque: 0 }, { rpm: 1, torque: 1 }])).toBeNull();
  });

  test('3+ nokta ile geçerli spline döndürür', () => {
    const spline = veBuildPchipSpline(samplePoints);
    expect(spline).not.toBeNull();
    expect(spline.n).toBe(5);
    expect(spline.x).toEqual([1000, 2000, 3000, 4000, 5000]);
    expect(spline.c0).toHaveLength(4);
    expect(spline.c1).toHaveLength(4);
    expect(spline.c2).toHaveLength(4);
    expect(spline.c3).toHaveLength(4);
  });

  test('düğüm noktalarında tam değer verir', () => {
    const spline = veBuildPchipSpline(samplePoints);
    samplePoints.forEach(p => {
      expect(veEvalPchip(spline, p.rpm)).toBeCloseTo(p.torque, 8);
    });
  });
});

describe('veEvalPchip', () => {
  const points = [
    { rpm: 1000, torque: 100 },
    { rpm: 2000, torque: 200 },
    { rpm: 3000, torque: 250 },
    { rpm: 4000, torque: 230 }
  ];
  const spline = veBuildPchipSpline(points);

  test('null spline için 0 döndürür', () => {
    expect(veEvalPchip(null, 1500)).toBe(0);
  });

  test('sınır altında ilk değeri döndürür (flat extrapolation)', () => {
    expect(veEvalPchip(spline, 500)).toBe(100);
    expect(veEvalPchip(spline, 0)).toBe(100);
  });

  test('sınır üstünde son değeri döndürür (flat extrapolation)', () => {
    expect(veEvalPchip(spline, 5000)).toBe(230);
    expect(veEvalPchip(spline, 10000)).toBe(230);
  });

  test('ara değerler fiziksel olarak anlamlı aralıkta', () => {
    const v = veEvalPchip(spline, 1500);
    expect(v).toBeGreaterThan(100);
    expect(v).toBeLessThan(250);
  });

  test('interpolasyon düzgün (monoton artışta arada doğru sıralama)', () => {
    const v1 = veEvalPchip(spline, 1200);
    const v2 = veEvalPchip(spline, 1500);
    const v3 = veEvalPchip(spline, 1800);
    expect(v1).toBeLessThan(v2);
    expect(v2).toBeLessThan(v3);
  });
});

describe('veEvalPchipDeriv', () => {
  const points = [
    { rpm: 1000, torque: 100 },
    { rpm: 2000, torque: 200 },
    { rpm: 3000, torque: 250 },
    { rpm: 4000, torque: 230 }
  ];
  const spline = veBuildPchipSpline(points);

  test('null spline için 0 döndürür', () => {
    expect(veEvalPchipDeriv(null, 1500)).toBe(0);
  });

  test('sınır dışında türev 0', () => {
    expect(veEvalPchipDeriv(spline, 500)).toBe(0);
    expect(veEvalPchipDeriv(spline, 5000)).toBe(0);
  });

  test('artan bölgede türev pozitif', () => {
    expect(veEvalPchipDeriv(spline, 1500)).toBeGreaterThan(0);
  });

  test('sayısal türev ile tutarlı', () => {
    const x = 2500;
    const h = 0.01;
    const numerical = (veEvalPchip(spline, x + h) - veEvalPchip(spline, x - h)) / (2 * h);
    const analytical = veEvalPchipDeriv(spline, x);
    expect(analytical).toBeCloseTo(numerical, 2);
  });
});

// ── RK45 Solver ──

describe('veRK45Solve', () => {
  test('sabit ivme ile analitik çözüme yakınsar', () => {
    // dv/dt = a (sabit ivme), analitik çözüm: v(t) = v0 + a*t
    const a = 2.0;
    const f = (t, v) => a;
    const result = veRK45Solve(f, 0, 0, 10, { atol: 1e-8, rtol: 1e-6 });

    const lastV = result.v[result.v.length - 1];
    expect(lastV).toBeCloseTo(20.0, 2); // v = 0 + 2*10
  });

  test('üstel büyüme dv/dt = v çözer', () => {
    // dv/dt = v, analitik: v(t) = e^t
    const f = (t, v) => v;
    const result = veRK45Solve(f, 0, 1, 2, { atol: 1e-8, rtol: 1e-6 });

    const lastV = result.v[result.v.length - 1];
    expect(lastV).toBeCloseTo(Math.exp(2), 2); // e^2 ≈ 7.389
  });

  test('sonuç dizileri tutarlı uzunlukta', () => {
    const f = (t, v) => -v;
    const result = veRK45Solve(f, 0, 10, 5);

    expect(result.t.length).toBe(result.v.length);
    expect(result.t.length).toBe(result.dt_used.length);
    expect(result.t.length).toBe(result.errors.length);
  });

  test('zaman dizisi monotonik artan', () => {
    const f = (t, v) => -0.5 * v;
    const result = veRK45Solve(f, 0, 10, 5);

    for (let i = 1; i < result.t.length; i++) {
      expect(result.t[i]).toBeGreaterThanOrEqual(result.t[i - 1]);
    }
  });

  test('event detection sıfır geçişini yakalar', () => {
    // v azalıyor, v=3'ü geçtiğinde event tetiklenmeli
    const f = (t, v) => -1; // dv/dt = -1, v(t) = 10 - t
    const eventFn = (t, v) => v - 3; // v=3 olunca sıfır
    const result = veRK45Solve(f, 0, 10, 12, { eventFn: eventFn });

    expect(result.events.length).toBeGreaterThanOrEqual(1);
    expect(result.events[0].t).toBeCloseTo(7.0, 1); // 10 - t = 3 → t = 7
  });

  test('stopAtZero ile durur', () => {
    const f = (t, v) => -2; // dv/dt = -2, v(t) = 10 - 2t, v=0 at t=5
    const result = veRK45Solve(f, 0, 10, 20, { stopAtZero: true });

    const lastV = result.v[result.v.length - 1];
    expect(lastV).toBeCloseTo(0, 1);
  });

  test('stiffnessDetected alanı döndürür', () => {
    const f = (t, v) => -v;
    const result = veRK45Solve(f, 0, 10, 5);
    expect(result).toHaveProperty('stiffnessDetected');
    expect(typeof result.stiffnessDetected).toBe('boolean');
  });

  test('normal problemlerde stiffness algılanmaz', () => {
    const f = (t, v) => -0.5 * v;
    const result = veRK45Solve(f, 0, 10, 5, { atol: 1e-6, rtol: 1e-4 });
    expect(result.stiffnessDetected).toBe(false);
  });
});

// ── FSAL (First Same As Last) ──

describe('FSAL optimizasyonu', () => {
  test('FSAL ile f(t,v) çağrı sayısı azalır', () => {
    let callCount = 0;
    const f = (t, v) => { callCount++; return -0.1 * v; };
    const result = veRK45Solve(f, 0, 10, 5, { atol: 1e-6, rtol: 1e-4 });

    // FSAL olmadan: 7 çağrı/adım. FSAL ile: 6 çağrı/adım (ilk adım hariç).
    // İlk adım 7 + sonraki adımlar 6 → toplam < 7 * totalSteps
    const maxCallsWithoutFSAL = 7 * result.totalSteps;
    const expectedWithFSAL = 7 + 6 * (result.totalSteps - 1); // = 6*totalSteps + 1
    expect(callCount).toBeLessThanOrEqual(expectedWithFSAL);
    expect(callCount).toBeLessThan(maxCallsWithoutFSAL);
  });

  test('FSAL sonucu etkilemez (doğruluk korunur)', () => {
    // Üstel azalma: dv/dt = -v, analitik: v(t) = 10*e^(-t)
    const f = (t, v) => -v;
    const result = veRK45Solve(f, 0, 10, 3, { atol: 1e-8, rtol: 1e-6 });
    const lastV = result.v[result.v.length - 1];
    expect(lastV).toBeCloseTo(10 * Math.exp(-3), 3);
  });

  test('onAccept true dönünce FSAL geçersizleşir (ek f çağrısı)', () => {
    let callCount = 0;
    let acceptCalls = 0;
    const f = (t, v) => { callCount++; return -0.1 * v; };

    // Her adımda FSAL'ı geçersizleştir → her adım 7 çağrı olmalı
    const onAccept = (t, v, dt) => { acceptCalls++; return true; };

    const result = veRK45Solve(f, 0, 10, 2, {
      atol: 1e-6, rtol: 1e-4, onAccept: onAccept
    });

    // onAccept her kabul edilen adımda çağrılmalı
    expect(acceptCalls).toBe(result.totalSteps);
    // FSAL geçersiz → her adım 7 çağrı
    expect(callCount).toBe(7 * result.totalSteps);
  });
});

// ── Dense Output (Hermite Kübik İnterpolasyon) ──

describe('veDenseOutputHermite', () => {
  test('uç noktalarda tam değer verir', () => {
    // theta=0 → v0, theta=1 → v1
    expect(veDenseOutputHermite(10, 20, 1.0, 5, 5, 0)).toBeCloseTo(10, 10);
    expect(veDenseOutputHermite(10, 20, 1.0, 5, 5, 1)).toBeCloseTo(20, 10);
  });

  test('sabit hızda (f=0) lineer interpolasyona eşit', () => {
    // v0=10, v1=10, f0=0, f1=0 → tüm theta'larda 10
    for (let theta = 0; theta <= 1; theta += 0.1) {
      expect(veDenseOutputHermite(10, 10, 1.0, 0, 0, theta)).toBeCloseTo(10, 10);
    }
  });

  test('sabit ivmede analitik çözümle eşleşir', () => {
    // dv/dt = 2 (sabit), h=1, v0=0, v1=2, f0=2, f1=2
    // Analitik: v(theta) = 2*theta*h = 2*theta
    const h = 1.0;
    for (let theta = 0; theta <= 1; theta += 0.25) {
      const hermite = veDenseOutputHermite(0, 2, h, 2, 2, theta);
      expect(hermite).toBeCloseTo(2 * theta, 8);
    }
  });

  test('lineerden daha doğru sonuç verir (parabolik hareket)', () => {
    // dv/dt = -2t, v(0)=10, v(1)=9, f(0)=0, f(1)=-2
    // Analitik: v(t) = 10 - t^2
    // t=0.5'te: v(0.5) = 10 - 0.25 = 9.75
    const v0 = 10, v1 = 9, h = 1.0, f0 = 0, f1 = -2;
    const theta = 0.5;
    const hermiteVal = veDenseOutputHermite(v0, v1, h, f0, f1, theta);
    const linearVal = v0 + theta * (v1 - v0); // 9.5
    const exact = 9.75;

    // Hermite, analitik çözüme lineerden daha yakın olmalı
    expect(Math.abs(hermiteVal - exact)).toBeLessThan(Math.abs(linearVal - exact));
  });

  test('RK45 çıktısında dense output kullanılır', () => {
    // Parabolik problem: dv/dt = -2t, v(0)=10
    // Analitik: v(t) = 10 - t^2
    const f = (t, v) => -2 * t;
    const result = veRK45Solve(f, 0, 10, 2, {
      atol: 1e-8, rtol: 1e-6, outputDt: 0.5
    });

    // t=0.5'teki çıktı noktası dense output ile hesaplanmış olmalı
    const idx05 = result.t.findIndex(t => Math.abs(t - 0.5) < 0.01);
    if (idx05 >= 0) {
      const exact = 10 - 0.25; // v(0.5) = 9.75
      expect(result.v[idx05]).toBeCloseTo(exact, 2);
    }

    // t=1.0'deki çıktı noktası
    const idx10 = result.t.findIndex(t => Math.abs(t - 1.0) < 0.01);
    if (idx10 >= 0) {
      const exact = 10 - 1.0; // v(1.0) = 9.0
      expect(result.v[idx10]).toBeCloseTo(exact, 2);
    }
  });
});

// ── Stiffness Detection ──

describe('Stiffness Detection', () => {
  test('çok sert problemde stiffness algılanır', () => {
    // dv/dt = -1000*(v - sin(t)) + cos(t), lambda=-1000
    // Kararlılık sınırı: dt ≈ 0.003
    // dtMin=0.003 olarak ayarlandığında solver dtMin civarında takılır
    // → 20+ ardışık adım dtMin'de → stiffness algılanır
    const f = (t, v) => -1000 * (v - Math.sin(t)) + Math.cos(t);
    const result = veRK45Solve(f, 0, 0, 0.5, {
      atol: 1e-6, rtol: 1e-4,
      dtMin: 0.003,
      dtMax: 0.01,
      dtInit: 0.005,
      maxSteps: 500
    });

    expect(result.stiffnessDetected).toBe(true);
  });

  test('onReject callback reddedilen adımlarda çağrılır', () => {
    let rejectCount = 0;
    // Sert problem
    const f = (t, v) => -500 * v;
    const result = veRK45Solve(f, 0, 100, 0.1, {
      dtInit: 0.05, // kasıtlı olarak büyük başlangıç adımı
      dtMin: 1e-8,
      onReject: () => { rejectCount++; }
    });

    // Reddedilen adımlarda onReject çağrılmış olmalı
    expect(rejectCount).toBe(result.rejected);
  });
});

// ── onAccept Callback ──

describe('onAccept callback', () => {
  test('her kabul edilen adımda çağrılır', () => {
    let acceptCalls = 0;
    const f = (t, v) => -0.5 * v;
    const result = veRK45Solve(f, 0, 10, 5, {
      onAccept: (t, v, dt) => { acceptCalls++; return false; }
    });
    expect(acceptCalls).toBe(result.totalSteps);
  });

  test('t, v, dt parametreleri doğru aktarılır', () => {
    const acceptLog = [];
    const f = (t, v) => -1; // dv/dt = -1
    const result = veRK45Solve(f, 0, 10, 3, {
      onAccept: (t, v, dt) => {
        acceptLog.push({ t, v, dt });
        return false;
      }
    });

    // Tüm kayıtlarda t > 0, v >= 0, dt > 0 olmalı
    acceptLog.forEach(entry => {
      expect(entry.t).toBeGreaterThan(0);
      expect(entry.v).toBeGreaterThanOrEqual(0);
      expect(entry.dt).toBeGreaterThan(0);
    });
  });
});

// ── Enerji Dengesi ──

describe('veEnergyBalance', () => {
  test('başlangıç kinetik enerjiyi doğru hesaplar', () => {
    const eb = veEnergyBalance();
    eb.init(1000, 20); // 1000 kg, 20 m/s
    expect(eb.KE_initial).toBe(200000); // 0.5 * 1000 * 400
  });

  test('sıfır kuvvette enerji korunumu sağlar', () => {
    const eb = veEnergyBalance();
    const mass = 1500;
    const v0 = 30;
    eb.init(mass, v0);

    // Sıfır kuvvet → hız sabit kalmalı
    for (let i = 0; i < 100; i++) {
      eb.addStep(v0, v0, 0.1, 0, 0, 0, 0);
    }

    const result = eb.getError(v0);
    expect(result.error_J).toBeCloseTo(0, 6);
    expect(result.error_pct).toBeCloseTo(0, 6);
  });

  test('breakdown tüm alanları içerir', () => {
    const eb = veEnergyBalance();
    eb.init(1000, 10);
    const result = eb.getError(10);

    expect(result).toHaveProperty('deltaKE');
    expect(result).toHaveProperty('W_net');
    expect(result).toHaveProperty('error_J');
    expect(result).toHaveProperty('error_rel');
    expect(result).toHaveProperty('error_pct');
    expect(result.breakdown).toHaveProperty('KE_initial');
    expect(result.breakdown).toHaveProperty('KE_final');
    expect(result.breakdown).toHaveProperty('W_engine');
    expect(result.breakdown).toHaveProperty('W_rolling');
    expect(result.breakdown).toHaveProperty('W_aero');
    expect(result.breakdown).toHaveProperty('W_grade');
  });
});
