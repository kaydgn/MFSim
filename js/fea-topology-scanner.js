// ============================================================================
// FEA TOPOLOJİ MOTORU — ANSYS-tarzı animasyonlu tarama
// ============================================================================
// Geometri Yapısal Analiz Editörü'ne entegre edildikten sonra, geometrinin
// tüm yüzeylerini / kenarlarını / köşelerini "tarayan" görsel bir animasyon.
// ANSYS Workbench'in geometri yükleme deneyimini taklit eder:
//
//   FAZ 1 — Yüzeyler   : her yüzey sırayla YEŞİL yanar
//   FAZ 2 — Kenarlar   : her kenar sırayla CYAN yanar
//   FAZ 3 — Köşeler    : her köşe sırayla SARI yanar
//
// 3D viewer'ın sağ alt köşesinde bir progress bar + canlı tespit sayacı
// ("8/12 yüzey · 14 kenar · 6 köşe") görünür. Tarama bitince topology
// tamamen tanımlanır ve normal görünüme (edge/vertex overlay) geçilir.
//
// Public API:
//   veFEAStartTopologyScan(nodeId, opts)   → taramayı başlat
//   veFEACancelTopologyScan(nodeId)        → devam eden taramayı durdur
//   veFEAIsTopologyScanning(nodeId)        → tarama sürüyor mu?
//
// opts: {
//   durationMs: 2200,   // toplam hedef süre (faz'lara bölünür)
//   auto: false,        // otomatik tetikleme bilgisi (loglama için)
//   onComplete: fn      // tamamlanınca callback
// }
// ============================================================================

// Tarama renkleri (faz başına)
var VE_FEA_SCAN_FACE_COLOR   = 0x22c55e;  // yeşil
var VE_FEA_SCAN_EDGE_COLOR   = 0x06d6f5;  // cyan
var VE_FEA_SCAN_VERTEX_COLOR = 0xfbbf24;  // sarı

// Aktif tarama durumları — nodeId → { rafId, cancelled, ... }
var _veFEAActiveScanState = {};

// Bir mesh node'u için topoloji taramasını başlat.
// ─── Buton girişi: STEP ise önce gerçek BREP topolojisi çıkar, sonra tara ────
// cp-fea Geometri sekmesindeki "Topolojiyi Tara" butonu bunu çağırır.
// STEP geometri + rawData + full OCCT mevcutsa: 65MB WASM lazy-load + gerçek
// B-Rep topolojisi (Euler, gerçek tipler). Aksi halde mevcut analitik/mesh
// topolojiyle doğrudan tarama (graceful fallback).
function veFEAScanTopologyButton(nodeId, opts) {
  opts = opts || {};
  _veFEAScanPrepareBrep(nodeId).then(function() {
    veFEAStartTopologyScan(nodeId, opts);
  }).catch(function(err) {
    console.warn('[FEA Scan] BREP hazırlık hatası, mevcut topoloji ile devam:', err && err.message);
    veFEAStartTopologyScan(nodeId, opts);
  });
}

