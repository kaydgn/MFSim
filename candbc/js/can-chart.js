// ═══════════════════════════════════════════════════════════════════════════
// ŞERİT GRAFİĞİ — bir şerit = bir Y ekseni, ortak X ekseni
// ═══════════════════════════════════════════════════════════════════════════
//
// Yerleşim kuralları MFSim'in ölçüm penceresiyle AYNI dili konuşur
// (UI_PATTERN_GUIDE, "Ölçüm Penceresi"):
//   · Bir şerit = bir Y ekseni; birleştirme yalnız AYNI BİRİMDE anlamlı.
//   · Ayrık sinyal BASAMAKLI çizilir — vites 3'ten 4'e geçerken 3,5'ten geçmez.
//   · İmleç AYRI katmanda (overlay canvas); yoksa her fare hareketi bütün
//     serileri yeniden örneklerdi.
//   · Zaman ekseni AYRI ve SABİT bir canvas — sekiz şeritli pencerede aşağı
//     inince eksen ekrandan çıkmamalı.
//   · Canvas'a SABİT RENK YAZILMAZ; tema değişkenleri hesaplanmış stilden
//     okunur, ızgara için nötr gri kullanılır (iki zeminde de okunur).
//
// ── SEYRELTME (decimation) ───────────────────────────────────────────────
// Bir CAN kaydında tek sinyal milyonlarca örnek taşıyabilir; ekranda ~1000
// piksel sütunu var. Her örneği çizmek hem yavaş hem anlamsız. Sütun başına
// EN KÜÇÜK/EN BÜYÜK ikilisi bulunup dikey bir parça çiziliyor: tepe değerler
// kaybolmuyor (basit "her N'inci örneği al" seyreltmesinin sildiği şey tam
// olarak budur — bir gerilim sıçraması sessizce yok olur).

var CDB_SIGNAL_COLORS = ['#3b82f6', '#ef4444', '#22c55e', '#f59e0b', '#8b5cf6', '#ec4899',
                         '#14b8a6', '#f97316', '#6366f1', '#84cc16'];

// ── ÖLÇÜLER ──────────────────────────────────────────────────────────────
// Değerler MFSim Ölçüm Görüntüleyici'nin VE_TR ölçüleriyle AYNI: iki program
// yan yana açıldığında aynı ölçüm aletinin iki penceresi gibi dursun. Buradaki
// sayıları değiştirmek görsel dili ayırır — önce oradaki gerekçeye bakın.
var CDB_TR = {
  LANE_GAP: 7,        // şeritler arası boşluk
  LANE_MIN_H: 54,     // şerit taban yüksekliği — altına inince eğri okunmuyor
  LANE_DEF_H: 96,     // şerit tercih edilen yüksekliği
  PAD_TOP: 8,
  PAD_BOTTOM: 8,
  PAD_RIGHT: 14,
  GUTTER_MIN: 62,     // ad bloğu + sayı sütunu için en az oluk
  NAME_MAX_W: 120,    // ad bloğunun üst sınırı (uzun ad kırpılır)
  NAME_GAP: 10,       // ad bloğu ile sayı sütunu arası
  NAME_LINE_H: 12,
  NAME_DOT: 7,        // ad satırındaki renk kutucuğu
  NAME_DOT_GAP: 5,
  BADGE_H: 14,        // imleç değer rozetinin yüksekliği
  AXIS_H: 30,         // alttaki sabit zaman ekseni canvas'ının yüksekliği
  FONT: '-apple-system,system-ui,Segoe UI,sans-serif'
};

var cdbChart = {
  lanes: [],          // [{ keys:[], h, name }]
  x0: 0, x1: 1,       // görünen zaman penceresi (s)
  fullX0: 0, fullX1: 1,
  yScope: 'window',   // 'window' → Y görünen pencereye, 'all' → bütün kayda
  cursorT: null,
  pinT: null,
  history: [],        // yakınlaştırma geçmişi (Geri düğmesi)
  manualH: false,     // kullanıcı bir şerit yüksekliğini elle değiştirdi mi
  drag: null
};

var cdbSeriesCache = {};    // sigKey → seri
var cdbSigMeta = {};        // sigKey → { msg, sig, colorIx }
var cdbColorSeq = 0;

// ── Renk: liste kutucuğu, eğri, lejant ve rozet AYNI kaynaktan ────────────
function cdbSigColor(key) {
  var m = cdbSigMeta[key];
  if (!m) return CDB_SIGNAL_COLORS[0];
  return CDB_SIGNAL_COLORS[m.colorIx % CDB_SIGNAL_COLORS.length];
}

function cdbSeriesOf(key) {
  if (cdbSeriesCache[key]) return cdbSeriesCache[key];
  var m = cdbSigMeta[key];
  if (!m || !cdbState.store) return null;
  cdbSeriesCache[key] = cdbBuildSeries(cdbState.store, m.ch, m.sig);
  return cdbSeriesCache[key];
}

// ── Şerit yönetimi ────────────────────────────────────────────────────────

