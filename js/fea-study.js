// ============================================================================
// FEA STUDY — Birleşik "Yapısal Analiz" Modülü (Faz 1)
// ============================================================================
// ANSYS Mechanical'ın "Model" ağacı gibi: Geometri + Mesh + Sınır Koşulları +
// Çözüm tek bir node'da, tek bir ağaçta toplanır. Önceki 4-node zinciri
// (fea-geometry → fea-mesh → fea-bc → fea-solver) artık TEK 'fea' node'una
// göçürülür; pipeline edge'ler yerine ağaç hiyerarşisiyle ifade edilir.
//
// Bu dosya saf-mantık katmanı: veri modeli + migration + node bulma. UI
// (outline / modal / viewer) ayrı dosyalarda. Jest ile bağımsız test edilir.
//
// Birleşik node veri modeli:
//   node.type === 'fea'
//   node.data = {
//     geometry:               { type, params, ... } | null   (eski fea-geometry)
//     meshSettings:           { size, ..., bodySizingControls, outline }  (eski fea-mesh)
//     meshData / meshMetrics / meshActive / namedSelectionsSummary
//     bc:                     { materialId, assignments[] }   (eski fea-bc)
//     solver:                 { tolerance, maxIter, results } (eski fea-solver)
//   }
//
// Public API:
//   veFEACreateModuleData()           → yeni modül için default data
//   veFEAIsModuleNode(node)           → node bir 'fea' modülü mü
//   veFEAGetModuleNode()              → aktif projedeki tek fea modülü (veya null)
//   veFEAMigrateChainToModule(state)  → eski 4-node zinciri tek node'a göçür
//                                       (state.nodes / state.connections mutasyonu)
//   veFEAModuleHasChain(state)        → state'te eski zincir var mı (test/teşhis)
// ============================================================================