// STEP geometri için full OCCT BREP topolojisini lazy-load ile hazırla.
// Dönüş: Promise (her durumda resolve — hata → graceful).
function _veFEAScanPrepareBrep(nodeId) {
  if (typeof nodes === 'undefined') return Promise.resolve(false);
  var node = nodes.find(function(n) { return n.id === nodeId; });
  if (!node) return Promise.resolve(false);
  // Geometriyi bul (upstream veya birleşik modül)
  var geom = _veFEAScanGeometryOf(nodeId);
  if (!geom || geom.type !== 'step') return Promise.resolve(false);  // sadece STEP
  // Zaten BREP topolojisi varsa tekrar etme
  if (geom.topology && geom.topology.brep) return Promise.resolve(false);
  // OCCT modülü ve STEP raw verisi mevcut mu?
  if (typeof veFEAOcctTopologyFromStepBuffer !== 'function') return Promise.resolve(false);
  if (!geom.rawDataB64 || typeof veFEABase64ToArrayBuffer !== 'function') {
    // Raw veri yok (büyük dosya / yeniden yükleme gerekli) → fallback
    return Promise.resolve(false);
  }
  var buffer;
  try { buffer = veFEABase64ToArrayBuffer(geom.rawDataB64); }
  catch (e) { return Promise.resolve(false); }

  // Yükleme göstergesi (mesh editör overlay)
  if (typeof veFEAEditorShowLoading === 'function') {
    veFEAEditorShowLoading('B-Rep Topoloji Motoru yükleniyor…',
      'OpenCASCADE çekirdeği (~65MB) ilk seferde indiriliyor. Kesin yüzey/kenar/köşe çıkarılacak.');
  }
  return veFEAOcctTopologyFromStepBuffer(buffer, {
    wasmJsUrl: 'vendor/opencascade-full/opencascade.wasm.js',
    fileName: (geom.sourceLabel || 'import') + '.step',
    sampleEdges: true
  }).then(function(brepTopo) {
    if (typeof veFEAEditorHideLoading === 'function') veFEAEditorHideLoading();
    if (brepTopo && Array.isArray(brepTopo.faces) && brepTopo.faces.length > 0) {
      // Geometri topology'sini gerçek BREP ile değiştir (kalıcı)
      geom.topology = brepTopo;
      if (typeof showToast === 'function') {
        var v = brepTopo.validity || {};
        showToast('Gerçek B-Rep topolojisi çıkarıldı: ' + brepTopo.faces.length + ' yüz, ' +
          brepTopo.edges.length + ' kenar, ' + brepTopo.vertices.length + ' köşe' +
          (v.manifold ? ' (manifold ✓)' : ''), 'success');
      }
      return true;
    }
    // BREP çıkmadıysa graceful (mevcut topoloji kalır)
    if (typeof showToast === 'function') {
      showToast('B-Rep çıkarılamadı, mesh-tabanlı topoloji ile devam ediliyor.', 'warning');
    }
    return false;
  }).catch(function(err) {
    if (typeof veFEAEditorHideLoading === 'function') veFEAEditorHideLoading();
    if (typeof showToast === 'function') {
      showToast('OCCT yüklenemedi (' + (err && err.message ? err.message : 'asset yok') +
        '). Mesh-tabanlı topoloji ile devam.', 'warning');
    }
    return false;
  });
}

// nodeId için geometri nesnesini bul (upstream veya birleşik modül).
function _veFEAScanGeometryOf(nodeId) {
  if (typeof nodes === 'undefined') return null;
  var geomNode = (typeof veFEAFindUpstreamGeometryNode === 'function')
    ? veFEAFindUpstreamGeometryNode(nodeId) : null;
  if (geomNode && geomNode.data && geomNode.data.geometry) return geomNode.data.geometry;
  var node = nodes.find(function(n) { return n.id === nodeId; });
  if (node && node.data && node.data.geometry) return node.data.geometry;
  return null;
}

