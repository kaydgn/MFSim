// ============================================================================
// FEA PARAMETRİK PRİMİTİFLER
// ============================================================================
// Three.js mesh inşası + hacim / alan / bbox hesaplamaları + UI parametre
// şeması. Bütün boyutlar mm cinsindendir. Hacim mm³, alan mm² olarak
// hesaplanır; UI gerektiğinde m³ / m² / cm³ vb.'e dönüştürür.
//
// Public API:
//   veFEAPrimitiveTypes()                → liste döner
//   veFEAPrimitiveSchema(type)           → UI input şeması
//   veFEAPrimitiveDefaults(type)         → varsayılan parametre nesnesi
//   veFEABuildPrimitiveMesh(type, params) → THREE.Mesh (Three.js yoksa null)
//   veFEAPrimitiveStats(type, params)    → { volume, surfaceArea, bbox }
//   veFEAFormatVolume(mm3) / veFEAFormatArea(mm2) / veFEAFormatBBox(mm)
// ============================================================================

var VE_FEA_PRIMITIVES = {
  'box': {
    label: 'Kutu',
    schema: [
      { key: 'width',  label: 'Genişlik (X)',  unit: 'mm', default: 50, min: 0.1, max: 5000 },
      { key: 'height', label: 'Yükseklik (Y)', unit: 'mm', default: 30, min: 0.1, max: 5000 },
      { key: 'depth',  label: 'Derinlik (Z)',  unit: 'mm', default: 20, min: 0.1, max: 5000 }
    ]
  },
  'cylinder': {
    label: 'Silindir',
    schema: [
      { key: 'radius', label: 'Yarıçap',  unit: 'mm', default: 15, min: 0.1, max: 2500 },
      { key: 'height', label: 'Yükseklik', unit: 'mm', default: 60, min: 0.1, max: 5000 },
      { key: 'segments', label: 'Çevresel Segment', unit: '−', default: 48, min: 8, max: 256, integer: true }
    ]
  },
  'shaft': {
    label: 'Şaft (içi boş silindir)',
    schema: [
      { key: 'outerRadius', label: 'Dış Yarıçap', unit: 'mm', default: 20, min: 0.5, max: 2500 },
      { key: 'innerRadius', label: 'İç Yarıçap (delik)', unit: 'mm', default: 8,  min: 0,   max: 2500 },
      { key: 'length',      label: 'Uzunluk',     unit: 'mm', default: 120, min: 0.1, max: 10000 },
      { key: 'segments',    label: 'Çevresel Segment', unit: '−', default: 48, min: 8, max: 256, integer: true }
    ]
  },
  'sphere': {
    label: 'Küre',
    schema: [
      { key: 'radius',   label: 'Yarıçap',                unit: 'mm', default: 25, min: 0.5, max: 2500 },
      { key: 'segments', label: 'Çevresel Segment (görsel)', unit: '−', default: 32, min: 8, max: 128, integer: true }
    ]
  },
  'hemisphere': {
    label: 'Yarım Küre (Kapak / Dome)',
    schema: [
      { key: 'radius',   label: 'Yarıçap',                unit: 'mm', default: 25, min: 0.5, max: 2500 },
      { key: 'segments', label: 'Çevresel Segment (görsel)', unit: '−', default: 32, min: 8, max: 128, integer: true }
    ]
  },
  'torus': {
    label: 'Torus (Halka / O-ring)',
    schema: [
      { key: 'majorRadius', label: 'Büyük Yarıçap (R)', unit: 'mm', default: 30, min: 1, max: 2500 },
      { key: 'minorRadius', label: 'Küçük Yarıçap (r)',  unit: 'mm', default: 10, min: 0.1, max: 1000 },
      { key: 'majorSegments', label: 'Halka Segment',    unit: '−', default: 48, min: 6, max: 256, integer: true },
      { key: 'minorSegments', label: 'Kesit Segment',    unit: '−', default: 24, min: 6, max: 128, integer: true }
    ]
  },
  'cone': {
    label: 'Koni / Frustum (kesik koni)',
    schema: [
      { key: 'bottomRadius', label: 'Alt Yarıçap',     unit: 'mm', default: 20, min: 0.1, max: 2500 },
      { key: 'topRadius',    label: 'Üst Yarıçap (0=apex)', unit: 'mm', default: 8, min: 0,   max: 2500 },
      { key: 'height',       label: 'Yükseklik',        unit: 'mm', default: 60, min: 0.1, max: 5000 },
      { key: 'segments',     label: 'Çevresel Segment', unit: '−',  default: 48, min: 8,   max: 256, integer: true }
    ]
  },
  'lbracket': {
    label: 'L-Profil (köşe kirişi)',
    schema: [
      { key: 'width',     label: 'Yatay Kol Uzunluğu (W)', unit: 'mm', default: 60, min: 1, max: 5000 },
      { key: 'height',    label: 'Dikey Kol Uzunluğu (H)', unit: 'mm', default: 40, min: 1, max: 5000 },
      { key: 'thickness', label: 'Kalınlık (t)',           unit: 'mm', default: 5,  min: 0.5, max: 500 },
      { key: 'length',    label: 'Uzunluk (Z sweep)',      unit: 'mm', default: 100, min: 1, max: 10000 }
    ]
  },
  'ibeam': {
    label: 'I-Profil (kiriş)',
    schema: [
      { key: 'width',     label: 'Flanş Genişliği (W)',   unit: 'mm', default: 80, min: 1, max: 5000 },
      { key: 'height',    label: 'Toplam Yükseklik (H)',  unit: 'mm', default: 120, min: 1, max: 5000 },
      { key: 'flange',    label: 'Flanş Kalınlığı (tf)',  unit: 'mm', default: 8,  min: 0.5, max: 500 },
      { key: 'web',       label: 'Gövde Kalınlığı (tw)',  unit: 'mm', default: 6,  min: 0.5, max: 500 },
      { key: 'length',    label: 'Uzunluk (Z sweep)',     unit: 'mm', default: 200, min: 1, max: 10000 }
    ]
  },
  'rectTube': {
    label: 'Dikdörtgen Profil (içi boş kutu)',
    schema: [
      { key: 'width',     label: 'Genişlik (X)',  unit: 'mm', default: 60, min: 1,    max: 5000 },
      { key: 'height',    label: 'Yükseklik (Y)', unit: 'mm', default: 40, min: 1,    max: 5000 },
      { key: 'thickness', label: 'Cidar kalınlığı', unit: 'mm', default: 4, min: 0.2, max: 500 },
      { key: 'length',    label: 'Uzunluk (Z sweep)', unit: 'mm', default: 200, min: 1, max: 10000 }
    ]
  }
};

