// ============================================================================
//  FEAD — KAYIŞ KATALOĞU
// ============================================================================
// `fead-belt` bileşeninin katalog katmanı. DOM'suz ve saf veri: panel
// (js/cp-fead.js) buradan okur, buraya HİÇBİR ŞEY yazmaz. Kalıp
// js/structural-materials.js ile aynı.
//
// ── KATALOG BİR KISIT DEĞİL, BİR ÖNERİ ──────────────────────────────────────
// Kullanıcının kendi akışı şu (2026-08-25): *"tasarımı yaptıktan sonra tasarıma
// göre tedarikçi ile iletişime geçip, tasarıma uygun bir kayış tedarik
// ediyoruz."* Optibelt kataloğu da bunu kendisi yazıyor: *"Further dimensions
// and minimum order quantities on request"* + ayrı bir "Intermediate lengths"
// satırı. Yani ARA BOY ISMARLANABİLİYOR.
//
// Dolayısıyla bu dosya "seçebileceğin boylar" listesi DEĞİL; "elde hazır olan
// boylar" listesi. Kullanıcı her zaman elle boy girebilir ve panel bunu
// engellemez — katalog yalnız "en yakın hangisi ve seçersem ne olur" sorusuna
// cevap verir.
//
// ── KATALOG ADINDAKİ SAYI = EFEKTİF BOY (ölçülerek doğrulandı) ──────────────
// Üreticiler aynı sayıya farklı ad veriyor: Gates *"effective length"*,
// Optibelt ve ContiTech *"reference length Lb"*. Hangisi olduğu MFSim için
// kritik, çünkü `belt.effLength` ISO 9981 efektif boyunu bekliyor ve
// çekirdekte `L_pitch − L_eff = 2π·h_b` (Gates PK'da 7.54 mm) — karıştırmak
// SESSİZ bir %0.44 kayması olurdu.
//
// Cevap tahminle değil ÖLÇÜMLE verildi. BMC tedarikçi sayfası hem kasnak
// koordinatlarını hem kayış adını (8PK 1715) veriyor; serbest kip boyu HİÇ
// görmeden hesaplıyor:
//     "1715" EFEKTİF boy ise sapma  0.267 mm  (%0.0156)
//     "1715" PITCH   boy ise sapma  7.807 mm  (%0.4552)
// Efektif hipotezi 29 KAT daha iyi uyuyor. Katalog adındaki sayı doğrudan
// `effLength`'e yazılır, ÇEVRİM YOK.
//
// ── İKİ AYRI KÜME, VE KARIŞTIRILMAMALI ──────────────────────────────────────
// STOK (VE_FEAD_BELT_STOCK): ISO 9982 / DIN 7867 endüstriyel kayış boyları,
//   Optibelt "Power Transmission product range" kataloğunun optibelt RB
//   bölümündeki "profile and Lb (mm)" tablolarından BİREBİR çıkarıldı.
//   Aralıklar ContiTech'in kendi beyanıyla çapraz doğrulandı (PK 630–2555,
//   PL 927–7055, PM 2134–16764).
//
// IZGARA (VE_FEAD_BELT_GRID): OTOMOTİV pratiği. FEAD bir motor aksesuar
//   tahriki ve otomotiv kayışları uygulama başına üretildiği için ızgara çok
//   daha ince — piyasada 1700 · 1705 · 1706 · 1707 · 1710 · 1714 · 1715 ·
//   1720 · 1725 hepsi var.
//
// BU AYRIM ÖNEMLİ VE ÖLÇÜLDÜ: BMC'nin kendi kayışı (8PK 1715) endüstriyel
// STOK listesinde YOKTUR — komşuları 1690 ve 1755, yani 65 mm'lik bir boşluk.
// Yalnız stok listesini katalog saymak, kullanıcının elindeki kayışı
// "katalogda yok" ilan etmek olurdu.
//
// IZGARA BİR LİSTE DEĞİL, BİR KURAL. 5 mm adımı ölçülmüş bir PRATİK; gerçek
// üretim yer yer daha da ince (1706, 1707, 1714). Onu 460 satırlık uydurma bir
// liste olarak yazmak, olmayan bir kesinlik iddia etmek olurdu.
//
// ── KABURGA SAYISI ──────────────────────────────────────────────────────────
// Yalnız PK için temiz kaynaklı veri var (ContiTech otomotiv: 3–12, çift
// taraflı DPK 6–8). Endüstriyel kayışlar kaburgalı RULODAN (sleeve) kesiliyor,
// yani kaburga sayısı büyük ölçüde serbest. Diğer profiller için sayı
// UYDURULMADI — `ribs` alanı null ve panel bunu bir kısıt olarak kullanmıyor.
// ============================================================================

