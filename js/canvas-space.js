// ═══════════════════════════════════════════════════════════════════════════
// MFSim Kanvas Uzayı — sonsuz ızgara · kamera "ev" konumu · topoloji ortalama
// ───────────────────────────────────────────────────────────────────────────
// #ve-canvas 6000×6000 ve CSS'te top/left:-3000 → YEREL koordinat uzayı [0,6000],
// merkezi (3000,3000). Kamera dönüşümü tüm modüllerde aynıdır:
//     ekran = (yerel - 3000) * canvasZoom + canvasOffset
//
// Buradaki üç iş, "topoloji ızgaranın sol-üst köşesine yapışıyor" sorununun üç
// ayağıdır:
//
//   1) veGridPattern / veApplyGridPattern — ızgara artık sabit boyutlu
//      #ve-canvas'a değil GÖRÜNÜM katmanına (wrapper) çizilir; deseni kameradan
//      türetilir. Sonuç: ızgaranın KENARI YOK (nereye kaydırırsan kaydır devam
//      eder) ve çizgiler her zoom'da 1px kalır.
//
//   2) veHomeCameraOffset / veCameraHome — "ev" kamerası kanvasın MERKEZİNİ
//      görünümün ortasına koyar. Eski varsayılan {x:3000,y:3000} yerel (0,0)'ı
//      görünümün SOL-ÜST köşesine koyuyordu; bu yüzden kurulan/sürüklenen her
//      şey yerel (0..1400, 0..800) bandında, yani ızgaranın köşesinde başlıyordu.
//
//   3) veCenterTopoState — kayıtlı (örnek) topoloji yüklenirken koordinatları
//      kanvas merkezine taşır. Böylece örneğin her yönünde ~2700px boş alan
//      kalır — topolojileri birleştirme işi büyüdükçe yer sıkıntısı olmaz.
//
// Saf fonksiyonlar (DOM'a dokunmaz) birim testlidir: tests/unit/canvas-space.test.js
// ═══════════════════════════════════════════════════════════════════════════

var VE_CANVAS_SPAN = 6000;                  // #ve-canvas genişlik/yükseklik (CSS ile aynı)
var VE_CANVAS_CENTER = VE_CANVAS_SPAN / 2;  // yerel merkez = kamera dönüşümündeki sabit (3000)
var VE_GRID_MIN_PX = 8;                     // ekranda bir hücre bundan küçükse hücre katlanır

// Pozitif modülo (JS'in % operatörü negatif girdide negatif döner).
function _veMod(v, m) {
  if(!(m > 0) || !isFinite(v)) return 0;
  var r = v % m;
  return r < 0 ? r + m : r;
}

// SAF: kameradan (zoom + offset) sonsuz ızgaranın CSS deseni.
// Döner: { size, x, y } — background-size ve background-position (px).
// Desen görünüm katmanına çizildiği için tekrar EDER; tek gereken, yerel (0,0)
// çizgisinin ekrandaki yerini bulup deseni oraya oturtmak.
function veGridPattern(zoom, offset, baseSize) {
  var z = (typeof zoom === 'number' && isFinite(zoom) && zoom > 0) ? zoom : 1;
  var base = (typeof baseSize === 'number' && isFinite(baseSize) && baseSize > 0) ? baseSize : 20;
  var ox = (offset && isFinite(offset.x)) ? offset.x : 0;
  var oy = (offset && isFinite(offset.y)) ? offset.y : 0;

  // Uzaklaşınca (zoom 0.2) 20px'lik hücre ekranda 4px'e iner; ızgara okunur bir
  // yerleşim yardımcısı olmaktan çıkıp gri bir dokuya dönüşür. Hücreyi eşiği
  // geçene dek 2× KATLA: hep yerel ızgaranın katı kaldığı için çizgiler gerçek
  // hücre sınırlarına oturmaya devam eder.
  var size = base * z;
  var guard = 0;
  while(size < VE_GRID_MIN_PX && guard++ < 12) size *= 2;

  // Yerel (0,0)'ın ekran konumu — desenin başlangıcı. Modülo ile 0..size
  // aralığına indirilir (desen zaten döşer; küçük sayı sayısal hassasiyet için).
  return {
    size: size,
    x: _veMod(ox - VE_CANVAS_CENTER * z, size),
    y: _veMod(oy - VE_CANVAS_CENTER * z, size)
  };
}

// Izgara desenini canlı görünüme uygula (CSS değişkenleri; bkz. styles.css
// ".ve-canvas-wrapper::before"). updateCanvasTransform her pan/zoom karesinde çağırır.
function veApplyGridPattern() {
  if(typeof document === 'undefined') return;
  var wrap = document.getElementById('ve-canvas-wrapper');
  if(!wrap || !wrap.style || typeof wrap.style.setProperty !== 'function') return;
  var base = 20;
  if(typeof veGridSizes !== 'undefined' && typeof veGridDensity !== 'undefined' && veGridSizes[veGridDensity]) {
    base = veGridSizes[veGridDensity];
  }
  var zoom = (typeof canvasZoom !== 'undefined') ? canvasZoom : 1;
  var off = (typeof canvasOffset !== 'undefined') ? canvasOffset : { x: VE_CANVAS_CENTER, y: VE_CANVAS_CENTER };
  var p = veGridPattern(zoom, off, base);
  wrap.style.setProperty('--ve-grid-size', p.size + 'px');
  wrap.style.setProperty('--ve-grid-x', p.x + 'px');
  wrap.style.setProperty('--ve-grid-y', p.y + 'px');
}

