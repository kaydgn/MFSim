/**
 * Ölçüm penceresi çekirdeği (js/trace-view.js)
 * ────────────────────────────────────────────
 * Sonuçlar sayfası panel ızgarasından tek ölçüm penceresine geçti: seçilen
 * her sinyal alt alta kendi ŞERİDİNDE, kendi Y ekseniyle çiziliyor.
 *
 * Burada test edilenler çizim değil, çizimin dayandığı KARARLAR:
 *   • şerit listesinin sinyal listesiyle uzlaştırılması (kaybolan/yeni sinyal)
 *   • bir kanalın basamaklı mı sürekli mi çizileceği
 *   • metin değerli kanalın seviyelere eşlenmesi
 *   • Y aralığı ve şerit yükseklikleri
 *   • kaydedilecek alanların beyaz listesi
 *
 * Bunlarda sessiz bir kayma "makul ama yanlış" bir grafik üretir: vites 3'ten
 * 4'e düz çizgiyle bağlanır (olmayan bir geçiş), bir sinyal listeden silinince
 * şeridi hayalet kalır, ya da diske canvas geometrisi yazılır. Hiçbiri gözle
 * yakalanmaz — testin karşılığı burada.
 *
 * Canvas/DOM katmanı (veTrRender, veTrDrawLane, olay bağlama) kasıtlı olarak
 * test edilmez; kırılgan ve düşük değerli olur.
 */
const T = require('../../js/trace-view.js');
const {
  veTrKey,
  veTrReconcileLanes,
  veTrIsDiscrete,
  veTrEncodeText,
  veTrStateLabel,
  veTrExtent,
  veTrLaneRange,
  veTrLaneRects,
  veTrLaneTitle,
  veTrFitTitle,
  veTrCloneSlot,
  veTrCloneBoard,
  veTrInRect,
  veTrLaneCloseRect,
  veTrLaneGrabRect,
  veTrHitLane,
  veTrHitResize,
  veTrSnapIndex,
  VE_TR,
} = T;

const sig = (id, signal, extra) => Object.assign({ id, signal, name: id, unit: '' }, extra);

describe('veTrKey — sinyal kimliği', () => {
  test('sensör ve sinyal ayrı alanlar olarak kalır', () => {
    expect(veTrKey('s1', 'rpm')).not.toBe(veTrKey('s1r', 'pm'));
  });

  test("sensorId ':' içerdiğinde bile çakışma olmaz", () => {
    // Cross-tab ('@0:s1') ve sanal ('~engine') kimlikler ':' taşıyor; ayraç
    // olarak ':' seçilseydi '@0:s1'+'rpm' ile '@0'+'s1:rpm' aynı anahtar olurdu.
    expect(veTrKey('@0:s1', 'rpm')).not.toBe(veTrKey('@0', 's1:rpm'));
  });

  test('null/undefined kimlikler patlamaz', () => {
    expect(typeof veTrKey(null, undefined)).toBe('string');
  });
});

