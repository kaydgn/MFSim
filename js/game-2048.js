// ═══════════════════════════════════════════════════════════════════════════
// MFSim Mola — 2048 🎮
// ───────────────────────────────────────────────────────────────────────────
// Sıkılan kullanıcı için küçük bir mola: Proje menüsünden açılan klasik 2048.
// Tasarım kalıbı js/easter-egg.js ve js/shortcuts-help.js ile birebir aynıdır:
//   • Kendi DOM'unu ve kendi <style>'ını LAZY (ilk açılışta) kurar.
//   • Hiçbir global fonksiyona sıkı bağımlılığı yoktur (hepsi opsiyonel çağrı).
//   • Temaya uyumludur (uygulamanın --bg / --text / --border değişkenleri);
//     oyun tahtası ise tanınırlık için klasik 2048 paletini korur.
//   • prefers-reduced-motion'a saygılıdır.
//   • En iyi skor localStorage'da saklanır (mf2048.best).
//
// Kod iki katmandır:
//   1) SAF MOTOR (mf2048*) — DOM'suz, deterministik, Jest'te test edilir.
//      (rng enjekte edilebilir → testler tekrarlanabilir.)
//   2) ARAYÜZ (veGame2048* + _mf2048*) — overlay, render, klavye/dokunmatik.
// ═══════════════════════════════════════════════════════════════════════════

var MF2048_SIZE = 4;      // tahta kenarı
var MF2048_TARGET = 2048; // kazanma karesi

// ─────────────────────────────────────────────────────────────────────────────
//  1) SAF MOTOR — DOM'suz, test edilebilir
// ─────────────────────────────────────────────────────────────────────────────

// Boş tahta (NxN sıfır). Array(n).fill([]) referans paylaşımından kaçınılır.
function mf2048NewBoard() {
  var b = [];
  for (var r = 0; r < MF2048_SIZE; r++) {
    var row = [];
    for (var c = 0; c < MF2048_SIZE; c++) row.push(0);
    b.push(row);
  }
  return b;
}

function _mf2048Clone(board) {
  return board.map(function(row) { return row.slice(); });
}

function _mf2048Transpose(board) {
  var t = mf2048NewBoard();
  for (var r = 0; r < MF2048_SIZE; r++)
    for (var c = 0; c < MF2048_SIZE; c++)
      t[c][r] = board[r][c];
  return t;
}

// Tek bir satırı SOLA kaydır+birleştir. Saf: girdiyi değiştirmez.
// Dönüş: { line:[...], gained:<int>, moved:<bool> }.
// Kural: bir kare tek hamlede yalnız bir kez birleşir ("2 2 2" → "4 2").
function mf2048SlideLine(line) {
  var compact = line.filter(function(v) { return v !== 0; });
  var out = [];
  var gained = 0;
  for (var i = 0; i < compact.length; i++) {
    if (i + 1 < compact.length && compact[i] === compact[i + 1]) {
      var merged = compact[i] * 2;
      out.push(merged);
      gained += merged;
      i++; // bir sonrakini tükettik
    } else {
      out.push(compact[i]);
    }
  }
  while (out.length < line.length) out.push(0);
  var moved = false;
  for (var k = 0; k < line.length; k++) {
    if (out[k] !== line[k]) { moved = true; break; }
  }
  return { line: out, gained: gained, moved: moved };
}

// Tüm tahtayı 'left' | 'right' | 'up' | 'down' yönünde kaydır. Saf.
// Dönüş: { board:<yeni tahta>, gained:<int>, moved:<bool> }.
function mf2048Move(board, dir) {
  var reverse = (dir === 'right' || dir === 'down');
  var transpose = (dir === 'up' || dir === 'down');
  var work = _mf2048Clone(board);
  if (transpose) work = _mf2048Transpose(work);

  var gained = 0;
  var moved = false;
  for (var r = 0; r < MF2048_SIZE; r++) {
    var line = work[r].slice();
    if (reverse) line.reverse();
    var res = mf2048SlideLine(line);
    var outLine = res.line;
    if (reverse) outLine = outLine.slice().reverse();
    work[r] = outLine;
    gained += res.gained;
    if (res.moved) moved = true;
  }

  if (transpose) work = _mf2048Transpose(work);
  return { board: work, gained: gained, moved: moved };
}

