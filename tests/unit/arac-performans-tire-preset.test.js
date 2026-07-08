/**
 * arac-performans-tire-preset.test.js — 285/80 R20 lastik presetinin (VE_TIRE_PRESETS,
 * component-extras.js) veri bütünlüğü + preset-uygulama (dropdown) yolu.
 *
 * Değer başına test (test politikası): preset radius/inertia "sayısal veri
 * çekirdeği" — yanlış bir yarıçap sessizce ~%N hız/çeki hatası üretir, gözle
 * yakalanmaz. Ayrıca dropdown seçimi (onVEFTTirePresetChange) node.data'yı
 * doğru kuruyor mu — kullanıcının fiilen kullandığı yol — doğrulanır.
 */
const stubs = stubGlobals({ showToast: jest.fn() });
global.veActiveModule = 'full-throttle';
eval(loadSource('component-extras.js'));

describe('Lastik preset — 285/80 R20 (Askeri Taktik 4x4)', () => {
  const p = VE_TIRE_PRESETS.find(t => t.id === '285_80r20');

  test('preset tanımlı, isim/grup doğru', () => {
    expect(p).toBeDefined();
    expect(p.name).toBe('285/80 R20');
    expect(p.group).toBe('R20');
  });

  test('yarıçap YUVARLANMA (0,474 m) + teker-başı atalet 11,8 kg·m²', () => {
    // radius çözücüde v = ω·r (hız↔devir) olarak kullanılır → yuvarlanma yarıçapı.
    // (Statik 0,456 DEĞİL; mevcut R20 presetleri de yuvarlanma yarıçapı taşır.)
    expect(p.radius).toBeCloseTo(0.474, 3);
    expect(p.inertia).toBeCloseTo(11.80, 2);   // TEK teker (kod ×tekerlek sayısı yapar)
  });

  test('türetilen rev/km ≈ 336 ve toplam atalet (×4) ≈ 47 — kullanıcı tablosuyla', () => {
    // Kodun kendi formülü (component-extras.js:1560): rev/km = 1000/(2πr).
    const revKm = 1000 / (2 * Math.PI * p.radius);
    expect(revKm).toBeCloseTo(336.0, 0);       // tablo: 336,0
    expect(p.inertia * 4).toBeCloseTo(47.2, 1); // tablo: ~47 (teker başı ~11,8)
  });

  test('R20 grubu yarıçapa göre artan sıralı ve 285 en küçük R20', () => {
    const r20 = VE_TIRE_PRESETS.filter(t => t.group === 'R20');
    for (let i = 1; i < r20.length; i++) {
      expect(r20[i].radius).toBeGreaterThanOrEqual(r20[i - 1].radius);
    }
    expect(r20[0].id).toBe('285_80r20');       // en küçük yarıçaplı R20 → grubun başı
  });

  test('id benzersiz — çift kayıt yok', () => {
    const ids = VE_TIRE_PRESETS.map(t => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test('dropdown seçimi node.data\'yı kurar: r=0,474, toplam atalet = 11,8×tekerlek', () => {
    // Kullanıcının fiilen tıkladığı yol: onVEFTTirePresetChange preseti node'a uygular
    // ve teker-başı ataleti tekerlek sayısıyla çarpıp TOPLAM ataleti yazar.
    const wheelNode = { id: 'w1', type: 'wheel', isMasterWheel: true, data: {} };
    global.nodes = [
      wheelNode,
      { id: 'w2', type: 'wheel', data: {} },
      { id: 'w3', type: 'wheel', data: {} },
      { id: 'w4', type: 'wheel', data: {} }
    ];
    try { nodes = global.nodes; } catch (e) {}

    onVEFTTirePresetChange('w1', '285_80r20');

    expect(wheelNode.data.ftTirePreset).toBe('285_80r20');
    expect(wheelNode.data.ftTireName).toBe('285/80 R20');
    expect(wheelNode.data.ftTireRadius).toBeCloseTo(0.474, 3);
    // 4 tekerlek → toplam atalet 11,8×4 = 47,2 (çözücünün beklediği TOPLAM)
    expect(wheelNode.data.ftTireInertia).toBeCloseTo(47.2, 1);
  });
});