function veFEAPrimitiveTypes() {
  return Object.keys(VE_FEA_PRIMITIVES);
}

function veFEAPrimitiveSchema(type) {
  var def = VE_FEA_PRIMITIVES[type];
  return def ? def.schema : null;
}

function veFEAPrimitiveLabel(type) {
  var def = VE_FEA_PRIMITIVES[type];
  return def ? def.label : type;
}

function veFEAPrimitiveDefaults(type) {
  var schema = veFEAPrimitiveSchema(type);
  if(!schema) return null;
  var out = {};
  schema.forEach(function(p) { out[p.key] = p.default; });
  return out;
}

// Parametre nesnesini schema'ya göre clamp + tip dönüşümü uygula
function veFEANormalizePrimitiveParams(type, params) {
  var schema = veFEAPrimitiveSchema(type);
  if(!schema) return params;
  var defaults = veFEAPrimitiveDefaults(type);
  var out = {};
  schema.forEach(function(p) {
    var v = (params && params[p.key] !== undefined) ? Number(params[p.key]) : defaults[p.key];
    if(!isFinite(v)) v = defaults[p.key];
    if(p.min !== undefined) v = Math.max(p.min, v);
    if(p.max !== undefined) v = Math.min(p.max, v);
    if(p.integer) v = Math.round(v);
    out[p.key] = v;
  });
  // Shaft: iç yarıçap dış yarıçaptan küçük olmalı
  if(type === 'shaft' && out.innerRadius >= out.outerRadius) {
    out.innerRadius = Math.max(0, out.outerRadius - 1);
  }
  // Rectangular tube: thickness < min(width, height) / 2
  if(type === 'rectTube') {
    var maxT = Math.min(out.width, out.height) / 2 - 0.1;
    if(out.thickness >= maxT) out.thickness = Math.max(0.2, maxT);
  }
  // L-bracket: thickness < min(w, h)
  if(type === 'lbracket') {
    var maxTL = Math.min(out.width, out.height) - 0.1;
    if(out.thickness >= maxTL) out.thickness = Math.max(0.5, maxTL);
  }
  // I-beam: flange < height/2, web < width
  if(type === 'ibeam') {
    var maxFlange = out.height / 2 - 0.1;
    if(out.flange >= maxFlange) out.flange = Math.max(0.5, maxFlange);
    var maxWeb = out.width - 0.1;
    if(out.web >= maxWeb) out.web = Math.max(0.5, maxWeb);
  }
  return out;
}

