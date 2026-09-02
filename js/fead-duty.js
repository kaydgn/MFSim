// ============================================================================
//  FEAD — ÇALIŞMA ÇEVRİMİ KÜTÜPHANESİ
// ============================================================================
// `fead-solver` bileşeninin ve Başlangıç Sihirbazı'nın 6. adımının katalog
// katmanı. DOM'suz ve saf veri: paneller buradan okur, buraya hiçbir şey
// yazmaz. Kalıp js/fead-belts.js ve js/fead-tensioners.js ile aynı.
//
// Kullanıcı bildirimi (2026-08-31): *"Motor ve Çevrim kısmında aksesuar
// seçtiğimizde çalışma çevrimini otomatik olarak hesaplamıyor. El ile girmek
// gerekiyor. Bu olmamalı… Çalışma çevrimi sabit zaten, ona göre tabloyu
// program otomatik olarak çıkarmalı."*
//
// ÖLÇÜLDÜ ve bildirimin yarısı tutmadı: **tek bir "sabit" çalışma çevrimi
// YOK.** `tests/fixtures/fead-validation.js` içindeki 14 Gates sisteminde
// ALTI ayrı devir/%zaman deseni var (aşağıda), üstelik devir bantları da
// ayrışıyor (519…3000 RPM). Yani çevrim motorun/aracın verisidir, evrensel
// bir sabit değil — tek bir deseni "standart" diye gömmek, arşivin gösterdiği
// beş deseni yok saymak olurdu.
//
// Tutan yarısı ise gerçek bir kusurdu: tablo BOŞ açılıyordu. Aksesuar modeli
// seçilse bile doldurulacak satır olmadığı için kW sütunları boş kalıyor,
// kullanıcı on iki satırı elle açıp devir/%zaman/°C yazmak zorunda kalıyordu.
// Bu kütüphane o boşluğu kapatıyor: çevrimler ÖLÇÜLMÜŞ kayıtlar olarak
// duruyor, tablo bir kayıtla dolu açılıyor ve kullanıcı kendi motorununkini
// tek seçimle uyguluyor.
//
// ── KAYITLAR ÖLÇÜLDÜ, ÇEVRİM UYDURULMADI ───────────────────────────────────
// Yedi kaydın altısı doğrulama fixture'ındaki Gates raporlarından, yedincisi
// tedarikçiye giden BMC bilgi sayfasından (`VE_FEAD_EXAMPLES.BMC_FEAD_2026`)
// çıkarıldı — yani hepsi deponun başka bir yerinde zaten duran ve kapıları
// besleyen sayılar. `kaynak` alanı hangi ölçümden geldiğini söyler.
//
// İKİNCİ KOPYA UYARISI: buradaki diziler fixture'ın ve örneğin AYNISI olmak
// zorunda. Ayrışırsa hata SESSİZ olur — kullanıcı çevrim seçer, model çözülür,
// uyarı çıkmaz, yalnız ömür ve yorulma payları raporunkinden başka çıkar.
// `tests/unit/fead-duty.test.js` yedi kaydın hepsini kaynağına karşı BİREBİR
// karşılaştırıyor.
//
// ── °C AYRI BİR ALAN, DİZİ DEĞİL ───────────────────────────────────────────
// Ölçülen 14 sistemin 14'ünde de bütün satırlar aynı sıcaklıkta (90 °C).
// Satır başına dizi tutmak, olmayan bir çözünürlük iddia etmek olurdu; köprü
// zaten satır başına °C kabul ediyor (`veFeadDutyDegC` hasar-eşdeğer
// indirgemeyi orada yapıyor), yani ileride farklılaşırsa alan hazır.

var VE_FEAD_DUTY_LIB_VERSION = '1.0.0';
var VE_FEAD_DUTY_LIB_SOURCE =
  'tests/fixtures/fead-validation.js (Gates raporları) + VE_FEAD_EXAMPLES.BMC_FEAD_2026';

// Ölçülen sıcaklık — 14 sistemin 14'ünde de aynı.
var VE_FEAD_DUTY_DEGC = 90;