// Görünüm (wrapper) ölçüsü — ölçülemiyorsa pencereye, o da yoksa makul bir
// masaüstü boyutuna düşer. ASLA 0 dönmez: 0 dönseydi "ev" kamerası yine köşeye
// otururdu ki düzeltmeye çalıştığımız şey tam olarak budur.
function veCanvasViewportSize() {
  var w = 0, h = 0;
  if(typeof document !== 'undefined') {
    var wrap = document.getElementById('ve-canvas-wrapper');
    if(wrap) { w = wrap.clientWidth || 0; h = wrap.clientHeight || 0; }
  }
  if(!(w > 20) && typeof window !== 'undefined') w = window.innerWidth || 0;
  if(!(h > 20) && typeof window !== 'undefined') h = window.innerHeight || 0;
  if(!(w > 20)) w = 1280;
  if(!(h > 20)) h = 720;
  return { w: w, h: h };
}

// "Ev" kamerası: kanvas merkezi (3000,3000) görünümün ortasında.
//   ekran = (3000 - 3000) * zoom + offset = offset  ⇒  offset = görünüm merkezi
function veHomeCameraOffset() {
  var vp = veCanvasViewportSize();
  return { x: Math.round(vp.w / 2), y: Math.round(vp.h / 2) };
}

// Kamerayı ev konumuna al (zoom %100). Düğüm koordinatlarına DOKUNMAZ.
function veCameraHome() {
  if(typeof canvasOffset === 'undefined') return;
  canvasOffset = veHomeCameraOffset();
  canvasZoom = 1;
  if(typeof updateCanvasTransform === 'function') updateCanvasTransform();
}

// SAF: düğüm + açıklama (çerçeve/yazı) koordinatlarının sınır kutusu.
// Koordinatı olmayan (x/y sayı değil) kayıtlar sayılmaz; hiçbiri sayılmazsa null.
function veTopoBBox(nodeList, annotList) {
  var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity, seen = 0;
  function add(it, dw, dh) {
    if(!it || !isFinite(it.x) || !isFinite(it.y)) return;
    var w = isFinite(it.width) ? it.width : dw;
    var h = isFinite(it.height) ? it.height : dh;
    if(it.x < minX) minX = it.x;
    if(it.y < minY) minY = it.y;
    if(it.x + w > maxX) maxX = it.x + w;
    if(it.y + h > maxY) maxY = it.y + h;
    seen++;
  }
  (nodeList || []).forEach(function(n) { add(n, 65, 60); });
  (annotList || []).forEach(function(a) { add(a, 0, 0); });
  if(!seen) return null;
  return { minX: minX, minY: minY, maxX: maxX, maxY: maxY };
}

// SAF: yüklenecek topoloji durumunu kanvas merkezine taşı.
// Düğümler/açıklamalar kopyalanarak kaydırılır (kaynak JSON — örneğin gömülü
// window.__MNT_TOPOLOGIES kaydı — DEĞİŞMEZ). Kamera da aynı miktarda kaydırılır
// → içerik ekranda aynı yerde durur, yalnız KOORDİNATLARI ortaya taşınır.
// Koordinatsız durumlarda (bbox yok) hiçbir şey yapmaz.
function veCenterTopoState(state, center) {
  if(!state || !state.nodes || !state.nodes.length) return state;
  var c = (typeof center === 'number' && isFinite(center)) ? center : VE_CANVAS_CENTER;
  var bb = veTopoBBox(state.nodes, state.annotations);
  if(!bb) return state;

  var dx = c - (bb.minX + bb.maxX) / 2;
  var dy = c - (bb.minY + bb.maxY) / 2;
  if(Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) return state;   // zaten ortada

  function shift(it) {
    if(!it || !isFinite(it.x) || !isFinite(it.y)) return it;
    var copy = {};
    for(var k in it) { if(Object.prototype.hasOwnProperty.call(it, k)) copy[k] = it[k]; }
    copy.x = it.x + dx;
    copy.y = it.y + dy;
    return copy;
  }

  state.nodes = state.nodes.map(shift);
  if(state.annotations && state.annotations.length) state.annotations = state.annotations.map(shift);

  // Kamera telafisi: ekran = (yerel - 3000)*zoom + offset olduğuna göre içerik
  // +d kadar kaydıysa offset -d*zoom kadar kaymalı ki görünüm sabit kalsın.
  var z = (isFinite(state.canvasZoom) && state.canvasZoom > 0) ? state.canvasZoom : 1;
  if(state.canvasOffset && isFinite(state.canvasOffset.x) && isFinite(state.canvasOffset.y)) {
    state.canvasOffset = { x: state.canvasOffset.x - dx * z, y: state.canvasOffset.y - dy * z };
  }
  return state;
}

if(typeof module !== 'undefined' && module.exports) {
  module.exports = {
    VE_CANVAS_SPAN: VE_CANVAS_SPAN,
    VE_CANVAS_CENTER: VE_CANVAS_CENTER,
    VE_GRID_MIN_PX: VE_GRID_MIN_PX,
    veGridPattern: veGridPattern,
    veApplyGridPattern: veApplyGridPattern,
    veCanvasViewportSize: veCanvasViewportSize,
    veHomeCameraOffset: veHomeCameraOffset,
    veCameraHome: veCameraHome,
    veTopoBBox: veTopoBBox,
    veCenterTopoState: veCenterTopoState
  };
}
