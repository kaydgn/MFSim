// ═══════════════════════════════════════════════════════════════════════════════
// SİNYAL AĞACI — Veri Gezgini'nin ölçüm kanalı listesi
//
// Tasarım kararları (bkz. sensör paneli tasarım çalışması):
//   • Tek satır ritmi   — grup başlığı da sinyal satırı da 22px. Girinti CSS'te
//                         tek değişkenle (--vsig-indent) verilir; JS'te elle
//                         padding-left hesabı YOK.
//   • Durum satırda     — onay kutusu = sinyal hedef panelde çizili mi;
//                         renk kutucuğu = o paneldeki eğri rengi. Kullanıcı
//                         paneli açıp kontrol etmek zorunda kalmaz.
//   • Üç durumlu grup   — bileşenin tüm sinyalleri tek tıkla açılır/kapanır,
//                         kısmi seçim ayrı bir durumdur.
//   • Sütun hizası      — birim sağa hizalı ve tabular; göz tek dikey çizgiyi
//                         takip eder.
//   • Denetçi           — renk / istatistik / kullanıldığı diyagramlar satırın
//                         içine sıkıştırılmaz, çift tıkla açılan katmana gider.
//
// Bu dosyadaki saf yardımcılar (norm/stat/spark/grup durumu) Jest'te doğrudan
// test edilir; DOM'a dokunanlar tarayıcıda çalışır.
// ═══════════════════════════════════════════════════════════════════════════════

// Grafik eğri paleti — js/graphics.js ve js/results.js ile AYNI sırada olmalı,
// yoksa listedeki renk kutucuğu ile paneldeki eğri rengi ayrışır.
var VE_SIGNAL_COLORS = ['#3b82f6', '#ef4444', '#22c55e', '#f59e0b', '#8b5cf6', '#ec4899'];

var veSigState = {
  open: {},        // grupKey → açık mı
  query: '',       // arama metni
  target: 0,       // hedef panel indeksi (onay kutusunun yazdığı panel)
  filter: 'all',   // 'all' | 'on' | 'off'
  inspect: null    // { sensorId, signalId } — denetçi katmanı açıksa
};

// ── Metin yardımcıları ────────────────────────────────────────────────────────

function veSigEsc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// Aramada kullanılan katlama. UZUNLUK KORUYUCU olmak zorunda: vurgulama
// indeksleri ham metne uygulanıyor. 'İ'.toLocaleLowerCase('tr') iki karakter
// ürettiği için toLocaleLowerCase kullanılmaz. Aksanlar da katlanır, böylece
// "hiz" yazan kullanıcı "Hız"ı bulur.
var VE_SIG_FOLD = {
  'I': 'i', 'İ': 'i', 'ı': 'i', 'Ş': 's', 'ş': 's', 'Ğ': 'g', 'ğ': 'g',
  'Ü': 'u', 'ü': 'u', 'Ö': 'o', 'ö': 'o', 'Ç': 'c', 'ç': 'c',
  'Â': 'a', 'â': 'a', 'Î': 'i', 'î': 'i', 'Û': 'u', 'û': 'u'
};

function veSigNorm(s) {
  s = String(s == null ? '' : s);
  var out = '', i, c;
  for(i = 0; i < s.length; i++) {
    c = s.charAt(i);
    out += (VE_SIG_FOLD[c] || c.toLowerCase());
  }
  return out;
}

function veSigMatches(text, q) {
  if(!q) return true;
  return veSigNorm(text).indexOf(veSigNorm(q)) >= 0;
}

// Eşleşen parçayı <mark> ile sarar. Katlama uzunluk koruduğu için ham metnin
// indeksleri geçerli kalır — Türkçe karakterler bozulmadan vurgulanır.
function veSigHighlight(text, q) {
  var t = String(text == null ? '' : text);
  if(!q) return veSigEsc(t);
  var i = veSigNorm(t).indexOf(veSigNorm(q));
  if(i < 0) return veSigEsc(t);
  return veSigEsc(t.slice(0, i)) +
         '<mark class="vsig-hit">' + veSigEsc(t.slice(i, i + q.length)) + '</mark>' +
         veSigEsc(t.slice(i + q.length));
}

// Liste ve denetçi için ölçü duyarlı sayı biçimi.
function veSigFmt(v) {
  var n = Number(v);
  if(v == null || !isFinite(n)) return '—';
  var a = Math.abs(n);
  if(a >= 10000) return n.toFixed(0);
  if(a >= 1000)  return n.toFixed(1);
  if(a >= 10)    return n.toFixed(2);
  if(a >= 1)     return n.toFixed(3);
  if(a === 0)    return '0';
  return n.toFixed(4);
}

// ── Sinyal ↔ panel bağı ───────────────────────────────────────────────────────

// Sinyalin slottaki indeksi; yoksa -1. Renk ve onay durumu buradan türer.
function veSigIndexInSlot(slot, sensorId, signalId) {
  if(!slot || !slot.sensors) return -1;
  for(var i = 0; i < slot.sensors.length; i++) {
    if(slot.sensors[i].id === sensorId && slot.sensors[i].signal === signalId) return i;
  }
  return -1;
}

