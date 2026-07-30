// ═══════════════════════════════════════════════════════════════════════════
// PANEL GRAFİĞİ ETKİLEŞİM KATMANI (paylaşılan)
// ═══════════════════════════════════════════════════════════════════════════
//
// Bileşen panellerindeki <canvas> grafiklerine ortak etkileşim kazandırır:
//   • Ctrl/⌘ + tekerlek ile yakınlaştırma      • sağ tık + sürükle ile kaydırma
//   • imleç çizgileri (crosshair) + tooltip    • sol tık ile sıfırlama
//
// TASARIM
// ───────
// Durum CANVAS BAŞINA tutulur (canvas._pcCtx). Aynı sayfada birden çok grafik
// aynı dinleyicileri paylaşır ama zoom/pan durumları birbirine karışmaz.
//
// Eksen-bağımsızdır: RPM/tork değil x/y konuşur. Her grafik kendi taban
// aralığını, ölçek dönüşümlerini ve tooltip içeriğini verir.
//
// Neden Ctrl/⌘ şart: bu grafikler KAYDIRILABİLİR panellerin içinde duruyor ve
// çoğu zaman yalnızca bir kısmı görünüyor. Düz tekerleği yakalamak,
// kullanıcının grafiğin geri kalanını görmek için yaptığı en doğal hareketi
// sessizce zoom'a çevirir. Tam ekran modallarda (arkada kaydırılacak içerik
// yok) çağıran zoomModifier:false verebilir.
//
// EV KONVANSİYONLARIYLA UYUM
// ──────────────────────────
//   • Boyutlandırma: veFitCanvas(canvas, cssHeight)  → js/graphics.js
//   • Yeniden çizim: canvas._veRedraw                → ResizeObserver bunu çağırır
// Bu katman da yeniden çizim için _veRedraw'ı kullanır; ayrı bir kanal açmaz.
//
// KULLANIM
// ────────
//   var fit = veFitCanvas(canvas, 200); if(!fit) return;
//   canvas._veRedraw = function(){ drawMyChart(nodeId); };
//   var win = pcZoomWindow({minX:0,maxX:1,minY:0,maxY:100}, pcZoomState(canvas));
//   ... win.minX/maxX/minY/maxY ile çiz ...
//   pcAttach(canvas, {
//     uid:'my-chart-'+nodeId, ml:45, mr:45, mt:20, mb:30, pw:pw, ph:ph,
//     minX:win.minX, maxX:win.maxX, minY:win.minY, maxY:win.maxY,
//     xFromPx:xFromPx, yFromPx:yFromPx,
//     tooltipHTML: function(x, y, ctx){ return '<b>'+x.toFixed(2)+'</b>'; }
//   });
//   pcDrawHint(ctx2d, canvas, ml, mt, pw, isDark);
// ═══════════════════════════════════════════════════════════════════════════

// Zoom sınırları — tüm panel grafikleri aynı hissi paylaşsın.
var PC_ZOOM_MIN = 0.3;
var PC_ZOOM_MAX = 12.0;
var PC_ZOOM_STEP_IN = 1.18;
var PC_ZOOM_STEP_OUT = 0.85;

// ── Saf çekirdek ──────────────────────────────────────────────────────────

// Görünür pencereyi taban aralık + zoom durumundan hesaplar. SAF fonksiyon.
// Yakınlaştırmada taban sınırların dışına taşmayı kırpar; uzaklaştırmada
// kırpmaz (verinin nereye gittiğini görmek meşru). Kırpma sonrası merkezi
// günceller ki sonraki pan kaldığı yerden devam etsin.
function pcZoomWindow(base, zoom) {
  var zs = zoom.scale || 1.0;
  var xRange = (base.maxX - base.minX) / zs;
  var yRange = (base.maxY - base.minY) / zs;

  if(zoom.centerX === null || zoom.centerX === undefined) zoom.centerX = (base.minX + base.maxX) / 2;
  if(zoom.centerY === null || zoom.centerY === undefined) zoom.centerY = (base.minY + base.maxY) / 2;

  var minX = zoom.centerX - xRange / 2, maxX = zoom.centerX + xRange / 2;
  var minY = zoom.centerY - yRange / 2, maxY = zoom.centerY + yRange / 2;

  if(zs >= 1.0) {
    if(minX < base.minX) { minX = base.minX; maxX = base.minX + xRange; }
    if(maxX > base.maxX) { maxX = base.maxX; minX = base.maxX - xRange; }
    if(minY < base.minY) { minY = base.minY; maxY = base.minY + yRange; }
    if(maxY > base.maxY) { maxY = base.maxY; minY = base.maxY - yRange; }
  }

  zoom.centerX = (minX + maxX) / 2;
  zoom.centerY = (minY + maxY) / 2;
  return { minX: minX, maxX: maxX, minY: minY, maxY: maxY };
}

