/**
 * cp-accessories.js birim testleri
 * ─────────────────────────────────
 * Aksesuar net-kayıp modeli (Klima / Alternatör / Hava Kompresörü):
 *   • Preset kütüphaneleri (yapı + değerler)
 *   • Eğri interpolasyonu (veAccInterpCurve)
 *   • Paylaşılan net-kayıp modeli (veAccessoryLossKw) — eğri / manuel / legacy
 *   • Düğüm modeli çıkarımı (veAccGetNodeModel)
 *   • Bağlı düğümlerden Motor'a senkron (veSyncEngineAccessories)
 *
 * Bu çekirdek matematik "makul ama yanlış" regresyona açık (interpolasyon,
 * tahrik oranı, birim çevrimi) → test değeri yüksek (bkz. CLAUDE.md test politikası).
 */

document.body.innerHTML = '<div id="ve-canvas"></div>';
global.nodes = [];
global.connections = [];

// updateVENetChart cp-accessories tarafından çağrılabilir → zararsız stub.
const stubs = stubGlobals({ updateVENetChart: jest.fn() });
eval(loadSource('cp-accessories.js'));

beforeEach(() => {
  nodes = [];
  connections = [];
  resetStubs(stubs);
});

// ── Yardımcılar ──
function accNode(type, id, data) {
  return { id: id, type: type, x: 0, y: 0, width: 54, height: 50, data: data || {} };
}
function engineNode(id, specs) {
  return { id: id || 'eng-1', type: 'engine', x: 0, y: 0, width: 66, height: 76,
           data: { motorSpecs: specs || { governedSpeed: 2100 } } };
}

// ═════════════════════════════════════════════════════════════════════
// Preset kütüphaneleri
// ═════════════════════════════════════════════════════════════════════
describe('preset kütüphaneleri', () => {
  test('alternatör/klima/hava komp. preset sayıları ve alanları', () => {
    expect(Object.keys(VE_ALTERNATOR_PRESETS)).toHaveLength(2);
    expect(Object.keys(VE_AC_PRESETS)).toHaveLength(2);
    expect(Object.keys(VE_AIRCOMP_PRESETS)).toHaveLength(8);
    var all = [VE_ALTERNATOR_PRESETS, VE_AC_PRESETS, VE_AIRCOMP_PRESETS];
    all.forEach(function(lib) {
      Object.keys(lib).forEach(function(k) {
        var p = lib[k];
        expect(typeof p.name).toBe('string');
        expect(typeof p.driveRatio).toBe('number');
        expect(Array.isArray(p.curve)).toBe(true);
        expect(p.curve.length).toBeGreaterThan(1);
        // rpm artan (monotonik), kW negatif değil
        for (var i = 0; i < p.curve.length; i++) {
          expect(p.curve[i].kw).toBeGreaterThanOrEqual(0);
          if (i > 0) expect(p.curve[i].rpm).toBeGreaterThan(p.curve[i-1].rpm);
        }
      });
    });
  });

  test('varsayılan tahrik oranları BMC matrisiyle uyumlu', () => {
    expect(VE_ALTERNATOR_PRESETS['prestolite_180a'].driveRatio).toBe(3.15);
    expect(VE_AC_PRESETS['valeo_tm31'].driveRatio).toBe(1.25);
    expect(VE_AIRCOMP_PRESETS['knorr_460'].driveRatio).toBe(1.0);
  });

  test('tip haritası accName Motor satır adlarıyla birebir eşleşir', () => {
    expect(VE_ACC_TYPES['acc-ac'].accName).toBe('Klima');
    expect(VE_ACC_TYPES['acc-alternator'].accName).toBe('Alternatör / Jeneratör');
    expect(VE_ACC_TYPES['acc-aircomp'].accName).toBe('Hava Kompresörü');
    // Port haritası tersine tutarlı
    expect(VE_ACC_PORT_MAP['input-0']).toBe('acc-ac');
    expect(VE_ACC_PORT_MAP['input-1']).toBe('acc-alternator');
    expect(VE_ACC_PORT_MAP['input-2']).toBe('acc-aircomp');
  });
});

