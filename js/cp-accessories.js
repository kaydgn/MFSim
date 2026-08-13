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

// ── Bir aksesuar DÜĞÜMÜNÜN etkin eğrisi ────────────────────────────────────
// Kullanıcı eğrisi (node.data.accCurve) varsa O, yoksa seçili preset'in
// kütüphane eğrisi. Tabloya yazılan her nokta buradan çözücüye ulaşır —
// önceki sürüm accCurve'ı hiç okumuyordu, tablodan yapılan düzenleme
// çözücüye geçmiyordu.
// accCurveDirty = "tablo kullanıcınındır". BOŞ bir kullanıcı eğrisi de
// geçerli bir cevaptır: tabloyu temizleyip/son satırı silip preset eğrisine
// sessizce geri düşseydik, ekranda boş tablo görünürken çözücü hâlâ preset'i
// okuyordu — tam olarak "makul ama yanlış" regresyon.
function veAccCurveOf(node){
  var d = (node && node.data) || {};
  if(Array.isArray(d.accCurve) && (d.accCurve.length || d.accCurveDirty)) return d.accCurve;
  var lib = veAccPresetLib(node && node.type);
  var p = d.accPreset && lib[d.accPreset];
  return (p && p.curve) ? p.curve : null;
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
  var curve = veAccCurveOf(node);
  if(!curve || !curve.length) return null;   // seçim yapılmadı / eğri boş
  var lib = veAccPresetLib(node.type);
  var p = d.accPreset && lib[d.accPreset];
  var label = (p ? p.name : 'Özel eğri') + (d.accCurveDirty ? ' (düzenlendi)' : '');
  return { name: info.accName, curve: curve.slice(), driveRatio: ratio, label: label };
}

// ── Panel bağlamı: bağlı motorun devir aralığı + governed brüt tork ─────────
// Motor bağlı değilse gross null döner → "net torktaki payı" satırı
// GÖSTERİLMEZ (uydurma değer yok).
function veAccPanelCtx(node){
  var eng = veAccGetContextEngine(node);
  var specs = (eng && eng.data && eng.data.motorSpecs) || {};
  var idle = parseFloat(specs.idleRpm) || 600;
  var gov = parseFloat(specs.governedSpeed) || (eng && eng.data && eng.data.governedRpm) || 2200;
  if(!(gov > idle)) gov = idle + 1600;
  var info = VE_ACC_TYPES[node.type] || { defRatio: 1 };
  var ratio = (node.data && node.data.accDriveRatio != null) ? parseFloat(node.data.accDriveRatio) : info.defRatio;
  if(isNaN(ratio) || ratio <= 0) ratio = info.defRatio;
  return { eng: eng, idle: idle, gov: gov, ratio: ratio, gross: veAccGrossTorqueAt(eng, gov) };
}

// Motorun tork eğrisinden (torqueData: [{rpm,torque,power}]) verilen devirdeki
// brüt torku lineer olarak okur. Veri yoksa null.
function veAccGrossTorqueAt(engineNode, rpm){
  var td = engineNode && engineNode.data && engineNode.data.torqueData;
  if(!td || !td.length) return null;
  var pts = td.slice().sort(function(a,b){ return a.rpm - b.rpm; });
  if(rpm <= pts[0].rpm) return pts[0].torque;
  var last = pts[pts.length-1];
  if(rpm >= last.rpm) return last.torque;
  for(var i=0;i<pts.length-1;i++){
    var a = pts[i], b = pts[i+1];
    if(rpm >= a.rpm && rpm <= b.rpm){
      var t = (rpm - a.rpm) / (b.rpm - a.rpm);
      return a.torque + t * (b.torque - a.torque);
    }
  }
  return last.torque;
}

