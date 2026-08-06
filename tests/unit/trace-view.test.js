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

  test('BİRLEŞİK şerit kopyada bozulmadan kalır', () => {
    // Birleştirme yeni bir özellik ve kalıcılık, özelliklerin sessizce
    // kırıldığı klasik yer: kopya yolu şeritteki İKİNCİ kimliği düşürürse
    // kullanıcı projesini kaydedip açtığında birleşik diyagramı iki ayrı
    // şeride dağılmış bulur — hata mesajı yok, sadece "böyle mi bırakmıştım"
    // sorusu.
    const merged = {
      sensors: [sig('a', 'rpm'), sig('b', 'kmh'), sig('c', 'degC')],
      lanes: [
        { ids: [veTrKey('a', 'rpm'), veTrKey('b', 'kmh')], h: 140, min: null, max: null },
        { ids: [veTrKey('c', 'degC')], h: 96 },
      ],
      xAxis: { id: 'time' },
      type: 'line',
    };
    const c = veTrCloneSlot(merged);
    expect(c.lanes).toHaveLength(2);
    expect(c.lanes[0].ids).toHaveLength(2);
    expect(c.lanes[0].ids).toEqual(merged.lanes[0].ids);
    expect(c.lanes[0].h).toBe(140);

    // Geri yükleme: uzlaştırma birleşik şeridi TEK şerit olarak geri kurmalı
    const back = veTrReconcileLanes(c.sensors, c.lanes);
    expect(back).toHaveLength(2);
    expect(back[0].ids).toHaveLength(2);
    expect(back[1].ids).toHaveLength(1);
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

describe('veTrNoteHTML — grafiğin altındaki yorum şeridi', () => {
  // Sunum katmanı: tek smoke testi + iki DAVRANIŞSAL kural (şerit başına
  // başlık, vurgu işaretinin güvenli çevrimi). Etiket başına assertion açılmaz.
  const one = { title: 'Frekans yanıtı — düşey (Z)', paras: ['Tepe **13,6 Hz**.'] };
  const two = { title: 'Düşey ivme süpürmesi', paras: ['Çökme **7,1 mm**.'] };

  test('tek şerit: başlık üstte, gövde tek bölüm', () => {
    const h = T.veTrNoteHTML([one], { lead: 'özet' });
    expect(h).toContain('data-act="note-toggle"');
    expect(h).toContain('Frekans yanıtı — düşey (Z)');
    // Tek şeritte bölüm başlığı TEKRARLANMAZ — üstteki satır zaten söylüyor
    expect(h).not.toContain('ve-trace-note-h"');
  });

  test('iki şerit: her biri kendi başlığıyla ayrı bölüm', () => {
    const h = T.veTrNoteHTML([one, two], { lead: 'özet' });
    expect((h.match(/ve-trace-note-sec/g) || []).length).toBe(2);
    expect((h.match(/ve-trace-note-h"/g) || []).length).toBe(2);
    expect(h).toContain('Düşey ivme süpürmesi');
    expect(h).toContain('2 şerit');
  });

  test('sayı vurgusu <b> olur, HTML kaçışı ÖNCE uygulanır', () => {
    // Yorum motoru HTML üretmez; `**` işaretini sunum katmanı çevirir. Kaçış
    // önce olmazsa üretilen her cümle bir enjeksiyon yüzeyi olurdu.
    const h = T.veTrNoteHTML([{ title: 'x', paras: ['a **13,6 Hz** b'] }], null);
    expect(h).toContain('<b class="ve-trace-note-b">13,6 Hz</b>');
    const evil = T.veTrNoteHTML([{ title: '<b>', paras: ['<script>**x**'] }], null);
    expect(evil).not.toContain('<script>');
    expect(evil).toContain('&lt;script&gt;');
  });

  test('boyu ayarlanabilsin diye tutamak var', () => {
    expect(T.veTrNoteHTML([one], null)).toContain('data-act="note-grip"');
  });

  test('yorum yoksa şerit hiç çizilmez', () => {
    expect(T.veTrNoteHTML([], null)).toBe('');
    expect(T.veTrNoteHTML(null, null)).toBe('');
  });
});

describe('logaritmik X ekseni', () => {
  // Takozun frekans yanıtı 0,1–100 Hz arasında LOGARİTMİK örneklenir (rezonans
  // tepesinin yarı-güç genişliği ~0,4 Hz; eşit aralıklı ızgara onu ıskalar).
  // Aynı veri lineer eksende çizilince üç dekat sıkışır ve rijit gövde
  // modlarının tamamı genişliğin ~%10'una düşer. Eşleme tek noktada olduğu
  // için burada test edilen o eşlemenin kendisidir.
  const geo = { plotX: 100, plotW: 600, xMin: 0.1, xMax: 100, dataMin: 0.1, dataMax: 100, xLog: true };
  const lin = Object.assign({}, geo, { xLog: false });

  test('log ekseni yalnız tüm veri POZİTİFSE mümkün', () => {
    expect(T.veTrXLogOk([0.1, 1, 10])).toBe(true);
    expect(T.veTrXLogOk([0, 1, 2])).toBe(false);      // zaman ekseni 0'dan başlar
    expect(T.veTrXLogOk([-1, 1])).toBe(false);
    expect(T.veTrXLogOk([])).toBe(false);
    expect(T.veTrXLogOk(null)).toBe(false);
  });

  test('kip seçimi: kullanıcı seçimi veri kümesinin önerisini ezer', () => {
    const arr = [0.1, 1, 10, 100];
    expect(T.veTrXLogOn({ xAxis: { scale: 'log' } }, arr)).toBe(true);
    expect(T.veTrXLogOn({ xAxis: {} }, arr)).toBe(false);
    expect(T.veTrXLogOn({ xAxis: { scale: 'log' }, xLog: false }, arr)).toBe(false);
    // Veri elverişsizse öneri de seçim de geçersiz
    expect(T.veTrXLogOn({ xAxis: { scale: 'log' }, xLog: true }, [0, 1])).toBe(false);
  });

  test('dekatlar eşit genişlikte — asıl kazanç bu', () => {
    // 0,1→1 ile 1→10 aynı piksel genişliğini kaplamalı. Lineer eksende
    // ilki toplam genişliğin binde 9'una düşerdi.
    const d1 = T.veTrXPos(geo, 1) - T.veTrXPos(geo, 0.1);
    const d2 = T.veTrXPos(geo, 10) - T.veTrXPos(geo, 1);
    expect(d1).toBeCloseTo(d2, 6);
    expect(d1).toBeCloseTo(200, 6);                  // 600 px / 3 dekat
    // Aynı veri lineer eksende: 0,1→1 neredeyse hiç yer kaplamaz
    expect(T.veTrXPos(lin, 1) - T.veTrXPos(lin, 0.1)).toBeLessThan(6);
  });

  test('uçlar çizim alanının sınırlarına oturur', () => {
    expect(T.veTrXPos(geo, 0.1)).toBeCloseTo(100, 6);
    expect(T.veTrXPos(geo, 100)).toBeCloseTo(700, 6);
  });

  test('imleç için ters eşleme tutarlı — okunan değer çizilen değerdir', () => {
    [0.1, 0.37, 1, 6.5, 13.6, 37.5, 100].forEach((v) => {
      expect(T.veTrXVal(geo, T.veTrXPos(geo, v))).toBeCloseTo(v, 6);
    });
  });

  test('pozitif olmayan değer çizim alanının dışına atılır, NaN üretmez', () => {
    const px = T.veTrXPos(geo, 0);
    expect(Number.isFinite(px)).toBe(true);
    expect(px).toBeLessThan(geo.plotX);
  });

  test('görünüm penceresi log kipinde sıfıra düşmez', () => {
    // Lineer kipten kalmış bir pencere (xMin=0) log'da tanımsızdır.
    T.veTrResetView();
    const v = T.veTrXView([0.1, 1, 10, 100], true);
    expect(v.xMin).toBeGreaterThan(0);
    expect(v.xLog).toBe(true);
  });

  test('bölme değerleri dekat başına 1-2-5', () => {
    const tk = T.veTrLogTicks(geo);
    expect(tk.log).toBe(true);
    expect(tk.ticks).toEqual(expect.arrayContaining([0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 50, 100]));
    // Kesin artan — imleç ikili aramayla örnek kilitliyor
    for (let i = 1; i < tk.ticks.length; i++) {
      expect(tk.ticks[i]).toBeGreaterThan(tk.ticks[i - 1]);
    }
  });

  test('dar yakınlaştırmada ızgara boş kalmaz — lineer üretece düşülür', () => {
    // 11–14 Hz aralığında hiçbir 1-2-5 (ya da ara) çarpanı yok. Log üreteci
    // bunu bildirir (null) ve veTrTimeTicks eşit aralıklı değerlere düşer;
    // değerler yine LOG konuma çizilir, yalnız seçimleri eşit aralıklıdır.
    const zoom = Object.assign({}, geo, { xMin: 11, xMax: 14 });
    expect(T.veTrLogTicks(zoom)).toBeNull();
    const tk = T.veTrTimeTicks(zoom);
    expect(tk.ticks.length).toBeGreaterThanOrEqual(3);
    tk.ticks.forEach((v) => {
      expect(v).toBeGreaterThanOrEqual(10.9);
      expect(v).toBeLessThanOrEqual(14.1);
    });
  });

  test('etiket ondalığı DEĞERİN büyüklüğünden gelir', () => {
    // Tek bir `dec` ile "0,10" ve "100,00" yan yana yazılıyordu.
    expect(T.veTrFmtLogTick(0.1)).toBe('0.1');
    expect(T.veTrFmtLogTick(1)).toBe('1');
    expect(T.veTrFmtLogTick(20)).toBe('20');
    expect(T.veTrFmtLogTick(100)).toBe('100');
  });
});

describe('logaritmik Y ekseni', () => {
  // İletilebilirlik T(f) üç mertebe değişir: rezonansta ~25, izolasyon
  // bölgesinde ~0,003. Lineer eksende ölçeği tepe belirler ve asıl
  // ilgilendiğimiz bölge grafiğin en alt %4'üne yapışır — 0,003 ile 0,03 ayırt
  // edilmez, hâlbuki aradaki fark ON KAT titreşimdir.
  const rect = { y: 0, h: 300 };
  const logLane = { yLog: true, yMin: 0.001, yMax: 100 };
  const linLane = { yLog: false, yMin: 0.001, yMax: 100 };

  test('log yalnız TÜM aralık pozitifse mümkün', () => {
    expect(T.veTrYLogOk(0.001, 100)).toBe(true);
    expect(T.veTrYLogOk(0, 100)).toBe(false);        // kuvvet şeridi sıfırdan geçer
    expect(T.veTrYLogOk(-5, 100)).toBe(false);       // basma/çekme işaret değiştirir
    expect(T.veTrYLogOk(NaN, 1)).toBe(false);
  });

  test('dekatlar eşit yükseklikte — asıl kazanç bu', () => {
    const d1 = T.veTrYPos(logLane, rect, 0.001) - T.veTrYPos(logLane, rect, 0.01);
    const d2 = T.veTrYPos(logLane, rect, 10) - T.veTrYPos(logLane, rect, 100);
    expect(d1).toBeCloseTo(d2, 6);
    expect(d1).toBeCloseTo(60, 6);                   // 300 px / 5 dekat
    // Lineerde 0,001→0,01 neredeyse hiç yer kaplamaz
    expect(T.veTrYPos(linLane, rect, 0.001) - T.veTrYPos(linLane, rect, 0.01))
      .toBeLessThan(0.1);
  });

  test('uçlar şeridin sınırlarına oturur, yön doğru (büyük değer YUKARIDA)', () => {
    expect(T.veTrYPos(logLane, rect, 100)).toBeCloseTo(0, 6);
    expect(T.veTrYPos(logLane, rect, 0.001)).toBeCloseTo(300, 6);
    expect(T.veTrYPos(logLane, rect, 1)).toBeLessThan(T.veTrYPos(logLane, rect, 0.1));
  });

  test('pozitif olmayan değer eşlenmez — NaN, sıfıra KIRPILMAZ', () => {
    // Kırpılsaydı eğri olmadığı bir yerden geçer, kullanıcı "burada bir değer
    // var" diye okurdu. NaN'da çizim kesilir.
    expect(Number.isNaN(T.veTrYPos(logLane, rect, 0))).toBe(true);
    expect(Number.isNaN(T.veTrYPos(logLane, rect, -1))).toBe(true);
    expect(Number.isFinite(T.veTrYPos(linLane, rect, 0))).toBe(true);   // lineerde normal
  });

  test('log aralık payı ÇARPIMSAL — veri uçları içeride kalır', () => {
    const r = T.veTrLaneRangeLog(0.01, 10);
    expect(r.min).toBeLessThan(0.01);
    expect(r.max).toBeGreaterThan(10);
    // Pay iki uçta da AYNI oranda: lineerdeki "%8 mutlak" kuralı log ölçekte
    // alt uçta devasa, üst uçta görünmez bir boşluk açardı.
    expect(0.01 / r.min).toBeCloseTo(r.max / 10, 9);
    // Sabit seride simetrik bant
    const c = T.veTrLaneRangeLog(5, 5);
    expect(c.min).toBeLessThan(5);
    expect(c.max).toBeGreaterThan(5);
    // Geçersiz girdi çökertmez
    expect(T.veTrLaneRangeLog(0, 10)).toEqual({ min: 1, max: 10 });
  });

  test('bölme değerleri dekat başına 1-2-5, X ekseniyle AYNI üreteçten', () => {
    const y = T.veTrLogTickList(0.1, 100);
    expect(y).toEqual(expect.arrayContaining([0.1, 0.2, 0.5, 1, 2, 5, 10, 20, 50, 100]));
    const x = T.veTrLogTicks({ xMin: 0.1, xMax: 100 }).ticks;
    expect(y).toEqual(x);
    // Dar aralıkta üreteç null bildirir (çağıran lineer/uç değere düşer)
    expect(T.veTrLogTickList(11, 14)).toBeNull();
  });

  // veTrSeries sonucu ANAHTAR BAŞINA önbelleklenir; her senaryo kendi sinyal
  // adını kullanır ki bir testin verisi ötekine sızmasın.
  const DATA = {
    pos: [0.01, 0.5, 25], mix: [-3, 0, 7], disc: [0, 1, 1],
    negOnly: [-3, -1], posOnly: [0.5, 3, 7], lock: [0.01, 0.5, 25],
  };
  global.veGetSensorData = (id, signal) => DATA[signal] || null;

  test('şerit kipi PANO düzeyinde açılır, ŞERİT başına uygulanır', () => {
    // Aynı panoda işaret değiştiren bir kuvvet şeridi ile hep pozitif bir
    // iletilebilirlik şeridi yan yana durabilir. Log yalnız ikincisine uyar.
    const slot = {
      yLog: true,
      sensors: [sig('s', 'pos', { unit: '−' }), sig('s', 'mix', { unit: 'N' }),
                sig('s', 'disc', { unit: 'adet' })],
      lanes: [{ ids: [veTrKey('s', 'pos')] }, { ids: [veTrKey('s', 'mix')] },
              { ids: [veTrKey('s', 'disc')] }],
    };
    const lanes = T.veTrBuildLanes(slot);
    expect(lanes[0].yLog).toBe(true);        // hepsi pozitif
    expect(lanes[1].yLog).toBe(false);       // sıfır ve negatif içeriyor
    expect(lanes[2].yLog).toBe(false);       // ayrık: seviye numarasının logu olmaz
    // Kapatınca hepsi lineer
    slot.yLog = false;
    expect(T.veTrBuildLanes(slot).every((L) => !L.yLog)).toBe(true);
  });

  test('elverişli şerit yoksa kip hiç açılmaz, sorgu bayrağı BOZMAZ', () => {
    const neg = { yLog: true, sensors: [sig('s', 'negOnly', { unit: 'N' })],
                  lanes: [{ ids: [veTrKey('s', 'negOnly')] }] };
    expect(T.veTrYLogAny(neg)).toBe(false);
    expect(neg.yLog).toBe(true);
    const pos = { yLog: true, sensors: [sig('s', 'posOnly', { unit: '−' })],
                  lanes: [{ ids: [veTrKey('s', 'posOnly')] }] };
    expect(T.veTrYLogAny(pos)).toBe(true);
    expect(pos.yLog).toBe(true);
    // Elverişlilik verinin HAM uçlarından sorulur: lineer pay ([0,5 … 7] →
    // yMin −0,02) tamamı pozitif bir seriyi elverişsiz gösterirdi.
    expect(T.veTrBuildLanes(pos)[0].vMin).toBe(0.5);
  });

  test('log kipte 0/negatif elle kilit sessizce yok sayılır', () => {
    // Lineer kipten kalmış bir "min = 0" kilidi log10 için tanımsızdır;
    // uygulansaydı tüm şerit çizilemezdi.
    const slot = { yLog: true, sensors: [sig('s', 'lock', { unit: '−' })],
                   lanes: [{ ids: [veTrKey('s', 'lock')], min: 0, max: 50 }] };
    const L = T.veTrBuildLanes(slot)[0];
    expect(L.yLog).toBe(true);
    expect(L.yMin).toBeGreaterThan(0);
    expect(L.yMax).toBe(50);                 // pozitif kilit geçerli
  });
});

// ── Çok eksenli birleşik şerit ───────────────────────────────────────────────
//
// "Birleştir" artık kullanıcının SEÇTİĞİ şeritleri tek diyagramda topluyor ve
// birleşen her sinyal KENDİ Y ölçeğini koruyor.
//
// Neden bu test değerli: ortak ölçek paylaşmak sessizce yanlış bir grafik
// üretir. Devir (800…2200) ile hız (0…40) tek ölçekte çizilirse hız tabana
// düz bir çizgi olarak yapışır — grafik "hız hiç değişmemiş" der, oysa 0'dan
// 40'a çıkmıştır. Kullanıcının bunu gözle yakalama şansı yok.
describe('birleşik şeritte sinyal başına Y ekseni', () => {
  const DATA = {
    // Sürekli kanallar KASITEN ondalıklı: tamsayı ve az örnekli bir seri
    // veTrIsDiscrete sezgisince "basamaklı" sayılıyor (doğru davranış), ve o
    // zaman test ölçmek istediği şeyi değil sezgiyi ölçerdi.
    rpm: [800.5, 1500.25, 2200.75],
    kmh: [0.4, 20.2, 40.1],
    degC: [20.5, 50.25, 60.75],
    gear: [1, 2, 3],
    txt: ['1C', '2L', '2H'],
    txt2: ['A', 'B', 'C'],
  };

  // İZOLASYON: describe gövdeleri tüm testlerden ÖNCE koşuyor. Bu satır
  // gövdeye yazılsaydı en son değerlendirilen describe'ın verisi bütün
  // dosyaya sızar ve ondan önceki testler (log Y bloğu) başka bir veriyle
  // ölçülürdü — nitekim ilk denemede tam olarak bu oldu.
  let prevGet;
  beforeEach(() => {
    prevGet = global.veGetSensorData;
    global.veGetSensorData = (id, signal) => DATA[signal] || null;
  });
  afterEach(() => { global.veGetSensorData = prevGet; });

  const board = (units) => ({
    sensors: Object.keys(units).map((s) => sig('s', s, { unit: units[s] })),
    lanes: [{ ids: Object.keys(units).map((s) => veTrKey('s', s)) }],
  });

  test('her sinyal kendi ölçeğini alır — hiçbiri ezilmez', () => {
    const L = T.veTrBuildLanes(board({ rpm: '1/min', kmh: 'km/h' }))[0];
    expect(L.axes).toHaveLength(2);

    // Her eksen KENDİ sinyalinin uçlarını sarmalı, ötekininkini değil.
    expect(L.axes[0].vMin).toBe(800.5);
    expect(L.axes[0].vMax).toBe(2200.75);
    expect(L.axes[1].vMin).toBe(0.4);
    expect(L.axes[1].vMax).toBe(40.1);

    // Hız ekseni devrin tepesine kadar uzanmamalı — uzanırsa eğri ezilir.
    expect(L.axes[1].yMax).toBeLessThan(100);
  });

  test('eksen sırası sinyal sırasını izler ve renkleri eğriyle aynı', () => {
    const L = T.veTrBuildLanes(board({ rpm: '1/min', kmh: 'km/h', degC: '°C' }))[0];
    expect(L.axes).toHaveLength(3);
    expect(L.axes.map((a) => a.unit)).toEqual(['1/min', 'km/h', '°C']);
    // Eksen etiketleri eğri renginde yazılıyor; ayrışırsa hangi eksenin hangi
    // eğriye ait olduğu okunamaz hâle gelir.
    L.axes.forEach((a, i) => expect(a.color).toBe(L.sigs[i].color));
  });

  test('TEK sinyalli şerit tek eksenli kalır — eski davranış birebir', () => {
    // Çok eksenli yolun tek sinyalli şeritleri etkilememesi bu değişikliğin
    // regresyon güvencesi.
    const L = T.veTrBuildLanes(board({ rpm: '1/min' }))[0];
    expect(L.axes).toHaveLength(1);
    expect(L.yMin).toBe(L.axes[0].yMin);
    expect(L.yMax).toBe(L.axes[0].yMax);
    expect(L.vMin).toBe(800.5);
    expect(L.vMax).toBe(2200.75);
  });

  test('birincil eksen şeridin kendisidir — eski alanlar korunur', () => {
    const L = T.veTrBuildLanes(board({ rpm: '1/min', kmh: 'km/h' }))[0];
    expect(L.yMin).toBe(L.axes[0].yMin);
    expect(L.yMax).toBe(L.axes[0].yMax);
    expect(L.unit).toBe('1/min');
  });

  test('ham uçlar TÜM eksenleri kapsar — "log y" sorusu şeridin tamamına ait', () => {
    const L = T.veTrBuildLanes(board({ rpm: '1/min', kmh: 'km/h' }))[0];
    expect(L.vMin).toBe(0.4);        // hızın alt ucu
    expect(L.vMax).toBe(2200.75);    // devrin üst ucu
  });

  test('elle Y kilidi YALNIZ birincil eksene uygulanır', () => {
    // Kilit şeridin kenarından konuyor ve o kenarın gösterdiği ölçek
    // birincil eksenindir. İkinci eksene de uygulansaydı, ilgisiz bir
    // sinyalin eğrisi sessizce kırpılırdı.
    const slot = board({ rpm: '1/min', kmh: 'km/h' });
    slot.lanes[0].min = 0;
    slot.lanes[0].max = 3000;
    const L = T.veTrBuildLanes(slot)[0];
    expect(L.axes[0].yMin).toBe(0);
    expect(L.axes[0].yMax).toBe(3000);
    expect(L.axes[1].yMax).toBeLessThan(100);   // hız ekseni kilitten etkilenmedi
  });

  test('metin kanalının seviye adları SİNYALE ait — birleşince karışmaz', () => {
    // Eskiden seviye adları şeride aitti ve şeritteki ilk metin kanalından
    // geliyordu: iki metin kanalı birleştirilince ikincisi birincinin
    // etiketleriyle okunurdu ("B" yerine "2L").
    // Seviyeler alfabetik sıralanır (veTrEncodeText) — eksende kararlı bir
    // sıra olsun diye; burada test edilen şey sıra değil, KİMİN etiketi
    // olduğu.
    const L = T.veTrBuildLanes(board({ txt: '', txt2: '' }))[0];
    expect(L.sigs[0].levels).toEqual(['1C', '2H', '2L']);
    expect(L.sigs[1].levels).toEqual(['A', 'B', 'C']);
    expect(L.axes[0].levels).toEqual(['1C', '2H', '2L']);
    expect(L.axes[1].levels).toEqual(['A', 'B', 'C']);
  });

  test('ayrık ve sürekli sinyal birleşince her biri kendi kipinde kalır', () => {
    const L = T.veTrBuildLanes(board({ gear: '', rpm: '1/min' }))[0];
    expect(L.axes[0].discrete).toBe(true);     // vites: basamaklı
    expect(L.axes[1].discrete).toBe(false);    // devir: sürekli
  });

  test('veTrAxisOfSig doğru ekseni verir, eksen yoksa şeride düşer', () => {
    const L = T.veTrBuildLanes(board({ rpm: '1/min', kmh: 'km/h' }))[0];
    expect(T.veTrAxisOfSig(L, 0)).toBe(L.axes[0]);
    expect(T.veTrAxisOfSig(L, 1)).toBe(L.axes[1]);
    // Sınır dışı indekste birincil eksene düşer — çizim yolu asla undefined
    // bir ölçekle NaN üretmemeli.
    expect(T.veTrAxisOfSig(L, 9)).toBe(L.axes[0]);
    const bare = { yMin: 0, yMax: 1 };
    expect(T.veTrAxisOfSig(bare, 0)).toBe(bare);
  });

  test('veTrAxisByUnit birimi tutan ekseni bulur', () => {
    // Takoz işaretleri ("δ = 3 mm") birimi tutan eksene çizilmeli; birincil
    // eksene konsaydı şeridin rastgele bir yerinden geçerdi.
    const L = T.veTrBuildLanes(board({ rpm: '1/min', kmh: 'km/h' }))[0];
    expect(T.veTrAxisByUnit(L, 'km/h')).toBe(L.axes[1]);
    expect(T.veTrAxisByUnit(L, 'N')).toBeNull();
    // Birim sorulmuyorsa birincil eksen
    expect(T.veTrAxisByUnit(L, null)).toBe(L.axes[0]);
  });
});

// ── Oluk geometrisi: çok eksenli şeritte sütunlar ────────────────────────────
//
// BU BLOK BİR HATADAN DOĞDU. İlk sürümde birleşik şeritte her eksenin adı
// oluğa dikey bir şerit olarak konuyordu. Sonuç: dört eksende oluk 215 px'e
// çıkıyor, dar pencerede üst sınıra takılıyor ve en dıştaki eksen tuvalin
// DIŞINA (x = −1,5) düşüp tamamen görünmez oluyordu. Kullanıcının gördüğü
// şey "sadece bir Y ekseni var" idi.
//
// Adlar şeridin içindeki yatay lejanta taşındı; oluk yalnız sayıları taşıyor.
// Buradaki testler sütun matematiğini kilitliyor — gözle yakalanması zor,
// çünkü hata ancak belirli pencere genişliği + eksen sayısı bileşiminde çıkıyor.
describe('oluk geometrisi — çok eksenli şerit', () => {
  // veTrGeometry canvas'tan yalnız metin genişliği istiyor; sahte ctx yeterli
  // ve testi gerçek canvas'a bağlamaktan kurtarıyor.
  const fakeCtx = (perChar = 6) => ({
    font: '',
    measureText: (t) => ({ width: String(t).length * perChar }),
  });
  const axis = (unit, min, max) => ({
    unit, yMin: min, yMax: max, yLog: false, discrete: false, levels: null,
    hasData: true, color: '#000', sigs: [],
  });
  const lane = (...axes) => ({ axes, def: { h: VE_TR.LANE_DEF_H }, sigs: [] });
  const view = { xMin: 0, xMax: 1, dataMin: 0, dataMax: 1, xLog: false };

  test('eksen sütunları SOLA doğru dizilir, birincil çizim alanına bitişik', () => {
    const L = lane(axis('1/min', 800, 2200), axis('km/h', 0, 40));
    const geo = T.veTrGeometry(fakeCtx(), [L], view, 1200, 600);

    // Birincil eksenin etiket x'i tek eksenli şeritteki değerin AYNISI olmalı:
    // birleştirme, birleşmeyen şeritlerin görünümünü kaydırmamalı.
    expect(L.axes[0]._labelX).toBe(geo.gutter - 6);
    // İkincil eksen SOLDA ve birincisiyle çakışmıyor
    expect(L.axes[1]._labelX).toBeLessThan(L.axes[0]._labelX - L.axes[0]._w);
  });

  test('HİÇBİR eksen sütunu ad şeridinin altına ya da tuval dışına düşmez', () => {
    // Hatanın tam senaryosu: dört eksen + geniş etiketler + dar pencere.
    const L = lane(axis('Nm', 100000, 999999), axis('Nm', 100000, 999999),
                   axis('W', 100000, 999999), axis('W', 100000, 999999));
    [1400, 1000, 800, 640].forEach((w) => {
      const geo = T.veTrGeometry(fakeCtx(), [L], view, w, 600);
      L.axes.forEach((a) => {
        if (a._fits === false) return;         // çizilmeyecek, kontrol dışı
        expect(a._labelX - a._w).toBeGreaterThanOrEqual(VE_TR.TITLE_BAND);
        expect(a._labelX).toBeLessThanOrEqual(geo.gutter);
      });
      // Çizim alanı yutulmamalı
      expect(geo.plotW).toBeGreaterThan(w * 0.3);
    });
  });

  test('sığmayan sütun İŞARETLENİR — sessizce yarım çizilmez', () => {
    // Yarısı kesik sayılar okunamaz ve şerit adının üstüne biner; çizim
    // katmanı _fits===false olanı atlıyor, lejant da sebebini yazıyor.
    const many = [];
    for (let i = 0; i < 8; i++) many.push(axis('Nm', 100000, 999999));
    const L = lane(...many);
    const geo = T.veTrGeometry(fakeCtx(9), [L], view, 520, 600);
    const dropped = L.axes.filter((a) => a._fits === false);
    expect(dropped.length).toBeGreaterThan(0);
    // Sığanların hepsi gerçekten sığmalı
    L.axes.filter((a) => a._fits !== false).forEach((a) => {
      expect(a._labelX - a._w).toBeGreaterThanOrEqual(VE_TR.TITLE_BAND);
    });
  });

  test('oluk EN ÇOK EKSENLİ şeride göre kurulur, plotX pano genelinde tek', () => {
    // Bütün şeritler aynı zaman ekseninde hizalı durmalı; oluk şerit başına
    // değişseydi şeritler birbirine göre kayardı.
    const merged = lane(axis('1/min', 800, 2200), axis('km/h', 0, 40));
    const single = lane(axis('°C', 20, 60));
    const geo = T.veTrGeometry(fakeCtx(), [merged, single], view, 1200, 600);
    expect(single.axes[0]._labelX).toBe(merged.axes[0]._labelX);
    expect(geo.plotX).toBe(geo.gutter);
  });

  test('tek eksenli şeritte oluk eskisi gibi dar kalır', () => {
    // Regresyon kapısı: çok eksen desteği, birleştirmeyen kullanıcının
    // grafiğini daraltmamalı.
    const one = lane(axis('1/min', 800, 2200));
    const geo = T.veTrGeometry(fakeCtx(), [one], view, 1200, 600);
    expect(geo.gutter).toBeLessThanOrEqual(VE_TR.GUTTER_MAX);
    expect(geo.gutter).toBeGreaterThanOrEqual(VE_TR.GUTTER_MIN);
  });
});

describe('veTrAxisTitle — her eksen kendi adını taşır', () => {
  const s = (name, unit) => ({ sensor: { name, unit } });

  test('tek sinyalli eksende sinyalin adı ve birimi', () => {
    expect(T.veTrAxisTitle({ sigs: [s('EngSpeed', '1/min')] })).toBe('EngSpeed [1/min]');
  });

  test('birim yoksa yalnız ad', () => {
    expect(T.veTrAxisTitle({ sigs: [s('Mode', '')] })).toBe('Mode');
  });

  test('ekseni paylaşan sinyallerde ilk ad + sayaç', () => {
    expect(T.veTrAxisTitle({ sigs: [s('A', 'N'), s('B', 'N')] })).toBe('A [N] +1');
  });

  test('boş eksende boş dize — çizim katmanı patlamamalı', () => {
    expect(T.veTrAxisTitle({ sigs: [] })).toBe('');
    expect(T.veTrAxisTitle(null)).toBe('');
  });
});

// ── Eksen ad bloğu (oluğun solunda, yatay) ───────────────────────────────────
//
// Adlar önce çizim alanının içine yatay lejant olarak kondu — eğrilerin üstüne
// biniyordu. Sonra eksen başına DİKEY ad şeridi denendi — oluğu şişirip dar
// pencerede en dıştaki ekseni tuval dışına attı. Şimdiki yer ikisinin de
// sorununu çözüyor: oluğun solunda, yatay, sayı sütunlarının dışında.
describe('oluk — eksen ad bloğu', () => {
  const fakeCtx = (perChar = 6) => ({
    font: '',
    measureText: (t) => ({ width: String(t).length * perChar }),
  });
  const axis = (unit, min, max, name) => ({
    unit, yMin: min, yMax: max, yLog: false, discrete: false, levels: null,
    hasData: true, color: '#000',
    sigs: [{ sensor: { name: name || 'Sinyal', unit: unit } }],
  });
  const lane = (...axes) => ({ axes, def: { h: VE_TR.LANE_DEF_H }, sigs: [] });
  const view = { xMin: 0, xMax: 1, dataMin: 0, dataMax: 1, xLog: false };

  test('çok eksenli şeritte ad bloğuna yer ayrılır', () => {
    const L = lane(axis('1/min', 800, 2200, 'EngSpeed'), axis('km/h', 0, 40, 'VehSpeed'));
    T.veTrGeometry(fakeCtx(), [L], view, 1200, 600);
    expect(L._nameW).toBeGreaterThan(0);
    expect(L._nameX).toBe(4);
    // Sayı sütunları ad bloğunun SAĞINDA başlamalı; üstüne binerse iki yazı
    // birbirini okunmaz kılar.
    L.axes.forEach((a) => {
      expect(a._labelX - a._w).toBeGreaterThanOrEqual(L._nameW + VE_TR.NAME_GAP);
    });
  });

  test('tek eksenli şeritte ad bloğu YOK — oluk dar kalır', () => {
    const one = lane(axis('1/min', 800, 2200, 'EngSpeed'));
    const geo = T.veTrGeometry(fakeCtx(), [one], view, 1200, 600);
    expect(one._nameW).toBe(0);
    expect(one._nameX).toBeNull();
    expect(geo.gutter).toBeLessThanOrEqual(VE_TR.GUTTER_MAX);
  });

  test('çok uzun ad oluğu şişirmez — üst sınırla kırpılır', () => {
    // Sinyal adları kullanıcı verisinden geliyor ve uzunluğu sınırsız.
    // Sınır olmasa tek bir uzun ad çizim alanını yutardı.
    const long = 'Cok::Uzun::Bir::Mesaj::Yolu::Ve::Sinyal::Adi::Daha::Da::Uzun';
    const L = lane(axis('N', 0, 10, long), axis('mm', 0, 5, long));
    const geo = T.veTrGeometry(fakeCtx(), [L], view, 1200, 600);
    expect(L._nameW).toBeLessThanOrEqual(VE_TR.NAME_MAX_W);
    expect(geo.plotW).toBeGreaterThan(1200 * 0.5);
  });

  // AD BLOĞU PANO GENELİNDE: ya tüm şeritlerde var ya hiçbirinde.
  //
  // Ara durum ölçülen bir kusurdu: yalnız birleşik şeride ad bloğu verilince
  // oluk (pano geneli) o kadar genişliyor ama birleşmemiş şeritler o genişliği
  // kullanmıyordu — sollarında 1024 px'lik ekranda çizim alanının dörtte biri
  // kadar bomboş bir bant kalıyordu.
  test('panoda TEK bir birleşik şerit varsa ad bloğunu TÜM şeritler kullanır', () => {
    const merged = lane(axis('1/min', 800, 2200, 'EngSpeed'), axis('km/h', 0, 40, 'VehSpeed'));
    const single = lane(axis('°C', 20, 60, 'Sicaklik'));
    T.veTrGeometry(fakeCtx(), [merged, single], view, 1200, 600);

    // Birleşmemiş şerit de yatay ad yazar → solunda ödenmiş boş bant kalmaz.
    expect(single._nameX).toBe(4);
    expect(single._nameW).toBeGreaterThan(0);
    // Blok genişliği pano geneli: iki şeritte de aynı, yoksa adlar hizasız olur.
    expect(single._nameW).toBe(merged._nameW);
    // Ve tek eksenli şeridin sayıları da ad bloğunun sağında başlar.
    const a = single.axes[0];
    expect(a._labelX - a._w).toBeGreaterThanOrEqual(single._nameW + VE_TR.NAME_GAP);
  });

  test('hiç birleşme yoksa ad bloğu HİÇ açılmaz — oluk eskisi gibi dar', () => {
    const l1 = lane(axis('1/min', 800, 2200, 'EngSpeed'));
    const l2 = lane(axis('°C', 20, 60, 'Sicaklik'));
    const geo = T.veTrGeometry(fakeCtx(), [l1, l2], view, 1200, 600);
    [l1, l2].forEach((L) => {
      expect(L._nameW).toBe(0);
      expect(L._nameX).toBeNull();          // → çizimde döndürülmüş başlık
    });
    // Ad bloğu açılan panoyla kıyas: birleşmeyen pano belirgin biçimde dar.
    const m = lane(axis('1/min', 800, 2200, 'EngSpeed'), axis('km/h', 0, 40, 'VehSpeed'));
    const wide = T.veTrGeometry(fakeCtx(), [m], view, 1200, 600);
    expect(geo.gutter).toBeLessThan(wide.gutter);
  });

  test('döndürülmüş başlık KENDİ sayılarının yanında durur', () => {
    // Oluk pano geneli ve en geniş sayı sütununa göre ölçülüyor; sayıları dar
    // olan şeridin başlığı sabit konumda kalsaydı sayılarından uzağa düşer,
    // arada boş bir koridor kalırdı. Sütunlar çizim alanına yaslı olduğu için
    // başlık da onları izler.
    const wideNums = lane(axis('W', -12000000, 12000000, 'Guc'));
    const narrow = lane(axis('-', 0, 1, 'Oran'));
    const geo = T.veTrGeometry(fakeCtx(), [wideNums, narrow], view, 1200, 600);
    expect(narrow._nameX).toBeNull();       // ad bloğu yok → döndürülmüş yol
    // Çizim katmanının kullandığı formül: labelX - w - 11, alt sınır eski konum
    const tx = Math.max(VE_TR.TITLE_BAND - 5,
                        narrow.axes[0]._labelX - narrow.axes[0]._w - 11);
    expect(tx).toBeGreaterThan(VE_TR.TITLE_BAND);      // sağa kaymış
    expect(tx).toBeLessThan(geo.gutter);
  });
});

// ── İmleç değer rozetlerinin dikey yerleşimi ─────────────────────────────────
//
// Birleşik şeritte imleç anında sinyal başına bir rozet çiziliyor. İki eğri o
// anda birbirine yakınsa rozetler üst üste biniyordu ve İKİSİ DE okunamıyordu.
//
// ÖLÇÜLEN kusur (5 sinyal tek şeritte, görüntüleyici, 1500x900):
//   Motor Sıcaklığı  rozetY=384   → ekranda "1C )3 °C"
//   Mode             rozetY=383
// İki rozet 1 px arayla çizilince metinler birbirine giriyor. Kullanıcı yanlış
// bir sayı okuyabilir ve kusur SESSİZ: eğriler ayrılınca kendini toparlıyor.
describe('imleç rozetleri — çakışma yerleşimi', () => {
  const H = VE_TR.BADGE_H, GAP = VE_TR.BADGE_GAP;
  const rect = (y, h) => ({ y, h });
  const put = (...ys) => ys.map((y) => ({ y }));

  // Bindirme ölçütü: ÇİZİLEN iki rozetin dikey aralığı kesişiyor mu?
  const overlaps = (items) => {
    const s = items.filter((b) => !b.hidden).sort((a, b) => a.by - b.by);
    let n = 0;
    for (let i = 1; i < s.length; i++) if (s[i].by < s[i - 1].by + H) n++;
    return n;
  };

  test('ölçülen senaryo: 1 px arayla iki rozet ARTIK binmiyor', () => {
    const it = put(391, 390);                       // Motor Sıcaklığı, Mode
    T.veTrStackBadges(it, rect(8, 764));
    expect(overlaps(it)).toBe(0);
    expect(Math.abs(it[0].by - it[1].by)).toBeGreaterThanOrEqual(H + GAP);
  });

  test('tek rozet tercih ettiği yerde kalır — boşuna kaydırma yok', () => {
    const it = put(300);
    T.veTrStackBadges(it, rect(8, 764));
    expect(it[0].by).toBe(300 - H / 2);
  });

  test('birbirinden uzak rozetler HİÇ kaydırılmaz', () => {
    const ys = [100, 300, 500, 700];
    const it = put(...ys);
    T.veTrStackBadges(it, rect(8, 800));
    it.forEach((b, i) => expect(b.by).toBe(ys[i] - H / 2));
  });

  test('beş sinyal aynı yükseklikte — hepsi ayrı ve şeridin İÇİNDE', () => {
    const it = put(400, 400, 400, 400, 400);
    const r = rect(8, 764);
    T.veTrStackBadges(it, r);
    expect(overlaps(it)).toBe(0);
    it.forEach((b) => {
      expect(b.by).toBeGreaterThanOrEqual(r.y);
      expect(b.by + H).toBeLessThanOrEqual(r.y + r.h);
    });
  });

  test('şeridin ALT kenarındaki yığın taşmaz — yukarı geri itilir', () => {
    const r = rect(0, 60);
    const it = put(55, 56, 57);
    T.veTrStackBadges(it, r);
    expect(overlaps(it)).toBe(0);
    it.forEach((b) => {
      expect(b.by).toBeGreaterThanOrEqual(r.y);
      expect(b.by + H).toBeLessThanOrEqual(r.y + r.h);
    });
  });

  test('şeridin ÜST kenarındaki yığın da içeride kalır', () => {
    const r = rect(100, 60);
    const it = put(100, 101, 102);
    T.veTrStackBadges(it, r);
    expect(overlaps(it)).toBe(0);
    it.forEach((b) => expect(b.by).toBeGreaterThanOrEqual(r.y));
  });

  test('sıra korunur — üstteki eğrinin rozeti üstte kalır', () => {
    // Renkten başka ipucu yok; sıra bozulursa kullanıcı değeri yanlış eğriye
    // atfeder ve bu, çakışmadan daha sinsi bir hatadır.
    const it = [{ y: 300, ad: 'a' }, { y: 100, ad: 'b' }, { y: 200, ad: 'c' }];
    T.veTrStackBadges(it, rect(0, 400));
    const sirali = it.slice().sort((x, z) => x.by - z.by).map((x) => x.ad);
    expect(sirali).toEqual(['b', 'c', 'a']);
  });

  test('şerit hepsini ALMIYORSA sığmayanlar gizlenir ve SAYILIR', () => {
    // 6 rozet × 16 px = 94 px; şerit 50 px. Sıkıştırmak dürüst değil —
    // sıkıştırılmış rozet de üst üste biner, yalnız düzenli biner. Gizlenen
    // sayısı "+N" ile söylenir; kullanıcı şeridi büyütünce hepsi döner.
    const r = rect(0, 50);
    const it = put(10, 12, 14, 16, 18, 20);
    const fit = T.veTrStackBadges(it, r);

    expect(fit.hidden).toBeGreaterThan(0);
    expect(fit.overflowY).not.toBeNull();
    expect(overlaps(it)).toBe(0);                       // çizilenler binmiyor
    expect(it.filter((b) => b.hidden).length).toBe(fit.hidden);
    expect(it.filter((b) => !b.hidden).length + fit.hidden).toBe(it.length);

    // "+N" satırı da şeridin içinde ve son rozetin ALTINDA.
    expect(fit.overflowY + H).toBeLessThanOrEqual(r.y + r.h);
    const son = Math.max(...it.filter((b) => !b.hidden).map((b) => b.by));
    expect(fit.overflowY).toBeGreaterThanOrEqual(son + H);
  });

  test('tam sığan sayıda rozette HİÇBİRİ gizlenmez', () => {
    // Sınırın hemen berisi: gizleme yalnız gerçekten gerektiğinde devreye
    // girmeli, yoksa kullanıcı sebepsiz yere değer kaybeder.
    const r = rect(0, 50);
    const cap = Math.floor((r.h - H - 2) / (H + GAP)) + 1;
    const it = put(...Array.from({ length: cap }, (_, k) => 5 + k * 3));
    const fit = T.veTrStackBadges(it, r);
    expect(fit.hidden).toBe(0);
    expect(fit.overflowY).toBeNull();
    expect(overlaps(it)).toBe(0);
  });

  test('boş liste patlatmaz', () => {
    expect(() => T.veTrStackBadges([], rect(0, 100))).not.toThrow();
    expect(T.veTrStackBadges([], rect(0, 100)).hidden).toBe(0);
  });
});

// ── Ad bloğu: sığmayan eksenin sebebi ────────────────────────────────────────
//
// Oluğa sığmayan eksenin SAYILARI çizilmez (veTrGeometry `_fits = false`
// koyar). Kullanıcı o zaman "eksen yok" sanmasın diye sebep yazılıyordu — ama
// her adın ARDINA ' (sığmadı)' eklenerek. Ad bloğu 120 px'le sınırlı olduğu
// için uzun bir sinyalde tam da o açıklama kırpılıyordu:
//   ölçülen çıktı → "Signal_8 [kPa] (sığ…"
// Uyarı, en çok gerektiği yerde okunamıyordu. Artık sebep blok sonunda BİR
// KEZ ve kısa yazılıyor; hangi eksenler olduğu içi boş renk kutucuğundan.
describe('ad bloğu — sığmayan eksenin sebebi', () => {
  const recCtx = () => {
    const c = {
      font: '', textBaseline: '', textAlign: '', fillStyle: '', strokeStyle: '', lineWidth: 1,
      yazi: [], dolu: [], bos: [],
      measureText: (t) => ({ width: String(t).length * 6 }),
      fillText: (t, x, y) => c.yazi.push({ t, x, y }),
      fillRect: (x, y, w, h) => c.dolu.push({ x, y, w, h }),
      strokeRect: (x, y, w, h) => c.bos.push({ x, y, w, h }),
      save: () => {}, restore: () => {},
    };
    return c;
  };
  const axis = (name, fits) => ({
    unit: 'kPa', color: '#0a0', _fits: fits,
    sigs: [{ sensor: { name, unit: 'kPa' } }],
  });
  const lane = (...axes) => ({ axes, _nameX: 4, _nameW: VE_TR.NAME_MAX_W });
  const rect = { y: 10, h: 300 };

  test('sebep TEK satırda, kırpılmadan yazılır', () => {
    const uzun = 'PowerTrain::TransmissionControlUnit::ClutchSlipTargetValue';
    const L = lane(axis(uzun, true), axis(uzun, false), axis(uzun, false));
    const ctx = recCtx();
    T.veTrDrawAxisNames(ctx, {}, L, rect);

    const not = ctx.yazi.map((w) => w.t).find((t) => /sığmadı/.test(t));
    expect(not).toBe('2 eksen sığmadı');       // '…' YOK — kırpılmamış
    expect(not).not.toMatch(/…/);
    // Ve ad satırlarının hiçbirine artık sebep eklenmiyor.
    expect(ctx.yazi.filter((w) => /sığmadı/.test(w.t))).toHaveLength(1);
  });

  test('sığmayan eksenin renk kutucuğu İÇİ BOŞ — hangileri olduğu görünür', () => {
    const L = lane(axis('A', true), axis('B', false), axis('C', true));
    const ctx = recCtx();
    T.veTrDrawAxisNames(ctx, {}, L, rect);
    expect(ctx.dolu).toHaveLength(2);          // sığan iki eksen: dolu kutucuk
    expect(ctx.bos).toHaveLength(1);           // sığmayan: içi boş
  });

  test('hepsi sığıyorsa not HİÇ yazılmaz ve satır harcanmaz', () => {
    const L = lane(axis('A', true), axis('B', true));
    const ctx = recCtx();
    T.veTrDrawAxisNames(ctx, {}, L, rect);
    expect(ctx.yazi.map((w) => w.t)).toEqual(['A [kPa]', 'B [kPa]']);
    expect(ctx.bos).toHaveLength(0);
  });

  test('kısa şeritte not satırı yerini korur — "+N daha" ile birlikte', () => {
    // 3 satırlık yer: 1 ad + "+N daha" + not. Not, sığmayanların varlığını
    // söyleyen tek işaret; onu düşürmek kusuru geri getirirdi.
    const many = [];
    for (let i = 0; i < 8; i++) many.push(axis('S' + i, i > 5));
    const L = lane(...many);
    const ctx = recCtx();
    T.veTrDrawAxisNames(ctx, {}, L, { y: 0, h: 3 * VE_TR.NAME_LINE_H + 4 });
    const metinler = ctx.yazi.map((w) => w.t);
    expect(metinler.some((t) => /daha$/.test(t))).toBe(true);
    expect(metinler.some((t) => /sığmadı$/.test(t))).toBe(true);
    // Satırlar üst üste binmemeli — okunmaz olurdu.
    const ys = ctx.yazi.map((w) => w.y).sort((a, b) => a - b);
    for (let i = 1; i < ys.length; i++) {
      expect(ys[i] - ys[i - 1]).toBeGreaterThanOrEqual(VE_TR.NAME_LINE_H);
    }
  });
});
