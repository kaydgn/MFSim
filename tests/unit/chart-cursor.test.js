/**
 * Ölçüm imleci çekirdeği (js/chart-cursor.js)
 * ────────────────────────────────────────────
 * CANoe tarzı senkron imlecin okuma doğruluğu tamamen dört saf fonksiyona
 * dayanır: hangi örneğe kilitlenildiği (snapIndex), hangi panellerin aynı X
 * eksenini paylaştığı (xKey/syncTargets), o indekste hangi değerlerin okunduğu
 * (sample) ve iki imleç arası farkın nasıl hesaplandığı (delta).
 *
 * Bunlarda sessiz bir kayma "makul ama yanlış" bir sayı gösterir — kullanıcı
 * grafiğe bakıp 0→100 km/h süresini yanlış okur, gözle fark edilmez. Çizim/DOM
 * katmanı (crosshair konumu, tooltip HTML'i) kasıtlı olarak test edilmez;
 * kırılgan ve düşük değerli olur.
 */
const cursor = require('../../js/chart-cursor.js');
const {
  veCursorSnapIndex,
  veCursorXKey,
  veCursorSyncTargets,
  veCursorSample,
  veCursorDelta,
  veCursorFmtDelta,
  veSharedXAxis,
  veSharedXKey,
  veXAxisAllowed,
} = cursor;

// veRenderChart'ın ürettiği _chartMeta'nın imleç için gereken alt kümesi.
function meta(timeArr, datasets) {
  return { timeArr, datasets };
}

describe('veCursorSnapIndex — en yakın örneğe kilitlenme', () => {
  const t = [0, 1, 2, 3, 4];

  test('tam eşleşen değerde o indeksi verir', () => {
    expect(veCursorSnapIndex(t, 0)).toBe(0);
    expect(veCursorSnapIndex(t, 3)).toBe(3);
    expect(veCursorSnapIndex(t, 4)).toBe(4);
  });

  test('aradaki değer en yakın komşuya yuvarlanır', () => {
    expect(veCursorSnapIndex(t, 2.2)).toBe(2);
    expect(veCursorSnapIndex(t, 2.8)).toBe(3);
  });

  test('tam ortada sağdaki örnek seçilir (mevcut tooltip davranışı)', () => {
    expect(veCursorSnapIndex(t, 2.5)).toBe(3);
  });

  test('aralık dışı değerler uçlara sabitlenir', () => {
    expect(veCursorSnapIndex(t, -99)).toBe(0);
    expect(veCursorSnapIndex(t, 99)).toBe(4);
  });

  test('düzensiz aralıklı (değişken adımlı) diziyle çalışır', () => {
    // RK45 çıktısı sabit adımlı değildir — ikili arama buna dayanmalı
    const irregular = [0, 0.05, 0.4, 0.42, 5, 12];
    expect(veCursorSnapIndex(irregular, 0.41)).toBe(2);
    expect(veCursorSnapIndex(irregular, 0.5)).toBe(3);
    expect(veCursorSnapIndex(irregular, 11)).toBe(5);
  });

  test('boş / geçersiz girdide -1 döner (imleç çizilmez)', () => {
    expect(veCursorSnapIndex([], 1)).toBe(-1);
    expect(veCursorSnapIndex(null, 1)).toBe(-1);
    expect(veCursorSnapIndex([0, 1], NaN)).toBe(-1);
  });

  test('tek örnekli dizide her zaman 0', () => {
    expect(veCursorSnapIndex([7], 100)).toBe(0);
  });
});

describe('veCursorXKey — X ekseni kimliği', () => {
  test('X ekseni tanımsızsa zaman eksenidir', () => {
    expect(veCursorXKey({})).toBe('time');
    expect(veCursorXKey({ xAxis: { id: 'time' } })).toBe('time');
  });

  test('özel X ekseni kendi kimliğini taşır', () => {
    expect(veCursorXKey({ xAxis: { id: '~vehicle:v_speed' } })).toBe('~vehicle:v_speed');
  });

  test('veri kaynağı kimliğe girer — aynı ad farklı koşudan gelirse ayrı alan', () => {
    expect(veCursorXKey({ xAxis: { id: 'time' }, _dataSource: 'segmentDrive' }))
      .toBe('time@segmentDrive');
    // X ekseninin kendi dataSource'u slot'unkini ezer
    expect(veCursorXKey({
      xAxis: { id: 'time', _dataSource: 'segmentDrive' },
      _dataSource: 'obstacleDynamic',
    })).toBe('time@segmentDrive');
  });

  test('slot yoksa null', () => {
    expect(veCursorXKey(null)).toBeNull();
  });
});