describe('veTrReconcileLanes — şerit listesi sinyal listesine uyar', () => {
  test('şeridi olmayan sinyale yeni şerit açılır (sensors sırasında)', () => {
    const lanes = veTrReconcileLanes([sig('a', 'x'), sig('b', 'y')], []);
    expect(lanes).toHaveLength(2);
    expect(lanes[0].ids).toEqual([veTrKey('a', 'x')]);
    expect(lanes[1].ids).toEqual([veTrKey('b', 'y')]);
  });

  test('listeden çıkan sinyal şeritten de düşer', () => {
    const before = veTrReconcileLanes([sig('a', 'x'), sig('b', 'y')], []);
    const after = veTrReconcileLanes([sig('a', 'x')], before);
    expect(after).toHaveLength(1);
    expect(after[0].ids).toEqual([veTrKey('a', 'x')]);
  });

  test('boşalan şerit tamamen düşer, hayalet kalmaz', () => {
    const lanes = [{ ids: [veTrKey('yok', 'z')], h: 90 }];
    expect(veTrReconcileLanes([sig('a', 'x')], lanes)).toHaveLength(1);
  });

  test('aynı sinyal iki şeritte olamaz — ilk şerit kazanır', () => {
    const lanes = [
      { ids: [veTrKey('a', 'x')], h: 90 },
      { ids: [veTrKey('a', 'x')], h: 90 },
    ];
    const out = veTrReconcileLanes([sig('a', 'x')], lanes);
    expect(out).toHaveLength(1);
    expect(out[0].ids).toEqual([veTrKey('a', 'x')]);
  });

  test('birleştirilmiş şerit (iki sinyal tek eksende) korunur', () => {
    const lanes = [{ ids: [veTrKey('a', 'x'), veTrKey('b', 'y')], h: 120 }];
    const out = veTrReconcileLanes([sig('a', 'x'), sig('b', 'y')], lanes);
    expect(out).toHaveLength(1);
    expect(out[0].ids).toHaveLength(2);
    expect(out[0].h).toBe(120);
  });

  test('kullanıcı yüksekliği ve Y kilidi korunur — türetilmiş veri değil', () => {
    const lanes = [{ ids: [veTrKey('a', 'x')], h: 210, min: -5, max: 15 }];
    const out = veTrReconcileLanes([sig('a', 'x')], lanes);
    expect(out[0].h).toBe(210);
    expect(out[0].min).toBe(-5);
    expect(out[0].max).toBe(15);
  });

  test('bozuk yükseklik varsayılana düşer', () => {
    const out = veTrReconcileLanes([sig('a', 'x')], [{ ids: [veTrKey('a', 'x')], h: 0 }]);
    expect(out[0].h).toBe(VE_TR.LANE_DEF_H);
    const out2 = veTrReconcileLanes([sig('a', 'x')], [{ ids: [veTrKey('a', 'x')], h: NaN }]);
    expect(out2[0].h).toBe(VE_TR.LANE_DEF_H);
  });

  test('şerit sırası korunur — yeniden sıralama kalıcıdır', () => {
    const lanes = [
      { ids: [veTrKey('b', 'y')], h: 90 },
      { ids: [veTrKey('a', 'x')], h: 90 },
    ];
    const out = veTrReconcileLanes([sig('a', 'x'), sig('b', 'y')], lanes);
    expect(out[0].ids).toEqual([veTrKey('b', 'y')]);
    expect(out[1].ids).toEqual([veTrKey('a', 'x')]);
  });

  test('boş/eksik girdilerde patlamaz', () => {
    expect(veTrReconcileLanes(null, null)).toEqual([]);
    expect(veTrReconcileLanes([], undefined)).toEqual([]);
  });
});

describe('veTrIsDiscrete — basamaklı mı çizilmeli', () => {
  // Vites 3'ten 4'e geçerken 3.5'ten GEÇMEZ. Düz çizgiyle bağlamak var
  // olmayan bir geçişi çizer; bu yüzden ayrık kanallar basamaklı çizilir.
  test('bilinen durum sinyalleri ada göre tanınır', () => {
    ['gear', 'current_gear', 'gear_mode', 'lockup_state'].forEach((id) => {
      expect(veTrIsDiscrete(id, '−', null)).toBe(true);
    });
  });

  test("'0/1' ve '#' birimleri veriye bakmadan ayrık sayılır", () => {
    // Tek segmentli koşuda seviye sayısı 1'de kalır; veri kuralı kaçırırdı.
    expect(veTrIsDiscrete('r_current_segment', '#', [1, 1, 1])).toBe(true);
    expect(veTrIsDiscrete('bilinmeyen', '0/1', [0, 0, 0])).toBe(true);
  });

  test('tam sayı + az seviye → veriden ayrık çıkarılır', () => {
    expect(veTrIsDiscrete('bilinmeyen', '−', [1, 1, 2, 2, 3, 3])).toBe(true);
  });

  test('kesirli değer görülür görülmez sürekli sayılır', () => {
    expect(veTrIsDiscrete('bilinmeyen', '−', [1, 1, 2.5, 3])).toBe(false);
  });

  test('çok seviyeli tam sayı serisi sürekli sayılır (basamak merdivene döner)', () => {
    const many = Array.from({ length: 60 }, (_, i) => i);
    expect(veTrIsDiscrete('bilinmeyen', 'rpm', many)).toBe(false);
  });

  test('tek seviyeli seri ayrık değildir', () => {
    expect(veTrIsDiscrete('bilinmeyen', '−', [4, 4, 4, 4])).toBe(false);
  });

  test('kısa/boş seride veri kuralı çalışmaz', () => {
    expect(veTrIsDiscrete('bilinmeyen', '−', [1, 2])).toBe(false);
    expect(veTrIsDiscrete('bilinmeyen', '−', null)).toBe(false);
  });

  test("'−' birimi tek başına ayrık demek DEĞİL", () => {
    // speed_ratio / torque_ratio da '−' birimini kullanıyor ama süreklidir.
    expect(veTrIsDiscrete('speed_ratio', '−', [0.1, 0.35, 0.7, 0.92])).toBe(false);
  });
});

