// ============================================================================
// TOPOLOJİ SEKME SİSTEMİ
// ============================================================================
var veTabs = [];
var veActiveTabIdx = 0;
var veTabCounter = 0;

function veSerializeCurrentState() {
  return {
    // Migrasyon damgası: sürümlü state'ler restoreState'te LEGACY migrasyonu
    // ATLAR → kullanıcının kasıtlı girdileri (ör. Cd=0.75) ezilmez.
    schemaVersion: (typeof VE_SCHEMA_VERSION !== 'undefined' ? VE_SCHEMA_VERSION : 2),
    nodes: JSON.parse(JSON.stringify(nodes.map(function(n) {
      return {
        id: n.id, type: n.type, x: n.x, y: n.y,
        width: n.width || 65, height: n.height || 60,
        customName: n.customName || '', mirrored: n.mirrored || false,
        isMasterWheel: n.isMasterWheel || false, isMasterDiff: n.isMasterDiff || false, data: n.data || {}
      };
    }))),
    connections: JSON.parse(JSON.stringify(connections.map(function(c) {
      return {
        id: c.id, from: c.from, to: c.to,
        fromPort: c.fromPort || 'output', toPort: c.toPort || 'input',
        lineType: c.lineType || 'curve', controlPoints: c.controlPoints || []
      };
    }))),
    compCounter: compCounter,
    canvasOffset: { x: canvasOffset.x, y: canvasOffset.y },
    canvasZoom: canvasZoom,
    undoStack: JSON.parse(JSON.stringify(undoStack)),
    redoStack: JSON.parse(JSON.stringify(redoStack)),
    simResults: (function() { try { return window.veSimResults ? JSON.parse(JSON.stringify(window.veSimResults)) : null; } catch(e) { return null; } })(),
    resultSlots: JSON.parse(JSON.stringify(veResultSlots)),
    annotations: (typeof serializeAnnotations === 'function') ? serializeAnnotations() : []
  };
}

// ────────────────────────────────────────────────────────────────────────────
// GÖMME/KAYIT İÇİN DURUM HAFİFLETME  (kritik regresyon düzeltmesi)
// ────────────────────────────────────────────────────────────────────────────
// veSerializeCurrentState() çıktısı BAŞKA bir yapının içine gömülürken
// (node.data.subTopology, kayıt dosyası, otomatik yedek) iki alan ölümcüldür:
//
//   • undoStack / redoStack — yalnızca AKTİF düzenleme oturumuna aittir. Gömülünce
//     ÇARPIMSAL büyür: alt-topolojiden çıkışta subState → node.data'ya yazılır,
//     saveState() o node.data'yı (subTopology dahil) HER undo adımına kopyalar, bu
//     da bir sonraki serileştirmeye geri girer. N seviye iç içe × 50 undo × 50
//     alt-undo … → JSON.stringify V8 string sınırını (~512 MB) aşar ("Invalid
//     string length") ve otomatik yedek localStorage kotasını taşırır.
//
//   • simResults — tam çözünürlüklü TÜRETİLMİŞ veridir (tek "Hesapla" ile yeniden
//     üretilir). Gömülü kopya seyreltilir; canlı bellekteki tam çözünürlüğe
//     (window.veSimResults) DOKUNULMAZ.
//
// İç içe subTopology'ler de RECURSIVE temizlenir → eski/şişmiş bir dosyadan
// yüklenmiş durum yüklenince sınırlanır. Girdi MUTASYONA UĞRATILMAZ: canlı
// tab.state / node.data referansları bozulmasın diye yalnızca gereken yerlerde
// yeni kopyalar üretilir (hiç subTopology yoksa aynı dizi referansı döner).
//
// opts.stripResults=true → gömülü sonuçlar tamamen düşer (otomatik yedek; en küçük)
// opts.maxPoints        → seyreltme üst sınırı (varsayılan: veDecimateSimResults'ınki)
var VE_SUBTOPO_SANITIZE_MAX_DEPTH = 64; // bozuk/patolojik iç içelikte yığın taşmasına karşı

