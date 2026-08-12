/**
 * canvas-space.js birim testleri
 * ──────────────────────────────
 * Kanvas uzayının SAF çekirdeği: sonsuz ızgara deseni (kamera → CSS background),
 * "ev" kamerası ve topoloji ortalama. Buradaki bir regresyon "makul ama yanlış"
 * bir görüntü üretir — ızgara içerikten kayar ya da yüklenen topoloji yine
 * ızgaranın köşesine düşer; gözle ancak birileri ekran görüntüsü gönderince
 * yakalanır. Testin karşılığı burada.
 *
 * Kamera sözleşmesi (tüm modüllerde aynı):
 *     ekran = (yerel - 3000) * zoom + canvasOffset
 */
const cs = require('../../js/canvas-space.js');

describe('veGridPattern — sonsuz ızgara deseni', () => {
  test('ev kamerasında yerel (0,0) çizgisi doğru ekran noktasına oturur', () => {
    // zoom 1, offset = kanvas merkezi görünüm ortasında (700,400) →
    // yerel 0'ın ekran x'i = 700 - 3000 = -2300 → 20px desende -2300 % 20 = 0
    const p = cs.veGridPattern(1, { x: 700, y: 400 }, 20);
    expect(p.size).toBe(20);
    expect(p.x).toBeCloseTo(0, 9);
    expect(p.y).toBeCloseTo(0, 9);
  });

  test('desen yerel ızgarayla hizalı: yerel çizgi ekranda hücre sınırında', () => {
    const zoom = 1, off = { x: 713.5, y: 402.25 }, base = 20;
    const p = cs.veGridPattern(zoom, off, base);
    // Yerel x = 3000 (kanvas merkezi, ızgara çizgisi) → ekran x'i:
    const screenOfLocal3000 = (3000 - 3000) * zoom + off.x;
    // Desendeki çizgiler p.x + k*p.size noktalarında; aradaki fark hücrenin katı olmalı
    const delta = screenOfLocal3000 - p.x;
    expect(Math.abs(delta / p.size - Math.round(delta / p.size))).toBeLessThan(1e-9);
  });

  test('pan ettikçe desen kayar (sonsuz izlenim) ama hücre boyu sabit kalır', () => {
    const a = cs.veGridPattern(1, { x: 700, y: 400 }, 20);
    const b = cs.veGridPattern(1, { x: 707, y: 400 }, 20);
    expect(b.size).toBe(a.size);
    expect(b.x).toBeCloseTo(7, 9);
  });

  test('offset ne kadar büyürse büyüsün desen konumu 0..size aralığında kalır', () => {
    const p = cs.veGridPattern(1, { x: -98765.4, y: 123456.7 }, 20);
    expect(p.x).toBeGreaterThanOrEqual(0);
    expect(p.x).toBeLessThan(p.size);
    expect(p.y).toBeGreaterThanOrEqual(0);
    expect(p.y).toBeLessThan(p.size);
  });

  test('zoom ile hücre ölçeklenir', () => {
    expect(cs.veGridPattern(2, { x: 0, y: 0 }, 20).size).toBe(40);
    expect(cs.veGridPattern(0.5, { x: 0, y: 0 }, 20).size).toBe(10); // 10 ≥ 8 → katlanmaz
  });

  test('çok uzaklaşınca hücre 2× katlanır (moiré yerine okunur ızgara)', () => {
    // zoom 0.2 → 20*0.2 = 4px (< VE_GRID_MIN_PX) → 8px'e katlanır
    const p = cs.veGridPattern(0.2, { x: 0, y: 0 }, 20);
    expect(p.size).toBeGreaterThanOrEqual(cs.VE_GRID_MIN_PX);
    expect(p.size).toBe(8);
    // Katlama 2'nin katı olduğu için desen yerel ızgaraya hizalı KALIR
    expect((p.size / (20 * 0.2)) % 2).toBe(0);
  });

  test('bozuk girdide (zoom 0/NaN, offset yok) çökmez, makul desen döner', () => {
    expect(cs.veGridPattern(0, null, 0).size).toBeGreaterThan(0);
    expect(cs.veGridPattern(NaN, { x: NaN, y: NaN }, NaN).x).toBeCloseTo(0, 9);
  });
});

