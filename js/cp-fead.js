// ============================================================================
//  FEAD — MOTOR ÖN UÇ KAYIŞ-KASNAK SİSTEMİ (Front End Accessory Drive)
// ============================================================================
// MFSim'in ÜÇÜNCÜ ana modülü (Araç Performans ve Takoz Çökme-Titreşim'in
// yanında). Bu dosya modülün SUNUM katmanıdır: alt-sistem düğümü, iç topoloji
// gezinmesi, paneller, kanvas rozeti ve şema çizimi.
//
// ÜÇ KATMAN — hangisinin nerede olduğu önemli:
//   js/fead-core.js   HESAP ÇEKİRDEĞİ. Dışarıdan geldi, 17 Gates raporundan
//                     2095 değerle doğrulanmış, BİREBİR duruyor. Dokunulmaz.
//   js/fead-model.js  KÖPRÜ. Kanvastaki düğüm+bağlantıyı çekirdeğin istediği
//                     sisteme çevirir; temas tarafı / sürücü / çap çözümü,
//                     hata çevirisi. DOM'suz, testlenebilir.
//   js/cp-fead.js     BU DOSYA. Yalnız HTML kurar ve çekirdeği model üzerinden
//                     çağırır. Kendi geometrisini HESAPLAMAZ.
//
// MİMARİ — arac-performans / mount-analysis ile BİREBİR aynı nested kalıp:
// ana canvas'ta tek kart; çift tıkla iç topolojiye girilir; çıkışta iç
// topoloji node.data.subTopology'ye yazılır. Kaydet/sekme-değiştir öncesi
// veSaveActiveTabState → veFeadCollapseToRoot ile köke çöker.
//
// BAĞLANTININ ANLAMI BU MODÜLDE FARKLIDIR — kayış yoludur:
//   • Araç Performans'ta bağlantı GÜÇ AKIŞI, Takoz'da SALT GÖRSEL'di.
//   • FEAD'de bağlantı, serpantin kayışın kasnaktan kasnağa geçiş SIRASIDIR.
//     Sürücünün çıkışından başlar, kasnakları dolaşır, girişine döner →
//     KAPALI ÇEVRİM. Bu yüzden her kasnak 1 giriş + 1 çıkış taşır.
//   • SÜRÜCÜLÜK BİR ROLDÜR, TİP DEĞİL (node.data.driver) — ikincil tahrikte
//     fan kasnağı da sürücü olabilir; bkz. js/fead-model.js.
//   • Sarım açısı ve kayış boyu bu SIRA + konumlar + TEMAS TARAFLARINDAN
//     çekirdek tarafından türetilir; kullanıcı elle girmez.
//
// Birim (UI): konum ve çap mm, atalet kg·m², tork Nm, gerginlik N.
// Kalıcılık: her düğüm kendi node.data'sında (proje kaydet/yükle otomatik).
// ----------------------------------------------------------------------------

