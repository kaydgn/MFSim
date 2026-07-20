
// ============================================================================
// TOOLBAR FONKSİYONLARI
// ============================================================================
function veZoomIn() {
  var rect = document.getElementById('ve-canvas-wrapper').getBoundingClientRect();
  var centerX = rect.width / 2;
  var centerY = rect.height / 2;
  
  var oldZoom = canvasZoom;
  canvasZoom = Math.min(3, canvasZoom * 1.2);
  var zoomRatio = canvasZoom / oldZoom;
  canvasOffset.x = centerX - (centerX - canvasOffset.x) * zoomRatio;
  canvasOffset.y = centerY - (centerY - canvasOffset.y) * zoomRatio;
  updateCanvasTransform();
  showToast('Zoom: ' + Math.round(canvasZoom * 100) + '%');
}

function veZoomOut() {
  var rect = document.getElementById('ve-canvas-wrapper').getBoundingClientRect();
  var centerX = rect.width / 2;
  var centerY = rect.height / 2;
  
  var oldZoom = canvasZoom;
  canvasZoom = Math.max(0.2, canvasZoom * 0.8);
  var zoomRatio = canvasZoom / oldZoom;
  canvasOffset.x = centerX - (centerX - canvasOffset.x) * zoomRatio;
  canvasOffset.y = centerY - (centerY - canvasOffset.y) * zoomRatio;
  updateCanvasTransform();
  showToast('Zoom: ' + Math.round(canvasZoom * 100) + '%');
}

function veResetView() {
  canvasZoom = 1;
  canvasOffset = {x: 3000, y: 3000};
  updateCanvasTransform();
  showToast('Görünüm sıfırlandı');
}

function veUndo() {
  undo();
}

function veRedo() {
  redo();
}

// ===== DOSYA MENÜSÜ =====
function veToggleFileMenu() {
  var menu = document.getElementById('ve-file-menu');
  if(!menu) return;
  var show = menu.style.display === 'none';
  menu.style.display = show ? 'block' : 'none';
  if(show) {
    // Menü dışına tıklanınca kapat
    setTimeout(function() {
      document.addEventListener('click', veCloseFileMenu, {once: true});
    }, 10);
  }
}
function veCloseFileMenu(e) {
  var menu = document.getElementById('ve-file-menu');
  if(menu) menu.style.display = 'none';
}
function veNewProject() {
  veCloseFileMenu();
  var totalNodes = 0;
  veTabs.forEach(function(t, i) {
    if(i === veActiveTabIdx) totalNodes += nodes.length;
    else totalNodes += (t.nodeCount || 0);
  });
  
  var doNew = function() {
    if(veSplitMode) veCloseSplit();
    veClearCanvasDOM();
    veTabs = [];
    veActiveTabIdx = 0;
    veTabCounter = 0;
    compCounter = 0;
    veProjectName = '';
    veSetProjectNameButton('MFSim');
    veAddTab('Topoloji 1');
    showToast('Yeni proje oluşturuldu');
  };
  
  if(totalNodes > 0) {
    showConfirmToast('Mevcut projeyi kapatıp yeni proje oluşturulsun mu?', doNew);
  } else {
    doNew();
  }
}

// Proje adı - dosya adından veya topolojiden otomatik al
var veProjectName = '';

// Marka / proje-adı butonunu tutarlı ve yapısal biçimde çizer:
// [ikon kutusu] [proje adı] [chevron]. İsim boşsa ya da uygulamanın kendi
// <title>'ıysa sade "MFSim" markası gösterilir (kırpılmış başlık görünmez).
// textContent = gösterilen isim → results.js'in geri-okuması korunur.
function veSetProjectNameButton(name) {
  var btn = document.getElementById('ve-project-name-btn');
  if(!btn) return;
  var raw = (name == null ? '' : String(name)).trim();
  if(!raw || raw === (document.title || '').trim()) raw = 'MFSim';
  var display = raw.length > 22 ? raw.substring(0, 20) + '…' : raw;
  btn.innerHTML =
    '<span class="ve-brand-mark"><span class="mf-ico mf-ico-settings"></span></span>' +
    '<span class="ve-brand-name"></span>' +
    '<span class="mf-ico mf-ico-chevron-down ve-brand-chev"></span>';
  btn.querySelector('.ve-brand-name').textContent = display;
}

