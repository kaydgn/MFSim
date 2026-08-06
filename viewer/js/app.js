// ═══════════════════════════════════════════════════════════════════════════
// AÇILIŞ — görüntüleyicinin tek giriş noktası
// ═══════════════════════════════════════════════════════════════════════════
//
// MFSim'de karşılığı js/results.js'teki veEnterResults(): Sonuçlar sayfasına
// her girişte çalışır, takoz sonucunu panoyla uzlaştırır, çözücü sekmelerini
// tazeler, bayat içe aktarma referanslarını temizler. Görüntüleyicide sayfa
// KAVRAMI yok — tek sayfa var ve bir kez açılıyor. Geriye üç adım kalıyor.
//
// Neden ayrı dosya: board.js "pano nasıl çalışır"ı, bu dosya "program nasıl
// başlar"ı anlatıyor. İkisini karıştırmak, açılış sırasını değiştirmek isteyen
// birini 700 satırlık bir dosyada arama yapmaya zorlardı.

function veViewerBoot() {
  // 1) Veri Gezgini — açılışta boş, "İçe Aktar" yönlendirmesini gösterir.
  veUpdateResultsTree();

  // 2) Ölçüm penceresinin kabuğu (canvas, araç çubuğu, olay bağları).
  //    veTrEnter panoya bir X ekseni de yazar; pano boşken düz zaman ekseni.
  if(typeof veTrEnter === 'function') veTrEnter();

  // 3) Veri Gezgini'nin genişlik ayırıcısı.
  veInitResultSlots();
}

// Modüller <body> sonunda ve düz <script src> ile yükleniyor; bu satır
// çalıştığında DOM hazır ama DOMContentLoaded henüz atmamış oluyor. Yine de
// iki durum da karşılanıyor: dosya ileride <head>'e taşınırsa ya da build
// çıktısında sıra değişirse açılış sessizce kaybolmasın.
if(document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', veViewerBoot, { once: true });
} else {
  veViewerBoot();
}
