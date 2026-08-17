// ============================================================================
// ANA MODÜL SİSTEMİ
// ============================================================================
// Tüm bileşenler tek bir ana modülde birleştirilmiştir.
var VE_MODULES = {
  'full-throttle': {
    name: 'Ana Sayfa',
    icon: '',
    description: 'Araç güç aktarma organları simülasyonu — tam gaz hızlanma ve performans analizi',
    components: ['engine','acc-ac','acc-alternator','acc-aircomp','torque-converter','ec-matching','engine-gearbox-matching','gearbox','shift-controller','gear-shift','propshaft','transfer','differential','wheel','vehicle','sensor','sensor-wizard','terminator','scenario','coast-down','solver','road','parametric','obstacle-crossing','ap-example','mnt-motor','mnt-gearbox','mnt-shaft','mnt-bracket','mnt-transfer','mnt-pto','mnt-pump','mnt-pto-group','mnt-mount','mnt-library','mnt-solver','mnt-example','mnt-viewer','mnt-coordframe','mnt-2dview','mnt-report','fead-crank','fead-alternator','fead-ac','fead-waterpump','fead-ps','fead-aircomp','fead-fan','fead-idler','fead-tensioner','fead-belt','fead-solver','fead-example','fead-layout','fead-report','arac-performans','mount-analysis','fead-analysis'],
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
//   'fead-analysis'   → "FEAD" alt topolojisi: kayış-kasnak bileşenleri (fead-*).
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
  // Panel/ray aynı turda gelsin — kanvası ölçen kod doğru genişliği görsün
  // (bkz. veSyncModuleShell).
  if(typeof veSyncModuleShell === 'function') veSyncModuleShell();

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

// Karşılama ekranındaki modül kartı → overlay'i kapat + seçilen modül bloğunu
// görünür alanın ortasına bırak (drag-drop ile aynı sonuç, tek tıkla). Kullanıcı
// çift tıklayarak alt-topolojiye girer; dilerse diğer modülü de sidebar'dan ekler.
// Not: veSelectModuleFromOverlay testlerce doğrulanan sözleşmeyi korur; bu ayrı
// fonksiyon yalnızca karşılama kartlarına bağlıdır.
function veStartModule(type) {
  var overlay = document.getElementById('ve-module-overlay');
  if(overlay) overlay.style.display = 'none';

  // Kabuğu (sol Bileşenler paneli + sayfa rayı) HEMEN yerine oturt. Bunu normalde
  // bir MutationObserver yapar (veObserveModuleOverlay) — ama gözlemci bu senkron
  // turun SONUNDA çalışır. Aşağıdaki kamera + blok konumu hesabı kanvası o andaki
  // ölçüsüyle okuduğu için, panel/ray henüz gizliyken kanvas 284px FAZLA geniş
  // görünür; blok da "ortaya" değil yarım-panel (142px) sağa düşerdi.
  if(typeof veSyncModuleShell === 'function') veSyncModuleShell();

  veActiveModule = 'full-throttle';
  if(typeof veSubTabDegistir === 'function') {
    veSubTabDegistir('arac-performans');
  } else {
    veSidebarMode = 'performans';
    if(typeof veShowAllSidebarComponents === 'function') veShowAllSidebarComponents();
  }

  // Boş tuvalde kamerayı "ev" konumuna al: kanvasın merkezi görünümün ortasına
  // gelsin (bkz. js/canvas-space.js). Açılışta karşılama ekranı yüzünden wrapper
  // ölçülemediyse ilk konum kaymış olabilir; blok ızgaranın ortasına düşsün diye
  // burada — ölçülerin kesin olduğu anda — bir kez daha uygulanır.
  if(typeof veCameraHome === 'function' && typeof nodes !== 'undefined' && nodes && !nodes.length) {
    veCameraHome();
  }

  // Seçilen modül bloğunu görünür alanın ortasına oluştur.
  // Canvas CSS'te -3000px offset'li → görünür merkez ≈ 3000 + yarı-genişlik.
  if(typeof createNode === 'function' && componentDefs[type]) {
    var def = componentDefs[type];
    var w = def.defaultWidth || 80, h = def.defaultHeight || 60;
    var cx = 3000 + 200 - w / 2, cy = 3000 + 140 - h / 2;
    var wrap = document.getElementById('ve-canvas-wrapper');
    if(wrap && typeof canvasOffset !== 'undefined' && typeof canvasZoom !== 'undefined') {
      var r = wrap.getBoundingClientRect();
      cx = (r.width / 2 - canvasOffset.x) / canvasZoom + 3000 - w / 2;
      cy = (r.height / 2 - canvasOffset.y) / canvasZoom + 3000 - h / 2;
    }
    createNode(type, cx, cy);
  }

  var label = (componentDefs[type] && componentDefs[type].name) ? componentDefs[type].name : type;
  if(typeof showToast === 'function') showToast(label + ' eklendi — çift tıklayarak açın', 'info');
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
    // Kapsam kuralı: 'module' (Modüller) YALNIZCA ana ekranda görünür — modül içine
    // girince (alt-topoloji) gizlenir (modül içinde modül açılmaz). Diğer paletler
    // yalnızca kendi kapsamlarında ('top' → ana ekran, modül tipi → o modülün içi).
    // Etiketsiz kategoriler bileşen paleti sayılır → yalnızca Araç Performans içinde.
    var scope = cat.getAttribute('data-ve-scope') || 'arac-performans';
    if(scope === 'module') { cat.style.display = (veSidebarScope === 'top') ? '' : 'none'; return; }
    cat.style.display = (scope === veSidebarScope) ? '' : 'none';
  });
}