// Slottaki i. eğrinin rengi: kullanıcı seçtiyse o, yoksa palet sırası.
// Grafik, lejant, tablo ve ağaç HEPSİ bunu çağırır — tek doğruluk kaynağı.
function veSlotSignalColor(slot, idx) {
  if(slot && slot.sensors && slot.sensors[idx] && slot.sensors[idx].color) {
    return slot.sensors[idx].color;
  }
  return VE_SIGNAL_COLORS[((idx % VE_SIGNAL_COLORS.length) + VE_SIGNAL_COLORS.length) % VE_SIGNAL_COLORS.length];
}

// Grup üç-durumu: hepsi / bir kısmı / hiçbiri.
function veSigGroupState(items, slot) {
  var on = 0;
  (items || []).forEach(function(it) {
    if(veSigIndexInSlot(slot, it.sensorId, it.signalId) >= 0) on++;
  });
  var total = (items || []).length;
  return {
    on: on,
    total: total,
    state: (total > 0 && on === total) ? 'all' : (on > 0 ? 'some' : 'none')
  };
}

// ── Seri istatistiği ve mini eğri ─────────────────────────────────────────────

function veSigStats(series) {
  if(!series || !series.length) return null;
  var mn = Infinity, mx = -Infinity, sum = 0, n = 0, i, v;
  for(i = 0; i < series.length; i++) {
    v = Number(series[i]);
    if(!isFinite(v)) continue;
    if(v < mn) mn = v;
    if(v > mx) mx = v;
    sum += v; n++;
  }
  if(!n) return null;
  return { min: mn, max: mx, avg: sum / n, n: n };
}

// Seriyi sabit sayıda noktaya indirger ve kutuya normalize eder.
// Sabit seride (span=0) düz orta çizgi döner — sıfıra bölme yok.
function veSigSparkPoints(series, w, h, samples) {
  if(!series || series.length < 2 || !(w > 2) || !(h > 3)) return '';
  samples = Math.max(2, Math.min(samples || 32, series.length));
  var n = series.length, step = (n - 1) / (samples - 1);
  var vals = [], i, v;
  for(i = 0; i < samples; i++) {
    v = Number(series[Math.round(i * step)]);
    vals.push(isFinite(v) ? v : 0);
  }
  var mn = Math.min.apply(null, vals), mx = Math.max.apply(null, vals);
  var span = mx - mn;
  var pts = [], x, y;
  for(i = 0; i < samples; i++) {
    x = (i / (samples - 1)) * (w - 2) + 1;
    y = span > 0 ? (1 - (vals[i] - mn) / span) * (h - 3) + 1.5 : h / 2;
    pts.push(x.toFixed(1) + ',' + y.toFixed(1));
  }
  return pts.join(' ');
}

// Bir render turunda aynı sinyal defalarca istenir (satır + denetçi). veGetSensorData
// düğüm araması yaptığı için tur başına önbelleklenir; ağaç her çizimde sıfırlanır.
var veSigDataCache = {};

function veSigResetCache() { veSigDataCache = {}; }

function veSigSeries(sensorId, signalId) {
  var k = sensorId + ' ' + signalId;
  if(Object.prototype.hasOwnProperty.call(veSigDataCache, k)) return veSigDataCache[k];
  var d = null;
  if(typeof veGetSensorData === 'function') {
    try { d = veGetSensorData(sensorId, signalId); } catch(e) { d = null; }
  }
  veSigDataCache[k] = d;
  return d;
}

function veSigSparkSVG(points, color, w, h) {
  if(!points) return '<span class="vsig-spark vsig-spark-empty" aria-hidden="true"></span>';
  return '<svg class="vsig-spark" width="' + w + '" height="' + h + '" viewBox="0 0 ' + w + ' ' + h +
         '" preserveAspectRatio="none" aria-hidden="true">' +
         '<polyline points="' + points + '" fill="none" stroke="' + color +
         '" stroke-width="1.2" stroke-linejoin="round" stroke-linecap="round" ' +
         'vector-effect="non-scaling-stroke"/></svg>';
}

// ── Bileşen meta verisi ───────────────────────────────────────────────────────

var VE_SIG_ICONS = {
  'engine': 'settings', 'engine-brake': 'settings', 'torque-converter': 'disc',
  'gearbox': 'settings', 'shift-controller': 'refresh', 'transfer': 'shuffle',
  'propshaft': 'nut', 'differential': 'settings', 'wheel': 'wheel',
  'vehicle': 'car', 'road': 'route', 'scenario': 'trending-up', 'solver': 'ruler'
};

// Ağaçtaki bileşen sırası — güç akışı yönünde. Listede olmayan tipler sona.
var VE_SIG_ORDER = ['engine', 'engine-brake', 'torque-converter', 'gearbox',
  'shift-controller', 'transfer', 'propshaft', 'differential', 'wheel',
  'vehicle', 'road', 'scenario', 'solver'];

function veSigCompIcon(compType) {
  return '<span class="mf-ico mf-ico-' + (VE_SIG_ICONS[compType] || 'settings') + '"></span>';
}

function veSigCompName(compType, compNode) {
  if(compNode && compNode.customName) return compNode.customName;
  if(typeof componentDefs !== 'undefined' && componentDefs[compType]) return componentDefs[compType].name;
  return compType;
}

function veSigMeta(compType, signalId) {
  var defs = (typeof COMPONENT_SIGNALS !== 'undefined' && COMPONENT_SIGNALS[compType])
    ? (COMPONENT_SIGNALS[compType].outputs || []) : [];
  for(var i = 0; i < defs.length; i++) {
    if(defs[i].id === signalId) return { name: defs[i].name, unit: defs[i].unit || '' };
  }
  return { name: signalId, unit: '' };
}