function mf2048EmptyCells(board) {
  var out = [];
  for (var r = 0; r < MF2048_SIZE; r++)
    for (var c = 0; c < MF2048_SIZE; c++)
      if (board[r][c] === 0) out.push({ r: r, c: c });
  return out;
}

// Boş bir kareye 2 (%90) ya da 4 (%10) yerleştirir. Tahtayı DEĞİŞTİRİR.
// rng: [0,1) döndüren fonksiyon (test için enjekte edilebilir; öntanımlı Math.random).
// Dönüş: yerleştirilen { r, c, value } veya boş yer yoksa null.
// rng iki kez okunur: önce kare seçimi, sonra değer (2/4). Testler bu sıraya güvenir.
function mf2048SpawnRandom(board, rng) {
  var rand = (typeof rng === 'function') ? rng : Math.random;
  var empties = mf2048EmptyCells(board);
  if (!empties.length) return null;
  var idx = Math.floor(rand() * empties.length);
  if (idx < 0) idx = 0;
  if (idx >= empties.length) idx = empties.length - 1;
  var cell = empties[idx];
  var value = rand() < 0.9 ? 2 : 4;
  board[cell.r][cell.c] = value;
  return { r: cell.r, c: cell.c, value: value };
}

// Hâlâ oynanabilir mi? (boş kare varsa VEYA komşu iki eşit kare varsa true)
function mf2048HasMoves(board) {
  for (var r = 0; r < MF2048_SIZE; r++) {
    for (var c = 0; c < MF2048_SIZE; c++) {
      if (board[r][c] === 0) return true;
      if (c + 1 < MF2048_SIZE && board[r][c] === board[r][c + 1]) return true;
      if (r + 1 < MF2048_SIZE && board[r][c] === board[r + 1][c]) return true;
    }
  }
  return false;
}

function mf2048MaxTile(board) {
  var m = 0;
  for (var r = 0; r < MF2048_SIZE; r++)
    for (var c = 0; c < MF2048_SIZE; c++)
      if (board[r][c] > m) m = board[r][c];
  return m;
}

function mf2048IsWin(board, target) {
  return mf2048MaxTile(board) >= (target || MF2048_TARGET);
}

// ─────────────────────────────────────────────────────────────────────────────
//  2) ARAYÜZ — overlay + render + klavye/dokunmatik  (tarayıcı tarafı)
// ─────────────────────────────────────────────────────────────────────────────

var _mf2048Built = false;
var _mf2048Board = null;
var _mf2048Score = 0;
var _mf2048Best = 0;
var _mf2048Over = false;      // kaybedildi (yeni oyuna kadar hamle kilitli)
var _mf2048Won = false;       // 2048'e ulaşıldı (bir kez "Kazandın!" göster)
var _mf2048KeepGoing = false; // "Devam et" seçildiyse artık kazanma göstergesi çıkmaz

var MF2048_BEST_KEY = 'mf2048.best';

function _mf2048LoadBest() {
  try {
    if (typeof localStorage === 'undefined') return 0;
    var v = parseInt(localStorage.getItem(MF2048_BEST_KEY), 10);
    return isNaN(v) ? 0 : v;
  } catch (e) { return 0; }
}

function _mf2048SaveBest() {
  try {
    if (typeof localStorage !== 'undefined') localStorage.setItem(MF2048_BEST_KEY, String(_mf2048Best));
  } catch (e) {}
}

function _mf2048TileClass(v) {
  var cls = 'mf2048-tile mf2048-v' + (v > MF2048_TARGET ? 'super' : v);
  var digits = String(v).length;
  if (digits === 3) cls += ' mf2048-d3';
  else if (digits >= 4) cls += ' mf2048-d4';
  return cls;
}

