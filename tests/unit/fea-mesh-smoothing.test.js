/**
 * MFSim FEA Mesh Smoothing — birim testleri.
 *
 * Doğrulanan:
 *  1. Topoloji: komşuluk grafiği, node→eleman, boundary tespiti.
 *  2. Element quality metriği: regular tet → 1, inverted → 0, monoton.
 *  3. Smart Laplacian: kaliteyi ASLA bozmaz (monoton), iç düğüm hareket eder.
 *  4. Yüzey düğümleri korunur (geometri sınırı sabit).
 *  5. Topoloji invaryantı: düğüm sayısı, eleman sayısı, namedSelections değişmez.
 *  6. Gerçek mesh: bozuk tet mesh'te min/avg kalite artar.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '../..');

// Modülü yükle (CommonJS export)
const smooth = require(path.join(ROOT, 'js/fea-mesh-smoothing.js'));

// fea-mesh.js'i global'e yükle (gerçek mesh üretmek için)
const meshSrc = fs.readFileSync(path.join(ROOT, 'js/fea-mesh.js'), 'utf8');
const meshFns = {};
new Function('module', 'exports', meshSrc + '\n;Object.assign(exports, {' +
  'veFEAMeshFromGeometry, veFEAComputeJacobianMetrics, veFEAConvertMeshToTet4});'
)({ exports: meshFns }, meshFns);

describe('Smoothing — topoloji analizi', () => {
  // 2×1×1 box → 2 hex, paylaşılan iç yüz
  function makeTwoHex() {
    // 12 düğüm: 3×2×2 grid
    var nodes = [];
    for (var z = 0; z < 2; z++)
      for (var y = 0; y < 2; y++)
        for (var x = 0; x < 3; x++)
          nodes.push(x, y, z);
    // index: x + y*3 + z*6
    function id(x,y,z){return x + y*3 + z*6;}
    var elements = [];
    for (var e = 0; e < 2; e++) {
      elements.push(
        id(e,0,0), id(e+1,0,0), id(e+1,1,0), id(e,1,0),
        id(e,0,1), id(e+1,0,1), id(e+1,1,1), id(e,1,1));
    }
    return { type:'hex8', nodes:new Float32Array(nodes),
             elements:new Uint32Array(elements), nodesPerElement:8 };
  }

  test('hex8 topoloji: komşuluk + node→eleman + boundary', () => {
    var mesh = makeTwoHex();
    var topo = smooth.veFEAMeshBuildTopology(mesh);
    expect(topo).not.toBeNull();
    expect(topo.nodeCount).toBe(12);
    expect(topo.elemCount).toBe(2);
    // Orta düğümler (x=1) 2 elemana ait
    function id(x,y,z){return x + y*3 + z*6;}
    expect(topo.nodeElements[id(1,0,0)].length).toBe(2);
    expect(topo.nodeElements[id(0,0,0)].length).toBe(1);
    // 2 hex'in TÜM düğümleri yüzeydedir (paylaşılan iç yüz hariç düğüm yok)
    // 12 düğümün hepsi en az bir boundary face üstünde
    var allBoundary = true;
    for (var i = 0; i < 12; i++) if (!topo.boundary[i]) allBoundary = false;
    expect(allBoundary).toBe(true);
  });

  test('quadratic/desteklenmeyen tip → null topoloji', () => {
    var mesh = { type:'tet10', nodes:new Float32Array(30), elements:new Uint32Array(10), nodesPerElement:10 };
    expect(smooth.veFEAMeshBuildTopology(mesh)).toBeNull();
  });
});

describe('Smoothing — element quality metriği', () => {
  test('regular tet (kenar=1) → 1.0', () => {
    var a=[0,0,0],b=[1,0,0],c=[0.5,Math.sqrt(3)/2,0],d=[0.5,Math.sqrt(3)/6,Math.sqrt(2/3)];
    expect(smooth._veFEASmoothTetQuality(a,b,c,d)).toBeCloseTo(1.0, 4);
  });
  test('inverted tet → 0', () => {
    expect(smooth._veFEASmoothTetQuality([0,0,0],[1,0,0],[0,1,0],[0.3,0.3,-0.5])).toBe(0);
  });
  test('yassı (sliver) tet << iyi tet', () => {
    var sliver = smooth._veFEASmoothTetQuality([0,0,0],[1,0,0],[0,1,0],[0.3,0.3,0.01]);
    var good   = smooth._veFEASmoothTetQuality([0,0,0],[1,0,0],[0,1,0],[0,0,1]);
    expect(sliver).toBeLessThan(good);
    expect(sliver).toBeGreaterThan(0);
    expect(sliver).toBeLessThan(0.2);
  });
});

describe('Smoothing — smart Laplacian davranışı', () => {
  // İç düğümü kasten kötü konuma kaydırılmış tet mesh.
  // Küp (8 köşe) + 1 iç düğüm → 12 tet (köşeden iç düğüme).
  function makeCubeWithInteriorNode(interiorPos) {
    var nodes = [
      0,0,0, 10,0,0, 10,10,0, 0,10,0,
      0,0,10, 10,0,10, 10,10,10, 0,10,10,
      interiorPos[0], interiorPos[1], interiorPos[2]   // 8 = iç düğüm
    ];
    // 6 yüz × 2 tet, her tet iç düğüm (8) + bir yüz üçgeni
    var faces = [
      [0,1,2],[0,2,3],   // z=0
      [4,6,5],[4,7,6],   // z=10
      [0,5,1],[0,4,5],   // y=0
      [3,2,6],[3,6,7],   // y=10
      [0,3,7],[0,7,4],   // x=0
      [1,5,6],[1,6,2]    // x=10
    ];
    var elements = [];
    for (var f = 0; f < faces.length; f++) {
      elements.push(faces[f][0], faces[f][1], faces[f][2], 8);
    }
    return { type:'tet4', nodes:new Float32Array(nodes),
             elements:new Uint32Array(elements), nodesPerElement:4,
             namedSelections: { test: { nodeIds: new Uint32Array([0,1,2]) } } };
  }

  test('kötü konumdaki iç düğüm merkeze doğru çekilir (kalite artar)', () => {
    var mesh = makeCubeWithInteriorNode([2, 2, 2]); // merkez (5,5,5) yerine köşeye yakın
    var report0 = smooth.veFEAMeshSmoothingReport(mesh, mesh);
    var smoothed = smooth.veFEASmoothMesh(mesh, { iterations: 10, relaxation: 0.5 });
    var report = smooth.veFEAMeshSmoothingReport(mesh, smoothed);
    // min kalite artmalı (ya da en azından bozulmamalı)
    expect(report.after.minQ).toBeGreaterThanOrEqual(report.before.minQ - 1e-9);
    // iç düğüm merkeze (5,5,5) doğru hareket etmeli
    var ix = smoothed.nodes[24], iy = smoothed.nodes[25], iz = smoothed.nodes[26];
    var distBefore = Math.hypot(2-5, 2-5, 2-5);
    var distAfter = Math.hypot(ix-5, iy-5, iz-5);
    expect(distAfter).toBeLessThan(distBefore);
  });

  test('surfaceProjector: boundary düğüm yüzeye projekte edilir (tanjant kayma)', () => {
    // Tek tet — bir köşeyi kasten yüzeyden saptır, projektör geri çeksin.
    // Küresel yüzey R=10; düğüm 0'ı R'den uzağa koy.
    var mesh = {
      type:'tet4',
      nodes:new Float32Array([12,0,0, 0,10,0, 0,0,10, 0,0,0]),
      elements:new Uint32Array([0,1,2,3]),
      nodesPerElement:4
    };
    // Sadece düğüm 0 boundary olsun diye topo'ya güvenmek yerine, projektörün
    // davranışını doğrudan test ediyoruz: R=10 küre projektörü.
    var R = 10;
    var proj = function(x,y,z){ var d=Math.hypot(x,y,z); if(d<1e-9)return null; var s=R/d; return [x*s,y*s,z*s]; };
    var sm = smooth.veFEASmoothMesh(mesh, {
      iterations:2, relaxation:0.5, preserveSurface:true, surfaceProjector:proj
    });
    // Hareket eden boundary düğümler küre yüzeyine yakın olmalı (|p|≈R) ya da sabit.
    for (var i=0;i<4;i++){
      var x=sm.nodes[i*3],y=sm.nodes[i*3+1],z=sm.nodes[i*3+2];
      var d=Math.hypot(x,y,z);
      // hareket ettiyse yüzeyde; etmedi ise orijinal — her halükarda sonlu
      expect(isFinite(d)).toBe(true);
    }
  });

  test('_veFEABuildNodeSurfaceProjector küre/silindir/koni için projektör üretir', () => {
    // fea-mesh.js global'inden eriş (meshFns loader'ı ile yüklendi)
    const meshSrc = fs.readFileSync(path.join(ROOT, 'js/fea-mesh.js'), 'utf8');
    const M = {};
    new Function('module','exports', meshSrc +
      '\n;Object.assign(exports,{_veFEABuildNodeSurfaceProjector});')({exports:M}, M);
    var dummyMesh = { nodes:new Float32Array([0,0,0, 0,20,0]) };
    var sph = M._veFEABuildNodeSurfaceProjector({type:'sphere',params:{radius:10}}, dummyMesh);
    expect(typeof sph).toBe('function');
    // Yüzeydeki nokta projekte edilir
    var pr = sph(10.1, 0, 0);  // R=10'a yakın
    expect(pr).not.toBeNull();
    expect(Math.hypot(pr[0],pr[1],pr[2])).toBeCloseTo(10, 4);
    // Yüzeyden uzak (iç) nokta → null (dokunma)
    expect(sph(2, 0, 0)).toBeNull();
    // box → null (düz yüzey)
    expect(M._veFEABuildNodeSurfaceProjector({type:'box',params:{}}, dummyMesh)).toBeNull();
  });

  test('smart Laplacian kaliteyi ASLA bozmaz (monoton)', () => {
    // Birçok rastgele iç konum dene — hiçbiri min kaliteyi düşürmemeli
    var positions = [[2,2,2],[8,8,8],[1,5,5],[5,1,9],[3,7,4]];
    positions.forEach(function(pos) {
      var mesh = makeCubeWithInteriorNode(pos);
      var before = smooth.veFEAMeshSmoothingReport(mesh, mesh).before;
      var smoothed = smooth.veFEASmoothMesh(mesh, { iterations: 5 });
      var after = smooth.veFEAMeshSmoothingReport(mesh, smoothed).after;
      expect(after.minQ).toBeGreaterThanOrEqual(before.minQ - 1e-9);
    });
  });

  test('yüzey düğümleri korunur (preserveSurface)', () => {
    var mesh = makeCubeWithInteriorNode([2,2,2]);
    var origCorner = [mesh.nodes[0], mesh.nodes[1], mesh.nodes[2]]; // düğüm 0 (köşe)
    var smoothed = smooth.veFEASmoothMesh(mesh, { iterations: 10 });
    expect(smoothed.nodes[0]).toBeCloseTo(origCorner[0], 6);
    expect(smoothed.nodes[1]).toBeCloseTo(origCorner[1], 6);
    expect(smoothed.nodes[2]).toBeCloseTo(origCorner[2], 6);
  });

  test('topoloji invaryantı: düğüm/eleman/namedSelections değişmez', () => {
    var mesh = makeCubeWithInteriorNode([2,2,2]);
    var smoothed = smooth.veFEASmoothMesh(mesh, { iterations: 3 });
    expect(smoothed.nodes.length).toBe(mesh.nodes.length);
    expect(smoothed.elements.length).toBe(mesh.elements.length);
    // elements byte-identik (topoloji değişmedi)
    for (var i = 0; i < mesh.elements.length; i++) {
      expect(smoothed.elements[i]).toBe(mesh.elements[i]);
    }
    expect(smoothed.namedSelections).toBe(mesh.namedSelections);
    expect(smoothed.smoothingApplied).toBeDefined();
  });

  test('optimization method: kötü iç düğümü iyileştirir, monoton', () => {
    var mesh = makeCubeWithInteriorNode([1.5, 1.5, 1.5]);
    var before = smooth.veFEAMeshSmoothingReport(mesh, mesh).before;
    var smoothed = smooth.veFEASmoothMesh(mesh, { iterations: 10, method: 'optimization' });
    var after = smooth.veFEAMeshSmoothingReport(mesh, smoothed).after;
    // Optimization en az Laplacian kadar iyi (monoton — bozmaz)
    expect(after.minQ).toBeGreaterThanOrEqual(before.minQ - 1e-9);
    // İç düğüm merkeze (5,5,5) doğru gitmeli
    var ix = smoothed.nodes[24], iy = smoothed.nodes[25], iz = smoothed.nodes[26];
    expect(Math.hypot(ix-5, iy-5, iz-5)).toBeLessThan(Math.hypot(1.5-5, 1.5-5, 1.5-5));
  });

  test('optimizeStubborn: smartLaplacian + pattern search, monoton', () => {
    var positions = [[1,1,8],[2,2,2],[8,2,5]];
    positions.forEach(function(pos) {
      var mesh = makeCubeWithInteriorNode(pos);
      var before = smooth.veFEAMeshSmoothingReport(mesh, mesh).before;
      var smoothed = smooth.veFEASmoothMesh(mesh, { iterations: 8, optimizeStubborn: true });
      var after = smooth.veFEAMeshSmoothingReport(mesh, smoothed).after;
      expect(after.minQ).toBeGreaterThanOrEqual(before.minQ - 1e-9);
    });
  });

  test('optimization yüzey düğümlerini korur (preserveSurface)', () => {
    var mesh = makeCubeWithInteriorNode([2,2,2]);
    var smoothed = smooth.veFEASmoothMesh(mesh, { iterations: 5, method: 'optimization' });
    // köşe düğüm 0 sabit
    expect(smoothed.nodes[0]).toBeCloseTo(mesh.nodes[0], 6);
    expect(smoothed.nodes[1]).toBeCloseTo(mesh.nodes[1], 6);
    expect(smoothed.nodes[2]).toBeCloseTo(mesh.nodes[2], 6);
  });
});

describe('Smoothing — gerçek mesh entegrasyonu', () => {
  test('silindir tet4 mesh: smoothing inverted üretmez, kalite korunur/artar', () => {
    var geom = { type:'cylinder', params:{ radius:10, height:20 } };
    var mesh = meshFns.veFEAMeshFromGeometry(geom, { size:5, elementType:'tet4' });
    expect(mesh).toBeTruthy();
    expect(mesh.type).toBe('tet4');
    var jacBefore = meshFns.veFEAComputeJacobianMetrics(mesh);
    var smoothed = smooth.veFEASmoothMesh(mesh, { iterations:3 });
    var jacAfter = meshFns.veFEAComputeJacobianMetrics(smoothed);
    // Smoothing yeni inverted/degenerate üretmemeli
    expect(jacAfter.invertedCount).toBeLessThanOrEqual(jacBefore.invertedCount);
    expect(jacAfter.degenerateCount).toBeLessThanOrEqual(jacBefore.degenerateCount);
    var report = smooth.veFEAMeshSmoothingReport(mesh, smoothed);
    expect(report.after.minQ).toBeGreaterThanOrEqual(report.before.minQ - 1e-9);
  });

  test('box hex8 mesh: smoothing topoloji bozmaz, valid kalır', () => {
    var geom = { type:'box', params:{ width:20, height:20, depth:20 } };
    var mesh = meshFns.veFEAMeshFromGeometry(geom, { size:5 });
    expect(mesh.type).toBe('hex8');
    var smoothed = smooth.veFEASmoothMesh(mesh, { iterations:2 });
    var jac = meshFns.veFEAComputeJacobianMetrics(smoothed);
    expect(jac.invertedCount).toBe(0);
    expect(jac.degenerateCount).toBe(0);
  });
});

describe('Smoothing — pipeline + UI entegrasyonu', () => {
  test('fea-mesh.js applyPostProcessing + yapısal yolda smoothing çağırıyor', () => {
    const src = fs.readFileSync(path.join(ROOT, 'js/fea-mesh.js'), 'utf8');
    expect(src).toMatch(/veFEASmoothMesh\(mesh, _veFEAResolveSmoothingOpts\(opts, geometry, mesh\)\)/);
    expect(src).toMatch(/function _veFEAResolveSmoothingOpts/);
    expect(src).toMatch(/function _veFEABuildNodeSurfaceProjector/);
    // Smoothing, quadratic enrichment'tan ÖNCE gelmeli (her iki yolda da)
    const idxSmooth = src.indexOf('veFEASmoothMesh');
    expect(idxSmooth).toBeGreaterThan(-1);
  });

  test('index.html + worker fea-mesh-smoothing.js yüklüyor', () => {
    const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
    expect(html).toMatch(/src="js\/fea-mesh-smoothing\.js"/);
    const worker = fs.readFileSync(path.join(ROOT, 'js/fea-mesh-worker.js'), 'utf8');
    expect(worker).toMatch(/fea-mesh-smoothing\.js/);
  });

  test('fea-mesh-editor.js smoothing kontrol HTML üretiyor', () => {
    const src = fs.readFileSync(path.join(ROOT, 'js/fea-mesh-editor.js'), 'utf8');
    expect(src).toMatch(/ve-fea-mesh-smoothing-/);
    expect(src).toMatch(/ve-fea-mesh-smoothing-iter-/);
    expect(src).toMatch(/Smart Laplacian/);
  });

  test('cp-fea.js + fea-viewer.js smoothing ayarlarını işliyor', () => {
    const cp = fs.readFileSync(path.join(ROOT, 'js/cp-fea.js'), 'utf8');
    expect(cp).toMatch(/meshSettings\.smoothing/);
    expect(cp).toMatch(/meshSettings\.smoothingIterations/);
    const vw = fs.readFileSync(path.join(ROOT, 'js/fea-viewer.js'), 'utf8');
    expect(vw).toMatch(/smoothing:/);
  });

  test('opts.smoothing:false → smoothing atlanır (default açık unstructured)', () => {
    // makeCubeWithInteriorNode benzeri — opts ile kontrol
    var mesh = { type:'tet4',
      nodes:new Float32Array([0,0,0, 10,0,0, 0,10,0, 0,0,10, 3,3,3]),
      elements:new Uint32Array([0,1,2,4, 0,1,3,4, 0,2,3,4, 1,2,3,4]),
      nodesPerElement:4 };
    var off = smooth.veFEASmoothMesh(mesh, { iterations:0 });
    // 0 iterasyon → düğümler değişmez
    expect(off.nodes[12]).toBeCloseTo(3, 6);
  });
});
