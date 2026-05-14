/**
 * FEA Yüzey Feature Recognition birim testleri
 * - Sentetik üçgen mesh'lerden primitif tanıma (kutu/silindir/küre)
 * - Smooth region clustering doğruluğu
 * - Edge tipi sınıflandırma (sharp/smooth)
 */

const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '../..');

eval(fs.readFileSync(path.join(ROOT, 'js/fea-feature-recognition.js'), 'utf8'));

// ─── Yardımcı: kutu üçgenleri (6 yüzey × 2 üçgen = 12 üçgen) ─────────────
function _boxTriangles(w, h, d) {
  // 8 köşe
  var v = [
    [0,0,0], [w,0,0], [w,h,0], [0,h,0],   // alt
    [0,0,d], [w,0,d], [w,h,d], [0,h,d]    // üst
  ];
  // 6 yüz, her biri 2 üçgen — CCW dış normal
  var faces = [
    [0,3,2, 0,2,1],  // alt (Z=0, normal -Z)
    [4,5,6, 4,6,7],  // üst (Z=d, normal +Z)
    [0,1,5, 0,5,4],  // ön (Y=0, normal -Y)
    [3,7,6, 3,6,2],  // arka (Y=h, normal +Y)
    [0,4,7, 0,7,3],  // sol (X=0, normal -X)
    [1,2,6, 1,6,5]   // sağ (X=w, normal +X)
  ];
  var verts = [];
  faces.forEach(function (f) {
    for (var i = 0; i < 6; i++) {
      verts.push(v[f[i]][0], v[f[i]][1], v[f[i]][2]);
    }
  });
  return {
    vertices: new Float32Array(verts),
    triangleCount: 12
  };
}

// ─── Yardımcı: silindir üçgenleri (axial Y) ──────────────────────────────
// nSeg segment + alt/üst kapaklar
function _cylinderTriangles(r, h, nSeg) {
  var verts = [];
  // Yan yüzey: her segment iki üçgen
  for (var i = 0; i < nSeg; i++) {
    var t0 = (i / nSeg) * 2 * Math.PI;
    var t1 = ((i + 1) / nSeg) * 2 * Math.PI;
    var x0 = r * Math.cos(t0), z0 = r * Math.sin(t0);
    var x1 = r * Math.cos(t1), z1 = r * Math.sin(t1);
    // Tri1: (x0,0,z0), (x1,0,z1), (x1,h,z1) — CCW dış
    verts.push(x0, 0, z0,  x1, 0, z1,  x1, h, z1);
    // Tri2: (x0,0,z0), (x1,h,z1), (x0,h,z0)
    verts.push(x0, 0, z0,  x1, h, z1,  x0, h, z0);
  }
  // Alt disk (Y=0, normal -Y): merkez + segment fan
  for (var i = 0; i < nSeg; i++) {
    var t0b = (i / nSeg) * 2 * Math.PI;
    var t1b = ((i + 1) / nSeg) * 2 * Math.PI;
    var x0b = r * Math.cos(t0b), z0b = r * Math.sin(t0b);
    var x1b = r * Math.cos(t1b), z1b = r * Math.sin(t1b);
    // Normal -Y: CW from above = (0,0,0) → (x1,0,z1) → (x0,0,z0)
    verts.push(0, 0, 0,  x1b, 0, z1b,  x0b, 0, z0b);
  }
  // Üst disk (Y=h, normal +Y)
  for (var i = 0; i < nSeg; i++) {
    var t0t = (i / nSeg) * 2 * Math.PI;
    var t1t = ((i + 1) / nSeg) * 2 * Math.PI;
    var x0t = r * Math.cos(t0t), z0t = r * Math.sin(t0t);
    var x1t = r * Math.cos(t1t), z1t = r * Math.sin(t1t);
    verts.push(0, h, 0,  x0t, h, z0t,  x1t, h, z1t);
  }
  return {
    vertices: new Float32Array(verts),
    triangleCount: nSeg * 4 // 2 yan + 1 alt + 1 üst
  };
}

// ─── Yardımcı: küre (icosahedron-based tessellation, basit) ──────────────
function _sphereTriangles(r, nLat, nLon) {
  var verts = [];
  for (var i = 0; i < nLat; i++) {
    var phi0 = Math.PI * i / nLat - Math.PI / 2;
    var phi1 = Math.PI * (i + 1) / nLat - Math.PI / 2;
    for (var j = 0; j < nLon; j++) {
      var th0 = 2 * Math.PI * j / nLon;
      var th1 = 2 * Math.PI * (j + 1) / nLon;
      function P(phi, th) {
        return [r * Math.cos(phi) * Math.cos(th), r * Math.sin(phi), r * Math.cos(phi) * Math.sin(th)];
      }
      var v00 = P(phi0, th0), v01 = P(phi0, th1);
      var v10 = P(phi1, th0), v11 = P(phi1, th1);
      // 2 üçgen — CCW dış normal (radyal outward)
      verts.push(v00[0], v00[1], v00[2],  v01[0], v01[1], v01[2],  v11[0], v11[1], v11[2]);
      verts.push(v00[0], v00[1], v00[2],  v11[0], v11[1], v11[2],  v10[0], v10[1], v10[2]);
    }
  }
  return {
    vertices: new Float32Array(verts),
    triangleCount: 2 * nLat * nLon
  };
}

