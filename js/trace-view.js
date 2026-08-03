// ═══════════════════════════════════════════════════════════════════════════════
// İZ PENCERESİ (Trace View) — Vector CANoe "Graphics Window" karşılığı
//
// Sonuçlar sekmesi artık PANEL seçtirmiyor. Tek bir çizim yüzeyi var; Veri
// Gezgini'nde işaretlenen her sinyal bu yüzeyde KENDİ ŞERİDİNE (lane) düşüyor.
// Şeritler alt alta dizili, her birinin kendi Y ekseni var, hepsi alttaki TEK
// zaman eksenini paylaşıyor.
//
// Neden panel değil şerit
// ───────────────────────
//   • Panel düzeni bir SORU soruyordu ("1 mi 2 mi 4 mü?") ve cevabı ölçümden
//     önce vermek gerekiyordu. Kaç sinyale bakacağını baştan bilen yok.
//   • İki sinyal aynı panele girince ortak Y ekseninde eziliyordu: 0–3000 rpm
//     ile 0–100 km/h yan yana çizilince ikincisi düz çizgi oluyordu. Çözüm
//     "ikinci panel açmak"tı — yani göz her karşılaştırmada iki ayrı zaman
//     eksenini eşlemek zorundaydı.
//   • Farklı X eksenli sinyaller (zaman / devir / hız) panel başına ayrı ayrı
//     tutulunca imleç panelden panele kayıyordu. Yüzey tek olunca X ekseni de
//     tek: pencere bir eksende çalışır, şeritler onu paylaşır.
//
// Şerit modeli
// ────────────
// slot.sensors  — sinyal listesinin TEK doğruluk kaynağı (ekleme/çıkarma buraya)
// slot.lanes    — sunum katmanı: hangi sinyaller hangi şeritte, şerit yüksekliği,
//                 elle kilitlenmiş Y sınırları. veTrReconcileLanes() her çizimde
//                 bu listeyi sensors'a göre onarır: listede olmayan sinyal düşer,
//                 şeridi olmayan sinyale yeni şerit açılır. Böylece ağaçtaki onay
//                 kutusu, sürükle-bırak ve lejant ✕ ayrı ayrı ele alınmaz.
//
// Bu dosyadaki saf yardımcılar (uzlaştırma, ayrık tespiti, aralık, geometri,
// örnekleme) Jest'te doğrudan test edilir; DOM/canvas'a dokunanlar tarayıcıda
// çalışır.
// ═══════════════════════════════════════════════════════════════════════════════

// Sonuç panosu TEK yüzeydir. veResultSlots dizisi eski kayıt dosyalarıyla
// uyum için 4 uzunlukta kalır ama yalnızca bu indeks kullanılır.
var VE_BOARD = 0;

var veTrState = {
  xMin: null,        // görünüm penceresi (null → verinin tamamı)
  xMax: null,
  cursorX: null,     // fare imleci (X değeri)
  pinX: null,        // sabitlenmiş referans imleç (Δ ölçümü)
  hoverLane: -1,
  drag: null,        // { kind:'reorder'|'resize'|'pan', ... }
  geo: null,         // son çizimin geometrisi (hit-test için)
  mode: 'trace'      // 'trace' | 'table' | 'scatter3d'
};

// ── Sabitler ─────────────────────────────────────────────────────────────────

var VE_TR = {
  LANE_GAP: 7,        // şeritler arası boşluk
  LANE_MIN_H: 54,     // şerit taban yüksekliği — altına inince eğri okunmuyor
  LANE_DEF_H: 96,     // şerit tercih edilen yüksekliği
  PAD_TOP: 8,
  PAD_BOTTOM: 8,
  PAD_RIGHT: 14,
  TITLE_BAND: 17,     // döndürülmüş şerit başlığının şeridi
  GUTTER_MIN: 62,
  GUTTER_MAX: 132,
  AXIS_H: 30,         // alttaki sabit zaman ekseni canvas'ının yüksekliği
  FONT: '-apple-system,system-ui,Segoe UI,sans-serif'
};

// ── Saf çekirdek: kimlik ve uzlaştırma ───────────────────────────────────────

// Sinyalin şerit listesindeki anahtarı. sensorId ':' içerebildiği için
// ayraç olarak veride bulunmayan NUL kullanılır.
function veTrKey(sensorId, signalId) {
  return String(sensorId == null ? '' : sensorId) + '\u0000' +
         String(signalId == null ? '' : signalId);
}

// Şerit listesini sinyal listesine göre onarır. sensors TEK doğruluk kaynağıdır:
//   • listede olmayan sinyal şeritten düşer, şerit boşalırsa şerit de düşer
//   • aynı sinyal iki şeritte görünemez (ilk şerit kazanır)
//   • hiçbir şeritte olmayan sinyale, sensors sırasında yeni şerit açılır
// Böylece sinyal ekleyen/çıkaran her yol (onay kutusu, sürükleme, lejant ✕,
// grup seçimi, proje yükleme) ayrı ayrı ele alınmak zorunda kalmaz.
function veTrReconcileLanes(sensors, lanes) {
  sensors = sensors || [];
  var known = {};
  sensors.forEach(function(s) { known[veTrKey(s.id, s.signal)] = true; });

  var placed = {};
  var out = [];

  (lanes || []).forEach(function(L) {
    var ids = [];
    (L && L.ids ? L.ids : []).forEach(function(k) {
      if(!known[k] || placed[k]) return;
      placed[k] = true;
      ids.push(k);
    });
    if(!ids.length) return;
    out.push({
      ids: ids,
      h: (L && isFinite(L.h) && L.h > 0) ? L.h : VE_TR.LANE_DEF_H,
      min: (L && isFinite(L.min)) ? L.min : null,
      max: (L && isFinite(L.max)) ? L.max : null
    });
  });

  sensors.forEach(function(s) {
    var k = veTrKey(s.id, s.signal);
    if(placed[k]) return;
    placed[k] = true;
    out.push({ ids: [k], h: VE_TR.LANE_DEF_H, min: null, max: null });
  });

  return out;
}

// ── Saf çekirdek: ayrık (basamaklı) sinyaller ────────────────────────────────

// Meta verisinden ayrık olduğu KESİN olan sinyaller (js/components.js
// COMPONENT_SIGNALS). Bunlar seyrek örneklenirse veriden anlaşılamayabilir,
// bu yüzden ad üzerinden de tanınırlar.
var VE_TR_DISCRETE_IDS = {
  gear: 1, current_gear: 1, gear_mode: 1, lockup_state: 1
};

// Sinyal basamaklı mı çizilmeli? Ölçüm yazılımında vites/lockup gibi durum
// sinyalleri ARA DEĞER ALMAZ: 3. vitesten 4'e geçiş 3.5'ten geçmez. Bunları
// düz çizgiyle bağlamak var olmayan bir geçişi çizer.
//
// Karar üç kaynaktan: bilinen sinyal id'si, '0/1' birimi, ve verinin kendisi
// (yalnız tam sayı + az sayıda ayrı seviye). Veri temelli kural, sihirbazın
// ürettiği isimsiz kanalları da yakalar.
function veTrIsDiscrete(signalId, unit, series) {
  if(VE_TR_DISCRETE_IDS[signalId]) return true;
  // '0/1' ikili durum, '#' sayaç (etkin segment no) — ikisi de ara değer almaz.
  // Bunları veriden çıkarmak yetmiyor: tek segmentli bir koşuda seviye sayısı
  // 1'de kalır ve aşağıdaki veri kuralı sürekli sanır.
  if(unit === '0/1' || unit === '#') return true;
  if(!series || series.length < 3) return false;

  var seen = {}, levels = 0, finite = 0;
  for(var i = 0; i < series.length; i++) {
    var v = series[i];
    if(!isFinite(v)) continue;
    finite++;
    if(Math.abs(v - Math.round(v)) > 1e-9) return false;   // kesirli → sürekli
    if(!seen[v]) { seen[v] = 1; levels++; if(levels > 12) return false; }
  }
  return finite >= 3 && levels >= 2;
}

// Ayrık sinyalin seviye etiketi. CANoe'nun DBC değer tablosunun karşılığı;
// burada tablo yok, bilinen sinyaller için elle yazılı.
var VE_TR_STATE_LABELS = {
  lockup_state: { '0': 'Lockup açık', '1': 'Lockup kilitli' }
};

function veTrStateLabel(signalId, v) {
  var tbl = VE_TR_STATE_LABELS[signalId];
  if(tbl && Object.prototype.hasOwnProperty.call(tbl, String(v))) return tbl[String(v)];
  if(signalId === 'gear' || signalId === 'current_gear') {
    if(v === 0) return 'Boş';
    if(v < 0) return 'Geri' + (v === -1 ? '' : ' ' + (-v));
    return v + '. vites';
  }
  return null;
}

// Metin değerli kanal — CANoe'nun "durum şeridi" (state lane) karşılığı.
//
// Vites modu '1C'/'2L' gibi kanallar SAYI DEĞİL METİN üretiyor (js/graphics.js
// r.gearMode). Sayısal eksende bunların tamamı NaN'dır: şerit boş çizilir ve
// kullanıcı verinin olmadığını sanır. Doğrusu CANoe'nun yaptığı: ayrı metinler
// seviyelere eşlenir, Y ekseninde sayı yerine METNİN KENDİSİ yazılır.
//
// Eşleme ALFABETİK — ilk görülme sırasına göre olsaydı aynı koşu farklı bir
// zaman aralığında açıldığında seviyeler yer değiştirir, iki ekran görüntüsü
// karşılaştırılamazdı.
function veTrEncodeText(series) {
  if(!series || !series.length) return null;
  var hasText = false, seen = {}, labels = [], i, v, key;
  for(i = 0; i < series.length; i++) {
    v = series[i];
    if(v === null || v === undefined || v === '') continue;
    key = String(v);
    if(!(typeof v === 'number' || isFinite(Number(v)))) hasText = true;
    if(!Object.prototype.hasOwnProperty.call(seen, key)) {
      seen[key] = 1;
      labels.push(key);
      if(labels.length > 16) return null;   // seviye değil, serbest metin
    }
  }
  if(!hasText || labels.length < 1) return null;

  labels.sort();
  var idx = {};
  labels.forEach(function(l, k) { idx[l] = k; });

  var data = new Array(series.length);
  for(i = 0; i < series.length; i++) {
    v = series[i];
    key = (v === null || v === undefined) ? null : String(v);
    data[i] = (key !== null && Object.prototype.hasOwnProperty.call(idx, key)) ? idx[key] : NaN;
  }
  return { data: data, labels: labels };
}

// ── Saf çekirdek: aralık ve geometri ─────────────────────────────────────────