// ── Kendi <style>'ını bir kez enjekte et (scoped: .mf2048-*) ─────────────────
function _mf2048InjectCSS() {
  if (document.getElementById('mf2048-style')) return;
  var st = document.createElement('style');
  st.id = 'mf2048-style';
  st.textContent = [
    // Overlay (easter-egg ile aynı his)
    '.mf2048-overlay{position:fixed;inset:0;z-index:100000;display:flex;align-items:center;justify-content:center;',
      'background:rgba(4,8,16,0.62);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px);',
      'opacity:0;transition:opacity .22s ease;padding:24px;}',
    '.mf2048-overlay.open{opacity:1;}',
    '.mf2048-overlay[hidden]{display:none;}',
    '.mf2048-panel{position:relative;width:min(460px,100%);box-sizing:border-box;',
      'background:var(--bg-secondary,#0f1218);color:var(--text-primary,#c8d1dc);',
      'border:1px solid var(--border-light,#222b3a);border-radius:16px;',
      'box-shadow:0 24px 70px rgba(0,0,0,.55),0 2px 0 rgba(255,255,255,.03) inset;',
      'padding:22px 22px 18px;',
      'transform:translateY(14px) scale(.97);opacity:0;transition:transform .28s cubic-bezier(.2,.9,.3,1),opacity .28s ease;}',
    '.mf2048-overlay.open .mf2048-panel{transform:none;opacity:1;}',
    // Başlık satırı
    '.mf2048-head{display:flex;align-items:center;gap:12px;margin-bottom:14px;}',
    '.mf2048-title{font-size:1.5rem;font-weight:800;letter-spacing:.5px;color:var(--text-heading,#e2e8f0);margin:0;line-height:1;}',
    '.mf2048-sub{font-size:.66rem;letter-spacing:2px;text-transform:uppercase;color:var(--text-secondary,#7a8599);margin:3px 0 0;}',
    '.mf2048-scores{display:flex;gap:8px;margin-left:auto;}',
    '.mf2048-score{min-width:62px;text-align:center;padding:6px 12px;border-radius:9px;',
      'background:var(--bg-tertiary,#151a22);border:1px solid var(--border-light,#222b3a);}',
    '.mf2048-score span{display:block;font-size:.6rem;letter-spacing:1.5px;text-transform:uppercase;color:var(--text-muted,#4a5568);}',
    '.mf2048-score b{font-size:1.05rem;font-weight:700;color:var(--text-primary,#c8d1dc);}',
    // Tahta — klasik 2048 sıcak yüzeyi (tema-bağımsız, tanınırlık için)
    '.mf2048-board{position:relative;width:100%;aspect-ratio:1/1;background:#bbada0;border-radius:12px;padding:10px;box-sizing:border-box;touch-action:none;}',
    '.mf2048-cells,.mf2048-tiles{position:absolute;inset:10px;display:grid;grid-template-columns:repeat(4,1fr);grid-template-rows:repeat(4,1fr);gap:10px;}',
    '.mf2048-tiles{pointer-events:none;}',
    '.mf2048-cell{background:rgba(238,228,218,.35);border-radius:8px;}',
    '.mf2048-tile{display:flex;align-items:center;justify-content:center;border-radius:8px;',
      'font-weight:800;font-size:clamp(1.1rem,7vw,2.05rem);color:#776e65;background:#eee4da;',
      'transition:background .12s ease;}',
    '.mf2048-tile.mf2048-d3{font-size:clamp(.95rem,5.6vw,1.6rem);}',
    '.mf2048-tile.mf2048-d4{font-size:clamp(.8rem,4.4vw,1.3rem);}',
    // Klasik palet
    '.mf2048-v2{background:#eee4da;color:#776e65;}',
    '.mf2048-v4{background:#ede0c8;color:#776e65;}',
    '.mf2048-v8{background:#f2b179;color:#f9f6f2;}',
    '.mf2048-v16{background:#f59563;color:#f9f6f2;}',
    '.mf2048-v32{background:#f67c5f;color:#f9f6f2;}',
    '.mf2048-v64{background:#f65e3b;color:#f9f6f2;}',
    '.mf2048-v128{background:#edcf72;color:#f9f6f2;}',
    '.mf2048-v256{background:#edcc61;color:#f9f6f2;}',
    '.mf2048-v512{background:#edc850;color:#f9f6f2;}',
    '.mf2048-v1024{background:#edc53f;color:#f9f6f2;}',
    '.mf2048-v2048{background:#edc22e;color:#f9f6f2;box-shadow:0 0 22px rgba(237,194,46,.55);}',
    '.mf2048-vsuper{background:#3c3a32;color:#f9f6f2;}',
    // Yeni/birleşen kare "pop"
    '.mf2048-pop{animation:mf2048-pop .16s ease;}',
    '@keyframes mf2048-pop{0%{transform:scale(.6);}60%{transform:scale(1.08);}100%{transform:scale(1);}}',
    // Mesaj katmanı (kazan/kaybet)
    '.mf2048-msg{position:absolute;inset:0;border-radius:12px;display:flex;flex-direction:column;',
      'align-items:center;justify-content:center;gap:14px;text-align:center;',
      'background:rgba(238,228,218,.78);backdrop-filter:blur(1px);opacity:0;transition:opacity .2s ease;pointer-events:none;}',
    '.mf2048-msg.show{opacity:1;pointer-events:auto;}',
    '.mf2048-msg-text{font-size:1.6rem;font-weight:800;color:#5c5348;letter-spacing:.5px;}',
    '.mf2048-msg-btns{display:flex;gap:10px;flex-wrap:wrap;justify-content:center;}',
    // Alt satır: yeni oyun + ipucu
    '.mf2048-foot{display:flex;align-items:center;gap:12px;margin-top:14px;}',
    '.mf2048-hint{font-size:.72rem;color:var(--text-secondary,#7a8599);line-height:1.5;}',
    '.mf2048-hint kbd{font-family:inherit;font-size:.66rem;padding:1px 6px;border-radius:5px;',
      'background:var(--bg-tertiary,#151a22);border:1px solid var(--border-light,#222b3a);color:var(--text-primary,#c8d1dc);}',
    // Düğmeler
    '.mf2048-btn{cursor:pointer;padding:9px 16px;border-radius:9px;font-size:.82rem;font-weight:600;',
      'font-family:inherit;border:1px solid var(--border-light,#222b3a);',
      'background:var(--bg-tertiary,#151a22);color:var(--text-primary,#c8d1dc);',
      'transition:background .15s,border-color .15s,transform .1s;}',
    '.mf2048-btn:hover{background:var(--bg-hover,#1c2430);border-color:var(--border-hover,#2d3a4f);}',
    '.mf2048-btn:active{transform:translateY(1px);}',
    '.mf2048-btn.primary{background:#8f7a66;border-color:#8f7a66;color:#f9f6f2;}',
    '.mf2048-btn.primary:hover{background:#9c8676;border-color:#9c8676;}',
    '.mf2048-new{margin-left:auto;}',
    // Kapat düğmesi
    '.mf2048-close{position:absolute;top:12px;right:12px;width:30px;height:30px;border-radius:8px;cursor:pointer;',
      'display:flex;align-items:center;justify-content:center;background:transparent;border:1px solid transparent;',
      'color:var(--text-secondary,#7a8599);transition:background .15s,border-color .15s,color .15s;z-index:2;}',
    '.mf2048-close:hover{background:var(--bg-tertiary,#151a22);border-color:var(--border-light,#222b3a);color:var(--text-primary,#c8d1dc);}',
    '@media (prefers-reduced-motion: reduce){.mf2048-pop{animation:none;}',
      '.mf2048-overlay,.mf2048-panel,.mf2048-msg{transition:none;}}'
  ].join('\n');
  document.head.appendChild(st);
}

