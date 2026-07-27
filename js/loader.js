// ═══ MFSim Loader — Dinamik modul yukleyici + ilerleme cubugu ═══
//
// Login'den sonra cagrilir. Sayfada `<script type="text/x-mfsim-defer">` olarak
// isaretlenmis tum modulleri sirayla yukler, splash overlay'inde gercek
// ilerleme ve durum mesajini gosterir, bitince fade-out yapar.
//
// Hem dev mode (index.html, external src) hem monolitik build (inline icerik)
// ile calisir. Inline tag'ler textContent kopyalanarak yeniden olusturulur;
// external tag'ler yeni <script src> ile load edilir.

(function() {
  'use strict';

  // Her modul adimi arasi minimum gecikme. Toplam splash suresi yaklasik
  // (modul_sayisi * STEP_DELAY_MS) + gercek yukleme isi olur. ~42 modul icin
  // 150ms ≈ 6.3s taban + actual work = profesyonel muhendislik yazilimi hissi.
  // Her label rahatca okunabilir, kullanici neyin yuklendigini takip edebilir.
  var STEP_DELAY_MS = 150;
  // Tum yuklemenin (script'ler bitti, splash kapanmadan onceki) minimum
  // toplam suresi. Gerçek is bu su̇reden hızlıysa fark kadar bekleriz.
  var MIN_TOTAL_DURATION_MS = 6500;

  var started = false;
  var startTime = 0;
  var ELS = {
    splash: 'mfsim-loading-screen',
    bar: 'mfsim-loading-bar',
    pct: 'mfsim-loading-percent',
    msg: 'mfsim-loading-message',
    login: 'mfsim-login-overlay'
  };

  // ── DOMContentLoaded interceptor ─────────────────────────────────────────
  // Modulleri login sonrasi yukluyoruz; o ana kadar DOMContentLoaded fire
  // etmis oluyor. Modullerin `document.addEventListener('DOMContentLoaded',...)`
  // cagrilari normalde sessizce kaybolur (event gecmis). Bunlari yakalayip
  // tum moduller yuklendikten sonra elle calistiriyoruz.
  var pendingDomReady = [];
  (function patchDomReady() {
    var orig = document.addEventListener;
    document.addEventListener = function(type, handler, options) {
      if (type === 'DOMContentLoaded' && document.readyState !== 'loading') {
        pendingDomReady.push(handler);
        return;
      }
      return orig.call(document, type, handler, options);
    };
  })();

  function flushDomReady() {
    // Olasi yeniden eklemeleri ele almak icin snapshot al
    var queue = pendingDomReady.slice();
    pendingDomReady.length = 0;
    queue.forEach(function(fn) {
      try {
        fn({ type: 'DOMContentLoaded', target: document });
      } catch (e) {
        console.warn('[MFSim Loader] DOMReady handler hatasi:', e);
      }
    });
  }

  function $(id) { return document.getElementById(id); }

  function setProgress(done, total, label) {
    var pct = total > 0 ? Math.round((done / total) * 100) : 0;
    var bar = $(ELS.bar);
    var pctEl = $(ELS.pct);
    var msg = $(ELS.msg);
    if (bar) bar.style.width = pct + '%';
    // Türkçe yüzde biçimi: işaret sayının önünde (%42) — durum çubuğundaki
    // zoom göstergesiyle (%100) aynı dil.
    if (pctEl) pctEl.textContent = '%' + pct;
    if (label && msg) msg.textContent = label;
  }

  function showSplash() {
    var splash = $(ELS.splash);
    if (splash) {
      splash.classList.remove('mfsim-fading-out');
      splash.style.display = 'flex';
    }
  }

  function hideSplash() {
    var splash = $(ELS.splash);
    if (splash) {
      splash.classList.add('mfsim-fading-out');
      setTimeout(function() {
        splash.style.display = 'none';
      }, 450);
    }
  }

  function hideLogin() {
    var overlay = $(ELS.login);
    if (overlay && overlay.style.display !== 'none') {
      overlay.style.transition = 'opacity 0.25s ease';
      overlay.style.opacity = '0';
      setTimeout(function() {
        overlay.style.display = 'none';
      }, 250);
    }
  }

  function loadOne(placeholder) {
    return new Promise(function(resolve) {
      var s = document.createElement('script');
      // Tum attribute'lari kopyala (type haric — execute olmasini istiyoruz)
      var attrs = placeholder.attributes;
      for (var i = 0; i < attrs.length; i++) {
        var a = attrs[i];
        if (a.name !== 'type') {
          s.setAttribute(a.name, a.value);
        }
      }
      var isExternal = !!placeholder.src;
      if (isExternal) {
        s.onload = function() { resolve(); };
        s.onerror = function() {
          console.warn('[MFSim Loader] Yuklenemedi:', placeholder.src);
          resolve();
        };
        placeholder.parentNode.replaceChild(s, placeholder);
      } else {
        // Inline script: icerigi kopyala, replaceChild sonra senkron calisir
        s.textContent = placeholder.textContent;
        try {
          placeholder.parentNode.replaceChild(s, placeholder);
        } catch (e) {
          console.warn('[MFSim Loader] Inline calisma hatasi:', e);
        }
        resolve();
      }
    });
  }

  function finalize(total) {
    setProgress(total, total, 'Son hazırlıklar...');
    // Moduller bitti — kuyruktaki DOMContentLoaded handler'larini calistir
    flushDomReady();
    // Minimum toplam sureyi bekle — gercek is daha hizliysa fark kadar
    var elapsed = Date.now() - startTime;
    var remaining = Math.max(0, MIN_TOTAL_DURATION_MS - elapsed);
    setTimeout(function() {
      setProgress(total, total, 'Tamamlandı');
      setTimeout(hideSplash, 400);
    }, remaining);
  }

  function runLoader() {
    startTime = Date.now();
    hideLogin();
    showSplash();

    var placeholders = Array.prototype.slice.call(
      document.querySelectorAll('script[type="text/x-mfsim-defer"]')
    );
    var total = placeholders.length;

    if (total === 0) {
      setProgress(1, 1, 'Hazır');
      setTimeout(hideSplash, 250);
      return;
    }

    setProgress(0, total, 'Modüller hazırlanıyor...');

    var idx = 0;
    function next() {
      if (idx >= total) {
        finalize(total);
        return;
      }
      var ph = placeholders[idx];
      var label = ph.getAttribute('data-mfsim-label');
      // Label'i once goster — kullanici neyin yuklendigini gorur
      if (label) {
        var msg = $(ELS.msg);
        if (msg) msg.textContent = label;
      }
      // Her adim arasi kucuk gecikme — progress bar gozle takip edilebilsin,
      // toplam yukleme profesyonel bir his versin.
      setTimeout(function() {
        loadOne(ph).then(function() {
          idx++;
          setProgress(idx, total);
          next();
        });
      }, STEP_DELAY_MS);
    }
    next();
  }

  function start() {
    if (started) return;
    started = true;
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', runLoader, { once: true });
    } else {
      runLoader();
    }
  }

  window.MFSimLoader = { start: start };
})();