// ─── Sunum yardımcıları ──────────────────────────────────────────────────────
// SAF veri/geometri yardımcıları BU DOSYADA DEĞİL: _feadNum, _feadDefOf,
// _feadNodeName, _feadIsPulley, veFeadContactOf, veFeadOD, veFeadRouteOrder,
// veFeadBuildSystem… hepsi js/fead-model.js içinde ve o dosya index.html'de
// BUNDAN ÖNCE yükleniyor. Ayrım kasıtlı: model katmanı DOM'suz ve testlenebilir,
// bu dosya yalnız HTML kuruyor. (Aynı adı iki dosyada bildirmek üst-seviye
// çakışması olurdu; tests/unit/source-hygiene.test.js buna kapı tutuyor.)
function _feadEsc(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function _feadFmt(x, dg){ if(!Number.isFinite(x)) return '—'; dg=(dg===undefined)?1:dg; return x.toFixed(dg); }

// ── EMEKLİYE AYRILDI: veFeadBeltPath ────────────────────────────────────────
// Bu dosyada kayış çevresini kendi hesaplayan bir fonksiyon vardı ve YANLIŞTI:
// bütün kasnakları DIŞ TEĞET sayıyordu. Oysa sırttan temas eden kasnak (avara,
// gergi) kayışı TERS yönde sarar. AG00686 üzerinde ölçülen fark:
//   CRK 207.7° (doğru) ↔ 172.2° (o çizim)  → −35.5°
//   A_C 201.3°         ↔ 164.4°            → −36.9°
// Ürettiği çevrim kendi içinde tutarlı olduğu için (Σ = 360) gözle
// YAKALANAMIYORDU. Artık geometri FEADCore.solveGeometry'den geliyor: işaretli
// yarıçap (contact tarafına göre), teğet noktaları, sarım yayları ve sarım
// değişmezi kontrolü. Şemayı çizen kod veFeadLayoutSVG içinde.

// ════════════════════════════════════════════════════════════════════════════
//  ANA MODÜL — ALT-SİSTEM (SUBSYSTEM) DÜĞÜMÜ
// ════════════════════════════════════════════════════════════════════════════
var veFeadStack = [];
var _veFeadBusy = false;

// Modül paneli (tek tık): özet + "Alt Topolojiyi Aç".
function getFeadModulePropertiesHTML(node){
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
  html += '<button onclick="veFeadOpenEditor(\'' + node.id + '\')" style="width:100%; padding:14px 16px; font-size:var(--fs-lg); font-weight:700; background:var(--accent-primary); color:#fff; border:none; cursor:pointer; letter-spacing:0.03em;" onmouseover="this.style.filter=\'brightness(1.15)\'" onmouseout="this.style.filter=\'none\'">▶ Alt Topolojiyi Aç</button>';
  html += '</div>';
  return html;
}

// REFERANS yerleşim (yerel px). İlk açılışta bu yerleşimin TAMAMI kurulmaz —
// diğer iki modülle aynı kalıp: yalnız "Başlangıç ve Örnekler" gelir. Koordinat
// çerçevesi burada durur ki örnek aktarımı görünür alana ortalanabilsin.
var VE_FEAD_STARTER_LAYOUT = [
  // ── Üst şerit: araçlar ──
  { type:'fead-belt',    lx:40,  ly:20 },
  { type:'fead-layout',  lx:190, ly:20 },
  { type:'fead-solver',  lx:340, ly:20 },
  { type:'fead-example', lx:490, ly:20 },
  { type:'fead-report',  lx:640, ly:20 },
  // ── Kayış düzlemi: krank altta ortada, aksesuarlar çevresinde ──
  { type:'fead-crank',       name:'Krank Kasnağı', lx:250, ly:330 },
  { type:'fead-tensioner',   name:'Gergi',         lx:140, ly:210 },
  { type:'fead-alternator',  name:'Alternatör',    lx:400, ly:170 },
  { type:'fead-ac',          name:'Klima Komp.',   lx:540, ly:270 },
  { type:'fead-waterpump',   name:'Su Pompası',    lx:410, ly:380 },
  { type:'fead-idler',       name:'Avara Kasnak',  lx:290, ly:200 }
];

// ── "OTOMATİK DÜZENLE" FEAD'DE HALKA KURAR ─────────────────────────────────
// Genel yerleştirici (tidy-layout.js) katmanlı bir DAG düzeni kuruyor: kenarları
// soldan sağa sıralı katmanlara böler. FEAD ise bir ÇEVRİM — serpantin kayış
// son kasnaktan krank girişine dönüyor. Katmanlama o çevrimi keyfî bir yerden
// kırıyor ve dönüş telini bütün kümenin üstünden geçiriyor.
//
// ÖLÇÜLDÜ (gerçek tarayıcı, BMC örneği, 6 kasnak): örnek kurulduğunda kesişen
// tel çifti 0; "Otomatik Düzenle" sonrası altı kasnak tek bir YATAY sıraya
// diziliyor ve Sürücü Kasnak → Avara 1 dönüş teli hepsinin üstünden geri
// geçerek 1 kesişim üretiyor — kullanıcının gördüğü "sağlıklı bir bağlantı
// kurulamıyor" tablosu.
//
// Halka düzeninde kesişim YAPISAL OLARAK sıfırdır: kasnaklar kayış sırasında
// çember üzerine dizilince her tel yalnız KOMŞUSUNA gidiyor. Kutular, semboller
// ve ölçüler değişmiyor — yalnız konum. mm koordinatı KULLANILMIYOR: o, kanvastaki
// Kayış Yolu kartının işi (bkz. CLAUDE.md "graf GİRDİ, kart ÇIKTI").
// ── "OTOMATİK DÜZENLE" — KOORDİNATLARA GÖRE YERLEŞTİR ─────────────────────
//
// Bu fonksiyon eskiden kasnakları bir HALKAYA diziyordu ve o zaman doğruydu:
// kanvastaki konum hiçbir şey ifade etmiyordu, dolayısıyla tel kesişimini
// sıfırlayan bir düzen en iyisiydi.
//
// Artık konum FİZİKSEL. Halkaya dizmek, kullanıcının girdiği bütün mm
// koordinatlarını SİLMEK demek olurdu — düğme "düzenle" derken modeli bozardı.
// Yeni anlamı: kanvas konumlarını mm'den YENİDEN KUR. Elle kaydırılmış bir
// düğümü (ya da bir çakışmayı) toparlamak için gerçek bir ihtiyaç, ve tersine
// çevrilebilir: koordinatlar değişmiyor, yalnız kutular yerine oturuyor.
//
// opts.silent: örnek kurucusu (veFeadLoadExample) buradan geçerken kendi
// saveState'ini, kendi toast'ını ve kendi kamerasını kullanır; ikinci bir
// undo adımı ve üst üste binen iki bildirim istenmiyor.
function veFeadArrangeByCoords(opts){
  opts = opts || {};
  if(typeof nodes === 'undefined' || !nodes) return false;
  var kasnaklar = nodes.filter(function(n){ return _feadIsPulley(n); });
  if(kasnaklar.length < 2) return false;
  var org = (typeof veFeadOriginNode === 'function') ? veFeadOriginNode(nodes) : null;
  if(!org) return false;

  var s = (typeof VE_FEAD_PX_PER_MM === 'number') ? VE_FEAD_PX_PER_MM : 1;
  var CX = 3000, CY = 3000;

  // Koordinatı olan kasnakların mm sınır kutusu — küme görünür alanda
  // ORTALANSIN diye. Orijini doğrudan (CX,CY)'ye koymak, krank kümenin
  // kenarındaysa (BMC'de öyle: X −281…+184) her şeyi bir yana yığardı.
  var mm = [], eksik = [];
  kasnaklar.forEach(function(n){
    var d = n.data || {};
    var x = _feadNum(d.x, NaN), y = _feadNum(d.y, NaN);
    if(_feadDefOf(n).isFeadTensioner){ x = _feadNum(d.cenX, NaN); y = _feadNum(d.cenY, NaN); }
    if(Number.isFinite(x) && Number.isFinite(y)) mm.push({ n: n, x: x, y: y });
    else eksik.push(n);
  });
  if(mm.length < 2) return false;
  var minX = Math.min.apply(null, mm.map(function(o){ return o.x; }));
  var maxX = Math.max.apply(null, mm.map(function(o){ return o.x; }));
  var minY = Math.min.apply(null, mm.map(function(o){ return o.y; }));
  var maxY = Math.max.apply(null, mm.map(function(o){ return o.y; }));
  var ortX = (minX + maxX) / 2, ortY = (minY + maxY) / 2;

  var yer = {};
  mm.forEach(function(o){
    var b = veFeadNodeBox(o.n);
    yer[o.n.id] = { x: CX + (o.x - ortX) * s - b.w / 2,
                    y: CY - (o.y - ortY) * s - b.h / 2 };   // Y TERS
  });

  // KOORDİNATI OLMAYAN KASNAK GİZLENMİYOR: kümenin altına bir sıraya diziliyor
  // ki kullanıcı onu görüp koordinatını girsin. Sessizce (0,0)'a koymak, iki
  // kasnağı üst üste bindirip "kasnaklar çakışıyor" hatası üretirdi.
  var altY = CY + (maxY - ortY) * s + 120;
  eksik.forEach(function(n, i){
    var b = veFeadNodeBox(n);
    yer[n.id] = { x: CX - ((eksik.length - 1) * 100) / 2 + i * 100 - b.w / 2, y: altY };
  });

  // Araç düğümleri kümenin DIŞINDA. Kayış Yolu kartı (420×340) sağ şeritte,
  // künyeler sol şeritte — veFeadLoadExample ile aynı bölüşüm, yoksa kart
  // kümenin içine düşüp tellerin altında kalırdı.
  var yariX = (maxX - minX) * s / 2, yariY = (maxY - minY) * s / 2;
  var sol = [], sag = [];
  nodes.forEach(function(n){
    if(yer[n.id]) return;
    if(_feadDefOf(n).isFeadLayout) sag.push(n); else sol.push(n);
  });
  function serit(list, x0, hiza){
    var toplam = 0;
    list.forEach(function(n){ toplam += veFeadNodeBox(n).h + 24; });
    var y = CY - toplam / 2;
    list.forEach(function(n){
      var b = veFeadNodeBox(n);
      yer[n.id] = { x: (hiza === 'sag') ? x0 : (x0 - b.w), y: y };
      y += b.h + 24;
    });
  }
  serit(sol, CX - yariX - 150, 'sol');
  serit(sag, CX + yariX + 150, 'sag');

  if(!opts.silent && typeof saveState === 'function') saveState();
  nodes.forEach(function(n){
    var p = yer[n.id];
    if(!p) return;
    // TAM SAYIYA YUVARLANMIYOR: 1 px = 1 mm olduğu için tam sayı yuvarlaması
    // koordinatı 1 mm'ye kuantalar (veFeadSyncCanvasFromMm'deki ölçümün
    // aynısı — alternatörün 1 mm'si gerginliği %5.9 değiştiriyor).
    n.x = Math.round(p.x * 100) / 100; n.y = Math.round(p.y * 100) / 100;
    var el = (typeof document !== 'undefined') ? document.getElementById(n.id) : null;
    if(el){ el.style.left = n.x + 'px'; el.style.top = n.y + 'px'; }
  });
  if(typeof updateAllConnections === 'function') updateAllConnections();
  if(typeof veFeadRefreshBadges === 'function') { try { veFeadRefreshBadges(); } catch(e){} }

  var canvas = (typeof document !== 'undefined') ? document.getElementById('ve-canvas') : null;
  if(!opts.silent && canvas && typeof veFitViewToContent === 'function'){
    canvas.classList.add('tidy-cam');
    veFitViewToContent({ maxZoom: opts.maxZoom || 1.2 });
    setTimeout(function(){ if(canvas) canvas.classList.remove('tidy-cam'); }, 520);
  }
  if(!opts.silent && typeof showToast === 'function')
    showToast('Kasnaklar koordinatlarına yerleştirildi (1 px = 1 mm)'
      + (eksik.length ? ' · ' + eksik.length + ' kasnağın koordinatı yok' : ''),
      eksik.length ? 'warning' : 'success');
  return true;
}

// İlk açılışta iç topolojiye YALNIZ "Başlangıç ve Örnekler" (fead-example)
// gelir; kullanıcı ya oradaki hazır örneği aktarır ya da sidebar'dan kendi
// kayış düzenini kurar.
function veFeadPopulateStarter(){
  if(typeof createNode !== 'function') return [];
  var base = (typeof veArrangeModuleBase === 'function')
    ? veArrangeModuleBase(VE_FEAD_STARTER_LAYOUT.map(function(it){ return { lx:it.lx, ly:it.ly }; }))
    : { x:3000, y:3000 };
  var slot = null;
  for(var i=0;i<VE_FEAD_STARTER_LAYOUT.length;i++){
    if(VE_FEAD_STARTER_LAYOUT[i].type === 'fead-example'){ slot = VE_FEAD_STARTER_LAYOUT[i]; break; }
  }
  if(!slot) slot = { lx:490, ly:20 };
  var created = [];
  var before = (typeof nodes !== 'undefined') ? nodes.length : 0;
  createNode('fead-example', base.x + slot.lx, base.y + slot.ly);
  if(typeof nodes !== 'undefined' && nodes.length > before) created.push(nodes[nodes.length-1]);
  if(typeof updateAllConnections === 'function') updateAllConnections();
  return created;
}

// _silent: autosave gibi arka-plan işlemleri köke çöküp (veSaveActiveTabState)
// kullanıcıyı bulunduğu iç topolojiye geri getirirken true geçer; bu görünmez
// geri-girişte toast/animasyon tetiklenmez (breadcrumb ve sidebar yine güncellenir).
function veFeadOpenEditor(nodeId, _silent){
  if(_veFeadBusy) return;
  if(typeof nodes === 'undefined' || typeof veSerializeCurrentState !== 'function') return;
  var node = nodes.find(function(n){ return n.id === nodeId; });
  if(!node || node.type !== 'fead-analysis') return;

  _veFeadBusy = true;
  try {
    if(typeof veFlushOpenPanelData === 'function') veFlushOpenPanelData();
    if(typeof veTogglePropertiesPanel === 'function') veTogglePropertiesPanel(false);

    var parentState = veSerializeCurrentState();
    veFeadStack.push({ nodeId: nodeId, parentState: parentState });
    veClearCanvasDOM();

    var sub = node.data && node.data.subTopology;
    if(sub && sub.nodes && sub.nodes.length){
      veLoadTabState({ state: sub });
    } else {
      veLoadTabState({ state: null });
      veFeadPopulateStarter();
    }
  } finally { _veFeadBusy = false; }

  // Eski kayıt göçü (data.dia → data.od) ve temas/sürücü rozetleri, alt
  // topoloji YÜKLENDİKTEN sonra: düğümler artık canlı ve DOM'da.
  if(typeof veFeadMigrateAll === 'function' && typeof nodes !== 'undefined') veFeadMigrateAll(nodes);
  // ORİJİN GÖÇÜ + KUTULARI KOORDİNATA OTURTMA. Konum artık fiziksel; eski
  // projelerde krank (0,0)'da olmayabilir ve kutular keyfî yerlerde durur.
  // Göç TANIM GEREĞİ bir öteleme (geometriye etkisi ölçüldü: 0.00e+0), yani
  // sessizce yapılabilir. Yerleştirme de kutuyu koordinatının söylediği yere
  // koyuyor — yoksa kanvas ile mm ilk açılıştan itibaren ayrışırdı.
  if(typeof veFeadNormalizeOrigin === 'function' && typeof nodes !== 'undefined'){
    try {
      veFeadNormalizeOrigin(nodes);
      veFeadPlaceFromCoords();
    } catch(e){ /* yarım model açılışı engellemez */ }
  }
  veFeadRefreshBadges();

  if(!_silent && typeof veFitViewToContent === 'function') veFitViewToContent();
  if(!_silent && typeof veAnimateCanvasTransition === 'function') veAnimateCanvasTransition('enter');
  veFeadUpdateBreadcrumb();
  if(typeof veSyncSidebarScope === 'function') veSyncSidebarScope();
  if(typeof veUpdateWarnings === 'function') veUpdateWarnings();
  if(!_silent && typeof showToast === 'function') showToast('FEAD — İç Topoloji', 'info');
}

// _silent: köke çökerken (veFeadCollapseToRoot → kaydet/sekme değiştir öncesi)
// true gelir; kullanıcıya görünmeyen bu toplu çıkışta animasyon tetiklenmez.
function veFeadCloseEditor(_silent){
  if(_veFeadBusy) return;
  if(!veFeadStack.length) return;

  _veFeadBusy = true;
  try {
    if(typeof veFlushOpenPanelData === 'function') veFlushOpenPanelData();
    var subState = veSerializeCurrentState();
    // Gömmeden ÖNCE hafiflet (bkz. topology.js veSanitizeEmbeddedState).
    if(typeof veSanitizeEmbeddedState === 'function') subState = veSanitizeEmbeddedState(subState);
    var ctx = veFeadStack.pop();
    var pn = (ctx.parentState.nodes || []).find(function(n){ return n.id === ctx.nodeId; });
    if(pn){ if(!pn.data) pn.data = {}; pn.data.subTopology = subState; }
    veClearCanvasDOM();
    veLoadTabState({ state: ctx.parentState });
  } finally { _veFeadBusy = false; }

  if(!_silent && typeof veAnimateCanvasTransition === 'function') veAnimateCanvasTransition('exit');
  veFeadUpdateBreadcrumb();
  if(typeof veSyncSidebarScope === 'function') veSyncSidebarScope();
  if(typeof veUpdateWarnings === 'function') veUpdateWarnings();
  if(!_silent && typeof showToast === 'function') showToast('Ana topolojiye dönüldü', 'info');
}

function veFeadCollapseToRoot(){
  var guard = 0;
  while(veFeadStack.length && guard++ < 32){ veFeadCloseEditor(true); }
}

// Alt-topoloji çıkış çipi — topoloji sınır çerçevesinin alt kenarına tutunur
// (cp-arac-performans.js veAracUpdateBreadcrumb ile aynı CSS sınıfı ve mantık).
function veFeadUpdateBreadcrumb(){
  if(typeof document === 'undefined') return;
  var el = document.getElementById('ve-fead-breadcrumb');
  if(veFeadStack.length === 0){ if(el) el.remove(); return; }
  if(!el){
    el = document.createElement('div');
    el.id = 've-fead-breadcrumb';
    el.className = 've-arac-breadcrumb';
    var host = document.getElementById('ve-canvas-wrapper')
            || document.getElementById('ve-split-container')
            || document.querySelector('.ve-canvas-area')
            || document.body;
    host.appendChild(el);
  }
  var depth = veFeadStack.length;
  el.innerHTML = '<button onclick="veFeadCloseEditor()" title="Ana (üst) topolojiye dön">← Ana topolojiye dön</button>'
    + '<span class="ve-arac-breadcrumb-label">FEAD · İç Topoloji'
    + (depth > 1 ? ' <b>(derinlik ' + depth + ')</b>' : '') + '</span>';
  if(typeof veAnchorBoundaryChip === 'function') veAnchorBoundaryChip();
}

// ════════════════════════════════════════════════════════════════════════════
//  PANEL YARDIMCILARI (Takoz modülüyle aynı görsel dil)
// ════════════════════════════════════════════════════════════════════════════
var _FEAD_INP = 'padding:4px 6px; font-size:var(--fs-body); height:25px; background:var(--bg-input); color:var(--text-primary); border:1px solid var(--border-color); border-radius:var(--radius-sm); text-align:right; box-sizing:border-box;';

function _feadCard(title, unit, accent, inner){
  var head = title ? '<div style="display:flex; align-items:center; gap:7px; margin-bottom:9px;">'
    + '<span style="width:3px; height:12px; border-radius:2px; background:' + (accent||'var(--accent-primary)') + ';"></span>'
    + '<span style="font-size:var(--fs-tiny); font-weight:700; color:var(--text-heading); letter-spacing:0.02em;">' + title + '</span>'
    + (unit ? '<span style="font-size:var(--fs-micro); font-weight:400; color:var(--text-muted);">' + unit + '</span>' : '')
    + '</div>' : '';
  return '<div style="background:var(--bg-secondary); border:1px solid var(--border-color); border-radius:var(--radius-md); padding:11px 12px 6px; margin-bottom:9px;">' + head + inner + '</div>';
}

// Sayısal hücre ızgarası (cells=[{key,label,ph,step}]).
function _feadGrid(node, cells, cols){
  cols = cols || 3;
  var h = '<div style="display:grid; grid-template-columns:repeat(' + cols + ',1fr); gap:7px 6px; margin-bottom:9px;">';
  cells.forEach(function(c){
    var v = (node.data && node.data[c.key] !== undefined && node.data[c.key] !== null) ? node.data[c.key] : '';
    h += '<label style="display:flex; flex-direction:column; gap:2px; min-width:0;">'
      + '<span style="font-size:var(--fs-micro); color:var(--text-muted); text-align:center; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">' + c.label + '</span>'
      + '<input type="number" id="ve-fead-' + c.key + '-' + node.id + '" value="' + _feadEsc(v) + '" step="' + (c.step||'any') + '"'
      + (c.ph ? ' placeholder="' + _feadEsc(c.ph) + '"' : '')
      + ' onchange="veFeadSet(\'' + node.id + '\',\'' + c.key + '\',this.value)" style="width:100%; ' + _FEAD_INP + '">'
      + '</label>';
  });
  return h + '</div>';
}

// Tek metin alanı (etiket sol, giriş sağ).
function _feadText(node, title, key, ph){
  var v = (node.data && node.data[key] != null) ? node.data[key] : '';
  return '<div style="display:flex; align-items:center; gap:10px; margin-bottom:9px;">'
    + '<div style="flex:1; font-size:var(--fs-body); font-weight:600; color:var(--text-secondary);">' + title + '</div>'
    + '<input type="text" id="ve-fead-' + key + '-' + node.id + '" value="' + _feadEsc(v) + '" placeholder="' + _feadEsc(ph||'') + '"'
    + ' onchange="veFeadSet(\'' + node.id + '\',\'' + key + '\',this.value)" style="width:130px; ' + _FEAD_INP + ' text-align:left;">'
    + '</div>';
}

function _feadHint(text){
  return '<div style="font-size:var(--fs-micro); color:var(--text-muted); line-height:1.4; margin:-3px 0 9px;">' + text + '</div>';
}

// "Bu bölüm SPEC ile gelecek" notu — kullanıcıya iskeletin nerede bittiğini
// SÖYLER. Sessizce boş bırakılan bir panel, çalışmayan bir panelden kötüdür.
function _feadPending(text){
  return '<div style="padding:8px 10px; margin-bottom:9px; font-size:var(--fs-micro); line-height:1.45; color:var(--text-secondary); background:var(--bg-secondary); border:1px dashed var(--accent-warning);">'
    + '<b style="color:var(--text-heading);">Hesap çekirdeği bekleniyor.</b> ' + text + '</div>';
}

// Açılır liste (seçenekler: [[değer, etiket], …]).
function _feadSelect(node, title, key, options, def, hint){
  var cur = (node.data && node.data[key] != null && node.data[key] !== '') ? String(node.data[key]) : String(def);
  var h = '<div style="display:flex; align-items:center; gap:10px; margin-bottom:9px;">'
    + '<div style="flex:1; font-size:var(--fs-body); font-weight:600; color:var(--text-secondary);">' + title + '</div>'
    + '<select id="ve-fead-' + key + '-' + node.id + '" onchange="veFeadSetChoice(\'' + node.id + '\',\'' + key + '\',this.value)"'
    + ' style="width:150px; ' + _FEAD_INP + ' text-align:left;">';
  options.forEach(function(o){
    h += '<option value="' + _feadEsc(o[0]) + '"' + (String(o[0]) === cur ? ' selected' : '') + '>' + _feadEsc(o[1]) + '</option>';
  });
  h += '</select></div>';
  return h + (hint ? _feadHint(hint) : '');
}

// Onay kutusu (bayrak).
function _feadToggle(node, title, key, handler, hint){
  var on = !!(node.data && node.data[key]);
  return '<label style="display:flex; align-items:center; gap:8px; margin-bottom:9px; cursor:pointer;">'
    + '<input type="checkbox"' + (on ? ' checked' : '')
    + ' onchange="' + handler + '(\'' + node.id + '\',this.checked)" style="width:15px; height:15px; accent-color:var(--accent-primary); cursor:pointer;">'
    + '<span style="font-size:var(--fs-body); font-weight:600; color:var(--text-secondary);">' + title + '</span>'
    + '</label>' + (hint ? _feadHint(hint) : '');
}

// KOORDİNAT ALANLARI KUTUYU DA TAŞIR. Panel ile kanvas artık AYNI ŞEYİ
// gösteriyor; panele 250 yazıp kutunun yerinde kalması, iki yüzeyin sessizce
// ayrışması olurdu (bu modülün tekrar eden kuralı: tek alan, tek kaynak).
var VE_FEAD_COORD_KEYS = ['x', 'y', 'pivotX', 'pivotY', 'cenX', 'cenY', 'armLen', 'od'];

function veFeadSet(nodeId, key, val){
  if(typeof nodes === 'undefined') return;
  var node = nodes.find(function(n){ return n.id === nodeId; });
  if(!node) return;
  if(!node.data) node.data = {};
  node.data[key] = val;
  if(VE_FEAD_COORD_KEYS.indexOf(key) >= 0 && _feadIsPulley(node)){
    veFeadPlaceFromCoords();
    veFeadRefreshDiaGhosts();            // çap değiştiyse hayalet de büyür
  }
  if(typeof saveState === 'function') saveState();
}

// Kutuları mm koordinatlarına oturt ve DOM'a yaz. Tek nokta: açılış, panel
// düzenlemesi ve "Otomatik Düzenle" hepsi buradan geçiyor.
function veFeadPlaceFromCoords(){
  if(typeof nodes === 'undefined' || !nodes) return 0;
  if(typeof veFeadSyncCanvasFromMm !== 'function') return 0;
  var k = veFeadSyncCanvasFromMm(nodes);
  if(!k) return 0;
  if(typeof document !== 'undefined'){
    nodes.forEach(function(n){
      var el = document.getElementById(n.id);
      if(el){ el.style.left = n.x + 'px'; el.style.top = n.y + 'px'; }
    });
  }
  if(typeof updateAllConnections === 'function') updateAllConnections();
  return k;
}

// ── KAYIŞ BAĞLANTISININ UCU: KOMŞUYA BAKAN KENAR ────────────────────────────
// Bir kasnağın portu klasik kuralla yerleşiyordu: giriş SOLDA, çıkış SAĞDA.
// Serpantin kayış bir ÇEVRİM olduğu için bu kural yolun yarısında ters düşüyor
// — kayış sağdan sola dönerken tel düğümün ÜSTÜNDEN geri geçmek zorunda
// kalıyor, iki tel birbirini kesiyor ve hangi sırayla gidildiği okunmuyor.
//
// Çözüm düğümü ya da yerleşimi DEĞİŞTİRMİYOR: yalnız telin çıktığı kenarı
// seçiyor. Kenar, komşunun yönünden okunur; seçim kutunun ORANINA göre
// yapılır (|dx|·h ≥ |dy|·w) — sabit 45° köşegeni kullanmak geniş kutularda
// yanlış kenarı seçerdi (72×66'lık krank ile 54×50'lik avarada fark ediyor).
//
// Bu bir VARSAYILAN (defaultPortSide): kullanıcı bir portu sağ tıkla taşıdıysa
// (node.data.portPositions) onun seçimi kazanmaya devam eder.
function veFeadPortSideFor(node, portType){
  if(typeof _feadIsPulley !== 'function' || !_feadIsPulley(node)) return null;
  if(typeof nodes === 'undefined' || typeof connections === 'undefined') return null;
  if(!node.id) return null;
  var isIn = String(portType || '').indexOf('input') === 0, komsuId = null;
  for(var i = 0; i < connections.length; i++){
    var c = connections[i];
    if(!c) continue;
    if(isIn  && c.to === node.id   && (c.toPort   || 'input')  === portType){ komsuId = c.from; break; }
    if(!isIn && c.from === node.id && (c.fromPort || 'output') === portType){ komsuId = c.to;   break; }
  }
  if(!komsuId) return null;
  var o = null;
  for(var j = 0; j < nodes.length; j++) if(nodes[j] && nodes[j].id === komsuId){ o = nodes[j]; break; }
  if(!o || !_feadIsPulley(o)) return null;
  var w = node.width || 65, h = node.height || 60;
  var dx = (o.x + (o.width || 65) / 2) - (node.x + w / 2);
  var dy = (o.y + (o.height || 60) / 2) - (node.y + h / 2);
  if(!isFinite(dx) || !isFinite(dy) || (dx === 0 && dy === 0)) return null;
  if(Math.abs(dx) * h >= Math.abs(dy) * w) return (dx >= 0) ? 'right' : 'left';
  return (dy >= 0) ? 'bottom' : 'top';
}

// ── KANVAS ROZETİ: temas tarafı + sürücü ────────────────────────────────────
// Temas tarafı hesabın en tehlikeli girdisi: ters verilirse çekirdek GEÇERLİ
// ama BAŞKA bir kayış yolu çözer, hata vermez. Panelde bir açılır listede
// gizlenirse kullanıcı yanlışı fark edemez. Bu yüzden değer kanvasta, düğümün
// üstünde durur — "K" kaburgalı, "S" sırttan; sürücü kasnak ayrıca "►" taşır.
// Stil ELEMANIN ÜSTÜNDE (css/ dosyasında değil) çünkü css/styles.css'e
// dokunmak Ölçüm Görüntüleyici'nin dağıtım dosyasını bayatlatıyor (bkz.
// CLAUDE.md); tek rozet için o zinciri kurmaya değmez.
// GERÇEK ÇAP HAYALETİ — kutunun arkasında soluk bir çember.
//
// Kutu 54–72 px, gerçek kasnaklar 57–162 mm; birebir ölçekte kutu krankı
// 2.25 KAT küçük gösteriyor. Konum artık fiziksel olduğu için bu fark
// yanıltıcı: ÇAKIŞMAYAN İKİ KUTU, ÇAKIŞAN İKİ KASNAK olabilir — ve çekirdek
// onu "kayış kasnağın içinden geçiyor" diye reddeder. Hayalet, o çarpışmayı
// hata çıkmadan ÖNCE görünür yapıyor.
//
// Kasnaklar DAİREYE ÇEVRİLMİYOR: `c48fe17`'de denendi ve kullanıcının
// isteğiyle geri alındı ("tipik dörtgen topoloji bileşenleri devam etsin").
// Kutu kimliği duruyor; çember yalnız arkada bir ölçü referansı.
function veFeadApplyDiaGhost(nodeEl, node){
  if(!nodeEl || !node || typeof document === 'undefined') return false;
  var box = nodeEl.querySelector('.ve-node-box') || nodeEl;
  var old = box.querySelector('.ve-fead-dia');
  if(old) old.remove();
  if(!_feadIsPulley(node)) return false;
  var od = (typeof veFeadOD === 'function') ? veFeadOD(node) : 0;
  var s = (typeof VE_FEAD_PX_PER_MM === 'number') ? VE_FEAD_PX_PER_MM : 1;
  if(!(od > 0)) return false;
  var d = od * s;
  var g = document.createElement('div');
  g.className = 've-fead-dia';
  g.title = 'Gerçek dış çap ' + _feadFmt(od, 1) + ' mm (1 px = 1 mm)';
  // Kutunun MERKEZİNE göre ortalanıyor; taşması normal ve isteniyor.
  g.style.cssText = 'position:absolute; left:50%; top:50%; pointer-events:none; z-index:0;'
    + 'width:' + d + 'px; height:' + d + 'px; margin-left:' + (-d / 2) + 'px;'
    + 'margin-top:' + (-d / 2) + 'px; border-radius:50%;'
    + 'border:1px dashed var(--text-muted, #888); opacity:0.30;';
  box.insertBefore(g, box.firstChild);
  return true;
}

// Bütün kasnakların çap hayaletini tazele (çap değişince / sürüklerken).
function veFeadRefreshDiaGhosts(){
  if(typeof document === 'undefined' || typeof nodes === 'undefined') return 0;
  var n = 0;
  nodes.forEach(function(x){
    var el = document.getElementById(x.id);
    if(el && veFeadApplyDiaGhost(el, x)) n++;
  });
  return n;
}

// SÜRÜKLEME → mm. ui-core.js'in sürükleme döngüsünden her karede çağrılıyor.
// Tek geçiş: gergi dahil bütün kasnakların krank-göreli mm'si tazeleniyor
// (bkz. veFeadSyncMmFromCanvas). Kasnak yoksa bedava.
function veFeadSyncDrag(){
  if(typeof nodes === 'undefined' || !nodes) return 0;
  if(typeof veFeadSyncMmFromCanvas !== 'function') return 0;
  var org = veFeadOriginNode(nodes);
  if(!org) return 0;
  return veFeadSyncMmFromCanvas(nodes, { origin: org });
}

function veFeadApplyBadge(nodeEl, node){
  if(!nodeEl || !node || typeof document === 'undefined') return false;
  // Çap hayaleti rozetle AYNI dört noktadan tazelensin diye buradan çağrılıyor
  // (createNode · restoreState · sekme yükleme · rozet tazeleme). Ayrı bir
  // çağrı zinciri kurmak, dördünden biri unutulduğunda hayaletin sessizce
  // bayat kalması demekti.
  veFeadApplyDiaGhost(nodeEl, node);
  var old = nodeEl.querySelector('.ve-fead-badge');
  if(old) old.remove();
  if(_feadDefOf(node).isFeadBelt) return veFeadApplyBeltModeBadge(nodeEl, node);
  if(!_feadIsPulley(node)) return false;
  var back = veFeadContactOf(node) === 'back';
  var drv = !!(node.data && node.data.driver);
  var b = document.createElement('span');
  b.className = 've-fead-badge';
  b.textContent = (drv ? '► ' : '') + (back ? 'S' : 'K');
  b.title = 'Temas: ' + veFeadContactLabel(back ? 'back' : 'grooved')
          + (drv ? ' · Sürücü kasnak' : '');
  b.style.cssText = 'position:absolute; top:-9px; right:-6px; z-index:3; pointer-events:none;'
    // Ölçek jetonu — ham px değil (bkz. tests/unit/typography-scale.test.js).
    // --fs-micro zaten "rozet, mikro etiket" için tanımlı.
    + 'font-size:var(--fs-micro); font-weight:700; line-height:1; letter-spacing:0.02em;'
    + 'padding:2px 4px; border-radius:3px; font-family:ui-monospace, monospace;'
    + 'color:#fff; background:' + (back ? 'var(--text-secondary, #666)' : 'var(--accent-primary, #3b82f6)')
    + '; border:1px solid var(--bg-primary, #111);';
  var box = nodeEl.querySelector('.ve-node-box') || nodeEl;
  box.appendChild(b);
  return true;
}

// KAYIŞ BOYU KİPİ ROZETİ — kanvasta, TIKLANABİLİR.
//
// Kip `node.data.lengthMode` alanında ve panel ile kanvas AYNI alanı okuyor
// (Kayış Yolu kartındaki kol konumu seçicisinin kuralının aynısı: iki ayrı
// ayar tutulsa panel bir kipi, kanvastaki rozet başkasını gösterirdi).
//
// Rozet SEÇİM YÜZEYİ, salt gösterge değil: kullanıcı "topoloji üzerinden çok
// basit bir şekilde" seçebilmeli. 60×54'lük kayış kutusuna açılır liste
// sığmıyor, iki durumlu bir anahtar sığıyor.
//
// Renk kipin ANLAMINI taşıyor: SABİT bir GİRDİ (mavi — panelde girilen her
// şeyin rengi), SERBEST bir ÇIKTI (amber — kayışın kendi rengi, ve bu modülde
// "hesaplanmış" demek).
function veFeadApplyBeltModeBadge(nodeEl, node){
  var serbest = (typeof veFeadBeltMode === 'function')
    ? (veFeadBeltMode(node.data) === 'free') : false;
  var b = document.createElement('span');
  b.className = 've-fead-badge';
  b.textContent = serbest ? 'SERBEST' : 'SABİT';
  b.title = serbest
    ? 'Kayış boyu SERBEST: tasarımdan hesaplanıyor (gergi nominal açısında). '
      + 'Tıkla → sabit boya geç.'
    : 'Kayış boyu SABİT: girilen boy kullanılıyor. Tıkla → tasarımdan hesaplansın.';
  b.style.cssText = 'position:absolute; top:-9px; right:-6px; z-index:3; cursor:pointer;'
    + 'font-size:var(--fs-micro); font-weight:700; line-height:1; letter-spacing:0.02em;'
    + 'padding:2px 4px; border-radius:3px; font-family:ui-monospace, monospace;'
    + 'color:#fff; background:' + (serbest ? 'var(--accent-warning, #f59e0b)'
                                           : 'var(--accent-primary, #3b82f6)')
    + '; border:1px solid var(--bg-primary, #111);';
  // Rozete basmak düğümü SÜRÜKLEMEYE başlatmamalı: veAttachNodeDrag mousedown'ı
  // yakalıyor ve sürükleme başlarsa tık hiç gelmiyor.
  b.onmousedown = function(e){ e.stopPropagation(); };
  b.ondblclick  = function(e){ e.stopPropagation(); e.preventDefault(); };
  b.onclick = function(e){
    e.stopPropagation(); e.preventDefault();
    veFeadToggleBeltMode(node.id);
  };
  var box = nodeEl.querySelector('.ve-node-box') || nodeEl;
  box.appendChild(b);
  return true;
}

// Kipi çevir. saveState mutasyondan SONRA çağrılıyor (rozet bir kullanıcı
// kararı, geri alınabilmeli) ve rozet ile Kayış Yolu kartı birlikte tazeleniyor
// — kart kipe göre başka bir boy gösteriyor.
function veFeadToggleBeltMode(nodeId){
  if(typeof nodes === 'undefined') return null;
  var node = nodes.find(function(n){ return n.id === nodeId; });
  if(!node || !_feadDefOf(node).isFeadBelt) return null;
  if(!node.data) node.data = {};
  var yeni = (typeof veFeadBeltMode === 'function' && veFeadBeltMode(node.data) === 'free')
    ? 'fixed' : 'free';
  node.data.lengthMode = yeni;
  if(typeof saveState === 'function') saveState();
  veFeadRefreshBadges();
  if(typeof veFeadRefreshLayoutCards === 'function') veFeadRefreshLayoutCards();
  // Panel açıksa o da tazelensin: serbest kipte "Efektif boy" alanı GİRDİ
  // olmaktan çıkıp türetilmiş bir okumaya dönüşüyor.
  if(typeof showNodeProperties === 'function'
     && typeof selectedNode !== 'undefined' && selectedNode && selectedNode.id === nodeId)
    showNodeProperties(node);
  return yeni;
}

// Tüm kasnakların rozetini tazele (temas tarafı / sürücü değişince).
function veFeadRefreshBadges(){
  if(typeof document === 'undefined' || typeof nodes === 'undefined') return 0;
  var n = 0;
  nodes.forEach(function(x){
    var el = document.getElementById(x.id);
    if(el && veFeadApplyBadge(el, x)) n++;
  });
  return n;
}

// Seçim değişince paneli yeniden çiz: temas tarafı rozeti ve şema anında
// güncellensin (sessiz kalırsa kullanıcı değişikliğin işlendiğini göremez).
function veFeadSetChoice(nodeId, key, val){
  if(typeof nodes === 'undefined') return;
  var node = nodes.find(function(n){ return n.id === nodeId; });
  if(!node) return;
  if(!node.data) node.data = {};
  node.data[key] = val;
  if(typeof saveState === 'function') saveState();
  if(key === 'contact' || key === 'lengthMode') veFeadRefreshBadges();
  if(typeof showNodeProperties === 'function') showNodeProperties(node);
}

// SÜRÜCÜ TEKİLDİR. İşaretlenince diğer kasnaklardaki bayrak temizlenir —
// aksi hâlde çekirdek "birden fazla crank" diye reddeder ve kullanıcı hangi
// kasnağın eski işareti taşıdığını aramak zorunda kalır.
function veFeadSetDriver(nodeId, on){
  if(typeof nodes === 'undefined') return;
  var node = nodes.find(function(n){ return n.id === nodeId; });
  if(!node) return;
  nodes.forEach(function(n){
    if(n.data && n.data.driver && n.id !== nodeId && _feadIsPulley(n)) delete n.data.driver;
  });
  if(!node.data) node.data = {};
  if(on) node.data.driver = true; else delete node.data.driver;
  if(typeof saveState === 'function') saveState();
  veFeadRefreshBadges();
  if(typeof showNodeProperties === 'function') showNodeProperties(node);
}

// ════════════════════════════════════════════════════════════════════════════
//  KASNAK PANELİ (Krank / aksesuarlar / avara)
// ════════════════════════════════════════════════════════════════════════════
// Üç kasnak ailesinin de ortak çekirdeği: geometri (etkin çap + kayış
// düzlemindeki konum) ve eylemsizlik. Farklar tipten okunur:
//   • Krank (isFeadDriver)    → tahrik kaynağı, yük torku YOK.
//   • Aksesuar (isFeadAccessory) → çektiği tork/güç alanı VAR.
//   • Avara (isFeadIdler)     → yük çekmez, yalnız kayış yolunu yönlendirir.
function getFeadPulleyPropertiesHTML(node){
  if(!node.data) node.data = {};
  veFeadMigrateNode(node);                       // eski kayıt: dia → od
  var def = _feadDefOf(node);
  var isIdler = !!def.isFeadIdler;
  var isDriver = !!(node.data.driver);
  var html = '<div class="sw-panel">';


  // ── TEMAS TARAFI — sessiz hataya karşı en kritik alan ──
  // Ters verilirse çekirdek BAŞKA BİR GEÇERLİ güzergâh hesaplar; kapalı çevrim
  // ve sarım değişmezi yine tutar. Yani ne kod ne de göz yakalar. Bu yüzden
  // kendi kartında, uyarısıyla birlikte duruyor.
  html += _feadCard('Temas Tarafı', 'hesap için kritik', 'var(--accent-danger)',
      _feadSelect(node, 'Kayış bu kasnağa', 'contact',
        [['grooved', 'Kaburgalı yüzden değiyor'], ['back', 'Sırtından değiyor']],
        veFeadContactOf(node),
        'Yerleşim çiziminden okunur, hesaplanamaz. <b>Ters verilirse</b> program geçerli '
        + 'ama BAŞKA bir kayış yolu çözer; hata mesajı almazsınız. Aksesuarlar tipik olarak '
        + 'kaburgalı yüzden, avara ve gergi sırttan temas eder.'));

  html += _feadCard('Kasnak Geometrisi', '[mm]', 'var(--accent-primary)',
      _feadGrid(node, [
        { key:'od', label:'Dış çap (OD)', ph:String(VE_FEAD_DEFAULT_DIA[node.type] || 100) },
        { key:'x',  label:'Konum X',      ph:'0' },
        { key:'y',  label:'Konum Y',      ph:'0' }
      ], 3)
    + _feadHint('<b>Dış çap</b> girilir; pitch ve efektif yarıçapları çekirdek kayış profilinden '
        + 'türetir (kaburgalı: r<sub>pitch</sub>=OD/2+h<sub>b</sub>, r<sub>eff</sub>=OD/2). '
        + 'Konum, kayış düzleminde (motor önden görünüş) kasnak merkezidir.'));

  html += _feadCard('Rol', '', 'var(--accent-success)',
      _feadToggle(node, 'Sürücü kasnak (kayışı bu döndürür)', 'driver', 'veFeadSetDriver',
        'Sürücülük bir ROLDÜR, bileşen tipi değil: ikincil tahrikte fan kasnağı da sürücü '
        + 'olabilir. Tek kasnakta işaretlenir; işaretlerseniz diğerlerinden kalkar.')
    + _feadGrid(node, [
        { key:'inertia', label:'Atalet J [kg·m²]', ph:'0.010', step:'0.0001' }
      ], 1)
    + _feadHint(isDriver ? 'Sürücü kasnak ataleti torsiyonel damperi de içerir.'
        : isIdler ? 'Avara kasnak kayıştan güç çekmez; ataleti yalnız geçici rejim için.'
        : 'Aksesuarın çektiği güç, Çözücü panelindeki çalışma çevrimi tablosunda devir başına girilir.'));

  // KATALOG BAĞI — yalnız MFSim'de devir→kW eğrisi bulunan aksesuar tipleri.
  // Seçilirse çalışma çevrimi tablosundaki boş kW hücreleri bu eğriden dolar ve
  // AKSESUAR DEVRİ KASNAK PITCH ÇAPLARINDAN hesaplanır — preset'in kendi
  // driveRatio'su kullanılmaz. Spesifikasyon §2.3: elle yazılmış hız oranları
  // Excel'in en ciddi hatasıydı, bütün gerilmeleri %17 düşürüyordu.
  var lib = veFeadPresetLib(node.type);
  if(lib){
    var secenekler = [['__manual__', 'Elle gir (katalog kullanma)']];
    Object.keys(lib).forEach(function(k){ secenekler.push([k, lib[k].name || k]); });
    html += _feadCard('Katalog Modeli', 'devir → kW eğrisi', 'var(--accent-warning)',
        _feadSelect(node, 'Model', 'accPreset', secenekler, '__manual__',
          'Araç Performans modülünün kataloglarıyla AYNI kaynak. Seçilince çalışma çevrimi '
          + 'tablosundaki boş kW hücreleri bu eğriden doldurulur; aksesuar devri kasnak '
          + '<b>pitch çaplarından</b> gelir, elle oran girilmez.'));
  }

  if(!isIdler) html += veFeadPowerCurveCard(node);

  html += '</div>';
  return html;
}

// ── AKSESUAR GÜÇ EĞRİSİ (devir → kW) ────────────────────────────────────────
// Tedarikçi sayfası her aksesuar için kendi ölçülmüş eğrisini veriyor
// (FEAD_INFORMATION'daki "AIR COMPRESOR" ve "ALTERNATOR" grafikleri + altındaki
// tablolar). Bu, genel katalog eğrisinden ÜSTÜNDÜR: aynı tip aksesuarın farklı
// modelleri çok farklı güç çeker. Bu yüzden düğümün kendi eğrisi varsa
// veFeadAutoKw onu kataloğun ÖNÜNDE kullanır.
//
// Tablo AKSESUAR devrine göre girilir (sayfadaki grafiklerin ekseni de o).
// Kullanıcı sayfadaki motor-devri sütunuyla karşılaştırabilsin diye her satırın
// yanında o devri veren MOTOR devri de gösterilir — model çözülüyse.
function veFeadPowerCurveCard(node){
  var pts = veFeadPowerCurve(node);
  var raw = (node.data && Array.isArray(node.data.pwrCurve)) ? node.data.pwrCurve : [];
  var build = veFeadBuildFromCanvas();
  var idx = -1;
  if(build.ok) build.order.forEach(function(n, i){ if(n.id === node.id) idx = i; });

  var h = '<table style="width:100%; font-size:var(--fs-micro); border-collapse:collapse; border:1px solid var(--border-color);">';
  h += '<tr style="background:var(--bg-tertiary);">'
     + ['Aksesuar devri', 'Güç [kW]', 'Motor devri'].map(function(t){
         return '<th style="padding:3px 4px; border:1px solid var(--border-color); font-weight:600; color:var(--text-secondary);">' + t + '</th>';
       }).join('')
     + '<th style="padding:3px 4px; border:1px solid var(--border-color);"></th></tr>';

  if(!raw.length){
    h += '<tr><td colspan="4" style="padding:9px; text-align:center; color:var(--text-muted); border:1px solid var(--border-color);">'
       + 'Eğri girilmedi — katalog modeli (varsa) kullanılır.</td></tr>';
  }
  raw.forEach(function(p, pi){
    var rpm = _feadNum(p && p.rpm, NaN);
    // Aksesuar devrini veren motor devri: aksRpm = motorRpm × oran ⇒ tersi.
    var motor = NaN;
    if(build.ok && idx >= 0 && Number.isFinite(rpm) && rpm > 0){
      var bir = FEADCore.accessoryRpm(build.sys, idx, 1000);
      if(Number.isFinite(bir) && bir > 0) motor = rpm * 1000 / bir;
    }
    var hucre = function(key, val, step){
      return '<td style="padding:1px 2px; border:1px solid var(--border-color);">'
        + '<input type="number" value="' + _feadEsc(val == null ? '' : val) + '" step="' + step + '"'
        + ' onchange="veFeadCurveSet(\'' + node.id + '\',' + pi + ',\'' + key + '\',this.value)"'
        + ' style="width:100%; ' + _FEAD_INP + ' height:22px; padding:2px 3px;"></td>';
    };
    h += '<tr>' + hucre('rpm', p && p.rpm, '10') + hucre('kw', p && p.kw, '0.01')
      + '<td style="padding:2px 5px; border:1px solid var(--border-color); text-align:right; '
      + 'font-family:ui-monospace,monospace; color:var(--text-muted);">'
      + (Number.isFinite(motor) ? _feadFmt(motor, 0) : '—') + '</td>'
      + '<td style="padding:1px 3px; border:1px solid var(--border-color); text-align:center;">'
      + '<button onclick="veFeadCurveRemove(\'' + node.id + '\',' + pi + ')" title="Satırı sil"'
      + ' style="background:none; border:none; color:var(--accent-danger); cursor:pointer; font-size:var(--fs-body); line-height:1;">×</button></td></tr>';
  });
  h += '</table>';

  h += '<div style="display:flex; gap:6px; margin-top:7px;">'
    + '<button onclick="veFeadCurveAdd(\'' + node.id + '\')" style="flex:1; padding:5px; font-size:var(--fs-micro); '
    + 'background:var(--bg-tertiary); color:var(--text-primary); border:1px solid var(--border-color); cursor:pointer;">+ Devir noktası</button>'
    + '</div>';

  var not = '';
  if(raw.length && pts.length < raw.length)
    not += _feadHint('<b style="color:var(--accent-warning);">' + (raw.length - pts.length)
      + ' satır eksik/geçersiz</b> — yalnız devir ve güç değeri dolu satırlar eğriye girer.');
  if(pts.length === 1)
    not += _feadHint('<b style="color:var(--accent-warning);">Tek nokta</b> — eğri sabit güç '
      + 'gibi davranır (her devirde ' + _feadFmt(pts[0].kw, 2) + ' kW).');

  return _feadCard('Güç Eğrisi', 'sayfadaki devir → kW tablosu', 'var(--accent-primary)',
    h + not
    + _feadHint('Girildiğinde <b>katalog modelinin önüne geçer</b>. Ara değerler doğrusal, '
      + 'uçlarda sabit tutulur (ekstrapolasyon YAPILMAZ — alternatör eğrisini uzatmak eksi '
      + 'güç üretebilirdi). "Motor devri" sütunu bilgi içindir: o aksesuar devrini veren motor '
      + 'devri, kasnak <b>pitch</b> çaplarından ve birinci kademe oranından hesaplanır — '
      + 'sayfanızın motor-devri sütunuyla karşılaştırabilirsiniz.'));
}

function veFeadCurveAdd(nodeId){
  if(typeof nodes === 'undefined') return;
  var node = nodes.find(function(n){ return n.id === nodeId; });
  if(!node) return;
  if(!node.data) node.data = {};
  if(!Array.isArray(node.data.pwrCurve)) node.data.pwrCurve = [];
  var son = node.data.pwrCurve[node.data.pwrCurve.length - 1];
  node.data.pwrCurve.push({ rpm: son ? _feadNum(son.rpm, 0) + 500 : 1000, kw: '' });
  if(typeof saveState === 'function') saveState();
  _feadForgetResults();
  _feadRedraw(node);
}
function veFeadCurveRemove(nodeId, i){
  if(typeof nodes === 'undefined') return;
  var node = nodes.find(function(n){ return n.id === nodeId; });
  if(!node || !node.data || !Array.isArray(node.data.pwrCurve)) return;
  node.data.pwrCurve.splice(i, 1);
  if(typeof saveState === 'function') saveState();
  _feadForgetResults();
  _feadRedraw(node);
}
function veFeadCurveSet(nodeId, i, key, val){
  if(typeof nodes === 'undefined') return;
  var node = nodes.find(function(n){ return n.id === nodeId; });
  if(!node || !node.data || !Array.isArray(node.data.pwrCurve)) return;
  var row = node.data.pwrCurve[i];
  if(!row) return;
  row[key] = val;
  if(typeof saveState === 'function') saveState();
  _feadForgetResults();
  _feadRedraw(node);
}

// ════════════════════════════════════════════════════════════════════════════
//  GERGİ PANELİ
// ════════════════════════════════════════════════════════════════════════════
// Gergi bir kasnaktır AMA konumu serbest değildir: pivot etrafında dönen bir
// kolun ucundadır. Bu yüzden kasnak alanlarına ek olarak pivot + kol + yay
// alanları taşır; kasnak merkezi çalışma açısından türetilir.
function getFeadTensionerPropertiesHTML(node){
  if(!node.data) node.data = {};
  var html = '<div class="sw-panel">';
  html += _feadCard('Temas Tarafı', 'hesap için kritik', 'var(--accent-danger)',
      _feadSelect(node, 'Kayış gergi kasnağına', 'contact',
        [['back', 'Sırtından değiyor'], ['grooved', 'Kaburgalı yüzden değiyor']],
        veFeadContactOf(node),
        'Gergi çoğu FEAD düzeninde kayışın SIRTINA bastırır. Ters verilirse program '
        + 'geçerli ama başka bir kayış yolu çözer; hata almazsınız.'));

  html += _feadCard('Kasnak', '', 'var(--accent-primary)',
      _feadGrid(node, [
        { key:'od',      label:'Dış çap (OD) [mm]', ph:'75' },
        { key:'inertia', label:'Atalet J [kg·m²]',  ph:'0.001', step:'0.0001' }
      ], 2));

  var mode = veFeadAngleMode(node.data);

  // ── KOL KÜNYESİ — PİVOT ARTIK SORULMUYOR ─────────────────────────────────
  //
  // Kullanıcı kararı (2026-08-25): "Otomatik gergi bileşeninde kol ve pivot
  // kısmına kullanıcı girdi girmeyecek. Kullanıcının girdiği koordinat gergi
  // KASNAĞININ merkezi; pivot noktası sonra hesaplanıyor."
  //
  // Doğru: koordinat tablosundaki gergi satırı diğer kasnaklarla aynı şeydir
  // (kasnağın merkezi) ve pivot oradan + parça künyesinden çıkar:
  //     pivot = c − a·(cos θ_kol , sin θ_kol)
  // θ_kol gergi üreticisinin parça çiziminde yazar (E9843: "344° MEAN ANGLE").
  //
  // PİVOT ALANLARI YİNE DE DURUYOR ama ikincil: tedarikçi raporundan gelen
  // ÖLÇÜLMÜŞ bir pivot varsa o kazanır ve kol boyu çapraz kontrolü orada
  // gerçek bir denetim olur. Boş bırakılırsa türetilir.
  var _tp = veFeadPivotFromArm(node.data);
  html += _feadCard('Kol Künyesi', 'pivot BURADAN türer', 'var(--text-secondary)',
      _feadGrid(node, [
        { key:'armLen',     label:'Kol boyu (Arm Length) [mm]', ph:'90' },
        { key:'armMeanDeg', label:'Kol çalışma açısı (MEAN) [°]', ph:'344', step:'0.1' }
      ], 2)
    + (_tp
        ? '<div style="display:flex; align-items:center; gap:10px; margin-bottom:6px;">'
          + '<div style="flex:1; font-size:var(--fs-body); font-weight:600; color:var(--text-secondary);">'
          + 'Türetilen pivot</div><div style="width:150px; text-align:center; '
          + 'font-family:ui-monospace, monospace; font-weight:700; font-size:var(--fs-body); '
          + 'color:var(--accent-warning);">' + _feadEsc(_tp[0].toFixed(2) + ' / ' + _tp[1].toFixed(2))
          + '</div></div>'
        : '')
    + _feadHint('<b>Pivot sorulmaz.</b> Kasnak merkezi (aşağıdaki montaj konumu) ile kol boyu ve '
        + 'kolun çalışma açısı verilince pivot bunlardan <b>hesaplanır</b>. Kol açısı gergi '
        + 'üreticisinin parça çiziminde yazar (ör. E9843 için <b>344°</b>). Kol boyu 56–90 mm '
        + 'aralığında doğrulandı.'));

  // Ölçülmüş pivot (tedarikçi raporu) varsa girilebilsin — ikincil yol.
  html += _feadCard('Ölçülmüş Pivot', 'opsiyonel — tedarikçi raporundan', 'var(--text-muted)',
      _feadGrid(node, [
        { key:'pivotX', label:'Pivot X [mm]', ph:'(türetilir)' },
        { key:'pivotY', label:'Pivot Y [mm]', ph:'(türetilir)' }
      ], 2)
    + _feadHint('Boş bırakın — normalde pivot yukarıdaki künyeden türetilir. Yalnız '
        + 'tedarikçi raporunda ya da montaj resminde <b>ölçülmüş</b> bir pivot varsa doldurun; '
        + 'o zaman girilen değer kazanır ve kol boyu çapraz kontrolü gerçek bir denetim olur.'));

  // ── YAY KÜNYESİ — tedarikçi sayfasındaki dört satırın birebir karşılığı ──
  html += _feadCard('Yay Künyesi', 'sayfadaki dört satır', 'var(--accent-success)',
      _feadGrid(node, [
        { key:'preload',  label:'Ön yük — Pre-Load [Nm]',  ph:'8.60' },
        { key:'kArm',     label:'Yay katsayısı — Rate [Nm/°]', ph:'0.480', step:'0.001' },
        { key:'meanLoad', label:'Çalışma momenti — Mean Load [Nm]', ph:'22.07' }
      ], 3)
    + _feadHint('Üçü de tedarikçi sayfasının "Tensioner" tablosunda yazar (Spring Pre-Load · '
        + 'Spring Rate · Spring Mean Load). <b>Çalışma momenti</b> kolun montajda ne kadar '
        + 'kurulduğunu söyler: göreli açı = (Mean − Pre) / Rate.'));

  // ── MONTAJ KONUMU — bu modülün en tehlikeli girdisi ──
  // Sayfa serbest açıyı VERMİYOR; gergi kasnağının montaj merkezini veriyor.
  // İkisi karıştırılırsa gerginlik 2.6 kat düşük çıkıyor ve hata verilmiyor
  // (ölçüm aşağıdaki uyarının içinde). Bu yüzden varsayılan yol montaj konumu.
  html += _feadCard('Kol Açısı', 'hesap için kritik', 'var(--accent-danger)',
      // Varsayılan ÇÖZÜLEN moddur, sabit 'mount' değil: eski bir kayıt yalnız
      // serbest açı taşıyorsa liste de 'direct' göstermeli, yoksa panel bir
      // şey söyler hesap başka şey yapardı.
      _feadSelect(node, 'Kol açısı nereden gelsin', 'angleMode',
        [['mount', 'Montaj merkezinden türet (sayfanın biçimi)'],
         ['direct', 'Serbest kol açısını elle gir']], mode,
        '<b>Montaj merkezi</b> = gergi kasnağının kayış takılıyken durduğu yer; koordinat '
        + 'tablosunda diğer kasnaklarla aynı biçimde yazar. <b>Serbest kol açısı</b> ise kolun '
        + 'kayış TAKILI DEĞİLKEN durduğu açıdır — sayfada YOKTUR. İkisi aynı şey değil: '
        + 'montaj konumunda yay çalışma momentine kadar kurulmuştur.')
    + (mode === 'mount'
        ? _feadGrid(node, [
            { key:'cenX', label:'Montaj merkezi X', ph:'-170.08' },
            { key:'cenY', label:'Montaj merkezi Y', ph:'99.16' }
          ], 2)
          + veFeadMountReadout(node)
        : _feadGrid(node, [
            { key:'freeAngleDeg', label:'Serbest kol açısı [°]', ph:'42' }
          ], 1)
          + _feadHint('<b style="color:var(--accent-danger);">Dikkat:</b> buraya montaj '
            + 'konumunun açısı yazılırsa çekirdek çalışma noktasında yayı yalnız ön yükünde '
            + 'bulur. PDF sistemiyle ölçüldü: moment 22.07 Nm yerine 8.81 Nm, gerginlik '
            + '650 N yerine <b>251 N</b> — geometri kusursuz çözülür, hiçbir hata çıkmaz.'))
    + _feadSelect(node, 'Kol dönüş yönü (sense)', 'sense',
        [['', 'Otomatik bul'], ['1', '+1'], ['-1', '−1']], '',
        'Göreli açı sıfırda serbest koldur ve artan yön yaya yüklenme yönüdür: '
        + 'M = önYük + katsayı × göreli; mutlak açı = serbest + sense × göreli. Sense '
        + 'verilmezse çekirdek kayışın kısaldığı yönden kendisi bulur.'));

  html += _feadCard('Mekanik Sınır ve Atalet', 'burulma modeli için', 'var(--text-secondary)',
      _feadGrid(node, [
        { key:'loadStopRelDeg', label:'Load stop (göreli) [°]', ph:'62.4' },
        { key:'armInertia',     label:'Kol ataleti [kg·m²]',  ph:'0.0009', step:'0.0001' },
        { key:'pulleyMass',     label:'Kasnak kütlesi [kg]',   ph:'0.80',   step:'0.01' }
      ], 3)
    + _feadHint('<b>Load stop</b> bir MEKANİK sınırdır, çalışma noktası değil — boş bırakılabilir. '
        + '<b>Kol ataleti</b> ve <b>kasnak kütlesi</b> burulma (dönel titreşim) modeline girer; '
        + 'ikisi de raporun "Tensioner Data" satırlarında yazar. Kol, kasnağı kol boyu '
        + 'yarıçapında taşıdığı için etkin atalet J<sub>kol</sub> + m·L² olur — <b>kütle '
        + 'girilmezse birinci mod belirgin şekilde YÜKSEK çıkar</b> (BMC örneğinde 15.3 yerine '
        + '20.3 Hz, +%32).'));

  html += '</div>';
  return html;
}

// Montaj konumundan çıkan sayılar + KOL BOYU ÇAPRAZ KONTROLÜ.
// Kontrol bedava: |montaj merkezi − pivot| ile Arm Length aynı sayfada yazar,
// uyuşmuyorsa biri yanlış okunmuştur. PDF'te 89.998 ↔ 90.0 ile tutuyor.
function veFeadMountReadout(node){
  var td = node.data || {};
  var m = veFeadTensionerMount(td);
  if(!m.ok)
    return _feadHint('Montaj merkezi ve pivot girilince kol açısı burada türetilir.');

  var ac = veFeadArmCheck(td);
  var satir = function(et, deg, not){
    return '<div style="display:flex; justify-content:space-between; gap:8px; padding:2px 0;">'
      + '<span style="color:var(--text-muted);">' + et + '</span>'
      + '<span style="font-family:ui-monospace,monospace; color:' + (not || 'var(--text-primary)') + ';">' + deg + '</span></div>';
  };
  var h = '<div style="font-size:var(--fs-micro); line-height:1.5; padding:7px 9px; margin-bottom:9px; '
        + 'background:var(--bg-tertiary); border:1px solid var(--border-color); border-radius:var(--radius-sm);">';
  h += satir('Montaj açısı (pivot → merkez)', _feadFmt(m.montajDeg, 2) + '°');
  h += satir('Kol boyu · koordinattan', _feadFmt(m.armFromCoords, 2) + ' mm');

  if(Number.isFinite(ac.deltaMm)){
    h += satir('Kol boyu · girilen', _feadFmt(ac.entered, 2) + ' mm');
    // 0.005 mm altındaki fark yuvarlanınca "−0.00" gibi görünüyordu; iki
    // basamakta ayırt edilemeyen bir sapmayı eksi işaretiyle göstermek
    // "tutuyor" satırıyla çelişiyor.
    var d = (Math.abs(ac.deltaMm) < 0.005) ? 0 : ac.deltaMm;
    h += satir(ac.ok ? '↳ fark — tutuyor' : '↳ fark — TUTMUYOR',
      (d >= 0 ? '+' : '') + _feadFmt(d, 2) + ' mm',
      ac.ok ? 'var(--accent-success)' : 'var(--accent-danger)');
  } else {
    h += satir('Kol boyu · girilen', '— (girilmedi)', 'var(--accent-warning)');
  }

  if(Number.isFinite(m.relMeanDeg)){
    h += satir('Yay kurulması (Mean−Pre)/Rate', _feadFmt(m.relMeanDeg, 2) + '°');
    h += satir('Serbest kol açısı (türetildi)',
      _feadFmt(veFeadFreeAngleFrom(m, 1), 2) + '° / ' + _feadFmt(veFeadFreeAngleFrom(m, -1), 2) + '°',
      'var(--accent-primary)');
  } else {
    h += satir('Yay kurulması', '— (çalışma momenti girilmedi)', 'var(--accent-warning)');
  }
  h += '</div>';

  var not = _feadHint('Serbest açı iki değerle gösterilir çünkü kolun dönüş yönüne (sense) '
    + 'bağlıdır; hangisinin kullanıldığını çekirdek geometriden bulur ve Çözücü panelindeki '
    + '"Algılanan Model" tablosunda yazar.');
  if(m.notes.length)
    not += _feadHint('<b style="color:var(--accent-warning);">' + _feadEsc(m.notes.join(' ')) + '</b>');
  return h + not;
}

// ════════════════════════════════════════════════════════════════════════════
//  KAYIŞ ÖZELLİKLERİ PANELİ (iç topolojide tek kopya)
// ════════════════════════════════════════════════════════════════════════════
function getFeadBeltPropertiesHTML(node){
  if(!node.data) node.data = {};
  var html = '<div class="sw-panel">';
  // Profil + marka, çekirdeğin BELT_DB'sindeki hb/hr'yi seçer — kasnak
  // yarıçapları buradan türetildiği için künyenin en belirleyici iki alanı bu.
  var profiller = [['PK','PK'],['PJ','PJ'],['PH','PH'],['PL','PL'],['PM','PM']];
  var markalar = [['GATES','Gates'],['OPTIBELT','Optibelt'],['CONTITECH','ContiTech']];
  html += _feadCard('Profil ve Marka', 'h_b / h_r buradan gelir', 'var(--accent-warning)',
      _feadSelect(node, 'Profil', 'profile', profiller, 'PK')
    + _feadSelect(node, 'Marka', 'brand', markalar, 'GATES', veFeadBeltDbHint(node)));

  // ── BOY KİPİ ───────────────────────────────────────────────────────────
  // Kol açısı ile kayış boyu TEK serbestlik derecesini paylaşıyor; hangisinin
  // GİRDİ olduğu burada seçiliyor. Panel ile kanvas rozeti AYNI alanı okuyor
  // (veFeadBeltMode → node.data.lengthMode).
  var kip = (typeof veFeadBeltMode === 'function') ? veFeadBeltMode(node.data) : 'fixed';
  var serbest = (kip === 'free');
  html += _feadCard('Kayış Boyu', serbest ? 'tasarımdan HESAPLANIR' : 'katalogdan SEÇİLİR',
      serbest ? 'var(--accent-warning)' : 'var(--accent-primary)',
      _feadSelect(node, 'Boy kipi', 'lengthMode', [
        ['fixed', 'Sabit — kayış seçilmiş'],
        ['free',  'Serbest — tasarımdan çıkar']
      ], kip)
    + _feadHint(serbest
        ? 'Gergi kolu <b>nominal yay yüküne</b> karşılık gelen açıya oturuyor '
          + '((M<sub>çalışma</sub> − M<sub>ön</sub>)/k) ve gereken kayış boyu oradan '
          + '<b>hesaplanıyor</b>. Tasarım yapıp kayışı sonra tedarik ediyorsanız bu kip. '
          + 'Kasnak konumunu değiştirdikçe gereken boy da değişir.'
        : 'Girilen boy kullanılıyor; gergi kolu kayış yolunu <b>o boya eşitleyen</b> açıya '
          + 'oturuyor ve gerginlik oradan çıkıyor. Elinizde belirli bir kayış varsa bu kip. '
          + 'Kayış bu yerleşime sığmıyorsa model yine çözülür — kol nominal açısına alınır '
          + 've <b>gereken boy</b> yazılır.'));

  html += _feadCard('Künye', '', 'var(--accent-warning)',
      _feadText(node, 'Tip / kod', 'beltType', 'ör. 8PK 1475HD')
    + _feadGrid(node, serbest ? [
        { key:'ribs',      label:'Kanal sayısı',        ph:'8', step:'1' },
        { key:'tolerance', label:'Tolerans ± [mm]',     ph:'6' },
        { key:'wearPct',   label:'Aşınma payı [oran]',  ph:'0.007', step:'0.0001' }
      ] : [
        { key:'ribs',      label:'Kanal sayısı',        ph:'8', step:'1' },
        { key:'effLength', label:'Efektif boy [mm]',    ph:'1475' },
        { key:'tolerance', label:'Tolerans ± [mm]',     ph:'6' },
        { key:'wearPct',   label:'Aşınma payı [oran]',  ph:'0.007', step:'0.0001' }
      ], 2)
    + (serbest ? veFeadDerivedLengthHTML(node) : '')
    + _feadHint('<b>Efektif boy</b> ISO 9981 boyudur — katalog adındaki sayının ta kendisi '
        + '(8PK<b>1715</b> → 1715 mm). <b>Aşınma payı</b> ORAN olarak girilir '
        + '(0.007 = %0.70). Konum tablosu bu üç sayıdan kurulur: Replace = L+tol+aşınma·L, '
        + 'Max = L+tol, Mean = L, Min = L−tol.'));

  html += veFeadBeltCatalogCard(node, serbest);

  html += _feadCard('Malzeme', 'opsiyonel', 'var(--accent-success)',
      _feadGrid(node, [
        { key:'massPerRibKgM', label:'Kaburga başına kütle [kg/m]', ph:'0.0196', step:'0.0001' }
      ], 1)
    + _feadHint('Yalnız span frekansı için. Boş bırakılırsa katalog değeri kullanılır — ama '
        + 'Gates PK kataloğu 0.0144 kg/m/kaburga derken hem kesit tahmini hem de ölçülmüş '
        + 'frekans haritasından geri-hesap <b>0.0196</b> veriyor. Frekans önemliyse elle girin.'));
  html += '</div>';
  return html;
}

// ─── KATALOG KARTI ──────────────────────────────────────────────────────────
//
// Katalogun değeri bir boy listesi DEĞİL, o listeden birini seçmenin NE
// YAPACAĞI: kayış boyu değişince gergi kolu başka bir açıya oturuyor ve
// gerginlik onunla değişiyor. "1690 mı 1755 mi" sorusu ancak bu sayılarla
// cevaplanabilir; çıplak bir liste kullanıcıyı kendi başına bırakırdı.
//
// İKİ KÜME AYRI GÖSTERİLİYOR ve etiketli — biri gerçek bir STOK listesi
// (ISO 9982 / DIN 7867), öbürü otomotiv IZGARASI (bir kural). Tek listede
// karıştırmak "bunlar da stokta" sanılmasına yol açardı. Ölçülmüş sebep:
// BMC'nin kendi kayışı (8PK 1715) stok listesinde YOK — komşuları 1690 ve
// 1755, yani 65 mm'lik bir boşluk.
function veFeadBeltCatalogCard(node, serbest){
  // KATALOĞUN KENDİ sembolüne bakılıyor, köprününkine değil: köprü
  // (fead-model.js) her zaman yüklü ama katalog ayrı bir dosya. Yanlış sembolü
  // yoklamak, katalog eksikken paneli ReferenceError ile düşürüyordu.
  if(typeof veFeadBeltNearest !== 'function' || typeof veFeadBeltOptions !== 'function')
    return _feadCard('Katalog', '', 'var(--text-muted)',
      _feadHint('Kayış kataloğu yüklenmedi (js/fead-belts.js).'));
  var kaynak = (typeof VE_FEAD_BELT_LIB_SOURCE === 'string') ? VE_FEAD_BELT_LIB_SOURCE : '';

  var b = null;
  try { b = (typeof veFeadBuildFromCanvas === 'function') ? veFeadBuildFromCanvas() : null; }
  catch(e){ b = null; }
  var o = veFeadBeltOptions(b, { count: 3 });
  if(!o.ok)
    return _feadCard('Katalog', 'ISO 9982 / DIN 7867', 'var(--text-muted)',
      _feadHint(_feadEsc(o.error || 'Gereken boy henüz belli değil.')));

  var sut = function(t, w, al){
    return '<th style="padding:3px 5px; text-align:' + (al||'right') + '; width:' + w
      + '; font-size:var(--fs-micro); font-weight:600; color:var(--text-muted);'
      + ' border-bottom:1px solid var(--border-color); white-space:nowrap;">' + t + '</th>';
  };
  var h = '<div style="font-size:var(--fs-micro); color:var(--text-muted); margin:-3px 0 7px;">'
    + 'Gereken boy <b style="color:var(--accent-warning);">' + _feadFmt(o.targetMm, 2)
    + ' mm</b> — aşağıdaki boylardan birini seçerseniz gergi kolu ve gerginlik '
    + 'şu değerlere oturur.</div>';
  h += '<div style="overflow-x:auto;"><table style="width:100%; border-collapse:collapse;'
    + ' font-family:ui-monospace, monospace; font-size:var(--fs-micro);">'
    + '<thead><tr>' + sut('Boy', '20%') + sut('Δ', '16%') + sut('Kod', '26%', 'left')
    + sut('Kol', '16%') + sut('Gerginlik', '22%') + '</tr></thead><tbody>';

  var satir = function(c, izgara){
    if(!c) return '';
    var f = c.fit || {};
    var vur = izgara ? ' background:var(--bg-input);' : '';
    // SIĞMAYAN ADAY: sayı değil HÜKÜM. Kenetlenmiş çözümün gerginliği
    // tekilliğe komşu ve fiziksel değil (bkz. veFeadBeltFit).
    var kol = (f.ok && f.fits) ? _feadFmt(f.relDeg, 2) + '°' : '—';
    var ger = (f.ok && f.fits && Number.isFinite(f.tensionN))
      ? _feadFmt(f.tensionN, 0) + ' N' : '—';
    var sig = !(f.ok && f.fits);
    if(sig){ kol = '<span style="color:var(--accent-danger);">sığmıyor</span>'; }
    return '<tr style="cursor:pointer;' + vur + (sig ? ' opacity:0.65;' : '') + '"'
      + ' onclick="veFeadPickBelt(\'' + node.id + '\',' + c.lengthMm + ')"'
      + ' title="Bu boyu seç (kip SABİT olur)">'
      + '<td style="padding:3px 5px; text-align:right; font-weight:700;">' + _feadFmt(c.lengthMm, 0) + '</td>'
      + '<td style="padding:3px 5px; text-align:right; color:var(--text-muted);">'
      + (c.deltaMm >= 0 ? '+' : '−') + _feadFmt(Math.abs(c.deltaMm), 1) + '</td>'
      + '<td style="padding:3px 5px; text-align:left;">' + _feadEsc(c.code)
      + (izgara ? ' <span style="color:var(--accent-warning);">◇</span>' : '') + '</td>'
      + '<td style="padding:3px 5px; text-align:right;">' + kol + '</td>'
      + '<td style="padding:3px 5px; text-align:right;">' + ger + '</td></tr>';
  };
  // Izgara adayı listeye SIRALI giriyor ama ayrı işaretli (◇).
  var hepsi = o.stock.slice();
  if(o.grid && !hepsi.some(function(x){ return x.lengthMm === o.grid.lengthMm; }))
    hepsi.push(o.grid);
  hepsi.sort(function(a, b){ return a.lengthMm - b.lengthMm; });
  hepsi.forEach(function(c){ h += satir(c, c.kind === 'grid'); });
  h += '</tbody></table></div>';

  h += _feadHint('<b>◇</b> otomotiv ızgarası (5 mm adım) — stok listesinde değil ama '
    + 'ısmarlanabilir; FEAD kayışları uygulama başına üretiliyor. İşaretsiz satırlar '
    + 'ISO 9982 / DIN 7867 <b>stok</b> boyları. Katalog bir KISIT DEĞİL: ara boy '
    + 'tedarik edilebilir, boyu elle de girebilirsiniz. Kaynak: ' + _feadEsc(kaynak) + '.');

  return _feadCard('Katalog', serbest ? 'gereken boya en yakınlar' : 'başka bir boy seçersem',
                   'var(--accent-primary)', h);
}

// Katalogdan boy seçmek KİPİ DE SABİTLER: seçilen boy bir GİRDİ, dolayısıyla
// serbest kipte kalmak kullanıcının seçimini sessizce yok saymak olurdu.
function veFeadPickBelt(nodeId, lengthMm){
  if(typeof nodes === 'undefined') return null;
  var node = nodes.find(function(n){ return n.id === nodeId; });
  if(!node || !_feadDefOf(node).isFeadBelt) return null;
  if(!node.data) node.data = {};
  var L = _feadNum(lengthMm, NaN);
  if(!Number.isFinite(L) || !(L > 0)) return null;
  node.data.effLength = L;
  node.data.lengthMode = 'fixed';
  if(typeof saveState === 'function') saveState();
  veFeadRefreshBadges();
  if(typeof veFeadRefreshLayoutCards === 'function') veFeadRefreshLayoutCards();
  if(typeof showNodeProperties === 'function') showNodeProperties(node);
  return L;
}

// SERBEST KİPTE BOY BİR OKUMA, ALAN DEĞİL — ama GÖRÜNMEK ZORUNDA.
//
// Alanı kaldırıp yerine hiçbir şey koymamak, kullanıcıyı "boy nereden geldi"
// sorusuyla baş başa bırakırdı; bu modülün kuralı türetilen her sayıyı
// okunabilir bir yerde göstermek (tasarım gerginliğinin "Algılanan Model"
// tablosunda görünmesiyle aynı gerekçe).
function veFeadDerivedLengthHTML(node){
  var b = null;
  try { b = (typeof veFeadBuildFromCanvas === 'function') ? veFeadBuildFromCanvas() : null; }
  catch(e){ b = null; }
  var deger = '—', not = 'Model henüz çözülemedi; kasnakları ve gergi künyesini tamamlayın.';
  if(b && b.ok && Number.isFinite(b.beltLengthMm)){
    deger = _feadFmt(b.beltLengthMm, 2) + ' mm';
    not = 'Kasnak koordinatları, çaplar ve gergi künyesinden hesaplandı '
        + '(kol ' + _feadFmt(b.relDeg, 3) + '°). Tedarikçiye verilecek boy budur; '
        + 'en yakın katalog boyunu seçerseniz kip SABİT olur ve kol biraz kayar.';
  } else if(b && b.errors && b.errors.length){
    not = _feadEsc(b.errors[0]);
  }
  return '<div style="display:flex; align-items:center; gap:10px; margin-bottom:6px;">'
    + '<div style="flex:1; font-size:var(--fs-body); font-weight:600; color:var(--text-secondary);">'
    + 'Gereken efektif boy</div>'
    + '<div style="width:130px; text-align:center; font-family:ui-monospace, monospace;'
    + ' font-weight:700; font-size:var(--fs-body); color:var(--accent-warning);">'
    + _feadEsc(deger) + '</div></div>'
    + _feadHint(not);
}

// Seçili profil+marka için çekirdeğin katalogda tuttuğu değerleri göster —
// kullanıcı hangi h_b/h_r ile hesaplandığını görsün, tahmin etmesin.
function veFeadBeltDbHint(node){
  if(typeof FEADCore === 'undefined') return '';
  try {
    var bp = FEADCore.beltProps({ profile: (node.data.profile || 'PK'), brand: (node.data.brand || 'GATES') });
    return 'Katalog: h<sub>b</sub> = ' + bp.hb + ' mm · h<sub>r</sub> = ' + bp.hr + ' mm · '
      + 'kaburga adımı ' + bp.ribPitch + ' mm · min. kasnak çapı ' + bp.minPulleyDia + ' mm · '
      + 'maks. hız ' + bp.maxSpeedMs + ' m/s.';
  } catch(e){
    return '<span style="color:var(--accent-danger);">' + _feadEsc(veFeadTranslateError(e && e.message)) + '</span>';
  }
}

// ════════════════════════════════════════════════════════════════════════════
//  KAYIŞIN YAY-UZUNLUĞU YÜRÜYÜŞÜ — çizimin ve animasyonun ORTAK tabanı
// ════════════════════════════════════════════════════════════════════════════
// Kayış yolu, ardışık parçaların (açıklık doğrusu → sarım yayı → …) kapalı bir
// zinciri. Diş sırası da, kasnak kollarının açısı da bu zincir üzerindeki YAY
// UZUNLUĞUNUN fonksiyonu; ikisini tek bir yürüyüşten üretmek animasyonun
// tutarlılığını YAPISAL yapıyor: kayış bir kasnağın üzerinde v hızıyla
// ilerlerken kasnağın kolları ω = v/r ile dönüyor, yani KAYMA gözle görünmez —
// çünkü aynı fazdan besleniyorlar, ayrı iki sayaçtan değil.
//
// mm DÜZLEMİNDE kalınır (ekran px'inde değil): işaret kuralları (diş normali,
// sarım yönü) mm düzleminde türetilmişti ve ty() y'yi çevirdiği için px'e
// taşımak bütün o kuralları yeniden işaretlemek olurdu. Bu modülde bir işaret
// kuralı ZATEN bir kez ters yazılmıştı (yay sweep bayrağı).
function _feadR(v){ return Math.round(v*100)/100; }

// mm → ekran dönüşümü tek nesnede: hem çizici hem animatör aynısını kullanır.
// (Animatör geometriyi değil, bu katsayıları JSON'dan okuyor.)
function _feadXform(s, offX, offY, minX, maxY){
  return { s: s, ox: offX, oy: offY, mx: minX, my: maxY,
           tx: function(x){ return offX + (x - minX)*s; },
           ty: function(y){ return offY + (maxY - y)*s; } };
}

// Kapalı kayış zinciri: her açıklık için bir doğru parçası, ardından o
// açıklığın VARDIĞI kasnağın sarım yayı. Sıra beltPath()'in çizdiği sırayla
// birebir aynı — iki ayrı sıra tutmak, dişlerin kayıştan kayması demekti.
function _feadBeltWalk(geom){
  var q = geom.pulleys, n = q.length, segs = [], toplam = 0;
  for(var i=0;i<n;i++){
    var sp = geom.spans[i], p = q[(i+1)%n];
    var dx = sp.Pj[0]-sp.Pi[0], dy = sp.Pj[1]-sp.Pi[1];
    var L = Math.sqrt(dx*dx + dy*dy) || 0;
    segs.push({ a:0, x:sp.Pi[0], y:sp.Pi[1],
                ux:(L ? dx/L : 1), uy:(L ? dy/L : 0), l:L });
    toplam += L;
    var R = p.rPitch, wrap = geom.wraps[(i+1)%n];
    segs.push({ a:1, cx:p.c[0], cy:p.c[1], r:R,
                a0:Math.atan2(sp.Pj[1]-p.c[1], sp.Pj[0]-p.c[0]),
                d:(p.d > 0 ? 1 : -1), l:R*wrap });
    toplam += R*wrap;
  }
  return { segs: segs, l: toplam };
}

// DİŞ ADIMI ÇEVREYİ TAM BÖLER. Hedef adım (7 px) çevreye tam oturmadığı için
// kapanış noktasında bir artık kalır; şema donukken bu görünmez, ama faz
// ilerlerken o artık sabit bir noktada duran "diş sıkışması" olarak akıp
// giden kayışın üstünde tek bir tökezleme gibi okunur. Adımı çevreye
// bölünecek şekilde yuvarlamak dikişi tamamen kaldırıyor (BMC: hedef 12.66 mm
// → 135 diş → 12.70 mm, yani %0.3 sapma).
function _feadToothStep(loopLenMm, hedefMm){
  if(!(loopLenMm > 0) || !(hedefMm > 0)) return hedefMm || 1;
  return loopLenMm / Math.max(8, Math.round(loopLenMm / hedefMm));
}

// Diş sırası — faz kadar İLERLETİLMİŞ olarak.
//
// Yön kuralı değişmedi (bkz. aşağıdaki türetme): mm düzleminde ilerleme yönü u
// iken kaburgalı yüz normali rot90ccw(u)/sense. Değişen tek şey dişlerin
// NEREDE durduğu: eskiden her parça kendi fazından (adımın yarısı) başlıyordu,
// yani parça sınırlarında adım bozuluyordu; şimdi tek bir küresel yay
// uzunluğundan (σ ≡ faz, mod adım) çözülüyor. Faz artınca dişler kayış boyunca
// İLERİ (güzergâh yönünde) yürür — kayışın gerçek gidiş yönü.
function _feadTeethPath(walk, sense, stepMm, lenMm, phaseMm, T){
  var sn = (sense < 0) ? -1 : 1, out = '', sigma = 0;
  var step = (stepMm > 0) ? stepMm : 1;
  var faz = phaseMm || 0, eps = step * 1e-6;
  function rib(ux, uy){ return sn > 0 ? [-uy, ux] : [uy, -ux]; }
  function tooth(px, py, nx, ny){
    var L = Math.sqrt(nx*nx + ny*ny) || 1;
    out += 'M' + _feadR(T.tx(px)) + ' ' + _feadR(T.ty(py))
         + 'L' + _feadR(T.tx(px + nx/L*lenMm)) + ' ' + _feadR(T.ty(py + ny/L*lenMm));
  }
  walk.segs.forEach(function(sg){
    // PARÇA SINIRI EPSİLONLA KAPANIR — yoksa diş SAYISI faz boyunca ±1 oynar.
    // Tam sınıra düşen bir diş, kayan noktada ya iki parçaya birden ya da
    // hiçbirine yazılır: ekranda bir dişin çevrimde bir kez yanıp sönmesi.
    // (Ölçüldü: 12 fazın birinde 141, kalanında 140 diş.) Sayaç da KATLA
    // ilerletilir, tekrarlı toplamayla değil — 140 adımda birikecek kayma
    // dişleri kayışın gerisinde bırakırdı.
    var t0 = ((faz - sigma) % step + step) % step;
    if(t0 > step - eps) t0 = 0;                       // ≈adım ⇒ aslında 0
    var m = Math.max(0, Math.ceil((sg.l - t0 - eps) / step)), q, t;
    if(sg.a === 0){
      var nb = rib(sg.ux, sg.uy);
      for(q = 0; q < m; q++){
        t = t0 + q*step;
        tooth(sg.x + sg.ux*t, sg.y + sg.uy*t, nb[0], nb[1]);
      }
    } else if(sg.r > 0){
      for(q = 0; q < m; q++){
        t = t0 + q*step;
        var th = sg.a0 + sg.d * (t / sg.r);
        var nb2 = rib(-sg.d*Math.sin(th), sg.d*Math.cos(th));
        tooth(sg.cx + sg.r*Math.cos(th), sg.cy + sg.r*Math.sin(th), nb2[0], nb2[1]);
      }
    }
    sigma += sg.l;
  });
  return out;
}

// ── KASNAK KOLLARI — dönüşün görünür işareti ───────────────────────────────
// Neden ÇEPERE DİŞ DEĞİL de kol: V kaburgalı kayış SÜRTÜNME ile çalışır,
// kasnak yüzeyindeki oluklar ÇEVRESELDİR (kayışla aynı yönde uzanır), diş
// değildir. Çepere radyal diş çizmek senkron (dişli) kayış resmi olurdu —
// yanlış bir mekanizma öğretirdi. Kol ise bir YÜZEY iddiası değil, nirengi
// işareti: sadece "bu kasnak şu hızda, şu yöne dönüyor" der.
//
// AÇI AYNI FAZDAN: θ(faz) = a0 + d·faz/r. Türevi d·(1/r), yani ω = d·v/r —
// kayışın o kasnak üzerindeki hızının ta kendisi. Dişlerle kolları ayrı
// sayaçlardan sürseydik ikisi zamanla ayrışır ve kayış kasnağın üstünde
// KAYIYORMUŞ gibi görünürdü (V kaburgalı bir tahrikte olmayan bir şey).
var VE_FEAD_SPOKE_N   = 3;      // kol sayısı
var VE_FEAD_SPOKE_IN  = 0.26;   // iç uç (yarıçap oranı)
var VE_FEAD_SPOKE_OUT = 0.86;   // dış uç
var VE_FEAD_SPOKE_MIN_PX = 9;   // bundan küçük kasnakta kol çizilmez (kalabalık)
// onlyArc verilirse YALNIZ o sarım yayının (o kasnağın) kolları üretilir —
// her kasnak kendi rol rengini taşıyan ayrı bir yol olsun diye. Sayım
// SEGMENTTEN yapılır, DOM sırasından değil.
function _feadSpokePath(walk, phaseMm, T, onlyArc){
  var out = '', faz = phaseMm || 0, arc = -1;
  walk.segs.forEach(function(sg){
    if(sg.a !== 1 || !(sg.r > 0)) return;
    arc++;
    if(onlyArc != null && arc !== onlyArc) return;
    if(sg.r * T.s < VE_FEAD_SPOKE_MIN_PX) return;
    var th0 = sg.a0 + sg.d * (faz / sg.r);
    for(var k=0;k<VE_FEAD_SPOKE_N;k++){
      var th = th0 + k * 2*Math.PI/VE_FEAD_SPOKE_N;
      var c = Math.cos(th), s2 = Math.sin(th);
      out += 'M' + _feadR(T.tx(sg.cx + sg.r*VE_FEAD_SPOKE_IN*c)) + ' '
                 + _feadR(T.ty(sg.cy + sg.r*VE_FEAD_SPOKE_IN*s2))
           + 'L' + _feadR(T.tx(sg.cx + sg.r*VE_FEAD_SPOKE_OUT*c)) + ' '
                 + _feadR(T.ty(sg.cy + sg.r*VE_FEAD_SPOKE_OUT*s2));
    }
  });
  return out;
}

// ── YÖN GÜLÜNÜN YERİ — kullanıcı taşıyabilir ───────────────────────────────
// Varsayılan yer sağ alt köşe ve o hâlde şemadan 54 px'lik bir SAĞ ŞERİT
// ayrılır (yoksa gül kayışın üstüne düşerdi). Kullanıcı gülü kendi eliyle bir
// boşluğa taşıdığında o şerit ARTIK AYRILMAZ — kartı daraltmanın önündeki en
// büyük engel oydu: 420 px'lik kartın 54 px'i, yani sekizde biri, yalnız dört
// sayı için duruyordu. Taşıma bir TERCİH bildirimi olduğu için yer açmayı da
// kullanıcıya devrediyor.
//
// Konum KESİR olarak saklanır (kart ölçüsünün oranı), piksel olarak değil:
// kart yeniden boyutlandırılınca gül aynı bağıl yerde kalır. Piksel saklansaydı
// kart daraldığı anda gül çerçevenin dışında kalırdı — kullanıcının asıl yapmak
// istediği şey tam olarak daraltmak.
var VE_FEAD_ROSE_W    = 54;   // varsayılan konumda ayrılan sağ şerit
var VE_FEAD_ROSE_HALF = 27;   // gülün merkezden dışa taşan yarı-genişliği
function veFeadCompassPlace(W, H, pos){
  var m = VE_FEAD_ROSE_HALF + 2;
  var fx = pos ? Number(pos.fx) : NaN, fy = pos ? Number(pos.fy) : NaN;
  if(!Number.isFinite(fx) || !Number.isFinite(fy))
    return { cx: W - VE_FEAD_ROSE_W/2 - 4, cy: H - VE_FEAD_ROSE_W/2 - 8, moved: false };
  // Kenetleme: gül her hâlükârda çerçevenin İÇİNDE kalır. Kart gülden de küçükse
  // (aşırı daraltma) merkeze oturur — yarısı dışarıda bir gül hiçbir şey demez.
  return {
    cx: (W < 2*m) ? W/2 : Math.min(Math.max(fx * W, m), W - m),
    cy: (H < 2*m) ? H/2 : Math.min(Math.max(fy * H, m), H - m),
    moved: true
  };
}

// Fare noktasını SVG kullanıcı birimine çevir. Birincil yol getScreenCTM:
// kartın kutusu ile viewBox'ı aynı en-boy oranında olsa da (letterbox yok),
// tuval ZOOM'lu olabiliyor ve CTM onu da kapsıyor. Kutu oranı yalnız yedek.
function _feadSvgPoint(svg, e){
  if(!svg || !e) return null;
  try {
    var m = svg.getScreenCTM && svg.getScreenCTM();
    if(m){
      if(typeof DOMPoint === 'function')
        return new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse());
      if(svg.createSVGPoint){
        var sp = svg.createSVGPoint(); sp.x = e.clientX; sp.y = e.clientY;
        return sp.matrixTransform(m.inverse());
      }
    }
  } catch(err){ /* yedeğe düş */ }
  try {
    var rc = svg.getBoundingClientRect(), vb = svg.viewBox.baseVal;
    if(rc.width > 0 && rc.height > 0)
      return { x: (e.clientX - rc.left) / rc.width * vb.width,
               y: (e.clientY - rc.top)  / rc.height * vb.height };
  } catch(err2){ /* yok */ }
  return null;
}