// ── Kanal toplama ─────────────────────────────────────────────────────────────
//
// Fiziksel sensörler (bağlantıya veya bileşene tutturulmuş) ile sihirbazın
// sanal sensörleri TEK listede birleşir. Eski ağaçta ikisi ayrı dallardı ve
// aynı sinyal iki yerde görünebiliyordu; artık bileşen başına tek grup var.

// Bir fiziksel sensörün hangi bileşenden, hangi yönde ve hangi sinyalleri
// okuduğunu çözer.
function veSigSensorChannels(sensor, tabNodeObjs, tabConns) {
  var compType = '', compNode = null, dir = 'comp';
  var d = sensor.data || {};

  if(d.attachedConnection) {
    var conn = (tabConns || []).find(function(c) { return c.id === d.attachedConnection; });
    if(conn) {
      var sDir = d.sensorDirection || 'from';
      var wantId = (sDir === 'to') ? conn.to : conn.from;
      compNode = (tabNodeObjs || []).find(function(n) { return n.id === wantId; }) || null;
      if(compNode) { compType = compNode.type; dir = (sDir === 'to') ? 'in' : 'out'; }
    }
  }
  if(!compType && d.attachedComponent) {
    compNode = (tabNodeObjs || []).find(function(n) { return n.id === d.attachedComponent; }) || null;
    if(compNode) { compType = compNode.type; dir = 'comp'; }
  }
  if(!compType) return null;

  var all = (typeof COMPONENT_SIGNALS !== 'undefined' && COMPONENT_SIGNALS[compType])
    ? (COMPONENT_SIGNALS[compType].outputs || []) : [];

  // Bağlantı sensörü yön filtresi: giriş sensörü yalnızca *_in sinyallerini,
  // çıkış sensörü *_in DIŞINDAKİLERİ okur.
  var list = all;
  if(d.attachedConnection) {
    list = all.filter(function(sig) {
      var isIn = sig.id.length > 3 && sig.id.substring(sig.id.length - 3) === '_in';
      return (dir === 'in') ? isIn : !isIn;
    });
  }
  // Kullanıcı sensörde sinyal seçtiyse ona saygı duy
  if(d.selectedSignals && d.selectedSignals.length > 0) {
    list = list.filter(function(s) { return d.selectedSignals.indexOf(s.id) >= 0; });
  }

  return { compType: compType, compNode: compNode, dir: dir, signals: list };
}

// Bir sekmenin tüm ölçüm kanallarını bileşen gruplarına toplar.
// prefix: aktif olmayan sekmeler için '@tabIdx:' — sensorId'ye eklenir.
function veSigCollectGroups(tabNodeObjs, tabConns, wizSensors, prefix) {
  prefix = prefix || '';
  var map = {}, groups = [];

  function group(compType, compNode) {
    if(map[compType]) {
      // İsim ilk bulunan düğümden gelir; sonradan gerçek düğüm bulunursa güncelle
      if(compNode && compNode.customName) map[compType].name = compNode.customName;
      return map[compType];
    }
    var g = {
      gid: prefix + compType,   // sekmeler arası benzersiz grup kimliği
      key: compType,
      name: veSigCompName(compType, compNode),
      icon: veSigCompIcon(compType),
      items: [],
      dragId: undefined,   // tüm kanallar tek sensörden geliyorsa o sensorId
      _seen: {}
    };
    map[compType] = g;
    groups.push(g);
    return g;
  }

  function push(g, item) {
    var k = item.sensorId + ' ' + item.signalId;
    if(g._seen[k]) return;
    g._seen[k] = true;
    g.items.push(item);
    // Grup sürüklemesi yalnızca tek kaynaklı gruplarda anlamlı
    if(g.dragId === undefined) g.dragId = item.sensorId;
    else if(g.dragId !== item.sensorId) g.dragId = null;
  }

  // 1) Fiziksel sensörler
  (tabNodeObjs || []).forEach(function(n) {
    if(n.type !== 'sensor') return;
    var ch = veSigSensorChannels(n, tabNodeObjs, tabConns);
    if(!ch || !ch.signals.length) return;
    var g = group(ch.compType, ch.compNode);
    ch.signals.forEach(function(sig) {
      push(g, {
        sensorId: prefix + n.id,
        signalId: sig.id,
        name: sig.name,
        unit: sig.unit || '',
        dir: ch.dir,
        compType: ch.compType,
        source: n.customName || 'Sensör',
        virtual: false
      });
    });
  });

  // 2) Sihirbazın sanal sensörleri
  (wizSensors || []).forEach(function(ws) {
    var compType = ws.target;
    var compNode = (tabNodeObjs || []).find(function(n) { return n.type === compType; }) || null;
    var g = group(compType, compNode);
    var meta = veSigMeta(compType, ws.signal);
    push(g, {
      sensorId: prefix + '~' + compType,
      signalId: ws.signal,
      name: meta.name,
      unit: meta.unit,
      dir: ws.attachment === 'input' ? 'in' : (ws.attachment === 'output' ? 'out' : 'comp'),
      compType: compType,
      source: 'Sihirbaz',
      virtual: true
    });
  });

  // Güç akışı sırası
  groups.sort(function(a, b) {
    var ia = VE_SIG_ORDER.indexOf(a.key), ib = VE_SIG_ORDER.indexOf(b.key);
    if(ia < 0) ia = VE_SIG_ORDER.length;
    if(ib < 0) ib = VE_SIG_ORDER.length;
    return ia - ib;
  });
  groups.forEach(function(g) { delete g._seen; });
  return groups;
}

