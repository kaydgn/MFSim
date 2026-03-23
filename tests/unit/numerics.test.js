/**
 * numerics.js birim testleri
 * PCHIP spline, RK45 solver ve enerji dengesi testleri
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
