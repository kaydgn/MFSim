// ============================================================================
// TAKOZ ÇÖKME-TİTREŞİM — UI KATMANI (özellik paneli + iç içe topoloji editörü)
// ============================================================================
// SPEC "Takoz Çökme–Titreşim Modülü (6 SD Rijit Gövde Modeli)" v1.0.
// Hesap çekirdeği: js/mount-core.js (veMountCore) — DOM'suz saf fonksiyonlar.
//
// MİMARİ (kullanıcı kararı): 'mount-analysis' node'u bir ANA MODÜL'dür. Üstüne
// tıklanınca kendi İÇ İÇE TOPOLOJİSİNE (nested canvas) girilir. Tüm tanımlar
// tek dev tabloda değil, AYRI ALT-BİLEŞEN NODE'LARI üzerinden yapılır:
//   Motor · Şanzıman · Şaft · Braket · (kütleler)  →  core Component
//   Takoz (her biri ayrı node)                       →  core Mount
//   Yük Durumu (her biri ayrı node)                  →  core LoadCase
//   Sistem-Tork (tek node)                           →  tork zinciri
//   Çözücü (tek node)                                → tüm kardeşleri agrege
//                                                       edip analizi çalıştırır
//
// Birim kuralı (SPEC 2): UI mm/kg/N/mm/N·m; çekirdek SI. Dönüşüm yalnız burada.
// Kalıcılık: node.data.mnt.sub içinde (proje kaydet/yükle otomatik).
// ----------------------------------------------------------------------------