// ── Hedef panel ───────────────────────────────────────────────────────────────

// Onay kutusunun yazdığı panel. Seçili panel mevcut düzende yoksa düzenin
// ilk paneline düşülür — kullanıcı görünmeyen bir panele sinyal göndermez.
function veSigVisibleSlots() {
  var def = (typeof veGetLayoutDef === 'function' && typeof veResultLayout !== 'undefined')
    ? veGetLayoutDef(veResultLayout) : null;
  if(!def || !def.rows) return [0];
  var out = [];
  def.rows.forEach(function(r) {
    r.forEach(function(i) { if(out.indexOf(i) < 0) out.push(i); });
  });
  return out.length ? out : [0];
}

function veSigTargetSlot() {
  var vis = veSigVisibleSlots();
  if(vis.indexOf(veSigState.target) < 0) veSigState.target = vis[0];
  return veSigState.target;
}

function veSigSetTargetSlot(idx) {
  veSigState.target = idx;
  if(typeof veUpdateResultsTree === 'function') veUpdateResultsTree();
}

// ── Eylemler ──────────────────────────────────────────────────────────────────

// Ağaçtaki onay kutusu paneldeki eğrinin AYNASI. Eğri panelden başka bir yolla
// çıkarsa (lejanttaki ✕, "Temizle" düğmesi, sürükle-bırak) kutu da güncellenmeli
// — yoksa liste yalan söyler. Bu yüzden slot değiştiren yollar buradan geçer.
// Sayaç, toplu işlemlerde (grup seçimi) ara render'ları bastırır.
var veSigSuspendRefresh = 0;

function veSigRefreshTree() {
  if(veSigSuspendRefresh > 0) return;
  if(typeof veUpdateResultsTree === 'function') veUpdateResultsTree();
}

function veSigToggleSignal(sensorId, signalId) {
  var idx = veSigTargetSlot();
  var slot = (typeof veResultSlots !== 'undefined') ? veResultSlots[idx] : null;
  if(!slot) return;
  var at = veSigIndexInSlot(slot, sensorId, signalId);
  if(at >= 0) {
    if(typeof veRemoveSensorFromSlot === 'function') veRemoveSensorFromSlot(idx, at);
  } else {
    if(typeof veAddSignalToSlot === 'function') veAddSignalToSlot(idx, sensorId, signalId);
  }
  // Ağaç yenilemesini ekleme/silme işleminin kendisi yapar (veSigRefreshTree)
}

// Grup kutucuğu: kısmi seçim de dahil, "hepsi açık" değilse hepsini aç.
function veSigToggleGroup(groupKey) {
  var g = veSigFindGroup(groupKey);
  if(!g) return;
  var idx = veSigTargetSlot();
  var slot = (typeof veResultSlots !== 'undefined') ? veResultSlots[idx] : null;
  if(!slot) return;
  var st = veSigGroupState(g.items, slot);

  // Ara render'ları bastır: 9 sinyallik bir grup 9 kez ağaç çizdirmesin
  veSigSuspendRefresh++;
  try {
    if(st.state === 'all') {
      // Sondan başa sil — splice sırasında indeksler kaymasın
      var kill = [];
      g.items.forEach(function(it) {
        var at = veSigIndexInSlot(slot, it.sensorId, it.signalId);
        if(at >= 0) kill.push(at);
      });
      kill.sort(function(a, b) { return b - a; });
      kill.forEach(function(at) {
        if(typeof veRemoveSensorFromSlot === 'function') veRemoveSensorFromSlot(idx, at);
      });
    } else {
      g.items.forEach(function(it) {
        if(veSigIndexInSlot(slot, it.sensorId, it.signalId) < 0 &&
           typeof veAddSignalToSlot === 'function') {
          veAddSignalToSlot(idx, it.sensorId, it.signalId);
        }
      });
    }
  } finally {
    veSigSuspendRefresh--;
  }
  veSigRefreshTree();
}

function veSigToggleGroupOpen(groupKey) {
  veSigState.open[groupKey] = !veSigState.open[groupKey];
  if(typeof veUpdateResultsTree === 'function') veUpdateResultsTree();
}

function veSigSetFilter(f) {
  veSigState.filter = f;
  if(typeof veUpdateResultsTree === 'function') veUpdateResultsTree();
}

function veSigSetQuery(q) {
  veSigState.query = String(q || '').trim();
  if(typeof veUpdateResultsTree === 'function') veUpdateResultsTree();
}

// Son çizilen gruplar — eylemlerin (grup aç/kapa, toplu seçim) referansı.
var veSigLastGroups = [];

function veSigFindGroup(groupKey) {
  for(var i = 0; i < veSigLastGroups.length; i++) {
    if(veSigLastGroups[i].gid === groupKey) return veSigLastGroups[i];
  }
  return null;
}

// ── Satır / grup HTML'i ───────────────────────────────────────────────────────