function veSanitizeNodesSubtopology(nodeArr, opts, _depth) {
  if(!Array.isArray(nodeArr)) return nodeArr;
  _depth = _depth || 0;
  var touched = false;
  var out = nodeArr.map(function(n) {
    if(!n || !n.data || !n.data.subTopology) return n; // gömülü topoloji yok → aynen
    touched = true;
    var cleanData = {};
    for(var dk in n.data) if(Object.prototype.hasOwnProperty.call(n.data, dk)) cleanData[dk] = n.data[dk];
    cleanData.subTopology = (_depth + 1 >= VE_SUBTOPO_SANITIZE_MAX_DEPTH)
      ? null // aşırı derin → daha derini at (gerçekte erişilmez; güvenlik freni)
      : veSanitizeEmbeddedState(n.data.subTopology, opts, _depth + 1);
    var cleanNode = {};
    for(var nk in n) if(Object.prototype.hasOwnProperty.call(n, nk)) cleanNode[nk] = n[nk];
    cleanNode.data = cleanData;
    return cleanNode;
  });
  return touched ? out : nodeArr; // hiç değişiklik yoksa gereksiz kopya üretme
}

function veSanitizeEmbeddedState(state, opts, _depth) {
  if(!state || typeof state !== 'object') return state;
  opts = opts || {};
  _depth = _depth || 0;
  var out = {};
  for(var k in state) if(Object.prototype.hasOwnProperty.call(state, k)) out[k] = state[k];
  // Uçucu düzenleme geçmişi asla gömülmez (çarpımsal büyümenin ana kaynağı).
  out.undoStack = [];
  out.redoStack = [];
  // Sonuçlar: stripResults → tamamen düş; değilse seyrelt. veDecimateSimResults
  // toolbar.js'te tanımlı ve yalnızca runtime'da (yükleme sonrası) çağrılır.
  if(opts.stripResults) {
    out.simResults = null;
  } else if(out.simResults && typeof veDecimateSimResults === 'function') {
    try { out.simResults = veDecimateSimResults(out.simResults, opts.maxPoints); } catch(e) {}
  }
  // İç içe alt-topolojiler de aynı kurallarla temizlenir.
  out.nodes = veSanitizeNodesSubtopology(out.nodes, opts, _depth);
  return out;
}

function veSaveActiveTabState() {
  // YENİDEN-GİRİŞ KORUMASI: Bir alt-topoloji (Araç Performans / Takoz / FEAD)
  // giriş-çıkış işlemi HÂLÂ sürerken (_veAracBusy/_veMntBusy/_veFeadBusy true —
  // atomik canvas takası ortası)
  // buraya sıçranırsa (örn. veAracOpenEditor → veLoadTabState → veUpdateResultsTree
  // yeniden-girişli olarak veSaveActiveTabStateKeepView'i çağırır), canlı canvas henüz
  // köke ÇÖKMEMİŞ düz alt-topolojidir; şimdi serialize etmek tab.state'e composite
  // yerine 16 düğümlü DÜZ alt-topolojiyi yazar ve "Araç Performans" sarmalayıcısını
  // kaybederiz (kaydedilen dosya bozulur). Dıştaki işlem bitince doğru kök durumu
  // zaten yazılacağı için burada sessizce çık.
  if((typeof _veAracBusy !== 'undefined' && _veAracBusy) ||
     (typeof _veMntBusy !== 'undefined' && _veMntBusy) ||
     (typeof _veFeadBusy !== 'undefined' && _veFeadBusy)) return;

  // Bir "Araç Performans" alt-topolojisi içindeysek, kaydetmeden/sekme değiştirmeden
  // önce köke (ana topoloji) çık — böylece canlı canvas alt-topoloji değil kök olur
  // ve serileştirme doğru durumu yazar (alt-topoloji ilgili düğümün data'sına saklı).
  if(typeof veAracCollapseToRoot === 'function') veAracCollapseToRoot();
  if(typeof veMntCollapseToRoot === 'function') veMntCollapseToRoot();
  if(typeof veFeadCollapseToRoot === 'function') veFeadCollapseToRoot();
  if(veTabs.length === 0) return;
  var tab = veTabs[veActiveTabIdx];
  if(!tab) return;
  // Açık paneldeki DOM değerlerini node.data'ya yaz (onchange tetiklenmemiş olabilir)
  veFlushOpenPanelData();
  var s = veSerializeCurrentState();
  tab.state = s;
  tab.nodeCount = nodes.length;
  tab.connCount = connections.length;
}