// ═════════════════════════════════════════════════════════════════════
// veAccInterpCurve
// ═════════════════════════════════════════════════════════════════════
describe('veAccInterpCurve', () => {
  var curve = [{rpm:1000,kw:2}, {rpm:2000,kw:4}, {rpm:3000,kw:5}];

  test('düğüm noktalarında tam değer', () => {
    expect(veAccInterpCurve(curve, 1000)).toBe(2);
    expect(veAccInterpCurve(curve, 2000)).toBe(4);
    expect(veAccInterpCurve(curve, 3000)).toBe(5);
  });
  test('ara noktada lineer', () => {
    expect(veAccInterpCurve(curve, 1500)).toBeCloseTo(3, 6);
    expect(veAccInterpCurve(curve, 2500)).toBeCloseTo(4.5, 6);
  });
  test('uçlarda sabitlenir (extrapolasyon yok)', () => {
    expect(veAccInterpCurve(curve, 0)).toBe(2);
    expect(veAccInterpCurve(curve, 500)).toBe(2);
    expect(veAccInterpCurve(curve, 9000)).toBe(5);
  });
  test('boş / tekil eğri', () => {
    expect(veAccInterpCurve([], 1000)).toBe(0);
    expect(veAccInterpCurve([{rpm:800,kw:3}], 5000)).toBe(3);
  });
});

// ═════════════════════════════════════════════════════════════════════
// veAccessoryLossKw
// ═════════════════════════════════════════════════════════════════════
describe('veAccessoryLossKw', () => {
  test('eğrili aksesuar: aksesuar_devri = rpm × oran', () => {
    // ratio 2 → motor 1000 rpm ⇒ aksesuar 2000 rpm ⇒ 4 kW
    var acc = [{ name:'X', curve:[{rpm:1000,kw:2},{rpm:2000,kw:4},{rpm:3000,kw:5}], driveRatio:2 }];
    expect(veAccessoryLossKw(acc, 1000, 2100)).toBeCloseTo(4, 6);
    // motor 750 ⇒ aksesuar 1500 ⇒ 3 kW
    expect(veAccessoryLossKw(acc, 750, 2100)).toBeCloseTo(3, 6);
  });

  test('birden çok eğrili aksesuar toplanır', () => {
    var acc = [
      { name:'A', curve:[{rpm:1000,kw:2},{rpm:2000,kw:4}], driveRatio:1 },
      { name:'B', curve:[{rpm:1000,kw:1},{rpm:2000,kw:3}], driveRatio:1 }
    ];
    // motor 1500 ⇒ A=3, B=2 ⇒ 5
    expect(veAccessoryLossKw(acc, 1500, 2100)).toBeCloseTo(5, 6);
  });

  test('manuel sabit kW her devirde aynı', () => {
    var acc = [{ name:'M', kwConst:6, driveRatio:1.5 }];
    expect(veAccessoryLossKw(acc, 800, 2100)).toBe(6);
    expect(veAccessoryLossKw(acc, 2000, 2100)).toBe(6);
  });

  test('legacy scalar: fan küp yasası, diğer lineer', () => {
    var fan = [{ name:'Fan (Kavramalı Fan)', userLoss:20 }];
    // ratio 0.5 ⇒ 20 × 0.5³ = 2.5
    expect(veAccessoryLossKw(fan, 1050, 2100)).toBeCloseTo(2.5, 6);
    // governed'da ratio 1 ⇒ 20
    expect(veAccessoryLossKw(fan, 2100, 2100)).toBeCloseTo(20, 6);
    var other = [{ name:'Alternatör / Jeneratör', userLoss:10 }];
    // ratio 0.5 ⇒ 5 (lineer)
    expect(veAccessoryLossKw(other, 1050, 2100)).toBeCloseTo(5, 6);
  });

  test('fanMode "on" → fan kaybı tüm devirlerde sabit', () => {
    var fan = [{ name:'Fan (Kavramalı Fan)', userLoss:20 }];
    expect(veAccessoryLossKw(fan, 1050, 2100, 'on')).toBeCloseTo(20, 6);
    expect(veAccessoryLossKw(fan, 700, 2100, 'on')).toBeCloseTo(20, 6);
  });

  test('boş liste / sıfır devir → 0', () => {
    expect(veAccessoryLossKw([], 1500, 2100)).toBe(0);
    expect(veAccessoryLossKw(null, 1500, 2100)).toBe(0);
    expect(veAccessoryLossKw([{name:'X',kwConst:5}], 0, 2100)).toBe(0);
  });

  test('eğri, scalar userLoss üzerinde önceliklidir (çift sayım yok)', () => {
    // Hem curve hem userLoss varsa curve kullanılır
    var acc = [{ name:'A', curve:[{rpm:1000,kw:2},{rpm:2000,kw:4}], driveRatio:1, userLoss:99 }];
    expect(veAccessoryLossKw(acc, 1000, 2100)).toBeCloseTo(2, 6);
  });
});

