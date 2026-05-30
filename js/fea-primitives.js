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
//
// ─── YENİ PRİMİTİF EKLEME (MİNİMUM 2 ADIM) ──────────────────────────────────
// veFEABuildPrimitiveMesh TEK DOĞRULUK KAYNAĞI. Onu implement ettiğin sürece
// stats / topology / mesh OTOMATİK türetilir (Three.js mesh'ten generic
// fallback'ler devreye girer):
//
//   ZORUNLU:
//   1) VE_FEA_PRIMITIVES[type] = { label, schema: [...] } ekle
//   2) _veFEABuildXxxMesh(p) fonksiyonu yaz, THREE.Mesh/Group dön
//      + veFEABuildPrimitiveMesh dispatch'ine eklenmeli
//
//   OPSİYONEL (performans/kalite optimizasyonu):
//   3) veFEAPrimitiveStats() içine analitik formül ekle (yoksa Three.js mesh'ten
//      hesaplanır — biraz daha yavaş ama doğru sonuç)
//   4) veFEANormalizePrimitiveParams() içine validasyon kuralı ekle (yoksa
//      schema clamp/integer kuralları yeterli olabilir)
//   5) fea-topology.js içine _veFEAToplXxx() ekle (yoksa _veFEAToplGeneric
//      normal-clustering ile face'leri otomatik çıkarır)
//   6) fea-mesh.js içine _veFEAMeshXxx() ekle (yoksa _veFEAMeshGenericPrimitive
//      voxel + boundary-snap → tet4 path'i kullanılır)
//
// Adım 3-6'yı atlamak SORUN DEĞİL — fallback'ler "Desteklenmeyen tip" hatası
// üretmez. Generic mesh ve generic topology gerçek bir kullanıcı için
// yeterli kalitede sonuç verir.
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
  },
  'washer': {
    label: 'Pul / Conta / Bilezik',
    schema: [
      { key: 'outerRadius', label: 'Dış Yarıçap',   unit: 'mm', default: 12,  min: 0.5, max: 1000 },
      { key: 'innerRadius', label: 'İç Yarıçap',    unit: 'mm', default: 5,   min: 0,   max: 1000 },
      { key: 'thickness',   label: 'Kalınlık',      unit: 'mm', default: 1.5, min: 0.1, max: 200 },
      { key: 'segments',    label: 'Çevresel Segment', unit: '−', default: 48, min: 8, max: 256, integer: true }
    ]
  },
  'bolt': {
    label: 'Cıvata (altıgen başlık)',
    schema: [
      { key: 'headWidth',   label: 'Başlık Anahtar Ağzı (across-flats)', unit: 'mm', default: 13, min: 1,   max: 500 },
      { key: 'headHeight',  label: 'Başlık Yüksekliği',                  unit: 'mm', default: 5.5, min: 0.5, max: 200 },
      { key: 'shaftDiameter', label: 'Gövde Çapı',                       unit: 'mm', default: 8,  min: 0.5, max: 200 },
      { key: 'shaftLength', label: 'Gövde Uzunluğu',                     unit: 'mm', default: 30, min: 1,   max: 2000 }
    ]
  },
  'nut': {
    label: 'Somun (altıgen)',
    schema: [
      { key: 'width',     label: 'Anahtar Ağzı (across-flats)', unit: 'mm', default: 13, min: 1,   max: 500 },
      { key: 'thickness', label: 'Kalınlık',                    unit: 'mm', default: 6.5, min: 0.5, max: 200 },
      { key: 'holeDiameter', label: 'Delik Çapı',               unit: 'mm', default: 8,  min: 0.1, max: 200 }
    ]
  },
  'plate': {
    label: 'Delikli Levha (Mounting Plate)',
    schema: [
      { key: 'length',    label: 'Uzunluk (X)',     unit: 'mm', default: 120, min: 5, max: 5000 },
      { key: 'width',     label: 'Genişlik (Y)',    unit: 'mm', default: 80,  min: 5, max: 5000 },
      { key: 'thickness', label: 'Kalınlık (Z)',    unit: 'mm', default: 8,   min: 0.5, max: 500 },
      { key: 'holeDiameter', label: 'Delik Çapı',   unit: 'mm', default: 9,   min: 0.1, max: 500 },
      { key: 'cols',      label: 'Sütun Sayısı (X)', unit: '−', default: 2, min: 1, max: 20, integer: true },
      { key: 'rows',      label: 'Satır Sayısı (Y)', unit: '−', default: 2, min: 1, max: 20, integer: true },
      { key: 'margin',    label: 'Kenardan Boşluk',  unit: 'mm', default: 15, min: 0, max: 500 }
    ]
  },

  // ─── BENCHMARK GEOMETRİLERİ ────────────────────────────────────────────────
  // Aşağıdaki dört geometri, basit primitiflerin aksine bilinçli olarak
  // tip-spesifik (structured) bir mesher'a SAHİP DEĞİLDİR. Bu sayede mesh
  // motoru onları generic yola (üçgen çıkarımı → voxel → ray-cast → tet4 →
  // boundary-snap) sokar ve "kurduğumuz mesh matematiğini" zorlar. Her biri
  // farklı bir zorluk sınıfını hedefler (boss/kaburga kaynaşması, bolt-circle
  // delik dizisi, dar boşluk + pim deliği, ince sliver kaburgalar).
  'oilFilterBracket': {
    label: 'Yağ Filtresi Üst Braketi',
    schema: [
      { key: 'baseLength',    label: 'Taban Uzunluğu (X)',     unit: 'mm', default: 90, min: 20, max: 2000 },
      { key: 'baseWidth',     label: 'Taban Genişliği (Z)',    unit: 'mm', default: 60, min: 20, max: 2000 },
      { key: 'baseThickness', label: 'Taban Kalınlığı (Y)',    unit: 'mm', default: 8,  min: 1,  max: 200 },
      { key: 'bossOuterDiameter', label: 'Boss Dış Çapı',      unit: 'mm', default: 40, min: 5,  max: 1000 },
      { key: 'bossInnerDiameter', label: 'Filtre Yuvası İç Çapı', unit: 'mm', default: 28, min: 0, max: 1000 },
      { key: 'bossHeight',    label: 'Boss Yüksekliği',        unit: 'mm', default: 35, min: 2,  max: 1000 },
      { key: 'mountHoleDiameter', label: 'Montaj Delik Çapı',  unit: 'mm', default: 9,  min: 0,  max: 200 },
      { key: 'ribThickness',  label: 'Kaburga Kalınlığı',      unit: 'mm', default: 5,  min: 0,  max: 200 }
    ]
  },
  'pipeFlange': {
    label: 'Boru Flanşı (Bolt-Circle)',
    schema: [
      { key: 'flangeDiameter',  label: 'Flanş Dış Çapı',        unit: 'mm', default: 120, min: 20, max: 3000 },
      { key: 'flangeThickness', label: 'Flanş Kalınlığı',       unit: 'mm', default: 12,  min: 2,  max: 500 },
      { key: 'neckDiameter',    label: 'Boyun Dış Çapı',        unit: 'mm', default: 50,  min: 5,  max: 2000 },
      { key: 'neckHeight',      label: 'Boyun Yüksekliği',      unit: 'mm', default: 40,  min: 0,  max: 2000 },
      { key: 'boreDiameter',    label: 'Merkez Delik (Bore) Çapı', unit: 'mm', default: 32, min: 1, max: 2000 },
      { key: 'boltCircleDiameter', label: 'Cıvata Daire Çapı (BCD)', unit: 'mm', default: 95, min: 5, max: 2800 },
      { key: 'boltHoleDiameter', label: 'Cıvata Delik Çapı',    unit: 'mm', default: 11,  min: 1,  max: 300 },
      { key: 'boltCount',       label: 'Cıvata Sayısı',         unit: '−',  default: 6,   min: 2,  max: 24, integer: true }
    ]
  },
  'clevis': {
    label: 'Çatal Mafsal (Clevis / Yoke)',
    schema: [
      { key: 'baseDepth',       label: 'Taban/Kulak Derinliği (Z)', unit: 'mm', default: 30, min: 5, max: 1000 },
      { key: 'baseHeight',      label: 'Taban Yüksekliği (Y)',  unit: 'mm', default: 15, min: 2,  max: 1000 },
      { key: 'earThickness',    label: 'Kulak Kalınlığı (X, her biri)', unit: 'mm', default: 8, min: 1, max: 500 },
      { key: 'earHeight',       label: 'Kulak Yüksekliği',      unit: 'mm', default: 35, min: 5,  max: 1500 },
      { key: 'gap',             label: 'Kulaklar Arası Boşluk', unit: 'mm', default: 16, min: 1,  max: 1000 },
      { key: 'pinHoleDiameter', label: 'Pim Delik Çapı',        unit: 'mm', default: 12, min: 0,  max: 800 }
    ]
  },
  'gussetBracket': {
    label: 'Kaburgalı/Gussetli Braket',
    schema: [
      { key: 'wallHeight',     label: 'Dikey Duvar Yüksekliği (Y)', unit: 'mm', default: 80, min: 10, max: 3000 },
      { key: 'shelfLength',    label: 'Yatay Raf Uzunluğu (Z)', unit: 'mm', default: 70, min: 10, max: 3000 },
      { key: 'width',          label: 'Genişlik (X)',           unit: 'mm', default: 60, min: 10, max: 3000 },
      { key: 'plateThickness', label: 'Duvar/Raf Kalınlığı',    unit: 'mm', default: 8,  min: 1,  max: 300 },
      { key: 'gussetThickness', label: 'Kaburga Kalınlığı (ince)', unit: 'mm', default: 5, min: 0, max: 200 },
      { key: 'gussetCount',    label: 'Kaburga Sayısı',         unit: '−',  default: 2,  min: 0,  max: 10, integer: true },
      { key: 'holeDiameter',   label: 'Cıvata Delik Çapı',      unit: 'mm', default: 9,  min: 0,  max: 200 }
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
  // Washer: iç yarıçap < dış yarıçap (eşit veya büyükse 1mm fark zorla)
  if(type === 'washer' && out.innerRadius >= out.outerRadius) {
    out.innerRadius = Math.max(0, out.outerRadius - 1);
  }
  // Nut: delik çapı altıgenin dairesel sığma limitinden küçük olmalı
  if(type === 'nut') {
    var nutHexR = out.width / Math.sqrt(3);
    if(out.holeDiameter / 2 >= nutHexR) {
      out.holeDiameter = Math.max(0.1, nutHexR * 2 - 0.5);
    }
  }
  // Bolt: gövde çapı başlık genişliğinden küçük olmalı (geometrik tutarlılık)
  if(type === 'bolt') {
    var headInnerR = out.headWidth / Math.sqrt(3);
    if(out.shaftDiameter / 2 >= headInnerR) {
      out.shaftDiameter = Math.max(0.5, headInnerR * 2 - 1);
    }
  }
  // Plate: delik çapı boşlukları aşmamalı
  if(type === 'plate') {
    var maxHoleD = Math.max(0.1, Math.min(out.length, out.width) * 0.4);
    if(out.holeDiameter > maxHoleD) out.holeDiameter = maxHoleD;
  }
  // Oil filter bracket: boss tabanın içine sığmalı, iç delik dış çaptan küçük
  if(type === 'oilFilterBracket') {
    var maxBossD = Math.min(out.baseLength, out.baseWidth) - 2;
    if(out.bossOuterDiameter > maxBossD) out.bossOuterDiameter = Math.max(5, maxBossD);
    if(out.bossInnerDiameter >= out.bossOuterDiameter) {
      out.bossInnerDiameter = Math.max(0, out.bossOuterDiameter - 4);
    }
    // Montaj deliği taban köşesinin yarısından küçük olmalı
    var maxMountD = Math.max(0, Math.min(out.baseLength, out.baseWidth) * 0.25);
    if(out.mountHoleDiameter > maxMountD) out.mountHoleDiameter = maxMountD;
  }
  // Pipe flange: boyun/bore/bolt-circle flanş içine sığmalı
  if(type === 'pipeFlange') {
    if(out.neckDiameter >= out.flangeDiameter) out.neckDiameter = Math.max(5, out.flangeDiameter - 4);
    if(out.boreDiameter >= out.neckDiameter)   out.boreDiameter = Math.max(1, out.neckDiameter - 2);
    // Bolt-circle + delik flanş kenarı ile boyun arasında kalmalı
    var maxBcd = out.flangeDiameter - out.boltHoleDiameter - 2;
    if(out.boltCircleDiameter > maxBcd) out.boltCircleDiameter = Math.max(out.neckDiameter + out.boltHoleDiameter, maxBcd);
    var minBcd = out.neckDiameter + out.boltHoleDiameter + 2;
    if(out.boltCircleDiameter < minBcd) out.boltCircleDiameter = Math.min(maxBcd, minBcd);
    // Cıvata delikleri çakışmasın: çevre / sayı > delik çapı
    var pitch = Math.PI * out.boltCircleDiameter / Math.max(1, out.boltCount);
    if(out.boltHoleDiameter >= pitch * 0.9) out.boltHoleDiameter = Math.max(1, pitch * 0.6);
  }
  // Clevis: pim deliği kulak derinliğine sığmalı
  if(type === 'clevis') {
    var maxPinD = out.baseDepth - 2;
    if(out.pinHoleDiameter > maxPinD) out.pinHoleDiameter = Math.max(0, maxPinD);
  }
  // Gusset bracket: kaburga/plaka kalınlıkları makul kalsın
  if(type === 'gussetBracket') {
    var maxPlateT = Math.min(out.wallHeight, out.shelfLength) / 3;
    if(out.plateThickness > maxPlateT) out.plateThickness = Math.max(1, maxPlateT);
    if(out.gussetThickness > out.width) out.gussetThickness = out.width;
    var maxGHoleD = Math.max(0, out.width * 0.3);
    if(out.holeDiameter > maxGHoleD) out.holeDiameter = maxGHoleD;
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
  } else if(type === 'washer') {
    var RW = p.outerRadius, rW = p.innerRadius, tW = p.thickness;
    var annulusArea = Math.PI * (RW * RW - rW * rW);
    volume = annulusArea * tW;
    // 2 düz halka yüzey + dış silindir yan + iç silindir yan
    surfaceArea = 2 * annulusArea + 2 * Math.PI * RW * tW + 2 * Math.PI * rW * tW;
    bbox = { x: 2 * RW, y: tW, z: 2 * RW };
  } else if(type === 'nut') {
    var hexR_N = p.width / Math.sqrt(3);
    // Düzenli altıgen alanı = (3√3/2) × R²
    var hexAreaN = (3 * Math.sqrt(3) / 2) * hexR_N * hexR_N;
    var holeRN = p.holeDiameter / 2;
    var holeArea = Math.PI * holeRN * holeRN;
    var crossN = hexAreaN - holeArea;
    volume = crossN * p.thickness;
    // 2 üst/alt yüz + 6 yan dikdörtgen + iç silindir yan
    surfaceArea = 2 * crossN + 6 * p.width * p.thickness + 2 * Math.PI * holeRN * p.thickness;
    // BBox: altıgenin köşe-köşe mesafesi = 2R, anahtar ağzı = width
    bbox = { x: 2 * hexR_N, y: p.thickness, z: 2 * hexR_N };
  } else if(type === 'bolt') {
    var hexR_B = p.headWidth / Math.sqrt(3);
    var headArea = (3 * Math.sqrt(3) / 2) * hexR_B * hexR_B;
    var headVol = headArea * p.headHeight;
    var shaftR = p.shaftDiameter / 2;
    var shaftVol = Math.PI * shaftR * shaftR * p.shaftLength;
    volume = headVol + shaftVol;
    // Yüzey: başlık (2 hex - shaft kesit) + 6 yan + gövde yan + gövde alt
    var headTop = headArea;
    var headBottom = headArea - Math.PI * shaftR * shaftR;
    var headSides = 6 * p.headWidth * p.headHeight;
    var shaftSide = 2 * Math.PI * shaftR * p.shaftLength;
    var shaftBottom = Math.PI * shaftR * shaftR;
    surfaceArea = headTop + headBottom + headSides + shaftSide + shaftBottom;
    bbox = { x: 2 * hexR_B, y: p.headHeight + p.shaftLength, z: 2 * hexR_B };
  } else if(type === 'plate') {
    var pL = p.length, pW = p.width, pT = p.thickness;
    var plateArea = pL * pW;
    var holeR_P = p.holeDiameter / 2;
    // Effective hole count (kenara taşmayanları say)
    var validHoles = Math.max(1, p.cols) * Math.max(1, p.rows);
    var totalHoleArea = validHoles * Math.PI * holeR_P * holeR_P;
    var crossP = Math.max(0, plateArea - totalHoleArea);
    volume = crossP * pT;
    // 2 üst/alt yüz + 4 yan + delik iç silindir yan'ları
    surfaceArea = 2 * crossP + 2 * (pL + pW) * pT + validHoles * 2 * Math.PI * holeR_P * pT;
    bbox = { x: pL, y: pT, z: pW };
  } else if(type === 'oilFilterBracket') {
    var ofbL = p.baseLength, ofbW = p.baseWidth, ofbT = p.baseThickness;
    var ofbBoR = p.bossOuterDiameter / 2, ofbBiR = p.bossInnerDiameter / 2, ofbBh = p.bossHeight;
    var ofbMr = p.mountHoleDiameter / 2;
    var ofbRt = p.ribThickness;
    var ofbRibReach = Math.max(0, (ofbL / 2 - ofbBoR) * 0.8);
    var ofbRibRise = ofbBh * 0.7;
    var ofbRibArea = 0.5 * ofbRibReach * ofbRibRise;
    // Taban − boss iç deliği (tabanı deler) − 4 montaj deliği
    var ofbBaseVol = ofbL * ofbW * ofbT - Math.PI * ofbBiR * ofbBiR * ofbT - 4 * Math.PI * ofbMr * ofbMr * ofbT;
    var ofbBossVol = Math.PI * (ofbBoR * ofbBoR - ofbBiR * ofbBiR) * ofbBh;
    var ofbRibVol = (ofbRt > 0 ? 2 : 0) * ofbRibArea * ofbRt;
    volume = Math.max(0, ofbBaseVol) + ofbBossVol + ofbRibVol;
    var ofbHip = Math.sqrt(ofbRibReach * ofbRibReach + ofbRibRise * ofbRibRise);
    surfaceArea =
      2 * ofbL * ofbW                                  // taban üst + alt
      + 2 * (ofbL + ofbW) * ofbT                       // taban yan
      + 2 * Math.PI * ofbBoR * ofbBh                   // boss dış yan
      + 2 * Math.PI * ofbBiR * (ofbBh + ofbT)          // delik iç yan (taban boyunca)
      + Math.PI * (ofbBoR * ofbBoR - ofbBiR * ofbBiR)  // boss üst halka
      + 4 * 2 * Math.PI * ofbMr * ofbT                 // montaj delik iç yan
      + (ofbRt > 0 ? 2 : 0) * (2 * ofbRibArea + (ofbRibReach + ofbRibRise + ofbHip) * ofbRt); // kaburgalar
    bbox = { x: ofbL, y: ofbT + ofbBh, z: ofbW };
  } else if(type === 'pipeFlange') {
    var pfFr = p.flangeDiameter / 2, pfFt = p.flangeThickness;
    var pfNr = p.neckDiameter / 2, pfNh = p.neckHeight;
    var pfBr = p.boreDiameter / 2;
    var pfBoltR = p.boltHoleDiameter / 2, pfN = p.boltCount;
    var pfFlangeVol = Math.PI * pfFr * pfFr * pfFt - Math.PI * pfBr * pfBr * pfFt - pfN * Math.PI * pfBoltR * pfBoltR * pfFt;
    var pfNeckVol = Math.PI * (pfNr * pfNr - pfBr * pfBr) * pfNh;
    volume = Math.max(0, pfFlangeVol) + Math.max(0, pfNeckVol);
    surfaceArea =
      2 * Math.PI * pfFr * pfFr                         // flanş üst + alt
      - 2 * Math.PI * pfBr * pfBr - 2 * pfN * Math.PI * pfBoltR * pfBoltR // eksi delik kapakları
      + 2 * Math.PI * pfFr * pfFt                       // flanş dış kenar
      + 2 * Math.PI * pfBr * (pfFt + pfNh)              // bore iç yan
      + pfN * 2 * Math.PI * pfBoltR * pfFt              // cıvata delik iç yan
      + 2 * Math.PI * pfNr * pfNh                       // boyun dış yan
      + Math.PI * (pfNr * pfNr - pfBr * pfBr);          // boyun üst halka
    bbox = { x: p.flangeDiameter, y: pfFt + pfNh, z: p.flangeDiameter };
  } else if(type === 'clevis') {
    var clBd = p.baseDepth, clBh = p.baseHeight, clEt = p.earThickness;
    var clEh = p.earHeight, clGap = p.gap, clPinR = p.pinHoleDiameter / 2;
    var clBaseW = clGap + 2 * clEt;
    var clEarR = clBd / 2;
    var clEarArea = clBd * clEh + 0.5 * Math.PI * clEarR * clEarR - Math.PI * clPinR * clPinR;
    volume = clBaseW * clBh * clBd + 2 * Math.max(0, clEarArea) * clEt;
    var clEarPerim = 2 * clEh + clBd + Math.PI * clEarR; // dik kenarlar + alt + yarım daire yay
    surfaceArea =
      2 * clBaseW * clBd + 2 * (clBaseW + clBd) * clBh   // taban
      + 2 * (2 * clEarArea + clEarPerim * clEt)          // 2 kulak yüz + kenar
      + 2 * 2 * Math.PI * clPinR * clEt;                 // 2 pim deliği iç yan
    bbox = { x: clBaseW, y: clBh + clEh + clEarR, z: clBd };
  } else if(type === 'gussetBracket') {
    var gbWh = p.wallHeight, gbSl = p.shelfLength, gbW = p.width;
    var gbPt = p.plateThickness, gbGt = p.gussetThickness, gbGc = p.gussetCount;
    var gbHr = p.holeDiameter / 2;
    var gbGRise = gbWh * 0.7, gbGRun = gbSl * 0.7;
    var gbGArea = 0.5 * gbGRise * gbGRun;
    var gbWallVol = gbW * gbWh * gbPt - 2 * Math.PI * gbHr * gbHr * gbPt; // 2 cıvata deliği
    var gbShelfVol = gbW * gbSl * gbPt;
    var gbGussetVol = (gbGt > 0 ? gbGc : 0) * gbGArea * gbGt;
    // Duvar rafın ÜSTÜNDE durur (y = pt'den başlar) → hacimsel örtüşme yok,
    // sadece L köşesinde temas. (Even-odd voxel mesher'da örtüşme XOR boşluk
    // yaratırdı; tam temas bağlı katı verir.)
    volume = Math.max(0, gbWallVol) + gbShelfVol + gbGussetVol;
    var gbGHip = Math.sqrt(gbGRise * gbGRise + gbGRun * gbGRun);
    surfaceArea =
      2 * gbW * gbWh - 2 * 2 * Math.PI * gbHr * gbHr     // duvar yüzleri − delik kapakları
      + 2 * gbW * gbSl                                   // raf yüzleri
      + 2 * (gbWh + gbSl) * gbPt                         // dış kenar şeritleri (yaklaşık)
      + 2 * 2 * Math.PI * gbHr * gbPt                    // cıvata delik iç yan
      + (gbGt > 0 ? gbGc : 0) * (2 * gbGArea + (gbGRise + gbGRun + gbGHip) * gbGt); // kaburgalar
    bbox = { x: gbW, y: gbPt + gbWh, z: gbSl }; // duvar rafın üstünde
  }

  // GENERIC STATS FALLBACK: Tip-spesifik case eşleşmediyse Three.js mesh'inden
  // hesapla. Bu sayede yeni primitif eklerken sadece schema + build fonksiyonu
  // gerekir — stats otomatik türetilir. Type-spesifik analitik formüller
  // performans/doğruluk açısından opsiyonel ekleme.
  if (volume === 0 && surfaceArea === 0 && !bbox) {
    var gen = _veFEAStatsFromMesh(type, p);
    if (gen) return gen;
  }

  return { volume: volume, surfaceArea: surfaceArea, bbox: bbox, params: p };
}

// Three.js mesh'inden hacim/yüzey alanı/bbox hesapla. Generic fallback.
// volume: signed tetrahedra (kapalı manifold için doğru, açık yüzey için
// "outside-origin" işaretli — kullanıcı abs() alabilir).
// surfaceArea: triangle area sum (matrixWorld uygulanmış).
function _veFEAStatsFromMesh(type, p) {
  if (typeof THREE === 'undefined' || typeof veFEABuildPrimitiveMesh !== 'function') return null;
  var meshOrGroup;
  try { meshOrGroup = veFEABuildPrimitiveMesh(type, p); }
  catch (e) { return null; }
  if (!meshOrGroup) return null;
  meshOrGroup.updateMatrixWorld(true);

  var box = new THREE.Box3();
  var totalVolume = 0;
  var totalArea = 0;
  meshOrGroup.traverse(function (o) {
    if (!o.isMesh || !o.geometry) return;
    var geo = o.geometry;
    var pos = geo.attributes.position;
    if (!pos) return;
    var idx = geo.index;
    var triCount = idx ? idx.count / 3 : pos.count / 3;
    var v1 = new THREE.Vector3(), v2 = new THREE.Vector3(), v3 = new THREE.Vector3();
    var cb = new THREE.Vector3(), ab = new THREE.Vector3();
    for (var i = 0; i < triCount; i++) {
      var a, b, c;
      if (idx) { a = idx.getX(i*3); b = idx.getX(i*3+1); c = idx.getX(i*3+2); }
      else     { a = i*3; b = i*3+1; c = i*3+2; }
      v1.fromBufferAttribute(pos, a); v2.fromBufferAttribute(pos, b); v3.fromBufferAttribute(pos, c);
      v1.applyMatrix4(o.matrixWorld); v2.applyMatrix4(o.matrixWorld); v3.applyMatrix4(o.matrixWorld);
      box.expandByPoint(v1); box.expandByPoint(v2); box.expandByPoint(v3);
      cb.subVectors(v3, v2); ab.subVectors(v1, v2); cb.cross(ab);
      totalArea += cb.length() * 0.5;
      var cross = new THREE.Vector3().crossVectors(v2, v3);
      totalVolume += v1.dot(cross) / 6;
    }
  });

  var size = new THREE.Vector3();
  box.getSize(size);
  return {
    volume: Math.abs(totalVolume),
    surfaceArea: totalArea,
    bbox: { x: size.x, y: size.y, z: size.z },
    params: p,
    generic: true
  };
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
  if(type === 'washer')   return _veFEABuildWasherMesh(p);
  if(type === 'bolt')     return _veFEABuildBoltGroup(p);
  if(type === 'nut')      return _veFEABuildNutMesh(p);
  if(type === 'plate')    return _veFEABuildPlateMesh(p);
  if(type === 'oilFilterBracket') return _veFEABuildOilFilterBracketGroup(p);
  if(type === 'pipeFlange')       return _veFEABuildPipeFlangeGroup(p);
  if(type === 'clevis')           return _veFEABuildClevisGroup(p);
  if(type === 'gussetBracket')    return _veFEABuildGussetBracketGroup(p);
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

// ─── Pul / Conta / Bilezik — annular extrude (dış disk + iç delik) ─────────
// Şaft'tan farkı: kalınlık çok daha küçük (oran 1:5 ile 1:50). Tek mesh,
// görsel olarak yassı bilezik. FEA için tipik kullanım: sızdırmazlık conta,
// ayarlama pulu (washer), motor blok cıvata bilezikleri.
function _veFEABuildWasherMesh(p) {
  var shape = new THREE.Shape();
  shape.absarc(0, 0, p.outerRadius, 0, Math.PI * 2, false);
  if (p.innerRadius > 0 && p.innerRadius < p.outerRadius) {
    var hole = new THREE.Path();
    hole.absarc(0, 0, p.innerRadius, 0, Math.PI * 2, true);
    shape.holes.push(hole);
  }
  var geometry = new THREE.ExtrudeGeometry(shape, {
    depth: p.thickness, bevelEnabled: false, steps: 1, curveSegments: p.segments
  });
  geometry.translate(0, 0, -p.thickness / 2);
  geometry.rotateX(-Math.PI / 2); // XZ düzlemi (yatay pul)
  var material = _veFEAMakePrimitiveMaterial();
  var mesh = new THREE.Mesh(geometry, material);
  mesh.userData.feaPrimitive = { type: 'washer', params: p };
  mesh.userData.feaFaceId = 'faceSurface';
  mesh.userData.feaEdgesAttached = true;

  var edges = new THREE.EdgesGeometry(geometry, 30);
  var line = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: 0x1a3d6b }));
  mesh.add(line);
  return mesh;
}