function veTrExtent(series) {
  if(!series || !series.length) return null;
  var mn = Infinity, mx = -Infinity, any = false;
  for(var i = 0; i < series.length; i++) {
    var v = series[i];
    if(!isFinite(v)) continue;
    any = true;
    if(v < mn) mn = v;
    if(v > mx) mx = v;
  }
  return any ? { min: mn, max: mx } : null;
}

// Şeridin Y aralığı. Ayrık sinyalde yarım basamak boşluk bırakılır — yoksa en
// üst ve en alt seviye şeridin kenarına yapışıp okunmaz olur. Sabit seride
// (min === max) simetrik bir bant açılır, aksi halde sıfıra bölme çıkar.
function veTrLaneRange(min, max, discrete) {
  if(!isFinite(min) || !isFinite(max)) return { min: 0, max: 1 };
  if(min === max) {
    var d = Math.abs(min) > 1 ? Math.abs(min) * 0.1 : 0.5;
    return { min: min - d, max: min + d };
  }
  if(discrete) return { min: min - 0.5, max: max + 0.5 };
  var pad = (max - min) * 0.08;
  return { min: min - pad, max: max + pad };
}

// Şerit dikdörtgenleri. Yükseklikler piksel cinsinden saklanır (kullanıcı
// ayırıcıyı sürükleyince doğrudan bu değer değişir). Kullanılabilir alan
// yetiyorsa şeritler ORANTILI büyütülür — üç sinyalde ekranın yarısı boş
// kalmaz. Yetmiyorsa yüzey uzar ve kapsayıcı kaydırılır.
function veTrLaneRects(heights, top, avail, gap, minH) {
  var n = heights.length;
  if(!n) return [];
  var gapTotal = gap * (n - 1);
  var want = 0, i;
  var hs = [];
  for(i = 0; i < n; i++) {
    var h = (isFinite(heights[i]) && heights[i] > 0) ? heights[i] : VE_TR.LANE_DEF_H;
    hs.push(Math.max(minH, h));
    want += hs[i];
  }
  var room = avail - gapTotal;
  if(room > want && want > 0) {
    var k = room / want;
    for(i = 0; i < n; i++) hs[i] = Math.max(minH, hs[i] * k);
  }
  var rects = [], y = top;
  for(i = 0; i < n; i++) {
    rects.push({ y: Math.round(y), h: Math.max(minH, Math.round(hs[i])) });
    y += hs[i] + gap;
  }
  return rects;
}

// Şeridin CANoe tarzı başlığı: "Bileşen::Sinyal [birim]".
// Uygulamadaki ad "Motor — Motor Devri" biçiminde; ayraç '::' yapılır.
function veTrLaneTitle(sensor) {
  if(!sensor) return '';
  var n = String(sensor.name == null ? '' : sensor.name).replace(/\s+—\s+/, '::');
  var u = sensor.unit ? String(sensor.unit) : '';
  return u ? (n + ' [' + u + ']') : n;
}

// ── Saf çekirdek: örnekleme ──────────────────────────────────────────────────

// Örnek kilitleme js/measure-core.js'te (veCursorSnapIndex): imlecin en yakın
// örneğe oturması ölçüm çekirdeğinin işi, iki ayrı kopyası olmamalı.
function veTrSnapIndex(arr, x) {
  return (typeof veCursorSnapIndex === 'function') ? veCursorSnapIndex(arr, x) : -1;
}

// İmleç okuması ve durum çubuğu için birim ekli değer. Sayı biçimi ölçüm
// çekirdeğinden gelir — grafik, tablo ve imleç aynı sayıyı aynı yazmalı.
function veTrFmt(v, unit) {
  if(v == null || !isFinite(Number(v))) return '—';
  var s = (typeof veCursorFmt === 'function') ? veCursorFmt(Number(v)) : String(v);
  return unit ? (s + ' ' + unit) : s;
}

// İşaretli fark (Δ okuması) — yine ölçüm çekirdeğinden.
function veTrFmtDelta(v) {
  return (typeof veCursorFmtDelta === 'function') ? veCursorFmtDelta(v) : String(v);
}

// ── Veri erişimi ─────────────────────────────────────────────────────────────

// Çizim başına bir kez toplanır; aynı sinyal iki şeritte olsa bile veri bir kez
// okunur. veGetSensorData her çağrıda diziyi yeniden kurabildiği için önbellek
// çizimden çizime taşınmaz.
var veTrCache = null;

function veTrResetCache() { veTrCache = null; }

function veTrSeries(sensorId, signalId, dataSource) {
  if(!veTrCache) veTrCache = {};
  var k = veTrKey(sensorId, signalId) + '\u0000' + (dataSource || '');
  if(Object.prototype.hasOwnProperty.call(veTrCache, k)) return veTrCache[k];
  var d = null;
  try {
    if(typeof veGetSensorData === 'function') d = veGetSensorData(sensorId, signalId, dataSource);
  } catch(e) { d = null; }
  veTrCache[k] = (d && d.length) ? d : null;
  return veTrCache[k];
}

// Pencerenin X ekseni dizisi. Panel mimarisindeki çözümün aynısı, tek fark
// artık pano başına DEĞİL pencere başına tek eksen olması.
function veTrResolveX(slot) {
  var r = window.veSimResults;
  var arr = null;
  var ds = slot._dataSource || null;
  var xds = (slot.xAxis && slot.xAxis._dataSource) ? slot.xAxis._dataSource : ds;

  if(slot.xAxis && slot.xAxis.id && slot.xAxis.id !== 'time') {
    var id = slot.xAxis.id;
    if(id.charAt(0) === '~') {
      var p = id.substring(1).split(':');
      arr = veTrSeries('~' + p[0], p.slice(1).join(':'), xds);
    } else {
      var c = id.indexOf(':');
      if(c > 0) arr = veTrSeries(id.substring(0, c), id.substring(c + 1), xds);
    }
  }

  if(!arr) {
    if(ds === 'segmentDrive' && r && r.segmentDrive && r.segmentDrive.time) {
      arr = r.segmentDrive.time;
    } else if(typeof veActiveSolverTabId !== 'undefined' && veActiveSolverTabId === 'obstacle' &&
              r && r.obstacleDynamic && r.obstacleDynamic.log && r.obstacleDynamic.log.length > 1) {
      arr = r.obstacleDynamic.log.map(function(e) { return e.t; });
    } else {
      arr = (r && r.time) ? r.time : null;
    }
  }

  // Çapraz sekme sinyali varsa en uzun zaman dizisi kazanır (panel mimarisinden
  // devralınan davranış — kısa dizi uzun sinyali kırpıyordu).
  (slot.sensors || []).forEach(function(s) {
    if(String(s.id).charAt(0) !== '@') return;
    var ti = parseInt(String(s.id).substring(1).split(':')[0], 10);
    var tab = (typeof veTabs !== 'undefined') ? veTabs[ti] : null;
    var tr = (tab && tab.state && tab.state.simResults) ? tab.state.simResults : null;
    if(tr && tr.time && (!arr || tr.time.length > arr.length)) arr = tr.time;
  });

  return arr;
}

// ── Panonun taşınabilir kopyası ──────────────────────────────────────────────

// Kaydedilen/yedeklenen alanlar. Beyaz liste, kara liste değil: çizimden doğan
// geçici alanlar (geometri, önbellek, RAF tutamakları) ileride eklenirse
// kendiliğinden dışarıda kalır. Aksi hâlde bir gün diske canvas geometrisi
// yazılır ve dosya boyutu sessizce şişer.
var VE_TR_SLOT_KEYS = ['sensors', 'lanes', 'xAxis', 'type', '_dataSource', 'yAxisLock', 'zAxis'];

function veTrCloneSlot(s) {
  var out = {};
  if(!s) return out;
  VE_TR_SLOT_KEYS.forEach(function(k) {
    if(s[k] === undefined) return;
    try { out[k] = JSON.parse(JSON.stringify(s[k])); } catch(e) {}
  });
  return out;
}

function veTrCloneBoard(slots) {
  return (slots || []).map(veTrCloneSlot);
}

// ── Şerit modeli kurulumu ────────────────────────────────────────────────────

function veTrBoard() {
  if(typeof veResultSlots === 'undefined') return null;
  var slot = veResultSlots[VE_BOARD];
  if(!slot) { slot = veResultSlots[VE_BOARD] = {}; }
  if(!slot.sensors) slot.sensors = [];
  if(!slot.type) slot.type = 'line';
  return slot;
}

function veTrSensorAt(slot, key) {
  var list = slot.sensors || [];
  for(var i = 0; i < list.length; i++) {
    if(veTrKey(list[i].id, list[i].signal) === key) return { s: list[i], i: i };
  }
  return null;
}

// Çizime hazır şerit tanımları: veri, aralık, renk, başlık.
function veTrBuildLanes(slot) {
  slot.lanes = veTrReconcileLanes(slot.sensors, slot.lanes);
  var ds = slot._dataSource || null;

  return slot.lanes.map(function(L) {
    var sigs = [];
    var levels = null;
    L.ids.forEach(function(k) {
      var hit = veTrSensorAt(slot, k);
      if(!hit) return;
      var series = veTrSeries(hit.s.id, hit.s.signal, hit.s._dataSource || ds);
      var enc = veTrEncodeText(series);
      if(enc) { series = enc.data; if(!levels) levels = enc.labels; }
      sigs.push({
        key: k,
        idx: hit.i,
        sensor: hit.s,
        series: series,
        color: (typeof veSlotSignalColor === 'function')
          ? veSlotSignalColor(slot, hit.i)
          : '#3b82f6',
        discrete: !!enc || veTrIsDiscrete(hit.s.signal, hit.s.unit, series)
      });
    });

    var mn = Infinity, mx = -Infinity, anyData = false, allDiscrete = sigs.length > 0;
    sigs.forEach(function(g) {
      if(!g.discrete) allDiscrete = false;
      var e = veTrExtent(g.series);
      if(!e) return;
      anyData = true;
      if(e.min < mn) mn = e.min;
      if(e.max > mx) mx = e.max;
    });

    var range = anyData ? veTrLaneRange(mn, mx, allDiscrete) : { min: 0, max: 1 };
    if(L.min != null && isFinite(L.min)) range.min = L.min;
    if(L.max != null && isFinite(L.max)) range.max = L.max;
    if(range.max <= range.min) range.max = range.min + 1;

    return {
      def: L,
      sigs: sigs,
      unit: sigs.length ? (sigs[0].sensor.unit || '') : '',
      title: sigs.length
        ? (veTrLaneTitle(sigs[0].sensor) + (sigs.length > 1 ? ' +' + (sigs.length - 1) : ''))
        : '',
      color: sigs.length ? sigs[0].color : '#888',
      discrete: allDiscrete,
      levels: levels,
      hasData: anyData,
      locked: (L.min != null || L.max != null),
      yMin: range.min,
      yMax: range.max
    };
  });
}