var VE_FEAD_DUTY_DB = [
  {
    key: 'BMC-9',
    ad: 'BMC 6 silindir — tedarikçi sayfası',
    kaynak: 'FEAD_INFORMATION (BMC, 26.05.2025)',
    not: 'Tedarikçiye GİDEN sayfanın kendi çevrimi. Rölanti ağırlıklı (%25) ' +
         've 2750 RPM\'ya kadar uzanıyor.',
    rpm:   [800, 1000, 1250, 1500, 1750, 2000, 2250, 2500, 2750],
    dcPct: [25,     4,    5,    6,    9,   12,   18,   16,    5]
  },
  {
    key: 'AG00976-12',
    ad: 'Cummins ALT&AC — Gates AG00976',
    kaynak: 'Gates AG00976 (4 sistem: 1715/1705/1668/1655)',
    not: 'Arşivin en ince çözünürlüklü çevrimi; 1400–1800 bandını altı ' +
         'noktaya bölüyor.',
    rpm:   [800, 1000, 1100, 1200, 1400, 1500, 1600, 1700, 1800, 2000, 2500, 2750],
    dcPct: [25,     4,  4.5,    5,  5.5,    6,  7.5,    9,  0.5,   12,   16,    5]
  },
  {
    key: 'AG00686-6',
    ad: 'Altı noktalı ağır ticari — Gates AG00686',
    kaynak: 'Gates AG00686 / AG0868 ailesi (5 sistem)',
    not: 'Arşivde EN ÇOK sistemin paylaştığı çevrim: rölantiden anma ' +
         'devrine altı kademe.',
    rpm:   [800, 1000, 1250, 1500, 1750, 2000],
    dcPct: [27,    10,   13,   18,   19,   13]
  },
  {
    key: 'AG00810-10',
    ad: 'Ara noktaları sıfır ağırlıklı — Gates AG00810',
    kaynak: 'Gates AG00810',
    not: 'AG00686 ile aynı ağırlıklar, araya SIFIR ağırlıklı devir noktaları ' +
         'serpiştirilmiş: o noktalar gerilme tablosuna girer, ömür ağırlığına girmez.',
    rpm:   [600, 900, 1000, 1200, 1400, 1500, 1600, 1800, 1900, 2000],
    dcPct: [27,    0,   10,   13,    0,   18,    0,   19,    0,   13]
  },
  {
    key: 'AG00894-10',
    ad: 'Düşük devirli — Gates AG00894',
    kaynak: 'Gates AG00894',
    not: 'Devir noktaları eşit aralıklı değil, 519 RPM\'dan başlıyor; ' +
         'ağırlığın %85\'i 1400 RPM altında.',
    rpm:   [519, 693, 1000, 1039, 1212, 1385, 1558, 1731, 1904, 2077],
    dcPct: [26.6, 10,   13,   17,   18,    8,    4,    3,  0.3,  0.1]
  },
  {
    key: 'AG00879-5',
    ad: 'Beş noktalı — Gates AG00879',
    kaynak: 'Gates AG00879',
    not: 'Ağırlığın %70\'i 800–1200 RPM arasında toplanmış.',
    rpm:   [600, 800, 1200, 1700, 2200],
    dcPct: [5,    35,   35,   20,    5]
  },
  {
    key: 'AG00902-4',
    ad: 'Dört noktalı, 3000 RPM\'ya kadar — Gates AG00902',
    kaynak: 'Gates AG00902 (2 sistem: 1300/1275)',
    not: 'Arşivin en kaba çevrimi ve en yüksek devri; ağırlığın %80\'i ' +
         '700–1200 RPM arasında.',
    rpm:   [700, 1200, 2000, 3000],
    dcPct: [35,    45,   19,    1]
  }
];

// VARSAYILAN — hangi kayıtla açılacağı.
//
// AG00686 seçildi ve gerekçesi ARŞİVDEN: 14 sistemin 5'i (en çoğu) bu çevrimi
// paylaşıyor, devir bandı (800–2000) ağır ticari bir motorun rölanti–anma
// aralığı, ve altı satır elle gözden geçirilebilecek kadar kısa. Bu bir
// "standart" İDDİASI DEĞİL: seçici hemen üstünde duruyor ve kartın künyesi
// hangi kaydın yüklü olduğunu adıyla yazıyor.
var VE_FEAD_DUTY_DEFAULT = 'AG00686-6';

