/**
 * FEA 3D Viewer — CATIA / 3DEXPERIENCE-stili fare navigasyonu (FONKSİYONEL)
 *
 * Diğer viewer testleri JSDOM'da WebGL olmadığı için kaynak-pattern kontrolü
 * yapar. Burada GERÇEK Three.js (three@0.149) yüklenip `veFEAAttachOrbitControls`
 * doğrudan sentetik MouseEvent'lerle sürülür — state machine davranışı uçtan uca
 * doğrulanır:
 *   MMB sürükle ................... pan (target ötelenir)
 *   MMB + LMB (basılı tut) ........ rotate (kamera döner, target sabit)
 *   MMB + LMB (tıkla-bırak) dikey .. zoom (yukarı=yakın, aşağı=uzak)
 *   MMB tek tık (tap) ............. rotasyon merkezi atanır
 *   tekerlek ...................... zoom
 *   LMB tek başına ................ orbit handle'ı tetiklemez (seçim için)
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '../..');

// Gerçek Three.js — orbit handle veFEAHasThree() ile window.THREE'yi arar.
window.THREE = require('three');

// fea-viewer.js tek başına eval edilebilir (top-level yalnız var/function bind).
eval(fs.readFileSync(path.join(ROOT, 'js/fea-viewer.js'), 'utf8'));

function makeMouse(type, opts) {
  return new window.MouseEvent(type, Object.assign({ bubbles: true, cancelable: true }, opts));
}

describe('veFEAAttachOrbitControls — CATIA navigasyon state machine', () => {
  let canvas, camera, target, handle, renderCount, mockViewer;

  beforeEach(() => {
    canvas = document.createElement('canvas');
    document.body.appendChild(canvas);
    camera = new window.THREE.PerspectiveCamera(50, 1, 0.1, 5000);
    camera.position.set(0, 0, 100);          // target'tan 100 birim uzakta
    camera.up.set(0, 1, 0);
    target = new window.THREE.Vector3(0, 0, 0);
    renderCount = 0;
    handle = veFEAAttachOrbitControls(canvas, camera, target, function () { renderCount++; });
    mockViewer = {
      pickPointFromMouse: jest.fn(function () { return new window.THREE.Vector3(5, 5, 5); }),
      setRotationCenterAt: jest.fn()
    };
    handle.setViewerRef(mockViewer);
  });

  afterEach(() => {
    handle.dispose();                         // window mousemove/up dinleyicilerini bırak
    if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
  });

  const md = (button, x, y) => canvas.dispatchEvent(makeMouse('mousedown', { button: button, clientX: x, clientY: y }));
  const mm = (x, y) => window.dispatchEvent(makeMouse('mousemove', { clientX: x, clientY: y }));
  const mu = (button, x, y) => window.dispatchEvent(makeMouse('mouseup', { button: button, clientX: x, clientY: y }));

  test('MMB sürükle → pan (target ötelenir)', () => {
    md(1, 100, 100);
    mm(140, 100);                             // 40px sağa
    mu(1, 140, 100);
    expect(Math.abs(target.x)).toBeGreaterThan(0.5);
    expect(renderCount).toBeGreaterThan(0);
    expect(mockViewer.setRotationCenterAt).not.toHaveBeenCalled(); // hareket vardı → tap değil
  });

  test('MMB + LMB (basılı tut) + sürükle → rotate (kamera döner, target sabit)', () => {
    const camBefore = camera.position.clone();
    md(1, 100, 100);
    md(0, 100, 100);                          // MMB basılıyken LMB → combo
    expect(mockViewer._navLmbCombo).toBe(true); // face-select bastırma bayrağı set
    mm(160, 120);                             // döndür
    mu(0, 160, 120);
    mu(1, 160, 120);
    expect(camera.position.distanceTo(camBefore)).toBeGreaterThan(1); // kamera açısı değişti
    expect(target.length()).toBeCloseTo(0, 5);  // rotate target'ı taşımaz (pan değil)
  });

  test('MMB + LMB (tıkla-bırak) + yukarı sürükle → zoom IN', () => {
    md(1, 100, 100);
    md(0, 100, 100);
    mu(0, 101, 101);                          // <4px → tıklama → zoom moduna geç
    const distBefore = camera.position.distanceTo(target);
    mm(101, 50);                              // yukarı (dy<0) → yakınlaş
    const distAfter = camera.position.distanceTo(target);
    mu(1, 101, 50);
    expect(distAfter).toBeLessThan(distBefore);
  });

  test('MMB + LMB (tıkla-bırak) + aşağı sürükle → zoom OUT', () => {
    md(1, 100, 100);
    md(0, 100, 100);
    mu(0, 100, 100);                          // tam 0px → kesin tıklama → zoom
    const distBefore = camera.position.distanceTo(target);
    mm(100, 160);                             // aşağı (dy>0) → uzaklaş
    const distAfter = camera.position.distanceTo(target);
    mu(1, 100, 160);
    expect(distAfter).toBeGreaterThan(distBefore);
  });

  test('Tekerlek → zoom (deltaY>0 uzaklaşır)', () => {
    const distBefore = camera.position.distanceTo(target);
    canvas.dispatchEvent(new window.WheelEvent('wheel', { deltaY: 120, cancelable: true, bubbles: true }));
    expect(camera.position.distanceTo(target)).toBeGreaterThan(distBefore);
  });

  test('MMB tek tık (tap, hareketsiz) → rotasyon merkezi atanır', () => {
    md(1, 100, 100);
    mu(1, 101, 101);                          // <3px, combo yok → tap
    expect(mockViewer.pickPointFromMouse).toHaveBeenCalled();
    expect(mockViewer.setRotationCenterAt).toHaveBeenCalledTimes(1);
  });

  test('rotate sonrası MMB bırakması rotasyon merkezi ATAMAZ (combo + hareket)', () => {
    md(1, 100, 100);
    md(0, 100, 100);
    mm(160, 120);                             // rotate
    mu(0, 160, 120);
    mu(1, 160, 120);
    expect(mockViewer.setRotationCenterAt).not.toHaveBeenCalled();
  });

  test('LMB tek başına (MMB basılı değil) orbit handle\'ı tetiklemez', () => {
    const camBefore = camera.position.clone();
    md(0, 100, 100);                          // LMB alone → orbit dokunmaz (seçim için)
    mm(160, 120);
    mu(0, 160, 120);
    expect(camera.position.distanceTo(camBefore)).toBeCloseTo(0, 5);
    expect(target.length()).toBeCloseTo(0, 5);
  });

  test('RMB sürükle → pan (kolaylık yolu)', () => {
    md(2, 100, 100);
    mm(140, 100);
    mu(2, 140, 100);
    expect(Math.abs(target.x)).toBeGreaterThan(0.5);
  });
});

describe('Ortografik kamera zoom — zoomByFactor frustum yolu', () => {
  test('tekerlek ortografik frustum boyutunu küçültür (zoom in)', () => {
    const canvas = document.createElement('canvas');
    document.body.appendChild(canvas);
    const ortho = new window.THREE.OrthographicCamera(-50, 50, 50, -50, 0.1, 5000);
    ortho.position.set(0, 0, 100);
    const target = new window.THREE.Vector3(0, 0, 0);
    const handle = veFEAAttachOrbitControls(canvas, ortho, target, function () {});
    const rightBefore = ortho.right;
    canvas.dispatchEvent(new window.WheelEvent('wheel', { deltaY: -120, cancelable: true, bubbles: true }));
    expect(ortho.right).toBeLessThan(rightBefore);  // frustum küçüldü → zoom in
    handle.dispose();
    if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
  });
});