// ═════════════════════════════════════════════════════════════════════
// veAccGetNodeModel
// ═════════════════════════════════════════════════════════════════════
describe('veAccGetNodeModel', () => {
  test('preset seçili → eğri + oran döner', () => {
    var n = accNode('acc-alternator', 'a1', { accPreset:'prestolite_180a', accDriveRatio:3.15 });
    var m = veAccGetNodeModel(n);
    expect(m.name).toBe('Alternatör / Jeneratör');
    expect(m.driveRatio).toBe(3.15);
    expect(Array.isArray(m.curve)).toBe(true);
    expect(m.curve.length).toBe(VE_ALTERNATOR_PRESETS['prestolite_180a'].curve.length);
  });

  test('manuel → kwConst döner', () => {
    var n = accNode('acc-ac', 'a2', { accPreset:'__manual__', accManualKw:4.5, accDriveRatio:1.25 });
    var m = veAccGetNodeModel(n);
    expect(m.kwConst).toBe(4.5);
    expect(m.curve).toBeUndefined();
    expect(m.name).toBe('Klima');
  });

  test('seçim yok → null', () => {
    var n = accNode('acc-aircomp', 'a3', { accPreset:'' });
    expect(veAccGetNodeModel(n)).toBeNull();
  });

  test('oran belirtilmemişse tipin varsayılanı', () => {
    var n = accNode('acc-ac', 'a4', { accPreset:'valeo_tm21' });
    var m = veAccGetNodeModel(n);
    expect(m.driveRatio).toBe(VE_AC_PRESETS['valeo_tm21'].driveRatio);
  });
});

