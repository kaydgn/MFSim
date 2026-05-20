/**
 * MFSim FEA Delaunay tet mesher — birim testleri.
 *
 * Doğrulanan:
 *  1. delaunay-triangulate bundle (vendor/) ve LICENSE mevcut.
 *  2. js/fea-delaunay.js public API'yi expose ediyor.
 *  3. Vertex de-duplication doğru (triangle-soup → indexed point set).
 *  4. Bundle yüklenmemiş ortamda graceful skip.
 *  5. Gerçek Delaunay end-to-end: küp → tet mesh (parite testi sonrası).
 *  6. fea-mesh.js entegrasyonu (yeni helper isimleri + Delaunay yolu).
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '../..');

describe('Delaunay — vendor altyapısı', () => {
  test('vendor/delaunay/delaunay-bundle.js bundle edilmiş', () => {
    expect(fs.existsSync(path.join(ROOT, 'vendor/delaunay/delaunay-bundle.js'))).toBe(true);
  });

  test('vendor/delaunay/NOTICE.md ve LICENSE mevcut', () => {
    expect(fs.existsSync(path.join(ROOT, 'vendor/delaunay/NOTICE.md'))).toBe(true);
    expect(fs.existsSync(path.join(ROOT, 'vendor/delaunay/LICENSE-delaunay-triangulate.txt'))).toBe(true);
    const lic = fs.readFileSync(path.join(ROOT, 'vendor/delaunay/LICENSE-delaunay-triangulate.txt'), 'utf8');
    expect(lic).toMatch(/MIT License/);
    expect(lic).toMatch(/Mikola Lysenko/);
  });

  test('package.json içinde delaunay-triangulate runtime dep, esbuild devDep', () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
    expect(pkg.dependencies['delaunay-triangulate']).toBeDefined();
    expect(pkg.devDependencies['esbuild']).toBeDefined();
  });

  test('scripts/sync-vendor.js delaunay bundle adımı içeriyor', () => {
    const src = fs.readFileSync(path.join(ROOT, 'scripts/sync-vendor.js'), 'utf8');
    expect(src).toMatch(/esbuild/);
    expect(src).toMatch(/delaunay-bundle\.js/);
    // globalThis ile worker uyumu
    expect(src).toMatch(/globalThis/);
  });
});

describe('fea-delaunay.js — public API', () => {
  const delaunaySrc = fs.readFileSync(path.join(ROOT, 'js/fea-delaunay.js'), 'utf8');
  let api;
  beforeAll(() => {
    const mod = { exports: {} };
    const fn = new Function('module', 'window', 'global', delaunaySrc + '\nreturn module;');
    api = fn(mod, undefined, undefined).exports;
  });

  test('public API export edilmiş', () => {
    expect(typeof api.veFEADelaunayAvailable).toBe('function');
    expect(typeof api.veFEADelaunayDiagnose).toBe('function');
    expect(typeof api.veFEADelaunayTetrahedralize).toBe('function');
  });

  test('Bundle yokken veFEADelaunayAvailable false döner', () => {
    expect(api.veFEADelaunayAvailable()).toBe(false);
  });

  test('Bundle yokken veFEADelaunayTetrahedralize graceful error döner', () => {
    var parsed = { vertices: new Float32Array([0,0,0, 1,0,0, 0,1,0]), triangleCount: 1 };
    return api.veFEADelaunayTetrahedralize(parsed, {}).then(function(res) {
      expect(res.error).toMatch(/yüklenmemiş|kütüphane/);
    });
  });

  test('Boş parsed için anında error', () => {
    return api.veFEADelaunayTetrahedralize(null, {}).then(function(res) {
      expect(res.error).toBeTruthy();
    });
  });

  test('Vertex de-duplication: triangle soup → indexed PLC', () => {
    // 2 üçgen, 1 ortak edge → 4 unique vertex
    var verts = new Float32Array([
      0, 0, 0,  1, 0, 0,  0, 1, 0,
      1, 0, 0,  1, 1, 0,  0, 1, 0
    ]);
    var result = api._veFEADelaunayDedupVertices(verts, 2);
    expect(result.pointCount).toBe(4);
    expect(result.coords.length).toBe(12);
    expect(result.triangles.length).toBe(6);
  });
});

describe('Yüzey nokta sampling + progress callback', () => {
  beforeAll(() => {
    if (typeof globalThis.veFEADelaunayTriangulate === 'function') return;
    const bundleSrc = fs.readFileSync(path.join(ROOT, 'vendor/delaunay/delaunay-bundle.js'), 'utf8');
    eval(bundleSrc);
  });

  test('Büyük üçgenler surface sampling ile bölünüyor', () => {
    // 100×100 alanlı tek büyük üçgen — targetSize 10 ile bölünmeli
    var v = [0,0,0, 100,0,0, 0,100,0];
    var parsed = { vertices: new Float32Array(v), triangleCount: 1 };
    const delaunaySrc = fs.readFileSync(path.join(ROOT, 'js/fea-delaunay.js'), 'utf8');
    const mod = { exports: {} };
    const fn = new Function('module', 'window', 'global', delaunaySrc + '\nreturn module;');
    const api = fn(mod, globalThis, globalThis).exports;
    var dedup = { coords: [0,0,0, 100,0,0, 0,100,0], pointCount: 3 };
    api._veFEADelaunaySampleSurfacePoints(dedup, parsed, 10);
    // 100×100 / 2 = 5000 alan, refArea = 100·0.433·0.5 ≈ 21.6 → ~230 nokta beklenir
    expect(dedup.surfacePointsAdded).toBeGreaterThan(100);
    expect(dedup.pointCount).toBeGreaterThan(100);
  });

  test('Küçük üçgenler surface sampling ile bölünmüyor (zaten yeterince ince)', () => {
    // 1×1 küçük üçgen — targetSize 10 ile dokunulmamalı
    var v = [0,0,0, 1,0,0, 0,1,0];
    var parsed = { vertices: new Float32Array(v), triangleCount: 1 };
    const delaunaySrc = fs.readFileSync(path.join(ROOT, 'js/fea-delaunay.js'), 'utf8');
    const mod = { exports: {} };
    const fn = new Function('module', 'window', 'global', delaunaySrc + '\nreturn module;');
    const api = fn(mod, globalThis, globalThis).exports;
    var dedup = { coords: [0,0,0, 1,0,0, 0,1,0], pointCount: 3 };
    api._veFEADelaunaySampleSurfacePoints(dedup, parsed, 10);
    expect(dedup.surfacePointsAdded).toBe(0);
    expect(dedup.pointCount).toBe(3);
  });

  test('progressCallback fazları sırayla raporluyor', () => {
    var v = [
      0,0,0, 10,0,0, 0,10,0,   0,0,0, 0,10,0, 10,10,0,
      0,0,5, 0,10,5, 10,0,5,   0,10,5, 10,10,5, 10,0,5,
      0,0,0, 10,0,5, 10,0,0,   0,0,0, 0,0,5, 10,0,5,
      10,0,0, 10,0,5, 10,10,0, 10,10,0, 10,0,5, 10,10,5,
      0,10,0, 10,10,5, 0,10,5, 0,10,0, 10,10,0, 10,10,5,
      0,0,0, 0,10,0, 0,0,5,    0,10,0, 0,10,5, 0,0,5
    ];
    var parsed = { vertices: new Float32Array(v), triangleCount: 12 };
    const delaunaySrc = fs.readFileSync(path.join(ROOT, 'js/fea-delaunay.js'), 'utf8');
    const mod = { exports: {} };
    const fn = new Function('module', 'window', 'global', delaunaySrc + '\nreturn module;');
    const api = fn(mod, globalThis, globalThis).exports;
    var phases = [];
    return api.veFEADelaunayTetrahedralize(parsed, {
      targetSize: 5,
      onProgress: function(stage) { phases.push(stage); }
    }).then(function(r) {
      // Fazlar sırayla raporlanmalı
      var expected = ['dedup','surface','interior','delaunay','parity','compact','done'];
      expected.forEach(function(p) { expect(phases).toContain(p); });
      // Done fazı son olmalı
      expect(phases[phases.length-1]).toBe('done');
    });
  });
});

describe('Delaunay — gerçek tet mesh (bundle yüklü)', () => {
  // Bundle'ı load et — globalThis.veFEADelaunayTriangulate set olur
  beforeAll(() => {
    if (typeof globalThis.veFEADelaunayTriangulate === 'function') return;
    const bundleSrc = fs.readFileSync(path.join(ROOT, 'vendor/delaunay/delaunay-bundle.js'), 'utf8');
    eval(bundleSrc);
  });

  test('veFEADelaunayTriangulate global olarak set edilmiş', () => {
    expect(typeof globalThis.veFEADelaunayTriangulate).toBe('function');
  });

  test('Küp (8 köşe + 1 iç) → 12 tet (Delaunay)', () => {
    var pts = [
      [0,0,0],[10,0,0],[10,10,0],[0,10,0],
      [0,0,10],[10,0,10],[10,10,10],[0,10,10],
      [5,5,5]
    ];
    var tets = globalThis.veFEADelaunayTriangulate(pts);
    expect(tets.length).toBe(12);
    tets.forEach(function(t) { expect(t.length).toBe(4); });
  });

  test('veFEADelaunayTetrahedralize: parsed küp → tet mesh', () => {
    // 10×10×10 küp, 12 üçgen (kapalı yüzey CCW dış normal)
    var v = [
      0,0,0, 10,10,0, 10,0,0,   0,0,0, 0,10,0, 10,10,0,    // alt
      0,0,10, 10,0,10, 10,10,10,   0,0,10, 10,10,10, 0,10,10, // üst
      0,0,0, 10,0,0, 10,0,10,   0,0,0, 10,0,10, 0,0,10,    // ön
      10,0,0, 10,10,0, 10,10,10,   10,0,0, 10,10,10, 10,0,10, // sağ
      10,10,0, 0,10,0, 0,10,10,   10,10,0, 0,10,10, 10,10,10, // arka
      0,10,0, 0,0,0, 0,0,10,   0,10,0, 0,0,10, 0,10,10     // sol
    ];
    var parsed = { vertices: new Float32Array(v), triangleCount: 12 };

    // Bundle Node'da yüklendi; fea-delaunay.js'i de yükle (CommonJS)
    const delaunaySrc = fs.readFileSync(path.join(ROOT, 'js/fea-delaunay.js'), 'utf8');
    const mod = { exports: {} };
    const fn = new Function('module', 'window', 'global', 'performance', delaunaySrc + '\nreturn module;');
    // window olarak globalThis verirsek bundle bulunur
    const api = fn(mod, globalThis, globalThis, undefined).exports;

    expect(api.veFEADelaunayAvailable()).toBe(true);

    return api.veFEADelaunayTetrahedralize(parsed, {
      targetSize: 5, addInteriorPoints: true
    }).then(function(result) {
      expect(result.error).toBeUndefined();
      expect(result.type).toBe('tet4');
      expect(result.nodes.length).toBeGreaterThan(0);
      expect(result.elements.length).toBeGreaterThan(0);
      expect(result.elements.length % 4).toBe(0);
      expect(result.info.outputTets).toBeGreaterThan(0);
      // Tüm element indeksleri geçerli düğüm aralığında
      var nodeCount = result.nodes.length / 3;
      for (var i = 0; i < result.elements.length; i++) {
        expect(result.elements[i]).toBeLessThan(nodeCount);
      }
    });
  });
});

describe('fea-mesh.js — Delaunay entegrasyonu', () => {
  test('_veFEAShouldTryTetMesher + _veFEAMeshWithTetMesherOrVoxel tanımlı', () => {
    const src = fs.readFileSync(path.join(ROOT, 'js/fea-mesh.js'), 'utf8');
    expect(src).toMatch(/function _veFEAShouldTryTetMesher/);
    expect(src).toMatch(/function _veFEAMeshWithTetMesherOrVoxel/);
    expect(src).toMatch(/function _veFEAWrapDelaunayResult/);
    // TetGen referansları kalmadı
    expect(src).not.toMatch(/_veFEAShouldTryTetgen/);
    expect(src).not.toMatch(/_veFEAMeshWithTetgenOrVoxel/);
  });

  test('Delaunay yokken fea-mesh graceful — voxel fallback', () => {
    const src = fs.readFileSync(path.join(ROOT, 'js/fea-mesh.js'), 'utf8');
    expect(src).toMatch(/typeof veFEADelaunayTetrahedralize !== ['"]function['"]/);
    expect(src).toMatch(/buildVoxelFallback/);
  });
});

describe('UI entegrasyonu — Delaunay etiketi (TetGen kaldırıldı)', () => {
  test('fea-mesh-editor.js Delaunay kontrol elemanları HTML üretiyor', () => {
    const src = fs.readFileSync(path.join(ROOT, 'js/fea-mesh-editor.js'), 'utf8');
    expect(src).toMatch(/ve-fea-mesh-tetmesher-/);
    expect(src).toMatch(/Delaunay Tet Mesher/);
    expect(src).toMatch(/Mikola Lysenko/);
    // TetGen referansları temizlendi
    expect(src).not.toMatch(/ve-fea-mesh-tetgen-/);
    expect(src).not.toMatch(/AGPL/);
  });

  test('cp-fea.js Delaunay ayarlarını meshSettings\'a kaydediyor', () => {
    const src = fs.readFileSync(path.join(ROOT, 'js/cp-fea.js'), 'utf8');
    expect(src).toMatch(/meshSettings\.useTetMesher/);
    expect(src).toMatch(/meshSettings\.delaunayAddInteriorPoints/);
  });

  test('fea-viewer.js useTetMesher seçeneklerini meshOpts üzerinden geçiriyor', () => {
    const src = fs.readFileSync(path.join(ROOT, 'js/fea-viewer.js'), 'utf8');
    expect(src).toMatch(/useTetMesher:\s*settings\.useTetMesher/);
    expect(src).toMatch(/tetMesherWanted/);
  });
});

describe('build + worker entegrasyonu', () => {
  test('index.html delaunay-bundle.js script tag\'i içeriyor', () => {
    const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
    expect(html).toMatch(/src="vendor\/delaunay\/delaunay-bundle\.js"/);
    expect(html).toMatch(/src="js\/fea-delaunay\.js"/);
    // TetGen INLINE_FILE'ları gitti
    expect(html).not.toMatch(/vendor\/tetgen\//);
  });

  test('fea-mesh-worker.js delaunay-bundle import ediyor', () => {
    const src = fs.readFileSync(path.join(ROOT, 'js/fea-mesh-worker.js'), 'utf8');
    expect(src).toMatch(/delaunay-bundle\.js/);
    expect(src).toMatch(/fea-delaunay\.js/);
    expect(src).not.toMatch(/fea-tetgen/);
  });

  test('build.js TetGen hint kaldırılmış', () => {
    const src = fs.readFileSync(path.join(ROOT, 'build.js'), 'utf8');
    expect(src).not.toMatch(/build:wasm:tetgen/);
    expect(src).not.toMatch(/AGPL-3\.0/);
  });

  test('.gitignore TetGen satırları yok', () => {
    const gi = fs.readFileSync(path.join(ROOT, '.gitignore'), 'utf8');
    expect(gi).not.toMatch(/tetgen/);
  });
});
