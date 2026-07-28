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

  // ══ SOL SÜTUN: girdiler (model + oran) ══
  var L = '';
  L += '<div class="sw-section-title" style="display:flex;align-items:center;justify-content:space-between;">Model Seçimi';
  if(connected){
    L += ' <span style="background:color-mix(in srgb, var(--accent-success) 15%, transparent);color:var(--accent-success);font-size:0.55rem;font-weight:700;padding:2px 7px;border:1px solid color-mix(in srgb, var(--accent-success) 40%, transparent);">● MOTORA BAĞLI</span>';
  } else {
    L += ' <span style="background:color-mix(in srgb, var(--accent-warning) 12%, transparent);color:var(--accent-warning,#f59e0b);font-size:0.55rem;font-weight:700;padding:2px 7px;border:1px solid color-mix(in srgb, var(--accent-warning) 40%, transparent);">○ BAĞLANMADI</span>';
  }
  L += '</div>';
  L += '<div class="sw-pkg-desc">Bu bileşeni Motor kutusunun önündeki ilgili porta bağlayın. Devire bağlı çektiği güç, motorun net torkundan düşülür.</div>';

  L += '<select id="ve-acc-preset-' + nid + '" onchange="onVEAccPresetSelect(\'' + nid + '\', this.value)" style="width:100%; font-size:0.7rem; padding:5px 6px; background:var(--bg-input); color:var(--text-primary); border:1px solid var(--border-color); border-radius:var(--radius-sm); margin-bottom:8px;">';
  L += '<option value="">-- Model Seçiniz (' + Object.keys(lib).length + ' preset) --</option>';
  Object.keys(lib).forEach(function(key){
    var sel = (key === d.accPreset) ? ' selected' : '';
    L += '<option value="' + key + '"' + sel + '>' + lib[key].name + '</option>';
  });
  L += '<option value="__manual__"' + (isManual ? ' selected' : '') + '>+ Manuel kW Girişi</option>';
  L += '</select>';

  // Manuel kW (yalnız manuel modda)
  L += '<div id="ve-acc-manual-wrap-' + nid + '" style="display:' + (isManual ? 'block' : 'none') + '; margin-bottom:8px;">';
  L += '<table style="width:100%; font-size:0.7rem; border-collapse:collapse; border:1px solid var(--border-color);">';
  L += '<tr><th style="padding:7px 8px; text-align:left; background:var(--bg-tertiary); border-right:1px solid var(--border-color); width:60%; font-weight:500; color:var(--text-secondary);">Sabit güç [kW]</th>';
  L += '<td style="padding:6px 8px; background:var(--bg-tertiary);"><input type="number" id="ve-acc-manualkw-' + nid + '" value="' + (d.accManualKw != null ? d.accManualKw : 0) + '" step="0.1" min="0" style="width:100%; padding:5px; font-size:0.7rem; background:var(--bg-input); color:var(--text-primary); border:1px solid var(--border-color); border-radius:var(--radius-sm); text-align:right;" onchange="onVEAccParamChange(\'' + nid + '\')"></td></tr>';
  L += '</table>';
  L += '<div style="font-size:0.62rem; color:var(--text-muted); margin-top:4px;">Manuel modda güç tüm devirlerde sabit alınır.</div>';
  L += '</div>';

  // Tahrik oranı
  L += '<table style="width:100%; font-size:0.7rem; border-collapse:collapse; border:1px solid var(--border-color); margin-bottom:8px;">';
  L += '<tr><th style="padding:7px 8px; text-align:left; background:var(--bg-tertiary); border-right:1px solid var(--border-color); width:60%; font-weight:500; color:var(--text-secondary);">Tahrik oranı [-]</th>';
  L += '<td style="padding:6px 8px; background:var(--bg-tertiary);"><input type="number" id="ve-acc-ratio-' + nid + '" value="' + d.accDriveRatio + '" step="0.01" min="0.1" max="10" style="width:100%; padding:5px; font-size:0.7rem; background:var(--bg-input); color:var(--text-primary); border:1px solid var(--border-color); border-radius:var(--radius-sm); text-align:right;" onchange="onVEAccParamChange(\'' + nid + '\')"></td></tr>';
  L += '<tr><td colspan="2" style="padding:6px 8px; font-size:0.62rem; color:var(--text-secondary); background:var(--bg-secondary); line-height:1.4;">Aksesuar_devri = Motor_devri × oran. Aksesuar motordan daha hızlı döner (ör. alternatör ≈ 3.15).</td></tr>';
  L += '</table>';

  // ══ SAĞ SÜTUN: güç çekişi grafiği (motor devrine göre) ══
  var Rr = '';
  Rr += '<div class="sw-pkg-card" style="margin-bottom:10px;">';
  Rr += '<div class="sw-pkg-header" style="cursor:default;"><span class="sw-pkg-name">Güç Çekişi</span>';
  Rr += '<span id="ve-acc-badge-' + nid + '" class="sw-pkg-badge ok" style="margin-left:auto;">–</span></div>';
  Rr += '<div class="sw-pkg-body">';
  Rr += '<div class="sw-pkg-desc" id="ve-acc-desc-' + nid + '">Motor devrine göre bu aksesuarın çektiği güç (kW). Değer, motorun net torkundan düşülür.</div>';
  Rr += '<div id="ve-acc-chart-' + nid + '" style="width:100%; height:230px; background:var(--bg-tertiary); border:1px solid var(--border-color);"></div>';
  Rr += '<div style="font-size:0.6rem; color:var(--text-muted); margin-top:4px; text-align:center;">● Ölçüm noktaları · üzerine gelince değerler · sürükleyerek yakınlaş, çift tık sıfırla</div>';
  Rr += '</div></div>';

  // İki sütun ızgara (diğer bileşen panelleriyle aynı: ve-cp-grid)
  var html = '<div class="sw-panel">';
  html += '<div class="ve-cp-grid">';
  html += '<div class="ve-cp-col ve-cp-col--in">' + L + '</div>';
  html += '<div class="ve-cp-col ve-cp-col--out">' + Rr + '</div>';
  html += '</div>';   // ve-cp-grid
  html += '</div>';   // sw-panel
  return html;
}

