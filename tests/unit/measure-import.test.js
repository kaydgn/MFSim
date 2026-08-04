/**
 * js/measure-import.js — ölçüm içe aktarmanın anlam katmanı
 *
 * Test politikası gereği burası yüksek değerli: sütun adı çözümü, ondalık
 * ayırıcı, başlık satırı tespiti ve seyrek veri doldurma sessizce bozulursa
 * "makul ama yanlış" bir eğri üretir — gözle yakalanmaz. Sihirbazın HTML
 * üreten kısmı (measure-import-ui.js) burada test EDİLMEZ.
 */

const M = require('../../js/measure-import.js');

beforeEach(() => M._reset());

// Gerçek bir CANoe Excel çıktısının satır düzeni: üstte iki üstbilgi satırı,
// boş ayırıcı, başlık, birim satırı, sonra veri.
function canoeRows() {
  return [
    ['Measurement:', 'Testfahrt_2026_03_11', null, null],
    ['Exported:', '11.03.2026 14:22:07', null, null],
    [null, null, null, null],
    ['Time', 'EngineData::EngSpeed [1/min]', 'VehSpeed', 'GearBox::Gear'],
    ['s', '1/min', 'km/h', ''],
    [0, 800, 0, 1],
    [0.01, 812.5, 0.4, 1],
    [0.02, 825, 0.9, 2],
  ];
}

describe('veImpParseHeader', () => {
  test('mesaj::sinyal ayrılır', () => {
    const p = M.veImpParseHeader('EngineData::EngSpeed');
    expect(p.group).toBe('EngineData');
    expect(p.name).toBe('EngSpeed');
  });

  test('köşeli ve normal parantezdeki birim ayrılır', () => {
    expect(M.veImpParseHeader('EngSpeed [1/min]')).toMatchObject({ name: 'EngSpeed', unit: '1/min' });
    expect(M.veImpParseHeader('Hız (km/h)')).toMatchObject({ name: 'Hız', unit: 'km/h' });
  });

  test('mesaj adı ve birim birlikte çözülür', () => {
    const p = M.veImpParseHeader('CAN1::EngineData::EngSpeed [1/min]');
    expect(p).toMatchObject({ group: 'CAN1::EngineData', name: 'EngSpeed', unit: '1/min' });
  });

  test('uzun açıklama birim sayılmaz', () => {
    // "Hız (aracın ölçülen boyuna hızı)" — parantezi birim sanmak eksen
    // etiketini anlamsızlaştırırdı.
    const p = M.veImpParseHeader('Hız (aracın ölçülen boyuna hızı)');
    expect(p.unit).toBe('');
    expect(p.name).toBe('Hız (aracın ölçülen boyuna hızı)');
  });

  test('nokta KASITEN bölünmez', () => {
    // "1.Vites" ya da "T_gb_out.max" yanlış yerden ikiye ayrılmamalı.
    expect(M.veImpParseHeader('T_gb_out.max').name).toBe('T_gb_out.max');
    expect(M.veImpParseHeader('T_gb_out.max').group).toBe('');
  });

  test('CANoe Graphics biçimi: boşluksuz köşeli parantez', () => {
    // Gerçek kullanıcı dosyasından birebir başlıklar (Graphics.csv).
    expect(M.veImpParseHeader('Time[s]')).toMatchObject({ name: 'Time', unit: 's', group: '' });
    expect(M.veImpParseHeader('EEC1::EngSpeed[rpm]')).toMatchObject({
      group: 'EEC1', name: 'EngSpeed', unit: 'rpm',
    });
    expect(M.veImpParseHeader('EEC1::ActualEngPercentTorque[%]')).toMatchObject({
      group: 'EEC1', name: 'ActualEngPercentTorque', unit: '%',
    });
    expect(M.veImpParseHeader('CCVS1::WheelBasedVehicleSpeed[km/h]')).toMatchObject({
      group: 'CCVS1', name: 'WheelBasedVehicleSpeed', unit: 'km/h',
    });
    // Birimsiz sütun: parantez yok, ad olduğu gibi kalır
    expect(M.veImpParseHeader('ETC2::TransCurrentGear')).toMatchObject({
      group: 'ETC2', name: 'TransCurrentGear', unit: '',
    });
  });

  test('Türkçe karakterli başlık bozulmaz', () => {
    expect(M.veImpParseHeader('Motor Sıcaklığı [°C]')).toMatchObject({
      name: 'Motor Sıcaklığı', unit: '°C',
    });
  });
});

