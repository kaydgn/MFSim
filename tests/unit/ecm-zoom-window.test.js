/**
 * ecmZoomWindow — Motor×Konvertör grafiğinin zoom penceresi matematiği
 * ────────────────────────────────────────────────────────────────────
 * Panel içi grafik ile tam ekran modal AYNI saf fonksiyonu kullanır; ikisi
 * arasında sapma olmaması bu testle sabitlenir. Test edilen şey saf sayısal
 * çekirdek — canvas çıktısı veya HTML değil (CLAUDE.md test politikası).
 *
 * Sözleşme:
 *   - scale=1 → taban aralık aynen döner
 *   - scale>1 → pencere daralır ve taban sınırların DIŞINA taşmaz (kırpılır)
 *   - scale<1 → kırpma yok (uzaklaşınca eğrilerin nereye gittiği görünmeli)
 *   - merkez null ise taban ortasına oturur; kırpma sonrası merkez güncellenir
 */

const stubs = stubGlobals();
eval(loadSource('cp-matching.js'));

const BASE = { minRPM: 400, maxRPM: 2400, minT: 0, maxT: 1000 };
const z = (scale, centerRPM, centerT) => ({
  scale: scale,
  centerRPM: centerRPM === undefined ? null : centerRPM,
  centerT: centerT === undefined ? null : centerT,
});

describe('ecmZoomWindow — taban görünüm', () => {
  test('scale=1 tabanı aynen döndürür', () => {
    const w = ecmZoomWindow(BASE, z(1));
    expect(w).toEqual(BASE);
  });

  test('merkez null iken taban ortasına oturur', () => {
    const zoom = z(1);
    ecmZoomWindow(BASE, zoom);
    expect(zoom.centerRPM).toBe(1400); // (400+2400)/2
    expect(zoom.centerT).toBe(500);    // (0+1000)/2
  });

  test('scale tanımsız/0 ise 1 gibi davranır', () => {
    expect(ecmZoomWindow(BASE, z(0))).toEqual(BASE);
    expect(ecmZoomWindow(BASE, { scale: undefined, centerRPM: null, centerT: null })).toEqual(BASE);
  });
});

describe('ecmZoomWindow — yakınlaştırma', () => {
  test('scale=2 pencereyi yarıya indirir, merkezde tutar', () => {
    const w = ecmZoomWindow(BASE, z(2, 1400, 500));
    expect(w.maxRPM - w.minRPM).toBeCloseTo(1000, 6);
    expect(w.maxT - w.minT).toBeCloseTo(500, 6);
    expect((w.minRPM + w.maxRPM) / 2).toBeCloseTo(1400, 6);
    expect((w.minT + w.maxT) / 2).toBeCloseTo(500, 6);
  });

  test('sol/alt kenara dayanınca taban sınırın dışına taşmaz', () => {
    const w = ecmZoomWindow(BASE, z(2, 400, 0));
    expect(w.minRPM).toBe(400);              // tabanın altına inmez
    expect(w.maxRPM).toBeCloseTo(1400, 6);   // genişlik korunur (1000)
    expect(w.minT).toBe(0);
    expect(w.maxT).toBeCloseTo(500, 6);
  });

  test('sağ/üst kenara dayanınca taban sınırın dışına taşmaz', () => {
    const w = ecmZoomWindow(BASE, z(2, 2400, 1000));
    expect(w.maxRPM).toBe(2400);
    expect(w.minRPM).toBeCloseTo(1400, 6);
    expect(w.maxT).toBe(1000);
    expect(w.minT).toBeCloseTo(500, 6);
  });

  test('kırpma sonrası merkez güncellenir (pan sürekliliği için)', () => {
    const zoom = z(2, 400, 0); // sol-alt köşeye taşmış istek
    ecmZoomWindow(BASE, zoom);
    expect(zoom.centerRPM).toBeCloseTo(900, 6);  // kırpılmış pencerenin ortası
    expect(zoom.centerT).toBeCloseTo(250, 6);
  });

  test('yüksek zoom da genişliği doğru daraltır', () => {
    const w = ecmZoomWindow(BASE, z(10, 1400, 500));
    expect(w.maxRPM - w.minRPM).toBeCloseTo(200, 6);
    expect(w.maxT - w.minT).toBeCloseTo(100, 6);
  });
});

describe('ecmZoomWindow — uzaklaştırma', () => {
  test('scale<1 pencereyi genişletir ve KIRPILMAZ', () => {
    const w = ecmZoomWindow(BASE, z(0.5, 1400, 500));
    expect(w.maxRPM - w.minRPM).toBeCloseTo(4000, 6);
    expect(w.minRPM).toBeLessThan(BASE.minRPM);   // taban dışı görünür
    expect(w.maxRPM).toBeGreaterThan(BASE.maxRPM);
    expect(w.minT).toBeLessThan(BASE.minT);
  });
});

