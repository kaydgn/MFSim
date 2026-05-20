// ============================================================================
// CAD ENGINE — Çoklu Primitif Kompozisyonu + Mesh Tessellation
// ============================================================================
// Kullanıcının CAD Editörü modal'ında inşa ettiği "feature" listesini yönetir.
// Her feature bir primitif (box, cylinder, shaft, ...) + transform (pozisyon
// + Euler rotasyon) + boolean op (şimdilik sadece 'add') tutar.
//
// Faz-1 (bu sürüm): Çoklu primitif ADDITION (mesh union via concatenation).
// Faz-2 (sonraki): Gerçek boolean CSG (üç-bvh-csg veya manifold-3d ile).
// Faz-3 (sonraki): Replicad/OpenCascade.js BREP + sketch + extrude + fillet.
//
// Public API:
//   veCADCreateModel()                       → { features: [], version: 1 }
//   veCADAddFeature(model, type, params)     → eklenen feature objesi
//   veCADRemoveFeature(model, featureId)     → boolean (silindi mi)
//   veCADUpdateFeature(model, id, updates)   → boolean
//   veCADGetFeature(model, featureId)        → feature | null
//   veCADBuildScene(model)                   → THREE.Group (her feature alt-grup)
//   veCADTessellate(model)                   → { vertices, normals, triangleCount }
//   veCADComputeStats(model)                 → { volume, surfaceArea, bbox }
//   veCADSerialize(model)                    → JSON-safe object (persist için)
//   veCADDeserialize(obj)                    → model (validate + migrate)
//   veCADHasBoolean()                        → false (Faz-2'de true)
//   veCADBackendLabel()                      → 'Three.js (Çoklu Primitif)' vs.
// ============================================================================

var VE_CAD_VERSION = 1;
var _veCADFeatureCounter = 0;

// ─── Model oluştur ─────────────────────────────────────────────────────────
function veCADCreateModel() {
  return { version: VE_CAD_VERSION, features: [] };
}

// ─── Backend bilgisi (UI'de göstermek için) ────────────────────────────────
function veCADHasBoolean() { return false; }
function veCADBackendLabel() { return 'Three.js (çoklu primitif kompozisyonu)'; }

// ─── Feature ID üretici ────────────────────────────────────────────────────
function _veCADGenFeatureId() {
  _veCADFeatureCounter++;
  return 'feat_' + Date.now().toString(36) + '_' + _veCADFeatureCounter;
}

// ─── Varsayılan transform ──────────────────────────────────────────────────
function _veCADDefaultTransform() {
  return { tx: 0, ty: 0, tz: 0, rx: 0, ry: 0, rz: 0 };
}

// ─── Otomatik isim üret (Box1, Cylinder2, ...) ─────────────────────────────
function _veCADAutoName(model, type) {
  var label = (typeof veFEAPrimitiveLabel === 'function') ? veFEAPrimitiveLabel(type) : type;
  var count = 0;
  for (var i = 0; i < model.features.length; i++) {
    if (model.features[i].type === type) count++;
  }
  return label + ' ' + (count + 1);
}

// ─── Feature ekle ──────────────────────────────────────────────────────────
// type: 'box' | 'cylinder' | 'shaft' | 'sphere' | 'hemisphere' | 'torus' |
//       'cone' | 'lbracket' | 'ibeam' | 'rectTube'
// params: { ... } (boş ise veFEAPrimitiveDefaults kullanılır)
function veCADAddFeature(model, type, params) {
  if (!model || !model.features) return null;
  var defaults = (typeof veFEAPrimitiveDefaults === 'function') ? veFEAPrimitiveDefaults(type) : {};
  if (!defaults) return null;
  var merged = {};
  Object.keys(defaults).forEach(function(k) { merged[k] = defaults[k]; });
  if (params) Object.keys(params).forEach(function(k) { merged[k] = params[k]; });

  var feature = {
    id: _veCADGenFeatureId(),
    type: type,
    op: 'add',   // Faz-1: sadece 'add'. Faz-2: 'sub' | 'intersect'
    params: merged,
    transform: _veCADDefaultTransform(),
    name: _veCADAutoName(model, type),
    visible: true
  };
  model.features.push(feature);
  return feature;
}

// ─── Feature sil ───────────────────────────────────────────────────────────
function veCADRemoveFeature(model, featureId) {
  if (!model || !model.features) return false;
  for (var i = 0; i < model.features.length; i++) {
    if (model.features[i].id === featureId) {
      model.features.splice(i, 1);
      return true;
    }
  }
  return false;
}

