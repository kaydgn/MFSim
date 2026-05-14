/**
 * FEA Hacim Mesh (Voxel-tabanlı) — birim testleri (Faz 3b)
 *  - Voxelization algoritması: küp STL → Heks8 mesh
 *  - Ray casting parite testi (içeride/dışarıda)
 *  - veFEAMeshFromGeometry mode parametresi (auto/volume/surface)
 *  - VE_FEA_VOXEL_MAX_COUNT üst sınırı (voxel-too-many error)
 *  - Async STEP wrapper (mock'lanmış OCCT)
 *  - cp-fea.js Mesh Modu dropdown'u
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '../..');

eval(fs.readFileSync(path.join(ROOT, 'js/components.js'), 'utf8'));
eval(fs.readFileSync(path.join(ROOT, 'js/fea-primitives.js'), 'utf8'));
eval(fs.readFileSync(path.join(ROOT, 'js/fea-step.js'), 'utf8'));
eval(fs.readFileSync(path.join(ROOT, 'js/fea-topology.js'), 'utf8'));
eval(fs.readFileSync(path.join(ROOT, 'js/fea-mesh.js'), 'utf8'));
eval(fs.readFileSync(path.join(ROOT, 'js/fea-viewer.js'), 'utf8'));
eval(fs.readFileSync(path.join(ROOT, 'js/fea-mesh-editor.js'), 'utf8'));
eval(fs.readFileSync(path.join(ROOT, 'js/cp-fea.js'), 'utf8'));

// Test helper — side panel sadeleştirildi. Mesh kontrolleri modal'da accordion
// builder'larında. Geri-uyumlu testler için tümünü birleştirir.
function _testRenderFullMeshUI(node) {
  var toolbar = _veFEAEditorBuildToolbar(node);
  var rightPanel = _veFEAEditorBuildRightPanel(node);
  var leftPanel = _veFEAEditorBuildLeftPanel(node);
  return (
    getFEAMeshPropertiesHTML(node) +
    toolbar.outerHTML +
    leftPanel.outerHTML +
    rightPanel.outerHTML
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Test fixture: 10×10×10 küp (CCW dış normal) — STL ile aynı
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

// 10×10×10 küp üçgenlerini doğrudan parsed format'a getir (vertices flat array)
function getCubeParsed() {
  var tris = buildCubeTriangles();
  var vertices = new Float32Array(tris.length * 9);
  var normals  = new Float32Array(tris.length * 9);
  for (var i = 0; i < tris.length; i++) {
    var t = tris[i];
    for (var j = 0; j < 9; j++) vertices[i * 9 + j] = t[j];
    for (var k = 0; k < 3; k++) {
      normals[i * 9 + k * 3]     = t[9];
      normals[i * 9 + k * 3 + 1] = t[10];
      normals[i * 9 + k * 3 + 2] = t[11];
    }
  }
  return { vertices: vertices, normals: normals, triangleCount: tris.length };
}

// Geometriye atamak için cube'u parsed obje ile birlikte rawDataB64'sız döner.
// Mesh dispatcher rawDataB64 yokken async wrapper'a düşer — testler için bunu
// bypass etmek isteyenler doğrudan _veFEAVoxelizeTrianglesToHex çağırır.
function buildCubeBase64Geom() {
  return { type: 'step', triangleCount: 12, sourceLabel: 'cube.step',
           bbox: { x: 10, y: 10, z: 10 } };
}

// ────────────────────────────────────────────────────────────────────────────
describe('_veFEAVoxelizeTrianglesToHex — küp 10×10×10', () => {
  test('size=5: 2×2×2 = 8 voxel beklenir', () => {
    var parsed = getCubeParsed();
    var m = _veFEAVoxelizeTrianglesToHex(parsed, 5, 'step');
    expect(m).not.toBeNull();
    expect(m.type).toBe('hex8');
    expect(m.voxelMode).toBe(true);
    expect(m.grid.nx).toBe(2);
    expect(m.grid.ny).toBe(2);
    expect(m.grid.nz).toBe(2);
    expect(m.elements.length / 8).toBe(8);
    // 3×3×3 = 27 dedup'lı düğüm
    expect(m.nodes.length / 3).toBe(27);
  });

  test('size=2: 5×5×5 = 125 voxel', () => {
    var parsed = getCubeParsed();
    var m = _veFEAVoxelizeTrianglesToHex(parsed, 2, 'step');
    expect(m.elements.length / 8).toBe(125);
    expect(m.nodes.length / 3).toBe(216); // 6³
  });

  test('size=10: 1×1×1 = 1 voxel', () => {
    var parsed = getCubeParsed();
    var m = _veFEAVoxelizeTrianglesToHex(parsed, 10, 'step');
    expect(m.elements.length / 8).toBe(1);
    expect(m.nodes.length / 3).toBe(8);
  });

  test('voxel sayısı VE_FEA_VOXEL_MAX_COUNT aşarsa error döner', () => {
    var parsed = getCubeParsed();
    // 10×10×10 küp + size=0.01 → 1000³ = 1G voxel (sınırı çok aşar)
    var m = _veFEAVoxelizeTrianglesToHex(parsed, 0.01, 'step');
    expect(m.error).toBe('voxel-too-many');
    expect(m.total).toBeGreaterThan(VE_FEA_VOXEL_MAX_COUNT);
  });

  test('null/boş parsed için null döner', () => {
    expect(_veFEAVoxelizeTrianglesToHex(null, 5, 'step')).toBeNull();
    expect(_veFEAVoxelizeTrianglesToHex({ vertices: new Float32Array(0), triangleCount: 0 }, 5, 'step')).toBeNull();
  });

  test('hacim error olmadan: geometryType voxel- prefix\'i taşır', () => {
    var parsed = getCubeParsed();
    var m = _veFEAVoxelizeTrianglesToHex(parsed, 5, 'step');
    expect(m.geometryType).toBe('voxel-step');
  });
});

// ────────────────────────────────────────────────────────────────────────────
describe('veFEAMeshFromGeometry — mode parametresi', () => {
  function makeStepGeom() {
    return { type: 'step', sourceLabel: 'cube.step', triangleCount: 12,
             _parsedTriangles: getCubeParsed() };
  }

  test('default mode (auto): STEP → voxel hacim Heks8', () => {
    var m = veFEAMeshFromGeometry(makeStepGeom(), { size: 5 });
    expect(m.type).toBe('hex8');
    expect(m.voxelMode).toBe(true);
  });

  test('mode "volume": STEP → voxel hacim Heks8', () => {
    var m = veFEAMeshFromGeometry(makeStepGeom(), { size: 5, mode: 'volume' });
    expect(m.type).toBe('hex8');
    expect(m.voxelMode).toBe(true);
  });

  test('mode "surface": STEP → Tri3 yüzey mesh', () => {
    var m = veFEAMeshFromGeometry(makeStepGeom(), { size: 5, mode: 'surface' });
    expect(m.type).toBe('tri3');
    expect(m.elements.length / 3).toBe(12);
  });

  test('primitif kutu mode\'a duyarsız (her zaman Heks8 structured)', () => {
    var box = { type: 'box', params: { width: 10, height: 10, depth: 10 } };
    expect(veFEAMeshFromGeometry(box, { size: 5, mode: 'auto' }).type).toBe('hex8');
    expect(veFEAMeshFromGeometry(box, { size: 5, mode: 'volume' }).type).toBe('hex8');
    expect(veFEAMeshFromGeometry(box, { size: 5, mode: 'surface' }).type).toBe('hex8');
  });

  test('voxel-too-many error doğrudan _veFEAVoxelizeTrianglesToHex üzerinden iletilir', () => {
    // veFEAMeshFromGeometry size'ı VE_FEA_MESH_MIN_SIZE=0.5 mm'e clamp eder,
    // dolayısıyla 10 mm küpte 5M voxel'i aşmak için doğrudan voxelize çağrılır
    var parsed = getCubeParsed();
    var m = _veFEAVoxelizeTrianglesToHex(parsed, 0.01, 'step');
    expect(m.error).toBe('voxel-too-many');
  });
});

// ────────────────────────────────────────────────────────────────────────────
describe('veFEAMeshFromGeometryAsync', () => {
  test('STEP sync yolu çalışır: Promise.resolve(meshData)', () => {
    var geom = { type: 'step', triangleCount: 12, _parsedTriangles: getCubeParsed() };
    return veFEAMeshFromGeometryAsync(geom, { size: 5 }).then(function(m) {
      expect(m).not.toBeNull();
      expect(m.type).toBe('hex8');
    });
  });

  test('primitif sync: Promise.resolve(meshData)', () => {
    var box = { type: 'box', params: { width: 10, height: 10, depth: 10 } };
    return veFEAMeshFromGeometryAsync(box, { size: 5 }).then(function(m) {
      expect(m).not.toBeNull();
      expect(m.elements.length / 8).toBe(8);
    });
  });

  test('STEP async: occtimportjs mock ile parse + voxelize', () => {
    // Önceki state'i sıfırla
    VE_FEA_OCCT_STATE.module = null;
    VE_FEA_OCCT_STATE.loading = null;
    // OCCT mock: 10x10x10 küp tessellation
    global.occtimportjs = jest.fn(function() {
      return Promise.resolve({
        ReadStepFile: function() {
          // 12 üçgenli küp, OCCT format'ında
          var tris = buildCubeTriangles();
          var pos = [];
          var idx = [];
          for (var i = 0; i < tris.length; i++) {
            var t = tris[i];
            pos.push(t[0], t[1], t[2]);
            pos.push(t[3], t[4], t[5]);
            pos.push(t[6], t[7], t[8]);
            idx.push(i*3, i*3+1, i*3+2);
          }
          return {
            success: true,
            meshes: [{
              attributes: { position: { array: new Float32Array(pos) } },
              index: { array: idx }
            }]
          };
        }
      });
    });

    // Stub: rawDataB64 (içerik önemsiz, mock OCCT okumayacak)
    var geom = { type: 'step', rawDataB64: veFEAArrayBufferToBase64(new ArrayBuffer(32)) };
    return veFEAMeshFromGeometryAsync(geom, { size: 5 }).then(function(m) {
      expect(m).not.toBeNull();
      expect(m.type).toBe('hex8');
      expect(m.voxelMode).toBe(true);
      expect(m.elements.length / 8).toBe(8); // küp 5mm size → 2³
    });
  });

  test('null geometri için Promise.resolve(null)', () => {
    return veFEAMeshFromGeometryAsync(null).then(function(m) {
      expect(m).toBeNull();
    });
  });
});

// ────────────────────────────────────────────────────────────────────────────
describe('Voxel mesh — dedup ve element bütünlüğü', () => {
  test('Tüm element indeksleri geçerli node aralığında', () => {
    var parsed = getCubeParsed();
    var m = _veFEAVoxelizeTrianglesToHex(parsed, 2, 'step');
    var maxIdx = m.nodes.length / 3 - 1;
    var ok = true;
    for (var i = 0; i < m.elements.length; i++) {
      if (m.elements[i] < 0 || m.elements[i] > maxIdx) { ok = false; break; }
    }
    expect(ok).toBe(true);
  });

  test('Komşu voxel\'ler köşe paylaşır (dedup çalışıyor)', () => {
    var parsed = getCubeParsed();
    var m = _veFEAVoxelizeTrianglesToHex(parsed, 5, 'step');
    // 2×2×2 = 8 voxel × 8 köşe = 64 ham vertex
    // Dedup'lı: 3×3×3 = 27 unique
    expect(m.nodes.length / 3).toBeLessThan(64);
    expect(m.nodes.length / 3).toBe(27);
  });

  test('Voxel mesh bbox 10×10×10 küpe yakın', () => {
    var parsed = getCubeParsed();
    var m = _veFEAVoxelizeTrianglesToHex(parsed, 5, 'step');
    var minX=Infinity, maxX=-Infinity, minY=Infinity, maxY=-Infinity, minZ=Infinity, maxZ=-Infinity;
    for (var i = 0; i < m.nodes.length; i += 3) {
      if (m.nodes[i] < minX) minX = m.nodes[i];
      if (m.nodes[i] > maxX) maxX = m.nodes[i];
      if (m.nodes[i+1] < minY) minY = m.nodes[i+1];
      if (m.nodes[i+1] > maxY) maxY = m.nodes[i+1];
      if (m.nodes[i+2] < minZ) minZ = m.nodes[i+2];
      if (m.nodes[i+2] > maxZ) maxZ = m.nodes[i+2];
    }
    // padding (voxelSize * 0.01) küçük; aralık ~ 10 olmalı
    expect(maxX - minX).toBeCloseTo(10, 0);
    expect(maxY - minY).toBeCloseTo(10, 0);
    expect(maxZ - minZ).toBeCloseTo(10, 0);
  });
});

// ────────────────────────────────────────────────────────────────────────────
describe('cp-fea.js Mesh Modu dropdown', () => {
  beforeEach(() => {
    global.nodes = [];
    global.connections = [];
  });

  test('Mesh Modu select rendering edilir (3 seçenek)', () => {
    var node = { id: 'mesh-m1', type: 'fea-mesh', data: {} };
    global.nodes = [node];
    var html = _testRenderFullMeshUI(node);
    expect(html).toMatch(/id="ve-fea-mesh-mode-mesh-m1"/);
    expect(html).toMatch(/value="auto"/);
    expect(html).toMatch(/value="volume"/);
    expect(html).toMatch(/value="surface"/);
  });

  test('Default mode "auto" seçili', () => {
    var node = { id: 'mesh-m2', type: 'fea-mesh', data: {} };
    global.nodes = [node];
    var html = _testRenderFullMeshUI(node);
    expect(html).toMatch(/value="auto"\s+selected/);
  });

  test('Persist edilmiş mode UI\'da işaretlenir', () => {
    var node = { id: 'mesh-m3', type: 'fea-mesh', data: { meshSettings: { size: 10, mode: 'surface' } } };
    global.nodes = [node];
    var html = _testRenderFullMeshUI(node);
    expect(html).toMatch(/value="surface"\s+selected/);
    // Mode dropdown'un içindeki "auto" seçili olmamalı (elementType dropdown auto seçili olabilir).
    var modeSelect = html.match(/<select id="ve-fea-mesh-mode-[\s\S]*?<\/select>/);
    expect(modeSelect).not.toBeNull();
    expect(modeSelect[0]).not.toMatch(/value="auto"\s+selected/);
  });
});

// ────────────────────────────────────────────────────────────────────────────
describe('veFEABuildMeshForNode — voxel error handling', () => {
  beforeEach(() => {
    global.nodes = [];
    global.connections = [];
    global.showToast = jest.fn();
    global.showNodeProperties = jest.fn();
    global.saveState = jest.fn();
    Object.keys(veFEAMeshCache).forEach((k) => delete veFEAMeshCache[k]);
  });

  test('STEP geometri + clamp altı size → MIN_SIZE\'a clamp + başarılı mesh', () => {
    // Çok küçük size (0.01) VE_FEA_MESH_MIN_SIZE=0.5 mm'e clamp olur.
    // Voxel-too-many error tetiklenmez, mesh oluşur ama makul boyutta.
    global.nodes = [
      { id: 'geom-1', type: 'fea-geometry', data: { geometry: { type: 'step', triangleCount: 12, _parsedTriangles: getCubeParsed() } } },
      { id: 'mesh-1', type: 'fea-mesh', data: { meshSettings: { size: 0.01, mode: 'auto' } } }
    ];
    global.connections = [{ from: 'geom-1', to: 'mesh-1' }];
    veFEABuildMeshForNode('mesh-1');
    // 0.01 → clamp 0.5 mm. 10/0.5 = 20³ = 8000 voxel (< 5M sınır).
    expect(veFEAMeshCache['mesh-1']).toBeDefined();
    expect(veFEAMeshCache['mesh-1'].elements.length / 8).toBe(8000);
  });

  test('STEP geometri + makul size → voxel hacim mesh + success toast', () => {
    global.nodes = [
      { id: 'geom-1', type: 'fea-geometry', data: { geometry: { type: 'step', triangleCount: 12, _parsedTriangles: getCubeParsed() } } },
      { id: 'mesh-1', type: 'fea-mesh', data: { meshSettings: { size: 5, mode: 'auto' } } }
    ];
    global.connections = [{ from: 'geom-1', to: 'mesh-1' }];
    veFEABuildMeshForNode('mesh-1');
    var success = global.showToast.mock.calls.filter((c) => c[1] === 'success');
    expect(success.length).toBeGreaterThan(0);
    expect(veFEAMeshCache['mesh-1']).toBeDefined();
    expect(veFEAMeshCache['mesh-1'].elements.length / 8).toBe(8); // 2×2×2 voxel
    expect(global.nodes[1].data.meshMetrics.voxelMode).toBe(true);
  });
});