// Sidebar kapsamını açık alt-sistem stack'lerinden hesapla ve uygula. Ana ekranda
// (hiçbir alt-sistem açık değil) → 'top'. Araç Performans / Takoz / FEAD içindeyken
// ilgili bileşen paleti gelir. Üç alt-sistem de (cp-arac-performans.js, cp-mount.js,
// cp-fead.js) aç/kapat sırasında bunu çağırır.
function veSyncSidebarScope() {
  var scope = 'top';
  if(typeof veAracStack !== 'undefined' && veAracStack.length) scope = 'arac-performans';
  if(typeof veMntStack !== 'undefined' && veMntStack.length) scope = 'mount-analysis';
  if(typeof veFeadStack !== 'undefined' && veFeadStack.length) scope = 'fead-analysis';
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
    // Ön (sol) taraftaki 3 GİRİŞ portu = aksesuarlar (Klima / Alternatör / Hava
    // Komp.). Sıra port index'ine kilitli (bkz. cp-accessories.js VE_ACC_PORT_MAP):
    //   input-0 = Klima, input-1 = Alternatör, input-2 = Hava Kompresörü.
    // Çıkış (güç aktarma) sağda kalır. Kutu 3 sol port için biraz büyütüldü.
    inputs: 3,
    outputs: 1,
    portLayout: { inputs: ['left','left','left'], outputs: ['right'] },
    defaultWidth: 66,
    defaultHeight: 76
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
  // Bağlantı = GÖRSEL/örgütsel (topolojiyi okunur kılar); ÇÖZÜCÜYÜ ETKİLEMEZ.
  // Çözücü kütle+takoz node'larını hâlâ TİPE göre OTOMATİK toplar (bkz. cp-mount.js
  // _mntGatherForSolver) — bağlantı zorunlu değildir. Portlar yalnız "neyi neyin
  // desteklediğini" göstermek için:
  //   • Kütle gövdeleri (Motor/Şanzıman/Şaft/Transfer): giriş portu = "mesnet"
  //     (takoz/cradle desteğini alır).
  //   • Braket/cradle: giriş (takozları alır) + çıkış (taşıdığı gövdeye gider).
  //   • Takoz: çıkış portu = desteklediği gövde/cradle'a; dış ucu "şasi" sembolüyle
  //     otomatik topraklanır (cp-mount.js veMntDecorateConnections).
  // Örnek yüklenince bu bağlantılar en-yakın-gövde kuralıyla OTOMATİK kurulur
  // (cp-mount.js _mntComputeSupportLinks). Veri: node.data (mass/cg/atalet veya
  // konum/rijitlik). Panel: cp-mount.js.
  'mnt-motor': {
    name: 'Motor',
    svg: '<svg width="38" height="38" viewBox="0 0 100 100"><rect x="20" y="36" width="60" height="44" rx="4" fill="var(--accent-primary, #3b82f6)" opacity="0.85"/><rect x="30" y="22" width="14" height="16" fill="var(--accent-primary, #3b82f6)"/><rect x="52" y="22" width="14" height="16" fill="var(--accent-primary, #3b82f6)"/><circle cx="50" cy="58" r="5" fill="#fff"/></svg>',
    inputs: 3, outputs: 0, isMountBody: true, defaultWidth: 84, defaultHeight: 76,
    portLayout: { inputs: ['left','top','bottom'] }   // ön / sağ / sol
  },
  'mnt-gearbox': {
    name: 'Şanzıman',
    svg: '<svg width="38" height="38" viewBox="0 0 100 100"><rect x="26" y="24" width="48" height="56" rx="5" fill="var(--accent-primary, #3b82f6)" opacity="0.7"/><circle cx="50" cy="52" r="15" fill="none" stroke="#fff" stroke-width="4"/><circle cx="50" cy="52" r="4" fill="#fff"/></svg>',
    inputs: 2, outputs: 0, isMountBody: true,
    portLayout: { inputs: ['top','bottom'] }   // sağ / sol
  },
  'mnt-shaft': {
    name: 'Şaft',
    svg: '<svg width="38" height="38" viewBox="0 0 100 100"><rect x="10" y="44" width="80" height="12" rx="6" fill="var(--text-secondary, #888)"/><circle cx="24" cy="50" r="8" fill="none" stroke="var(--text-muted, #aaa)" stroke-width="3"/><circle cx="76" cy="50" r="8" fill="none" stroke="var(--text-muted, #aaa)" stroke-width="3"/><circle cx="50" cy="50" r="5" fill="#fff"/></svg>',
    inputs: 1, outputs: 0, isMountBody: true
  },
  'mnt-bracket': {
    name: 'Braket',
    svg: '<svg width="38" height="38" viewBox="0 0 100 100"><path d="M30 18 L30 78 L80 78" fill="none" stroke="var(--text-secondary, #888)" stroke-width="11" stroke-linecap="round" stroke-linejoin="round"/><circle cx="42" cy="64" r="5" fill="#fff"/></svg>',
    inputs: 2, outputs: 1, isMountBody: true, defaultWidth: 50, defaultHeight: 46,
    portLayout: { inputs: ['top','bottom'], outputs: ['right'] }   // takozlar üst/alt
  },
  'mnt-transfer': {
    name: 'Transfer Kutusu',
    svg: '<svg width="38" height="38" viewBox="0 0 100 100"><rect x="28" y="24" width="44" height="52" rx="4" fill="var(--accent-primary, #3b82f6)" opacity="0.75"/><rect x="12" y="36" width="16" height="8" fill="var(--text-muted, #aaa)"/><rect x="72" y="34" width="16" height="7" fill="var(--text-muted, #aaa)"/><rect x="72" y="59" width="16" height="7" fill="var(--text-muted, #aaa)"/><circle cx="50" cy="50" r="5" fill="#fff"/></svg>',
    inputs: 1, outputs: 0, isMountBody: true
  },
  // ── PTO GRUBU (kuyruk mili + pompalar) ────────────────────────────────────
  // Güç grubuna CIVATALANAN yardımcı kütleler. Motor/Şanzıman gibi doğrudan
  // takoza oturmazlar; taşıyıcı gövdeye (tipik: Şanzıman) asılırlar → çıkış
  // portu "taşındığı gövde"ye gider (isMountCarried; bkz. cp-mount.js
  // _mntComputeSupportLinks). Çözücü açısından bunlar da isMountBody'dir:
  // kütle + CG + atalet birleşik ağırlık merkezine katılır.
  //
  // İKİ GİRİŞ YOLU — biri VEYA diğeri, ikisi birden DEĞİL (kütle iki kez sayılır):
  //   (a) ayrıntılı: 'mnt-pto' + n×'mnt-pump' — her parça kendi kütle/CG'siyle;
  //       parça ataleti veri sayfalarında genelde yoktur → nokta kütle varsayılan,
  //       yayılımın ataleti paralel-eksen teoremiyle birleştirmede kendiliğinden oluşur.
  //   (b) toplu: 'mnt-pto-group' — grubun kütlesi + grup CG'si + grup ataleti tek kalemde.
  // Panel her iki yolu da tanır ve çakışmayı canlı uyarır (cp-mount.js _mntPtoConflict).
  'mnt-pto': {
    name: 'PTO',
    svg: '<svg width="38" height="38" viewBox="0 0 100 100"><g stroke="var(--accent-primary, #3b82f6)" stroke-width="6.5" stroke-linecap="round"><line x1="32" y1="15" x2="32" y2="25"/><line x1="32" y1="75" x2="32" y2="85"/><line x1="7" y1="50" x2="17" y2="50"/><line x1="14" y1="32" x2="21" y2="39"/><line x1="14" y1="68" x2="21" y2="61"/><line x1="50" y1="32" x2="43" y2="39"/><line x1="50" y1="68" x2="43" y2="61"/></g><circle cx="32" cy="50" r="18" fill="var(--accent-primary, #3b82f6)" opacity="0.9"/><circle cx="32" cy="50" r="5.5" fill="#fff"/><rect x="50" y="46" width="30" height="8" rx="4" fill="var(--text-secondary, #888)"/><rect x="78" y="34" width="10" height="32" rx="3" fill="var(--text-secondary, #888)"/></svg>',
    inputs: 1, outputs: 1, isMountBody: true, isMountCarried: true, defaultWidth: 50, defaultHeight: 46,
    portLayout: { inputs: ['bottom'], outputs: ['right'] }
  },
  'mnt-pump': {
    name: 'Pompa',
    svg: '<svg width="38" height="38" viewBox="0 0 100 100"><rect x="6" y="45" width="24" height="10" rx="5" fill="var(--text-secondary, #888)"/><circle cx="57" cy="50" r="27" fill="var(--accent-primary, #3b82f6)" opacity="0.85"/><polygon points="47,36 47,64 73,50" fill="#fff"/><rect x="49" y="8" width="16" height="17" rx="3" fill="var(--text-secondary, #888)"/><rect x="49" y="75" width="16" height="17" rx="3" fill="var(--text-secondary, #888)"/></svg>',
    inputs: 1, outputs: 1, isMountBody: true, isMountCarried: true, defaultWidth: 50, defaultHeight: 46,
    portLayout: { inputs: ['bottom'], outputs: ['left'] }
  },
  'mnt-pto-group': {
    name: 'PTO Toplam',
    svg: '<svg width="38" height="38" viewBox="0 0 100 100"><text x="50" y="21" text-anchor="middle" font-size="22" font-weight="700" fill="var(--accent-primary, #3b82f6)" font-family="ui-monospace, monospace">&#931;</text><rect x="7" y="28" width="86" height="57" rx="10" fill="var(--accent-primary, #3b82f6)" fill-opacity="0.10" stroke="var(--accent-primary, #3b82f6)" stroke-width="4" stroke-dasharray="9 6"/><line x1="41" y1="56" x2="50" y2="56" stroke="var(--text-secondary, #888)" stroke-width="4" stroke-linecap="round"/><line x1="66" y1="56" x2="72" y2="56" stroke="var(--text-secondary, #888)" stroke-width="4" stroke-linecap="round"/><circle cx="28" cy="56" r="14" fill="var(--accent-primary, #3b82f6)" opacity="0.9"/><circle cx="28" cy="56" r="4.5" fill="#fff"/><circle cx="58" cy="56" r="10" fill="var(--accent-primary, #3b82f6)" opacity="0.6"/><circle cx="79" cy="56" r="8" fill="var(--accent-primary, #3b82f6)" opacity="0.42"/></svg>',
    inputs: 1, outputs: 1, isMountBody: true, isMountCarried: true, defaultWidth: 60, defaultHeight: 50,
    portLayout: { inputs: ['bottom'], outputs: ['left'] }
  },
  'mnt-mount': {
    name: 'Takoz',
    svg: '<svg width="38" height="38" viewBox="0 0 100 100"><rect x="30" y="8" width="40" height="18" rx="3" fill="var(--accent-success, #22c55e)"/><path d="M38 26 Q32 33 44 38 Q32 43 44 48 Q32 53 44 58 Q32 63 38 68" fill="none" stroke="var(--accent-success, #22c55e)" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><path d="M62 26 Q56 33 68 38 Q56 43 68 48 Q56 53 68 58 Q56 63 62 68" fill="none" stroke="var(--accent-success, #22c55e)" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/><line x1="18" y1="72" x2="82" y2="72" stroke="var(--text-secondary, #888)" stroke-width="4"/><line x1="26" y1="72" x2="20" y2="82" stroke="var(--text-muted, #aaa)" stroke-width="2.5"/><line x1="44" y1="72" x2="38" y2="82" stroke="var(--text-muted, #aaa)" stroke-width="2.5"/><line x1="62" y1="72" x2="56" y2="82" stroke="var(--text-muted, #aaa)" stroke-width="2.5"/><line x1="80" y1="72" x2="74" y2="82" stroke="var(--text-muted, #aaa)" stroke-width="2.5"/></svg>',
    inputs: 0, outputs: 1, isMount: true, defaultWidth: 50, defaultHeight: 46
  },
  // Takoz Özellikleri — takoz KATALOĞU/kütüphane yöneticisi. Fiziksel topolojiye
  // bağlanmaz (giriş/çıkış portu yok); node.data.mounts içinde kullanıcı tanımlı
  // takozları tutar. Buradaki girdiler her Takoz'un "Kütüphaneden yükle" listesinde
  // görünür. İç topolojide tek kopya (maxInstances:1). Panel: cp-mount.js.
  'mnt-library': {
    name: 'Takoz Özellikleri',
    svg: '<svg width="38" height="38" viewBox="0 0 100 100"><rect x="16" y="12" width="68" height="76" rx="6" fill="none" stroke="var(--accent-success, #22c55e)" stroke-width="5"/><path d="M40 30 Q34 35 43 39 Q34 43 43 47 Q34 51 40 55" fill="none" stroke="var(--accent-success, #22c55e)" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/><line x1="54" y1="34" x2="74" y2="34" stroke="var(--text-secondary, #888)" stroke-width="4" stroke-linecap="round"/><line x1="54" y1="44" x2="74" y2="44" stroke="var(--text-muted, #aaa)" stroke-width="4" stroke-linecap="round"/><line x1="26" y1="68" x2="74" y2="68" stroke="var(--text-muted, #aaa)" stroke-width="3.5" stroke-linecap="round"/><line x1="26" y1="78" x2="60" y2="78" stroke="var(--text-muted, #aaa)" stroke-width="3.5" stroke-linecap="round"/></svg>',
    inputs: 0, outputs: 0, isMountLibrary: true, maxInstances: 1, defaultWidth: 60, defaultHeight: 54
  },
  'mnt-solver': {
    name: 'Çözücü',
    svg: '<svg width="38" height="38" viewBox="0 0 100 100"><rect x="15" y="15" width="70" height="70" rx="8" fill="none" stroke="var(--accent-danger, #ef4444)" stroke-width="5"/><polygon points="40,32 40,68 70,50" fill="var(--accent-danger, #ef4444)"/><circle cx="78" cy="22" r="6" fill="var(--accent-warning, #f59e0b)"/></svg>',
    inputs: 0, outputs: 0, isMountSolver: true
  },
  // Araç Performans "Başlangıç ve Örnekler" — mnt-example'ın güç aktarma karşılığı.
  // Kayıt defteri ve panel js/cp-arac-example.js içinde.
  'ap-example': {
    name: 'Başlangıç ve Örnekler',
    svg: '<svg width="38" height="38" viewBox="0 0 100 100"><path d="M28 14 h32 l14 14 v58 h-46 z" fill="none" stroke="var(--accent-warning, #f59e0b)" stroke-width="5" stroke-linejoin="round"/><path d="M60 14 v14 h14" fill="none" stroke="var(--accent-warning, #f59e0b)" stroke-width="5" stroke-linejoin="round"/><rect x="34" y="42" width="14" height="11" rx="2" fill="var(--text-muted, #aaa)"/><line x1="48" y1="47" x2="56" y2="47" stroke="var(--text-muted, #aaa)" stroke-width="3"/><circle cx="61" cy="47" r="5" fill="none" stroke="var(--text-muted, #aaa)" stroke-width="3"/><line x1="36" y1="66" x2="66" y2="66" stroke="var(--text-muted, #aaa)" stroke-width="4" stroke-linecap="round"/><line x1="36" y1="76" x2="54" y2="76" stroke="var(--text-muted, #aaa)" stroke-width="4" stroke-linecap="round"/></svg>',
    inputs: 0, outputs: 0, isApExample: true, defaultWidth: 56, defaultHeight: 56
  },
  'mnt-example': {
    name: 'Başlangıç ve Örnekler',
    svg: '<svg width="38" height="38" viewBox="0 0 100 100"><path d="M28 14 h32 l14 14 v58 h-46 z" fill="none" stroke="var(--accent-warning, #f59e0b)" stroke-width="5" stroke-linejoin="round"/><path d="M60 14 v14 h14" fill="none" stroke="var(--accent-warning, #f59e0b)" stroke-width="5" stroke-linejoin="round"/><line x1="36" y1="44" x2="66" y2="44" stroke="var(--text-muted, #aaa)" stroke-width="4" stroke-linecap="round"/><line x1="36" y1="56" x2="66" y2="56" stroke="var(--text-muted, #aaa)" stroke-width="4" stroke-linecap="round"/><line x1="36" y1="68" x2="54" y2="68" stroke="var(--text-muted, #aaa)" stroke-width="4" stroke-linecap="round"/></svg>',
    inputs: 0, outputs: 0, isMountExample: true, defaultWidth: 56, defaultHeight: 56
  },
  'mnt-viewer': {
    name: '3D Görüntüleyici',
    svg: '<svg width="38" height="38" viewBox="0 0 100 100"><path d="M50 14 L84 32 L84 68 L50 86 L16 68 L16 32 Z" fill="none" stroke="var(--accent-primary, #3b82f6)" stroke-width="5" stroke-linejoin="round"/><path d="M50 14 L50 50 M50 50 L84 32 M50 50 L16 32" fill="none" stroke="var(--accent-primary, #3b82f6)" stroke-width="4" stroke-linejoin="round"/></svg>',
    inputs: 0, outputs: 0, isMountViewer: true, defaultWidth: 60, defaultHeight: 56
  },
  // Koordinat Düzlemi — koordinat sistemini (X/Y/Z eksenleri + düzlemler) 3B
  // gösterir; kullanıcı konum/CG değerlerini hangi eksene göre girdiğini görür.
  // Fiziksel topolojiye bağlanmaz. Panel/3B: cp-mount.js + cp-mount-viewer.js.
  'mnt-coordframe': {
    name: 'Koordinat Düzlemi',
    svg: '<svg width="38" height="38" viewBox="0 0 100 100"><path d="M32 66 L78 66 L60 84 L14 84 Z" fill="var(--text-muted, #aaa)" opacity="0.18" stroke="var(--text-muted, #aaa)" stroke-width="1.5"/><line x1="32" y1="66" x2="32" y2="16" stroke="var(--accent-danger, #ef4444)" stroke-width="4.5" stroke-linecap="round"/><polygon points="32,12 28,22 36,22" fill="var(--accent-danger, #ef4444)"/><line x1="32" y1="66" x2="86" y2="66" stroke="var(--accent-success, #22c55e)" stroke-width="4.5" stroke-linecap="round"/><polygon points="90,66 80,62 80,70" fill="var(--accent-success, #22c55e)"/><line x1="32" y1="66" x2="10" y2="86" stroke="var(--accent-primary, #3b82f6)" stroke-width="4.5" stroke-linecap="round"/><polygon points="7,89 18,84 12,78" fill="var(--accent-primary, #3b82f6)"/></svg>',
    inputs: 0, outputs: 0, isMountCoordFrame: true, defaultWidth: 60, defaultHeight: 56
  },
  // 2D Görünüm — güç grubunun üstten (X–Y) ve yandan (X–Z) ölçekli diyagramları:
  // takozlar, bileşen ağırlık merkezleri ve birleşik ağırlık merkezi. Topoloji
  // güncellendikçe yeniden çizilir. Fiziksel topolojiye bağlanmaz. Panel: cp-mount.js.
  'mnt-2dview': {
    name: '2D Görünüm',
    svg: '<svg width="38" height="38" viewBox="0 0 100 100"><rect x="12" y="14" width="76" height="34" rx="3" fill="none" stroke="var(--text-secondary, #888)" stroke-width="3"/><line x1="20" y1="40" x2="20" y2="20" stroke="var(--accent-danger, #ef4444)" stroke-width="2.5"/><line x1="20" y1="40" x2="44" y2="40" stroke="var(--accent-success, #22c55e)" stroke-width="2.5"/><circle cx="52" cy="30" r="4" fill="var(--accent-warning, #f59e0b)"/><rect x="64" y="24" width="8" height="8" fill="var(--accent-success, #22c55e)"/><rect x="12" y="54" width="76" height="34" rx="3" fill="none" stroke="var(--text-secondary, #888)" stroke-width="3"/><line x1="20" y1="80" x2="20" y2="60" stroke="var(--accent-danger, #ef4444)" stroke-width="2.5"/><line x1="20" y1="80" x2="44" y2="80" stroke="var(--accent-primary, #3b82f6)" stroke-width="2.5"/><circle cx="52" cy="66" r="4" fill="var(--accent-warning, #f59e0b)"/><rect x="64" y="70" width="8" height="8" fill="var(--accent-success, #22c55e)"/></svg>',
    inputs: 0, outputs: 0, isMount2DView: true, defaultWidth: 60, defaultHeight: 56
  },
  // Rapor — Çözücü'nün 6 SD sonuçlarını akademik, tamamen çevrimdışı bir HTML
  // rapora döker (teori + bu modelin sayısal örneği). Çözülmemişse uyarır.
  // Fiziksel topolojiye bağlanmaz. Panel/üreteç: cp-mount-report.js.
  'mnt-report': {
    name: 'Rapor',
    svg: '<svg width="38" height="38" viewBox="0 0 100 100"><path d="M26 12 h34 l16 16 v60 h-50 z" fill="none" stroke="var(--accent-primary, #3b82f6)" stroke-width="5" stroke-linejoin="round"/><path d="M60 12 v16 h16" fill="none" stroke="var(--accent-primary, #3b82f6)" stroke-width="5" stroke-linejoin="round"/><rect x="34" y="60" width="8" height="18" fill="var(--accent-primary, #3b82f6)"/><rect x="47" y="50" width="8" height="28" fill="var(--accent-primary, #3b82f6)"/><rect x="60" y="42" width="8" height="36" fill="var(--accent-primary, #3b82f6)"/><line x1="34" y1="40" x2="66" y2="40" stroke="var(--text-muted, #aaa)" stroke-width="4" stroke-linecap="round"/></svg>',
    inputs: 0, outputs: 0, isMountReport: true, defaultWidth: 60, defaultHeight: 56
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
    isSubsystem: true
    // Ölçü BURADA YOK: alt-sistem kartının ölçüsü tek yerden gelir
    // (VE_MODULE_CARD_W/H → aşağıdaki döngü). İki sayı iki yerde durursa
    // biri sessizce eskir.
  },
  // Takoz Çökme-Titreşim ALT-SİSTEM MODÜLÜ — arac-performans ile aynı nested
  // topoloji kalıbı. Ana canvas'ta tek blok; çift tıkla → iç topolojisi (Motor/
  // Takoz/Çözücü) açılır (cp-mount.js veMntOpenEditor). isMountModule: dblclick.
  'mount-analysis': {
    name: 'Takoz Çökme-Titreşim',
    svg: '<svg width="38" height="38" viewBox="0 0 100 100"><rect x="6" y="16" width="88" height="68" rx="9" fill="none" stroke="var(--accent-primary, #3b82f6)" stroke-width="4" stroke-dasharray="7 5"/><rect x="30" y="34" width="30" height="10" rx="2" fill="var(--text-secondary, #666)"/><path d="M38 44 Q32 50 42 54 Q32 58 42 62 Q32 66 38 70" fill="none" stroke="var(--accent-success, #22c55e)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/><path d="M52 44 Q46 50 56 54 Q46 58 56 62 Q46 66 52 70" fill="none" stroke="var(--accent-success, #22c55e)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/><line x1="26" y1="72" x2="64" y2="72" stroke="var(--text-secondary, #666)" stroke-width="3"/><path d="M64 22 h18 v18" fill="none" stroke="var(--accent-primary, #3b82f6)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    inputs: 0,
    outputs: 0,
    isSubsystem: true,
    isMountModule: true
  },
  // FEAD (Front End Accessory Drive) ALT-SİSTEM MODÜLÜ — motorun ön uç kayış-
  // kasnak sistemi. arac-performans / mount-analysis ile AYNI nested topoloji
  // kalıbı: ana canvas'ta tek kart, çift tıkla iç topolojisi (Krank Kasnağı /
  // aksesuar kasnakları / Gergi / Avara / Kayış / Çözücü) açılır
  // (cp-fead.js veFeadOpenEditor). isFeadModule: dblclick anahtarı.
  // Sembol: kesikli kap + İKİ kasnağı saran GERÇEK kayış çevresi (dış teğetler
  // + sarım yayları analitik hesaplandı: R1=16 @ (38,58), R2=9 @ (68,58)) —
  // modülün kimliği tek bakışta "kayış-kasnak".
  'fead-analysis': {
    name: 'FEAD',
    svg: '<svg width="38" height="38" viewBox="0 0 100 100"><rect x="6" y="16" width="88" height="68" rx="9" fill="none" stroke="var(--accent-primary, #3b82f6)" stroke-width="4" stroke-dasharray="7 5"/><circle cx="38" cy="58" r="16" fill="none" stroke="var(--text-secondary, #666)" stroke-width="3"/><circle cx="38" cy="58" r="5" fill="var(--text-secondary, #666)"/><circle cx="68" cy="58" r="9" fill="none" stroke="var(--text-secondary, #666)" stroke-width="3"/><circle cx="68" cy="58" r="3.2" fill="var(--text-secondary, #666)"/><path d="M41.7 42.4 L70.1 49.3 A9 9 0 0 1 70.1 66.8 L41.7 73.6 A16 16 0 1 1 41.7 42.4 Z" fill="none" stroke="var(--accent-warning, #f59e0b)" stroke-width="4" stroke-linejoin="round"/><path d="M64 22 h18 v18" fill="none" stroke="var(--accent-primary, #3b82f6)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    inputs: 0,
    outputs: 0,
    isSubsystem: true,
    isFeadModule: true
  },
  // ── Aksesuarlar (Araç Performans) — Motor'un ön portlarına bağlanır ──────
  // Diğer bileşenlerden bir tık daha küçük kutular. Çıkış portu (sağ) Motor'un
  // ilgili giriş portuna gider. Panel/veri/senkron: js/cp-accessories.js.
  'acc-ac': {
    name: 'Klima Kompresörü',
    svg: '<svg width="34" height="34" viewBox="0 0 100 100"><g stroke="var(--text-secondary, #666)" stroke-width="6" stroke-linecap="round"><line x1="50" y1="14" x2="50" y2="86"/><line x1="19" y1="32" x2="81" y2="68"/><line x1="81" y1="32" x2="19" y2="68"/></g><g stroke="var(--text-muted, #888)" stroke-width="4.5" stroke-linecap="round" fill="none"><path d="M50 14 l-9 11 M50 14 l9 11 M50 86 l-9 -11 M50 86 l9 -11 M19 32 l1 14 M19 32 l13 -3 M81 68 l-1 -14 M81 68 l-13 3 M81 32 l-13 -3 M81 32 l1 14 M19 68 l13 3 M19 68 l1 -14"/></g></svg>',
    inputs: 0, outputs: 1, defaultWidth: 54, defaultHeight: 50
  },
  'acc-alternator': {
    name: 'Alternatör',
    svg: '<svg width="34" height="34" viewBox="0 0 100 100"><circle cx="52" cy="52" r="30" fill="none" stroke="var(--text-secondary, #666)" stroke-width="6"/><path d="M56 30 L38 57 L50 57 L45 74 L64 46 L52 46 Z" fill="var(--text-muted, #888)"/><rect x="10" y="47" width="13" height="9" rx="1" fill="var(--text-muted, #888)"/></svg>',
    inputs: 0, outputs: 1, defaultWidth: 54, defaultHeight: 50
  },
  'acc-aircomp': {
    name: 'Hava Kompresörü',
    svg: '<svg width="34" height="34" viewBox="0 0 100 100"><rect x="20" y="34" width="48" height="46" rx="8" fill="var(--text-secondary, #666)"/><circle cx="44" cy="57" r="13" fill="none" stroke="var(--text-muted, #888)" stroke-width="4"/><line x1="44" y1="57" x2="52" y2="49" stroke="var(--text-muted, #888)" stroke-width="3" stroke-linecap="round"/><rect x="68" y="44" width="16" height="9" rx="1" fill="var(--text-muted, #888)"/><rect x="38" y="20" width="14" height="14" rx="2" fill="var(--text-muted, #888)"/></svg>',
    inputs: 0, outputs: 1, defaultWidth: 54, defaultHeight: 50
  },

  // ── FEAD (Front End Accessory Drive) — motorun ön uç kayış-kasnak sistemi ──
  // YALNIZ 'fead-analysis' modülünün İÇ TOPOLOJİSİNDE görünürler (sidebar
  // kapsamı 'fead-analysis'; bkz. veShowAllSidebarComponents). Panel/aç-kapa
  // mantığı js/cp-fead.js içindedir.
  //
  // BAĞLANTI = KAYIŞ YOLU. Diğer iki modülde bağlantı ya güç akışı (Araç
  // Performans) ya da salt görsel (Takoz) demekti; burada üçüncü bir anlamı
  // var ve fiziksel: bağlantı, serpantin kayışın kasnaktan kasnağa geçtiği
  // SIRAdır. Krank Kasnağı'nın çıkışından başlar, kasnakları dolaşır ve
  // Krank'ın girişine döner — yani kapalı bir çevrimdir. Bu yüzden HER kasnak
  // 1 giriş + 1 çıkış taşır (kayış gelir, kayış gider); "kaynak" ile "yük"
  // ayrımı porttan değil, tipten okunur (isFeadDriver / isFeadAccessory).
  // Sarım açısı ve kayış boyu bu sıradan + kasnak konumlarından türetilir.
  //
  // Renk dili: KAYIŞ her yerde amber (--accent-warning), kasnak kanalı mavi
  // (--accent-primary), gövdeler nötr gri. Böylece 38 px'lik sembolde bile
  // "hangisi kayış, hangisi kasnak" ayrımı okunur kalır.
  //
  // feadContact: TEMAS TARAFI VARSAYILANI. Kayış kasnağa kaburgalı yüzünden mi
  // ('grooved') yoksa sırtından mı ('back') değiyor. Hesap için ZORUNLU ve
  // spesifikasyona göre ÇIKARSANAMAZ: ters verilirse çekirdek başka bir
  // GEÇERLİ güzergâh hesaplar (kapalı çevrim de sarım değişmezi de tutar) →
  // sessizce yanlış tasarım. Buradaki değer yalnız VARSAYILAN; kullanıcı her
  // kasnakta panelden değiştirebilir (node.data.contact) ve kanvasta rozet
  // olarak görür. Tek okuma noktası: veFeadContactOf (js/fead-model.js).
  // Aksesuarlar kayışı kaburgalı yüzden çeker; avara ve gergi tipik olarak
  // kayışın sırtına bastırır — varsayılanlar bu yüzden böyle.
  'fead-crank': {
    name: 'Krank Kasnağı',
    // Torsiyonel damperli krank kasnağı: dış V-kanal halkası, kesikli amber
    // halka = damper kauçuğu (kasnağı sıradan bir kasnaktan ayıran işaret),
    // göbek flanşı + 4 cıvata.
    svg: '<svg width="38" height="38" viewBox="0 0 100 100"><circle cx="50" cy="50" r="38" fill="none" stroke="var(--accent-primary, #3b82f6)" stroke-width="5"/><circle cx="50" cy="50" r="31" fill="none" stroke="var(--text-muted, #888)" stroke-width="2.5"/><circle cx="50" cy="50" r="25" fill="none" stroke="var(--accent-warning, #f59e0b)" stroke-width="3" stroke-dasharray="5 4"/><circle cx="50" cy="50" r="17" fill="none" stroke="var(--text-secondary, #666)" stroke-width="3.5"/><circle cx="50" cy="38.5" r="2.6" fill="var(--text-muted, #888)"/><circle cx="61.5" cy="50" r="2.6" fill="var(--text-muted, #888)"/><circle cx="50" cy="61.5" r="2.6" fill="var(--text-muted, #888)"/><circle cx="38.5" cy="50" r="2.6" fill="var(--text-muted, #888)"/><circle cx="50" cy="50" r="6" fill="var(--text-secondary, #666)"/></svg>',
    inputs: 1, outputs: 1, isFeadPulley: true, isFeadDriver: true, feadContact: 'grooved',
    defaultWidth: 72, defaultHeight: 66
  },
  'fead-alternator': {
    name: 'Alternatör',
    svg: '<svg width="38" height="38" viewBox="0 0 100 100"><circle cx="22" cy="50" r="14" fill="none" stroke="var(--accent-primary, #3b82f6)" stroke-width="5"/><circle cx="22" cy="50" r="4" fill="var(--accent-primary, #3b82f6)"/><line x1="36" y1="50" x2="41" y2="50" stroke="var(--text-muted, #888)" stroke-width="5"/><circle cx="64" cy="50" r="24" fill="none" stroke="var(--text-secondary, #666)" stroke-width="5"/><path d="M66.6 32.4 L55 53.2 L62.7 53.2 L59.5 64.1 L71.7 46.2 L64 46.2 Z" fill="var(--text-muted, #888)"/></svg>',
    inputs: 1, outputs: 1, isFeadPulley: true, isFeadAccessory: true, feadContact: 'grooved',
    defaultWidth: 62, defaultHeight: 58
  },
  'fead-ac': {
    name: 'Klima Kompresörü',
    svg: '<svg width="38" height="38" viewBox="0 0 100 100"><circle cx="22" cy="50" r="14" fill="none" stroke="var(--accent-primary, #3b82f6)" stroke-width="5"/><circle cx="22" cy="50" r="4" fill="var(--accent-primary, #3b82f6)"/><line x1="36" y1="50" x2="41" y2="50" stroke="var(--text-muted, #888)" stroke-width="5"/><circle cx="64" cy="50" r="24" fill="none" stroke="var(--text-secondary, #666)" stroke-width="5"/><g stroke="var(--text-muted, #888)" stroke-width="4" stroke-linecap="round"><line x1="64" y1="32" x2="64" y2="68"/><line x1="48.4" y1="41" x2="79.6" y2="59"/><line x1="79.6" y1="41" x2="48.4" y2="59"/></g></svg>',
    inputs: 1, outputs: 1, isFeadPulley: true, isFeadAccessory: true, feadContact: 'grooved',
    defaultWidth: 62, defaultHeight: 58
  },
  'fead-waterpump': {
    name: 'Su Pompası',
    svg: '<svg width="38" height="38" viewBox="0 0 100 100"><circle cx="22" cy="50" r="14" fill="none" stroke="var(--accent-primary, #3b82f6)" stroke-width="5"/><circle cx="22" cy="50" r="4" fill="var(--accent-primary, #3b82f6)"/><line x1="36" y1="50" x2="40" y2="50" stroke="var(--text-muted, #888)" stroke-width="5"/><circle cx="63" cy="50" r="24" fill="none" stroke="var(--text-secondary, #666)" stroke-width="5"/><g stroke="var(--text-muted, #888)" stroke-width="3.5" stroke-linecap="round"><line x1="70" y1="50" x2="80" y2="50"/><line x1="66.5" y1="56.1" x2="71.5" y2="64.7"/><line x1="59.5" y1="56.1" x2="54.5" y2="64.7"/><line x1="56" y1="50" x2="46" y2="50"/><line x1="59.5" y1="43.9" x2="54.5" y2="35.3"/><line x1="66.5" y1="43.9" x2="71.5" y2="35.3"/></g><circle cx="63" cy="50" r="5" fill="var(--text-secondary, #666)"/><rect x="57" y="73" width="12" height="15" rx="2" fill="var(--text-muted, #888)"/></svg>',
    inputs: 1, outputs: 1, isFeadPulley: true, isFeadAccessory: true, feadContact: 'grooved',
    defaultWidth: 62, defaultHeight: 58
  },
  'fead-ps': {
    name: 'Direksiyon Pompası',
    svg: '<svg width="38" height="38" viewBox="0 0 100 100"><circle cx="22" cy="50" r="14" fill="none" stroke="var(--accent-primary, #3b82f6)" stroke-width="5"/><circle cx="22" cy="50" r="4" fill="var(--accent-primary, #3b82f6)"/><line x1="36" y1="50" x2="41" y2="50" stroke="var(--text-muted, #888)" stroke-width="5"/><circle cx="64" cy="50" r="24" fill="none" stroke="var(--text-secondary, #666)" stroke-width="5"/><circle cx="64" cy="50" r="14" fill="none" stroke="var(--text-muted, #888)" stroke-width="4"/><g stroke="var(--text-muted, #888)" stroke-width="3.5" stroke-linecap="round"><line x1="64" y1="45.5" x2="64" y2="36"/><line x1="60.2" y1="52.5" x2="52" y2="57"/><line x1="67.8" y1="52.5" x2="76" y2="57"/></g><circle cx="64" cy="50" r="4.5" fill="var(--text-muted, #888)"/></svg>',
    inputs: 1, outputs: 1, isFeadPulley: true, isFeadAccessory: true, feadContact: 'grooved',
    defaultWidth: 62, defaultHeight: 58
  },
  'fead-aircomp': {
    name: 'Hava Kompresörü',
    svg: '<svg width="38" height="38" viewBox="0 0 100 100"><circle cx="19" cy="52" r="13" fill="none" stroke="var(--accent-primary, #3b82f6)" stroke-width="5"/><circle cx="19" cy="52" r="3.6" fill="var(--accent-primary, #3b82f6)"/><rect x="38" y="30" width="46" height="46" rx="7" fill="none" stroke="var(--text-secondary, #666)" stroke-width="5"/><circle cx="58" cy="53" r="12" fill="none" stroke="var(--text-muted, #888)" stroke-width="4"/><line x1="58" y1="53" x2="66" y2="45" stroke="var(--text-muted, #888)" stroke-width="3.5" stroke-linecap="round"/><rect x="52" y="14" width="14" height="16" rx="2" fill="var(--text-muted, #888)"/><rect x="84" y="45" width="12" height="9" rx="2" fill="var(--text-muted, #888)"/></svg>',
    inputs: 1, outputs: 1, isFeadPulley: true, isFeadAccessory: true, feadContact: 'grooved',
    defaultWidth: 62, defaultHeight: 58
  },
  'fead-fan': {
    name: 'Fan Kavraması',
    // Kesikli dış halka = viskoz kavrama gövdesi; dört kanat tek path'in 90°
    // döndürülmüş kopyasıdır (geometri tek yerde durur).
    svg: '<svg width="38" height="38" viewBox="0 0 100 100"><circle cx="50" cy="50" r="36" fill="none" stroke="var(--text-muted, #888)" stroke-width="2.5" stroke-dasharray="5 4"/><g fill="var(--accent-primary, #3b82f6)" opacity="0.85"><path d="M50 50 C50 32 40 20 27 26 C33 40 41 47 50 50 Z"/><path d="M50 50 C50 32 40 20 27 26 C33 40 41 47 50 50 Z" transform="rotate(90 50 50)"/><path d="M50 50 C50 32 40 20 27 26 C33 40 41 47 50 50 Z" transform="rotate(180 50 50)"/><path d="M50 50 C50 32 40 20 27 26 C33 40 41 47 50 50 Z" transform="rotate(270 50 50)"/></g><circle cx="50" cy="50" r="9" fill="none" stroke="var(--text-secondary, #666)" stroke-width="4"/><circle cx="50" cy="50" r="3" fill="var(--text-secondary, #666)"/></svg>',
    inputs: 1, outputs: 1, isFeadPulley: true, isFeadAccessory: true, feadContact: 'grooved',
    defaultWidth: 62, defaultHeight: 58
  },
  'fead-idler': {
    name: 'Avara Kasnak',
    // Yük çekmez, kayış yolunu yönlendirir: düz/çıplak kasnak + rulman.
    svg: '<svg width="38" height="38" viewBox="0 0 100 100"><circle cx="50" cy="50" r="32" fill="none" stroke="var(--accent-primary, #3b82f6)" stroke-width="5"/><circle cx="50" cy="50" r="24" fill="none" stroke="var(--text-muted, #888)" stroke-width="2.5"/><circle cx="50" cy="31.5" r="3" fill="var(--text-muted, #888)"/><circle cx="68.5" cy="50" r="3" fill="var(--text-muted, #888)"/><circle cx="50" cy="68.5" r="3" fill="var(--text-muted, #888)"/><circle cx="31.5" cy="50" r="3" fill="var(--text-muted, #888)"/><circle cx="50" cy="50" r="13" fill="none" stroke="var(--text-secondary, #666)" stroke-width="4"/><circle cx="50" cy="50" r="4" fill="var(--text-secondary, #666)"/></svg>',
    inputs: 1, outputs: 1, isFeadPulley: true, isFeadIdler: true, feadContact: 'back',
    defaultWidth: 54, defaultHeight: 50
  },
  'fead-tensioner': {
    name: 'Gergi',
    // Pivot + kol + kasnak; amber yay oku kolun salınım yönünü söyler
    // (otomatik gergi). Avara ile karışmasın diye kol ZORUNLU işarettir.
    svg: '<svg width="38" height="38" viewBox="0 0 100 100"><line x1="64" y1="36" x2="24" y2="76" stroke="var(--text-secondary, #666)" stroke-width="8" stroke-linecap="round"/><circle cx="24" cy="76" r="8" fill="none" stroke="var(--text-secondary, #666)" stroke-width="4"/><circle cx="24" cy="76" r="2.6" fill="var(--text-secondary, #666)"/><circle cx="64" cy="36" r="21" fill="none" stroke="var(--accent-primary, #3b82f6)" stroke-width="5"/><circle cx="64" cy="36" r="6" fill="var(--accent-primary, #3b82f6)"/><path d="M41 89 A 44 44 0 0 0 73 79" fill="none" stroke="var(--accent-warning, #f59e0b)" stroke-width="3.5" stroke-linecap="round"/><polygon points="72,72 84,79 71,85" fill="var(--accent-warning, #f59e0b)"/></svg>',
    inputs: 1, outputs: 1, isFeadPulley: true, isFeadTensioner: true, feadContact: 'back',
    defaultWidth: 58, defaultHeight: 54
  },
  // Kayış Özellikleri — kayışın KENDİSİ bir kasnak değildir: konumu yoktur,
  // topolojiye bağlanmaz. İç topolojide tek kopya (maxInstances:1) durur ve
  // kayış tipini/kesitini/uzunluğunu taşır. Sembol: poly-V kesiti (sırtlar
  // aşağı bakar — kasnak tarafı) + künye satırları.
  'fead-belt': {
    name: 'Kayış Özellikleri',
    svg: '<svg width="38" height="38" viewBox="0 0 100 100"><rect x="14" y="12" width="72" height="76" rx="6" fill="none" stroke="var(--accent-warning, #f59e0b)" stroke-width="5"/><path d="M24 30 H76 V40 L67 52 L58 40 L49 52 L40 40 L31 52 L24 40 Z" fill="var(--accent-warning, #f59e0b)" fill-opacity="0.18" stroke="var(--accent-warning, #f59e0b)" stroke-width="3" stroke-linejoin="round"/><line x1="26" y1="66" x2="74" y2="66" stroke="var(--text-muted, #aaa)" stroke-width="4" stroke-linecap="round"/><line x1="26" y1="76" x2="58" y2="76" stroke="var(--text-muted, #aaa)" stroke-width="4" stroke-linecap="round"/></svg>',
    inputs: 0, outputs: 0, isFeadBelt: true, maxInstances: 1,
    defaultWidth: 60, defaultHeight: 54
  },
  'fead-solver': {
    name: 'Çözücü',
    svg: '<svg width="38" height="38" viewBox="0 0 100 100"><rect x="15" y="15" width="70" height="70" rx="8" fill="none" stroke="var(--accent-warning, #f59e0b)" stroke-width="5"/><polygon points="40,32 40,68 70,50" fill="var(--accent-warning, #f59e0b)"/><circle cx="78" cy="22" r="6" fill="var(--accent-primary, #3b82f6)"/></svg>',
    inputs: 0, outputs: 0, isFeadSolver: true
  },
  'fead-example': {
    name: 'Başlangıç ve Örnekler',
    svg: '<svg width="38" height="38" viewBox="0 0 100 100"><path d="M28 14 h32 l14 14 v58 h-46 z" fill="none" stroke="var(--accent-warning, #f59e0b)" stroke-width="5" stroke-linejoin="round"/><path d="M60 14 v14 h14" fill="none" stroke="var(--accent-warning, #f59e0b)" stroke-width="5" stroke-linejoin="round"/><circle cx="42" cy="48" r="8" fill="none" stroke="var(--text-muted, #aaa)" stroke-width="3"/><circle cx="62" cy="44" r="5" fill="none" stroke="var(--text-muted, #aaa)" stroke-width="3"/><line x1="36" y1="68" x2="66" y2="68" stroke="var(--text-muted, #aaa)" stroke-width="4" stroke-linecap="round"/><line x1="36" y1="78" x2="54" y2="78" stroke="var(--text-muted, #aaa)" stroke-width="4" stroke-linecap="round"/></svg>',
    inputs: 0, outputs: 0, isFeadExample: true, defaultWidth: 56, defaultHeight: 56
  },
  // Kayış Yolu — kasnak konumlarından ölçekli serpantin şeması. Sembolün
  // kendisi de GERÇEK geometridir: üç kasnağın (R=15/9/7) dış teğetleri ve
  // sarım yayları analitik çözülüp path'e yazıldı (bkz. cp-fead.js).
  'fead-layout': {
    name: 'Kayış Yolu',
    svg: '<svg width="38" height="38" viewBox="0 0 100 100"><path d="M25.9 49.3 L65.2 24.4 A9 9 0 0 1 79 31.5 L81 65.6 A7 7 0 0 1 71.9 72.7 L29.6 76.3 A15 15 0 0 1 25.9 49.3 Z" fill="none" stroke="var(--accent-warning, #f59e0b)" stroke-width="4" stroke-linejoin="round"/><circle cx="34" cy="62" r="15" fill="none" stroke="var(--text-secondary, #666)" stroke-width="3"/><circle cx="34" cy="62" r="4.5" fill="var(--text-secondary, #666)"/><circle cx="70" cy="32" r="9" fill="none" stroke="var(--text-secondary, #666)" stroke-width="3"/><circle cx="70" cy="32" r="3" fill="var(--text-secondary, #666)"/><circle cx="74" cy="66" r="7" fill="none" stroke="var(--text-secondary, #666)" stroke-width="3"/><circle cx="74" cy="66" r="2.6" fill="var(--text-secondary, #666)"/></svg>',
    inputs: 0, outputs: 0, isFeadLayout: true
    // Ölçü BURADA YOK: Kayış Yolu düğümü kanvasta CANLI ŞEMA kartıdır ve
    // ölçüsü tek yerden gelir (VE_FEAD_LAYOUT_W/H → aşağıdaki döngü).
  },
  'fead-report': {
    name: 'Rapor',
    svg: '<svg width="38" height="38" viewBox="0 0 100 100"><path d="M26 12 h34 l16 16 v60 h-50 z" fill="none" stroke="var(--accent-primary, #3b82f6)" stroke-width="5" stroke-linejoin="round"/><path d="M60 12 v16 h16" fill="none" stroke="var(--accent-primary, #3b82f6)" stroke-width="5" stroke-linejoin="round"/><rect x="34" y="60" width="8" height="18" fill="var(--accent-primary, #3b82f6)"/><rect x="47" y="50" width="8" height="28" fill="var(--accent-primary, #3b82f6)"/><rect x="60" y="42" width="8" height="36" fill="var(--accent-primary, #3b82f6)"/><line x1="34" y1="40" x2="66" y2="40" stroke="var(--text-muted, #aaa)" stroke-width="4" stroke-linecap="round"/></svg>',
    inputs: 0, outputs: 0, isFeadReport: true, defaultWidth: 60, defaultHeight: 56
  },
};

