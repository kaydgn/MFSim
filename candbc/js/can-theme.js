// ═══════════════════════════════════════════════════════════════════════════
// TEMA — işletim sistemini izler, kullanıcı geçersiz kılabilir
// ═══════════════════════════════════════════════════════════════════════════
//
// CAN Çözümleyici BAĞIMSIZ bir programdır: MFSim'in js/theme.js'ini de Ölçüm
// Görüntüleyici'nin viewer/js/theme.js'ini de KOPYALAMAZ. İkisinden birini
// kopyalasaydık depoda senkron tutulması gereken üçüncü bir dosya olurdu ve
// CLAUDE.md'nin "elle cp YAPMA" kapısı yeni bir kenar kazanırdı. Buradaki
// mantık aynı fikirdedir ama kendi başına durur ve kendi anahtarını kullanır.
//
// ÜÇ DURUM, TEK DÜĞME — Sistem → Açık → Koyu → Sistem
// Depolama: localStorage['mfcan-theme'] ∈ {'system','light','dark'}; yoksa
// 'system'. Anahtar MFSim'in 'mf-theme'inden de görüntüleyicinin
// 'mfv-theme'inden de AYRI: aynı tarayıcıda üç program birden açılabiliyor ve
// birinin teması diğerininkini ezmemeli.

// Tema kimlikleri css/styles.css'teki [data-theme] bloklarından. İkisi de nötr
// gri-mavi ailede ve mavi aksanlı: tema değişince eğri renkleri
// (CDB_SIGNAL_COLORS) aynı kaldığı için zemin de aynı aileden olmalı.
var CDB_DARK  = 'slate';
var CDB_LIGHT = 'pearl';
var CDB_THEME_KEY = 'mfcan-theme';

function cdbStoredThemeMode() {
  var v = null;
  try { v = localStorage.getItem(CDB_THEME_KEY); } catch(e) {}
  return (v === 'light' || v === 'dark' || v === 'system') ? v : 'system';
}

// İşletim sistemi koyu mu? Tarayıcı bilmiyorsa AÇIK kabul edilir —
// belirsizlikte kağıt, ekranın varsayılanı.
function cdbOsDark() {
  try {
    return !!(window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
  } catch(e) { return false; }
}

// Mod → gerçek tema kimliği. index.html'in <head>'indeki erken boyama
// script'i AYNI mantığı yürütür; biri değişirse öteki de değişmek zorunda.
function cdbThemeId(mode) {
  var dark = (mode === 'dark') || (mode === 'system' && cdbOsDark());
  return dark ? CDB_DARK : CDB_LIGHT;
}

function cdbThemeLabel(mode) {
  return mode === 'light' ? 'Açık' : mode === 'dark' ? 'Koyu' : 'Sistem';
}

function cdbApplyTheme(mode) {
  document.documentElement.setAttribute('data-theme', cdbThemeId(mode));
  var lbl = document.getElementById('cdb-theme-label');
  if (lbl) lbl.textContent = cdbThemeLabel(mode);
  // Grafik canvas'a sabit renk yazılmıyor; tema değişince yeniden çizilmeli.
  if (typeof cdbChartRedraw === 'function') cdbChartRedraw();
}

function cdbCycleTheme() {
  var order = ['system', 'light', 'dark'];
  var next = order[(order.indexOf(cdbStoredThemeMode()) + 1) % order.length];
  try { localStorage.setItem(CDB_THEME_KEY, next); } catch(e) {}
  cdbApplyTheme(next);
}

function cdbInitTheme() {
  var mode = cdbStoredThemeMode();
  cdbApplyTheme(mode);
  // Kullanıcı "Sistem"deyse işletim sistemi gün içinde koyuya geçtiğinde
  // program da geçsin — sayfayı yenilemeye gerek kalmasın.
  try {
    var mq = window.matchMedia('(prefers-color-scheme: dark)');
    var onChange = function() {
      if (cdbStoredThemeMode() === 'system') cdbApplyTheme('system');
    };
    if (mq.addEventListener) mq.addEventListener('change', onChange);
    else if (mq.addListener) mq.addListener(onChange);
  } catch(e) {}
}

// Canvas'a sabit renk YAZILMAZ (bkz. UI_PATTERN_GUIDE, "Ölçüm Penceresi" §8).
// Tema değişkenleri CSS'te; canvas onları ancak hesaplanmış stilden okuyabilir.
function cdbCssVar(name, fallback) {
  try {
    var v = getComputedStyle(document.documentElement).getPropertyValue(name);
    v = (v || '').trim();
    return v || fallback;
  } catch(e) { return fallback; }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { cdbThemeId: cdbThemeId, cdbThemeLabel: cdbThemeLabel };
}
