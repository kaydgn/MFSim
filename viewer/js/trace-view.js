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

// ── Logaritmik Y ekseni ──────────────────────────────────────────────────────
//
// NEDEN VAR: iletilebilirlik T(f) üç mertebe değişir — rezonansta 25, izolasyon
// bölgesinde 0,003. Lineer eksende ölçeği tepe belirler ve asıl ilgilendiğimiz
// bölge (T < 1) grafiğin en alt %4'üne yapışır: "0,003 mü 0,03 mu" ayırt
// edilemez, hâlbuki aradaki fark on kat titreşimdir. Tedarikçi raporları bu
// diyagramı LOG-LOG basar; bizde X log oldu, Y lineer kalmıştı.
//
// Şerit bazında uygulanır: aynı panoda kuvvet (işaret değiştiren) ve
// iletilebilirlik (hep pozitif) şeritleri bir arada olabilir. Log yalnız
// TÜMÜ POZİTİF şeritte açılır; ötekiler lineer kalır. Kilitli kalan bir düğme
// yerine uygulanabildiği şeride uygulanır.
function veTrYLogOk(min, max) {
  return isFinite(min) && isFinite(max) && min > 0 && max > 0;
}

// Log şeridin Y aralığı. Pay ÇARPIMSAL: lineerdeki "aralığın %8'i" kuralı log
// ölçekte alt uçta devasa, üst uçta görünmez bir boşluk açardı.
function veTrLaneRangeLog(min, max) {
  if(!veTrYLogOk(min, max)) return { min: 1, max: 10 };
  if(max <= min) return { min: min / 3, max: max * 3 };
  var f = Math.pow(max / min, 0.06);
  return { min: min / f, max: max * f };
}