// Sessiz alt-topoloji gidiş-dönüşü (köke çök → serialize → geri gir) SÜRÜYOR mu?
// Bu tur boyunca canvas ve seçim baştan kurulur; yol üzerindeki her adım açık
// özellik penceresini kapatmaya çalışır (clearSelection → showEmptyProperties,
// ve veMntOpenEditor/veAracOpenEditor'ın kendi kapatma çağrısı). Kullanıcı
// HİÇBİR ŞEY yapmadığı için (tetikleyen arka-plan kaydetmesi) pencerenin
// kapanması bir hataydı: 3D Görüntüleyici gibi uzun süre açık kalan paneller
// "kendiliğinden kapanıyor" görünüyordu. Bayrak açıkken kapatma çağrıları
// yutulur (bkz. veTogglePropertiesPanel) ve tur sonunda panel geri açılır.
var _veSubtopoNavRestoring = false;
function veSubtopoNavRestoring() { return _veSubtopoNavRestoring; }

// Açık özellik penceresini (tek seçili düğüm + görünürlük) yakalar; tur sonunda
// AYNI düğümün panelini sessizce geri açan bir fonksiyon döndürür.
function _veCaptureOpenPanel() {
  var nodeId = null, wasOpen = false;
  try {
    if(typeof selectedNodes !== 'undefined' && selectedNodes && selectedNodes.length === 1 && selectedNodes[0]) {
      nodeId = selectedNodes[0].id;
    }
    if(typeof document !== 'undefined') {
      var ov = document.getElementById('ve-properties-overlay');
      wasOpen = !!(ov && ov.classList && ov.classList.contains('visible'));
    }
  } catch(e) {}
  return function _veRestoreOpenPanel() {
    if(!nodeId) return;
    try {
      // Düğüm nesneleri veLoadTabState ile YENİDEN oluşturulur → id ile bul.
      var n = (typeof nodes !== 'undefined' && nodes) ? nodes.find(function(x){ return x && x.id === nodeId; }) : null;
      if(!n) return;                                  // düğüm silinmiş → sessizce geç
      if(typeof clearSelection === 'function') clearSelection();
      if(typeof addToSelection === 'function') addToSelection(n);   // → showNodeProperties
      else if(typeof showNodeProperties === 'function') showNodeProperties(n);
      if(wasOpen && typeof veTogglePropertiesPanel === 'function') veTogglePropertiesPanel(true);
    } catch(e) { if(typeof console !== 'undefined') console.warn('[MFSim] panel geri yükleme:', e && e.message); }
  };
}

