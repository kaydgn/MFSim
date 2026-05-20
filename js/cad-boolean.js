// ============================================================================
// CAD BOOLEAN — Manifold-3D ile gerçek CSG (union / difference / intersect)
// ============================================================================
// Manifold (Apache-2.0, Emmett Lalish / Google) topolojik açıdan robust 3D
// boolean kütüphanesi. Native built-in primitifleri (cube, cylinder, sphere)
// + 2D extrude'ları kullanır; non-trivial primitifler (shaft, ibeam, ...) için
// Three.js mesh'ini vertex-welding ile manifold mesh'e çevirir.
//
// Public API:
//   veCADBoolEnsureModule()        → Promise (modül yüklenmiş mi?)
//   veCADBoolIsReady()             → bool (sync, modül hazır mı?)
//   veCADBoolApplyFeatures(feats)  → { vertices, normals, triangleCount }
//                                     (feats: cad-engine feature listesi)
//   veCADBoolDispose()             → modülü serbest bırak (gc, test için)
//
// Internal:
//   _veCADBoolFeatureToManifold(f) → manifold.Manifold (transform uygulanmış)
//   _veCADBoolManifoldToParsed(m)  → { vertices, normals, triangleCount }
// ============================================================================

var _veCADBoolModule = null;       // yüklendikten sonra manifold modülü
var _veCADBoolLoadPromise = null;  // yükleme devam ediyorsa promise

function veCADBoolIsReady() {
  return _veCADBoolModule !== null;
}

// ─── Modülü yükle (lazy + idempotent) ──────────────────────────────────────
// 1. globalThis.veCADManifoldLoader var mı? (vendor/manifold/manifold-bundle.js
//    inline'da expose etmiş olmalı)
// 2. WASM bytes: window.__feaInline.manifoldWasm (base64, monolitik) veya
//    fetch('vendor/manifold/manifold.wasm') (dev mode).
// 3. Module({ wasmBinary }) çağır, .setup() ile TBB init et.
function veCADBoolEnsureModule() {
  if (_veCADBoolModule) return Promise.resolve(_veCADBoolModule);
  if (_veCADBoolLoadPromise) return _veCADBoolLoadPromise;

  if (typeof veCADManifoldLoader !== 'function' && (typeof globalThis === 'undefined' || typeof globalThis.veCADManifoldLoader !== 'function')) {
    return Promise.reject(new Error('Manifold loader yok — vendor/manifold/manifold-bundle.js yüklenmedi.'));
  }
  var loader = (typeof veCADManifoldLoader === 'function') ? veCADManifoldLoader : globalThis.veCADManifoldLoader;

  _veCADBoolLoadPromise = (function() {
    return _veCADBoolFetchWasmBytes().then(function(wasmBytes) {
      return loader({ wasmBinary: wasmBytes });
    }).then(function(mod) {
      if (mod && typeof mod.setup === 'function') {
        try { mod.setup(); } catch(e) { console.warn('[CAD Bool] setup uyarı:', e); }
      }
      _veCADBoolModule = mod;
      _veCADBoolLoadPromise = null;
      return mod;
    }).catch(function(err) {
      _veCADBoolLoadPromise = null;
      throw err;
    });
  })();
  return _veCADBoolLoadPromise;
}

// ─── WASM bytes elde et ────────────────────────────────────────────────────
function _veCADBoolFetchWasmBytes() {
  // 1) Monolitik HTML: base64 inline
  if (typeof window !== 'undefined' && window.__feaInline && window.__feaInline.manifoldWasm) {
    if (typeof veFEABase64ToArrayBuffer !== 'function') {
      return Promise.reject(new Error('veFEABase64ToArrayBuffer yok'));
    }
    var bytes = veFEABase64ToArrayBuffer(window.__feaInline.manifoldWasm);
    return Promise.resolve(new Uint8Array(bytes));
  }
  // 2) Dev mode: fetch
  if (typeof fetch !== 'function') {
    return Promise.reject(new Error('fetch yok ve inline WASM da yok'));
  }
  return fetch('vendor/manifold/manifold.wasm').then(function(r) {
    if (!r.ok) throw new Error('manifold.wasm fetch başarısız: ' + r.status);
    return r.arrayBuffer();
  }).then(function(buf) { return new Uint8Array(buf); });
}

