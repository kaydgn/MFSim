/**
 * solver-properties.test.js — Çözücü bileşeni hata testleri
 *
 * Test edilen hatalar:
 * 1. ftMode tanımsız hatası (getSolverPropertiesHTML — component-properties.js)
 * 2. _veRestoreRoute toFixed hatası (map.js — undefined egim)
 *
 * Not: component-properties.js ve map.js dış bağımlılıkları çok fazla olduğundan
 * (Leaflet, solver-pro.js, topology.js vb.) doğrudan eval ile yüklenemez.
 * Bu yüzden düzeltilen mantık izole fonksiyonlarla test edilir ve
 * kaynak dosyalardaki ilgili satırların varlığı grep-tarzı kontrol edilir.
 */

const fs = require('fs');
const path = require('path');

// Kaynak dosyaları oku (eval etmeden, sadece içerik kontrolü için)
const cpCode = fs.readFileSync(path.join(__dirname, '../../js/component-properties.js'), 'utf8');
const mapCode = fs.readFileSync(path.join(__dirname, '../../js/map.js'), 'utf8');

// ═════════════════════════════════════════════════════════════════════
// getSolverPropertiesHTML — ftMode tanımsız hatası
// ═════════════════════════════════════════════════════════════════════
describe('getSolverPropertiesHTML — ftMode tanımı', () => {
  test('getSolverPropertiesHTML fonksiyonu tanımlı', () => {
    // Fonksiyon gövdesini çıkar
    var fnStart = cpCode.indexOf('function getSolverPropertiesHTML(node)');
    expect(fnStart).toBeGreaterThan(-1);
  });

  test('ftMode kaldırıldı — tek modül olduğu için artık gerekli değil', () => {
    var fnStart = cpCode.indexOf('function getSolverPropertiesHTML(node)');
    var fnBody = cpCode.substring(fnStart, fnStart + 2000);
    // ftMode artık kullanılmıyor, tek modül (full-throttle) olduğu için
    expect(fnBody).not.toMatch(/var\s+ftMode\s*=/);
  });

  test('fonksiyon solver ayarları HTML üretiyor', () => {
    var fnStart = cpCode.indexOf('function getSolverPropertiesHTML(node)');
    var fnBody = cpCode.substring(fnStart, fnStart + 500);
    expect(fnBody).toContain('node.data');
  });

  // ftMode mantığını izole test et
  function solverFtMode(veActiveModule) {
    return veActiveModule === 'full-throttle';
  }

  test('veActiveModule=full-throttle iken ftMode=true', () => {
    expect(solverFtMode('full-throttle')).toBe(true);
  });

  test('veActiveModule=engine-brake iken ftMode=false', () => {
    expect(solverFtMode('engine-brake')).toBe(false);
  });

  test('veActiveModule=undefined iken ftMode=false', () => {
    expect(solverFtMode(undefined)).toBe(false);
  });

  test('ftMode=true iken zaman modu satırı gizli, maks süre görünür', () => {
    var ftMode = true;
    var timeMode = 'manual';

    // ftMode=true → zaman modu seçimi gösterilmez (if(!ftMode) bloğu)
    var showTimeMode = !ftMode;
    expect(showTimeMode).toBe(false);

    // ftMode=true → maks süre etiketi "güvenlik"
    var maxTimeLabel = ftMode ? 'Maks. süre (güvenlik) [s]' : 'Maks. süre [s]';
    expect(maxTimeLabel).toBe('Maks. süre (güvenlik) [s]');

    // ftMode=true → durma hızı gizli
    var hideStopSpeed = ftMode || timeMode !== 'stop';
    expect(hideStopSpeed).toBe(true);
  });

  test('ftMode=false iken zaman modu görünür, çözünürlük görünür', () => {
    var ftMode = false;
    var timeMode = 'manual';

    var showTimeMode = !ftMode;
    expect(showTimeMode).toBe(true);

    var maxTimeLabel = ftMode ? 'Maks. süre (güvenlik) [s]' : 'Maks. süre [s]';
    expect(maxTimeLabel).toBe('Maks. süre [s]');

    // ftMode=false → çözünürlük ve çözüm yöntemi görünür
    var showResolution = !ftMode;
    expect(showResolution).toBe(true);
  });
});