// {x,y} nokta dizisinde verilen x için lineer ara değer. Aralık dışında veya
// veri yetersizse null döner (tooltip o seriyi hiç göstermez — uydurma değer
// üretmekten iyidir). SAF fonksiyon.
function vePcInterpY(points, x) {
  if(!points || points.length === 0) return null;
  if(points.length === 1) return (points[0].x === x) ? points[0].y : null;
  for(var i = 0; i < points.length - 1; i++) {
    var a = points[i], b = points[i + 1];
    if(a.x <= x && x <= b.x) {
      if(b.x === a.x) return a.y;
      return a.y + (x - a.x) / (b.x - a.x) * (b.y - a.y);
    }
  }
  return null;
}

// Fare olayını CANVAS px uzayına çevirir. Canvas'ın backing store'u CSS
// boyutundan farklı olabildiği için ham offsetX/Y hit-test'i kaydırır.
function pcPointerPos(e, canvas, ctx) {
  var rect = canvas.getBoundingClientRect();
  var sx = rect.width > 0 ? (ctx.ml + ctx.pw + ctx.mr) / rect.width : 1;
  var sy = rect.height > 0 ? (ctx.mt + ctx.ph + ctx.mb) / rect.height : 1;
  return { mx: (e.clientX - rect.left) * sx, my: (e.clientY - rect.top) * sy, rect: rect, sx: sx, sy: sy };
}

function pcInPlot(pos, ctx) {
  return pos.mx >= ctx.ml && pos.mx <= ctx.ml + ctx.pw &&
         pos.my >= ctx.mt && pos.my <= ctx.mt + ctx.ph;
}

// ── Canvas başına durum ───────────────────────────────────────────────────

function pcZoomState(canvas) {
  if(!canvas._pcZoom) canvas._pcZoom = { scale: 1.0, centerX: null, centerY: null };
  return canvas._pcZoom;
}

function pcPanState(canvas) {
  if(!canvas._pcPan) canvas._pcPan = { active: false, startX: 0, startY: 0, startCenterX: 0, startCenterY: 0, _raf: null };
  return canvas._pcPan;
}

function pcIsZoomed(canvas) {
  var z = canvas && canvas._pcZoom;
  return !!z && (z.scale > 1.005 || z.scale < 0.995);
}

function pcResetZoom(canvas) {
  var z = pcZoomState(canvas);
  z.scale = 1.0; z.centerX = null; z.centerY = null;
  pcPanState(canvas).active = false;
  pcHideOverlays(canvas._pcCtx);
  if(typeof canvas._veRedraw === 'function') canvas._veRedraw();
}

// ── Overlay elemanları (tooltip + crosshair) ──────────────────────────────
// Canvas'ın sarmalayıcısına BİR KEZ eklenir. Sarmalayıcı position:relative
// değilse öyle yapılır (grafikler farklı kartlarda duruyor).
function pcEnsureOverlays(canvas, uid) {
  var wrap = canvas.parentElement;
  if(!wrap) return null;
  if(getComputedStyle(wrap).position === 'static') wrap.style.position = 'relative';

  var ids = { tooltip: uid + '-pc-tt', crossV: uid + '-pc-cv', crossH: uid + '-pc-ch' };
  if(!document.getElementById(ids.tooltip)) {
    var holder = document.createElement('div');
    holder.innerHTML =
      '<div id="' + ids.tooltip + '" style="position:absolute; display:none; pointer-events:none; background:var(--bg-tertiary); border:1px solid var(--border-color); border-radius:var(--radius-sm); padding:6px 9px; font-size:var(--fs-tiny); color:var(--text-primary); line-height:1.45; box-shadow:0 4px 16px rgba(0,0,0,0.45); z-index:10; max-width:230px; white-space:nowrap;"></div>' +
      '<div id="' + ids.crossV + '" style="position:absolute; top:0; width:1px; height:100%; background:rgba(255,255,255,0.14); pointer-events:none; display:none; z-index:5;"></div>' +
      '<div id="' + ids.crossH + '" style="position:absolute; left:0; width:100%; height:1px; background:rgba(255,255,255,0.14); pointer-events:none; display:none; z-index:5;"></div>';
    while(holder.firstChild) wrap.appendChild(holder.firstChild);
  }
  return ids;
}

