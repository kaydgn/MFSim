/**
 * FEA 3D Viewer birim testleri (Faz 2 - vendor altyapısı)
 * - vendor/three.min.js dosyasının varlığı ve UMD imzası
 * - index.html'de Three.js + fea-viewer.js + cp-fea.js sırasının doğruluğu
 * - js/fea-viewer.js API kontrolü: graceful degradation, dispose, modal yönetimi
 * - cp-fea.js getFEAGeometryPropertiesHTML: canvas + tam ekran butonu
 *
 * JSDOM WebGL'i desteklemez; gerçek Three.js sahnesi kurmuyoruz, sadece
 * fonksiyon kontratlarını ve fallback davranışını doğruluyoruz.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '../..');

// Top-level: kodları yükle — var/function declarations bu dosyanın scope'una bind olur
const viewerCode = fs.readFileSync(path.join(ROOT, 'js/fea-viewer.js'), 'utf8');
const componentsCode = fs.readFileSync(path.join(ROOT, 'js/components.js'), 'utf8');
const cpFeaCode = fs.readFileSync(path.join(ROOT, 'js/cp-fea.js'), 'utf8');

eval(viewerCode);
eval(componentsCode);
eval(cpFeaCode);

// ────────────────────────────────────────────────────────────────────────────
describe('vendor/three.min.js', () => {
  const vendorPath = path.join(ROOT, 'vendor/three.min.js');

  test('dosya mevcut ve makul boyutta', () => {
    expect(fs.existsSync(vendorPath)).toBe(true);
    const stats = fs.statSync(vendorPath);
    // Three.js 0.149 UMD ~600 KB; en az 100 KB olmalı (rakam sürpriz değişimde uyarı verir)
    expect(stats.size).toBeGreaterThan(100 * 1024);
  });

  test('UMD bundle imzasını içerir (typeof exports / typeof define)', () => {
    const content = fs.readFileSync(vendorPath, 'utf8');
    expect(content).toMatch(/typeof exports/);
    expect(content).toMatch(/typeof define/);
  });

  test('Three.js telif notu (license header) korunmuş', () => {
    const head = fs.readFileSync(vendorPath, 'utf8').slice(0, 500);
    expect(head).toMatch(/three\.?js/i);
  });
});

// ────────────────────────────────────────────────────────────────────────────
describe('index.html script sırası', () => {
  const indexPath = path.join(ROOT, 'index.html');
  const html = fs.readFileSync(indexPath, 'utf8');

  // NOT: Modüller MFSim Loader tarafindan login sonrasi yuklenir; tag'lerde
  // `type="text/x-mfsim-defer"` ve `data-mfsim-label` ek attribute'lari var.
  test('vendor/three.min.js script tag bulunur', () => {
    expect(html).toMatch(/<script\b[^>]*\bsrc="vendor\/three\.min\.js"[^>]*><\/script>/);
  });

  test('js/fea-viewer.js script tag bulunur', () => {
    expect(html).toMatch(/<script\b[^>]*\bsrc="js\/fea-viewer\.js"[^>]*><\/script>/);
  });

  test("sıra: three.min.js → fea-viewer.js → cp-fea.js (üçü de bu yönde)", () => {
    const threeIdx = html.indexOf('vendor/three.min.js');
    const viewerIdx = html.indexOf('js/fea-viewer.js');
    const cpFeaIdx = html.indexOf('js/cp-fea.js');
    expect(threeIdx).toBeGreaterThan(-1);
    expect(viewerIdx).toBeGreaterThan(-1);
    expect(cpFeaIdx).toBeGreaterThan(-1);
    expect(threeIdx).toBeLessThan(viewerIdx);
    expect(viewerIdx).toBeLessThan(cpFeaIdx);
  });
});

// ────────────────────────────────────────────────────────────────────────────
describe('build.js vendor desteği', () => {
  const buildSrc = fs.readFileSync(path.join(ROOT, 'build.js'), 'utf8');

  test("vendor/ pattern'i için ayrı bir replace bloğu içerir", () => {
    expect(buildSrc).toMatch(/vendor\\\/\[\^"\]\+/);
  });

  test('vendor dosya bulunmadığında "vendor:sync" ipucu verir', () => {
    expect(buildSrc).toMatch(/vendor:sync/);
  });
});

// ────────────────────────────────────────────────────────────────────────────
describe('package.json vendor-sync', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));

  test("scripts['vendor:sync'] tanımlı (script dosyasına yönlendirir)", () => {
    expect(pkg.scripts['vendor:sync']).toBeDefined();
    expect(pkg.scripts['vendor:sync']).toMatch(/sync-vendor\.js/);
    // scripts/sync-vendor.js içinde three.min.js geçmeli
    const syncSrc = fs.readFileSync(path.join(ROOT, 'scripts/sync-vendor.js'), 'utf8');
    expect(syncSrc).toMatch(/three\.min\.js/);
  });

  test('scripts.postinstall vendor:sync komutunu çalıştırır', () => {
    expect(pkg.scripts.postinstall).toBeDefined();
    expect(pkg.scripts.postinstall).toMatch(/vendor:sync/);
  });

  test('dependencies.three tanımlı (0.149)', () => {
    expect(pkg.dependencies && pkg.dependencies.three).toBeDefined();
    expect(pkg.dependencies.three).toMatch(/0\.149/);
  });
});

// ────────────────────────────────────────────────────────────────────────────
describe('js/fea-viewer.js API', () => {
  beforeEach(() => {
    // Açık fullscreen overlay'i sıfırla (artık <html>'in altında, body
    // innerHTML temizliği yetmez — registry üzerinden dispose et)
    if (typeof veFEACloseFullscreenViewer === 'function') veFEACloseFullscreenViewer();
    // <html>'in altında kalan overlay artıklarını sil
    var leftover = document.getElementById('ve-fea-fullscreen-overlay');
    if (leftover && leftover.parentNode) leftover.parentNode.removeChild(leftover);
    // DOM temizle
    document.body.innerHTML = '';
    // Three.js global'i kalmasın (graceful fallback testleri için)
    if(typeof window !== 'undefined') delete window.THREE;
    if(typeof global !== 'undefined') delete global.THREE;
    // Registry'yi sıfırla
    Object.keys(veFEAViewerRegistry).forEach((k) => delete veFEAViewerRegistry[k]);
  });

  test('public API fonksiyonları tanımlı', () => {
    expect(typeof veFEAHasThree).toBe('function');
    expect(typeof veFEAInitViewer).toBe('function');
    expect(typeof veFEAInitGeometryViewerForNode).toBe('function');
    expect(typeof veFEAOpenFullscreenViewer).toBe('function');
    expect(typeof veFEACloseFullscreenViewer).toBe('function');
  });

  test('veFEAHasThree: window.THREE yokken false döner', () => {
    expect(veFEAHasThree()).toBe(false);
  });

  test('veFEAInitViewer: Three.js yokken null döner ve hata fırlatmaz', () => {
    const canvas = document.createElement('canvas');
    let result;
    expect(() => { result = veFEAInitViewer(canvas, { width: 200, height: 150 }); }).not.toThrow();
    expect(result).toBeNull();
  });

  test('veFEAInitViewer: canvas null ise null döner', () => {
    expect(veFEAInitViewer(null)).toBeNull();
  });

  test('veFEAInitGeometryViewerForNode: canvas yoksa sessiz çıkar', () => {
    expect(() => veFEAInitGeometryViewerForNode('nonexistent-id')).not.toThrow();
  });

  test('veFEAInitGeometryViewerForNode: Three.js yokken hata atmaz', () => {
    document.body.innerHTML = '<canvas id="ve-fea-geom-canvas-test1" width="240" height="180"></canvas>';
    expect(() => veFEAInitGeometryViewerForNode('test1')).not.toThrow();
  });

  test('veFEAOpenFullscreenViewer: overlay DOM e eklenir', () => {
    veFEAOpenFullscreenViewer('test-node');
    const overlay = document.getElementById('ve-fea-fullscreen-overlay');
    expect(overlay).not.toBeNull();
    expect(overlay.style.position).toBe('fixed');
    const closeBtn = document.getElementById('ve-fea-fullscreen-close');
    expect(closeBtn).not.toBeNull();
  });

  test('veFEACloseFullscreenViewer: overlay DOM dan kaldırılır', () => {
    veFEAOpenFullscreenViewer('test-node');
    expect(document.getElementById('ve-fea-fullscreen-overlay')).not.toBeNull();
    veFEACloseFullscreenViewer();
    expect(document.getElementById('ve-fea-fullscreen-overlay')).toBeNull();
  });

  test('veFEAOpenFullscreenViewer: ikinci çağrı tek overlay bırakır (eskiyi temizler)', () => {
    veFEAOpenFullscreenViewer('a');
    veFEAOpenFullscreenViewer('b');
    const overlays = document.querySelectorAll('#ve-fea-fullscreen-overlay');
    expect(overlays.length).toBe(1);
  });

  test('Esc tuşu fullscreen viewer ı kapatır', () => {
    veFEAOpenFullscreenViewer('test-node');
    const evt = new window.KeyboardEvent('keydown', { key: 'Escape' });
    document.dispatchEvent(evt);
    expect(document.getElementById('ve-fea-fullscreen-overlay')).toBeNull();
  });

  test('fullscreen overlay maksimum z-index ile <html> altına eklenir', () => {
    veFEAOpenFullscreenViewer('test-node');
    const overlay = document.getElementById('ve-fea-fullscreen-overlay');
    expect(overlay).not.toBeNull();
    // z-index inline style'da olmalı — değer max int32 (2147483647)
    expect(overlay.style.zIndex).toBe('2147483647');
    // documentElement (html) doğrudan çocuğu olmalı (body değil)
    expect(overlay.parentElement.tagName.toLowerCase()).toBe('html');
  });
});

// ────────────────────────────────────────────────────────────────────────────
describe('fea-viewer kaynak refaktör güvenceleri', () => {
  const viewerSrc = fs.readFileSync(path.join(ROOT, 'js/fea-viewer.js'), 'utf8');

  test('GridHelper hiç kullanılmıyor (ana sahnede de gizmo da yok)', () => {
    expect(viewerSrc).not.toMatch(/new\s+THREE\.GridHelper/);
  });

  test('Ana sahneye AxesHelper eklenmiyor (gizmo dışında kullanım yasak)', () => {
    // scene.add(new THREE.AxesHelper...) yasaktır. gizmoScene.add(...) izinli.
    expect(viewerSrc).not.toMatch(/\bscene\.add\s*\(\s*new\s+THREE\.AxesHelper/);
  });

  test('veFEAOpenFullscreenViewer node geometrisini viewer a yedirir', () => {
    // Fullscreen modal'da geometri yüklenmesi unutulmuştu — bu test
    // "büyüttüğümde geometriyi göremiyorum" hatasını regresyon olarak yakalar
    const start = viewerSrc.indexOf('function veFEAOpenFullscreenViewer');
    expect(start).toBeGreaterThan(-1);
    const end = viewerSrc.indexOf('\nfunction ', start + 1);
    const body = viewerSrc.substring(start, end > 0 ? end : viewerSrc.length);
    expect(body).toMatch(/_veFEALoadNodeGeometryIntoViewer\s*\(\s*viewer\s*,\s*nodeId/);
  });

  test('_veFEALoadNodeGeometryIntoViewer helper tanımlı ve preview tarafından çağrılır', () => {
    expect(viewerSrc).toMatch(/function _veFEALoadNodeGeometryIntoViewer/);
    // veFEAInitGeometryViewerForNode helper'ı çağırmalı (DRY)
    const initStart = viewerSrc.indexOf('function veFEAInitGeometryViewerForNode');
    const initEnd = viewerSrc.indexOf('\n}', initStart);
    const initBody = viewerSrc.substring(initStart, initEnd);
    expect(initBody).toMatch(/_veFEALoadNodeGeometryIntoViewer/);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// "Geometri + Mesh Çizgileri" (geom-mesh) modu birleşik 'fea' modülünde
// solid geometri yüzeyini çizmeli, yalnızca tel kafes (wireframe) değil.
// Regresyon: _veFEALoadNodeGeometryIntoViewer, mesh cache dolu olan 'fea'
// node'unda erkenden loadMesh (wireframe) çağırıp solid yüzeyi hiç çizmiyordu.
describe('geom-mesh modu solid geometri yüzeyi çizer (wireframe-only regresyonu)', () => {
  let calls, fakeViewer;
  beforeEach(() => {
    calls = { loadMesh: 0, loadPrimitive: [] };
    fakeViewer = {
      loadMesh: function () { calls.loadMesh++; },
      loadPrimitive: function (type, params) { calls.loadPrimitive.push({ type: type, params: params }); }
    };
    global.nodes = [{
      id: 'fea-1', type: 'fea',
      data: { geometry: { type: 'box', params: { x: 10, y: 10, z: 10 } } }
    }];
    // Mesh oluşturulmuş → cache dolu (regresyonun tetiklendiği durum)
    veFEAMeshCache['fea-1'] = { type: 'hex8', nodes: [0, 0, 0], elements: [], nodesPerElement: 8 };
  });
  afterEach(() => {
    delete global.nodes;
    delete veFEAMeshCache['fea-1'];
  });

  test('geometryOnly olmadan mesh wireframe yüklenir (geometri görüntüleyici davranışı korunur)', () => {
    _veFEALoadNodeGeometryIntoViewer(fakeViewer, 'fea-1');
    expect(calls.loadMesh).toBe(1);
    expect(calls.loadPrimitive.length).toBe(0);
  });

  test('geometryOnly:true ile solid geometri (loadPrimitive) yüklenir — wireframe değil', () => {
    _veFEALoadNodeGeometryIntoViewer(fakeViewer, 'fea-1', { geometryOnly: true });
    expect(calls.loadMesh).toBe(0);
    expect(calls.loadPrimitive.length).toBe(1);
    expect(calls.loadPrimitive[0].type).toBe('box');
  });

  test('loadMeshOverGeometry kaynağı geometryOnly:true geçirir', () => {
    expect(viewerCode).toMatch(/_veFEALoadNodeGeometryIntoViewer\s*\(\s*this\s*,\s*geomNodeId\s*,\s*\{\s*geometryOnly:\s*true/);
  });
});

// ────────────────────────────────────────────────────────────────────────────
describe('cp-fea.js getFEAGeometryPropertiesHTML', () => {
  // Faz 1: gömülü "3D Önizleme" canvas'ı kaldırıldı — birleşik modül
  // editöründe geometri sağdaki tam boy 3D görüntüleyicide gösteriliyor.
  test('HTML çıktısı artık gömülü geom canvas İÇERMEZ', () => {
    const node = { id: 'comp-42', data: {} };
    const html = getFEAGeometryPropertiesHTML(node);
    expect(html).not.toMatch(/<canvas[^>]*id="ve-fea-geom-canvas-comp-42"/);
  });

  test("HTML çıktısı gömülü 'Tam Ekran' önizleme butonunu İÇERMEZ", () => {
    const node = { id: 'comp-7', data: {} };
    const html = getFEAGeometryPropertiesHTML(node);
    expect(html).not.toMatch(/veFEAOpenFullscreenViewer\('comp-7'\)/);
  });

  test('geometri paneli sağ görüntüleyiciye yönlendirir', () => {
    const node = { id: 'comp-7', data: {} };
    const html = getFEAGeometryPropertiesHTML(node);
    expect(html).toMatch(/sağdaki 3D görüntüleyici/i);
  });

  test('Faz 2 badge bulunur', () => {
    const node = { id: 'x', data: {} };
    const html = getFEAGeometryPropertiesHTML(node);
    expect(html).toMatch(/Faz 2/);
  });
});
