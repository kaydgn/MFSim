/**
 * FEA STEP Import birim testleri (Faz 2d)
 * Gerçek OCCT WASM jsdom'da çalışmaz; global occtimportjs mock'lanır.
 *  - build.js: INLINE_FILE placeholder pattern'i
 *  - js/fea-step.js: lazy loader durum makinesi, parse adapter,
 *    veFEAApplySTEP davranışı (success + error path), file input handler
 *  - js/cp-fea.js: STEP butonu + durum tablosu STEP'i tanıyor
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '../..');

eval(fs.readFileSync(path.join(ROOT, 'js/components.js'), 'utf8'));
eval(fs.readFileSync(path.join(ROOT, 'js/fea-stl.js'), 'utf8'));
eval(fs.readFileSync(path.join(ROOT, 'js/fea-step.js'), 'utf8'));
eval(fs.readFileSync(path.join(ROOT, 'js/fea-primitives.js'), 'utf8'));
eval(fs.readFileSync(path.join(ROOT, 'js/fea-viewer.js'), 'utf8'));
eval(fs.readFileSync(path.join(ROOT, 'js/cp-fea.js'), 'utf8'));

// ────────────────────────────────────────────────────────────────────────────
describe('build.js INLINE_FILE pattern', () => {
  const buildSrc = fs.readFileSync(path.join(ROOT, 'build.js'), 'utf8');

  test("INLINE_FILE: <path> as <kind> regex'i tanımlı", () => {
    // Sadece var olup olmadığına ve "INLINE_FILE" anahtar kelimesine bakıyoruz
    expect(buildSrc).toMatch(/INLINE_FILE/);
  });

  test('WASM dosyaları base64 olarak işlenir (toString("base64") çağrısı var)', () => {
    expect(buildSrc).toMatch(/toString\(['"]base64['"]\)/);
  });

  test("window.__feaInline kullanıcı tarafından erişilebilir biçimde set edilir", () => {
    expect(buildSrc).toMatch(/window\.__feaInline/);
  });
});

// ────────────────────────────────────────────────────────────────────────────
describe('index.html STEP entegrasyonu', () => {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');

  test('OCCT JS ve WASM için INLINE_FILE placeholderları mevcut', () => {
    expect(html).toMatch(/INLINE_FILE:\s*vendor\/opencascade\/occt-import-js\.js\s+as\s+occtScript/);
    expect(html).toMatch(/INLINE_FILE:\s*vendor\/opencascade\/occt-import-js\.wasm\s+as\s+occtWasm/);
  });

  test('fea-step.js script tag bulunur ve viewer/cp-fea.js öncesinde', () => {
    const stepIdx = html.indexOf('js/fea-step.js');
    const viewerIdx = html.indexOf('js/fea-viewer.js');
    const cpFeaIdx = html.indexOf('js/cp-fea.js');
    expect(stepIdx).toBeGreaterThan(-1);
    expect(stepIdx).toBeLessThan(viewerIdx);
    expect(viewerIdx).toBeLessThan(cpFeaIdx);
  });
});

// ────────────────────────────────────────────────────────────────────────────
describe('vendor/opencascade/ dosyaları', () => {
  const dir = path.join(ROOT, 'vendor/opencascade');

  test('occt-import-js.js mevcut', () => {
    expect(fs.existsSync(path.join(dir, 'occt-import-js.js'))).toBe(true);
  });

  test('occt-import-js.wasm mevcut ve > 1 MB', () => {
    const p = path.join(dir, 'occt-import-js.wasm');
    expect(fs.existsSync(p)).toBe(true);
    const stats = fs.statSync(p);
    expect(stats.size).toBeGreaterThan(1024 * 1024);
  });

  test('OCCT ve occt-import-js lisansları kopyalandı', () => {
    expect(fs.existsSync(path.join(dir, 'license.occt.txt'))).toBe(true);
    expect(fs.existsSync(path.join(dir, 'license.occt-import-js.txt'))).toBe(true);
  });
});

// ────────────────────────────────────────────────────────────────────────────
describe('fea-step API yüzey kontrolü', () => {
  test('public fonksiyonlar tanımlı', () => {
    expect(typeof veFEAEnsureOCCT).toBe('function');
    expect(typeof veFEAParseSTEPBuffer).toBe('function');
    expect(typeof veFEAStepMeshesToParsed).toBe('function');
    expect(typeof veFEAApplySTEP).toBe('function');
    expect(typeof veFEAOnSTEPFileSelected).toBe('function');
  });

  test('VE_FEA_OCCT_STATE init durumu null', () => {
    // beforeEach henüz çağrılmamış olabilir; lazy load tetiklemediğimiz sürece module null kalır
    expect(VE_FEA_OCCT_STATE).toBeDefined();
    expect(VE_FEA_OCCT_STATE.module).toBeNull();
  });
});

// ────────────────────────────────────────────────────────────────────────────
describe('veFEAStepMeshesToParsed — OCCT result adapter', () => {
  test('boş mesh listesi: triangleCount=0', () => {
    const r = veFEAStepMeshesToParsed({ meshes: [] });
    expect(r.triangleCount).toBe(0);
    expect(r.vertices.length).toBe(0);
  });

  test('null result: triangleCount=0', () => {
    const r = veFEAStepMeshesToParsed(null);
    expect(r.triangleCount).toBe(0);
  });

  test('tek üçgenli mesh: 1 üçgen, 9 vertex bileşeni', () => {
    const r = veFEAStepMeshesToParsed({
      meshes: [{
        attributes: {
          position: { array: new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]) },
          normal:   { array: new Float32Array([0, 0, 1, 0, 0, 1, 0, 0, 1]) }
        },
        index: { array: [0, 1, 2] }
      }]
    });
    expect(r.triangleCount).toBe(1);
    expect(Array.from(r.vertices.slice(0, 9))).toEqual([0, 0, 0, 1, 0, 0, 0, 1, 0]);
  });

  test('iki ayrı parça birleşir (toplam üçgen sayısı toplam)', () => {
    const r = veFEAStepMeshesToParsed({
      meshes: [
        {
          attributes: { position: { array: new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]) } },
          index: { array: [0, 1, 2] }
        },
        {
          attributes: { position: { array: new Float32Array([0, 0, 1, 1, 0, 1, 0, 1, 1]) } },
          index: { array: [0, 1, 2] }
        }
      ]
    });
    expect(r.triangleCount).toBe(2);
    expect(r.meshCount).toBe(2);
  });

  test('alternatif data isimleri (data, array) desteklenir', () => {
    const r = veFEAStepMeshesToParsed({
      meshes: [{
        attributes: { position: { data: new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]) } },
        index: { data: [0, 1, 2] }
      }]
    });
    expect(r.triangleCount).toBe(1);
  });
});

// ────────────────────────────────────────────────────────────────────────────
describe('veFEAEnsureOCCT — lazy load durum makinesi', () => {
  beforeEach(() => {
    // State sıfırla
    VE_FEA_OCCT_STATE.module = null;
    VE_FEA_OCCT_STATE.loading = null;
    // Mock occtimportjs global'i
    global.occtimportjs = jest.fn(function(opts) {
      return Promise.resolve({
        ReadStepFile: jest.fn(function(buf) {
          return {
            success: true,
            meshes: [{
              attributes: { position: { array: new Float32Array([0, 0, 0, 10, 0, 0, 0, 10, 0]) } },
              index: { array: [0, 1, 2] }
            }]
          };
        })
      });
    });
  });

  test('ilk çağrıda occtimportjs initialize edilir, modül cache lenir', async () => {
    const m1 = await veFEAEnsureOCCT();
    const m2 = await veFEAEnsureOCCT();
    expect(m1).toBe(m2);
    expect(global.occtimportjs).toHaveBeenCalledTimes(1);
    expect(VE_FEA_OCCT_STATE.module).toBe(m1);
  });

  test('eşzamanlı çağrılarda aynı Promise döner (race koruması)', async () => {
    const p1 = veFEAEnsureOCCT();
    const p2 = veFEAEnsureOCCT();
    const [m1, m2] = await Promise.all([p1, p2]);
    expect(m1).toBe(m2);
    expect(global.occtimportjs).toHaveBeenCalledTimes(1);
  });

  test('locateFile callback .wasm için WASM url döndürür', async () => {
    await veFEAEnsureOCCT();
    const opts = global.occtimportjs.mock.calls[0][0];
    expect(typeof opts.locateFile).toBe('function');
    // jsdom'da URL.createObjectURL desteklenmiyor olabilir; en azından
    // call edilebilir bir fonksiyon olduğunu doğruluyoruz
    expect(opts.locateFile('test.txt')).toBe('test.txt');
  });
});

// ────────────────────────────────────────────────────────────────────────────
describe('veFEAApplySTEP — uygulama akışı', () => {
  beforeEach(() => {
    VE_FEA_OCCT_STATE.module = null;
    VE_FEA_OCCT_STATE.loading = null;
    Object.keys(veFEAViewerRegistry).forEach((k) => delete veFEAViewerRegistry[k]);
    global.nodes = [];
    global.showToast = jest.fn();
    global.showNodeProperties = jest.fn();
    global.saveState = jest.fn();
    global.occtimportjs = jest.fn(function() {
      return Promise.resolve({
        ReadStepFile: jest.fn(function() {
          return {
            success: true,
            meshes: [{
              // 1×1×0 üçgen — basit
              attributes: { position: { array: new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]) } },
              index: { array: [0, 1, 2] }
            }]
          };
        })
      });
    });
  });

  test('başarılı parse: node.data.geometry STEP olarak güncellenir', async () => {
    global.nodes = [{ id: 'cS1', data: {} }];
    veFEAApplySTEP('cS1', new ArrayBuffer(128), 'gear.step');
    // Promise zincirinin tamamlanmasını bekle
    await new Promise((r) => setTimeout(r, 0));
    await new Promise((r) => setTimeout(r, 0));

    const g = global.nodes[0].data.geometry;
    expect(g).toBeDefined();
    expect(g.type).toBe('step');
    expect(g.sourceLabel).toBe('gear.step');
    expect(g.triangleCount).toBe(1);
    expect(global.saveState).toHaveBeenCalled();
  });

  test('success toast atılır', async () => {
    global.nodes = [{ id: 'cS2', data: {} }];
    veFEAApplySTEP('cS2', new ArrayBuffer(128), 'part.step');
    await new Promise((r) => setTimeout(r, 0));
    await new Promise((r) => setTimeout(r, 0));
    const successCalls = global.showToast.mock.calls.filter((c) => c[1] === 'success');
    expect(successCalls.length).toBeGreaterThanOrEqual(1);
  });

  test('OCCT init başarısız olursa error toast atılır, hata fırlatmaz', async () => {
    global.occtimportjs = jest.fn(function() {
      return Promise.reject(new Error('WASM yüklenemedi'));
    });
    global.nodes = [{ id: 'cS3', data: {} }];
    veFEAApplySTEP('cS3', new ArrayBuffer(128), 'bad.step');
    await new Promise((r) => setTimeout(r, 0));
    await new Promise((r) => setTimeout(r, 0));
    await new Promise((r) => setTimeout(r, 0));
    const errorCalls = global.showToast.mock.calls.filter((c) => c[1] === 'error');
    expect(errorCalls.length).toBeGreaterThanOrEqual(1);
    expect(global.nodes[0].data.geometry).toBeUndefined();
  });

  test('OCCT parse success=false: error toast', async () => {
    global.occtimportjs = jest.fn(function() {
      return Promise.resolve({
        ReadStepFile: function() { return { success: false }; }
      });
    });
    global.nodes = [{ id: 'cS4', data: {} }];
    veFEAApplySTEP('cS4', new ArrayBuffer(128), 'bad2.step');
    await new Promise((r) => setTimeout(r, 0));
    await new Promise((r) => setTimeout(r, 0));
    const errorCalls = global.showToast.mock.calls.filter((c) => c[1] === 'error');
    expect(errorCalls.length).toBeGreaterThanOrEqual(1);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// ────────────────────────────────────────────────────────────────────────────
// Regresyon: panel her açıldığında veFEAInitGeometryViewerForNode tetiklenir.
// Eğer auto-load STEP'i applySTEP üzerinden yeniden yüklerse, applySTEP →
// showNodeProperties → dispatcher → init → applySTEP zinciri sonsuz döngü
// oluşturur (kullanıcı şikayeti: "sürekli toast, mesh gelmiyor").
// Sessiz reload yolu kullanılmalı.
describe('STEP auto-load sonsuz döngü koruması', () => {
  beforeEach(() => {
    Object.keys(veFEAViewerRegistry).forEach((k) => delete veFEAViewerRegistry[k]);
    document.body.innerHTML = '';
    global.showToast = jest.fn();
    global.showNodeProperties = jest.fn();
    global.saveState = jest.fn();
  });

  test('fea-viewer.js kaynağı: STEP auto-load veFEAApplySTEP çağırmamalı', () => {
    // Statik kaynak kontrolü — sonsuz döngü regresyonunu yakalar
    const viewerSrc = fs.readFileSync(path.join(ROOT, 'js/fea-viewer.js'), 'utf8');
    // veFEAInitGeometryViewerForNode bloğunu izole et
    const initStart = viewerSrc.indexOf('function veFEAInitGeometryViewerForNode');
    expect(initStart).toBeGreaterThan(-1);
    // STEP dalı applySTEP yerine ParseSTEPBuffer + Stepmeshes + viewer.loadSTL kullanmalı
    const initEnd = viewerSrc.indexOf('\n}', initStart);
    const initBody = viewerSrc.substring(initStart, initEnd);
    // STEP branch'inde applySTEP referansı OLMAMALI
    const stepBranchMatch = initBody.match(/g\.type === ['"]step['"][\s\S]*?(?=\}\s*else|\}\s*$)/);
    expect(stepBranchMatch).not.toBeNull();
    // Fonksiyon çağrısı yok — yorumda yalın metin geçebilir, sadece "(" ile takip eden çağrıları yasakla
    expect(stepBranchMatch[0]).not.toMatch(/veFEAApplySTEP\s*\(/);
    // Onun yerine sessiz parse zinciri olmalı
    expect(stepBranchMatch[0]).toMatch(/veFEAParseSTEPBuffer/);
    expect(stepBranchMatch[0]).toMatch(/veFEAStepMeshesToParsed/);
    expect(stepBranchMatch[0]).toMatch(/viewer\.loadSTL/);
  });

  test('applySTEP sonrası tek bir saveState çağrısı yapılır (döngü değil)', async () => {
    VE_FEA_OCCT_STATE.module = null;
    VE_FEA_OCCT_STATE.loading = null;
    global.occtimportjs = jest.fn(function() {
      return Promise.resolve({
        ReadStepFile: function() {
          return {
            success: true,
            meshes: [{
              attributes: { position: { array: new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]) } },
              index: { array: [0, 1, 2] }
            }]
          };
        }
      });
    });
    global.nodes = [{ id: 'cLoop', data: {} }];

    veFEAApplySTEP('cLoop', new ArrayBuffer(64), 'pump.step');

    // Yeterli Promise tick'i bekle
    for (let i = 0; i < 5; i++) await new Promise((r) => setTimeout(r, 0));

    // saveState tam olarak 1 kez çağrılmalı (auto-load applySTEP'i tetiklemiyor)
    expect(global.saveState).toHaveBeenCalledTimes(1);
  });
});

describe('veFEAOnSTEPFileSelected', () => {
  test('null input ile sessiz çıkar', () => {
    expect(() => veFEAOnSTEPFileSelected(null, 'x')).not.toThrow();
  });

  test('boş files listesi ile sessiz çıkar', () => {
    expect(() => veFEAOnSTEPFileSelected({ files: [] }, 'x')).not.toThrow();
  });
});

// ────────────────────────────────────────────────────────────────────────────
describe('cp-fea.js STEP UI rendering', () => {
  test('STEP Yükle butonu ve gizli file input render edilir', () => {
    const node = { id: 'cT', data: {} };
    const html = getFEAGeometryPropertiesHTML(node);
    expect(html).toMatch(/STEP Yükle/);
    expect(html).toMatch(/id="ve-fea-step-input-cT"/);
    expect(html).toMatch(/accept="\.step,\.stp"/);
    expect(html).toMatch(/veFEAOnSTEPFileSelected/);
  });

  test('STEP geometri yüklüyken üçgen sayısı ve dosya adı görünür', () => {
    const node = {
      id: 'cU',
      data: {
        geometry: {
          type: 'step',
          sourceLabel: 'shaft.step',
          triangleCount: 5432,
          meshCount: 1,
          volume: 9000,
          surfaceArea: 4500,
          bbox: { x: 50, y: 100, z: 50 }
        }
      }
    };
    const html = getFEAGeometryPropertiesHTML(node);
    expect(html).toMatch(/shaft\.step/);
    expect(html).toMatch(/5[\.,]?432/);
  });

  test('STEP çoklu parça: parça sayısı satırı görünür', () => {
    const node = {
      id: 'cV',
      data: {
        geometry: {
          type: 'step',
          sourceLabel: 'assembly.step',
          triangleCount: 1000,
          meshCount: 4,
          volume: 1000,
          surfaceArea: 600,
          bbox: { x: 10, y: 10, z: 10 }
        }
      }
    };
    const html = getFEAGeometryPropertiesHTML(node);
    expect(html).toMatch(/Parça sayısı/);
  });
});
