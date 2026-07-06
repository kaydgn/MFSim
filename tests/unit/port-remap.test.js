/**
 * port-remap.test.js — Dinamik port ekle/kaldır id yeniden numaralama (SAF çekirdek)
 *
 * Port sayısı değişince eski→yeni port id eşlemesi + kaldırılan id doğru olmalı;
 * özellikle "bare ↔ indexed" geçişi (tek portta 'input', çoklu portta 'input-0').
 * Bu remap bağlantı ve portPositions id'lerini güncellemek için kullanılır.
 */
const cm = require('../../js/context-menus.js');

describe('Port remap (_computePortRemap)', () => {
  test('ekleme: tek (bare) → indexli — input → input-0', () => {
    const r = cm._computePortRemap('input', 1, 2, -1);
    expect(r.removedId).toBeNull();
    expect(r.map).toEqual({ input: 'input-0' });
  });

  test('ekleme: zaten indexli — 2→3 remap yok (yeni index-2 eklenir)', () => {
    const r = cm._computePortRemap('input', 2, 3, -1);
    expect(r.removedId).toBeNull();
    expect(r.map).toEqual({});
  });

  test('kaldırma: ortadaki (3→2, index 1) — input-2 → input-1', () => {
    const r = cm._computePortRemap('input', 3, 2, 1);
    expect(r.removedId).toBe('input-1');
    expect(r.map).toEqual({ 'input-2': 'input-1' });
  });

  test('kaldırma: sonuncu (3→2, index 2) — remap yok', () => {
    const r = cm._computePortRemap('input', 3, 2, 2);
    expect(r.removedId).toBe('input-2');
    expect(r.map).toEqual({});
  });

  test('kaldırma: indexli → bare — 2→1 (index 0) input-1 → input', () => {
    const r = cm._computePortRemap('input', 2, 1, 0);
    expect(r.removedId).toBe('input-0');
    expect(r.map).toEqual({ 'input-1': 'input' });
  });

  test('output tipinde de aynı — 2→1 (index 1) output-0 → output', () => {
    const r = cm._computePortRemap('output', 2, 1, 1);
    expect(r.removedId).toBe('output-1');
    expect(r.map).toEqual({ 'output-0': 'output' });
  });

  test('id üretici: tek port bare, çoklu port indexli', () => {
    expect(cm._portIdOf('input', 0, 1)).toBe('input');
    expect(cm._portIdOf('input', 0, 3)).toBe('input-0');
    expect(cm._portIdOf('output', 2, 3)).toBe('output-2');
  });
});