// ── Geometri ─────────────────────────────────────────────────────────────────

// Şeridin Y tick adımı. Ayrık sinyalde adım TAM SAYIdır: 3. ve 4. vitesin
// arasına "3.5" yazmak, olmayan bir seviyeyi varmış gibi gösterir.
function veTrLaneStep(lane, px) {
  var span = lane.yMax - lane.yMin;
  var count = Math.max(2, Math.min(6, Math.floor(px / 22)));
  var step = (typeof veNiceStep === 'function')
    ? veNiceStep(span / count)
    : Math.pow(10, Math.floor(Math.log(span / count) / Math.LN10));
  if(lane.discrete) step = Math.max(1, Math.round(step));
  return step > 0 ? step : 1;
}

// Görünüm penceresi. Kullanıcı yakınlaştırmadıysa verinin tamamı.
function veTrXView(timeArr) {
  var dMin = (timeArr && timeArr.length) ? timeArr[0] : 0;
  var dMax = (timeArr && timeArr.length) ? timeArr[timeArr.length - 1] : 1;
  if(!(dMax > dMin)) dMax = dMin + 1;
  var xMin = (veTrState.xMin == null) ? dMin : veTrState.xMin;
  var xMax = (veTrState.xMax == null) ? dMax : veTrState.xMax;
  if(!(xMax > xMin)) { xMin = dMin; xMax = dMax; }
  return { xMin: xMin, xMax: xMax, dataMin: dMin, dataMax: dMax };
}

// Yerleşim: sol oluk genişliği ETİKETLERDEN doğar. Sabit bir oluk ya rpm'de
// taşar ya yüzde'de boşluk bırakırdı; burada en geniş tick etiketi ölçülür.
function veTrGeometry(ctx, lanes, view, w, availH) {
  ctx.font = '9.5px ' + VE_TR.FONT;
  var maxLabel = 0;
  var measure = function(t) {
    var tw = ctx.measureText(String(t)).width;
    if(tw > maxLabel) maxLabel = tw;
  };
  lanes.forEach(function(lane) {
    if(lane.levels) { lane.levels.forEach(measure); return; }
    var step = veTrLaneStep(lane, VE_TR.LANE_DEF_H);
    var dec = (typeof veAxisDecimals === 'function') ? veAxisDecimals(step) : 2;
    [lane.yMin, lane.yMax].forEach(function(v) {
      measure((typeof veFormatAxisVal === 'function') ? veFormatAxisVal(v, dec) : v);
    });
  });

  var gutter = Math.max(VE_TR.GUTTER_MIN,
                Math.min(VE_TR.GUTTER_MAX, VE_TR.TITLE_BAND + maxLabel + 14));

  var heights = lanes.map(function(lane) { return lane.def.h; });
  var rects = veTrLaneRects(heights, VE_TR.PAD_TOP,
                            availH - VE_TR.PAD_TOP - VE_TR.PAD_BOTTOM,
                            VE_TR.LANE_GAP, VE_TR.LANE_MIN_H);

  var last = rects.length ? rects[rects.length - 1] : { y: VE_TR.PAD_TOP, h: 0 };
  var surface = Math.max(availH, last.y + last.h + VE_TR.PAD_BOTTOM);

  return {
    gutter: gutter,
    plotX: gutter,
    plotW: Math.max(20, w - gutter - VE_TR.PAD_RIGHT),
    w: w,
    surface: surface,
    rects: rects,
    xMin: view.xMin,
    xMax: view.xMax,
    dataMin: view.dataMin,
    dataMax: view.dataMax
  };
}

function veTrXPos(geo, t) {
  return geo.plotX + (t - geo.xMin) / (geo.xMax - geo.xMin) * geo.plotW;
}

function veTrXVal(geo, px) {
  return geo.xMin + (px - geo.plotX) / geo.plotW * (geo.xMax - geo.xMin);
}

function veTrYPos(lane, rect, v) {
  return rect.y + rect.h - (v - lane.yMin) / (lane.yMax - lane.yMin) * rect.h;
}

// ── Çizim: eğri ──────────────────────────────────────────────────────────────

// Yoğun seride PİKSEL BAŞINA min/max zarfı çizilir. Atlamalı örnekleme
// (her k'ıncı örneği al) kısa tepe ve çukurları düşürüyordu: 20 000 örnek
// 600 piksele sığdırılırken 33 örnekten 32'si atlanıyor, vites geçişindeki
// tork çukuru grafikte hiç görünmüyordu. Zarf, sütunun ilk/min/maks/son
// değerlerini sırayla bağlar — hem süreklilik hem uç değerler korunur.
function veTrStrokeSeries(ctx, geo, lane, rect, series, timeArr, discrete) {
  var n = Math.min(series.length, timeArr.length);
  if(n < 1) return;

  var i, x, y, v, t;
  var started = false, prevY = 0;

  if(discrete || n <= geo.plotW * 2) {
    ctx.beginPath();
    for(i = 0; i < n; i++) {
      t = timeArr[i]; v = series[i];
      if(!isFinite(t) || !isFinite(v)) { started = false; continue; }
      if(t < geo.xMin - 1e-9 || t > geo.xMax + 1e-9) {
        // Pencere dışı örnek atlanır ama kalemi kaldırmaz: kenardan giren
        // eğrinin ilk parçası kesilmesin diye clip'e bırakılır.
      }
      x = veTrXPos(geo, t); y = veTrYPos(lane, rect, v);
      if(!started) { ctx.moveTo(x, y); started = true; }
      else if(discrete) { ctx.lineTo(x, prevY); ctx.lineTo(x, y); }
      else ctx.lineTo(x, y);
      prevY = y;
    }
    ctx.stroke();
    return;
  }

  // Zarf yolu
  ctx.beginPath();
  var col = -1, cMin = 0, cMax = 0, cFirst = 0, cLast = 0, have = false;
  for(i = 0; i < n; i++) {
    t = timeArr[i]; v = series[i];
    if(!isFinite(t) || !isFinite(v)) continue;
    x = veTrXPos(geo, t);
    var c = Math.round(x);
    if(c !== col) {
      if(have) {
        if(!started) { ctx.moveTo(col, cFirst); started = true; }
        else ctx.lineTo(col, cFirst);
        ctx.lineTo(col, cMin);
        ctx.lineTo(col, cMax);
        ctx.lineTo(col, cLast);
      }
      col = c; cMin = cMax = cFirst = cLast = veTrYPos(lane, rect, v); have = true;
    } else {
      y = veTrYPos(lane, rect, v);
      if(y < cMin) cMin = y;
      if(y > cMax) cMax = y;
      cLast = y;
    }
  }
  if(have) {
    if(!started) ctx.moveTo(col, cFirst); else ctx.lineTo(col, cFirst);
    ctx.lineTo(col, cMin); ctx.lineTo(col, cMax); ctx.lineTo(col, cLast);
  }
  ctx.stroke();
}

// Şerit başlığı dar şeride sığmıyorsa ÖNCE bileşen öneki düşer, sonra kısaltılır.
// Harf harf kesmek "[SW] Şanzıman Kont…" gibi bir başlık üretiyordu: en ayırt
// edici parça (sinyalin adı) tamamen kayboluyor, yedi şeridin beşi aynı
// görünüyordu. Sinyal adı bileşen adından daha çok bilgi taşır.
function veTrFitTitle(ctx, title, maxW) {
  var t = String(title == null ? '' : title);
  if(ctx.measureText(t).width <= maxW) return t;

  var sep = t.lastIndexOf('::');
  if(sep >= 0) {
    var shortT = t.slice(sep + 2);
    if(ctx.measureText(shortT).width <= maxW) return shortT;
    t = shortT;
  }
  while(t.length > 3 && ctx.measureText(t + '…').width > maxW) t = t.slice(0, -1);
  return t + '…';
}

// ── Çizim: tek şerit ─────────────────────────────────────────────────────────

function veTrDrawLane(ctx, geo, lane, rect, idx, timeArr, xTicks) {
  var x0 = geo.plotX, y0 = rect.y, pw = geo.plotW, ph = rect.h;

  // Zemin — düz, çok hafif. Ölçüm penceresinde şeridin zemini bir yüzeydir,
  // vurgu değil: gradyan iki eğriyi farklı zeminde okutur.
  ctx.fillStyle = 'rgba(128,128,128,0.045)';
  ctx.fillRect(x0, y0, pw, ph);

  // Y ızgarası + etiketler
  var step = veTrLaneStep(lane, ph);
  var dec = (typeof veAxisDecimals === 'function') ? veAxisDecimals(step) : 2;
  var start = Math.ceil(lane.yMin / step) * step;
  var v, gy;

  ctx.font = '9.5px ' + VE_TR.FONT;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'right';

  for(v = start; v <= lane.yMax + step * 0.001; v += step) {
    gy = veTrYPos(lane, rect, v);
    if(gy < y0 - 0.5 || gy > y0 + ph + 0.5) continue;

    ctx.strokeStyle = 'rgba(128,128,128,0.16)';
    ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);
    ctx.beginPath(); ctx.moveTo(x0, gy); ctx.lineTo(x0 + pw, gy); ctx.stroke();
    ctx.setLineDash([]);

    ctx.strokeStyle = lane.color;
    ctx.globalAlpha = 0.55;
    ctx.beginPath(); ctx.moveTo(x0 - 3, gy); ctx.lineTo(x0, gy); ctx.stroke();
    ctx.globalAlpha = 1;

    ctx.fillStyle = lane.color;
    var lbl;
    if(lane.levels) {
      // Metin şeridi: eksende sayı değil seviyenin adı okunur
      var lv = Math.round(v);
      lbl = (Math.abs(v - lv) < 1e-9 && lane.levels[lv] !== undefined) ? lane.levels[lv] : '';
    } else if(lane.discrete) {
      lbl = String(Math.round(v));
    } else {
      lbl = (typeof veFormatAxisVal === 'function') ? veFormatAxisVal(v, dec) : String(v);
    }
    if(lbl !== '') ctx.fillText(lbl, x0 - 6, gy);
  }

  // X ızgarası
  ctx.strokeStyle = 'rgba(128,128,128,0.16)';
  ctx.lineWidth = 1;
  ctx.setLineDash([3, 3]);
  xTicks.forEach(function(t) {
    var gx = veTrXPos(geo, t);
    if(gx < x0 - 0.5 || gx > x0 + pw + 0.5) return;
    ctx.beginPath(); ctx.moveTo(gx, y0); ctx.lineTo(gx, y0 + ph); ctx.stroke();
  });
  ctx.setLineDash([]);

  // Eğriler
  ctx.save();
  ctx.beginPath(); ctx.rect(x0, y0, pw, ph); ctx.clip();
  ctx.lineJoin = 'round'; ctx.lineCap = 'butt';
  lane.sigs.forEach(function(g) {
    if(!g.series || !timeArr) return;
    ctx.strokeStyle = g.color;
    ctx.lineWidth = 1.35;
    veTrStrokeSeries(ctx, geo, lane, rect, g.series, timeArr, g.discrete);
  });
  ctx.restore();

  // Ayrık sinyalde seviye adları — CANoe'nun "Shift in process /
  // Shift is not in process" okuması. Sayı tek başına 0/1'in ne demek
  // olduğunu söylemiyor.
  if(lane.discrete && lane.sigs.length === 1 && lane.hasData) {
    var g0 = lane.sigs[0];
    var e = veTrExtent(g0.series);
    if(e) {
      ctx.font = '9px ' + VE_TR.FONT;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = g0.color;
      ctx.globalAlpha = 0.85;
      [e.max, e.min].forEach(function(lv) {
        var lab = veTrStateLabel(g0.sensor.signal, lv);
        if(!lab) return;
        var ly = veTrYPos(lane, rect, lv);
        ctx.fillText(lab, x0 + 5, ly + (lv === e.max ? 7 : -7));
      });
      ctx.globalAlpha = 1;
    }
  }

  // Çerçeve
  ctx.strokeStyle = 'rgba(128,128,128,0.42)';
  ctx.lineWidth = 1;
  ctx.strokeRect(x0 + 0.5, y0 + 0.5, pw - 1, ph - 1);

  // Döndürülmüş şerit başlığı — CANoe'da eksen adı dikey yazılır: ad ne kadar
  // uzun olursa olsun oluk genişliğini büyütmez.
  ctx.save();
  ctx.translate(VE_TR.TITLE_BAND - 5, y0 + ph / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.font = '600 9.5px ' + VE_TR.FONT;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = lane.color;
  ctx.fillText(veTrFitTitle(ctx, lane.title, ph - 6), 0, 0);
  ctx.restore();

  // Veri yoksa şerit boş kalmasın: neden boş olduğunu söylesin
  if(!lane.hasData) {
    ctx.font = '10px ' + VE_TR.FONT;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = 'rgba(128,128,128,0.75)';
    ctx.fillText('veri yok — önce çözümü çalıştırın', x0 + pw / 2, y0 + ph / 2);
  }

  // Kilit rozeti (elle Y sınırı)
  if(lane.locked) {
    ctx.font = '8.5px ' + VE_TR.FONT;
    ctx.textAlign = 'right'; ctx.textBaseline = 'top';
    ctx.fillStyle = lane.color;
    ctx.globalAlpha = 0.8;
    ctx.fillText('kilitli', x0 + pw - 5, y0 + 4);
    ctx.globalAlpha = 1;
  }
}