function cdbChartHasSignal(key) {
  for (var i = 0; i < cdbChart.lanes.length; i++)
    if (cdbChart.lanes[i].keys.indexOf(key) >= 0) return true;
  return false;
}

function cdbChartAddSignal(ch, sig) {
  var key = cdbSigKey(ch, sig);
  if (cdbChartHasSignal(key)) return;
  if (!cdbSigMeta[key]) cdbSigMeta[key] = { ch: ch, msg: ch.msg, sig: sig, colorIx: cdbColorSeq++ };
  cdbChart.lanes.push({ keys: [key], h: CDB_TR.LANE_DEF_H });
  if (cdbChart.lanes.length === 1) cdbChartFitAll(true);
  cdbChartLayout();
}

function cdbChartRemoveSignal(key) {
  for (var i = cdbChart.lanes.length - 1; i >= 0; i--) {
    var at = cdbChart.lanes[i].keys.indexOf(key);
    if (at >= 0) cdbChart.lanes[i].keys.splice(at, 1);
    if (!cdbChart.lanes[i].keys.length) cdbChart.lanes.splice(i, 1);
  }
  cdbChartLayout();
}

function cdbChartClear() {
  cdbChart.lanes = [];
  cdbChart.pinT = null;
  cdbChart.manualH = false;
  cdbChartLayout();
}

// Aynı BİRİMDEKİ şeritleri birleştirir. Farklı birimleri birleştirmek
// (0–3000 rpm ile 0–100 °C) ikincisini düz çizgiye çevirir — bu yüzden
// birleştirme birime bağlıdır, kullanıcının seçimine değil.
function cdbChartMergeByUnit() {
  var byUnit = {}, out = [];
  for (var i = 0; i < cdbChart.lanes.length; i++) {
    var lane = cdbChart.lanes[i];
    for (var j = 0; j < lane.keys.length; j++) {
      var k = lane.keys[j];
      var u = (cdbSigMeta[k] ? cdbSigMeta[k].sig.unit : '') || '—';
      if (!byUnit[u]) { byUnit[u] = { keys: [], h: lane.h }; out.push(byUnit[u]); }
      byUnit[u].keys.push(k);
    }
  }
  cdbChart.lanes = out;
  cdbChartLayout();
}

function cdbChartSplitAll() {
  var out = [];
  for (var i = 0; i < cdbChart.lanes.length; i++)
    for (var j = 0; j < cdbChart.lanes[i].keys.length; j++)
      out.push({ keys: [cdbChart.lanes[i].keys[j]], h: CDB_TR.LANE_DEF_H });
  cdbChart.lanes = out;
  cdbChartLayout();
}

// ── Zaman penceresi ───────────────────────────────────────────────────────

function cdbChartFitAll(silent) {
  var st = cdbState.store;
  if (!st || !st.n) { cdbChart.x0 = 0; cdbChart.x1 = 1; }
  else {
    var pad = (st.t1 - st.t0) * 0.01;
    cdbChart.x0 = st.t0 - pad;
    cdbChart.x1 = st.t1 + pad;
    if (cdbChart.x1 - cdbChart.x0 < 1e-9) { cdbChart.x0 -= 0.5; cdbChart.x1 += 0.5; }
  }
  cdbChart.fullX0 = cdbChart.x0;
  cdbChart.fullX1 = cdbChart.x1;
  cdbChart.history = [];
  if (!silent) cdbChartRedraw();
}

function cdbChartPushHistory() {
  cdbChart.history.push([cdbChart.x0, cdbChart.x1]);
  if (cdbChart.history.length > 40) cdbChart.history.shift();
}

function cdbChartBack() {
  var h = cdbChart.history.pop();
  if (!h) return;
  cdbChart.x0 = h[0]; cdbChart.x1 = h[1];
  cdbChartRedraw();
}

function cdbChartZoom(factor, aboutT) {
  var span = cdbChart.x1 - cdbChart.x0;
  var at = (aboutT === undefined || aboutT === null) ? (cdbChart.x0 + span / 2) : aboutT;
  var next = span * factor;
  var full = cdbChart.fullX1 - cdbChart.fullX0;
  if (next > full * 4) next = full * 4;
  if (next < 1e-7) next = 1e-7;
  var r = (at - cdbChart.x0) / span;
  cdbChart.x0 = at - r * next;
  cdbChart.x1 = cdbChart.x0 + next;
  cdbChartRedraw();
}

// ── Ölçek yardımcıları ────────────────────────────────────────────────────

// Görünen zaman aralığına düşen örnek indeksleri. Zaman artan sırada
// olduğunda ikili arama; kayıt birleştirilmişse (monotonik değil) tam tarama.
function cdbVisibleRange(ser, x0, x1) {
  var n = ser.n;
  if (!n) return [0, 0];
  if (cdbState.store && cdbState.store.timeMonotonic === false) return [0, n];
  var lo = 0, hi = n - 1, i0 = n;
  while (lo <= hi) { var m = (lo + hi) >> 1; if (ser.t[m] >= x0) { i0 = m; hi = m - 1; } else lo = m + 1; }
  lo = 0; hi = n - 1; var i1 = n;
  while (lo <= hi) { var m2 = (lo + hi) >> 1; if (ser.t[m2] > x1) { i1 = m2; hi = m2 - 1; } else lo = m2 + 1; }
  return [Math.max(0, i0 - 1), Math.min(n, i1 + 1)];
}

