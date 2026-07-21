// ============================================================================
// PENCERE SÜRÜKLEME — Bileşen Özellik Penceresi (#ve-properties)
// ============================================================================
// Bileşene çift tıklayınca / marker'a tıklayınca açılan özellik penceresini
// başlığından tutup sürüklenebilir yapar. Pencere HER AÇILIŞTA ve başka bir
// bileşene geçişte ORTALANIR — sürükleme kalıcı değildir (localStorage'a
// kaydedilmez). Sürüklenen konum yalnızca aynı bileşenin penceresi açık kaldığı
// sürece (sekme/profil vb. yerinde yenilemelerde) korunur; bileşen değişince
// veya pencere yeniden açılınca ortaya döner.
//
// Tasarım notları:
//  - Sürükleme sırasında pencere `position:absolute; left/top` (viewport
//    koordinatı) kullanır; giriş `transform:scale(...)` animasyonuyla çakışmaz.
//  - Konum her uygulanışta viewport'a clamp'lenir → ekran küçülse/değişse bile
//    pencere ekran dışına kaçmaz, başlık her zaman erişilebilir kalır.
//  - Açılış, #ve-properties-overlay üzerinde MutationObserver ile yakalanır;
//    display:flex olunca pencere doğrudan resetToCenter ile ortalanır.
//  - Bileşen değişiminde ortalama cp-core.js showNodeProperties'te tetiklenir.
//  - Başlığa ÇİFT TIK → konumu anında ortalar.
//
// Test edilebilir saf fonksiyonlar module.exports ile dışa verilir.
// ============================================================================

