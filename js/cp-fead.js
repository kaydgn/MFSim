// ============================================================================
//  FEAD — MOTOR ÖN UÇ KAYIŞ-KASNAK SİSTEMİ (Front End Accessory Drive)
// ============================================================================
// MFSim'in ÜÇÜNCÜ ana modülü (Araç Performans ve Takoz Çökme-Titreşim'in
// yanında). Bu dosya modülün İSKELETİDİR: alt-sistem düğümü, iç topoloji
// gezinmesi, bileşen panelleri ve kayış yolu geometrisi. Hesap çekirdeği
// (gerginlik / sarım / kayma / titreşim) SPEC geldiğinde ayrı bir dosyaya
// (js/fead-core.js) DOM'suz saf fonksiyonlar olarak eklenecek — Takoz
// modülünde mount-core.js ile kurulan ayrımın aynısı.
//
// MİMARİ — arac-performans / mount-analysis ile BİREBİR aynı nested kalıp:
// ana canvas'ta tek kart; çift tıkla iç topolojiye girilir; çıkışta iç
// topoloji node.data.subTopology'ye yazılır. Kaydet/sekme-değiştir öncesi
// veSaveActiveTabState → veFeadCollapseToRoot ile köke çöker.
//
// BAĞLANTININ ANLAMI BU MODÜLDE FARKLIDIR — kayış yoludur:
//   • Araç Performans'ta bağlantı GÜÇ AKIŞI, Takoz'da SALT GÖRSEL'di.
//   • FEAD'de bağlantı, serpantin kayışın kasnaktan kasnağa geçiş SIRASIDIR.
//     Krank Kasnağı'nın çıkışından başlar, kasnakları dolaşır, Krank'ın
//     girişine döner → KAPALI ÇEVRİM. Bu yüzden her kasnak 1 giriş + 1 çıkış
//     taşır; "tahrik eden" ile "yük" ayrımı porttan değil TİPTEN okunur
//     (def.isFeadDriver / def.isFeadAccessory).
//   • Sarım açısı ve kayış boyu bu SIRA + kasnak konumlarından TÜRETİLİR
//     (veFeadBeltPath) — kullanıcı elle girmez.
//
// Birim (UI): konum ve çap mm, atalet kg·m², tork Nm, rijitlik N/mm.
// Kalıcılık: her düğüm kendi node.data'sında (proje kaydet/yükle otomatik).
// ----------------------------------------------------------------------------