(function() {
  // Dosya adından proje adı çıkar
  var title = document.title || '';
  if(!title || title === 'Motor Freni Performans Hesaplayıcı') {
    // URL'den dosya adı al
    var path = window.location.pathname;
    var fname = path.split('/').pop().replace(/\.html?$/i, '').replace(/_/g, ' ').trim();
    if(fname) veProjectName = fname;
  } else {
    veProjectName = title;
  }
  // Proje buton metnini güncelle
  setTimeout(function() {
    veSetProjectNameButton(veProjectName);
  }, 500);
})();


function veShowSaveDialog(defaultName, blob, toastMsg) {
  // Önceki diyalog varsa kapat
  var prev = document.getElementById('ve-save-dialog-overlay');
  if(prev) prev.remove();

  var overlay = document.createElement('div');
  overlay.id = 've-save-dialog-overlay';
  overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.6);z-index:9999;display:flex;align-items:center;justify-content:center;';
  overlay.onclick = function(e) { if(e.target === overlay) overlay.remove(); };

  var modal = document.createElement('div');
  modal.style.cssText = 'background:var(--bg-secondary,#1a1a2e);color:var(--text-primary,#e0e0e0);border-radius:0;padding:24px;max-width:420px;width:90%;box-shadow:0 16px 48px rgba(0,0,0,0.4);border:1px solid var(--border-color,#333);';

  var nameOnly = defaultName.replace(/\.[^.]+$/, '');
  var ext = defaultName.slice(nameOnly.length);

  modal.innerHTML =
    '<h3 style="margin:0 0 16px 0;font-size:1rem;">Farklı Kaydet</h3>' +
    '<label style="font-size:0.8rem;color:var(--text-muted,#aaa);display:block;margin-bottom:6px;">Dosya adı</label>' +
    '<div style="display:flex;align-items:center;gap:0;">' +
      '<input id="ve-save-filename" type="text" value="' + nameOnly.replace(/"/g, '&quot;') + '" ' +
        'style="flex:1;padding:8px 12px;background:var(--bg-tertiary,#111);color:var(--text-primary,#e0e0e0);border:1px solid var(--border-color,#444);border-radius:0;font-size:0.85rem;outline:none;" />' +
      '<span style="padding:8px 12px;background:var(--bg-tertiary,#111);color:var(--text-muted,#888);border:1px solid var(--border-color,#444);border-left:none;border-radius:0;font-size:0.85rem;white-space:nowrap;">' + ext + '</span>' +
    '</div>' +
    '<div style="margin-top:18px;display:flex;gap:8px;justify-content:flex-end;">' +
      '<button id="ve-save-cancel" style="padding:7px 18px;background:var(--bg-tertiary,#222);color:var(--text-primary,#e0e0e0);border:1px solid var(--border-color,#444);border-radius:0;cursor:pointer;font-size:0.8rem;">İptal</button>' +
      '<button id="ve-save-confirm" style="padding:7px 18px;background:var(--accent-primary,#3b82f6);color:white;border:none;border-radius:0;cursor:pointer;font-size:0.8rem;font-weight:600;">Kaydet</button>' +
    '</div>';

  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  var input = document.getElementById('ve-save-filename');
  input.focus();
  input.select();

  function doSave() {
    var fileName = input.value.trim();
    if(!fileName) { showToast('Dosya adı boş olamaz', 'warning'); return; }
    fileName += ext;
    overlay.remove();

    if (window.showSaveFilePicker) {
      var mimeType = blob.type || 'application/json';
      var extClean = ext.replace(/^\./, '');
      window.showSaveFilePicker({
        suggestedName: fileName,
        types: [{
          description: extClean.toUpperCase() + ' dosyası',
          accept: {}
        }]
      }).then(function(handle) {
        // accept nesnesini dinamik oluştur
        handle.createWritable().then(function(writable) {
          writable.write(blob).then(function() {
            return writable.close();
          }).then(function() {
            showToast(toastMsg);
          });
        });
      }).catch(function(err) {
        // Kullanıcı iptal ettiyse sessizce geç
        if (err.name !== 'AbortError') {
          console.error('Kaydetme hatası:', err);
          showToast('Kaydetme başarısız', 'warning');
        }
      });
    } else {
      // showSaveFilePicker desteklenmeyen tarayıcılar için fallback
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showToast(toastMsg);
    }
  }

  document.getElementById('ve-save-confirm').onclick = doSave;
  document.getElementById('ve-save-cancel').onclick = function() { overlay.remove(); };
  input.addEventListener('keydown', function(e) {
    if(e.key === 'Enter') doSave();
    if(e.key === 'Escape') overlay.remove();
  });
}


