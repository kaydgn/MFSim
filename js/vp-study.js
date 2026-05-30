// ============================================================================
// VEHICLE PERFORMANCE STUDY — Birleşik "Araç Performans" Sistem Bloğu
// ============================================================================
// ANSYS Workbench'in "Analysis System" bloğu gibi: bir araç performans
// analizini oluşturan AŞAMALAR (Güç Aktarma Organları → Araç & Tekerlek →
// Senaryo & Yol → Çözüm → Sonuçlar) TEK bir 'vehicle-performance' node'unda,
// dikey istiflenmiş HÜCRELER olarak toplanır. Kullanıcı artık ~15 bileşeni
// elle bağlamaz; bloğu sürükler ve hücreleri sırayla doldurur.
//
// js/fea-study.js ile AYNI desen (kanıtlı): node.type bir modül; node.data
// hücrelerin alt-verisini tutar. Bu dosya saf-mantık + render yardımcıları;
// çekirdek dosyalara (ui-core / state / cp-core) yalnızca dallanma eklenir.
// jsdom/Jest ile bağımsız test edilir (module.exports).
//
// Birleşik node veri modeli:
//   node.type === 'vehicle-performance'
//   node.data = {
//     powertrain: { preset, components{} }   (A1)
//     vehicle:    { mass, area, cd }          (A2)
//     scenario:   { type, throttle }          (A3)
//     solver:     { timeMode, target, method }(A4)
//     results:    { ... } | null              (A5)
//   }
//
// Public API:
//   VP_CELLS                        → hücre tanımları (sıra/anahtar/etiket)
//   veVPCreateModuleData()          → yeni blok için default data
//   veVPIsModuleNode(node)          → node bir 'vehicle-performance' bloğu mu
//   veVPCellStatus(node, key)       → 'unfulfilled' | 'attention' | 'uptodate'
//   veVPBlockInnerHTML(node)        → tuvaldeki blok iç HTML (header + hücreler)
//   veVPAttachCellHandlers(el,node) → hücre çift-tık olaylarını bağla
//   veVPRefreshBlock(node)          → tuvaldeki bloğu yeniden çiz + handler'ları yenile
//   veVPOverviewHTML(node)          → properties panelinde genel bakış
//   veVPOpenCell(nodeId, key)       → hücre editörünü properties panelinde aç
//   veVPSetField(nodeId, cell, f, v)→ alan yaz + bloğu tazele + state kaydet
//   veVPRunSolve(nodeId)            → A4 çalıştır (iterasyon 1: stub)
// ============================================================================