describe('veHomeCameraOffset — "ev" kamerası kanvas merkezini ortalar', () => {
  test('offset = görünüm merkezi ⇒ yerel 3000 ekranın ortasına düşer', () => {
    document.body.innerHTML =
      '<div id="ve-canvas-wrapper" style="width:1200px;height:800px;"></div>';
    const wrap = document.getElementById('ve-canvas-wrapper');
    Object.defineProperty(wrap, 'clientWidth', { value: 1200, configurable: true });
    Object.defineProperty(wrap, 'clientHeight', { value: 800, configurable: true });

    const off = cs.veHomeCameraOffset();
    expect(off).toEqual({ x: 600, y: 400 });
    // ekran = (3000 - 3000) * 1 + offset = offset = görünüm merkezi ✔
    const screenX = (cs.VE_CANVAS_CENTER - cs.VE_CANVAS_CENTER) * 1 + off.x;
    expect(screenX).toBe(600);
  });

  test('wrapper ölçülemezse köşeye DÜŞMEZ (pencereye/varsayılana düşer)', () => {
    document.body.innerHTML = '';
    const off = cs.veHomeCameraOffset();
    expect(off.x).toBeGreaterThan(20);
    expect(off.y).toBeGreaterThan(20);
    expect(off.x).not.toBe(cs.VE_CANVAS_CENTER); // eski "sol-üst köşe" davranışı
  });
});

describe('veCenterTopoState — yüklenen topolojiyi kanvas merkezine taşır', () => {
  // Kayıtlı örneklerin gerçek bandı: sol-üst köşe (bkz. assets/examples/*.json)
  const cornerState = () => ({
    nodes: [
      { id: 'a', type: 'mnt-motor', x: 400, y: 200, width: 84, height: 76, data: { mass: 1 } },
      { id: 'b', type: 'mnt-gearbox', x: 1200, y: 600, width: 65, height: 60, data: {} },
    ],
    connections: [{ id: 'c1', from: 'a', to: 'b' }],
    annotations: [{ id: 'annot-1', type: 'frame', x: 380, y: 180, width: 900, height: 500 }],
    canvasOffset: { x: 3000, y: 3000 },
    canvasZoom: 1,
  });

  test('içerik sınır kutusunun merkezi tam kanvas merkezine oturur', () => {
    const st = cs.veCenterTopoState(cornerState());
    const bb = cs.veTopoBBox(st.nodes, st.annotations);
    expect((bb.minX + bb.maxX) / 2).toBeCloseTo(cs.VE_CANVAS_CENTER, 9);
    expect((bb.minY + bb.maxY) / 2).toBeCloseTo(cs.VE_CANVAS_CENTER, 9);
  });

  test('her yönde geniş boşluk kalır (topoloji birleştirme için yer)', () => {
    const st = cs.veCenterTopoState(cornerState());
    const bb = cs.veTopoBBox(st.nodes, st.annotations);
    expect(bb.minX).toBeGreaterThan(2000);
    expect(bb.minY).toBeGreaterThan(2000);
    expect(bb.maxX).toBeLessThan(4000);
    expect(bb.maxY).toBeLessThan(4000);
  });

  test('göreli yerleşim (düğüm arası mesafe) korunur', () => {
    const before = cornerState();
    const st = cs.veCenterTopoState(cornerState());
    expect(st.nodes[1].x - st.nodes[0].x).toBe(before.nodes[1].x - before.nodes[0].x);
    expect(st.nodes[1].y - st.nodes[0].y).toBe(before.nodes[1].y - before.nodes[0].y);
    // Açıklama çerçevesi düğümlerle AYNI miktarda kayar (çerçeve içindekiler kaçmaz)
    expect(st.annotations[0].x - st.nodes[0].x).toBe(before.annotations[0].x - before.nodes[0].x);
  });

  test('kamera telafisi: içerik ekranda aynı noktada kalır', () => {
    const before = cornerState();
    const st = cs.veCenterTopoState(cornerState());
    const scr = (s, n) => (n.x - cs.VE_CANVAS_CENTER) * s.canvasZoom + s.canvasOffset.x;
    expect(scr(st, st.nodes[0])).toBeCloseTo(scr(before, before.nodes[0]), 9);
  });

  test('kaynak JSON DEĞİŞMEZ (gömülü örnek kaydı bozulmaz)', () => {
    const src = cornerState();
    const srcNode = src.nodes[0];
    cs.veCenterTopoState(src);
    expect(srcNode.x).toBe(400); // dizi yenilendi, orijinal nesne el değmedi
    expect(srcNode.y).toBe(200);
  });

  test('idempotent: ikinci kez uygulamak konumu değiştirmez', () => {
    const once = cs.veCenterTopoState(cornerState());
    const twice = cs.veCenterTopoState(JSON.parse(JSON.stringify(once)));
    expect(twice.nodes[0].x).toBeCloseTo(once.nodes[0].x, 9);
    expect(twice.nodes[0].y).toBeCloseTo(once.nodes[0].y, 9);
  });

  test('koordinatsız / boş kayıtlara dokunmaz', () => {
    const noCoords = { nodes: [{ id: 'a', type: 'mnt-motor' }], annotations: [] };
    expect(cs.veCenterTopoState(noCoords).nodes[0]).toEqual({ id: 'a', type: 'mnt-motor' });
    expect(cs.veCenterTopoState(null)).toBeNull();
    expect(cs.veCenterTopoState({ nodes: [] }).nodes).toEqual([]);
  });
});

