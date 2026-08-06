// ═══════════════════════════════════════════════════════════════════════════
// ÖLÇÜM ÇEKİRDEĞİ — X ekseni kuralı ve örnek kilitleme
// ═══════════════════════════════════════════════════════════════════════════
//
// Sonuç panosunda TEK bir X ekseni geçerlidir. Bu modül o kuralın saf
// çekirdeğidir: bir eksen tanımının kimliğini üretir, panonun geçerli eksenini
// bulur ve yeni bir sinyalin/diyagramın bu eksene girip giremeyeceğine karar
// verir. Ayrıca ölçüm imlecinin en yakın örneğe kilitlenmesi buradadır.
//
// GEÇMİŞ: Bu dosya panel ızgarasının senkron imleç katmanıydı (dört panelde
// tek zaman kafası). Paneller kalkıp yerine tek ölçüm penceresi gelince
// (js/trace-view.js) senkronizasyon KENDİLİĞİNDEN çözüldü — tek yüzeyde
// senkronlanacak ikinci bir yüzey yok. Panele bağlı çizim/DOM katmanı
// kaldırıldı; eksen kuralı ve örnekleme çekirdeği burada kaldı, çünkü
// "hangi sinyal bu pencereye girebilir" sorusu hâlâ geçerli.
//
// Tüketiciler: js/trace-view.js (imleç), js/results.js (eksen devralma,
// sihirbaz diyagramı kilidi).

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

// Bir X ekseni tanımının kimliği. Veri kaynağı (segmentDrive vb.) de kimliğe
// girer — aynı "zaman" adı farklı koşulardan gelirse ayrı alan sayılır.
function veXAxisKeyOf(xAxis, dataSource) {
  var base = (xAxis && xAxis.id) ? xAxis.id : 'time';
  var ds = (xAxis && xAxis._dataSource) ? xAxis._dataSource : (dataSource || '');
  return ds ? (base + '@' + ds) : base;
}

// Bir slotun X ekseni kimliği.
function veCursorXKey(slot) {
  if(!slot) return null;
  return veXAxisKeyOf(slot.xAxis, slot._dataSource);
}

// ── Ortak X ekseni (pano kuralı) ─────────────────────────────────────────
// Sonuç panosunda TEK bir X ekseni geçerlidir: ilk dolu panel onu belirler,
// sonraki bırakmalar ona uymak zorundadır. Bu sayede fare imleci gerçekten
// TÜM paneller için ortak tek bir çizgidir; "bu panel senkronlanmaz" durumu
// hiç oluşmaz. Boş pano = eksen serbest, ilk bırakılan öğe belirler.
//
// 3D scatter paneli muaftır: X/Y/Z üç ayrı sinyalden gelir ve 2B imleç orada
// zaten çalışmaz — ortak eksene zorlamak anlamsız olurdu.

// Panoyu belirleyen eksen. Pano boşsa null (serbest).
function veSharedXAxis(slots) {
  if(!slots) return null;
  for(var i = 0; i < slots.length; i++) {
    var s = slots[i];
    if(!s || !s.sensors || s.sensors.length === 0) continue;
    if((s.type || 'line') === 'scatter3d') continue;
    return { xAxis: s.xAxis || null, dataSource: s._dataSource || '', slotIdx: i };
  }
  return null;
}

function veSharedXKey(slots) {
  var b = veSharedXAxis(slots);
  return b ? veXAxisKeyOf(b.xAxis, b.dataSource) : null;
}

// Verilen X ekseni bu panoya girebilir mi? Pano boşsa her şey uyar.
function veXAxisAllowed(xAxis, dataSource, slots) {
  var key = veSharedXKey(slots);
  if(key === null) return true;
  return veXAxisKeyOf(xAxis, dataSource) === key;
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



if(typeof module !== 'undefined' && module.exports) {
  module.exports = {
    veCursorSnapIndex: veCursorSnapIndex,
    veXAxisKeyOf: veXAxisKeyOf,
    veCursorXKey: veCursorXKey,
    veSharedXAxis: veSharedXAxis,
    veSharedXKey: veSharedXKey,
    veXAxisAllowed: veXAxisAllowed,
    veCursorFmt: veCursorFmt,
    veCursorFmtDelta: veCursorFmtDelta
  };
}
