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
// NE GOSTERILIR (AMBLEM, 2026-09-23): liste de yuzde de yok. Ilerlemeyi
// 12 bolmeli CETVEL gosteriyor, altinda yalniz O ANKI OBEK Roma rakamiyla
// (I CEKIRDEK, II ARAC PERFORMANS...) ve o anki modulun tam adi. Eskiden
// obeklerin hepsi sayaclariyla alt alta duruyordu; hicbiri okunmuyor ama
// hepsi okunmayi bekliyormus gibi duruyordu. Obek sinirlari index.html'de
// yalnizca birkac script'e konan `data-mfsim-stage` ozniteliginden okunuyor:
// bir sonraki isarete kadar gelen her script ayni obege sayilir. Yani
// script'lerin yeri degistiginde ya da yenisi eklendiginde burada
// guncellenecek bir SAYI YOK.
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
    ico: 'mfsim-loading-logo-ico',
    cetvel: 'mfsim-loading-cetvel',
    bolum: 'mfsim-loading-bolum',
    msg: 'mfsim-loading-message',
    photo: 'mfsim-loading-photo',
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

  // KISA TUTULUYOR: dipte tek satir. Uzun ipucu kirpilir ve yarim cumle
  // kalan bir ipucu hic olmamasindan kotu (kart doneminde olculdu: ~46
  // karakterden uzunu kirpiliyordu).
  var TIPS = [
    MOD + '+K — komut paleti',
    '? — klavye kısayolları penceresi',
    'Çift tık: modülün iç topolojisi',
    'Ölçüm dosyasını pencereye sürükle-bırak',
    'Sağ tık + sürükle — görünümü kaydır',
    MOD + '+Z / ' + MOD + '+Y — geri al / ileri al',
    'Araçlar → Program Durumu: sürüm künyesi'
  ];

  // ── Tema, ILK KAREDE ─────────────────────────────────────────────────────
  // js/theme.js kayitli temayi DOMContentLoaded'da uyguluyor; bu dosya o kuyrugu
  // yuklemenin SONUNA erteliyor (flushDomReady). Sonuc: giris ve acilis ekrani
  // belgenin varsayilan paletinde yasiyor, kullanicinin temasi tam devir teslim
  // aninda deviriliyordu — acilis karti bir anda renk degistiriyordu (olculdu:
  // acilis slate/koyu, karsilama pearl/acik). Bu cagri IIFE degerlendirilirken,
  // yani giristen de once kosuyor.
  //
  // KAYITLI KIP → COZULMUS KIMLIK. Eskiden burada yalniz bir slug SUZGECI
  // vardi ve tanimadigi degeri hic yazmiyordu; iki tema kalinca bu yetmez,
  // cunku 'sistem' bir kimlik degil bir kip ve CSS'te blogu yok — yazilsaydi
  // belge sessizce :root'a duserdi.
  //
  // index.html'in <head>'indeki satir ici betikle AYNI karari vermek zorunda.
  // Ikisi ayrisirsa loader'in olcup kapattigi acilis renk sicramasi geri gelir
  // ve bunu yalniz gercek tarayicida kullanici gorur.
  // Kapi: tests/unit/theme-consistency.test.js › "iki ilk-kare yolu AYNI
  // kimligi cozuyor" — iki betik de cikarilip ayni girdilerle kosuluyor.
  function applyStoredTheme() {
    try {
      var v = localStorage.getItem('mf-theme'), t = 'acik';
      if (v === 'koyu') t = 'koyu';
      else if (v === 'sistem') t = (window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches) ? 'koyu' : 'acik';
      else if (/^(pearl|steel|solidworks|paper|zinc)$/.test(v)) t = 'acik';
      else if (/^(slate|cream|claude|ansys|fusion|vscode|navy|graphite|ink|basalt|mono|contrast|amber|scope)$/.test(v)) t = 'koyu';
      document.documentElement.setAttribute('data-theme', t);
    } catch (e) {}
  }
  applyStoredTheme();

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
  // oncekine yazilir. Hic isaret yoksa tek bir obek olusur — etiket bos kalmaz.
  function buildStages(placeholders) {
    var list = [];
    var of = [];
    var cur = null;
    for (var i = 0; i < placeholders.length; i++) {
      var ad = placeholders[i].getAttribute
        ? placeholders[i].getAttribute('data-mfsim-stage') : null;
      if (ad || !cur) {
        cur = { ad: ad || 'Modüller', skipped: 0 };
        list.push(cur);
      }
      of.push(list.length - 1);
    }
    return { list: list, of: of };
  }

  // Obegin sira numarasi, Roma rakamiyla: 1 → I. Obek sayisi index.html'den
  // gelir ve sabit degil; tablo 39'a kadar dogru yazar, bugun alti obek var.
  function roma(n) {
    var T = [[10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']];
    var s = '';
    for (var i = 0; i < T.length; i++) {
      while (n >= T[i][0]) { s += T[i][1]; n -= T[i][0]; }
    }
    return s;
  }

  // ── O anki obek ──────────────────────────────────────────────────────────
  // Yalniz obek DEGISINCE yazilir ve bir kez belirir: animasyon adi a ↔ b
  // gidip geliyor (CSS: iki ozdes @keyframes), tarayici ad degisimini yeni
  // bir animasyon sayar — yeniden baslatmak icin reflow zorlamak gerekmiyor.
  // i < 0: yukleme bitti, etiket "✓ Hazır".
  var sonBolum = null;
  function paintBolum(stages, i) {
    var el = $(ELS.bolum);
    if (!el) return;
    var hazir = !(i >= 0 && i < stages.length);
    var anahtar = hazir ? 'hazir' : String(i);
    if (anahtar !== sonBolum) {
      sonBolum = anahtar;
      var no = el.children[0], ad = el.children[1];
      if (no) no.textContent = hazir ? '✓' : roma(i + 1);
      // textContent: obek adi index.html'den geliyor ve '&' icerebiliyor
      // ("Araçlar & ölçüm"). innerHTML ile yazilsa kacislanmasi gerekirdi.
      if (ad) ad.textContent = hazir ? 'Hazır' : stages[i].ad;
      el.setAttribute('data-belir', el.getAttribute('data-belir') === 'a' ? 'b' : 'a');
    }
    // Atlanan modul barindiran obek: rakam kehribara doner (CSS: .is-atlandi).
    el.classList.toggle('is-atlandi', !hazir && stages[i].skipped > 0);
  }

  // ── Cetvel ───────────────────────────────────────────────────────────────
  // Kademe basina bir bolme; SAYISI CSS jetonundan (kademeSayisi) — izgara da
  // ayni jetonla cizildigi icin bolme sayisi ile sutun sayisi ayrisamaz.
  function renderCetvel() {
    var el = $(ELS.cetvel);
    if (!el) return;
    el.innerHTML = '';
    for (var i = 0, K = kademeSayisi(); i < K; i++) {
      el.appendChild(document.createElement('span'));
    }
  }

  // k: gecilen kademe. Son gecilen bolme VURGU tasir (ilerlemenin ucu);
  // yukleme bitince ucu kalmaz, hepsi ayni renge oturur. Yuzde GORUNMUYOR,
  // yardimci teknolojiye aria-valuenow ile soyleniyor.
  function paintCetvel(k, K) {
    var el = $(ELS.cetvel);
    if (!el) return;
    for (var i = 0; i < el.children.length; i++) {
      el.children[i].className = (i < k)
        ? ((i === k - 1 && k < K) ? 'is-gecti is-son' : 'is-gecti') : '';
    }
    el.setAttribute('aria-valuenow', String(K > 0 ? Math.round((k / K) * 100) : 0));
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

  // ── Acilis karesi ────────────────────────────────────────────────────────
  // Karsilama ekrani tam ekran bir fotografla aciliyor. Acilis ekrani AYNI
  // kareyle basliyor ki devir teslimde goruntu HIC degismesin: kart eriyor,
  // fotograf yerinde kaliyor.
  //
  // Iki parca da bu asamada hazir: kareler <body>'nin hemen ardindaki satir ici
  // blokta (window.__MFSIM_KARSILAMA — build.js yazar), liste ise
  // js/karsilama-gorseller.js'te ve O DOSYA DEFER DEGIL, bu dosyadan once
  // yukleniyor. Defer setinde kalsaydi acilis ekrani fotografsiz baslardi.
  //
  // Secilen kare window.__MFSIM_ACILIS_KARE'ye yazilir; slaytin karma sirasi
  // onu basa aliyor (js/components.js › _veSlaytKarilmis).
  function kareKaynak(ad) {
    var g = (typeof window !== 'undefined') ? window.__MFSIM_KARSILAMA : null;
    return (g && g[ad]) ? g[ad] : 'assets/karsilama/' + ad;
  }

  function paintPhoto() {
    var el = $(ELS.photo);
    if (!el) return null;
    var liste = (typeof window !== 'undefined' && window.VE_KARSILAMA_GORSELLER) || [];
    // Ekrana gore suzulur (6·2): slaytla AYNI suzgec, acilis karesi slaytta olsun
    if (typeof window !== 'undefined' && typeof window.veKarsilamaEkranaUygun === 'function' &&
        typeof window.veKarsilamaEkranOlcusu === 'function') {
      var eo = window.veKarsilamaEkranOlcusu();
      liste = window.veKarsilamaEkranaUygun(liste, eo[0], eo[1]);
    }
    if (!liste.length) return null;          // kare yok → kagit zemin kalir
    var ad = liste[Math.floor(Math.random() * liste.length)];
    el.style.backgroundImage = 'url("' + kareKaynak(ad) + '")';
    var splash = $(ELS.splash);
    if (splash) splash.classList.add('mfsim-has-photo');
    if (typeof window !== 'undefined') window.__MFSIM_ACILIS_KARE = ad;
    return ad;
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

  // ── KADEMELI ILERLEME ────────────────────────────────────────────────────
  // Ilerleme 85 modulun her birinde degil, KADEME KADEME cikiyor. Olculdu:
  // modul basina adim %1,2 ve adimlar 150 ms arayla geliyordu; 180 ms'lik
  // gecisler ust uste binince goz sürekli bir KAYMA goruyordu. 12 kademede
  // adim %8,3 / ~1,1 sn — yedi kat buyuk, yedi kat seyrek.
  //
  // KADEME SAYISI CSS'TEN OKUNUR (--mfsim-kademe): cetvelin izgarasi da ayni
  // jetondan cizildigi icin sayi iki yerde yazili olsaydi sessizce ayrisir ve
  // bolmeler sutunlara oturmazdi. Jeton okunamazsa tasarim degerine duser.
  function kademeSayisi() {
    var K = NaN;
    try {
      K = parseInt(getComputedStyle(document.documentElement)
        .getPropertyValue('--mfsim-kademe'), 10);
    } catch (e) {}
    return (K > 0) ? K : 12;
  }

  // Kacinci kademedeyiz. Son kademe icin AYRI BIR DAL YOK ve gerekmiyor:
  // done === total iken done/total tam olarak 1, yani floor(1 * K) = K —
  // cubuk kendiliginden %100'e oturur. (Denendi: ayri dal MUTASYONLA
  // olduruleMEdi, cunku hicbir girdide farkli sonuc vermiyordu; kodda
  // duran ama hicbir sey yapmayan bir koruma, korudugu iddiasiyla birlikte
  // yanlis bir hikaye olurdu.)
  function kademe(done, total) {
    if (total <= 0) return 0;
    return Math.floor((done / total) * kademeSayisi());
  }

  function setProgress(done, total, label) {
    var K = kademeSayisi();
    var k = K > 0 ? kademe(done, total) : 0;
    var q = K > 0 ? k / K : 0;
    var msg = $(ELS.msg);
    var ico = $(ELS.ico);
    paintCetvel(k, K);
    // Disli de ayni tempoda: kademe basina bir centik, yukleme boyunca TAM TUR.
    if (ico) ico.style.transform = 'rotate(' + (q * 360).toFixed(1) + 'deg)';
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
      // Marka devamlılığı: karşılama ekranı splash logosunu SÖNMEDEN önce devralır
      // (sonrası ölçülemez). Kanca yoksa/patlarsa kapanış aynen sürer — splash asılı kalamaz.
      if (typeof window.veWelcomeAdoptSplashLogo === 'function') {
        try { window.veWelcomeAdoptSplashLogo(splash); } catch (e) {}
      }
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
    paintBolum(stages, -1);
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
    paintPhoto();
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
    var sonKademe = -1;          // etiket yalniz kademe degisince yazilir
    renderCetvel();

    if (total === 0) {
      setProgress(1, 1, 'Hazır');
      paintBolum(stages, -1);
      setTimeout(hideSplash, 250);
      return;
    }

    setProgress(0, total, 'Modüller hazırlanıyor...');
    paintBolum(stages, 0);

    var idx = 0;
    function next() {
      if (idx >= total) {
        finalize(total, stages);
        return;
      }
      var ph = placeholders[idx];
      var label = ph.getAttribute('data-mfsim-label');
      var si = stageOf[idx];
      // Etiket de KADEMEYLE degisir, 85 kez degil. Cubuk agirlasirken yazinin
      // cirpinmaya devam etmesi ikisini birden yiyordu: goz nereye bakacagini
      // bilemiyor, ne cubugu takip ediyor ne adi okuyordu.
      var k = kademe(idx, total);
      if (label && k !== sonKademe) {
        sonKademe = k;
        var msg = $(ELS.msg);
        if (msg) msg.textContent = label;
      }
      paintBolum(stages, si);
      // Her adim arasi kucuk gecikme — ilerleme gozle takip edilebilsin.
      setTimeout(function() {
        loadOne(ph).then(function(atlandi) {
          if (atlandi) {
            stages[si].skipped++;
            skips.push(label || (ph.src || '').split('/').pop() || 'bilinmeyen modül');
            paintSkips(skips);
          }
          idx++;
          setProgress(idx, total);
          // Son modul bittiyse etiket finalize'da "Hazır"a doner; o ana kadar
          // atlanan modulun obegi isaretli kalsin diye burada da boyanir.
          paintBolum(stages, idx < total ? stageOf[idx] : si);
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
