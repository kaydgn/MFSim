/**
 * splash-music.js — açılış müziği autoplay durum makinesi + mini çalar
 * ────────────────────────────────────────────────────────────────────
 * Değerli mantık: tarayıcı autoplay'i engellediğinde (play() reddi) müziğin
 * İLK kullanıcı etkileşiminde bir kez yeniden denenmesi; stop/error sonrası
 * bir daha başlamaması; mini çalar kontrollerinin (çal/duraklat, ses,
 * sessize alma, kapatma) audio durumunu doğru yönetmesi ve ses seviyesinin
 * kalıcılaşması. HTML etiket/metin assertion'ı yok (test politikası).
 */
const music = require('../../js/splash-music.js');

// setTimeout(0): play() promise zincirinin (then/catch) mikrogörevlerini boşalt.
const flush = () => new Promise((r) => setTimeout(r, 0));

// Sahte <audio>: play davranışı test başına enjekte edilir.
function makeAudioStub(playImpl) {
  const listeners = {};
  return {
    loop: null,
    volume: null,
    preload: null,
    paused: true,
    play: jest.fn(playImpl),
    pause: jest.fn(),
    addEventListener: (t, fn) => { (listeners[t] = listeners[t] || []).push(fn); },
    fire: (t) => (listeners[t] || []).forEach((fn) => fn()),
  };
}

function gesture(type = 'pointerdown') {
  document.dispatchEvent(new window.Event(type));
}

function widgetEl() { return document.getElementById(music.WIDGET_ID); }
function click(el) { el.dispatchEvent(new window.MouseEvent('click', { bubbles: true })); }

