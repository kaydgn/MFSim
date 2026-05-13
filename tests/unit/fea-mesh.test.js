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
    expect(veFEAMeshLabel('tet4')).toBe('Tet4');
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

// ────────────────────────────────────────────────────────────────────────────
// Regresyon: fullscreen viewer Mesh node için cache'ten yüklemeli.
// Kullanıcı raporu: "Mesh ekranındaki tam ekran görüntüleyici tam olarak
// çalışmıyor. Mesh'li geometri tam olarak gelmiyor."
describe('_veFEALoadNodeGeometryIntoViewer — Mesh node desteği', () => {
  beforeEach(() => {
    global.nodes = [];
    Object.keys(veFEAMeshCache).forEach((k) => delete veFEAMeshCache[k]);
  });

  test('Mesh node + cache\'te mesh varsa viewer.loadMesh çağrılır', () => {
    global.nodes = [{ id: 'mesh-x', type: 'fea-mesh', data: { meshActive: true } }];
    veFEAMeshCache['mesh-x'] = {
      type: 'hex8', nodes: new Float32Array([0,0,0, 1,0,0]),
      elements: new Uint32Array([]), nodesPerElement: 8
    };
    var loadMeshMock = jest.fn();
    var loadSTLMock = jest.fn();
    var loadPrimitiveMock = jest.fn();
    var mockViewer = { loadMesh: loadMeshMock, loadSTL: loadSTLMock, loadPrimitive: loadPrimitiveMock };
    _veFEALoadNodeGeometryIntoViewer(mockViewer, 'mesh-x');
    expect(loadMeshMock).toHaveBeenCalledTimes(1);
    expect(loadSTLMock).not.toHaveBeenCalled();
    expect(loadPrimitiveMock).not.toHaveBeenCalled();
  });

  test('Mesh node + cache\'te mesh YOKsa hata atmaz', () => {
    global.nodes = [{ id: 'mesh-empty', type: 'fea-mesh', data: {} }];
    var loadMeshMock = jest.fn();
    var mockViewer = { loadMesh: loadMeshMock };
    expect(() => _veFEALoadNodeGeometryIntoViewer(mockViewer, 'mesh-empty')).not.toThrow();
    expect(loadMeshMock).not.toHaveBeenCalled();
  });

  test('Geometry node yine eski davranışla yüklenir (primitif)', () => {
    global.nodes = [{ id: 'g1', type: 'fea-geometry', data: { geometry: { type: 'box', params: { width: 10, height: 10, depth: 10 } } } }];
    var loadMeshMock = jest.fn();
    var loadPrimitiveMock = jest.fn();
    var mockViewer = { loadMesh: loadMeshMock, loadPrimitive: loadPrimitiveMock };
    _veFEALoadNodeGeometryIntoViewer(mockViewer, 'g1');
    expect(loadPrimitiveMock).toHaveBeenCalledTimes(1);
    expect(loadPrimitiveMock).toHaveBeenCalledWith('box', expect.any(Object));
    expect(loadMeshMock).not.toHaveBeenCalled();
  });
});