// Gülü sürükle. Sürükleme boyunca DOM'a yalnız bir transform yazılır; kart
// ANCAK BIRAKILDIĞINDA yeniden kurulur. Her mousemove'da saveState çağırmak
// hem yirmi kat gereksiz çizim hem de undo yığınına yüzlerce ara adım demekti.
//
// mousedown DURDURULUR: kart bir kanvas düğümünün içinde ve düğüm mousedown ile
// sürüklenmeye başlıyor — durdurulmazsa gülü taşımaya çalışmak düğümü taşırdı
// (konum seçicisindeki kuralın aynısı).
function veFeadCompassDragStart(evt, nodeId){
  if(typeof document === 'undefined' || !evt) return false;
  if(evt.stopPropagation) evt.stopPropagation();
  if(evt.preventDefault) evt.preventDefault();
  var g = evt.currentTarget || evt.target;
  while(g && !(g.getAttribute && g.getAttribute('data-ve') === 'compass-group')) g = g.parentNode;
  if(!g) return false;
  var svg = g.ownerSVGElement;
  var vb = svg && svg.viewBox && svg.viewBox.baseVal;
  var bas = _feadSvgPoint(svg, evt);
  if(!bas || !vb || !(vb.width > 0) || !(vb.height > 0)) return false;

  var cx0 = parseFloat(g.getAttribute('data-cx')), cy0 = parseFloat(g.getAttribute('data-cy'));
  if(!Number.isFinite(cx0) || !Number.isFinite(cy0)) return false;
  var son = { x: cx0, y: cy0 }, tasindi = false;

  function tasi(e){
    var p = _feadSvgPoint(svg, e);
    if(!p) return;
    if(Math.abs(p.x - bas.x) > 1 || Math.abs(p.y - bas.y) > 1) tasindi = true;
    // Kenetleme sürükleme SIRASINDA uygulanır: bırakıldıktan sonra "gül nereye
    // gitti" sorusu doğmasın, kullanıcı sınırı çekerken görsün.
    var yer = veFeadCompassPlace(vb.width, vb.height, {
      fx: (cx0 + (p.x - bas.x)) / vb.width,
      fy: (cy0 + (p.y - bas.y)) / vb.height
    });
    son = { x: yer.cx, y: yer.cy };
    g.setAttribute('transform', 'translate(' + _feadR(son.x - cx0) + ',' + _feadR(son.y - cy0) + ')');
  }
  function birak(){
    document.removeEventListener('mousemove', tasi, true);
    document.removeEventListener('mouseup', birak, true);
    // HAREKETSİZ TIK HİÇBİR ŞEY YAZMAZ. İki sebep, ikisi de ölçüldü:
    // (1) Her mouseup'ta saveState çağırmak kartı yeniden kuruyor ve ÇİFT TIK
    //     olayı, ulaşacağı öğe artık DOM'da olmadığı için hiç ateşlenmiyordu —
    //     yani sıfırlama sessizce çalışmıyordu (gerçek tarayıcıda doğrulandı).
    // (2) Gülün üstüne yapılan her tık undo yığınına boş bir adım koyardı.
    if(!tasindi) return;
    veFeadSetChoice(nodeId, 'compassPos',
      { fx: Math.round(son.x / vb.width * 1e4) / 1e4,
        fy: Math.round(son.y / vb.height * 1e4) / 1e4 });
  }
  document.addEventListener('mousemove', tasi, true);
  document.addEventListener('mouseup', birak, true);
  return true;
}