function _mf2048Build() {
  if (_mf2048Built) return;
  _mf2048InjectCSS();
  _mf2048Best = _mf2048LoadBest();

  var cells = '';
  for (var i = 0; i < MF2048_SIZE * MF2048_SIZE; i++) cells += '<div class="mf2048-cell"></div>';

  var ov = document.createElement('div');
  ov.className = 'mf2048-overlay';
  ov.id = 'mf2048';
  ov.setAttribute('hidden', '');
  ov.innerHTML =
    '<div class="mf2048-panel" role="dialog" aria-modal="true" aria-label="2048 oyunu" tabindex="-1">' +
      '<button class="mf2048-close" type="button" title="Kapat (Esc)" aria-label="Kapat" onclick="veGame2048Close()">' +
        '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>' +
      '</button>' +
      '<div class="mf2048-head">' +
        '<div><h3 class="mf2048-title">2048</h3><p class="mf2048-sub">MFSim · Mola</p></div>' +
        '<div class="mf2048-scores">' +
          '<div class="mf2048-score"><span>Skor</span><b id="mf2048-score">0</b></div>' +
          '<div class="mf2048-score"><span>En iyi</span><b id="mf2048-best">0</b></div>' +
        '</div>' +
      '</div>' +
      '<div class="mf2048-board">' +
        '<div class="mf2048-cells">' + cells + '</div>' +
        '<div class="mf2048-tiles" id="mf2048-tiles"></div>' +
        '<div class="mf2048-msg" id="mf2048-msg" aria-live="polite">' +
          '<div class="mf2048-msg-text" id="mf2048-msg-text"></div>' +
          '<div class="mf2048-msg-btns" id="mf2048-msg-btns"></div>' +
        '</div>' +
      '</div>' +
      '<div class="mf2048-foot">' +
        '<div class="mf2048-hint"><kbd>←</kbd><kbd>↑</kbd><kbd>→</kbd><kbd>↓</kbd> ya da <kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> · <kbd>Esc</kbd> kapat</div>' +
        '<button class="mf2048-btn primary mf2048-new" type="button" onclick="veGame2048New()">Yeni Oyun</button>' +
      '</div>' +
    '</div>';
  document.body.appendChild(ov);
  ov.addEventListener('mousedown', function(e) { if (e.target === ov) veGame2048Close(); });

  // Dokunmatik: tahtada kaydırma → yön
  var board = ov.querySelector('.mf2048-board');
  var sx = 0, sy = 0, tracking = false;
  board.addEventListener('touchstart', function(e) {
    if (!e.touches || !e.touches.length) return;
    sx = e.touches[0].clientX; sy = e.touches[0].clientY; tracking = true;
  }, { passive: true });
  board.addEventListener('touchmove', function(e) { if (tracking) e.preventDefault(); }, { passive: false });
  board.addEventListener('touchend', function(e) {
    if (!tracking) return;
    tracking = false;
    var t = (e.changedTouches && e.changedTouches[0]) || null;
    if (!t) return;
    var dx = t.clientX - sx, dy = t.clientY - sy;
    var ax = Math.abs(dx), ay = Math.abs(dy);
    if (Math.max(ax, ay) < 24) return; // küçük dokunuş → yok say
    var dir = (ax > ay) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
    _mf2048DoMove(dir);
  }, { passive: true });

  _mf2048Built = true;
}

