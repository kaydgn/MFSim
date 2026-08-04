// ============================================================================
//  ARAÇ PERFORMANS — ALT-SİSTEM (SUBSYSTEM) DÜĞÜMÜ
// ============================================================================
// "Araç Performans" sürüklenebilir bir composite düğümdür. Ana canvas'ta tek blok
// olarak görünür; üstüne çift tıklanınca (veya panelinden "Alt Topolojiyi Aç")
// kendi İÇ TOPOLOJİSİNE girilir. İç topoloji GERÇEK güç aktarma bileşenlerini
// (Motor, Tork Konvertörü, Şanzıman, Propşaft, Transfer, Diferansiyel, Tekerlek…)
// kullanır — mevcut zengin özellik panelleri ve bağlantı/çözücü altyapısı aynen
// çalışır. "← Ana Topolojiye Dön" ile geri çıkılır.
//
// Uygulama: ana canvas makinesi (topology.js) yeniden kullanılır — girişte ebeveyn
// durumu saklanır, canvas alt-topoloji ile değiştirilir; çıkışta alt-topoloji
// düğümün node.data.subTopology'sine yazılıp ebeveyn geri yüklenir. İç içeyken
// kaydet/sekme-değiştir olursa veSaveActiveTabState() kancası önce köke çöker.

// ─── Hazır güç aktarma topolojisi (ilk açılışta iç topolojiye yerleştirilir) ──
// (yerel px koordinatlar; kurulumda görünür alanın merkezine ortalanır)
// Not: İlk oluşturulan diferansiyel/tekerlek createNode içinde otomatik "master ★"
// olur; bu yüzden üst diferansiyel ve üst-sağ tekerlek listede önce oluşturulur.
var VE_ARAC_PERFORMANS_LAYOUT = [
  { type:'solver',            lx:150, ly:0   },
  { type:'shift-controller',  lx:380, ly:0   },
  { type:'vehicle',           lx:510, ly:0   },
  { key:'engine',    type:'engine',            lx:30,  ly:190 },
  { key:'tc',        type:'torque-converter',  lx:185, ly:190 },
  { key:'gearbox',   type:'gearbox',           lx:320, ly:190 },
  { key:'propshaft', type:'propshaft',         lx:450, ly:190 },
  { key:'transfer',  type:'transfer',          lx:585, ly:190 },
  { key:'diffTop',   type:'differential',      lx:715, ly:110 }, // önce → master ★
  { key:'diffBot',   type:'differential',      lx:715, ly:300 },
  { key:'w1',        type:'wheel',             lx:850, ly:40  }, // önce → master ★
  { key:'w2',        type:'wheel',             lx:850, ly:160 },
  { key:'w3',        type:'wheel',             lx:850, ly:300 },
  { key:'w4',        type:'wheel',             lx:850, ly:420 },
  { key:'ec',        type:'ec-matching',       lx:175, ly:360 },
  { type:'obstacle-crossing', lx:400, ly:380 }
];

// Bağlantılar: [fromKey, toKey, fromPort, toPort]
// transfer/differential 2 çıkışlıdır → 'output-0' (üst) ve 'output-1' (alt).
var VE_ARAC_PERFORMANS_LINKS = [
  ['engine',    'tc',        'output',   'input'],
  ['engine',    'ec',        'output',   'input'],
  ['tc',        'gearbox',   'output',   'input'],
  ['gearbox',   'propshaft', 'output',   'input'],
  ['propshaft', 'transfer',  'output',   'input'],
  ['transfer',  'diffTop',   'output-0', 'input'],
  ['transfer',  'diffBot',   'output-1', 'input'],
  ['diffTop',   'w1',        'output-0', 'input'],
  ['diffTop',   'w2',        'output-1', 'input'],
  ['diffBot',   'w3',        'output-0', 'input'],
  ['diffBot',   'w4',        'output-1', 'input']
];

