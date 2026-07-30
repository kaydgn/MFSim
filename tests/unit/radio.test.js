/**
 * radio.test.js — Radyo / müzik çalar saf mantığı
 * js/radio.js'in DOM'a dokunmayan çekirdeğini test eder:
 * ses clamp, çalma-listesi indeks sarmalama, başlık türetme, URL doğrulama,
 * durum serileştirme (localStorage) ve özel istasyon ekleme.
 *
 * NOT: require anında modül init() çağırır; #ve-ribbon olmadığından (jsdom)
 * UI kurulmaz → yalnızca saf fonksiyonlar test kapsamına gelir.
 */

beforeEach(() => {
  try { window.localStorage.clear(); } catch (e) {}
  jest.resetModules();
});

const load = () => require('../../js/radio.js');

// ── Ses seviyesi ──────────────────────────────────────────────────────────────
describe('clampVolume', () => {
  const { clampVolume, DEFAULT_VOLUME } = load();
  test('aralık içi değeri korur', () => { expect(clampVolume(0.42)).toBeCloseTo(0.42); });
  test('0 altını 0\'a, 1 üstünü 1\'e kıstırır', () => {
    expect(clampVolume(-0.5)).toBe(0);
    expect(clampVolume(3)).toBe(1);
  });
  test('sayı olmayan → varsayılan', () => {
    expect(clampVolume('abc')).toBe(DEFAULT_VOLUME);
    expect(clampVolume(NaN)).toBe(DEFAULT_VOLUME);
    expect(clampVolume(undefined)).toBe(DEFAULT_VOLUME);
  });
  test('sayısal string kabul edilir', () => { expect(clampVolume('0.3')).toBeCloseTo(0.3); });
});

// ── İndeks sarmalama ──────────────────────────────────────────────────────────
describe('wrapIndex / nextIndex / prevIndex', () => {
  const { wrapIndex, nextIndex, prevIndex } = load();

  test('wrapIndex aralık içinde aynen döner', () => { expect(wrapIndex(2, 5)).toBe(2); });
  test('wrapIndex taşmayı başa sarar', () => { expect(wrapIndex(5, 5)).toBe(0); expect(wrapIndex(7, 5)).toBe(2); });
  test('wrapIndex negatifi sona sarar', () => { expect(wrapIndex(-1, 5)).toBe(4); expect(wrapIndex(-6, 5)).toBe(4); });
  test('boş liste → 0', () => { expect(wrapIndex(3, 0)).toBe(0); expect(nextIndex(0, 0)).toBe(0); });

  test('nextIndex son elemandan başa döner', () => { expect(nextIndex(4, 5)).toBe(0); });
  test('prevIndex ilk elemandan sona döner', () => { expect(prevIndex(0, 5)).toBe(4); });
  test('next→prev tersini alır', () => { expect(prevIndex(nextIndex(2, 5), 5)).toBe(2); });
});

// ── Parça başlığı ─────────────────────────────────────────────────────────────
describe('trackTitle', () => {
  const { trackTitle } = load();
  test('uzantıyı atar', () => { expect(trackTitle('Song.mp3')).toBe('Song'); });
  test('alt çizgileri boşluğa çevirir, sadeleştirir', () => {
    expect(trackTitle('My_Favorite__Track.flac')).toBe('My Favorite Track');
  });
  test('boş/null güvenli', () => {
    expect(trackTitle('')).toBe('Bilinmeyen parça');
    expect(trackTitle(null)).toBe('Bilinmeyen parça');
  });
  test('uzantısız ad korunur', () => { expect(trackTitle('Live Set 2024')).toBe('Live Set 2024'); });
});

// ── URL doğrulama ─────────────────────────────────────────────────────────────
describe('isHttps', () => {
  const { isHttps } = load();
  test('https kabul', () => { expect(isHttps('https://ice1.somafm.com/x')).toBe(true); });
  test('http reddedilir (mixed-content)', () => { expect(isHttps('http://x/y')).toBe(false); });
  test('boş/çöp reddedilir', () => {
    expect(isHttps('')).toBe(false);
    expect(isHttps('ftp://x')).toBe(false);
    expect(isHttps(null)).toBe(false);
  });
});

// ── clampPos (viewport içi) ───────────────────────────────────────────────────
describe('clampPos', () => {
  const { clampPos } = load();
  const VP_W = 1000, VP_H = 800, W = 300, H = 360;
  test('içerideki konum korunur', () => { expect(clampPos(400, 200, W, H, VP_W, VP_H)).toEqual({ left: 400, top: 200 }); });
  test('sol/üst taşması kenara (8) çekilir', () => { expect(clampPos(-50, -80, W, H, VP_W, VP_H)).toEqual({ left: 8, top: 8 }); });
  test('sağ/alt taşması içeri clamp', () => {
    expect(clampPos(9999, 9999, W, H, VP_W, VP_H)).toEqual({ left: 1000 - 300 - 8, top: 800 - 360 - 8 });
  });
});

