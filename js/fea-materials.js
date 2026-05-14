/**
 * FEA Malzeme Kütüphanesi (Faz 3a — Yapısal Analiz Hazırlığı)
 * ─────────────────────────────────────────────────────────────
 * ANSYS Engineering Data / Abaqus Materials kütüphanesinin minimal mukabili.
 *
 * Her malzeme:
 *   - density (ρ)           [kg/m³]
 *   - youngsModulus (E)     [MPa]   — solver kullanırken Pa'ya çevrilir
 *   - poissonsRatio (ν)     [−]
 *   - yieldStrength (σy)    [MPa]   — von Mises güvenlik faktörü için
 *   - ultimateStrength (σu) [MPa]   — opsiyonel, hasar değerlendirme
 *   - thermalExpansion (α)  [1/°C]  — opsiyonel, termal yük (faz 4)
 *
 * Tüm malzemeler izotropik elastik, doğrusal yapısal analiz için.
 * Anizotropik / hiperelastik malzemeler faz 4+'ta eklenecek.
 *
 * Bu modülün solver bağımlılığı yok — sadece veri ve hesap formülleri.
 */

// ─── Yerleşik malzeme veritabanı ─────────────────────────────────────────
var VE_FEA_MATERIAL_LIBRARY = {
  // ─── Çelikler ───
  'steel-st37': {
    label: 'Çelik St37 (S235JR)',
    category: 'steel',
    density: 7850,
    youngsModulus: 210000,   // MPa = 210 GPa
    poissonsRatio: 0.30,
    yieldStrength: 235,
    ultimateStrength: 360,
    thermalExpansion: 1.2e-5
  },
  'steel-st52': {
    label: 'Çelik St52 (S355J2)',
    category: 'steel',
    density: 7850,
    youngsModulus: 210000,
    poissonsRatio: 0.30,
    yieldStrength: 355,
    ultimateStrength: 510,
    thermalExpansion: 1.2e-5
  },
  'steel-c45': {
    label: 'Çelik C45 (1.0503)',
    category: 'steel',
    density: 7850,
    youngsModulus: 210000,
    poissonsRatio: 0.30,
    yieldStrength: 430,
    ultimateStrength: 700,
    thermalExpansion: 1.1e-5
  },
  'stainless-304': {
    label: 'Paslanmaz Çelik 304 (1.4301)',
    category: 'steel',
    density: 8000,
    youngsModulus: 193000,
    poissonsRatio: 0.30,
    yieldStrength: 215,
    ultimateStrength: 520,
    thermalExpansion: 1.73e-5
  },
  'stainless-316': {
    label: 'Paslanmaz Çelik 316L (1.4404)',
    category: 'steel',
    density: 8000,
    youngsModulus: 193000,
    poissonsRatio: 0.30,
    yieldStrength: 200,
    ultimateStrength: 500,
    thermalExpansion: 1.6e-5
  },

  // ─── Alüminyum ───
  'aluminum-6061': {
    label: 'Alüminyum 6061-T6',
    category: 'aluminum',
    density: 2700,
    youngsModulus: 69000,
    poissonsRatio: 0.33,
    yieldStrength: 276,
    ultimateStrength: 310,
    thermalExpansion: 2.36e-5
  },
  'aluminum-7075': {
    label: 'Alüminyum 7075-T6',
    category: 'aluminum',
    density: 2810,
    youngsModulus: 71700,
    poissonsRatio: 0.33,
    yieldStrength: 503,
    ultimateStrength: 572,
    thermalExpansion: 2.34e-5
  },
  'aluminum-5083': {
    label: 'Alüminyum 5083-H116',
    category: 'aluminum',
    density: 2660,
    youngsModulus: 70300,
    poissonsRatio: 0.33,
    yieldStrength: 215,
    ultimateStrength: 305,
    thermalExpansion: 2.43e-5
  },

  // ─── Demir döküm ───
  'cast-iron-gg25': {
    label: 'Pik Döküm GG25 (EN-GJL-250)',
    category: 'iron',
    density: 7200,
    youngsModulus: 110000,
    poissonsRatio: 0.26,
    yieldStrength: 165,
    ultimateStrength: 250,
    thermalExpansion: 1.1e-5
  },
  'cast-iron-ggg40': {
    label: 'Küresel Grafitli Döküm GGG40 (EN-GJS-400)',
    category: 'iron',
    density: 7100,
    youngsModulus: 169000,
    poissonsRatio: 0.275,
    yieldStrength: 250,
    ultimateStrength: 400,
    thermalExpansion: 1.25e-5
  },

  // ─── Bakır alaşımları ───
  'copper-pure': {
    label: 'Bakır (Saf, Cu-ETP)',
    category: 'copper',
    density: 8960,
    youngsModulus: 117000,
    poissonsRatio: 0.34,
    yieldStrength: 70,
    ultimateStrength: 220,
    thermalExpansion: 1.65e-5
  },
  'brass-cuzn37': {
    label: 'Pirinç CuZn37',
    category: 'copper',
    density: 8500,
    youngsModulus: 100000,
    poissonsRatio: 0.35,
    yieldStrength: 200,
    ultimateStrength: 340,
    thermalExpansion: 1.9e-5
  },

  // ─── Plastikler ───
  'plastic-abs': {
    label: 'ABS (Akrilonitril Bütadien Stiren)',
    category: 'plastic',
    density: 1050,
    youngsModulus: 2200,
    poissonsRatio: 0.35,
    yieldStrength: 45,
    ultimateStrength: 45,
    thermalExpansion: 8.5e-5
  },
  'plastic-pa6': {
    label: 'PA6 (Naylon 6)',
    category: 'plastic',
    density: 1140,
    youngsModulus: 3000,
    poissonsRatio: 0.39,
    yieldStrength: 78,
    ultimateStrength: 80,
    thermalExpansion: 8.5e-5
  },
  'plastic-petg': {
    label: 'PETG',
    category: 'plastic',
    density: 1270,
    youngsModulus: 2050,
    poissonsRatio: 0.38,
    yieldStrength: 50,
    ultimateStrength: 55,
    thermalExpansion: 6.8e-5
  },
  'plastic-pla': {
    label: 'PLA (3D-baskı)',
    category: 'plastic',
    density: 1240,
    youngsModulus: 3500,
    poissonsRatio: 0.36,
    yieldStrength: 60,
    ultimateStrength: 65,
    thermalExpansion: 6.8e-5
  },

  // ─── Titanyum ───
  'titanium-grade5': {
    label: 'Titanyum Ti-6Al-4V (Grade 5)',
    category: 'titanium',
    density: 4430,
    youngsModulus: 113800,
    poissonsRatio: 0.342,
    yieldStrength: 880,
    ultimateStrength: 950,
    thermalExpansion: 8.6e-6
  }
};

