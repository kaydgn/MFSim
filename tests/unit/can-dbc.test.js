/**
 * can-dbc.test.js — CAN Çözümleyici, DBC ayrıştırıcısı
 * ────────────────────────────────────────────────────
 * candbc/ AYRI bir programdır (bkz. candbc/README.md). Ayrıştırıcının hata
 * sınıfı sessizdir: yanlış okunan bir çarpan programı durdurmaz, yalnız
 * yanlış bir eğri çizer. Kapı bu yüzden gerçek DBC söz diziminin kenarlarına
 * bakıyor — çoklama, değer tabloları, çok satıra yayılan açıklama, tırnak
 * içindeki noktalı virgül.
 */
eval(loadCanSource('can-dbc.js'));

const DBC = `VERSION "deneme"

NS_ :
    BA_
    CM_

BS_:

BU_: MOTOR SANZIMAN GOSTERGE

BO_ 2364540158 EEC1: 8 MOTOR
 SG_ MotorDevri : 24|16@1+ (0.125,0) [0|8031.875] "rpm"  GOSTERGE
 SG_ SurucuTalebi : 0|8@1+ (1,-125) [-125|125] "%"  GOSTERGE
 SG_ MotorSicakligi : 16|8@1- (1,0) [-128|127] "degC"  GOSTERGE

BO_ 256 Durum: 4 SANZIMAN
 SG_ Vites M : 0|4@1+ (1,0) [0|15] ""  GOSTERGE
 SG_ Basinc m0 : 8|16@1+ (0.1,0) [0|6553.5] "bar"  GOSTERGE
 SG_ Hata m1 : 8|16@1+ (1,0) [0|65535] ""  GOSTERGE
 SG_ MotorolaOlcum : 23|16@0+ (1,0) [0|65535] "Nm"  GOSTERGE

CM_ SG_ 256 Vites "Secili vites;
ikinci satirda devam eden aciklama";
CM_ BO_ 256 "Sanziman durum mesaji";

VAL_ 256 Vites 0 "Bos" 1 "Birinci" 2 "Ikinci" 15 "Hata; bilinmiyor" ;

BA_ "GenMsgCycleTime" BO_ 256 20;
SIG_VALTYPE_ 2364540158 MotorSicakligi : 0;
`;

describe('cdbParseDbc — mesaj ve sinyal okuma', () => {
  const db = cdbParseDbc(DBC);

  test('sürüm, düğümler ve mesaj sayısı', () => {
    expect(db.version).toBe('deneme');
    expect(db.nodes).toEqual(['MOTOR', 'SANZIMAN', 'GOSTERGE']);
    expect(db.messages).toHaveLength(2);
  });

  test('uzatılmış kimlik 31. bitten çözülür, ham kimlik saklanır', () => {
    const eec1 = db.messages[0];
    expect(eec1.name).toBe('EEC1');
    expect(eec1.rawId).toBe(2364540158);
    expect(eec1.extended).toBe(true);
    expect(eec1.id).toBe(0x0CF004FE);
    expect(cdbFmtId(eec1.id, true)).toBe('0x0CF004FE');
  });

  test('standart kimlik uzatılmış işaretlenmez', () => {
    const st = db.byKey[cdbMsgKey(256, false)];
    expect(st).toBeDefined();
    expect(st.extended).toBe(false);
    expect(st.dlc).toBe(4);
    expect(cdbFmtId(256, false)).toBe('0x100');
  });

  test('sinyal alanları: başlangıç, uzunluk, düzen, işaret, çarpan, birim', () => {
    const rpm = db.messages[0].sigByName['MotorDevri'];
    expect(rpm.startBit).toBe(24);
    expect(rpm.length).toBe(16);
    expect(rpm.littleEndian).toBe(true);
    expect(rpm.signed).toBe(false);
    expect(rpm.factor).toBe(0.125);
    expect(rpm.offset).toBe(0);
    expect(rpm.unit).toBe('rpm');
    expect(rpm.receivers).toEqual(['GOSTERGE']);
  });

  test('negatif ofset ve işaretli sinyal', () => {
    expect(db.messages[0].sigByName['SurucuTalebi'].offset).toBe(-125);
    expect(db.messages[0].sigByName['MotorSicakligi'].signed).toBe(true);
  });

  test('Motorola sinyali @0 ile işaretlenir', () => {
    const m = db.byKey[cdbMsgKey(256, false)].sigByName['MotorolaOlcum'];
    expect(m.littleEndian).toBe(false);
  });
});

