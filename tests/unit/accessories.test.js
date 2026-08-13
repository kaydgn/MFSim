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
// confirm/prompt jsdom'da "not implemented" — eğri işleyicileri bunları
// çağırdığı için gerçek karar veren stub'lar konuyor.
const stubs = stubGlobals({
  updateVENetChart: jest.fn(),
  confirm: jest.fn(() => true),
  prompt: jest.fn(() => ''),
});
eval(loadSource('cp-accessories.js'));

beforeEach(() => {
  nodes = [];
  connections = [];
  resetStubs(stubs);
  confirm.mockReturnValue(true);
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

  test('veSyncAllEngineAccessories: düğüm silme sonrası orphan/hayalet kayıp temizlenir', () => {
    // Regresyon: aksesuar DÜĞÜMÜ silinince (deleteSelectedNodes / restoreState yolu),
    // Motor'un accessories satırı bayat eğri taşımamalı — aksi halde çözücü hayalet
    // kayıp çıkarır. veSyncAllEngineAccessories bunu uzlaştırır.
    var eng = engineNode('eng-1', { governedSpeed: 2000 });
    var alt = accNode('acc-alternator', 'alt-1', { accPreset:'prestolite_180a' });
    nodes = [eng, alt];
    connections = [{ id:'c1', from:'alt-1', to:'eng-1', fromPort:'output', toPort:'input-1' }];
    veSyncAllEngineAccessories();
    expect(eng.data.accessories.find(a => a.name==='Alternatör / Jeneratör').sourceNodeId).toBe('alt-1');

    // Aksesuar düğümü ve bağlantısı silindi (bağlantılar doğrudan filtrelendi)
    nodes = [eng]; connections = [];
    veSyncAllEngineAccessories();
    var row = eng.data.accessories.find(a => a.name==='Alternatör / Jeneratör');
    expect(row.sourceNodeId).toBeUndefined();
    expect(row.curve).toBeUndefined();
    expect(row.userLoss).toBe(0);
    // Hayalet kayıp KALMADI
    expect(veAccessoryLossKw(eng.data.accessories, 1500, 2000)).toBe(0);
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

// ═════════════════════════════════════════════════════════════════════
// DÜZENLENEBİLİR EĞRİ — kullanıcı eğrisi doğruluk kaynağı
// ─────────────────────────────────────────────────────────────────────
// Regresyon: veAccGetNodeModel node.data.accCurve'ı HİÇ okumuyordu; eğri her
// zaman preset kütüphanesinden geliyordu → tablodan yapılan düzenleme
// çözücüye ULAŞMIYORDU. Bu blok o yolu bağlar.
// ═════════════════════════════════════════════════════════════════════
describe('veAccCurveOf / kullanıcı eğrisi', () => {
  test('kullanıcı eğrisi preset kütüphanesinin ÖNÜNE geçer', () => {
    var n = accNode('acc-ac', 'a1', {
      accPreset: 'valeo_tm21',
      accCurve: [{rpm:1000,kw:9},{rpm:2000,kw:9}],
      accDriveRatio: 1.25
    });
    expect(veAccCurveOf(n)).toEqual([{rpm:1000,kw:9},{rpm:2000,kw:9}]);
    var m = veAccGetNodeModel(n);
    expect(m.curve[0].kw).toBe(9);
    expect(m.curve).toHaveLength(2);
    // Preset kütüphanesi 10 noktalı — kütüphaneden gelmediği kanıtlanır
    expect(VE_AC_PRESETS['valeo_tm21'].curve).toHaveLength(10);
  });

  test('kullanıcı eğrisi yoksa preset kütüphanesine düşer', () => {
    var n = accNode('acc-ac', 'a2', { accPreset:'valeo_tm21' });
    expect(veAccCurveOf(n)).toBe(VE_AC_PRESETS['valeo_tm21'].curve);
  });

  test('henüz düzenlenmemiş boş accCurve preset\'i gölgelemez', () => {
    var n = accNode('acc-ac', 'a3', { accPreset:'valeo_tm21', accCurve:[] });
    expect(veAccCurveOf(n)).toHaveLength(10);
  });

  test('KULLANICI tabloyu boşalttıysa preset\'e geri düşmez', () => {
    // Ekranda boş tablo görünürken çözücünün preset'i okumaya devam etmesi
    // "makul ama yanlış" bir sonuç üretirdi — accCurveDirty bunu keser.
    var n = accNode('acc-ac', 'a3b', { accPreset:'valeo_tm21', accCurve:[], accCurveDirty:true });
    expect(veAccCurveOf(n)).toEqual([]);
    expect(veAccGetNodeModel(n)).toBeNull();
  });

  test('preset yok + serbest eğri → "Özel eğri"; düzenlenmişse işaretlenir', () => {
    var free = accNode('acc-aircomp', 'a4', { accPreset:'', accCurve:[{rpm:500,kw:1},{rpm:1000,kw:2}] });
    expect(veAccGetNodeModel(free).label).toBe('Özel eğri');
    var edited = accNode('acc-ac', 'a5', {
      accPreset:'valeo_tm21', accCurve:[{rpm:1000,kw:3}], accCurveDirty:true
    });
    expect(veAccGetNodeModel(edited).label).toBe('Valeo TM21 (düzenlendi)');
  });

  test('model eğrisi kopya döner — düğüm verisi dışarıdan bozulamaz', () => {
    var n = accNode('acc-ac', 'a6', { accPreset:'', accCurve:[{rpm:1000,kw:3},{rpm:2000,kw:5}] });
    var m = veAccGetNodeModel(n);
    m.curve.push({rpm:9999,kw:99});
    expect(n.data.accCurve).toHaveLength(2);
  });

  test('DÜZENLENEN eğri Motor\'un net-tork modeline yazılır', () => {
    // Bu, düzeltmenin asıl karşılığı: tablo → düğüm → Motor → çözücü.
    var eng = engineNode('eng-1', { governedSpeed: 2000 });
    var ac = accNode('acc-ac', 'ac-1', {
      accPreset:'valeo_tm21', accDriveRatio:1.25,
      accCurve:[{rpm:1000,kw:9},{rpm:5000,kw:9}], accCurveDirty:true
    });
    nodes = [eng, ac];
    connections = [{ id:'c1', from:'ac-1', to:'eng-1', fromPort:'output', toPort:'input-0' }];
    veSyncEngineAccessories(eng);
    var row = eng.data.accessories.find(a => a.name === 'Klima');
    expect(row.curve[0].kw).toBe(9);
    // governed 2000 × 1.25 = 2500 → düz 9 kW eğrisi (preset olsaydı ≈5.05 kW)
    expect(row.userLoss).toBeCloseTo(9, 6);
    expect(veAccessoryLossKw(eng.data.accessories, 2000, 2000)).toBeCloseTo(9, 6);
  });
});

// ═════════════════════════════════════════════════════════════════════
// veAccNormalizeCurve
// ═════════════════════════════════════════════════════════════════════
describe('veAccNormalizeCurve', () => {
  test('sıralar, negatif kW\'ı sıfıra kırpar, aynı devri son yazılanla birleştirir', () => {
    expect(veAccNormalizeCurve([
      {rpm:2000,kw:4},{rpm:1000,kw:-2},{rpm:1000,kw:2}
    ])).toEqual([{rpm:1000,kw:2},{rpm:2000,kw:4}]);
  });

  test('geçersiz / sıfır-altı devirler atılır', () => {
    expect(veAccNormalizeCurve([
      {rpm:'abc',kw:3},{rpm:0,kw:1},{rpm:-500,kw:2},{rpm:1200,kw:'2.5'}
    ])).toEqual([{rpm:1200,kw:2.5}]);
  });

  test('metin girdiler sayıya çevrilir; kW\'ı boş olan nokta 0 alınır', () => {
    expect(veAccNormalizeCurve([{rpm:'1500',kw:''}])).toEqual([{rpm:1500,kw:0}]);
  });

  test('boş / null girdi → boş dizi', () => {
    expect(veAccNormalizeCurve([])).toEqual([]);
    expect(veAccNormalizeCurve(null)).toEqual([]);
  });
});

// ═════════════════════════════════════════════════════════════════════
// veAccGrossTorqueAt / veAccPanelCtx — panelin okuduğu bağlam
// ═════════════════════════════════════════════════════════════════════
describe('veAccGrossTorqueAt', () => {
  var td = [{rpm:1000,torque:900},{rpm:1500,torque:1100},{rpm:2200,torque:1000}];

  test('ara devirde lineer, uçlarda sabitlenir', () => {
    var eng = { id:'e', type:'engine', data:{ torqueData: td } };
    expect(veAccGrossTorqueAt(eng, 1000)).toBe(900);
    expect(veAccGrossTorqueAt(eng, 1250)).toBeCloseTo(1000, 6);
    expect(veAccGrossTorqueAt(eng, 600)).toBe(900);    // altta sabit
    expect(veAccGrossTorqueAt(eng, 3000)).toBe(1000);  // üstte sabit
  });

  test('sırasız veri de doğru okunur', () => {
    var eng = { id:'e', type:'engine', data:{ torqueData: td.slice().reverse() } };
    expect(veAccGrossTorqueAt(eng, 1250)).toBeCloseTo(1000, 6);
  });

  test('motor / tork verisi yok → null (uydurma değer yok)', () => {
    expect(veAccGrossTorqueAt(null, 1500)).toBeNull();
    expect(veAccGrossTorqueAt({ id:'e', data:{} }, 1500)).toBeNull();
    expect(veAccGrossTorqueAt({ id:'e', data:{torqueData:[]} }, 1500)).toBeNull();
  });
});

describe('veAccPanelCtx', () => {
  test('motor bağlı değil → varsayılan aralık, gross null', () => {
    var n = accNode('acc-ac', 'a1', { accPreset:'valeo_tm21' });
    nodes = [n]; connections = [];
    var ctx = veAccPanelCtx(n);
    expect(ctx.eng).toBeNull();
    expect(ctx.idle).toBe(600);
    expect(ctx.gov).toBe(2200);
    expect(ctx.gross).toBeNull();
    expect(ctx.ratio).toBe(1.25);
  });

  test('motor bağlı → aralık ve brüt tork motordan okunur', () => {
    var eng = engineNode('eng-1', { idleRpm: 700, governedSpeed: 2100 });
    eng.data.torqueData = [{rpm:700,torque:800},{rpm:2100,torque:1100}];
    var n = accNode('acc-ac', 'a1', { accPreset:'valeo_tm21', accDriveRatio:1.25 });
    nodes = [eng, n];
    connections = [{ id:'c1', from:'a1', to:'eng-1', fromPort:'output', toPort:'input-0' }];
    var ctx = veAccPanelCtx(n);
    expect(ctx.eng.id).toBe('eng-1');
    expect(ctx.idle).toBe(700);
    expect(ctx.gov).toBe(2100);
    expect(ctx.gross).toBeCloseTo(1100, 6);
  });

  test('bozuk aralık (gov <= idle) makul bir bant\'a düzeltilir', () => {
    var eng = engineNode('eng-1', { idleRpm: 900, governedSpeed: 500 });
    var n = accNode('acc-aircomp', 'a1', {});
    nodes = [eng, n];
    connections = [{ id:'c1', from:'a1', to:'eng-1', fromPort:'output', toPort:'input-2' }];
    var ctx = veAccPanelCtx(n);
    expect(ctx.gov).toBe(2500);   // 900 + 1600
    expect(ctx.gov).toBeGreaterThan(ctx.idle);
  });
});

// ═════════════════════════════════════════════════════════════════════
// veAccParseCurveText — pano yapıştırması
// ═════════════════════════════════════════════════════════════════════
describe('veAccParseCurveText', () => {
  test('tab ayraç (Excel kopyası)', () => {
    expect(veAccParseCurveText('850\t1.38\n1000\t2.0')).toEqual([
      {rpm:850,kw:1.38},{rpm:1000,kw:2.0}
    ]);
  });
  test('virgül/noktalı virgül ayraç + TR ondalık virgülü', () => {
    expect(veAccParseCurveText('850;1,38\n1000, 2,5')).toEqual([
      {rpm:850,kw:1.38},{rpm:1000,kw:2.5}
    ]);
  });
  test('boşluk ayraç ve boş satırlar', () => {
    expect(veAccParseCurveText('  850   1.38  \n\n1000 2\n')).toEqual([
      {rpm:850,kw:1.38},{rpm:1000,kw:2}
    ]);
  });
  test('saf virgüllü CSV: virgül TAM İKİ parça veriyorsa sütun ayracı', () => {
    expect(veAccParseCurveText('850,1.38\n1000,2')).toEqual([
      {rpm:850,kw:1.38},{rpm:1000,kw:2}
    ]);
  });
  test('sayı olmayan / tek sütunlu satırlar sessizce atılır', () => {
    expect(veAccParseCurveText('rpm\tkW\n850\t1.38\n1200\nabc\tdef')).toEqual([
      {rpm:850,kw:1.38}
    ]);
  });
  test('boş girdi → boş dizi', () => {
    expect(veAccParseCurveText('')).toEqual([]);
    expect(veAccParseCurveText(null)).toEqual([]);
  });
});

// ═════════════════════════════════════════════════════════════════════
// Eğri tablosu işleyicileri — düzenleme → veri → Motor zinciri
// ═════════════════════════════════════════════════════════════════════
describe('eğri işleyicileri', () => {
  function wired() {
    var eng = engineNode('eng-1', { idleRpm: 600, governedSpeed: 2000 });
    var ac = accNode('acc-ac', 'ac-1', {
      accPreset:'valeo_tm21', accDriveRatio:1.25,
      accCurve:[{rpm:1000,kw:2},{rpm:2000,kw:4}]
    });
    nodes = [eng, ac];
    connections = [{ id:'c1', from:'ac-1', to:'eng-1', fromPort:'output', toPort:'input-0' }];
    return { eng: eng, ac: ac };
  }

  test('hücre değişimi veriye yazılır, normalize edilir ve Motor\'a yayılır', () => {
    var w = wired();
    onVEAccCurveCellChange('ac-1', 0, 'kw', '3.5');
    expect(w.ac.data.accCurve).toEqual([{rpm:1000,kw:3.5},{rpm:2000,kw:4}]);
    expect(w.ac.data.accCurveDirty).toBe(true);
    expect(w.eng.data.accessories.find(a => a.name==='Klima').curve[0].kw).toBe(3.5);
    expect(saveState).toHaveBeenCalled();
  });

  test('devir düzenlemesi sıralamayı bozmaz (normalize sıralar)', () => {
    var w = wired();
    onVEAccCurveCellChange('ac-1', 1, 'rpm', '500');
    expect(w.ac.data.accCurve).toEqual([{rpm:500,kw:4},{rpm:1000,kw:2}]);
  });

  test('negatif giriş sıfıra kırpılır', () => {
    var w = wired();
    onVEAccCurveCellChange('ac-1', 0, 'kw', '-7');
    expect(w.ac.data.accCurve[0].kw).toBe(0);
  });

  test('satır ekleme: son devrin 500 üstüne 0 kW nokta', () => {
    var w = wired();
    onVEAccCurveAddRow('ac-1');
    expect(w.ac.data.accCurve).toEqual([
      {rpm:1000,kw:2},{rpm:2000,kw:4},{rpm:2500,kw:0}
    ]);
  });

  test('satır silme', () => {
    var w = wired();
    onVEAccCurveDelRow('ac-1', 0);
    expect(w.ac.data.accCurve).toEqual([{rpm:2000,kw:4}]);
  });

  test('temizle: eğri boşalır, Motor satırındaki hayalet kayıp da gider', () => {
    var w = wired();
    onVEAccCurveClear('ac-1');
    expect(w.ac.data.accCurve).toEqual([]);
    var row = w.eng.data.accessories.find(a => a.name==='Klima');
    expect(row.sourceNodeId).toBeUndefined();
    expect(row.userLoss).toBe(0);
    expect(veAccessoryLossKw(w.eng.data.accessories, 1500, 2000)).toBe(0);
  });

  test('temizle onaylanmazsa veri korunur', () => {
    var w = wired();
    confirm.mockReturnValue(false);
    onVEAccCurveClear('ac-1');
    expect(w.ac.data.accCurve).toHaveLength(2);
  });

  test('preset\'ten doldur: kütüphane eğrisini geri yazar, "düzenlendi" işaretini siler', () => {
    var w = wired();
    w.ac.data.accCurveDirty = true;
    onVEAccCurveFill('ac-1');
    expect(w.ac.data.accCurve).toHaveLength(VE_AC_PRESETS['valeo_tm21'].curve.length);
    expect(w.ac.data.accCurveDirty).toBe(false);
    expect(veAccGetNodeModel(w.ac).label).toBe('Valeo TM21');
  });

  test('preset seçili değilken doldur → uyarı, veri değişmez', () => {
    var w = wired();
    w.ac.data.accPreset = '';
    onVEAccCurveFill('ac-1');
    expect(showToast).toHaveBeenCalled();
    expect(w.ac.data.accCurve).toHaveLength(2);
  });

  test('model değişimi eğriyi sıfırdan yazar ve "düzenlendi" işaretini kaldırır', () => {
    var w = wired();
    w.ac.data.accCurveDirty = true;
    onVEAccPresetSelect('ac-1', 'valeo_tm31');
    expect(w.ac.data.accCurveDirty).toBe(false);
    expect(w.ac.data.accCurve).toEqual(VE_AC_PRESETS['valeo_tm31'].curve);
    expect(w.ac.data.accDriveRatio).toBe(1.25);
  });

  test('bilinmeyen düğüm id\'si sessizce yok sayılır (patlamaz)', () => {
    wired();
    expect(() => onVEAccCurveAddRow('yok')).not.toThrow();
    expect(() => onVEAccCurveDelRow('yok', 0)).not.toThrow();
    expect(() => onVEAccCurveCellChange('yok', 0, 'kw', '1')).not.toThrow();
  });
});

// ═════════════════════════════════════════════════════════════════════
// Panel üreticileri — smoke (bkz. CLAUDE.md test politikası: panel başına
// TEK "üretiliyor mu / patlamıyor mu" testi, etiket başına assertion yok).
// ═════════════════════════════════════════════════════════════════════
describe('panel üreticileri (smoke)', () => {
  test('üç aksesuar tipi de üç adımlı paneli üretir', () => {
    ['acc-ac', 'acc-alternator', 'acc-aircomp'].forEach(function(type){
      var n = accNode(type, 'n-' + type, {});
      nodes = [n]; connections = [];
      var html = getAccessoryPropertiesHTML(n);
      expect(html).toContain('ve-cp-grid--steps');
      expect((html.match(/ve-acc-step/g) || []).length).toBeGreaterThanOrEqual(3);
      expect(html).toContain('ve-acc-chart-n-' + type);
      // Varsayılanlar ilk render'da yazılır
      expect(n.data.accDriveRatio).toBe(VE_ACC_TYPES[type].defRatio);
      expect(n.data.accCurve).toEqual([]);
    });
  });

  test('eğri tablosu: aralık dışı noktalar işaretlenir, türetilen sütunlar doğru', () => {
    // ratio 1.25, motor 600–2200 (motor bağlı değil) → 9000 rpm aksesuar = 7200
    // motor devri ⇒ aralık dışı; 2000 aksesuar = 1600 motor ⇒ içeride.
    var n = accNode('acc-ac', 'ac-1', {
      accDriveRatio: 1.25, accCurve: [{rpm:2000,kw:4},{rpm:9000,kw:10.4}]
    });
    nodes = [n]; connections = [];
    var h = veAccCurveTableHTML(n);
    expect(h).toContain('>1600<');                       // 2000 / 1.25
    expect(h).toContain('>23.9<');                       // 4 × 9550 / 1600
    expect(h).toContain('class="sw-chain-bar warn"');    // 1 nokta dışarıda
    expect((h.match(/<tr class="out">/g) || []).length).toBe(1);
  });

  test('tek noktalı eğri "en az 2 nokta" uyarısı verir', () => {
    var n = accNode('acc-ac', 'ac-1', { accDriveRatio:1.25, accCurve:[{rpm:1000,kw:2}] });
    nodes = [n]; connections = [];
    expect(veAccCurveTableHTML(n)).toContain('sw-chain-bar fail');
  });

  test('metrikler: motor bağlıyken pay yüzdesi, bağlı değilken YOK', () => {
    // Bağlı: gross 1100 Nm, düz 5.58 kW @ 2200 ⇒ 24.2 Nm ⇒ %2.2
    var eng = engineNode('eng-1', { idleRpm:600, governedSpeed:2200 });
    eng.data.torqueData = [{rpm:600,torque:1100},{rpm:2200,torque:1100}];
    var n = accNode('acc-ac', 'ac-1', {
      accDriveRatio:1.25, accCurve:[{rpm:750,kw:5.58},{rpm:2750,kw:5.58}]
    });
    nodes = [eng, n];
    connections = [{ id:'c1', from:'ac-1', to:'eng-1', fromPort:'output', toPort:'input-0' }];
    var h = veAccMetricsHTML(n);
    expect(h).toContain('5.58 kW');
    expect(h).toContain('24.2 Nm');
    expect(h).toContain('%2.2');

    // Bağlantı yok → yüzde satırı hiç üretilmez (uydurma değer yok)
    connections = [];
    var h2 = veAccMetricsHTML(n);
    expect(h2).not.toContain('ve-acc-share');
    expect(h2).toContain('sw-chain-bar fail');
  });

  test('model yokken metrikler yönlendirme metni verir', () => {
    var n = accNode('acc-ac', 'ac-1', { accPreset:'' });
    nodes = [n]; connections = [];
    expect(veAccMetricsHTML(n)).toContain('Metrikler için');
  });

  test('manuel modda eğri tablosu yerine "kullanılmıyor" açıklaması gelir', () => {
    // Manuel sabit kW'da eğri hiç okunmaz; boş tablo + dört düğme ölü arayüzdü.
    var n = accNode('acc-ac', 'ac-1', { accPreset:'__manual__', accManualKw:6 });
    nodes = [n]; connections = [];
    var h = veAccCurveTableHTML(n);
    expect(h).toContain('eğri kullanılmaz');
    expect(h).not.toContain('<table');
    expect(h).not.toContain('onVEAccCurveAddRow');
  });

  test('adım rozetleri düğümün durumunu izler', () => {
    var bare = accNode('acc-ac', 'a1', { accPreset:'' });
    expect(veAccModelBadge(bare)).toEqual({ text:'seçilmedi', cls:'miss', step:'' });
    expect(veAccPointBadge(bare)).toEqual({ text:'0 nokta', cls:'miss' });

    var preset = accNode('acc-ac', 'a2', { accPreset:'valeo_tm21' });
    expect(veAccModelBadge(preset).text).toBe('tamam');
    expect(veAccPointBadge(preset)).toEqual({ text:'10 nokta', cls:'ok' });

    var manual = accNode('acc-ac', 'a3', { accPreset:'__manual__', accManualKw:4 });
    expect(veAccModelBadge(manual).text).toBe('manuel');
    expect(veAccPointBadge(manual)).toEqual({ text:'kullanılmıyor', cls:'miss' });

    var free = accNode('acc-ac', 'a4', { accPreset:'', accCurve:[{rpm:1000,kw:2}] });
    expect(veAccModelBadge(free).text).toBe('özel eğri');
  });
});