(function(global) {
  'use strict';

  var FEA_CHILD_TYPES = ['fea-geometry', 'fea-mesh', 'fea-bc', 'fea-solver'];

  // ─── Default veri ─────────────────────────────────────────────────────────
  function veFEACreateModuleData() {
    return {
      geometry: null,
      meshSettings: {
        size: 10,
        mode: 'auto',
        elementType: 'auto',
        bodySizingControls: [],
        faceSizingControls: [],
        edgeSizingControls: [],
        sphereOfInfluence: [],
        refinementControls: [],
        methodOverrides: [],
        virtualTopology: [],
        userNamedSelections: [],
        matchControls: [],
        pinchControls: [],
        gasketControls: [],
        coordinateSystems: [],
        suppressFlags: {}
      },
      meshActive: false,
      bc: { materialId: 'steel-st37', assignments: [] },
      solver: { tolerance: 1e-8, maxIter: 0 }
    };
  }

  function veFEAIsModuleNode(node) {
    return !!(node && node.type === 'fea');
  }

  function veFEAGetModuleNode() {
    if (typeof global.nodes === 'undefined' || !Array.isArray(global.nodes)) return null;
    for (var i = 0; i < global.nodes.length; i++) {
      if (global.nodes[i].type === 'fea') return global.nodes[i];
    }
    return null;
  }

  // ─── Migration: eski 4-node zinciri → tek modül node ───────────────────────
  // state.nodes ve state.connections'ı YERİNDE değiştirir; dönüş değeri state.
  // Idempotent: zaten modül node varsa veya hiç FEA child yoksa dokunmaz.
  function veFEAMigrateChainToModule(state) {
    if (!state || !Array.isArray(state.nodes)) return state;

    // Eski child node'ları topla
    var byType = {};
    state.nodes.forEach(function(n) {
      if (FEA_CHILD_TYPES.indexOf(n.type) >= 0 && !byType[n.type]) {
        byType[n.type] = n;
      }
    });
    var geom   = byType['fea-geometry'] || null;
    var mesh   = byType['fea-mesh'] || null;
    var bc     = byType['fea-bc'] || null;
    var solver = byType['fea-solver'] || null;

    // Hiç eski child yoksa migration gerekmez
    if (!geom && !mesh && !bc && !solver) return state;

    // Birleşik veri — default'tan başla, eski verileri üzerine bindir
    var merged = veFEACreateModuleData();
    if (geom && geom.data) {
      if (geom.data.geometry) merged.geometry = geom.data.geometry;
    }
    if (mesh && mesh.data) {
      // Mesh sub-data alanlarını taşı (meshSettings + computed alanlar)
      if (mesh.data.meshSettings) {
        // default meshSettings ile birleştir (yeni alanlar korunur)
        merged.meshSettings = _mergeMeshSettings(merged.meshSettings, mesh.data.meshSettings);
      }
      ['meshData', 'meshMetrics', 'meshActive', 'namedSelectionsSummary', 'selectedFaceId', 'highlightedSelection', 'heatMapMetric'].forEach(function(k) {
        if (mesh.data[k] !== undefined) merged[k] = mesh.data[k];
      });
    }
    if (bc && bc.data && bc.data.bc) {
      merged.bc = bc.data.bc;
    }
    if (solver && solver.data && solver.data.solver) {
      merged.solver = solver.data.solver;
    }

    // Anchor: geometri node'unun konumu/ID'si tercih edilir (en üstteki blok)
    var anchor = geom || mesh || bc || solver;
    var moduleNode = {
      id: anchor.id,
      type: 'fea',
      x: anchor.x,
      y: anchor.y,
      width: anchor.width || 65,
      height: anchor.height || 60,
      customName: '',
      data: merged
    };

    // Eski node id'leri
    var oldIds = [geom, mesh, bc, solver].filter(Boolean).map(function(n) { return n.id; });

    // Node listesinden eski child'ları çıkar, modül node'unu ekle
    state.nodes = state.nodes.filter(function(n) {
      return oldIds.indexOf(n.id) < 0;
    });
    state.nodes.push(moduleNode);

    // Eski child'lar arası bağlantıları temizle (zincir edge'leri)
    if (Array.isArray(state.connections)) {
      state.connections = state.connections.filter(function(c) {
        return oldIds.indexOf(c.from) < 0 && oldIds.indexOf(c.to) < 0;
      });
    }

    return state;
  }

  // meshSettings birleştir: default (yeni alanlar) + eski (kullanıcı değerleri).
  // Eski değerler önceliklidir; yeni alan tipleri (bodySizingControls vb.)
  // eksikse default'tan tamamlanır.
  function _mergeMeshSettings(defaults, old) {
    var out = {};
    Object.keys(defaults).forEach(function(k) { out[k] = defaults[k]; });
    Object.keys(old).forEach(function(k) { out[k] = old[k]; });
    // Yeni liste alanları eksikse default boş dizi ile tamamla
    ['bodySizingControls', 'faceSizingControls', 'edgeSizingControls',
     'sphereOfInfluence', 'refinementControls', 'methodOverrides',
     'virtualTopology', 'userNamedSelections',
     'matchControls', 'pinchControls', 'gasketControls', 'coordinateSystems'].forEach(function(k) {
      if (!Array.isArray(out[k])) out[k] = [];
    });
    if (!out.suppressFlags || typeof out.suppressFlags !== 'object') out.suppressFlags = {};
    return out;
  }

  function veFEAModuleHasChain(state) {
    if (!state || !Array.isArray(state.nodes)) return false;
    return state.nodes.some(function(n) { return FEA_CHILD_TYPES.indexOf(n.type) >= 0; });
  }

  // ─── Export ────────────────────────────────────────────────────────────────
  var api = {
    FEA_CHILD_TYPES:           FEA_CHILD_TYPES,
    veFEACreateModuleData:     veFEACreateModuleData,
    veFEAIsModuleNode:         veFEAIsModuleNode,
    veFEAGetModuleNode:        veFEAGetModuleNode,
    veFEAMigrateChainToModule: veFEAMigrateChainToModule,
    veFEAModuleHasChain:       veFEAModuleHasChain,
    _mergeMeshSettings:        _mergeMeshSettings
  };

  // Global fonksiyon export (mevcut kod tarzı: global function'lar)
  global.veFEACreateModuleData     = veFEACreateModuleData;
  global.veFEAIsModuleNode         = veFEAIsModuleNode;
  global.veFEAGetModuleNode        = veFEAGetModuleNode;
  global.veFEAMigrateChainToModule = veFEAMigrateChainToModule;
  global.veFEAModuleHasChain       = veFEAModuleHasChain;
  global.FEAStudy = api;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }

})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this));
