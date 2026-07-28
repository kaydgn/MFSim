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
  // YENİDEN-GİRİŞ KORUMASI: Bir alt-topoloji (Araç Performans / Takoz) giriş-çıkış
  // işlemi HÂLÂ sürerken (_veAracBusy/_veMntBusy true — atomik canvas takası ortası)
  // buraya sıçranırsa (örn. veAracOpenEditor → veLoadTabState → veUpdateResultsTree
  // yeniden-girişli olarak veSaveActiveTabStateKeepView'i çağırır), canlı canvas henüz
  // köke ÇÖKMEMİŞ düz alt-topolojidir; şimdi serialize etmek tab.state'e composite
  // yerine 16 düğümlü DÜZ alt-topolojiyi yazar ve "Araç Performans" sarmalayıcısını
  // kaybederiz (kaydedilen dosya bozulur). Dıştaki işlem bitince doğru kök durumu
  // zaten yazılacağı için burada sessizce çık.
  if((typeof _veAracBusy !== 'undefined' && _veAracBusy) ||
     (typeof _veMntBusy !== 'undefined' && _veMntBusy)) return;

  // Bir "Araç Performans" alt-topolojisi içindeysek, kaydetmeden/sekme değiştirmeden
  // önce köke (ana topoloji) çık — böylece canlı canvas alt-topoloji değil kök olur
  // ve serileştirme doğru durumu yazar (alt-topoloji ilgili düğümün data'sına saklı).
  if(typeof veAracCollapseToRoot === 'function') veAracCollapseToRoot();
  if(typeof veMntCollapseToRoot === 'function') veMntCollapseToRoot();
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