// Bu aksesuar düğümünün bağlı olduğu Motor'u (varsa) döndürür — grafiğin gerçek
// devir aralığını (idle→governed) alması için.
function veAccGetContextEngine(node){
  var conns = (typeof connections !== 'undefined') ? connections : [];
  var nlist = (typeof nodes !== 'undefined') ? nodes : [];
  var eng = null;
  conns.forEach(function(c){
    if(c.from === node.id && VE_ACC_PORT_MAP[c.toPort]){
      var e = nlist.find(function(n){ return n.id === c.to && n.type === 'engine'; });
      if(e) eng = e;
    }
  });
  return eng;
}

// Güç çekişi grafiği — ETKİLEŞİMLİ (Plotly). MOTOR DEVRİNE göre çekilen güç [kW].
// Çizgi = eğri (motor idle→governed), işaretçiler = GERÇEK ölçüm noktaları
// (aksesuar eğri noktaları motor devrine oran ile eşlenmiş). Üzerine gelince
// motor devri + aksesuar devri + kW gösterir; sürükleyerek yakınlaşılır.
function veAccDrawChart(nodeId){
  if(typeof document === 'undefined') return;
  var el = document.getElementById('ve-acc-chart-' + nodeId);
  if(!el) return;
  var node = (typeof nodes !== 'undefined') ? nodes.find(function(n){ return n.id === nodeId; }) : null;
  if(!node) return;
  var model = veAccGetNodeModel(node);

  var eng = veAccGetContextEngine(node);
  var specs = (eng && eng.data && eng.data.motorSpecs) || {};
  var idle = parseFloat(specs.idleRpm) || 600;
  var gov = parseFloat(specs.governedSpeed) || (eng && eng.data && eng.data.governedRpm) || 2200;
  if(!(gov > idle)) gov = idle + 1600;
  var ratio = (node.data && node.data.accDriveRatio != null) ? parseFloat(node.data.accDriveRatio) : VE_ACC_TYPES[node.type].defRatio;
  if(isNaN(ratio)) ratio = VE_ACC_TYPES[node.type].defRatio;

  function kwAt(engineRpm){
    if(!model) return 0;
    if(model.curve) return veAccInterpCurve(model.curve, engineRpm * ratio);
    return model.kwConst || 0;
  }
  var govKw = kwAt(gov);

  // Rozet + açıklama
  var badge = document.getElementById('ve-acc-badge-' + nodeId);
  if(badge) badge.textContent = model ? (govKw.toFixed(1) + ' kW @ ' + Math.round(gov) + ' rpm') : '– model seçilmedi';
  var desc = document.getElementById('ve-acc-desc-' + nodeId);
  if(desc){
    desc.textContent = model
      ? ('Motor ' + Math.round(idle) + '–' + Math.round(gov) + ' rpm aralığında bu aksesuarın çektiği güç (kW); motorun net torkundan düşülür. ' + (eng ? 'Bağlı motorun devir aralığı kullanıldı.' : 'Motor bağlı değil — varsayılan aralık.'))
      : 'Grafik için bir model seçin.';
  }

  if(typeof Plotly === 'undefined'){ el.innerHTML = '<div style="padding:16px;text-align:center;color:var(--text-muted);font-size:0.7rem;">Grafik kütüphanesi (Plotly) yükleniyor…</div>'; return; }

  // Tema renkleri (CSS değişkenlerinden — açık/koyu temaya uyum)
  var css = (typeof getComputedStyle === 'function') ? getComputedStyle(document.documentElement) : null;
  function cssv(name, dflt){ var x = css ? (css.getPropertyValue(name) || '').trim() : ''; return x || dflt; }
  var col = cssv('--accent-primary', '#3b82f6');
  var txt = cssv('--text-secondary', '#8a93a6');
  var grid = 'rgba(128,128,128,0.18)';

  if(!model){
    Plotly.purge(el);
    el.innerHTML = '<div style="padding:24px;text-align:center;color:var(--text-muted);font-size:0.72rem;">Grafik için bir model seçin.</div>';
    return;
  }

  // Çizgi için: motor aralığında gerçek ölçüm noktalarını (aksesuar_rpm/oran) +
  // uç noktaları örnekle → çizgi lineer interp'e SADIK kalır, işaretçiler gerçek veride.
  var xset = {};
  xset[idle] = 1; xset[gov] = 1;
  if(model.curve){
    model.curve.forEach(function(p){ var er = p.rpm / ratio; if(er >= idle && er <= gov) xset[Math.round(er)] = 1; });
  }
  var xs = Object.keys(xset).map(Number).sort(function(a,b){ return a - b; });
  var ys = xs.map(kwAt);
  var accRpm = xs.map(function(x){ return Math.round(x * ratio); });

  // Ölçüm noktaları (motor aralığındaki gerçek eğri noktaları) — vurgulu işaretçi
  var mx = [], my = [], macc = [];
  if(model.curve){
    model.curve.forEach(function(p){ var er = p.rpm / ratio; if(er >= idle && er <= gov){ mx.push(Math.round(er)); my.push(p.kw); macc.push(p.rpm); } });
  }

  var lineTrace = {
    x: xs, y: ys, customdata: accRpm,
    mode: 'lines', type: 'scatter',
    line: { color: col, width: 2.5 },
    hovertemplate: 'Motor: %{x:.0f} rpm<br>Aksesuar: %{customdata} rpm<br>Çekilen güç: <b>%{y:.2f} kW</b><extra></extra>',
    name: model.label
  };
  var ptTrace = {
    x: mx, y: my, customdata: macc,
    mode: 'markers', type: 'scatter',
    marker: { color: col, size: 7, line: { color: '#fff', width: 1 } },
    hovertemplate: 'Ölçüm<br>Aksesuar: %{customdata} rpm<br>Güç: <b>%{y:.2f} kW</b><extra></extra>',
    name: 'Ölçüm'
  };
  var govTrace = {
    x: [gov], y: [govKw], mode: 'markers', type: 'scatter',
    marker: { color: '#f59e0b', size: 11, symbol: 'star', line: { color: '#fff', width: 1 } },
    hovertemplate: 'Governed: %{x:.0f} rpm<br><b>%{y:.2f} kW</b><extra></extra>',
    name: 'Governed'
  };

  var layout = {
    margin: { l: 52, r: 14, t: 8, b: 40 },
    paper_bgcolor: 'transparent', plot_bgcolor: 'transparent',
    font: { family: 'system-ui, -apple-system, sans-serif', size: 10, color: txt },
    xaxis: { title: { text: 'Motor devri [rpm]', font: { size: 10.5, color: txt } }, gridcolor: grid, zeroline: false, linecolor: grid, tickfont: { size: 9, color: txt } },
    yaxis: { title: { text: 'Çekilen güç [kW]', font: { size: 10.5, color: txt } }, gridcolor: grid, zeroline: false, rangemode: 'tozero', linecolor: grid, tickfont: { size: 9, color: txt } },
    showlegend: false, hovermode: 'closest',
    hoverlabel: { bgcolor: cssv('--bg-secondary', '#1b2233'), bordercolor: col, font: { size: 10, color: cssv('--text-primary', '#e5e9f0') } }
  };
  var config = { responsive: true, displayModeBar: false, displaylogo: false, doubleClick: 'reset', scrollZoom: false };

  try { Plotly.react(el, [lineTrace, ptTrace, govTrace], layout, config); }
  catch(e){ el.innerHTML = '<div style="padding:16px;text-align:center;color:var(--text-muted);font-size:0.7rem;">Grafik çizilemedi: ' + e.message + '</div>'; }
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
  // Grafiği yeniden çiz + Motor senkron
  if(typeof veAccDrawChart === 'function') veAccDrawChart(nodeId);
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
  if(typeof veAccDrawChart === 'function') veAccDrawChart(nodeId);
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
