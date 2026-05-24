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
  // Topology accordion'u tazele (sayaçlar güncellensin)
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
      '@keyframes ve-fea-scan-fade-in { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }' +
      '@keyframes ve-fea-scan-pulse { 0%,100% { opacity:1; } 50% { opacity:0.55; } }' +
      '.ve-fea-scan-bar-fill { transition: width 0.08s linear, background-color 0.3s ease; }';
    document.head.appendChild(st);
  }

  var box = document.createElement('div');
  box.id = 've-fea-scan-progress-' + nodeId;
  box.style.cssText = 'position:absolute; bottom:10px; right:10px; width:264px; ' +
    'padding:10px 12px; background:rgba(10,13,20,0.88); border:1px solid rgba(34,197,94,0.4); ' +
    'border-radius:6px; backdrop-filter:blur(3px); z-index:12; ' +
    'box-shadow:0 4px 16px rgba(0,0,0,0.4); animation:ve-fea-scan-fade-in 0.25s ease-out; ' +
    'font-family:-apple-system,Segoe UI,sans-serif; pointer-events:none;';
  box.innerHTML =
    '<div style="display:flex; align-items:center; gap:7px; margin-bottom:7px;">' +
      '<span style="display:inline-block; width:9px; height:9px; border-radius:50%; background:#22c55e; animation:ve-fea-scan-pulse 1s ease-in-out infinite;"></span>' +
      '<span data-scan-title style="font-size:0.72rem; font-weight:700; color:#fff; letter-spacing:0.01em;">Topoloji Motoru</span>' +
      '<span data-scan-pct style="margin-left:auto; font-size:0.7rem; font-weight:700; color:#22c55e;">0%</span>' +
    '</div>' +
    '<div data-scan-phase style="font-size:0.62rem; color:rgba(255,255,255,0.7); margin-bottom:6px; min-height:0.8em;">Başlatılıyor…</div>' +
    '<div style="height:7px; background:rgba(255,255,255,0.1); border-radius:4px; overflow:hidden;">' +
      '<div data-scan-fill class="ve-fea-scan-bar-fill" style="height:100%; width:0%; background:#22c55e; border-radius:4px;"></div>' +
    '</div>' +
    '<div data-scan-counter style="display:flex; gap:10px; margin-top:8px; font-size:0.58rem; color:rgba(255,255,255,0.85); font-family:monospace;">' +
      '<span data-c-faces>▣ 0 yüzey</span>' +
      '<span data-c-edges>📏 0 kenar</span>' +
      '<span data-c-verts>🔘 0 köşe</span>' +
    '</div>';
  container.appendChild(box);
  return box;
}

function _veFEAScanUpdateProgressUI(state, phase, overallFrac) {
  var el = state.progressEl;
  if (!el) return;
  var pct = Math.round(overallFrac * 100);
  var colorHex = '#22c55e';
  if (phase.kind === 'edges') colorHex = '#06d6f5';
  else if (phase.kind === 'vertices') colorHex = '#fbbf24';
  else if (phase.kind === 'done') colorHex = '#22c55e';

  var titleEl = el.querySelector('[data-scan-title]');
  var pctEl   = el.querySelector('[data-scan-pct]');
  var phaseEl = el.querySelector('[data-scan-phase]');
  var fillEl  = el.querySelector('[data-scan-fill]');
  var cFaces  = el.querySelector('[data-c-faces]');
  var cEdges  = el.querySelector('[data-c-edges]');
  var cVerts  = el.querySelector('[data-c-verts]');

  if (pctEl) { pctEl.textContent = pct + '%'; pctEl.style.color = colorHex; }
  if (fillEl) { fillEl.style.width = pct + '%'; fillEl.style.background = colorHex; }
  if (phaseEl) {
    phaseEl.textContent = (phase.kind === 'done')
      ? '✓ Tüm yüzeyler, kenarlar ve köşeler tanımlandı.'
      : (phase.label || '') + '…';
  }
  if (titleEl && phase.kind === 'done') titleEl.textContent = 'Topoloji Tanımlandı';
  // Canlı sayaç
  if (cFaces) cFaces.textContent = '▣ ' + state.counts.faces + '/' + state.totals.faces + ' yüzey';
  if (cEdges) cEdges.textContent = '📏 ' + state.counts.edges + (state.totals.edges ? '/' + state.totals.edges : '') + ' kenar';
  if (cVerts) cVerts.textContent = '🔘 ' + state.counts.vertices + (state.totals.vertices ? '/' + state.totals.vertices : '') + ' köşe';
  // Tamamlanınca border yeşil parlak
  if (phase.kind === 'done') {
    el.style.borderColor = 'rgba(34,197,94,0.9)';
    var dot = el.querySelector('span');
    if (dot) dot.style.animation = 'none';
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
    veFEACancelTopologyScan: veFEACancelTopologyScan,
    veFEAIsTopologyScanning: veFEAIsTopologyScanning
  };
}
