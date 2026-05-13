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

  test('vendor/three.min.js script tag bulunur', () => {
    expect(html).toMatch(/<script\s+src="vendor\/three\.min\.js"><\/script>/);
  });

  test('js/fea-viewer.js script tag bulunur', () => {
    expect(html).toMatch(/<script\s+src="js\/fea-viewer\.js"><\/script>/);
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
});

// ────────────────────────────────────────────────────────────────────────────
describe('cp-fea.js getFEAGeometryPropertiesHTML', () => {
  test('HTML çıktısı canvas elementi içerir (node ID ile)', () => {
    const node = { id: 'comp-42', data: {} };
    const html = getFEAGeometryPropertiesHTML(node);
    expect(html).toMatch(/<canvas[^>]*id="ve-fea-geom-canvas-comp-42"/);
  });

  test("HTML çıktısı 'Tam Ekran' butonunu ve doğru callback'i içerir", () => {
    const node = { id: 'comp-7', data: {} };
    const html = getFEAGeometryPropertiesHTML(node);
    expect(html).toMatch(/veFEAOpenFullscreenViewer\('comp-7'\)/);
    expect(html).toMatch(/Tam Ekran/);
  });

  test('Faz 2 badge bulunur', () => {
    const node = { id: 'x', data: {} };
    const html = getFEAGeometryPropertiesHTML(node);
    expect(html).toMatch(/Faz 2/);
  });
});
