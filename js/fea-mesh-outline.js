// ============================================================================
// FEA MESH OUTLINE — ANSYS-tarzı Tree Outline + Details Pane
// ============================================================================
// ANSYS Mechanical'ın Mesh dalı outline yapısını MFSim'in mesh editörüne taşır.
// Sol panelin üst yarısında hiyerarşik bir ağaç (Globals, Lokal Kontroller,
// Inspection); alt yarısında seçili objenin Details formu.
//
// Tasarım ilkeleri (rapor §7'den):
//   1. Hiyerarşi: declarative SCHEMA — group / single / controlList / readonly
//   2. Details Pane bağı: outline'da seçilen düğüm → alt panele formu açar
//   3. Scope: lokal kontrol objeleri kendi içlerinde face/edge/body listesi tutar
//   4. State: her satırda ok / underdefined / error / suppressed ikonu
//   5. Suppress: silmeden geçici devre dışı bırak (meshSettings.suppressFlags)
//   6. Ağaç sırası ≠ işlem sırası: mesher kontrolleri kendi conflict resolution
//      kurallarıyla işler (hard > soft, vb.) — kullanıcı sırayla uğraşmaz.
//
// Mevcut data backward-compat: faceSizingControls / edgeSizingControls /
// sphereOfInfluence / virtualTopology / localSizing alanları olduğu gibi
// korunur. Outline UI, eski listeleri ve yeni bodySizing/refinement/method
// override listelerini birleşik bir ağaçta sunar.
//
// Public API (window.FEAMeshOutline):
//   .init(nodeId)            → bir mesh node için outline state'ini hazırla
//   .render()                → outline tree HTML'i üret
//   .renderDetails()         → seçili düğümün details HTML'ini üret
//   .select(outlineId)       → düğüm seç, details paneli yenile
//   .toggleExpand(groupId)   → grup düğümünü aç/kapat
//   .addControl(controlType) → yeni lokal kontrol objesi ekle
//   .removeControl(id)       → lokal kontrol objesini sil
//   .toggleSuppress(id)      → suppress/unsuppress
//   .renameControl(id, name) → lokal kontrolün label'ını değiştir
//   .refresh()               → outline + details yeniden çiz
//   .computeNodeState(...)   → bir outline düğümü için state hesabı
//   .activeSelection()       → şu an seçili outline id
// ============================================================================

