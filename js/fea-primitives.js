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

// ─── Three.js mesh inşası ──────────────────────────────────────────────────
function veFEABuildPrimitiveMesh(type, params) {
  if(typeof THREE === 'undefined') return null;
  var p = veFEANormalizePrimitiveParams(type, params);
  var geometry = null;

  if(type === 'box') {
    geometry = new THREE.BoxGeometry(p.width, p.height, p.depth);
  } else if(type === 'cylinder') {
    geometry = new THREE.CylinderGeometry(p.radius, p.radius, p.height, p.segments);
  } else if(type === 'shaft') {
    // İçi boş silindir = dış silindir mesh'i + iç delik. Three.js'in
    // CylinderGeometry'sinde delik yok; LatheGeometry ile yarım kesiti
    // döndürerek halka kesitli silindir oluştur.
    var halfL = p.length / 2;
    var pts = [
      new THREE.Vector2(p.innerRadius, -halfL),
      new THREE.Vector2(p.outerRadius, -halfL),
      new THREE.Vector2(p.outerRadius,  halfL),
      new THREE.Vector2(p.innerRadius,  halfL),
      new THREE.Vector2(p.innerRadius, -halfL)
    ];
    geometry = new THREE.LatheGeometry(pts, p.segments);
    // LatheGeometry Y ekseni etrafında döner — silindir gibi
  } else if(type === 'rectTube') {
    // Dikdörtgen profil = dış kutu - iç kutu (ExtrudeGeometry ile delikli shape)
    var w2 = p.width / 2, h2 = p.height / 2;
    var iw2 = (p.width / 2) - p.thickness;
    var ih2 = (p.height / 2) - p.thickness;
    var shape = new THREE.Shape();
    shape.moveTo(-w2, -h2);
    shape.lineTo( w2, -h2);
    shape.lineTo( w2,  h2);
    shape.lineTo(-w2,  h2);
    shape.lineTo(-w2, -h2);
    if (iw2 > 0 && ih2 > 0) {
      var hole = new THREE.Path();
      hole.moveTo(-iw2, -ih2);
      hole.lineTo( iw2, -ih2);
      hole.lineTo( iw2,  ih2);
      hole.lineTo(-iw2,  ih2);
      hole.lineTo(-iw2, -ih2);
      shape.holes.push(hole);
    }
    geometry = new THREE.ExtrudeGeometry(shape, { depth: p.length, bevelEnabled: false, steps: 1 });
    // ExtrudeGeometry Z ekseninde +depth uzar; merkezi (cx, cy, depth/2)
    // bizim convention'ımız: bbox merkezi orijin → translate Z by -depth/2
    geometry.translate(0, 0, -p.length / 2);
  }

  if(!geometry) return null;

  // Standart malzeme
  var material = new THREE.MeshStandardMaterial({
    color: 0x3b82f6,
    metalness: 0.3,
    roughness: 0.55,
    side: THREE.DoubleSide,
    flatShading: false
  });

  var mesh = new THREE.Mesh(geometry, material);
  mesh.userData.feaPrimitive = { type: type, params: p };

  // Tel çerçeve overlay — geometriyi görselleştirmeyi kolaylaştırır
  var edges = new THREE.EdgesGeometry(geometry, 30);
  var line = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: 0x1a3d6b, linewidth: 1 }));
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
