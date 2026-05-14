/**
 * Primitif Inference birim testleri
 * - Sentetik feature seti → primitif cikar
 * - Mesh donusumu (canonical → tespit edilen orientation)
 */

const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '../..');

eval(fs.readFileSync(path.join(ROOT, 'js/fea-primitives.js'), 'utf8'));
eval(fs.readFileSync(path.join(ROOT, 'js/fea-materials.js'), 'utf8'));
eval(fs.readFileSync(path.join(ROOT, 'js/fea-feature-recognition.js'), 'utf8'));
eval(fs.readFileSync(path.join(ROOT, 'js/fea-topology.js'), 'utf8'));
eval(fs.readFileSync(path.join(ROOT, 'js/fea-mesh.js'), 'utf8'));

// Sentetik üçgen mesh helper'lari (fea-feature-recognition.test.js'den tekrar)
function _boxTriangles(w, h, d, cx, cy, cz) {
  cx = cx || 0; cy = cy || 0; cz = cz || 0;
  var v = [
    [cx-w/2, cy-h/2, cz-d/2], [cx+w/2, cy-h/2, cz-d/2], [cx+w/2, cy+h/2, cz-d/2], [cx-w/2, cy+h/2, cz-d/2],
    [cx-w/2, cy-h/2, cz+d/2], [cx+w/2, cy-h/2, cz+d/2], [cx+w/2, cy+h/2, cz+d/2], [cx-w/2, cy+h/2, cz+d/2]
  ];
  var faces = [
    [0,3,2, 0,2,1], [4,5,6, 4,6,7], [0,1,5, 0,5,4], [3,7,6, 3,6,2], [0,4,7, 0,7,3], [1,2,6, 1,6,5]
  ];
  var verts = [];
  faces.forEach(function (f) { for (var i = 0; i < 6; i++) verts.push(v[f[i]][0], v[f[i]][1], v[f[i]][2]); });
  return { vertices: new Float32Array(verts), triangleCount: 12 };
}
function _cylinderTriangles(r, h, nSeg, cx, cy, cz, axis) {
  cx = cx || 0; cy = cy || 0; cz = cz || 0;
  axis = axis || [0, 1, 0];
  // Eksen sabit Y kabulüyle olusturuluyor — rotasyon test icin yapilmiyor.
  var verts = [];
  for (var i = 0; i < nSeg; i++) {
    var t0 = (i / nSeg) * 2 * Math.PI, t1 = ((i + 1) / nSeg) * 2 * Math.PI;
    var x0 = r * Math.cos(t0), z0 = r * Math.sin(t0);
    var x1 = r * Math.cos(t1), z1 = r * Math.sin(t1);
    verts.push(cx+x0, cy+0, cz+z0,  cx+x1, cy+0, cz+z1,  cx+x1, cy+h, cz+z1);
    verts.push(cx+x0, cy+0, cz+z0,  cx+x1, cy+h, cz+z1,  cx+x0, cy+h, cz+z0);
  }
  for (var i = 0; i < nSeg; i++) {
    var t0 = (i / nSeg) * 2 * Math.PI, t1 = ((i + 1) / nSeg) * 2 * Math.PI;
    var x0 = r * Math.cos(t0), z0 = r * Math.sin(t0);
    var x1 = r * Math.cos(t1), z1 = r * Math.sin(t1);
    verts.push(cx+0, cy+0, cz+0,  cx+x1, cy+0, cz+z1,  cx+x0, cy+0, cz+z0);
  }
  for (var i = 0; i < nSeg; i++) {
    var t0 = (i / nSeg) * 2 * Math.PI, t1 = ((i + 1) / nSeg) * 2 * Math.PI;
    var x0 = r * Math.cos(t0), z0 = r * Math.sin(t0);
    var x1 = r * Math.cos(t1), z1 = r * Math.sin(t1);
    verts.push(cx+0, cy+h, cz+0,  cx+x0, cy+h, cz+z0,  cx+x1, cy+h, cz+z1);
  }
  return { vertices: new Float32Array(verts), triangleCount: nSeg * 4 };
}
function _sphereTriangles(r, nLat, nLon, cx, cy, cz) {
  cx = cx || 0; cy = cy || 0; cz = cz || 0;
  var verts = [];
  for (var i = 0; i < nLat; i++) {
    var phi0 = Math.PI * i / nLat - Math.PI / 2;
    var phi1 = Math.PI * (i + 1) / nLat - Math.PI / 2;
    for (var j = 0; j < nLon; j++) {
      var th0 = 2 * Math.PI * j / nLon, th1 = 2 * Math.PI * (j + 1) / nLon;
      function P(phi, th) { return [cx+r*Math.cos(phi)*Math.cos(th), cy+r*Math.sin(phi), cz+r*Math.cos(phi)*Math.sin(th)]; }
      var v00 = P(phi0, th0), v01 = P(phi0, th1), v10 = P(phi1, th0), v11 = P(phi1, th1);
      verts.push(v00[0], v00[1], v00[2],  v01[0], v01[1], v01[2],  v11[0], v11[1], v11[2]);
      verts.push(v00[0], v00[1], v00[2],  v11[0], v11[1], v11[2],  v10[0], v10[1], v10[2]);
    }
  }
  return { vertices: new Float32Array(verts), triangleCount: 2 * nLat * nLon };
}

