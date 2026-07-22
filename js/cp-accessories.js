// ============================================================================
// AKSESUARLAR — Klima Kompresörü / Alternatör / Hava Kompresörü
// ============================================================================
// Motor'a (type 'engine') bağlanan, devire bağlı güç çeken yardımcı ekipmanlar.
// Her biri ayrı bir düğüm; Motor kutusunun ÖN (sol) tarafındaki üç porttan
// birine bağlanır. Bağlanınca Motor'un aksesuar-kayıp modeli bu düğümdeki
// devir–kW eğrisiyle güncellenir (bkz. veSyncEngineAccessories).
//
// Fizik: aksesuar, motordan bir tahrik oranı (driveRatio) ile döner
//   aksesuar_devri = motor_devri × driveRatio
// Güç, aksesuarın kendi devrindeki eğriden okunur; krank torkuna çevrilir:
//   T_kayıp = P_kW × 9550 / motor_devri
// Net motor torku = brüt − Σ(aksesuar kayıp torkları).
//
// Veri kaynağı: BMC GG Matrisi (Alternator / AC Cond. / Air Comp. sayfaları,
// tahrik oranları Vehicle Performance sayfası). Eğriler ölçülmüş kW değerleri.
// ============================================================================

// ── Preset kütüphaneleri: her giriş { name, driveRatio, curve:[{rpm,kw}] } ──
// curve.rpm = AKSESUARIN kendi devri (motor devri değil). kw = çekilen güç.

var VE_ALTERNATOR_PRESETS = {
  'prestolite_180a': {
    name: 'Prestolite 180A', driveRatio: 3.15,
    curve: [
      {rpm:1500,kw:0.5},{rpm:2000,kw:3.3},{rpm:3000,kw:6.0},{rpm:4000,kw:7.2},
      {rpm:5000,kw:8.0},{rpm:6000,kw:8.5},{rpm:7000,kw:9.0},{rpm:8000,kw:9.6},{rpm:9000,kw:10.2}
    ]
  },
  'tepas_350a': {
    name: 'Tepaş 350A', driveRatio: 3.15,
    curve: [
      {rpm:1500,kw:0.0},{rpm:2000,kw:5.7},{rpm:3000,kw:10.1},{rpm:4000,kw:12.1},
      {rpm:5000,kw:13.2},{rpm:6000,kw:14.1},{rpm:7000,kw:14.7},{rpm:8000,kw:15.4}
    ]
  }
};

var VE_AC_PRESETS = {
  'valeo_tm21': {
    name: 'Valeo TM21', driveRatio: 1.25,
    curve: [
      {rpm:850,kw:1.38},{rpm:1000,kw:2.0},{rpm:2000,kw:4.0},{rpm:3000,kw:6.1},{rpm:4000,kw:7.7},
      {rpm:5000,kw:8.4},{rpm:6000,kw:9.0},{rpm:7000,kw:9.5},{rpm:8000,kw:10.0},{rpm:9000,kw:10.4}
    ]
  },
  'valeo_tm31': {
    name: 'Valeo TM31', driveRatio: 1.25,
    curve: [
      {rpm:850,kw:1.38},{rpm:1000,kw:2.52},{rpm:2000,kw:5.85},{rpm:3000,kw:8.5},{rpm:4000,kw:10.5},
      {rpm:5000,kw:12.5},{rpm:6000,kw:14.0},{rpm:7000,kw:15.0},{rpm:8000,kw:16.0},{rpm:9000,kw:16.7}
    ]
  }
};

