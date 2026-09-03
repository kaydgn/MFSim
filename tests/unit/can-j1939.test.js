/**
 * can-j1939.test.js — CAN Çözümleyici, J1939 kimlik çözümü ve kanal eşleştirmesi
 * ─────────────────────────────────────────────────────────────────────────────
 * BU KAPI GERÇEK BİR ÖLÇÜMDEN DOĞDU. Kullanıcının J1939 veritabanı (950 mesaj)
 * ve gerçek bir araç kaydı (81 ayrı kimlik) karşılaştırıldığında:
 *
 *     tam kimlikle eşleşen ......  1 / 81
 *     J1939 PGN'i ile eşleşen .... 66 / 81
 *
 * Sebebi: DBC mesaj kimliği KAYNAK ADRESİ içerir ve o adres veritabanını
 * yazanın seçimidir. Yani kimliği bire bir karşılaştıran bir çözümleyici
 * gerçek bir J1939 kaydında pratikte HİÇBİR ŞEY çözemez — ama patlamaz da,
 * sadece boş bir ağaç gösterir. Sessiz hata sınıfının ta kendisi.
 */
eval(loadCanSource('can-dbc.js'));
eval(loadCanSource('can-j1939.js'));
eval(loadCanSource('can-log.js'));
eval(loadCanSource('can-match.js'));

describe('cdbJ1939 — 29 bitlik kimliğin alanları', () => {
  test('PDU2 (PF ≥ 240): PS grup uzantısıdır ve PGN\'e GİRER', () => {
    // 0x18FEF100 — CCVS1, öncelik 6, PF 0xFE, PS 0xF1, SA 0x00
    const j = cdbJ1939(0x18FEF100);
    expect(j.prio).toBe(6);
    expect(j.pf).toBe(0xFE);
    expect(j.ps).toBe(0xF1);
    expect(j.sa).toBe(0x00);
    expect(j.pdu1).toBe(false);
    expect(j.da).toBe(null);
    expect(j.pgn).toBe(0xFEF1);          // 65265
  });

  test('PDU1 (PF < 240): PS HEDEF ADRESTİR ve PGN\'e GİRMEZ', () => {
    // Bu ayrım atlanırsa TSC1 gibi adresli mesajlar her hedef için ayrı bir
    // PGN'e düşer ve hiçbiri veritabanında bulunamaz.
    const a = cdbJ1939(0x0C00000B);      // hedef 0x00, kaynak 0x0B
    const b = cdbJ1939(0x0C00100B);      // hedef 0x10, kaynak 0x0B
    expect(a.pdu1).toBe(true);
    expect(a.da).toBe(0x00);
    expect(b.da).toBe(0x10);
    expect(a.pgn).toBe(0);
    expect(b.pgn).toBe(0);               // İKİSİ DE TSC1
    expect(a.sa).toBe(0x0B);
  });

  test('EEC1: 0x0CF00400 → PGN 61444', () => {
    const j = cdbJ1939(0x0CF00400);
    expect(j.pgn).toBe(61444);
    expect(j.sa).toBe(0);
    expect(j.prio).toBe(3);
  });

  test('aynı PGN farklı kaynaklardan gelebilir', () => {
    expect(cdbJ1939(0x0CF00400).pgn).toBe(cdbJ1939(0x0CF004FE).pgn);
    expect(cdbJ1939(0x0CF00400).sa).not.toBe(cdbJ1939(0x0CF004FE).sa);
  });

  test('veri sayfası bitleri PGN\'e girer', () => {
    expect(cdbJ1939(0x18FEF100).pgn).toBe(0x0FEF1);
    expect(cdbJ1939(0x19FEF100).pgn).toBe(0x1FEF1);   // DP = 1
  });

  test('üretici tanımlı (proprietary) PF alanları', () => {
    expect(cdbJ1939Proprietary(0x18FF0634)).toBe(true);   // PF 0xFF — proprietary B
    expect(cdbJ1939Proprietary(0x18EF0034)).toBe(true);   // PF 0xEF — proprietary A
    expect(cdbJ1939Proprietary(0x0CF00400)).toBe(false);
  });

  test('adres biçimi iki hane', () => {
    expect(cdbFmtAddr(0)).toBe('0x00');
    expect(cdbFmtAddr(0x0B)).toBe('0x0B');
    expect(cdbFmtAddr(null)).toBe('—');
  });
});

// ── Kanal eşleştirmesi ─────────────────────────────────────────────────────

