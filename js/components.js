// ============================================================================
// ANA MODÜL SİSTEMİ
// ============================================================================
// Tüm bileşenler tek bir ana modülde birleştirilmiştir.
var VE_MODULES = {
  'full-throttle': {
    name: 'Ana Sayfa',
    icon: '',
    description: 'Araç güç aktarma organları simülasyonu — tam gaz hızlanma ve performans analizi',
    components: ['engine','torque-converter','ec-matching','engine-gearbox-matching','gearbox','shift-controller','gear-shift','propshaft','transfer','differential','wheel','vehicle','sensor','sensor-wizard','terminator','scenario','coast-down','solver','road','parametric','obstacle-crossing','mnt-motor','mnt-gearbox','mnt-shaft','mnt-bracket','mnt-transfer','mnt-mount','mnt-solver','arac-performans','mount-analysis'],
    defaultScenario: 'full_throttle',
    scenarios: ['full_throttle','partial_throttle','custom'],
    requiresFull: true
  }
};

var veActiveModule = 'full-throttle';

// Sidebar bileşen modu. (Legacy — kategori görünürlüğü artık veSidebarScope ile
// yönetilir; bu değişken bazı eski çağrılar için korunur.)
var veSidebarMode = 'performans';

// Sidebar kapsamı — hangi kategoriler görünür:
//   'top'             → ana topoloji (ana ekran): yalnızca "Modüller" (data-ve-
//                       scope="module") + her-zaman (Araçlar) kategorileri.
//   'arac-performans' → "Araç Performans" alt topolojisi: güç aktarma bileşenleri.
//   'mount-analysis'  → "Takoz" alt topolojisi: Takoz Alt Bileşenleri (mnt-*).
// Kategoriler data-ve-scope ile etiketlenir: 'module' (her yerde) | 'top' | modül
// tipi. Bir alt-sistem açılınca veSyncSidebarScope() kapsamı stack'lerden hesaplar.
var veSidebarScope = 'top';

function veOnModuleChange(moduleId) {
  // Tek modül — değişiklik gerekmez
}

function veApplyModuleChange(moduleId) {
  // Tek modül — overlay'ı gizle ve tüm bileşenleri göster
  veActiveModule = 'full-throttle';
  var overlay = document.getElementById('ve-module-overlay');
  if(overlay) overlay.style.display = 'none';
  veShowAllSidebarComponents();
}

function veGetActiveModule() {
  return VE_MODULES['full-throttle'];
}

function veSelectModuleFromOverlay(mode) {
  // Overlay'ı gizle
  var overlay = document.getElementById('ve-module-overlay');
  if(overlay) overlay.style.display = 'none';

  veActiveModule = 'full-throttle';
  // Tek modül kaldı (Araç Performans). Üst bar sekmesini de senkronla.
  if(typeof veSubTabDegistir === 'function') {
    veSubTabDegistir('arac-performans');
  } else {
    veSidebarMode = 'performans';
    veShowAllSidebarComponents();
  }
  showToast('Araç Performans aktif', 'info');
}

// Aktif moda ait sidebar bileşenlerini göster.
// data-always-visible kategorileri her modda görünür; geri kalanlar
// data-ve-mode (varsayılan 'performans') ile aktif moda göre filtrelenir.
function veShowAllSidebarComponents() {
  document.querySelectorAll('.ve-component[data-type]').forEach(function(el) {
    el.style.display = '';
  });
  document.querySelectorAll('.ve-category').forEach(function(cat) {
    if(cat.getAttribute('data-always-visible')) { cat.style.display = ''; return; }
    // Kapsam kuralı: 'module' her yerde görünür; diğerleri yalnızca aktif
    // kapsamla eşleşince ('top' → ana ekran, modül tipi → o modülün içi).
    // Etiketsiz kategoriler bileşen paleti sayılır → yalnızca Araç Performans içinde.
    var scope = cat.getAttribute('data-ve-scope') || 'arac-performans';
    if(scope === 'module') { cat.style.display = ''; return; }
    cat.style.display = (scope === veSidebarScope) ? '' : 'none';
  });
}