// ─── İstatistikler (geometriden bağımsız analitik formüller) ────────────────
function veFEAPrimitiveStats(type, params) {
  var p = veFEANormalizePrimitiveParams(type, params);
  if(!p) return null;

  var volume = 0, surfaceArea = 0, bbox;

  if(type === 'box') {
    volume = p.width * p.height * p.depth;
    surfaceArea = 2 * (p.width * p.height + p.height * p.depth + p.width * p.depth);
    bbox = { x: p.width, y: p.height, z: p.depth };
  } else if(type === 'cylinder') {
    volume = Math.PI * p.radius * p.radius * p.height;
    surfaceArea = 2 * Math.PI * p.radius * p.height + 2 * Math.PI * p.radius * p.radius;
    bbox = { x: 2 * p.radius, y: p.height, z: 2 * p.radius };
  } else if(type === 'shaft') {
    var R = p.outerRadius, r = p.innerRadius, L = p.length;
    volume = Math.PI * (R * R - r * r) * L;
    // Dış yan + iç yan + iki halka uç
    var sideOuter = 2 * Math.PI * R * L;
    var sideInner = 2 * Math.PI * r * L;
    var endRing   = 2 * Math.PI * (R * R - r * r); // iki uç
    surfaceArea = sideOuter + sideInner + endRing;
    bbox = { x: 2 * R, y: L, z: 2 * R };
  } else if(type === 'sphere') {
    var rs = p.radius;
    volume = (4 / 3) * Math.PI * rs * rs * rs;
    surfaceArea = 4 * Math.PI * rs * rs;
    bbox = { x: 2 * rs, y: 2 * rs, z: 2 * rs };
  } else if(type === 'hemisphere') {
    var rH = p.radius;
    volume = (2 / 3) * Math.PI * rH * rH * rH;
    var domeArea = 2 * Math.PI * rH * rH;
    var flatArea = Math.PI * rH * rH;
    surfaceArea = domeArea + flatArea;
    bbox = { x: 2 * rH, y: rH, z: 2 * rH };
  } else if(type === 'torus') {
    var Rt = p.majorRadius, rt = p.minorRadius;
    // V = 2π² R r²  (Pappus theorem)
    volume = 2 * Math.PI * Math.PI * Rt * rt * rt;
    // Surface = 4π² R r
    surfaceArea = 4 * Math.PI * Math.PI * Rt * rt;
    bbox = { x: 2 * (Rt + rt), y: 2 * rt, z: 2 * (Rt + rt) };
  } else if(type === 'lbracket') {
    var wL = p.width, hL = p.height, tL = p.thickness, LL = p.length;
    // L kesit alanı = w*t + (h-t)*t = t*(w + h - t)
    var crossL = tL * (wL + hL - tL);
    volume = crossL * LL;
    // Çevre = w + h + (w-t) + (h-t) + 2t = 2w + 2h (dış çevre + iç köşe)
    // Yan yüzeyler: çevre × L; uç kesitler: 2 × crossL
    var perimL = 2 * wL + 2 * hL;
    surfaceArea = perimL * LL + 2 * crossL;
    bbox = { x: wL, y: hL, z: LL };
  } else if(type === 'ibeam') {
    var wI = p.width, hI = p.height, tfI = p.flange, twI = p.web, LI = p.length;
    // I kesit = 2 × flanş + gövde
    // Flanş alanı = w * tf
    // Gövde alanı = tw * (h - 2*tf)
    var crossI = 2 * (wI * tfI) + twI * (hI - 2 * tfI);
    volume = crossI * LI;
    // Perimetre (I kesit): outer 2*(w+h) − 2*(w-tw)*2 ... karmaşık
    // Yaklaşık: outer çevre = 2*(w+h) için bir kabul + iç girinti
    var innerW = (wI - twI) / 2;     // her bir flanşın gövdeden taşan kısmı
    var innerH = hI - 2 * tfI;        // gövde yüksekliği
    var perimI = 2 * wI + 2 * hI + 4 * innerW;  // dış + iç girinti çevresi
    surfaceArea = perimI * LI + 2 * crossI;
    bbox = { x: wI, y: hI, z: LI };
  } else if(type === 'cone') {
    var rB = p.bottomRadius, rT = p.topRadius, hC = p.height;
    // Frustum hacim: V = (1/3) π h (rB² + rB·rT + rT²)
    volume = (Math.PI * hC / 3) * (rB*rB + rB*rT + rT*rT);
    // Slant height: l = √(h² + (rB-rT)²)
    var slant = Math.sqrt(hC*hC + (rB - rT)*(rB - rT));
    var sideArea = Math.PI * (rB + rT) * slant;
    var bottomArea = Math.PI * rB * rB;
    var topArea = Math.PI * rT * rT;  // 0 if rT=0 (apex)
    surfaceArea = sideArea + bottomArea + topArea;
    var rMaxC = Math.max(rB, rT);
    bbox = { x: 2 * rMaxC, y: hC, z: 2 * rMaxC };
  } else if(type === 'rectTube') {
    var w = p.width, h = p.height, t = p.thickness, L2 = p.length;
    var outerArea = w * h;
    var innerArea = Math.max(0, (w - 2 * t) * (h - 2 * t));
    volume = (outerArea - innerArea) * L2;
    // Dış yüz + iç yüz + 2 halka uç
    var outerPerim = 2 * (w + h);
    var innerPerim = 2 * Math.max(0, (w - 2 * t) + (h - 2 * t));
    var endRingArea = 2 * (outerArea - innerArea);
    surfaceArea = outerPerim * L2 + innerPerim * L2 + endRingArea;
    bbox = { x: w, y: h, z: L2 };
  }

  return { volume: volume, surfaceArea: surfaceArea, bbox: bbox, params: p };
}