// ────────────────────────────────────────────────────────────────────────────
describe('Feature Recognition — Kutu', () => {
  test('Kutu: 6 düzlemsel yüzey tespit edilir', () => {
    var parsed = _boxTriangles(10, 20, 30);
    var rec = veFEADetectGeometryFeatures(parsed);
    expect(rec).not.toBeNull();
    expect(rec.totalTriangles).toBe(12);
    expect(rec.uniqueVertices).toBe(8); // 8 köşe paylaşılmış olmalı
    // 6 ayrı düzlemsel yüzey (her biri 2 üçgen)
    expect(rec.summary.planar).toBe(6);
    expect(rec.summary.cylindrical).toBe(0);
    expect(rec.features.length).toBe(6);
    // Her feature 2 üçgen içermeli
    rec.features.forEach(function (f) {
      expect(f.type).toBe('planar');
      expect(f.triangleIds.length).toBe(2);
    });
  });

  test('Kutu: tüm kenarlar sharp (90° açı)', () => {
    var parsed = _boxTriangles(10, 10, 10);
    var rec = veFEADetectGeometryFeatures(parsed);
    // Bir kutuda her yüzeyin etrafında 4 sharp komşu kenar var.
    // Üçgen içi diagonals smooth (her yüzeyin 2 üçgeninin paylaştığı kenar).
    expect(rec.edgeStats.smooth).toBe(6); // her yüzeyin diagonal'i
    expect(rec.edgeStats.sharp).toBeGreaterThan(0);
  });

  test('Düzlemsel yüzey normalleri eksenler boyunca', () => {
    var parsed = _boxTriangles(10, 10, 10);
    var rec = veFEADetectGeometryFeatures(parsed);
    var normalAxes = rec.features.map(function (f) {
      return f.normal.map(function (c) { return Math.abs(c) > 0.99 ? Math.sign(c) : 0; });
    });
    // 6 unique axis-aligned normal: ±X, ±Y, ±Z
    var keys = normalAxes.map(function (n) { return n.join(','); });
    expect(new Set(keys).size).toBe(6);
  });
});

describe('Feature Recognition — Silindir', () => {
  test('Silindir: 1 silindirik + 2 düzlemsel (alt/üst kapak)', () => {
    var parsed = _cylinderTriangles(10, 30, 32);
    var rec = veFEADetectGeometryFeatures(parsed);
    expect(rec.totalTriangles).toBe(128); // 32 × 4
    // En az 1 silindirik bölge bekleniyor
    expect(rec.summary.cylindrical).toBeGreaterThanOrEqual(1);
    // 2 düzlemsel kapak
    expect(rec.summary.planar).toBeGreaterThanOrEqual(2);
  });

  test('Silindirik feature\'in yarıçapı ≈ gerçek yarıçap', () => {
    var parsed = _cylinderTriangles(10, 30, 32);
    var rec = veFEADetectGeometryFeatures(parsed);
    var cylFeat = rec.features.find(function (f) { return f.type === 'cylindrical'; });
    expect(cylFeat).toBeDefined();
    // 32 segment için yarıçap tespitinde küçük sapma
    expect(cylFeat.radius).toBeCloseTo(10, 0);
  });

  test('Silindir ekseni Y eksenine paralel', () => {
    var parsed = _cylinderTriangles(10, 30, 32);
    var rec = veFEADetectGeometryFeatures(parsed);
    var cylFeat = rec.features.find(function (f) { return f.type === 'cylindrical'; });
    var ax = cylFeat.axis;
    // |ay| en büyük olmalı (Y dominant)
    expect(Math.abs(ax[1])).toBeGreaterThan(Math.abs(ax[0]));
    expect(Math.abs(ax[1])).toBeGreaterThan(Math.abs(ax[2]));
  });
});

describe('Feature Recognition — Küre', () => {
  test('Küre: spherical feature tespit edilir (default 30° smooth)', () => {
    var parsed = _sphereTriangles(15, 12, 16);
    var rec = veFEADetectGeometryFeatures(parsed);
    var sphereFeat = rec.features.find(function (f) { return f.type === 'spherical'; });
    expect(sphereFeat).toBeDefined();
  });

  test('Küre yarıçapı ≈ gerçek yarıçap', () => {
    var parsed = _sphereTriangles(15, 12, 16);
    var rec = veFEADetectGeometryFeatures(parsed);
    var sphereFeat = rec.features.find(function (f) { return f.type === 'spherical'; });
    expect(sphereFeat.radius).toBeCloseTo(15, 0);
  });
});

describe('Feature Recognition — Edge cases', () => {
  test('Geçersiz girdi → null', () => {
    expect(veFEADetectGeometryFeatures(null)).toBeNull();
    expect(veFEADetectGeometryFeatures({})).toBeNull();
    expect(veFEADetectGeometryFeatures({ vertices: new Float32Array(0), triangleCount: 0 })).toBeNull();
  });

  test('Tek üçgen → tek planar feature', () => {
    var parsed = {
      vertices: new Float32Array([0, 0, 0,  1, 0, 0,  0, 1, 0]),
      triangleCount: 1
    };
    var rec = veFEADetectGeometryFeatures(parsed);
    expect(rec.features.length).toBe(1);
    expect(rec.features[0].type).toBe('planar');
    expect(rec.totalTriangles).toBe(1);
  });
});

describe('Feature label etiketleri', () => {
  test('Türkçe etiket', () => {
    expect(veFEAFeatureTypeLabel('planar')).toBe('Düzlemsel');
    expect(veFEAFeatureTypeLabel('cylindrical')).toBe('Silindirik');
    expect(veFEAFeatureTypeLabel('spherical')).toBe('Küresel');
    expect(veFEAFeatureTypeLabel('freeform')).toBe('Serbest Form');
  });
});
