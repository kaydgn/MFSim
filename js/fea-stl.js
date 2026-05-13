// ============================================================================
// STL DOSYA İMPORT'U (Binary + ASCII)
// ============================================================================
// Three.js'in STLLoader'ı 0.149'da ESM-only (jsm); UMD bundle ile çakışmaz.
// Bu modül her iki STL formatını da minimal ve test edilebilir biçimde
// işler. Üçgen ağı için hacim divergence teoremi ile, yüzey alanı çapraz
// çarpım ile hesaplanır. Kapalı (watertight) mesh varsayılır.
//
// Public API:
//   veFEAIsBinarySTL(buffer)             → boolean
//   veFEAParseSTL(bufferOrString)        → { vertices, normals, triangleCount }
//   veFEAComputeMeshStats(parsed)        → { volume, surfaceArea, bbox }
//   veFEABuildSTLMesh(parsed)            → THREE.Mesh (Three.js yoksa null)
//   veFEAArrayBufferToBase64(buf)        → string
//   veFEABase64ToArrayBuffer(b64)        → ArrayBuffer
// ============================================================================

// Binary STL tespit: dosya boyutu = 84 + 50*N koşulu en sağlam yöntemdir.
// "solid" başlığı binary'de de geçebilir (üreticiye göre değişir),
// dolayısıyla string aramaya güvenmiyoruz.
function veFEAIsBinarySTL(buffer) {
  if(!buffer || buffer.byteLength < 84) return false;
  var view = new DataView(buffer);
  var triangleCount = view.getUint32(80, true);
  var expectedSize = 84 + 50 * triangleCount;
  return buffer.byteLength === expectedSize;
}

function _veFEAParseBinarySTL(buffer) {
  var view = new DataView(buffer);
  var triangleCount = view.getUint32(80, true);
  var vertices = new Float32Array(triangleCount * 9);
  var normals  = new Float32Array(triangleCount * 9);
  var offset = 84;
  for(var i = 0; i < triangleCount; i++) {
    var nx = view.getFloat32(offset, true);
    var ny = view.getFloat32(offset + 4, true);
    var nz = view.getFloat32(offset + 8, true);
    offset += 12;
    for(var j = 0; j < 3; j++) {
      var x = view.getFloat32(offset, true);
      var y = view.getFloat32(offset + 4, true);
      var z = view.getFloat32(offset + 8, true);
      var idx = i * 9 + j * 3;
      vertices[idx]     = x;
      vertices[idx + 1] = y;
      vertices[idx + 2] = z;
      normals[idx]      = nx;
      normals[idx + 1]  = ny;
      normals[idx + 2]  = nz;
      offset += 12;
    }
    offset += 2; // attribute byte count (genellikle 0)
  }
  return { vertices: vertices, normals: normals, triangleCount: triangleCount };
}

function _veFEAParseAsciiSTL(text) {
  var vertices = [];
  var normals = [];
  var currentNormal = [0, 0, 0];
  var triangleCount = 0;
  var vertsInFacet = 0;
  var lines = text.split(/\r?\n/);
  for(var i = 0; i < lines.length; i++) {
    var line = lines[i].trim();
    if(!line) continue;
    if(line.indexOf('facet normal') === 0) {
      var p = line.split(/\s+/);
      currentNormal = [parseFloat(p[2]), parseFloat(p[3]), parseFloat(p[4])];
      if(!isFinite(currentNormal[0])) currentNormal[0] = 0;
      if(!isFinite(currentNormal[1])) currentNormal[1] = 0;
      if(!isFinite(currentNormal[2])) currentNormal[2] = 0;
      vertsInFacet = 0;
    } else if(line.indexOf('vertex') === 0) {
      var q = line.split(/\s+/);
      vertices.push(parseFloat(q[1]), parseFloat(q[2]), parseFloat(q[3]));
      normals.push(currentNormal[0], currentNormal[1], currentNormal[2]);
      vertsInFacet++;
    } else if(line.indexOf('endfacet') === 0) {
      if(vertsInFacet === 3) triangleCount++;
    }
  }
  return {
    vertices: new Float32Array(vertices),
    normals: new Float32Array(normals),
    triangleCount: triangleCount
  };
}

function veFEAParseSTL(input) {
  if(input == null) return null;
  // String — ASCII STL
  if(typeof input === 'string') {
    return _veFEAParseAsciiSTL(input);
  }
  // ArrayBuffer veya TypedArray
  var ab;
  if(input instanceof ArrayBuffer) {
    ab = input;
  } else if(input.buffer instanceof ArrayBuffer) {
    ab = input.buffer.slice(input.byteOffset || 0, (input.byteOffset || 0) + input.byteLength);
  } else {
    return null;
  }
  if(veFEAIsBinarySTL(ab)) return _veFEAParseBinarySTL(ab);
  // Binary değilse ASCII varsay — string olarak decode et
  var text;
  if(typeof TextDecoder !== 'undefined') {
    text = new TextDecoder('utf-8').decode(ab);
  } else {
    var bytes = new Uint8Array(ab);
    text = '';
    for(var i = 0; i < bytes.length; i++) text += String.fromCharCode(bytes[i]);
  }
  return _veFEAParseAsciiSTL(text);
}