// ─── Three.js mesh inşası (face-aware: her yüz ayrı materyal/mesh) ─────────
// ANSYS-style face selection için her primitif yüz başına ayırt edilebilir
// gösterilir:
//   - Box / Cylinder: multi-material (BoxGeometry/CylinderGeometry'nin native
//     groups[] yapısı kullanılır). userData.feaFaceMap[materialIndex] → faceId
//   - Shaft / RectTube: birden çok ayrı Mesh (Group içinde). Her child mesh
//     userData.feaFaceId taşır.
// Raycaster mouse hover/click'te bu metadata'yı okuyup faceId'yi bulur.
function veFEABuildPrimitiveMesh(type, params) {
  if(typeof THREE === 'undefined') return null;
  var p = veFEANormalizePrimitiveParams(type, params);
  if(!p) return null;

  if(type === 'box')      return _veFEABuildBoxMesh(p);
  if(type === 'cylinder') return _veFEABuildCylinderMesh(p);
  if(type === 'shaft')    return _veFEABuildShaftGroup(p);
  if(type === 'sphere')     return _veFEABuildSphereMesh(p);
  if(type === 'hemisphere') return _veFEABuildHemisphereMesh(p);
  if(type === 'torus')      return _veFEABuildTorusMesh(p);
  if(type === 'cone')       return _veFEABuildConeMesh(p);
  if(type === 'lbracket')   return _veFEABuildLBracketMesh(p);
  if(type === 'ibeam')      return _veFEABuildIBeamMesh(p);
  if(type === 'rectTube') return _veFEABuildRectTubeMesh(p);
  return null;
}

