/**
 * grade-display.test.js
 * ─────────────────────
 * veGradeDisplay (ft-performance.js) — eğim kabiliyeti sunum biçimleyicisi.
 *
 * Fiziksel sınır senteli (999/997: çekiş ağırlığı aşıyor) TXT raporlarına ve
 * panellere "%999.0" olarak sızıyordu. Biçimleyici senteli "≥100" ailesine
 * çevirir; normal değerleri ondalıkla basar. Sentel eşiği (±900) mantıktır,
 * etiket değildir — test buraya açılır.
 */
const stubs = stubGlobals();
global.veActiveModule = 'full-throttle';
global.COMPONENT_SIGNALS = {};
global.window = { addEventListener: function () {} };

eval(loadSource('numerics.js'));
eval(loadSource('cp-engine.js'));
eval(loadSource('cp-gearbox.js'));
eval(loadSource('ft-performance.js'));

describe('veGradeDisplay — sentinel ve normal değerler', () => {
  test('fiziksel sınır senteli ham sayı olarak görünmez', () => {
    expect(veGradeDisplay(999.0, 1)).toBe('≥100');
    expect(veGradeDisplay(997.0, 1)).toBe('≥100');       // launch senteli
    expect(veGradeDisplay(999.9, 1, true)).toBe('≥%100'); // panel biçimi
    expect(veGradeDisplay(-999.9, 1)).toBe('≤−100');
  });

  test('normal değerler ondalıkla, panel biçimi % önekiyle', () => {
    expect(veGradeDisplay(42.34, 1)).toBe('42.3');
    expect(veGradeDisplay(42.34, 1, true)).toBe('%42.3');
    expect(veGradeDisplay(0, 1)).toBe('0.0');
  });

  test('eşik: 900 altı gerçek değer sayılır', () => {
    expect(veGradeDisplay(899.9, 1)).toBe('899.9');
    expect(veGradeDisplay(900, 1)).toBe('≥100');
  });

  test('tanımsız/NaN güvenli', () => {
    expect(veGradeDisplay(null, 1)).toBe('—');
    expect(veGradeDisplay(undefined, 1, true)).toBe('%—');
    expect(veGradeDisplay(NaN, 1)).toBe('—');
  });
});