var VE_AIRCOMP_PRESETS = {
  'knorr_225': { name:'Knorr 225cc @10bar', driveRatio:1.0, curve:[{rpm:500,kw:0.6},{rpm:1000,kw:1.3},{rpm:1500,kw:2.0},{rpm:2000,kw:2.9},{rpm:2500,kw:3.7},{rpm:3000,kw:4.5}] },
  'wabco_250': { name:'Wabco 250cc @8.5bar', driveRatio:1.0, curve:[{rpm:500,kw:0.4},{rpm:1000,kw:1.3},{rpm:1500,kw:2.2},{rpm:2000,kw:3.1},{rpm:2500,kw:4.0},{rpm:3000,kw:4.4}] },
  'wabco_318': { name:'Wabco 318cc @8.5bar', driveRatio:1.0, curve:[{rpm:500,kw:0.7},{rpm:1000,kw:1.6},{rpm:1500,kw:2.6},{rpm:2000,kw:3.9},{rpm:2500,kw:5.1},{rpm:3000,kw:5.2}] },
  'knorr_360': { name:'Knorr 360cc @10bar', driveRatio:1.0, curve:[{rpm:500,kw:1.2},{rpm:1000,kw:2.5},{rpm:1500,kw:4.0},{rpm:2000,kw:5.4},{rpm:2500,kw:7.25},{rpm:3000,kw:8.95}] },
  'knorr_460': { name:'Knorr 460cc @10bar', driveRatio:1.0, curve:[{rpm:500,kw:1.3},{rpm:1000,kw:2.7},{rpm:1500,kw:4.1},{rpm:2000,kw:5.7},{rpm:2500,kw:7.3},{rpm:3000,kw:8.9}] },
  'wabco_500': { name:'Wabco 500cc @8.5bar', driveRatio:1.0, curve:[{rpm:500,kw:0.9},{rpm:1000,kw:2.7},{rpm:1500,kw:4.4},{rpm:2000,kw:6.6},{rpm:2500,kw:8.5},{rpm:3000,kw:8.9}] },
  'knorr_630': { name:'Knorr 630cc @10bar', driveRatio:1.0, curve:[{rpm:500,kw:1.9},{rpm:1000,kw:3.6},{rpm:1500,kw:5.7},{rpm:2000,kw:7.8},{rpm:2500,kw:9.9},{rpm:3000,kw:11.8}] },
  'wabco_636': { name:'Wabco 636cc @8.5bar', driveRatio:1.0, curve:[{rpm:500,kw:1.4},{rpm:1000,kw:3.2},{rpm:1500,kw:5.1},{rpm:2000,kw:7.6},{rpm:2500,kw:9.9},{rpm:3000,kw:10.3}] }
};

// ── Tip bilgisi: node.type → {etiket, Motor aksesuar-satır adı, varsayılan oran,
//    preset kütüphanesi, Motor giriş portu} ────────────────────────────────
// accName MOTOR panelindeki SABİT aksesuar satır adlarıyla BİREBİR eşleşmeli
// (cp-engine.js onVEAccChange accNames): 'Klima', 'Alternatör / Jeneratör',
// 'Hava Kompresörü'. Aksi halde net-tork modeli senkronize olmaz.
var VE_ACC_TYPES = {
  'acc-ac':         { label:'Klima Kompresörü', accName:'Klima',                  defRatio:1.25, port:'input-0', lib:'VE_AC_PRESETS' },
  'acc-alternator': { label:'Alternatör',        accName:'Alternatör / Jeneratör', defRatio:3.15, port:'input-1', lib:'VE_ALTERNATOR_PRESETS' },
  'acc-aircomp':    { label:'Hava Kompresörü',   accName:'Hava Kompresörü',        defRatio:1.0,  port:'input-2', lib:'VE_AIRCOMP_PRESETS' }
};

// Motor giriş portu → aksesuar tipi (bağlantı-tipi doğrulaması + senkron için).
var VE_ACC_PORT_MAP = { 'input-0':'acc-ac', 'input-1':'acc-alternator', 'input-2':'acc-aircomp' };

function veAccIsAccessoryType(type){ return !!(type && VE_ACC_TYPES[type]); }
function veAccPresetLib(type){
  var info = VE_ACC_TYPES[type]; if(!info) return {};
  try { return eval(info.lib) || {}; } catch(e){ return {}; }
}

// ── Eğri interpolasyonu (lineer, uçlarda sabitlenir) ────────────────────────
function veAccInterpCurve(curve, x){
  if(!curve || !curve.length) return 0;
  if(curve.length === 1) return curve[0].kw;
  if(x <= curve[0].rpm) return curve[0].kw;
  var last = curve[curve.length-1];
  if(x >= last.rpm) return last.kw;
  for(var i=0;i<curve.length-1;i++){
    var a=curve[i], b=curve[i+1];
    if(x >= a.rpm && x <= b.rpm){
      var t=(x-a.rpm)/(b.rpm-a.rpm);
      return a.kw + t*(b.kw-a.kw);
    }
  }
  return last.kw;
}