// "Güzel" eksen adımı — 1 / 2 / 5 × 10ⁿ.
function cdbNiceStep(span, want) {
  if (!(span > 0)) return 1;
  var raw = span / Math.max(1, want);
  var mag = Math.pow(10, Math.floor(Math.log(raw) / Math.LN10));
  var n = raw / mag;
  var s = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10;
  return s * mag;
}

function cdbFmtNum(v, step) {
  if (!isFinite(v)) return '—';
  var dec = 0;
  if (step && step < 1) dec = Math.min(6, Math.ceil(-Math.log(step) / Math.LN10));
  var a = Math.abs(v);
  if (a >= 1e6 || (a > 0 && a < 1e-4)) return v.toExponential(2);
  return v.toFixed(dec);
}

function cdbFmtTime(t, step) {
  var a = Math.abs(t);
  if (step >= 1) return t.toFixed(a >= 100 ? 0 : 1) + ' s';
  if (step >= 0.001) return t.toFixed(3) + ' s';
  return (t * 1000).toFixed(3) + ' ms';
}

// Şeridin Y aralığı. yScope='window' ise yalnız GÖRÜNEN pencereye bakar —
// osiloskop davranışı: yakınlaştırınca dalga ekranı doldurur.
function cdbLaneRange(lane) {
  var lo = Infinity, hi = -Infinity;
  for (var i = 0; i < lane.keys.length; i++) {
    var ser = cdbSeriesOf(lane.keys[i]);
    if (!ser || !ser.n) continue;
    if (cdbChart.yScope === 'all') {
      if (ser.min < lo) lo = ser.min;
      if (ser.max > hi) hi = ser.max;
    } else {
      var r = cdbVisibleRange(ser, cdbChart.x0, cdbChart.x1);
      for (var j = r[0]; j < r[1]; j++) {
        var v = ser.v[j];
        if (v < lo) lo = v;
        if (v > hi) hi = v;
      }
    }
  }
  if (!isFinite(lo) || !isFinite(hi)) return [0, 1];
  if (hi - lo < 1e-12) { var c = (hi + lo) / 2 || 0; return [c - 0.5, c + 0.5]; }
  var pad = (hi - lo) * 0.08;
  return [lo - pad, hi + pad];
}

// ── Çizim ─────────────────────────────────────────────────────────────────

// Şeritler PENCEREYİ DOLDURUR. Sabit yükseklikte bırakılsalardı iki sinyalli
// bir çözümlemede ekranın yarısı boş kalır, on sinyallide de her şerit
// birbirine yapışırdı. Kullanıcı bir şeridi elle sürüklediği anda bu
// dağıtım DURUR (cdbChart.manualH) — emeğin üstüne yazılmaz.
function cdbChartLayout() {
  var scroll = document.getElementById('cdb-scroll');
  var surf = document.getElementById('cdb-surface');
  if (!scroll || !surf) return;
  var n = cdbChart.lanes.length;
  if (n && !cdbChart.manualH) {
    var avail = (scroll.clientHeight || 0) - CDB_TR.LANE_GAP * (n - 1);
    var each = Math.floor(avail / n);
    var h = Math.max(CDB_TR.LANE_MIN_H, each);
    for (var q = 0; q < n; q++) cdbChart.lanes[q].h = h;
  }
  surf.style.height = cdbTotalH() + 'px';
  cdbChartRedraw();
  if (typeof cdbRefreshTree === 'function') cdbRefreshTree();
  cdbUpdateStatus();
}

// Şeritlerin toplam yüksekliği — ARALARINDAKİ BOŞLUK DAHİL. Üç ayrı yerde
// (yüzey yüksekliği, canvas boyu, sınır isabeti) elle toplanınca biri
// unutuluyor ve şeritler bir boşluk kadar kayıyordu.
function cdbTotalH() {
  var n = cdbChart.lanes.length;
  if (!n) return 0;
  var t = CDB_TR.LANE_GAP * (n - 1);
  for (var i = 0; i < n; i++) t += cdbChart.lanes[i].h;
  return t;
}

// i. şeridin üst kenarı.
function cdbLaneTop(i) {
  var t = 0;
  for (var k = 0; k < i; k++) t += cdbChart.lanes[k].h + CDB_TR.LANE_GAP;
  return t;
}

function cdbSizeCanvas(cv, w, h) {
  var dpr = window.devicePixelRatio || 1;
  if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) {
    cv.width = Math.round(w * dpr);
    cv.height = Math.round(h * dpr);
  }
  cv.style.width = w + 'px';
  cv.style.height = h + 'px';
  var ctx = cv.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return ctx;
}

