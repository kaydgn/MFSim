// ============================================================================
// FEA MESH EDITOR — MODAL PENCERESİ
// ============================================================================
// ANSYS Workbench Mesh deneyimini taklit eden modal pencere:
//   - Header (başlık + kapat)
//   - Toolbar (Mesh Oluştur + Boyut + Presetler)
//   - Split body: SOL (resizable accordion paneli) + SAĞ (3D mesh viewer)
//   - Footer (mesh durumu)
//
// Side panel'de SADECE "Mesh Editörünü Aç" butonu var. Tüm kompleks UI
// (mesh ayarları, kalite metrikleri, heat map, named selections)
// burada modal içinde accordion'lar olarak organize edildi.
//
// Public API:
//   veFEAOpenMeshEditor(nodeId)   → modal aç
//   veFEACloseMeshEditor()        → modal kapat
//   veFEAToggleAccordion(key)     → accordion bölümünü aç/kapat
// ============================================================================

var _veFEAEditorActive = null;  // şu an açık olan mesh node ID
var _veFEAEditorOverlay = null;
var _veFEAEditorEscHandler = null;
var _veFEAEditorResizeObserver = null;  // modal viewer için container resize observer
var _veFEAEditorAccordionState = {};  // { sectionKey: true (open) | false (closed) }

// Default accordion durumu (ilk açılışta): TÜM sekmeler kapalı — kullanıcı
// modal'ı açtığında temiz/sade bir liste görür, ilgilendiği section'ı kendi
// açar. Önceden 'sizing'+'defaults' açıktı; modal yüksekliği gereksiz uzuyor
// ve kullanıcı her açılışta 2 açık panel ile karşılaşıyordu.
// Pre-mesh grup üstte, Post-mesh grup altta — sıra workflow temelli.
function _veFEAEditorDefaultAccordionState() {
  return {
    // Pre-mesh
    sizing: false,
    defaults: false,
    inflation: false,
    faceSizing: false,
    edgeSizing: false,
    sphereOfInfluence: false,
    virtualTopology: false,
    namedSel: false,
    // Post-mesh
    quality: false,
    statistics: false,
    display: false,
    suggestions: false,
    convergence: false,
    topology: false
  };
}

// ─── Outline + Toolbar + Footer'ı yenile (mesh state değişimleri için) ────
// Faz 3b refactor (eski adı: veFEAEditorRefreshAccordions — geriye uyumluluk
// için isim korundu; her yerden çağrılıyor). Modal açıkken mesh oluşturul-
// duğunda, silindiğinde veya bir lokal kontrol eklendi/silindi/değiştiğinde:
//   • FEAMeshOutline.refresh() — sol panelin üst yarısındaki outline + alt
//     yarısındaki details container'larını yeniden çizer
//   • Backward-compat: eğer eski accordion DOM elementleri (test ortamı veya
//     legacy build) hâlâ varsa, body'lerini de günceller — no-op değilse
//     etki yok demektir.
//   • Toolbar — "Mesh'i Sil" butonu mesh varlığına göre değişir
//   • Footer — düğüm/eleman sayısı ve süre
function veFEAEditorRefreshAccordions() {
  if (!_veFEAEditorActive || typeof nodes === 'undefined') return;
  var node = nodes.find(function(n) { return n.id === _veFEAEditorActive; });
  if (!node) return;

  // ANSYS-tarz outline + details panellerini yenile (yeni layout)
  if (typeof FEAMeshOutline !== 'undefined' && typeof FEAMeshOutline.refresh === 'function') {
    try { FEAMeshOutline.refresh(); } catch (e) { /* no-op */ }
  }

  // Backward-compat: eski accordion body'leri DOM'da varsa onları da güncelle
  var updates = {
    'topology':    _veFEAEditorTopologyHTML(node),
    'defaults':    _veFEAEditorDefaultsHTML(node),
    'sizing':      _veFEAEditorSizingHTML(node),
    'inflation':         _veFEAEditorInflationHTML(node),
    'faceSizing':        _veFEAEditorFaceSizingHTML(node),
    'edgeSizing':        _veFEAEditorEdgeSizingHTML(node),
    'sphereOfInfluence': _veFEAEditorSphereOfInfluenceHTML(node),
    'virtualTopology':   _veFEAEditorVirtualTopologyHTML(node),
    'quality':           _veFEAEditorQualityHTML(node),
    'namedSel':    _veFEAEditorNamedSelHTML(node),
    'display':     _veFEAEditorDisplayHTML(node),
    'statistics':  _veFEAEditorStatisticsHTML(node),
    'suggestions': _veFEAEditorSuggestionsHTML(node),
    'convergence': _veFEAEditorConvergenceHTML(node)
  };
  Object.keys(updates).forEach(function(k) {
    var body = document.getElementById('ve-fea-acc-body-' + k);
    if (body) body.innerHTML = updates[k];
  });

  // Header — "Mesh Oluştur / Yeniden Oluştur" + sil butonu mesh durumuna göre değişir
  var oldHeader = document.getElementById('ve-fea-mesh-editor-header');
  if (oldHeader && oldHeader.parentNode) {
    var newHeader = _veFEAEditorBuildHeader(node);
    oldHeader.parentNode.replaceChild(newHeader, oldHeader);
  }
  // Backward-compat: eski üst toolbar DOM'da kalmışsa güncelle (artık yok)
  var oldToolbar = document.getElementById('ve-fea-mesh-editor-toolbar');
  if (oldToolbar && oldToolbar.parentNode) {
    var newToolbar = _veFEAEditorBuildToolbar(node);
    oldToolbar.parentNode.replaceChild(newToolbar, oldToolbar);
  }

  // Footer — durum (düğüm/eleman/ms) güncellenir
  var oldFooter = document.getElementById('ve-fea-mesh-editor-footer');
  if (oldFooter && oldFooter.parentNode) {
    var newFooter = _veFEAEditorBuildFooter(node);
    oldFooter.parentNode.replaceChild(newFooter, oldFooter);
  }
}

// ─── Modal aç ──────────────────────────────────────────────────────────────
function veFEAOpenMeshEditor(nodeId) {
  if (_veFEAEditorActive) veFEACloseMeshEditor();
  if (typeof nodes === 'undefined') return;
  var node = nodes.find(function(n) { return n.id === nodeId; });
  // Faz 1: birleşik 'fea' modülü VEYA eski 'fea-mesh' node'u kabul edilir.
  if (!node || (node.type !== 'fea-mesh' && node.type !== 'fea')) return;
  // Birleşik modülde meshSettings garanti olsun (outline state buna bağlı)
  if (node.type === 'fea') {
    node.data = node.data || {};
    if (!node.data.meshSettings) {
      node.data.meshSettings = (typeof veFEACreateModuleData === 'function')
        ? veFEACreateModuleData().meshSettings
        : { size: 10, suppressFlags: {} };
    }
  }

  node.data = node.data || {};
  if (!node.data.editorAccordion) node.data.editorAccordion = _veFEAEditorDefaultAccordionState();
  _veFEAEditorAccordionState = node.data.editorAccordion;

  // Overlay
  var overlay = document.createElement('div');
  overlay.id = 've-fea-mesh-editor-overlay';
  overlay.style.cssText = 'position:fixed; inset:0; z-index:100000; background:rgba(0,0,0,0.82); display:flex; align-items:center; justify-content:center; padding:16px; backdrop-filter:blur(4px);';
  overlay.addEventListener('mousedown', function(e) {
    // Sadece overlay'in kendisine tıklandığında kapat (modal içine değil)
    if (e.target === overlay) veFEACloseMeshEditor();
  });

  // Modal
  var modal = document.createElement('div');
  modal.id = 've-fea-mesh-editor-modal';
  modal.style.cssText = 'width:95%; max-width:1700px; min-width:720px; height:92vh; max-height:1000px; background:var(--bg-secondary, #0f1218); border:1px solid var(--border-color, #1c2333); border-radius:0; display:flex; flex-direction:column; overflow:hidden; box-shadow:0 20px 60px rgba(0,0,0,0.6); position:relative;';

  // Header
  var header = _veFEAEditorBuildHeader(node);
  modal.appendChild(header);

  // NOT (kullanıcı isteği): eski üst "Mesh Oluştur" toolbar'ı kaldırıldı —
  // mesh oluşturma kontrolleri artık ağaçtaki "Mesh" dalının Details panelinde
  // (_veFEAEditorMeshBuildControlsHTML). Üst şerit çirkin duruyordu.

  // Body (split: sol accordion + resize handle + sağ viewer)
  var body = document.createElement('div');
  body.id = 've-fea-mesh-editor-body';
  body.style.cssText = 'flex:1; display:flex; flex-direction:row; min-height:0; overflow:hidden;';

  var leftPanel = _veFEAEditorBuildLeftPanel(node);
  body.appendChild(leftPanel);

  var divider = _veFEAEditorBuildResizeHandle();
  body.appendChild(divider);

  var rightPanel = _veFEAEditorBuildRightPanel(node);
  body.appendChild(rightPanel);

  modal.appendChild(body);

  // Footer
  var footer = _veFEAEditorBuildFooter(node);
  modal.appendChild(footer);

  // Modal kenar resize tutamacları (Rota pattern)
  _veFEAEditorAttachModalResize(modal, overlay);

  overlay.appendChild(modal);
  document.body.appendChild(overlay);
  _veFEAEditorActive = nodeId;
  _veFEAEditorOverlay = overlay;

  // ESC ile kapat
  _veFEAEditorEscHandler = function(e) {
    if (e.key === 'Escape') veFEACloseMeshEditor();
  };
  document.addEventListener('keydown', _veFEAEditorEscHandler);

  // 3D viewer'ı modal canvas'a yedir. Canvas layout'u flexbox tarafından
  // hesaplanmadan Three.js init edersek clientWidth=0 olur → WebGL renderer
  // tiny boyutta kalır → real browser'da context loss / GPU crash ("üzgün yüz").
  // requestAnimationFrame ile layout settle olmasını bekle, gerekirse retry.
  _veFEASafeInitModalViewer(nodeId, 6);
}

function _veFEASafeInitModalViewer(nodeId, retries) {
  if (_veFEAEditorActive !== nodeId) return; // modal kapanmış
  if (typeof veFEAInitMeshViewerForNode !== 'function') return;
  var canvas = document.getElementById('ve-fea-mesh-canvas-' + nodeId);
  if (!canvas) {
    if (retries > 0) {
      requestAnimationFrame(function() { _veFEASafeInitModalViewer(nodeId, retries - 1); });
    }
    return;
  }
  var w = canvas.clientWidth || (canvas.parentElement && canvas.parentElement.clientWidth) || 0;
  var h = canvas.clientHeight || (canvas.parentElement && canvas.parentElement.clientHeight) || 0;
  if ((w < 50 || h < 50) && retries > 0) {
    // Layout henüz hazır değil → bir frame daha bekle
    requestAnimationFrame(function() { _veFEASafeInitModalViewer(nodeId, retries - 1); });
    return;
  }
  // Boyutlar tamamen başarısızsa fallback (modal görünür ama boyut 0 — modal
  // kapalı olabilir veya görüntülenmiyor — sessizce çık)
  if (w < 50 || h < 50) return;

  // Canvas backing-buffer'ı explicit set et — WebGL renderer doğru başlatılsın
  canvas.width = w;
  canvas.height = h;

  try {
    veFEAInitMeshViewerForNode(nodeId);
    // Yeni modal'da clip state'i sıfırla (önceki session'dan kalan ayarları
    // taşımayalım) + UI'ı senkronla.
    var viewerInit = veFEAViewerRegistry[nodeId];
    if (viewerInit && viewerInit._clipState) {
      ['x', 'y', 'z'].forEach(function(a) { viewerInit.setClipPlane(a, false, 0); });
    }
    if (typeof _veFEAEditorRefreshClipUI === 'function') _veFEAEditorRefreshClipUI(nodeId);
  } catch (err) {
    console.error('[FEA Mesh Editor] viewer init hatası:', err);
    return;
  }

  // Container resize'larında viewer'ı senkronize et (modal/panel resize)
  if (typeof ResizeObserver !== 'undefined' && canvas.parentElement) {
    if (_veFEAEditorResizeObserver) {
      try { _veFEAEditorResizeObserver.disconnect(); } catch(e) {}
    }
    _veFEAEditorResizeObserver = new ResizeObserver(function() {
      var c = document.getElementById('ve-fea-mesh-canvas-' + nodeId);
      var v = veFEAViewerRegistry[nodeId];
      if (!c || !v || typeof v.resize !== 'function') return;
      var nw = c.clientWidth | 0;
      var nh = c.clientHeight | 0;
      if (nw > 0 && nh > 0) v.resize(nw, nh);
    });
    _veFEAEditorResizeObserver.observe(canvas.parentElement);
  }

  // Topoloji Motoru otomatik taraması — geometri varsa ve henüz taranmadıysa,
  // viewer hazır olduğunda ANSYS-tarzı tarama animasyonunu başlat.
  _veFEAMaybeAutoScanTopology(nodeId);
}

// Modal açıldığında otomatik topoloji taraması tetikle (bir kez, geometri
// taranmamışsa). Geometri değişince node.data.topologyScanned reset edilir.
function _veFEAMaybeAutoScanTopology(nodeId) {
  if (typeof veFEAStartTopologyScan !== 'function') return;
  if (typeof nodes === 'undefined') return;
  var node = nodes.find(function(n) { return n.id === nodeId; });
  if (!node) return;
  // Zaten tarandıysa tekrar etme (kullanıcı manuel "Yeniden Tara" ile tetikler)
  if (node.data && node.data.topologyScanned) return;
  // Geometri bağlı mı? (upstream veya birleşik modül)
  var geomNode = (typeof veFEAFindUpstreamGeometryNode === 'function')
    ? veFEAFindUpstreamGeometryNode(nodeId) : null;
  var hasGeom = !!(geomNode && geomNode.data && geomNode.data.geometry && geomNode.data.geometry.type);
  if (!hasGeom && node.data && node.data.geometry && node.data.geometry.type) hasGeom = true;
  if (!hasGeom) return;
  // Viewer'ın geometriyi yüklemesi için bir frame bekle, sonra tara
  setTimeout(function() {
    if (_veFEAEditorActive !== nodeId) return;
    veFEAStartTopologyScan(nodeId, { auto: true });
  }, 350);
}

// ═══════════════════════════════════════════════════════════════════════════
// MESH İŞLEM AŞAMASI GÖRSELLEŞTİRMESİ (Loading overlay + Sonuç banner'ı)
// ═══════════════════════════════════════════════════════════════════════════
// Kullanıcı "Mesh Oluştur"a basınca modal içinde yarı-saydam overlay +
// dönen spinner + "Mesh oluşturuluyor..." gösterilir. Mesh bittiğinde
// overlay kalkar, modal üst kısmında yeşil success banner (eleman sayısı +
// hesaplama süresi) 4-5 saniye görünür. Hata durumunda kırmızı banner.
//
// Senkron mesh işlemlerinde JS thread bloke olur → spinner animasyonu
// duraklayabilir; bu yüzden veFEABuildMeshForNode'da requestAnimationFrame
// ile bir frame defer edilir (overlay'in DOM'a çizilmesi için).

var _veFEAEditorLoadingEl = null;
var _veFEAEditorBannerTimer = null;

function veFEAEditorShowLoading(message, subMessage) {
  if (!_veFEAEditorOverlay) return; // modal acik degil — atla
  // Mevcut overlay varsa sadece mesaj güncelle
  if (_veFEAEditorLoadingEl) {
    var msg1 = _veFEAEditorLoadingEl.querySelector('[data-loading-msg]');
    var msg2 = _veFEAEditorLoadingEl.querySelector('[data-loading-sub]');
    if (msg1) msg1.textContent = message || 'Mesh oluşturuluyor...';
    if (msg2) msg2.textContent = subMessage || '';
    return;
  }
  // Spinner CSS animasyonu için style enjekte et (bir kez)
  if (!document.getElementById('ve-fea-loading-style')) {
    var st = document.createElement('style');
    st.id = 've-fea-loading-style';
    st.textContent = '@keyframes ve-fea-spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }' +
      '@keyframes ve-fea-fade-in { from { opacity: 0; } to { opacity: 1; } }' +
      '@keyframes ve-fea-slide-down { from { transform: translateY(-20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }';
    document.head.appendChild(st);
  }
  var loading = document.createElement('div');
  loading.id = 've-fea-mesh-loading';
  loading.style.cssText = 'position:absolute; inset:0; z-index:10; display:flex; flex-direction:column; align-items:center; justify-content:center; background:rgba(10,13,20,0.78); backdrop-filter:blur(2px); animation:ve-fea-fade-in 0.15s ease-out; pointer-events:auto;';
  loading.innerHTML =
    '<div style="width:64px; height:64px; border:4px solid rgba(255,255,255,0.12); border-top-color:var(--accent-primary, #3b82f6); border-radius:50%; animation:ve-fea-spin 0.9s linear infinite;"></div>' +
    '<div data-loading-msg style="margin-top:18px; font-size:0.92rem; font-weight:600; color:#fff; letter-spacing:0.02em;">' + (message || 'Mesh oluşturuluyor...') + '</div>' +
    '<div data-loading-sub style="margin-top:6px; font-size:0.7rem; color:rgba(255,255,255,0.65);">' + (subMessage || '') + '</div>';
  // Modal box'in icine yerlestir (mesh editor modal box'i overlay'in
  // direkt child'i)
  var modalBox = _veFEAEditorOverlay.firstElementChild;
  if (modalBox) {
    if (getComputedStyle(modalBox).position === 'static') modalBox.style.position = 'relative';
    modalBox.appendChild(loading);
  } else {
    _veFEAEditorOverlay.appendChild(loading);
  }
  _veFEAEditorLoadingEl = loading;
}

function veFEAEditorHideLoading() {
  if (!_veFEAEditorLoadingEl) return;
  if (_veFEAEditorLoadingEl.parentNode) _veFEAEditorLoadingEl.parentNode.removeChild(_veFEAEditorLoadingEl);
  _veFEAEditorLoadingEl = null;
}

// Sonuç banner'ı — modal üst kısmında 4 saniye görünür sonra kaybolur.
// type: 'success' | 'error' | 'warning' | 'info'
function veFEAEditorShowResultBanner(type, message, subMessage) {
  if (!_veFEAEditorOverlay) return;
  // Önceki banner varsa kaldır + timer iptal
  var existing = document.getElementById('ve-fea-mesh-banner');
  if (existing && existing.parentNode) existing.parentNode.removeChild(existing);
  if (_veFEAEditorBannerTimer) { clearTimeout(_veFEAEditorBannerTimer); _veFEAEditorBannerTimer = null; }

  var palette = ({
    success: { bg: 'rgba(34,197,94,0.18)',  border: '#22c55e', color: '#86efac', icon: '✓' },
    error:   { bg: 'rgba(239,68,68,0.18)',  border: '#ef4444', color: '#fca5a5', icon: '✗' },
    warning: { bg: 'rgba(245,158,11,0.18)', border: '#f59e0b', color: '#fcd34d', icon: '⚠' },
    info:    { bg: 'rgba(59,130,246,0.18)', border: '#3b82f6', color: '#93c5fd', icon: 'ℹ' }
  })[type] || { bg: 'rgba(59,130,246,0.18)', border: '#3b82f6', color: '#93c5fd', icon: 'ℹ' };

  var banner = document.createElement('div');
  banner.id = 've-fea-mesh-banner';
  banner.style.cssText = 'position:absolute; top:14px; left:50%; transform:translateX(-50%); z-index:11; min-width:320px; max-width:80%; padding:11px 18px; background:' + palette.bg + '; border:1px solid ' + palette.border + '; backdrop-filter:blur(8px); display:flex; align-items:center; gap:12px; animation:ve-fea-slide-down 0.22s ease-out; box-shadow:0 4px 20px rgba(0,0,0,0.35);';
  banner.innerHTML =
    '<div style="font-size:1.2rem; color:' + palette.border + '; font-weight:700; line-height:1;">' + palette.icon + '</div>' +
    '<div style="flex:1;">' +
      '<div style="font-size:0.74rem; font-weight:600; color:' + palette.color + ';">' + message + '</div>' +
      (subMessage ? '<div style="font-size:0.6rem; color:rgba(255,255,255,0.6); margin-top:2px;">' + subMessage + '</div>' : '') +
    '</div>' +
    '<button data-banner-close style="background:transparent; border:none; color:rgba(255,255,255,0.6); font-size:1rem; cursor:pointer; padding:0 4px;">✕</button>';
  var modalBox = _veFEAEditorOverlay.firstElementChild;
  if (modalBox) {
    if (getComputedStyle(modalBox).position === 'static') modalBox.style.position = 'relative';
    modalBox.appendChild(banner);
  } else {
    _veFEAEditorOverlay.appendChild(banner);
  }
  var closeBtn = banner.querySelector('[data-banner-close]');
  if (closeBtn) closeBtn.addEventListener('click', function() {
    if (banner.parentNode) banner.parentNode.removeChild(banner);
    if (_veFEAEditorBannerTimer) { clearTimeout(_veFEAEditorBannerTimer); _veFEAEditorBannerTimer = null; }
  });
  // Auto-dismiss
  var dismissMs = (type === 'success') ? 4500 : 6500; // error daha uzun kalsin
  _veFEAEditorBannerTimer = setTimeout(function() {
    if (banner.parentNode) {
      banner.style.transition = 'opacity 0.3s ease-out';
      banner.style.opacity = '0';
      setTimeout(function() { if (banner.parentNode) banner.parentNode.removeChild(banner); }, 320);
    }
    _veFEAEditorBannerTimer = null;
  }, dismissMs);
}

// ─── Modal kapat ───────────────────────────────────────────────────────────
function veFEACloseMeshEditor() {
  if (!_veFEAEditorActive) return;
  // ResizeObserver disconnect (canvas dispose'undan önce)
  if (_veFEAEditorResizeObserver) {
    try { _veFEAEditorResizeObserver.disconnect(); } catch (e) {}
    _veFEAEditorResizeObserver = null;
  }
  // Viewer dispose — canvas modal'la birlikte kaybolacak
  if (typeof veFEAViewerRegistry !== 'undefined' && veFEAViewerRegistry[_veFEAEditorActive]) {
    try { veFEAViewerRegistry[_veFEAEditorActive].dispose(); } catch (e) {}
    delete veFEAViewerRegistry[_veFEAEditorActive];
  }
  // Aktif loading overlay / banner'ı modal kaldırılmadan önce temizle
  _veFEAEditorLoadingEl = null;
  if (_veFEAEditorBannerTimer) { clearTimeout(_veFEAEditorBannerTimer); _veFEAEditorBannerTimer = null; }
  if (_veFEAEditorOverlay && _veFEAEditorOverlay.parentNode) {
    _veFEAEditorOverlay.parentNode.removeChild(_veFEAEditorOverlay);
  }
  if (_veFEAEditorEscHandler) {
    document.removeEventListener('keydown', _veFEAEditorEscHandler);
  }
  _veFEAEditorActive = null;
  _veFEAEditorOverlay = null;
  _veFEAEditorEscHandler = null;
  // Outline modülünü pasifleştir
  if (typeof FEAMeshOutline !== 'undefined' && typeof FEAMeshOutline.deactivate === 'function') {
    try { FEAMeshOutline.deactivate(); } catch (e) {}
  }
  // Side panel'i tazele (mesh durumu güncellenmiş olabilir)
  if (typeof nodes !== 'undefined' && typeof showNodeProperties === 'function') {
    var node = nodes.find(function(n) { return n.id === arguments[0]; });
    if (node) showNodeProperties(node);
  }
}