describe('veImpToNumber', () => {
  test('sayı ve boş değerler', () => {
    expect(M.veImpToNumber(12.5, false)).toBe(12.5);
    expect(M.veImpToNumber('', false)).toBe(null);
    expect(M.veImpToNumber(null, false)).toBe(null);
    expect(M.veImpToNumber('  ', false)).toBe(null);
    expect(M.veImpToNumber(NaN, false)).toBe(null);
  });

  test('nokta ondalıklı biçim', () => {
    expect(M.veImpToNumber('812.25', false)).toBe(812.25);
    expect(M.veImpToNumber('-3.5e-2', false)).toBeCloseTo(-0.035, 12);
    expect(M.veImpToNumber('+7', false)).toBe(7);
  });

  test('Avrupa biçimi: 1.234,56', () => {
    expect(M.veImpToNumber('1.234,56', true)).toBe(1234.56);
    expect(M.veImpToNumber('812,25', true)).toBe(812.25);
    expect(M.veImpToNumber('-0,5', true)).toBe(-0.5);
  });

  test('binlik virgülü ondalık nokta kipinde atılır', () => {
    expect(M.veImpToNumber('1,234.56', false)).toBe(1234.56);
    // Tek virgül ondalık DEĞİLKEN sayı sayılmaz — sessizce 12 okunursa
    // 12,5 değeri yarıya düşerdi.
    expect(M.veImpToNumber('12,5', false)).toBe(null);
  });

  test('metin sayıya zorlanmaz', () => {
    expect(M.veImpToNumber('1C', false)).toBe(null);
    expect(M.veImpToNumber('N/A', false)).toBe(null);
    expect(M.veImpToNumber('#N/A', false)).toBe(null);
  });

  test('bölünmez boşluk binlik ayracı temizlenir', () => {
    expect(M.veImpToNumber('1 234.5', false)).toBe(1234.5);
  });
});

describe('veImpDetectCommaDecimal', () => {
  test('virgüllü dosya tanınır', () => {
    expect(M.veImpDetectCommaDecimal([['0,00', '800,5'], ['0,01', '812,25']], 0)).toBe(true);
  });
  test('noktalı dosya tanınır', () => {
    expect(M.veImpDetectCommaDecimal([['0.00', '800.5'], ['0.01', '812.25']], 0)).toBe(false);
  });
  test('gerçek sayı hücreli (xlsx) dosyada varsayılan nokta', () => {
    expect(M.veImpDetectCommaDecimal([[0, 800.5], [0.01, 812.25]], 0)).toBe(false);
  });
});