// ─── Public API ──────────────────────────────────────────────────────────

function veFEAMaterialIds() {
  return Object.keys(VE_FEA_MATERIAL_LIBRARY);
}

function veFEAMaterialById(id) {
  var m = VE_FEA_MATERIAL_LIBRARY[id];
  if (!m) return null;
  // Defensive copy + id alanı ile birlikte döndür
  return Object.assign({ id: id }, m);
}

function veFEAMaterialLabel(id) {
  var m = VE_FEA_MATERIAL_LIBRARY[id];
  return m ? m.label : id;
}

// Kategoriye göre gruplama (UI'de "Çelikler", "Alüminyum" başlıkları için)
function veFEAMaterialsByCategory() {
  var groups = {};
  Object.keys(VE_FEA_MATERIAL_LIBRARY).forEach(function (id) {
    var m = VE_FEA_MATERIAL_LIBRARY[id];
    var cat = m.category || 'other';
    if (!groups[cat]) groups[cat] = [];
    groups[cat].push(Object.assign({ id: id }, m));
  });
  return groups;
}

function veFEAMaterialCategoryLabel(cat) {
  return ({
    'steel':    'Çelikler',
    'aluminum': 'Alüminyum Alaşımları',
    'iron':     'Demir Döküm',
    'copper':   'Bakır Alaşımları',
    'plastic':  'Plastikler',
    'titanium': 'Titanyum',
    'other':    'Diğer'
  })[cat] || cat;
}

