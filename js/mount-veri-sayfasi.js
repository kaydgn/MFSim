// ============================================================================
//  TAKOZ — VERİ SAYFASI KATALOĞU (motor · şanzıman)
// ============================================================================
// Gövdenin kütlesi, ağırlık merkezi ve ataleti üreticinin veri sayfasından
// (kullanıcı, 2026-11-02): veri sayfası ağırlık merkezini bir REFERANSTAN
// uzaklık olarak verir — motorda bloğun ön yüzünden geriye ve krank ekseninin
// üstüne. Referans STEP'in 3B'sinde seçilir, ağırlık merkezi oradan hesaplanır
// (js/mount-step.js → veMntStpVeriKonum). DOM'suz saf veri: buraya hiçbir şey
// yazılmaz.
//
// Değerler programın içinde (kullanıcı kararı, 2026-11-02 — belgelerin gizlilik
// damgası soruldu).
//
// Alanlar:
//   k        anahtar — projenin rol kaydına yazılır, DEĞİŞMEZ
//   tip      rol (mnt-motor · mnt-gearbox)
//   ad       veri sayfasındaki model adı
//   uretici · konfig · kaynak   künye
//   kutle    { kuru, islak } kg
//   cg       { boy, yukari } mm — boy: referans yüzünden birimin içine, eksen
//            boyunca; yukari: eksenden yukarı, eksene dik düşey düzlemde.
//            Yanal kaçıklık veri sayfasında yok: ağırlık merkezi eksenin
//            düşey düzleminde
//   atalet   { x, y, z } kg·m² — ağırlık merkezinde, birimin eksenlerinde:
//            x eksen boyunca (roll) · y yanal (pitch) · z düşey (yaw)
//   ref      { yuz, eksen } — referansların veri sayfasındaki adı (3B'nin
//            seçim düğmeleri)

var VE_MNT_VERI_SAYFASI = [
  { k: 'cummins-isb67-360', tip: 'mnt-motor', ad: 'ISB6.7 360', uretici: 'Cummins', konfig: 'D313003BX03',
    kaynak: 'Cummins Base Engine Data Sheet · Rev. 2 (03.11.2011)',
    kutle: { kuru: 485, islak: 512 }, cg: { boy: 402, yukari: 144 }, atalet: { x: 19.2, y: 49.6, z: 42.9 },
    ref: { yuz: 'Bloğun ön yüzü', eksen: 'Krank ekseni' } }
];

function veMntVeriSayfasi(k){
  for(var i = 0; i < VE_MNT_VERI_SAYFASI.length; i++) if(VE_MNT_VERI_SAYFASI[i].k === k) return VE_MNT_VERI_SAYFASI[i];
  return null;
}
// Rolün modelleri (kütle kaynağı listesi)
function veMntVeriSayfalari(tip){
  return VE_MNT_VERI_SAYFASI.filter(function(v){ return v.tip === tip; });
}

if(typeof module !== 'undefined' && module.exports){
  module.exports = { VE_MNT_VERI_SAYFASI: VE_MNT_VERI_SAYFASI, veMntVeriSayfasi: veMntVeriSayfasi, veMntVeriSayfalari: veMntVeriSayfalari };
}
