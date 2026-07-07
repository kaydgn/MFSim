
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
    var btn = document.getElementById('ve-project-name-btn');
    if(btn) btn.textContent = '⚙ MFSim ▾';
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
    var btn = document.getElementById('ve-project-name-btn');
    if(btn && veProjectName) {
      var shortName = veProjectName.length > 18 ? veProjectName.substring(0, 16) + '…' : veProjectName;
      btn.textContent = '⚙ ' + shortName + ' ▾';
    }
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
      var cleanState = null;
      if(tab.state) {
        cleanState = {
          nodes: tab.state.nodes,
          connections: tab.state.connections,
          compCounter: tab.state.compCounter,
          canvasOffset: tab.state.canvasOffset,
          canvasZoom: tab.state.canvasZoom,
          simResults: tab.state.simResults || null,
          resultSlots: tab.state.resultSlots || [{},{},{},{}]
        };
      }
      return {
        id: tab.id,
        name: tab.name,
        state: cleanState
      };
    })
  };
  
  var json = JSON.stringify(project, null, 2);
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
            var btn = document.getElementById('ve-project-name-btn');
            if(btn) {
              var shortName = veProjectName.length > 18 ? veProjectName.substring(0, 16) + '…' : veProjectName;
              btn.textContent = '⚙ ' + shortName + ' ▾';
            }
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