// ── Port modeli yardımcıları (dinamik port sayısı + varsayılan kenar) ────────
// Bir düğümün ETKİN giriş/çıkış port sayısı: örnek-başı override (node.data.
// portOverride) varsa o, yoksa tip tanımındaki def.inputs/outputs. Kullanıcı
// port ekle/kaldır yaptığında portOverride yazılır (bkz. context-menus.js).
// createNode / getPortPosition / veSnapPortPos hep buradan okur → tutarlı.
function nodePortCount(node, kind){ // kind: 'inputs' | 'outputs'
  var def = (node && node.type && typeof componentDefs!=='undefined') ? (componentDefs[node.type]||{}) : {};
  var ov = node && node.data && node.data.portOverride;
  if(ov && typeof ov[kind] === 'number' && ov[kind] >= 0) return ov[kind];
  return def[kind] || 0;
}

// Bir portun VARSAYILAN kenarı (kullanıcı taşımadıysa). Öncelik: tipin portLayout'u
// (ör. Motor girişleri ön/sağ/sol) → aynalama → klasik (giriş sol, çıkış sağ).
// portLayout: { inputs:['left','top','bottom'], outputs:[...] } — index'e göre kenar.
function defaultPortSide(node, portType){
  var isInput = portType.indexOf('input') === 0;
  var idx = 0; if(portType.indexOf('-') > -1) idx = parseInt(portType.split('-')[1]) || 0;
  var def = (node && node.type && typeof componentDefs!=='undefined') ? (componentDefs[node.type]||{}) : {};
  var lay = def.portLayout && def.portLayout[isInput ? 'inputs' : 'outputs'];
  if(lay && lay[idx]) return lay[idx];
  if(node && node.mirrored) return isInput ? 'right' : 'left';
  return isInput ? 'left' : 'right';
}