// ── Çizim: zaman ekseni (alta sabit) ─────────────────────────────────────────

function veTrTimeTicks(geo) {
  var span = geo.xMax - geo.xMin;
  var count = Math.max(3, Math.min(14, Math.floor(geo.plotW / 78)));
  var step = (typeof veNiceStep === 'function')
    ? veNiceStep(span / count)
    : span / count;
  if(!(step > 0)) step = span / Math.max(1, count);
  var ticks = [];
  var v = Math.ceil(geo.xMin / step) * step;
  // Kayan nokta birikimini engellemek için tick'ler ÇARPARAK üretilir:
  // v += step döngüsü 0.1 adımda 47 tick sonra 0.30000000000000004 yazıyordu.
  var k0 = Math.round(v / step);
  for(var k = k0; ; k++) {
    var t = k * step;
    if(t > geo.xMax + step * 0.001) break;
    ticks.push(t);
    if(ticks.length > 200) break;
  }
  return { ticks: ticks, step: step,
           dec: (typeof veAxisDecimals === 'function') ? veAxisDecimals(step) : 2 };
}

function veTrDrawAxis(geo, tick, axisName) {
  var cv = document.getElementById('ve-trace-axis');
  if(!cv) return;
  var w = geo.w, h = VE_TR.AXIS_H;
  var dpr = window.devicePixelRatio || 1;
  cv.width = Math.max(1, Math.round(w * dpr));
  cv.height = Math.max(1, Math.round(h * dpr));
  cv.style.width = w + 'px';
  cv.style.height = h + 'px';

  var ctx = cv.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);

  // Üst çerçeve — şeritlerin oturduğu taban
  ctx.strokeStyle = 'rgba(128,128,128,0.42)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(geo.plotX, 0.5);
  ctx.lineTo(geo.plotX + geo.plotW, 0.5);
  ctx.stroke();

  ctx.font = '10px ' + VE_TR.FONT;
  ctx.fillStyle = 'rgba(140,140,155,0.95)';
  ctx.strokeStyle = 'rgba(140,140,155,0.6)';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';

  tick.ticks.forEach(function(t) {
    var gx = veTrXPos(geo, t);
    if(gx < geo.plotX - 1 || gx > geo.plotX + geo.plotW + 1) return;
    ctx.beginPath(); ctx.moveTo(gx, 1); ctx.lineTo(gx, 5); ctx.stroke();
    var lbl = (typeof veFormatAxisVal === 'function')
      ? veFormatAxisVal(t, tick.dec) : String(t);
    ctx.fillText(lbl, gx, 7);
  });

  // Eksen adı sağ uçta — CANoe'da "[s]" burada durur
  ctx.textAlign = 'right';
  ctx.fillStyle = 'rgba(140,140,155,0.95)';
  ctx.font = '600 10px ' + VE_TR.FONT;
  ctx.fillText(axisName, w - 4, 7);

  // İşaret çubuğu (marker bar): sabitlenmiş imlecin yeri
  if(veTrState.pinX != null) {
    var px = veTrXPos(geo, veTrState.pinX);
    if(px >= geo.plotX - 1 && px <= geo.plotX + geo.plotW + 1) {
      ctx.fillStyle = veThemeRgba('--accent-warning', 0.95, 'rgba(245,158,11,0.95)');
      ctx.beginPath();
      ctx.moveTo(px, 1); ctx.lineTo(px - 4, 8); ctx.lineTo(px + 4, 8);
      ctx.closePath(); ctx.fill();
    }
  }
  if(veTrState.cursorX != null) {
    var cx = veTrXPos(geo, veTrState.cursorX);
    if(cx >= geo.plotX - 1 && cx <= geo.plotX + geo.plotW + 1) {
      ctx.fillStyle = veThemeRgba('--accent-primary', 0.95, 'rgba(59,130,246,0.95)');
      ctx.beginPath();
      ctx.moveTo(cx, 1); ctx.lineTo(cx - 4, 8); ctx.lineTo(cx + 4, 8);
      ctx.closePath(); ctx.fill();
    }
  }
}

// ── Çizim: ölçüm imleci (ayrı katman) ────────────────────────────────────────
//
// İmleç şeritlerin üstündeki AYRI canvas'a çizilir. Aynı canvas'a çizilseydi
// her fare hareketi bütün şeritleri yeniden çizerdi — 8 şerit × 20 000 örnek
// her karede yeniden örneklenirdi.

function veTrDrawOverlay() {
  var cv = document.getElementById('ve-trace-overlay');
  var geo = veTrState.geo;
  if(!cv || !geo) return;

  var ctx = cv.getContext('2d');
  var dpr = window.devicePixelRatio || 1;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, geo.w, geo.surface);

  veTrDrawChrome(ctx, geo);

  var lanes = geo.lanes || [];
  var timeArr = geo.timeArr;
  var top = geo.rects.length ? geo.rects[0].y : 0;
  var bottom = geo.rects.length
    ? geo.rects[geo.rects.length - 1].y + geo.rects[geo.rects.length - 1].h
    : geo.surface;

  // Sabitlenmiş referans imleç
  if(veTrState.pinX != null) {
    var px = veTrXPos(geo, veTrState.pinX);
    if(px >= geo.plotX && px <= geo.plotX + geo.plotW) {
      ctx.strokeStyle = veThemeRgba('--accent-warning', 0.85, 'rgba(245,158,11,0.85)');
      ctx.lineWidth = 1;
      ctx.setLineDash([5, 4]);
      ctx.beginPath(); ctx.moveTo(px, top); ctx.lineTo(px, bottom); ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  if(veTrState.cursorX == null) return;
  var cx = veTrXPos(geo, veTrState.cursorX);
  if(cx < geo.plotX || cx > geo.plotX + geo.plotW) return;

  ctx.strokeStyle = veThemeRgba('--accent-primary', 0.9, 'rgba(59,130,246,0.9)');
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(cx, top); ctx.lineTo(cx, bottom); ctx.stroke();

  if(!timeArr) return;
  var i = veTrSnapIndex(timeArr, veTrState.cursorX);
  if(i < 0) return;
  var pi = (veTrState.pinX != null) ? veTrSnapIndex(timeArr, veTrState.pinX) : -1;

  ctx.font = '10px ' + VE_TR.FONT;
  ctx.textBaseline = 'middle';

  lanes.forEach(function(lane, li) {
    var rect = geo.rects[li];
    if(!rect) return;
    lane.sigs.forEach(function(g) {
      if(!g.series) return;
      var v = g.series[i];
      if(!isFinite(v)) return;
      var y = veTrYPos(lane, rect, v);
      if(y < rect.y - 2 || y > rect.y + rect.h + 2) return;

      // Eğri üzerinde nokta
      ctx.fillStyle = g.color;
      ctx.beginPath(); ctx.arc(cx, y, 2.6, 0, Math.PI * 2); ctx.fill();

      // Değer rozeti — Δ varsa farkı da yazar
      // Ayrık şeritte sayı okunmaz: "0.00e+0 0/1" yerine "Lockup açık",
      // "5.00 −" yerine "5. vites". Δ da anlamsız — 3. vitesten 5'e "+2"
      // bir büyüklük değil, bir geçiş.
      var txt = null;
      if(lane.levels) {
        var lvi = Math.round(v);
        if(lane.levels[lvi] !== undefined) txt = lane.levels[lvi];
      } else if(g.discrete) {
        txt = veTrStateLabel(g.sensor.signal, Math.round(v));
      }
      if(txt === null) {
        txt = veTrFmt(v, g.sensor.unit);
        if(pi >= 0 && isFinite(g.series[pi])) txt += '  Δ' + veTrFmtDelta(v - g.series[pi]);
      }
      var tw = ctx.measureText(txt).width;
      var bx = cx + 7, right = true;
      if(bx + tw + 8 > geo.plotX + geo.plotW) { bx = cx - 7 - tw - 8; right = false; }
      var by = Math.max(rect.y + 1, Math.min(rect.y + rect.h - 15, y - 7));

      ctx.fillStyle = veThemeRgba('--bg-secondary', 0.94, 'rgba(20,22,28,0.94)');
      ctx.strokeStyle = g.color;
      ctx.lineWidth = 1;
      if(ctx.roundRect) {
        ctx.beginPath(); ctx.roundRect(bx, by, tw + 8, 14, 3); ctx.fill(); ctx.stroke();
      } else {
        ctx.fillRect(bx, by, tw + 8, 14);
        ctx.strokeRect(bx + 0.5, by + 0.5, tw + 7, 13);
      }
      ctx.fillStyle = g.color;
      ctx.textAlign = 'left';
      ctx.fillText(txt, bx + 4, by + 7);
      if(!right) { /* sol yerleşim: metin yine soldan hizalı, kutu kaydırıldı */ }
    });
  });
}

// ── Ana çizim ────────────────────────────────────────────────────────────────

var _veTrRAF = null;

function veTrRenderSoon() {
  if(_veTrRAF) return;
  _veTrRAF = requestAnimationFrame(function() { _veTrRAF = null; veTrRender(); });
}

function veTrRender() {
  var slot = veTrBoard();
  var scrollEl = document.getElementById('ve-trace-scroll');
  var cv = document.getElementById('ve-trace-canvas');
  var ov = document.getElementById('ve-trace-overlay');
  if(!slot || !scrollEl || !cv || !ov) return;

  veTrRenderToolbar();

  var hasSignals = (slot.sensors || []).length > 0;
  var emptyEl = document.getElementById('ve-trace-empty');
  if(emptyEl) {
    emptyEl.style.display = hasSignals ? 'none' : 'flex';
    if(!hasSignals) emptyEl.innerHTML = veTrEmptyHTML();
  }
  var surfEl = document.getElementById('ve-trace-surface');
  if(surfEl) surfEl.style.display = hasSignals ? 'block' : 'none';
  var axEl = document.getElementById('ve-trace-axis');
  if(axEl) axEl.style.visibility = hasSignals ? 'visible' : 'hidden';

  if(!hasSignals) {
    veTrState.geo = null;
    veTrRenderStatus(null, null);
    return;
  }

  veTrResetCache();
  var lanes = veTrBuildLanes(slot);
  var timeArr = veTrResolveX(slot);
  var view = veTrXView(timeArr);

  var w = Math.max(120, scrollEl.clientWidth);
  var availH = Math.max(120, scrollEl.clientHeight);

  var ctx = cv.getContext('2d');
  var geo = veTrGeometry(ctx, lanes, view, w, availH);
  geo.lanes = lanes;
  geo.timeArr = timeArr;
  veTrState.geo = geo;

  var dpr = window.devicePixelRatio || 1;
  [cv, ov].forEach(function(c) {
    c.width = Math.max(1, Math.round(w * dpr));
    c.height = Math.max(1, Math.round(geo.surface * dpr));
    c.style.width = w + 'px';
    c.style.height = geo.surface + 'px';
  });
  ctx = cv.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, geo.surface);

  var tick = veTrTimeTicks(geo);
  lanes.forEach(function(lane, i) {
    veTrDrawLane(ctx, geo, lane, geo.rects[i], i, timeArr, tick.ticks);
  });

  var axisName = (slot.xAxis && slot.xAxis.name) ? slot.xAxis.name : 'Zaman [s]';
  geo.tick = tick;
  veTrDrawAxis(geo, tick, axisName);
  veTrDrawOverlay();
  veTrRenderStatus(geo, tick);
}