// ─── İzotropik elastik 6×6 D matrisi (Voigt) — MPa cinsinden ─────────────
// Stress-strain ilişkisi: σ = D·ε
// Sıralama Abaqus / ANSYS standardı:
//   [σxx, σyy, σzz, σxy, σyz, σxz] = D · [εxx, εyy, εzz, γxy, γyz, γxz]
// Symmetric Lamé parameters:
//   λ = ν·E / ((1+ν)(1−2ν))
//   μ = E / (2(1+ν))
//   D11 = λ+2μ, D12 = λ, D44 = μ
function veFEAElasticityMatrix(material) {
  if (!material) return null;
  var E = Number(material.youngsModulus);
  var nu = Number(material.poissonsRatio);
  if (!isFinite(E) || E <= 0) return null;
  if (!isFinite(nu) || nu <= -1 || nu >= 0.5) return null;
  var lam = nu * E / ((1 + nu) * (1 - 2 * nu));
  var mu  = E / (2 * (1 + nu));
  var d11 = lam + 2 * mu;
  // 6×6 D matrisi (row-major Float64Array)
  var D = new Float64Array(36);
  // Diagonal kısmı
  D[0]   = d11; D[7]   = d11; D[14]  = d11;
  // Normal-normal coupling (λ)
  D[1]   = lam; D[2]   = lam;
  D[6]   = lam; D[8]   = lam;
  D[12]  = lam; D[13]  = lam;
  // Shear (μ)
  D[21]  = mu;  D[28]  = mu;  D[35]  = mu;
  return D;
}

// ─── Yardımcı: malzeme ile mesh hacminden kütle ──────────────────────────
// volume mm³ olarak verilirse, malzemenin kg/m³ density'sini kullanır.
function veFEAMaterialMass(material, volumeMm3) {
  if (!material) return 0;
  var v_m3 = volumeMm3 * 1e-9; // mm³ → m³
  return v_m3 * (Number(material.density) || 0);
}

// ─── Yardımcı: von Mises güvenlik faktörü ────────────────────────────────
// σVM_max < σy → güvenli; FoS = σy / σVM_max
function veFEAYieldSafetyFactor(material, vonMisesMaxMPa) {
  if (!material || !isFinite(vonMisesMaxMPa) || vonMisesMaxMPa <= 0) return Infinity;
  var sy = Number(material.yieldStrength);
  if (!isFinite(sy) || sy <= 0) return null;
  return sy / vonMisesMaxMPa;
}

// ─── BC bileşeni veri yapısı yardımcısı ──────────────────────────────────
// Sınır koşulu node verisi bileşene atanırken kullanılan şema yardımcısı.
function veFEACreateBCAssignment(faceId, kind, value) {
  return {
    faceId: faceId,
    kind: kind,            // 'fixed' | 'force' | 'pressure' | 'displacement'
    value: value || null,
    enabled: true
  };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    VE_FEA_MATERIAL_LIBRARY: VE_FEA_MATERIAL_LIBRARY,
    veFEAMaterialIds: veFEAMaterialIds,
    veFEAMaterialById: veFEAMaterialById,
    veFEAMaterialLabel: veFEAMaterialLabel,
    veFEAMaterialsByCategory: veFEAMaterialsByCategory,
    veFEAMaterialCategoryLabel: veFEAMaterialCategoryLabel,
    veFEAElasticityMatrix: veFEAElasticityMatrix,
    veFEAMaterialMass: veFEAMaterialMass,
    veFEAYieldSafetyFactor: veFEAYieldSafetyFactor,
    veFEACreateBCAssignment: veFEACreateBCAssignment
  };
}
