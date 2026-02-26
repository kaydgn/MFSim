// ============================================================================
// TEMA YÖNETİMİ
// ============================================================================
function changeTheme(themeId) {
  document.documentElement.setAttribute('data-theme', themeId);
  try { localStorage.setItem('mf-theme', themeId); } catch(e) {}
  var sel = document.getElementById('theme-select');
  if(sel) sel.value = themeId;
}

// Sayfa yüklendiğinde kayıtlı temayı uygula
document.addEventListener('DOMContentLoaded', function() {
  var savedTheme = 'slate';
  try { savedTheme = localStorage.getItem('mf-theme') || 'slate'; } catch(e) {}
  changeTheme(savedTheme);
});
