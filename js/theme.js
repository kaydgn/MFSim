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
  // Geçerli temalar — CSS'teki [data-theme] blokları + Ayarlar > Görünüm listesiyle
  // birebir aynı olmalı (js/settings.js _veSettingsRenderAppearance). Listede
  // olmayan (eski/geçersiz) değerler güvenle 'slate'e döner.
  // KOYU: slate, cream, claude · PROFESYONEL: ansys, fusion, vscode · AÇIK: pearl, steel, solidworks
  var valid = ['slate','cream','claude','ansys','fusion','vscode','pearl','steel','solidworks'];
  if (valid.indexOf(savedTheme) < 0) savedTheme = 'slate';
  changeTheme(savedTheme);
});