describe('veImpDetectHeaderRow', () => {
  test('üstbilgi satırları elenir, başlık ve birim satırı bulunur', () => {
    const L = M.veImpDetectHeaderRow(canoeRows(), false);
    expect(L.headerRow).toBe(3);
    expect(L.unitRow).toBe(4);
    expect(L.dataRow).toBe(5);
  });

  test('sade dosya: ilk satır başlık', () => {
    const rows = [['Time', 'A', 'B'], [0, 1, 2], [0.1, 3, 4]];
    const L = M.veImpDetectHeaderRow(rows, false);
    expect(L).toMatchObject({ headerRow: 0, unitRow: -1, dataRow: 1 });
  });

  test('birim satırı yoksa yanlışlıkla uydurulmaz', () => {
    const rows = [['Time', 'EngSpeed'], [0, 800], [0.01, 812]];
    expect(M.veImpDetectHeaderRow(rows, false).unitRow).toBe(-1);
  });

  test('üstbilgi var ama boş ayırıcı satır yok', () => {
    const rows = [
      ['Measurement:', 'Test', null],
      ['Time', 'EngSpeed', 'VehSpeed'],
      [0, 800, 0],
      [0.01, 812, 0.4],
    ];
    const L = M.veImpDetectHeaderRow(rows, false);
    expect(L.headerRow).toBe(1);
    expect(L.dataRow).toBe(2);
  });

  test('dar tabloda metin sütunu veri satırını gizlemez', () => {
    // Gerçek hatadan doğdu: iki sütunlu dosyada tek metin kanalı sayısal
    // oranı %50'ye düşürüyor, ilk veri satırı başlık sanılıyordu.
    const rows = [['Time', 'Mod'], [0, '1C'], [0.1, '2L'], [0.2, '2L']];
    const L = M.veImpDetectHeaderRow(rows, false);
    expect(L).toMatchObject({ headerRow: 0, dataRow: 1 });
  });

  test('sayısal değer taşıyan üstbilgi satırı veri sanılmaz', () => {
    const rows = [
      ['Version:', 17, null],
      ['Time', 'A', 'B'],
      [0, 1, 2],
      [0.1, 3, 4],
    ];
    const L = M.veImpDetectHeaderRow(rows, false);
    expect(L.headerRow).toBe(1);
    expect(L.dataRow).toBe(2);
  });

  test('seyrek veri satırları başlık tespitini kaydırmaz', () => {
    const rows = [['Time', 'A', 'B'], [0, 1, 2], [0.1, null, null], [0.2, 3, null]];
    expect(M.veImpDetectHeaderRow(rows, false)).toMatchObject({ headerRow: 0, dataRow: 1 });
  });

  test('ondalık virgüllü veri sayısal sayılır', () => {
    const rows = [['Zaman', 'Devir'], ['0,00', '800,5'], ['0,01', '812,25']];
    const L = M.veImpDetectHeaderRow(rows, true);
    expect(L).toMatchObject({ headerRow: 0, dataRow: 1 });
  });
});

describe('veImpBuildColumns', () => {
  test('ad, birim, grup ve tip çözülür', () => {
    const rows = canoeRows();
    const L = M.veImpDetectHeaderRow(rows, false);
    const cols = M.veImpBuildColumns(rows, L, false);

    expect(cols).toHaveLength(4);
    expect(cols[0]).toMatchObject({ key: 'c0', name: 'Time', unit: 's', kind: 'num' });
    // Birim başlıkta [1/min] olarak var — birim satırından ÖNCE gelir
    expect(cols[1]).toMatchObject({ name: 'EngSpeed', group: 'EngineData', unit: '1/min' });
    // Bu sütunun birimi yalnızca birim satırında var
    expect(cols[2]).toMatchObject({ name: 'VehSpeed', unit: 'km/h' });
    expect(cols[3]).toMatchObject({ name: 'Gear', group: 'GearBox', unit: '' });
  });

  test('metin sütunu metin olarak işaretlenir', () => {
    const rows = [['Time', 'Mod'], [0, '1C'], [0.1, '2L'], [0.2, '2L']];
    const L = M.veImpDetectHeaderRow(rows, false);
    const cols = M.veImpBuildColumns(rows, L, false);
    expect(cols[1].kind).toBe('text');
  });

  test('başlıksız sütuna yer tutucu ad verilir', () => {
    const rows = [['Time', ''], [0, 1], [0.1, 2]];
    const L = M.veImpDetectHeaderRow(rows, false);
    expect(M.veImpBuildColumns(rows, L, false)[1].name).toBe('Sütun 2');
  });

  test('geç başlayan sinyal boş sayılmaz', () => {
    // Gerçek CANoe dosyasında bulundu: sütun tipi yalnızca ilk satırlardan
    // belirlenirse, koşunun ortasında konuşmaya başlayan bir sinyal 'empty'
    // damgası yiyip listeden tamamen düşüyordu.
    const rows = [['Time', 'GecKanal']];
    for (let i = 0; i < 3000; i++) rows.push([i * 0.01, i < 2500 ? null : i]);
    const L = M.veImpDetectHeaderRow(rows, false);
    const cols = M.veImpBuildColumns(rows, L, false);
    expect(cols[1].kind).toBe('num');
  });

  test('sonradan metne dönen sütun metin sayılır', () => {
    const rows = [['Time', 'Mod']];
    for (let i = 0; i < 1200; i++) rows.push([i * 0.01, i < 600 ? null : '2L']);
    const L = M.veImpDetectHeaderRow(rows, false);
    expect(M.veImpBuildColumns(rows, L, false)[1].kind).toBe('text');
  });

  test('seyrek sütun işaretlenir', () => {
    const rows = [['Time', 'S']];
    for (let i = 0; i < 40; i++) rows.push([i * 0.01, i % 4 === 0 ? i : null]);
    const L = M.veImpDetectHeaderRow(rows, false);
    const cols = M.veImpBuildColumns(rows, L, false);
    expect(cols[1].sparse).toBe(true);
    expect(cols[0].sparse).toBe(false);
  });
});