describe('cdbParseDbc — çoklama', () => {
  const db = cdbParseDbc(DBC);
  const st = db.byKey[cdbMsgKey(256, false)];

  test('çoklayıcı ve çoklanmış sinyaller ayrışır', () => {
    expect(st.sigByName['Vites'].isMuxor).toBe(true);
    expect(st.sigByName['Vites'].muxValue).toBe(null);
    expect(st.sigByName['Basinc'].muxValue).toBe(0);
    expect(st.sigByName['Hata'].muxValue).toBe(1);
    expect(st.sigByName['MotorolaOlcum'].muxValue).toBe(null);
  });

  test('mesajın çoklayıcısı bulunur', () => {
    expect(st.multiplexed).toBe(true);
    expect(st.muxor).toBe(st.sigByName['Vites']);
  });

  test('çoklayıcısı olmayan mesajda çoklanmış sinyal UYARI üretir', () => {
    const bad = cdbParseDbc('BO_ 100 M: 8 X\n SG_ A m1 : 0|8@1+ (1,0) [0|255] "" X\n');
    expect(bad.warnings.some(w => /çoklayıcı/.test(w.text))).toBe(true);
  });
});

describe('cdbParseDbc — VAL_ ve CM_ (tırnak içindeki ; ve satır sonu)', () => {
  const db = cdbParseDbc(DBC);
  const st = db.byKey[cdbMsgKey(256, false)];

  test('değer tablosu okunur; metindeki noktalı virgül deyimi bölmez', () => {
    expect(st.sigByName['Vites'].values[0]).toBe('Bos');
    expect(st.sigByName['Vites'].values[2]).toBe('Ikinci');
    expect(st.sigByName['Vites'].values[15]).toBe('Hata; bilinmiyor');
  });

  test('açıklama iki satıra yayılsa da bütün olarak alınır', () => {
    expect(st.sigByName['Vites'].comment).toContain('Secili vites');
    expect(st.sigByName['Vites'].comment).toContain('ikinci satirda');
    expect(st.comment).toBe('Sanziman durum mesaji');
  });

  test('çevrim süresi BA_ ile gelir; bildirilmeyen mesajda null KALIR', () => {
    expect(st.cycleTime).toBe(20);
    expect(db.messages[0].cycleTime).toBe(null);
  });
});

describe('cdbIndexOfUnquoted — tırnak bilen arama', () => {
  test('tırnak içindeki karakter sayılmaz', () => {
    expect(cdbIndexOfUnquoted('a"b;c";d', ';')).toBe(6);
    expect(cdbIndexOfUnquoted('a;b', ';')).toBe(1);
    expect(cdbIndexOfUnquoted('"hepsi;tirnakta"', ';')).toBe(-1);
  });
});

describe('cdbSignalTopBit — kare sınırı denetimi', () => {
  test('Intel sinyalin üst biti', () => {
    expect(cdbSignalTopBit({ startBit: 24, length: 16, littleEndian: true })).toBe(40);
  });
  test('Motorola sinyalin üst biti bayt bayt aşağı iner', () => {
    // 7. bitten başlayan 16 bitlik Motorola sinyali 0. ve 1. baytı kaplar.
    expect(cdbSignalTopBit({ startBit: 7, length: 16, littleEndian: false })).toBe(16);
    expect(cdbSignalTopBit({ startBit: 23, length: 16, littleEndian: false })).toBe(32);
  });
  test('kare sınırını aşan sinyal uyarı üretir', () => {
    const db = cdbParseDbc('BO_ 100 M: 2 X\n SG_ A : 0|32@1+ (1,0) [0|0] "" X\n');
    expect(db.warnings.some(w => /bite kadar uzanıyor/.test(w.text))).toBe(true);
  });
});

describe('cdbParseDbc — bozuk girdi sessiz kalmaz', () => {
  test('okunamayan SG_ satırı uyarı listesine düşer', () => {
    const db = cdbParseDbc('BO_ 100 M: 8 X\n SG_ Bozuk : bu bir sinyal degil\n');
    expect(db.messages[0].signals).toHaveLength(0);
    expect(db.warnings.some(w => /SG_ satırı okunamadı/.test(w.text))).toBe(true);
  });

  test('aynı kimliği kullanan iki mesaj uyarı üretir', () => {
    const db = cdbParseDbc('BO_ 100 A: 8 X\nBO_ 100 B: 8 X\n');
    expect(db.warnings.some(w => /Kimlik çakışması/.test(w.text))).toBe(true);
  });

  test('boş girdi patlamaz', () => {
    expect(cdbParseDbc('').messages).toHaveLength(0);
    expect(cdbParseDbc(null).warnings.length).toBeGreaterThan(0);
  });
});