// Alt-topoloji (Araç Performans / Takoz iç topolojisi) gezinme yolunu yakalar ve
// kullanıcıyı aynı yola SESSİZCE (toast/animasyon yok) geri götüren bir "restore"
// fonksiyonu döndürür. Köke çökme (veSaveActiveTabState) sonrası yeniden giriş için.
function _veCaptureSubtopoNav() {
  var aracPath = [];
  var mntPath = [];
  try { if(typeof veAracStack !== 'undefined' && veAracStack && veAracStack.length) aracPath = veAracStack.map(function(c){ return c.nodeId; }); } catch(e) {}
  try { if(typeof veMntStack !== 'undefined' && veMntStack && veMntStack.length) mntPath = veMntStack.map(function(c){ return c.nodeId; }); } catch(e) {}
  return function _veRestoreSubtopoNav() {
    try {
      // Köke çökmüş canvas'ta yolu baştan (kök→derin) yeniden gir; _silent=true.
      // Düğüm silinmişse open editor no-op'tur (güvenli).
      if(aracPath.length && typeof veAracOpenEditor === 'function') aracPath.forEach(function(id){ veAracOpenEditor(id, true); });
      if(mntPath.length && typeof veMntOpenEditor === 'function') mntPath.forEach(function(id){ veMntOpenEditor(id, true); });
    } catch(e) { if(typeof console !== 'undefined') console.warn('[MFSim] alt-topoloji geri yükleme:', e && e.message); }
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
  veSaveActiveTabState();
  restore();
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

function veLoadTabState(tab) {
  var s = tab.state;
  if(!s) {
    nodes = [];
    connections = [];
    compCounter = tab.compCounterBase || compCounter;
    canvasOffset = { x: 3000, y: 3000 };
    canvasZoom = 1;
    undoStack = [];
    redoStack = [];
    window.veSimResults = null;
    veResultSlots = [{},{},{},{}];
    if(typeof restoreAnnotations === 'function') restoreAnnotations([]);
    updateCanvasTransform();
    updateAllConnections();
    updateNodeCount();
    showEmptyProperties();
    veRefreshResultsUI();
    return;
  }
  
  compCounter = s.compCounter || 0;
  canvasOffset = s.canvasOffset || { x: 3000, y: 3000 };
  canvasZoom = s.canvasZoom || 1;
  undoStack = s.undoStack || [];
  redoStack = s.redoStack || [];
  window.veSimResults = s.simResults || null;
  veResultSlots = s.resultSlots || [{},{},{},{}];
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
  showEmptyProperties();
  veRefreshResultsUI();
}

// Sonuçlar panelini sekme geçişinde yenile
function veRefreshResultsUI() {
  // Results tree güncelle
  if(typeof veUpdateResultsTree === 'function') veUpdateResultsTree();
  // Grafik slotlarını yeniden render et
  for(var i = 0; i < 4; i++) {
    if(veResultSlots[i].sensors && veResultSlots[i].sensors.length > 0) {
      if(typeof veRenderSlot === 'function') veRenderSlot(i);
    } else {
      if(typeof veRenderSlotPicker === 'function') veRenderSlotPicker(i);
    }
  }
  // Grafikleri çiz
  if(window.veSimResults && typeof veRefreshAllCharts === 'function') {
    setTimeout(veRefreshAllCharts, 50);
  }
}

function veSwitchTab(idx) {
  if(idx < 0 || idx >= veTabs.length) return;
  
  // Split modunda
  if(veSplitMode) {
    // Zaten odaklı pane'de bu sekme varsa geç
    if(idx === veSplitPanes[veFocusedPane]) return;
    
    // Diğer pane'de bu sekme varsa → oraya odaklan
    var otherPane = veFocusedPane === 0 ? 1 : 0;
    if(idx === veSplitPanes[otherPane]) {
      veFocusPane(otherPane);
      return;
    }
    
    // Odaklı pane'i bu sekmeye geçir
    veSaveActiveTabState();
    veClearCanvasDOM();
    veSplitPanes[veFocusedPane] = idx;
    veActiveTabIdx = idx;
    veLoadTabState(veTabs[idx]);
    veUpdatePaneLabels();
    veRenderTabs();
    return;
  }
  
  // Normal mod
  if(idx === veActiveTabIdx) return;
  veSaveActiveTabState();
  veClearCanvasDOM();
  veActiveTabIdx = idx;
  veLoadTabState(veTabs[idx]);
  veRenderTabs();
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
  canvasOffset = { x: 3000, y: 3000 };
  canvasZoom = 1;
  undoStack = [];
  redoStack = [];
  window.veSimResults = null;
  veResultSlots = [{},{},{},{}];
  
  updateCanvasTransform();
  updateAllConnections();
  updateNodeCount();
  showEmptyProperties();
  veRefreshResultsUI();
  saveState(); // İlk undo noktası
  
  veRenderTabs();
  if(!silent) showToast('Yeni sekme: ' + tab.name);
}

function veCloseTab(idx) {
  if(veTabs.length <= 1) {
    showToast('Son sekme kapatılamaz', 'warning');
    return;
  }
  
  var tab = veTabs[idx];
  var nodeCount = (idx === veActiveTabIdx) ? nodes.length : (tab.nodeCount || 0);
  
  var doClose = function() {
    // Split mode: kapatılan sekme bir pane'deyse split'i kapat
    if(veSplitMode) {
      if(idx === veSplitPanes[0] || idx === veSplitPanes[1]) {
        veCloseSplit();
      }
    }
    
    var wasActive = (idx === veActiveTabIdx);
    veTabs.splice(idx, 1);
    
    // Split pane indekslerini güncelle
    if(veSplitMode) {
      if(veSplitPanes[0] >= idx) veSplitPanes[0] = Math.max(0, veSplitPanes[0] - 1);
      if(veSplitPanes[1] >= idx) veSplitPanes[1] = Math.max(0, veSplitPanes[1] - 1);
    }
    
    if(wasActive) {
      veClearCanvasDOM();
      veActiveTabIdx = Math.min(idx, veTabs.length - 1);
      veLoadTabState(veTabs[veActiveTabIdx]);
    } else if(idx < veActiveTabIdx) {
      veActiveTabIdx--;
    }
    
    veRenderTabs();
    showToast(tab.name + ' kapatıldı');
  };
  
  if(nodeCount > 0) {
    showConfirmToast('"' + tab.name + '" sekmesinde ' + nodeCount + ' bileşen var. Kapatılsın mı?', doClose);
  } else {
    doClose();
  }
}

function veRenameTab(idx) {
  var tab = veTabs[idx];
  if(!tab) return;
  
  var newName = prompt('Sekme adı:', tab.name);
  if(newName && newName.trim()) {
    tab.name = newName.trim();
    veRenderTabs();
  }
}

function veDuplicateTab(idx) {
  // Kaynağın güncel halini kaydet (alt-topolojideysek kullanıcıyı yerinden etme)
  if(idx === veActiveTabIdx) veSaveActiveTabStateKeepView();
  
  var srcTab = veTabs[idx];
  if(!srcTab) return;
  
  veTabCounter++;
  var newTab = {
    id: 'tab-' + veTabCounter,
    name: srcTab.name + ' (kopya)',
    state: JSON.parse(JSON.stringify(srcTab.state)),
    nodeCount: srcTab.nodeCount,
    connCount: srcTab.connCount,
    compCounterBase: compCounter
  };
  
  // Yeni node ID'leri ata (çakışma önleme)
  if(newTab.state && newTab.state.nodes) {
    var idMap = {};
    newTab.state.nodes.forEach(function(n) {
      compCounter++;
      var newId = 'comp-' + compCounter;
      idMap[n.id] = newId;
      n.id = newId;
    });
    // Connection referanslarını güncelle
    if(newTab.state.connections) {
      newTab.state.connections.forEach(function(c) {
        if(idMap[c.from]) c.from = idMap[c.from];
        if(idMap[c.to]) c.to = idMap[c.to];
        compCounter++;
        c.id = 'conn-' + compCounter;
      });
    }
    newTab.state.compCounter = compCounter;
    // Undo/redo'yu temizle (kopyada mantıklı değil)
    newTab.state.undoStack = [];
    newTab.state.redoStack = [];
  }
  
  veTabs.push(newTab);
  veRenderTabs();
  showToast(newTab.name + ' oluşturuldu');
}

function veRenderTabs() {
  var bar = document.getElementById('ve-tab-bar');
  if(!bar) return;
  
  var html = '';
  veTabs.forEach(function(tab, idx) {
    var isActive = (idx === veActiveTabIdx);
    var count = isActive ? nodes.length : (tab.nodeCount || 0);
    html += '<div class="ve-tab' + (isActive ? ' active' : '') + '" ' +
      'onclick="veSwitchTab(' + idx + ')" ' +
      'ondblclick="veRenameTab(' + idx + ')" ' +
      'oncontextmenu="veShowTabMenu(event,' + idx + ')" ' +
      'title="Çift tık: yeniden adlandır · Sağ tık: menü">' +
      '<span>' + tab.name + '</span>' +
      (count > 0 ? '<span class="ve-tab-count">(' + count + ')</span>' : '') +
      '<span class="ve-tab-close" onclick="event.stopPropagation();veCloseTab(' + idx + ')" title="Kapat"><span class="mf-ico mf-ico-x"></span></span>' +
      '</div>';
  });
  html += '<div class="ve-tab-add" onclick="veAddTab()" title="Yeni topoloji sekmesi">+</div>';
  
  // Sağ taraf — araç butonları
  html += '<div style="flex:1;"></div>';
  html += '<button class="ve-toolbar-btn ve-cmdk-trigger" onclick="veCmdkOpen()" title="Komut paleti — her eylemi arayıp çalıştır (Ctrl+K)"><span class="mf-ico mf-ico-search"></span><span class="ve-cmdk-trigger-kbd">⌘K</span></button>';
  html += '<div class="ve-toolbar-sep"></div>';
  html += '<button class="ve-toolbar-btn" onclick="veUndo()" title="Geri Al (Ctrl+Z)"><span class="mf-ico mf-ico-undo"></span></button>';
  html += '<button class="ve-toolbar-btn" onclick="veRedo()" title="İleri Al (Ctrl+Y)"><span class="mf-ico mf-ico-redo"></span></button>';
  html += '<div class="ve-toolbar-sep"></div>';
  html += '<button class="ve-toolbar-btn" onclick="veZoomIn()" title="Yakınlaştır"><span class="mf-ico mf-ico-zoom-in"></span></button>';
  html += '<button class="ve-toolbar-btn" onclick="veZoomOut()" title="Uzaklaştır"><span class="mf-ico mf-ico-zoom-out"></span></button>';
  html += '<button class="ve-toolbar-btn" onclick="veResetView()" title="Görünümü Sıfırla"><span class="mf-ico mf-ico-crosshair"></span></button>';
  html += '<button class="ve-toolbar-btn" onclick="veFitViewToContent({maxZoom:2})" title="İçeriğe Sığdır"><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M8 3H5a2 2 0 0 0-2 2v3M21 8V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3M16 21h3a2 2 0 0 0 2-2v-3"/></svg></button>';
  html += '<button class="ve-toolbar-btn" onclick="veTidyLayout()" title="Otomatik Düzenle — topolojiyi katmanlı, düzenli hâle getir"><svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="6" height="6" rx="1"/><rect x="15" y="4" width="6" height="6" rx="1"/><rect x="9" y="14" width="6" height="6" rx="1"/><path d="M6 10v2a2 2 0 0 0 2 2h4M18 10v2a2 2 0 0 1-2 2h-4"/></svg></button>';
  html += '<div class="ve-toolbar-sep"></div>';
  html += '<button class="ve-toolbar-btn ve-toolbar-toggle' + (typeof SNAP_ENABLED !== 'undefined' && SNAP_ENABLED ? ' active' : '') + '" id="ve-snap-btn" onclick="veToggleSnap()" title="Hizalama"><span class="mf-ico mf-ico-ruler"></span></button>';
  html += '<button class="ve-toolbar-btn ve-toolbar-toggle' + (typeof veGridVisible !== 'undefined' && veGridVisible ? ' active' : '') + '" id="ve-grid-btn" onclick="veToggleGrid()" title="Grid Göster/Gizle"><span class="mf-ico mf-ico-grid"></span></button>';
  html += '<button class="ve-toolbar-btn" id="ve-grid-density-btn" onclick="veCycleGridDensity()" title="Grid: ' + (typeof veGridLabels !== 'undefined' ? veGridLabels[veGridDensity] : 'Normal') + '"><span class="mf-ico mf-ico-grid-cells"></span></button>';
  html += '<button class="ve-toolbar-btn ve-toolbar-toggle' + (typeof veBoundaryVisible !== 'undefined' && veBoundaryVisible ? ' active' : '') + '" id="ve-boundary-btn" onclick="veToggleBoundary()" title="Sınır Göster/Gizle"><span class="mf-ico mf-ico-frame"></span></button>';
  html += '<button class="ve-toolbar-btn" id="ve-boundary-opacity-btn" onclick="veCycleBoundaryOpacity()" title="Sınır Opaklığı: ' + (typeof veBoundaryOpacity !== 'undefined' ? Math.round(veBoundaryOpacity * 100) : '55') + '%"><span class="mf-ico mf-ico-contrast"></span></button>';
  html += '<div class="ve-toolbar-sep"></div>';
  html += '<button class="ve-toolbar-btn ve-toolbar-toggle' + (typeof veFlowAnim !== 'undefined' && veFlowAnim ? ' active' : '') + '" id="ve-flow-btn" onclick="veToggleFlow()" title="Güç akışı animasyonu (bağlantılarda akan çizgiler)"><span class="mf-ico mf-ico-zap"></span></button>';

  bar.innerHTML = html;
}

function veShowTabMenu(e, idx) {
  e.preventDefault();
  e.stopPropagation();
  
  // Mevcut tab menüyü kapat
  var existing = document.getElementById('ve-tab-context-menu');
  if(existing) existing.remove();
  
  var menu = document.createElement('div');
  menu.id = 've-tab-context-menu';
  menu.style.cssText = 'position:fixed;left:' + e.clientX + 'px;top:' + e.clientY + 'px;z-index:200000;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:var(--radius-md);box-shadow:var(--shadow-lg);padding:5px;min-width:160px;';

  var items = [
    { icon: 'edit',      label: 'Yeniden Adlandır', fn: function() { veRenameTab(idx); } },
    { icon: 'clipboard', label: 'Çoğalt',           fn: function() { veDuplicateTab(idx); } },
    { label: 'sep' },
    { icon: 'x',         label: 'Kapat', fn: function() { veCloseTab(idx); }, danger: true }
  ];

  items.forEach(function(item) {
    if(item.label === 'sep') {
      var d = document.createElement('div');
      d.style.cssText = 'height:1px;background:var(--border-color);margin:4px 6px;';
      menu.appendChild(d);
      return;
    }
    var el = document.createElement('div');
    el.style.cssText = 'display:flex;align-items:center;gap:8px;padding:6px 10px;border-radius:var(--radius-sm);font-size:0.7rem;cursor:pointer;color:' + (item.danger ? 'var(--accent-danger)' : 'var(--text-primary)') + ';transition:background 0.12s;';
    el.innerHTML = '<span class="mf-ico mf-ico-' + item.icon + '"></span><span>' + item.label + '</span>';
    el.onmouseover = function() { this.style.background = item.danger ? 'color-mix(in srgb, var(--accent-danger) 15%, transparent)' : 'var(--bg-tertiary)'; };
    el.onmouseout = function() { this.style.background = 'transparent'; };
    el.onclick = function() { menu.remove(); item.fn(); };
    menu.appendChild(el);
  });
  
  document.body.appendChild(menu);
  
  // Dışarı tıklayınca kapat
  setTimeout(function() {
    document.addEventListener('click', function handler() {
      menu.remove();
      document.removeEventListener('click', handler);
    });
  }, 10);
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

// ============================================================================
// SPLIT VIEW — YAN YANA TOPOLOJİ GÖRÜNTÜLEME
// ============================================================================
var veSplitMode = false;
var veSplitPanes = [0, -1]; // [left tabIdx, right tabIdx]
var veFocusedPane = 0;
var _veSplitDragTabIdx = -1;

function veActivateSplit(rightTabIdx) {
  if(veSplitMode) {
    // Zaten split — sağ paneyi değiştir
    veSplitPanes[1] = rightTabIdx;
    veRenderSnapshot(1);
    veRenderTabs();
    return;
  }
  
  // Aktif sekmeyi kaydet (odaklı pane alt-topolojideyse görünümü koru)
  veSaveActiveTabStateKeepView();

  veSplitMode = true;
  veSplitPanes = [veActiveTabIdx, rightTabIdx];
  veFocusedPane = 0;
  
  veCreateSplitDOM();
  veRenderSnapshot(1);
  veUpdateSplitFocus();
  veRenderTabs();
  showToast('Bölünmüş görünüm açıldı');
}

function veCloseSplit() {
  if(!veSplitMode) return;
  
  // Odaklanan pane'in sekmesini aktif yap
  if(veFocusedPane === 1) {
    veSaveActiveTabState();
    veClearCanvasDOM();
    veActiveTabIdx = veSplitPanes[1];
    veLoadTabState(veTabs[veActiveTabIdx]);
  }
  
  veSplitMode = false;
  veSplitPanes = [veActiveTabIdx, -1];
  veFocusedPane = 0;
  
  veRemoveSplitDOM();
  veRenderTabs();
  showToast('Tek görünüme dönüldü');
}

function veCreateSplitDOM() {
  var container = document.getElementById('ve-split-container');
  var pane0 = document.getElementById('ve-pane-0');
  if(!container || !pane0) return;
  
  pane0.classList.add('split-active');
  
  // Pane0'a header ekle
  var h0 = document.createElement('div');
  h0.className = 've-pane-header';
  h0.id = 've-pane-header-0';
  h0.innerHTML = '<span class="ve-pane-focus-dot"></span><span class="ve-pane-label" id="ve-pane-label-0"></span>';
  h0.onclick = function() { veFocusPane(0); };
  pane0.insertBefore(h0, pane0.firstChild);
  
  // Resizer
  var resizer = document.createElement('div');
  resizer.className = 've-split-resizer';
  resizer.id = 've-split-resizer';
  container.appendChild(resizer);
  
  // Pane1
  var pane1 = document.createElement('div');
  pane1.className = 've-split-pane split-active';
  pane1.id = 've-pane-1';
  var h1 = document.createElement('div');
  h1.className = 've-pane-header';
  h1.id = 've-pane-header-1';
  h1.innerHTML = '<span class="ve-pane-focus-dot"></span><span class="ve-pane-label" id="ve-pane-label-1"></span>' +
    '<span class="ve-pane-close" onclick="event.stopPropagation();veCloseSplit();" title="Bölmeyi kapat">✕</span>';
  h1.onclick = function() { veFocusPane(1); };
  pane1.appendChild(h1);
  
  // Snapshot container
  var snapWrap = document.createElement('div');
  snapWrap.className = 've-snapshot-pane';
  snapWrap.id = 've-snapshot-1';
  pane1.appendChild(snapWrap);
  container.appendChild(pane1);
  
  // Resizer drag
  veSplitResizerInit(resizer, pane0, pane1);
  
  // Pane başlıklarını güncelle
  veUpdatePaneLabels();
}

function veRemoveSplitDOM() {
  var container = document.getElementById('ve-split-container');
  var pane0 = document.getElementById('ve-pane-0');
  
  // Header'ı kaldır
  var h0 = document.getElementById('ve-pane-header-0');
  if(h0) h0.remove();
  
  // Eğer canvas pane1'de ise pane0'a taşı
  var canvasW = document.getElementById('ve-canvas-wrapper');
  if(canvasW && canvasW.parentElement.id !== 've-pane-0') {
    pane0.appendChild(canvasW);
  }
  
  // Resizer ve pane1 kaldır
  var resizer = document.getElementById('ve-split-resizer');
  if(resizer) resizer.remove();
  var pane1 = document.getElementById('ve-pane-1');
  if(pane1) pane1.remove();
  
  // Snapshot pane0 içindeyse kaldır
  var snap0 = document.getElementById('ve-snapshot-0');
  if(snap0) snap0.remove();
  
  // Pane0 flex reset
  if(pane0) { pane0.style.flex = ''; pane0.classList.add('focused'); pane0.classList.remove('split-active'); }
}

function veFocusPane(paneIdx) {
  if(paneIdx === veFocusedPane || !veSplitMode) return;
  
  var pane0 = document.getElementById('ve-pane-0');
  var pane1 = document.getElementById('ve-pane-1');
  var canvasW = document.getElementById('ve-canvas-wrapper');
  if(!pane0 || !pane1 || !canvasW) return;
  
  // 1) Mevcut odaklı pane'in durumunu kaydet
  veSaveActiveTabState();
  veClearCanvasDOM();
  
  var oldPane = veFocusedPane;
  var oldPaneEl = (oldPane === 0) ? pane0 : pane1;
  var newPaneEl = (paneIdx === 0) ? pane0 : pane1;
  
  // 2) Eski odaklı pane → snapshot yap (canvas'ı taşımadan önce)
  // Eski snapshot'ı temizle
  var oldSnap = document.getElementById('ve-snapshot-' + oldPane);
  if(oldSnap) oldSnap.remove();
  
  // 3) Canvas'ı yeni pane'e taşı
  // Yeni pane'deki mevcut snapshot'ı kaldır
  var newSnap = document.getElementById('ve-snapshot-' + paneIdx);
  if(newSnap) newSnap.remove();
  
  newPaneEl.appendChild(canvasW);
  
  // 4) Eski pane'e snapshot oluştur
  var snapDiv = document.createElement('div');
  snapDiv.className = 've-snapshot-pane';
  snapDiv.id = 've-snapshot-' + oldPane;
  oldPaneEl.appendChild(snapDiv);
  
  // 5) Yeni tabı yükle
  veFocusedPane = paneIdx;
  veActiveTabIdx = veSplitPanes[paneIdx];
  veLoadTabState(veTabs[veActiveTabIdx]);
  
  // 6) Eski pane'in snapshot'ını render et
  veRenderSnapshot(oldPane);
  
  veUpdateSplitFocus();
  veRenderTabs();
}

function veUpdateSplitFocus() {
  var p0 = document.getElementById('ve-pane-0');
  var p1 = document.getElementById('ve-pane-1');
  if(p0) p0.classList.toggle('focused', veFocusedPane === 0);
  if(p1) p1.classList.toggle('focused', veFocusedPane === 1);
  veUpdatePaneLabels();
}

function veUpdatePaneLabels() {
  for(var i = 0; i < 2; i++) {
    var label = document.getElementById('ve-pane-label-' + i);
    if(!label) continue;
    var tabIdx = veSplitPanes[i];
    var tab = veTabs[tabIdx];
    var name = tab ? tab.name : '?';
    var isFocused = (i === veFocusedPane);
    label.textContent = name + (isFocused ? ' ✎' : ' ◎');
    label.title = isFocused ? 'Düzenlenebilir (aktif)' : 'Salt görüntüleme — tıklayarak aktif edin';
  }
}

// ── Snapshot Renderer ──
function veRenderSnapshot(paneIdx) {
  var snapEl = document.getElementById('ve-snapshot-' + paneIdx);
  if(!snapEl) return;
  snapEl.innerHTML = '';
  
  var tabIdx = veSplitPanes[paneIdx];
  var tab = veTabs[tabIdx];
  if(!tab) return;
  
  var isActive = (paneIdx === veFocusedPane);
  var state;
  if(isActive) {
    veSaveActiveTabStateKeepView();
    state = tab.state;
  } else {
    state = tab.state;
  }
  if(!state || !state.nodes || state.nodes.length === 0) {
    snapEl.innerHTML = '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:var(--text-muted);font-size:0.75rem;">Boş topoloji</div>';
    return;
  }
  
  var sNodes = state.nodes;
  var sConns = state.connections || [];
  var sOffset = state.canvasOffset || {x:3000, y:3000};
  var sZoom = state.canvasZoom || 1;
  
  var doRender = function() {
    var ox = sOffset.x;
    var oy = sOffset.y;
    var zm = sZoom;
    
    // Canvas wrapper — gerçek ve-canvas ile aynı konumlandırma
    var canvasWrap = document.createElement('div');
    canvasWrap.style.cssText = 'position:absolute;width:6000px;height:6000px;top:-3000px;left:-3000px;transform-origin:center center;transform:translate(' + ox + 'px,' + oy + 'px) scale(' + zm + ');';
    canvasWrap.setAttribute('data-offset-x', ox);
    canvasWrap.setAttribute('data-offset-y', oy);
    canvasWrap.setAttribute('data-zoom', zm);
    
    // SVG bağlantı katmanı
    var svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.style.cssText = 'position:absolute;top:0;left:0;width:6000px;height:6000px;pointer-events:none;';
    svg.setAttribute('class', 've-connections-layer');
    canvasWrap.appendChild(svg);
    
    // Node'ları gerçek HTML ile render et (restoreState ile aynı yapı)
    sNodes.forEach(function(n) {
      var def = componentDefs[n.type];
      if(!def) return;
      var w = n.width || 65, h = n.height || 60;
      
      var nodeEl = document.createElement('div');
      nodeEl.className = 've-node';
      nodeEl.style.left = n.x + 'px';
      nodeEl.style.top = n.y + 'px';
      nodeEl.style.pointerEvents = 'none';
      nodeEl.setAttribute('data-type', n.type);
      
      var html = '<div class="ve-node-box" style="width:' + w + 'px; height:' + h + 'px;' + (n.mirrored ? 'transform:scaleX(-1);' : '') + '">';
      
      // Giriş portları
      if(def.inputs > 0) {
        for(var pi = 0; pi < def.inputs; pi++) {
          var inputPortId = def.inputs === 1 ? 'input' : 'input-' + pi;
          var inputTopPct = ((pi + 1) / (def.inputs + 1) * 100);
          html += '<div class="ve-node-port input" data-port="' + inputPortId + '" style="top:' + inputTopPct + '%; margin-top:-5px;"></div>';
        }
      }
      
      html += def.svg;
      
      // Çıkış portları
      if(def.outputs > 0) {
        for(var po = 0; po < def.outputs; po++) {
          var outputPortId = def.outputs === 1 ? 'output' : 'output-' + po;
          var outputTopPct = ((po + 1) / (def.outputs + 1) * 100);
          html += '<div class="ve-node-port output" data-port="' + outputPortId + '" style="top:' + outputTopPct + '%; margin-top:-5px;"></div>';
        }
      }
      
      html += '</div>';
      html += '<div class="ve-node-label">' + escapeHTML(n.customName || def.name) + '</div>';
      
      if(n.type === 'wheel' && n.isMasterWheel) {
        html += '<div class="ve-wheel-master-badge" title="Master Tekerlek">★</div>';
      }
      if(n.type === 'differential' && n.isMasterDiff) {
        html += '<div class="ve-wheel-master-badge" title="Master Diferansiyel">★</div>';
      }
      
      nodeEl.innerHTML = html;
      canvasWrap.appendChild(nodeEl);
    });
    
    // Bağlantıları render et (ana canvas ile aynı hesaplama)
    sConns.forEach(function(c) {
      var fromN = sNodes.find(function(n) { return n.id === c.from; });
      var toN = sNodes.find(function(n) { return n.id === c.to; });
      if(!fromN || !toN) return;
      
      var fp = veSnapPortPos(fromN, c.fromPort || 'output');
      var tp = veSnapPortPos(toN, c.toPort || 'input');
      
      var lineType = c.lineType || 'curve';
      var d;
      if(lineType === 'straight') {
        d = 'M ' + fp.x + ' ' + fp.y + ' L ' + tp.x + ' ' + tp.y;
      } else if(lineType === 'stepped') {
        var mx = (fp.x + tp.x) / 2;
        d = 'M ' + fp.x + ' ' + fp.y + ' L ' + mx + ' ' + fp.y + ' L ' + mx + ' ' + tp.y + ' L ' + tp.x + ' ' + tp.y;
      } else {
        var off = 40;
        var cp1x = fp.side === 'left' ? fp.x - off : fp.x + off;
        var cp2x = tp.side === 'left' ? tp.x - off : tp.x + off;
        d = 'M ' + fp.x + ' ' + fp.y + ' C ' + cp1x + ' ' + fp.y + ', ' + cp2x + ' ' + tp.y + ', ' + tp.x + ' ' + tp.y;
      }
      
      var path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', d);
      path.setAttribute('stroke', 'rgba(45,138,90,0.5)');
      path.setAttribute('stroke-width', '2');
      path.setAttribute('fill', 'none');
      svg.appendChild(path);
    });
    
    snapEl.appendChild(canvasWrap);
    veSnapInteraction(snapEl, canvasWrap);
  };
  
  doRender();
}

function veSnapPortPos(node, portType) {
  var w = node.width || 65, h = node.height || 60;
  var isInput = portType.indexOf('input') === 0;
  var portIndex = 0;
  if(portType.indexOf('-') > -1) portIndex = parseInt(portType.split('-')[1]) || 0;
  var totalPorts = (typeof nodePortCount === 'function') ? nodePortCount(node, isInput ? 'inputs' : 'outputs') : 1;
  if(!totalPorts) totalPorts = 1;
  // Kayıtlı taşıma (portPositions) → portLayout/klasik varsayılan (getPortPosition ile aynı)
  var pos = (node.data && node.data.portPositions && node.data.portPositions[portType]) || null;
  var side = pos ? pos.side
    : ((typeof defaultPortSide === 'function') ? defaultPortSide(node, portType)
      : (node.mirrored ? (isInput ? 'right' : 'left') : (isInput ? 'left' : 'right')));
  var frac = ((typeof portPerpPercent === 'function') ? portPerpPercent(node, portType)
    : ((portIndex + 1) / (totalPorts + 1) * 100)) / 100;
  var x, y;
  switch(side) {
    case 'top':    x = node.x + w * frac; y = node.y - 7; break;
    case 'bottom': x = node.x + w * frac; y = node.y + h + 7; break;
    case 'right':  x = node.x + w + 7;    y = node.y + h * frac; break;
    default:       x = node.x - 7;        y = node.y + h * frac; break;
  }
  return {x: x, y: y, side: side};
}

function veSnapInteraction(wrapperEl, canvasEl) {
  var ox = parseFloat(canvasEl.getAttribute('data-offset-x'));
  var oy = parseFloat(canvasEl.getAttribute('data-offset-y'));
  var zm = parseFloat(canvasEl.getAttribute('data-zoom'));
  
  function applyTransform() {
    canvasEl.style.transform = 'translate(' + ox + 'px,' + oy + 'px) scale(' + zm + ')';
  }
  
  // Pan
  var dragging = false, startX, startY, startOx, startOy;
  wrapperEl.addEventListener('mousedown', function(e) {
    if(e.button !== 0) return;
    // Tıklama ile pane odakla (kısa tıklama)
    dragging = true;
    startX = e.clientX; startY = e.clientY;
    startOx = ox; startOy = oy;
    e.preventDefault();
  });
  wrapperEl.addEventListener('mousemove', function(e) {
    if(!dragging) return;
    ox = startOx + (e.clientX - startX);
    oy = startOy + (e.clientY - startY);
    applyTransform();
  });
  wrapperEl.addEventListener('mouseup', function(e) {
    if(!dragging) return;
    var dx = Math.abs(e.clientX - startX);
    var dy = Math.abs(e.clientY - startY);
    dragging = false;
    // Kısa tıklama (hareket < 5px) → pane odakla
    if(dx < 5 && dy < 5) {
      var paneEl = wrapperEl.closest('.ve-split-pane');
      if(paneEl) {
        var idx = paneEl.id === 've-pane-0' ? 0 : 1;
        veFocusPane(idx);
      }
    }
  });
  
  // Zoom
  wrapperEl.addEventListener('wheel', function(e) {
    e.preventDefault();
    var rect = wrapperEl.getBoundingClientRect();
    var mx = e.clientX - rect.left;
    var my = e.clientY - rect.top;
    
    var oldZm = zm;
    zm = e.deltaY < 0 ? Math.min(3, zm * 1.15) : Math.max(0.1, zm / 1.15);
    var ratio = zm / oldZm;
    ox = mx - ratio * (mx - ox);
    oy = my - ratio * (my - oy);
    applyTransform();
  }, {passive: false});
}

// ── Split Resizer ──
function veSplitResizerInit(resizer, pane0, pane1) {
  var dragging = false, startX, startW0, startW1;
  
  resizer.addEventListener('mousedown', function(e) {
    dragging = true;
    startX = e.clientX;
    startW0 = pane0.offsetWidth;
    startW1 = pane1.offsetWidth;
    resizer.classList.add('active');
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    e.preventDefault();
  });
  
  document.addEventListener('mousemove', function(e) {
    if(!dragging) return;
    var dx = e.clientX - startX;
    var w0 = Math.max(150, startW0 + dx);
    var w1 = Math.max(150, startW1 - dx);
    pane0.style.flex = '0 0 ' + w0 + 'px';
    pane1.style.flex = '0 0 ' + w1 + 'px';
  });
  
  document.addEventListener('mouseup', function() {
    if(!dragging) return;
    dragging = false;
    resizer.classList.remove('active');
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  });
}

// ── Tab Drag → Split ──
(function() {
  var _tabDragTabIdx = -1;
  var _tabDragActive = false;
  var _tabDragStartX = 0, _tabDragStartY = 0;
  var _dropZones = null;
  
  // veRenderTabs'ın oluşturduğu tab'lara drag ekle
  // Tab mousedown event'lerini override etmek için MutationObserver kullan
  var _origRenderTabs = veRenderTabs;
  veRenderTabs = function() {
    _origRenderTabs();
    // Her tab'a mousedown ekle
    var tabEls = document.querySelectorAll('#ve-tab-bar .ve-tab');
    tabEls.forEach(function(el, idx) {
      el.addEventListener('mousedown', function(e) {
        if(e.button !== 0) return;
        _tabDragTabIdx = idx;
        _tabDragStartX = e.clientX;
        _tabDragStartY = e.clientY;
        _tabDragActive = false;
      });
    });
  };
  
  document.addEventListener('mousemove', function(e) {
    if(_tabDragTabIdx < 0) return;
    var dx = Math.abs(e.clientX - _tabDragStartX);
    var dy = Math.abs(e.clientY - _tabDragStartY);
    
    if(!_tabDragActive && (dx > 8 || dy > 8)) {
      _tabDragActive = true;
      veShowSplitDropZones();
    }
    
    if(_tabDragActive && _dropZones) {
      _dropZones.forEach(function(dz) {
        var r = dz.getBoundingClientRect();
        var inside = (e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom);
        dz.classList.toggle('hover', inside);
      });
    }
  });
  
  document.addEventListener('mouseup', function(e) {
    if(_tabDragTabIdx < 0) return;
    var dragIdx = _tabDragTabIdx;
    _tabDragTabIdx = -1;
    
    if(!_tabDragActive) return;
    _tabDragActive = false;
    
    // Drop zone kontrolü
    var dropped = false;
    if(_dropZones) {
      _dropZones.forEach(function(dz) {
        if(!dropped && dz.classList.contains('hover')) {
          dropped = true;
          var side = dz.classList.contains('left') ? 0 : 1;
          veHandleSplitDrop(dragIdx, side);
        }
      });
    }
    
    veHideSplitDropZones();
  });
  
  function veShowSplitDropZones() {
    var container = document.getElementById('ve-split-container');
    if(!container) return;
    
    // Mevcut drop zone'ları temizle
    veHideSplitDropZones();
    
    _dropZones = [];
    ['left', 'right'].forEach(function(side) {
      var dz = document.createElement('div');
      dz.className = 've-split-dropzone visible ' + side;
      dz.innerHTML = (side === 'left' ? '◀ Sol pane' : 'Sağ pane ▶');
      container.appendChild(dz);
      _dropZones.push(dz);
    });
  }
  
  function veHideSplitDropZones() {
    if(_dropZones) {
      _dropZones.forEach(function(dz) { dz.remove(); });
      _dropZones = null;
    }
  }
  
  window.veHandleSplitDrop = function(tabIdx, side) {
    if(veTabs.length < 2) {
      showToast('Bölmek için en az 2 sekme gerekli', 'warning');
      return;
    }
    
    // Aynı sekmeyi aynı yere bırakma
    if(!veSplitMode) {
      // Yeni split: aktif sekme bir tarafta, bırakılan diğer tarafta
      if(tabIdx === veActiveTabIdx) {
        showToast('Farklı bir sekmeyi sürükleyin', 'warning');
        return;
      }
      if(side === 0) {
        // Sol pane'e bırakılan = sol, mevcut aktif = sağa
        veSaveActiveTabState();
        veClearCanvasDOM();
        var oldActive = veActiveTabIdx;
        veActiveTabIdx = tabIdx;
        veLoadTabState(veTabs[tabIdx]);
        veSplitPanes = [tabIdx, oldActive];
      } else {
        // Sağ pane'e bırakılan
        veSplitPanes = [veActiveTabIdx, tabIdx];
      }
      veSplitMode = true;
      veFocusedPane = 0;
      veCreateSplitDOM();
      veRenderSnapshot(1);
      veUpdateSplitFocus();
      veRenderTabs();
      showToast('Bölünmüş görünüm açıldı');
    } else {
      // Zaten split — ilgili pane'i değiştir
      var targetPane = side;
      if(targetPane === veFocusedPane) {
        veSaveActiveTabState();
        veClearCanvasDOM();
        veSplitPanes[targetPane] = tabIdx;
        veActiveTabIdx = tabIdx;
        veLoadTabState(veTabs[tabIdx]);
      } else {
        veSplitPanes[targetPane] = tabIdx;
        veRenderSnapshot(targetPane);
      }
      veUpdatePaneLabels();
      veRenderTabs();
    }
  };
})();

// ── Render tabs: split mode visual indicator ──
var _origVeRenderTabsBase = null;
(function() {
  // veRenderTabs zaten override edildi (tab drag için)
  // veRenderTabs'ın ürettiği HTML'i zenginleştirmek için 
  // split indicator'ları veRenderTabs() çağrıldıktan sonra ekliyoruz
  var _patched = false;
  var _prevRender = veRenderTabs;
  
  veRenderTabs = function() {
    _prevRender();
    if(!veSplitMode) return;
    
    // Split modunda aktif tab'lara renkli indicator ekle
    var tabEls = document.querySelectorAll('#ve-tab-bar .ve-tab');
    tabEls.forEach(function(el, idx) {
      if(idx === veSplitPanes[0]) {
        el.style.borderLeft = '3px solid var(--accent-primary)';
        el.title = 'Sol pane';
      }
      if(idx === veSplitPanes[1]) {
        el.style.borderLeft = '3px solid #f59e0b';
        el.title = 'Sağ pane';
      }
    });
  };
})();
