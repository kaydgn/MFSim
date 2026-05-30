// ============================================================================
// TEMA YÖNETİMİ
// ============================================================================
// Tema seçimi artık Ayarlar modalı içinden yapılır (settings.js); bu modül
// sadece çekirdek changeTheme + kayıtlı tema yükleme sağlar. Aktif (✓) sınıfı
// herhangi bir yerdeki [data-mf-theme] öğelerinde otomatik güncellenir.
function changeTheme(themeId) {
  document.documentElement.setAttribute('data-theme', themeId);
  try { localStorage.setItem('mf-theme', themeId); } catch(e) {}
  // ✓ işaretini Ayarlar modalı (ve gelecekteki başka kullanım) için senkronla
  var items = document.querySelectorAll('[data-mf-theme]');
  items.forEach(function(it) {
    it.classList.toggle('active', it.getAttribute('data-mf-theme') === themeId);
  });
  // Açık 3D yapısal analiz görüntüleyicilerinin arka planını yeni temaya uyarla.
  if (typeof veFEAApplyThemeToViewers === 'function') veFEAApplyThemeToViewers();
}

// Geçerli tema kimlikleri (kaldırılan/eski değerler için güvenli fallback)
var MF_VALID_THEMES = ['slate','cream','claude','ansys','fusion','vscode','pearl','steel','solidworks'];

// Kayıtlı temayı uygula (loader-sonrası yüklemede DOMContentLoaded geçmiş
// olabilir, bu durumda hemen tetikle)
function _veApplyStoredTheme() {
  var savedTheme = 'slate';
  try { savedTheme = localStorage.getItem('mf-theme') || 'slate'; } catch(e) {}
  // Artık desteklenmeyen bir tema kayıtlıysa (örn. eski "auto") varsayılana dön
  if (MF_VALID_THEMES.indexOf(savedTheme) === -1) savedTheme = 'slate';
  changeTheme(savedTheme);
}
if(document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', _veApplyStoredTheme);
} else {
  _veApplyStoredTheme();
}