// ── PAYLAŞILAN NET-KAYIP MODELİ ─────────────────────────────────────────────
// Bir aksesuar listesi için, verilen MOTOR devrinde toplam çekilen gücü [kW]
// döndürür. Tüm çözücüler ve net-tork ekranları bunu kullanır → tek doğruluk
// kaynağı. Öğe tipleri:
//   • curve + driveRatio  → aksesuar_devri = rpm×ratio; kW = interp(curve)   (yeni model)
//   • kwConst             → sabit kW (manuel giriş)
//   • userLoss (scalar)   → LEGACY: fan → rpm³ (fanMode 'on' ise sabit), diğer → lineer
// Geriye dönük uyumlu: eski projelerde yalnız userLoss vardır.
function veAccessoryLossKw(accList, engineRpm, governedSpeed, fanMode){
  if(!accList || !accList.length || engineRpm <= 0) return 0;
  var gov = governedSpeed || 2100;
  var total = 0;
  for(var i=0;i<accList.length;i++){
    var a = accList[i]; if(!a) continue;
    if(a.curve && a.curve.length){
      var ratio = (a.driveRatio != null) ? a.driveRatio : 1;
      total += veAccInterpCurve(a.curve, engineRpm * ratio);
    } else if(a.kwConst != null && !isNaN(a.kwConst)){
      total += parseFloat(a.kwConst) || 0;          // manuel sabit kW
    } else {
      var loss = parseFloat(a.userLoss) || 0;
      if(loss <= 0) continue;
      var r = engineRpm / gov;
      if(a.name && a.name.toLowerCase().indexOf('fan') >= 0){
        total += (fanMode === 'on') ? loss : (loss * r * r * r);
      } else {
        total += loss * r;
      }
    }
  }
  return total;
}

// ── Bir aksesuar DÜĞÜMÜNÜN etkin eğri/oran/kW bilgisini çıkarır ─────────────
// preset seçiliyse kütüphane eğrisi + oran; '__manual__' ise sabit kW.
function veAccGetNodeModel(node){
  if(!node) return null;
  var info = VE_ACC_TYPES[node.type]; if(!info) return null;
  var d = node.data || {};
  var ratio = (d.accDriveRatio != null) ? parseFloat(d.accDriveRatio) : info.defRatio;
  if(isNaN(ratio)) ratio = info.defRatio;
  if(d.accPreset === '__manual__'){
    var kw = parseFloat(d.accManualKw); if(isNaN(kw)) kw = 0;
    return { name: info.accName, kwConst: kw, driveRatio: ratio, label: 'Manuel ('+kw.toFixed(1)+' kW)' };
  }
  var lib = veAccPresetLib(node.type);
  var p = d.accPreset && lib[d.accPreset];
  if(p){
    return { name: info.accName, curve: p.curve.slice(), driveRatio: ratio, label: p.name };
  }
  return null;   // seçim yapılmadı
}

// ── MOTOR'un aksesuar modelini bağlı düğümlerden GÜNCELLE ────────────────────
// engineNode'un giriş portlarına bağlı aksesuar düğümlerini bulur; her birinin
// eğri/oran/kW bilgisini Motor'un node.data.accessories dizisindeki eşleşen
// satıra yazar (userLoss = governed devirdeki kayıp; ayrıca curve/driveRatio/
// kwConst iliştirilir). Bağlantısı kesilen aksesuar satırları temizlenir.
// Tüm çözücüler + raporlar node.data.accessories okuduğu için tek yazım noktası
// her yere yayılır.
function veSyncEngineAccessories(engineNode){
  if(!engineNode || engineNode.type !== 'engine') return;
  if(!engineNode.data) engineNode.data = {};
  var accessories = engineNode.data.accessories;
  // İlk defa: varsayılan 6-satır iskeleti (cp-engine.js defaultAcc ile aynı).
  if(!accessories || !accessories.length){
    accessories = [
      {name:'Fan (Kavramalı Fan)', standardLoss:0, userLoss:0},
      {name:'Alternatör / Jeneratör', standardLoss:0, userLoss:0},
      {name:'Hava Kompresörü', standardLoss:0, userLoss:0},
      {name:'Direksiyon Pompası', standardLoss:0, userLoss:0},
      {name:'Klima', standardLoss:0, userLoss:0},
      {name:'Ek Tahrik', standardLoss:0, userLoss:0}
    ];
  }
  var byName = {};
  accessories.forEach(function(a){ byName[a.name] = a; });

  var gov = (engineNode.data.motorSpecs && engineNode.data.motorSpecs.governedSpeed)
            || engineNode.data.governedRpm || 2100;

  // Önce: node-kaynaklı satırların eski model verisini temizle (bağlantı kalkmış olabilir)
  Object.keys(VE_ACC_TYPES).forEach(function(t){
    var row = byName[VE_ACC_TYPES[t].accName];
    if(row && row.sourceNodeId){
      delete row.curve; delete row.driveRatio; delete row.kwConst;
      delete row.sourceNodeId; row.userLoss = 0;
    }
  });

  // Bağlı aksesuar düğümlerini tara
  var conns = (typeof connections !== 'undefined') ? connections : [];
  var nlist = (typeof nodes !== 'undefined') ? nodes : [];
  conns.forEach(function(c){
    if(c.to !== engineNode.id) return;
    var accType = VE_ACC_PORT_MAP[c.toPort];
    if(!accType) return;
    var accNode = nlist.find(function(n){ return n.id === c.from; });
    if(!accNode || accNode.type !== accType) return;
    var model = veAccGetNodeModel(accNode);
    if(!model) return;
    var row = byName[model.name];
    if(!row) return;
    row.sourceNodeId = accNode.id;
    row.driveRatio = model.driveRatio;
    if(model.curve){
      row.curve = model.curve;
      delete row.kwConst;
      // Görüntü için governed devirdeki temsili kayıp
      row.userLoss = +veAccInterpCurve(model.curve, gov * model.driveRatio).toFixed(2);
    } else {
      row.kwConst = model.kwConst;
      delete row.curve;
      row.userLoss = +(model.kwConst || 0).toFixed(2);
    }
  });

  engineNode.data.accessories = accessories;
  return accessories;
}