// Alt-topoloji (Araç Performans / Takoz / FEAD iç topolojisi) gezinme yolunu
// yakalar ve kullanıcıyı aynı yola SESSİZCE (toast/animasyon yok) geri götüren
// bir "restore" fonksiyonu döndürür. Köke çökme (veSaveActiveTabState) sonrası
// yeniden giriş için. Açık özellik penceresi de aynı turda korunur
// (bkz. _veCaptureOpenPanel).
function _veCaptureSubtopoNav() {
  var aracPath = [];
  var mntPath = [];
  var feadPath = [];
  try { if(typeof veAracStack !== 'undefined' && veAracStack && veAracStack.length) aracPath = veAracStack.map(function(c){ return c.nodeId; }); } catch(e) {}
  try { if(typeof veMntStack !== 'undefined' && veMntStack && veMntStack.length) mntPath = veMntStack.map(function(c){ return c.nodeId; }); } catch(e) {}
  try { if(typeof veFeadStack !== 'undefined' && veFeadStack && veFeadStack.length) feadPath = veFeadStack.map(function(c){ return c.nodeId; }); } catch(e) {}
  // Alt-topolojide DEĞİLSEK canvas hiç değişmez → panele dokunma (gereksiz
  // yeniden çizim açık panelin kaydırma konumunu/odağını bozardı).
  if(!aracPath.length && !mntPath.length && !feadPath.length) {
    return function _veRestoreSubtopoNavNoop() {};
  }
  var restorePanel = _veCaptureOpenPanel();
  _veSubtopoNavRestoring = true;
  return function _veRestoreSubtopoNav() {
    try {
      // Köke çökmüş canvas'ta yolu baştan (kök→derin) yeniden gir; _silent=true.
      // Düğüm silinmişse open editor no-op'tur (güvenli).
      if(aracPath.length && typeof veAracOpenEditor === 'function') aracPath.forEach(function(id){ veAracOpenEditor(id, true); });
      if(mntPath.length && typeof veMntOpenEditor === 'function') mntPath.forEach(function(id){ veMntOpenEditor(id, true); });
      if(feadPath.length && typeof veFeadOpenEditor === 'function') feadPath.forEach(function(id){ veFeadOpenEditor(id, true); });
    } catch(e) { if(typeof console !== 'undefined') console.warn('[MFSim] alt-topoloji geri yükleme:', e && e.message); }
    finally {
      // Panel geri açılırken bayrak HÂLÂ açık: addToSelection'ın içindeki
      // clearSelection→showEmptyProperties zinciri pencereyi kapatmasın.
      try { restorePanel(); } finally { _veSubtopoNavRestoring = false; }
    }
  };
}

// Aktif sekmeyi kaydeder AMA kullanıcının açık alt-topolojisini bozmadan: köke çök →
// doğru kök durumu serialize et → kullanıcıyı bulunduğu alt-topolojiye sessizce geri
// getir. TERMINAL OLMAYAN / arka-plan çağıranlar bunu kullanır (sonuç ağacı yenileme,
// autosave, dosya kaydı, sekme çoğaltma, snapshot) — böylece kaydetmenin köke-çökme
// yan-etkisi kullanıcıyı ana topolojiye atmaz. Sekme değiştir/yükle gibi TERMINAL
// akışlar düz veSaveActiveTabState() kullanmaya devam eder (onlar zaten canvası
// değiştirdiği için geri-giriş gereksiz/yanlış olurdu).
function veSaveActiveTabStateKeepView() {
  var restore = _veCaptureSubtopoNav();
  // try/finally: serileştirme patlasa bile kullanıcı alt-topolojisine geri
  // getirilir ve "panel kapatma yutma" bayrağı asla açık kalmaz.
  try { veSaveActiveTabState(); } finally { restore(); }
}

/**
 * Açık özellik panelindeki tüm DOM input değerlerini node.data'ya flush eder.
 * Kullanıcı bir değer değiştirip onchange tetiklemeden kaydet diyebilir.
 */
