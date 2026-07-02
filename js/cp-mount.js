// ============================================================================
// TAKOZ ÇÖKME-TİTREŞİM — UI KATMANI (özellik paneli + tam editör penceresi)
// ============================================================================
// SPEC "Takoz Çökme–Titreşim Modülü (6 SD Rijit Gövde Modeli)" v1.0, Bölüm 7.
// Hesap çekirdeği: js/mount-core.js (veMountCore) — DOM'suz saf fonksiyonlar.
// Bu katman çekirdeği çağırır; TERSİ ASLA OLMAZ.
//
// Birim kuralı (SPEC 2): UI mm / kg / N/mm / N·m; çekirdek SI (m / N/m).
// Dönüşüm YALNIZCA bu katmanda (veMountCore.mmToM / nPerMmToNPerM).
//
// Bileşen maxInstances:1 → editör tek örnektir → modal içinde SABİT ID kullanılır.
// Kalıcılık: tüm girdiler node.data.mnt içinde (proje kaydet/yükle otomatik).
// ----------------------------------------------------------------------------

// ─── Yardımcılar ─────────────────────────────────────────────────────────────
function _mntNum(v, d){ if(v===undefined||v===null) return d===undefined?0:d; var x=(typeof v==='string')?v.trim().replace(',', '.'):v; var n=Number(x); return Number.isFinite(n)?n:(d===undefined?0:d); }
function _mntFmt(x, dg){ if(!Number.isFinite(x)) return '—'; dg=(dg===undefined)?3:dg; return x.toFixed(dg); }
function _mntEsc(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

// Sehim (mm) renk skalası — A26 getDeflectionColor portu.
function _mntDeflColor(mm){ var a=Math.abs(mm); if(a<0.5) return '#22c55e'; if(a<1.0) return '#84cc16'; if(a<2.0) return '#eab308'; if(a<3.0) return '#f97316'; return '#ef4444'; }
// Kuvvet (kN) renk skalası — A26 getForceColor portu.
function _mntForceColor(kN){ var a=Math.abs(kN); if(a<5) return '#22c55e'; if(a<10) return '#84cc16'; if(a<20) return '#eab308'; if(a<30) return '#f97316'; return '#ef4444'; }

// ─── node.data.mnt durumu ────────────────────────────────────────────────────
function _mntGetNode(){ return (typeof nodes!=='undefined') ? nodes.find(function(n){return n.type==='mount-analysis';}) : null; }

// Varsayılan mount veri modeli (UI birimleri). Boş tablolarla açılır;
// "Örnek Yükle (TTAR)" gerçek doğrulama setini doldurur.
function veMountDefaultData(){
  var C = (typeof veMountCore!=='undefined') ? veMountCore : null;
  return {
    g: 9.81,
    components: [],
    mounts: [],
    loadCases: C ? C.defaultLoadCases().map(function(lc){
      return { name:lc.name, nx:lc.n[0], ny:lc.n[1], nz:lc.n[2], Tx:lc.T[0], Ty:lc.T[1], Tz:lc.T[2] };
    }) : [],
    torque: { Te:0, Rstall:1, iTransfer:1, iGearFwd:1, iGearRev:-1, splitFront:1, splitRear:1, derate:1 },
    library: {},                 // kullanıcı-tanımlı takoz tipleri
    matrixMode: 'delta',         // 'delta' | 'force'
    selCase: 0                   // detay için seçili yük durumu
  };
}
function veMountEnsureData(node){
  if(!node) return null;
  if(!node.data) node.data = {};
  if(!node.data.mnt) node.data.mnt = veMountDefaultData();
  var d = node.data.mnt;
  // Geriye dönük alan tamamlama
  if(d.g===undefined) d.g = 9.81;
  if(!Array.isArray(d.components)) d.components = [];
  if(!Array.isArray(d.mounts)) d.mounts = [];
  if(!Array.isArray(d.loadCases)) d.loadCases = [];
  if(!d.torque) d.torque = { Te:0, Rstall:1, iTransfer:1, iGearFwd:1, iGearRev:-1, splitFront:1, splitRear:1, derate:1 };
  if(!d.library) d.library = {};
  if(!d.matrixMode) d.matrixMode = 'delta';
  if(d.selCase===undefined) d.selCase = 0;
  return d;
}

// ─── A26 gömülü takoz kütüphanesi (SPEC 7.2 — aynen taşınır) ────────────────
var VE_MOUNT_LIBRARY = {
  'amc55sha':   { name:'AMC 55 ShA',        sx:1252, sy:1252, sz:640,  dx:2055, dy:2055, dz:977 },
  '57RS313773': { name:'ÖN - 57RS313773',   sx:334,  sy:334,  sz:2300, dx:435,  dy:435,  dz:3000 },
  '57RS313774': { name:'ARKA - 57RS313774', sx:1200, sy:1200, sz:2400, dx:950,  dy:950,  dz:1900 }
};
// Gömülü + kullanıcı kütüphanesi birleşik.
function _mntAllLibrary(d){
  var lib = {};
  Object.keys(VE_MOUNT_LIBRARY).forEach(function(k){ lib[k] = VE_MOUNT_LIBRARY[k]; });
  if(d && d.library) Object.keys(d.library).forEach(function(k){ lib[k] = d.library[k]; });
  return lib;
}

// ─── Çekirdek girdisine (SI) dönüştürme ─────────────────────────────────────
function _mntToSI(d){
  var C = veMountCore;
  var components = d.components.map(function(c){
    return {
      name: c.name || 'bileşen',
      mass: _mntNum(c.mass,0),
      cg: [C.mmToM(_mntNum(c.cgx)), C.mmToM(_mntNum(c.cgy)), C.mmToM(_mntNum(c.cgz))],
      I: [[_mntNum(c.Ixx),_mntNum(c.Ixy),_mntNum(c.Ixz)],
          [_mntNum(c.Ixy),_mntNum(c.Iyy),_mntNum(c.Iyz)],
          [_mntNum(c.Ixz),_mntNum(c.Iyz),_mntNum(c.Izz)]],
      pointMass: !!c.pointMass
    };
  });
  var mounts = d.mounts.map(function(m){
    return {
      name: m.name || 'takoz',
      pos: [C.mmToM(_mntNum(m.x)), C.mmToM(_mntNum(m.y)), C.mmToM(_mntNum(m.z))],
      kstat: [C.nPerMmToNPerM(_mntNum(m.kxs)), C.nPerMmToNPerM(_mntNum(m.kys)), C.nPerMmToNPerM(_mntNum(m.kzs))],
      kdyn:  [C.nPerMmToNPerM(_mntNum(m.kxd)), C.nPerMmToNPerM(_mntNum(m.kyd)), C.nPerMmToNPerM(_mntNum(m.kzd))]
    };
  });
  var loadCases = d.loadCases.map(function(lc){
    return { name: lc.name||'durum', n:[_mntNum(lc.nx),_mntNum(lc.ny),_mntNum(lc.nz)], T:[_mntNum(lc.Tx),_mntNum(lc.Ty),_mntNum(lc.Tz)] };
  });
  return { components:components, mounts:mounts, loadCases:loadCases, g:_mntNum(d.g,9.81) };
}

// ════════════════════════════════════════════════════════════════════════════
//  ÖZELLİK PANELİ (side) — özet + "Editörü Aç"
// ════════════════════════════════════════════════════════════════════════════
function getMountAnalysisPropertiesHTML(node){
  var d = veMountEnsureData(node);
  var html = '<div class="sw-panel">';
  html += '<div style="padding:8px 10px; margin-bottom:10px; font-size:0.62rem; line-height:1.4; color:var(--text-secondary); background:var(--bg-secondary); border:1px solid var(--border-color); border-left:3px solid var(--accent-primary);">'
        + '<b style="color:var(--text-heading);">Takoz Çökme-Titreşim (6 SD).</b> '
        + 'Motor-şanzıman güç grubunun takozlar üzerindeki statik çökme ve rijit gövde modal analizi. '
        + 'Kütle birleştirme · 6 SD statik çözüm · doğal frekanslar + mod şekilleri · tork zinciri.'
        + '</div>';
  // Mini özet
  var nc = d.components.length, nm = d.mounts.length, nl = d.loadCases.length;
  html += '<table style="width:100%; font-size:0.68rem; border-collapse:collapse; border:1px solid var(--border-color); margin-bottom:10px;">';
  html += _mntSummaryRow('Bileşen sayısı', nc);
  html += _mntSummaryRow('Takoz sayısı', nm);
  html += _mntSummaryRow('Yük durumu', nl);
  html += '</table>';
  html += '<button onclick="veMountOpenEditor(\'' + node.id + '\')" style="width:100%; padding:14px 16px; font-size:0.82rem; font-weight:700; background:var(--accent-primary); color:#fff; border:none; cursor:pointer; letter-spacing:0.03em; transition:all 0.12s;" onmouseover="this.style.filter=\'brightness(1.15)\'" onmouseout="this.style.filter=\'none\'">▶ Takoz Analiz Editörünü Aç</button>';
  html += '<div style="font-size:0.55rem; color:var(--text-muted); line-height:1.5; margin-top:8px; padding:0 2px;">Editörde: bileşen / takoz / yük durumu tabloları, tork paneli, statik çökme matrisi, modal tablo (mod şekilleri), 3D görünüm ve <b>Self-Test</b>.</div>';
  html += '</div>';
  return html;
}
function _mntSummaryRow(label, val){
  return '<tr style="border-bottom:1px solid var(--border-color);">'
    + '<th style="padding:6px 8px; text-align:left; background:var(--bg-tertiary); border-right:1px solid var(--border-color); width:60%; font-weight:500; color:var(--text-secondary);">' + label + '</th>'
    + '<td style="padding:6px 8px; background:var(--bg-secondary); color:var(--text-primary); font-weight:600; text-align:right;">' + val + '</td></tr>';
}
// Eski placeholder API'si (geri uyum — çağıran kod veya testler için no-op köprü).
function onVEMountAnalysisChange(nodeId){ /* editör model kullanır; side panelde girdi yok */ }

// ════════════════════════════════════════════════════════════════════════════
//  TAM EDİTÖR PENCERESİ (fullscreen modal — FEA editör deseni)
// ════════════════════════════════════════════════════════════════════════════
var _veMountEditorNode = null;
var _veMountEscHandler = null;

function veMountOpenEditor(nodeId){
  var node = nodes.find(function(n){ return n.id===nodeId; });
  if(!node){ return; }
  var d = veMountEnsureData(node);
  _veMountEditorNode = node;

  if(typeof veTogglePropertiesPanel==='function') veTogglePropertiesPanel(false);

  var overlay = document.createElement('div');
  overlay.id = 've-mount-editor-overlay';
  overlay.style.cssText = 'position:fixed; inset:0; z-index:100000; background:rgba(0,0,0,0.82); display:flex; align-items:center; justify-content:center; padding:14px; backdrop-filter:blur(4px);';
  overlay.addEventListener('mousedown', function(e){ if(e.target===overlay) veMountCloseEditor(); });

  var modal = document.createElement('div');
  modal.id = 've-mount-editor-modal';
  modal.style.cssText = 'width:96%; max-width:1750px; min-width:760px; height:93vh; max-height:1040px; background:var(--bg-secondary,#0f1218); border:1px solid var(--border-color,#1c2333); display:flex; flex-direction:column; overflow:hidden; box-shadow:0 20px 60px rgba(0,0,0,0.6);';

  modal.innerHTML = _mntEditorHeaderHTML() + _mntEditorBodyHTML(d);
  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  _veMountEscHandler = function(e){ if(e.key==='Escape') veMountCloseEditor(); };
  document.addEventListener('keydown', _veMountEscHandler);

  // Tabloları doldur + varsa 3D viewer başlat
  veMountRenderTables();
  veMountCompute();           // açılışta mevcut veriyle hesapla
  if(typeof veMountViewerInit==='function'){
    setTimeout(function(){ try{ veMountViewerInit('ve-mount-viewer-canvas'); veMountViewerUpdate(); }catch(e){} }, 60);
  }
}

function veMountCloseEditor(){
  if(typeof veMountViewerDispose==='function'){ try{ veMountViewerDispose(); }catch(e){} }
  var ov = document.getElementById('ve-mount-editor-overlay');
  if(ov) ov.remove();
  if(_veMountEscHandler){ document.removeEventListener('keydown', _veMountEscHandler); _veMountEscHandler=null; }
  _veMountEditorNode = null;
  if(typeof saveState==='function') saveState();
}

function _mntEditorHeaderHTML(){
  var b = 'padding:7px 12px; font-size:0.72rem; font-weight:600; border:1px solid var(--border-color); background:var(--bg-tertiary); color:var(--text-primary); cursor:pointer;';
  return ''
  + '<div style="display:flex; align-items:center; gap:10px; padding:10px 16px; border-bottom:1px solid var(--border-color); background:var(--bg-tertiary); flex-shrink:0;">'
  +   '<span style="font-weight:700; font-size:0.95rem; color:var(--text-heading); display:flex; align-items:center; gap:8px;"><span class="mf-ico mf-ico-sliders"></span>Takoz Çökme-Titreşim Editörü</span>'
  +   '<span style="font-size:0.6rem; color:var(--text-muted);">6 SD Rijit Gövde · Adams TTAR doğrulamalı</span>'
  +   '<div style="flex:1;"></div>'
  +   '<button onclick="veMountLoadTTAR()" style="' + b + '" title="Adams TTAR doğrulama setini yükle">📥 Örnek Yükle (TTAR)</button>'
  +   '<button onclick="veMountRunSelfTest()" style="' + b + '" title="T1–T8 kabul testleri">🧪 Self-Test</button>'
  +   '<button onclick="veMountOpenMathModal()" style="' + b + '" title="Programın matematiği">📐 Matematik</button>'
  +   '<button onclick="veMountCompute()" style="' + b.replace('var(--bg-tertiary)','var(--accent-primary)').replace('var(--text-primary)','#fff') + '" title="Statik + modal hesap">▶ Hesapla</button>'
  +   '<button onclick="veMountCloseEditor()" style="' + b + ' font-weight:700;" title="Kapat (Esc)">✕</button>'
  + '</div>';
}

function _mntEditorBodyHTML(d){
  return ''
  + '<div style="flex:1; display:flex; flex-direction:row; min-height:0; overflow:hidden;">'
  // ── SOL: girdiler ──
  +   '<div style="width:52%; min-width:420px; overflow-y:auto; padding:14px; border-right:1px solid var(--border-color);">'
  +     _mntSectionComponents()
  +     _mntSectionMounts()
  +     _mntSectionLoadCases()
  +     _mntSectionTorque(d)
  +     _mntSectionGlobal(d)
  +   '</div>'
  // ── SAĞ: 3D + sonuçlar ──
  +   '<div style="flex:1; min-width:340px; overflow-y:auto; padding:14px; background:var(--bg-primary,#0a0d13);">'
  +     '<div id="ve-mount-viewer-wrap" style="width:100%; height:260px; border:1px solid var(--border-color); background:#0a0a0a; margin-bottom:12px; position:relative;">'
  +       '<canvas id="ve-mount-viewer-canvas" style="width:100%; height:100%; display:block;"></canvas>'
  +       '<div style="position:absolute; top:6px; left:8px; font-size:0.55rem; color:var(--text-muted); pointer-events:none;">3D: takoz küpleri · bileşen CG · birleşik CG (kırmızı)</div>'
  +     '</div>'
  +     '<div id="ve-mount-results"></div>'
  +   '</div>'
  + '</div>';
}

// ─── Bölüm: Bileşen tablosu ──────────────────────────────────────────────────
function _mntSectionTitle(t, sub){
  return '<div style="display:flex; align-items:center; gap:8px; margin:4px 0 8px; font-size:0.78rem; font-weight:700; color:var(--text-heading); border-bottom:1px solid var(--border-color); padding-bottom:5px;">'
       + '<span>' + t + '</span>' + (sub?('<span style="font-size:0.55rem; font-weight:400; color:var(--text-muted);">'+sub+'</span>'):'') + '</div>';
}
function _mntSectionComponents(){
  var h = '<div style="margin-bottom:16px;">';
  h += _mntSectionTitle('Bileşenler', 'kütle kg · CG mm · atalet kg·m² (CATIA tensör bileşeni ⓘ)');
  h += '<div style="overflow-x:auto;"><table id="ve-mount-comp-table" style="width:100%; border-collapse:collapse; font-size:0.6rem; white-space:nowrap;"><thead><tr style="background:var(--bg-tertiary);">';
  ['Ad','Tip','Kütle','CGx','CGy','CGz','Ixx','Iyy','Izz','Ixy','Ixz','Iyz','Nokta','']
    .forEach(function(c){ h += '<th style="padding:4px 5px; border:1px solid var(--border-color); color:var(--text-secondary); font-weight:600;" title="'+_mntEsc(c)+'">'+c+'</th>'; });
  h += '</tr></thead><tbody id="ve-mount-comp-body"></tbody></table></div>';
  h += '<button onclick="veMountAddComponent()" style="margin-top:6px; padding:5px 10px; font-size:0.62rem; background:var(--bg-tertiary); color:var(--text-primary); border:1px solid var(--border-color); cursor:pointer;">+ Bileşen Ekle</button>';
  h += '<div style="font-size:0.52rem; color:var(--text-muted); margin-top:5px; line-height:1.4;">ⓘ Atalet çarpım terimleri (Ixy/Ixz/Iyz) <b>tensör bileşeni</b> olarak girilir (CATIA Measure Inertia ile aynı). El kitabı ∫xy dm konvansiyonu kullanılıyorsa işaret çevrilmelidir. <b>Nokta kütle</b>: atalet = 0.</div>';
  h += '</div>';
  return h;
}
function _mntSectionMounts(){
  var h = '<div style="margin-bottom:16px;">';
  h += _mntSectionTitle('Takozlar', 'konum mm · rijitlik N/mm (statik / dinamik)');
  h += '<div style="display:flex; gap:8px; align-items:center; margin-bottom:6px;">';
  h += '<select id="ve-mount-lib-sel" style="flex:1; padding:5px; font-size:0.62rem; background:var(--bg-input); color:var(--text-primary); border:1px solid var(--border-color);"></select>';
  h += '<button onclick="veMountAddMountFromLib()" style="padding:5px 10px; font-size:0.62rem; background:var(--bg-tertiary); color:var(--text-primary); border:1px solid var(--border-color); cursor:pointer;">+ Kütüphaneden Ekle</button>';
  h += '</div>';
  h += '<div style="overflow-x:auto;"><table id="ve-mount-mount-table" style="width:100%; border-collapse:collapse; font-size:0.6rem; white-space:nowrap;"><thead><tr style="background:var(--bg-tertiary);">';
  ['Ad','x','y','z','kx(s)','ky(s)','kz(s)','kx(d)','ky(d)','kz(d)','']
    .forEach(function(c){ h += '<th style="padding:4px 5px; border:1px solid var(--border-color); color:var(--text-secondary); font-weight:600;">'+c+'</th>'; });
  h += '</tr></thead><tbody id="ve-mount-mount-body"></tbody></table></div>';
  h += '<button onclick="veMountAddMount()" style="margin-top:6px; padding:5px 10px; font-size:0.62rem; background:var(--bg-tertiary); color:var(--text-primary); border:1px solid var(--border-color); cursor:pointer;">+ Boş Takoz Ekle</button>';
  h += '</div>';
  return h;
}
function _mntSectionLoadCases(){
  var h = '<div style="margin-bottom:16px;">';
  h += _mntSectionTitle('Yük Durumları', 'n = g-katsayısı (nz yerçekimi DAHİL) · T = N·m');
  h += '<div style="overflow-x:auto;"><table id="ve-mount-lc-table" style="width:100%; border-collapse:collapse; font-size:0.6rem; white-space:nowrap;"><thead><tr style="background:var(--bg-tertiary);">';
  ['Ad','nx','ny','nz','Tx','Ty','Tz','']
    .forEach(function(c){ h += '<th style="padding:4px 5px; border:1px solid var(--border-color); color:var(--text-secondary); font-weight:600;">'+c+'</th>'; });
  h += '</tr></thead><tbody id="ve-mount-lc-body"></tbody></table></div>';
  h += '<button onclick="veMountAddLoadCase()" style="margin-top:6px; padding:5px 10px; font-size:0.62rem; background:var(--bg-tertiary); color:var(--text-primary); border:1px solid var(--border-color); cursor:pointer;">+ Yük Durumu Ekle</button>';
  h += '</div>';
  return h;
}
function _mntSectionTorque(d){
  var t = d.torque;
  function inp(id,val,step){ return '<input type="number" id="'+id+'" value="'+(val===undefined?'':val)+'" step="'+(step||'any')+'" oninput="veMountRecalcTorque()" style="width:100%; padding:4px; font-size:0.62rem; background:var(--bg-input); color:var(--text-primary); border:1px solid var(--border-color); text-align:right;">'; }
  var h = '<div style="margin-bottom:16px;">';
  h += _mntSectionTitle('Sistem / Tork Zinciri', 'T_shaft = Te·Rstall·i_gear·i_transfer·φ_axle·derate');
  h += '<table style="width:100%; border-collapse:collapse; font-size:0.62rem;">';
  function row(label,cell){ return '<tr><th style="padding:4px 6px; text-align:left; background:var(--bg-tertiary); border:1px solid var(--border-color); font-weight:500; color:var(--text-secondary); width:52%;">'+label+'</th><td style="padding:3px 5px; border:1px solid var(--border-color);">'+cell+'</td></tr>'; }
  h += row('Motor Torku T<sub>e</sub> [N·m]', inp('ve-mount-tq-Te', t.Te));
  h += row('Stall Oranı R<sub>stall</sub>', inp('ve-mount-tq-Rstall', t.Rstall));
  h += row('Transfer Oranı i<sub>transfer</sub>', inp('ve-mount-tq-iTransfer', t.iTransfer));
  h += row('İleri Vites Oranı i<sub>gear,fwd</sub>', inp('ve-mount-tq-iGearFwd', t.iGearFwd));
  h += row('Geri Vites Oranı i<sub>gear,rev</sub> (işaretli)', inp('ve-mount-tq-iGearRev', t.iGearRev));
  h += row('Ön Aks Payı', inp('ve-mount-tq-splitFront', t.splitFront));
  h += row('Arka Aks Payı', inp('ve-mount-tq-splitRear', t.splitRear));
  h += row('Toplam Pay (otomatik)', '<span id="ve-mount-tq-splitTotal" style="display:inline-block; width:100%; text-align:right; padding:4px; color:var(--text-muted);">—</span>');
  h += row('Derate', inp('ve-mount-tq-derate', t.derate));
  h += '</table>';
  h += '<div style="display:flex; gap:10px; margin-top:8px; font-size:0.66rem;">';
  h += '<div style="flex:1; padding:6px 8px; background:var(--bg-secondary); border:1px solid var(--border-color);">T<sub>fwd</sub> = <b id="ve-mount-tq-Tfwd" style="color:var(--accent-primary);">—</b> N·m</div>';
  h += '<div style="flex:1; padding:6px 8px; background:var(--bg-secondary); border:1px solid var(--border-color);">T<sub>rev</sub> = <b id="ve-mount-tq-Trev" style="color:var(--accent-primary);">—</b> N·m</div>';
  h += '</div>';
  h += '<div style="display:flex; gap:8px; align-items:center; margin-top:8px; flex-wrap:wrap;">';
  h += '<span style="font-size:0.62rem; color:var(--text-secondary);">Uygula →</span>';
  h += '<select id="ve-mount-tq-applyCase" style="padding:4px; font-size:0.62rem; background:var(--bg-input); color:var(--text-primary); border:1px solid var(--border-color);"></select>';
  h += '<select id="ve-mount-tq-applyDir" style="padding:4px; font-size:0.62rem; background:var(--bg-input); color:var(--text-primary); border:1px solid var(--border-color);"><option value="fwd">İleri</option><option value="rev">Geri</option></select>';
  h += '<select id="ve-mount-tq-applyAxis" style="padding:4px; font-size:0.62rem; background:var(--bg-input); color:var(--text-primary); border:1px solid var(--border-color);"><option value="0">Tx</option><option value="1">Ty</option><option value="2">Tz</option></select>';
  h += '<button onclick="veMountApplyTorque()" style="padding:5px 10px; font-size:0.62rem; background:var(--accent-primary); color:#fff; border:none; cursor:pointer;">Yük durumuna uygula</button>';
  h += '</div>';
  h += '<div style="font-size:0.52rem; color:var(--text-muted); margin-top:5px; line-height:1.4;">φ_axle = (aks payı)/(toplam pay). İleri → ön pay, geri → arka pay. Uygulama seçili durumun ilgili T eksenine <b>−T_shaft</b> yazar (reaksiyon momenti).</div>';
  h += '</div>';
  return h;
}
function _mntSectionGlobal(d){
  var h = '<div style="margin-bottom:8px;">';
  h += _mntSectionTitle('Genel');
  h += '<div style="display:flex; align-items:center; gap:8px; font-size:0.64rem;">';
  h += '<label style="color:var(--text-secondary);">Yerçekimi g [m/s²]</label>';
  h += '<input type="number" id="ve-mount-g" value="'+_mntNum(d.g,9.81)+'" step="0.01" oninput="veMountReadGlobal()" style="width:90px; padding:4px; font-size:0.64rem; background:var(--bg-input); color:var(--text-primary); border:1px solid var(--border-color); text-align:right;">';
  h += '</div></div>';
  return h;
}

// ─── Satır kurucular (editable) ──────────────────────────────────────────────
function _mntCellInput(cls, val, w){
  return '<td style="padding:2px 3px; border:1px solid var(--border-color);"><input class="'+cls+'" value="'+(val===undefined||val===null?'':_mntEsc(val))+'" onchange="veMountReadTables()" style="width:'+(w||46)+'px; padding:3px; font-size:0.6rem; background:var(--bg-input); color:var(--text-primary); border:1px solid var(--border-color); text-align:right;"></td>';
}
function _mntCompRowHTML(c, i){
  var typeOpts = [['motor','Motor'],['transmission','Şanzıman'],['shaft','Şaft'],['bracket','Braket'],['other','Diğer']]
    .map(function(o){ return '<option value="'+o[0]+'"'+((c.type||'other')===o[0]?' selected':'')+'>'+o[1]+'</option>'; }).join('');
  var h = '<tr>';
  h += '<td style="padding:2px 3px; border:1px solid var(--border-color);"><input class="mc-name" value="'+_mntEsc(c.name||'')+'" onchange="veMountReadTables()" style="width:78px; padding:3px; font-size:0.6rem; background:var(--bg-input); color:var(--text-primary); border:1px solid var(--border-color);"></td>';
  h += '<td style="padding:2px 3px; border:1px solid var(--border-color);"><select class="mc-type" onchange="veMountReadTables()" style="padding:3px; font-size:0.58rem; background:var(--bg-input); color:var(--text-primary); border:1px solid var(--border-color);">'+typeOpts+'</select></td>';
  h += _mntCellInput('mc-mass', c.mass, 54);
  h += _mntCellInput('mc-cgx', c.cgx); h += _mntCellInput('mc-cgy', c.cgy); h += _mntCellInput('mc-cgz', c.cgz);
  h += _mntCellInput('mc-Ixx', c.Ixx); h += _mntCellInput('mc-Iyy', c.Iyy); h += _mntCellInput('mc-Izz', c.Izz);
  h += _mntCellInput('mc-Ixy', c.Ixy); h += _mntCellInput('mc-Ixz', c.Ixz); h += _mntCellInput('mc-Iyz', c.Iyz);
  h += '<td style="padding:2px; border:1px solid var(--border-color); text-align:center;"><input type="checkbox" class="mc-pm" '+(c.pointMass?'checked':'')+' onchange="veMountReadTables()"></td>';
  h += '<td style="padding:2px; border:1px solid var(--border-color); text-align:center;"><button onclick="veMountDelComponent('+i+')" title="Sil" style="background:none; border:none; color:var(--accent-danger); cursor:pointer; font-size:0.75rem;">✕</button></td>';
  h += '</tr>';
  return h;
}
function _mntMountRowHTML(m, i){
  var h = '<tr>';
  h += '<td style="padding:2px 3px; border:1px solid var(--border-color);"><input class="mm-name" value="'+_mntEsc(m.name||'')+'" onchange="veMountReadTables()" style="width:74px; padding:3px; font-size:0.6rem; background:var(--bg-input); color:var(--text-primary); border:1px solid var(--border-color);"></td>';
  h += _mntCellInput('mm-x', m.x); h += _mntCellInput('mm-y', m.y); h += _mntCellInput('mm-z', m.z);
  h += _mntCellInput('mm-kxs', m.kxs); h += _mntCellInput('mm-kys', m.kys); h += _mntCellInput('mm-kzs', m.kzs);
  h += _mntCellInput('mm-kxd', m.kxd); h += _mntCellInput('mm-kyd', m.kyd); h += _mntCellInput('mm-kzd', m.kzd);
  h += '<td style="padding:2px; border:1px solid var(--border-color); text-align:center;"><button onclick="veMountDelMount('+i+')" title="Sil" style="background:none; border:none; color:var(--accent-danger); cursor:pointer; font-size:0.75rem;">✕</button></td>';
  h += '</tr>';
  return h;
}
function _mntLCRowHTML(lc, i){
  var h = '<tr>';
  h += '<td style="padding:2px 3px; border:1px solid var(--border-color);"><input class="ml-name" value="'+_mntEsc(lc.name||'')+'" onchange="veMountReadTables()" style="width:96px; padding:3px; font-size:0.6rem; background:var(--bg-input); color:var(--text-primary); border:1px solid var(--border-color);"></td>';
  h += _mntCellInput('ml-nx', lc.nx); h += _mntCellInput('ml-ny', lc.ny); h += _mntCellInput('ml-nz', lc.nz);
  h += _mntCellInput('ml-Tx', lc.Tx, 60); h += _mntCellInput('ml-Ty', lc.Ty, 60); h += _mntCellInput('ml-Tz', lc.Tz, 60);
  h += '<td style="padding:2px; border:1px solid var(--border-color); text-align:center;"><button onclick="veMountDelLoadCase('+i+')" title="Sil" style="background:none; border:none; color:var(--accent-danger); cursor:pointer; font-size:0.75rem;">✕</button></td>';
  h += '</tr>';
  return h;
}

// ─── Render (model → tablolar) ───────────────────────────────────────────────
function veMountRenderTables(){
  var node = _veMountEditorNode; if(!node) return;
  var d = veMountEnsureData(node);
  var cb = document.getElementById('ve-mount-comp-body');
  var mb = document.getElementById('ve-mount-mount-body');
  var lb = document.getElementById('ve-mount-lc-body');
  if(cb) cb.innerHTML = d.components.map(_mntCompRowHTML).join('') || '<tr><td colspan="14" style="padding:6px; text-align:center; color:var(--text-muted); border:1px solid var(--border-color);">Bileşen yok — "+ Bileşen Ekle" veya "Örnek Yükle"</td></tr>';
  if(mb) mb.innerHTML = d.mounts.map(_mntMountRowHTML).join('') || '<tr><td colspan="11" style="padding:6px; text-align:center; color:var(--text-muted); border:1px solid var(--border-color);">Takoz yok</td></tr>';
  if(lb) lb.innerHTML = d.loadCases.map(_mntLCRowHTML).join('') || '<tr><td colspan="8" style="padding:6px; text-align:center; color:var(--text-muted); border:1px solid var(--border-color);">Yük durumu yok</td></tr>';
  _mntFillLibDropdown(d);
  _mntFillApplyCaseDropdown(d);
  veMountRecalcTorque();
}
function _mntFillLibDropdown(d){
  var sel = document.getElementById('ve-mount-lib-sel'); if(!sel) return;
  var lib = _mntAllLibrary(d);
  sel.innerHTML = Object.keys(lib).map(function(k){ return '<option value="'+k+'">'+_mntEsc(lib[k].name)+'</option>'; }).join('');
}
function _mntFillApplyCaseDropdown(d){
  var sel = document.getElementById('ve-mount-tq-applyCase'); if(!sel) return;
  var cur = sel.value;
  sel.innerHTML = d.loadCases.map(function(lc,i){ return '<option value="'+i+'">'+_mntEsc(lc.name)+'</option>'; }).join('');
  if(cur!=='' && cur<d.loadCases.length) sel.value = cur;
}

// ─── Read (tablolar → model) ─────────────────────────────────────────────────
function veMountReadTables(){
  var node = _veMountEditorNode; if(!node) return;
  var d = veMountEnsureData(node);
  var cb = document.getElementById('ve-mount-comp-body');
  var mb = document.getElementById('ve-mount-mount-body');
  var lb = document.getElementById('ve-mount-lc-body');
  if(cb){
    d.components = [].slice.call(cb.querySelectorAll('tr')).map(function(tr){
      var g=function(c){ var el=tr.querySelector(c); return el?el.value:''; };
      var pm=tr.querySelector('.mc-pm');
      if(!tr.querySelector('.mc-name')) return null;
      return { name:g('.mc-name'), type:g('.mc-type'), mass:g('.mc-mass'),
        cgx:g('.mc-cgx'), cgy:g('.mc-cgy'), cgz:g('.mc-cgz'),
        Ixx:g('.mc-Ixx'), Iyy:g('.mc-Iyy'), Izz:g('.mc-Izz'),
        Ixy:g('.mc-Ixy'), Ixz:g('.mc-Ixz'), Iyz:g('.mc-Iyz'),
        pointMass: pm?pm.checked:false };
    }).filter(Boolean);
  }
  if(mb){
    d.mounts = [].slice.call(mb.querySelectorAll('tr')).map(function(tr){
      var g=function(c){ var el=tr.querySelector(c); return el?el.value:''; };
      if(!tr.querySelector('.mm-name')) return null;
      return { name:g('.mm-name'), x:g('.mm-x'), y:g('.mm-y'), z:g('.mm-z'),
        kxs:g('.mm-kxs'), kys:g('.mm-kys'), kzs:g('.mm-kzs'),
        kxd:g('.mm-kxd'), kyd:g('.mm-kyd'), kzd:g('.mm-kzd') };
    }).filter(Boolean);
  }
  if(lb){
    d.loadCases = [].slice.call(lb.querySelectorAll('tr')).map(function(tr){
      var g=function(c){ var el=tr.querySelector(c); return el?el.value:''; };
      if(!tr.querySelector('.ml-name')) return null;
      return { name:g('.ml-name'), nx:g('.ml-nx'), ny:g('.ml-ny'), nz:g('.ml-nz'), Tx:g('.ml-Tx'), Ty:g('.ml-Ty'), Tz:g('.ml-Tz') };
    }).filter(Boolean);
  }
  _mntFillApplyCaseDropdown(d);
  if(typeof veMountViewerUpdate==='function'){ try{ veMountViewerUpdate(); }catch(e){} }
}
function veMountReadGlobal(){
  var node=_veMountEditorNode; if(!node) return;
  var d=veMountEnsureData(node);
  var el=document.getElementById('ve-mount-g'); if(el) d.g=_mntNum(el.value,9.81);
}
function _mntReadTorquePanel(){
  var node=_veMountEditorNode; if(!node) return null;
  var d=veMountEnsureData(node); var t=d.torque;
  var g=function(id,def){ var el=document.getElementById(id); return el?_mntNum(el.value,def):def; };
  t.Te=g('ve-mount-tq-Te',0); t.Rstall=g('ve-mount-tq-Rstall',1); t.iTransfer=g('ve-mount-tq-iTransfer',1);
  t.iGearFwd=g('ve-mount-tq-iGearFwd',1); t.iGearRev=g('ve-mount-tq-iGearRev',-1);
  t.splitFront=g('ve-mount-tq-splitFront',1); t.splitRear=g('ve-mount-tq-splitRear',1); t.derate=g('ve-mount-tq-derate',1);
  return t;
}

// ─── Satır ekle/sil ──────────────────────────────────────────────────────────
function veMountAddComponent(){ var d=veMountEnsureData(_veMountEditorNode); veMountReadTables(); d.components.push({name:'Bileşen '+(d.components.length+1), type:'other', mass:'', cgx:'', cgy:'', cgz:'', Ixx:'', Iyy:'', Izz:'', Ixy:'', Ixz:'', Iyz:'', pointMass:false}); veMountRenderTables(); }
function veMountDelComponent(i){ var d=veMountEnsureData(_veMountEditorNode); veMountReadTables(); d.components.splice(i,1); veMountRenderTables(); veMountCompute(); }
function veMountAddMount(){ var d=veMountEnsureData(_veMountEditorNode); veMountReadTables(); d.mounts.push({name:'Takoz '+(d.mounts.length+1), x:'', y:'', z:'', kxs:'', kys:'', kzs:'', kxd:'', kyd:'', kzd:''}); veMountRenderTables(); }
function veMountAddMountFromLib(){
  var d=veMountEnsureData(_veMountEditorNode); veMountReadTables();
  var sel=document.getElementById('ve-mount-lib-sel'); if(!sel) return;
  var lib=_mntAllLibrary(d); var m=lib[sel.value]; if(!m) return;
  d.mounts.push({name:m.name+' '+(d.mounts.length+1), x:'', y:'', z:'', kxs:m.sx, kys:m.sy, kzs:m.sz, kxd:m.dx, kyd:m.dy, kzd:m.dz});
  veMountRenderTables();
}
function veMountDelMount(i){ var d=veMountEnsureData(_veMountEditorNode); veMountReadTables(); d.mounts.splice(i,1); veMountRenderTables(); veMountCompute(); }
function veMountAddLoadCase(){ var d=veMountEnsureData(_veMountEditorNode); veMountReadTables(); d.loadCases.push({name:'Durum '+(d.loadCases.length+1), nx:0, ny:0, nz:-1, Tx:0, Ty:0, Tz:0}); veMountRenderTables(); }
function veMountDelLoadCase(i){ var d=veMountEnsureData(_veMountEditorNode); veMountReadTables(); d.loadCases.splice(i,1); veMountRenderTables(); veMountCompute(); }

// ─── TTAR örneği yükle ───────────────────────────────────────────────────────
function veMountLoadTTAR(){
  var node=_veMountEditorNode; if(!node) return;
  var d=veMountEnsureData(node);
  var EX = veMountCore.TTAR_EXAMPLE;
  d.g = EX.g;
  d.components = EX.components.map(function(c){
    return { name:c.name, type:(/motor/i.test(c.name)?'motor':/şanz|sanz/i.test(c.name)?'transmission':/şaft|saft|shaft/i.test(c.name)?'shaft':/cradle|braket/i.test(c.name)?'bracket':'other'),
      mass:c.mass, cgx:c.cg[0], cgy:c.cg[1], cgz:c.cg[2],
      Ixx:c.Ixx, Iyy:c.Iyy, Izz:c.Izz, Ixy:c.Ixy, Ixz:c.Ixz, Iyz:c.Iyz, pointMass:!!c.pointMass };
  });
  d.mounts = EX.mounts.map(function(m){
    return { name:m.name, x:m.pos[0], y:m.pos[1], z:m.pos[2],
      kxs:m.kstat[0], kys:m.kstat[1], kzs:m.kstat[2], kxd:m.kdyn[0], kyd:m.kdyn[1], kzd:m.kdyn[2] };
  });
  d.loadCases = EX.loadCases.map(function(lc){ return { name:lc.name, nx:lc.n[0], ny:lc.n[1], nz:lc.n[2], Tx:lc.T[0], Ty:lc.T[1], Tz:lc.T[2] }; });
  var tq = EX.torque;
  d.torque = { Te:tq.Te, Rstall:tq.Rstall, iTransfer:tq.iTransfer, iGearFwd:tq.fwd.iGear, iGearRev:tq.rev.iGear,
    splitFront:1, splitRear:2.6, derate:tq.derate };
  // Editörü tazele
  var modal=document.getElementById('ve-mount-editor-modal');
  if(modal){ modal.querySelector('#ve-mount-tq-Te'); }
  // Tork panelini yeniden kur (değerler değişti)
  var body=document.querySelector('#ve-mount-editor-modal');
  if(body){
    // Sol paneli tekrar bas (tork input value'ları güncellensin)
    var left = body.children[1] && body.children[1].children[0];
  }
  veMountRebuildInputs(d);
  veMountRenderTables();
  veMountCompute();
  if(typeof veMountViewerUpdate==='function'){ try{ veMountViewerUpdate(); }catch(e){} }
  if(typeof showToast==='function') showToast('TTAR doğrulama seti yüklendi (5 bileşen, 6 takoz, 8 yük durumu).', 'success');
}
// Tork/genel input value'larını yeniden basmak için sol paneli yeniden kur.
function veMountRebuildInputs(d){
  var modal=document.getElementById('ve-mount-editor-modal'); if(!modal) return;
  var bodyRow = modal.querySelector('div[style*="flex-direction:row"]');
  if(!bodyRow) return;
  var left = bodyRow.children[0];
  if(left) left.innerHTML = _mntSectionComponents()+_mntSectionMounts()+_mntSectionLoadCases()+_mntSectionTorque(d)+_mntSectionGlobal(d);
}

// ─── Tork zinciri hesabı + uygula (SPEC 4.5) ─────────────────────────────────
function veMountRecalcTorque(){
  var t=_mntReadTorquePanel(); if(!t) return;
  var total = _mntNum(t.splitFront) + _mntNum(t.splitRear);
  var totEl=document.getElementById('ve-mount-tq-splitTotal'); if(totEl) totEl.textContent = total? total.toFixed(3):'—';
  var phiFwd = total? _mntNum(t.splitFront)/total : 0;
  var phiRev = total? _mntNum(t.splitRear)/total : 0;
  var Tfwd = veMountCore.torqueChain({Te:t.Te, Rstall:t.Rstall, iGear:t.iGearFwd, iTransfer:t.iTransfer, phiAxle:phiFwd, derate:t.derate});
  var Trev = veMountCore.torqueChain({Te:t.Te, Rstall:t.Rstall, iGear:t.iGearRev, iTransfer:t.iTransfer, phiAxle:phiRev, derate:t.derate});
  var fEl=document.getElementById('ve-mount-tq-Tfwd'), rEl=document.getElementById('ve-mount-tq-Trev');
  if(fEl) fEl.textContent = Number.isFinite(Tfwd)? Tfwd.toFixed(1):'—';
  if(rEl) rEl.textContent = Number.isFinite(Trev)? Trev.toFixed(1):'—';
  return {Tfwd:Tfwd, Trev:Trev};
}
function veMountApplyTorque(){
  var node=_veMountEditorNode; if(!node) return;
  var d=veMountEnsureData(node);
  veMountReadTables();
  var res=veMountRecalcTorque(); if(!res) return;
  var caseEl=document.getElementById('ve-mount-tq-applyCase');
  var dirEl=document.getElementById('ve-mount-tq-applyDir');
  var axisEl=document.getElementById('ve-mount-tq-applyAxis');
  var ci=parseInt(caseEl?caseEl.value:'0')||0;
  var dir=dirEl?dirEl.value:'fwd';
  var axis=parseInt(axisEl?axisEl.value:'0')||0;
  if(!d.loadCases[ci]) return;
  var Tshaft = (dir==='rev')? res.Trev : res.Tfwd;
  var val = -Tshaft;   // reaksiyon: ileri viteste Tx=−T_fwd (SPEC 4.5, TTAR T5)
  var key = ['Tx','Ty','Tz'][axis];
  d.loadCases[ci][key] = Math.round(val*100)/100;
  veMountRenderTables();
  veMountCompute();
  if(typeof showToast==='function') showToast('"'+d.loadCases[ci].name+'" durumuna '+key+' = '+d.loadCases[ci][key]+' N·m uygulandı.', 'info');
}

// ════════════════════════════════════════════════════════════════════════════
//  HESAPLA — çekirdeği çağır, sonuçları render et
// ════════════════════════════════════════════════════════════════════════════
function veMountCompute(){
  var node=_veMountEditorNode; if(!node) return;
  veMountReadTables(); veMountReadGlobal(); _mntReadTorquePanel();
  var d=veMountEnsureData(node);
  var out=document.getElementById('ve-mount-results'); if(!out) return;
  var C=veMountCore;
  var si=_mntToSI(d);

  var problems=C.validateModel(si.components, si.mounts);
  var html='';
  if(problems.length){
    html += '<div style="padding:10px 12px; background:rgba(239,68,68,0.12); border:1px solid var(--accent-danger); color:var(--accent-danger); font-size:0.68rem; margin-bottom:10px;">'
          + '<b>Validasyon ('+problems.length+'):</b><ul style="margin:6px 0 0 16px; padding:0;">'
          + problems.map(function(p){ return '<li>'+_mntEsc(p)+'</li>'; }).join('') + '</ul></div>';
    out.innerHTML = html;
    return;
  }

  var mp=C.combineMassProps(si.components);
  if(!mp){ out.innerHTML='<div style="color:var(--accent-danger); font-size:0.7rem;">Kütle özellikleri hesaplanamadı (toplam kütle ≤ 0).</div>'; return; }

  // ── Kütle özeti ──
  var cgmm=mp.cg.map(function(v){return v*1000;});
  html += _mntSectionTitle('Kütle Özeti');
  html += '<table style="width:100%; border-collapse:collapse; font-size:0.64rem; margin-bottom:12px;">';
  html += '<tr><th style="'+_mntTh()+'">Toplam Kütle m</th><td style="'+_mntTd()+'">'+_mntFmt(mp.m,3)+' kg</td></tr>';
  html += '<tr><th style="'+_mntTh()+'">Birleşik CG (mm)</th><td style="'+_mntTd()+'">('+_mntFmt(cgmm[0],2)+', '+_mntFmt(cgmm[1],2)+', '+_mntFmt(cgmm[2],2)+')</td></tr>';
  html += '<tr><th style="'+_mntTh()+'">Atalet I_G (kg·m²)</th><td style="'+_mntTd()+' font-family:monospace; font-size:0.56rem; white-space:pre;">'+_mntInertiaText(mp.I_G)+'</td></tr>';
  html += '</table>';
  html += '<button onclick="veMountCopyResults()" style="padding:5px 10px; font-size:0.62rem; background:var(--bg-tertiary); color:var(--text-primary); border:1px solid var(--border-color); cursor:pointer; margin:0 6px 10px 0;">📋 Kopyala</button>';
  html += '<button onclick="veMountExportCSV()" style="padding:5px 10px; font-size:0.62rem; background:var(--bg-tertiary); color:var(--text-primary); border:1px solid var(--border-color); cursor:pointer; margin-bottom:10px;">⬇ CSV</button>';

  // ── Statik matris (tüm yük durumları) ──
  var model={ m:mp.m, cg:mp.cg, Kstat:C.buildK(si.mounts, mp.cg, false), mounts:si.mounts, g:si.g };
  var allCases=C.solveAllCases(model, si.loadCases);
  _veMountLastResults={ mp:mp, allCases:allCases, mounts:si.mounts, mode:d.matrixMode };
  html += _mntStaticMatrixHTML(allCases, si.mounts, d.matrixMode);

  // ── Modal ──
  var Kdyn=C.buildK(si.mounts, mp.cg, true);
  var M6=C.buildM6(mp.m, mp.I_G);
  var modes=C.solveModal(Kdyn, M6, si.mounts, mp.cg);
  html += _mntModalHTML(modes);

  out.innerHTML = html;
}

function _mntTh(){ return 'padding:5px 8px; text-align:left; background:var(--bg-tertiary); border:1px solid var(--border-color); font-weight:500; color:var(--text-secondary); width:38%;'; }
function _mntTd(){ return 'padding:5px 8px; border:1px solid var(--border-color); color:var(--text-primary); font-weight:600;'; }
function _mntInertiaText(I){
  var f=function(x){ return (Number.isFinite(x)?x.toFixed(3):'—'); };
  return '['+f(I[0][0])+', '+f(I[0][1])+', '+f(I[0][2])+']\n['+f(I[1][0])+', '+f(I[1][1])+', '+f(I[1][2])+']\n['+f(I[2][0])+', '+f(I[2][1])+', '+f(I[2][2])+']';
}

// Statik çökme matrisi — satır=yük durumu, sütun=takoz×{δx,δy,δz} veya kuvvet.
function _mntStaticMatrixHTML(allCases, mounts, mode){
  var isForce = (mode==='force');
  var h = '<div style="display:flex; align-items:center; gap:8px; margin:4px 0 8px; font-size:0.78rem; font-weight:700; color:var(--text-heading); border-bottom:1px solid var(--border-color); padding-bottom:5px;">'
        + '<span>Statik Çökme Matrisi</span>'
        + '<span style="font-size:0.55rem; font-weight:400; color:var(--text-muted);">'+(isForce?'kuvvet kN':'sehim mm')+' · |δ|>10mm ve çekme işaretli</span>'
        + '<div style="flex:1;"></div>'
        + '<button onclick="veMountToggleMatrix()" style="padding:3px 8px; font-size:0.58rem; background:var(--bg-tertiary); color:var(--text-primary); border:1px solid var(--border-color); cursor:pointer;">'+(isForce?'→ Sehim':'→ Kuvvet')+'</button>'
        + '</div>';
  h += '<div style="overflow-x:auto; margin-bottom:12px;"><table style="border-collapse:collapse; font-size:0.56rem; white-space:nowrap;"><thead>';
  // İki satırlı başlık: takoz adı (colspan 3) + x/y/z
  h += '<tr style="background:var(--bg-tertiary);"><th rowspan="2" style="'+_mntMxTh()+' position:sticky; left:0;">Yük Durumu</th>';
  mounts.forEach(function(m){ h += '<th colspan="3" style="'+_mntMxTh()+'">'+_mntEsc(m.name)+'</th>'; });
  h += '<th rowspan="2" style="'+_mntMxTh()+'">ΣFz</th><th rowspan="2" style="'+_mntMxTh()+'">Çekme</th></tr>';
  h += '<tr style="background:var(--bg-tertiary);">';
  mounts.forEach(function(){ ['x','y','z'].forEach(function(a){ h += '<th style="'+_mntMxTh()+'">'+a+'</th>'; }); });
  h += '</tr></thead><tbody>';
  allCases.forEach(function(rc){
    h += '<tr>';
    h += '<td style="'+_mntMxTd()+' text-align:left; font-weight:600; position:sticky; left:0; background:var(--bg-secondary);">'+_mntEsc(rc.name)+'</td>';
    if(!rc.res){
      h += '<td colspan="'+(mounts.length*3+2)+'" style="'+_mntMxTd()+' color:var(--accent-danger);">'+_mntEsc(rc.error||'çözülemedi')+'</td></tr>';
      return;
    }
    rc.res.perMount.forEach(function(pm){
      for(var a=0;a<3;a++){
        var val = isForce ? (pm.f[a]/1000) : (pm.delta[a]*1000);
        var color = isForce ? _mntForceColor(val) : _mntDeflColor(val);
        var mark = '';
        if(a===2 && pm.tension) mark = ' style="outline:2px solid #a855f7; outline-offset:-2px;"';    // çekme
        var warn = (!isForce && pm.overLinear) ? 'text-decoration:underline wavy '+color+';' : '';
        h += '<td style="'+_mntMxTd()+' color:'+color+'; font-weight:600;'+warn+'"'+mark+'>'+val.toFixed(isForce?2:2)+'</td>';
      }
    });
    var chk = rc.res.checks;
    h += '<td style="'+_mntMxTd()+'">'+(chk.sumFzOk?'<span style="color:#22c55e;">✓</span>':'<span style="color:#ef4444;">✗</span>')+' '+(rc.res.sumF[2]/1000).toFixed(1)+'</td>';
    h += '<td style="'+_mntMxTd()+' color:'+(chk.tensionCount?'#a855f7':'var(--text-muted)')+'; font-weight:600;">'+chk.tensionCount+'</td>';
    h += '</tr>';
  });
  h += '</tbody></table></div>';
  return h;
}
function _mntMxTh(){ return 'padding:3px 6px; border:1px solid var(--border-color); color:var(--text-secondary); font-weight:600; text-align:center;'; }
function _mntMxTd(){ return 'padding:3px 6px; border:1px solid var(--border-color); text-align:center; color:var(--text-primary);'; }

function _mntModalHTML(modes){
  var h = _mntSectionTitle('Modal Analiz', '6 rijit gövde modu · K_dyn · mod şekli normalize');
  if(!modes){ return h + '<div style="color:var(--accent-danger); font-size:0.68rem;">Modal çözüm başarısız (M SPD değil / Cholesky başarısız).</div>'; }
  h += '<div style="overflow-x:auto;"><table style="border-collapse:collapse; font-size:0.58rem; white-space:nowrap;"><thead><tr style="background:var(--bg-tertiary);">';
  ['Mod','f [Hz]','Etiket','ux','uy','uz','θx','θy','θz'].forEach(function(c){ h += '<th style="'+_mntMxTh()+'">'+c+'</th>'; });
  h += '</tr></thead><tbody>';
  modes.forEach(function(md,i){
    h += '<tr'+(md.warning?' title="'+_mntEsc(md.warning)+'"':'')+'>';
    h += '<td style="'+_mntMxTd()+' font-weight:600;">'+(i+1)+'</td>';
    h += '<td style="'+_mntMxTd()+' font-weight:600; color:var(--accent-primary);">'+_mntFmt(md.f_Hz,3)+'</td>';
    h += '<td style="'+_mntMxTd()+' text-align:left; color:'+(md.warning?'#f59e0b':'var(--text-primary)')+';">'+_mntEsc(md.label)+'</td>';
    md.phi.forEach(function(v){
      var op = Math.min(1, Math.abs(v));
      h += '<td style="'+_mntMxTd()+'"><span style="opacity:'+(0.35+0.65*op)+';">'+v.toFixed(2)+'</span></td>';
    });
    h += '</tr>';
  });
  h += '</tbody></table></div>';
  h += '<div style="font-size:0.52rem; color:var(--text-muted); margin-top:5px;">Etiket: baskın hareket (bounce/pitch/roll/fore-aft/lateral/yaw). ⚠ = sıfıra yakın frekans (serbest mod).</div>';
  return h;
}

function veMountToggleMatrix(){
  var node=_veMountEditorNode; if(!node) return;
  var d=veMountEnsureData(node);
  d.matrixMode = (d.matrixMode==='force')?'delta':'force';
  veMountCompute();
}

// ─── Kopyala / CSV ───────────────────────────────────────────────────────────
var _veMountLastResults = null;
function _mntResultsToText(){
  var R=_veMountLastResults; if(!R) return '';
  var t='TAKOZ ÇÖKME-TİTREŞİM ANALİZİ\n============================\n\n';
  var cg=R.mp.cg.map(function(v){return (v*1000).toFixed(3);});
  t+='Kütle: '+R.mp.m.toFixed(3)+' kg\nCG (mm): ('+cg.join(', ')+')\n';
  t+='I_G (kg·m²):\n'+_mntInertiaText(R.mp.I_G)+'\n\nSTATİK ÇÖKME (δz, mm):\n';
  R.allCases.forEach(function(rc){
    if(!rc.res){ t+=rc.name+': '+(rc.error||'çözülemedi')+'\n'; return; }
    t+=rc.name+': '+rc.res.perMount.map(function(pm){return pm.delta[2]*1000<0?(pm.delta[2]*1000).toFixed(2):'+'+(pm.delta[2]*1000).toFixed(2);}).join(' / ')
      +'  [ΣFz='+(rc.res.sumF[2]/1000).toFixed(2)+' kN, çekme='+rc.res.checks.tensionCount+']\n';
  });
  return t;
}
function veMountCopyResults(){
  var txt=_mntResultsToText();
  if(navigator.clipboard && navigator.clipboard.writeText){ navigator.clipboard.writeText(txt).then(function(){ if(typeof showToast==='function') showToast('Sonuçlar kopyalandı.','success'); }); }
  else { var ta=document.createElement('textarea'); ta.value=txt; document.body.appendChild(ta); ta.select(); try{document.execCommand('copy');}catch(e){} ta.remove(); if(typeof showToast==='function') showToast('Sonuçlar kopyalandı.','success'); }
}
function veMountExportCSV(){
  var R=_veMountLastResults; if(!R){ return; }
  var rows=[]; var head=['LoadCase'];
  R.mounts.forEach(function(m){ head.push(m.name+' δx',m.name+' δy',m.name+' δz'); });
  head.push('SumFz_kN','TensionCount'); rows.push(head.join(','));
  R.allCases.forEach(function(rc){
    if(!rc.res){ rows.push(rc.name+',ERROR'); return; }
    var r=[rc.name];
    rc.res.perMount.forEach(function(pm){ r.push((pm.delta[0]*1000).toFixed(3),(pm.delta[1]*1000).toFixed(3),(pm.delta[2]*1000).toFixed(3)); });
    r.push((rc.res.sumF[2]/1000).toFixed(3), rc.res.checks.tensionCount);
    rows.push(r.join(','));
  });
  var blob=new Blob([rows.join('\n')],{type:'text/csv'});
  var a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download='takoz_cokme_matrisi.csv'; a.click();
  setTimeout(function(){ URL.revokeObjectURL(a.href); }, 500);
}

// ════════════════════════════════════════════════════════════════════════════
//  SELF-TEST (SPEC 6) — çekirdek selfTest'i çalıştır, sonucu modalda göster
// ════════════════════════════════════════════════════════════════════════════
function veMountRunSelfTest(){
  var r = veMountCore.selfTest();
  var h = '<div style="font-size:0.72rem;">';
  h += '<div style="font-weight:700; margin-bottom:10px; color:'+(r.failed===0?'#22c55e':'#ef4444')+';">'
     + (r.failed===0?'✓ TÜM TESTLER GEÇTİ':'✗ '+r.failed+' TEST BAŞARISIZ')
     + ' <span style="color:var(--text-muted); font-weight:400;">('+r.passed+' geçti / '+r.failed+' kaldı)</span></div>';
  h += '<table style="width:100%; border-collapse:collapse; font-size:0.62rem;"><thead><tr style="background:var(--bg-tertiary);">'
     + '<th style="'+_mntMxTh()+'">Test</th><th style="'+_mntMxTh()+'">Ad</th><th style="'+_mntMxTh()+'">Sonuç</th></tr></thead><tbody>';
  r.details.forEach(function(dt){
    h += '<tr><td style="'+_mntMxTd()+' font-weight:600;">'+_mntEsc(dt.id)+'</td>'
       + '<td style="'+_mntMxTd()+' text-align:left;">'+_mntEsc(dt.name)+'<div style="font-size:0.52rem; color:var(--text-muted); white-space:normal; max-width:520px;">'+_mntEsc(dt.detail)+'</div></td>'
       + '<td style="'+_mntMxTd()+'">'+(dt.ok?'<span style="color:#22c55e;">✓</span>':'<span style="color:#ef4444;">✗</span>')+'</td></tr>';
  });
  h += '</tbody></table></div>';
  _mntShowModal('🧪 Self-Test — Kabul Testleri (Adams TTAR)', h);
}

// ════════════════════════════════════════════════════════════════════════════
//  MATEMATİK MODALI (SPEC 7.7)
// ════════════════════════════════════════════════════════════════════════════
function veMountOpenMathModal(){
  _mntShowModal('📐 Takoz Modülünün Matematiği', _mntMathHTML());
}
function _mntMathHTML(){
  var eq='background:var(--bg-secondary); border:1px solid var(--border-color); padding:8px 12px; margin:6px 0; font-family:monospace; font-size:0.66rem; white-space:pre-wrap; overflow-x:auto;';
  var st='font-weight:700; color:var(--text-heading); margin:14px 0 4px; font-size:0.82rem;';
  var tx='font-size:0.68rem; line-height:1.55; color:var(--text-secondary); margin:4px 0;';
  var h='<div style="max-width:760px;">';
  h+='<div style="'+st+'">0. Model ve varsayımlar</div>';
  h+='<div style="'+tx+'">Güç grubu (motor + şanzıman + rijit bağlı elemanlar) <b>tek rijit gövde</b>; şasiye N adet üç eksenli lineer yay (takoz) ile bağlı. 6 SD: 3 öteleme + 3 dönme. Varsayımlar: küçük dönmeler, lineer yaylar, rijit şasi, sönümsüz modal, quasi-statik yükler. Lineer model ±10 mm sehim bandında Adams ile birebir.</div>';
  h+='<div style="'+st+'">1. Koordinatlar (referans: birleşik CG)</div>';
  h+='<div style="'+eq+'">q = [ ux, uy, uz, θx, θy, θz ]   (öteleme m, dönme rad)</div>';
  h+='<div style="'+tx+'">Referans nokta <b>birleşik ağırlık merkezi G</b>. Bu seçim kütle matrisini blok köşegen yapar.</div>';
  h+='<div style="'+st+'">2. Takoz kinematiği</div>';
  h+='<div style="'+eq+'">d = r_mount − c_G\nδ = u + θ × d = A·q ,   A = [ E3 | −skew(d) ]\nskew(d) = [[0,−dz,dy],[dz,0,−dx],[−dy,dx,0]]</div>';
  h+='<div style="'+st+'">3. Rijitlik ve kütle matrisi</div>';
  h+='<div style="'+eq+'">K = Σ Aᵢᵀ · diag(kx,ky,kz)ᵢ · Aᵢ      (6×6, simetrik, poz. tanımlı)\nM6 = blockdiag( m·E3 , I_G )\nI_G = Σ [ Iⱼ + mⱼ((dⱼ·dⱼ)E3 − dⱼdⱼᵀ) ]   (paralel eksen)</div>';
  h+='<div style="'+tx+'">İki K kurulur: <b>K_stat</b> (statik çözümler) ve <b>K_dyn</b> (modal). Atalet çarpım terimleri CATIA tensör bileşeni konvansiyonunda.</div>';
  h+='<div style="'+st+'">4. Statik çözüm (yük durumu başına)</div>';
  h+='<div style="'+eq+'">F = [ m·g·nx, m·g·ny, m·g·nz, Tx, Ty, Tz ]   (nz yerçekimi DAHİL)\nq = K_stat⁻¹ · F     (kısmi pivotlu Gauss)\nδᵢ = Aᵢ·q ,   fᵢ = kᵢ(stat)·δᵢ\nKontrol: Σfz = −m·g   ;   çekme (lift-off): δz > +0.01 mm</div>';
  h+='<div style="'+st+'">5. Tork zinciri</div>';
  h+='<div style="'+eq+'">T_shaft = Te·R_stall·i_gear·i_transfer·φ_axle·derate\nφ_axle = (aks payı)/(toplam pay)   ;   reaksiyon: Tx = −T_shaft</div>';
  h+='<div style="'+st+'">6. Modal analiz</div>';
  h+='<div style="'+eq+'">(K_dyn − ω²·M6)·φ = 0\n1) M6 = L·Lᵀ (Cholesky)   2) Kp = L⁻¹·K_dyn·L⁻ᵀ\n3) Jacobi özdeğer   4) φ = L⁻ᵀ·y (max bileşene normalize)\nf_r = √λ_r / 2π   (artan sırada 6 mod)</div>';
  h+='<div style="'+tx+'">Mod etiketleme geometri duyarlıdır: dönme katkısı a_axis = RMS(|e_axis × dᵢ|) ile eşdeğer yer değiştirmeye çevrilir; baskın öteleme (fore-aft/lateral/bounce) veya dönme (roll/pitch/yaw) etiketi atanır (eşik 2.2, arada bileşik etiket).</div>';
  h+='<div style="'+tx+'; color:var(--text-muted); margin-top:12px; border-top:1px solid var(--border-color); padding-top:8px;">Doğrulama: Adams BMC_TTAR_2031 (8×8 TTAR güç grubu). Kabul testleri T1–T8 (Self-Test) referans değerlerle ±tolerans içinde eşleşir.</div>';
  h+='</div>';
  return h;
}

// Genel amaçlı iç modal (self-test / matematik).
function _mntShowModal(title, innerHTML){
  var old=document.getElementById('ve-mount-submodal'); if(old) old.remove();
  var ov=document.createElement('div');
  ov.id='ve-mount-submodal';
  ov.style.cssText='position:fixed; inset:0; z-index:100010; background:rgba(0,0,0,0.6); display:flex; align-items:center; justify-content:center; padding:20px;';
  ov.addEventListener('mousedown', function(e){ if(e.target===ov) ov.remove(); });
  var box=document.createElement('div');
  box.style.cssText='max-width:840px; width:92%; max-height:88vh; overflow-y:auto; background:var(--bg-secondary); border:1px solid var(--border-color); box-shadow:0 20px 60px rgba(0,0,0,0.6);';
  box.innerHTML='<div style="display:flex; align-items:center; padding:12px 16px; border-bottom:1px solid var(--border-color); background:var(--bg-tertiary); position:sticky; top:0;">'
    +'<span style="font-weight:700; font-size:0.88rem; color:var(--text-heading);">'+title+'</span><div style="flex:1;"></div>'
    +'<button onclick="this.closest(\'#ve-mount-submodal\').remove()" style="background:none; border:none; color:var(--text-muted); cursor:pointer; font-size:1.1rem;">✕</button></div>'
    +'<div style="padding:16px;">'+innerHTML+'</div>';
  ov.appendChild(box); document.body.appendChild(ov);
}

// Eski stub (geri uyum): editörü açar.
function veMountAnalysisCompute(nodeId){ veMountOpenEditor(nodeId); }

// Node/Jest için dışa aç (tarayıcıda global).
if(typeof module!=='undefined' && module.exports){
  module.exports = {
    getMountAnalysisPropertiesHTML: getMountAnalysisPropertiesHTML,
    veMountDefaultData: veMountDefaultData,
    veMountEnsureData: veMountEnsureData,
    VE_MOUNT_LIBRARY: VE_MOUNT_LIBRARY,
    _mntToSI: _mntToSI,
    _mntDeflColor: _mntDeflColor,
    _mntForceColor: _mntForceColor
  };
}