var VE_FEAD_BELT_LIB_VERSION = '1.0';

// Katalog künyesi — panelde kaynak gösterilir; "nominal ≠ sertifika" kuralının
// kayış tarafındaki karşılığı.
var VE_FEAD_BELT_LIB_SOURCE =
  'ISO 9982 / DIN 7867 · optibelt RB (Power Transmission product range) · '
  + 'ContiTech CONTI-V MULTIRIB aralıklarıyla çapraz doğrulandı';

// ─── ENDÜSTRİYEL STOK BOYLAR (efektif boy, mm) ──────────────────────────────
var VE_FEAD_BELT_STOCK = {
  PH: [
    698, 735, 762, 813, 886, 955, 965, 975, 990, 1016, 1080, 1092,
    1096, 1194, 1200, 1222, 1230, 1262, 1270, 1285, 1290, 1301, 1309, 1316,
    1321, 1333, 1439, 1475, 1600, 1854, 1895, 1915, 1930, 1956, 1992, 2083,
    2155
  ],
  PJ: [
    280, 330, 356, 362, 381, 406, 414, 432, 457, 483, 508, 559,
    584, 610, 660, 711, 723, 737, 762, 813, 836, 864, 914, 955,
    965, 1016, 1092, 1105, 1110, 1123, 1130, 1150, 1168, 1194, 1200, 1222,
    1244, 1262, 1270, 1285, 1301, 1309, 1316, 1321, 1333, 1355, 1371, 1397,
    1428, 1439, 1475, 1549, 1600, 1651, 1663, 1752, 1780, 1854, 1895, 1910,
    1915, 1930, 1956, 1965, 1981, 1992, 2083, 2155, 2210, 2337, 2489
  ],
  PK: [
    630, 648, 698, 730, 775, 800, 812, 830, 865, 875, 890, 913,
    920, 940, 954, 962, 990, 1015, 1080, 1090, 1125, 1150, 1165, 1190,
    1200, 1222, 1230, 1245, 1270, 1285, 1290, 1321, 1330, 1345, 1371, 1397,
    1439, 1460, 1520, 1560, 1570, 1600, 1655, 1690, 1755, 1854, 1885, 1930,
    1956, 1980, 2030, 2050, 2080, 2120, 2145, 2170, 2235, 2255, 2362, 2460,
    2515, 2845
  ],
  PL: [
    954, 991, 1075, 1194, 1270, 1333, 1371, 1397, 1422, 1562, 1613, 1664,
    1715, 1764, 1803, 1841, 1943, 1981, 2020, 2070, 2096, 2134, 2197, 2235,
    2324, 2362, 2476, 2515, 2705, 2743, 2845, 2895, 2921, 2997, 3086, 3124,
    3289, 3327, 3492, 3696, 4051, 4191, 4470, 4622, 5029, 5385, 6096
  ],
  PM: [
    2286, 2388, 2515, 2693, 2832, 2921, 3010, 3124, 3327, 3531, 3734, 4089,
    4191, 4470, 4648, 5029, 5410, 6121, 6883, 7646, 8408, 9169, 9931, 10693,
    12217, 13741, 15266
  ]
};

