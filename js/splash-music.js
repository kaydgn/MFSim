// ============================================================================
// AÇILIŞ MÜZİĞİ — yükleme (splash) ekranıyla birlikte otomatik çalar
// ============================================================================
// Loader splash'i gösterdiği anda start() çağrılır (bkz. js/loader.js →
// runLoader). Parça dosyası: assets/music/acilis.mp3 — dosya yoksa ya da
// çalınamıyorsa özellik sessizce devre dışı kalır, uygulama etkilenmez.
//
// Tarayıcı otomatik çalma (autoplay) politikası:
//   - Normal girişte kullanıcı "Giriş Yap"a tıklar → kullanıcı jesti mevcut →
//     play() doğrudan başarılı olur, müzik splash ile birlikte başlar.
//   - "Beni hatırla" ile açılışta hiç jest yoktur → tarayıcı play()'i
//     reddedebilir → ilk pointerdown/keydown'da bir kez yeniden denenir.
//   - Radyo (js/radio.js) çalmaya başlarsa açılış müziği durdurulur ki iki
//     ses üst üste binmesin.
//
// Saf durum makinesi start/stop üzerinden module.exports ile dışa verilir.

(function (global) {
  'use strict';

  var TRACK_SRC = 'assets/music/acilis.mp3';
  var VOLUME    = 0.6;    // 0..1 — açılış müziği arka plan seviyesi
  var LOOP      = false;  // şarkı bir kez çalar, döngüye girmez

  var audio        = null;
  var started      = false;   // start() bir kez çalışır
  var stopped      = false;   // stop() sonrası yeniden başlamaz
  var gestureArmed = false;   // ilk-etkileşim dinleyicileri takılı mı

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

  function onGesture() {
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

  function start() {
    if (started) return;
    started = true;
    if (typeof global.Audio !== 'function') return;   // jsdom/birim testi
    audio = new global.Audio(TRACK_SRC);
    audio.loop = LOOP;
    audio.volume = VOLUME;
    audio.preload = 'auto';
    audio.addEventListener('error', function () {
      // Dosya yok ya da format desteklenmiyor — sessizce vazgeç.
      stop();
    });
    tryPlay();
  }

  function stop() {
    stopped = true;
    disarmGesture();
    if (audio) { try { audio.pause(); } catch (e) {} }
  }

  // Yalnızca birim testleri için: modül durumunu sıfırlar.
  function _reset() {
    stop();
    audio = null; started = false; stopped = false;
  }

  var api = { TRACK_SRC: TRACK_SRC, start: start, stop: stop, _reset: _reset };
  global.MFSimSplashMusic = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;

})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this));