describe('veImpForwardFill', () => {
  test('boşluklar son değerle sürdürülür', () => {
    expect(M.veImpForwardFill([1, null, null, 4, null])).toEqual([1, 1, 1, 4, 4]);
  });

  test('ilk örnekten öncesi doldurulmaz', () => {
    // Orada gerçekten veri yok; 0 yazmak eğriyi tabana yapıştırırdı.
    expect(M.veImpForwardFill([null, null, 3, null])).toEqual([null, null, 3, 3]);
  });

  test('sıfır geçerli değerdir, boşluk sayılmaz', () => {
    expect(M.veImpForwardFill([0, null, 5])).toEqual([0, 0, 5]);
  });
});

describe('veImpGuessXColumn', () => {
  const col = (name, over) => Object.assign({ name, unit: '', kind: 'num' }, over || {});

  test('Time sütunu seçilir', () => {
    const cols = [col('EngSpeed'), col('Time', { _monotonic: true }), col('VehSpeed')];
    expect(M.veImpGuessXColumn(cols)).toBe(1);
  });

  test('Türkçe "Zaman" da tanınır', () => {
    expect(M.veImpGuessXColumn([col('Devir'), col('Zaman', { _monotonic: true })])).toBe(1);
  });

  test('ad yoksa artan ilk sütun kazanır', () => {
    const cols = [col('A', { _monotonic: true }), col('B')];
    expect(M.veImpGuessXColumn(cols)).toBe(0);
  });

  test('metin sütunu X ekseni olarak seçilmez', () => {
    const cols = [col('Time', { kind: 'text' }), col('t', { _monotonic: true })];
    expect(M.veImpGuessXColumn(cols)).toBe(1);
  });

  test('eşitlikte soldaki sütun kazanır — genelde ilk sütun zamandır', () => {
    expect(M.veImpGuessXColumn([col('A'), col('B')])).toBe(0);
  });
});

describe('veImpIsMonotonic', () => {
  test('artan dizi', () => expect(M.veImpIsMonotonic([0, 1, 2, 2, 5])).toBe(true));
  test('azalan kırılma', () => expect(M.veImpIsMonotonic([0, 1, 0.5])).toBe(false));
  test('boşluklar atlanır', () => expect(M.veImpIsMonotonic([0, null, 2])).toBe(true));
});

