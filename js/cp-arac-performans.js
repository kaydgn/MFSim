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
// İlk açılışta iç topolojiye YALNIZ "Başlangıç ve Örnekler" (ap-example) düğümü
// konur (veAracPopulateStarter) — Takoz modülüyle aynı kalıp. Zinciri kullanıcı
// ya oradaki hazır örneklerden aktarır ya da sidebar'dan kendisi kurar.
//
// Uygulama: ana canvas makinesi (topology.js) yeniden kullanılır — girişte ebeveyn
// durumu saklanır, canvas alt-topoloji ile değiştirilir; çıkışta alt-topoloji
// düğümün node.data.subTopology'sine yazılıp ebeveyn geri yüklenir. İç içeyken
// kaydet/sekme-değiştir olursa veSaveActiveTabState() kancası önce köke çöker.

// ─── REFERANS güç aktarma yerleşimi (yerel px) ───────────────────────────────
// Alt topoloji açılışında bu yerleşimin TAMAMI artık KURULMAZ; yalnız
// "Başlangıç ve Örnekler" (ap-example) bileşeni gelir — Takoz modülüyle aynı
// kalıp (bkz. veAracPopulateStarter / cp-mount.js veMntPopulateStarter).
// Yerleşim burada, "Örneği Aktar" sonrası ap-example düğümünün geri konduğu
// koordinat çerçevesi olarak kalır (bkz. cp-arac-example.js veApLoadExample).
//
// IZGARA — sayılar keyfî değil, PORT GEOMETRİSİNDEN türetildi
// ────────────────────────────────────────────────────────────
// Bir portun düğüm üstündeki y'si `vePortOffset` ile sabittir: sağ kenarda K
// port varsa r'inci port `h·(r+1)/(K+1)`'de durur (js/components.js). Yerleşim
// bunu SAYMAZSA bağlantı çizgisi eğik çıkar; eskiden tam olarak bu oluyordu.
//
//   • ŞAFT EKSENİ (ly 150 + 30 = 180): 65×60 kutuların tek portu %50'de, yani
//     ly+30'da. Zincirin tamamı (motor→konvertör→şanzıman→propşaft→transfer)
//     bu eksende → aradaki dört bağlantı TAM YATAY çizilir.
//   • MOTOR ly 142: motor 66×76 ve çıkışı %50'de (ly+38) — 142+38 = 180, yani
//     şaft ekseninin ta kendisi. Eskiden 190'daydı, çıkışı 8 px aşağıdaydı ve
//     motor→konvertör teli hafif eğikti.
//   • FAN SİMETRİSİ: transfer çıkışları eksenin ±10 px'inde (h·1/3, h·2/3).
//     Diferansiyel girişleri eksenden ±100 px (ly 50/250 + 30 = 80/280,
//     eksen 180) → iki dal EŞİT ve ZIT saparak dik açıyla iner/çıkar.
//     Aynısı diferansiyel→tekerlekte: çıkışlar ±10, tekerlek girişleri ±50.
//     Eskiden alt dal 110, üst dal 80 px sapıyordu — fan gözle eğikti.
//   • TEKERLEK ADIMI 100 px (60 kutu + 40 açıklık): tekerlek ADI kutunun
//     altında çiziliyor, 6×6'daki eski 80 px adımda ad bir alttaki kutuya
//     değiyordu. İki biçim de aynı adımı kullanır → örnekler birbirine uyar.
//   • SÜTUN ADIMI: zincirde 130 px (65 kutu + 65 açıklık), DALLARDA 200 px.
//     Dik açılı (stepped) bağlantı dikey bacağını iki sütunun ORTASINDAN
//     geçirir; 130 px'te o kanal düğüm ADININ İÇİNE düşüyordu. Adlar kutuda
//     ORTALI ve kutudan geniş — gerçek tarayıcıda ölçüldü: en geniş
//     6.77 px/karakter, "Transfer Kutusu (2 kademe)" 144.2 px,
//     "Goodyear G275 MSA 335/80R20" 170.8 px. 135 px açıklık iki kanalı da
//     (x=3212.5 ve 3412.5) adların dışına çıkarır.
//   • SOL ÜST KÖŞE BOŞ: "Örneği Aktar" sonrası yükleyici "Başlangıç ve
//     Örnekler" düğümünü yerleşim-yereli (30, −40)'a geri koyuyor
//     (cp-arac-example.js). Çözücü orada dururken yeni düğümün ADI Çözücü
//     kutusunun üstüne biniyordu — Çözücü bu yüzden ALT sırada.
//
// Örnek topolojileri (assets/examples/ap_*_topoloji.json) bu ızgaradan
// üretilir; tests/unit/arac-example-layout.test.js ikisini birbirine bağlar.
var VE_ARAC_PERFORMANS_LAYOUT = [
  // Şaft ekseni (ly 150 → port 180); motor 76 px yüksek, ly 142 → çıkış 180
  { type:'engine',                  lx:0,   ly:142, w:66, h:76 },
  { type:'torque-converter',        lx:130, ly:150 },
  { type:'gearbox',                 lx:260, ly:150 },
  { type:'propshaft',               lx:390, ly:150 },
  { type:'transfer',                lx:520, ly:150 },
  // Fan — dal sütunları 180 px (etiket kanalı), tekerlek adımı 100,
  // diferansiyel beslediği ÇİFTİN tam ortasında
  { type:'differential',            lx:720, ly:50  },
  { type:'differential',            lx:720, ly:250 },
  { type:'wheel',                   lx:920, ly:0   },
  { type:'wheel',                   lx:920, ly:100 },
  { type:'wheel',                   lx:920, ly:200 },
  { type:'wheel',                   lx:920, ly:300 },
  // ARAÇLAR. İki eşleştirme aracı da motorun AYNI çıkış portundan besleniyor
  // ve ikisi de KONVERTÖR SÜTUNUNDA durmak zorunda: dik açılı telin İLK ayağı
  // kaynak portun y'sinde, yani şaft ekseninde yatay ilerliyor; hedef daha
  // sağda olsa o ayak Konvertör kutusunun içinden geçerdi (ölçüldü: Propşaft
  // sütununda mid=2788, ilk ayak y=2980 · x 2626→2788, TC kutusu 2690–2755).
  // Alt alta duruyorlar ve ADLARI SAĞDA (node.data.labelPos 'right'): ad
  // ortada olsaydı ~180 px genişliğiyle alttakine inen dikey bacağı (x=2658)
  // yutardı. Kurulum düğümleri o ad şeritlerinin sağında.
  { type:'ec-matching',             lx:130, ly:300 },
  { type:'engine-gearbox-matching', lx:130, ly:400 },
  { type:'solver',                  lx:390, ly:300, w:90, h:55 },
  { type:'vehicle',                 lx:520, ly:300 },
  { type:'shift-controller',        lx:390, ly:400 }
];