function pcEls(ctx) {
  var e = (ctx && ctx.els) || {};
  return {
    tooltip: e.tooltip ? document.getElementById(e.tooltip) : null,
    crossV: e.crossV ? document.getElementById(e.crossV) : null,
    crossH: e.crossH ? document.getElementById(e.crossH) : null
  };
}

function pcHideOverlays(ctx) {
  var els = pcEls(ctx);
  if(els.tooltip) els.tooltip.style.display = 'none';
  if(els.crossV) els.crossV.style.display = 'none';
  if(els.crossH) els.crossH.style.display = 'none';
}

// ── Dinleyiciler (bağlam-genel) ───────────────────────────────────────────

function pcMouseDown(e) {
  var canvas = e.currentTarget, ctx = canvas._pcCtx;
  if(!ctx) return;
  if(e.button === 0) {
    if(pcIsZoomed(canvas)) { e.preventDefault(); pcResetZoom(canvas); }
    return;
  }
  if(e.button !== 2) return;
  e.preventDefault();
  var pan = ctx.pan, zoom = ctx.zoom;
  pan.active = true;
  pan.startX = e.clientX; pan.startY = e.clientY;
  pan.startCenterX = zoom.centerX; pan.startCenterY = zoom.centerY;
  canvas.style.cursor = 'grabbing';
  pcHideOverlays(ctx);
}

function pcMouseUp(e) {
  if(e.button !== 2) return;
  var canvas = e.currentTarget, ctx = canvas._pcCtx;
  if(!ctx || !ctx.pan.active) return;
  ctx.pan.active = false;
  canvas.style.cursor = 'crosshair';
}

function pcWheel(e) {
  var canvas = e.currentTarget, ctx = canvas._pcCtx;
  if(!ctx) return;
  var pos = pcPointerPos(e, canvas, ctx);
  if(!pcInPlot(pos, ctx)) return;              // eksen/marj → sayfa kaydırması serbest
  if(ctx.zoomModifier !== false && !(e.ctrlKey || e.metaKey)) return;  // bkz. dosya başı gerekçe
  e.preventDefault();

  var old = ctx.zoom.scale || 1.0;
  var next = Math.max(PC_ZOOM_MIN, Math.min(PC_ZOOM_MAX, old * (e.deltaY > 0 ? PC_ZOOM_STEP_OUT : PC_ZOOM_STEP_IN)));
  if(next === old) return;
  ctx.zoom.scale = next;
  if(typeof canvas._veRedraw === 'function') canvas._veRedraw();
}

function pcMouseMove(e) {
  var canvas = e.currentTarget, ctx = canvas._pcCtx;
  if(!ctx) return;
  var pos = pcPointerPos(e, canvas, ctx);

  // ── Pan ──
  if(ctx.pan.active) {
    pcHideOverlays(ctx);
    var dx = (e.clientX - ctx.pan.startX) * pos.sx;
    var dy = (e.clientY - ctx.pan.startY) * pos.sy;
    ctx.zoom.centerX = ctx.pan.startCenterX - dx / ctx.pw * (ctx.maxX - ctx.minX);
    ctx.zoom.centerY = ctx.pan.startCenterY + dy / ctx.ph * (ctx.maxY - ctx.minY);
    if(!ctx.pan._raf) {
      ctx.pan._raf = requestAnimationFrame(function() {
        ctx.pan._raf = null;
        if(typeof canvas._veRedraw === 'function') canvas._veRedraw();
      });
    }
    return;
  }

  // ── Tooltip + crosshair ──
  var els = pcEls(ctx);
  if(!pcInPlot(pos, ctx)) { pcHideOverlays(ctx); return; }

  var cssX = pos.mx / pos.sx, cssY = pos.my / pos.sy;
  if(els.crossV) { els.crossV.style.display = 'block'; els.crossV.style.left = cssX + 'px'; }
  if(els.crossH) { els.crossH.style.display = 'block'; els.crossH.style.top = cssY + 'px'; }

  if(!els.tooltip || typeof ctx.tooltipHTML !== 'function') return;
  var xVal = ctx.xFromPx ? ctx.xFromPx(pos.mx) : null;
  var yVal = ctx.yFromPx ? ctx.yFromPx(pos.my) : null;
  var html = null;
  try { html = ctx.tooltipHTML(xVal, yVal, ctx); } catch(err) { html = null; }
  if(!html) { els.tooltip.style.display = 'none'; return; }

  els.tooltip.innerHTML = html;
  els.tooltip.style.display = 'block';
  var tw = ctx.tooltipWidth || 230, th = els.tooltip.offsetHeight || 100;
  var tx = cssX + 16, ty = cssY - 10;
  if(tx + tw > pos.rect.width - 8) tx = cssX - tw - 12;
  if(tx < 4) tx = 4;
  if(ty + th > pos.rect.height - 8) ty = pos.rect.height - th - 8;
  if(ty < 4) ty = 4;
  els.tooltip.style.left = tx + 'px';
  els.tooltip.style.top = ty + 'px';
}