describe('veCursorSyncTargets — hangi paneller birlikte okunur', () => {
  const m = meta([0, 1], [{ name: 'a', data: [1, 2] }]);

  test('aynı X eksenli, çizilmiş paneller senkronlanır; kaynak hariç tutulur', () => {
    const slots = [
      { type: 'line', xAxis: { id: 'time' }, _chartMeta: m },
      { type: 'line', xAxis: { id: 'time' }, _chartMeta: m },
      { type: 'line', xAxis: { id: 'time' }, _chartMeta: m },
    ];
    expect(veCursorSyncTargets(slots, 0)).toEqual([1, 2]);
    expect(veCursorSyncTargets(slots, 1)).toEqual([0, 2]);
  });

  test('farklı X eksenli panel senkronlanmaz (zaman ≠ hız)', () => {
    const slots = [
      { type: 'line', xAxis: { id: 'time' }, _chartMeta: m },
      { type: 'line', xAxis: { id: '~vehicle:v_speed' }, _chartMeta: m },
    ];
    expect(veCursorSyncTargets(slots, 0)).toEqual([]);
  });

  test('henüz çizilmemiş (meta yok) ya da boş panel atlanır', () => {
    const slots = [
      { type: 'line', xAxis: { id: 'time' }, _chartMeta: m },
      { type: 'line', xAxis: { id: 'time' } },
      {},
    ];
    expect(veCursorSyncTargets(slots, 0)).toEqual([]);
  });

  test('tablo ve 3D panel senkron hedefi değildir', () => {
    const slots = [
      { type: 'line', xAxis: { id: 'time' }, _chartMeta: m },
      { type: 'table', xAxis: { id: 'time' }, _chartMeta: m },
      { type: 'scatter3d', xAxis: { id: 'time' }, _chartMeta: m },
    ];
    expect(veCursorSyncTargets(slots, 0)).toEqual([]);
  });

  test('type belirtilmemişse çizgi grafik sayılır', () => {
    const slots = [
      { xAxis: { id: 'time' }, _chartMeta: m },
      { xAxis: { id: 'time' }, _chartMeta: m },
    ];
    expect(veCursorSyncTargets(slots, 0)).toEqual([1]);
  });

  test('slot dizisi yoksa boş liste', () => {
    expect(veCursorSyncTargets(null, 0)).toEqual([]);
  });
});

