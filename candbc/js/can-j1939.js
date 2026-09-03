// ═══════════════════════════════════════════════════════════════════════════
// J1939 KİMLİK ÇÖZÜMÜ — 29 bitlik kimlikten PGN çıkarma
// ═══════════════════════════════════════════════════════════════════════════
//
// DOM'suz saf modül.
//
// ── NEDEN GEREKLİ ────────────────────────────────────────────────────────
// Bir J1939 DBC'sindeki mesaj kimliği KAYNAK ADRESİ İÇERİR ve o adres,
// veritabanını yazan kişinin seçtiği rastgele bir değerdir. Gerçek otobüste
// aynı mesaj başka bir adresten gelir. Ölçüldü (kullanıcının kaydı, 81 ayrı
// kimlik):
//
//     tam kimlikle eşleşen ....... 1 / 81
//     J1939 PGN'i ile eşleşen .... 66 / 81
//
// Yani kimliği bire bir karşılaştıran bir çözümleyici, gerçek bir J1939
// kaydında pratikte HİÇBİR ŞEY çözemez. Eşleştirme PGN üzerinden yapılmak
// zorunda — ama bu KÖRÜ KÖRÜNE değil, söylenerek yapılır: hangi mesajın hangi
// kimliğe hangi yolla bağlandığı Tanı sekmesinde yazılıdır.
//
// ── 29 BİTLİK KİMLİĞİN YAPISI ────────────────────────────────────────────
//   28..26  öncelik (prio)
//   25      EDP — genişletilmiş veri sayfası
//   24      DP  — veri sayfası
//   23..16  PF  — PDU biçimi
//   15..8   PS  — PF < 240 ise HEDEF ADRES, PF >= 240 ise grup uzantısı
//   7..0    SA  — kaynak adresi
//
// PGN, PF < 240 (PDU1) olduğunda PS'yi İÇERMEZ: o durumda PS hedef adrestir
// ve mesajın kimliğinin parçası değildir. PDU2'de (PF >= 240) PS grup
// uzantısıdır ve PGN'e girer. Bu ayrım atlanırsa TSC1 gibi adresli mesajlar
// her hedef için ayrı bir PGN'e düşer ve hiçbiri veritabanında bulunamaz.

function cdbJ1939(id) {
  id = id >>> 0;
  var sa  = id & 0xFF;
  var ps  = (id >>> 8) & 0xFF;
  var pf  = (id >>> 16) & 0xFF;
  var dp  = (id >>> 24) & 1;
  var edp = (id >>> 25) & 1;
  var prio = (id >>> 26) & 7;
  var pdu1 = pf < 240;
  var pgn = (edp << 17) | (dp << 16) | (pf << 8) | (pdu1 ? 0 : ps);
  return {
    prio: prio, edp: edp, dp: dp, pf: pf, ps: ps, sa: sa,
    da: pdu1 ? ps : null,      // hedef adres yalnız PDU1'de vardır
    pgn: pgn >>> 0, pdu1: pdu1
  };
}

// Üretici tanımlı (proprietary) PGN mi? PF 0xEF (PDU1, proprietary A) ve
// 0xFF (PDU2, proprietary B) standartta tanımsızdır; içeriği üreticiye aittir.
// Eşleşmeyen bir kimlik burada işaretlenirse kullanıcı "DBC eksik" ile
// "bu zaten standart dışı" arasını ayırabilir.
function cdbJ1939Proprietary(id) {
  var pf = (id >>> 16) & 0xFF;
  return pf === 0xEF || pf === 0xFF;
}

// PGN'in okunur biçimi: onluk (standartlarda böyle anılır) + onaltılık.
function cdbFmtPgn(pgn) {
  return pgn + ' (0x' + (pgn >>> 0).toString(16).toUpperCase() + ')';
}

function cdbFmtAddr(a) {
  if (a === null || a === undefined) return '—';
  var h = (a & 0xFF).toString(16).toUpperCase();
  return '0x' + (h.length < 2 ? '0' + h : h);
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    cdbJ1939: cdbJ1939,
    cdbJ1939Proprietary: cdbJ1939Proprietary,
    cdbFmtPgn: cdbFmtPgn,
    cdbFmtAddr: cdbFmtAddr
  };
}