describe('veTrEncodeText — metin kanalı durum şeridine döner', () => {
  test('ayrı metinler seviyelere eşlenir', () => {
    const e = veTrEncodeText(['1C', '1C', '2L', '2C']);
    expect(e).not.toBeNull();
    expect(e.labels).toEqual(['1C', '2C', '2L']);
    expect(e.data).toEqual([0, 0, 2, 1]);
  });

  test('eşleme ALFABETİK — pencere kaydırılınca seviyeler yer değiştirmez', () => {
    const a = veTrEncodeText(['2L', '1C']);
    const b = veTrEncodeText(['1C', '2L']);
    expect(a.labels).toEqual(b.labels);
    // '1C' her iki sırada da aynı seviyede
    expect(a.data[1]).toBe(b.data[0]);
  });

  test('tümü sayısal olan seri metin şeridi değildir', () => {
    expect(veTrEncodeText([1, 2, 3])).toBeNull();
    expect(veTrEncodeText(['1', '2'])).toBeNull();
  });

  test('serbest metin (çok fazla ayrı değer) seviye sayılmaz', () => {
    const free = Array.from({ length: 30 }, (_, i) => 'metin' + i);
    expect(veTrEncodeText(free)).toBeNull();
  });

  test('eksik değer NaN olur — çizimde kalem kalkar, sıfıra düşmez', () => {
    const e = veTrEncodeText(['A', null, 'B']);
    expect(e.data[0]).toBe(0);
    expect(Number.isNaN(e.data[1])).toBe(true);
    expect(e.data[2]).toBe(1);
  });

  test('boş seri null döner', () => {
    expect(veTrEncodeText([])).toBeNull();
    expect(veTrEncodeText(null)).toBeNull();
  });
});

describe('veTrStateLabel — seviyenin okunur adı', () => {
  test('lockup durumu tablodan gelir', () => {
    expect(veTrStateLabel('lockup_state', 1)).toBe('Lockup kilitli');
    expect(veTrStateLabel('lockup_state', 0)).toBe('Lockup açık');
  });

  test('vites: boş, geri ve ileri kademeler', () => {
    expect(veTrStateLabel('gear', 0)).toBe('Boş');
    expect(veTrStateLabel('gear', -1)).toBe('Geri');
    expect(veTrStateLabel('current_gear', 3)).toBe('3. vites');
  });

  test('bilinmeyen sinyalde etiket uydurulmaz', () => {
    expect(veTrStateLabel('bilinmeyen', 1)).toBeNull();
  });
});

describe('veTrExtent — seri sınırları', () => {
  test('NaN ve Infinity atlanır', () => {
    expect(veTrExtent([1, NaN, 5, Infinity, -2])).toEqual({ min: -2, max: 5 });
  });

  test('tamamı geçersizse null — sahte 0..1 aralığı uydurulmaz', () => {
    expect(veTrExtent([NaN, Infinity])).toBeNull();
    expect(veTrExtent([])).toBeNull();
    expect(veTrExtent(null)).toBeNull();
  });
});

describe('veTrLaneRange — şeridin Y aralığı', () => {
  test('sürekli sinyalde iki uçta nefes payı bırakılır', () => {
    const r = veTrLaneRange(0, 100, false);
    expect(r.min).toBeLessThan(0);
    expect(r.max).toBeGreaterThan(100);
  });

  test('ayrık sinyalde yarım basamak — uç seviyeler kenara yapışmaz', () => {
    expect(veTrLaneRange(1, 5, true)).toEqual({ min: 0.5, max: 5.5 });
  });

  test('sabit seride sıfıra bölme yok, simetrik bant açılır', () => {
    const r = veTrLaneRange(7, 7, false);
    expect(r.max).toBeGreaterThan(r.min);
    expect((r.min + r.max) / 2).toBeCloseTo(7, 9);
  });

  test('sabit SIFIR serisi de çökmez', () => {
    const r = veTrLaneRange(0, 0, false);
    expect(r.max).toBeGreaterThan(r.min);
  });

  test('geçersiz sınırlarda güvenli varsayılan', () => {
    expect(veTrLaneRange(NaN, 5, false)).toEqual({ min: 0, max: 1 });
  });
});