describe('splash-music', () => {
  let stub;

  beforeEach(() => {
    music._reset();
    window.localStorage.removeItem(music.STORE_KEY);
    stub = null;
  });

  function installAudio(playImpl) {
    window.Audio = jest.fn((src) => {
      stub = makeAudioStub(playImpl);
      stub.src = src;
      return stub;
    });
  }

  describe('autoplay durum makinesi', () => {
    test('start(): parçayı yapılandırıp play() dener; başarılıysa jest dinleyicisi kalmaz', async () => {
      installAudio(() => Promise.resolve());
      music.start();
      expect(window.Audio).toHaveBeenCalledWith(music.TRACK_SRC);
      expect(stub.loop).toBe(false);
      expect(stub.volume).toBeGreaterThan(0);
      expect(stub.play).toHaveBeenCalledTimes(1);
      await flush();
      gesture();               // autoplay zaten başarılı → etkileşim yeni play tetiklemez
      expect(stub.play).toHaveBeenCalledTimes(1);
    });

    test('autoplay engellenirse ilk etkileşimde (pointerdown) yeniden dener', async () => {
      let block = true;
      installAudio(() => (block ? Promise.reject(new Error('NotAllowed')) : Promise.resolve()));
      music.start();
      await flush();           // red işlendi → jest dinleyicileri takıldı
      expect(stub.play).toHaveBeenCalledTimes(1);
      block = false;
      gesture('pointerdown');
      expect(stub.play).toHaveBeenCalledTimes(2);
      await flush();
      gesture('pointerdown');  // dinleyiciler söküldü → tekrar tetiklenmez
      gesture('keydown');
      expect(stub.play).toHaveBeenCalledTimes(2);
    });

    test('klavye etkileşimi (keydown) de müziği başlatır', async () => {
      let block = true;
      installAudio(() => (block ? Promise.reject(new Error('NotAllowed')) : Promise.resolve()));
      music.start();
      await flush();
      block = false;
      gesture('keydown');
      expect(stub.play).toHaveBeenCalledTimes(2);
    });

    test('stop(): müziği duraklatır ve sonraki etkileşimler yeniden başlatmaz', async () => {
      installAudio(() => Promise.reject(new Error('NotAllowed')));
      music.start();
      await flush();
      music.stop();
      expect(stub.pause).toHaveBeenCalled();
      gesture('pointerdown');
      expect(stub.play).toHaveBeenCalledTimes(1);   // yeni deneme yok
    });

    test("audio 'error' verirse (dosya yok) sessizce vazgeçer ve çaları kaldırır", async () => {
      installAudio(() => Promise.reject(new Error('NotAllowed')));
      music.start();
      await flush();
      stub.fire('error');      // assets/music/acilis.mp3 bulunamadı senaryosu
      gesture('pointerdown');
      expect(stub.play).toHaveBeenCalledTimes(1);   // durdu, yeniden denemez
      expect(widgetEl().classList.contains('mf-splash-player-leaving')).toBe(true);
    });

    test('start() ikinci kez çağrılırsa ikinci Audio oluşturmaz', () => {
      installAudio(() => Promise.resolve());
      music.start();
      music.start();
      expect(window.Audio).toHaveBeenCalledTimes(1);
    });

    test('Audio yoksa (jsdom/birim testi) start() sessiz no-op, widget de kurulmaz', () => {
      delete window.Audio;
      expect(() => music.start()).not.toThrow();
      expect(widgetEl()).toBeNull();
    });
  });

  describe('mini çalar (widget)', () => {
    test("start() mini çaları DOM'a ekler", () => {
      installAudio(() => Promise.resolve());
      music.start();
      expect(widgetEl()).not.toBeNull();
    });

    test('çal/duraklat düğmesi audio durumuna göre play/pause çağırır', () => {
      installAudio(() => Promise.resolve());
      music.start();
      const btn = widgetEl().querySelector('[data-act="playpause"]');
      stub.paused = false;                       // çalıyor → düğme duraklatır
      click(btn);
      expect(stub.pause).toHaveBeenCalledTimes(1);
      stub.paused = true;                        // duraklatılmış → düğme çalar
      click(btn);
      expect(stub.play).toHaveBeenCalledTimes(2); // 1: autoplay, 2: düğme
    });

    test("'play'/'pause' olayları çalar görünümünü (playing sınıfı) günceller", () => {
      installAudio(() => Promise.resolve());
      music.start();
      stub.fire('play');
      expect(widgetEl().classList.contains('playing')).toBe(true);
      stub.fire('pause');
      expect(widgetEl().classList.contains('playing')).toBe(false);
    });

    test('ses kaydırıcısı sesi anlık uygular, bırakınca kalıcılaştırır', () => {
      installAudio(() => Promise.resolve());
      music.start();
      const slider = widgetEl().querySelector('.mf-splash-player-vol');
      slider.value = '30';
      slider.dispatchEvent(new window.Event('input'));
      expect(stub.volume).toBeCloseTo(0.3);
      expect(window.localStorage.getItem(music.STORE_KEY)).toBeNull();  // henüz yazılmadı
      slider.dispatchEvent(new window.Event('change'));
      expect(JSON.parse(window.localStorage.getItem(music.STORE_KEY)).volume).toBeCloseTo(0.3);
    });

    test('kayıtlı ses seviyesi sonraki açılışta uygulanır', () => {
      window.localStorage.setItem(music.STORE_KEY, JSON.stringify({ volume: 0.25 }));
      installAudio(() => Promise.resolve());
      music.start();
      expect(stub.volume).toBeCloseTo(0.25);
      const slider = widgetEl().querySelector('.mf-splash-player-vol');
      expect(parseInt(slider.value, 10)).toBe(25);
    });

    test('sessize alma düğmesi sesi 0 ↔ önceki seviye arasında değiştirir', () => {
      installAudio(() => Promise.resolve());
      music.start();
      const mute = widgetEl().querySelector('[data-act="mute"]');
      stub.volume = 0.6;
      click(mute);
      expect(stub.volume).toBe(0);
      click(mute);
      expect(stub.volume).toBeCloseTo(0.6);
    });

    test('kapat düğmesi müziği durdurur, çaları kaldırır; etkileşim yeniden başlatmaz', async () => {
      installAudio(() => Promise.reject(new Error('NotAllowed')));
      music.start();
      await flush();           // jest dinleyicileri takıldı
      click(widgetEl().querySelector('[data-act="close"]'));
      expect(stub.pause).toHaveBeenCalled();
      expect(widgetEl().classList.contains('mf-splash-player-leaving')).toBe(true);
      gesture('pointerdown');
      expect(stub.play).toHaveBeenCalledTimes(1);   // stop sonrası deneme yok
    });

    test('şarkı bitince (ended) çalar kendini kapatır', () => {
      installAudio(() => Promise.resolve());
      music.start();
      stub.fire('ended');
      expect(widgetEl().classList.contains('mf-splash-player-leaving')).toBe(true);
    });

    test('widget İÇİ tıklama bekleyen autoplay jestini tetiklemez', async () => {
      installAudio(() => Promise.reject(new Error('NotAllowed')));
      music.start();
      await flush();           // jest dinleyicileri takıldı (armed)
      const mute = widgetEl().querySelector('[data-act="mute"]');
      mute.dispatchEvent(new window.Event('pointerdown', { bubbles: true }));
      expect(stub.play).toHaveBeenCalledTimes(1);   // widget içi → yeniden deneme YOK
      gesture('pointerdown');                       // widget dışı → dener
      expect(stub.play).toHaveBeenCalledTimes(2);
    });
  });
});