function pcMouseLeave(e) {
  var canvas = e.currentTarget, ctx = canvas._pcCtx;
  if(!ctx) return;
  if(ctx.pan.active) { ctx.pan.active = false; canvas.style.cursor = 'crosshair'; }
  pcHideOverlays(ctx);
}

// ── Bağlama ───────────────────────────────────────────────────────────────

// Çizim bittikten sonra çağrılır: bağlamı tazeler ve dinleyicileri bağlar.
// Her çizimde güvenle çağrılabilir (dinleyiciler on* property'si olduğu için
// yığılmaz — bkz. denetimde bulunan addEventListener yığılma sınıfı).
function pcAttach(canvas, opts) {
  if(!canvas || !opts) return null;
  var ids = pcEnsureOverlays(canvas, opts.uid);
  canvas._pcCtx = {
    ml: opts.ml, mr: opts.mr, mt: opts.mt, mb: opts.mb, pw: opts.pw, ph: opts.ph,
    minX: opts.minX, maxX: opts.maxX, minY: opts.minY, maxY: opts.maxY,
    xFromPx: opts.xFromPx, yFromPx: opts.yFromPx,
    zoom: pcZoomState(canvas), pan: pcPanState(canvas),
    zoomModifier: opts.zoomModifier !== false,
    tooltipWidth: opts.tooltipWidth,
    tooltipHTML: opts.tooltipHTML,
    els: ids || {},
    data: opts.data
  };
  canvas.onmousemove = pcMouseMove;
  canvas.onmouseleave = pcMouseLeave;
  canvas.onwheel = pcWheel;
  canvas.onmousedown = pcMouseDown;
  canvas.onmouseup = pcMouseUp;
  canvas.oncontextmenu = function(e) { e.preventDefault(); };
  canvas.style.cursor = 'crosshair';
  if(!canvas.getAttribute('role')) canvas.setAttribute('role', 'img');
  if(!canvas.getAttribute('title')) {
    canvas.setAttribute('title', 'İmleçle değerleri okuyun · Ctrl + tekerlek: yakınlaştır · Sağ tık + sürükle: kaydır · Sol tık: sıfırla');
  }
  return canvas._pcCtx;
}

// Kullanım ipucunu / zoom oranını plot ÜSTÜNE yazar. Plot dibi çoğu panelde
// katın altında kaldığı için hiç okunmaz.
function pcDrawHint(ctx2d, canvas, ml, mt, pw, isDark) {
  if(!ctx2d) return;
  var prevAlign = ctx2d.textAlign, prevFont = ctx2d.font, prevFill = ctx2d.fillStyle;
  ctx2d.textAlign = 'left';
  if(pcIsZoomed(canvas)) {
    ctx2d.fillStyle = '#60a5fa';
    ctx2d.font = 'bold 9px sans-serif';
    ctx2d.fillText(canvas._pcZoom.scale.toFixed(1) + '× — sol tık: sıfırla', ml + 6, mt + 11);
  } else {
    ctx2d.fillStyle = isDark ? 'rgba(122,133,153,0.8)' : 'rgba(100,116,139,0.85)';
    ctx2d.font = '8px sans-serif';
    ctx2d.fillText('Ctrl + Scroll: yakınlaştır  ·  Sağ tık + sürükle: kaydır', ml + 6, mt + 11);
  }
  ctx2d.textAlign = prevAlign; ctx2d.font = prevFont; ctx2d.fillStyle = prevFill;
}

// Panel açıklamalarına eklenecek standart etkileşim cümlesi (gerçek metin —
// canvas bitmap'indeki ipucu seçilemez/çevrilemez, ekran okuyucuya görünmez).
var PC_HINT_HTML = '<b>Etkileşim:</b> imleçle gezinerek değerleri okuyun · <b>Ctrl + tekerlek</b> yakınlaştırır · <b>sağ tık + sürükle</b> kaydırır · <b>sol tık</b> sıfırlar.';

if(typeof module !== 'undefined' && module.exports) {
  module.exports = { pcZoomWindow: pcZoomWindow, pcInPlot: pcInPlot, pcPointerPos: pcPointerPos };
}
