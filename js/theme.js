// ============================================================================
// TEMA YÖNETİMİ (Ayarlar modalına taşındı — bkz. settings.js)
// ============================================================================
// Tema değiştir: data-theme uygula, kaydet, tüm [data-mf-theme] item'larını senkronize et.
function changeTheme(themeId) {
  if (!themeId) return;
  document.documentElement.setAttribute('data-theme', themeId);
  try { localStorage.setItem('mf-theme', themeId); } catch(e) {}
  // Ayarlar modalındaki tema kartlarının aktif (✓) durumunu güncelle
  document.querySelectorAll('[data-mf-theme]').forEach(function(el) {
    el.classList.toggle('active', el.getAttribute('data-mf-theme') === themeId);
  });
}

// Sayfa yüklendiğinde kayıtlı temayı uygula
document.addEventListener('DOMContentLoaded', function() {
  var savedTheme = 'slate';
  try {
    savedTheme = localStorage.getItem('mf-theme') || 'slate';
  } catch(e) {}
  // Geçersiz/eski tema değerleri (örn. kaldırılan 'auto') için güvenli geri dönüş
  var valid = ['slate','light','cream','arctic','sand','forest','iris','silver','ash','pearl','steel','claude'];
  if (valid.indexOf(savedTheme) < 0) savedTheme = 'slate';
  changeTheme(savedTheme);
});