function veFEAStartTopologyScan(nodeId, opts) {
  opts = opts || {};
  // Zaten tarama varsa iptal et (yeniden başlat)
  veFEACancelTopologyScan(nodeId);

  // Viewer + topology'yi al
  var viewer = (typeof veFEAViewerRegistry !== 'undefined') ? veFEAViewerRegistry[nodeId] : null;
  if (!viewer) return false;
  var topo = _veFEAScanResolveTopology(nodeId);
  if (!topo || !Array.isArray(topo.faces) || topo.faces.length === 0) return false;

  var faces = topo.faces.slice();
  var edges = Array.isArray(topo.edges) ? topo.edges.slice() : [];
  var verts = Array.isArray(topo.vertices) ? topo.vertices.slice() : [];

  // Uzaysal sweep sırası — yüzeyleri centroid'e göre sırala (sol→sağ, alt→üst).
  // Daha "süpürme" hissi verir (rastgele yerine düzenli yanma).
  _veFEAScanSortBySweep(faces);
  _veFEAScanSortBySweep(edges);
  _veFEAScanSortBySweep(verts);

  // Topology data'yı viewer'a yükle (edge/vertex overlay altyapısı hazır olsun),
  // ama scan modunda hepsi gizli başlar (scanState boş).
  if (typeof viewer.setTopologyData === 'function') viewer.setTopologyData(topo);
  viewer.setScanState({ faces: {}, edges: {}, vertices: {},
    faceColor: VE_FEA_SCAN_FACE_COLOR, edgeColor: VE_FEA_SCAN_EDGE_COLOR, vertexColor: VE_FEA_SCAN_VERTEX_COLOR });

  // Toplam süre — faz başına bölüştür (yüzey %45, kenar %35, köşe %20)
  var totalMs = (isFinite(opts.durationMs) && opts.durationMs > 400) ? opts.durationMs : 2200;
  var phases = [];
  if (faces.length > 0) phases.push({ kind: 'faces',    items: faces, color: VE_FEA_SCAN_FACE_COLOR, weight: 0.45, label: 'Yüzeyler taranıyor' });
  if (edges.length > 0) phases.push({ kind: 'edges',    items: edges, color: VE_FEA_SCAN_EDGE_COLOR, weight: 0.35, label: 'Kenarlar taranıyor' });
  if (verts.length > 0) phases.push({ kind: 'vertices', items: verts, color: VE_FEA_SCAN_VERTEX_COLOR, weight: 0.20, label: 'Köşeler taranıyor' });
  // Ağırlık normalizasyonu (bazı fazlar yoksa)
  var wSum = phases.reduce(function(s, p) { return s + p.weight; }, 0) || 1;
  phases.forEach(function(p) { p.durationMs = Math.max(250, totalMs * (p.weight / wSum)); });

  // Progress bar DOM'unu oluştur
  var progressEl = _veFEAScanBuildProgressUI(nodeId);

  var state = {
    nodeId: nodeId, viewer: viewer, topo: topo, phases: phases,
    cancelled: false, rafId: null, progressEl: progressEl,
    onComplete: opts.onComplete,
    // Canlı sayaç toplamları
    counts: { faces: 0, edges: 0, vertices: 0 },
    totals: { faces: faces.length, edges: edges.length, vertices: verts.length },
    // Tarama state map'leri (kümülatif — yanm faces korunur)
    shown: { faces: {}, edges: {}, vertices: {} }
  };
  _veFEAActiveScanState[nodeId] = state;

  _veFEAScanRunPhases(state, 0);
  return true;
}

// Devam eden taramayı durdur + temizle (topology normal görünüme döner).
function veFEACancelTopologyScan(nodeId) {
  var state = _veFEAActiveScanState[nodeId];
  if (!state) return;
  state.cancelled = true;
  if (state.rafId != null && typeof cancelAnimationFrame !== 'undefined') {
    cancelAnimationFrame(state.rafId);
  }
  if (state.viewer && typeof state.viewer.clearScanState === 'function') {
    state.viewer.clearScanState();
  }
  _veFEAScanRemoveProgressUI(nodeId);
  delete _veFEAActiveScanState[nodeId];
}

function veFEAIsTopologyScanning(nodeId) {
  return !!_veFEAActiveScanState[nodeId];
}

// ─── Faz yürütme (rekürsif) ────────────────────────────────────────────────
function _veFEAScanRunPhases(state, phaseIdx) {
  if (state.cancelled) return;
  if (phaseIdx >= state.phases.length) {
    _veFEAScanFinish(state);
    return;
  }
  var phase = state.phases[phaseIdx];
  var startTime = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
  var n = phase.items.length;

  function step() {
    if (state.cancelled) return;
    var now = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
    var elapsed = now - startTime;
    var frac = Math.min(1, elapsed / phase.durationMs);
    // Kaç eleman gösterilecek (kümülatif)
    var shownCount = Math.min(n, Math.ceil(frac * n));
    // shown map'i güncelle
    var map = state.shown[phase.kind];
    for (var i = 0; i < shownCount; i++) {
      var item = phase.items[i];
      if (item && item.id) map[item.id] = true;
    }
    state.counts[phase.kind] = shownCount;
    // Viewer'a uygula (sadece bu fazın tipini güncelle — performans)
    if (phase.kind === 'faces')    state.viewer.setScanFaces(map, phase.color);
    else if (phase.kind === 'edges') state.viewer.setScanEdges(map, phase.color);
    else if (phase.kind === 'vertices') state.viewer.setScanVertices(map, phase.color);
    // Progress UI güncelle
    var overallFrac = _veFEAScanOverallProgress(state, phaseIdx, frac);
    _veFEAScanUpdateProgressUI(state, phase, overallFrac);

    if (frac >= 1) {
      // Faz tamam — sonraki faza geç
      _veFEAScanRunPhases(state, phaseIdx + 1);
    } else {
      state.rafId = (typeof requestAnimationFrame !== 'undefined')
        ? requestAnimationFrame(step)
        : setTimeout(step, 16);
    }
  }
  step();
}