// ─── Somun — altıgen prizma (6-segment CylinderGeometry) + merkez delik ────
// Anahtar ağzı (across-flats = width) → altıgen yarıçapı = width / √3.
// Üst görünüş: altıgen. Yan profil: dikdörtgen.
function _veFEABuildNutMesh(p) {
  var hexRadius = p.width / Math.sqrt(3); // across-flats → circumradius
  var hexOuterShape = new THREE.Shape();
  // 6 köşeli yıldız: 30° başlangıç → düz yüzey üstte
  for (var i = 0; i < 6; i++) {
    var ang = Math.PI / 6 + i * Math.PI / 3;
    var x = hexRadius * Math.cos(ang);
    var y = hexRadius * Math.sin(ang);
    if (i === 0) hexOuterShape.moveTo(x, y);
    else hexOuterShape.lineTo(x, y);
  }
  if (p.holeDiameter > 0 && p.holeDiameter / 2 < hexRadius) {
    var hole = new THREE.Path();
    hole.absarc(0, 0, p.holeDiameter / 2, 0, Math.PI * 2, true);
    hexOuterShape.holes.push(hole);
  }
  var geometry = new THREE.ExtrudeGeometry(hexOuterShape, {
    depth: p.thickness, bevelEnabled: false, steps: 1, curveSegments: 32
  });
  geometry.translate(0, 0, -p.thickness / 2);
  geometry.rotateX(-Math.PI / 2);
  var material = _veFEAMakePrimitiveMaterial();
  var mesh = new THREE.Mesh(geometry, material);
  mesh.userData.feaPrimitive = { type: 'nut', params: p };
  mesh.userData.feaFaceId = 'faceSurface';
  mesh.userData.feaEdgesAttached = true;

  var edges = new THREE.EdgesGeometry(geometry, 30);
  var line = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: 0x1a3d6b }));
  mesh.add(line);
  return mesh;
}

