/**
 * Ölçüm Görüntüleyici — pano katmanı (viewer/js/board.js)
 *
 * Görüntüleyicideki YEDİ modül MFSim'den birebir kopya ve kendi testleriyle
 * korunuyor (measure-import, xlsx-read, signal-tree, trace-view, measure-core).
 * board.js tek yeni dosya; burada test edilen de yalnızca onun getirdiği kural:
 *
 *   BİR PANODA TEK BİR ÖLÇÜM DOSYASI VARDIR.
 *
 * Neden bu kural test edilmeye değer: iki ayrı dosyanın sütunları aynı panoya
 * girerse seriler İNDEKS HİZASIYLA çizilir (pencere zamanla eşleştirme
 * yapmaz). 300 örneklik bir ölçümün üzerine 120 örneklik başka bir ölçüm
 * binince grafik gayet makul görünür ve veri yanlıştır — kullanıcının bunu
 * gözle yakalama şansı yoktur. Sessiz yanlışlık: testin karşılığı tam burada.
 */

const stubs = stubGlobals();

// Kurulum sırası çalışma zamanındakiyle aynı: eksen kuralı → içe aktarma →
// pano. Hepsi aynı kapsamda eval edildiği için birbirini görür.
eval(loadSource('measure-core.js'));      // veXAxisAllowed / veSharedXAxis
eval(loadSource('measure-import.js'));    // veImpBuildDataset / veImpFind ...

// VE_BOARD'ın sahibi trace-view.js'tir (board.js başlığında da öyle yazılı).
// viewer/index.html'de trace-view.js, board.js'ten SONRA yüklenir; board.js onu
// yalnızca fonksiyon gövdelerinde okuduğu için bu sıra sorun değildir. board.js
// eskiden ikinci bir `var VE_BOARD = 0` daha taşıyordu — aynı değer olduğu için
// zararsız, ama tek global kapsamda gerçek bir çift bildirimdi ve bu test onun
// üzerinden çalışıyordu (bkz. tests/unit/source-hygiene.test.js). Bildirim
// kalktı; sabiti burada trace-view.js'in verdiği değerle koyuyoruz — o dosyayı
// eval etmek yalnızca bir sabit için gereksiz ağır.
global.VE_BOARD = 0;

eval(loadViewerSource('board.js'));       // pano

// ── Yardımcı: gerçek içe aktarma yolundan bir veri kümesi üret ────────────
// Elle nesne kurmak yerine üretim yolu kullanılıyor: başlık tespiti, sütun
// çözümü ve dizi kurulumu da böylece testin kapsamına giriyor.
function makeDataset(name, rowCount) {
  // Başlık + BİRİM satırı: CANoe çıktısının düzeni. Birim satırı olmadan eksen
  // adı "Time" kalır ve testin eksen etiketi beklentisi anlamsızlaşırdı.
  const rows = [['Time', 'EngSpeed', 'VehSpeed'], ['s', '1/min', 'km/h']];
  for (let i = 0; i < rowCount; i++) {
    rows.push([i * 0.02, 800 + i, i * 0.5]);
  }
  const layout = veImpDetectHeaderRow(rows, false);
  const columns = veImpBuildColumns(rows, layout, false);
  const ds = veImpBuildDataset({
    rows, layout, columns,
    commaDecimal: false, dateCols: {},
    xIndex: 0,
    yIndexes: [1, 2],
    holdSparse: true,
    fileName: name + '.xlsx',
    name: name,
  });
  return veImpAdd(ds);
}

function resetBoard() {
  veImpDatasets.length = 0;
  for (let i = 0; i < veResultSlots.length; i++) veResultSlots[i] = {};
}

beforeEach(() => {
  resetStubs(stubs);
  resetBoard();
  document.body.innerHTML = '';
});

// ── Şerit ekleme kapısı ──────────────────────────────────────────────────