// Tahtayı DOM'a çiz. prev verilirse değişen (yeni/birleşen) kareler "pop" yapar.
function _mf2048Render(prev) {
  var layer = document.getElementById('mf2048-tiles');
  if (!layer) return;
  var html = '';
  for (var r = 0; r < MF2048_SIZE; r++) {
    for (var c = 0; c < MF2048_SIZE; c++) {
      var v = _mf2048Board[r][c];
      if (!v) continue;
      var cls = _mf2048TileClass(v);
      if (prev && prev[r][c] !== v) cls += ' mf2048-pop'; // spawn ya da birleşme
      html += '<div class="' + cls + '" style="grid-row:' + (r + 1) + ';grid-column:' + (c + 1) + ';">' + v + '</div>';
    }
  }
  layer.innerHTML = html;

  var sEl = document.getElementById('mf2048-score');
  var bEl = document.getElementById('mf2048-best');
  if (sEl) sEl.textContent = _mf2048Score;
  if (bEl) bEl.textContent = _mf2048Best;
}

function _mf2048ShowMsg(kind) {
  var msg = document.getElementById('mf2048-msg');
  var txt = document.getElementById('mf2048-msg-text');
  var btns = document.getElementById('mf2048-msg-btns');
  if (!msg || !txt || !btns) return;
  if (kind === 'win') {
    txt.textContent = '🎉 2048! Kazandın';
    btns.innerHTML =
      '<button class="mf2048-btn primary" type="button" onclick="veGame2048KeepGoing()">Devam Et</button>' +
      '<button class="mf2048-btn" type="button" onclick="veGame2048New()">Yeni Oyun</button>';
  } else {
    txt.textContent = 'Oyun bitti';
    btns.innerHTML = '<button class="mf2048-btn primary" type="button" onclick="veGame2048New()">Yeni Oyun</button>';
  }
  msg.classList.add('show');
}

function _mf2048HideMsg() {
  var msg = document.getElementById('mf2048-msg');
  if (msg) msg.classList.remove('show');
}

