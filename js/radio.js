// ============================================================================
// RADYO / MÜZİK ÇALAR — Sürüklenebilir mini "head-unit"
// ============================================================================
// Araç performans simülatörüne yakışan küçük bir müzik çalar. İki kaynak:
//   • İstasyonlar — küratörlü HTTPS internet radyosu (canlı yayın)
//   • Kütüphanem  — kullanıcının kendi yerel ses dosyaları (offline, playlist)
//
// Tasarım notları:
//   - Tek bir <audio> öğesi paylaşılır; kaynak (istasyon URL'si veya yerel
//     dosyanın object-url'i) değiştirilerek çalınır. <audio> tembel (lazy)
//     oluşturulur → jsdom/birim testinde Audio'ya dokunulmaz.
//   - Otomatik oynatma tarayıcıda kullanıcı jesti gerektirir; oynat düğmesine
//     basmak jestin kendisidir → sorun olmaz.
//   - Deploy HTTPS olduğundan yalnızca HTTPS yayınlar çalışır (mixed-content).
//     İstasyon listesi buna göre seçildi; bir yayın düşerse 'error' olayında
//     kullanıcı bilgilendirilir. Kullanıcı "Özel URL" ile kendi yayınını ekler.
//   - Durum (ses, sekme, son istasyon, özel istasyonlar, pencere konumu,
//     açık/kapalı) localStorage'da 'mf-radio' altında saklanır.
//   - Uygulama kabuğu (#tab-bar) yoksa init() no-op'tur → birim testleri saf
//     fonksiyonları require ile yükleyip UI kurmadan test edebilir.
//
// Saf/testlenebilir fonksiyonlar module.exports ile dışa verilir.
// ============================================================================