function veClearAll() {
  if(nodes.length === 0) {
    showToast('Temizlenecek bileşen yok', 'warning');
    return;
  }
  showConfirmToast('Bu sekmedeki tüm bileşenleri silmek istediğinize emin misiniz?', function() {
    saveState();
    nodes.forEach(function(n) {
      var el = document.getElementById(n.id);
      if(el) el.remove();
    });
    nodes = [];
    connections = [];
    selectedNodes = [];
    showEmptyProperties();
    updateAllConnections();
    updateNodeCount();
    veSaveActiveTabState();
    veRenderTabs();
    showToast('Sekme temizlendi');
  });
}

// ─────────────────────────────────────────────────────────────
// KAYDETME BOYUTU: simülasyon sonuçlarını seyreltme / ayıklama
// ---------------------------------------------------------------
// simResults (time + nodeData sinyalleri + legacy diziler) çıktı-nokta
// sayısıyla büyür; ham hâliyle kaydedilince tek sekme bile on-yüzlerce
// MB olabilir (topoloji basit olsa da). Diske/localStorage'a yazarken
// zaman-serilerini görsel olarak yeterli bir üst sınıra indiririz.
// ÖNEMLİ: canlı bellekteki window.veSimResults / tab.state.simResults'a
// DOKUNULMAZ — grafik/CSV tam çözünürlükte kalır; yalnızca serileştirilen
// KOPYA seyreltilir.
var VE_SAVE_MAX_POINTS = 2000;

// N uzunluklu bir diziden en fazla maxPoints eleman seçen indeks kümesi.
// İlk ve son nokta her zaman korunur (son değerler anlamlıdır).
function veComputeDecimationIndices(len, maxPoints) {
  var idx = [];
  if(!(len > maxPoints)) {
    for(var i = 0; i < len; i++) idx.push(i);
    return idx;
  }
  var stride = (len - 1) / (maxPoints - 1);
  for(var k = 0; k < maxPoints; k++) idx.push(Math.round(k * stride));
  idx[idx.length - 1] = len - 1;
  return idx;
}

// simResults'ın seyreltilmiş YENİ bir kopyasını döndürür (orijinali bozmaz).
// time uzunluğuna eşit tüm paralel diziler (time, nodeData[*][*], legacy
// hız/devir/kuvvet dizileri) aynı indekslerle seyreltilir → hizalama korunur.
// Paralel olmayan alanlar (mode, chainNodeIds, solverStats) aynen taşınır.
function veDecimateSimResults(sim, maxPoints) {
  if(!sim || typeof sim !== 'object') return sim || null;
  maxPoints = maxPoints || VE_SAVE_MAX_POINTS;
  var origLen = (sim.time && sim.time.length) ? sim.time.length : 0;
  if(origLen <= maxPoints) return sim; // seyreltme gereksiz — referansı aynen bırak
  var idx = veComputeDecimationIndices(origLen, maxPoints);
  function pick(arr) {
    var out = new Array(idx.length);
    for(var i = 0; i < idx.length; i++) out[i] = arr[idx[i]];
    return out;
  }
  var slim = {};
  Object.keys(sim).forEach(function(key) {
    var val = sim[key];
    if(key === 'nodeData' && val && typeof val === 'object') {
      var nd = {};
      Object.keys(val).forEach(function(nodeId) {
        var sigs = val[nodeId];
        if(!sigs || typeof sigs !== 'object') { nd[nodeId] = sigs; return; }
        var outSigs = {};
        Object.keys(sigs).forEach(function(sigId) {
          var a = sigs[sigId];
          outSigs[sigId] = (Array.isArray(a) && a.length === origLen) ? pick(a) : a;
        });
        nd[nodeId] = outSigs;
      });
      slim[key] = nd;
    } else if(Array.isArray(val) && val.length === origLen) {
      slim[key] = pick(val);
    } else {
      slim[key] = val;
    }
  });
  return slim;
}

