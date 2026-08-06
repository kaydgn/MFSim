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

// X dizisi ARTAN mı? Sonuç dizinin kendisine göre önbelleklenir: imleç her
// fare hareketinde çağrılıyor ve ölçüm dizileri yüz binlerce örnek olabiliyor,
// her harekette baştan taramak imleci ağırlaştırırdı. WeakMap kullanılıyor ki
// kullanıcı verisine alan eklenmesin ve dizi çöpe gidince kayıt da gitsin.
var _veSnapSortedCache = (typeof WeakMap === 'function') ? new WeakMap() : null;

function veCursorIsSorted(arr) {
  if(_veSnapSortedCache && _veSnapSortedCache.has(arr)) return _veSnapSortedCache.get(arr);
  var ok = true;
  for(var i = 1; i < arr.length; i++) {
    if(arr[i] < arr[i - 1]) { ok = false; break; }
  }
  if(_veSnapSortedCache) _veSnapSortedCache.set(arr, ok);
  return ok;
}

// X değerine en yakın örnek indeksi. Eşitlikte sağdaki örnek seçilir —
// mevcut tooltip davranışıyla birebir aynı.
//
// ARTMAYAN X EKSENİ: pano X eksenini başka bir SİNYALE çevirmeye izin veriyor
// (js/results.js veSetSlotXAxis — "devir–hız" gibi grafikler için). O zaman X
// dizisi artan olmuyor: araç hızlanıp yavaşlayınca hız 0→40→10 gidiyor. İkili
// arama sıralı dizi varsayar ve böyle bir dizide SESSİZCE yanlış örneği
// döndürür — imleç "25 km/h" gösterirken 20 km/h'deki devri okur. Ölçülen
// örnek: [0,20,40,30,10,25] dizisinde x=25 sorulduğunda indeks 1 (değer 20)
// dönüyordu; doğrusu indeks 5.
//
// Çözüm ikili aramayı ATMAK DEĞİL: sıralı durum yaygın (zaman ekseni) ve
// 400 000 örnekte doğrusal tarama imleci hissedilir yavaşlatır. Sıralılık bir
// kez ölçülüp önbelleğe alınıyor, yalnızca artmayan dizide tarama yapılıyor.
function veCursorSnapIndex(arr, x) {
  if(!arr || arr.length === 0) return -1;
  if(!isFinite(x)) return -1;
  if(arr.length === 1) return 0;

  if(!veCursorIsSorted(arr)) {
    var best = 0, bestD = Infinity;
    for(var i = 0; i < arr.length; i++) {
      var d = Math.abs(arr[i] - x);
      // '<=' → eşitlikte SAĞDAKİ kazanır; sıralı yoldaki kuralla aynı.
      if(d <= bestD) { bestD = d; best = i; }
    }
    return isFinite(bestD) ? best : -1;
  }

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
    veCursorIsSorted: veCursorIsSorted,
    veXAxisKeyOf: veXAxisKeyOf,
    veCursorXKey: veCursorXKey,
    veSharedXAxis: veSharedXAxis,
    veSharedXKey: veSharedXKey,
    veXAxisAllowed: veXAxisAllowed,
    veCursorFmt: veCursorFmt,
    veCursorFmtDelta: veCursorFmtDelta
  };
}
