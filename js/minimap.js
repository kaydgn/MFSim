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
var _mmCollapsed = false;      // KULLANICININ seçimi (düğme · şerit · komut paleti) — kalıcı
var _mmOto = false;            // açık kutu içeriğe değiyor → köşedeki düğmesine indi
var _mmZorla = false;          // oto inmişken kullanıcı açtı → köşe boşalana dek açık kalır

// ── ÖRTMEZ: açık kutu içeriğe değiyorsa minimap köşedeki düğmesine iner ─────
// Soluk durmak (opacity) yetmiyordu: soluk kutu tıklamayı yine yutuyor.
// 1366×657'lik pencerede kutu FEAD kartının çubuğundaki düğmeleri, AP'de
// lastik kartının adını örtüyordu; kasnak paneli açılınca tuval daralıyor ve
// kamera yerinde kalıyor.
//
// Oto iniş kalıcı DEĞİL ve kullanıcının tercihini YAZMAZ; köşe boşalınca kutu
// kendiliğinden açılır. Oto inmişken düğmeye basmak bir istektir: kutu o köşe
// boşalana kadar açık kalır. Ölçü AÇIK hâlin kutusuyla alınır, o anki kutuyla
// değil — yoksa inen kutu artık değmez, açılır, yine değer: titrer.
var VE_MINIMAP_PAY = 6;        // içeriğe bu kadar yaklaşan kutu da değmiş sayılır (px)

// SAF: iki dikdörtgen ({l,t,r,b}) alanı olan bir parçada kesişiyor mu?
function _mmKesisir(a, b) {
  return Math.min(a.r, b.r) - Math.max(a.l, b.l) > 0 &&
         Math.min(a.b, b.b) - Math.max(a.t, b.t) > 0;
}

// SAF: kutu parçalardan birine değiyor mu? `ic` taşıyan parça bir HALKADIR
// (çerçeve notu): kutu çerçevenin boş içine düşebilir, kenarına düşemez.
function veMinimapOrtuyor(kutu, parcalar) {
  if(!kutu || !parcalar) return false;
  for(var i = 0; i < parcalar.length; i++) {
    var p = parcalar[i];
    if(!_mmKesisir(kutu, p)) continue;
    if(p.ic && kutu.l >= p.ic.l && kutu.r <= p.ic.r && kutu.t >= p.ic.t && kutu.b <= p.ic.b) continue;
    return true;
  }
  return false;
}

// SAF: içeriğin GÖRÜNÜM (#ve-canvas-wrapper) koordinatındaki parçaları.
//   dugumler — nodes; notlar — annotations; kamera — {zoom, x, y} (canvasOffset)
//   olcAd    — node → {w,h} (tarayıcıda veMeasureNodeLabel); yoksa ad sayılmaz
//   olcNot   — not → {w,h} (yazı notu genişliği metinden gelir); yoksa kayıttaki ölçü
// Düğüm: kutu + adın taşan kısmı, sınır çerçevesiyle AYNI kuraldan
// (veNodeLabelOverflow). Kutusuz düğüm (FEAD kasnağı) yok sayılır: kanvasta
// çizilen bir şeyi yok. Yazı notu kutudur; çerçeve notu halkadır (ad üstte
// -9 px, tutamaklar köşelerde -5 px dışarı taşar).
function veMinimapIcerikParcalari(dugumler, notlar, kamera, olcAd, olcNot) {
  var z = (kamera && kamera.zoom > 0) ? kamera.zoom : 1;
  var ox = (kamera && isFinite(kamera.x)) ? kamera.x : 0;
  var oy = (kamera && isFinite(kamera.y)) ? kamera.y : 0;
  var P = VE_MINIMAP_PAY;
  function ekran(l, t, r, b, pay) {
    return { l: (l - CANVAS_OFFSET_MM) * z + ox - pay, t: (t - CANVAS_OFFSET_MM) * z + oy - pay,
             r: (r - CANVAS_OFFSET_MM) * z + ox + pay, b: (b - CANVAS_OFFSET_MM) * z + oy + pay };
  }
  var out = [];
  (dugumler || []).forEach(function(n) {
    if(!n || !isFinite(n.x) || !isFinite(n.y)) return;
    if(typeof veIsCanvasHidden === 'function' && veIsCanvasHidden(n)) return;
    var ds = (typeof veNodeDefaultSize === 'function') ? veNodeDefaultSize(n.type) : { w: 65, h: 60 };
    var w = isFinite(n.width) ? n.width : ds.w;
    var h = isFinite(n.height) ? n.height : ds.h;
    var of = { left: 0, right: 0, top: 0, bottom: 0 };
    if(typeof olcAd === 'function' && typeof veNodeLabelOverflow === 'function' &&
       !((typeof veIsModuleNode === 'function') && veIsModuleNode(n))) {
      of = veNodeLabelOverflow((n.data && n.data.labelPos) || 'bottom', w, h, olcAd(n));
    }
    out.push(ekran(n.x - of.left, n.y - of.top, n.x + w + of.right, n.y + h + of.bottom, P));
  });
  (notlar || []).forEach(function(a) {
    if(!a || !isFinite(a.x) || !isFinite(a.y)) return;
    var o = (typeof olcNot === 'function') ? olcNot(a) : null;
    var w = (o && o.w > 0) ? o.w : (a.width || 0), h = (o && o.h > 0) ? o.h : (a.height || 0);
    if(a.type === 'frame') {
      var halka = ekran(a.x - 6, a.y - 10, a.x + w + 6, a.y + h + 6, P);
      halka.ic = ekran(a.x + 8, a.y + 8, a.x + w - 8, a.y + h - 8, -P);
      out.push(halka);
    } else {
      out.push(ekran(a.x, a.y, a.x + w, a.y + h, P));
    }
  });
  return out;
}

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
    if(typeof veIsCanvasHidden === 'function' && veIsCanvasHidden(n)) continue;
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

  // Örtüyor mu? Ölçüden ÖNCE: inmiş kutunun tuvali display:none, aşağıdaki
  // boyut kapısı onu hiç buraya bırakmazdı ve kutu bir daha açılamazdı.
  _mmOtoDenetle(el);

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

