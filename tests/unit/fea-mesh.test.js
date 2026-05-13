/**
 * FEA Mesh — birim testleri (Faz 3a)
 *  - Mesh algoritmaları: kutu (Heks8), silindir (Wedge6), şaft (Heks8 annulus)
 *  - STL/STEP yüzey mesh (Tri3 + vertex dedup)
 *  - veFEAComputeMeshMetrics: düğüm/eleman sayısı + edge length
 *  - cp-fea.js Mesh paneli render (geometri var/yok, mesh aktif/pasif)
 *  - Köprü: veFEAFindUpstreamGeometryNode, veFEABuildMeshForNode
 *  - viewer.loadMesh + veFEAInitMeshViewerForNode (Three.js olmadan graceful)
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '../..');

eval(fs.readFileSync(path.join(ROOT, 'js/components.js'), 'utf8'));
eval(fs.readFileSync(path.join(ROOT, 'js/fea-primitives.js'), 'utf8'));
eval(fs.readFileSync(path.join(ROOT, 'js/fea-stl.js'), 'utf8'));
eval(fs.readFileSync(path.join(ROOT, 'js/fea-step.js'), 'utf8'));
eval(fs.readFileSync(path.join(ROOT, 'js/fea-mesh.js'), 'utf8'));
eval(fs.readFileSync(path.join(ROOT, 'js/fea-viewer.js'), 'utf8'));
eval(fs.readFileSync(path.join(ROOT, 'js/cp-fea.js'), 'utf8'));

// ────────────────────────────────────────────────────────────────────────────
describe('veFEAMeshLabel', () => {
  test('bilinen tipler için etiket döner', () => {
    expect(veFEAMeshLabel('hex8')).toMatch(/Heks8/);
    expect(veFEAMeshLabel('wedge6')).toMatch(/Wedge/);
    expect(veFEAMeshLabel('tri3')).toMatch(/Tri3/);
    expect(veFEAMeshLabel('tet4')).toMatch(/Tet4/);
  });

  test('bilinmeyen tip için tipin kendisi döner', () => {
    expect(veFEAMeshLabel('foobar')).toBe('foobar');
  });
});

// ────────────────────────────────────────────────────────────────────────────
describe('Kutu → Heks8 structured mesh', () => {
  test('1×1×1 kutu, size=1 → 1 eleman, 8 düğüm', () => {
    var m = veFEAMeshFromGeometry({ type: 'box', params: { width: 1, height: 1, depth: 1 } }, { size: 1 });
    expect(m.type).toBe('hex8');
    expect(m.nodesPerElement).toBe(8);
    expect(m.nodes.length / 3).toBe(8);
    expect(m.elements.length / 8).toBe(1);
  });

  test('2×2×2 kutu, size=1 → 8 eleman, 27 düğüm', () => {
    var m = veFEAMeshFromGeometry({ type: 'box', params: { width: 2, height: 2, depth: 2 } }, { size: 1 });
    expect(m.elements.length / 8).toBe(8);
    expect(m.nodes.length / 3).toBe(27); // 3×3×3
  });

  test('10×10×10 kutu, size=2 → 5×5×5 eleman = 125', () => {
    var m = veFEAMeshFromGeometry({ type: 'box', params: { width: 10, height: 10, depth: 10 } }, { size: 2 });
    expect(m.elements.length / 8).toBe(125);
    expect(m.nodes.length / 3).toBe(216); // 6×6×6
    expect(m.grid).toEqual({ nx: 5, ny: 5, nz: 5 });
  });

  test('kutu mesh kütle merkezi orijinde olmalı (geometri ile uyumlu)', () => {
    var m = veFEAMeshFromGeometry({ type: 'box', params: { width: 10, height: 20, depth: 30 } }, { size: 5 });
    var sx = 0, sy = 0, sz = 0;
    var n = m.nodes.length / 3;
    for (var i = 0; i < n; i++) {
      sx += m.nodes[i*3]; sy += m.nodes[i*3+1]; sz += m.nodes[i*3+2];
    }
    expect(Math.abs(sx / n)).toBeLessThan(0.001);
    expect(Math.abs(sy / n)).toBeLessThan(0.001);
    expect(Math.abs(sz / n)).toBeLessThan(0.001);
  });

  test('size çok küçük olursa clamp uygulanır (VE_FEA_MESH_MIN_SIZE)', () => {
    var m = veFEAMeshFromGeometry({ type: 'box', params: { width: 5, height: 5, depth: 5 } }, { size: 0.01 });
    // size 0.5'e clamp olur → 10×10×10 = 1000 element
    expect(m.elements.length / 8).toBeLessThanOrEqual(2000);
    expect(m.elements.length / 8).toBeGreaterThan(100);
  });
});

// ────────────────────────────────────────────────────────────────────────────
describe('Silindir → Wedge6 mesh', () => {
  test('temel parametrelerle wedge6 oluşur', () => {
    var m = veFEAMeshFromGeometry({ type: 'cylinder', params: { radius: 10, height: 20, segments: 32 } }, { size: 5 });
    expect(m.type).toBe('wedge6');
    expect(m.nodesPerElement).toBe(6);
    expect(m.elements.length % 6).toBe(0);
    expect(m.elements.length / 6).toBeGreaterThan(0);
  });

  test('eleman sayısı = (nC + 2*nC*(nR-1)) * nA', () => {
    var m = veFEAMeshFromGeometry({ type: 'cylinder', params: { radius: 10, height: 20 } }, { size: 5 });
    var g = m.grid;
    var expected = (g.nCircum + 2 * g.nCircum * (g.nRadial - 1)) * g.nAxial;
    expect(m.elements.length / 6).toBe(expected);
  });

  test('tüm element indeksleri geçerli aralıkta', () => {
    var m = veFEAMeshFromGeometry({ type: 'cylinder', params: { radius: 10, height: 20 } }, { size: 5 });
    var maxIdx = m.nodes.length / 3 - 1;
    var ok = true;
    for (var i = 0; i < m.elements.length; i++) {
      if (m.elements[i] < 0 || m.elements[i] > maxIdx) { ok = false; break; }
    }
    expect(ok).toBe(true);
  });
});

// ────────────────────────────────────────────────────────────────────────────
describe('Şaft (içi boş silindir) → Heks8 annulus', () => {
  test('temel parametrelerle heks8 oluşur', () => {
    var m = veFEAMeshFromGeometry({ type: 'shaft', params: { outerRadius: 20, innerRadius: 8, length: 100 } }, { size: 5 });
    expect(m.type).toBe('hex8');
    expect(m.nodesPerElement).toBe(8);
    expect(m.elements.length / 8).toBeGreaterThan(0);
  });

  test('eleman sayısı = nR × nC × nA', () => {
    var m = veFEAMeshFromGeometry({ type: 'shaft', params: { outerRadius: 20, innerRadius: 8, length: 100 } }, { size: 5 });
    var g = m.grid;
    expect(m.elements.length / 8).toBe(g.nRadial * g.nCircum * g.nAxial);
  });

  test('düğüm sayısı = (nR+1) × nC × (nA+1)', () => {
    var m = veFEAMeshFromGeometry({ type: 'shaft', params: { outerRadius: 20, innerRadius: 8, length: 100 } }, { size: 5 });
    var g = m.grid;
    expect(m.nodes.length / 3).toBe((g.nRadial + 1) * g.nCircum * (g.nAxial + 1));
  });

  test('iç yarıçap dış yarıçaptan büyük olursa düzeltilir', () => {
    var m = veFEAMeshFromGeometry({ type: 'shaft', params: { outerRadius: 5, innerRadius: 50, length: 50 } }, { size: 5 });
    expect(m).not.toBeNull();
    expect(m.elements.length / 8).toBeGreaterThan(0);
  });
});

// ────────────────────────────────────────────────────────────────────────────
describe('Geçersiz geometri/giriş', () => {
  test('null/undefined geometri → null döner', () => {
    expect(veFEAMeshFromGeometry(null)).toBeNull();
    expect(veFEAMeshFromGeometry(undefined)).toBeNull();
    expect(veFEAMeshFromGeometry({})).toBeNull();
  });

  test('bilinmeyen tip → null döner', () => {
    expect(veFEAMeshFromGeometry({ type: 'unknown' })).toBeNull();
  });

  test('STL geometri rawDataB64 yoksa null', () => {
    expect(veFEAMeshFromGeometry({ type: 'stl' })).toBeNull();
  });
});

// ────────────────────────────────────────────────────────────────────────────
describe('veFEAComputeMeshMetrics', () => {
  test('kutu mesh için makul metrikler', () => {
    var m = veFEAMeshFromGeometry({ type: 'box', params: { width: 10, height: 10, depth: 10 } }, { size: 5 });
    var metrics = veFEAComputeMeshMetrics(m);
    expect(metrics.nodeCount).toBe(27);
    expect(metrics.elementCount).toBe(8);
    expect(metrics.elementType).toBe('hex8');
    expect(metrics.minSize).toBeCloseTo(5, 2);
    expect(metrics.maxSize).toBeCloseTo(5, 2);
    expect(metrics.avgSize).toBeCloseTo(5, 2);
  });

  test('null mesh → null metrikler', () => {
    expect(veFEAComputeMeshMetrics(null)).toBeNull();
  });
});

// ────────────────────────────────────────────────────────────────────────────
describe('veFEAMeshExtractEdges', () => {
  test('kutu Heks8 1 eleman → 12 kenar (24 float = 12 line)', () => {
    var m = veFEAMeshFromGeometry({ type: 'box', params: { width: 1, height: 1, depth: 1 } }, { size: 1 });
    var edges = veFEAMeshExtractEdges(m);
    // Her kenar 2 endpoint × 3 koord = 6 float
    expect(edges.length).toBe(12 * 6);
  });

  test('null mesh için null döner', () => {
    expect(veFEAMeshExtractEdges(null)).toBeNull();
  });
});

// ────────────────────────────────────────────────────────────────────────────
describe('STL yüzey mesh (vertex dedup)', () => {
  // 12 üçgenli küp (10×10×10) fixture'ı
  function buildCubeTriangles() {
    return [
      [0,0,0, 10,10,0, 10,0,0,  0,0,-1],
      [0,0,0, 0,10,0, 10,10,0,  0,0,-1],
      [0,0,10, 10,0,10, 10,10,10,  0,0,1],
      [0,0,10, 10,10,10, 0,10,10,  0,0,1],
      [0,0,0, 0,0,10, 0,10,10,  -1,0,0],
      [0,0,0, 0,10,10, 0,10,0,  -1,0,0],
      [10,0,0, 10,10,0, 10,10,10,  1,0,0],
      [10,0,0, 10,10,10, 10,0,10,  1,0,0],
      [0,0,0, 10,0,0, 10,0,10,  0,-1,0],
      [0,0,0, 10,0,10, 0,0,10,  0,-1,0],
      [0,10,0, 0,10,10, 10,10,10,  0,1,0],
      [0,10,0, 10,10,10, 10,10,0,  0,1,0]
    ];
  }
  function buildBinarySTLCube() {
    var tris = buildCubeTriangles();
    var ab = new ArrayBuffer(84 + tris.length * 50);
    var view = new DataView(ab);
    view.setUint32(80, tris.length, true);
    var offset = 84;
    for (var i = 0; i < tris.length; i++) {
      var t = tris[i];
      view.setFloat32(offset, t[9], true);
      view.setFloat32(offset + 4, t[10], true);
      view.setFloat32(offset + 8, t[11], true);
      offset += 12;
      for (var j = 0; j < 9; j++) view.setFloat32(offset + j * 4, t[j], true);
      offset += 36;
      view.setUint16(offset, 0, true);
      offset += 2;
    }
    return ab;
  }

  test('STL geometri + mode "surface" → Tri3 mesh, dedup\'lı düğümler', () => {
    // F3b sonrası default mode (auto) STL için voxel hex8 üretir.
    // Yüzey Tri3 mesh için explicit "surface" mode gerek.
    var stlBuf = buildBinarySTLCube();
    var b64 = veFEAArrayBufferToBase64(stlBuf);
    var m = veFEAMeshFromGeometry({ type: 'stl', rawDataB64: b64 }, { size: 5, mode: 'surface' });
    expect(m).not.toBeNull();
    expect(m.type).toBe('tri3');
    expect(m.nodesPerElement).toBe(3);
    expect(m.elements.length / 3).toBe(12); // 12 üçgen
    // Küp 8 unique vertex'e sahip (dedup sonrası)
    expect(m.nodes.length / 3).toBe(8);
  });
});

// ────────────────────────────────────────────────────────────────────────────
describe('veFEAFindUpstreamGeometryNode', () => {
  beforeEach(() => {
    global.nodes = [];
    global.connections = [];
  });

  test('bağlantı yoksa null döner', () => {
    expect(veFEAFindUpstreamGeometryNode('mesh-1')).toBeNull();
  });

  test('upstream geometri node\'unu bulur', () => {
    global.nodes = [
      { id: 'geom-1', type: 'fea-geometry', data: { geometry: { type: 'box' } } },
      { id: 'mesh-1', type: 'fea-mesh', data: {} }
    ];
    global.connections = [{ from: 'geom-1', to: 'mesh-1', fromPort: 'output', toPort: 'input' }];
    var result = veFEAFindUpstreamGeometryNode('mesh-1');
    expect(result).not.toBeNull();
    expect(result.id).toBe('geom-1');
  });

  test('yanlış tipte upstream varsa null döner', () => {
    global.nodes = [
      { id: 'foo', type: 'engine' },
      { id: 'mesh-1', type: 'fea-mesh' }
    ];
    global.connections = [{ from: 'foo', to: 'mesh-1' }];
    expect(veFEAFindUpstreamGeometryNode('mesh-1')).toBeNull();
  });
});

// ────────────────────────────────────────────────────────────────────────────
describe('veFEABuildMeshForNode (köprü)', () => {
  beforeEach(() => {
    global.nodes = [];
    global.connections = [];
    global.showToast = jest.fn();
    global.showNodeProperties = jest.fn();
    global.saveState = jest.fn();
    Object.keys(veFEAMeshCache).forEach((k) => delete veFEAMeshCache[k]);
  });

  test('upstream geometri yoksa warning toast atar, mesh hesaplamaz', () => {
    global.nodes = [{ id: 'mesh-1', type: 'fea-mesh', data: {} }];
    veFEABuildMeshForNode('mesh-1');
    expect(global.showToast).toHaveBeenCalled();
    var warns = global.showToast.mock.calls.filter((c) => c[1] === 'warning');
    expect(warns.length).toBeGreaterThan(0);
    expect(veFEAMeshCache['mesh-1']).toBeUndefined();
  });

  test('geometri varsa mesh hesaplar, cache + metrik + saveState', () => {
    global.nodes = [
      { id: 'geom-1', type: 'fea-geometry', data: { geometry: { type: 'box', params: { width: 10, height: 10, depth: 10 } } } },
      { id: 'mesh-1', type: 'fea-mesh', data: { meshSettings: { size: 5 } } }
    ];
    global.connections = [{ from: 'geom-1', to: 'mesh-1' }];
    veFEABuildMeshForNode('mesh-1');
    expect(veFEAMeshCache['mesh-1']).toBeDefined();
    expect(global.nodes[1].data.meshActive).toBe(true);
    expect(global.nodes[1].data.meshMetrics).toBeDefined();
    expect(global.nodes[1].data.meshMetrics.elementCount).toBe(8);
    expect(global.saveState).toHaveBeenCalled();
  });

  test('hesaplama sonrası success toast atılır', () => {
    global.nodes = [
      { id: 'geom-1', type: 'fea-geometry', data: { geometry: { type: 'box', params: { width: 4, height: 4, depth: 4 } } } },
      { id: 'mesh-1', type: 'fea-mesh', data: {} }
    ];
    global.connections = [{ from: 'geom-1', to: 'mesh-1' }];
    veFEABuildMeshForNode('mesh-1');
    var success = global.showToast.mock.calls.filter((c) => c[1] === 'success');
    expect(success.length).toBeGreaterThan(0);
  });
});

// ────────────────────────────────────────────────────────────────────────────
describe('veFEAClearMeshForNode', () => {
  test('cache + meshActive + meshMetrics temizlenir', () => {
    global.nodes = [{ id: 'mesh-1', type: 'fea-mesh', data: { meshActive: true, meshMetrics: { nodeCount: 8 } } }];
    veFEAMeshCache['mesh-1'] = { type: 'hex8' };
    global.showNodeProperties = jest.fn();
    global.saveState = jest.fn();
    veFEAClearMeshForNode('mesh-1');
    expect(veFEAMeshCache['mesh-1']).toBeUndefined();
    expect(global.nodes[0].data.meshActive).toBeUndefined();
    expect(global.nodes[0].data.meshMetrics).toBeUndefined();
  });
});

// ────────────────────────────────────────────────────────────────────────────
describe('cp-fea.js Mesh paneli render', () => {
  beforeEach(() => {
    global.nodes = [];
    global.connections = [];
    Object.keys(veFEAMeshCache).forEach((k) => delete veFEAMeshCache[k]);
  });

  test('upstream geometri yoksa "bağlı değil" uyarısı', () => {
    var node = { id: 'mesh-x', type: 'fea-mesh', data: {} };
    global.nodes = [node];
    var html = getFEAMeshPropertiesHTML(node);
    expect(html).toMatch(/bağlı değil/);
  });

  test('geometri bağlı varken etiket gösterilir', () => {
    global.nodes = [
      { id: 'geom-1', type: 'fea-geometry', data: { geometry: { type: 'box', params: { width: 10, height: 10, depth: 10 } } }, def: { name: 'Geometri' } },
      { id: 'mesh-1', type: 'fea-mesh', data: {} }
    ];
    global.connections = [{ from: 'geom-1', to: 'mesh-1' }];
    var html = getFEAMeshPropertiesHTML(global.nodes[1]);
    expect(html).toMatch(/Kutu|Geometri/);
    expect(html).not.toMatch(/bağlı değil/);
  });

  test('canvas + Sığdır + Tam Ekran butonları render', () => {
    var node = { id: 'mesh-c', type: 'fea-mesh', data: {} };
    global.nodes = [node];
    var html = getFEAMeshPropertiesHTML(node);
    expect(html).toMatch(/id="ve-fea-mesh-canvas-mesh-c"/);
    expect(html).toMatch(/veFEAFitPreviewForNode\('mesh-c'\)/);
    expect(html).toMatch(/veFEAOpenFullscreenViewer\('mesh-c'\)/);
  });

  test('"Mesh Oluştur" butonu geometri yoksa disabled', () => {
    var node = { id: 'mesh-d', type: 'fea-mesh', data: {} };
    global.nodes = [node];
    var html = getFEAMeshPropertiesHTML(node);
    expect(html).toMatch(/<button\s+disabled[^>]*onclick="veFEASubmitMeshBuild/);
  });

  test('Mesh aktifken metrik değerleri ve "Mesh\'i Sil" butonu', () => {
    var node = {
      id: 'mesh-e',
      type: 'fea-mesh',
      data: {
        meshSettings: { size: 5 },
        meshActive: true,
        meshMetrics: { nodeCount: 27, elementCount: 8, elementType: 'hex8', minSize: 5, maxSize: 5, avgSize: 5, computeMs: 12 }
      }
    };
    global.nodes = [node];
    var html = getFEAMeshPropertiesHTML(node);
    expect(html).toMatch(/Heks8/);
    expect(html).toMatch(/27/);
    expect(html).toMatch(/Mesh.{0,4}i Sil/);
  });

  test('Coarse/Medium/Fine preset butonları render', () => {
    var node = { id: 'mesh-f', type: 'fea-mesh', data: {} };
    global.nodes = [node];
    var html = getFEAMeshPropertiesHTML(node);
    expect(html).toMatch(/Coarse/);
    expect(html).toMatch(/Medium/);
    expect(html).toMatch(/Fine/);
    expect(html).toMatch(/veFEASetMeshSizePreset/);
  });
});

// ────────────────────────────────────────────────────────────────────────────
describe('Rectangular tube (rectTube) primitif - sweep mesh', () => {
  test('rectTube mesh oluşturulur (Heks8, Z sweep)', () => {
    var m = veFEAMeshFromGeometry({ type: 'rectTube', params: { width: 60, height: 40, thickness: 5, length: 100 } }, { size: 5 });
    expect(m).not.toBeNull();
    expect(m.type).toBe('hex8');
    expect(m.geometryType).toBe('rectTube');
    expect(m.sweepAxis).toBe('Z');
    expect(m.elements.length / 8).toBeGreaterThan(0);
  });

  test('İç dikdörtgen boş — eleman sayısı tam dolu kutudan az', () => {
    var hollow = veFEAMeshFromGeometry({ type: 'rectTube', params: { width: 60, height: 40, thickness: 5, length: 60 } }, { size: 5 });
    var full = veFEAMeshFromGeometry({ type: 'box', params: { width: 60, height: 40, depth: 60 } }, { size: 5 });
    expect(hollow.elements.length / 8).toBeLessThan(full.elements.length / 8);
    // Hollow elementCount yaklaşık olarak: (12·8·12 - 2·6·12) = 1152 - 144 = 1008
    // (kesin değer iç dikdörtgenin grid alignment'ına bağlı)
  });

  test('Thickness çok büyükse clamp (max = min(w,h)/2)', () => {
    var p = veFEANormalizePrimitiveParams('rectTube', { width: 40, height: 30, thickness: 100, length: 50 });
    expect(p.thickness).toBeLessThan(15); // min(40,30)/2 - 0.1 = 14.9
    expect(p.thickness).toBeGreaterThan(0);
  });

  test('Tüm element indeksleri geçerli', () => {
    var m = veFEAMeshFromGeometry({ type: 'rectTube', params: { width: 60, height: 40, thickness: 5, length: 80 } }, { size: 10 });
    var maxIdx = m.nodes.length / 3 - 1;
    var ok = true;
    for (var i = 0; i < m.elements.length; i++) {
      if (m.elements[i] < 0 || m.elements[i] > maxIdx) { ok = false; break; }
    }
    expect(ok).toBe(true);
  });

  test('Hacim hesabı: dış − iç × uzunluk', () => {
    var stats = veFEAPrimitiveStats('rectTube', { width: 60, height: 40, thickness: 5, length: 100 });
    // (60·40 - 50·30)·100 = (2400 - 1500)·100 = 90000 mm³
    expect(stats.volume).toBeCloseTo(90000, 0);
  });

  test('Named selections üretilir', () => {
    var m = veFEAMeshFromGeometry({ type: 'rectTube', params: { width: 60, height: 40, thickness: 5, length: 80 } }, { size: 10 });
    expect(m.namedSelections).toBeDefined();
    expect(Object.keys(m.namedSelections).length).toBeGreaterThan(0);
  });
});

// ────────────────────────────────────────────────────────────────────────────
describe('Sweep axis bilgisi mesh metrics\'e yansır', () => {
  beforeEach(() => {
    global.nodes = [];
    global.connections = [];
    global.showToast = jest.fn();
    global.showNodeProperties = jest.fn();
    global.saveState = jest.fn();
    Object.keys(veFEAMeshCache).forEach((k) => delete veFEAMeshCache[k]);
  });

  test('Silindir build → metrics.sweepAxis === "Y"', () => {
    global.nodes = [
      { id: 'geom-c', type: 'fea-geometry', data: { geometry: { type: 'cylinder', params: { radius: 10, height: 20 } } } },
      { id: 'mesh-c', type: 'fea-mesh', data: { meshSettings: { size: 5 } } }
    ];
    global.connections = [{ from: 'geom-c', to: 'mesh-c' }];
    veFEABuildMeshForNode('mesh-c');
    expect(global.nodes[1].data.meshMetrics.sweepAxis).toBe('Y');
  });

  test('Box build → metrics.sweepAxis null/undefined', () => {
    global.nodes = [
      { id: 'geom-b', type: 'fea-geometry', data: { geometry: { type: 'box', params: { width: 10, height: 10, depth: 10 } } } },
      { id: 'mesh-b', type: 'fea-mesh', data: { meshSettings: { size: 5 } } }
    ];
    global.connections = [{ from: 'geom-b', to: 'mesh-b' }];
    veFEABuildMeshForNode('mesh-b');
    expect(global.nodes[1].data.meshMetrics.sweepAxis).toBeFalsy();
  });

  test('RectTube build → metrics.sweepAxis === "Z"', () => {
    global.nodes = [
      { id: 'geom-r', type: 'fea-geometry', data: { geometry: { type: 'rectTube', params: { width: 60, height: 40, thickness: 5, length: 100 } } } },
      { id: 'mesh-r', type: 'fea-mesh', data: { meshSettings: { size: 10 } } }
    ];
    global.connections = [{ from: 'geom-r', to: 'mesh-r' }];
    veFEABuildMeshForNode('mesh-r');
    expect(global.nodes[1].data.meshMetrics.sweepAxis).toBe('Z');
  });
});

// ────────────────────────────────────────────────────────────────────────────
describe('veFEAApplyLocalSizing (boundary bias)', () => {
  test('biasStrength=0 → no-op (düğümler değişmez)', () => {
    var m = veFEAMeshFromGeometry({ type: 'box', params: { width: 10, height: 10, depth: 10 } }, { size: 5 });
    var clone = veFEAApplyLocalSizing(m, { selection: 'faceXMin', biasStrength: 0 });
    expect(clone).toBe(m); // no clone, original döner
  });

  test('faceXMin + strength=0.5 → X eksende düğümler -x\'e doğru kümeli', () => {
    var m = veFEAMeshFromGeometry({ type: 'box', params: { width: 10, height: 10, depth: 10 } }, { size: 2 });
    var biased = veFEAApplyLocalSizing(m, { selection: 'faceXMin', biasStrength: 0.5 });
    // Düğümlerin x-koordinatları min'e (=-5) doğru sıkışmalı.
    // Orijinal uniform: -5, -3, -1, 1, 3, 5. Power p=2.5 ile:
    // t=0→0, t=0.2→0.2^2.5=0.018, t=0.4→0.103, t=0.6→0.279, t=0.8→0.573, t=1→1
    // Yeni x: -5, -4.82, -3.97, -2.21, 0.73, 5
    var xs = [];
    var n = biased.nodes.length / 3;
    for (var i = 0; i < n; i++) xs.push(biased.nodes[i * 3]);
    var uniqueXs = Array.from(new Set(xs.map(function(x){return x.toFixed(3);}))).map(Number).sort(function(a,b){return a-b;});
    // İlk fark (en küçük dx) son farktan daha küçük olmalı
    var firstDx = uniqueXs[1] - uniqueXs[0];
    var lastDx = uniqueXs[uniqueXs.length - 1] - uniqueXs[uniqueXs.length - 2];
    expect(firstDx).toBeLessThan(lastDx);
  });

  test('faceXMax + strength=0.5 → +x\'e doğru kümeli (ters yön)', () => {
    var m = veFEAMeshFromGeometry({ type: 'box', params: { width: 10, height: 10, depth: 10 } }, { size: 2 });
    var biased = veFEAApplyLocalSizing(m, { selection: 'faceXMax', biasStrength: 0.5 });
    var xs = [];
    var n = biased.nodes.length / 3;
    for (var i = 0; i < n; i++) xs.push(biased.nodes[i * 3]);
    var uniqueXs = Array.from(new Set(xs.map(function(x){return x.toFixed(3);}))).map(Number).sort(function(a,b){return a-b;});
    var firstDx = uniqueXs[1] - uniqueXs[0];
    var lastDx = uniqueXs[uniqueXs.length - 1] - uniqueXs[uniqueXs.length - 2];
    // Sıkışma max'ta → son dx küçük olmalı
    expect(lastDx).toBeLessThan(firstDx);
  });

  test('Sınırlar korunur (minX, maxX değişmez)', () => {
    var m = veFEAMeshFromGeometry({ type: 'box', params: { width: 10, height: 10, depth: 10 } }, { size: 2 });
    var biased = veFEAApplyLocalSizing(m, { selection: 'faceXMin', biasStrength: 0.8 });
    var minX = Infinity, maxX = -Infinity;
    var n = biased.nodes.length / 3;
    for (var i = 0; i < n; i++) {
      var x = biased.nodes[i * 3];
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
    }
    expect(minX).toBeCloseTo(-5, 4);
    expect(maxX).toBeCloseTo(5, 4);
  });

  test('Bilinmeyen selection → mesh aynen döner', () => {
    var m = veFEAMeshFromGeometry({ type: 'box', params: { width: 10, height: 10, depth: 10 } }, { size: 5 });
    var out = veFEAApplyLocalSizing(m, { selection: 'unknownFace', biasStrength: 0.5 });
    expect(out).toBe(m);
  });

  test('biasStrength clamp [0, 1]', () => {
    var m = veFEAMeshFromGeometry({ type: 'box', params: { width: 10, height: 10, depth: 10 } }, { size: 2 });
    var biased = veFEAApplyLocalSizing(m, { selection: 'faceXMin', biasStrength: 2.0 }); // > 1
    // Clamp 1, exponent 4 — düğümler hâlâ -5'e yakın kümeli
    expect(biased.nodes).not.toBe(m.nodes);
  });

  test('faceTop (silindir) + strength → Y eksende üst\'e kümeli', () => {
    var m = veFEAMeshFromGeometry({ type: 'cylinder', params: { radius: 5, height: 20 } }, { size: 5 });
    var biased = veFEAApplyLocalSizing(m, { selection: 'faceTop', biasStrength: 0.6 });
    var ys = [];
    var n = biased.nodes.length / 3;
    for (var i = 0; i < n; i++) ys.push(biased.nodes[i * 3 + 1]);
    var uniqueYs = Array.from(new Set(ys.map(function(y){return y.toFixed(3);}))).map(Number).sort(function(a,b){return a-b;});
    var firstDy = uniqueYs[1] - uniqueYs[0];
    var lastDy = uniqueYs[uniqueYs.length - 1] - uniqueYs[uniqueYs.length - 2];
    expect(lastDy).toBeLessThan(firstDy);
  });

  test('Eleman bağlantıları korunur (sadece düğüm konumu değişir)', () => {
    var m = veFEAMeshFromGeometry({ type: 'box', params: { width: 10, height: 10, depth: 10 } }, { size: 5 });
    var biased = veFEAApplyLocalSizing(m, { selection: 'faceXMin', biasStrength: 0.7 });
    expect(biased.elements).toBe(m.elements); // aynı referans
    expect(biased.elements.length).toBe(m.elements.length);
  });
});

// ────────────────────────────────────────────────────────────────────────────
describe('veFEAMeshFromGeometry — localSizing entegrasyonu', () => {
  test('opts.localSizing build sırasında uygulanır', () => {
    var m1 = veFEAMeshFromGeometry({ type: 'box', params: { width: 10, height: 10, depth: 10 } }, { size: 2 });
    var m2 = veFEAMeshFromGeometry({ type: 'box', params: { width: 10, height: 10, depth: 10 } },
      { size: 2, localSizing: { selection: 'faceXMin', biasStrength: 0.5 } });
    // Aynı eleman sayısı, farklı düğüm konumları
    expect(m2.elements.length).toBe(m1.elements.length);
    expect(m2.nodes).not.toBe(m1.nodes);
    expect(m2.localSizingApplied).toBeDefined();
  });

  test('localSizing + midSideNodes birlikte çalışır', () => {
    var m = veFEAMeshFromGeometry({ type: 'box', params: { width: 10, height: 10, depth: 10 } },
      { size: 5, midSideNodes: true, localSizing: { selection: 'faceXMin', biasStrength: 0.5 } });
    expect(m.type).toBe('hex20');
    // Midpoint düğümleri biased corner'lardan hesaplandı
    expect(m.nodes.length / 3).toBeGreaterThan(27);
  });
});

// ────────────────────────────────────────────────────────────────────────────
describe('cp-fea.js Mesh paneli — Lokal yoğunlaştırma UI', () => {
  beforeEach(() => {
    global.nodes = [];
    global.connections = [];
  });

  test('Dropdown + slider render edilir', () => {
    var node = { id: 'mesh-ls1', type: 'fea-mesh', data: {} };
    global.nodes = [node];
    var html = getFEAMeshPropertiesHTML(node);
    expect(html).toMatch(/id="ve-fea-mesh-local-sel-mesh-ls1"/);
    expect(html).toMatch(/id="ve-fea-mesh-local-bias-mesh-ls1"/);
    expect(html).toMatch(/Lokal Yoğunlaştırma/);
    expect(html).toMatch(/faceXMin/);
    expect(html).toMatch(/faceXMax/);
    expect(html).toMatch(/faceTop/);
  });

  test('Persisted ayarlar dropdown\'a yansır', () => {
    var node = {
      id: 'mesh-ls2',
      type: 'fea-mesh',
      data: { meshSettings: { size: 5, localSizing: { selection: 'faceYMax', biasStrength: 0.6 } } }
    };
    global.nodes = [node];
    var html = getFEAMeshPropertiesHTML(node);
    expect(html).toMatch(/value="faceYMax"\s+selected/);
    expect(html).toMatch(/value="60"/);
    expect(html).toMatch(/60%/);
  });
});

// ────────────────────────────────────────────────────────────────────────────
describe('Curvature-based refinement', () => {
  test('Disabled (default): nC mevcut size-based hesaplama', () => {
    var m = veFEAMeshFromGeometry({ type: 'cylinder', params: { radius: 10, height: 20 } }, { size: 10 });
    var nC = m.grid.nCircum;
    // size=10 → nC = round(2π·10/10) = round(6.28) = 6
    expect(nC).toBe(6);
  });

  test('Enabled normalAngleDeg=18° → nC ≥ 20 (silindir)', () => {
    var m = veFEAMeshFromGeometry({ type: 'cylinder', params: { radius: 10, height: 20 } },
      { size: 10, curvatureRefinement: { enabled: true, normalAngleDeg: 18 } });
    // 360/18 = 20 segment minimum
    expect(m.grid.nCircum).toBeGreaterThanOrEqual(20);
  });

  test('Enabled normalAngleDeg=5° → çok daha fine (≥ 72 segment)', () => {
    var m = veFEAMeshFromGeometry({ type: 'cylinder', params: { radius: 10, height: 20 } },
      { size: 10, curvatureRefinement: { enabled: true, normalAngleDeg: 5 } });
    expect(m.grid.nCircum).toBeGreaterThanOrEqual(72);
  });

  test('Şaft için curvature refinement uygulanır', () => {
    var m = veFEAMeshFromGeometry({ type: 'shaft', params: { outerRadius: 20, innerRadius: 8, length: 100 } },
      { size: 20, curvatureRefinement: { enabled: true, normalAngleDeg: 18 } });
    expect(m.grid.nCircum).toBeGreaterThanOrEqual(20);
  });

  test('Kutu mesh curvature\'dan etkilenmez (planar)', () => {
    var m1 = veFEAMeshFromGeometry({ type: 'box', params: { width: 10, height: 10, depth: 10 } }, { size: 5 });
    var m2 = veFEAMeshFromGeometry({ type: 'box', params: { width: 10, height: 10, depth: 10 } },
      { size: 5, curvatureRefinement: { enabled: true, normalAngleDeg: 5 } });
    expect(m1.elements.length).toBe(m2.elements.length);
  });

  test('Size-based nC daha büyükse curvature override etmez', () => {
    var m = veFEAMeshFromGeometry({ type: 'cylinder', params: { radius: 100, height: 20 } },
      { size: 5, curvatureRefinement: { enabled: true, normalAngleDeg: 60 } });
    // size-based: nC ≈ round(2π·100/5) = round(125.6) = 126
    // curvature: 360/60 = 6
    // max(126, 6) = 126 → size kazandı
    expect(m.grid.nCircum).toBeGreaterThan(6);
  });

  test('Bozuk normalAngleDeg değeri clamp edilir', () => {
    var m = veFEAMeshFromGeometry({ type: 'cylinder', params: { radius: 10, height: 20 } },
      { size: 10, curvatureRefinement: { enabled: true, normalAngleDeg: -5 } });
    // Clamp 1 → çok büyük segment
    expect(m.grid.nCircum).toBeGreaterThanOrEqual(360);
  });
});

// ────────────────────────────────────────────────────────────────────────────
describe('cp-fea.js Mesh paneli — Curvature refinement UI', () => {
  beforeEach(() => {
    global.nodes = [];
    global.connections = [];
  });

  test('Checkbox + açı input\'u render edilir', () => {
    var node = { id: 'mesh-cr1', type: 'fea-mesh', data: {} };
    global.nodes = [node];
    var html = getFEAMeshPropertiesHTML(node);
    expect(html).toMatch(/id="ve-fea-mesh-curv-mesh-cr1"/);
    expect(html).toMatch(/id="ve-fea-mesh-curv-ang-mesh-cr1"/);
    expect(html).toMatch(/Eğrilik tabanlı incelt/);
  });

  test('Default değerler: disabled + 18°', () => {
    var node = { id: 'mesh-cr2', type: 'fea-mesh', data: {} };
    global.nodes = [node];
    var html = getFEAMeshPropertiesHTML(node);
    var checkboxMatch = html.match(/<input type="checkbox"[^>]*id="ve-fea-mesh-curv-mesh-cr2"[^>]*>/);
    expect(checkboxMatch[0]).not.toMatch(/checked/);
    expect(html).toMatch(/value="18"/);
  });

  test('Persisted ayarlar UI\'da işaretlenir', () => {
    var node = {
      id: 'mesh-cr3',
      type: 'fea-mesh',
      data: { meshSettings: { size: 10, curvatureRefinement: { enabled: true, normalAngleDeg: 10 } } }
    };
    global.nodes = [node];
    var html = getFEAMeshPropertiesHTML(node);
    var checkboxMatch = html.match(/<input type="checkbox"[^>]*id="ve-fea-mesh-curv-mesh-cr3"[^>]*>/);
    expect(checkboxMatch[0]).toMatch(/checked/);
    expect(html).toMatch(/value="10"/);
  });
});

// ────────────────────────────────────────────────────────────────────────────
describe('veFEAComputePerElementQuality (heat map için)', () => {
  test('aspect metriği — eleman sayısı kadar değer', () => {
    var m = veFEAMeshFromGeometry({ type: 'box', params: { width: 10, height: 10, depth: 10 } }, { size: 5 });
    var vals = veFEAComputePerElementQuality(m, 'aspect');
    expect(vals.length).toBe(m.elements.length / m.nodesPerElement);
    // Küp için her elemanın aspect'i ≈ 1
    for (var i = 0; i < vals.length; i++) {
      expect(vals[i]).toBeCloseTo(1, 2);
    }
  });

  test('skewness metriği — küp için ≈ 0', () => {
    var m = veFEAMeshFromGeometry({ type: 'box', params: { width: 10, height: 10, depth: 10 } }, { size: 5 });
    var vals = veFEAComputePerElementQuality(m, 'skewness');
    for (var i = 0; i < vals.length; i++) {
      expect(vals[i]).toBeCloseTo(0, 3);
    }
  });

  test('minAngle metriği — küp için ≈ 90', () => {
    var m = veFEAMeshFromGeometry({ type: 'box', params: { width: 10, height: 10, depth: 10 } }, { size: 5 });
    var vals = veFEAComputePerElementQuality(m, 'minAngle');
    for (var i = 0; i < vals.length; i++) {
      expect(vals[i]).toBeCloseTo(90, 1);
    }
  });

  test('jacobianRatio metriği — küp için ≈ 1', () => {
    var m = veFEAMeshFromGeometry({ type: 'box', params: { width: 10, height: 10, depth: 10 } }, { size: 5 });
    var vals = veFEAComputePerElementQuality(m, 'jacobianRatio');
    for (var i = 0; i < vals.length; i++) {
      expect(vals[i]).toBeCloseTo(1, 2);
    }
  });

  test('null mesh → null', () => {
    expect(veFEAComputePerElementQuality(null, 'aspect')).toBeNull();
  });

  test('Tet4 küp için tüm metrikler hesaplanır', () => {
    var m = veFEAMeshFromGeometry({ type: 'box', params: { width: 10, height: 10, depth: 10 } }, { size: 5, elementType: 'tet4' });
    var asp = veFEAComputePerElementQuality(m, 'aspect');
    var sk = veFEAComputePerElementQuality(m, 'skewness');
    expect(asp.length).toBe(48);
    expect(sk.length).toBe(48);
  });
});

// ────────────────────────────────────────────────────────────────────────────
describe('veFEAExtractSurfaceTriangles', () => {
  test('Tek küp hex8 → 12 yüzey üçgeni (6 yüz × 2 tri)', () => {
    var m = veFEAMeshFromGeometry({ type: 'box', params: { width: 1, height: 1, depth: 1 } }, { size: 1 });
    var surf = veFEAExtractSurfaceTriangles(m);
    expect(surf.positions.length / 9).toBe(12);
    expect(surf.elementIds.length).toBe(12);
  });

  test('2×1×1 hex (2 eleman, ortak iç yüz) → 10 yüz × 2 tri = 20', () => {
    var m = veFEAMeshFromGeometry({ type: 'box', params: { width: 2, height: 1, depth: 1 } }, { size: 1 });
    // 2 hex × 6 face = 12 face. Ortak 1 iç face × 2 = 2 (dahili). Boundary = 10
    var surf = veFEAExtractSurfaceTriangles(m);
    expect(surf.positions.length / 9).toBe(20); // 10 quad × 2 tri
  });

  test('Tri3 mesh için doğrudan elementler döner', () => {
    var tri = {
      type: 'tri3',
      nodes: new Float32Array([0,0,0, 1,0,0, 0,1,0, 1,1,0]),
      elements: new Uint32Array([0,1,2, 1,3,2]),
      nodesPerElement: 3
    };
    var surf = veFEAExtractSurfaceTriangles(tri);
    expect(surf.positions.length / 9).toBe(2);
  });

  test('null/boş için null', () => {
    expect(veFEAExtractSurfaceTriangles(null)).toBeNull();
  });
});

// ────────────────────────────────────────────────────────────────────────────
describe('veFEAJetColor', () => {
  test('t=0 → mavi', () => {
    var c = veFEAJetColor(0);
    expect(c[0]).toBeCloseTo(0, 2); // R
    expect(c[2]).toBeGreaterThan(0.5); // B
  });

  test('t=1 → kırmızı', () => {
    var c = veFEAJetColor(1);
    expect(c[0]).toBeGreaterThan(0.5); // R
    expect(c[2]).toBeCloseTo(0, 2); // B
  });

  test('t=0.5 → yeşil/sarı civarı', () => {
    var c = veFEAJetColor(0.5);
    expect(c[1]).toBeGreaterThan(0.5); // G
  });

  test('out-of-range clamp', () => {
    expect(veFEAJetColor(-1)[2]).toBeGreaterThan(0); // mavi
    expect(veFEAJetColor(2)[0]).toBeGreaterThan(0); // kırmızı
  });

  test('NaN → t=0 (mavi)', () => {
    var c = veFEAJetColor(NaN);
    expect(c[2]).toBeGreaterThan(0); // B aktif → mavi tarafı
  });
});

// ────────────────────────────────────────────────────────────────────────────
describe('veFEAApplyHeatMap köprüsü', () => {
  beforeEach(() => {
    global.nodes = [];
    global.connections = [];
    global.showToast = jest.fn();
    global.showNodeProperties = jest.fn();
    global.saveState = jest.fn();
    Object.keys(veFEAMeshCache).forEach((k) => delete veFEAMeshCache[k]);
    Object.keys(veFEAViewerRegistry).forEach((k) => delete veFEAViewerRegistry[k]);
  });

  test('metric set → heatMapMetric data\'ya yazılır', () => {
    global.nodes = [{ id: 'mesh-h1', type: 'fea-mesh', data: {} }];
    veFEAApplyHeatMap('mesh-h1', 'aspect');
    expect(global.nodes[0].data.heatMapMetric).toBe('aspect');
  });

  test('"off" → heatMapMetric null', () => {
    global.nodes = [{ id: 'mesh-h2', type: 'fea-mesh', data: { heatMapMetric: 'skewness' } }];
    veFEAApplyHeatMap('mesh-h2', 'off');
    expect(global.nodes[0].data.heatMapMetric).toBeNull();
  });

  test('Bilinmeyen node sessizce çıkar', () => {
    expect(() => veFEAApplyHeatMap('nonexistent', 'aspect')).not.toThrow();
  });

  test('Solid mode: heatMapMetric="solid"', () => {
    global.nodes = [{ id: 'mesh-h-s', type: 'fea-mesh', data: {} }];
    veFEAApplyHeatMap('mesh-h-s', 'solid');
    expect(global.nodes[0].data.heatMapMetric).toBe('solid');
  });

  test('Solid+Edges mode: heatMapMetric="solid-edges"', () => {
    global.nodes = [{ id: 'mesh-h-se', type: 'fea-mesh', data: {} }];
    veFEAApplyHeatMap('mesh-h-se', 'solid-edges');
    expect(global.nodes[0].data.heatMapMetric).toBe('solid-edges');
  });

  test('Mesh clear sonrası heatMapMetric temizlenir', () => {
    global.nodes = [
      { id: 'geom-1', type: 'fea-geometry', data: { geometry: { type: 'box', params: { width: 10, height: 10, depth: 10 } } } },
      { id: 'mesh-c', type: 'fea-mesh', data: { meshSettings: { size: 5 } } }
    ];
    global.connections = [{ from: 'geom-1', to: 'mesh-c' }];
    veFEABuildMeshForNode('mesh-c');
    veFEAApplyHeatMap('mesh-c', 'aspect');
    expect(global.nodes[1].data.heatMapMetric).toBe('aspect');
    veFEAClearMeshForNode('mesh-c');
    expect(global.nodes[1].data.heatMapMetric).toBeUndefined();
  });
});

// ────────────────────────────────────────────────────────────────────────────
describe('cp-fea.js Mesh paneli — Heat Map seçici', () => {
  beforeEach(() => {
    global.nodes = [];
    global.connections = [];
  });

  test('Mesh varsa Görünüm Modu dropdown render edilir (7 seçenek: 3 standart + 4 heat map)', () => {
    var node = {
      id: 'mesh-hm1',
      type: 'fea-mesh',
      data: {
        meshActive: true,
        meshMetrics: { nodeCount: 27, elementCount: 8, elementType: 'hex8', minSize: 5, maxSize: 5, avgSize: 5 }
      }
    };
    global.nodes = [node];
    var html = getFEAMeshPropertiesHTML(node);
    expect(html).toMatch(/Görünüm Modu/);
    expect(html).toMatch(/value="off"/);
    expect(html).toMatch(/value="solid"/);
    expect(html).toMatch(/value="solid-edges"/);
    expect(html).toMatch(/value="aspect"/);
    expect(html).toMatch(/value="skewness"/);
    expect(html).toMatch(/value="minAngle"/);
    expect(html).toMatch(/value="jacobianRatio"/);
  });

  test('Aktif heatMapMetric option\'ı seçili gelir', () => {
    var node = {
      id: 'mesh-hm2',
      type: 'fea-mesh',
      data: {
        meshActive: true,
        heatMapMetric: 'skewness',
        meshMetrics: { nodeCount: 27, elementCount: 8, elementType: 'hex8', minSize: 5, maxSize: 5, avgSize: 5 }
      }
    };
    global.nodes = [node];
    var html = getFEAMeshPropertiesHTML(node);
    expect(html).toMatch(/value="skewness"\s+selected/);
  });

  test('Mesh yokken Heat Map kullanılamaz mesajı', () => {
    var node = { id: 'mesh-hm3', type: 'fea-mesh', data: {} };
    global.nodes = [node];
    var html = getFEAMeshPropertiesHTML(node);
    expect(html).toMatch(/Mesh oluşturulduktan sonra kullanılabilir/);
  });
});

// ────────────────────────────────────────────────────────────────────────────
describe('veFEAComputeQualityMetrics', () => {
  test('Küp mesh için aspect ratio ≈ 1.0 (ideal küp)', () => {
    var m = veFEAMeshFromGeometry({ type: 'box', params: { width: 10, height: 10, depth: 10 } }, { size: 5 });
    var q = veFEAComputeQualityMetrics(m);
    expect(q.elementCount).toBe(8);
    expect(q.aspectRatio.min).toBeCloseTo(1, 2);
    expect(q.aspectRatio.max).toBeCloseTo(1, 2);
    expect(q.aspectRatio.avg).toBeCloseTo(1, 2);
    expect(q.aspectRatio.poorCount).toBe(0);
  });

  test('Küp mesh için skewness ≈ 0 (ideal yüzler)', () => {
    var m = veFEAMeshFromGeometry({ type: 'box', params: { width: 10, height: 10, depth: 10 } }, { size: 5 });
    var q = veFEAComputeQualityMetrics(m);
    expect(q.skewness.min).toBeCloseTo(0, 3);
    expect(q.skewness.max).toBeCloseTo(0, 3);
    expect(q.skewness.poorCount).toBe(0);
  });

  test('Küp mesh için iç açılar ≈ 90°', () => {
    var m = veFEAMeshFromGeometry({ type: 'box', params: { width: 10, height: 10, depth: 10 } }, { size: 5 });
    var q = veFEAComputeQualityMetrics(m);
    expect(q.angle.min).toBeCloseTo(90, 1);
    expect(q.angle.max).toBeCloseTo(90, 1);
  });

  test('Dikdörtgen prizma (10×30×5) için aspect > 1', () => {
    var m = veFEAMeshFromGeometry({ type: 'box', params: { width: 10, height: 30, depth: 5 } }, { size: 10 });
    var q = veFEAComputeQualityMetrics(m);
    // size=10 → 1×3×1 grid; her eleman 10×10×5 (z yönünde 5) → aspect = 10/5 = 2
    expect(q.aspectRatio.min).toBeGreaterThan(1);
    expect(q.aspectRatio.max).toBeGreaterThan(1.5);
  });

  test('Silindir wedge mesh için aspect ratio ≥ 1', () => {
    var m = veFEAMeshFromGeometry({ type: 'cylinder', params: { radius: 10, height: 20 } }, { size: 5 });
    var q = veFEAComputeQualityMetrics(m);
    expect(q.aspectRatio.min).toBeGreaterThanOrEqual(1);
    expect(q.elementCount).toBeGreaterThan(0);
  });

  test('Tet4 küp mesh için makul kalite', () => {
    var m = veFEAMeshFromGeometry({ type: 'box', params: { width: 10, height: 10, depth: 10 } }, { size: 5, elementType: 'tet4' });
    var q = veFEAComputeQualityMetrics(m);
    expect(q.elementCount).toBe(48); // 8 hex × 6 tet
    // Tet4 6-split — bazı tetlerin aspect ratio'su yüksek olabilir ama hepsi geçerli
    expect(q.aspectRatio.min).toBeGreaterThan(0);
    expect(q.angle.min).toBeGreaterThan(0);
    expect(q.angle.max).toBeLessThan(180);
  });

  test('Histogram bin sayıları doğru toplanır', () => {
    var m = veFEAMeshFromGeometry({ type: 'box', params: { width: 10, height: 10, depth: 10 } }, { size: 5 });
    var q = veFEAComputeQualityMetrics(m);
    var arSum = 0;
    q.aspectRatio.histogram.bins.forEach(function(b) { arSum += b; });
    expect(arSum).toBe(q.elementCount);
    var skSum = 0;
    q.skewness.histogram.bins.forEach(function(b) { skSum += b; });
    expect(skSum).toBe(q.elementCount);
  });

  test('null/error mesh → null döner', () => {
    expect(veFEAComputeQualityMetrics(null)).toBeNull();
    expect(veFEAComputeQualityMetrics({ error: 'voxel-too-many' })).toBeNull();
  });

  test('Hex20 kuadratik mesh için corner-only kalite metrikleri', () => {
    var m = veFEAMeshFromGeometry({ type: 'box', params: { width: 10, height: 10, depth: 10 } }, { size: 5, midSideNodes: true });
    expect(m.type).toBe('hex20');
    var q = veFEAComputeQualityMetrics(m);
    expect(q.cornerCount).toBe(8);
    expect(q.aspectRatio.min).toBeCloseTo(1, 2);
  });

  test('Build sonrası meshMetrics.quality eklenir', () => {
    global.nodes = [
      { id: 'geom-1', type: 'fea-geometry', data: { geometry: { type: 'box', params: { width: 10, height: 10, depth: 10 } } } },
      { id: 'mesh-1', type: 'fea-mesh', data: { meshSettings: { size: 5 } } }
    ];
    global.connections = [{ from: 'geom-1', to: 'mesh-1' }];
    global.showToast = jest.fn();
    global.showNodeProperties = jest.fn();
    global.saveState = jest.fn();
    Object.keys(veFEAMeshCache).forEach((k) => delete veFEAMeshCache[k]);
    veFEABuildMeshForNode('mesh-1');
    expect(global.nodes[1].data.meshMetrics.quality).toBeDefined();
    expect(global.nodes[1].data.meshMetrics.quality.aspectRatio).toBeDefined();
    expect(global.nodes[1].data.meshMetrics.quality.skewness).toBeDefined();
    expect(global.nodes[1].data.meshMetrics.quality.angle).toBeDefined();
  });
});

// ────────────────────────────────────────────────────────────────────────────
describe('cp-fea.js Mesh paneli — Kalite Metrikleri (histogram)', () => {
  beforeEach(() => {
    global.nodes = [];
    global.connections = [];
  });

  test('Mesh yokken kalite mesajı gösterilir', () => {
    var node = { id: 'mesh-quality1', type: 'fea-mesh', data: {} };
    global.nodes = [node];
    var html = getFEAMeshPropertiesHTML(node);
    expect(html).toMatch(/Kalite Metrikleri.*Aspect.*Skewness.*Açı/);
    expect(html).toMatch(/otomatik hesaplanır/);
  });

  test('Quality metrics varsa aspect/skewness/açı satırları + histogram bar\'ları', () => {
    var node = {
      id: 'mesh-quality2',
      type: 'fea-mesh',
      data: {
        meshActive: true,
        meshMetrics: {
          nodeCount: 27, elementCount: 8, elementType: 'hex8', minSize: 5, maxSize: 5, avgSize: 5,
          quality: {
            elementCount: 8, cornerCount: 8,
            aspectRatio: { min: 1.0, max: 1.0, avg: 1.0, poorCount: 0, warnThreshold: 20,
              histogram: { bins: [8,0,0,0,0,0,0,0,0,0], min: 1, max: 20, binCount: 10 } },
            skewness: { min: 0, max: 0, avg: 0, poorCount: 0, warnThreshold: 0.85,
              histogram: { bins: [8,0,0,0,0,0,0,0,0,0], min: 0, max: 1, binCount: 10 } },
            angle: { min: 90, max: 90,
              histogram: { bins: [0,0,0,0,0,8,0,0,0,0,0,0], min: 0, max: 180, binCount: 12 } }
          }
        }
      }
    };
    global.nodes = [node];
    var html = getFEAMeshPropertiesHTML(node);
    expect(html).toMatch(/Aspect Min.*1\.00/);
    expect(html).toMatch(/Skewness Min/);
    expect(html).toMatch(/Min.*Maks iç açı.*90/);
    // Histogram bar'ları render edildi
    expect(html).toMatch(/Aspect Ratio histogramı/);
    expect(html).toMatch(/Skewness histogramı/);
    expect(html).toMatch(/Min iç açı histogramı/);
  });

  test('Poor aspect/skewness sayısı uyarı satırı', () => {
    var node = {
      id: 'mesh-quality3',
      type: 'fea-mesh',
      data: {
        meshActive: true,
        meshMetrics: {
          nodeCount: 100, elementCount: 100, elementType: 'hex8', minSize: 1, maxSize: 10, avgSize: 5,
          quality: {
            elementCount: 100, cornerCount: 8,
            aspectRatio: { min: 1, max: 50, avg: 10, poorCount: 7, warnThreshold: 20,
              histogram: { bins: [50,30,10,5,5,0,0,0,0,0], min: 1, max: 20, binCount: 10 } },
            skewness: { min: 0, max: 0.95, avg: 0.4, poorCount: 4, warnThreshold: 0.85,
              histogram: { bins: [50,20,10,5,5,5,3,1,0,1], min: 0, max: 1, binCount: 10 } },
            angle: { min: 15, max: 165,
              histogram: { bins: [0,1,2,5,10,30,30,15,5,2,0,0], min: 0, max: 180, binCount: 12 } }
          }
        }
      }
    };
    global.nodes = [node];
    var html = getFEAMeshPropertiesHTML(node);
    expect(html).toMatch(/7 eleman aspect > 20/);
    expect(html).toMatch(/4 eleman skewness > 0\.85/);
  });
});

// ────────────────────────────────────────────────────────────────────────────
describe('veFEAEnrichToQuadratic (Tet10/Hex20/Wedge15)', () => {
  test('Hex8 → Hex20: nodesPerElement 8 → 20, eleman sayısı korunur', () => {
    var hex = veFEAMeshFromGeometry({ type: 'box', params: { width: 10, height: 10, depth: 10 } }, { size: 5 });
    var nEl = hex.elements.length / 8;
    var q = veFEAEnrichToQuadratic(hex);
    expect(q.type).toBe('hex20');
    expect(q.nodesPerElement).toBe(20);
    expect(q.elements.length / 20).toBe(nEl);
    expect(q.enrichedFrom).toBe('hex8');
  });

  test('Tet4 → Tet10: nodesPerElement 4 → 10', () => {
    var tet = veFEAMeshFromGeometry({ type: 'box', params: { width: 10, height: 10, depth: 10 } }, { size: 5, elementType: 'tet4' });
    var nEl = tet.elements.length / 4;
    var q = veFEAEnrichToQuadratic(tet);
    expect(q.type).toBe('tet10');
    expect(q.nodesPerElement).toBe(10);
    expect(q.elements.length / 10).toBe(nEl);
  });

  test('Wedge6 → Wedge15', () => {
    var w = veFEAMeshFromGeometry({ type: 'cylinder', params: { radius: 10, height: 20 } }, { size: 5 });
    var nEl = w.elements.length / 6;
    var q = veFEAEnrichToQuadratic(w);
    expect(q.type).toBe('wedge15');
    expect(q.nodesPerElement).toBe(15);
    expect(q.elements.length / 15).toBe(nEl);
  });

  test('Edge dedup: ortak kenarlar tek midnode kazanır', () => {
    // 2×1×1 hex (2 eleman, ortak yüz) — ortak 4 kenar bir kez sayılır
    var hex = veFEAMeshFromGeometry({ type: 'box', params: { width: 2, height: 1, depth: 1 } }, { size: 1 });
    expect(hex.elements.length / 8).toBe(2);
    var q = veFEAEnrichToQuadratic(hex);
    // 2 hex × 12 kenar/hex = 24 toplam kenar, ortak 4 dedup → 20 benzersiz midnode
    // Original 12 corner + 20 mid = 32 düğüm
    var origNodes = hex.nodes.length / 3;
    var newNodes = q.nodes.length / 3;
    expect(newNodes - origNodes).toBe(20);
  });

  test('Midpoint düğüm konumu kenarın gerçek orta noktası', () => {
    var hex = veFEAMeshFromGeometry({ type: 'box', params: { width: 1, height: 1, depth: 1 } }, { size: 1 });
    var q = veFEAEnrichToQuadratic(hex);
    // İlk eleman (0,1,2,3,4,5,6,7 corner + 8,9,...,19 mid)
    var corner0 = q.elements[0];
    var corner1 = q.elements[1];
    var mid01 = q.elements[8]; // ilk mid-node = (0,1) edge midpoint
    var x0 = q.nodes[corner0 * 3], y0 = q.nodes[corner0 * 3 + 1], z0 = q.nodes[corner0 * 3 + 2];
    var x1 = q.nodes[corner1 * 3], y1 = q.nodes[corner1 * 3 + 1], z1 = q.nodes[corner1 * 3 + 2];
    var xm = q.nodes[mid01 * 3], ym = q.nodes[mid01 * 3 + 1], zm = q.nodes[mid01 * 3 + 2];
    expect(xm).toBeCloseTo((x0 + x1) / 2, 5);
    expect(ym).toBeCloseTo((y0 + y1) / 2, 5);
    expect(zm).toBeCloseTo((z0 + z1) / 2, 5);
  });

  test('Named selections enriched mesh\'te de hâlâ geçerli (corner IDs)', () => {
    var hex = veFEAMeshFromGeometry({ type: 'box', params: { width: 10, height: 10, depth: 10 } }, { size: 5 });
    var q = veFEAEnrichToQuadratic(hex);
    expect(q.namedSelections).toBeDefined();
    expect(Object.keys(q.namedSelections).length).toBe(6);
    var ids = q.namedSelections.faceXMin.nodeIds;
    var maxIdx = q.nodes.length / 3 - 1;
    for (var i = 0; i < ids.length; i++) {
      expect(ids[i]).toBeLessThanOrEqual(maxIdx);
    }
  });

  test('null/error/tri3 → no-op', () => {
    expect(veFEAEnrichToQuadratic(null)).toBeNull();
    var err = { error: 'voxel-too-many' };
    expect(veFEAEnrichToQuadratic(err)).toBe(err);
    var tri = { type: 'tri3', nodes: new Float32Array(0), elements: new Uint32Array(0), nodesPerElement: 3 };
    expect(veFEAEnrichToQuadratic(tri).type).toBe('tri3');
  });

  test('Eleman indeksleri geçerli aralıkta', () => {
    var tet = veFEAMeshFromGeometry({ type: 'box', params: { width: 10, height: 10, depth: 10 } }, { size: 5, elementType: 'tet4' });
    var q = veFEAEnrichToQuadratic(tet);
    var maxIdx = q.nodes.length / 3 - 1;
    var ok = true;
    for (var i = 0; i < q.elements.length; i++) {
      if (q.elements[i] < 0 || q.elements[i] > maxIdx) { ok = false; break; }
    }
    expect(ok).toBe(true);
  });
});

// ────────────────────────────────────────────────────────────────────────────
describe('veFEAMeshFromGeometry — midSideNodes opsiyonu', () => {
  test('midSideNodes:false (default) → lineer eleman', () => {
    var m = veFEAMeshFromGeometry({ type: 'box', params: { width: 10, height: 10, depth: 10 } }, { size: 5 });
    expect(m.type).toBe('hex8');
  });

  test('midSideNodes:true + box → Hex20', () => {
    var m = veFEAMeshFromGeometry({ type: 'box', params: { width: 10, height: 10, depth: 10 } }, { size: 5, midSideNodes: true });
    expect(m.type).toBe('hex20');
    expect(m.nodesPerElement).toBe(20);
  });

  test('midSideNodes:true + cylinder → Wedge15', () => {
    var m = veFEAMeshFromGeometry({ type: 'cylinder', params: { radius: 10, height: 20 } }, { size: 5, midSideNodes: true });
    expect(m.type).toBe('wedge15');
  });

  test('midSideNodes:true + elementType:tet4 → Tet10', () => {
    var m = veFEAMeshFromGeometry({ type: 'box', params: { width: 10, height: 10, depth: 10 } }, { size: 5, elementType: 'tet4', midSideNodes: true });
    expect(m.type).toBe('tet10');
    expect(m.nodesPerElement).toBe(10);
  });
});

// ────────────────────────────────────────────────────────────────────────────
describe('cp-fea.js Mesh paneli — Orta-kenar düğüm checkbox\'ı', () => {
  beforeEach(() => {
    global.nodes = [];
    global.connections = [];
  });

  test('Checkbox render edilir, default unchecked', () => {
    var node = { id: 'mesh-q1', type: 'fea-mesh', data: {} };
    global.nodes = [node];
    var html = getFEAMeshPropertiesHTML(node);
    expect(html).toMatch(/id="ve-fea-mesh-midnodes-mesh-q1"/);
    expect(html).toMatch(/Orta-kenar düğümler/);
    // Default kapali
    var checkboxMatch = html.match(/<input type="checkbox"[^>]*id="ve-fea-mesh-midnodes-mesh-q1"[^>]*>/);
    expect(checkboxMatch).not.toBeNull();
    expect(checkboxMatch[0]).not.toMatch(/checked/);
  });

  test('Persisted midSideNodes:true → checkbox işaretli', () => {
    var node = { id: 'mesh-q2', type: 'fea-mesh', data: { meshSettings: { size: 5, midSideNodes: true } } };
    global.nodes = [node];
    var html = getFEAMeshPropertiesHTML(node);
    var checkboxMatch = html.match(/<input type="checkbox"[^>]*id="ve-fea-mesh-midnodes-mesh-q2"[^>]*>/);
    expect(checkboxMatch[0]).toMatch(/checked/);
  });
});

// ────────────────────────────────────────────────────────────────────────────
describe('veFEAComputeJacobianMetrics', () => {
  test('Kutu mesh için tüm elemanlar geçerli (no inverted/degenerate)', () => {
    var m = veFEAMeshFromGeometry({ type: 'box', params: { width: 10, height: 10, depth: 10 } }, { size: 5 });
    var jm = veFEAComputeJacobianMetrics(m);
    expect(jm.valid).toBe(true);
    expect(jm.invertedCount).toBe(0);
    expect(jm.degenerateCount).toBe(0);
    expect(jm.elementCount).toBe(8);
    expect(jm.minJacRatio).toBeCloseTo(1, 2); // küp → tüm sub-tet hacimleri eşit
    expect(jm.maxJacRatio).toBeCloseTo(1, 2);
  });

  test('Silindir mesh için geçerli', () => {
    var m = veFEAMeshFromGeometry({ type: 'cylinder', params: { radius: 10, height: 20 } }, { size: 5 });
    var jm = veFEAComputeJacobianMetrics(m);
    expect(jm.valid).toBe(true);
    expect(jm.invertedCount).toBe(0);
  });

  test('Şaft mesh için geçerli', () => {
    var m = veFEAMeshFromGeometry({ type: 'shaft', params: { outerRadius: 20, innerRadius: 8, length: 100 } }, { size: 10 });
    var jm = veFEAComputeJacobianMetrics(m);
    expect(jm.valid).toBe(true);
  });

  test('Tet4 mesh için geçerli (tek tet → ratio 1.0)', () => {
    var m = veFEAMeshFromGeometry({ type: 'box', params: { width: 10, height: 10, depth: 10 } }, { size: 5, elementType: 'tet4' });
    var jm = veFEAComputeJacobianMetrics(m);
    expect(jm.valid).toBe(true);
    expect(jm.elementCount).toBe(48); // 8 hex × 6 tet
    // Her tet için ratio = max/min = 1/1 = 1 (tek sub-tet)
    expect(jm.minJacRatio).toBeCloseTo(1, 4);
    expect(jm.maxJacRatio).toBeCloseTo(1, 4);
  });

  test('Manuel ters dönmüş tet → invertedCount artar', () => {
    // 4 düğüm, swap son ikisini → orientation flipped
    var mesh = {
      type: 'tet4',
      nodes: new Float32Array([0,0,0,  1,0,0,  0,1,0,  0,0,1]),
      elements: new Uint32Array([0, 1, 3, 2]), // 2 ve 3 swapped → inverted
      nodesPerElement: 4
    };
    var jm = veFEAComputeJacobianMetrics(mesh);
    expect(jm.invertedCount).toBe(1);
    expect(jm.valid).toBe(false);
    expect(jm.invertedIds).toContain(0);
  });

  test('Manuel dejenere tet (collapsed) → degenerateCount artar', () => {
    // 4 düğüm coplanar (z=0) → volume = 0
    var mesh = {
      type: 'tet4',
      nodes: new Float32Array([0,0,0,  1,0,0,  0,1,0,  1,1,0]),
      elements: new Uint32Array([0, 1, 2, 3]),
      nodesPerElement: 4
    };
    var jm = veFEAComputeJacobianMetrics(mesh);
    expect(jm.degenerateCount).toBe(1);
    expect(jm.valid).toBe(false);
  });

  test('null mesh → null döner', () => {
    expect(veFEAComputeJacobianMetrics(null)).toBeNull();
    expect(veFEAComputeJacobianMetrics({ error: 'voxel-too-many' })).toBeNull();
  });

  test('Voxel STL → tüm voxel hex geçerli', () => {
    function buildCubeTriangles() {
      return [
        [0,0,0, 10,10,0, 10,0,0,  0,0,-1],
        [0,0,0, 0,10,0, 10,10,0,  0,0,-1],
        [0,0,10, 10,0,10, 10,10,10,  0,0,1],
        [0,0,10, 10,10,10, 0,10,10,  0,0,1],
        [0,0,0, 0,0,10, 0,10,10,  -1,0,0],
        [0,0,0, 0,10,10, 0,10,0,  -1,0,0],
        [10,0,0, 10,10,0, 10,10,10,  1,0,0],
        [10,0,0, 10,10,10, 10,0,10,  1,0,0],
        [0,0,0, 10,0,0, 10,0,10,  0,-1,0],
        [0,0,0, 10,0,10, 0,0,10,  0,-1,0],
        [0,10,0, 0,10,10, 10,10,10,  0,1,0],
        [0,10,0, 10,10,10, 10,10,0,  0,1,0]
      ];
    }
    var tris = buildCubeTriangles();
    var ab = new ArrayBuffer(84 + tris.length * 50);
    var view = new DataView(ab);
    view.setUint32(80, tris.length, true);
    var offset = 84;
    for (var i = 0; i < tris.length; i++) {
      var t = tris[i];
      view.setFloat32(offset, t[9], true);
      view.setFloat32(offset + 4, t[10], true);
      view.setFloat32(offset + 8, t[11], true);
      offset += 12;
      for (var j = 0; j < 9; j++) view.setFloat32(offset + j * 4, t[j], true);
      offset += 36;
      view.setUint16(offset, 0, true);
      offset += 2;
    }
    var b64 = veFEAArrayBufferToBase64(ab);
    var m = veFEAMeshFromGeometry({ type: 'stl', rawDataB64: b64 }, { size: 5 });
    var jm = veFEAComputeJacobianMetrics(m);
    expect(jm.valid).toBe(true);
    expect(jm.elementCount).toBe(8);
  });

  test('Jacobian metrics meshMetrics içine entegre olur (build sonrası)', () => {
    global.nodes = [
      { id: 'geom-1', type: 'fea-geometry', data: { geometry: { type: 'box', params: { width: 10, height: 10, depth: 10 } } } },
      { id: 'mesh-1', type: 'fea-mesh', data: { meshSettings: { size: 5 } } }
    ];
    global.connections = [{ from: 'geom-1', to: 'mesh-1' }];
    global.showToast = jest.fn();
    global.showNodeProperties = jest.fn();
    global.saveState = jest.fn();
    Object.keys(veFEAMeshCache).forEach((k) => delete veFEAMeshCache[k]);
    veFEABuildMeshForNode('mesh-1');
    expect(global.nodes[1].data.meshMetrics.jacobian).toBeDefined();
    expect(global.nodes[1].data.meshMetrics.jacobian.valid).toBe(true);
  });
});

// ────────────────────────────────────────────────────────────────────────────
describe('cp-fea.js Mesh paneli — Jacobian/Geçerlilik bölümü', () => {
  beforeEach(() => {
    global.nodes = [];
    global.connections = [];
  });

  test('Mesh yoksa "—" gösterilir', () => {
    var node = { id: 'mesh-j1', type: 'fea-mesh', data: {} };
    global.nodes = [node];
    var html = getFEAMeshPropertiesHTML(node);
    expect(html).toMatch(/Jacobian.*Geçerlilik/);
  });

  test('Geçerli mesh için "GEÇERLİ" mesajı yeşil', () => {
    var node = {
      id: 'mesh-j2',
      type: 'fea-mesh',
      data: {
        meshActive: true,
        meshMetrics: {
          nodeCount: 27, elementCount: 8, elementType: 'hex8', minSize: 5, maxSize: 5, avgSize: 5,
          jacobian: {
            elementCount: 8, invertedCount: 0, degenerateCount: 0, poorCount: 0,
            invertedIds: [], minVolume: 125, maxVolume: 125,
            minJacRatio: 1.0, maxJacRatio: 1.0, avgJacRatio: 1.0,
            ratioWarnThreshold: 40, valid: true
          }
        }
      }
    };
    global.nodes = [node];
    var html = getFEAMeshPropertiesHTML(node);
    expect(html).toMatch(/GEÇERLİ/);
    expect(html).toMatch(/22c55e/); // accent-success rengi
  });

  test('Ters eleman olan mesh için "HATALI" mesajı kırmızı', () => {
    var node = {
      id: 'mesh-j3',
      type: 'fea-mesh',
      data: {
        meshActive: true,
        meshMetrics: {
          nodeCount: 27, elementCount: 8, elementType: 'hex8', minSize: 5, maxSize: 5, avgSize: 5,
          jacobian: {
            elementCount: 8, invertedCount: 2, degenerateCount: 0, poorCount: 0,
            invertedIds: [3, 5], minVolume: -10, maxVolume: 125,
            minJacRatio: 1.0, maxJacRatio: 100, avgJacRatio: 5.0,
            ratioWarnThreshold: 40, valid: false
          }
        }
      }
    };
    global.nodes = [node];
    var html = getFEAMeshPropertiesHTML(node);
    expect(html).toMatch(/HATALI/);
    expect(html).toMatch(/ef4444/); // accent-danger rengi
  });

  test('Düşük kaliteli (poorCount > 0) için uyarı satırı', () => {
    var node = {
      id: 'mesh-j4',
      type: 'fea-mesh',
      data: {
        meshActive: true,
        meshMetrics: {
          nodeCount: 27, elementCount: 100, elementType: 'hex8', minSize: 5, maxSize: 5, avgSize: 5,
          jacobian: {
            elementCount: 100, invertedCount: 0, degenerateCount: 0, poorCount: 7,
            invertedIds: [], minVolume: 1, maxVolume: 125,
            minJacRatio: 1.0, maxJacRatio: 80, avgJacRatio: 5.0,
            ratioWarnThreshold: 40, valid: true
          }
        }
      }
    };
    global.nodes = [node];
    var html = getFEAMeshPropertiesHTML(node);
    expect(html).toMatch(/7 eleman düşük kaliteli/);
  });
});

// ────────────────────────────────────────────────────────────────────────────
describe('Tet4 decomposition (veFEAConvertMeshToTet4)', () => {
  test('Hex8 mesh → her Heks8 6 Tet4 olur', () => {
    var hex = veFEAMeshFromGeometry({ type: 'box', params: { width: 10, height: 10, depth: 10 } }, { size: 5 });
    var nHex = hex.elements.length / 8;
    var tet = veFEAConvertMeshToTet4(hex);
    expect(tet.type).toBe('tet4');
    expect(tet.nodesPerElement).toBe(4);
    expect(tet.elements.length / 4).toBe(nHex * 6);
    // Düğüm konumları aynı (paylaşılan referans)
    expect(tet.nodes).toBe(hex.nodes);
    expect(tet.convertedFromHex).toBe(true);
  });

  test('Wedge6 mesh → her wedge 3 Tet4 olur', () => {
    var wed = veFEAMeshFromGeometry({ type: 'cylinder', params: { radius: 10, height: 20 } }, { size: 5 });
    var nWed = wed.elements.length / 6;
    var tet = veFEAConvertMeshToTet4(wed);
    expect(tet.type).toBe('tet4');
    expect(tet.elements.length / 4).toBe(nWed * 3);
    expect(tet.convertedFromWedge).toBe(true);
  });

  test('Tet4 mesh tekrar dönüştürülmez (no-op)', () => {
    var hex = veFEAMeshFromGeometry({ type: 'box', params: { width: 10, height: 10, depth: 10 } }, { size: 5 });
    var tet1 = veFEAConvertMeshToTet4(hex);
    var tet2 = veFEAConvertMeshToTet4(tet1);
    expect(tet2.elements.length).toBe(tet1.elements.length);
    expect(tet2.type).toBe('tet4');
  });

  test('Named selections tet4\'e taşınır (node ID\'ler korunur)', () => {
    var hex = veFEAMeshFromGeometry({ type: 'box', params: { width: 10, height: 10, depth: 10 } }, { size: 5 });
    var tet = veFEAConvertMeshToTet4(hex);
    expect(tet.namedSelections).toBeDefined();
    expect(Object.keys(tet.namedSelections).length).toBe(6);
    // Aynı düğüm IDs kullanılıyor — tet4\'de hala geçerli
    var ids = tet.namedSelections.faceXMin.nodeIds;
    var maxIdx = tet.nodes.length / 3 - 1;
    for (var i = 0; i < ids.length; i++) {
      expect(ids[i]).toBeLessThanOrEqual(maxIdx);
    }
  });

  test('null veya error mesh için no-op', () => {
    expect(veFEAConvertMeshToTet4(null)).toBeNull();
    var err = { error: 'voxel-too-many' };
    expect(veFEAConvertMeshToTet4(err)).toBe(err);
  });

  test('Tri3 (yüzey) mesh\'ler etkilenmez', () => {
    var tri = { type: 'tri3', nodes: new Float32Array(0), elements: new Uint32Array(0), nodesPerElement: 3 };
    var out = veFEAConvertMeshToTet4(tri);
    expect(out.type).toBe('tri3');
  });

  test('Tet4 element indeksleri geçerli', () => {
    var hex = veFEAMeshFromGeometry({ type: 'box', params: { width: 10, height: 10, depth: 10 } }, { size: 5 });
    var tet = veFEAConvertMeshToTet4(hex);
    var maxIdx = tet.nodes.length / 3 - 1;
    var ok = true;
    for (var i = 0; i < tet.elements.length; i++) {
      if (tet.elements[i] < 0 || tet.elements[i] > maxIdx) { ok = false; break; }
    }
    expect(ok).toBe(true);
  });

  test('Hex8 6-tet split toplam hacim ≈ original hex hacim', () => {
    // Heks8 hacmi (1×1×1) = 1; 6 tet hacim toplamı da 1 olmalı (mass conservation)
    var hex = veFEAMeshFromGeometry({ type: 'box', params: { width: 1, height: 1, depth: 1 } }, { size: 1 });
    var tet = veFEAConvertMeshToTet4(hex);
    var nodes = tet.nodes;
    var totalVol = 0;
    for (var e = 0; e < tet.elements.length / 4; e++) {
      var off = e * 4;
      var a = tet.elements[off], b = tet.elements[off + 1], c = tet.elements[off + 2], d = tet.elements[off + 3];
      var ax = nodes[a*3], ay = nodes[a*3+1], az = nodes[a*3+2];
      var bx = nodes[b*3], by = nodes[b*3+1], bz = nodes[b*3+2];
      var cx = nodes[c*3], cy = nodes[c*3+1], cz = nodes[c*3+2];
      var dx = nodes[d*3], dy = nodes[d*3+1], dz = nodes[d*3+2];
      // V = (1/6) |((b-a) × (c-a)) · (d-a)|
      var v1x = bx-ax, v1y = by-ay, v1z = bz-az;
      var v2x = cx-ax, v2y = cy-ay, v2z = cz-az;
      var v3x = dx-ax, v3y = dy-ay, v3z = dz-az;
      var cross_x = v1y*v2z - v1z*v2y;
      var cross_y = v1z*v2x - v1x*v2z;
      var cross_z = v1x*v2y - v1y*v2x;
      var vol = Math.abs(cross_x*v3x + cross_y*v3y + cross_z*v3z) / 6;
      totalVol += vol;
    }
    expect(totalVol).toBeCloseTo(1, 4);
  });
});

// ────────────────────────────────────────────────────────────────────────────
describe('veFEAMeshFromGeometry — elementType seçimi', () => {
  test('elementType "auto" → native eleman tipi (hex8)', () => {
    var m = veFEAMeshFromGeometry({ type: 'box', params: { width: 10, height: 10, depth: 10 } }, { size: 5, elementType: 'auto' });
    expect(m.type).toBe('hex8');
  });

  test('elementType "tet4" → kutu Hex8 → Tet4 dönüştürür', () => {
    var m = veFEAMeshFromGeometry({ type: 'box', params: { width: 10, height: 10, depth: 10 } }, { size: 5, elementType: 'tet4' });
    expect(m.type).toBe('tet4');
    expect(m.elements.length / 4).toBe(8 * 6); // 8 hex × 6 tet
  });

  test('elementType "tet4" → silindir Wedge6 → Tet4 dönüştürür', () => {
    var m = veFEAMeshFromGeometry({ type: 'cylinder', params: { radius: 10, height: 20 } }, { size: 5, elementType: 'tet4' });
    expect(m.type).toBe('tet4');
    var native = veFEAMeshFromGeometry({ type: 'cylinder', params: { radius: 10, height: 20 } }, { size: 5 });
    expect(m.elements.length / 4).toBe((native.elements.length / 6) * 3);
  });

  test('Voxel STL + elementType "tet4" → tet4 voxel mesh', () => {
    // STL fixture
    function buildCubeTriangles() {
      return [
        [0,0,0, 10,10,0, 10,0,0,  0,0,-1],
        [0,0,0, 0,10,0, 10,10,0,  0,0,-1],
        [0,0,10, 10,0,10, 10,10,10,  0,0,1],
        [0,0,10, 10,10,10, 0,10,10,  0,0,1],
        [0,0,0, 0,0,10, 0,10,10,  -1,0,0],
        [0,0,0, 0,10,10, 0,10,0,  -1,0,0],
        [10,0,0, 10,10,0, 10,10,10,  1,0,0],
        [10,0,0, 10,10,10, 10,0,10,  1,0,0],
        [0,0,0, 10,0,0, 10,0,10,  0,-1,0],
        [0,0,0, 10,0,10, 0,0,10,  0,-1,0],
        [0,10,0, 0,10,10, 10,10,10,  0,1,0],
        [0,10,0, 10,10,10, 10,10,0,  0,1,0]
      ];
    }
    var tris = buildCubeTriangles();
    var ab = new ArrayBuffer(84 + tris.length * 50);
    var view = new DataView(ab);
    view.setUint32(80, tris.length, true);
    var offset = 84;
    for (var i = 0; i < tris.length; i++) {
      var t = tris[i];
      view.setFloat32(offset, t[9], true);
      view.setFloat32(offset + 4, t[10], true);
      view.setFloat32(offset + 8, t[11], true);
      offset += 12;
      for (var j = 0; j < 9; j++) view.setFloat32(offset + j * 4, t[j], true);
      offset += 36;
      view.setUint16(offset, 0, true);
      offset += 2;
    }
    var b64 = veFEAArrayBufferToBase64(ab);
    var m = veFEAMeshFromGeometry({ type: 'stl', rawDataB64: b64 }, { size: 5, mode: 'volume', elementType: 'tet4' });
    expect(m.type).toBe('tet4');
    expect(m.voxelMode).toBe(true);
    expect(m.elements.length / 4).toBe(8 * 6); // 8 voxel × 6 tet
  });

  test('Surface mode tet4\'ten etkilenmez (tri3 kalır)', () => {
    function buildCubeTriangles() {
      return [
        [0,0,0, 10,10,0, 10,0,0,  0,0,-1],
        [0,0,0, 0,10,0, 10,10,0,  0,0,-1]
      ];
    }
    var tris = buildCubeTriangles();
    var ab = new ArrayBuffer(84 + tris.length * 50);
    var view = new DataView(ab);
    view.setUint32(80, tris.length, true);
    var offset = 84;
    for (var i = 0; i < tris.length; i++) {
      var t = tris[i];
      view.setFloat32(offset, t[9], true);
      view.setFloat32(offset + 4, t[10], true);
      view.setFloat32(offset + 8, t[11], true);
      offset += 12;
      for (var j = 0; j < 9; j++) view.setFloat32(offset + j * 4, t[j], true);
      offset += 36;
      view.setUint16(offset, 0, true);
      offset += 2;
    }
    var b64 = veFEAArrayBufferToBase64(ab);
    var m = veFEAMeshFromGeometry({ type: 'stl', rawDataB64: b64 }, { size: 5, mode: 'surface', elementType: 'tet4' });
    // Surface modunda tri3 — tet4 dönüştürmesi uygulanmaz
    expect(m.type).toBe('tri3');
  });
});

// ────────────────────────────────────────────────────────────────────────────
describe('cp-fea.js Mesh paneli — Eleman Tipi seçici', () => {
  beforeEach(() => {
    global.nodes = [];
    global.connections = [];
  });

  test('Eleman Tipi dropdown render edilir (2 seçenek)', () => {
    var node = { id: 'mesh-et1', type: 'fea-mesh', data: {} };
    global.nodes = [node];
    var html = getFEAMeshPropertiesHTML(node);
    expect(html).toMatch(/id="ve-fea-mesh-eltype-mesh-et1"/);
    expect(html).toMatch(/value="auto"/);
    expect(html).toMatch(/value="tet4"/);
  });

  test('Default elementType "auto" seçili', () => {
    var node = { id: 'mesh-et2', type: 'fea-mesh', data: {} };
    global.nodes = [node];
    var html = getFEAMeshPropertiesHTML(node);
    // İki dropdown var (mode + elementType); elementType auto seçili olmalı
    expect(html).toMatch(/id="ve-fea-mesh-eltype-mesh-et2"[^>]*>[\s\S]*?value="auto"\s+selected/);
  });

  test('Persist edilmiş elementType UI\'da işaretlenir', () => {
    var node = { id: 'mesh-et3', type: 'fea-mesh', data: { meshSettings: { size: 10, mode: 'auto', elementType: 'tet4' } } };
    global.nodes = [node];
    var html = getFEAMeshPropertiesHTML(node);
    expect(html).toMatch(/id="ve-fea-mesh-eltype-mesh-et3"[^>]*>[\s\S]*?value="tet4"\s+selected/);
  });
});

// ────────────────────────────────────────────────────────────────────────────
describe('Named Selections — otomatik üretim', () => {
  test('Kutu mesh 6 yüzey selection üretir', () => {
    var m = veFEAMeshFromGeometry({ type: 'box', params: { width: 10, height: 10, depth: 10 } }, { size: 5 });
    expect(m.namedSelections).toBeDefined();
    var keys = Object.keys(m.namedSelections);
    expect(keys).toContain('faceXMin');
    expect(keys).toContain('faceXMax');
    expect(keys).toContain('faceYMin');
    expect(keys).toContain('faceYMax');
    expect(keys).toContain('faceZMin');
    expect(keys).toContain('faceZMax');
    expect(keys.length).toBe(6);
  });

  test('Kutu 2×2×2: her yüzeyde (ny+1)*(nz+1) = 9 düğüm', () => {
    var m = veFEAMeshFromGeometry({ type: 'box', params: { width: 10, height: 10, depth: 10 } }, { size: 5 });
    // nx=ny=nz=2 → her face 3×3 = 9
    expect(m.namedSelections.faceXMin.nodeIds.length).toBe(9);
    expect(m.namedSelections.faceXMax.nodeIds.length).toBe(9);
    expect(m.namedSelections.faceYMin.nodeIds.length).toBe(9);
    expect(m.namedSelections.faceYMax.nodeIds.length).toBe(9);
    expect(m.namedSelections.faceZMin.nodeIds.length).toBe(9);
    expect(m.namedSelections.faceZMax.nodeIds.length).toBe(9);
  });

  test('Kutu XMin yüzeyindeki düğümlerin x-koordinatı geometrinin minX değerine eşit', () => {
    var m = veFEAMeshFromGeometry({ type: 'box', params: { width: 10, height: 10, depth: 10 } }, { size: 5 });
    var ids = m.namedSelections.faceXMin.nodeIds;
    for (var i = 0; i < ids.length; i++) {
      expect(m.nodes[ids[i] * 3]).toBeCloseTo(-5, 5); // x0 = -w/2
    }
  });

  test('Kutu YMax yüzeyindeki düğümlerin y-koordinatı maxY', () => {
    var m = veFEAMeshFromGeometry({ type: 'box', params: { width: 10, height: 10, depth: 10 } }, { size: 5 });
    var ids = m.namedSelections.faceYMax.nodeIds;
    for (var i = 0; i < ids.length; i++) {
      expect(m.nodes[ids[i] * 3 + 1]).toBeCloseTo(5, 5);
    }
  });

  test('Silindir mesh 3 yüzey selection üretir (Alt, Üst, Yan)', () => {
    var m = veFEAMeshFromGeometry({ type: 'cylinder', params: { radius: 10, height: 20 } }, { size: 5 });
    var keys = Object.keys(m.namedSelections);
    expect(keys).toContain('faceTop');
    expect(keys).toContain('faceBottom');
    expect(keys).toContain('faceSide');
    expect(keys.length).toBe(3);
  });

  test('Silindir Alt disk düğümlerinin y-koordinatı -h/2', () => {
    var m = veFEAMeshFromGeometry({ type: 'cylinder', params: { radius: 10, height: 20 } }, { size: 5 });
    var ids = m.namedSelections.faceBottom.nodeIds;
    for (var i = 0; i < ids.length; i++) {
      expect(m.nodes[ids[i] * 3 + 1]).toBeCloseTo(-10, 5);
    }
  });

  test('Silindir Yan yüzey düğümlerinin radyal mesafesi R', () => {
    var m = veFEAMeshFromGeometry({ type: 'cylinder', params: { radius: 10, height: 20 } }, { size: 5 });
    var ids = m.namedSelections.faceSide.nodeIds;
    for (var i = 0; i < ids.length; i++) {
      var x = m.nodes[ids[i] * 3];
      var z = m.nodes[ids[i] * 3 + 2];
      expect(Math.sqrt(x * x + z * z)).toBeCloseTo(10, 5);
    }
  });

  test('Şaft mesh 4 yüzey selection üretir (Alt, Üst, Dış, İç)', () => {
    var m = veFEAMeshFromGeometry({ type: 'shaft', params: { outerRadius: 20, innerRadius: 8, length: 100 } }, { size: 10 });
    var keys = Object.keys(m.namedSelections);
    expect(keys).toContain('faceTop');
    expect(keys).toContain('faceBottom');
    expect(keys).toContain('faceOuter');
    expect(keys).toContain('faceInner');
    expect(keys.length).toBe(4);
  });

  test('Şaft İç yüzey düğümlerinin radyal mesafesi iç yarıçap', () => {
    var m = veFEAMeshFromGeometry({ type: 'shaft', params: { outerRadius: 20, innerRadius: 8, length: 100 } }, { size: 10 });
    var ids = m.namedSelections.faceInner.nodeIds;
    for (var i = 0; i < ids.length; i++) {
      var x = m.nodes[ids[i] * 3];
      var z = m.nodes[ids[i] * 3 + 2];
      expect(Math.sqrt(x * x + z * z)).toBeCloseTo(8, 4);
    }
  });

  test('Tüm selection nodeIds geçerli aralıkta', () => {
    var m = veFEAMeshFromGeometry({ type: 'box', params: { width: 10, height: 10, depth: 10 } }, { size: 5 });
    var maxIdx = m.nodes.length / 3 - 1;
    Object.keys(m.namedSelections).forEach(function(k) {
      var ids = m.namedSelections[k].nodeIds;
      for (var i = 0; i < ids.length; i++) {
        expect(ids[i]).toBeGreaterThanOrEqual(0);
        expect(ids[i]).toBeLessThanOrEqual(maxIdx);
      }
    });
  });
});

// ────────────────────────────────────────────────────────────────────────────
describe('veFEAComputeNamedSelectionsSummary', () => {
  test('mesh.namedSelections → { label, type, source, nodeCount } özet', () => {
    var m = veFEAMeshFromGeometry({ type: 'box', params: { width: 10, height: 10, depth: 10 } }, { size: 5 });
    var summary = veFEAComputeNamedSelectionsSummary(m);
    expect(Object.keys(summary).length).toBe(6);
    expect(summary.faceXMin.nodeCount).toBe(9);
    expect(summary.faceXMin.label).toMatch(/X−/);
    expect(summary.faceXMin.type).toBe('face');
    expect(summary.faceXMin.source).toBe('auto');
    // nodeIds özet'te olmamalı (JSON-serializable kalsın)
    expect(summary.faceXMin.nodeIds).toBeUndefined();
  });

  test('null mesh → {} döner', () => {
    expect(veFEAComputeNamedSelectionsSummary(null)).toEqual({});
    expect(veFEAComputeNamedSelectionsSummary({})).toEqual({});
  });

  test('Özet JSON-serializable (Float32Array/Uint32Array içermez)', () => {
    var m = veFEAMeshFromGeometry({ type: 'cylinder', params: { radius: 10, height: 20 } }, { size: 5 });
    var summary = veFEAComputeNamedSelectionsSummary(m);
    expect(() => JSON.stringify(summary)).not.toThrow();
    var parsed = JSON.parse(JSON.stringify(summary));
    expect(Object.keys(parsed).length).toBe(3);
  });
});

// ────────────────────────────────────────────────────────────────────────────
describe('veFEAToggleNamedSelection köprüsü', () => {
  beforeEach(() => {
    global.nodes = [];
    global.connections = [];
    global.showNodeProperties = jest.fn();
    Object.keys(veFEAViewerRegistry).forEach((k) => delete veFEAViewerRegistry[k]);
  });

  test('Mevcut highlight yokken key → highlightedSelection = key', () => {
    global.nodes = [{ id: 'mesh-1', type: 'fea-mesh', data: {} }];
    veFEAToggleNamedSelection('mesh-1', 'faceXMin');
    expect(global.nodes[0].data.highlightedSelection).toBe('faceXMin');
  });

  test('Aynı key tekrar → toggle (null)', () => {
    global.nodes = [{ id: 'mesh-1', type: 'fea-mesh', data: { highlightedSelection: 'faceXMin' } }];
    veFEAToggleNamedSelection('mesh-1', 'faceXMin');
    expect(global.nodes[0].data.highlightedSelection).toBeNull();
  });

  test('Farklı key → highlight değişir', () => {
    global.nodes = [{ id: 'mesh-1', type: 'fea-mesh', data: { highlightedSelection: 'faceXMin' } }];
    veFEAToggleNamedSelection('mesh-1', 'faceYMax');
    expect(global.nodes[0].data.highlightedSelection).toBe('faceYMax');
  });

  test('Bilinmeyen nodeId → sessizce çıkar', () => {
    expect(() => veFEAToggleNamedSelection('nonexistent', 'foo')).not.toThrow();
  });
});

// ────────────────────────────────────────────────────────────────────────────
describe('cp-fea.js Mesh paneli — Named Selections bölümü', () => {
  beforeEach(() => {
    global.nodes = [];
    global.connections = [];
  });

  test('Mesh yoksa "Mesh oluşturulduktan sonra" mesajı', () => {
    var node = { id: 'mesh-ns1', type: 'fea-mesh', data: {} };
    global.nodes = [node];
    var html = getFEAMeshPropertiesHTML(node);
    expect(html).toMatch(/Atanmış Yüzeyler/);
    expect(html).toMatch(/Mesh oluşturulduktan sonra/);
  });

  test('namedSelectionsSummary varsa düğüm grupları listelenir', () => {
    var node = {
      id: 'mesh-ns2',
      type: 'fea-mesh',
      data: {
        meshActive: true,
        meshMetrics: { nodeCount: 27, elementCount: 8, elementType: 'hex8', minSize: 5, maxSize: 5, avgSize: 5 },
        namedSelectionsSummary: {
          faceXMin: { label: 'X− Yüzeyi', type: 'face', source: 'auto', nodeCount: 9 },
          faceXMax: { label: 'X+ Yüzeyi', type: 'face', source: 'auto', nodeCount: 9 }
        }
      }
    };
    global.nodes = [node];
    var html = getFEAMeshPropertiesHTML(node);
    expect(html).toMatch(/X− Yüzeyi/);
    expect(html).toMatch(/X\+ Yüzeyi/);
    expect(html).toMatch(/AUTO/);
    expect(html).toMatch(/veFEAToggleNamedSelection\('mesh-ns2', 'faceXMin'\)/);
  });

  test('Aktif highlight için ◉ ikonu, diğerleri için ○', () => {
    var node = {
      id: 'mesh-ns3',
      type: 'fea-mesh',
      data: {
        meshActive: true,
        meshMetrics: { nodeCount: 27, elementCount: 8, elementType: 'hex8', minSize: 5, maxSize: 5, avgSize: 5 },
        highlightedSelection: 'faceXMin',
        namedSelectionsSummary: {
          faceXMin: { label: 'X− Yüzeyi', type: 'face', source: 'auto', nodeCount: 9 },
          faceXMax: { label: 'X+ Yüzeyi', type: 'face', source: 'auto', nodeCount: 9 }
        }
      }
    };
    global.nodes = [node];
    var html = getFEAMeshPropertiesHTML(node);
    // Aktif faceXMin için ◉ kullanılmalı
    expect(html).toMatch(/◉/);
    expect(html).toMatch(/○/);
  });
});

// ────────────────────────────────────────────────────────────────────────────
describe('veFEABuildMeshForNode — namedSelectionsSummary persist', () => {
  beforeEach(() => {
    global.nodes = [];
    global.connections = [];
    global.showToast = jest.fn();
    global.showNodeProperties = jest.fn();
    global.saveState = jest.fn();
    Object.keys(veFEAMeshCache).forEach((k) => delete veFEAMeshCache[k]);
  });

  test('mesh hesaplandıktan sonra namedSelectionsSummary node.data\'ya kaydedilir', () => {
    global.nodes = [
      { id: 'geom-1', type: 'fea-geometry', data: { geometry: { type: 'box', params: { width: 10, height: 10, depth: 10 } } } },
      { id: 'mesh-1', type: 'fea-mesh', data: { meshSettings: { size: 5 } } }
    ];
    global.connections = [{ from: 'geom-1', to: 'mesh-1' }];
    veFEABuildMeshForNode('mesh-1');
    var summary = global.nodes[1].data.namedSelectionsSummary;
    expect(summary).toBeDefined();
    expect(Object.keys(summary).length).toBe(6);
    expect(summary.faceXMin.nodeCount).toBe(9);
  });

  test('Mesh silindikten sonra namedSelectionsSummary da temizlenir', () => {
    global.nodes = [
      { id: 'geom-1', type: 'fea-geometry', data: { geometry: { type: 'box', params: { width: 10, height: 10, depth: 10 } } } },
      { id: 'mesh-1', type: 'fea-mesh', data: { meshSettings: { size: 5 } } }
    ];
    global.connections = [{ from: 'geom-1', to: 'mesh-1' }];
    veFEABuildMeshForNode('mesh-1');
    expect(global.nodes[1].data.namedSelectionsSummary).toBeDefined();
    veFEAClearMeshForNode('mesh-1');
    expect(global.nodes[1].data.namedSelectionsSummary).toBeUndefined();
  });
});

// ────────────────────────────────────────────────────────────────────────────
describe('veFEAInitMeshViewerForNode (graceful, Three.js olmadan)', () => {
  beforeEach(() => {
    Object.keys(veFEAViewerRegistry).forEach((k) => delete veFEAViewerRegistry[k]);
    document.body.innerHTML = '';
  });

  test('canvas yoksa sessizce çıkar', () => {
    expect(() => veFEAInitMeshViewerForNode('nonexistent')).not.toThrow();
  });

  test('canvas varsa hata atmaz (Three.js olmadan 2D fallback)', () => {
    document.body.innerHTML = '<canvas id="ve-fea-mesh-canvas-t1" width="240" height="180"></canvas>';
    expect(() => veFEAInitMeshViewerForNode('t1')).not.toThrow();
  });
});