// ── Durum kalıcılığı ──────────────────────────────────────────────────────────
describe('loadState / saveState', () => {
  test('kayıt yokken güvenli varsayılanlar', () => {
    const { loadState, DEFAULT_VOLUME } = load();
    const s = loadState();
    expect(s.volume).toBe(DEFAULT_VOLUME);
    expect(s.tab).toBe('stations');
    expect(s.stationId).toBeNull();
    expect(s.stationCat).toBe('Tümü');
    expect(s.open).toBe(false);
    expect(s.favorites).toEqual([]);
    expect(s.customStations).toEqual([]);
    expect(s.pos).toBeNull();
  });

  test('favorites yalnızca string id\'leri geri yükler + kaydedilir', () => {
    const api = load();
    api.saveState({ favorites: ['groove-salad', 123, null, 'joy-fm'] });
    expect(api.loadState().favorites).toEqual(['groove-salad', 'joy-fm']);
  });

  test('stationCat kaydedilir ve geri okunur', () => {
    const api = load();
    api.saveState({ stationCat: 'Metal' });
    expect(api.loadState().stationCat).toBe('Metal');
  });

  test('saveState yazar, loadState geri okur', () => {
    const api = load();
    api.saveState({ volume: 0.3, tab: 'library', stationId: 'lush', open: true });
    const s = api.loadState();
    expect(s.volume).toBeCloseTo(0.3);
    expect(s.tab).toBe('library');
    expect(s.stationId).toBe('lush');
    expect(s.open).toBe(true);
  });

  test('saveState kısmi güncellemede diğer alanları korur (merge)', () => {
    const api = load();
    api.saveState({ volume: 0.5, stationId: 'defcon' });
    api.saveState({ tab: 'library' });          // yalnızca tab
    const s = api.loadState();
    expect(s.volume).toBeCloseTo(0.5);
    expect(s.stationId).toBe('defcon');
    expect(s.tab).toBe('library');
  });

  test('bozuk değerler güvenli varsayılana düşer', () => {
    const api = load();
    window.localStorage.setItem('mf-radio', JSON.stringify({ volume: 5, tab: 'saçma', pos: { left: 'x' } }));
    const s = api.loadState();
    expect(s.volume).toBe(1);           // clamp
    expect(s.tab).toBe('stations');     // geçersiz → varsayılan
    expect(s.pos).toBeNull();           // geçersiz konum
  });

  test('geçerli konum korunur', () => {
    const api = load();
    api.saveState({ pos: { left: 120, top: 90 } });
    expect(api.loadState().pos).toEqual({ left: 120, top: 90 });
  });

  test('bozuk JSON çökmez, varsayılan döner', () => {
    const api = load();
    window.localStorage.setItem('mf-radio', '{bozuk');
    expect(api.loadState().tab).toBe('stations');
  });

  test('yalnızca https özel istasyonlar geri yüklenir', () => {
    const api = load();
    window.localStorage.setItem('mf-radio', JSON.stringify({ customStations: [
      { name: 'İyi', url: 'https://ok/stream' },
      { name: 'Kötü', url: 'http://insecure/stream' },
      { url: 'https://noname/stream' }
    ] }));
    const cs = api.loadState().customStations;
    expect(cs.length).toBe(2);
    expect(cs[0].name).toBe('İyi');
    expect(cs.every(s => /^https:/.test(s.url))).toBe(true);
  });
});

// ── Özel istasyon ekleme ──────────────────────────────────────────────────────
describe('addCustomStation', () => {
  const { addCustomStation } = load();

  test('geçerli https ekler', () => {
    const r = addCustomStation([], 'Radyo X', 'https://x/stream');
    expect(r.ok).toBe(true);
    expect(r.list.length).toBe(1);
    expect(r.station.name).toBe('Radyo X');
    expect(r.station.custom).toBe(true);
  });

  test('http reddeder', () => {
    const r = addCustomStation([], 'Nope', 'http://x/stream');
    expect(r.ok).toBe(false);
    expect(r.reason).toBe('https');
    expect(r.list.length).toBe(0);
  });

  test('aynı URL tekrarını reddeder', () => {
    const first = addCustomStation([], 'A', 'https://x/stream');
    const dup = addCustomStation(first.list, 'B', 'https://x/stream');
    expect(dup.ok).toBe(false);
    expect(dup.reason).toBe('dup');
    expect(dup.list.length).toBe(1);
  });

  test('ad boşsa host adından türetir', () => {
    const r = addCustomStation([], '', 'https://radyo.example.com/live');
    expect(r.ok).toBe(true);
    expect(r.station.name).toBe('radyo.example.com');
  });

  test('girdi listesini mutasyona uğratmaz (saf)', () => {
    const src = [];
    addCustomStation(src, 'A', 'https://x/stream');
    expect(src.length).toBe(0);
  });
});