// ─── OTOMOTİV IZGARASI (kural, liste değil) ─────────────────────────────────
// FEAD'in asıl kümesi. `stepMm` ölçülmüş bir PRATİK: gerçek üretimde daha ince
// boylar da var (1706, 1707, 1714), yani ızgara bir ALT KÜME — "bu boy
// bulunmaz" demek DEĞİL.
var VE_FEAD_BELT_GRID = {
  PK: { minMm: 600, maxMm: 2900, stepMm: 5 },
  PJ: { minMm: 280, maxMm: 2500, stepMm: 5 },
  PH: { minMm: 250, maxMm: 2200, stepMm: 5 }
};

// Kaburga sayısı — YALNIZ temiz kaynaklı olan yazılı.
var VE_FEAD_BELT_RIBS = {
  PK: { min: 3, max: 12, note: 'ContiTech CONTI MULTI V-BELT Automotive' }
};

var VE_FEAD_BELT_PROFILES = ['PH', 'PJ', 'PK', 'PL', 'PM'];

function _feadBeltNum(v){
  var n = (typeof v === 'string') ? Number(v.trim().replace(',', '.')) : Number(v);
  return Number.isFinite(n) ? n : NaN;
}

function veFeadBeltProfileOf(p){
  var s = String(p == null ? '' : p).trim().toUpperCase();
  return (VE_FEAD_BELT_PROFILES.indexOf(s) >= 0) ? s : null;
}

// Stok listesi — KOPYA döner. Çağıran taraf sıralayıp filtreleyebilsin diye;
// katalog dizisini dışarıya vermek, bir çağrının onu yerinde değiştirip
// bütün oturumu sessizce bozmasına açık kapı bırakırdı.
function veFeadBeltStock(profile){
  var p = veFeadBeltProfileOf(profile);
  return (p && VE_FEAD_BELT_STOCK[p]) ? VE_FEAD_BELT_STOCK[p].slice() : [];
}

function veFeadBeltGrid(profile){
  var p = veFeadBeltProfileOf(profile);
  return (p && VE_FEAD_BELT_GRID[p]) ? VE_FEAD_BELT_GRID[p] : null;
}

// Izgaradaki en yakın boy. Izgara bir KURAL olduğu için burada üretiliyor,
// dizi olarak saklanmıyor.
function veFeadBeltGridNearest(profile, targetMm){
  var g = veFeadBeltGrid(profile), t = _feadBeltNum(targetMm);
  if(!g || !Number.isFinite(t)) return null;
  var v = Math.round(t / g.stepMm) * g.stepMm;
  if(v < g.minMm) v = g.minMm;
  if(v > g.maxMm) v = g.maxMm;
  return v;
}

// Katalog kodu: 8PK1715. Otomotiv yazımı kaburga sayısını ÖNE alıyor
// (Gates/Bando), endüstriyel yazım arkaya (Optibelt "4 PH 698", ContiTech
// "1168 PJ-6"). MFSim otomotiv yazımını kullanıyor — modülün kendisi bir
// motor aksesuar tahriki ve tedarikçi sayfası da öyle yazıyor.
function veFeadBeltCode(profile, ribs, lengthMm){
  var p = veFeadBeltProfileOf(profile);
  var r = _feadBeltNum(ribs), L = _feadBeltNum(lengthMm);
  if(!p || !Number.isFinite(L)) return '';
  var boy = (Math.abs(L - Math.round(L)) < 0.05) ? String(Math.round(L))
                                                 : String(Math.round(L * 10) / 10);
  return (Number.isFinite(r) && r > 0 ? String(Math.round(r)) : '') + p + boy;
}

// Kod çözümleme: "8PK1715", "8 PK 1715", "1715 PK-8" hepsini kabul eder —
// kullanıcı hangi katalogdan kopyalarsa kopyalasın çalışsın.
function veFeadBeltParseCode(code){
  var s = String(code == null ? '' : code).trim().toUpperCase().replace(/\s+/g, '');
  var m = s.match(/^(\d{1,2})?(PH|PJ|PK|PL|PM)[-]?(\d{3,5})(?:[.,](\d))?$/);
  if(m) return { profile: m[2], ribs: m[1] ? Number(m[1]) : null,
                 lengthMm: Number(m[3] + (m[4] ? '.' + m[4] : '')) };
  m = s.match(/^(\d{3,5})(?:[.,](\d))?(PH|PJ|PK|PL|PM)[-]?(\d{1,2})?$/);
  if(m) return { profile: m[3], ribs: m[4] ? Number(m[4]) : null,
                 lengthMm: Number(m[1] + (m[2] ? '.' + m[2] : '')) };
  return null;
}