// ═════════════════════════════════════════════════════════════════════
// veSyncEngineAccessories
// ═════════════════════════════════════════════════════════════════════
describe('veSyncEngineAccessories', () => {
  test('bağlı aksesuar düğümleri doğru satırlara yazılır', () => {
    var eng = engineNode('eng-1', { governedSpeed: 2000 });
    var alt = accNode('acc-alternator', 'alt-1', { accPreset:'prestolite_180a', accDriveRatio:3.15 });
    var ac  = accNode('acc-ac', 'ac-1', { accPreset:'valeo_tm31', accDriveRatio:1.25 });
    nodes = [eng, alt, ac];
    connections = [
      { id:'c1', from:'alt-1', to:'eng-1', fromPort:'output', toPort:'input-1' },
      { id:'c2', from:'ac-1',  to:'eng-1', fromPort:'output', toPort:'input-0' }
    ];
    veSyncEngineAccessories(eng);
    var byName = {};
    eng.data.accessories.forEach(function(a){ byName[a.name] = a; });

    var altRow = byName['Alternatör / Jeneratör'];
    expect(altRow.sourceNodeId).toBe('alt-1');
    expect(altRow.driveRatio).toBe(3.15);
    expect(Array.isArray(altRow.curve)).toBe(true);
    // governed 2000 × 3.15 = 6300 → Prestolite 6000(8.5)/7000(9.0) arası: 8.65
    expect(altRow.userLoss).toBeCloseTo(8.65, 2);

    var acRow = byName['Klima'];
    expect(acRow.sourceNodeId).toBe('ac-1');
    // governed 2000 × 1.25 = 2500 → TM31 2000(5.85)/3000(8.5) arası: 7.175
    expect(acRow.userLoss).toBeCloseTo(7.175, 2);

    // Bağlanmayan Hava Komp. satırı boş kalır
    expect(byName['Hava Kompresörü'].userLoss).toBe(0);
    expect(byName['Hava Kompresörü'].sourceNodeId).toBeUndefined();
  });

  test('yanlış porta bağlı düğüm senkronlanmaz', () => {
    var eng = engineNode('eng-1', { governedSpeed: 2000 });
    var alt = accNode('acc-alternator', 'alt-1', { accPreset:'prestolite_180a' });
    nodes = [eng, alt];
    // Alternatör input-0 (Klima portu)'na bağlı → tip eşleşmez → yok sayılır
    connections = [{ id:'c1', from:'alt-1', to:'eng-1', fromPort:'output', toPort:'input-0' }];
    veSyncEngineAccessories(eng);
    var byName = {};
    eng.data.accessories.forEach(function(a){ byName[a.name] = a; });
    expect(byName['Alternatör / Jeneratör'].sourceNodeId).toBeUndefined();
    expect(byName['Klima'].sourceNodeId).toBeUndefined();
  });

  test('bağlantı kalkınca satır temizlenir', () => {
    var eng = engineNode('eng-1', { governedSpeed: 2000 });
    var alt = accNode('acc-alternator', 'alt-1', { accPreset:'prestolite_180a' });
    nodes = [eng, alt];
    connections = [{ id:'c1', from:'alt-1', to:'eng-1', fromPort:'output', toPort:'input-1' }];
    veSyncEngineAccessories(eng);
    expect(eng.data.accessories.find(a => a.name==='Alternatör / Jeneratör').sourceNodeId).toBe('alt-1');
    // Bağlantı kalkar
    connections = [];
    veSyncEngineAccessories(eng);
    var altRow = eng.data.accessories.find(a => a.name==='Alternatör / Jeneratör');
    expect(altRow.sourceNodeId).toBeUndefined();
    expect(altRow.curve).toBeUndefined();
    expect(altRow.userLoss).toBe(0);
  });

  test('mevcut manuel satırlar (Fan/Direksiyon) korunur', () => {
    var eng = engineNode('eng-1', { governedSpeed: 2000 });
    eng.data.accessories = [
      {name:'Fan (Kavramalı Fan)', standardLoss:22.4, userLoss:22.4},
      {name:'Alternatör / Jeneratör', standardLoss:0, userLoss:0},
      {name:'Hava Kompresörü', standardLoss:0, userLoss:0},
      {name:'Direksiyon Pompası', standardLoss:1.4, userLoss:1.4},
      {name:'Klima', standardLoss:0, userLoss:0},
      {name:'Ek Tahrik', standardLoss:0, userLoss:0}
    ];
    nodes = [eng];
    connections = [];
    veSyncEngineAccessories(eng);
    var byName = {};
    eng.data.accessories.forEach(function(a){ byName[a.name] = a; });
    expect(byName['Fan (Kavramalı Fan)'].userLoss).toBe(22.4);
    expect(byName['Direksiyon Pompası'].userLoss).toBe(1.4);
  });
});