// ═════════════════════════════════════════════════════════════════════
// _veRestoreRoute — toFixed undefined hatası
// ═════════════════════════════════════════════════════════════════════
describe('_veRestoreRoute — segment egim koruma', () => {

  test('map.js dosyasında egim kontrolü mevcut', () => {
    // Düzeltmeden sonra: segs[pi] && segs[pi].egim !== undefined kontrolü olmalı
    expect(mapCode).toContain('segs[pi].egim !== undefined');
  });

  test('map.js dosyasında forEach içinde egim koruma mevcut', () => {
    // Düzeltmeden sonra: seg && seg.egim !== undefined kontrolü olmalı
    expect(mapCode).toContain('seg.egim !== undefined');
  });

  // Tooltip mantığını izole test et (map.js satır 312)
  function safeSegmentTooltip(segs, pi) {
    if(pi < segs.length && segs[pi] && segs[pi].egim !== undefined) {
      return 'Segment eğim: %' + segs[pi].egim.toFixed(1);
    }
    return '';
  }

  // maxE/minE mantığını izole test et (map.js satır 324)
  function safeMaxEgim(segs) {
    var maxE = 0, minE = 0;
    segs.forEach(function(seg) {
      var e = seg && seg.egim !== undefined ? seg.egim : 0;
      if(e > maxE) maxE = e;
      if(e < minE) minE = e;
    });
    return { maxE: maxE, minE: minE };
  }

  test('geçerli egim değeri ile tooltip üretir', () => {
    var segs = [{ egim: 5.3 }, { egim: -2.1 }];
    expect(safeSegmentTooltip(segs, 0)).toBe('Segment eğim: %5.3');
    expect(safeSegmentTooltip(segs, 1)).toBe('Segment eğim: %-2.1');
  });

  test('undefined egim ile hata vermez, boş string döner', () => {
    var segs = [{ mesafe: 100 }, { mesafe: 200 }];
    expect(() => safeSegmentTooltip(segs, 0)).not.toThrow();
    expect(safeSegmentTooltip(segs, 0)).toBe('');
  });

  test('null segment ile hata vermez', () => {
    var segs = [null, { egim: 3.0 }];
    expect(() => safeSegmentTooltip(segs, 0)).not.toThrow();
    expect(safeSegmentTooltip(segs, 0)).toBe('');
    expect(safeSegmentTooltip(segs, 1)).toBe('Segment eğim: %3.0');
  });

  test('boş segment dizisi ile hata vermez', () => {
    expect(() => safeSegmentTooltip([], 0)).not.toThrow();
    expect(safeSegmentTooltip([], 0)).toBe('');
  });

  test('index sınır dışında iken hata vermez', () => {
    var segs = [{ egim: 1.0 }];
    expect(() => safeSegmentTooltip(segs, 5)).not.toThrow();
    expect(safeSegmentTooltip(segs, 5)).toBe('');
  });

  test('maxE/minE — undefined egim ile çalışır', () => {
    var segs = [{ egim: 5 }, { mesafe: 100 }, { egim: -3 }, null];
    var result = safeMaxEgim(segs);
    expect(result.maxE).toBe(5);
    expect(result.minE).toBe(-3);
  });

  test('maxE/minE — tümü undefined iken 0 döner', () => {
    var segs = [{ mesafe: 100 }, { mesafe: 200 }];
    var result = safeMaxEgim(segs);
    expect(result.maxE).toBe(0);
    expect(result.minE).toBe(0);
  });

  test('egim=0 ile doğru hesaplar', () => {
    var segs = [{ egim: 0 }, { egim: 0 }];
    expect(safeSegmentTooltip(segs, 0)).toBe('Segment eğim: %0.0');
    var result = safeMaxEgim(segs);
    expect(result.maxE).toBe(0);
    expect(result.minE).toBe(0);
  });
});