describe('veTrLaneRects — şerit yerleşimi', () => {
  const GAP = VE_TR.LANE_GAP;
  const MIN = VE_TR.LANE_MIN_H;

  test('şeritler üst üste binmez, aralarında boşluk kalır', () => {
    const r = veTrLaneRects([100, 100, 100], 8, 400, GAP, MIN);
    expect(r).toHaveLength(3);
    for (let i = 1; i < r.length; i++) {
      expect(r[i].y).toBeGreaterThanOrEqual(r[i - 1].y + r[i - 1].h);
    }
  });

  test('yer varsa şeritler orantılı büyür — ekranın yarısı boş kalmaz', () => {
    const r = veTrLaneRects([100, 100], 0, 600, GAP, MIN);
    const total = r[0].h + r[1].h + GAP;
    expect(total).toBeGreaterThan(560);
    // Eşit ağırlıklar eşit kalır
    expect(Math.abs(r[0].h - r[1].h)).toBeLessThanOrEqual(1);
  });

  test('orantı korunur: iki katı yükseklik iki katı kalır', () => {
    const r = veTrLaneRects([200, 100], 0, 900, GAP, MIN);
    expect(r[0].h / r[1].h).toBeCloseTo(2, 1);
  });

  test('hiçbir şerit taban yüksekliğin altına inmez', () => {
    // Girdi yükseklikleri TABANIN ALTINDA ve alan da dar: taban kuralı
    // gerçekten devreye girsin. Girdiler zaten tabanın üstündeyse bu test
    // kuralı değil, girdiyi doğrular.
    const dar = veTrLaneRects([20, 20], 0, 60, GAP, MIN);
    dar.forEach((x) => expect(x.h).toBeGreaterThanOrEqual(MIN));

    const cok = veTrLaneRects([12, 12, 12, 12, 12, 12], 0, 100, GAP, MIN);
    cok.forEach((x) => expect(x.h).toBeGreaterThanOrEqual(MIN));
  });

  test('sığmayan şeritlerde yüzey uzar (kapsayıcı kaydırılır)', () => {
    const r = veTrLaneRects([100, 100, 100, 100, 100, 100], 0, 120, GAP, MIN);
    const last = r[r.length - 1];
    expect(last.y + last.h).toBeGreaterThan(120);
  });

  test('boş listede boş sonuç', () => {
    expect(veTrLaneRects([], 0, 400, GAP, MIN)).toEqual([]);
  });
});

describe('veTrLaneTitle — CANoe tarzı şerit başlığı', () => {
  test("'Bileşen — Sinyal' ayracı '::' olur", () => {
    expect(veTrLaneTitle({ name: 'Motor — Motor Devri', unit: 'rpm' }))
      .toBe('Motor::Motor Devri [rpm]');
  });

  test('birim yoksa köşeli parantez de yok', () => {
    expect(veTrLaneTitle({ name: 'Motor — Devir', unit: '' })).toBe('Motor::Devir');
  });

  test('sekme önekli ad bozulmaz — yalnız İLK ayraç dönüşür', () => {
    expect(veTrLaneTitle({ name: '[Sekme 2] Motor — Devir', unit: 'rpm' }))
      .toBe('[Sekme 2] Motor::Devir [rpm]');
  });

  test('boş girdi patlamaz', () => {
    expect(veTrLaneTitle(null)).toBe('');
  });
});

describe('veTrFitTitle — dar şeritte önce bileşen öneki düşer', () => {
  // Genişlik ölçümü canvas'a bağlı; testte 1 karakter = 1 birim sayan sahte
  // bir ctx yeterli — kural karakter değil ÖNCELİK sırasıdır.
  const ctx = { measureText: (t) => ({ width: t.length }) };

  test('sığıyorsa tam başlık', () => {
    expect(veTrFitTitle(ctx, 'Motor::Devir [rpm]', 100)).toBe('Motor::Devir [rpm]');
  });

  test('sığmıyorsa bileşen öneki düşer, SİNYAL ADI tam kalır', () => {
    // Harf harf kesme "Şanzıman Kont…" üretiyordu: en ayırt edici parça gider.
    expect(veTrFitTitle(ctx, '[SW] Şanzıman Kontrol::Lockup Durumu [0/1]', 25))
      .toBe('Lockup Durumu [0/1]');
  });

  test('sinyal adı da sığmıyorsa kısaltılır', () => {
    const out = veTrFitTitle(ctx, 'Motor::Çok Uzun Bir Sinyal Adı [rpm]', 10);
    expect(out.endsWith('…')).toBe(true);
    expect(out.length).toBeLessThanOrEqual(11);
    expect(out.startsWith('Çok')).toBe(true);
  });

  test('boş başlık patlamaz', () => {
    expect(veTrFitTitle(ctx, null, 50)).toBe('');
  });
});