// Bir portun, BULUNDUĞU KENAR üzerindeki yüzdelik konumu (0–100). Aynı kenardaki
// portlar sıraya göre eşit aralıklanır: tek port → %50 (orta), iki port → %33/%66…
// Böylece bir portu bir kenara taşıyınca kenarın ORTASINA oturur (köşesine değil),
// aynı kenara birden çok atınca da yan yana dizilir. getPortPosition /
// updatePortPosition / veSnapPortPos hep buradan okur → DOM ve SVG hizalı kalır.
function portPerpPercent(node, portType){
  function sideOf(pid){
    return (node && node.data && node.data.portPositions && node.data.portPositions[pid] && node.data.portPositions[pid].side)
      || defaultPortSide(node, pid);
  }
  var mySide = sideOf(portType);
  var onSide = [];
  [['inputs','input'],['outputs','output']].forEach(function(k){
    var count = nodePortCount(node, k[0]);
    for(var i = 0; i < count; i++){
      var pid = (count === 1) ? k[1] : (k[1] + '-' + i);
      if(sideOf(pid) === mySide) onSide.push(pid);
    }
  });
  var rank = onSide.indexOf(portType);
  if(rank < 0){ rank = 0; onSide = [portType]; }
  return ((rank + 1) / (onSide.length + 1)) * 100;
}

