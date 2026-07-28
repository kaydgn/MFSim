/**
 * splash-music.js — açılış müziği autoplay durum makinesi
 * ───────────────────────────────────────────────────────
 * Değerli mantık: tarayıcı autoplay'i engellediğinde (play() reddi) müziğin
 * İLK kullanıcı etkileşiminde bir kez yeniden denenmesi; stop/error sonrası
 * bir daha başlamaması. UI/etiket testi yok (test politikası).
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
    play: jest.fn(playImpl),
    pause: jest.fn(),
    addEventListener: (t, fn) => { (listeners[t] = listeners[t] || []).push(fn); },
    fire: (t) => (listeners[t] || []).forEach((fn) => fn()),
  };
}

function gesture(type = 'pointerdown') {
  document.dispatchEvent(new window.Event(type));
}

describe('splash-music: autoplay durum makinesi', () => {
  let stub;

  beforeEach(() => {
    music._reset();
    stub = null;
  });

  function installAudio(playImpl) {
    window.Audio = jest.fn((src) => {
      stub = makeAudioStub(playImpl);
      stub.src = src;
      return stub;
    });
  }

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

  test("audio 'error' verirse (dosya yok) sessizce vazgeçer", async () => {
    installAudio(() => Promise.reject(new Error('NotAllowed')));
    music.start();
    await flush();
    stub.fire('error');      // assets/music/acilis.mp3 bulunamadı senaryosu
    gesture('pointerdown');
    expect(stub.play).toHaveBeenCalledTimes(1);   // durdu, yeniden denemez
  });

  test('start() ikinci kez çağrılırsa ikinci Audio oluşturmaz', () => {
    installAudio(() => Promise.resolve());
    music.start();
    music.start();
    expect(window.Audio).toHaveBeenCalledTimes(1);
  });

  test('Audio yoksa (jsdom/birim testi) start() sessiz no-op', () => {
    delete window.Audio;
    expect(() => music.start()).not.toThrow();
  });
});