// Bir yön hamlesi uygula: kaydır → skor → spawn → çiz → kazan/kaybet kontrolü.
function _mf2048DoMove(dir) {
  if (_mf2048Over || !_mf2048Board) return;
  var prev = _mf2048Board;
  var res = mf2048Move(prev, dir);
  if (!res.moved) return; // geçersiz hamle → hiçbir şey olmaz

  _mf2048Board = res.board;
  _mf2048Score += res.gained;
  if (_mf2048Score > _mf2048Best) { _mf2048Best = _mf2048Score; _mf2048SaveBest(); }

  mf2048SpawnRandom(_mf2048Board);
  _mf2048Render(prev);

  if (!_mf2048Won && !_mf2048KeepGoing && mf2048IsWin(_mf2048Board)) {
    _mf2048Won = true;
    _mf2048ShowMsg('win');
    return;
  }
  if (!mf2048HasMoves(_mf2048Board)) {
    _mf2048Over = true;
    _mf2048ShowMsg('lose');
  }
}

// ── Genel (menü/onclick + global) ────────────────────────────────────────────
function veGame2048New() {
  if (!_mf2048Built) _mf2048Build();
  _mf2048Board = mf2048NewBoard();
  mf2048SpawnRandom(_mf2048Board);
  mf2048SpawnRandom(_mf2048Board);
  _mf2048Score = 0;
  _mf2048Over = false;
  _mf2048Won = false;
  _mf2048KeepGoing = false;
  _mf2048HideMsg();
  _mf2048Render(null);
}

function veGame2048KeepGoing() {
  _mf2048KeepGoing = true;
  _mf2048HideMsg();
}

function veGame2048Open() {
  if (typeof veCloseFileMenu === 'function') { try { veCloseFileMenu(); } catch (e) {} }
  _mf2048Build();
  if (!_mf2048Board) veGame2048New();
  var ov = document.getElementById('mf2048');
  if (!ov) return;
  ov.removeAttribute('hidden');
  void ov.offsetWidth; // reflow → geçiş tetiklensin
  ov.classList.add('open');
  var panel = ov.querySelector('.mf2048-panel');
  if (panel && typeof panel.focus === 'function') { try { panel.focus(); } catch (e) {} }
}

function veGame2048Close() {
  var ov = document.getElementById('mf2048');
  if (!ov || !ov.classList.contains('open')) return;
  ov.classList.remove('open');
  setTimeout(function() { if (ov && !ov.classList.contains('open')) ov.setAttribute('hidden', ''); }, 240);
}

function veGame2048Toggle() {
  var ov = document.getElementById('mf2048');
  if (ov && ov.classList.contains('open')) veGame2048Close();
  else veGame2048Open();
}

// Yön tuşu eşlemesi (ok tuşları + WASD).
function _mf2048KeyDir(key) {
  switch (key) {
    case 'ArrowLeft': case 'a': case 'A': return 'left';
    case 'ArrowRight': case 'd': case 'D': return 'right';
    case 'ArrowUp': case 'w': case 'W': return 'up';
    case 'ArrowDown': case 's': case 'S': return 'down';
  }
  return null;
}

// ── Dinleyici: yalnız overlay açıkken tuşları yakala (uygulamaya sızmaz) ──────
if (typeof document !== 'undefined' && typeof document.addEventListener === 'function') {
  document.addEventListener('keydown', function(e) {
    var ov = document.getElementById('mf2048');
    if (!ov || !ov.classList.contains('open')) return; // kapalıyken tamamen pasif
    if (e.key === 'Escape') { e.preventDefault(); veGame2048Close(); return; }
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    var dir = _mf2048KeyDir(e.key);
    if (dir) { e.preventDefault(); _mf2048DoMove(dir); }
  });
}

// Test (Node/Jest) için saf motoru dışa aç — tarayıcıda üst-seviye global'ler zaten erişilebilir.
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    MF2048_SIZE: MF2048_SIZE,
    MF2048_TARGET: MF2048_TARGET,
    mf2048NewBoard: mf2048NewBoard,
    mf2048SlideLine: mf2048SlideLine,
    mf2048Move: mf2048Move,
    mf2048EmptyCells: mf2048EmptyCells,
    mf2048SpawnRandom: mf2048SpawnRandom,
    mf2048HasMoves: mf2048HasMoves,
    mf2048MaxTile: mf2048MaxTile,
    mf2048IsWin: mf2048IsWin
  };
}