// ────────────────────────────────────────────────────────────────────────────
describe('Primitif Inference — Kutu', () => {
  test('Origin merkezli axis-aligned kutu (10×20×30) → box pattern', () => {
    var parsed = _boxTriangles(10, 20, 30);
    var det = veFEADetectGeometryFeatures(parsed);
    var inf = veFEAInferPrimitiveFromFeatures(det, { x: 10, y: 20, z: 30 });
    expect(inf).not.toBeNull();
    expect(inf.type).toBe('box');
    expect(inf.params.width).toBeCloseTo(10, 1);
    expect(inf.params.height).toBeCloseTo(20, 1);
    expect(inf.params.depth).toBeCloseTo(30, 1);
    expect(inf.confidence).toBeCloseTo(1, 2);
  });

  test('Offset edilmis kutu — center (100, 50, 25) → transform.center dolar', () => {
    var parsed = _boxTriangles(10, 10, 10, 100, 50, 25);
    var det = veFEADetectGeometryFeatures(parsed);
    var inf = veFEAInferPrimitiveFromFeatures(det);
    expect(inf.type).toBe('box');
    expect(inf.transform.center[0]).toBeCloseTo(100, 1);
    expect(inf.transform.center[1]).toBeCloseTo(50, 1);
    expect(inf.transform.center[2]).toBeCloseTo(25, 1);
  });
});

describe('Primitif Inference — Silindir', () => {
  test('Y-axis silindir (r=10, h=30) → cylinder pattern', () => {
    var parsed = _cylinderTriangles(10, 30, 32);
    var det = veFEADetectGeometryFeatures(parsed);
    var inf = veFEAInferPrimitiveFromFeatures(det);
    expect(inf).not.toBeNull();
    expect(inf.type).toBe('cylinder');
    expect(inf.params.radius).toBeCloseTo(10, 0);
    expect(inf.params.height).toBeCloseTo(30, 0);
    // Eksen Y'ye paralel
    expect(Math.abs(inf.transform.axis[1])).toBeGreaterThan(0.95);
  });
});

describe('Primitif Inference — Küre', () => {
  test('Origin merkezli kure (r=15) → sphere pattern', () => {
    var parsed = _sphereTriangles(15, 12, 16);
    var det = veFEADetectGeometryFeatures(parsed);
    var inf = veFEAInferPrimitiveFromFeatures(det);
    expect(inf).not.toBeNull();
    expect(inf.type).toBe('sphere');
    expect(inf.params.radius).toBeCloseTo(15, 0);
    // Pol bolgesindeki dejenere uggenler nedeniyle merkez biraz offset olabilir
    expect(Math.abs(inf.transform.center[0])).toBeLessThan(2);
    expect(Math.abs(inf.transform.center[1])).toBeLessThan(2);
    expect(Math.abs(inf.transform.center[2])).toBeLessThan(2);
  });
});

describe('Primitif Inference — Eslesmeyen pattern', () => {
  test('Bos feature set → null', () => {
    expect(veFEAInferPrimitiveFromFeatures(null)).toBeNull();
    expect(veFEAInferPrimitiveFromFeatures({})).toBeNull();
    expect(veFEAInferPrimitiveFromFeatures({ features: [] })).toBeNull();
  });

  test('Tek uggen (1 planar) → null (box deyil)', () => {
    var parsed = {
      vertices: new Float32Array([0,0,0,  1,0,0,  0,1,0]),
      triangleCount: 1
    };
    var det = veFEADetectGeometryFeatures(parsed);
    var inf = veFEAInferPrimitiveFromFeatures(det);
    expect(inf).toBeNull();
  });
});

describe('Inferred Primitive Label', () => {
  test('Tum tipler icin formatted label', () => {
    expect(veFEAInferredPrimitiveLabel({ type: 'box', params: { width: 10, height: 20, depth: 30 } }))
      .toMatch(/Kutu.*10.*20.*30/);
    expect(veFEAInferredPrimitiveLabel({ type: 'cylinder', params: { radius: 5, height: 15 } }))
      .toMatch(/Silindir.*R=5.*H=15/);
    expect(veFEAInferredPrimitiveLabel({ type: 'sphere', params: { radius: 8 } }))
      .toMatch(/Küre.*R=8/);
  });

  test('null inferred → null', () => {
    expect(veFEAInferredPrimitiveLabel(null)).toBeNull();
  });
});

