/**
 * FEA Malzeme Kütüphanesi birim testleri
 * - Yerleşik malzemelerin tam tanımı
 * - Elastisite matrisi (izotropik 6×6 Voigt)
 * - Yardımcı hesaplamalar (kütle, güvenlik faktörü)
 */

const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '../..');

eval(fs.readFileSync(path.join(ROOT, 'js/fea-materials.js'), 'utf8'));

describe('Malzeme Kütüphanesi - veri', () => {
  test('En az 10 malzeme tanımlı', () => {
    expect(veFEAMaterialIds().length).toBeGreaterThanOrEqual(10);
  });

  test('Anahtar malzemeler mevcut', () => {
    var ids = veFEAMaterialIds();
    expect(ids).toContain('steel-st37');
    expect(ids).toContain('aluminum-6061');
    expect(ids).toContain('plastic-pa6');
    expect(ids).toContain('titanium-grade5');
  });

  test('Her malzemenin zorunlu alanları doludur', () => {
    veFEAMaterialIds().forEach(function (id) {
      var m = veFEAMaterialById(id);
      expect(m.label).toBeDefined();
      expect(m.density).toBeGreaterThan(0);
      expect(m.youngsModulus).toBeGreaterThan(0);
      expect(m.poissonsRatio).toBeGreaterThan(-1);
      expect(m.poissonsRatio).toBeLessThan(0.5);
    });
  });

  test('Bilinmeyen ID için null', () => {
    expect(veFEAMaterialById('unicorn')).toBeNull();
  });

  test('veFEAMaterialLabel geçerli isimler döner', () => {
    expect(veFEAMaterialLabel('steel-st37')).toMatch(/Çelik|St37/i);
    expect(veFEAMaterialLabel('aluminum-6061')).toMatch(/Alüminyum|6061/i);
  });
});

describe('Malzeme kategorileri', () => {
  test('Kategori grupları doludur', () => {
    var groups = veFEAMaterialsByCategory();
    expect(Object.keys(groups).length).toBeGreaterThanOrEqual(4);
    expect(groups.steel.length).toBeGreaterThanOrEqual(3);
    expect(groups.aluminum.length).toBeGreaterThanOrEqual(2);
    expect(groups.plastic.length).toBeGreaterThanOrEqual(2);
  });

  test('Kategori etiketleri Türkçe', () => {
    expect(veFEAMaterialCategoryLabel('steel')).toBe('Çelikler');
    expect(veFEAMaterialCategoryLabel('aluminum')).toMatch(/Alüminyum/);
    expect(veFEAMaterialCategoryLabel('plastic')).toBe('Plastikler');
  });
});

describe('İzotropik elastisite matrisi (6×6 Voigt)', () => {
  test('Çelik St37: D11 = λ+2μ, simetrik', () => {
    var m = veFEAMaterialById('steel-st37');
    var D = veFEAElasticityMatrix(m);
    expect(D).toBeInstanceOf(Float64Array);
    expect(D.length).toBe(36);

    // λ = 0.3·210000 / (1.3·0.4) = 63000 / 0.52 ≈ 121153.85
    // μ = 210000 / 2.6 ≈ 80769.23
    var nu = 0.30, E = 210000;
    var lam = nu * E / ((1 + nu) * (1 - 2 * nu));
    var mu  = E / (2 * (1 + nu));

    // D[0,0] = λ + 2μ
    expect(D[0]).toBeCloseTo(lam + 2 * mu, 0);
    // D[0,1] = λ
    expect(D[1]).toBeCloseTo(lam, 0);
    // D[3,3] = μ (shear)
    expect(D[21]).toBeCloseTo(mu, 0);
    // Simetri: D[0,1] == D[1,0]
    expect(D[1]).toBeCloseTo(D[6], 6);
  });

  test('Alüminyum 6061: D matrisi pozitif tanımlı (diagonal > 0)', () => {
    var D = veFEAElasticityMatrix(veFEAMaterialById('aluminum-6061'));
    for (var i = 0; i < 6; i++) {
      expect(D[i * 6 + i]).toBeGreaterThan(0);
    }
  });

  test('Off-diagonal cross-shear sıfır (izotropik)', () => {
    var D = veFEAElasticityMatrix(veFEAMaterialById('steel-st37'));
    // D[3,4] (shear-shear) = 0 izotropik için
    expect(D[22]).toBe(0);
    expect(D[23]).toBe(0);
    expect(D[29]).toBe(0);
  });

  test('Geçersiz Poisson oranı (≥ 0.5) için null', () => {
    var bad = { youngsModulus: 200000, poissonsRatio: 0.5 };
    expect(veFEAElasticityMatrix(bad)).toBeNull();
  });

  test('null malzeme → null matris', () => {
    expect(veFEAElasticityMatrix(null)).toBeNull();
  });
});

describe('Yardımcı hesaplamalar', () => {
  test('veFEAMaterialMass: 1 dm³ çelik ≈ 7.85 kg', () => {
    var steel = veFEAMaterialById('steel-st37');
    var v_mm3 = 1e6; // 1 dm³ = 1e6 mm³
    var mass = veFEAMaterialMass(steel, v_mm3);
    expect(mass).toBeCloseTo(7.85, 2);
  });

  test('veFEAMaterialMass: alüminyum yoğunluğu çeliğin ~1/3\'ü', () => {
    var al = veFEAMaterialById('aluminum-6061');
    var steel = veFEAMaterialById('steel-st37');
    var ratio = al.density / steel.density;
    expect(ratio).toBeCloseTo(0.344, 2);
  });

  test('veFEAYieldSafetyFactor: σVM=100, çelik St37 σy=235 → FoS=2.35', () => {
    var steel = veFEAMaterialById('steel-st37');
    var fos = veFEAYieldSafetyFactor(steel, 100);
    expect(fos).toBeCloseTo(2.35, 2);
  });

  test('veFEAYieldSafetyFactor: σVM=0 için Infinity', () => {
    var steel = veFEAMaterialById('steel-st37');
    expect(veFEAYieldSafetyFactor(steel, 0)).toBe(Infinity);
  });
});

describe('BC assignment yardımcısı', () => {
  test('Fixed support assignment', () => {
    var a = veFEACreateBCAssignment('faceXMin', 'fixed', null);
    expect(a.faceId).toBe('faceXMin');
    expect(a.kind).toBe('fixed');
    expect(a.enabled).toBe(true);
  });

  test('Force assignment (3D vektör)', () => {
    var a = veFEACreateBCAssignment('faceZMax', 'force', { fx: 0, fy: 0, fz: -1000 });
    expect(a.kind).toBe('force');
    expect(a.value.fz).toBe(-1000);
  });

  test('Pressure assignment', () => {
    var a = veFEACreateBCAssignment('faceCyl', 'pressure', { magnitude: 1.5 });
    expect(a.kind).toBe('pressure');
    expect(a.value.magnitude).toBe(1.5);
  });
});