describe('zoom sınır sabitleri', () => {
  test('scroll adımları ters yönde ve simetriye yakın', () => {
    expect(ECM_ZOOM_STEP_IN).toBeGreaterThan(1);
    expect(ECM_ZOOM_STEP_OUT).toBeLessThan(1);
    // Bir içeri + bir dışarı ≈ başlangıca döner (kullanıcı hissi)
    expect(ECM_ZOOM_STEP_IN * ECM_ZOOM_STEP_OUT).toBeCloseTo(1, 1);
  });

  test('sınırlar makul ve tabanı içeriyor', () => {
    expect(ECM_ZOOM_MIN).toBeLessThan(1);
    expect(ECM_ZOOM_MAX).toBeGreaterThan(1);
  });
});

describe('ecmInPlot — çizim alanı sınır kontrolü', () => {
  const ctx = { ml: 52, mt: 16, pw: 611, ph: 411 };

  test('plot içindeki nokta kabul edilir', () => {
    expect(ecmInPlot({ mx: 300, my: 200 }, ctx)).toBe(true);
  });

  test('sol marj (eksen etiketleri) reddedilir', () => {
    expect(ecmInPlot({ mx: 20, my: 200 }, ctx)).toBe(false);
  });

  test('alt marj (RPM etiketleri) reddedilir', () => {
    expect(ecmInPlot({ mx: 300, my: 440 }, ctx)).toBe(false);
  });

  test('tam kenar dahil edilir', () => {
    expect(ecmInPlot({ mx: 52, my: 16 }, ctx)).toBe(true);
    expect(ecmInPlot({ mx: 52 + 611, my: 16 + 411 }, ctx)).toBe(true);
  });
});

describe('ecmAveragePumpDrop — ortalama pompa tork düşümü', () => {
  // Regresyon zemini: hesap iki yerde kopyalanmıştı ve fallback'leri sapmıştı
  // (biri defaultPumpDrop, diğeri sabit 17.6). Ayrıca yuvarlanmadığı için
  // kayan-nokta artefaktı etikete ham sızıyordu.
  const PRESETS = {
    a: { pumpTorqueDrop: 17.6 },
    b: { pumpTorqueDrop: 17.6 },
    c: { pumpTorqueDrop: 30.0 },
    noDrop: {},          // pumpTorqueDrop tanımsız → fallback
  };

  test('tek değerli küme o değeri döndürür', () => {
    expect(ecmAveragePumpDrop(['a'], PRESETS)).toBe(17.6);
  });

  test('kayan-nokta artefaktı sızmaz (7 × 17.6 / 7)', () => {
    const keys = ['a', 'a', 'a', 'a', 'a', 'a', 'a'];
    // Yuvarlanmamış hâli 17.599999999999998 verir — etikete böyle basılıyordu
    expect(ecmAveragePumpDrop(keys, PRESETS)).toBe(17.6);
  });

  test('sonuç her zaman en fazla 1 ondalıklı', () => {
    const v = ecmAveragePumpDrop(['a', 'c'], PRESETS);   // (17.6+30)/2 = 23.8
    expect(v).toBe(23.8);
    expect(String(v).split('.')[1] || '').toHaveLength(1);
  });

  test('pumpTorqueDrop tanımsız preset fallback kullanır', () => {
    expect(ecmAveragePumpDrop(['noDrop'], PRESETS, 12.5)).toBe(12.5);
    // varsayılan fallback = ECM_DEFAULT_PUMP_DROP
    expect(ecmAveragePumpDrop(['noDrop'], PRESETS)).toBe(ECM_DEFAULT_PUMP_DROP);
  });

  test('bilinmeyen anahtar da fallback kullanır', () => {
    expect(ecmAveragePumpDrop(['boyle-bir-key-yok'], PRESETS, 9.9)).toBe(9.9);
  });

  test('boş/eksik girdi fallback döndürür (bölme-sıfır yok)', () => {
    expect(ecmAveragePumpDrop([], PRESETS, 5)).toBe(5);
    expect(ecmAveragePumpDrop(null, PRESETS, 5)).toBe(5);
    expect(ecmAveragePumpDrop(undefined, PRESETS)).toBe(ECM_DEFAULT_PUMP_DROP);
  });

  test('varsayılan sabit tek kaynaktan gelir', () => {
    expect(ECM_DEFAULT_PUMP_DROP).toBe(17.6);
    // Kaynakta artık ikinci bir sabit 17.6 tanımı olmamalı
    const src = loadSource('cp-matching.js');
    const decls = src.match(/=\s*17\.6\s*;/g) || [];
    expect(decls).toHaveLength(1);   // yalnızca ECM_DEFAULT_PUMP_DROP
  });
});