// ─── Yardımcılar ─────────────────────────────────────────────────────────────
function _mntNum(v, d){ if(v===undefined||v===null||v==='') return d===undefined?0:d; var x=(typeof v==='string')?v.trim().replace(',', '.'):v; var n=Number(x); return Number.isFinite(n)?n:(d===undefined?0:d); }
function _mntFmt(x, dg){ if(!Number.isFinite(x)) return '—'; dg=(dg===undefined)?3:dg; return x.toFixed(dg); }
function _mntEsc(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function _mntDeflColor(mm){ var a=Math.abs(mm); if(a<0.5) return '#22c55e'; if(a<1.0) return '#84cc16'; if(a<2.0) return '#eab308'; if(a<3.0) return '#f97316'; return '#ef4444'; }
function _mntForceColor(kN){ var a=Math.abs(kN); if(a<5) return '#22c55e'; if(a<10) return '#84cc16'; if(a<20) return '#eab308'; if(a<30) return '#f97316'; return '#ef4444'; }

// ─── Alt-bileşen türleri (KIND meta) ─────────────────────────────────────────
// group: 'component' | 'mount' | 'loadcase' | 'torque' | 'solver'
// ctype: core Component.type (yalnız component grubu)
var MNT_KINDS = {
  motor:        { label:'Motor',       group:'component', ctype:'motor',        color:'#3b82f6' },
  transmission: { label:'Şanzıman',    group:'component', ctype:'transmission', color:'#3b82f6' },
  shaft:        { label:'Şaft',        group:'component', ctype:'shaft',        color:'#64748b' },
  bracket:      { label:'Braket',      group:'component', ctype:'bracket',      color:'#64748b' },
  othermass:    { label:'Diğer Kütle', group:'component', ctype:'other',        color:'#64748b' },
  mount:        { label:'Takoz',       group:'mount',                            color:'#22c55e' },
  loadcase:     { label:'Yük Durumu',  group:'loadcase',                         color:'#f59e0b' },
  torque:       { label:'Sistem-Tork', group:'torque',                           color:'#a855f7', max:1 },
  solver:       { label:'Çözücü',      group:'solver',                           color:'#ef4444', max:1 }
};
var MNT_PALETTE = [
  { title:'Kütleler', kinds:['motor','transmission','shaft','bracket','othermass'] },
  { title:'Bağlantı', kinds:['mount'] },
  { title:'Yükler',   kinds:['loadcase','torque'] },
  { title:'Analiz',   kinds:['solver'] }
];

// A26 gömülü takoz kütüphanesi (SPEC 7.2)
var VE_MOUNT_LIBRARY = {
  'amc55sha':   { name:'AMC 55 ShA',        sx:1252, sy:1252, sz:640,  dx:2055, dy:2055, dz:977 },
  '57RS313773': { name:'ÖN - 57RS313773',   sx:334,  sy:334,  sz:2300, dx:435,  dy:435,  dz:3000 },
  '57RS313774': { name:'ARKA - 57RS313774', sx:1200, sy:1200, sz:2400, dx:950,  dy:950,  dz:1900 }
};

// ─── node.data.mnt durumu ────────────────────────────────────────────────────
function veMountDefaultData(){
  return { g:9.81, counter:0, nodes:[], sel:null, matrixMode:'delta', library:{} };
}
function veMountEnsureData(node){
  if(!node) return null;
  if(!node.data) node.data = {};
  if(!node.data.mnt) node.data.mnt = veMountDefaultData();
  var d = node.data.mnt;
  if(d.g===undefined) d.g = 9.81;
  if(!Array.isArray(d.nodes)) d.nodes = [];
  if(d.counter===undefined) d.counter = d.nodes.length;
  if(!d.matrixMode) d.matrixMode = 'delta';
  if(!d.library) d.library = {};
  return d;
}
function _mntAllLibrary(d){
  var lib={}; Object.keys(VE_MOUNT_LIBRARY).forEach(function(k){ lib[k]=VE_MOUNT_LIBRARY[k]; });
  if(d&&d.library) Object.keys(d.library).forEach(function(k){ lib[k]=d.library[k]; });
  return lib;
}

// Yeni alt-node veri şablonu (kind'e göre, UI birimleri)
function _mntNewNodeData(kind){
  var g = MNT_KINDS[kind].group;
  if(g==='component') return { mass:'', cgx:'', cgy:'', cgz:'', Ixx:'', Iyy:'', Izz:'', Ixy:'', Ixz:'', Iyz:'', pointMass:(kind==='shaft'||kind==='bracket') };
  if(g==='mount') return { x:'', y:'', z:'', kxs:'', kys:'', kzs:'', kxd:'', kyd:'', kzd:'', libKey:'' };
  if(g==='loadcase') return { nx:0, ny:0, nz:-1, Tx:0, Ty:0, Tz:0 };
  if(g==='torque') return { Te:0, Rstall:1, iTransfer:1, iGearFwd:1, iGearRev:-1, splitFront:1, splitRear:1, derate:1 };
  return {}; // solver
}

// ─── Agregasyon: alt-node'lar → çekirdek girdisi (UI şekli), sonra SI ─────────
function _mntAggregate(d){
  var comps=[], mounts=[], loadCases=[], torque=null;
  d.nodes.forEach(function(n){
    var g=MNT_KINDS[n.kind].group, dt=n.data||{};
    if(g==='component') comps.push({ name:n.name, type:MNT_KINDS[n.kind].ctype, mass:dt.mass, cgx:dt.cgx, cgy:dt.cgy, cgz:dt.cgz, Ixx:dt.Ixx, Iyy:dt.Iyy, Izz:dt.Izz, Ixy:dt.Ixy, Ixz:dt.Ixz, Iyz:dt.Iyz, pointMass:!!dt.pointMass });
    else if(g==='mount') mounts.push({ name:n.name, x:dt.x, y:dt.y, z:dt.z, kxs:dt.kxs, kys:dt.kys, kzs:dt.kzs, kxd:dt.kxd, kyd:dt.kyd, kzd:dt.kzd });
    else if(g==='loadcase') loadCases.push({ name:n.name, nx:dt.nx, ny:dt.ny, nz:dt.nz, Tx:dt.Tx, Ty:dt.Ty, Tz:dt.Tz });
    else if(g==='torque') torque=dt;
  });
  return { g:_mntNum(d.g,9.81), components:comps, mounts:mounts, loadCases:loadCases, torque:torque };
}
function _mntToSI(agg){
  var C=veMountCore;
  return {
    g:_mntNum(agg.g,9.81),
    components: agg.components.map(function(c){ return {
      name:c.name||'bileşen', mass:_mntNum(c.mass,0),
      cg:[C.mmToM(_mntNum(c.cgx)), C.mmToM(_mntNum(c.cgy)), C.mmToM(_mntNum(c.cgz))],
      I:[[_mntNum(c.Ixx),_mntNum(c.Ixy),_mntNum(c.Ixz)],[_mntNum(c.Ixy),_mntNum(c.Iyy),_mntNum(c.Iyz)],[_mntNum(c.Ixz),_mntNum(c.Iyz),_mntNum(c.Izz)]],
      pointMass:!!c.pointMass }; }),
    mounts: agg.mounts.map(function(m){ return {
      name:m.name||'takoz', pos:[C.mmToM(_mntNum(m.x)),C.mmToM(_mntNum(m.y)),C.mmToM(_mntNum(m.z))],
      kstat:[C.nPerMmToNPerM(_mntNum(m.kxs)),C.nPerMmToNPerM(_mntNum(m.kys)),C.nPerMmToNPerM(_mntNum(m.kzs))],
      kdyn:[C.nPerMmToNPerM(_mntNum(m.kxd)),C.nPerMmToNPerM(_mntNum(m.kyd)),C.nPerMmToNPerM(_mntNum(m.kzd))] }; }),
    loadCases: agg.loadCases.map(function(lc){ return { name:lc.name||'durum', n:[_mntNum(lc.nx),_mntNum(lc.ny),_mntNum(lc.nz)], T:[_mntNum(lc.Tx),_mntNum(lc.Ty),_mntNum(lc.Tz)] }; })
  };
}

// ════════════════════════════════════════════════════════════════════════════
//  ÖZELLİK PANELİ (side) — özet + "Modülü Aç"
// ════════════════════════════════════════════════════════════════════════════
function getMountAnalysisPropertiesHTML(node){
  var d = veMountEnsureData(node);
  var counts = { component:0, mount:0, loadcase:0, torque:0, solver:0 };
  d.nodes.forEach(function(n){ counts[MNT_KINDS[n.kind].group]++; });
  var html = '<div class="sw-panel">';
  html += '<div style="padding:8px 10px; margin-bottom:10px; font-size:0.62rem; line-height:1.4; color:var(--text-secondary); background:var(--bg-secondary); border:1px solid var(--border-color); border-left:3px solid var(--accent-primary);">'
        + '<b style="color:var(--text-heading);">Takoz Çökme-Titreşim (6 SD).</b> '
        + 'Ana modül — üstüne tıklayınca kendi <b>iç topolojisine</b> girilir. Motor / Şanzıman / Takoz / Yük Durumu / Çözücü alt-bileşenlerini yerleştirip her birini kendi panelinden tanımlarsınız.'
        + '</div>';
  html += '<table style="width:100%; font-size:0.68rem; border-collapse:collapse; border:1px solid var(--border-color); margin-bottom:10px;">';
  html += _mntSummaryRow('Kütle bileşeni', counts.component);
  html += _mntSummaryRow('Takoz', counts.mount);
  html += _mntSummaryRow('Yük durumu', counts.loadcase);
  html += _mntSummaryRow('Çözücü', counts.solver);
  html += '</table>';
  html += '<button onclick="veMountOpenEditor(\'' + node.id + '\')" style="width:100%; padding:14px 16px; font-size:0.82rem; font-weight:700; background:var(--accent-primary); color:#fff; border:none; cursor:pointer; letter-spacing:0.03em;" onmouseover="this.style.filter=\'brightness(1.15)\'" onmouseout="this.style.filter=\'none\'">▶ Takoz Modülünü Aç (İç Topoloji)</button>';
  html += '</div>';
  return html;
}
function _mntSummaryRow(label, val){
  return '<tr style="border-bottom:1px solid var(--border-color);">'
    + '<th style="padding:6px 8px; text-align:left; background:var(--bg-tertiary); border-right:1px solid var(--border-color); width:60%; font-weight:500; color:var(--text-secondary);">'+label+'</th>'
    + '<td style="padding:6px 8px; background:var(--bg-secondary); color:var(--text-primary); font-weight:600; text-align:right;">'+val+'</td></tr>';
}
function onVEMountAnalysisChange(){ /* side panelde girdi yok */ }
function veMountAnalysisCompute(nodeId){ veMountOpenEditor(nodeId); }

// ════════════════════════════════════════════════════════════════════════════
//  İÇ İÇE TOPOLOJİ EDİTÖRÜ
// ════════════════════════════════════════════════════════════════════════════
var _veMountEditorNode = null;
var _veMountEscHandler = null;
var _veMountDrag = null;

function veMountOpenEditor(nodeId){
  var node = nodes.find(function(n){ return n.id===nodeId; });
  if(!node) return;
  var d = veMountEnsureData(node);
  _veMountEditorNode = node;
  // İlk açılışta bir Çözücü node'u tohumla (sonuçların bir evi olsun)
  if(!d.nodes.some(function(n){ return n.kind==='solver'; })){
    _mntAddNode('solver', 640, 300); d.sel = d.nodes[d.nodes.length-1].id;
  }
  if(typeof veTogglePropertiesPanel==='function') veTogglePropertiesPanel(false);

  var overlay = document.createElement('div');
  overlay.id = 've-mount-editor-overlay';
  overlay.style.cssText = 'position:fixed; inset:0; z-index:100000; background:rgba(0,0,0,0.82); display:flex; align-items:center; justify-content:center; padding:14px; backdrop-filter:blur(4px);';
  overlay.addEventListener('mousedown', function(e){ if(e.target===overlay) veMountCloseEditor(); });

  var modal = document.createElement('div');
  modal.id = 've-mount-editor-modal';
  modal.style.cssText = 'width:94%; max-width:1500px; height:90vh; max-height:960px; background:var(--bg-secondary,#0f1218); border:1px solid var(--border-color,#1c2333); display:flex; flex-direction:column; overflow:hidden; box-shadow:0 20px 60px rgba(0,0,0,0.6);';
  modal.innerHTML = _mntHeaderHTML() + _mntBodyHTML();
  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  _veMountEscHandler = function(e){ if(e.key==='Escape'){ var sm=document.getElementById('ve-mount-submodal'); if(sm){ sm.remove(); return; } veMountCloseEditor(); } };
  document.addEventListener('keydown', _veMountEscHandler);

  veMountRenderCanvas();
  veMountRenderInspector();
}
function veMountCloseEditor(){
  if(typeof veMountViewerDispose==='function'){ try{ veMountViewerDispose(); }catch(e){} }
  var ov=document.getElementById('ve-mount-editor-overlay'); if(ov) ov.remove();
  if(_veMountEscHandler){ document.removeEventListener('keydown', _veMountEscHandler); _veMountEscHandler=null; }
  _veMountEditorNode=null; _veMountDrag=null;
  if(typeof saveState==='function') saveState();
}

function _mntHeaderHTML(){
  var b='padding:6px 11px; font-size:0.7rem; font-weight:600; border:1px solid var(--border-color); background:var(--bg-tertiary); color:var(--text-primary); cursor:pointer;';
  return '<div style="display:flex; align-items:center; gap:9px; padding:9px 14px; border-bottom:1px solid var(--border-color); background:var(--bg-tertiary); flex-shrink:0;">'
    + '<span style="font-weight:700; font-size:0.9rem; color:var(--text-heading); display:flex; align-items:center; gap:7px;"><span class="mf-ico mf-ico-sliders"></span>Takoz Çökme-Titreşim — İç Topoloji</span>'
    + '<span style="font-size:0.58rem; color:var(--text-muted);">6 SD · Adams TTAR doğrulamalı</span>'
    + '<div style="flex:1;"></div>'
    + '<button onclick="veMountLoadTTAR()" style="'+b+'" title="Adams TTAR setini node olarak yükle">📥 Örnek (TTAR)</button>'
    + '<button onclick="veMountRunSelfTest()" style="'+b+'" title="T1–T8 kabul testleri">🧪 Self-Test</button>'
    + '<button onclick="veMountOpenMathModal()" style="'+b+'">📐 Matematik</button>'
    + '<button onclick="veMountCloseEditor()" style="'+b+' font-weight:700;" title="Kapat (Esc)">✕</button>'
    + '</div>';
}
function _mntBodyHTML(){
  return '<div style="flex:1; display:flex; flex-direction:row; min-height:0; overflow:hidden;">'
    // palette
    + '<div style="width:160px; flex-shrink:0; overflow-y:auto; padding:10px; border-right:1px solid var(--border-color); background:var(--bg-primary,#0a0d13);">' + _mntPaletteHTML() + '</div>'
    // canvas
    + '<div id="ve-mount-canvas-wrap" style="flex:1; min-width:0; position:relative; overflow:auto; background:var(--bg-primary,#0a0d13); background-image:radial-gradient(circle, rgba(255,255,255,0.04) 1px, transparent 1px); background-size:24px 24px;">'
    +   '<svg id="ve-mount-links" style="position:absolute; top:0; left:0; width:2000px; height:1400px; pointer-events:none;"></svg>'
    +   '<div id="ve-mount-canvas" style="position:relative; width:2000px; height:1400px;"></div>'
    + '</div>'
    // inspector
    + '<div id="ve-mount-inspector" style="width:400px; flex-shrink:0; overflow-y:auto; padding:12px; border-left:1px solid var(--border-color);"></div>'
    + '</div>';
}
function _mntPaletteHTML(){
  var h='<div style="font-size:0.62rem; color:var(--text-muted); margin-bottom:8px; line-height:1.4;">Eklemek için tıkla:</div>';
  MNT_PALETTE.forEach(function(grp){
    h += '<div style="font-size:0.58rem; font-weight:700; color:var(--text-secondary); text-transform:uppercase; letter-spacing:0.04em; margin:10px 0 4px;">'+grp.title+'</div>';
    grp.kinds.forEach(function(k){
      var meta=MNT_KINDS[k];
      h += '<button onclick="veMountPaletteAdd(\''+k+'\')" style="display:flex; align-items:center; gap:7px; width:100%; padding:6px 8px; margin-bottom:4px; font-size:0.66rem; text-align:left; background:var(--bg-tertiary); color:var(--text-primary); border:1px solid var(--border-color); border-left:3px solid '+meta.color+'; cursor:pointer;">'
         + '<span style="width:9px; height:9px; background:'+meta.color+'; flex-shrink:0;"></span>'+meta.label+'</button>';
    });
  });
  return h;
}

// ─── Node ekle/sil ───────────────────────────────────────────────────────────
function _mntAddNode(kind, cx, cy){
  var d=veMountEnsureData(_veMountEditorNode);
  var meta=MNT_KINDS[kind];
  if(meta.max && d.nodes.filter(function(n){return n.kind===kind;}).length>=meta.max){
    if(typeof showToast==='function') showToast(meta.label+' en fazla '+meta.max+' tane olabilir.','warning');
    return null;
  }
  d.counter++;
  var idx = d.nodes.filter(function(n){return MNT_KINDS[n.kind].group===meta.group;}).length + 1;
  var nm = (meta.group==='component'||meta.group==='mount'||meta.group==='loadcase') ? (meta.label+' '+idx) : meta.label;
  var sub = { id:'m'+d.counter, kind:kind, name:nm, cx:cx||120, cy:cy||120, data:_mntNewNodeData(kind) };
  d.nodes.push(sub);
  return sub;
}
function veMountPaletteAdd(kind){
  var d=veMountEnsureData(_veMountEditorNode);
  // Basamaklı yerleştirme
  var n=d.nodes.length;
  var cx = 80 + (n%5)*150, cy = 80 + Math.floor(n/5)*90;
  var sub=_mntAddNode(kind, cx, cy);
  if(sub){ d.sel=sub.id; veMountRenderCanvas(); veMountRenderInspector(); veMountRefreshSolver(); }
}
function veMountDeleteNode(id){
  var d=veMountEnsureData(_veMountEditorNode);
  d.nodes = d.nodes.filter(function(n){ return n.id!==id; });
  if(d.sel===id) d.sel=null;
  veMountRenderCanvas(); veMountRenderInspector(); veMountRefreshSolver();
}

// ─── Canvas render ───────────────────────────────────────────────────────────
function _mntNodeSummary(n){
  var g=MNT_KINDS[n.kind].group, dt=n.data||{};
  if(g==='component') return (_mntNum(dt.mass)? _mntNum(dt.mass)+' kg' : 'kütle —');
  if(g==='mount') return 'z='+(dt.z!==''&&dt.z!==undefined?dt.z:'—');
  if(g==='loadcase') return 'n=('+[dt.nx,dt.ny,dt.nz].join(',')+')';
  if(g==='torque') return 'Te='+(_mntNum(dt.Te)||'—');
  if(g==='solver') return 'analiz';
  return '';
}
function veMountRenderCanvas(){
  var cv=document.getElementById('ve-mount-canvas'); if(!cv) return;
  var d=veMountEnsureData(_veMountEditorNode);
  cv.innerHTML = d.nodes.map(function(n){
    var meta=MNT_KINDS[n.kind];
    var selBorder = (d.sel===n.id) ? '2px solid var(--accent-primary)' : '1px solid var(--border-color)';
    var shadow = (d.sel===n.id) ? 'box-shadow:0 0 0 2px rgba(59,130,246,0.3);' : '';
    return '<div class="ve-mount-subnode" data-id="'+n.id+'" style="position:absolute; left:'+n.cx+'px; top:'+n.cy+'px; width:132px; background:var(--bg-secondary); border:'+selBorder+'; border-left:4px solid '+meta.color+'; '+shadow+' cursor:grab; user-select:none; padding:7px 9px;">'
      + '<div style="display:flex; align-items:center; gap:6px;"><span style="width:8px;height:8px;background:'+meta.color+';flex-shrink:0;"></span>'
      + '<span style="font-size:0.66rem; font-weight:700; color:var(--text-heading); overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">'+_mntEsc(n.name)+'</span></div>'
      + '<div style="font-size:0.55rem; color:var(--text-muted); margin-top:3px;">'+meta.label+' · '+_mntEsc(_mntNodeSummary(n))+'</div>'
      + '</div>';
  }).join('');
  // etkileşim
  [].slice.call(cv.querySelectorAll('.ve-mount-subnode')).forEach(function(el){
    el.addEventListener('mousedown', _mntNodeMouseDown);
  });
  _mntRenderLinks();
}
function _mntRenderLinks(){
  var svg=document.getElementById('ve-mount-links'); if(!svg) return;
  var d=veMountEnsureData(_veMountEditorNode);
  var solver=d.nodes.find(function(n){ return n.kind==='solver'; });
  if(!solver){ svg.innerHTML=''; return; }
  var sx=solver.cx+66, sy=solver.cy+22;
  var lines='';
  d.nodes.forEach(function(n){
    if(n.kind==='solver') return;
    var x=n.cx+66, y=n.cy+22;
    lines += '<line x1="'+x+'" y1="'+y+'" x2="'+sx+'" y2="'+sy+'" stroke="'+MNT_KINDS[n.kind].color+'" stroke-width="1.5" stroke-opacity="0.35" stroke-dasharray="4,4"/>';
  });
  svg.innerHTML=lines;
}
function _mntNodeMouseDown(e){
  var id=this.getAttribute('data-id');
  var d=veMountEnsureData(_veMountEditorNode);
  var sub=d.nodes.find(function(n){return n.id===id;}); if(!sub) return;
  d.sel=id; veMountRenderInspector();
  var wrap=document.getElementById('ve-mount-canvas-wrap');
  var startX=e.clientX, startY=e.clientY, ox=sub.cx, oy=sub.cy, moved=false;
  this.style.cursor='grabbing';
  _veMountDrag={ id:id, el:this };
  function mv(ev){
    var dx=ev.clientX-startX, dy=ev.clientY-startY;
    if(Math.abs(dx)>2||Math.abs(dy)>2) moved=true;
    sub.cx=Math.max(0, ox+dx); sub.cy=Math.max(0, oy+dy);
    if(_veMountDrag&&_veMountDrag.el){ _veMountDrag.el.style.left=sub.cx+'px'; _veMountDrag.el.style.top=sub.cy+'px'; }
    _mntRenderLinks();
  }
  function up(){
    document.removeEventListener('mousemove',mv); document.removeEventListener('mouseup',up);
    if(_veMountDrag&&_veMountDrag.el) _veMountDrag.el.style.cursor='grab';
    _veMountDrag=null;
    if(!moved){ /* sadece seçim */ } veMountRenderCanvas();
  }
  document.addEventListener('mousemove',mv); document.addEventListener('mouseup',up);
  e.preventDefault();
}

// ─── Inspector (seçili node paneli) ──────────────────────────────────────────
function veMountRenderInspector(){
  var ins=document.getElementById('ve-mount-inspector'); if(!ins) return;
  var d=veMountEnsureData(_veMountEditorNode);
  var sub = d.sel ? d.nodes.find(function(n){return n.id===d.sel;}) : null;
  if(!sub){
    ins.innerHTML = '<div style="color:var(--text-muted); font-size:0.72rem; padding:20px 4px; line-height:1.5;">Bir alt-bileşen seç (soldaki palet ile ekle). Her Motor/Şanzıman/Takoz/Yük Durumu kendi node\'u ve panelidir. <b>Çözücü</b> node\'u hepsini okuyup analizi çalıştırır.</div>'
      + '<div style="margin-top:10px; font-size:0.64rem; color:var(--text-secondary);">Global: <label>g [m/s²] <input type="number" value="'+_mntNum(d.g,9.81)+'" step="0.01" onchange="veMountSetG(this.value)" style="width:80px; padding:4px; background:var(--bg-input); color:var(--text-primary); border:1px solid var(--border-color); text-align:right;"></label></div>';
    return;
  }
  var meta=MNT_KINDS[sub.kind];
  var h='<div style="display:flex; align-items:center; gap:8px; margin-bottom:10px; padding-bottom:8px; border-bottom:1px solid var(--border-color);">'
    + '<span style="width:12px;height:12px;background:'+meta.color+';"></span>'
    + '<input value="'+_mntEsc(sub.name)+'" onchange="veMountSetName(\''+sub.id+'\',this.value)" style="flex:1; padding:5px 7px; font-size:0.8rem; font-weight:700; background:var(--bg-input); color:var(--text-heading); border:1px solid var(--border-color);">'
    + '<button onclick="veMountDeleteNode(\''+sub.id+'\')" title="Sil" style="background:none; border:1px solid var(--border-color); color:var(--accent-danger); cursor:pointer; padding:4px 8px; font-size:0.7rem;">🗑</button>'
    + '</div>';
  var g=meta.group;
  if(g==='component') h+=_mntFormComponent(sub);
  else if(g==='mount') h+=_mntFormMount(sub, d);
  else if(g==='loadcase') h+=_mntFormLoadCase(sub);
  else if(g==='torque') h+=_mntFormTorque(sub);
  else if(g==='solver') h+=_mntFormSolver();
  ins.innerHTML=h;
  if(g==='solver'){ veMountRefreshSolver(); }
}
function _mntField(sub, key, label, sub2, step){
  var v=(sub.data[key]===undefined||sub.data[key]===null)?'':sub.data[key];
  return '<tr style="border-bottom:1px solid var(--border-color);">'
    + '<th style="padding:5px 7px; text-align:left; background:var(--bg-tertiary); border:1px solid var(--border-color); font-weight:500; color:var(--text-secondary); width:55%;">'+label+(sub2?' <span style="color:var(--text-muted); font-weight:400;">'+sub2+'</span>':'')+'</th>'
    + '<td style="padding:3px 5px; border:1px solid var(--border-color);"><input type="number" value="'+v+'" step="'+(step||'any')+'" onchange="veMountSetField(\''+sub.id+'\',\''+key+'\',this.value)" style="width:100%; padding:4px; font-size:0.66rem; background:var(--bg-input); color:var(--text-primary); border:1px solid var(--border-color); text-align:right;"></td></tr>';
}
function _mntFormComponent(sub){
  var h='<div style="font-size:0.58rem; color:var(--text-muted); margin-bottom:6px; line-height:1.4;">Kütle bileşeni → çekirdek Component. Atalet <b>tensör bileşeni</b> (CATIA Measure Inertia). Nokta kütle: atalet 0.</div>';
  h+='<table style="width:100%; border-collapse:collapse; font-size:0.66rem;">';
  h+=_mntField(sub,'mass','Kütle','m [kg]','1');
  h+=_mntField(sub,'cgx','CG x','[mm]','1');
  h+=_mntField(sub,'cgy','CG y','[mm]','1');
  h+=_mntField(sub,'cgz','CG z','[mm]','1');
  h+='<tr><td colspan="2" style="padding:4px 0;"><label style="font-size:0.64rem; color:var(--text-secondary); display:flex; align-items:center; gap:6px;"><input type="checkbox" '+(sub.data.pointMass?'checked':'')+' onchange="veMountSetField(\''+sub.id+'\',\'pointMass\',this.checked)"> Nokta kütle (atalet = 0)</label></td></tr>';
  if(!sub.data.pointMass){
    h+=_mntField(sub,'Ixx','Ixx','[kg·m²]','0.001');
    h+=_mntField(sub,'Iyy','Iyy','[kg·m²]','0.001');
    h+=_mntField(sub,'Izz','Izz','[kg·m²]','0.001');
    h+=_mntField(sub,'Ixy','Ixy','[kg·m²]','0.001');
    h+=_mntField(sub,'Ixz','Ixz','[kg·m²]','0.001');
    h+=_mntField(sub,'Iyz','Iyz','[kg·m²]','0.001');
  }
  h+='</table>';
  return h;
}
function _mntFormMount(sub, d){
  var lib=_mntAllLibrary(d);
  var h='<div style="margin-bottom:8px;">';
  h+='<select onchange="veMountApplyLib(\''+sub.id+'\',this.value)" style="width:100%; padding:5px; font-size:0.64rem; background:var(--bg-input); color:var(--text-primary); border:1px solid var(--border-color);">';
  h+='<option value="">— Kütüphaneden rijitlik yükle —</option>';
  Object.keys(lib).forEach(function(k){ h+='<option value="'+k+'">'+_mntEsc(lib[k].name)+'</option>'; });
  h+='</select></div>';
  h+='<table style="width:100%; border-collapse:collapse; font-size:0.66rem;">';
  h+=_mntField(sub,'x','Konum x','[mm]','1');
  h+=_mntField(sub,'y','Konum y','[mm]','1');
  h+=_mntField(sub,'z','Konum z','[mm]','1');
  h+='<tr><td colspan="2" style="padding:5px 0 2px; font-size:0.58rem; font-weight:700; color:var(--text-secondary);">Statik Rijitlik [N/mm]</td></tr>';
  h+=_mntField(sub,'kxs','kx (statik)','','1');
  h+=_mntField(sub,'kys','ky (statik)','','1');
  h+=_mntField(sub,'kzs','kz (statik)','','1');
  h+='<tr><td colspan="2" style="padding:5px 0 2px; font-size:0.58rem; font-weight:700; color:var(--text-secondary);">Dinamik Rijitlik [N/mm]</td></tr>';
  h+=_mntField(sub,'kxd','kx (dinamik)','','1');
  h+=_mntField(sub,'kyd','ky (dinamik)','','1');
  h+=_mntField(sub,'kzd','kz (dinamik)','','1');
  h+='</table>';
  return h;
}
function _mntFormLoadCase(sub){
  var h='<div style="font-size:0.58rem; color:var(--text-muted); margin-bottom:6px; line-height:1.4;">n = g-katsayısı (nz yerçekimi DAHİL; Statik=(0,0,−1), Bump 3g=(0,0,−3)). T = reaksiyon momenti [N·m].</div>';
  h+='<table style="width:100%; border-collapse:collapse; font-size:0.66rem;">';
  h+=_mntField(sub,'nx','nx','[g]','0.1');
  h+=_mntField(sub,'ny','ny','[g]','0.1');
  h+=_mntField(sub,'nz','nz','[g]','0.1');
  h+=_mntField(sub,'Tx','Tx','[N·m]','1');
  h+=_mntField(sub,'Ty','Ty','[N·m]','1');
  h+=_mntField(sub,'Tz','Tz','[N·m]','1');
  h+='</table>';
  return h;
}
function _mntFormTorque(sub){
  var d=veMountEnsureData(_veMountEditorNode);
  var h='<div style="font-size:0.58rem; color:var(--text-muted); margin-bottom:6px; line-height:1.4;">T_shaft = Te·Rstall·i_gear·i_transfer·φ_axle·derate. φ_axle = (aks payı)/(toplam pay).</div>';
  h+='<table style="width:100%; border-collapse:collapse; font-size:0.66rem;">';
  h+=_mntField(sub,'Te','Motor Torku Te','[N·m]','1');
  h+=_mntField(sub,'Rstall','Stall Oranı','','0.01');
  h+=_mntField(sub,'iTransfer','Transfer Oranı','','0.001');
  h+=_mntField(sub,'iGearFwd','İleri Vites','','0.01');
  h+=_mntField(sub,'iGearRev','Geri Vites (işaretli)','','0.01');
  h+=_mntField(sub,'splitFront','Ön Aks Payı','','0.01');
  h+=_mntField(sub,'splitRear','Arka Aks Payı','','0.01');
  h+=_mntField(sub,'derate','Derate','','0.01');
  h+='</table>';
  // T_fwd/T_rev + uygula
  var t=sub.data, total=_mntNum(t.splitFront)+_mntNum(t.splitRear);
  var Tfwd=veMountCore.torqueChain({Te:_mntNum(t.Te),Rstall:_mntNum(t.Rstall),iGear:_mntNum(t.iGearFwd),iTransfer:_mntNum(t.iTransfer),phiAxle:total?_mntNum(t.splitFront)/total:0,derate:_mntNum(t.derate,1)});
  var Trev=veMountCore.torqueChain({Te:_mntNum(t.Te),Rstall:_mntNum(t.Rstall),iGear:_mntNum(t.iGearRev),iTransfer:_mntNum(t.iTransfer),phiAxle:total?_mntNum(t.splitRear)/total:0,derate:_mntNum(t.derate,1)});
  h+='<div style="display:flex; gap:8px; margin-top:8px; font-size:0.64rem;">';
  h+='<div style="flex:1; padding:5px 7px; background:var(--bg-secondary); border:1px solid var(--border-color);">T_fwd = <b style="color:var(--accent-primary);">'+(Number.isFinite(Tfwd)?Tfwd.toFixed(1):'—')+'</b></div>';
  h+='<div style="flex:1; padding:5px 7px; background:var(--bg-secondary); border:1px solid var(--border-color);">T_rev = <b style="color:var(--accent-primary);">'+(Number.isFinite(Trev)?Trev.toFixed(1):'—')+'</b></div></div>';
  // yük durumuna uygula
  var lcs=d.nodes.filter(function(n){return n.kind==='loadcase';});
  if(lcs.length){
    h+='<div style="display:flex; gap:6px; align-items:center; margin-top:8px; flex-wrap:wrap;">';
    h+='<span style="font-size:0.6rem; color:var(--text-secondary);">Uygula →</span>';
    h+='<select id="ve-mount-tq-case" style="padding:4px; font-size:0.6rem; background:var(--bg-input); color:var(--text-primary); border:1px solid var(--border-color);">'+lcs.map(function(n){return '<option value="'+n.id+'">'+_mntEsc(n.name)+'</option>';}).join('')+'</select>';
    h+='<select id="ve-mount-tq-dir" style="padding:4px; font-size:0.6rem; background:var(--bg-input); color:var(--text-primary); border:1px solid var(--border-color);"><option value="fwd">İleri</option><option value="rev">Geri</option></select>';
    h+='<select id="ve-mount-tq-axis" style="padding:4px; font-size:0.6rem; background:var(--bg-input); color:var(--text-primary); border:1px solid var(--border-color);"><option value="Tx">Tx</option><option value="Ty">Ty</option><option value="Tz">Tz</option></select>';
    h+='<button onclick="veMountApplyTorque(\''+sub.id+'\')" style="padding:5px 9px; font-size:0.6rem; background:var(--accent-primary); color:#fff; border:none; cursor:pointer;">Uygula</button>';
    h+='</div><div style="font-size:0.52rem; color:var(--text-muted); margin-top:4px;">Seçili yük durumu node\'unun ilgili T eksenine −T_shaft yazılır.</div>';
  }
  return h;
}
function _mntFormSolver(){
  var h='<div style="display:flex; gap:6px; margin-bottom:10px;">';
  h+='<button onclick="veMountRefreshSolver()" style="flex:1; padding:8px; font-size:0.72rem; font-weight:700; background:var(--accent-primary); color:#fff; border:none; cursor:pointer;">▶ Hesapla</button>';
  h+='<button onclick="veMountCopyResults()" style="padding:8px 10px; font-size:0.66rem; background:var(--bg-tertiary); color:var(--text-primary); border:1px solid var(--border-color); cursor:pointer;">📋</button>';
  h+='<button onclick="veMountExportCSV()" style="padding:8px 10px; font-size:0.66rem; background:var(--bg-tertiary); color:var(--text-primary); border:1px solid var(--border-color); cursor:pointer;">CSV</button>';
  h+='</div>';
  h+='<div id="ve-mount-viewer-wrap" style="width:100%; height:200px; border:1px solid var(--border-color); background:#0a0a0a; margin-bottom:10px; position:relative;"><canvas id="ve-mount-viewer-canvas" style="width:100%; height:100%; display:block;"></canvas></div>';
  h+='<div id="ve-mount-results"></div>';
  return h;
}

// ─── Field setters ───────────────────────────────────────────────────────────
function veMountSetG(v){ var d=veMountEnsureData(_veMountEditorNode); d.g=_mntNum(v,9.81); veMountRefreshSolver(); }
function veMountSetName(id,v){ var d=veMountEnsureData(_veMountEditorNode); var n=d.nodes.find(function(x){return x.id===id;}); if(n){ n.name=v; veMountRenderCanvas(); veMountRefreshSolver(); } }
function veMountSetField(id,key,val){
  var d=veMountEnsureData(_veMountEditorNode); var n=d.nodes.find(function(x){return x.id===id;}); if(!n) return;
  n.data[key] = (typeof val==='boolean') ? val : val;
  if(key==='pointMass') veMountRenderInspector();
  veMountRenderCanvas(); veMountRefreshSolver();
  if(typeof veMountViewerUpdate==='function'){ try{ veMountViewerUpdate(); }catch(e){} }
}
function veMountApplyLib(id, key){
  if(!key) return;
  var d=veMountEnsureData(_veMountEditorNode); var lib=_mntAllLibrary(d); var m=lib[key]; if(!m) return;
  var n=d.nodes.find(function(x){return x.id===id;}); if(!n) return;
  n.data.kxs=m.sx; n.data.kys=m.sy; n.data.kzs=m.sz; n.data.kxd=m.dx; n.data.kyd=m.dy; n.data.kzd=m.dz; n.data.libKey=key;
  veMountRenderInspector(); veMountRefreshSolver();
}
function veMountApplyTorque(torqueId){
  var d=veMountEnsureData(_veMountEditorNode);
  var tqNode=d.nodes.find(function(n){return n.id===torqueId;}); if(!tqNode) return;
  var t=tqNode.data, total=_mntNum(t.splitFront)+_mntNum(t.splitRear);
  var caseId=(document.getElementById('ve-mount-tq-case')||{}).value;
  var dir=(document.getElementById('ve-mount-tq-dir')||{}).value||'fwd';
  var axis=(document.getElementById('ve-mount-tq-axis')||{}).value||'Tx';
  var lc=d.nodes.find(function(n){return n.id===caseId;}); if(!lc) return;
  var phi=total?(dir==='rev'?_mntNum(t.splitRear):_mntNum(t.splitFront))/total:0;
  var iGear=dir==='rev'?_mntNum(t.iGearRev):_mntNum(t.iGearFwd);
  var Tshaft=veMountCore.torqueChain({Te:_mntNum(t.Te),Rstall:_mntNum(t.Rstall),iGear:iGear,iTransfer:_mntNum(t.iTransfer),phiAxle:phi,derate:_mntNum(t.derate,1)});
  lc.data[axis]=Math.round(-Tshaft*100)/100;
  veMountRenderCanvas(); veMountRefreshSolver();
  if(typeof showToast==='function') showToast('"'+lc.name+'" → '+axis+' = '+lc.data[axis]+' N·m','info');
}

// ════════════════════════════════════════════════════════════════════════════
//  ÇÖZÜCÜ — agrege et, çekirdeği çağır, sonuçları render et
// ════════════════════════════════════════════════════════════════════════════
var _veMountLastResults=null;
function veMountRefreshSolver(){
  var out=document.getElementById('ve-mount-results'); if(!out) return; // solver paneli açık değil
  var node=_veMountEditorNode; if(!node) return;
  var d=veMountEnsureData(node);
  var C=veMountCore;
  var agg=_mntAggregate(d);
  var si=_mntToSI(agg);

  var problems=C.validateModel(si.components, si.mounts);
  if(problems.length){
    out.innerHTML='<div style="padding:10px 12px; background:rgba(239,68,68,0.12); border:1px solid var(--accent-danger); color:var(--accent-danger); font-size:0.68rem;"><b>Eksik ('+problems.length+'):</b><ul style="margin:6px 0 0 16px; padding:0;">'+problems.map(function(p){return '<li>'+_mntEsc(p)+'</li>';}).join('')+'</ul></div>';
    _veMountLastResults=null;
    if(typeof veMountViewerUpdate==='function'){ try{ veMountViewerInit('ve-mount-viewer-canvas'); veMountViewerUpdate(); }catch(e){} }
    return;
  }
  var mp=C.combineMassProps(si.components);
  if(!mp){ out.innerHTML='<div style="color:var(--accent-danger); font-size:0.7rem;">Kütle hesaplanamadı (toplam ≤ 0).</div>'; return; }

  var html='';
  var cgmm=mp.cg.map(function(v){return v*1000;});
  html+=_mntSectionTitle('Kütle Özeti');
  html+='<table style="width:100%; border-collapse:collapse; font-size:0.64rem; margin-bottom:10px;">';
  html+='<tr><th style="'+_mntTh()+'">Toplam Kütle m</th><td style="'+_mntTd()+'">'+_mntFmt(mp.m,3)+' kg</td></tr>';
  html+='<tr><th style="'+_mntTh()+'">Birleşik CG (mm)</th><td style="'+_mntTd()+'">('+_mntFmt(cgmm[0],2)+', '+_mntFmt(cgmm[1],2)+', '+_mntFmt(cgmm[2],2)+')</td></tr>';
  html+='<tr><th style="'+_mntTh()+'">Atalet I_G</th><td style="'+_mntTd()+' font-family:monospace; font-size:0.54rem; white-space:pre;">'+_mntInertiaText(mp.I_G)+'</td></tr>';
  html+='</table>';

  var model={ m:mp.m, cg:mp.cg, Kstat:C.buildK(si.mounts,mp.cg,false), mounts:si.mounts, g:si.g };
  var allCases=C.solveAllCases(model, si.loadCases);
  _veMountLastResults={ mp:mp, allCases:allCases, mounts:si.mounts };
  html+=_mntStaticMatrixHTML(allCases, si.mounts, d.matrixMode);

  var Kdyn=C.buildK(si.mounts,mp.cg,true), M6=C.buildM6(mp.m,mp.I_G);
  var modes=C.solveModal(Kdyn, M6, si.mounts, mp.cg);
  html+=_mntModalHTML(modes);
  out.innerHTML=html;

  if(typeof veMountViewerUpdate==='function'){ try{ veMountViewerInit('ve-mount-viewer-canvas'); veMountViewerUpdate(); }catch(e){} }
}
function _mntTh(){ return 'padding:5px 8px; text-align:left; background:var(--bg-tertiary); border:1px solid var(--border-color); font-weight:500; color:var(--text-secondary); width:36%;'; }
function _mntTd(){ return 'padding:5px 8px; border:1px solid var(--border-color); color:var(--text-primary); font-weight:600;'; }
function _mntSectionTitle(t, sub){ return '<div style="display:flex; align-items:center; gap:8px; margin:6px 0 6px; font-size:0.76rem; font-weight:700; color:var(--text-heading); border-bottom:1px solid var(--border-color); padding-bottom:4px;"><span>'+t+'</span>'+(sub?'<span style="font-size:0.53rem; font-weight:400; color:var(--text-muted);">'+sub+'</span>':'')+'</div>'; }
function _mntInertiaText(I){ var f=function(x){return Number.isFinite(x)?x.toFixed(2):'—';}; return '['+f(I[0][0])+', '+f(I[0][1])+', '+f(I[0][2])+']\n['+f(I[1][0])+', '+f(I[1][1])+', '+f(I[1][2])+']\n['+f(I[2][0])+', '+f(I[2][1])+', '+f(I[2][2])+']'; }
function _mntMxTh(){ return 'padding:3px 5px; border:1px solid var(--border-color); color:var(--text-secondary); font-weight:600; text-align:center;'; }
function _mntMxTd(){ return 'padding:3px 5px; border:1px solid var(--border-color); text-align:center; color:var(--text-primary);'; }
function _mntStaticMatrixHTML(allCases, mounts, mode){
  var isForce=(mode==='force');
  var h='<div style="display:flex; align-items:center; gap:8px; margin:6px 0 6px; font-size:0.76rem; font-weight:700; color:var(--text-heading); border-bottom:1px solid var(--border-color); padding-bottom:4px;"><span>Statik Çökme Matrisi</span><span style="font-size:0.52rem; font-weight:400; color:var(--text-muted);">'+(isForce?'kN':'mm')+' · |δ|>10mm/çekme işaretli</span><div style="flex:1;"></div><button onclick="veMountToggleMatrix()" style="padding:3px 8px; font-size:0.56rem; background:var(--bg-tertiary); color:var(--text-primary); border:1px solid var(--border-color); cursor:pointer;">'+(isForce?'→ Sehim':'→ Kuvvet')+'</button></div>';
  h+='<div style="overflow-x:auto; margin-bottom:10px;"><table style="border-collapse:collapse; font-size:0.55rem; white-space:nowrap;"><thead><tr style="background:var(--bg-tertiary);"><th rowspan="2" style="'+_mntMxTh()+'">Yük Durumu</th>';
  mounts.forEach(function(m){ h+='<th colspan="3" style="'+_mntMxTh()+'">'+_mntEsc(m.name)+'</th>'; });
  h+='<th rowspan="2" style="'+_mntMxTh()+'">ΣFz</th><th rowspan="2" style="'+_mntMxTh()+'">Çekme</th></tr><tr style="background:var(--bg-tertiary);">';
  mounts.forEach(function(){ ['x','y','z'].forEach(function(a){ h+='<th style="'+_mntMxTh()+'">'+a+'</th>'; }); });
  h+='</tr></thead><tbody>';
  allCases.forEach(function(rc){
    h+='<tr><td style="'+_mntMxTd()+' text-align:left; font-weight:600;">'+_mntEsc(rc.name)+'</td>';
    if(!rc.res){ h+='<td colspan="'+(mounts.length*3+2)+'" style="'+_mntMxTd()+' color:var(--accent-danger);">'+_mntEsc(rc.error||'çözülemedi')+'</td></tr>'; return; }
    rc.res.perMount.forEach(function(pm){
      for(var a=0;a<3;a++){
        var val=isForce?(pm.f[a]/1000):(pm.delta[a]*1000);
        var color=isForce?_mntForceColor(val):_mntDeflColor(val);
        var mark=(a===2&&pm.tension)?' outline:2px solid #a855f7; outline-offset:-2px;':'';
        var warn=(!isForce&&pm.overLinear)?'text-decoration:underline;':'';
        h+='<td style="'+_mntMxTd()+' color:'+color+'; font-weight:600;'+warn+mark+'">'+val.toFixed(2)+'</td>';
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
  var h=_mntSectionTitle('Modal Analiz','6 rijit gövde modu · K_dyn');
  if(!modes) return h+'<div style="color:var(--accent-danger); font-size:0.66rem;">Modal çözüm başarısız.</div>';
  h+='<div style="overflow-x:auto;"><table style="border-collapse:collapse; font-size:0.56rem; white-space:nowrap;"><thead><tr style="background:var(--bg-tertiary);">';
  ['Mod','f [Hz]','Etiket','ux','uy','uz','θx','θy','θz'].forEach(function(c){ h+='<th style="'+_mntMxTh()+'">'+c+'</th>'; });
  h+='</tr></thead><tbody>';
  modes.forEach(function(md,i){
    h+='<tr'+(md.warning?' title="'+_mntEsc(md.warning)+'"':'')+'><td style="'+_mntMxTd()+' font-weight:600;">'+(i+1)+'</td>';
    h+='<td style="'+_mntMxTd()+' font-weight:600; color:var(--accent-primary);">'+_mntFmt(md.f_Hz,3)+'</td>';
    h+='<td style="'+_mntMxTd()+' text-align:left; color:'+(md.warning?'#f59e0b':'var(--text-primary)')+';">'+_mntEsc(md.label)+'</td>';
    md.phi.forEach(function(v){ h+='<td style="'+_mntMxTd()+'"><span style="opacity:'+(0.35+0.65*Math.min(1,Math.abs(v)))+';">'+v.toFixed(2)+'</span></td>'; });
    h+='</tr>';
  });
  h+='</tbody></table></div><div style="font-size:0.5rem; color:var(--text-muted); margin-top:4px;">Etiket: baskın hareket. ⚠ = sıfıra yakın frekans.</div>';
  return h;
}
function veMountToggleMatrix(){ var d=veMountEnsureData(_veMountEditorNode); d.matrixMode=(d.matrixMode==='force')?'delta':'force'; veMountRefreshSolver(); }

// ─── Kopyala / CSV ───────────────────────────────────────────────────────────
function _mntResultsToText(){
  var R=_veMountLastResults; if(!R) return 'Önce Çözücü ile hesaplayın.';
  var cg=R.mp.cg.map(function(v){return (v*1000).toFixed(3);});
  var t='TAKOZ ÇÖKME-TİTREŞİM\n====================\nKütle: '+R.mp.m.toFixed(3)+' kg\nCG (mm): ('+cg.join(', ')+')\nI_G:\n'+_mntInertiaText(R.mp.I_G)+'\n\nSTATİK ÇÖKME (δz, mm):\n';
  R.allCases.forEach(function(rc){ if(!rc.res){ t+=rc.name+': '+(rc.error||'—')+'\n'; return; } t+=rc.name+': '+rc.res.perMount.map(function(pm){var v=pm.delta[2]*1000; return (v<0?'':'+')+v.toFixed(2);}).join(' / ')+'  [ΣFz='+(rc.res.sumF[2]/1000).toFixed(2)+' kN, çekme='+rc.res.checks.tensionCount+']\n'; });
  return t;
}
function veMountCopyResults(){
  var txt=_mntResultsToText();
  if(navigator.clipboard&&navigator.clipboard.writeText){ navigator.clipboard.writeText(txt).then(function(){ if(typeof showToast==='function') showToast('Kopyalandı.','success'); }); }
  else { var ta=document.createElement('textarea'); ta.value=txt; document.body.appendChild(ta); ta.select(); try{document.execCommand('copy');}catch(e){} ta.remove(); }
}
function veMountExportCSV(){
  var R=_veMountLastResults; if(!R){ if(typeof showToast==='function') showToast('Önce hesaplayın.','warning'); return; }
  var rows=[], head=['LoadCase'];
  R.mounts.forEach(function(m){ head.push(m.name+' dx',m.name+' dy',m.name+' dz'); });
  head.push('SumFz_kN','Tension'); rows.push(head.join(','));
  R.allCases.forEach(function(rc){ if(!rc.res){ rows.push(rc.name+',ERROR'); return; } var r=[rc.name]; rc.res.perMount.forEach(function(pm){ r.push((pm.delta[0]*1000).toFixed(3),(pm.delta[1]*1000).toFixed(3),(pm.delta[2]*1000).toFixed(3)); }); r.push((rc.res.sumF[2]/1000).toFixed(3), rc.res.checks.tensionCount); rows.push(r.join(',')); });
  var blob=new Blob([rows.join('\n')],{type:'text/csv'});
  var a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='takoz_cokme.csv'; a.click(); setTimeout(function(){URL.revokeObjectURL(a.href);},500);
}

// ─── TTAR örneği → alt-node'lar ──────────────────────────────────────────────
function veMountTTARNodes(){
  var EX=veMountCore.TTAR_EXAMPLE, c=0, out=[];
  function id(){ c++; return 'm'+c; }
  EX.components.forEach(function(cp,i){
    var kind = /motor/i.test(cp.name)?'motor':/şanz|sanz/i.test(cp.name)?'transmission':/şaft|saft|shaft/i.test(cp.name)?'shaft':/cradle|braket|bracket/i.test(cp.name)?'bracket':'othermass';
    out.push({ id:id(), kind:kind, name:cp.name, cx:60, cy:60+i*74,
      data:{ mass:cp.mass, cgx:cp.cg[0], cgy:cp.cg[1], cgz:cp.cg[2], Ixx:cp.Ixx, Iyy:cp.Iyy, Izz:cp.Izz, Ixy:cp.Ixy, Ixz:cp.Ixz, Iyz:cp.Iyz, pointMass:!!cp.pointMass } });
  });
  EX.mounts.forEach(function(m,i){
    out.push({ id:id(), kind:'mount', name:m.name, cx:260, cy:60+i*66,
      data:{ x:m.pos[0], y:m.pos[1], z:m.pos[2], kxs:m.kstat[0], kys:m.kstat[1], kzs:m.kstat[2], kxd:m.kdyn[0], kyd:m.kdyn[1], kzd:m.kdyn[2], libKey:'amc55sha' } });
  });
  EX.loadCases.forEach(function(lc,i){
    out.push({ id:id(), kind:'loadcase', name:lc.name, cx:460, cy:60+i*58,
      data:{ nx:lc.n[0], ny:lc.n[1], nz:lc.n[2], Tx:lc.T[0], Ty:lc.T[1], Tz:lc.T[2] } });
  });
  var tq=EX.torque;
  out.push({ id:id(), kind:'torque', name:'Sistem-Tork', cx:660, cy:60,
    data:{ Te:tq.Te, Rstall:tq.Rstall, iTransfer:tq.iTransfer, iGearFwd:tq.fwd.iGear, iGearRev:tq.rev.iGear, splitFront:1, splitRear:2.6, derate:tq.derate } });
  out.push({ id:id(), kind:'solver', name:'Çözücü', cx:660, cy:180, data:{} });
  return { nodes:out, counter:c };
}
function veMountLoadTTAR(){
  var node=_veMountEditorNode; if(!node) return;
  var d=veMountEnsureData(node);
  var ttar=veMountTTARNodes();
  d.nodes=ttar.nodes; d.counter=ttar.counter; d.g=veMountCore.TTAR_EXAMPLE.g;
  var solver=d.nodes.find(function(n){return n.kind==='solver';});
  d.sel = solver? solver.id : (d.nodes[0]&&d.nodes[0].id);
  veMountRenderCanvas(); veMountRenderInspector();
  if(typeof showToast==='function') showToast('TTAR seti node olarak yüklendi (5 kütle, 6 takoz, 8 yük durumu, tork, çözücü).','success');
}

// ─── Self-Test / Matematik modalları ─────────────────────────────────────────
function veMountRunSelfTest(){
  var r=veMountCore.selfTest();
  var h='<div style="font-size:0.72rem;"><div style="font-weight:700; margin-bottom:10px; color:'+(r.failed===0?'#22c55e':'#ef4444')+';">'+(r.failed===0?'✓ TÜM TESTLER GEÇTİ':'✗ '+r.failed+' BAŞARISIZ')+' <span style="color:var(--text-muted); font-weight:400;">('+r.passed+' geçti / '+r.failed+' kaldı)</span></div>';
  h+='<table style="width:100%; border-collapse:collapse; font-size:0.62rem;"><thead><tr style="background:var(--bg-tertiary);"><th style="'+_mntMxTh()+'">Test</th><th style="'+_mntMxTh()+'">Ad</th><th style="'+_mntMxTh()+'">Sonuç</th></tr></thead><tbody>';
  r.details.forEach(function(dt){ h+='<tr><td style="'+_mntMxTd()+' font-weight:600;">'+_mntEsc(dt.id)+'</td><td style="'+_mntMxTd()+' text-align:left;">'+_mntEsc(dt.name)+'<div style="font-size:0.5rem; color:var(--text-muted); white-space:normal; max-width:520px;">'+_mntEsc(dt.detail)+'</div></td><td style="'+_mntMxTd()+'">'+(dt.ok?'<span style="color:#22c55e;">✓</span>':'<span style="color:#ef4444;">✗</span>')+'</td></tr>'; });
  h+='</tbody></table></div>';
  _mntShowModal('🧪 Self-Test — Kabul Testleri (Adams TTAR)', h);
}
function veMountOpenMathModal(){ _mntShowModal('📐 Takoz Modülünün Matematiği', _mntMathHTML()); }
function _mntMathHTML(){
  var eq='background:var(--bg-secondary); border:1px solid var(--border-color); padding:8px 12px; margin:6px 0; font-family:monospace; font-size:0.66rem; white-space:pre-wrap; overflow-x:auto;';
  var st='font-weight:700; color:var(--text-heading); margin:14px 0 4px; font-size:0.82rem;';
  var tx='font-size:0.68rem; line-height:1.55; color:var(--text-secondary); margin:4px 0;';
  var h='<div style="max-width:760px;">';
  h+='<div style="'+st+'">0. Model</div><div style="'+tx+'">Güç grubu tek rijit gövde; şasiye N takoz (üç eksenli lineer yay) ile bağlı. 6 SD: 3 öteleme + 3 dönme. Referans: birleşik CG. Lineer model ±10 mm bandında Adams ile birebir.</div>';
  h+='<div style="'+st+'">1-2. Koordinat & kinematik</div><div style="'+eq+'">q = [ux,uy,uz,θx,θy,θz]\nd = r_mount − c_G\nδ = u + θ×d = A·q ,  A = [E3 | −skew(d)]</div>';
  h+='<div style="'+st+'">3. Rijitlik & kütle</div><div style="'+eq+'">K = Σ Aᵢᵀ·diag(kx,ky,kz)ᵢ·Aᵢ\nM6 = blockdiag(m·E3, I_G)\nI_G = Σ[Iⱼ + mⱼ((dⱼ·dⱼ)E3 − dⱼdⱼᵀ)]</div><div style="'+tx+'">İki K: K_stat (statik), K_dyn (modal). Atalet CATIA tensör bileşeni.</div>';
  h+='<div style="'+st+'">4. Statik çözüm</div><div style="'+eq+'">F = [m·g·nx, m·g·ny, m·g·nz, Tx,Ty,Tz]  (nz yerçekimi DAHİL)\nq = K_stat⁻¹·F ,  δᵢ = Aᵢ·q ,  fᵢ = kᵢ·δᵢ\nΣfz = −m·g ; çekme: δz > +0.01 mm</div>';
  h+='<div style="'+st+'">5. Tork zinciri</div><div style="'+eq+'">T_shaft = Te·R_stall·i_gear·i_transfer·φ_axle·derate\nφ_axle = (aks payı)/(toplam pay) ; reaksiyon Tx = −T_shaft</div>';
  h+='<div style="'+st+'">6. Modal</div><div style="'+eq+'">(K_dyn − ω²M6)φ = 0 → genelleştirilmiş özdeğer\nM6=L·Lᵀ, Kp=L⁻¹K_dyn L⁻ᵀ, Jacobi, φ=L⁻ᵀy\nf_r = √λ_r/2π (6 mod, artan)</div>';
  h+='<div style="'+tx+'; color:var(--text-muted); margin-top:12px; border-top:1px solid var(--border-color); padding-top:8px;">Doğrulama: Adams BMC_TTAR_2031. Self-Test T1–T8 referans değerlerle eşleşir.</div></div>';
  return h;
}
function _mntShowModal(title, innerHTML){
  var old=document.getElementById('ve-mount-submodal'); if(old) old.remove();
  var ov=document.createElement('div'); ov.id='ve-mount-submodal';
  ov.style.cssText='position:fixed; inset:0; z-index:100010; background:rgba(0,0,0,0.6); display:flex; align-items:center; justify-content:center; padding:20px;';
  ov.addEventListener('mousedown', function(e){ if(e.target===ov) ov.remove(); });
  var box=document.createElement('div');
  box.style.cssText='max-width:840px; width:92%; max-height:88vh; overflow-y:auto; background:var(--bg-secondary); border:1px solid var(--border-color); box-shadow:0 20px 60px rgba(0,0,0,0.6);';
  box.innerHTML='<div style="display:flex; align-items:center; padding:12px 16px; border-bottom:1px solid var(--border-color); background:var(--bg-tertiary); position:sticky; top:0;"><span style="font-weight:700; font-size:0.88rem; color:var(--text-heading);">'+title+'</span><div style="flex:1;"></div><button onclick="this.closest(\'#ve-mount-submodal\').remove()" style="background:none; border:none; color:var(--text-muted); cursor:pointer; font-size:1.1rem;">✕</button></div><div style="padding:16px;">'+innerHTML+'</div>';
  ov.appendChild(box); document.body.appendChild(ov);
}

// Node/Jest için dışa aç
if(typeof module!=='undefined' && module.exports){
  module.exports = {
    getMountAnalysisPropertiesHTML: getMountAnalysisPropertiesHTML,
    veMountDefaultData: veMountDefaultData,
    veMountEnsureData: veMountEnsureData,
    VE_MOUNT_LIBRARY: VE_MOUNT_LIBRARY,
    MNT_KINDS: MNT_KINDS,
    _mntAggregate: _mntAggregate,
    _mntToSI: _mntToSI,
    veMountTTARNodes: veMountTTARNodes,
    _mntDeflColor: _mntDeflColor,
    _mntForceColor: _mntForceColor
  };
}