// Sidebar kapsamını açık alt-sistem stack'lerinden hesapla ve uygula. Ana ekranda
// (hiçbir alt-sistem açık değil) → 'top'. Araç Performans / Takoz içindeyken ilgili
// bileşen paleti gelir. Her iki alt-sistem (cp-arac-performans.js, cp-mount.js)
// aç/kapat sırasında bunu çağırır.
function veSyncSidebarScope() {
  var scope = 'top';
  if(typeof veAracStack !== 'undefined' && veAracStack.length) scope = 'arac-performans';
  if(typeof veMntStack !== 'undefined' && veMntStack.length) scope = 'mount-analysis';
  veSidebarScope = scope;
  veShowAllSidebarComponents();
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
    svg: '<svg width="38" height="38" viewBox="0 0 100 100"><rect x="8" y="12" width="84" height="76" rx="8" fill="none" stroke="var(--text-secondary, #999)" stroke-width="4"/><circle cx="30" cy="36" r="10" fill="none" stroke="var(--text-secondary, #666)" stroke-width="3"/><circle cx="30" cy="36" r="4" fill="var(--text-secondary, #666)"/><path d="M30 46 L30 56" stroke="var(--text-secondary, #666)" stroke-width="2.5" stroke-linecap="round"/><circle cx="55" cy="36" r="10" fill="none" stroke="var(--text-secondary, #666)" stroke-width="3"/><circle cx="55" cy="36" r="4" fill="var(--text-secondary, #666)"/><path d="M55 46 L55 56" stroke="var(--text-secondary, #666)" stroke-width="2.5" stroke-linecap="round"/><circle cx="80" cy="36" r="10" fill="none" stroke="var(--text-secondary, #666)" stroke-width="3"/><circle cx="80" cy="36" r="4" fill="var(--text-secondary, #666)"/><path d="M80 46 L80 56" stroke="var(--text-secondary, #666)" stroke-width="2.5" stroke-linecap="round"/><path d="M20 62 L40 62 L55 58 L70 62 L88 62" stroke="var(--text-secondary, #666)" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/><path d="M15 72 L35 72 M45 72 L65 72 M75 72 L88 72" stroke="var(--text-muted, #888)" stroke-width="2" stroke-linecap="round" stroke-dasharray="3,3"/></svg>',
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
  },
  'obstacle-crossing': {
    name: 'Engel Geçme',
    svg: '<svg width="38" height="38" viewBox="0 0 100 100"><path d="M5 75 L30 75 L40 40 L60 40 L70 75 L95 75" fill="none" stroke="var(--accent-warning, #ff9800)" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/><line x1="5" y1="80" x2="95" y2="80" stroke="var(--text-secondary, #666)" stroke-width="3"/><circle cx="20" cy="75" r="6" fill="none" stroke="var(--accent-primary, #3b82f6)" stroke-width="3"/><circle cx="80" cy="75" r="6" fill="none" stroke="var(--accent-primary, #3b82f6)" stroke-width="3"/><path d="M42 38 L50 25 L58 38" fill="none" stroke="var(--accent-warning, #ff9800)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    inputs: 0,
    outputs: 0,
    maxInstances: 1
  },
  'gear-shift': {
    name: 'Vites Geçişleri',
    svg: '<svg width="38" height="38" viewBox="0 0 100 100"><rect x="15" y="10" width="70" height="80" rx="8" fill="none" stroke="var(--accent-warning, #ff9800)" stroke-width="4"/><circle cx="35" cy="35" r="6" fill="var(--text-secondary, #666)"/><circle cx="65" cy="35" r="6" fill="var(--text-secondary, #666)"/><circle cx="35" cy="60" r="6" fill="var(--text-secondary, #666)"/><circle cx="65" cy="60" r="6" fill="var(--text-secondary, #666)"/><path d="M35 35 L35 60" stroke="var(--accent-warning, #ff9800)" stroke-width="3" stroke-linecap="round"/><path d="M35 60 L65 60" stroke="var(--accent-warning, #ff9800)" stroke-width="3" stroke-linecap="round"/><circle cx="35" cy="60" r="8" fill="none" stroke="var(--accent-warning, #ff9800)" stroke-width="2"/></svg>',
    inputs: 0,
    outputs: 0
  },
  // ── Takoz Çökme-Titreşim analizi — GERÇEK KANVAS BİLEŞENLERİ ─────────────
  // "Programın normali gibi": Motor/Şanzıman/Şaft/Braket/Kütle (kütle gövdeleri,
  // çıkış portu) ve Takoz (çıkış portu) sürüklenip Çözücü'ye (giriş portu)
  // bağlanır. Çözücü kendisine bağlı kütle+takoz node'larını okuyup 6 SD rijit
  // gövde analizini OTOMATİK yük durumlarıyla çalıştırır (kullanıcı yük girmez).
  // Veri: node.data (mass/cg/atalet veya konum/rijitlik). Panel: cp-mount.js.
  'mnt-motor': {
    name: 'Motor (Kütle)',
    svg: '<svg width="38" height="38" viewBox="0 0 100 100"><rect x="20" y="36" width="60" height="44" rx="4" fill="var(--accent-primary, #3b82f6)" opacity="0.85"/><rect x="30" y="22" width="14" height="16" fill="var(--accent-primary, #3b82f6)"/><rect x="52" y="22" width="14" height="16" fill="var(--accent-primary, #3b82f6)"/><circle cx="50" cy="58" r="5" fill="#fff"/></svg>',
    inputs: 0, outputs: 1, isMountBody: true
  },
  'mnt-gearbox': {
    name: 'Şanzıman (Kütle)',
    svg: '<svg width="38" height="38" viewBox="0 0 100 100"><rect x="26" y="24" width="48" height="56" rx="5" fill="var(--accent-primary, #3b82f6)" opacity="0.7"/><circle cx="50" cy="52" r="15" fill="none" stroke="#fff" stroke-width="4"/><circle cx="50" cy="52" r="4" fill="#fff"/></svg>',
    inputs: 0, outputs: 1, isMountBody: true
  },
  'mnt-shaft': {
    name: 'Şaft (Kütle)',
    svg: '<svg width="38" height="38" viewBox="0 0 100 100"><rect x="10" y="44" width="80" height="12" rx="6" fill="var(--text-secondary, #888)"/><circle cx="24" cy="50" r="8" fill="none" stroke="var(--text-muted, #aaa)" stroke-width="3"/><circle cx="76" cy="50" r="8" fill="none" stroke="var(--text-muted, #aaa)" stroke-width="3"/><circle cx="50" cy="50" r="5" fill="#fff"/></svg>',
    inputs: 0, outputs: 1, isMountBody: true
  },
  'mnt-bracket': {
    name: 'Braket (Kütle)',
    svg: '<svg width="38" height="38" viewBox="0 0 100 100"><path d="M30 18 L30 78 L80 78" fill="none" stroke="var(--text-secondary, #888)" stroke-width="11" stroke-linecap="round" stroke-linejoin="round"/><circle cx="42" cy="64" r="5" fill="#fff"/></svg>',
    inputs: 0, outputs: 1, isMountBody: true
  },
  'mnt-transfer': {
    name: 'Transfer Kutusu',
    svg: '<svg width="38" height="38" viewBox="0 0 100 100"><rect x="28" y="24" width="44" height="52" rx="4" fill="var(--accent-primary, #3b82f6)" opacity="0.75"/><rect x="12" y="36" width="16" height="8" fill="var(--text-muted, #aaa)"/><rect x="72" y="34" width="16" height="7" fill="var(--text-muted, #aaa)"/><rect x="72" y="59" width="16" height="7" fill="var(--text-muted, #aaa)"/><circle cx="50" cy="50" r="5" fill="#fff"/></svg>',
    inputs: 0, outputs: 1, isMountBody: true
  },
  'mnt-mount': {
    name: 'Takoz',
    svg: '<svg width="38" height="38" viewBox="0 0 100 100"><rect x="30" y="8" width="40" height="18" rx="3" fill="var(--accent-success, #22c55e)"/><path d="M38 26 Q32 33 44 38 Q32 43 44 48 Q32 53 44 58 Q32 63 38 68" fill="none" stroke="var(--accent-success, #22c55e)" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M62 26 Q56 33 68 38 Q56 43 68 48 Q56 53 68 58 Q56 63 62 68" fill="none" stroke="var(--accent-success, #22c55e)" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><line x1="18" y1="72" x2="82" y2="72" stroke="var(--text-secondary, #888)" stroke-width="4"/><line x1="26" y1="72" x2="20" y2="82" stroke="var(--text-muted, #aaa)" stroke-width="2.5"/><line x1="44" y1="72" x2="38" y2="82" stroke="var(--text-muted, #aaa)" stroke-width="2.5"/><line x1="62" y1="72" x2="56" y2="82" stroke="var(--text-muted, #aaa)" stroke-width="2.5"/><line x1="80" y1="72" x2="74" y2="82" stroke="var(--text-muted, #aaa)" stroke-width="2.5"/></svg>',
    inputs: 0, outputs: 1, isMount: true, defaultWidth: 50, defaultHeight: 46
  },
  'mnt-solver': {
    name: 'Çözücü',
    svg: '<svg width="38" height="38" viewBox="0 0 100 100"><rect x="15" y="15" width="70" height="70" rx="8" fill="none" stroke="var(--accent-danger, #ef4444)" stroke-width="5"/><polygon points="40,32 40,68 70,50" fill="var(--accent-danger, #ef4444)"/><circle cx="78" cy="22" r="6" fill="var(--accent-warning, #f59e0b)"/></svg>',
    inputs: 1, outputs: 0, isMountSolver: true
  },
  // ── Araç Performans (ALT-SİSTEM / subsystem düğümü) ──────────────────────
  // Sürüklenebilir composite düğüm: ana canvas'ta tek blok; çift tıklanınca
  // kendi iç topolojisine girilir (gerçek güç aktarma bileşenleri). Aç/kapat
  // ve iç-topoloji mantığı js/cp-arac-performans.js içindedir.
  'arac-performans': {
    name: 'Araç Performans',
    svg: '<svg width="38" height="38" viewBox="0 0 100 100"><rect x="6" y="16" width="88" height="68" rx="9" fill="none" stroke="var(--accent-primary, #3b82f6)" stroke-width="4" stroke-dasharray="7 5"/><rect x="18" y="46" width="16" height="16" rx="2" fill="var(--text-secondary, #666)"/><line x1="34" y1="54" x2="47" y2="54" stroke="var(--text-secondary, #666)" stroke-width="4"/><circle cx="58" cy="54" r="10" fill="none" stroke="var(--text-secondary, #666)" stroke-width="4"/><circle cx="58" cy="54" r="3" fill="var(--text-secondary, #666)"/><line x1="68" y1="54" x2="77" y2="54" stroke="var(--text-secondary, #666)" stroke-width="4"/><circle cx="84" cy="54" r="6" fill="none" stroke="var(--text-muted, #888)" stroke-width="3"/><path d="M64 22 h18 v18" fill="none" stroke="var(--accent-primary, #3b82f6)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    inputs: 0,
    outputs: 0,
    isSubsystem: true,
    defaultWidth: 80,
    defaultHeight: 66
  },
  // Takoz Çökme-Titreşim ALT-SİSTEM MODÜLÜ — arac-performans ile aynı nested
  // topoloji kalıbı. Ana canvas'ta tek blok; çift tıkla → iç topolojisi (Motor/
  // Takoz/Çözücü) açılır (cp-mount.js veMntOpenEditor). isMountModule: dblclick.
  'mount-analysis': {
    name: 'Takoz Çökme-Titreşim',
    svg: '<svg width="38" height="38" viewBox="0 0 100 100"><rect x="6" y="14" width="88" height="72" rx="9" fill="none" stroke="var(--accent-primary, #3b82f6)" stroke-width="4" stroke-dasharray="7 5"/><rect x="34" y="30" width="32" height="13" rx="3" fill="var(--text-secondary, #666)"/><path d="M40 43 Q34 49 44 53 Q34 57 44 61 Q34 65 40 69" fill="none" stroke="var(--accent-success, #22c55e)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/><path d="M60 43 Q54 49 64 53 Q54 57 64 61 Q54 65 60 69" fill="none" stroke="var(--accent-success, #22c55e)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/><line x1="30" y1="71" x2="70" y2="71" stroke="var(--text-secondary, #666)" stroke-width="3"/></svg>',
    inputs: 0,
    outputs: 0,
    isSubsystem: true,
    isMountModule: true,
    defaultWidth: 80,
    defaultHeight: 66
  },
};