(function (global) {
  'use strict';

  var STORE_KEY      = 'mf-radio';
  var DEFAULT_VOLUME = 0.7;
  var MARGIN         = 8;   // pencere-viewport kenar boşluğu (px)
  var WIDGET_ID      = 'mf-radio';
  var BTN_ID         = 've-radio-btn';

  // ─── Küratörlü istasyonlar (HTTPS zorunlu) ─────────────────────────────────
  // SomaFM: reklamsız, dinleyici destekli; doğrudan yayın bağlantısına izin
  // verir ve HTTPS sunar. URL'ler zamanla değişebilir → kullanıcı "Özel URL"
  // ile kendi yayınını da ekleyebilir; düşen yayın 'error' ile bildirilir.
  var STATIONS = [
    { id: 'groovesalad',  name: 'Groove Salad',    genre: 'Chill · Downtempo',   url: 'https://ice1.somafm.com/groovesalad-128-mp3' },
    { id: 'dronezone',    name: 'Drone Zone',      genre: 'Ambient',             url: 'https://ice1.somafm.com/dronezone-128-mp3' },
    { id: 'lush',         name: 'Lush',            genre: 'Vokal · Elektronik',  url: 'https://ice1.somafm.com/lush-128-mp3' },
    { id: 'secretagent',  name: 'Secret Agent',    genre: 'Lounge · Jazz-noir',  url: 'https://ice1.somafm.com/secretagent-128-mp3' },
    { id: 'indiepop',     name: 'Indie Pop Rocks', genre: 'Indie Pop',           url: 'https://ice1.somafm.com/indiepop-128-mp3' },
    { id: 'beatblender',  name: 'Beat Blender',    genre: 'Deep House',          url: 'https://ice1.somafm.com/beatblender-128-mp3' },
    { id: 'spacestation', name: 'Space Station',   genre: 'Space · Electronica', url: 'https://ice1.somafm.com/spacestation-128-mp3' },
    { id: 'defcon',       name: 'DEF CON Radio',   genre: 'Techno · Hacker',     url: 'https://ice1.somafm.com/defcon-128-mp3' },
    { id: 'fluid',        name: 'Fluid',           genre: 'Chillhop · Future',   url: 'https://ice1.somafm.com/fluid-128-mp3' },
    { id: 'sonicuniverse',name: 'Sonic Universe',  genre: 'Jazz · Avangard',     url: 'https://ice1.somafm.com/sonicuniverse-128-mp3' }
  ];

  // ══════════════════════════════════════════════════════════════════════════
  // SAF FONKSİYONLAR (testlenebilir — DOM'a dokunmaz)
  // ══════════════════════════════════════════════════════════════════════════

  // Ses seviyesini 0..1 aralığına kıstır (NaN → varsayılan).
  function clampVolume(v) {
    v = parseFloat(v);
    if (!isFinite(v)) return DEFAULT_VOLUME;
    return Math.min(1, Math.max(0, v));
  }

  // Dizin sarmalama: negatif/taşan indeks → [0, len) aralığına döner.
  function wrapIndex(i, len) {
    len = len | 0;
    if (len < 1) return 0;
    i = i | 0;
    return ((i % len) + len) % len;
  }
  function nextIndex(cur, len) { return wrapIndex((cur | 0) + 1, len); }
  function prevIndex(cur, len) { return wrapIndex((cur | 0) - 1, len); }

  // Dosya adından okunur başlık: uzantıyı at, _ → boşluk, çoklu boşluğu sadeleştir.
  function trackTitle(name) {
    if (name == null) return 'Bilinmeyen parça';
    var s = String(name).replace(/\.[a-z0-9]+$/i, '');   // uzantı
    s = s.replace(/_+/g, ' ').replace(/\s+/g, ' ').trim();
    return s || 'Bilinmeyen parça';
  }

  // Yalnızca https:// ile başlayan geçerli bir URL mi?
  function isHttps(url) {
    return typeof url === 'string' && /^https:\/\/\S+/i.test(url.trim());
  }

  // Konumu viewport içinde tut (window-drag ile aynı mantık — testlenebilir).
  function clampPos(left, top, winW, winH, vpW, vpH) {
    var maxLeft = Math.max(MARGIN, vpW - winW - MARGIN);
    var maxTop  = Math.max(MARGIN, vpH - winH - MARGIN);
    return {
      left: Math.min(Math.max(left, MARGIN), maxLeft),
      top:  Math.min(Math.max(top,  MARGIN), maxTop)
    };
  }

  // ─── Kalıcılık ──────────────────────────────────────────────────────────────
  function _rawState() {
    try {
      var raw = global.localStorage && global.localStorage.getItem(STORE_KEY);
      if (raw) { var o = JSON.parse(raw); if (o && typeof o === 'object') return o; }
    } catch (e) {}
    return {};
  }

  // Doğrulanmış, normalize edilmiş durum döndür (bozuk değerler güvenli varsayılana düşer).
  function loadState() {
    var s = _rawState();
    var out = {
      volume:    clampVolume(typeof s.volume === 'number' ? s.volume : DEFAULT_VOLUME),
      tab:       (s.tab === 'library') ? 'library' : 'stations',
      stationId: typeof s.stationId === 'string' ? s.stationId : null,
      open:      !!s.open,
      customStations: [],
      pos: null
    };
    if (Array.isArray(s.customStations)) {
      s.customStations.forEach(function (st) {
        if (!st || !isHttps(st.url)) return;
        var nm = (typeof st.name === 'string' && st.name.trim())
          ? st.name : st.url.replace(/^https:\/\//i, '').split('/')[0];   // host adı
        out.customStations.push({
          id: (typeof st.id === 'string' && st.id) ? st.id : ('custom-' + out.customStations.length),
          name: nm, genre: st.genre || 'Özel', url: st.url, custom: true
        });
      });
    }
    if (s.pos && typeof s.pos.left === 'number' && typeof s.pos.top === 'number' &&
        isFinite(s.pos.left) && isFinite(s.pos.top)) {
      out.pos = { left: s.pos.left, top: s.pos.top };
    }
    return out;
  }

  // Kısmi durumu mevcut durumla birleştirip yaz. Birleştirilmiş nesneyi döndürür.
  function saveState(patch) {
    var merged = Object.assign({}, _rawState(), patch || {});
    try {
      if (global.localStorage) global.localStorage.setItem(STORE_KEY, JSON.stringify(merged));
    } catch (e) {}
    return merged;
  }

  // Özel istasyon ekle (saf): doğrula, tekrarı ele, yeni liste + sonuç döndür.
  function addCustomStation(list, name, url) {
    list = Array.isArray(list) ? list.slice() : [];
    name = (name == null ? '' : String(name)).trim();
    url  = (url == null ? '' : String(url)).trim();
    if (!isHttps(url)) return { ok: false, reason: 'https', list: list };
    for (var i = 0; i < list.length; i++) {
      if (list[i] && list[i].url === url) return { ok: false, reason: 'dup', list: list };
    }
    if (!name) name = url.replace(/^https:\/\//i, '').split('/')[0];   // host adı
    var st = { id: 'custom-' + list.length + '-' + name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
               name: name, genre: 'Özel', url: url, custom: true };
    list.push(st);
    return { ok: true, station: st, list: list };
  }

  // Yerleşik + özel istasyonların birleşik listesi.
  function allStations(customList) {
    return STATIONS.concat(Array.isArray(customList) ? customList : []);
  }

  // Verilen istasyon id'sinin birleşik listedeki indeksi (yoksa -1).
  function stationIndexById(customList, id) {
    var all = allStations(customList);
    for (var i = 0; i < all.length; i++) { if (all[i].id === id) return i; }
    return -1;
  }

  // ══════════════════════════════════════════════════════════════════════════
  // UI KATMANI (yalnızca tarayıcıda; #tab-bar yoksa hiç kurulmaz)
  // ══════════════════════════════════════════════════════════════════════════

  var built   = false;
  var audio   = null;                 // paylaşılan <audio> (tembel)
  var library = [];                   // [{ name, url }]  yerel parçalar
  var libUrls = [];                   // temizlenecek object-url'ler
  var libIndex = -1;                  // çalan yerel parça indeksi
  var current = null;                 // { type:'station'|'track', ... }
  var lastVol = DEFAULT_VOLUME;       // sessize alma öncesi ses
  var st      = { volume: DEFAULT_VOLUME, tab: 'stations', stationId: null, open: false, customStations: [], pos: null };

  var ICONS = {
    play:  '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7 4.5v15l12-7.5z"/></svg>',
    pause: '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="6.5" y="4.5" width="4" height="15" rx="1"/><rect x="13.5" y="4.5" width="4" height="15" rx="1"/></svg>',
    prev:  '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7 5v14h2.1V5zM19 5l-9 7 9 7z"/></svg>',
    next:  '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M17 5v14h-2.1V5zM5 5l9 7-9 7z"/></svg>',
    vol:   '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M4 9.5v5h3.5L13 19V5L7.5 9.5z"/><path d="M16.5 8.5a4.5 4.5 0 0 1 0 7" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
    mute:  '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M4 9.5v5h3.5L13 19V5L7.5 9.5z"/><path d="M16.5 9.5l5 5M21.5 9.5l-5 5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>',
    close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>',
    folder:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 7h6l2 2h10v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z"/></svg>',
    plus:  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>'
  };

  function $(id) { return global.document.getElementById(id); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  // ─── <audio> (tembel) ───────────────────────────────────────────────────────
  function getAudio() {
    if (audio) return audio;
    if (typeof global.Audio !== 'function') return null;
    audio = new global.Audio();
    audio.preload = 'none';
    audio.volume = clampVolume(st.volume);
    audio.addEventListener('play',  syncPlaying);
    audio.addEventListener('pause', syncPlaying);
    audio.addEventListener('playing', syncPlaying);
    audio.addEventListener('ended', function () {
      // Yerel çalma listesinde otomatik sıradaki parçaya geç (istasyon "bitmez").
      if (current && current.type === 'track' && library.length) { playTrack(nextIndex(libIndex, library.length)); }
    });
    audio.addEventListener('error', function () {
      if (!current) return;
      toast(current.type === 'station'
        ? 'İstasyona bağlanılamadı — yayın kapalı olabilir veya internet yok.'
        : 'Parça çalınamadı.', 'error');
      setPlaying(false);
    });
    return audio;
  }

  function toast(msg, type) {
    if (typeof global.showToast === 'function') global.showToast(msg, type);
  }

  // ─── LCD / oynatma durumu ────────────────────────────────────────────────────
  function setLcd(title, sub) {
    var t = $('mf-radio-title'), s2 = $('mf-radio-sub');
    if (t)  t.textContent  = title;
    if (s2) s2.textContent = sub || '';
  }

  function syncPlaying() {
    setPlaying(!!(audio && !audio.paused));
  }

  function setPlaying(on) {
    var w = $(WIDGET_ID);
    if (w) w.classList.toggle('playing', !!on);
    var pp = w && w.querySelector('[data-act="playpause"]');
    if (pp) { pp.innerHTML = on ? ICONS.pause : ICONS.play; pp.title = on ? 'Duraklat' : 'Oynat'; }
  }

  // ─── Çalma ────────────────────────────────────────────────────────────────────
  function playStation(station) {
    var a = getAudio();
    if (!a || !station) return;
    current = { type: 'station', id: station.id, name: station.name, genre: station.genre, url: station.url };
    libIndex = -1;
    setLcd(station.name, station.genre || 'Canlı yayın');
    a.src = station.url;
    var p = a.play();
    if (p && p.catch) p.catch(function () {/* error olayı ele alır */});
    st.stationId = station.id; saveState({ stationId: station.id });
    renderStations(); renderLibrary();
  }

  function playTrack(i) {
    var a = getAudio();
    if (!a || !library.length) return;
    libIndex = wrapIndex(i, library.length);
    var tr = library[libIndex];
    current = { type: 'track', name: tr.name, url: tr.url };
    setLcd(trackTitle(tr.name), 'Kütüphanem · ' + (libIndex + 1) + '/' + library.length);
    a.src = tr.url;
    var p = a.play();
    if (p && p.catch) p.catch(function () {});
    renderStations(); renderLibrary();
  }

  function togglePlayPause() {
    var a = getAudio();
    if (!a) return;
    if (a.src && !a.paused) { a.pause(); return; }
    if (a.src && a.paused && current) { var p = a.play(); if (p && p.catch) p.catch(function () {}); return; }
    // Henüz bir kaynak yok → makul bir başlangıç seç.
    if (st.tab === 'library' && library.length) { playTrack(0); return; }
    var all = allStations(st.customStations);
    var idx = st.stationId ? stationIndexById(st.customStations, st.stationId) : 0;
    playStation(all[idx >= 0 ? idx : 0]);
  }

  function skip(dir) {
    if (current && current.type === 'track' && library.length) {
      playTrack(dir > 0 ? nextIndex(libIndex, library.length) : prevIndex(libIndex, library.length));
      return;
    }
    var all = allStations(st.customStations);
    if (!all.length) return;
    var idx = current && current.type === 'station' ? stationIndexById(st.customStations, current.id) : -1;
    if (idx < 0) idx = st.stationId ? stationIndexById(st.customStations, st.stationId) : 0;
    if (idx < 0) idx = 0;
    playStation(all[dir > 0 ? nextIndex(idx, all.length) : prevIndex(idx, all.length)]);
  }

  // ─── Ses ────────────────────────────────────────────────────────────────────
  function setVolume(v, persist) {
    st.volume = clampVolume(v);
    if (audio) audio.volume = st.volume;
    if (st.volume > 0) lastVol = st.volume;
    var w = $(WIDGET_ID);
    var mb = w && w.querySelector('[data-act="mute"]');
    if (mb) mb.innerHTML = st.volume === 0 ? ICONS.mute : ICONS.vol;
    if (persist) saveState({ volume: st.volume });
  }

  function toggleMute() {
    var slider = $(WIDGET_ID) && $(WIDGET_ID).querySelector('.mf-radio-vol-slider');
    if (st.volume > 0) { setVolume(0, true); if (slider) slider.value = 0; }
    else { setVolume(lastVol || DEFAULT_VOLUME, true); if (slider) slider.value = Math.round((lastVol || DEFAULT_VOLUME) * 100); }
  }

  // ─── Yerel dosyalar ───────────────────────────────────────────────────────────
  function onFilesPicked(fileList) {
    var files = Array.prototype.slice.call(fileList || []).filter(function (f) {
      return /^audio\//i.test(f.type) || /\.(mp3|m4a|aac|ogg|oga|wav|flac|opus|weba)$/i.test(f.name);
    });
    if (!files.length) { toast('Ses dosyası bulunamadı.', 'warning'); return; }
    // Önceki object-url'leri serbest bırak (bellek sızıntısı olmasın).
    revokeLibUrls();
    library = files.map(function (f) {
      var url = global.URL.createObjectURL(f);
      libUrls.push(url);
      return { name: f.name, url: url };
    });
    libIndex = -1;
    st.tab = 'library'; saveState({ tab: 'library' });
    switchTab('library');
    renderLibrary();
    toast(library.length + ' parça eklendi.', 'info');
    playTrack(0);
  }

  function revokeLibUrls() {
    if (global.URL && global.URL.revokeObjectURL) {
      libUrls.forEach(function (u) { try { global.URL.revokeObjectURL(u); } catch (e) {} });
    }
    libUrls = [];
  }

  // ─── Render ─────────────────────────────────────────────────────────────────
  function renderStations() {
    var pane = $(WIDGET_ID) && $(WIDGET_ID).querySelector('[data-pane="stations"]');
    if (!pane) return;
    var all = allStations(st.customStations);
    var curId = current && current.type === 'station' ? current.id : null;
    var rows = all.map(function (s2) {
      var on = s2.id === curId;
      return '<button type="button" class="mf-radio-item' + (on ? ' active' : '') + '" data-station="' + esc(s2.id) + '">' +
               '<span class="mf-radio-item-dot"></span>' +
               '<span class="mf-radio-item-main"><span class="mf-radio-item-name">' + esc(s2.name) + '</span>' +
               '<span class="mf-radio-item-sub">' + esc(s2.genre || '') + '</span></span>' +
             '</button>';
    }).join('');
    pane.innerHTML =
      '<div class="mf-radio-list">' + rows + '</div>' +
      '<div class="mf-radio-add">' +
        '<input type="url" class="mf-radio-url" placeholder="https://… özel yayın URL\'si" aria-label="Özel yayın URL\'si" />' +
        '<button type="button" class="mf-radio-add-btn" title="Özel istasyon ekle">' + ICONS.plus + '</button>' +
      '</div>';
  }

  function renderLibrary() {
    var pane = $(WIDGET_ID) && $(WIDGET_ID).querySelector('[data-pane="library"]');
    if (!pane) return;
    var head =
      '<button type="button" class="mf-radio-pick">' + ICONS.folder + '<span>Dosya ekle…</span></button>';
    if (!library.length) {
      pane.innerHTML = head + '<div class="mf-radio-empty">Kendi müziğini ekle. Tarayıcıdan çıkmaz; internetsiz de çalar.</div>';
      return;
    }
    var rows = library.map(function (tr, i) {
      var on = current && current.type === 'track' && i === libIndex;
      return '<button type="button" class="mf-radio-item' + (on ? ' active' : '') + '" data-track="' + i + '">' +
               '<span class="mf-radio-item-dot"></span>' +
               '<span class="mf-radio-item-main"><span class="mf-radio-item-name">' + esc(trackTitle(tr.name)) + '</span>' +
               '<span class="mf-radio-item-sub">' + esc('#' + (i + 1)) + '</span></span>' +
             '</button>';
    }).join('');
    pane.innerHTML = head + '<div class="mf-radio-list">' + rows + '</div>';
  }

  function switchTab(tab) {
    st.tab = (tab === 'library') ? 'library' : 'stations';
    var w = $(WIDGET_ID);
    if (!w) return;
    w.querySelectorAll('.mf-radio-tab').forEach(function (b) {
      b.classList.toggle('active', b.getAttribute('data-tab') === st.tab);
    });
    w.querySelectorAll('.mf-radio-pane').forEach(function (p) {
      p.hidden = (p.getAttribute('data-pane') !== st.tab);
    });
  }

  // ─── Aç / kapat ───────────────────────────────────────────────────────────────
  function openPlayer() {
    if (!built) init();
    var w = $(WIDGET_ID);
    if (!w) return;
    w.classList.add('open');
    st.open = true; saveState({ open: true });
    var btn = $(BTN_ID); if (btn) btn.classList.add('active');
  }

  function closePlayer() {
    var w = $(WIDGET_ID);
    if (w) w.classList.remove('open');
    st.open = false; saveState({ open: false });
    var btn = $(BTN_ID); if (btn) btn.classList.remove('active');
  }

  function togglePlayer() {
    var w = $(WIDGET_ID);
    if (w && w.classList.contains('open')) closePlayer(); else openPlayer();
  }

  // ─── Sürükleme ────────────────────────────────────────────────────────────────
  var drag = { active: false, sx: 0, sy: 0, bl: 0, bt: 0 };

  function placeAbsolute(w, left, top) {
    w.style.left = left + 'px';
    w.style.top  = top + 'px';
    w.style.right = 'auto';
    w.style.bottom = 'auto';
  }

  function vp() {
    var d = global.document.documentElement;
    return { w: global.innerWidth || (d && d.clientWidth) || 1280, h: global.innerHeight || (d && d.clientHeight) || 800 };
  }

  function onHeadDown(e) {
    if (e.button !== 0) return;
    if (e.target.closest && e.target.closest('.mf-radio-close, button, input')) return;
    var w = $(WIDGET_ID);
    if (!w) return;
    var r = w.getBoundingClientRect();
    drag.active = true; drag.sx = e.clientX; drag.sy = e.clientY; drag.bl = r.left; drag.bt = r.top;
    placeAbsolute(w, r.left, r.top);
    global.document.body.classList.add('mf-radio-dragging');
    e.preventDefault();
  }

  function onMove(e) {
    if (!drag.active) return;
    var w = $(WIDGET_ID);
    if (!w) return;
    var v = vp();
    var c = clampPos(drag.bl + (e.clientX - drag.sx), drag.bt + (e.clientY - drag.sy), w.offsetWidth, w.offsetHeight, v.w, v.h);
    w.style.left = c.left + 'px'; w.style.top = c.top + 'px'; w.style.right = 'auto'; w.style.bottom = 'auto';
  }

  function onUp() {
    if (!drag.active) return;
    drag.active = false;
    global.document.body.classList.remove('mf-radio-dragging');
    var w = $(WIDGET_ID);
    if (w) { var left = parseFloat(w.style.left), top = parseFloat(w.style.top);
      if (isFinite(left) && isFinite(top)) { st.pos = { left: left, top: top }; saveState({ pos: st.pos }); } }
  }

  // ─── Kurulum ──────────────────────────────────────────────────────────────────
  function buildWidget() {
    var w = global.document.createElement('div');
    w.id = WIDGET_ID;
    w.className = 'mf-radio';
    w.setAttribute('role', 'dialog');
    w.setAttribute('aria-label', 'Radyo / müzik çalar');
    w.innerHTML =
      '<div class="mf-radio-head">' +
        '<span class="mf-radio-brand"><span class="mf-radio-eq" aria-hidden="true"><i></i><i></i><i></i><i></i></span> RADYO</span>' +
        '<button type="button" class="mf-radio-close" title="Kapat" aria-label="Kapat">' + ICONS.close + '</button>' +
      '</div>' +
      '<div class="mf-radio-lcd">' +
        '<div class="mf-radio-lcd-title" id="mf-radio-title">— Kapalı —</div>' +
        '<div class="mf-radio-lcd-sub" id="mf-radio-sub">Bir istasyon ya da parça seç</div>' +
      '</div>' +
      '<div class="mf-radio-transport">' +
        '<button type="button" class="mf-radio-tbtn" data-act="prev" title="Önceki">' + ICONS.prev + '</button>' +
        '<button type="button" class="mf-radio-tbtn mf-radio-play" data-act="playpause" title="Oynat">' + ICONS.play + '</button>' +
        '<button type="button" class="mf-radio-tbtn" data-act="next" title="Sonraki">' + ICONS.next + '</button>' +
        '<span class="mf-radio-vol">' +
          '<button type="button" class="mf-radio-tbtn mf-radio-mute" data-act="mute" title="Sessize al">' + ICONS.vol + '</button>' +
          '<input type="range" class="mf-radio-vol-slider" min="0" max="100" value="70" aria-label="Ses seviyesi" />' +
        '</span>' +
      '</div>' +
      '<div class="mf-radio-tabs">' +
        '<button type="button" class="mf-radio-tab active" data-tab="stations">İstasyonlar</button>' +
        '<button type="button" class="mf-radio-tab" data-tab="library">Kütüphanem</button>' +
      '</div>' +
      '<div class="mf-radio-body">' +
        '<div class="mf-radio-pane" data-pane="stations"></div>' +
        '<div class="mf-radio-pane" data-pane="library" hidden></div>' +
      '</div>' +
      '<input type="file" class="mf-radio-file" accept="audio/*" multiple hidden />';
    global.document.body.appendChild(w);

    // ── Olay delegasyonu (içerik yeniden üretilse de kalır) ──
    w.addEventListener('click', function (e) {
      var t = e.target;
      var act = t.closest && t.closest('[data-act]');
      if (act) {
        var a = act.getAttribute('data-act');
        if (a === 'playpause') togglePlayPause();
        else if (a === 'next') skip(1);
        else if (a === 'prev') skip(-1);
        else if (a === 'mute') toggleMute();
        return;
      }
      if (t.closest && t.closest('.mf-radio-close')) { closePlayer(); return; }
      var tab = t.closest && t.closest('.mf-radio-tab');
      if (tab) { switchTab(tab.getAttribute('data-tab')); saveState({ tab: st.tab }); return; }
      var stn = t.closest && t.closest('[data-station]');
      if (stn) { var s2 = allStations(st.customStations).filter(function (x) { return x.id === stn.getAttribute('data-station'); })[0]; if (s2) playStation(s2); return; }
      var trk = t.closest && t.closest('[data-track]');
      if (trk) { playTrack(parseInt(trk.getAttribute('data-track'), 10) || 0); return; }
      var pick = t.closest && t.closest('.mf-radio-pick');
      if (pick) { var f = w.querySelector('.mf-radio-file'); if (f) f.click(); return; }
      var add = t.closest && t.closest('.mf-radio-add-btn');
      if (add) { doAddCustom(w); return; }
    });

    // Ses kaydırıcı: 'input' anlık ses, 'change' kalıcı yaz.
    var slider = w.querySelector('.mf-radio-vol-slider');
    slider.addEventListener('input',  function () { setVolume(this.value / 100, false); });
    slider.addEventListener('change', function () { setVolume(this.value / 100, true); });

    // Özel URL: Enter ile ekle.
    w.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && e.target && e.target.classList && e.target.classList.contains('mf-radio-url')) {
        e.preventDefault(); doAddCustom(w);
      }
    });

    // Dosya seçimi.
    w.querySelector('.mf-radio-file').addEventListener('change', function () { onFilesPicked(this.files); this.value = ''; });

    // Sürükleme (başlıktan).
    w.querySelector('.mf-radio-head').addEventListener('mousedown', onHeadDown);
    global.document.addEventListener('mousemove', onMove);
    global.document.addEventListener('mouseup', onUp);
  }

  function doAddCustom(w) {
    var input = w.querySelector('.mf-radio-url');
    if (!input) return;
    var res = addCustomStation(st.customStations, '', input.value);
    if (!res.ok) {
      toast(res.reason === 'https' ? 'Yalnızca https:// ile başlayan yayınlar eklenebilir.' : 'Bu yayın zaten listede.', 'warning');
      return;
    }
    st.customStations = res.list;
    saveState({ customStations: st.customStations });
    input.value = '';
    renderStations();
    toast('İstasyon eklendi: ' + res.station.name, 'info');
    playStation(res.station);
  }

  function applyState() {
    var s = loadState();
    st = s;
    lastVol = s.volume > 0 ? s.volume : DEFAULT_VOLUME;
    var w = $(WIDGET_ID);
    if (!w) return;
    // Ses
    var slider = w.querySelector('.mf-radio-vol-slider');
    if (slider) slider.value = Math.round(s.volume * 100);
    setVolume(s.volume, false);
    // Sekme + içerik
    renderStations(); renderLibrary(); switchTab(s.tab);
    // Konum
    if (s.pos) {
      var v = vp();
      var r = w.getBoundingClientRect();
      var c = clampPos(s.pos.left, s.pos.top, r.width || 300, r.height || 360, v.w, v.h);
      placeAbsolute(w, c.left, c.top);
    }
    // Açık/kapalı (ses ÇALMAZ — yalnızca panel görünürlüğü)
    if (s.open) { w.classList.add('open'); var btn = $(BTN_ID); if (btn) btn.classList.add('active'); }
  }

  function init() {
    if (built) return;
    if (!global.document || !global.document.body) return;
    // Uygulama kabuğu yoksa (ör. birim testleri) UI kurma — saf fonksiyonlar yeterli.
    if (!global.document.getElementById('tab-bar')) return;
    if (global.document.getElementById(WIDGET_ID)) { built = true; return; }
    buildWidget();
    built = true;
    applyState();
  }

  // Loader DOMContentLoaded'ı yakalar; login sonrası flush eder. readyState
  // zaten 'complete' ise doğrudan kur.
  if (global.document) {
    if (global.document.readyState === 'loading') {
      global.document.addEventListener('DOMContentLoaded', init);
    } else {
      init();
    }
  }

  // ─── Dışa aktar ───────────────────────────────────────────────────────────────
  var api = {
    STORE_KEY: STORE_KEY,
    STATIONS: STATIONS,
    DEFAULT_VOLUME: DEFAULT_VOLUME,
    // saf
    clampVolume: clampVolume,
    wrapIndex: wrapIndex,
    nextIndex: nextIndex,
    prevIndex: prevIndex,
    trackTitle: trackTitle,
    isHttps: isHttps,
    clampPos: clampPos,
    loadState: loadState,
    saveState: saveState,
    addCustomStation: addCustomStation,
    allStations: allStations,
    stationIndexById: stationIndexById,
    // ui
    open: openPlayer,
    close: closePlayer,
    toggle: togglePlayer,
    init: init
  };
  global.MFRadio = api;
  global.veToggleRadio = togglePlayer;   // toolbar onclick
  if (typeof module !== 'undefined' && module.exports) module.exports = api;

})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this));
