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
  html += '<div style="padding:8px 10px; margin-bottom:10px; font-size:var(--fs-tiny); line-height:1.45; color:var(--text-secondary); background:var(--bg-secondary); border:1px solid var(--border-color); border-left:3px solid var(--accent-warning);">'
        + '<b style="color:var(--text-heading);">FEAD — alt-sistem.</b> '
        + 'Motorun ön uç kayış-kasnak sistemi. Üstüne <b>çift tıklayınca</b> kendi <b>alt topolojisine</b> girilir. '
        + 'Krank Kasnağı / Alternatör / Klima / Su Pompası / Direksiyon / Fan / Avara / Gergi bileşenlerini orada kurar, '
        + '<b>kayış yolunu</b> bağlantılarla (Krank çıkışı → … → Krank girişi) çizersiniz.'
        + '</div>';
  html += '<table style="width:100%; font-size:var(--fs-body); border-collapse:collapse; border:1px solid var(--border-color); margin-bottom:10px;">';
  if(initialized){
    html += '<tr><td style="padding:5px 8px; border:1px solid var(--border-color); color:var(--text-secondary);">Bileşen</td><td style="padding:5px 8px; border:1px solid var(--border-color); color:var(--text-primary); font-weight:600;">' + nCount + '</td></tr>';
    html += '<tr><td style="padding:5px 8px; border:1px solid var(--border-color); color:var(--text-secondary);">Bağlantı</td><td style="padding:5px 8px; border:1px solid var(--border-color); color:var(--text-primary); font-weight:600;">' + cCount + '</td></tr>';
  } else {
    html += '<tr><td style="padding:7px 8px; border:1px solid var(--border-color); color:var(--text-muted);">Henüz açılmadı — ilk açılışta "Başlangıç ve Örnekler" bileşeni ile başlar.</td></tr>';
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

function veFeadSet(nodeId, key, val){
  if(typeof nodes === 'undefined') return;
  var node = nodes.find(function(n){ return n.id === nodeId; });
  if(!node) return;
  if(!node.data) node.data = {};
  node.data[key] = val;
  if(typeof saveState === 'function') saveState();
}

// ── KANVAS ROZETİ: temas tarafı + sürücü ────────────────────────────────────
// Temas tarafı hesabın en tehlikeli girdisi: ters verilirse çekirdek GEÇERLİ
// ama BAŞKA bir kayış yolu çözer, hata vermez. Panelde bir açılır listede
// gizlenirse kullanıcı yanlışı fark edemez. Bu yüzden değer kanvasta, düğümün
// üstünde durur — "K" kaburgalı, "S" sırttan; sürücü kasnak ayrıca "►" taşır.
// Stil ELEMANIN ÜSTÜNDE (css/ dosyasında değil) çünkü css/styles.css'e
// dokunmak Ölçüm Görüntüleyici'nin dağıtım dosyasını bayatlatıyor (bkz.
// CLAUDE.md); tek rozet için o zinciri kurmaya değmez.
function veFeadApplyBadge(nodeEl, node){
  if(!nodeEl || !node || typeof document === 'undefined') return false;
  var old = nodeEl.querySelector('.ve-fead-badge');
  if(old) old.remove();
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
  if(key === 'contact') veFeadRefreshBadges();
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

  var rol = isDriver ? 'Bu kasnak SÜRÜCÜ: kayışı o döndürür, gücü diğerlerinin toplamıdır.'
          : isIdler  ? 'Avara kasnak — yük çekmez, yalnız kayış yolunu yönlendirir ve sarım açısını artırır.'
                     : 'Aksesuar — kayıştan güç çeker.';
  html += '<div style="padding:8px 10px; margin-bottom:10px; font-size:var(--fs-tiny); line-height:1.45; color:var(--text-secondary); background:var(--bg-secondary); border:1px solid var(--border-color); border-left:3px solid var(--accent-warning);">'
        + '<b style="color:var(--text-heading);">' + _feadEsc(_feadNodeName(node)) + '.</b> ' + rol + '</div>';

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
  html += '<div style="padding:8px 10px; margin-bottom:10px; font-size:var(--fs-tiny); line-height:1.45; color:var(--text-secondary); background:var(--bg-secondary); border:1px solid var(--border-color); border-left:3px solid var(--accent-warning);">'
        + '<b style="color:var(--text-heading);">Gergi.</b> Kayış gerginliğini çalışma boyunca sabit tutar: pivot etrafında dönen kolun ucundaki kasnak, yay momentiyle kayışa bastırır.</div>';

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

  html += _feadCard('Kol ve Pivot', '[mm]', 'var(--text-secondary)',
      _feadGrid(node, [
        { key:'pivotX', label:'Pivot X', ph:'0' },
        { key:'pivotY', label:'Pivot Y', ph:'0' },
        { key:'armLen', label:'Kol boyu (Arm Length)', ph:'90' }
      ], 3)
    + _feadHint('Pivot, kolun döndüğü sabit noktadır. Kasnak merkezi pivot + kol boyu + kol '
        + 'açısından TÜRETİLİR. Kol boyu 56–90 mm aralığında doğrulandı.'));

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

  html += _feadCard('Mekanik Sınır ve Atalet', 'opsiyonel', 'var(--text-secondary)',
      _feadGrid(node, [
        { key:'loadStopRelDeg', label:'Load stop (göreli) [°]', ph:'62.4' },
        { key:'armInertia',     label:'Kol ataleti [kg·m²]',  ph:'0.0076', step:'0.0001' }
      ], 2)
    + _feadHint('<b>Load stop</b> bir MEKANİK sınırdır, çalışma noktası değil — boş bırakılabilir. '
        + '<b>Kol ataleti</b> yalnız kol modu tahmini için; raporun "Natural Frequency" değeriyle '
        + 'karşılaştırılamaz (o, çok serbestlik dereceli bir burulma modudur).'));

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
  html += '<div style="padding:8px 10px; margin-bottom:10px; font-size:var(--fs-tiny); line-height:1.45; color:var(--text-secondary); background:var(--bg-secondary); border:1px solid var(--border-color); border-left:3px solid var(--accent-warning);">'
        + '<b style="color:var(--text-heading);">Kayış Özellikleri.</b> Kayışın kendisi bir kasnak değildir: konumu yoktur, topolojiye bağlanmaz. İç topolojide <b>tek kopya</b> durur ve kayışın kesit/malzeme künyesini taşır.</div>';

  // Profil + marka, çekirdeğin BELT_DB'sindeki hb/hr'yi seçer — kasnak
  // yarıçapları buradan türetildiği için künyenin en belirleyici iki alanı bu.
  var profiller = [['PK','PK'],['PJ','PJ'],['PH','PH'],['PL','PL'],['PM','PM']];
  var markalar = [['GATES','Gates'],['OPTIBELT','Optibelt'],['CONTITECH','ContiTech']];
  html += _feadCard('Profil ve Marka', 'h_b / h_r buradan gelir', 'var(--accent-warning)',
      _feadSelect(node, 'Profil', 'profile', profiller, 'PK')
    + _feadSelect(node, 'Marka', 'brand', markalar, 'GATES', veFeadBeltDbHint(node)));

  html += _feadCard('Künye', '', 'var(--accent-warning)',
      _feadText(node, 'Tip / kod', 'beltType', 'ör. 8PK 1475HD')
    + _feadGrid(node, [
        { key:'ribs',      label:'Kanal sayısı',        ph:'8', step:'1' },
        { key:'effLength', label:'Efektif boy [mm]',    ph:'1475' },
        { key:'tolerance', label:'Tolerans ± [mm]',     ph:'6' },
        { key:'wearPct',   label:'Aşınma payı [oran]',  ph:'0.007', step:'0.0001' }
      ], 2)
    + _feadHint('<b>Efektif boy</b> ISO 9981 boyudur. <b>Aşınma payı</b> ORAN olarak girilir '
        + '(0.007 = %0.70). Konum tablosu bu üç sayıdan kurulur: Replace = L+tol+aşınma·L, '
        + 'Max = L+tol, Mean = L, Min = L−tol.'));

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
function veFeadLayoutSVG(build, W, H){
  W = W || 320; H = H || 240;
  if(!build || !build.ok || !build.sys || typeof FEADCore === 'undefined') return null;
  var geom;
  try { geom = FEADCore.tensionerState(build.sys, FEADCore.meanRel(build.sys)).geom; }
  catch(e){ return null; }

  var ps = geom.pulleys;
  var minX=Infinity, maxX=-Infinity, minY=Infinity, maxY=-Infinity;
  ps.forEach(function(p){
    minX=Math.min(minX,p.c[0]-p.rPitch); maxX=Math.max(maxX,p.c[0]+p.rPitch);
    minY=Math.min(minY,p.c[1]-p.rPitch); maxY=Math.max(maxY,p.c[1]+p.rPitch);
  });
  var pad = 18;
  var spanX = Math.max(1, maxX-minX), spanY = Math.max(1, maxY-minY);
  var s = Math.min((W-2*pad)/spanX, (H-2*pad)/spanY);
  var offX = pad + ((W-2*pad) - spanX*s)/2, offY = pad + ((H-2*pad) - spanY*s)/2;
  function tx(x){ return offX + (x-minX)*s; }
  function ty(y){ return offY + (maxY-y)*s; }
  function f(v){ return Math.round(v*100)/100; }

  // Kayış yolu: çekirdeğin teğet uçları (Pi/Pj) + her kasnakta sarım yayı.
  // Yay yönü kasnağın d işaretinden gelir; ekranda y çevrildiği için sweep
  // bayrağı da tersine döner (d>0 → matematiksel CCW → ekranda CW = sweep 1).
  var n = ps.length, d = '';
  for(var i=0;i<n;i++){
    var sp = geom.spans[i], p = ps[(i+1)%n], spN = geom.spans[(i+1)%n];
    if(i === 0) d += 'M' + f(tx(sp.Pi[0])) + ' ' + f(ty(sp.Pi[1]));
    d += ' L' + f(tx(sp.Pj[0])) + ' ' + f(ty(sp.Pj[1]));
    var R = f(p.rPitch * s), wrap = geom.wraps[(i+1)%n];
    d += ' A' + R + ' ' + R + ' 0 ' + (wrap > Math.PI ? 1 : 0) + ' ' + (p.d > 0 ? 1 : 0)
       + ' ' + f(tx(spN.Pi[0])) + ' ' + f(ty(spN.Pi[1]));
  }
  d += ' Z';

  // ÖLÇÜ SINIRI ŞART: panel iki sütuna geçtiğinde (VE_WIDE_PANEL_TYPES) yalnız
  // width:100% veren bir viewBox'lı SVG en-boy oranıyla birlikte YÜKSELİR ve
  // pencerenin altından taşarak kırpılır (ölçüldü). max-width bunu keser.
  var svg = '<svg viewBox="0 0 ' + W + ' ' + H + '" width="100%" style="display:block; width:100%; max-width:'
    + W + 'px; margin:0 auto; background:var(--bg-input); border:1px solid var(--border-color); border-radius:var(--radius-sm);">';
  svg += '<path d="' + d + '" fill="none" stroke="var(--accent-warning)" stroke-width="2.6" stroke-linejoin="round"/>';
  ps.forEach(function(p, k){
    var def = build.order[k] ? _feadDefOf(build.order[k]) : {};
    var isDrv = !!(build.sys.pulleys[k] && build.sys.pulleys[k].crank);
    var col = isDrv ? 'var(--accent-primary)' : (def.isFeadTensioner ? 'var(--accent-success)' : 'var(--text-secondary)');
    var X = f(tx(p.c[0])), Y = f(ty(p.c[1])), R = f(p.rPitch*s);
    svg += '<circle cx="' + X + '" cy="' + Y + '" r="' + R + '" fill="none" stroke="' + col
        + '" stroke-width="2"' + (p.contact === 'back' ? ' stroke-dasharray="4 3"' : '') + '/>';
    svg += '<circle cx="' + X + '" cy="' + Y + '" r="2.2" fill="' + col + '"/>';
    svg += '<text x="' + X + '" y="' + f(Y - R - 4) + '" text-anchor="middle" font-size="9" fill="var(--text-muted)">'
        + _feadEsc(geom.names[k]) + '</text>';
    svg += '<text x="' + X + '" y="' + f(Y + R + 10) + '" text-anchor="middle" font-size="8" fill="var(--accent-warning)">'
        + f(geom.wrapDeg(k)) + '°</text>';
  });
  return svg + '</svg>';
}

function getFeadLayoutPropertiesHTML(node){
  if(!node.data) node.data = {};
  var build = veFeadBuildFromCanvas();
  var html = '<div class="sw-panel">';
  html += '<div style="padding:8px 10px; margin-bottom:10px; font-size:var(--fs-tiny); line-height:1.45; color:var(--text-secondary); background:var(--bg-secondary); border:1px solid var(--border-color); border-left:3px solid var(--accent-warning);">'
        + '<b style="color:var(--text-heading);">Kayış Yolu.</b> Şema hesap çekirdeğinin çözdüğü '
        + 'GERÇEK geometridir: teğet noktaları, sarım yayları ve yönleri temas tarafına göre. '
        + 'Kesikli çember = kayışın <b>sırttan</b> temas ettiği kasnak. Sıra bağlantılardan okunur.</div>';

  var svg = veFeadLayoutSVG(build, 320, 240);
  if(svg){
    html += _feadCard('Şema', 'ölçekli · sarım açıları', 'var(--accent-warning)', svg);
    html += veFeadGeometryTable(build);
  } else {
    html += veFeadProblemBox(build);
  }
  html += veFeadWarningBox(build);
  html += '</div>';
  return html;
}

// Geometri özeti — çekirdeğin kasnak başına verdiği span + sarım + hız oranı.
function veFeadGeometryTable(build){
  var geom, st;
  try {
    st = FEADCore.tensionerState(build.sys, FEADCore.meanRel(build.sys));
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
  return _feadCard('Geometri', 'ortalama kol açısında', 'var(--accent-primary)', h
    + _feadHint('Efektif kayış boyu <b>' + _feadFmt(geom.LeffMm,1) + ' mm</b> · '
      + 'pitch boyu ' + _feadFmt(geom.LpitchMm,1) + ' mm · '
      + 'işaretli sarım toplamı ' + _feadFmt(geom.signedWrapDeg,2) + '° (360 olmalı).'));
}

// Çözülemeyen model: NE EKSİK olduğunu say. Yanlış bir şema, doğru bir
// uyarıdan kötüdür — bu yüzden hata varken hiç çizmiyoruz.
function veFeadProblemBox(build){
  if(!build || !build.errors || !build.errors.length){
    return '<div style="padding:14px; text-align:center; font-size:var(--fs-body); color:var(--text-muted); border:1px dashed var(--border-color); border-radius:var(--radius-md); margin-bottom:9px;">'
      + 'Geometri çözülemedi.</div>';
  }
  var h = '<div style="padding:10px 12px; margin-bottom:9px; background:var(--bg-secondary); border:1px solid var(--accent-danger); border-left:3px solid var(--accent-danger); border-radius:var(--radius-sm);">'
    + '<div style="font-size:var(--fs-tiny); font-weight:700; color:var(--text-heading); margin-bottom:6px;">Şema çizilemiyor — eksik ya da tutarsız girdi</div>'
    + '<ul style="margin:0; padding-left:18px; font-size:var(--fs-micro); line-height:1.6; color:var(--text-secondary);">';
  build.errors.forEach(function(e){ h += '<li>' + _feadEsc(e) + '</li>'; });
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
  html += '<div style="padding:8px 10px; margin-bottom:10px; font-size:var(--fs-tiny); line-height:1.45; color:var(--text-secondary); background:var(--bg-secondary); border:1px solid var(--border-color); border-left:3px solid var(--accent-warning);">'
        + '<b style="color:var(--text-heading);">FEAD Çözücü.</b> İç topolojideki kasnakları, gergiyi ve '
        + 'kayış künyesini <b>otomatik</b> algılar — çözücüye bileşen bağlanmaz.</div>';

  html += _feadCard('Tasarım', '', 'var(--accent-primary)',
      _feadGrid(node, [
        { key:'designTensionN', label:'Tasarım gerginliği [N]', ph:'765.7' },
        { key:'lengthOffsetMm', label:'Boy ofseti [mm]',        ph:'0', step:'0.01' }
      ], 2)
    + _feadSelect(node, 'Yorulma modeli', 'fatigueModel',
        [['PK-2_2p-MT3', 'PK-2_2p-MT3 (doğrulanmış, 8 sistem)'],
         ['PK-2_2a-MT3', 'PK-2_2a-MT3 (tek sistem — doğrulanmamış)']], 'PK-2_2p-MT3',
        'Gates raporunun "Pulley Contributions to Belt Rib Fatigue" başlığında yazan model adı. '
        + 'İki takım sabit çok farklı (m 5.6 ↔ 4.05); yanlış seçim yorulma dağılımını kaydırır.')
    + _feadHint('<b>Tasarım gerginliği</b> gevşek span gerginliğidir; gerilme zinciri gergiye '
        + 'bu değerle ankrajlanır. <b>Boy ofseti</b> tasarım başına kalibrasyon girdisidir '
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
  html += '<div style="padding:8px 10px; margin-bottom:10px; font-size:var(--fs-tiny); line-height:1.45; color:var(--text-secondary); background:var(--bg-secondary); border:1px solid var(--border-color); border-left:3px solid var(--accent-warning);">'
        + '<b style="color:var(--text-heading);">Başlangıç ve Örnekler.</b> Hazır bir FEAD düzenini (kasnaklar + kayış yolu + künye) iç topolojiye tek tıkla kurar.</div>';
  veFeadExampleKeys().forEach(function(k){
    var ex = veFeadExampleOf(k);
    var kasnak = ex.pulleys.length;
    var egri = ex.pulleys.filter(function(p){ return p.data && p.data.pwrCurve; }).length;
    html += _feadCard(_feadEsc(ex.name), kasnak + ' kasnak', 'var(--accent-success)',
        '<div style="font-size:var(--fs-micro); color:var(--text-secondary); line-height:1.5; margin-bottom:9px;">'
      + _feadEsc(ex.note) + '</div>'
      + '<div style="font-size:var(--fs-micro); color:var(--text-muted); line-height:1.6; margin-bottom:10px;">'
      + '• kasnak koordinatları + çaplar + temas tarafı<br>'
      + '• gergi: pivot, kol boyu, montaj merkezi, yay künyesi<br>'
      + '• ' + egri + ' aksesuarın devir → kW eğrisi<br>'
      + '• çalışma çevrimi: ' + ex.solver.duty.length + ' devir noktası<br>'
      + '• birinci kademe: ' + ex.solver.crankOD + ' / ' + ex.solver.fanOD + ' mm</div>'
      + '<button onclick="veFeadLoadExample(\'' + _feadEsc(k) + '\')" style="width:100%; padding:11px 16px; '
      + 'font-size:var(--fs-body); font-weight:700; letter-spacing:0.02em; border:none; cursor:pointer; '
      + 'background:var(--accent-success); color:#fff;">İç topolojiye kur</button>'
      + _feadHint('<b>Mevcut kasnakların üzerine eklenir</b>, silinmez — boş bir iç topolojide '
        + 'kurmak en temizidir.'));
  });
  html += '<div style="font-size:var(--fs-micro); color:var(--text-muted); line-height:1.5;">Kendi düzeninizi sol paletten de kurabilirsiniz: '
        + 'sürücü kasnağı bırakın, aksesuar kasnaklarını ekleyin, ardından <b>sürücü çıkışı → aksesuar → … → sürücü girişi</b> sırasıyla bağlayarak kayış yolunu çizin.</div>';
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
  var GEN = 520, YUK = 400;                       // kanvasta kaplayacağı alan
  var sx = (maxX - minX) > 1 ? GEN / (maxX - minX) : 1;
  var sy = (maxY - minY) > 1 ? YUK / (maxY - minY) : 1;
  var s = Math.min(sx, sy);

  var yer = pack.example.pulleys.map(function(p, i){
    return { lx: 60 + (xs[i] - minX) * s, ly: 150 + (maxY - ys[i]) * s };
  });
  // Araç kutuları (kayış künyesi · çözücü · kayış yolu) üst şeritte.
  // SIRA pack.nodes ile aynı olmak zorunda — veFeadExampleNodes kasnakları
  // önce, araçları sonra ekliyor.
  var araclar = pack.nodes.length - pack.example.pulleys.length;
  for(var t = 0; t < araclar; t++) yer.push({ lx: 60 + t * 180, ly: 20 });

  var base = (typeof veArrangeModuleBase === 'function')
    ? veArrangeModuleBase(yer) : { x:3000, y:3000 };

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

  if(typeof createConnection === 'function'){
    pack.connections.forEach(function(c){
      if(idMap[c.from] && idMap[c.to]) createConnection(idMap[c.from], idMap[c.to]);
    });
  }
  if(typeof updateAllConnections === 'function') updateAllConnections();
  if(typeof veFeadRefreshBadges === 'function') veFeadRefreshBadges();
  _feadForgetResults();
  if(typeof saveState === 'function') saveState();
  if(typeof showToast === 'function')
    showToast(pack.example.name + ' kuruldu — ' + kuruldu.length + ' bileşen, '
      + pack.connections.length + ' kayış bağlantısı.', 'success');
  return kuruldu;
}

function getFeadReportPropertiesHTML(node){
  if(!node.data) node.data = {};
  var html = '<div class="sw-panel">';
  html += '<div style="padding:8px 10px; margin-bottom:10px; font-size:var(--fs-tiny); line-height:1.45; color:var(--text-secondary); background:var(--bg-secondary); border:1px solid var(--border-color); border-left:3px solid var(--accent-primary);">'
        + '<b style="color:var(--text-heading);">Rapor.</b> Çözücü sonuçlarını tamamen çevrimdışı bir HTML rapora döker (Takoz modülündeki <b>mnt-report</b> ile aynı kalıp).</div>';
  html += _feadPending('Rapor üreteci, çözücü sonuç üretmeye başladığında eklenecek.');
  html += '<button disabled style="width:100%; padding:12px 16px; font-size:var(--fs-lg); font-weight:700; background:var(--bg-tertiary); color:var(--text-muted); border:1px solid var(--border-color); cursor:not-allowed; letter-spacing:0.03em;">Raporu Üret (hazır değil)</button>';
  html += '</div>';
  return html;
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
    fatigueModel: (node && node.data && node.data.fatigueModel) || 'PK-2_2p-MT3'
  });
  res.solvedNodeId = nodeId;
  res.pulleyNames = build.names;
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
  if(R.fatigue) h += veFeadFatigueTable(R);
  if(R.life) h += veFeadLifeCard(R);
  h += veFeadLimitsBox(R);
  return h;
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

  return _feadCard('Çıkış Gerilmeleri', 'kasnak başına, duty noktasında [N]', 'var(--accent-primary)',
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
  return _feadCard('Hubload', 'büyüklük [N] / yön [°]', 'var(--accent-primary)', h);
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
    veFeadApplyBadge: veFeadApplyBadge,
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
    veFeadDriveCard: veFeadDriveCard, veFeadEngineCard: veFeadEngineCard,
    veFeadMountReadout: veFeadMountReadout,
    veFeadPowerCurveCard: veFeadPowerCurveCard,
    veFeadCurveAdd: veFeadCurveAdd, veFeadCurveRemove: veFeadCurveRemove,
    veFeadCurveSet: veFeadCurveSet, veFeadLoadExample: veFeadLoadExample,
    getFeadModulePropertiesHTML: getFeadModulePropertiesHTML,
    getFeadPulleyPropertiesHTML: getFeadPulleyPropertiesHTML,
    getFeadTensionerPropertiesHTML: getFeadTensionerPropertiesHTML,
    getFeadBeltPropertiesHTML: getFeadBeltPropertiesHTML,
    getFeadLayoutPropertiesHTML: getFeadLayoutPropertiesHTML,
    getFeadSolverPropertiesHTML: getFeadSolverPropertiesHTML,
    getFeadExamplePropertiesHTML: getFeadExamplePropertiesHTML,
    getFeadReportPropertiesHTML: getFeadReportPropertiesHTML
  };
}
