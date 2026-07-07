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
          dx:_mntNum(e.dx), dy:_mntNum(e.dy), dz:_mntNum(e.dz), builtin:false,
          // Opsiyonel nonlineer z-eğrisi (takoz tipinin özelliği) — Takoz'a uygulanınca kopyalanır.
          curveZ:(Array.isArray(e.curveZ)&&e.curveZ.length>=2)?e.curveZ:null };
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

// Otomatik yük durumları — araç yük kitabı g-faktörleri (a_x, a_y, a_z magnitüd;
// yön MFSim konvansiyonuyla işaretlenir: frenleme −x, yanal +y, düşey −z; a_z
// yerçekimi DAHİL toplam düşey g). n vektörü çekirdeğe SI olarak gider; tork
// durumları (Forward/Reverse) ayrıca _mntTorqueCases ile eklenir → 14 senaryo.
//
// g-seviyeleri:
//   • Cornering 0.6g, Brake-in-Turn 0.4g (boyuna+yanal), Max Bump/Pothole 3.5g düşey,
//   • Kerb Strike 1.55g yanal (bordür darbesi); a_y İŞARETİ cornering'in TERSİDİR
//     (Kerb sol = −1.55, cornering sol = +0.6), Max Rebound +1g (droop/ekstansiyon).
// L/R varyantları a_y işaretiyle ayrışır. Büyük sehimli satırlar (Max Bump, Pothole,
// Reverse) ±15 mm metal-metal durdurucuyla klipslenir (solveCaseStop, F4);
// çözücü useStop=true ile çağrılır.
var MNT_AUTO_CASES = [
  { name:'Static',            n:[ 0,    0,   -1  ], T:[0,0,0] }, // 1g düşey
  { name:'Max Bump',          n:[ 0,    0,   -3.5], T:[0,0,0] }, // 3.5g düşey → klips
  { name:'Braking',           n:[-1,    0,   -1  ], T:[0,0,0] }, // 1g boyuna (fren)
  { name:'Acceleration',      n:[ 1,    0,   -1  ], T:[0,0,0] }, // 1g boyuna (hızlanma)
  { name:'Cornering Left',    n:[ 0,    0.6, -1  ], T:[0,0,0] }, // 0.6g yanal (sol)
  { name:'Cornering Right',   n:[ 0,   -0.6, -1  ], T:[0,0,0] }, // 0.6g yanal (sağ)
  { name:'Brake in Turn L',   n:[-0.4,  0.4, -1  ], T:[0,0,0] }, // 0.4g fren+yanal (sol)
  { name:'Brake in Turn R',   n:[-0.4, -0.4, -1  ], T:[0,0,0] }, // 0.4g fren+yanal (sağ)
  { name:'Pothole Braking',   n:[-3,    0,   -3.5], T:[0,0,0] }, // çukur+fren → klips
  { name:'Kerb Strike L',     n:[ 0,   -1.55,-1  ], T:[0,0,0] }, // 1.55g yanal bordür (sol) — işaret cornering'in TERSİ
  { name:'Kerb Strike R',     n:[ 0,    1.55,-1  ], T:[0,0,0] }, // 1.55g yanal bordür (sağ)
  { name:'Max Rebound',       n:[ 0,    0,    1  ], T:[0,0,0] }  // droop / negatif-g (ekstansiyon)
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

// REFERANS yerleşim (yerel px) — güç grubunun düzenli üstten-görünüş şeması ve
// analiz araçlarının konumları. Model açılışında bu yerleşimin TAMAMI artık
// KURULMAZ; yalnız "Başlangıç ve Örnekler" bileşeni gelir (aşağıdaki
// veMntPopulateStarter). Buradaki koordinatlar hâlâ (a) tek bileşenin konumu ve
// (b) "Örneği Aktar" ile kurulan topolojinin görünür alana ortalanması için
// koordinat çerçevesi olarak kullanılır.
var VE_MNT_STARTER_LAYOUT = [
  // ── Üst şerit: analiz araçları (tek sıra, eşit aralık) ──
  { type:'mnt-coordframe',                     lx:40,  ly:20 },
  { type:'mnt-library',                        lx:190, ly:20 },
  { type:'mnt-viewer',                         lx:340, ly:20 },
  { type:'mnt-2dview',                         lx:490, ly:20 },
  { type:'mnt-solver',   name:'Çözücü',         lx:640, ly:20 },
  { type:'mnt-example',                        lx:790, ly:20 },
  { type:'mnt-report',                         lx:940, ly:20 },
  // ── Sağ takozlar (şasi sağ tarafı → şemada üstte) ──
  { type:'mnt-mount',    name:'Sağ Yan Takoz',  lx:300, ly:190 },
  { type:'mnt-mount',    name:'Sağ Arka Takoz', lx:480, ly:190 },
  // ── Güç grubu (gövdeler yatay sıra) ──
  { type:'mnt-mount',    name:'Ön Takoz',       lx:60,  ly:320 },
  { type:'mnt-motor',    name:'Motor',          lx:180, ly:308 },
  { type:'mnt-gearbox',  name:'Şanzıman',       lx:320, ly:320 },
  { type:'mnt-transfer', name:'Transfer Kutusu',lx:445, ly:320 },
  { type:'mnt-shaft',    name:'Şaft',           lx:575, ly:320 },
  // ── Sol takozlar (şasi sol tarafı → şemada altta) ──
  { type:'mnt-mount',    name:'Sol Yan Takoz',  lx:300, ly:450 },
  { type:'mnt-mount',    name:'Sol Arka Takoz', lx:480, ly:450 }
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

// İlk açılışta iç topolojiye YALNIZ "Başlangıç ve Örnekler" (mnt-example)
// bileşeni gelir; kullanıcı örneği bu bileşenin panelinden aktarır. Bileşen,
// referans yerleşimdeki sağ-üst konumuna (aynı taban) yerleştirilir; "Örneği
// Aktar" güç grubunu sol-orta bölgeye (Çözücü sağ-üste) kurduğundan çakışmaz.
function veMntPopulateStarter(){
  if(typeof createNode!=='function') return [];
  var base = (typeof veArrangeModuleBase==='function')
    ? veArrangeModuleBase(VE_MNT_STARTER_LAYOUT.map(function(it){ return {lx:it.lx, ly:it.ly}; }))
    : { x:3000, y:3000 };
  var slot = VE_MNT_STARTER_LAYOUT.find(function(it){ return it.type==='mnt-example'; }) || { lx:790, ly:20 };
  var created=[];
  var before=nodes.length;
  createNode('mnt-example', base.x+slot.lx, base.y+slot.ly);
  if(nodes.length>before){
    var n=nodes[nodes.length-1];
    if(slot.name) _mntSetNodeName(n, slot.name);
    created.push(n);
  }
  if(typeof updateAllConnections==='function') updateAllConnections();
  return created;
}

// Sidebar kapsamını güncelle (takoz iç topolojisi ⇄ ana ekran). Kapsam açık
// alt-sistem stack'lerinden merkezi olarak hesaplanır (bkz. veSyncSidebarScope).
function _veMntSetSidebar(mode){
  if(typeof veSyncSidebarScope==='function'){ veSyncSidebarScope(); return; }
  if(typeof veShowAllSidebarComponents==='function') veShowAllSidebarComponents();
}

// _silent: autosave gibi arka-plan işlemleri köke çöküp (veSaveActiveTabState)
// kullanıcıyı bulunduğu iç topolojiye geri getirirken true geçer; bu görünmez
// geri-girişte toast/animasyon tetiklenmez (breadcrumb ve sidebar yine güncellenir).
function veMntOpenEditor(nodeId, _silent){
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
  if(!_silent && typeof veAnimateCanvasTransition==='function') veAnimateCanvasTransition('enter');
  veMntUpdateBreadcrumb();
  if(!_silent && typeof showToast==='function') showToast('Takoz Çökme-Titreşim — İç Topoloji','info');
}

// _silent: köke çökerken (veMntCollapseToRoot → kaydet/sekme değiştir öncesi) true
// gelir; kullanıcıya görünmeyen bu toplu çıkışta geçiş animasyonu tetiklenmez.
function veMntCloseEditor(_silent){
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
  if(!_silent && typeof veAnimateCanvasTransition==='function') veAnimateCanvasTransition('exit');
  veMntUpdateBreadcrumb();
  if(!_silent && typeof showToast==='function') showToast('Ana topolojiye dönüldü','info');
}

function veMntCollapseToRoot(){
  var guard=0;
  while(veMntStack.length && guard++<32){ veMntCloseEditor(true); }
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
    // Canvas geçiş animasyonu wrapper'a transform uygular; position:fixed breadcrumb
    // transform'lu ata içinde konumunu şaşırır → body altına asılır (görsel aynı).
    document.body.appendChild(el);
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
  html+=_mntMountCurveNote(node);
  html+='</div>';
  return html;
}

// Takoz'a uygulanmış nonlineer z-eğrisi için SALT-OKUNUR bilgi notu. Eğri artık
// "Takoz Özellikleri" (kütüphane) bileşeninde bir takoz TİPİNİN özelliği olarak
// tanımlanır; kütüphaneden uygulandığında node.data.curveZ'e kopyalanır. Burada
// yalnız gösterilir, düzenlenmez (düzenleme kütüphane panelinde).
function _mntMountCurveNote(node){
  var pts = Array.isArray(node.data.curveZ) ? node.data.curveZ : null;
  if(!pts || pts.length<2) return '';
  var inner = '<div style="font-size:0.58rem; color:var(--text-secondary); line-height:1.5;">'
    + 'Bu takoz <b style="color:var(--text-heading);">nonlineer z-eğrisi</b> taşıyor ('+pts.length+' nokta) → çözücü onu Newton ile çözer. '
    + 'Eğri <b>Takoz Özellikleri</b> bileşenindeki takoz tipinden gelir ve oradan düzenlenir.</div>';
  return _mntCard('Düşey Kuvvet–Sehim Eğrisi (z)','nonlineer · kütüphaneden','var(--accent-danger)', inner);
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
  // Nonlineer z-eğrisi kütüphane girdisinin özelliği: uygularken Takoz'a KOPYALA
  // (anlık; gather bu snapshot'ı okur). Lineer girdi uygulanırsa eski eğriyi temizle.
  if(Array.isArray(m.curveZ) && m.curveZ.length>=2){
    node.data.curveZ=m.curveZ.map(function(p){ return [_mntNum(p[0]), _mntNum(p[1])]; });
  } else {
    delete node.data.curveZ;
  }
  if(typeof saveState==='function') saveState();
  if(typeof showNodeProperties==='function') showNodeProperties(node);
}

// (Nonlineer z-eğrisi düzenleme artık Takoz Özellikleri kütüphane panelinde —
//  veMntLibCurve* — takoz TİPİNE bağlı; veMntApplyLib uygulanınca Takoz'a kopyalar.)

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

// componentDefs ikonunun iç SVG içeriğini çıkar (varsa) — nested <svg> ile gömmek için.
function _mntIconInner(type){
  var def=(typeof componentDefs!=='undefined') ? componentDefs[type] : null;
  var svg=def && def.svg;
  if(!svg) return null;
  var m=svg.match(/<svg[^>]*>([\s\S]*)<\/svg>/i);
  return m ? m[1] : null;
}

// Modelden tema-uyumlu şematik topoloji SVG'si üret (örnek kendi görselini
// vermediğinde). Kütle/takoz düğümleri uygulamanın GERÇEK ikonlarıyla
// (componentDefs) çizilir; ikon yoksa (ör. Jest) kutu/daireye düşer. tools[] =
// önizleme süsü (yardımcı araçlar; yükleyici bunları KURMAZ). Yükleyiciyle aynı
// at:[lx,ly] yerleşimini kullanır → görsel ile kurulan kanvas birebir örtüşür.
function _mntExampleDiagramSVG(model, tools){
  if(!model || !model.components || !model.components.length) return '';
  var L=_mntExampleLayout(model), comps=model.components, mounts=model.mounts||[];
  var items=[];
  comps.forEach(function(c,i){ items.push({type:(c.kind||_mntExampleBodyType(c.name)), name:c.name, x:L.bodies[i].lx, y:L.bodies[i].ly, role:'body'}); });
  mounts.forEach(function(m,i){ items.push({type:'mnt-mount', name:m.name, x:L.mnts[i].lx, y:L.mnts[i].ly, role:'mount'}); });
  (tools||[]).forEach(function(t){ if(t && t.at && t.at.length===2) items.push({type:t.type, name:t.name, x:t.at[0], y:t.at[1], role:'tool'}); });
  var CARD=54, IC=40, LBL=15, M=22, xs=[], ys=[];
  items.forEach(function(it){ xs.push(it.x-CARD/2, it.x+CARD/2); ys.push(it.y-CARD/2, it.y+CARD/2+LBL); });
  var minX=Math.round(Math.min.apply(null,xs)-M), maxX=Math.round(Math.max.apply(null,xs)+M);
  var minY=Math.round(Math.min.apply(null,ys)-M), maxY=Math.round(Math.max.apply(null,ys)+M);
  var s='<svg viewBox="'+minX+' '+minY+' '+(maxX-minX)+' '+(maxY-minY)+'" width="100%" preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg" style="display:block;font-family:inherit;">';
  // Takoz → en yakın kütle ince kılavuz çizgisi (arka planda)
  var bodies=items.filter(function(it){ return it.role==='body'; });
  items.filter(function(it){ return it.role==='mount'; }).forEach(function(mo){
    var nb=bodies[0], bd=Infinity;
    bodies.forEach(function(bp){ var dx=bp.x-mo.x, dy=bp.y-mo.y, d=dx*dx+dy*dy; if(d<bd){ bd=d; nb=bp; } });
    if(nb) s+='<line x1="'+mo.x+'" y1="'+mo.y+'" x2="'+nb.x+'" y2="'+nb.y+'" stroke="var(--border-hover)" stroke-width="1.3" stroke-dasharray="3 3" opacity="0.55"/>';
  });
  // Düğümler: kart + gerçek ikon (yoksa yedek) + etiket
  items.forEach(function(it){
    var x0=it.x-CARD/2, y0=it.y-CARD/2, tool=it.role==='tool';
    var stroke=tool?'var(--border-color)':(it.role==='mount'?'var(--accent-success)':'var(--accent-primary)');
    s+='<rect x="'+x0+'" y="'+y0+'" width="'+CARD+'" height="'+CARD+'" rx="9" fill="var(--bg-secondary)" stroke="'+stroke+'" stroke-width="'+(tool?1.2:1.6)+'"'+(tool?' opacity="0.9"':'')+'/>';
    var inner=_mntIconInner(it.type);
    if(inner){
      s+='<svg x="'+(it.x-IC/2)+'" y="'+(it.y-IC/2)+'" width="'+IC+'" height="'+IC+'" viewBox="0 0 100 100">'+inner+'</svg>';
    } else if(it.role==='mount'){
      s+='<circle cx="'+it.x+'" cy="'+it.y+'" r="13" fill="var(--accent-success)" fill-opacity="0.16" stroke="var(--accent-success)" stroke-width="2"/><circle cx="'+it.x+'" cy="'+it.y+'" r="4" fill="var(--accent-success)"/>';
    } else {
      s+='<rect x="'+(it.x-16)+'" y="'+(it.y-9)+'" width="32" height="18" rx="3" fill="var(--bg-tertiary)" stroke="var(--accent-primary)" stroke-width="1.5"/>';
    }
    s+='<text x="'+it.x+'" y="'+(it.y+CARD/2+11)+'" text-anchor="middle" font-size="10.5" fill="'+(tool?'var(--text-muted)':'var(--text-secondary)')+'">'+_mntEsc(it.name)+'</text>';
  });
  s+='</svg>';
  return s;
}

// Örnek görselini panele bas: inline SVG → doğrudan (tema uyumlu); data-URI ya da
// göreli yol → <img>. fallback verilirse ve resim yüklenemezse (dosya henüz
// eklenmemişse) kırık resim yerine yedek şema gösterilir. Boşsa çağıran taraf
// otomatik şemaya düşer.
function _mntExampleImageHTML(image, fallback){
  var s=String(image==null?'':image).trim();
  if(!s) return '';
  if(/^<svg/i.test(s)) return s;
  var fb=fallback||'';
  var onerr=fb?' onerror="this.style.display=\'none\'; if(this.nextElementSibling) this.nextElementSibling.style.display=\'block\';"':'';
  var h='<img src="'+_mntEsc(s)+'" alt="Topoloji şeması" loading="lazy" style="display:block; width:100%; height:auto;"'+onerr+'/>';
  if(fb) h+='<div style="display:none;">'+fb+'</div>';
  return h;
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
  var sel=node.data.exampleKey || (list[0]&&list[0].id) || 'siper';
  var ex=_mntExampleReg(sel);
  var nid=node.id;
  var autoSvg = _mntExampleDiagramSVG(ex.model, ex.tools);
  var diagram = ex.image ? _mntExampleImageHTML(ex.image, autoSvg) : autoSvg;
  var html='<div class="sw-panel">';
  html+='<div style="font-size:0.575rem; font-weight:700; color:var(--text-secondary); letter-spacing:0.04em; text-transform:uppercase; margin-bottom:5px;">Örnek Model</div>';
  html+='<select id="ve-mnt-example-sel" onchange="veMntSetExample(\''+nid+'\',this.value)" style="width:100%; padding:5px 8px; font-size:0.66rem; background:var(--bg-input); color:var(--text-primary); border:1px solid var(--border-color); border-radius:4px; margin-bottom:11px;">';
  list.forEach(function(e){ html+='<option value="'+_mntEsc(e.id)+'"'+(sel===e.id?' selected':'')+'>'+_mntEsc(e.name)+'</option>'; });
  html+='</select>';
  if(diagram){
    html+='<div style="font-size:0.55rem; font-weight:700; color:var(--text-muted); letter-spacing:0.03em; text-transform:uppercase; margin-bottom:5px;">Topoloji</div>';
    // Görsel/şema panele oranla küçültülür (en-boy korunur) ve ortalanır —
    // iç kap genişliği sınırlar, içteki <img>/<svg> %100 ile onu doldurur.
    html+='<div style="width:100%; padding:10px; box-sizing:border-box; border:1px solid var(--border-color); background:var(--bg-primary); border-radius:6px; margin-bottom:12px; overflow:hidden; text-align:center;">'
      +'<div style="display:inline-block; width:70%; max-width:280px; vertical-align:top;">'+diagram+'</div>'
      +'</div>';
  }
  html+=_mntExampleDetailsHTML(ex);
  html+='<button onclick="veMntLoadExample(\''+nid+'\')" style="width:100%; padding:11px 14px; font-size:0.76rem; font-weight:700; background:var(--accent-warning); color:#111; border:none; cursor:pointer; border-radius:5px; letter-spacing:0.02em;" onmouseover="this.style.filter=\'brightness(1.1)\'" onmouseout="this.style.filter=\'none\'">▶ Örneği Aktar</button>';
  html+='<button onclick="veMntExportTopology()" title="Kanvastaki iç topolojiyi JSON dosyası olarak indir — yeni örnek üretmek için" style="width:100%; margin-top:8px; padding:8px 14px; font-size:0.68rem; font-weight:600; background:var(--bg-tertiary); color:var(--text-secondary); border:1px solid var(--border-color); cursor:pointer; border-radius:5px;" onmouseover="this.style.borderColor=\'var(--accent-primary)\'; this.style.color=\'var(--text-primary)\'" onmouseout="this.style.borderColor=\'var(--border-color)\'; this.style.color=\'var(--text-secondary)\'">⬇ İç Topolojiyi JSON Dışa Aktar</button>';
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

// Ayrıştırılmış JSON'u veLoadTabState'in beklediği "state" biçimine getir.
// Kabul edilenler: {format,version,nodes,connections,…} · {state:{…}} · ham state.
function _mntTopoState(j){
  if(!j) return null;
  var s = (j.state && j.state.nodes) ? j.state : (j.nodes ? j : null);
  if(!s || !s.nodes) return null;
  return {
    nodes: s.nodes, connections: s.connections || [],
    compCounter: s.compCounter || 0,
    canvasOffset: s.canvasOffset || { x:3000, y:3000 },
    canvasZoom: s.canvasZoom || 1
  };
}

// Örnek topolojisini çöz: önce build'e gömülü (window.__MNT_TOPOLOGIES), yoksa
// fetch (geliştirme/Pages). Nesne verilirse doğrudan kullanır. cb(state|null).
function _mntResolveTopology(ref, cb){
  if(ref && typeof ref==='object'){ cb(_mntTopoState(ref)); return; }
  var url = String(ref||''); if(!url){ cb(null); return; }
  var emb = (typeof window!=='undefined' && window.__MNT_TOPOLOGIES) ? window.__MNT_TOPOLOGIES[url] : null;
  if(emb){ cb(_mntTopoState(emb)); return; }
  if(typeof fetch==='function'){
    fetch(url).then(function(r){ if(!r.ok) throw new Error('HTTP '+r.status); return r.json(); })
      .then(function(j){ cb(_mntTopoState(j)); })
      .catch(function(){ cb(null); });
  } else { cb(null); }
}

// İç topolojiyi (kanvasın o anki hali) JSON olarak dışa aktar — kullanıcı bununla
// örnek topolojisi üretir. undo/redo/simResults gibi uçucu alanlar hariç tutulur.
function veMntExportTopology(){
  if(typeof veSerializeCurrentState!=='function'){ if(typeof showToast==='function') showToast('Dışa aktarma kullanılamıyor.','warning'); return; }
  if(typeof veFlushOpenPanelData==='function') veFlushOpenPanelData();
  var st = veSerializeCurrentState();
  var out = { format:'mfsim-mount-example', version:1,
    nodes: st.nodes, connections: st.connections,
    compCounter: st.compCounter, canvasOffset: st.canvasOffset, canvasZoom: st.canvasZoom };
  var json = JSON.stringify(out, null, 2);
  if(typeof document==='undefined') return json;
  var blob = new Blob([json], { type:'application/json' });
  if(typeof veShowSaveDialog==='function') veShowSaveDialog('ornek-topoloji.json', blob, 'İç topoloji JSON olarak kaydedildi ('+(st.nodes||[]).length+' düğüm)');
  return json;
}

// Örneği kayıtlı JSON topolojisinden yükle — iç topolojiyi tümüyle değiştirir.
function _mntLoadExampleFromJSON(ref, ex){
  var hasBodies = (typeof nodes!=='undefined') && nodes.some(function(n){ var d=_mntDef(n)||{}; return d.isMountBody||d.isMount; });
  if(hasBodies && typeof confirm==='function'){
    if(!confirm('İç topoloji, seçilen örnekle DEĞİŞTİRİLECEK. Devam edilsin mi?')) return;
  }
  _mntResolveTopology(ref, function(state){
    if(!state || !state.nodes || !state.nodes.length){
      if(typeof showToast==='function') showToast('Örnek topolojisi yüklenemedi.','warning');
      return;
    }
    if(typeof veLoadTabState==='function') veLoadTabState({ state: state });
    // Başka örnek yüklenebilsin diye "Başlangıç ve Örnekler" düğümü yoksa ekle.
    if(typeof nodes!=='undefined' && !nodes.some(function(n){ return (_mntDef(n)||{}).isMountExample; }) && typeof veMntPopulateStarter==='function'){
      veMntPopulateStarter();
    }
    if(typeof saveState==='function') saveState();
    if(typeof updateAllConnections==='function') updateAllConnections();
    if(typeof veMntUpdateBreadcrumb==='function') veMntUpdateBreadcrumb();
    if(typeof showToast==='function') showToast('Örnek yüklendi'+(ex&&ex.vehicle?(' — '+ex.vehicle):'')+' (JSON).','info');
  });
}

// "Örneği Aktar" yönlendiricisi: kayıt girişinde JSON topolojisi (topology) varsa
// ondan yükle; yoksa mevcut programatik model kurucusuna düş.
function veMntLoadExample(nodeId){
  if(typeof veMountCore==='undefined') return;
  var node = (typeof nodes!=='undefined') ? nodes.find(function(n){ return n.id===nodeId; }) : null;
  var key = (node && node.data && node.data.exampleKey)
    || ((veMountCore.getMountExampleList && veMountCore.getMountExampleList()[0]||{}).id) || 'siper';
  var ex = (veMountCore.getMountExample) ? veMountCore.getMountExample(key) : null;
  if(ex && ex.topology){ _mntLoadExampleFromJSON(ex.topology, ex); return; }
  _mntLoadExampleFromModel(nodeId);
}

// ── Otomatik destek bağlantıları (GÖRSEL) ───────────────────────────────────
// "Neyi neyin desteklediğini" gösteren port bağlantılarını + port kenarlarını
// hesaplar. SAF fonksiyon (DOM/nodes/connections'a dokunmaz) → birim test edilir.
// items: [{id, kind, lx, ly}] (lx/ly = kanvas yerleşim konumu). Döner:
//   { links:[{from,to,fromPort,toPort}], ports:{ id:{ portType:{side} } } }
// Kural: her takoz → en yakın gövde/cradle; her cradle → en yakın (cradle olmayan)
// gövde. Çıkış portu hedefe, giriş portu gelen kaynakların ağırlık merkezine
// bakacak şekilde (üst/sağ/alt/sol) yönlendirilir. Çözücüyü ETKİLEMEZ (çözücü
// düğümleri tipe göre toplar; bağlantı zorunlu değildir).
function _mntComputeSupportLinks(items){
  items = items || [];
  var BODY = { 'mnt-motor':1, 'mnt-gearbox':1, 'mnt-shaft':1, 'mnt-transfer':1 };
  var pureBodies = items.filter(function(it){ return BODY[it.kind]; });
  var cradles    = items.filter(function(it){ return it.kind==='mnt-bracket'; });
  var mounts     = items.filter(function(it){ return it.kind==='mnt-mount'; });
  var supportTargets = pureBodies.concat(cradles);
  var byId={}; items.forEach(function(it){ byId[it.id]=it; });

  function nearest(a, pool){
    var best=null, bd=Infinity;
    pool.forEach(function(b){
      if(b.id===a.id) return;
      var dx=b.lx-a.lx, dy=b.ly-a.ly, d=dx*dx+dy*dy;
      if(d<bd){ bd=d; best=b; }
    });
    return best;
  }
  function sideToward(a, b){
    var dx=b.lx-a.lx, dy=b.ly-a.ly;
    if(Math.abs(dx) >= Math.abs(dy)) return dx>=0 ? 'right' : 'left';
    return dy>=0 ? 'bottom' : 'top';
  }

  // 1. Ham linkler: her takoz → en yakın gövde/cradle; her cradle → en yakın gövde.
  var byTarget={};
  function addRaw(src, tgt){ if(src&&tgt) (byTarget[tgt.id]=byTarget[tgt.id]||[]).push(src); }
  mounts.forEach(function(m){ addRaw(m, nearest(m, supportTargets)); });
  cradles.forEach(function(c){ addRaw(c, nearest(c, pureBodies)); });

  // 2. Her hedefte gelenleri AYRI giriş portlarına dağıt; hem kaynağın çıkışını hem
  //    hedefin o portunu KARŞILIKLI birbirine baktır (per-instance portPositions).
  //    Böylece ters yönelimli iki cradle bile doğru çıkar (biri üstten, biri alttan).
  var links=[], ports={};
  function setSide(id, portType, side){ (ports[id]=ports[id]||{})[portType]={ side:side }; }
  var SIDE_ORD = { top:0, right:1, bottom:2, left:3 };
  Object.keys(byTarget).forEach(function(tid){
    var tgt=byId[tid];
    var incs=byTarget[tid].slice();
    var inCount=(tgt.inCount!=null)?tgt.inCount:incs.length;
    // Her geleni gideceği kenara göre etiketle, sonra ÇAPRAZ olmayacak sırada diz:
    // önce kenar (grupla), sonra kenarın perp ekseni boyunca konum (sol/sağ → üstten
    // alta ly; üst/alt → soldan sağa lx). Port index'i bu sırayla artınca, üstteki
    // gelen üstteki porta düşer → çizgiler kesişmez.
    incs.forEach(function(s){ s._side = sideToward(tgt, s); });
    incs.sort(function(a,b){
      if(a._side !== b._side) return (SIDE_ORD[a._side]||0) - (SIDE_ORD[b._side]||0);
      return (a._side==='left'||a._side==='right') ? (a.ly-b.ly) : (a.lx-b.lx);
    });
    incs.forEach(function(src, i){
      var pi=Math.min(i, Math.max(0,inCount-1));         // fazla gelen → son portu paylaşır
      var toPort=(inCount<=1) ? 'input' : ('input-'+pi);
      links.push({ from:src.id, to:tgt.id, fromPort:'output', toPort:toPort });
      setSide(src.id, 'output', sideToward(src, tgt));   // kaynak çıkışı hedefe baksın
      setSide(tgt.id, toPort, src._side);                 // hedef portu kaynağa baksın
    });
  });
  return { links:links, ports:ports };
}

// Örnek yükleyicilerin ortak "bağla + port kenarlarını uygula" adımı. placed =
// oluşturulan gövde/takoz düğümlerinin [{id,kind,lx,ly}] listesi. createConnection
// id'yi Date.now()'la üretir → senkron döngüde çakışabilir, compCounter ile
// benzersizleştir (topology.js:392 / cp-arac-performans.js:106 deseni).
function _mntWireSupportLinks(placed){
  if(typeof createConnection!=='function') return;
  var wiring = _mntComputeSupportLinks(placed);
  Object.keys(wiring.ports).forEach(function(id){
    var n = (typeof nodes!=='undefined') ? nodes.find(function(x){ return x.id===id; }) : null;
    if(!n) return;
    n.data = n.data || {};
    n.data.portPositions = Object.assign(n.data.portPositions || {}, wiring.ports[id]);
  });
  wiring.links.forEach(function(lk){
    var before = connections.length;
    createConnection(lk.from, lk.to, lk.fromPort, lk.toPort);
    if(connections.length>before && typeof compCounter!=='undefined'){
      compCounter++;
      connections[connections.length-1].id = 'conn-' + compCounter;
    }
  });
}

// ── ŞASİ METAFORU (kütle-yay-zemin) ─────────────────────────────────────────
// Takoz topolojisini "titreşim diyagramı" gibi çizer: güç grubu bir ŞASİ ÇERÇEVESİ
// içinde; gövdeler aktarma-hattı omurgasıyla; her takoz karşıya uzanan çizgi yerine
// en yakın çerçeve kenarına KISA BİR YAY + dış tarafta zemin sembolü. updateAllConn.
// sonunda çağrılır (connections.js hook), <g class="ve-mnt-chassis"> ekler; her
// çağrıda yeniden çizilir. Takoz+gövde yoksa no-op → başka modüller etkilenmez.
// NOT: mount düğümleri arası port-port eğrileri updateAllConnections'ta atlanır
// (bu metafor onların yerini alır).
function veMntDecorateConnections(svg){
  if(!svg || typeof document==='undefined' || typeof nodes==='undefined') return;
  var old = svg.querySelector('g.ve-mnt-chassis');
  if(old && old.parentNode) old.parentNode.removeChild(old);
  var mountsN = nodes.filter(function(n){ return (_mntDef(n)||{}).isMount; });
  var bodiesN = nodes.filter(function(n){ return (_mntDef(n)||{}).isMountBody; });
  if(!mountsN.length && !bodiesN.length) return;
  var NS='http://www.w3.org/2000/svg';
  var g = document.createElementNS(NS,'g');
  g.setAttribute('class','ve-mnt-chassis');
  g.style.pointerEvents='none';

  // ── Şasi çerçevesi: gövdelerin (cradle dahil) sınır kutusu + pay ──
  var fr=null;
  if(bodiesN.length){
    var pad=26, x1=1e9,y1=1e9,x2=-1e9,y2=-1e9;
    bodiesN.forEach(function(n){ var w=n.width||50,h=n.height||46;
      x1=Math.min(x1,n.x); y1=Math.min(y1,n.y); x2=Math.max(x2,n.x+w); y2=Math.max(y2,n.y+h); });
    fr={x1:x1-pad, y1:y1-pad, x2:x2+pad, y2:y2+pad};
    var rect=document.createElementNS(NS,'rect');
    rect.setAttribute('x',fr.x1); rect.setAttribute('y',fr.y1);
    rect.setAttribute('width',fr.x2-fr.x1); rect.setAttribute('height',fr.y2-fr.y1);
    rect.setAttribute('rx',16); rect.setAttribute('fill','var(--accent-primary, #3b82f6)');
    rect.setAttribute('fill-opacity','0.045'); rect.setAttribute('stroke','var(--accent-primary, #3b82f6)');
    rect.setAttribute('stroke-width','1.6'); rect.setAttribute('stroke-dasharray','2 6'); rect.setAttribute('opacity','0.7');
    g.appendChild(rect);
    var t=document.createElementNS(NS,'text');
    t.setAttribute('x',fr.x1+11); t.setAttribute('y',fr.y1+16);
    t.setAttribute('fill','var(--accent-primary, #3b82f6)'); t.setAttribute('font-size','10.5');
    t.setAttribute('opacity','0.72'); t.setAttribute('letter-spacing','1.5');
    t.setAttribute('font-family','ui-monospace, monospace'); t.textContent='ŞASİ'; g.appendChild(t);
  }

  // ── Aktarma hattı omurgası: cradle olmayan gövdeler, x sırasına göre merkezden ──
  var spineB = bodiesN.filter(function(n){ return n.type!=='mnt-bracket'; })
    .sort(function(a,b){ return a.x - b.x; });
  for(var i=0;i<spineB.length-1;i++){
    var a=spineB[i], b=spineB[i+1];
    var l=document.createElementNS(NS,'line');
    l.setAttribute('x1',a.x+(a.width||50)/2); l.setAttribute('y1',a.y+(a.height||46)/2);
    l.setAttribute('x2',b.x+(b.width||50)/2); l.setAttribute('y2',b.y+(b.height||46)/2);
    l.setAttribute('stroke','var(--text-secondary, #888)'); l.setAttribute('stroke-width','3');
    l.setAttribute('stroke-linecap','round'); l.setAttribute('opacity','0.7'); g.appendChild(l);
  }

  // ── Takozlar: en yakın çerçeve kenarına kısa yay + dış tarafta zemin ──
  var opp={ left:'right', right:'left', top:'bottom', bottom:'top' };
  mountsN.forEach(function(n){
    var w=n.width||50,h=n.height||46, cx=n.x+w/2, cy=n.y+h/2;
    if(fr){
      // en yakın çerçeve kenarı + o kenar üzerine izdüşüm (köşeye taşmayı kırp)
      var dl=Math.abs(cx-fr.x1),dr=Math.abs(cx-fr.x2),dt=Math.abs(cy-fr.y1),db=Math.abs(cy-fr.y2);
      var mn=Math.min(dl,dr,dt,db), fp;
      if(mn===dt) fp={x:Math.max(fr.x1,Math.min(fr.x2,cx)), y:fr.y1};
      else if(mn===db) fp={x:Math.max(fr.x1,Math.min(fr.x2,cx)), y:fr.y2};
      else if(mn===dl) fp={x:fr.x1, y:Math.max(fr.y1,Math.min(fr.y2,cy))};
      else fp={x:fr.x2, y:Math.max(fr.y1,Math.min(fr.y2,cy))};
      var mp=_mntEdge(n, fp.x, fp.y);
      _mntSpring(g, mp, fp);
      // zemin: yayın TERS yönünde (dışta). İç yön = fp'ye bakan baskın eksen.
      var idx=fp.x-cx, idy=fp.y-cy;
      var inSide=(Math.abs(idx)>=Math.abs(idy)) ? (idx>0?'right':'left') : (idy>0?'bottom':'top');
      _mntChassisGlyph(g, n, opp[inSide]);
    } else {
      _mntChassisGlyph(g, n, 'left');
    }
  });
  svg.appendChild(g);
}

// Düğüm sınır kutusunun (tx,ty)'ye bakan kenar noktası.
function _mntEdge(n, tx, ty){
  var w=n.width||50,h=n.height||46, cx=n.x+w/2, cy=n.y+h/2, dx=tx-cx, dy=ty-cy;
  if(dx===0&&dy===0) return {x:cx,y:cy};
  var s=Math.min((w/2)/Math.abs(dx||1e-9), (h/2)/Math.abs(dy||1e-9));
  return {x:cx+dx*s, y:cy+dy*s};
}

// İki nokta arası KISA YAY (zig-zag) — takoz kenarından şasi çerçevesine.
function _mntSpring(g, a, b){
  var NS='http://www.w3.org/2000/svg';
  var vx=b.x-a.x, vy=b.y-a.y, L=Math.hypot(vx,vy)||1e-6, ux=vx/L, uy=vy/L, px=-uy, py=ux;
  var coils=Math.max(3, Math.min(6, Math.round(L/8))), amp=Math.min(4.5, L*0.16), seg=L/(coils+1);
  var d='M'+a.x+' '+a.y;
  for(var i=1;i<=coils;i++){ var tt=seg*i, sgn=(i%2?1:-1)*amp; d+=' L '+(a.x+ux*tt+px*sgn)+' '+(a.y+uy*tt+py*sgn); }
  d+=' L '+b.x+' '+b.y;
  var p=document.createElementNS(NS,'path');
  p.setAttribute('d',d); p.setAttribute('fill','none');
  p.setAttribute('stroke','var(--accent-success, #22c55e)'); p.setAttribute('stroke-width','2');
  p.setAttribute('stroke-linecap','round'); p.setAttribute('stroke-linejoin','round'); p.setAttribute('opacity','0.95');
  g.appendChild(p);
}

// Tek takoz için dış kenara sabit-mesnet sembolü çiz: takozdan raya kısa bağ +
// ray + dışa dönük tarama çizgileri. side = şasinin bulunduğu kenar.
function _mntChassisGlyph(g, n, side){
  var NS='http://www.w3.org/2000/svg';
  var w=n.width||50, h=n.height||46, gap=9, rail=Math.min(w,h)*0.62, tick=7, N=5;
  var cx=n.x+w/2, cy=n.y+h/2;
  var col='var(--accent-primary, #3b82f6)';
  function ln(x1,y1,x2,y2,wd,op){
    var l=document.createElementNS(NS,'line');
    l.setAttribute('x1',x1); l.setAttribute('y1',y1); l.setAttribute('x2',x2); l.setAttribute('y2',y2);
    l.setAttribute('stroke',col); l.setAttribute('stroke-width',wd); l.setAttribute('stroke-linecap','round');
    if(op!=null) l.setAttribute('opacity',op);
    g.appendChild(l);
  }
  var vertical = (side==='left'||side==='right');
  if(vertical){
    var ax = side==='left' ? n.x-gap : n.x+w+gap;
    var edgeX = side==='left' ? n.x : n.x+w;
    var dir = side==='left' ? -1 : 1;
    ln(edgeX, cy, ax, cy, 2.2, 0.9);                 // takoz → ray
    ln(ax, cy-rail/2, ax, cy+rail/2, 2.4, 1);        // ray
    for(var i=0;i<N;i++){ var yy=cy-rail/2 + i*(rail/(N-1));
      ln(ax, yy, ax+tick*dir, yy-tick, 1.4, 0.7); }  // tarama
  } else {
    var ay = side==='top' ? n.y-gap : n.y+h+gap;
    var edgeY = side==='top' ? n.y : n.y+h;
    var dirY = side==='top' ? -1 : 1;
    ln(cx, edgeY, cx, ay, 2.2, 0.9);
    ln(cx-rail/2, ay, cx+rail/2, ay, 2.4, 1);
    for(var j=0;j<N;j++){ var xx=cx-rail/2 + j*(rail/(N-1));
      ln(xx, ay, xx-tick, ay+tick*dirY, 1.4, 0.7); }
  }
}

// Programatik model kurucusu (kayıt girişinde JSON yoksa): model'den kütle/takoz
// düğümlerini oluşturur.
function _mntLoadExampleFromModel(nodeId){
  if(typeof veMountCore==='undefined' || typeof createNode!=='function') return;
  var node = nodes.find(function(n){ return n.id===nodeId; });
  var key = (node && node.data && node.data.exampleKey) || 'siper';
  // Seçilen örneğin modelini kayıt defterinden çöz (bilinmezse ilk örneğe düşer).
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
  var placed=[];  // otomatik destek bağlantıları için: {id,kind,lx,ly}
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
      placed.push({ id:n.id, kind:kind, lx:pos.lx, ly:pos.ly,
        inCount:(typeof nodePortCount==='function') ? nodePortCount(n,'inputs') : 1 });
    }
  });
  EX.mounts.forEach(function(m){
    var pos=layout[li++]; var before=nodes.length;
    createNode('mnt-mount', base.x+pos.lx, base.y+pos.ly);
    if(nodes.length>before){
      var n=nodes[nodes.length-1];
      n.data=Object.assign(n.data||{}, { x:m.pos[0], y:m.pos[1], z:m.pos[2], kxs:m.kstat[0], kys:m.kstat[1], kzs:m.kstat[2], kxd:m.kdyn[0], kyd:m.kdyn[1], kzd:m.kdyn[2] });
      _mntSetNodeName(n, m.name);
      placed.push({ id:n.id, kind:'mnt-mount', lx:pos.lx, ly:pos.ly });
    }
  });
  // Takoz/cradle destek bağlantılarını (görsel) otomatik kur.
  _mntWireSupportLinks(placed);

  // Çözücü yoksa ekle (starter'daki sağ-üst konuma).
  if(!nodes.some(function(n){ return (_mntDef(n)||{}).isMountSolver; })){
    createNode('mnt-solver', base.x + 640, base.y + 20);
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
    + chip('var(--accent-success)','Takoz') + chip('var(--accent-warning)','Bileşen CG') + chip('var(--accent-danger)','Birleşik CG') + '</div>';
}
function getMntViewerPropertiesHTML(node){
  if(!node.data) node.data={};
  var html='<div class="sw-panel">';
  html+=_mntVwrLegend();
  // Araç çubuğu — görünüm katmanları + sıfırla + tam ekran (Zemin varsayılan gizli)
  html+='<div style="display:flex; align-items:center; gap:5px; flex-wrap:wrap; margin-bottom:7px;">';
  html+=_mntVwrBtn("var v=veMountViewerToggle('grid'); this.style.opacity=v?'1':'0.45';",'Zemin','Zemin ızgarasını gizle/göster', false);
  html+=_mntVwrBtn("var v=veMountViewerToggle('axes'); this.style.opacity=v?'1':'0.45';",'Eksen','Eksenleri gizle/göster');
  html+=_mntVwrBtn("var v=veMountViewerToggle('labels'); this.style.opacity=v?'1':'0.45';",'Etiket','Eksen etiketlerini gizle/göster');
  html+=_mntVwrBtn("veMountViewerReset();",'⟳ Sıfırla','Görünümü sıfırla');
  html+='<span style="flex:1;"></span>';
  html+=_mntVwrBtn("veMntViewerFullscreen();",'⛶ Tam Ekran','Görüntüleyiciyi tam ekran aç');
  html+='</div>';
  html+='<div id="ve-mnt-inline-viewer-wrap" style="width:100%; height:340px; overflow:hidden; border:1px solid var(--border-color); background:var(--bg-primary); position:relative; border-radius:6px;"><canvas id="ve-mnt-inline-viewer-canvas" style="width:100%; height:100%; display:block;"></canvas></div>';
  html+='<div style="font-size:0.5rem; color:var(--text-muted); margin-top:4px;">Sol tık döndür · sağ tık kaydır · tekerlek yakınlaş · fare ile bileşenin üzerine gel → bilgi.</div>';
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
  html+=_mntVwrBtn("var v=veMountViewerToggle('grid'); this.style.opacity=v?'1':'0.45';",'Zemin','Zemin ızgarasını gizle/göster', false);
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
  html+='<div style="display:flex; gap:6px; margin-bottom:7px;">';
  html+='<button onclick="veMnt2DViewRefresh()" style="flex:1; padding:7px; font-size:0.66rem; background:var(--bg-tertiary); color:var(--text-primary); border:1px solid var(--border-color); border-radius:5px; cursor:pointer;">↻ Yenile</button>';
  html+='</div>';
  html+='<div id="ve-mnt-2dview-box" style="width:100%; background:var(--bg-primary); border:1px solid var(--border-color); border-radius:8px; padding:8px; overflow:auto;"></div>';
  html+='</div>';
  return html;
}
function veMnt2DViewRefresh(){
  var box=(typeof document!=='undefined')?document.getElementById('ve-mnt-2dview-box'):null;
  if(!box) return;
  box.innerHTML=_mnt2DViewSVG(_mnt2DGather());
  _mnt2DAttachHover(box);
  _mnt2DAttachZoom(box);
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
// SVG metin/işaret yardımcıları — akademik, tek renkli (tema uyumlu) görünüm.
var _MNT2D_MONO="ui-monospace,'SF Mono',Menlo,Consolas,'Liberation Mono',monospace";
var _MNT2D_SANS="system-ui,-apple-system,'Segoe UI',Roboto,sans-serif";
// İşaret renkleri — bileşen ikonuyla (components.js) tutarlı, tema uyumlu:
// takoz=yeşil, bileşen CG=amber, birleşik CG=kırmızı. Fallback'li accent-* değişkenleri.
var _MNT2D_C_MOUNT='var(--accent-success, #22c55e)';
var _MNT2D_C_COMP ='var(--accent-warning, #f59e0b)';
var _MNT2D_C_CG   ='var(--accent-danger, #ef4444)';
function _mnt2DText(x,y,t,anchor,color,size,bold,family){
  return '<text x="'+_mnt2DR(x)+'" y="'+_mnt2DR(y)+'" text-anchor="'+(anchor||'middle')+'" font-size="'+(size||8)+'"'
    + ' font-family="'+(family||_MNT2D_MONO)+'" fill="'+(color||'var(--text-secondary)')+'"'+(bold?' font-weight="700"':'')+'>'+_mntEsc(t)+'</text>';
}
function _mnt2DR(v){ return Math.round(v*10)/10; }
// "Güzel" eksen adımı (1·2·5 ×10^k) ve o adıma oturan işaret (tick) değerleri —
// ölçek ızgarası + sayısal eksen etiketleri için (mm). target ≈ istenen işaret sayısı.
function _mnt2DNiceStep(range, target){
  var raw=range/Math.max(1,target);
  if(!(raw>0)) return 1;
  var mag=Math.pow(10, Math.floor(Math.log(raw)/Math.LN10)), norm=raw/mag, step;
  if(norm<1.5) step=1; else if(norm<3) step=2; else if(norm<7) step=5; else step=10;
  return step*mag;
}
function _mnt2DNiceTicks(min, max, target){
  if(!(max>min)) return [min||0];
  var step=_mnt2DNiceStep(max-min, target||6), ticks=[];
  for(var v=Math.ceil(min/step)*step; v<=max+step*1e-6; v+=step) ticks.push(Math.round(v*1e6)/1e6);
  return ticks;
}
// Eksen işaret etiketi — tam sayı mm, eksi işareti tipografik "−".
function _mnt2DTick(v){ return Math.round(v).toString().replace('-','−'); }
function _mnt2DArrow(x1,y1,x2,y2,color,hl){
  hl=hl||7; var ang=Math.atan2(y2-y1,x2-x1);
  var ax=x2-hl*Math.cos(ang-0.42), ay=y2-hl*Math.sin(ang-0.42);
  var bx=x2-hl*Math.cos(ang+0.42), by=y2-hl*Math.sin(ang+0.42);
  return '<line x1="'+_mnt2DR(x1)+'" y1="'+_mnt2DR(y1)+'" x2="'+_mnt2DR(x2)+'" y2="'+_mnt2DR(y2)+'" stroke="'+color+'" stroke-width="1.4"/>'
    + '<polygon points="'+_mnt2DR(x2)+','+_mnt2DR(y2)+' '+_mnt2DR(ax)+','+_mnt2DR(ay)+' '+_mnt2DR(bx)+','+_mnt2DR(by)+'" fill="'+color+'"/>';
}
// Birleşik CG işareti — jeodezik istasyon sembolü (ters iki çeyrek dolu daire).
function _mnt2DCGMark(cx,cy,r,color){
  r=r||10; color=color||'var(--text-primary)'; var s='';
  s+='<circle cx="'+_mnt2DR(cx)+'" cy="'+_mnt2DR(cy)+'" r="'+r+'" fill="var(--bg-primary)" stroke="'+color+'" stroke-width="1.6"/>';
  s+='<path d="M'+_mnt2DR(cx)+' '+_mnt2DR(cy)+' L'+_mnt2DR(cx+r)+' '+_mnt2DR(cy)+' A'+r+' '+r+' 0 0 1 '+_mnt2DR(cx)+' '+_mnt2DR(cy+r)+' Z" fill="'+color+'"/>';
  s+='<path d="M'+_mnt2DR(cx)+' '+_mnt2DR(cy)+' L'+_mnt2DR(cx-r)+' '+_mnt2DR(cy)+' A'+r+' '+r+' 0 0 1 '+_mnt2DR(cx)+' '+_mnt2DR(cy-r)+' Z" fill="'+color+'"/>';
  return s;
}
// Takoz işareti — içi boş kare; yandan görünüşte tarama (hatch) ile doldurulur.
// Yalnızca şekilleri döndürür; hover bilgisi grubu saran <g>'de tutulur.
function _mnt2DMountMark(cx,cy,hatch,color){
  var r=8, s='', col=color||'var(--text-secondary)';
  s+='<rect x="'+_mnt2DR(cx-r)+'" y="'+_mnt2DR(cy-r)+'" width="'+(2*r)+'" height="'+(2*r)+'" rx="1.5" fill="var(--bg-primary)" stroke="'+col+'" stroke-width="1.5"/>';
  if(hatch){
    s+='<line x1="'+_mnt2DR(cx-r)+'" y1="'+_mnt2DR(cy+r)+'" x2="'+_mnt2DR(cx+r)+'" y2="'+_mnt2DR(cy-r)+'" stroke="var(--text-muted)" stroke-width="0.8"/>';
    s+='<line x1="'+_mnt2DR(cx-r)+'" y1="'+_mnt2DR(cy)+'" x2="'+_mnt2DR(cx)+'" y2="'+_mnt2DR(cy-r)+'" stroke="var(--text-muted)" stroke-width="0.8"/>';
    s+='<line x1="'+_mnt2DR(cx)+'" y1="'+_mnt2DR(cy+r)+'" x2="'+_mnt2DR(cx+r)+'" y2="'+_mnt2DR(cy)+'" stroke="var(--text-muted)" stroke-width="0.8"/>';
  }
  return s;
}
// Hover bilgisi attribute'u: satırları kaçışla + &#10; ile birleştir (pre-line render).
function _mnt2DInfoAttr(lines){
  return ' data-mnt-info="'+_mntEsc(lines.join('\n')).replace(/\n/g,'&#10;')+'"';
}
// 2D SVG işaretlerine fare-üstü (hover) bilgi kutusu bağla — 3D görüntüleyicideki
// gibi. Container'a olay dinleyici ekler; tek bir yüzen tooltip div'i paylaşılır.
function _mnt2DAttachHover(container){
  if(!container || typeof document==='undefined' || container.__mnt2dHover) return;
  container.__mnt2dHover=true;
  var tip=document.getElementById('ve-mnt-2d-tip');
  if(!tip){ tip=document.createElement('div'); tip.id='ve-mnt-2d-tip';
    tip.style.cssText='position:fixed; z-index:100060; pointer-events:none; display:none; max-width:280px; padding:7px 10px; font-size:0.66rem; line-height:1.5; white-space:pre-line; background:var(--bg-secondary); color:var(--text-primary); border:1px solid var(--border-color); border-radius:7px; box-shadow:0 8px 24px rgba(0,0,0,0.45);';
    document.body.appendChild(tip);
  }
  function info(t){ while(t && t!==container){ if(t.getAttribute){ var v=t.getAttribute('data-mnt-info'); if(v) return v; } t=t.parentNode; } return null; }
  container.addEventListener('mousemove', function(e){
    var v=info(e.target);
    if(v){ tip.textContent=v; tip.style.display='block';
      var x=e.clientX+14, y=e.clientY+16;
      if(x+tip.offsetWidth>window.innerWidth-8) x=e.clientX-tip.offsetWidth-14;
      if(y+tip.offsetHeight>window.innerHeight-8) y=e.clientY-tip.offsetHeight-16;
      tip.style.left=x+'px'; tip.style.top=y+'px';
    } else { tip.style.display='none'; }
  });
  container.addEventListener('mouseleave', function(){ tip.style.display='none'; });
}
// 2D figürleri interaktif yap: her <svg class="ve-mnt2d-fig"> kendi viewBox'ı
// üzerinden BAĞIMSIZ yakınlaştırılır/kaydırılır. Fare tekerleği imleç merkezli
// zoom; sürükleme pan; çift tık başlangıca sıfırlar. Pointer-capture kullanır →
// window dinleyicisi yok, SVG kaldırılınca dinleyiciler de gider (sızıntı yok).
function _mnt2DAttachZoom(container){
  if(!container || typeof document==='undefined') return;
  var figs=container.querySelectorAll('.ve-mnt2d-fig');
  Array.prototype.forEach.call(figs, function(svg){
    if(svg.__mnt2dZoom) return; svg.__mnt2dZoom=true;
    var b=(svg.getAttribute('data-vb')||'').split(/\s+/).map(Number);
    if(b.length!==4 || b.some(function(n){ return !isFinite(n); })) return;
    var baseX=b[0], baseY=b[1], baseW=b[2], baseH=b[3];
    var vb={ x:baseX, y:baseY, w:baseW, h:baseH };
    var minW=baseW*0.16;   // en fazla ~6× yakınlaştır
    function clamp(){
      if(vb.w>baseW) vb.w=baseW; if(vb.h>baseH) vb.h=baseH;
      if(vb.x<baseX) vb.x=baseX;
      if(vb.y<baseY) vb.y=baseY;
      if(vb.x+vb.w>baseX+baseW) vb.x=baseX+baseW-vb.w;
      if(vb.y+vb.h>baseY+baseH) vb.y=baseY+baseH-vb.h;
    }
    function apply(){ svg.setAttribute('viewBox', _mnt2DR(vb.x)+' '+_mnt2DR(vb.y)+' '+_mnt2DR(vb.w)+' '+_mnt2DR(vb.h)); }
    function reset(){ vb.x=baseX; vb.y=baseY; vb.w=baseW; vb.h=baseH; apply(); }
    // İmleç (veya verilmezse figür merkezi) sabit kalacak şekilde f kadar ölçekle.
    function zoomAt(f, clientX, clientY){
      var rect=svg.getBoundingClientRect();
      if(!rect.width || !rect.height) return;
      var ux=(clientX==null)?vb.x+vb.w/2:vb.x+(clientX-rect.left)/rect.width*vb.w;
      var uy=(clientY==null)?vb.y+vb.h/2:vb.y+(clientY-rect.top)/rect.height*vb.h;
      if(vb.w*f<minW) f=minW/vb.w; else if(vb.w*f>baseW) f=baseW/vb.w;
      vb.x=ux-(ux-vb.x)*f; vb.y=uy-(uy-vb.y)*f; vb.w*=f; vb.h*=f;
      clamp(); apply();
    }
    svg.addEventListener('wheel', function(e){
      e.preventDefault();
      zoomAt((e.deltaY<0)?0.85:1/0.85, e.clientX, e.clientY);
    }, { passive:false });
    // Köşe butonları (varsa) — figür merkezli zoom / sıfırla.
    var wrapEl=svg.parentNode;
    var ctl=wrapEl && wrapEl.querySelector ? wrapEl.querySelector('.ve-mnt2d-zoomctl') : null;
    if(ctl){
      ctl.addEventListener('click', function(e){
        var btn=e.target.closest ? e.target.closest('button[data-z]') : null;
        if(!btn) return; e.preventDefault();
        var z=btn.getAttribute('data-z');
        if(z==='in') zoomAt(0.8, null, null);
        else if(z==='out') zoomAt(1.25, null, null);
        else reset();
      });
    }
    var drag=false, lx=0, ly=0;
    svg.addEventListener('pointerdown', function(e){
      if(e.button!==0 && e.pointerType==='mouse') return;
      drag=true; lx=e.clientX; ly=e.clientY;
      try { svg.setPointerCapture(e.pointerId); } catch(err){}
      svg.style.cursor='grabbing'; e.preventDefault();
    });
    svg.addEventListener('pointermove', function(e){
      if(!drag) return;
      var rect=svg.getBoundingClientRect();
      if(!rect.width || !rect.height) return;
      vb.x-=(e.clientX-lx)/rect.width*vb.w;
      vb.y-=(e.clientY-ly)/rect.height*vb.h;
      lx=e.clientX; ly=e.clientY; clamp(); apply();
    });
    function endDrag(e){ if(!drag) return; drag=false; svg.style.cursor='grab';
      try { svg.releasePointerCapture(e.pointerId); } catch(err){} }
    svg.addEventListener('pointerup', endDrag);
    svg.addEventListener('pointercancel', endDrag);
    svg.addEventListener('dblclick', function(e){ e.preventDefault(); reset(); });
  });
}
// Çakışma önleyici etiket yerleştirici: her etiketi işaretinin üst/alt tarafına
// koyar; yatayda üst üste gelenleri kademeler (tier) ve kademe > 0 ise ince kılavuz
// çizgisi çeker; kenara taşanları başa/sona hizalar (kırpılmayı önler).
function _mnt2DLabels(items, leftX, rightX){
  var svg='';
  ['above','below'].forEach(function(sideKey){
    var above=(sideKey==='above');
    var arr=items.filter(function(it){ return it.above===above; });
    arr.sort(function(a,b){ return a.cx-b.cx; });
    var tiers=[];
    arr.forEach(function(it){
      var halfW=Math.max(15, it.text.length*it.size*0.31);
      var anchor='middle', tx=it.cx;
      if(it.cx+halfW>rightX){ anchor='end'; tx=rightX; }
      else if(it.cx-halfW<leftX){ anchor='start'; tx=leftX; }
      it.anchor=anchor; it.tx=tx;
      var xL=(anchor==='end')?tx-2*halfW:(anchor==='start'?tx:tx-halfW);
      var xR=(anchor==='end')?tx:(anchor==='start'?tx+2*halfW:tx+halfW);
      var t=0;
      while(t<14){ var occ=tiers[t]||[];
        var hit=occ.some(function(iv){ return !(xR<iv[0]-4 || xL>iv[1]+4); });
        if(!hit){ (tiers[t]=occ).push([xL,xR]); break; } t++; }
      it.tier=t;
    });
    arr.forEach(function(it){
      var gap=it.mr+7, step=13;
      var ly=above ? (it.cy-gap-it.tier*step) : (it.cy+gap+it.tier*step);
      if(it.tier>0 && it.anchor==='middle'){
        var y0=above?(it.cy-it.mr):(it.cy+it.mr), y1=above?(ly+3):(ly-9);
        svg+='<line x1="'+_mnt2DR(it.cx)+'" y1="'+_mnt2DR(y0)+'" x2="'+_mnt2DR(it.cx)+'" y2="'+_mnt2DR(y1)+'" stroke="var(--border-color)" stroke-width="0.7"/>';
      }
      svg+=_mnt2DText(it.tx, ly, it.text, it.anchor, it.color, it.size, it.bold);
    });
  });
  return svg;
}
// Tek görünüş (üst/yan) çiz — akademik, tek renkli panel: başlık + eksen köşe
// göstergesi + kesikli referans çizgisi + işaretler + kademeli etiketler + alt not.
function _mnt2DFigure(o){
  // o: {ox, boxX,boxY,boxW,boxH, FIG_W, title, plotTop,plotH,plotL,plotR, px,pyFn,
  //     hKey,vKey, mounts,comps,cg, cr, compAbove, refV,refLabel,
  //     axis:{hLabel,vLabel,vDir,note}, compLabelFn, mountLabelFn, cgLabelFn}
  // hKey → yatay eksen koordinatı ('x' üst/yan, 'y' önden); vKey → düşey ('y'/'z').
  var svg='', plotBottom=o.plotTop+o.plotH;
  var hKey=o.hKey||'x';
  function hval(p){ return hKey==='y'?p.y:(hKey==='z'?p.z:p.x); }
  // dış panel
  svg+='<rect x="'+_mnt2DR(o.boxX)+'" y="'+_mnt2DR(o.boxY)+'" width="'+_mnt2DR(o.boxW)+'" height="'+_mnt2DR(o.boxH)+'" rx="9" fill="var(--bg-secondary)" stroke="var(--border-color)" stroke-width="1"/>';
  // ── ÖLÇEK IZGARASI + SAYISAL EKSEN DEĞERLERİ (mm) — işaretlerin ALTINDA ──
  var gl=o.ox+o.plotL, gr=o.ox+o.FIG_W-o.plotR;
  if(o.hMin!=null && o.hMax!=null){
    _mnt2DNiceTicks(o.hMin, o.hMax, 8).forEach(function(tv){
      var gx=o.px(tv); if(gx<gl-0.5 || gx>gr+0.5) return;
      svg+='<line x1="'+_mnt2DR(gx)+'" y1="'+_mnt2DR(o.plotTop)+'" x2="'+_mnt2DR(gx)+'" y2="'+_mnt2DR(plotBottom)+'" stroke="var(--border-color)" stroke-width="0.5" opacity="0.4"/>';
      svg+=_mnt2DText(gx, plotBottom+13, _mnt2DTick(tv), 'middle', 'var(--text-muted)', 8);
    });
  }
  if(o.vMin!=null && o.vMax!=null){
    _mnt2DNiceTicks(o.vMin, o.vMax, 5).forEach(function(tv){
      var gy=o.pyFn(tv); if(gy<o.plotTop-0.5 || gy>plotBottom+0.5) return;
      svg+='<line x1="'+_mnt2DR(gl)+'" y1="'+_mnt2DR(gy)+'" x2="'+_mnt2DR(gr)+'" y2="'+_mnt2DR(gy)+'" stroke="var(--border-color)" stroke-width="0.5" opacity="0.4"/>';
      svg+=_mnt2DText(gl-5, gy+3, _mnt2DTick(tv), 'end', 'var(--text-muted)', 8);
    });
  }
  // başlık
  svg+=_mnt2DText(o.ox+o.plotL-2, o.boxY+21, o.title, 'start', 'var(--text-heading)', 13, true);
  // kesikli referans çizgisi (Y=0 / Z=0)
  var ry=o.pyFn(o.refV);
  svg+='<line x1="'+_mnt2DR(o.ox+o.plotL-10)+'" y1="'+_mnt2DR(ry)+'" x2="'+_mnt2DR(o.ox+o.FIG_W-o.plotR)+'" y2="'+_mnt2DR(ry)+'" stroke="var(--border-color)" stroke-width="1.1" stroke-dasharray="5 4"/>';
  if(o.refLabel) svg+=_mnt2DText(o.ox+o.FIG_W-o.plotR, ry-5, o.refLabel, 'end', 'var(--text-muted)', 10);
  // eksen köşe göstergesi (yatay + düşey eksen)
  var up=(o.axis.vDir==='up'), axx=o.ox+22, axy=(up? o.plotTop+44 : o.plotTop+14);
  svg+=_mnt2DArrow(axx,axy,axx+26,axy,'var(--text-secondary)')+_mnt2DText(axx+30,axy+4,(o.axis.hLabel||'+X'),'start','var(--text-secondary)',10.5,true);
  var vy=(up? axy-28 : axy+28);
  svg+=_mnt2DArrow(axx,axy,axx,vy,'var(--text-secondary)')+_mnt2DText(axx-3,(up?vy-4:vy+12),o.axis.vLabel,'middle','var(--text-secondary)',10.5,true);
  if(o.axis.note) svg+=_mnt2DText(o.ox+o.plotL-30, plotBottom-2, o.axis.note, 'start', 'var(--text-muted)', 8.5);
  var leftX=o.ox+o.plotL, rightX=o.ox+o.FIG_W-o.plotR, items=[];
  // ── İŞARETLER ── (etiketler ayrı geçişte, çakışma önleyici yerleştirilir)
  // takozlar — HER takoz GERÇEK izdüşüm konumunda çizilir (koordinat düzlemine
  // sadık; konum birleştirme yok). Yalnızca ~işaret boyutu kadar BİREBİR üst üste
  // binen işaretler (aynı piksele düşen sol/sağ çiftleri: yandan X–Z ve önden Y–Z
  // görünüşlerinde) görünürlük için hafifçe yatay yelpazelenir. Her takoz tek tek
  // etiketlenir; çakışan etiketler kademelenir.
  var mpts=o.mounts.map(function(m){ var mv=(o.vKey==='y'?m.y:m.z); return {m:m, v:mv, cx:o.px(hval(m)), cy:o.pyFn(mv)}; });
  var COIN=12;   // px — bu yarıçapta üst üste binenler yelpazelenir (konum aldatmacası değil)
  mpts.forEach(function(a,i){ if(a._grp) return; var grp=[a]; a._grp=1;
    mpts.forEach(function(b,j){ if(j<=i || b._grp) return;
      if(Math.abs(a.cx-b.cx)<COIN && Math.abs(a.cy-b.cy)<COIN){ grp.push(b); b._grp=1; } });
    var n=grp.length;
    grp.forEach(function(pt,k){
      var mx=pt.cx+(n>1?(k-(n-1)/2)*19:0), my=pt.cy;
      var info=['Takoz — '+(pt.m.name||'Takoz'), 'Konum  ('+_mnt2DR(pt.m.x)+', '+_mnt2DR(pt.m.y)+', '+_mnt2DR(pt.m.z)+') mm'];
      svg+='<g'+_mnt2DInfoAttr(info)+'>'+_mnt2DMountMark(mx, my, o.vKey==='z', _MNT2D_C_MOUNT)+'</g>';
      items.push({cx:mx, cy:my, mr:9, above:(pt.v>=o.refV), text:o.mountLabelFn(pt.m), color:'var(--text-secondary)', size:9, bold:false});
    });
  });
  // bileşen CG (içi boş daire, kütleye göre boyut)
  o.comps.forEach(function(c){ var cv=(o.vKey==='y'?c.y:c.z), cx=o.px(hval(c)), cy=o.pyFn(cv), r=o.cr(c.mass);
    var info=[c.name||'Bileşen', 'Ağırlık merkezi  ('+_mnt2DR(c.x)+', '+_mnt2DR(c.y)+', '+_mnt2DR(c.z)+') mm'];
    if(c.mass>0) info.push('Kütle  '+c.mass.toFixed(1)+' kg');
    svg+='<g'+_mnt2DInfoAttr(info)+'>';
    svg+='<circle cx="'+_mnt2DR(cx)+'" cy="'+_mnt2DR(cy)+'" r="'+_mnt2DR(r)+'" fill="var(--bg-primary)" stroke="'+_MNT2D_C_COMP+'" stroke-width="1.5"/></g>';
    items.push({cx:cx, cy:cy, mr:r, above:o.compAbove, text:o.compLabelFn(c), color:'var(--text-secondary)', size:9.5, bold:false});
  });
  // birleşik CG (jeodezik sembol)
  if(o.cg){ var gx=o.px(hval(o.cg)), gy=o.pyFn(o.vKey==='y'?o.cg.y:o.cg.z);
    var cgInfo=['Birleşik Ağırlık Merkezi', 'Konum  ('+_mnt2DR(o.cg.x)+', '+_mnt2DR(o.cg.y)+', '+_mnt2DR(o.cg.z)+') mm'];
    if(o.cg.m>0) cgInfo.push('Toplam kütle  '+o.cg.m.toFixed(1)+' kg');
    svg+='<g'+_mnt2DInfoAttr(cgInfo)+'>'+_mnt2DCGMark(gx,gy,10,_MNT2D_C_CG);
    svg+='<circle cx="'+_mnt2DR(gx)+'" cy="'+_mnt2DR(gy)+'" r="12" fill="transparent"/></g>';
    items.push({cx:gx, cy:gy, mr:11, above:o.compAbove, text:o.cgLabelFn(o.cg), color:'var(--text-primary)', size:10.5, bold:true});
  }
  // ── ETİKETLER ── (üst/alt grupla, yatay çakışanları kademele, kenarda hizala)
  svg+=_mnt2DLabels(items, leftX, rightX);
  return svg;
}
function _mnt2DViewSVG(data){
  if(!data.comps.length && !data.mounts.length){
    return '<div style="padding:24px 10px; text-align:center; font-size:0.7rem; color:var(--text-muted);">Görüntülenecek bileşen yok — Motor / Şanzıman / Takoz ekleyip değer girin.</div>';
  }
  // ÜÇ figür ALT ALTA — her biri KENDİ <svg>'sinde (bağımsız yakınlaştır/kaydır).
  // Üstten (X–Y) ve Yandan (X–Z) ortak X yatay ölçeğini paylaşır; Önden (Y–Z)
  // yatayda Y'yi kullanır. Düşey Y/Z ölçekleri bağımsızdır (figür yüksekliğini
  // doldurur). Etiketler sade; ayrıntı (koordinat/kütle) fare-üstü kutusunda.
  var xs=[]; data.mounts.forEach(function(m){xs.push(m.x);}); data.comps.forEach(function(c){xs.push(c.x);}); if(data.cg) xs.push(data.cg.x);
  var minX=Math.min.apply(null,xs), maxX=Math.max.apply(null,xs), xRange=Math.max(maxX-minX,1);
  var ys=[0]; data.mounts.forEach(function(m){ys.push(m.y);}); data.comps.forEach(function(c){ys.push(c.y);}); if(data.cg) ys.push(data.cg.y);
  var minY=Math.min.apply(null,ys), maxY=Math.max.apply(null,ys), yRange=Math.max(maxY-minY,1);
  var zs=[0]; data.mounts.forEach(function(m){zs.push(m.z);}); data.comps.forEach(function(c){zs.push(c.z);}); if(data.cg) zs.push(data.cg.z);
  var minZ=Math.min.apply(null,zs), maxZ=Math.max.apply(null,zs), zRange=Math.max(maxZ-minZ,1);

  // Figür geometrisi — her figür aynı boyut; ayrı SVG viewBox'ta 0'dan başlar.
  var FIG_W=980, plotL=66, plotR=40, usableW=FIG_W-plotL-plotR;
  var headroom=56, plotH=205, vpad=25, capSpace=20, boxY=6;
  var FIG_H=headroom+plotH+capSpace, VB_H=boxY+FIG_H+6, plotTop=boxY+headroom;

  // yatay ölçekler
  var sx=Math.max(0.02, Math.min(1.1, usableW/xRange));   // X (üst + yan ortak)
  var syh=Math.max(0.02, Math.min(1.1, usableW/yRange));  // Y (önden yatay)
  function pxX(x){ return plotL+(x-minX)*sx; }
  function pxY(y){ return plotL+(y-minY)*syh; }
  // düşey ölçekler
  var sy=(plotH-2*vpad)/yRange;                            // Y (üstten düşey)
  var sz=(plotH-2*vpad)/zRange;                            // Z (yan + ön düşey)
  function pyTop(y){ return plotTop+vpad+(maxY-y)*sy; }
  function pyZ(z){ return plotTop+vpad+(maxZ-z)*sz; }

  var ms=data.comps.map(function(c){return c.mass;}).filter(function(m){return m>0;});
  var mMin=ms.length?Math.min.apply(null,ms):0, mMax=ms.length?Math.max.apply(null,ms):1;
  function cr(m){ if(!(m>0)) return 7; var t=(mMax-mMin>1e-9)?(m-mMin)/(mMax-mMin):0.5; return 7+7*Math.sqrt(t); }
  function shortName(n){ n=String(n||''); return n.length>18?n.slice(0,17)+'…':n; }
  function fmt1(v){ return (Math.round(v*10)/10).toString().replace('.',','); }
  function rz(v){ return Math.round(v).toString().replace('-','−'); }
  // Takoz etiketi — gerçek adı (kısaltılmış). Konum birleştirme olmadığından
  // her takoz kendi adıyla, kendi izdüşüm konumunda etiketlenir.
  function mntLabel(m){ return shortName(m.name||'Takoz'); }
  // Her figürü kendi SVG'sine sar (data-vb = başlangıç viewBox'ı, zoom sıfırlama)
  // + köşesine yakınlaştır/uzaklaştır/sıfırla butonları (_mnt2DAttachZoom bağlar).
  function wrap(inner){
    var vb='0 0 '+FIG_W+' '+_mnt2DR(VB_H);
    return '<div class="ve-mnt2d-figwrap">'
      + '<div class="ve-mnt2d-zoomctl">'
      +   '<button type="button" data-z="in" title="Yakınlaştır" aria-label="Yakınlaştır">+</button>'
      +   '<button type="button" data-z="out" title="Uzaklaştır" aria-label="Uzaklaştır">−</button>'
      +   '<button type="button" data-z="reset" title="Sıfırla" aria-label="Sıfırla">⟲</button>'
      + '</div>'
      + '<svg class="ve-mnt2d-fig" viewBox="'+vb+'" data-vb="'+vb+'" preserveAspectRatio="xMidYMid meet"'
      +   ' style="display:block; width:100%; height:auto; touch-action:none; cursor:grab; font-family:'+_MNT2D_MONO+';">'
      + inner + '</svg>'
      + '</div>';
  }
  var common={ ox:0, boxX:8, boxY:boxY, boxW:FIG_W-16, boxH:FIG_H, FIG_W:FIG_W,
    plotTop:plotTop, plotH:plotH, plotL:plotL, plotR:plotR, cr:cr,
    mounts:data.mounts, comps:data.comps, cg:data.cg };
  function fig(extra){ var o={}; var k; for(k in common) o[k]=common[k]; for(k in extra) o[k]=extra[k]; return _mnt2DFigure(o); }

  // ── ÖZET ŞERİDİ + LEJANT (her zaman görünür; hover'a gerek kalmaz) ──
  var totMass=(data.cg&&data.cg.m)?data.cg.m:data.comps.reduce(function(s,c){ return s+(c.mass>0?c.mass:0); },0);
  var summary='<div class="ve-mnt2d-summary">'
    + '<span>Toplam kütle <b>'+fmt1(totMass)+' kg</b></span>'
    + (data.cg?'<span>Birleşik CG <b>('+fmt1(data.cg.x)+' · '+fmt1(data.cg.y)+' · '+fmt1(data.cg.z)+') mm</b></span>':'')
    + '<span>Takoz <b>'+data.mounts.length+'</b></span>'
    + '<span>Bileşen <b>'+data.comps.length+'</b></span>'
    + '</div>';
  function sw(inner){ return '<svg width="16" height="14" viewBox="0 0 16 14" style="vertical-align:-2px;">'+inner+'</svg>'; }
  var legend='<div class="ve-mnt2d-legend">'
    + '<span>'+sw('<rect x="3" y="2.5" width="10" height="9" rx="1.5" fill="none" stroke="'+_MNT2D_C_MOUNT+'" stroke-width="1.6"/>')+' Takoz</span>'
    + '<span>'+sw('<circle cx="8" cy="7" r="5" fill="none" stroke="'+_MNT2D_C_COMP+'" stroke-width="1.6"/>')+' Bileşen CG <i>(kütle ≈ boyut)</i></span>'
    + '<span>'+sw('<circle cx="8" cy="7" r="5" fill="var(--bg-primary)" stroke="'+_MNT2D_C_CG+'" stroke-width="1.6"/><path d="M8 7 L13 7 A5 5 0 0 1 8 12 Z" fill="'+_MNT2D_C_CG+'"/><path d="M8 7 L3 7 A5 5 0 0 1 8 2 Z" fill="'+_MNT2D_C_CG+'"/>')+' Birleşik CG</span>'
    + '</div>';

  var out=summary+legend+'<div class="ve-mnt2d-stack" style="display:flex; flex-direction:column; gap:14px; min-width:480px;">';
  // ── ÜST GÖRÜNÜŞ (X–Y) ──
  out+=wrap(fig({ title:'Üstten Görünüş · X–Y', hKey:'x', vKey:'y', px:pxX, pyFn:pyTop, compAbove:true,
    hMin:minX, hMax:maxX, vMin:minY, vMax:maxY,
    refV:0, refLabel:null, axis:{hLabel:'+X', vLabel:'−Y', vDir:'down', note:'+Y (sağ) yukarı'},
    compLabelFn:function(c){ return shortName(c.name)+' G'; },
    mountLabelFn:mntLabel,
    cgLabelFn:function(cg){ return 'G ('+fmt1(cg.x)+' · '+fmt1(cg.y)+')'; } }));
  // ── YAN GÖRÜNÜŞ (X–Z) ──
  out+=wrap(fig({ title:'Yandan Görünüş · X–Z', hKey:'x', vKey:'z', px:pxX, pyFn:pyZ, compAbove:false,
    hMin:minX, hMax:maxX, vMin:minZ, vMax:maxZ,
    refV:0, refLabel:'Z = 0', axis:{hLabel:'+X', vLabel:'+Z', vDir:'up', note:null},
    compLabelFn:function(c){ return shortName(c.name)+' (z='+rz(c.z)+')'; },
    mountLabelFn:mntLabel,
    cgLabelFn:function(cg){ return 'G (z='+rz(cg.z)+')'; } }));
  // ── ÖNDEN GÖRÜNÜŞ (Y–Z) ──
  out+=wrap(fig({ title:'Önden Görünüş · Y–Z', hKey:'y', vKey:'z', px:pxY, pyFn:pyZ, compAbove:true,
    hMin:minY, hMax:maxY, vMin:minZ, vMax:maxZ,
    refV:0, refLabel:'Z = 0', axis:{hLabel:'+Y', vLabel:'+Z', vDir:'up', note:'+Y (sağ) →'},
    compLabelFn:function(c){ return shortName(c.name)+' G'; },
    mountLabelFn:mntLabel,
    cgLabelFn:function(cg){ return 'G ('+fmt1(cg.y)+' · '+fmt1(cg.z)+')'; } }));
  out+='</div>';
  return out;
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
      html+='<td style="'+_mntMxTd()+' white-space:nowrap;">'
        +'<button onclick="veMntLibCurveToggle(\''+node.id+'\',\''+_mntEsc(e.key)+'\')" title="Nonlineer z-eğrisi" style="background:none; border:1px solid var(--border-color); color:'+((Array.isArray(e.curveZ)&&e.curveZ.length>=2)?'var(--accent-danger)':'var(--text-muted)')+'; cursor:pointer; padding:2px 6px; font-size:0.72rem; line-height:1; margin-right:3px;">∿</button>'
        +'<button onclick="veMntLibRemove(\''+node.id+'\',\''+_mntEsc(e.key)+'\')" title="Bu takozu sil" style="background:none; border:1px solid var(--border-color); color:var(--accent-danger); cursor:pointer; padding:2px 7px; font-size:0.72rem; line-height:1;">✕</button></td>';
      html+='</tr>';
    });
    html+='</tbody></table></div>';
  }
  html+='<button onclick="veMntLibAdd(\''+node.id+'\')" style="width:100%; padding:9px 12px; margin-bottom:14px; font-size:0.7rem; font-weight:700; background:var(--accent-success); color:#fff; border:none; cursor:pointer; letter-spacing:0.02em;" onmouseover="this.style.filter=\'brightness(1.1)\'" onmouseout="this.style.filter=\'none\'">＋ Yeni Takoz Ekle</button>';

  // ── Açık nonlineer eğri editörü (özel girdide ∿ ile açılır) ──
  if(d._curveEditKey){
    var _czEntry=_mntLibCustomEntry(node, d._curveEditKey);
    if(_czEntry) html+=_mntLibCurveEditor(node, _czEntry);
  }

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

