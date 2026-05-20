/**
 * FEA Parametrik Primitif birim testleri (Faz 2b)
 * - fea-primitives.js: tip listesi, şema, varsayılan, normalize, hacim/alan
 * - Birim formatlayıcılar
 * - cp-fea.js: parametrik form UI render
 * - fea-viewer.js: veFEAApplyPrimitive / veFEAClearGeometryForNode köprüleri
 *   (Three.js olmadığı için Three.js çağıran yollar mock'lanır)
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '../..');

eval(fs.readFileSync(path.join(ROOT, 'js/components.js'), 'utf8'));
eval(fs.readFileSync(path.join(ROOT, 'js/fea-primitives.js'), 'utf8'));
eval(fs.readFileSync(path.join(ROOT, 'js/fea-viewer.js'), 'utf8'));
eval(fs.readFileSync(path.join(ROOT, 'js/cp-fea.js'), 'utf8'));

// ────────────────────────────────────────────────────────────────────────────
describe('fea-primitives API tanımları', () => {
  test('10 tip mevcut: box, cylinder, shaft, sphere, hemisphere, torus, cone, lbracket, ibeam, rectTube', () => {
    const types = veFEAPrimitiveTypes();
    expect(types).toEqual(['box', 'cylinder', 'shaft', 'sphere', 'hemisphere', 'torus', 'cone', 'lbracket', 'ibeam', 'rectTube']);
  });

  test('her tipin etiketi ve şeması var', () => {
    veFEAPrimitiveTypes().forEach((t) => {
      expect(typeof veFEAPrimitiveLabel(t)).toBe('string');
      expect(Array.isArray(veFEAPrimitiveSchema(t))).toBe(true);
    });
  });

  test('bilinmeyen tip için şema null döner', () => {
    expect(veFEAPrimitiveSchema('unicorn')).toBeNull();
    expect(veFEAPrimitiveDefaults('unicorn')).toBeNull();
  });

  test('varsayılan değerler tüm şema anahtarlarını kapsar', () => {
    veFEAPrimitiveTypes().forEach((t) => {
      const def = veFEAPrimitiveDefaults(t);
      const schema = veFEAPrimitiveSchema(t);
      schema.forEach((p) => {
        expect(def[p.key]).toBe(p.default);
      });
    });
  });
});

// ────────────────────────────────────────────────────────────────────────────
describe('veFEANormalizePrimitiveParams', () => {
  test('min/max sınırlarına clamp uygular', () => {
    const out = veFEANormalizePrimitiveParams('box', { width: -100, height: 99999, depth: 5 });
    expect(out.width).toBeGreaterThanOrEqual(0.1);
    expect(out.height).toBeLessThanOrEqual(5000);
    expect(out.depth).toBe(5);
  });

  test('eksik parametreler için varsayılan kullanır', () => {
    const out = veFEANormalizePrimitiveParams('cylinder', { radius: 20 });
    expect(out.radius).toBe(20);
    expect(out.height).toBe(60);   // default
    expect(out.segments).toBe(48); // default
  });

  test('integer alan yuvarlanır', () => {
    const out = veFEANormalizePrimitiveParams('cylinder', { segments: 31.7 });
    expect(out.segments).toBe(32);
  });

  test('finite olmayan değerleri varsayılana düşürür', () => {
    const out = veFEANormalizePrimitiveParams('box', { width: NaN, height: Infinity, depth: 'abc' });
    expect(out.width).toBe(50);   // NaN → default
    expect(out.height).toBe(30);  // Infinity → default
    expect(out.depth).toBe(20);   // 'abc' → NaN → default
  });

  test('shaft: iç yarıçap dış yarıçaptan büyükse düşürür', () => {
    const out = veFEANormalizePrimitiveParams('shaft', { outerRadius: 10, innerRadius: 50, length: 100 });
    expect(out.innerRadius).toBeLessThan(out.outerRadius);
  });
});

// ────────────────────────────────────────────────────────────────────────────
describe('veFEAPrimitiveStats — analitik hacim/alan', () => {
  test('box: V = w·h·d, A = 2(wh+hd+wd)', () => {
    const s = veFEAPrimitiveStats('box', { width: 10, height: 20, depth: 30 });
    expect(s.volume).toBeCloseTo(10 * 20 * 30, 6);
    expect(s.surfaceArea).toBeCloseTo(2 * (10 * 20 + 20 * 30 + 10 * 30), 6);
    expect(s.bbox).toEqual({ x: 10, y: 20, z: 30 });
  });

  test('cylinder: V = π·r²·h', () => {
    const s = veFEAPrimitiveStats('cylinder', { radius: 5, height: 10, segments: 32 });
    expect(s.volume).toBeCloseTo(Math.PI * 25 * 10, 6);
    // A = 2πrh + 2πr²
    expect(s.surfaceArea).toBeCloseTo(2 * Math.PI * 5 * 10 + 2 * Math.PI * 25, 6);
    expect(s.bbox.x).toBe(10); // 2r
    expect(s.bbox.y).toBe(10); // h
    expect(s.bbox.z).toBe(10);
  });

  test('shaft (içi boş silindir): V = π(R²−r²)L', () => {
    const s = veFEAPrimitiveStats('shaft', { outerRadius: 10, innerRadius: 4, length: 50 });
    expect(s.volume).toBeCloseTo(Math.PI * (100 - 16) * 50, 6);
    expect(s.bbox).toEqual({ x: 20, y: 50, z: 20 });
  });

  test('shaft: r=0 ise tam dolu silindirin hacmine eşit', () => {
    const hollow = veFEAPrimitiveStats('shaft', { outerRadius: 10, innerRadius: 0, length: 50 });
    const solid  = veFEAPrimitiveStats('cylinder', { radius: 10, height: 50 });
    expect(hollow.volume).toBeCloseTo(solid.volume, 6);
  });
});

// ────────────────────────────────────────────────────────────────────────────
describe('format yardımcıları', () => {
  test('veFEAFormatVolume: ölçeğe göre birim seçimi', () => {
    expect(veFEAFormatVolume(100)).toMatch(/mm³/);
    expect(veFEAFormatVolume(5000)).toMatch(/cm³/);
    expect(veFEAFormatVolume(5e6)).toMatch(/dm³/);
    expect(veFEAFormatVolume(2e9)).toMatch(/m³/);
    expect(veFEAFormatVolume(0)).toBe('—');
    expect(veFEAFormatVolume(NaN)).toBe('—');
  });

  test('veFEAFormatArea: ölçeğe göre birim seçimi', () => {
    expect(veFEAFormatArea(50)).toMatch(/mm²/);
    expect(veFEAFormatArea(500)).toMatch(/cm²/);
    expect(veFEAFormatArea(50000)).toMatch(/dm²/);
    expect(veFEAFormatArea(2e6)).toMatch(/m²/);
  });

  test('veFEAFormatBBox: X × Y × Z formatı', () => {
    const s = veFEAFormatBBox({ x: 100, y: 200, z: 50 });
    expect(s).toMatch(/×/);
    expect(s.split('×').length).toBe(3);
  });
});

// ────────────────────────────────────────────────────────────────────────────
describe('cp-fea.js Geometri panel UI', () => {
  test('hiç geometri yokken durum tablosu "henüz yok" gösterir', () => {
    const node = { id: 'c1', data: {} };
    const html = getFEAGeometryPropertiesHTML(node);
    expect(html).toMatch(/henüz yok/);
  });

  test('Primitif dropdown\'unda 3 tip option olarak render edilir', () => {
    const node = { id: 'c2', data: {} };
    const html = getFEAGeometryPropertiesHTML(node);
    expect(html).toMatch(/veFEASelectParamForm\('c2', this\.value\)/);
    expect(html).toMatch(/<option value="box"[^>]*>Kutu<\/option>/);
    expect(html).toMatch(/<option value="cylinder"[^>]*>Silindir<\/option>/);
    expect(html).toMatch(/<option value="shaft"[^>]*>/);
  });

  test('her tip için form (gizli) ve parametre input alanları render edilir', () => {
    const node = { id: 'c3', data: {} };
    const html = getFEAGeometryPropertiesHTML(node);
    expect(html).toMatch(/id="ve-fea-form-c3-box"[^>]*display:none/);
    expect(html).toMatch(/id="ve-fea-param-c3-box-width"/);
    expect(html).toMatch(/id="ve-fea-param-c3-cylinder-radius"/);
    expect(html).toMatch(/id="ve-fea-param-c3-shaft-outerRadius"/);
  });

  test('geometri yüklüyken durum tablosu hesaplanmış değerleri gösterir', () => {
    const node = {
      id: 'c4',
      data: {
        geometry: {
          type: 'box',
          params: { width: 10, height: 10, depth: 10 },
          volume: 1000,
          surfaceArea: 600,
          bbox: { x: 10, y: 10, z: 10 },
          sourceLabel: 'Kutu'
        }
      }
    };
    const html = getFEAGeometryPropertiesHTML(node);
    expect(html).toMatch(/Kutu/);
    expect(html).toMatch(/cm³|mm³/); // hacim biçimlendirildi
    expect(html).toMatch(/Geometriyi Sil/);
  });

  test('aktif tipin formu açık döner (display:block)', () => {
    const node = {
      id: 'c5',
      data: { geometry: { type: 'cylinder', params: { radius: 5, height: 10, segments: 32 } } }
    };
    const html = getFEAGeometryPropertiesHTML(node);
    expect(html).toMatch(/id="ve-fea-form-c5-cylinder"[^>]*display:block/);
    expect(html).toMatch(/id="ve-fea-form-c5-box"[^>]*display:none/);
  });
});

// ────────────────────────────────────────────────────────────────────────────
describe('fea-viewer köprü fonksiyonları (Three.js yokken graceful)', () => {
  beforeEach(() => {
    Object.keys(veFEAViewerRegistry).forEach((k) => delete veFEAViewerRegistry[k]);
    global.nodes = [];
  });

  test('veFEAApplyPrimitive: viewer kayıtlı değilse hata atmaz', () => {
    global.nodes = [{ id: 'c10', data: {} }];
    expect(() => veFEAApplyPrimitive('c10', 'box', { width: 10, height: 10, depth: 10 })).not.toThrow();
  });

  test('veFEAClearGeometryForNode: viewer yoksa ve node varsa, data.geometry silinir', () => {
    global.nodes = [{ id: 'c11', data: { geometry: { type: 'box' } } }];
    veFEAClearGeometryForNode('c11');
    expect(global.nodes[0].data.geometry).toBeUndefined();
  });

  test('veFEAApplyPrimitive: loadPrimitive ve veri persist çağrılır, viewer korunur (preserve-across-render)', () => {
    // Yeni canvas-preserve mantığı: viewer dispose edilmez. Canvas DOM
    // elementi showNodeProperties öncesi detach + sonrası restore edilir
    // (preserve). Mevcut viewer ve WebGL context korunur — context churn
    // yok, "precision null" hatası önlenir.
    var loadPrimitiveCalled = false;
    var showCalled = false;
    var disposeCalled = false;
    veFEAViewerRegistry['c12'] = {
      loadPrimitive: function(type) { loadPrimitiveCalled = (type === 'box'); },
      dispose: function() { disposeCalled = true; }
    };
    global.nodes = [{ id: 'c12', data: {} }];
    global.showNodeProperties = function() { showCalled = true; };
    veFEAApplyPrimitive('c12', 'box', { width: 10, height: 10, depth: 10 });
    expect(loadPrimitiveCalled).toBe(true);
    expect(showCalled).toBe(true);
    // Viewer dispose EDİLMEMELİ — preserve-across-render
    expect(disposeCalled).toBe(false);
    expect(veFEAViewerRegistry['c12']).toBeDefined();
    // Data persist edildi
    expect(global.nodes[0].data.geometry.type).toBe('box');
  });
});
