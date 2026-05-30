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

  test('Healing pipeline (Faz 3): temiz kutu BRepCheck=true + healed=true', () => {
    const o = new oc.gp_Pnt_3(0, 0, 0);
    const box = new oc.BRepPrimAPI_MakeBox_2(o, 10, 20, 30).Shape();
    const r = occt.veFEAOcctHealShape(oc, box, {});
    expect(r.report.wasValid).toBe(true);
    expect(r.report.nowValid).toBe(true);
    expect(r.report.healed).toBe(true);
    expect(r.report.issues.length).toBe(0);
    // Healed shape hala topology'ye uygun
    const t = occt.veFEAOcctShapeToTopology(oc, r.shape, { sampleEdges: false });
    expect(t.faces.length).toBe(6);
    expect(t.validity.eulerChi).toBe(2);
  });

  test('Healing + sewing (silindir): sewed=true, validity korunur', () => {
    const cyl = new oc.BRepPrimAPI_MakeCylinder_1(5, 20).Shape();
    const r = occt.veFEAOcctHealShape(oc, cyl, { sew: true, sewTolerance: 0.001 });
    expect(r.report.healed).toBe(true);
    expect(r.report.sewed).toBe(true);
    expect(r.report.nowValid).toBe(true);
  });

  test('Wire/Shell/Solid hiyerarşisi (Faz 4): kutu 1 solid + 1 shell + 6 wire', () => {
    const o = new oc.gp_Pnt_3(0, 0, 0);
    const box = new oc.BRepPrimAPI_MakeBox_2(o, 10, 20, 30).Shape();
    const t = occt.veFEAOcctShapeToTopology(oc, box, { sampleEdges: false });
    expect(Array.isArray(t.solids)).toBe(true);
    expect(Array.isArray(t.shells)).toBe(true);
    expect(Array.isArray(t.wires)).toBe(true);
    expect(t.solids.length).toBe(1);
    expect(t.shells.length).toBe(1);
    expect(t.wires.length).toBe(6);   // her yüz için 1 outer wire
    // Solid içinde 1 shell, shell içinde 6 face
    expect(t.solids[0].shellIds.length).toBe(1);
    expect(t.shells[0].faceIds.length).toBe(6);
    // validity.counts'a yeni entiteler eklendi
    expect(t.validity.counts.W).toBe(6);
    expect(t.validity.counts.S).toBe(1);
    expect(t.validity.counts.So).toBe(1);
  });

  test('Feature recognition (Faz 6): silindir → boss tespit edilir', () => {
    const cyl = new oc.BRepPrimAPI_MakeCylinder_1(5, 20).Shape();
    const t = occt.veFEAOcctShapeToTopology(oc, cyl, { sampleEdges: false });
    const features = occt.veFEAOcctDetectFeatures(t);
    expect(Array.isArray(features)).toBe(true);
    const bosses = features.filter(function(f) { return f.type === 'boss'; });
    expect(bosses.length).toBeGreaterThanOrEqual(1);
    expect(bosses[0].params.diameter).toBeCloseTo(10, 0);   // R=5 → D=10
    expect(bosses[0].label).toMatch(/Boss/);
  });

  test('Feature recognition: kutu → feature yok (delik/fillet/boss değil)', () => {
    const o = new oc.gp_Pnt_3(0, 0, 0);
    const box = new oc.BRepPrimAPI_MakeBox_2(o, 10, 20, 30).Shape();
    const t = occt.veFEAOcctShapeToTopology(oc, box, { sampleEdges: false });
    const features = occt.veFEAOcctDetectFeatures(t);
    expect(features.length).toBe(0);
  });

  test('Persistent naming: signatures üretilir + remap eski ID\'leri korur', () => {
    const o = new oc.gp_Pnt_3(0, 0, 0);
    const box = new oc.BRepPrimAPI_MakeBox_2(o, 10, 20, 30).Shape();
    const t1 = occt.veFEAOcctShapeToTopology(oc, box, { sampleEdges: false });
    occt.veFEAOcctComputeSignatures(t1);
    t1.faces.forEach(function(f) {
      expect(typeof f.signature).toBe('string');
      expect(f.signature.indexOf('F:')).toBe(0);  // face signature prefix
    });
    // Aynı geometriden yeni topology + ID'leri değiştir, remap eski ID'lere döndürmeli
    const t2 = occt.veFEAOcctShapeToTopology(oc, box, { sampleEdges: false });
    occt.veFEAOcctComputeSignatures(t2);
    t2.faces.forEach(function(f, i) { f.id = 'changed_' + (i + 1); });
    occt.veFEAOcctRemapFromOldTopology(t1, t2);
    var matchCount = 0;
    t2.faces.forEach(function(f) { if (f.id.indexOf('changed') < 0) matchCount++; });
    expect(matchCount).toBe(6);
  });

  test('Tessellation köprüsü (Faz 5): kutu 6 grup, her grup face ID etiketli', () => {
    const o = new oc.gp_Pnt_3(0, 0, 0);
    const box = new oc.BRepPrimAPI_MakeBox_2(o, 10, 20, 30).Shape();
    // face HashCode → ID map
    const faceMap = {};
    const exp = new oc.TopExp_Explorer_2(box, oc.TopAbs_ShapeEnum.TopAbs_FACE, oc.TopAbs_ShapeEnum.TopAbs_SHAPE);
    let fi = 0;
    for (; exp.More(); exp.Next()) {
      const h = exp.Current().HashCode(1e9);
      if (!faceMap[h]) { fi++; faceMap[h] = 'face' + fi; }
    }
    exp.delete();
    const tess = occt.veFEAOcctTessellateShape(oc, box, faceMap, { deflection: 0.5 });
    expect(tess).not.toBeNull();
    expect(tess.positions.length / 3).toBeGreaterThanOrEqual(8);
    expect(tess.indices.length / 3).toBeGreaterThanOrEqual(12);
    expect(tess.groups.length).toBe(6);
    // Her grubun face ID'si var ve toplam üçgen sayısı tutarlı
    let totalGroupTris = 0;
    tess.groups.forEach(function(g) {
      expect(g.faceId).toMatch(/^face\d+$/);
      expect(g.count % 3).toBe(0);
      totalGroupTris += g.count / 3;
    });
    expect(totalGroupTris).toBe(tess.indices.length / 3);
    expect(tess.faceIdOrder.length).toBe(6);
  });

  test('Outer/inner wire ayrımı: kutu yüzleri sadece outer wire (inner yok)', () => {
    const o = new oc.gp_Pnt_3(0, 0, 0);
    const box = new oc.BRepPrimAPI_MakeBox_2(o, 10, 10, 10).Shape();
    const t = occt.veFEAOcctShapeToTopology(oc, box, { sampleEdges: false });
    t.faces.forEach(function(f) {
      expect(f.outerWireId).toBeTruthy();   // her yüzün outer wire'ı var
      expect(f.outerWireId.indexOf('wire')).toBe(0);
      expect(f.innerWireIds.length).toBe(0); // kutuda delik yok
    });
    // Tüm wire'lar isOuter olmalı (delik loop'u yok)
    t.wires.forEach(function(w) {
      expect(w.isOuter).toBe(true);
      expect(w.edgeIds.length).toBe(4);   // her yüz wire'ı 4 kenardan oluşur
      expect(w.faceIds.length).toBeGreaterThanOrEqual(1);
    });
  });

  test('Heal devre dışı (heal:false) → shape değişmez, issues boş', () => {
    const o = new oc.gp_Pnt_3(0, 0, 0);
    const box = new oc.BRepPrimAPI_MakeBox_2(o, 1, 1, 1).Shape();
    const r = occt.veFEAOcctHealShape(oc, box, { heal: false, validate: false });
    expect(r.report.healed).toBe(false);
    expect(r.report.issues.length).toBe(0);
  });

  test('STEP okuma fonksiyonu export + geçersiz buffer → ok:false (graceful)', () => {
    expect(typeof occt.veFEAOcctReadStepBuffer).toBe('function');
    expect(typeof occt.veFEAOcctTopologyFromStepBuffer).toBe('function');
    const garbage = new Uint8Array([1, 2, 3, 4, 5]);
    const r = occt.veFEAOcctReadStepBuffer(oc, garbage, 'bad.step');
    expect(r.ok).toBe(false);  // exception fırlatmaz, ok:false döner
    expect(typeof r.message).toBe('string');
  });
});