// ─── Kütüphane girdisi: nonlineer z-eğrisi (takoz TİPİNİN özelliği) ──────────
// Eğri ÖZEL kütüphane girdisinde (node.data.mounts[i].curveZ = [[δ_mm,f_N],…])
// tutulur; veMntApplyLib ile Takoz'a KOPYALANIR. Gömülü katalog lineer kalır.
// d._curveEditKey: hangi özel girdinin eğri editörü açık (yalnız görsel durum).
function _mntLibCustomEntry(node, key){
  var d=_mntLibEnsure(node);
  return d.mounts.find(function(x){ return x.key===key; }) || null;
}
function veMntLibCurveToggle(nodeId, key){
  var node=nodes.find(function(n){return n.id===nodeId;}); if(!node) return;
  var d=_mntLibEnsure(node);
  d._curveEditKey = (d._curveEditKey===key) ? null : key;
  if(typeof showNodeProperties==='function') showNodeProperties(node);
}
// Etkinleştir: girdinin sz'sinden (statik kz, N/mm) LİNEER başlangıç eğrisi tohumla.
// Başta lineerle aynı sonucu verir; kullanıcı ilerlemeli/asimetrik yaparak ayrıştırır.
function veMntLibCurveEnable(nodeId, key){
  var node=nodes.find(function(n){return n.id===nodeId;}); if(!node) return;
  var e=_mntLibCustomEntry(node, key); if(!e) return;
  var kz=_mntNum(e.sz, 0);   // N/mm
  e.curveZ=[[-15,-15*kz],[-7.5,-7.5*kz],[0,0],[7.5,7.5*kz],[15,15*kz]];
  if(typeof saveState==='function') saveState();
  if(typeof showNodeProperties==='function') showNodeProperties(node);
}
function veMntLibCurveDisable(nodeId, key){
  var node=nodes.find(function(n){return n.id===nodeId;}); if(!node) return;
  var e=_mntLibCustomEntry(node, key); if(e) delete e.curveZ;
  if(typeof saveState==='function') saveState();
  if(typeof showNodeProperties==='function') showNodeProperties(node);
}
// Nokta düzenle — YENİDEN ÇİZME YOK (odak korunur). col: 0=δ[mm], 1=f[N].
function veMntLibCurveSetPoint(nodeId, key, idx, col, val){
  var node=nodes.find(function(n){return n.id===nodeId;}); if(!node) return;
  var e=_mntLibCustomEntry(node, key);
  if(!e || !Array.isArray(e.curveZ) || !e.curveZ[idx]) return;
  e.curveZ[idx][col]=_mntNum(val, 0);
  if(typeof saveState==='function') saveState();
}
function veMntLibCurveAddPoint(nodeId, key){
  var node=nodes.find(function(n){return n.id===nodeId;}); if(!node) return;
  var e=_mntLibCustomEntry(node, key); if(!e || !Array.isArray(e.curveZ)) return;
  var last=e.curveZ[e.curveZ.length-1]||[0,0];
  e.curveZ.push([_mntNum(last[0],0)+5, _mntNum(last[1],0)]);   // son noktanın 5 mm ötesine
  if(typeof saveState==='function') saveState();
  if(typeof showNodeProperties==='function') showNodeProperties(node);
}
function veMntLibCurveRemovePoint(nodeId, key, idx){
  var node=nodes.find(function(n){return n.id===nodeId;}); if(!node) return;
  var e=_mntLibCustomEntry(node, key); if(!e || !Array.isArray(e.curveZ)) return;
  e.curveZ.splice(idx,1);
  if(typeof saveState==='function') saveState();
  if(typeof showNodeProperties==='function') showNodeProperties(node);
}
// Özel girdi için eğri editörü kartı (kütüphane panelinde, özel tablonun altında).
function _mntLibCurveEditor(node, e){
  var pts = Array.isArray(e.curveZ) ? e.curveZ : null;
  var head='<div style="display:flex; justify-content:flex-end; margin-bottom:6px;"><button onclick="veMntLibCurveToggle(\''+node.id+'\',\''+_mntEsc(e.key)+'\')" style="background:none; border:1px solid var(--border-color); color:var(--text-muted); cursor:pointer; padding:2px 8px; font-size:0.6rem; border-radius:4px;">Kapat ✕</button></div>';
  var inner;
  if(!pts || pts.length<2){
    inner = '<div style="font-size:0.56rem; color:var(--text-muted); line-height:1.45; margin-bottom:8px;">'
      + '<b>'+_mntEsc(e.name||'Takoz')+'</b> için düşey (z) kuvvet–sehim eğrisi tanımlarsanız, bu takoz tipi '
      + 'bir Takoz\'a uygulandığında çözücü onu <b>nonlineer</b> (Newton) çözer. Tanımlanmazsa statik kz ile lineer kalır.</div>'
      + '<button onclick="veMntLibCurveEnable(\''+node.id+'\',\''+_mntEsc(e.key)+'\')" style="width:100%; padding:7px; font-size:0.66rem; font-weight:600; background:var(--bg-tertiary); color:var(--text-primary); border:1px solid var(--border-color); border-radius:5px; cursor:pointer;">＋ z-eğrisi ekle (sz\'den lineer tohum)</button>';
  } else {
    inner = '<div style="font-size:0.54rem; color:var(--text-muted); line-height:1.4; margin-bottom:7px;">δ: sehim [mm], f: kuvvet [N] (basma <b>−</b>). Çözücü δ\'ya göre sıralar; monoton eğri önerilir.</div>';
    inner += '<div style="overflow-x:auto;"><table style="width:100%; border-collapse:collapse; font-size:0.6rem; margin-bottom:7px;"><thead><tr>'
      + '<th style="'+_mntMxTh()+'">δ [mm]</th><th style="'+_mntMxTh()+'">f [N]</th><th style="'+_mntMxTh()+'"></th></tr></thead><tbody>';
    pts.forEach(function(p,i){
      inner += '<tr>'
        + '<td style="'+_mntMxTd()+'"><input type="number" value="'+_mntEsc(p[0])+'" step="0.5" onchange="veMntLibCurveSetPoint(\''+node.id+'\',\''+_mntEsc(e.key)+'\','+i+',0,this.value)" style="width:100%; '+_MNT_INP+'"></td>'
        + '<td style="'+_mntMxTd()+'"><input type="number" value="'+_mntEsc(p[1])+'" step="10" onchange="veMntLibCurveSetPoint(\''+node.id+'\',\''+_mntEsc(e.key)+'\','+i+',1,this.value)" style="width:100%; '+_MNT_INP+'"></td>'
        + '<td style="'+_mntMxTd()+'"><button onclick="veMntLibCurveRemovePoint(\''+node.id+'\',\''+_mntEsc(e.key)+'\','+i+')" title="Noktayı sil" style="background:none; border:1px solid var(--border-color); color:var(--accent-danger); cursor:pointer; padding:1px 6px; font-size:0.7rem; line-height:1;">✕</button></td>'
        + '</tr>';
    });
    inner += '</tbody></table></div>';
    inner += '<div style="display:flex; gap:5px;">'
      + '<button onclick="veMntLibCurveAddPoint(\''+node.id+'\',\''+_mntEsc(e.key)+'\')" style="flex:1; padding:6px; font-size:0.62rem; background:var(--bg-tertiary); color:var(--text-primary); border:1px solid var(--border-color); border-radius:4px; cursor:pointer;">＋ nokta</button>'
      + '<button onclick="veMntLibCurveDisable(\''+node.id+'\',\''+_mntEsc(e.key)+'\')" style="flex:1; padding:6px; font-size:0.62rem; background:var(--bg-tertiary); color:var(--text-secondary); border:1px solid var(--border-color); border-radius:4px; cursor:pointer;">Lineere dön</button>'
      + '</div>';
  }
  return _mntCard('Nonlineer z-eğrisi — '+_mntEsc(e.name||'Takoz'),'düşey kuvvet–sehim','var(--accent-danger)', head+inner);
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
      mounts.push({ name:_mntNodeName(n), x:m.x, y:m.y, z:m.z, kxs:m.kxs, kys:m.kys, kzs:m.kzs, kxd:m.kxd, kyd:m.kyd, kzd:m.kzd,
                    curveZ:(Array.isArray(m.curveZ)?m.curveZ:null) });  // opsiyonel nonlineer z-eğrisi
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

// Kriter 3 — HER tanımlı vites için ayrı tork durumu (mount kuvvetleri kontrolü).
// _mntTorqueCases yalnız 1. vitesi (maks tork) ana matrise koyar; bu ise g1..g6 +
// geri için ayrı durumlar döndürür. Kütle/rijitlik sabit, yalnız T_shaft vites
// oranıyla ölçeklenir → yüksek vites daha düşük kuvvet (1. vites bağlayıcıdır).
// Dönüş öğeleri gearLabel/ratio/Tshaft meta verisini taşır (rapor §8.9 tablosu).
function _mntGearTorqueCases(torque){
  var C=veMountCore; if(!C || !C.torqueChain) return [];
  var tq=torque||{};
  var Te=_mntNum(tq.Te,0), Rstall=_mntNum(tq.Rstall,0);
  var iTr=_mntNum(tq.iTransfer,1); if(iTr===0) iTr=1;
  var phiF=_mntNum(tq.phiFwd,1); if(phiF===0) phiF=1;
  var phiR=_mntNum(tq.phiRev,1); if(phiR===0) phiR=1;
  var der=_mntNum(tq.derate,1); if(der===0) der=1;
  if(!(Te>0 && Rstall>0)) return [];
  var out=[];
  ['g1','g2','g3','g4','g5','g6'].forEach(function(k,i){
    var gr=_mntNum(tq[k],0); if(gr===0) return;
    var Ts=C.torqueChain({Te:Te, Rstall:Rstall, iGear:gr, iTransfer:iTr, phiAxle:phiF, derate:der});
    out.push({name:(i+1)+'. Vites', gearLabel:(i+1)+'. Vites', ratio:gr, Tshaft:Ts, n:[0,0,-1], T:[-Ts,0,0]});
  });
  var gR=_mntNum(tq.gR,0);
  if(gR!==0){
    var Tr=C.torqueChain({Te:Te, Rstall:Rstall, iGear:gR, iTransfer:iTr, phiAxle:phiR, derate:der});
    out.push({name:'Geri Vites', gearLabel:'Geri', ratio:gR, Tshaft:Tr, n:[0,0,-1], T:[-Tr,0,0]});
  }
  return out;
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
    mounts: gather.mounts.map(function(m){
      var mnt={
        name:m.name||'takoz', pos:[C.mmToM(_mntNum(m.x)),C.mmToM(_mntNum(m.y)),C.mmToM(_mntNum(m.z))],
        kstat:[C.nPerMmToNPerM(_mntNum(m.kxs)),C.nPerMmToNPerM(_mntNum(m.kys)),C.nPerMmToNPerM(_mntNum(m.kzs))],
        kdyn:[C.nPerMmToNPerM(_mntNum(m.kxd)),C.nPerMmToNPerM(_mntNum(m.kyd)),C.nPerMmToNPerM(_mntNum(m.kzd))] };
      // Opsiyonel nonlineer z-eğrisi (UI: [δ_mm, f_N]) → SI ([δ_m, f_N]). ≥2 nokta gerekli.
      if(Array.isArray(m.curveZ) && m.curveZ.length>=2){
        mnt.curves={ z:m.curveZ.map(function(p){ return [C.mmToM(_mntNum(p[0])), _mntNum(p[1])]; }) };
      }
      return mnt; }),
    loadCases: MNT_AUTO_CASES.concat(_mntTorqueCases(gather.torque))
  };
}