function veSigRowHTML(item, slot, q, sparkW, sparkH) {
  var at = veSigIndexInSlot(slot, item.sensorId, item.signalId);
  var on = at >= 0;
  var color = on ? veSlotSignalColor(slot, at) : VE_SIGNAL_COLORS[0];

  var pts = veSigSparkPoints(veSigSeries(item.sensorId, item.signalId), sparkW, sparkH, 32);

  var dirTag = item.dir === 'in' ? '←' : (item.dir === 'out' ? '→' : '');
  var title = item.name + (item.unit ? ' [' + item.unit + ']' : '') +
              ' · ' + item.compType + '::' + item.signalId +
              ' · ' + item.source + ' — sürükle veya çift tıkla';

  var h = '<div class="vsig-row' + (on ? ' on' : '') + '"' +
          ' data-sig="' + veSigEsc(item.sensorId) + '" data-sid="' + veSigEsc(item.signalId) + '"' +
          ' title="' + veSigEsc(title) + '" role="treeitem" tabindex="-1"' +
          ' aria-selected="' + (on ? 'true' : 'false') + '">';

  h += '<button type="button" class="vsig-ck' + (on ? ' on' : '') + '" data-act="toggle"' +
       ' role="checkbox" aria-checked="' + (on ? 'true' : 'false') + '"' +
       ' aria-label="' + veSigEsc(item.name) + ' — hedef panelde göster"></button>';

  // Çizili değilken sinyalin RENGİ YOKTUR — renk panel sırasından doğar.
  // Bu yüzden kapalı satırda inline renk verilmez; CSS nötr bir kutu çizer.
  // Aksi halde 20 kapalı satır solgun mavi bir denizde birbirine karışıyordu.
  h += '<span class="vsig-sw' + (on ? '' : ' off') + '"' +
       (on ? ' style="background:' + color + ';"' : '') +
       ' data-act="inspect" title="' + (on ? 'Renk: ' + color + ' — ' : '') + 'Renk ve istatistik"></span>';

  h += '<span class="vsig-name" data-act="drag">' +
       (dirTag ? '<span class="vsig-dir">' + dirTag + '</span>' : '') +
       veSigHighlight(item.name, q) + '</span>';

  h += '<span class="vsig-unit">' + veSigEsc(item.unit || '−') + '</span>';
  h += veSigSparkSVG(pts, on ? color : 'currentColor', sparkW, sparkH);
  h += '</div>';
  return h;
}

// Varsayılan açıklık: kullanıcı bir grubu elle açıp kapatmadığı sürece
// "hedef panelde çizili sinyali olan" gruplar açık başlar. Hiçbiri yoksa ilk
// grup açılır — panel yedi kapalı başlıktan ibaret kalmaz.
// Kullanıcının kararı (explicit true/false) her zaman kazanır.
function veSigDecorateOpen(groups, slot) {
  var anyOn = false;
  groups.forEach(function(g) {
    g._hasOn = veSigGroupState(g.items, slot).on > 0;
    if(g._hasOn) anyOn = true;
  });
  groups.forEach(function(g, i) {
    if(Object.prototype.hasOwnProperty.call(veSigState.open, g.gid)) {
      g._open = !!veSigState.open[g.gid];
    } else {
      g._open = anyOn ? g._hasOn : (i === 0);
    }
  });
  return groups;
}

function veSigGroupHTML(g, slot, q) {
  var st = veSigGroupState(g.items, slot);
  // Arama sırasında eşleşen gruplar kendiliğinden açılır
  var open = !!q || (g._open !== undefined ? g._open : !!veSigState.open[g.gid]);

  var h = '<div class="vsig-group' + (open ? ' open' : '') + '" data-grp="' + veSigEsc(g.gid) + '">';
  h += '<div class="vsig-ghead" data-act="open" role="treeitem" tabindex="0"' +
       ' aria-expanded="' + (open ? 'true' : 'false') + '"' +
       ' title="' + veSigEsc(g.name + ' — ' + st.on + '/' + st.total + ' sinyal hedef panelde') + '">';
  h += '<span class="vsig-arrow" aria-hidden="true">▶</span>';
  h += '<button type="button" class="vsig-ck ' + st.state + '" data-act="grp-toggle"' +
       ' role="checkbox" aria-checked="' + (st.state === 'all' ? 'true' : (st.state === 'some' ? 'mixed' : 'false')) + '"' +
       ' aria-label="' + veSigEsc(g.name) + ' — tüm sinyaller"></button>';
  h += '<span class="vsig-gname"' + (g.dragId ? ' data-act="grp-drag"' : '') + '>' +
       g.icon + veSigHighlight(g.name, q) + '</span>';
  h += '<span class="vsig-badge' + (st.on ? ' on' : '') + '">' + st.on + '/' + st.total + '</span>';
  h += '</div>';

  h += '<div class="vsig-list" role="group">';
  g.items.forEach(function(it) { h += veSigRowHTML(it, slot, q, 46, 13); });
  h += '</div></div>';
  return h;
}

// Arama + filtre uygulanmış grup listesi. Boş kalan gruplar düşer.
function veSigApplyFilter(groups, slot, q, filter) {
  var out = [];
  groups.forEach(function(g) {
    var items = g.items.filter(function(it) {
      if(filter === 'on'  && veSigIndexInSlot(slot, it.sensorId, it.signalId) < 0) return false;
      if(filter === 'off' && veSigIndexInSlot(slot, it.sensorId, it.signalId) >= 0) return false;
      if(q && !veSigMatches(it.name, q) && !veSigMatches(g.name, q) &&
         !veSigMatches(it.signalId, q)) return false;
      return true;
    });
    if(items.length) out.push({ gid: g.gid, key: g.key, name: g.name, icon: g.icon,
                                dragId: g.dragId, items: items });
  });
  return out;
}

