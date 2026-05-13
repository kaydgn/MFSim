/**
 * FEA STL Import birim testleri (Faz 2c)
 * - Binary STL parser: 12 üçgenli küp fixture'ı
 * - ASCII STL parser: aynı küp metin olarak
 * - veFEAComputeMeshStats: hacim/alan/bbox (analitik beklenenle ±0.01)
 * - Base64 ArrayBuffer roundtrip
 * - veFEAApplySTL / veFEAOnSTLFileSelected köprüleri (graceful)
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '../..');

eval(fs.readFileSync(path.join(ROOT, 'js/components.js'), 'utf8'));
eval(fs.readFileSync(path.join(ROOT, 'js/fea-stl.js'), 'utf8'));
eval(fs.readFileSync(path.join(ROOT, 'js/fea-primitives.js'), 'utf8'));
eval(fs.readFileSync(path.join(ROOT, 'js/fea-viewer.js'), 'utf8'));
eval(fs.readFileSync(path.join(ROOT, 'js/cp-fea.js'), 'utf8'));

// ────────────────────────────────────────────────────────────────────────────
// Test fixture: 10×10×10 küp (CCW dış normal orientasyon)
//   6 yüz × 2 üçgen = 12 üçgen
//   V = 1000 mm³, A = 600 mm², bbox = {10,10,10}

function buildCubeTriangles() {
  // Her üçgen: [v1x,v1y,v1z, v2x,v2y,v2z, v3x,v3y,v3z, nx,ny,nz]
  return [
    // Z=0 (-Z)
    [0,0,0, 10,10,0, 10,0,0,  0,0,-1],
    [0,0,0, 0,10,0, 10,10,0,  0,0,-1],
    // Z=10 (+Z)
    [0,0,10, 10,0,10, 10,10,10,  0,0,1],
    [0,0,10, 10,10,10, 0,10,10,  0,0,1],
    // X=0 (-X)
    [0,0,0, 0,0,10, 0,10,10,  -1,0,0],
    [0,0,0, 0,10,10, 0,10,0,  -1,0,0],
    // X=10 (+X)
    [10,0,0, 10,10,0, 10,10,10,  1,0,0],
    [10,0,0, 10,10,10, 10,0,10,  1,0,0],
    // Y=0 (-Y)
    [0,0,0, 10,0,0, 10,0,10,  0,-1,0],
    [0,0,0, 10,0,10, 0,0,10,  0,-1,0],
    // Y=10 (+Y)
    [0,10,0, 0,10,10, 10,10,10,  0,1,0],
    [0,10,0, 10,10,10, 10,10,0,  0,1,0]
  ];
}

function buildBinarySTLCube() {
  var tris = buildCubeTriangles();
  var bufSize = 84 + tris.length * 50;
  var ab = new ArrayBuffer(bufSize);
  var view = new DataView(ab);
  // 80-byte header — boş (Uint8Array varsayılan 0)
  view.setUint32(80, tris.length, true);
  var offset = 84;
  for(var i = 0; i < tris.length; i++) {
    var t = tris[i];
    // normal
    view.setFloat32(offset, t[9],  true);
    view.setFloat32(offset + 4,  t[10], true);
    view.setFloat32(offset + 8,  t[11], true);
    offset += 12;
    // 3 vertices
    for(var j = 0; j < 9; j++) {
      view.setFloat32(offset + j * 4, t[j], true);
    }
    offset += 36;
    // attribute byte count (0)
    view.setUint16(offset, 0, true);
    offset += 2;
  }
  return ab;
}

function buildAsciiSTLCube() {
  var tris = buildCubeTriangles();
  var lines = ['solid cube'];
  for(var i = 0; i < tris.length; i++) {
    var t = tris[i];
    lines.push('  facet normal ' + t[9] + ' ' + t[10] + ' ' + t[11]);
    lines.push('    outer loop');
    lines.push('      vertex ' + t[0] + ' ' + t[1] + ' ' + t[2]);
    lines.push('      vertex ' + t[3] + ' ' + t[4] + ' ' + t[5]);
    lines.push('      vertex ' + t[6] + ' ' + t[7] + ' ' + t[8]);
    lines.push('    endloop');
    lines.push('  endfacet');
  }
  lines.push('endsolid cube');
  return lines.join('\n');
}

// ────────────────────────────────────────────────────────────────────────────
describe('veFEAIsBinarySTL', () => {
  test('geçerli binary küp için true döner', () => {
    expect(veFEAIsBinarySTL(buildBinarySTLCube())).toBe(true);
  });

  test('çok kısa buffer için false', () => {
    expect(veFEAIsBinarySTL(new ArrayBuffer(50))).toBe(false);
  });

  test('null/undefined için false', () => {
    expect(veFEAIsBinarySTL(null)).toBe(false);
    expect(veFEAIsBinarySTL(undefined)).toBe(false);
  });

  test('ASCII (UTF-8) buffer için false', () => {
    var ascii = buildAsciiSTLCube();
    var bytes = new Uint8Array(ascii.length);
    for(var i = 0; i < ascii.length; i++) bytes[i] = ascii.charCodeAt(i);
    expect(veFEAIsBinarySTL(bytes.buffer)).toBe(false);
  });
});

// ────────────────────────────────────────────────────────────────────────────
describe('veFEAParseSTL — Binary', () => {
  var parsed;
  beforeAll(() => {
    parsed = veFEAParseSTL(buildBinarySTLCube());
  });

  test('triangleCount = 12', () => {
    expect(parsed.triangleCount).toBe(12);
  });

  test('vertices uzunluğu 12*9 = 108', () => {
    expect(parsed.vertices.length).toBe(108);
  });

  test('normals uzunluğu vertices ile aynı', () => {
    expect(parsed.normals.length).toBe(parsed.vertices.length);
  });

  test('ilk üçgenin ilk vertex koordinatları (0,0,0)', () => {
    expect(parsed.vertices[0]).toBe(0);
    expect(parsed.vertices[1]).toBe(0);
    expect(parsed.vertices[2]).toBe(0);
  });
});

describe('veFEAParseSTL — ASCII', () => {
  var parsed;
  beforeAll(() => {
    parsed = veFEAParseSTL(buildAsciiSTLCube());
  });

  test('triangleCount = 12', () => {
    expect(parsed.triangleCount).toBe(12);
  });

  test('vertices uzunluğu 12*9 = 108', () => {
    expect(parsed.vertices.length).toBe(108);
  });
});

describe('veFEAParseSTL — Geçersiz girişler', () => {
  test('null girişi için null döner', () => {
    expect(veFEAParseSTL(null)).toBeNull();
    expect(veFEAParseSTL(undefined)).toBeNull();
  });

  test('boş string için 0 üçgen', () => {
    var p = veFEAParseSTL('');
    expect(p.triangleCount).toBe(0);
  });
});

// ────────────────────────────────────────────────────────────────────────────
describe('veFEAComputeMeshStats — 10×10×10 küp', () => {
  test('binary küp: V = 1000 mm³', () => {
    var stats = veFEAComputeMeshStats(veFEAParseSTL(buildBinarySTLCube()));
    expect(stats.volume).toBeCloseTo(1000, 1);
  });

  test('binary küp: A = 600 mm²', () => {
    var stats = veFEAComputeMeshStats(veFEAParseSTL(buildBinarySTLCube()));
    expect(stats.surfaceArea).toBeCloseTo(600, 1);
  });

  test('binary küp: bbox = {10,10,10}', () => {
    var stats = veFEAComputeMeshStats(veFEAParseSTL(buildBinarySTLCube()));
    expect(stats.bbox.x).toBeCloseTo(10, 4);
    expect(stats.bbox.y).toBeCloseTo(10, 4);
    expect(stats.bbox.z).toBeCloseTo(10, 4);
  });

  test('ASCII küp aynı hacmi verir', () => {
    var stats = veFEAComputeMeshStats(veFEAParseSTL(buildAsciiSTLCube()));
    expect(stats.volume).toBeCloseTo(1000, 1);
    expect(stats.surfaceArea).toBeCloseTo(600, 1);
  });

  test('boş mesh: V=0, A=0', () => {
    var stats = veFEAComputeMeshStats({ vertices: new Float32Array(0), normals: new Float32Array(0), triangleCount: 0 });
    expect(stats.volume).toBe(0);
    expect(stats.surfaceArea).toBe(0);
  });
});

// ────────────────────────────────────────────────────────────────────────────
describe('Base64 roundtrip', () => {
  test('encode + decode = identity (binary STL)', () => {
    var orig = buildBinarySTLCube();
    var b64 = veFEAArrayBufferToBase64(orig);
    var restored = veFEABase64ToArrayBuffer(b64);
    expect(restored.byteLength).toBe(orig.byteLength);
    var a = new Uint8Array(orig);
    var b = new Uint8Array(restored);
    for(var i = 0; i < a.length; i++) expect(b[i]).toBe(a[i]);
  });

  test('roundtrip sonrası STL hâlâ parse edilebilir', () => {
    var orig = buildBinarySTLCube();
    var b64 = veFEAArrayBufferToBase64(orig);
    var restored = veFEABase64ToArrayBuffer(b64);
    var parsed = veFEAParseSTL(restored);
    expect(parsed.triangleCount).toBe(12);
  });
});

// ────────────────────────────────────────────────────────────────────────────
describe('veFEAApplySTL — köprü davranışı', () => {
  beforeEach(() => {
    Object.keys(veFEAViewerRegistry).forEach((k) => delete veFEAViewerRegistry[k]);
    global.nodes = [];
    global.showToast = jest.fn();
    global.showNodeProperties = jest.fn();
    global.saveState = jest.fn();
  });

  test('viewer kayıtlı olmasa bile node.data.geometry güncellenir', () => {
    global.nodes = [{ id: 'c1', data: {} }];
    veFEAApplySTL('c1', buildBinarySTLCube(), 'cube.stl');
    expect(global.nodes[0].data.geometry).toBeDefined();
    expect(global.nodes[0].data.geometry.type).toBe('stl');
    expect(global.nodes[0].data.geometry.triangleCount).toBe(12);
    expect(global.nodes[0].data.geometry.sourceLabel).toBe('cube.stl');
    expect(global.nodes[0].data.geometry.volume).toBeCloseTo(1000, 1);
  });

  test('küçük dosya rawDataB64 ile saklanır', () => {
    global.nodes = [{ id: 'c2', data: {} }];
    veFEAApplySTL('c2', buildBinarySTLCube(), 'cube.stl');
    expect(global.nodes[0].data.geometry.rawDataB64).toBeDefined();
    expect(global.nodes[0].data.geometry.rawDataB64.length).toBeGreaterThan(0);
    expect(global.nodes[0].data.geometry.persistNote).toBeNull();
  });

  test('geçersiz buffer error toast atar', () => {
    var bad = new ArrayBuffer(10);
    veFEAApplySTL('c3', bad, 'bad.stl');
    expect(global.showToast).toHaveBeenCalled();
    var call = global.showToast.mock.calls.find((c) => c[1] === 'error');
    expect(call).toBeDefined();
  });

  test('saveState çağrılır', () => {
    global.nodes = [{ id: 'c4', data: {} }];
    veFEAApplySTL('c4', buildBinarySTLCube(), 'cube.stl');
    expect(global.saveState).toHaveBeenCalled();
  });
});

// ────────────────────────────────────────────────────────────────────────────
describe('veFEAOnSTLFileSelected', () => {
  test('null input ile sessiz çıkar', () => {
    expect(() => veFEAOnSTLFileSelected(null, 'x')).not.toThrow();
  });

  test('boş files listesi ile sessiz çıkar', () => {
    expect(() => veFEAOnSTLFileSelected({ files: [] }, 'x')).not.toThrow();
  });
});

// ────────────────────────────────────────────────────────────────────────────
describe('cp-fea.js STL UI rendering', () => {
  test('STL Yükle butonu ve gizli file input render edilir', () => {
    var node = { id: 'cF', data: {} };
    var html = getFEAGeometryPropertiesHTML(node);
    expect(html).toMatch(/STL Yükle/);
    expect(html).toMatch(/id="ve-fea-stl-input-cF"/);
    expect(html).toMatch(/accept="\.stl"/);
    expect(html).toMatch(/veFEAOnSTLFileSelected/);
  });

  test('STL geometri yüklüyken üçgen sayısı durum tablosunda gösterilir', () => {
    var node = {
      id: 'cG',
      data: {
        geometry: {
          type: 'stl',
          sourceLabel: 'gear.stl',
          triangleCount: 12345,
          volume: 1000,
          surfaceArea: 600,
          bbox: { x: 10, y: 10, z: 10 }
        }
      }
    };
    var html = getFEAGeometryPropertiesHTML(node);
    expect(html).toMatch(/gear\.stl/);
    expect(html).toMatch(/Üçgen sayısı/);
    // 12345 Türkçe locale'da "12.345" → noktalı binlik
    expect(html).toMatch(/12[\.,]?345/);
  });

  test('persistNote varsa uyarı banner render edilir', () => {
    var node = {
      id: 'cH',
      data: {
        geometry: {
          type: 'stl',
          sourceLabel: 'big.stl',
          triangleCount: 5,
          volume: 100,
          surfaceArea: 60,
          bbox: { x: 1, y: 1, z: 1 },
          persistNote: 'Dosya 15.0 MB — proje kaydında saklanmıyor, yeniden yükleyin.'
        }
      }
    };
    var html = getFEAGeometryPropertiesHTML(node);
    expect(html).toMatch(/proje kaydında saklanmıyor/);
  });
});