// Topolojideki tek Motor düğümünü senkronla (aksesuar bağlantısı değişince çağrılır).
function veSyncAllEngineAccessories(){
  var nlist = (typeof nodes !== 'undefined') ? nodes : [];
  nlist.forEach(function(n){ if(n.type === 'engine') veSyncEngineAccessories(n); });
}

// ============================================================================
// PROPERTIES PANELİ (Klima / Alternatör / Hava Kompresörü — ortak üretici)
// ============================================================================
function getAccessoryPropertiesHTML(node){
  var info = VE_ACC_TYPES[node.type];
  if(!info) return '<div class="sw-panel"><div class="sw-pkg-desc">Bilinmeyen aksesuar tipi.</div></div>';
  var d = node.data || {};
  // Varsayılanları ilk render'da yaz
  if(d.accDriveRatio === undefined) d.accDriveRatio = info.defRatio;
  if(d.accPreset === undefined) d.accPreset = '';
  node.data = d;

  var lib = veAccPresetLib(node.type);
  var isManual = (d.accPreset === '__manual__');
  var nid = node.id;

  // Motor'a bağlı mı?
  var conns = (typeof connections !== 'undefined') ? connections : [];
  var connected = conns.some(function(c){
    return c.from === nid && VE_ACC_PORT_MAP[c.toPort] === node.type;
  });

  var html = '<div class="sw-panel">';

  // Başlık + bağlantı rozeti
  html += '<div class="sw-section-title" style="display:flex;align-items:center;justify-content:space-between;">' + info.label;
  if(connected){
    html += ' <span style="background:rgba(34,197,94,0.15);color:var(--accent-success);font-size:0.55rem;font-weight:700;padding:2px 7px;border:1px solid rgba(34,197,94,0.4);">● MOTORA BAĞLI</span>';
  } else {
    html += ' <span style="background:rgba(245,158,11,0.12);color:var(--accent-warning,#f59e0b);font-size:0.55rem;font-weight:700;padding:2px 7px;border:1px solid rgba(245,158,11,0.4);">○ BAĞLANMADI</span>';
  }
  html += '</div>';

  html += '<div class="sw-pkg-desc">Bu bileşeni Motor kutusunun önündeki ilgili porta bağlayın. Devire bağlı çektiği güç, motorun net torkundan düşülür.</div>';

  // ── Model seçimi ──
  html += '<div class="sw-section-title" style="margin-top:6px;">Model Seçimi</div>';
  html += '<select id="ve-acc-preset-' + nid + '" onchange="onVEAccPresetSelect(\'' + nid + '\', this.value)" style="width:100%; font-size:0.7rem; padding:5px 6px; background:var(--bg-input); color:var(--text-primary); border:1px solid var(--border-color); border-radius:0; margin-bottom:8px;">';
  html += '<option value="">-- Model Seçiniz (' + Object.keys(lib).length + ' preset) --</option>';
  Object.keys(lib).forEach(function(key){
    var sel = (key === d.accPreset) ? ' selected' : '';
    html += '<option value="' + key + '"' + sel + '>' + lib[key].name + '</option>';
  });
  html += '<option value="__manual__"' + (isManual ? ' selected' : '') + '>+ Manuel kW Girişi</option>';
  html += '</select>';

  // ── Manuel kW (yalnız manuel modda) ──
  html += '<div id="ve-acc-manual-wrap-' + nid + '" style="display:' + (isManual ? 'block' : 'none') + '; margin-bottom:8px;">';
  html += '<table style="width:100%; font-size:0.7rem; border-collapse:collapse; border:1px solid var(--border-color);">';
  html += '<tr><th style="padding:7px 8px; text-align:left; background:var(--bg-tertiary); border-right:1px solid var(--border-color); width:60%; font-weight:500; color:var(--text-secondary);">Sabit güç [kW]</th>';
  html += '<td style="padding:6px 8px; background:var(--bg-tertiary);"><input type="number" id="ve-acc-manualkw-' + nid + '" value="' + (d.accManualKw != null ? d.accManualKw : 0) + '" step="0.1" min="0" style="width:100%; padding:5px; font-size:0.7rem; background:var(--bg-input); color:var(--text-primary); border:1px solid var(--border-color); border-radius:0; text-align:right;" onchange="onVEAccParamChange(\'' + nid + '\')"></td></tr>';
  html += '</table>';
  html += '<div style="font-size:0.62rem; color:var(--text-muted); margin-top:4px;">Manuel modda güç tüm devirlerde sabit alınır.</div>';
  html += '</div>';

  // ── Tahrik oranı ──
  html += '<table style="width:100%; font-size:0.7rem; border-collapse:collapse; border:1px solid var(--border-color); margin-bottom:8px;">';
  html += '<tr><th style="padding:7px 8px; text-align:left; background:var(--bg-tertiary); border-right:1px solid var(--border-color); width:60%; font-weight:500; color:var(--text-secondary);">Tahrik oranı [-]</th>';
  html += '<td style="padding:6px 8px; background:var(--bg-tertiary);"><input type="number" id="ve-acc-ratio-' + nid + '" value="' + d.accDriveRatio + '" step="0.01" min="0.1" max="10" style="width:100%; padding:5px; font-size:0.7rem; background:var(--bg-input); color:var(--text-primary); border:1px solid var(--border-color); border-radius:0; text-align:right;" onchange="onVEAccParamChange(\'' + nid + '\')"></td></tr>';
  html += '<tr><td colspan="2" style="padding:6px 8px; font-size:0.62rem; color:var(--text-secondary); background:var(--bg-secondary); line-height:1.4;">Aksesuar_devri = Motor_devri × oran. Aksesuar motordan daha hızlı döner (ör. alternatör ≈ 3.15).</td></tr>';
  html += '</table>';

  // ── Eğri önizleme (SVG sparkline) ──
  html += '<div id="ve-acc-preview-' + nid + '">' + veAccBuildPreview(node) + '</div>';

  html += '</div>'; // sw-panel
  return html;
}