// Topolojiyi görünür alanın merkezine ortalayacak taban koordinatı hesapla.
// (drop handler ile aynı dönüşüm: ekran → canvas koordinatı; bkz. ui-core.js drop)
function veArrangeModuleBase(layout) {
  var CANVAS_OFFSET = 3000, NODE_W = 65, NODE_H = 60;
  var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  layout.forEach(function(it) {
    minX = Math.min(minX, it.lx);
    minY = Math.min(minY, it.ly);
    maxX = Math.max(maxX, it.lx + NODE_W);
    maxY = Math.max(maxY, it.ly + NODE_H);
  });
  var topoW = maxX - minX, topoH = maxY - minY;

  var wrapper = (typeof document !== 'undefined') ? document.getElementById('ve-canvas-wrapper') : null;
  if(!wrapper || typeof wrapper.getBoundingClientRect !== 'function') {
    return { x: CANVAS_OFFSET, y: CANVAS_OFFSET };
  }
  var rect = wrapper.getBoundingClientRect();
  var zoom = (typeof canvasZoom !== 'undefined' && canvasZoom) ? canvasZoom : 1;
  var offX = (typeof canvasOffset !== 'undefined') ? canvasOffset.x : CANVAS_OFFSET;
  var offY = (typeof canvasOffset !== 'undefined') ? canvasOffset.y : CANVAS_OFFSET;
  var cx = (rect.width / 2 - offX) / zoom + CANVAS_OFFSET;
  var cy = (rect.height / 2 - offY) / zoom + CANVAS_OFFSET;
  return {
    x: Math.max(40, cx - topoW / 2 - minX),
    y: Math.max(40, cy - topoH / 2 - minY)
  };
}

// Mevcut (iç) canvas'a hazır güç aktarma topolojisini kurar. Sadece düğüm+bağlantı
// oluşturur — mod değiştirmez, onay sormaz (boş bir alt-topolojiye çağrılır).
function veAracPopulateDrivetrain() {
  if(typeof createNode !== 'function' || typeof createConnection !== 'function') return [];
  var base = veArrangeModuleBase(VE_ARAC_PERFORMANS_LAYOUT);
  var ref = {}, created = [];
  VE_ARAC_PERFORMANS_LAYOUT.forEach(function(item) {
    var before = nodes.length;
    createNode(item.type, base.x + item.lx, base.y + item.ly);
    if(nodes.length > before) {
      var n = nodes[nodes.length - 1];
      created.push(n);
      if(item.key) ref[item.key] = n;
    }
  });
  // Bağlantılar. createConnection id'yi 'conn-'+Date.now() ile üretir; senkron
  // döngüde çakışabilir → topology.js:392 desenine göre benzersizleştir.
  VE_ARAC_PERFORMANS_LINKS.forEach(function(link) {
    var a = ref[link[0]], b = ref[link[1]];
    if(!a || !b) return;
    var before = connections.length;
    createConnection(a.id, b.id, link[2], link[3]);
    if(connections.length > before && typeof compCounter !== 'undefined') {
      compCounter++;
      connections[connections.length - 1].id = 'conn-' + compCounter;
    }
  });
  if(typeof updateAllConnections === 'function') updateAllConnections();
  return created;
}

// ════════════════════════════════════════════════════════════════════════════
//  ÖZELLİK PANELİ (side) — özet + "Alt Topolojiyi Aç"
// ════════════════════════════════════════════════════════════════════════════
function getAracPerformansPropertiesHTML(node){
  var sub = node && node.data && node.data.subTopology;
  var nCount = (sub && sub.nodes) ? sub.nodes.length : 0;
  var cCount = (sub && sub.connections) ? sub.connections.length : 0;
  var initialized = !!(sub && sub.nodes && sub.nodes.length);
  var html = '<div class="sw-panel">';
  html += '<div style="padding:8px 10px; margin-bottom:10px; font-size:var(--fs-tiny); line-height:1.4; color:var(--text-secondary); background:var(--bg-secondary); border:1px solid var(--border-color); border-left:3px solid var(--accent-primary);">'
        + '<b style="color:var(--text-heading);">Araç Performans — alt-sistem.</b> '
        + 'Üstüne <b>çift tıklayınca</b> kendi <b>alt topolojisine</b> girilir. Motor / Tork Konvertörü / Şanzıman / Diferansiyel / Tekerlek gibi güç aktarma bileşenlerini orada, kendi panellerinden düzenlersiniz.'
        + '</div>';
  html += '<table style="width:100%; font-size:var(--fs-body); border-collapse:collapse; border:1px solid var(--border-color); margin-bottom:10px;">';
  if(initialized){
    html += '<tr><td style="padding:5px 8px; border:1px solid var(--border-color); color:var(--text-secondary);">Bileşen</td><td style="padding:5px 8px; border:1px solid var(--border-color); color:var(--text-primary); font-weight:600;">' + nCount + '</td></tr>';
    html += '<tr><td style="padding:5px 8px; border:1px solid var(--border-color); color:var(--text-secondary);">Bağlantı</td><td style="padding:5px 8px; border:1px solid var(--border-color); color:var(--text-primary); font-weight:600;">' + cCount + '</td></tr>';
  } else {
    html += '<tr><td style="padding:7px 8px; border:1px solid var(--border-color); color:var(--text-muted);">Henüz açılmadı — ilk açılışta hazır güç aktarma topolojisi ile başlar.</td></tr>';
  }
  html += '</table>';
  html += '<button onclick="veAracOpenEditor(\'' + node.id + '\')" style="width:100%; padding:14px 16px; font-size:var(--fs-lg); font-weight:700; background:var(--accent-primary); color:#fff; border:none; cursor:pointer; letter-spacing:0.03em;" onmouseover="this.style.filter=\'brightness(1.15)\'" onmouseout="this.style.filter=\'none\'">▶ Alt Topolojiyi Aç</button>';
  html += '</div>';
  return html;
}

