// ═══════════════════════════════════════════════════════════════════════════
// ÖRNEK VERİ — üretilmiş gösteri veritabanı + kaydı
// ═══════════════════════════════════════════════════════════════════════════
//
// GERÇEK BİR ARAÇ KAYDI DEĞİLDİR ve arayüzde de öyle sunulmaz. İşi tek:
// programı ilk açan kişi elinde dosya olmadan da bütün akışı görebilsin.
// Kayıt burada ÜRETİLİYOR (dosyaya gömülü ham metin değil) — böylece tek
// dosyanın boyutuna birkaç yüz KB'lık ölü metin eklenmiyor.
//
// Veritabanı J1939 alışkanlıklarını izler (uzatılmış kimlik, ölçekli sinyal,
// −40 °C ofseti, çoklanmış durum mesajı) ama uydurma bir PGN kümesidir.

var CDB_EXAMPLE_DBC = [
'VERSION "MFSim CAN Cozumleyici — ornek"',
'',
'NS_ :',
'    CM_',
'    BA_',
'    VAL_',
'',
'BS_:',
'',
'BU_: MOTOR SANZIMAN GOSTERGE FREN',
'',
'BO_ 2364540158 EEC1: 8 MOTOR',
' SG_ MotorDevri : 24|16@1+ (0.125,0) [0|8031.875] "rpm"  GOSTERGE',
' SG_ SurucuTalebi : 8|8@1+ (1,-125) [-125|125] "%"  GOSTERGE',
' SG_ GercekTork : 16|8@1+ (1,-125) [-125|125] "%"  GOSTERGE',
' SG_ MotorDurumu : 0|4@1+ (1,0) [0|15] ""  GOSTERGE',
'',
'BO_ 2566843904 ET1: 8 MOTOR',
' SG_ SogutucuSicakligi : 0|8@1+ (1,-40) [-40|210] "degC"  GOSTERGE',
' SG_ YakitSicakligi : 8|8@1+ (1,-40) [-40|210] "degC"  GOSTERGE',
' SG_ YagSicakligi : 16|16@1+ (0.03125,-273) [-273|1735] "degC"  GOSTERGE',
'',
'BO_ 2566844673 CCVS: 8 FREN',
' SG_ AracHizi : 8|16@1+ (0.00390625,0) [0|250.996] "km/h"  GOSTERGE',
' SG_ FrenPedali : 4|2@1+ (1,0) [0|3] ""  GOSTERGE',
' SG_ HizSabitleyici : 0|2@1+ (1,0) [0|3] ""  GOSTERGE',
'',
'BO_ 256 SanzimanDurumu: 4 SANZIMAN',
' SG_ SayfaNo M : 0|2@1+ (1,0) [0|3] ""  GOSTERGE',
' SG_ Vites : 2|4@1+ (1,0) [0|15] ""  GOSTERGE',
' SG_ HatBasinci m0 : 8|16@1+ (0.1,0) [0|6553.5] "bar"  GOSTERGE',
' SG_ HataKodu m1 : 8|16@1+ (1,0) [0|65535] ""  GOSTERGE',
'',
'BO_ 512 MotorolaOrnegi: 4 MOTOR',
' SG_ BuyukUcluDeger : 7|16@0- (0.1,0) [-3276.8|3276.7] "Nm"  GOSTERGE',
' SG_ Bayrak : 23|1@0+ (1,0) [0|1] ""  GOSTERGE',
'',
'CM_ BO_ 256 "Sanziman durumu — SayfaNo coklayicisiyla iki farkli yuk tasiyor";',
'CM_ SG_ 512 BuyukUcluDeger "Motorola (@0) duzenli, isaretli sinyal — bit duzeni kapisi";',
'',
'VAL_ 256 Vites 0 "Bos" 1 "1. vites" 2 "2. vites" 3 "3. vites" 4 "4. vites" 5 "5. vites" 14 "Geri" 15 "Hata" ;',
'VAL_ 2364540158 MotorDurumu 0 "Durdu" 1 "Mars" 2 "Rolanti" 3 "Calisiyor" ;',
'VAL_ 2566844673 FrenPedali 0 "Serbest" 1 "Basili" 2 "Hata" 3 "Yok" ;',
'',
'BA_ "GenMsgCycleTime" BO_ 2364540158 20;',
'BA_ "GenMsgCycleTime" BO_ 2566843904 500;',
'BA_ "GenMsgCycleTime" BO_ 2566844673 100;',
'BA_ "GenMsgCycleTime" BO_ 256 100;',
''
].join('\n');