// Genel ilerleme oranı (tüm fazlar boyunca 0-1)
function _veFEAScanOverallProgress(state, phaseIdx, phaseFrac) {
  var totalW = state.phases.reduce(function(s, p) { return s + p.weight; }, 0) || 1;
  var done = 0;
  for (var i = 0; i < phaseIdx; i++) done += state.phases[i].weight;
  done += state.phases[phaseIdx].weight * phaseFrac;
  return done / totalW;
}

// ─── Tamamlanma ────────────────────────────────────────────────────────────
function _veFEAScanFinish(state) {
  if (state.cancelled) return;
  // Progress bar'ı %100'e tamamla
  _veFEAScanUpdateProgressUI(state, { label: 'Topoloji tanımlandı', kind: 'done' }, 1);
  // Scan modu temizle → normal edge/vertex overlay görünümüne dön
  if (state.viewer && typeof state.viewer.clearScanState === 'function') {
    state.viewer.clearScanState();
  }
  // Topology'yi normal şekilde set et (edge/vertex overlay seçilebilir hale gelir)
  if (state.viewer && typeof state.viewer.setTopologyData === 'function') {
    state.viewer.setTopologyData(state.topo);
  }
  // node.data'ya "topoloji tarandı" bayrağı + özet
  if (typeof nodes !== 'undefined') {
    var node = nodes.find(function(n) { return n.id === state.nodeId; });
    if (node) {
      node.data = node.data || {};
      node.data.topologyScanned = true;
      node.data.topologySummary = {
        faces: state.totals.faces, edges: state.totals.edges, vertices: state.totals.vertices,
        scannedAt: Date.now()
      };
    }
  }
  // Progress bar'ı kısa süre sonra fade-out
  var nodeId = state.nodeId;
  setTimeout(function() { _veFEAScanRemoveProgressUI(nodeId); }, 900);
  // Outline ağacını + detay panelini tazele — Geometri sekmesindeki
  // "✓ Topoloji tanımlandı" durumu ve sayaçlar güncellensin.
  if (typeof FEAMeshOutline !== 'undefined') {
    try { if (FEAMeshOutline.refresh) FEAMeshOutline.refresh(); } catch (e) {}
    try {
      var dc = document.getElementById('ve-fea-details-container');
      if (dc && FEAMeshOutline.renderDetails) dc.innerHTML = FEAMeshOutline.renderDetails();
    } catch (e) {}
  }
  if (typeof veFEAEditorRefreshAccordions === 'function') {
    try { veFEAEditorRefreshAccordions(); } catch (e) {}
  }
  delete _veFEAActiveScanState[state.nodeId];
  if (typeof state.onComplete === 'function') {
    try { state.onComplete(state.topo); } catch (e) {}
  }
}

// ─── Topology çözümleme ──────────────────────────────────────────────────────
function _veFEAScanResolveTopology(nodeId) {
  if (typeof nodes === 'undefined') return null;
  // Upstream geometriyi bul (birleşik modül veya eski zincir)
  var geomNode = (typeof veFEAFindUpstreamGeometryNode === 'function')
    ? veFEAFindUpstreamGeometryNode(nodeId) : null;
  var geom = null;
  if (geomNode && geomNode.data && geomNode.data.geometry) {
    geom = geomNode.data.geometry;
  } else {
    // Birleşik modül: node'un kendi data.geometry'si
    var node = nodes.find(function(n) { return n.id === nodeId; });
    if (node && node.data && node.data.geometry) geom = node.data.geometry;
  }
  if (!geom) return null;
  var topo = geom.topology;
  if ((!topo || !Array.isArray(topo.faces)) && typeof veFEAComputeGeometryTopology === 'function') {
    topo = veFEAComputeGeometryTopology(geom);
  }
  return topo;
}