// ─── Yardımcılar ─────────────────────────────────────────────────────────────
function _feadNum(v, d){
  if(v===undefined||v===null||v==='') return (d===undefined)?0:d;
  var x=(typeof v==='string')?v.trim().replace(',', '.'):v;
  var n=Number(x);
  return Number.isFinite(n)?n:((d===undefined)?0:d);
}
function _feadEsc(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function _feadFmt(x, dg){ if(!Number.isFinite(x)) return '—'; dg=(dg===undefined)?1:dg; return x.toFixed(dg); }
function _feadDefOf(n){
  if(!n) return {};
  if(typeof componentDefs!=='undefined' && componentDefs[n.type]) return componentDefs[n.type];
  return n.def || {};
}
function _feadNodeName(n){ return (n && n.customName) || _feadDefOf(n).name || (n && n.type) || ''; }
function _feadIsPulley(n){ return !!_feadDefOf(n).isFeadPulley; }

// Kasnağın ETKİN YARIÇAPI [mm] — çap girilmemişse tipine göre makul bir
// varsayılan. Varsayılan yalnız ÖNİZLEME içindir (kayış yolu şeması boş
// veriyle de bir şey göstersin); hesap çekirdeği geldiğinde girilmemiş çap
// bir uyarı olacaktır, sessiz varsayılan değil.
var VE_FEAD_DEFAULT_DIA = {
  'fead-crank': 180, 'fead-alternator': 60, 'fead-ac': 120, 'fead-waterpump': 110,
  'fead-ps': 110, 'fead-aircomp': 120, 'fead-fan': 150, 'fead-idler': 70, 'fead-tensioner': 75
};
function veFeadRadius(node){
  var d = _feadNum(node && node.data && node.data.dia, 0);
  if(d > 0) return d/2;
  return (VE_FEAD_DEFAULT_DIA[node && node.type] || 80)/2;
}

// ════════════════════════════════════════════════════════════════════════════
//  KAYIŞ YOLU GEOMETRİSİ (saf — DOM'suz, testlenebilir)
// ════════════════════════════════════════════════════════════════════════════
// Sıralı kasnak listesinden KAPALI kayış çevresini üretir: ardışık kasnak
// çiftleri arasında DIŞ TEĞET doğrusu, her kasnakta da sarım yayı.
//
// Türetme: teğet doğrusuna ait birim normal n her iki kasnakta ORTAKtır;
// doğrunun her iki daireye teğet olması (C₂−C₁)·n = r₁−r₂ demektir. Yani n,
// merkezleri birleştiren doğrultudan ψ = acos((r₁−r₂)/d) kadar döndürülmüş
// vektördür. Ekran koordinatı y AŞAĞI olduğundan −ψ dönüşü saat yönü
// dolanmayı verir; bütün yaylar bu yüzden sweep=1'dir.
//
// pulleys: [{x, y, r}] — kayışın uğrama SIRASI. Dönen: SVG path 'd' dizgisi
// (kapalı), ya da geometri çözülemiyorsa null (bir daire diğerinin içindeyse:
// d ≤ |r₁−r₂| → dış teğet yoktur).
function veFeadBeltPath(pulleys){
  var P = (pulleys||[]).filter(function(p){ return p && Number.isFinite(p.x) && Number.isFinite(p.y) && p.r > 0; });
  var N = P.length;
  if(N < 2) return null;

  // Her kenar için ortak teğet normali n[i] (kasnak i → i+1).
  var n = [];
  for(var i=0;i<N;i++){
    var a = P[i], b = P[(i+1)%N];
    var dx = b.x-a.x, dy = b.y-a.y;
    var d = Math.sqrt(dx*dx+dy*dy);
    if(!(d > Math.abs(a.r-b.r)) || d === 0) return null;   // iç içe / çakışık
    var psi = Math.acos((a.r-b.r)/d);
    var base = Math.atan2(dy, dx);
    var ang = base - psi;
    n.push({ ang: ang, cx: Math.cos(ang), cy: Math.sin(ang) });
  }

  function leave(i){ return { x: P[i].x + P[i].r*n[i].cx, y: P[i].y + P[i].r*n[i].cy }; }
  function arrive(i){ var k=(i-1+N)%N; return { x: P[i].x + P[i].r*n[k].cx, y: P[i].y + P[i].r*n[k].cy }; }
  function f(v){ return Math.round(v*100)/100; }

  var A0 = leave(0);
  var dstr = 'M' + f(A0.x) + ' ' + f(A0.y);
  for(var k=0;k<N;k++){
    var j = (k+1)%N;
    var arr = arrive(j), lv = leave(j);
    dstr += ' L' + f(arr.x) + ' ' + f(arr.y);
    // Sarım açısı: gelen teğetin normalinden giden teğetin normaline, artan
    // yönde. 180°'yi aşıyorsa large-arc bayrağı 1 olmalı.
    var span = (n[j].ang - n[k].ang) % (2*Math.PI);
    if(span < 0) span += 2*Math.PI;
    dstr += ' A' + f(P[j].r) + ' ' + f(P[j].r) + ' 0 ' + (span > Math.PI ? 1 : 0) + ' 1 ' + f(lv.x) + ' ' + f(lv.y);
  }
  return dstr + ' Z';
}

// Kayışın uğrama SIRASI: bağlantılar (çıkış→giriş) zinciri izlenerek Krank
// Kasnağı'ndan başlanır. Zincire hiç girmemiş kasnaklar (kullanıcı henüz
// bağlamadıysa) sona, topoloji sırasıyla eklenir — böylece şema yarım
// bağlanmış bir modelde de bir şey gösterir.
function veFeadRouteOrder(nodeList, connList){
  var pulleys = (nodeList||[]).filter(_feadIsPulley);
  if(!pulleys.length) return [];
  var byId = {};
  pulleys.forEach(function(n){ byId[n.id] = n; });
  var next = {};
  (connList||[]).forEach(function(c){
    if(!c) return;
    if(byId[c.from] && byId[c.to] && next[c.from] === undefined) next[c.from] = c.to;
  });
  var start = null;
  for(var i=0;i<pulleys.length;i++){ if(_feadDefOf(pulleys[i]).isFeadDriver){ start = pulleys[i]; break; } }
  if(!start) start = pulleys[0];
  var order = [], seen = {}, cur = start.id, guard = 0;
  while(cur && byId[cur] && !seen[cur] && guard++ < 512){
    seen[cur] = 1;
    order.push(byId[cur]);
    cur = next[cur];
  }
  pulleys.forEach(function(p){ if(!seen[p.id]) order.push(p); });
  return order;
}

// Aktif topolojideki kasnakları kayış sırasında topla (canlı globaller).
function veFeadGatherPulleys(){
  if(typeof nodes === 'undefined') return [];
  return veFeadRouteOrder(nodes, (typeof connections !== 'undefined') ? connections : []);
}

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

function veFeadSet(nodeId, key, val){
  if(typeof nodes === 'undefined') return;
  var node = nodes.find(function(n){ return n.id === nodeId; });
  if(!node) return;
  if(!node.data) node.data = {};
  node.data[key] = val;
  if(typeof saveState === 'function') saveState();
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
  var def = _feadDefOf(node);
  var isDriver = !!def.isFeadDriver, isIdler = !!def.isFeadIdler;
  var html = '<div class="sw-panel">';

  var rol = isDriver ? 'Tahrik kaynağı — kayışı bu kasnak döndürür; devri motor devridir.'
          : isIdler  ? 'Avara kasnak — yük çekmez, yalnız kayış yolunu yönlendirir ve sarım açısını artırır.'
                     : 'Aksesuar — kayıştan güç çeker. Çektiği tork krank üzerindeki toplam yüke eklenir.';
  html += '<div style="padding:8px 10px; margin-bottom:10px; font-size:var(--fs-tiny); line-height:1.45; color:var(--text-secondary); background:var(--bg-secondary); border:1px solid var(--border-color); border-left:3px solid var(--accent-warning);">'
        + '<b style="color:var(--text-heading);">' + _feadEsc(_feadNodeName(node)) + '.</b> ' + rol + '</div>';

  html += _feadCard('Kasnak Geometrisi', '[mm]', 'var(--accent-primary)',
      _feadGrid(node, [
        { key:'dia', label:'Etkin çap', ph:String(VE_FEAD_DEFAULT_DIA[node.type] || 100) },
        { key:'x',   label:'Konum X',   ph:'0' },
        { key:'y',   label:'Konum Y',   ph:'0' }
      ], 3)
    + _feadHint('Konum, kayış düzleminde (motor önden görünüş) kasnak merkezidir. Sarım açısı ve kayış boyu bu konumlardan + bağlantı sırasından türetilir.'));

  var dyn = _feadGrid(node, [
    { key:'inertia', label:'Atalet J [kg·m²]', ph:'0.010', step:'0.0001' }
  ].concat(isDriver || isIdler ? [] : [
    { key:'torque', label:'Yük torku [Nm]', ph:'0' }
  ]), isDriver || isIdler ? 1 : 2);
  html += _feadCard('Dinamik', '', 'var(--accent-success)', dyn
    + _feadHint(isDriver ? 'Krank kasnağı ataleti torsiyonel damperi de içerir.'
        : isIdler ? 'Yalnız atalet: avara kasnak kayıştan güç çekmez.'
        : 'Yük torku, aksesuarın nominal devirde kayıştan çektiği ortalama torktur.'));

  html += _feadPending('Sarım açısı, kayış gerginliği ve kayma payı SPEC geldiğinde bu panele hesaplanmış değerler olarak eklenecek.');
  html += '</div>';
  return html;
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

  html += _feadCard('Kasnak', '[mm] / [kg·m²]', 'var(--accent-primary)',
      _feadGrid(node, [
        { key:'dia',     label:'Etkin çap',      ph:'75' },
        { key:'inertia', label:'Atalet J',       ph:'0.001', step:'0.0001' }
      ], 2));

  html += _feadCard('Kol ve Pivot', '[mm]', 'var(--text-secondary)',
      _feadGrid(node, [
        { key:'pivotX', label:'Pivot X', ph:'0' },
        { key:'pivotY', label:'Pivot Y', ph:'0' },
        { key:'armLen', label:'Kol boyu', ph:'70' }
      ], 3)
    + _feadHint('Kasnak merkezi pivot + kol boyu + çalışma açısından türetilir; ayrıca konum girilmez.'));

  html += _feadCard('Yay', '', 'var(--accent-success)',
      _feadGrid(node, [
        { key:'kArm',    label:'Yay rijitliği [Nm/°]', ph:'0.8', step:'0.01' },
        { key:'preload', label:'Ön yük momenti [Nm]',  ph:'12' }
      ], 2));

  html += _feadPending('Gergi çalışma açısı, statik/dinamik kayış gerginliği ve kol salınımı SPEC ile hesaplanacak.');
  html += '</div>';
  return html;
}

// ════════════════════════════════════════════════════════════════════════════
//  KAYIŞ ÖZELLİKLERİ PANELİ (iç topolojide tek kopya)
// ════════════════════════════════════════════════════════════════════════════
function getFeadBeltPropertiesHTML(node){
  if(!node.data) node.data = {};
  var html = '<div class="sw-panel">';
  html += '<div style="padding:8px 10px; margin-bottom:10px; font-size:var(--fs-tiny); line-height:1.45; color:var(--text-secondary); background:var(--bg-secondary); border:1px solid var(--border-color); border-left:3px solid var(--accent-warning);">'
        + '<b style="color:var(--text-heading);">Kayış Özellikleri.</b> Kayışın kendisi bir kasnak değildir: konumu yoktur, topolojiye bağlanmaz. İç topolojide <b>tek kopya</b> durur ve kayışın kesit/malzeme künyesini taşır.</div>';

  html += _feadCard('Künye', '', 'var(--accent-warning)',
      _feadText(node, 'Tip / kod', 'beltType', 'ör. 8PK 2270')
    + _feadGrid(node, [
        { key:'ribs',   label:'Kanal sayısı', ph:'8', step:'1' },
        { key:'length', label:'Boy [mm]',     ph:'2270' }
      ], 2)
    + _feadHint('Boy boş bırakılırsa kayış yolu geometrisinden hesaplanacaktır (SPEC sonrası).'));

  html += _feadCard('Malzeme', '', 'var(--accent-success)',
      _feadGrid(node, [
        { key:'massPerLen', label:'Birim kütle [kg/m]', ph:'0.09', step:'0.001' },
        { key:'ea',         label:'Boyuna rijitlik EA [N]', ph:'120000' },
        { key:'mu',         label:'Sürtünme μ [—]', ph:'1.2', step:'0.01' }
      ], 3));

  html += _feadPending('Kayış boyu doğrulaması, çekme/gevşek kol gerginlikleri ve kayma sınırı bu künyeden hesaplanacak.');
  html += '</div>';
  return html;
}

// ════════════════════════════════════════════════════════════════════════════
//  KAYIŞ YOLU (2D ŞEMA)
// ════════════════════════════════════════════════════════════════════════════
// İç topolojideki kasnakların GERÇEK konum/çap verisinden ölçekli serpantin
// şeması çizer. Veri eksikse (konum girilmemişse) düğümlerin tuval konumuna
// düşmez — kullanıcıya ne eksik olduğunu söyler; yanlış bir şema doğru bir
// uyarıdan kötüdür.
function veFeadLayoutSVG(pulleys, W, H){
  W = W || 320; H = H || 240;
  var P = (pulleys||[]).map(function(n){
    return { name: _feadNodeName(n), x: _feadNum(n.data && n.data.x, NaN), y: _feadNum(n.data && n.data.y, NaN), r: veFeadRadius(n),
             driver: !!_feadDefOf(n).isFeadDriver, tens: !!_feadDefOf(n).isFeadTensioner };
  }).filter(function(p){ return Number.isFinite(p.x) && Number.isFinite(p.y); });
  if(P.length < 1) return null;

  var minX=Infinity, maxX=-Infinity, minY=Infinity, maxY=-Infinity;
  P.forEach(function(p){
    minX=Math.min(minX,p.x-p.r); maxX=Math.max(maxX,p.x+p.r);
    minY=Math.min(minY,p.y-p.r); maxY=Math.max(maxY,p.y+p.r);
  });
  var pad = 16;
  var spanX = Math.max(1, maxX-minX), spanY = Math.max(1, maxY-minY);
  var s = Math.min((W-2*pad)/spanX, (H-2*pad)/spanY);
  // Kayış düzleminde +Y YUKARI (mühendislik çizimi); SVG'de y aşağı → çevir.
  function tx(x){ return pad + (x-minX)*s + ((W-2*pad) - spanX*s)/2; }
  function ty(y){ return pad + (maxY-y)*s + ((H-2*pad) - spanY*s)/2; }
  var V = P.map(function(p){ return { x:tx(p.x), y:ty(p.y), r:Math.max(3, p.r*s), name:p.name, driver:p.driver, tens:p.tens }; });

  var belt = veFeadBeltPath(V);
  // ÖLÇÜ SINIRI ŞART: panel iki sütuna geçtiğinde (VE_WIDE_PANEL_TYPES) yalnız
  // width:100% veren bir viewBox'lı SVG en-boy oranıyla birlikte YÜKSELİR —
  // 320×240 şema 1300 px genişlikte 975 px yükseklik ister ve pencerenin
  // altından taşarak kırpılır (ölçüldü). max-width şemayı okunur bir ölçüde
  // tutar, margin:auto ortalar.
  var svg = '<svg viewBox="0 0 ' + W + ' ' + H + '" width="100%" style="display:block; width:100%; max-width:' + W + 'px; margin:0 auto; background:var(--bg-input); border:1px solid var(--border-color); border-radius:var(--radius-sm);">';
  if(belt) svg += '<path d="' + belt + '" fill="none" stroke="var(--accent-warning)" stroke-width="3" stroke-linejoin="round"/>';
  V.forEach(function(p){
    var col = p.driver ? 'var(--accent-primary)' : (p.tens ? 'var(--accent-success)' : 'var(--text-secondary)');
    svg += '<circle cx="' + _feadFmt(p.x,1) + '" cy="' + _feadFmt(p.y,1) + '" r="' + _feadFmt(p.r,1) + '" fill="none" stroke="' + col + '" stroke-width="2"/>';
    svg += '<circle cx="' + _feadFmt(p.x,1) + '" cy="' + _feadFmt(p.y,1) + '" r="2.2" fill="' + col + '"/>';
    svg += '<text x="' + _feadFmt(p.x,1) + '" y="' + _feadFmt(p.y - p.r - 4,1) + '" text-anchor="middle" font-size="9" fill="var(--text-muted)">' + _feadEsc(p.name) + '</text>';
  });
  return svg + '</svg>';
}

function getFeadLayoutPropertiesHTML(node){
  if(!node.data) node.data = {};
  var pulleys = veFeadGatherPulleys();
  var html = '<div class="sw-panel">';
  html += '<div style="padding:8px 10px; margin-bottom:10px; font-size:var(--fs-tiny); line-height:1.45; color:var(--text-secondary); background:var(--bg-secondary); border:1px solid var(--border-color); border-left:3px solid var(--accent-warning);">'
        + '<b style="color:var(--text-heading);">Kayış Yolu.</b> İç topolojideki kasnakların konum + çap verisinden ölçekli serpantin şeması. Sıra, bağlantılardan (Krank çıkışı → … → Krank girişi) okunur.</div>';

  var svg = veFeadLayoutSVG(pulleys, 320, 240);
  if(svg){
    html += _feadCard('Şema', 'ölçekli', 'var(--accent-warning)', svg);
    var eksik = pulleys.filter(function(n){
      return !Number.isFinite(_feadNum(n.data && n.data.x, NaN)) || !Number.isFinite(_feadNum(n.data && n.data.y, NaN));
    });
    if(eksik.length){
      html += _feadHint('<b>' + eksik.length + '</b> kasnağın konumu girilmemiş — şemada gösterilmiyor: '
        + eksik.map(function(n){ return _feadEsc(_feadNodeName(n)); }).join(', '));
    }
  } else {
    html += '<div style="padding:14px; text-align:center; font-size:var(--fs-body); color:var(--text-muted); border:1px dashed var(--border-color); border-radius:var(--radius-md); margin-bottom:9px;">'
          + (pulleys.length ? 'Kasnakların <b>Konum X / Y</b> alanları henüz girilmemiş.' : 'İç topolojide henüz kasnak yok.')
          + '</div>';
  }

  html += _feadPending('Sarım açıları, kol uzunlukları ve toplam kayış boyu şemanın altına sayısal tablo olarak eklenecek.');
  html += '</div>';
  return html;
}

// ════════════════════════════════════════════════════════════════════════════
//  ÇÖZÜCÜ / ÖRNEK / RAPOR — iskelet paneller
// ════════════════════════════════════════════════════════════════════════════
// Çözücü, iç topolojiyi TİPE göre tarar (Takoz Çözücüsü ile aynı yaklaşım):
// kullanıcı çözücüye bir şey bağlamaz. Şu an yalnız envanteri raporlar.
function getFeadSolverPropertiesHTML(node){
  if(!node.data) node.data = {};
  var pulleys = veFeadGatherPulleys();
  var all = (typeof nodes !== 'undefined') ? nodes : [];
  var say = function(pred){ return all.filter(pred).length; };
  var nDriver = say(function(n){ return _feadDefOf(n).isFeadDriver; });
  var nAcc    = say(function(n){ return _feadDefOf(n).isFeadAccessory; });
  var nIdler  = say(function(n){ return _feadDefOf(n).isFeadIdler; });
  var nTens   = say(function(n){ return _feadDefOf(n).isFeadTensioner; });
  var nBelt   = say(function(n){ return _feadDefOf(n).isFeadBelt; });

  function satir(ad, deger, ok){
    return '<tr><td style="padding:5px 8px; border:1px solid var(--border-color); color:var(--text-secondary);">' + ad + '</td>'
      + '<td style="padding:5px 8px; border:1px solid var(--border-color); font-weight:600; color:' + (ok ? 'var(--text-primary)' : 'var(--accent-warning)') + ';">' + deger + '</td></tr>';
  }

  var html = '<div class="sw-panel">';
  html += '<div style="padding:8px 10px; margin-bottom:10px; font-size:var(--fs-tiny); line-height:1.45; color:var(--text-secondary); background:var(--bg-secondary); border:1px solid var(--border-color); border-left:3px solid var(--accent-warning);">'
        + '<b style="color:var(--text-heading);">FEAD Çözücü.</b> İç topolojideki kasnakları, gergiyi ve kayış künyesini <b>otomatik</b> algılar — çözücüye bileşen bağlanmaz.</div>';

  var tab = '<table style="width:100%; font-size:var(--fs-body); border-collapse:collapse; border:1px solid var(--border-color);">';
  tab += satir('Krank kasnağı', nDriver ? nDriver + ' adet' : 'yok', nDriver === 1);
  tab += satir('Aksesuar kasnağı', nAcc + ' adet', nAcc > 0);
  tab += satir('Avara kasnak', nIdler + ' adet', true);
  tab += satir('Gergi', nTens ? nTens + ' adet' : 'yok', nTens > 0);
  tab += satir('Kayış künyesi', nBelt ? 'tanımlı' : 'yok', nBelt > 0);
  tab += satir('Kayış yolu sırası', pulleys.length ? pulleys.length + ' kasnak' : '—', pulleys.length > 1);
  tab += '</table>';
  html += _feadCard('Algılanan Model', '', 'var(--accent-primary)', tab);

  html += _feadPending('▶ Hesapla düğmesi, gerginlik/sarım/kayma çekirdeği (js/fead-core.js) eklendiğinde buraya gelecek.');
  html += '<button disabled style="width:100%; padding:12px 16px; font-size:var(--fs-lg); font-weight:700; background:var(--bg-tertiary); color:var(--text-muted); border:1px solid var(--border-color); cursor:not-allowed; letter-spacing:0.03em;">▶ Hesapla (hazır değil)</button>';
  html += '</div>';
  return html;
}

function getFeadExamplePropertiesHTML(node){
  if(!node.data) node.data = {};
  var html = '<div class="sw-panel">';
  html += '<div style="padding:8px 10px; margin-bottom:10px; font-size:var(--fs-tiny); line-height:1.45; color:var(--text-secondary); background:var(--bg-secondary); border:1px solid var(--border-color); border-left:3px solid var(--accent-warning);">'
        + '<b style="color:var(--text-heading);">Başlangıç ve Örnekler.</b> Hazır bir FEAD düzenini (kasnaklar + kayış yolu + künye) iç topolojiye tek tıkla kurar.</div>';
  html += _feadPending('Örnek kayıt defteri henüz boş — gerçek bir motorun kayış-kasnak verisi geldiğinde ilk örnek buraya eklenecek (Araç Performans\'taki <b>ap-example</b> kalıbı).');
  html += '<div style="font-size:var(--fs-micro); color:var(--text-muted); line-height:1.5;">O zamana kadar düzeni sol paletten kurabilirsiniz: '
        + '<b>Krank Kasnağı</b> bırakın, aksesuar kasnaklarını ekleyin, ardından <b>Krank çıkışı → aksesuar → … → Krank girişi</b> sırasıyla bağlayarak kayış yolunu çizin.</div>';
  html += '</div>';
  return html;
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

// Jest/Node köprüsü (tarayıcıda no-op)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    VE_FEAD_STARTER_LAYOUT: VE_FEAD_STARTER_LAYOUT,
    VE_FEAD_DEFAULT_DIA: VE_FEAD_DEFAULT_DIA,
    veFeadRadius: veFeadRadius,
    veFeadBeltPath: veFeadBeltPath,
    veFeadRouteOrder: veFeadRouteOrder,
    veFeadLayoutSVG: veFeadLayoutSVG,
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
