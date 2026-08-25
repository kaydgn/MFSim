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

  // KULLANICI KURALI (2026-08-13): kanvasa bırakılan HER bileşen çerçeveyi
  // genişletir — sensör dâhil, istisna yok. Sensör createNode'da 33×33
  // kurulur (ui-core.js), o yüzden ölçüsü elle verilir.
  test('sensör de çerçeveyi genişletir (istisna kalmadı)', () => {
    const yalniz = cs.veBoundaryBox([N(3000, 3000)], 50);
    const ile = cs.veBoundaryBox(
      [N(3000, 3000), { id: 's', type: 'sensor', x: 3500, y: 3300, width: 33, height: 33 }], 50);
    expect(ile).not.toEqual(yalniz);
    expect(ile.x + ile.w).toBe(3500 + 33 + 50);
    expect(ile.y + ile.h).toBe(3300 + 33 + cs.VE_NODE_LABEL_H + 50);
  });

  test('yalnız sensör varsa bile çerçeve çizilir', () => {
    const box = cs.veBoundaryBox([{ id: 's', type: 'sensor', x: 3000, y: 3000, width: 33, height: 33 }], 50);
    expect(box).not.toBeNull();
    expect(box.x).toBe(2950);
  });

  // KULLANICI ŞİKÂYETİ (2026-08-13): "Sensör Sihirbazı bileşeni topoloji
  // çerçevesini genişletmiyor; normalde her bileşen genişletir."
  // Sihirbaz sıradan bir bileşen gibi bırakılıyor, kendi yeri var, normal
  // ölçüde çiziliyor — sensörün istisnasına ait değil.
  test('Sensör Sihirbazı çerçeveyi GENİŞLETİR', () => {
    const yalniz = cs.veBoundaryBox([N(3000, 3000)], 50);
    const ile = cs.veBoundaryBox([N(3000, 3000), { id: 'w', type: 'sensor-wizard', x: 3600, y: 3400 }], 50);
    expect(ile).not.toEqual(yalniz);
    expect(ile.x + ile.w).toBe(3600 + 65 + 50);
    expect(ile.y + ile.h).toBe(3400 + 60 + cs.VE_NODE_LABEL_H + 50);
  });

  test('yalnız Sensör Sihirbazı varsa bile çerçeve çizilir', () => {
    const box = cs.veBoundaryBox([{ id: 'w', type: 'sensor-wizard', x: 3000, y: 3000 }], 50);
    expect(box).not.toBeNull();
    expect(box.x).toBe(2950);
  });

  test('çizilecek düğüm yoksa null (boş alt-topoloji, koordinatsız düğüm)', () => {
    expect(cs.veBoundaryBox([], 50)).toBeNull();
    expect(cs.veBoundaryBox(null, 50)).toBeNull();
    expect(cs.veBoundaryBox([{ id: 'a', type: 'engine' }], 50)).toBeNull();
    expect(cs.veBoundaryBox([null, undefined], 50)).toBeNull();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// DÜĞÜM ADININ ÇERÇEVEYE ETKİSİ
// ───────────────────────────────────────────────────────────────────────────
// KULLANICI BİLDİRİMİ (2026-08-24, Yapısal Analiz · Geometri): adı SOLA alınan
// bileşende ad, kesikli topoloji çerçevesinin DIŞINA taşıyordu. Çerçeve yalnız
// KUTULARI sarıyor, ada ait tek pay altta sabit 20px'ti.
//
// Bu sessizlik gözle ancak ekran görüntüsü gönderilince yakalanıyor: çerçeve
// kendi içinde tutarlı (kutuları kusursuz sarıyor), yalnız ADI görmüyor.
// ═══════════════════════════════════════════════════════════════════════════
describe('veNodeLabelOverflow — adın kutu dışına taşması', () => {
  const W = 65, H = 60;

  test('alt etiket: aşağı 4+yükseklik, geniş adın taşması İKİ YANA EŞİT', () => {
    // 140px'lik ad ("Malzeme ve Özellikler") 50px kutuda: her yandan 45px
    const o = cs.veNodeLabelOverflow('bottom', 50, 46, { w: 140, h: 16 });
    expect(o.bottom).toBe(cs.VE_LABEL_GAP_V + 16);
    expect(o.top).toBe(0);
    expect(o.left).toBe(45);
    expect(o.right).toBe(45);
  });

  test('üst etiket: aynı taşma YUKARI çıkar', () => {
    const o = cs.veNodeLabelOverflow('top', 50, 46, { w: 140, h: 16 });
    expect(o.top).toBe(cs.VE_LABEL_GAP_V + 16);
    expect(o.bottom).toBe(0);
    expect(o.left).toBe(45);
    expect(o.right).toBe(45);
  });

  test('sol etiket: SOLA 7+genişlik — kullanıcının bildirdiği durum', () => {
    const o = cs.veNodeLabelOverflow('left', W, H, { w: 58, h: 16 });
    expect(o.left).toBe(cs.VE_LABEL_GAP_H + 58);
    expect(o.right).toBe(0);
    // Ad kutudan alçak → dikeyde taşma yok
    expect(o.top).toBe(0);
    expect(o.bottom).toBe(0);
  });

  test('sağ etiket sol etiketin AYNASI', () => {
    const sol = cs.veNodeLabelOverflow('left', W, H, { w: 58, h: 16 });
    const sag = cs.veNodeLabelOverflow('right', W, H, { w: 58, h: 16 });
    expect(sag.right).toBe(sol.left);
    expect(sag.left).toBe(sol.right);
  });

  test('kutudan dar ad yatayda taşmaz (negatif pay üretmez)', () => {
    const o = cs.veNodeLabelOverflow('bottom', 200, 120, { w: 40, h: 16 });
    expect(o.left).toBe(0);
    expect(o.right).toBe(0);
  });

  test('kutudan yüksek yan etiket dikeyde eşit taşar', () => {
    // 33×33 sensör kutusunda 16px'lik ad değil, 41px'lik iki satırlık ad
    const o = cs.veNodeLabelOverflow('left', 33, 33, { w: 58, h: 41 });
    expect(o.top).toBe(4);
    expect(o.bottom).toBe(4);
  });

  test('ölçülemeyen ad taşma üretmez (uydurma genişlik yok)', () => {
    expect(cs.veNodeLabelOverflow('left', W, H, null))
      .toEqual({ left: 0, right: 0, top: 0, bottom: 0 });
    expect(cs.veNodeLabelOverflow('bottom', W, H, { w: 0, h: 0 }))
      .toEqual({ left: 0, right: 0, top: 0, bottom: 0 });
  });

  // Boşluk sayıları CSS'te de yazılı (.ve-node-label margin'leri). İki yer
  // ayrışırsa hata SESSİZ: çerçeve yine çizilir, yalnız adı birkaç piksel
  // keser — yani düzeltilen kusurun küçük hâli geri gelir. Kapı bu yüzden
  // sayıyı canvas-space.js'e değil, CSS'in KENDİSİNE bağlıyor.
  test('boşluk sabitleri css/styles.css ile AYNI', () => {
    const fs = require('fs');
    const path = require('path');
    const css = fs.readFileSync(path.join(__dirname, '../../css/styles.css'), 'utf8');

    const blok = (sec) => {
      const i = css.indexOf('\n' + sec + '{');
      expect(i).toBeGreaterThan(-1);
      return css.slice(i, css.indexOf('}', i));
    };
    const px = (metin, ozellik) => {
      const m = new RegExp(ozellik + '\\s*:\\s*(\\d+(?:\\.\\d+)?)px').exec(metin);
      expect(m).not.toBeNull();
      return parseFloat(m[1]);
    };

    expect(px(blok('.ve-node-label'), 'margin-top')).toBe(cs.VE_LABEL_GAP_V);
    expect(px(blok('.ve-node-label.lbl-top'), 'margin-bottom')).toBe(cs.VE_LABEL_GAP_V);
    expect(px(blok('.ve-node-label.lbl-left'), 'margin-right')).toBe(cs.VE_LABEL_GAP_H);
    expect(px(blok('.ve-node-label.lbl-right'), 'margin-left')).toBe(cs.VE_LABEL_GAP_H);
  });
});

describe('veBoundaryBox — ad çerçeveye girer (ölçüm işlevi geçilince)', () => {
  const N = (x, y, extra) => Object.assign({ id: 'n' + x, type: 'engine', x, y }, extra || {});
  const olc = (w, h) => () => ({ w: w, h: h });

  test('adı SOLA alınmış düğümde çerçeve SOLA açılır', () => {
    const dugum = N(3000, 3000, { data: { labelPos: 'left' } });
    const eski = cs.veBoundaryBox([dugum], 50);                    // ölçüm YOK → eski davranış
    const yeni = cs.veBoundaryBox([dugum], 50, olc(58, 16));
    expect(eski.x).toBe(2950);                                     // ad çerçevenin dışında kalıyordu
    expect(yeni.x).toBe(3000 - (cs.VE_LABEL_GAP_H + 58) - 50);     // 2885
    expect(yeni.w).toBe(eski.w + (cs.VE_LABEL_GAP_H + 58));
  });

  test('ADIN SOL UCU çerçevenin İÇİNDE ve dolgu kadar uzağında', () => {
    // Kullanıcının bildirdiği senaryonun doğrudan ölçüsü.
    const dugum = N(3000, 3000, { data: { labelPos: 'left' } });
    const box = cs.veBoundaryBox([dugum], 50, olc(58, 16));
    const adSolUc = 3000 - cs.VE_LABEL_GAP_H - 58;
    expect(adSolUc - box.x).toBe(50);        // ad ile çerçeve arası tam dolgu
    expect(box.x).toBeLessThan(adSolUc);     // ve ad HER HÂLÜKÂRDA içeride
  });

  test('kutusundan geniş ALT etiket çerçeveyi iki yana açar', () => {
    // "Malzeme ve Özellikler" — 50px kutu, ~140px ad
    const dugum = N(3000, 3000, { width: 50, height: 46 });
    const box = cs.veBoundaryBox([dugum], 50, olc(140, 16));
    expect(box.x).toBe(3000 - 45 - 50);
    expect(box.x + box.w).toBe(3000 + 50 + 45 + 50);
  });

  test('sağa alınmış ad çerçeveyi SAĞA açar', () => {
    const dugum = N(3000, 3000, { data: { labelPos: 'right' } });
    const box = cs.veBoundaryBox([dugum], 50, olc(58, 16));
    expect(box.x).toBe(2950);                                       // sol kenar değişmez
    expect(box.x + box.w).toBe(3000 + 65 + cs.VE_LABEL_GAP_H + 58 + 50);
  });

  test('üste alınmış ad çerçeveyi YUKARI açar', () => {
    const dugum = N(3000, 3000, { data: { labelPos: 'top' } });
    const box = cs.veBoundaryBox([dugum], 50, olc(58, 16));
    expect(box.y).toBe(3000 - (cs.VE_LABEL_GAP_V + 16) - 50);
  });

  // Çerçeve yalnız BÜYÜR: ad başka kenara gitse de kutunun altındaki eski
  // 20px'lik nefes payı durur. Kurulu hiçbir topoloji bu düzeltmeyle daralmaz.
  test('ad sola gitse bile alttaki pay küçülmez', () => {
    const dugum = N(3000, 3000, { data: { labelPos: 'left' } });
    const box = cs.veBoundaryBox([dugum], 50, olc(58, 16));
    expect(box.y + box.h).toBe(3000 + 60 + cs.VE_NODE_LABEL_H + 50);
  });

  test('ölçüm işlevi geçilmezse davranış BİREBİR eski hâli', () => {
    const liste = [N(3000, 3000, { data: { labelPos: 'left' } }), N(3400, 3200)];
    expect(cs.veBoundaryBox(liste, 50))
      .toEqual({ x: 2950, y: 2950, w: 3400 + 65 + 50 - 2950, h: 3200 + 60 + 20 + 50 - 2950 });
  });

  // MODÜL KARTINDA ad kutunun dışında yüzmez, kartın İÇİNDE bir satırdır
  // (css .ve-node--module .ve-node-label{position:static}). Kart adı için pay
  // ayırmak, ana topolojide dört modül kartının çevresinde sebepsiz boşluk
  // açardı — ölçüt tipin adı değil, kuralın kendi ölçütü (veIsModuleNode).
  test('modül kartının adı çerçeveye taşma EKLEMEZ', () => {
    global.veIsModuleNode = (n) => n.type === 'arac-performans';
    try {
      const kart = { id: 'm', type: 'arac-performans', x: 3000, y: 3000, width: 120, height: 96 };
      const box = cs.veBoundaryBox([kart], 50, olc(200, 16));
      expect(box.x).toBe(2950);
      expect(box.x + box.w).toBe(3000 + 120 + 50);
      expect(box.y + box.h).toBe(3000 + 96 + cs.VE_NODE_LABEL_H + 50);
    } finally {
      delete global.veIsModuleNode;
    }
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
