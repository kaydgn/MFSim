/**
 * FEA 3D Viewer — CAD özellikleri birim testleri (Faz 2e Grup A)
 *  - VE_FEA_STANDARD_VIEWS sözlüğü
 *  - viewer API tanımları: setStandardView, setProjection, fitToGeometry
 *  - Orbit controls: setCamera helper
 *  - Fullscreen toolbar: 7 standart görünüm butonu + Sığdır + Perspektif
 *  - Gizmo: opts.gizmo true ise gizmo scene kurulur
 *  - cp-fea.js: "Sığdır" butonu küçük preview'da render edilir
 *  - veFEAFitPreviewForNode köprüsü
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '../..');

eval(fs.readFileSync(path.join(ROOT, 'js/components.js'), 'utf8'));
eval(fs.readFileSync(path.join(ROOT, 'js/fea-primitives.js'), 'utf8'));
eval(fs.readFileSync(path.join(ROOT, 'js/fea-step.js'), 'utf8'));
eval(fs.readFileSync(path.join(ROOT, 'js/fea-step.js'), 'utf8'));
eval(fs.readFileSync(path.join(ROOT, 'js/fea-viewer.js'), 'utf8'));
eval(fs.readFileSync(path.join(ROOT, 'js/cp-fea.js'), 'utf8'));

// ────────────────────────────────────────────────────────────────────────────
describe('VE_FEA_STANDARD_VIEWS sözlüğü', () => {
  test('7 standart görünüm tanımlı', () => {
    expect(typeof VE_FEA_STANDARD_VIEWS).toBe('object');
    ['iso','top','bottom','front','back','right','left'].forEach((k) => {
      expect(VE_FEA_STANDARD_VIEWS[k]).toBeDefined();
      expect(Array.isArray(VE_FEA_STANDARD_VIEWS[k].dir)).toBe(true);
      expect(VE_FEA_STANDARD_VIEWS[k].dir.length).toBe(3);
      expect(Array.isArray(VE_FEA_STANDARD_VIEWS[k].up)).toBe(true);
      expect(VE_FEA_STANDARD_VIEWS[k].up.length).toBe(3);
    });
  });

  test('top/bottom için up vektörü Z ekseni (gimbal lock koruması)', () => {
    expect(VE_FEA_STANDARD_VIEWS.top.up).toEqual([0, 0, -1]);
    expect(VE_FEA_STANDARD_VIEWS.bottom.up).toEqual([0, 0, 1]);
  });

  test("front kameraya bakış yönü +Z, back -Z", () => {
    expect(VE_FEA_STANDARD_VIEWS.front.dir).toEqual([0, 0, 1]);
    expect(VE_FEA_STANDARD_VIEWS.back.dir).toEqual([0, 0, -1]);
  });

  test('ISO eşit X+Y+Z bileşeni', () => {
    expect(VE_FEA_STANDARD_VIEWS.iso.dir).toEqual([1, 1, 1]);
  });
});

// ────────────────────────────────────────────────────────────────────────────
describe('fea-viewer.js — API yüzeyi (kaynak kontrol)', () => {
  const src = fs.readFileSync(path.join(ROOT, 'js/fea-viewer.js'), 'utf8');

  test('viewer objesinde setStandardView metodu tanımlı', () => {
    expect(src).toMatch(/setStandardView:\s*function/);
  });

  test('viewer objesinde setProjection metodu tanımlı', () => {
    expect(src).toMatch(/setProjection:\s*function/);
  });

  test('viewer objesinde fitToGeometry metodu tanımlı', () => {
    expect(src).toMatch(/fitToGeometry:\s*function/);
  });

  test('viewer default projeksiyon: perspective', () => {
    expect(src).toMatch(/projection:\s*['"]perspective['"]/);
  });

  test('orbit controls setCamera ile kamera referansı değiştirilebilir', () => {
    expect(src).toMatch(/setCamera:\s*function\s*\(\s*newCam\s*\)/);
  });

  test('onWheel orthographic kamera için frustum boyutunu değiştirir', () => {
    expect(src).toMatch(/isOrthographicCamera/);
    // perspektif daldaki spherical.radius pattern'i de korunmalı
    expect(src).toMatch(/spherical\.radius\s*=/);
  });

  test('setProjection PerspectiveCamera ve OrthographicCamera oluşturur', () => {
    expect(src).toMatch(/new\s+THREE\.OrthographicCamera/);
    expect(src).toMatch(/new\s+THREE\.PerspectiveCamera/);
  });

  test('opts.gizmo true ise gizmoScene + gizmoCamera kurulur', () => {
    expect(src).toMatch(/opts\.gizmo/);
    expect(src).toMatch(/gizmoScene\s*=\s*new\s+THREE\.Scene/);
    expect(src).toMatch(/gizmoCamera\s*=\s*new\s+THREE\.PerspectiveCamera/);
  });

  test('render() viewport split ile gizmo overlay çizer', () => {
    expect(src).toMatch(/setViewport/);
    expect(src).toMatch(/setScissor/);
    expect(src).toMatch(/setScissorTest/);
    expect(src).toMatch(/clearDepth/);
  });

  test('veFEAOpenFullscreenViewer viewer init opsiyonunda gizmo:true geçirir', () => {
    const start = src.indexOf('function veFEAOpenFullscreenViewer');
    const end = src.indexOf('\nfunction ', start + 1);
    const body = src.substring(start, end > 0 ? end : src.length);
    expect(body).toMatch(/gizmo\s*:\s*true/);
  });

  test('veFEAFitPreviewForNode köprüsü tanımlı', () => {
    expect(typeof veFEAFitPreviewForNode).toBe('function');
  });
});

// ────────────────────────────────────────────────────────────────────────────
describe('Fullscreen toolbar render', () => {
  beforeEach(() => {
    // Olası açık overlay artıklarını sil
    if (typeof veFEACloseFullscreenViewer === 'function') veFEACloseFullscreenViewer();
    var leftover = document.getElementById('ve-fea-fullscreen-overlay');
    if (leftover && leftover.parentNode) leftover.parentNode.removeChild(leftover);
    document.body.innerHTML = '';
    if (typeof window !== 'undefined') delete window.THREE;
    Object.keys(veFEAViewerRegistry).forEach((k) => delete veFEAViewerRegistry[k]);
  });

  test('7 standart görünüm butonu render edilir', () => {
    veFEAOpenFullscreenViewer('test-cad');
    ['iso','top','bottom','front','back','right','left'].forEach((v) => {
      const btn = document.querySelector('button[data-view="' + v + '"]');
      expect(btn).not.toBeNull();
    });
  });

  test('Sığdır ve Perspektif/Ortografik butonları render edilir', () => {
    veFEAOpenFullscreenViewer('test-cad');
    expect(document.querySelector('button[data-action="fit"]')).not.toBeNull();
    const projBtn = document.querySelector('button[data-action="proj"]');
    expect(projBtn).not.toBeNull();
    expect(projBtn.getAttribute('data-projection')).toBe('perspective');
    expect(projBtn.textContent).toMatch(/Perspektif/);
  });

  test('Kapat butonu hâlâ mevcut', () => {
    veFEAOpenFullscreenViewer('test-cad');
    expect(document.getElementById('ve-fea-fullscreen-close')).not.toBeNull();
  });

  test('proj butonu tıklanırsa label/atribut değişir (viewer null bile olsa graceful)', () => {
    veFEAOpenFullscreenViewer('test-cad');
    const projBtn = document.querySelector('button[data-action="proj"]');
    // Click handler viewer.setProjection'a güvenir; viewer null ise erken çıkar.
    // Bu testte sadece handler hata atmamalı.
    expect(() => projBtn.click()).not.toThrow();
  });
});

// ────────────────────────────────────────────────────────────────────────────
describe('cp-fea.js Geometri panel — gömülü önizleme kaldırıldı (Faz 1)', () => {
  test('geometri panelinde artık "Sığdır" önizleme butonu YOK', () => {
    const node = { id: 'cFit', data: {} };
    const html = getFEAGeometryPropertiesHTML(node);
    expect(html).not.toMatch(/veFEAFitPreviewForNode\('cFit'\)/);
  });

  test('geometri panelinde artık gömülü "Tam Ekran" önizleme butonu YOK', () => {
    const node = { id: 'cFit2', data: {} };
    const html = getFEAGeometryPropertiesHTML(node);
    expect(html).not.toMatch(/veFEAFitPreviewForNode\('cFit2'\)/);
    expect(html).not.toMatch(/veFEAOpenFullscreenViewer\('cFit2'\)/);
  });
});

// ────────────────────────────────────────────────────────────────────────────
describe('veFEAFitPreviewForNode köprüsü', () => {
  test('kayıtlı viewer yoksa sessiz çıkar (hata atmaz)', () => {
    Object.keys(veFEAViewerRegistry).forEach((k) => delete veFEAViewerRegistry[k]);
    expect(() => veFEAFitPreviewForNode('nonexistent')).not.toThrow();
  });

  test('kayıtlı viewer\'ın fitToGeometry metodunu çağırır', () => {
    const fitSpy = jest.fn();
    veFEAViewerRegistry['cTest'] = { fitToGeometry: fitSpy };
    veFEAFitPreviewForNode('cTest');
    expect(fitSpy).toHaveBeenCalledTimes(1);
  });
});