// ─── Cıvata — altıgen başlık (üst) + silindirik gövde (alt) ─────────────────
// Group içinde 2 child mesh: faceHead, faceShaft. Başlık y=0'da, gövde
// aşağı doğru uzanır.
function _veFEABuildBoltGroup(p) {
  var group = new THREE.Group();
  group.userData.feaPrimitive = { type: 'bolt', params: p };

  // Başlık: altıgen prizma
  var hexRadius = p.headWidth / Math.sqrt(3);
  var hexShape = new THREE.Shape();
  for (var i = 0; i < 6; i++) {
    var ang = Math.PI / 6 + i * Math.PI / 3;
    var x = hexRadius * Math.cos(ang);
    var y = hexRadius * Math.sin(ang);
    if (i === 0) hexShape.moveTo(x, y);
    else hexShape.lineTo(x, y);
  }
  var headGeo = new THREE.ExtrudeGeometry(hexShape, {
    depth: p.headHeight, bevelEnabled: false, steps: 1, curveSegments: 32
  });
  headGeo.translate(0, 0, 0); // 0 → headHeight (Z+)
  headGeo.rotateX(-Math.PI / 2);
  // Y ekseninde 0..headHeight aralığında başlık
  var headMat = _veFEAMakePrimitiveMaterial();
  var headMesh = new THREE.Mesh(headGeo, headMat);
  headMesh.userData.feaFaceId = 'faceHead';
  group.add(headMesh);

  // Gövde: silindir, başlığın alt yüzeyinden aşağı doğru
  var shaftGeo = new THREE.CylinderGeometry(
    p.shaftDiameter / 2, p.shaftDiameter / 2, p.shaftLength, 32, 1, false
  );
  // CylinderGeometry default merkez orijin. Gövde tepesi y=0'da olsun → -shaftLength/2
  shaftGeo.translate(0, -p.shaftLength / 2, 0);
  var shaftMat = _veFEAMakePrimitiveMaterial();
  var shaftMesh = new THREE.Mesh(shaftGeo, shaftMat);
  shaftMesh.userData.feaFaceId = 'faceShaft';
  group.add(shaftMesh);

  // BBox'ı merkez (~headHeight/2) etrafında ortalamak için tüm grubu kaydır
  // Tüm civata uzunluğu = headHeight + shaftLength
  var totalH = p.headHeight + p.shaftLength;
  group.position.y = (p.shaftLength - p.headHeight) / 2;

  // Edge overlay
  [headMesh, shaftMesh].forEach(function(m) {
    var e = new THREE.EdgesGeometry(m.geometry, 30);
    var l = new THREE.LineSegments(e, new THREE.LineBasicMaterial({ color: 0x1a3d6b, transparent: true, opacity: 0.6 }));
    m.add(l);
  });
  return group;
}

