// ═══════════════════════════════════════════════════════════════════════════
// ÖLÇÜM İMLECİ (Measurement Cursor) — Vector CANoe tarzı senkron imleç
// ═══════════════════════════════════════════════════════════════════════════
//
// Vector CANoe'nun Grafik penceresinde fare diyagramın üzerinde gezerken tüm
// izleri kesen tek bir dikey imleç çizgisi belirir ve her sinyalin o andaki
// değeri anlık okunur. Bu modül aynı davranışı Sonuçlar sekmesindeki panel
// ızgarasına taşır:
//
//   • Senkron imleç — bir panelde gezinirken AYNI X eksenini paylaşan diğer
//     paneller de aynı X değerine kilitlenir. Dört panel tek bir zaman
//     kafasıyla birlikte okunur (CANoe'daki üst üste binmiş izlerin karşılığı).
//   • Sabitlenmiş referans imleç (Δ ölçümü) — grafiğe tıklayınca imleç orada
//     sabitlenir; fare gezmeye devam ettikçe ΔX ve her sinyal için Δdeğer
//     hesaplanır. İki nokta arası fark (ör. 0→100 km/h süresi) okunabilir.
//   • Legend üzerinde canlı değer — imleç konumundaki değer her sinyalin
//     legend rozetinde görünür; CANoe'nun sol sütunundaki değer okumasının
//     karşılığı.
//   • Klavye adımlama — ok tuşlarıyla örnek örnek ilerleme (Shift ile 10×).
//
// Çizim/geometri bilgisi js/graphics.js içindeki veRenderChart'ın ürettiği
// slot._chartMeta'dan okunur; burada YENİ bir çizim mantığı yoktur.
//
// Saf (test edilebilir) çekirdek: veCursorSnapIndex / veCursorXKey /
// veCursorSample / veCursorDelta / veCursorSyncTargets. DOM'a dokunan
// fonksiyonlar bu çekirdeğin üzerine ince bir katmandır.

// ── Durum ────────────────────────────────────────────────────────────────
// x/srcSlot : fare ile sürülen aktif imleç (hover)
// pinX/pinKey: sabitlenmiş referans imleç — yalnızca aynı X-ekseni kimliğine
//              sahip panellerde gösterilir (zaman ekseni pini hız eksenli
//              panele taşınmamalı).
var veCursorState = {
  sync: true,
  x: null,
  srcSlot: null,
  pinX: null,
  pinKey: null
};

var VE_CURSOR_SYNC_KEY = 'mf-cursor-sync';

(function veCursorLoadPref() {
  try {
    var raw = localStorage.getItem(VE_CURSOR_SYNC_KEY);
    if(raw === '0') veCursorState.sync = false;
  } catch(e) {}
})();

// ── Saf çekirdek ─────────────────────────────────────────────────────────

// X değerine en yakın örnek indeksi (ikili arama). Eşitlikte sağdaki örnek
// seçilir — mevcut tooltip davranışıyla birebir aynı.
function veCursorSnapIndex(arr, x) {
  if(!arr || arr.length === 0) return -1;
  if(!isFinite(x)) return -1;
  if(arr.length === 1) return 0;
  var lo = 0, hi = arr.length - 1;
  while(lo <= hi) {
    var mid = (lo + hi) >> 1;
    if(arr[mid] < x) lo = mid + 1; else hi = mid - 1;
  }
  var idx = lo;
  if(idx >= arr.length) return arr.length - 1;
  if(idx > 0 && Math.abs(arr[idx - 1] - x) < Math.abs(arr[idx] - x)) idx--;
  return idx;
}

// Bir slotun X ekseni kimliği. İki panel ancak aynı kimliği taşıyorsa
// senkronlanır: zaman ekseni ile hız ekseni aynı X değerini paylaşmaz.
// Veri kaynağı (segmentDrive vb.) da kimliğe girer — aynı "zaman" adı farklı
// koşulardan gelirse ayrı alan sayılır.
function veCursorXKey(slot) {
  if(!slot) return null;
  var ax = slot.xAxis;
  var base = (ax && ax.id) ? ax.id : 'time';
  var ds = (ax && ax._dataSource) ? ax._dataSource : (slot._dataSource || '');
  return ds ? (base + '@' + ds) : base;
}

