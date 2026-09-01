// ============================================================================
//  FEAD — AKSESUAR KATALOĞU (alternatör + klima kompresörü)
// ============================================================================
// Aksesuar kasnaklarının künye katmanı. DOM'suz ve saf veri: panel
// (js/cp-fead.js) buradan okur, buraya HİÇBİR ŞEY yazmaz. Kalıp
// js/fead-belts.js · js/fead-engines.js · js/fead-tensioners.js ile aynı.
//
// ── KAYNAK: BMC'nin KENDİ HESAP DEFTERİ ─────────────────────────────────────
// On dört kaydın tamamı `KIRPI_II_NEX_GEN.FEAD.xlsx` defterinin "Alternator"
// ve "Klima Komp." sayfalarından çıkarıldı (BMC SAS ARGE / Güç Grubu,
// ADEM CAM, 13.08.2026): künye sütunları + devir/kW eğrisi blokları.
//
// ── BU KATALOĞUN GETİRDİĞİ ASIL ŞEY DEVİR SINIRLARI ─────────────────────────
// MFSim'de aksesuar güç eğrisi ZATEN vardı (`VE_FEAD_PRESET_LIB`, Araç
// Performans modülünün kaynağı). Burada YENİ olan üç devir alanı:
//
//     optimumRpm  → aksesuarın anma verimini verdiği devir
//     maxContRpm  → sürekli çalışabileceği azami devir
//     maxPeakRpm  → anlık dayanabileceği azami devir
//
// Bu üçü olmadan ne çevrim oranı penceresi ne de devir sınırı kapısı
// kurulabilir (js/fead-checks.js). Defter de tam olarak bu üç sütunu tutuyor.
//
// ── EĞRİSİ OLMAYAN KAYIT SİLİNMEDİ ──────────────────────────────────────────
// Prestolite 120A'nın (57RS309791) devir/kW satırları defterde BOŞ. Kayıt
// `curve: []` ile duruyor çünkü devir sınırları dolu ve o kapılar için yeterli;
// bir eğri uydurmak ise sessizce yanlış kW üretirdi. `veFeadAccApply` boş
// eğriyi düğüme YAZMAZ — kullanıcının kendi tablosunu silmesin diye.
//
// ── AYNI MODEL, FARKLI PARÇA NUMARASI ───────────────────────────────────────
// Prestolite 155A iki kez (57RS309036 · 57RS309348), Prestolite 180A üç kez,
// Valeo TM31 iki kez geçiyor. Anahtar BMC parça numarasıdır, model adı değil:
// defterin kendi INDEX/MATCH'i de numarayla çalışıyor. Etiket ikisini birden
// gösterir ki listede ayırt edilebilsinler.

var VE_FEAD_ACC_LIB_VERSION = '1.0.0';

var VE_FEAD_ACC_LIB_SOURCE =
  'KIRPI II NEX GEN FEAD defteri · "Alternator" ve "Klima Komp." sayfaları '
  + '(BMC SAS ARGE, 13.08.2026)';