// ════════════════════════════════════════════════════════════════════════════
//  ALT TOPOLOJİ NAVİGASYONU (ana canvas'ı düğümün iç topolojisiyle değiştirir)
// ════════════════════════════════════════════════════════════════════════════
// Her giriş: { nodeId, parentState }. Çok seviyeli iç içe girişe (subsystem içinde
// subsystem) izin verir.
var veAracStack = [];
var _veAracBusy = false;

// _silent: autosave gibi arka-plan işlemleri köke çöküp (veSaveActiveTabState)
// kullanıcıyı bulunduğu alt-topolojiye geri getirirken true geçer; bu görünmez
// geri-girişte toast/animasyon tetiklenmez (breadcrumb ve sidebar yine güncellenir).
function veAracOpenEditor(nodeId, _silent){
  if(_veAracBusy) return;
  if(typeof nodes === 'undefined' || typeof veSerializeCurrentState !== 'function') return;
  var node = nodes.find(function(n){ return n.id === nodeId; });
  if(!node || node.type !== 'arac-performans') return;

  _veAracBusy = true;
  try {
    if(typeof veFlushOpenPanelData === 'function') veFlushOpenPanelData();
    if(typeof veTogglePropertiesPanel === 'function') veTogglePropertiesPanel(false);

    // Ebeveyn durumunu sakla, canvas'ı temizle
    var parentState = veSerializeCurrentState();
    veAracStack.push({ nodeId: nodeId, parentState: parentState });
    veClearCanvasDOM();

    // Alt-topolojiyi yükle; yoksa hazır preset ile başlat
    var sub = node.data && node.data.subTopology;
    if(sub && sub.nodes && sub.nodes.length){
      veLoadTabState({ state: sub });
    } else {
      veLoadTabState({ state: null });   // boş, temiz canvas
      veAracPopulateDrivetrain();
    }
  } finally {
    _veAracBusy = false;
  }

  // Otomatik yüklenen/kurulan alt-topoloji ızgaranın kenarına yapışmasın:
  // görünümü içeriğe ortala + sığdır (node koordinatları değişmez). Sessiz
  // (köke-çökme) re-entry'de kullanıcının bulunduğu konum korunur.
  if(!_silent && typeof veFitViewToContent === 'function') veFitViewToContent();

  if(!_silent && typeof veAnimateCanvasTransition === 'function') veAnimateCanvasTransition('enter');
  veAracUpdateBreadcrumb();
  if(typeof veSyncSidebarScope === 'function') veSyncSidebarScope();
  // Topoloji kapsamı değişti → uyarı paneli tazelensin. Aksi hâlde panel
  // ana topolojinin (ya da statik yer tutucunun) durumunu göstermeye devam
  // eder ve alt topolojideki gerçek eksikleri saklar.
  if(typeof veUpdateWarnings === 'function') veUpdateWarnings();
  if(!_silent && typeof showToast === 'function') showToast('Araç Performans — Alt Topoloji', 'info');
}