// ── Oluk geometrisi ───────────────────────────────────────────────────────
// Oluk iki sütundur: SOLDA ad bloğu (renk kutucuğu + sinyal adı), SAĞDA Y
// sayıları. Ad çizim alanının İÇİNE konmaz — ölçüm görüntüleyicisinde ölçüldü:
// içeri konan yatay lejant eğrilerin üstüne biniyor. Genişlik ölçülen metinden
// gelir, sabit değil: kısa adlarda oluk daralır, dar pencerede çizim alanı
// kaybolmaz.
function cdbGutter(ctx, w) {
  var nameW = 0, numW = 0;
  ctx.font = '600 9px ' + CDB_TR.FONT;
  for (var i = 0; i < cdbChart.lanes.length; i++) {
    var lane = cdbChart.lanes[i];
    for (var k = 0; k < lane.keys.length; k++) {
      var m = cdbSigMeta[lane.keys[k]];
      if (!m) continue;
      nameW = Math.max(nameW, ctx.measureText(cdbLaneTitle(m)).width);
    }
  }
  ctx.font = '9.5px ' + CDB_TR.FONT;
  for (var j = 0; j < cdbChart.lanes.length; j++) {
    var lb = cdbLaneTickLabels(cdbChart.lanes[j]);
    for (var q = 0; q < lb.length; q++) numW = Math.max(numW, ctx.measureText(lb[q]).width);
  }
  nameW = Math.min(CDB_TR.NAME_MAX_W, Math.ceil(nameW) + CDB_TR.NAME_DOT + CDB_TR.NAME_DOT_GAP);
  numW = Math.min(70, Math.max(24, Math.ceil(numW)));
  var plotX = 4 + nameW + CDB_TR.NAME_GAP + numW + 6;
  plotX = Math.max(CDB_TR.GUTTER_MIN, Math.min(plotX, Math.max(CDB_TR.GUTTER_MIN, w * 0.42)));
  return { nameX: 4, nameW: nameW, plotX: plotX, plotW: Math.max(20, w - plotX - CDB_TR.PAD_RIGHT) };
}

// Şerit adı. Aynı sinyal adı BİRDEN FAZLA kanaldan gelebiliyor (aynı mesajı
// iki ECU gönderiyor); ad tek başına hangi eğrinin hangisi olduğunu söylemez.
// Bu yüzden birden fazla kaynak varsa kaynak adresi de ada girer.
function cdbLaneTitle(meta) {
  var base = meta.sig.name + (meta.sig.unit ? ' [' + meta.sig.unit + ']' : '');
  if (meta.ch && meta.ch.j && cdbSigNameShared(meta)) base += ' · SA ' + cdbFmtAddr(meta.ch.j.sa);
  return base;
}

// Grafikte aynı sinyal adı başka bir kanaldan da çizili mi?
function cdbSigNameShared(meta) {
  for (var k in cdbSigMeta) {
    if (!cdbSigMeta.hasOwnProperty(k) || !cdbChartHasSignal(k)) continue;
    var o = cdbSigMeta[k];
    if (o !== meta && o.sig.name === meta.sig.name) return true;
  }
  return false;
}

// Şeritte TEK sinyal varsa ve o sinyalin VAL_ tablosu varsa Y ekseninde sayı
// yerine METNİN KENDİSİ yazılır — CANoe'nun "durum şeridi" karşılığı.
// Vitesin 3 yazması "3. vites" kadar bilgi taşımıyor.
function cdbLaneEnumSignal(lane) {
  if (lane.keys.length !== 1) return null;
  var m = cdbSigMeta[lane.keys[0]];
  return (m && m.sig.values) ? m.sig : null;
}

// Şeridin Y tik ETİKETLERİ — oluk genişliğini ölçmek ve çizmek AYNI listeden
// beslenir; ayrışırlarsa sayılar oluğa sığmaz ya da boşluk boşa gider.
function cdbLaneTickLabels(lane) {
  var rng = cdbLaneRange(lane);
  var step = cdbNiceStep(rng[1] - rng[0], 4);
  var enumSig = cdbLaneEnumSignal(lane);
  var out = [], v = Math.ceil(rng[0] / step) * step;
  for (; v <= rng[1] + step * 1e-6; v += step) {
    var lbl = cdbFmtNum(v, step);
    if (enumSig) {
      var txt = cdbValueText(enumSig, v);
      lbl = txt ? (txt.length > 12 ? txt.slice(0, 11) + '…' : txt) : '';
    }
    out.push({ v: v, text: lbl });
  }
  // Dönen dizi metinlerdir (measureText için); tikler ve aralık üstüne
  // iliştirilir. Ölçen de çizen de AYNI listeyi kullanır — ayrışırlarsa
  // sayılar oluğa sığmaz ya da oluk boşuna geniş kalır.
  var arr = out.map(function(o) { return o.text; });
  arr.ticks = out;
  arr.range = rng;
  return arr;
}

