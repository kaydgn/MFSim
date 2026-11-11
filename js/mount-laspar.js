// ═══════════════════════════════════════════════════════════════════════════
// TAKOZ — LASPAR TAKOZ VERİTABANI (DOM'suz saf veri)
// ═══════════════════════════════════════════════════════════════════════════
// LASPAR (Bursa; kauçuk–metal titreşim takozları, 1982) — programdaki TK035 · TK040 ·
// TK050 takozlarının üreticisi (kullanıcı 2026-11-11: "Bu takozların marka-model vs
// bulup, bu markadan başka ne takoz bulabiliyorsan ekleyebilir misin?").
//
// KİMLİK: LASPAR'ın kod kuralı "LMT-xxxx-yy-TKnn" — TKnn kauçuğun Shore A sertliği
// (katalog: LMT-1433-00-TK45 · 45 ShA); "MLMT" aynı gövdenin başka bağlantılı çeşidi
// (katalog: MLMT-0608-04 ↔ LMT-0608-04, saplama yerine dişli göbek). Programın TK
// takozlarının kaynağı "MLMT-0216-33-TK035 / TK040 / TK050" test raporları → LASPAR'ın
// MLMT-0216-33 takozunun üç sertliği (katalogda yok: müşteriye özel motor takozu; rapor
// depoda yok, değerleri değiştirilmedi). LMT-1433-00 katalogda: Endüstriyel Konik
// Takoz 1433 — BMC FEA raporundaki flanş (107 × 90, delik 80 × 65) birebir; FEA'nın
// Z'si katalogla uyumlu (40 ShA 450 ↔ TK45 451 · 55 ShA 750 ↔ TK60 701 · 70 ShA 1.150 ↔
// TK70 1.091 N/mm). Angst+Pfister'in Bursa şirketi 2012'de LASPAR'la ortak girişim:
// raporların çizimindeki A+P logosu bununla uyumlu; LMT-1433-00 A+P konik yatak
// 026 S 1'in ölçüsünde (js/mount-ap.js → ESLES).
//
// KAYNAK: LASPAR genel kataloğu 2018 (laspargroup.com → Kataloglarımız; "Laspar Genel
// Katalog -2018"), anti-vibrasyon bölümü. Tablo: sertlik, en büyük yük F (N) ve W (kg),
// o yükteki sehim S (mm); grafikler "eksenel basma karakteristikleri" (vektör, ölçüldü).
// Güç grubunu taşıyabilen beş aile alındı — 17 tip, 43 kod:
//   • konik  — Endüstriyel Konik Takoz (s. 52–53): 1423 · 1436 · 1433 · 1435 · 1434 ·
//     1881 × TK45/60/70. kz = F/S; grafiğin çizgisi orijinden tablonun noktasına
//     (18/18, fark < %0,3).
//   • mobil  — Üniversal Mobil Takoz (s. 34–35): 608 · 609 · 610, LMT (ayar saplamalı)
//     ve MLMT çeşidi × TK45/55/65. Tabloda sehim YOK: kz grafiğin eğimi (çizgi çalışma
//     aralığında doğrusal, 1,3–5,9 mm; orijinden geçmiyor) — iki çeşit aynı gövde, aynı
//     grafik.
//   • kabin  — Kabin Takozu (s. 54): 0154 · 0502. AYRIŞMA: tablonun "F (N)" sütununda
//     918 · 204, "W (kg)" sütununda 9 · 2 yazıyor; grafik 2,1 mm'de 919 kg, 6,1 mm'de
//     204 kg gösteriyor → F sütunu kg, W sütunu kN (alındı: 918 · 204 kg).
//   • sok    — Darbe Emici Şok Takozu (s. 48): 1880 · 1875 × TK45/60. kz = F/S; grafik
//     tutuyor (4/4).
//   • temel  — Temel Şok Takozu (s. 50): 1887, NR50. Tabloda F "31" (kN), W 3.130 kg,
//     S 7,5 mm; grafik 7,5 mm'de 3.142 kg. F = W·g alındı.
// ALINMAYANLAR: dairesel takozlar (A–E · VTT), makine ayakları (1443–1446), raylar,
// sandviç takozlar (1848 · 1849 · 1886 — titreşimli elek, kırıcı), destek takozları
// (1876–1884), askı tipi (1255 · 1412 · 1424), pullar — cihaz ve makine elemanı, güç
// grubu takozu değil. Marine kataloğu (52 MB) herkese açık değil. DirectIndustry'de
// görünen 1423-20 · 1433-20 · 1436-20 · 1449-00 çeşitlerinin verisi yok.
//
// RİJİTLİK [N/mm]: yalnız eksenel (Z) yayımlanıyor. RADYAL: konik ailede LMT-1433-00'ın
// FEA oranı (kx = ky = oran · kz; 40 ShA 2,0 · 55 ShA 2,0 · 70 ShA 2,17, sertliğe göre
// doğrusal, dışında en yakınınki) — Canlı Not 113'ün kuralı: TAHMİNİ, işaretli. Öteki
// ailelerde radyalin ölçülmüş benzeri yok → tip eksik, Takoz Özellikleri'nden girilir.
// DİNAMİK yayımlanmıyor: statik × (Sh+20)/50 (AMC'nin NR konilerinde ölçtüğü yasa,
// js/mount-amc.js; A+P ile aynı) — tahmini. Kapasite = W (kg). Tahminli tip çözülür,
// taramaya aday olmaz. Kapı: tests/unit/mount-laspar.test.js.
//
// ANAHTAR 'lp-' + kodun küçük harfi ('lp-lmt-1433-00-tk60') — DEĞİŞMEZ. Ad: "<ürün>
// <tip> <sertlik> ShA (LASPAR <kod>)".
// ═══════════════════════════════════════════════════════════════════════════

