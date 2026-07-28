// ============================================================================
// AÇILIŞ MÜZİĞİ — yükleme (splash) ekranıyla birlikte otomatik çalar
// ============================================================================
// Loader splash'i gösterdiği anda start() çağrılır (bkz. js/loader.js →
// runLoader). Parça dosyası: assets/music/acilis.mp3 — dosya yoksa ya da
// çalınamıyorsa özellik sessizce devre dışı kalır, uygulama etkilenmez.
//
// Sağ-alt köşede küçük bir "mini çalar" gösterilir: çal/duraklat, ses
// kaydırıcısı, sessize alma ve kapatma. Splash'in ÜZERİNDE de görünür
// (z-index), böylece müzik yükleme ekranındayken de kontrol edilebilir.
// Ses seviyesi localStorage'da (mf-splash-music) kalıcıdır.
//
// Tarayıcı otomatik çalma (autoplay) politikası:
//   - Normal girişte kullanıcı "Giriş Yap"a tıklar → kullanıcı jesti mevcut →
//     play() doğrudan başarılı olur, müzik splash ile birlikte başlar.
//   - "Beni hatırla" ile açılışta hiç jest yoktur → tarayıcı play()'i
//     reddedebilir → ilk pointerdown/keydown'da bir kez yeniden denenir.
//     Mini çalar bu durumda duraklatılmış görünür; ▶ düğmesi de jesttir.
//     Widget İÇİNDEKİ tıklamalar bekleyen jesti tetiklemez — düğmeler karar
//     verir (ör. ilk tıklama "kapat" ise müzik istenmeden başlamamalı).
//   - Radyo (js/radio.js) çalmaya başlarsa açılış müziği durdurulur ki iki
//     ses üst üste binmesin; çalar da kapanır.
//
// Durum makinesi start/stop üzerinden module.exports ile dışa verilir.