describe('veAddSignalToSlot', () => {
  test('içe aktarılan sütunu şeride ekler ve ekseni ölçüme bağlar', () => {
    const ds = makeDataset('A', 300);
    veAddSignalToSlot(VE_BOARD, ds.sensorId, ds.columns[0].key);

    const slot = veResultSlots[VE_BOARD];
    expect(slot.sensors).toHaveLength(1);
    expect(slot._dataSource).toBe(ds.dataSource);
    // _dataSource eksende de durmak zorunda: X dizisi onunla çözülüyor
    // (trace-view.js veTrResolveX). Düşerse pencere sessizce boşalır.
    expect(slot.xAxis._dataSource).toBe(ds.dataSource);
    expect(slot.xAxis.name).toBe('Time [s]');
  });

  test('simülasyon kimliğini kabul etmez — görüntüleyicide o veri yok', () => {
    // '~engine' / '@0:sensor' MFSim kimlikleri. Kapı açık kalsaydı sinyal
    // panoya girer, veGetSensorData null döner ve kullanıcı sebebi görünmeyen
    // boş bir şeride bakardı.
    makeDataset('A', 100);
    veAddSignalToSlot(VE_BOARD, '~engine', 'rpm');
    veAddSignalToSlot(VE_BOARD, '@0:sensor-1', 'torque');
    expect(veResultSlots[VE_BOARD].sensors).toBeUndefined();
  });

  test('aynı sütun iki kez eklenmez', () => {
    const ds = makeDataset('A', 100);
    veAddSignalToSlot(VE_BOARD, ds.sensorId, ds.columns[0].key);
    veAddSignalToSlot(VE_BOARD, ds.sensorId, ds.columns[0].key);
    expect(veResultSlots[VE_BOARD].sensors).toHaveLength(1);
  });

  test('BAŞKA bir ölçüm dosyasının sütununu reddeder', () => {
    // Kuralın asıl sınandığı yer. A 300 satır, B 120 satır; B'nin sütunu
    // A'nın zaman eksenine indeks hizasıyla çizilirdi.
    const a = makeDataset('A', 300);
    const b = makeDataset('B', 120);

    veAddSignalToSlot(VE_BOARD, a.sensorId, a.columns[0].key);
    veAddSignalToSlot(VE_BOARD, b.sensorId, b.columns[0].key);

    const slot = veResultSlots[VE_BOARD];
    expect(slot.sensors).toHaveLength(1);
    expect(slot.sensors[0].id).toBe(a.sensorId);
    expect(slot._dataSource).toBe(a.dataSource);
    // Sessiz ret kabul edilemez: kullanıcı neden olmadığını görmeli.
    expect(document.querySelector('.ve-toast')).not.toBeNull();
  });

  test('pano boşaldıktan sonra başka dosya girebilir', () => {
    const a = makeDataset('A', 300);
    const b = makeDataset('B', 120);

    veAddSignalToSlot(VE_BOARD, a.sensorId, a.columns[0].key);
    veRemoveSensorFromSlot(VE_BOARD, 0);
    veAddSignalToSlot(VE_BOARD, b.sensorId, b.columns[0].key);

    const slot = veResultSlots[VE_BOARD];
    expect(slot.sensors).toHaveLength(1);
    expect(slot._dataSource).toBe(b.dataSource);
    expect(slot.xAxis._dataSource).toBe(b.dataSource);
  });
});

// ── X ekseni seçenekleri ─────────────────────────────────────────────────

describe('veGetAvailableXAxisOptions', () => {
  test('ölçüm yokken boş liste döner', () => {
    expect(veGetAvailableXAxisOptions(VE_BOARD)).toEqual([]);
  });

  test('ölçümün kendi X sütununu ve panodaki sinyalleri sunar', () => {
    const ds = makeDataset('A', 200);
    veAddSensorToSlot(VE_BOARD, ds.sensorId);      // tüm sütunlar

    const opts = veGetAvailableXAxisOptions(VE_BOARD);
    const names = opts.map((o) => o.name);
    expect(names).toContain('Time');               // dosyanın kendi ekseni
    expect(names).toContain('EngSpeed');
    expect(names).toContain('VehSpeed');
    // Her seçenek ölçüme bağlı kalmalı; _dataSource düşen bir seçenek
    // uygulandığında X dizisi hiçbir şeye çözülmezdi.
    opts.forEach((o) => expect(o._dataSource).toBe(ds.dataSource));
  });

  test('panodakinden BAŞKA bir dosyanın sütununu asla sunmaz', () => {
    // Seçici, bırakma anındaki kuralı ATLATABİLECEK tek yol: veSetSlotXAxis
    // yalnız ekseni değiştirir, şeritlerin verisine dokunmaz. Liste kirliyse
    // kullanıcı tek tıkla yanlış eksene geçer.
    const a = makeDataset('A', 300);
    makeDataset('B', 120);
    veAddSensorToSlot(VE_BOARD, a.sensorId);

    const opts = veGetAvailableXAxisOptions(VE_BOARD);
    expect(opts.length).toBeGreaterThan(0);
    expect(opts.every((o) => o._dataSource === a.dataSource)).toBe(true);
  });

  test('etkin seçenek işaretlenir', () => {
    const ds = makeDataset('A', 100);
    veAddSensorToSlot(VE_BOARD, ds.sensorId);
    const opts = veGetAvailableXAxisOptions(VE_BOARD);
    const active = opts.filter((o) => o.active);
    expect(active).toHaveLength(1);
    expect(active[0].id).toBe('time');
  });
});

// ── Veri kapısı ──────────────────────────────────────────────────────────

describe('veGetSensorData', () => {
  test('yalnızca içe aktarma kimliğini çözer', () => {
    const ds = makeDataset('A', 50);
    expect(veGetSensorData(ds.sensorId, ds.columns[0].key)).toHaveLength(50);
    // MFSim kimlikleri burada veri kaynağı DEĞİL. Sessizce boş dizi dönmek
    // "veri var ama hepsi sıfır" gibi okunurdu; null "kaynak yok" der.
    expect(veGetSensorData('~engine', 'rpm')).toBeNull();
    expect(veGetSensorData('@0:s1', 'rpm')).toBeNull();
    expect(veGetSensorData('#yok', 'x')).toBeNull();
  });
});