// ── İstasyon listesi bütünlüğü + yardımcılar ──────────────────────────────────
describe('STATIONS + allStations + stationIndexById', () => {
  const api = load();

  test('tüm yerleşik istasyonlar HTTPS, eksiksiz ve geçerli kategoride', () => {
    expect(api.STATIONS.length).toBeGreaterThan(0);
    api.STATIONS.forEach(s => {
      expect(api.isHttps(s.url)).toBe(true);           // mixed-content olmasın
      expect(typeof s.name).toBe('string');
      expect(s.name.length).toBeGreaterThan(0);
      expect(typeof s.genre).toBe('string');
      expect(typeof s.id).toBe('string');
      expect(typeof s.cat).toBe('string');
      expect(api.CAT_ORDER.indexOf(s.cat)).toBeGreaterThanOrEqual(0);   // bilinen kategori
    });
  });

  test('kullanıcının istediği kilit istasyonlar mevcut (Joy FM + Bach + Metal + Klasik + Phonk)', () => {
    const names = api.STATIONS.map(s => s.name.toLowerCase());
    const cats = api.STATIONS.map(s => s.cat);
    expect(names.some(n => n.includes('joy fm'))).toBe(true);
    expect(names.some(n => n.includes('bach'))).toBe(true);
    expect(cats).toContain('Metal');
    expect(cats).toContain('Klasik');
    expect(cats).toContain('Rock');
    expect(cats).toContain('Phonk');
    expect(cats).toContain('Marşlar');
    expect(names.some(n => n.includes('red army'))).toBe(true);   // Sovyet marşı isteği
    // Türkçe ve Phonk kategorilerinde birden fazla istasyon olmalı
    expect(cats.filter(c => c === 'Türkçe').length).toBeGreaterThanOrEqual(5);
    expect(cats.filter(c => c === 'Phonk').length).toBeGreaterThanOrEqual(3);
  });

  test('istasyon id\'leri benzersiz', () => {
    const ids = api.STATIONS.map(s => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test('allStations yerleşik + özel birleşimini verir', () => {
    const custom = [{ id: 'c1', name: 'C', genre: 'Özel', url: 'https://c/1', custom: true }];
    expect(api.allStations(custom).length).toBe(api.STATIONS.length + 1);
    expect(api.allStations(null).length).toBe(api.STATIONS.length);
  });

  test('stationIndexById yerleşik ve özeli bulur, yoksa -1', () => {
    const custom = [{ id: 'c1', name: 'C', genre: 'Özel', url: 'https://c/1', custom: true }];
    expect(api.stationIndexById(custom, api.STATIONS[0].id)).toBe(0);
    expect(api.stationIndexById(custom, 'c1')).toBe(api.STATIONS.length);
    expect(api.stationIndexById(custom, 'yok')).toBe(-1);
  });
});

// ── Kategori süzme + kategori listesi (saf) ───────────────────────────────────
describe('filterStationsByCat / stationCategories', () => {
  const api = load();

  test('CAT_ALL tüm istasyonları döndürür (kopya)', () => {
    const r = api.filterStationsByCat(api.STATIONS, api.CAT_ALL);
    expect(r.length).toBe(api.STATIONS.length);
    expect(r).not.toBe(api.STATIONS);   // kopya, referans değil
  });

  test('belirli kategori yalnızca o kategoriyi süzer', () => {
    const tr = api.filterStationsByCat(api.STATIONS, 'Türkçe');
    expect(tr.length).toBeGreaterThan(0);
    expect(tr.every(s => s.cat === 'Türkçe')).toBe(true);
  });

  test('boş/bilinmeyen girdi güvenli', () => {
    expect(api.filterStationsByCat(null, 'Rock')).toEqual([]);
    expect(api.filterStationsByCat(api.STATIONS, 'YokBöyle')).toEqual([]);
  });

  test('stationCategories CAT_ORDER sırasında + adetli döner', () => {
    const cats = api.stationCategories(null);
    expect(cats.length).toBeGreaterThan(0);
    // her kategori CAT_ORDER içinde ve sıralı
    const idx = cats.map(c => api.CAT_ORDER.indexOf(c.cat));
    for (let i = 1; i < idx.length; i++) expect(idx[i]).toBeGreaterThan(idx[i - 1]);
    // adet toplamı istasyon sayısına eşit
    expect(cats.reduce((n, c) => n + c.count, 0)).toBe(api.STATIONS.length);
  });

  test('özel istasyon "Özel" kategorisini ekler', () => {
    const custom = [{ id: 'c1', name: 'C', genre: 'x', cat: api.CAT_CUSTOM, url: 'https://c/1', custom: true }];
    const cats = api.stationCategories(custom);
    expect(cats.some(c => c.cat === api.CAT_CUSTOM && c.count === 1)).toBe(true);
  });
});

// ── Favoriler (saf) ───────────────────────────────────────────────────────────
describe('favoriler: isFavorite / toggleFavorite / favoriteStations', () => {
  const api = load();

  test('toggleFavorite ekler ve çıkarır', () => {
    let f = api.toggleFavorite([], 'a');
    expect(f).toEqual(['a']);
    f = api.toggleFavorite(f, 'b');
    expect(f).toEqual(['a', 'b']);
    f = api.toggleFavorite(f, 'a');   // tekrar → çıkar
    expect(f).toEqual(['b']);
  });

  test('toggleFavorite girdiyi mutasyona uğratmaz (saf)', () => {
    const src = ['x'];
    api.toggleFavorite(src, 'y');
    expect(src).toEqual(['x']);
  });

  test('isFavorite doğru raporlar', () => {
    expect(api.isFavorite(['a', 'b'], 'b')).toBe(true);
    expect(api.isFavorite(['a'], 'z')).toBe(false);
    expect(api.isFavorite(null, 'a')).toBe(false);
  });

  test('favoriteStations liste sırasını koruyarak süzer', () => {
    const favIds = [api.STATIONS[3].id, api.STATIONS[0].id];
    const r = api.favoriteStations(api.STATIONS, favIds);
    expect(r.map(s => s.id)).toEqual([api.STATIONS[0].id, api.STATIONS[3].id]);
  });

  test('boş/geçersiz favoride boş döner', () => {
    expect(api.favoriteStations(api.STATIONS, [])).toEqual([]);
    expect(api.favoriteStations(api.STATIONS, ['yok'])).toEqual([]);
  });
});

// ── UI smoke: widget kurulur ve patlamaz (tek smoke testi — bkz. test politikası)
describe('UI smoke', () => {
  let playCalls;
  beforeEach(() => {
    // Uygulama kabuğu (#ve-ribbon) + toolbar düğmesi → init() UI'yı kurar.
    document.body.innerHTML = '<div id="ve-ribbon"></div><button id="ve-radio-btn"></button>';
    playCalls = 0;
    const AudioStub = function () {
      return {
        _l: {}, volume: 1, src: '', paused: true, preload: '',
        addEventListener(t, h) { (this._l[t] = this._l[t] || []).push(h); },
        play() { this.paused = false; playCalls++; return Promise.resolve(); },
        pause() { this.paused = true; }
      };
    };
    global.Audio = AudioStub; window.Audio = AudioStub;
    global.URL.createObjectURL = () => 'blob:mock';
    global.URL.revokeObjectURL = () => {};
    global.showToast = jest.fn();
  });

  test('init widget oluşturur; toggle açar/kapar; istasyon çalar', () => {
    const api = require('../../js/radio.js');   // init() burada koşar
    const w = document.getElementById('mf-radio');
    expect(w).not.toBeNull();
    expect(w.querySelectorAll('.mf-radio-item[data-station]').length).toBe(api.STATIONS.length);

    api.toggle();
    expect(w.classList.contains('open')).toBe(true);
    api.toggle();
    expect(w.classList.contains('open')).toBe(false);

    // İstasyona tıkla → Audio.play çağrılır, LCD güncellenir, hata fırlatmaz.
    w.querySelector('.mf-radio-item[data-station]').click();
    expect(playCalls).toBeGreaterThan(0);
    expect(document.getElementById('mf-radio-title').textContent).toBe(api.STATIONS[0].name);
  });

  test('özel https istasyon eklenip kalıcı olur', () => {
    const api = require('../../js/radio.js');
    const w = document.getElementById('mf-radio');
    const input = w.querySelector('.mf-radio-url');
    input.value = 'https://example.com/live';
    w.querySelector('.mf-radio-add-btn').click();
    expect(api.loadState().customStations.some(s => s.url === 'https://example.com/live')).toBe(true);
  });

  test('boş kütüphane sekmesi bilgilendirici boş durum gösterir', () => {
    require('../../js/radio.js');
    const w = document.getElementById('mf-radio');
    w.querySelector('.mf-radio-tab[data-tab="library"]').click();
    const pane = w.querySelector('[data-pane="library"]');
    expect(pane.hidden).toBe(false);
    expect(pane.querySelector('.mf-radio-pick')).not.toBeNull();
    expect(pane.querySelector('.mf-radio-empty')).not.toBeNull();
  });

  test('kategori açılır menüsü: seçici açar, kategori seçince süzer + kalıcı', () => {
    const api = require('../../js/radio.js');
    const w = document.getElementById('mf-radio');
    // Başlangıç: menü kapalı → seçici var, kategori seçenekleri yok
    expect(w.querySelector('.mf-radio-catsel')).not.toBeNull();
    expect(w.querySelector('.mf-radio-catopt')).toBeNull();

    // Seçiciye tıkla → menü açılır (Tümü + kategoriler)
    w.querySelector('.mf-radio-catsel').click();
    const opts = w.querySelectorAll('.mf-radio-catopt');
    expect(opts.length).toBeGreaterThan(1);

    // "Türkçe" kategorisini seç
    const tr = [...opts].find(o => o.getAttribute('data-cat') === 'Türkçe');
    expect(tr).toBeTruthy();
    tr.click();

    // Menü kapanır; etiket "Türkçe"; liste yalnızca Türkçe istasyonları
    expect(w.querySelector('.mf-radio-catopt')).toBeNull();
    expect(w.querySelector('.mf-radio-catsel-label').textContent).toBe('Türkçe');
    const shown = w.querySelectorAll('.mf-radio-item[data-station]').length;
    expect(shown).toBe(api.STATIONS.filter(s => s.cat === 'Türkçe').length);
    expect(api.loadState().stationCat).toBe('Türkçe');
  });

  test('yıldız ile favori ekle/çıkar + Favoriler filtresi', () => {
    const api = require('../../js/radio.js');
    const w = document.getElementById('mf-radio');

    // İlk istasyonu yıldızla (Tümü görünümünde)
    const star = w.querySelector('.mf-radio-fav[data-fav]');
    expect(star).not.toBeNull();
    const favId = star.getAttribute('data-fav');
    star.click();
    expect(api.loadState().favorites).toContain(favId);

    // Seçiciyi aç → "Favoriler" seç
    w.querySelector('.mf-radio-catsel').click();
    const favOpt = [...w.querySelectorAll('.mf-radio-catopt')].find(o => o.getAttribute('data-cat') === api.CAT_FAV);
    expect(favOpt).toBeTruthy();
    favOpt.click();

    // Yalnızca favorilenen istasyon görünür
    let shown = w.querySelectorAll('.mf-radio-item[data-station]');
    expect(shown.length).toBe(1);
    expect(shown[0].getAttribute('data-station')).toBe(favId);

    // Yıldıza tekrar bas → favoriden çıkar → boş durum
    w.querySelector('.mf-radio-fav[data-fav]').click();
    expect(api.loadState().favorites).not.toContain(favId);
    expect(w.querySelector('.mf-radio-item[data-station]')).toBeNull();
    expect(w.querySelector('.mf-radio-empty')).not.toBeNull();
  });

  test('mini oynatıcı: panel kapalıyken çalarken görünür; expand açar, kapatınca döner', () => {
    const api = require('../../js/radio.js');
    const w = document.getElementById('mf-radio');
    const mini = document.getElementById('mf-radio-mini');
    expect(mini).not.toBeNull();
    expect(mini.classList.contains('show')).toBe(false);   // henüz çalmıyor + panel kapalı

    // Panel kapalıyken bir istasyon çal → mini görünür + doğru başlık + EQ (playing)
    w.querySelector('.mf-radio-item[data-station]').click();
    expect(mini.classList.contains('show')).toBe(true);
    expect(mini.classList.contains('playing')).toBe(true);
    expect(mini.querySelector('.mf-radio-mini-title').textContent).toBe(api.STATIONS[0].name);

    // Expand → panel açılır, mini gizlenir
    mini.querySelector('[data-act="expand"]').click();
    expect(w.classList.contains('open')).toBe(true);
    expect(mini.classList.contains('show')).toBe(false);

    // Paneli kapat → mini tekrar görünür
    w.querySelector('.mf-radio-close').click();
    expect(w.classList.contains('open')).toBe(false);
    expect(mini.classList.contains('show')).toBe(true);
  });
});