// ─── Yarım Küre — SphereGeometry üst yarı (phi 0 → π/2) + alt disk ────────
function _veFEABuildHemisphereMesh(p) {
  var group = new THREE.Group();
  group.userData.feaPrimitive = { type: 'hemisphere', params: p };

  // Üst yarı küre kabuğu (dome)
  var domeGeo = new THREE.SphereGeometry(p.radius, p.segments, Math.max(8, Math.round(p.segments / 2)), 0, Math.PI * 2, 0, Math.PI / 2);
  var domeMat = _veFEAMakePrimitiveMaterial();
  var dome = new THREE.Mesh(domeGeo, domeMat);
  dome.userData.feaFaceId = 'faceDome';
  group.add(dome);

  // Alt düz disk (CircleGeometry)
  var flatGeo = new THREE.CircleGeometry(p.radius, p.segments);
  var flatMat = _veFEAMakePrimitiveMaterial();
  var flat = new THREE.Mesh(flatGeo, flatMat);
  flat.rotation.x = Math.PI / 2;  // XZ plane'e döndür (y=0 düzlemi)
  flat.userData.feaFaceId = 'faceFlat';
  group.add(flat);

  // Edges overlay
  [dome, flat].forEach(function(m) {
    var e = new THREE.EdgesGeometry(m.geometry, 30);
    var l = new THREE.LineSegments(e, new THREE.LineBasicMaterial({ color: 0x1a3d6b, transparent: true, opacity: 0.5 }));
    m.add(l);
  });
  return group;
}

// ─── Torus — TorusGeometry tek face (toroidal surface) ────────────────────
function _veFEABuildTorusMesh(p) {
  var geometry = new THREE.TorusGeometry(p.majorRadius, p.minorRadius, p.minorSegments, p.majorSegments);
  // Torus default Z-axis etrafında döner; Y-axis'e döndür (standart konvansiyon)
  geometry.rotateX(Math.PI / 2);
  var mat = _veFEAMakePrimitiveMaterial();
  var mesh = new THREE.Mesh(geometry, mat);
  mesh.userData.feaPrimitive = { type: 'torus', params: p };
  mesh.userData.feaFaceId = 'faceSurface';
  mesh.userData.feaEdgesAttached = true;

  var edges = new THREE.EdgesGeometry(geometry, 30);
  var line = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: 0x1a3d6b, transparent: true, opacity: 0.5 }));
  mesh.add(line);
  return mesh;
}

// ─── Koni / Frustum — CylinderGeometry alt/üst farklı yarıçap ──────────────
function _veFEABuildConeMesh(p) {
  // Three.js CylinderGeometry(radiusTop, radiusBottom, height, segments)
  // 3 face groups: 0=side, 1=top, 2=bottom (cylinder ile aynı convention)
  var geometry = new THREE.CylinderGeometry(p.topRadius, p.bottomRadius, p.height, p.segments);
  var faceMap = ['faceSide', 'faceTop', 'faceBottom'];
  var materials = faceMap.map(function() { return _veFEAMakePrimitiveMaterial(); });
  var mesh = new THREE.Mesh(geometry, materials);
  mesh.userData.feaPrimitive = { type: 'cone', params: p };
  mesh.userData.feaFaceMap = faceMap;
  mesh.userData.feaEdgesAttached = true;

  var edges = new THREE.EdgesGeometry(geometry, 30);
  var line = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: 0x1a3d6b, linewidth: 1 }));
  mesh.add(line);
  return mesh;
}