// Eğri önizlemesi — küçük SVG sparkline (devir → kW). Manuelde düz çizgi.
function veAccBuildPreview(node){
  var model = veAccGetNodeModel(node);
  if(!model) return '<div class="sw-pkg-desc" style="text-align:center;color:var(--text-muted);">Önizleme için bir model seçin.</div>';
  var pts;
  if(model.curve){
    pts = model.curve.map(function(p){ return {x:p.rpm, y:p.kw}; });
  } else {
    // Manuel sabit kW: 0..3000 düz çizgi
    pts = [{x:0,y:model.kwConst||0},{x:3000,y:model.kwConst||0}];
  }
  var W=260, H=90, pad=6;
  var xs=pts.map(function(p){return p.x;}), ys=pts.map(function(p){return p.y;});
  var xmin=Math.min.apply(null,xs), xmax=Math.max.apply(null,xs);
  var ymin=0, ymax=Math.max.apply(null,ys)*1.15 || 1;
  if(xmax===xmin) xmax=xmin+1;
  function sx(x){ return pad + (x-xmin)/(xmax-xmin)*(W-2*pad); }
  function sy(y){ return H-pad - (y-ymin)/(ymax-ymin)*(H-2*pad); }
  var dpath = pts.map(function(p,i){ return (i?'L':'M') + sx(p.x).toFixed(1) + ' ' + sy(p.y).toFixed(1); }).join(' ');
  var dots = pts.map(function(p){ return '<circle cx="'+sx(p.x).toFixed(1)+'" cy="'+sy(p.y).toFixed(1)+'" r="2" fill="var(--accent-primary,#3b82f6)"/>'; }).join('');
  var html = '<div class="sw-pkg-card"><div class="sw-pkg-header" style="cursor:default;"><span class="sw-pkg-name">Eğri: ' + model.label + '</span>';
  html += '<span class="sw-pkg-badge ok" style="margin-left:auto;">' + ymax.toFixed(0) + ' kW maks</span></div>';
  html += '<div class="sw-pkg-body">';
  html += '<svg width="100%" viewBox="0 0 '+W+' '+H+'" preserveAspectRatio="none" style="display:block; background:var(--bg-tertiary); border:1px solid var(--border-color);">';
  html += '<path d="'+dpath+'" fill="none" stroke="var(--accent-primary,#3b82f6)" stroke-width="1.6"/>' + dots + '</svg>';
  html += '<div style="display:flex; justify-content:space-between; font-size:0.6rem; color:var(--text-muted); margin-top:2px;"><span>' + xmin + ' rpm</span><span>Aksesuar devri</span><span>' + xmax + ' rpm</span></div>';
  html += '</div></div>';
  return html;
}

