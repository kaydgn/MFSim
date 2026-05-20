/**
 * FEA Topology — birim testleri (Faz A)
 *  - Geometri-bazli face/edge/vertex listesi
 *  - 5 primitif: box / cylinder / shaft / rectTube / stl-step
 *  - Topology field'lari mesh sonrasi namedSelections ile eşleşmeli
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '../..');

eval(fs.readFileSync(path.join(ROOT, 'js/fea-topology.js'), 'utf8'));

// ────────────────────────────────────────────────────────────────────────────
describe('veFEAComputeGeometryTopology — Kutu', () => {
  test('6 yüzey, 12 kenar, 8 köşe', () => {
    var topo = veFEAComputeGeometryTopology({ type: 'box', params: { width: 50, height: 30, depth: 20 } });
    expect(topo).not.toBeNull();
    expect(topo.faces.length).toBe(6);
    expect(topo.edges.count).toBe(12);
    expect(topo.vertices.count).toBe(8);
    expect(topo.volume).toBe(30000);  // 50*30*20
    expect(topo.totalSurfaceArea).toBe(2 * (50*30 + 50*20 + 30*20));
  });

  test('Face ID\'leri namedSelections ile eşleşir', () => {
    var topo = veFEAComputeGeometryTopology({ type: 'box', params: { width: 10, height: 10, depth: 10 } });
    var ids = topo.faces.map(function(f) { return f.id; });
    expect(ids).toContain('faceXMin');
    expect(ids).toContain('faceXMax');
    expect(ids).toContain('faceYMin');
    expect(ids).toContain('faceYMax');
    expect(ids).toContain('faceZMin');
    expect(ids).toContain('faceZMax');
  });

  test('Her yüz "planar" tip + normal vektörü', () => {
    var topo = veFEAComputeGeometryTopology({ type: 'box', params: { width: 10, height: 10, depth: 10 } });
    topo.faces.forEach(function(f) {
      expect(f.type).toBe('planar');
      expect(Array.isArray(f.normal)).toBe(true);
      expect(f.normal.length).toBe(3);
    });
  });

  test('Alanlar geometriye uygun', () => {
    var topo = veFEAComputeGeometryTopology({ type: 'box', params: { width: 10, height: 20, depth: 30 } });
    var xmin = topo.faces.find(function(f) { return f.id === 'faceXMin'; });
    expect(xmin.area).toBe(20 * 30); // h * d
    var ymin = topo.faces.find(function(f) { return f.id === 'faceYMin'; });
    expect(ymin.area).toBe(10 * 30); // w * d
  });
});

// ────────────────────────────────────────────────────────────────────────────
describe('veFEAComputeGeometryTopology — Silindir', () => {
  test('3 yüzey (alt/üst disk + yan), 2 kenar', () => {
    var topo = veFEAComputeGeometryTopology({ type: 'cylinder', params: { radius: 10, height: 20 } });
    expect(topo.faces.length).toBe(3);
    expect(topo.edges.count).toBe(2);
    expect(topo.vertices.count).toBe(0);
  });

  test('Yan yüzey "cylindrical" tip, alt/üst "planar"', () => {
    var topo = veFEAComputeGeometryTopology({ type: 'cylinder', params: { radius: 10, height: 20 } });
    var side = topo.faces.find(function(f) { return f.id === 'faceSide'; });
    var top = topo.faces.find(function(f) { return f.id === 'faceTop'; });
    expect(side.type).toBe('cylindrical');
    expect(top.type).toBe('planar');
    expect(side.radius).toBe(10);
    expect(side.length).toBe(20);
  });

  test('Hacim ve toplam alan', () => {
    var topo = veFEAComputeGeometryTopology({ type: 'cylinder', params: { radius: 10, height: 20 } });
    expect(topo.volume).toBeCloseTo(Math.PI * 100 * 20, 3);
    expect(topo.totalSurfaceArea).toBeCloseTo(2 * Math.PI * 100 + 2 * Math.PI * 10 * 20, 3);
  });
});

// ────────────────────────────────────────────────────────────────────────────
describe('veFEAComputeGeometryTopology — Şaft', () => {
  test('4 yüzey (alt/üst halka + dış/iç yan), 4 daire kenar', () => {
    var topo = veFEAComputeGeometryTopology({ type: 'shaft', params: { outerRadius: 20, innerRadius: 8, length: 100 } });
    expect(topo.faces.length).toBe(4);
    expect(topo.edges.count).toBe(4);
  });

  test('İç yüzey "isHole: true" işaretli', () => {
    var topo = veFEAComputeGeometryTopology({ type: 'shaft', params: { outerRadius: 20, innerRadius: 8, length: 100 } });
    var inner = topo.faces.find(function(f) { return f.id === 'faceInner'; });
    expect(inner.isHole).toBe(true);
    expect(inner.type).toBe('cylindrical');
    expect(inner.radius).toBe(8);
  });

  test('Halka yüzeyleri "planar-annular" tip', () => {
    var topo = veFEAComputeGeometryTopology({ type: 'shaft', params: { outerRadius: 20, innerRadius: 8, length: 100 } });
    var bottom = topo.faces.find(function(f) { return f.id === 'faceBottom'; });
    expect(bottom.type).toBe('planar-annular');
    expect(bottom.outerRadius).toBe(20);
    expect(bottom.innerRadius).toBe(8);
  });
});

// ────────────────────────────────────────────────────────────────────────────
describe('veFEAComputeGeometryTopology — Küre', () => {
  test('1 yüzey (Küresel Yüzey), 0 kenar, 0 köşe', () => {
    var topo = veFEAComputeGeometryTopology({ type: 'sphere', params: { radius: 25 } });
    expect(topo.faces.length).toBe(1);
    expect(topo.edges.count).toBe(0);
    expect(topo.vertices.count).toBe(0);
    expect(topo.faces[0].id).toBe('faceSurface');
    expect(topo.faces[0].type).toBe('spherical');
    expect(topo.faces[0].radius).toBe(25);
  });

  test('Hacim ve yüzey alanı analitik (4πr², 4/3πr³)', () => {
    var topo = veFEAComputeGeometryTopology({ type: 'sphere', params: { radius: 10 } });
    expect(topo.totalSurfaceArea).toBeCloseTo(4 * Math.PI * 100, 3);
    expect(topo.volume).toBeCloseTo((4 / 3) * Math.PI * 1000, 3);
  });

  test('"spherical" tipi etiketi: Küresel', () => {
    expect(veFEATopologyFaceTypeLabel('spherical')).toBe('Küresel');
  });
});

// ────────────────────────────────────────────────────────────────────────────
describe('veFEAComputeGeometryTopology — Torus', () => {
  test('1 face (toroidal), 0 kenar, 0 köşe (closed manifold)', () => {
    var topo = veFEAComputeGeometryTopology({ type: 'torus', params: { majorRadius: 30, minorRadius: 10 } });
    expect(topo.faces.length).toBe(1);
    expect(topo.edges.count).toBe(0);
    expect(topo.vertices.count).toBe(0);
    expect(topo.faces[0].type).toBe('toroidal');
    expect(topo.faces[0].majorRadius).toBe(30);
    expect(topo.faces[0].minorRadius).toBe(10);
  });

  test('Hacim = 2π²Rr², yüzey = 4π²Rr (Pappus)', () => {
    var R = 30, r = 10;
    var topo = veFEAComputeGeometryTopology({ type: 'torus', params: { majorRadius: R, minorRadius: r } });
    expect(topo.volume).toBeCloseTo(2 * Math.PI * Math.PI * R * r * r, 1);
    expect(topo.totalSurfaceArea).toBeCloseTo(4 * Math.PI * Math.PI * R * r, 1);
  });

  test('"toroidal" tipi etiketi: Toroidal (Halka)', () => {
    expect(veFEATopologyFaceTypeLabel('toroidal')).toBe('Toroidal (Halka)');
  });
});

// ────────────────────────────────────────────────────────────────────────────
describe('veFEAComputeGeometryTopology — Yarım Küre', () => {
  test('2 face (faceFlat + faceDome), 1 daire kenar (equator)', () => {
    var topo = veFEAComputeGeometryTopology({ type: 'hemisphere', params: { radius: 25 } });
    expect(topo.faces.length).toBe(2);
    expect(topo.edges.count).toBe(1);
    var ids = topo.faces.map(function(f) { return f.id; });
    expect(ids).toContain('faceFlat');
    expect(ids).toContain('faceDome');
  });

  test('Dome alanı = 2πr², flat = πr², hacim = (2/3)πr³', () => {
    var r = 25;
    var topo = veFEAComputeGeometryTopology({ type: 'hemisphere', params: { radius: r } });
    var dome = topo.faces.find(function(f) { return f.id === 'faceDome'; });
    var flat = topo.faces.find(function(f) { return f.id === 'faceFlat'; });
    expect(dome.area).toBeCloseTo(2 * Math.PI * r * r, 3);
    expect(flat.area).toBeCloseTo(Math.PI * r * r, 3);
    expect(topo.volume).toBeCloseTo((2 / 3) * Math.PI * r * r * r, 3);
  });
});

// ────────────────────────────────────────────────────────────────────────────
describe('veFEAComputeGeometryTopology — Koni / Frustum', () => {
  test('Frustum (rT > 0): 3 yüzey (alt + üst + conical yan), 2 kenar', () => {
    var topo = veFEAComputeGeometryTopology({ type: 'cone', params: { bottomRadius: 20, topRadius: 8, height: 60 } });
    expect(topo.faces.length).toBe(3);
    expect(topo.edges.count).toBe(2);
    expect(topo.vertices.count).toBe(0);
    var ids = topo.faces.map(function(f) { return f.id; });
    expect(ids).toContain('faceBottom');
    expect(ids).toContain('faceTop');
    expect(ids).toContain('faceSide');
  });

  test('Apex (rT=0): 2 yüzey (alt + conical yan), 1 kenar, 1 vertex', () => {
    var topo = veFEAComputeGeometryTopology({ type: 'cone', params: { bottomRadius: 20, topRadius: 0, height: 60 } });
    expect(topo.faces.length).toBe(2);
    expect(topo.edges.count).toBe(1);
    expect(topo.vertices.count).toBe(1);
  });

  test('Yan yüzey "conical" tipi + slant length', () => {
    var topo = veFEAComputeGeometryTopology({ type: 'cone', params: { bottomRadius: 20, topRadius: 8, height: 60 } });
    var side = topo.faces.find(function(f) { return f.id === 'faceSide'; });
    expect(side.type).toBe('conical');
    expect(side.bottomRadius).toBe(20);
    expect(side.topRadius).toBe(8);
    var expectedSlant = Math.sqrt(60 * 60 + 12 * 12);
    expect(side.slant).toBeCloseTo(expectedSlant, 4);
  });

  test('Frustum hacim = (1/3)πh(rB²+rB·rT+rT²)', () => {
    var topo = veFEAComputeGeometryTopology({ type: 'cone', params: { bottomRadius: 20, topRadius: 8, height: 60 } });
    var analytic = (Math.PI * 60 / 3) * (400 + 160 + 64);
    expect(topo.volume).toBeCloseTo(analytic, 2);
  });

  test('"conical" tipi etiketi: Konik (Eğri)', () => {
    expect(veFEATopologyFaceTypeLabel('conical')).toBe('Konik (Eğri)');
  });
});

// ────────────────────────────────────────────────────────────────────────────
describe('veFEAComputeGeometryTopology — L-Profil (lbracket)', () => {
  test('8 face (2 kesit + 6 yan yüzey)', () => {
    var topo = veFEAComputeGeometryTopology({ type: 'lbracket', params: { width: 60, height: 40, thickness: 5, length: 100 } });
    expect(topo.faces.length).toBe(8);
  });

  test('Tüm yüzeyler planar', () => {
    var topo = veFEAComputeGeometryTopology({ type: 'lbracket', params: { width: 60, height: 40, thickness: 5, length: 100 } });
    topo.faces.forEach(function(f) { expect(f.type).toBe('planar'); });
  });

  test('Hacim = t·(w+h-t)·L', () => {
    var topo = veFEAComputeGeometryTopology({ type: 'lbracket', params: { width: 60, height: 40, thickness: 5, length: 100 } });
    expect(topo.volume).toBeCloseTo(5 * (60 + 40 - 5) * 100, 0);
  });
});

// ────────────────────────────────────────────────────────────────────────────
describe('veFEAComputeGeometryTopology — I-Profil (ibeam)', () => {
  test('10 face (2 kesit + 8 yan yüzey)', () => {
    var topo = veFEAComputeGeometryTopology({ type: 'ibeam', params: { width: 80, height: 120, flange: 8, web: 6, length: 200 } });
    expect(topo.faces.length).toBe(10);
  });

  test('Tüm yüzeyler planar', () => {
    var topo = veFEAComputeGeometryTopology({ type: 'ibeam', params: { width: 80, height: 120, flange: 8, web: 6, length: 200 } });
    topo.faces.forEach(function(f) { expect(f.type).toBe('planar'); });
  });

  test('Hacim = (2·w·tf + tw·(h-2·tf))·L', () => {
    var topo = veFEAComputeGeometryTopology({ type: 'ibeam', params: { width: 80, height: 120, flange: 8, web: 6, length: 200 } });
    var expected = (2 * 80 * 8 + 6 * (120 - 16)) * 200;
    expect(topo.volume).toBeCloseTo(expected, 0);
  });
});

// ────────────────────────────────────────────────────────────────────────────
describe('veFEAComputeGeometryTopology — Dikdörtgen profil (rectTube)', () => {
  test('10 yüzey (2 kesit + 4 dış + 4 iç)', () => {
    var topo = veFEAComputeGeometryTopology({ type: 'rectTube', params: { width: 60, height: 40, thickness: 5, length: 200 } });
    expect(topo.faces.length).toBe(10);
  });

  test('İç yüzeyler isHole işaretli', () => {
    var topo = veFEAComputeGeometryTopology({ type: 'rectTube', params: { width: 60, height: 40, thickness: 5, length: 200 } });
    var inners = topo.faces.filter(function(f) { return f.isHole; });
    expect(inners.length).toBe(4);
  });
});

// ────────────────────────────────────────────────────────────────────────────
describe('veFEAComputeGeometryTopology — STEP', () => {
  test('STEP: tek "Yüzey" face (detectedFeatures yoksa fallback)', () => {
    var topo = veFEAComputeGeometryTopology({ type: 'step', triangleCount: 12, surfaceArea: 600, volume: 1000 });
    expect(topo.faces.length).toBe(1);
    expect(topo.faces[0].type).toBe('triangulated');
    expect(topo.faces[0].triangleCount).toBe(12);
  });

  test('STEP: geom.surfaceArea face.area\'ya taşınır', () => {
    var topo = veFEAComputeGeometryTopology({ type: 'step', triangleCount: 50, surfaceArea: 1200 });
    expect(topo.faces[0].area).toBe(1200);
  });
});

// ────────────────────────────────────────────────────────────────────────────
describe('veFEATopologyFaceTypeLabel', () => {
  test('Bilinen tipler için Türkçe etiket', () => {
    expect(veFEATopologyFaceTypeLabel('planar')).toBe('Düzlemsel');
    expect(veFEATopologyFaceTypeLabel('cylindrical')).toBe('Silindirik');
    expect(veFEATopologyFaceTypeLabel('planar-annular')).toBe('Halka (Düzlem)');
    expect(veFEATopologyFaceTypeLabel('triangulated')).toBe('Üçgenlenmiş');
  });

  test('Bilinmeyen tip için tipin kendisi', () => {
    expect(veFEATopologyFaceTypeLabel('weird-type')).toBe('weird-type');
  });
});

// ────────────────────────────────────────────────────────────────────────────
describe('Otomotiv bağlantı elemanları (washer / nut / bolt / plate)', () => {
  test('Pul: 3-4 yüzey (delikli ise iç silindir +1), 2-4 kenar', () => {
    var t = veFEAComputeGeometryTopology({ type: 'washer', params: { outerRadius: 12, innerRadius: 5, thickness: 1.5, segments: 48 }});
    expect(t).not.toBeNull();
    expect(t.faces.length).toBe(4);   // top + bottom + outer + inner
    expect(t.edges.count).toBe(4);    // 4 circles
    expect(t.vertices.count).toBe(0);
    expect(t.faces.find(f => f.id === 'faceInner').isHole).toBe(true);
    expect(t.bbox).toEqual({ x: 24, y: 1.5, z: 24 });
  });

  test('Pul deliksiz (rIn=0): sadece 3 yüzey', () => {
    var t = veFEAComputeGeometryTopology({ type: 'washer', params: { outerRadius: 10, innerRadius: 0, thickness: 2, segments: 32 }});
    expect(t.faces.length).toBe(3);
    expect(t.edges.count).toBe(2);
  });

  test('Somun: 9 yüzey (2 hex-annular + 6 yan + 1 iç silindir), 20 kenar, 12 köşe', () => {
    var t = veFEAComputeGeometryTopology({ type: 'nut', params: { width: 13, thickness: 6.5, holeDiameter: 8 }});
    expect(t.faces.length).toBe(9);
    expect(t.faces[0].id).toBe('faceTop');
    expect(t.faces[1].id).toBe('faceBottom');
    expect(t.faces.filter(f => f.id.startsWith('faceSide')).length).toBe(6);
    expect(t.faces.find(f => f.id === 'faceInner').isHole).toBe(true);
    expect(t.edges.count).toBe(20);   // 12 hex + 6 vertical + 2 inner circles
    expect(t.vertices.count).toBe(12);
  });

  test('Cıvata: 10 yüzey (head top + head bottom + 6 head side + shaft side + shaft bottom)', () => {
    var t = veFEAComputeGeometryTopology({ type: 'bolt', params: { headWidth: 13, headHeight: 5.5, shaftDiameter: 8, shaftLength: 30 }});
    expect(t.faces.length).toBe(10);
    expect(t.faces.find(f => f.id === 'faceHeadTop').type).toBe('planar');
    expect(t.faces.find(f => f.id === 'faceHeadBottom').type).toBe('planar-annular');
    expect(t.faces.find(f => f.id === 'faceShaftSide').type).toBe('cylindrical');
    expect(t.faces.find(f => f.id === 'faceShaftBottom').type).toBe('planar');
    expect(t.bbox.y).toBe(5.5 + 30);
  });

  test('Delikli Levha 2×2: 6 + 4 = 10 yüzey, her delik için cylindrical face', () => {
    var t = veFEAComputeGeometryTopology({ type: 'plate', params: {
      length: 120, width: 80, thickness: 8, holeDiameter: 9, cols: 2, rows: 2, margin: 15
    }});
    // 2 top/bottom + 4 yan + 4 hole = 10 yüzey
    expect(t.faces.length).toBe(10);
    expect(t.faces.filter(f => f.id.startsWith('faceHole_')).length).toBe(4);
    expect(t.edges.count).toBe(12 + 2 * 4);  // 12 plate + 2 per hole
    expect(t.vertices.count).toBe(8);
    expect(t.bbox).toEqual({ x: 120, y: 8, z: 80 });
  });

  test('Delikli Levha 1×1 (tek delik) ve deliksiz (cols=0 değil, ama hole çapı=0)', () => {
    var t1 = veFEAComputeGeometryTopology({ type: 'plate', params: {
      length: 60, width: 60, thickness: 5, holeDiameter: 8, cols: 1, rows: 1, margin: 10
    }});
    expect(t1.faces.length).toBe(6 + 1);  // tek delik
  });
});

// ────────────────────────────────────────────────────────────────────────────
describe('veFEAComputeGeometryTopology — Geçersiz girdi', () => {
  test('null/undefined → null', () => {
    expect(veFEAComputeGeometryTopology(null)).toBeNull();
    expect(veFEAComputeGeometryTopology(undefined)).toBeNull();
    expect(veFEAComputeGeometryTopology({})).toBeNull();
  });

  test('Bilinmeyen geometri tipi → generic fallback (minimal topology)', () => {
    // Önceden null dönerdi; şimdi _veFEAToplGeneric fallback minimal data döner.
    // THREE/builder yoksa _veFEAToplGenericMinimal: tek "triangulated" face,
    // sıfır edge/vertex. generic flag UI'da "otomatik tespit" notu için.
    var result = veFEAComputeGeometryTopology({ type: 'unknown' });
    expect(result).not.toBeNull();
    expect(result.generic).toBe(true);
    expect(Array.isArray(result.faces)).toBe(true);
    expect(result.faces.length).toBeGreaterThanOrEqual(1);
  });

  test('null/undefined girdi → yine null', () => {
    expect(veFEAComputeGeometryTopology(null)).toBeNull();
    expect(veFEAComputeGeometryTopology(undefined)).toBeNull();
    expect(veFEAComputeGeometryTopology({})).toBeNull(); // type yok
  });
});

// ────────────────────────────────────────────────────────────────────────────
// Mesh sonrası NamedSelections ile entegrasyon — topology face ID'leri mesh
// namedSelections key'leriyle eşleşmeli (BC node bunu kullanacak)
describe('Topology ↔ namedSelections face ID uyumu', () => {
  test('Kutu: topology faces ile namedSelections key\'leri aynı', () => {
    // fea-mesh.js'i yüklemeden namedSelections gen fn çağrılamaz; sadece
    // topology face ID'lerinin bilinen pattern'le örüştüğünü kontrol ederiz.
    var topo = veFEAComputeGeometryTopology({ type: 'box', params: { width: 10, height: 10, depth: 10 } });
    var expected = ['faceXMin', 'faceXMax', 'faceYMin', 'faceYMax', 'faceZMin', 'faceZMax'];
    var ids = topo.faces.map(function(f) { return f.id; }).sort();
    expect(ids).toEqual(expected.sort());
  });

  test('Şaft: topology faces ile namedSelections key\'leri aynı', () => {
    var topo = veFEAComputeGeometryTopology({ type: 'shaft', params: { outerRadius: 20, innerRadius: 8, length: 100 } });
    var expected = ['faceBottom', 'faceTop', 'faceOuter', 'faceInner'];
    var ids = topo.faces.map(function(f) { return f.id; }).sort();
    expect(ids).toEqual(expected.sort());
  });
});