// ─── Küre — SphereGeometry tek face ────────────────────────────────────────
function _veFEABuildSphereMesh(p) {
  var geometry = new THREE.SphereGeometry(p.radius, p.segments, Math.max(8, Math.round(p.segments / 2)));
  var mat = _veFEAMakePrimitiveMaterial();
  var mesh = new THREE.Mesh(geometry, mat);
  mesh.userData.feaPrimitive = { type: 'sphere', params: p };
  // Tek yüz — face selection için
  mesh.userData.feaFaceId = 'faceSurface';
  mesh.userData.feaEdgesAttached = true;

  // Edges overlay zorlu (çok segment), düşük açı eşiği
  var edges = new THREE.EdgesGeometry(geometry, 30);
  var line = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: 0x1a3d6b, transparent: true, opacity: 0.5 }));
  mesh.add(line);
  return mesh;
}

// Standart body color materyali — her yüz aynı renkten başlar, hover/select
// için emissive değiştirilebilir.
function _veFEAMakePrimitiveMaterial() {
  return new THREE.MeshStandardMaterial({
    color: 0x3b82f6,
    metalness: 0.3,
    roughness: 0.55,
    side: THREE.DoubleSide,
    flatShading: false,
    emissive: 0x000000  // hover/select için runtime'da değişir
  });
}

// ─── Kutu — BoxGeometry native 6 face groups ───────────────────────────────
function _veFEABuildBoxMesh(p) {
  var geometry = new THREE.BoxGeometry(p.width, p.height, p.depth);
  // Three.js BoxGeometry materialIndex sırası: 0=+X, 1=-X, 2=+Y, 3=-Y, 4=+Z, 5=-Z
  var faceMap = ['faceXMax', 'faceXMin', 'faceYMax', 'faceYMin', 'faceZMax', 'faceZMin'];
  var materials = faceMap.map(function() { return _veFEAMakePrimitiveMaterial(); });
  var mesh = new THREE.Mesh(geometry, materials);
  mesh.userData.feaPrimitive = { type: 'box', params: p };
  mesh.userData.feaFaceMap = faceMap;
  mesh.userData.feaEdgesAttached = true;  // edges manuel eklendi; viewer tekrar eklemesin

  var edges = new THREE.EdgesGeometry(geometry, 30);
  var line = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: 0x1a3d6b, linewidth: 1 }));
  mesh.add(line);
  return mesh;
}

// ─── Silindir — CylinderGeometry native 3 face groups ──────────────────────
function _veFEABuildCylinderMesh(p) {
  var geometry = new THREE.CylinderGeometry(p.radius, p.radius, p.height, p.segments);
  // Three.js CylinderGeometry materialIndex sırası: 0=side, 1=top, 2=bottom
  var faceMap = ['faceSide', 'faceTop', 'faceBottom'];
  var materials = faceMap.map(function() { return _veFEAMakePrimitiveMaterial(); });
  var mesh = new THREE.Mesh(geometry, materials);
  mesh.userData.feaPrimitive = { type: 'cylinder', params: p };
  mesh.userData.feaFaceMap = faceMap;
  mesh.userData.feaEdgesAttached = true;

  var edges = new THREE.EdgesGeometry(geometry, 30);
  var line = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: 0x1a3d6b, linewidth: 1 }));
  mesh.add(line);
  return mesh;
}

