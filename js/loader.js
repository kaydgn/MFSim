// ═══ MFSim Genel Hata Yakalayici ═══
//
// Neden burada: loader.js, index.html'de dogrudan calisan TEK script'tir; diger
// tum moduller `type="text/x-mfsim-defer"` ile isaretli ve bu dosya tarafindan
// yuklenir. Dolayisiyla yakalayici en erken buraya kurulabilir ve modul yukleme
// sirasinda olusan hatalari da gorur.
//
// Neden gerekli: uygulama 66k satir, framework yok ve bir render fonksiyonunda
// atilan istisna sessizce yutuluyordu — panel yarim ciziliyor, kullanici hicbir
// sey gormuyor, "bende calismiyor" raporu teshis edilemiyordu. Yakalayici hatayi
// konsola AYRINTILI basar; showToast hazirsa kullaniciya da kisa bir uyari verir.
//
// Onemli: preventDefault CAGRILMAZ — hata tarayici konsolunda da normal sekilde
// gorunmeye devam eder. Amac hatayi gizlemek degil, GORUNUR kilmak.
(function() {
  'use strict';

  var MAX_TOAST = 3;          // ekrani hata bildirimiyle doldurma
  var shown = 0;
  var inHandler = false;      // yakalayicinin kendi hatasi sonsuz donguye girmesin

  function report(baslik, hata, ek) {
    if(inHandler) return;
    inHandler = true;
    try {
      // console.error: her zaman, kisitsiz — teshis kaydi burada. Hata nesnesi
      // oldugu gibi verilir; yigin izini konsolun kendisi acar.
      console.error('[MFSim] ' + baslik + (ek ? ' — ' + ek : ''), hata);
      // Toast yalnizca showToast YUKLENDIYSE. Modul yuklemesi sirasinda olusan
      // hatalarda henuz tanimli degildir (js/results.js gec yuklenir) — o durumda
      // konsol kaydiyla yetinilir, sessizce dusulmez.
      if(shown < MAX_TOAST && typeof showToast === 'function') {
        shown++;
        var kisa = (hata && hata.message) ? hata.message : String(hata);
        if(kisa.length > 120) kisa = kisa.slice(0, 117) + '…';
        showToast(baslik + ': ' + kisa +
          (shown === MAX_TOAST ? ' (sonraki hatalar yalnizca konsola yazilacak)' : ''), 'error');
      }
    } catch(e) {
      // Yakalayicinin kendisi patlarsa sessiz kal — asil hata zaten konsolda.
    } finally {
      inHandler = false;
    }
  }

  window.addEventListener('error', function(ev) {
    // Kaynak yukleme hatalari (img/script) da 'error' uretir; onlarin ev.error'u
    // yoktur ve ev.target bir elementtir. Ikisini ayirt et.
    if(ev && ev.target && ev.target !== window && ev.target.tagName) {
      console.error('[MFSim] Kaynak yuklenemedi:', ev.target.tagName,
        ev.target.src || ev.target.href || '');
      return;
    }
    report('Beklenmeyen hata', (ev && ev.error) || (ev && ev.message),
      ev && ev.filename ? ev.filename + ':' + ev.lineno : '');
  }, true);

  window.addEventListener('unhandledrejection', function(ev) {
    report('Islenmemis soz reddi', ev && ev.reason, '');
  });
})();

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
  // Tek bir external modulun yuklenmesi icin ust sinir. Bu sureyi asan modul
  // ATLANIR ve yukleme devam eder — boylece askida kalan tek bir kaynak tum
  // uygulamayi baslatilamaz hale getiremez. Tum kutuphaneler artik yerel
  // (vendor/) oldugu icin normal kosulda bu sinir hic devreye girmez.
  var MODULE_TIMEOUT_MS = 15000;

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
        // Bir kez cozulme garantisi: onload / onerror / timeout hangisi once
        // gelirse. TIMEOUT KRITIK — bir kaynak hata VERMEZ ama ASKIDA kalirsa
        // (kurumsal proxy, captive portal, paket dusuren guvenlik duvari)
        // onerror hic tetiklenmez, promise hic cozulmez ve next() ilerlemez →
        // splash ekrani sonsuza takilir, program hic acilmaz. Timeout ile en
        // kotu durumda o modul atlanir ve uygulama acilir.
        var settled = false;
        var timer = null;
        function settle(reason) {
          if (settled) return;
          settled = true;
          if (timer) { clearTimeout(timer); timer = null; }
          if (reason) console.warn('[MFSim Loader] ' + reason + ':', placeholder.src);
          resolve();
        }
        s.onload = function() { settle(null); };
        s.onerror = function() { settle('Yuklenemedi'); };
        timer = setTimeout(function() {
          settle('Zaman asimi (' + MODULE_TIMEOUT_MS + ' ms) — atlaniyor');
        }, MODULE_TIMEOUT_MS);
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