// ── Durum çubuğu ─────────────────────────────────────────────────────────────
//
// CANoe'nun sol alt köşesindeki Begin / End / Div kutusunun karşılığı: görünen
// pencerenin sınırları ve bir bölmenin kaç birim olduğu. Yakınlaştırınca ne
// kadar yakınlaştığı buradan okunur.

function veTrRenderStatus(geo, tick) {
  var el = document.getElementById('ve-trace-status');
  if(!el) return;
  if(!geo) { el.innerHTML = ''; return; }

  var slot = veTrBoard();
  var u = (slot.xAxis && slot.xAxis.unit) ? slot.xAxis.unit : 's';
  var dec = tick ? tick.dec : 2;
  var fmt = function(v) {
    return (typeof veFormatAxisVal === 'function') ? veFormatAxisVal(v, dec) : String(v);
  };

  var h = '<div class="ve-trace-st-group">';
  h += '<span class="ve-trace-st-k">Başlangıç</span><span class="ve-trace-st-v">' + fmt(geo.xMin) + ' ' + u + '</span>';
  h += '<span class="ve-trace-st-k">Bitiş</span><span class="ve-trace-st-v">' + fmt(geo.xMax) + ' ' + u + '</span>';
  if(tick) h += '<span class="ve-trace-st-k">Bölme</span><span class="ve-trace-st-v">' + fmt(tick.step) + ' ' + u + '</span>';
  h += '</div>';

  h += '<div class="ve-trace-st-group right">';
  if(veTrState.cursorX != null) {
    h += '<span class="ve-trace-st-k cur">İmleç</span><span class="ve-trace-st-v">' + fmt(veTrState.cursorX) + ' ' + u + '</span>';
  }
  if(veTrState.pinX != null) {
    h += '<span class="ve-trace-st-k pin">Referans</span><span class="ve-trace-st-v">' + fmt(veTrState.pinX) + ' ' + u + '</span>';
    if(veTrState.cursorX != null) {
      h += '<span class="ve-trace-st-k pin">Δ</span><span class="ve-trace-st-v">' +
           fmt(veTrState.cursorX - veTrState.pinX) + ' ' + u + '</span>';
    }
  }
  h += '<span class="ve-trace-st-k">Şerit</span><span class="ve-trace-st-v">' + geo.lanes.length + '</span>';
  h += '</div>';

  el.innerHTML = h;
}

// ── Boş durum ────────────────────────────────────────────────────────────────
//
// İki farklı engel var ve ikisi FARKLI şey söylemeli. Çözüm hiç çalışmadıysa
// sinyal işaretlemenin faydası yok — çizilecek veri yok; kullanıcıyı sinyal
// listesine yollamak onu boş bir şeride götürür. Çözüm varsa asıl eksik
// gerçekten sinyal seçimidir.
function veTrEmptyHTML() {
  var noSim = !window.veSimResults;
  var h = '';

  if(noSim) {
    h += '<div class="ve-trace-empty-ico"><span class="mf-ico mf-ico-play"></span></div>';
    h += '<div class="ve-trace-empty-title">Çözüm sonucu yok</div>';
    h += '<div class="ve-trace-empty-sub">Ölçüm penceresinde çizilecek veri için önce ' +
         'çözümü çalıştırın. Eksik bir şey varsa Uyarılar panelinde listelenir.</div>';
    if(typeof veSolverRun === 'function') {
      // Düğme hesabı başlatmıyor, Çözücü bileşenini açıyor — etiket de bunu
      // söylesin. "Çalıştır" yazıp panel açmak yanıltıyordu.
      h += '<button type="button" class="ve-trace-btn" data-act="open-solver" ' +
           'style="height:26px;margin-top:4px;">' +
           '<span class="mf-ico mf-ico-play"></span> Çözücüyü Aç</button>';
    }
    return h;
  }

  h += '<div class="ve-trace-empty-ico"><span class="mf-ico mf-ico-trending-up"></span></div>';
  h += '<div class="ve-trace-empty-title">Ölçüm penceresi boş</div>';
  h += '<div class="ve-trace-empty-sub">Soldaki <b>Veri Gezgini</b>\'nde bir sinyali ' +
       'işaretleyin — sinyal burada kendi şeridinde, kendi Y ekseniyle çizilir. ' +
       'Bir sinyali başka bir şeridin üzerine bırakırsanız ortak eksende birleşirler.</div>';
  return h;
}

// ── Araç çubuğu ──────────────────────────────────────────────────────────────

function veTrRenderToolbar() {
  var el = document.getElementById('ve-trace-toolbar');
  if(!el) return;
  var slot = veTrBoard();
  var n = (slot.sensors || []).length;
  var mode = slot.type || 'line';
  var zoomed = (veTrState.xMin != null || veTrState.xMax != null);

  var h = '';

  // X ekseni seçici — veShowXAxisPicker açılır listeyi bu kabın içine koyar
  h += '<div class="ve-trace-xaxis" id="ve-xaxis-area-0">';
  h += '<button type="button" class="ve-trace-btn wide" data-act="xaxis" ' +
       'title="Pencerenin X eksenini değiştir (tüm şeritler paylaşır)">' +
       '<span class="mf-ico mf-ico-trending-up"></span>' +
       '<span>' + veSigEsc((slot.xAxis && slot.xAxis.name) ? slot.xAxis.name : 'Zaman [s]') + '</span>' +
       '<span class="ve-trace-caret">▾</span></button>';
  h += '</div>';

  h += '<span class="ve-trace-sep"></span>';

  h += '<button type="button" class="ve-trace-btn" data-act="fit"' +
       (zoomed ? '' : ' disabled') + ' title="Tüm veriyi göster (çift tık)">Sığdır</button>';
  h += '<button type="button" class="ve-trace-btn icon" data-act="zoom-in" title="Zaman ekseninde yakınlaş">+</button>';
  h += '<button type="button" class="ve-trace-btn icon" data-act="zoom-out" title="Zaman ekseninde uzaklaş">−</button>';

  if(veTrState.pinX != null) {
    h += '<button type="button" class="ve-trace-btn pin" data-act="unpin" ' +
         'title="Referans imleci kaldır">Δ referansı kaldır</button>';
  }

  h += '<span class="ve-trace-sep"></span>';
  h += '<button type="button" class="ve-trace-btn" data-act="split-all"' +
       (n > 1 ? '' : ' disabled') + ' title="Her sinyali kendi şeridine ayır">Ayır</button>';
  h += '<button type="button" class="ve-trace-btn" data-act="merge-all"' +
       (n > 1 ? '' : ' disabled') + ' title="Aynı birimli sinyalleri tek şeritte topla">Birleştir</button>';

  h += '<span class="ve-trace-spacer"></span>';

  h += '<div class="ve-trace-seg" role="group" aria-label="Görünüm">';
  [['line', 'İz'], ['table', 'Tablo'], ['scatter3d', '3B']].forEach(function(m) {
    h += '<button type="button" data-act="mode" data-mode="' + m[0] + '"' +
         ' aria-pressed="' + (mode === m[0] ? 'true' : 'false') + '">' + m[1] + '</button>';
  });
  h += '</div>';

  h += '<button type="button" class="ve-trace-btn danger" data-act="clear"' +
       (n ? '' : ' disabled') + ' title="Tüm şeritleri kaldır">Temizle</button>';

  el.innerHTML = h;
}

// ── Eylemler ─────────────────────────────────────────────────────────────────

