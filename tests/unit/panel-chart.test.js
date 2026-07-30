/**
 * js/panel-chart.js — panel grafiklerinin paylaşılan etkileşim katmanı
 * ────────────────────────────────────────────────────────────────────
 * Beş panel grafiği (Motor×Konvertör, motor tork/güç, TC τ-η, TC K-pump,
 * yol profili) aynı zoom penceresi matematiğini ve aynı hit-test'i kullanır.
 * Buradaki testler o ORTAK çekirdeği sabitler — her grafiğin kendi çizimini
 * değil (canvas çıktısı test edilmez, CLAUDE.md politikası).
 */

const stubs = stubGlobals();
eval(loadSource('panel-chart.js'));

const BASE = { minX: 0, maxX: 100, minY: 0, maxY: 50 };
const z = (scale, cx, cy) => ({
  scale: scale,
  centerX: cx === undefined ? null : cx,
  centerY: cy === undefined ? null : cy,
});

describe('pcZoomWindow — eksen-bağımsız zoom penceresi', () => {
  test('scale=1 tabanı aynen döndürür', () => {
    expect(pcZoomWindow(BASE, z(1))).toEqual(BASE);
  });

  test('merkez null iken taban ortasına oturur', () => {
    const zoom = z(1);
    pcZoomWindow(BASE, zoom);
    expect(zoom.centerX).toBe(50);
    expect(zoom.centerY).toBe(25);
  });

  test('yakınlaştırma pencereyi orantılı daraltır', () => {
    const w = pcZoomWindow(BASE, z(2, 50, 25));
    expect(w.maxX - w.minX).toBeCloseTo(50, 9);
    expect(w.maxY - w.minY).toBeCloseTo(25, 9);
  });

  test('yakınlaştırmada taban sınırların dışına taşmaz', () => {
    const w = pcZoomWindow(BASE, z(2, 0, 0));
    expect(w.minX).toBe(0);
    expect(w.minY).toBe(0);
    expect(w.maxX).toBeCloseTo(50, 9);
    expect(w.maxY).toBeCloseTo(25, 9);
  });

  test('uzaklaştırmada KIRPILMAZ (verinin nereye gittiği görünmeli)', () => {
    const w = pcZoomWindow(BASE, z(0.5, 50, 25));
    expect(w.minX).toBeLessThan(BASE.minX);
    expect(w.maxX).toBeGreaterThan(BASE.maxX);
  });

  test('kırpma sonrası merkez güncellenir (pan sürekliliği)', () => {
    const zoom = z(2, 0, 0);
    pcZoomWindow(BASE, zoom);
    expect(zoom.centerX).toBeCloseTo(25, 9);
    expect(zoom.centerY).toBeCloseTo(12.5, 9);
  });

  test('negatif tabanlı eksende de çalışır (irtifa profili −m)', () => {
    const neg = { minX: 0, maxX: 1000, minY: -80, maxY: 20 };
    const w = pcZoomWindow(neg, z(2, 500, -30));
    expect(w.maxY - w.minY).toBeCloseTo(50, 9);
    expect(w.minY).toBeGreaterThanOrEqual(neg.minY);
    expect(w.maxY).toBeLessThanOrEqual(neg.maxY);
  });

  test('normalize [0,1] Y ekseniyle çalışır (çift eksenli grafikler)', () => {
    const dual = { minX: 800, maxX: 2400, minY: 0, maxY: 1 };
    const w = pcZoomWindow(dual, z(4, 1600, 0.5));
    expect(w.maxY - w.minY).toBeCloseTo(0.25, 9);
    expect(w.maxX - w.minX).toBeCloseTo(400, 9);
  });
});

describe('pcInPlot — çizim alanı hit-test', () => {
  const ctx = { ml: 50, mt: 20, pw: 300, ph: 150, mr: 20, mb: 30 };

  test('plot içi kabul, marj reddedilir', () => {
    expect(pcInPlot({ mx: 200, my: 90 }, ctx)).toBe(true);
    expect(pcInPlot({ mx: 10, my: 90 }, ctx)).toBe(false);   // sol marj
    expect(pcInPlot({ mx: 200, my: 185 }, ctx)).toBe(false); // alt marj
    expect(pcInPlot({ mx: 200, my: 5 }, ctx)).toBe(false);   // üst marj
  });

  test('tam kenarlar dahil', () => {
    expect(pcInPlot({ mx: 50, my: 20 }, ctx)).toBe(true);
    expect(pcInPlot({ mx: 350, my: 170 }, ctx)).toBe(true);
  });
});