// ─── Feature güncelle (params veya transform değişti) ──────────────────────
function veCADUpdateFeature(model, featureId, updates) {
  var f = veCADGetFeature(model, featureId);
  if (!f) return false;
  if (updates.params)    { Object.keys(updates.params).forEach(function(k) { f.params[k] = updates.params[k]; }); }
  if (updates.transform) { Object.keys(updates.transform).forEach(function(k) { f.transform[k] = updates.transform[k]; }); }
  if (typeof updates.name === 'string')    f.name = updates.name;
  if (typeof updates.visible === 'boolean') f.visible = updates.visible;
  if (typeof updates.op === 'string')      f.op = updates.op;
  return true;
}

// ─── Feature bul ───────────────────────────────────────────────────────────
function veCADGetFeature(model, featureId) {
  if (!model || !model.features) return null;
  for (var i = 0; i < model.features.length; i++) {
    if (model.features[i].id === featureId) return model.features[i];
  }
  return null;
}

// ─── Feature sıralamasını değiştir (yukarı/aşağı taşı) ─────────────────────
function veCADMoveFeature(model, featureId, direction) {
  if (!model || !model.features) return false;
  var idx = -1;
  for (var i = 0; i < model.features.length; i++) {
    if (model.features[i].id === featureId) { idx = i; break; }
  }
  if (idx < 0) return false;
  var newIdx = idx + (direction === 'up' ? -1 : 1);
  if (newIdx < 0 || newIdx >= model.features.length) return false;
  var tmp = model.features[idx];
  model.features[idx] = model.features[newIdx];
  model.features[newIdx] = tmp;
  return true;
}

// ─── Transform'u Three.js mesh'e uygula ────────────────────────────────────
// Euler XYZ sırası (Three.js default). Rotasyon derece cinsinden alınır.
function _veCADApplyTransform(obj3D, transform) {
  if (!obj3D || !transform) return;
  obj3D.position.set(transform.tx || 0, transform.ty || 0, transform.tz || 0);
  var rx = (transform.rx || 0) * Math.PI / 180;
  var ry = (transform.ry || 0) * Math.PI / 180;
  var rz = (transform.rz || 0) * Math.PI / 180;
  obj3D.rotation.set(rx, ry, rz);
}

// ─── Modeli Three.js sahnesine inşa et ─────────────────────────────────────
// Her feature için veFEABuildPrimitiveMesh çağrılır, transform uygulanır,
// tek bir Group altında toplanır.
function veCADBuildScene(model) {
  if (typeof THREE === 'undefined') return null;
  if (typeof veFEABuildPrimitiveMesh !== 'function') return null;
  if (!model || !model.features) return null;

  var root = new THREE.Group();
  root.name = 'cadModelRoot';
  root.userData.cadModel = true;

  for (var i = 0; i < model.features.length; i++) {
    var f = model.features[i];
    if (!f.visible) continue;
    var primMesh = veFEABuildPrimitiveMesh(f.type, f.params);
    if (!primMesh) continue;
    primMesh.userData.cadFeatureId = f.id;
    primMesh.userData.cadFeatureName = f.name;
    _veCADApplyTransform(primMesh, f.transform);
    root.add(primMesh);
  }
  return root;
}

// ─── Bir Three.js obje hiyerarşisinden üçgenleri (dünya koord.) çıkar ──────
// indexed/non-indexed BufferGeometry'lerle uyumlu. mesh.matrixWorld'u uygular.
function _veCADExtractTriangles(obj3D, outVerts, outNormals) {
  obj3D.updateMatrixWorld(true);
  obj3D.traverse(function(child) {
    if (!child.isMesh) return;
    var geo = child.geometry;
    if (!geo || !geo.attributes || !geo.attributes.position) return;
    var posAttr = geo.attributes.position;
    var nrmAttr = geo.attributes.normal;
    var index = geo.index;
    var matrix = child.matrixWorld;

    // Normal matrix (transpose-inverse of upper 3x3) için Three.js helper
    var normalMatrix = new THREE.Matrix3().getNormalMatrix(matrix);

    var triCount = index ? (index.count / 3) : (posAttr.count / 3);
    for (var t = 0; t < triCount; t++) {
      for (var c = 0; c < 3; c++) {
        var i = index ? index.getX(t * 3 + c) : (t * 3 + c);
        var px = posAttr.getX(i), py = posAttr.getY(i), pz = posAttr.getZ(i);
        var v = new THREE.Vector3(px, py, pz).applyMatrix4(matrix);
        outVerts.push(v.x, v.y, v.z);

        if (nrmAttr) {
          var nx = nrmAttr.getX(i), ny = nrmAttr.getY(i), nz = nrmAttr.getZ(i);
          var n = new THREE.Vector3(nx, ny, nz).applyMatrix3(normalMatrix).normalize();
          outNormals.push(n.x, n.y, n.z);
        } else {
          outNormals.push(0, 0, 1);
        }
      }
    }
  });
}