// Yeni bir çözüm başlıyor / sekme değişti: görünüm penceresi ve imleçler
// ÖNCEKİ koşuya aitti. DOM'a dokunmaz — çözüm başlamadan da çağrılabilir.
function veTrResetView() {
  veTrState.xMin = null;
  veTrState.xMax = null;
  veTrState.cursorX = null;
  veTrState.pinX = null;
}

function veTrFit() {
  veTrResetView();
  veTrRender();
}

// Zaman ekseninde yakınlaştırma. focus null ise pencerenin ortası korunur.
function veTrZoom(factor, focus) {
  var geo = veTrState.geo;
  if(!geo) return;
  var c = (focus == null) ? (geo.xMin + geo.xMax) / 2 : focus;
  var span = (geo.xMax - geo.xMin) / factor;
  var full = geo.dataMax - geo.dataMin;
  // Tam veriden geniş bir pencereye izin verilmez: sağda solda boşluk kalır,
  // "sığdır" ile ayırt edilemez bir duruma düşer.
  if(span >= full) { veTrFit(); return; }
  if(span < full / 5000) span = full / 5000;
  var f = (c - geo.xMin) / (geo.xMax - geo.xMin);
  var nMin = c - span * f;
  var nMax = nMin + span;
  if(nMin < geo.dataMin) { nMin = geo.dataMin; nMax = nMin + span; }
  if(nMax > geo.dataMax) { nMax = geo.dataMax; nMin = nMax - span; }
  veTrState.xMin = nMin;
  veTrState.xMax = nMax;
  veTrRender();
}

function veTrPan(dxPixels) {
  var geo = veTrState.geo;
  if(!geo) return;
  var span = geo.xMax - geo.xMin;
  var d = dxPixels / geo.plotW * span;
  var nMin = geo.xMin - d, nMax = geo.xMax - d;
  if(nMin < geo.dataMin) { nMin = geo.dataMin; nMax = nMin + span; }
  if(nMax > geo.dataMax) { nMax = geo.dataMax; nMin = nMax - span; }
  veTrState.xMin = nMin;
  veTrState.xMax = nMax;
  veTrRender();
}

function veTrUnpin() {
  veTrState.pinX = null;
  veTrRender();
}

// Her sinyal kendi şeridine.
function veTrSplitAll() {
  var slot = veTrBoard();
  slot.lanes = (slot.sensors || []).map(function(s) {
    return { ids: [veTrKey(s.id, s.signal)], h: VE_TR.LANE_DEF_H, min: null, max: null };
  });
  veTrRender();
}

// Aynı birimli sinyaller tek şeritte. Birim ortak olmadan birleştirmek
// ölçeği anlamsız kılar (rpm ile % aynı eksende okunmaz).
function veTrMergeByUnit() {
  var slot = veTrBoard();
  var byUnit = {}, order = [];
  (slot.sensors || []).forEach(function(s) {
    var u = s.unit || '−';
    if(!byUnit[u]) { byUnit[u] = []; order.push(u); }
    byUnit[u].push(veTrKey(s.id, s.signal));
  });
  slot.lanes = order.map(function(u) {
    return { ids: byUnit[u], h: VE_TR.LANE_DEF_H, min: null, max: null };
  });
  veTrRender();
}

function veTrClear() {
  var slot = veTrBoard();
  slot.sensors = [];
  slot.lanes = [];
  slot.yAxisLock = {};
  veTrState.pinX = null;
  veTrState.cursorX = null;
  veTrFit();
  if(typeof veSigRefreshTree === 'function') veSigRefreshTree();
}

function veTrSetMode(mode) {
  var slot = veTrBoard();
  slot.type = mode;
  veTrApplyMode();
}

// Görünüm kipini DOM'a uygular. Tablo ve 3B, panel mimarisinden devralınan
// veRenderSlot() çıktısını kullanır — o kod tek panelde de aynen çalışıyor,
// yeniden yazmak için sebep yok.
function veTrApplyMode() {
  var slot = veTrBoard();
  var mode = slot.type || 'line';
  var graph = document.getElementById('ve-trace-graph');
  var alt = document.getElementById('ve-rslot-body-0');
  if(!graph || !alt) return;

  if(mode === 'line') {
    graph.style.display = '';
    alt.style.display = 'none';
    alt.innerHTML = '';
    veTrRender();
  } else {
    graph.style.display = 'none';
    alt.style.display = 'block';
    veTrRenderToolbar();
    if(typeof veRenderSlot === 'function') veRenderSlot(VE_BOARD);
  }
}

// Şeridi kaldır: şeritteki tüm sinyaller listeden düşer.
function veTrRemoveLane(laneIdx) {
  var slot = veTrBoard();
  var lanes = veTrReconcileLanes(slot.sensors, slot.lanes);
  var L = lanes[laneIdx];
  if(!L) return;
  var kill = {};
  L.ids.forEach(function(k) { kill[k] = true; });
  slot.sensors = (slot.sensors || []).filter(function(s) {
    return !kill[veTrKey(s.id, s.signal)];
  });
  slot.lanes = lanes.filter(function(_, i) { return i !== laneIdx; });
  veTrRender();
  if(typeof veSigRefreshTree === 'function') veSigRefreshTree();
}

// Şeridi taşı (yeniden sırala).
function veTrMoveLane(from, to) {
  var slot = veTrBoard();
  var lanes = veTrReconcileLanes(slot.sensors, slot.lanes);
  if(from < 0 || from >= lanes.length || to < 0 || to >= lanes.length || from === to) return;
  var L = lanes.splice(from, 1)[0];
  lanes.splice(to, 0, L);
  slot.lanes = lanes;
  veTrRender();
}

// Sinyali hedef şeride taşı (birleştirme). laneIdx null ise yeni şerit açılır.
function veTrAssignToLane(key, laneIdx) {
  var slot = veTrBoard();
  var lanes = veTrReconcileLanes(slot.sensors, slot.lanes);
  lanes.forEach(function(L) {
    L.ids = L.ids.filter(function(k) { return k !== key; });
  });
  if(laneIdx != null && lanes[laneIdx]) {
    lanes[laneIdx].ids.push(key);
  } else {
    lanes.push({ ids: [key], h: VE_TR.LANE_DEF_H, min: null, max: null });
  }
  slot.lanes = lanes.filter(function(L) { return L.ids.length > 0; });
  veTrRender();
}

// ── Etkileşim: vurgu ve tutamaklar ───────────────────────────────────────────
//
// Tutamak dikdörtgenleri SAF fonksiyonlardan gelir: çizim ile isabet testi
// aynı kaynaktan beslenmezse düğme göründüğü yerde çalışmaz.

function veTrLaneCloseRect(geo, rect) {
  return { x: geo.plotX + geo.plotW - 16, y: rect.y + 4, w: 12, h: 12 };
}

function veTrLaneGrabRect(geo, rect) {
  return { x: 0, y: rect.y, w: VE_TR.TITLE_BAND, h: rect.h };
}

function veTrInRect(r, x, y) {
  return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
}

function veTrHitLane(geo, y) {
  for(var i = 0; i < geo.rects.length; i++) {
    var r = geo.rects[i];
    if(y >= r.y && y <= r.y + r.h) return i;
  }
  return -1;
}

// Şerit alt kenarı — yükseklik ayırıcısı. Son şerit de yeniden boyutlanabilir.
function veTrHitResize(geo, y) {
  for(var i = 0; i < geo.rects.length; i++) {
    var r = geo.rects[i];
    if(Math.abs(y - (r.y + r.h)) <= 4) return i;
  }
  return -1;
}

function veTrDrawChrome(ctx, geo) {
  var li = veTrState.hoverLane;
  var drag = veTrState.drag;

  if(li >= 0 && geo.rects[li]) {
    var rect = geo.rects[li];

    // Tutma alanı (döndürülmüş başlığın şeridi) — sürüklenebilir olduğunu
    // söyleyen tek şey bu; imleç değişimi tek başına keşfedilmiyor.
    var g = veTrLaneGrabRect(geo, rect);
    ctx.fillStyle = veThemeRgba('--accent-primary', 0.14, 'rgba(59,130,246,0.14)');
    ctx.fillRect(g.x, g.y, g.w, g.h);

    // Kaldırma düğmesi
    var c = veTrLaneCloseRect(geo, rect);
    ctx.fillStyle = veThemeRgba('--bg-secondary', 0.9, 'rgba(20,22,28,0.9)');
    ctx.fillRect(c.x, c.y, c.w, c.h);
    ctx.strokeStyle = 'rgba(128,128,128,0.5)';
    ctx.lineWidth = 1;
    ctx.strokeRect(c.x + 0.5, c.y + 0.5, c.w - 1, c.h - 1);
    ctx.strokeStyle = veThemeRgba('--accent-danger', 0.9, 'rgba(239,68,68,0.9)');
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    ctx.moveTo(c.x + 3.5, c.y + 3.5); ctx.lineTo(c.x + c.w - 3.5, c.y + c.h - 3.5);
    ctx.moveTo(c.x + c.w - 3.5, c.y + 3.5); ctx.lineTo(c.x + 3.5, c.y + c.h - 3.5);
    ctx.stroke();
  }

  // Yeniden sıralama göstergesi
  if(drag && drag.kind === 'reorder' && drag.target != null && geo.rects.length) {
    var t = Math.max(0, Math.min(geo.rects.length - 1, drag.target));
    var tr = geo.rects[t];
    var yLine = (drag.target > drag.from) ? (tr.y + tr.h + VE_TR.LANE_GAP / 2)
                                          : (tr.y - VE_TR.LANE_GAP / 2);
    ctx.strokeStyle = veThemeRgba('--accent-primary', 1, 'rgba(59,130,246,1)');
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(geo.plotX, yLine); ctx.lineTo(geo.plotX + geo.plotW, yLine);
    ctx.stroke();
  }
}

// ── Etkileşim: olay bağlama ──────────────────────────────────────────────────

