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
  test('18 tip mevcut: temel hacimsel + yapısal + bağlantı + benchmark', () => {
    const types = veFEAPrimitiveTypes();
    expect(types).toEqual([
      // Temel hacimsel
      'box', 'cylinder', 'shaft', 'sphere', 'hemisphere', 'torus', 'cone',
      // Yapısal profiller
      'lbracket', 'ibeam', 'rectTube',
      // Otomotiv bağlantı elemanları (motor/şanzıman)
      'washer', 'bolt', 'nut', 'plate',
      // Benchmark geometrileri (mesh matematiğini zorlayan karmaşık parçalar)
      'oilFilterBracket', 'pipeFlange', 'clevis', 'gussetBracket'
    ]);
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

  test('washer: V = π(R²−r²)·t (annular extrusion)', () => {
    const s = veFEAPrimitiveStats('washer', { outerRadius: 12, innerRadius: 5, thickness: 1.5, segments: 48 });
    expect(s.volume).toBeCloseTo(Math.PI * (144 - 25) * 1.5, 6);
    expect(s.bbox).toEqual({ x: 24, y: 1.5, z: 24 });
  });

  test('washer: iç yarıçap >= dış → 1mm fark zorlanır (validasyon)', () => {
    const s = veFEAPrimitiveStats('washer', { outerRadius: 10, innerRadius: 15, thickness: 1 });
    expect(s.params.innerRadius).toBe(9); // 10 - 1
  });

  test('nut: altıgen prizma − merkez delik (hacim < tam altıgen)', () => {
    const s = veFEAPrimitiveStats('nut', { width: 13, thickness: 6.5, holeDiameter: 8 });
    const hexR = 13 / Math.sqrt(3);
    const hexArea = (3 * Math.sqrt(3) / 2) * hexR * hexR;
    const holeArea = Math.PI * 16;
    expect(s.volume).toBeCloseTo((hexArea - holeArea) * 6.5, 4);
    expect(s.bbox.x).toBeCloseTo(2 * hexR, 4);
  });

  test('bolt: hacim = altıgen başlık + silindir gövde', () => {
    const s = veFEAPrimitiveStats('bolt', { headWidth: 13, headHeight: 5.5, shaftDiameter: 8, shaftLength: 30 });
    const hexR = 13 / Math.sqrt(3);
    const headVol = (3 * Math.sqrt(3) / 2) * hexR * hexR * 5.5;
    const shaftVol = Math.PI * 16 * 30;
    expect(s.volume).toBeCloseTo(headVol + shaftVol, 4);
    expect(s.bbox.y).toBe(5.5 + 30);
  });

  test('plate: 2×2 grid, delikli levha hacmi', () => {
    const s = veFEAPrimitiveStats('plate', {
      length: 120, width: 80, thickness: 8, holeDiameter: 9, cols: 2, rows: 2, margin: 15
    });
    const plateArea = 120 * 80;
    const holeArea = 4 * Math.PI * 4.5 * 4.5;
    expect(s.volume).toBeCloseTo((plateArea - holeArea) * 8, 4);
    expect(s.bbox).toEqual({ x: 120, y: 8, z: 80 });
  });

  test('plate: 1×1 (tek merkez delik) parametre kabul edilir', () => {
    const s = veFEAPrimitiveStats('plate', {
      length: 50, width: 50, thickness: 5, holeDiameter: 10, cols: 1, rows: 1, margin: 10
    });
    const expectedV = (50 * 50 - Math.PI * 25) * 5;
    expect(s.volume).toBeCloseTo(expectedV, 4);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// Benchmark geometrileri: tip-spesifik mesher'ları YOKTUR; generic voxel+tet4
// yolunu zorlamak için tasarlanmıştır. Stats analitik (Three.js gerektirmez).
describe('Benchmark geometrileri — analitik stats', () => {
  test('oilFilterBracket: kompozit hacim (taban − delikler + boss + kaburga)', () => {
    const s = veFEAPrimitiveStats('oilFilterBracket', {
      baseLength: 90, baseWidth: 60, baseThickness: 8,
      bossOuterDiameter: 40, bossInnerDiameter: 28, bossHeight: 35,
      mountHoleDiameter: 9, ribThickness: 5
    });
    const boR = 20, biR = 14, mr = 4.5;
    const baseVol = 90 * 60 * 8 - Math.PI * biR * biR * 8 - 4 * Math.PI * mr * mr * 8;
    const bossVol = Math.PI * (boR * boR - biR * biR) * 35;
    const ribVol = 2 * (0.5 * ((45 - boR) * 0.8) * (35 * 0.7)) * 5;
    expect(s.volume).toBeCloseTo(baseVol + bossVol + ribVol, 3);
    expect(s.bbox).toEqual({ x: 90, y: 43, z: 60 }); // y = taban + boss
    expect(s.surfaceArea).toBeGreaterThan(0);
    expect(s.generic).not.toBe(true); // analitik kullanıldı (mesh fallback değil)
  });

  test('oilFilterBracket: boss iç delik kapanınca (=0) hacim artar', () => {
    const hollow = veFEAPrimitiveStats('oilFilterBracket', { bossInnerDiameter: 28 });
    const solid  = veFEAPrimitiveStats('oilFilterBracket', { bossInnerDiameter: 0 });
    expect(solid.volume).toBeGreaterThan(hollow.volume);
  });

  test('pipeFlange: flanş (− bore − N bolt) + içi boş boyun', () => {
    const s = veFEAPrimitiveStats('pipeFlange', {
      flangeDiameter: 120, flangeThickness: 12, neckDiameter: 50, neckHeight: 40,
      boreDiameter: 32, boltCircleDiameter: 95, boltHoleDiameter: 11, boltCount: 6
    });
    const Fr = 60, Br = 16, boltR = 5.5, Nr = 25;
    const flangeVol = Math.PI * Fr * Fr * 12 - Math.PI * Br * Br * 12 - 6 * Math.PI * boltR * boltR * 12;
    const neckVol = Math.PI * (Nr * Nr - Br * Br) * 40;
    expect(s.volume).toBeCloseTo(flangeVol + neckVol, 3);
    expect(s.bbox).toEqual({ x: 120, y: 52, z: 120 });
    expect(s.generic).not.toBe(true);
  });

  test('pipeFlange: daha çok cıvata = daha çok delik = daha az hacim', () => {
    const few  = veFEAPrimitiveStats('pipeFlange', { boltCount: 4 });
    const many = veFEAPrimitiveStats('pipeFlange', { boltCount: 12 });
    expect(many.volume).toBeLessThan(few.volume);
  });

  test('clevis: taban + 2 kulak (yarım daire − pim deliği); baseW = gap + 2·et', () => {
    const s = veFEAPrimitiveStats('clevis', {
      baseDepth: 30, baseHeight: 15, earThickness: 8, earHeight: 35, gap: 16, pinHoleDiameter: 12
    });
    const earR = 15, pinR = 6, baseW = 16 + 2 * 8;
    const baseVol = baseW * 15 * 30;
    const earArea = 30 * 35 + 0.5 * Math.PI * earR * earR - Math.PI * pinR * pinR;
    expect(s.volume).toBeCloseTo(baseVol + 2 * earArea * 8, 3);
    expect(s.bbox).toEqual({ x: baseW, y: 15 + 35 + earR, z: 30 });
    expect(s.generic).not.toBe(true);
  });

  test('clevis: pim deliği kapanınca (=0) hacim artar', () => {
    const drilled = veFEAPrimitiveStats('clevis', { pinHoleDiameter: 12 });
    const solid   = veFEAPrimitiveStats('clevis', { pinHoleDiameter: 0 });
    expect(solid.volume).toBeGreaterThan(drilled.volume);
  });

  test('gussetBracket: duvar + raf − L köşe çakışması + N kaburga', () => {
    const s = veFEAPrimitiveStats('gussetBracket', {
      wallHeight: 80, shelfLength: 70, width: 60, plateThickness: 8,
      gussetThickness: 5, gussetCount: 2, holeDiameter: 9
    });
    const hr = 4.5;
    const wallVol = 60 * 80 * 8 - 2 * Math.PI * hr * hr * 8;
    const shelfVol = 60 * 70 * 8;
    const gussetVol = 2 * (0.5 * (80 * 0.7) * (70 * 0.7)) * 5;
    // Duvar rafın üstünde → hacim örtüşmesi yok (corner overlap çıkarılmaz)
    expect(s.volume).toBeCloseTo(wallVol + shelfVol + gussetVol, 3);
    expect(s.bbox).toEqual({ x: 60, y: 8 + 80, z: 70 }); // y = plateThickness + wallHeight
    expect(s.generic).not.toBe(true);
  });

  test('gussetBracket: daha çok kaburga = daha çok malzeme = daha çok hacim', () => {
    const one  = veFEAPrimitiveStats('gussetBracket', { gussetCount: 1 });
    const four = veFEAPrimitiveStats('gussetBracket', { gussetCount: 4 });
    expect(four.volume).toBeGreaterThan(one.volume);
  });
});

// ────────────────────────────────────────────────────────────────────────────
describe('Benchmark geometrileri — normalize validasyonu', () => {
  test('oilFilterBracket: boss iç çap dış çaptan küçük zorlanır', () => {
    const out = veFEANormalizePrimitiveParams('oilFilterBracket', {
      bossOuterDiameter: 30, bossInnerDiameter: 50
    });
    expect(out.bossInnerDiameter).toBeLessThan(out.bossOuterDiameter);
  });

  test('oilFilterBracket: boss taban içine sığacak şekilde clamp edilir', () => {
    const out = veFEANormalizePrimitiveParams('oilFilterBracket', {
      baseLength: 40, baseWidth: 40, bossOuterDiameter: 200
    });
    expect(out.bossOuterDiameter).toBeLessThanOrEqual(40);
  });

  test('pipeFlange: cıvata sayısı integer yuvarlanır; bore < boyun < flanş', () => {
    const out = veFEANormalizePrimitiveParams('pipeFlange', {
      boltCount: 6.7, flangeDiameter: 120, neckDiameter: 200, boreDiameter: 300
    });
    expect(out.boltCount).toBe(7);
    expect(out.neckDiameter).toBeLessThan(out.flangeDiameter);
    expect(out.boreDiameter).toBeLessThan(out.neckDiameter);
  });

  test('clevis: pim deliği kulak derinliğine sığacak şekilde clamp edilir', () => {
    const out = veFEANormalizePrimitiveParams('clevis', { baseDepth: 20, pinHoleDiameter: 100 });
    expect(out.pinHoleDiameter).toBeLessThanOrEqual(20);
  });

  test('gussetBracket: kaburga sayısı integer; plaka kalınlığı makul clamp', () => {
    const out = veFEANormalizePrimitiveParams('gussetBracket', {
      gussetCount: 3.2, wallHeight: 30, shelfLength: 30, plateThickness: 100
    });
    expect(out.gussetCount).toBe(3);
    expect(out.plateThickness).toBeLessThanOrEqual(10); // min(30,30)/3
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