var _veMntLast=null;      // son sonuç (kopyala/CSV/3D için)
function getMntSolverPropertiesHTML(node){
  if(!node.data) node.data={};
  if(!node.data.matrixMode) node.data.matrixMode='delta';
  if(!node.data.solveMode) node.data.solveMode='auto';
  var html='<div class="sw-panel">';
  html+='<div style="font-size:0.56rem; color:var(--text-muted); line-height:1.4; margin-bottom:9px;">Tüm kütle ve takozlar otomatik algılanır; yük durumları otomatik uygulanır.</div>';
  // ── Çözüm Modu: nonlineer eğrilerin kullanılıp kullanılmayacağını AÇIKÇA seç ──
  var _sm=node.data.solveMode||'auto';
  html+='<div style="margin-bottom:10px;">';
  html+='<div style="font-size:0.58rem; font-weight:600; color:var(--text-secondary); margin-bottom:4px;">Çözüm Modu</div>';
  html+='<select onchange="veMntSetSolveMode(\''+node.id+'\',this.value)" style="width:100%; padding:6px 8px; font-size:0.64rem; background:var(--bg-input); color:var(--text-primary); border:1px solid var(--border-color); border-radius:5px;">';
  [['auto','Otomatik — eğri tanımlıysa nonlineer'],
   ['nonlinear','Nonlineer — tanımlı eğrileri kullan (Newton)'],
   ['linear','Lineer — eğrileri yok say (statik rijitlik)']
  ].forEach(function(o){ html+='<option value="'+o[0]+'"'+(_sm===o[0]?' selected':'')+'>'+o[1]+'</option>'; });
  html+='</select>';
  html+='<div style="font-size:0.52rem; color:var(--text-muted); line-height:1.4; margin-top:4px;">Nonlineer eğriler <b>Takoz Özellikleri</b>\'nde tanımlanır. Bu seçim yalnız ▶ Hesapla ile uygulanır.</div>';
  html+='</div>';
  html+='<div style="display:flex; gap:6px; margin-bottom:10px;">';
  html+='<button onclick="veMntSolverCompute(\''+node.id+'\')" style="flex:1; padding:9px; font-size:0.74rem; font-weight:700; background:var(--accent-primary); color:#fff; border:none; cursor:pointer; border-radius:5px;">▶ Hesapla</button>';
  html+='<button onclick="veMntOpenMathModal()" style="padding:9px 12px; font-size:0.64rem; background:var(--bg-tertiary); color:var(--text-primary); border:1px solid var(--border-color); border-radius:5px; cursor:pointer;" title="Matematik">📐 Matematik</button>';
  html+='</div>';
  html+='<div id="ve-mnt-results"></div>';
  html+='</div>';
  return html;
}