function veTrBindGraph() {
  var host = document.getElementById('ve-trace-surface');
  var scroll = document.getElementById('ve-trace-scroll');
  var cv = document.getElementById('ve-trace-canvas');
  if(!host || !cv || host._veTrBound) return;
  host._veTrBound = true;

  var DRAG_THRESHOLD = 4;
  var pending = null;   // { x, y, laneIdx, kind }

  function local(e) {
    var r = cv.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  function overlayOnly() {
    veTrDrawOverlay();
    if(veTrState.geo) {
      veTrRenderStatus(veTrState.geo, veTrState.geo.tick);
      veTrDrawAxis(veTrState.geo, veTrState.geo.tick,
        (veTrBoard().xAxis && veTrBoard().xAxis.name) ? veTrBoard().xAxis.name : 'Zaman [s]');
    }
  }

  var rafPending = false;
  function overlaySoon() {
    if(rafPending) return;
    rafPending = true;
    requestAnimationFrame(function() { rafPending = false; overlayOnly(); });
  }

  host.addEventListener('mousemove', function(e) {
    var geo = veTrState.geo;
    if(!geo) return;
    var p = local(e);
    var drag = veTrState.drag;

    // Eşik aşılmadan sürükleme başlamaz: tıklama ile sürükleme ayrılsın
    if(pending && !drag) {
      if(Math.abs(e.clientX - pending.cx) > DRAG_THRESHOLD ||
         Math.abs(e.clientY - pending.cy) > DRAG_THRESHOLD) {
        veTrState.drag = drag = pending.make();
        pending = null;
      }
    }

    if(drag) {
      if(drag.kind === 'resize') {
        var lanes = veTrReconcileLanes(veTrBoard().sensors, veTrBoard().lanes);
        var L = lanes[drag.lane];
        if(L) {
          L.h = Math.max(VE_TR.LANE_MIN_H, drag.h0 + (e.clientY - drag.cy));
          veTrBoard().lanes = lanes;
          veTrRenderSoon();
        }
        return;
      }
      if(drag.kind === 'reorder') {
        var t = veTrHitLane(geo, p.y);
        drag.target = (t >= 0) ? t : drag.target;
        overlaySoon();
        return;
      }
      if(drag.kind === 'pan') {
        var dx = e.clientX - drag.cx;
        drag.cx = e.clientX;
        veTrPan(dx);
        return;
      }
    }

    // Gezinme: imleç + vurgu
    var lane = veTrHitLane(geo, p.y);
    var changedLane = (lane !== veTrState.hoverLane);
    veTrState.hoverLane = lane;

    if(p.x >= geo.plotX && p.x <= geo.plotX + geo.plotW) {
      veTrState.cursorX = veTrXVal(geo, p.x);
    } else {
      veTrState.cursorX = null;
    }

    // İmleç biçimi: ayırıcı / tutamak / artı
    var rz = veTrHitResize(geo, p.y);
    if(rz >= 0) host.style.cursor = 'ns-resize';
    else if(p.x < VE_TR.TITLE_BAND && lane >= 0) host.style.cursor = 'grab';
    else if(lane >= 0 && geo.rects[lane] &&
            veTrInRect(veTrLaneCloseRect(geo, geo.rects[lane]), p.x, p.y)) host.style.cursor = 'pointer';
    else if(p.x >= geo.plotX) host.style.cursor = 'crosshair';
    else host.style.cursor = '';

    if(changedLane || veTrState.cursorX != null) overlaySoon();
  });

  host.addEventListener('mouseleave', function() {
    if(veTrState.drag) return;
    veTrState.cursorX = null;
    veTrState.hoverLane = -1;
    host.style.cursor = '';
    overlayOnly();
  });

  host.addEventListener('mousedown', function(e) {
    var geo = veTrState.geo;
    if(!geo || (e.button !== 0 && e.button !== 2)) return;
    var p = local(e);
    var lane = veTrHitLane(geo, p.y);

    // Kaldırma düğmesi
    if(lane >= 0 && geo.rects[lane] &&
       veTrInRect(veTrLaneCloseRect(geo, geo.rects[lane]), p.x, p.y)) {
      e.preventDefault();
      veTrRemoveLane(lane);
      return;
    }

    var rz = veTrHitResize(geo, p.y);
    if(rz >= 0) {
      e.preventDefault();
      var lanes = veTrReconcileLanes(veTrBoard().sensors, veTrBoard().lanes);
      var h0 = geo.rects[rz] ? geo.rects[rz].h : VE_TR.LANE_DEF_H;
      pending = { cx: e.clientX, cy: e.clientY,
                  make: function() { return { kind: 'resize', lane: rz, h0: h0, cy: e.clientY }; } };
      // Yükseklik sürüklemesi eşiksiz başlar: ayırıcıya basmak zaten niyet.
      veTrState.drag = pending.make();
      pending = null;
      document.body.style.cursor = 'ns-resize';
      document.body.style.userSelect = 'none';
      return;
    }

    if(p.x < VE_TR.TITLE_BAND && lane >= 0) {
      e.preventDefault();
      pending = { cx: e.clientX, cy: e.clientY,
                  make: function() { return { kind: 'reorder', from: lane, target: lane }; } };
      return;
    }

    if(p.x >= geo.plotX && p.x <= geo.plotX + geo.plotW) {
      e.preventDefault();
      pending = { cx: e.clientX, cy: e.clientY, plot: true,
                  make: function() { return { kind: 'pan', cx: e.clientX }; } };
    }
  });

  document.addEventListener('mouseup', function(e) {
    var drag = veTrState.drag;
    var wasClick = pending && pending.plot;

    if(drag && drag.kind === 'reorder' && drag.target != null && drag.target !== drag.from) {
      veTrMoveLane(drag.from, drag.target);
    }
    if(drag) {
      veTrState.drag = null;
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      if(drag.kind === 'reorder') overlayOnly();
    }
    pending = null;

    // Sürüklemeden biten tıklama = referans imleci sabitle/kaldır
    if(wasClick && veTrState.geo && veTrState.cursorX != null) {
      if(veTrState.pinX != null &&
         Math.abs(veTrState.pinX - veTrState.cursorX) <
           (veTrState.geo.xMax - veTrState.geo.xMin) / 200) {
        veTrState.pinX = null;
      } else {
        veTrState.pinX = veTrState.cursorX;
      }
      veTrRender();
    }
  });

  host.addEventListener('contextmenu', function(e) { e.preventDefault(); });

  host.addEventListener('dblclick', function(e) {
    var geo = veTrState.geo;
    if(!geo) return;
    var p = local(e);
    var lane = veTrHitLane(geo, p.y);
    if(p.x < geo.plotX && lane >= 0) {
      e.preventDefault();
      veTrShowLaneScale(lane, e);
      return;
    }
    e.preventDefault();
    veTrFit();
  });

  host.addEventListener('wheel', function(e) {
    var geo = veTrState.geo;
    if(!geo) return;
    var p = local(e);
    // Ctrl olmadan dikey tekerlek listeyi KAYDIRIR (çok şeritte beklenen
    // davranış). Zaman ekseninde yakınlaşmak için Ctrl ya da yatay tekerlek.
    var wantZoom = e.ctrlKey || e.metaKey || Math.abs(e.deltaX) > Math.abs(e.deltaY);
    if(!wantZoom) return;
    e.preventDefault();
    var d = (Math.abs(e.deltaX) > Math.abs(e.deltaY)) ? e.deltaX : e.deltaY;
    var focus = (p.x >= geo.plotX && p.x <= geo.plotX + geo.plotW)
      ? veTrXVal(geo, p.x) : null;
    veTrZoom(d < 0 ? 1.2 : 1 / 1.2, focus);
  }, { passive: false });

  if(scroll && !scroll._veTrScroll) {
    scroll._veTrScroll = true;
    // Yüzey kaydırılınca zaman ekseni yerinde kalır ama şeritler kayar:
    // imleç rozetlerinin yeniden hizalanması gerekir.
    scroll.addEventListener('scroll', function() { overlaySoon(); });
  }
}

// ── Şerit ölçeği (elle Y sınırı) ─────────────────────────────────────────────

function veTrShowLaneScale(laneIdx, e) {
  var old = document.getElementById('ve-trace-scale-pop');
  if(old) old.remove();

  var slot = veTrBoard();
  var lanes = veTrReconcileLanes(slot.sensors, slot.lanes);
  var L = lanes[laneIdx];
  if(!L) return;
  var built = veTrState.geo && veTrState.geo.lanes ? veTrState.geo.lanes[laneIdx] : null;

  var pop = document.createElement('div');
  pop.id = 've-trace-scale-pop';
  pop.className = 've-trace-pop';
  pop.innerHTML =
    '<div class="ve-trace-pop-title">' + veSigEsc(built ? built.title : 'Şerit') + '</div>' +
    '<label>En az<input type="number" step="any" id="ve-trace-scale-min" value="' +
      (L.min != null ? L.min : (built ? Number(built.yMin.toFixed(4)) : 0)) + '"></label>' +
    '<label>En çok<input type="number" step="any" id="ve-trace-scale-max" value="' +
      (L.max != null ? L.max : (built ? Number(built.yMax.toFixed(4)) : 1)) + '"></label>' +
    '<div class="ve-trace-pop-row">' +
      '<button type="button" data-act="scale-auto">Otomatik</button>' +
      '<button type="button" class="primary" data-act="scale-ok">Uygula</button>' +
    '</div>';

  document.body.appendChild(pop);
  var x = Math.min(window.innerWidth - 210, Math.max(8, e.clientX - 20));
  var y = Math.min(window.innerHeight - 160, Math.max(8, e.clientY - 20));
  pop.style.left = x + 'px';
  pop.style.top = y + 'px';

  pop.addEventListener('click', function(ev) {
    var b = ev.target.closest('[data-act]');
    if(!b) return;
    var act = b.getAttribute('data-act');
    var cur = veTrReconcileLanes(slot.sensors, slot.lanes);
    if(!cur[laneIdx]) { pop.remove(); return; }
    if(act === 'scale-auto') {
      cur[laneIdx].min = null;
      cur[laneIdx].max = null;
    } else {
      var mn = parseFloat(document.getElementById('ve-trace-scale-min').value);
      var mx = parseFloat(document.getElementById('ve-trace-scale-max').value);
      if(isFinite(mn) && isFinite(mx) && mx > mn) {
        cur[laneIdx].min = mn;
        cur[laneIdx].max = mx;
      } else if(typeof showToast === 'function') {
        showToast('En çok değeri en azdan büyük olmalı.', 'warning');
        return;
      }
    }
    slot.lanes = cur;
    pop.remove();
    veTrRender();
  });

  setTimeout(function() {
    function close(ev) {
      if(!pop.contains(ev.target)) { pop.remove(); document.removeEventListener('mousedown', close, true); }
    }
    document.addEventListener('mousedown', close, true);
  }, 0);
}

// ── Sürükle-bırak hedefi ─────────────────────────────────────────────────────
//
// Bir sinyal ŞERİDİN ÜZERİNE bırakılırsa o şeride katılır (ortak Y ekseni) —
// aynı birimli iki sinyali üst üste okumanın yolu budur. Şeritlerin dışına
// bırakılırsa kendi şeridini açar.

function veTrDropLaneAt(clientX, clientY) {
  var geo = veTrState.geo;
  var cv = document.getElementById('ve-trace-canvas');
  if(!geo || !cv) return null;
  var r = cv.getBoundingClientRect();
  if(clientX < r.left || clientX > r.right || clientY < r.top || clientY > r.bottom) return null;
  var i = veTrHitLane(geo, clientY - r.top);
  return { lane: i >= 0 ? i : null };
}

function veTrIsOver(clientX, clientY) {
  var host = document.getElementById('ve-trace');
  if(!host) return false;
  var r = host.getBoundingClientRect();
  return clientX >= r.left && clientX <= r.right && clientY >= r.top && clientY <= r.bottom;
}

function veTrHighlightDrop(clientX, clientY) {
  var host = document.getElementById('ve-trace');
  if(!host) return;
  host.classList.toggle('drop-active', veTrIsOver(clientX, clientY));
}

// Sürüklenen sinyal bırakıldı. Ekleme her zaman sensors üzerinden yapılır;
// şerit ataması ondan sonra gelir (uzlaştırma yeni sinyale şerit açmış olur).
function veTrDropSignal(clientX, clientY, sensorId, signalId) {
  var host = document.getElementById('ve-trace');
  if(host) host.classList.remove('drop-active');
  if(!veTrIsOver(clientX, clientY)) return false;

  var target = veTrDropLaneAt(clientX, clientY);
  var slot = veTrBoard();
  var had = veSigIndexInSlot(slot, sensorId, signalId) >= 0;
  if(!had && typeof veAddSignalToSlot === 'function') {
    veAddSignalToSlot(VE_BOARD, sensorId, signalId);
  }
  if(target && target.lane != null) {
    veTrAssignToLane(veTrKey(sensorId, signalId), target.lane);
  } else {
    veTrRender();
  }
  if(typeof veSigRefreshTree === 'function') veSigRefreshTree();
  return true;
}

// ── Kabuk ────────────────────────────────────────────────────────────────────

function veTrShellHTML() {
  var h = '<div class="ve-trace" id="ve-trace" data-slot="0">';
  h += '<div class="ve-trace-toolbar" id="ve-trace-toolbar"></div>';

  h += '<div class="ve-trace-body">';
  h += '<div class="ve-trace-graph" id="ve-trace-graph">';
  h += '<div class="ve-trace-scroll" id="ve-trace-scroll">';
  h += '<div class="ve-trace-empty" id="ve-trace-empty"></div>';
  h += '<div class="ve-trace-surface" id="ve-trace-surface">';
  h += '<canvas id="ve-trace-canvas"></canvas>';
  h += '<canvas id="ve-trace-overlay"></canvas>';
  h += '</div>';
  h += '</div>';
  h += '<canvas class="ve-trace-axis" id="ve-trace-axis"></canvas>';
  h += '<div class="ve-trace-status" id="ve-trace-status"></div>';
  h += '</div>';

  // Tablo / 3B görünümü — veRenderSlot(0) buraya çizer
  h += '<div class="ve-trace-alt" id="ve-rslot-body-0" style="display:none;"></div>';
  h += '</div>';

  h += '</div>';
  return h;
}

function veTrBuildShell() {
  var hostEl = document.getElementById('ve-results-panels');
  if(!hostEl) return;
  if(!document.getElementById('ve-trace')) {
    hostEl.innerHTML = veTrShellHTML();
  }
  veTrBindGraph();
  veTrBindToolbar();
  veTrObserveResize();
}

function veTrBindToolbar() {
  var empty = document.getElementById('ve-trace-empty');
  if(empty && !empty._veTrBound) {
    empty._veTrBound = true;
    empty.addEventListener('click', function(e) {
      var b = e.target.closest('[data-act="open-solver"]');
      if(b && typeof veSolverRun === 'function') veSolverRun();
    });
  }

  var el = document.getElementById('ve-trace-toolbar');
  if(!el || el._veTrBound) return;
  el._veTrBound = true;
  el.addEventListener('click', function(e) {
    var b = e.target.closest('[data-act]');
    if(!b || b.disabled) return;
    var act = b.getAttribute('data-act');
    if(act === 'xaxis') {
      if(typeof veShowXAxisPicker === 'function') veShowXAxisPicker(VE_BOARD, e);
    }
    else if(act === 'fit') veTrFit();
    else if(act === 'zoom-in') veTrZoom(1.4, null);
    else if(act === 'zoom-out') veTrZoom(1 / 1.4, null);
    else if(act === 'unpin') veTrUnpin();
    else if(act === 'split-all') veTrSplitAll();
    else if(act === 'merge-all') veTrMergeByUnit();
    else if(act === 'clear') veTrClear();
    else if(act === 'mode') veTrSetMode(b.getAttribute('data-mode'));
  });
}

// Kapsayıcı boyutu değişince yeniden çizim. Pencere yeniden boyutlandırma,
// Veri Gezgini'nin genişletilmesi ve şerit daraltma hep buradan geçer.
var _veTrRO = null;

function veTrObserveResize() {
  var scroll = document.getElementById('ve-trace-scroll');
  if(!scroll || typeof ResizeObserver === 'undefined') return;
  if(_veTrRO) { try { _veTrRO.disconnect(); } catch(e) {} }
  _veTrRO = new ResizeObserver(function() {
    if((veTrBoard().type || 'line') === 'line') veTrRenderSoon();
  });
  _veTrRO.observe(scroll);
}

// ── Giriş noktası ────────────────────────────────────────────────────────────

// ── Eski proje dosyalarının göçü ─────────────────────────────────────────────
//
// Eski dosyalarda sinyaller dört panele dağılmış olabilir. Panel = ORTAK Y
// EKSENİ demekti; tek yüzeyde bunun karşılığı ŞERİTTİR. Bu yüzden göç naif
// olamaz:
//
//   • Yalnız panel 0'ı almak, dört panelli bir projede sinyallerin %75'ini
//     sessizce siler. Hepsi taşınır.
//   • Hepsini tek düzlüğe dökmek "bu ikisi aynı panelde okunsun" kararını
//     çöpe atar. Her kaynak panel TEK BİR ŞERİDE dönüşür.
//   • Panel başına X ekseni farklı OLABİLİR: tek-eksen kuralı ancak bırakma
//     anında uygulanıyordu, ondan önceki dosyalarda panel 1 zaman, panel 2
//     devir ekseninde olabilir. Farklı eksendeki sinyali sessizce zaman
//     eksenine düşürmek "makul ama yanlış" bir grafik üretir — bu yüzden
//     taşınır ama AÇIKÇA bildirilir.
function veTrMigrateSlots() {
  if(typeof veResultSlots === 'undefined' || !veResultSlots) return null;
  var board = veTrBoard();
  var xKeyOf = (typeof veXAxisKeyOf === 'function')
    ? veXAxisKeyOf
    : function(ax) { return (ax && ax.id) ? ax.id : 'time'; };

  // Panonun ekseni: pano boşsa ilk dolu panelinki devralınır
  if(!board.xAxis) {
    for(var b = 1; b < veResultSlots.length; b++) {
      var cand = veResultSlots[b];
      if(cand && cand.sensors && cand.sensors.length && cand.xAxis) {
        board.xAxis = cand.xAxis;
        if(!board._dataSource && cand._dataSource) board._dataSource = cand._dataSource;
        break;
      }
    }
  }
  var boardKey = xKeyOf(board.xAxis, board._dataSource || '');

  var moved = 0, mismatched = 0, from3d = 0;
  var lanes = veTrReconcileLanes(board.sensors, board.lanes);

  for(var i = 1; i < veResultSlots.length; i++) {
    var s = veResultSlots[i];
    if(!s || !s.sensors || !s.sensors.length) { veResultSlots[i] = {}; continue; }

    if(xKeyOf(s.xAxis, s._dataSource || '') !== boardKey) mismatched++;
    if((s.type || 'line') === 'scatter3d') from3d++;

    var laneIds = [];
    s.sensors.forEach(function(sig) {
      var dup = board.sensors.some(function(x) {
        return x.id === sig.id && x.signal === sig.signal;
      });
      if(dup) return;
      board.sensors.push(sig);
      laneIds.push(veTrKey(sig.id, sig.signal));
      moved++;
    });
    // Kaynak panelin sinyalleri TEK şeride: ortak eksende okunma kararı korunur
    if(laneIds.length) lanes.push({ ids: laneIds, h: VE_TR.LANE_DEF_H, min: null, max: null });

    veResultSlots[i] = {};
  }

  if(!moved) return null;
  board.lanes = veTrReconcileLanes(board.sensors, lanes);
  return { moved: moved, mismatched: mismatched, from3d: from3d };
}

// Sonuçlar sekmesine her girişte çalışır.
function veTrEnter() {
  var slot = veTrBoard();
  var mig = veTrMigrateSlots();
  if(mig && typeof showToast === 'function') {
    showToast(mig.moved + ' sinyal eski panellerden ölçüm penceresine taşındı; ' +
              'her panel kendi şeridi oldu.', 'info');
    // Sessiz birleştirme kabul edilemez: farklı X eksenli paneller artık tek
    // eksende okunuyor, kullanıcı bunu bilmeli.
    if(mig.mismatched) {
      showToast(mig.mismatched + ' panel farklı bir X ekseninde çiziliyordu. ' +
                'Pencere tek eksende çalışır — o şeritleri kontrol edin.', 'warning');
    }
    if(mig.from3d) {
      showToast('3B panelin X/Y/Z sinyalleri ayrı eğriler olarak geldi. ' +
                'Görünüm çubuğundan "3B" kipine geçebilirsiniz.', 'info');
    }
  }
  if(!slot.xAxis && typeof veInheritedXAxis === 'function') {
    slot.xAxis = veInheritedXAxis(VE_BOARD);
  }
  veTrBuildShell();
  veTrApplyMode();
}

// Grafik/tablo tazeleme için tek kapı — çözüm bitince, sekme değişince,
// proje yüklenince buradan geçilir.
function veTrRefresh() {
  if(!document.getElementById('ve-trace')) return;
  veTrApplyMode();
}

// Jest: saf yardımcılar doğrudan test edilebilsin
if(typeof module !== 'undefined' && module.exports) {
  module.exports = {
    VE_BOARD: VE_BOARD,
    VE_TR: VE_TR,
    veTrKey: veTrKey,
    veTrResetView: veTrResetView,
    veTrCloneSlot: veTrCloneSlot,
    veTrCloneBoard: veTrCloneBoard,
    veTrReconcileLanes: veTrReconcileLanes,
    veTrIsDiscrete: veTrIsDiscrete,
    veTrEncodeText: veTrEncodeText,
    veTrStateLabel: veTrStateLabel,
    veTrExtent: veTrExtent,
    veTrLaneRange: veTrLaneRange,
    veTrLaneRects: veTrLaneRects,
    veTrLaneTitle: veTrLaneTitle,
    veTrFitTitle: veTrFitTitle,
    veTrSnapIndex: veTrSnapIndex,
    veTrFmt: veTrFmt,
    veTrInRect: veTrInRect,
    veTrLaneCloseRect: veTrLaneCloseRect,
    veTrLaneGrabRect: veTrLaneGrabRect,
    veTrHitLane: veTrHitLane,
    veTrHitResize: veTrHitResize
  };
}