// _silent: köke çökerken (veAracCollapseToRoot → kaydet/sekme değiştir öncesi) true
// gelir; kullanıcıya görünmeyen bu toplu çıkışta geçiş animasyonu tetiklenmez.
function veAracCloseEditor(_silent){
  if(_veAracBusy) return;
  if(!veAracStack.length) return;

  _veAracBusy = true;
  try {
    if(typeof veFlushOpenPanelData === 'function') veFlushOpenPanelData();
    var subState = veSerializeCurrentState();
    // Gömmeden ÖNCE hafiflet: undo/redo geçmişini at, sonuçları seyrelt, iç içe
    // alt-topolojileri özyinelemeli temizle → çarpımsal büyüme (RangeError: Invalid
    // string length) ve otomatik-yedek kota taşması önlenir.
    if(typeof veSanitizeEmbeddedState === 'function') subState = veSanitizeEmbeddedState(subState);
    var ctx = veAracStack.pop();

    // Alt-topolojiyi ebeveyn state'indeki ilgili düğümün data'sına yaz
    var pn = (ctx.parentState.nodes || []).find(function(n){ return n.id === ctx.nodeId; });
    if(pn){ if(!pn.data) pn.data = {}; pn.data.subTopology = subState; }

    veClearCanvasDOM();
    veLoadTabState({ state: ctx.parentState });
  } finally {
    _veAracBusy = false;
  }

  if(!_silent && typeof veAnimateCanvasTransition === 'function') veAnimateCanvasTransition('exit');
  veAracUpdateBreadcrumb();
  if(typeof veSyncSidebarScope === 'function') veSyncSidebarScope();
  // Topoloji kapsamı değişti → uyarı paneli tazelensin. Aksi hâlde panel
  // ana topolojinin (ya da statik yer tutucunun) durumunu göstermeye devam
  // eder ve alt topolojideki gerçek eksikleri saklar.
  if(typeof veUpdateWarnings === 'function') veUpdateWarnings();

  // Ana topolojiye dönünce ilgili düğümü seç
  var back = veAracStack.length === 0;
  if(!_silent && back && typeof nodes !== 'undefined'){
    // en son çıkılan düğüm id'si artık stack'te yok; sadece bilgi ver
    if(typeof showToast === 'function') showToast('Ana topolojiye dönüldü', 'info');
  }
}

// İç içe her seviyeden köke (ana topoloji) kadar çıkar. Kaydet/sekme-değiştir
// öncesi çağrılır (veSaveActiveTabState kancası) → doğru kök durum serileşir.
function veAracCollapseToRoot(){
  var guard = 0;
  while(veAracStack.length && guard++ < 32){ veAracCloseEditor(true); }
}

// Alt-topoloji içindeyken canvas alanının ALT-ORTASINA (diyagramın altına)
// iliştirilen çıkış çipi — "← Ana topolojiye dön" + kapsam etiketi.
function veAracUpdateBreadcrumb(){
  if(typeof document === 'undefined') return;
  var el = document.getElementById('ve-arac-breadcrumb');
  if(veAracStack.length === 0){ if(el) el.remove(); return; }
  if(!el){
    el = document.createElement('div');
    el.id = 've-arac-breadcrumb';
    el.className = 've-arac-breadcrumb';
    // Canvas alanının alt-ortasına iliştir. #ve-split-container position:relative
    // ve geçiş animasyonunun transform'u alt-seviye .ve-canvas-wrapper'a uygulandığı
    // için çip konumunu şaşırmaz → pan/zoom'dan bağımsız, kanvasa sabit kalır.
    var host = document.getElementById('ve-split-container')
            || document.querySelector('.ve-canvas-area')
            || document.body;
    host.appendChild(el);
  }
  var depth = veAracStack.length;
  el.innerHTML =
    '<button onclick="veAracCloseEditor()" title="Ana (üst) topolojiye dön">← Ana topolojiye dön</button>'
    + '<span class="ve-arac-breadcrumb-label">Araç Performans · Alt Topoloji'
    + (depth > 1 ? ' <b>(derinlik ' + depth + ')</b>' : '') + '</span>';
}

// Jest/Node köprüsü (tarayıcıda no-op)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    VE_ARAC_PERFORMANS_LAYOUT: VE_ARAC_PERFORMANS_LAYOUT,
    VE_ARAC_PERFORMANS_LINKS: VE_ARAC_PERFORMANS_LINKS,
    veArrangeModuleBase: veArrangeModuleBase,
    veAracPopulateDrivetrain: veAracPopulateDrivetrain,
    getAracPerformansPropertiesHTML: getAracPerformansPropertiesHTML
  };
}
