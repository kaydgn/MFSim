/**
 * structural-remesh.test.js — YÜZEY YENİDEN-MESH'LEME (js/structural-remesh.js)
 *
 * Bu modül OCCT'nin RENDER tessellation'ını TetGen'in kabul edeceği üniform bir
 * yüzey ağına çevirir. Değeri tek bir sayıda: min açı. Ama asıl kapılar
 * DEĞİŞMEZLER, çünkü bir yeniden-mesh'leme adımı sessizce üç ayrı şekilde
 * bozulabilir ve üçü de ekranda kusursuz görünür:
 *
 *   1) TOPOLOJİ — açık kenar (yüzeyde delik) ya da bir kenarın 3+ üçgene
 *      bağlanması. TetGen böyle bir yüzeyde ya durur ya BAŞKA bir hacim çözer.
 *   2) HACİM — düğümler yüzeyde kalsa BİLE üçgenler üst üste binerse parça
 *      şişer/incelir. Gerilme analizinde daha ince bir gövde = sistematik
 *      olarak yüksek gerilme, yani "makul ama yanlış".
 *   3) CAD YÜZÜ KİMLİĞİ — sınır koşulu buna bağlanacak; kaybolursa yakınsama
 *      çalışmasında bütün koşullar düşer.
 *
 * Testler bu üçünü de ölçüyor. Sayılar uydurma değil: her biri geliştirme
 * sırasında GERÇEKTEN kırıldı ve kırıldığı için kapı oldu (kod içindeki
 * "ÖLÇÜLDÜ" notlarına bakınız).
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '../..');
const src = fs.readFileSync(path.join(ROOT, 'js/structural-remesh.js'), 'utf8');
// Modül üst-seviye bildirim yapıyor (tarayıcıda düz <script>); test kapsamına
// eval ile alınıyor — tests/helpers/setup.js'teki kalıbın aynısı.
eval(src);

// ── Yardımcılar ─────────────────────────────────────────────────────────────
const toT = (idx) => {
  const T = [];
  for (let t = 0; t < idx.length / 3; t++) T.push([idx[t * 3], idx[t * 3 + 1], idx[t * 3 + 2]]);
  return T;
};

// Kapalı yüzeyin çevrelediği işaretli hacim. CCW-dıştan bir ağda POZİTİF.
const hacim = (V, T) => veStrSurfaceVolume(V, T);

// Kenar sayımı: her kenar TAM 2 üçgene komşu olmalı.
function topoloji(T) {
  const ec = new Map();
  for (const tri of T) {
    if (!tri) continue;
    for (let k = 0; k < 3; k++) {
      const a = tri[k], b = tri[(k + 1) % 3];
      const key = a < b ? `${a}_${b}` : `${b}_${a}`;
      ec.set(key, (ec.get(key) || 0) + 1);
    }
  }
  let acik = 0, anormal = 0;
  for (const v of ec.values()) { if (v === 1) acik++; else if (v !== 2) anormal++; }
  return { acik, anormal };
}

// 10×10×10 küp. Sarım DIŞA-CCW: hacim +1000 çıkıyor (aşağıda test ediliyor —
// yanlış sarımlı bir fikstür bütün hacim kapılarını sessizce anlamsız yapardı).
function kup(s = 10) {
  const P = [[0,0,0],[s,0,0],[s,s,0],[0,s,0],[0,0,s],[s,0,s],[s,s,s],[0,s,s]];
  const tris = [
    [0,2,1],[0,3,2],   // alt   z=0
    [4,5,6],[4,6,7],   // üst   z=s
    [0,1,5],[0,5,4],   // ön    y=0
    [3,7,6],[3,6,2],   // arka  y=s
    [0,4,7],[0,7,3],   // sol   x=0
    [1,2,6],[1,6,5],   // sağ   x=s
  ];
  const positions = [];
  P.forEach((p) => positions.push(p[0], p[1], p[2]));
  const indices = [];
  tris.forEach((t) => indices.push(t[0], t[1], t[2]));
  // Her CAD yüzü 2 üçgen: first/last ÜÇGEN ARALIĞI (structural-model.js sözleşmesi).
  const faces = [];
  for (let f = 0; f < 6; f++) faces.push({ id: `m0/f${f}`, first: f * 2, last: f * 2 + 1 });
  return { positions: new Float64Array(positions), indices: new Int32Array(indices), faces };
}

// ── 0) Fikstürün kendisi doğru mu ───────────────────────────────────────────
describe('fikstür', () => {
  test('küp DIŞA-CCW ve su geçirmez — hacim tam +1000, açık kenar 0', () => {
    const m = kup();
    const T = toT(m.indices);
    expect(hacim(m.positions, T)).toBeCloseTo(1000, 6);
    expect(topoloji(T)).toEqual({ acik: 0, anormal: 0 });
  });
});

// ── 1) Değişmezler ──────────────────────────────────────────────────────────
describe('yeniden-mesh DEĞİŞMEZLERİ (küp, hedef 1,2 mm)', () => {
  let r, T;
  beforeAll(() => {
    r = veStrRemeshMesh(kup(), { targetLen: 1.2, iterations: 10 });
    T = toT(r.indices);
  });

  test('çalışıyor ve üçgen sayısı ARTIYOR (hedef girdiden ince)', () => {
    expect(r.ok).toBe(true);
    expect(r.indices.length / 3).toBeGreaterThan(12);
  });

  test('TOPOLOJİ: açık kenar 0, anormal (3+ üçgenli) kenar 0', () => {
    // Bu kapı geliştirme sırasında ÜÇ ayrı hatayı yakaladı: anlık görüntü
    // üzerinde ikinci kez bölme (1220 açık kenar), bağlantı koşulsuz
    // birleştirme (8 anormal kenar) ve pasoda ikinci kez çevirme (4 anormal).
    expect(topoloji(T)).toEqual({ acik: 0, anormal: 0 });
  });

  test('HACİM korunuyor — 1000 mm³, sapma %0,01 altında', () => {
    // Düğümler yüzeyde kalsa BİLE içbükey bir dörtgeni çevirmek üçgenleri üst
    // üste bindirir; normal denetimi bunu GÖREMEZ (normaller aynı yönde kalır).
    // ÖLÇÜLDÜ: alan-korunumu denetimi eklenmeden önce hacim 1000,000 → 1000,418.
    expect(Math.abs(hacim(r.positions, T) - 1000) / 1000).toBeLessThan(1e-4);
  });

  test('düğümler küp YÜZEYİNDE kalıyor (teğetsel düzleştirme yüzeyden çıkarmıyor)', () => {
    let enBuyukSapma = 0;
    for (let v = 0; v < r.positions.length / 3; v++) {
      let d = Infinity;
      for (let ax = 0; ax < 3; ax++) {
        d = Math.min(d, Math.abs(r.positions[v * 3 + ax]), Math.abs(r.positions[v * 3 + ax] - 10));
      }
      enBuyukSapma = Math.max(enBuyukSapma, d);
    }
    expect(enBuyukSapma).toBeLessThan(1e-9);
  });

  test('KALİTE: min açı yükseliyor ve 10° altı üçgen KALMIYOR', () => {
    // Modülün varlık sebebi. ÖLÇÜLDÜ: bölme adımı uzunluğa göre sıralanmadan
    // ve çevirme/düzleştirme çoklu tur koşmadan önce, aynı küpte min açı
    // 45° → 0,20°'ye DÜŞÜYOR ve üçgenlerin %45,8'i 10° altına iniyordu.
    expect(r.qualityAfter.minAngleDeg).toBeGreaterThan(30);
    expect(r.qualityAfter.below10Pct).toBe(0);
  });

  test('CAD YÜZÜ KİMLİĞİ her üçgende var ve YALNIZ girdideki altı kimlik', () => {
    expect(r.faceIds).toHaveLength(r.indices.length / 3);
    expect(r.faceIds.every((x) => !!x)).toBe(true);
    expect([...new Set(r.faceIds)].sort()).toEqual(
      ['m0/f0', 'm0/f1', 'm0/f2', 'm0/f3', 'm0/f4', 'm0/f5']);
  });

  test('altı yüzün HEPSİ çıktıda temsil ediliyor (hiçbiri yutulmadı)', () => {
    const say = {};
    r.faceIds.forEach((f) => { say[f] = (say[f] || 0) + 1; });
    expect(Object.keys(say)).toHaveLength(6);
    Object.values(say).forEach((n) => expect(n).toBeGreaterThan(0));
  });

  test('dikiş kaynağı çalıştı — girdideki 8 köşe zaten tekil, kaynak 0', () => {
    // Bu fikstürde köşeler PAYLAŞILIYOR (occt'nin aksine), yani kaynatacak bir
    // şey yok. Sayının 0 çıkması kaynağın "her şeyi birleştirmediğinin" kanıtı.
    expect(r.weldedCount).toBe(0);
  });
});

// ── 2) Sliver iyileştirme — modülün ASIL işi ────────────────────────────────
describe('sliver (ince üçgen) iyileştirme', () => {
  test('kasıtlı ince üçgen enjekte edilen küpte min açı YÜKSELİYOR', () => {
    // Alt yüzün köşegenini %90 noktasından bölerek ince bir üçgen üret.
    // Köşegeni İKİ üçgen paylaştığı için ikisi de bölünmeli — yoksa fikstür
    // su geçirmez olmaz ve test ölçtüğünü sanmadığı şeyi ölçer.
    const s = 10;
    const P = [[0,0,0],[s,0,0],[s,s,0],[0,s,0],[0,0,s],[s,0,s],[s,s,s],[0,s,s]];
    const pos = [];
    P.forEach((p) => pos.push(p[0], p[1], p[2]));
    const m = 8, t = 0.9;
    pos.push(P[0][0] + (P[2][0] - P[0][0]) * t, P[0][1] + (P[2][1] - P[0][1]) * t, P[0][2]);
    const idx = [
      0, m, 1,  m, 2, 1,      // [0,2,1] köşegen (0,2) üstünde m
      2, m, 3,  m, 0, 3,      // [0,3,2] aynı köşegen, TERS yönde
      4,5,6, 4,6,7, 0,1,5, 0,5,4, 3,7,6, 3,6,2, 0,4,7, 0,7,3, 1,2,6, 1,6,5,
    ];
    const faces = [{ id: 'm0/f0', first: 0, last: 3 }];
    for (let f = 1; f < 6; f++) faces.push({ id: `m0/f${f}`, first: 4 + (f - 1) * 2, last: 5 + (f - 1) * 2 });

    const girdi = { positions: new Float64Array(pos), indices: new Int32Array(idx), faces };
    const T0 = toT(girdi.indices);
    const q0 = veStrMeshQuality(girdi.positions, T0);
    expect(topoloji(T0)).toEqual({ acik: 0, anormal: 0 });   // fikstür sağlam
    expect(q0.minAngleDeg).toBeLessThan(8);                  // sliver GERÇEKTEN var

    const r = veStrRemeshMesh(girdi, { targetLen: 2.0, iterations: 10 });
    expect(r.ok).toBe(true);
    expect(r.qualityAfter.minAngleDeg).toBeGreaterThan(q0.minAngleDeg + 3);
    expect(topoloji(toT(r.indices))).toEqual({ acik: 0, anormal: 0 });
    expect(Math.abs(hacim(r.positions, toT(r.indices)) - 1000) / 1000).toBeLessThan(1e-4);
  });
});

// ── 3) Hedef kenar boyu ─────────────────────────────────────────────────────
describe('hedef kenar boyu', () => {
  test('verilmezse KATININ KENDİ sınır kutusundan türetiliyor', () => {
    const r = veStrRemeshMesh(kup(10), { iterations: 2 });
    // köşegen √300 ≈ 17,32 → /40 ≈ 0,43
    expect(r.targetLen).toBeCloseTo(Math.sqrt(300) / 40, 6);
  });

  test('KATI BAŞINA TAVAN: kaba bir hedef küçük parçada kırpılıyor', () => {
    // ÖLÇÜLDÜ (braket montajı): montajın tamamı için seçilen 5,98 mm hedef,
    // 17 mm'lik mesafe parçalarını yuvarlak çakıl taşına çeviriyor ve hacim
    // kaybı %5,7'ye çıkıyordu. Tavan = kendi köşegeninin 1/8'i.
    const r = veStrRemeshMesh(kup(10), { targetLen: 100, iterations: 2 });
    expect(r.targetLen).toBeCloseTo(Math.sqrt(300) / 8, 6);
    expect(r.targetLen).toBeLessThan(100);
  });

  test('makul bir hedef OLDUĞU GİBİ kullanılıyor (tavanın altında)', () => {
    const r = veStrRemeshMesh(kup(10), { targetLen: 1.5, iterations: 1 });
    expect(r.targetLen).toBe(1.5);
  });
});

// ── 4) Non-manifold: ÜRETİLMEZ, KORUNUR, RAPORLANIR ─────────────────────────
describe('non-manifold kenar', () => {
  test('temiz küpte 0', () => {
    expect(veStrRemeshMesh(kup(), { targetLen: 2, iterations: 3 }).nonManifoldEdges).toBe(0);
  });

  test('bir kenarı ÜÇ üçgenin paylaştığı ağda sayı BÖLÜNEREK ÇOĞALMIYOR', () => {
    // Gerçek CAD verisinde oluyor: occt tessellation'ı temas eden/çakışan
    // yüzeyleri aynı koordinata oturtuyor (ÖLÇÜLDÜ — braket katısı 1'de dikiş
    // kaynağından hemen sonra 4 böyle kenar). Bölmek onları ÇOĞALTIR: aynı
    // parçada 4 kenar remesh sonunda 303'e çıkıyordu.
    const m = kup();
    const pos = Array.from(m.positions);
    const idx = Array.from(m.indices);
    // (0,1) kenarına dayanan FAZLADAN bir üçgen: kenar artık 3 üçgenli.
    const yeni = pos.length / 3;
    pos.push(5, -4, -4);
    idx.push(0, 1, yeni);
    const faces = m.faces.concat([{ id: 'm0/f6', first: 12, last: 12 }]);

    const girdi = { positions: new Float64Array(pos), indices: new Int32Array(idx), faces };
    const r = veStrRemeshMesh(girdi, { targetLen: 2, iterations: 6 });
    expect(r.ok).toBe(true);
    expect(r.nonManifoldEdges).toBe(1);

    // Çıktıda da TEK non-manifold kenar kalmalı — remesh onu çoğaltmadı.
    const ec = new Map();
    toT(r.indices).forEach((tri) => {
      for (let k = 0; k < 3; k++) {
        const a = tri[k], b = tri[(k + 1) % 3];
        const key = a < b ? `${a}_${b}` : `${b}_${a}`;
        ec.set(key, (ec.get(key) || 0) + 1);
      }
    });
    expect([...ec.values()].filter((v) => v > 2)).toHaveLength(1);
  });
});

// ── 5) Hata yolları SESSİZ DEĞİL ────────────────────────────────────────────
describe('hata yolları', () => {
  test('üçgensiz girdi sebebiyle reddediliyor', () => {
    const r = veStrRemeshMesh({ positions: new Float64Array([]), indices: new Int32Array([]), faces: [] });
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/üçgen yok/i);
  });

  test('CAD yüzü bilgisi olmayan girdi sebebiyle reddediliyor', () => {
    const m = kup();
    const r = veStrRemeshMesh({ positions: m.positions, indices: m.indices, faces: [] });
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/CAD yüzü/i);
  });
});

// ── 6) Kalite ölçütleri ─────────────────────────────────────────────────────
describe('kalite ölçütleri', () => {
  test('eşkenar üçgende şekil ölçütü 1, dejenerede 0', () => {
    const eskenar = _rmShapeQ([0, 0, 0], [1, 0, 0], [0.5, Math.sqrt(3) / 2, 0]);
    expect(eskenar).toBeCloseTo(1, 6);
    expect(_rmShapeQ([0, 0, 0], [1, 0, 0], [2, 0, 0])).toBeCloseTo(0, 6);
  });

  test('şekil ölçütü min açıyla AYNI YÖNDE değişiyor (kapılarda yerine geçebilir)', () => {
    // Kapılar `acos`'suz çalışmak zorunda: üçgen başına üç ters trigonometri
    // iç döngüde milyonlarca kez koşuyordu (ÖLÇÜLDÜ: düzleştirme 11,0 s).
    const kaba = [
      [[0,0,0],[1,0,0],[0.5,0.866,0]],     // eşkenar
      [[0,0,0],[1,0,0],[0.5,0.4,0]],       // basık
      [[0,0,0],[1,0,0],[0.5,0.05,0]],      // çok basık
    ];
    const q = kaba.map((p) => _rmShapeQ(p[0], p[1], p[2]));
    const a = kaba.map((p) => _rmMinAngleDeg(p[0], p[1], p[2]));
    expect(q[0]).toBeGreaterThan(q[1]);
    expect(q[1]).toBeGreaterThan(q[2]);
    expect(a[0]).toBeGreaterThan(a[1]);
    expect(a[1]).toBeGreaterThan(a[2]);
  });

  test('hacim ölçümü işaretli — ters sarımda negatif', () => {
    const m = kup();
    const T = toT(m.indices);
    expect(veStrSurfaceVolume(m.positions, T)).toBeCloseTo(1000, 6);
    const ters = T.map((t) => [t[0], t[2], t[1]]);
    expect(veStrSurfaceVolume(m.positions, ters)).toBeCloseTo(-1000, 6);
  });
});