// Düğme GÖRÜNENİ çevirir: inmiş kutuyu açar, açık kutuyu indirir. Oto inmiş
// kutuyu açmak tercihi değiştirmez (zaten açık), yalnız köşe boşalana kadar
// oto inişi geri çeker.
function veMinimapToggle() {
  var el = document.getElementById('ve-minimap');
  if(!el) return;
  if(el.classList.contains('collapsed')) { _mmCollapsed = false; _mmZorla = _mmOto; }
  else { _mmCollapsed = true; _mmZorla = false; }
  try { localStorage.setItem('veMinimapCollapsed', _mmCollapsed ? '1' : '0'); } catch(e){}
  _mmSinifEsitle(el);
}

// Açık hâlin kutusu, görünüm (#ve-canvas-wrapper) koordinatında. Sağ-alt köşe
// iki hâlde de aynı yere çapalı; genişlik/yükseklik CSS jetonundan
// (--mm-w/--mm-h) okunur, çünkü inmiş kutunun kendi ölçüsü 34 px.
function _mmAcikKutu(el) {
  if(!el || el.offsetParent === null) return null;
  var r = el.offsetLeft + el.offsetWidth, b = el.offsetTop + el.offsetHeight;
  var cs = getComputedStyle(el);
  var w = parseFloat(cs.getPropertyValue('--mm-w')) || 196;
  var h = parseFloat(cs.getPropertyValue('--mm-h')) || 134;
  return { l: r - w, t: b - h, r: r, b: b };
}

function _mmOtoDenetle(el) {
  if(_mmDragging) return;                  // haritayı sürüklerken kutu elden kaçmasın
  var kutu = _mmAcikKutu(el);
  if(!kutu) return;
  var notEl = function(a) { var d = document.getElementById(a.id); return d ? { w: d.offsetWidth, h: d.offsetHeight } : null; };
  var parcalar = veMinimapIcerikParcalari(
    (typeof nodes !== 'undefined') ? nodes : [],
    (typeof annotations !== 'undefined') ? annotations : [],
    { zoom: (typeof canvasZoom !== 'undefined') ? canvasZoom : 1,
      x: (typeof canvasOffset !== 'undefined') ? canvasOffset.x : 0,
      y: (typeof canvasOffset !== 'undefined') ? canvasOffset.y : 0 },
    (typeof veMeasureNodeLabel === 'function') ? veMeasureNodeLabel : null, notEl);
  _mmOto = veMinimapOrtuyor(kutu, parcalar);
  if(!_mmOto) _mmZorla = false;            // köşe boşaldı: istek yerine getirildi
  _mmSinifEsitle(el);
}

function _mmSinifEsitle(el) {
  var kapali = _mmCollapsed || (_mmOto && !_mmZorla);
  var degisti = el.classList.contains('collapsed') !== kapali;
  el.classList.toggle('collapsed', kapali);
  el.classList.toggle('oto', kapali && !_mmCollapsed);
  _mmSyncToggleIcon();
  if(degisti && !kapali) veMinimapUpdate(); // açılan kutu çizilsin
}

function _mmSyncToggleIcon() {
  var btn = document.getElementById('ve-minimap-toggle');
  var el = document.getElementById('ve-minimap');
  if(!btn || !el) return;
  var collapsed = el.classList.contains('collapsed');
  btn.title = !collapsed ? 'Genel görünümü gizle'
    : el.classList.contains('oto') ? 'Genel görünümü göster — altındaki içeriği örtmesin diye küçüldü'
    : 'Genel görünümü göster';
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
  try { _mmCollapsed = localStorage.getItem('veMinimapCollapsed') === '1'; } catch(e){}
  _mmSinifEsitle(el);

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
  document.addEventListener('mouseup', function() {
    if(!_mmDragging) return;
    _mmDragging = false;
    veMinimapUpdate();                     // sürükleme boyunca bekleyen örtüşme denetimi
  });

  if(typeof window !== 'undefined') {
    window.addEventListener('resize', function(){ veMinimapUpdate(); });
  }
  // Tuval pencere boyu değişmeden de daralır: müfettiş sütunu açılınca kamera
  // yerinde kalır, kutu içeriğin üstüne kayar. Pencerenin resize olayı bunu
  // hiç görmüyordu.
  var wrapper = document.getElementById('ve-canvas-wrapper');
  if(wrapper && typeof ResizeObserver === 'function') {
    new ResizeObserver(function(){ veMinimapUpdate(); }).observe(wrapper);
  }

  veMinimapUpdate();
}

// Loader, tüm modüller yüklendikten sonra DOMContentLoaded handler'larını flush
// eder — bu yüzden buraya kaydolmak güvenli (o an DOM hazır).
if(typeof document !== 'undefined' && typeof document.addEventListener === 'function') {
  document.addEventListener('DOMContentLoaded', veMinimapInit);
}

if(typeof module !== 'undefined' && module.exports) {
  module.exports = { veMinimapUpdate: veMinimapUpdate, veMinimapToggle: veMinimapToggle,
    veMinimapOrtuyor: veMinimapOrtuyor, veMinimapIcerikParcalari: veMinimapIcerikParcalari };
}