describe('veBoundaryBox — topoloji sınır çerçevesinin kutusu', () => {
  const N = (x, y, extra) => Object.assign({ id: 'n' + x, type: 'engine', x, y }, extra || {});

  test('varsayılan düğüm ölçüsü + ad etiketi + dolgu ile kutu kurar', () => {
    const box = cs.veBoundaryBox([N(3000, 3000)], 50);
    // 65×60 kutu + altında 20px ad etiketi, her yönde 50px dolgu
    expect(box).toEqual({ x: 2950, y: 2950, w: 65 + 100, h: 60 + 20 + 100 });
  });

  test('birden çok düğümü sarar (en sol/üst ↔ en sağ/alt)', () => {
    const box = cs.veBoundaryBox([N(3000, 3000), N(3400, 3200)], 50);
    expect(box.x).toBe(2950);
    expect(box.y).toBe(2950);
    expect(box.x + box.w).toBe(3400 + 65 + 50);
    expect(box.y + box.h).toBe(3200 + 60 + cs.VE_NODE_LABEL_H + 50);
  });

  test('düğümün kendi width/height değeri kullanılır', () => {
    const box = cs.veBoundaryBox([N(3000, 3000, { width: 200, height: 120 })], 0);
    expect(box.w).toBe(200);
    expect(box.h).toBe(120 + cs.VE_NODE_LABEL_H);
  });

  test('sensörler çerçeveyi büyütmez', () => {
    const withSensor = cs.veBoundaryBox([N(3000, 3000), { id: 's', type: 'sensor', x: 5000, y: 5000 }], 50);
    expect(withSensor).toEqual(cs.veBoundaryBox([N(3000, 3000)], 50));
  });

  test('çizilecek düğüm yoksa null (boş alt-topoloji, yalnız sensör, koordinatsız)', () => {
    expect(cs.veBoundaryBox([], 50)).toBeNull();
    expect(cs.veBoundaryBox(null, 50)).toBeNull();
    expect(cs.veBoundaryBox([{ id: 's', type: 'sensor', x: 1, y: 1 }], 50)).toBeNull();
    expect(cs.veBoundaryBox([{ id: 'a', type: 'engine' }], 50)).toBeNull();
  });
});