// ─── Şaft — 4 ayrı mesh (Group içinde): faceTop, faceBottom, faceOuter, faceInner
function _veFEABuildShaftGroup(p) {
  var group = new THREE.Group();
  group.userData.feaPrimitive = { type: 'shaft', params: p };
  var halfL = p.length / 2;
  var rOut = p.outerRadius, rIn = p.innerRadius;
  var segs = p.segments;

  // Üst halka (RingGeometry, normal +Y)
  var topGeo = new THREE.RingGeometry(rIn, rOut, segs, 1);
  var topMesh = new THREE.Mesh(topGeo, _veFEAMakePrimitiveMaterial());
  topMesh.rotation.x = -Math.PI / 2;
  topMesh.position.y = halfL;
  topMesh.userData.feaFaceId = 'faceTop';
  group.add(topMesh);

  // Alt halka (normal -Y)
  var botGeo = new THREE.RingGeometry(rIn, rOut, segs, 1);
  var botMesh = new THREE.Mesh(botGeo, _veFEAMakePrimitiveMaterial());
  botMesh.rotation.x = Math.PI / 2;
  botMesh.position.y = -halfL;
  botMesh.userData.feaFaceId = 'faceBottom';
  group.add(botMesh);

  // Dış yan yüzey (openEnded CylinderGeometry)
  var outerGeo = new THREE.CylinderGeometry(rOut, rOut, p.length, segs, 1, true);
  var outerMesh = new THREE.Mesh(outerGeo, _veFEAMakePrimitiveMaterial());
  outerMesh.userData.feaFaceId = 'faceOuter';
  group.add(outerMesh);

  // İç yan yüzey (delik, normal içeri bakar — BackSide)
  var innerGeo = new THREE.CylinderGeometry(rIn, rIn, p.length, segs, 1, true);
  var innerMat = _veFEAMakePrimitiveMaterial();
  innerMat.side = THREE.BackSide;  // iç yüzeyden görünüm
  var innerMesh = new THREE.Mesh(innerGeo, innerMat);
  innerMesh.userData.feaFaceId = 'faceInner';
  group.add(innerMesh);

  // Edges overlay her child için
  [topMesh, botMesh, outerMesh, innerMesh].forEach(function(m) {
    var e = new THREE.EdgesGeometry(m.geometry, 30);
    var l = new THREE.LineSegments(e, new THREE.LineBasicMaterial({ color: 0x1a3d6b }));
    m.add(l);
  });

  return group;
}

// ─── L-Profil — ExtrudeGeometry (L cross-section × Z extrude) ──────────────
function _veFEABuildLBracketMesh(p) {
  // L kesit (XY plane), köşe origin'de, sonra bbox-merkez orijin'e translate
  var w = p.width, h = p.height, t = p.thickness;
  var shape = new THREE.Shape();
  shape.moveTo(0, 0);
  shape.lineTo(w, 0);
  shape.lineTo(w, t);
  shape.lineTo(t, t);
  shape.lineTo(t, h);
  shape.lineTo(0, h);
  shape.lineTo(0, 0);
  var geometry = new THREE.ExtrudeGeometry(shape, { depth: p.length, bevelEnabled: false, steps: 1 });
  geometry.translate(-w / 2, -h / 2, -p.length / 2);
  var mat = _veFEAMakePrimitiveMaterial();
  var mesh = new THREE.Mesh(geometry, mat);
  mesh.userData.feaPrimitive = { type: 'lbracket', params: p };
  mesh.userData.feaEdgesAttached = true;
  var edges = new THREE.EdgesGeometry(geometry, 30);
  var line = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: 0x1a3d6b }));
  mesh.add(line);
  return mesh;
}

