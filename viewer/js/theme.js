// ═══════════════════════════════════════════════════════════════════════════
// TEMA — işletim sistemini izler, kullanıcı geçersiz kılabilir
// ═══════════════════════════════════════════════════════════════════════════
//
// VIEWER'A ÖZGÜ DOSYA. MFSim'in js/theme.js'i on altı tema taşıyor ve açılışta
// koşulsuz 'slate'e düşüyor; orada bu doğru, çünkü tema Ayarlar panelinden
// seçilen bir tercih. Burada tema bir tercih DEĞİL, ortama uyum meselesi:
// program tek başına, günün her saatinde açık duracak. Bu yüzden varsayılan
// işletim sisteminin kendisi.
//
// ÜÇ DURUM, TEK DÜĞME — Sistem → Açık → Koyu → Sistem
// İki durumlu bir anahtar (yalnız Açık/Koyu) daha basit olurdu ama kullanıcı
// bir kez dokunduktan sonra sisteme GERİ DÖNEMEZDİ; "sistem gibi davransın"
// isteği de tam olarak o duruma dönebilmek demek. Düğmenin etiketi her zaman
// geçerli durumu yazar, böylece üç durumlu olması gizemli olmaz.
//
// Depolama: localStorage['mfv-theme'] ∈ {'system','light','dark'}; yoksa
// 'system'. Anahtar MFSim'in 'mf-theme'inden AYRI: aynı tarayıcıda iki program
// da açılabiliyor ve birinin teması diğerininkini ezmemeli.

// Tema kimlikleri css/styles.css'teki [data-theme] bloklarından. İkisi de nötr
// gri-mavi ailede ve mavi aksanlı: tema değişince eğri renkleri (VE_SIGNAL_COLORS)
// aynı kaldığı için zemin de aynı aileden olmalı, yoksa palet yabancı düşer.
var MFV_DARK  = 'slate';
var MFV_LIGHT = 'pearl';
var MFV_KEY   = 'mfv-theme';

// ── Tercih okuma ──────────────────────────────────────────────────────────

function mfvStoredMode() {
  var v = null;
  try { v = localStorage.getItem(MFV_KEY); } catch(e) {}
  return (v === 'light' || v === 'dark' || v === 'system') ? v : 'system';
}

// İşletim sistemi koyu mu? Tarayıcı bilmiyorsa (eski sürüm, matchMedia yok)
// AÇIK kabul edilir — belirsizlikte kağıt, ekranın varsayılanı.
function mfvOsDark() {
  try {
    return !!(window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches);
  } catch(e) { return false; }
}

// Geçerli modun karşılığı olan gerçek tema kimliği.
function mfvThemeId(mode) {
  if(mode === 'light') return MFV_LIGHT;
  if(mode === 'dark') return MFV_DARK;
  return mfvOsDark() ? MFV_DARK : MFV_LIGHT;
}

// ── Uygulama ──────────────────────────────────────────────────────────────

var MFV_LABEL = { system: 'Sistem', light: 'Açık', dark: 'Koyu' };

function mfvApply(mode) {
  document.documentElement.setAttribute('data-theme', mfvThemeId(mode));

  var lbl = document.getElementById('mfv-theme-label');
  if(lbl) lbl.textContent = MFV_LABEL[mode] || 'Sistem';
  var btn = document.getElementById('mfv-theme-btn');
  if(btn) {
    btn.title = 'Tema: ' + (MFV_LABEL[mode] || 'Sistem') +
                (mode === 'system' ? ' (işletim sistemini izliyor)' : '') +
                ' — değiştirmek için tıklayın';
    btn.setAttribute('aria-label', btn.title);
  }

  // İMLEÇ / İŞARET KATMANI YENİDEN ÇİZİLMELİ. Canvas API'si CSS değişkeni
  // çözemez; o katmanın renkleri çizim ANINDA veThemeRgba ile okunuyor
  // (js/trace-view.js'te on üç yerde: imleç çizgisi, değer kutusu, işaret
  // etiketi, bırakma vurgusu). Sabitlenmiş bir imleç varken tema değişirse
  // fare kıpırdayana kadar eski temanın renginde kalırdı.
  //
  // ŞERİTLERİN KENDİSİ için gerekli DEĞİL — ölçüldü: temel çizim (ızgara,
  // çerçeve, eksen yazısı) bilerek tema-nötr gri kullanıyor ('rgba(128,128,
  // 128,0.42)' gibi) ve eğri renkleri sabit paletten (VE_SIGNAL_COLORS)
  // geliyor. Tuval iki temada bayt bayt aynı çıkıyor; açık/koyu görünümü
  // zeminden, yani CSS'ten geliyor. Yine de tek kapıdan geçmek doğru:
  // yarın şerit çizimi temaya bağlanırsa bu satır zaten yerinde olur.
  if(typeof veTrRefresh === 'function') veTrRefresh();
}

// Sistem → Açık → Koyu → Sistem
function mfvCycleTheme() {
  var next = { system: 'light', light: 'dark', dark: 'system' }[mfvStoredMode()] || 'system';
  try { localStorage.setItem(MFV_KEY, next); } catch(e) {}
  mfvApply(next);
}

// ── Canvas renk köprüsü ───────────────────────────────────────────────────
//
// js/theme.js'ten BİREBİR. Tema değişkenini canvas'ın anlayacağı
// 'rgba(r,g,b,a)' dizgesine çevirir; çizim anında çağrıldığı için tema
// değişince bir sonraki çizimde yeni renk gelir. Tüm temalar 6 haneli hex
// tanımlar; çözülemeyen değerde fallback döner ki grafik hiç renksiz kalmasın.
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

// ── Açılış ve sistem takibi ───────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', function() {
  mfvApply(mfvStoredMode());
});

// Kullanıcı SİSTEM kipindeyken işletim sistemini gün batımında koyuya
// çevirirse program da o anda dönmeli — "sistem gibi davranmak" bu.
// Elle seçim yapılmışsa dokunulmaz.
(function() {
  var mq;
  try { mq = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)'); } catch(e) { return; }
  if(!mq) return;
  var onChange = function() {
    if(mfvStoredMode() === 'system') mfvApply('system');
  };
  // addEventListener eski Safari'de yok; addListener kaldırıldı ama hâlâ
  // çalışıyor. İkisi de yoksa takip sessizce devre dışı kalır, program çalışır.
  if(mq.addEventListener) mq.addEventListener('change', onChange);
  else if(mq.addListener) mq.addListener(onChange);
})();

// Birim testleri için (tarayıcıda etkisiz)
if(typeof module !== 'undefined' && module.exports) {
  module.exports = {
    MFV_DARK: MFV_DARK,
    MFV_LIGHT: MFV_LIGHT,
    mfvThemeId: mfvThemeId,
    veThemeRgba: veThemeRgba
  };
}