(function(global) {
  'use strict';

  var STORE_KEY  = 'mf-properties-pos';
  var OVERLAY_ID = 've-properties-overlay';
  var WIN_SEL    = '.ve-properties';
  var HEADER_SEL = '.ve-properties-header';
  var MARGIN     = 8;   // pencere-viewport kenar boşluğu (px)

  // ─── Kalıcılık ─────────────────────────────────────────────────────────────
  function loadPos() {
    try {
      var raw = global.localStorage && global.localStorage.getItem(STORE_KEY);
      if (!raw) return null;
      var p = JSON.parse(raw);
      if (p && typeof p.left === 'number' && typeof p.top === 'number' &&
          isFinite(p.left) && isFinite(p.top)) {
        return { left: p.left, top: p.top };
      }
    } catch (e) {}
    return null;
  }

  function savePos(left, top) {
    try {
      if (global.localStorage) {
        global.localStorage.setItem(STORE_KEY, JSON.stringify({ left: Math.round(left), top: Math.round(top) }));
      }
    } catch (e) {}
  }

  function clearPos() {
    try { if (global.localStorage) global.localStorage.removeItem(STORE_KEY); } catch (e) {}
  }

  // ─── Konumu viewport içinde tut (saf fonksiyon — testlenebilir) ─────────────
  // Pencere viewport'a sığıyorsa MARGIN boşlukla içeride tutar; sığmıyorsa
  // sol/üst kenara MARGIN ile yapıştırır (başlık her zaman görünür kalır).
  function clampPos(left, top, winW, winH, vpW, vpH) {
    var maxLeft = Math.max(MARGIN, vpW - winW - MARGIN);
    var maxTop  = Math.max(MARGIN, vpH - winH - MARGIN);
    return {
      left: Math.min(Math.max(left, MARGIN), maxLeft),
      top:  Math.min(Math.max(top,  MARGIN), maxTop)
    };
  }

  // ─── DOM yardımcıları (jsdom'da element yoksa güvenle no-op) ────────────────
  function _win() {
    var ov = global.document && global.document.getElementById(OVERLAY_ID);
    return ov ? ov.querySelector(WIN_SEL) : null;
  }

  function _vp() {
    return {
      w: (global.innerWidth  || (global.document && global.document.documentElement && global.document.documentElement.clientWidth)  || 1280),
      h: (global.innerHeight || (global.document && global.document.documentElement && global.document.documentElement.clientHeight) || 800)
    };
  }

  // Pencereyi mutlak konuma al (verilen viewport-left/top)
  function _placeAbsolute(win, left, top) {
    win.style.position = 'absolute';
    win.style.margin   = '0';
    win.style.left     = left + 'px';
    win.style.top      = top + 'px';
  }

  // Kayıtlı konumu (varsa) pencereye uygula; yoksa varsayılan (flex ortalama)
  function applyStoredPosition() {
    var win = _win();
    if (!win) return;
    var p = loadPos();
    if (!p) { resetToCenter(win); return; }
    var rect = win.getBoundingClientRect ? win.getBoundingClientRect() : { width: 0, height: 0 };
    var vp = _vp();
    var c = clampPos(p.left, p.top, rect.width, rect.height, vp.w, vp.h);
    _placeAbsolute(win, c.left, c.top);
  }

  // Ortaya döndür (inline stilleri temizle → CSS flex ortalaması devreye girer)
  function resetToCenter(win) {
    win = win || _win();
    if (!win) return;
    win.style.position = '';
    win.style.left     = '';
    win.style.top      = '';
    win.style.margin   = '';
  }

  // ─── Sürükleme etkileşimi ───────────────────────────────────────────────────
  var _drag = { active: false, startX: 0, startY: 0, baseLeft: 0, baseTop: 0, win: null };

  function _onHeaderMouseDown(e) {
    if (e.button !== 0) return;
    // Kapatma butonuna / buton içine tıklamada sürükleme başlatma
    if (e.target.closest && e.target.closest('.ve-properties-close, button')) return;
    var win = _win();
    if (!win) return;

    var rect = win.getBoundingClientRect();
    _drag.active   = true;
    _drag.win      = win;
    _drag.startX   = e.clientX;
    _drag.startY   = e.clientY;
    _drag.baseLeft = rect.left;   // flex-ortalıysa bile mevcut viewport konumu
    _drag.baseTop  = rect.top;

    // Yerinde absolute'e geç (zıplama olmadan)
    _placeAbsolute(win, rect.left, rect.top);
    if (global.document && global.document.body) global.document.body.classList.add('ve-window-dragging');
    e.preventDefault();
  }

  function _onMouseMove(e) {
    if (!_drag.active || !_drag.win) return;
    var vp = _vp();
    var w = _drag.win.offsetWidth, h = _drag.win.offsetHeight;
    var nl = _drag.baseLeft + (e.clientX - _drag.startX);
    var nt = _drag.baseTop  + (e.clientY - _drag.startY);
    var c = clampPos(nl, nt, w, h, vp.w, vp.h);
    _drag.win.style.left = c.left + 'px';
    _drag.win.style.top  = c.top + 'px';
  }

  function _onMouseUp() {
    if (!_drag.active) return;
    _drag.active = false;
    if (global.document && global.document.body) global.document.body.classList.remove('ve-window-dragging');
    _drag.win = null;
    // Sürükleme KALICI DEĞİL: konum localStorage'a kaydedilmez. Pencere her
    // açılışta ve başka bileşene geçişte ortalanır (bkz. cp-core.js
    // showNodeProperties → VEWindowDrag.resetToCenter). Sürüklenen konum yalnız
    // aynı bileşen açık kaldığı sürece (yerinde yenilenmelerde) korunur.
  }

  // Başlığa çift tık → konumu sıfırla
  function _onHeaderDblClick(e) {
    if (e.target.closest && e.target.closest('.ve-properties-close, button')) return;
    clearPos();
    resetToCenter();
    if (typeof global.showToast === 'function') global.showToast('Pencere konumu sıfırlandı', 'info');
  }

  // ─── Kurulum ────────────────────────────────────────────────────────────────
  function init() {
    if (!global.document) return;
    var ov = global.document.getElementById(OVERLAY_ID);
    if (!ov) return;

    // Eski sürümden kalan kayıtlı konumu temizle (artık kalıcılık yok).
    clearPos();

    // Sürükleme dinleyicileri (başlık delege — pencere içeriği yeniden yazılsa da kalır)
    ov.addEventListener('mousedown', function(e) {
      if (e.target.closest && e.target.closest(HEADER_SEL)) _onHeaderMouseDown(e);
    });
    ov.addEventListener('dblclick', function(e) {
      if (e.target.closest && e.target.closest(HEADER_SEL)) _onHeaderDblClick(e);
    });
    global.document.addEventListener('mousemove', _onMouseMove);
    global.document.addEventListener('mouseup', _onMouseUp);

    // Açılışı yakala: overlay display:flex olunca pencereyi ORTALA.
    // (rAF ile paint öncesi uygula → zıplama olmaz.) Kalıcı konum yok — her
    // açılış ortadan başlar; bileşen değişimi cp-core.js'te ele alınır.
    var apply = function() {
      if (ov.style.display === 'flex') {
        if (global.requestAnimationFrame) global.requestAnimationFrame(function() { resetToCenter(); });
        else resetToCenter();
      }
    };
    if (typeof global.MutationObserver === 'function') {
      var mo = new global.MutationObserver(apply);
      mo.observe(ov, { attributes: true, attributeFilter: ['style'] });
    }
    // Zaten açıksa (ör. hot-reload) hemen uygula
    apply();
  }

  if (global.document) {
    if (global.document.readyState === 'loading') {
      global.document.addEventListener('DOMContentLoaded', init);
    } else {
      init();
    }
  }

  // ─── Export ─────────────────────────────────────────────────────────────────
  var api = {
    STORE_KEY: STORE_KEY,
    loadPos: loadPos,
    savePos: savePos,
    clearPos: clearPos,
    clampPos: clampPos,
    applyStoredPosition: applyStoredPosition,
    resetToCenter: resetToCenter,
    init: init
  };
  global.VEWindowDrag = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;

})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this));