// ─── Accordion bölümünü aç/kapat ───────────────────────────────────────────
function veFEAToggleAccordion(sectionKey) {
  if (!_veFEAEditorActive) return;
  _veFEAEditorAccordionState[sectionKey] = !_veFEAEditorAccordionState[sectionKey];
  // node.data'ya persist
  if (typeof nodes !== 'undefined') {
    var node = nodes.find(function(n) { return n.id === _veFEAEditorActive; });
    if (node) {
      node.data = node.data || {};
      node.data.editorAccordion = _veFEAEditorAccordionState;
      if (typeof saveState === 'function') saveState();
    }
  }
  // Sadece tetiklenen bölümün body'sini toggle et — viewer/state korunur
  var body = document.getElementById('ve-fea-acc-body-' + sectionKey);
  var arrow = document.getElementById('ve-fea-acc-arrow-' + sectionKey);
  if (body) body.style.display = _veFEAEditorAccordionState[sectionKey] ? 'block' : 'none';
  if (arrow) arrow.textContent = _veFEAEditorAccordionState[sectionKey] ? '▼' : '▶';
}

// ═══════════════════════════════════════════════════════════════════════════
// HEADER / TOOLBAR / FOOTER builder'ları
// ═══════════════════════════════════════════════════════════════════════════
function _veFEAEditorBuildHeader(node) {
  var header = document.createElement('div');
  header.id = 've-fea-mesh-editor-header';
  header.style.cssText = 'display:flex; align-items:center; justify-content:space-between; gap:10px; padding:5px 14px; background:var(--bg-tertiary); border-bottom:1px solid var(--border-color); flex-shrink:0;';
  var nodeLabel = node.customName || (node.def && node.def.name) || 'Yapısal Analiz';
  var isModule = (node.type === 'fea');
  var titleText = isModule ? '🔷 Yapısal Analiz Editörü' : '🔷 Mesh Editörü';

  // Header'da sağ üstte "Mesh Oluştur" aksiyonu (kullanıcı isteği) — ağacın
  // neresinde olunursa olsun her zaman erişilebilir. Ayarlar persist-on-change
  // ile state'te tutulduğu için DOM input'a bağımlı değil.
  var d = node.data || {};
  var hasMesh = !!d.meshActive;
  var geomOk = false;
  if (typeof veFEAFindUpstreamGeometryNode === 'function') {
    var gn = veFEAFindUpstreamGeometryNode(node.id);
    geomOk = !!(gn && gn.data && gn.data.geometry && gn.data.geometry.type);
  }
  var buildLabel = hasMesh ? '↻ Yeniden Oluştur' : '▶ Mesh Oluştur';
  var buildStyle = geomOk
    ? 'background:var(--accent-primary); color:#fff; cursor:pointer;'
    : 'background:var(--bg-tertiary); color:var(--text-muted); cursor:not-allowed;';
  var buildBtn = '<button id="ve-fea-header-build-' + node.id + '" ' + (geomOk ? '' : 'disabled ') +
    'onclick="veFEASubmitMeshBuild(\'' + node.id + '\')" title="' + (geomOk ? 'Mesh oluştur (genel boyut + lokal kontroller)' : 'Önce Geometri tanımlayın') + '" ' +
    'style="padding:5px 12px; font-size:0.66rem; font-weight:700; border:1px solid var(--border-color); ' + buildStyle + '">' + buildLabel + '</button>';
  var clearBtn = hasMesh
    ? '<button onclick="veFEAClearMeshForNode(\'' + node.id + '\')" title="Mesh\'i sil" style="padding:5px 9px; font-size:0.62rem; background:transparent; color:var(--accent-danger); border:1px solid var(--accent-danger); cursor:pointer;">🗑</button>'
    : '';

  header.innerHTML = '<div style="display:flex; align-items:center; gap:8px; min-width:0;">' +
    '<div style="font-size:0.8rem; font-weight:700; color:var(--text-heading); white-space:nowrap;">' + titleText + '</div>' +
    '<div style="font-size:0.6rem; color:var(--text-muted); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">— ' + nodeLabel + ' (' + node.id + ')</div>' +
    '</div>' +
    '<div style="display:flex; align-items:center; gap:8px; flex-shrink:0;">' +
      buildBtn + clearBtn +
      '<button onclick="veFEACloseMeshEditor()" title="Kapat (ESC)" style="width:26px; height:26px; display:flex; align-items:center; justify-content:center; background:transparent; border:1px solid var(--border-color); cursor:pointer; font-size:0.9rem; color:var(--text-secondary); transition:all 0.12s;" onmouseover="this.style.background=\'var(--accent-danger)\';this.style.color=\'#fff\';this.style.borderColor=\'var(--accent-danger)\'" onmouseout="this.style.background=\'transparent\';this.style.color=\'var(--text-secondary)\';this.style.borderColor=\'var(--border-color)\'">✕</button>' +
    '</div>';
  return header;
}

function _veFEAEditorBuildToolbar(node) {
  var d = node.data || {};
  var settings = d.meshSettings || { size: 10 };
  var hasMesh = !!d.meshActive;
  // Upstream geometri var mı?
  var geomOk = false;
  if (typeof veFEAFindUpstreamGeometryNode === 'function') {
    var gn = veFEAFindUpstreamGeometryNode(node.id);
    geomOk = !!(gn && gn.data && gn.data.geometry && gn.data.geometry.type);
  }

  var toolbar = document.createElement('div');
  toolbar.id = 've-fea-mesh-editor-toolbar';
  toolbar.style.cssText = 'display:flex; align-items:center; gap:8px; padding:8px 14px; background:var(--bg-secondary); border-bottom:1px solid var(--border-color); flex-shrink:0; flex-wrap:wrap;';

  // Mesh Oluştur (primary)
  var buildBtnStyle = geomOk
    ? 'background:var(--accent-primary); color:#fff; cursor:pointer;'
    : 'background:var(--bg-tertiary); color:var(--text-muted); cursor:not-allowed;';
  toolbar.innerHTML = '<button ' + (geomOk ? '' : 'disabled ') +
    'onclick="veFEASubmitMeshBuild(\'' + node.id + '\')" style="padding:7px 14px; font-size:0.7rem; font-weight:700; border:1px solid var(--border-color); ' + buildBtnStyle + '">▶ Mesh Oluştur</button>';

  // Mesh boyu input (toolbar'da hızlı erişim)
  toolbar.innerHTML += '<span style="font-size:0.62rem; color:var(--text-muted);">Boyut:</span>' +
    '<input id="ve-fea-mesh-size-' + node.id + '" type="number" min="0.5" max="500" step="0.5" value="' + settings.size + '" style="width:72px; padding:5px 8px; font-size:0.66rem; background:var(--bg-input); color:var(--text-primary); border:1px solid var(--border-color);">' +
    '<span style="font-size:0.6rem; color:var(--text-muted);">mm</span>';

  // Presetler
  toolbar.innerHTML += '<div style="display:flex; gap:0; margin-left:6px;">' +
    '<button onclick="veFEASetMeshSizePreset(\'' + node.id + '\', 20)" style="padding:5px 10px; font-size:0.62rem; background:var(--bg-tertiary); color:var(--text-primary); border:1px solid var(--border-color); cursor:pointer;">Coarse</button>' +
    '<button onclick="veFEASetMeshSizePreset(\'' + node.id + '\', 10)" style="padding:5px 10px; font-size:0.62rem; background:var(--bg-tertiary); color:var(--text-primary); border:1px solid var(--border-color); border-left:none; cursor:pointer;">Medium</button>' +
    '<button onclick="veFEASetMeshSizePreset(\'' + node.id + '\', 5)" style="padding:5px 10px; font-size:0.62rem; background:var(--bg-tertiary); color:var(--text-primary); border:1px solid var(--border-color); border-left:none; cursor:pointer;">Fine</button>' +
    '</div>';

  toolbar.innerHTML += '<span style="flex:1;"></span>';

  // Mesh sil (mesh varsa)
  if (hasMesh) {
    toolbar.innerHTML += '<button onclick="veFEAClearMeshForNode(\'' + node.id + '\')" style="padding:6px 10px; font-size:0.62rem; background:var(--bg-tertiary); color:var(--accent-danger); border:1px solid var(--accent-danger); cursor:pointer;"><span class="mf-ico mf-ico-trash"></span> Mesh\'i Sil</button>';
  }

  return toolbar;
}

function _veFEAEditorBuildFooter(node) {
  var d = node.data || {};
  var metrics = d.meshMetrics;
  var hasMesh = !!(d.meshActive && metrics);
  var footer = document.createElement('div');
  footer.id = 've-fea-mesh-editor-footer';
  footer.style.cssText = 'display:flex; align-items:center; gap:12px; padding:6px 14px; background:var(--bg-tertiary); border-top:1px solid var(--border-color); flex-shrink:0; font-size:0.6rem; color:var(--text-muted);';
  if (hasMesh) {
    var jacStatus = (metrics.jacobian && metrics.jacobian.valid) ? '<span style="color:var(--accent-success, #22c55e);">✓ Geçerli</span>' : (metrics.jacobian ? '<span style="color:var(--accent-danger, #ef4444);">✗ Hatalı</span>' : '');
    footer.innerHTML =
      jacStatus +
      '<span style="opacity:0.4;">│</span>' +
      '<span>' + metrics.nodeCount.toLocaleString('tr-TR') + ' düğüm</span>' +
      '<span style="opacity:0.4;">│</span>' +
      '<span>' + metrics.elementCount.toLocaleString('tr-TR') + ' eleman</span>' +
      '<span style="opacity:0.4;">│</span>' +
      '<span>' + (metrics.computeMs || 0) + ' ms</span>' +
      '<span style="margin-left:auto;">ESC — Kapat</span>';
  } else {
    footer.innerHTML = '<span>Henüz mesh hesaplanmadı</span><span style="margin-left:auto;">ESC — Kapat</span>';
  }
  return footer;
}

// ═══════════════════════════════════════════════════════════════════════════
// SOL PANEL — ANSYS-tarz Outline + Details Split (Faz 3a→b refactor)
// ═══════════════════════════════════════════════════════════════════════════
// Eski accordion düzeni (~v1) ANSYS Workbench'in Tree Outline'ına dönüştürüldü:
//   ÜST: outline tree (Globals, Lokal Kontroller, Topoloji Araçları, İnceleme)
//   ALT: details pane — outline'da seçilen düğümün formu
// Kullanıcı vertical splitter ile oranı ayarlar; oran node.data.meshSettings.
// outline.splitPct olarak persist edilir.
function _veFEAEditorBuildLeftPanel(node) {
  var panel = document.createElement('div');
  panel.id = 've-fea-mesh-editor-left-panel';
  panel.style.cssText = 'flex:0 0 420px; min-width:300px; max-width:780px; background:var(--bg-primary, #0a0d14); border-right:1px solid var(--border-color); display:flex; flex-direction:column; overflow:hidden;';

  // Outline modülünü bu mesh node için aktive et (state + active-node-id set)
  if (typeof FEAMeshOutline !== 'undefined' && typeof FEAMeshOutline.init === 'function') {
    FEAMeshOutline.init(node.id);
  }

  // Split oranı (persist edilir)
  node.data = node.data || {};
  node.data.meshSettings = node.data.meshSettings || {};
  var outlineState = node.data.meshSettings.outline;
  var splitPct = (outlineState && isFinite(outlineState.splitPct) && outlineState.splitPct >= 15 && outlineState.splitPct <= 85)
    ? outlineState.splitPct : 50;

  // Outline header
  var outlineHeader = document.createElement('div');
  outlineHeader.id = 've-fea-outline-header';
  outlineHeader.style.cssText = 'display:flex; align-items:center; justify-content:space-between; padding:6px 10px; background:var(--bg-tertiary); border-bottom:1px solid var(--border-color); font-size:0.58rem; font-weight:700; color:var(--text-muted); letter-spacing:0.06em; text-transform:uppercase; flex-shrink:0;';
  outlineHeader.innerHTML = '<span>▣ Mesh Outline</span>' +
    '<span style="font-weight:600; font-size:0.5rem; color:var(--text-muted); letter-spacing:0.04em;">ANSYS §2.4 Tree</span>';
  panel.appendChild(outlineHeader);

  // Outline container
  var outlineContainer = document.createElement('div');
  outlineContainer.id = 've-fea-outline-container';
  outlineContainer.style.cssText = 'flex:' + splitPct + ' ' + splitPct + ' 0; min-height:80px; overflow-y:auto; overflow-x:hidden; background:var(--bg-primary);';
  outlineContainer.innerHTML = (typeof FEAMeshOutline !== 'undefined' && typeof FEAMeshOutline.render === 'function')
    ? FEAMeshOutline.render() : '<div style="padding:14px; color:var(--text-muted); font-size:0.62rem;">Outline modülü yüklenmedi.</div>';
  panel.appendChild(outlineContainer);

  // Vertical splitter (outline ↔ details)
  panel.appendChild(_veFEABuildVerticalSplitter());

  // Details header
  var detailsHeader = document.createElement('div');
  detailsHeader.id = 've-fea-details-header';
  detailsHeader.style.cssText = 'display:flex; align-items:center; justify-content:space-between; padding:6px 10px; background:var(--bg-tertiary); border-bottom:1px solid var(--border-color); font-size:0.58rem; font-weight:700; color:var(--text-muted); letter-spacing:0.06em; text-transform:uppercase; flex-shrink:0;';
  detailsHeader.innerHTML = '<span><span class="mf-ico mf-ico-settings"></span> Details</span>' +
    '<span style="font-weight:600; font-size:0.5rem; color:var(--text-muted); letter-spacing:0.04em;">Seçili nesnenin ayarları</span>';
  panel.appendChild(detailsHeader);

  // Details container
  var detailsContainer = document.createElement('div');
  detailsContainer.id = 've-fea-details-container';
  detailsContainer.style.cssText = 'flex:' + (100 - splitPct) + ' ' + (100 - splitPct) + ' 0; min-height:120px; overflow-y:auto; overflow-x:hidden; background:var(--bg-primary);';
  detailsContainer.innerHTML = (typeof FEAMeshOutline !== 'undefined' && typeof FEAMeshOutline.renderDetails === 'function')
    ? FEAMeshOutline.renderDetails() : '';
  panel.appendChild(detailsContainer);

  return panel;
}

// Vertical splitter — outline ↔ details oranını sürükleyerek değiştir
function _veFEABuildVerticalSplitter() {
  var splitter = document.createElement('div');
  splitter.id = 've-fea-outline-vsplitter';
  splitter.style.cssText = 'flex:0 0 4px; height:4px; background:var(--border-color); cursor:row-resize; position:relative;';
  splitter.title = 'Outline ↔ Details oranını değiştir';
  splitter.addEventListener('mouseenter', function() { splitter.style.background = 'var(--accent-primary, #3b82f6)'; });
  splitter.addEventListener('mouseleave', function() { splitter.style.background = 'var(--border-color)'; });
  splitter.addEventListener('mousedown', function(startEvt) {
    startEvt.preventDefault();
    var panel = document.getElementById('ve-fea-mesh-editor-left-panel');
    var outline = document.getElementById('ve-fea-outline-container');
    var details = document.getElementById('ve-fea-details-container');
    if (!panel || !outline || !details) return;
    var rect = panel.getBoundingClientRect();
    var totalH = rect.height;
    function onMove(e) {
      var localY = e.clientY - rect.top;
      // Outline'in başlık+container+splitter'in arası: outline header alanını çıkart
      // Pragmatik: rect.top → toplam alan; sadece oran hesabı için yeterli
      var pct = ((localY / totalH) * 100);
      if (pct < 15) pct = 15;
      if (pct > 85) pct = 85;
      outline.style.flex = pct + ' ' + pct + ' 0';
      details.style.flex = (100 - pct) + ' ' + (100 - pct) + ' 0';
      // Persist
      if (typeof nodes !== 'undefined' && _veFEAEditorActive) {
        var n = nodes.find(function(x) { return x.id === _veFEAEditorActive; });
        if (n && n.data && n.data.meshSettings) {
          n.data.meshSettings.outline = n.data.meshSettings.outline || {};
          n.data.meshSettings.outline.splitPct = Math.round(pct);
        }
      }
    }
    function onUp() {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      if (typeof saveState === 'function') {
        try { saveState(); } catch (e) {}
      }
    }
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  });
  return splitter;
}

// Pre/Post-mesh grup başlığı — accordion bölümleri arasında görsel ayraç.
function _veFEAEditorGroupHeader(label) {
  return '<div style="padding:6px 14px 5px; background:var(--bg-primary); border-bottom:1px solid var(--border-color); font-size:0.58rem; font-weight:700; color:var(--text-muted); letter-spacing:0.06em; text-transform:uppercase;">' +
    label + '</div>';
}

function _veFEAEditorAccordionSection(key, title, bodyHTML) {
  var open = _veFEAEditorAccordionState[key];
  var arrow = open ? '▼' : '▶';
  var bodyStyle = 'padding:10px 14px; background:var(--bg-secondary); display:' + (open ? 'block' : 'none') + ';';
  return '' +
    '<div data-acc-section="' + key + '" style="border-bottom:1px solid var(--border-color);">' +
      '<button onclick="veFEAToggleAccordion(\'' + key + '\')" style="display:flex; align-items:center; justify-content:space-between; width:100%; padding:8px 12px; background:var(--bg-tertiary); border:none; border-bottom:1px solid var(--border-color); cursor:pointer; font-size:0.72rem; font-weight:600; color:var(--text-heading); text-align:left;">' +
        '<span>' + title + '</span>' +
        '<span id="ve-fea-acc-arrow-' + key + '" style="font-size:0.6rem; color:var(--text-secondary);">' + arrow + '</span>' +
      '</button>' +
      '<div id="ve-fea-acc-body-' + key + '" style="' + bodyStyle + '">' +
        bodyHTML +
      '</div>' +
    '</div>';
}

// ─── SAĞ PANEL (3D Viewer) ─────────────────────────────────────────────────
function _veFEAEditorBuildRightPanel(node) {
  var panel = document.createElement('div');
  panel.id = 've-fea-mesh-editor-right-panel';
  panel.style.cssText = 'flex:1; min-width:300px; display:flex; flex-direction:column; background:#0a0a0a;';
  var nid = node.id;
  var clipUI = _veFEAEditorBuildClipControls(nid);
  // ANSYS-style view toolbar: Standart görünümler (Iso/Top/Bot/Front/Back/Left/Right)
  // + Previous/Next view (history) + Display mode + Sığdır + Kesit.
  var btnStyle = 'padding:4px 7px; font-size:0.6rem; background:var(--bg-tertiary); color:var(--text-primary); border:1px solid var(--border-color); cursor:pointer; min-width:30px;';
  var viewToolbar = '<div style="display:flex; align-items:center; gap:4px; padding:6px 10px; background:var(--bg-secondary); border-bottom:1px solid var(--border-color); flex-shrink:0; flex-wrap:wrap;">' +
    '<button onclick="veFEAEditorViewerAction(\'' + nid + '\',\'fit\')" style="' + btnStyle + '" title="Tümünü pencereye sığdır">⛶</button>' +
    '<div style="display:flex; gap:0; margin-left:4px;">' +
      '<button onclick="veFEAEditorViewerAction(\'' + nid + '\',\'view-iso\')"    style="' + btnStyle + '" title="İzometrik görünüm">Iso</button>' +
      '<button onclick="veFEAEditorViewerAction(\'' + nid + '\',\'view-front\')"  style="' + btnStyle + 'border-left:none;" title="Ön görünüm (+Z)">F</button>' +
      '<button onclick="veFEAEditorViewerAction(\'' + nid + '\',\'view-back\')"   style="' + btnStyle + 'border-left:none;" title="Arka görünüm (-Z)">Bk</button>' +
      '<button onclick="veFEAEditorViewerAction(\'' + nid + '\',\'view-top\')"    style="' + btnStyle + 'border-left:none;" title="Üst görünüm (+Y)">↑</button>' +
      '<button onclick="veFEAEditorViewerAction(\'' + nid + '\',\'view-bottom\')" style="' + btnStyle + 'border-left:none;" title="Alt görünüm (-Y)">↓</button>' +
      '<button onclick="veFEAEditorViewerAction(\'' + nid + '\',\'view-left\')"   style="' + btnStyle + 'border-left:none;" title="Sol görünüm (-X)">←</button>' +
      '<button onclick="veFEAEditorViewerAction(\'' + nid + '\',\'view-right\')"  style="' + btnStyle + 'border-left:none;" title="Sağ görünüm (+X)">→</button>' +
    '</div>' +
    '<div style="display:flex; gap:0; margin-left:4px;">' +
      '<button id="ve-fea-prev-view-' + nid + '" onclick="veFEAEditorViewerAction(\'' + nid + '\',\'prev-view\')" style="' + btnStyle + '" title="Önceki görünüm">◀</button>' +
      '<button id="ve-fea-next-view-' + nid + '" onclick="veFEAEditorViewerAction(\'' + nid + '\',\'next-view\')" style="' + btnStyle + 'border-left:none;" title="Sonraki görünüm">▶</button>' +
    '</div>' +
    '<button id="ve-fea-disp-mode-' + nid + '" onclick="veFEAEditorViewerAction(\'' + nid + '\',\'display-mode\')" style="' + btnStyle + 'margin-left:4px;" title="Render modu: Shaded / Edges / Wireframe">Shaded</button>' +
    '<button id="ve-fea-pointer-mode-' + nid + '" onclick="veFEAEditorViewerAction(\'' + nid + '\',\'pointer-mode\')" style="' + btnStyle + 'margin-left:4px;" title="Pointer modu: View / Face Pick / Body Pick">⊞ View</button>' +
    '<button id="ve-fea-scan-topo-' + nid + '" onclick="veFEAEditorViewerAction(\'' + nid + '\',\'scan-topology\')" style="' + btnStyle + 'margin-left:4px; border-color:rgba(34,197,94,0.5); color:#22c55e;" title="Topoloji Motoru: tüm yüzey/kenar/köşeleri yeniden tara">🔄 Topolojiyi Tara</button>' +
    '<span style="font-size:0.55rem; color:var(--text-muted); margin-left:6px;">LMB: seç · MMB: döndür · RMB: pan · wheel: zoom</span>' +
    clipUI +
    '</div>';
  panel.innerHTML = viewToolbar +
    // Hit-point + cursor coordinate overlay (canvas üstünde absolute)
    '<div style="flex:1; position:relative; min-height:0; background:#1a1a1a;">' +
      '<canvas id="ve-fea-mesh-canvas-' + nid + '" style="display:block; width:100%; height:100%; cursor:default;"></canvas>' +
      '<div id="ve-fea-hit-coord-' + nid + '" style="position:absolute; bottom:8px; left:8px; padding:4px 8px; background:rgba(0,0,0,0.65); color:#fbbf24; font-size:0.6rem; font-family:monospace; pointer-events:none; display:none; border:1px solid #444;"></div>' +
      '<div id="ve-fea-depth-stack-' + nid + '" style="position:absolute; bottom:8px; right:8px; display:none; gap:2px; flex-direction:column;"></div>' +
    '</div>';
  return panel;
}