// ── Araç çubuğu (hedef panel + filtre) ────────────────────────────────────────

function veSigToolbarHTML(slot) {
  var vis = veSigVisibleSlots();
  var target = veSigTargetSlot();
  var count = (slot && slot.sensors) ? slot.sensors.length : 0;

  var h = '<div class="vsig-toolbar">';
  h += '<div class="vsig-tl-row">';
  h += '<span class="vsig-tl-label">Hedef</span>';
  h += '<div class="vsig-panels" role="group" aria-label="Hedef panel">';
  vis.forEach(function(i) {
    h += '<button type="button" class="vsig-panel-btn' + (i === target ? ' active' : '') + '"' +
         ' data-act="target" data-slot="' + i + '"' +
         ' aria-pressed="' + (i === target ? 'true' : 'false') + '"' +
         ' title="Onay kutuları Panel ' + (i + 1) + '\'e yazar">' + (i + 1) + '</button>';
  });
  h += '</div>';
  h += '<span class="vsig-tl-count">' + count + ' eğri</span>';
  h += '</div>';

  h += '<div class="vsig-tl-row">';
  h += '<div class="vsig-seg" role="group" aria-label="Sinyal filtresi">';
  [['all', 'Tümü'], ['on', 'Seçili'], ['off', 'Kapalı']].forEach(function(f) {
    h += '<button type="button" data-act="filter" data-filter="' + f[0] + '"' +
         ' aria-pressed="' + (veSigState.filter === f[0] ? 'true' : 'false') + '">' + f[1] + '</button>';
  });
  h += '</div>';
  h += '<button type="button" class="vsig-mini" data-act="collapse-all" title="Tüm grupları kapat">Kapat</button>';
  h += '</div>';
  h += '</div>';
  return h;
}

// "Kapat" gerçekten kapatmalı. veSigState.open'ı boşaltmak varsayılan açıklık
// kuralına dönmek demektir (çizili sinyali olan gruplar yine açılır) — bu
// düğmeye basan kullanıcının beklediği şey değil. Her grup için AÇIK BİR
// "kapalı" kaydı yazılır.
function veSigCollapseAll() {
  veSigLastGroups.forEach(function(g) { veSigState.open[g.gid] = false; });
  if(typeof veUpdateResultsTree === 'function') veUpdateResultsTree();
}

// ── Denetçi katmanı ───────────────────────────────────────────────────────────

// Bu sinyali kullanan sihirbaz diyagramlarını bulur. Uydurma değil:
// SW_DIAGRAM_SIGNALS tablosundan gerçek eşleşme taranır.
function veSigUsedInDiagrams(compType, signalId) {
  if(typeof SW_DIAGRAM_SIGNALS === 'undefined' || typeof SENSOR_PACKAGES === 'undefined') return [];
  var hits = {};
  Object.keys(SW_DIAGRAM_SIGNALS).forEach(function(diagId) {
    var d = SW_DIAGRAM_SIGNALS[diagId];
    var refs = [];
    if(d.x) refs.push(d.x);
    if(d.y) refs = refs.concat(d.y);
    if(d.z) refs.push(d.z);
    var used = refs.some(function(r) { return r && r.target === compType && r.signal === signalId; });
    if(!used) return;
    SENSOR_PACKAGES.forEach(function(p) {
      (p.diagrams || []).forEach(function(dg) {
        if(dg.id === diagId) hits[dg.name] = true;
      });
    });
  });
  return Object.keys(hits);
}

// Kanalın ad/birim/kaynak bilgisi AÇILIRKEN kopyalanır. Sonradan kullanıcı
// arama yazıp o sinyali listeden düşürürse denetçi yine de doğru başlığı
// gösterir — açık bir panelin içeriği arama kutusuna bağlı olmamalı.
function veSigOpenInspector(sensorId, signalId) {
  var snap = null;
  veSigLastGroups.forEach(function(g) {
    g.items.forEach(function(it) {
      if(it.sensorId === sensorId && it.signalId === signalId) snap = it;
    });
  });
  veSigState.inspect = { sensorId: sensorId, signalId: signalId, item: snap };
  if(typeof veUpdateResultsTree === 'function') veUpdateResultsTree();
}

function veSigCloseInspector() {
  veSigState.inspect = null;
  if(typeof veUpdateResultsTree === 'function') veUpdateResultsTree();
}

// Renk seçimi hedef panele yazılır. Sinyal panelde değilse önce eklenir —
// "rengi seçtim ama bir şey olmadı" tuzağı olmasın.
function veSigSetColor(sensorId, signalId, color) {
  var idx = veSigTargetSlot();
  var slot = (typeof veResultSlots !== 'undefined') ? veResultSlots[idx] : null;
  if(!slot) return;
  var at = veSigIndexInSlot(slot, sensorId, signalId);
  if(at < 0) {
    if(typeof veAddSignalToSlot === 'function') veAddSignalToSlot(idx, sensorId, signalId);
    at = veSigIndexInSlot(slot, sensorId, signalId);
  }
  if(at < 0) return;
  slot.sensors[at].color = color;
  if(typeof veRenderSlot === 'function') veRenderSlot(idx);
  veSigRefreshTree();
}