function cdbChartRedraw() {
  var scroll = document.getElementById('cdb-scroll');
  var cv = document.getElementById('cdb-canvas');
  var ov = document.getElementById('cdb-overlay');
  var ax = document.getElementById('cdb-axis');
  var empty = document.getElementById('cdb-empty');
  if (!scroll || !cv || !ax) return;

  var w = scroll.clientWidth || 600;
  var h = Math.max(cdbTotalH(), 1);
  if (empty) empty.style.display = cdbChart.lanes.length ? 'none' : 'flex';

  var ctx = cdbSizeCanvas(cv, w, h);
  cdbSizeCanvas(ov, w, h);
  ctx.clearRect(0, 0, w, h);

  var geo = cdbGutter(ctx, w);
  cdbChart.geo = geo;

  var col = {
    text:  cdbCssVar('--text-muted', '#888'),
    head:  cdbCssVar('--text-heading', '#eee'),
    grid:  'rgba(128,128,128,0.16)',
    face:  'rgba(128,128,128,0.045)',
    frame: 'rgba(128,128,128,0.35)'
  };
  var xTicks = cdbXTicks(w, geo);

  for (var li = 0; li < cdbChart.lanes.length; li++) {
    cdbDrawLane(ctx, cdbChart.lanes[li], geo, cdbLaneTop(li), xTicks, col);
  }

  cdbDrawAxis(ax, w, geo, xTicks, col);
  cdbDrawOverlay();
}

function cdbXTicks(w, geo) {
  var step = cdbNiceStep(cdbChart.x1 - cdbChart.x0, Math.max(3, Math.floor(geo.plotW / 110)));
  var out = [], t = Math.ceil(cdbChart.x0 / step) * step;
  for (; t <= cdbChart.x1; t += step) out.push(t);
  out.step = step;
  return out;
}

function cdbDrawLane(ctx, lane, geo, top, xTicks, col) {
  var x0 = geo.plotX, pw = geo.plotW;
  var y0 = top + CDB_TR.PAD_TOP;
  var ph = Math.max(12, lane.h - CDB_TR.PAD_TOP - CDB_TR.PAD_BOTTOM);
  var labels = cdbLaneTickLabels(lane);
  var rng = labels.range;
  lane._rng = rng;
  lane._rect = { x: x0, y: y0, w: pw, h: ph };

  var toX = function(t) { return x0 + (t - cdbChart.x0) / (cdbChart.x1 - cdbChart.x0) * pw; };
  var toY = function(v) { return y0 + ph - (v - rng[0]) / (rng[1] - rng[0]) * ph; };

  // Zemin — DÜZ ve çok hafif. Ölçüm penceresinde şeridin zemini bir yüzeydir,
  // vurgu değil: gradyan iki eğriyi farklı zeminde okutur.
  ctx.fillStyle = col.face;
  ctx.fillRect(x0, y0, pw, ph);

  // Y ızgarası (kesikli) + tik çentiği + sayı
  ctx.font = '9.5px ' + CDB_TR.FONT;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'right';
  var numRight = x0 - 6;
  for (var i = 0; i < labels.ticks.length; i++) {
    var tk = labels.ticks[i];
    var gy = Math.round(toY(tk.v)) + 0.5;
    if (gy < y0 - 0.5 || gy > y0 + ph + 0.5) continue;
    ctx.strokeStyle = col.grid; ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);
    ctx.beginPath(); ctx.moveTo(x0, gy); ctx.lineTo(x0 + pw, gy); ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = 0.55;
    ctx.beginPath(); ctx.moveTo(x0 - 3, gy); ctx.lineTo(x0, gy); ctx.stroke();
    ctx.globalAlpha = 1;
    if (tk.text !== '') { ctx.fillStyle = col.text; ctx.fillText(tk.text, numRight, gy); }
  }

  // X ızgarası
  ctx.strokeStyle = col.grid; ctx.lineWidth = 1;
  ctx.setLineDash([3, 3]);
  for (var t = 0; t < xTicks.length; t++) {
    var gx = Math.round(toX(xTicks[t])) + 0.5;
    if (gx < x0 - 0.5 || gx > x0 + pw + 0.5) continue;
    ctx.beginPath(); ctx.moveTo(gx, y0); ctx.lineTo(gx, y0 + ph); ctx.stroke();
  }
  ctx.setLineDash([]);

  // Eğriler
  ctx.save();
  ctx.beginPath(); ctx.rect(x0, y0, pw, ph); ctx.clip();
  ctx.lineJoin = 'round'; ctx.lineCap = 'butt';
  for (var k = 0; k < lane.keys.length; k++) cdbDrawSeries(ctx, lane.keys[k], toX, toY, pw);
  ctx.restore();

  // Çerçeve — tek ince çizgi
  ctx.strokeStyle = col.frame; ctx.lineWidth = 1;
  ctx.strokeRect(x0 + 0.5, y0 + 0.5, pw - 1, ph - 1);

  // Ad bloğu OLUKTA, sayı sütununun SOLUNDA, yatay ve dikeyde ortalanmış.
  cdbDrawLaneNames(ctx, lane, geo, y0, ph, col);
}