// ANSYS-style viewer action dispatcher — toolbar button → viewer method
function veFEAEditorViewerAction(nodeId, action) {
  if (typeof veFEAViewerRegistry === 'undefined') return;
  var viewer = veFEAViewerRegistry[nodeId];
  if (!viewer) return;
  if (action === 'fit') { viewer.fitToGeometry(); _veFEAEditorRefreshHistoryButtons(nodeId); return; }
  if (action.indexOf('view-') === 0) {
    var view = action.substring(5);
    if (typeof viewer.setStandardView === 'function') viewer.setStandardView(view);
    _veFEAEditorRefreshHistoryButtons(nodeId);
    return;
  }
  if (action === 'prev-view') { if (viewer.previousView) viewer.previousView(); _veFEAEditorRefreshHistoryButtons(nodeId); return; }
  if (action === 'next-view') { if (viewer.nextView) viewer.nextView(); _veFEAEditorRefreshHistoryButtons(nodeId); return; }
  if (action === 'scan-topology') {
    // Manuel Topoloji Motoru taraması — node.data.topologyScanned reset + başlat
    if (typeof nodes !== 'undefined') {
      var n = nodes.find(function(nn) { return nn.id === nodeId; });
      if (n && n.data) n.data.topologyScanned = false;
    }
    if (typeof veFEAStartTopologyScan === 'function') {
      var ok = veFEAStartTopologyScan(nodeId, { auto: false });
      if (!ok && typeof showToast === 'function') {
        showToast('Topoloji taranamadı — önce bir geometri bağlayın.', 'warning');
      }
    }
    return;
  }
  if (action === 'display-mode') {
    var modes = ['shaded', 'shaded-edges', 'wireframe'];
    var labels = { 'shaded': 'Shaded', 'shaded-edges': 'Edges', 'wireframe': 'Wire' };
    var cur = viewer._displayMode || 'shaded';
    var next = modes[(modes.indexOf(cur) + 1) % modes.length];
    if (typeof viewer.setDisplayMode === 'function') viewer.setDisplayMode(next);
    var btn = document.getElementById('ve-fea-disp-mode-' + nodeId);
    if (btn) btn.textContent = labels[next];
    return;
  }
  if (action === 'pointer-mode') {
    // ANSYS-style pointer mode cycle — face/edge/vertex pick dahil
    var modes = ['view', 'face-pick', 'edge-pick', 'vertex-pick', 'box-select', 'body-pick', 'measure'];
    var labels = {
      view: '⊞ View',
      'face-pick': '⊡ Face Pick',
      'edge-pick': '📏 Edge Pick',
      'vertex-pick': '🔘 Vertex Pick',
      'box-select': '▭ Box Select',
      'body-pick': '⊠ Body Pick',
      measure: '⌖ Measure'
    };
    var cur = viewer._pointerMode || 'view';
    var next = modes[(modes.indexOf(cur) + 1) % modes.length];
    if (typeof viewer.setPointerMode === 'function') viewer.setPointerMode(next);
    var pbtn = document.getElementById('ve-fea-pointer-mode-' + nodeId);
    if (pbtn) pbtn.textContent = labels[next];
    return;
  }
  if (action === 'toggle-edge-overlay') {
    var em = viewer._edgeOverlayMode === 'off' ? 'all' : 'off';
    if (typeof viewer.setEdgeOverlayMode === 'function') viewer.setEdgeOverlayMode(em);
    return;
  }
  if (action === 'toggle-vertex-overlay') {
    var vm = viewer._vertexOverlayMode === 'off' ? 'all' : 'off';
    if (typeof viewer.setVertexOverlayMode === 'function') viewer.setVertexOverlayMode(vm);
    return;
  }
}

function _veFEAEditorRefreshHistoryButtons(nodeId) {
  if (typeof veFEAViewerRegistry === 'undefined') return;
  var viewer = veFEAViewerRegistry[nodeId];
  if (!viewer) return;
  var prevBtn = document.getElementById('ve-fea-prev-view-' + nodeId);
  var nextBtn = document.getElementById('ve-fea-next-view-' + nodeId);
  if (prevBtn) prevBtn.style.opacity = viewer.canGoPreviousView && viewer.canGoPreviousView() ? '1' : '0.4';
  if (nextBtn) nextBtn.style.opacity = viewer.canGoNextView     && viewer.canGoNextView()     ? '1' : '0.4';
}

// Kesit (clipping plane) UI — toolbar inline. Her eksen için: toggle button
// + slider (gizli, aktif olunca görünür). Slider'lar bbox'a göre min/max alır;
// veFEAEditorRefreshClipBounds mesh oluştuktan sonra çağrılır (bounds güncelle).
function _veFEAEditorBuildClipControls(nid) {
  var html = '<div style="display:flex; align-items:center; gap:4px; border-left:1px solid var(--border-color); padding-left:8px; margin-left:auto;">' +
    '<span style="font-size:0.58rem; color:var(--text-muted); margin-right:2px;">Kesit:</span>';
  ['x', 'y', 'z'].forEach(function(axis) {
    var up = axis.toUpperCase();
    html += '<button id="ve-fea-clip-btn-' + axis + '-' + nid + '" onclick="veFEAEditorToggleClip(\'' + nid + '\', \'' + axis + '\')" ' +
      'style="padding:4px 8px; font-size:0.62rem; font-weight:600; background:var(--bg-tertiary); color:var(--text-primary); border:1px solid var(--border-color); cursor:pointer; min-width:26px;" ' +
      'title="' + up + ' eksenine dik kesit düzlemi">' + up + '</button>';
  });
  html += '<button onclick="veFEAEditorResetClip(\'' + nid + '\')" ' +
    'style="padding:4px 8px; font-size:0.62rem; background:var(--bg-tertiary); color:var(--text-secondary); border:1px solid var(--border-color); cursor:pointer; margin-left:4px;" title="Tüm kesitleri sıfırla">⟲</button>';
  html += '</div>';
  // Slider satırı (ayrı bir satır olarak, toolbar wrap'inde)
  html += '<div id="ve-fea-clip-sliders-' + nid + '" style="display:none; flex-basis:100%; align-items:center; gap:10px; padding-top:6px; border-top:1px dashed var(--border-color); margin-top:4px;">';
  ['x', 'y', 'z'].forEach(function(axis) {
    var up = axis.toUpperCase();
    html += '<div id="ve-fea-clip-row-' + axis + '-' + nid + '" data-axis="' + axis + '" style="display:none; align-items:center; gap:6px; flex:1; min-width:0;">' +
      '<span style="font-size:0.58rem; color:var(--text-primary); font-weight:600; width:14px;">' + up + ':</span>' +
      '<input type="range" min="-100" max="100" step="0.1" value="0" ' +
        'id="ve-fea-clip-slider-' + axis + '-' + nid + '" ' +
        'oninput="veFEAEditorSetClipOffset(\'' + nid + '\', \'' + axis + '\', this.value)" ' +
        'style="flex:1; min-width:60px;">' +
      '<span id="ve-fea-clip-val-' + axis + '-' + nid + '" style="font-size:0.58rem; color:var(--text-muted); width:48px; text-align:right;">—</span>' +
      '</div>';
  });
  html += '</div>';
  return html;
}

// Kesit aksı toggle: button aktifse off et, değilse aç. Slider satırını da güncelle.
function veFEAEditorToggleClip(nodeId, axis) {
  var viewer = (typeof veFEAViewerRegistry !== 'undefined') ? veFEAViewerRegistry[nodeId] : null;
  if (!viewer || typeof viewer.setClipPlane !== 'function') return;
  var state = viewer._clipState && viewer._clipState[axis];
  if (!state) return;
  var newEnabled = !state.enabled;
  // Aktive ediyorsak: bbox merkezini default offset olarak ayarla
  var offset = state.offset;
  if (newEnabled && typeof viewer.getClipBoundsForAxis === 'function') {
    var b = viewer.getClipBoundsForAxis(axis);
    if (b && offset === 0) {
      offset = (b.min + b.max) / 2;
    }
  }
  viewer.setClipPlane(axis, newEnabled, offset);
  _veFEAEditorRefreshClipUI(nodeId);
}

// Slider değişimi: offset'i güncelle, viewer'ı yenile.
function veFEAEditorSetClipOffset(nodeId, axis, value) {
  var viewer = (typeof veFEAViewerRegistry !== 'undefined') ? veFEAViewerRegistry[nodeId] : null;
  if (!viewer) return;
  var v = parseFloat(value);
  if (!isFinite(v)) return;
  viewer.setClipPlane(axis, true, v);
  var label = document.getElementById('ve-fea-clip-val-' + axis + '-' + nodeId);
  if (label) label.textContent = v.toFixed(1) + ' mm';
}

// Tüm kesitleri kapat + offset 0'a getir.
function veFEAEditorResetClip(nodeId) {
  var viewer = (typeof veFEAViewerRegistry !== 'undefined') ? veFEAViewerRegistry[nodeId] : null;
  if (!viewer) return;
  ['x', 'y', 'z'].forEach(function(a) { viewer.setClipPlane(a, false, 0); });
  _veFEAEditorRefreshClipUI(nodeId);
}

// UI durumunu viewer state'ine senkronlar — buton renkleri + slider görünürlük.
function _veFEAEditorRefreshClipUI(nodeId) {
  var viewer = (typeof veFEAViewerRegistry !== 'undefined') ? veFEAViewerRegistry[nodeId] : null;
  if (!viewer || !viewer._clipState) return;
  var anyEnabled = false;
  ['x', 'y', 'z'].forEach(function(axis) {
    var st = viewer._clipState[axis];
    var btn = document.getElementById('ve-fea-clip-btn-' + axis + '-' + nodeId);
    var row = document.getElementById('ve-fea-clip-row-' + axis + '-' + nodeId);
    if (btn) {
      if (st.enabled) {
        btn.style.background = 'var(--accent-primary)';
        btn.style.color = '#fff';
        btn.style.borderColor = 'var(--accent-primary)';
        anyEnabled = true;
      } else {
        btn.style.background = 'var(--bg-tertiary)';
        btn.style.color = 'var(--text-primary)';
        btn.style.borderColor = 'var(--border-color)';
      }
    }
    if (row) row.style.display = st.enabled ? 'flex' : 'none';
    // Slider min/max + value senkronla
    if (st.enabled && typeof viewer.getClipBoundsForAxis === 'function') {
      var b = viewer.getClipBoundsForAxis(axis);
      var slider = document.getElementById('ve-fea-clip-slider-' + axis + '-' + nodeId);
      var label = document.getElementById('ve-fea-clip-val-' + axis + '-' + nodeId);
      if (slider && b) {
        slider.min = b.min;
        slider.max = b.max;
        slider.step = Math.max(0.1, (b.max - b.min) / 200);
        slider.value = st.offset;
      }
      if (label) label.textContent = st.offset.toFixed(1) + ' mm';
    }
  });
  var slidersContainer = document.getElementById('ve-fea-clip-sliders-' + nodeId);
  if (slidersContainer) slidersContainer.style.display = anyEnabled ? 'flex' : 'none';
}

// ─── DİKEY RESIZE HANDLE (sol panel genişliği) ─────────────────────────────
function _veFEAEditorBuildResizeHandle() {
  var handle = document.createElement('div');
  handle.id = 've-fea-mesh-editor-divider';
  handle.style.cssText = 'flex:0 0 5px; cursor:ew-resize; background:var(--border-color); transition:background 0.15s;';
  handle.addEventListener('mouseenter', function() { this.style.background = 'rgba(59,130,246,0.6)'; });
  handle.addEventListener('mouseleave', function() { this.style.background = 'var(--border-color)'; });
  handle.addEventListener('mousedown', function(e) {
    e.preventDefault();
    var startX = e.clientX;
    var leftPanel = document.getElementById('ve-fea-mesh-editor-left-panel');
    if (!leftPanel) return;
    var startW = leftPanel.offsetWidth;
    function onMove(ev) {
      var dx = ev.clientX - startX;
      var newW = Math.max(280, Math.min(720, startW + dx));
      leftPanel.style.flexBasis = newW + 'px';
      // Viewer'a tekrar size signal at
      if (typeof veFEAViewerRegistry !== 'undefined' && _veFEAEditorActive && veFEAViewerRegistry[_veFEAEditorActive]) {
        var v = veFEAViewerRegistry[_veFEAEditorActive];
        var canvas = document.getElementById('ve-fea-mesh-canvas-' + _veFEAEditorActive);
        if (canvas && v.resize) v.resize(canvas.clientWidth || 1, canvas.clientHeight || 1);
      }
    }
    function onUp() {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    }
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  });
  return handle;
}

// Modal kenar resize (sol/sağ tutamaçlar — Rota pattern)
function _veFEAEditorAttachModalResize(modal, overlay) {
  var handleCSS = 'position:absolute; top:0; width:6px; height:100%; cursor:ew-resize; z-index:10; background:transparent; transition:background 0.15s;';
  var leftH = document.createElement('div');
  leftH.style.cssText = handleCSS + 'left:-3px;';
  var rightH = document.createElement('div');
  rightH.style.cssText = handleCSS + 'right:-3px;';
  [leftH, rightH].forEach(function(h) {
    h.addEventListener('mouseenter', function() { this.style.background = 'rgba(59,130,246,0.5)'; });
    h.addEventListener('mouseleave', function() { this.style.background = 'transparent'; });
  });
  function startResize(e, side) {
    e.preventDefault();
    e.stopPropagation();
    var startX = e.clientX;
    var startW = modal.offsetWidth;
    var overlayW = overlay.clientWidth;
    function onMove(ev) {
      var dx = ev.clientX - startX;
      var newW = side === 'left' ? startW - dx : startW + dx;
      newW = Math.max(720, Math.min(newW, overlayW - 32));
      modal.style.width = newW + 'px';
      modal.style.maxWidth = newW + 'px';
    }
    function onUp() {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    }
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }
  leftH.addEventListener('mousedown', function(e) { startResize(e, 'left'); });
  rightH.addEventListener('mousedown', function(e) { startResize(e, 'right'); });
  modal.appendChild(leftH);
  modal.appendChild(rightH);
}

// ═══════════════════════════════════════════════════════════════════════════
// ACCORDION İÇERİK BUILDER'LARI
// ═══════════════════════════════════════════════════════════════════════════
// (Mevcut cp-fea.js'teki control HTML'leri buraya taşındı)

// Face label resolver — kullanıcı custom rename yaptıysa onu, yoksa topology
// default label'ını döndür. ANSYS'de kullanıcı her yüze anlamlı isim verebilir
// (örn. "Sabit Mesnet Yüzü", "Yük Uygulanan Yüz").
function _veFEAResolveFaceLabel(node, faceId, defaultLabel) {
  if (!node || !node.data || !node.data.faceRenames) return defaultLabel;
  return node.data.faceRenames[faceId] || defaultLabel;
}

// Face rename bridge — UI'dan prompt ile çağrılır.
function veFEARenameGeometryFace(meshNodeId, faceId, defaultLabel) {
  if (typeof nodes === 'undefined') return;
  var meshNode = nodes.find(function(n) { return n.id === meshNodeId; });
  if (!meshNode) return;
  meshNode.data = meshNode.data || {};
  meshNode.data.faceRenames = meshNode.data.faceRenames || {};
  var current = meshNode.data.faceRenames[faceId] || defaultLabel || faceId;
  var input = (typeof prompt === 'function') ? prompt('Yüz için yeni isim:', current) : null;
  if (input === null) return; // iptal
  input = String(input).trim();
  if (input === '' || input === defaultLabel || input === faceId) {
    delete meshNode.data.faceRenames[faceId];
  } else {
    meshNode.data.faceRenames[faceId] = input;
  }
  if (typeof saveState === 'function') saveState();
  if (typeof veFEAEditorRefreshAccordions === 'function') veFEAEditorRefreshAccordions();
}

// Geometri Topolojisi — ANSYS-style "geometriyi/yüzeyleri tanımla → mesh at"
// workflow'unun ilk aşaması. Upstream Geometry node'undan topology okunur
// (mesh ÖNCESI tespit edilmiş face listesi).
// Topology accordion sekme state — Faces / Edges / Vertices arasında geçiş.
var _veFEATopologyTabState = {};  // { nodeId: 'faces' | 'edges' | 'vertices' }

function veFEAEditorSetTopologyTab(nodeId, tab) {
  _veFEATopologyTabState[nodeId] = tab;
  if (typeof veFEAEditorRefreshAccordions === 'function') veFEAEditorRefreshAccordions();
}

function _veFEAEditorTopologyHTML(node) {
  // Upstream geometri node'unu bul
  var geomNode = (typeof veFEAFindUpstreamGeometryNode === 'function')
    ? veFEAFindUpstreamGeometryNode(node.id) : null;
  if (!geomNode || !geomNode.data || !geomNode.data.geometry) {
    return '<div style="padding:8px 10px; background:var(--bg-primary); border:1px solid var(--border-color); font-size:0.62rem; color:var(--text-muted);">Upstream Geometri bağlantısı yok. Önce bir Geometri bileşeni tanımlayın ve bu Mesh node\'una bağlayın.</div>';
  }
  var geom = geomNode.data.geometry;
  // Topology henuz hesaplanmadiysa on-the-fly hesapla (eski projeler icin)
  var topo = geom.topology;
  if (!topo && typeof veFEAComputeGeometryTopology === 'function') {
    topo = veFEAComputeGeometryTopology(geom);
  }
  if (!topo || !topo.faces || topo.faces.length === 0) {
    return '<div style="padding:8px 10px; background:var(--bg-primary); border:1px solid var(--border-color); font-size:0.62rem; color:var(--text-muted);">Bu geometri tipinde topology bilgisi yok.</div>';
  }

  var html = '<div style="font-size:0.58rem; color:var(--text-muted); line-height:1.5; margin-bottom:8px;">' +
    'Mesh atmadan önce geometriden otomatik tespit edilen <b>yüzey / kenar / köşe</b> bilgisi. ' +
    'Her birine tıklayıp 3D viewer\'da seçebilir, lokal mesh ayarları (size, inflation, SOI) uygulayabilirsiniz.</div>';

  // Generic fallback notu — bilinmeyen tip Three.js mesh'inden otomatik analiz edildi
  if (topo.generic) {
    html += '<div style="padding:6px 8px; background:rgba(59,130,246,0.08); border:1px solid var(--accent-primary); margin-bottom:8px; font-size:0.58rem; color:var(--text-primary); line-height:1.45;">' +
      '<b>ℹ Otomatik Topology Analizi:</b> Bu geometri tipi (' + (geom.sourceLabel || geom.type) + ') için ' +
      'tip-spesifik topology fonksiyonu yok. Three.js mesh\'inden normal-clustering ile düzlemsel yüzeyler ' +
      'otomatik tespit edildi; eğri yüzeyler "Triangulated" olarak işaretlendi. Üretilen face\'ler local sizing ' +
      've BC uygulamak için kullanılabilir.' +
      '</div>';
  }

  // Özet kutusu — alan/hacim/face/edge/vertex sayıları + tip etiketi
  function _fmtArea(a)  { return a >= 1e6 ? (a/1e6).toFixed(2)+' m²' : a >= 1e4 ? (a/1e4).toFixed(2)+' dm²' : a >= 1e2 ? (a/1e2).toFixed(2)+' cm²' : a.toFixed(1)+' mm²'; }
  function _fmtVol(v)   { return v >= 1e9 ? (v/1e9).toFixed(3)+' m³' : v >= 1e6 ? (v/1e6).toFixed(2)+' dm³' : v >= 1e3 ? (v/1e3).toFixed(2)+' cm³' : v.toFixed(1)+' mm³'; }
  function _fmtLen(l)   { return l >= 1000 ? (l/1000).toFixed(2)+' m' : l >= 10 ? l.toFixed(1)+' mm' : l.toFixed(2)+' mm'; }
  // Yüzey tipi dağılımı (kaç tane planar, cylindrical, vs.)
  var typeCounts = {};
  topo.faces.forEach(function(f) { typeCounts[f.type] = (typeCounts[f.type] || 0) + 1; });
  var typeBreakdown = Object.keys(typeCounts).map(function(t) {
    var lbl = (typeof veFEATopologyFaceTypeLabel === 'function') ? veFEATopologyFaceTypeLabel(t) : t;
    return typeCounts[t] + '× ' + lbl;
  }).join(' · ');
  var bbox = topo.bbox || { x: 0, y: 0, z: 0 };

  var edgeCount = (typeof veFEATopologyEdgeCount === 'function') ? veFEATopologyEdgeCount(topo) : (topo.edges ? topo.edges.count : 0);
  var vertexCount = (typeof veFEATopologyVertexCount === 'function') ? veFEATopologyVertexCount(topo) : (topo.vertices ? topo.vertices.count : 0);
  html += '<div style="padding:8px 10px; background:var(--bg-primary); border:1px solid var(--border-color); margin-bottom:8px; font-size:0.6rem;">' +
    '<div style="font-weight:600; color:var(--text-heading); margin-bottom:4px; padding-bottom:3px; border-bottom:1px solid var(--border-color);"><span class="mf-ico mf-ico-ruler"></span> Geometri Özeti</div>' +
    '<div style="display:grid; grid-template-columns:1fr 1fr; gap:3px 12px;">' +
      '<span style="color:var(--text-secondary);">Geometri tipi</span><span style="text-align:right; font-weight:600;">' + (geom.sourceLabel || geom.type) + '</span>' +
      '<span style="color:var(--text-secondary);">Yüzey sayısı</span><span style="text-align:right; font-weight:600;">' + topo.faces.length + '</span>' +
      '<span style="color:var(--text-secondary);">Kenar sayısı</span><span style="text-align:right; font-weight:600;">' + edgeCount + '</span>' +
      '<span style="color:var(--text-secondary);">Köşe sayısı</span><span style="text-align:right; font-weight:600;">' + vertexCount + '</span>' +
      '<span style="color:var(--text-secondary);">Hacim</span><span style="text-align:right; font-weight:600;">' + _fmtVol(topo.volume || 0) + '</span>' +
      '<span style="color:var(--text-secondary);">Toplam yüzey alanı</span><span style="text-align:right; font-weight:600;">' + _fmtArea(topo.totalSurfaceArea || 0) + '</span>' +
      '<span style="color:var(--text-secondary);">Sınırlayıcı kutu</span><span style="text-align:right; font-weight:600;">' + _fmtLen(bbox.x) + ' × ' + _fmtLen(bbox.y) + ' × ' + _fmtLen(bbox.z) + '</span>' +
      '<span style="color:var(--text-secondary);">Yüzey tipi dağılımı</span><span style="text-align:right; font-weight:600; font-size:0.55rem;">' + typeBreakdown + '</span>' +
    '</div>' +
  '</div>';

  // ─── Sekme başlıkları (Faces / Edges / Vertices) ─────────────────────────
  var currentTab = _veFEATopologyTabState[node.id] || 'faces';
  function _tabBtn(key, lbl, count) {
    var active = (currentTab === key);
    var bg = active ? 'var(--accent-primary)' : 'var(--bg-tertiary)';
    var fg = active ? '#fff' : 'var(--text-secondary)';
    var bw = active ? 'var(--accent-primary)' : 'var(--border-color)';
    return '<button onclick="veFEAEditorSetTopologyTab(\'' + node.id + '\',\'' + key + '\')" style="flex:1; padding:6px 8px; background:' + bg + '; color:' + fg + '; border:1px solid ' + bw + '; font-size:0.6rem; font-weight:600; cursor:pointer;">' + lbl + ' <span style="opacity:0.7;">(' + count + ')</span></button>';
  }
  html += '<div style="display:flex; gap:0; margin-bottom:8px;">' +
    _tabBtn('faces',    '🎨 Yüzeyler', topo.faces.length) +
    _tabBtn('edges',    '📏 Kenarlar', edgeCount) +
    _tabBtn('vertices', '🔘 Köşeler',  vertexCount) +
  '</div>';

  if (currentTab === 'edges') {
    html += _veFEAEditorTopologyEdgesPanel(node, topo);
    return html;
  }
  if (currentTab === 'vertices') {
    html += _veFEAEditorTopologyVerticesPanel(node, topo);
    return html;
  }
  // currentTab === 'faces' (varsayılan)

  // Face listesi tablosu — her satır tıklanabilir (3D viewer'da face highlight)
  var selectedFaceId = node.data && node.data.selectedFaceId || null;
  var localSizingFaceId = (node.data && node.data.meshSettings && node.data.meshSettings.localSizing && node.data.meshSettings.localSizing.selection) || null;
  var localBiasActive = !!(node.data && node.data.meshSettings && node.data.meshSettings.localSizing &&
    ((node.data.meshSettings.localSizing.biasStrength || 0) > 0 ||
     (node.data.meshSettings.localSizing.biasMode === 'inflation' && (node.data.meshSettings.localSizing.firstLayerThickness || 0) > 0)));
  var faceRenames = (node.data && node.data.faceRenames) || {};
  html += '<div style="font-size:0.58rem; color:var(--text-secondary); margin-bottom:4px;">' +
    'Yüzeyler <span style="color:var(--text-muted);">(satıra tıkla → 3D\'de seç · ✏ → yeniden adlandır)</span>:</div>';
  topo.faces.forEach(function(f) {
    var typeLabel = (typeof veFEATopologyFaceTypeLabel === 'function') ? veFEATopologyFaceTypeLabel(f.type) : f.type;
    var typeColor = '#3b82f6';
    if (f.type === 'cylindrical') typeColor = '#8b5cf6';
    else if (f.type === 'planar-annular') typeColor = '#06b6d4';
    else if (f.type === 'triangulated') typeColor = '#f59e0b';
    var holeIcon = f.isHole ? '<span title="Delik / iç yüzey" style="color:#ef4444; margin-left:4px;">⌀</span>' : '';
    var extra = '';
    if (f.radius !== undefined) extra += ' · r=' + f.radius.toFixed(1) + 'mm';
    if (f.length !== undefined) extra += ' · L=' + f.length.toFixed(1) + 'mm';
    if (f.outerRadius !== undefined && f.innerRadius !== undefined) extra += ' · R=' + f.outerRadius.toFixed(1) + ' / r=' + f.innerRadius.toFixed(1) + 'mm';
    if (f.normal) extra += ' · n=[' + f.normal.map(function(v){return v.toFixed(0);}).join(',') + ']';

    var isSelected = (selectedFaceId === f.id);
    var hasLocal = localBiasActive && localSizingFaceId === f.id;
    var rowBg = isSelected ? '#fbbf2420' : 'var(--bg-tertiary)';
    var rowBorder = isSelected ? '#fbbf24' : 'var(--border-color)';
    var selIcon = isSelected ? '<span style="color:#fbbf24; margin-right:4px;">◉</span>' : '<span style="color:var(--text-muted); margin-right:4px;">○</span>';

    var customLabel = faceRenames[f.id];
    var displayLabel = customLabel || f.label;
    var labelHTML = customLabel
      ? '<span style="font-weight:600; color:#22c55e;" title="Yeniden adlandırıldı (varsayılan: ' + f.label + ')">' + customLabel + '</span>'
      : '<span style="font-weight:600; color:var(--text-primary);">' + f.label + '</span>';
    var localBadge = hasLocal
      ? '<span title="Bu yüze lokal yoğunlaştırma uygulanmış" style="font-size:0.5rem; padding:1px 5px; background:#a855f720; color:#a855f7; font-weight:600; margin-left:4px;">◆ LOKAL</span>'
      : '';

    html += '<div style="display:flex; align-items:stretch; margin-bottom:3px;">';
    // Ana satır butonu (face select + 3D highlight)
    html += '<button onclick="veFEASelectGeometryFace(\'' + node.id + '\', \'' + f.id + '\')" style="flex:1; text-align:left; padding:5px 8px; background:' + rowBg + '; border:1px solid ' + rowBorder + '; border-right:none; font-size:0.6rem; cursor:pointer; transition:background 0.12s;" onmouseover="this.style.background=\'' + (isSelected ? '#fbbf2435' : 'var(--bg-secondary)') + '\'" onmouseout="this.style.background=\'' + rowBg + '\'">' +
      '<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:2px;">' +
        '<span style="display:flex; align-items:center; gap:4px;">' +
          selIcon +
          '<span style="font-family:monospace; font-size:0.56rem; padding:1px 5px; background:var(--bg-primary); color:var(--text-muted);">' + f.id + '</span>' +
          labelHTML +
          holeIcon +
          localBadge +
        '</span>' +
        '<span style="font-size:0.52rem; padding:1px 6px; background:' + typeColor + '20; color:' + typeColor + '; font-weight:600;">' + typeLabel + '</span>' +
      '</div>' +
      '<div style="font-size:0.55rem; color:var(--text-muted); padding-left:18px;">' +
        'Alan: <b style="color:var(--text-secondary);">' + _fmtArea(f.area || 0) + '</b>' + extra +
      '</div>' +
    '</button>';
    // Yeniden adlandır (✏️) butonu
    var defaultLabelEsc = f.label.replace(/'/g, '\\\'');
    html += '<button onclick="veFEARenameGeometryFace(\'' + node.id + '\', \'' + f.id + '\', \'' + defaultLabelEsc + '\')" title="Yüzü yeniden adlandır" style="padding:0 8px; background:' + rowBg + '; border:1px solid ' + rowBorder + '; cursor:pointer; font-size:0.72rem; color:var(--text-muted);" onmouseover="this.style.color=\'#22c55e\'" onmouseout="this.style.color=\'var(--text-muted)\'"><span class="mf-ico mf-ico-edit"></span></button>';
    html += '</div>';
  });

  if (selectedFaceId) {
    html += '<div style="margin-top:6px; padding:5px 8px; background:#fbbf2418; border-left:3px solid #fbbf24; font-size:0.6rem; color:var(--text-primary);">' +
      '<b>Seçili yüz:</b> ' + selectedFaceId +
      ' <button onclick="veFEASelectGeometryFace(\'' + node.id + '\', null)" style="float:right; padding:1px 6px; font-size:0.52rem; background:var(--bg-tertiary); color:var(--text-muted); border:1px solid var(--border-color); cursor:pointer;">Seçimi Kaldır</button>' +
    '</div>';
  }

  html += '<div style="font-size:0.52rem; color:var(--text-muted); margin-top:6px; line-height:1.4;">' +
    'ℹ Mesh oluşturulduktan sonra her yüze ait düğümler <b>Atanmış Yüzeyler</b> bölümünde göz atılabilir. ' +
    'Sınır koşulları (F4) bu yüzeylere referansla uygulanır.</div>';

  return html;
}

