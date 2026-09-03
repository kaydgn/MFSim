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

// Tema değişkenini canvas'ın anlayacağı 'rgba(r,g,b,a)' dizgesine çevirir.
// Canvas API'si (fillStyle/strokeStyle/addColorStop) CSS değişkeni çözemez;
// bu yardımcı çizim anında çağrılır → tema değişince bir sonraki çizimde
// yeni renk gelir (minimap'in kullandığı teknikle aynı). Tüm temalar 6 haneli
// hex tanımlar; çözülemeyen değerde fallback döner ki grafik hiç renksiz
// kalmasın.
function veThemeRgba(varName, alpha, fallback) {
  var v = '';
  try {
    v = getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
  } catch(e) {}
  var m = /^#([0-9a-fA-F]{6})$/.exec(v);
  if(!m) return fallback || v || '#888888';
  var n = parseInt(m[1], 16);
  return 'rgba(' + (n >> 16 & 255) + ',' + (n >> 8 & 255) + ',' + (n & 255) + ',' + alpha + ')';
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
  // SADE: graphite, ink, basalt, mono (koyu) · paper, zinc (açık)
  // KOYU: slate, cream, claude, navy · YÜKSEK KONTRAST: contrast, amber, scope
  // PROFESYONEL: ansys, fusion, vscode · AÇIK: pearl, steel, solidworks
  var valid = ['graphite','ink','basalt','mono','paper','zinc',
               'slate','cream','claude','navy','contrast','amber','scope',
               'ansys','fusion','vscode','pearl','steel','solidworks'];
  if (valid.indexOf(savedTheme) < 0) savedTheme = 'slate';
  changeTheme(savedTheme);
});

// Birim testleri için (tarayıcıda etkisiz)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { changeTheme: changeTheme, veThemeRgba: veThemeRgba };
}