function veCADBoolDispose() {
  // Manifold instance'larını silmek runtime'da zaten gc'leniyor; modül
  // referansını bırakırız. Yeniden Ensure çağrılırsa yeni instance oluşur.
  _veCADBoolModule = null;
  _veCADBoolLoadPromise = null;
}

// ─── Feature'ı manifold.Manifold'e çevir ───────────────────────────────────
// Native built-in (cube, cylinder, sphere) varsa onu kullan (daha güvenilir).
// Yoksa Three.js mesh'ini tessellate → vertex weld → manifold.Mesh → Manifold.
function _veCADBoolFeatureToManifold(feature) {
  if (!_veCADBoolModule) throw new Error('manifold modülü yüklenmedi');
  if (typeof THREE === 'undefined') throw new Error('THREE yüklenmedi');
  var M = _veCADBoolModule.Manifold;
  var Mesh = _veCADBoolModule.Mesh;

  var native = _veCADBoolBuildNativePrimitive(feature.type, feature.params);
  var manifoldObj;
  if (native) {
    manifoldObj = native;
  } else {
    // Three.js fallback: primitif inşa et + vertex welding ile manifold mesh
    if (typeof veFEABuildPrimitiveMesh !== 'function') {
      throw new Error('veFEABuildPrimitiveMesh yok');
    }
    var prim = veFEABuildPrimitiveMesh(feature.type, feature.params);
    if (!prim) throw new Error('Primitif inşa edilemedi: ' + feature.type);
    prim.updateMatrixWorld(true);

    // Triangle soup (flat xyz) — local space (transform sonra uygulanır)
    var rawPos = [];
    _veCADBoolCollectMeshTriangles(prim, rawPos);

    // Three.js geometrilerini dispose et
    prim.traverse(function(o) {
      if (o.geometry && o.geometry.dispose) try { o.geometry.dispose(); } catch(e) {}
      if (o.material) {
        var mats = Array.isArray(o.material) ? o.material : [o.material];
        mats.forEach(function(m) { if (m.dispose) try { m.dispose(); } catch(e) {} });
      }
    });

    var welded = _veCADBoolWeldVertices(rawPos, 1e-5);
    var meshObj = new Mesh({
      numProp: 3,
      vertProperties: welded.vertProperties,
      triVerts: welded.triVerts
    });
    manifoldObj = new M(meshObj);
  }

  // Transform uygula: önce rotasyon (Euler XYZ intrinsic — Three.js default
  // ile uyumlu), sonra translate. Manifold rotate() derece alır; Three.js
  // ile aynı görsel sonucu vermesi için sırayla X, Y, Z eksen rotasyonu
  // uygulanır (her çağrı manifold'un local matrix'iyle birleşir).
  var t = feature.transform || {};
  if (t.rx) manifoldObj = manifoldObj.rotate([t.rx, 0, 0]);
  if (t.ry) manifoldObj = manifoldObj.rotate([0, t.ry, 0]);
  if (t.rz) manifoldObj = manifoldObj.rotate([0, 0, t.rz]);
  if (t.tx || t.ty || t.tz) {
    manifoldObj = manifoldObj.translate([t.tx || 0, t.ty || 0, t.tz || 0]);
  }
  return manifoldObj;
}

// ─── Native manifold primitif (cube, cylinder, sphere) ─────────────────────
function _veCADBoolBuildNativePrimitive(type, params) {
  if (!_veCADBoolModule) return null;
  var M = _veCADBoolModule.Manifold;
  var p = (typeof veFEANormalizePrimitiveParams === 'function')
    ? veFEANormalizePrimitiveParams(type, params) : params;
  if (!p) return null;

  if (type === 'box') {
    // Three.js BoxGeometry merkez (0,0,0)'da; manifold cube center=true ile aynı
    return M.cube([p.width, p.height, p.depth], true);
  }
  if (type === 'cylinder') {
    // Three.js cylinder Y-ekseni; manifold cylinder Z-ekseni
    // Y-axis cylinder elde etmek için: Z-cylinder yap, sonra X ekseni etrafında
    // -90° döndür (Z → Y). center=true ile (0,0,0) merkezli olur.
    var cyl = M.cylinder(p.height, p.radius, p.radius, p.segments | 0, true);
    return cyl.rotate([-90, 0, 0]);
  }
  if (type === 'sphere') {
    return M.sphere(p.radius, p.segments | 0);
  }
  if (type === 'cone') {
    // Three.js: CylinderGeometry(topR, botR, h, segments). Y-axis.
    // Manifold: cylinder(h, lowR, highR, segments, center) Z-axis.
    // Three.js bottomR = manifold lowR (Z<0), Three.js topR = manifold highR (Z>0)
    var c = M.cylinder(p.height, p.bottomRadius, p.topRadius, p.segments | 0, true);
    return c.rotate([-90, 0, 0]);
  }
  if (type === 'shaft') {
    // İçi boş silindir: dış silindir - iç silindir
    var outer = M.cylinder(p.length, p.outerRadius, p.outerRadius, p.segments | 0, true).rotate([-90, 0, 0]);
    if (p.innerRadius > 0) {
      var inner = M.cylinder(p.length + 2, p.innerRadius, p.innerRadius, p.segments | 0, true).rotate([-90, 0, 0]);
      return outer.subtract(inner);
    }
    return outer;
  }
  // Diğer tipler (hemisphere, torus, ibeam, lbracket, rectTube) → Three.js fallback
  return null;
}