// ─── EDGES panel — kenar listesi, tip filtreleme, 3D highlight ─────────────
function _veFEAEditorTopologyEdgesPanel(node, topo) {
  function _fmtLen(l) { return l >= 1000 ? (l/1000).toFixed(2)+' m' : l >= 10 ? l.toFixed(1)+' mm' : l.toFixed(2)+' mm'; }
  var edges = Array.isArray(topo.edges) ? topo.edges : [];
  if (edges.length === 0) {
    return '<div style="padding:10px 12px; background:rgba(245,158,11,0.08); border-left:2px solid #f59e0b; font-size:0.6rem; color:var(--text-secondary); line-height:1.5;">' +
      'Bu geometride tanımlı edge bilgisi yok. (Küre, torus gibi sınırsız manifoldlar veya generic mesh\'in henüz tanınamayan kısımları.)' +
    '</div>';
  }
  var selectedEdgeId = (node.data && node.data.selectedEdgeId) || null;
  // Tip dağılımı
  var tCounts = {};
  edges.forEach(function(e) { tCounts[e.type] = (tCounts[e.type] || 0) + 1; });
  var tBreakdown = Object.keys(tCounts).map(function(t) {
    var lbl = (typeof veFEATopologyEdgeTypeLabel === 'function') ? veFEATopologyEdgeTypeLabel(t) : t;
    return tCounts[t] + '× ' + lbl;
  }).join(' · ');
  var html = '<div style="font-size:0.55rem; color:var(--text-muted); margin-bottom:6px;">Tip dağılımı: <b>' + tBreakdown + '</b></div>';
  html += '<div style="font-size:0.58rem; color:var(--text-secondary); margin-bottom:4px;">Kenarlar <span style="color:var(--text-muted);">(satıra tıkla → 3D\'de sarı highlight)</span>:</div>';
  edges.forEach(function(e) {
    var isSel = (selectedEdgeId === e.id);
    var rowBg = isSel ? '#fbbf2420' : 'var(--bg-tertiary)';
    var rowBd = isSel ? '#fbbf24' : 'var(--border-color)';
    var typeLbl = (typeof veFEATopologyEdgeTypeLabel === 'function') ? veFEATopologyEdgeTypeLabel(e.type) : e.type;
    var typeColor = '#3b82f6';
    if (e.type === 'circle') typeColor = '#a855f7';
    else if (e.type === 'arc') typeColor = '#06b6d4';
    else if (e.type === 'ellipse') typeColor = '#ec4899';
    else if (e.type === 'spline') typeColor = '#f59e0b';
    var icon = isSel ? '<span style="color:#fbbf24; margin-right:4px;">◉</span>' : '<span style="color:var(--text-muted); margin-right:4px;">○</span>';
    var holeIcon = e.isHole ? '<span title="Delik kenarı" style="color:#ef4444; margin-left:4px;">⌀</span>' : '';
    var extra = '';
    if (e.radius !== undefined) extra += ' · r=' + e.radius.toFixed(1) + 'mm';
    if (e.type === 'arc' && e.startAngle !== undefined && e.endAngle !== undefined) {
      var sweep = Math.abs(e.endAngle - e.startAngle) * 180 / Math.PI;
      extra += ' · ' + sweep.toFixed(0) + '°';
    }
    html += '<button onclick="veFEASelectGeometryEdge(\'' + node.id + '\', \'' + e.id + '\')" style="display:block; width:100%; text-align:left; padding:5px 8px; background:' + rowBg + '; border:1px solid ' + rowBd + '; font-size:0.6rem; cursor:pointer; margin-bottom:3px; transition:background 0.12s;" onmouseover="this.style.background=\'' + (isSel ? '#fbbf2435' : 'var(--bg-secondary)') + '\'" onmouseout="this.style.background=\'' + rowBg + '\'">' +
      '<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:2px;">' +
        '<span style="display:flex; align-items:center; gap:4px;">' +
          icon +
          '<span style="font-family:monospace; font-size:0.55rem; padding:1px 5px; background:var(--bg-primary); color:var(--text-muted);">' + e.id + '</span>' +
          '<span style="font-weight:600; color:var(--text-primary);">' + (e.label || e.id) + '</span>' +
          holeIcon +
        '</span>' +
        '<span style="font-size:0.52rem; padding:1px 6px; background:' + typeColor + '20; color:' + typeColor + '; font-weight:600;">' + typeLbl + '</span>' +
      '</div>' +
      '<div style="font-size:0.55rem; color:var(--text-muted); padding-left:18px;">' +
        'Uzunluk: <b style="color:var(--text-secondary);">' + _fmtLen(e.length || 0) + '</b>' + extra +
        (Array.isArray(e.faceIds) ? ' · ' + e.faceIds.length + ' yüze komşu' : '') +
      '</div>' +
    '</button>';
  });
  if (selectedEdgeId) {
    html += '<div style="margin-top:6px; padding:5px 8px; background:#fbbf2418; border-left:3px solid #fbbf24; font-size:0.6rem; color:var(--text-primary);">' +
      '<b>Seçili kenar:</b> ' + selectedEdgeId +
      ' <button onclick="veFEASelectGeometryEdge(\'' + node.id + '\', null)" style="float:right; padding:1px 6px; font-size:0.52rem; background:var(--bg-tertiary); color:var(--text-muted); border:1px solid var(--border-color); cursor:pointer;">Seçimi Kaldır</button>' +
    '</div>';
  }
  html += '<div style="font-size:0.52rem; color:var(--text-muted); margin-top:6px; line-height:1.4;">' +
    'ℹ Kenarlar <b>Edge Sizing</b> bölümünde her biri için target eleman boyu veya bölünme sayısı (Number of Divisions) ile ayarlanabilir.</div>';
  return html;
}

// ─── VERTICES panel — köşe listesi + 3D highlight + SOI merkezi ────────────
function _veFEAEditorTopologyVerticesPanel(node, topo) {
  var verts = Array.isArray(topo.vertices) ? topo.vertices : [];
  if (verts.length === 0) {
    return '<div style="padding:10px 12px; background:rgba(245,158,11,0.08); border-left:2px solid #f59e0b; font-size:0.6rem; color:var(--text-secondary); line-height:1.5;">' +
      'Bu geometride tanımlı köşe yok. (Silindir, küre, torus gibi smooth manifoldlarda vertex bulunmaz.)' +
    '</div>';
  }
  var selectedVId = (node.data && node.data.selectedVertexId) || null;
  var html = '<div style="font-size:0.58rem; color:var(--text-secondary); margin-bottom:4px;">' +
    'Köşeler <span style="color:var(--text-muted);">(satıra tıkla → 3D\'de sarı küre · SOI merkezi olarak kullan)</span>:</div>';
  verts.forEach(function(v) {
    var isSel = (selectedVId === v.id);
    var rowBg = isSel ? '#fbbf2420' : 'var(--bg-tertiary)';
    var rowBd = isSel ? '#fbbf24' : 'var(--border-color)';
    var icon = isSel ? '<span style="color:#fbbf24; margin-right:4px;">◉</span>' : '<span style="color:var(--text-muted); margin-right:4px;">○</span>';
    var pos = v.position || [0,0,0];
    html += '<button onclick="veFEASelectGeometryVertex(\'' + node.id + '\', \'' + v.id + '\')" style="display:block; width:100%; text-align:left; padding:5px 8px; background:' + rowBg + '; border:1px solid ' + rowBd + '; font-size:0.6rem; cursor:pointer; margin-bottom:3px;" onmouseover="this.style.background=\'' + (isSel ? '#fbbf2435' : 'var(--bg-secondary)') + '\'" onmouseout="this.style.background=\'' + rowBg + '\'">' +
      '<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:2px;">' +
        '<span style="display:flex; align-items:center; gap:4px;">' +
          icon +
          '<span style="font-family:monospace; font-size:0.55rem; padding:1px 5px; background:var(--bg-primary); color:var(--text-muted);">' + v.id + '</span>' +
          '<span style="font-weight:600; color:var(--text-primary);">' + (v.label || v.id) + '</span>' +
        '</span>' +
      '</div>' +
      '<div style="font-size:0.55rem; color:var(--text-muted); padding-left:18px;">' +
        '(' + pos[0].toFixed(2) + ', ' + pos[1].toFixed(2) + ', ' + pos[2].toFixed(2) + ') mm' +
        (Array.isArray(v.faceIds) ? ' · ' + v.faceIds.length + ' yüz' : '') +
        (Array.isArray(v.edgeIds) ? ' · ' + v.edgeIds.length + ' kenar' : '') +
      '</div>' +
    '</button>';
  });
  if (selectedVId) {
    var sV = verts.find(function(vv) { return vv.id === selectedVId; });
    html += '<div style="margin-top:6px; padding:5px 8px; background:#fbbf2418; border-left:3px solid #fbbf24; font-size:0.6rem; color:var(--text-primary);">' +
      '<b>Seçili köşe:</b> ' + selectedVId;
    if (sV && sV.position) {
      html += '<button onclick="veFEAAddSphereOfInfluenceAtVertex(\'' + node.id + '\', \'' + sV.id + '\')" style="float:right; padding:2px 8px; font-size:0.55rem; background:var(--accent-primary); color:#fff; border:none; cursor:pointer; margin-left:6px;">+ SOI Buraya</button>';
    }
    html += ' <button onclick="veFEASelectGeometryVertex(\'' + node.id + '\', null)" style="float:right; padding:1px 6px; font-size:0.52rem; background:var(--bg-tertiary); color:var(--text-muted); border:1px solid var(--border-color); cursor:pointer;">Seçimi Kaldır</button>' +
    '</div>';
  }
  html += '<div style="font-size:0.52rem; color:var(--text-muted); margin-top:6px; line-height:1.4;">' +
    'ℹ Köşe konumları <b>Sphere of Influence</b> merkezi olarak doğrudan kullanılabilir. "+ SOI Buraya" butonu ile vertex pozisyonuna otomatik küre yerleştirilir.</div>';
  return html;
}

// Edge seçimi — Topology panel veya 3D viewer'dan tetiklenir.
function veFEASelectGeometryEdge(meshNodeId, edgeId) {
  if (typeof nodes === 'undefined') return;
  var meshNode = nodes.find(function(n) { return n.id === meshNodeId; });
  if (!meshNode) return;
  meshNode.data = meshNode.data || {};
  // Toggle: aynı edge'e tekrar tıklanırsa seçim kaldırılır
  if (meshNode.data.selectedEdgeId === edgeId) edgeId = null;
  meshNode.data.selectedEdgeId = edgeId;
  if (typeof veFEAViewerRegistry !== 'undefined') {
    var viewer = veFEAViewerRegistry[meshNodeId];
    if (viewer && typeof viewer.setSelectedEdge === 'function') {
      viewer.setSelectedEdge(edgeId);
    }
  }
  if (typeof saveState === 'function') saveState();
  if (typeof veFEAEditorRefreshAccordions === 'function') veFEAEditorRefreshAccordions();
}

// Vertex seçimi
function veFEASelectGeometryVertex(meshNodeId, vertexId) {
  if (typeof nodes === 'undefined') return;
  var meshNode = nodes.find(function(n) { return n.id === meshNodeId; });
  if (!meshNode) return;
  meshNode.data = meshNode.data || {};
  if (meshNode.data.selectedVertexId === vertexId) vertexId = null;
  meshNode.data.selectedVertexId = vertexId;
  if (typeof veFEAViewerRegistry !== 'undefined') {
    var viewer = veFEAViewerRegistry[meshNodeId];
    if (viewer && typeof viewer.setSelectedVertex === 'function') {
      viewer.setSelectedVertex(vertexId);
    }
  }
  if (typeof saveState === 'function') saveState();
  if (typeof veFEAEditorRefreshAccordions === 'function') veFEAEditorRefreshAccordions();
}

// Bir vertex'in konumunda yeni Sphere of Influence ekle.
function veFEAAddSphereOfInfluenceAtVertex(meshNodeId, vertexId) {
  if (typeof nodes === 'undefined') return;
  var meshNode = nodes.find(function(n) { return n.id === meshNodeId; });
  if (!meshNode) return;
  meshNode.data = meshNode.data || {};
  meshNode.data.meshSettings = meshNode.data.meshSettings || {};
  if (!Array.isArray(meshNode.data.meshSettings.sphereOfInfluence)) {
    meshNode.data.meshSettings.sphereOfInfluence = [];
  }
  // Upstream geometriden topology ve vertex pozisyonu
  var geomNode = (typeof veFEAFindUpstreamGeometryNode === 'function') ? veFEAFindUpstreamGeometryNode(meshNodeId) : null;
  if (!geomNode) return;
  var topo = geomNode.data && geomNode.data.geometry && geomNode.data.geometry.topology;
  if (!topo && typeof veFEAComputeGeometryTopology === 'function') {
    topo = veFEAComputeGeometryTopology(geomNode.data.geometry);
  }
  if (!topo || !Array.isArray(topo.vertices)) return;
  var v = topo.vertices.find(function(vv) { return vv.id === vertexId; });
  if (!v || !v.position) return;
  // Varsayılan yarıçap: bbox diag * 0.1
  var bbox = topo.bbox || { x: 100, y: 100, z: 100 };
  var diag = Math.sqrt(bbox.x*bbox.x + bbox.y*bbox.y + bbox.z*bbox.z) || 100;
  var r = Math.max(1, diag * 0.1);
  meshNode.data.meshSettings.sphereOfInfluence.push({
    cx: v.position[0], cy: v.position[1], cz: v.position[2], radius: r, targetSize: null,
    sourceVertexId: vertexId
  });
  if (typeof saveState === 'function') saveState();
  if (typeof showToast === 'function') showToast('Sphere of Influence eklendi: ' + (v.label || v.id), 'success');
  if (typeof veFEAEditorRefreshAccordions === 'function') veFEAEditorRefreshAccordions();
}

// Physics Preference preset değiştirildiğinde tüm defaults'ı uygular.
function veFEAApplyPhysicsPreset(nodeId, presetId) {
  if (typeof nodes === 'undefined') return;
  var node = nodes.find(function(n) { return n.id === nodeId; });
  if (!node) return;
  node.data = node.data || {};
  node.data.meshSettings = node.data.meshSettings || {};
  node.data.meshSettings.physicsPreference = presetId;
  if (typeof veFEAPhysicsPresetSettings === 'function') {
    var presetSettings = veFEAPhysicsPresetSettings(presetId);
    if (presetSettings) {
      // Preset'teki her field'ı override'la (kullanıcının ayrıca düzenlediği
      // yerler kayboluyor; bu kasıtlı — preset zaten "tüm defaults" anlamına gelir).
      for (var k in presetSettings) {
        if (presetSettings.hasOwnProperty(k) && k !== 'relativeSizeFactor') {
          node.data.meshSettings[k] = presetSettings[k];
        }
      }
      // relativeSizeFactor: mevcut size'ı ölçekle (preset'in default'undan)
      if (presetSettings.relativeSizeFactor && isFinite(+presetSettings.relativeSizeFactor)) {
        var prevPresetId = node.data._lastAppliedPhysicsPreset || 'static';
        var prevFactor = (VE_FEA_PHYSICS_PRESETS[prevPresetId] || {}).settings;
        prevFactor = prevFactor ? (prevFactor.relativeSizeFactor || 1) : 1;
        var newFactor = +presetSettings.relativeSizeFactor;
        var ratio = newFactor / prevFactor;
        var curSize = +node.data.meshSettings.size || 10;
        node.data.meshSettings.size = Math.max(0.1, curSize * ratio);
      }
      node.data._lastAppliedPhysicsPreset = presetId;
    }
  }
  if (typeof saveState === 'function') saveState();
  if (typeof veFEAEditorRefreshAccordions === 'function') veFEAEditorRefreshAccordions();
}

// Mesh method ↔ elementType haritası (geri uyumluluk)
function _veFEAInferMethodFromElType(elType) {
  if (elType === 'tet4') return 'patchConformingTet';
  if (elType === 'pyramid5') return 'hexDominant';
  return 'automatic';
}
function _veFEAMethodToElType(method) {
  if (method === 'patchConformingTet') return 'tet4';
  if (method === 'hexDominant') return 'pyramid5';
  return 'auto';
}