// Her bileşen tipi için sinyal tanımları (sensör okuyabilir)
var COMPONENT_SIGNALS = {
  'engine': {
    outputs: [
      {id: 'rpm', name: 'Motor Devri', unit: 'rpm'},
      {id: 'torque', name: 'Net Motor Torku', unit: 'Nm'},
      {id: 'power', name: 'Motor Gücü', unit: 'kW'},
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
  },
  'gear-shift': {
    outputs: [
      {id: 'current_gear', name: 'Aktif Vites', unit: '−'},
      {id: 'shift_time', name: 'Geçiş Süresi', unit: 's'}
    ]
  }
};

// ─── Modül seçim overlay'i ⇄ sidebar görünürlüğü senkronu ─────────────────
// Modül seçilmemişken (overlay görünür) sol Bileşenler panelini + açma rayını
// CSS ile gizle. Overlay'in display state'ini MutationObserver ile izleyip
// .ve-main.ve-no-module sınıfını otomatik aç/kapa — tek noktadan kontrol, tüm
// overlay show/hide yollarını (overlay tıklama, top tab, proje yükle, vb.)
// otomatik yakalar.
(function veObserveModuleOverlay() {
  function attach() {
    var overlay = document.getElementById('ve-module-overlay');
    var main = document.querySelector('.ve-main');
    if(!overlay || !main) { setTimeout(attach, 50); return; }
    function sync() {
      var visible = getComputedStyle(overlay).display !== 'none';
      main.classList.toggle('ve-no-module', visible);
    }
    sync();
    new MutationObserver(sync).observe(overlay, { attributes: true, attributeFilter: ['style', 'class'] });
  }
  attach();
})();

