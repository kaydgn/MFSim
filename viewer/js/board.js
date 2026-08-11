// ═══════════════════════════════════════════════════════════════════════════
// PANO KATMANI — ölçüm görüntüleyicisinin taşıyıcı zemini
// ═══════════════════════════════════════════════════════════════════════════
//
// MFSim'de bu katman js/results.js (5962 satır) ve js/graphics.js (5792 satır)
// içine dağılmıştı; ikisinin de büyük kısmı topoloji, çözücü, sihirbaz ve
// takoz kanallarıyla ilgili. Görüntüleyicide bunların hiçbiri yok. Burada
// yalnızca DÖRT modülün gerçekten ihtiyaç duyduğu yüzey var:
//
//   trace-view.js       → veResultSlots, VE_BOARD, veGetSensorData,
//                         veRenderSlot, veShowXAxisPicker, veInheritedXAxis,
//                         veAddSignalToSlot, veSyncBoardState,
//                         veNiceStep / veAxisDecimals / veFormatAxisVal
//   signal-tree.js      → veAddSignalToSlot, veRemoveSensorFromSlot,
//                         veStartSensorDrag, veStartSignalDrag,
//                         veUpdateResultsTree, veResultSlots
//   measure-import-ui.js → showToast, veUpdateResultsTree
//   measure-import.js    → (yok — tamamen bağımsız)
//
// KATMAN SINIRI: bu dosya SİMÜLASYON BİLMEZ. Bir sinyalin nereden geldiğini
// tek bir yerden sorar (veGetSensorData) ve o kapının tek dalı vardır: '#'
// önekli içe aktarma kimliği. MFSim'deki '~' (sihirbaz), '@' (çapraz sekme)
// ve '~mnt-' (takoz) dalları burada YOKTUR — karşılıkları da yok.
//
// ── Diğer dosyalarla ilişki ──
// viewer/js/ altındaki DİĞER YEDİ dosya MFSim'in js/ klasöründen BİREBİR
// kopyadır (bkz. viewer/README.md). Onlara dokunulmaz; bu dosya onların
// beklediği globalleri sağlar. Bir düzeltmeyi MFSim'den taşımak bu yüzden
// düz bir `cp` işidir.

// ── Simülasyon tarafının yokluğu ──────────────────────────────────────────
//
// Kopyalanan dosyalar simülasyon/takoz globallerine bakıyor. Neredeyse hepsi
// `typeof X === 'function'` kapısının arkasında — o çağrılar kendiliğinden
// atlanır. Kapısız olan ÜÇ erişim var ve üçü de window üzerinden okuduğu için
// ReferenceError üretmez; yine de niyeti açık etmek adına burada AÇIKÇA null
// bağlanıyorlar. Sessiz bir `undefined` "unutulmuş" gibi okunur, `null` ise
// "burada bilerek veri yok" der.
window.veSimResults = null;      // trace-view.js:362, 1710
window.veMountResults = null;    // trace-view.js:1549

// Çapraz sekme ('@0:sensor') kimlikleri görüntüleyicide üretilmiyor; dizi boş
// kalır ve trace-view.js:410'daki tarama hiçbir şey bulmaz.
var veTabs = [];

// Çözücü sekmesi kimliği. 'obstacle' ve 'mount' dallarının açılmaması için
// ikisinden de FARKLI olmak zorunda — 'import' o yüzden.
var veActiveSolverTabId = 'import';

// Takoz veri kümeleri. Fonksiyonun kendisi var çünkü trace-view.js bir yerde
// `veMntSets().length` diye çağırıyor; boş dizi "takoz kanalı yok" demek.
// veMntSignals / veMntBrief / veSolverRun KASITEN tanımsız bırakıldı: onlara
// bakan her yer typeof kapılı, tanımsızlık doğru cevap.
function veMntSets() { return []; }

// ── Pano ──────────────────────────────────────────────────────────────────
//
// Dizi MFSim'deki gibi 4 uzunlukta: trace-view.js'in şerit göçü (veTrMigrateSlots)
// ve pano klonlama kodu bu şekli varsayıyor. Yalnızca index 0 (VE_BOARD)
// kullanılır.
//
// VE_BOARD'ı BU DOSYA TANIMLAMAZ: sahibi trace-view.js (yukarıdaki başlıkta da
// öyle yazılı) ve o dosya birebir kopya olduğu için bildirimi oradan kalkamaz.
// Burada ikinci bir `var VE_BOARD = 0` vardı — aynı değer olduğu için zararsızdı
// ama tek global kapsamda gerçek bir çift bildirimdi. Bu dosya trace-view.js'ten
// ÖNCE yüklenir; sorun değil, çünkü VE_BOARD yalnızca fonksiyon gövdelerinde
// (satır ~233, ~422, ~432) okunur, yükleme anında değil.
// Kapı: tests/unit/source-hygiene.test.js
var veResultSlots = [{}, {}, {}, {}];

