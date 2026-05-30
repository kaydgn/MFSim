// ============================================================================
// TOPOLOJİ SEKME SİSTEMİ
// ============================================================================
var veTabs = [];
var veActiveTabIdx = 0;
var veTabCounter = 0;

function veSerializeCurrentState() {
  return {
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

function veSaveActiveTabState() {
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
    }
  } catch(e) {
    // Panel açık değilse DOM elemanları bulunamaz — debug için logla
    console.warn('[MFSim] Node data sync hatası (' + (node ? node.type : '?') + '):', e.message);
  }
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
  // Kaynağın güncel halini kaydet
  if(idx === veActiveTabIdx) veSaveActiveTabState();
  
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
  html += '<button class="ve-toolbar-btn" onclick="veUndo()" title="Geri Al (Ctrl+Z)"><span class="mf-ico mf-ico-undo"></span></button>';
  html += '<button class="ve-toolbar-btn" onclick="veRedo()" title="İleri Al (Ctrl+Y)"><span class="mf-ico mf-ico-redo"></span></button>';
  html += '<div class="ve-toolbar-sep"></div>';
  html += '<button class="ve-toolbar-btn" onclick="veZoomIn()" title="Yakınlaştır"><span class="mf-ico mf-ico-zoom-in"></span></button>';
  html += '<button class="ve-toolbar-btn" onclick="veZoomOut()" title="Uzaklaştır"><span class="mf-ico mf-ico-zoom-out"></span></button>';
  html += '<button class="ve-toolbar-btn" onclick="veResetView()" title="Görünümü Sıfırla"><span class="mf-ico mf-ico-crosshair"></span></button>';
  html += '<div class="ve-toolbar-sep"></div>';
  html += '<button class="ve-toolbar-btn ve-toolbar-toggle' + (typeof SNAP_ENABLED !== 'undefined' && SNAP_ENABLED ? ' active' : '') + '" id="ve-snap-btn" onclick="veToggleSnap()" title="Hizalama"><span class="mf-ico mf-ico-ruler"></span></button>';
  html += '<button class="ve-toolbar-btn ve-toolbar-toggle' + (typeof veGridVisible !== 'undefined' && veGridVisible ? ' active' : '') + '" id="ve-grid-btn" onclick="veToggleGrid()" title="Grid Göster/Gizle"><span class="mf-ico mf-ico-grid"></span></button>';
  html += '<button class="ve-toolbar-btn" id="ve-grid-density-btn" onclick="veCycleGridDensity()" title="Grid: ' + (typeof veGridLabels !== 'undefined' ? veGridLabels[veGridDensity] : 'Normal') + '"><span class="mf-ico mf-ico-grid-cells"></span></button>';
  html += '<button class="ve-toolbar-btn ve-toolbar-toggle' + (typeof veBoundaryVisible !== 'undefined' && veBoundaryVisible ? ' active' : '') + '" id="ve-boundary-btn" onclick="veToggleBoundary()" title="Sınır Göster/Gizle"><span class="mf-ico mf-ico-frame"></span></button>';
  html += '<button class="ve-toolbar-btn" id="ve-boundary-opacity-btn" onclick="veCycleBoundaryOpacity()" title="Sınır Opaklığı: ' + (typeof veBoundaryOpacity !== 'undefined' ? Math.round(veBoundaryOpacity * 100) : '55') + '%"><span class="mf-ico mf-ico-contrast"></span></button>';
  
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
  menu.style.cssText = 'position:fixed;left:' + e.clientX + 'px;top:' + e.clientY + 'px;z-index:200000;background:var(--bg-secondary);border:1px solid var(--border-color);border-radius:0;box-shadow:0 4px 16px rgba(0,0,0,0.3);padding:4px 0;min-width:150px;';
  
  var items = [
    { label: '✏️ Yeniden Adlandır', fn: function() { veRenameTab(idx); } },
    { label: '📋 Çoğalt', fn: function() { veDuplicateTab(idx); } },
    { label: 'sep' },
    { label: '✕ Kapat', fn: function() { veCloseTab(idx); }, danger: true }
  ];
  
  items.forEach(function(item) {
    if(item.label === 'sep') {
      var d = document.createElement('div');
      d.style.cssText = 'height:1px;background:var(--border-color);margin:4px 8px;';
      menu.appendChild(d);
      return;
    }
    var el = document.createElement('div');
    el.style.cssText = 'padding:6px 14px;font-size:0.7rem;cursor:pointer;color:' + (item.danger ? 'var(--accent-danger)' : 'var(--text-primary)') + ';transition:background 0.1s;';
    el.textContent = item.label;
    el.onmouseover = function() { this.style.background = 'var(--bg-tertiary)'; };
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
  
  // Aktif sekmeyi kaydet
  veSaveActiveTabState();
  
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
    label.textContent = name + (isFocused ? ' ✎' : ' 👁');
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
    veSaveActiveTabState();
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
  var def = componentDefs[node.type] || {};
  var isInput = portType.indexOf('input') === 0;
  var portIndex = 0;
  if(portType.indexOf('-') > -1) portIndex = parseInt(portType.split('-')[1]) || 0;
  var totalPorts = isInput ? (def.inputs || 1) : (def.outputs || 1);
  var spacing = h / (totalPorts + 1);
  var side = node.mirrored ? (isInput ? 'right' : 'left') : (isInput ? 'left' : 'right');
  var x, y;
  y = node.y + spacing * (portIndex + 1);
  if(side === 'right') x = node.x + w + 7;
  else x = node.x - 7;
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
