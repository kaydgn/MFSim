// ============================================================================
// ALT MODÜL SİSTEMİ
// ============================================================================
// Her modül kendi bileşen paleti, senaryo seti ve çözücü mantığını tanımlar.
var VE_MODULES = {
  'engine-brake': {
    name: 'M. Freni Performans',
    icon: '',
    description: 'Motor freni performansı, yokuş iniş analizi, retarder etkinliği',
    components: ['engine','torque-converter','ec-matching','engine-gearbox-matching','gearbox','shift-controller','transfer','differential','wheel','vehicle','sensor','sensor-wizard','terminator','scenario','coast-down','solver','road','parametric'],
    defaultScenario: 'coast',
    scenarios: ['coast'],
    requiresFull: true,
    requiredComponents: ['scenario']
  },
  'full-throttle': {
    name: 'Tam Gaz Hızlanma',
    icon: '',
    description: 'Tam gaz hızlanma performansı, 0-100 km/h, elastik hızlanma',
    components: ['engine','torque-converter','ec-matching','engine-gearbox-matching','gearbox','shift-controller','propshaft','transfer','differential','wheel','vehicle','sensor','sensor-wizard','terminator','scenario','coast-down','solver','road','parametric'],
    defaultScenario: 'full_throttle',
    scenarios: ['full_throttle'],
    requiresFull: true
  },
  'performance': {
    name: 'Araç Performans Hesaplama',
    icon: '',
    description: 'Hızlanma, maksimum hız, elastik performans',
    components: ['engine','torque-converter','ec-matching','engine-gearbox-matching','gearbox','shift-controller','transfer','differential','wheel','vehicle','sensor','sensor-wizard','terminator','scenario','solver','road','parametric'],
    defaultScenario: 'full_throttle',
    scenarios: ['full_throttle','partial_throttle'],
    requiresFull: true
  },
  'fuel': {
    name: 'Yakıt Tüketimi Analizi',
    icon: '',
    description: 'Sürüş çevrimi, yakıt tüketimi, emisyon hesaplama',
    components: ['engine','torque-converter','ec-matching','engine-gearbox-matching','gearbox','shift-controller','transfer','differential','wheel','vehicle','sensor','sensor-wizard','scenario','solver','road'],
    defaultScenario: 'drive_cycle',
    scenarios: ['drive_cycle','custom'],
    requiresFull: true
  }
};

var veActiveModule = '';

function veOnModuleChange(moduleId) {
  if(!VE_MODULES[moduleId]) return;
  if(moduleId === veActiveModule) return;
  
  // Topolojide bileşen varsa kaydetmeyi sor
  if(nodes.length > 0) {
    var overlay = document.createElement('div');
    overlay.id = 've-module-confirm-overlay';
    overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);z-index:999999;display:flex;align-items:center;justify-content:center;';
    
    var mod = VE_MODULES[moduleId];
    var dialog = document.createElement('div');
    dialog.style.cssText = 'background:var(--bg-secondary);border-radius:12px;padding:24px;max-width:420px;width:90%;box-shadow:0 8px 32px rgba(0,0,0,0.3);border:1px solid var(--border-color);';
    dialog.innerHTML = '<div style="font-size:0.95rem;font-weight:600;color:var(--text-heading);margin-bottom:12px;">Modül Değişikliği</div>' +
      '<p style="font-size:0.78rem;color:var(--text-secondary);line-height:1.5;margin-bottom:8px;">' +
      '<b>' + mod.name + '</b> modülüne geçiş yapmak üzeresiniz. Modüller arası matematik altyapı farklı olduğundan mevcut topoloji temizlenecektir.</p>' +
      '<p style="font-size:0.78rem;color:var(--text-secondary);line-height:1.5;margin-bottom:16px;">Mevcut topolojiyi kaydetmek ister misiniz?</p>' +
      '<div style="display:flex;gap:8px;justify-content:flex-end;">' +
      '<button id="ve-mod-cancel" style="padding:7px 16px;font-size:0.75rem;border:1px solid var(--border-color);background:var(--bg-tertiary);color:var(--text-primary);border-radius:6px;cursor:pointer;">Vazgeç</button>' +
      '<button id="ve-mod-discard" style="padding:7px 16px;font-size:0.75rem;border:none;background:#dc2626;color:white;border-radius:6px;cursor:pointer;">Kaydetmeden Geç</button>' +
      '<button id="ve-mod-save" style="padding:7px 16px;font-size:0.75rem;border:none;background:var(--accent-primary);color:white;border-radius:6px;cursor:pointer;font-weight:600;">Kaydet ve Geç</button>' +
      '</div>';
    overlay.appendChild(dialog);
    document.body.appendChild(overlay);
    
    document.getElementById('ve-mod-cancel').onclick = function() {
      overlay.remove();
      // Dropdown'ı eski değere geri al
      var sel = document.getElementById('ve-module-select');
      if(sel) sel.value = veActiveModule;
    };
    document.getElementById('ve-mod-discard').onclick = function() {
      overlay.remove();
      veApplyModuleChange(moduleId);
    };
    document.getElementById('ve-mod-save').onclick = function() {
      overlay.remove();
      // Önce mevcut topolojiyi dosyaya kaydet
      if(typeof veSaveTopology === 'function') {
        veSaveTopology();
      }
      veApplyModuleChange(moduleId);
    };
    return;
  }
  
  veApplyModuleChange(moduleId);
}