function veFlushOpenPanelData() {
  if(!selectedNodes || selectedNodes.length === 0) return;
  var node = selectedNodes[0];
  if(!node || !node.id) return;
  var nid = node.id;
  // İÇERİK BU BİLEŞENİN DEĞİLSE OKUNMAZ: işleyiciler alanları kimlikle DOM'dan
  // okuyor; çoklu seçimde ya da sütun kartında (cp-core.js) o alanlar yok ve
  // okunan boşluk bileşenin verisine yazılırdı.
  if(typeof _veLastPropNodeId !== 'undefined' && _veLastPropNodeId !== nid) return;
  if(typeof _veMufettisKart !== 'undefined' && _veMufettisKart) return;
  var isFT = veActiveModule === 'full-throttle';

  try {
    switch(node.type) {
      case 'engine':
        onVEMotorDataChange(nid);
        if(isFT) {
          onVEFTSpecChange(nid);
          onVEAccChange(nid);
          // FT motor preset dropdown
          var ftMotSel = document.getElementById('ve-ft-motor-select-' + nid);
          if(ftMotSel && ftMotSel.value) node.data.ftMotorPreset = ftMotSel.value;
        } else {
          onVEMotorParamChange(nid);
          // MF motor preset dropdown
          var mfMotSel = document.getElementById('ve-motor-select-' + nid);
          if(mfMotSel && mfMotSel.value) node.data.mfMotorPreset = mfMotSel.value;
          var mfCatSel = document.getElementById('ve-motor-category-' + nid);
          if(mfCatSel) node.data.mfCategory = mfCatSel.value;
        }
        break;
      case 'gearbox':
        if(isFT) {
          onVEFTGearDataChange(nid);
          onVEFTGBParamChange(nid);
          // FT gearbox preset dropdown
          var ftGbSel = document.getElementById('ve-ft-gb-preset-' + nid);
          if(ftGbSel && ftGbSel.value) node.data.ftGBPreset = ftGbSel.value;
        } else {
          onVEGearboxDataChange(nid);
          onVEGearboxEffChange(nid);
          // MF gearbox preset dropdown
          var mfGbSel = document.getElementById('ve-gearbox-select-' + nid);
          if(mfGbSel && mfGbSel.value) node.data.selectedGearbox = mfGbSel.value;
        }
        break;
      case 'torque-converter':
        if(isFT) {
          onVETCDataChange(nid);
          onVEFTTCParamChange(nid);
        } else {
          onVETCParamChange(nid);
        }
        break;
      case 'transfer':
        if(isFT) {
          onVEFTTransferParamChange(nid);
        } else {
          onVETransferDataChange(nid);
          onVETransferEffChange(nid);
        }
        break;
      case 'propshaft':
        onVEPropshaftParamChange(nid);
        break;
      case 'differential':
        onVEDiffParamChange(nid);
        break;
      case 'wheel':
        if(isFT) {
          onVEFTWheelParamChange(nid);
          // FT tire preset dropdown
          var ftTireSel = document.getElementById('ve-ft-tire-preset-' + nid);
          if(ftTireSel && ftTireSel.value) node.data.ftTirePreset = ftTireSel.value;
        } else {
          onVEWheelParamChange(nid);
          // MF tire preset dropdown
          var mfTireSel = document.getElementById('ve-tire-preset-' + nid);
          if(mfTireSel && mfTireSel.value) node.data.tirePreset = mfTireSel.value;
        }
        break;
      case 'vehicle':
        if(isFT) {
          onVEFTVehicleParamChange(nid);
        } else {
          onVEVehicleParamChange(nid);
        }
        break;
      case 'solver':
        onVESolverParamChange(nid);
        break;
      case 'road':
        onVERoadParamChange(nid);
        break;
      case 'ec-matching':
        var ecmRatingEl = document.getElementById('ecm-turbine-rating-' + nid);
        if(ecmRatingEl) { var ecmVal = parseFloat(ecmRatingEl.value); node.data.turbineRating = isNaN(ecmVal) ? 3320 : ecmVal; }
        break;
      case 'acc-ac':
      case 'acc-alternator':
      case 'acc-aircomp':
        if(typeof onVEAccParamChange === 'function') onVEAccParamChange(nid);
        var accSel = document.getElementById('ve-acc-preset-' + nid);
        if(accSel) node.data.accPreset = accSel.value;
        break;
    }
  } catch(e) {
    // Panel açık değilse DOM elemanları bulunamaz — debug için logla
    console.warn('[MFSim] Node data sync hatası (' + (node ? node.type : '?') + '):', e.message);
  }
}