// ─── Modeli tessellate et: { vertices, normals, triangleCount } ────────────
// veFEAApplySTEP / veFEAApplyPrimitive yolundakine uyumlu mesh formatı.
// Vertex array Float32, her üçgen 9 float (3 vertex × 3 koord), her normal 3 float.
function veCADTessellate(model) {
  if (!model || !model.features || model.features.length === 0) {
    return { vertices: new Float32Array(0), normals: new Float32Array(0), triangleCount: 0 };
  }
  var root = veCADBuildScene(model);
  if (!root) return { vertices: new Float32Array(0), normals: new Float32Array(0), triangleCount: 0 };

  var verts = [], normals = [];
  _veCADExtractTriangles(root, verts, normals);

  // Three.js objelerini dispose et (mesh data zaten array'e kopyalandı)
  root.traverse(function(o) {
    if (o.geometry && o.geometry.dispose) try { o.geometry.dispose(); } catch(e) {}
    if (o.material) {
      var mats = Array.isArray(o.material) ? o.material : [o.material];
      mats.forEach(function(m) { if (m.dispose) try { m.dispose(); } catch(e) {} });
    }
  });

  return {
    vertices:      new Float32Array(verts),
    normals:       new Float32Array(normals),
    triangleCount: verts.length / 9
  };
}

// ─── Modelin toplam hacim / yüzey alanı / bbox hesabı ─────────────────────
// Hacim: tessellated mesh divergence teoremi (veFEAComputeMeshStats kullan).
// Faz-1'de booleansız, çakışan primitiflerin hacimleri toplanır (kullanıcı
// bilgilendirildi). Faz-2'de gerçek CSG ile düzelir.
function veCADComputeStats(model) {
  if (typeof veFEAComputeMeshStats !== 'function') {
    return { volume: 0, surfaceArea: 0, bbox: { x: 0, y: 0, z: 0 } };
  }
  var parsed = veCADTessellate(model);
  return veFEAComputeMeshStats({ vertices: parsed.vertices, triangleCount: parsed.triangleCount });
}

// ─── Persist: serialize/deserialize ────────────────────────────────────────
// Serialize JSON-safe (Float32Array yok, sadece düz nesneler). Deserialize
// version migration için yer bırakır.
function veCADSerialize(model) {
  if (!model || !model.features) return { version: VE_CAD_VERSION, features: [] };
  return {
    version: VE_CAD_VERSION,
    features: model.features.map(function(f) {
      return {
        id: f.id,
        type: f.type,
        op: f.op,
        params: Object.assign({}, f.params),
        transform: Object.assign({}, f.transform),
        name: f.name,
        visible: f.visible
      };
    })
  };
}

function veCADDeserialize(obj) {
  var model = veCADCreateModel();
  if (!obj || !Array.isArray(obj.features)) return model;
  obj.features.forEach(function(f) {
    if (!f || !f.type) return;
    var defaults = (typeof veFEAPrimitiveDefaults === 'function') ? veFEAPrimitiveDefaults(f.type) : null;
    if (!defaults) return;
    var params = {};
    Object.keys(defaults).forEach(function(k) { params[k] = defaults[k]; });
    if (f.params) Object.keys(f.params).forEach(function(k) { params[k] = f.params[k]; });

    model.features.push({
      id: f.id || _veCADGenFeatureId(),
      type: f.type,
      op: (f.op === 'sub' || f.op === 'intersect') ? f.op : 'add',
      params: params,
      transform: Object.assign(_veCADDefaultTransform(), f.transform || {}),
      name: f.name || _veCADAutoName(model, f.type),
      visible: f.visible !== false
    });
  });
  return model;
}

// ─── Modelin özet sourceLabel'ı (UI'de gösterilir) ────────────────────────
function veCADSummaryLabel(model) {
  if (!model || !model.features || model.features.length === 0) {
    return 'CAD Modeli (boş)';
  }
  return 'CAD Modeli (' + model.features.length + ' parça)';
}

// Test environment için export (Node.js)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    veCADCreateModel: veCADCreateModel,
    veCADAddFeature: veCADAddFeature,
    veCADRemoveFeature: veCADRemoveFeature,
    veCADUpdateFeature: veCADUpdateFeature,
    veCADGetFeature: veCADGetFeature,
    veCADMoveFeature: veCADMoveFeature,
    veCADSerialize: veCADSerialize,
    veCADDeserialize: veCADDeserialize,
    veCADSummaryLabel: veCADSummaryLabel,
    veCADHasBoolean: veCADHasBoolean,
    veCADBackendLabel: veCADBackendLabel
  };
}
