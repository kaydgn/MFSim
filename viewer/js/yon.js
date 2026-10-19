// ═══════════════════════════════════════════════════════════════════════════
// YÖNLENDİRME YUVASI — ARAYÜZ ANLATMAZ'ın dördüncü metin türü (kullanıcı
// kararı 2026-10-19). Bir sonraki adımı söyleyen TEK cümle: boş durumun
// başlangıcı, durumun çaresi, gizli etkileşim. İşlev metni değiştirmez;
// tarayıcı (tools/metin-dili.js) yuvayı bu çağrıdan tanır ve biçimini ölçer.
// Çağrısız yazılan emir cümlesi "tarif" sayılır ve kapıdan geçmez.
//
//   showToast('Rapor verisi yok. ' + veYon('Çözücü penceresinde Hesapla ile çözün.'))
//
// Görüntüleyiciye birebir kopya (viewer/sync.js); CAN Çözümleyici kendi
// eşini taşır (candbc/js/can-app.js → cdbYon).
// ═══════════════════════════════════════════════════════════════════════════

function veYon(metin) {
  return metin;
}

if(typeof module !== 'undefined' && module.exports) {
  module.exports = { veYon: veYon };
}
