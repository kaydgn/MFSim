// ============================================================================
// TAKOZ ÇÖKME-TİTREŞİM — GERÇEK KANVAS BİLEŞENLERİ (panel + çözücü)
// ============================================================================
// SPEC "Takoz Çökme–Titreşim Modülü (6 SD Rijit Gövde Modeli)" v1.0.
// Hesap çekirdeği: js/mount-core.js (veMountCore) — DOM'suz saf fonksiyonlar.
//
// MİMARİ (kullanıcı kararı): Motor / Şanzıman / Şaft / Braket / Transfer (kütle
// gövdeleri) ve Takoz bileşenleri iç topolojiye sürüklenir; BAĞLANTI YOKTUR
// (bağlantı portu bulunmaz). Çözücü iç topolojideki TÜM kütle+takoz düğümlerini
// (nodes içinde def.isMountBody / def.isMount) OTOMATİK algılayıp 6 SD analizini
// otomatik yük durumlarıyla çalıştırır — kullanıcı ne bağlantı ne yük durumu girer.
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

// ─── ETKİN KÜTÜPHANE (gömülü + gömülü override + kullanıcı tanımlı) ───────────
// Gömülü katalog (VE_MOUNT_LIBRARY) fabrika varsayılanıdır ve ÇALIŞMA ANINDA
// DEĞİŞMEZ (asla mutasyona uğramaz). "Takoz Özellikleri" (mnt-library) düğümleri:
//   node.data.mounts    → kullanıcı tanımlı takozlar (Özel grup)
//   node.data.overrides → gömülü takozlara alan-bazlı düzenleme (fabrikanın üzerine)
// Bu üç kaynak burada birleştirilir. Takoz panelinin kütüphane açılır listesi ve
// veMntApplyLib doğrudan VE_MOUNT_LIBRARY yerine bu birleşik haritayı okur —
// böylece kullanıcının eklediği/değiştirdiği takozlar da yansır. Override'lar
// alan-bazlıdır: düzenlenmemiş alanlar fabrika değerini izler; ↺ ile override
// silinince gömülü girdi fabrikaya döner. Girdi biçimi (birleşik):
//   { key, name, sx, sy, sz, dx, dy, dz, builtin, overridden }.
function veMntGetLibraryMap(){
  var map={};
  Object.keys(VE_MOUNT_LIBRARY).forEach(function(k){
    var m=VE_MOUNT_LIBRARY[k];
    map[k]={ key:k, name:m.name, sx:m.sx, sy:m.sy, sz:m.sz, dx:m.dx, dy:m.dy, dz:m.dz, builtin:true, overridden:false };
  });
  (typeof nodes!=='undefined'?nodes:[]).forEach(function(n){
    var def=_mntDef(n)||{};
    if(!def.isMountLibrary || !n.data) return;
    // Gömülü override'ları uygula (fabrika değerinin üzerine, alan-bazlı).
    var ov=n.data.overrides;
    if(ov && typeof ov==='object'){
      Object.keys(ov).forEach(function(k){
        var base=map[k]; if(!base) return;                // yalnız var olan gömülü girdiler
        var o=ov[k]||{}; if(!o || Object.keys(o).length===0) return;
        var pick=function(f){ return (o[f]!==undefined && o[f]!==null && o[f]!=='') ? (f==='name'?o[f]:_mntNum(o[f])) : base[f]; };
        map[k]={ key:k, name:pick('name'), sx:pick('sx'), sy:pick('sy'), sz:pick('sz'),
          dx:pick('dx'), dy:pick('dy'), dz:pick('dz'), builtin:true, overridden:true };
      });
    }
    // Kullanıcı tanımlı takozlar (Özel grup).
    if(Array.isArray(n.data.mounts)){
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
    html+='<tr><td style="padding:7px 8px; border:1px solid var(--border-color); color:var(--text-muted);">Henüz açılmadı — ilk açılışta hazır bileşenlerle başlar.</td></tr>';
  }
  html+='</table>';
  html+='<button onclick="veMntOpenEditor(\''+node.id+'\')" style="width:100%; padding:14px 16px; font-size:0.82rem; font-weight:700; background:var(--accent-primary); color:#fff; border:none; cursor:pointer; letter-spacing:0.03em;" onmouseover="this.style.filter=\'brightness(1.15)\'" onmouseout="this.style.filter=\'none\'">▶ Alt Topolojiyi Aç</button>';
  html+='</div>';
  return html;
}

// İlk açılışta iç topolojiye yerleştirilecek hazır yerleşim (yerel px, referans
// görsel düzeni). Analiz araçları (Koordinat Düzlemi / Takoz Özellikleri / 3D
// Görüntüleyici / 2D Görünüm / Örnek / Çözücü) + fiziksel gövdeler (Motor /
// Şanzıman / Transfer / Şaft) + 5 takoz. Kurulumda görünür alana ortalanır.
var VE_MNT_STARTER_LAYOUT = [
  // Üst şerit: araçlar + üst takozlar + Çözücü
  { type:'mnt-coordframe',                    lx:20,  ly:20  },
  { type:'mnt-mount',    name:'Sağ Yan Takoz',  lx:225, ly:30 },
  { type:'mnt-mount',    name:'Sağ Arka Takoz', lx:380, ly:30 },
  { type:'mnt-library',                       lx:560, ly:20  },
  { type:'mnt-viewer',                        lx:685, ly:20  },
  { type:'mnt-solver',   name:'Çözücü',        lx:810, ly:20  },
  // Orta şerit: fiziksel gövdeler + 2D Görünüm
  { type:'mnt-mount',    name:'Ön Takoz',      lx:20,  ly:205 },
  { type:'mnt-motor',    name:'Motor',         lx:130, ly:195 },
  { type:'mnt-gearbox',  name:'Şanzıman',      lx:270, ly:205 },
  { type:'mnt-transfer', name:'Transfer Kutusu', lx:395, ly:205 },
  { type:'mnt-shaft',    name:'Şaft',          lx:525, ly:205 },
  { type:'mnt-2dview',                         lx:685, ly:200 },
  // Alt şerit: alt takozlar + Örnek
  { type:'mnt-mount',    name:'Sol Yan Takoz',  lx:225, ly:370 },
  { type:'mnt-mount',    name:'Sol Arka Takoz', lx:380, ly:370 },
  { type:'mnt-example',                        lx:810, ly:370 }
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
// ─── Estetik girdi yardımcıları (kompakt, ince, hizalı) ──────────────────────
// Ortak input stili — küçük, zarif, odakta vurgu.
var _MNT_INP='padding:4px 6px; font-size:0.66rem; height:25px; background:var(--bg-input); color:var(--text-primary); border:1px solid var(--border-color); border-radius:4px; text-align:right; box-sizing:border-box;';
// Bölüm başlığı (ince alt çizgi + opsiyonel birim).
function _mntGrpTitle(title, unit){
  return '<div style="font-size:0.6rem; font-weight:700; color:var(--text-heading); border-bottom:1px solid var(--border-color); padding-bottom:4px; margin:3px 0 9px;">'+title+(unit?' <span style="font-size:0.52rem; font-weight:400; color:var(--text-muted);">'+unit+'</span>':'')+'</div>';
}
// Kart sarmalı — başlık + aksan çubuğu + içerik. Bölümleri görsel olarak gruplar
// (estetik: yumuşak zemin, yuvarlak köşe, sol aksan).
function _mntCard(title, unit, accent, inner){
  var head = title ? '<div style="display:flex; align-items:center; gap:7px; margin-bottom:9px;">'
    + '<span style="width:3px; height:12px; border-radius:2px; background:'+(accent||'var(--accent-primary)')+';"></span>'
    + '<span style="font-size:0.635rem; font-weight:700; color:var(--text-heading); letter-spacing:0.02em;">'+title+'</span>'
    + (unit ? '<span style="font-size:0.5rem; font-weight:400; color:var(--text-muted);">'+unit+'</span>' : '')
    + '</div>' : '';
  return '<div style="background:var(--bg-secondary); border:1px solid var(--border-color); border-radius:9px; padding:11px 12px 6px; margin-bottom:9px;">'+head+inner+'</div>';
}
// Etiketli 3'lü inline grup (x/y/z yan yana). title boşsa üst başlık çizilmez
// (kart başlığı kapsıyorsa). subLabel verilirse solda küçük bir alt-etiket olur.
function _mntTriple(node, title, unit, keys, subs, step){
  var h='<div style="margin-bottom:9px;">';
  if(title){ h+='<div style="font-size:0.55rem; font-weight:600; color:var(--text-secondary); letter-spacing:0.03em; text-transform:uppercase; margin-bottom:5px;">'+title+(unit?' <span style="color:var(--text-muted); font-weight:400; text-transform:none; letter-spacing:0;">'+unit+'</span>':'')+'</div>'; }
  h+='<div style="display:flex; gap:5px;">';
  for(var i=0;i<3;i++){
    var key=keys[i];
    var v=(node.data[key]===undefined||node.data[key]===null)?'':node.data[key];
    h+='<label style="flex:1; min-width:0; display:flex; flex-direction:column; gap:2px;">'
      +'<span style="font-size:0.52rem; color:var(--text-muted); text-align:center;">'+subs[i]+'</span>'
      +'<input type="number" id="ve-mnt-'+key+'-'+node.id+'" value="'+_mntEsc(v)+'" step="'+(step||'any')+'" onchange="veMntSet(\''+node.id+'\',\''+key+'\',this.value)" style="width:100%; '+_MNT_INP+'">'
      +'</label>';
  }
  h+='</div></div>';
  return h;
}
// Tek etiketli alan (etiket sol, dar input sağ).
function _mntSingle(node, title, unit, key, ph, step){
  var v=(node.data[key]===undefined||node.data[key]===null)?'':node.data[key];
  return '<div style="display:flex; align-items:center; gap:10px; margin-bottom:9px;">'
    +'<div style="flex:1; font-size:0.66rem; font-weight:600; color:var(--text-secondary);">'+title+(unit?' <span style="color:var(--text-muted); font-weight:400;">'+unit+'</span>':'')+'</div>'
    +'<input type="number" id="ve-mnt-'+key+'-'+node.id+'" value="'+_mntEsc(v)+'" step="'+(step||'any')+'" placeholder="'+(ph||'')+'" onchange="veMntSet(\''+node.id+'\',\''+key+'\',this.value)" style="width:120px; '+_MNT_INP+'">'
    +'</div>';
}
// Etiketli hücre ızgarası (cells=[{key,label,step,ph}], cols sütun).
function _mntGrid(node, cells, cols){
  cols=cols||3;
  var h='<div style="display:grid; grid-template-columns:repeat('+cols+',1fr); gap:7px 6px; margin-bottom:9px;">';
  cells.forEach(function(c){
    var v=(node.data[c.key]===undefined||node.data[c.key]===null)?'':node.data[c.key];
    h+='<label style="display:flex; flex-direction:column; gap:2px; min-width:0;">'
      +'<span style="font-size:0.52rem; color:var(--text-muted); text-align:center; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">'+c.label+'</span>'
      +'<input type="number" id="ve-mnt-'+c.key+'-'+node.id+'" value="'+_mntEsc(v)+'" step="'+(c.step||'any')+'"'+(c.ph?' placeholder="'+_mntEsc(c.ph)+'"':'')+' onchange="veMntSet(\''+node.id+'\',\''+c.key+'\',this.value)" style="width:100%; '+_MNT_INP+'">'
      +'</label>';
  });
  h+='</div>';
  return h;
}
// Kısa ipucu satırı (not kutusu değil — tek satır, sade).
function _mntHint(text){
  return '<div style="font-size:0.52rem; color:var(--text-muted); line-height:1.4; margin:-3px 0 9px;">'+text+'</div>';
}

// ─── Tipe özel kinematik bölümleri (tork yük durumları için) ─────────────────
// Motor tork zinciri girdileri komponentler içine dağıtılır: Motor→tepe tork,
// Şanzıman→vites oranları + stall, Transfer→transfer oranı + aks payı.
function _mntEngineSection(node){
  return _mntCard('Motor · Tahrik','', 'var(--accent-danger)',
      _mntGrid(node, [
        {key:'Te',      label:'Tepe Tork [Nm]', step:'1',   ph:'760'},
        {key:'TeRpm',   label:'@ Devir [rpm]',  step:'1',   ph:'1500'},
        {key:'Pmax',    label:'Maks Güç [kW]',  step:'0.1', ph:'156.6'},
        {key:'PmaxRpm', label:'@ Devir [rpm]',  step:'1',   ph:'2300'},
        {key:'idleRpm', label:'Rölanti [rpm]',  step:'1',   ph:'800'}
      ], 3)
    + _mntHint('Tork yük durumları <b>Tepe Tork</b> değerinden türetilir; devir/güç bilgi amaçlıdır.'));
}
function _mntGearboxSection(node){
  return _mntCard('Şanzıman · Vites Oranları','', 'var(--accent-danger)',
      _mntGrid(node, [
        {key:'g1', label:'1. Vites',    step:'0.01', ph:'3.10'},
        {key:'g2', label:'2. Vites',    step:'0.01', ph:'1.81'},
        {key:'g3', label:'3. Vites',    step:'0.01', ph:'1.41'},
        {key:'g4', label:'4. Vites',    step:'0.01', ph:'1.00'},
        {key:'g5', label:'5. Vites',    step:'0.01', ph:'0.71'},
        {key:'g6', label:'6. Vites',    step:'0.01', ph:'0.61'},
        {key:'gR', label:'Geri',        step:'0.01', ph:'-4.49'},
        {key:'Rstall', label:'Stall Oranı', step:'0.01', ph:'1.58'}
      ], 4)
    + _mntHint('İleri tork durumu <b>1. Vites</b> (en yüksek redüksiyon), geri tork <b>Geri</b> ile hesaplanır. Stall Oranı = konvertör tork çarpanı.'));
}
function _mntTransferSection(node){
  return _mntCard('Transfer Kutusu · Tahrik','', 'var(--accent-danger)',
      _mntGrid(node, [
        {key:'iTransfer', label:'Oran',      step:'0.001', ph:'3.428'},
        {key:'phiFwd',    label:'Aks Payı φ (ileri)', step:'0.001', ph:'1'},
        {key:'phiRev',    label:'Aks Payı φ (geri)',  step:'0.001', ph:'1'}
      ], 3)
    + _mntHint('Aks payı φ: takozlara ulaşan tork oranı (varsayılan 1 = tam tepki).'));
}

function getMntMassPropertiesHTML(node){
  _mntEnsureMassData(node);
  var d=node.data;
  var html='<div class="sw-panel">';
  html+=_mntCard('Kütle & Ağırlık Merkezi','[kg · mm]','var(--accent-primary)',
      _mntSingle(node,'Kütle','[kg]','mass','ör: 1386.3','0.001')
    + _mntTriple(node,'Ağırlık Merkezi (CG)','[mm]',['cgx','cgy','cgz'],['x','y','z'],'0.01'));
  html+='<label style="display:flex; align-items:center; gap:8px; font-size:0.64rem; color:var(--text-secondary); margin:0 2px 9px; cursor:pointer;"><input type="checkbox" '+(d.pointMass?'checked':'')+' onchange="veMntSetCheck(\''+node.id+'\',\'pointMass\',this.checked)"> Nokta kütle (atalet = 0)</label>';
  if(!d.pointMass){
    html+=_mntCard('Atalet Tensörü','[kg·m²]','var(--accent-warning)',
        _mntTriple(node,'Köşegen','',['Ixx','Iyy','Izz'],['Ixx','Iyy','Izz'],'0.001')
      + _mntTriple(node,'Çarpım','',['Ixy','Ixz','Iyz'],['Ixy','Ixz','Iyz'],'0.001'));
  }
  if(node.type==='mnt-motor')         html+=_mntEngineSection(node);
  else if(node.type==='mnt-gearbox')  html+=_mntGearboxSection(node);
  else if(node.type==='mnt-transfer') html+=_mntTransferSection(node);
  html+='</div>';
  return html;
}

// ════════════════════════════════════════════════════════════════════════════
//  TAKOZ PANELİ (konum + statik/dinamik rijitlik + kütüphane)
// ════════════════════════════════════════════════════════════════════════════
function getMntMountPropertiesHTML(node){
  if(!node.data) node.data={};
  var html='<div class="sw-panel">';
  // Kütüphane (gömülü + "Takoz Özellikleri" ile eklenen kullanıcı takozları)
  var _lib=veMntGetLibraryList();
  var _libB=_lib.filter(function(e){ return e.builtin; });
  var _libC=_lib.filter(function(e){ return !e.builtin; });
  var sel='<select onchange="veMntApplyLib(\''+node.id+'\',this.value)" style="width:100%; padding:5px 8px; font-size:0.66rem; background:var(--bg-input); color:var(--text-primary); border:1px solid var(--border-color); border-radius:5px;"><option value="">— Kütüphaneden rijitlik yükle —</option>';
  if(_libB.length){ sel+='<optgroup label="Gömülü">'; _libB.forEach(function(e){ sel+='<option value="'+_mntEsc(e.key)+'"'+(node.data.libKey===e.key?' selected':'')+'>'+_mntEsc(e.name)+'</option>'; }); sel+='</optgroup>'; }
  if(_libC.length){ sel+='<optgroup label="Özel (Takoz Özellikleri)">'; _libC.forEach(function(e){ sel+='<option value="'+_mntEsc(e.key)+'"'+(node.data.libKey===e.key?' selected':'')+'>'+_mntEsc(e.name)+'</option>'; }); sel+='</optgroup>'; }
  sel+='</select>';
  html+=_mntCard('Kütüphane','', 'var(--accent-success)', sel);
  html+=_mntCard('Konum','[mm]','var(--accent-primary)', _mntTriple(node,'','',['x','y','z'],['x','y','z'],'0.01'));
  html+=_mntCard('Statik Rijitlik','[N/mm]','var(--accent-warning)', _mntTriple(node,'','',['kxs','kys','kzs'],['kx','ky','kz'],'1'));
  html+=_mntCard('Dinamik Rijitlik','[N/mm]','var(--accent-warning)', _mntTriple(node,'','',['kxd','kyd','kzd'],['kx','ky','kz'],'1'));
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
// Örnek seçimi: kalıcı yaz + paneli yeniden çiz (görsel/detay canlı değişsin).
function veMntSetExample(nodeId, key){
  var node=nodes.find(function(n){return n.id===nodeId;}); if(!node) return;
  if(!node.data) node.data={};
  node.data.exampleKey=key;
  if(typeof saveState==='function') saveState();
  if(typeof showNodeProperties==='function') showNodeProperties(node);
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
//  ÖRNEK — hazır doğrulama modellerini seç, önizle ve topolojiye yükle
// ════════════════════════════════════════════════════════════════════════════
// "Örnek" bileşeni: gömülü örnek modelleri (veMountCore.MOUNT_EXAMPLES) seçip
// önizler ve tek tıkla iç topolojiye kurar. Panel yukarıdan aşağı: preset seçici
// → topoloji görseli → araç detayları → "Örneği Aktar" → tutarlılık raporu.
// Yeni örnek eklemek: mount-core.js MOUNT_EXAMPLES defterine bir giriş ekle —
// başka hiçbir yeri değiştirmeye gerek yoktur (panel + yükleyici buradan okur).

// Kayıt defteri erişimi — çekirdeğe bağlı, çekirdek yoksa güvenli düşüş.
function _mntExampleReg(key){
  if(typeof veMountCore!=='undefined' && veMountCore.getMountExample) return veMountCore.getMountExample(key);
  var m=(typeof veMountCore!=='undefined') ? veMountCore.TTAR_EXAMPLE : null;
  return { id:'ttar', name:'BMC TTAR 2031', vehicle:'BMC TTAR 2031', model:m };
}
function _mntExampleList(){
  if(typeof veMountCore!=='undefined' && veMountCore.getMountExampleList) return veMountCore.getMountExampleList();
  return [_mntExampleReg('ttar')];
}

// Örnek adı → kanvas kütle-gövdesi tipi (test buildTTARTopology ile aynı eşleme).
// Yükleyici önce c.kind'i, yoksa bu adı kullanır.
function _mntExampleBodyType(name){
  return /motor/i.test(name) ? 'mnt-motor'
    : /şanz|sanz/i.test(name) ? 'mnt-gearbox'
    : /şaft|saft|shaft/i.test(name) ? 'mnt-shaft'
    : /cradle|braket|bracket/i.test(name) ? 'mnt-bracket' : 'mnt-transfer';
}

// Örnek modelinin yerel-piksel yerleşimi — HEM otomatik şema HEM yükleyici bunu
// kullanır, böylece görsel ile "Aktar"ın kurduğu topoloji birebir aynıdır.
// Koordinatlar STARTER yerleşimiyle uyumlu: kütleler orta bant (ly=205),
// takozlar ilk yarısı üst (ly=40), kalanı alt (ly=360). Bir bileşen veya takoz
// kendi at:[lx,ly] konumunu taşırsa o kullanılır (görsele tam uyum).
function _mntExampleLayout(model){
  var comps=(model&&model.components)||[], mounts=(model&&model.mounts)||[];
  var bodyY=205, half=Math.ceil(mounts.length/2);
  var bodies=comps.map(function(c,i){
    return (c.at&&c.at.length===2) ? {lx:c.at[0], ly:c.at[1]} : {lx:130+i*95, ly:bodyY};
  });
  var mnts=mounts.map(function(m,i){
    if(m.at&&m.at.length===2) return {lx:m.at[0], ly:m.at[1]};
    var top=i<half, col=top?i:(i-half);
    return {lx:140+col*140, ly: top?40:360};
  });
  return { bodies:bodies, mnts:mnts, bodyY:bodyY, half:half };
}

// Modelden tema-uyumlu şematik SVG üret (örnek kendi görselini vermediğinde).
// Kütleler yuvarlak dikdörtgen, takozlar yeşil daire; renkler var(--…) ile
// aydınlık/karanlık temaya uyar. Yükleyiciyle aynı yerleşimi çizer.
function _mntExampleDiagramSVG(model){
  if(!model || !model.components || !model.components.length) return '';
  var L=_mntExampleLayout(model), comps=model.components, mounts=model.mounts||[];
  var BW=100, BH=48, MR=16, M=26, xs=[], ys=[];
  L.bodies.forEach(function(p){ xs.push(p.lx-BW/2, p.lx+BW/2); ys.push(p.ly-BH/2, p.ly+BH/2); });
  L.mnts.forEach(function(p){ xs.push(p.lx-MR, p.lx+MR); ys.push(p.ly-MR-14, p.ly+MR+14); });
  var minX=Math.round(Math.min.apply(null,xs)-M), maxX=Math.round(Math.max.apply(null,xs)+M);
  var minY=Math.round(Math.min.apply(null,ys)-M), maxY=Math.round(Math.max.apply(null,ys)+M);
  var s='<svg viewBox="'+minX+' '+minY+' '+(maxX-minX)+' '+(maxY-minY)+'" width="100%" preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg" style="display:block;font-family:inherit;">';
  // Takoz → en yakın kütle ince kılavuz çizgisi (arka planda)
  mounts.forEach(function(m,i){
    var p=L.mnts[i], nb=L.bodies[0], bd=Infinity;
    L.bodies.forEach(function(bp){ var d=Math.abs(bp.lx-p.lx); if(d<bd){ bd=d; nb=bp; } });
    s+='<line x1="'+p.lx+'" y1="'+p.ly+'" x2="'+nb.lx+'" y2="'+nb.ly+'" stroke="var(--border-hover)" stroke-width="1.4" stroke-dasharray="3 3" opacity="0.6"/>';
  });
  // Takozlar
  mounts.forEach(function(m,i){
    var p=L.mnts[i], below=p.ly>L.bodyY, ty=below?(p.ly+MR+13):(p.ly-MR-6);
    s+='<circle cx="'+p.lx+'" cy="'+p.ly+'" r="'+MR+'" fill="var(--accent-success)" fill-opacity="0.16" stroke="var(--accent-success)" stroke-width="2"/>';
    s+='<circle cx="'+p.lx+'" cy="'+p.ly+'" r="4" fill="var(--accent-success)"/>';
    s+='<text x="'+p.lx+'" y="'+ty+'" text-anchor="middle" font-size="11" fill="var(--text-secondary)">'+_mntEsc(m.name)+'</text>';
  });
  // Kütle gövdeleri
  comps.forEach(function(c,i){
    var p=L.bodies[i];
    s+='<rect x="'+(p.lx-BW/2)+'" y="'+(p.ly-BH/2)+'" width="'+BW+'" height="'+BH+'" rx="7" fill="var(--bg-tertiary)" stroke="var(--accent-primary)" stroke-width="2"/>';
    s+='<text x="'+p.lx+'" y="'+(p.ly+4)+'" text-anchor="middle" font-size="12" font-weight="600" fill="var(--text-primary)">'+_mntEsc(c.name)+'</text>';
  });
  s+='</svg>';
  return s;
}

// Örnek görselini panele bas: inline SVG → doğrudan (tema uyumlu); data-URI →
// <img> (raster/svg). Boşsa çağıran taraf otomatik şemaya düşer.
function _mntExampleImageHTML(image){
  var s=String(image==null?'':image).trim();
  if(!s) return '';
  if(/^<svg/i.test(s)) return s;
  return '<img src="'+_mntEsc(s)+'" alt="Topoloji şeması" style="display:block; width:100%; height:auto;"/>';
}

// Detay bloğu — araç adı + kısa etiket + açıklama + spec tablosu.
function _mntExampleDetailsHTML(ex){
  var h='<div style="margin-bottom:12px;">';
  h+='<div style="font-size:0.82rem; font-weight:700; color:var(--text-heading); line-height:1.25;">'+_mntEsc(ex.vehicle||ex.name||'')+'</div>';
  if(ex.subtitle) h+='<div style="font-size:0.62rem; color:var(--accent-primary); font-weight:600; margin-top:2px;">'+_mntEsc(ex.subtitle)+'</div>';
  if(ex.description) h+='<div style="font-size:0.62rem; color:var(--text-secondary); line-height:1.5; margin-top:7px;">'+_mntEsc(ex.description)+'</div>';
  h+='</div>';
  var specs=ex.specs||[];
  if(specs.length){
    h+='<table style="width:100%; font-size:0.64rem; border-collapse:collapse; border:1px solid var(--border-color); margin-bottom:13px;">';
    specs.forEach(function(r){
      h+='<tr style="border-bottom:1px solid var(--border-color);">'
        +'<th style="padding:5px 9px; text-align:left; background:var(--bg-tertiary); border-right:1px solid var(--border-color); width:52%; font-weight:500; color:var(--text-secondary); white-space:nowrap;">'+_mntEsc(r[0])+'</th>'
        +'<td style="padding:5px 9px; color:var(--text-primary); font-weight:600;">'+_mntEsc(r[1])+'</td></tr>';
    });
    h+='</table>';
  }
  return h;
}

function getMntExamplePropertiesHTML(node){
  if(!node.data) node.data={};
  var list=_mntExampleList();
  var sel=node.data.exampleKey || (list[0]&&list[0].id) || 'ttar';
  var ex=_mntExampleReg(sel);
  var nid=node.id;
  var diagram = ex.image ? _mntExampleImageHTML(ex.image) : _mntExampleDiagramSVG(ex.model);
  var html='<div class="sw-panel">';
  html+='<div style="font-size:0.575rem; font-weight:700; color:var(--text-secondary); letter-spacing:0.04em; text-transform:uppercase; margin-bottom:5px;">Örnek Model</div>';
  html+='<select id="ve-mnt-example-sel" onchange="veMntSetExample(\''+nid+'\',this.value)" style="width:100%; padding:5px 8px; font-size:0.66rem; background:var(--bg-input); color:var(--text-primary); border:1px solid var(--border-color); border-radius:4px; margin-bottom:11px;">';
  list.forEach(function(e){ html+='<option value="'+_mntEsc(e.id)+'"'+(sel===e.id?' selected':'')+'>'+_mntEsc(e.name)+'</option>'; });
  html+='</select>';
  if(diagram){
    html+='<div style="font-size:0.55rem; font-weight:700; color:var(--text-muted); letter-spacing:0.03em; text-transform:uppercase; margin-bottom:5px;">Topoloji</div>';
    html+='<div style="width:100%; padding:10px; box-sizing:border-box; border:1px solid var(--border-color); background:var(--bg-primary); border-radius:6px; margin-bottom:12px; overflow:hidden;">'+diagram+'</div>';
  }
  html+=_mntExampleDetailsHTML(ex);
  html+='<button onclick="veMntLoadExample(\''+nid+'\')" style="width:100%; padding:11px 14px; font-size:0.76rem; font-weight:700; background:var(--accent-warning); color:#111; border:none; cursor:pointer; border-radius:5px; letter-spacing:0.02em;" onmouseover="this.style.filter=\'brightness(1.1)\'" onmouseout="this.style.filter=\'none\'">▶ Örneği Aktar</button>';
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
  // Seçilen örneğin modelini kayıt defterinden çöz (bilinmezse TTAR'a düşer).
  var ex = (veMountCore.getMountExample) ? veMountCore.getMountExample(key) : null;
  var EX = (ex && ex.model) || veMountCore.TTAR_EXAMPLE; if(!EX) return;

  // Mevcut kütle/takoz bileşenlerini bul (Çözücü/Örnek/Görüntüleyici korunur).
  var toRemove = nodes.filter(function(n){ var d=_mntDef(n)||{}; return d.isMountBody || d.isMount; });
  if(toRemove.length){
    var ok = (typeof confirm==='undefined') ? true : confirm('Topolojide '+toRemove.length+' kütle/takoz bileşeni var. Örnek yüklenirken bunlar silinecek. Devam edilsin mi?');
    if(!ok) return;
    toRemove.forEach(function(n){ _mntRemoveNode(n.id); });
  }

  // Örnek düğümlerini STARTER ile aynı tabana göre yerleştir ki yardımcı araçlarla
  // (Koordinat Düzlemi / 3D / 2D / Örnek / Çözücü — sağ ve üst kenarda) çakışmasın.
  // Yerleşim panel önizlemesiyle AYNI (_mntExampleLayout) → görsel ile kurulan
  // topoloji birebir örtüşür; bileşen/takoz kendi at:[lx,ly]'sini taşıyabilir.
  var LAY=_mntExampleLayout(EX);
  var layout=LAY.bodies.concat(LAY.mnts);
  var base = (typeof veArrangeModuleBase==='function')
    ? veArrangeModuleBase(VE_MNT_STARTER_LAYOUT.map(function(it){ return {lx:it.lx, ly:it.ly}; }))
    : { x:3000, y:3000 };

  var tq=EX.torque||{};
  var li=0;
  EX.components.forEach(function(c){
    var pos=layout[li++]; var before=nodes.length;
    var kind=c.kind || _mntExampleBodyType(c.name);
    createNode(kind, base.x+pos.lx, base.y+pos.ly);
    if(nodes.length>before){
      var n=nodes[nodes.length-1];
      n.data=Object.assign(n.data||{}, { mass:c.mass, cgx:c.cg[0], cgy:c.cg[1], cgz:c.cg[2], Ixx:c.Ixx, Iyy:c.Iyy, Izz:c.Izz, Ixy:c.Ixy, Ixz:c.Ixz, Iyz:c.Iyz, pointMass:!!c.pointMass });
      // Tork zinciri: Motor→Te; Şanzıman→vites/stall + transfer/aks payı
      // (örnekte ayrı Transfer gövdesi yok → değerler Şanzıman'da tutulur).
      if(kind==='mnt-motor'){ n.data.Te=tq.Te; }
      else if(kind==='mnt-gearbox' && tq.fwd){
        n.data.g1=tq.fwd.iGear; n.data.gR=(tq.rev||{}).iGear; n.data.Rstall=tq.Rstall;
        n.data.iTransfer=tq.iTransfer; n.data.phiFwd=tq.fwd.phiAxle; n.data.phiRev=(tq.rev||{}).phiAxle; n.data.derate=tq.derate;
      }
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

  // Çözücü yoksa ekle (starter'daki sağ-üst konuma).
  if(!nodes.some(function(n){ return (_mntDef(n)||{}).isMountSolver; })){
    createNode('mnt-solver', base.x + 810, base.y + 20);
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
// Görüntüleyici araç çubuğu düğmesi (aç/kapa görünümlü).
function _mntVwrBtn(onclick, label, title, active){
  return '<button onclick="'+onclick+'" title="'+_mntEsc(title||label)+'" style="padding:4px 9px; font-size:0.6rem; background:var(--bg-tertiary); color:var(--text-primary); border:1px solid var(--border-color); border-radius:4px; cursor:pointer; opacity:'+(active===false?'0.45':'1')+';">'+label+'</button>';
}
// Renk lejantı (slim, tek satır).
function _mntVwrLegend(){
  function chip(col,txt){ return '<span style="display:inline-flex; align-items:center; gap:4px;"><span style="width:9px; height:9px; border-radius:50%; background:'+col+'; display:inline-block;"></span>'+txt+'</span>'; }
  return '<div style="display:flex; flex-wrap:wrap; gap:12px; font-size:0.55rem; color:var(--text-muted); margin-bottom:7px;">'
    + chip('#22c55e','Takoz') + chip('#f59e0b','Bileşen CG') + chip('#ef4444','Birleşik CG') + '</div>';
}
function getMntViewerPropertiesHTML(node){
  if(!node.data) node.data={};
  var html='<div class="sw-panel">';
  html+=_mntVwrLegend();
  // Araç çubuğu — görünüm katmanları + sıfırla + büyüt/küçült
  html+='<div style="display:flex; align-items:center; gap:5px; flex-wrap:wrap; margin-bottom:7px;">';
  html+=_mntVwrBtn("var v=veMountViewerToggle('grid'); this.style.opacity=v?'1':'0.45';",'Zemin','Zemin ızgarasını gizle/göster');
  html+=_mntVwrBtn("var v=veMountViewerToggle('axes'); this.style.opacity=v?'1':'0.45';",'Eksen','Eksenleri gizle/göster');
  html+=_mntVwrBtn("var v=veMountViewerToggle('labels'); this.style.opacity=v?'1':'0.45';",'Etiket','Eksen etiketlerini gizle/göster');
  html+=_mntVwrBtn("veMountViewerReset();",'⟳ Sıfırla','Görünümü sıfırla');
  html+='</div>';
  html+='<div id="ve-mnt-inline-viewer-wrap" style="width:100%; height:340px; overflow:hidden; border:1px solid var(--border-color); background:var(--bg-primary); position:relative; border-radius:6px;"><canvas id="ve-mnt-inline-viewer-canvas" style="width:100%; height:100%; display:block;"></canvas></div>';
  html+='<div style="font-size:0.5rem; color:var(--text-muted); margin-top:4px;">Sol tık döndür · sağ tık kaydır · tekerlek yakınlaş.</div>';
  html+='<button onclick="veMntViewerRefresh()" style="width:100%; margin-top:7px; padding:8px; font-size:0.68rem; background:var(--bg-tertiary); color:var(--text-primary); border:1px solid var(--border-color); border-radius:5px; cursor:pointer;">↻ Yenile</button>';
  html+='</div>';
  return html;
}

// ════════════════════════════════════════════════════════════════════════════
//  KOORDİNAT DÜZLEMİ — koordinat sistemini 3B göster (eksen + düzlem + yön)
// ════════════════════════════════════════════════════════════════════════════
function getMntCoordFramePropertiesHTML(node){
  if(!node.data) node.data={};
  var html='<div class="sw-panel">';
  html+='<div style="font-size:0.575rem; font-weight:700; color:var(--text-secondary); letter-spacing:0.04em; text-transform:uppercase; margin-bottom:6px;">Koordinat Sistemi</div>';
  // Eksen yönü açıklaması (konum/CG değerlerinin hangi eksene göre girildiği)
  function axRow(col,ax,desc){ return '<div style="display:flex; align-items:center; gap:8px; padding:4px 0; font-size:0.62rem;"><span style="width:11px; height:11px; border-radius:2px; background:'+col+'; flex-shrink:0;"></span><b style="color:var(--text-primary); width:14px;">'+ax+'</b><span style="color:var(--text-secondary);">'+desc+'</span></div>'; }
  html+='<div style="margin-bottom:8px;">';
  html+=axRow('#ef4444','X','İleri–geri ekseni · +X araç arkası, −X ön');
  html+=axRow('#22c55e','Y','Yanal eksen · +Y sağ, −Y sol');
  html+=axRow('#3b82f6','Z','Düşey eksen · +Z yukarı, −Z aşağı');
  html+='</div>';
  html+='<div style="display:flex; align-items:center; gap:5px; flex-wrap:wrap; margin-bottom:7px;">';
  html+=_mntVwrBtn("var v=veMountViewerToggle('planes'); this.style.opacity=v?'1':'0.45';",'Düzlem','Koordinat düzlemlerini gizle/göster');
  html+=_mntVwrBtn("var v=veMountViewerToggle('grid'); this.style.opacity=v?'1':'0.45';",'Zemin','Zemin ızgarasını gizle/göster');
  html+=_mntVwrBtn("veMountViewerReset();",'⟳ Sıfırla','Görünümü sıfırla');
  html+='</div>';
  html+='<div id="ve-mnt-coord-wrap" style="width:100%; height:340px; overflow:hidden; border:1px solid var(--border-color); background:var(--bg-primary); position:relative; border-radius:6px;"><canvas id="ve-mnt-coord-canvas" style="width:100%; height:100%; display:block;"></canvas></div>';
  html+='<div style="font-size:0.5rem; color:var(--text-muted); margin-top:4px;">Sol tık döndür · tekerlek yakınlaş. Konum ve CG değerleri bu eksenlere göre girilir.</div>';
  html+='</div>';
  return html;
}
function veMntCoordFrameRefresh(){
  if(typeof veMountViewerInit==='function'){
    try{ veMountViewerInit('ve-mnt-coord-canvas','coordframe'); veMountViewerUpdate(); }catch(e){}
  }
}

// ════════════════════════════════════════════════════════════════════════════
//  2D GÖRÜNÜM — üstten (X–Y) + yandan (X–Z) ölçekli diyagram (akademik)
// ════════════════════════════════════════════════════════════════════════════
// Takozlar (yeşil kare), bileşen ağırlık merkezleri (turuncu daire, kütleye göre
// boyut) ve birleşik ağırlık merkezi (kırmızı G işareti) ölçekli çizilir. X ekseni
// yatay (ortak); üstten görünüşte +Y yukarı (sağ üstte), yandan görünüşte +Z yukarı.
function getMnt2DViewPropertiesHTML(node){
  if(!node.data) node.data={};
  var html='<div class="sw-panel">';
  html+='<div style="font-size:0.56rem; color:var(--text-muted); line-height:1.4; margin-bottom:8px;">Güç grubunun <b>üstten (X–Y)</b> ve <b>yandan (X–Z)</b> ölçekli diyagramı: takozlar, bileşen ağırlık merkezleri ve birleşik ağırlık merkezi. Topoloji değiştikçe <b>Yenile</b> ile güncellenir.</div>';
  html+='<div id="ve-mnt-2dview-box" style="width:100%; background:var(--bg-primary); border:1px solid var(--border-color); border-radius:8px; padding:6px 8px; overflow:auto;"></div>';
  html+='<button onclick="veMnt2DViewRefresh()" style="width:100%; margin-top:8px; padding:8px; font-size:0.68rem; background:var(--bg-tertiary); color:var(--text-primary); border:1px solid var(--border-color); border-radius:5px; cursor:pointer;">↻ Yenile</button>';
  html+='</div>';
  return html;
}
function veMnt2DViewRefresh(){
  var box=(typeof document!=='undefined')?document.getElementById('ve-mnt-2dview-box'):null;
  if(!box) return;
  box.innerHTML=_mnt2DViewSVG(_mnt2DGather());
}
// Topolojiden 2D diyagram verisi topla (SI değil — mm; birleşik CG kütle-ağırlıklı).
function _mnt2DGather(){
  var g=_mntGatherForSolver();
  var num=function(v){ var n=Number(String(v).replace(',','.')); return Number.isFinite(n)?n:NaN; };
  var comps=g.components.map(function(c){ return {name:c.name, mass:num(c.mass), x:num(c.cgx), y:num(c.cgy), z:num(c.cgz)}; })
    .filter(function(c){ return Number.isFinite(c.x)&&Number.isFinite(c.y)&&Number.isFinite(c.z); });
  var mounts=g.mounts.map(function(m){ return {name:m.name, x:num(m.x), y:num(m.y), z:num(m.z)}; })
    .filter(function(m){ return Number.isFinite(m.x)&&Number.isFinite(m.y)&&Number.isFinite(m.z); });
  var mSum=0,sx=0,sy=0,sz=0;
  comps.forEach(function(c){ if(c.mass>0){ mSum+=c.mass; sx+=c.mass*c.x; sy+=c.mass*c.y; sz+=c.mass*c.z; } });
  var cg=mSum>0?{x:sx/mSum,y:sy/mSum,z:sz/mSum,m:mSum}:null;
  return { comps:comps, mounts:mounts, cg:cg };
}
// SVG metin/işaret yardımcıları
function _mnt2DText(x,y,t,anchor,color,size,bold){
  return '<text x="'+_mnt2DR(x)+'" y="'+_mnt2DR(y)+'" text-anchor="'+(anchor||'middle')+'" font-size="'+(size||8)+'" fill="'+(color||'var(--text-secondary)')+'"'+(bold?' font-weight="700"':'')+'>'+_mntEsc(t)+'</text>';
}
function _mnt2DR(v){ return Math.round(v*10)/10; }
function _mnt2DArrow(x1,y1,x2,y2,color){
  var ang=Math.atan2(y2-y1,x2-x1), hl=6;
  var ax=x2-hl*Math.cos(ang-0.4), ay=y2-hl*Math.sin(ang-0.4);
  var bx=x2-hl*Math.cos(ang+0.4), by=y2-hl*Math.sin(ang+0.4);
  return '<line x1="'+_mnt2DR(x1)+'" y1="'+_mnt2DR(y1)+'" x2="'+_mnt2DR(x2)+'" y2="'+_mnt2DR(y2)+'" stroke="'+color+'" stroke-width="1.4"/>'
    + '<polygon points="'+_mnt2DR(x2)+','+_mnt2DR(y2)+' '+_mnt2DR(ax)+','+_mnt2DR(ay)+' '+_mnt2DR(bx)+','+_mnt2DR(by)+'" fill="'+color+'"/>';
}
// Birleşik CG işareti (4 çeyrek — jeodezik CG sembolü)
function _mnt2DCGMark(cx,cy){
  var r=7, s='';
  s+='<circle cx="'+_mnt2DR(cx)+'" cy="'+_mnt2DR(cy)+'" r="'+r+'" fill="var(--bg-primary)" stroke="var(--accent-danger)" stroke-width="1.4"/>';
  s+='<path d="M'+_mnt2DR(cx)+' '+_mnt2DR(cy)+' L'+_mnt2DR(cx+r)+' '+_mnt2DR(cy)+' A'+r+' '+r+' 0 0 1 '+_mnt2DR(cx)+' '+_mnt2DR(cy+r)+' Z" fill="var(--accent-danger)"/>';
  s+='<path d="M'+_mnt2DR(cx)+' '+_mnt2DR(cy)+' L'+_mnt2DR(cx-r)+' '+_mnt2DR(cy)+' A'+r+' '+r+' 0 0 1 '+_mnt2DR(cx)+' '+_mnt2DR(cy-r)+' Z" fill="var(--accent-danger)"/>';
  return s;
}
function _mnt2DViewSVG(data){
  if(!data.comps.length && !data.mounts.length){
    return '<div style="padding:20px 8px; text-align:center; font-size:0.62rem; color:var(--text-muted);">Görüntülenecek bileşen yok — Motor / Şanzıman / Takoz ekleyip değer girin.</div>';
  }
  var xs=[]; data.mounts.forEach(function(m){xs.push(m.x);}); data.comps.forEach(function(c){xs.push(c.x);}); if(data.cg) xs.push(data.cg.x);
  var minX=Math.min.apply(null,xs), maxX=Math.max.apply(null,xs), xRange=Math.max(maxX-minX,1);
  var VB_W=640, mL=66, mR=22, usableW=VB_W-mL-mR;
  var s=Math.max(0.015, Math.min(0.55, usableW/xRange));
  function px(x){ return mL+(x-minX)*s; }
  var ys=[0]; data.mounts.forEach(function(m){ys.push(m.y);}); data.comps.forEach(function(c){ys.push(c.y);}); if(data.cg) ys.push(data.cg.y);
  var minY=Math.min.apply(null,ys), maxY=Math.max.apply(null,ys), yRange=Math.max(maxY-minY,1);
  var hTop=Math.max(yRange*s, 62);
  var zs=[0]; data.mounts.forEach(function(m){zs.push(m.z);}); data.comps.forEach(function(c){zs.push(c.z);}); if(data.cg) zs.push(data.cg.z);
  var minZ=Math.min.apply(null,zs), maxZ=Math.max.apply(null,zs), zRange=Math.max(maxZ-minZ,1);
  var hSide=Math.max(zRange*s, 62);
  var titleH=20, capH=16, gap=26, mTop=6, mBot=8;
  var topTitleY=mTop+12, topY0=mTop+titleH;
  var topCapY=topY0+hTop+12;
  var sideTitleY=topCapY+gap, sideY0=sideTitleY+8;
  var sideCapY=sideY0+hSide+12;
  var VB_H=sideCapY+mBot+2;
  function pyTop(y){ return topY0+(maxY-y)*s; }
  function pySide(z){ return sideY0+(maxZ-z)*s; }
  // kütle → daire yarıçapı
  var ms=data.comps.map(function(c){return c.mass;}).filter(function(m){return m>0;});
  var mMin=ms.length?Math.min.apply(null,ms):0, mMax=ms.length?Math.max.apply(null,ms):1;
  function cr(m){ if(!(m>0)) return 4.5; var t=(mMax-mMin>1e-9)?(m-mMin)/(mMax-mMin):0.5; return 4.5+5*Math.sqrt(t); }
  function shortName(n){ n=String(n||''); return n.length>13?n.slice(0,12)+'…':n; }

  var svg='<svg viewBox="0 0 '+VB_W+' '+Math.round(VB_H)+'" width="100%" style="display:block; font-family:inherit;">';

  // ── ÜST GÖRÜNÜŞ (X–Y) ──
  svg+=_mnt2DText(mL, topTitleY, 'Üstten Görünüş — X–Y düzlemi (ölçekli)', 'start', 'var(--text-heading)', 9.5, true);
  // referans centerline (CG y)
  if(data.cg){ svg+='<line x1="'+_mnt2DR(mL-6)+'" y1="'+_mnt2DR(pyTop(data.cg.y))+'" x2="'+_mnt2DR(VB_W-mR)+'" y2="'+_mnt2DR(pyTop(data.cg.y))+'" stroke="var(--border-color)" stroke-width="1" stroke-dasharray="4 3"/>'; }
  // eksen göstergesi (sol)
  (function(){ var ox=16, oy=topY0+30;
    svg+=_mnt2DArrow(ox,oy,ox+30,oy,'var(--accent-danger)')+_mnt2DText(ox+33,oy+3,'+X','start','var(--accent-danger)',7.5,true);
    svg+=_mnt2DArrow(ox,oy,ox,oy-26,'var(--accent-success)')+_mnt2DText(ox-2,oy-29,'+Y','middle','var(--accent-success)',7.5,true);
    svg+=_mnt2DText(ox+2,oy+16,'(sağ ↑)','start','var(--text-muted)',6);
  })();
  // takozlar (kare)
  data.mounts.forEach(function(m){ var cx=px(m.x), cy=pyTop(m.y);
    svg+='<rect x="'+_mnt2DR(cx-5)+'" y="'+_mnt2DR(cy-5)+'" width="10" height="10" fill="none" stroke="var(--accent-success)" stroke-width="1.6"/>';
    svg+=_mnt2DText(cx, cy+13, shortName(m.name), 'middle', 'var(--text-muted)', 6);
  });
  // bileşen CG (daire)
  data.comps.forEach(function(c){ var cx=px(c.x), cy=pyTop(c.y), r=cr(c.mass);
    svg+='<circle cx="'+_mnt2DR(cx)+'" cy="'+_mnt2DR(cy)+'" r="'+_mnt2DR(r)+'" fill="none" stroke="var(--accent-warning)" stroke-width="1.6"/>';
    svg+=_mnt2DText(cx, cy-r-2, shortName(c.name), 'middle', 'var(--text-secondary)', 6.2);
  });
  // birleşik CG
  if(data.cg){ var gx=px(data.cg.x), gy=pyTop(data.cg.y);
    svg+=_mnt2DCGMark(gx,gy);
    svg+=_mnt2DText(gx, gy-11, 'G ('+data.cg.x.toFixed(1)+' · '+data.cg.y.toFixed(1)+')', 'middle', 'var(--accent-danger)', 6.6, true);
  }

  // ── YAN GÖRÜNÜŞ (X–Z) ──
  svg+=_mnt2DText(mL, sideTitleY, 'Yandan Görünüş — X–Z düzlemi (ölçekli)', 'start', 'var(--text-heading)', 9.5, true);
  // zemin çizgisi (Z=0)
  svg+='<line x1="'+_mnt2DR(mL-6)+'" y1="'+_mnt2DR(pySide(0))+'" x2="'+_mnt2DR(VB_W-mR)+'" y2="'+_mnt2DR(pySide(0))+'" stroke="var(--border-color)" stroke-width="1" stroke-dasharray="4 3"/>';
  svg+=_mnt2DText(VB_W-mR, pySide(0)-3, 'Z=0', 'end', 'var(--text-muted)', 6.5);
  (function(){ var ox=16, oy=sideY0+30;
    svg+=_mnt2DArrow(ox,oy,ox+30,oy,'var(--accent-danger)')+_mnt2DText(ox+33,oy+3,'+X','start','var(--accent-danger)',7.5,true);
    svg+=_mnt2DArrow(ox,oy,ox,oy-26,'var(--accent-primary)')+_mnt2DText(ox-2,oy-29,'+Z','middle','var(--accent-primary)',7.5,true);
    svg+=_mnt2DText(ox+2,oy+16,'(yukarı)','start','var(--text-muted)',6);
  })();
  data.mounts.forEach(function(m){ var cx=px(m.x), cy=pySide(m.z);
    svg+='<rect x="'+_mnt2DR(cx-5)+'" y="'+_mnt2DR(cy-5)+'" width="10" height="10" fill="none" stroke="var(--accent-success)" stroke-width="1.6"/>';
  });
  data.comps.forEach(function(c){ var cx=px(c.x), cy=pySide(c.z), r=cr(c.mass);
    svg+='<circle cx="'+_mnt2DR(cx)+'" cy="'+_mnt2DR(cy)+'" r="'+_mnt2DR(r)+'" fill="none" stroke="var(--accent-warning)" stroke-width="1.6"/>';
    svg+=_mnt2DText(cx, cy-r-2, shortName(c.name), 'middle', 'var(--text-secondary)', 6.2);
  });
  if(data.cg){ var gx2=px(data.cg.x), gy2=pySide(data.cg.z);
    svg+=_mnt2DCGMark(gx2,gy2);
    svg+=_mnt2DText(gx2, gy2-11, 'G (z='+data.cg.z.toFixed(0)+')', 'middle', 'var(--accent-danger)', 6.6, true);
  }
  // lejant
  svg+=_mnt2DText(mL, sideCapY, '◻ takoz   ○ bileşen CG   ⊕ birleşik CG', 'start', 'var(--text-muted)', 7);
  svg+='</svg>';
  return svg;
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
// setter: değişimi yazan fonksiyon adı — Özel takoz için 'veMntLibSet',
// gömülü override için 'veMntLibSetBuiltin' (varsayılan: veMntLibSet).
function _mntLibInp(nodeId, key, field, val, isText, setter){
  var fn=setter||'veMntLibSet';
  var v=(val===undefined||val===null)?'':val;
  var common='width:100%; padding:3px 4px; font-size:0.62rem; background:var(--bg-input); color:var(--text-primary); border:1px solid var(--border-color); border-radius:0;';
  if(isText){
    return '<input type="text" value="'+_mntEsc(v)+'" onchange="'+fn+'(\''+nodeId+'\',\''+_mntEsc(key)+'\',\''+field+'\',this.value)" style="'+common+'">';
  }
  return '<input type="number" value="'+_mntEsc(v)+'" step="1" onchange="'+fn+'(\''+nodeId+'\',\''+_mntEsc(key)+'\',\''+field+'\',this.value)" style="'+common+' text-align:right;">';
}
function getMntLibraryPropertiesHTML(node){
  var d=_mntLibEnsure(node);
  var custom=d.mounts;
  var builtins=veMntGetLibraryList().filter(function(e){ return e.builtin; });
  var html='<div class="sw-panel">';
  html+='<div style="font-size:0.56rem; color:var(--text-muted); line-height:1.4; margin-bottom:9px;">Eklenen takozlar tüm Takoz bileşenlerinin kütüphane listesinde çıkar. Rijitlikler N/mm. Gömülü katalog da düzenlenebilir (↺ fabrikaya döner).</div>';

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

  // ── Gömülü katalog (düzenlenebilir; ↺ ile fabrika ayarına dön) ──
  var nOv=builtins.filter(function(e){ return e.overridden; }).length;
  html+='<div class="sw-section-title">Gömülü Katalog <span style="font-size:0.55rem; font-weight:400; color:var(--text-muted);">düzenlenebilir'+(nOv?' · '+nOv+' değiştirildi':'')+' · [N/mm]</span></div>';
  html+='<div style="overflow-x:auto;"><table style="border-collapse:collapse; font-size:0.6rem; white-space:nowrap; min-width:100%;"><thead><tr style="background:var(--bg-tertiary);">';
  html+='<th style="'+_mntMxTh()+' text-align:left;">Ad</th>';
  ['kx','ky','kz'].forEach(function(l){ html+='<th style="'+_mntMxTh()+'">'+l+' (st)</th>'; });
  ['kx','ky','kz'].forEach(function(l){ html+='<th style="'+_mntMxTh()+'">'+l+' (dn)</th>'; });
  html+='<th style="'+_mntMxTh()+'"></th></tr></thead><tbody>';
  builtins.forEach(function(e){
    var ov=e.overridden;
    var dot=ov?'<span title="Fabrikadan değiştirildi" style="color:var(--accent-warning); margin-right:3px;">●</span>':'';
    html+='<tr>';
    html+='<td style="'+_mntMxTd()+' text-align:left; min-width:120px;">'+dot+_mntLibInp(node.id,e.key,'name',e.name,true,'veMntLibSetBuiltin')+'</td>';
    html+='<td style="'+_mntMxTd()+' min-width:56px;">'+_mntLibInp(node.id,e.key,'sx',e.sx,false,'veMntLibSetBuiltin')+'</td>';
    html+='<td style="'+_mntMxTd()+' min-width:56px;">'+_mntLibInp(node.id,e.key,'sy',e.sy,false,'veMntLibSetBuiltin')+'</td>';
    html+='<td style="'+_mntMxTd()+' min-width:56px;">'+_mntLibInp(node.id,e.key,'sz',e.sz,false,'veMntLibSetBuiltin')+'</td>';
    html+='<td style="'+_mntMxTd()+' min-width:56px;">'+_mntLibInp(node.id,e.key,'dx',e.dx,false,'veMntLibSetBuiltin')+'</td>';
    html+='<td style="'+_mntMxTd()+' min-width:56px;">'+_mntLibInp(node.id,e.key,'dy',e.dy,false,'veMntLibSetBuiltin')+'</td>';
    html+='<td style="'+_mntMxTd()+' min-width:56px;">'+_mntLibInp(node.id,e.key,'dz',e.dz,false,'veMntLibSetBuiltin')+'</td>';
    html+='<td style="'+_mntMxTd()+'"><button onclick="veMntLibResetBuiltin(\''+node.id+'\',\''+_mntEsc(e.key)+'\')" title="Fabrika ayarına dön" style="background:none; border:1px solid var(--border-color); color:'+(ov?'var(--accent-warning)':'var(--text-muted)')+'; cursor:pointer; padding:2px 7px; font-size:0.72rem; line-height:1;">↺</button></td>';
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
// Gömülü takoz düzenleme — fabrika VE_MOUNT_LIBRARY'yi asla mutasyona uğratmaz;
// değişikliği node.data.overrides[key][field] içine alan-bazlı yazar (kalıcı).
function veMntLibSetBuiltin(nodeId, key, field, val){
  if(!VE_MOUNT_LIBRARY[key]) return;                       // yalnız var olan gömülü girdi
  var node=nodes.find(function(n){return n.id===nodeId;}); if(!node) return;
  if(!node.data) node.data={};
  if(!node.data.overrides || typeof node.data.overrides!=='object') node.data.overrides={};
  if(!node.data.overrides[key]) node.data.overrides[key]={};
  node.data.overrides[key][field]=(field==='name')?val:_mntNum(val);
  if(typeof saveState==='function') saveState();
  // Panel yeniden çizilmez (aktif input odağı korunur); ● rozeti bir sonraki
  // açılışta güncellenir, ↺ butonu her zaman tıklanabilir.
}
// Gömülü takozu fabrika ayarına döndür — override'ı sil.
function veMntLibResetBuiltin(nodeId, key){
  var node=nodes.find(function(n){return n.id===nodeId;}); if(!node) return;
  if(node.data && node.data.overrides && node.data.overrides[key]!==undefined){
    delete node.data.overrides[key];
    if(typeof saveState==='function') saveState();
  }
  if(typeof showNodeProperties==='function') showNodeProperties(node); // fabrika değerlerini geri bas
}

// ════════════════════════════════════════════════════════════════════════════
//  ÇÖZÜCÜ — bağlı node'ları topla, agrege et, çekirdeği çalıştır
// ════════════════════════════════════════════════════════════════════════════
// Çözücü, iç topolojideki TÜM kütle ve takoz node'larını OTOMATİK algılar —
// bağlantı zorunluluğu yoktur (kullanıcı isteği). Alt topoloji yalnız mount
// bileşenleri içerdiğinden nodes içindeki isMountBody/isMount düğümleri toplanır.
// Tork zinciri girdilerini (Te / vites / transfer / aks payı) kütle
// gövdelerinden konumdan bağımsız topla — hangi bileşende girildiği fark etmez
// (ilk tanımlı değer geçerli). Motor→Te, Şanzıman→vites+stall, Transfer→oran+φ.
function _mntGatherTorque(){
  var keys=['Te','Rstall','g1','g2','g3','g4','g5','g6','gR','iTransfer','phiFwd','phiRev','derate'];
  var t={};
  (typeof nodes!=='undefined'?nodes:[]).forEach(function(n){
    if(!(_mntDef(n)||{}).isMountBody) return;
    var d=n.data||{};
    keys.forEach(function(k){ if(t[k]===undefined && d[k]!==undefined && d[k]!==null && d[k]!=='') t[k]=d[k]; });
  });
  return t;
}
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
  return { components:masses, mounts:mounts, torque:_mntGatherTorque() };
}
// Girilen kinematikten tork yük durumlarını (ileri/geri) kur. Eksikse boş döner.
// İleri = 1. vites (en yüksek redüksiyon), geri = Geri vites. T_shaft çekirdeğin
// torqueChain'i ile hesaplanır; Tx = −T_shaft (SPEC T5 işaret düzeni).
function _mntTorqueCases(torque){
  var C=veMountCore; if(!C || !C.torqueChain) return [];
  var tq=torque||{};
  var Te=_mntNum(tq.Te,0), Rstall=_mntNum(tq.Rstall,0), g1=_mntNum(tq.g1,0), gR=_mntNum(tq.gR,0);
  var iTr=_mntNum(tq.iTransfer,1); if(iTr===0) iTr=1;
  var phiF=_mntNum(tq.phiFwd,1); if(phiF===0) phiF=1;
  var phiR=_mntNum(tq.phiRev,1); if(phiR===0) phiR=1;
  var der=_mntNum(tq.derate,1); if(der===0) der=1;
  if(!(Te>0 && Rstall>0 && g1!==0)) return [];
  var cases=[];
  var Tfwd=C.torqueChain({Te:Te, Rstall:Rstall, iGear:g1, iTransfer:iTr, phiAxle:phiF, derate:der});
  cases.push({name:'Forward Torque', n:[0,0,-1], T:[-Tfwd,0,0]});
  if(gR!==0){
    var Trev=C.torqueChain({Te:Te, Rstall:Rstall, iGear:gR, iTransfer:iTr, phiAxle:phiR, derate:der});
    cases.push({name:'Reverse Torque', n:[0,0,-1], T:[-Trev,0,0]});
  }
  return cases;
}
// UI (mm/kg/N/mm) → SI. Yük durumları: 6 otomatik g-durumu + (kinematik
// girildiyse) ileri/geri tork durumları.
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
    loadCases: MNT_AUTO_CASES.concat(_mntTorqueCases(gather.torque))
  };
}

var _veMntLast=null;      // son sonuç (kopyala/CSV/3D için)
function getMntSolverPropertiesHTML(node){
  if(!node.data) node.data={};
  if(!node.data.matrixMode) node.data.matrixMode='delta';
  var html='<div class="sw-panel">';
  html+='<div style="font-size:0.56rem; color:var(--text-muted); line-height:1.4; margin-bottom:9px;">Tüm kütle ve takozlar otomatik algılanır; yük durumları otomatik uygulanır.</div>';
  html+='<div style="display:flex; gap:6px; margin-bottom:10px;">';
  html+='<button onclick="veMntSolverCompute(\''+node.id+'\')" style="flex:1; padding:9px; font-size:0.74rem; font-weight:700; background:var(--accent-primary); color:#fff; border:none; cursor:pointer; border-radius:5px;">▶ Hesapla</button>';
  html+='<button onclick="veMntOpenMathModal()" style="padding:9px 12px; font-size:0.64rem; background:var(--bg-tertiary); color:var(--text-primary); border:1px solid var(--border-color); border-radius:5px; cursor:pointer;" title="Matematik">📐 Matematik</button>';
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
  h+='<div style="display:flex; gap:6px; margin-top:8px;"><button onclick="veMntCopyResults()" style="flex:1; padding:6px; font-size:0.62rem; background:var(--bg-tertiary); color:var(--text-primary); border:1px solid var(--border-color); border-radius:4px; cursor:pointer;">📋 Kopyala</button><button onclick="veMntExportCSV()" style="flex:1; padding:6px; font-size:0.62rem; background:var(--bg-tertiary); color:var(--text-primary); border:1px solid var(--border-color); border-radius:4px; cursor:pointer;">CSV</button></div>';
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

// ─── Matematik ───────────────────────────────────────────────────────────────
function veMntOpenMathModal(){ _mntShowModal('📐 Takoz Modülünün Matematiği', _mntMathHTML()); }
function _mntMathHTML(){
  var eq='background:var(--bg-secondary); border:1px solid var(--border-color); padding:8px 12px; margin:6px 0; font-family:monospace; font-size:0.66rem; white-space:pre-wrap; overflow-x:auto;';
  var st='font-weight:700; color:var(--text-heading); margin:14px 0 4px; font-size:0.82rem;';
  var tx='font-size:0.68rem; line-height:1.55; color:var(--text-secondary); margin:4px 0;';
  var h='<div style="max-width:760px;">';
  h+='<div style="'+st+'">0. Model</div><div style="'+tx+'">Güç grubu tek rijit gövde; şasiye N takoz (üç eksenli lineer yay). 6 SD. Referans: birleşik CG. Yük durumları otomatik (g-tabanlı) ve girilen kinematikten türetilen ileri/geri tork durumları. Lineer model ±10 mm bandında geçerli.</div>';
  h+='<div style="'+st+'">1-3. Kinematik & matrisler</div><div style="'+eq+'">q=[ux,uy,uz,θx,θy,θz] ; d=r_mount−c_G\nδ=u+θ×d=A·q , A=[E3|−skew(d)]\nK=Σ Aᵢᵀ·diag(k)ᵢ·Aᵢ ; M6=blockdiag(m·E3, I_G)\nI_G=Σ[Iⱼ+mⱼ((dⱼ·dⱼ)E3−dⱼdⱼᵀ)]</div>';
  h+='<div style="'+st+'">4. Statik çözüm</div><div style="'+eq+'">F=[m·g·nx, m·g·ny, m·g·nz, Tx,Ty,Tz] (nz yerçekimi DAHİL)\nq=K_stat⁻¹·F ; δᵢ=Aᵢ·q ; fᵢ=kᵢ·δᵢ\nΣfz=−m·g ; çekme: δz>+0.01 mm</div>';
  h+='<div style="'+st+'">4b. Tork zinciri</div><div style="'+eq+'">T_shaft = Te · R_stall · i_gear · i_transfer · φ_axle · derate\nileri: i_gear=1.vites ; geri: i_gear=Geri ; Tx=−T_shaft</div>';
  h+='<div style="'+st+'">5. Modal</div><div style="'+eq+'">(K_dyn−ω²M6)φ=0 → genelleştirilmiş özdeğer\nf_r=√λ_r/2π (6 mod, artan)</div>';
  h+='<div style="'+tx+'; color:var(--text-muted); margin-top:12px; border-top:1px solid var(--border-color); padding-top:8px;">Doğrulama testleri (T1–T8) referans değerlerle eşleşir.</div></div>';
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
    getMntCoordFramePropertiesHTML: getMntCoordFramePropertiesHTML,
    getMnt2DViewPropertiesHTML: getMnt2DViewPropertiesHTML,
    _mnt2DGather: _mnt2DGather,
    _mnt2DViewSVG: _mnt2DViewSVG,
    VE_MOUNT_LIBRARY: VE_MOUNT_LIBRARY,
    veMntGetLibraryMap: veMntGetLibraryMap,
    veMntGetLibraryList: veMntGetLibraryList,
    veMntApplyLib: veMntApplyLib,
    veMntLibAdd: veMntLibAdd,
    veMntLibRemove: veMntLibRemove,
    veMntLibSet: veMntLibSet,
    veMntLibSetBuiltin: veMntLibSetBuiltin,
    veMntLibResetBuiltin: veMntLibResetBuiltin,
    MNT_AUTO_CASES: MNT_AUTO_CASES,
    VE_MNT_STARTER_LAYOUT: VE_MNT_STARTER_LAYOUT,
    _mntExampleReg: _mntExampleReg,
    _mntExampleList: _mntExampleList,
    _mntExampleLayout: _mntExampleLayout,
    _mntExampleDiagramSVG: _mntExampleDiagramSVG,
    _mntExampleBodyType: _mntExampleBodyType,
    _mntExampleValidate: _mntExampleValidate,
    _mntGatherForSolver: _mntGatherForSolver,
    _mntGatherTorque: _mntGatherTorque,
    _mntTorqueCases: _mntTorqueCases,
    _mntToSI: _mntToSI,
    _mntDeflColor: _mntDeflColor,
    _mntForceColor: _mntForceColor
  };
}