function veApplyModuleChange(moduleId) {
  var mod = VE_MODULES[moduleId];
  veActiveModule = moduleId;
  
  // Overlay'ı gizle
  var overlay = document.getElementById('ve-module-overlay');
  if(overlay) overlay.style.display = 'none';
  
  // Topolojiyi temizle
  nodes.forEach(function(n) {
    var el = document.getElementById(n.id);
    if(el) el.remove();
  });
  nodes = [];
  connections = [];
  selectedNodes = [];
  
  // SVG bağlantılarını temizle
  var svgLayer = document.getElementById('ve-connections-layer');
  if(svgLayer) svgLayer.innerHTML = '';
  
  // Sim sonuçlarını temizle
  window.veSimResults = null;
  
  // Undo/redo sıfırla
  undoStack = [];
  redoStack = [];
  
  // Properties panelini sıfırla
  showEmptyProperties();
  updateNodeCount();
  
  // Sidebar bileşenlerini güncelle
  var allComps = document.querySelectorAll('.ve-component[data-type]');
  allComps.forEach(function(el) {
    var type = el.getAttribute('data-type');
    if(mod.components.indexOf(type) > -1) {
      el.style.display = '';
    } else {
      el.style.display = 'none';
    }
  });
  
  // Boş kategorileri gizle (Araçlar hariç)
  document.querySelectorAll('.ve-category').forEach(function(cat) {
    if(cat.getAttribute('data-always-visible')) return;
    var visibleComps = cat.querySelectorAll('.ve-component:not([style*="display: none"])');
    if(visibleComps.length === 0) {
      cat.style.display = 'none';
    } else {
      cat.style.display = '';
    }
  });

  showToast(mod.name + ' modülü aktif', 'info');
}

function veGetActiveModule() {
  return VE_MODULES[veActiveModule] || VE_MODULES['engine-brake'];
}

function veSelectModuleFromOverlay(moduleId) {
  // Overlay'ı gizle
  var overlay = document.getElementById('ve-module-overlay');
  if(overlay) overlay.style.display = 'none';
  
  // Modülü seç
  var sel = document.getElementById('ve-module-select');
  if(sel) sel.value = moduleId;
  
  veActiveModule = moduleId;
  
  // Sidebar filtreleme
  var mod = VE_MODULES[moduleId];
  if(mod) {
    var allComps = document.querySelectorAll('.ve-component[data-type]');
    allComps.forEach(function(el) {
      var type = el.getAttribute('data-type');
      if(mod.components.indexOf(type) > -1) {
        el.style.display = '';
      } else {
        el.style.display = 'none';
      }
    });
    document.querySelectorAll('.ve-category').forEach(function(cat) {
      if(cat.getAttribute('data-always-visible')) return;
      var visibleComps = cat.querySelectorAll('.ve-component:not([style*="display: none"])');
      cat.style.display = visibleComps.length === 0 ? 'none' : '';
    });
  }
  
  showToast(mod.name + ' modülü aktif', 'info');
}

