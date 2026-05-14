/**
 * STL/STEP feature recognition tam pipeline entegrasyon testi
 * - Sentetik üçgen mesh'i geometriye ata
 * - Topology dispatcher → tespit edilen face'leri verir
 * - Mesh dispatcher → curvature-adaptive boyut
 */

const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '../..');

eval(fs.readFileSync(path.join(ROOT, 'js/fea-feature-recognition.js'), 'utf8'));
eval(fs.readFileSync(path.join(ROOT, 'js/fea-topology.js'), 'utf8'));
eval(fs.readFileSync(path.join(ROOT, 'js/fea-mesh.js'), 'utf8'));

// Sentetik silindir üçgen mesh'i
function _cylinderTriangles(r, h, nSeg) {
  var verts = [];
  for (var i = 0; i < nSeg; i++) {
    var t0 = (i / nSeg) * 2 * Math.PI, t1 = ((i + 1) / nSeg) * 2 * Math.PI;
    var x0 = r * Math.cos(t0), z0 = r * Math.sin(t0);
    var x1 = r * Math.cos(t1), z1 = r * Math.sin(t1);
    verts.push(x0, 0, z0,  x1, 0, z1,  x1, h, z1);
    verts.push(x0, 0, z0,  x1, h, z1,  x0, h, z0);
  }
  for (var i = 0; i < nSeg; i++) {
    var t0 = (i / nSeg) * 2 * Math.PI, t1 = ((i + 1) / nSeg) * 2 * Math.PI;
    var x0 = r * Math.cos(t0), z0 = r * Math.sin(t0);
    var x1 = r * Math.cos(t1), z1 = r * Math.sin(t1);
    verts.push(0, 0, 0,  x1, 0, z1,  x0, 0, z0);
  }
  for (var i = 0; i < nSeg; i++) {
    var t0 = (i / nSeg) * 2 * Math.PI, t1 = ((i + 1) / nSeg) * 2 * Math.PI;
    var x0 = r * Math.cos(t0), z0 = r * Math.sin(t0);
    var x1 = r * Math.cos(t1), z1 = r * Math.sin(t1);
    verts.push(0, h, 0,  x0, h, z0,  x1, h, z1);
  }
  return { vertices: new Float32Array(verts), triangleCount: nSeg * 4 };
}

describe('STL/STEP topology — feature-aware', () => {
  test('Geometriye detectedFeatures eklenirse topology face listesi feature\'larla dolar', () => {
    var parsed = _cylinderTriangles(10, 30, 32);
    var det = veFEADetectGeometryFeatures(parsed);
    expect(det.summary.cylindrical).toBeGreaterThanOrEqual(1);
    expect(det.summary.planar).toBeGreaterThanOrEqual(2);

    var geom = {
      type: 'step',
      sourceLabel: 'test cylinder',
      triangleCount: parsed.triangleCount,
      surfaceArea: det.totalArea,
      volume: 0,
      bbox: { x: 20, y: 30, z: 20 },
      detectedFeatures: {
        features: det.features.map(function (f) {
          var copy = {};
          Object.keys(f).forEach(function (k) {
            if (k !== 'triangleIds') copy[k] = f[k];
          });
          copy.triangleCount = (f.triangleIds || []).length;
          return copy;
        }),
        summary: det.summary,
        edgeStats: det.edgeStats,
        totalArea: det.totalArea
      }
    };

    var topo = veFEAComputeGeometryTopology(geom);
    expect(topo).not.toBeNull();
    // En az 1 silindirik + 2 düzlemsel face
    expect(topo.faces.length).toBeGreaterThanOrEqual(3);
    var cylFace = topo.faces.find(function (f) { return f.type === 'cylindrical'; });
    expect(cylFace).toBeDefined();
    expect(cylFace.radius).toBeGreaterThan(0);
    expect(cylFace.label).toMatch(/Silindirik/);

    var planarFaces = topo.faces.filter(function (f) { return f.type === 'planar'; });
    expect(planarFaces.length).toBeGreaterThanOrEqual(2);

    // featureSummary topology'de mevcut
    expect(topo.featureSummary).toBeDefined();
    expect(topo.featureSummary.cylindrical).toBe(1);

    // Edge stats
    expect(topo.edges.sharp).toBeGreaterThan(0);
  });

  test('detectedFeatures yoksa fallback: tek "triangulated" face', () => {
    var geom = {
      type: 'step',
      sourceLabel: 'no-features',
      triangleCount: 12,
      surfaceArea: 600,
      volume: 1000,
      bbox: { x: 10, y: 10, z: 10 }
    };
    var topo = veFEAComputeGeometryTopology(geom);
    expect(topo.faces.length).toBe(1);
    expect(topo.faces[0].type).toBe('triangulated');
  });
});

describe('Mesh dispatcher — curvature-adaptive sizing', () => {
  test('Egrili yuzey (cylindrical) varsa voxel boyutu kucultulur (daha yogun mesh)', () => {
    var parsed = _cylinderTriangles(10, 30, 32);
    var det = veFEADetectGeometryFeatures(parsed);
    // Geometri 1: detectedFeatures YOK
    var geomNoFeat = {
      type: 'step',
      bbox: { x: 20, y: 30, z: 20 },
      rawDataB64: null,
      // Test için doğrudan parsed eşdeğer — _veFEAParseSurfaceTriangles çağrılır
      // ama biz testi monkeypatch ile yapacağız
      triangleCount: parsed.triangleCount
    };
    // Hack: _veFEAParseSurfaceTriangles ı bypass et — fea-mesh.js'in altyapısı.
    // Sentetik akış için doğrudan _veFEAVoxelizeTrianglesToHex çağıralım.
    var meshNoFeat = _veFEAVoxelizeTrianglesToHex(parsed, 4, 'step', null);
    var meshWithFeat = _veFEAVoxelizeTrianglesToHex(parsed, 4, 'step', {
      summary: det.summary
    });
    expect(meshNoFeat).not.toBeNull();
    expect(meshWithFeat).not.toBeNull();
    // Egri yuzey varsa voxel %30 kucultuluyor → ~ (1/0.7)³ ≈ 2.9× daha fazla element
    var nElNoFeat = meshNoFeat.elements.length / 8;
    var nElWithFeat = meshWithFeat.elements.length / 8;
    expect(nElWithFeat).toBeGreaterThan(nElNoFeat);
  });

  test('Sadece planar feature varsa voxel boyutu degismez', () => {
    var parsed = _cylinderTriangles(10, 30, 32);
    var planarOnly = {
      summary: { planar: 6, cylindrical: 0, spherical: 0, conical: 0, freeform: 0 }
    };
    var meshA = _veFEAVoxelizeTrianglesToHex(parsed, 4, 'step', null);
    var meshB = _veFEAVoxelizeTrianglesToHex(parsed, 4, 'step', planarOnly);
    expect(meshA.elements.length).toBe(meshB.elements.length);
  });
});