// Ondalık bölmeleri (1-2-5, gerekirse 1..9) — X ve Y ekseni AYNI üreteci
// kullanır ki iki eksende farklı bölme mantığı olmasın.
function veTrLogTickList(lo, hi) {
  var MULT = [[1, 2, 5], [1, 1.5, 2, 3, 4, 5, 6, 7, 8, 9]];
  for(var m = 0; m < MULT.length; m++) {
    var ticks = [];
    for(var d = Math.floor(Math.log10(lo)) - 1; d <= Math.ceil(Math.log10(hi)); d++) {
      for(var k = 0; k < MULT[m].length; k++) {
        var t = MULT[m][k] * Math.pow(10, d);
        if(t >= lo * 0.9999 && t <= hi * 1.0001) ticks.push(t);
      }
    }
    if(ticks.length >= 3) {
      ticks.sort(function(a, b) { return a - b; });
      return ticks;
    }
  }
  return null;
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

  // TAKOZ EKSENİ ÇÖZÜLEMEDİYSE ZAMANA DÜŞÜLMEZ.
  // Kayıtlı proje takoz eksenini (ör. "~mnt-frf:f") taşır ama takoz sonucu
  // oturumluktur; yeniden açılışta seri null döner. Aşağıdaki genel geri
  // düşüş devreye girerse ARAÇ zaman dizisi kullanılır ve pencere "Frekans
  // [Hz]" etiketiyle 0–30 s'lik bir ekseni çizer; imleç saniyeyi Hz diye okur.
  // Böyle bir durumda eksen YOK'tur — pencere boş durumunu göstersin.
  if(!arr && typeof veMntSignals !== 'undefined') {
    var _xid = (slot.xAxis && slot.xAxis.id) ? String(slot.xAxis.id) : '';
    var _cx = _xid.indexOf(':');
    if(veMntSignals.isMountSensor(_cx > 0 ? _xid.substring(0, _cx) : _xid)) return null;
  }

  if(!arr) {
    // İçe aktarılan ölçüm kendi zaman dizisini getirir (js/measure-import.js).
    // Simülasyonun time dizisiyle alakası yok; ilk sırada sorulur.
    if(ds && String(ds).indexOf('import:') === 0 && typeof veImpXSeries === 'function') {
      arr = veImpXSeries(ds);
    } else if(ds === 'segmentDrive' && r && r.segmentDrive && r.segmentDrive.time) {
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
var VE_TR_SLOT_KEYS = ['sensors', 'lanes', 'xAxis', 'type', '_dataSource', 'yAxisLock', 'zAxis', 'xLog', 'yLog'];

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

    // Log Y pano düzeyinde açılır ama ŞERİT BAŞINA uygulanır: aynı panoda
    // işaret değiştiren bir kuvvet şeridi ile hep pozitif bir iletilebilirlik
    // şeridi yan yana durabilir. Ayrık (basamaklı) şeritte log anlamsızdır —
    // seviye numaralarının logaritması diye bir şey yok.
    var yLog = !!(slot && slot.yLog) && anyData && !allDiscrete && !levels
               && veTrYLogOk(mn, mx);

    var range = anyData
      ? (yLog ? veTrLaneRangeLog(mn, mx) : veTrLaneRange(mn, mx, allDiscrete))
      : { min: 0, max: 1 };
    // Elle kilitlenen sınır log kipte POZİTİF olmak zorunda; lineer kipten
    // kalmış bir 0/negatif sınır sessizce yok sayılır (log10 tanımsız).
    if(L.min != null && isFinite(L.min) && (!yLog || L.min > 0)) range.min = L.min;
    if(L.max != null && isFinite(L.max) && (!yLog || L.max > 0)) range.max = L.max;
    if(range.max <= range.min) range.max = yLog ? range.min * 10 : range.min + 1;

    return {
      def: L,
      sigs: sigs,
      yLog: yLog,
      unit: sigs.length ? (sigs[0].sensor.unit || '') : '',
      title: sigs.length
        ? (veTrLaneTitle(sigs[0].sensor) + (sigs.length > 1 ? ' +' + (sigs.length - 1) : ''))
        : '',
      color: sigs.length ? sigs[0].color : '#888',
      discrete: allDiscrete,
      levels: levels,
      hasData: anyData,
      // Verinin HAM uçları (pay eklenmemiş). Log elverişliliği buradan
      // sorulur: lineer pay "aralığın %8'i" olduğu için tamamı pozitif bir
      // seride bile yMin sıfırın altına düşebilir ([0,5 … 7] → −0,02) ve
      // elverişli bir şerit elverişsiz görünürdü.
      vMin: anyData ? mn : NaN,
      vMax: anyData ? mx : NaN,
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
// ── Logaritmik X ekseni ──────────────────────────────────────────────────────
//
// NEDEN VAR: takozun frekans yanıtı 0,1–100 Hz arasında LOGARİTMİK örneklenir
// (js/mount-signals.js). Bunun sebebi süs değil: ζ=0,02'de rezonans tepesinin
// yarı-güç genişliği ~0,4 Hz'dir; eşit aralıklı bir ızgara o tepeyi ıskalar ve
// YANLIŞ bir tepe değeri raporlar. Ama aynı veri lineer eksende çizilince üç
// dekat 100 birimlik bir eksene sıkışır: 240 örneğin 160'ı genişliğin %10'una
// düşer, rezonans bölgesi tek piksellik bir sıçramaya döner.
//
// Çözüm ekseni logaritmik çizmek. Eşleme TEK noktada (veTrXPos / veTrXVal)
// olduğu için yakınlaştırma, kaydırma, imleç ve ızgara kendiliğinden uyar —
// tek koşul, bu iki fonksiyonun dışında elle x→piksel hesabı YAPILMAMASI.

// Log ekseni yalnız tüm veri POZİTİFSE mümkün. Zaman ekseni 0'dan başladığı
// için araç sinyallerinde kendiliğinden kapalı kalır.
function veTrXLogOk(arr) {
  if(!arr || !arr.length) return false;
  for(var i = 0; i < arr.length; i++) { if(!(arr[i] > 0)) return false; }
  return true;
}

// Pencerenin log kipinde olup olmadığı. Kullanıcı açıkça seçtiyse o, yoksa
// veri kümesinin önerisi (xAxis.scale), o da yoksa lineer.
function veTrXLogOn(slot, arr) {
  if(!veTrXLogOk(arr)) return false;
  if(slot && typeof slot.xLog === 'boolean') return slot.xLog;
  return !!(slot && slot.xAxis && slot.xAxis.scale === 'log');
}

function veTrXView(timeArr, isLog) {
  var dMin = (timeArr && timeArr.length) ? timeArr[0] : 0;
  var dMax = (timeArr && timeArr.length) ? timeArr[timeArr.length - 1] : 1;
  if(!(dMax > dMin)) dMax = dMin + 1;
  var xMin = (veTrState.xMin == null) ? dMin : veTrState.xMin;
  var xMax = (veTrState.xMax == null) ? dMax : veTrState.xMax;
  if(!(xMax > xMin)) { xMin = dMin; xMax = dMax; }
  // Log kipinde sıfır/negatif sınır tanımsızdır: saklanan görünüm penceresi
  // lineer kipten kalmış olabilir, sessizce veri sınırına çekilir.
  if(isLog) {
    if(!(dMin > 0)) dMin = 1e-9;
    if(!(xMin > 0)) xMin = dMin;
    if(!(xMax > xMin)) xMax = dMax;
  }
  return { xMin: xMin, xMax: xMax, dataMin: dMin, dataMax: dMax, xLog: !!isLog };
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
    if(lane.yLog) {
      // Log şeritte oluk genişliği bölme etiketlerinden doğar; uçların
      // biçimi (0,003 / 25) ölçekle birlikte değiştiği için ikisi de ölçülür.
      [lane.yMin, lane.yMax].forEach(function(v) { measure(veTrFmtLogTick(v)); });
      return;
    }
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
    dataMax: view.dataMax,
    xLog: !!view.xLog
  };
}

function veTrXPos(geo, t) {
  if(geo.xLog) {
    if(!(t > 0)) return geo.plotX - 1e6;      // çizim alanının dışına at
    var lo = Math.log10(geo.xMin), hi = Math.log10(geo.xMax);
    if(!(hi > lo)) return geo.plotX;
    return geo.plotX + (Math.log10(t) - lo) / (hi - lo) * geo.plotW;
  }
  return geo.plotX + (t - geo.xMin) / (geo.xMax - geo.xMin) * geo.plotW;
}

function veTrXVal(geo, px) {
  if(geo.xLog) {
    var lo = Math.log10(geo.xMin), hi = Math.log10(geo.xMax);
    return Math.pow(10, lo + (px - geo.plotX) / geo.plotW * (hi - lo));
  }
  return geo.xMin + (px - geo.plotX) / geo.plotW * (geo.xMax - geo.xMin);
}

// Değer → piksel. Log kipinde eşleme burada, TEK yerde değişir; ızgara,
// eğri, imleç ve işaretler hepsi buradan geçtiği için kendiliğinden uyar.
// Log şeritte v ≤ 0 tanımsızdır: NaN döner ve çizim o noktada kesilir
// (sıfıra kırpmak eğriyi olmadığı yerden geçirirdi).
function veTrYPos(lane, rect, v) {
  if(lane.yLog) {
    if(!(v > 0)) return NaN;
    var lo = Math.log10(lane.yMin), hi = Math.log10(lane.yMax);
    return rect.y + rect.h - (Math.log10(v) - lo) / (hi - lo) * rect.h;
  }
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
      // Log şeritte v ≤ 0 eşlenemez (NaN): kalem kaldırılır, eğri orada kesilir.
      if(!isFinite(y)) { started = false; continue; }
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
  // Log kipinde bölmeler ondalık (1-2-5); "adım" diye bir şey yok, o yüzden
  // liste önceden üretilir. Lineer kipte eski davranış aynen sürer.
  var step = veTrLaneStep(lane, ph);
  var dec = (typeof veAxisDecimals === 'function') ? veAxisDecimals(step) : 2;
  var yTicks = null;
  if(lane.yLog) {
    yTicks = veTrLogTickList(lane.yMin, lane.yMax);
    if(!yTicks) yTicks = [lane.yMin, Math.sqrt(lane.yMin * lane.yMax), lane.yMax];
  }
  var start = Math.ceil(lane.yMin / step) * step;
  var v, gy, _ti = 0;

  ctx.font = '9.5px ' + VE_TR.FONT;
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'right';

  for(v = yTicks ? yTicks[0] : start;
      yTicks ? (_ti < yTicks.length) : (v <= lane.yMax + step * 0.001);
      v = yTicks ? yTicks[++_ti] : v + step) {
    if(yTicks && !isFinite(v)) break;
    gy = veTrYPos(lane, rect, v);
    if(!isFinite(gy) || gy < y0 - 0.5 || gy > y0 + ph + 0.5) continue;

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
    } else if(lane.yLog) {
      // Ondalık sayısı DEĞERİN büyüklüğünden gelir: aynı eksende "0,003" ile
      // "25" yan yana durur, tek bir `dec` ikisini birden yazamaz.
      lbl = veTrFmtLogTick(v);
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

// Log eksende bölme değerleri: dekat başına 1-2-5. Dar yakınlaştırmada bu
// üçlü 3 etiketten az bırakırsa ara çarpanlar açılır; o da yetmezse lineer
// üreteç devreye girer (değerler yine log konuma çizilir, yalnız seçimleri
// eşit aralıklıdır). Amaç her yakınlaştırma seviyesinde okunur bir ızgara.
function veTrLogTicks(geo) {
  var ticks = veTrLogTickList(geo.xMin, geo.xMax);
  return ticks ? { ticks: ticks, step: null, dec: 0, log: true } : null;
}

// Log bölmesinin etiketi: ondalık sayısı DEĞERİN kendi büyüklüğünden gelir.
// Tek bir `dec` kullanılırsa aynı eksende "0.10" ile "100.00" yan yana yazılır.
function veTrFmtLogTick(v) {
  var a = Math.abs(v);
  var dec = a >= 10 ? 0 : (a >= 1 ? 1 : (a >= 0.1 ? 2 : 3));
  var s = v.toFixed(dec);
  if(dec > 0) s = s.replace(/\.?0+$/, '');
  return s;
}

function veTrTimeTicks(geo) {
  if(geo.xLog) {
    var lg = veTrLogTicks(geo);
    if(lg) return lg;
  }
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

  // Eksen adı sağ uçta — CANoe'da "[s]" burada durur. ÖNCE ölçülür: son bölme
  // etiketi adın altına girerse ikisi üst üste binip okunmaz oluyordu.
  ctx.font = '600 10px ' + VE_TR.FONT;
  var nameLeft = w - 4 - ctx.measureText(axisName).width - 8;

  ctx.font = '10px ' + VE_TR.FONT;
  ctx.fillStyle = 'rgba(140,140,155,0.95)';
  ctx.strokeStyle = 'rgba(140,140,155,0.6)';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';

  tick.ticks.forEach(function(t) {
    var gx = veTrXPos(geo, t);
    if(gx < geo.plotX - 1 || gx > geo.plotX + geo.plotW + 1) return;
    ctx.beginPath(); ctx.moveTo(gx, 1); ctx.lineTo(gx, 5); ctx.stroke();
    var lbl = tick.log ? veTrFmtLogTick(t)
      : ((typeof veFormatAxisVal === 'function') ? veFormatAxisVal(t, tick.dec) : String(t));
    // Çizgi kalır (ızgara hizası bozulmasın), yalnız ÇAKIŞAN etiket düşer
    if(gx + ctx.measureText(lbl).width / 2 > nameLeft) return;
    ctx.fillText(lbl, gx, 7);
  });

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
    veTrRenderNote([]);
    return;
  }

  veTrResetCache();
  var lanes = veTrBuildLanes(slot);
  var timeArr = veTrResolveX(slot);
  var view = veTrXView(timeArr, veTrXLogOn(slot, timeArr));

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
  // İşaretler eğrilerin ÜSTÜNE: altta kalsalar yoğun eğri onları gizlerdi.
  veTrDrawMarks(ctx, geo, lanes);
  // Yorum şeritlerden türer — şerit listesi ancak burada kesinleşiyor.
  veTrRenderNote(lanes);

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
  // Log eksende TEK bir ondalık sayısı yoktur: 0,1 ile 100 aynı kuralla
  // yazılamaz (dec=0 ile başlangıç "0 Hz" görünüyordu — okuyan 0'dan
  // başladığını sanır). Her değer kendi büyüklüğüne göre biçimlenir.
  var fmt = function(v) {
    if(geo.xLog) return veTrFmtLogTick(v);
    return (typeof veFormatAxisVal === 'function') ? veFormatAxisVal(v, dec) : String(v);
  };

  var h = '<div class="ve-trace-st-group">';
  h += '<span class="ve-trace-st-k">Başlangıç</span><span class="ve-trace-st-v">' + fmt(geo.xMin) + ' ' + u + '</span>';
  h += '<span class="ve-trace-st-k">Bitiş</span><span class="ve-trace-st-v">' + fmt(geo.xMax) + ' ' + u + '</span>';
  // Log eksende "bölme" diye sabit bir aralık yoktur — her dekat aynı genişliği
  // kaplar. Boş bir değer basmak yerine ölçeğin kendisi söylenir.
  if(geo.xLog) h += '<span class="ve-trace-st-k">Ölçek</span><span class="ve-trace-st-v">logaritmik</span>';
  else if(tick) h += '<span class="ve-trace-st-k">Bölme</span><span class="ve-trace-st-v">' + fmt(tick.step) + ' ' + u + '</span>';
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

// ── Diyagram üzerindeki işaretler ────────────────────────────────────────────
//
// Bir tepe niye orada? Hangi frekanstan sonra takoz işini yapıyor? Motorun
// asıl çalıştığı frekans nerede? Bunlar eğriye bakarak GÖRÜLEMEZ; sayı olarak
// biliniyor olmaları da yetmez — kullanıcının bakışıyla sayının buluşacağı yer
// grafiğin kendisidir. Bu yüzden çözümden çıkan kritik x/y değerleri eğrinin
// üstüne çizilir: rijit gövde modları, izolasyonun başladığı frekans, rölanti
// ateşleme frekansı, çekmenin/durdurucunun devreye girdiği ivme, ±10/±15 mm
// sınırları.
//
// İşaretler ANA katmana çizilir (imleç katmanına değil): sabit bilgidir, her
// fare hareketinde yeniden üretilmesi gerekmez.
var VE_TR_MARK_STYLE = {
  mode:  { v: '--accent-primary', a: 0.55, dash: [4, 3] },
  ref:   { v: null,               a: 0.45, dash: [2, 3] },
  event: { v: '--accent-primary', a: 0.85, dash: [] },
  warn:  { v: '--accent-danger',  a: 0.85, dash: [5, 3] },
  limit: { v: null,               a: 0.5,  dash: [6, 4] },
  stop:  { v: '--accent-warning', a: 0.7,  dash: [6, 4] }
};

function veTrMarkColor(kind, alpha) {
  var st = VE_TR_MARK_STYLE[kind] || VE_TR_MARK_STYLE.ref;
  var a = (alpha == null) ? st.a : alpha;
  if(!st.v) return 'rgba(130,130,145,' + a + ')';
  return (typeof veThemeRgba === 'function')
    ? veThemeRgba(st.v, a, 'rgba(59,130,246,' + a + ')')
    : 'rgba(59,130,246,' + a + ')';
}

// Panonun gösterdiği veri kümesinin işaretleri; yoksa boş.
function veTrMarks() {
  if(typeof veMntSignals === 'undefined') return [];
  var sets = (typeof veMntSets === 'function') ? veMntSets() : [];
  if(!sets.length) return [];
  var ds = veMntSignals.setOfSlot(sets, veTrBoard());
  return (ds && ds.brief && ds.brief.marks) ? ds.brief.marks : [];
}

function veTrDrawMarks(ctx, geo, lanes) {
  var marks = veTrMarks();
  if(!marks.length || !geo.rects.length) return;

  var top = geo.rects[0].y;
  var last = geo.rects[geo.rects.length - 1];
  var bot = last.y + last.h;

  ctx.save();
  ctx.font = '9px ' + VE_TR.FONT;
  ctx.textBaseline = 'middle';

  // ── Dikey (x) işaretler: tüm şeritleri boydan boya keser ──
  // Etiketler dik yazılır. Yatay yazılsalardı 6 rijit gövde modu birbirinin
  // üstüne binerdi; dik etiket dar eksende bile okunur ve eğriyi kapatmaz.
  var placed = [];
  marks.forEach(function(m) {
    if(m.axis !== 'x') return;
    var gx = veTrXPos(geo, m.value);
    if(gx < geo.plotX - 0.5 || gx > geo.plotX + geo.plotW + 0.5) return;
    var st = VE_TR_MARK_STYLE[m.kind] || VE_TR_MARK_STYLE.ref;

    ctx.setLineDash(st.dash);
    ctx.strokeStyle = veTrMarkColor(m.kind);
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(Math.round(gx) + 0.5, top);
    ctx.lineTo(Math.round(gx) + 0.5, bot);
    ctx.stroke();
    ctx.setLineDash([]);

    if(!m.label) return;
    // Çakışan etiket DÜŞER, çizgi kalır: bilgi kaybı yok, karmaşa yok.
    var clash = placed.some(function(px) { return Math.abs(px - gx) < 11; });
    if(clash) return;
    placed.push(gx);
    ctx.save();
    ctx.translate(gx - 2, top + 3);
    ctx.rotate(-Math.PI / 2);
    ctx.textAlign = 'right';
    ctx.fillStyle = veTrMarkColor(m.kind, 0.95);
    ctx.fillText(m.label, 0, 0);
    ctx.restore();
  });

  // ── Yatay (y) işaretler: yalnız BİRİMİ TUTAN şeride ──
  // "T = 1" çizgisini newton eksenli bir şeride çizmek anlamsız olurdu.
  marks.forEach(function(m) {
    if(m.axis !== 'y') return;
    lanes.forEach(function(lane, i) {
      if(m.unit != null && (lane.unit || '') !== m.unit) return;
      var rect = geo.rects[i];
      if(!rect) return;
      if(m.value < lane.yMin || m.value > lane.yMax) return;
      var gy = veTrYPos(lane, rect, m.value);
      var st = VE_TR_MARK_STYLE[m.kind] || VE_TR_MARK_STYLE.ref;
      ctx.setLineDash(st.dash);
      ctx.strokeStyle = veTrMarkColor(m.kind);
      ctx.beginPath();
      ctx.moveTo(geo.plotX, Math.round(gy) + 0.5);
      ctx.lineTo(geo.plotX + geo.plotW, Math.round(gy) + 0.5);
      ctx.stroke();
      ctx.setLineDash([]);
      if(!m.label) return;
      ctx.textAlign = 'left';
      ctx.fillStyle = veTrMarkColor(m.kind, 0.95);
      ctx.fillText(m.label, geo.plotX + 5, gy - 6);
    });
  });

  // ── Nokta işaretler: eğrinin ÜSTÜNDE tek bir çalışma noktası ──
  //
  // Neden çizgi değil nokta: "bu takoz kendi eğrisinin ŞURASINDA çalışıyor"
  // bilgisi iki koordinatı birden taşır (δ ve F). Dikey bir çizgi yalnız δ'yı
  // söyler; altı takozun altı farklı kuvveti tek çizgiye iner ve hangi noktanın
  // hangi eğriye ait olduğu kaybolur.
  //
  // chanId verilmişse nokta YALNIZ o kanalın çizili olduğu şeritte görünür ve
  // o kanalın RENGİNİ alır. Kanal şeritte yoksa nokta da çizilmez: başka bir
  // takozun eğrisi üstünde duran bir çalışma noktası yanlış okunurdu.
  var placedPt = [];
  marks.forEach(function(m) {
    if(m.axis !== 'point') return;
    var gx = veTrXPos(geo, m.value);
    if(gx < geo.plotX - 0.5 || gx > geo.plotX + geo.plotW + 0.5) return;
    lanes.forEach(function(lane, i) {
      if(m.unit != null && (lane.unit || '') !== m.unit) return;
      var rect = geo.rects[i];
      if(!rect) return;
      if(!(m.y >= lane.yMin) || !(m.y <= lane.yMax)) return;
      var col = null;
      if(m.chanId) {
        var hit = null;
        lane.sigs.forEach(function(g) {
          if(g.sensor && g.sensor.signal === m.chanId) hit = g;
        });
        if(!hit) return;
        col = hit.color;
      }
      var gy = veTrYPos(lane, rect, m.y);
      var c = col || veTrMarkColor(m.kind, 0.95);
      // Halka + dolu merkez: eğrinin üstünde durduğu için düz bir dolu daire
      // eğriyle karışırdı. Dış halka arka plan renginde, nokta eğri renginde.
      ctx.beginPath();
      ctx.arc(gx, gy, 5, 0, Math.PI * 2);
      ctx.fillStyle = (typeof veThemeRgba === 'function')
        ? veThemeRgba('--bg-primary', 0.85, 'rgba(20,22,28,0.85)') : 'rgba(20,22,28,0.85)';
      ctx.fill();
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = c;
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(gx, gy, 2, 0, Math.PI * 2);
      ctx.fillStyle = c;
      ctx.fill();
      if(!m.label) return;
      // Çakışan etiket DÜŞER, nokta kalır — çizgi işaretlerindeki kuralın aynısı.
      var clash = placedPt.some(function(p) {
        return Math.abs(p[0] - gx) < 60 && Math.abs(p[1] - gy) < 11;
      });
      if(clash) return;
      placedPt.push([gx, gy]);
      // Sağa sığmıyorsa sola yaz: kenardaki nokta etiketsiz kalmasın.
      var right = gx + 8 + ctx.measureText(m.label).width < geo.plotX + geo.plotW;
      ctx.textAlign = right ? 'left' : 'right';
      ctx.fillStyle = c;
      ctx.fillText(m.label, gx + (right ? 8 : -8), gy - 8);
    });
  });

  ctx.restore();
}

// ── Diyagram notu ────────────────────────────────────────────────────────────
//
// Grafiğin altındaki açıklama şeridi. Amaç: bu ekrana bakan HERKES — takoz
// mühendisi olmayan bir yönetici ya da müşteri dahil — eğrinin ne anlattığını
// okuyabilsin. Metin veri kümesinin kendisinden gelir (js/mount-signals.js
// INFO), yani "hangi grafiğe bakıyorum" sorusunu panonun kendisi cevaplar.
//
// GÖZE BATMAMA KURALI: kapalıyken tek satır, sönük renk, çerçevesiz. Açık/kapalı
// tercihi localStorage'da tutulur — kullanıcıya her açılışta aynı soruyu sormaz.
// Proje dosyasına GİRMEZ: bu bir okuma tercihi, model verisi değil.
var VE_TR_NOTE_KEY = 'mf-trace-note-open';

// VARSAYILAN AÇIK. Yorum artık genel geçer bir tanım değil, modelin kendi
// sayılarıyla yazılmış bir okuma; kullanıcının onu bulmak için bir şeye
// tıklaması gerekmemeli. Kapatma yine mümkün ve tercih hatırlanır.
function veTrNoteOpen() {
  try {
    var v = localStorage.getItem(VE_TR_NOTE_KEY);
    return v === null ? true : v === '1';
  } catch(e) { return true; }
}

function veTrSetNoteOpen(v) {
  try { localStorage.setItem(VE_TR_NOTE_KEY, v ? '1' : '0'); } catch(e) {}
}

// ── Yorum penceresinin boyu ──────────────────────────────────────────────────
//
// Kullanıcının ayarı. Şerit sayısı arttıkça yorum uzuyor; kimi zaman iki satır
// yeter, kimi zaman hepsi okunmak istenir — bu karar yazılımın değil kullanıcının.
// Ayar YOKSA CSS'teki üst sınır geçerli (panelin dörtte biri).
//
// Değer bir ÜST SINIR olarak uygulanır, sabit yükseklik olarak değil: kullanıcı
// aşağı sürükleyip yer açtığında metin kısaysa kutu boş uzamaz.
// Proje dosyasına GİRMEZ — okuma tercihi, model verisi değil.
var VE_TR_NOTE_H_KEY = 'mf-trace-note-h';
var VE_TR_NOTE_H_MIN = 44;

function veTrNoteH() {
  try {
    var v = parseInt(localStorage.getItem(VE_TR_NOTE_H_KEY), 10);
    return (isFinite(v) && v >= VE_TR_NOTE_H_MIN) ? v : null;
  } catch(e) { return null; }
}

function veTrSetNoteH(v) {
  try {
    if(v == null) localStorage.removeItem(VE_TR_NOTE_H_KEY);
    else localStorage.setItem(VE_TR_NOTE_H_KEY, String(Math.round(v)));
  } catch(e) {}
}

// Sürükleme sınırları: en az bir satır, en çok pencerenin yarısı. Üst sınır
// olmasa yorum grafiği tümüyle yutabilirdi; alt sınır olmasa şerit görünmez
// bir çizgiye inip geri açılamazdı.
function veTrNoteMaxH() {
  var host = document.getElementById('ve-trace');
  var h = host ? host.clientHeight : (typeof window !== 'undefined' ? window.innerHeight : 800);
  return Math.max(VE_TR_NOTE_H_MIN, Math.round(h * 0.5));
}

function veTrApplyNoteH(el) {
  var body = el ? el.querySelector('.ve-trace-note-body') : null;
  if(!body) return;
  var v = veTrNoteH();
  if(v == null) {
    // Ayar yok: yükseklik içeriğe göre, CSS'teki üst sınıra kadar.
    body.style.height = '';
    body.style.maxHeight = '';
    return;
  }
  // Ayar var: pencere TAM O BOYDA. Üst sınır olarak uygulamak yanlıştı —
  // metin kısa olduğunda tutamağı yukarı çekmek hiçbir şey yapmıyordu ve
  // kullanıcı düğmeyi bozuk sanıyordu. Ayarlanabilir bir pencere, içi boş
  // kalsa bile istenen boyda durur.
  var h = Math.min(v, veTrNoteMaxH());
  body.style.height = h + 'px';
  body.style.maxHeight = h + 'px';
}

// Tutamak sürüklemesi. Yukarı çekmek büyütür (şerit yukarı doğru büyür), bu
// yüzden delta ters işaretle uygulanır.
function veTrNoteGripDown(e, el) {
  var body = el.querySelector('.ve-trace-note-body');
  if(!body) return;
  if(!veTrNoteOpen()) { veTrSetNoteOpen(true); veTrRenderNote(null, true); return; }
  e.preventDefault();
  var startY = e.clientY;
  var startH = body.getBoundingClientRect().height;
  el.classList.add('resizing');

  var last = startH;
  function move(ev) {
    var next = startH + (startY - ev.clientY);
    next = Math.max(VE_TR_NOTE_H_MIN, Math.min(veTrNoteMaxH(), next));
    last = next;
    body.style.height = next + 'px';
    body.style.maxHeight = next + 'px';
    veTrNoteOverflow(el);
  }
  function up() {
    document.removeEventListener('mousemove', move);
    document.removeEventListener('mouseup', up);
    el.classList.remove('resizing');
    // Ölçülen değil SÜRÜKLENEN değer saklanır: kutu içeriğinden kısaysa
    // ölçüm içeriği verir ve kullanıcının seçtiği boy sessizce kaybolurdu.
    veTrSetNoteH(last);
    // Şerit boyu değişti → grafik alanı da değişti, yeniden çiz.
    if(typeof veTrRenderSoon === 'function') veTrRenderSoon(); else veTrRender();
  }
  document.addEventListener('mousemove', move);
  document.addEventListener('mouseup', up);
}

// Pencerenin gösterdiği veri kümesinin açıklaması; yoksa null.
// Açıklaması olmayan bir pano (araç sinyalleri, boş pano) için şerit hiç
// çizilmez — söyleyecek sözü olmayan bir kutu, gürültüden başka bir şey değil.
// Panodaki HER ŞERİT için bir yorum. Yorum, o şeritte hangi kanalların
// birlikte durduğuna göre değişir — tek bir kanal ile dokuz kanalın üst üste
// bindiği hâl farklı şeyler anlatır, tek metin ikisine birden hizmet edemez.
// Bu yüzden çözüm anında değil ÇİZİM anında üretilir.
function veTrNoteEntries(lanes) {
  if(typeof veMntSignals === 'undefined' || typeof veMntBrief === 'undefined') return [];
  var sets = (typeof veMntSets === 'function') ? veMntSets() : [];
  if(!sets.length) return [];
  var R = (typeof window !== 'undefined') ? window.veMountResults : null;
  if(!R) return [];
  var slot = veTrBoard();
  var ds = veMntSignals.setOfSlot(sets, slot);
  if(!ds) return [];

  if(!lanes) {
    try { lanes = veTrBuildLanes(slot); } catch(e) { return []; }
  }
  var out = [];
  (lanes || []).forEach(function(lane) {
    var ids = (lane.sigs || []).map(function(g) { return g.sensor.signal; });
    if(!ids.length) return;
    var br = veMntBrief.forLane(ds, R, ids);
    if(br && br.paras && br.paras.length) out.push(br);
  });
  return out;
}

// Kapalı hâlde görünen tek satır — panonun genel özeti.
function veTrNoteLead() {
  if(typeof veMntSignals === 'undefined') return null;
  var sets = (typeof veMntSets === 'function') ? veMntSets() : [];
  if(!sets.length) return null;
  var ds = veMntSignals.setOfSlot(sets, veTrBoard());
  return (ds && ds.brief) ? { name: ds.name, lead: ds.brief.lead || '' } : null;
}

// Kaçış: tarayıcıda signal-tree'nin veSigEsc'i, Jest'te (tek dosya require
// edildiğinde) yerel yedek. Metin sabit olsa da kaçışsız innerHTML alışkanlığı
// açılmaz.
function _veTrEsc(s) {
  if(typeof veSigEsc === 'function') return veSigEsc(s);
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// Zengin metin: yorum motoru HTML DEĞİL, `**vurgu**` işaretli düz metin
// üretir. Burada önce KAÇIRILIR, sonra işaret <b>'ye çevrilir — sıra bu
// olmalı; ters çevrilirse üretilen her cümle bir enjeksiyon yüzeyi olur.
function _veTrRich(s) {
  return _veTrEsc(s).replace(/\*\*([^*]+)\*\*/g,
    '<b class="ve-trace-note-b">$1</b>');
}

function veTrNoteHTML(entries, lead) {
  if(!entries || !entries.length) return '';
  var open = veTrNoteOpen();
  var multi = entries.length > 1;
  var h = '<div class="ve-trace-note-grip" data-act="note-grip" ' +
          'title="Yorum penceresinin boyunu sürükleyerek ayarlayın"></div>';
  h += '<button type="button" class="ve-trace-note-head" data-act="note-toggle"' +
          ' aria-expanded="' + (open ? 'true' : 'false') + '"' +
          ' title="Yorumu ' + (open ? 'gizle' : 'göster') + '">';
  h += '<span class="mf-ico mf-ico-lightbulb"></span>';
  h += '<span class="ve-trace-note-title">' +
       _veTrEsc(multi ? (entries.length + ' şerit') : entries[0].title) + '</span>';
  h += '<span class="ve-trace-note-line">' + _veTrEsc((lead && lead.lead) || '') + '</span>';
  h += '<span class="ve-trace-note-caret" aria-hidden="true">▾</span>';
  h += '</button>';
  h += '<div class="ve-trace-note-body">';
  entries.forEach(function(e) {
    h += '<section class="ve-trace-note-sec">';
    // Başlık YALNIZ birden çok şerit varken: tek şeritte üstteki satır zaten
    // aynı şeyi söylüyor, ikinci kez yazmak yer israfı.
    if(multi) h += '<h4 class="ve-trace-note-h">' + _veTrEsc(e.title) + '</h4>';
    e.paras.forEach(function(p) {
      h += '<p class="ve-trace-note-p">' + _veTrRich(p) + '</p>';
    });
    h += '</section>';
  });
  h += '</div>';
  h += '<div class="ve-trace-note-more">↓ devamı var — yorumu kaydırın</div>';
  return h;
}

// Yorum penceredeki yerine sığdı mı? Sığmadıysa alt kenar sönüyor ve "devamı
// var" satırı açılıyor. Ölçüm ancak DOM'a basıldıktan sonra yapılabilir:
// scrollHeight, yerleşim tamamlanmadan doğru değeri vermez.
function veTrNoteOverflow(el) {
  if(!el) return;
  var body = el.querySelector('.ve-trace-note-body');
  var more = el.querySelector('.ve-trace-note-more');
  if(!body) return;
  var over = veTrNoteOpen() && body.scrollHeight > body.clientHeight + 1;
  body.classList.toggle('has-more', over);
  if(more) more.classList.toggle('on', over);
}

// Son çizilen not — her veTrRender'da (yani her yakınlaştırma/sürükleme
// karesinde) innerHTML yeniden kurulmasın diye. Şerit yalnız veri kümesi ya da
// açık/kapalı durumu değişince yeniden çizilir.
var _veTrNoteKey = null;

function veTrRenderNote(lanes, force) {
  var el = document.getElementById('ve-trace-note');
  if(!el) return;
  var entries = veTrNoteEntries(lanes);
  var lead = veTrNoteLead();
  // Anahtar şeritlerin BAŞLIKLARINDAN kurulur: kanal eklenip çıkarıldığında
  // yorum değişmeli, ama yakınlaştırma/sürükleme karesinde yeniden kurulmamalı.
  var key = entries.map(function(e) { return e.title; }).join('¦') +
            '|' + entries.length + '|' + (veTrNoteOpen() ? '1' : '0');
  if(!force && key === _veTrNoteKey) return;
  _veTrNoteKey = key;

  if(!entries.length) { el.style.display = 'none'; el.innerHTML = ''; el.classList.remove('open'); return; }
  el.style.display = '';
  el.classList.toggle('open', veTrNoteOpen());
  el.innerHTML = veTrNoteHTML(entries, lead);
  veTrApplyNoteH(el);
  veTrNoteOverflow(el);
  if(el._veTrBound) return;
  el._veTrBound = true;
  el.addEventListener('mousedown', function(e) {
    if(!e.target.closest('[data-act="note-grip"]')) return;
    veTrNoteGripDown(e, el);
  });
  el.addEventListener('click', function(e) {
    if(!e.target.closest('[data-act="note-toggle"]')) return;
    veTrSetNoteOpen(!veTrNoteOpen());
    veTrRenderNote(null, true);
  });
  // Çift tık: kullanıcının boy ayarını sıfırla (varsayılan üst sınıra dön).
  el.addEventListener('dblclick', function(e) {
    if(!e.target.closest('[data-act="note-grip"]')) return;
    veTrSetNoteH(null);
    veTrRenderNote(null, true);
    if(typeof veTrRenderSoon === 'function') veTrRenderSoon();
  });
  // Kullanıcı sona kaydırınca "devamı var" ipucu kalkar; pencere yeniden
  // boyutlandığında taşma durumu değişebilir — ikisi de yeniden ölçülür.
  el.addEventListener('scroll', function() {
    var body = el.querySelector('.ve-trace-note-body');
    if(!body) return;
    var atEnd = body.scrollTop + body.clientHeight >= body.scrollHeight - 2;
    var more = el.querySelector('.ve-trace-note-more');
    if(more) more.classList.toggle('on', !atEnd && body.scrollHeight > body.clientHeight + 1);
    body.classList.toggle('has-more', !atEnd && body.scrollHeight > body.clientHeight + 1);
  }, true);
  if(typeof ResizeObserver !== 'undefined') {
    try { new ResizeObserver(function() { veTrNoteOverflow(el); }).observe(el); } catch(e) {}
  }
}

// ── Boş durum ────────────────────────────────────────────────────────────────
//
// İki farklı engel var ve ikisi FARKLI şey söylemeli. Çözüm hiç çalışmadıysa
// sinyal işaretlemenin faydası yok — çizilecek veri yok; kullanıcıyı sinyal
// listesine yollamak onu boş bir şeride götürür. Çözüm varsa asıl eksik
// gerçekten sinyal seçimidir.
function veTrEmptyHTML() {
  // İçe aktarılmış ölçüm de çizilecek veridir: varsa "önce çözümü çalıştırın"
  // demek yanlış olur — kullanıcının verisi zaten var, eksik olan sinyal seçimi.
  var hasImport = (typeof veImpAny === 'function') && veImpAny();
  // Takoz sekmesi ARAÇ çözümünden bağımsız beslenir (window.veMountResults):
  // yalnız takoz modelini çözmüş kullanıcıya "çözüm sonucu yok" demek yanlış
  // olurdu — verisi var, eksik olan sinyal seçimi.
  var mntOnly = (typeof veActiveSolverTabId !== 'undefined') && veActiveSolverTabId === 'mount' &&
                (typeof veMntSets === 'function') && veMntSets().length > 0;
  var noSim = !window.veSimResults && !hasImport && !mntOnly;
  var h = '';

  // VIEWER FARKI: burada çözücü YOK. MFSim'in "Çözüm sonucu yok / Çözücüyü Aç"
  // metni tek başına kullanılan görüntüleyicide olmayan bir şeye işaret eder ve
  // kullanıcı beklemediği bir eksiklik arar. Ayrım çözücünün VARLIĞINA bakarak
  // yapılıyor (dalın kendisi duruyor) — böylece MFSim'den gelecek bir düzeltme
  // yine bu bloğa temiz uygulanır.
  if(noSim && typeof veSolverRun !== 'function') {
    h += '<div class="ve-trace-empty-ico"><span class="mf-ico mf-ico-upload"></span></div>';
    h += '<div class="ve-trace-empty-title">Henüz ölçüm yok</div>';
    h += '<div class="ve-trace-empty-sub">Bir Excel (.xlsx) ya da CSV ölçüm dosyası açın — ' +
         'sütunları seçin, her sinyal kendi şeridinde çizilsin.</div>';
    if(typeof veImpOpenPicker === 'function') {
      h += '<button type="button" class="ve-trace-btn" data-act="import-measure" ' +
           'style="height:26px;margin-top:6px;">' +
           '<span class="mf-ico mf-ico-upload"></span> Ölçüm Verisi İçe Aktar</button>';
    }
    return h;
  }

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
    // Çözüm koşmak tek yol değil: hazır bir ölçüm dosyası da çizilebilir.
    if(typeof veImpOpenPicker === 'function') {
      h += '<div class="ve-trace-empty-sub" style="margin-top:10px;">ya da elinizdeki ' +
           'ölçüm dosyasını (Excel/CSV) doğrudan açın:</div>';
      h += '<button type="button" class="ve-trace-btn" data-act="import-measure" ' +
           'style="height:26px;margin-top:4px;">' +
           '<span class="mf-ico mf-ico-upload"></span> Ölçüm Verisi İçe Aktar</button>';
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

  // Log/lineer anahtarı — yalnız veri buna elverişliyse (tüm x > 0) görünür.
  // Frekans yanıtı gibi çok dekatlı eğrilerde lineer eksen okunmaz olur;
  // düğme kapalıyken de görünüp kilitli durmaz, hiç çizilmez: kullanabildiği
  // yerde teklif edilir, kullanamadığı yerde ortada durmaz.
  var _xArr = veTrResolveX(slot);
  if(veTrXLogOk(_xArr)) {
    var logOn = veTrXLogOn(slot, _xArr);
    h += '<button type="button" class="ve-trace-btn" data-act="xlog"' +
         ' aria-pressed="' + (logOn ? 'true' : 'false') + '"' +
         (logOn ? ' style="color:var(--accent-primary);border-color:var(--accent-primary);"' : '') +
         ' title="' + (logOn
            ? 'Logaritmik X ekseni açık — lineer eksene geç'
            : 'X eksenini logaritmik yap (geniş frekans aralığı okunur hâle gelir)') +
         '">log x</button>';
  }

  // Log Y — yalnız en az bir şerit buna elverişliyse (tüm değerleri pozitif,
  // ayrık değil). İletilebilirlik üç mertebe değişir: lineer eksende izolasyon
  // bölgesi grafiğin dibine yapışır ve 0,003 ile 0,03 ayırt edilmez.
  if(veTrYLogAny(slot)) {
    var yOn = !!slot.yLog;
    h += '<button type="button" class="ve-trace-btn" data-act="ylog"' +
         ' aria-pressed="' + (yOn ? 'true' : 'false') + '"' +
         (yOn ? ' style="color:var(--accent-primary);border-color:var(--accent-primary);"' : '') +
         ' title="' + (yOn
            ? 'Logaritmik Y ekseni açık — lineer eksene geç'
            : 'Y eksenini logaritmik yap (küçük değerler de okunur hâle gelir)') +
         '">log y</button>';
  }

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
  // VIEWER FARKI (MFSim'de üçüncü kip '3B' de var): 3B dağılım Three.js
  // gerektiriyor ve tek dosyalık görüntüleyiciye ~600 KB ekliyordu. Ölçüm
  // okumanın çekirdeğinde değil — kip listeden çıkarıldı, kodu duruyor.
  [['line', 'İz'], ['table', 'Tablo']].forEach(function(m) {
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
// Yakınlaştırma/kaydırma ÇİZİM UZAYINDA yapılır: log eksende pencere
// log10 tabanında daraltılır. Aksi halde log eksende tekerleği çevirmek
// sol uçta hiç, sağ uçta aşırı yakınlaştırırdı — fare nerede duruyorsa orada
// aynı oranda yakınlaşmalı.
function _veTrFwd(geo, v) { return geo.xLog ? Math.log10(v) : v; }
function _veTrInv(geo, v) { return geo.xLog ? Math.pow(10, v) : v; }

function veTrZoom(factor, focus) {
  var geo = veTrState.geo;
  if(!geo) return;
  var lo = _veTrFwd(geo, geo.xMin), hi = _veTrFwd(geo, geo.xMax);
  var dLo = _veTrFwd(geo, geo.dataMin), dHi = _veTrFwd(geo, geo.dataMax);
  var c = (focus == null) ? (lo + hi) / 2 : _veTrFwd(geo, focus);
  var span = (hi - lo) / factor;
  var full = dHi - dLo;
  // Tam veriden geniş bir pencereye izin verilmez: sağda solda boşluk kalır,
  // "sığdır" ile ayırt edilemez bir duruma düşer.
  if(span >= full) { veTrFit(); return; }
  if(span < full / 5000) span = full / 5000;
  var f = (hi > lo) ? (c - lo) / (hi - lo) : 0.5;
  var nMin = c - span * f;
  var nMax = nMin + span;
  if(nMin < dLo) { nMin = dLo; nMax = nMin + span; }
  if(nMax > dHi) { nMax = dHi; nMin = nMax - span; }
  veTrState.xMin = _veTrInv(geo, nMin);
  veTrState.xMax = _veTrInv(geo, nMax);
  veTrRender();
}

// Log ↔ lineer. Eksen ALANI değişmiyor (aynı büyüklük, aynı birim), yalnız
// çizim ölçeği değişiyor; yine de görünüm penceresi sıfırlanır: lineer kipte
// seçilmiş bir aralık log kipte ekranın tamamını kaplayabilir.
// Panoda log Y'ye elverişli en az bir şerit var mı? Düğme yalnız o zaman
// görünür — kullanamadığı yerde kilitli bir düğme durmasın.
//
// Soru şeridin ÇİZİM aralığına değil verinin HAM uçlarına (vMin/vMax) sorulur:
// çizim aralığı kipin kendisine göre kurulduğu için ona bakmak sorunun cevabını
// sorunun içine koymak olurdu.
function veTrYLogAny(slot) {
  if(!slot) return false;
  var lanes;
  try { lanes = veTrBuildLanes(slot); } catch(e) { lanes = []; }
  return lanes.some(function(lane) {
    return lane.hasData && !lane.discrete && !lane.levels
        && veTrYLogOk(lane.vMin, lane.vMax);
  });
}

// Log ↔ lineer Y. X'ten farkı: görünüm penceresi X'e ait olduğu için
// sıfırlanmaz — Y ölçeği değişince zaman/frekans penceresi değişmemeli.
function veTrToggleYLog() {
  var slot = veTrBoard();
  if(!veTrYLogAny(slot)) return;
  slot.yLog = !slot.yLog;
  veTrRender();
  if(typeof veSyncBoardState === 'function') veSyncBoardState();
}

function veTrToggleXLog() {
  var slot = veTrBoard();
  var arr = veTrResolveX(slot);
  if(!veTrXLogOk(arr)) return;
  slot.xLog = !veTrXLogOn(slot, arr);
  veTrResetView();
  veTrRender();
  if(typeof veSyncBoardState === 'function') veSyncBoardState();
}

function veTrPan(dxPixels) {
  var geo = veTrState.geo;
  if(!geo) return;
  var lo = _veTrFwd(geo, geo.xMin), hi = _veTrFwd(geo, geo.xMax);
  var dLo = _veTrFwd(geo, geo.dataMin), dHi = _veTrFwd(geo, geo.dataMax);
  var span = hi - lo;
  var d = dxPixels / geo.plotW * span;
  var nMin = lo - d, nMax = hi - d;
  if(nMin < dLo) { nMin = dLo; nMax = nMin + span; }
  if(nMax > dHi) { nMax = dHi; nMin = nMax - span; }
  veTrState.xMin = _veTrInv(geo, nMin);
  veTrState.xMax = _veTrInv(geo, nMax);
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
  // İçe aktarma panosu temizlenince ölçümün zaman ekseni de kalksın
  if(typeof veImpDropStaleAxis === 'function') veImpDropStaleAxis(slot);
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
  // Not şeridi kipe bağlı değil: tabloya geçen kullanıcı da neye baktığını
  // okuyabilmeli. Tek giriş noktası burası — çizim yolları ikiye ayrılıyor.
  veTrRenderNote();
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
  h += '<div class="ve-trace-note" id="ve-trace-note"></div>';
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
      if(b && typeof veSolverRun === 'function') { veSolverRun(); return; }
      var imp = e.target.closest('[data-act="import-measure"]');
      if(imp && typeof veImpOpenPicker === 'function') veImpOpenPicker();
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
    else if(act === 'xlog') veTrToggleXLog();
    else if(act === 'ylog') veTrToggleYLog();
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
    veTrNoteHTML: veTrNoteHTML,
    veTrXLogOk: veTrXLogOk,
    veTrXLogOn: veTrXLogOn,
    veTrXView: veTrXView,
    veTrXPos: veTrXPos,
    veTrXVal: veTrXVal,
    veTrLogTicks: veTrLogTicks,
    veTrLogTickList: veTrLogTickList,
    veTrYLogOk: veTrYLogOk,
    veTrYLogAny: veTrYLogAny,
    veTrLaneRangeLog: veTrLaneRangeLog,
    veTrBuildLanes: veTrBuildLanes,
    veTrYPos: veTrYPos,
    veTrTimeTicks: veTrTimeTicks,
    veTrFmtLogTick: veTrFmtLogTick,
    veTrFmt: veTrFmt,
    veTrInRect: veTrInRect,
    veTrLaneCloseRect: veTrLaneCloseRect,
    veTrLaneGrabRect: veTrLaneGrabRect,
    veTrHitLane: veTrHitLane,
    veTrHitResize: veTrHitResize
  };
}