// Çift tık → varsayılan yer (ve sağ şerit geri ayrılır). Alan SİLİNİR, sabit bir
// varsayılan yazılmaz: "taşındı mı" sorusunun tek cevabı alanın varlığı olsun.
function veFeadCompassReset(nodeId){
  if(typeof nodes === 'undefined') return false;
  var node = nodes.find(function(n){ return n.id === nodeId; });
  if(!node || !node.data || !node.data.compassPos) return false;
  delete node.data.compassPos;
  if(typeof saveState === 'function') saveState();
  if(typeof showNodeProperties === 'function') showNodeProperties(node);
  return true;
}

// ════════════════════════════════════════════════════════════════════════════
//  KAYIŞ YOLU (2D ŞEMA) — ARTIK ÇEKİRDEĞİN GEOMETRİSİYLE
// ════════════════════════════════════════════════════════════════════════════
// Şema, kayış çevresini KENDİ hesaplamaz: FEADCore.solveGeometry'nin ürettiği
// teğet noktalarını ve sarım yaylarını çizer. Fark önemsiz değil — çekirdek
// temas tarafına göre İŞARETLİ yarıçap kullanır, yani sırttan temas eden
// kasnakta kayış ters yönde sarar. Kendi çizimimiz bunu bilmiyordu ve AG00686'da
// sarım açılarını 37°'ye kadar yanlış veriyordu (bkz. dosya başındaki emeklilik
// notu). Ayrıca çekirdek çakışma ve sarım değişmezi denetimi de yapıyor:
// çözülemeyen bir yerleşim artık YANLIŞ ÇİZİM yerine AÇIK HATA veriyor.
//
// Ölçek: mm → görünüm. Kayış düzleminde +Y YUKARI (mühendislik çizimi),
// SVG'de y aşağı → çevrilir.
// opts:
//   .compass  yön gülü (0/90/180/270) — kayış düzleminin yönü
//   .pivot    gergi pivotunda artı + pivottan kasnak merkezine kol çizgisi
//   .arrows   her kasnakta dönüş yönü oku
//   .inline   kanvas kartı için: dış çerçeve/arkaplan yok, boy %100
// Varsayılan (opts verilmezse) hepsi AÇIK: tedarikçi sayfasının çıktısı da bu
// işaretleri taşıyor ve panelde de aynı dili konuşmak doğrusu.
function veFeadLayoutSVG(build, W, H, opts){
  W = W || 320; H = H || 240;
  opts = opts || {};
  var wantCompass = (opts.compass !== false);
  var wantPivot   = (opts.pivot   !== false);
  var wantArrows  = (opts.arrows  !== false);
  if(!build || !build.ok || !build.sys || typeof FEADCore === 'undefined') return null;

  // HANGİ KOL KONUMU / KONUMLARI. Gergi kolu yay dengesinde duruyor; kayış
  // uzayıp kısaldıkça (tolerans + aşınma) kol dönüyor ve kayış yolu her konumda
  // BAŞKA bir eğri oluyor. Seçim model katmanında çözülür (veFeadPosSelection);
  // burada yalnız çizim var.
  var sel = (typeof veFeadPosSelection === 'function')
    ? veFeadPosSelection(build, opts.posMode || 'mean')
    : { primary: null, ghosts: [] };

  // ÇÖZÜCÜ HATASI YUTULMAZ. Kurulum geçerli olsa bile geometri çözülemeyebilir
  // (kayış hedef boyu erişilebilir aralığın dışında, kol sınıra dayandı…) ve
  // eskiden bu durumda kart yalnız "Kayış yolu henüz kurulamadı" diyordu —
  // yani kullanıcı NEDEN olduğunu göremiyordu. Sebep build üzerinde taşınıyor;
  // kart ve panel onu basıyor.
  function geomAt(rel){
    try { return FEADCore.tensionerState(build.sys, rel).geom; }
    catch(e){
      if(!build.geomError)
        build.geomError = (typeof veFeadTranslateError === 'function')
          ? veFeadTranslateError(e && e.message) : String(e && e.message || e);
      return null;
    }
  }
  var geom = sel.primary ? geomAt(sel.primary.relDeg) : null;
  if(!geom){                                     // konum tablosu kurulamadıysa
    geom = geomAt(FEADCore.meanRel ? FEADCore.meanRel(build.sys) : 0);
  }
  if(!geom) return null;

  // Hayalet konumların geometrisi (yalnız 'TÜMÜ' kipinde dolu).
  var hayalet = [];
  (sel.ghosts || []).forEach(function(r){
    var g = geomAt(r.relDeg);
    if(g) hayalet.push({ row: r, geom: g });
  });

  var ps = geom.pulleys;
  var minX=Infinity, maxX=-Infinity, minY=Infinity, maxY=-Infinity;
  function sinirla(list){
    list.forEach(function(p){
      minX=Math.min(minX,p.c[0]-p.rPitch); maxX=Math.max(maxX,p.c[0]+p.rPitch);
      minY=Math.min(minY,p.c[1]-p.rPitch); maxY=Math.max(maxY,p.c[1]+p.rPitch);
    });
  }
  sinirla(ps);
  // HAYALETLER DE ÖLÇEĞE GİRER: gergi kasnağı konumlar arasında BMC'de 60 mm yol
  // alıyor. Sınırlara katılmazsa uç konumdaki daire çerçeveden taşar.
  hayalet.forEach(function(h){ sinirla(h.geom.pulleys); });
  // GERGİ PİVOTU DA ÖLÇEĞE GİRER: pivot çoğu düzende kasnak kümesinin dışında
  // kalıyor (BMC'de −259.94 mm, en soldaki kasnaktan 20 mm daha solda). Sınırlara
  // katılmazsa artı işareti çerçevenin dışına düşüp görünmez olur.
  var pv = wantPivot && build.sys.tensioner && build.sys.tensioner.pivot;
  if(pv){
    minX=Math.min(minX,pv[0]); maxX=Math.max(maxX,pv[0]);
    minY=Math.min(minY,pv[1]); maxY=Math.max(maxY,pv[1]);
  }
  // Yön gülü sağ altta yer istiyor; şema onun altına girmesin.
  var pad = 18;
  // Gül varsayılan yerindeyse sağ şerit ayrılır; kullanıcı taşımışsa şerit
  // ŞEMAYA bırakılır (bkz. veFeadCompassPlace).
  var roseYer = wantCompass ? veFeadCompassPlace(W, H, opts.compassPos) : null;
  var ROSE = (roseYer && !roseYer.moved) ? VE_FEAD_ROSE_W : 0;
  var spanX = Math.max(1, maxX-minX), spanY = Math.max(1, maxY-minY);
  var s, offX, offY;
  function olcekle(padL, padR, padU, padD){
    var eW = W - padL - padR - ROSE, eH = H - padU - padD;
    s = Math.min(eW/spanX, eH/spanY);
    offX = padL + (eW - spanX*s)/2; offY = padU + (eH - spanY*s)/2;
  }
  olcekle(pad, pad, pad, pad);

  // ── ETİKET GENİŞLİĞİ DE ÖLÇEĞE GİRER ───────────────────────────────────
  // Kasnak adı merkezde ORTALANIR; "Alternatör (155 A)" 18 karakter, 9 px
  // yazıda ≈97 px, yani merkezden ±49 px. Küme kenara yakınsa ad çerçevenin
  // DIŞINA taşar — ÖLÇÜLDÜ (özet rapor, sayfa 1): 9 px dışarıda ve kırpılmış.
  // Sınır kutusu yalnız çemberleri sardığı için hata sayılardan görünmez,
  // yalnız çizimden; Şekil 1'de düzeltilen sınıfın aynısı.
  //
  // Ölçek ile etiket genişliği BİRBİRİNE BAĞLI (etiket px, sınır mm; ikisini
  // çözen `s`'nin kendisi sınırdan geliyor) → tek geçişte çözülemez. İKİ GEÇİŞ:
  // önce ölçek, sonra taşan payı kadar kenar payı büyütülüp yeniden ölçek.
  // İkinci geçiş `s`'yi küçültür, yani etiketler daha da daralır — yakınsama
  // tek adımda garanti.
  // GÖRÜNEN AD ÇAĞIRANDAN GELEBİLİR. Kanvas kartında tam ad okunur (kutu 420
  // px ve kullanıcı zaten kasnağı adıyla tanıyor); RAPORDA aynı ad şemayı
  // taşırıyor ve kayış yolunun üstüne biniyor — ÖLÇÜLDÜ: "Alternatör (155 A)"
  // çerçeveyi 10,4 px aşıyor, dört etiket kayışla çakışıyordu. Rapor kısa kodu
  // geçiyor; kod ↔ ad künyesi aynı sayfada duruyor.
  function gorAd(k){
    var a = opts.names && opts.names[k];
    return (a == null || a === '') ? geom.names[k] : String(a);
  }
  var etW = (typeof opts.labelWidth === 'function') ? opts.labelWidth : function(t, fs){
    return String(t == null ? '' : t).length * fs * 0.6;      // monospace/dar sans
  };
  (function(){
    var solTas = 0, sagTas = 0, ustTas = 0;
    ps.forEach(function(p, k){
      var X = offX + (p.c[0] - minX) * s, Y = offY + (maxY - p.c[1]) * s;
      var R = p.rPitch * s, yari = etW(gorAd(k), 9) / 2;
      solTas = Math.max(solTas, 2 - (X - yari));
      sagTas = Math.max(sagTas, (X + yari) - (W - ROSE - 2));
      ustTas = Math.max(ustTas, 11 - (Y - R - 4));            // ad, çemberin ÜSTÜNDE
    });
    if(solTas <= 0.5 && sagTas <= 0.5 && ustTas <= 0.5) return;
    // Pay sınırlı: bir etiket şemanın yarısını yiyemez.
    var tavX = W * 0.22, tavY = H * 0.14;
    olcekle(pad + Math.min(Math.max(0, solTas), tavX), pad + Math.min(Math.max(0, sagTas), tavX),
            pad + Math.min(Math.max(0, ustTas), tavY), pad);
  })();
  // ── ETİKET YERLEŞİMİ — KAYIŞ YOLU BİR ENGELDİR ─────────────────────────
  // Ad şimdiye kadar koşulsuz çemberin ÜSTÜNE konuyordu. Yerleşim dairesel
  // olduğu için kasnakların yarısında kayış tam oradan geçiyor: ÖLÇÜLDÜ
  // (AG00976, 480×420) dört etiket kayış yolunun üstüne biniyordu ve hangi
  // sayının hangi kasnağa ait olduğu okunmuyordu.
  //
  // Aday sıralaması ÜST → ALT → SAĞ → SOL: üst, teknik resimde alışılmış yer;
  // yan adaylar ancak dikey iki yer de doluysa kullanılıyor, çünkü yandaki
  // etiket komşu kasnağın alanına giriyor. İlk TEMİZ aday seçilir; hiçbiri
  // temiz değilse üste dönülür (etiket kaybolmaz, yalnız çakışır).
  var _etiket = [];
  (function(){
    var T0 = _feadXform(s, offX, offY, minX, maxY);
    var segler = [];
    (geom.spans || []).forEach(function(sp){
      segler.push([T0.tx(sp.Pi[0]), T0.ty(sp.Pi[1]), T0.tx(sp.Pj[0]), T0.ty(sp.Pj[1])]);
    });
    function kesisir(seg, r){                       // doğru parçası ↔ dikdörtgen
      var x1=seg[0], y1=seg[1], x2=seg[2], y2=seg[3];
      if(Math.max(x1,x2) < r.x0 || Math.min(x1,x2) > r.x1) return false;
      if(Math.max(y1,y2) < r.y0 || Math.min(y1,y2) > r.y1) return false;
      if((x1>=r.x0&&x1<=r.x1&&y1>=r.y0&&y1<=r.y1) || (x2>=r.x0&&x2<=r.x1&&y2>=r.y0&&y2<=r.y1)) return true;
      var dx=x2-x1, dy=y2-y1;
      function yan(x,y){ return dx*(y-y1) - dy*(x-x1); }
      var a=yan(r.x0,r.y0), b=yan(r.x1,r.y0), c=yan(r.x1,r.y1), d=yan(r.x0,r.y1);
      return !((a>0&&b>0&&c>0&&d>0) || (a<0&&b<0&&c<0&&d<0));
    }
    function ortusur(a, b){
      return !(a.x1 <= b.x0 || a.x0 >= b.x1 || a.y1 <= b.y0 || a.y0 >= b.y1);
    }
    var kutular = [];
    ps.forEach(function(p, k){
      var X = offX + (p.c[0]-minX)*s, Y = offY + (maxY-p.c[1])*s, R = p.rPitch*s;
      var w = etW(gorAd(k), 9), h = 10;
      var aday = [
        { x:X,        y:Y-R-4,      an:'middle', x0:X-w/2,  x1:X+w/2,  y0:Y-R-4-8,   y1:Y-R-4+2 },
        { x:X,        y:Y+R+11,     an:'middle', x0:X-w/2,  x1:X+w/2,  y0:Y+R+11-8,  y1:Y+R+11+2 },
        { x:X+R+5,    y:Y+3,        an:'start',  x0:X+R+5,  x1:X+R+5+w, y0:Y-5,      y1:Y+5 },
        { x:X-R-5,    y:Y+3,        an:'end',    x0:X-R-5-w, x1:X-R-5, y0:Y-5,       y1:Y+5 }
      ];
      var sec = null;
      for(var i=0;i<aday.length && !sec;i++){
        var a = aday[i];
        if(a.x0 < 1 || a.x1 > W-ROSE-1 || a.y0 < 1 || a.y1 > H-1) continue;
        var carpti = false;
        for(var j=0;j<segler.length && !carpti;j++) if(kesisir(segler[j], a)) carpti = true;
        for(var m=0;m<kutular.length && !carpti;m++) if(ortusur(kutular[m], a)) carpti = true;
        if(!carpti) sec = a;
      }
      if(!sec) sec = aday[0];
      kutular.push(sec); _etiket.push(sec);
    });
  })();

  // mm → ekran dönüşümü TEK NESNEDE (_feadXform): animatör de kare başına aynı
  // katsayıları kullanıyor. İki ayrı dönüşüm tutmak, hareket eden dişlerin
  // duran kayıştan kayması demekti.
  var T = _feadXform(s, offX, offY, minX, maxY);
  function tx(x){ return T.tx(x); }
  function ty(y){ return T.ty(y); }
  var f = _feadR;

  // Kayış yolu: çekirdeğin teğet uçları (Pi/Pj) + her kasnakta sarım yayı.
  //
  // SWEEP BAYRAĞI — bir kez YANLIŞ yazıldı, gözle "bükülmüş kayış" olarak
  // görüldü ve ölçülerek düzeltildi. Kural:
  //   ty(y) = offY + (maxY − y)·s  ölçeklemesi mm düzlemini EKRANDA AYNI YÖNDE
  //   gösterir (mm yukarısı ekran yukarısı) — yani yönelim KORUNUR, dönmez.
  //   SVG'nin açı sistemi ise y-AŞAĞI: pozitif açı yönü görsel olarak SAAT
  //   YÖNÜ demek. Dolayısıyla mm düzleminde CCW olan (d > 0) ekranda da CCW
  //   görünür ve SVG'de NEGATİF yön, yani sweep = 0.
  // Eskiden sweep = (d > 0 ? 1 : 0) yazıyordu: yarıçap ve uçlar doğru olduğu
  // için yay yine iki uca değiyordu ama AYNALANMIŞ çemberin üzerinde kalıyordu,
  // yani kasnağın İÇİNDEN geçiyordu. ÖLÇÜLDÜ (BMC örneği, 420×320): yay
  // merkezleri kasnak merkezlerinden 6.7–42.7 px sapıyordu; düzeltmeyle altı
  // kasnakta da sapma 0.00. Testi bu değişmezi kilitliyor (yayın merkezi
  // kasnağın merkezi olmak ZORUNDA).
  //
  // TEK FONKSİYON: hayalet konumlar da aynı yoldan çizilir, yoksa iki ayrı
  // çizici sessizce ayrışırdı.
  function beltPath(g){
    var q = g.pulleys, n = q.length, d = '';
    for(var i=0;i<n;i++){
      var sp = g.spans[i], p = q[(i+1)%n], spN = g.spans[(i+1)%n];
      if(i === 0) d += 'M' + f(tx(sp.Pi[0])) + ' ' + f(ty(sp.Pi[1]));
      d += ' L' + f(tx(sp.Pj[0])) + ' ' + f(ty(sp.Pj[1]));
      var R = f(p.rPitch * s), wrap = g.wraps[(i+1)%n];
      d += ' A' + R + ' ' + R + ' 0 ' + (wrap > Math.PI ? 1 : 0) + ' ' + (p.d > 0 ? 0 : 1)
         + ' ' + f(tx(spN.Pi[0])) + ' ' + f(ty(spN.Pi[1]));
    }
    return d + ' Z';
  }
  // ── KAYIŞIN KABURGALI YÜZÜ — hangi kasnağa hangi yüzüyle değiyor ────────
  // Temas tarafı bu modülün en pahalı sessiz hatası: ters verilirse çekirdek
  // GEÇERLİ ama BAŞKA bir güzergâh çözer, hata vermez. Şemada bunu şimdiye
  // kadar yalnız kasnağın kesikli çemberi söylüyordu — bir UZLAŞIM, yani
  // öğrenilmesi gereken bir kod. Oysa fark gerçek ve çizilebilir: kayışın bir
  // yüzü kaburgalı, öbürü düz sırt. Diş sırası o yüzü işaretler; kaburgalı
  // yüze değen kasnakta dişler kasnağın İÇİNE, sırttan temas edende DIŞARI
  // bakar. Kullanıcı artık kodu değil parçayı görüyor.
  //
  // Yön TEK BİR YERDEN çözülür ve sabittir: kayış kendi yüzlerini yol boyunca
  // değiştiremez. mm düzleminde ilerleme yönü u iken kaburgalı yüz normali
  // rot90ccw(u)/sense'tir (sense = çevrimin dönüş yönü, çekirdekten gelir).
  // Türetme: kaburgalı bir kasnakta d = +sense ve teğet u = d·(−sinθ, cosθ)
  // olduğundan rot90ccw(u) = d·(−cosθ, −sinθ) = d · (merkeze doğru).
  // Sırttan temas edende d = −sense, dolayısıyla aynı normal kasnaktan UZAĞA
  // bakar — istenen tam olarak bu.
  //
  // Diş sırasının kendisi dosyanın üstündeki _feadTeethPath'te: ANİMATÖR DE
  // aynı fonksiyondan besleniyor, yani hareket eden kayışla duran kayış tek
  // çiziciden çıkıyor. Adım, çevreyi tam bölecek şekilde yuvarlanır
  // (_feadToothStep) — donuk şemada görünmeyen kapanış artığı, faz ilerlerken
  // sabit bir noktada duran tek bir tökezleme olarak okunurdu.
  var walk = _feadBeltWalk(geom);
  var stepMm = _feadToothStep(walk.l, 7/s), toothMm = 3.2/s;

  var d = beltPath(geom);

  // ── ANİMASYON YÜKÜ — animatörün kare başına ihtiyaç duyduğu HER ŞEY ──────
  // Kart her saveState()'te innerHTML ile BAŞTAN kuruluyor (alan değişti,
  // bağlantı kuruldu, düğüm silindi…). Animatör bu yüzden DOM'da durum tutmaz:
  // her karede öğeyi bulur ve bu yükü okur, dolayısıyla yeniden kurulma
  // zararsızdır. Yük yalnız SAYIDIR — dönüşüm katsayıları, kayış zinciri (mm)
  // ve ekrandaki hız; geometriyi kare başına yeniden çözmek çözücüyü 60 Hz
  // koşturmak olurdu.
  var animPay = null;
  if(opts.animate && opts.animate.dispMmS > 0){
    var r4 = function(v){ return Math.round(v*1e4)/1e4; };
    animPay = {
      s: r4(s), ox: r4(offX), oy: r4(offY), mx: r4(minX), my: r4(maxY),
      step: r4(stepMm), tooth: r4(toothMm), sense: (geom.sense < 0 ? -1 : 1),
      loop: r4(walk.l), mmS: r4(opts.animate.dispMmS),
      segs: walk.segs.map(function(sg){
        return (sg.a === 0)
          ? { a:0, x:r4(sg.x), y:r4(sg.y), ux:r4(sg.ux), uy:r4(sg.uy), l:r4(sg.l) }
          : { a:1, cx:r4(sg.cx), cy:r4(sg.cy), r:r4(sg.r), a0:r4(sg.a0), d:sg.d, l:r4(sg.l) };
      })
    };
  }
  // JSON yalnız sayı ve sabit anahtar taşıdığı için tek tırnaklı attribute
  // içinde güvenli (içinde tek tırnak geçemez).
  var animAttr = animPay
    ? " data-fead-anim='" + JSON.stringify(animPay) + "'"
      + (opts.nodeId ? ' data-fead-node="' + _feadEsc(opts.nodeId) + '"' : '')
    : '';

  // ÖLÇÜ SINIRI ŞART: panel iki sütuna geçtiğinde (VE_WIDE_PANEL_TYPES) yalnız
  // width:100% veren bir viewBox'lı SVG en-boy oranıyla birlikte YÜKSELİR ve
  // pencerenin altından taşarak kırpılır (ölçüldü). max-width bunu keser.
  var kabuk = opts.inline
    ? '<svg' + animAttr + ' viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="xMidYMid meet" style="display:block; width:100%; height:100%;">'
    : '<svg' + animAttr + ' viewBox="0 0 ' + W + ' ' + H + '" width="100%" style="display:block; width:100%; max-width:'
      + W + 'px; margin:0 auto; background:var(--bg-input); border:1px solid var(--border-color); border-radius:var(--radius-sm);">';
  var svg = kabuk;

  // GERGİ KOLU: pivot → kasnak merkezi. Kol boyu ve montaj açısı bu çizgi;
  // yanlış girilmiş bir pivot burada gözle görünür (kol kayışa ters uzanır).
  if(pv){
    var ti = build.sys._tenIdx;
    var tp = (ti >= 0 && ps[ti]) ? ps[ti] : null;
    if(tp){
      svg += '<line data-ve="arm" x1="' + f(tx(pv[0])) + '" y1="' + f(ty(pv[1])) + '" x2="' + f(tx(tp.c[0]))
          + '" y2="' + f(ty(tp.c[1])) + '" stroke="var(--accent-success)" stroke-width="1.6"'
          + ' stroke-dasharray="5 3" opacity="0.85"/>';
    }
    var px = f(tx(pv[0])), py = f(ty(pv[1])), a = 6;
    svg += '<g data-ve="pivot" stroke="var(--accent-success)" stroke-width="1.8">'
        + '<line x1="' + f(px-a) + '" y1="' + py + '" x2="' + f(px+a) + '" y2="' + py + '"/>'
        + '<line x1="' + px + '" y1="' + f(py-a) + '" x2="' + px + '" y2="' + f(py+a) + '"/></g>';
  }

  // HAYALET KONUMLAR — ana yolun ARKASINDA, ince ve soluk. Referans tedarikçi
  // çıktısındaki üst üste binmiş kayış yolları bunlar: kolun gezdiği aralık.
  var tiG = build.sys._tenIdx;
  hayalet.forEach(function(h){
    svg += '<path data-ve="belt-ghost" d="' + beltPath(h.geom) + '" fill="none"'
        + ' stroke="var(--text-muted)" stroke-width="1.1" stroke-linejoin="round" opacity="0.5"/>';
    var gp = (tiG >= 0) ? h.geom.pulleys[tiG] : null;
    if(gp){
      var GX = f(tx(gp.c[0])), GY = f(ty(gp.c[1])), GR = f(gp.rPitch*s);
      svg += '<circle data-ve="pulley-ghost" cx="' + GX + '" cy="' + GY + '" r="' + GR
          + '" fill="none" stroke="var(--text-muted)" stroke-width="1.1"'
          + ' stroke-dasharray="3 3" opacity="0.6"/>'
        + '<circle cx="' + GX + '" cy="' + GY + '" r="1.4" fill="var(--text-muted)" opacity="0.7"/>';
      // ETİKET PİVOTTAN DIŞA DOĞRU. Konumlar pivot çevresinde bir YAY üzerinde
      // dizildiği için radyal yerleşim onları kendiliğinden yelpazeler; sabit
      // "solda" yerleşimde üç etiket üst üste biniyordu (ölçüldü — gergi bu
      // düzende yalnız ~25 px yol alıyor).
      var lx = GX - GR - 4, ly = GY + 3, anc = 'end';
      if(pv){
        var vx = tx(gp.c[0]) - tx(pv[0]), vy = ty(gp.c[1]) - ty(pv[1]);
        var vl = Math.sqrt(vx*vx + vy*vy);
        if(vl > 1){
          lx = f(tx(gp.c[0]) + vx/vl * (gp.rPitch*s + 10));
          ly = f(ty(gp.c[1]) + vy/vl * (gp.rPitch*s + 10) + 2.5);
          anc = (vx >= 0) ? 'start' : 'end';
        }
      }
      // HAYALET ETİKETİ KAPATILABİLİR. Kanvas kartında gerekli: orada kolun
      // hangi konumda olduğunu söyleyen başka bir yüzey yok. RAPORDA gereksiz
      // ve zararlı — konumların adı zaten hemen yanındaki tabloda, 395 px'lik
      // küçük bir şemada ise altı etiket üst üste biniyor (ÖLÇÜLDÜ: "Serbest"
      // ile "Değişt." 104 px² çakışıyordu). Tedarikçi çıktısı da zarfı
      // etiketsiz çiziyor.
      if(opts.ghostLabels !== false)
        svg += '<text data-ve="ghost-label" x="' + lx + '" y="' + ly
            + '" text-anchor="' + anc + '" font-size="7" fill="var(--text-muted)" opacity="0.9">'
            + _feadEsc(h.row.kisa) + '</text>';
    }
  });

  svg += '<path data-ve="belt" d="' + d + '" fill="none" stroke="var(--accent-warning)" stroke-width="2.6" stroke-linejoin="round"/>';
  // Dişler kayışın ÜSTÜNE çizilir (yolun kendisi altta kalsın) ve YALNIZ ana
  // konumda: hayalet yollarda diş sırası okunmaz, yalnız gürültü olurdu.
  svg += '<path data-ve="rib" d="' + _feadTeethPath(walk, geom.sense, stepMm, toothMm, 0, T) + '" fill="none"'
      + ' stroke="var(--accent-warning)" stroke-width="1" stroke-linecap="round" opacity="0.9">'
      + '<title>Kayışın kaburgalı yüzü — dişler bu yüzün baktığı tarafı gösterir</title></path>';
  svg += '<text data-ve="rib-legend" x="' + f(pad - 6) + '" y="' + f(H - 5) + '" font-size="7"'
      + ' fill="var(--text-muted)">dişli kenar = kayışın kaburgalı yüzü</text>';

  ps.forEach(function(p, k){
    var def = build.order[k] ? _feadDefOf(build.order[k]) : {};
    var isDrv = !!(build.sys.pulleys[k] && build.sys.pulleys[k].crank);
    var col = isDrv ? 'var(--accent-primary)' : (def.isFeadTensioner ? 'var(--accent-success)' : 'var(--text-secondary)');
    var X = f(tx(p.c[0])), Y = f(ty(p.c[1])), R = f(p.rPitch*s);
    svg += '<circle data-ve="pulley" cx="' + X + '" cy="' + Y + '" r="' + R + '" fill="none" stroke="' + col
        + '" stroke-width="2"' + (p.contact === 'back' ? ' stroke-dasharray="4 3"' : '') + '/>';
    svg += '<circle cx="' + X + '" cy="' + Y + '" r="2.2" fill="' + col + '"/>';

    // KASNAK KOLLARI — yalnız animasyonlu kartta. Kasnağın rol rengini taşırlar
    // (çemberle aynı), çünkü söyledikleri şey o kasnağın kendi hareketi.
    // data-arc: animatör bu yolun HANGİ sarım yayına ait olduğunu buradan okur;
    // DOM sırasına güvenmek, küçük kasnakta kol çizilmediği durumda kayardı.
    if(animPay){
      var arcIdx = (k + ps.length - 1) % ps.length;
      svg += '<path data-ve="spoke" data-arc="' + arcIdx + '" d="'
          + _feadSpokePath(walk, 0, T, arcIdx) + '" fill="none" stroke="' + col
          + '" stroke-width="1.4" stroke-linecap="round" opacity="0.9"/>';
    }

    // DÖNÜŞ YÖNÜ OKU — kasnağın içinde, yarıçapın %55'inde bir yay + uç oku.
    // Tedarikçi çıktısındaki dönüş okunun karşılığı: bütün kasnaklar aynı yöne
    // dönmüyorsa (sırttan temas) bu gözle görünür.
    // YÖN: d > 0 mm düzleminde CCW, yerleşim yönelimi korunduğu için ekranda da
    // CCW — yani SAAT YÖNÜNÜN TERSİ. Bu da bir kez ters yazılmıştı (kayış
    // yayıyla aynı hata); ok kasnağın gerçek dönüşünün tersini gösteriyordu.
    // Animasyon açıkken ok ÇİZİLMEZ: dönüş yönünü artık kolların kendisi
    // gösteriyor ve iki işaret üst üste binerdi (ok 0.55R'de, kollar 0.26–0.86R).
    if(wantArrows && !animPay && R > 9){
      var rr = R * 0.55, cw = (p.d < 0);
      var a0 = cw ? -2.3 : -0.85, a1 = cw ? 0.85 : 2.3;
      var x0 = X + rr*Math.cos(a0), y0 = Y + rr*Math.sin(a0);
      var x1 = X + rr*Math.cos(a1), y1 = Y + rr*Math.sin(a1);
      svg += '<path data-ve="spin" d="M' + f(x0) + ' ' + f(y0) + ' A' + f(rr) + ' ' + f(rr) + ' 0 1 '
          + (cw ? 1 : 0) + ' ' + f(x1) + ' ' + f(y1) + '" fill="none" stroke="' + col
          + '" stroke-width="1.2" opacity="0.75"/>';
      var tng = a1 + (cw ? Math.PI/2 : -Math.PI/2), hb = 3.6;
      svg += '<path d="M' + f(x1) + ' ' + f(y1)
          + ' L' + f(x1 - hb*Math.cos(tng - 0.4)) + ' ' + f(y1 - hb*Math.sin(tng - 0.4))
          + ' L' + f(x1 - hb*Math.cos(tng + 0.4)) + ' ' + f(y1 - hb*Math.sin(tng + 0.4))
          + ' Z" fill="' + col + '" opacity="0.75"/>';
    }

    var et = _etiket[k] || { x: X, y: Y - R - 4, an: 'middle' };
    svg += '<text x="' + f(et.x) + '" y="' + f(et.y) + '" text-anchor="' + et.an
        + '" font-size="9" fill="var(--text-muted)">' + _feadEsc(gorAd(k)) + '</text>';
    // SARIM AÇISI ŞEMADA İKİNCİ KEZ YAZILIR. Kanvasta bunun karşılığı var:
    // orada tablo YOK, kart tek başına duruyor. Raporda aynı altı sayı bir
    // sonraki sayfada hizalı ve iki ondalıkla basılıyor; şemada ise kayış
    // yolunun üstüne düşüyor (ölçüldü: dört çakışmanın ikisi bu etiketten).
    if(opts.wrapLabels !== false)
      svg += '<text x="' + X + '" y="' + f(Y + R + 10) + '" text-anchor="middle" font-size="8" fill="var(--accent-warning)">'
          + f(geom.wrapDeg(k)) + '°</text>';
  });

  // SEÇİLİ KONUMUN KÜNYESİ — sol üstte. "Hangi konumu görüyorum" sorusu şemanın
  // kendi içinde cevaplanmalı; kip seçicisi kartın altında, çizimin dışında.
  if(sel.primary){
    svg += '<text data-ve="pos-label" x="' + f(pad - 6) + '" y="12" font-size="8.5"'
        + ' fill="var(--accent-warning)">' + _feadEsc(sel.primary.label)
        + '  ·  kol ' + f(sel.primary.relDeg) + '°'
        + (Number.isFinite(sel.primary.tensionN) ? '  ·  ' + Math.round(sel.primary.tensionN) + ' N' : '')
        + '</text>';
    // ANİMASYON KÜNYESİ. Ağır çekim katsayısı GİZLENMEZ: ekranda gördüğü hız
    // gerçek hız değil, oranlar gerçek — bu ayrım yazılı olmazsa kullanıcı
    // ekrandan devir okumaya kalkar.
    var y2 = 22;
    if(animPay && opts.animate.label){
      svg += '<text data-ve="anim-label" x="' + f(pad - 6) + '" y="22" font-size="7.5"'
          + ' fill="var(--text-secondary)">' + _feadEsc(opts.animate.label) + '</text>';
      y2 = 32;
    }
    if(hayalet.length)
      svg += '<text x="' + f(pad - 6) + '" y="' + y2 + '" font-size="7" fill="var(--text-muted)">'
          + hayalet.length + ' konum daha (soluk) — kolun gezdiği aralık</text>';
  }

  // YÖN GÜLÜ — sağ altta, tedarikçi çıktısındaki gibi. Kayış düzleminin açı
  // konvansiyonu: 0° = +x, açılar CCW. Bu olmadan "montaj açısı −3.18°" gibi
  // bir sayının hangi yöne baktığı okunamıyor.
  if(wantCompass){
    var cx = f(roseYer.cx), cy = f(roseYer.cy), r = VE_FEAD_ROSE_W/2 - 15;
    // TAŞIMA KANCASI yalnız düğüm kimliği verilmişse kurulur: rapor ve dışa
    // aktarma aynı çiziciyi kullanıyor, oralarda sürüklenecek bir şey yok.
    // Şeffaf dikdörtgen TUTAMAK: gül ince çizgilerden ibaret, 1 px'lik bir
    // çizgiyi yakalamaya çalışmak sürüklemeyi kullanılamaz yapardı.
    var tut = opts.nodeId
      ? ' style="cursor:move;" onmousedown="veFeadCompassDragStart(event,\'' + _feadEsc(opts.nodeId) + '\')"'
        + ' ondblclick="event.stopPropagation(); veFeadCompassReset(\'' + _feadEsc(opts.nodeId) + '\')"'
      : '';
    svg += '<g data-ve="compass-group" data-cx="' + cx + '" data-cy="' + cy + '"' + tut + '>';
    if(opts.nodeId)
      svg += '<rect x="' + f(cx - VE_FEAD_ROSE_HALF) + '" y="' + f(cy - VE_FEAD_ROSE_HALF) + '" width="'
          + (2*VE_FEAD_ROSE_HALF) + '" height="' + (2*VE_FEAD_ROSE_HALF) + '" fill="transparent">'
          + '<title>Yön gülü — sürükle ile taşınır, çift tık varsayılan yerine döndürür</title></rect>';
    svg += '<g data-ve="compass" stroke="var(--text-muted)" stroke-width="1" fill="none">'
        + '<circle cx="' + f(cx) + '" cy="' + f(cy) + '" r="' + f(r) + '"/>'
        + '<line x1="' + f(cx-r-4) + '" y1="' + f(cy) + '" x2="' + f(cx+r+4) + '" y2="' + f(cy) + '"/>'
        + '<line x1="' + f(cx) + '" y1="' + f(cy-r-4) + '" x2="' + f(cx) + '" y2="' + f(cy+r+4) + '"/></g>';
    var et = [['0', cx+r+7, cy+3, 'start'], ['90', cx, cy-r-7, 'middle'],
              ['180', cx-r-7, cy+3, 'end'], ['270', cx, cy+r+11, 'middle']];
    et.forEach(function(t){
      svg += '<text x="' + f(t[1]) + '" y="' + f(t[2]) + '" text-anchor="' + t[3]
          + '" font-size="7" fill="var(--text-muted)">' + t[0] + '</text>';
    });
    // CCW yönünü gösteren küçük yay (0°'den 90°'ye).
    svg += '<path d="M' + f(cx + r*0.6) + ' ' + f(cy) + ' A' + f(r*0.6) + ' ' + f(r*0.6)
        + ' 0 0 0 ' + f(cx) + ' ' + f(cy - r*0.6) + '" fill="none" stroke="var(--text-muted)" stroke-width="0.9"/>'
        + '<path d="M' + f(cx) + ' ' + f(cy - r*0.6) + ' l2.6 2.4 l-3.4 1.1 Z" fill="var(--text-muted)"/>';
    svg += '</g>';
  }
  return svg + '</svg>';
}

