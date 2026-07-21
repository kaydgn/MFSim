// ═══════════════════════════════════════════════════════════════════════════
// MFSim Minimap — Topoloji genel görünümü (n8n / Figma tarzı)
// ───────────────────────────────────────────────────────────────────────────
// Kanvasın sağ-alt köşesinde küçük bir genel görünüm çizer: tüm bileşenler
// nokta olarak, bağlantılar ince çizgi olarak ve mevcut görünür alan (viewport)
// bir dikdörtgen olarak gösterilir. Minimap'e tıklayıp sürükleyerek ana görünüm
// kaydırılır (pan). Kamera koordinat sistemi ui-core.js ile aynıdır:
//     ekran(cx) = (cx - 3000) * zoom + offset      (CANVAS_OFFSET = 3000)
//
// Bu modül DOM'a/globallere DOKUNMAZ; yalnızca kamerayı (canvasOffset/canvasZoom)
// okur/yazar ve #ve-minimap içine çizim yapar. veMinimapUpdate() güvenlidir:
// minimap gizli / node yok / sayfa pasifse sessizce çıkar. Çağrı noktaları
// (updateCanvasTransform, updateNodeCount, node sürükleme) rAF ile tek kareye
// birleştirilir.
// ═══════════════════════════════════════════════════════════════════════════

var CANVAS_OFFSET_MM = 3000;   // #ve-canvas top/left:-3000, transform-origin center
var _mmDirty = false;
var _mmRafPending = false;
var _mmMap = null;             // son çizim eşlemesi (etkileşim için): {minX,minY,s,ox,oy}
var _mmDragging = false;
var _mmCollapsed = false;

// prefers-reduced-motion — geçişleri kısmak için CSS hallediyor; JS'te iş yok.

// Dış API: bir şeyler değişti, minimap'i tazele (rAF ile birleştirilir).
function veMinimapUpdate() {
  _mmDirty = true;
  if(_mmRafPending) return;
  _mmRafPending = true;
  var raf = (typeof requestAnimationFrame === 'function')
    ? requestAnimationFrame
    : function(cb){ return setTimeout(cb, 16); };
  raf(function() {
    _mmRafPending = false;
    if(_mmDirty) { _mmDirty = false; _mmRender(); }
  });
}

// Bileşen bbox'u (canvas-local) — width/height dahil.
function _mmContentBBox() {
  if(typeof nodes === 'undefined' || !nodes || nodes.length === 0) return null;
  var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for(var i = 0; i < nodes.length; i++) {
    var n = nodes[i];
    var w = n.width || 65, h = n.height || 60;
    if(n.x < minX) minX = n.x;
    if(n.y < minY) minY = n.y;
    if(n.x + w > maxX) maxX = n.x + w;
    if(n.y + h > maxY) maxY = n.y + h;
  }
  if(!isFinite(minX)) return null;
  return { minX: minX, minY: minY, maxX: maxX, maxY: maxY };
}

// Görünür alanın canvas-local dikdörtgeni (kameradan türetilir).
function _mmViewportRect(W, H) {
  var zoom = (typeof canvasZoom !== 'undefined') ? canvasZoom : 1;
  var ox = (typeof canvasOffset !== 'undefined') ? canvasOffset.x : 0;
  var oy = (typeof canvasOffset !== 'undefined') ? canvasOffset.y : 0;
  if(!(zoom > 0)) zoom = 1;
  // ekran=0..W  ⇒  cx = 3000 + (ekran - offset)/zoom
  var vMinX = CANVAS_OFFSET_MM - ox / zoom;
  var vMinY = CANVAS_OFFSET_MM - oy / zoom;
  return { minX: vMinX, minY: vMinY, w: W / zoom, h: H / zoom };
}

function _mmCssVar(name, fallback) {
  try {
    var v = getComputedStyle(document.documentElement).getPropertyValue(name);
    v = v && v.trim();
    return v || fallback;
  } catch(e) { return fallback; }
}

