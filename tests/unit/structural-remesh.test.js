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

// ── KESİŞME KALKANI ─────────────────────────────────────────────────────────
// Bu kapı, kullanıcının braketinde NATIVE TetGen `-d` ile ölçülen üç ayrı
// kusur sınıfını tutuyor. Üçü de ekranda KUSURSUZ görünüyor ve üçünü de
// mevcut hiçbir kapı görmüyordu: ağ hepsinde su geçirmez ve manifold kalıyor
// (açık kenar 0, anormal kenar 0 — ölçüldü), yalnız TetGen üçgen ATIYOR.
//
// Sınıfların üçü de ÖLÇÜLEN yapılarla sınanıyor; "şu parça bozuluyor" gibi
// bir fikstüre bağlanmadılar, çünkü ölçütlerin kendisi saf geometri.
describe('kesişme kalkanı — üçgen çifti ölçütleri', () => {
  const A = [[0,0,0],[10,0,0],[0,10,0]];

  test('üçgen–üçgen: delen EVET, uzak/dejenere/paralel HAYIR', () => {
    expect(_rmTriTriHit(...A, [2,2,-5],[2,2,5],[6,2,0])).toBe(true);
    expect(_rmTriTriHit(...A, [0,0,20],[10,0,20],[0,10,20])).toBe(false);
    expect(_rmTriTriHit(...A, [5,5,0],[5,5,0],[5,5,0])).toBe(false);
    // İnce duvarın KARŞI yüzeyini delen üçgen — bu modülün asıl kusuru.
    const duvar = [[0,0,3],[10,0,3],[0,10,3]];
    expect(_rmTriTriHit(...duvar, [1,1,-1],[2,1,6],[3,3,-1])).toBe(true);
    expect(_rmTriTriHit(...A, ...duvar)).toBe(false);   // 3 mm ötede paralel
  });

  test('EŞ DÜZLEMLİ örtüşme de kesişimdir', () => {
    // TetGen'in bu parçada bildirdiği durumlardan biri tam olarak buydu
    // ("Two line segments are nearly overlapping"); eş düzlemli dal
    // atlanırsa o sınıf sessizce geçer.
    expect(_rmTriTriHit(...A, [1,1,0],[9,1,0],[1,9,0])).toBe(true);
    expect(_rmTriTriHit(...A, [20,20,0],[30,20,0],[20,30,0])).toBe(false);
  });

  test('parça–üçgen: içinden geçen EVET, köşede değen HAYIR', () => {
    expect(_rmSegTriHit([2,2,-5],[2,2,5], ...A)).toBe(true);
    expect(_rmSegTriHit([20,20,-5],[20,20,5], ...A)).toBe(false);
    expect(_rmSegTriHit([0,0,-5],[0,0,5], ...A)).toBe(false);    // köşe teması
    expect(_rmSegTriHit([1,1,0],[5,1,0], ...A)).toBe(false);      // eş düzlemli
    // Parça düzleme ULAŞMIYOR: uzatılsa keserdi, ama parça olarak kesmiyor.
    expect(_rmSegTriHit([2,2,2],[2,2,5], ...A)).toBe(false);
    expect(_rmSegTriHit([2,2,-5],[2,2,-2], ...A)).toBe(false);
  });

  test('kenar–kenar çaprazlaması: TetGen\'in kendi ölçütü', () => {
    expect(_rmSegSegHit([0,0,0],[10,0,0], [5,-5,0],[5,5,0])).toBe(true);
    expect(_rmSegSegHit([0,0,0],[10,0,0], [5,-5,1],[5,5,1])).toBe(false);  // 1 mm ötede
    expect(_rmSegSegHit([0,0,0],[10,0,0], [0,1,0],[10,1,0])).toBe(false);  // paralel
    expect(_rmSegSegHit([0,0,0],[10,0,0], [10,0,0],[10,5,0])).toBe(false); // uçta değiyor
    expect(_rmSegSegHit([0,0,0],[10,0,0], [20,-5,0],[20,5,0])).toBe(false);// uzanınca keser
  });

  // ── Çift ölçütü: ORTAK KÖŞE SAYISI ────────────────────────────────────────
  // Kalkanın üç kör noktası da tam buradaydı ve üçü de ölçülerek bulundu.
  test('KENAR KOMŞUSU çaprazlarsa YAKALANIYOR — 2 ortak köşe elenmiyor', () => {
    // Ortak kenar (0,1); üçüncü köşeler karşılıklı katlanmış → (0,c)×(1,d)
    // köşe paylaşmıyor ve çaprazlıyor. İlk sürüm "kenar komşusu" diye bu çifti
    // tümden eliyordu; ÖLÇÜLDÜ, braket h=4,2'de TetGen'in bildirdiği çift tam
    // olarak buydu (doğrular arası uzaklık 0,000e+0 · s=0,440 · t=0,751).
    const V = new Float64Array([
      0,0,0,   10,0,0,           // 0,1 ortak kenar
      8,5,0,                     // 2  (tri'nin üçüncüsü)
      2,5,0,                     // 3  (o'nun üçüncüsü)
    ]);
    const tri = [0,1,2], o = [1,0,3];
    expect(_rmSegSegHit([V[0],V[1],V[2]],[V[6],V[7],V[8]],
                        [V[3],V[4],V[5]],[V[9],V[10],V[11]])).toBe(true);
    expect(_rmPairHits(V, tri, o, [0,0,0],[10,0,0],[8,5,0])).toBe(true);
  });

  test('TEK ortak köşede DEĞMEK serbest, DELMEK değil', () => {
    // Ortak köşe 0. İki üçgen yalnız orada değiyor → kesişim YOK.
    const V1 = new Float64Array([0,0,0, 10,0,0, 0,10,0,  -10,0,0, 0,-10,0]);
    expect(_rmPairHits(V1, [0,1,2], [0,3,4], [0,0,0],[10,0,0],[0,10,0])).toBe(false);
    // Aynı ortak köşe, ama ikinci üçgen birincinin İÇİNDEN geçiyor.
    const V2 = new Float64Array([0,0,0, 10,0,0, 0,10,0,  4,1,-5, 4,1,5]);
    expect(_rmPairHits(V2, [0,1,2], [0,3,4], [0,0,0],[10,0,0],[0,10,0])).toBe(true);
  });

  test('ASILI DÜĞÜM: kenarın içine düşen yabancı düğüm yakalanıyor', () => {
    // Braketde ölçülen yapı: 3,10 mm'lik kenarın tam ortasına (t=0,5000)
    // oturan bir zincir düğümü. Ağ manifold ve su geçirmez kalıyor.
    // FİKSTÜR GERÇEK DURUMU TAKLİT ETMEK ZORUNDA: asılı düğümün zincir
    // komşusu, kenarı taşıyan üçgenin köşesidir — yani iki üçgen TEK KÖŞE
    // paylaşır. Köşe paylaşmayan bir fikstürde `_rmTriTriHit` zaten "kesişiyor"
    // diyor ve kapı, T-bağlantısı ölçütü SİLİNSE DE yeşil kalıyordu
    // (mutasyonla ölçüldü). Tek ortak köşede ise devreye giren KARŞI KENAR
    // ölçütü bu yapıyı göremez; tek gören T-bağlantısıdır.
    const V = new Float64Array([
      0,0,0,  3.1,0,0,  1.5,2,0,     // 0,1,2 : üçgen A, kenarı (0,1)
      1.55,0,0,  2,-1,2,             // 3 : (0,1)'in TAM ORTASI · 4 : düzlem dışı
    ]);
    const A2 = [0,1,2], B2 = [1,3,4];          // ortak köşe: yalnız 1
    expect(_rmTJuncPair(V, A2, B2)).toBe(true);
    // ve ÇİFT ÖLÇÜTÜNDEN de geçmeli — yoksa kapı yalnız yardımcıyı sınar,
    // kalkanın onu KULLANDIĞINI sınamaz.
    expect(_rmPairHits(V, A2, B2, [0,0,0],[3.1,0,0],[1.5,2,0])).toBe(true);
    // Düğüm kenardan uzaklaşınca temiz.
    V[3*3+1] = -0.5; V[3*3+2] = 0.5;
    expect(_rmTJuncPair(V, A2, B2)).toBe(false);
    expect(_rmPairHits(V, A2, B2, [0,0,0],[3.1,0,0],[1.5,2,0])).toBe(false);
  });

  test('SLIVER kendi KENAR KOMŞUSUNU reddettirmiyor', () => {
    // Bu, kaliteyi yıkan ölçülmüş hatanın kapısı: bir sliver üçgenin üçüncü
    // köşesi tanım gereği karşı kenarının üstündedir. Kenar komşuları
    // elenmezse her sliver kendi komşusunu asılı düğüm sanıyor ve
    // iyileştirici işlemler engelleniyordu — ortalama min açı 41,6° → 0,01°.
    const V = new Float64Array([
      0,0,0,  10,0,0,  5,0.001,0,     // 0,1,2 : sliver (2 neredeyse (0,1) üstünde)
      5,-3,0,                          // 3
    ]);
    // Kenar komşusu (ortak kenar 0-1) → kalkan ELEMELİ.
    expect(_rmPairHits(V, [0,1,2], [1,0,3], [0,0,0],[10,0,0],[5,0.001,0])).toBe(false);
  });

  test('kalkan ANAHTARI gerçekten kapatıyor (kapının kendisi ölçülebilir)', () => {
    const eski = VE_STR_REMESH_SHIELD;
    try {
      VE_STR_REMESH_SHIELD = false;
      const st = { V: kup().positions, T: toT(kup().indices), Tface: [], dead: {}, cell: 5, grid: null };
      expect(_rmShieldGrid(st)).toBe(null);
      VE_STR_REMESH_SHIELD = true;
      const st2 = { V: kup().positions, T: toT(kup().indices), Tface: [], dead: {}, cell: 5, grid: null };
      expect(_rmShieldGrid(st2)).not.toBe(null);
    } finally { VE_STR_REMESH_SHIELD = eski; }
  });

  test('ızgara: ekle/sil/güncelle tutarlı ve BÜYÜK üçgen kaybolmuyor', () => {
    const m = kup();
    const T = toT(m.indices);
    const g = _rmGridBuild(m.positions, T, 2);
    // Her canlı üçgen ya hücrelerde ya büyük kovada.
    T.forEach((tri, i) => expect(g.tc[i] !== undefined).toBe(true));
    _rmGridDel(g, 0);
    expect(g.tc[0]).toBe(undefined);
    _rmGridUpdate(g, m.positions, T, 0);
    expect(g.tc[0] !== undefined).toBe(true);
  });
});

