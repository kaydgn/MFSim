/**
 * MFSim FEA TetGen — birim testleri.
 *
 * Doğrulanan:
 *  1. TetGen kaynak dosyaları (src/fea/tetgen/) ve LICENSE mevcut.
 *  2. build:wasm:tetgen script tanımlı, scripts/build-tetgen-wasm.js mevcut.
 *  3. js/fea-tetgen.js public API'yi expose ediyor.
 *  4. WASM yüklenememiş ortamda graceful degradation (voxel fallback'e döner).
 *  5. Vertex de-duplication doğru çalışıyor (triangle-soup → indexed PLC).
 *  6. fea-mesh.js TetGen yolunu doğru entegre ediyor (_veFEAShouldTryTetgen,
 *     _veFEAMeshWithTetMesherOrVoxel 3-katmanlı kademe, _veFEATetMeshNamedSelections).
 *  7. index.html'de INLINE_FILE placeholder'ları ve script tag'i mevcut.
 *
 * NOT: Gerçek WASM yürütme testi yapılmaz — WASM derlenmiş olmayabilir.
 * Gerçek end-to-end test build:wasm:tetgen sonrası elle ya da CI'da yapılır.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '../..');

// ────────────────────────────────────────────────────────────────────────────
describe('TetGen — kaynak dosyaları ve build altyapısı', () => {
  test('TetGen C++ kaynakları (src/fea/tetgen/) mevcut', () => {
    expect(fs.existsSync(path.join(ROOT, 'src/fea/tetgen/tetgen.h'))).toBe(true);
    expect(fs.existsSync(path.join(ROOT, 'src/fea/tetgen/tetgen.cxx'))).toBe(true);
    expect(fs.existsSync(path.join(ROOT, 'src/fea/tetgen/predicates.cxx'))).toBe(true);
    expect(fs.existsSync(path.join(ROOT, 'src/fea/tetgen/tetgen_wasm.cpp'))).toBe(true);
  });

  test('AGPL-3.0 lisans dosyası vendor edilmiş', () => {
    expect(fs.existsSync(path.join(ROOT, 'src/fea/tetgen/LICENSE-AGPLv3.txt'))).toBe(true);
    const lic = fs.readFileSync(path.join(ROOT, 'src/fea/tetgen/LICENSE-AGPLv3.txt'), 'utf8');
    expect(lic).toMatch(/GNU AFFERO GENERAL PUBLIC LICENSE/);
  });

  test('vendor/tetgen/NOTICE.md AGPL uyarısı içeriyor', () => {
    const notice = path.join(ROOT, 'vendor/tetgen/NOTICE.md');
    expect(fs.existsSync(notice)).toBe(true);
    const text = fs.readFileSync(notice, 'utf8');
    expect(text).toMatch(/AGPL-3\.0/);
    expect(text).toMatch(/wias-berlin\.de/);  // Ticari lisans iletişim
  });

  test('vendor/tetgen/LICENSE.txt mevcut (AGPL kopyası)', () => {
    expect(fs.existsSync(path.join(ROOT, 'vendor/tetgen/LICENSE.txt'))).toBe(true);
  });

  test('scripts/build-tetgen-wasm.js mevcut ve predicates -O0 ile derliyor', () => {
    const buildScript = path.join(ROOT, 'scripts/build-tetgen-wasm.js');
    expect(fs.existsSync(buildScript)).toBe(true);
    const text = fs.readFileSync(buildScript, 'utf8');
    // predicates.cxx Shewchuk exact arithmetic için -O0 olmalı (kritik)
    expect(text).toMatch(/predicates\.cxx[\s\S]*-O0/);
    // tetgen.cxx + wrapper -O2 ile derlenmeli
    expect(text).toMatch(/-O2/);
    expect(text).toMatch(/TETLIBRARY/);
    expect(text).toMatch(/EXPORT_NAME[^,]*TetgenWasmModule/);
  });

  test('package.json içinde build:wasm:tetgen script tanımlı', () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
    expect(pkg.scripts && pkg.scripts['build:wasm:tetgen']).toBe('node scripts/build-tetgen-wasm.js');
  });

  test('.gitignore TetGen WASM build çıktısını dışlıyor (AGPL nedeniyle)', () => {
    const gi = fs.readFileSync(path.join(ROOT, '.gitignore'), 'utf8');
    expect(gi).toMatch(/vendor\/tetgen\/tetgen-wasm\.js/);
    expect(gi).toMatch(/vendor\/tetgen\/tetgen-wasm\.wasm/);
  });

  test('CI workflow TetGen WASM build adımını içeriyor (test + deploy)', () => {
    const wf = path.join(ROOT, '.github/workflows/ci-deploy.yml');
    expect(fs.existsSync(wf)).toBe(true);
    const yml = fs.readFileSync(wf, 'utf8');
    // emscripten kurulumu + build:wasm:tetgen adımı her iki job'da da olmalı
    expect(yml).toMatch(/setup-emsdk/);
    // build:wasm:tetgen, hem test hem deploy job'ında (2 kez) çağrılır
    const occurrences = (yml.match(/npm run build:wasm:tetgen/g) || []).length;
    expect(occurrences).toBeGreaterThanOrEqual(2);
    // TetGen build, monolitik "npm run build"den ÖNCE gelmeli (inline için)
    const idxTetgen = yml.indexOf('build:wasm:tetgen');
    const idxBuild = yml.indexOf('run: npm run build\n');
    expect(idxTetgen).toBeGreaterThan(-1);
    expect(idxTetgen).toBeLessThan(idxBuild);
  });
});

// ────────────────────────────────────────────────────────────────────────────
describe('fea-tetgen.js — public API', () => {
  // Modülü Node ortamında yükle (CommonJS export sağlanıyor)
  const tetgenSrc = fs.readFileSync(path.join(ROOT, 'js/fea-tetgen.js'), 'utf8');
  let api;
  beforeAll(() => {
    // Sandbox eval: window & document undefined geçirerek script loader yolunu
    // baypas et — modül "document yok" hatasını promise olarak döndürür.
    const mod = { exports: {} };
    const fn = new Function('module', 'window', 'document', 'URL', 'Blob', tetgenSrc + '\nreturn module;');
    api = fn(mod, undefined, undefined, undefined, undefined).exports;
  });

  test('veFEATetgenIsBuilt + veFEATetgenEnsureWasm + veFEATetgenTetrahedralize export edilmiş', () => {
    expect(typeof api.veFEATetgenIsBuilt).toBe('function');
    expect(typeof api.veFEATetgenEnsureWasm).toBe('function');
    expect(typeof api.veFEATetgenTetrahedralize).toBe('function');
  });

  test('veFEATetgenIsBuilt window/inline yokken false döner (graceful)', () => {
    // Node ortamında window tanımsız → false
    expect(api.veFEATetgenIsBuilt()).toBe(false);
  });

  test('vertex de-duplication: triangle-soup → indexed PLC', () => {
    // 2 üçgen, 1 ortak edge → 6 vertex slot ama 4 unique vertex
    var verts = new Float32Array([
      0, 0, 0,  1, 0, 0,  0, 1, 0,   // tri 1
      1, 0, 0,  1, 1, 0,  0, 1, 0    // tri 2 (paylaşılan: v1=v3, v2=v5)
    ]);
    var result = api._veFEATetgenDeduplicateVertices(verts, 2);
    expect(result.pointCount).toBe(4);
    expect(result.points.length).toBe(12);  // 4 × 3 doubles
    expect(result.triangles.length).toBe(6); // 2 tri × 3 indices
    // Vertices doğru indekslenmiş mi?
    expect(result.triangles[0]).not.toBe(result.triangles[1]);  // tri 1 farklı v
    // İlk üçgenin 3 vertex'i, ikinci üçgenin 3 vertex'inde de görünmeli
    var set1 = new Set([result.triangles[0], result.triangles[1], result.triangles[2]]);
    var set2 = new Set([result.triangles[3], result.triangles[4], result.triangles[5]]);
    // 2 ortak vertex (v=(1,0,0) ve v=(0,1,0))
    var inter = [...set1].filter(function(x) { return set2.has(x); });
    expect(inter.length).toBe(2);
  });

  test('vertex de-duplication: çok yakın (ama farklı) vertex\'ler birleştirilmez', () => {
    // BBox diagonal ~ 1.0, eps ~ 1e-6. 1e-5 ayrım → ayrı vertex.
    var verts = new Float32Array([
      0, 0, 0,  1, 0, 0,  0, 1, 0,
      0, 0, 1e-5,  1, 0, 0,  0, 1, 0     // ilk vertex 1e-5 farklı
    ]);
    var result = api._veFEATetgenDeduplicateVertices(verts, 2);
    expect(result.pointCount).toBe(4);  // 1e-5 ayrım eps üstünde → ayrı
  });

  test('veFEATetgenTetrahedralize WASM yok ortamda graceful error döner', () => {
    var parsed = {
      vertices: new Float32Array([0,0,0, 1,0,0, 0,1,0]),
      triangleCount: 1
    };
    return api.veFEATetgenTetrahedralize(parsed, {}).then(function(res) {
      expect(res.error).toBeTruthy();
      // WASM yüklenememeli (Node + no inline) → yükleme hatası
      expect(res.error).toMatch(/yüklen|geçersiz|tanımlı/);
    });
  });

  test('veFEATetgenTetrahedralize boş/geçersiz parsed için anında error döner', () => {
    return api.veFEATetgenTetrahedralize(null, {}).then(function(res) {
      expect(res.error).toBeTruthy();
    });
  });
});

// ────────────────────────────────────────────────────────────────────────────
// Gerçek WASM end-to-end — sadece vendor/tetgen/tetgen-wasm.js build edilmişse
// çalışır (CI'da build:wasm:tetgen sonrası). Build yoksa graceful skip.
describe('TetGen WASM — gerçek tetrahedralization (build varsa)', () => {
  const wasmJs = path.join(ROOT, 'vendor/tetgen/tetgen-wasm.js');
  const built = fs.existsSync(wasmJs);
  const maybe = built ? test : test.skip;

  maybe('küp PLC (8 köşe + 12 üçgen) → tet4 mesh üretir', () => {
    const TetgenWasmModule = require(wasmJs);
    const pts = [
      0,0,0, 10,0,0, 10,10,0, 0,10,0,
      0,0,10, 10,0,10, 10,10,10, 0,10,10
    ];
    const tris = [
      0,1,2, 0,2,3,  4,5,6, 4,6,7,  0,1,5, 0,5,4,
      3,2,6, 3,6,7,  0,3,7, 0,7,4,  1,2,6, 1,6,5
    ];
    const nPts = pts.length / 3, nTris = tris.length / 3, sw = 'pq1.4Q';
    return TetgenWasmModule().then((M) => {
      const pPts = M._malloc(nPts*3*8), pTri = M._malloc(nTris*3*4), pSw = M._malloc(sw.length+1);
      M.HEAPF64.set(new Float64Array(pts), pPts>>3);
      M.HEAP32.set(new Int32Array(tris), pTri>>2);
      for (let i=0;i<sw.length;i++) M.HEAPU8[pSw+i]=sw.charCodeAt(i);
      M.HEAPU8[pSw+sw.length]=0;
      const h = M.ccall('tetgen_tetrahedralize','number',
        ['number','number','number','number','number'], [pPts,nPts,pTri,nTris,pSw]);
      M._free(pPts); M._free(pTri); M._free(pSw);
      expect(h).toBeGreaterThan(0);
      const outTet = M.ccall('tetgen_out_tet_count','number',['number'],[h]);
      const npt = M.ccall('tetgen_out_nodes_per_tet','number',['number'],[h]);
      M.ccall('tetgen_free',null,['number'],[h]);
      expect(outTet).toBeGreaterThan(0);
      expect(npt).toBe(4);
    });
  });
});

// ────────────────────────────────────────────────────────────────────────────
describe('fea-mesh.js — TetGen entegrasyonu', () => {
  test('_veFEAShouldTryTetgen, _veFEAMeshWithTetMesherOrVoxel, _veFEAWrapTetgenResult tanımlı', () => {
    const src = fs.readFileSync(path.join(ROOT, 'js/fea-mesh.js'), 'utf8');
    expect(src).toMatch(/function _veFEAShouldTryTetgen/);
    expect(src).toMatch(/function _veFEAMeshWithTetMesherOrVoxel/);
    expect(src).toMatch(/function _veFEAWrapTetgenResult/);
    expect(src).toMatch(/function _veFEATetMeshNamedSelections/);
  });

  test('3 katmanlı kalite kademesi: TetGen → Delaunay → voxel', () => {
    const src = fs.readFileSync(path.join(ROOT, 'js/fea-mesh.js'), 'utf8');
    // Katman 1: TetGen üst katman olarak çağrılıyor
    expect(src).toMatch(/veFEATetgenTetrahedralize\(parsed/);
    // Katman 2+3: TetGen başarısız/yoksa Delaunay→voxel'a düşülür
    expect(src).toMatch(/function tryDelaunayThenVoxel/);
    expect(src).toMatch(/veFEADelaunayTetrahedralize\(parsed/);
    // _veFEADefaultTetgenMaxVolume helper'ı (TetGen 'a' switch)
    expect(src).toMatch(/function _veFEADefaultTetgenMaxVolume/);
  });

  test('_veFEATetMeshNamedSelections doğru face-hash yapısı kullanıyor', () => {
    const src = fs.readFileSync(path.join(ROOT, 'js/fea-mesh.js'), 'utf8');
    // Face hash: 4 face per tet, count via Map, surface = count===1
    expect(src).toMatch(/FACE_IDX\s*=\s*\[\[0,1,2\],\[0,1,3\],\[0,2,3\],\[1,2,3\]\]/);
    expect(src).toMatch(/v\s*!==\s*1/);  // İç face'ler (2 tet paylaşır) atlanır
  });

  test('veFEAMeshFromGeometryAsync tet mesher yolunu kullanır', () => {
    const src = fs.readFileSync(path.join(ROOT, 'js/fea-mesh.js'), 'utf8');
    expect(src).toMatch(/_veFEAMeshWithTetMesherOrVoxel\(parsed[^,]*,\s*geometry/);
    // Sync sonuç voxelMode ise tet mesher ile yeniden mesh denenir
    expect(src).toMatch(/sync\.voxelMode\s*===\s*true/);
    // TetGen aktifliği de bu kararda dikkate alınır
    expect(src).toMatch(/_veFEAShouldTryTetgen\(opts\)/);
  });

  test('veFEATetgenTetrahedralize yoksa fea-mesh graceful — voxel fallback', () => {
    const src = fs.readFileSync(path.join(ROOT, 'js/fea-mesh.js'), 'utf8');
    expect(src).toMatch(/typeof veFEATetgenTetrahedralize !== ['"]function['"]/);
  });
});

// ────────────────────────────────────────────────────────────────────────────
describe('UI entegrasyonu', () => {
  test('fea-mesh-editor.js TetGen kontrol elemanları HTML üretiyor', () => {
    const src = fs.readFileSync(path.join(ROOT, 'js/fea-mesh-editor.js'), 'utf8');
    expect(src).toMatch(/ve-fea-mesh-tetgen-/);
    expect(src).toMatch(/ve-fea-mesh-tetgen-rer-/);
    expect(src).toMatch(/TetGen Tet Mesher/);
    expect(src).toMatch(/AGPL-3\.0/);  // Lisans uyarısı UI'da görülmeli
  });

  test('cp-fea.js TetGen ayarlarını meshSettings\'a kaydediyor', () => {
    const src = fs.readFileSync(path.join(ROOT, 'js/cp-fea.js'), 'utf8');
    expect(src).toMatch(/meshSettings\.useTetgen/);
    expect(src).toMatch(/meshSettings\.tetgenRadiusEdgeRatio/);
  });

  test('fea-viewer.js TetGen seçeneklerini meshOpts üzerinden geçiriyor', () => {
    const src = fs.readFileSync(path.join(ROOT, 'js/fea-viewer.js'), 'utf8');
    expect(src).toMatch(/useTetgen:\s*settings\.useTetgen/);
    expect(src).toMatch(/tetgenRadiusEdgeRatio:\s*settings\.tetgenRadiusEdgeRatio/);
    // Cached _parsedTriangles olsa bile TetGen ister async path
    expect(src).toMatch(/tetgenWanted/);
  });
});

// ────────────────────────────────────────────────────────────────────────────
describe('build.js + index.html entegrasyonu', () => {
  test('index.html TetGen INLINE_FILE placeholder\'ları içeriyor', () => {
    const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
    expect(html).toMatch(/INLINE_FILE:\s*vendor\/tetgen\/tetgen-wasm\.js\s+as\s+tetgenScript/);
    expect(html).toMatch(/INLINE_FILE:\s*vendor\/tetgen\/tetgen-wasm\.wasm\s+as\s+tetgenWasm/);
  });

  test('index.html fea-tetgen.js script tag\'i içeriyor', () => {
    const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
    expect(html).toMatch(/src="js\/fea-tetgen\.js"/);
  });

  test('fea-mesh-worker.js fea-tetgen.js import ediyor', () => {
    const src = fs.readFileSync(path.join(ROOT, 'js/fea-mesh-worker.js'), 'utf8');
    expect(src).toMatch(/fea-tetgen\.js/);
  });
});