// Çözüm modu seç (auto/nonlinear/linear). Yeniden çizme YOK — sonuç korunur;
// seçim bir sonraki ▶ Hesapla'da uygulanır (hesap butona kilitli).
function veMntSetSolveMode(nodeId, val){
  var node=nodes.find(function(n){return n.id===nodeId;}); if(!node) return;
  if(!node.data) node.data={};
  node.data.solveMode=(val==='linear'||val==='nonlinear')?val:'auto';
  if(typeof saveState==='function') saveState();
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
  // ── Çözüm Modu: kullanıcı seçimini uygula ──
  //  linear    → nonlineer eğrileri YOK SAY (SI mount'lardan curves'i sıyır) → saf lineer.
  //  nonlinear → eğrileri kullan (varsa Newton; yoksa lineer + uyarı — solvedNL=false).
  //  auto      → eğri varsa nonlineer, yoksa lineer (varsayılan/geriye uyumlu).
  var mode=(solver.data && solver.data.solveMode) || 'auto';
  var mounts=si.mounts;
  if(mode==='linear'){
    mounts=si.mounts.map(function(m){
      if(!m.curves) return m;
      var c={}; Object.keys(m).forEach(function(k){ if(k!=='curves') c[k]=m[k]; }); return c;
    });
  }
  var solvedNL=(typeof C.anyCurve==='function') && C.anyCurve(mounts);   // fiilen nonlineer çözüldü mü
  var model={ m:mp.m, cg:mp.cg, Kstat:C.buildK(mounts,mp.cg,false), mounts:mounts, g:si.g };
  var allCases=C.solveAllCases(model, si.loadCases, {useStop:true}); // ±15 mm metal-metal durdurucu (F4)
  var M6=C.buildM6(mp.m,mp.I_G), modes;
  if(solvedNL){
    // Nonlineer takoz var → modları STATİK dengedeki (Static durumu) dinamik
    // tanjant rijitlikle çöz (önyüklü çalışma noktası). allCases[0] = Static.
    var qStat=(allCases[0] && allCases[0].res) ? allCases[0].res.q : null;
    modes=C.solveModalAtState(mounts, mp.cg, M6, qStat);
  } else {
    // Lineer (mod seçimi veya eğri yok) → mevcut yol (K_dyn) birebir korunur.
    modes=C.solveModal(C.buildK(mounts,mp.cg,true), M6, mounts, mp.cg);
  }
  // Kriter 3 — her vites için tork durumu (mount kuvvetleri). Kriter 4 — tasarım
  // yük koşulları (maks tork = 1. vites, 3.5g düşey, 1g yanal, 1g boyuna).
  var gearDefs=_mntGearTorqueCases(gather.torque);
  var gearCases=gearDefs.length ? C.solveAllCases(model, gearDefs, {useStop:true}) : [];
  var designDefs=[
    {name:'3.5g Düşey',       n:[ 0,0,-3.5], T:[0,0,0]},
    {name:'1g Yanal',         n:[ 0,1,-1  ], T:[0,0,0]},
    {name:'1g Boyuna (fren)', n:[-1,0,-1  ], T:[0,0,0]}
  ];
  var designCases=C.solveAllCases(model, designDefs, {useStop:true});
  // Nonlineer seçildi ama hiç eğri yok → kullanıcı uyarılır (solvedNL zaten false).
  var nlNoCurve=(mode==='nonlinear' && !solvedNL);
  var R={ mp:mp, allCases:allCases, mounts:mounts, modes:modes, gather:gather,
          gearCases:gearCases, designCases:designCases, g:si.g,
          matrixMode:(solver.data.matrixMode||'delta'), solveMode:mode, solvedNL:solvedNL, nlNoCurve:nlNoCurve,
          solverId:solverId };
  _veMntLast=R;
  return R;
}