var VE_MNT_LASPAR = (function() {
  'use strict';
  var MARKA = 'LASPAR';
  var G = 9.81;
  // aile → [üreticinin aile adı, adın öneki, katalog sayfası (basılı)]
  var AILE = {
    konik: ['Industrial Conical Mounts', 'Conical mount', 52],
    mobil: ['Universal Mobile Mounts', 'Universal mobile mount', 34],
    kabin: ['Cabin Mounts', 'Cabin mount', 54],
    sok:   ['Heavy Duty Shock Mounts', 'Heavy duty shock mount', 48],
    temel: ['Foundation Mounts', 'Foundation mount', 50]
  };
  var AILE_SIRA = ['konik', 'mobil', 'kabin', 'sok', 'temel'];
  // tip → [aile, tip adı, çizim, ölçüler mm]
  //   ölçüler: boy × en (flanş) · delik aralığı (boy × en) · delik Ø · yükseklik · dış Ø · diş
  var TIP = {
    '1423': ['konik', '1423', 'k-1423-1436', { boy: 84, en: 50, dBoy: 64, dCap: 6.5, yuk: 27.5 }],
    '1436': ['konik', '1436', 'k-1423-1436', { boy: 106, en: 68, dBoy: 80, dCap: 11, yuk: 51 }],
    '1433': ['konik', '1433', 'k-1433', { boy: 107, en: 90, dBoy: 80, dEn: 65, dCap: 11, yuk: 56 }],
    '1435': ['konik', '1435', 'k-1433', { boy: 120, en: 100, dBoy: 90, dEn: 74, dCap: 11, yuk: 81 }],
    '1434': ['konik', '1434', 'k-1433', { boy: 140, en: 120, dBoy: 112, dEn: 92, dCap: 11, yuk: 95 }],
    '1881': ['konik', '1881', 'k-1881', { boy: 122, en: 122, dBoy: 100, dEn: 100, dCap: 11, yuk: 128 }],
    'M608': ['mobil', '608', 'm-mlmt', { boy: 100, en: 60, dBoy: 60, yuk: 38, dis: 'M12' }],
    'L608': ['mobil', '608', 'm-lmt', { boy: 100, en: 60, dBoy: 60, yuk: 38, dis: 'M12' }],
    'M609': ['mobil', '609', 'm-mlmt', { boy: 140, en: 75, dBoy: 75, yuk: 50, dis: 'M16' }],
    'L609': ['mobil', '609', 'm-lmt', { boy: 140, en: 75, dBoy: 75, yuk: 50, dis: 'M16' }],
    'M610': ['mobil', '610', 'm-mlmt', { boy: 182, en: 112, dBoy: 112, yuk: 70, dis: 'M20' }],
    'L610': ['mobil', '610', 'm-lmt', { boy: 182, en: 112, dBoy: 112, yuk: 70, dis: 'M20' }],
    '0154': ['kabin', '0154', 'c-0154', { cap: 120, yuk: 64, ic: 20 }],
    '0502': ['kabin', '0502', 'c-0502', { boy: 146, en: 106, dBoy: 120, dCap: 12, yuk: 64, ic: 24 }],
    '1880': ['sok', '1880', 's-1880-1875', { boy: 150, en: 150, dBoy: 114, dEn: 114, dCap: 9, yuk: 97.5, dis: 'M16' }],
    '1875': ['sok', '1875', 's-1880-1875', { boy: 165, en: 165, dBoy: 140, dEn: 140, dCap: 13, yuk: 125.5, dis: 'M16' }],
    '1887': ['temel', '1887', 't-1887', { boy: 249, en: 224, dBoy: 205, dEn: 182, dCap: 22, yuk: 175, cap: 180 }]
  };
  // Tiplerin sırası (katalogun sırası). Nesnenin anahtar sırası kullanılmaz: JS sayıya benzeyen
  // anahtarları ('1423', '1880') öne alır, '0154'ü ve 'M608'i almaz.
  var TIP_SIRA = ['1423', '1436', '1433', '1435', '1434', '1881', 'M608', 'L608', 'M609', 'L609', 'M610', 'L610',
    '0154', '0502', '1880', '1875', '1887'];
  // kod → [tip, sertlik ShA, F (N), W (kg), S (mm; mobilde tabloda yok)] — katalogun tablosu
  // (kabinde ve temelde F = W·g: tablonun F sütunu orada kg ve kN yazıyor, yukarıda).
  var KOD = {
    'LMT-1423-00-TK45': ['1423', 45, 355, 36, 3.0],
    'LMT-1423-00-TK60': ['1423', 60, 717, 73, 3.0],
    'LMT-1423-00-TK70': ['1423', 70, 1249, 127, 3.0],
    'LMT-1436-00-TK45': ['1436', 45, 794, 81, 3.5],
    'LMT-1436-00-TK60': ['1436', 60, 1342, 137, 3.5],
    'LMT-1436-00-TK70': ['1436', 70, 1933, 197, 3.5],
    'LMT-1433-00-TK45': ['1433', 45, 1580, 161, 3.5],
    'LMT-1433-00-TK60': ['1433', 60, 2454, 250, 3.5],
    'LMT-1433-00-TK70': ['1433', 70, 3817, 389, 3.5],
    'LMT-1435-00-TK45': ['1435', 45, 4313, 440, 3.5],
    'LMT-1435-00-TK60': ['1435', 60, 6062, 618, 3.5],
    'LMT-1435-00-TK70': ['1435', 70, 9703, 989, 3.5],
    'LMT-1434-00-TK45': ['1434', 45, 5237, 534, 4.0],
    'LMT-1434-00-TK60': ['1434', 60, 8097, 826, 4.0],
    'LMT-1434-00-TK70': ['1434', 70, 10665, 1087, 4.0],
    'LMT-1881-00-TK45': ['1881', 45, 9316, 950, 6.0],
    'LMT-1881-00-TK60': ['1881', 60, 16670, 1700, 6.0],
    'LMT-1881-00-TK70': ['1881', 70, 26476, 2700, 6.0],
    'MLMT-0608-04-TK45': ['M608', 45, 588, 60, null],
    'MLMT-0608-04-TK55': ['M608', 55, 686, 70, null],
    'MLMT-0608-04-TK65': ['M608', 65, 1079, 110, null],
    'LMT-0608-04-TK45': ['L608', 45, 588, 60, null],
    'LMT-0608-04-TK55': ['L608', 55, 686, 70, null],
    'LMT-0608-04-TK65': ['L608', 65, 1079, 110, null],
    'MLMT-0609-03-TK45': ['M609', 45, 1569, 160, null],
    'MLMT-0609-03-TK55': ['M609', 55, 2157, 220, null],
    'MLMT-0609-03-TK65': ['M609', 65, 3040, 310, null],
    'LMT-0609-00-TK45': ['L609', 45, 1569, 160, null],
    'LMT-0609-00-TK55': ['L609', 55, 2157, 220, null],
    'LMT-0609-00-TK65': ['L609', 65, 3040, 310, null],
    'MLMT-0610-03-TK45': ['M610', 45, 3432, 350, null],
    'MLMT-0610-03-TK55': ['M610', 55, 5393, 550, null],
    'MLMT-0610-03-TK65': ['M610', 65, 7943, 810, null],
    'LMT-0610-00-TK45': ['L610', 45, 3432, 350, null],
    'LMT-0610-00-TK55': ['L610', 55, 5393, 550, null],
    'LMT-0610-00-TK65': ['L610', 65, 7943, 810, null],
    'LMT-0154-01-TK55': ['0154', 55, 9006, 918, 2.1],
    'LMT-0502-00-TK45': ['0502', 45, 2001, 204, 6.1],
    'LMT-1880-00-TK45': ['1880', 45, 1471, 150, 9],
    'LMT-1880-00-TK60': ['1880', 60, 3922, 400, 9],
    'LMT-1875-00-TK45': ['1875', 45, 2383, 243, 17],
    'LMT-1875-00-TK60': ['1875', 60, 5884, 600, 17],
    'LMT-1887': ['1887', 50, 30705, 3130, 7.5]
  };
  // Üniversal mobil takozun eksenel eğimi [N/mm] — s. 35'in grafiği (vektör; çizgi
  // çalışma aralığında doğrusal, artık 0): gövde (608 · 609 · 610) → sertlik → kz.
  var EGIM = {
    '608': { 45: 127, 55: 154, 65: 210 },
    '609': { 45: 334, 55: 493, 65: 822 },
    '610': { 45: 763, 55: 1136, 65: 1511 }
  };
  // Konik ailenin radyal/eksenel oranı: LMT-1433-00'ın BMC FEA değerleri (sertlik, kx/kz) —
  // programın kütüphanesindeki lmt1433-00-40sh · 55sh · 70sh (900/450 · 1500/750 · 2500/1150).
  var FEA_ORAN = [[40, 2.0], [55, 2.0], [70, 2500 / 1150]];
  // A+P eşi (ölçüsü aynı katalog tipi, js/mount-ap.js → TIP): 1433'ün flanşı ve delik aralığı
  // konik yatak 026'nınki; radyal X = Y → 026 S 1.
  var AP_ESI = { '1433': '026-s1' };
  var KAYNAK = {
    katalog: 'LASPAR genel kataloğu 2018',
    fea: 'BMC FEA raporu · 02.10.2018 · 12.02.2019',
    rapor: 'LASPAR test raporu'
  };
  // Programın eski girdileri → LASPAR modeli (künye): TK takozları MLMT-0216-33'ün üç
  // sertliği; LMT-1433-00 katalogdaki tip 1433; LMT-1433-37 aynı gövdenin katalogda olmayan
  // çeşidi. "Mount 1" (aynı FEA raporu, parça no yok) burada yok.
  var ESKI = {
    'TK035': { kod: 'MLMT-0216-33-TK035', sh: 35, kaynak: 'rapor' },
    'TK040': { kod: 'MLMT-0216-33-TK040', sh: 45, kaynak: 'rapor' },
    'TK050': { kod: 'MLMT-0216-33-TK050', sh: 50, kaynak: 'rapor' },
    'lmt1433-00-40sh': { kod: 'LMT-1433-00', tip: '1433', sh: 40, kaynak: 'fea' },
    'lmt1433-00-55sh': { kod: 'LMT-1433-00', tip: '1433', sh: 55, kaynak: 'fea' },
    'lmt1433-00-70sh': { kod: 'LMT-1433-00', tip: '1433', sh: 70, kaynak: 'fea' },
    'amc55sha': { kod: 'LMT-1433-37', sh: 55, kaynak: null }
  };

  function anahtar(kod) { return 'lp-' + kod.toLowerCase(); }
  function ad(kod) {
    var k = KOD[kod], t = TIP[k[0]], a = AILE[t[0]];
    return a[1] + ' ' + t[1] + ' ' + k[1] + ' ShA (LASPAR ' + kod + ')';
  }
  var bes = function(v) { return Math.max(5, Math.round(v / 5) * 5); };
  // Eksenel statik rijitlik [N/mm]: F/S; mobilde grafiğin eğimi.
  function kz(kod) {
    var k = KOD[kod];
    if (k[4]) return Math.round(k[2] / k[4]);
    var t = TIP[k[0]];
    return (EGIM[t[1]] && EGIM[t[1]][k[1]]) || null;
  }
  // Konik ailede radyal/eksenel oran (FEA'nın sertlikleri arasında doğrusal, dışında en yakını).
  function radyalOrani(sh) {
    var L = FEA_ORAN, son = L[L.length - 1];
    if (sh <= L[0][0]) return L[0][1];
    if (sh >= son[0]) return son[1];
    for (var i = 0; i < L.length - 1; i++) {
      var a = L[i], b = L[i + 1];
      if (sh >= a[0] && sh <= b[0]) return a[1] + (sh - a[0]) / (b[0] - a[0]) * (b[1] - a[1]);
    }
    return son[1];
  }
  // Kodun tahmin oranları: { din, sh, radyal: oran | null }.
  function tahminOrani(kod) {
    var k = KOD[kod]; if (!k) return null;
    var aile = TIP[k[0]][0];
    return { din: Math.round((k[1] + 20) / 50 * 100) / 100, sh: k[1],
             radyal: aile === 'konik' ? Math.round(radyalOrani(k[1]) * 1000) / 1000 : null };
  }
  // Tahminli alanları girdinin KENDİ değerlerinden kur (girilen değer tahmin değil).
  function tamamla(e) {
    var R = e && e.lp && e.lp.tahmin, T = e && e.tahmin;
    if (!R || !T || !T.length) return e;
    var var_ = function(f) { return T.indexOf(f) >= 0; };
    if (R.radyal != null && e.sz > 0) {
      if (var_('sx')) e.sx = bes(R.radyal * e.sz);
      if (var_('sy')) e.sy = bes(R.radyal * e.sz);
    }
    ['x', 'y', 'z'].forEach(function(a) {
      if (!var_('d' + a)) return;
      var st = e['s' + a];
      e['d' + a] = (st > 0) ? Math.round(st * R.din) : null;
    });
    return e;
  }
  // Kütüphane girdisi (VE_MOUNT_LIBRARY biçimi). Bilinmeyen eksen null.
  function girdi(kod) {
    var k = KOD[kod]; if (!k) return null;
    var t = TIP[k[0]], R = tahminOrani(kod);
    var e = { marka: MARKA, name: ad(kod), maxLoad: k[3],
              sx: null, sy: null, sz: kz(kod), dx: null, dy: null, dz: null };
    e.lp = { kod: kod, tip: k[0], aile: t[0], sh: k[1], tahmin: R };
    e.tahmin = (R.radyal != null ? ['sx', 'sy'] : []).concat(['dx', 'dy', 'dz']);
    return tamamla(e);
  }
  // Bütün kodlar: ailenin · tipin (katalog sırası) · sertliğin sırasıyla.
  function kodlar() {
    return Object.keys(KOD).sort(function(a, b) {
      var A = KOD[a], B = KOD[b];
      return (AILE_SIRA.indexOf(TIP[A[0]][0]) - AILE_SIRA.indexOf(TIP[B[0]][0]))
        || (TIP_SIRA.indexOf(A[0]) - TIP_SIRA.indexOf(B[0])) || (A[1] - B[1]);
    });
  }
  // Görselin adresi: derleme gömer (build.js → __MFSIM_TAKOZ), modüler kopyada dosya.
  function gorsel(adi) {
    var rel = 'takoz/lp/' + adi + '.webp';
    var W = (typeof window !== 'undefined' && window.__MFSIM_TAKOZ) || null;
    return (W && W[rel]) || ('assets/' + rel);
  }
  // Künye: Takoz Özellikleri'nin gösterdiği veri ve tipin teknik resmi ((i) düğmesi,
  // Canlı Not 111). Kapasite YAZILMAZ (Canlı Not 65).
  function tipKunye(tip) {
    var t = TIP[tip], a = AILE[t[0]];
    return { tip: tip, urun: a[1] + ' ' + t[1], aile: a[0], tipAdi: t[1], olcu: t[3], apEsi: AP_ESI[tip] || null,
             cizim: gorsel('cizim-' + t[2]), kaynak: KAYNAK.katalog + ' · s. ' + a[2] };
  }
  function kunye(kod) {
    var k = KOD[kod]; if (!k) return null;
    var K = tipKunye(k[0]);
    K.kod = kod; K.ad = ad(kod); K.sh = k[1];
    return K;
  }
  // Programın eski girdisinin künyesi (anahtar → künye) — yoksa null.
  function kunyeEski(anahtar_) {
    var E = ESKI[anahtar_]; if (!E) return null;
    var K = E.tip ? tipKunye(E.tip) : { urun: E.kod };
    K.kod = E.kod; K.sh = E.sh; K.eski = true;
    K.kaynak = E.kaynak ? KAYNAK[E.kaynak] : null;
    return K;
  }
  return { MARKA: MARKA, AILE: AILE, AILE_SIRA: AILE_SIRA, TIP: TIP, TIP_SIRA: TIP_SIRA, KOD: KOD, EGIM: EGIM,
           FEA_ORAN: FEA_ORAN, AP_ESI: AP_ESI, KAYNAK: KAYNAK, ESKI: ESKI, anahtar: anahtar, ad: ad, kz: kz, radyalOrani: radyalOrani,
           tahminOrani: tahminOrani, tamamla: tamamla, girdi: girdi, kodlar: kodlar, gorsel: gorsel,
           kunye: kunye, kunyeEski: kunyeEski };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = VE_MNT_LASPAR;