// ─── Uzaysal sweep sırası ───────────────────────────────────────────────────
// Elemanları centroid/position'a göre sırala — soldan sağa (X), sonra alttan
// üste (Y), sonra Z. "Süpürme" hissi verir.
function _veFEAScanSortBySweep(items) {
  function key(it) {
    var p = it.centroid || it.position || it.center ||
            (it.polyline && it.polyline[0]) || (it.p1) || [0, 0, 0];
    // X ağırlıklı sıralama anahtarı
    return p[0] * 1e6 + p[1] * 1e3 + p[2];
  }
  items.sort(function(a, b) { return key(a) - key(b); });
}

// ─── Progress UI ─────────────────────────────────────────────────────────────
// 3D viewer canvas container'ının sağ altına absolute positioned progress bar.
function _veFEAScanBuildProgressUI(nodeId) {
  var canvas = document.getElementById('ve-fea-mesh-canvas-' + nodeId);
  var container = canvas ? canvas.parentElement : null;
  if (!container) return null;
  // Mevcut varsa kaldır
  _veFEAScanRemoveProgressUI(nodeId);

  // Style enjekte (bir kez)
  if (!document.getElementById('ve-fea-scan-style')) {
    var st = document.createElement('style');
    st.id = 've-fea-scan-style';
    st.textContent =
      '@keyframes ve-fea-scan-fade-in { from { opacity:0; } to { opacity:1; } }' +
      '@keyframes ve-fea-scan-blink { 0%,49% { opacity:1; } 50%,100% { opacity:0.25; } }';
    document.head.appendChild(st);
  }

  // Segment'li (tık tık ilerleyen) progress bar — endüstriyel HMI tarzı.
  var SEG_COUNT = 28;
  var segHTML = '';
  for (var si = 0; si < SEG_COUNT; si++) {
    segHTML += '<div data-seg style="flex:1; height:100%; background:rgba(255,255,255,0.07);"></div>';
  }

  var box = document.createElement('div');
  box.id = 've-fea-scan-progress-' + nodeId;
  box.setAttribute('data-seg-count', String(SEG_COUNT));
  // Keskin köşe (border-radius YOK), sol kenarda renkli accent, net border.
  box.style.cssText = 'position:absolute; bottom:0; right:0; width:300px; ' +
    'padding:12px 14px 12px 16px; background:rgba(8,11,16,0.94); ' +
    'border:1px solid rgba(34,197,94,0.55); border-left:3px solid #22c55e; ' +
    'z-index:12; box-shadow:0 0 0 1px rgba(0,0,0,0.5), -6px -6px 24px rgba(0,0,0,0.45); ' +
    'animation:ve-fea-scan-fade-in 0.18s ease-out; ' +
    'font-family:-apple-system,Segoe UI,sans-serif; pointer-events:none;';
  box.innerHTML =
    '<div style="display:flex; align-items:center; gap:8px; margin-bottom:9px;">' +
      '<span data-scan-dot style="display:inline-block; width:8px; height:8px; background:#22c55e; animation:ve-fea-scan-blink 0.8s steps(1,end) infinite;"></span>' +
      '<span data-scan-title style="font-size:0.66rem; font-weight:700; color:#fff; letter-spacing:0.12em; text-transform:uppercase;">Topoloji Motoru</span>' +
      '<span data-scan-pct style="margin-left:auto; font-size:0.78rem; font-weight:700; color:#22c55e; font-family:monospace;">0%</span>' +
    '</div>' +
    '<div data-scan-phase style="font-size:0.6rem; color:rgba(255,255,255,0.65); margin-bottom:8px; min-height:0.8em; letter-spacing:0.02em;">Başlatılıyor…</div>' +
    '<div data-scan-bar style="display:flex; gap:2px; height:9px; margin-bottom:9px;">' + segHTML + '</div>' +
    '<div data-scan-counter style="display:flex; gap:12px; font-size:0.56rem; color:rgba(255,255,255,0.82); font-family:monospace; letter-spacing:0.01em;">' +
      '<span data-c-faces>▣ 0 yüzey</span>' +
      '<span data-c-edges>— 0 kenar</span>' +
      '<span data-c-verts>○ 0 köşe</span>' +
    '</div>';
  container.appendChild(box);
  return box;
}