// Eğriyi normalize et: sayıya çevir, negatifleri kırp, devre göre sırala,
// aynı devirdeki tekrarları son yazılanla birleştir. Tüm eğri yazımları
// buradan geçer → çözücü her zaman artan, temiz bir eğri görür.
function veAccNormalizeCurve(curve){
  var byRpm = {};
  (curve || []).forEach(function(p){
    var rpm = parseFloat(p.rpm), kw = parseFloat(p.kw);
    if(isNaN(rpm) || rpm <= 0) return;
    if(isNaN(kw) || kw < 0) kw = 0;
    byRpm[rpm] = kw;
  });
  return Object.keys(byRpm).map(Number).sort(function(a,b){ return a-b; })
    .map(function(rpm){ return { rpm: rpm, kw: byRpm[rpm] }; });
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
// Üç adımlı akış: 1 Model → 2 Güç kaybı eğrisi → 3 Doğrulama.
// Adım 2'nin tablosu artık DÜZENLENEBİLİR ve düzenleme veriye (node.data.accCurve)
// yazılır → veAccCurveOf üzerinden çözücüye ulaşır.
function getAccessoryPropertiesHTML(node){
  var info = VE_ACC_TYPES[node.type];
  if(!info) return '<div class="sw-panel"><div class="sw-pkg-desc">Bilinmeyen aksesuar tipi.</div></div>';
  var d = node.data || {};
  // Varsayılanları ilk render'da yaz
  if(d.accDriveRatio === undefined) d.accDriveRatio = info.defRatio;
  if(d.accPreset === undefined) d.accPreset = '';
  if(d.accCurve === undefined) d.accCurve = [];
  node.data = d;

  var nid = node.id;
  var lib = veAccPresetLib(node.type);
  var isManual = (d.accPreset === '__manual__');
  var ctx = veAccPanelCtx(node);
  var curve = veAccCurveOf(node) || [];

  // Motor'a bağlı mı?
  var conns = (typeof connections !== 'undefined') ? connections : [];
  var connected = conns.some(function(c){
    return c.from === nid && VE_ACC_PORT_MAP[c.toPort] === node.type;
  });

  // ══ ADIM 1 — MODEL ══
  var mb = veAccModelBadge(node);
  var s1 = '';
  s1 += '<div class="sw-pkg-card ve-acc-step"><div class="sw-pkg-header" style="cursor:default;">';
  s1 += '<span class="ve-acc-stepno ' + mb.step + '" id="ve-acc-stepno1-' + nid + '">1</span><span class="sw-pkg-name">Model</span>';
  s1 += '<span class="sw-pkg-badge ' + mb.cls + '" id="ve-acc-modelbadge-' + nid + '">' + mb.text + '</span>';
  s1 += '</div><div class="sw-pkg-body ve-acc-stepbody">';
  s1 += '<div class="sw-pkg-desc">Kütüphaneden bir model seçin ya da manuel sabit kW girin. Seçim, aşağıdaki eğri tablosunu doldurur.</div>';

  s1 += '<select id="ve-acc-preset-' + nid + '" onchange="onVEAccPresetSelect(\'' + nid + '\', this.value)" class="ve-acc-select">';
  s1 += '<option value="">-- Model Seçiniz (' + Object.keys(lib).length + ' preset) --</option>';
  Object.keys(lib).forEach(function(key){
    s1 += '<option value="' + key + '"' + (key === d.accPreset ? ' selected' : '') + '>' + lib[key].name + '</option>';
  });
  s1 += '<option value="__manual__"' + (isManual ? ' selected' : '') + '>+ Manuel kW Girişi</option>';
  s1 += '</select>';

  // Manuel kW (yalnız manuel modda)
  s1 += '<div id="ve-acc-manual-wrap-' + nid + '" style="display:' + (isManual ? 'block' : 'none') + ';">';
  s1 += '<table class="ve-acc-tbl"><tr><th>Sabit güç [kW]</th><td><input type="number" id="ve-acc-manualkw-' + nid + '" value="' + (d.accManualKw != null ? d.accManualKw : 0) + '" step="0.1" min="0" onchange="onVEAccParamChange(\'' + nid + '\')"></td></tr></table>';
  s1 += '<div class="sw-footer" style="margin:0;">Manuel modda güç tüm devirlerde sabit alınır.</div>';
  s1 += '</div>';

  s1 += '<table class="ve-acc-tbl">';
  s1 += '<tr><th>Tahrik oranı [-]</th><td><input type="number" id="ve-acc-ratio-' + nid + '" value="' + d.accDriveRatio + '" step="0.01" min="0.1" max="10" onchange="onVEAccParamChange(\'' + nid + '\')"></td></tr>';
  s1 += '<tr><th>Motor idle</th><td class="ve-acc-ro">' + Math.round(ctx.idle) + ' rpm</td></tr>';
  s1 += '<tr><th>Governed</th><td class="ve-acc-ro">' + Math.round(ctx.gov) + ' rpm</td></tr>';
  s1 += '</table>';
  s1 += '<div class="sw-footer" style="margin:0;">Aksesuar_devri = Motor_devri × oran. ' + info.label + ' motordan farklı devirde döner; oran preset ile gelir, elle değiştirilebilir.</div>';

  s1 += connected
    ? '<div class="sw-status-bar installed" style="margin:0;"><span class="sw-status-dot"></span><span>Motora bağlı · ' + info.port + '</span></div>'
    : '<div class="sw-status-bar not-installed" style="margin:0;"><span class="sw-status-dot"></span><span>Bağlanmadı — Motor kutusunun ' + info.port + ' portuna bağlayın</span></div>';
  s1 += '<div class="sw-pkg-desc" style="margin:0;">Veri kaynağı: BMC GG Matrisi — ölçülmüş kW.</div>';
  s1 += '</div></div>';

  // ══ ADIM 2 — EĞRİ ══
  var pb = veAccPointBadge(node);
  var s2 = '';
  s2 += '<div class="sw-pkg-card ve-acc-step active"><div class="sw-pkg-header" style="cursor:default;">';
  s2 += '<span class="ve-acc-stepno active">2</span><span class="sw-pkg-name">Güç kaybı eğrisi</span>';
  s2 += '<span class="sw-pkg-badge ' + pb.cls + '" id="ve-acc-ptbadge-' + nid + '">' + pb.text + '</span>';
  s2 += '</div><div class="sw-pkg-body ve-acc-stepbody">';
  s2 += '<div id="ve-acc-curve-wrap-' + nid + '" class="ve-acc-stepbody">' + veAccCurveTableHTML(node) + '</div>';
  s2 += '</div></div>';

  // ══ ADIM 3 — DOĞRULAMA ══
  var s3 = '';
  s3 += '<div class="sw-pkg-card ve-acc-step"><div class="sw-pkg-header" style="cursor:default;">';
  s3 += '<span class="ve-acc-stepno">3</span><span class="sw-pkg-name">Doğrulama</span>';
  s3 += '<span id="ve-acc-badge-' + nid + '" class="sw-pkg-badge ok">–</span>';
  s3 += '</div><div class="sw-pkg-body ve-acc-stepbody">';
  s3 += '<div class="sw-pkg-desc" id="ve-acc-desc-' + nid + '">Motor devrine göre bu aksesuarın çektiği güç (kW). Değer, motorun net torkundan düşülür.</div>';
  s3 += '<div id="ve-acc-chart-' + nid + '" class="ve-acc-chart"></div>';
  s3 += '<div class="ve-acc-legend">● ölçüm noktaları · ★ governed · sürükleyerek yakınlaş, çift tık sıfırla</div>';
  s3 += '<div id="ve-acc-metrics-' + nid + '">' + veAccMetricsHTML(node) + '</div>';
  s3 += '</div></div>';

  // Üç sütun ızgara — model | eğri | doğrulama
  var html = '<div class="sw-panel">';
  html += '<div class="ve-cp-grid ve-cp-grid--steps">';
  html += '<div class="ve-cp-col ve-cp-col--in">' + s1 + '</div>';
  html += '<div class="ve-cp-col ve-cp-col--in">' + s2 + '</div>';
  html += '<div class="ve-cp-col ve-cp-col--out">' + s3 + '</div>';
  html += '</div>';   // ve-cp-grid
  html += '<div class="sw-footer">Çekilen güç aksesuarın kendi devrindeki eğriden okunur, krank torkuna çevrilir ve motorun brüt torkundan düşülür. Tüm çözücüler aynı modeli okur.</div>';
  html += '</div>';   // sw-panel
  return html;
}

// ── Adım rozetleri: tek doğruluk kaynağı (ilk render + veAccRefreshPanel) ──
function veAccModelBadge(node){
  var d = (node && node.data) || {};
  if(d.accPreset === '__manual__') return { text:'manuel', cls:'ok', step:'done' };
  if(d.accPreset) return { text:'tamam', cls:'ok', step:'done' };
  if(veAccCurveOf(node)) return { text:'özel eğri', cls:'ok', step:'done' };
  return { text:'seçilmedi', cls:'miss', step:'' };
}
function veAccPointBadge(node){
  var d = (node && node.data) || {};
  // Manuel modda eğri kullanılmaz — "0 nokta" eksik bir şey varmış gibi okunuyordu.
  if(d.accPreset === '__manual__') return { text:'kullanılmıyor', cls:'miss' };
  var c = veAccCurveOf(node) || [];
  return { text: c.length + ' nokta', cls: (c.length ? 'ok' : 'miss') };
}

// Adım 2'nin gövdesi: tablo + eylem düğmeleri + açıklama. Girilen sütunlar
// (aksesuar devri / kW) düzenlenebilir, ƒ işaretli sütunlar türetilmiştir.
// Yalnız bu blok yeniden çizilir (odak kaçmasın).
function veAccCurveTableHTML(node){
  var nid = node.id;
  var ctx = veAccPanelCtx(node);
  var curve = veAccCurveOf(node) || [];
  var outCount = 0;

  // Manuel sabit kW modunda eğri hiç okunmaz → boş tablo + dört düğme ölü
  // arayüzdü; niçin ölü olduğunu söyleyen tek satır daha dürüst.
  if(node.data && node.data.accPreset === '__manual__'){
    return '<div class="sw-pkg-desc" style="margin:0;">Manuel sabit kW modunda eğri kullanılmaz — çekilen güç tüm devirlerde Adım 1\'deki sabit değerdir. Devire bağlı bir eğri girmek için kütüphaneden bir model seçin.</div>';
  }

  var h = '<table class="ve-acc-curve">';
  h += '<tr><th class="num">#</th><th class="num">Aksesuar devri</th><th class="num">Güç [kW]</th>'
     + '<th class="num der">Motor devri ƒ</th><th class="num der">Kayıp ƒ [Nm]</th><th></th></tr>';

  curve.forEach(function(p, i){
    var engRpm = Math.round(p.rpm / ctx.ratio);
    var inRange = (engRpm >= ctx.idle && engRpm <= ctx.gov);
    if(!inRange) outCount++;
    var nm = (inRange && engRpm > 0) ? (p.kw * 9550 / engRpm).toFixed(1) : '—';
    var cls = inRange ? '' : ' class="out"';
    h += '<tr' + cls + '>';
    h += '<td class="num idx">' + (i+1) + '</td>';
    h += '<td><input type="number" value="' + p.rpm + '" step="10" min="0" onchange="onVEAccCurveCellChange(\'' + nid + '\',' + i + ',\'rpm\',this.value)"></td>';
    h += '<td><input type="number" value="' + p.kw + '" step="0.01" min="0" onchange="onVEAccCurveCellChange(\'' + nid + '\',' + i + ',\'kw\',this.value)"></td>';
    h += '<td class="num der">' + engRpm + '</td>';
    h += '<td class="num der">' + nm + '</td>';
    h += '<td class="del"><button class="ve-row-del" title="Satırı sil" onclick="onVEAccCurveDelRow(\'' + nid + '\',' + i + ')">✕</button></td>';
    h += '</tr>';
  });

  h += '<tr class="hint"><td class="num idx">' + (curve.length+1) + '</td>'
     + '<td colspan="5">boş satır — “+ Satır ekle” ya da “Yapıştır” (rpm ⇥ kW)</td></tr>';
  h += '</table>';

  if(curve.length && curve.length < 2){
    h += '<div class="sw-chain-bar fail">✗ Eğri için en az 2 nokta gerekir.</div>';
  } else if(outCount){
    h += '<div class="sw-chain-bar warn">' + outCount + ' nokta motor aralığının ('
       + Math.round(ctx.idle) + '–' + Math.round(ctx.gov) + ' rpm) dışında — çözücüde uç değere sabitlenir.</div>';
  }

  h += '<div class="sw-btn-row" style="justify-content:flex-start;margin:0;">';
  h += '<button class="sw-btn sw-btn-primary" onclick="onVEAccCurveAddRow(\'' + nid + '\')">+ Satır ekle</button>';
  h += '<button class="sw-btn sw-btn-outline" onclick="onVEAccCurveFill(\'' + nid + '\')">Preset\'ten doldur</button>';
  h += '<button class="sw-btn sw-btn-outline" onclick="onVEAccCurvePaste(\'' + nid + '\')">Yapıştır</button>';
  h += '<button class="sw-btn sw-btn-danger" style="margin-left:auto;" onclick="onVEAccCurveClear(\'' + nid + '\')">Temizle</button>';
  h += '</div>';
  h += '<div class="sw-footer" style="margin:0;">ƒ sütunları türetilmiştir: motor devri = aksesuar devri ÷ oran, kayıp tork = P × 9550 / motor devri.</div>';
  return h;
}

// Adım 3'ün metrik tablosu + net tork payı ölçeği. Motor bağlı değilse pay
// satırı gösterilmez — brüt tork bilinmiyor, uydurma yüzde yazılmaz.
function veAccMetricsHTML(node){
  var ctx = veAccPanelCtx(node);
  var model = veAccGetNodeModel(node);
  if(!model) return '<div class="sw-pkg-desc">Metrikler için bir model seçin ya da eğri girin.</div>';

  var govKw = model.curve ? veAccInterpCurve(model.curve, ctx.gov * ctx.ratio) : (model.kwConst || 0);
  var idleKw = model.curve ? veAccInterpCurve(model.curve, ctx.idle * ctx.ratio) : (model.kwConst || 0);
  var lossNm = govKw * 9550 / ctx.gov;
  var inRange = (model.curve || []).filter(function(p){
    var e = p.rpm / ctx.ratio; return e >= ctx.idle && e <= ctx.gov;
  }).length;

  var h = '<table class="ve-acc-tbl metrics">';
  h += '<tr><th>Çekilen güç @ governed</th><td>' + govKw.toFixed(2) + ' kW</td></tr>';
  h += '<tr><th>Kayıp tork (krank)</th><td>' + lossNm.toFixed(1) + ' Nm</td></tr>';
  h += '<tr><th>Idle devirde kayıp</th><td>' + idleKw.toFixed(2) + ' kW</td></tr>';
  if(ctx.gross){
    h += '<tr><th>Brüt tork (' + ctx.eng.id + ')</th><td>' + Math.round(ctx.gross) + ' Nm</td></tr>';
  }
  if(model.curve){
    h += '<tr><th>Aralıktaki nokta</th><td>' + inRange + ' / ' + model.curve.length + '</td></tr>';
  }
  h += '</table>';

  if(ctx.gross){
    var pct = lossNm / ctx.gross * 100;
    h += '<div class="ve-acc-share"><div class="row"><span>Net torktaki payı</span><span class="val">%'
       + pct.toFixed(1) + '</span></div><div class="bar"><i style="width:' + Math.min(100, Math.max(0, pct)).toFixed(1) + '%"></i></div>'
       + '<div class="note">' + Math.round(ctx.gross) + ' Nm brüt torkun ' + lossNm.toFixed(1)
       + ' Nm\'si bu aksesuara gidiyor.</div></div>';
    h += '<div class="sw-chain-bar ok">✓ Motorun net tork modeli güncellendi (' + ctx.eng.id + ')</div>';
  } else {
    h += '<div class="sw-chain-bar fail">Motor bağlı değil ya da tork eğrisi yok — net tork payı hesaplanamıyor.</div>';
  }
  return h;
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

  // Model YOKSA sebebi iki türlü: hiç seçim yapılmadı ya da seçim duruyor ama
  // eğri tablosu boşaltıldı. İkisine de "model seçilmedi" demek yanlış yönlendirir.
  var curveEmptied = !model && node.data && node.data.accPreset && node.data.accPreset !== '__manual__';

  // Rozet + açıklama
  var badge = document.getElementById('ve-acc-badge-' + nodeId);
  if(badge){
    badge.textContent = model ? (govKw.toFixed(1) + ' kW @ ' + Math.round(gov) + ' rpm')
                              : (curveEmptied ? '– eğri boş' : '– model seçilmedi');
    badge.className = 'sw-pkg-badge ' + (model ? 'ok' : 'miss');   // yoklukta yeşil okunuyordu
  }
  var emptyMsg = curveEmptied
    ? 'Eğri tablosu boş — “Preset\'ten doldur” ile geri getirin ya da elle nokta ekleyin.'
    : 'Grafik için bir model seçin.';
  var desc = document.getElementById('ve-acc-desc-' + nodeId);
  if(desc){
    desc.textContent = model
      ? ('Motor ' + Math.round(idle) + '–' + Math.round(gov) + ' rpm aralığında bu aksesuarın çektiği güç (kW); motorun net torkundan düşülür. ' + (eng ? 'Bağlı motorun devir aralığı kullanıldı.' : 'Motor bağlı değil — varsayılan aralık.'))
      : emptyMsg;
  }

  if(typeof Plotly === 'undefined'){ el.innerHTML = '<div class="ve-acc-chart-empty">Grafik kütüphanesi (Plotly) yükleniyor…</div>'; return; }

  // Tema renkleri (CSS değişkenlerinden — açık/koyu temaya uyum)
  var css = (typeof getComputedStyle === 'function') ? getComputedStyle(document.documentElement) : null;
  function cssv(name, dflt){ var x = css ? (css.getPropertyValue(name) || '').trim() : ''; return x || dflt; }
  var col = cssv('--accent-primary', '#3b82f6');
  var txt = cssv('--text-secondary', '#8a93a6');
  var grid = 'rgba(128,128,128,0.18)';

  if(!model){
    Plotly.purge(el);
    el.innerHTML = '<div class="ve-acc-chart-empty">' +
      (curveEmptied ? 'Eğri boş — tabloya nokta ekleyin.' : 'Model seçilince eğri burada çizilir.') + '</div>';
    return;
  }
  // Yer tutucu metin kutuda KALIYORDU: Plotly.react mevcut çocukları silmiyor,
  // grafiği altına ekliyor → eğrinin üzerinde "model seçin" yazısı duruyordu.
  if(!el.querySelector('.plot-container')) el.innerHTML = '';

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
  catch(e){ el.innerHTML = '<div class="ve-acc-chart-empty">Grafik çizilemedi: ' + e.message + '</div>'; }
}

// ── Panel olay işleyicileri ─────────────────────────────────────────────────
function onVEAccPresetSelect(nodeId, value){
  var node = (typeof nodes !== 'undefined') ? nodes.find(function(n){return n.id===nodeId;}) : null;
  if(!node) return;
  if(!node.data) node.data = {};
  var info = VE_ACC_TYPES[node.type];
  node.data.accPreset = value;
  // Model değişimi eğriyi SIFIRDAN yazar → "düzenlendi" işareti kalkar.
  node.data.accCurveDirty = false;
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
  // Tablo + rozet + metrik + grafik tazele, sonra Motor senkron
  veAccRefreshPanel(nodeId, true);
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
  // Oran değişince türetilen sütunlar (motor devri ƒ / kayıp ƒ) da değişir → tablo tazelenir.
  veAccRefreshPanel(nodeId, true);
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

// ── EĞRİ TABLOSU İŞLEYİCİLERİ (Adım 2) ─────────────────────────────────────
// Panelin türetilen kısımlarını tazele (tablo + nokta rozeti + metrikler + grafik).
// redrawTable === false ise tabloyu YENİDEN ÇİZMEZ — odak kaçmasın.
function veAccRefreshPanel(nodeId, redrawTable){
  var node = (typeof nodes !== 'undefined') ? nodes.find(function(n){return n.id===nodeId;}) : null;
  if(!node) return;
  if(typeof document === 'undefined') return;
  if(redrawTable !== false){
    var wrap = document.getElementById('ve-acc-curve-wrap-' + nodeId);
    if(wrap) wrap.innerHTML = veAccCurveTableHTML(node);
  }
  var mt = document.getElementById('ve-acc-metrics-' + nodeId);
  if(mt) mt.innerHTML = veAccMetricsHTML(node);
  // Adım rozetleri: model seçilince "seçilmedi" olarak KALIYORDU — panel
  // yeniden çizilmediği için. Üç rozet de aynı üreticilerden tazeleniyor.
  var pb = document.getElementById('ve-acc-ptbadge-' + nodeId);
  if(pb){
    var p = veAccPointBadge(node);
    pb.textContent = p.text;
    pb.className = 'sw-pkg-badge ' + p.cls;
  }
  var mb = document.getElementById('ve-acc-modelbadge-' + nodeId);
  var sn = document.getElementById('ve-acc-stepno1-' + nodeId);
  if(mb || sn){
    var m = veAccModelBadge(node);
    if(mb){ mb.textContent = m.text; mb.className = 'sw-pkg-badge ' + m.cls; }
    if(sn) sn.className = 've-acc-stepno ' + m.step;
  }
  if(typeof veAccDrawChart === 'function') veAccDrawChart(nodeId);
}

// Tüm eğri yazımlarının TEK çıkışı: normalize et → yaz → paneli tazele →
// Motor'u senkronla → kaydet. Buradan geçmeyen bir yazım çözücüye ulaşmaz.
function veAccCommitCurve(node, curve, redrawTable){
  node.data.accCurve = veAccNormalizeCurve(curve);
  node.data.accCurveDirty = true;
  veAccRefreshPanel(node.id, redrawTable);
  veAccApplyAndSync(node);
  if(typeof saveState === 'function') saveState();
}

// Düzenlenebilir hücrelerin kopyası (normalize edilmemiş ham liste).
function veAccCurveDraft(node){
  return (veAccCurveOf(node) || []).map(function(p){ return { rpm:p.rpm, kw:p.kw }; });
}

function onVEAccCurveCellChange(nodeId, idx, field, value){
  var node = (typeof nodes !== 'undefined') ? nodes.find(function(n){return n.id===nodeId;}) : null;
  if(!node) return;
  var curve = veAccCurveDraft(node);
  if(!curve[idx]) return;
  var v = parseFloat(value);
  if(isNaN(v) || v < 0) v = 0;
  curve[idx][field] = v;
  // Sıralama değişebileceği için tabloyu yeniden çiz; odak zaten hücreden çıktı (onchange).
  veAccCommitCurve(node, curve, true);
}

function onVEAccCurveAddRow(nodeId){
  var node = (typeof nodes !== 'undefined') ? nodes.find(function(n){return n.id===nodeId;}) : null;
  if(!node) return;
  var curve = veAccCurveDraft(node);
  var lastRpm = curve.length ? curve[curve.length-1].rpm : 1000;
  curve.push({ rpm: lastRpm + 500, kw: 0 });
  veAccCommitCurve(node, curve, true);
  if(typeof document === 'undefined') return;
  var wrap = document.getElementById('ve-acc-curve-wrap-' + nodeId);
  var inputs = wrap ? wrap.querySelectorAll('tr:not(.hint) input') : [];
  if(inputs.length >= 2 && inputs[inputs.length-2].focus) inputs[inputs.length-2].focus();
}

function onVEAccCurveDelRow(nodeId, idx){
  var node = (typeof nodes !== 'undefined') ? nodes.find(function(n){return n.id===nodeId;}) : null;
  if(!node) return;
  var curve = veAccCurveDraft(node);
  curve.splice(idx, 1);
  veAccCommitCurve(node, curve, true);
}

function onVEAccCurveFill(nodeId){
  var node = (typeof nodes !== 'undefined') ? nodes.find(function(n){return n.id===nodeId;}) : null;
  if(!node) return;
  var lib = veAccPresetLib(node.type);
  var p = node.data && node.data.accPreset && lib[node.data.accPreset];
  if(!p){ if(typeof showToast === 'function') showToast('Önce bir model seçin.', 'warning'); return; }
  if(node.data.accCurveDirty && typeof confirm === 'function' &&
     !confirm('Tablodaki düzenlemeler preset eğrisiyle değiştirilecek. Devam edilsin mi?')) return;
  node.data.accCurve = p.curve.slice();
  node.data.accCurveDirty = false;
  veAccRefreshPanel(nodeId, true);
  veAccApplyAndSync(node);
  if(typeof saveState === 'function') saveState();
}

// Panodan "rpm<TAB>kW" satırları (Excel kopyası).
// Sütun ayracı: tab, noktalı virgül veya boşluk. VİRGÜL AYRAÇ DEĞİL — TR
// yerelinde ondalık ayracıdır ("1,38"); ikisini birden ayraç saymak "1,38"i
// iki sütuna bölüp sessizce 1 kW yazıyordu. Saf virgüllü CSV ("850,1.38")
// yine de okunur: satırda başka ayraç yoksa ve virgül TAM İKİ parça
// veriyorsa sütun ayracı kabul edilir.
function veAccParseCurveText(text){
  var rows = String(text == null ? '' : text).split(/\r?\n/), out = [];
  rows.forEach(function(line){
    line = line.trim();
    if(!line) return;
    var parts = line.split(/[\t;]+|\s+/).filter(function(s){ return s !== ''; });
    if(parts.length < 2 && line.indexOf(',') >= 0){
      var csv = line.split(',');
      if(csv.length === 2) parts = csv;   // "850,1.38" → iki sütun
    }
    if(parts.length < 2) return;
    var rpm = parseFloat(parts[0].replace(',', '.'));
    var kw  = parseFloat(parts[1].replace(',', '.'));
    if(isNaN(rpm) || isNaN(kw)) return;
    out.push({ rpm: rpm, kw: kw });
  });
  return out;
}

function onVEAccCurvePaste(nodeId){
  var node = (typeof nodes !== 'undefined') ? nodes.find(function(n){return n.id===nodeId;}) : null;
  if(!node) return;
  var apply = function(text){
    var pts = veAccParseCurveText(text);
    if(!pts.length){ if(typeof showToast === 'function') showToast('Panoda "rpm ⇥ kW" biçiminde satır bulunamadı.', 'warning'); return; }
    veAccCommitCurve(node, pts, true);
    if(typeof showToast === 'function') showToast(pts.length + ' nokta alındı.', 'success');
  };
  var ask = function(){
    var t = (typeof prompt === 'function') ? prompt('Satırları yapıştırın (rpm ⇥ kW):') : '';
    apply(t || '');
  };
  if(typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.readText){
    navigator.clipboard.readText().then(apply).catch(ask);
  } else {
    ask();
  }
}

function onVEAccCurveClear(nodeId){
  var node = (typeof nodes !== 'undefined') ? nodes.find(function(n){return n.id===nodeId;}) : null;
  if(!node) return;
  if(typeof confirm === 'function' && !confirm('Eğri tablosu temizlensin mi?')) return;
  node.data.accCurve = [];
  node.data.accCurveDirty = true;
  veAccRefreshPanel(nodeId, true);
  veAccApplyAndSync(node);
  if(typeof saveState === 'function') saveState();
}