(function(global) {
  'use strict';

  // ─── Hücre tanımları (sıra önemli: yukarıdan aşağı akış) ───────────────────
  var VP_CELLS = [
    { key: 'powertrain', code: 'A1', label: 'Güç Aktarma Organları' },
    { key: 'vehicle',    code: 'A2', label: 'Araç & Tekerlek' },
    { key: 'scenario',   code: 'A3', label: 'Senaryo & Yol' },
    { key: 'solver',     code: 'A4', label: 'Çözüm' },
    { key: 'results',    code: 'A5', label: 'Sonuçlar' }
  ];

  // ─── Default veri ──────────────────────────────────────────────────────────
  function veVPCreateModuleData() {
    return {
      powertrain: { preset: null, components: {} },
      vehicle:    { mass: null, area: null, cd: null },
      scenario:   { type: 'full_throttle', throttle: 100 },
      solver:     { timeMode: 'speed', target: null, method: 'rk45' },
      results:    null
    };
  }

  function veVPIsModuleNode(node) {
    return !!(node && node.type === 'vehicle-performance');
  }

  function _cellByKey(key) {
    for (var i = 0; i < VP_CELLS.length; i++) {
      if (VP_CELLS[i].key === key) return VP_CELLS[i];
    }
    return null;
  }

  // ─── Hücre "doluluk" testleri ──────────────────────────────────────────────
  function _hasPowertrain(d) {
    return !!(d && d.powertrain && (d.powertrain.preset ||
      (d.powertrain.components && Object.keys(d.powertrain.components).length > 0)));
  }
  function _hasVehicle(d) {
    return !!(d && d.vehicle && d.vehicle.mass > 0);
  }
  function _hasScenario(d) {
    return !!(d && d.scenario && d.scenario.type);
  }

  // ─── Hücre durumu (ANSYS cell-state mantığı) ───────────────────────────────
  // 'unfulfilled' : upstream eksik (önce üstteki hücre)
  // 'attention'   : veri var ama kullanıcı girdisi gerekli
  // 'uptodate'    : güncel
  function veVPCellStatus(node, key) {
    var d = (node && node.data) || {};
    switch (key) {
      case 'powertrain': return _hasPowertrain(d) ? 'uptodate' : 'attention';
      case 'vehicle':    return _hasVehicle(d)    ? 'uptodate' : 'attention';
      case 'scenario':   return _hasScenario(d)   ? 'uptodate' : 'attention';
      case 'solver':
        if (!(_hasPowertrain(d) && _hasVehicle(d) && _hasScenario(d))) return 'unfulfilled';
        return d.results ? 'uptodate' : 'attention';
      case 'results':
        return d.results ? 'uptodate' : 'unfulfilled';
      default: return 'attention';
    }
  }

  var _STATUS_ICON = {
    unfulfilled: '?',
    attention:   '!',
    uptodate:    '✓'   // ✓
  };
  var _STATUS_TITLE = {
    unfulfilled: 'Eksik — önce üstteki hücreyi tamamla',
    attention:   'Girdi gerekli — hücreyi açıp doldur',
    uptodate:    'Güncel'
  };

  function _esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  // ─── Tuvaldeki blok iç HTML (header + istiflenmiş hücreler) ─────────────────
  function veVPBlockInnerHTML(node) {
    var name = (node && node.customName) || 'Araç Performans';
    var html = '';
    html += '<div class="ve-vp-header"><span class="ve-vp-sys">A</span>' +
            '<span class="ve-vp-title">' + _esc(name) + '</span>' +
            '<span class="ve-vp-caret">▾</span></div>';
    html += '<div class="ve-vp-cells">';
    for (var i = 0; i < VP_CELLS.length; i++) {
      var c = VP_CELLS[i];
      var st = veVPCellStatus(node, c.key);
      html += '<div class="ve-vp-cell" data-vp-cell="' + c.key + '" data-node="' + _esc(node && node.id) + '" title="' + _esc(c.label) + ' — çift tıkla aç">';
      html += '<span class="ve-vp-cell-code">' + c.code + '</span>';
      html += '<span class="ve-vp-cell-label">' + _esc(c.label) + '</span>';
      html += '<span class="ve-vp-status vp-st-' + st + '" title="' + _STATUS_TITLE[st] + '">' + _STATUS_ICON[st] + '</span>';
      html += '</div>';
    }
    html += '</div>';
    return html;
  }

  // ─── Hücre çift-tık olaylarını bağla (innerHTML her yenilendiğinde çağrılır) ─
  function veVPAttachCellHandlers(nodeEl, node) {
    if (!nodeEl || typeof nodeEl.querySelectorAll !== 'function') return;
    var cells = nodeEl.querySelectorAll('.ve-vp-cell');
    Array.prototype.forEach.call(cells, function(cell) {
      cell.addEventListener('dblclick', function(e) {
        e.stopPropagation();   // node-dblclick (genel bakış) tetiklenmesin
        e.preventDefault();
        veVPOpenCell(node.id, cell.getAttribute('data-vp-cell'));
      });
    });
  }

  // ─── Tuvaldeki bloğu yeniden çiz (durum ikonları güncellensin) ──────────────
  function veVPRefreshBlock(node) {
    if (typeof document === 'undefined' || !node) return;
    var el = document.getElementById(node.id);
    if (!el) return;
    var box = el.querySelector('.ve-vp-box');
    if (!box) return;
    box.innerHTML = veVPBlockInnerHTML(node);
    veVPAttachCellHandlers(el, node);
  }

  // ─── Properties paneli: genel bakış (hücre listesi + aç butonları) ──────────
  function veVPOverviewHTML(node) {
    var html = '<div class="sw-panel">';
    html += '<div class="sw-section-title">SISTEM AŞAMALARI</div>';
    html += '<div class="sw-pkg-desc">Bir araç performans analizini oluşturan aşamalar. Her hücreyi açıp doldurun; durum ikonları ilerleyişi gösterir.</div>';
    for (var i = 0; i < VP_CELLS.length; i++) {
      var c = VP_CELLS[i];
      var st = veVPCellStatus(node, c.key);
      html += '<div class="sw-pkg-card" style="margin-bottom:8px;">';
      html += '<div class="sw-pkg-header" style="cursor:pointer;" ondblclick="veVPOpenCell(\'' + node.id + '\',\'' + c.key + '\')">';
      html += '<span class="vp-ov-status vp-st-' + st + '" title="' + _STATUS_TITLE[st] + '">' + _STATUS_ICON[st] + '</span>';
      html += '<span class="sw-pkg-name" style="margin-left:6px;">' + c.code + ' · ' + _esc(c.label) + '</span>';
      html += '<button class="sw-btn sw-btn-outline" style="margin-left:auto;font-size:0.56rem;padding:2px 10px;" onclick="veVPOpenCell(\'' + node.id + '\',\'' + c.key + '\')">Aç</button>';
      html += '</div></div>';
    }
    html += '</div>';
    return html;
  }

  function _backBar(nodeId) {
    return '<div class="sw-btn-row" style="margin:0 0 8px;">' +
      '<button class="sw-btn sw-btn-outline" style="font-size:0.56rem;padding:3px 10px;" onclick="veVPOpenOverview(\'' + nodeId + '\')">‹ Aşamalar</button>' +
      '</div>';
  }

  // ─── Properties paneli: tek hücrenin editörü ───────────────────────────────
  function veVPCellEditorHTML(node, key) {
    var d = node.data || (node.data = veVPCreateModuleData());
    var id = node.id;
    var html = '<div class="sw-panel">' + _backBar(id);

    if (key === 'powertrain') {
      var pt = d.powertrain || (d.powertrain = { preset: null, components: {} });
      html += '<div class="sw-section-title">GÜÇ AKTARMA ORGANLARI</div>';
      html += '<div class="sw-pkg-desc">Motor → Konvertör → Şanzıman → Transfer → Diferansiyel zinciri. (İlk sürüm: hazır şablon seçimi; bileşen-bazında detaylı düzenleme bir sonraki adımda.)</div>';
      html += '<div class="vp-chain">';
      ['Motor', 'Konvertör', 'Şanzıman', 'Transfer', 'Diferansiyel'].forEach(function(s, k) {
        html += '<span class="vp-chain-step">' + s + '</span>' + (k < 4 ? '<span class="vp-chain-arrow">→</span>' : '');
      });
      html += '</div>';
      html += '<label class="vp-field"><span>Hazır Şablon</span>' +
              '<select onchange="veVPSetField(\'' + id + '\',\'powertrain\',\'preset\',this.value||null)">' +
              '<option value="">— seçiniz —</option>' +
              '<option value="6x6-heavy"' + (pt.preset === '6x6-heavy' ? ' selected' : '') + '>6×6 Ağır Vasıta</option>' +
              '<option value="4x4-medium"' + (pt.preset === '4x4-medium' ? ' selected' : '') + '>4×4 Orta Sınıf</option>' +
              '<option value="custom"' + (pt.preset === 'custom' ? ' selected' : '') + '>Özel</option>' +
              '</select></label>';

    } else if (key === 'vehicle') {
      var v = d.vehicle || (d.vehicle = { mass: null, area: null, cd: null });
      html += '<div class="sw-section-title">ARAÇ &amp; TEKERLEK</div>';
      html += '<label class="vp-field"><span>Kütle (kg)</span><input type="number" min="0" step="100" value="' + (v.mass == null ? '' : v.mass) + '" onchange="veVPSetField(\'' + id + '\',\'vehicle\',\'mass\',parseFloat(this.value))"></label>';
      html += '<label class="vp-field"><span>Ön alan (m²)</span><input type="number" min="0" step="0.1" value="' + (v.area == null ? '' : v.area) + '" onchange="veVPSetField(\'' + id + '\',\'vehicle\',\'area\',parseFloat(this.value))"></label>';
      html += '<label class="vp-field"><span>Sürükleme kats. (Cd)</span><input type="number" min="0" step="0.01" value="' + (v.cd == null ? '' : v.cd) + '" onchange="veVPSetField(\'' + id + '\',\'vehicle\',\'cd\',parseFloat(this.value))"></label>';

    } else if (key === 'scenario') {
      var sc = d.scenario || (d.scenario = { type: 'full_throttle', throttle: 100 });
      html += '<div class="sw-section-title">SENARYO &amp; YOL</div>';
      html += '<label class="vp-field"><span>Senaryo</span>' +
              '<select onchange="veVPSetField(\'' + id + '\',\'scenario\',\'type\',this.value)">' +
              '<option value="full_throttle"' + (sc.type === 'full_throttle' ? ' selected' : '') + '>Tam Gaz</option>' +
              '<option value="partial_throttle"' + (sc.type === 'partial_throttle' ? ' selected' : '') + '>Kısmi Gaz</option>' +
              '<option value="custom"' + (sc.type === 'custom' ? ' selected' : '') + '>Özel (yol profili)</option>' +
              '</select></label>';
      html += '<label class="vp-field"><span>Gaz (%)</span><input type="number" min="0" max="100" step="5" value="' + (sc.throttle == null ? 100 : sc.throttle) + '" onchange="veVPSetField(\'' + id + '\',\'scenario\',\'throttle\',parseFloat(this.value))"></label>';

    } else if (key === 'solver') {
      var s = d.solver || (d.solver = { timeMode: 'speed', target: null, method: 'rk45' });
      var ready = _hasPowertrain(d) && _hasVehicle(d) && _hasScenario(d);
      html += '<div class="sw-section-title">ÇÖZÜM</div>';
      if (!ready) {
        html += '<div class="sw-chain-bar fail">✗ Önce A1–A3 hücrelerini tamamlayın (upstream eksik).</div>';
      }
      html += '<label class="vp-field"><span>Zaman modu</span>' +
              '<select onchange="veVPSetField(\'' + id + '\',\'solver\',\'timeMode\',this.value)">' +
              '<option value="speed"' + (s.timeMode === 'speed' ? ' selected' : '') + '>Hedef hıza kadar</option>' +
              '<option value="time"' + (s.timeMode === 'time' ? ' selected' : '') + '>Sabit süre</option>' +
              '</select></label>';
      html += '<label class="vp-field"><span>' + (s.timeMode === 'time' ? 'Süre (s)' : 'Hedef hız (km/s)') + '</span><input type="number" min="0" step="1" value="' + (s.target == null ? '' : s.target) + '" onchange="veVPSetField(\'' + id + '\',\'solver\',\'target\',parseFloat(this.value))"></label>';
      html += '<label class="vp-field"><span>Yöntem</span>' +
              '<select onchange="veVPSetField(\'' + id + '\',\'solver\',\'method\',this.value)">' +
              '<option value="rk45"' + (s.method === 'rk45' ? ' selected' : '') + '>RK45</option>' +
              '<option value="euler"' + (s.method === 'euler' ? ' selected' : '') + '>Euler</option>' +
              '</select></label>';
      html += '<div class="sw-btn-row" style="margin:10px 0 0;">' +
              '<button class="sw-btn sw-btn-primary" ' + (ready ? '' : 'disabled ') + 'onclick="veVPRunSolve(\'' + id + '\')">▶ Çöz</button></div>';

    } else if (key === 'results') {
      html += '<div class="sw-section-title">SONUÇLAR</div>';
      if (d.results) {
        html += '<div class="sw-chain-bar ok">✓ Çözüm hazır.</div>';
        html += '<div class="sw-pkg-desc">Çalıştırılma: ' + _esc(d.results.ranAt || '') + '</div>';
        if (d.results.summary) {
          html += '<div class="sw-pkg-desc">' + _esc(d.results.summary) + '</div>';
        }
      } else {
        html += '<div class="sw-chain-bar fail">✗ Henüz çözüm yok — A4 Çözüm hücresinde çalıştırın.</div>';
      }
    } else {
      html += '<div class="sw-pkg-desc">Bilinmeyen hücre.</div>';
    }

    html += '</div>';
    return html;
  }

  // ─── Properties panel yardımcıları (DOM) ───────────────────────────────────
  function _findNode(id) {
    if (typeof global.nodes === 'undefined' || !Array.isArray(global.nodes)) return null;
    for (var i = 0; i < global.nodes.length; i++) {
      if (global.nodes[i].id === id) return global.nodes[i];
    }
    return null;
  }

  function _setPanelTitle(node, suffix) {
    if (typeof document === 'undefined') return;
    var titleEl = document.getElementById('ve-properties-title');
    if (!titleEl) return;
    var nm = (node && node.customName) || 'Araç Performans';
    titleEl.innerHTML = '<span class="mf-ico mf-ico-sliders"></span>' + _esc(nm) +
      (suffix ? ' <span style="opacity:0.6;font-weight:400;font-size:0.7rem;">› ' + _esc(suffix) + '</span>' : '');
  }

  function veVPOpenOverview(nodeId) {
    var node = _findNode(nodeId);
    if (!node || typeof document === 'undefined') return;
    var content = document.querySelector('.ve-properties-content');
    if (content) content.innerHTML = veVPOverviewHTML(node);
    _setPanelTitle(node, '');
    if (typeof veTogglePropertiesPanel === 'function') veTogglePropertiesPanel(true);
  }

  function veVPOpenCell(nodeId, key) {
    var node = _findNode(nodeId);
    if (!node || typeof document === 'undefined') return;
    if (!node.data) node.data = veVPCreateModuleData();
    var content = document.querySelector('.ve-properties-content');
    if (content) content.innerHTML = veVPCellEditorHTML(node, key);
    var c = _cellByKey(key);
    _setPanelTitle(node, c ? c.label : '');
    if (typeof veTogglePropertiesPanel === 'function') veTogglePropertiesPanel(true);
  }

  function veVPSetField(nodeId, cellKey, field, value) {
    var node = _findNode(nodeId);
    if (!node) return;
    if (!node.data) node.data = veVPCreateModuleData();
    if (!node.data[cellKey] || typeof node.data[cellKey] !== 'object') node.data[cellKey] = {};
    if (value !== value) value = null;   // NaN → null (boş input)
    node.data[cellKey][field] = value;
    veVPRefreshBlock(node);
    if (typeof saveState === 'function') saveState();
  }

  // ─── A4 Çözüm — iterasyon 1: STUB (gerçek çözücü bağlama bir sonraki adım) ──
  function veVPRunSolve(nodeId) {
    var node = _findNode(nodeId);
    if (!node) return;
    var d = node.data || (node.data = veVPCreateModuleData());
    if (!(_hasPowertrain(d) && _hasVehicle(d) && _hasScenario(d))) {
      if (typeof showToast === 'function') showToast('Önce A1–A3 hücrelerini tamamlayın', 'warning');
      return;
    }
    // TODO: gerçek simülasyon motoruna (solver.js / simulation-engine.js) bağla.
    d.results = {
      ranAt: (new Date()).toLocaleString(),
      summary: 'Stub çözüm — gerçek motor entegrasyonu beklemede.'
    };
    veVPRefreshBlock(node);
    if (typeof saveState === 'function') saveState();
    if (typeof showToast === 'function') showToast('Çözüm tamamlandı (stub)', 'success');
    veVPOpenCell(nodeId, 'results');
  }

  // ─── Export ────────────────────────────────────────────────────────────────
  var api = {
    VP_CELLS:               VP_CELLS,
    veVPCreateModuleData:   veVPCreateModuleData,
    veVPIsModuleNode:       veVPIsModuleNode,
    veVPCellStatus:         veVPCellStatus,
    veVPBlockInnerHTML:     veVPBlockInnerHTML,
    veVPOverviewHTML:       veVPOverviewHTML,
    veVPCellEditorHTML:     veVPCellEditorHTML
  };

  global.VP_CELLS              = VP_CELLS;
  global.veVPCreateModuleData  = veVPCreateModuleData;
  global.veVPIsModuleNode      = veVPIsModuleNode;
  global.veVPCellStatus        = veVPCellStatus;
  global.veVPBlockInnerHTML    = veVPBlockInnerHTML;
  global.veVPAttachCellHandlers = veVPAttachCellHandlers;
  global.veVPRefreshBlock      = veVPRefreshBlock;
  global.veVPOverviewHTML      = veVPOverviewHTML;
  global.veVPCellEditorHTML    = veVPCellEditorHTML;
  global.veVPOpenOverview      = veVPOpenOverview;
  global.veVPOpenCell          = veVPOpenCell;
  global.veVPSetField          = veVPSetField;
  global.veVPRunSolve          = veVPRunSolve;
  global.VPStudy               = api;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }

})(typeof window !== 'undefined' ? window : (typeof global !== 'undefined' ? global : this));
