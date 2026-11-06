// ============================================================================
//  TAKOZ — VERİ SAYFASI KATALOĞU (motor · şanzıman)
// ============================================================================
// Gövdenin kütlesi, ağırlık merkezi ve ataleti üreticinin veri sayfasından
// (kullanıcı, 2026-11-02): veri sayfası ağırlık merkezini bir REFERANSTAN
// uzaklık olarak verir — motorda bloğun ön (X12'de arka) yüzünden ve krank
// ekseninin üstüne. Referans STEP'in 3B'sinde seçilir, ağırlık merkezi oradan
// hesaplanır (js/mount-step.js → veMntStpVeriKonum). DOM'suz saf veri: buraya
// hiçbir şey yazılmaz.
//
// Değerler programın içinde (kullanıcı kararı, 2026-11-02 — belgelerin gizlilik
// damgası soruldu). Sayılar veri sayfasındaki metrik değerler, yuvarlanmadan;
// kapı tests/unit/mount-veri-sayfasi.test.js → KATALOG.
//
// Alanlar:
//   k        anahtar — projenin rol kaydına yazılır, DEĞİŞMEZ
//   tip      rol (mnt-motor · mnt-gearbox)
//   ad       veri sayfasındaki model adı
//   uretici · konfig · kaynak   künye
//   kutle    { kuru, islak } kg — veri sayfası kuru kütleyi vermiyorsa kuru null
//   cg       { boy, yukari, yan } mm — boy: referans yüzünden birimin içine,
//            eksen boyunca; yukari: eksenden yukarı, eksene dik düşey düzlemde;
//            yan: eksenin düşey düzleminden, + motorun sağı ÖNDEN bakınca
//            (X12'nin tanımı). Veri sayfası yanal kaçıklık vermiyorsa yan yok:
//            ağırlık merkezi eksenin düşey düzleminde
//   atalet   { x, y, z } kg·m² — ağırlık merkezinde, birimin eksenlerinde:
//            x eksen boyunca (roll) · y yanal (pitch) · z düşey (yaw)
//   ref      { yuz, eksen, arka } — referansların veri sayfasındaki adı (3B'nin
//            seçim düğmeleri); arka: referans yüzü birimin ARKA yüzü — motorun
//            önü boy yönünde (yanın yönü buna bağlı)

var _VE_MNT_ON = { yuz: 'Bloğun ön yüzü', eksen: 'Krank ekseni' };

var VE_MNT_VERI_SAYFASI = [
  { k: 'cummins-isb45e5', tip: 'mnt-motor', ad: 'ISB4.5E5', uretici: 'Cummins', konfig: 'D323018BX03',
    kaynak: 'Cummins Base Engine Data Sheet · Rev. 2 (04.03.2013)',
    kutle: { kuru: 366, islak: 385 }, cg: { boy: 271, yukari: 158 }, atalet: { x: 14.7, y: 25, z: 19.1 },
    ref: _VE_MNT_ON },
  { k: 'cummins-isb67e3', tip: 'mnt-motor', ad: 'ISB6.7E3', uretici: 'Cummins', konfig: 'D313023BX03-E3',
    kaynak: 'Cummins Base Engine Data Sheet · Rev. 0 (18.09.2014)',
    kutle: { kuru: 485, islak: 512 }, cg: { boy: 402, yukari: 144 }, atalet: { x: 19.2, y: 49.6, z: 42.9 },
    ref: _VE_MNT_ON },
  { k: 'cummins-isb67-360', tip: 'mnt-motor', ad: 'ISB6.7 360', uretici: 'Cummins', konfig: 'D313003BX03',
    kaynak: 'Cummins Base Engine Data Sheet · Rev. 2 (03.11.2011)',
    kutle: { kuru: 485, islak: 512 }, cg: { boy: 402, yukari: 144 }, atalet: { x: 19.2, y: 49.6, z: 42.9 },
    ref: _VE_MNT_ON },
  // Ailenin adı sayfada boş; 6 silindir, 8,9 L, 114 × 145 mm: L9
  { k: 'cummins-l9', tip: 'mnt-motor', ad: 'L9', uretici: 'Cummins', konfig: 'D563020BX03',
    kaynak: 'Cummins Engine Family Datasheet · 24.10.2025',
    kutle: { kuru: 774, islak: 804 }, cg: { boy: 427, yukari: 212 }, atalet: { x: 29.8, y: 76.8, z: 66.9 },
    ref: _VE_MNT_ON },
  { k: 'cummins-ism11', tip: 'mnt-motor', ad: 'ISM11', uretici: 'Cummins', konfig: 'D353029BX03',
    kaynak: 'Cummins Engine Family Datasheet · 22.08.2025',
    kutle: { kuru: 940, islak: 990 }, cg: { boy: 450, yukari: 191 }, atalet: { x: 80.9, y: 164.9, z: 122.6 },
    ref: _VE_MNT_ON },
  // Ağırlık merkezi bloğun ARKA yüzünden; yalnız ıslak kütle
  { k: 'cummins-x12', tip: 'mnt-motor', ad: 'X12', uretici: 'Cummins', konfig: 'D0S3002CX03',
    kaynak: 'Cummins Engine Family Datasheet · 05.09.2024',
    kutle: { kuru: null, islak: 860 }, cg: { boy: 477, yukari: 195, yan: 0 }, atalet: { x: 51.3, y: 149, z: 123 },
    ref: { yuz: 'Bloğun arka yüzü', eksen: 'Krank ekseni', arka: true } },
  { k: 'cummins-x15', tip: 'mnt-motor', ad: 'X15', uretici: 'Cummins', konfig: 'D103018BX03',
    kaynak: 'Cummins Engine Family Datasheet · 22.08.2025',
    kutle: { kuru: 1327, islak: 1401 }, cg: { boy: 455, yukari: 244 }, atalet: { x: 110.7, y: 260.2, z: 205.9 },
    ref: _VE_MNT_ON }
];

function veMntVeriSayfasi(k){
  for(var i = 0; i < VE_MNT_VERI_SAYFASI.length; i++) if(VE_MNT_VERI_SAYFASI[i].k === k) return VE_MNT_VERI_SAYFASI[i];
  return null;
}
// Rolün modelleri (kütle kaynağı listesi)
function veMntVeriSayfalari(tip){
  return VE_MNT_VERI_SAYFASI.filter(function(v){ return v.tip === tip; });
}
// Listenin adı rolün modeli (kullanıcı 2026-11-06, Canlı Not 42: *"'Veri sayfası' ne
// demek? 'Motor modeli' falan yazsak çok daha doğru olmaz mı?"*): seçilen şey motorun
// (şanzımanın) modeli; veri sayfası onun kaynağı
var VE_MNT_MODEL_AD = { 'mnt-motor': 'Motor modeli', 'mnt-gearbox': 'Şanzıman modeli' };
function veMntModelAd(tip){ return VE_MNT_MODEL_AD[tip] || 'Model'; }

if(typeof module !== 'undefined' && module.exports){
  module.exports = { VE_MNT_VERI_SAYFASI: VE_MNT_VERI_SAYFASI, veMntVeriSayfasi: veMntVeriSayfasi, veMntVeriSayfalari: veMntVeriSayfalari,
    VE_MNT_MODEL_AD: VE_MNT_MODEL_AD, veMntModelAd: veMntModelAd };
}