// ── DÜĞÜM VARSAYILAN ÖLÇÜSÜ — tek gerçek kaynak ─────────────────────────────
// Sensör ve Sonlandırıcı küçük çizilir (33×33), geri kalan bileşenler 65×60;
// tip kendi defaultWidth/Height'ını bildiriyorsa o kazanır. Kuralı hem
// createNode (ui-core.js) hem de topoloji sınır çerçevesi (canvas-space.js
// veBoundaryBox) okur — ikisi ayrı sayı tutsaydı, ölçüsü kaydedilmemiş bir
// düğüm çerçeveyi olduğundan geniş/dar gösterirdi.
function veNodeDefaultSize(type) {
  var def = (typeof componentDefs !== 'undefined' && componentDefs[type]) || {};
  var kucuk = !!(def.isSensor || def.isTerminator);
  return {
    w: def.defaultWidth || (kucuk ? 33 : 65),
    h: def.defaultHeight || (kucuk ? 33 : 60)
  };
}

// ── ALT-SİSTEM (MODÜL) KARTI ────────────────────────────────────────────────
// Ana topolojide duran "Araç Performans" ve "Takoz Çökme-Titreşim" blokları
// sıradan bir bileşen DEĞİL: her biri kendi topolojisini İÇİNDE taşıyan bir
// KAP. Eskiden ikisi de 80×66'lık sıradan kutuyla çiziliyordu ve bu üç somut
// sorun üretiyordu:
//   • Ad kutunun ALTINDA yüzen etiketti → yan yana iki modülde "Araç
//     Performans" ile "Takoz Çökme-Titreşim" ÜST ÜSTE biniyordu.
//   • İçeride ne olduğu hiç görünmüyordu — boş modül ile 16 bileşenlik modül
//     ekranda birebir aynıydı.
//   • Çift tıkla girildiğini söyleyen hiçbir işaret yoktu.
// Kart üçünü de kapatır: ad kartın İÇİNDE (çarpışamaz), altında canlı özet
// (kaç bileşen / kaç bağlantı), sağ altta gir oku. Kabı anlatan biçim ise dış
// çerçeve + iç kart ("çerçeve içinde çerçeve") — CAE geleneğinde alt-sistem
// bloğunun standart imzası. Parıltı/gradyan yok; bu dosyanın geri kalanıyla
// aynı ölçüm-yazılımı dili.
// Genişlik keyfî değil ÖLÇÜLDÜ: en uzun modül adı ("Takoz Çökme-Titreşim")
// 12px/600'de 131 px yer istiyor; kartın metin dışı payı W − 101'dir (şerit 4 +
// sembol 45 + katla düğmesi 20 + gir oku 14 + boşluklar 18) → 236'da ad
// kesilmeden sığar (135 px, ölçülen boşluk 4 px). Ad kısalırsa kart küçülmez;
// modülün bileşenden ayrışması ölçünün kendisiyle anlatılıyor.
// TARİHÇE: kart 214 px doğmuştu; katla düğmesi (▾/▴) satıra girince metin alanı
// 133 → 113 px'e indi ve ad gerçek tarayıcıda kesildi ("Takoz Çökme-Titr…").
// 236 o 22 px'i geri veriyor. Eski 214×72 kayıtlar VE_MODULE_LEGACY_SIZES ile göç eder.
var VE_MODULE_CARD_W = 236;
var VE_MODULE_CARD_H = 72;
// HARİTA BİÇİMİ ölçüsü (js/topo-mini.js 'map'). Bu kartta aynı başlık satırının
// ALTINDA alt topolojinin haritası duruyor. 300×190 keyfî değil ÖLÇÜLDÜ: iç
// harita alanı 286×154 kalıyor ve gerçek topolojiler oraya 0,29 (Araç
// Performans, 937×532 yerel px) — 0,52 (FEAD, 437×296) ölçekle oturuyor; yani
// 65 px'lik bir düğüm ekranda ~19 px. Sembol seçiliyor, ad okunmuyor (harita
// düğüm adlarını bu yüzden yazmıyor). Üç modül yan yana 972 px eder.
var VE_MODULE_MAP_W = 300;
var VE_MODULE_MAP_H = 190;
// ESKİ varsayılanlar. Kayıttaki modül düğümü BİREBİR bunlardan birine eşitse
// "kullanıcı ölçüye hiç dokunmamış" sayılır ve güncel biçimin ölçüsüne
// yükseltilir; bilerek verilmiş her ölçü korunur. Bkz. veNormalizeModuleSize.
//   80×66  — kart öncesi sıradan kutu
//   214×72 — katla düğmesi öncesi kart
// Liste büyüyor çünkü her varsayılan değişikliği eski dosyalarda donmuş bir
// ölçü bırakıyor; burada anılmazsa o dosyalar sonsuza dek eski ölçüde kalırdı.
var VE_MODULE_LEGACY_W = 80;
var VE_MODULE_LEGACY_H = 66;
var VE_MODULE_LEGACY_SIZES = [[80, 66], [214, 72]];