function _veFEAEditorDefaultsHTML(node) {
  var d = node.data || {};
  var settings = d.meshSettings || { size: 10 };
  var html = '';

  // Physics Preference (ANSYS §2) — preset defaults
  var currentPreset = settings.physicsPreference || 'static';
  html += '<div style="font-size:0.62rem; color:var(--text-secondary); margin-bottom:4px;">Physics Preference <span style="color:var(--text-muted);">(ANSYS §2 — preset)</span></div>';
  html += '<select id="ve-fea-mesh-physics-' + node.id + '" onchange="veFEAApplyPhysicsPreset(\'' + node.id + '\', this.value)" style="width:100%; padding:5px 8px; font-size:0.66rem; background:var(--bg-input); color:var(--text-primary); border:1px solid var(--border-color); margin-bottom:4px;">';
  if (typeof veFEAPhysicsPresets === 'function') {
    veFEAPhysicsPresets().forEach(function(pid) {
      var label = veFEAPhysicsPresetLabel(pid);
      html += '<option value="' + pid + '"' + (currentPreset === pid ? ' selected' : '') + '>' + label + '</option>';
    });
  } else {
    html += '<option value="static">Static Structural</option>';
  }
  html += '</select>';
  // Preset description
  if (typeof VE_FEA_PHYSICS_PRESETS !== 'undefined' && VE_FEA_PHYSICS_PRESETS[currentPreset]) {
    html += '<div style="font-size:0.55rem; color:var(--text-muted); margin-bottom:10px; line-height:1.4;">' +
      VE_FEA_PHYSICS_PRESETS[currentPreset].description + '</div>';
  }

  var currentMode = settings.mode || 'auto';
  html += '<div style="font-size:0.62rem; color:var(--text-secondary); margin-bottom:4px;">Mesh Modu</div>';
  html += '<select id="ve-fea-mesh-mode-' + node.id + '" onchange="veFEASetMeshSetting(\'' + node.id + '\', \'mode\', this.value)" style="width:100%; padding:5px 8px; font-size:0.66rem; background:var(--bg-input); color:var(--text-primary); border:1px solid var(--border-color); margin-bottom:10px;">';
  html += '<option value="auto"' + (currentMode === 'auto' ? ' selected' : '') + '>Otomatik (Primitif → yapısal, STEP → primitif inference + voxel fallback)</option>';
  html += '<option value="volume"' + (currentMode === 'volume' ? ' selected' : '') + '>Hacim (Heks8 voxel — FEA için)</option>';
  html += '<option value="surface"' + (currentMode === 'surface' ? ' selected' : '') + '>Yüzey (Tri3 — sadece önizleme)</option>';
  html += '</select>';

  // Mesh Method (ANSYS §4) — kullanıcı seçimli strateji. v1: elementType'ı
  // sarmalayan dropdown; gelecekte (Faz 3) MultiZone, Sweep, Hex Dominant
  // gerçek mesh strategy seçimi olacak.
  var currentMethod = settings.meshMethod || _veFEAInferMethodFromElType(settings.elementType);
  html += '<div style="font-size:0.62rem; color:var(--text-secondary); margin-bottom:4px;">Mesh Method <span style="color:var(--text-muted);">(ANSYS §4)</span></div>';
  html += '<select id="ve-fea-mesh-method-' + node.id + '" onchange="veFEASetMeshSetting(\'' + node.id + '\', \'meshMethod\', this.value); FEAMeshOutline.refresh();" style="width:100%; padding:5px 8px; font-size:0.66rem; background:var(--bg-input); color:var(--text-primary); border:1px solid var(--border-color); margin-bottom:6px;">';
  html += '<option value="automatic"'         + (currentMethod === 'automatic'         ? ' selected' : '') + '>Automatic (primitif → yapısal hex; STEP → tet)</option>';
  html += '<option value="patchConformingTet"' + (currentMethod === 'patchConformingTet' ? ' selected' : '') + '>Patch Conforming Tet (Tet4 — Delaunay/decomposition)</option>';
  html += '<option value="hexDominant"'        + (currentMethod === 'hexDominant'        ? ' selected' : '') + '>Hex Dominant (Hex8 + Pyramid5 transition)</option>';
  html += '<option value="sweep"'              + (currentMethod === 'sweep'              ? ' selected' : '') + '>Sweep (silindir/şaft/koni yapısal)</option>';
  html += '</select>';
  // TetGen durum göstergesi (vendor/tetgen build edilmemişse uyarı)
  var tetMesherActive = (typeof veFEADelaunayAvailable === 'function') && veFEADelaunayAvailable();
  if (currentMethod === 'patchConformingTet') {
    var statusColor = tetMesherActive ? '#22c55e' : '#f59e0b';
    var statusMsg = tetMesherActive
      ? '✓ Delaunay (Lysenko/MIT) aktif. STEP için kaliteli Tet4.'
      : '⚠ Delaunay yüklü değil. Voxel fallback kullanılacak.';
    html += '<div style="font-size:0.55rem; color:' + statusColor + '; margin-bottom:10px; padding:4px 6px; background:' + statusColor + '20; border-left:2px solid ' + statusColor + ';">' + statusMsg + '</div>';
  } else {
    html += '<div style="margin-bottom:10px;"></div>';
  }

  // İleri seviye: elementType doğrudan (geri uyum için)
  var currentElType = settings.elementType || 'auto';
  html += '<details style="margin-bottom:10px;"><summary style="font-size:0.58rem; color:var(--text-muted); cursor:pointer;">İleri: Element Tipi (geri uyumluluk)</summary>';
  html += '<select id="ve-fea-mesh-eltype-' + node.id + '" onchange="veFEASetMeshSetting(\'' + node.id + '\', \'elementType\', this.value)" style="width:100%; padding:5px 8px; font-size:0.62rem; background:var(--bg-input); color:var(--text-primary); border:1px solid var(--border-color); margin-top:4px;">';
  html += '<option value="auto"' + (currentElType === 'auto' ? ' selected' : '') + '>Otomatik (Heks8 / Wedge6)</option>';
  html += '<option value="tet4"' + (currentElType === 'tet4' ? ' selected' : '') + '>Tet4 (Tetra — decomposition)</option>';
  html += '<option value="pyramid5"' + (currentElType === 'pyramid5' ? ' selected' : '') + '>Pyramid5 (Hex8 → 6 piramit + centroid)</option>';
  html += '</select>';
  html += '</details>';

  // Element Order (ANSYS §3.7) — Linear vs Quadratic dropdown.
  // Geri uyum: eski settings.midSideNodes → 'quadratic'. Canonical alan
  // settings.elementOrder, midSideNodes submit sırasında bu değerden türetilir.
  var elementOrder = settings.elementOrder ||
    (settings.midSideNodes === true ? 'quadratic' : 'program');
  html += '<div style="font-size:0.62rem; color:var(--text-secondary); margin-bottom:4px;">Element Order <span style="color:var(--text-muted);">(ANSYS §3.7)</span></div>';
  html += '<select id="ve-fea-mesh-elorder-' + node.id + '" onchange="veFEASetMeshSetting(\'' + node.id + '\', \'elementOrder\', this.value); veFEASetMeshSetting(\'' + node.id + '\', \'midSideNodes\', this.value===\'quadratic\');" style="width:100%; padding:5px 8px; font-size:0.66rem; background:var(--bg-input); color:var(--text-primary); border:1px solid var(--border-color); margin-bottom:10px;">';
  html += '<option value="program"' + (elementOrder === 'program' ? ' selected' : '') + '>Program Controlled (otomatik — varsayılan: linear)</option>';
  html += '<option value="linear"' + (elementOrder === 'linear' ? ' selected' : '') + '>Linear (köşe düğümleri)</option>';
  html += '<option value="quadratic"' + (elementOrder === 'quadratic' ? ' selected' : '') + '>Quadratic (orta-kenar düğümler: Tet10 / Hex20 / Wedge15)</option>';
  html += '</select>';

  // Akilli mesh stratejisi paneli — sistem geometriye gore otomatik karar verir.
  // Kullanici sadece istisnai durumda legacy 'wedge' fan'i acabilir.
  var crossSection = settings.crossSection || 'auto';
  html += '<div style="font-size:0.62rem; color:var(--text-secondary); margin-bottom:4px;">Mesh Stratejisi <span style="color:var(--text-muted);">(silindir / koni / torus)</span></div>';
  html += '<select id="ve-fea-mesh-cross-' + node.id + '" onchange="veFEASetMeshSetting(\'' + node.id + '\', \'crossSection\', this.value)" style="width:100%; padding:5px 8px; font-size:0.66rem; background:var(--bg-input); color:var(--text-primary); border:1px solid var(--border-color); margin-bottom:4px;">';
  html += '<option value="auto"' + (crossSection !== 'wedge' ? ' selected' : '') + '>Otomatik — Hex8 O-grid (önerilen)</option>';
  html += '<option value="wedge"' + (crossSection === 'wedge' ? ' selected' : '') + '>Legacy: Wedge6 (merkez fan, dejenere)</option>';
  html += '</select>';
  html += '<div style="font-size:0.58rem; color:var(--text-muted); margin-bottom:10px; line-height:1.5;">' +
    'Otomatik mod: silindir/koni/torus için butterfly (5 blok) O-grid topolojisi. ' +
    'Eksen üzerinde dejenere hücre yok, tüm elemanlar Hex8.' +
    '</div>';

  // Delaunay tet mesher (karmaşık STEP geometrileri için kaliteli tet4 mesh).
  // Lysenko's delaunay-triangulate (MIT) — robust adaptive predicates.
  // Bundle yoksa graceful skip — voxel fallback devreye girer.
  var useTetMesher = settings.useTetMesher !== false;
  var tetMesherAvailable = (typeof veFEADelaunayAvailable === 'function') ? veFEADelaunayAvailable() : false;
  var addInterior = settings.delaunayAddInteriorPoints !== false;
  html += '<div style="font-size:0.62rem; color:var(--text-secondary); margin-bottom:4px; display:flex; align-items:center; gap:6px;">' +
    'Delaunay Tet Mesher <span style="color:' + (tetMesherAvailable ? '#22c55e' : '#fbbf24') +
    '; font-size:0.52rem;">' + (tetMesherAvailable ? '● aktif' : '○ yüklenmedi — voxel fallback') + '</span>' +
    '</div>';
  html += '<label style="display:flex; align-items:center; gap:6px; padding:6px 8px; margin-bottom:6px; background:var(--bg-primary); border:1px solid var(--border-color); cursor:pointer; font-size:0.62rem; color:var(--text-primary);">' +
    '<input type="checkbox" id="ve-fea-mesh-tetmesher-' + node.id + '"' + (useTetMesher ? ' checked' : '') + ' onchange="veFEASetMeshSetting(\'' + node.id + '\', \'useTetMesher\', this.checked)" style="margin:0;">' +
    '<span>STEP geometrilerinde Delaunay tet mesher kullan</span>' +
    '</label>';
  html += '<label style="display:flex; align-items:center; gap:6px; padding:6px 8px; margin-bottom:6px; background:var(--bg-primary); border:1px solid var(--border-color); cursor:pointer; font-size:0.62rem; color:var(--text-primary);">' +
    '<input type="checkbox" id="ve-fea-mesh-tetmesher-interior-' + node.id + '"' + (addInterior ? ' checked' : '') + ' onchange="veFEASetMeshSetting(\'' + node.id + '\', \'delaunayAddInteriorPoints\', this.checked)" style="margin:0;">' +
    '<span>İç nokta sampling <span style="color:var(--text-muted);">(kalite ↑, süre ↑)</span></span>' +
    '</label>';
  html += '<div style="font-size:0.55rem; color:var(--text-muted); margin-bottom:6px; line-height:1.4;">' +
    'Lisans: MIT (Mikola Lysenko). Saf JS, WASM yok.' +
    '</div>';

  return html;
}

function _veFEAEditorSizingHTML(node) {
  var d = node.data || {};
  var settings = d.meshSettings || { size: 10 };
  var curv = settings.curvatureRefinement || { enabled: false, normalAngleDeg: 18 };
  var useWorker = settings.useWorker === true;
  var html = '';

  // ─── Genel Eleman Boyutu (eski üst toolbar'dan buraya taşındı) ──────────
  html += '<div style="font-size:0.62rem; color:var(--text-secondary); margin-bottom:4px;">Genel Eleman Boyutu <span style="color:var(--text-muted);">(global element size)</span></div>';
  html += '<div style="display:flex; gap:6px; align-items:center; margin-bottom:6px;">';
  html += '<input id="ve-fea-mesh-size-' + node.id + '" type="number" min="0.5" max="500" step="0.5" value="' + (settings.size != null ? settings.size : 10) + '" ' +
    'onchange="veFEASetMeshSetting(\'' + node.id + '\', \'size\', parseFloat(this.value))" ' +
    'style="width:80px; padding:5px 8px; font-size:0.66rem; background:var(--bg-input); color:var(--text-primary); border:1px solid var(--border-color);">';
  html += '<span style="font-size:0.6rem; color:var(--text-muted);">mm</span>';
  html += '<span style="flex:1;"></span>';
  html += '<div style="display:flex; gap:0;">';
  html += '<button onclick="veFEASetMeshSizePreset(\'' + node.id + '\', 20); FEAMeshOutline.refresh();" style="padding:5px 10px; font-size:0.6rem; background:var(--bg-tertiary); color:var(--text-primary); border:1px solid var(--border-color); cursor:pointer;">Coarse</button>';
  html += '<button onclick="veFEASetMeshSizePreset(\'' + node.id + '\', 10); FEAMeshOutline.refresh();" style="padding:5px 10px; font-size:0.6rem; background:var(--bg-tertiary); color:var(--text-primary); border:1px solid var(--border-color); border-left:none; cursor:pointer;">Medium</button>';
  html += '<button onclick="veFEASetMeshSizePreset(\'' + node.id + '\', 5); FEAMeshOutline.refresh();" style="padding:5px 10px; font-size:0.6rem; background:var(--bg-tertiary); color:var(--text-primary); border:1px solid var(--border-color); border-left:none; cursor:pointer;">Fine</button>';
  html += '</div>';
  html += '</div>';
  html += '<div style="font-size:0.55rem; color:var(--text-muted); margin-bottom:10px;">Lokal kontroller (Body/Face Sizing) bu genel boyutu bölgesel olarak override eder.</div>';

  html += '<label style="display:flex; align-items:center; gap:6px; padding:6px 8px; margin-bottom:8px; background:var(--bg-primary); border:1px solid var(--border-color); cursor:pointer; font-size:0.62rem; color:var(--text-primary);">' +
    '<input type="checkbox" id="ve-fea-mesh-curv-' + node.id + '"' + (curv.enabled ? ' checked' : '') + ' onchange="veFEASetMeshSetting(\'' + node.id + '\', \'curvatureRefinement.enabled\', this.checked)" style="margin:0;">' +
    '<span>Eğrilik tabanlı incelt <span style="color:var(--text-muted);">(silindir/şaft çevresel)</span></span>' +
  '</label>';
  html += '<div style="display:flex; gap:6px; align-items:center; margin-bottom:8px; padding-left:24px;">' +
    '<label for="ve-fea-mesh-curv-ang-' + node.id + '" style="flex:1; font-size:0.6rem; color:var(--text-secondary);">Maks yüzey açısı</label>' +
    '<input id="ve-fea-mesh-curv-ang-' + node.id + '" type="number" min="1" max="90" step="1" value="' + (curv.normalAngleDeg || 18) + '" onchange="veFEASetMeshSetting(\'' + node.id + '\', \'curvatureRefinement.normalAngleDeg\', parseFloat(this.value))" style="width:60px; padding:3px 6px; font-size:0.62rem; background:var(--bg-input); color:var(--text-primary); border:1px solid var(--border-color);">' +
    '<span style="font-size:0.55rem; color:var(--text-muted);">°</span>' +
  '</div>';
  html += '<label style="display:flex; align-items:center; gap:6px; padding:6px 8px; margin-bottom:6px; background:var(--bg-primary); border:1px solid var(--border-color); cursor:pointer; font-size:0.62rem; color:var(--text-primary);">' +
    '<input type="checkbox" id="ve-fea-mesh-worker-' + node.id + '"' + (useWorker ? ' checked' : '') + ' onchange="veFEASetMeshSetting(\'' + node.id + '\', \'useWorker\', this.checked)" style="margin:0;">' +
    '<span>Web Worker\'da hesapla <span style="color:var(--text-muted);">(büyük mesh için)</span></span>' +
  '</label>';

  // Defeaturing Tolerance (ANSYS §8)
  var defeatureTol = settings.defeaturingTolerance != null ? settings.defeaturingTolerance : 0;
  html += '<div style="margin-top:8px; padding-top:8px; border-top:1px solid var(--border-color);">';
  html += '<div style="font-size:0.62rem; color:var(--text-secondary); margin-bottom:4px;">Defeaturing Tolerance <span style="color:var(--text-muted);">(ANSYS §8)</span></div>';
  html += '<div style="font-size:0.55rem; color:var(--text-muted); margin-bottom:6px;">Bundan küçük detaylar (sliver edge/face) mesh\'te yok sayılır. 0 = devre dışı.</div>';
  html += '<div style="display:flex; gap:6px; align-items:center;">';
  html += '<input id="ve-fea-mesh-defeature-' + node.id + '" type="number" min="0" step="0.1" value="' + defeatureTol + '" onchange="veFEASetMeshSetting(\'' + node.id + '\', \'defeaturingTolerance\', parseFloat(this.value))" style="flex:1; padding:3px 6px; font-size:0.62rem; background:var(--bg-input); color:var(--text-primary); border:1px solid var(--border-color);">';
  html += '<span style="font-size:0.55rem; color:var(--text-muted);">mm</span>';
  html += '</div>';
  html += '</div>';

  return html;
}

function _veFEAEditorInflationHTML(node) {
  var d = node.data || {};
  var settings = d.meshSettings || {};
  var local = settings.localSizing || { selection: 'none', biasMode: 'power', biasStrength: 0, firstLayerThickness: 1, growthRate: 1.2, layerCount: 5 };
  var biasMode = local.biasMode || 'power';
  var html = '';
  html += '<div style="font-size:0.58rem; color:var(--text-muted); line-height:1.4; margin-bottom:8px;">' +
    'Hedef yüzeye doğru düğüm kümeleme. Power: sürekli güç fonksiyonu, Inflation: ANSYS-style geometric progression katmanları.</div>';
  html += '<div style="display:flex; gap:6px; align-items:center; margin-bottom:6px;">' +
    '<label for="ve-fea-mesh-local-sel-' + node.id + '" style="flex:0 0 60px; font-size:0.6rem; color:var(--text-secondary);">Hedef</label>' +
    '<select id="ve-fea-mesh-local-sel-' + node.id + '" onchange="veFEAOnLocalSelectionChange(\'' + node.id + '\', this.value)" style="flex:1; padding:4px 6px; font-size:0.62rem; background:var(--bg-input); color:var(--text-primary); border:1px solid var(--border-color);">';
  var localFaces = [
    ['none', '— Yok —'],
    ['faceXMin', 'X− Yüzeyi'],
    ['faceXMax', 'X+ Yüzeyi'],
    ['faceYMin', 'Y− / Alt'],
    ['faceYMax', 'Y+ / Üst'],
    ['faceZMin', 'Z− Yüzeyi'],
    ['faceZMax', 'Z+ Yüzeyi'],
    ['faceBottom', 'Alt (silindir/şaft)'],
    ['faceTop', 'Üst (silindir/şaft)']
  ];
  localFaces.forEach(function(f) {
    var sel = (local.selection === f[0]) ? ' selected' : '';
    html += '<option value="' + f[0] + '"' + sel + '>' + f[1] + '</option>';
  });
  html += '</select></div>';
  html += '<div style="display:flex; gap:6px; align-items:center; margin-bottom:6px;">' +
    '<label for="ve-fea-mesh-local-mode-' + node.id + '" style="flex:0 0 60px; font-size:0.6rem; color:var(--text-secondary);">Mod</label>' +
    '<select id="ve-fea-mesh-local-mode-' + node.id + '" style="flex:1; padding:4px 6px; font-size:0.62rem; background:var(--bg-input); color:var(--text-primary); border:1px solid var(--border-color);">' +
      '<option value="power"' + (biasMode === 'power' ? ' selected' : '') + '>Güç fonksiyonu</option>' +
      '<option value="inflation"' + (biasMode === 'inflation' ? ' selected' : '') + '>Inflation katmanları</option>' +
    '</select></div>';
  if (biasMode === 'power') {
    html += '<div style="display:flex; gap:6px; align-items:center; margin-bottom:8px;">' +
      '<label for="ve-fea-mesh-local-bias-' + node.id + '" style="flex:0 0 60px; font-size:0.6rem; color:var(--text-secondary);">Yığılma</label>' +
      '<input id="ve-fea-mesh-local-bias-' + node.id + '" type="range" min="0" max="100" step="5" value="' + Math.round((local.biasStrength || 0) * 100) + '" style="flex:1;">' +
      '<span style="font-size:0.6rem; color:var(--text-muted); width:34px; text-align:right;">' + Math.round((local.biasStrength || 0) * 100) + '%</span>' +
    '</div>';
  } else {
    html += '<div style="display:flex; gap:6px; align-items:center; margin-bottom:4px;">' +
      '<label for="ve-fea-mesh-local-first-' + node.id + '" style="flex:1; font-size:0.6rem; color:var(--text-secondary);">İlk katman kalınlığı</label>' +
      '<input id="ve-fea-mesh-local-first-' + node.id + '" type="number" min="0.05" max="500" step="0.1" value="' + (local.firstLayerThickness || 1) + '" style="width:70px; padding:3px 6px; font-size:0.62rem; background:var(--bg-input); color:var(--text-primary); border:1px solid var(--border-color);">' +
      '<span style="font-size:0.55rem; color:var(--text-muted);">mm</span>' +
    '</div>';
    html += '<div style="display:flex; gap:6px; align-items:center; margin-bottom:4px;">' +
      '<label for="ve-fea-mesh-local-grow-' + node.id + '" style="flex:1; font-size:0.6rem; color:var(--text-secondary);">Büyüme oranı</label>' +
      '<input id="ve-fea-mesh-local-grow-' + node.id + '" type="number" min="1.0" max="5.0" step="0.05" value="' + (local.growthRate || 1.2) + '" style="width:70px; padding:3px 6px; font-size:0.62rem; background:var(--bg-input); color:var(--text-primary); border:1px solid var(--border-color);">' +
      '<span style="font-size:0.55rem; color:var(--text-muted);">×</span>' +
    '</div>';
    html += '<div style="display:flex; gap:6px; align-items:center; margin-bottom:8px;">' +
      '<label for="ve-fea-mesh-local-nlay-' + node.id + '" style="flex:1; font-size:0.6rem; color:var(--text-secondary);">Katman sayısı</label>' +
      '<input id="ve-fea-mesh-local-nlay-' + node.id + '" type="number" min="1" max="50" step="1" value="' + (local.layerCount || 5) + '" style="width:70px; padding:3px 6px; font-size:0.62rem; background:var(--bg-input); color:var(--text-primary); border:1px solid var(--border-color);">' +
      '<span style="font-size:0.55rem; color:var(--text-muted);">−</span>' +
    '</div>';
  }
  return html;
}

