// ============================================================================
// TEMA YÖNETİMİ
// ============================================================================

// "auto" modunda sistem tercihine göre eşlenecek temalar
var THEME_AUTO_DARK = 'slate';
var THEME_AUTO_LIGHT = 'pearl';

// Sistem koyu/açık tercihi (auto modu için medya sorgusu)
var _mfDarkMql = (typeof window !== 'undefined' && window.matchMedia)
  ? window.matchMedia('(prefers-color-scheme: dark)')
  : null;

// "auto" seçiliyken OS teması değişince yeniden uygula
function _mfOnSystemThemeChange() {
  var cur = 'slate';
  try { cur = localStorage.getItem('mf-theme') || 'slate'; } catch(e) {}
  if (cur === 'auto') _mfApplyResolvedTheme('auto');
}

// Tema kimliğini gerçek bir data-theme değerine çözüp uygula
function _mfApplyResolvedTheme(themeId) {
  var resolved = themeId;
  if (themeId === 'auto') {
    var prefersDark = _mfDarkMql ? _mfDarkMql.matches : false;
    resolved = prefersDark ? THEME_AUTO_DARK : THEME_AUTO_LIGHT;
  }
  document.documentElement.setAttribute('data-theme', resolved);
  // Açık 3D yapısal analiz görüntüleyicilerinin arka planını yeni temaya uyarla.
  if (typeof veFEAApplyThemeToViewers === 'function') veFEAApplyThemeToViewers();
}

function changeTheme(themeId) {
  try { localStorage.setItem('mf-theme', themeId); } catch(e) {}

  // Menüdeki aktif (✓) işaretini güncelle ("auto" da bir menü öğesidir)
  var items = document.querySelectorAll('.ve-theme-menu-item');
  items.forEach(function(it) {
    it.classList.toggle('active', it.getAttribute('data-mf-theme') === themeId);
  });
  // Seçim yapıldı → menüyü kapat
  var menu = document.getElementById('ve-theme-menu');
  if(menu) menu.style.display = 'none';

  // Yalnızca "auto" modunda sistem tercihi değişimlerini dinle.
  if (_mfDarkMql && _mfDarkMql.addEventListener) {
    _mfDarkMql.removeEventListener('change', _mfOnSystemThemeChange);
    if (themeId === 'auto') _mfDarkMql.addEventListener('change', _mfOnSystemThemeChange);
  }

  _mfApplyResolvedTheme(themeId);
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