// ════════════════════════════════════════════════════════════════════════════
//  KANVAS KARTI: CANLI KAYIŞ YOLU ŞEMASI
// ════════════════════════════════════════════════════════════════════════════
// Kayış Yolu düğümü tuvalin üstünde ÇİZİM olarak durur — panel açmak gerekmez.
// Neden kanvasta: kullanıcı koordinat, çap, temas tarafı ve gergi girdilerini
// yazarken modelin GERÇEKTEN kapanıp kapanmadığını anında görmeli. Topoloji
// grafiği (düğüm-bağlantı) kayışın SIRASINI gösteriyor ama ŞEKLİNİ göstermiyor;
// üst üste binen iki kasnak, ters temas tarafı ya da yanlış işaretli bir
// koordinat orada fark edilmiyor. Bu kart o boşluğu kapatıyor.
//
// Şema, düğümlerin KANVASTAKİ yerinden değil, kasnakların kayış düzlemindeki
// (mm) koordinatlarından çizilir — düğümü sürüklemek şemayı değiştirmez.
//
// Stil ELEMANIN ÜSTÜNDE (css/ dosyasında değil): css/styles.css'e dokunmak
// Ölçüm Görüntüleyici'nin dağıtım dosyasını bayatlatıyor (bkz. CLAUDE.md) ve
// tek bir kart için o zinciri kurmaya değmez. Rozette de aynı gerekçe var.
var VE_FEAD_CARD_CLASS = 've-fead-layout-card';

function veFeadApplyLayoutCard(nodeEl, node){
  if(!nodeEl || !node || typeof document === 'undefined') return false;
  if(!_feadDefOf(node).isFeadLayout) return false;
  var box = nodeEl.querySelector('.ve-node-box') || nodeEl;

  // Kart bir kez kurulur, İÇİ tazelenir. Yeniden kurmak her tazelemede
  // düğümün sembolünü ve etiketini yeniden taşımak olurdu.
  var card = box.querySelector('.' + VE_FEAD_CARD_CLASS);
  if(!card){
    card = document.createElement('div');
    card.className = VE_FEAD_CARD_CLASS;
    card.style.cssText = 'position:absolute; inset:0; display:flex; flex-direction:column;'
      + 'overflow:hidden; border-radius:inherit; background:var(--bg-input, #0f1115);';
    // Tuvaldeki sembol kartın arkasında kalmasın (düğüm kutusu kendi SVG'sini
    // ortada gösteriyor); şema onun yerini alır.
    var sym = box.querySelector(':scope > svg');
    if(sym) sym.style.display = 'none';
    box.appendChild(card);
  }
  card.innerHTML = veFeadLayoutCardHTML(node);
  // Kart animasyon yükü taşıyorsa döngü buradan uyanır. Döngü zaten dönüyorsa
  // no-op; kart durgunsa (yük yok) bir sonraki karede kendi kendine durur.
  if(typeof veFeadAnimEnsure === 'function') veFeadAnimEnsure();
  return true;
}

// Kartın içeriği — AYRI ve SAF(ça) tutuluyor ki test HTML'e bakabilsin.
function veFeadLayoutCardHTML(node){
  var build = (typeof veFeadBuildFromCanvas === 'function') ? veFeadBuildFromCanvas() : null;
  // Ölçü düğümden, yoksa TİP TANIMINDAN (componentDefs.defaultWidth) okunur —
  // sabitin kendisi js/components.js'te ve orada tek kopya. Buradan bare global
  // olarak okumak dosyalar arası gizli bir bağ kurardı.
  var def = _feadDefOf(node);
  var W = (node && node.width) || def.defaultWidth || 420;
  var H = (node && node.height) || def.defaultHeight || 340;
  var SER = 20;                                   // alt durum şeridi
  var SEC = 22;                                   // konum seçici şeridi
  var mode = veFeadPosMode(node);

  // ── ANİMASYON: seçili devir → kinematik → çiziciye ────────────────────────
  // Devir seçimi kartta duruyor (node.data.animRpm) ve PANEL DE aynı alanı
  // okuyacak olursa iki ayrı ayar tutulmaz — kol konumundaki kuralın aynısı.
  // 'Durgun' seçiliyse animasyon YÜKÜ HİÇ ÜRETİLMEZ: kart bugünkü donuk
  // şemasıyla (dönüş okları geri gelir) kalır, rAF döngüsü de başlamaz.
  var rpmSel = veFeadAnimRpmOf(build, node);
  var kin = (rpmSel === 'off') ? null : veFeadAnimKinematics(build, rpmSel);
  var secim = null;
  if(kin) veFeadAnimRpmChoices(build).forEach(function(c){ if(c.rpm === rpmSel) secim = c; });
  var svg = veFeadLayoutSVG(build, Math.max(120, W), Math.max(90, H - SER - SEC),
                            { inline: true, posMode: mode, nodeId: node.id,
                              compassPos: node.data && node.data.compassPos,
                              animate: kin ? { dispMmS: kin.dispMmS,
                                               label: _feadAnimLabel(kin, secim && secim.fallback) }
                                           : null });

  var h = '<div style="flex:1; min-height:0; display:flex; align-items:center; justify-content:center;">';
  if(svg){
    h += svg;
  } else {
    // ÇÖZÜLEMEDİ — kartın en değerli hâli bu. Sessiz boş bir kutu yerine
    // EKSİĞİN KENDİSİ yazılıyor; kullanıcı neyi düzeltmesi gerektiğini
    // panel açmadan okuyor.
    var neden = (build && build.errors && build.errors.length) ? build.errors[0]
      : (build && build.geomError) ? build.geomError
      : 'Kayış yolu henüz kurulamadı.';
    h += '<div style="padding:10px 12px; text-align:center; font-size:var(--fs-micro);'
      + ' line-height:1.5; color:var(--text-muted);">'
      + '<div style="font-size:var(--fs-tiny); font-weight:700; color:var(--accent-danger);'
      + ' margin-bottom:5px;">Şema çizilemiyor</div>' + _feadEsc(neden)
      + ((build && build.errors && build.errors.length > 1)
          ? '<div style="margin-top:5px; opacity:0.8;">+' + (build.errors.length - 1)
            + ' eksik daha — panelde tamamı yazılı</div>' : '')
      + '</div>';
  }
  h += '</div>';
  h += veFeadPosPicker(node, build, mode, rpmSel);
  h += veFeadLayoutCardStrip(build, mode);
  return h;
}