// ─── Face Sizing Controls panel (ANSYS §5.1) ──────────────────────────────
// Çoklu yüzey lokal sizing: kullanıcı 3D viewer'da bir face'i tıklayıp
// "Sizing'e ekle" butonu ile listeye katar. Her entry için target eleman
// boyutu + behavior (soft/hard). v1: post-mesh named selection olarak
// işaretlenir; gerçek size-field uygulaması Faz 2'nin ileri adımında.
function _veFEAEditorFaceSizingHTML(node) {
  var d = node.data || {};
  var settings = d.meshSettings || {};
  var controls = settings.faceSizingControls || [];
  var selectedFaceId = d.selectedFaceId || null;

  // Mevcut topology'den face label haritası (eğer varsa)
  var faceLabels = {};
  if (typeof veFEAComputeGeometryTopology === 'function' && d.geometry) {
    try {
      var topo = veFEAComputeGeometryTopology(d.geometry);
      if (topo && Array.isArray(topo.faces)) {
        topo.faces.forEach(function(f) { faceLabels[f.id] = f.label || f.id; });
      }
    } catch (e) { /* topology hesaplanamadıysa fallback: faceId göster */ }
  }

  var html = '<div style="font-size:0.58rem; color:var(--text-muted); margin-bottom:8px; line-height:1.5;">' +
    'ANSYS §5.1 — geometrideki bir yüzeye lokal eleman boyutu ata. ' +
    '3D görüntüleyiciden bir yüzeye tıklayın, ardından <b>+ Sizing\'e ekle</b> deyin.' +
    '</div>';

  // Pick'lenmiş face göstergesi + Ekle butonu
  html += '<div style="display:flex; gap:6px; align-items:center; margin-bottom:8px; padding:6px 8px; background:var(--bg-primary); border:1px solid var(--border-color);">';
  if (selectedFaceId) {
    var existsInList = controls.some(function(c) { return c.faceId === selectedFaceId; });
    var lbl = faceLabels[selectedFaceId] || selectedFaceId;
    html += '<span style="flex:1; font-size:0.62rem; color:var(--text-primary);"><b>Seçili yüz:</b> ' + lbl +
      ' <span style="color:var(--text-muted);">(' + selectedFaceId + ')</span></span>';
    if (existsInList) {
      html += '<span style="font-size:0.55rem; color:var(--text-muted);">(zaten listede)</span>';
    } else {
      html += '<button onclick="veFEAAddFaceSizingFromSelection(\'' + node.id + '\')" style="padding:5px 10px; font-size:0.6rem; font-weight:600; background:var(--accent-primary); color:#fff; border:none; cursor:pointer;" onmouseenter="this.style.filter=\'brightness(1.15)\'" onmouseleave="this.style.filter=\'none\'">+ Sizing\'e ekle</button>';
    }
    // ANSYS Extend to Adjacent — komşu face'leri aynı sizing ile bulk ekle
    html += '<button onclick="veFEAExtendFaceSizingAdjacent(\'' + node.id + '\', 30)" style="padding:5px 10px; font-size:0.6rem; font-weight:600; background:var(--bg-tertiary); color:var(--text-primary); border:1px solid var(--border-color); cursor:pointer;" title="Komşu yüzeyleri (≤30°) aynı boyutla ekle">⇲ Extend Adjacent</button>';
  } else {
    html += '<span style="flex:1; font-size:0.6rem; color:var(--text-muted); font-style:italic;">3D görüntüleyicide bir yüzeye tıklayın…</span>';
  }
  html += '</div>';

  // Sizing listesi
  if (controls.length === 0) {
    html += '<div style="padding:10px 12px; background:var(--bg-primary); border:1px dashed var(--border-color); font-size:0.6rem; color:var(--text-muted); text-align:center;">Henüz face sizing tanımlı değil.</div>';
  } else {
    controls.forEach(function(c, idx) {
      var lbl = faceLabels[c.faceId] || c.faceId;
      var beh = c.behavior || 'soft';
      html += '<div style="padding:6px 8px; background:var(--bg-primary); border:1px solid var(--border-color); margin-bottom:6px;">';
      html += '<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">';
      html += '<b style="font-size:0.62rem; color:var(--text-primary);">' + lbl +
        ' <span style="color:var(--text-muted); font-weight:400;">(' + c.faceId + ')</span></b>';
      html += '<button onclick="veFEARemoveFaceSizing(\'' + node.id + '\',' + idx + ')" style="padding:2px 8px; font-size:0.55rem; background:#dc2626; color:#fff; border:none; cursor:pointer;">Sil</button>';
      html += '</div>';
      html += '<div style="display:grid; grid-template-columns:auto 1fr auto 1fr; gap:6px; align-items:center;">';
      html += '<span style="font-size:0.58rem; color:var(--text-secondary);">Hedef boyut:</span>';
      html += '<input type="number" value="' + (c.size || 1) + '" step="0.1" min="0.01" id="ve-fea-fs-size-' + node.id + '-' + idx + '" style="font-size:0.62rem; padding:3px 5px; background:var(--bg-input); color:var(--text-primary); border:1px solid var(--border-color); width:100%;">';
      html += '<span style="font-size:0.58rem; color:var(--text-secondary);">Behavior:</span>';
      html += '<select id="ve-fea-fs-beh-' + node.id + '-' + idx + '" style="font-size:0.62rem; padding:3px 5px; background:var(--bg-input); color:var(--text-primary); border:1px solid var(--border-color); width:100%;">';
      html += '<option value="soft"' + (beh === 'soft' ? ' selected' : '') + '>Soft (override\'lanabilir)</option>';
      html += '<option value="hard"' + (beh === 'hard' ? ' selected' : '') + '>Hard (kesin uygula)</option>';
      html += '</select>';
      html += '</div>';
      html += '</div>';
    });
  }

  if (controls.length > 0) {
    html += '<div style="margin-top:8px; padding:6px 8px; background:rgba(59,130,246,0.08); border-left:2px solid #3b82f6; font-size:0.58rem; color:var(--text-secondary); line-height:1.5;">' +
      'ℹ Mesh oluşturulduğunda her face sizing entry için bir <i>named selection</i> üretilir ' +
      '(metadata: targetSize, behavior). Gerçek size-field refinement Faz 2 ileri adımında.' +
      '</div>';
  }
  return html;
}

// Currently selected face'i (viewer pick'inden gelen) face sizing listesine ekler.
function veFEAAddFaceSizingFromSelection(nodeId) {
  if (typeof nodes === 'undefined') return;
  var node = nodes.find(function(n) { return n.id === nodeId; });
  if (!node || !node.data || !node.data.selectedFaceId) return;
  node.data.meshSettings = node.data.meshSettings || {};
  if (!Array.isArray(node.data.meshSettings.faceSizingControls)) {
    node.data.meshSettings.faceSizingControls = [];
  }
  // UI'da değişmiş input değerlerini kaybetmemek için önce oku
  var existing = veFEAReadFaceSizingFromUI(nodeId);
  if (existing.length > 0) node.data.meshSettings.faceSizingControls = existing;
  // Tekrar ekleme yapma
  var fid = node.data.selectedFaceId;
  if (node.data.meshSettings.faceSizingControls.some(function(c) { return c.faceId === fid; })) return;
  // Default size: global mesh size'ın yarısı (önemli ölçüde refine'e başlamak için)
  var defaultSize = ((node.data.meshSettings.size) || 10) / 2;
  node.data.meshSettings.faceSizingControls.push({
    faceId: fid, size: defaultSize, behavior: 'soft'
  });
  if (typeof saveState === 'function') saveState();
  if (typeof veFEAEditorRefreshAccordions === 'function') veFEAEditorRefreshAccordions();
}

// ANSYS Extend to Adjacent: mevcut seçili face'in komşularını (feature-angle
// thresholdDeg ile) face sizing listesine bulk ekler. Aynı boyut + behavior.
function veFEAExtendFaceSizingAdjacent(nodeId, thresholdDeg) {
  if (typeof nodes === 'undefined') return;
  var node = nodes.find(function(n) { return n.id === nodeId; });
  if (!node || !node.data || !node.data.selectedFaceId) return;
  if (!node.data.geometry) return;
  if (typeof veFEAComputeGeometryTopology !== 'function' ||
      typeof veFEAExtendSelectionAdjacent !== 'function') return;
  var topo = veFEAComputeGeometryTopology(node.data.geometry);
  if (!topo) return;
  var extended = veFEAExtendSelectionAdjacent([node.data.selectedFaceId], topo, thresholdDeg);
  if (extended.length === 0) return;

  node.data.meshSettings = node.data.meshSettings || {};
  if (!Array.isArray(node.data.meshSettings.faceSizingControls)) {
    node.data.meshSettings.faceSizingControls = [];
  }
  var existing = veFEAReadFaceSizingFromUI(nodeId);
  if (existing.length > 0) node.data.meshSettings.faceSizingControls = existing;

  var defaultSize = ((node.data.meshSettings.size) || 10) / 2;
  var existingIds = {};
  node.data.meshSettings.faceSizingControls.forEach(function(c) { existingIds[c.faceId] = true; });
  var addedCount = 0;
  extended.forEach(function(fid) {
    if (existingIds[fid]) return;
    node.data.meshSettings.faceSizingControls.push({
      faceId: fid, size: defaultSize, behavior: 'soft'
    });
    addedCount++;
  });
  if (typeof showToast === 'function') {
    showToast(addedCount + ' komşu yüz Face Sizing\'e eklendi (eşik ' + (thresholdDeg || 30) + '°)', 'info');
  }
  if (typeof saveState === 'function') saveState();
  if (typeof veFEAEditorRefreshAccordions === 'function') veFEAEditorRefreshAccordions();
}

function veFEARemoveFaceSizing(nodeId, index) {
  if (typeof nodes === 'undefined') return;
  var node = nodes.find(function(n) { return n.id === nodeId; });
  if (!node || !node.data || !node.data.meshSettings) return;
  var existing = veFEAReadFaceSizingFromUI(nodeId);
  if (existing.length > 0) node.data.meshSettings.faceSizingControls = existing;
  if (!Array.isArray(node.data.meshSettings.faceSizingControls)) return;
  node.data.meshSettings.faceSizingControls.splice(index, 1);
  if (typeof saveState === 'function') saveState();
  if (typeof veFEAEditorRefreshAccordions === 'function') veFEAEditorRefreshAccordions();
}

// Mevcut DOM input'larından face sizing list'ini okur (submit/refresh sırasında).
function veFEAReadFaceSizingFromUI(nodeId) {
  if (typeof nodes === 'undefined') return [];
  var node = nodes.find(function(n) { return n.id === nodeId; });
  if (!node || !node.data || !node.data.meshSettings ||
      !Array.isArray(node.data.meshSettings.faceSizingControls)) return [];
  var current = node.data.meshSettings.faceSizingControls;
  var out = [];
  for (var i = 0; i < current.length; i++) {
    var sizeEl = document.getElementById('ve-fea-fs-size-' + nodeId + '-' + i);
    var behEl  = document.getElementById('ve-fea-fs-beh-' + nodeId + '-' + i);
    if (!sizeEl) {
      // DOM render edilmemiş (modal kapalı) — settings'teki değeri koru
      out.push({
        faceId: current[i].faceId,
        size: current[i].size,
        behavior: current[i].behavior || 'soft'
      });
      continue;
    }
    var sz = parseFloat(sizeEl.value);
    if (!isFinite(sz) || sz <= 0) sz = current[i].size || 1;
    var beh = (behEl && behEl.value === 'hard') ? 'hard' : 'soft';
    out.push({ faceId: current[i].faceId, size: sz, behavior: beh });
  }
  return out;
}

// ─── Edge Sizing Controls panel (ANSYS §5.5) ──────────────────────────────
// Geometride bir kenar (edge) seçip o kenar üzerinde target eleman boyutu
// veya number of divisions ata. v1: dropdown-based seçim (3D edge pick
// sonraki adımda). Cylinder/Shaft/Cone/Hemisphere için topology'de edge
// listesi tanımlanmış; box için 12 edge sonraki commit'te eklenir.
function _veFEAEditorEdgeSizingHTML(node) {
  var d = node.data || {};
  var settings = d.meshSettings || {};
  var controls = settings.edgeSizingControls || [];

  // Topology'den edges listesini al — upstream Geometri node'undan
  var topoEdges = [];
  var geomNode = (typeof veFEAFindUpstreamGeometryNode === 'function') ? veFEAFindUpstreamGeometryNode(node.id) : null;
  var geomForTopo = (geomNode && geomNode.data && geomNode.data.geometry) || d.geometry;
  if (typeof veFEAComputeGeometryTopology === 'function' && geomForTopo) {
    try {
      var topo = (geomForTopo.topology && Array.isArray(geomForTopo.topology.edges)) ? geomForTopo.topology : veFEAComputeGeometryTopology(geomForTopo);
      if (topo && Array.isArray(topo.edges)) topoEdges = topo.edges;
    } catch (e) { /* skip */ }
  }

  var html = '<div style="font-size:0.58rem; color:var(--text-muted); margin-bottom:8px; line-height:1.5;">' +
    'ANSYS §5.5 — kenar üzerinde target eleman boyutu veya bölünme sayısı (Number of Divisions). ' +
    'v1: dropdown-based seçim (3D edge pick sonraki adımda).' +
    '</div>';

  // Edge'leri olmayan geometriler (sphere, torus, box) için uyarı
  if (topoEdges.length === 0) {
    html += '<div style="padding:10px 12px; background:rgba(245,158,11,0.08); border-left:2px solid #f59e0b; font-size:0.6rem; color:var(--text-secondary);">' +
      'Bu geometri tipinde tanımlı edge yok (örn. sphere, torus) veya henüz edge listesi eklenmedi (box — sonraki commit).' +
      '</div>';
    return html;
  }

  // Mevcut listede olmayan edge'leri seçilebilir hale getir
  var alreadyUsed = {};
  controls.forEach(function(c) { alreadyUsed[c.edgeId] = true; });
  var availableEdges = topoEdges.filter(function(e) { return !alreadyUsed[e.id]; });

  // Edge ekleme dropdown'ı
  html += '<div style="display:flex; gap:6px; align-items:center; margin-bottom:8px; padding:6px 8px; background:var(--bg-primary); border:1px solid var(--border-color);">';
  if (availableEdges.length === 0) {
    html += '<span style="flex:1; font-size:0.6rem; color:var(--text-muted); font-style:italic;">Tüm edge\'ler zaten listede.</span>';
  } else {
    html += '<select id="ve-fea-es-pick-' + node.id + '" style="flex:1; font-size:0.62rem; padding:4px 6px; background:var(--bg-input); color:var(--text-primary); border:1px solid var(--border-color);">';
    availableEdges.forEach(function(e) {
      var label = e.label || e.id;
      html += '<option value="' + e.id + '">' + label + ' (~' + e.length.toFixed(1) + ' mm)</option>';
    });
    html += '</select>';
    html += '<button onclick="veFEAAddEdgeSizingFromDropdown(\'' + node.id + '\')" style="padding:5px 10px; font-size:0.6rem; font-weight:600; background:var(--accent-primary); color:#fff; border:none; cursor:pointer;" onmouseenter="this.style.filter=\'brightness(1.15)\'" onmouseleave="this.style.filter=\'none\'">+ Ekle</button>';
  }
  html += '</div>';

  // Mevcut entries
  if (controls.length === 0) {
    html += '<div style="padding:10px 12px; background:var(--bg-primary); border:1px dashed var(--border-color); font-size:0.6rem; color:var(--text-muted); text-align:center;">Henüz edge sizing tanımlı değil.</div>';
  } else {
    controls.forEach(function(c, idx) {
      var edgeInfo = topoEdges.find(function(e) { return e.id === c.edgeId; }) || { label: c.edgeId, length: 0 };
      var beh = c.behavior || 'soft';
      var hasSize = (c.size != null && isFinite(c.size) && c.size > 0);
      var hasDiv = (c.divisions != null && isFinite(c.divisions) && c.divisions >= 1);
      var sizeMode = hasDiv && !hasSize ? 'divisions' : 'size';
      html += '<div style="padding:6px 8px; background:var(--bg-primary); border:1px solid var(--border-color); margin-bottom:6px;">';
      html += '<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">';
      html += '<b style="font-size:0.62rem; color:var(--text-primary);">' + (edgeInfo.label || c.edgeId) +
        ' <span style="color:var(--text-muted); font-weight:400;">(' + c.edgeId + ', L≈' + edgeInfo.length.toFixed(1) + 'mm)</span></b>';
      html += '<button onclick="veFEARemoveEdgeSizing(\'' + node.id + '\',' + idx + ')" style="padding:2px 8px; font-size:0.55rem; background:#dc2626; color:#fff; border:none; cursor:pointer;">Sil</button>';
      html += '</div>';
      html += '<div style="display:grid; grid-template-columns:auto 1fr auto 1fr; gap:6px; align-items:center; margin-bottom:4px;">';
      html += '<label style="font-size:0.58rem; color:var(--text-secondary);"><input type="radio" name="ve-fea-es-mode-' + node.id + '-' + idx + '" value="size"' +
        (sizeMode === 'size' ? ' checked' : '') + ' style="margin-right:3px;">Hedef boyut:</label>';
      html += '<input type="number" value="' + (c.size != null ? c.size : '') + '" placeholder="—" step="0.1" min="0.01" id="ve-fea-es-size-' + node.id + '-' + idx + '" style="font-size:0.62rem; padding:3px 5px; background:var(--bg-input); color:var(--text-primary); border:1px solid var(--border-color); width:100%;">';
      html += '<label style="font-size:0.58rem; color:var(--text-secondary);"><input type="radio" name="ve-fea-es-mode-' + node.id + '-' + idx + '" value="divisions"' +
        (sizeMode === 'divisions' ? ' checked' : '') + ' style="margin-right:3px;"># Divisions:</label>';
      html += '<input type="number" value="' + (c.divisions != null ? c.divisions : '') + '" placeholder="—" step="1" min="1" id="ve-fea-es-div-' + node.id + '-' + idx + '" style="font-size:0.62rem; padding:3px 5px; background:var(--bg-input); color:var(--text-primary); border:1px solid var(--border-color); width:100%;">';
      html += '</div>';
      html += '<div style="display:flex; gap:6px; align-items:center;">';
      html += '<span style="font-size:0.58rem; color:var(--text-secondary);">Behavior:</span>';
      html += '<select id="ve-fea-es-beh-' + node.id + '-' + idx + '" style="flex:1; font-size:0.62rem; padding:3px 5px; background:var(--bg-input); color:var(--text-primary); border:1px solid var(--border-color);">';
      html += '<option value="soft"' + (beh === 'soft' ? ' selected' : '') + '>Soft (override\'lanabilir)</option>';
      html += '<option value="hard"' + (beh === 'hard' ? ' selected' : '') + '>Hard (kesin uygula)</option>';
      html += '</select>';
      html += '</div>';
      html += '</div>';
    });
  }

  if (controls.length > 0) {
    html += '<div style="margin-top:8px; padding:6px 8px; background:rgba(59,130,246,0.08); border-left:2px solid #3b82f6; font-size:0.58rem; color:var(--text-secondary); line-height:1.5;">' +
      'ℹ Her edge entry için bir <i>named selection</i> üretilir (metadata: targetSize/divisions, behavior). ' +
      'Mesher edge subdivision override Faz 2 ileri adımında.' +
      '</div>';
  }
  return html;
}

// Dropdown'da seçili edge'i listeye ekler.
function veFEAAddEdgeSizingFromDropdown(nodeId) {
  if (typeof nodes === 'undefined') return;
  var node = nodes.find(function(n) { return n.id === nodeId; });
  if (!node) return;
  var pickEl = document.getElementById('ve-fea-es-pick-' + nodeId);
  if (!pickEl || !pickEl.value) return;
  node.data = node.data || {};
  node.data.meshSettings = node.data.meshSettings || {};
  if (!Array.isArray(node.data.meshSettings.edgeSizingControls)) {
    node.data.meshSettings.edgeSizingControls = [];
  }
  var existing = veFEAReadEdgeSizingFromUI(nodeId);
  if (existing.length > 0) node.data.meshSettings.edgeSizingControls = existing;
  var edgeId = pickEl.value;
  if (node.data.meshSettings.edgeSizingControls.some(function(c) { return c.edgeId === edgeId; })) return;
  // Default: target size = global / 2
  var defaultSize = ((node.data.meshSettings.size) || 10) / 2;
  node.data.meshSettings.edgeSizingControls.push({
    edgeId: edgeId, size: defaultSize, divisions: null, behavior: 'soft'
  });
  if (typeof saveState === 'function') saveState();
  if (typeof veFEAEditorRefreshAccordions === 'function') veFEAEditorRefreshAccordions();
}

function veFEARemoveEdgeSizing(nodeId, index) {
  if (typeof nodes === 'undefined') return;
  var node = nodes.find(function(n) { return n.id === nodeId; });
  if (!node || !node.data || !node.data.meshSettings) return;
  var existing = veFEAReadEdgeSizingFromUI(nodeId);
  if (existing.length > 0) node.data.meshSettings.edgeSizingControls = existing;
  if (!Array.isArray(node.data.meshSettings.edgeSizingControls)) return;
  node.data.meshSettings.edgeSizingControls.splice(index, 1);
  if (typeof saveState === 'function') saveState();
  if (typeof veFEAEditorRefreshAccordions === 'function') veFEAEditorRefreshAccordions();
}

// UI input'larından edge sizing list'i okur.
function veFEAReadEdgeSizingFromUI(nodeId) {
  if (typeof nodes === 'undefined') return [];
  var node = nodes.find(function(n) { return n.id === nodeId; });
  if (!node || !node.data || !node.data.meshSettings ||
      !Array.isArray(node.data.meshSettings.edgeSizingControls)) return [];
  var current = node.data.meshSettings.edgeSizingControls;
  var out = [];
  for (var i = 0; i < current.length; i++) {
    var sizeEl = document.getElementById('ve-fea-es-size-' + nodeId + '-' + i);
    var divEl  = document.getElementById('ve-fea-es-div-'  + nodeId + '-' + i);
    var behEl  = document.getElementById('ve-fea-es-beh-'  + nodeId + '-' + i);
    var modeName = 've-fea-es-mode-' + nodeId + '-' + i;
    var modeChecked = document.querySelector('input[name="' + modeName + '"]:checked');
    if (!sizeEl) {
      out.push({
        edgeId: current[i].edgeId, size: current[i].size,
        divisions: current[i].divisions,
        behavior: current[i].behavior || 'soft'
      });
      continue;
    }
    var mode = modeChecked ? modeChecked.value : 'size';
    var sz  = parseFloat(sizeEl.value);
    var dv  = parseInt(divEl.value, 10);
    var beh = (behEl && behEl.value === 'hard') ? 'hard' : 'soft';
    var entry = { edgeId: current[i].edgeId, behavior: beh };
    if (mode === 'divisions') {
      entry.divisions = (isFinite(dv) && dv >= 1) ? dv : (current[i].divisions || null);
      entry.size = null;
    } else {
      entry.size = (isFinite(sz) && sz > 0) ? sz : (current[i].size || null);
      entry.divisions = null;
    }
    out.push(entry);
  }
  return out;
}

// ─── Virtual Topology panel (ANSYS §8.2) ──────────────────────────────────
// Birden fazla yüzü "virtual cell" olarak grupla. v1: post-mesh node ID
// birleştirme (named selection olarak). Mesher tarafından "tek face gibi
// işle" davranışı Faz 3+'da.
function _veFEAEditorVirtualTopologyHTML(node) {
  var d = node.data || {};
  var settings = d.meshSettings || {};
  var groups = settings.virtualTopology || [];
  var topoFaces = [];
  if (typeof veFEAComputeGeometryTopology === 'function' && d.geometry) {
    try {
      var topo = veFEAComputeGeometryTopology(d.geometry);
      if (topo && Array.isArray(topo.faces)) topoFaces = topo.faces;
    } catch (e) {}
  }

  var html = '<div style="font-size:0.58rem; color:var(--text-muted); margin-bottom:8px; line-height:1.5;">' +
    'ANSYS §8.2 — birden fazla yüzü "tek bir virtual cell" olarak grupla. ' +
    'v1: post-mesh node ID birleştirme (BC için).' +
    '</div>';

  if (topoFaces.length < 2) {
    html += '<div style="padding:10px 12px; background:rgba(245,158,11,0.08); border-left:2px solid #f59e0b; font-size:0.6rem; color:var(--text-secondary);">' +
      'Bu geometride en az 2 yüz olması gerekir.' +
      '</div>';
    return html;
  }

  if (groups.length === 0) {
    html += '<div style="padding:10px 12px; background:var(--bg-primary); border:1px dashed var(--border-color); font-size:0.6rem; color:var(--text-muted); text-align:center; margin-bottom:8px;">Henüz virtual group tanımlı değil.</div>';
  } else {
    groups.forEach(function(grp, idx) {
      html += '<div style="padding:6px 8px; background:var(--bg-primary); border:1px solid var(--border-color); margin-bottom:6px;">';
      html += '<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">';
      html += '<b style="font-size:0.62rem; color:var(--text-primary);">Grup ' + (idx + 1) + ' <span style="color:var(--text-muted); font-weight:400;">(' + (grp.faceIds || []).length + ' yüz)</span></b>';
      html += '<button onclick="veFEARemoveVirtualGroup(\'' + node.id + '\',' + idx + ')" style="padding:2px 8px; font-size:0.55rem; background:#dc2626; color:#fff; border:none; cursor:pointer;">Sil</button>';
      html += '</div>';
      html += '<input type="text" value="' + (grp.label || '') + '" placeholder="Grup adı (opsiyonel)" id="ve-fea-vt-lbl-' + node.id + '-' + idx + '" style="width:100%; font-size:0.6rem; padding:3px 5px; background:var(--bg-input); color:var(--text-primary); border:1px solid var(--border-color); margin-bottom:4px;">';
      html += '<div style="font-size:0.55rem; color:var(--text-secondary); margin-bottom:3px;">Yüzler:</div>';
      html += '<div style="max-height:120px; overflow-y:auto; padding:4px; background:var(--bg-tertiary); border:1px solid var(--border-color);">';
      var selected = grp.faceIds || [];
      topoFaces.forEach(function(f) {
        var checked = selected.indexOf(f.id) >= 0;
        html += '<label style="display:block; padding:2px 4px; font-size:0.58rem; color:var(--text-primary); cursor:pointer;">';
        html += '<input type="checkbox" data-vt-face="' + node.id + '|' + idx + '|' + f.id + '"' + (checked ? ' checked' : '') + ' style="margin-right:4px;">';
        html += (f.label || f.id) + ' <span style="color:var(--text-muted);">(' + f.id + ')</span>';
        html += '</label>';
      });
      html += '</div>';
      html += '</div>';
    });
  }

  html += '<button onclick="veFEAAddVirtualGroup(\'' + node.id + '\')" style="width:100%; padding:7px; font-size:0.65rem; font-weight:600; background:var(--accent-primary); color:#fff; border:none; cursor:pointer;" onmouseenter="this.style.filter=\'brightness(1.15)\'" onmouseleave="this.style.filter=\'none\'">+ Yeni Virtual Group Ekle</button>';

  return html;
}