function veSigInspectorHTML() {
  var ins = veSigState.inspect;
  if(!ins) return '';

  var item = ins.item;
  if(!item) {
    // Açılış anında yakalanamadıysa meta veriden kur
    var ct = ins.sensorId.charAt(0) === '~' ? ins.sensorId.substring(1) : '';
    var m = veSigMeta(ct, ins.signalId);
    item = { sensorId: ins.sensorId, signalId: ins.signalId, name: m.name, unit: m.unit,
             compType: ct, source: '—', dir: 'comp' };
  }

  var idx = veSigTargetSlot();
  var slot = (typeof veResultSlots !== 'undefined') ? veResultSlots[idx] : null;
  var at = veSigIndexInSlot(slot, item.sensorId, item.signalId);
  var on = at >= 0;
  var color = on ? veSlotSignalColor(slot, at) : VE_SIGNAL_COLORS[0];

  var series = veSigSeries(item.sensorId, item.signalId);
  var st = veSigStats(series);

  var h = '<div class="vsig-insp" role="dialog" aria-label="Sinyal denetçisi">';

  h += '<div class="vsig-insp-head">';
  h += '<span class="vsig-sw" style="background:' + color + ';"></span>';
  h += '<span class="vsig-insp-title">' + veSigEsc(item.name) + '</span>';
  h += '<button type="button" class="vsig-insp-x" data-act="insp-close" title="Kapat" aria-label="Kapat">✕</button>';
  h += '</div>';
  h += '<div class="vsig-insp-key">' + veSigEsc(item.compType + '::' + item.signalId) +
       ' · ' + veSigEsc(item.unit || '−') + ' · ' + veSigEsc(item.source) + '</div>';

  h += '<div class="vsig-insp-body">';

  // Önizleme eğrisi
  var pw = 210, ph = 46;
  var pts = veSigSparkPoints(series, pw, ph, 96);
  h += '<div class="vsig-fld"><span class="vsig-fld-lbl">Sinyal Şekli</span>';
  if(pts) {
    h += '<div class="vsig-preview">' + veSigSparkSVG(pts, color, pw, ph) + '</div>';
  } else {
    h += '<div class="vsig-preview empty">Veri yok — önce simülasyonu çalıştırın</div>';
  }
  h += '</div>';

  // Görünürlük
  h += '<div class="vsig-fld"><span class="vsig-fld-lbl">Panel ' + (idx + 1) + '</span>';
  h += '<div class="vsig-seg wide">';
  h += '<button type="button" data-act="insp-vis" data-on="1" aria-pressed="' + (on ? 'true' : 'false') + '">Çizili</button>';
  h += '<button type="button" data-act="insp-vis" data-on="0" aria-pressed="' + (!on ? 'true' : 'false') + '">Kapalı</button>';
  h += '</div></div>';

  // Renk
  h += '<div class="vsig-fld"><span class="vsig-fld-lbl">Eğri Rengi</span>';
  h += '<div class="vsig-pal">';
  VE_SIGNAL_COLORS.forEach(function(c) {
    h += '<button type="button" class="vsig-pal-sw" data-act="insp-color" data-color="' + c + '"' +
         ' style="background:' + c + ';" role="radio" aria-checked="' + (on && c === color ? 'true' : 'false') +
         '" aria-label="Renk ' + c + '" title="' + c + '"></button>';
  });
  h += '</div></div>';

  // İstatistik
  h += '<div class="vsig-fld"><span class="vsig-fld-lbl">İstatistik</span>';
  if(st) {
    h += '<div class="vsig-stats">';
    h += '<div class="vsig-stat"><span>min</span><b>' + veSigFmt(st.min) + '</b></div>';
    h += '<div class="vsig-stat"><span>ort</span><b>' + veSigFmt(st.avg) + '</b></div>';
    h += '<div class="vsig-stat"><span>maks</span><b>' + veSigFmt(st.max) + '</b></div>';
    h += '</div>';
    h += '<div class="vsig-note">' + st.n + ' veri noktası</div>';
  } else {
    h += '<div class="vsig-note">Simülasyon sonucu yok.</div>';
  }
  h += '</div>';

  // Kullanıldığı diyagramlar
  var uses = veSigUsedInDiagrams(item.compType, item.signalId);
  if(uses.length) {
    h += '<div class="vsig-fld"><span class="vsig-fld-lbl">Kullanıldığı Diyagramlar</span>';
    h += '<div class="vsig-uses">';
    uses.slice(0, 8).forEach(function(u) { h += '<span class="vsig-use">' + veSigEsc(u) + '</span>'; });
    if(uses.length > 8) h += '<span class="vsig-note">+' + (uses.length - 8) + ' diyagram daha</span>';
    h += '</div></div>';
  }

  h += '</div></div>';
  return h;
}

// ── Olay yönlendirme ──────────────────────────────────────────────────────────
//
// Ağaç her yenilemede baştan çizildiği için satır başına onclick yerine tek
// delegasyon kullanılır: daha az HTML, daha az kaçış hatası riski.