// ─── Three.js mesh hiyerarşisinden ham triangle soup çıkar (local space) ──
function _veCADBoolCollectMeshTriangles(obj3D, outFlat) {
  // Mesh'i traverse et; index'li/non-index'li BufferGeometry'leri normalize et.
  // obj3D'nin kendi local transform'unu uygulamamak için identity matrix kullanıyoruz —
  // çünkü feature transform'unu manifold sonra uygulayacak.
  obj3D.updateMatrixWorld(true);
  obj3D.traverse(function(child) {
    if (!child.isMesh) return;
    var geo = child.geometry;
    if (!geo || !geo.attributes || !geo.attributes.position) return;
    var pos = geo.attributes.position;
    var idx = geo.index;
    // Child'ın obj3D'ye göre local matrix'i (eğer mesh root değilse — örn. shaft Group içi)
    child.updateMatrixWorld(true);
    var mat = new THREE.Matrix4().copy(child.matrixWorld);
    // obj3D'nin matrix'ini çıkar — sadece child'ın yerel offsetini al
    if (obj3D.matrixWorld) {
      mat.premultiply(new THREE.Matrix4().copy(obj3D.matrixWorld).invert());
    }

    var triCount = idx ? (idx.count / 3) : (pos.count / 3);
    for (var t = 0; t < triCount; t++) {
      for (var c = 0; c < 3; c++) {
        var i = idx ? idx.getX(t * 3 + c) : (t * 3 + c);
        var v = new THREE.Vector3(pos.getX(i), pos.getY(i), pos.getZ(i)).applyMatrix4(mat);
        outFlat.push(v.x, v.y, v.z);
      }
    }
  });
}

// ─── Vertex welding (tolerance-based spatial hash) ─────────────────────────
function _veCADBoolWeldVertices(flatPos, tol) {
  var SCALE = 1 / (tol || 1e-5);
  var map = new Map();
  var verts = [];
  var indices = [];
  var triCount = flatPos.length / 9;
  for (var t = 0; t < triCount; t++) {
    var triLocalIds = [];
    for (var c = 0; c < 3; c++) {
      var i = t * 9 + c * 3;
      var x = flatPos[i], y = flatPos[i+1], z = flatPos[i+2];
      var kx = Math.round(x * SCALE);
      var ky = Math.round(y * SCALE);
      var kz = Math.round(z * SCALE);
      var key = kx + '|' + ky + '|' + kz;
      var idx = map.get(key);
      if (idx === undefined) {
        idx = verts.length / 3;
        verts.push(x, y, z);
        map.set(key, idx);
      }
      triLocalIds.push(idx);
    }
    // Dejenere üçgeni atla (welding sonrası 3 unique vert kalmadıysa)
    if (triLocalIds[0] !== triLocalIds[1] &&
        triLocalIds[1] !== triLocalIds[2] &&
        triLocalIds[0] !== triLocalIds[2]) {
      indices.push(triLocalIds[0], triLocalIds[1], triLocalIds[2]);
    }
  }
  return {
    vertProperties: new Float32Array(verts),
    triVerts:       new Uint32Array(indices)
  };
}