// Çözücüyü çalıştır → #ve-mnt-results'a KOMPAKT DURUM bas. Sonucu döner.
// Ayrıntılı sonuç dökümü (çökme matrisi / mod tablosu / CSV) BİLEREK YOK:
// kullanıcı sonuçlara Rapor bileşeninden bakar; panel yalnız "çözüldü mü,
// uyarı var mı" durumunu gösterir (bkz. _mntSolverStatusHTML).
function veMntSolverCompute(solverId){
  var R=_mntComputeResults(solverId);
  var out=document.getElementById('ve-mnt-results'); if(!out) return R;
  if(!R){ out.innerHTML=''; return R; }
  out.innerHTML=_mntSolverStatusHTML(R);
  return R;
}

// Kompakt çözüm durumu — büyük sonuç dökümü değil. Model çözüldüyse özet
// (kütle/CG + kütle/takoz/durum/mod sayıları) + varsa mühendislik notları
// (çekme, durdurucu, ±10 mm aşımı, modal f≈0, yakınsama). Ayrıntı → Rapor.
function _mntSolverStatusHTML(R){
  if(R.error){
    return '<div style="padding:10px 12px; background:rgba(245,158,11,0.12); border:1px solid var(--accent-warning); color:var(--accent-warning); font-size:0.66rem; line-height:1.5;"><b>Çözülemedi — eksik/geçersiz girdi:</b><ul style="margin:6px 0 0 16px; padding:0;">'
      + R.error.map(function(p){return '<li>'+_mntEsc(p)+'</li>';}).join('')
      + '</ul><div style="margin-top:6px; color:var(--text-muted);">İç topolojide Kütle ve Takoz bileşenleri bulunmalı ve geçerli değerler girilmelidir.</div></div>';
  }
  var mp=R.mp, cgmm=mp.cg.map(function(v){return v*1000;});
  var nC=(R.gather && R.gather.components ? R.gather.components.length : 0);
  var nM=(R.mounts||[]).length, nCase=(R.allCases||[]).length, nMode=(R.modes||[]).length;
  // Durum-bazında uyarı toplulaştırması.
  var failed=0, notConv=0, tension=0, clamp=0, overlin=0;
  (R.allCases||[]).forEach(function(rc){
    if(!rc.res){ failed++; return; }
    var ck=rc.res.checks||{};
    if(ck.converged===false || ck.stopConverged===false) notConv++;
    if(ck.tensionCount>0) tension++;
    if(ck.clampCount>0) clamp++;
    if(ck.overLinearCount>0) overlin++;
  });
  var modalWarn=(R.modes||[]).filter(function(m){return m && m.warning;}).length;

  var h='<div style="padding:9px 11px; border:1px solid var(--accent-success); background:rgba(34,197,94,0.10); border-radius:5px;">';
  h+='<div style="display:flex; align-items:baseline; gap:7px; flex-wrap:wrap; font-size:0.72rem; font-weight:700; color:var(--accent-success);"><span>✓ Çözüldü</span>'
    + '<span style="font-weight:400; color:var(--text-muted); font-size:0.58rem;">'+nC+' kütle · '+nM+' takoz · '+nCase+' yük durumu · '+nMode+' mod</span></div>';
  h+='<div style="margin-top:5px; font-size:0.62rem; color:var(--text-secondary); line-height:1.5;">'
    + 'Toplam kütle <b style="color:var(--text-primary);">'+_mntFmt(mp.m,1)+' kg</b> · '
    + 'CG (<b style="color:var(--text-primary);">'+_mntFmt(cgmm[0],0)+', '+_mntFmt(cgmm[1],0)+', '+_mntFmt(cgmm[2],0)+'</b>) mm</div>';
  var modeLbl = R.solveMode==='linear' ? 'Lineer — eğriler yok sayıldı'
    : R.solveMode==='nonlinear' ? (R.solvedNL ? 'Nonlineer (Newton)' : 'Nonlineer seçildi — eğri yok, lineer')
    : (R.solvedNL ? 'Otomatik → Nonlineer (Newton)' : 'Otomatik → Lineer');
  h+='<div style="margin-top:4px; font-size:0.58rem; color:var(--text-muted);">Çözüm modu: <b style="color:'+(R.solvedNL?'var(--accent-danger)':'var(--text-secondary)')+';">'+_mntEsc(modeLbl)+'</b></div>';
  h+='</div>';

  var warns=[];
  if(R.nlNoCurve) warns.push(['ℹ', 'Nonlineer seçildi ama hiç eğri tanımlı değil → lineer çözüldü. Takoz Özellikleri\'nden z-eğrisi ekleyin.', 'var(--accent-warning)']);
  if(failed)    warns.push(['✗', failed+' yük durumu çözülemedi (K tekil)', 'var(--accent-danger)']);
  if(notConv)   warns.push(['⚠', notConv+' durumda çözücü yakınsamadı', 'var(--accent-danger)']);
  if(tension)   warns.push(['⟂', tension+' durumda çekme / lift-off', 'var(--accent-warning)']);
  if(clamp)     warns.push(['▢', clamp+' durumda metal-metal durdurucu', 'var(--accent-warning)']);
  if(overlin)   warns.push(['~', overlin+' durumda ±10 mm lineer bandı aşıldı', 'var(--accent-warning)']);
  if(modalWarn) warns.push(['♪', modalWarn+' modda f≈0 (serbest mod) uyarısı', 'var(--accent-warning)']);
  if(warns.length){
    h+='<div style="margin-top:8px; padding:8px 10px; border:1px solid var(--border-color); background:var(--bg-secondary); border-radius:5px; font-size:0.6rem; line-height:1.65; color:var(--text-secondary);">';
    h+='<div style="font-weight:700; color:var(--text-heading); margin-bottom:2px; font-size:0.62rem;">Notlar</div>';
    warns.forEach(function(w){ h+='<div><span style="display:inline-block; width:14px; color:'+w[2]+';">'+w[0]+'</span>'+_mntEsc(w[1])+'</div>'; });
    h+='</div>';
  }
  h+='<div style="margin-top:8px; font-size:0.58rem; color:var(--text-muted); line-height:1.45;">Ayrıntılı sonuçlar (çökme matrisi, mod şekilleri, kriter değerlendirmesi) için <b>Rapor</b> bileşenini kullanın.</div>';
  return h;
}