function veSigBindTree(treeEl) {
  if(!treeEl || treeEl._vsigBound) return;
  treeEl._vsigBound = true;

  treeEl.addEventListener('click', function(e) {
    if(!e.target || !e.target.closest) return;
    var el = e.target.closest('[data-act]');
    if(!el || !treeEl.contains(el)) return;
    var act = el.getAttribute('data-act');
    var row = el.closest('.vsig-row');
    var grp = el.closest('.vsig-group');

    if(act === 'toggle' && row) {
      e.stopPropagation();
      veSigToggleSignal(row.getAttribute('data-sig'), row.getAttribute('data-sid'));
    } else if(act === 'grp-toggle' && grp) {
      e.stopPropagation();
      veSigToggleGroup(grp.getAttribute('data-grp'));
    } else if(act === 'open' && grp) {
      veSigToggleGroupOpen(grp.getAttribute('data-grp'));
    } else if(act === 'inspect' && row) {
      e.stopPropagation();
      veSigOpenInspector(row.getAttribute('data-sig'), row.getAttribute('data-sid'));
    } else if(act === 'target') {
      veSigSetTargetSlot(parseInt(el.getAttribute('data-slot'), 10) || 0);
    } else if(act === 'filter') {
      veSigSetFilter(el.getAttribute('data-filter'));
    } else if(act === 'collapse-all') {
      veSigCollapseAll();
    } else if(act === 'insp-close') {
      veSigCloseInspector();
    } else if(act === 'insp-vis') {
      var ins = veSigState.inspect;
      if(!ins) return;
      var want = el.getAttribute('data-on') === '1';
      var slot = veResultSlots[veSigTargetSlot()];
      var has = veSigIndexInSlot(slot, ins.sensorId, ins.signalId) >= 0;
      if(want !== has) veSigToggleSignal(ins.sensorId, ins.signalId);
    } else if(act === 'insp-color') {
      var i2 = veSigState.inspect;
      if(i2) veSigSetColor(i2.sensorId, i2.signalId, el.getAttribute('data-color'));
    }
  });

  // Sürükleme — sinyal adından ve tek kaynaklı grup adından
  treeEl.addEventListener('mousedown', function(e) {
    if(!e.target || !e.target.closest) return;
    var el = e.target.closest('[data-act]');
    if(!el || !treeEl.contains(el)) return;
    var act = el.getAttribute('data-act');
    if(act === 'drag') {
      var row = el.closest('.vsig-row');
      if(row && typeof veStartSignalDrag === 'function') {
        veStartSignalDrag(e, row.getAttribute('data-sig'), row.getAttribute('data-sid'));
      }
    } else if(act === 'grp-drag') {
      var grp = el.closest('.vsig-group');
      if(!grp) return;
      var g = veSigFindGroup(grp.getAttribute('data-grp'));
      if(g && g.dragId && typeof veStartSensorDrag === 'function') veStartSensorDrag(e, g.dragId);
    }
  });

  // Çift tık → denetçi
  treeEl.addEventListener('dblclick', function(e) {
    if(!e.target || !e.target.closest) return;
    var row = e.target.closest('.vsig-row');
    if(row && treeEl.contains(row)) {
      veSigOpenInspector(row.getAttribute('data-sig'), row.getAttribute('data-sid'));
    }
  });

  // Klavye: Space görünürlük, Enter denetçi/grup aç-kapa, ok tuşları gezinme
  treeEl.addEventListener('keydown', function(e) {
    var head = e.target.closest && e.target.closest('.vsig-ghead');
    var row = e.target.closest && e.target.closest('.vsig-row');

    if(head && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      var g = head.closest('.vsig-group');
      if(e.key === ' ') veSigToggleGroup(g.getAttribute('data-grp'));
      else veSigToggleGroupOpen(g.getAttribute('data-grp'));
      return;
    }
    if(row) {
      if(e.key === ' ') {
        e.preventDefault();
        veSigToggleSignal(row.getAttribute('data-sig'), row.getAttribute('data-sid'));
        return;
      }
      if(e.key === 'Enter') {
        e.preventDefault();
        veSigOpenInspector(row.getAttribute('data-sig'), row.getAttribute('data-sid'));
        return;
      }
    }
    if(e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      var focusables = Array.prototype.slice.call(
        treeEl.querySelectorAll('.vsig-ghead, .vsig-group.open .vsig-row'));
      if(!focusables.length) return;
      var cur = focusables.indexOf(head || row);
      var next = focusables[Math.max(0, Math.min(focusables.length - 1,
                  cur + (e.key === 'ArrowDown' ? 1 : -1)))];
      if(next) { e.preventDefault(); next.setAttribute('tabindex', '0'); next.focus(); }
    }
    if(e.key === 'Escape' && veSigState.inspect) veSigCloseInspector();
  });
}

// Jest: saf yardımcılar doğrudan test edilebilsin
if(typeof module !== 'undefined' && module.exports) {
  module.exports = {
    VE_SIGNAL_COLORS: VE_SIGNAL_COLORS,
    veSigEsc: veSigEsc,
    veSigNorm: veSigNorm,
    veSigMatches: veSigMatches,
    veSigHighlight: veSigHighlight,
    veSigFmt: veSigFmt,
    veSigIndexInSlot: veSigIndexInSlot,
    veSlotSignalColor: veSlotSignalColor,
    veSigGroupState: veSigGroupState,
    veSigStats: veSigStats,
    veSigSparkPoints: veSigSparkPoints,
    veSigApplyFilter: veSigApplyFilter,
    veSigCollectGroups: veSigCollectGroups,
    veSigSensorChannels: veSigSensorChannels
  };
}