// Alt-topolojiye giriş/çıkışta canvas'ın yumuşak (fade + hafif zoom) geçişi.
// direction: 'enter' (alt-sisteme in) | 'exit' (üst topolojiye dön). Senkron DOM
// takasını DEĞİŞTİRMEZ — yalnız görsel katman: gelen sahneye tek seferlik animasyon
// ekler. Class animationend'de kaldırılır ki art arda navigasyonda tekrar tetiklensin.
// prefers-reduced-motion açıksa ve non-DOM ortamda (Jest) no-op.
function veAnimateCanvasTransition(direction) {
  if(typeof document === 'undefined' || typeof document.getElementById !== 'function') return;
  // Canlı canvas'ı içeren wrapper'ı bul (split görünümde birden çok wrapper olabilir).
  var canvas = document.getElementById('ve-canvas');
  var wrap = (canvas && typeof canvas.closest === 'function') ? canvas.closest('.ve-canvas-wrapper') : null;
  if(!wrap) wrap = document.getElementById('ve-canvas-wrapper');
  if(!wrap || !wrap.classList) return;
  if(typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
    try { if(window.matchMedia('(prefers-reduced-motion: reduce)').matches) return; } catch(e) {}
  }
  var cls = (direction === 'exit') ? 've-topo-anim-exit' : 've-topo-anim-enter';
  wrap.classList.remove('ve-topo-anim-enter', 've-topo-anim-exit');
  void wrap.offsetWidth;   // reflow → aynı animasyon art arda yeniden tetiklenebilsin
  wrap.classList.add(cls);
  var done = function() {
    wrap.classList.remove(cls);
    wrap.removeEventListener('animationend', done);
  };
  wrap.addEventListener('animationend', done);
}

function veClearCanvasDOM() {
  nodes.forEach(function(n) {
    var el = document.getElementById(n.id);
    if(el) el.remove();
  });
  var svg = document.getElementById('ve-connections-layer');
  if(svg) svg.innerHTML = '';
  nodes = [];
  connections = [];
  selectedNodes = [];
  if(typeof clearAnnotationDOM === 'function') clearAnnotationDOM();
  if(typeof annotations !== 'undefined') { annotations = []; selectedAnnotations = []; }
}

// Bir PROJE yüklenirken (dosya açma / otomatik yedekten dönüş) açık alt-topoloji
// gezinme yolu GEÇERSİZDİR: veAracStack/veMntStack/veFeadStack girdilerindeki parentState
// ÖNCEKİ projeye aittir. Temizlenmezse ilk arka-plan kaydı (otomatik yedek,
// sonuç ağacı yenileme, sekme değiştirme → veSaveActiveTabState) önce
// veAracCollapseToRoot ile "köke çıkar" ve o ESKİ parentState'i canlı duruma
// geri yazar → yeni açılan projenin düğümleri, bağlantıları ve gruplama
// çerçeveleri sessizce önceki projeyle DEĞİŞİR. Ölçülen senaryo: alt-topoloji
// açıkken proje aç → tab.state 1 düğüm/1 çerçeve yerine önceki projenin 3
// düğüm/başka çerçevesini taşıyor.
function veResetSubtopoNav() {
  if(typeof veAracStack !== 'undefined' && Array.isArray(veAracStack)) veAracStack.length = 0;
  if(typeof veMntStack !== 'undefined' && Array.isArray(veMntStack)) veMntStack.length = 0;
  if(typeof veFeadStack !== 'undefined' && Array.isArray(veFeadStack)) veFeadStack.length = 0;
  // Takoz çözüm sonucu OTURUMLUK bir global (window.veMountResults / _veMntLast)
  // ve hiçbir sekme durumuna bağlı değil. Proje değiştirilirken temizlenmezse
  // yeni projede — takoz modülü hiç olmasa bile — "Takoz Çökme-Titreşim" çözüm
  // sekmesi ÖNCEKİ projenin takoz adlarıyla durur, kanalları panoya bırakılabilir
  // ve Rapor kısayolu önceki projenin raporunu üretir.
  if(typeof _mntForgetResults === 'function') _mntForgetResults();
  // FEAD sonucu da oturumluk bir global (window.veFeadResults). Aynı tuzak:
  // temizlenmezse yeni projede — FEAD modülü hiç olmasa bile — önceki
  // projenin gerilme/ömür tabloları çözücü panelinde durur.
  if(typeof _feadForgetResults === 'function') _feadForgetResults();
  // Parametrik Analiz'in taramaları da oturumluk (düğüm kimliğiyle): yeni
  // projede aynı kimlikli düğüm öncekinin taramasını "eskimiş" diye taşırdı.
  if(typeof veMntParamUnut === 'function') veMntParamUnut();
  // Takoz'un STEP oturumu da (dosya + roller, modül kimliğiyle): yeni projede
  // aynı kimlikli modül öncekinin dosyasını ve rollerini gösteriyordu.
  if(typeof veMntWizStpUnut === 'function') veMntWizStpUnut();
  // Breadcrumb çipleri stack boşalınca kendini kaldırır; sidebar kapsamı köke döner.
  if(typeof veAracUpdateBreadcrumb === 'function') veAracUpdateBreadcrumb();
  if(typeof veMntUpdateBreadcrumb === 'function') veMntUpdateBreadcrumb();
  if(typeof veFeadUpdateBreadcrumb === 'function') veFeadUpdateBreadcrumb();
  if(typeof veSyncSidebarScope === 'function') veSyncSidebarScope();
}