// Topolojiyi görünür alanın merkezine ortalayacak taban koordinatı hesapla.
// (drop handler ile aynı dönüşüm: ekran → canvas koordinatı; bkz. ui-core.js drop)
// layout ögeleri {lx, ly} — ölçü VERİLEBİLİR: {lx, ly, w, h}. Verilmezse
// sıradan bileşen ölçüsü (65×60) varsayılır.
//
// ÖLÇÜ NEDEN GEREKLİ: FEAD'in "Kayış Yolu" düğümü kanvasta 440×500'lük canlı bir
// şema kartı. Herkese 65×60 sayılırsa grubun genişliği eksik hesaplanır ve
// ortalama kayar — kart görünür alanın sağından taşıyor (ölçüldü). Diğer
// çağıranlar ölçü vermediği için davranışları DEĞİŞMEZ.
function veArrangeModuleBase(layout) {
  var CANVAS_OFFSET = 3000, NODE_W = 65, NODE_H = 60;
  var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  layout.forEach(function(it) {
    var w = (it && isFinite(it.w) && it.w > 0) ? it.w : NODE_W;
    var h = (it && isFinite(it.h) && it.h > 0) ? it.h : NODE_H;
    minX = Math.min(minX, it.lx);
    minY = Math.min(minY, it.ly);
    maxX = Math.max(maxX, it.lx + w);
    maxY = Math.max(maxY, it.ly + h);
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

// İlk açılışta iç topolojiye YALNIZ "Başlangıç ve Örnekler" (ap-example) gelir.
// Kullanıcı örneği bu bileşenin panelinden aktarır, ya da sıfırdan kurmak için
// sidebar'dan bileşen sürükler. (Eskiden burada 16 düğüm + 11 bağlantılık hazır
// güç aktarma zinciri kuruluyordu: kullanıcı hiçbir şey seçmeden karşısında
// kendi kurmadığı bir topoloji buluyordu. Takoz modülü zaten bu kalıptaydı.)
//
// Bileşen görünür alanın MERKEZİNE konur; veAracOpenEditor ardından
// veFitViewToContent çağırdığı için kamera da tam ona oturur.
function veAracPopulateStarter() {
  if(typeof createNode !== 'function') return [];
  var base = veArrangeModuleBase([{ lx: 0, ly: 0 }]);
  var created = [];
  var before = (typeof nodes !== 'undefined') ? nodes.length : 0;
  createNode('ap-example', base.x, base.y);
  if(typeof nodes !== 'undefined' && nodes.length > before) created.push(nodes[nodes.length - 1]);
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
  html += '<table style="width:100%; font-size:var(--fs-body); border-collapse:collapse; border:1px solid var(--border-color); margin-bottom:10px;">';
  if(initialized){
    html += '<tr><td style="padding:5px 8px; border:1px solid var(--border-color); color:var(--text-secondary);">Bileşen</td><td style="padding:5px 8px; border:1px solid var(--border-color); color:var(--text-primary); font-weight:600;">' + nCount + '</td></tr>';
    html += '<tr><td style="padding:5px 8px; border:1px solid var(--border-color); color:var(--text-secondary);">Bağlantı</td><td style="padding:5px 8px; border:1px solid var(--border-color); color:var(--text-primary); font-weight:600;">' + cCount + '</td></tr>';
  } else {
    html += '<tr><td style="padding:7px 8px; border:1px solid var(--border-color); color:var(--text-muted);">Alt topoloji henüz açılmadı</td></tr>';
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
      veAracPopulateStarter();
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

// Alt-topoloji içindeyken TOPOLOJİ SINIR ÇERÇEVESİNİN ALT KENARINA tutunan
// çıkış çipi — "← Ana topolojiye dön" + kapsam etiketi. Konumu
// veAnchorBoundaryChip (js/canvas-space.js) hesaplar; pan/zoom'da çerçeveyle
// birlikte gider.
function veAracUpdateBreadcrumb(){
  if(typeof document === 'undefined') return;
  var el = document.getElementById('ve-arac-breadcrumb');
  if(veAracStack.length === 0){ if(el) el.remove(); return; }
  if(!el){
    el = document.createElement('div');
    el.id = 've-arac-breadcrumb';
    el.className = 've-arac-breadcrumb';
    // Görünümün (#ve-canvas-wrapper) İÇİNE, transform'lu #ve-canvas'ın DIŞINA
    // konur — minimap ile aynı katman. Böylece konumu kamera koordinatından
    // hesaplanabilir ama ölçüsü zoom'la büyüyüp küçülmez. Bölünmüş görünümde
    // wrapper hangi bölmeye taşınırsa çip de onunla gider.
    var host = document.getElementById('ve-canvas-wrapper')
            || document.getElementById('ve-split-container')
            || document.querySelector('.ve-canvas-area')
            || document.body;
    host.appendChild(el);
  }
  var depth = veAracStack.length;
  el.innerHTML =
    '<button onclick="veAracCloseEditor()" title="Ana (üst) topolojiye dön">← Ana topolojiye dön</button>'
    + '<span class="ve-arac-breadcrumb-label">Araç Performans · Alt Topoloji'
    + (depth > 1 ? ' <b>(derinlik ' + depth + ')</b>' : '') + '</span>';
  // Etiket (ve dolayısıyla genişlik) değişti → yeri hemen tazelensin.
  if(typeof veAnchorBoundaryChip === 'function') veAnchorBoundaryChip();
}

// Jest/Node köprüsü (tarayıcıda no-op)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    VE_ARAC_PERFORMANS_LAYOUT: VE_ARAC_PERFORMANS_LAYOUT,
    veArrangeModuleBase: veArrangeModuleBase,
    veAracPopulateStarter: veAracPopulateStarter,
    getAracPerformansPropertiesHTML: getAracPerformansPropertiesHTML
  };
}