// Sinyali HAM değere çevirip kareye yazan yardımcı (yalnız Intel + Motorola
// 16 bit; örnek veritabanının ihtiyacı bu kadar).
function cdbExPutLE(bytes, startBit, len, raw) {
  raw = Math.round(raw);
  for (var i = 0; i < len; i++) {
    var bp = startBit + i;
    if ((raw >> i) & 1) bytes[bp >> 3] |= (1 << (bp & 7));
  }
}

function cdbExPutBE(bytes, startBit, len, raw) {
  raw = Math.round(raw);
  var pos = startBit;
  for (var i = 0; i < len; i++) {
    var bit = (raw >> (len - 1 - i)) & 1;
    if (bit) bytes[pos >> 3] |= (1 << (pos & 7));
    pos = ((pos & 7) === 0) ? pos + 15 : pos - 1;
  }
}

function cdbExFrame(t, id, ext, bytes) {
  var hex = '';
  for (var i = 0; i < bytes.length; i++) {
    var h = (bytes[i] & 0xFF).toString(16).toUpperCase();
    hex += h.length < 2 ? '0' + h : h;
  }
  var idh = (id >>> 0).toString(16).toUpperCase();
  var w = ext ? 8 : 3;
  while (idh.length < w) idh = '0' + idh;
  return { t: t, line: '(' + t.toFixed(6) + ') can0 ' + idh + '#' + hex };
}

/**
 * 40 saniyelik bir hızlanma–sabit hız–yavaşlama çevrimi üretir.
 * Değerler bir modelden değil, okunaklı bir eğri olsun diye seçilmiştir.
 */