// Boş/kamerasız durumlar için "ev" kamerası: kanvas merkezi (3000,3000) görünümün
// ORTASINDA. Eski sabit {3000,3000} yerel (0,0)'ı sol-üst köşeye koyuyordu → yeni
// sekmede kurulan topoloji ızgaranın köşesinden başlıyordu (bkz. js/canvas-space.js).
function _veHomeOffset() {
  return (typeof veHomeCameraOffset === 'function') ? veHomeCameraOffset() : { x: 3000, y: 3000 };
}

function veLoadTabState(tab) {
  var s = tab.state;
  if(!s) {
    nodes = [];
    connections = [];
    compCounter = tab.compCounterBase || compCounter;
    canvasOffset = _veHomeOffset();
    canvasZoom = 1;
    undoStack = [];
    redoStack = [];
    window.veSimResults = null;
    veResultSlots = [{},{},{},{}];
    if(typeof restoreAnnotations === 'function') restoreAnnotations([]);
    updateCanvasTransform();
    updateAllConnections();
    updateNodeCount();
    if(typeof veMufettisKapat === 'function') veMufettisKapat(); else showEmptyProperties();   // bağlam değişti — pencere kapanır (map.js)
    veRefreshResultsUI();
    return;
  }
  
  compCounter = s.compCounter || 0;
  canvasOffset = s.canvasOffset || _veHomeOffset();
  canvasZoom = s.canvasZoom || 1;
  undoStack = s.undoStack || [];
  redoStack = s.redoStack || [];
  window.veSimResults = s.simResults || null;
  veResultSlots = s.resultSlots || [{},{},{},{}];
  // Proje dosyası şerit listesini saklar, ham ölçümü saklamaz: bu oturumda
  // olmayan bir veri kümesine bakan şeritler burada düşer (bkz. veEnterResults).
  if(typeof veImpPruneSlots === 'function') veImpPruneSlots(veResultSlots);
  updateCanvasTransform();
  
  if(s.nodes && s.nodes.length > 0) {
    restoreState(s);
  } else {
    nodes = [];
    connections = [];
    if(typeof restoreAnnotations === 'function') restoreAnnotations(s.annotations || []);
    updateAllConnections();
    updateNodeCount();
  }
  if(typeof veMufettisKapat === 'function') veMufettisKapat(); else showEmptyProperties();   // bağlam değişti — pencere kapanır (map.js)
  veRefreshResultsUI();
}