// ── KAYIŞ YOLU KARTI (fead-layout) — kanvasta CANLI ŞEMA ────────────────────
// Bu düğüm bir düğme değil, tuvalin üstünde duran ölçekli bir şema: kasnak
// daireleri, teğet kayış çizgileri, gergi pivotu ve yön gülü. Kullanıcı
// koordinat/çap/temas girdilerini değiştirdikçe yeniden çizilir, yani
// modelinin tutarlı olup olmadığını PANEL AÇMADAN görür.
//
// Ölçü ÖLÇÜLDÜ, keyfî değil: FEAD_INFORMATION düzeninin en-boy oranı
// (465 × 315 mm ≈ 1.48) ve okunabilir en küçük kasnak adı (8px) birlikte
// 420×340'ta oturuyor; daha darda alternatör dairesi (Ø57) 6px'in altına
// düşüp ad etiketleri üst üste biniyor.
var VE_FEAD_LAYOUT_W = 420;
var VE_FEAD_LAYOUT_H = 340;
// Kart öncesi varsayılan (Aşama 0–3 kayıtları). BİREBİR bu ölçüdeyse — yani
// kullanıcı hiç dokunmamışsa — kart ölçüsüne yükseltilir; bilerek verilmiş her
// ölçü korunur. Modül kartındaki kuralın aynısı, bkz. veModuleSizeFor.
var VE_FEAD_LAYOUT_LEGACY_W = 60;
var VE_FEAD_LAYOUT_LEGACY_H = 56;

function veIsFeadLayoutNode(node) {
  if(!node || !node.type) return false;
  var defs = (typeof componentDefs !== 'undefined') ? componentDefs : null;
  var def = defs ? defs[node.type] : null;
  return !!(def && def.isFeadLayout);
}
// SAF (ölçüyü döndürür) + yazan yüzü. Ayrı olmalarının nedeni modül kartıyla
// aynı: sekme önizlemesi düğümü DEĞİŞTİRMEDEN ölçüye ihtiyaç duyuyor.
function veFeadLayoutSizeFor(node) {
  var w = (node && node.width) || 65, h = (node && node.height) || 60;
  if(veIsFeadLayoutNode(node) && w === VE_FEAD_LAYOUT_LEGACY_W && h === VE_FEAD_LAYOUT_LEGACY_H) {
    return { w: VE_FEAD_LAYOUT_W, h: VE_FEAD_LAYOUT_H, changed: true };
  }
  return { w: w, h: h, changed: false };
}
function veFeadNormalizeLayoutSize(node) {
  var s = veFeadLayoutSizeFor(node);
  if(!s.changed) return false;
  node.width = s.w;
  node.height = s.h;
  return true;
}

// Bir biçimin ölçüsü — TEK KAYNAK. veModuleSizeFor, veApplyModuleViewSizes ve
// testler hep buradan okur.
function veModuleLayoutSize(layout) {
  return (layout === 'map')
    ? { w: VE_MODULE_MAP_W, h: VE_MODULE_MAP_H }
    : { w: VE_MODULE_CARD_W, h: VE_MODULE_CARD_H };
}

// "Kullanıcı bu düğümün ölçüsüne hiç dokunmamış" ölçütü: ölçü, BİLDİĞİMİZ
// varsayılanlardan birine BİREBİR eşitse. Eski 80×66 kayıtlar, kart ölçüsü ve
// harita ölçüsü — üçü de "varsayılan". Aradaki her şey kullanıcının kararıdır.
function veIsDefaultModuleSize(w, h) {
  if(w === VE_MODULE_CARD_W && h === VE_MODULE_CARD_H) return true;
  if(w === VE_MODULE_MAP_W  && h === VE_MODULE_MAP_H)  return true;
  for(var i = 0; i < VE_MODULE_LEGACY_SIZES.length; i++) {
    if(w === VE_MODULE_LEGACY_SIZES[i][0] && h === VE_MODULE_LEGACY_SIZES[i][1]) return true;
  }
  return false;
}

