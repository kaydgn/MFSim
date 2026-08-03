/**
 * Ölçüm çekirdeği (js/measure-core.js)
 * ────────────────────────────────────
 * Ölçüm penceresinin okuma doğruluğu iki saf kurala dayanır: imlecin hangi
 * örneğe kilitlendiği (snapIndex) ve pencerenin hangi X ekseninde çalıştığı
 * (xKey / sharedXAxis / xAxisAllowed).
 *
 * Bunlarda sessiz bir kayma "makul ama yanlış" bir sayı gösterir — kullanıcı
 * grafiğe bakıp 0→100 km/h süresini yanlış okur, gözle fark edilmez. Çizim/DOM
 * katmanı (imleç konumu, değer rozeti) kasıtlı olarak test edilmez; kırılgan
 * ve düşük değerli olur.
 *
 * NOT — panel senkronizasyonu artık YOK. Bu modül dört panelin imlecini
 * birbirine bağlayan katmandı; Sonuçlar sayfası tek ölçüm penceresine geçince
 * (js/trace-view.js) senkronlanacak ikinci bir yüzey kalmadı ve
 * veCursorSyncTargets/veCursorSample/veCursorDelta ile birlikte o testler de
 * düştü. X EKSENİ KURALI DÜŞMEDİ: pencere tek eksende çalışır, bir sinyalin
 * ya da sihirbaz diyagramının o eksene girip giremeyeceği hâlâ buradan sorulur.
 */
const cursor = require('../../js/measure-core.js');
const {
  veCursorSnapIndex,
  veCursorXKey,
  veCursorFmtDelta,
  veSharedXAxis,
  veSharedXKey,
  veXAxisAllowed,
} = cursor;

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

describe('ortak X ekseni — panonun tek ekseni', () => {
  // Pano tek bir X ekseni üzerinde çalışır: ilk dolu panel onu belirler,
  // sonraki bırakmalar ona uymak zorundadır. Kural gevşerse imleç artık "tüm
  // paneller için ortak" olmaz — kullanıcı farkında olmadan senkronsuz bir
  // panel edinir. Bu yüzden kuralın kendisi test edilir.
  const filled = (xAxis, extra) => Object.assign({ type: 'line', sensors: [{ id: 'a' }], xAxis }, extra);
  const empty = { type: 'line', sensors: [] };

  test('boş pencere eksenini serbest bırakır — her şey eklenebilir', () => {
    expect(veSharedXAxis([empty, empty])).toBeNull();
    expect(veSharedXKey([empty, empty])).toBeNull();
    expect(veXAxisAllowed({ id: '~vehicle:v_speed' }, '', [empty, empty])).toBe(true);
  });

  test('ilk dolu pano girdisi pencerenin eksenini belirler', () => {
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

  test('3B görünüm ekseni belirlemez — kendi X/Y/Z ekseni vardır', () => {
    const slots = [
      { type: 'scatter3d', sensors: [{ id: 'a' }], xAxis: { id: '~engine:rpm' } },
      filled({ id: 'time' }),
    ];
    expect(veSharedXKey(slots)).toBe('time');
    expect(veSharedXAxis(slots).slotIdx).toBe(1);
  });

  test('yalnızca 3B görünüm varsa pencere ekseni hâlâ serbesttir', () => {
    const slots = [{ type: 'scatter3d', sensors: [{ id: 'a' }], xAxis: { id: '~engine:rpm' } }];
    expect(veSharedXKey(slots)).toBeNull();
    expect(veXAxisAllowed({ id: 'time' }, '', slots)).toBe(true);
  });

  test('slot dizisi yoksa null / serbest', () => {
    expect(veSharedXAxis(null)).toBeNull();
    expect(veXAxisAllowed({ id: 'time' }, '', null)).toBe(true);
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