// ── Metin ─────────────────────────────────────────────────────────────────

// js/ui-core.js'ten birebir.
function escapeHTML(str) {
  if(typeof str !== 'string') return str;
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// ── Sayı biçimi ───────────────────────────────────────────────────────────
//
// js/graphics.js:348-405'ten birebir. Eksen etiketi ve imleç okuması bu üç
// fonksiyondan geçiyor; biçimi değiştirmek MFSim ile görüntüleyici arasında
// gözle görülür bir fark açardı.

function veFormatTooltipVal(v) {
  // Her kanal sayısal değil: vites modu '1C'/'2L' gibi METİN üretiyor.
  // Korumasız toFixed/toExponential bu kanal seçiliyken tabloyu ve CSV'yi
  // çökertiyordu (TypeError: v.toExponential is not a function).
  var num = Number(v);
  if(v === null || v === undefined || !isFinite(num)) {
    return (typeof v === 'string' && v !== '') ? v : '—';
  }
  v = num;
  var a = Math.abs(v);
  // Tam sıfır düz yazılır: aşağıdaki üstel dal 0'ı "0.00e+0" yapıyordu ve
  // imleç rozetinde/tabloda okunmuyordu.
  if(a === 0) return '0';
  if(a >= 10000) return v.toFixed(0);
  if(a >= 100) return v.toFixed(1);
  if(a >= 1) return v.toFixed(2);
  if(a >= 0.01) return v.toFixed(3);
  return v.toExponential(2);
}

function veNiceStep(rough) {
  if(rough <= 0 || !isFinite(rough)) return 1;
  var mag = Math.pow(10, Math.floor(Math.log10(rough)));
  var norm = rough / mag;
  if(norm <= 1.5) return mag;
  if(norm <= 3) return 2 * mag;
  if(norm <= 7) return 5 * mag;
  return 10 * mag;
}

// Eksen basamak sayısı ADIMA göre BİR KEZ belirlenir; her etiket aynı
// basamakla yazılır (bkz. js/graphics.js'teki gerekçe: "60.0 80.0 100 120").
function veAxisDecimals(step) {
  var a = Math.abs(step);
  if(!isFinite(a) || a <= 0) return 0;
  if(a >= 10000) return 0;
  if(a >= 1) return 0;
  if(a >= 0.1) return 1;
  if(a >= 0.01) return 2;
  return 3;
}

function veFormatAxisVal(v, dec) {
  var a = Math.abs(v);
  if(dec === undefined) {
    if(a === 0) return '0';
    if(a >= 10000) return (v / 1000).toFixed(0) + 'k';
    if(a >= 100) return v.toFixed(0);
    if(a >= 10) return v.toFixed(1);
    if(a >= 1) return v.toFixed(1);
    if(a >= 0.01) return v.toFixed(2);
    // Küçük değer üstel yazılır: toFixed(3) 0,0001 ile 0,0005'i aynı "0.000"
    // etiketine çeviriyordu.
    return v.toExponential(1);
  }
  // KISALTMA YALNIZ dec === 0 İKEN. Eksen bir ondalık istiyorsa (dec > 0)
  // "12k" o ondalığı atar ve 12345,6 ile 12345,7 aynı etikete düşer.
  if(a >= 10000 && dec === 0) return (v / 1000).toFixed(0) + 'k';
  return v.toFixed(dec);
}

// ── Veri kapısı ───────────────────────────────────────────────────────────
//
// Tüm okuma buradan geçer (trace-view, signal-tree, tablo). MFSim'de bu
// fonksiyon 300+ satır ve altı ayrı veri kaynağını çözüyor; burada tek kaynak
// var, o yüzden tek dal.
function veGetSensorData(sensorId, signalOverride) {
  if(String(sensorId).charAt(0) !== '#') return null;
  return (typeof veImpSeries === 'function') ? veImpSeries(sensorId, signalOverride) : null;
}

// ── Bildirim (toast) ──────────────────────────────────────────────────────
// js/results.js:5712-5772'den birebir.

var VE_TOAST_MAX = 3;

function _veToastStack() {
  var stack = document.querySelector('.ve-toast-stack');
  if(!stack) {
    stack = document.createElement('div');
    stack.className = 've-toast-stack';
    stack.setAttribute('role', 'status');
    stack.setAttribute('aria-live', 'polite');
    document.body.appendChild(stack);
  }
  return stack;
}

function _veToastDismiss(toast) {
  if(!toast || toast._veDismissed) return;
  toast._veDismissed = true;
  toast.classList.remove('show');
  setTimeout(function() { toast.remove(); }, 300);
}

function showToast(message, type) {
  var stack = _veToastStack();

  var live = Array.prototype.filter.call(
    stack.querySelectorAll('.ve-toast'),
    function(t) { return !t._veDismissed; }
  );
  for(var i = 0; i <= live.length - VE_TOAST_MAX; i++) _veToastDismiss(live[i]);

  var toast = document.createElement('div');
  toast.className = 've-toast';
  if(type === 'warning' || type === 'error' || type === 'info') toast.classList.add(type);

  var icon = document.createElement('span');
  icon.className = 've-toast-icon';
  icon.setAttribute('aria-hidden', 'true');
  icon.textContent = (type === 'error') ? '!' : (type === 'warning') ? '!' : (type === 'info') ? 'i' : '✓';

  var text = document.createElement('span');
  text.textContent = message;

  toast.appendChild(icon);
  toast.appendChild(text);
  toast.addEventListener('click', function() { _veToastDismiss(toast); });
  stack.appendChild(toast);

  setTimeout(function() { toast.classList.add('show'); }, 10);
  setTimeout(function() { _veToastDismiss(toast); }, 2500);
}

// ── Veri Gezgini ağacı ────────────────────────────────────────────────────

// js/results.js:611'den birebir.
function veToggleTree(el) {
  var children = el.nextElementSibling;
  if(!children || !children.classList.contains('ve-tree-children')) return;
  children.classList.toggle('open');
  var arrow = el.querySelector('.arrow');
  if(arrow) arrow.textContent = children.classList.contains('open') ? '▼' : '▶';
}

function veFilterResultsTree(query) {
  if(typeof veSigSetQuery === 'function') veSigSetQuery(query);
}

// Ağacın tamamı. MFSim'de burada sekme başına topoloji taraması, sihirbaz
// diyagramları, takoz dalı ve rapor düğümü vardı; görüntüleyicide TEK dal
// kalıyor — içe aktarılan ölçümler. Satır/grup HTML'i yine ortak
// (signal-tree.js), böylece liste MFSim'dekiyle birebir aynı görünür ve aynı
// davranır: tikle, sürükle, çift tıkla incele.
function veUpdateResultsTree() {
  var tree = document.getElementById('ve-results-tree');
  if(!tree) return;

  // Ağaç her etkileşimde baştan çizilir; kaydırma konumu korunmazsa onay
  // kutusuna her tıklayışta liste başa fırlar.
  var _scrollTop = tree.scrollTop;
  if(typeof veSigResetCache === 'function') veSigResetCache();

  var slot = veResultSlots[(typeof veSigTargetSlot === 'function') ? veSigTargetSlot() : VE_BOARD];
  var allGroups = [];

  var html = veSigToolbarHTML(slot);

  var groups = (typeof veImpCollectGroups === 'function') ? veImpCollectGroups() : [];

  if(groups.length === 0) {
    html += '<div class="vsig-empty" style="padding:14px 10px; line-height:1.5;">' +
            'Henüz ölçüm yok.<br>Yukarıdaki <b>İçe Aktar</b> ile bir ' +
            '.xlsx / .csv dosyası açın.</div>';
  } else {
    var channels = 0;
    groups.forEach(function(g) { channels += g.items.length; });

    html += '<div style="margin-top:4px; border-top:1px solid var(--border-color); padding-top:4px;">';
    html += '<div class="ve-tree-item">';
    html += '<div class="ve-tree-row" style="display:flex; align-items:center; gap:4px;">';
    html += '<span class="arrow" onclick="veToggleTree(this.parentElement)">▼</span>';
    html += '<span class="icon"><span class="mf-ico mf-ico-upload"></span></span>';
    html += '<span style="font-weight:600;">İçe Aktarılan Ölçümler</span>';
    html += ' <span style="font-size:var(--fs-micro); color:var(--text-muted); margin-left:auto;">' +
            channels + ' sinyal</span>';
    html += '</div>';
    html += '<div class="ve-tree-children open">';

    var shown = veSigDecorateOpen(
      veSigApplyFilter(groups, slot, veSigState.query, veSigState.filter), slot);
    shown.forEach(function(g) { allGroups.push(g); });

    if(shown.length === 0) {
      html += '<div class="vsig-empty">Aramayla eşleşen sinyal yok.</div>';
    } else {
      shown.forEach(function(g) {
        html += veSigGroupHTML(g, slot, veSigState.query);
        html += '<div class="vsig-orphan" style="cursor:pointer;" title="Bu ölçüm dosyasını oturumdan kaldır"' +
                ' onclick="veImpDropDataset(\'' + escapeHTML(g._import) + '\')">✕ ' +
                escapeHTML(g.name) + ' — kaldır</div>';
      });
    }
    html += '</div></div></div>';
  }

  // Denetçi ağacın ÜSTÜNE binmez, YERİNE geçer (js/results.js:582'deki
  // gerekçe: kaplama kaydırılmış ağaçta hizadan kayıyor ve altındaki satırlar
  // tıklanabilir kalıyordu). Gruplar yine de hesaplanır — denetçi kapanınca
  // ağaç aynı durumla geri gelir.
  veSigLastGroups = allGroups;
  var inspecting = !!veSigState.inspect;
  if(inspecting) html = veSigInspectorHTML();

  tree.innerHTML = html;
  if(!inspecting) tree.scrollTop = _scrollTop;
  veSigBindTree(tree);
}

// ── Ortak X ekseni ────────────────────────────────────────────────────────
// Kural ve kimlik hesabı measure-core.js'te; buradakiler o kuralı bırakma
// (drop) yollarında uygulayan ince sarmalayıcılar.

// Boş panoya düşen sinyal panonun eksenini devralır. MFSim'de pano boşken
// çözücü düğümüne bakılıp "Zaman [s] (Durma)" ayrımı yapılıyordu; burada
// çözücü yok, düz zaman ekseni.
function veInheritedXAxis(slotIdx) {
  var b = (typeof veSharedXAxis === 'function') ? veSharedXAxis(veResultSlots) : null;
  if(b && b.xAxis) {
    var copy = Object.assign({}, b.xAxis);
    if(b.dataSource && slotIdx !== undefined) veResultSlots[slotIdx]._dataSource = b.dataSource;
    return copy;
  }
  return { id: 'time', name: 'Zaman [s]', unit: 's' };
}

var _veLastBoardXKey = null;
function veSyncBoardState() {
  var k = (typeof veSharedXKey === 'function') ? veSharedXKey(veResultSlots) : null;
  if(k === _veLastBoardXKey) return;
  _veLastBoardXKey = k;
  veUpdateResultsTree();
}

// Uyumsuz bırakma uyarısı — hangi eksenin geçerli olduğunu ve nasıl
// değiştirileceğini söyler, yoksa kullanıcı neden reddedildiğini bilemez.
function veWarnXAxisMismatch(wantedXAxis) {
  var b = (typeof veSharedXAxis === 'function') ? veSharedXAxis(veResultSlots) : null;
  var cur = (b && b.xAxis && b.xAxis.name) ? b.xAxis.name : 'Zaman [s]';
  var want = (wantedXAxis && wantedXAxis.name) ? wantedXAxis.name : 'farklı bir eksen';
  showToast('Pano X ekseni: ' + cur + ' — bu öğe ' + want +
            ' istiyor. Değiştirmek için ölçüm penceresinin X ekseni seçicisini kullanın.',
            'warning');
}

// ── Şerit ekleme / çıkarma ────────────────────────────────────────────────

// js/results.js:4618-4658'in içe aktarma dalıyla aynı gövde. Diğer beş dal
// (takoz, sihirbaz, çapraz sekme, fiziksel sensör, sim reddi) burada yok.
function veAddSignalToSlot(slotIdx, sensorId, signalId) {
  if(String(sensorId).charAt(0) !== '#') return;

  var ds = (typeof veImpFind === 'function') ? veImpFind(veImpIdOf(sensorId)) : null;
  if(!ds) return;
  var col = veImpColumn(ds, signalId);
  if(!col) return;

  var slot = veResultSlots[slotIdx];
  if(!slot.sensors) slot.sensors = [];
  if(!slot.type) slot.type = 'line';

  // Ölçüm KENDİ zaman eksenini getirir; slot._dataSource ve xAxis birlikte
  // kurulur. Tek-X-ekseni kuralı böylece kendiliğinden korunur: başka bir
  // dosyanın eksenindeki panoya bırakılırsa reddedilir.
  var x = {
    id: 'time',
    name: ds.x.name + (ds.x.unit ? ' [' + ds.x.unit + ']' : ''),
    unit: ds.x.unit || '',
    _dataSource: ds.dataSource
  };
  if(typeof veXAxisAllowed === 'function' && !veXAxisAllowed(x, ds.dataSource, veResultSlots)) {
    veWarnXAxisMismatch(x);
    return;
  }

  if(slot.sensors.some(function(s) { return s.id === sensorId && s.signal === signalId; })) return;

  slot.xAxis = x;
  slot._dataSource = ds.dataSource;
  slot.sensors.push({
    id: sensorId,
    name: col.name,
    unit: col.unit || '',
    signal: signalId,
    _dataSource: ds.dataSource
  });

  if(typeof veTrRefresh === 'function') veTrRefresh(); else veRenderSlot(slotIdx);
  veSyncBoardState();
  if(typeof veSigRefreshTree === 'function') veSigRefreshTree();
}

// Grup başlığının sürüklenmesi: veri kümesinin TÜM sütunları eklenir.
function veAddSensorToSlot(slotIdx, sensorId) {
  if(String(sensorId).charAt(0) !== '#') return;
  var ds = (typeof veImpFind === 'function') ? veImpFind(veImpIdOf(sensorId)) : null;
  if(!ds) return;
  ds.columns.forEach(function(c) { veAddSignalToSlot(slotIdx, sensorId, c.key); });
}

// js/results.js:5104'ten birebir.
function veRemoveSensorFromSlot(slotIdx, sensorIdx) {
  var slot = veResultSlots[slotIdx];
  if(!slot || !slot.sensors || sensorIdx < 0 || sensorIdx >= slot.sensors.length) return;
  slot.sensors.splice(sensorIdx, 1);
  // Eksen kilitleri sıfırlanır: birim grupları değişmiş olabilir.
  slot.yAxisLock = {};
  if(typeof veImpDropStaleAxis === 'function') veImpDropStaleAxis(slot);
  if(typeof veTrRefresh === 'function') veTrRefresh(); else veRenderSlot(slotIdx);
  if(typeof veSigRefreshTree === 'function') veSigRefreshTree();
}

// ── Sürükle-bırak ─────────────────────────────────────────────────────────
// js/results.js:4400-4447'den birebir. Bırakma noktasının tek anlamı var:
// ŞERİDİN üzerine bırakılırsa o şeride katılır (ortak Y ekseni), boşluğa
// bırakılırsa kendi şeridini açar.

var veDraggingSensor = null;
var veDraggingSignal = null;

function veTrDragSession(e, onDrop) {
  if(e.button !== 0) return;
  e.preventDefault();

  var moveHandler = function(ev) {
    if(typeof veTrHighlightDrop === 'function') veTrHighlightDrop(ev.clientX, ev.clientY);
  };
  var upHandler = function(ev) {
    document.removeEventListener('mousemove', moveHandler);
    document.removeEventListener('mouseup', upHandler);
    var host = document.getElementById('ve-trace');
    if(host) host.classList.remove('drop-active');
    if(typeof veTrIsOver === 'function' && veTrIsOver(ev.clientX, ev.clientY)) onDrop(ev);
  };
  document.addEventListener('mousemove', moveHandler);
  document.addEventListener('mouseup', upHandler);
}

function veStartSensorDrag(e, sensorId) {
  veDraggingSensor = sensorId;
  veDraggingSignal = null;
  veTrDragSession(e, function() {
    veAddSensorToSlot(VE_BOARD, sensorId);
    veDraggingSensor = null;
  });
}

function veStartSignalDrag(e, sensorId, signalId) {
  veDraggingSensor = sensorId;
  veDraggingSignal = signalId;
  veTrDragSession(e, function(ev) {
    if(typeof veTrDropSignal === 'function') veTrDropSignal(ev.clientX, ev.clientY, sensorId, signalId);
    else veAddSignalToSlot(VE_BOARD, sensorId, signalId);
    veDraggingSensor = null;
    veDraggingSignal = null;
  });
}

// ── Tablo görünümü ────────────────────────────────────────────────────────
//
// Ölçüm penceresinin "Tablo" kipi. Çizgi kipini trace-view.js kendi canvas'ına
// çiziyor; buraya yalnızca tablo düşüyor. 3B dağılım kipi görüntüleyicide YOK
// (Three.js gerektiriyor ve ölçüm okumanın çekirdeğinde değil) — kip düğmesi
// de viewer/js/trace-view.js kopyasında listelenmiyor.

function veRenderSlot(slotIdx) {
  var slot = veResultSlots[slotIdx];
  var body = document.getElementById('ve-rslot-body-' + slotIdx);
  if(!body) return;

  var type = slot.type || 'line';
  if(type === 'line') {
    if(typeof veTrRender === 'function') veTrRender();
    return;
  }

  var sensors = slot.sensors || [];
  if(sensors.length === 0) {
    body.innerHTML =
      '<div class="ve-trace-empty" style="display:flex;">' +
      '<div class="ve-trace-empty-ico"><span class="mf-ico mf-ico-clipboard"></span></div>' +
      '<div class="ve-trace-empty-title">Veri Tablosu boş</div>' +
      '<div class="ve-trace-empty-sub">Veri Gezgini\'nden sinyal seçin.</div></div>';
    return;
  }

  var html = '<div class="ve-slot-assigned">';
  html += '<div style="overflow:auto; width:100%; height:100%; flex:1;">';
  html += '<table id="ve-table-' + slotIdx + '" class="ve-result-table">';
  html += '<thead><tr>';
  html += '<th>#</th>';
  html += '<th>' + escapeHTML(slot.xAxis ? slot.xAxis.name : 'Zaman [s]') + '</th>';
  sensors.forEach(function(s, i) {
    var c = veSlotSignalColor(slot, i);
    html += '<th style="color:' + c + '; border-bottom:3px solid ' + c + ';">' +
            escapeHTML(s.name) + (s.unit ? ' [' + escapeHTML(s.unit) + ']' : '') + '</th>';
  });
  html += '</tr></thead>';
  html += '<tbody id="ve-table-body-' + slotIdx + '">';
  html += '<tr><td colspan="' + (sensors.length + 2) + '" style="padding:20px; text-align:center; color:var(--text-muted);">Ölçüm verisi bekleniyor</td></tr>';
  html += '</tbody></table></div>';
  html += '</div>';
  body.innerHTML = html;

  if(typeof veImpAny === 'function' && veImpAny()) veRenderTable(slotIdx);
}

// js/graphics.js:409'dan uyarlama. Sim/çapraz-sekme zaman dizisi arayışı
// düştü: X ekseni ya panonun seçtiği sütun ya da ölçümün kendi zaman dizisi.
function veRenderTable(slotIdx) {
  var slot = veResultSlots[slotIdx];
  if(!slot || !slot.sensors || slot.sensors.length === 0) return;

  var tbody = document.getElementById('ve-table-body-' + slotIdx);
  if(!tbody) return;

  var ds = slot._dataSource || null;
  var xds = (slot.xAxis && slot.xAxis._dataSource) ? slot.xAxis._dataSource : ds;
  var timeArr = null;

  // Kullanıcı X eksenini başka bir sütuna çevirmiş olabilir.
  if(slot.xAxis && slot.xAxis.id && slot.xAxis.id !== 'time') {
    var c = slot.xAxis.id.indexOf(':');
    if(c > 0) timeArr = veGetSensorData(slot.xAxis.id.substring(0, c), slot.xAxis.id.substring(c + 1));
  }
  if(!timeArr && ds && String(ds).indexOf('import:') === 0 && typeof veImpXSeries === 'function') {
    timeArr = veImpXSeries(ds);
  }
  if(!timeArr || timeArr.length === 0) return;

  var datasets = slot.sensors.map(function(s) { return veGetSensorData(s.id, s.signal); });

  // X değeri içe aktarılan bir ölçümden gelir: metin ya da boşluk içerebilir,
  // toFixed doğrudan çağrılamaz.
  var fmtX = function(v) {
    return (typeof v === 'number' && isFinite(v)) ? v.toFixed(3) : (v == null ? '—' : String(v));
  };
  // Kanal metin olabilir (vites modu '1C'/'2L'); veFormatTooltipVal sayı bekler.
  var fmtY = function(v) {
    if(v === null || v === undefined) return '—';
    if(typeof v === 'number') return isFinite(v) ? veFormatTooltipVal(v) : '—';
    return escapeHTML(String(v));
  };

  var n = timeArr.length;
  var maxRows = 200;
  var step = Math.max(1, Math.floor(n / maxRows));

  var rows = [];
  var rowNum = 0;
  for(var i = 0; i < n; i += step) {
    rowNum++;
    var row = '<tr><td>' + rowNum + '</td>';
    row += '<td style="font-weight:600;">' + fmtX(timeArr[i]) + '</td>';
    datasets.forEach(function(d, di) {
      row += '<td style="color:' + veSlotSignalColor(slot, di) + ';">' +
             (d ? fmtY(i < d.length ? d[i] : null) : '—') + '</td>';
    });
    rows.push(row + '</tr>');
  }

  // Son satır her zaman gösterilir: adımlama onu atlarsa tablonun sonu
  // ölçümün sonu sanılırdı.
  if((n - 1) % step !== 0 && n > 1) {
    rowNum++;
    var last = '<tr style="border-top:2px solid var(--border-color);"><td>' + rowNum + '</td>';
    last += '<td style="font-weight:700;">' + fmtX(timeArr[n - 1]) + '</td>';
    datasets.forEach(function(d, di) {
      last += '<td style="color:' + veSlotSignalColor(slot, di) + '; font-weight:700;">' +
              (d ? fmtY(d[n - 1]) : '—') + '</td>';
    });
    rows.push(last + '</tr>');
  }

  // MIN / ORT / MAKS — yalnızca sayısal kanallarda anlamlı.
  var numOf = function(d) {
    if(!d) return null;
    var out = [];
    for(var i2 = 0; i2 < d.length; i2++) {
      var v = d[i2];
      if(typeof v === 'number' && isFinite(v)) out.push(v);
    }
    return out.length ? out : null;
  };
  var sumRow = function(label, borderTop, fn) {
    var r = '<tr style="background:var(--bg-tertiary);' +
            (borderTop ? ' border-top:2px solid var(--accent-primary);' : '') +
            '"><td colspan="2" style="font-weight:700; color:var(--text-muted);">' + label + '</td>';
    datasets.forEach(function(d, di) {
      var nums = numOf(d);
      var v = nums ? fn(nums) : null;
      r += '<td style="color:' + veSlotSignalColor(slot, di) + '; font-weight:700;">' +
           (v === null ? '—' : veFormatTooltipVal(v)) + '</td>';
    });
    return r + '</tr>';
  };
  rows.push(sumRow('MİN', true, function(a) { return Math.min.apply(null, a); }));
  rows.push(sumRow('ORT', false, function(a) {
    var s = 0; for(var i3 = 0; i3 < a.length; i3++) s += a[i3];
    return s / a.length;
  }));
  rows.push(sumRow('MAKS', false, function(a) { return Math.max.apply(null, a); }));

  tbody.innerHTML = rows.join('');
}

// ── X ekseni seçici ───────────────────────────────────────────────────────

// Panoya girebilecek eksenler. MFSim'de topolojideki tüm bileşen sinyalleri
// de listeleniyordu; burada kaynak tek: panodaki ölçüm dosyası.
//
// ÖNEMLİ: yalnızca AYNI veri kümesinin sütunları sunulur. Başka bir dosyanın
// sütununu eksen yapmak, farklı uzunlukta iki diziyi indeks hizasıyla
// eşleştirirdi — grafik makul görünür, veri yanlış olurdu. Bırakma anındaki
// tek-eksen kuralı (measure-core.js) seçiciden atlatılamamalı.
function veGetAvailableXAxisOptions(slotIdx) {
  var slot = veResultSlots[slotIdx];
  var options = [];
  if(!slot) return options;

  var dsId = veImpIdOf(slot._dataSource || '');
  var ds = dsId ? veImpFind(dsId) : null;
  if(!ds) return options;

  var currentId = (slot.xAxis && slot.xAxis.id) ? slot.xAxis.id : 'time';

  // 1) Ölçümün kendi X sütunu (dosyadan geldiği hâliyle)
  options.push({
    group: ds.name, id: 'time', name: ds.x.name, unit: ds.x.unit || '',
    _dataSource: ds.dataSource, active: currentId === 'time'
  });

  // 2) Aynı dosyanın panodaki diğer sütunları
  var seen = {};
  (slot.sensors || []).forEach(function(s) {
    if(veImpIdOf(s.id) !== dsId) return;
    var axId = s.id + ':' + s.signal;
    if(seen[axId]) return;
    seen[axId] = true;
    options.push({
      group: 'Panodaki Sinyaller', id: axId, sensorId: s.id, signal: s.signal,
      name: s.name, unit: s.unit || '', _dataSource: ds.dataSource,
      active: currentId === axId
    });
  });

  return options;
}

// js/results.js:5256'dan birebir.
function veShowXAxisPicker(slotIdx, e) {
  if(e) e.stopPropagation();

  var existing = document.getElementById('ve-xaxis-dropdown-' + slotIdx);
  if(existing) { existing.remove(); return; }

  document.querySelectorAll('.ve-xaxis-dropdown').forEach(function(d) { d.remove(); });

  var area = document.getElementById('ve-xaxis-area-' + slotIdx);
  var chartArea = document.getElementById('ve-chart-area-' + slotIdx);
  var parentEl = area || chartArea;
  if(!parentEl) return;

  var options = veGetAvailableXAxisOptions(slotIdx);
  if(options.length === 0) {
    showToast('X ekseni seçimi için önce bir ölçüm içe aktarın.', 'info');
    return;
  }

  var html = '';
  var lastGroup = '';
  options.forEach(function(opt, i) {
    if(opt.group !== lastGroup) {
      lastGroup = opt.group;
      html += '<div class="ve-xaxis-dropdown-group">' + escapeHTML(opt.group) + '</div>';
    }
    html += '<div class="ve-xaxis-dropdown-item' + (opt.active ? ' active' : '') + '" ';
    html += 'onclick="veSetSlotXAxis(' + slotIdx + ',' + i + ');event.stopPropagation();" ';
    html += 'data-opt-idx="' + i + '">';
    html += '<span>' + (opt.active ? '● ' : '') + escapeHTML(opt.name) + '</span>';
    if(opt.unit) html += '<span class="ve-xaxis-unit">' + escapeHTML(opt.unit) + '</span>';
    html += '</div>';
  });

  var dd = document.createElement('div');
  dd.className = 've-xaxis-dropdown';
  dd.id = 've-xaxis-dropdown-' + slotIdx;
  dd.innerHTML = html;
  dd._options = options;

  if(!area && chartArea) {
    dd.style.position = 'absolute';
    dd.style.bottom = '6px';
    dd.style.left = '50%';
    dd.style.transform = 'translateX(-50%)';
  }
  parentEl.appendChild(dd);

  setTimeout(function() {
    function closeHandler(ev) {
      if(!dd.contains(ev.target)) {
        dd.remove();
        document.removeEventListener('mousedown', closeHandler, true);
      }
    }
    document.addEventListener('mousedown', closeHandler, true);
  }, 0);
}

function veSetSlotXAxis(slotIdx, optIdx) {
  var dd = document.getElementById('ve-xaxis-dropdown-' + slotIdx);
  if(!dd || !dd._options) return;
  var opt = dd._options[optIdx];
  if(!opt) return;

  // _dataSource eksen tanımında KALMAK ZORUNDA: trace-view.js:365 X dizisini
  // onunla çözüyor. Düşürülürse eksen ölçümün zaman dizisine değil hiçbir
  // şeye bağlanır ve pencere boşalır.
  var newAxis = (opt.id === 'time')
    ? { id: 'time', name: opt.name + (opt.unit ? ' [' + opt.unit + ']' : ''),
        unit: opt.unit || '', _dataSource: opt._dataSource }
    : { id: opt.id, name: opt.name + (opt.unit ? ' [' + opt.unit + ']' : ''),
        unit: opt.unit || '', sensorId: opt.sensorId || null,
        signal: opt.signal || null, _dataSource: opt._dataSource };

  dd.remove();

  var slot = veResultSlots[slotIdx];
  if(!slot || !slot.sensors || slot.sensors.length === 0) return;
  slot.xAxis = Object.assign({}, newAxis);

  var btn = document.querySelector('#ve-xaxis-area-' + slotIdx + ' .ve-xaxis-btn span:first-child');
  if(btn) btn.textContent = slot.xAxis.name;
  var th = document.querySelector('#ve-table-' + slotIdx + ' thead th:nth-child(2)');
  if(th) th.textContent = slot.xAxis.name;

  // Eksen değişti: sabitlenmiş imleç ve yakınlaştırma penceresi artık başka
  // bir alana ait. Korunursa eğrinin tamamı ekran dışında kalır.
  if(typeof veTrResetView === 'function') veTrResetView();
  if(typeof veTrResetCache === 'function') veTrResetCache();
  if((slot.type || 'line') === 'line') {
    if(typeof veTrRender === 'function') veTrRender();
  } else {
    veRenderTable(slotIdx);
  }

  veSyncBoardState();
  showToast('X ekseni ' + slot.xAxis.name + ' olarak ayarlandı', 'info');
}

// ── Veri Gezgini genişlik ayırıcısı ───────────────────────────────────────
// js/results.js:4369'dan birebir.
function veInitResultSlots() {
  var br = document.getElementById('ve-results-browser-resizer');
  var bp = document.getElementById('ve-results-browser');
  if(!br || !bp || br._init) return;
  br._init = true;
  var resizing = false, startX, startW;
  br.addEventListener('mousedown', function(e) {
    resizing = true; startX = e.clientX; startW = bp.offsetWidth;
    document.body.style.cursor = 'ew-resize'; document.body.style.userSelect = 'none';
    e.preventDefault();
  });
  document.addEventListener('mousemove', function(e) {
    if(!resizing) return;
    bp.style.width = Math.max(160, Math.min(400, startW + (e.clientX - startX))) + 'px';
  });
  document.addEventListener('mouseup', function() {
    if(!resizing) return;
    resizing = false;
    document.body.style.cursor = ''; document.body.style.userSelect = '';
    // Ölçüm penceresinin genişliği değişti — zaman ekseni yeniden hizalanmalı
    if(typeof veTrRenderSoon === 'function') veTrRenderSoon();
  });
}

// Jest: saf yardımcılar doğrudan test edilebilsin
if(typeof module !== 'undefined' && module.exports) {
  module.exports = {
    veFormatTooltipVal: veFormatTooltipVal,
    veNiceStep: veNiceStep,
    veAxisDecimals: veAxisDecimals,
    veFormatAxisVal: veFormatAxisVal,
    escapeHTML: escapeHTML
  };
}
