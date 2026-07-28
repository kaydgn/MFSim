/**
 * veThemeRgba — canvas için tema rengi çözümleme
 * ──────────────────────────────────────────────
 * Canvas API'si CSS değişkeni çözemediğinden grafikler tema rengini bu
 * yardımcıyla çizim anında okur (js/theme.js). Sessiz bir bozulma "grafik
 * vurguları görünmez/yanlış renkte" olarak ortaya çıkar ve gözle her temada
 * fark edilmez — hex ayrıştırma + fallback davranışı burada korunur.
 */
const { veThemeRgba } = require('../../js/theme.js');

function mockVar(value) {
  jest.spyOn(window, 'getComputedStyle').mockReturnValue({
    getPropertyValue: () => value,
  });
}

afterEach(() => jest.restoreAllMocks());

describe('veThemeRgba', () => {
  test('6 haneli hex değişkeni alfa ile rgba dizgesine çevirir', () => {
    mockVar('#2563eb');
    expect(veThemeRgba('--accent-primary', 0.8)).toBe('rgba(37,99,235,0.8)');
  });

  test('boşluklu değer kırpılır, büyük harf hex kabul edilir', () => {
    mockVar('  #FFB71B ');
    expect(veThemeRgba('--accent-primary', 0.12)).toBe('rgba(255,183,27,0.12)');
  });

  test('çözülemeyen değerde fallback döner (grafik renksiz kalmasın)', () => {
    mockVar('');
    expect(veThemeRgba('--accent-primary', 0.5, 'rgba(59,130,246,0.5)'))
      .toBe('rgba(59,130,246,0.5)');
  });

  test('hex olmayan değer (örn. rgb() ya da 3 haneli) fallback\'e düşer', () => {
    mockVar('#abc');
    expect(veThemeRgba('--x', 1, 'FALLBACK')).toBe('FALLBACK');
    mockVar('rgb(1,2,3)');
    expect(veThemeRgba('--x', 1, 'FALLBACK')).toBe('FALLBACK');
  });

  test('fallback verilmemişse ham değişken değeri ya da güvenli gri döner', () => {
    mockVar('rebeccapurple');
    expect(veThemeRgba('--x', 1)).toBe('rebeccapurple');
    mockVar('');
    expect(veThemeRgba('--x', 1)).toBe('#888888');
  });
});
