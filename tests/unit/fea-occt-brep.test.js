/**
 * @jest-environment node
 *
 * FEA OCCT BREP — gerçek Full OpenCASCADE WASM ile B-Rep topoloji testleri.
 *
 * NOT: Bu testler vendor/opencascade-full/opencascade.wasm.wasm (~65MB)
 * gerektirir. Dosya yoksa (CI'da opencascade.js kurulu değilse) TÜM blok
 * otomatik SKIP edilir — diğer testleri etkilemez. Lokal'de:
 *   npm install opencascade.js && npm run occt:full && npm test
 */

const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '../..');
const DIST = path.join(ROOT, 'vendor/opencascade-full');
const occt = require(path.join(ROOT, 'js/fea-occt-brep.js'));

const HAS_OCCT = fs.existsSync(path.join(DIST, 'opencascade.wasm.wasm')) &&
                 fs.existsSync(path.join(DIST, 'opencascade.wasm.js'));
const maybe = HAS_OCCT ? describe : describe.skip;

// Modül her durumda yüklenmeli (loader/extraction fonksiyonları export edilmiş mi)
describe('fea-occt-brep modül arayüzü', () => {
  test('public API export edilmiş', () => {
    expect(typeof occt.veFEAOcctLoad).toBe('function');
    expect(typeof occt.veFEAOcctShapeToTopology).toBe('function');
    expect(typeof occt.veFEAOcctIsAvailable).toBe('function');
  });
  test('GeomAbs tip haritaları doğru', () => {
    expect(occt.VE_OCCT_SURF[0]).toBe('planar');
    expect(occt.VE_OCCT_SURF[1]).toBe('cylindrical');
    expect(occt.VE_OCCT_SURF[3]).toBe('spherical');
    expect(occt.VE_OCCT_CURVE[0]).toBe('line');
    expect(occt.VE_OCCT_CURVE[1]).toBe('circle');
    expect(occt.VE_OCCT_CURVE[6]).toBe('spline');
  });
});

maybe('OCCT BREP topoloji çıkarımı (gerçek WASM)', () => {
  let oc;
  beforeAll(async () => {
    oc = await occt.veFEAOcctLoad({ distDir: DIST });
  }, 60000);  // 65MB WASM init için uzun timeout

  test('Kutu: 6 yüz, 12 kenar, 8 köşe + Euler χ=2', () => {
    const o = new oc.gp_Pnt_3(0, 0, 0);
    const box = new oc.BRepPrimAPI_MakeBox_2(o, 10, 20, 30).Shape();
    const t = occt.veFEAOcctShapeToTopology(oc, box, { sampleEdges: false });
    expect(t.faces.length).toBe(6);
    expect(t.edges.length).toBe(12);
    expect(t.vertices.length).toBe(8);
    expect(t.validity.eulerChi).toBe(2);
    expect(t.validity.eulerOK).toBe(true);
    expect(t.validity.manifold).toBe(true);
    expect(t.validity.watertight).toBe(true);
    expect(t.validity.issues.length).toBe(0);
  });

  test('Kutu: hacim/alan doğru, brep:true bayrağı', () => {
    const o = new oc.gp_Pnt_3(0, 0, 0);
    const box = new oc.BRepPrimAPI_MakeBox_2(o, 10, 20, 30).Shape();
    const t = occt.veFEAOcctShapeToTopology(oc, box, { sampleEdges: false });
    expect(t.volume).toBeCloseTo(6000, 0);
    expect(t.totalSurfaceArea).toBeCloseTo(2200, 0);
    expect(t.brep).toBe(true);
    expect(t.type).toBe('step');
  });

  test('Kutu: tüm yüzler planar + normal vektörü var', () => {
    const o = new oc.gp_Pnt_3(0, 0, 0);
    const box = new oc.BRepPrimAPI_MakeBox_2(o, 10, 20, 30).Shape();
    const t = occt.veFEAOcctShapeToTopology(oc, box, { sampleEdges: false });
    t.faces.forEach(function(f) {
      expect(f.type).toBe('planar');
      expect(Array.isArray(f.normal)).toBe(true);
      expect(f.normal.length).toBe(3);
    });
  });

  test('Kutu: her kenar tam 2 yüze bağlı (E→F manifold)', () => {
    const o = new oc.gp_Pnt_3(0, 0, 0);
    const box = new oc.BRepPrimAPI_MakeBox_2(o, 10, 20, 30).Shape();
    const t = occt.veFEAOcctShapeToTopology(oc, box, { sampleEdges: false });
    t.edges.forEach(function(e) {
      expect(e.type).toBe('line');
      expect(e.faceIds.length).toBe(2);
      expect(e.vertexIds.length).toBe(2);
    });
  });

  test('Kutu: her köşe 3 yüz + 3 kenara bağlı', () => {
    const o = new oc.gp_Pnt_3(0, 0, 0);
    const box = new oc.BRepPrimAPI_MakeBox_2(o, 10, 20, 30).Shape();
    const t = occt.veFEAOcctShapeToTopology(oc, box, { sampleEdges: false });
    t.vertices.forEach(function(v) {
      expect(v.position.length).toBe(3);
      expect(v.faceIds.length).toBe(3);
      expect(v.edgeIds.length).toBe(3);
    });
  });

  test('Silindir: gerçek tipler — Cylinder/Plane yüzler, Circle/Line kenarlar', () => {
    const cyl = new oc.BRepPrimAPI_MakeCylinder_1(5, 20).Shape();
    const t = occt.veFEAOcctShapeToTopology(oc, cyl, { sampleEdges: true });
    const faceTypes = t.faces.map(function(f) { return f.type; });
    expect(faceTypes).toContain('cylindrical');
    expect(faceTypes).toContain('planar');
    // Silindirik yüz radius=5
    const cylFace = t.faces.find(function(f) { return f.type === 'cylindrical'; });
    expect(cylFace.radius).toBeCloseTo(5, 1);
    // Daire kenarları (en az 2) radius=5
    const circles = t.edges.filter(function(e) { return e.type === 'circle'; });
    expect(circles.length).toBeGreaterThanOrEqual(2);
    circles.forEach(function(c) {
      expect(c.radius).toBeCloseTo(5, 1);
      expect(Array.isArray(c.center)).toBe(true);
      expect(Array.isArray(c.axis)).toBe(true);
      expect(c.polyline.length).toBeGreaterThan(10);  // viewer için örneklenmiş
    });
  });

  test('Silindir: circle kenar polyline 3D koordinat dizisi', () => {
    const cyl = new oc.BRepPrimAPI_MakeCylinder_1(5, 20).Shape();
    const t = occt.veFEAOcctShapeToTopology(oc, cyl, { sampleEdges: true });
    const circ = t.edges.find(function(e) { return e.type === 'circle'; });
    expect(circ).toBeTruthy();
    // Polyline noktaları daire üzerinde (merkeze uzaklık ≈ radius)
    circ.polyline.forEach(function(p) {
      const dx = p[0] - circ.center[0], dy = p[1] - circ.center[1];
      const r = Math.sqrt(dx*dx + dy*dy);
      expect(r).toBeCloseTo(5, 1);
    });
  });

  test('Küre: tek spherical yüz, radius doğru', () => {
    const sph = new oc.BRepPrimAPI_MakeSphere_1(7).Shape();
    const t = occt.veFEAOcctShapeToTopology(oc, sph, { sampleEdges: false });
    const sphFaces = t.faces.filter(function(f) { return f.type === 'spherical'; });
    expect(sphFaces.length).toBeGreaterThanOrEqual(1);
    expect(sphFaces[0].radius).toBeCloseTo(7, 1);
  });
});