// Bir sekme state'inin diske/yedeğe yazılacak "temiz" kopyasını üretir.
// opts.stripResults=true  → sonuçlar hiç yazılmaz (en küçük; yedek/kurtarma için)
// opts.maxPoints          → seyreltme üst sınırı (varsayılan VE_SAVE_MAX_POINTS)
// resultSlots (sensör/panel konfigürasyonu) her durumda korunur.
function veBuildCleanTabState(tabState, opts) {
  if(!tabState) return null;
  opts = opts || {};
  var sim = tabState.simResults || null;
  if(opts.stripResults) {
    sim = null;
  } else if(sim) {
    sim = veDecimateSimResults(sim, opts.maxPoints || VE_SAVE_MAX_POINTS);
  }
  return {
    nodes: tabState.nodes,
    connections: tabState.connections,
    compCounter: tabState.compCounter,
    canvasOffset: tabState.canvasOffset,
    canvasZoom: tabState.canvasZoom,
    simResults: sim,
    resultSlots: tabState.resultSlots || [{},{},{},{}]
  };
}

function veSaveTopology() {
  veCloseFileMenu();

  // Aktif sekmeyi kaydet (alt-topolojideysek kullanıcıyı yerinden etme)
  if(typeof veSaveActiveTabStateKeepView === 'function') veSaveActiveTabStateKeepView();
  else veSaveActiveTabState();
  
  var project = {
    version: 2,
    projectName: veProjectName || '',
    activeModule: veActiveModule || '',
    tabCounter: veTabCounter,
    activeTabIdx: veActiveTabIdx,
    tabs: veTabs.map(function(tab) {
      return {
        id: tab.id,
        name: tab.name,
        state: veBuildCleanTabState(tab.state)
      };
    })
  };

  // Girintisiz (compact) JSON: girintili yazım milyonlarca sayıyı ~2.5×
  // şişirir. Yükleme JSON.parse ile yapıldığından biçim fark etmez.
  var json = JSON.stringify(project);
  var blob = new Blob([json], {type: 'application/json'});
  var defaultName = (veProjectName || 'topoloji') + '_' + new Date().toISOString().slice(0,10) + '.json';
  veShowSaveDialog(defaultName, blob, 'Proje kaydedildi (' + veTabs.length + ' sekme)');
}

function veLoadTopology() {
  veCloseFileMenu();
  var input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json';
  
  input.addEventListener('change', function(e) {
    var file = e.target.files[0];
    if(!file) return;
    
    var reader = new FileReader();
    reader.onload = function(ev) {
      try {
        var data = JSON.parse(ev.target.result);
        
        // Format v2: çoklu sekme projesi
        if(data.version === 2 && data.tabs && data.tabs.length > 0) {
          veClearCanvasDOM();
          veTabs = [];
          veTabCounter = data.tabCounter || data.tabs.length;
          
          data.tabs.forEach(function(t) {
            veTabs.push({
              id: t.id,
              name: t.name,
              state: t.state,
              nodeCount: (t.state && t.state.nodes) ? t.state.nodes.length : 0,
              connCount: (t.state && t.state.connections) ? t.state.connections.length : 0
            });
          });
          
          veActiveTabIdx = Math.min(data.activeTabIdx || 0, veTabs.length - 1);
          
          // Tek modül — her zaman full-throttle
          veActiveModule = 'full-throttle';
          var moduleOverlay = document.getElementById('ve-module-overlay');
          if(moduleOverlay) moduleOverlay.style.display = 'none';
          veShowAllSidebarComponents();
          
          veLoadTabState(veTabs[veActiveTabIdx]);
          
          if(data.projectName) {
            veProjectName = data.projectName;
            veSetProjectNameButton(veProjectName);
          }
          
          veRenderTabs();
          showToast('Proje yüklendi: ' + veTabs.length + ' sekme');
          return;
        }
        
        // Format v1 (eski): tek topoloji
        if(!data.nodes || !data.connections) {
          showToast('Geçersiz topoloji dosyası', 'error');
          return;
        }
        
        // Eski formatı aktif sekmeye yükle
        veClearCanvasDOM();
        
        if(data.canvasOffset) canvasOffset = data.canvasOffset;
        if(data.canvasZoom) canvasZoom = data.canvasZoom;
        if(data.compCounter) compCounter = data.compCounter;
        else if(data.nodeCounter) compCounter = data.nodeCounter;
        updateCanvasTransform();
        
        restoreState(data);
        
        // Aktif sekmeyi güncelle
        undoStack = [];
        redoStack = [];
        saveState();
        veSaveActiveTabState();
        veRenderTabs();
        
        showToast('Topoloji yüklendi: ' + data.nodes.length + ' bileşen (v1 format)');
      } catch(err) {
        showToast('Dosya okunamadı: ' + err.message, 'error');
      }
    };
    reader.readAsText(file);
  });
  
  input.click();
}