// tip → MFSim bileşen tipiyle eşleşir: 'alternator' ↔ fead-alternator,
//        'ac' ↔ fead-ac. Eşleme VE_FEAD_ACC_TYPE'ta, tek kaynak.
var VE_FEAD_ACC_DB = [
  { key: '57RS317093', ad: 'Prestolite 180A', tip: 'alternator',
    optimumRpm: 6000, maxContRpm: 9000, maxPeakRpm: 12000,
      curve: [{rpm:1500,kw:0.5}, {rpm:2000,kw:3.3508}, {rpm:2500,kw:4.9738},
                {rpm:3000,kw:5.9686}, {rpm:3500,kw:6.7801}, {rpm:4000,kw:7.1204},
                {rpm:4500,kw:7.5393}, {rpm:5000,kw:7.8534}, {rpm:5500,kw:8.3508},
                {rpm:6000,kw:8.7958}, {rpm:6500,kw:8.8482}, {rpm:7000,kw:9.1623},
                {rpm:7500,kw:9.4241}, {rpm:8000,kw:9.6335}, {rpm:8500,kw:10.2356},
                {rpm:9000,kw:10.3665}] },
  { key: '57RS321859', ad: 'Tepaş 350A', tip: 'alternator',
    optimumRpm: 6000, maxContRpm: 8000, maxPeakRpm: 10000,
      curve: [{rpm:1500,kw:0}, {rpm:2000,kw:6.0733}, {rpm:2500,kw:8.4}, {rpm:3000,kw:10.6806},
                {rpm:3500,kw:11.65}, {rpm:4000,kw:12.5654}, {rpm:4500,kw:13.35},
                {rpm:5000,kw:14.1361}, {rpm:5500,kw:14.3}, {rpm:6000,kw:14.4503},
                {rpm:6500,kw:14.95}, {rpm:7000,kw:15.3927}, {rpm:7500,kw:15.65},
                {rpm:8000,kw:15.9162}] },
  { key: '57RS309791', ad: 'Prestolite 120A', tip: 'alternator',
    optimumRpm: 6000, maxContRpm: 9000, maxPeakRpm: 12000,
      curve: [] },
  { key: '57RS317557', ad: 'Prestolite 140A', tip: 'alternator',
    optimumRpm: 6000, maxContRpm: 9000, maxPeakRpm: 12000,
      curve: [{rpm:1100,kw:0.5}, {rpm:1500,kw:2.14}, {rpm:2000,kw:4.2}, {rpm:2500,kw:5.35},
                {rpm:3000,kw:6.5}, {rpm:3500,kw:7.25}, {rpm:4000,kw:8}, {rpm:4500,kw:8.25},
                {rpm:5000,kw:8.5}, {rpm:5500,kw:9.15}, {rpm:6000,kw:9.8}, {rpm:7000,kw:9.8},
                {rpm:8000,kw:9.8}, {rpm:9000,kw:9.8}] },
  { key: '57RS309036', ad: 'Prestolite 155A', tip: 'alternator',
    optimumRpm: 6000, maxContRpm: 8000, maxPeakRpm: 12000,
      curve: [{rpm:1000,kw:0}, {rpm:1200,kw:1.71}, {rpm:1400,kw:2.42}, {rpm:1600,kw:2.85},
                {rpm:1800,kw:3.14}, {rpm:2000,kw:3.42}, {rpm:2500,kw:3.85}, {rpm:3000,kw:3.99},
                {rpm:3500,kw:4.08}, {rpm:4000,kw:4.13}, {rpm:4500,kw:4.16}, {rpm:5000,kw:4.19},
                {rpm:5500,kw:4.25}, {rpm:6000,kw:4.28}, {rpm:7000,kw:4.28}, {rpm:8000,kw:4.28}] },
  { key: '57RS309348', ad: 'Prestolite 155A', tip: 'alternator',
    optimumRpm: 6000, maxContRpm: 8000, maxPeakRpm: 12000,
      curve: [{rpm:1000,kw:0}, {rpm:1200,kw:1.71}, {rpm:1400,kw:2.42}, {rpm:1600,kw:2.85},
                {rpm:1800,kw:3.14}, {rpm:2000,kw:3.42}, {rpm:2500,kw:3.85}, {rpm:3000,kw:3.99},
                {rpm:3500,kw:4.08}, {rpm:4000,kw:4.13}, {rpm:4500,kw:4.16}, {rpm:5000,kw:4.19},
                {rpm:5500,kw:4.25}, {rpm:6000,kw:4.28}, {rpm:7000,kw:4.28}, {rpm:8000,kw:4.28}] },
  { key: '57RS318932', ad: 'Prestolite 180A', tip: 'alternator',
    optimumRpm: 6000, maxContRpm: 9000, maxPeakRpm: 12000,
      curve: [{rpm:1500,kw:0.5}, {rpm:2000,kw:3.3508}, {rpm:2500,kw:4.9738},
                {rpm:3000,kw:5.9686}, {rpm:3500,kw:6.7801}, {rpm:4000,kw:7.1204},
                {rpm:4500,kw:7.5393}, {rpm:5000,kw:7.8534}, {rpm:5500,kw:8.3508},
                {rpm:6000,kw:8.7958}, {rpm:6500,kw:8.8482}, {rpm:7000,kw:9.1623},
                {rpm:7500,kw:9.4241}, {rpm:8000,kw:9.6335}, {rpm:8500,kw:10.2356},
                {rpm:9000,kw:10.3665}] },
  { key: '57RS320300', ad: 'Prestolite 180A', tip: 'alternator',
    optimumRpm: 6000, maxContRpm: 9000, maxPeakRpm: 12000,
      curve: [{rpm:1500,kw:0.5}, {rpm:2000,kw:3.3508}, {rpm:2500,kw:4.9738},
                {rpm:3000,kw:5.9686}, {rpm:3500,kw:6.7801}, {rpm:4000,kw:7.1204},
                {rpm:4500,kw:7.5393}, {rpm:5000,kw:7.8534}, {rpm:5500,kw:8.3508},
                {rpm:6000,kw:8.7958}, {rpm:6500,kw:8.8482}, {rpm:7000,kw:9.1623},
                {rpm:7500,kw:9.4241}, {rpm:8000,kw:9.6335}, {rpm:8500,kw:10.2356},
                {rpm:9000,kw:10.3665}] },
  { key: '54100000001', ad: 'Prestolite 250A', tip: 'alternator',
    optimumRpm: 6000, maxContRpm: 8000, maxPeakRpm: 12000,
      curve: [{rpm:1500,kw:1.5}, {rpm:2000,kw:7}, {rpm:2500,kw:9.5}, {rpm:3000,kw:12},
                {rpm:3500,kw:12.5}, {rpm:4000,kw:13}, {rpm:4500,kw:14}, {rpm:5000,kw:15},
                {rpm:5500,kw:16}, {rpm:6000,kw:17}, {rpm:6500,kw:17.5}, {rpm:7000,kw:18},
                {rpm:7500,kw:18.5}, {rpm:8000,kw:19}] },
  { key: '57RS322565', ad: 'Prestolite 600A', tip: 'alternator',
    optimumRpm: 6000, maxContRpm: 8000, maxPeakRpm: 12000,
      curve: [{rpm:1500,kw:0}, {rpm:2000,kw:6.5}, {rpm:2500,kw:9}, {rpm:3000,kw:10.5},
                {rpm:3500,kw:11.5}, {rpm:4000,kw:11.6}, {rpm:4500,kw:11.7}, {rpm:5000,kw:11.8},
                {rpm:5500,kw:11.9}, {rpm:6000,kw:11.8}, {rpm:7000,kw:11.8}, {rpm:8000,kw:11.8}] },
  { key: '57RS321633', ad: 'Valeo TM21', tip: 'ac',
    optimumRpm: 1000, maxContRpm: 3000, maxPeakRpm: 6000,
      curve: [{rpm:800,kw:1.2}, {rpm:1000,kw:1.9}, {rpm:1500,kw:3.05}, {rpm:2000,kw:4.2},
                {rpm:2500,kw:5.2}, {rpm:3000,kw:6.2}, {rpm:3500,kw:6.85}, {rpm:4000,kw:7.5},
                {rpm:4500,kw:8.25}, {rpm:5000,kw:9}, {rpm:6000,kw:9}] },
  { key: '55100000130', ad: 'Valeo TM31', tip: 'ac',
    optimumRpm: 1000, maxContRpm: 3000, maxPeakRpm: 6000,
      curve: [{rpm:800,kw:0.8}, {rpm:1000,kw:2}, {rpm:1500,kw:3.5}, {rpm:2000,kw:5.5},
                {rpm:3000,kw:8.3}, {rpm:4000,kw:10.6}, {rpm:5000,kw:12.4}] },
  { key: '57RS319930', ad: 'Sanden 7H15', tip: 'ac',
    optimumRpm: 1000, maxContRpm: 3000, maxPeakRpm: 6000,
      curve: [{rpm:1000,kw:1.5}, {rpm:1500,kw:2.25}, {rpm:2000,kw:3}, {rpm:2500,kw:3.75},
                {rpm:3000,kw:4.5}] },
  { key: '57RS322530', ad: 'Valeo TM31', tip: 'ac',
    optimumRpm: 1000, maxContRpm: 3000, maxPeakRpm: 6000,
      curve: [{rpm:800,kw:0.8}, {rpm:1000,kw:2}, {rpm:1500,kw:3.5}, {rpm:2000,kw:5.5},
                {rpm:3000,kw:8.3}, {rpm:4000,kw:10.6}, {rpm:5000,kw:12.4}] },
];