function veFEAAddVirtualGroup(nodeId) {
  if (typeof nodes === 'undefined') return;
  var node = nodes.find(function(n) { return n.id === nodeId; });
  if (!node) return;
  node.data = node.data || {};
  node.data.meshSettings = node.data.meshSettings || {};
  if (!Array.isArray(node.data.meshSettings.virtualTopology)) {
    node.data.meshSettings.virtualTopology = [];
  }
  var existing = veFEAReadVirtualTopologyFromUI(nodeId);
  if (existing.length > 0) node.data.meshSettings.virtualTopology = existing;
  node.data.meshSettings.virtualTopology.push({ faceIds: [], label: '' });
  if (typeof saveState === 'function') saveState();
  if (typeof veFEAEditorRefreshAccordions === 'function') veFEAEditorRefreshAccordions();
}

function veFEARemoveVirtualGroup(nodeId, index) {
  if (typeof nodes === 'undefined') return;
  var node = nodes.find(function(n) { return n.id === nodeId; });
  if (!node || !node.data || !node.data.meshSettings) return;
  var existing = veFEAReadVirtualTopologyFromUI(nodeId);
  if (existing.length > 0) node.data.meshSettings.virtualTopology = existing;
  if (!Array.isArray(node.data.meshSettings.virtualTopology)) return;
  node.data.meshSettings.virtualTopology.splice(index, 1);
  if (typeof saveState === 'function') saveState();
  if (typeof veFEAEditorRefreshAccordions === 'function') veFEAEditorRefreshAccordions();
}

function veFEAReadVirtualTopologyFromUI(nodeId) {
  if (typeof nodes === 'undefined') return [];
  var node = nodes.find(function(n) { return n.id === nodeId; });
  if (!node || !node.data || !node.data.meshSettings ||
      !Array.isArray(node.data.meshSettings.virtualTopology)) return [];
  var current = node.data.meshSettings.virtualTopology;
  var out = [];
  for (var i = 0; i < current.length; i++) {
    var lblEl = document.getElementById('ve-fea-vt-lbl-' + nodeId + '-' + i);
    var label = lblEl ? lblEl.value : (current[i].label || '');
    var faceIds = [];
    var checkboxes = document.querySelectorAll('input[data-vt-face^="' + nodeId + '|' + i + '|"]');
    if (checkboxes.length === 0) {
      faceIds = (current[i].faceIds || []).slice();
    } else {
      checkboxes.forEach(function(cb) {
        if (cb.checked) {
          var parts = cb.getAttribute('data-vt-face').split('|');
          if (parts.length === 3) faceIds.push(parts[2]);
        }
      });
    }
    out.push({ faceIds: faceIds, label: label });
  }
  return out;
}

// ─── Sphere of Influence panel (ANSYS §5.2) ───────────────────────────────
// Geometriyi bölmeden lokal mesh kontrolü için küre listesi UI'ı.
// v1: post-mesh named selection üretir + viewer'da küre wireframe.
// Gerçek size-field refinement Faz 2'de (mesher size override).
function _veFEAEditorSphereOfInfluenceHTML(node) {
  var d = node.data || {};
  var settings = d.meshSettings || {};
  var spheres = settings.sphereOfInfluence || [];

  var html = '<div style="font-size:0.58rem; color:var(--text-muted); margin-bottom:8px; line-height:1.5;">' +
    'ANSYS §5.2 — geometriyi bölmeden lokal mesh yoğunlaştırma. ' +
    'Her küre içinde kalan düğümler otomatik <i>named selection</i> oluşturur.' +
    '</div>';

  if (spheres.length === 0) {
    html += '<div style="padding:10px 12px; background:var(--bg-primary); border:1px dashed var(--border-color); font-size:0.6rem; color:var(--text-muted); text-align:center; margin-bottom:8px;">Henüz tanımlı Sphere of Influence yok.</div>';
  } else {
    spheres.forEach(function(sph, idx) {
      html += '<div style="padding:6px 8px; background:var(--bg-primary); border:1px solid var(--border-color); margin-bottom:6px;">';
      html += '<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px;">';
      html += '<b style="font-size:0.62rem; color:var(--text-primary);">Küre ' + (idx + 1) + '</b>';
      html += '<button onclick="veFEARemoveSphereOfInfluence(\'' + node.id + '\',' + idx + ')" style="padding:2px 8px; font-size:0.55rem; background:#dc2626; color:#fff; border:none; cursor:pointer;">Sil</button>';
      html += '</div>';
      html += '<div style="display:grid; grid-template-columns:auto 1fr 1fr 1fr; gap:4px; align-items:center; margin-bottom:4px;">';
      html += '<span style="font-size:0.58rem; color:var(--text-secondary);">Merkez (x,y,z):</span>';
      html += '<input type="number" value="' + (sph.cx || 0) + '" step="0.5" id="ve-fea-soi-cx-' + node.id + '-' + idx + '" style="font-size:0.62rem; padding:3px 5px; background:var(--bg-input); color:var(--text-primary); border:1px solid var(--border-color); width:100%;">';
      html += '<input type="number" value="' + (sph.cy || 0) + '" step="0.5" id="ve-fea-soi-cy-' + node.id + '-' + idx + '" style="font-size:0.62rem; padding:3px 5px; background:var(--bg-input); color:var(--text-primary); border:1px solid var(--border-color); width:100%;">';
      html += '<input type="number" value="' + (sph.cz || 0) + '" step="0.5" id="ve-fea-soi-cz-' + node.id + '-' + idx + '" style="font-size:0.62rem; padding:3px 5px; background:var(--bg-input); color:var(--text-primary); border:1px solid var(--border-color); width:100%;">';
      html += '</div>';
      html += '<div style="display:grid; grid-template-columns:auto 1fr auto 1fr; gap:4px; align-items:center;">';
      html += '<span style="font-size:0.58rem; color:var(--text-secondary);">Yarıçap:</span>';
      html += '<input type="number" value="' + (sph.radius || 10) + '" step="0.5" min="0.1" id="ve-fea-soi-r-' + node.id + '-' + idx + '" style="font-size:0.62rem; padding:3px 5px; background:var(--bg-input); color:var(--text-primary); border:1px solid var(--border-color); width:100%;" title="Etki küresi yarıçapı (mm)">';
      html += '<span style="font-size:0.58rem; color:var(--text-secondary);">Hedef boyut:</span>';
      html += '<input type="number" value="' + (sph.targetSize != null ? sph.targetSize : '') + '" step="0.5" min="0.1" placeholder="—" id="ve-fea-soi-ts-' + node.id + '-' + idx + '" style="font-size:0.62rem; padding:3px 5px; background:var(--bg-input); color:var(--text-primary); border:1px solid var(--border-color); width:100%;" title="Sphere içinde hedef eleman boyutu (Faz 2: size-field refinement)">';
      html += '</div>';
      html += '</div>';
    });
  }

  html += '<button onclick="veFEAAddSphereOfInfluence(\'' + node.id + '\')" style="width:100%; padding:7px; font-size:0.65rem; font-weight:600; background:var(--accent-primary); color:#fff; border:none; cursor:pointer;" onmouseenter="this.style.filter=\'brightness(1.15)\'" onmouseleave="this.style.filter=\'none\'">+ Yeni Sphere of Influence Ekle</button>';

  if (spheres.length > 0) {
    html += '<div style="margin-top:8px; padding:6px 8px; background:rgba(59,130,246,0.08); border-left:2px solid #3b82f6; font-size:0.58rem; color:var(--text-secondary); line-height:1.5;">' +
      'ℹ Mesh yeniden oluşturulduğunda her küre için bir <i>named selection</i> üretilir. ' +
      'Hedef boyut hâlihazırda mesher tarafından uygulanmıyor (Faz 2 — size-field).' +
      '</div>';
  }
  return html;
}

// Yeni Sphere of Influence ekle — geometry bbox'ından merkez+yarıçap türetir.
function veFEAAddSphereOfInfluence(nodeId) {
  if (typeof nodes === 'undefined') return;
  var node = nodes.find(function(n) { return n.id === nodeId; });
  if (!node) return;
  node.data = node.data || {};
  node.data.meshSettings = node.data.meshSettings || {};
  if (!Array.isArray(node.data.meshSettings.sphereOfInfluence)) {
    node.data.meshSettings.sphereOfInfluence = [];
  }
  // Mevcut UI değerlerini koru (re-render kaybetmesin)
  var existing = veFEAReadSphereOfInfluenceFromUI(nodeId);
  if (existing.length > 0) node.data.meshSettings.sphereOfInfluence = existing;

  var geomNode = (typeof veFEAFindUpstreamGeometryNode === 'function')
    ? veFEAFindUpstreamGeometryNode(nodeId) : null;
  var bbox = (geomNode && geomNode.data && geomNode.data.geometry && geomNode.data.geometry.bbox) || null;
  var cx = 0, cy = 0, cz = 0, r = 10;
  if (bbox) {
    cx = (bbox.minX + bbox.maxX) / 2;
    cy = (bbox.minY + bbox.maxY) / 2;
    cz = (bbox.minZ + bbox.maxZ) / 2;
    var diag = Math.sqrt(
      Math.pow(bbox.maxX - bbox.minX, 2) +
      Math.pow(bbox.maxY - bbox.minY, 2) +
      Math.pow(bbox.maxZ - bbox.minZ, 2)
    );
    r = Math.max(1, diag * 0.15);
  }
  node.data.meshSettings.sphereOfInfluence.push({ cx: cx, cy: cy, cz: cz, radius: r, targetSize: null });
  if (typeof saveState === 'function') saveState();
  if (typeof veFEAEditorRefreshAccordions === 'function') veFEAEditorRefreshAccordions();
}

function veFEARemoveSphereOfInfluence(nodeId, index) {
  if (typeof nodes === 'undefined') return;
  var node = nodes.find(function(n) { return n.id === nodeId; });
  if (!node || !node.data || !node.data.meshSettings) return;
  // Önce UI'dan mevcut değerleri al (re-render kaybetmesin)
  var existing = veFEAReadSphereOfInfluenceFromUI(nodeId);
  if (existing.length > 0) node.data.meshSettings.sphereOfInfluence = existing;
  if (!Array.isArray(node.data.meshSettings.sphereOfInfluence)) return;
  node.data.meshSettings.sphereOfInfluence.splice(index, 1);
  if (typeof saveState === 'function') saveState();
  if (typeof veFEAEditorRefreshAccordions === 'function') veFEAEditorRefreshAccordions();
}

// UI input'larından mevcut Sphere of Influence listesini okur.
function veFEAReadSphereOfInfluenceFromUI(nodeId) {
  var out = [];
  for (var i = 0; ; i++) {
    var cxEl = document.getElementById('ve-fea-soi-cx-' + nodeId + '-' + i);
    if (!cxEl) break;
    var cyEl = document.getElementById('ve-fea-soi-cy-' + nodeId + '-' + i);
    var czEl = document.getElementById('ve-fea-soi-cz-' + nodeId + '-' + i);
    var rEl  = document.getElementById('ve-fea-soi-r-'  + nodeId + '-' + i);
    var tsEl = document.getElementById('ve-fea-soi-ts-' + nodeId + '-' + i);
    var ts = (tsEl && tsEl.value !== '') ? parseFloat(tsEl.value) : null;
    if (ts != null && (!isFinite(ts) || ts <= 0)) ts = null;
    out.push({
      cx:     parseFloat((cxEl && cxEl.value) || 0) || 0,
      cy:     parseFloat((cyEl && cyEl.value) || 0) || 0,
      cz:     parseFloat((czEl && czEl.value) || 0) || 0,
      radius: parseFloat((rEl  && rEl.value)  || 0) || 0,
      targetSize: ts
    });
  }
  return out;
}

function _veFEAEditorQualityHTML(node) {
  var d = node.data || {};
  var metrics = d.meshMetrics;
  var hasMesh = !!(d.meshActive && metrics);
  if (!hasMesh) {
    return '<div style="padding:8px 10px; background:var(--bg-primary); border:1px solid var(--border-color); font-size:0.62rem; color:var(--text-muted);">Mesh oluşturulduktan sonra otomatik hesaplanır.</div>';
  }
  var html = '';
  // Jacobian
  if (metrics.jacobian) {
    var jm = metrics.jacobian;
    var color = jm.valid ? 'var(--accent-success, #22c55e)' : 'var(--accent-danger, #ef4444)';
    var bg = jm.valid ? 'rgba(34,197,94,0.08)' : 'rgba(239,68,68,0.08)';
    var label = jm.valid ? '✓ GEÇERLİ (tüm Jacobianlar pozitif)' : '✗ HATALI (ters/dejenere eleman var)';
    html += '<div style="padding:6px 8px; background:' + bg + '; border:1px solid ' + color + '; font-size:0.62rem; color:' + color + '; margin-bottom:8px; font-weight:600;">' + label + '</div>';
    html += veFEAReadOnlyRow('Ters dönmüş eleman', (jm.invertedCount || 0).toLocaleString('tr-TR'));
    html += veFEAReadOnlyRow('Dejenere eleman', (jm.degenerateCount || 0).toLocaleString('tr-TR'));
    html += veFEAReadOnlyRow('Jacobian oranı (min/maks/ort)', (jm.minJacRatio || 0).toFixed(2) + ' / ' + (jm.maxJacRatio || 0).toFixed(2) + ' / ' + (jm.avgJacRatio || 0).toFixed(2));
    if (jm.poorCount > 0) {
      html += '<div style="padding:6px 8px; background:rgba(245,158,11,0.08); border-left:2px solid var(--accent-warning, #f59e0b); font-size:0.58rem; color:var(--accent-warning, #f59e0b); margin:4px 0 10px;">' +
        '⚠ ' + jm.poorCount.toLocaleString('tr-TR') + ' eleman düşük kaliteli (Jac oranı > ' + jm.ratioWarnThreshold + ')</div>';
    }
  }
  // Quality (aspect / skewness / angle + ANSYS §7 yeni 4 metrik)
  if (metrics.quality) {
    var q = metrics.quality;
    var nid = node.id;
    html += '<div style="margin-top:6px; font-size:0.62rem; color:var(--text-secondary); margin-bottom:4px;">Aspect Ratio / Skewness / Açı</div>';
    html += veFEAReadOnlyRow('Aspect Min / Maks / Ort', (q.aspectRatio.min || 0).toFixed(2) + ' / ' + (q.aspectRatio.max || 0).toFixed(2) + ' / ' + (q.aspectRatio.avg || 0).toFixed(2));
    if (q.aspectRatio.poorCount > 0) {
      html += '<div style="padding:4px 8px; font-size:0.58rem; color:var(--accent-warning, #f59e0b); border-left:2px solid var(--accent-warning, #f59e0b); margin-bottom:6px; background:rgba(245,158,11,0.06);">⚠ ' + q.aspectRatio.poorCount.toLocaleString('tr-TR') + ' eleman aspect > ' + q.aspectRatio.warnThreshold + '</div>';
    }
    html += veFEAHistogramHTML(q.aspectRatio.histogram, 'Aspect Ratio histogramı (yeşil=iyi, sarı=uyarı, kırmızı=hata)', '#3b82f6', function(v){return v.toFixed(1);}, { warnLimit: 5, errLimit: q.aspectRatio.warnThreshold || 20, inverted: false }, 'function(b){veFEAHighlightQualityBin("' + nid + '","aspect",b)}');
    html += veFEAReadOnlyRow('Skewness Min / Maks / Ort', (q.skewness.min || 0).toFixed(3) + ' / ' + (q.skewness.max || 0).toFixed(3) + ' / ' + (q.skewness.avg || 0).toFixed(3));
    if (q.skewness.poorCount > 0) {
      html += '<div style="padding:4px 8px; font-size:0.58rem; color:var(--accent-warning, #f59e0b); border-left:2px solid var(--accent-warning, #f59e0b); margin-bottom:6px; background:rgba(245,158,11,0.06);">⚠ ' + q.skewness.poorCount.toLocaleString('tr-TR') + ' eleman skewness > ' + q.skewness.warnThreshold + '</div>';
    }
    html += veFEAHistogramHTML(q.skewness.histogram, 'Skewness histogramı (yeşil=iyi, sarı=uyarı, kırmızı=hata)', '#f59e0b', function(v){return v.toFixed(2);}, { warnLimit: 0.5, errLimit: q.skewness.warnThreshold || 0.85, inverted: false }, 'function(b){veFEAHighlightQualityBin("' + nid + '","skewness",b)}');
    html += veFEAReadOnlyRow('Min / Maks iç açı', (q.angle.min || 0).toFixed(1) + '° / ' + (q.angle.max || 0).toFixed(1) + '°');
    html += veFEAHistogramHTML(q.angle.histogram, 'Min iç açı histogramı (derece — düşük=kötü, ters threshold)', '#22c55e', function(v){return v.toFixed(0) + '°';}, { warnLimit: 30, errLimit: 15, inverted: true }, 'function(b){veFEAHighlightQualityBin("' + nid + '","minAngle",b)}');

    // ─── ANSYS §7 — eksik 4 metrik ───
    if (q.elementQuality) {
      html += '<div style="margin-top:10px; font-size:0.62rem; color:var(--text-secondary); margin-bottom:4px;">Element Quality (şekil faktörü)</div>';
      html += veFEAReadOnlyRow('Element Q Min / Maks / Ort', (q.elementQuality.min || 0).toFixed(3) + ' / ' + (q.elementQuality.max || 0).toFixed(3) + ' / ' + (q.elementQuality.avg || 0).toFixed(3));
      if (q.elementQuality.poorCount > 0) {
        html += '<div style="padding:4px 8px; font-size:0.58rem; color:var(--accent-warning, #f59e0b); border-left:2px solid var(--accent-warning, #f59e0b); margin-bottom:6px; background:rgba(245,158,11,0.06);">⚠ ' + q.elementQuality.poorCount.toLocaleString('tr-TR') + ' eleman Element Quality < ' + q.elementQuality.warnThreshold + '</div>';
      }
      html += veFEAHistogramHTML(q.elementQuality.histogram, 'Element Quality histogramı (1=mükemmel, 0=dejenere)', '#8b5cf6', function(v){return v.toFixed(2);}, { warnLimit: 0.5, errLimit: q.elementQuality.warnThreshold || 0.2, inverted: true }, 'function(b){veFEAHighlightQualityBin("' + nid + '","elementQuality",b)}');
    }
    if (q.orthogonalQuality) {
      html += '<div style="margin-top:6px; font-size:0.62rem; color:var(--text-secondary); margin-bottom:4px;">Orthogonal Quality (yapısal hex için birincil)</div>';
      html += veFEAReadOnlyRow('Ortho Q Min / Maks / Ort', (q.orthogonalQuality.min || 0).toFixed(3) + ' / ' + (q.orthogonalQuality.max || 0).toFixed(3) + ' / ' + (q.orthogonalQuality.avg || 0).toFixed(3));
      if (q.orthogonalQuality.poorCount > 0) {
        html += '<div style="padding:4px 8px; font-size:0.58rem; color:var(--accent-warning, #f59e0b); border-left:2px solid var(--accent-warning, #f59e0b); margin-bottom:6px; background:rgba(245,158,11,0.06);">⚠ ' + q.orthogonalQuality.poorCount.toLocaleString('tr-TR') + ' eleman Ortho < ' + q.orthogonalQuality.warnThreshold + '</div>';
      }
      html += veFEAHistogramHTML(q.orthogonalQuality.histogram, 'Orthogonal Quality histogramı (1=mükemmel)', '#06b6d4', function(v){return v.toFixed(2);}, { warnLimit: 0.3, errLimit: q.orthogonalQuality.warnThreshold || 0.1, inverted: true }, 'function(b){veFEAHighlightQualityBin("' + nid + '","orthogonalQuality",b)}');
    }
    if (q.warpingFactor) {
      html += '<div style="margin-top:6px; font-size:0.62rem; color:var(--text-secondary); margin-bottom:4px;">Warping Factor (yüz düzlemsellik)</div>';
      html += veFEAReadOnlyRow('Warping Min / Maks / Ort', (q.warpingFactor.min || 0).toFixed(4) + ' / ' + (q.warpingFactor.max || 0).toFixed(4) + ' / ' + (q.warpingFactor.avg || 0).toFixed(4));
      if (q.warpingFactor.poorCount > 0) {
        html += '<div style="padding:4px 8px; font-size:0.58rem; color:var(--accent-warning, #f59e0b); border-left:2px solid var(--accent-warning, #f59e0b); margin-bottom:6px; background:rgba(245,158,11,0.06);">⚠ ' + q.warpingFactor.poorCount.toLocaleString('tr-TR') + ' yüz warping > ' + q.warpingFactor.warnThreshold + '</div>';
      }
      html += veFEAHistogramHTML(q.warpingFactor.histogram, 'Warping Factor histogramı (0=planar, >0.05 kötü)', '#ec4899', function(v){return v.toFixed(3);}, { warnLimit: 0.02, errLimit: q.warpingFactor.warnThreshold || 0.05, inverted: false }, 'function(b){veFEAHighlightQualityBin("' + nid + '","warpingFactor",b)}');
    }
    if (q.parallelDeviation) {
      html += '<div style="margin-top:6px; font-size:0.62rem; color:var(--text-secondary); margin-bottom:4px;">Parallel Deviation (paralel kenar sapması)</div>';
      html += veFEAReadOnlyRow('Par Dev Min / Maks / Ort', (q.parallelDeviation.min || 0).toFixed(1) + '° / ' + (q.parallelDeviation.max || 0).toFixed(1) + '° / ' + (q.parallelDeviation.avg || 0).toFixed(1) + '°');
      if (q.parallelDeviation.poorCount > 0) {
        html += '<div style="padding:4px 8px; font-size:0.58rem; color:var(--accent-warning, #f59e0b); border-left:2px solid var(--accent-warning, #f59e0b); margin-bottom:6px; background:rgba(245,158,11,0.06);">⚠ ' + q.parallelDeviation.poorCount.toLocaleString('tr-TR') + ' yüz par dev > ' + q.parallelDeviation.warnThreshold + '°</div>';
      }
      html += veFEAHistogramHTML(q.parallelDeviation.histogram, 'Parallel Deviation histogramı (derece — 0=paralelogram)', '#10b981', function(v){return v.toFixed(0) + '°';}, { warnLimit: 30, errLimit: q.parallelDeviation.warnThreshold || 70, inverted: false }, 'function(b){veFEAHighlightQualityBin("' + nid + '","parallelDeviation",b)}');
    }

    // Highlight'ı temizle butonu
    html += '<button onclick="veFEAHighlightQualityBin(\'' + nid + '\', null, null)" style="margin-top:6px; padding:5px 10px; font-size:0.6rem; background:var(--bg-tertiary); color:var(--text-secondary); border:1px solid var(--border-color); cursor:pointer;" onmouseenter="this.style.borderColor=\'var(--accent-primary)\'" onmouseleave="this.style.borderColor=\'var(--border-color)\'">✕ Vurguyu temizle</button>';
  }
  return html;
}

