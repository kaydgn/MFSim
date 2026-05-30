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
  var sel = document.getElementById('theme-select');
  if (sel) sel.value = themeId;

  // Yalnızca "auto" modunda sistem tercihi değişimlerini dinle.
  if (_mfDarkMql && _mfDarkMql.addEventListener) {
    _mfDarkMql.removeEventListener('change', _mfOnSystemThemeChange);
    if (themeId === 'auto') _mfDarkMql.addEventListener('change', _mfOnSystemThemeChange);
  }

  _mfApplyResolvedTheme(themeId);
}

// Sayfa yüklendiğinde kayıtlı temayı uygula
document.addEventListener('DOMContentLoaded', function() {
  var savedTheme = 'slate';
  try { savedTheme = localStorage.getItem('mf-theme') || 'slate'; } catch(e) {}
  changeTheme(savedTheme);
});