describe('veTrCloneSlot / veTrCloneBoard — kaydedilecek alanların beyaz listesi', () => {
  test('çizimden doğan alanlar kopyaya girmez', () => {
    const c = veTrCloneSlot({
      sensors: [sig('a', 'x')],
      lanes: [{ ids: ['k'], h: 90 }],
      xAxis: { id: 'time' },
      type: 'line',
      _chartMeta: { pw: 500 },
      _geo: { surface: 900 },
    });
    expect(c.sensors).toHaveLength(1);
    expect(c.lanes).toHaveLength(1);
    expect(c._chartMeta).toBeUndefined();
    expect(c._geo).toBeUndefined();
  });

  test('DERİN kopya — iki çözüm sekmesi aynı diziyi paylaşmaz', () => {
    const slot = { sensors: [sig('a', 'x')], lanes: [{ ids: ['k'], h: 90 }] };
    const c = veTrCloneSlot(slot);
    c.sensors.push(sig('b', 'y'));
    c.lanes[0].h = 200;
    expect(slot.sensors).toHaveLength(1);
    expect(slot.lanes[0].h).toBe(90);
  });

  test('pano kopyası dizi uzunluğunu korur (kayıt biçimi 4 slot)', () => {
    const board = veTrCloneBoard([{ sensors: [sig('a', 'x')] }, {}, {}, {}]);
    expect(board).toHaveLength(4);
    expect(board[0].sensors).toHaveLength(1);
  });

  test('boş/eksik girdilerde patlamaz', () => {
    expect(veTrCloneSlot(null)).toEqual({});
    expect(veTrCloneBoard(null)).toEqual([]);
  });
});

describe('tutamak isabeti — çizim ile hit-test aynı kaynaktan', () => {
  // Düğme göründüğü yerde çalışmalı: dikdörtgeni iki ayrı yerde hesaplamak
  // "tıklıyorum ama olmuyor" sınıfı bir hataydı.
  const geo = { plotX: 70, plotW: 500 };
  const rect = { y: 100, h: 90 };

  test('kaldırma düğmesinin merkezi kendi dikdörtgeninin içinde', () => {
    const c = veTrLaneCloseRect(geo, rect);
    expect(veTrInRect(c, c.x + c.w / 2, c.y + c.h / 2)).toBe(true);
  });

  test('kaldırma düğmesi şeridin içinde ve sağ üstte durur', () => {
    const c = veTrLaneCloseRect(geo, rect);
    expect(c.x + c.w).toBeLessThanOrEqual(geo.plotX + geo.plotW);
    expect(c.y).toBeGreaterThanOrEqual(rect.y);
    expect(c.y + c.h).toBeLessThanOrEqual(rect.y + rect.h);
  });

  test('tutma alanı oluğun solunda, plot alanına taşmaz', () => {
    const g = veTrLaneGrabRect(geo, rect);
    expect(g.x + g.w).toBeLessThanOrEqual(geo.plotX);
    expect(g.h).toBe(rect.h);
  });

  test('şerit isabeti: içerideki nokta bulur, dışarıdaki -1', () => {
    const g = { rects: [{ y: 0, h: 50 }, { y: 60, h: 50 }] };
    expect(veTrHitLane(g, 25)).toBe(0);
    expect(veTrHitLane(g, 80)).toBe(1);
    expect(veTrHitLane(g, 55)).toBe(-1);   // şeritler arası boşluk
    expect(veTrHitLane(g, 500)).toBe(-1);
  });

  test('yükseklik ayırıcısı şeridin ALT kenarında yakalanır', () => {
    const g = { rects: [{ y: 0, h: 50 }, { y: 60, h: 50 }] };
    expect(veTrHitResize(g, 50)).toBe(0);
    expect(veTrHitResize(g, 52)).toBe(0);   // 4px tolerans
    expect(veTrHitResize(g, 25)).toBe(-1);  // şeridin ortası ayırıcı değil
  });
});

describe('veTrSnapIndex — ölçüm çekirdeğine devredilir', () => {
  // İmlecin en yakın örneğe kilitlenmesi js/measure-core.js'in işi; burada
  // ikinci bir kopya OLMAMALI, yoksa iki yerde iki farklı davranış doğar.
  afterEach(() => { delete global.veCursorSnapIndex; });

  test('çekirdek yüklüyse ona sorar', () => {
    global.veCursorSnapIndex = jest.fn(() => 7);
    expect(veTrSnapIndex([0, 1, 2], 1.4)).toBe(7);
    expect(global.veCursorSnapIndex).toHaveBeenCalledWith([0, 1, 2], 1.4);
  });

  test('çekirdek yoksa sessizce -1 — kendi kopyasını uydurmaz', () => {
    expect(veTrSnapIndex([0, 1, 2], 1.4)).toBe(-1);
  });
});