// ─── Delikli Levha — dikdörtgen + grid pattern delikler (ExtrudeGeometry) ──
// Delikler: cols × rows grid, kenardan margin boşlukla. cols=rows=1 ise tek
// merkez delik. Motor mounts, şanzıman flanş plakaları için tipik.
function _veFEABuildPlateMesh(p) {
  var L = p.length, W = p.width;
  var L2 = L / 2, W2 = W / 2;
  var shape = new THREE.Shape();
  shape.moveTo(-L2, -W2);
  shape.lineTo(L2, -W2);
  shape.lineTo(L2, W2);
  shape.lineTo(-L2, W2);
  shape.lineTo(-L2, -W2);

  var r = p.holeDiameter / 2;
  var cols = Math.max(1, p.cols), rows = Math.max(1, p.rows);
  var availX = L - 2 * p.margin;
  var availY = W - 2 * p.margin;
  if (r > 0 && availX > 0 && availY > 0) {
    for (var i = 0; i < cols; i++) {
      for (var j = 0; j < rows; j++) {
        var x = (cols === 1) ? 0 : -availX / 2 + (i * availX / (cols - 1));
        var y = (rows === 1) ? 0 : -availY / 2 + (j * availY / (rows - 1));
        // Delik kenara taşmıyorsa ekle
        if (Math.abs(x) + r <= L2 && Math.abs(y) + r <= W2) {
          var hole = new THREE.Path();
          hole.absarc(x, y, r, 0, Math.PI * 2, true);
          shape.holes.push(hole);
        }
      }
    }
  }

  var geometry = new THREE.ExtrudeGeometry(shape, {
    depth: p.thickness, bevelEnabled: false, steps: 1, curveSegments: 24
  });
  geometry.translate(0, 0, -p.thickness / 2);
  geometry.rotateX(-Math.PI / 2); // XZ düzlemi (yatay levha)
  var material = _veFEAMakePrimitiveMaterial();
  var mesh = new THREE.Mesh(geometry, material);
  mesh.userData.feaPrimitive = { type: 'plate', params: p };
  mesh.userData.feaFaceId = 'faceSurface';
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

// ─── BENCHMARK GEOMETRİ İNŞAÇILARI ──────────────────────────────────────────
// Bu dört geometri bilinçli olarak THREE.Group + birden çok child mesh ile
// kurulur. Parçalar HACİMSEL ÖRTÜŞMEDEN, ortak düzlemlerde TAM TEMAS edecek
// şekilde yerleştirilir: generic voxel mesher even-odd parite kullandığından
// (fea-mesh.js), örtüşen kapalı yüzeyler XOR (boşluk) üretir — temas ise
// bağlı bir katı verir. İnce kaburga / çok delik / eğri-düz kaynaşma gibi
// zorluklar bu sayede mesh motorunu "kıracak şekilde değil, zorlayacak
// şekilde" test eder.

// Ortak kenar (wireframe) overlay yardımcı fonksiyonu.
function _veFEAAttachEdges(mesh, opacity) {
  var hasOpacity = (opacity !== undefined && opacity !== null);
  var e = new THREE.EdgesGeometry(mesh.geometry, 30);
  var l = new THREE.LineSegments(e, new THREE.LineBasicMaterial({
    color: 0x1a3d6b, transparent: hasOpacity, opacity: hasOpacity ? opacity : 1
  }));
  mesh.add(l);
  return mesh;
}

// ─── Yağ Filtresi Üst Braketi ───────────────────────────────────────────────
// Delikli taban plakası + içi boş silindirik filtre boss'u + 2 köşegen kaburga.
// Zorluk: eğri boss ↔ düz taban kaynaşması, çok-ölçekli (ince kaburga + kalın
// boss), montaj delikleri + tabanı delen filtre yuvası, re-entrant köşeler.
function _veFEABuildOilFilterBracketGroup(p) {
  var group = new THREE.Group();
  group.userData.feaPrimitive = { type: 'oilFilterBracket', params: p };
  var L = p.baseLength, W = p.baseWidth, t = p.baseThickness;
  var boR = p.bossOuterDiameter / 2, biR = p.bossInnerDiameter / 2, bh = p.bossHeight;
  var mr = p.mountHoleDiameter / 2, rt = p.ribThickness;
  var L2 = L / 2, W2 = W / 2;

  // Taban plakası (XY shape, +Y extrude → yatay XZ levha)
  var baseShape = new THREE.Shape();
  baseShape.moveTo(-L2, -W2); baseShape.lineTo(L2, -W2);
  baseShape.lineTo(L2, W2);   baseShape.lineTo(-L2, W2); baseShape.lineTo(-L2, -W2);
  if (biR > 0) { // filtre yuvası tabanı da deler
    var bHole = new THREE.Path(); bHole.absarc(0, 0, biR, 0, Math.PI * 2, true); baseShape.holes.push(bHole);
  }
  if (mr > 0) { // 4 köşe montaj deliği (boss bölgesine girmeyenler)
    var mx = L2 - Math.max(mr + 2, L * 0.12);
    var my = W2 - Math.max(mr + 2, W * 0.12);
    [[-mx, -my], [mx, -my], [mx, my], [-mx, my]].forEach(function (c) {
      if (Math.sqrt(c[0] * c[0] + c[1] * c[1]) > boR + mr + 1) {
        var mHole = new THREE.Path(); mHole.absarc(c[0], c[1], mr, 0, Math.PI * 2, true);
        baseShape.holes.push(mHole);
      }
    });
  }
  var baseGeo = new THREE.ExtrudeGeometry(baseShape, { depth: t, bevelEnabled: false, steps: 1, curveSegments: 40 });
  baseGeo.rotateX(-Math.PI / 2); // extrude Z(0..t) → Y(0..t)
  var baseMesh = new THREE.Mesh(baseGeo, _veFEAMakePrimitiveMaterial());
  baseMesh.userData.feaFaceId = 'faceBase';
  group.add(_veFEAAttachEdges(baseMesh));

  // İçi boş silindirik boss — tabanın üstünde TAM TEMAS (y = t)
  var bossShape = new THREE.Shape();
  bossShape.absarc(0, 0, boR, 0, Math.PI * 2, false);
  if (biR > 0) { var biHole = new THREE.Path(); biHole.absarc(0, 0, biR, 0, Math.PI * 2, true); bossShape.holes.push(biHole); }
  var bossGeo = new THREE.ExtrudeGeometry(bossShape, { depth: bh, bevelEnabled: false, steps: 1, curveSegments: 48 });
  bossGeo.rotateX(-Math.PI / 2); // y: 0..bh
  bossGeo.translate(0, t, 0);    // tabanın üstüne
  var bossMesh = new THREE.Mesh(bossGeo, _veFEAMakePrimitiveMaterial());
  bossMesh.userData.feaFaceId = 'faceBoss';
  group.add(_veFEAAttachEdges(bossMesh));

  // 2 köşegen kaburga (gusset) — boss yan yüzünden tabana TAM TEMAS
  if (rt > 0) {
    var ribReach = Math.max(2, (L2 - boR) * 0.8);
    var ribRise = bh * 0.7;
    [1, -1].forEach(function (sign) {
      var rs = new THREE.Shape();
      rs.moveTo(sign * boR, t);
      rs.lineTo(sign * (boR + ribReach), t);
      rs.lineTo(sign * boR, t + ribRise);
      rs.lineTo(sign * boR, t);
      var rg = new THREE.ExtrudeGeometry(rs, { depth: rt, bevelEnabled: false, steps: 1 });
      rg.translate(0, 0, -rt / 2); // z=0 düzleminde merkez
      var rm = new THREE.Mesh(rg, _veFEAMakePrimitiveMaterial());
      rm.userData.feaFaceId = 'faceRib';
      group.add(_veFEAAttachEdges(rm, 0.6));
    });
  }

  group.position.y = -(t + bh) / 2; // bbox merkezine kaydır
  return group;
}

// ─── Boru Flanşı (Bolt-Circle) ───────────────────────────────────────────────
// Çok delikli flanş diski (merkez bore + N cıvata deliği) + içi boş boyun.
// Zorluk: eksensimetriyi kıran N adet eğri delik dizisi, kalın boyun ↔ ince
// flanş geçişi, çok sayıda yakın yerleşimli silindirik delik kenarı.
function _veFEABuildPipeFlangeGroup(p) {
  var group = new THREE.Group();
  group.userData.feaPrimitive = { type: 'pipeFlange', params: p };
  var Fr = p.flangeDiameter / 2, Ft = p.flangeThickness;
  var Nr = p.neckDiameter / 2, Nh = p.neckHeight;
  var Br = p.boreDiameter / 2;
  var bcR = p.boltCircleDiameter / 2, boltR = p.boltHoleDiameter / 2, N = p.boltCount;

  // Flanş diski — bore + N cıvata deliği
  var fShape = new THREE.Shape();
  fShape.absarc(0, 0, Fr, 0, Math.PI * 2, false);
  if (Br > 0) { var fBore = new THREE.Path(); fBore.absarc(0, 0, Br, 0, Math.PI * 2, true); fShape.holes.push(fBore); }
  for (var i = 0; i < N; i++) {
    var ang = (i / N) * Math.PI * 2;
    var bx = bcR * Math.cos(ang), by = bcR * Math.sin(ang);
    var bHole = new THREE.Path(); bHole.absarc(bx, by, boltR, 0, Math.PI * 2, true);
    fShape.holes.push(bHole);
  }
  var fGeo = new THREE.ExtrudeGeometry(fShape, { depth: Ft, bevelEnabled: false, steps: 1, curveSegments: 56 });
  fGeo.rotateX(-Math.PI / 2); // y: 0..Ft
  var fMesh = new THREE.Mesh(fGeo, _veFEAMakePrimitiveMaterial());
  fMesh.userData.feaFaceId = 'faceFlange';
  group.add(_veFEAAttachEdges(fMesh));

  // İçi boş boyun (hub) — flanşın üstünde TAM TEMAS (y = Ft)
  if (Nh > 0 && Nr > Br) {
    var nShape = new THREE.Shape();
    nShape.absarc(0, 0, Nr, 0, Math.PI * 2, false);
    if (Br > 0) { var nBore = new THREE.Path(); nBore.absarc(0, 0, Br, 0, Math.PI * 2, true); nShape.holes.push(nBore); }
    var nGeo = new THREE.ExtrudeGeometry(nShape, { depth: Nh, bevelEnabled: false, steps: 1, curveSegments: 48 });
    nGeo.rotateX(-Math.PI / 2);
    nGeo.translate(0, Ft, 0);
    var nMesh = new THREE.Mesh(nGeo, _veFEAMakePrimitiveMaterial());
    nMesh.userData.feaFaceId = 'faceNeck';
    group.add(_veFEAAttachEdges(nMesh));
  }

  group.position.y = -(Ft + Nh) / 2;
  return group;
}

// ─── Çatal Mafsal (Clevis / Yoke) ────────────────────────────────────────────
// Taban bloğu + iki paralel kulak (yuvarlatılmış üst + hizalı pim deliği).
// Zorluk: kulaklar arası dar boşluk (thin gap), pim deliği eğriliği, U-şekilli
// derin oyuk, ince paralel duvarlar.
function _veFEABuildClevisGroup(p) {
  var group = new THREE.Group();
  group.userData.feaPrimitive = { type: 'clevis', params: p };
  var bd = p.baseDepth, bh = p.baseHeight, et = p.earThickness;
  var eh = p.earHeight, gap = p.gap, pinR = p.pinHoleDiameter / 2;
  var baseW = gap + 2 * et;
  var earR = bd / 2;

  // Taban bloğu (merkez origin, y: -bh/2..bh/2)
  var baseGeo = new THREE.BoxGeometry(baseW, bh, bd);
  var baseMesh = new THREE.Mesh(baseGeo, _veFEAMakePrimitiveMaterial());
  baseMesh.userData.feaFaceId = 'faceBase';
  group.add(_veFEAAttachEdges(baseMesh));

  // 2 kulak — XY profil (x→Z derinlik, y→yükseklik), Z extrude (kalınlık),
  // rotateY ile X-extrude'a çevir, taban üstüne (y = bh/2) TAM TEMAS.
  [-1, 1].forEach(function (sign) {
    var es = new THREE.Shape();
    es.moveTo(-earR, 0);
    es.lineTo(earR, 0);
    es.lineTo(earR, eh);
    es.absarc(0, eh, earR, 0, Math.PI, false); // üst yarım daire
    es.lineTo(-earR, eh);
    es.lineTo(-earR, 0);
    if (pinR > 0) { var pin = new THREE.Path(); pin.absarc(0, eh, pinR, 0, Math.PI * 2, true); es.holes.push(pin); }
    var eg = new THREE.ExtrudeGeometry(es, { depth: et, bevelEnabled: false, steps: 1, curveSegments: 40 });
    eg.rotateY(Math.PI / 2); // extrude Z → X; (sx,sy,sz)→(sz,sy,-sx)
    // rotateY(+90): world-x = sz(0..et), world-y = sy, world-z = -sx(derinlik)
    eg.translate(sign > 0 ? (baseW / 2 - et) : (-baseW / 2), bh / 2, 0);
    var em = new THREE.Mesh(eg, _veFEAMakePrimitiveMaterial());
    em.userData.feaFaceId = 'faceEar';
    group.add(_veFEAAttachEdges(em, 0.6));
  });

  group.position.y = -(eh + earR) / 2; // yaklaşık bbox merkezi
  return group;
}

// ─── Kaburgalı / Gussetli Braket ─────────────────────────────────────────────
// Dikey delikli duvar + yatay raf (L) + N adet ince köşegen gusset kaburga.
// Zorluk: çok ince kaburga duvarları (thin web), keskin köşegen kenarlar, sivri
// üçgen uçlar (sliver/inverted eleman riski), L iç (re-entrant) köşe.
function _veFEABuildGussetBracketGroup(p) {
  var group = new THREE.Group();
  group.userData.feaPrimitive = { type: 'gussetBracket', params: p };
  var wh = p.wallHeight, sl = p.shelfLength, w = p.width;
  var pt = p.plateThickness, gt = p.gussetThickness, gc = p.gussetCount;
  var hr = p.holeDiameter / 2;
  var w2 = w / 2;

  // Dikey duvar (XY shape, Z extrude = kalınlık), z: 0..pt
  var wallShape = new THREE.Shape();
  wallShape.moveTo(-w2, 0); wallShape.lineTo(w2, 0);
  wallShape.lineTo(w2, wh); wallShape.lineTo(-w2, wh); wallShape.lineTo(-w2, 0);
  if (hr > 0) { // duvar üstünde 2 cıvata deliği
    var hy = wh - Math.max(hr + 3, wh * 0.15);
    [[-w * 0.25, hy], [w * 0.25, hy]].forEach(function (c) {
      var h = new THREE.Path(); h.absarc(c[0], c[1], hr, 0, Math.PI * 2, true); wallShape.holes.push(h);
    });
  }
  var wallGeo = new THREE.ExtrudeGeometry(wallShape, { depth: pt, bevelEnabled: false, steps: 1, curveSegments: 28 });
  wallGeo.translate(0, pt, 0); // rafın ÜSTÜNE oturt (y: pt..pt+wh) — köşe örtüşmesi yok
  var wallMesh = new THREE.Mesh(wallGeo, _veFEAMakePrimitiveMaterial());
  wallMesh.userData.feaFaceId = 'faceWall';
  group.add(_veFEAAttachEdges(wallMesh));

  // Yatay raf — alt (y: 0..pt), öne uzanır (z: 0..sl), duvarla L köşede temas
  var shelfGeo = new THREE.BoxGeometry(w, pt, sl);
  shelfGeo.translate(0, pt / 2, sl / 2);
  var shelfMesh = new THREE.Mesh(shelfGeo, _veFEAMakePrimitiveMaterial());
  shelfMesh.userData.feaFaceId = 'faceShelf';
  group.add(_veFEAAttachEdges(shelfMesh));

  // N adet köşegen gusset (YZ üçgeni, X-extrude = ince kalınlık)
  if (gt > 0 && gc > 0) {
    var gRise = wh * 0.7, gRun = sl * 0.7;
    for (var i = 0; i < gc; i++) {
      var gx = (gc === 1) ? 0 : (-w2 + gt / 2 + i * (w - gt) / (gc - 1));
      var gs = new THREE.Shape();      // shape-x → Z, shape-y → Y
      gs.moveTo(pt, pt);
      gs.lineTo(pt + gRun, pt);
      gs.lineTo(pt, pt + gRise);
      gs.lineTo(pt, pt);
      var gg = new THREE.ExtrudeGeometry(gs, { depth: gt, bevelEnabled: false, steps: 1 });
      gg.rotateY(-Math.PI / 2); // extrude Z → X: (sx,sy,sz)→(-sz,sy,sx) → z=shape-x, y=shape-y
      gg.translate(gx + gt / 2, 0, 0);
      var gm = new THREE.Mesh(gg, _veFEAMakePrimitiveMaterial());
      gm.userData.feaFaceId = 'faceGusset';
      group.add(_veFEAAttachEdges(gm, 0.6));
    }
  }

  group.position.set(0, -(pt + wh) / 2, -sl / 2); // yaklaşık bbox merkezi
  return group;
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