function _mmRender() {
  var el = document.getElementById('ve-minimap');
  if(!el) return;
  var canvas = document.getElementById('ve-minimap-canvas');
  var vpEl = document.getElementById('ve-minimap-viewport');
  if(!canvas || !vpEl) return;

  // Görünürlük ÖNCE bbox'a göre belirlenir (yoksa gizle, varsa göster). Ölçüm
  // bundan SONRA yapılır — aksi halde gizli (display:none, boyut 0) minimap
  // kendini asla açamaz (tavuk-yumurta).
  var bbox = _mmContentBBox();
  if(!bbox) { el.classList.add('ve-minimap-hidden'); return; }
  el.classList.remove('ve-minimap-hidden');

  // Sayfa pasifse (ata display:none → boyut 0 / offsetParent yok) çizme; sekme
  // aktifleşince bir sonraki güncelleme çizer.
  var innerW = canvas.clientWidth, innerH = canvas.clientHeight;
  if(innerW < 10 || innerH < 10 || el.offsetParent === null) return;

  // Collapsed durumunda çizim yapma (kutu küçük, sadece aç düğmesi görünür).
  if(el.classList.contains('collapsed')) return;

  var wrapper = document.getElementById('ve-canvas-wrapper');
  var W = wrapper ? wrapper.clientWidth : innerW;
  var H = wrapper ? wrapper.clientHeight : innerH;
  var vp = _mmViewportRect(W, H);

  // Bölge = içerik bbox ∪ viewport, sonra oransal boşluk. Böylece içerik sabit
  // kalır (yönelim korunur), uzaklaşınca/uzağa kayınca viewport da çerçeveye
  // girer (nereye gittiğini görürsün).
  var rMinX = Math.min(bbox.minX, vp.minX);
  var rMinY = Math.min(bbox.minY, vp.minY);
  var rMaxX = Math.max(bbox.maxX, vp.minX + vp.w);
  var rMaxY = Math.max(bbox.maxY, vp.minY + vp.h);
  var rW = Math.max(1, rMaxX - rMinX);
  var rH = Math.max(1, rMaxY - rMinY);
  var pad = Math.max(30, Math.max(rW, rH) * 0.08);
  rMinX -= pad; rMinY -= pad; rW += pad * 2; rH += pad * 2;

  var s = Math.min(innerW / rW, innerH / rH);
  if(!(s > 0) || !isFinite(s)) return;
  var drawW = rW * s, drawH = rH * s;
  var ox = (innerW - drawW) / 2, oy = (innerH - drawH) / 2;
  _mmMap = { minX: rMinX, minY: rMinY, s: s, ox: ox, oy: oy };

  function mapX(cx){ return ox + (cx - rMinX) * s; }
  function mapY(cy){ return oy + (cy - rMinY) * s; }

  // ── Canvas hazırlık (retina) ──
  var dpr = (typeof window !== 'undefined' && window.devicePixelRatio) ? window.devicePixelRatio : 1;
  if(canvas.width !== Math.round(innerW * dpr) || canvas.height !== Math.round(innerH * dpr)) {
    canvas.width = Math.round(innerW * dpr);
    canvas.height = Math.round(innerH * dpr);
  }
  var ctx = canvas.getContext('2d');
  if(!ctx) return;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, innerW, innerH);

  var accent = _mmCssVar('--accent-primary', '#3b82f6');
  var muted = _mmCssVar('--text-muted', '#94a3b8');
  var border = _mmCssVar('--border-color', '#cbd5e1');

  // ── Bağlantılar (ince çizgi, node merkezleri arası) ──
  if(typeof connections !== 'undefined' && connections && connections.length) {
    var byId = {};
    for(var k = 0; k < nodes.length; k++) byId[nodes[k].id] = nodes[k];
    ctx.strokeStyle = border;
    ctx.globalAlpha = 0.55;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for(var c = 0; c < connections.length; c++) {
      var a = byId[connections[c].from], b = byId[connections[c].to];
      if(!a || !b) continue;
      var ax = mapX(a.x + (a.width || 65) / 2), ay = mapY(a.y + (a.height || 60) / 2);
      var bx = mapX(b.x + (b.width || 65) / 2), by = mapY(b.y + (b.height || 60) / 2);
      ctx.moveTo(ax, ay); ctx.lineTo(bx, by);
    }
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  // ── Node'lar (küçük yuvarlatılmış dikdörtgen) ──
  for(var j = 0; j < nodes.length; j++) {
    var nd = nodes[j];
    var nx = mapX(nd.x), ny = mapY(nd.y);
    var nw = Math.max(2.5, (nd.width || 65) * s), nh = Math.max(2.5, (nd.height || 60) * s);
    var def = nd.def || {};
    var isAux = def.isSensor || def.isTerminator;
    ctx.fillStyle = isAux ? muted : accent;
    ctx.globalAlpha = isAux ? 0.7 : 0.92;
    _mmRoundRect(ctx, nx, ny, nw, nh, Math.min(2, nw / 3));
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // ── Viewport dikdörtgeni (DOM overlay) ──
  var vx = mapX(vp.minX), vy = mapY(vp.minY);
  var vw = vp.w * s, vh = vp.h * s;
  // minimap kutusuna kırp
  var x0 = Math.max(0, vx), y0 = Math.max(0, vy);
  var x1 = Math.min(innerW, vx + vw), y1 = Math.min(innerH, vy + vh);
  vpEl.style.left = x0 + 'px';
  vpEl.style.top = y0 + 'px';
  vpEl.style.width = Math.max(0, x1 - x0) + 'px';
  vpEl.style.height = Math.max(0, y1 - y0) + 'px';
}

function _mmRoundRect(ctx, x, y, w, h, r) {
  if(r < 0.5 || w < 2 || h < 2) { ctx.beginPath(); ctx.rect(x, y, w, h); return; }
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// ── Etkileşim: minimap'te bir noktaya tıkla/sürükle → ana görünümü oraya ortala ──
function _mmPanToEvent(e) {
  if(!_mmMap) return;
  var canvas = document.getElementById('ve-minimap-canvas');
  if(!canvas) return;
  var rect = canvas.getBoundingClientRect();
  var mx = e.clientX - rect.left, my = e.clientY - rect.top;
  // minimap px → canvas-local
  var cx = _mmMap.minX + (mx - _mmMap.ox) / _mmMap.s;
  var cy = _mmMap.minY + (my - _mmMap.oy) / _mmMap.s;
  var wrapper = document.getElementById('ve-canvas-wrapper');
  if(!wrapper || typeof canvasOffset === 'undefined') return;
  var W = wrapper.clientWidth, H = wrapper.clientHeight;
  var zoom = (typeof canvasZoom !== 'undefined') ? canvasZoom : 1;
  // (cx,cy) ekran merkezine gelsin
  canvasOffset.x = W / 2 - (cx - CANVAS_OFFSET_MM) * zoom;
  canvasOffset.y = H / 2 - (cy - CANVAS_OFFSET_MM) * zoom;
  if(typeof updateCanvasTransform === 'function') updateCanvasTransform();
}

function veMinimapToggle() {
  var el = document.getElementById('ve-minimap');
  if(!el) return;
  _mmCollapsed = !el.classList.contains('collapsed');
  el.classList.toggle('collapsed', _mmCollapsed);
  _mmSyncToggleIcon();
  try { localStorage.setItem('veMinimapCollapsed', _mmCollapsed ? '1' : '0'); } catch(e){}
  if(!_mmCollapsed) veMinimapUpdate();
}

function _mmSyncToggleIcon() {
  var btn = document.getElementById('ve-minimap-toggle');
  var el = document.getElementById('ve-minimap');
  if(!btn || !el) return;
  var collapsed = el.classList.contains('collapsed');
  btn.title = collapsed ? 'Genel görünümü göster' : 'Genel görünümü gizle';
  btn.setAttribute('aria-label', btn.title);
  // collapsed → harita ikonu (aç), açık → köşeye küçült ikonu
  btn.innerHTML = collapsed
    ? '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/><line x1="8" y1="2" x2="8" y2="18"/><line x1="16" y1="6" x2="16" y2="22"/></svg>'
    : '<svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg>';
}

function veMinimapInit() {
  var el = document.getElementById('ve-minimap');
  if(!el) return;
  var canvas = document.getElementById('ve-minimap-canvas');
  var toggle = document.getElementById('ve-minimap-toggle');

  // Kullanıcı tercihini geri yükle
  try { if(localStorage.getItem('veMinimapCollapsed') === '1') el.classList.add('collapsed'); } catch(e){}
  _mmSyncToggleIcon();

  if(toggle) {
    toggle.addEventListener('click', function(e){ e.stopPropagation(); veMinimapToggle(); });
    toggle.addEventListener('mousedown', function(e){ e.stopPropagation(); });
  }

  if(canvas) {
    canvas.addEventListener('mousedown', function(e) {
      if(e.button !== 0) return;
      e.preventDefault(); e.stopPropagation();
      _mmDragging = true;
      _mmPanToEvent(e);
    });
    // wheel'i ana kanvasa geçirme (minimap üstünde kazara zoom olmasın)
    canvas.addEventListener('wheel', function(e){ e.preventDefault(); e.stopPropagation(); }, { passive: false });
  }

  document.addEventListener('mousemove', function(e) {
    if(!_mmDragging) return;
    _mmPanToEvent(e);
  });
  document.addEventListener('mouseup', function() { _mmDragging = false; });

  if(typeof window !== 'undefined') {
    window.addEventListener('resize', function(){ veMinimapUpdate(); });
  }

  veMinimapUpdate();
}

// Loader, tüm modüller yüklendikten sonra DOMContentLoaded handler'larını flush
// eder — bu yüzden buraya kaydolmak güvenli (o an DOM hazır).
if(typeof document !== 'undefined' && typeof document.addEventListener === 'function') {
  document.addEventListener('DOMContentLoaded', veMinimapInit);
}

if(typeof module !== 'undefined' && module.exports) {
  module.exports = { veMinimapUpdate: veMinimapUpdate, veMinimapToggle: veMinimapToggle };
}