// Ham DBC kimliği = 0x80000000 | gerçek kimlik. Sayılar HESAPLANDI, elle
// yazılmadı: örnek veritabanında elle yazılan iki kimlik tutmamış ve iki
// mesaj "tanımsız" görünmüştü.
const DBC = [
  'BO_ 2364540158 EEC1: 8 MOTOR',                    // 0x0CF004FE · PGN 61444 · SA 0xFE
  ' SG_ EngSpeed : 24|16@1+ (0.125,0) [0|8031] "rpm" X',
  'BO_ 2566844673 CCVS1: 8 FREN',                    // 0x18FEF101 · PGN 65265 · SA 0x01
  ' SG_ Hiz : 8|16@1+ (0.00390625,0) [0|250] "km/h" X',
  'BO_ 2566844672 CCVS1_Trip_Recorder: 8 FREN',      // 0x18FEF100 · AYNI PGN, başka SA
  ' SG_ Hiz : 8|16@1+ (0.00390625,0) [0|250] "km/h" X',
  'BO_ 3221225472 VECTOR__INDEPENDENT_SIG_MSG: 8 X', // 0xC0000000 → PGN 0 (kap)
  ' SG_ Sahipsiz : 0|8@1+ (1,0) [0|255] "" X',
  'BO_ 2348810240 TSC1: 8 X',                        // 0x0C000000 · PGN 0 · PDU1
  ' SG_ Talep : 0|8@1+ (1,0) [0|255] "" X',
  ''
].join('\n');

function kayit(cerceveler) {
  const st = cdbNewStore();
  cerceveler.forEach((c, i) =>
    cdbStorePush(st, { t: i * 0.1, id: c[0], ext: true, dlc: 8, bytes: c[1] || [0,0,0,0,0,0,0,0] }));
  return cdbStoreFinalize(st, { relativeTime: false });
}

describe('cdbBuildChannels — eşleştirme sırası', () => {
  const db = cdbParseDbc(DBC);

  test('TAM eşleşme önce gelir', () => {
    const st = kayit([[0x0CF004FE]]);
    const r = cdbBuildChannels(db, st, {});
    expect(r.channels[0].match).toBe('exact');
    expect(r.channels[0].msg.name).toBe('EEC1');
    expect(r.report.exact).toBe(1);
    expect(r.report.pgn).toBe(0);
  });

  test('tam eşleşme yoksa PGN — kaynak adresi yok sayılır', () => {
    // 0x0CF00400: EEC1'in PGN'i ama SA 0x00 (DBC'de 0xFE yazıyor)
    const st = kayit([[0x0CF00400]]);
    const r = cdbBuildChannels(db, st, {});
    expect(r.channels[0].match).toBe('pgn');
    expect(r.channels[0].msg.name).toBe('EEC1');
    expect(r.channels[0].j.sa).toBe(0);
    expect(r.report.pgn).toBe(1);
  });

  test('PGN eşleştirmesi KAPATILABİLİR', () => {
    const st = kayit([[0x0CF00400]]);
    const r = cdbBuildChannels(db, st, { j1939: false });
    expect(r.channels[0].match).toBe(null);
    expect(r.report.unmatched).toBe(1);
  });

  test('Vector\'ün sahipsiz sinyal kabı eşleştirmeye GİRMEZ', () => {
    // VECTOR__INDEPENDENT_SIG_MSG kimliği 0xC0000000 → PGN 0. Eşleştirmeye
    // sokulursa TSC1'in (PGN 0) yerine geçer ve gerçek mesajı gölgeler.
    const st = kayit([[0x0C00000B]]);
    const r = cdbBuildChannels(db, st, {});
    expect(r.channels[0].msg).not.toBe(null);
    expect(r.channels[0].msg.name).not.toBe('VECTOR__INDEPENDENT_SIG_MSG');
  });

  test('eşleşmeyen kanal SESSİZCE ATILMAZ, listede kalır', () => {
    const st = kayit([[0x18FF0634]]);                 // proprietary B
    const r = cdbBuildChannels(db, st, {});
    expect(r.channels).toHaveLength(1);
    expect(r.channels[0].match).toBe(null);
    expect(r.channels[0].msg).toBe(null);
    expect(r.report.unmatched).toBe(1);
    expect(r.report.proprietary).toBe(1);
    expect(r.channels[0].label).toBe(cdbFmtId(0x18FF0634, true));
  });
});

