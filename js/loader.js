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

// ═══ MFSim Loader — Dinamik modul yukleyici + asama listesi ═══
//
// Login'den sonra cagrilir. Sayfada `<script type="text/x-mfsim-defer">` olarak
// isaretlenmis tum modulleri sirayla yukler, splash overlay'inde ilerlemeyi
// gosterir, bitince karsilama ekranina erir.
//
// NE GOSTERILIR: 91 modul adi tek tek akmiyordu — hicbiri okunacak kadar
// durmuyor, ama hepsi okunmayi bekliyormus gibi duruyordu. Artik yukleme
// sirasindaki YEDI OBEK duruyor (Cekirdek, Araç Performans, Takoz, FEAD,
// Kilavuzlar, Yapisal Analiz, Araclar & olcum) ve her birinin yaninda kacinci
// modulde olundugu yaziyor; o anki modulun tam adi listenin altinda ayri bir
// satirda kaliyor. Obek sinirlari index.html'de yalnizca YEDI script'e konan
// `data-mfsim-stage` ozniteliginden okunuyor: bir sonraki isarete kadar gelen
// her script ayni obege sayilir. Yani script'lerin yeri degistiginde ya da
// yenisi eklendiginde burada guncellenecek bir SAYI YOK.
//
// Hem dev mode (index.html, external src) hem monolitik build (inline icerik)
// ile calisir. Inline tag'ler textContent kopyalanarak yeniden olusturulur;
// external tag'ler yeni <script src> ile load edilir.