// Bileşen tipi ↔ katalog ailesi. Panel bu eşlemeyle kendi tipine ait kayıtları
// süzüyor; tek kaynak olsun diye burada, kullanıldığı yerde değil.
var VE_FEAD_ACC_TYPE = { 'fead-alternator': 'alternator', 'fead-ac': 'ac' };

function _faNum(v){
  var n = (typeof v === 'string') ? Number(v.trim().replace(',', '.')) : Number(v);
  return Number.isFinite(n) ? n : NaN;
}

// tip verilmezse hepsi. KOPYA döner.
function veFeadAccList(tip){
  var t = tip ? (VE_FEAD_ACC_TYPE[tip] || tip) : null;
  return VE_FEAD_ACC_DB
    .filter(function(a){ return !t || a.tip === t; })
    .map(function(a){ return { key: a.key, ad: a.ad, tip: a.tip, label: veFeadAccLabel(a) }; });
}

// Model adı TEK BAŞINA ayırt etmiyor (üç ayrı Prestolite 180A var) — etiket
// parça numarasını da taşır.
function veFeadAccLabel(a){
  if(!a) return '';
  return a.ad + '  ·  ' + a.key;
}

function veFeadAccOf(key){
  var k = String(key == null ? '' : key).trim();
  if(!k) return null;
  for(var i = 0; i < VE_FEAD_ACC_DB.length; i++)
    if(VE_FEAD_ACC_DB[i].key === k) return VE_FEAD_ACC_DB[i];
  return null;
}

