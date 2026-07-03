// ============================================================================
// TAKOZ ÇÖKME-TİTREŞİM — GERÇEK KANVAS BİLEŞENLERİ (panel + çözücü)
// ============================================================================
// SPEC "Takoz Çökme–Titreşim Modülü (6 SD Rijit Gövde Modeli)" v1.0.
// Hesap çekirdeği: js/mount-core.js (veMountCore) — DOM'suz saf fonksiyonlar.
//
// MİMARİ (kullanıcı kararı): "programın normali gibi". Motor/Şanzıman/Şaft/
// Braket/Kütle (kütle gövdeleri, çıkış portu) ve Takoz (çıkış portu) normal
// kanvasa sürüklenip Çözücü'ye (giriş portu) NORMAL bağlantı motoruyla
// (createConnection) bağlanır. Çözücü, kendisine bağlı node'ları connections'
// tan okuyup 6 SD analizini OTOMATİK yük durumlarıyla çalıştırır — kullanıcı
// yük durumu girmez.
//
// Birim (SPEC 2): UI mm/kg/N/mm; çekirdek SI. Dönüşüm yalnız burada.
// Kalıcılık: her node kendi node.data'sında (proje kaydet/yükle otomatik).
// ----------------------------------------------------------------------------

// ─── Yardımcılar ─────────────────────────────────────────────────────────────
function _mntNum(v, d){ if(v===undefined||v===null||v==='') return d===undefined?0:d; var x=(typeof v==='string')?v.trim().replace(',', '.'):v; var n=Number(x); return Number.isFinite(n)?n:(d===undefined?0:d); }
function _mntFmt(x, dg){ if(!Number.isFinite(x)) return '—'; dg=(dg===undefined)?3:dg; return x.toFixed(dg); }
function _mntEsc(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function _mntDeflColor(mm){ var a=Math.abs(mm); if(a<0.5) return '#22c55e'; if(a<1.0) return '#84cc16'; if(a<2.0) return '#eab308'; if(a<3.0) return '#f97316'; return '#ef4444'; }
function _mntForceColor(kN){ var a=Math.abs(kN); if(a<5) return '#22c55e'; if(a<10) return '#84cc16'; if(a<20) return '#eab308'; if(a<30) return '#f97316'; return '#ef4444'; }
function _mntDef(n){ return (typeof componentDefs!=='undefined') ? componentDefs[n.type] : (n.def||{}); }
function _mntNodeName(n){ return n.customName || (_mntDef(n)||{}).name || n.type; }

// A26 gömülü takoz kütüphanesi (SPEC 7.2)
var VE_MOUNT_LIBRARY = {
  'amc55sha':   { name:'AMC 55 ShA',        sx:1252, sy:1252, sz:640,  dx:2055, dy:2055, dz:977 },
  '57RS313773': { name:'ÖN - 57RS313773',   sx:334,  sy:334,  sz:2300, dx:435,  dy:435,  dz:3000 },
  '57RS313774': { name:'ARKA - 57RS313774', sx:1200, sy:1200, sz:2400, dx:950,  dy:950,  dz:1900 }
};

// ─── ETKİN KÜTÜPHANE (gömülü + kullanıcı tanımlı) ────────────────────────────
// Gömülü katalog (VE_MOUNT_LIBRARY) DEĞİŞMEZ. "Takoz Özellikleri" (mnt-library)
// düğümleri node.data.mounts içinde kullanıcı tanımlı takozları tutar; bu iki
// kaynak burada birleştirilir. Takoz panelinin kütüphane açılır listesi ve
// veMntApplyLib doğrudan VE_MOUNT_LIBRARY yerine bu birleşik haritayı okur —
// böylece kullanıcının eklediği takozlar da "Kütüphaneden yükle" listesinde çıkar.
// Girdi biçimi (birleşik): { key, name, sx, sy, sz, dx, dy, dz, builtin }.
function veMntGetLibraryMap(){
  var map={};
  Object.keys(VE_MOUNT_LIBRARY).forEach(function(k){
    var m=VE_MOUNT_LIBRARY[k];
    map[k]={ key:k, name:m.name, sx:m.sx, sy:m.sy, sz:m.sz, dx:m.dx, dy:m.dy, dz:m.dz, builtin:true };
  });
  (typeof nodes!=='undefined'?nodes:[]).forEach(function(n){
    var def=_mntDef(n)||{};
    if(def.isMountLibrary && n.data && Array.isArray(n.data.mounts)){
      n.data.mounts.forEach(function(e){
        if(!e || !e.key) return;
        map[e.key]={ key:e.key, name:(e.name||'Özel Takoz'),
          sx:_mntNum(e.sx), sy:_mntNum(e.sy), sz:_mntNum(e.sz),
          dx:_mntNum(e.dx), dy:_mntNum(e.dy), dz:_mntNum(e.dz), builtin:false };
      });
    }
  });
  return map;
}
function veMntGetLibraryList(){
  var map=veMntGetLibraryMap(), out=[];
  Object.keys(map).forEach(function(k){ out.push(map[k]); });
  return out;
}

// Otomatik yük durumları (SPEC 4.4, g-tabanlı — tork gerektirmez, kullanıcı
// girişi yok). nz yerçekimi DAHİL toplam düşey ivme katsayısı.
var MNT_AUTO_CASES = [
  { name:'Static',       n:[ 0, 0,-1], T:[0,0,0] },
  { name:'Max Bump',     n:[ 0, 0,-3], T:[0,0,0] },
  { name:'Acceleration', n:[ 1, 0,-1], T:[0,0,0] },
  { name:'Braking',      n:[-1, 0,-1], T:[0,0,0] },
  { name:'Cornering L',  n:[ 0, 1,-1], T:[0,0,0] },
  { name:'Cornering R',  n:[ 0,-1,-1], T:[0,0,0] }
];

// ════════════════════════════════════════════════════════════════════════════
//  ANA MODÜL — ALT-SİSTEM (SUBSYSTEM) DÜĞÜMÜ  (arac-performans kalıbı)
// ════════════════════════════════════════════════════════════════════════════
// "Takoz Çökme-Titreşim" ana bileşen listesindeki TEK giriştir (Alt Modüller).
// Ana canvas'ta tek blok; çift tıkla → kendi İÇ TOPOLOJİSİNE girilir. Alt
// bileşenler (Motor/Şanzıman/Şaft/Braket/Kütle/Takoz/Çözücü) YALNIZ orada görünür
// (sidebar 'takoz' modu) ve normal sürükle-bağla ile kurulur. "← Ana Topolojiye
// Dön" ile çıkılır. Ana canvas makinesi (topology.js) aynen yeniden kullanılır:
// girişte ebeveyn durumu saklanır, canvas alt-topoloji ile değiştirilir; çıkışta
// alt-topoloji node.data.subTopology'ye yazılır. Kaydet öncesi veSaveActiveTabState
// → veMntCollapseToRoot ile köke çöker.
var veMntStack = [];
var _veMntBusy = false;

// Modül paneli (tek tık): "Alt Topolojiyi Aç".
function getMntModulePropertiesHTML(node){
  var sub = node && node.data && node.data.subTopology;
  var nCount = (sub && sub.nodes) ? sub.nodes.length : 0;
  var cCount = (sub && sub.connections) ? sub.connections.length : 0;
  var initialized = !!(sub && sub.nodes && sub.nodes.length);
  var html='<div class="sw-panel">';
  html+='<div style="padding:8px 10px; margin-bottom:10px; font-size:0.62rem; line-height:1.45; color:var(--text-secondary); background:var(--bg-secondary); border:1px solid var(--border-color); border-left:3px solid var(--accent-primary);">'
      + '<b style="color:var(--text-heading);">Takoz Çökme-Titreşim — alt-sistem.</b> '
      + 'Üstüne <b>çift tıklayınca</b> kendi <b>alt topolojisine</b> girilir. Motor / Şanzıman / Şaft / Braket / Kütle / Takoz / Takoz Özellikleri / Çözücü alt bileşenlerini orada, kendi panellerinden düzenler, Çözücü\'ye bağlarsınız. Yük durumları otomatik.</div>';
  html+='<table style="width:100%; font-size:0.68rem; border-collapse:collapse; border:1px solid var(--border-color); margin-bottom:10px;">';
  if(initialized){
    html+='<tr><td style="padding:5px 8px; border:1px solid var(--border-color); color:var(--text-secondary);">Bileşen</td><td style="padding:5px 8px; border:1px solid var(--border-color); color:var(--text-primary); font-weight:600;">'+nCount+'</td></tr>';
    html+='<tr><td style="padding:5px 8px; border:1px solid var(--border-color); color:var(--text-secondary);">Bağlantı</td><td style="padding:5px 8px; border:1px solid var(--border-color); color:var(--text-primary); font-weight:600;">'+cCount+'</td></tr>';
  } else {
    html+='<tr><td style="padding:7px 8px; border:1px solid var(--border-color); color:var(--text-muted);">Henüz açılmadı — ilk açılışta bir Çözücü ile başlar.</td></tr>';
  }
  html+='</table>';
  html+='<button onclick="veMntOpenEditor(\''+node.id+'\')" style="width:100%; padding:14px 16px; font-size:0.82rem; font-weight:700; background:var(--accent-primary); color:#fff; border:none; cursor:pointer; letter-spacing:0.03em;" onmouseover="this.style.filter=\'brightness(1.15)\'" onmouseout="this.style.filter=\'none\'">▶ Alt Topolojiyi Aç</button>';
  html+='</div>';
  return html;
}

// İlk açılışta iç topolojiye yerleştirilecek hazır yerleşim (yerel px). Orta
// sıra: Ön Takoz · Motor · Şanzıman · Transfer · Şaft · Çözücü. Üst sıra: Sağ
// Yan / Sağ Arka takoz. Alt sıra: Sol Yan / Sol Arka takoz. (Kullanıcının
// gönderdiği referans görsel ile aynı düzen.) Kurulumda görünür alana ortalanır.
var VE_MNT_STARTER_LAYOUT = [
  { type:'mnt-solver',   name:'Çözücü',           lx:600, ly:150 },
  { type:'mnt-motor',    name:'Motor (Kütle)',    lx:95,  ly:150 },
  { type:'mnt-gearbox',  name:'Şanzıman (Kütle)', lx:215, ly:150 },
  { type:'mnt-transfer', name:'Transfer Kutusu',  lx:335, ly:150 },
  { type:'mnt-shaft',    name:'Şaft (Kütle)',     lx:455, ly:150 },
  { type:'mnt-mount',    name:'Ön Takoz',         lx:5,   ly:157 },
  { type:'mnt-mount',    name:'Sağ Yan Takoz',    lx:150, ly:25  },
  { type:'mnt-mount',    name:'Sağ Arka Takoz',   lx:340, ly:25  },
  { type:'mnt-mount',    name:'Sol Yan Takoz',    lx:150, ly:280 },
  { type:'mnt-mount',    name:'Sol Arka Takoz',   lx:340, ly:280 }
];

// Node'a özel ad ata + kanvastaki etiketi güncelle.
function _mntSetNodeName(node, name){
  if(!node || !name) return;
  node.customName = name;
  if(typeof document!=='undefined'){
    var el=document.getElementById(node.id);
    if(el){ var lbl=el.querySelector('.ve-node-label'); if(lbl) lbl.textContent=name; }
  }
}

// Node'u (id ile) topolojiden ve DOM'dan kaldır — bağlantılarını da temizle.
function _mntRemoveNode(id){
  if(typeof connections!=='undefined'){
    connections = connections.filter(function(c){ return c.from!==id && c.to!==id; });
  }
  if(typeof document!=='undefined'){
    var el=document.getElementById(id); if(el) el.remove();
  }
  if(typeof nodes!=='undefined'){
    nodes = nodes.filter(function(n){ return n.id!==id; });
  }
}

// İlk açılışta iç topolojiye hazır bileşen yerleşimini kur (referans görsel).
// Sadece düğüm oluşturur — Çözücü hepsini otomatik algıladığından bağlantı yok.
function veMntPopulateStarter(){
  if(typeof createNode!=='function') return [];
  var base = (typeof veArrangeModuleBase==='function')
    ? veArrangeModuleBase(VE_MNT_STARTER_LAYOUT.map(function(it){ return {lx:it.lx, ly:it.ly}; }))
    : { x:3000, y:3000 };
  var created=[];
  VE_MNT_STARTER_LAYOUT.forEach(function(it){
    var before=nodes.length;
    createNode(it.type, base.x+it.lx, base.y+it.ly);
    if(nodes.length>before){
      var n=nodes[nodes.length-1];
      if(it.name && it.name!==((_mntDef(n)||{}).name)) _mntSetNodeName(n, it.name);
      created.push(n);
    }
  });
  if(typeof updateAllConnections==='function') updateAllConnections();
  return created;
}

// Sidebar kapsamını güncelle (takoz iç topolojisi ⇄ ana ekran). Kapsam açık
// alt-sistem stack'lerinden merkezi olarak hesaplanır (bkz. veSyncSidebarScope).
function _veMntSetSidebar(mode){
  if(typeof veSyncSidebarScope==='function'){ veSyncSidebarScope(); return; }
  if(typeof veShowAllSidebarComponents==='function') veShowAllSidebarComponents();
}

function veMntOpenEditor(nodeId){
  if(_veMntBusy) return;
  if(typeof nodes==='undefined' || typeof veSerializeCurrentState!=='function') return;
  var node = nodes.find(function(n){ return n.id===nodeId; });
  if(!node || node.type!=='mount-analysis') return;
  _veMntBusy=true;
  try {
    if(typeof veFlushOpenPanelData==='function') veFlushOpenPanelData();
    if(typeof veTogglePropertiesPanel==='function') veTogglePropertiesPanel(false);
    var parentState = veSerializeCurrentState();
    veMntStack.push({ nodeId:nodeId, parentState:parentState });
    veClearCanvasDOM();
    var sub = node.data && node.data.subTopology;
    if(sub && sub.nodes && sub.nodes.length){
      veLoadTabState({ state: sub });
    } else {
      veLoadTabState({ state: null });
      veMntPopulateStarter();
    }
    _veMntSetSidebar('takoz');
  } finally { _veMntBusy=false; }
  veMntUpdateBreadcrumb();
  if(typeof showToast==='function') showToast('Takoz Çökme-Titreşim — İç Topoloji','info');
}

function veMntCloseEditor(){
  if(_veMntBusy) return;
  if(!veMntStack.length) return;
  _veMntBusy=true;
  try {
    if(typeof veFlushOpenPanelData==='function') veFlushOpenPanelData();
    var subState = veSerializeCurrentState();
    var ctx = veMntStack.pop();
    var pn = (ctx.parentState.nodes||[]).find(function(n){ return n.id===ctx.nodeId; });
    if(pn){ if(!pn.data) pn.data={}; pn.data.subTopology = subState; }
    veClearCanvasDOM();
    veLoadTabState({ state: ctx.parentState });
    _veMntSetSidebar('performans');
  } finally { _veMntBusy=false; }
  veMntUpdateBreadcrumb();
  if(typeof showToast==='function') showToast('Ana topolojiye dönüldü','info');
}

function veMntCollapseToRoot(){
  var guard=0;
  while(veMntStack.length && guard++<32){ veMntCloseEditor(); }
}

// "← Ana Topolojiye Dön" bandı (arac-performans ile aynı CSS sınıfı).
function veMntUpdateBreadcrumb(){
  if(typeof document==='undefined') return;
  var el=document.getElementById('ve-mnt-breadcrumb');
  if(veMntStack.length===0){ if(el) el.remove(); return; }
  if(!el){
    el=document.createElement('div');
    el.id='ve-mnt-breadcrumb';
    el.className='ve-arac-breadcrumb';
    var host=document.getElementById('ve-canvas-wrapper')||document.body;
    host.appendChild(el);
  }
  var depth=veMntStack.length;
  el.innerHTML='<button onclick="veMntCloseEditor()" title="Bir üst topolojiye dön">← Ana Topolojiye Dön</button>'
    + '<span class="ve-arac-breadcrumb-label">Takoz Çökme-Titreşim · İç Topoloji'
    + (depth>1 ? ' <b>(derinlik '+depth+')</b>' : '') + '</span>';
}

// ════════════════════════════════════════════════════════════════════════════
//  KÜTLE GÖVDESİ PANELİ (Motor / Şanzıman / Şaft / Braket / Kütle)
// ════════════════════════════════════════════════════════════════════════════
function _mntEnsureMassData(node){
  if(!node.data) node.data = {};
  if(node.data.pointMass===undefined) node.data.pointMass = (node.type==='mnt-shaft');
  return node.data;
}
function _mntInp(node, key, ph, step){
  var v=(node.data[key]===undefined||node.data[key]===null)?'':node.data[key];
  return '<input type="number" id="ve-mnt-'+key+'-'+node.id+'" value="'+_mntEsc(v)+'" step="'+(step||'any')+'" placeholder="'+(ph||'')+'" onchange="veMntSet(\''+node.id+'\',\''+key+'\',this.value)" style="width:100%; padding:4px; font-size:0.68rem; background:var(--bg-input); color:var(--text-primary); border:1px solid var(--border-color); border-radius:0; text-align:right;">';
}
function _mntRow(label, sub, inner){
  return '<tr style="border-bottom:1px solid var(--border-color);">'
    + '<th style="padding:5px 8px; text-align:left; background:var(--bg-tertiary); border-right:1px solid var(--border-color); width:52%; font-weight:500; color:var(--text-secondary);">'+label+(sub?' <span style="color:var(--text-muted); font-weight:400;">'+sub+'</span>':'')+'</th>'
    + '<td style="padding:3px 5px; background:var(--bg-tertiary);">'+inner+'</td></tr>';
}
// Estetik yardımcılar — etiketli 3'lü inline grup (x/y/z yan yana) + tek satır.
function _mntTriple(node, title, unit, keys, subs, step){
  var h='<div style="margin-bottom:13px;">';
  h+='<div style="font-size:0.6rem; font-weight:700; color:var(--text-secondary); letter-spacing:0.03em; text-transform:uppercase; margin-bottom:6px;">'+title+(unit?' <span style="color:var(--text-muted); font-weight:400; text-transform:none;">'+unit+'</span>':'')+'</div>';
  h+='<div style="display:flex; gap:6px;">';
  for(var i=0;i<3;i++){
    var key=keys[i];
    var v=(node.data[key]===undefined||node.data[key]===null)?'':node.data[key];
    h+='<label style="flex:1; min-width:0; display:flex; flex-direction:column; gap:3px;">'
      +'<span style="font-size:0.56rem; color:var(--text-muted); text-align:center; letter-spacing:0.02em;">'+subs[i]+'</span>'
      +'<input type="number" id="ve-mnt-'+key+'-'+node.id+'" value="'+_mntEsc(v)+'" step="'+(step||'any')+'" onchange="veMntSet(\''+node.id+'\',\''+key+'\',this.value)" style="width:100%; padding:6px 7px; font-size:0.7rem; background:var(--bg-input); color:var(--text-primary); border:1px solid var(--border-color); border-radius:5px; text-align:right; box-sizing:border-box;">'
      +'</label>';
  }
  h+='</div></div>';
  return h;
}
function _mntSingle(node, title, unit, key, ph, step){
  var v=(node.data[key]===undefined||node.data[key]===null)?'':node.data[key];
  return '<div style="display:flex; align-items:center; gap:10px; margin-bottom:13px;">'
    +'<div style="flex:1; font-size:0.68rem; font-weight:600; color:var(--text-secondary);">'+title+(unit?' <span style="color:var(--text-muted); font-weight:400;">'+unit+'</span>':'')+'</div>'
    +'<input type="number" id="ve-mnt-'+key+'-'+node.id+'" value="'+_mntEsc(v)+'" step="'+(step||'any')+'" placeholder="'+(ph||'')+'" onchange="veMntSet(\''+node.id+'\',\''+key+'\',this.value)" style="width:140px; padding:6px 8px; font-size:0.72rem; background:var(--bg-input); color:var(--text-primary); border:1px solid var(--border-color); border-radius:5px; text-align:right;">'
    +'</div>';
}
function _mntNote(text, accent){
  return '<div style="padding:8px 10px; margin-bottom:13px; font-size:0.62rem; line-height:1.45; color:var(--text-secondary); background:var(--bg-secondary); border:1px solid var(--border-color); border-left:3px solid '+(accent||'var(--accent-primary)')+'; border-radius:4px;">'+text+'</div>';
}

function getMntMassPropertiesHTML(node){
  _mntEnsureMassData(node);
  var d=node.data;
  var html='<div class="sw-panel">';
  html+=_mntNote('Kütle gövdesi → 6 SD analizde birleşik rijit gövdeye katkı. İç topolojiye eklenince <b>Çözücü</b> otomatik algılar. Atalet <b>tensör bileşeni</b> (CATIA); nokta kütle → atalet 0.');
  html+=_mntSingle(node,'Kütle','m [kg]','mass','ör: 1386.3','0.001');
  html+=_mntTriple(node,'Ağırlık Merkezi','[mm]',['cgx','cgy','cgz'],['x','y','z'],'0.01');
  html+='<label style="display:flex; align-items:center; gap:7px; font-size:0.66rem; color:var(--text-secondary); margin:0 0 13px; cursor:pointer;"><input type="checkbox" '+(d.pointMass?'checked':'')+' onchange="veMntSetCheck(\''+node.id+'\',\'pointMass\',this.checked)"> Nokta kütle (atalet = 0)</label>';
  if(!d.pointMass){
    html+='<div style="font-size:0.66rem; font-weight:700; color:var(--text-heading); border-bottom:1px solid var(--border-color); padding-bottom:4px; margin:4px 0 10px;">Atalet Tensörü <span style="font-size:0.54rem; font-weight:400; color:var(--text-muted);">[kg·m²] · CATIA konvansiyonu</span></div>';
    html+=_mntTriple(node,'Köşegen','',['Ixx','Iyy','Izz'],['Ixx','Iyy','Izz'],'0.001');
    html+=_mntTriple(node,'Çarpım','',['Ixy','Ixz','Iyz'],['Ixy','Ixz','Iyz'],'0.001');
    html+='<div style="font-size:0.52rem; color:var(--text-muted); line-height:1.4;">Çarpım terimleri tensör bileşeni olarak girilir; el kitabı ∫xy dm konvansiyonu kullanılıyorsa işaret çevrilmelidir.</div>';
  }
  html+='</div>';
  return html;
}

// ════════════════════════════════════════════════════════════════════════════
//  TAKOZ PANELİ (konum + statik/dinamik rijitlik + kütüphane)
// ════════════════════════════════════════════════════════════════════════════
function getMntMountPropertiesHTML(node){
  if(!node.data) node.data={};
  var html='<div class="sw-panel">';
  html+=_mntNote('Takoz → şasiye üç eksenli lineer yay bağlantısı. İç topolojiye eklenince <b>Çözücü</b> otomatik algılar (bağlantı gerekmez).','var(--accent-success)');
  html+='<div style="font-size:0.6rem; font-weight:700; color:var(--text-secondary); letter-spacing:0.03em; text-transform:uppercase; margin-bottom:6px;">Kütüphane</div>';
  // Kütüphane (gömülü + "Takoz Özellikleri" ile eklenen kullanıcı takozları)
  var _lib=veMntGetLibraryList();
  var _libB=_lib.filter(function(e){ return e.builtin; });
  var _libC=_lib.filter(function(e){ return !e.builtin; });
  html+='<select onchange="veMntApplyLib(\''+node.id+'\',this.value)" style="width:100%; padding:6px 8px; font-size:0.66rem; background:var(--bg-input); color:var(--text-primary); border:1px solid var(--border-color); border-radius:5px; margin-bottom:13px;"><option value="">— Kütüphaneden rijitlik yükle —</option>';
  if(_libB.length){ html+='<optgroup label="Gömülü">'; _libB.forEach(function(e){ html+='<option value="'+_mntEsc(e.key)+'"'+(node.data.libKey===e.key?' selected':'')+'>'+_mntEsc(e.name)+'</option>'; }); html+='</optgroup>'; }
  if(_libC.length){ html+='<optgroup label="Özel (Takoz Özellikleri)">'; _libC.forEach(function(e){ html+='<option value="'+_mntEsc(e.key)+'"'+(node.data.libKey===e.key?' selected':'')+'>'+_mntEsc(e.name)+'</option>'; }); html+='</optgroup>'; }
  html+='</select>';
  html+=_mntTriple(node,'Konum','[mm]',['x','y','z'],['x','y','z'],'0.01');
  html+=_mntTriple(node,'Statik Rijitlik','[N/mm]',['kxs','kys','kzs'],['kx','ky','kz'],'1');
  html+=_mntTriple(node,'Dinamik Rijitlik','[N/mm]',['kxd','kyd','kzd'],['kx','ky','kz'],'1');
  html+='</div>';
  return html;
}

// ─── Setters ─────────────────────────────────────────────────────────────────
function veMntSet(nodeId, key, val){
  var node=nodes.find(function(n){return n.id===nodeId;}); if(!node) return;
  if(!node.data) node.data={};
  node.data[key]=val;
  if(typeof saveState==='function') saveState();
}
function veMntSetCheck(nodeId, key, checked){
  var node=nodes.find(function(n){return n.id===nodeId;}); if(!node) return;
  if(!node.data) node.data={};
  node.data[key]=!!checked;
  if(typeof saveState==='function') saveState();
  if(typeof showNodeProperties==='function') showNodeProperties(node); // atalet alanlarını göster/gizle
}
function veMntApplyLib(nodeId, key){
  if(!key) return;
  var node=nodes.find(function(n){return n.id===nodeId;}); if(!node) return;
  var m=veMntGetLibraryMap()[key]; if(!m) return;
  if(!node.data) node.data={};
  node.data.kxs=m.sx; node.data.kys=m.sy; node.data.kzs=m.sz;
  node.data.kxd=m.dx; node.data.kyd=m.dy; node.data.kzd=m.dz; node.data.libKey=key;
  if(typeof saveState==='function') saveState();
  if(typeof showNodeProperties==='function') showNodeProperties(node);
}

// ════════════════════════════════════════════════════════════════════════════
//  ÖRNEK — hazır doğrulama analizini topolojiye yükle (+ tutarlılık uyarıları)
// ════════════════════════════════════════════════════════════════════════════
// "Örnek" bileşeni: gömülü doğrulama örneklerini (Adams BMC_TTAR_2031) seçip
// iç topolojiye kurar. Yüklemeden sonra model kontrol edilir; fazla takoz /
// eksik bileşen / tanımsız değer varsa panelde uyarı listelenir.
var VE_MNT_EXAMPLES = {
  'ttar': { name:'BMC TTAR 2031 — Adams Doğrulama (5 kütle · 6 takoz)' }
};

// Örnek adı → kanvas kütle-gövdesi tipi (test buildTTARTopology ile aynı eşleme).
function _mntExampleBodyType(name){
  return /motor/i.test(name) ? 'mnt-motor'
    : /şanz|sanz/i.test(name) ? 'mnt-gearbox'
    : /şaft|saft|shaft/i.test(name) ? 'mnt-shaft'
    : /cradle|braket|bracket/i.test(name) ? 'mnt-bracket' : 'mnt-transfer';
}

function getMntExamplePropertiesHTML(node){
  if(!node.data) node.data={};
  var sel = node.data.exampleKey || 'ttar';
  var html='<div class="sw-panel">';
  html+=_mntNote('Hazır <b>doğrulama örneği</b> seç ve <b>topolojiye yükle</b>. Yükleme mevcut kütle/takoz bileşenlerinin yerine geçer (Çözücü/yardımcılar korunur). Yüklendikten sonra model <b>tutarlılık uyarıları</b> (fazla takoz · eksik bileşen · tanımsız değer) gösterilir.','var(--accent-warning)');
  html+='<div style="font-size:0.6rem; font-weight:700; color:var(--text-secondary); letter-spacing:0.03em; text-transform:uppercase; margin-bottom:6px;">Örnek Analiz</div>';
  html+='<select id="ve-mnt-example-sel" onchange="veMntSet(\''+node.id+'\',\'exampleKey\',this.value)" style="width:100%; padding:6px 8px; font-size:0.66rem; background:var(--bg-input); color:var(--text-primary); border:1px solid var(--border-color); border-radius:5px; margin-bottom:12px;">';
  Object.keys(VE_MNT_EXAMPLES).forEach(function(k){ html+='<option value="'+k+'"'+(sel===k?' selected':'')+'>'+_mntEsc(VE_MNT_EXAMPLES[k].name)+'</option>'; });
  html+='</select>';
  html+='<button onclick="veMntLoadExample(\''+node.id+'\')" style="width:100%; padding:11px 14px; font-size:0.76rem; font-weight:700; background:var(--accent-warning); color:#111; border:none; cursor:pointer; border-radius:5px; letter-spacing:0.02em;" onmouseover="this.style.filter=\'brightness(1.1)\'" onmouseout="this.style.filter=\'none\'">▶ Topolojiye Yükle</button>';
  html+='<div id="ve-mnt-example-report" style="margin-top:12px;"></div>';
  html+='</div>';
  return html;
}

// Örnek modeli tutarlılık kontrolü — uyarı nesneleri döner ({level,msg}).
function _mntExampleValidate(){
  var g = _mntGatherForSolver();
  var out=[];
  if(g.components.length===0) out.push({level:'err', msg:'Kütle gövdesi yok — en az bir kütle gerekir.'});
  if(g.mounts.length===0) out.push({level:'err', msg:'Takoz yok — 6 SD kısıtı için en az 3 takoz gerekir.'});
  else if(g.mounts.length<3) out.push({level:'warn', msg:'Az takoz: '+g.mounts.length+' takoz — rijit gövde kısıtı için ≥3 önerilir.'});
  else if(g.mounts.length>4) out.push({level:'warn', msg:'Fazla takoz: '+g.mounts.length+' takoz tanımlı — tipik güç grubu 3–4 takozla bağlanır (aşırı-kısıtlı model).'});
  g.components.forEach(function(c){ if(!(_mntNum(c.mass)>0)) out.push({level:'err', msg:_mntEsc(c.name)+': kütle tanımsız/sıfır.'}); });
  g.mounts.forEach(function(m){
    if(!(_mntNum(m.kzs)>0)) out.push({level:'warn', msg:_mntEsc(m.name)+': düşey (z) statik rijitlik tanımsız.'});
    if(!Number.isFinite(_mntNum(m.z,NaN))) out.push({level:'warn', msg:_mntEsc(m.name)+': z konumu tanımsız.'});
  });
  var hasSolver = (typeof nodes!=='undefined') && nodes.some(function(n){ return (_mntDef(n)||{}).isMountSolver; });
  if(!hasSolver) out.push({level:'warn', msg:'Çözücü bulunamadı — sonuç için bir Çözücü ekleyin.'});
  return out;
}

function _mntRenderExampleReport(warnings, silent){
  var el = (typeof document!=='undefined') ? document.getElementById('ve-mnt-example-report') : null;
  if(!el) return;
  if(!warnings.length){
    el.innerHTML='<div style="padding:9px 11px; background:rgba(34,197,94,0.12); border:1px solid var(--accent-success); border-radius:5px; font-size:0.64rem; color:var(--accent-success);"><b>✓ Model tutarlı</b> — herhangi bir uyarı yok.</div>';
    return;
  }
  var errN=warnings.filter(function(w){return w.level==='err';}).length;
  var h='<div style="font-size:0.6rem; font-weight:700; color:var(--text-heading); margin-bottom:6px;">Tutarlılık Uyarıları <span style="color:var(--text-muted); font-weight:400;">('+warnings.length+')</span></div>';
  h+='<div style="display:flex; flex-direction:column; gap:5px;">';
  warnings.forEach(function(w){
    var isErr=w.level==='err';
    var col=isErr?'var(--accent-danger)':'var(--accent-warning)';
    var bg=isErr?'rgba(239,68,68,0.10)':'rgba(245,158,11,0.10)';
    h+='<div style="padding:6px 9px; background:'+bg+'; border-left:3px solid '+col+'; border-radius:3px; font-size:0.62rem; line-height:1.4; color:var(--text-secondary);"><b style="color:'+col+';">'+(isErr?'HATA':'UYARI')+':</b> '+w.msg+'</div>';
  });
  h+='</div>';
  el.innerHTML=h;
  if(!silent && typeof showToast==='function') showToast('Örnek yüklendi — '+warnings.length+' uyarı ('+errN+' hata).', errN?'warning':'info');
}

function veMntLoadExample(nodeId){
  if(typeof veMountCore==='undefined' || typeof createNode!=='function') return;
  var node = nodes.find(function(n){ return n.id===nodeId; });
  var key = (node && node.data && node.data.exampleKey) || 'ttar';
  var EX = veMountCore.TTAR_EXAMPLE; if(!EX) return;

  // Mevcut kütle/takoz bileşenlerini bul (Çözücü/Örnek/Görüntüleyici korunur).
  var toRemove = nodes.filter(function(n){ var d=_mntDef(n)||{}; return d.isMountBody || d.isMount; });
  if(toRemove.length){
    var ok = (typeof confirm==='undefined') ? true : confirm('Topolojide '+toRemove.length+' kütle/takoz bileşeni var. Örnek yüklenirken bunlar silinecek. Devam edilsin mi?');
    if(!ok) return;
    toRemove.forEach(function(n){ _mntRemoveNode(n.id); });
  }

  // Görünür alana ortalanacak taban koordinatı — bileşen sayısına göre yerleşim.
  var nBody=EX.components.length, nMnt=EX.mounts.length, half=Math.ceil(nMnt/2);
  var DX=120, bodyY=150, X0=140;
  var layout=[];
  EX.components.forEach(function(c,i){ layout.push({lx:X0+i*DX, ly:bodyY}); });
  EX.mounts.forEach(function(m,i){ var top=i<half, col=top?i:(i-half); layout.push({lx:X0+col*DX, ly: top?(bodyY-135):(bodyY+135)}); });
  var base = (typeof veArrangeModuleBase==='function') ? veArrangeModuleBase(layout) : { x:3000, y:3000 };

  var li=0;
  EX.components.forEach(function(c){
    var pos=layout[li++]; var before=nodes.length;
    createNode(_mntExampleBodyType(c.name), base.x+pos.lx, base.y+pos.ly);
    if(nodes.length>before){
      var n=nodes[nodes.length-1];
      n.data=Object.assign(n.data||{}, { mass:c.mass, cgx:c.cg[0], cgy:c.cg[1], cgz:c.cg[2], Ixx:c.Ixx, Iyy:c.Iyy, Izz:c.Izz, Ixy:c.Ixy, Ixz:c.Ixz, Iyz:c.Iyz, pointMass:!!c.pointMass });
      _mntSetNodeName(n, c.name);
    }
  });
  EX.mounts.forEach(function(m){
    var pos=layout[li++]; var before=nodes.length;
    createNode('mnt-mount', base.x+pos.lx, base.y+pos.ly);
    if(nodes.length>before){
      var n=nodes[nodes.length-1];
      n.data=Object.assign(n.data||{}, { x:m.pos[0], y:m.pos[1], z:m.pos[2], kxs:m.kstat[0], kys:m.kstat[1], kzs:m.kstat[2], kxd:m.kdyn[0], kyd:m.kdyn[1], kzd:m.kdyn[2] });
      _mntSetNodeName(n, m.name);
    }
  });

  // Çözücü yoksa ekle.
  if(!nodes.some(function(n){ return (_mntDef(n)||{}).isMountSolver; })){
    createNode('mnt-solver', base.x + X0 + Math.max(nBody, half)*DX, base.y + bodyY);
  }
  if(typeof saveState==='function') saveState();
  if(typeof updateAllConnections==='function') updateAllConnections();

  // createNode +20ms otomatik seçimi paneli son eklenen düğüme çevirir → Örnek
  // düğümünü yeniden seçip raporu bas ki kullanıcı uyarıları (fazla takoz vs)
  // görsün. setTimeout/DOM yoksa (Jest) doğrudan bas.
  var exNode = (typeof nodes!=='undefined') ? nodes.find(function(n){ return n.id===nodeId; }) : null;
  if(typeof setTimeout==='function' && typeof document!=='undefined'){
    setTimeout(function(){
      if(exNode && typeof clearSelection==='function' && typeof addToSelection==='function'){
        clearSelection(); addToSelection(exNode);
        if(typeof showNodeProperties==='function') showNodeProperties(exNode);
      }
      _mntRenderExampleReport(_mntExampleValidate(), false);
    }, 90);
  } else {
    _mntRenderExampleReport(_mntExampleValidate(), false);
  }
}

// ════════════════════════════════════════════════════════════════════════════
//  3D GÖRÜNTÜLEYİCİ — iç topolojinin 3B yerleşimi (tema uyumlu)
// ════════════════════════════════════════════════════════════════════════════
function getMntViewerPropertiesHTML(node){
  if(!node.data) node.data={};
  var html='<div class="sw-panel">';
  html+=_mntNote('İç topolojideki <b>tüm</b> kütle ve takozların 3B yerleşimi. <span style="color:var(--accent-success);">Yeşil</span>: takoz · <span style="color:var(--accent-warning);">turuncu</span>: bileşen CG · <span style="color:var(--accent-danger);">kırmızı</span>: birleşik CG. Sürükle döndür · sağ tık kaydır · tekerlek yakınlaş. Aktif tema ile uyumlu.','var(--accent-primary)');
  html+='<div id="ve-mnt-inline-viewer-wrap" style="width:100%; height:320px; border:1px solid var(--border-color); background:var(--bg-primary); position:relative; border-radius:6px; overflow:hidden;"><canvas id="ve-mnt-inline-viewer-canvas" style="width:100%; height:100%; display:block;"></canvas></div>';
  html+='<button onclick="veMntViewerRefresh()" style="width:100%; margin-top:8px; padding:9px; font-size:0.7rem; background:var(--bg-tertiary); color:var(--text-primary); border:1px solid var(--border-color); border-radius:5px; cursor:pointer;">↻ Yenile</button>';
  html+='</div>';
  return html;
}

// ════════════════════════════════════════════════════════════════════════════
//  TAKOZ ÖZELLİKLERİ PANELİ (kullanıcı tanımlı takoz kataloğu — ekle/çıkar/gör)
// ════════════════════════════════════════════════════════════════════════════
// mnt-library düğümü fiziksel topolojiye bağlanmaz; yalnızca kütüphaneyi
// genişletir. Kullanıcı takozları node.data.mounts içinde tutulur (proje
// kaydet/yükle otomatik). Buradaki her girdi tüm Takoz panellerinin "Kütüphaneden
// yükle" listesinde "Özel" grubunda görünür. Gömülü katalog salt-okunur gösterilir.
function _mntLibEnsure(node){
  if(!node.data) node.data={};
  if(!Array.isArray(node.data.mounts)) node.data.mounts=[];
  return node.data;
}
// Kütüphane girdisi için kompakt sayısal/metin input (satır içi düzenleme).
function _mntLibInp(nodeId, key, field, val, isText){
  var v=(val===undefined||val===null)?'':val;
  var common='width:100%; padding:3px 4px; font-size:0.62rem; background:var(--bg-input); color:var(--text-primary); border:1px solid var(--border-color); border-radius:0;';
  if(isText){
    return '<input type="text" value="'+_mntEsc(v)+'" onchange="veMntLibSet(\''+nodeId+'\',\''+_mntEsc(key)+'\',\''+field+'\',this.value)" style="'+common+'">';
  }
  return '<input type="number" value="'+_mntEsc(v)+'" step="1" onchange="veMntLibSet(\''+nodeId+'\',\''+_mntEsc(key)+'\',\''+field+'\',this.value)" style="'+common+' text-align:right;">';
}
function getMntLibraryPropertiesHTML(node){
  var d=_mntLibEnsure(node);
  var custom=d.mounts;
  var builtins=veMntGetLibraryList().filter(function(e){ return e.builtin; });
  var html='<div class="sw-panel">';
  html+='<div style="padding:8px 10px; margin-bottom:10px; font-size:0.62rem; line-height:1.45; color:var(--text-secondary); background:var(--bg-secondary); border:1px solid var(--border-color); border-left:3px solid var(--accent-success);">'
      + '<b style="color:var(--text-heading);">Takoz kataloğu.</b> Kendi takozlarınızı ekleyin; her girdi tüm <b>Takoz</b> bileşenlerinin <b>"Kütüphaneden rijitlik yükle"</b> listesinde <b>Özel</b> grubunda çıkar. Rijitlikler <b>N/mm</b>. Gömülü katalog salt-okunurdur.</div>';

  // ── Kullanıcı takozları (düzenlenebilir) ──
  html+='<div class="sw-section-title">Özel Takozlar <span style="font-size:0.55rem; font-weight:400; color:var(--text-muted);">'+custom.length+' adet · [N/mm]</span></div>';
  if(!custom.length){
    html+='<div style="padding:9px 10px; margin-bottom:8px; font-size:0.62rem; color:var(--text-muted); background:var(--bg-tertiary); border:1px dashed var(--border-color);">Henüz özel takoz yok. Aşağıdaki <b>＋ Yeni Takoz Ekle</b> ile başlayın.</div>';
  } else {
    html+='<div style="overflow-x:auto; margin-bottom:8px;"><table style="border-collapse:collapse; font-size:0.6rem; white-space:nowrap; min-width:100%;"><thead><tr style="background:var(--bg-tertiary);">';
    html+='<th style="'+_mntMxTh()+' text-align:left;">Ad</th>';
    ['kx','ky','kz'].forEach(function(l){ html+='<th style="'+_mntMxTh()+'">'+l+' (st)</th>'; });
    ['kx','ky','kz'].forEach(function(l){ html+='<th style="'+_mntMxTh()+'">'+l+' (dn)</th>'; });
    html+='<th style="'+_mntMxTh()+'"></th></tr></thead><tbody>';
    custom.forEach(function(e){
      html+='<tr>';
      html+='<td style="'+_mntMxTd()+' min-width:120px;">'+_mntLibInp(node.id,e.key,'name',e.name,true)+'</td>';
      html+='<td style="'+_mntMxTd()+' min-width:56px;">'+_mntLibInp(node.id,e.key,'sx',e.sx)+'</td>';
      html+='<td style="'+_mntMxTd()+' min-width:56px;">'+_mntLibInp(node.id,e.key,'sy',e.sy)+'</td>';
      html+='<td style="'+_mntMxTd()+' min-width:56px;">'+_mntLibInp(node.id,e.key,'sz',e.sz)+'</td>';
      html+='<td style="'+_mntMxTd()+' min-width:56px;">'+_mntLibInp(node.id,e.key,'dx',e.dx)+'</td>';
      html+='<td style="'+_mntMxTd()+' min-width:56px;">'+_mntLibInp(node.id,e.key,'dy',e.dy)+'</td>';
      html+='<td style="'+_mntMxTd()+' min-width:56px;">'+_mntLibInp(node.id,e.key,'dz',e.dz)+'</td>';
      html+='<td style="'+_mntMxTd()+'"><button onclick="veMntLibRemove(\''+node.id+'\',\''+_mntEsc(e.key)+'\')" title="Bu takozu sil" style="background:none; border:1px solid var(--border-color); color:var(--accent-danger); cursor:pointer; padding:2px 7px; font-size:0.72rem; line-height:1;">✕</button></td>';
      html+='</tr>';
    });
    html+='</tbody></table></div>';
  }
  html+='<button onclick="veMntLibAdd(\''+node.id+'\')" style="width:100%; padding:9px 12px; margin-bottom:14px; font-size:0.7rem; font-weight:700; background:var(--accent-success); color:#fff; border:none; cursor:pointer; letter-spacing:0.02em;" onmouseover="this.style.filter=\'brightness(1.1)\'" onmouseout="this.style.filter=\'none\'">＋ Yeni Takoz Ekle</button>';

  // ── Gömülü katalog (salt-okunur) ──
  html+='<div class="sw-section-title">Gömülü Katalog <span style="font-size:0.55rem; font-weight:400; color:var(--text-muted);">salt-okunur · [N/mm]</span></div>';
  html+='<div style="overflow-x:auto;"><table style="border-collapse:collapse; font-size:0.6rem; white-space:nowrap; min-width:100%;"><thead><tr style="background:var(--bg-tertiary);">';
  html+='<th style="'+_mntMxTh()+' text-align:left;">Ad</th>';
  ['kx','ky','kz'].forEach(function(l){ html+='<th style="'+_mntMxTh()+'">'+l+' (st)</th>'; });
  ['kx','ky','kz'].forEach(function(l){ html+='<th style="'+_mntMxTh()+'">'+l+' (dn)</th>'; });
  html+='</tr></thead><tbody>';
  builtins.forEach(function(e){
    html+='<tr>';
    html+='<td style="'+_mntMxTd()+' text-align:left; color:var(--text-secondary);">'+_mntEsc(e.name)+'</td>';
    html+='<td style="'+_mntMxTd()+'">'+e.sx+'</td><td style="'+_mntMxTd()+'">'+e.sy+'</td><td style="'+_mntMxTd()+'">'+e.sz+'</td>';
    html+='<td style="'+_mntMxTd()+'">'+e.dx+'</td><td style="'+_mntMxTd()+'">'+e.dy+'</td><td style="'+_mntMxTd()+'">'+e.dz+'</td>';
    html+='</tr>';
  });
  html+='</tbody></table></div>';
  html+='</div>';
  return html;
}

// Panel içi 3B görüntüleyiciyi güncel topolojiyle (yeniden) başlat.
function veMntViewerRefresh(){
  if(typeof _mntGatherForSolver!=='function') return;
  _veMntViewerData = _mntGatherForSolver();
  if(typeof veMountViewerInit==='function'){
    try{ veMountViewerInit('ve-mnt-inline-viewer-canvas'); veMountViewerUpdate(); }catch(e){}
  }
}

// ─── Kütüphane setter'ları ───────────────────────────────────────────────────
function veMntLibAdd(nodeId){
  var node=nodes.find(function(n){return n.id===nodeId;}); if(!node) return;
  var d=_mntLibEnsure(node);
  d._seq=(d._seq||0)+1;
  var key='mnt-usr-'+nodeId+'-'+d._seq;
  d.mounts.push({ key:key, name:'Yeni Takoz '+d._seq, sx:0, sy:0, sz:0, dx:0, dy:0, dz:0 });
  if(typeof saveState==='function') saveState();
  if(typeof showNodeProperties==='function') showNodeProperties(node);
}
function veMntLibRemove(nodeId, key){
  var node=nodes.find(function(n){return n.id===nodeId;}); if(!node) return;
  var d=_mntLibEnsure(node);
  d.mounts=d.mounts.filter(function(e){ return e.key!==key; });
  if(typeof saveState==='function') saveState();
  if(typeof showNodeProperties==='function') showNodeProperties(node);
}
function veMntLibSet(nodeId, key, field, val){
  var node=nodes.find(function(n){return n.id===nodeId;}); if(!node) return;
  var d=_mntLibEnsure(node);
  var e=d.mounts.find(function(x){ return x.key===key; }); if(!e) return;
  e[field]=(field==='name')?val:_mntNum(val);
  if(typeof saveState==='function') saveState();
  // Ad/rijitlik değişimi Takoz açılır listesini etkiler; panel yeniden çizilmez
  // (aktif input odağı korunur — girdiler zaten güncel değeri gösterir).
}

// ════════════════════════════════════════════════════════════════════════════
//  ÇÖZÜCÜ — bağlı node'ları topla, agrege et, çekirdeği çalıştır
// ════════════════════════════════════════════════════════════════════════════
// Çözücü, iç topolojideki TÜM kütle ve takoz node'larını OTOMATİK algılar —
// bağlantı zorunluluğu yoktur (kullanıcı isteği). Alt topoloji yalnız mount
// bileşenleri içerdiğinden nodes içindeki isMountBody/isMount düğümleri toplanır.
function _mntGatherForSolver(solver){
  var masses=[], mounts=[];
  (typeof nodes!=='undefined'?nodes:[]).forEach(function(n){
    var def=_mntDef(n)||{};
    if(def.isMountBody){
      var d=n.data||{};
      masses.push({ name:_mntNodeName(n), mass:d.mass, cgx:d.cgx, cgy:d.cgy, cgz:d.cgz, Ixx:d.Ixx, Iyy:d.Iyy, Izz:d.Izz, Ixy:d.Ixy, Ixz:d.Ixz, Iyz:d.Iyz, pointMass:!!d.pointMass });
    } else if(def.isMount){
      var m=n.data||{};
      mounts.push({ name:_mntNodeName(n), x:m.x, y:m.y, z:m.z, kxs:m.kxs, kys:m.kys, kzs:m.kzs, kxd:m.kxd, kyd:m.kyd, kzd:m.kzd });
    }
  });
  return { components:masses, mounts:mounts };
}
// UI (mm/kg/N/mm) → SI, otomatik yük durumlarıyla.
function _mntToSI(gather, g){
  var C=veMountCore;
  return {
    g: g||9.81,
    components: gather.components.map(function(c){ return {
      name:c.name||'kütle', mass:_mntNum(c.mass,0),
      cg:[C.mmToM(_mntNum(c.cgx)),C.mmToM(_mntNum(c.cgy)),C.mmToM(_mntNum(c.cgz))],
      I:[[_mntNum(c.Ixx),_mntNum(c.Ixy),_mntNum(c.Ixz)],[_mntNum(c.Ixy),_mntNum(c.Iyy),_mntNum(c.Iyz)],[_mntNum(c.Ixz),_mntNum(c.Iyz),_mntNum(c.Izz)]],
      pointMass:!!c.pointMass }; }),
    mounts: gather.mounts.map(function(m){ return {
      name:m.name||'takoz', pos:[C.mmToM(_mntNum(m.x)),C.mmToM(_mntNum(m.y)),C.mmToM(_mntNum(m.z))],
      kstat:[C.nPerMmToNPerM(_mntNum(m.kxs)),C.nPerMmToNPerM(_mntNum(m.kys)),C.nPerMmToNPerM(_mntNum(m.kzs))],
      kdyn:[C.nPerMmToNPerM(_mntNum(m.kxd)),C.nPerMmToNPerM(_mntNum(m.kyd)),C.nPerMmToNPerM(_mntNum(m.kzd))] }; }),
    loadCases: MNT_AUTO_CASES
  };
}

var _veMntLast=null;      // son sonuç (kopyala/CSV/3D için)
function getMntSolverPropertiesHTML(node){
  if(!node.data) node.data={};
  if(!node.data.matrixMode) node.data.matrixMode='delta';
  var html='<div class="sw-panel">';
  html+='<div style="padding:8px 10px; margin-bottom:10px; font-size:0.62rem; line-height:1.4; color:var(--text-secondary); background:var(--bg-secondary); border:1px solid var(--border-color); border-left:3px solid var(--accent-danger);">'
      + '<b style="color:var(--text-heading);">Çözücü.</b> İç topolojideki <b>tüm</b> kütle ve takoz bileşenlerini <b>otomatik algılar</b> (bağlantı gerekmez) ve 6 SD rijit gövde analizini çalıştırır. Yük durumları <b>otomatik</b> (Static / Max Bump / Acceleration / Braking / Cornering L-R).</div>';
  html+='<div style="display:flex; gap:6px; margin-bottom:10px;">';
  html+='<button onclick="veMntSolverCompute(\''+node.id+'\')" style="flex:1; padding:9px; font-size:0.74rem; font-weight:700; background:var(--accent-primary); color:#fff; border:none; cursor:pointer;">▶ Hesapla</button>';
  html+='<button onclick="veMntShowDetail(\''+node.id+'\')" style="padding:9px 10px; font-size:0.64rem; background:var(--bg-tertiary); color:var(--text-primary); border:1px solid var(--border-color); cursor:pointer;" title="Detaylı matris + 3D">Detay+3D</button>';
  html+='<button onclick="veMntRunSelfTest()" style="padding:9px 10px; font-size:0.64rem; background:var(--bg-tertiary); color:var(--text-primary); border:1px solid var(--border-color); cursor:pointer;" title="T1–T8">🧪</button>';
  html+='<button onclick="veMntOpenMathModal()" style="padding:9px 10px; font-size:0.64rem; background:var(--bg-tertiary); color:var(--text-primary); border:1px solid var(--border-color); cursor:pointer;" title="Matematik">📐</button>';
  html+='</div>';
  html+='<div id="ve-mnt-results"></div>';
  html+='</div>';
  return html;
}

// Hesap çekirdeği — DOM'DAN BAĞIMSIZ. _veMntLast'i üretir, döner.
// {error:[...]} (validasyon) | {mp,allCases,mounts,modes,gather,...} | null
function _mntComputeResults(solverId){
  var solver=nodes.find(function(n){return n.id===solverId;}); if(!solver) return null;
  var C=veMountCore;
  var gather=_mntGatherForSolver(solver);
  var si=_mntToSI(gather, 9.81);
  var problems=C.validateModel(si.components, si.mounts);
  if(problems.length){ _veMntLast=null; return { error:problems, gather:gather }; }
  var mp=C.combineMassProps(si.components);
  if(!mp){ _veMntLast=null; return { error:['Kütle hesaplanamadı (toplam ≤ 0).'], gather:gather }; }
  var model={ m:mp.m, cg:mp.cg, Kstat:C.buildK(si.mounts,mp.cg,false), mounts:si.mounts, g:si.g };
  var allCases=C.solveAllCases(model, si.loadCases);
  var Kdyn=C.buildK(si.mounts,mp.cg,true), M6=C.buildM6(mp.m,mp.I_G);
  var modes=C.solveModal(Kdyn, M6, si.mounts, mp.cg);
  var R={ mp:mp, allCases:allCases, mounts:si.mounts, modes:modes, gather:gather, matrixMode:(solver.data.matrixMode||'delta'), solverId:solverId };
  _veMntLast=R;
  return R;
}

// Çözücüyü çalıştır → #ve-mnt-results'a bas (varsa). Sonucu döner.
function veMntSolverCompute(solverId){
  var R=_mntComputeResults(solverId);
  var out=document.getElementById('ve-mnt-results'); if(!out) return R;
  if(!R){ out.innerHTML=''; return R; }
  if(R.error){
    out.innerHTML='<div style="padding:10px 12px; background:rgba(245,158,11,0.12); border:1px solid var(--accent-warning); color:var(--accent-warning); font-size:0.66rem; line-height:1.5;"><b>Bağlantı gerekli:</b><ul style="margin:6px 0 0 16px; padding:0;">'+R.error.map(function(p){return '<li>'+_mntEsc(p)+'</li>';}).join('')+'</ul><div style="margin-top:6px; color:var(--text-muted);">Kütle ve Takoz bileşenlerini bu Çözücü\'nün giriş portuna bağlayın.</div></div>';
    return R;
  }
  var mp=R.mp, allCases=R.allCases, modes=R.modes, si={mounts:R.mounts};
  var cgmm=mp.cg.map(function(v){return v*1000;});
  var h=_mntSecTitle('Kütle Özeti');
  h+='<table style="width:100%; border-collapse:collapse; font-size:0.63rem; margin-bottom:10px;">';
  h+='<tr><th style="'+_mntTh()+'">m</th><td style="'+_mntTd()+'">'+_mntFmt(mp.m,3)+' kg</td></tr>';
  h+='<tr><th style="'+_mntTh()+'">CG (mm)</th><td style="'+_mntTd()+'">('+_mntFmt(cgmm[0],1)+', '+_mntFmt(cgmm[1],1)+', '+_mntFmt(cgmm[2],1)+')</td></tr>';
  h+='</table>';
  // Kompakt δz matrisi (satır=durum, sütun=takoz, δz mm)
  h+=_mntDzMatrixHTML(allCases, si.mounts);
  // Modal
  h+=_mntModalHTML(modes);
  h+='<div style="display:flex; gap:6px; margin-top:8px;"><button onclick="veMntShowDetail(\''+solverId+'\')" style="flex:1; padding:6px; font-size:0.62rem; background:var(--bg-tertiary); color:var(--text-primary); border:1px solid var(--border-color); cursor:pointer;">Detaylı Sonuçlar + 3D</button><button onclick="veMntCopyResults()" style="padding:6px 10px; font-size:0.62rem; background:var(--bg-tertiary); color:var(--text-primary); border:1px solid var(--border-color); cursor:pointer;">📋</button><button onclick="veMntExportCSV()" style="padding:6px 10px; font-size:0.62rem; background:var(--bg-tertiary); color:var(--text-primary); border:1px solid var(--border-color); cursor:pointer;">CSV</button></div>';
  out.innerHTML=h;
}

// ─── Render yardımcıları ─────────────────────────────────────────────────────
function _mntSecTitle(t, sub){ return '<div style="display:flex; align-items:center; gap:8px; margin:6px 0 6px; font-size:0.74rem; font-weight:700; color:var(--text-heading); border-bottom:1px solid var(--border-color); padding-bottom:4px;"><span>'+t+'</span>'+(sub?'<span style="font-size:0.53rem; font-weight:400; color:var(--text-muted);">'+sub+'</span>':'')+'</div>'; }
function _mntTh(){ return 'padding:5px 8px; text-align:left; background:var(--bg-tertiary); border:1px solid var(--border-color); font-weight:500; color:var(--text-secondary); width:32%;'; }
function _mntTd(){ return 'padding:5px 8px; border:1px solid var(--border-color); color:var(--text-primary); font-weight:600;'; }
function _mntMxTh(){ return 'padding:3px 5px; border:1px solid var(--border-color); color:var(--text-secondary); font-weight:600; text-align:center;'; }
function _mntMxTd(){ return 'padding:3px 5px; border:1px solid var(--border-color); text-align:center; color:var(--text-primary);'; }
function _mntInertiaText(I){ var f=function(x){return Number.isFinite(x)?x.toFixed(2):'—';}; return '['+f(I[0][0])+', '+f(I[0][1])+', '+f(I[0][2])+']\n['+f(I[1][0])+', '+f(I[1][1])+', '+f(I[1][2])+']\n['+f(I[2][0])+', '+f(I[2][1])+', '+f(I[2][2])+']'; }

// Kompakt δz matrisi (yan panel için — dar)
function _mntDzMatrixHTML(allCases, mounts){
  var h=_mntSecTitle('Statik Çökme','δz [mm] · çekme mor');
  h+='<div style="overflow-x:auto; margin-bottom:10px;"><table style="border-collapse:collapse; font-size:0.55rem; white-space:nowrap;"><thead><tr style="background:var(--bg-tertiary);"><th style="'+_mntMxTh()+'">Durum</th>';
  mounts.forEach(function(m){ h+='<th style="'+_mntMxTh()+'" title="'+_mntEsc(m.name)+'">'+_mntEsc(m.name.length>7?m.name.slice(0,6)+'…':m.name)+'</th>'; });
  h+='<th style="'+_mntMxTh()+'">ΣFz</th></tr></thead><tbody>';
  allCases.forEach(function(rc){
    h+='<tr><td style="'+_mntMxTd()+' text-align:left; font-weight:600;">'+_mntEsc(rc.name)+'</td>';
    if(!rc.res){ h+='<td colspan="'+(mounts.length+1)+'" style="'+_mntMxTd()+' color:var(--accent-danger);">—</td></tr>'; return; }
    rc.res.perMount.forEach(function(pm){
      var dz=pm.delta[2]*1000, col=_mntDeflColor(dz);
      var mark=pm.tension?' outline:2px solid #a855f7; outline-offset:-2px;':'';
      var warn=pm.overLinear?' text-decoration:underline;':'';
      h+='<td style="'+_mntMxTd()+' color:'+col+'; font-weight:600;'+warn+mark+'">'+dz.toFixed(1)+'</td>';
    });
    h+='<td style="'+_mntMxTd()+'">'+(rc.res.checks.sumFzOk?'<span style="color:#22c55e;">✓</span>':'<span style="color:#ef4444;">✗</span>')+'</td></tr>';
  });
  h+='</tbody></table></div>';
  return h;
}
// Tam matris (δx/δy/δz veya kuvvet) — detay modalı için
function _mntFullMatrixHTML(allCases, mounts, mode){
  var isForce=(mode==='force');
  var h='<div style="display:flex; align-items:center; gap:8px; margin:6px 0 6px; font-size:0.76rem; font-weight:700; color:var(--text-heading); border-bottom:1px solid var(--border-color); padding-bottom:4px;"><span>Statik Çökme Matrisi</span><span style="font-size:0.52rem; font-weight:400; color:var(--text-muted);">'+(isForce?'kN':'mm')+' · |δ|>10mm/çekme işaretli</span><div style="flex:1;"></div><button onclick="veMntToggleMatrix()" style="padding:3px 8px; font-size:0.56rem; background:var(--bg-tertiary); color:var(--text-primary); border:1px solid var(--border-color); cursor:pointer;">'+(isForce?'→ Sehim':'→ Kuvvet')+'</button></div>';
  h+='<div style="overflow-x:auto; margin-bottom:12px;"><table style="border-collapse:collapse; font-size:0.56rem; white-space:nowrap;"><thead><tr style="background:var(--bg-tertiary);"><th rowspan="2" style="'+_mntMxTh()+'">Yük Durumu</th>';
  mounts.forEach(function(m){ h+='<th colspan="3" style="'+_mntMxTh()+'">'+_mntEsc(m.name)+'</th>'; });
  h+='<th rowspan="2" style="'+_mntMxTh()+'">ΣFz</th><th rowspan="2" style="'+_mntMxTh()+'">Çekme</th></tr><tr style="background:var(--bg-tertiary);">';
  mounts.forEach(function(){ ['x','y','z'].forEach(function(a){ h+='<th style="'+_mntMxTh()+'">'+a+'</th>'; }); });
  h+='</tr></thead><tbody>';
  allCases.forEach(function(rc){
    h+='<tr><td style="'+_mntMxTd()+' text-align:left; font-weight:600;">'+_mntEsc(rc.name)+'</td>';
    if(!rc.res){ h+='<td colspan="'+(mounts.length*3+2)+'" style="'+_mntMxTd()+' color:var(--accent-danger);">çözülemedi</td></tr>'; return; }
    rc.res.perMount.forEach(function(pm){
      for(var a=0;a<3;a++){
        var val=isForce?(pm.f[a]/1000):(pm.delta[a]*1000);
        var col=isForce?_mntForceColor(val):_mntDeflColor(val);
        var mark=(a===2&&pm.tension)?' outline:2px solid #a855f7; outline-offset:-2px;':'';
        var warn=(!isForce&&pm.overLinear)?' text-decoration:underline;':'';
        h+='<td style="'+_mntMxTd()+' color:'+col+'; font-weight:600;'+warn+mark+'">'+val.toFixed(2)+'</td>';
      }
    });
    var chk=rc.res.checks;
    h+='<td style="'+_mntMxTd()+'">'+(chk.sumFzOk?'<span style="color:#22c55e;">✓</span>':'<span style="color:#ef4444;">✗</span>')+' '+(rc.res.sumF[2]/1000).toFixed(1)+'</td>';
    h+='<td style="'+_mntMxTd()+' color:'+(chk.tensionCount?'#a855f7':'var(--text-muted)')+'; font-weight:600;">'+chk.tensionCount+'</td></tr>';
  });
  h+='</tbody></table></div>';
  return h;
}
function _mntModalHTML(modes){
  var h=_mntSecTitle('Modal Analiz','6 mod · K_dyn');
  if(!modes) return h+'<div style="color:var(--accent-danger); font-size:0.64rem;">Modal başarısız.</div>';
  h+='<div style="overflow-x:auto;"><table style="border-collapse:collapse; font-size:0.56rem; white-space:nowrap;"><thead><tr style="background:var(--bg-tertiary);">';
  ['Mod','f [Hz]','Etiket'].forEach(function(c){ h+='<th style="'+_mntMxTh()+'">'+c+'</th>'; });
  h+='</tr></thead><tbody>';
  modes.forEach(function(md,i){
    h+='<tr'+(md.warning?' title="'+_mntEsc(md.warning)+'"':'')+'><td style="'+_mntMxTd()+' font-weight:600;">'+(i+1)+'</td>';
    h+='<td style="'+_mntMxTd()+' font-weight:600; color:var(--accent-primary);">'+_mntFmt(md.f_Hz,3)+'</td>';
    h+='<td style="'+_mntMxTd()+' text-align:left; color:'+(md.warning?'#f59e0b':'var(--text-primary)')+';">'+_mntEsc(md.label)+'</td></tr>';
  });
  h+='</tbody></table></div>';
  return h;
}
function veMntToggleMatrix(){
  if(!_veMntLast) return;
  var solver=nodes.find(function(n){return n.id===_veMntLast.solverId;});
  if(solver){ solver.data.matrixMode=(solver.data.matrixMode==='force')?'delta':'force'; if(typeof saveState==='function') saveState(); }
  veMntShowDetail(_veMntLast.solverId);
}

// ─── Detay modalı (tam matris + 3D + mod şekilleri) ──────────────────────────
function veMntShowDetail(solverId){
  var R=(_veMntLast && _veMntLast.solverId===solverId) ? _veMntLast : _mntComputeResults(solverId);
  if(!R || R.error){ if(typeof showToast==='function') showToast('Önce Kütle ve Takoz bileşenlerini Çözücü\'ye bağlayın.','warning'); return; }
  var solver=nodes.find(function(n){return n.id===solverId;});
  var mode=(solver&&solver.data.matrixMode)||'delta';
  var h='<div style="display:flex; gap:14px; flex-wrap:wrap;">';
  h+='<div style="flex:1; min-width:320px;">';
  var cgmm=R.mp.cg.map(function(v){return v*1000;});
  h+=_mntSecTitle('Kütle Özeti');
  h+='<table style="width:100%; border-collapse:collapse; font-size:0.63rem; margin-bottom:10px;">';
  h+='<tr><th style="'+_mntTh()+'">m</th><td style="'+_mntTd()+'">'+_mntFmt(R.mp.m,3)+' kg</td></tr>';
  h+='<tr><th style="'+_mntTh()+'">CG (mm)</th><td style="'+_mntTd()+'">('+cgmm.map(function(v){return _mntFmt(v,2);}).join(', ')+')</td></tr>';
  h+='<tr><th style="'+_mntTh()+'">I_G</th><td style="'+_mntTd()+' font-family:monospace; font-size:0.54rem; white-space:pre;">'+_mntInertiaText(R.mp.I_G)+'</td></tr>';
  h+='</table>';
  h+=_mntFullMatrixHTML(R.allCases, R.mounts, mode);
  // modal + mod şekilleri
  h+=_mntSecTitle('Modal Analiz','mod şekli normalize');
  h+='<div style="overflow-x:auto;"><table style="border-collapse:collapse; font-size:0.55rem; white-space:nowrap;"><thead><tr style="background:var(--bg-tertiary);">';
  ['Mod','f [Hz]','Etiket','ux','uy','uz','θx','θy','θz'].forEach(function(c){ h+='<th style="'+_mntMxTh()+'">'+c+'</th>'; });
  h+='</tr></thead><tbody>';
  (R.modes||[]).forEach(function(md,i){
    h+='<tr><td style="'+_mntMxTd()+' font-weight:600;">'+(i+1)+'</td><td style="'+_mntMxTd()+' color:var(--accent-primary); font-weight:600;">'+_mntFmt(md.f_Hz,3)+'</td><td style="'+_mntMxTd()+' text-align:left;">'+_mntEsc(md.label)+'</td>';
    md.phi.forEach(function(v){ h+='<td style="'+_mntMxTd()+'"><span style="opacity:'+(0.35+0.65*Math.min(1,Math.abs(v)))+';">'+v.toFixed(2)+'</span></td>'; });
    h+='</tr>';
  });
  h+='</tbody></table></div>';
  h+='</div>';
  // 3D
  h+='<div style="width:340px; flex-shrink:0;"><div style="font-size:0.72rem; font-weight:700; color:var(--text-heading); margin-bottom:6px;">3D Görünüm</div><div id="ve-mnt-viewer-wrap" style="width:100%; height:320px; border:1px solid var(--border-color); background:var(--bg-primary); position:relative; border-radius:6px; overflow:hidden;"><canvas id="ve-mnt-viewer-canvas" style="width:100%; height:100%; display:block;"></canvas></div><div style="font-size:0.53rem; color:var(--text-muted); margin-top:5px;">Yeşil: takoz · turuncu: bileşen CG · kırmızı: birleşik CG. Sürükle döndür, tekerlek zoom.</div></div>';
  h+='</div>';
  _mntShowModal('Takoz Analizi — Detaylı Sonuçlar', h);
  // 3D viewer başlat
  if(typeof veMountViewerInit==='function'){
    _veMntViewerData = R.gather;
    setTimeout(function(){ try{ veMountViewerInit('ve-mnt-viewer-canvas'); veMountViewerUpdate(); }catch(e){} }, 60);
  }
}

// ─── Kopyala / CSV ───────────────────────────────────────────────────────────
function _mntResultsToText(){
  var R=_veMntLast; if(!R) return 'Önce hesaplayın.';
  var cg=R.mp.cg.map(function(v){return (v*1000).toFixed(3);});
  var t='TAKOZ ÇÖKME-TİTREŞİM\n====================\nKütle: '+R.mp.m.toFixed(3)+' kg\nCG (mm): ('+cg.join(', ')+')\nI_G:\n'+_mntInertiaText(R.mp.I_G)+'\n\nSTATİK ÇÖKME (δz, mm):\n';
  R.allCases.forEach(function(rc){ if(!rc.res){ t+=rc.name+': —\n'; return; } t+=rc.name+': '+rc.res.perMount.map(function(pm){var v=pm.delta[2]*1000; return (v<0?'':'+')+v.toFixed(2);}).join(' / ')+'  [ΣFz='+(rc.res.sumF[2]/1000).toFixed(2)+', çekme='+rc.res.checks.tensionCount+']\n'; });
  t+='\nMODAL (Hz): '+(R.modes||[]).map(function(m){return m.f_Hz.toFixed(3)+'('+m.label+')';}).join(', ');
  return t;
}
function veMntCopyResults(){
  var txt=_mntResultsToText();
  if(navigator.clipboard&&navigator.clipboard.writeText){ navigator.clipboard.writeText(txt).then(function(){ if(typeof showToast==='function') showToast('Kopyalandı.','success'); }); }
  else { var ta=document.createElement('textarea'); ta.value=txt; document.body.appendChild(ta); ta.select(); try{document.execCommand('copy');}catch(e){} ta.remove(); }
}
function veMntExportCSV(){
  var R=_veMntLast; if(!R){ if(typeof showToast==='function') showToast('Önce hesaplayın.','warning'); return; }
  var rows=[], head=['LoadCase'];
  R.mounts.forEach(function(m){ head.push(m.name+' dx',m.name+' dy',m.name+' dz'); });
  head.push('SumFz_kN','Tension'); rows.push(head.join(','));
  R.allCases.forEach(function(rc){ if(!rc.res){ rows.push(rc.name+',ERROR'); return; } var r=[rc.name]; rc.res.perMount.forEach(function(pm){ r.push((pm.delta[0]*1000).toFixed(3),(pm.delta[1]*1000).toFixed(3),(pm.delta[2]*1000).toFixed(3)); }); r.push((rc.res.sumF[2]/1000).toFixed(3), rc.res.checks.tensionCount); rows.push(r.join(',')); });
  var blob=new Blob([rows.join('\n')],{type:'text/csv'});
  var a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='takoz_cokme.csv'; a.click(); setTimeout(function(){URL.revokeObjectURL(a.href);},500);
}

// ─── Self-Test / Matematik ───────────────────────────────────────────────────
function veMntRunSelfTest(){
  var r=veMountCore.selfTest();
  var h='<div style="font-size:0.72rem;"><div style="font-weight:700; margin-bottom:10px; color:'+(r.failed===0?'#22c55e':'#ef4444')+';">'+(r.failed===0?'✓ TÜM TESTLER GEÇTİ':'✗ '+r.failed+' BAŞARISIZ')+' <span style="color:var(--text-muted); font-weight:400;">('+r.passed+' geçti / '+r.failed+' kaldı)</span></div>';
  h+='<table style="width:100%; border-collapse:collapse; font-size:0.62rem;"><thead><tr style="background:var(--bg-tertiary);"><th style="'+_mntMxTh()+'">Test</th><th style="'+_mntMxTh()+'">Ad</th><th style="'+_mntMxTh()+'">Sonuç</th></tr></thead><tbody>';
  r.details.forEach(function(dt){ h+='<tr><td style="'+_mntMxTd()+' font-weight:600;">'+_mntEsc(dt.id)+'</td><td style="'+_mntMxTd()+' text-align:left;">'+_mntEsc(dt.name)+'<div style="font-size:0.5rem; color:var(--text-muted); white-space:normal; max-width:520px;">'+_mntEsc(dt.detail)+'</div></td><td style="'+_mntMxTd()+'">'+(dt.ok?'<span style="color:#22c55e;">✓</span>':'<span style="color:#ef4444;">✗</span>')+'</td></tr>'; });
  h+='</tbody></table></div>';
  _mntShowModal('🧪 Self-Test — Kabul Testleri (Adams TTAR)', h);
}
function veMntOpenMathModal(){ _mntShowModal('📐 Takoz Modülünün Matematiği', _mntMathHTML()); }
function _mntMathHTML(){
  var eq='background:var(--bg-secondary); border:1px solid var(--border-color); padding:8px 12px; margin:6px 0; font-family:monospace; font-size:0.66rem; white-space:pre-wrap; overflow-x:auto;';
  var st='font-weight:700; color:var(--text-heading); margin:14px 0 4px; font-size:0.82rem;';
  var tx='font-size:0.68rem; line-height:1.55; color:var(--text-secondary); margin:4px 0;';
  var h='<div style="max-width:760px;">';
  h+='<div style="'+st+'">0. Model</div><div style="'+tx+'">Güç grubu tek rijit gövde; şasiye N takoz (üç eksenli lineer yay). 6 SD. Referans: birleşik CG. Yük durumları otomatik (g-tabanlı). Lineer model ±10 mm bandında Adams ile birebir.</div>';
  h+='<div style="'+st+'">1-3. Kinematik & matrisler</div><div style="'+eq+'">q=[ux,uy,uz,θx,θy,θz] ; d=r_mount−c_G\nδ=u+θ×d=A·q , A=[E3|−skew(d)]\nK=Σ Aᵢᵀ·diag(k)ᵢ·Aᵢ ; M6=blockdiag(m·E3, I_G)\nI_G=Σ[Iⱼ+mⱼ((dⱼ·dⱼ)E3−dⱼdⱼᵀ)]</div>';
  h+='<div style="'+st+'">4. Statik çözüm</div><div style="'+eq+'">F=[m·g·nx, m·g·ny, m·g·nz, 0,0,0] (nz yerçekimi DAHİL)\nq=K_stat⁻¹·F ; δᵢ=Aᵢ·q ; fᵢ=kᵢ·δᵢ\nΣfz=−m·g ; çekme: δz>+0.01 mm</div>';
  h+='<div style="'+st+'">5. Modal</div><div style="'+eq+'">(K_dyn−ω²M6)φ=0 → genelleştirilmiş özdeğer\nf_r=√λ_r/2π (6 mod, artan)</div>';
  h+='<div style="'+tx+'; color:var(--text-muted); margin-top:12px; border-top:1px solid var(--border-color); padding-top:8px;">Doğrulama: Adams BMC_TTAR_2031. Self-Test T1–T8 referans değerlerle eşleşir.</div></div>';
  return h;
}
function _mntShowModal(title, innerHTML){
  var old=document.getElementById('ve-mnt-submodal'); if(old) old.remove();
  var ov=document.createElement('div'); ov.id='ve-mnt-submodal';
  ov.style.cssText='position:fixed; inset:0; z-index:100030; background:rgba(0,0,0,0.6); display:flex; align-items:center; justify-content:center; padding:20px;';
  ov.addEventListener('mousedown', function(e){ if(e.target===ov){ if(typeof veMountViewerDispose==='function'){try{veMountViewerDispose();}catch(x){}} ov.remove(); } });
  var box=document.createElement('div');
  box.style.cssText='max-width:1200px; width:94%; max-height:90vh; overflow-y:auto; background:var(--bg-secondary); border:1px solid var(--border-color); box-shadow:0 20px 60px rgba(0,0,0,0.6);';
  box.innerHTML='<div style="display:flex; align-items:center; padding:12px 16px; border-bottom:1px solid var(--border-color); background:var(--bg-tertiary); position:sticky; top:0; z-index:1;"><span style="font-weight:700; font-size:0.88rem; color:var(--text-heading);">'+title+'</span><div style="flex:1;"></div><button onclick="if(typeof veMountViewerDispose===\'function\'){try{veMountViewerDispose();}catch(x){}} this.closest(\'#ve-mnt-submodal\').remove()" style="background:none; border:none; color:var(--text-muted); cursor:pointer; font-size:1.1rem;">✕</button></div><div style="padding:16px;">'+innerHTML+'</div>';
  ov.appendChild(box); document.body.appendChild(ov);
}

// 3D viewer veri sağlayıcısı (cp-mount-viewer.js okur)
var _veMntViewerData = null;

// Node/Jest için dışa aç
if(typeof module!=='undefined' && module.exports){
  module.exports = {
    getMntModulePropertiesHTML: getMntModulePropertiesHTML,
    getMntMassPropertiesHTML: getMntMassPropertiesHTML,
    getMntMountPropertiesHTML: getMntMountPropertiesHTML,
    getMntLibraryPropertiesHTML: getMntLibraryPropertiesHTML,
    getMntSolverPropertiesHTML: getMntSolverPropertiesHTML,
    getMntExamplePropertiesHTML: getMntExamplePropertiesHTML,
    getMntViewerPropertiesHTML: getMntViewerPropertiesHTML,
    VE_MOUNT_LIBRARY: VE_MOUNT_LIBRARY,
    veMntGetLibraryMap: veMntGetLibraryMap,
    veMntGetLibraryList: veMntGetLibraryList,
    veMntApplyLib: veMntApplyLib,
    veMntLibAdd: veMntLibAdd,
    veMntLibRemove: veMntLibRemove,
    veMntLibSet: veMntLibSet,
    MNT_AUTO_CASES: MNT_AUTO_CASES,
    VE_MNT_EXAMPLES: VE_MNT_EXAMPLES,
    VE_MNT_STARTER_LAYOUT: VE_MNT_STARTER_LAYOUT,
    _mntExampleBodyType: _mntExampleBodyType,
    _mntExampleValidate: _mntExampleValidate,
    _mntGatherForSolver: _mntGatherForSolver,
    _mntToSI: _mntToSI,
    _mntDeflColor: _mntDeflColor,
    _mntForceColor: _mntForceColor
  };
}