describe('cdbBuildChannels — belirsizlik ve çoklu kaynak', () => {
  const db = cdbParseDbc(DBC);

  test('aynı PGN\'i paylaşan tanımlar RAPORLANIR', () => {
    const st = kayit([[0x18FEF10B]]);                 // CCVS1 PGN'i, SA 0x0B
    const r = cdbBuildChannels(db, st, {});
    expect(r.channels[0].match).toBe('pgn');
    expect(r.report.ambiguous).toHaveLength(1);
    expect(r.report.ambiguous[0].cands.length).toBe(2);
  });

  test('eşit puanda KISA ad kazanır — varyantlar sonek alır', () => {
    const st = kayit([[0x18FEF10B]]);
    const r = cdbBuildChannels(db, st, {});
    expect(r.channels[0].msg.name).toBe('CCVS1');     // _Trip_Recorder değil
  });

  test('adaylar BİREBİR AYNI ise bu söylenir — seçim sayıyı değiştirmez', () => {
    const st = kayit([[0x18FEF10B]]);
    const r = cdbBuildChannels(db, st, {});
    expect(r.report.ambiguous[0].identical).toBe(true);
    expect(cdbSameLayout(db.byKey[cdbMsgKey(0x18FEF101, true)],
                         db.byKey[cdbMsgKey(0x18FEF100, true)])).toBe(true);
  });

  test('yerleşimi farklı adaylar AYNI sayılmaz', () => {
    const d2 = cdbParseDbc(
      'BO_ 2566844673 A: 8 X\n SG_ S : 8|16@1+ (0.1,0) [0|1] "" X\n' +
      'BO_ 2566844672 B: 8 X\n SG_ S : 8|16@1+ (0.5,0) [0|1] "" X\n');   // çarpan farklı
    expect(cdbSameLayout(d2.messages[0], d2.messages[1])).toBe(false);
  });

  test('aynı mesajı iki kaynak gönderiyorsa BİRLEŞTİRİLMEZ, iki kanal olur', () => {
    // Tek eğriye toplamak ayrı ECU'ların değerlerini karıştırmak olurdu.
    const st = kayit([[0x0CF00400], [0x0CF00411], [0x0CF00400]]);
    const r = cdbBuildChannels(db, st, {});
    const eec1 = r.channels.filter(c => c.msg && c.msg.name === 'EEC1');
    expect(eec1).toHaveLength(2);
    expect(r.report.multiSource).toHaveLength(1);
    expect(r.report.multiSource[0].name).toBe('EEC1');
    // Etiket kaynak adresini TAŞIR — yoksa ağaçta ayırt edilemezler
    expect(eec1.map(c => c.label).sort()).toEqual(['EEC1 · SA 0x00', 'EEC1 · SA 0x11']);
    // Kare sayıları ayrı sayılır
    expect(eec1.filter(c => c.j.sa === 0)[0].count).toBe(2);
    expect(eec1.filter(c => c.j.sa === 0x11)[0].count).toBe(1);
  });

  test('sıra: çözülenler önce, sonra çok kare gönderen', () => {
    const st = kayit([[0x18FF0634], [0x18FF0634], [0x18FF0634], [0x0CF00400]]);
    const r = cdbBuildChannels(db, st, {});
    expect(r.channels[0].msg).not.toBe(null);         // az kareli ama çözülen
    expect(r.channels[1].msg).toBe(null);
  });

  test('DBC yoksa kanallar yine kurulur, hepsi tanımsız', () => {
    const st = kayit([[0x0CF00400]]);
    const r = cdbBuildChannels(null, st, {});
    expect(r.channels).toHaveLength(1);
    expect(r.channels[0].match).toBe(null);
    expect(r.report.unmatched).toBe(1);
  });

  test('kayıt yoksa boş sonuç, patlamaz', () => {
    const r = cdbBuildChannels(db, null, {});
    expect(r.channels).toEqual([]);
    expect(r.report.total).toBe(0);
  });
});

describe('kanal ipucu — eşleşmenin NASIL kurulduğunu söyler', () => {
  const db = cdbParseDbc(DBC);
  test('PGN eşleşmesinde varsayım açıkça yazılır', () => {
    const st = kayit([[0x0CF00400]]);
    const ch = cdbBuildChannels(db, st, {}).channels[0];
    const t = cdbChannelTitle(ch);
    expect(t).toContain('PGN 61444');
    expect(t).toContain('kaynak adresi yok sayıldı');
    expect(t).toContain('EEC1');
  });
  test('tanımsız kanalda sebep yazılır', () => {
    const st = kayit([[0x18FF0634]]);
    const ch = cdbBuildChannels(db, st, {}).channels[0];
    expect(cdbChannelTitle(ch)).toContain('tanımlamıyor');
    expect(cdbChannelTitle(ch)).toContain('proprietary');
  });
});