// ── KART DENETİM SATIRI: KOL KONUMU + DEVİR ─────────────────────────────────
// Gergi kolu kayış uzayıp kısaldıkça dönüyor ve kayış yolu her konumda BAŞKA.
// Kart varsayılan olarak çalışma (Mean) konumunu gösteriyor; bu kutu diğer
// konumlara geçmeyi ve "TÜMÜ" ile üst üste bindirmeyi sağlıyor.
//
// mousedown DURDURULUR: kart bir kanvas düğümünün içinde ve düğüm mousedown ile
// SÜRÜKLENMEYE başlıyor — durdurulmazsa listeyi açmaya çalışmak düğümü
// taşıyordu. change ise serbest; saveState zaten kartı tazeliyor.
function veFeadPosPicker(node, build, mode, rpmSel){
  var rows = (build && build.ok) ? veFeadPositionRows(build) : [];
  var cozulen = {};
  rows.forEach(function(r){ if(r.ok) cozulen[r.key] = r; });

  var opts = '';
  VE_FEAD_POSITIONS.forEach(function(P){
    var r = cozulen[P.key];
    if(!r && P.key !== 'mean') return;              // çözülemeyen konum listede yok
    opts += '<option value="' + P.key + '"' + (mode === P.key ? ' selected' : '') + '>'
          + _feadEsc(P.label) + (r ? ' · ' + _feadFmt(r.relDeg, 1) + '°' : '') + '</option>';
  });
  var cok = Object.keys(cozulen).length > 1;
  opts += '<option value="all"' + (mode === 'all' ? ' selected' : '') + '>'
        + 'TÜMÜ — üst üste' + (cok ? '' : ' (tek konum)') + '</option>';

  // ── DEVİR (animasyon) — duty tablosundan ──────────────────────────────────
  // AYNI SATIRDA duruyor, ikinci bir şerit açılmıyor: kartın 340 px'inden her
  // şerit 22 px alıyor ve o piksel çizimden gidiyordu (ölçüldü: iki şeritle
  // şema 276 px'e düşüyor, alternatör dairesi 13 px'in altına iniyor).
  var rpm = (rpmSel === undefined) ? veFeadAnimRpmOf(build, node) : rpmSel;
  var rOpt = '<option value="off"' + (rpm === 'off' ? ' selected' : '') + '>Durgun</option>';
  veFeadAnimRpmChoices(build).forEach(function(c){
    rOpt += '<option value="' + c.rpm + '"' + (rpm === c.rpm ? ' selected' : '') + '>'
         + c.rpm + ' dev/dk'
         + (c.fallback ? ' (varsayılan)'
                       : (c.dcPct > 0 ? ' · %' + _feadFmt(c.dcPct, 0) : ''))
         + '</option>';
  });

  var stil = 'flex:1; min-width:0; height:18px; padding:0 3px; font-size:var(--fs-micro);'
    + ' background:var(--bg-input); color:var(--text-primary); border:1px solid var(--border-color);'
    + ' border-radius:2px;';
  var etiket = 'font-size:var(--fs-micro); color:var(--text-muted); white-space:nowrap;';

  return '<div style="flex:0 0 auto; display:flex; align-items:center; gap:5px; padding:1px 6px;'
    + ' border-top:1px solid var(--border-color); background:var(--bg-secondary, #16181d);"'
    + ' onmousedown="event.stopPropagation();" ondblclick="event.stopPropagation();">'
    + '<span style="' + etiket + '">Kol</span>'
    + '<select onmousedown="event.stopPropagation();"'
    + ' onchange="veFeadSetChoice(\'' + node.id + '\',\'posMode\',this.value)"'
    + ' style="' + stil + '">' + opts + '</select>'
    + '<span style="' + etiket + '">Devir</span>'
    + '<select onmousedown="event.stopPropagation();"'
    + ' onchange="veFeadSetChoice(\'' + node.id + '\',\'animRpm\',this.value)"'
    + ' style="' + stil + ' flex:0.85;">' + rOpt + '</select></div>';
}

// Animasyon künyesi — kartın sol üstünde, konum künyesinin altında.
// AĞIR ÇEKİM KATSAYISI YAZILI: ekranda görülen hız gerçek hız DEĞİL (gerçek
// zamanda 60 Hz ekranda strob oluyor, bkz. fead-model.js), oranlar ise birebir.
// Katsayı gizlenseydi kullanıcı ekrandan devir okumaya kalkardı.
function _feadAnimLabel(kin, fallback){
  if(!kin) return '';
  var kat = (kin.slow >= 0.999) ? 'gerçek zaman'
          : '×1/' + Math.round(1/kin.slow) + ' ağır çekim';
  return Math.round(kin.engineRpm) + ' dev/dk' + (fallback ? ' (varsayılan)' : '')
       + '  ·  kayış ' + _feadFmt(kin.beltMs, 1) + ' m/s  ·  ' + kat;
}

// Durum şeridi — "tutarlı mı" sorusunun tek satırlık cevabı.
// Sarım değişmezi (Σkaburgalı − Σsırttan = 360°) burada duruyor çünkü kapalı
// bir kayış çevriminin geometrik ZORUNLULUĞU o; tutmuyorsa şema kendi içinde
// tutarlı görünse bile yol yanlış çözülmüş demektir.
function veFeadLayoutCardStrip(build, mode){
  var ok = !!(build && build.ok);
  var sol = 'Kayış yolu kapanmadı', sag = '';
  if(ok){
    try {
      // Şerit HANGİ KONUM ÇİZİLİYORSA onun sayılarını verir; Mean'in sayılarını
      // gösterip başka bir konumu çizmek sessiz bir yanlış okuma olurdu.
      var sel = veFeadPosSelection(build, mode || 'mean');
      var relS = (sel.primary && Number.isFinite(sel.primary.relDeg))
        ? sel.primary.relDeg : FEADCore.meanRel(build.sys);
      var st = FEADCore.tensionerState(build.sys, relS);
      var g = st.geom, sg = 0, bk = 0;
      g.wraps.forEach(function(w, i){
        if(build.sys.pulleys[i].contact === 'back') bk += w; else sg += w;
      });
      var inv = (sg - bk) * 180 / Math.PI;
      sol = build.order.length + ' kasnak · L ' + _feadFmt(g.LeffMm, 1) + ' mm';
      // ÇEVRİM İKİ YÖNE DE GEZİLEBİLİR: aynalanmış bir düzende kayış ters yönde
      // dolanır ve işaretli sarım toplamı −360° çıkar. Çekirdek bunu ZATEN kabul
      // ediyor (fead-core.js: |‌|Σ|−360| > 0.05 → hata), yani ±360'ın ikisi de
      // geçerli çözüm. Buradaki kapı yalnız +360 arıyordu; rastgele üretilmiş
      // bir topolojide çekirdeğin kusursuz çözdüğü bir yerleşim kartta ✗ ile
      // "tutarsız" görünüyordu. Yön künyede yazılıyor ki bilgi kaybolmasın.
      sag = 'Σsarım ' + _feadFmt(inv, 1) + '°' + (inv < 0 ? ' (ters yön)' : '');
      // ÇEKİRDEK ARTIK HOŞGÖRÜLÜ: kapanmayan çevrim istisna atmıyor, sayıları
      // üretip ihlali taşıyor (bkz. solveGeometry tolerant). Yani kart artık
      // ÇİZİYOR — ve tam bu yüzden şeridin sebebi ADIYLA söylemesi gerekiyor:
      // çizilen yol makul görünür, yanlış olduğu yalnız buradan okunur.
      if(Math.abs(Math.abs(inv) - 360) > 0.05){
        ok = false;
        sol = 'Kayış yolu KAPANMIYOR · ' + sol;
      } else if((g.violations || []).length){
        ok = false;
        sol = 'Kayış kasnağın İÇİNDEN geçiyor · ' + sol;
      }
    } catch(e){ ok = false; sol = 'Geometri okunamadı'; }
  }
  var renk = ok ? 'var(--accent-success)' : 'var(--accent-danger)';
  return '<div style="flex:0 0 auto; display:flex; justify-content:space-between; gap:6px;'
    + ' align-items:center; padding:2px 7px; font-size:var(--fs-micro); line-height:1.5;'
    + ' font-family:ui-monospace, monospace; color:' + renk
    + '; border-top:1px solid var(--border-color); background:var(--bg-secondary, #16181d);">'
    + '<span>' + (ok ? '✓ ' : '✗ ') + _feadEsc(sol) + '</span>'
    + '<span style="opacity:0.85;">' + _feadEsc(sag) + '</span></div>';
}

// Tuvaldeki BÜTÜN Kayış Yolu kartlarını tazele. Girdi değişince çağrılır
// (setter'lar + saveState); iç topolojide Kayış Yolu düğümü yoksa hiçbir şey
// yapmaz, yani ana tuvalde ve diğer modüllerde bedava.
function veFeadRefreshLayoutCards(){
  if(typeof document === 'undefined' || typeof nodes === 'undefined') return 0;
  var n = 0;
  nodes.forEach(function(x){
    if(!_feadDefOf(x).isFeadLayout) return;
    var el = document.getElementById(x.id);
    if(el && veFeadApplyLayoutCard(el, x)) n++;
  });
  return n;
}

// ════════════════════════════════════════════════════════════════════════════
//  ANİMATÖR — tek rAF döngüsü, DOM'da durum YOK
// ════════════════════════════════════════════════════════════════════════════
// Kart her saveState()'te innerHTML ile baştan kuruluyor. Animasyonu öğeye
// bağlı bir durumla (kurulum/temizlik çiftiyle) sürdürmek, o yeniden kurulmayı
// her seferinde yakalamayı gerektirirdi — unutulan tek yol sızıntı ya da donmuş
// kart demekti. Bunun yerine döngü DURUM TUTMAZ: her karede animasyon yükü
// taşıyan SVG'leri arar, bulduğuna fazı uygular. Yeniden kurulma kendiliğinden
// zararsız; kart yok olunca döngü kendini durdurur.
//
// FAZ DÜĞÜM KİMLİĞİYLE saklanır (öğeyle değil): kullanıcı bir alanı
// değiştirdiğinde kart yeniden kuruluyor, öğe yeni; faz öğede dursaydı kayış
// her tuş vuruşunda başa sararak ZIPLARDI.
//
// KARE BAŞINA İŞ: kart başına bir diş yolu (~140 kısa parça) + kasnak başına
// bir kol yolu (3 parça). Hepsi attribute yazımı; yeniden düzen (layout)
// tetiklemez.
var VE_FEAD_ANIM_ATTR = 'data-fead-anim';
var VE_FEAD_ANIM_MAX_DT = 0.1;          // s — sekme geri gelince kayış fırlamasın
var _feadAnimPhase = {};                // düğüm kimliği → mm cinsinden faz
var _feadAnimRAF = 0;
var _feadAnimLast = 0;