// Kaburga sayısı katalog aralığında mı? Aralığı OLMAYAN profilde hüküm
// verilmiyor (`null`) — bilinmeyeni "geçersiz" saymak, olmayan bir bilgiyi
// varmış gibi kullanmak olurdu.
function veFeadBeltRibsCheck(profile, ribs){
  var p = veFeadBeltProfileOf(profile), r = _feadBeltNum(ribs);
  var lim = p ? VE_FEAD_BELT_RIBS[p] : null;
  if(!lim || !Number.isFinite(r)) return null;
  return (r >= lim.min && r <= lim.max);
}

// ─── EN YAKIN ADAYLAR ───────────────────────────────────────────────────────
// Hedef boya en yakın katalog boyları. İKİ KÜME AYRI DÖNÜYOR ve etiketli:
// biri gerçek bir stok listesi, öbürü bir ızgara kuralı. Tek listede
// karıştırmak, kullanıcının "bunlar da stok" sanmasına yol açardı.
//
// count: her kümeden kaç aday (varsayılan 3, hedefin iki yanından).
function veFeadBeltNearest(profile, targetMm, opt){
  opt = opt || {};
  var count = opt.count > 0 ? Math.floor(opt.count) : 3;
  var t = _feadBeltNum(targetMm);
  var out = { targetMm: t, stock: [], grid: null, profile: veFeadBeltProfileOf(profile) };
  if(!out.profile || !Number.isFinite(t)) return out;

  var liste = veFeadBeltStock(out.profile);
  out.stock = liste
    .map(function(L){ return { lengthMm: L, deltaMm: L - t, kind: 'stock' }; })
    .sort(function(a, b){ return Math.abs(a.deltaMm) - Math.abs(b.deltaMm); })
    .slice(0, count)
    .sort(function(a, b){ return a.lengthMm - b.lengthMm; });

  var g = veFeadBeltGridNearest(out.profile, t);
  if(g != null) out.grid = { lengthMm: g, deltaMm: g - t, kind: 'grid' };
  return out;
}

// Tek en iyi aday: ızgara varsa ızgara (otomotivde daha yakın ve ısmarlanabilir),
// yoksa stok. FEAD bir otomotiv tahriki olduğu için sıra bu — endüstriyel stok
// listesi PK'da 65 mm'lik boşluklar taşıyor (BMC'nin 1715'i tam o boşlukta).
function veFeadBeltBest(profile, targetMm){
  var n = veFeadBeltNearest(profile, targetMm, { count: 1 });
  if(n.grid) return n.grid;
  return n.stock.length ? n.stock[0] : null;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    VE_FEAD_BELT_LIB_VERSION: VE_FEAD_BELT_LIB_VERSION,
    VE_FEAD_BELT_LIB_SOURCE: VE_FEAD_BELT_LIB_SOURCE,
    VE_FEAD_BELT_STOCK: VE_FEAD_BELT_STOCK,
    VE_FEAD_BELT_GRID: VE_FEAD_BELT_GRID,
    VE_FEAD_BELT_RIBS: VE_FEAD_BELT_RIBS,
    VE_FEAD_BELT_PROFILES: VE_FEAD_BELT_PROFILES,
    veFeadBeltProfileOf: veFeadBeltProfileOf,
    veFeadBeltStock: veFeadBeltStock,
    veFeadBeltGrid: veFeadBeltGrid,
    veFeadBeltGridNearest: veFeadBeltGridNearest,
    veFeadBeltCode: veFeadBeltCode,
    veFeadBeltParseCode: veFeadBeltParseCode,
    veFeadBeltRibsCheck: veFeadBeltRibsCheck,
    veFeadBeltNearest: veFeadBeltNearest,
    veFeadBeltBest: veFeadBeltBest
  };
}