describe('ortak X ekseni — panonun tek ekseni', () => {
  // Pano tek bir X ekseni üzerinde çalışır: ilk dolu panel onu belirler,
  // sonraki bırakmalar ona uymak zorundadır. Kural gevşerse imleç artık "tüm
  // paneller için ortak" olmaz — kullanıcı farkında olmadan senkronsuz bir
  // panel edinir. Bu yüzden kuralın kendisi test edilir.
  const filled = (xAxis, extra) => Object.assign({ type: 'line', sensors: [{ id: 'a' }], xAxis }, extra);
  const empty = { type: 'line', sensors: [] };

  test('boş pano ekseni serbest bırakır — her şey eklenebilir', () => {
    expect(veSharedXAxis([empty, empty])).toBeNull();
    expect(veSharedXKey([empty, empty])).toBeNull();
    expect(veXAxisAllowed({ id: '~vehicle:v_speed' }, '', [empty, empty])).toBe(true);
  });

  test('ilk dolu panel panonun eksenini belirler', () => {
    const slots = [empty, filled({ id: 'time', name: 'Zaman [s]' }), filled({ id: '~vehicle:v_speed' })];
    expect(veSharedXAxis(slots).slotIdx).toBe(1);
    expect(veSharedXKey(slots)).toBe('time');
  });

  test('aynı eksene izin verir, farklı ekseni reddeder', () => {
    const slots = [filled({ id: 'time' })];
    expect(veXAxisAllowed({ id: 'time' }, '', slots)).toBe(true);
    expect(veXAxisAllowed({ id: '~vehicle:v_speed' }, '', slots)).toBe(false);
  });

  test('X ekseni tanımsız gelen öğe zaman ekseni sayılır', () => {
    // Sinyallerin kendi X ekseni yoktur; panoya zaman ekseninde girerler
    expect(veXAxisAllowed(null, '', [filled({ id: 'time' })])).toBe(true);
    expect(veXAxisAllowed(null, '', [filled({ id: '~vehicle:v_speed' })])).toBe(false);
  });

  test('farklı koşudan gelen aynı isimli eksen ayrı alan sayılır', () => {
    const slots = [filled({ id: 'time' })];
    expect(veXAxisAllowed({ id: 'time' }, 'segmentDrive', slots)).toBe(false);
    const segSlots = [filled({ id: 'time' }, { _dataSource: 'segmentDrive' })];
    expect(veSharedXKey(segSlots)).toBe('time@segmentDrive');
    expect(veXAxisAllowed({ id: 'time' }, 'segmentDrive', segSlots)).toBe(true);
  });

  test('3D panel ekseni belirlemez — kendi X/Y/Z ekseni vardır', () => {
    const slots = [
      { type: 'scatter3d', sensors: [{ id: 'a' }], xAxis: { id: '~engine:rpm' } },
      filled({ id: 'time' }),
    ];
    expect(veSharedXKey(slots)).toBe('time');
    expect(veSharedXAxis(slots).slotIdx).toBe(1);
  });

  test('yalnızca 3D panel varsa pano ekseni hâlâ serbesttir', () => {
    const slots = [{ type: 'scatter3d', sensors: [{ id: 'a' }], xAxis: { id: '~engine:rpm' } }];
    expect(veSharedXKey(slots)).toBeNull();
    expect(veXAxisAllowed({ id: 'time' }, '', slots)).toBe(true);
  });

  test('kural uygulandığında her panel senkron hedefi olur', () => {
    // Ortak eksenin asıl amacı: "senkronlanmayan panel" durumu kalmasın
    const m = meta([0, 1], [{ name: 'a', data: [1, 2] }]);
    const slots = [0, 1, 2, 3].map(() => ({
      type: 'line', sensors: [{ id: 'a' }], xAxis: { id: 'time' }, _chartMeta: m,
    }));
    expect(veCursorSyncTargets(slots, 0)).toEqual([1, 2, 3]);
    expect(veCursorSyncTargets(slots, 2)).toEqual([0, 1, 3]);
  });

  test('slot dizisi yoksa null / serbest', () => {
    expect(veSharedXAxis(null)).toBeNull();
    expect(veXAxisAllowed({ id: 'time' }, '', null)).toBe(true);
  });
});

describe('veCursorSample — imleç konumundaki değerler', () => {
  const m = meta(
    [0, 1, 2],
    [
      { name: 'Motor Devri', unit: 'rpm', color: '#f00', data: [800, 1600, 2400], _axisIdx: 0 },
      { name: 'Araç Hızı', unit: 'km/h', color: '#0f0', data: [0, 30, 60], _axisIdx: 1 },
    ]
  );

  test('her sinyalin o indeksteki değerini X ile birlikte verir', () => {
    const s = veCursorSample(m, 1);
    expect(s.x).toBe(1);
    expect(s.index).toBe(1);
    expect(s.rows.map((r) => r.value)).toEqual([1600, 30]);
    expect(s.rows.map((r) => r.unit)).toEqual(['rpm', 'km/h']);
    expect(s.rows[1].axisIdx).toBe(1);
  });

  test('verisi olmayan sinyal null değerle işaretlenir (0 gösterilmez)', () => {
    // Regresyon: eksik sinyalin 0 okunması "makul ama yanlış" bir sayı üretir
    const m2 = meta([0, 1], [{ name: 'yok', unit: '', _noData: true }]);
    const s = veCursorSample(m2, 1);
    expect(s.rows[0].noData).toBe(true);
    expect(s.rows[0].value).toBeNull();
  });

  test('sonlu olmayan örnek (NaN/Infinity) null olur', () => {
    const m2 = meta([0, 1], [{ name: 'a', data: [1, NaN] }]);
    expect(veCursorSample(m2, 1).rows[0].value).toBeNull();
  });

  test('dizisi kısa kalan sinyal null döner, diğerleri okunur', () => {
    const m2 = meta([0, 1, 2], [
      { name: 'kisa', data: [1, 2] },
      { name: 'tam', data: [1, 2, 3] },
    ]);
    const s = veCursorSample(m2, 2);
    expect(s.rows[0].value).toBeNull();
    expect(s.rows[1].value).toBe(3);
  });

  test('aralık dışı indeks ya da meta yoksa null', () => {
    expect(veCursorSample(m, -1)).toBeNull();
    expect(veCursorSample(m, 3)).toBeNull();
    expect(veCursorSample(null, 0)).toBeNull();
  });
});