describe('veBoundaryChipPos — çıkış çipi çerçevenin ALT KENARINA tutunur', () => {
  const BOX = { x: 2900, y: 2900, w: 400, h: 200 };   // yerel: alt kenar y=3100, merkez x=3100
  const CHIP = { w: 260, h: 30 };
  const VIEW = { w: 1200, h: 800 };
  // Kamera sözleşmesi: ekran = (yerel - 3000) * zoom + offset
  const scr = (local, z, o) => (local - cs.VE_CANVAS_CENTER) * z + o;

  test('zoom 1: çerçevenin yatay merkezinde, alt kenarının GAP kadar altında', () => {
    const off = { x: 600, y: 400 };
    const p = cs.veBoundaryChipPos(BOX, 1, off, CHIP, VIEW);
    expect(p.left).toBeCloseTo(scr(3100, 1, off.x), 9);
    expect(p.top).toBeCloseTo(scr(3100, 1, off.y) + cs.VE_CHIP_GAP, 9);
  });

  test('pan: çip çerçeveyle birlikte gider (kaydırma kadar, birebir)', () => {
    const a = cs.veBoundaryChipPos(BOX, 1, { x: 600, y: 400 }, CHIP, VIEW);
    const b = cs.veBoundaryChipPos(BOX, 1, { x: 640, y: 430 }, CHIP, VIEW);
    expect(b.left - a.left).toBeCloseTo(40, 9);
    expect(b.top - a.top).toBeCloseTo(30, 9);
  });

  test('zoom: tutunma noktası ölçeklenir ama boşluk ekran px olarak sabit kalır', () => {
    const off = { x: 600, y: 400 };
    const p = cs.veBoundaryChipPos(BOX, 0.5, off, CHIP, VIEW);
    expect(p.left).toBeCloseTo(scr(3100, 0.5, off.x), 9);
    expect(p.top).toBeCloseTo(scr(3100, 0.5, off.y) + cs.VE_CHIP_GAP, 9);
  });

  test('çerçeve ekranın altına kayarsa çip görünümde kalır (çıkış yolu kilitlenmez)', () => {
    // Alt kenar görünümün 5000px altında — kırpılmasa çip erişilemez olurdu
    const p = cs.veBoundaryChipPos(BOX, 1, { x: 600, y: 5400 }, CHIP, VIEW);
    expect(p.top).toBeCloseTo(VIEW.h - CHIP.h - cs.VE_CHIP_INSET, 9);
    expect(p.top + CHIP.h).toBeLessThanOrEqual(VIEW.h);
  });

  test('çerçeve ekranın üstüne/yanına kayarsa da görünümde kalır', () => {
    const up = cs.veBoundaryChipPos(BOX, 1, { x: 600, y: -4000 }, CHIP, VIEW);
    expect(up.top).toBeCloseTo(cs.VE_CHIP_INSET, 9);
    const left = cs.veBoundaryChipPos(BOX, 1, { x: -4000, y: 400 }, CHIP, VIEW);
    expect(left.left).toBeCloseTo(CHIP.w / 2 + cs.VE_CHIP_INSET, 9);   // sol kenar taşmaz
    const right = cs.veBoundaryChipPos(BOX, 1, { x: 5000, y: 400 }, CHIP, VIEW);
    expect(right.left).toBeCloseTo(VIEW.w - CHIP.w / 2 - cs.VE_CHIP_INSET, 9);
  });

  test('görünüm ölçülemiyorsa (0×0) kırpma yapılmaz — çip sıfıra çökmez', () => {
    const off = { x: 600, y: 400 };
    const p = cs.veBoundaryChipPos(BOX, 1, off, CHIP, { w: 0, h: 0 });
    expect(p.left).toBeCloseTo(scr(3100, 1, off.x), 9);
    expect(p.top).toBeCloseTo(scr(3100, 1, off.y) + cs.VE_CHIP_GAP, 9);
  });

  test('çerçeve yokken (boş alt-topoloji) görünümün alt-ortasına düşer', () => {
    const p = cs.veBoundaryChipPos(null, 1, { x: 600, y: 400 }, CHIP, VIEW);
    expect(p.left).toBeCloseTo(VIEW.w / 2, 9);
    expect(p.top).toBeCloseTo(VIEW.h - CHIP.h - cs.VE_CHIP_INSET, 9);
  });
});