function _veFEAScanUpdateProgressUI(state, phase, overallFrac) {
  var el = state.progressEl;
  if (!el) return;
  // Segment-bazlı (tık tık) ilerleme — yüzde, dolu segment sayısından türetilir,
  // böylece akışkan değil basamaklı (discrete) ilerler.
  var segCount = parseInt(el.getAttribute('data-seg-count'), 10) || 28;
  var filled = Math.round(overallFrac * segCount);
  if (phase.kind === 'done') filled = segCount;
  var pct = Math.round((filled / segCount) * 100);
  var colorHex = '#22c55e';
  if (phase.kind === 'edges') colorHex = '#06d6f5';
  else if (phase.kind === 'vertices') colorHex = '#fbbf24';
  else if (phase.kind === 'done') colorHex = '#22c55e';

  var titleEl = el.querySelector('[data-scan-title]');
  var pctEl   = el.querySelector('[data-scan-pct]');
  var phaseEl = el.querySelector('[data-scan-phase]');
  var segEls  = el.querySelectorAll('[data-seg]');
  var cFaces  = el.querySelector('[data-c-faces]');
  var cEdges  = el.querySelector('[data-c-edges]');
  var cVerts  = el.querySelector('[data-c-verts]');

  if (pctEl) { pctEl.textContent = pct + '%'; pctEl.style.color = colorHex; }
  // Segment'leri doldur — dolu olanlar faz rengi, boşlar soluk. transition YOK.
  for (var i = 0; i < segEls.length; i++) {
    segEls[i].style.background = (i < filled) ? colorHex : 'rgba(255,255,255,0.07)';
  }
  if (phaseEl) {
    phaseEl.textContent = (phase.kind === 'done')
      ? '✓ Tüm yüzeyler, kenarlar ve köşeler tanımlandı.'
      : (phase.label || '') + '…';
  }
  if (titleEl && phase.kind === 'done') titleEl.textContent = 'Topoloji Tanımlandı';
  // Canlı sayaç
  if (cFaces) cFaces.textContent = '▣ ' + state.counts.faces + '/' + state.totals.faces + ' yüzey';
  if (cEdges) cEdges.textContent = '— ' + state.counts.edges + (state.totals.edges ? '/' + state.totals.edges : '') + ' kenar';
  if (cVerts) cVerts.textContent = '○ ' + state.counts.vertices + (state.totals.vertices ? '/' + state.totals.vertices : '') + ' köşe';
  // Tamamlanınca border + accent yeşil parlak, blink dur
  if (phase.kind === 'done') {
    el.style.borderColor = 'rgba(34,197,94,0.95)';
    el.style.borderLeftColor = '#22c55e';
    var dot = el.querySelector('[data-scan-dot]');
    if (dot) dot.style.animation = 'none';
  } else {
    // Faz rengine göre sol accent + border tonu güncelle
    el.style.borderLeftColor = colorHex;
    var dot2 = el.querySelector('[data-scan-dot]');
    if (dot2) dot2.style.background = colorHex;
  }
}

function _veFEAScanRemoveProgressUI(nodeId) {
  var el = document.getElementById('ve-fea-scan-progress-' + nodeId);
  if (el && el.parentNode) {
    el.style.transition = 'opacity 0.3s ease';
    el.style.opacity = '0';
    setTimeout(function() { if (el.parentNode) el.parentNode.removeChild(el); }, 320);
  }
}

// Node.js (Jest) uyumu
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    veFEAStartTopologyScan: veFEAStartTopologyScan,
    veFEAScanTopologyButton: veFEAScanTopologyButton,
    veFEACancelTopologyScan: veFEACancelTopologyScan,
    veFEAIsTopologyScanning: veFEAIsTopologyScanning
  };
}