// Bileşen tanımları (SVG sembolleri)
var componentDefs = {
  'gearbox': {
    name: 'Şanzıman',
    svg: '<svg width="38" height="38" viewBox="0 0 100 100"><defs><pattern id="stripes-gearbox" patternUnits="userSpaceOnUse" width="8" height="8"><path d="M-2,2 l4,-4 M0,8 l8,-8 M6,10 l4,-4" stroke="var(--text-muted, #888)" stroke-width="2.5" fill="none"/></pattern></defs><rect x="38" y="5" width="24" height="90" fill="url(#stripes-gearbox)" stroke="var(--text-secondary, #666)" stroke-width="2"/><rect x="8" y="18" width="25" height="8" fill="var(--text-secondary, #666)" rx="1"/><rect x="67" y="18" width="25" height="8" fill="var(--text-secondary, #666)" rx="1"/><rect x="28" y="14" width="12" height="6" fill="var(--text-secondary, #666)" rx="1"/><rect x="60" y="14" width="12" height="6" fill="var(--text-secondary, #666)" rx="1"/><rect x="8" y="70" width="25" height="8" fill="var(--text-secondary, #666)" rx="1"/><rect x="67" y="70" width="25" height="8" fill="var(--text-secondary, #666)" rx="1"/><rect x="28" y="66" width="12" height="6" fill="var(--text-secondary, #666)" rx="1"/><rect x="60" y="66" width="12" height="6" fill="var(--text-secondary, #666)" rx="1"/></svg>',
    inputs: 1,
    outputs: 1
  },
  'torque-converter': {
    name: 'Tork Konvertörü',
    svg: '<svg width="38" height="38" viewBox="0 0 100 100"><circle cx="50" cy="50" r="35" fill="none" stroke="var(--text-secondary, #666)" stroke-width="4"/><circle cx="50" cy="50" r="25" fill="var(--text-muted, #888)" opacity="0.5"/><circle cx="50" cy="50" r="12" fill="var(--text-secondary, #666)"/><path d="M35 35 Q50 20 65 35" stroke="var(--accent-primary, #3b82f6)" stroke-width="3" fill="none"/><path d="M65 65 Q50 80 35 65" stroke="var(--accent-primary, #3b82f6)" stroke-width="3" fill="none"/><rect x="10" y="46" width="15" height="8" fill="var(--text-muted, #888)"/><rect x="75" y="46" width="15" height="8" fill="var(--text-muted, #888)"/></svg>',
    inputs: 1,
    outputs: 1
  },
  'ec-matching': {
    name: 'Motor-Konvertör Eşleştirme',
    svg: '<svg width="38" height="38" viewBox="0 0 100 100"><rect x="8" y="12" width="84" height="76" rx="8" fill="none" stroke="var(--accent-warning, #f59e0b)" stroke-width="4"/><circle cx="30" cy="42" r="14" fill="none" stroke="var(--text-secondary, #666)" stroke-width="3"/><circle cx="30" cy="42" r="6" fill="var(--text-secondary, #666)"/><path d="M48 42 L56 42" stroke="var(--accent-warning, #f59e0b)" stroke-width="3" stroke-linecap="round"/><path d="M52 38 L56 42 L52 46" stroke="var(--accent-warning, #f59e0b)" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/><rect x="58" y="30" width="28" height="24" rx="4" fill="none" stroke="var(--text-secondary, #666)" stroke-width="3"/><path d="M63 38 L68 38 M63 44 L75 44 M63 50 L71 50" stroke="var(--accent-primary, #3b82f6)" stroke-width="2" stroke-linecap="round"/><path d="M20 70 L40 70 L55 62 L70 70 L85 70" stroke="var(--accent-success, #22c55e)" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    inputs: 1,
    outputs: 0
  },
  'engine-gearbox-matching': {
    name: 'Motor-Şanzıman Eşleştirme',
    svg: '<svg width="38" height="38" viewBox="0 0 100 100"><rect x="8" y="12" width="84" height="76" rx="8" fill="none" stroke="var(--accent-primary, #3b82f6)" stroke-width="4"/><rect x="20" y="28" width="25" height="40" rx="3" fill="none" stroke="var(--text-secondary, #666)" stroke-width="3"/><line x1="25" y1="42" x2="40" y2="42" stroke="var(--text-muted, #888)" stroke-width="2"/><line x1="25" y1="50" x2="40" y2="50" stroke="var(--text-muted, #888)" stroke-width="2"/><line x1="25" y1="58" x2="40" y2="58" stroke="var(--text-muted, #888)" stroke-width="2"/><path d="M48 48 L56 48" stroke="var(--accent-primary, #3b82f6)" stroke-width="3" stroke-linecap="round"/><path d="M52 44 L56 48 L52 52" stroke="var(--accent-primary, #3b82f6)" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/><rect x="58" y="30" width="28" height="24" rx="4" fill="none" stroke="var(--text-secondary, #666)" stroke-width="3"/><path d="M63 38 L68 38 M63 44 L75 44 M63 50 L71 50" stroke="var(--accent-primary, #3b82f6)" stroke-width="2" stroke-linecap="round"/><path d="M20 74 L40 74 L55 66 L70 74 L85 74" stroke="var(--accent-success, #22c55e)" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    inputs: 1,
    outputs: 0
  },
  'shift-controller': {
    name: 'Şanzıman Kontrol',
    svg: '<svg width="38" height="38" viewBox="0 0 100 100"><rect x="15" y="15" width="70" height="70" rx="8" fill="none" stroke="var(--accent-warning, #ff9800)" stroke-width="4"/><path d="M35 30 L35 70" stroke="var(--text-secondary, #666)" stroke-width="4" stroke-linecap="round"/><circle cx="35" cy="35" r="6" fill="var(--accent-warning, #ff9800)"/><path d="M65 30 L65 70" stroke="var(--text-secondary, #666)" stroke-width="4" stroke-linecap="round"/><circle cx="65" cy="55" r="6" fill="var(--accent-warning, #ff9800)"/><path d="M35 35 L50 45 L65 55" stroke="var(--accent-warning, #ff9800)" stroke-width="2.5" fill="none" stroke-dasharray="4,3"/></svg>',
    inputs: 0,
    outputs: 0
  },
  'propshaft': {
    name: 'Propşaft',
    svg: '<svg width="38" height="38" viewBox="0 0 100 100"><line x1="10" y1="50" x2="90" y2="50" stroke="var(--text-secondary, #666)" stroke-width="10" stroke-linecap="round"/><circle cx="20" cy="50" r="10" fill="none" stroke="var(--text-muted, #888)" stroke-width="3"/><circle cx="50" cy="50" r="5" fill="var(--text-muted, #888)"/><circle cx="80" cy="50" r="10" fill="none" stroke="var(--text-muted, #888)" stroke-width="3"/><line x1="15" y1="40" x2="25" y2="60" stroke="var(--text-muted, #888)" stroke-width="2"/><line x1="75" y1="40" x2="85" y2="60" stroke="var(--text-muted, #888)" stroke-width="2"/></svg>',
    inputs: 1,
    outputs: 1
  },
  'engine': {
    name: 'Motor',
    svg: '<svg width="38" height="38" viewBox="0 0 100 100"><rect x="20" y="25" width="60" height="50" fill="var(--text-secondary, #666)" rx="4"/><rect x="30" y="15" width="15" height="15" fill="var(--text-muted, #888)" rx="2"/><rect x="55" y="15" width="15" height="15" fill="var(--text-muted, #888)" rx="2"/><rect x="10" y="40" width="15" height="20" fill="var(--text-muted, #888)" rx="2"/><rect x="75" y="40" width="15" height="20" fill="var(--text-muted, #888)" rx="2"/><rect x="35" y="75" width="30" height="10" fill="var(--text-muted, #888)" rx="2"/></svg>',
    inputs: 0,
    outputs: 1
  },
  'engine-brake': {
    name: 'Motor Freni',
    svg: '<svg width="38" height="38" viewBox="0 0 100 100"><circle cx="50" cy="50" r="35" fill="none" stroke="var(--text-secondary, #666)" stroke-width="6"/><circle cx="50" cy="50" r="20" fill="var(--text-muted, #888)"/><rect x="15" y="46" width="20" height="8" fill="var(--accent-danger, #f44336)"/><rect x="65" y="46" width="20" height="8" fill="var(--accent-danger, #f44336)"/></svg>',
    inputs: 1,
    outputs: 1
  },


  'transfer': {
    name: 'Transfer Kutusu',
    svg: '<svg width="38" height="38" viewBox="0 0 100 100"><rect x="25" y="20" width="50" height="60" fill="var(--text-secondary, #666)" rx="4"/><rect x="10" y="35" width="20" height="8" fill="var(--text-muted, #888)"/><rect x="70" y="30" width="20" height="8" fill="var(--text-muted, #888)"/><rect x="70" y="62" width="20" height="8" fill="var(--text-muted, #888)"/><circle cx="50" cy="50" r="12" fill="var(--text-muted, #888)"/></svg>',
    inputs: 1,
    outputs: 2
  },
  'differential': {
    name: 'Diferansiyel',
    svg: '<svg width="38" height="38" viewBox="0 0 100 100"><circle cx="50" cy="50" r="30" fill="none" stroke="var(--text-secondary, #666)" stroke-width="4"/><circle cx="50" cy="50" r="15" fill="var(--text-muted, #888)"/><rect x="10" y="46" width="15" height="8" fill="var(--text-muted, #888)"/><rect x="75" y="30" width="15" height="8" fill="var(--text-muted, #888)"/><rect x="75" y="62" width="15" height="8" fill="var(--text-muted, #888)"/></svg>',
    inputs: 1,
    outputs: 2
  },
  'wheel': {
    name: 'Tekerlek',
    svg: '<svg width="38" height="38" viewBox="0 0 100 100"><circle cx="50" cy="50" r="38" fill="var(--text-secondary, #666)"/><circle cx="50" cy="50" r="28" fill="var(--text-muted, #888)"/><circle cx="50" cy="50" r="10" fill="var(--text-secondary, #666)"/><rect x="5" y="46" width="15" height="8" fill="var(--text-muted, #888)"/></svg>',
    inputs: 1,
    outputs: 0
  },
  'vehicle': {
    name: 'Araç',
    svg: '<svg width="38" height="38" viewBox="0 0 100 100"><rect x="10" y="30" width="80" height="35" fill="var(--text-secondary, #666)" rx="4"/><rect x="15" y="20" width="50" height="15" fill="var(--text-muted, #888)" rx="3"/><circle cx="25" cy="70" r="10" fill="var(--text-muted, #888)"/><circle cx="75" cy="70" r="10" fill="var(--text-muted, #888)"/></svg>',
    inputs: 0,
    outputs: 0
  },
  'sensor': {
    name: 'Sensör',
    svg: '<svg width="23" height="23" viewBox="0 0 100 120"><circle cx="50" cy="32" r="28" fill="var(--accent-success, #22c55e)"/><circle cx="50" cy="32" r="12" fill="white" opacity="0.4"/><path d="M38 56 L50 110 L62 56" fill="var(--accent-success, #22c55e)"/></svg>',
    inputs: 1,
    outputs: 0,
    isSensor: true
  },
  'sensor-wizard': {
    name: 'Sensör Sihirbazı',
    svg: '<svg width="38" height="38" viewBox="0 0 100 100"><rect x="8" y="12" width="84" height="76" rx="8" fill="none" stroke="var(--accent-warning, #f59e0b)" stroke-width="4"/><circle cx="30" cy="36" r="10" fill="none" stroke="var(--text-secondary, #666)" stroke-width="3"/><circle cx="30" cy="36" r="4" fill="var(--text-secondary, #666)"/><path d="M30 46 L30 56" stroke="var(--accent-success, #22c55e)" stroke-width="2.5" stroke-linecap="round"/><circle cx="55" cy="36" r="10" fill="none" stroke="var(--text-secondary, #666)" stroke-width="3"/><circle cx="55" cy="36" r="4" fill="var(--text-secondary, #666)"/><path d="M55 46 L55 56" stroke="var(--accent-success, #22c55e)" stroke-width="2.5" stroke-linecap="round"/><circle cx="80" cy="36" r="10" fill="none" stroke="var(--text-secondary, #666)" stroke-width="3"/><circle cx="80" cy="36" r="4" fill="var(--text-secondary, #666)"/><path d="M80 46 L80 56" stroke="var(--accent-success, #22c55e)" stroke-width="2.5" stroke-linecap="round"/><path d="M20 62 L40 62 L55 58 L70 62 L88 62" stroke="var(--accent-primary, #3b82f6)" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/><path d="M15 72 L35 72 M45 72 L65 72 M75 72 L88 72" stroke="var(--text-muted, #888)" stroke-width="2" stroke-linecap="round" stroke-dasharray="3,3"/></svg>',
    inputs: 0,
    outputs: 0,
    maxInstances: 1
  },
  'terminator': {
    name: 'Sonlandırıcı',
    svg: '<svg width="22" height="22" viewBox="0 0 100 100"><rect x="18" y="18" width="64" height="64" rx="8" fill="none" stroke="var(--accent-danger, #ef4444)" stroke-width="5" stroke-dasharray="8,4"/><line x1="35" y1="35" x2="65" y2="65" stroke="var(--accent-danger, #ef4444)" stroke-width="5.5" stroke-linecap="round"/><line x1="65" y1="35" x2="35" y2="65" stroke="var(--accent-danger, #ef4444)" stroke-width="5.5" stroke-linecap="round"/></svg>',
    inputs: 1,
    outputs: 0,
    isTerminator: true
  },
  'scenario': {
    name: 'Senaryolar',
    svg: '<svg width="38" height="38" viewBox="0 0 100 100"><rect x="15" y="15" width="70" height="70" rx="8" fill="none" stroke="var(--accent-warning, #ff9800)" stroke-width="4"/><path d="M30 60 L45 40 L60 55 L75 30" fill="none" stroke="var(--accent-warning, #ff9800)" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><circle cx="75" cy="30" r="5" fill="var(--accent-warning, #ff9800)"/></svg>',
    inputs: 0,
    outputs: 0
  },
  'coast-down': {
    name: 'Coast-Down',
    svg: '<svg width="38" height="38" viewBox="0 0 100 100"><path d="M10 80 Q30 75 50 50 Q70 25 90 20" fill="none" stroke="var(--accent-primary, #3b82f6)" stroke-width="5" stroke-linecap="round"/><circle cx="90" cy="20" r="6" fill="var(--accent-primary, #3b82f6)"/><circle cx="10" cy="80" r="6" fill="var(--text-muted, #888)"/><line x1="10" y1="85" x2="90" y2="85" stroke="var(--text-secondary, #666)" stroke-width="2"/><line x1="10" y1="85" x2="10" y2="20" stroke="var(--text-secondary, #666)" stroke-width="2"/></svg>',
    inputs: 0,
    outputs: 0
  },
  'solver': {
    name: 'Çözücü',
    svg: '<svg width="28" height="28" viewBox="0 0 100 100"><rect x="15" y="15" width="70" height="70" rx="10" fill="none" stroke="var(--accent-primary, #3b82f6)" stroke-width="5"/><polygon points="40,30 40,70 70,50" fill="var(--accent-primary, #3b82f6)"/></svg>',
    inputs: 0,
    outputs: 0,
    defaultWidth: 90,
    defaultHeight: 55
  },
  'road': {
    name: 'Yol / Ortam',
    svg: '<svg width="38" height="38" viewBox="0 0 100 100"><path d="M10 70 L90 40" stroke="var(--text-secondary, #666)" stroke-width="6" stroke-linecap="round"/><path d="M10 80 L90 50" stroke="var(--text-muted, #888)" stroke-width="3" stroke-dasharray="8,4"/><polygon points="85,30 95,45 85,45" fill="var(--accent-primary, #3b82f6)"/><circle cx="25" cy="22" r="10" fill="var(--accent-warning, #ff9800)" opacity="0.7"/></svg>',
    inputs: 0,
    outputs: 0
  },
  'parametric': {
    name: 'Parametrik Analiz',
    svg: '<svg width="38" height="38" viewBox="0 0 100 100"><rect x="12" y="12" width="76" height="76" rx="8" fill="none" stroke="var(--accent-primary, #3b82f6)" stroke-width="4"/><text x="50" y="40" text-anchor="middle" font-size="28" font-weight="700" fill="var(--accent-primary, #3b82f6)">P</text><path d="M25 60 L40 55 L55 65 L70 48 L85 58" fill="none" stroke="var(--accent-warning, #f59e0b)" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/><circle cx="25" cy="60" r="3" fill="var(--accent-warning, #f59e0b)"/><circle cx="55" cy="65" r="3" fill="var(--accent-warning, #f59e0b)"/><circle cx="85" cy="58" r="3" fill="var(--accent-warning, #f59e0b)"/></svg>',
    inputs: 0,
    outputs: 0
  }
};