(function() {
  'use strict';

  // Her modul adimi arasi minimum gecikme. Toplam splash suresi yaklasik
  // (modul_sayisi * STEP_DELAY_MS) + gercek yukleme isi olur.
  var STEP_DELAY_MS = 150;
  // Tum yuklemenin (script'ler bitti, splash kapanmadan onceki) minimum
  // toplam suresi. Gerçek is bu su̇reden hızlıysa fark kadar bekleriz.
  var MIN_TOTAL_DURATION_MS = 6500;
  // Tek bir external modulun yuklenmesi icin ust sinir. Bu sureyi asan modul
  // ATLANIR ve yukleme devam eder — boylece askida kalan tek bir kaynak tum
  // uygulamayi baslatilamaz hale getiremez. Tum kutuphaneler artik yerel
  // (vendor/) oldugu icin normal kosulda bu sinir hic devreye girmez.
  var MODULE_TIMEOUT_MS = 15000;
  // Ipucu satirinin degisme araligi.
  var TIP_ROTATE_MS = 4200;
  // Kapanis: zemin 0.34 s'de eriyor (css/styles.css) — DOM'dan cekilmesi o
  // sureyi beklemek zorunda, yoksa gecis yarida kesilir.
  var FADE_OUT_MS = 340;

  var started = false;
  var startTime = 0;
  var ELS = {
    splash: 'mfsim-loading-screen',
    bar: 'mfsim-loading-bar',
    pct: 'mfsim-loading-percent',
    msg: 'mfsim-loading-message',
    stages: 'mfsim-loading-stages',
    skips: 'mfsim-loading-skips',
    tip: 'mfsim-loading-tip',
    stamp: 'mfsim-loading-stamp',
    login: 'mfsim-login-overlay'
  };

  // Kisayol ipuclarinda degistirici tus: Mac'te ⌘, digerlerinde Ctrl.
  // js/shortcuts-help.js ile AYNI ayrim, ama o dosya bu asamada henuz
  // yuklenmedigi icin burada kendi kontrolu var.
  var MOD = (function() {
    var ua = (typeof navigator !== 'undefined')
      ? ((navigator.platform || '') + ' ' + (navigator.userAgent || '')) : '';
    return /Mac|iPhone|iPad|iPod/.test(ua) ? '⌘' : 'Ctrl';
  })();

  // KISA TUTULUYOR: satir tek satirlik ve yuzde gostergesiyle ayni sirada —
  // olculdu, ~46 karakterden uzun ipucu kartin icinde kirpiliyor ve yarim
  // cumle kalan bir ipucu hic olmamasindan kotu.
  var TIPS = [
    MOD + '+K — komut paleti',
    '? — klavye kısayolları penceresi',
    'Çift tık: modülün iç topolojisi',
    'Ölçüm dosyasını pencereye sürükle-bırak',
    'Sağ tık + sürükle — görünümü kaydır',
    MOD + '+Z / ' + MOD + '+Y — geri al / ileri al',
    'Araçlar → Program Durumu: sürüm künyesi'
  ];

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

  // ── Asama modeli ─────────────────────────────────────────────────────────
  // Sinir isareti tasiyan script yeni bir obek baslatir; isaretsizler bir
  // oncekine yazilir. Hic isaret yoksa tek bir obek olusur — liste bos kalmaz.
  function buildStages(placeholders) {
    var list = [];
    var of = [];
    var cur = null;
    for (var i = 0; i < placeholders.length; i++) {
      var ad = placeholders[i].getAttribute
        ? placeholders[i].getAttribute('data-mfsim-stage') : null;
      if (ad || !cur) {
        cur = { ad: ad || 'Modüller', total: 0, done: 0, skipped: 0 };
        list.push(cur);
      }
      cur.total++;
      of.push(list.length - 1);
    }
    return { list: list, of: of };
  }

  function renderStages(stages) {
    var host = $(ELS.stages);
    if (!host) return;
    host.innerHTML = '';
    for (var i = 0; i < stages.length; i++) {
      var li = document.createElement('li');
      li.className = 'mfsim-loading-stage';
      var mk = document.createElement('span');
      mk.className = 'mfsim-loading-stage-mk';
      mk.textContent = '·';
      var nm = document.createElement('span');
      nm.className = 'mfsim-loading-stage-nm';
      // textContent: obek adi index.html'den geliyor ve '&' icerebiliyor
      // ("Araclar & olcum"). innerHTML ile yazilsa kacislanmasi gerekirdi.
      nm.textContent = stages[i].ad;
      var ct = document.createElement('span');
      ct.className = 'mfsim-loading-stage-ct';
      ct.textContent = '0/' + stages[i].total;
      li.appendChild(mk); li.appendChild(nm); li.appendChild(ct);
      host.appendChild(li);
    }
  }

  function paintStages(stages, activeIdx) {
    var host = $(ELS.stages);
    if (!host) return;
    for (var i = 0; i < stages.length && i < host.children.length; i++) {
      var st = stages[i];
      var row = host.children[i];
      var bitti = st.done >= st.total;
      var aktif = (i === activeIdx) && !bitti;
      row.className = 'mfsim-loading-stage' +
        (bitti ? ' is-done' : (aktif ? ' is-active' : '')) +
        (st.skipped ? ' has-skip' : '');
      row.children[0].textContent = st.skipped ? '!' : (bitti ? '✓' : (aktif ? '›' : '·'));
      row.children[2].textContent = st.done + '/' + st.total;
    }
  }

  // ── Atlanan modul ────────────────────────────────────────────────────────
  // Bir modul zaman asimina ugrar ya da yuklenemezse ATLANIR ve uygulama yine
  // acilir. Eskiden bunun tek izi console.warn'du: kullanici eksik bir
  // programla calismaya devam ediyor, hicbir sey soylemiyordu.
  function paintSkips(skips) {
    var el = $(ELS.skips);
    if (!el) return;
    if (!skips.length) { el.hidden = true; el.textContent = ''; return; }
    el.hidden = false;
    el.textContent = (skips.length === 1)
      ? 'Bir modül yüklenemedi ve atlandı: ' + skips[0] +
        ' — ilgili özellikler eksik olabilir, ayrıntı tarayıcı konsolunda.'
      : skips.length + ' modül yüklenemedi ve atlandı (son: ' +
        skips[skips.length - 1] + ') — ilgili özellikler eksik olabilir, ' +
        'ayrıntı tarayıcı konsolunda.';
  }

  // ── Ipucu satiri ─────────────────────────────────────────────────────────
  var tipTimer = null;
  var tipIdx = 0;
  function startTips() {
    var el = $(ELS.tip);
    if (!el || !TIPS.length) return;
    tipIdx = Math.floor(Math.random() * TIPS.length);
    el.textContent = 'İpucu: ' + TIPS[tipIdx];
    tipTimer = setInterval(function() {
      var t = $(ELS.tip);
      if (!t) return;
      t.classList.add('is-swapping');
      setTimeout(function() {
        tipIdx = (tipIdx + 1) % TIPS.length;
        t.textContent = 'İpucu: ' + TIPS[tipIdx];
        t.classList.remove('is-swapping');
      }, 180);
    }, TIP_ROTATE_MS);
  }
  function stopTips() {
    if (tipTimer) { clearInterval(tipTimer); tipTimer = null; }
  }

  // ── Surum kunyesi ────────────────────────────────────────────────────────
  // "Guncel programi aldim ama eski program geliyor": hangi kopyanin acildigi
  // uygulama daha acilmadan gorunur. Kunyeyi build.js gomer
  // (window.__MFSIM_BUILD); modüler index.html'de YOKTUR — o durumda eleman
  // bos kalir ve :empty ile hic yer kaplamaz.
  function paintStamp() {
    var el = $(ELS.stamp);
    if (!el) return;
    var b = (typeof window !== 'undefined') ? window.__MFSIM_BUILD : null;
    if (!b || !b.shortSha) return;
    var s = b.shortSha;
    if (b.prNumber) s += ' · PR #' + b.prNumber;
    var t = kisaTarih(b.date);
    if (t) s += ' · ' + t;
    el.textContent = s;
  }
  function kisaTarih(iso) {
    if (!iso) return '';
    var d = new Date(iso);
    if (isNaN(d.getTime())) return '';
    function p(n) { return (n < 10 ? '0' : '') + n; }
    return p(d.getDate()) + '.' + p(d.getMonth() + 1) + '.' + d.getFullYear();
  }

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
    stopTips();
    var splash = $(ELS.splash);
    if (splash) {
      splash.classList.add('mfsim-fading-out');
      setTimeout(function() {
        splash.style.display = 'none';
      }, FADE_OUT_MS);
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

  // Cozum degeri: atlandiysa sebep dizgesi, yuklendiyse null.
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
          resolve(reason || null);
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
        resolve(null);
      }
    });
  }

  function finalize(total, stages) {
    setProgress(total, total, 'Son hazırlıklar...');
    paintStages(stages, -1);
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
    paintStamp();
    startTips();

    var placeholders = Array.prototype.slice.call(
      document.querySelectorAll('script[type="text/x-mfsim-defer"]')
    );
    var total = placeholders.length;
    var stageInfo = buildStages(placeholders);
    var stages = stageInfo.list;
    var stageOf = stageInfo.of;
    var skips = [];
    renderStages(stages);

    if (total === 0) {
      setProgress(1, 1, 'Hazır');
      setTimeout(hideSplash, 250);
      return;
    }

    setProgress(0, total, 'Modüller hazırlanıyor...');
    paintStages(stages, 0);

    var idx = 0;
    function next() {
      if (idx >= total) {
        finalize(total, stages);
        return;
      }
      var ph = placeholders[idx];
      var label = ph.getAttribute('data-mfsim-label');
      var si = stageOf[idx];
      // Etiketi ve icinde bulunulan obegi once goster — kullanici neyin
      // yuklendigini gorur.
      if (label) {
        var msg = $(ELS.msg);
        if (msg) msg.textContent = label;
      }
      paintStages(stages, si);
      // Her adim arasi kucuk gecikme — ilerleme gozle takip edilebilsin.
      setTimeout(function() {
        loadOne(ph).then(function(atlandi) {
          if (atlandi) {
            stages[si].skipped++;
            skips.push(label || (ph.src || '').split('/').pop() || 'bilinmeyen modül');
            paintSkips(skips);
          }
          stages[si].done++;
          idx++;
          setProgress(idx, total);
          paintStages(stages, stageOf[idx]);
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