// ANSYS-style histogram bin selection: bin tıklanınca o aralıktaki elemanları
// 3D viewer'da vurgular. metricName=null veya binIndex=null çağrı = clear.
// veFEAComputePerElementQuality + viewer.highlightElements üzerine kurulu.
function veFEAHighlightQualityBin(nodeId, metricName, binIndex) {
  var viewer = (typeof veFEAViewerRegistry !== 'undefined') ? veFEAViewerRegistry[nodeId] : null;
  if (!viewer || typeof viewer.highlightElements !== 'function') return;

  // Clear isteği
  if (!metricName || binIndex === null || binIndex === undefined) {
    viewer.highlightElements(null);
    return;
  }

  var mesh = (typeof veFEAMeshCache !== 'undefined') ? veFEAMeshCache[nodeId] : null;
  if (!mesh) return;
  if (typeof veFEAComputePerElementQuality !== 'function') return;

  // Histogram'ı meshMetrics'ten al — metricName histogram-key haritası
  var histKeyMap = {
    aspect:            'aspectRatio',
    skewness:          'skewness',
    minAngle:          'angle',
    elementQuality:    'elementQuality',
    orthogonalQuality: 'orthogonalQuality',
    warpingFactor:     'warpingFactor',
    parallelDeviation: 'parallelDeviation'
  };
  var histKey = histKeyMap[metricName] || metricName;
  var nodes = (typeof window !== 'undefined' ? window.nodes : null) || (typeof global !== 'undefined' ? global.nodes : null);
  if (!nodes) return;
  var node = null;
  for (var i = 0; i < nodes.length; i++) { if (nodes[i].id === nodeId) { node = nodes[i]; break; } }
  if (!node || !node.data || !node.data.meshMetrics || !node.data.meshMetrics.quality) return;
  var q = node.data.meshMetrics.quality;
  if (!q[histKey] || !q[histKey].histogram) return;
  var hist = q[histKey].histogram;
  var binMin = hist.min + (hist.max - hist.min) * binIndex / hist.binCount;
  var binMax = hist.min + (hist.max - hist.min) * (binIndex + 1) / hist.binCount;
  var isLastBin = (binIndex === hist.binCount - 1);

  // Per-element değerleri tara
  var perElemArr = veFEAComputePerElementQuality(mesh, metricName);
  if (!perElemArr) return;
  var elementIds = [];
  for (var e = 0; e < perElemArr.length; e++) {
    var v = perElemArr[e];
    if (!isFinite(v)) continue;
    if (v >= binMin && (isLastBin ? v <= binMax : v < binMax)) {
      elementIds.push(e);
    }
  }
  viewer.highlightElements(elementIds);
}

// Browser global export (Jest CommonJS rejimi için)
if (typeof module !== 'undefined' && module.exports) {
  module.exports.veFEAHighlightQualityBin = veFEAHighlightQualityBin;
}

function _veFEAEditorNamedSelHTML(node) {
  var d = node.data || {};
  var hasMesh = !!d.meshActive;
  if (!hasMesh) {
    return '<div style="padding:8px 10px; background:var(--bg-primary); border:1px solid var(--border-color); font-size:0.62rem; color:var(--text-muted);">Mesh oluşturulduktan sonra atanmış yüzey grupları gösterilir.</div>';
  }
  if (!d.namedSelectionsSummary || Object.keys(d.namedSelectionsSummary).length === 0) {
    return '<div style="padding:8px 10px; background:var(--bg-primary); border:1px solid var(--border-color); font-size:0.62rem; color:var(--text-muted);">— (yüzey grubu üretilmedi)</div>';
  }
  var highlightKey = d.highlightedSelection || null;
  var html = '<div style="font-size:0.58rem; color:var(--text-muted); line-height:1.4; margin-bottom:8px;">Otomatik üretilen düğüm grupları. BC bu yüzeylere referansla uygulanır.</div>';
  Object.keys(d.namedSelectionsSummary).forEach(function(k) {
    var ns = d.namedSelectionsSummary[k];
    var isActive = (highlightKey === k);
    var bg = isActive ? 'var(--accent-primary)' : 'var(--bg-tertiary)';
    var fg = isActive ? '#fff' : 'var(--text-primary)';
    var iconColor = isActive ? '#fff' : 'var(--accent-warning, #f59e0b)';
    var border = isActive ? 'var(--accent-primary)' : 'var(--border-color)';
    var srcBadge = (ns.source === 'auto') ? 'AUTO' : 'MANUEL';
    var srcBg = (ns.source === 'auto') ? '#64748b40' : '#22c55e40';
    html += '<button onclick="veFEAToggleNamedSelection(\'' + node.id + '\', \'' + k + '\')" style="display:flex; align-items:center; justify-content:space-between; width:100%; padding:6px 8px; margin-bottom:3px; background:' + bg + '; color:' + fg + '; border:1px solid ' + border + '; cursor:pointer; font-size:0.62rem; text-align:left;">' +
      '<span style="display:flex; align-items:center; gap:6px;">' +
        '<span style="color:' + iconColor + '; font-size:0.7rem;">' + (isActive ? '◉' : '○') + '</span>' +
        '<span>' + ns.label + '</span>' +
      '</span>' +
      '<span style="display:flex; align-items:center; gap:6px;">' +
        '<span style="font-size:0.5rem; padding:1px 5px; background:' + srcBg + '; color:' + fg + ';">' + srcBadge + '</span>' +
        '<span style="font-weight:600; opacity:0.85;">' + ns.nodeCount.toLocaleString('tr-TR') + ' düğüm</span>' +
      '</span>' +
    '</button>';
  });
  return html;
}

function _veFEAEditorDisplayHTML(node) {
  var d = node.data || {};
  var hasMesh = !!d.meshActive;
  if (!hasMesh) {
    return '<div style="padding:8px 10px; background:var(--bg-primary); border:1px solid var(--border-color); font-size:0.62rem; color:var(--text-muted);">Mesh oluşturulduktan sonra kullanılabilir.</div>';
  }
  // ANSYS-style default: Body Color = Geometri + Mesh Çizgileri
  var displayMode = d.heatMapMetric || 'geom-mesh';
  var html = '<div style="font-size:0.58rem; color:var(--text-muted); line-height:1.5; margin-bottom:6px;">Mesh\'in 3D viewer\'da nasıl gösterileceğini seçin. ANSYS-style: <b>Body Color</b> (geometri + siyah mesh çizgileri) varsayılan.</div>';
  html += '<select onchange="veFEAApplyHeatMap(\'' + node.id + '\', this.value)" style="width:100%; padding:5px 8px; font-size:0.66rem; background:var(--bg-input); color:var(--text-primary); border:1px solid var(--border-color); margin-bottom:8px;">';
  html += '<optgroup label="Standart">';
  html += '<option value="geom-mesh"' + (displayMode === 'geom-mesh' ? ' selected' : '') + '>Body Color (Geometri + Mesh Çizgileri)</option>';
  html += '<option value="solid-edges"' + (displayMode === 'solid-edges' ? ' selected' : '') + '>Solid + Edges (Mesh yüzeyi)</option>';
  html += '<option value="solid"' + (displayMode === 'solid' ? ' selected' : '') + '>Solid (Mesh yüzeyi)</option>';
  html += '<option value="off"' + (displayMode === 'off' ? ' selected' : '') + '>Wireframe (sadece kenarlar)</option>';
  html += '</optgroup>';
  html += '<optgroup label="Kalite Eşiği (Mesh Quality Worksheet)">';
  html += '<option value="threshold-aspect"' + (displayMode === 'threshold-aspect' ? ' selected' : '') + '>Aspect Ratio (yeşil/sarı/kırmızı)</option>';
  html += '<option value="threshold-skewness"' + (displayMode === 'threshold-skewness' ? ' selected' : '') + '>Skewness (yeşil/sarı/kırmızı)</option>';
  html += '<option value="threshold-minAngle"' + (displayMode === 'threshold-minAngle' ? ' selected' : '') + '>Min İç Açı (yeşil/sarı/kırmızı)</option>';
  html += '<option value="threshold-jacobian"' + (displayMode === 'threshold-jacobian' ? ' selected' : '') + '>Jacobian Oranı (yeşil/sarı/kırmızı)</option>';
  html += '</optgroup>';
  html += '<optgroup label="Heat Map (Sürekli Rainbow)">';
  html += '<option value="aspect"' + (displayMode === 'aspect' ? ' selected' : '') + '>Aspect Ratio</option>';
  html += '<option value="skewness"' + (displayMode === 'skewness' ? ' selected' : '') + '>Skewness</option>';
  html += '<option value="minAngle"' + (displayMode === 'minAngle' ? ' selected' : '') + '>Min İç Açı</option>';
  html += '<option value="jacobianRatio"' + (displayMode === 'jacobianRatio' ? ' selected' : '') + '>Jacobian Oranı</option>';
  html += '</optgroup>';
  // Solver sonuçları varsa "Sonuçlar" grubunu göster
  var solverNode = (typeof _veFEAFindSolverNodeForMesh === 'function') ? _veFEAFindSolverNodeForMesh(node.id) : null;
  if (solverNode && solverNode.data && solverNode.data.solver && solverNode.data.solver.results) {
    html += '<optgroup label="Sonuçlar (Static Structural)">';
    html += '<option value="result-vonMises"' + (displayMode === 'result-vonMises' ? ' selected' : '') + '>von Mises Stress (MPa)</option>';
    html += '<option value="result-displacement"' + (displayMode === 'result-displacement' ? ' selected' : '') + '>Deplasman büyüklüğü (mm)</option>';
    html += '<option value="result-principalMax"' + (displayMode === 'result-principalMax' ? ' selected' : '') + '>Maks. asal gerilme</option>';
    html += '<option value="result-principalMin"' + (displayMode === 'result-principalMin' ? ' selected' : '') + '>Min. asal gerilme</option>';
    html += '<option value="result-deformed"' + (displayMode === 'result-deformed' ? ' selected' : '') + '>Deforme şekil (auto scale, gri ref)</option>';
    html += '</optgroup>';
  }
  html += '</select>';

  // Wireframe stratejisi — Body Color modunda etkili. Yoğun mesh'lerde
  // (sub-1mm + büyük geometri) "Tüm Edge'ler" ekrana sığmaz; "Sadece Yüzey"
  // her zaman pratik. Kullanıcı 'Kapalı' diyerek temiz solid görebilir.
  var wfMode = (d.meshSettings && d.meshSettings.wireframeMode) || 'all';
  html += '<div style="font-size:0.58rem; color:var(--text-muted); margin-bottom:3px;">Mesh Çizgi Modu <span style="opacity:0.6;">(Body Color ile etkili)</span></div>';
  html += '<select onchange="veFEASetWireframeMode(\'' + node.id + '\', this.value)" style="width:100%; padding:5px 8px; font-size:0.66rem; background:var(--bg-input); color:var(--text-primary); border:1px solid var(--border-color); margin-bottom:8px;">';
  html += '<option value="all"' + (wfMode === 'all' ? ' selected' : '') + '>Tüm Edge\'ler (yoğun mesh\'te otomatik yüzeye düşer)</option>';
  html += '<option value="surface"' + (wfMode === 'surface' ? ' selected' : '') + '>Sadece Yüzey (yoğun mesh için tercih)</option>';
  html += '<option value="off"' + (wfMode === 'off' ? ' selected' : '') + '>Kapalı (Temiz solid)</option>';
  html += '</select>';

  var isHeatMap = (displayMode === 'aspect' || displayMode === 'skewness' || displayMode === 'minAngle' || displayMode === 'jacobianRatio');
  var isThreshold = (displayMode === 'threshold-aspect' || displayMode === 'threshold-skewness' || displayMode === 'threshold-minAngle' || displayMode === 'threshold-jacobian');
  var isResultMap = (displayMode === 'result-vonMises' || displayMode === 'result-displacement' ||
                     displayMode === 'result-principalMax' || displayMode === 'result-principalMin' ||
                     displayMode === 'result-deformed');
  if (isResultMap) {
    var rLabel = (displayMode === 'result-vonMises') ? 'von Mises (MPa)'
               : (displayMode === 'result-displacement') ? 'Deplasman (mm)'
               : (displayMode === 'result-principalMax') ? 'σ_max (MPa)'
               : (displayMode === 'result-principalMin') ? 'σ_min (MPa)'
               : 'Deforme şekil';
    html += '<div style="font-size:0.55rem; color:var(--text-muted); margin-bottom:4px;">' + rLabel + '</div>';
    html += '<div style="display:flex; align-items:center; gap:6px; margin-bottom:4px;">' +
      '<span style="font-size:0.55rem; color:var(--text-muted);">Düşük</span>' +
      '<div style="flex:1; height:8px; background:linear-gradient(to right, #0000ff, #00ffff, #00ff00, #ffff00, #ff0000); border:1px solid var(--border-color);"></div>' +
      '<span style="font-size:0.55rem; color:var(--text-muted);">Yüksek</span>' +
    '</div>';
  }
  if (isHeatMap) {
    html += '<div style="display:flex; align-items:center; gap:6px; margin-bottom:4px;">' +
      '<span style="font-size:0.55rem; color:var(--text-muted);">İyi</span>' +
      '<div style="flex:1; height:8px; background:linear-gradient(to right, #0000ff, #00ffff, #00ff00, #ffff00, #ff0000); border:1px solid var(--border-color);"></div>' +
      '<span style="font-size:0.55rem; color:var(--text-muted);">Kötü</span>' +
    '</div>';
  } else if (isThreshold) {
    html += '<div style="display:flex; align-items:center; gap:6px; margin-bottom:4px;">' +
      '<span style="display:inline-block; width:14px; height:10px; background:#22c55e;"></span>' +
      '<span style="font-size:0.55rem; color:var(--text-muted);">İyi</span>' +
      '<span style="display:inline-block; width:14px; height:10px; background:#f59e0b;"></span>' +
      '<span style="font-size:0.55rem; color:var(--text-muted);">Uyarı</span>' +
      '<span style="display:inline-block; width:14px; height:10px; background:#ef4444;"></span>' +
      '<span style="font-size:0.55rem; color:var(--text-muted);">Hata</span>' +
    '</div>';
  }
  return html;
}

function _veFEAEditorStatisticsHTML(node) {
  var d = node.data || {};
  var metrics = d.meshMetrics;
  var hasMesh = !!(d.meshActive && metrics);
  if (!hasMesh) {
    return '<div style="padding:8px 10px; background:var(--bg-primary); border:1px solid var(--border-color); font-size:0.62rem; color:var(--text-muted);">Mesh oluşturulduktan sonra istatistikler dolar.</div>';
  }
  var typeLabel = (typeof veFEAMeshLabel === 'function') ? veFEAMeshLabel(metrics.elementType) : metrics.elementType;
  // Element order: tip'ten türetilir — quadratic mesh tipleri tet10/hex20/wedge15.
  var quadraticTypes = { tet10: 1, hex20: 1, wedge15: 1 };
  var orderLabel = quadraticTypes[metrics.elementType] ? 'Quadratic (Q2 — orta-kenar düğümler)' : 'Linear (Q1 — sadece köşe düğümleri)';
  var html = '';
  html += veFEAReadOnlyRow('Eleman tipi', typeLabel);
  html += veFEAReadOnlyRow('Element Order', orderLabel);
  if (metrics.sweepAxis) html += veFEAReadOnlyRow('Sweep ekseni', metrics.sweepAxis + ' (axial)');
  html += veFEAReadOnlyRow('Düğüm sayısı', metrics.nodeCount.toLocaleString('tr-TR'));
  html += veFEAReadOnlyRow('Eleman sayısı', metrics.elementCount.toLocaleString('tr-TR'));
  html += veFEAReadOnlyRow('Min eleman boyu', metrics.minSize.toFixed(2) + ' mm');
  html += veFEAReadOnlyRow('Maks eleman boyu', metrics.maxSize.toFixed(2) + ' mm');
  html += veFEAReadOnlyRow('Ortalama eleman boyu', metrics.avgSize.toFixed(2) + ' mm');
  if (metrics.computeMs !== undefined) html += veFEAReadOnlyRow('Hesaplama süresi', metrics.computeMs + ' ms');
  return html;
}

// ─── Convergence Study panel (ANSYS §10) ──────────────────────────────────
// Otomatik h-refinement: mesh oluştur → quality değerlendir → eşiği geçmediyse
// size küçült, tekrar mesh. v1: mesh-quality tabanlı (solver entegrasyonu Faz 3'te).
function _veFEAEditorConvergenceHTML(node) {
  var d = node.data || {};
  var cs = d.convergenceState || {};
  var hasGeom = !!(d.geometry && d.geometry.type);
  var html = '<div style="font-size:0.58rem; color:var(--text-muted); margin-bottom:8px; line-height:1.5;">' +
    'ANSYS §10 — otomatik mesh refinement. Hedef poor element yüzdesine ulaşana ' +
    'kadar size küçültülüp mesh yeniden üretilir. v1: aspect+skewness tabanlı.' +
    '</div>';

  if (!hasGeom) {
    html += '<div style="padding:8px 10px; background:rgba(245,158,11,0.08); border-left:2px solid #f59e0b; font-size:0.6rem; color:var(--text-secondary);">Önce geometri tanımlayın.</div>';
    return html;
  }

  html += '<div style="display:grid; grid-template-columns:auto 1fr; gap:6px; align-items:center; margin-bottom:8px;">';
  html += '<label style="font-size:0.6rem; color:var(--text-secondary);">Max iterasyon:</label>';
  html += '<input type="number" id="ve-fea-conv-max-' + node.id + '" min="1" max="20" step="1" value="' + (cs.maxLoops || 5) + '" style="font-size:0.62rem; padding:3px 5px; background:var(--bg-input); color:var(--text-primary); border:1px solid var(--border-color);">';
  html += '<label style="font-size:0.6rem; color:var(--text-secondary);">Hedef poor %:</label>';
  html += '<input type="number" id="ve-fea-conv-pct-' + node.id + '" min="0.1" max="100" step="0.5" value="' + (cs.targetPoorPct || 5) + '" style="font-size:0.62rem; padding:3px 5px; background:var(--bg-input); color:var(--text-primary); border:1px solid var(--border-color);">';
  html += '<label style="font-size:0.6rem; color:var(--text-secondary);">Size shrink:</label>';
  html += '<input type="number" id="ve-fea-conv-shr-' + node.id + '" min="0.1" max="0.95" step="0.05" value="' + (cs.shrinkFactor || 0.8) + '" style="font-size:0.62rem; padding:3px 5px; background:var(--bg-input); color:var(--text-primary); border:1px solid var(--border-color);">';
  html += '</div>';

  html += '<button onclick="veFEARunConvergenceStudy(\'' + node.id + '\')" style="width:100%; padding:8px; font-size:0.66rem; font-weight:600; background:var(--accent-primary); color:#fff; border:none; cursor:pointer;" onmouseenter="this.style.filter=\'brightness(1.15)\'" onmouseleave="this.style.filter=\'none\'">▶ Convergence Study Çalıştır</button>';

  if (cs.log && cs.log.length > 0) {
    html += '<div style="margin-top:8px; padding:6px 8px; background:var(--bg-primary); border:1px solid var(--border-color); font-size:0.58rem;">';
    html += '<div style="margin-bottom:4px; color:var(--text-secondary); font-weight:600;">Son çalıştırma:</div>';
    cs.log.forEach(function(entry) {
      if (entry.status === 'error') {
        html += '<div style="color:#ef4444;">Loop ' + entry.loop + ': HATA — ' + (entry.error || '?') + '</div>';
        return;
      }
      if (entry.status === 'min-size-reached') {
        html += '<div style="color:#f59e0b;">Loop ' + entry.loop + ': minimum size aşıldı (' + entry.size.toFixed(2) + ' mm)</div>';
        return;
      }
      html += '<div style="color:var(--text-primary); font-family:monospace;">' +
        'Loop ' + entry.loop +
        ' | size=' + entry.size.toFixed(2) + 'mm' +
        ' | N=' + (entry.elementCount || 0) +
        ' | poor=' + (entry.poorPct || 0).toFixed(1) + '%' +
        ' | aspect=' + (entry.maxAspect || 0).toFixed(1) +
        ' | skew=' + (entry.maxSkew || 0).toFixed(2) +
        '</div>';
    });
    var statusColor = cs.converged ? '#22c55e' : '#f59e0b';
    var statusIcon  = cs.converged ? '✓' : '⚠';
    html += '<div style="margin-top:4px; color:' + statusColor + '; font-weight:600;">' + statusIcon +
      ' ' + (cs.converged ? 'Yakınsama sağlandı' : 'Maks iterasyona ulaşıldı') + '</div>';
    html += '</div>';
  }
  return html;
}

// Convergence Study runner — UI butonundan çağrılır.
function veFEARunConvergenceStudy(nodeId) {
  if (typeof nodes === 'undefined') return;
  var node = nodes.find(function(n) { return n.id === nodeId; });
  if (!node || !node.data || !node.data.geometry) return;
  var maxEl = document.getElementById('ve-fea-conv-max-' + nodeId);
  var pctEl = document.getElementById('ve-fea-conv-pct-' + nodeId);
  var shrEl = document.getElementById('ve-fea-conv-shr-' + nodeId);
  var maxLoops = maxEl ? parseInt(maxEl.value, 10) : 5;
  var targetPoorPct = pctEl ? parseFloat(pctEl.value) : 5;
  var shrinkFactor = shrEl ? parseFloat(shrEl.value) : 0.8;
  var baseOpts = (node.data.meshSettings) ? Object.assign({}, node.data.meshSettings) : { size: 10 };
  if (typeof veFEAConvergenceStudy !== 'function') return;
  var result = veFEAConvergenceStudy(node.data.geometry, baseOpts, {
    maxLoops: maxLoops, targetPoorPct: targetPoorPct, shrinkFactor: shrinkFactor
  });
  node.data.convergenceState = {
    maxLoops: maxLoops, targetPoorPct: targetPoorPct, shrinkFactor: shrinkFactor,
    log: result.log, converged: result.converged
  };
  // Final mesh'i kullan: meshSettings.size'ı son loop'a güncelle ve build et
  if (result.final && !result.final.error && result.log.length > 0) {
    var lastEntry = result.log[result.log.length - 1];
    if (lastEntry.size) {
      node.data.meshSettings = node.data.meshSettings || {};
      node.data.meshSettings.size = lastEntry.size;
    }
    if (typeof veFEABuildMeshForNode === 'function') {
      veFEABuildMeshForNode(nodeId);
    }
  }
  if (typeof saveState === 'function') saveState();
  if (typeof veFEAEditorRefreshAccordions === 'function') veFEAEditorRefreshAccordions();
}

function _veFEAEditorSuggestionsHTML(node) {
  var d = node.data || {};
  var metrics = d.meshMetrics;
  var hasMesh = !!(d.meshActive && metrics);
  if (!hasMesh || typeof veFEAComputeRefinementSuggestions !== 'function') {
    return '<div style="padding:8px 10px; background:var(--bg-primary); border:1px solid var(--border-color); font-size:0.62rem; color:var(--text-muted);">Mesh oluşturulduktan sonra öneriler gösterilir.</div>';
  }
  var suggestions = veFEAComputeRefinementSuggestions(metrics);
  var html = '';
  suggestions.forEach(function(s) {
    var color, bg, icon;
    if (s.severity === 'critical') { color = 'var(--accent-danger, #ef4444)'; bg = 'rgba(239,68,68,0.08)'; icon = '✗'; }
    else if (s.severity === 'warn') { color = 'var(--accent-warning, #f59e0b)'; bg = 'rgba(245,158,11,0.08)'; icon = '⚠'; }
    else if (s.severity === 'info')  { color = 'var(--accent-info, #3b82f6)';  bg = 'rgba(59,130,246,0.08)'; icon = 'ℹ'; }
    else { color = 'var(--accent-success, #22c55e)'; bg = 'rgba(34,197,94,0.08)'; icon = '✓'; }
    html += '<div style="padding:6px 8px; background:' + bg + '; border-left:2px solid ' + color + '; font-size:0.6rem; color:' + color + '; margin-bottom:6px;">' +
      icon + ' ' + s.message;
    if (s.action) {
      html += '<button onclick=\'veFEAApplyRefinementSuggestion("' + node.id + '", "' + s.action.type + '", ' + JSON.stringify(s.action) + ')\' style="display:block; margin-top:4px; padding:4px 8px; font-size:0.58rem; background:' + color + '; color:#fff; border:none; cursor:pointer;">Uygula →</button>';
    }
    html += '</div>';
  });
  return html;
}
