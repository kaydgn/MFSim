// ============================================================================
// TEMA YÖNETİMİ
// ============================================================================
function changeTheme(themeId) {
  document.documentElement.setAttribute('data-theme', themeId);
  try { localStorage.setItem('mf-theme', themeId); } catch(e) {}
  // Menüdeki aktif (✓) işaretini güncelle
  var items = document.querySelectorAll('.ve-theme-menu-item');
  items.forEach(function(it) {
    it.classList.toggle('active', it.getAttribute('data-mf-theme') === themeId);
  });
  // Seçim yapıldı → menüyü kapat
  var menu = document.getElementById('ve-theme-menu');
  if(menu) menu.style.display = 'none';
  // Açık 3D yapısal analiz görüntüleyicilerinin arka planını yeni temaya uyarla.
  if (typeof veFEAApplyThemeToViewers === 'function') veFEAApplyThemeToViewers();
}

function veToggleThemeMenu() {
  var menu = document.getElementById('ve-theme-menu');
  if(!menu) return;
  var open = menu.style.display !== 'block';
  menu.style.display = open ? 'block' : 'none';
  // Aynı anda açık dosya menüsü varsa kapat
  if(open) {
    var fileMenu = document.getElementById('ve-file-menu');
    if(fileMenu) fileMenu.style.display = 'none';
  }
}

// Dışına tıklayınca kapat
document.addEventListener('click', function(e) {
  var menu = document.getElementById('ve-theme-menu');
  var btn = document.getElementById('ve-theme-btn');
  if(!menu || !btn) return;
  if(menu.style.display === 'block' && !menu.contains(e.target) && !btn.contains(e.target)) {
    menu.style.display = 'none';
  }
});

// Kayıtlı temayı uygula (loader-sonrası yüklemede DOMContentLoaded zaten geçmiş
// olabilir, bu durumda hemen tetikle)
function _veApplyStoredTheme() {
  var savedTheme = 'slate';
  try { savedTheme = localStorage.getItem('mf-theme') || 'slate'; } catch(e) {}
  changeTheme(savedTheme);
}
if(document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', _veApplyStoredTheme);
} else {
  _veApplyStoredTheme();
}