// ─── Render yardımcıları ─────────────────────────────────────────────────────
// (Not: çözücü panelindeki büyük sonuç dökümü — δz matrisi, modal tablosu,
//  Kopyala/CSV — kaldırıldı; sonuçlara Rapor bileşeninden bakılır. _mntMxTh/
//  _mntMxTd hâlâ Takoz Özellikleri kütüphane tablolarında kullanılıyor.)
function _mntMxTh(){ return 'padding:3px 5px; border:1px solid var(--border-color); color:var(--text-secondary); font-weight:600; text-align:center;'; }
function _mntMxTd(){ return 'padding:3px 5px; border:1px solid var(--border-color); text-align:center; color:var(--text-primary);'; }

// ─── Matematik ───────────────────────────────────────────────────────────────
function veMntOpenMathModal(){ _mntShowModal('📐 Takoz Modülünün Matematiği', _mntMathHTML()); }
function _mntMathHTML(){
  var eq='background:var(--bg-secondary); border:1px solid var(--border-color); padding:8px 12px; margin:6px 0; font-family:monospace; font-size:0.66rem; white-space:pre-wrap; overflow-x:auto;';
  var st='font-weight:700; color:var(--text-heading); margin:14px 0 4px; font-size:0.82rem;';
  var tx='font-size:0.68rem; line-height:1.55; color:var(--text-secondary); margin:4px 0;';
  var h='<div style="max-width:760px;">';
  h+='<div style="'+st+'">0. Model</div><div style="'+tx+'">Güç grubu tek rijit gövde; şasiye N takoz (üç eksenli lineer yay). 6 SD. Referans: birleşik CG. Yük durumları otomatik (14 senaryo, Adams §6 g-kitabı) ve girilen kinematikten türetilen ileri/geri tork durumları. Elastomer ±10 mm bandında lineerdir; ±15 mm’de metal-metal durdurucu devreye girer (§4c).</div>';
  h+='<div style="'+st+'">1-3. Kinematik & matrisler</div><div style="'+eq+'">q=[ux,uy,uz,θx,θy,θz] ; d=r_mount−c_G\nδ=u+θ×d=A·q , A=[E3|−skew(d′)] , d′=(dx,dy,−dz)\nK=Σ Aᵢᵀ·diag(k)ᵢ·Aᵢ ; M6=blockdiag(m·E3, I_G*)\nI_G=Σ[Iⱼ+mⱼ((dⱼ·dⱼ)E3−dⱼdⱼᵀ)]</div><div style="'+tx+'">Z-ekseni kuplaj konvansiyonu (Adams kalibrasyonu): kaldıraç kolunun düşey bileşeni dz ve buna eşlenik atalet çarpımları Ixz, Iyz (I_G*) kuplaj terimlerine ters işaretle girer. δz bundan etkilenmez.</div>';
  h+='<div style="'+st+'">4. Statik çözüm</div><div style="'+eq+'">F=[m·g·nx, m·g·ny, m·g·nz, Tx,Ty,Tz] (nz yerçekimi DAHİL)\nq=K_stat⁻¹·F ; δᵢ=Aᵢ·q ; fᵢ=kᵢ·δᵢ\nΣfz=−m·g ; çekme: δz>+0.01 mm</div>';
  h+='<div style="'+st+'">4c. Metal-metal durdurucu (±15 mm, parçalı-lineer)</div><div style="'+eq+'">|δz|>15 mm → gap elemanı: k_stop=100·kz devreye girer\nK_eff=K+Σ_temas k_stop·(aᵤᵤ⊗aᵤᵤ) ; aktif-küme iterasyonu\nyük yeniden dağılır; dibe oturan takoz temas kuvvetiyle çalışır</div>';
  h+='<div style="'+st+'">4b. Tork zinciri</div><div style="'+eq+'">T_shaft = Te · R_stall · i_gear · i_transfer · φ_axle · derate\nileri: i_gear=1.vites ; geri: i_gear=Geri ; Tx=−T_shaft</div>';
  h+='<div style="'+st+'">5. Modal</div><div style="'+eq+'">(K_dyn−ω²M6)φ=0 → genelleştirilmiş özdeğer\nf_r=√λ_r/2π (6 mod, artan)</div>';
  h+='<div style="'+st+'">5b. İzolasyon kriterleri (rapor §8.8)</div><div style="'+eq+'">f_ateş=(N/60)·(z/2) (4-zamanlı)\nKriter 1: roll modu (mod 6) < 0.5·f_ateş\nKriter 2: T=√[(1+(2ζr)²)/((1−r²)²+(2ζr)²)] < %50 , r=f_ateş/f_doğal</div>';
  h+='<div style="'+tx+'; color:var(--text-muted); margin-top:12px; border-top:1px solid var(--border-color); padding-top:8px;">Doğrulama testleri (T1–T9, Adams BMC_TTAR_2031) referans değerlerle eşleşir.</div></div>';
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

// ─── Tam ekran overlay (3D / 2D görünümleri büyütmek için) ───────────────────
// Büyük, esnek bir overlay: başlık + kapat (X/Esc) + içerik alanı. onMount(body)
// DOM eklendikten sonra çağrılır; onClose kapanışta.
function _mntFsOverlay(title, innerHTML, onMount, onClose){
  var old=document.getElementById('ve-mnt-fs'); if(old) old.remove();
  var ov=document.createElement('div'); ov.id='ve-mnt-fs';
  ov.style.cssText='position:fixed; inset:0; z-index:100045; background:rgba(0,0,0,0.72); display:flex; align-items:center; justify-content:center; padding:2vh 2vw;';
  var box=document.createElement('div');
  box.style.cssText='width:96vw; height:94vh; max-width:1600px; display:flex; flex-direction:column; background:var(--bg-secondary); border:1px solid var(--border-color); border-radius:10px; box-shadow:0 24px 70px rgba(0,0,0,0.6); overflow:hidden;';
  function close(){ document.removeEventListener('keydown', onKey); try{ if(onClose) onClose(); }catch(e){} ov.remove(); }
  function onKey(e){ if(e.key==='Escape') close(); }
  box.innerHTML='<div style="display:flex; align-items:center; gap:10px; padding:11px 16px; border-bottom:1px solid var(--border-color); background:var(--bg-tertiary); flex-shrink:0;"><span style="font-weight:700; font-size:0.92rem; color:var(--text-heading);">'+title+'</span><div style="flex:1;"></div><button id="ve-mnt-fs-x" title="Kapat (Esc)" style="background:none; border:none; color:var(--text-muted); cursor:pointer; font-size:1.25rem; line-height:1;">✕</button></div>'
    +'<div id="ve-mnt-fs-body" style="flex:1; min-height:0; position:relative; display:flex; flex-direction:column;">'+innerHTML+'</div>';
  ov.appendChild(box); document.body.appendChild(ov);
  ov.addEventListener('mousedown', function(e){ if(e.target===ov) close(); });
  document.getElementById('ve-mnt-fs-x').addEventListener('click', close);
  document.addEventListener('keydown', onKey);
  if(onMount){ try{ onMount(document.getElementById('ve-mnt-fs-body')); }catch(e){} }
}
// 3D Görüntüleyici'yi (model modu) tam ekran aç. Koordinat Düzlemi'nde tam ekran yok.
function veMntViewerFullscreen(){
  var toggles = _mntVwrBtn("var v=veMountViewerToggle('grid'); this.style.opacity=v?'1':'0.45';",'Zemin','Zemin', false)
    + _mntVwrBtn("var v=veMountViewerToggle('axes'); this.style.opacity=v?'1':'0.45';",'Eksen','Eksen')
    + _mntVwrBtn("var v=veMountViewerToggle('labels'); this.style.opacity=v?'1':'0.45';",'Etiket','Etiket');
  var bar='<div style="display:flex; gap:6px; flex-wrap:wrap; align-items:center; padding:8px 14px; flex-shrink:0; border-bottom:1px solid var(--border-color);">'
    + toggles + _mntVwrBtn("veMountViewerReset();",'⟳ Sıfırla','Sıfırla')
    + '<span style="flex:1;"></span><span style="font-size:0.58rem; color:var(--text-muted);">Sol tık döndür · sağ tık kaydır · tekerlek yakınlaş · fare ile bileşen bilgisi</span></div>';
  var wrap='<div style="flex:1; min-height:0; position:relative; background:var(--bg-primary);"><canvas id="ve-mnt-fs-canvas" style="width:100%; height:100%; display:block;"></canvas></div>';
  _mntFsOverlay('3D Görüntüleyici', bar+wrap,
    function(){ if(typeof _mntGatherForSolver==='function') _veMntViewerData=_mntGatherForSolver();
      if(typeof veMountViewerInit==='function'){ try{ veMountViewerInit('ve-mnt-fs-canvas', 'model'); veMountViewerUpdate(); }catch(e){} } },
    function(){ if(typeof veMountViewerDispose==='function'){ try{ veMountViewerDispose(); }catch(e){} }
      veMntViewerRefresh(); }
  );
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
    veMntSetSolveMode: veMntSetSolveMode,
    _mntComputeResults: _mntComputeResults,
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
    veMntLibCurveToggle: veMntLibCurveToggle,
    veMntLibCurveEnable: veMntLibCurveEnable,
    veMntLibCurveDisable: veMntLibCurveDisable,
    veMntLibCurveSetPoint: veMntLibCurveSetPoint,
    veMntLibCurveAddPoint: veMntLibCurveAddPoint,
    veMntLibCurveRemovePoint: veMntLibCurveRemovePoint,
    veMntLibAdd: veMntLibAdd,
    veMntLibRemove: veMntLibRemove,
    veMntLibSet: veMntLibSet,
    veMntLibSetBuiltin: veMntLibSetBuiltin,
    veMntLibResetBuiltin: veMntLibResetBuiltin,
    MNT_AUTO_CASES: MNT_AUTO_CASES,
    VE_MNT_STARTER_LAYOUT: VE_MNT_STARTER_LAYOUT,
    veMntPopulateStarter: veMntPopulateStarter,
    veMntExportTopology: veMntExportTopology,
    veMntDecorateConnections: veMntDecorateConnections,
    _mntWireSupportLinks: _mntWireSupportLinks,
    _mntTopoState: _mntTopoState,
    _mntResolveTopology: _mntResolveTopology,
    _mntLoadExampleFromJSON: _mntLoadExampleFromJSON,
    _mntExampleReg: _mntExampleReg,
    _mntExampleList: _mntExampleList,
    _mntExampleLayout: _mntExampleLayout,
    _mntExampleDiagramSVG: _mntExampleDiagramSVG,
    _mntExampleBodyType: _mntExampleBodyType,
    _mntComputeSupportLinks: _mntComputeSupportLinks,
    _mntExampleValidate: _mntExampleValidate,
    _mntGatherForSolver: _mntGatherForSolver,
    _mntGatherTorque: _mntGatherTorque,
    _mntTorqueCases: _mntTorqueCases,
    _mntGearTorqueCases: _mntGearTorqueCases,
    _mntToSI: _mntToSI,
    _mntDeflColor: _mntDeflColor,
    _mntForceColor: _mntForceColor
  };
}