// Kaynak slotla senkronlanabilecek diğer slot indeksleri.
function veCursorSyncTargets(slots, srcIdx) {
  var out = [];
  if(!slots) return out;
  var src = slots[srcIdx];
  if(!src) return out;
  var key = veCursorXKey(src);
  for(var i = 0; i < slots.length; i++) {
    if(i === srcIdx) continue;
    var s = slots[i];
    if(!s || !s._chartMeta) continue;
    if((s.type || 'line') !== 'line') continue;
    if(veCursorXKey(s) !== key) continue;
    out.push(i);
  }
  return out;
}

// Verilen indeksteki tüm sinyal değerleri.
function veCursorSample(meta, idx) {
  if(!meta || !meta.timeArr) return null;
  if(idx < 0 || idx >= meta.timeArr.length) return null;
  var rows = (meta.datasets || []).map(function(ds) {
    var hasVal = !ds._noData && ds.data && idx < ds.data.length && isFinite(ds.data[idx]);
    return {
      name: ds.name,
      unit: ds.unit || '',
      color: ds.color,
      axisIdx: ds._axisIdx || 0,
      noData: !!ds._noData,
      value: hasVal ? ds.data[idx] : null
    };
  });
  return { index: idx, x: meta.timeArr[idx], rows: rows };
}

// İki örnek arası fark (referans → güncel). Eksik değerde dv = null.
function veCursorDelta(refSample, curSample) {
  if(!refSample || !curSample) return null;
  var rows = [];
  var n = Math.min(refSample.rows.length, curSample.rows.length);
  for(var i = 0; i < n; i++) {
    var a = refSample.rows[i], b = curSample.rows[i];
    var dv = (a.value === null || b.value === null) ? null : (b.value - a.value);
    rows.push({ name: b.name, unit: b.unit, color: b.color, dv: dv });
  }
  return { dx: curSample.x - refSample.x, rows: rows };
}

// ── Biçimlendirme ────────────────────────────────────────────────────────

function veCursorFmt(v) {
  if(v === null || v === undefined || !isFinite(v)) return '—';
  if(typeof veFormatTooltipVal === 'function') return veFormatTooltipVal(v);
  return String(Math.round(v * 1000) / 1000);
}

// İşaretli fark: pozitifte '+' öne konur (Δ okuması yön bilgisi taşımalı).
// Tam sıfır düz '0' yazılır — veFormatTooltipVal küçük sayıları üstel biçime
// düşürdüğü için sıfır aksi halde "0.00e+0" olarak görünürdü.
function veCursorFmtDelta(v) {
  if(v === null || v === undefined || !isFinite(v)) return '—';
  if(v === 0) return '0';
  var s = veCursorFmt(Math.abs(v));
  return (v > 0 ? '+' : '−') + s;
}