function cdbDrawLaneNames(ctx, lane, geo, y0, ph, col) {
  var LH = CDB_TR.NAME_LINE_H;
  var maxLines = Math.max(1, Math.floor((ph - 4) / LH));
  var shown = Math.min(lane.keys.length, maxLines);
  var extra = lane.keys.length - shown;
  if (extra > 0 && shown > 1) { shown -= 1; extra += 1; }
  var blockH = (shown + (extra > 0 ? 1 : 0)) * LH;
  var y = y0 + Math.max(2, (ph - blockH) / 2) + LH / 2;
  var x = geo.nameX;
  var textX = x + CDB_TR.NAME_DOT + CDB_TR.NAME_DOT_GAP;
  var textMax = geo.nameW - CDB_TR.NAME_DOT - CDB_TR.NAME_DOT_GAP;

  ctx.save();
  ctx.font = '600 9px ' + CDB_TR.FONT;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  for (var i = 0; i < shown; i++) {
    var meta = cdbSigMeta[lane.keys[i]];
    if (!meta) continue;
    // Renk kutucuğu EĞRİNİN rengi — adı eğriyle eşleştiren şey bu.
    ctx.fillStyle = cdbSigColor(lane.keys[i]);
    ctx.fillRect(x, y - 2.5, CDB_TR.NAME_DOT, 5);
    ctx.fillStyle = cdbSigColor(lane.keys[i]);
    ctx.fillText(cdbFitText(ctx, cdbLaneTitle(meta), textMax), textX, y);
    y += LH;
  }
  if (extra > 0) {
    ctx.fillStyle = col.text;
    ctx.fillText('+' + extra + ' daha', textX, y);
  }
  ctx.restore();
}

// Metni verilen genişliğe kırpar; kırpıldıysa sonuna … koyar.
function cdbFitText(ctx, text, maxW) {
  if (ctx.measureText(text).width <= maxW) return text;
  var s = text;
  while (s.length > 1 && ctx.measureText(s + '…').width > maxW) s = s.slice(0, -1);
  return s + '…';
}