describe('veCursorDelta — iki imleç arası fark', () => {
  const m = meta(
    [0, 5, 12],
    [
      { name: 'Hız', unit: 'km/h', data: [0, 40, 100] },
      { name: 'Devir', unit: 'rpm', data: [800, 1500, 2100] },
    ]
  );

  test('ΔX ve her sinyal için Δdeğer (referans → güncel yönünde)', () => {
    const d = veCursorDelta(veCursorSample(m, 0), veCursorSample(m, 2));
    expect(d.dx).toBe(12);
    expect(d.rows.map((r) => r.dv)).toEqual([100, 1300]);
  });

  test('geriye doğru ölçüm negatif fark verir', () => {
    const d = veCursorDelta(veCursorSample(m, 2), veCursorSample(m, 1));
    expect(d.dx).toBe(-7);
    expect(d.rows.map((r) => r.dv)).toEqual([-60, -600]);
  });

  test('uçlardan biri eksik veriyse o satırın farkı null (0 değil)', () => {
    const m2 = meta([0, 1], [{ name: 'a', data: [1, NaN] }]);
    const d = veCursorDelta(veCursorSample(m2, 0), veCursorSample(m2, 1));
    expect(d.rows[0].dv).toBeNull();
  });

  test('sinyal sayısı farklıysa ortak kısım karşılaştırılır', () => {
    const a = veCursorSample(meta([0], [{ name: 'a', data: [1] }, { name: 'b', data: [2] }]), 0);
    const b = veCursorSample(meta([1], [{ name: 'a', data: [5] }]), 0);
    const d = veCursorDelta(a, b);
    expect(d.rows).toHaveLength(1);
    expect(d.rows[0].dv).toBe(4);
  });

  test('örneklerden biri yoksa null', () => {
    expect(veCursorDelta(null, veCursorSample(m, 0))).toBeNull();
    expect(veCursorDelta(veCursorSample(m, 0), null)).toBeNull();
  });
});

describe('veCursorFmtDelta — işaretli fark biçimi', () => {
  // Sayı biçimi js/graphics.js'teki veFormatTooltipVal'a devredilir; burada
  // sınanan sözleşme "işaret kaybolmasın" — Δ okumasının yönü, geriye doğru
  // ölçümde eksi olarak görünmeli.
  beforeAll(() => {
    global.veFormatTooltipVal = (v) => {
      const a = Math.abs(v);
      if (a >= 10000) return v.toFixed(0);
      if (a >= 100) return v.toFixed(1);
      if (a >= 1) return v.toFixed(2);
      if (a >= 0.01) return v.toFixed(3);
      return v.toExponential(2);
    };
  });
  afterAll(() => { delete global.veFormatTooltipVal; });

  test('yön bilgisi korunur (+ / − / 0)', () => {
    expect(veCursorFmtDelta(12.5)).toBe('+12.50');
    expect(veCursorFmtDelta(-12.5)).toBe('−12.50');
    // Sıfır düz yazılır: veFormatTooltipVal küçük sayıları üstel biçime
    // düşürür, "Δ = 0.00e+0" okunaksız bir çıktı olurdu.
    expect(veCursorFmtDelta(0)).toBe('0');
  });

  test('büyük ve küçük farklarda da işaret öne geçer', () => {
    expect(veCursorFmtDelta(-25000)).toBe('−25000');
    expect(veCursorFmtDelta(0.005)).toMatch(/^\+/);
  });

  test('ölçülemeyen fark tire ile gösterilir', () => {
    expect(veCursorFmtDelta(null)).toBe('—');
    expect(veCursorFmtDelta(NaN)).toBe('—');
  });
});
