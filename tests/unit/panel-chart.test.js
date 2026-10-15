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

describe('pcEtiketYerlestir — etiketler üst üste yazılmaz', () => {
  // Ölçüldü: Eğim Kabiliyeti grafiğinde "Durma (80.6%)" ile "Kalkış (78.6%)"
  // aynı x'te 2 puan arayla duruyor ve 75 px üst üste yazılıyordu; irtifa
  // profilinde yan yana iki durak (4,2 ve 4,6 km) aynı üst şeride düşüyor.
  const H = 14;
  const kesisen = (l) => l.some((a, i) => l.some((b, j) => i < j &&
    a.x0 < b.x1 && b.x0 < a.x1 && Math.abs(a.ty - b.ty) < H));

  test('dikeyde yakın, yatayda kesişen iki etiket: alttaki bir satır iner', () => {
    const l = [{ x0: 10, x1: 90, y: 50 }, { x0: 10, x1: 90, y: 58 }];
    pcEtiketYerlestir(l, H);
    expect(l.map((e) => e.ty)).toEqual([50, 64]);
    expect(kesisen(l)).toBe(false);
  });

  test('yatayda kesişmeyen etiketler yerinde kalır (aynı y olsa bile)', () => {
    const l = [{ x0: 0, x1: 40, y: 20 }, { x0: 50, x1: 90, y: 20 }];
    pcEtiketYerlestir(l, H);
    expect(l.map((e) => e.ty)).toEqual([20, 20]);
  });

  test('zincirleme: itilen etiket bir sonrakini de iter; girdi sırası korunur', () => {
    const l = [{ x0: 0, x1: 100, y: 10 }, { x0: 20, x1: 80, y: 10 }, { x0: 40, x1: 60, y: 12 }];
    pcEtiketYerlestir(l, H);
    expect(l.map((e) => e.ty)).toEqual([10, 24, 38]);
    expect(kesisen(l)).toBe(false);
  });

  test('sabit ENGELİN altına iner, engel kıpırdamaz', () => {
    // İrtifa profili: eğim çizgisinin etiketi zaten çizilmiş; durak etiketi
    // onun üstüne yazılıyordu (ölçüldü: 86 px).
    const engel = [{ x0: 0, x1: 120, ty: 30 }];
    const l = [{ x0: 50, x1: 150, y: 30 }];
    pcEtiketYerlestir(l, H, engel);
    expect(l[0].ty).toBe(44);
    expect(engel).toEqual([{ x0: 0, x1: 120, ty: 30 }]);
  });

  test('uzak etiketlere dokunmaz — boşluk varsa yukarı da kaymaz', () => {
    const l = [{ x0: 0, x1: 100, y: 10 }, { x0: 0, x1: 100, y: 200 }];
    pcEtiketYerlestir(l, H);
    expect(l.map((e) => e.ty)).toEqual([10, 200]);
  });
});

describe('artı imleci farenin altında ve çizim alanında', () => {
  // Ölçülen kusur (gerçek tarayıcı): kaplamalar kabın iç kutusuna göre
  // konuyor, fare tuvale göre ölçülüyordu; tuval kabın dolgusu kadar kaymış
  // olduğundan imleç fareden geride duruyordu — motor panelinde 4 px, büyük
  // eşleştirme grafiğinde 10 px. İmleç kabın tamamını boyuyor, çizim alanını
  // 37–80 px taşıyıp eksen yazılarının üstünden geçiyordu (açık temada beyaz
  // olduğu için hiç görünmüyordu; jetona bağlanınca görünür oldu).
  // Kurulum gerçeğin kopyası: kap 4 px dolgulu, tuval 280×200 CSS px ve
  // backing store aynı ölçüde (sx = sy = 1).
  function kur() {
    document.body.innerHTML = '<div id="kap" style="padding:4px"><canvas id="cv"></canvas></div>';
    const kap = document.getElementById('kap'), cv = document.getElementById('cv');
    kap.getBoundingClientRect = () => ({ left: 100, top: 50, width: 288, height: 208, right: 388, bottom: 258 });
    cv.getBoundingClientRect = () => ({ left: 104, top: 54, width: 280, height: 200, right: 384, bottom: 254 });
    pcAttach(cv, {
      uid: 'tst', ml: 40, mr: 10, mt: 12, mb: 28, pw: 230, ph: 160,
      minX: 0, maxX: 100, minY: 0, maxY: 50,
      xFromPx: (x) => x, yFromPx: (y) => y, tooltipHTML: () => 'x'
    });
    return cv;
  }
  const px = (s) => parseFloat(s);

  test('dikey ve yatay çizgi farenin olduğu yerde — kabın dolgusu sayılıyor', () => {
    const cv = kur();
    pcMouseMove({ currentTarget: cv, clientX: 204, clientY: 134 });
    const v = document.getElementById('tst-pc-cv').style, h = document.getElementById('tst-pc-ch').style;
    expect(v.display).toBe('block');
    expect(px(v.left)).toBe(204 - 100);                 // kabın iç kutusuna göre fare
    expect(px(h.top)).toBe(134 - 50);
  });

  test('çizgiler çizim alanında kalır — eksen yazılarına uzanmaz', () => {
    const cv = kur();
    pcMouseMove({ currentTarget: cv, clientX: 204, clientY: 134 });
    const v = document.getElementById('tst-pc-cv').style, h = document.getElementById('tst-pc-ch').style;
    expect([px(v.top), px(v.height)]).toEqual([4 + 12, 160]);
    expect([px(h.left), px(h.width)]).toEqual([4 + 40, 230]);
  });

  test('eşleştirme grafikleri aynı yardımcıyı kullanıyor — ikinci bir hesap yok', () => {
    const s = loadSource('cp-matching.js');
    expect(s).toContain('pcArtiImlec(');
    expect(s).not.toMatch(/crossV\.style\.left\s*=\s*cssX/);
    expect(loadSource('panel-chart.js')).not.toMatch(/crossV\.style\.left\s*=\s*cssX/);
  });
});
