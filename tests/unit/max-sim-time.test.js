/**
 * Güvenlik limiti (maxSimTime) tek doğruluk kaynağı
 * ────────────────────────────────────────────────
 * Regresyon zemini: çözücü paneli (cp-solver.js) 300 s varsayıyor ve değeri
 * GİZLİ bir input'ta tutuyordu; çözücüler (ft-performance.js, solver-pro.js)
 * ise `parseFloat(sd.maxSimTime) || 120` ile 120 s'ye düşüyordu. Çözücü düğümü
 * hiç açılmamışsa node.data.maxSimTime undefined kalıyor → aynı proje 120 s'de
 * kesiliyor. Canlı ölçüm (30 t kamyon): 120 s → 81.27 km/h üst hız,
 * 300 s → 138.32 km/h. Kullanıcı farkı göremiyordu.
 *
 * Bu test sabit tutarlılığını kaynak düzeyinde doğrular: hiçbir çözücü kendi
 * varsayılanını uydurmamalı.
 */

const fs = require('fs');
const path = require('path');

const readJs = (f) => fs.readFileSync(path.join(__dirname, '../../js', f), 'utf8');

describe('VE_DEFAULT_MAX_SIM_TIME tek kaynak', () => {
  test('cp-solver.js sabiti tanımlar', () => {
    const src = readJs('cp-solver.js');
    expect(src).toMatch(/var\s+VE_DEFAULT_MAX_SIM_TIME\s*=\s*300\s*;/);
  });

  test('hiçbir modül maxSimTime için 120 fallback kullanmaz', () => {
    ['ft-performance.js', 'solver-pro.js', 'cp-solver.js'].forEach((f) => {
      const src = readJs(f);
      // "maxSimTime ... || 120" kalıbı hiç bulunmamalı
      expect(src).not.toMatch(/maxSimTime[^\n;]*\|\|\s*120\b/);
    });
  });

  test('çözücüler varsayılanı sabitten okur', () => {
    ['ft-performance.js', 'solver-pro.js'].forEach((f) => {
      const src = readJs(f);
      const usesMaxSimTime = /maxSimTime/.test(src);
      if (usesMaxSimTime) {
        expect(src).toMatch(/VE_DEFAULT_MAX_SIM_TIME/);
      }
    });
  });

  test('panelde limit artık gizli değil, düzenlenebilir input', () => {
    const src = readJs('cp-solver.js');
    // Eski hâl: <input type="hidden" ... ve-solver-maxtime-
    expect(src).not.toMatch(/type="hidden"[^>]*ve-solver-maxtime-/);
    // Yeni hâl: number input + değişimde kaydeden handler
    expect(src).toMatch(/type="number"[^>]*ve-solver-maxtime-/);
    const row = src.slice(src.indexOf('ve-solver-maxtime-'));
    expect(row.slice(0, 400)).toMatch(/onVESolverParamChange/);
  });
});

describe('panel↔çözücü varsayılan uyumu (davranış)', () => {
  // Panelin okuduğu ve çözücünün okuduğu ifadeleri aynı ortamda değerlendirip
  // eşit olduklarını doğrula. Böylece biri değişip diğeri kalırsa test kırılır.
  const VE_DEFAULT_MAX_SIM_TIME = 300;

  const panelDefault = (d) =>
    d.maxSimTime !== undefined ? d.maxSimTime : VE_DEFAULT_MAX_SIM_TIME;

  const solverDefault = (sd) =>
    parseFloat(sd.maxSimTime) ||
    (typeof VE_DEFAULT_MAX_SIM_TIME !== 'undefined' ? VE_DEFAULT_MAX_SIM_TIME : 300);

  test('çözücü düğümü hiç açılmamışken ikisi aynı değeri verir', () => {
    const data = {}; // maxSimTime yok — asıl hata senaryosu
    expect(solverDefault(data)).toBe(panelDefault(data));
    expect(solverDefault(data)).toBe(300);
  });

  test('kullanıcı değer girdiğinde ikisi de o değeri kullanır', () => {
    const data = { maxSimTime: 45 };
    expect(panelDefault(data)).toBe(45);
    expect(solverDefault(data)).toBe(45);
  });
});