// ─── Manifold sonucu → parsed (vertices, normals, triangleCount) ───────────
// Mevcut FEA pipeline'ı non-indexed (her üçgen 9 float) bekliyor; manifold
// indexed verir → expand et + per-face normal hesapla.
function _veCADBoolManifoldToParsed(manifoldObj) {
  var mesh = manifoldObj.getMesh();
  var vp = mesh.vertProperties;  // Float32Array, numProp=3 → her vertex 3 float
  var tv = mesh.triVerts;        // Uint32Array, 3 per triangle
  var triCount = tv.length / 3;

  var verts = new Float32Array(triCount * 9);
  var normals = new Float32Array(triCount * 9);
  for (var t = 0; t < triCount; t++) {
    var i0 = tv[t * 3] * 3, i1 = tv[t * 3 + 1] * 3, i2 = tv[t * 3 + 2] * 3;
    var x0 = vp[i0],   y0 = vp[i0+1], z0 = vp[i0+2];
    var x1 = vp[i1],   y1 = vp[i1+1], z1 = vp[i1+2];
    var x2 = vp[i2],   y2 = vp[i2+1], z2 = vp[i2+2];

    // Face normal (CCW): (v1-v0) × (v2-v0)
    var ex = x1 - x0, ey = y1 - y0, ez = z1 - z0;
    var fx = x2 - x0, fy = y2 - y0, fz = z2 - z0;
    var nx = ey * fz - ez * fy;
    var ny = ez * fx - ex * fz;
    var nz = ex * fy - ey * fx;
    var nl = Math.sqrt(nx*nx + ny*ny + nz*nz);
    if (nl > 1e-12) { nx /= nl; ny /= nl; nz /= nl; }

    var o = t * 9;
    verts[o]   = x0; verts[o+1] = y0; verts[o+2] = z0;
    verts[o+3] = x1; verts[o+4] = y1; verts[o+5] = z1;
    verts[o+6] = x2; verts[o+7] = y2; verts[o+8] = z2;
    for (var c = 0; c < 3; c++) {
      normals[o + c*3]     = nx;
      normals[o + c*3 + 1] = ny;
      normals[o + c*3 + 2] = nz;
    }
  }
  return { vertices: verts, normals: normals, triangleCount: triCount };
}

// ─── Feature listesini sırayla booleanlayıp parsed mesh döndür ─────────────
// İlk feature taban (her zaman 'add' davranır). Sonraki feature'ların op'una
// göre union/subtract/intersect uygulanır.
function veCADBoolApplyFeatures(features) {
  if (!_veCADBoolModule) throw new Error('Manifold modülü yüklenmedi (önce ensureModule)');
  if (!features || features.length === 0) {
    return { vertices: new Float32Array(0), normals: new Float32Array(0), triangleCount: 0 };
  }
  // Görünmez feature'ları atla
  var visible = features.filter(function(f) { return f.visible !== false; });
  if (visible.length === 0) {
    return { vertices: new Float32Array(0), normals: new Float32Array(0), triangleCount: 0 };
  }

  var result = null;
  var disposeList = [];
  try {
    for (var i = 0; i < visible.length; i++) {
      var f = visible[i];
      var mf;
      try {
        mf = _veCADBoolFeatureToManifold(f);
      } catch (e) {
        console.warn('[CAD Bool] Feature manifold inşası başarısız (atlandı):', f.name, e.message);
        continue;
      }
      disposeList.push(mf);
      if (!result) {
        result = mf;
        continue;
      }
      var newResult;
      if (f.op === 'sub') {
        newResult = result.subtract(mf);
      } else if (f.op === 'intersect') {
        newResult = result.intersect(mf);
      } else {
        newResult = result.add(mf);
      }
      disposeList.push(newResult);
      result = newResult;
    }
    if (!result) return { vertices: new Float32Array(0), normals: new Float32Array(0), triangleCount: 0 };

    var parsed = _veCADBoolManifoldToParsed(result);
    return parsed;
  } finally {
    // Manifold C++ heap'inde tutulan referansları serbest bırak
    disposeList.forEach(function(m) {
      if (m && typeof m.delete === 'function') {
        try { m.delete(); } catch(e) {}
      }
    });
  }
}

// Test environment için export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    veCADBoolEnsureModule: veCADBoolEnsureModule,
    veCADBoolIsReady: veCADBoolIsReady,
    veCADBoolApplyFeatures: veCADBoolApplyFeatures,
    veCADBoolDispose: veCADBoolDispose
  };
}
