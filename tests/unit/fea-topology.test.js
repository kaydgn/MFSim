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
describe('veFEAComputeGeometryTopology — STL/STEP', () => {
  test('STL: tek "Yüzey" face (basitleştirilmiş)', () => {
    var topo = veFEAComputeGeometryTopology({ type: 'stl', triangleCount: 12, surfaceArea: 600, volume: 1000 });
    expect(topo.faces.length).toBe(1);
    expect(topo.faces[0].type).toBe('triangulated');
    expect(topo.faces[0].triangleCount).toBe(12);
  });

  test('STEP: aynı yapı (geom.surfaceArea taşınır)', () => {
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
describe('veFEAComputeGeometryTopology — Geçersiz girdi', () => {
  test('null/undefined → null', () => {
    expect(veFEAComputeGeometryTopology(null)).toBeNull();
    expect(veFEAComputeGeometryTopology(undefined)).toBeNull();
    expect(veFEAComputeGeometryTopology({})).toBeNull();
  });

  test('Bilinmeyen geometri tipi → null', () => {
    expect(veFEAComputeGeometryTopology({ type: 'unknown' })).toBeNull();
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
