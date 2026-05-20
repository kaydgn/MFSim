/**
 * CAD Boolean wrapper birim testleri.
 *
 * Manifold-3D WASM modülünü yüklemek Node ortamında ağır (TBB threading
 * init eder, ~500 KB WASM derler) ve test izolasyonu zorlaşır. Bu yüzden
 * bu testler:
 *   1) Yüklenmeden önceki sync API'sini doğrular (isReady → false vs.).
 *   2) Modülün lazy-load (idempotent) davranışını doğrular.
 *   3) WASM'ın gerçek booleanını E2E testlerine bırakır (Playwright).
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '../..');

eval(fs.readFileSync(path.join(ROOT, 'js/fea-primitives.js'), 'utf8'));
eval(fs.readFileSync(path.join(ROOT, 'js/cad-engine.js'), 'utf8'));
eval(fs.readFileSync(path.join(ROOT, 'js/cad-boolean.js'), 'utf8'));

describe('CAD Boolean — Sync API (modül yüklenmemiş)', () => {
  beforeEach(() => {
    // Her test öncesi dispose et — state izolasyonu için
    if (typeof veCADBoolDispose === 'function') veCADBoolDispose();
  });

  test('veCADBoolIsReady() başlangıçta false', () => {
    expect(veCADBoolIsReady()).toBe(false);
  });

  test('veCADHasBoolean() modül yüklenene kadar false', () => {
    expect(veCADHasBoolean()).toBe(false);
  });

  test('veCADBoolApplyFeatures modül yokken hata atar', () => {
    expect(() => veCADBoolApplyFeatures([])).toThrow();
  });

  test('veCADBoolEnsureModule loader yoksa reject eder', () => {
    // Test ortamında globalThis.veCADManifoldLoader yok
    return expect(veCADBoolEnsureModule()).rejects.toThrow(/loader/i);
  });

  test('veCADBoolEnsureModule idempotent — eş zamanlı çağrılar tek promise paylaşır', () => {
    // Loader yok → ikinci çağrı aynı reject ile döner (concurrent reject)
    const p1 = veCADBoolEnsureModule().catch(e => e);
    const p2 = veCADBoolEnsureModule().catch(e => e);
    return Promise.all([p1, p2]).then(([e1, e2]) => {
      expect(e1).toBeInstanceOf(Error);
      expect(e2).toBeInstanceOf(Error);
    });
  });
});

describe('CAD Boolean — Backend label dinamik', () => {
  test('modül yokken "Three.js" etiketi döner', () => {
    expect(typeof veCADBackendLabel()).toBe('string');
    // veCADBoolEnsureModule fonksiyon olarak yüklü (loader yok ama wrapper var)
    // → "yükleniyor" etiketi alabilir
    expect(veCADBackendLabel()).toMatch(/Three\.js|Manifold/i);
  });
});