// Sonuçlar panelini sekme geçişinde yenile
function veRefreshResultsUI() {
  // Results tree güncelle
  if(typeof veUpdateResultsTree === 'function') veUpdateResultsTree();
  // Ölçüm penceresini kur/tazele. Eski projelerde sinyaller 1..3 numaralı
  // panellerde olabilir; veTrEnter() onları panoya taşır.
  if(typeof veTrEnter === 'function') veTrEnter();
  else if(typeof veRefreshAllCharts === 'function') setTimeout(veRefreshAllCharts, 50);
}

// TEK TOPOLOJİ (kullanıcı 2026-11-09, Canlı Not 87: *"Programda genel olarak tek bir
// topoloji üzerinden ilerliyoruz. Yan yana ek topolojiler açıp sistem kurmuyoruz. O
// yüzden bu topoloji pencere mantığını tamamen kaldıralım programdan. Bu görüntüyü de
// kaldıralım."*): sekme şeridi, sekme ekleme · kapatma · adlandırma · çoğaltma · geçiş
// ve yan yana görünüm (bölmeler) KALKTI. `veTabs` içte tek elemanlı kap olarak kalır —
// kaydetme biçimi (`tabs:[…]`), sonuçların ve STEP oturumunun anahtarı onu okur; birden
// çok topolojili eski proje açılırken yalnız etkin topoloji yüklenir (js/settings.js).
// Kapı: tek-topoloji.test.js.
// Kayıtlı projenin sekmelerinden ETKİN olanı (Canlı Not 87: tek topoloji). Döner
// { tab, atlanan }: yükleyen (Proje aç · yedekten dönüş) yalnız `tab`ı kurar,
// `atlanan` > 0 ise durumu söyler.
function veTekTopoloji(data) {
  var tabs = (data && data.tabs) || [];
  var i = Math.min(Math.max(0, (data && data.activeTabIdx) || 0), tabs.length - 1);
  return { tab: tabs[i], atlanan: Math.max(0, tabs.length - 1) };
}
function veTekTopolojiBildir(sec) {
  if(sec && sec.atlanan > 0 && typeof showToast === 'function')
    showToast('Projedeki ' + (sec.atlanan + 1) + ' topolojiden yalnız "' + ((sec.tab && sec.tab.name) || 'Topoloji 1') + '" açıldı.', 'warning');
}

function veAddTab(name, silent) {
  // Mevcut sekmeyi kaydet
  if(veTabs.length > 0) {
    veSaveActiveTabState();
    veClearCanvasDOM();
  }
  
  veTabCounter++;
  var tab = {
    id: 'tab-' + veTabCounter,
    name: name || ('Topoloji ' + veTabCounter),
    state: null,
    nodeCount: 0,
    connCount: 0,
    compCounterBase: compCounter
  };
  
  veTabs.push(tab);
  veActiveTabIdx = veTabs.length - 1;
  
  // Temiz canvas
  nodes = [];
  connections = [];
  selectedNodes = [];
  canvasOffset = _veHomeOffset();
  canvasZoom = 1;
  undoStack = [];
  redoStack = [];
  window.veSimResults = null;
  veResultSlots = [{},{},{},{}];
  
  updateCanvasTransform();
  updateAllConnections();
  updateNodeCount();
  if(typeof veMufettisKapat === 'function') veMufettisKapat(); else showEmptyProperties();
  veRefreshResultsUI();
  saveState(); // İlk undo noktası
}

// İlk sekmeyi oluştur (sayfa yüklenince)
(function() {
  var _origDOMReady = window._veTabInitDone;
  if(_origDOMReady) return;
  window._veTabInitDone = true;
  
  function initTabs() {
    veAddTab('Topoloji 1', true);
  }
  
  // DOM hazir degilse (sayfa parse asamasi) klasik DOMContentLoaded yeterli.
  // Hazirsa ve MFSim Loader aktifse: interceptor kuyruga alir, tum moduller
  // yuklendikten sonra calisir. Loader yoksa (eski cache senaryosu) setTimeout
  // fallback'i kullan.
  if(document.readyState === 'loading' || window.MFSimLoader) {
    document.addEventListener('DOMContentLoaded', initTabs);
  } else {
    setTimeout(initTabs, 100);
  }
})();