describe('veImpBuildDataset', () => {
  function build(over) {
    const rows = canoeRows();
    const layout = M.veImpDetectHeaderRow(rows, false);
    const columns = M.veImpBuildColumns(rows, layout, false);
    return M.veImpBuildDataset(Object.assign({
      rows, layout, columns, commaDecimal: false,
      xIndex: 0, yIndexes: [1, 2, 3], fileName: 'test.xlsx', name: 'test',
    }, over || {}));
  }

  test('X ekseni ve sütun değerleri indeks hizalı gelir', () => {
    const ds = build();
    expect(ds.x.values).toEqual([0, 0.01, 0.02]);
    expect(ds.x.unit).toBe('s');
    expect(ds.columns).toHaveLength(3);
    expect(ds.columns[0].values).toEqual([800, 812.5, 825]);
    // Ölçüm penceresi seriyi X dizisiyle yalnızca indeksten hizalar —
    // uzunluklar birebir eşit olmalı.
    ds.columns.forEach((c) => expect(c.values).toHaveLength(ds.x.values.length));
  });

  test('X olarak seçilen sütun Y listesine sızmaz', () => {
    const ds = build({ yIndexes: [0, 1] });
    expect(ds.columns).toHaveLength(1);
    expect(ds.columns[0].name).toBe('EngSpeed');
  });

  test('kimlikler öneklerle üretilir', () => {
    const ds = build();
    expect(ds.sensorId).toBe('#' + ds.id);
    expect(ds.dataSource).toBe('import:' + ds.id);
  });

  test('seyrek sütun örnekle-ve-tut ile doldurulur', () => {
    const rows = [['Time', 'S'], [0, 5], [0.1, null], [0.2, 8]];
    const layout = M.veImpDetectHeaderRow(rows, false);
    const columns = M.veImpBuildColumns(rows, layout, false);
    const ds = M.veImpBuildDataset({ rows, layout, columns, xIndex: 0, yIndexes: [1] });
    expect(ds.columns[0].values).toEqual([5, 5, 8]);
  });

  test('holdSparse kapatılırsa boşluk korunur', () => {
    const rows = [['Time', 'S'], [0, 5], [0.1, null], [0.2, 8]];
    const layout = M.veImpDetectHeaderRow(rows, false);
    const columns = M.veImpBuildColumns(rows, layout, false);
    const ds = M.veImpBuildDataset({ rows, layout, columns, xIndex: 0, yIndexes: [1], holdSparse: false });
    expect(ds.columns[0].values).toEqual([5, null, 8]);
  });

  test('seyrek METİN sütunu da örnekle-ve-tut ile doldurulur', () => {
    // Gerçek hatadan doğdu: doldurulmayan metin kanalında durum şeridi Y
    // eksenini etiketliyor ama tek çizgi çizmiyordu — kalem her boşlukta
    // kalkıyor, izole noktalar görünmüyordu.
    const rows = [['Time', 'Mod'], [0, '1C'], [0.1, null], [0.2, '2L'], [0.3, null]];
    const layout = M.veImpDetectHeaderRow(rows, false);
    const columns = M.veImpBuildColumns(rows, layout, false);
    const ds = M.veImpBuildDataset({ rows, layout, columns, xIndex: 0, yIndexes: [1] });
    expect(ds.columns[0].values).toEqual(['1C', '1C', '2L', '2L']);
  });

  test('metin sütunu metin kalır — ölçüm penceresi durum şeridi çizebilsin', () => {
    const rows = [['Time', 'Mod'], [0, '1C'], [0.1, '2L']];
    const layout = M.veImpDetectHeaderRow(rows, false);
    const columns = M.veImpBuildColumns(rows, layout, false);
    const ds = M.veImpBuildDataset({ rows, layout, columns, xIndex: 0, yIndexes: [1] });
    expect(ds.columns[0].values).toEqual(['1C', '2L']);
  });

  test('tarih biçimli zaman sütunu saniyeye çevrilir ve sıfırdan başlar', () => {
    // Excel seri numarası gün cinsindendir; çevrilmezse eksen 45000 civarı
    // anlamsız sayılar gösterirdi.
    const rows = [['AbsTime', 'S'], [45000, 1], [45000 + 1 / 86400, 2]];
    const layout = M.veImpDetectHeaderRow(rows, false);
    const columns = M.veImpBuildColumns(rows, layout, false);
    const ds = M.veImpBuildDataset({
      rows, layout, columns, xIndex: 0, yIndexes: [1], dateCols: { 0: true },
    });
    expect(ds.x.values[0]).toBe(0);
    expect(ds.x.values[1]).toBeCloseTo(1, 6);
    expect(ds.x.unit).toBe('s');
  });

  test('X sütunu seçilmezse anlaşılır hata', () => {
    expect(() => M.veImpBuildDataset({ rows: [], layout: {}, columns: [], xIndex: 5 }))
      .toThrow(/X ekseni/);
  });
});