// ─── İstatistikler ─────────────────────────────────────────────────────────
// Hacim: divergence teoremi (kapalı yüzey için)
//   V = (1/6) Σ (v1 · (v2 × v3))
// Yüzey alanı: her üçgenin (1/2)|(v2-v1) × (v3-v1)| toplamı.
// Bounding box: tüm vertex'lerin min/max koordinatları.
function veFEAComputeMeshStats(parsed) {
  if(!parsed || !parsed.vertices || parsed.triangleCount === 0) {
    return { volume: 0, surfaceArea: 0, bbox: { x: 0, y: 0, z: 0 } };
  }
  var v = parsed.vertices;
  var n = parsed.triangleCount;
  var volume = 0;
  var surfaceArea = 0;
  var minX = Infinity, minY = Infinity, minZ = Infinity;
  var maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;

  for(var i = 0; i < n; i++) {
    var o = i * 9;
    var x1 = v[o],     y1 = v[o+1], z1 = v[o+2];
    var x2 = v[o+3],   y2 = v[o+4], z2 = v[o+5];
    var x3 = v[o+6],   y3 = v[o+7], z3 = v[o+8];

    if(x1 < minX) minX = x1; if(x1 > maxX) maxX = x1;
    if(x2 < minX) minX = x2; if(x2 > maxX) maxX = x2;
    if(x3 < minX) minX = x3; if(x3 > maxX) maxX = x3;
    if(y1 < minY) minY = y1; if(y1 > maxY) maxY = y1;
    if(y2 < minY) minY = y2; if(y2 > maxY) maxY = y2;
    if(y3 < minY) minY = y3; if(y3 > maxY) maxY = y3;
    if(z1 < minZ) minZ = z1; if(z1 > maxZ) maxZ = z1;
    if(z2 < minZ) minZ = z2; if(z2 > maxZ) maxZ = z2;
    if(z3 < minZ) minZ = z3; if(z3 > maxZ) maxZ = z3;

    // Signed tetra volume from origin (kapalı mesh için toplam ±V verir)
    volume += (x1 * (y2 * z3 - y3 * z2) + x2 * (y3 * z1 - y1 * z3) + x3 * (y1 * z2 - y2 * z1)) / 6;

    // Triangle area = |a × b| / 2
    var ax = x2 - x1, ay = y2 - y1, az = z2 - z1;
    var bx = x3 - x1, by = y3 - y1, bz = z3 - z1;
    var cx = ay * bz - az * by;
    var cy = az * bx - ax * bz;
    var cz = ax * by - ay * bx;
    surfaceArea += Math.sqrt(cx * cx + cy * cy + cz * cz) / 2;
  }

  return {
    volume: Math.abs(volume),
    surfaceArea: surfaceArea,
    bbox: { x: maxX - minX, y: maxY - minY, z: maxZ - minZ }
  };
}

// ─── Three.js mesh inşası ──────────────────────────────────────────────────
function veFEABuildSTLMesh(parsed) {
  if(typeof THREE === 'undefined' || !parsed || parsed.triangleCount === 0) return null;
  var geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(parsed.vertices, 3));
  if(parsed.normals && parsed.normals.length === parsed.vertices.length) {
    geometry.setAttribute('normal', new THREE.BufferAttribute(parsed.normals, 3));
  } else {
    geometry.computeVertexNormals();
  }
  var material = new THREE.MeshStandardMaterial({
    color: 0x3b82f6,
    metalness: 0.3,
    roughness: 0.55,
    flatShading: true,
    side: THREE.DoubleSide
  });
  var mesh = new THREE.Mesh(geometry, material);
  mesh.userData.feaStl = true;
  return mesh;
}

// ─── Base64 yardımcıları (state.js save/load için) ──────────────────────────
function veFEAArrayBufferToBase64(buffer) {
  var bytes = (buffer instanceof Uint8Array) ? buffer : new Uint8Array(buffer);
  // 32 KB parçalar — Argument count limitlerini aşmamak için
  var chunkSize = 0x8000;
  var binary = '';
  for(var i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, Math.min(i + chunkSize, bytes.length)));
  }
  // btoa node 16+'da global; yoksa Buffer
  if(typeof btoa === 'function') return btoa(binary);
  return Buffer.from(binary, 'binary').toString('base64');
}

function veFEABase64ToArrayBuffer(b64) {
  var binary;
  if(typeof atob === 'function') binary = atob(b64);
  else binary = Buffer.from(b64, 'base64').toString('binary');
  var buffer = new ArrayBuffer(binary.length);
  var bytes = new Uint8Array(buffer);
  for(var i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return buffer;
}