(function(global) {
  'use strict';

  // ─────────────────────────────────────────────────────────────────────────
  // 1. OUTLINE SCHEMA — declarative ağaç tanımı
  // ─────────────────────────────────────────────────────────────────────────
  // Her schema düğümü:
  //   id          : outline içinde benzersiz kimlik (state/expand/select için)
  //   type        : 'group' | 'single' | 'controlList' | 'readonly'
  //   label       : kullanıcıya gösterilen ad
  //   icon        : kısa unicode ikon (görsel ayraç)
  //   controlType : controlList için → veri kaynağı anahtarı
  //   children    : group için alt düğümler
  //   detail      : detail renderer dispatcher key (single/readonly için)
  //
  // controlType anahtarları (data path'leri):
  //   bodySizing       → meshSettings.bodySizingControls   (YENİ)
  //   faceSizing       → meshSettings.faceSizingControls   (mevcut)
  //   edgeSizing       → meshSettings.edgeSizingControls   (mevcut)
  //   soi              → meshSettings.sphereOfInfluence    (mevcut)
  //   refinement       → meshSettings.refinementControls   (YENİ)
  //   methodOverride   → meshSettings.methodOverrides      (YENİ)
  //   virtualTopology  → meshSettings.virtualTopology      (mevcut)

  var SCHEMA = {
    id: 'root',
    type: 'root',
    label: 'Yapısal Analiz',
    icon: '▣',
    children: [
      { id: 'single:geometry', type: 'single', label: 'Geometri', icon: '◈', detail: 'geometry' },
      {
        id: 'group:mesh',
        type: 'group',
        label: 'Mesh',
        icon: '◆',
        defaultExpanded: true,
        children: [
          {
            id: 'group:globals',
            type: 'group',
            label: 'Globals',
            icon: '⚙',
            defaultExpanded: true,
            children: [
              { id: 'single:defaults',  type: 'single', label: 'Varsayılanlar',                              icon: '⚙', detail: 'defaults' },
              { id: 'single:sizing',    type: 'single', label: 'Boyutlandırma',                              icon: '↔', detail: 'sizing' },
              { id: 'single:inflation', type: 'single', label: 'Lokal Yoğunlaştırma / Inflation (Tek)',      icon: '〰', detail: 'inflation' }
            ]
          },
          {
            id: 'group:localControls',
            type: 'group',
            label: 'Lokal Kontroller',
            icon: '⊙',
            defaultExpanded: true,
            children: [
              { id: 'cl:bodySizing',     type: 'controlList', controlType: 'bodySizing',     label: 'Body Sizing',         icon: '◧' },
              { id: 'cl:faceSizing',     type: 'controlList', controlType: 'faceSizing',     label: 'Face Sizing',         icon: '◰' },
              { id: 'cl:edgeSizing',     type: 'controlList', controlType: 'edgeSizing',     label: 'Edge Sizing',         icon: '╱' },
              { id: 'cl:soi',            type: 'controlList', controlType: 'soi',            label: 'Sphere of Influence', icon: '◯' },
              { id: 'cl:refinement',     type: 'controlList', controlType: 'refinement',     label: 'Refinement',          icon: '⊞' },
              { id: 'cl:methodOverride', type: 'controlList', controlType: 'methodOverride', label: 'Method Override',     icon: '✎' }
            ]
          },
          {
            id: 'group:topologyTools',
            type: 'group',
            label: 'Topoloji Araçları',
            icon: '◇',
            defaultExpanded: false,
            children: [
              { id: 'cl:virtualTopology', type: 'controlList', controlType: 'virtualTopology', label: 'Virtual Topology', icon: '◇' },
              { id: 'single:namedSel',    type: 'single',      label: 'Named Selections (Atanmış Yüzeyler)',              icon: '⊟', detail: 'namedSel' }
            ]
          },
          {
            id: 'group:inspect',
            type: 'group',
            label: 'Mesh Sonrası İnceleme',
            icon: '🔍',
            defaultExpanded: false,
            children: [
              { id: 'inspect:quality',     type: 'readonly', label: 'Kalite Metrikleri (Aspect / Skewness / Açı + Jacobian / Geçerlilik)', icon: '✓', detail: 'quality' },
              { id: 'inspect:statistics',  type: 'readonly', label: 'İstatistikler',      icon: 'Σ', detail: 'statistics' },
              { id: 'inspect:display',     type: 'readonly', label: 'Görünüm Modu',       icon: '◐', detail: 'display' },
              { id: 'inspect:suggestions', type: 'readonly', label: 'Adaptif İnceltme Önerileri', icon: '💡', detail: 'suggestions' },
              { id: 'inspect:convergence', type: 'readonly', label: 'Convergence Study',  icon: '〰', detail: 'convergence' },
              { id: 'inspect:topology',    type: 'readonly', label: 'Geometri Topolojisi', icon: '◊', detail: 'topology' }
            ]
          }
        ]
      },
      { id: 'single:bc',     type: 'single', label: 'Sınır Koşulları', icon: '⊥', detail: 'bc' },
      { id: 'single:solver', type: 'single', label: 'Çözüm (Solution)', icon: '►', detail: 'solver' }
    ]
  };

  // ─────────────────────────────────────────────────────────────────────────
  // 2. CONTROL META — her control tipi için label/scope/state/default kuralı
  // ─────────────────────────────────────────────────────────────────────────
  // Her control tipi:
  //   storageKey       : meshSettings altındaki array property adı
  //   labelOf(c, idx)  : tek bir kontrol için kullanıcıya gösterilen ad
  //   scopeOf(c)       : { kind, entityType, entities[] } — state hesabı için
  //   stateOf(c, ctx)  : tek bir kontrolün state'i — 'ok' | 'underdefined' | 'error'
  //   detailKey        : detail renderer adı (renderDetails dispatcher)
  //   factoryOf(node)  : "Yeni Ekle" → default control objesi üret
  //   afterChange()    : opsiyonel — kontrol değişince mesher cache invalidate vs.

  var CONTROL_META = {
    bodySizing: {
      storageKey: 'bodySizingControls',
      detailKey:  'bodySizingItem',
      labelOf: function(c, idx) {
        if (c && c.name) return c.name;
        return 'Body Sizing ' + (idx + 1);
      },
      scopeOf: function(c) {
        return {
          kind: 'geometry', entityType: 'body',
          entities: Array.isArray(c.bodyIds) ? c.bodyIds.slice() : []
        };
      },
      stateOf: function(c) {
        if (!c) return 'underdefined';
        if (!Array.isArray(c.bodyIds) || c.bodyIds.length === 0) return 'underdefined';
        if (!isFinite(c.size) || c.size <= 0) return 'underdefined';
        return 'ok';
      },
      factoryOf: function(meshNode) {
        var defaultSize = (meshNode && meshNode.data && meshNode.data.meshSettings && meshNode.data.meshSettings.size) || 10;
        return {
          name:      null,
          bodyIds:   [],            // empty → underdefined
          size:      defaultSize / 2,
          behavior:  'soft',         // 'soft' | 'hard'
          growthRate: 1.20
        };
      }
    },
    faceSizing: {
      storageKey: 'faceSizingControls',
      detailKey:  'faceSizingItem',
      labelOf: function(c, idx) {
        if (c && c.name) return c.name;
        var fid = c && (c.faceId != null ? c.faceId : (c.faceIds && c.faceIds[0]));
        return 'Face Sizing ' + (idx + 1) + (fid != null ? ' (' + fid + ')' : '');
      },
      scopeOf: function(c) {
        var ents = [];
        if (Array.isArray(c.faceIds))     ents = c.faceIds.slice();
        else if (c.faceId != null)        ents = [c.faceId];
        return { kind: 'geometry', entityType: 'face', entities: ents };
      },
      stateOf: function(c) {
        if (!c) return 'underdefined';
        var hasFace = (Array.isArray(c.faceIds) && c.faceIds.length > 0) || c.faceId != null;
        if (!hasFace) return 'underdefined';
        if (!isFinite(c.size) || c.size <= 0) return 'underdefined';
        return 'ok';
      },
      factoryOf: function(meshNode) {
        return { name: null, faceId: null, size: 5, behavior: 'soft' };
      }
    },
    edgeSizing: {
      storageKey: 'edgeSizingControls',
      detailKey:  'edgeSizingItem',
      labelOf: function(c, idx) {
        if (c && c.name) return c.name;
        var eid = c && (c.edgeId != null ? c.edgeId : (c.edgeIds && c.edgeIds[0]));
        return 'Edge Sizing ' + (idx + 1) + (eid != null ? ' (' + eid + ')' : '');
      },
      scopeOf: function(c) {
        var ents = Array.isArray(c.edgeIds) ? c.edgeIds.slice()
                 : (c.edgeId != null ? [c.edgeId] : []);
        return { kind: 'geometry', entityType: 'edge', entities: ents };
      },
      stateOf: function(c) {
        if (!c) return 'underdefined';
        var hasEdge = (Array.isArray(c.edgeIds) && c.edgeIds.length > 0) || c.edgeId != null;
        if (!hasEdge) return 'underdefined';
        // 'divisions' veya 'size' geçerli olmalı
        var hasSize = isFinite(c.size) && c.size > 0;
        var hasDiv = isFinite(c.divisions) && c.divisions >= 1;
        if (!hasSize && !hasDiv) return 'underdefined';
        return 'ok';
      },
      factoryOf: function(meshNode) {
        return { name: null, edgeId: null, size: 5, divisions: null, bias: 0, behavior: 'soft' };
      }
    },
    soi: {
      storageKey: 'sphereOfInfluence',
      detailKey:  'soiItem',
      labelOf: function(c, idx) {
        if (c && c.name) return c.name;
        return 'Sphere of Influence ' + (idx + 1);
      },
      scopeOf: function(c) {
        return { kind: 'world', entityType: 'point', entities: [] };
      },
      stateOf: function(c) {
        if (!c) return 'underdefined';
        if (!isFinite(c.radius) || c.radius <= 0) return 'underdefined';
        return 'ok';
      },
      factoryOf: function(meshNode) {
        return { name: null, cx: 0, cy: 0, cz: 0, radius: 10, targetSize: null };
      }
    },
    refinement: {
      storageKey: 'refinementControls',
      detailKey:  'refinementItem',
      labelOf: function(c, idx) {
        if (c && c.name) return c.name;
        var ent = '';
        if (c && Array.isArray(c.faceIds) && c.faceIds.length) ent = 'F:' + c.faceIds.join(',');
        else if (c && Array.isArray(c.edgeIds) && c.edgeIds.length) ent = 'E:' + c.edgeIds.join(',');
        else if (c && Array.isArray(c.vertexIds) && c.vertexIds.length) ent = 'V:' + c.vertexIds.join(',');
        return 'Refinement ' + (idx + 1) + (ent ? ' [' + ent + ']' : '');
      },
      scopeOf: function(c) {
        var et = c && c.entityType ? c.entityType : 'face';
        var listKey = ({ face: 'faceIds', edge: 'edgeIds', vertex: 'vertexIds' })[et] || 'faceIds';
        var ents = (c && Array.isArray(c[listKey])) ? c[listKey].slice() : [];
        return { kind: 'geometry', entityType: et, entities: ents };
      },
      stateOf: function(c) {
        if (!c) return 'underdefined';
        var et = c.entityType || 'face';
        var listKey = ({ face: 'faceIds', edge: 'edgeIds', vertex: 'vertexIds' })[et] || 'faceIds';
        if (!Array.isArray(c[listKey]) || c[listKey].length === 0) return 'underdefined';
        var lvl = c.level;
        if (!isFinite(lvl) || lvl < 1 || lvl > 3) return 'underdefined';
        return 'ok';
      },
      factoryOf: function(meshNode) {
        return { name: null, entityType: 'face', faceIds: [], edgeIds: [], vertexIds: [], level: 1 };
      }
    },
    methodOverride: {
      storageKey: 'methodOverrides',
      detailKey:  'methodOverrideItem',
      labelOf: function(c, idx) {
        if (c && c.name) return c.name;
        var bodies = (c && Array.isArray(c.bodyIds) && c.bodyIds.length) ? '[' + c.bodyIds.join(',') + ']' : '';
        var m = c && c.method ? c.method : '?';
        return 'Method ' + (idx + 1) + ': ' + m + (bodies ? ' ' + bodies : '');
      },
      scopeOf: function(c) {
        return {
          kind: 'geometry', entityType: 'body',
          entities: Array.isArray(c.bodyIds) ? c.bodyIds.slice() : []
        };
      },
      stateOf: function(c) {
        if (!c) return 'underdefined';
        if (!Array.isArray(c.bodyIds) || c.bodyIds.length === 0) return 'underdefined';
        if (!c.method) return 'underdefined';
        return 'ok';
      },
      factoryOf: function(meshNode) {
        return { name: null, bodyIds: [], method: 'automatic', elementOrder: 'program' };
      }
    },
    virtualTopology: {
      storageKey: 'virtualTopology',
      detailKey:  'virtualTopologyItem',
      labelOf: function(c, idx) {
        if (c && c.name) return c.name;
        return 'Virtual Group ' + (idx + 1);
      },
      scopeOf: function(c) {
        return {
          kind: 'geometry', entityType: 'face',
          entities: Array.isArray(c.faceIds) ? c.faceIds.slice() : []
        };
      },
      stateOf: function(c) {
        if (!c) return 'underdefined';
        if (!Array.isArray(c.faceIds) || c.faceIds.length < 2) return 'underdefined';
        return 'ok';
      },
      factoryOf: function(meshNode) {
        return { name: null, faceIds: [] };
      }
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // 3. STATE — per-mesh-node outline state (persisted in meshSettings.outline)
  // ─────────────────────────────────────────────────────────────────────────
  // node.data.meshSettings.outline = {
  //   selected:  'cl:bodySizing[0]' | 'single:defaults' | ...
  //   expanded:  { 'group:localControls': true, 'cl:bodySizing': true, ... }
  //   splitPct:  50   // outline ↔ details vertical split
  // }
  // node.data.meshSettings.suppressFlags = { '<outlineId>': true, ... }

  function _getMeshNode(nodeId) {
    if (typeof global.nodes === 'undefined' || !Array.isArray(global.nodes)) return null;
    for (var i = 0; i < global.nodes.length; i++) {
      if (global.nodes[i].id === nodeId) return global.nodes[i];
    }
    return null;
  }

  function _getOutlineState(meshNode) {
    if (!meshNode) return null;
    meshNode.data = meshNode.data || {};
    meshNode.data.meshSettings = meshNode.data.meshSettings || {};
    if (!meshNode.data.meshSettings.outline) {
      meshNode.data.meshSettings.outline = {
        selected:  'single:geometry',
        expanded:  _defaultExpanded(),
        splitPct:  50
      };
    }
    if (!meshNode.data.meshSettings.suppressFlags) {
      meshNode.data.meshSettings.suppressFlags = {};
    }
    return meshNode.data.meshSettings.outline;
  }

  function _defaultExpanded() {
    var exp = {};
    function visit(n) {
      if (n.type === 'group' || n.type === 'root' || n.type === 'controlList') {
        // Açıkça defaultExpanded: false → kapalı; aksi halde açık.
        exp[n.id] = (n.defaultExpanded !== false);
      }
      if (Array.isArray(n.children)) n.children.forEach(visit);
    }
    visit(SCHEMA);
    // Mesh dalı default açık (en sık kullanılan); Globals + Lokal Kontroller açık
    exp['group:mesh']         = true;
    // Lokal kontrol grupları default kapalı kalsın (kalabalıklığı azaltır)
    exp['cl:bodySizing']     = false;
    exp['cl:faceSizing']     = false;
    exp['cl:edgeSizing']     = false;
    exp['cl:soi']            = false;
    exp['cl:refinement']     = false;
    exp['cl:methodOverride'] = false;
    exp['cl:virtualTopology']= false;
    return exp;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 4. DATA ACCESS — control list okuma (eski + yeni alanlar)
  // ─────────────────────────────────────────────────────────────────────────

  function _getControlList(meshNode, controlType) {
    if (!meshNode || !meshNode.data) return [];
    var settings = meshNode.data.meshSettings;
    if (!settings) return [];
    var meta = CONTROL_META[controlType];
    if (!meta) return [];
    var arr = settings[meta.storageKey];
    return Array.isArray(arr) ? arr : [];
  }

  function _setControlList(meshNode, controlType, list) {
    if (!meshNode) return;
    meshNode.data = meshNode.data || {};
    meshNode.data.meshSettings = meshNode.data.meshSettings || {};
    var meta = CONTROL_META[controlType];
    if (!meta) return;
    meshNode.data.meshSettings[meta.storageKey] = list;
  }

  function _controlOutlineId(controlType, idx) {
    return 'cl:' + controlType + '[' + idx + ']';
  }

  function _parseControlOutlineId(outlineId) {
    var m = outlineId && outlineId.match(/^cl:([a-zA-Z]+)\[(\d+)\]$/);
    if (!m) return null;
    return { controlType: m[1], index: parseInt(m[2], 10) };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 5. STATE COMPUTATION — bir outline düğümünün state'i
  // ─────────────────────────────────────────────────────────────────────────

  function _isSuppressed(meshNode, outlineId) {
    if (!meshNode || !meshNode.data || !meshNode.data.meshSettings) return false;
    var flags = meshNode.data.meshSettings.suppressFlags || {};
    return flags[outlineId] === true;
  }

  function _getMeshError(meshNode, outlineId) {
    if (!meshNode || !meshNode.data || !meshNode.data.meshError) return null;
    var err = meshNode.data.meshError;
    if (err && err.controlKey === outlineId) return err.message || 'Hata';
    return null;
  }

  // computeNodeState: outline id → 'ok' | 'underdefined' | 'error' | 'suppressed'
  // | 'info' (readonly info node) | 'parent' (group node; child'lardan en kötüsünü ver)
  function computeNodeState(meshNode, outlineId) {
    if (!meshNode) return 'underdefined';
    if (_isSuppressed(meshNode, outlineId)) return 'suppressed';
    var err = _getMeshError(meshNode, outlineId);
    if (err) return 'error';

    // Control list satırı: 'cl:bodySizing[0]'
    var parsed = _parseControlOutlineId(outlineId);
    if (parsed) {
      var meta = CONTROL_META[parsed.controlType];
      if (!meta) return 'underdefined';
      var list = _getControlList(meshNode, parsed.controlType);
      var c = list[parsed.index];
      if (!c) return 'underdefined';
      return meta.stateOf(c);
    }

    // Control list grubu: 'cl:bodySizing'
    if (outlineId.indexOf('cl:') === 0 && CONTROL_META[outlineId.slice(3)]) {
      var ct = outlineId.slice(3);
      var list2 = _getControlList(meshNode, ct);
      if (list2.length === 0) return 'info';
      // Worst-of-children
      var worst = 'ok';
      for (var i = 0; i < list2.length; i++) {
        var childId = _controlOutlineId(ct, i);
        var s = computeNodeState(meshNode, childId);
        worst = _worstState(worst, s);
      }
      return worst;
    }

    // Inspection: readonly info
    if (outlineId.indexOf('inspect:') === 0) {
      // Mesh oluşturulmamışsa info; hatalıysa error.
      var d = meshNode.data || {};
      if (!d.meshActive) return 'info';
      // Quality için Jacobian valid değilse error.
      if (outlineId === 'inspect:quality' && d.meshMetrics && d.meshMetrics.jacobian && !d.meshMetrics.jacobian.valid) {
        return 'error';
      }
      return 'ok';
    }

    // Study dalları: geometry / bc / solver — duruma göre state
    if (outlineId === 'single:geometry') {
      var gd = meshNode.data || {};
      return (gd.geometry && gd.geometry.type) ? 'ok' : 'underdefined';
    }
    if (outlineId === 'single:bc') {
      var bcd = (meshNode.data && meshNode.data.bc) || {};
      var asg = Array.isArray(bcd.assignments) ? bcd.assignments : [];
      return asg.length > 0 ? 'ok' : 'info';
    }
    if (outlineId === 'single:solver') {
      var sv = (meshNode.data && meshNode.data.solver) || {};
      return (sv.results) ? 'ok' : 'info';
    }

    // Globals ve diğer single düğümler: hep ok kabul edelim — eksik tanım yok.
    if (outlineId.indexOf('single:') === 0) {
      return 'ok';
    }

    // Group: worst-of-children
    if (outlineId.indexOf('group:') === 0 || outlineId === 'root') {
      var node = _findSchemaNode(outlineId);
      if (!node || !Array.isArray(node.children) || node.children.length === 0) return 'info';
      var worst2 = 'info';
      node.children.forEach(function(child) {
        worst2 = _worstState(worst2, computeNodeState(meshNode, child.id));
      });
      return worst2;
    }

    return 'info';
  }

  // 'ok' < 'info' < 'suppressed' < 'underdefined' < 'error'  (badge öncelikleri)
  var _STATE_RANK = { ok: 0, info: 1, suppressed: 2, underdefined: 3, error: 4 };
  function _worstState(a, b) {
    return (_STATE_RANK[b] > _STATE_RANK[a]) ? b : a;
  }

  function _findSchemaNode(outlineId) {
    var found = null;
    (function visit(n) {
      if (found) return;
      if (n.id === outlineId) { found = n; return; }
      if (Array.isArray(n.children)) n.children.forEach(visit);
    })(SCHEMA);
    return found;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 6. STATE ICONS — görsel sözlük
  // ─────────────────────────────────────────────────────────────────────────
  // Rapor §5'teki tabloyu birebir takip eder; turuncu vurgu yayılımı outline
  // satırı yerine parent group satırına yansıtılır (_worstState ile).

  var STATE_ICONS = {
    ok:            { glyph: '●', color: '#22c55e', title: 'Geçerli' },
    info:          { glyph: '○', color: '#64748b', title: 'Bilgi' },
    suppressed:    { glyph: '⊘', color: '#94a3b8', title: 'Suppress edilmiş' },
    underdefined:  { glyph: '⚠', color: '#f59e0b', title: 'Eksik tanım' },
    error:         { glyph: '✗', color: '#ef4444', title: 'Hata' }
  };

  function _stateIcon(state) {
    var s = STATE_ICONS[state] || STATE_ICONS.info;
    return '<span title="' + s.title + '" style="display:inline-block; width:13px; text-align:center; color:' + s.color + '; font-weight:700; font-size:0.74rem;">' + s.glyph + '</span>';
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 7. RENDER — outline tree HTML üretimi
  // ─────────────────────────────────────────────────────────────────────────

  function render() {
    var meshNode = _activeMeshNode();
    if (!meshNode) return '<div style="padding:14px; font-size:0.62rem; color:var(--text-muted);">Mesh node bulunamadı.</div>';
    var state = _getOutlineState(meshNode);

    var html = '';
    html += '<div class="ve-fea-outline-tree" style="padding:6px 0 8px; font-size:0.66rem; user-select:none;">';
    html += _renderNode(SCHEMA, meshNode, state, 0);
    html += '</div>';
    return html;
  }

  function _renderNode(schemaNode, meshNode, outlineState, depth) {
    if (schemaNode.type === 'root') {
      // Root satırı: outline başlığı + state özet
      var rootState = computeNodeState(meshNode, schemaNode.id);
      var html = '';
      html += _renderRow({
        outlineId:  schemaNode.id,
        label:      schemaNode.label,
        icon:       schemaNode.icon,
        depth:      depth,
        state:      rootState,
        expandable: true,
        expanded:   true,            // root her zaman açık
        selectable: false,
        meshNode:   meshNode,
        outlineState: outlineState,
        rightExtra: ''
      });
      (schemaNode.children || []).forEach(function(child) {
        html += _renderNode(child, meshNode, outlineState, depth + 1);
      });
      return html;
    }

    if (schemaNode.type === 'group') {
      var groupState = computeNodeState(meshNode, schemaNode.id);
      var expanded = outlineState.expanded[schemaNode.id] !== false; // default true
      var html2 = _renderRow({
        outlineId:  schemaNode.id,
        label:      schemaNode.label,
        icon:       schemaNode.icon,
        depth:      depth,
        state:      groupState,
        expandable: true,
        expanded:   expanded,
        selectable: false,
        meshNode:   meshNode,
        outlineState: outlineState,
        rightExtra: ''
      });
      if (expanded) {
        (schemaNode.children || []).forEach(function(child) {
          html2 += _renderNode(child, meshNode, outlineState, depth + 1);
        });
      }
      return html2;
    }

    if (schemaNode.type === 'single' || schemaNode.type === 'readonly') {
      var sState = computeNodeState(meshNode, schemaNode.id);
      var sel = outlineState.selected === schemaNode.id;
      return _renderRow({
        outlineId:  schemaNode.id,
        label:      schemaNode.label,
        icon:       schemaNode.icon,
        depth:      depth,
        state:      sState,
        expandable: false,
        selectable: true,
        selected:   sel,
        meshNode:   meshNode,
        outlineState: outlineState,
        rightExtra: ''
      });
    }

    if (schemaNode.type === 'controlList') {
      var ct = schemaNode.controlType;
      var list = _getControlList(meshNode, ct);
      var groupOutlineId = schemaNode.id;
      var listExpanded = outlineState.expanded[groupOutlineId] === true; // default false
      var groupState2 = computeNodeState(meshNode, groupOutlineId);

      // Sağ taraf: kontrol sayısı + (+ ekle) butonu
      var countBadge = list.length > 0
        ? '<span style="background:rgba(148,163,184,0.18); color:var(--text-secondary); padding:1px 6px; font-size:0.55rem; font-weight:600; margin-right:4px;">' + list.length + '</span>'
        : '';
      var addBtn = '<button onclick="event.stopPropagation(); FEAMeshOutline.addControl(\'' + ct + '\')" title="+ Ekle" style="background:transparent; border:1px solid var(--border-color); color:var(--text-secondary); cursor:pointer; padding:0 6px; font-size:0.6rem; font-weight:600;" onmouseenter="this.style.color=\'var(--accent-primary)\';this.style.borderColor=\'var(--accent-primary)\'" onmouseleave="this.style.color=\'var(--text-secondary)\';this.style.borderColor=\'var(--border-color)\'">+</button>';

      var html3 = _renderRow({
        outlineId:  groupOutlineId,
        label:      schemaNode.label,
        icon:       schemaNode.icon,
        depth:      depth,
        state:      groupState2,
        expandable: true,
        expanded:   listExpanded,
        selectable: false,
        meshNode:   meshNode,
        outlineState: outlineState,
        rightExtra: countBadge + addBtn
      });

      if (listExpanded) {
        if (list.length === 0) {
          html3 += '<div style="padding:3px 8px 6px ' + ((depth + 1) * 12 + 14) + 'px; font-size:0.56rem; color:var(--text-muted); font-style:italic;">— boş —</div>';
        } else {
          list.forEach(function(c, idx) {
            var itemId = _controlOutlineId(ct, idx);
            var meta = CONTROL_META[ct];
            var lbl  = meta.labelOf(c, idx);
            var iState = computeNodeState(meshNode, itemId);
            var sel = outlineState.selected === itemId;
            var rightExtra = '<button onclick="event.stopPropagation(); FEAMeshOutline.toggleSuppress(\'' + itemId + '\')" title="Suppress/Unsuppress" style="background:transparent; border:none; color:var(--text-secondary); cursor:pointer; padding:0 3px; font-size:0.66rem;" onmouseenter="this.style.color=\'var(--accent-warning)\'" onmouseleave="this.style.color=\'var(--text-secondary)\'">' + (iState === 'suppressed' ? '◉' : '⊘') + '</button>' +
                             '<button onclick="event.stopPropagation(); FEAMeshOutline.removeControl(\'' + itemId + '\')" title="Sil" style="background:transparent; border:none; color:var(--text-secondary); cursor:pointer; padding:0 3px; font-size:0.66rem;" onmouseenter="this.style.color=\'var(--accent-danger)\'" onmouseleave="this.style.color=\'var(--text-secondary)\'">✕</button>';
            html3 += _renderRow({
              outlineId:  itemId,
              label:      lbl,
              icon:       '·',
              depth:      depth + 1,
              state:      iState,
              expandable: false,
              selectable: true,
              selected:   sel,
              meshNode:   meshNode,
              outlineState: outlineState,
              rightExtra: rightExtra,
              suppressed: iState === 'suppressed'
            });
          });
        }
      }
      return html3;
    }

    return '';
  }

  function _renderRow(opts) {
    var indent = opts.depth * 12;
    var bg = 'transparent';
    var fg = 'var(--text-primary)';
    if (opts.selected) {
      bg = 'rgba(59,130,246,0.18)';
      fg = '#bfdbfe';
    }
    var fontStyle = opts.suppressed ? 'text-decoration:line-through; opacity:0.55;' : '';
    var clickHandler = '';
    if (opts.selectable) {
      clickHandler = 'onclick="FEAMeshOutline.select(\'' + opts.outlineId + '\')"';
    } else if (opts.expandable) {
      clickHandler = 'onclick="FEAMeshOutline.toggleExpand(\'' + opts.outlineId + '\')"';
    }
    var caret = '';
    if (opts.expandable) {
      caret = '<span style="display:inline-block; width:12px; text-align:center; color:var(--text-muted); font-size:0.6rem;">' + (opts.expanded ? '▾' : '▸') + '</span>';
    } else {
      caret = '<span style="display:inline-block; width:12px;"></span>';
    }
    var icon = opts.icon ? '<span style="display:inline-block; width:14px; text-align:center; opacity:0.75; font-size:0.74rem;">' + opts.icon + '</span>' : '';
    var stIcon = _stateIcon(opts.state);
    var html = '';
    html += '<div ' + clickHandler + ' data-outline-id="' + opts.outlineId + '" ' +
            'style="display:flex; align-items:center; gap:4px; padding:3px 8px 3px ' + (indent + 6) + 'px; cursor:' + (clickHandler ? 'pointer' : 'default') + '; background:' + bg + '; color:' + fg + '; border-left:2px solid ' + (opts.selected ? 'var(--accent-primary)' : 'transparent') + '; transition:background 0.08s;" ' +
            (opts.selectable || opts.expandable ? 'onmouseenter="if(!this.dataset.selected)this.style.background=\'rgba(148,163,184,0.10)\'" onmouseleave="if(!this.dataset.selected)this.style.background=\'' + (opts.selected ? 'rgba(59,130,246,0.18)' : 'transparent') + '\'"' : '') + '>';
    html += caret + icon;
    html += '<span style="flex:1; ' + fontStyle + ' white-space:nowrap; overflow:hidden; text-overflow:ellipsis; font-weight:' + (opts.depth <= 1 ? '600' : '500') + ';">' + _escapeHtml(opts.label) + '</span>';
    html += '<span style="display:flex; align-items:center; gap:4px;">' + (opts.rightExtra || '') + stIcon + '</span>';
    html += '</div>';
    return html;
  }

  function _escapeHtml(s) {
    if (s == null) return '';
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 8. DETAILS RENDERER — seçili düğüm için alt panel HTML'i
  // ─────────────────────────────────────────────────────────────────────────
  // Mevcut _veFEAEditor*HTML üreteçleri (defaults, sizing, inflation, namedSel,
  // quality, vs.) olduğu gibi delege edilir; lokal kontrol item'ları için
  // fea-mesh-controls.js'teki yeni renderer'lar veya mevcut HTML üreteçlerinin
  // tek-item versiyonları kullanılır.

  function renderDetails() {
    var meshNode = _activeMeshNode();
    if (!meshNode) return _emptyDetail('Mesh node bulunamadı.');
    var state = _getOutlineState(meshNode);
    var sel = state.selected || 'single:defaults';

    // Suppress edilmiş kontrol için bilgi banner'ı
    if (_isSuppressed(meshNode, sel)) {
      return _wrapDetail('⊘ Suppress edilmiş kontrol', _renderDetailBody(meshNode, sel),
        'Bu kontrol mesh oluşturulurken yok sayılıyor. Yeniden aktif etmek için Unsuppress düğmesine tıkla.');
    }

    return _wrapDetail(_detailTitle(sel, meshNode), _renderDetailBody(meshNode, sel), null);
  }

  function _detailTitle(outlineId, meshNode) {
    var schemaNode = _findSchemaNode(outlineId);
    if (schemaNode) return (schemaNode.icon ? schemaNode.icon + ' ' : '') + schemaNode.label;
    var parsed = _parseControlOutlineId(outlineId);
    if (parsed) {
      var meta = CONTROL_META[parsed.controlType];
      if (meta) {
        var list = _getControlList(meshNode, parsed.controlType);
        var c = list[parsed.index];
        return '· ' + meta.labelOf(c, parsed.index);
      }
    }
    return outlineId;
  }

  function _wrapDetail(title, body, note) {
    var html = '';
    html += '<div class="ve-fea-details-pane" style="padding:8px 12px 14px; font-size:0.66rem;">';
    html += '<div style="display:flex; align-items:center; gap:6px; padding:4px 0 8px; border-bottom:1px solid var(--border-color); margin-bottom:10px;">';
    html += '<div style="font-size:0.72rem; font-weight:700; color:var(--text-heading); letter-spacing:0.02em;">' + _escapeHtml(title) + '</div>';
    html += '</div>';
    if (note) {
      html += '<div style="padding:6px 8px; background:rgba(245,158,11,0.1); border-left:2px solid var(--accent-warning, #f59e0b); font-size:0.58rem; color:var(--accent-warning, #f59e0b); margin-bottom:10px; line-height:1.5;">' + note + '</div>';
    }
    html += body;
    html += '</div>';
    return html;
  }

  function _emptyDetail(msg) {
    return '<div style="padding:18px 12px; font-size:0.62rem; color:var(--text-muted); text-align:center; font-style:italic;">' + _escapeHtml(msg) + '</div>';
  }

  function _renderDetailBody(meshNode, outlineId) {
    // Study dalları (Geometri / Sınır Koşulları / Çözüm) — mevcut cp-fea.js
    // panel üreteçlerini birebir yeniden kullan (tek node tüm sub-data'yı tutar).
    var studyDispatch = {
      'single:geometry': function(n) { return (typeof getFEAGeometryPropertiesHTML === 'function') ? getFEAGeometryPropertiesHTML(n) : _emptyDetail('Geometri paneli yüklenmedi'); },
      'single:bc':       function(n) { return (typeof getFEABCPropertiesHTML === 'function') ? getFEABCPropertiesHTML(n) : _emptyDetail('Sınır Koşulları paneli yüklenmedi'); },
      'single:solver':   function(n) { return (typeof getFEASolverPropertiesHTML === 'function') ? getFEASolverPropertiesHTML(n) : _emptyDetail('Çözücü paneli yüklenmedi'); }
    };
    if (studyDispatch[outlineId]) return studyDispatch[outlineId](meshNode);

    // Mevcut _veFEAEditor*HTML üreteçleri için dispatch
    var legacyDispatch = {
      'single:defaults':    function(n) { return (typeof _veFEAEditorDefaultsHTML === 'function') ? _veFEAEditorDefaultsHTML(n) : _emptyDetail('Defaults renderer yüklenmedi'); },
      'single:sizing':      function(n) { return (typeof _veFEAEditorSizingHTML === 'function') ? _veFEAEditorSizingHTML(n) : _emptyDetail('Sizing renderer yüklenmedi'); },
      'single:inflation':   function(n) { return (typeof _veFEAEditorInflationHTML === 'function') ? _veFEAEditorInflationHTML(n) : _emptyDetail('Inflation renderer yüklenmedi'); },
      'single:namedSel':    function(n) { return (typeof _veFEAEditorNamedSelHTML === 'function') ? _veFEAEditorNamedSelHTML(n) : _emptyDetail('NamedSel renderer yüklenmedi'); },
      'inspect:quality':    function(n) { return (typeof _veFEAEditorQualityHTML === 'function') ? _veFEAEditorQualityHTML(n) : _emptyDetail('Quality renderer yüklenmedi'); },
      'inspect:statistics': function(n) { return (typeof _veFEAEditorStatisticsHTML === 'function') ? _veFEAEditorStatisticsHTML(n) : _emptyDetail('Statistics renderer yüklenmedi'); },
      'inspect:display':    function(n) { return (typeof _veFEAEditorDisplayHTML === 'function') ? _veFEAEditorDisplayHTML(n) : _emptyDetail('Display renderer yüklenmedi'); },
      'inspect:suggestions':function(n) { return (typeof _veFEAEditorSuggestionsHTML === 'function') ? _veFEAEditorSuggestionsHTML(n) : _emptyDetail('Suggestions renderer yüklenmedi'); },
      'inspect:convergence':function(n) { return (typeof _veFEAEditorConvergenceHTML === 'function') ? _veFEAEditorConvergenceHTML(n) : _emptyDetail('Convergence renderer yüklenmedi'); },
      'inspect:topology':   function(n) { return (typeof _veFEAEditorTopologyHTML === 'function') ? _veFEAEditorTopologyHTML(n) : _emptyDetail('Topology renderer yüklenmedi'); }
    };

    if (legacyDispatch[outlineId]) return legacyDispatch[outlineId](meshNode);

    // Control list grup başlığı: kontrol listesini topluca göster + "+ Ekle" butonu
    if (outlineId.indexOf('cl:') === 0 && CONTROL_META[outlineId.slice(3)]) {
      return _renderControlGroupSummary(meshNode, outlineId.slice(3));
    }

    // Tekil kontrol satırı
    var parsed = _parseControlOutlineId(outlineId);
    if (parsed) {
      // Yeni tipler için fea-mesh-controls.js'teki renderer'a delege
      if (typeof global.FEAMeshControls !== 'undefined' &&
          typeof global.FEAMeshControls.renderControlDetail === 'function') {
        return global.FEAMeshControls.renderControlDetail(meshNode, parsed.controlType, parsed.index);
      }
      return _emptyDetail('Control renderer yüklenmedi (' + parsed.controlType + ')');
    }

    // Group: özet göster
    if (outlineId.indexOf('group:') === 0 || outlineId === 'root') {
      return _renderGroupSummary(meshNode, outlineId);
    }

    return _emptyDetail('Bilinmeyen outline düğümü: ' + outlineId);
  }

  function _renderControlGroupSummary(meshNode, controlType) {
    var meta = CONTROL_META[controlType];
    if (!meta) return _emptyDetail('Bilinmeyen control tipi: ' + controlType);
    var list = _getControlList(meshNode, controlType);

    var labels = {
      bodySizing:      { plural: 'Body Sizing',     description: 'Bir veya birden çok body için lokal eleman boyutu.' },
      faceSizing:      { plural: 'Face Sizing',     description: 'Geometrideki bir yüze lokal eleman boyutu (ANSYS §5.1).' },
      edgeSizing:      { plural: 'Edge Sizing',     description: 'Bir kenara eleman sayısı veya boyut + bias kontrolü (ANSYS §5.5).' },
      soi:             { plural: 'Sphere of Influence', description: 'Bir küre içinde lokal yoğunlaştırma (ANSYS §5.2).' },
      refinement:      { plural: 'Refinement',      description: 'Mevcut elemanları 1-3 seviye böler (ANSYS §5.4).' },
      methodOverride:  { plural: 'Method Override', description: 'Bir body için mesh yöntemini global ayarın yerine geçiren özel kontrol.' },
      virtualTopology: { plural: 'Virtual Topology', description: 'Birden çok yüzü tek bir mesh edilecek bölge olarak gruplar (ANSYS §8.2).' }
    };
    var info = labels[controlType] || { plural: controlType, description: '' };

    var html = '';
    html += '<div style="font-size:0.6rem; color:var(--text-muted); line-height:1.5; margin-bottom:10px;">' + info.description + '</div>';
    html += '<div style="display:flex; gap:6px; align-items:center; margin-bottom:10px;">';
    html += '<button onclick="FEAMeshOutline.addControl(\'' + controlType + '\')" style="padding:6px 12px; font-size:0.66rem; font-weight:600; background:var(--accent-primary); color:#fff; border:none; cursor:pointer;">+ Yeni ' + info.plural + ' Ekle</button>';
    html += '<span style="font-size:0.58rem; color:var(--text-muted);">' + list.length + ' kontrol</span>';
    html += '</div>';
    if (list.length === 0) {
      html += '<div style="padding:10px 12px; background:var(--bg-primary); border:1px dashed var(--border-color); font-size:0.6rem; color:var(--text-muted); text-align:center;">Bu tip için tanımlı kontrol yok.</div>';
    } else {
      html += '<div style="display:flex; flex-direction:column; gap:4px;">';
      list.forEach(function(c, idx) {
        var itemId = _controlOutlineId(controlType, idx);
        var s = computeNodeState(meshNode, itemId);
        var ico = _stateIcon(s);
        var lbl = meta.labelOf(c, idx);
        html += '<div onclick="FEAMeshOutline.select(\'' + itemId + '\')" style="display:flex; align-items:center; gap:6px; padding:5px 8px; background:var(--bg-primary); border:1px solid var(--border-color); cursor:pointer; font-size:0.62rem;" onmouseenter="this.style.borderColor=\'var(--accent-primary)\'" onmouseleave="this.style.borderColor=\'var(--border-color)\'">';
        html += ico;
        html += '<span style="flex:1; color:var(--text-primary);">' + _escapeHtml(lbl) + '</span>';
        html += '<span style="font-size:0.55rem; color:var(--text-muted);">→ Düzenle</span>';
        html += '</div>';
      });
      html += '</div>';
    }
    return html;
  }

  function _renderGroupSummary(meshNode, outlineId) {
    var schemaNode = _findSchemaNode(outlineId);
    if (!schemaNode) return _emptyDetail('Grup bulunamadı: ' + outlineId);
    var html = '';
    html += '<div style="font-size:0.6rem; color:var(--text-muted); line-height:1.5; margin-bottom:10px;">Bu grupta ' + (schemaNode.children || []).length + ' alt düğüm var. Soldaki ağaçtan bir alt düğümü seçerek ayarlarını düzenleyebilirsin.</div>';
    html += '<div style="display:flex; flex-direction:column; gap:4px;">';
    (schemaNode.children || []).forEach(function(child) {
      var s = computeNodeState(meshNode, child.id);
      var ico = _stateIcon(s);
      html += '<div onclick="FEAMeshOutline.select(\'' + child.id + '\')" style="display:flex; align-items:center; gap:6px; padding:5px 8px; background:var(--bg-primary); border:1px solid var(--border-color); cursor:pointer; font-size:0.62rem;" onmouseenter="this.style.borderColor=\'var(--accent-primary)\'" onmouseleave="this.style.borderColor=\'var(--border-color)\'">';
      html += ico;
      html += '<span style="opacity:0.75;">' + (child.icon || '·') + '</span>';
      html += '<span style="flex:1; color:var(--text-primary);">' + _escapeHtml(child.label) + '</span>';
      html += '<span style="font-size:0.55rem; color:var(--text-muted);">→</span>';
      html += '</div>';
    });
    html += '</div>';
    return html;
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 9. EVENT HANDLERS — select, toggleExpand, addControl, removeControl, ...
  // ─────────────────────────────────────────────────────────────────────────

  var _activeNodeId = null;

  function _activeMeshNode() {
    if (!_activeNodeId) return null;
    return _getMeshNode(_activeNodeId);
  }

  function init(nodeId) {
    _activeNodeId = nodeId;
    // Diğer modüller (fea-mesh-controls.js handler'ları) buradan erişir
    global.__feaMeshOutlineActiveNodeId = nodeId;
    var meshNode = _activeMeshNode();
    if (meshNode) {
      // Migration: eski tek-instance suppressFlags formatı yoksa kur.
      _migrateLegacyLayout(meshNode);
      // Default expanded set
      _getOutlineState(meshNode);
    }
  }

  function activeMeshNodeId() {
    return _activeNodeId;
  }

  function deactivate() {
    _activeNodeId = null;
    global.__feaMeshOutlineActiveNodeId = null;
  }

  function _migrateLegacyLayout(meshNode) {
    if (!meshNode || !meshNode.data) return;
    var s = meshNode.data.meshSettings;
    if (!s) return;
    // Tek-instance localSizing geri uyumu: eski v1 inflation alanları
    // tek-instance olarak duruyor; outline'da `single:inflation` olarak gösterilir.
    // Yapısal değişiklik gerekmiyor — sadece varsayılan defaultExpanded'i kontrol et.
  }

  function refresh() {
    if (!_activeNodeId) return;
    var outlineContainer = (typeof document !== 'undefined') ? document.getElementById('ve-fea-outline-container') : null;
    var detailsContainer = (typeof document !== 'undefined') ? document.getElementById('ve-fea-details-container') : null;
    if (outlineContainer) outlineContainer.innerHTML = render();
    if (detailsContainer) detailsContainer.innerHTML = renderDetails();
    // Mesh node badge'i güncellensin (üst topology view'de görünür)
    if (typeof global.veFEAUpdateMeshNodeBadge === 'function') {
      try { global.veFEAUpdateMeshNodeBadge(_activeNodeId); } catch (e) {}
    }
  }

  function select(outlineId) {
    var meshNode = _activeMeshNode();
    if (!meshNode) return;
    var state = _getOutlineState(meshNode);
    state.selected = outlineId;
    // Seçilen satır control list ise içeren grubu otomatik aç
    var parsed = _parseControlOutlineId(outlineId);
    if (parsed) {
      var groupId = 'cl:' + parsed.controlType;
      state.expanded[groupId] = true;
    }
    if (typeof global.saveState === 'function') {
      try { global.saveState(); } catch (e) {}
    }
    refresh();
  }

  function activeSelection() {
    var meshNode = _activeMeshNode();
    if (!meshNode) return null;
    var state = _getOutlineState(meshNode);
    return state.selected;
  }

  function toggleExpand(outlineId) {
    var meshNode = _activeMeshNode();
    if (!meshNode) return;
    var state = _getOutlineState(meshNode);
    var cur = state.expanded[outlineId];
    state.expanded[outlineId] = !(cur === true);
    if (typeof global.saveState === 'function') {
      try { global.saveState(); } catch (e) {}
    }
    refresh();
  }

  function addControl(controlType) {
    var meta = CONTROL_META[controlType];
    var meshNode = _activeMeshNode();
    if (!meta || !meshNode) return;
    var list = _getControlList(meshNode, controlType).slice();
    var obj = meta.factoryOf(meshNode);
    list.push(obj);
    _setControlList(meshNode, controlType, list);
    var newId = _controlOutlineId(controlType, list.length - 1);
    var state = _getOutlineState(meshNode);
    state.selected = newId;
    state.expanded['cl:' + controlType] = true;
    if (typeof global.saveState === 'function') {
      try { global.saveState(); } catch (e) {}
    }
    refresh();
    return newId;
  }

  function removeControl(outlineId) {
    var parsed = _parseControlOutlineId(outlineId);
    if (!parsed) return;
    var meshNode = _activeMeshNode();
    if (!meshNode) return;
    var list = _getControlList(meshNode, parsed.controlType).slice();
    if (parsed.index < 0 || parsed.index >= list.length) return;
    list.splice(parsed.index, 1);
    _setControlList(meshNode, parsed.controlType, list);
    // Suppress flag'i de temizle
    var state = _getOutlineState(meshNode);
    var suppFlags = meshNode.data.meshSettings.suppressFlags || {};
    delete suppFlags[outlineId];
    // Sonraki indeksler için suppress flag'larını da kaydır
    var ct = parsed.controlType;
    var prefix = 'cl:' + ct + '[';
    var rebuilt = {};
    Object.keys(suppFlags).forEach(function(k) {
      if (k.indexOf(prefix) !== 0) { rebuilt[k] = suppFlags[k]; return; }
      var mm = k.match(/^cl:[a-zA-Z]+\[(\d+)\]$/);
      if (!mm) { rebuilt[k] = suppFlags[k]; return; }
      var i = parseInt(mm[1], 10);
      if (i < parsed.index) { rebuilt[k] = suppFlags[k]; }
      else if (i > parsed.index) { rebuilt['cl:' + ct + '[' + (i - 1) + ']'] = suppFlags[k]; }
      // i === parsed.index → drop
    });
    meshNode.data.meshSettings.suppressFlags = rebuilt;
    // Seçimi parent grubuna kaydır
    if (state.selected === outlineId) {
      state.selected = 'cl:' + parsed.controlType;
    }
    if (typeof global.saveState === 'function') {
      try { global.saveState(); } catch (e) {}
    }
    refresh();
  }

  function toggleSuppress(outlineId) {
    var meshNode = _activeMeshNode();
    if (!meshNode) return;
    meshNode.data = meshNode.data || {};
    meshNode.data.meshSettings = meshNode.data.meshSettings || {};
    var flags = meshNode.data.meshSettings.suppressFlags = meshNode.data.meshSettings.suppressFlags || {};
    flags[outlineId] = !(flags[outlineId] === true);
    if (!flags[outlineId]) delete flags[outlineId];
    if (typeof global.saveState === 'function') {
      try { global.saveState(); } catch (e) {}
    }
    refresh();
  }

  function renameControl(outlineId, newName) {
    var parsed = _parseControlOutlineId(outlineId);
    if (!parsed) return;
    var meshNode = _activeMeshNode();
    if (!meshNode) return;
    var list = _getControlList(meshNode, parsed.controlType).slice();
    var c = list[parsed.index];
    if (!c) return;
    c.name = String(newName || '').trim() || null;
    _setControlList(meshNode, parsed.controlType, list);
    if (typeof global.saveState === 'function') {
      try { global.saveState(); } catch (e) {}
    }
    refresh();
  }

  function updateControlField(outlineId, fieldPath, value) {
    // İç içe alan setter: fieldPath = 'size' veya 'scope.entities'
    var parsed = _parseControlOutlineId(outlineId);
    if (!parsed) return;
    var meshNode = _activeMeshNode();
    if (!meshNode) return;
    var list = _getControlList(meshNode, parsed.controlType).slice();
    var c = list[parsed.index];
    if (!c) return;
    var parts = String(fieldPath).split('.');
    var obj = c;
    for (var i = 0; i < parts.length - 1; i++) {
      var p = parts[i];
      if (obj[p] == null || typeof obj[p] !== 'object') obj[p] = {};
      obj = obj[p];
    }
    obj[parts[parts.length - 1]] = value;
    _setControlList(meshNode, parsed.controlType, list);
    if (typeof global.saveState === 'function') {
      try { global.saveState(); } catch (e) {}
    }
    refresh();
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 10. EXPORT
  // ─────────────────────────────────────────────────────────────────────────

  var api = {
    // Public
    init:               init,
    render:             render,
    renderDetails:      renderDetails,
    refresh:            refresh,
    select:             select,
    toggleExpand:       toggleExpand,
    addControl:         addControl,
    removeControl:      removeControl,
    toggleSuppress:     toggleSuppress,
    renameControl:      renameControl,
    updateControlField: updateControlField,
    activeSelection:    activeSelection,
    activeMeshNodeId:   activeMeshNodeId,
    deactivate:         deactivate,
    computeNodeState:   computeNodeState,
    isSuppressed:       function(meshNode, outlineId) { return _isSuppressed(meshNode, outlineId); },
    // Internal (test için)
    _SCHEMA:            SCHEMA,
    _CONTROL_META:      CONTROL_META,
    _findSchemaNode:    _findSchemaNode,
    _worstState:        _worstState,
    _getControlList:    _getControlList,
    _setControlList:    _setControlList,
    _controlOutlineId:  _controlOutlineId,
    _parseControlOutlineId: _parseControlOutlineId,
    _stateRank:         _STATE_RANK
  };

  global.FEAMeshOutline = api;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }

})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this));