// ─── I-Profil (kiriş) — ExtrudeGeometry (I cross-section × Z extrude) ──────
function _veFEABuildIBeamMesh(p) {
  var w = p.width, h = p.height, tf = p.flange, tw = p.web;
  var halfW = w / 2, halfH = h / 2, halfTw = tw / 2;
  // I kesit: dış silüet (T üst + T alt karışımı yerine direct vertices)
  // CCW dış çevre — flanş alt → gövde sol → flanş üst → karşı tarafa simetrik
  var shape = new THREE.Shape();
  shape.moveTo(-halfW, -halfH);                 // alt sol köşe
  shape.lineTo( halfW, -halfH);                 // alt sağ
  shape.lineTo( halfW, -halfH + tf);            // alt flanş üst sağ
  shape.lineTo( halfTw, -halfH + tf);           // gövde sağ alt iç girinti
  shape.lineTo( halfTw,  halfH - tf);           // gövde sağ üst
  shape.lineTo( halfW,  halfH - tf);            // üst flanş alt sağ
  shape.lineTo( halfW,  halfH);                 // üst sağ
  shape.lineTo(-halfW,  halfH);                 // üst sol
  shape.lineTo(-halfW,  halfH - tf);            // üst flanş alt sol
  shape.lineTo(-halfTw, halfH - tf);            // gövde sol üst iç girinti
  shape.lineTo(-halfTw,-halfH + tf);            // gövde sol alt
  shape.lineTo(-halfW, -halfH + tf);            // alt flanş üst sol
  shape.lineTo(-halfW, -halfH);                 // kapa
  var geometry = new THREE.ExtrudeGeometry(shape, { depth: p.length, bevelEnabled: false, steps: 1 });
  geometry.translate(0, 0, -p.length / 2);
  var mat = _veFEAMakePrimitiveMaterial();
  var mesh = new THREE.Mesh(geometry, mat);
  mesh.userData.feaPrimitive = { type: 'ibeam', params: p };
  mesh.userData.feaEdgesAttached = true;
  var edges = new THREE.EdgesGeometry(geometry, 30);
  var line = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: 0x1a3d6b }));
  mesh.add(line);
  return mesh;
}

// ─── RectTube — ExtrudeGeometry (eski yapı, face decomposition ileride) ────
function _veFEABuildRectTubeMesh(p) {
  var w2 = p.width / 2, h2 = p.height / 2;
  var iw2 = w2 - p.thickness;
  var ih2 = h2 - p.thickness;
  var shape = new THREE.Shape();
  shape.moveTo(-w2, -h2); shape.lineTo(w2, -h2); shape.lineTo(w2, h2);
  shape.lineTo(-w2, h2); shape.lineTo(-w2, -h2);
  if (iw2 > 0 && ih2 > 0) {
    var hole = new THREE.Path();
    hole.moveTo(-iw2, -ih2); hole.lineTo(iw2, -ih2); hole.lineTo(iw2, ih2);
    hole.lineTo(-iw2, ih2); hole.lineTo(-iw2, -ih2);
    shape.holes.push(hole);
  }
  var geometry = new THREE.ExtrudeGeometry(shape, { depth: p.length, bevelEnabled: false, steps: 1 });
  geometry.translate(0, 0, -p.length / 2);
  var material = _veFEAMakePrimitiveMaterial();
  var mesh = new THREE.Mesh(geometry, material);
  mesh.userData.feaPrimitive = { type: 'rectTube', params: p };

  var edges = new THREE.EdgesGeometry(geometry, 30);
  var line = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: 0x1a3d6b }));
  mesh.add(line);
  return mesh;
}

// ─── Birim formatlama yardımcıları ──────────────────────────────────────────
function veFEAFormatVolume(mm3) {
  if(!isFinite(mm3) || mm3 <= 0) return '—';
  if(mm3 >= 1e9) return (mm3 / 1e9).toFixed(3) + ' m³';
  if(mm3 >= 1e6) return (mm3 / 1e6).toFixed(2) + ' dm³';
  if(mm3 >= 1e3) return (mm3 / 1e3).toFixed(2) + ' cm³';
  return mm3.toFixed(1) + ' mm³';
}

function veFEAFormatArea(mm2) {
  if(!isFinite(mm2) || mm2 <= 0) return '—';
  if(mm2 >= 1e6) return (mm2 / 1e6).toFixed(3) + ' m²';
  if(mm2 >= 1e4) return (mm2 / 1e4).toFixed(2) + ' dm²';
  if(mm2 >= 1e2) return (mm2 / 1e2).toFixed(2) + ' cm²';
  return mm2.toFixed(1) + ' mm²';
}

function veFEAFormatBBox(bbox) {
  if(!bbox) return '—';
  function fmt(v) {
    if(v >= 1000) return (v / 1000).toFixed(2) + ' m';
    if(v >= 10) return v.toFixed(1) + ' mm';
    return v.toFixed(2) + ' mm';
  }
  return fmt(bbox.x) + ' × ' + fmt(bbox.y) + ' × ' + fmt(bbox.z);
}