describe('vePcInterpY — tooltip ara değeri', () => {
  const pts = [{ x: 0, y: 0 }, { x: 10, y: 100 }, { x: 20, y: 50 }];

  test('düğüm noktasında tam değer', () => {
    expect(vePcInterpY(pts, 0)).toBe(0);
    expect(vePcInterpY(pts, 10)).toBe(100);
    expect(vePcInterpY(pts, 20)).toBe(50);
  });

  test('aralıkta lineer ara değer', () => {
    expect(vePcInterpY(pts, 5)).toBeCloseTo(50, 9);
    expect(vePcInterpY(pts, 15)).toBeCloseTo(75, 9);
  });

  test('aralık DIŞINDA null — uydurma değer üretmez', () => {
    expect(vePcInterpY(pts, -1)).toBeNull();
    expect(vePcInterpY(pts, 21)).toBeNull();
  });

  test('boş / yetersiz veri null', () => {
    expect(vePcInterpY([], 5)).toBeNull();
    expect(vePcInterpY(null, 5)).toBeNull();
    expect(vePcInterpY([{ x: 1, y: 2 }], 5)).toBeNull();
    expect(vePcInterpY([{ x: 1, y: 2 }], 1)).toBe(2);
  });

  test('aynı x değerli ardışık nokta bölme-sıfır üretmez', () => {
    expect(vePcInterpY([{ x: 3, y: 7 }, { x: 3, y: 9 }], 3)).toBe(7);
  });
});

describe('zoom sabitleri tüm grafiklerde ortak', () => {
  test('sınırlar ve adımlar tutarlı', () => {
    expect(PC_ZOOM_MIN).toBeLessThan(1);
    expect(PC_ZOOM_MAX).toBeGreaterThan(1);
    expect(PC_ZOOM_STEP_IN).toBeGreaterThan(1);
    expect(PC_ZOOM_STEP_OUT).toBeLessThan(1);
    expect(PC_ZOOM_STEP_IN * PC_ZOOM_STEP_OUT).toBeCloseTo(1, 1);
  });
});

describe('canvas başına durum yalıtımı', () => {
  test('iki canvas birbirinin zoom durumunu paylaşmaz', () => {
    const a = {}, b = {};
    pcZoomState(a).scale = 3;
    expect(pcZoomState(b).scale).toBe(1);
    expect(pcZoomState(a).scale).toBe(3);
  });

  test('pan durumu da canvas başına', () => {
    const a = {}, b = {};
    pcPanState(a).active = true;
    expect(pcPanState(b).active).toBe(false);
  });

  test('pcIsZoomed küçük sapmayı zoom saymaz', () => {
    const c = {};
    pcZoomState(c).scale = 1.0;
    expect(pcIsZoomed(c)).toBe(false);
    pcZoomState(c).scale = 1.18;
    expect(pcIsZoomed(c)).toBe(true);
  });
});

describe('tüm panel grafikleri katmana bağlı', () => {
  // Regresyon koruması: yeni bir panel grafiği eklenip katmana bağlanmazsa
  // ya da mevcut bir bağlantı kopartılırsa burada yakalanır.
  const WIRED = [
    ['cp-engine.js', 've-motor-chart-'],
    ['cp-torque-converter.js', 've-tc-chart-tau-'],
    ['cp-torque-converter.js', 've-tc-chart-kpump-'],
    ['component-extras.js', 've-road-mseg'],
  ];

  test.each(WIRED)('%s → %s pcAttach ile bağlı', (file, uidFragment) => {
    const src = loadSource(file);
    expect(src).toContain('pcAttach(canvas, {');
    expect(src).toContain(uidFragment);
  });

  test('her bağlantı zoom penceresini paylaşılan fonksiyondan alır', () => {
    ['cp-engine.js', 'cp-torque-converter.js', 'component-extras.js'].forEach((f) => {
      expect(loadSource(f)).toContain('pcZoomWindow(');
    });
  });
});