// Güncel genel ayarın ölçüsü tip tanımlarına BURADAN yazılır — defs içinde
// ayrıca sayı tutulmaz. veNodeDefaultSize / createNode / veStartModule /
// veBoundaryBox hepsi def.defaultWidth üzerinden okuduğu için tek atama yeter.
// Ayar değişince veSetModuleViewSetting yeniden çağırır.
function veApplyModuleViewSizes() {
  if(typeof componentDefs === 'undefined') return null;
  // 'zoom' modunda YENİ düğümün ölçüsü o anki kameradan çözülür (veModuleLayoutFor
  // düğümsüz çağrıda genel ayarı + kamerayı okur).
  var layout = (typeof veModuleLayoutFor === 'function') ? veModuleLayoutFor(null) : 'card';
  var s = veModuleLayoutSize(layout);
  Object.keys(componentDefs).forEach(function(t) {
    if(componentDefs[t] && componentDefs[t].isFeadLayout) {
      componentDefs[t].defaultWidth = VE_FEAD_LAYOUT_W;
      componentDefs[t].defaultHeight = VE_FEAD_LAYOUT_H;
    }
    if(componentDefs[t] && componentDefs[t].isSubsystem) {
      componentDefs[t].defaultWidth = s.w;
      componentDefs[t].defaultHeight = s.h;
    }
  });
  return s;
}
veApplyModuleViewSizes();

// Bu düğüm bir alt-sistem (modül) mü? Tek ölçüt tip tanımındaki isSubsystem —
// böylece ileride eklenecek üçüncü bir modül kartı kendiliğinden alır.
function veIsModuleNode(node) {
  if(!node || !node.type) return false;
  var defs = (typeof componentDefs !== 'undefined') ? componentDefs : null;
  var def = defs ? defs[node.type] : null;
  return !!(def && def.isSubsystem);
}

// Kartın canlı özeti: alt topoloji node.data.subTopology içinde saklanıyor
// (bkz. cp-arac-performans.js veAracCloseEditor / cp-mount.js).
function veModuleSummary(node) {
  var sub = node && node.data && node.data.subTopology;
  var n = (sub && sub.nodes && sub.nodes.length) || 0;
  var c = (sub && sub.connections && sub.connections.length) || 0;
  return { nodes: n, connections: c, initialized: n > 0 };
}

function veModuleSummaryText(node) {
  var s = veModuleSummary(node);
  if(!s.initialized) return 'Boş — çift tıklayın';
  return s.nodes + ' bileşen · ' + s.connections + ' bağlantı';
}

// Harita biçiminin başlık şeridi için KISA özet. Uzun sürüm 300px'lik başlıkta
// adı kesiyordu (gerçek tarayıcıda ölçüldü: "Araç Performa…"); sayılar zaten
// haritada da görünüyor, başlıkta doğrulama için bir çift sayı yeter.
function veModuleSummaryShort(node) {
  var s = veModuleSummary(node);
  if(!s.initialized) return 'boş';
  return s.nodes + ' · ' + s.connections;
}

// Eski kayıt yükseltmesi — TEK KURAL, iki yüz. veModuleSizeFor saf (ölçüyü
// döndürür), veNormalizeModuleSize onu düğüme yazar. Sekme önizlemesi
// (topology.js) düğümü DEĞİŞTİRMEDEN ölçüye ihtiyaç duyduğu için ayrıldılar;
// kural iki yerde ayrı yazılsaydı önizleme ile tuval farklı ölçü gösterirdi.
function veModuleSizeFor(node) {
  var w = (node && node.width) || 65, h = (node && node.height) || 60;
  if(veIsModuleNode(node) && veIsDefaultModuleSize(w, h)) {
    // Ölçüye dokunulmamış → düğümün GÜNCEL biçiminin ölçüsü. Böylece ayar
    // 'kart' ↔ 'harita' arasında gidip gelince düğümler de birlikte gidip
    // geliyor; kullanıcının elle boyutlandırdığı düğüm ise yerinde kalıyor.
    var layout = (typeof veModuleLayoutFor === 'function') ? veModuleLayoutFor(node) : 'card';
    var s = veModuleLayoutSize(layout);
    return { w: s.w, h: s.h, changed: (s.w !== w || s.h !== h) };
  }
  return { w: w, h: h, changed: false };
}

function veNormalizeModuleSize(node) {
  var s = veModuleSizeFor(node);
  if(!s.changed) return false;
  node.width = s.w;
  node.height = s.h;
  return true;
}

// Sidebar'daki modül satırının sembol ölçüsü. Tuvaldeki kart 30px kullanıyor;
// palette satırı daha dar olduğu için 26px — sıradan palet ögesinin 18px'inden
// belirgin biçimde büyük, yani modül orada da ayrışıyor.
var VE_SIDEBAR_MODULE_ICON = 26;

// Sidebar modül satırlarının sembolü TUVALDEKİ DÜĞÜMLE AYNI KAYNAKTAN gelir.
// Eskiden index.html içinde ikinci bir SVG kopyası duruyordu ve çoktan
// ayrışmıştı: tek renk (currentColor) çiziliyordu — tuvalde ise kesikli kap
// accent, takoz yayları yeşil — üstelik geometri de farklıydı (Araç Performans
// sembolünde iç nokta yoktu, takozda üst plaka yarı saydamdı). Yani palette'ten
// sürüklenen sembol, tuvale düşen sembol DEĞİLDİ. Tek kaynak bunu kapatır.
// Döner değer: sembolü kurulan satır sayısı (test + çağıran için).
function veSyncSidebarModuleIcons() {
  if(typeof document === 'undefined' || typeof componentDefs === 'undefined') return 0;
  var kurulan = 0;
  var satirlar = document.querySelectorAll('.ve-submodule[data-type]');
  for(var i = 0; i < satirlar.length; i++) {
    var row = satirlar[i];
    var def = componentDefs[row.getAttribute('data-type')];
    var slot = row.querySelector('.ve-submodule-ico');
    if(!def || !def.svg || !slot) continue;
    slot.innerHTML = def.svg;
    var svg = slot.querySelector('svg');
    if(svg) {
      svg.setAttribute('width', VE_SIDEBAR_MODULE_ICON);
      svg.setAttribute('height', VE_SIDEBAR_MODULE_ICON);
    }
    kurulan++;
  }
  return kurulan;
}

// Düğüm DOM'u kurulduktan SONRA çağrılır: kutunun içini karta çevirir.
// ÖNEMLİ — ad için YENİ bir eleman üretmez, mevcut .ve-node-label elemanını
// kartın içine TAŞIR. Böylece adı yazan her yol (özellik panelindeki yeniden
// adlandırma, sensör otomatik adlandırması, cp-mount takoz adı…) hiç
// değişmeden çalışmaya devam eder; kart sessizce eski adı göstermez.
function veApplyModuleCard(nodeEl, node) {
  if(!nodeEl || !veIsModuleNode(node)) return false;
  var box = nodeEl.querySelector('.ve-node-box');
  if(!box) return false;
  if(box.querySelector('.ve-mod-card')) return true;   // iki kez kurma

  nodeEl.classList.add('ve-node--module');

  var layout = (typeof veModuleLayoutFor === 'function') ? veModuleLayoutFor(node) : 'card';
  var svg = box.querySelector('svg');
  var label = nodeEl.querySelector('.ve-node-label');
  var summary = veModuleSummary(node);

  var card = document.createElement('div');
  card.className = 've-mod-card ve-mod-card--' + layout + (summary.initialized ? ' is-filled' : '');

  var rail = document.createElement('span');
  rail.className = 've-mod-rail';
  card.appendChild(rail);

  // ── Ortak başlık satırı (L2): sembol · ad · özet · katla · gir ────────────
  // Kart biçiminde başlık kartın TAMAMI, harita biçiminde ÜST ŞERİDİ. İki
  // biçimde de aynı elemanlar aynı sırada duruyor → harita açılıp kapanırken
  // kullanıcının gözü hiçbir şeyi yeniden aramıyor.
  var ico = document.createElement('span');
  ico.className = 've-mod-ico';
  if(svg) ico.appendChild(svg);          // tipin kendi sembolü — kopya değil, taşınır

  var text = document.createElement('span');
  text.className = 've-mod-text';
  if(label) {
    label.style.pointerEvents = 'none';  // ad artık kartın parçası, yüzen etiket değil
    text.appendChild(label);
  }
  var meta = document.createElement('span');
  meta.className = 've-mod-meta';
  var dot = document.createElement('i');
  dot.className = 've-mod-dot';
  meta.appendChild(dot);
  var metaText = document.createElement('span');
  metaText.className = 've-mod-stat';
  metaText.textContent = (layout === 'map') ? veModuleSummaryShort(node) : veModuleSummaryText(node);
  metaText.title = veModuleSummaryText(node);
  meta.appendChild(metaText);
  text.appendChild(meta);

  var toggle = veBuildModuleToggle(node, layout);
  var enter = document.createElement('span');
  enter.className = 've-mod-enter';
  enter.textContent = '▸';

  if(layout === 'map') {
    var body = document.createElement('span');
    body.className = 've-mod-body';

    var head = document.createElement('span');
    head.className = 've-mod-head';
    head.appendChild(ico);
    head.appendChild(text);
    head.appendChild(toggle);
    head.appendChild(enter);
    body.appendChild(head);

    var mapEl = document.createElement('span');
    mapEl.className = 've-mod-map';
    var svgStr = (typeof veModuleMapSVG === 'function') ? veModuleMapSVG(node) : '';
    if(svgStr) {
      mapEl.innerHTML = svgStr;
    } else {
      // Boş modül: harita alanı sessizce boş kalmaz — ne yapılacağını söyler.
      mapEl.classList.add('is-empty');
      var hint = document.createElement('span');
      hint.className = 've-mod-map-hint';
      hint.textContent = 'Boş — çift tıklayın';
      mapEl.appendChild(hint);
    }
    body.appendChild(mapEl);
    card.appendChild(body);
  } else {
    card.appendChild(ico);
    card.appendChild(text);
    card.appendChild(toggle);
    card.appendChild(enter);
  }

  box.appendChild(card);
  return true;
}

// Başlıktaki katla/aç düğmesi. Düğümün KENDİ tercihini (node.data.mapOpen)
// yazar; genel ayarı değiştirmez — bir modülü kapatmak diğerlerini etkilemez.
function veBuildModuleToggle(node, layout) {
  var btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 've-mod-toggle';
  btn.textContent = (layout === 'map') ? '▴' : '▾';
  btn.title = (layout === 'map') ? 'Haritayı katla' : 'Haritayı aç';
  btn.setAttribute('aria-label', btn.title);
  // Düğüm sürükleme ve "çift tıkla alt topolojiye gir" bu düğmede tetiklenmesin.
  btn.addEventListener('mousedown', function(e) { e.stopPropagation(); });
  btn.addEventListener('dblclick', function(e) { e.stopPropagation(); e.preventDefault(); });
  btn.addEventListener('click', function(e) {
    e.stopPropagation();
    e.preventDefault();
    veToggleModuleMap(node && node.id);
  });
  return btn;
}

// Tek düğümün biçimini çevir (kart ↔ harita).
function veToggleModuleMap(nodeId) {
  if(typeof nodes === 'undefined' || !nodeId) return false;
  var node = nodes.find(function(n) { return n.id === nodeId; });
  if(!node || !veIsModuleNode(node)) return false;
  var layout = (typeof veModuleLayoutFor === 'function') ? veModuleLayoutFor(node) : 'card';
  if(!node.data) node.data = {};
  node.data.mapOpen = (layout !== 'map');
  veRefreshModuleNode(node);
  if(typeof saveState === 'function') saveState();
  return true;
}

