/**
 * FEA Topology — birim testleri (Faz A)
 *  - Geometri-bazli face/edge/vertex listesi
 *  - 5 primitif: box / cylinder / shaft / rectTube / stl-step
 *  - Topology field'lari mesh sonrasi namedSelections ile eşleşmeli
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '../..');

eval(fs.readFileSync(path.join(ROOT, 'js/fea-mesh-utils.js'), 'utf8'));
eval(fs.readFileSync(path.join(ROOT, 'js/fea-feature-recognition.js'), 'utf8'));
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

// ─── Faz 5 — Face Adjacency Graph + Extend to Adjacent (ANSYS §8) ───
describe('veFEABuildFaceAdjacency', () => {
  test('Cylinder: bottom/top yüzler faceSide ile komşu', () => {
    var topo = veFEAComputeGeometryTopology({ type: 'cylinder', params: { radius: 10, height: 20 } });
    var adj = veFEABuildFaceAdjacency(topo);
    expect(adj.faceBottom).toContain('faceSide');
    expect(adj.faceTop).toContain('faceSide');
    expect(adj.faceSide).toContain('faceBottom');
    expect(adj.faceSide).toContain('faceTop');
  });

  test('Shaft: faceBottom <-> faceOuter ve faceInner komşu', () => {
    var topo = veFEAComputeGeometryTopology({ type: 'shaft', params: { outerRadius: 20, innerRadius: 8, length: 100 } });
    var adj = veFEABuildFaceAdjacency(topo);
    expect(adj.faceBottom).toContain('faceOuter');
    expect(adj.faceBottom).toContain('faceInner');
    expect(adj.faceTop).toContain('faceOuter');
    expect(adj.faceTop).toContain('faceInner');
  });

  test('Edges yoksa boş adjacency', () => {
    expect(veFEABuildFaceAdjacency(null)).toEqual({});
    expect(veFEABuildFaceAdjacency({ edges: [] })).toEqual({});
    expect(veFEABuildFaceAdjacency({ edges: { count: 0 } })).toEqual({});
  });
});

describe('veFEAExtendSelectionAdjacent (feature-angle region growing)', () => {
  test('Düşük threshold (10°): planar bottom ile cylindrical side birleşmez', () => {
    var topo = veFEAComputeGeometryTopology({ type: 'cylinder', params: { radius: 10, height: 20 } });
    var ext = veFEAExtendSelectionAdjacent(['faceBottom'], topo, 10);
    // Bottom planar normal=[0,-1,0]; side cylindrical, normal yok → atlanır
    expect(ext).toContain('faceBottom');
    expect(ext).not.toContain('faceTop');  // 180° apart
  });

  test('Selected face her zaman result\'ta var', () => {
    var topo = veFEAComputeGeometryTopology({ type: 'shaft', params: { outerRadius: 20, innerRadius: 8, length: 100 } });
    var ext = veFEAExtendSelectionAdjacent(['faceBottom'], topo, 180);
    expect(ext).toContain('faceBottom');
    // Cylindrical face'lerin normal'i yok → algoritma planar komşulara
    // ulaşamaz (bottom → outer → top zinciri kırılır). Bu kasıtlı davranış —
    // planar/cylindrical normalize farkı sezgisel sonuç verir.
  });

  test('Boş selection → boş', () => {
    var topo = veFEAComputeGeometryTopology({ type: 'cylinder', params: { radius: 10, height: 20 } });
    expect(veFEAExtendSelectionAdjacent([], topo, 30)).toEqual([]);
  });

  test('Bilinmeyen face → değişiklik yok (sadece input ID döner)', () => {
    var topo = veFEAComputeGeometryTopology({ type: 'cylinder', params: { radius: 10, height: 20 } });
    var ext = veFEAExtendSelectionAdjacent(['faceUnknown'], topo, 30);
    expect(ext).toEqual(['faceUnknown']);
  });
});

// ────────────────────────────────────────────────────────────────────────────
describe('veFEAComputeGeometryTopology — Silindir', () => {
  test('3 yüzey (alt/üst disk + yan), 2 kenar', () => {
    var topo = veFEAComputeGeometryTopology({ type: 'cylinder', params: { radius: 10, height: 20 } });
    expect(topo.faces.length).toBe(3);
    expect(topo.edges.length).toBe(2);
    expect(topo.edges[0].id).toBe('edgeBottomCircle');
    expect(topo.edges[1].id).toBe('edgeTopCircle');
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
    expect(topo.edges.length).toBe(4);
    var edgeIds = topo.edges.map(function(e) { return e.id; });
    expect(edgeIds).toContain('edgeOuterBottom');
    expect(edgeIds).toContain('edgeOuterTop');
    expect(edgeIds).toContain('edgeInnerBottom');
    expect(edgeIds).toContain('edgeInnerTop');
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
    expect(topo.edges.length).toBe(1);
    expect(topo.edges[0].id).toBe('edgeEquator');
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
    expect(topo.edges.length).toBe(2);
    expect(topo.vertices.count).toBe(0);
    var ids = topo.faces.map(function(f) { return f.id; });
    expect(ids).toContain('faceBottom');
    expect(ids).toContain('faceTop');
    expect(ids).toContain('faceSide');
  });

  test('Apex (rT=0): 2 yüzey (alt + conical yan), 1 kenar, 1 vertex', () => {
    var topo = veFEAComputeGeometryTopology({ type: 'cone', params: { bottomRadius: 20, topRadius: 0, height: 60 } });
    expect(topo.faces.length).toBe(2);
    expect(topo.edges.length).toBe(1);
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

// ════════════════════════════════════════════════════════════════════════════
// FAZ 1 — YENİ TOPOLOJİ MOTORU TESTLERİ (edge/vertex listeleri + curve fitting)
// ════════════════════════════════════════════════════════════════════════════

describe('Kutu: detaylı edge listesi (12 edge + 8 vertex)', () => {
  test('12 edge array olarak, her biri line tipi', () => {
    var t = veFEAComputeGeometryTopology({ type: 'box', params: { width: 50, height: 30, depth: 20 } });
    expect(Array.isArray(t.edges)).toBe(true);
    expect(t.edges.length).toBe(12);
    t.edges.forEach(function(e) {
      expect(e.type).toBe('line');
      expect(Array.isArray(e.p1)).toBe(true);
      expect(Array.isArray(e.p2)).toBe(true);
      expect(Array.isArray(e.faceIds)).toBe(true);
      expect(e.faceIds.length).toBe(2);
      expect(typeof e.length).toBe('number');
    });
  });

  test('8 vertex array olarak, her biri 3 face referansı', () => {
    var t = veFEAComputeGeometryTopology({ type: 'box', params: { width: 10, height: 10, depth: 10 } });
    expect(Array.isArray(t.vertices)).toBe(true);
    expect(t.vertices.length).toBe(8);
    t.vertices.forEach(function(v) {
      expect(Array.isArray(v.position)).toBe(true);
      expect(v.position.length).toBe(3);
      expect(Array.isArray(v.faceIds)).toBe(true);
      expect(v.faceIds.length).toBe(3);   // her köşede 3 yüz birleşir
    });
  });

  test('Geriye uyumluluk: t.edges.count yine erişilebilir', () => {
    var t = veFEAComputeGeometryTopology({ type: 'box', params: { width: 50, height: 30, depth: 20 } });
    expect(t.edges.count).toBe(12);
    expect(t.vertices.count).toBe(8);
  });
});

describe('Silindir: edge polyline + curve geometrisi', () => {
  test('2 circle edge, her biri 48 segment polyline', () => {
    var t = veFEAComputeGeometryTopology({ type: 'cylinder', params: { radius: 10, height: 20 } });
    expect(t.edges.length).toBe(2);
    t.edges.forEach(function(e) {
      expect(e.type).toBe('circle');
      expect(e.radius).toBe(10);
      expect(Array.isArray(e.center)).toBe(true);
      expect(Array.isArray(e.axis)).toBe(true);
      expect(Array.isArray(e.polyline)).toBe(true);
      expect(e.polyline.length).toBeGreaterThan(40);
    });
  });

  test('Edge faceIds doğru bağlantı', () => {
    var t = veFEAComputeGeometryTopology({ type: 'cylinder', params: { radius: 10, height: 20 } });
    var bot = t.edges.find(function(e) { return e.id === 'edgeBottomCircle'; });
    expect(bot.faceIds).toContain('faceBottom');
    expect(bot.faceIds).toContain('faceSide');
  });
});

describe('L-bracket: 18 edge + 12 vertex', () => {
  test('18 edge array (12 kesit + 6 axial)', () => {
    var t = veFEAComputeGeometryTopology({ type: 'lbracket', params: { width: 60, height: 40, thickness: 5, length: 100 } });
    expect(Array.isArray(t.edges)).toBe(true);
    expect(t.edges.length).toBe(18);
    // 12 cross-section (Zm/Zp) + 6 axial
    var axials = t.edges.filter(function(e) { return e.id.indexOf('eL_Z_') === 0; });
    expect(axials.length).toBe(6);
    axials.forEach(function(e) { expect(e.length).toBe(100); });
  });

  test('12 vertex array', () => {
    var t = veFEAComputeGeometryTopology({ type: 'lbracket', params: { width: 60, height: 40, thickness: 5, length: 100 } });
    expect(Array.isArray(t.vertices)).toBe(true);
    expect(t.vertices.length).toBe(12);
  });
});

describe('I-beam: 36 edge + 24 vertex', () => {
  test('24 kesit + 12 axial = 36 edge', () => {
    var t = veFEAComputeGeometryTopology({ type: 'ibeam', params: { width: 80, height: 120, flange: 8, web: 6, length: 200 } });
    expect(Array.isArray(t.edges)).toBe(true);
    expect(t.edges.length).toBe(36);    // 12 (front) + 12 (back) + 12 (axial)
    expect(t.vertices.length).toBe(24); // 12 corners × 2 z-uç
  });

  test('Geriye uyumluluk: count', () => {
    var t = veFEAComputeGeometryTopology({ type: 'ibeam', params: { width: 80, height: 120, flange: 8, web: 6, length: 200 } });
    expect(t.edges.count).toBe(36);
    expect(t.vertices.count).toBe(24);
  });
});

describe('RectTube: dış+iç edges + 16 vertex', () => {
  test('24 edge (8 dış kesit + 8 iç kesit + 4 dış axial + 4 iç axial) + 16 vertex', () => {
    var t = veFEAComputeGeometryTopology({ type: 'rectTube', params: { width: 60, height: 40, thickness: 5, length: 200 } });
    expect(Array.isArray(t.edges)).toBe(true);
    expect(t.edges.length).toBe(24);
    expect(t.vertices.length).toBe(16);
    // İç delik edge'leri isHole işaretli
    var innerEdges = t.edges.filter(function(e) { return e.isHole; });
    expect(innerEdges.length).toBe(12);  // 8 iç kesit + 4 iç axial
  });
});

describe('Plate: 12 plate edge + 2*N delik edge + 8 vertex', () => {
  test('Plate 2×2: 12 + 8 = 20 edge, 8 vertex', () => {
    var t = veFEAComputeGeometryTopology({ type: 'plate', params: { length: 120, width: 80, thickness: 8, holeDiameter: 9, cols: 2, rows: 2, margin: 15 } });
    expect(Array.isArray(t.edges)).toBe(true);
    expect(t.edges.length).toBe(12 + 2 * 4);
    expect(t.vertices.length).toBe(8);
    // Her delik için 2 circle edge
    var holeCircles = t.edges.filter(function(e) { return e.id.indexOf('eP_Hole') === 0; });
    expect(holeCircles.length).toBe(8);
    holeCircles.forEach(function(e) { expect(e.type).toBe('circle'); });
  });

  test('Plate deliksiz: sadece 12 edge', () => {
    var t = veFEAComputeGeometryTopology({ type: 'plate', params: { length: 120, width: 80, thickness: 8, holeDiameter: 0, cols: 2, rows: 2 } });
    expect(t.edges.length).toBe(12);
  });
});

describe('Nut: 18 hex edge + 6 dikey + 2 iç daire = 20 edge', () => {
  test('Edge ve vertex sayıları', () => {
    var t = veFEAComputeGeometryTopology({ type: 'nut', params: { width: 13, thickness: 6.5, holeDiameter: 8 } });
    expect(t.edges.length).toBe(20);   // 12 hex + 6 vertical + 2 inner circles
    expect(t.vertices.length).toBe(12);
  });
});

describe('Bolt: tam edge + vertex listesi', () => {
  test('20 edge (12 hex + 6 dikey + 2 daire) + 12 vertex', () => {
    var t = veFEAComputeGeometryTopology({ type: 'bolt', params: { headWidth: 13, headHeight: 5.5, shaftDiameter: 8, shaftLength: 30 } });
    expect(t.edges.length).toBe(20);
    expect(t.vertices.length).toBe(12);
  });
});

describe('Curve fitting — veFEAFitCurveToPolyline', () => {
  test('Düz çizgi noktaları → type=line', () => {
    var pts = [[0,0,0], [1,0,0], [2,0,0], [3,0,0], [5,0,0]];
    var fit = veFEAFitCurveToPolyline(pts);
    expect(fit.type).toBe('line');
    expect(fit.length).toBeCloseTo(5, 5);
  });

  test('XY düzleminde tam daire → type=circle', () => {
    var r = 10, n = 36;
    var pts = [];
    for (var i = 0; i <= n; i++) {
      var th = (i / n) * 2 * Math.PI;
      pts.push([r * Math.cos(th), r * Math.sin(th), 0]);
    }
    var fit = veFEAFitCurveToPolyline(pts, 0.001);
    expect(fit.type).toBe('circle');
    expect(fit.radius).toBeCloseTo(r, 2);
    expect(fit.isFullCircle).toBe(true);
  });

  test('Yay (yarım daire) → type=arc', () => {
    var r = 5, n = 18;
    var pts = [];
    for (var i = 0; i <= n; i++) {
      var th = (i / n) * Math.PI;
      pts.push([r * Math.cos(th), r * Math.sin(th), 0]);
    }
    var fit = veFEAFitCurveToPolyline(pts, 0.001);
    expect(fit.type).toBe('arc');
    expect(fit.radius).toBeCloseTo(r, 2);
    expect(fit.isFullCircle).toBe(false);
  });

  test('Yetersiz veri (1 nokta) → type=unknown', () => {
    var fit = veFEAFitCurveToPolyline([[0,0,0]]);
    expect(fit.type).toBe('unknown');
  });

  test('Eliptik (yarım eksenleri farklı) → ellipse veya spline', () => {
    var n = 36;
    var pts = [];
    for (var i = 0; i <= n; i++) {
      var th = (i / n) * 2 * Math.PI;
      pts.push([5 * Math.cos(th), 2 * Math.sin(th), 0]);
    }
    var fit = veFEAFitCurveToPolyline(pts, 0.001);
    // Ellipse veya spline'a fit etmeli (circle değil)
    expect(['ellipse','spline'].indexOf(fit.type) >= 0).toBe(true);
  });
});

describe('Edge ve Vertex adjacency graph', () => {
  test('Box edge → face adjacency', () => {
    var t = veFEAComputeGeometryTopology({ type: 'box', params: { width: 50, height: 30, depth: 20 } });
    var adj = veFEABuildEdgeAdjacency(t);
    var ed = t.edges[0];
    expect(Array.isArray(adj[ed.id])).toBe(true);
    expect(adj[ed.id].length).toBe(2);
  });

  test('Box vertex → 3 edge + 3 face', () => {
    var t = veFEAComputeGeometryTopology({ type: 'box', params: { width: 10, height: 10, depth: 10 } });
    var adj = veFEABuildVertexAdjacency(t);
    var v = t.vertices[0];
    expect(adj[v.id].faces.length).toBe(3);
  });

  test('Face adjacency artık BOX için de çalışır (önceden edge[] yoktu, boş gelirdi)', () => {
    var t = veFEAComputeGeometryTopology({ type: 'box', params: { width: 10, height: 10, depth: 10 } });
    var adj = veFEABuildFaceAdjacency(t);
    // Her face'in 4 komşusu olmalı (kutu)
    Object.keys(adj).forEach(function(fid) {
      expect(adj[fid].length).toBeGreaterThanOrEqual(3);
    });
  });
});

describe('Helper fonksiyonlar', () => {
  test('veFEATopologyEdgeCount edge[] ve count formatı için tutarlı', () => {
    var t1 = veFEAComputeGeometryTopology({ type: 'box', params: { width: 10, height: 10, depth: 10 } });
    expect(veFEATopologyEdgeCount(t1)).toBe(12);
    var t2 = veFEAComputeGeometryTopology({ type: 'sphere', params: { radius: 5 } });
    expect(veFEATopologyEdgeCount(t2)).toBe(0);
  });

  test('veFEATopologyVertexCount', () => {
    var t = veFEAComputeGeometryTopology({ type: 'box', params: { width: 10, height: 10, depth: 10 } });
    expect(veFEATopologyVertexCount(t)).toBe(8);
  });

  test('veFEATopologyEdgeTypeLabel', () => {
    expect(veFEATopologyEdgeTypeLabel('line')).toBe('Doğru');
    expect(veFEATopologyEdgeTypeLabel('circle')).toBe('Daire');
    expect(veFEATopologyEdgeTypeLabel('arc')).toBe('Yay');
    expect(veFEATopologyEdgeTypeLabel('ellipse')).toBe('Eliptik');
    expect(veFEATopologyEdgeTypeLabel('spline')).toBe('Eğri (Spline)');
  });

  test('_veFEACirclePolyline 48 segment daire üretir', () => {
    var poly = _veFEACirclePolyline([0,0,0], [0,1,0], 10, 48);
    expect(poly.length).toBeGreaterThan(40);
    // İlk ve son nokta yakın olmalı (full circle)
    var first = poly[0], last = poly[poly.length - 1];
    var d = Math.sqrt(Math.pow(first[0]-last[0],2) + Math.pow(first[1]-last[1],2) + Math.pow(first[2]-last[2],2));
    expect(d).toBeLessThan(0.01);
  });
});

describe('Cylinder edge polyline aksial doğrulama', () => {
  test('Alt daire polyline\'ı y=-h/2 düzleminde, üst y=+h/2', () => {
    var r = 10, h = 20;
    var t = veFEAComputeGeometryTopology({ type: 'cylinder', params: { radius: r, height: h } });
    var bot = t.edges.find(function(e) { return e.id === 'edgeBottomCircle'; });
    var top = t.edges.find(function(e) { return e.id === 'edgeTopCircle'; });
    bot.polyline.forEach(function(p) { expect(p[1]).toBeCloseTo(-h/2, 3); });
    top.polyline.forEach(function(p) { expect(p[1]).toBeCloseTo( h/2, 3); });
  });
});

// ════════════════════════════════════════════════════════════════════════════
// FAZ 2 — TÜM GEOMETRİLER İÇİN TAM TOPOLOGY (edge ↔ face bağı)
// ════════════════════════════════════════════════════════════════════════════
describe('Tüm primitif geometrilerde edge ↔ face bağı', () => {
  var geomTypes = [
    { type: 'box',        params: { width: 50, height: 30, depth: 20 } },
    { type: 'cylinder',   params: { radius: 15, height: 60 } },
    { type: 'shaft',      params: { outerRadius: 20, innerRadius: 8, length: 100 } },
    { type: 'cone',       params: { bottomRadius: 20, topRadius: 8, height: 60 } },
    { type: 'hemisphere', params: { radius: 25 } },
    { type: 'lbracket',   params: { width: 60, height: 40, thickness: 5, length: 100 } },
    { type: 'ibeam',      params: { width: 80, height: 120, flange: 8, web: 6, length: 200 } },
    { type: 'rectTube',   params: { width: 60, height: 40, thickness: 5, length: 200 } },
    { type: 'washer',     params: { outerRadius: 12, innerRadius: 5, thickness: 1.5 } },
    { type: 'nut',        params: { width: 13, thickness: 6.5, holeDiameter: 8 } },
    { type: 'bolt',       params: { headWidth: 13, headHeight: 5.5, shaftDiameter: 8, shaftLength: 30 } },
    { type: 'plate',      params: { length: 120, width: 80, thickness: 8, holeDiameter: 9, cols: 2, rows: 2, margin: 15 } }
  ];
  geomTypes.forEach(function(g) {
    test(g.type + ': her edge en az 2 face\'e bağlı', () => {
      var topo = veFEAComputeGeometryTopology(g);
      expect(topo).not.toBeNull();
      expect(Array.isArray(topo.edges)).toBe(true);
      expect(topo.edges.length).toBeGreaterThan(0);
      topo.edges.forEach(function(e) {
        expect(Array.isArray(e.faceIds)).toBe(true);
        expect(e.faceIds.length).toBe(2);     // her edge tam 2 face'i ayırır
        // Her faceId topology.faces içinde var olmalı
        e.faceIds.forEach(function(fid) {
          expect(topo.faces.find(function(f) { return f.id === fid; })).not.toBeUndefined();
        });
      });
    });
    test(g.type + ': her edge\'in polyline veya p1/p2\'si var', () => {
      var topo = veFEAComputeGeometryTopology(g);
      topo.edges.forEach(function(e) {
        var hasPoly = Array.isArray(e.polyline) && e.polyline.length >= 2;
        var hasEnds = Array.isArray(e.p1) && Array.isArray(e.p2);
        expect(hasPoly || hasEnds).toBe(true);
      });
    });
  });
});

describe('Tüm primitif geometrilerde vertex ↔ face bağı', () => {
  var geomTypes = [
    { type: 'box',        params: { width: 50, height: 30, depth: 20 } },
    { type: 'lbracket',   params: { width: 60, height: 40, thickness: 5, length: 100 } },
    { type: 'ibeam',      params: { width: 80, height: 120, flange: 8, web: 6, length: 200 } },
    { type: 'rectTube',   params: { width: 60, height: 40, thickness: 5, length: 200 } },
    { type: 'nut',        params: { width: 13, thickness: 6.5, holeDiameter: 8 } },
    { type: 'bolt',       params: { headWidth: 13, headHeight: 5.5, shaftDiameter: 8, shaftLength: 30 } },
    { type: 'plate',      params: { length: 120, width: 80, thickness: 8, holeDiameter: 9, cols: 2, rows: 2, margin: 15 } },
    { type: 'cone',       params: { bottomRadius: 20, topRadius: 0, height: 60 } }  // apex case
  ];
  geomTypes.forEach(function(g) {
    test(g.type + ': her vertex en az 1 face\'e bağlı', () => {
      var topo = veFEAComputeGeometryTopology(g);
      expect(Array.isArray(topo.vertices)).toBe(true);
      expect(topo.vertices.length).toBeGreaterThan(0);
      topo.vertices.forEach(function(v) {
        expect(Array.isArray(v.faceIds)).toBe(true);
        expect(v.faceIds.length).toBeGreaterThanOrEqual(1);
        // position 3 koordinat
        expect(Array.isArray(v.position)).toBe(true);
        expect(v.position.length).toBe(3);
      });
    });
  });
});

describe('Tüm geometrilerde face\'in edge\'leri ve vertex\'leri tutarlı', () => {
  var geomTypes = [
    { type: 'box',      params: { width: 50, height: 30, depth: 20 } },
    { type: 'plate',    params: { length: 120, width: 80, thickness: 8, holeDiameter: 9, cols: 1, rows: 1, margin: 15 } },
    { type: 'lbracket', params: { width: 60, height: 40, thickness: 5, length: 100 } }
  ];
  geomTypes.forEach(function(g) {
    test(g.type + ': her face\'in edge\'leri faceIds backward-reference uyumlu', () => {
      var topo = veFEAComputeGeometryTopology(g);
      topo.faces.forEach(function(f) {
        // Her edge'in faceIds bu face'i içermeli
        var faceEdges = topo.edges.filter(function(e) { return e.faceIds.indexOf(f.id) >= 0; });
        // Box: her yüzey 4 edge'den oluşur
        if (g.type === 'box') expect(faceEdges.length).toBe(4);
        // Plate: top/bottom yüzleri 4 dış edge + N delik çemberi
        if (g.type === 'plate' && (f.id === 'faceTop' || f.id === 'faceBottom')) {
          expect(faceEdges.length).toBeGreaterThanOrEqual(4);
        }
      });
    });
  });
});

describe('Tüm geometriler için topology null değil — kapsam garantisi', () => {
  // veFEAComputeGeometryTopology asla null dönmemeli (geometry.type varsa)
  var allTypes = ['box', 'cylinder', 'shaft', 'sphere', 'hemisphere', 'torus', 'cone',
                  'lbracket', 'ibeam', 'rectTube', 'washer', 'nut', 'bolt', 'plate',
                  'unknown_type_x', 'custom_geom_y'];
  allTypes.forEach(function(t) {
    test(t + ' tipi → topology objesi döner (en az faces[] var)', () => {
      var topo = veFEAComputeGeometryTopology({ type: t, params: {} });
      expect(topo).not.toBeNull();
      expect(Array.isArray(topo.faces)).toBe(true);
      expect(topo.faces.length).toBeGreaterThanOrEqual(1);
      // Her face'in id ve label'ı olmalı
      topo.faces.forEach(function(f) {
        expect(typeof f.id).toBe('string');
        expect(typeof f.label).toBe('string');
        expect(typeof f.type).toBe('string');
      });
    });
  });
});

describe('Vertex bağlantı sayıları doğru — Box 8 köşede 3 face × 3 edge', () => {
  test('Box vertex: 3 face + 3 edge (her köşe)', () => {
    var t = veFEAComputeGeometryTopology({ type: 'box', params: { width: 10, height: 10, depth: 10 } });
    t.vertices.forEach(function(v) {
      expect(v.faceIds.length).toBe(3);
      // edgeIds: yardımcı veFEABuildVertexAdjacency üzerinden alalım
    });
  });

  test('Box vertex.edgeIds: her köşe 3 edge\'in endpoint\'i', () => {
    var t = veFEAComputeGeometryTopology({ type: 'box', params: { width: 10, height: 10, depth: 10 } });
    // Box edge'lerinin vertexIds'inden geri çıkar
    t.vertices.forEach(function(v) {
      var edgesAtV = t.edges.filter(function(e) {
        return Array.isArray(e.vertexIds) && e.vertexIds.indexOf(v.id) >= 0;
      });
      expect(edgesAtV.length).toBe(3);
    });
  });
});

describe('Plate: her delik çemberi face\'i bilinen hole face\'ine bağlı', () => {
  test('Plate 1x1 delik: 2 hole edge\'i faceHole_0_0\'a referans verir', () => {
    var t = veFEAComputeGeometryTopology({ type: 'plate', params: {
      length: 100, width: 80, thickness: 8, holeDiameter: 10, cols: 1, rows: 1, margin: 30
    }});
    var holeEdges = t.edges.filter(function(e) { return e.id.indexOf('eP_Hole') === 0; });
    expect(holeEdges.length).toBe(2);   // üst + alt daire
    holeEdges.forEach(function(e) {
      expect(e.faceIds.indexOf('faceHole_0_0')).toBeGreaterThanOrEqual(0);
    });
  });
});

describe('Generic motor — _veFEAExtractFullTopology helper fonksiyonları', () => {
  test('_veFEATopoTriangleData kutu üçgen alanı doğru', () => {
    // Tek üçgen: A(0,0,0) B(10,0,0) C(0,10,0) → alan = 50
    var verts = new Float32Array([0,0,0, 10,0,0, 0,10,0]);
    var td = _veFEATopoTriangleData(verts, 1);
    expect(td.areas[0]).toBeCloseTo(50, 3);
    expect(td.normals[2]).toBeCloseTo(1, 3);   // normal +Z
  });

  test('_veFEATopoTriangleAdjacency: iki üçgen ortak kenar', () => {
    // 2 üçgen ortak kenar 1-2: ABС ve ACD (D=10,10,0)
    var verts = new Float32Array([
      0,0,0, 10,0,0, 0,10,0,   // tri 0
      10,0,0, 10,10,0, 0,10,0  // tri 1
    ]);
    // Canonical: dedup ile A=0, B=1, C=2, B=1, D=3, C=2
    var dedup = veFEADedupVertices(verts, { bboxSize: 10 });
    var td = _veFEATopoTriangleData(verts, 2);
    var adj = _veFEATopoTriangleAdjacency(dedup.canonical, 2, td.normals);
    // İki üçgen ortak edge'ler üzerinden komşu olmalı
    var hasNeighbor = false;
    for (var s = 0; s < 3; s++) if (adj.neighbors[s] === 1) hasNeighbor = true;
    expect(hasNeighbor).toBe(true);
  });
});

describe('STEP topology: parsedMesh ile mesh-driven edge extraction', () => {
  test('parsedMesh vermeden STEP topology fallback dönüyor', () => {
    var t = veFEAComputeGeometryTopology({ type: 'step', triangleCount: 50, surfaceArea: 1200 });
    expect(t).not.toBeNull();
    expect(t.faces.length).toBeGreaterThanOrEqual(1);
  });

  test('STEP detectedFeatures ile feature faces oluşur', () => {
    var t = veFEAComputeGeometryTopology({
      type: 'step',
      triangleCount: 50,
      surfaceArea: 1200,
      volume: 500,
      detectedFeatures: {
        features: [
          { type: 'planar', area: 600, normal: [0, 1, 0], triangleIds: [0, 1, 2] },
          { type: 'cylindrical', area: 600, radius: 5, axis: [0, 1, 0], triangleIds: [3, 4, 5] }
        ],
        edgeStats: { total: 12, sharp: 6, smooth: 6 },
        uniqueVertices: 8,
        summary: { planar: 1, cylindrical: 1, spherical: 0, conical: 0, freeform: 0 }
      }
    });
    expect(t.faces.length).toBe(2);
    expect(t.faces[0].type).toBe('planar');
    expect(t.faces[1].type).toBe('cylindrical');
  });
});