function cdbDrawSeries(ctx, key, toX, toY, pw) {
  var ser = cdbSeriesOf(key);
  if (!ser || !ser.n) return;
  var meta = cdbSigMeta[key];
  var stepped = cdbIsDiscrete(meta.sig);
  ctx.strokeStyle = cdbSigColor(key);
  ctx.lineWidth = 1.35;

  var r = cdbVisibleRange(ser, cdbChart.x0, cdbChart.x1);
  var count = r[1] - r[0];

  // Seyreltme: piksel başına ikiden fazla örnek düşüyorsa sütun sütun
  // en küçük/en büyük çiz. Tepe değerler korunur — "her N'inci örneği al"
  // seyreltmesinin sildiği şey tam olarak budur.
  if (count > pw * 2) {
    ctx.beginPath();
    var colIx = -1, lo = 0, hi = 0, prevY = null;
    for (var i = r[0]; i < r[1]; i++) {
      var cx = Math.round(toX(ser.t[i]));
      if (cx !== colIx) {
        if (colIx >= 0) {
          ctx.moveTo(colIx + 0.5, toY(lo));
          ctx.lineTo(colIx + 0.5, toY(hi));
          if (prevY !== null) { ctx.moveTo(colIx - 0.5, prevY); ctx.lineTo(colIx + 0.5, toY(lo)); }
          prevY = toY(hi);
        }
        colIx = cx; lo = ser.v[i]; hi = ser.v[i];
      } else {
        if (ser.v[i] < lo) lo = ser.v[i];
        if (ser.v[i] > hi) hi = ser.v[i];
      }
    }
    if (colIx >= 0) { ctx.moveTo(colIx + 0.5, toY(lo)); ctx.lineTo(colIx + 0.5, toY(hi)); }
    ctx.stroke();
    return;
  }

  ctx.beginPath();
  var started = false, py = 0;
  for (var j = r[0]; j < r[1]; j++) {
    var x = toX(ser.t[j]), y = toY(ser.v[j]);
    if (!started) { ctx.moveTo(x, y); started = true; }
    else if (stepped) { ctx.lineTo(x, py); ctx.lineTo(x, y); }
    else ctx.lineTo(x, y);
    py = y;
  }
  ctx.stroke();

  // Az örnekli sinyalde noktalar da çizilir: dört kareli bir mesajda düz bir
  // çizgi "sürekli ölçüm" izlenimi verir, nokta gerçeği söyler.
  if (count > 0 && count <= 60) {
    ctx.fillStyle = cdbSigColor(key);
    for (var q = r[0]; q < r[1]; q++) {
      ctx.beginPath();
      ctx.arc(toX(ser.t[q]), toY(ser.v[q]), 1.8, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

// Zaman ekseni AYRI ve SABİT bir canvas: sekiz şeritli bir pencerede aşağı
// inince eksen ekrandan çıkmamalı.
function cdbDrawAxis(ax, w, geo, xTicks, col) {
  var H = CDB_TR.AXIS_H;
  var ctx = cdbSizeCanvas(ax, w, H);
  ctx.clearRect(0, 0, w, H);
  ctx.strokeStyle = col.frame; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(geo.plotX, 0.5); ctx.lineTo(geo.plotX + geo.plotW, 0.5); ctx.stroke();
  ctx.font = '9.5px ' + CDB_TR.FONT;
  ctx.fillStyle = col.text;
  ctx.textBaseline = 'top';
  ctx.textAlign = 'center';
  for (var i = 0; i < xTicks.length; i++) {
    var x = geo.plotX + (xTicks[i] - cdbChart.x0) / (cdbChart.x1 - cdbChart.x0) * geo.plotW;
    ctx.strokeStyle = col.frame;
    ctx.globalAlpha = 0.7;
    ctx.beginPath(); ctx.moveTo(Math.round(x) + 0.5, 1); ctx.lineTo(Math.round(x) + 0.5, 5); ctx.stroke();
    ctx.globalAlpha = 1;
    ctx.fillText(cdbFmtTime(xTicks[i], xTicks.step), x, 8);
  }
  ctx.textAlign = 'right';
  ctx.fillStyle = col.text;
  ctx.fillText('Zaman', geo.plotX - 6, 8);
}

// ── İmleç katmanı ─────────────────────────────────────────────────────────

// Zamanı verilen sinyalin O ANDA GEÇERLİ değeri: sonraki örneğe atlamaz,
// bir önceki örnekte KALIR. CAN sinyali basamaklıdır — 20 ms'de bir gelen bir
// mesajın iki karesi arasında değer değişmez, ara değerlemek uydurma olur.
function cdbSampleAt(ser, t) {
  if (!ser || !ser.n) return null;
  var lo = 0, hi = ser.n - 1, best = -1;
  while (lo <= hi) {
    var m = (lo + hi) >> 1;
    if (ser.t[m] <= t) { best = m; lo = m + 1; } else hi = m - 1;
  }
  if (best < 0) return null;
  return { t: ser.t[best], v: ser.v[best], i: best };
}

function cdbDrawOverlay() {
  var ov = document.getElementById('cdb-overlay');
  var scroll = document.getElementById('cdb-scroll');
  if (!ov || !scroll) return;
  var w = scroll.clientWidth || 600;
  var total = Math.max(cdbTotalH(), 1);
  var ctx = cdbSizeCanvas(ov, w, total);
  ctx.clearRect(0, 0, w, total);
  var geo = cdbChart.geo;
  if (!cdbChart.lanes.length || !geo) return;

  var toX = function(t) { return geo.plotX + (t - cdbChart.x0) / (cdbChart.x1 - cdbChart.x0) * geo.plotW; };

  // Sabitlenen imleç (kehribar, kesikli) — Δt ölçümü için
  if (cdbChart.pinT !== null) cdbDrawCursorLine(ctx, toX(cdbChart.pinT), total, geo, cdbCssVar('--accent-warning', '#d97706'), false);
  if (cdbChart.cursorT !== null) cdbDrawCursorLine(ctx, toX(cdbChart.cursorT), total, geo, cdbCssVar('--accent-primary', '#2563eb'), true);

  if (cdbChart.drag && cdbChart.drag.mode === 'box') {
    var a = Math.min(cdbChart.drag.x, cdbChart.drag.cx), b = Math.max(cdbChart.drag.x, cdbChart.drag.cx);
    ctx.fillStyle = 'rgba(128,128,128,0.18)';
    ctx.fillRect(a, 0, b - a, total);
    ctx.strokeStyle = cdbCssVar('--accent-primary', '#2563eb');
    ctx.lineWidth = 1;
    ctx.strokeRect(a + 0.5, 0.5, b - a - 1, total - 1);
  }
}

function cdbDrawCursorLine(ctx, x, total, geo, color, withBadges) {
  if (x < geo.plotX - 1 || x > geo.plotX + geo.plotW + 1) return;
  ctx.strokeStyle = color;
  ctx.lineWidth = 1;
  ctx.setLineDash(withBadges ? [] : [4, 3]);
  ctx.beginPath(); ctx.moveTo(Math.round(x) + 0.5, 0); ctx.lineTo(Math.round(x) + 0.5, total); ctx.stroke();
  ctx.setLineDash([]);
  if (!withBadges) return;

  var t = cdbChart.cursorT;
  ctx.font = '9.5px ' + CDB_TR.FONT;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'left';
  for (var li = 0; li < cdbChart.lanes.length; li++) {
    var lane = cdbChart.lanes[li];
    var rect = lane._rect, rng = lane._rng;
    if (!rect || !rng) continue;
    for (var k = 0; k < lane.keys.length; k++) {
      var meta = cdbSigMeta[lane.keys[k]];
      var s = cdbSampleAt(cdbSeriesOf(lane.keys[k]), t);
      if (!s || !meta) continue;
      var y = rect.y + rect.h - (s.v - rng[0]) / (rng[1] - rng[0]) * rect.h;
      if (y < rect.y - 1 || y > rect.y + rect.h + 1) continue;
      var label = cdbFmtSigVal(meta.sig, s.v);
      var bw = ctx.measureText(label).width + 8;
      var bx = x + 6;
      if (bx + bw > rect.x + rect.w) bx = x - 6 - bw;
      ctx.fillStyle = cdbSigColor(lane.keys[k]);
      ctx.fillRect(bx, y - CDB_TR.BADGE_H / 2, bw, CDB_TR.BADGE_H);
      ctx.fillStyle = '#fff';
      ctx.fillText(label, bx + 4, y);
      ctx.beginPath(); ctx.arc(x, y, 2.5, 0, Math.PI * 2); ctx.fill();
    }
  }
}

// ── Fare / klavye ─────────────────────────────────────────────────────────

function cdbChartBindEvents() {
  var scroll = document.getElementById('cdb-scroll');
  var ov = document.getElementById('cdb-overlay');
  if (!scroll) return;
  // Piksel → zaman: oluk genişliği ölçülen metinden geldiği için SABİT
  // olamaz; dönüşüm son çizimin geometrisinden okunur.
  var pxToT = function(px) {
    var geo = cdbChart.geo;
    if (!geo) return cdbChart.x0;
    return cdbChart.x0 + (px - geo.plotX) / geo.plotW * (cdbChart.x1 - cdbChart.x0);
  };

  scroll.addEventListener('wheel', function(e) {
    if (!cdbChart.lanes.length) return;
    e.preventDefault();
    cdbChartPushHistory();
    cdbChartZoom(e.deltaY > 0 ? 1.25 : 0.8, pxToT(e.offsetX));
  }, { passive: false });

  scroll.addEventListener('mousedown', function(e) {
    if (!cdbChart.lanes.length) return;
    // Şerit sınırında mıyız? → yükseklik sürükleme
    var y = e.offsetY + scroll.scrollTop, acc = 0;
    for (var i = 0; i < cdbChart.lanes.length; i++) {
      acc += cdbChart.lanes[i].h;
      if (Math.abs(y - acc) <= 4) {   // şerit ALT kenarı (boşluktan önce)
        cdbChart.drag = { mode: 'lane', lane: i, y0: e.clientY, h0: cdbChart.lanes[i].h };
        e.preventDefault();
        return;
      }
      acc += CDB_TR.LANE_GAP;
    }
    if (e.shiftKey) cdbChart.drag = { mode: 'box', x: e.offsetX, cx: e.offsetX };
    else cdbChart.drag = { mode: 'pan', x: e.offsetX, x0: cdbChart.x0, x1: cdbChart.x1 };
    e.preventDefault();
  });

  window.addEventListener('mousemove', function(e) {
    var rect = scroll.getBoundingClientRect();
    var ox = e.clientX - rect.left;
    if (cdbChart.drag) {
      var d = cdbChart.drag;
      if (d.mode === 'pan') {
          var geo = cdbChart.geo;
        var dt = (ox - d.x) / (geo ? geo.plotW : 600) * (d.x1 - d.x0);
        cdbChart.x0 = d.x0 - dt; cdbChart.x1 = d.x1 - dt;
        cdbChartRedraw();
      } else if (d.mode === 'box') {
        d.cx = ox; cdbDrawOverlay();
      } else if (d.mode === 'lane') {
        cdbChart.manualH = true;
        cdbChart.lanes[d.lane].h = Math.max(CDB_TR.LANE_MIN_H, d.h0 + (e.clientY - d.y0));
        cdbChartLayout();
      }
      return;
    }
    if (e.clientY < rect.top || e.clientY > rect.bottom || ox < 0 || ox > rect.width) {
      if (cdbChart.cursorT !== null) { cdbChart.cursorT = null; cdbDrawOverlay(); cdbUpdateStatus(); }
      return;
    }
    cdbChart.cursorT = pxToT(ox);
    cdbDrawOverlay();
    cdbUpdateStatus();
  });

  window.addEventListener('mouseup', function(e) {
    var d = cdbChart.drag;
    if (!d) return;
    cdbChart.drag = null;
    if (d.mode === 'box') {
      var a = Math.min(d.x, d.cx), b = Math.max(d.x, d.cx);
      if (b - a > 6) {
        cdbChartPushHistory();
        var t0 = pxToT(a), t1 = pxToT(b);
        cdbChart.x0 = t0; cdbChart.x1 = t1;
      }
      cdbChartRedraw();
    }
  });

  scroll.addEventListener('dblclick', function() { cdbChartFitAll(); });

  // Sağ tık: imleci sabitle (fark ölçümü)
  scroll.addEventListener('contextmenu', function(e) {
    e.preventDefault();
    cdbChart.pinT = (cdbChart.pinT === null) ? cdbChart.cursorT : null;
    cdbDrawOverlay();
    cdbUpdateStatus();
  });

  scroll.addEventListener('scroll', function() { cdbDrawOverlay(); });
  window.addEventListener('resize', function() { cdbChartLayout(); });
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    cdbNiceStep: cdbNiceStep,
    cdbFmtNum: cdbFmtNum,
    cdbFmtTime: cdbFmtTime,
    cdbVisibleRange: cdbVisibleRange,
    cdbSampleAt: cdbSampleAt,
    cdbLaneRange: cdbLaneRange
  };
}