// Üç devir sınırı. Kaynak sırası: DÜĞÜMÜN KENDİ ALANI önce, katalog sonra.
// Katalog bir öneri; kullanıcı listede olmayan bir aksesuarın sınırlarını elle
// girebilmeli ve girdiği değer katalogla çelişirse KENDİSİNİNKİ kazanmalı.
//
// "ELLE" DEMEK İÇİN DEĞERİN KATALOGTAN FARKLI OLMASI GEREKİR. `veFeadAccApply`
// katalog değerlerini düğümün alanlarına YAZIYOR; alanın dolu olmasına bakmak,
// katalogdan gelen üç sayıyı "kullanıcı elle girdi" diye rapor etmek olurdu
// (panelde tam olarak öyle görünüyordu). Karşılaştırma sayısal — 8000 ile
// "8000" aynı sayıdır, `veFeadEngineDrift` ile aynı kural.
function veFeadAccLimits(node){
  var d = (node && node.data) ? node.data : (node || {});
  var lib = veFeadAccOf(d.accLib);
  function al(alan, libAlan){
    var v = _faNum(d[alan]);
    var k = (lib && lib[libAlan] > 0) ? lib[libAlan] : NaN;
    if(Number.isFinite(v) && v > 0)
      return { rpm: v,
               kaynak: (Number.isFinite(k) && Math.abs(v - k) < 1e-6) ? 'katalog' : 'elle' };
    if(Number.isFinite(k)) return { rpm: k, kaynak: 'katalog' };
    return { rpm: NaN, kaynak: null };
  }
  return {
    key: lib ? lib.key : null,
    ad:  lib ? lib.ad  : null,
    optimum: al('optimumRpm', 'optimumRpm'),
    maxCont: al('maxContRpm', 'maxContRpm'),
    maxPeak: al('maxPeakRpm', 'maxPeakRpm')
  };
}

// Künyeyi düğüme yazar. İki kural:
//   • BOŞ EĞRİ YAZILMAZ — kullanıcının kendi tablosunu silmek olurdu.
//   • Eğri yazılırken düğümün var olan `pwrCurve`'ü DEĞİŞTİRİLİR, çünkü
//     katalog seçmek "bu aksesuarın verisi bu" demektir; kısmen eski kalan bir
//     tablo iki kaynağı karıştırırdı.
function veFeadAccApply(node, key){
  var a = veFeadAccOf(key);
  if(!node || !a) return node;
  if(!node.data) node.data = {};
  var d = node.data;
  d.accLib    = a.key;
  d.accLibVer = VE_FEAD_ACC_LIB_VERSION;
  if(a.optimumRpm != null) d.optimumRpm = a.optimumRpm;
  if(a.maxContRpm != null) d.maxContRpm = a.maxContRpm;
  if(a.maxPeakRpm != null) d.maxPeakRpm = a.maxPeakRpm;
  if(a.curve && a.curve.length)
    d.pwrCurve = a.curve.map(function(p){ return { rpm: p.rpm, kw: p.kw }; });
  return node;
}

// Katalog bağını çözer — alanlar KALIR. "Katalogdan ayrıl" bir silme değil bir
// serbest bırakmadır: kullanıcı katalog değerinden başlayıp üstünde oynamak
// isteyebilir ve tabloyu sıfırlamak o akışı öldürürdü.
function veFeadAccUnlink(node){
  if(node && node.data){ delete node.data.accLib; delete node.data.accLibVer; }
  return node;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    VE_FEAD_ACC_LIB_VERSION: VE_FEAD_ACC_LIB_VERSION,
    VE_FEAD_ACC_LIB_SOURCE: VE_FEAD_ACC_LIB_SOURCE,
    VE_FEAD_ACC_DB: VE_FEAD_ACC_DB,
    VE_FEAD_ACC_TYPE: VE_FEAD_ACC_TYPE,
    veFeadAccList: veFeadAccList,
    veFeadAccLabel: veFeadAccLabel,
    veFeadAccOf: veFeadAccOf,
    veFeadAccLimits: veFeadAccLimits,
    veFeadAccApply: veFeadAccApply,
    veFeadAccUnlink: veFeadAccUnlink
  };
}