function cdbMakeExampleLog() {
  var out = [];
  var T = 40;

  // Sürücü profili: rölanti → hızlanma → sabit → yavaşlama → rölanti
  function profil(t) {
    var pedal, hiz, devir, vites;
    if (t < 3)        { pedal = 0;  hiz = 0; }
    else if (t < 18)  { pedal = 78; hiz = (t - 3) / 15 * 82; }
    else if (t < 28)  { pedal = 28; hiz = 82 + Math.sin((t - 18) * 1.1) * 1.6; }
    else if (t < 36)  { pedal = 0;  hiz = Math.max(0, 82 - (t - 28) / 8 * 82); }
    else              { pedal = 0;  hiz = 0; }

    // Vites bandı: her viteste devir 1050'den 2380'e tırmanır, vites değişince
    // aşağı düşer — motor devrinin bilinen testere dişi deseni.
    var bant = [[0, 1], [1, 14], [14, 28], [28, 45], [45, 66], [66, 95]];
    vites = hiz < 1 ? 0 : hiz < 14 ? 1 : hiz < 28 ? 2 : hiz < 45 ? 3 : hiz < 66 ? 4 : 5;
    if (vites === 0) {
      devir = 720 + Math.sin(t * 7) * 18;                           // rölanti dalgalanması
    } else {
      var lo = bant[vites][0], hi = bant[vites][1];
      devir = 1050 + (hiz - lo) / (hi - lo) * (2380 - 1050) + Math.sin(t * 11) * 12;
    }
    return { pedal: pedal, hiz: hiz, devir: devir, vites: vites };
  }

  // EEC1 — 20 ms
  for (var t = 0; t < T; t += 0.02) {
    var p = profil(t);
    var b = [0, 0, 0, 0, 0, 0, 0, 0];
    cdbExPutLE(b, 0, 4, p.vites === 0 && p.devir < 900 ? 2 : 3);    // MotorDurumu
    cdbExPutLE(b, 8, 8, p.pedal + 125);                             // SurucuTalebi
    cdbExPutLE(b, 16, 8, Math.min(125, p.pedal * 0.9) + 125);       // GercekTork
    cdbExPutLE(b, 24, 16, p.devir / 0.125);                         // MotorDevri
    out.push(cdbExFrame(t, 0x0CF004FE, true, b));
  }
  // CCVS — 100 ms
  for (var t2 = 0.005; t2 < T; t2 += 0.1) {
    var p2 = profil(t2);
    var c = [0, 0, 0, 0, 0, 0, 0, 0];
    cdbExPutLE(c, 0, 2, 0);
    cdbExPutLE(c, 4, 2, (t2 >= 28 && t2 < 36) ? 1 : 0);             // FrenPedali
    cdbExPutLE(c, 8, 16, p2.hiz / 0.00390625);
    out.push(cdbExFrame(t2, 0x18FEF101, true, c));
  }
  // ET1 — 500 ms: soğutucu 74 °C'den 91 °C'ye ısınır
  for (var t3 = 0.01; t3 < T; t3 += 0.5) {
    var e = [0, 0, 0, 0, 0, 0, 0, 0];
    var su = 74 + (1 - Math.exp(-t3 / 22)) * 17;
    cdbExPutLE(e, 0, 8, su + 40);
    cdbExPutLE(e, 8, 8, 31 + t3 * 0.06 + 40);
    cdbExPutLE(e, 16, 16, (su + 14 + 273) / 0.03125);
    out.push(cdbExFrame(t3, 0x18FEEE00, true, e));
  }
  // SanzimanDurumu — 100 ms, çoklayıcı dönüşümlü (mux 0 basınç / mux 1 hata)
  var muxTog = 0;
  for (var t4 = 0.05; t4 < T; t4 += 0.1) {
    var p4 = profil(t4);
    var d = [0, 0, 0, 0];
    cdbExPutLE(d, 0, 2, muxTog);                                            // SayfaNo (çoklayıcı)
    cdbExPutLE(d, 2, 4, p4.vites);                                          // her karede geçerli
    if (muxTog === 0) cdbExPutLE(d, 8, 16, (11 + p4.devir / 400) / 0.1);    // HatBasinci [bar]
    else              cdbExPutLE(d, 8, 16, (t4 > 24 && t4 < 27) ? 519 : 0); // HataKodu
    out.push(cdbExFrame(t4, 0x100, false, d));
    muxTog = 1 - muxTog;
  }
  // MotorolaOrnegi — 200 ms: işaretli, big-endian, negatife inen bir tork
  for (var t5 = 0.07; t5 < T; t5 += 0.2) {
    var p5 = profil(t5);
    var m = [0, 0, 0, 0];
    var tork = (p5.pedal > 10 ? p5.pedal * 9 : -70 - p5.hiz * 1.2);
    var rawT = Math.round(tork / 0.1);
    if (rawT < 0) rawT += 65536;                                    // iki tümleyen
    cdbExPutBE(m, 7, 16, rawT);
    cdbExPutBE(m, 23, 1, p5.hiz > 40 ? 1 : 0);
    out.push(cdbExFrame(t5, 0x200, false, m));
  }
  // Kayıt dosyaları zaman sırasındadır; üretilen kareler de öyle olsun.
  out.sort(function(a, b) { return a.t - b.t; });
  var lines = ['# MFSim CAN Cozumleyici — URETILMIS ornek kayit (gercek arac verisi degildir)'];
  for (var i = 0; i < out.length; i++) lines.push(out[i].line);
  return lines.join('\n') + '\n';
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    CDB_EXAMPLE_DBC: CDB_EXAMPLE_DBC,
    cdbMakeExampleLog: cdbMakeExampleLog,
    cdbExPutLE: cdbExPutLE,
    cdbExPutBE: cdbExPutBE
  };
}