// Her bileşen tipi için sinyal tanımları (sensör okuyabilir)
var COMPONENT_SIGNALS = {
  'engine': {
    outputs: [
      {id: 'rpm', name: 'Motor Devri', unit: 'rpm'},
      {id: 'torque', name: 'Net Motor Torku', unit: 'Nm'},
      {id: 'power', name: 'Motor Gücü', unit: 'kW'},
      {id: 'brake_torque', name: 'Motor Freni Torku', unit: 'Nm'},
      {id: 'angular_vel', name: 'Açısal Hız', unit: 'rad/s'}
    ]
  },
  'engine-brake': {
    outputs: [
      {id: 'rpm', name: 'Devir', unit: 'rpm'},
      {id: 'torque', name: 'Fren Torku', unit: 'Nm'},
      {id: 'power', name: 'Fren Gücü', unit: 'kW'},
      {id: 'angular_vel', name: 'Açısal Hız', unit: 'rad/s'}
    ]
  },
  'torque-converter': {
    outputs: [
      {id: 'rpm_in', name: 'Pompa Devri (Giriş)', unit: 'rpm'},
      {id: 'torque_in', name: 'Pompa Torku (Giriş)', unit: 'Nm'},
      {id: 'rpm_out', name: 'Türbin Devri (Çıkış)', unit: 'rpm'},
      {id: 'torque_out', name: 'Türbin Torku (Çıkış)', unit: 'Nm'},
      {id: 'power_in', name: 'Giriş Gücü', unit: 'kW'},
      {id: 'power_out', name: 'Çıkış Gücü', unit: 'kW'},
      {id: 'power_loss', name: 'Güç Kaybı', unit: 'kW'},
      {id: 'efficiency', name: 'Konvertör Verimi (η)', unit: '%'},
      {id: 'slip', name: 'Kayma Oranı (1−SR)', unit: '%'},
      {id: 'torque_ratio', name: 'Tork Çarpanı (τ)', unit: '−'},
      {id: 'speed_ratio', name: 'Hız Oranı (SR)', unit: '−'},
      {id: 'heat_rejection', name: 'Isı Reddi', unit: 'kW'},
      {id: 'kfactor', name: 'K-Factor', unit: 'rpm/√Nm'}
    ]
  },
  'ec-matching': {
    outputs: [
      {id: 'stall_speed', name: 'Stall Speed', unit: 'rpm'},
      {id: 'stall_turbine_torque', name: 'Stall Türbin Torku', unit: 'Nm'},
      {id: 'sr_at_governed', name: 'SR @ Governed', unit: '−'},
      {id: 'min_engine_speed', name: 'Min Motor Devri', unit: 'rpm'},
      {id: 'recommended_tc', name: 'Önerilen Konvertör', unit: '−'}
    ]
  },
  'engine-gearbox-matching': {
    outputs: [
      {id: 'power_at_gov', name: 'Motor Gücü@Gov', unit: 'kW'},
      {id: 'torque_at_gov', name: 'Motor Torku@Gov', unit: 'Nm'},
      {id: 'recommended_gb', name: 'Önerilen Şanzıman', unit: '−'}
    ]
  },
  'gearbox': {
    outputs: [
      {id: 'rpm_in', name: 'Giriş Devri', unit: 'rpm'},
      {id: 'torque_in', name: 'Giriş Torku', unit: 'Nm'},
      {id: 'rpm_out', name: 'Çıkış Devri', unit: 'rpm'},
      {id: 'torque_out', name: 'Çıkış Torku', unit: 'Nm'},
      {id: 'power_in', name: 'Giriş Gücü', unit: 'kW'},
      {id: 'power_out', name: 'Çıkış Gücü', unit: 'kW'},
      {id: 'power_loss', name: 'Güç Kaybı', unit: 'kW'},
      {id: 'gear', name: 'Aktif Vites', unit: '−'},
      {id: 'ratio', name: 'Vites Oranı', unit: '−'},
      {id: 'gear_mode', name: 'Vites Modu (C/L)', unit: '−'},
      {id: 'efficiency', name: 'Vites Verimi', unit: '%'}
    ]
  },
  'shift-controller': {
    outputs: [
      {id: 'current_gear', name: 'Aktif Vites No', unit: '−'},
      {id: 'gear_mode', name: 'Vites Modu (1C/2L/…)', unit: '−'},
      {id: 'lockup_state', name: 'Lockup Durumu', unit: '0/1'},
      {id: 'n_output', name: 'Şanzıman Çıkış Devri', unit: 'rpm'},
      {id: 'n_out_ratio', name: 'N_out / N_shift_ref', unit: '−'}
    ]
  },
  'transfer': {
    outputs: [
      {id: 'rpm_in', name: 'Giriş Devri', unit: 'rpm'},
      {id: 'torque_in', name: 'Giriş Torku', unit: 'Nm'},
      {id: 'rpm_out', name: 'Çıkış Devri', unit: 'rpm'},
      {id: 'torque_out', name: 'Çıkış Torku', unit: 'Nm'},
      {id: 'power_in', name: 'Giriş Gücü', unit: 'kW'},
      {id: 'power_out', name: 'Çıkış Gücü', unit: 'kW'},
      {id: 'power_loss', name: 'Güç Kaybı', unit: 'kW'}
    ]
  },
  'propshaft': {
    outputs: [
      {id: 'rpm_in', name: 'Giriş Devri', unit: 'rpm'},
      {id: 'torque_in', name: 'Giriş Torku', unit: 'Nm'},
      {id: 'rpm_out', name: 'Çıkış Devri', unit: 'rpm'},
      {id: 'torque_out', name: 'Çıkış Torku', unit: 'Nm'},
      {id: 'power_in', name: 'Giriş Gücü', unit: 'kW'},
      {id: 'power_out', name: 'Çıkış Gücü', unit: 'kW'},
      {id: 'power_loss', name: 'Güç Kaybı', unit: 'kW'}
    ]
  },
  'differential': {
    outputs: [
      {id: 'rpm_in', name: 'Giriş Devri', unit: 'rpm'},
      {id: 'torque_in', name: 'Giriş Torku', unit: 'Nm'},
      {id: 'rpm_out', name: 'Yarım Aks Devri', unit: 'rpm'},
      {id: 'torque_out', name: 'Yarım Aks Torku', unit: 'Nm'},
      {id: 'power_in', name: 'Giriş Gücü', unit: 'kW'},
      {id: 'power_out', name: 'Çıkış Gücü', unit: 'kW'},
      {id: 'power_loss', name: 'Güç Kaybı', unit: 'kW'}
    ]
  },
  'wheel': {
    outputs: [
      {id: 'rpm_in', name: 'Tekerlek Devri', unit: 'rpm'},
      {id: 'torque_in', name: 'Tekerlek Torku', unit: 'Nm'},
      {id: 'speed', name: 'Araç Hızı', unit: 'km/h'},
      {id: 'force', name: 'Çekiş Kuvveti', unit: 'N'},
      {id: 'power_out', name: 'Tekerlek Gücü', unit: 'kW'},
      {id: 'tractive_effort', name: 'Çekiş Kuvveti (TE)', unit: 'kN'},
      {id: 'drawbar_pull', name: 'Drawbar Pull (DP)', unit: 'kN'},
      {id: 'net_grade', name: 'Net Eğim Kapasitesi', unit: '%'}
    ]
  },
  'vehicle': {
    outputs: [
      {id: 'v_speed', name: 'Araç Hızı', unit: 'km/h'},
      {id: 'v_accel', name: 'İvme', unit: 'm/s²'},
      {id: 'v_accel_g', name: 'İvme (g)', unit: 'g'},
      {id: 'v_distance', name: 'Kat Edilen Mesafe', unit: 'm'},
      {id: 'v_decel_g', name: 'Yavaşlama', unit: 'g'},
      {id: 'v_kinetic_energy', name: 'Kinetik Enerji', unit: 'kJ'},
      {id: 'v_effective_mass', name: 'Eşdeğer Kütle', unit: 'kg'}
    ]
  },
  'road': {
    outputs: [
      {id: 'r_grade_force', name: 'Eğim Kuvveti', unit: 'N'},
      {id: 'r_rolling_force', name: 'Yuvarlanma Direnci', unit: 'N'},
      {id: 'r_aero_force', name: 'Aerodinamik Direnç', unit: 'N'},
      {id: 'r_total_resist', name: 'Toplam Direnç', unit: 'N'},
      {id: 'r_net_force', name: 'Net Kuvvet', unit: 'N'},
      {id: 'r_current_grade', name: 'Anlık Eğim', unit: '%'},
      {id: 'r_current_segment', name: 'Aktif Segment', unit: '#'}
    ]
  },
  'solver': {
    outputs: [
      {id: 'time', name: 'Simülasyon Zamanı', unit: 's'},
      {id: 'tractive_effort', name: 'Çekiş Kuvveti (TE)', unit: 'kN'},
      {id: 'drawbar_pull', name: 'Drawbar Pull (DP)', unit: 'kN'},
      {id: 'wheel_power', name: 'Tekerlek Gücü (WP)', unit: 'kW'},
      {id: 'net_grade', name: 'Net Eğim Kapasitesi', unit: '%'},
      {id: 'heat_rejection', name: 'Toplam Isı Reddi', unit: 'kW'}
    ]
  },
  'scenario': {
    outputs: [
      {id: 'sc_throttle', name: 'Gaz Pedalı', unit: '%'},
      {id: 'sc_brake', name: 'Fren Kuvveti', unit: 'N'}
    ]
  }
};