// ── OKUYUCULAR ─────────────────────────────────────────────────────────────

function _fdDutyDeep(rec){
  return {
    key: rec.key, ad: rec.ad, kaynak: rec.kaynak, not: rec.not,
    rpm: rec.rpm.slice(), dcPct: rec.dcPct.slice()
  };
}

// KOPYA döner: kütüphane sürümü değişip bir değer düzeltilse bile kaydedilmiş
// proje kendiliğinden değişmesin (structural-materials.js'in kendi kuralı).
function veFeadDutyList(){
  return VE_FEAD_DUTY_DB.map(_fdDutyDeep);
}

function veFeadDutyOf(key){
  for(var i = 0; i < VE_FEAD_DUTY_DB.length; i++)
    if(VE_FEAD_DUTY_DB[i].key === key) return _fdDutyDeep(VE_FEAD_DUTY_DB[i]);
  return null;
}

// TEK ETİKET ÜRETECİ — panel de sihirbaz da buradan okur. İki yüzey aynı
// listeyi farklı adlandırsaydı kullanıcı sihirbazda seçtiğini panelde
// bulamazdı (gergi künyesi turunda ölçülmüş sınıf).
function veFeadDutyLabel(rec){
  if(!rec) return '';
  var n = rec.rpm ? rec.rpm.length : 0;
  if(!n) return String(rec.ad || rec.key || '');
  return rec.ad + '  ·  ' + n + ' nokta · '
       + rec.rpm[0] + '–' + rec.rpm[n - 1] + ' RPM';
}

// Kayıt → duty satırları. Satır biçimi hem çözücü düğümünün (`node.data.duty`)
// hem sihirbazın (`st.solver.duty`) kullandığı biçim: kW sözlüğü BOŞ başlar,
// çünkü güç aksesuarın katalog modelinden hesaplanır — elle girilmez.
function veFeadDutyRowsOf(key, degC){
  var rec = veFeadDutyOf(key);
  if(!rec) return [];
  var t = (degC === undefined || degC === null || degC === '')
    ? VE_FEAD_DUTY_DEGC : degC;
  return rec.rpm.map(function(r, i){
    return { rpm: r, dcPct: rec.dcPct[i], degC: t, kw: {} };
  });
}

// Bir tablonun hangi kütüphane kaydına karşılık geldiğini söyler; hiçbirine
// uymuyorsa null. Seçicinin "şu an hangisi yüklü" sorusunu cevaplayan tek
// yer burası — panel ile sihirbaz ayrı ayrı tahmin etseydi biri "AG00686",
// öbürü "özel" diyebilirdi.
//
// kW'a BAKMAZ: kullanıcı güç girmiş olabilir, çevrim yine o çevrimdir.
function veFeadDutyMatch(rows){
  if(!Array.isArray(rows) || !rows.length) return null;
  for(var i = 0; i < VE_FEAD_DUTY_DB.length; i++){
    var rec = VE_FEAD_DUTY_DB[i];
    if(rec.rpm.length !== rows.length) continue;
    var tut = true;
    for(var j = 0; j < rows.length; j++){
      if(Number(rows[j].rpm) !== rec.rpm[j] ||
         Math.abs(Number(rows[j].dcPct) - rec.dcPct[j]) > 1e-9){ tut = false; break; }
    }
    if(tut) return rec.key;
  }
  return null;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    VE_FEAD_DUTY_LIB_VERSION: VE_FEAD_DUTY_LIB_VERSION,
    VE_FEAD_DUTY_LIB_SOURCE: VE_FEAD_DUTY_LIB_SOURCE,
    VE_FEAD_DUTY_DEGC: VE_FEAD_DUTY_DEGC,
    VE_FEAD_DUTY_DB: VE_FEAD_DUTY_DB,
    VE_FEAD_DUTY_DEFAULT: VE_FEAD_DUTY_DEFAULT,
    veFeadDutyList: veFeadDutyList,
    veFeadDutyOf: veFeadDutyOf,
    veFeadDutyLabel: veFeadDutyLabel,
    veFeadDutyRowsOf: veFeadDutyRowsOf,
    veFeadDutyMatch: veFeadDutyMatch
  };
}