describe('kayıt defteri', () => {
  function add() {
    const rows = canoeRows();
    const layout = M.veImpDetectHeaderRow(rows, false);
    const columns = M.veImpBuildColumns(rows, layout, false);
    return M.veImpAdd(M.veImpBuildDataset({
      rows, layout, columns, xIndex: 0, yIndexes: [1, 2], fileName: 'a.xlsx', name: 'a',
    }));
  }

  test('veImpIdOf her iki önekten de kimliği çıkarır', () => {
    expect(M.veImpIdOf('#imp3')).toBe('imp3');
    expect(M.veImpIdOf('import:imp3')).toBe('imp3');
    expect(M.veImpIdOf('~engine')).toBe('');
    expect(M.veImpIdOf(null)).toBe('');
  });

  test('veImpSeries sütun değerlerini verir', () => {
    const ds = add();
    expect(M.veImpSeries(ds.sensorId, ds.columns[0].key)).toEqual([800, 812.5, 825]);
    expect(M.veImpSeries(ds.sensorId, '__x')).toEqual([0, 0.01, 0.02]);
    expect(M.veImpSeries(ds.sensorId, 'yok')).toBe(null);
    expect(M.veImpSeries('#olmayan', 'c1')).toBe(null);
  });

  test('veImpXSeries veri kaynağı etiketinden zaman dizisini bulur', () => {
    const ds = add();
    expect(M.veImpXSeries(ds.dataSource)).toEqual([0, 0.01, 0.02]);
    expect(M.veImpXSeries('import:yok')).toBe(null);
  });

  test('veImpCollectGroups ağaç sözleşmesine uyar', () => {
    const ds = add();
    const groups = M.veImpCollectGroups();
    expect(groups).toHaveLength(1);
    const g = groups[0];
    expect(g).toMatchObject({ gid: 'imp:' + ds.id, dragId: ds.sensorId, _import: ds.id });
    // Satır üreten kod ortak (veSigRowHTML) — alanlar birebir tutmalı.
    g.items.forEach((it) => {
      expect(it).toHaveProperty('sensorId');
      expect(it).toHaveProperty('signalId');
      expect(it).toHaveProperty('name');
      expect(it).toHaveProperty('unit');
      expect(it).toHaveProperty('compType');
      expect(it).toHaveProperty('source');
    });
    expect(g.items.map((i) => i.name)).toEqual(['EngSpeed', 'VehSpeed']);
  });

  test('kaldırılan veri kümesi kayıttan ve panodan düşer', () => {
    const ds = add();
    const slots = [{
      sensors: [
        { id: ds.sensorId, signal: 'c1' },
        { id: '~engine', signal: 'rpm' },
      ],
      lanes: [{}],
      _dataSource: ds.dataSource,
      xAxis: { id: 'time', _dataSource: ds.dataSource },
    }];

    expect(M.veImpPruneSlots(slots)).toBe(0);   // veri kümesi duruyor → dokunma

    M.veImpRemove(ds.id);
    expect(M.veImpPruneSlots(slots)).toBe(1);
    expect(slots[0].sensors).toHaveLength(1);
    expect(slots[0].sensors[0].id).toBe('~engine');
    // Simülasyon sinyali kaldığı için veri kaynağı etiketi silinmemeli
    expect(slots[0]._dataSource).toBe(ds.dataSource);
  });

  test('son içe aktarma şeridi düşünce veri kaynağı etiketi de temizlenir', () => {
    const ds = add();
    const slots = [{
      sensors: [{ id: ds.sensorId, signal: 'c1' }],
      _dataSource: ds.dataSource,
      xAxis: { id: 'time', _dataSource: ds.dataSource },
    }];
    M.veImpRemove(ds.id);
    M.veImpPruneSlots(slots);
    expect(slots[0]._dataSource).toBeUndefined();
    expect(slots[0].xAxis._dataSource).toBeUndefined();
  });

  test('veImpAny oturum durumunu bildirir', () => {
    expect(M.veImpAny()).toBe(false);
    const ds = add();
    expect(M.veImpAny()).toBe(true);
    M.veImpRemove(ds.id);
    expect(M.veImpAny()).toBe(false);
  });
});

describe('veImpIsUnitToken', () => {
  // Bu ayrım gerçek bir hatadan doğdu: gevşek kalıp "Time"/"EngSpeed"i de
  // birim sayıyor, başlık satırı birim satırı sanılıp gerçek başlık bir üste
  // kayıyordu.
  test('gerçek birimler tanınır', () => {
    ['s', 'ms', 'km/h', '1/min', '°C', 'rpm', 'Nm', 'kW', '%', 'm/s²', '-']
      .forEach((u) => expect(M.veImpIsUnitToken(u)).toBe(true));
  });

  test('sinyal adları birim SAYILMAZ', () => {
    ['Time', 'EngSpeed', 'VehSpeed', 'Gear', 'Zaman', 'Mod', 'Sıcaklık']
      .forEach((n) => expect(M.veImpIsUnitToken(n)).toBe(false));
  });

  test('boş ve uzun metin birim değildir', () => {
    expect(M.veImpIsUnitToken('')).toBe(false);
    expect(M.veImpIsUnitToken('aracın ölçülen hızı')).toBe(false);
  });
});