function veCursorEsc(s) {
  return String(s === undefined || s === null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ── DOM yardımcıları ─────────────────────────────────────────────────────

// Slotun grafik geometrisi (CSS pikselinde plot sınırları). Panel gizli /
// daraltılmışsa null.
function veCursorGeom(slotIdx) {
  var slot = (typeof veResultSlots !== 'undefined') ? veResultSlots[slotIdx] : null;
  if(!slot || !slot._chartMeta) return null;
  var m = slot._chartMeta;
  if(!m.timeArr || m.timeArr.length === 0) return null;
  var canvas = document.getElementById('ve-chart-canvas-' + slotIdx);
  if(!canvas) return null;
  var rect = canvas.getBoundingClientRect();
  if(rect.width < 10 || rect.height < 10) return null;
  var sx = rect.width / m.w, sy = rect.height / m.h;
  return {
    meta: m, slot: slot, canvas: canvas, rect: rect,
    cw: rect.width, ch: rect.height,
    left: m.margin.left * sx,
    right: (m.margin.left + m.pw) * sx,
    top: m.margin.top * sy,
    bottom: (m.margin.top + m.ph) * sy
  };
}

// X değerinin plot içindeki CSS piksel konumu.
function veCursorXToPx(g, xVal) {
  var m = g.meta;
  return g.left + (xVal - m.xMin) / (m.xMax - m.xMin) * (g.right - g.left);
}

// Sabitlenmiş imleç çizgisi (lazily oluşturulur — slot HTML'i değişmez).
function veCursorPinEl(slotIdx, create) {
  var el = document.getElementById('ve-cursor-pin-' + slotIdx);
  if(el || !create) return el;
  var area = document.getElementById('ve-chart-area-' + slotIdx);
  if(!area) return null;
  el = document.createElement('div');
  el.id = 've-cursor-pin-' + slotIdx;
  el.className = 've-chart-cursor-pin';
  el.style.display = 'none';
  el.innerHTML = '<span class="ve-chart-cursor-pin-tag"></span>';
  area.appendChild(el);
  return el;
}

// ── İmleç çizimi ─────────────────────────────────────────────────────────

// Tek bir paneli verilen X değerine kilitler.
//   opts.tooltip : yüzen değer kutusu gösterilsin mi (yalnızca kaynak panel)
//   opts.mouseY  : tooltip'i dikeyde konumlamak için fare Y'si (CSS px)
function veCursorApplyToSlot(slotIdx, xVal, opts) {
  opts = opts || {};
  var g = veCursorGeom(slotIdx);
  if(!g) return false;
  var m = g.meta;

  // Görünür X aralığı dışındaysa bu panelde imleç gösterilmez (panel farklı
  // yakınlaştırılmış olabilir).
  if(xVal < m.xMin || xVal > m.xMax) { veCursorHideSlot(slotIdx); return false; }

  var idx = veCursorSnapIndex(m.timeArr, xVal);
  if(idx < 0) return false;
  var sample = veCursorSample(m, idx);
  if(!sample) return false;

  var crosshair = document.getElementById('ve-crosshair-' + slotIdx);
  var crossV = document.getElementById('ve-crosshair-v-' + slotIdx);
  if(!crosshair || !crossV) return false;

  var snapX = veCursorXToPx(g, sample.x);
  crosshair.style.display = '';
  crosshair.style.width = g.cw + 'px';
  crosshair.style.height = g.ch + 'px';
  crossV.style.left = snapX + 'px';
  crossV.style.top = g.top + 'px';
  crossV.style.height = (g.bottom - g.top) + 'px';

  // Kesişim noktaları
  crosshair.querySelectorAll('.ve-chart-crosshair-dot').forEach(function(d) { d.remove(); });
  var axesInfo = m.axes || [{ yMin: m.yMin, yMax: m.yMax }];
  var plotH = g.bottom - g.top;
  sample.rows.forEach(function(row) {
    if(row.value === null) return;
    var ax = axesInfo[row.axisIdx] || axesInfo[0];
    var valY = g.top + plotH - (row.value - ax.yMin) / (ax.yMax - ax.yMin) * plotH;
    var dot = document.createElement('div');
    dot.className = 've-chart-crosshair-dot';
    dot.style.left = snapX + 'px';
    dot.style.top = valY + 'px';
    dot.style.borderColor = row.color;
    crosshair.appendChild(dot);
  });

  veCursorPaintLegend(slotIdx, sample);

  if(opts.tooltip) {
    veCursorPaintTooltip(slotIdx, g, sample, snapX, opts.mouseY);
  }
  return true;
}

// Yüzen değer kutusu — mevcut tooltip görünümü korunur, sabit imleç varsa
// altına Δ bölümü eklenir.
function veCursorPaintTooltip(slotIdx, g, sample, snapX, mouseY) {
  var tooltip = document.getElementById('ve-tooltip-' + slotIdx);
  if(!tooltip) return;
  var slot = g.slot, m = g.meta;

  var xLabel = 't', xUnit = 's';
  if(slot.xAxis && slot.xAxis.id && slot.xAxis.id !== 'time') {
    xLabel = slot.xAxis.name || 'X';
    xUnit = slot.xAxis.unit || '';
  }

  var html = '<div class="ve-chart-tooltip-head">' + veCursorEsc(xLabel) + ' = ' +
    sample.x.toFixed(3) + (xUnit ? ' ' + veCursorEsc(xUnit) : '') + '</div>';

  sample.rows.forEach(function(row) {
    var axisBadge = '';
    if(m.hasDualAxis && m.axes && m.axes[row.axisIdx]) {
      var axUnit = m.axes[row.axisIdx].unit;
      var axClr = m.axes[row.axisIdx].color || row.color;
      axisBadge = ' <span style="opacity:0.5;font-size:0.5rem;color:' + axClr + ';">[' +
        veCursorEsc(axUnit || ('Y' + (row.axisIdx + 1))) + ']</span>';
    }
    html += '<div class="ve-chart-tooltip-row">';
    if(row.noData) {
      html += '<div class="ve-chart-tooltip-dot" style="background:' + row.color + '; opacity:0.3;"></div>';
      html += '<span style="font-size:0.65rem; opacity:0.5;">' + veCursorEsc(row.name) + '</span>';
      html += '<span class="ve-chart-tooltip-val" style="opacity:0.4;">— veri yok</span>';
    } else {
      html += '<div class="ve-chart-tooltip-dot" style="background:' + row.color + ';"></div>';
      html += '<span style="font-size:0.65rem;">' + veCursorEsc(row.name) + axisBadge + '</span>';
      html += '<span class="ve-chart-tooltip-val">' + veCursorFmt(row.value) +
        ' <span style="opacity:0.5;">' + veCursorEsc(row.unit) + '</span></span>';
    }
    html += '</div>';
  });

  // ── Δ bölümü: sabit referans imleç bu panelde geçerliyse ──
  var refSample = veCursorPinSampleFor(slotIdx);
  if(refSample && refSample.index !== sample.index) {
    var d = veCursorDelta(refSample, sample);
    html += '<div class="ve-chart-tooltip-delta">';
    html += '<div class="ve-chart-tooltip-head" style="margin-top:0;">Δ ' + veCursorEsc(xLabel) +
      ' = ' + veCursorFmtDelta(d.dx) + (xUnit ? ' ' + veCursorEsc(xUnit) : '') + '</div>';
    d.rows.forEach(function(row) {
      if(row.dv === null) return;
      html += '<div class="ve-chart-tooltip-row">';
      html += '<div class="ve-chart-tooltip-dot" style="background:' + row.color + '; opacity:0.55;"></div>';
      html += '<span style="font-size:0.65rem; opacity:0.75;">Δ ' + veCursorEsc(row.name) + '</span>';
      html += '<span class="ve-chart-tooltip-val">' + veCursorFmtDelta(row.dv) +
        ' <span style="opacity:0.5;">' + veCursorEsc(row.unit) + '</span></span>';
      html += '</div>';
    });
    html += '</div>';
  }

  tooltip.innerHTML = html;
  tooltip.classList.add('visible');

  var tw = tooltip.offsetWidth || 160;
  var th = tooltip.offsetHeight || 60;
  var my = (mouseY === null || mouseY === undefined) ? g.ch / 2 : mouseY;
  var tx = snapX + 14;
  var ty = my - th / 2;
  if(tx + tw > g.cw - 4) tx = snapX - tw - 14;
  if(tx < 4) tx = 4;
  if(ty < 4) ty = 4;
  if(ty + th > g.ch - 4) ty = g.ch - th - 4;
  tooltip.style.left = tx + 'px';
  tooltip.style.top = ty + 'px';
}

// Legend rozetlerine imleç konumundaki değeri yazar (CANoe'nun değer sütunu).
function veCursorPaintLegend(slotIdx, sample) {
  var legend = document.getElementById('ve-chart-legend-' + slotIdx);
  if(!legend) return;
  var items = legend.querySelectorAll('.ve-slot-legend-item');
  for(var i = 0; i < items.length; i++) {
    var row = sample ? sample.rows[i] : null;
    var el = items[i].querySelector('.ve-legend-cursor-val');
    if(!row || row.value === null) {
      if(el) el.parentNode.removeChild(el);
      continue;
    }
    if(!el) {
      el = document.createElement('span');
      el.className = 've-legend-cursor-val';
      var rm = items[i].querySelector('.ve-legend-remove');
      if(rm) items[i].insertBefore(el, rm);
      else items[i].appendChild(el);
    }
    el.textContent = veCursorFmt(row.value);
  }
}

function veCursorClearLegend(slotIdx) {
  var legend = document.getElementById('ve-chart-legend-' + slotIdx);
  if(!legend) return;
  legend.querySelectorAll('.ve-legend-cursor-val').forEach(function(el) {
    el.parentNode.removeChild(el);
  });
}

function veCursorHideSlot(slotIdx) {
  var tooltip = document.getElementById('ve-tooltip-' + slotIdx);
  var crosshair = document.getElementById('ve-crosshair-' + slotIdx);
  if(tooltip) tooltip.classList.remove('visible');
  if(crosshair) crosshair.style.display = 'none';
  veCursorClearLegend(slotIdx);
}

// ── Sabitlenmiş referans imleç ───────────────────────────────────────────

// Pin, slot ile aynı X-ekseni kimliğindeyse o slottaki karşılığı.
function veCursorPinSampleFor(slotIdx) {
  if(veCursorState.pinX === null) return null;
  var slot = (typeof veResultSlots !== 'undefined') ? veResultSlots[slotIdx] : null;
  if(!slot || !slot._chartMeta) return null;
  if(veCursorXKey(slot) !== veCursorState.pinKey) return null;
  var m = slot._chartMeta;
  var idx = veCursorSnapIndex(m.timeArr, veCursorState.pinX);
  if(idx < 0) return null;
  return veCursorSample(m, idx);
}

// Sabit imleç çizgisini tek panelde çizer/gizler.
function veCursorPaintPin(slotIdx) {
  var el = veCursorPinEl(slotIdx, veCursorState.pinX !== null);
  if(!el) return;
  var sample = veCursorPinSampleFor(slotIdx);
  var g = sample ? veCursorGeom(slotIdx) : null;
  if(!sample || !g || sample.x < g.meta.xMin || sample.x > g.meta.xMax) {
    el.style.display = 'none';
    return;
  }
  var px = veCursorXToPx(g, sample.x);
  el.style.display = '';
  el.style.left = px + 'px';
  el.style.top = g.top + 'px';
  el.style.height = (g.bottom - g.top) + 'px';
  var tag = el.querySelector('.ve-chart-cursor-pin-tag');
  if(tag) {
    var unit = (g.slot.xAxis && g.slot.xAxis.id && g.slot.xAxis.id !== 'time')
      ? (g.slot.xAxis.unit || '') : 's';
    tag.textContent = 'A · ' + veCursorFmt(sample.x) + (unit ? ' ' + unit : '');
  }
}

function veCursorPaintAllPins() {
  if(typeof veResultSlots === 'undefined') return;
  for(var i = 0; i < veResultSlots.length; i++) veCursorPaintPin(i);
}

// Grafiğe tıklama: imleci sabitle / sabiti kaldır.
function veCursorTogglePin(slotIdx, xVal) {
  var slot = (typeof veResultSlots !== 'undefined') ? veResultSlots[slotIdx] : null;
  if(!slot || !slot._chartMeta) return;
  var key = veCursorXKey(slot);
  var m = slot._chartMeta;
  var idx = veCursorSnapIndex(m.timeArr, xVal);
  if(idx < 0) return;
  var snapped = m.timeArr[idx];

  // Aynı noktaya (aynı örnek) tekrar tıklamak sabiti kaldırır.
  if(veCursorState.pinX !== null && veCursorState.pinKey === key &&
     veCursorSnapIndex(m.timeArr, veCursorState.pinX) === idx) {
    veCursorClearPin();
    return;
  }
  veCursorState.pinX = snapped;
  veCursorState.pinKey = key;
  veCursorPaintAllPins();
  // Δ okuması hemen görünsün
  if(veCursorState.x !== null && veCursorState.srcSlot !== null) {
    veCursorMoveTo(veCursorState.srcSlot, veCursorState.x, veCursorState._mouseY);
  }
  // Δ ölçümü keşfedilebilir olsun, ama her tıklamada bildirim yağmasın:
  // oturumda yalnızca ilk sabitlemede açıklama gösterilir.
  if(!veCursorState._pinHintShown && typeof showToast === 'function') {
    veCursorState._pinHintShown = true;
    showToast('Referans imleç sabitlendi — fare gezdikçe Δ okunur (Esc: kaldır)', 'info');
  }
}

function veCursorClearPin() {
  veCursorState.pinX = null;
  veCursorState.pinKey = null;
  if(typeof veResultSlots !== 'undefined') {
    for(var i = 0; i < veResultSlots.length; i++) {
      var el = veCursorPinEl(i, false);
      if(el) el.style.display = 'none';
    }
  }
  if(veCursorState.x !== null && veCursorState.srcSlot !== null) {
    veCursorMoveTo(veCursorState.srcSlot, veCursorState.x, veCursorState._mouseY);
  }
}

// ── Ana giriş noktaları ──────────────────────────────────────────────────

// İmleci X değerine taşı: kaynak panel + (senkron açıksa) uyumlu paneller.
// Çizim bir sonraki kareye ertelenir: senkron modda tek fare hareketi dört
// panelde ölçüm+yazma yapar; kare başına tek çizim zorunlu reflow sayısını
// mousemove frekansından bağımsız tutar. veChartPlayhead zaten kare başına
// bir kez çağırır — ek gecikme oluşmaz.
var _veCursorRAF = null;
var _veCursorPending = null;

function veCursorMoveTo(srcSlotIdx, xVal, mouseY) {
  veCursorState.x = xVal;
  veCursorState.srcSlot = srcSlotIdx;
  veCursorState._mouseY = (mouseY === undefined) ? null : mouseY;
  _veCursorPending = { slot: srcSlotIdx, x: xVal, y: veCursorState._mouseY };

  if(typeof requestAnimationFrame !== 'function') { veCursorPaintPending(); return; }
  if(_veCursorRAF) return;
  _veCursorRAF = requestAnimationFrame(function() {
    _veCursorRAF = null;
    veCursorPaintPending();
  });
}

function veCursorPaintPending() {
  var p = _veCursorPending;
  _veCursorPending = null;
  if(!p) return;
  // Bekleme sırasında imleç gizlendiyse ya da başka panele geçildiyse çizme
  if(veCursorState.x === null || veCursorState.srcSlot !== p.slot) return;

  var ok = veCursorApplyToSlot(p.slot, p.x, { tooltip: true, mouseY: p.y });
  if(!ok) { veCursorHide(p.slot); return; }

  if(!veCursorState.sync || typeof veResultSlots === 'undefined') return;
  veCursorSyncTargets(veResultSlots, p.slot).forEach(function(i) {
    veCursorApplyToSlot(i, p.x, { tooltip: false });
  });
}

// İmleci gizle. Kaynak panelden çıkıldıysa senkron takipçiler de temizlenir.
function veCursorHide(slotIdx) {
  veCursorHideSlot(slotIdx);
  if(veCursorState.srcSlot === slotIdx) {
    if(veCursorState.sync && typeof veResultSlots !== 'undefined') {
      veCursorSyncTargets(veResultSlots, slotIdx).forEach(veCursorHideSlot);
    }
    veCursorState.x = null;
    veCursorState.srcSlot = null;
  }
}

// veRenderChart sonrası çağrılır: yakınlaştırma/kaydırma sonrasında sabit
// imleç ve (varsa) aktif imleç doğru piksele yeniden oturur.
function veCursorAfterRender(slotIdx) {
  veCursorPaintPin(slotIdx);
  if(veCursorState.x === null) return;
  if(slotIdx === veCursorState.srcSlot) {
    veCursorApplyToSlot(slotIdx, veCursorState.x, { tooltip: true, mouseY: veCursorState._mouseY });
  } else if(veCursorState.sync && typeof veResultSlots !== 'undefined' &&
            veCursorSyncTargets(veResultSlots, veCursorState.srcSlot).indexOf(slotIdx) >= 0) {
    veCursorApplyToSlot(slotIdx, veCursorState.x, { tooltip: false });
  }
}

// ── Senkron açma/kapama ──────────────────────────────────────────────────

function veCursorToggleSync() {
  veCursorState.sync = !veCursorState.sync;
  try { localStorage.setItem(VE_CURSOR_SYNC_KEY, veCursorState.sync ? '1' : '0'); } catch(e) {}
  veCursorSyncButtonRefresh();
  // Senkron kapatıldıysa takipçilerin imleci kalmasın
  if(!veCursorState.sync && typeof veResultSlots !== 'undefined') {
    for(var i = 0; i < veResultSlots.length; i++) {
      if(i !== veCursorState.srcSlot) veCursorHideSlot(i);
    }
  } else if(veCursorState.x !== null && veCursorState.srcSlot !== null) {
    veCursorMoveTo(veCursorState.srcSlot, veCursorState.x, veCursorState._mouseY);
  }
  if(typeof showToast === 'function') {
    showToast(veCursorState.sync ? 'Senkron imleç açık — paneller birlikte okunur'
                                 : 'Senkron imleç kapalı', 'info');
  }
}

function veCursorSyncButtonRefresh() {
  var btn = document.getElementById('ve-cursor-sync-btn');
  if(!btn) return;
  btn.classList.toggle('active', !!veCursorState.sync);
  btn.title = veCursorState.sync
    ? 'Senkron İmleç: AÇIK — aynı X eksenli paneller birlikte okunur (kapatmak için tıklayın)'
    : 'Senkron İmleç: KAPALI — imleç yalnızca fare altındaki panelde';
}

// ── Klavye: ok tuşlarıyla örnek adımlama, Esc ile sabiti kaldır ──────────

function veCursorStep(dir, big) {
  if(veCursorState.srcSlot === null || veCursorState.x === null) return false;
  var slot = (typeof veResultSlots !== 'undefined') ? veResultSlots[veCursorState.srcSlot] : null;
  if(!slot || !slot._chartMeta) return false;
  var m = slot._chartMeta;
  var idx = veCursorSnapIndex(m.timeArr, veCursorState.x);
  if(idx < 0) return false;
  var next = idx + dir * (big ? 10 : 1);
  if(next < 0) next = 0;
  if(next > m.timeArr.length - 1) next = m.timeArr.length - 1;
  if(next === idx) return false;
  veCursorMoveTo(veCursorState.srcSlot, m.timeArr[next], veCursorState._mouseY);
  return true;
}

document.addEventListener('keydown', function(e) {
  if(veCursorState.x === null && veCursorState.pinX === null) return;
  var t = e.target;
  if(t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return;
  if(typeof currentSubTab !== 'undefined' && currentSubTab !== 'sonuclar') return;

  if(e.key === 'Escape') {
    if(veCursorState.pinX !== null) { veCursorClearPin(); e.preventDefault(); }
    return;
  }
  if(e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
    if(veCursorStep(e.key === 'ArrowLeft' ? -1 : 1, e.shiftKey)) e.preventDefault();
  }
});

if(typeof module !== 'undefined' && module.exports) {
  module.exports = {
    veCursorSnapIndex: veCursorSnapIndex,
    veCursorXKey: veCursorXKey,
    veCursorSyncTargets: veCursorSyncTargets,
    veCursorSample: veCursorSample,
    veCursorDelta: veCursorDelta,
    veCursorFmtDelta: veCursorFmtDelta
  };
}