// ────────────────────────────────────────────────────────────────────────────
describe('Mesh dispatcher — STL inference primitif mesh\'e cevirir', () => {
  test('STL kutu → primitive box mesh (Hex8 voxel grid yerine yapısal)', () => {
    var parsed = _boxTriangles(10, 20, 30, 100, 0, 0);
    var det = veFEADetectGeometryFeatures(parsed);
    var detSummary = {
      features: det.features.map(function (f) {
        var copy = {};
        Object.keys(f).forEach(function (k) {
          if (k !== 'triangleIds') copy[k] = f[k];
        });
        return copy;
      }),
      summary: det.summary,
      edgeStats: det.edgeStats,
      totalArea: det.totalArea
    };
    var geom = {
      type: 'step',
      bbox: { x: 10, y: 20, z: 30 },
      triangleCount: 12,
      detectedFeatures: detSummary,
      // STL parser için rawDataB64 lazım — bypass için size mode'da fallback ediyoruz
      rawDataB64: null
    };
    // Test ediyoruz: primitive inference → primitive mesh + transform.
    // _veFEAParseSurfaceTriangles rawDataB64 olmadığı için null döner, ama
    // inference yolu parsed bypass'lar. Çünkü inference geom.detectedFeatures'a bakar.
    var mesh = veFEAMeshFromGeometry(geom, { size: 5 });
    expect(mesh).not.toBeNull();
    expect(mesh.type).toBe('hex8');
    expect(mesh.geometryType).toBe('step');
    expect(mesh.inferredPrimitive).toBeDefined();
    expect(mesh.inferredPrimitive.type).toBe('box');
    // Mesh tasinmis: merkez (100, 0, 0)
    var sumX = 0, n = mesh.nodes.length / 3;
    for (var i = 0; i < n; i++) sumX += mesh.nodes[i * 3];
    var avgX = sumX / n;
    expect(avgX).toBeCloseTo(100, 0);
  });

  test('STL silindir → primitive cylinder mesh (O-grid Hex8)', () => {
    var parsed = _cylinderTriangles(10, 30, 32);
    var det = veFEADetectGeometryFeatures(parsed);
    var detSummary = {
      features: det.features.map(function (f) {
        var copy = {};
        Object.keys(f).forEach(function (k) { if (k !== 'triangleIds') copy[k] = f[k]; });
        return copy;
      }),
      summary: det.summary,
      edgeStats: det.edgeStats,
      totalArea: det.totalArea
    };
    var geom = {
      type: 'step',
      bbox: { x: 20, y: 30, z: 20 },
      triangleCount: 128,
      detectedFeatures: detSummary
    };
    var mesh = veFEAMeshFromGeometry(geom, { size: 5 });
    expect(mesh).not.toBeNull();
    expect(mesh.type).toBe('hex8');
    expect(mesh.inferredPrimitive.type).toBe('cylinder');
    // O-grid kullanildi
    expect(mesh.grid && mesh.grid.ogrid).toBe(true);
  });

  test('disablePrimitiveInference: true → primitif inference atlanir', () => {
    var geom = {
      type: 'step',
      bbox: { x: 10, y: 10, z: 10 },
      triangleCount: 12,
      detectedFeatures: {
        features: [
          { type: 'planar', area: 100, normal: [1, 0, 0], centroid: [5, 0, 0], triangleCount: 2 },
          { type: 'planar', area: 100, normal: [-1, 0, 0], centroid: [-5, 0, 0], triangleCount: 2 },
          { type: 'planar', area: 100, normal: [0, 1, 0], centroid: [0, 5, 0], triangleCount: 2 },
          { type: 'planar', area: 100, normal: [0, -1, 0], centroid: [0, -5, 0], triangleCount: 2 },
          { type: 'planar', area: 100, normal: [0, 0, 1], centroid: [0, 0, 5], triangleCount: 2 },
          { type: 'planar', area: 100, normal: [0, 0, -1], centroid: [0, 0, -5], triangleCount: 2 }
        ],
        summary: { planar: 6, cylindrical: 0, spherical: 0, conical: 0, freeform: 0 }
      },
      rawDataB64: null
    };
    var meshA = veFEAMeshFromGeometry(geom, { size: 5 });
    expect(meshA && meshA.inferredPrimitive).toBeDefined(); // inferred edildi
    var meshB = veFEAMeshFromGeometry(geom, { size: 5, disablePrimitiveInference: true });
    // disable edildi — voxelizer çağrılır ama rawDataB64 yoksa null
    expect(meshB === null || !meshB.inferredPrimitive).toBeTruthy();
  });
});
