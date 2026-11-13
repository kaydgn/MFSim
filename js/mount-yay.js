// ============================================================================
//  TAKOZ — ASKI YAYI KATALOĞU VE YAY HESABI (2026-11-11)
// ============================================================================
// Şanzımanın kuyruğunu şasiye asan ön yüklü helisel basma yayları. DOM'suz saf
// veri + EN 13906-1 bağıntıları: yay sabiti G·d⁴/(8·D³·n), gerilme düzeltme
// katsayısı k = (w + 0,5)/(w − 0,75), kayma gerilmesi k·8FD/(πd³), ilk doğal
// frekans 3,56·10⁵·d/(n·D²) (çelik, d · D mm, Hz). Sayılar üreticinin
// resminden, yuvarlanmadan; anahtar (k) projeye yazılır, DEĞİŞMEZ.
//
// Alanlar:
//   k        anahtar — askı yayının `yay` alanı, DEĞİŞMEZ
//   ad · uretici · kaynak   künye
//   kgfmm · kgfmmTol        resimdeki yay sabiti ve toleransı [kgf/mm]
//   L0 · Lc                 serbest boy · blok boyu [mm]
//   d · Do · Di · nt · n    tel çapı, dış ve iç çap [mm], toplam ve aktif sarım
//   Rm                      malzemenin çekme dayanımı [MPa] (meneviş 482 °C)
//   noktalar                resmin kuvvet–boy noktaları [{ ad, L mm, F kgf, tol kgf }]
//
// Kapı: tests/unit/mount-aski.test.js → KATALOG.
var VE_MNT_YAY_G = 9.81;            // kgf → N (programın yerçekimi)
var VE_MNT_YAY_GMOD = 78500;        // kayma modülü, sıcak şekillendirilmiş yay çeliği [N/mm²]
var VE_MNT_YAY_IZIN = 0.56;         // blok boyunda izin verilen düzeltmesiz kayma gerilmesi / Rm (EN 13906-1 §10.1, soğuk şekillendirilmiş)
var VE_MNT_YAY = [
  { k: 'bmc-2k60377', ad: '2K60377 · şanzıman askı yayı', uretici: 'BMC', kaynak: 'BMC 2K60377, yayın 3',
    kgfmm: 5.85, kgfmmTol: 0.5, L0: 90, Lc: 63, d: 9, Do: 70, Di: 52, nt: 7, n: 5,
    malzeme: 'BRS170582 · SAE 9262H (60SiCr7)', Rm: 1481,
    noktalar: [ { ad: 'ilk', L: 74, F: 93.5, tol: 8 }, { ad: 'montaj', L: 70, F: 117, tol: 10 }, { ad: 'st', L: 63, F: 158 } ] }
];

function veMntYay(k){
  for(var i = 0; i < VE_MNT_YAY.length; i++) if(VE_MNT_YAY[i].k === k) return VE_MNT_YAY[i];
  return null;
}
// Katalog kaydının yay sabiti [N/mm] ve ortalama çapı [mm]
function veMntYayNmm(e){ return e && e.kgfmm > 0 ? e.kgfmm * VE_MNT_YAY_G : NaN; }
function veMntYayOrtaCap(e){ return e && e.Do > 0 && e.Di > 0 ? (e.Do + e.Di) / 2 : NaN; }
// Geometriden yay sabiti [N/mm]: G·d⁴/(8·D³·n)
function veMntYaySabiti(d, D, n, G){
  var g = G > 0 ? G : VE_MNT_YAY_GMOD;
  return (d > 0 && D > 0 && n > 0) ? g * Math.pow(d, 4) / (8 * Math.pow(D, 3) * n) : NaN;
}
// Gerilme düzeltme katsayısı (Bergsträsser, EN 13906-1)
function veMntYayDuzeltme(d, D){
  var w = D / d;
  return (d > 0 && D > 0 && w > 0.75) ? (w + 0.5) / (w - 0.75) : NaN;
}
// Kayma gerilmesi [MPa]: F [N], d · D [mm]. Düzeltmesiz τ = 8FD/(πd³) statik
// ölçütün (blok boyunda τ_c ≤ 0,56·Rm), düzeltilmiş τ_k = k·τ dinamik yükün büyüklüğü.
function veMntYayGerilmeHam(F, d, D){
  return (d > 0 && D > 0 && Number.isFinite(F)) ? 8 * F * D / (Math.PI * Math.pow(d, 3)) : NaN;
}
function veMntYayGerilme(F, d, D){
  var k = veMntYayDuzeltme(d, D);
  return Number.isFinite(k) ? k * veMntYayGerilmeHam(F, d, D) : NaN;
}
// İlk doğal frekans [Hz], iki uç sabit (çelik): 3,56·10⁵·d/(n·D²)
function veMntYayFrekans(d, D, n){
  return (d > 0 && D > 0 && n > 0) ? 3.56e5 * d / (n * D * D) : NaN;
}

if(typeof module !== 'undefined' && module.exports){
  module.exports = { VE_MNT_YAY: VE_MNT_YAY, VE_MNT_YAY_G: VE_MNT_YAY_G, VE_MNT_YAY_GMOD: VE_MNT_YAY_GMOD, VE_MNT_YAY_IZIN: VE_MNT_YAY_IZIN,
    veMntYay: veMntYay, veMntYayNmm: veMntYayNmm, veMntYayOrtaCap: veMntYayOrtaCap, veMntYaySabiti: veMntYaySabiti,
    veMntYayDuzeltme: veMntYayDuzeltme, veMntYayGerilmeHam: veMntYayGerilmeHam, veMntYayGerilme: veMntYayGerilme,
    veMntYayFrekans: veMntYayFrekans };
}