// Kullanıcı hareketi azaltmak istiyorsa animasyon HİÇ başlamaz; kart donuk
// şemasıyla (dönüş okları ve tam okunur etiketleriyle) kalır.
function _feadAnimReduced(){
  try {
    return !!(typeof window !== 'undefined' && window.matchMedia
              && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  } catch(e){ return false; }
}

// Yükü bir kez çözüp öğenin üstünde önbelleğe alır. Anahtar ham metnin
// KENDİSİ: kart yeniden kurulup yük değiştiyse (devir değişti, geometri
// değişti) önbellek kendiliğinden düşer.
function _feadAnimSpec(el){
  var raw = el.getAttribute(VE_FEAD_ANIM_ATTR);
  if(!raw) return null;
  var spec = el.__feadAnim;
  if(spec && spec._raw === raw) return spec;
  try { spec = JSON.parse(raw); } catch(e){ return null; }
  if(!spec || !Array.isArray(spec.segs)) return null;
  spec._raw = raw;
  spec.T = _feadXform(spec.s, spec.ox, spec.oy, spec.mx, spec.my);
  spec.walk = { segs: spec.segs, l: spec.loop };
  el.__feadAnim = spec;
  return spec;
}

function veFeadAnimApply(el, phaseMm){
  var spec = _feadAnimSpec(el);
  if(!spec) return false;
  var rib = el.querySelector('[data-ve="rib"]');
  if(rib) rib.setAttribute('d',
    _feadTeethPath(spec.walk, spec.sense, spec.step, spec.tooth, phaseMm, spec.T));
  var kollar = el.querySelectorAll('[data-ve="spoke"]');
  for(var i=0;i<kollar.length;i++){
    var j = parseInt(kollar[i].getAttribute('data-arc'), 10);
    kollar[i].setAttribute('d',
      _feadSpokePath(spec.walk, phaseMm, spec.T, Number.isFinite(j) ? j : null));
  }
  return true;
}

function veFeadAnimTick(now){
  _feadAnimRAF = 0;
  if(typeof document === 'undefined') return 0;
  var els = document.querySelectorAll('svg[' + VE_FEAD_ANIM_ATTR + ']');
  if(!els.length){ _feadAnimLast = 0; return 0; }       // kart yok → döngü biter
  var t = (typeof now === 'number') ? now : 0;
  var dt = (_feadAnimLast > 0) ? Math.min(VE_FEAD_ANIM_MAX_DT, (t - _feadAnimLast) / 1000) : 0;
  if(dt < 0) dt = 0;
  _feadAnimLast = t;
  var canli = 0;
  for(var i=0;i<els.length;i++){
    var el = els[i], spec = _feadAnimSpec(el);
    if(!spec || !(spec.mmS > 0)) continue;
    var key = el.getAttribute('data-fead-node') || '?';
    var p = (_feadAnimPhase[key] || 0) + spec.mmS * dt;
    if(spec.loop > 0) p = p % spec.loop;                 // faz çevrimde kalır
    _feadAnimPhase[key] = p;
    veFeadAnimApply(el, p);
    canli++;
  }
  if(canli) veFeadAnimEnsure();
  else _feadAnimLast = 0;
  return canli;
}

function veFeadAnimEnsure(){
  if(_feadAnimRAF) return false;
  if(typeof requestAnimationFrame !== 'function') return false;
  if(_feadAnimReduced()) return false;
  _feadAnimRAF = requestAnimationFrame(veFeadAnimTick);
  return true;
}

function getFeadLayoutPropertiesHTML(node){
  if(!node.data) node.data = {};
  var build = veFeadBuildFromCanvas();
  var html = '<div class="sw-panel">';
  var mode = veFeadPosMode(node);
  // Panel de AYNI alanı okur ve aynı kancayı kurar: gül kartta bir yerde,
  // panelde başka bir yerde durursa kullanıcı hangisinin geçerli olduğunu
  // bilemez (kol konumundaki kuralın aynısı).
  var svg = veFeadLayoutSVG(build, 320, 240,
    { posMode: mode, nodeId: node.id, compassPos: node.data.compassPos });
  if(svg){
    // Konum seçimi KARTLA AYNI ALANI okur (node.data.posMode) — iki ayrı ayar
    // tutulsa panel bir konumu, kanvastaki kart başka bir konumu gösterirdi.
    var secenekler = [];
    var rows = veFeadPositionRows(build), coz = {};
    rows.forEach(function(r){ if(r.ok) coz[r.key] = r; });
    VE_FEAD_POSITIONS.forEach(function(P){
      if(!coz[P.key] && P.key !== 'mean') return;
      secenekler.push([P.key, P.label + (coz[P.key] ? ' · kol ' + _feadFmt(coz[P.key].relDeg, 1) + '°' : '')]);
    });
    secenekler.push(['all', 'TÜMÜ — üst üste (kolun gezdiği aralık)']);
    html += _feadCard('Şema', 'ölçekli · sarım açıları', 'var(--accent-warning)',
        _feadSelect(node, 'Gergi kol konumu', 'posMode', secenekler, mode,
          'Kol kayış uzayıp kısaldıkça dönüyor; her konumda teğet noktaları, sarım '
          + 'açıları ve span boyları DEĞİŞİR. <b>TÜMÜ</b> kolun gezdiği aralığı üst '
          + 'üste bindirir — tolerans ve aşınma payı 0 ise bütün konumlar aynı açıya '
          + 'oturur ve tek eğri görünür.')
      + svg);
    html += veFeadGeometryTable(build, mode);
  } else {
    html += veFeadProblemBox(build);
  }
  html += veFeadWarningBox(build);
  html += '</div>';
  return html;
}

// Geometri özeti — çekirdeğin kasnak başına verdiği span + sarım + hız oranı.
function veFeadGeometryTable(build, mode){
  var geom, st;
  try {
    // Tablo ŞEMAYLA AYNI konumu anlatır; ikisi ayrışsa kullanıcı bir konumun
    // çizimine bakıp başka bir konumun sayılarını okurdu.
    var _sel = (typeof veFeadPosSelection === 'function')
      ? veFeadPosSelection(build, mode || 'mean') : null;
    var _rel = (_sel && _sel.primary && Number.isFinite(_sel.primary.relDeg))
      ? _sel.primary.relDeg : FEADCore.meanRel(build.sys);
    st = FEADCore.tensionerState(build.sys, _rel);
    geom = st.geom;
  } catch(e){ return ''; }
  var h = '<table style="width:100%; font-size:var(--fs-body); border-collapse:collapse; border:1px solid var(--border-color);">'
    + '<tr style="background:var(--bg-tertiary);">'
    + ['Kasnak','Temas','Çıkış span [mm]','Sarım [°]','Hız oranı'].map(function(t){
        return '<th style="padding:4px 6px; border:1px solid var(--border-color); text-align:left; font-weight:600; color:var(--text-secondary);">'+t+'</th>';
      }).join('') + '</tr>';
  geom.names.forEach(function(nm, i){
    h += '<tr>'
      + '<td style="padding:4px 6px; border:1px solid var(--border-color); color:var(--text-primary);">' + _feadEsc(nm) + '</td>'
      + '<td style="padding:4px 6px; border:1px solid var(--border-color); color:var(--text-muted);">'
        + veFeadContactLabel(geom.pulleys[i].contact) + '</td>'
      + '<td style="padding:4px 6px; border:1px solid var(--border-color); text-align:right;">' + _feadFmt(geom.exitSpanLen(i),1) + '</td>'
      + '<td style="padding:4px 6px; border:1px solid var(--border-color); text-align:right;">' + _feadFmt(geom.wrapDeg(i),1) + '</td>'
      + '<td style="padding:4px 6px; border:1px solid var(--border-color); text-align:right;">' + _feadFmt(FEADCore.speedRatio(build.sys, i),3) + '</td>'
      + '</tr>';
  });
  h += '</table>';
  var _etiket = (_sel && _sel.primary) ? (_sel.primary.label + ' konumunda')
                                      : 'ortalama kol açısında';
  return _feadCard('Geometri', _etiket, 'var(--accent-primary)', h
    + _feadHint('Efektif kayış boyu <b>' + _feadFmt(geom.LeffMm,1) + ' mm</b> · '
      + 'pitch boyu ' + _feadFmt(geom.LpitchMm,1) + ' mm · '
      + 'işaretli sarım toplamı ' + _feadFmt(geom.signedWrapDeg,2) + '° (360 olmalı).'));
}

// Çözülemeyen model: NE EKSİK olduğunu say. Yanlış bir şema, doğru bir
// uyarıdan kötüdür — bu yüzden hata varken hiç çizmiyoruz.
function veFeadProblemBox(build){
  // Girdi hatası yoksa ama geometri yine de çözülemediyse ÇÖZÜCÜNÜN sebebini
  // bas: "Geometri çözülemedi" tek başına kullanıcıyı aramaya bırakırdı.
  var _liste = (build && build.errors && build.errors.length) ? build.errors.slice() : [];
  if(!_liste.length && build && build.geomError) _liste.push(build.geomError);
  if(!_liste.length){
    return '<div style="padding:14px; text-align:center; font-size:var(--fs-body); color:var(--text-muted); border:1px dashed var(--border-color); border-radius:var(--radius-md); margin-bottom:9px;">'
      + 'Geometri çözülemedi.</div>';
  }
  var h = '<div style="padding:10px 12px; margin-bottom:9px; background:var(--bg-secondary); border:1px solid var(--accent-danger); border-left:3px solid var(--accent-danger); border-radius:var(--radius-sm);">'
    + '<div style="font-size:var(--fs-tiny); font-weight:700; color:var(--text-heading); margin-bottom:6px;">Şema çizilemiyor — eksik ya da tutarsız girdi</div>'
    + '<ul style="margin:0; padding-left:18px; font-size:var(--fs-micro); line-height:1.6; color:var(--text-secondary);">';
  _liste.forEach(function(e){ h += '<li>' + _feadEsc(e) + '</li>'; });
  return h + '</ul></div>';
}

function veFeadWarningBox(build){
  if(!build || !build.warnings || !build.warnings.length) return '';
  var h = '<div style="padding:10px 12px; margin-bottom:9px; background:var(--bg-secondary); border:1px solid var(--border-color); border-left:3px solid var(--accent-warning); border-radius:var(--radius-sm);">'
    + '<div style="font-size:var(--fs-tiny); font-weight:700; color:var(--text-heading); margin-bottom:6px;">Uyarılar</div>'
    + '<ul style="margin:0; padding-left:18px; font-size:var(--fs-micro); line-height:1.6; color:var(--text-secondary);">';
  build.warnings.forEach(function(w){ h += '<li>' + _feadEsc(w) + '</li>'; });
  return h + '</ul></div>';
}

// ════════════════════════════════════════════════════════════════════════════
//  ÇÖZÜCÜ — tasarım girdileri + model durumu + konum tablosu
// ════════════════════════════════════════════════════════════════════════════
// Çözücü iç topolojiyi TİPE göre tarar (Takoz Çözücüsü ile aynı yaklaşım):
// kullanıcı çözücüye bileşen bağlamaz. Kendi taşıdığı üç girdi tasarım
// düzeyindedir ve hiçbir kasnağa ait değildir: tasarım gerginliği, tahrik
// oranı, boy ofseti.
function getFeadSolverPropertiesHTML(node){
  if(!node.data) node.data = {};
  var build = veFeadBuildFromCanvas();
  var html = '<div class="sw-panel">';
  // TASARIM GERGİNLİĞİ ALANI KALDIRILDI. Bağımsız bir veri değildi: gergi
  // kolunun taşıdığı gerginlik yay dengesinden zaten belirli (T = M/(dL/dθ)) ve
  // 10 Gates raporunda girilen değerle türeyen değer %0.12 içinde örtüşüyordu.
  // Ayrıca sormak, aynı bilgiyi ikinci kez ve ÇELİŞEBİLİR biçimde istemekti;
  // çeliştiğinde çekirdek girileni kullanıp yay dengesini yok sayıyordu ve
  // bütün gerilmeler sessizce kayıyordu. Artık köprü türetiyor
  // (veFeadBuildSystem, "ANKRAJ TÜRETİLİYOR"); okunacak yeri aşağıdaki
  // Algılanan Model tablosu.
  html += _feadCard('Tasarım', '', 'var(--accent-primary)',
      _feadGrid(node, [
        { key:'lengthOffsetMm', label:'Boy ofseti [mm]', ph:'0', step:'0.01' }
      ], 1)
    + _feadSelect(node, 'Yorulma modeli', 'fatigueModel',
        [['PK-2_2p-MT3', 'PK-2_2p-MT3 (doğrulanmış, 8 sistem)'],
         ['PK-2_2a-MT3', 'PK-2_2a-MT3 (tek sistem — doğrulanmamış)']], 'PK-2_2p-MT3',
        'Gates raporunun "Pulley Contributions to Belt Rib Fatigue" başlığında yazan model adı. '
        + 'İki takım sabit çok farklı (m 5.6 ↔ 4.05); yanlış seçim yorulma dağılımını kaydırır.')
    + _feadHint('<b>Tasarım gerginliği sorulmaz</b> — gergi yay dengesinden türetilir '
        + '(T = M/(dL/dθ)); değeri "Algılanan Model" tablosunda yazar. '
        + '<b>Boy ofseti</b> tasarım başına kalibrasyon girdisidir '
        + '(kuralı bilinmiyor; gözlenen aralık −0.3 … +3.5 mm).'));

  html += veFeadDriveCard(node);
  html += veFeadEngineCard(node);
  html += _feadCard('Algılanan Model', '', 'var(--accent-success)', veFeadModelTable(build));

  if(build.ok){
    html += veFeadPositionTable(build);
    html += veFeadWarningBox(build);
  } else {
    html += veFeadProblemBox(build);
    html += veFeadWarningBox(build);
  }

  html += veFeadDutyEditor(node, build);

  var hazir = build.ok && veFeadDutyRows(node).length > 0;
  html += '<button ' + (hazir ? '' : 'disabled ')
    + 'onclick="veFeadSolve(\'' + node.id + '\')" style="width:100%; padding:13px 16px; '
    + 'font-size:var(--fs-lg); font-weight:700; letter-spacing:0.03em; border:none; cursor:'
    + (hazir ? 'pointer' : 'not-allowed') + '; background:'
    + (hazir ? 'var(--accent-warning)' : 'var(--bg-tertiary)') + '; color:'
    + (hazir ? '#fff' : 'var(--text-muted)')
    + (hazir ? '' : '; border:1px solid var(--border-color)') + ';">▶ Hesapla'
    + (hazir ? '' : ' (model veya çevrim eksik)') + '</button>';

  html += veFeadResultBlock(node);
  html += '</div>';
  return html;
}

// ── BİRİNCİ KADEME (krank → sürücü kasnak) ──────────────────────────────────
// FEAD kayışının sürücü kasnağı krank milinde olmak zorunda değil: tipik BMC
// düzeninde krank ayrı bir kademeyle fan kasnağını döndürüyor, FEAD kayışı da
// onun üzerinden tahrik ediliyor. Tedarikçi sayfası oranı İKİ ÇAPLA veriyor
// (krank 197.32 / fan 179.62 = 1.0985 ≈ 1.1), tek bir sayıyla değil — panel de
// o biçimde sorar ve oranı türetir. Elle sayı girme yolu duruyor (tek kademeli
// sistemde oran 1'dir ve çap sormak anlamsız olurdu).
function veFeadDriveCard(node){
  var sd = node.data || {};
  var dr = veFeadDriveRatio(sd);
  var elle = (sd.ratioMode === 'direct');

  var inner = _feadSelect(node, 'Tahrik oranı nereden gelsin', 'ratioMode',
      [['derive', 'Krank ve fan kasnağı çapından türet'],
       ['direct', 'Oranı elle gir']], 'derive',
      'Oran = sürücü kasnak devri / motor devri. Krank kasnağı fan kasnağından büyükse '
      + 'sürücü kasnak motordan HIZLI döner (oran &gt; 1).');

  if(elle){
    inner += _feadGrid(node, [
      { key:'driveRatio', label:'Tahrik oranı [—]', ph:'1', step:'0.0001' }
    ], 1);
  } else {
    inner += _feadGrid(node, [
      { key:'crankOD', label:'Krank kasnağı Ø [mm]', ph:'197.32' },
      { key:'fanOD',   label:'Fan / sürücü kasnağı Ø [mm]', ph:'179.62' }
    ], 2);
  }

  var deg = '<div style="font-size:var(--fs-micro); line-height:1.5; padding:7px 9px; margin-bottom:9px; '
    + 'background:var(--bg-tertiary); border:1px solid var(--border-color); border-radius:var(--radius-sm); '
    + 'display:flex; justify-content:space-between; gap:8px;">'
    + '<span style="color:var(--text-muted);">Kullanılan tahrik oranı</span>'
    + '<span style="font-family:ui-monospace,monospace; font-weight:700; color:'
    + (dr.ok ? 'var(--accent-primary)' : 'var(--accent-warning)') + ';">'
    + _feadFmt(dr.ratio, 4) + (dr.mode === 'derive' ? '  (' + _feadFmt(dr.crankOD, 2) + ' / ' + _feadFmt(dr.fanOD, 2) + ')' : '')
    + '</span></div>';

  return _feadCard('Birinci Kademe', 'krank → sürücü kasnak', 'var(--accent-warning)',
    inner + deg
    + _feadHint('Bu oran aksesuar devirlerinin TAMAMINI ölçekler: aksesuar devri = motor devri '
      + '× tahrik oranı × (sürücü kasnak pitch çapı / aksesuar pitch çapı). Yanlış girilirse '
      + 'bütün güç ve gerilme sonuçları aynı oranda kayar.'));
}

// ── MOTOR KÜNYESİ ───────────────────────────────────────────────────────────
// Sayfadaki "Engine Info" tablosunun karşılığı. HANGİSİNİN HESABA GİRDİĞİ
// AÇIKÇA YAZILI: model yarı-statiktir, ivmelenme/yavaşlama ve krank ataleti
// geçici rejim girdileridir ve bu çekirdek onları KULLANMIYOR. Sessizce alan
// açıp "girdim, hesaba girdi" izlenimi vermek, hiç sormamaktan kötü olurdu.
function veFeadEngineCard(node){
  return _feadCard('Motor Künyesi', 'sayfadaki Engine Info', 'var(--text-secondary)',
      _feadGrid(node, [
        { key:'cylinders',   label:'Silindir sayısı [—]', ph:'6', step:'1' },
        { key:'serviceFact', label:'Servis faktörü [—]',  ph:'1.3', step:'0.01' }
      ], 2)
    + _feadGrid(node, [
        { key:'crankInertia', label:'Krank ataleti [kg·m²]', ph:'0.70', step:'0.01' },
        { key:'accelRpmS',    label:'İvmelenme [RPM/s]',     ph:'1000', step:'10' },
        { key:'decelRpmS',    label:'Yavaşlama [RPM/s]',     ph:'1000', step:'10' }
      ], 3)
    + _feadHint('<b>Silindir sayısı</b> ateşleme frekansını verir (f = devir/60 × silindir/2, '
        + 'dört zamanlı) ve span rezonans kontrolünde KULLANILIR. <b>Servis faktörü</b> kayma '
        + 'emniyeti için istenen alt sınır olarak sonuç sekmesinde karşılaştırılır. '
        + '<b>Krank ataleti · ivmelenme · yavaşlama</b> geçici rejim girdileridir; bu çekirdek '
        + 'yarı-statiktir ve onları <b>hesaba katmaz</b> — modelin künyesinde kayıtlı kalırlar.'));
}

// ── ÇALIŞMA ÇEVRİMİ TABLOSU ─────────────────────────────────────────────────
// Satır = devir noktası. Sütunlar: devir · %zaman · °C · aksesuar başına kW.
// SÜRÜCÜ SÜTUNU YOK — gücü diğerlerinin toplamı olarak çekirdek hesaplar;
// elle girilirse çevrim kapanmaz ve çekirdek reddeder.
// Boş bırakılan aksesuar hücresi: katalog seçiliyse oradan doldurulur (devir
// kasnak ÇAPLARINDAN gelir, elle oran girilmez), yoksa 0 sayılır.
function veFeadDutyEditor(node, build){
  var rows = veFeadDutyRows(node);
  var yuk = build.ok
    ? build.order.filter(function(n, i){ return !(build.sys.pulleys[i] && build.sys.pulleys[i].crank); })
    : [];
  var yukIdx = {};
  if(build.ok) build.order.forEach(function(n, i){ yukIdx[n.id] = i; });

  var h = '<table style="width:100%; font-size:var(--fs-micro); border-collapse:collapse; border:1px solid var(--border-color);">';
  h += '<tr style="background:var(--bg-tertiary);">'
     + ['Devir', '%zaman', '°C'].map(function(t){
         return '<th style="padding:3px 4px; border:1px solid var(--border-color); font-weight:600; color:var(--text-secondary);">' + t + '</th>';
       }).join('')
     + yuk.map(function(n){
         return '<th style="padding:3px 4px; border:1px solid var(--border-color); font-weight:600; color:var(--text-secondary);" title="'
           + _feadEsc(_feadNodeName(n)) + ' [kW]">' + _feadEsc(_feadNodeName(n)) + '</th>';
       }).join('')
     + '<th style="padding:3px 4px; border:1px solid var(--border-color);"></th></tr>';

  if(!rows.length){
    h += '<tr><td colspan="' + (4 + yuk.length) + '" style="padding:9px; text-align:center; color:var(--text-muted); border:1px solid var(--border-color);">'
       + 'Henüz devir noktası yok.</td></tr>';
  }
  rows.forEach(function(r, ri){
    var cell = function(key, val, step){
      return '<td style="padding:1px 2px; border:1px solid var(--border-color);">'
        + '<input type="number" value="' + _feadEsc(val) + '" step="' + (step || 'any') + '"'
        + ' onchange="veFeadDutySet(\'' + node.id + '\',' + ri + ',\'' + key + '\',this.value)"'
        + ' style="width:100%; ' + _FEAD_INP + ' height:22px; padding:2px 3px;"></td>';
    };
    h += '<tr>' + cell('rpm', r.rpm, '10') + cell('dcPct', r.dcPct, '0.1') + cell('degC', r.degC, '1');
    yuk.forEach(function(n){
      var v = (r.kw && r.kw[n.id] != null) ? r.kw[n.id] : '';
      var oto = (v === '' && build.ok) ? veFeadAutoKw(build.sys, yukIdx[n.id], n, r.rpm) : null;
      h += '<td style="padding:1px 2px; border:1px solid var(--border-color);">'
        + '<input type="number" value="' + _feadEsc(v) + '" step="0.01"'
        + (oto != null ? ' placeholder="' + _feadFmt(oto, 2) + '"' : ' placeholder="0"')
        + ' title="' + (oto != null ? 'Katalogdan: ' + _feadFmt(oto, 2) + ' kW (boş bırakırsanız bu kullanılır)' : 'Boş = 0 kW')
        + '" onchange="veFeadDutySet(\'' + node.id + '\',' + ri + ',\'kw:' + n.id + '\',this.value)"'
        + ' style="width:100%; ' + _FEAD_INP + ' height:22px; padding:2px 3px;'
        + (oto != null && v === '' ? ' color:var(--text-muted);' : '') + '"></td>';
    });
    h += '<td style="padding:1px 3px; border:1px solid var(--border-color); text-align:center;">'
      + '<button onclick="veFeadDutyRemove(\'' + node.id + '\',' + ri + ')" title="Satırı sil"'
      + ' style="background:none; border:none; color:var(--accent-danger); cursor:pointer; font-size:var(--fs-body); line-height:1;">×</button></td></tr>';
  });
  h += '</table>';

  var toplam = rows.reduce(function(a, r){ return a + r.dcPct; }, 0);
  h += '<div style="display:flex; gap:6px; margin-top:7px;">'
    + '<button onclick="veFeadDutyAdd(\'' + node.id + '\')" style="flex:1; padding:5px; font-size:var(--fs-micro); '
    + 'background:var(--bg-tertiary); color:var(--text-primary); border:1px solid var(--border-color); cursor:pointer;">+ Devir satırı</button>'
    + '<button onclick="veFeadDutyFillCatalog(\'' + node.id + '\')" style="flex:1; padding:5px; font-size:var(--fs-micro); '
    + 'background:var(--bg-tertiary); color:var(--text-primary); border:1px solid var(--border-color); cursor:pointer;" '
    + 'title="Boş kW hücrelerini seçili katalog eğrilerinden doldur">Katalogdan doldur</button>'
    + '</div>';

  var uyari = '';
  if(rows.length && Math.abs(toplam - 100) > 0.5)
    uyari = _feadHint('<b style="color:var(--accent-warning);">%zaman toplamı ' + _feadFmt(toplam, 1)
      + '</b> — 100 değil. Yorulma ve ömür payları bu ağırlıklara göre dağıtılır; '
      + 'toplam 100 değilse mutlak ömür ölçeklenir (dağılım yüzdeleri etkilenmez).');

  return _feadCard('Çalışma Çevrimi', 'sürücü sütunu YOK — gücü hesaplanır', 'var(--accent-success)',
    h + uyari
    + _feadHint('Boş bırakılan kW hücresi: aksesuarda katalog modeli seçiliyse o eğriden '
        + 'doldurulur (aksesuar devri kasnak <b>pitch çaplarından</b> hesaplanır, elle oran '
        + 'girilmez), seçili değilse 0 sayılır.'));
}

// Modelin çekirdeğe göre durumu — sayarken TİPE değil ROLE bakılır.
function veFeadModelTable(build){
  var all = (typeof nodes !== 'undefined') ? nodes : [];
  var pulleys = (build && build.order) || [];
  var say = function(pred){ return all.filter(pred).length; };
  var drv = pulleys.filter(function(n){ return n.data && n.data.driver; });
  var driver = veFeadResolveDriver(pulleys);

  function satir(ad, deger, ok){
    return '<tr><td style="padding:5px 8px; border:1px solid var(--border-color); color:var(--text-secondary);">' + ad + '</td>'
      + '<td style="padding:5px 8px; border:1px solid var(--border-color); font-weight:600; color:'
      + (ok ? 'var(--text-primary)' : 'var(--accent-warning)') + ';">' + deger + '</td></tr>';
  }
  var h = '<table style="width:100%; font-size:var(--fs-body); border-collapse:collapse; border:1px solid var(--border-color);">';
  h += satir('Kayış yolundaki kasnak', pulleys.length + ' adet', pulleys.length >= 3);
  h += satir('Sürücü', driver ? _feadEsc(_feadNodeName(driver)) + (drv.length ? '' : ' (tipten varsayıldı)') : 'yok',
             drv.length === 1);
  h += satir('Gergi', say(function(n){ return _feadDefOf(n).isFeadTensioner; }) + ' adet',
             say(function(n){ return _feadDefOf(n).isFeadTensioner; }) === 1);
  h += satir('Avara kasnak', say(function(n){ return _feadDefOf(n).isFeadIdler; }) + ' adet', true);
  h += satir('Kayış künyesi', say(function(n){ return _feadDefOf(n).isFeadBelt; }) ? 'tanımlı' : 'yok',
             say(function(n){ return _feadDefOf(n).isFeadBelt; }) > 0);
  var kaburgali = pulleys.filter(function(n){ return veFeadContactOf(n) === 'grooved'; }).length;
  h += satir('Temas tarafı', kaburgali + ' kaburgalı / ' + (pulleys.length - kaburgali) + ' sırttan', true);

  // TÜRETİLEN GERGİ AÇISI burada görünür: kullanıcı montaj merkezi girdi, hesaba
  // giren serbest açı bu. Görünmezse "hangi sayı kullanıldı" sorusu panelde
  // cevapsız kalırdı — bu modülde en pahalı sessizlik tam olarak orada.
  if(build.angleMode === 'mount' && build.mount && build.mount.ok){
    h += satir('Gergi kol açısı', 'montaj merkezinden türetildi', true);
    if(Number.isFinite(build.freeAngleDeg))
      h += satir('↳ serbest açı (hesaba giren)', _feadFmt(build.freeAngleDeg, 2) + '°', true);
    if(build.ok && build.sys)
      h += satir('↳ dönüş yönü (sense)', (build.sys.tensioner.sense > 0 ? '+1' : '−1'), true);
  } else if(build.angleMode === 'direct'){
    h += satir('Gergi kol açısı', 'elle girildi (serbest açı)', true);
  }
  if(build.drive)
    h += satir('Tahrik oranı', _feadFmt(build.drive.ratio, 4)
      + (build.drive.mode === 'derive' ? ' (çaplardan)' : ' (elle)'), build.drive.ok);

  // TÜRETİLEN TASARIM GERGİNLİĞİ. Panelde artık alan yok; kullanıcının hesabın
  // hangi ankrajla kurulduğunu okuyacağı tek yer burası. Görünmezse "gerginlik
  // nereden geldi" sorusu cevapsız kalır — bu modülde en pahalı sessizlik türü.
  if(Number.isFinite(build.springTensionN) && build.springTensionN > 0)
    h += satir('Tasarım gerginliği (türetildi)',
      _feadFmt(build.springTensionN, 0) + ' N — yay dengesinden', true);
  else if(build.ok)
    h += satir('Tasarım gerginliği', 'türetilemedi', false);

  h += satir('Geometri', build.ok ? 'çözüldü' : 'çözülemedi', !!build.ok);
  return h + '</table>';
}

// Gates "Tensioner Geometry" tablosunun karşılığı: kol açısı, gergi kasnağı
// konumu, hubload, gerginlik, sarım. Bu tablo DUTY GEREKTİRMEZ — geometri ve
// yay dengesinden gelir, o yüzden çalışma çevrimi girilmeden de üretilebiliyor.
function veFeadPositionTable(build){
  var rows;
  try { rows = FEADCore.positionTable(build.sys); }
  catch(e){ return _feadHint('Konum tablosu üretilemedi: ' + _feadEsc(veFeadTranslateError(e && e.message))); }

  var ad = { FreeArm:'Serbest kol', Replace:'Değiştirme', MaxBelt:'Maks. kayış',
             Mean:'Ortalama', MinBelt:'Min. kayış', Load:'Load (mekanik stop)' };
  var h = '<table style="width:100%; font-size:var(--fs-micro); border-collapse:collapse; border:1px solid var(--border-color);">'
    + '<tr style="background:var(--bg-tertiary);">'
    + ['Konum','Kol [°]','Gerginlik [N]','Hubload [N]','Yön [°]','β [°]','Sarım [°]'].map(function(t){
        return '<th style="padding:4px 5px; border:1px solid var(--border-color); text-align:left; font-weight:600; color:var(--text-secondary);">'+t+'</th>';
      }).join('') + '</tr>';
  rows.forEach(function(r){
    var isLoad = r.position === 'Load';
    if(r.error){
      h += '<tr><td style="padding:4px 5px; border:1px solid var(--border-color);">' + (ad[r.position] || r.position) + '</td>'
        + '<td colspan="6" style="padding:4px 5px; border:1px solid var(--border-color); color:var(--accent-danger);">'
        + _feadEsc(veFeadTranslateError(r.error)) + '</td></tr>';
      return;
    }
    var sty = 'padding:4px 5px; border:1px solid var(--border-color); text-align:right;'
      + (isLoad ? ' color:var(--text-muted);' : '');
    h += '<tr><td style="padding:4px 5px; border:1px solid var(--border-color); color:'
      + (isLoad ? 'var(--text-muted)' : 'var(--text-primary)') + ';">' + (ad[r.position] || r.position) + '</td>'
      + '<td style="' + sty + '">' + _feadFmt(r.relDeg,1) + '</td>'
      + '<td style="' + sty + '">' + _feadFmt(r.tensionN,0) + '</td>'
      + '<td style="' + sty + '">' + _feadFmt(r.hubloadN,0) + '</td>'
      + '<td style="' + sty + '">' + _feadFmt(r.hubDirDeg,1) + '</td>'
      + '<td style="' + sty + '">' + _feadFmt(r.betaDeg,1) + '</td>'
      + '<td style="' + sty + '">' + _feadFmt(r.wrapDeg,1) + '</td></tr>';
  });
  h += '</table>';

  var mean = rows.filter(function(r){ return r.position === 'Mean'; })[0];
  var ek = mean && !mean.error
    ? _feadHint('Ortalama konumda take-up <b>' + _feadFmt(mean.takeupMmPerDeg,3) + ' mm/°</b> · '
        + 'yay momenti ' + _feadFmt(mean.springNm,2) + ' Nm · efektif tahrik boyu '
        + _feadFmt(mean.driveLenMm,1) + ' mm. <b>Load</b> bir MEKANİK STOP\'tur, çalışma noktası '
        + 'değildir: orada sarım sıfıra yaklaştığı için gerginlik tekilleşir.')
    : '';
  return _feadCard('Gergi Konum Tablosu', 'çalışma çevrimi gerektirmez', 'var(--accent-warning)', h + ek);
}

function getFeadExamplePropertiesHTML(node){
  if(!node.data) node.data = {};
  var html = '<div class="sw-panel">';
  veFeadExampleKeys().forEach(function(k){
    var ex = veFeadExampleOf(k);
    var kasnak = ex.pulleys.length;
    var egri = ex.pulleys.filter(function(p){ return p.data && p.data.pwrCurve; }).length;
    // Aksesuar gücü İKİ YOLDAN gelebiliyor: kasnağın kendi devir→kW eğrisinden
    // (tedarikçi sayfasının biçimi) ya da duty satırına doğrudan yazılmış kW'dan
    // (Gates raporunun biçimi). Kart yalnız eğriyi sayarsa raporlu örnek
    // "0 aksesuar" der ve boş görünür; ikisi ayrı ayrı yazılıyor.
    var dutyKw = 0;
    (ex.solver.duty || []).forEach(function(r){
      var m = r && (r.kwByKey || r.kw);
      if(m) dutyKw = Math.max(dutyKw, Object.keys(m).filter(function(k){ return m[k] > 0.05; }).length);
    });
    // Birinci kademe SATIRI koşullu: 'derive' kipinde iki çap yazılır, 'direct'
    // kipinde o iki alan YOKTUR ve ham basmak "undefined / undefined mm"
    // üretiyordu. Oran her iki kipte de tek kaynaktan (veFeadDriveRatio).
    var dr = veFeadDriveRatio(ex.solver);
    var kademe = (dr.mode === 'derive' && dr.crankOD > 0 && dr.fanOD > 0)
      ? ('birinci kademe: ' + dr.crankOD + ' / ' + dr.fanOD + ' mm (oran '
         + dr.ratio.toFixed(3) + ')')
      : ('tahrik oranı: ' + dr.ratio.toFixed(3)
         + ' — devir sütunu SÜRÜCÜ KASNAK devri');
    var b = ex.belt || {};
    var kayis = 'kayış: ' + _feadEsc(b.beltType || ((b.ribs || '?') + b.profile))
      + ' · ' + b.effLength + ' mm'
      + ' · tolerans ' + (b.tolerance > 0 ? '±' + b.tolerance + ' mm' : 'YOK')
      + ' · aşınma ' + (b.wearPct > 0 ? '%' + (b.wearPct * 100).toFixed(2) : 'YOK');
    html += _feadCard(_feadEsc(ex.name), kasnak + ' kasnak', 'var(--accent-success)',
        '<div style="font-size:var(--fs-micro); color:var(--text-secondary); line-height:1.5; margin-bottom:9px;">'
      + _feadEsc(ex.note) + '</div>'
      + '<div style="font-size:var(--fs-micro); color:var(--text-muted); line-height:1.6; margin-bottom:10px;">'
      + '• kasnak koordinatları + çaplar + temas tarafı<br>'
      + '• gergi: pivot, kol boyu, montaj merkezi, yay künyesi<br>'
      + '• ' + kayis + '<br>'
      + '• ' + (egri ? egri + ' aksesuarın devir → kW eğrisi'
                     : dutyKw + ' aksesuarın kW\'ı duty satırında') + '<br>'
      + '• çalışma çevrimi: ' + ex.solver.duty.length + ' devir noktası<br>'
      + '• ' + kademe + '</div>'
      + '<button onclick="veFeadLoadExample(\'' + _feadEsc(k) + '\')" style="width:100%; padding:11px 16px; '
      + 'font-size:var(--fs-body); font-weight:700; letter-spacing:0.02em; border:none; cursor:pointer; '
      + 'background:var(--accent-success); color:#fff;">İç topolojiye kur</button>'
      + _feadHint('<b>Mevcut kasnakların üzerine eklenir</b>, silinmez — boş bir iç topolojide '
        + 'kurmak en temizidir.'));
  });
  html += '</div>';
  return html;
}

// ── ÖRNEĞİ KANVASA KUR ──────────────────────────────────────────────────────
// Örnek tanımı js/fead-model.js'te (VE_FEAD_EXAMPLES); burada YALNIZ kanvasa
// yerleştirme var. Kasnaklar kayış düzlemindeki GERÇEK koordinatlarına oranlı
// yerleştirilir: kanvasta gördüğü şekil sayfadaki yerleşimin ta kendisi olsun.
// (Kanvas y aşağı doğru artar, kayış düzlemi yukarı — bu yüzden y ters çevrilir.)
function veFeadLoadExample(key){
  if(typeof createNode !== 'function') return null;
  var pack = veFeadExampleNodes(key);
  if(!pack){ if(typeof showToast === 'function') showToast('Örnek bulunamadı: ' + key, 'error'); return null; }

  var xs = [], ys = [];
  pack.example.pulleys.forEach(function(p){
    var d = p.data;
    var x = (d.x != null) ? _feadNum(d.x, 0) : _feadNum(d.cenX, 0);
    var y = (d.y != null) ? _feadNum(d.y, 0) : _feadNum(d.cenY, 0);
    xs.push(x); ys.push(y);
  });
  var minX = Math.min.apply(null, xs), maxX = Math.max.apply(null, xs);
  var minY = Math.min.apply(null, ys), maxY = Math.max.apply(null, ys);

  // ── ÖLÇEK 1 px = 1 mm, "GÖRÜNÜME SIĞDIRAN" DEĞİL ────────────────────────
  //
  // Burada eskiden kümeyi 520×400'lük bir kutuya sığdıran bir ölçek vardı
  // (BMC'de ×1.1178) ve kutular köşe koordinatıyla diziliyordu. Kanvas artık
  // KAYIŞ DÜZLEMİ olduğu için bu sessiz bir TUTARSIZLIK üretiyordu: örnek
  // yüklenir yüklenmez kutunun kanvastaki yeri, düğümün taşıdığı mm
  // koordinatını YALANLIYORDU.
  //
  // ÖLÇÜLDÜ (gerçek tarayıcı, BMC, sürüklemeden ÖNCE):
  //   alternatör merkezi − krank merkezi = −319.108 px
  //   alternatör mm koordinatı           = −281.000 mm      → 38.108 mm FARK
  //
  // Fark = ölçek payı (−281 × 0.1178 = −33.11) + kutu genişliği payı
  // ((54−72)/2 = −5.00). İlk sürüklemede `veFeadSyncMmFromCanvas` kanvası
  // okuyup mm'yi tazelediği için o 38.108 mm koordinatın üstüne SESSİZCE
  // biniyordu: kullanıcı 60 px sürüklüyor, model 98 mm oynuyordu.
  //
  // Yerleştirme artık TEK NOKTADAN: aşağıdaki `veFeadArrangeByCoords` — yani
  // "Otomatik Düzenle"nin ve panel düzenlemesinin kullandığı yolun ta kendisi.
  // Buradaki dizi yalnız `createNode`'un ilk karesi ve o yol çalışamazsa
  // (iki kasnaktan az koordinat) geçerli kalan yedek; ölçeği bu yüzden 1.
  var s = (typeof VE_FEAD_PX_PER_MM === 'number') ? VE_FEAD_PX_PER_MM : 1;

  var yer = pack.example.pulleys.map(function(p, i){
    return { lx: 60 + (xs[i] - minX) * s, ly: 150 + (maxY - ys[i]) * s };
  });
  // Araç kutuları. SIRA pack.nodes ile aynı olmak ZORUNDA — veFeadExampleNodes
  // kasnakları önce, araçları (kayış künyesi · çözücü · kayış yolu) sonra ekliyor.
  //
  // KAYIŞ YOLU KARTI AYRI ŞERİTTE: 420×340'lık canlı şema üst şeride konsa
  // kasnak kümesinin üstüne biner ve komşu düğümlerin portları/rozetleri kartın
  // üstünde görünür (ölçüldü). Kullanıcının istediği yer de bu: topolojinin
  // YANINDA, kendi alanında duran bir çizim.
  var araclar = pack.nodes.length - pack.example.pulleys.length;
  var sagSerit = 60 + (maxX - minX) * s + 110;
  var ust = 0;
  for(var t = 0; t < araclar; t++){
    var tip = pack.nodes[pack.example.pulleys.length + t].type;
    var td = (typeof componentDefs !== 'undefined' && componentDefs[tip]) || {};
    if(tip === 'fead-layout'){
      // Ölçü de veriliyor: yoksa veArrangeModuleBase kartı 65×60 sayıp grubu
      // yanlış ortalıyor ve kart görünür alanın sağından taşıyor.
      yer.push({ lx: sagSerit, ly: 150, w: td.defaultWidth, h: td.defaultHeight });
    } else {
      // ARAÇLAR SOL ŞERİTTE, KASNAK KÜMESİNİN DIŞINDA. Eskiden kümenin ÜSTÜNE
      // bir sıra hâlinde diziliyorlardı (ly:20) ve "Başlangıç ve Örnekler"
      // kutusu tam kayış yolunun üstüne düşüyordu: tel kutunun arkasından
      // geçiyor, ikisi de okunmuyordu (ölçüldü — Klima ile Avara 1 arasındaki
      // açıklık oradan geçiyor). Sol şerit kümeyle hiç kesişmiyor.
      yer.push({ lx: -150, ly: 150 + ust * 96 });
      ust++;
    }
  }

  var base = (typeof veArrangeModuleBase === 'function')
    ? veArrangeModuleBase(yer) : { x:3000, y:3000 };

  // İÇ TOPOLOJİDE ZATEN DURAN ARAÇ DÜĞÜMLERİ DE SOL ŞERİDE. Alt topoloji ilk
  // açıldığında görünür alanın ORTASINA bir "Başlangıç ve Örnekler" düğümü
  // konuyor (veFeadPopulateStarter) — örnek de aynı merkeze kurulduğu için o
  // düğüm kasnak kümesinin tam ortasında kalıyor ve kayış yolu arkasından
  // geçiyordu (ölçüldü: Klima ↔ Avara 1 açıklığının üstünde). Yeni gelenlerle
  // aynı şeride alınıyor; kullanıcının kendi eklediği kasnaklara dokunulmuyor.
  var _eskiArac = [];
  if(typeof nodes !== 'undefined') {
    nodes.forEach(function(n){
      var d0 = _feadDefOf(n);
      if(d0.isFeadExample || d0.isFeadBelt || d0.isFeadSolver || d0.isFeadReport) _eskiArac.push(n);
    });
  }
  _eskiArac.forEach(function(n, i){
    n.x = Math.round(base.x - 150);
    n.y = Math.round(base.y + 150 + (ust + i) * 96);
    var el = (typeof document !== 'undefined') ? document.getElementById(n.id) : null;
    if(el){ el.style.left = n.x + 'px'; el.style.top = n.y + 'px'; }
  });

  var kuruldu = [], idMap = {};
  pack.nodes.forEach(function(src, i){
    var before = (typeof nodes !== 'undefined') ? nodes.length : 0;
    createNode(src.type, base.x + yer[i].lx, base.y + yer[i].ly);
    if(typeof nodes === 'undefined' || nodes.length <= before) return;
    var yeni = nodes[nodes.length - 1];
    yeni.data = JSON.parse(JSON.stringify(src.data));
    if(src.customName){
      yeni.customName = src.customName;
      // KANVAS ETİKETİ ELLE TAZELENİR: createNode etiketi tip adıyla basıyor,
      // customName'i sonradan atamak DOM'u güncellemiyor. Tazelenmezse iki
      // avara kasnak da "Avara Kasnak" görünür — hesap doğru çalışır (adlar
      // veFeadUniqueNames'te tekilleşir) ama kullanıcı hangi avaranın hangi
      // koordinatta olduğunu kanvasta AYIRT EDEMEZ.
      var el = (typeof document !== 'undefined') ? document.getElementById(yeni.id) : null;
      var lbl = el && el.querySelector('.ve-node-label');
      if(lbl) lbl.textContent = src.customName;
    }
    idMap[src.id] = yeni.id;
    kuruldu.push(yeni);
  });

  // DUTY kW SÖZLÜĞÜ KİMLİK GÖÇÜNDEN GEÇMEK ZORUNDA. Yukarıdaki döngü her düğümü
  // YENİ bir kimlikle kuruyor (createNode kendi kimliğini üretir) ama data'yı
  // birebir kopyalıyor; kW sözlüğü ise düğüm kimliğiyle anahtarlı. Göç
  // yapılmazsa hiçbir aksesuar eşleşmez ve hepsi 0 kW ile koşar — çözüm yine
  // üretilir, yalnız bütün gerginlikler tasarım gerginliğine düzleşir. Göç
  // ancak idMap TAMAMLANDIKTAN sonra yapılabilir (çözücü düğümü de aynı
  // döngüde kuruluyor), bu yüzden döngünün İÇİNDE değil, burada.
  kuruldu.forEach(function(n){
    if(n.data && Array.isArray(n.data.duty)) veFeadRemapDutyKw(n.data.duty, idMap);
  });

  if(typeof createConnection === 'function'){
    pack.connections.forEach(function(c){
      if(idMap[c.from] && idMap[c.to]) createConnection(idMap[c.from], idMap[c.to]);
    });
  }
  // KUTULARI KOORDİNATLARINA OTURT — kanvas ile mm ilk kareden itibaren AYNI
  // şeyi söylesin. Sessiz kip: saveState/toast/kamera bu fonksiyonun kendisine
  // ait (ikinci bir undo adımı ve üst üste iki bildirim istenmiyor).
  if(typeof veFeadArrangeByCoords === 'function'){
    try { veFeadArrangeByCoords({ silent: true }); } catch(e){ /* yedek: yukarıdaki sıra */ }
  }
  if(typeof updateAllConnections === 'function') updateAllConnections();
  if(typeof veFeadRefreshBadges === 'function') veFeadRefreshBadges();
  _feadForgetResults();
  if(typeof veFitViewToContent === 'function') veFitViewToContent();
  if(typeof saveState === 'function') saveState();
  if(typeof showToast === 'function')
    showToast(pack.example.name + ' kuruldu — ' + kuruldu.length + ' bileşen, '
      + pack.connections.length + ' kayış bağlantısı.', 'success');
  return kuruldu;
}


// ════════════════════════════════════════════════════════════════════════════
//  ÇALIŞMA ÇEVRİMİ — DÜZENLEME
// ════════════════════════════════════════════════════════════════════════════
function _feadSolverNode(nodeId){
  if(typeof nodes === 'undefined') return null;
  var n = nodes.find(function(x){ return x.id === nodeId; });
  if(!n) return null;
  if(!n.data) n.data = {};
  if(!Array.isArray(n.data.duty)) n.data.duty = [];
  return n;
}
function _feadRedraw(node){
  if(typeof saveState === 'function') saveState();
  if(typeof showNodeProperties === 'function') showNodeProperties(node);
}

function veFeadDutyAdd(nodeId){
  var n = _feadSolverNode(nodeId); if(!n) return;
  var son = n.data.duty[n.data.duty.length - 1];
  // Yeni satır son satırın devamı gibi başlasın (boş kutuya bakmaktan iyi):
  // devir bir kademe yukarı, sıcaklık aynı.
  n.data.duty.push({
    rpm: son ? _feadNum(son.rpm, 800) + 250 : 800,
    dcPct: '', degC: son ? son.degC : 90, kw: {}
  });
  _feadRedraw(n);
}
function veFeadDutyRemove(nodeId, idx){
  var n = _feadSolverNode(nodeId); if(!n) return;
  n.data.duty.splice(idx, 1);
  _feadRedraw(n);
}
function veFeadDutySet(nodeId, idx, key, val){
  var n = _feadSolverNode(nodeId); if(!n) return;
  var row = n.data.duty[idx]; if(!row) return;
  if(key.indexOf('kw:') === 0){
    if(!row.kw) row.kw = {};
    var pid = key.slice(3);
    if(val === '' || val === null) delete row.kw[pid]; else row.kw[pid] = val;
  } else {
    row[key] = val;
  }
  if(typeof saveState === 'function') saveState();
  // Paneli YENİDEN ÇİZMİYORUZ: kullanıcı hücreler arasında sekme ile geziniyor,
  // her değişiklikte yeniden çizmek odağı kaybettirir. Sonuç bloğu bir sonraki
  // ▶ Hesapla ile tazelenir.
}

// Boş kW hücrelerini katalogdan doldur — kullanıcı sayıları GÖRSÜN, yer
// tutucuda kalmasın (yer tutucu kaydedilmiyor, değer kaydediliyor).
function veFeadDutyFillCatalog(nodeId){
  var n = _feadSolverNode(nodeId); if(!n) return;
  var build = veFeadBuildFromCanvas();
  if(!build.ok){
    if(typeof showToast === 'function') showToast('Model çözülemeden katalog doldurulamaz', 'error');
    return;
  }
  var say = 0;
  n.data.duty.forEach(function(row){
    if(!row.kw) row.kw = {};
    build.order.forEach(function(pn, i){
      if(build.sys.pulleys[i] && build.sys.pulleys[i].crank) return;
      if(row.kw[pn.id] != null && row.kw[pn.id] !== '') return;      // kullanıcının değeri korunur
      var kw = veFeadAutoKw(build.sys, i, pn, _feadNum(row.rpm, 0));
      if(kw != null){ row.kw[pn.id] = Math.round(kw * 100) / 100; say++; }
    });
  });
  if(typeof showToast === 'function')
    showToast(say ? say + ' hücre katalogdan dolduruldu' : 'Katalog modeli seçili aksesuar yok', say ? 'success' : 'info');
  _feadRedraw(n);
}

// ════════════════════════════════════════════════════════════════════════════
//  ÇÖZÜM
// ════════════════════════════════════════════════════════════════════════════
// Sonuç OTURUMLUK bir global: window.veFeadResults. Takoz modülündeki
// veMountResults ile aynı kalıp — ve aynı tuzak: proje değişince temizlenmeli,
// yoksa yeni projede ÖNCEKİ projenin sonuçları durur (bkz. _feadForgetResults,
// topology.js veResetSubtopoNav'dan çağrılıyor).
function veFeadSolve(nodeId){
  var node = _feadSolverNode(nodeId);
  var build = veFeadBuildFromCanvas();
  if(!build.ok){
    if(typeof showToast === 'function')
      showToast('Çözülemedi: ' + (build.errors[0] || 'model eksik'), 'error');
    if(node) _feadRedraw(node);
    return null;
  }
  var res = veFeadAnalyze(build, {
    rows: veFeadDutyRows(node),
    cylinders: _feadNum(node && node.data && node.data.cylinders, 6),
    // Burulma modelinin krank serbestliği kasnağın değil KRANK MİLİNİN ataletini
    // ister; panel bu sayıyı zaten soruyor (bkz. veFeadTorsionalOpt).
    crankInertia: _feadNum(node && node.data && node.data.crankInertia, 0),
    fatigueModel: (node && node.data && node.data.fatigueModel) || 'PK-2_2p-MT3'
  });
  res.solvedNodeId = nodeId;
  res.pulleyNames = build.names;
  // KURULMUŞ SİSTEM SONUCA TAŞINIR. Rapor üreteci (cp-fead-report.js) kayış
  // künyesini, kasnak çaplarını ve gergi parametrelerini buradan okur —
  // yeniden veFeadBuildFromCanvas() çağırsaydı, çözümden SONRA değiştirilmiş
  // bir alan raporun girdi tablosuna sızar ve belge kendi sayılarıyla
  // çelişirdi. Rapor ÇÖZÜLEN modeli anlatır.
  res.build = build;
  // SERVİS FAKTÖRÜ sonuca TAŞINIR: kayma emniyetinin istenen alt sınırı bu.
  // Eskiden tabloda 1.3 SABİT yazıyordu — sayfadaki değerle aynı olması
  // tesadüftü; farklı bir servis faktörü giren kullanıcı yine 1.3'e göre
  // renklenmiş bir tablo görüyordu.
  res.serviceFact = _feadNum(node && node.data && node.data.serviceFact, 0);
  if(typeof window !== 'undefined') window.veFeadResults = res;
  if(typeof showToast === 'function')
    showToast(res.ok ? 'FEAD çözüldü — ' + res.duty.length + ' devir noktası'
                     : 'Çözüm hatası: ' + res.error, res.ok ? 'success' : 'error');
  if(node) _feadRedraw(node);
  return res;
}
function _feadForgetResults(){
  // Animasyon fazı da oturumluk: yeni projede kayış önceki modelin fazından
  // devam etmesin (yük değişince faz çevrim boyunu aşabilir de).
  _feadAnimPhase = {};
  if(typeof window !== 'undefined') window.veFeadResults = null;
}

// ════════════════════════════════════════════════════════════════════════════
//  SONUÇ BLOĞU (çözücü panelinin altı)
// ════════════════════════════════════════════════════════════════════════════
function veFeadResultBlock(node){
  var R = (typeof window !== 'undefined') ? window.veFeadResults : null;
  if(!R) return '';
  if(R.solvedNodeId && node && R.solvedNodeId !== node.id) return '';
  if(!R.ok) return veFeadProblemBox({ errors: [R.error || 'Çözüm başarısız.'] });

  var h = '';
  if(R.duty.length) h += veFeadDutyResultTable(R);
  if(R.torsional) h += veFeadTorsionalCard(R);
  if(R.fatigue) h += veFeadFatigueTable(R);
  if(R.life) h += veFeadLifeCard(R);
  h += veFeadLimitsBox(R);
  return h;
}

// ── BURULMA (DÖNEL TİTREŞİM) MODELİ ─────────────────────────────────────────
// Çekirdek modu hesaplıyordu ama hiçbir yerde GÖRÜNMÜYORDU. Sayının mühendislik
// karşılığı tek başına frekans değil, ateşleme frekansıyla ÇAKIŞIP çakışmaması:
// FEAD'i uyaran baskın kuvvet motorun ateşleme mertebesidir ve duty tablosu
// hangi devir bandında çalışıldığını zaten söylüyor. Kart bu örtüşmeyi
// ARİTMETİK olarak kuruyor — yeni bir model değil, iki bilinen sayının
// karşılaştırması — ve hüküm vermiyor, gözlem yazıyor.
function veFeadTorsionalCard(R){
  var T = R.torsional;
  if(!T || !Number.isFinite(T.firstElasticHz)) return '';
  var A = R.analysis;

  var h = '<div style="display:flex; align-items:baseline; gap:8px; margin-bottom:6px;">'
    + '<span style="font-size:var(--fs-h2); font-weight:700; color:var(--text-heading);">'
    + _feadFmt(T.firstElasticHz, 1) + '</span>'
    + '<span style="font-size:var(--fs-body); color:var(--text-muted);">Hz — 1. elastik mod</span></div>';

  // Bütün elastik modlar. Rijit cisim modu (f = 0, sistem birlikte döner)
  // LİSTELENMEZ ama SAYISI yazılır: tam 1 tane olmak zorunda, fazlası modelin
  // koptuğunu (bir kasnağın kayıştan ayrıldığını) gösterir.
  var mod = (T.elasticHz || []).slice(0, 6);
  if(mod.length) h += _feadHint('Elastik modlar: <b>'
    + mod.map(function(f){ return _feadFmt(f, 1); }).join(' · ') + '</b> Hz'
    + ((T.elasticHz.length > mod.length) ? ' (+' + (T.elasticHz.length - mod.length) + ' tane)' : '')
    + ' · rijit cisim modu ' + T.rigidBodyModes + ' (1 olmalı)'
    + ' · serbestlik ' + (T.dofNames || []).length);

  // Ateşleme frekansı bandıyla örtüşme.
  if(A && A.duty && A.duty.length){
    var fs = A.duty.map(function(d){ return d.firingHz; });
    var lo = Math.min.apply(null, fs), hi = Math.max.apply(null, fs);
    var ic = (T.elasticHz || []).filter(function(f){ return f >= lo && f <= hi; });
    var rpmOf = function(f){
      var d0 = A.duty[0];
      return (d0 && d0.firingHz > 0) ? (f / d0.firingHz * d0.engineRpm) : NaN;
    };
    h += _feadHint('Duty tablosunun ateşleme frekansı bandı <b>' + _feadFmt(lo, 1) + '–'
      + _feadFmt(hi, 1) + ' Hz</b>. '
      + (ic.length
          ? '<b style="color:var(--accent-warning);">Bu bandın içinde ' + ic.length
            + ' elastik mod var</b> (' + ic.map(function(f){ return _feadFmt(f, 1); }).join(' · ')
            + ' Hz ≈ ' + ic.map(function(f){ return _feadFmt(rpmOf(f), 0); }).join(' · ')
            + ' rpm). Ateşleme mertebesi bu devirlerde modu uyarır.'
          : 'Hiçbir elastik mod bu bandın içine düşmüyor; 1. mod '
            + _feadFmt(rpmOf(T.firstElasticHz), 0) + ' rpm ateşleme mertebesine karşılık geliyor.'));
  }

  // TAKE-UP ÖZDEŞLİĞİ — modelin kendi iç tutarlılık kapısı. Kol→span uzama
  // türevlerinin toplamı gergi take-up oranına EŞİT olmak zorunda; ayrışırsa
  // geometri ile dinamik model farklı şeyi anlatıyor demektir.
  if(T.takeupCheck && Number.isFinite(T.takeupCheck.errPct)){
    var tk = T.takeupCheck.errPct, iyi = tk < 1;
    h += _feadHint('Take-up özdeşliği: Σ(∂span/∂kol) ile gergi take-up oranı '
      + '<b style="color:' + (iyi ? 'var(--accent-success)' : 'var(--accent-danger)') + ';">%'
      + _feadFmt(tk, 3) + '</b> farkla ' + (iyi ? 'tutuyor' : 'TUTMUYOR') + '.');
  }

  return _feadCard('Burulma Titreşimi', 'çalışma (Mean) konumunda · kalibre model',
    'var(--accent-warning)', h);
}

// Duty noktası başına: kasnak çıkış gerilmesi, hubload, kayma emniyeti.
// Tek tabloda devir × kasnak; kayış hızı ve ateşleme frekansı satır başında.
function veFeadDutyResultTable(R){
  var A = R.analysis;
  var isim = R.pulleyNames || [];
  var th = function(t, w){ return '<th style="padding:3px 4px; border:1px solid var(--border-color); font-weight:600; color:var(--text-secondary);'
    + (w ? ' width:' + w : '') + '">' + t + '</th>'; };
  var td = function(v, col){ return '<td style="padding:3px 4px; border:1px solid var(--border-color); text-align:right;'
    + (col ? ' color:' + col + ';' : '') + '">' + v + '</td>'; };

  // İSTENEN alt sınır kullanıcının girdiği servis faktörü; girilmemişse yalnız
  // kayma sınırı (1.0) kırmızıya boyanır — uydurma bir eşik gösterilmez.
  var SF_ist = _feadNum(R.serviceFact, 0);
  var sfRenk = function(sf){
    if(sf < 1) return 'var(--accent-danger)';
    if(SF_ist > 0 && sf < SF_ist) return 'var(--accent-warning)';
    return null;
  };
  var h = '<div style="overflow-x:auto;"><table style="width:100%; font-size:var(--fs-micro); border-collapse:collapse; border:1px solid var(--border-color);">';
  h += '<tr style="background:var(--bg-tertiary);">' + th('Devir') + th('%') + th('Kayış [m/s]')
     + isim.map(function(n){ return th(n); }).join('') + th('Min SF') + '</tr>';
  var enKucukSF = Infinity, enKucukRpm = null;
  A.duty.forEach(function(d){
    var minSF = Math.min.apply(null, d.slip.map(function(x){ return x.SF; }));
    if(minSF < enKucukSF){ enKucukSF = minSF; enKucukRpm = d.engineRpm; }
    h += '<tr>' + td(d.engineRpm) + td(_feadFmt(d.dcPct, 1)) + td(_feadFmt(d.vMs, 2))
       + d.perPulley.map(function(p){ return td(_feadFmt(p.exitTensionN, 0)); }).join('')
       + td(_feadFmt(minSF, 2), sfRenk(minSF))
       + '</tr>';
  });
  h += '</table></div>';

  // SERVİS FAKTÖRÜ HÜKMÜ — Motor Künyesi kartındaki söz burada karşılanıyor.
  if(SF_ist > 0 && Number.isFinite(enKucukSF)){
    var gecti = enKucukSF >= SF_ist;
    h += '<div style="display:flex; justify-content:space-between; gap:8px; font-size:var(--fs-micro); '
      + 'line-height:1.5; padding:7px 9px; margin-top:7px; background:var(--bg-tertiary); '
      + 'border:1px solid ' + (gecti ? 'var(--accent-success)' : 'var(--accent-danger)') + '; '
      + 'border-radius:var(--radius-sm);">'
      + '<span style="color:var(--text-muted);">Servis faktörü ' + _feadFmt(SF_ist, 2)
      + ' &nbsp;·&nbsp; en kötü nokta ' + enKucukRpm + ' rpm</span>'
      + '<span style="font-family:ui-monospace,monospace; font-weight:700; color:'
      + (gecti ? 'var(--accent-success)' : 'var(--accent-danger)') + ';">'
      + 'min SF = ' + _feadFmt(enKucukSF, 2) + (gecti ? '  ✓ GEÇTİ' : '  ✗ KALDI') + '</span></div>';
  }

  var neg = A.duty.some(function(d){ return d.warnings && d.warnings.length; });
  var kayma = A.duty.some(function(d){ return d.slip.some(function(x){ return x.SF < 1; }); });
  var ek = '';
  if(kayma) ek += _feadHint('<b style="color:var(--accent-danger);">Kayma emniyet faktörü 1\'in altına '
    + 'iniyor</b> — kayış o devirde kaymaya başlar. Tasarım gerginliğini yükseltin ya da sarım açısını artırın.');
  if(neg) ek += _feadHint('<b style="color:var(--accent-warning);">Bir spanda negatif gerilme</b> — '
    + 'kayış gevşiyor: tasarım gerginliği yetersiz.');

  // KONUM YAZILIR: gerilme, hubload ve kayma HEP ÇALIŞMA (Mean) konumunda
  // hesaplanır (FEADCore.analyze meanRel'i kullanır), oysa yukarıdaki Geometri
  // tablosu kullanıcının seçtiği kol konumunu gösterebiliyor. Sarım açısı
  // konuma göre değiştiği için hubload da değişir; iki tabloyu yan yana okuyan
  // kullanıcı hangi konumu gördüğünü söylemezsek yanlış eşleştirir.
  return _feadCard('Çıkış Gerilmeleri', 'çalışma (Mean) konumunda, duty noktası başına [N]', 'var(--accent-primary)',
    h + ek + _feadHint('Hubload ve span frekansları için aşağıdaki hubload tablosuna bakın. '
      + 'Ateşleme frekansı ' + _feadFmt(A.duty.length ? A.duty[0].firingHz : 0, 1) + ' Hz @ '
      + (A.duty.length ? A.duty[0].engineRpm : 0) + ' rpm (silindir sayısı Çözücü panelinden).'))
    + veFeadHubTable(R);
}

function veFeadHubTable(R){
  var A = R.analysis, isim = R.pulleyNames || [];
  var h = '<div style="overflow-x:auto;"><table style="width:100%; font-size:var(--fs-micro); border-collapse:collapse; border:1px solid var(--border-color);">';
  h += '<tr style="background:var(--bg-tertiary);"><th style="padding:3px 4px; border:1px solid var(--border-color); font-weight:600; color:var(--text-secondary);">Devir</th>'
     + isim.map(function(n){ return '<th style="padding:3px 4px; border:1px solid var(--border-color); font-weight:600; color:var(--text-secondary);">' + n + '</th>'; }).join('')
     + '</tr>';
  A.duty.forEach(function(d){
    h += '<tr><td style="padding:3px 4px; border:1px solid var(--border-color); text-align:right;">' + d.engineRpm + '</td>'
      + d.hubloads.map(function(x){
          return '<td style="padding:3px 4px; border:1px solid var(--border-color); text-align:right;">'
            + _feadFmt(x.FN, 0) + ' <span style="color:var(--text-muted);">/ ' + _feadFmt(x.dirDeg, 0) + '°</span></td>';
        }).join('') + '</tr>';
  });
  h += '</table></div>';
  return _feadCard('Hubload', 'çalışma (Mean) konumunda · büyüklük [N] / yön [°]', 'var(--accent-primary)', h);
}

function veFeadFatigueTable(R){
  var f = R.fatigue;
  var h = '<table style="width:100%; font-size:var(--fs-micro); border-collapse:collapse; border:1px solid var(--border-color);">'
    + '<tr style="background:var(--bg-tertiary);">'
    + ['Kasnak', 'd_eff [mm]', 'Temas', 'Hasar payı'].map(function(t){
        return '<th style="padding:3px 5px; border:1px solid var(--border-color); text-align:left; font-weight:600; color:var(--text-secondary);">' + t + '</th>';
      }).join('') + '</tr>';
  f.perPulley.forEach(function(p){
    h += '<tr><td style="padding:3px 5px; border:1px solid var(--border-color);">' + _feadEsc(p.name) + '</td>'
      + '<td style="padding:3px 5px; border:1px solid var(--border-color); text-align:right;">' + _feadFmt(p.dEffMm, 1) + '</td>'
      + '<td style="padding:3px 5px; border:1px solid var(--border-color); color:var(--text-muted);">' + veFeadContactLabel(p.contact) + '</td>'
      + '<td style="padding:3px 5px; border:1px solid var(--border-color); text-align:right; font-weight:600;">%' + _feadFmt(p.sharePct, 1) + '</td></tr>';
  });
  h += '</table>';
  return _feadCard('Kaburga Yorulma Dağılımı', f.constants.fatigueModel, 'var(--accent-warning)',
    h + _feadHint('Dağılım YALNIZ çapa ve temas tarafına bağlıdır (gerilmeden bağımsız): '
      + 'hasar ∝ w · d<sub>eff</sub><sup>−m</sup>, m = ' + f.constants.m
      + ' · w<sub>sırt</sub> = ' + f.constants.wBackside + '. Göreli karşılaştırma için '
      + 'GÜVENİLİR ölçüt budur — mutlak ömür değil.'));
}

function veFeadLifeCard(R){
  var L = R.life;
  var gecerli = L.inValidRange;
  var saat = gecerli ? L.hoursB10 : L.hoursB10Corrected;
  var h = '<div style="display:flex; align-items:baseline; gap:8px; margin-bottom:6px;">'
    + '<span style="font-size:var(--fs-h2); font-weight:700; color:' + (gecerli ? 'var(--text-heading)' : 'var(--accent-warning)') + ';">'
    + _feadFmt(saat, 0) + '</span>'
    + '<span style="font-size:var(--fs-body); color:var(--text-muted);">saat (B10)'
    + (gecerli ? '' : ' — ampirik düzeltmeli') + '</span></div>';
  // SEÇİLEN YORULMA MODELİ MUTLAK ÖMRE GEÇMİYOR — bunu kartın kendisi söylemeli.
  // Dağılım tablosu hemen üstte seçilen modelin adıyla basılıyor; altındaki saat
  // değeri başka bir üsse göre. Ayrımı yalnız "Geçerlilik Sınırları" kutusuna
  // bırakmak, iki tabloyu yan yana okuyan kullanıcıyı yanıltırdı.
  if(L.modelMismatch)
    h += _feadHint('<b style="color:var(--accent-warning);">SEÇİLEN YORULMA MODELİNE GÖRE DEĞİL.</b> '
      + 'Bu saat değeri <b>' + _feadEsc(L.calibratedModel || 'PK-2_2p-MT3') + '</b> sabitleriyle '
      + 'kalibre edilmiştir; Çözücü panelinde <b>' + _feadEsc(L.modelMismatch) + '</b> seçili. '
      + 'Yukarıdaki <b>dağılım</b> seçtiğiniz modeli kullanır ve geçerlidir — <b>mutlak ömür '
      + 'kullanmaz</b>. Karşılaştırma için dağılıma bakın.');
  if(!gecerli)
    h += _feadHint('<b style="color:var(--accent-warning);">GEÇERLİLİK ALANI DIŞINDA.</b> '
      + 'Model mutlak ömrü yalnız tüm kasnak çapları 79.6–176 mm iken doğrular. Aralık dışında '
      + 'sistematik olarak ~0.55× veriyor; yukarıdaki sayı bu ampirik düzeltmeyi içerir. '
      + 'Aralık dışı: ' + _feadEsc((L.outOfRange || []).join(', '))
      + '. <b>Sertifikasyon için kullanmayın</b> — göreli karşılaştırma için yorulma dağılımını kullanın.');
  return _feadCard('Kayış Ömrü', 'ham ' + _feadFmt(L.hoursB10, 0) + ' saat', 'var(--accent-danger)', h);
}

function veFeadLimitsBox(R){
  if(!R.limits || !R.limits.length) return '';
  var h = '<ul style="margin:0; padding-left:18px; font-size:var(--fs-micro); line-height:1.6; color:var(--text-secondary);">';
  R.limits.forEach(function(x){ h += '<li>' + x + '</li>'; });
  (R.warnings || []).forEach(function(x){ h += '<li style="color:var(--accent-warning);">' + _feadEsc(x) + '</li>'; });
  return _feadCard('Geçerlilik Sınırları', 'spesifikasyon §7', 'var(--text-secondary)', h + '</ul>');
}

// Jest/Node köprüsü (tarayıcıda no-op)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    VE_FEAD_STARTER_LAYOUT: VE_FEAD_STARTER_LAYOUT,
    veFeadLayoutSVG: veFeadLayoutSVG,
    veFeadPortSideFor: veFeadPortSideFor,
    veFeadApplyBadge: veFeadApplyBadge,
    veFeadApplyBeltModeBadge: veFeadApplyBeltModeBadge,
    veFeadApplyDiaGhost: veFeadApplyDiaGhost,
    veFeadRefreshDiaGhosts: veFeadRefreshDiaGhosts,
    veFeadSyncDrag: veFeadSyncDrag,
    veFeadPlaceFromCoords: veFeadPlaceFromCoords,
    VE_FEAD_COORD_KEYS: VE_FEAD_COORD_KEYS,
    veFeadToggleBeltMode: veFeadToggleBeltMode,
    veFeadDerivedLengthHTML: veFeadDerivedLengthHTML,
    veFeadBeltCatalogCard: veFeadBeltCatalogCard,
    veFeadPickBelt: veFeadPickBelt,
    veFeadApplyLayoutCard: veFeadApplyLayoutCard,
    veFeadPosPicker: veFeadPosPicker,
    // Animasyon: yürüyüş + faz + döngü. Testler dişleri ve kolları doğrudan
    // bu saf fonksiyonlardan üretip ölçüyor (DOM'suz).
    _feadBeltWalk: _feadBeltWalk, _feadTeethPath: _feadTeethPath,
    _feadSpokePath: _feadSpokePath, _feadToothStep: _feadToothStep,
    _feadXform: _feadXform, _feadAnimLabel: _feadAnimLabel,
    veFeadAnimTick: veFeadAnimTick, veFeadAnimEnsure: veFeadAnimEnsure,
    veFeadAnimApply: veFeadAnimApply,
    veFeadCompassPlace: veFeadCompassPlace, veFeadCompassReset: veFeadCompassReset,
    veFeadCompassDragStart: veFeadCompassDragStart,
    VE_FEAD_ROSE_W: VE_FEAD_ROSE_W, VE_FEAD_ROSE_HALF: VE_FEAD_ROSE_HALF,
    VE_FEAD_ANIM_ATTR: VE_FEAD_ANIM_ATTR,
    VE_FEAD_SPOKE_N: VE_FEAD_SPOKE_N, VE_FEAD_SPOKE_MIN_PX: VE_FEAD_SPOKE_MIN_PX,
    veFeadLayoutCardHTML: veFeadLayoutCardHTML,
    veFeadLayoutCardStrip: veFeadLayoutCardStrip,
    veFeadRefreshLayoutCards: veFeadRefreshLayoutCards,
    VE_FEAD_CARD_CLASS: VE_FEAD_CARD_CLASS,
    veFeadBeltDbHint: veFeadBeltDbHint,
    veFeadModelTable: veFeadModelTable,
    veFeadPositionTable: veFeadPositionTable,
    veFeadGeometryTable: veFeadGeometryTable,
    veFeadProblemBox: veFeadProblemBox,
    veFeadWarningBox: veFeadWarningBox,
    veFeadDutyEditor: veFeadDutyEditor, veFeadSolve: veFeadSolve,
    veFeadDutyAdd: veFeadDutyAdd, veFeadDutyRemove: veFeadDutyRemove,
    veFeadDutySet: veFeadDutySet, veFeadDutyFillCatalog: veFeadDutyFillCatalog,
    veFeadResultBlock: veFeadResultBlock, _feadForgetResults: _feadForgetResults,
    veFeadDutyResultTable: veFeadDutyResultTable, veFeadHubTable: veFeadHubTable,
    veFeadFatigueTable: veFeadFatigueTable, veFeadLifeCard: veFeadLifeCard,
    veFeadTorsionalCard: veFeadTorsionalCard,
    veFeadDriveCard: veFeadDriveCard, veFeadEngineCard: veFeadEngineCard,
    veFeadMountReadout: veFeadMountReadout,
    veFeadPowerCurveCard: veFeadPowerCurveCard,
    veFeadCurveAdd: veFeadCurveAdd, veFeadCurveRemove: veFeadCurveRemove,
    veFeadCurveSet: veFeadCurveSet, veFeadLoadExample: veFeadLoadExample,
    veFeadArrangeByCoords: veFeadArrangeByCoords,
    getFeadModulePropertiesHTML: getFeadModulePropertiesHTML,
    getFeadPulleyPropertiesHTML: getFeadPulleyPropertiesHTML,
    getFeadTensionerPropertiesHTML: getFeadTensionerPropertiesHTML,
    getFeadBeltPropertiesHTML: getFeadBeltPropertiesHTML,
    getFeadLayoutPropertiesHTML: getFeadLayoutPropertiesHTML,
    getFeadSolverPropertiesHTML: getFeadSolverPropertiesHTML,
    getFeadExamplePropertiesHTML: getFeadExamplePropertiesHTML
  };
}