// ── Panel olay işleyicileri ─────────────────────────────────────────────────
function onVEAccPresetSelect(nodeId, value){
  var node = (typeof nodes !== 'undefined') ? nodes.find(function(n){return n.id===nodeId;}) : null;
  if(!node) return;
  if(!node.data) node.data = {};
  var info = VE_ACC_TYPES[node.type];
  node.data.accPreset = value;
  if(value && value !== '__manual__'){
    var lib = veAccPresetLib(node.type);
    var p = lib[value];
    if(p){
      node.data.accCurve = p.curve.slice();
      // Preset'in kendi tahrik oranını uygula (kullanıcı sonra değiştirebilir)
      if(p.driveRatio != null) node.data.accDriveRatio = p.driveRatio;
    }
  } else if(value === '__manual__'){
    node.data.accCurve = [];
    if(node.data.accManualKw == null) node.data.accManualKw = 0;
  } else {
    node.data.accCurve = [];
  }
  // Manuel wrap görünürlüğü
  var wrap = document.getElementById('ve-acc-manual-wrap-' + nodeId);
  if(wrap) wrap.style.display = (value === '__manual__') ? 'block' : 'none';
  // Oran input'unu güncelle (preset oranı uygulanmış olabilir)
  var ratioEl = document.getElementById('ve-acc-ratio-' + nodeId);
  if(ratioEl && node.data.accDriveRatio != null) ratioEl.value = node.data.accDriveRatio;
  // Önizleme + Motor senkron + etiket
  var prev = document.getElementById('ve-acc-preview-' + nodeId);
  if(prev) prev.innerHTML = veAccBuildPreview(node);
  veAccApplyAndSync(node);
  if(typeof saveState === 'function') saveState();
}

function onVEAccParamChange(nodeId){
  var node = (typeof nodes !== 'undefined') ? nodes.find(function(n){return n.id===nodeId;}) : null;
  if(!node) return;
  if(!node.data) node.data = {};
  var ratioEl = document.getElementById('ve-acc-ratio-' + nodeId);
  var kwEl = document.getElementById('ve-acc-manualkw-' + nodeId);
  var pf = function(v, def){ var n = parseFloat(v); return isNaN(n) ? def : n; };
  if(ratioEl) node.data.accDriveRatio = pf(ratioEl.value, VE_ACC_TYPES[node.type].defRatio);
  if(kwEl) node.data.accManualKw = pf(kwEl.value, 0);
  var prev = document.getElementById('ve-acc-preview-' + nodeId);
  if(prev) prev.innerHTML = veAccBuildPreview(node);
  veAccApplyAndSync(node);
  if(typeof saveState === 'function') saveState();
}

// Bir aksesuar düğümü değişince: bağlı olduğu Motor'u yeniden senkronla ve
// (Motor paneli açıksa) net grafiği tazele.
function veAccApplyAndSync(accNode){
  var conns = (typeof connections !== 'undefined') ? connections : [];
  var nlist = (typeof nodes !== 'undefined') ? nodes : [];
  conns.forEach(function(c){
    if(c.from !== accNode.id) return;
    if(!VE_ACC_PORT_MAP[c.toPort]) return;
    var eng = nlist.find(function(n){ return n.id === c.to && n.type === 'engine'; });
    if(eng){
      veSyncEngineAccessories(eng);
      if(typeof updateVENetChart === 'function') { try { updateVENetChart(eng.id); } catch(e){} }
    }
  });
}