// Kartı SÖKER: ad etiketini ve tip sembolünü kartın dışına geri taşır, kartı
// kaldırır. Ad elemanı kopyalanmadığı için (bkz. veApplyModuleCard sözleşmesi)
// yeniden kurmadan önce onu kurtarmak ZORUNLU — yoksa biçim her değiştiğinde
// düğüm adını kaybederdi.
function veModuleCardTeardown(nodeEl) {
  if(!nodeEl) return false;
  var card = nodeEl.querySelector('.ve-mod-card');
  if(!card) return false;
  var box = nodeEl.querySelector('.ve-node-box');
  var label = card.querySelector('.ve-node-label');
  var svg = card.querySelector('.ve-mod-ico svg');
  if(box && svg) box.appendChild(svg);
  if(label) {
    label.style.pointerEvents = 'auto';
    nodeEl.appendChild(label);           // createNode'daki yer: kutunun DIŞI
  }
  if(card.parentNode) card.parentNode.removeChild(card);
  nodeEl.classList.remove('ve-node--module');
  return true;
}

// Tek modül düğümünü güncel biçimine geçir: ölçü + kart yeniden kurulur.
function veRefreshModuleNode(node) {
  if(typeof document === 'undefined' || !veIsModuleNode(node)) return false;
  var nodeEl = document.getElementById(node.id);
  if(!nodeEl) return false;

  var s = veModuleSizeFor(node);
  node.width = s.w;
  node.height = s.h;
  nodeEl.style.width = s.w + 'px';
  var box = nodeEl.querySelector('.ve-node-box');
  if(box) { box.style.width = s.w + 'px'; box.style.height = s.h + 'px'; }
  if(typeof updateNodeHandles === 'function') updateNodeHandles(nodeEl, s.w, s.h);

  veModuleCardTeardown(nodeEl);
  veApplyModuleCard(nodeEl, node);
  return true;
}

// Kanvastaki TÜM modül düğümlerini tazele (ayar değişti / kamera eşiği geçildi /
// alt topoloji güncellendi). Dönen değer: tazelenen düğüm sayısı.
function veRefreshModuleCards() {
  if(typeof nodes === 'undefined' || !nodes) return 0;
  var n = 0;
  nodes.forEach(function(node) { if(veRefreshModuleNode(node)) n++; });
  if(n) {
    if(typeof updateAllConnections === 'function') updateAllConnections();
    if(typeof veUpdateBoundary === 'function') veUpdateBoundary();
  }
  return n;
}

// ── PORT GEOMETRİSİ — TEK GERÇEK KAYNAK ─────────────────────────────────────
// Bağlantı eğrisinin ucu ile port dairesi AYNI noktadan okunmak zorunda. Eskiden
// üç ayrı yer üç ayrı sayı kullanıyordu:
//   • SVG ucu (getPortPosition / veSnapPortPos) → kenardan 7px DIŞARIDA
//   • ilk çizimdeki port DOM'u (CSS .input{left:-5px}/.output{right:-5px})
//     → merkezi kenar çizgisinin ÜSTÜNDE
//   • port yeniden kurulunca (updatePortPosition) → 4px daha dışarıda, 2px yukarıda
// Sonuç: eğri porta değmiyor, "bağlanmamış" gibi duruyordu; port ekle/kaldır ya da
// kenar değiştir sonrası daireler de yerinden oynuyordu. Artık ikisi de buradan.
var VE_PORT_SIZE = 8;      // .ve-node-port width/height (CSS ile AYNI olmalı)
var VE_NODE_BORDER = 1;    // .ve-node-box border kalınlığı (CSS ile AYNI olmalı)

// SAF: portun MERKEZİNİN düğüm sol-üst köşesine göre yerel konumu → {dx, dy, side}.
// Merkez, kutunun KENAR ÇİZGİSİNİN üstündedir (yarısı içeride, yarısı dışarıda) —
// port dairesi bugün ekranda zaten böyle duruyor; eğri artık oraya gidiyor.
function vePortOffset(node, portType){
  var w = (node && node.width) || 65, h = (node && node.height) || 60;
  var isInput = String(portType || '').indexOf('input') === 0;
  var pos = (node && node.data && node.data.portPositions && node.data.portPositions[portType]) || null;
  var side = pos ? pos.side
    : ((typeof defaultPortSide === 'function') ? defaultPortSide(node, portType)
      : ((node && node.mirrored) ? (isInput ? 'right' : 'left') : (isInput ? 'left' : 'right')));
  var frac = ((typeof portPerpPercent === 'function') ? portPerpPercent(node, portType) : 50) / 100;
  switch(side){
    case 'top':    return { dx: w * frac, dy: 0,        side: 'top' };
    case 'bottom': return { dx: w * frac, dy: h,        side: 'bottom' };
    case 'right':  return { dx: w,        dy: h * frac, side: 'right' };
    default:       return { dx: 0,        dy: h * frac, side: 'left' };
  }
}

// SAF: port DOM'unun left/top değerleri (px). Konumlama kabı .ve-node-box'ın
// PADDING kutusu → kenarlık kalınlığı kadar içeriden başlar; dairenin merkezini
// vePortOffset'e oturtmak için yarıçap da düşülür.
function vePortBoxStyle(node, portType){
  var o = vePortOffset(node, portType);
  var k = VE_NODE_BORDER + VE_PORT_SIZE / 2;
  return { left: o.dx - k, top: o.dy - k, side: o.side };
}

// ── DÜĞÜM ADININ ÇİZİM ÇIPASI — TEK GERÇEK KAYNAK ───────────────────────────
// Ad, node.data.labelPos ile kutunun altına/üstüne/soluna/sağına konabiliyor
// (sağ tık → Etiket Konumu; DOM tarafı context-menus.js applyNodeLabelPos +
// css .lbl-*). Ama SVG çizicileri bu alanı HİÇ okumuyordu: ekranda ÜSTTE duran
// ad, dışa aktarılan PNG/SVG'de ve şerit önizlemesinde ALTTA çiziliyordu —
// yani adı tellerin şeridinden kaçırmak için taşınan düğümde çıktı hâlâ eski
// kusuru gösteriyordu. Üç çizici (export-topology.js, topo-mini.js,
// topology.js şerit paneli) artık buradan okuyor.
// gap: 'bottom' için taban çizgisinin kutu altından uzaklığı (çiziciye göre
// 13–14 px). Yanlar CSS ile aynı: 7 px; üst 5 px.
function veNodeLabelAnchor(node, w, h, gap){
  var pos = (node && node.data && node.data.labelPos) || 'bottom';
  var g = (typeof gap === 'number' && isFinite(gap)) ? gap : 14;
  var x = node.x, y = node.y;
  switch(pos){
    case 'top':   return { x: x + w / 2, y: y - 5,          anchor: 'middle', pos: 'top' };
    case 'left':  return { x: x - 7,     y: y + h / 2 + 4,  anchor: 'end',    pos: 'left' };
    case 'right': return { x: x + w + 7, y: y + h / 2 + 4,  anchor: 'start',  pos: 'right' };
    default:      return { x: x + w / 2, y: y + h + g,      anchor: 'middle', pos: 'bottom' };
  }
}

// Yukarıdakinin HTML string üreticileri için hazır hâli (ilk çizim yolları:
// topology.js, ui-core.js createNode, state.js geri-yükleme).
function vePortStyleAttr(node, portType){
  var s = vePortBoxStyle(node, portType);
  return 'left:' + s.left + 'px; top:' + s.top + 'px;';
}

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
// Fiziksel güç zincirine bağlanmayan, "mantıksal" bileşenler. Doğrulama
// bunları bağlantısız saymaz; canvas'ta da kesikli çerçeveyle ayrışırlar ki
// kullanıcı "bunu bağlamayı mı unuttum?" diye tereddüt etmesin.
var VE_STANDALONE_TYPES = ['ap-example','vehicle','road','sensor','sensor-wizard','solver','scenario',
                           'coast-down','parametric','terminator','obstacle-crossing',
                           'ec-matching','engine-gearbox-matching','shift-controller'];

// Overlay'in görünürlüğünü kabuğa yaz: .ve-no-module sınıfı sol Bileşenler
// panelini, açma rayını ve sayfa rayını gizler/gösterir.
//
// Bu iş bir MutationObserver'a bağlı (aşağıda) — ama gözlemci geri çağrısı
// SENKRON turun sonunda çalışır. Overlay'ı gizleyip AYNI turda kanvası ölçen
// kod (veStartModule) panel/ray hâlâ gizliyken ölçerdi: kanvas 284px fazla
// geniş görünür, kamera ve bırakılan blok o kadar sağa kayardı. O yüzden
// fonksiyon dışarıdan da çağrılabilir; idempotenttir.
function veSyncModuleShell() {
  if(typeof document === 'undefined') return;
  var overlay = document.getElementById('ve-module-overlay');
  var main = document.querySelector('.ve-main');
  if(!overlay || !main) return;
  var visible = (typeof getComputedStyle === 'function')
    ? getComputedStyle(overlay).display !== 'none'
    : overlay.style.display !== 'none';
  main.classList.toggle('ve-no-module', visible);
  // Sayfa rayı (.ve-nav-rail) .ve-main'in DIŞINDA — Sonuçlar'da da durması
  // gerektiği için kabına taşındı. Aynı durumu oraya da yaz ki karşılama
  // ekranında ray da gizlensin: proje yokken "Sonuçlar" gidilecek yer değil.
  var shell = document.getElementById('sayfa2-content');
  if(shell) shell.classList.toggle('ve-no-module', visible);
  // Şerit de aynı duruma uysun: çalışma alanı yokken Kaydet/Doğrula/
  // Çalıştır gibi komutlar pasif çizilir (sol panel zaten gizleniyordu,
  // şeridin etkin görünmesi tutarsızdı).
  if(typeof veRibbonRender === 'function') veRibbonRender();
}

(function veObserveModuleOverlay() {
  function attach() {
    var overlay = document.getElementById('ve-module-overlay');
    var main = document.querySelector('.ve-main');
    if(!overlay || !main) { setTimeout(attach, 50); return; }
    veSyncModuleShell();
    new MutationObserver(veSyncModuleShell).observe(overlay, { attributes: true, attributeFilter: ['style', 'class'] });
  }
  attach();
})();

// Sidebar modül sembolleri — DOMContentLoaded'a güvenilemez: modüller giriş
// sonrası loader ile yükleniyor, o sırada olay çoktan geçmiş olabilir. Bu
// yüzden hem hemen denenir hem de satırlar henüz yoksa kısa aralıkla tekrar
// denenir (veObserveModuleOverlay ile aynı kalıp).
(function veInstallSidebarModuleIcons() {
  var kalanDeneme = 100;                       // ~5 sn; sonra sessizce vazgeç
  function dene() {
    if(veSyncSidebarModuleIcons() > 0) return;
    if(--kalanDeneme > 0) setTimeout(dene, 50);
  }
  dene();
})();