(function (global) {
  'use strict';

  var TRACK_SRC   = 'assets/music/acilis.mp3';
  var TRACK_TITLE = 'Gobble Glitch';
  var TRACK_SUB   = 'Blackgrass Glitch Mix · Açılış müziği';
  var VOLUME      = 0.6;    // 0..1 — varsayılan seviye (kayıt yoksa)
  var LOOP        = false;  // şarkı bir kez çalar, döngüye girmez
  var STORE_KEY   = 'mf-splash-music';
  var WIDGET_ID   = 'mf-splash-player';

  var audio        = null;
  var widget       = null;
  var started      = false;   // start() bir kez çalışır
  var stopped      = false;   // stop() sonrası yeniden başlamaz
  var gestureArmed = false;   // ilk-etkileşim dinleyicileri takılı mı
  var leaveTimer   = null;    // çıkış animasyonu sonrası DOM'dan kaldırma
  var lastVol      = VOLUME;  // sessize alma öncesi seviye

  var ICONS = {
    play:  '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7 4.5v15l12-7.5z"/></svg>',
    pause: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="6.5" y="4.5" width="4" height="15" rx="1"/><rect x="13.5" y="4.5" width="4" height="15" rx="1"/></svg>',
    vol:   '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M4 9.5v5h3.5L13 19V5L7.5 9.5z"/><path d="M16.5 8.5a4.5 4.5 0 0 1 0 7" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
    mute:  '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M4 9.5v5h3.5L13 19V5L7.5 9.5z"/><path d="M16.5 9.5l5 5M21.5 9.5l-5 5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
    close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>'
  };

  // ── Yardımcılar ────────────────────────────────────────────────────────────
  function clampVolume(v) {
    v = parseFloat(v);
    if (!isFinite(v)) return VOLUME;
    return Math.min(1, Math.max(0, v));
  }

  function loadVolume() {
    try {
      var raw = global.localStorage && global.localStorage.getItem(STORE_KEY);
      if (raw) {
        var o = JSON.parse(raw);
        if (o && typeof o.volume === 'number') return clampVolume(o.volume);
      }
    } catch (e) {}
    return VOLUME;
  }

  function saveVolume(v) {
    try {
      if (global.localStorage) global.localStorage.setItem(STORE_KEY, JSON.stringify({ volume: clampVolume(v) }));
    } catch (e) {}
  }

  // ── Jest (ilk etkileşim) geri dönüşü ───────────────────────────────────────
  function armGesture() {
    if (gestureArmed || stopped || !global.document) return;
    gestureArmed = true;
    global.document.addEventListener('pointerdown', onGesture, true);
    global.document.addEventListener('keydown', onGesture, true);
  }

  function disarmGesture() {
    if (!gestureArmed || !global.document) { gestureArmed = false; return; }
    gestureArmed = false;
    global.document.removeEventListener('pointerdown', onGesture, true);
    global.document.removeEventListener('keydown', onGesture, true);
  }

  function onGesture(e) {
    // Mini çalar içindeki etkileşimler bekleyen autoplay'i TETİKLEMEZ —
    // kullanıcı orada bilinçli bir düğmeye basıyor, kararı düğme verir.
    if (e && e.target && e.target.closest && e.target.closest('#' + WIDGET_ID)) return;
    disarmGesture();
    tryPlay();
  }

  function tryPlay() {
    if (!audio || stopped) return;
    var p = null;
    try { p = audio.play(); } catch (e) { armGesture(); return; }
    if (p && typeof p.then === 'function') {
      p.then(disarmGesture).catch(function () {
        // Autoplay engellendi (jest yok) → ilk etkileşimde yeniden dene.
        armGesture();
      });
    }
  }

  // ── Mini çalar (UI) ────────────────────────────────────────────────────────
  function setPlayingUI(on) {
    if (!widget) return;
    widget.classList.toggle('playing', !!on);
    var b = widget.querySelector('[data-act="playpause"]');
    if (b) {
      b.innerHTML = on ? ICONS.pause : ICONS.play;
      b.title = on ? 'Duraklat' : 'Çal';
      b.setAttribute('aria-label', b.title);
    }
  }

  function setVolume(v, persist) {
    v = clampVolume(v);
    if (audio) audio.volume = v;
    if (v > 0) lastVol = v;
    var mb = widget && widget.querySelector('[data-act="mute"]');
    if (mb) {
      mb.innerHTML = v === 0 ? ICONS.mute : ICONS.vol;
      mb.title = v === 0 ? 'Sesi aç' : 'Sessize al';
      mb.setAttribute('aria-label', mb.title);
    }
    if (persist) saveVolume(v);
  }

  function toggleMute() {
    var s = widget && widget.querySelector('.mf-splash-player-vol');
    if (audio && audio.volume > 0) {
      setVolume(0, true);
      if (s) s.value = 0;
    } else {
      setVolume(lastVol || VOLUME, true);
      if (s) s.value = Math.round((lastVol || VOLUME) * 100);
    }
  }

  function togglePlayPause() {
    if (!audio) return;
    if (audio.paused) {
      // Düğme tıklaması kullanıcı jestidir → play() burada izinli olmalı.
      var p = null;
      try { p = audio.play(); } catch (e) { return; }
      if (p && p.catch) p.catch(function () {});
    } else {
      audio.pause();
    }
  }

  function buildWidget(volume) {
    if (widget || !global.document || !global.document.body) return;
    var w = global.document.createElement('div');
    w.id = WIDGET_ID;
    w.className = 'mf-splash-player';
    w.setAttribute('role', 'region');
    w.setAttribute('aria-label', 'Açılış müziği çalar');
    w.innerHTML =
      '<span class="mf-splash-player-eq" aria-hidden="true"><i></i><i></i><i></i><i></i></span>' +
      '<span class="mf-splash-player-info">' +
        '<span class="mf-splash-player-title">' + TRACK_TITLE + '</span>' +
        '<span class="mf-splash-player-sub">' + TRACK_SUB + '</span>' +
      '</span>' +
      '<button type="button" class="mf-splash-player-btn" data-act="playpause" title="Çal" aria-label="Çal">' + ICONS.play + '</button>' +
      '<span class="mf-splash-player-volwrap">' +
        '<button type="button" class="mf-splash-player-btn" data-act="mute" title="Sessize al" aria-label="Sessize al">' + ICONS.vol + '</button>' +
        '<input type="range" class="mf-splash-player-vol" min="0" max="100" aria-label="Ses seviyesi" />' +
      '</span>' +
      '<button type="button" class="mf-splash-player-btn mf-splash-player-close" data-act="close" title="Müziği kapat" aria-label="Müziği kapat">' + ICONS.close + '</button>';
    global.document.body.appendChild(w);

    var slider = w.querySelector('.mf-splash-player-vol');
    slider.value = Math.round(clampVolume(volume) * 100);
    // 'input' anlık uygular, 'change' kalıcılaştırır (radio.js ile aynı desen).
    slider.addEventListener('input',  function () { setVolume(this.value / 100, false); });
    slider.addEventListener('change', function () { setVolume(this.value / 100, true); });

    w.addEventListener('click', function (e) {
      var act = e.target.closest && e.target.closest('[data-act]');
      if (!act) return;
      var a = act.getAttribute('data-act');
      if (a === 'playpause')  togglePlayPause();
      else if (a === 'mute')  toggleMute();
      else if (a === 'close') stop();
    });

    widget = w;
  }

  function hideWidget() {
    if (!widget) return;
    var w = widget;
    widget = null;
    w.classList.add('mf-splash-player-leaving');
    leaveTimer = setTimeout(function () {
      if (w.parentNode) w.parentNode.removeChild(w);
    }, 320);
  }

  // ── Yaşam döngüsü ──────────────────────────────────────────────────────────
  function start() {
    if (started) return;
    started = true;
    if (typeof global.Audio !== 'function') return;   // jsdom/birim testi
    lastVol = loadVolume();
    audio = new global.Audio(TRACK_SRC);
    audio.loop = LOOP;
    audio.volume = lastVol;
    audio.preload = 'auto';
    audio.addEventListener('error', function () {
      // Dosya yok ya da format desteklenmiyor — sessizce vazgeç.
      stop();
    });
    audio.addEventListener('play',    function () { disarmGesture(); setPlayingUI(true); });
    audio.addEventListener('playing', function () { setPlayingUI(true); });
    audio.addEventListener('pause',   function () { setPlayingUI(false); });
    audio.addEventListener('ended',   function () { stop(); });
    buildWidget(lastVol);
    tryPlay();
  }

  function stop() {
    stopped = true;
    disarmGesture();
    if (audio) { try { audio.pause(); } catch (e) {} }
    hideWidget();
  }

  // Yalnızca birim testleri için: modül durumunu ve widget'ı sıfırlar.
  function _reset() {
    disarmGesture();
    if (audio) { try { audio.pause(); } catch (e) {} }
    if (leaveTimer) { clearTimeout(leaveTimer); leaveTimer = null; }
    var w = global.document && global.document.getElementById(WIDGET_ID);
    if (w && w.parentNode) w.parentNode.removeChild(w);
    widget = null; audio = null;
    started = false; stopped = false; gestureArmed = false;
    lastVol = VOLUME;
  }

  var api = {
    TRACK_SRC: TRACK_SRC,
    STORE_KEY: STORE_KEY,
    WIDGET_ID: WIDGET_ID,
    start: start,
    stop: stop,
    _reset: _reset
  };
  global.MFSimSplashMusic = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;

})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this));
