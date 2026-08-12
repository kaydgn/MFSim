// ===== ENGEL ATLAMA ANALİZİ =====
function veFTRunObstacleCrossingAnalysis(obsData) {
  // Araç ve tekerlek verilerini topla
  var vehicleNode = nodes.find(function(n) { return n.type === 'vehicle'; });
  var wheelNode = nodes.find(function(n) { return n.type === 'wheel' && n.isMasterWheel; })
                || nodes.find(function(n) { return n.type === 'wheel'; });

  if(!vehicleNode) throw new Error('Engel Atlama: Araç bileşeni eksik');
  if(!wheelNode) throw new Error('Engel Atlama: Tekerlek bileşeni eksik');

  var vd = vehicleNode.data || {};
  var wd = wheelNode.data || {};

  // Parametreleri oku
  var mass = parseFloat(vd.ftGVW) || 14900;
  var a1 = parseFloat(obsData.a1) || 0;
  var a2 = parseFloat(obsData.a2) || 0;
  var wheelbase = a1 + a2;
  var h = parseFloat(obsData.obstacleHeight) || 0;
  var R_eff = parseFloat(obsData.loadedTireRadius) || 0;
  var cornerDeflection = (obsData.cornerDeflection !== undefined && obsData.cornerDeflection !== null)
    ? parseFloat(obsData.cornerDeflection) : NaN;
  var hasCornerDefl = isFinite(cornerDeflection) && cornerDeflection > 0;

  // Şanzıman çıkış tork limiti
  var gbTorqueLimit = (obsData.gbTorqueLimit !== undefined && obsData.gbTorqueLimit !== null)
    ? parseFloat(obsData.gbTorqueLimit) : NaN;
  var hasGbTorqueLimit = isFinite(gbTorqueLimit) && gbTorqueLimit > 0;

  // Şanzıman vites oranı
  var gearboxNode = nodes.find(function(n) { return n.type === 'gearbox'; });
  var gd = gearboxNode ? (gearboxNode.data || {}) : {};
  var ftGears = gd.ftGearData || (typeof VE_FT_GB_DEFAULT_GEARS !== 'undefined' ? VE_FT_GB_DEFAULT_GEARS : []);
  var selectedGearIdx = obsData.selectedGearIdx !== undefined ? obsData.selectedGearIdx : 0;
  var selectedGear = ftGears.length > 0 && selectedGearIdx < ftGears.length ? ftGears[selectedGearIdx] : null;
  var gearRatio = selectedGear ? selectedGear.ratio : 0;
  var gearName = selectedGear ? selectedGear.name : '—';

  // Lastik bilgileri (otomatik)
  var tireName = wd.ftTireName || 'Michelin XZL 395/85R20';
  var rollingRadius = wd.ftTireRadius !== undefined ? wd.ftTireRadius : 0.573;

  // Sonuç objesi
  var result = {
    inputParams: {
      mass: mass,
      a1: a1,
      a2: a2,
      wheelbase: wheelbase,
      h: h,
      R_eff: R_eff,
      tireName: tireName,
      rollingRadius: rollingRadius,
      gearName: gearName,
      gearRatio: gearRatio,
      cornerDeflection: hasCornerDefl ? cornerDeflection : null,
      gbTorqueLimit: hasGbTorqueLimit ? gbTorqueLimit : null,
      loadTransferAnalysis: obsData.loadTransferAnalysis || false
    },
    geometry: {},
    canCross: false,
    geometryFail: false,
    geometryFailReason: '',
    notes: []
  };

  // ── GEOMETRİK GEÇERLİLİK KONTROLÜ ──
  if(R_eff <= 0) {
    result.geometryFail = true;
    result.geometryFailReason = 'Yüklü lastik yarıçapı (R_eff) tanımlı değil veya sıfır.';
    return result;
  }
  if(h <= 0) {
    result.geometryFail = true;
    result.geometryFailReason = 'Engel yüksekliği (h) tanımlı değil veya sıfır.';
    return result;
  }
  if(h > R_eff) {
    result.geometryFail = true;
    result.geometryFailReason = 'Engel yüksekliği teker yarıçapını aşıyor (h=' + h.toFixed(3) + ' m > R_eff=' + R_eff.toFixed(3) + ' m), geometrik olarak aşılamaz.';
    return result;
  }
  if(h === R_eff) {
    result.geometryFail = true;
    result.geometryFailReason = 'Engel yüksekliği teker yarıçapına eşit (h=R_eff=' + R_eff.toFixed(3) + ' m). Moment kolu x=0, pratikte aşılamaz.';
    return result;
  }

  // ── GEOMETRİ HESAPLARI (h < R_eff) ──

  // 1) Köşe moment kolu x = √(2·R_eff·h − h²)
  var x = Math.sqrt(2 * R_eff * h - h * h);

  // 2) Merkez-köşe açısı θ = arccos(x / R_eff)
  var theta_rad = Math.acos(x / R_eff);
  var theta_deg = theta_rad * 180 / Math.PI;

  // 3) h/R oranı
  var hR_ratio = h / R_eff;

  // Zorluk değerlendirmesi
  var difficultyLabel;
  if(hR_ratio < 0.5) {
    difficultyLabel = 'Kolay';
  } else if(hR_ratio < 0.75) {
    difficultyLabel = 'Orta';
  } else {
    difficultyLabel = 'Zor';
  }

  result.geometry = {
    x: x,
    theta_rad: theta_rad,
    theta_deg: theta_deg,
    hR_ratio: hR_ratio,
    difficultyLabel: difficultyLabel
  };

  // ── ADIM 3: TORK GEREKSİNİMİ HESABI ──
  var g = 9.81;
  var W = mass * g; // Toplam ağırlık kuvveti [N]
  var L = wheelbase;

  // Dingil mesafesi kontrolü
  if(L <= 0) {
    result.geometryFail = true;
    result.geometryFailReason = 'Dingil mesafesi (L=a1+a2) tanımlı değil veya sıfır.';
    return result;
  }

  // Senaryo A — Ön teker engelde
  // Arka teker temas noktası etrafında moment dengesi
  // D_ön = L + x  (P noktası ön aksın x kadar ilerisinde)
  var D_front = L + x;
  var N_f = W * a2 / D_front;          // Ön akstaki toplam reaksiyon [N]
  var N_f1 = N_f / 2;                   // Tek tekere düşen yük [N]
  var T_req_front = N_f1 * x;           // Tek teker tork gereksinimi [Nm]

  // Senaryo B — Arka teker engelde
  // Ön teker temas noktası etrafında moment dengesi
  // D_arka = L - x  (P noktası arka aksın x kadar gerisinde)
  var D_rear = L - x;

  // L - x <= 0 kontrolü (çok küçük dingil mesafeli araçlarda teorik)
  var N_r, N_r1, T_req_rear;
  if(D_rear <= 0) {
    N_r = Infinity;
    N_r1 = Infinity;
    T_req_rear = Infinity;
  } else {
    N_r = W * a1 / D_rear;             // Arka akstaki toplam reaksiyon [N]
    N_r1 = N_r / 2;                     // Tek tekere düşen yük [N]
    T_req_rear = N_r1 * x;              // Tek teker tork gereksinimi [Nm]
  }

  // Kritik senaryo belirleme (daha yüksek tork gereksinimi)
  var T_req_critical = Math.max(T_req_front, T_req_rear);
  var criticalScenario = T_req_rear >= T_req_front ? 'Arka teker' : 'Ön teker';

  result.torqueAnalysis = {
    g: g,
    W: W,
    L: L,
    // Senaryo A — Ön teker
    D_front: D_front,
    N_f: N_f,
    N_f1: N_f1,
    T_req_front: T_req_front,
    // Senaryo B — Arka teker
    D_rear: D_rear,
    N_r: N_r,
    N_r1: N_r1,
    T_req_rear: T_req_rear,
    // Özet
    T_req_critical: T_req_critical,
    criticalScenario: criticalScenario
  };

  // ── ADIM 4: STALL DENGE NOKTASI & MEVCUT TEKER TORKU ──

  // Motor bileşeni
  var engineNode = nodes.find(function(n) { return n.type === 'engine'; });
  var ed = engineNode ? (engineNode.data || {}) : {};
  var torqueTable = ed.torqueData || [];
  var specs = ed.motorSpecs || {};
  var governedSpeed = parseFloat(specs.governedSpeed || ed.governedRpm) || 2100;
  var noLoadGoverned = parseFloat(specs.noLoadGoverned) || (governedSpeed + 200);
  var idleRpm = parseFloat(specs.idleRpm) || 700;

  // Motor tork fonksiyonu (PCHIP + governor) — BRÜT
  var grossMotorTorqueFn = FT_SOLVER.createMotorTorqueFn(torqueTable, governedSpeed, noLoadGoverned);

  // Aksesuar kayıpları (net motor torku)
  var accList = ed.accessories || [];
  var accTotalFanLoss = 0, accTotalOtherLoss = 0;
  var accFanMode = 'clutch';
  accList.forEach(function(a) {
    var loss = parseFloat(a.userLoss) || 0;
    if(loss <= 0) return;
    if(a.name && a.name.toLowerCase().indexOf('fan') >= 0) {
      accTotalFanLoss += loss;
      if(a.fanMode) accFanMode = a.fanMode;
    } else {
      accTotalOtherLoss += loss;
    }
  });
  var hasAccessoryLoss = (accTotalFanLoss + accTotalOtherLoss) > 0;

  function motorTorqueFn(rpm) {
    var T_gross = grossMotorTorqueFn(rpm);
    if(rpm <= 0) return T_gross;
    var P_loss_kW = (typeof veAccessoryLossKw === 'function')
      ? veAccessoryLossKw(accList, rpm, governedSpeed, accFanMode)
      : (hasAccessoryLoss ? (function(){ var ratio=rpm/governedSpeed; var Pf=(accFanMode==='on')?accTotalFanLoss:accTotalFanLoss*ratio*ratio*ratio; return Pf+accTotalOtherLoss*ratio; })() : 0);
    if(P_loss_kW <= 0) return T_gross;
    var omega = 2 * Math.PI * rpm / 60;
    return Math.max(0, T_gross - P_loss_kW * 1000 / omega);
  }

  // Tork konvertörü bileşeni
  var tcNode = nodes.find(function(n) { return n.type === 'torque-converter'; });
  var tcd = tcNode ? (tcNode.data || {}) : {};
  var tcDataArr = tcd.tcData || [];
  var pumpTorqueDrop = tcd.pumpTorqueDrop !== undefined ? parseFloat(tcd.pumpTorqueDrop) : 17.6;
  var tcFns = FT_SOLVER.createTCFunctions(tcDataArr);
  var hasTCData = tcDataArr.length >= 2;
  var hasEngineData = torqueTable.length >= 2;

  // Stall K_pump (SR=0)
  var K_pump_stall = tcFns.kpump(0);
  var TR_stall = tcFns.tau(0);

  // Transfer case bileşeni
  var transferNode = nodes.find(function(n) { return n.type === 'transfer'; });
  var trd = transferNode ? (transferNode.data || {}) : {};
  var ftTrGears = trd.ftTrGears || [
    { kademe: 'High', ratio: 1.054, eff: 97.00 },
    { kademe: 'Low', ratio: 2.337, eff: 97.00 }
  ];
  // Engel aşma için Low kademe kullan (varsayılan)
  var activeTransfer = ftTrGears.length > 1 ? ftTrGears[ftTrGears.length - 1] : ftTrGears[0];
  // Eğer obsData'da transferIdx belirtilmişse onu kullan
  if(obsData.transferIdx !== undefined && obsData.transferIdx < ftTrGears.length) {
    activeTransfer = ftTrGears[obsData.transferIdx];
  }
  var i_transfer = parseFloat(activeTransfer.ratio || activeTransfer.oran) || 1.054;
  var eta_transfer = (parseFloat(activeTransfer.eff || activeTransfer.verim) || 97) / 100;
  var transferName = activeTransfer.kademe || 'High';

  // Diferansiyel bileşeni
  var diffNode = nodes.find(function(n) { return n.type === 'differential'; });
  var dfd = diffNode ? (diffNode.data || {}) : {};
  var i_axle = parseFloat(dfd.diffRatio) || 6.54;
  var eta_axle = (parseFloat(dfd.efficiency) || 96) / 100;

  // Propşaft verimi
  var propshaftNodes = nodes.filter(function(n) { return n.type === 'propshaft'; });
  var eta_prop = 1.0;
  propshaftNodes.forEach(function(ps) {
    var psd = ps.data || {};
    eta_prop *= (parseFloat(psd.psEff) || 98.60) / 100;
  });

  // Vites verimi (stall'da N_turbine=0) — şanzıman kalibreliyse ölçülmüş katsayılarla
  var _gearEffCo = FT_SOLVER.resolveGearEff(gd);
  var eta_gear = selectedGear ? FT_SOLVER.calcGearEfficiency(parseFloat(selectedGear.ratio) || 1.0, 0, _gearEffCo) : 0.98;

  // Tahrikli teker sayısı (transfer kilitli + diff kilitli = 4, değilse 2)
  var n_d = 4; // Askeri araç varsayımı: 4x4, transfer ve diff kilitli
  var drivenPct = (parseFloat(vd.ftDrivenWeight) || 100) / 100;
  if(drivenPct < 1.0) n_d = 2;

  // Stall denge noktası hesabı
  var stallResult = null;
  if(hasEngineData && hasTCData) {
    // Rölantiden governed RPM'e kadar tarama: T_motor_mevcut ≥ T_pump olan son RPM
    var N_stall = idleRpm;
    var T_engine_stall = 0;
    var T_pump_stall = 0;

    for(var rpm = Math.ceil(idleRpm); rpm <= governedSpeed; rpm += 1) {
      var T_motor_mevcut = motorTorqueFn(rpm) - pumpTorqueDrop;
      var T_pump_abs = (rpm * rpm) / (K_pump_stall * K_pump_stall); // T_pump = (N / K_pump)²
      if(T_motor_mevcut >= T_pump_abs) {
        N_stall = rpm;
        T_engine_stall = motorTorqueFn(rpm); // Eğriden okunan tork (düşüm öncesi)
        T_pump_stall = T_pump_abs;
      } else {
        break; // Pump yükü motoru geçti, denge bulundu
      }
    }

    // Toplam mekanik verim: η_total = η_prop × η_axle × η_tc(transfer)
    var eta_total = eta_prop * eta_axle * eta_transfer * eta_gear;

    // Aktarma zincirinden teker torkuna:
    // T_turbine = T_pump × TR (T_engine × TR DEĞİL — SCAAN doğrulaması)
    // Motor torkun bir kısmı dönen kütlelerin ivmelenmesine gider,
    // sadece T_pump sıvı üzerinden türbine aktarılır.
    // Stall dengesinde T_pump ≈ T_engine - pump_drop, fark küçük ama prensip önemli.
    var T_turbine_stall = T_pump_stall * TR_stall;
    var T_wheel = T_turbine_stall * gearRatio * eta_total * i_transfer * i_axle / n_d;

    stallResult = {
      hasData: true,
      N_stall: N_stall,
      T_engine_stall: T_engine_stall,
      T_pump_stall: T_pump_stall,
      pumpTorqueDrop: pumpTorqueDrop,
      K_pump_stall: K_pump_stall,
      TR_stall: TR_stall,
      // Aktarma zinciri parametreleri
      gearName: gearName,
      gearRatio: gearRatio,
      eta_gear: eta_gear,
      transferName: transferName,
      i_transfer: i_transfer,
      eta_transfer: eta_transfer,
      i_axle: i_axle,
      eta_axle: eta_axle,
      eta_prop: eta_prop,
      eta_total: eta_total,
      n_d: n_d,
      T_wheel: T_wheel
    };
  } else {
    stallResult = {
      hasData: false,
      missingEngine: !hasEngineData,
      missingTC: !hasTCData
    };
  }

  result.stallAnalysis = stallResult;

  // ── ADIM 5: KARŞILAŞTIRMA & NİHAİ KARAR ──
  if(stallResult && stallResult.hasData) {
    var Tw = stallResult.T_wheel;

    // Ön teker: T_wheel vs T_req_ön
    var frontPass = Tw >= T_req_front;
    var frontMarginPct = T_req_front > 0 ? ((Tw - T_req_front) / T_req_front) * 100 : Infinity;

    // Arka teker: T_wheel vs T_req_arka
    var rearPass, rearMarginPct;
    if(isFinite(T_req_rear) && T_req_rear > 0) {
      rearPass = Tw >= T_req_rear;
      rearMarginPct = ((Tw - T_req_rear) / T_req_rear) * 100;
    } else {
      rearPass = false;
      rearMarginPct = -Infinity;
    }

    // Genel karar: her iki teker de aşmalı
    var overallPass = frontPass && rearPass;

    // Marj renk sınıflandırması: <0 kırmızı, 0-5 sarı, >5 yeşil
    function marginColor(pct) {
      if(pct < 0) return 'red';
      if(pct <= 5) return 'yellow';
      return 'green';
    }

    result.decision = {
      T_wheel: Tw,
      // Ön teker
      frontPass: frontPass,
      frontMarginNm: Tw - T_req_front,
      frontMarginPct: frontMarginPct,
      frontColor: marginColor(frontMarginPct),
      T_req_front: T_req_front,
      // Arka teker
      rearPass: rearPass,
      rearMarginNm: isFinite(T_req_rear) ? Tw - T_req_rear : -Infinity,
      rearMarginPct: rearMarginPct,
      rearColor: isFinite(rearMarginPct) ? marginColor(rearMarginPct) : 'red',
      T_req_rear: T_req_rear,
      // Genel
      overallPass: overallPass
    };

    result.canCross = overallPass;
    result.torqueMargin = Math.min(Tw - T_req_front, isFinite(T_req_rear) ? Tw - T_req_rear : -Infinity);
    result.torqueRatio = isFinite(T_req_rear) && T_req_rear > 0
      ? Math.min(Tw / T_req_front, Tw / T_req_rear)
      : (T_req_front > 0 ? Tw / T_req_front : 0);
  } else {
    result.canCross = true; // Veri eksik, geometrik geçerlilik yeterli
    result.decision = null;
  }

  // ── ADIM 5b: KÖŞE DEFLEKSİYONU DÜZELTMESİ (opsiyonel) ──
  if(hasCornerDefl && stallResult && stallResult.hasData) {
    var R_corner = R_eff - (cornerDeflection / 1000);

    // Geçerlilik kontrolü
    if(R_corner > 0 && h < R_corner && h !== R_corner) {
      var Tw_c = stallResult.T_wheel; // T_wheel değişmez
      var x_c = Math.sqrt(2 * R_corner * h - h * h);
      var theta_c_rad = Math.acos(x_c / R_corner);
      var theta_c_deg = theta_c_rad * 180 / Math.PI;
      var hR_c = h / R_corner;
      var diffLabel_c;
      if(hR_c < 0.5) diffLabel_c = 'Kolay';
      else if(hR_c < 0.75) diffLabel_c = 'Orta';
      else diffLabel_c = 'Zor';

      // Tork gereksinimleri
      var D_front_c = L + x_c;
      var N_f_c = W * a2 / D_front_c;
      var T_req_front_c = (N_f_c / 2) * x_c;

      var D_rear_c = L - x_c;
      var T_req_rear_c;
      if(D_rear_c <= 0) {
        T_req_rear_c = Infinity;
      } else {
        var N_r_c = W * a1 / D_rear_c;
        T_req_rear_c = (N_r_c / 2) * x_c;
      }

      // Karar
      var frontPass_c = Tw_c >= T_req_front_c;
      var frontMarginPct_c = T_req_front_c > 0 ? ((Tw_c - T_req_front_c) / T_req_front_c) * 100 : Infinity;
      var rearPass_c, rearMarginPct_c;
      if(isFinite(T_req_rear_c) && T_req_rear_c > 0) {
        rearPass_c = Tw_c >= T_req_rear_c;
        rearMarginPct_c = ((Tw_c - T_req_rear_c) / T_req_rear_c) * 100;
      } else {
        rearPass_c = false;
        rearMarginPct_c = -Infinity;
      }
      var overallPass_c = frontPass_c && rearPass_c;

      function marginColor_c(pct) {
        if(pct < 0) return 'red';
        if(pct <= 5) return 'yellow';
        return 'green';
      }

      result.cornerCorrection = {
        R_corner: R_corner,
        cornerDeflection: cornerDeflection,
        geometry: {
          x: x_c,
          theta_rad: theta_c_rad,
          theta_deg: theta_c_deg,
          hR_ratio: hR_c,
          difficultyLabel: diffLabel_c
        },
        torqueAnalysis: {
          D_front: D_front_c,
          T_req_front: T_req_front_c,
          D_rear: D_rear_c,
          T_req_rear: T_req_rear_c
        },
        decision: {
          T_wheel: Tw_c,
          frontPass: frontPass_c,
          frontMarginNm: Tw_c - T_req_front_c,
          frontMarginPct: frontMarginPct_c,
          frontColor: marginColor_c(frontMarginPct_c),
          T_req_front: T_req_front_c,
          rearPass: rearPass_c,
          rearMarginNm: isFinite(T_req_rear_c) ? Tw_c - T_req_rear_c : -Infinity,
          rearMarginPct: rearMarginPct_c,
          rearColor: isFinite(rearMarginPct_c) ? marginColor_c(rearMarginPct_c) : 'red',
          T_req_rear: T_req_rear_c,
          overallPass: overallPass_c
        }
      };
    }
  }

  result.timestamp = new Date().toISOString();
  return result;
}

// ══════════════════════════════════════════════════════════════════════════════
// ENGEL ATLAMA — DİNAMİK SİMÜLASYON (Zaman Adımlı)
// ══════════════════════════════════════════════════════════════════════════════
// Mevcut statik analizin sonuçlarını ve aktarma zinciri verilerini kullanarak
// zaman adımlı dinamik modelleme yapar.
// obsResult: veFTRunObstacleCrossingAnalysis() sonucu
// dynOpts: { dt, rampTime, Cr, J_engine, J_tc, momentumCarry }
function veFTRunObstacleDynamicSim(obsResult, dynOpts) {
  var _dynGbNode = nodes.find(function(n) { return n.type === 'gearbox'; });
  var _dynGearEffCo = FT_SOLVER.resolveGearEff(_dynGbNode ? (_dynGbNode.data || {}) : null);
  var opts = dynOpts || {};
  var dt = opts.dt || 0.001;                  // Zaman adımı (s) — varsayılan 1 ms
  var rampTime = opts.rampTime || 0.42;       // Gaz pedalı rampa süresi (s)
  var DD_initial = opts.DD_initial || 9;      // DD başlangıç değeri (%) — sürücü ayağı pedalde
  var Cr = opts.Cr || 0.015;                  // Yuvarlanma direnci katsayısı

  // Motor ataleti: önce opts'tan, yoksa motor bileşeninden oku
  var engineNode_dyn = nodes.find(function(n) { return n.type === 'engine'; });
  var ed_dyn = engineNode_dyn ? (engineNode_dyn.data || {}) : {};
  var specs_dyn = ed_dyn.motorSpecs || {};
  var J_engine_from_spec = parseFloat(specs_dyn.inertia);
  var J_engine = opts.J_engine || (isFinite(J_engine_from_spec) && J_engine_from_spec > 0 ? J_engine_from_spec : 0.50);

  var J_tc = opts.J_tc || 0.3;               // TC pump ataleti (kg·m²)
  var momentumCarry = false;                  // Arka teker her zaman v=0'dan başlar
  var maxTime = opts.maxTime || 30.0;         // Maksimum simülasyon süresi (s)
  var stallTimeout = opts.stallTimeout || 2.0; // Stall tespit süresi (s)

  // TC Sıvı Ataleti parametresi
  // Konvertör kabuğu içindeki ATF sıvısının rotasyonel ataleti.
  // CAN-bus doğrulaması: motor tork artışı ile TC pump quadratic yükü birbirini
  // dengelediğinden T_net ≈ sabit kalır → sabit J_eff ile doğrusal RPM artışı elde edilir.
  // SR'ye bağlı model gereksiz — CAN verisindeki doğrusal profille uyumsuz S-eğrisi üretir.
  // Kalibrasyon: CAN dN/dt ~700 RPM/s, sim ~490 → oran 1.4x → J_eff = 5.3/1.4 ≈ 3.8 → J_fluid ≈ 3.0
  var J_fluid = opts.J_fluid || 3.0;         // TC sıvı ataleti (kg·m²) — CAN dN/dt kalibrasyonu

  var inp = obsResult.inputParams;
  var stl = obsResult.stallAnalysis;
  if(!stl || !stl.hasData) {
    return { success: false, reason: 'Stall analiz verisi eksik.' };
  }

  var mass = inp.mass;
  // Köşe defleksiyonu varsa R_corner kullan (statik analizle tutarlılık)
  var R_eff = (obsResult.cornerCorrection && obsResult.cornerCorrection.R_corner > 0)
            ? obsResult.cornerCorrection.R_corner
            : inp.R_eff;
  var h = inp.h;
  var a1 = inp.a1;
  var a2 = inp.a2;
  var L = inp.wheelbase;
  var g_const = 9.81;
  var W = mass * g_const;
  var n_d = stl.n_d;
  var gbTorqueLimit_dyn = (inp.gbTorqueLimit && inp.gbTorqueLimit > 0) ? inp.gbTorqueLimit : null;

  // Aktarma oranları
  var i_g = stl.gearRatio;
  var i_tr = stl.i_transfer;
  var i_diff = stl.i_axle;
  var eta_total = stl.eta_total;
  var i_total = i_g * i_tr * i_diff;

  // Motor ve TC bileşenlerini yeniden oluştur
  var engineNode = nodes.find(function(n) { return n.type === 'engine'; });
  var ed = engineNode ? (engineNode.data || {}) : {};
  var torqueTable = ed.torqueData || [];
  var specs = ed.motorSpecs || {};
  var governedSpeed = parseFloat(specs.governedSpeed || ed.governedRpm) || 2100;
  var noLoadGoverned = parseFloat(specs.noLoadGoverned) || (governedSpeed + 200);
  var idleRpm = parseFloat(specs.idleRpm) || 700;

  var grossMotorTorqueFn = FT_SOLVER.createMotorTorqueFn(torqueTable, governedSpeed, noLoadGoverned);

  // Aksesuar kayıpları
  var accList = ed.accessories || [];
  var accTotalFanLoss = 0, accTotalOtherLoss = 0, accFanMode = 'clutch';
  accList.forEach(function(a) {
    var loss = parseFloat(a.userLoss) || 0;
    if(loss <= 0) return;
    if(a.name && a.name.toLowerCase().indexOf('fan') >= 0) {
      accTotalFanLoss += loss;
      if(a.fanMode) accFanMode = a.fanMode;
    } else {
      accTotalOtherLoss += loss;
    }
  });
  var hasAccessoryLoss = (accTotalFanLoss + accTotalOtherLoss) > 0;

  function motorTorqueFn(rpm) {
    var T_gross = grossMotorTorqueFn(rpm);
    if(rpm <= 0) return T_gross;
    var P_loss_kW = (typeof veAccessoryLossKw === 'function')
      ? veAccessoryLossKw(accList, rpm, governedSpeed, accFanMode)
      : (hasAccessoryLoss ? (function(){ var ratio=rpm/governedSpeed; var Pf=(accFanMode==='on')?accTotalFanLoss:accTotalFanLoss*ratio*ratio*ratio; return Pf+accTotalOtherLoss*ratio; })() : 0);
    if(P_loss_kW <= 0) return T_gross;
    var omega = 2 * Math.PI * rpm / 60;
    return Math.max(0, T_gross - P_loss_kW * 1000 / omega);
  }

  // TC fonksiyonları
  var tcNode = nodes.find(function(n) { return n.type === 'torque-converter'; });
  var tcd = tcNode ? (tcNode.data || {}) : {};
  var tcDataArr = tcd.tcData || [];
  var pumpTorqueDrop = tcd.pumpTorqueDrop !== undefined ? parseFloat(tcd.pumpTorqueDrop) : 14.9;
  var tcFns = FT_SOLVER.createTCFunctions(tcDataArr);

  // ══════════════════════════════════════════════════════════════════════════
  // MOTOR-KONVERTÖR EŞLEŞME TABLOSU (SCAAN Tarzı)
  // ══════════════════════════════════════════════════════════════════════════
  // Her SR için steady-state denge noktasını hesapla:
  //   T_engine(N) = T_pump(N, SR) + pump_drop  →  N_match bulunur
  //   T_turbine = T_pump × TR(SR)   (T_engine × TR DEĞİL — SCAAN doğrulaması)
  //   T_gb = T_turbine × i_g × η_gear
  //   T_wheel = T_gb × i_tr × i_diff × η_downstream / n_d
  // ══════════════════════════════════════════════════════════════════════════

  var matchTable = [];
  var K_pump_0 = (tcFns.data && tcFns.data.length > 0) ? tcFns.kpump(0) : 84.0;

  // Verim ayrıştırması
  var eta_gear_val = stl.eta_gear || 1.0;
  var eta_downstream_base = eta_gear_val > 0 ? eta_total / eta_gear_val : eta_total;

  // ── T_gb limit → Motor tork yüzdesi dönüşümü ──
  // Kullanıcı T_gb_limit girerse, program iteratif olarak motor tork yüzdesini bulur.
  // T_gb = T_pump × TR_stall × i_g × η_gear  ve  T_pump = (N / K_pump_0)²
  // T_motor_limited(N) = T_gross(N) × pct
  // Stall dengesi: T_gross(N) × pct = T_pump(N) + pump_drop  iterasyonla çözülür.
  var motorTorquePct = 1.0;  // varsayılan: %100 (limit yok)
  if(gbTorqueLimit_dyn) {
    var TR_0 = tcFns.tau(0);
    // İlk tahmin: stall'dan ters hesap
    var T_pump_target = gbTorqueLimit_dyn / (TR_0 * i_g * eta_gear_val);
    var N_stall_est = K_pump_0 * Math.sqrt(Math.max(0, T_pump_target));
    N_stall_est = Math.max(idleRpm, Math.min(governedSpeed, N_stall_est));

    // İteratif çözüm (2-5 iterasyon yeterli)
    for(var pctIter = 0; pctIter < 10; pctIter++) {
      var T_gross_at_stall = motorTorqueFn(N_stall_est);
      if(T_gross_at_stall <= 0) break;
      var T_motor_needed = T_pump_target + pumpTorqueDrop;
      motorTorquePct = T_motor_needed / T_gross_at_stall;
      motorTorquePct = Math.max(0.1, Math.min(1.0, motorTorquePct));

      // Yeni stall RPM hesapla: T_gross(N) × pct = (N/K)² + pump_drop
      var N_new = idleRpm;
      for(var rpm2 = Math.ceil(idleRpm); rpm2 <= governedSpeed; rpm2 += 1) {
        var T_lim = motorTorqueFn(rpm2) * motorTorquePct;
        var T_p = (rpm2 / K_pump_0) * (rpm2 / K_pump_0);
        if(T_lim >= T_p + pumpTorqueDrop) {
          N_new = rpm2;
        } else {
          break;
        }
      }

      // Yakınsama kontrolü
      if(Math.abs(N_new - N_stall_est) < 1) break;
      N_stall_est = N_new;

      // T_pump_target'ı güncelle (stall RPM değişti)
      T_pump_target = (N_stall_est / K_pump_0) * (N_stall_est / K_pump_0);
    }
  }

  // Limitli motor tork fonksiyonu
  var motorTorqueLimitedFn = function(rpm) {
    return motorTorqueFn(rpm) * motorTorquePct;
  };

  var matchSRs = [0.00, 0.10, 0.20, 0.30, 0.40, 0.50, 0.60, 0.634, 0.70, 0.75, 0.80, 0.825, 0.85, 0.875, 0.91, 0.924, 0.939, 0.95, 0.975, 0.99];
  for(var mi = 0; mi < matchSRs.length; mi++) {
    var sr_m = matchSRs[mi];
    var K_m = (tcFns.data && tcFns.data.length > 0) ? tcFns.kpump(sr_m) : 84.0;
    var TR_m = tcFns.tau(sr_m);

    // Denge noktası: T_engine_limited(N) = (N / K_m)² + pump_drop
    var N_m = 2000;
    for(var iter = 0; iter < 100; iter++) {
      var T_eng_m = motorTorqueLimitedFn(N_m);
      var T_pump_m = (N_m / K_m) * (N_m / K_m);
      var residual = T_eng_m - T_pump_m - pumpTorqueDrop;
      var dTe = (motorTorqueLimitedFn(N_m + 1) - motorTorqueLimitedFn(N_m - 1)) / 2;
      var dTp = 2 * N_m / (K_m * K_m);
      var dR = dTe - dTp;
      if(Math.abs(dR) < 1e-8) break;
      N_m = N_m - residual / dR;
      N_m = Math.max(idleRpm, Math.min(noLoadGoverned, N_m));
      if(Math.abs(residual) < 0.1) break;
    }

    // Denge bulunamadıysa (motor torku her yerde pump'tan yüksek): governed hız kullan
    var T_eng_check = motorTorqueLimitedFn(N_m);
    var T_pump_check = (N_m / K_m) * (N_m / K_m);
    if(N_m <= idleRpm + 5 || (T_eng_check - T_pump_check - pumpTorqueDrop) > 50) {
      N_m = governedSpeed;
    }

    var T_eng_final = motorTorqueLimitedFn(N_m);
    var T_pump_final = (N_m / K_m) * (N_m / K_m);
    var T_turbine_m = T_pump_final * TR_m;
    var _eta_gear_m = FT_SOLVER.calcGearEfficiency(i_g, N_m * sr_m, _dynGearEffCo);
    var T_gb_m = T_turbine_m * i_g * _eta_gear_m;
    var T_wheel_m = T_gb_m * i_tr * i_diff * eta_downstream_base / n_d;

    var eta_tc_m = sr_m > 0 ? (sr_m * TR_m) : 0;
    var P_eng_kW = T_eng_final * N_m * 2 * Math.PI / 60 / 1000;
    var P_turb_kW = T_turbine_m * (N_m * sr_m) * 2 * Math.PI / 60 / 1000;
    var Q_reject_kW = P_eng_kW - P_turb_kW;

    var matchPoint = '';
    if(sr_m === 0) matchPoint = 'Stall';
    else if(eta_tc_m >= 0.69 && eta_tc_m < 0.71) matchPoint = '70 Percent';
    else if(eta_tc_m >= 0.79 && eta_tc_m < 0.81) matchPoint = '80 Percent';
    else if(eta_tc_m >= 0.84 && eta_tc_m < 0.86) matchPoint = '85 Percent';
    else if(Math.abs(TR_m - 1.0) < 0.02) matchPoint = 'Coupling';
    else if(N_m >= governedSpeed - 10) matchPoint = 'Governed';

    matchTable.push({
      SR: sr_m,
      TR: TR_m,
      K_pump: K_m,
      N_engine: Math.round(N_m),
      T_engine: Math.round(T_eng_final * 10) / 10,
      P_engine_kW: Math.round(P_eng_kW * 10) / 10,
      T_pump: Math.round(T_pump_final * 10) / 10,
      T_turbine: Math.round(T_turbine_m * 10) / 10,
      T_gb_out: Math.round(T_gb_m * 10) / 10,
      T_wheel: Math.round(T_wheel_m * 10) / 10,
      P_turbine_kW: Math.round(P_turb_kW * 10) / 10,
      Q_reject_kW: Math.round(Q_reject_kW * 100) / 100,
      eta_tc: Math.round(eta_tc_m * 1000) / 1000,
      matchPoint: matchPoint
    });
  }

  // Başlangıç açısı
  var x0 = Math.sqrt(2 * R_eff * h - h * h);
  var phi_start = Math.asin(x0 / R_eff);

  // Durum değişkenleri
  var v = 0;
  var N_engine = idleRpm;
  var t = 0;
  var phi = phi_start;
  var phase = 'front'; // 'front' veya 'rear'
  var frontCompleted = false;
  var frontCompletionTime = 0;
  var frontCompletionSpeed = 0;
  var stallDetected = false;
  var stallPhase = '';
  var simComplete = false;
  var simSuccess = false;
  var reason = '';
  var stallCheckStart = -1; // Gaz %100 ve v=0 olduğu ilk an

  // Zaman serisi verileri (kullanıcı seçimine göre kaydet)
  var log = [];
  var logIntervalSec = opts.logInterval || 0.01; // varsayılan 10 ms
  var logInterval = Math.max(1, Math.round(logIntervalSec / dt));
  var stepCount = 0;
  var maxSteps = Math.ceil(maxTime / dt);

  // Rölanti torku yaklaşımı
  var T_idle_ratio = 0.21;

  // Faz özet verileri
  var frontPeakTreq = 0, frontPeakTwheel = 0, frontMaxSpeed = 0;
  var rearPeakTreq = 0, rearPeakTwheel = 0, rearMaxSpeed = 0;
  var frontPeakTreqTime = 0, rearPeakTreqTime = 0;

  // Milestone (önemli olay) takibi
  var milestones = [];
  var _ms = {}; // tekrar eklememek için bayraklar

  function addMilestone(key, label, data) {
    if(_ms[key]) return;
    _ms[key] = true;
    var m = { key: key, t: t, label: label, phase: phase };
    if(data) {
      for(var k in data) { if(data.hasOwnProperty(k)) m[k] = data[k]; }
    }
    milestones.push(m);
  }

  // Önceki adımdaki bazı değerler (değişim tespiti için)
  var gbLimitActivated = false;  // T_gb henüz limite ulaşmadı
  var prev_v = 0;
  var prev_phi = phi_start;
  var prev_T_wheel_vs_req = false; // T_wheel >= T_req miydi?

  // ── ANA DÖNGÜ ──
  while(stepCount < maxSteps && !simComplete) {
    stepCount++;

    // ── Hesap 1: Sürücü talebi (DD) ──
    // Engel senaryosunda sürücü tam gaz — DD her zaman %100
    var DD = 100;

    // ── Hesap 2: TC hız oranı (SR) ──
    var N_turbin = (v > 1e-6) ? (v / R_eff) * i_total * 60 / (2 * Math.PI) : 0;
    var SR = (N_engine > 0) ? Math.min(0.99, N_turbin / N_engine) : 0;

    // ── Hesap 3: TC tork oranı (TR) ──
    var TR = tcFns.tau(SR);

    // ── Hesap 4b: Pump torku (TC sıvı yükü) — önce hesaplanır ──
    // T_pump = (N / K_pump_stall)² — pump'ın sıvıya uyguladığı tork
    // Stall K-factor kullanılır (SR=0): transient'te TC sıvı ataleti
    // K_pump'ın SR ile değişimini geciktirir → sabit K_pump yaklaşımı.
    var T_pump_absorbed = (N_engine / K_pump_0) * (N_engine / K_pump_0);

    // ── T_gb limit aktivasyon kontrolü ──
    // T_gb'yi tam yükte hesapla, limite ulaştı mı bak
    var T_turbine_check = T_pump_absorbed * TR;
    var T_gb_check = T_turbine_check * i_g * eta_gear_val;
    if(gbTorqueLimit_dyn && !gbLimitActivated && T_gb_check >= gbTorqueLimit_dyn) {
      gbLimitActivated = true;
      addMilestone(msPrefix + 'gb_limit', (phase === 'front' ? 'On' : 'Arka') + ' teker: T_gb limite ulasti (' + Math.round(gbTorqueLimit_dyn) + ' Nm), motor tork %' + (motorTorquePct * 100).toFixed(1) + ' ile sinirlandirildi', {
        T_gb_out: T_gb_check, N_engine: N_engine
      });
    }

    // ── Hesap 4: Motor torku ──
    // T_gb limite ulaşmadan: motor tam yükte çalışır (%100)
    // T_gb limite ulaştıktan sonra: motor tork yüzdesi uygulanır
    var T_full_load = motorTorqueFn(N_engine);
    var T_engine = gbLimitActivated ? (T_full_load * motorTorquePct) : T_full_load;

    // ── Hesap 5: Şanzıman çıkış torku ve teker torku ──
    // SCAAN doğrulaması: T_turbine = T_pump × TR  (T_engine × TR DEĞİL!)
    // Motor torkun bir kısmı dönen kütlelerin ivmelenmesine gider (J_eff × α).
    // Sadece T_pump sıvı üzerinden türbine aktarılır.
    var T_turbine = T_pump_absorbed * TR;
    var T_gb_out = T_turbine * i_g * eta_gear_val;
    var T_gb_limited = gbLimitActivated;
    // T_wheel = T_gb_out × i_tr × i_diff × η_downstream / n_d
    var T_wheel = T_gb_out * eta_downstream_base * i_tr * i_diff / n_d;

    // ── Hesap 6: Anlık gerekli tork ──
    var moment_kolu = R_eff * Math.sin(phi);
    var T_req_anlik = 0;
    var N_aks = 0; // Aktif akstaki toplam reaksiyon (ikiye bölünmemiş)
    if(moment_kolu > 0) {
      if(phase === 'front') {
        var D_on = L + moment_kolu;
        N_aks = W * a2 / D_on;
        T_req_anlik = (N_aks / 2) * moment_kolu;
      } else {
        var D_arka = L - moment_kolu;
        if(D_arka > 0) {
          N_aks = W * a1 / D_arka;
          T_req_anlik = (N_aks / 2) * moment_kolu;
        } else {
          N_aks = Infinity;
          T_req_anlik = Infinity;
        }
      }
    }
    // moment_kolu <= 0: tepeyi geçmiş, T_req = 0

    // ── Hesap 7: Net kuvvet ve ivme ──
    // İtme kuvveti: engeldeki aks + düz zemindeki aksın katkısı (φ-bağımlı)
    // Engeldeki 2 teker: direkt tork → moment = T_wheel × 2
    // Düz zemindeki 2 teker: yatay kuvvet, P'ye moment kolu = R_corner × cos(φ)
    //   φ=75.5° (başlangıç): cos=0.244 → düşük katkı
    //   φ=0° (tepe): cos=1.0 → maksimum katkı
    // n_eff(φ) = 2 × [1 + (R_corner / R_eff) × cos(φ)]
    var R_corner_val = R_eff;  // dinamik simde R_eff zaten R_corner olabilir
    var R_flat_val = inp.R_eff;  // düz zemindeki teker yarıçapı
    var cos_phi = Math.cos(phi);
    var n_eff = 2 * (1 + (R_corner_val / R_flat_val) * cos_phi);
    var F_itme = T_wheel * n_eff / R_eff;
    var F_engel = 0;
    if(moment_kolu > 0 && isFinite(N_aks)) {
      F_engel = N_aks * moment_kolu / R_eff;
    }
    // Yuvarlanma direnci: engel senaryosunda ihmal edilebilir (~%2.6)
    // Engel direnci ~42kN, yuvarlanma ~1.1kN — ayrıca v=0'da chatter yaratıyor
    var F_yuvarlanma = 0;
    var F_net = F_itme - F_engel - F_yuvarlanma;
    var acc = F_net / mass;

    // Durma koruması: hız sıfır ve net kuvvet negatifse ivme sıfır
    if(v < 1e-9 && F_net <= 0) {
      acc = 0;
    }

    // ── Hesap 8: Hız ve açı güncelleme ──
    var v_new = Math.max(0, v + acc * dt);
    var phi_new = phi;
    if(v_new > 1e-9) {
      var dPhi = v_new / R_eff * dt;
      phi_new = phi - dPhi;
    }

    // ── Hesap 9: Motor devri güncelleme — TC sıvı dinamiği modeli ──
    //
    // Fizik: Motor, TC pump'ın quadratic yükü ve sıvı ataleti ile dengelenir.
    //   T_pump(N) = (N / K_pump_stall)²  — Hesap 4b'de hesaplandı
    //   T_net = T_engine(N) - T_pump(N) - pump_drop
    //   J_eff = J_mech + J_fluid (sabit)
    //   alpha = T_net / J_eff              — açısal ivmelenme
    //
    // Motor doğal olarak stall devrinde (~N_stall) stabilize olur.
    // Governed devrine (2500 RPM) asla ulaşamaz — TC pump yükü baskın.
    // ECM rate limiter YOK — yavaş devir artışı tamamen sıvı ataleti.

    // T_pump_absorbed zaten Hesap 4b'de hesaplandı: (N_engine / K_pump_0)²

    // Net tork: motor çıkışı - pump yükü - mekanik kayıplar
    var T_net_engine = T_engine - T_pump_absorbed - pumpTorqueDrop;

    // Efektif atalet: mekanik parçalar + TC sıvı ataleti (sabit)
    // CAN-bus doğrulaması: T_net ≈ sabit olduğundan sabit J_eff
    // doğrusal RPM artış profili üretir (CAN ile uyumlu).
    var J_mech = J_engine + J_tc;
    var J_eff = J_mech + J_fluid;

    // Açısal ivmelenme
    var alpha_engine = 0;
    if(T_net_engine > 0) {
      alpha_engine = T_net_engine / J_eff;
    } else if(T_net_engine < 0 && N_engine > idleRpm) {
      // Negatif net tork: motor yavaşlıyor (stall üzerindeyse)
      alpha_engine = T_net_engine / J_eff;
    }

    // RPM güncelleme
    var omega_engine = N_engine * 2 * Math.PI / 60;
    var omega_new = omega_engine + alpha_engine * dt;
    var N_engine_new = omega_new * 60 / (2 * Math.PI);

    // Sınırla: rölanti altına düşmesin
    N_engine_new = Math.max(idleRpm, N_engine_new);

    // ── Faz özet istatistikler ──
    if(phase === 'front') {
      if(T_req_anlik > frontPeakTreq) { frontPeakTreq = T_req_anlik; frontPeakTreqTime = t; }
      if(T_wheel > frontPeakTwheel) frontPeakTwheel = T_wheel;
      if(v_new > frontMaxSpeed) frontMaxSpeed = v_new;
    } else {
      if(T_req_anlik > rearPeakTreq) { rearPeakTreq = T_req_anlik; rearPeakTreqTime = t; }
      if(T_wheel > rearPeakTwheel) rearPeakTwheel = T_wheel;
      if(v_new > rearMaxSpeed) rearMaxSpeed = v_new;
    }

    // ── Milestone tespitleri ──
    var msPrefix = phase === 'front' ? 'f_' : 'r_';

    // Teker engele dokunuyor (simülasyon başlangıcı)
    if(stepCount === 1) {
      addMilestone('f_contact', 'On teker engel kosesine temas', {
        phi_deg: phi * 180 / Math.PI, T_req: T_req_anlik, T_wheel: T_wheel
      });
    }

    // İlk hareket anı (v sıfırdan pozitife geçiş)
    if(prev_v < 1e-9 && v_new > 1e-6) {
      addMilestone(msPrefix + 'first_move', (phase === 'front' ? 'On' : 'Arka') + ' teker harekete basladi', {
        v: v_new, T_wheel: T_wheel, T_req: T_req_anlik, N_engine: N_engine_new, DD: DD
      });
    }

    // T_wheel ilk kez T_req'i aştı (yeterli tork anı)
    var currentTwVsReq = isFinite(T_req_anlik) && T_wheel >= T_req_anlik;
    if(currentTwVsReq && !prev_T_wheel_vs_req && T_req_anlik > 0) {
      addMilestone(msPrefix + 'torque_sufficient', (phase === 'front' ? 'On' : 'Arka') + ' teker: T_wheel >= T_req', {
        T_wheel: T_wheel, T_req: T_req_anlik, margin_pct: ((T_wheel - T_req_anlik) / T_req_anlik * 100)
      });
    }
    prev_T_wheel_vs_req = currentTwVsReq;

    // Gaz pedalı %100'e ulaştı
    if(DD >= 100 && !_ms['gas_100']) {
      addMilestone('gas_100', 'Gaz pedali %100 (tam yuk)', {
        N_engine: N_engine_new, T_engine: T_engine, T_wheel: T_wheel
      });
    }

    // Tepe noktası (φ sıfırı geçiyor, teker P'nin tam üstüne geliyor)
    if(prev_phi > 0 && phi_new <= 0) {
      addMilestone(msPrefix + 'apex', (phase === 'front' ? 'On' : 'Arka') + ' teker tepe noktasina ulasti (phi=0)', {
        v: v_new, phi_deg: phi_new * 180 / Math.PI, T_wheel: T_wheel, KE: 0.5 * mass * v_new * v_new
      });
    }

    // Arka teker fazına geçiş milestone'u (faz geçişi kodundan sonra eklenir, aşağıda)

    prev_v = v_new;
    prev_phi = phi_new;

    // ── Veri kaydı ──
    if(stepCount % logInterval === 0 || stepCount === 1) {
      log.push({
        t: t,
        v: v_new,
        N_engine: N_engine_new,
        T_engine: T_engine,
        T_pump: T_pump_absorbed,
        T_turbine: T_turbine,
        TR: TR,
        SR: SR,
        T_gb_out: T_gb_out,
        T_gb_lim: T_gb_limited,
        T_wheel: T_wheel,
        T_req: T_req_anlik,
        phi_deg: phi_new * 180 / Math.PI,
        F_itme: F_itme,
        F_engel: F_engel,
        F_net: F_net,
        KE: 0.5 * mass * v_new * v_new,
        DD: DD,
        phase: phase
      });
    }

    // ── Hesap 10: Faz geçişi kontrolü ──
    if(phi_new <= -phi_start) {
      if(phase === 'front') {
        frontCompleted = true;
        frontCompletionTime = t;
        frontCompletionSpeed = v_new;
        addMilestone('f_complete', 'On teker engeli asti', {
          v: v_new, duration: t, KE: 0.5 * mass * v_new * v_new
        });
        // Arka teker fazına geç
        phase = 'rear';
        phi_new = phi_start; // Arka teker için sıfırla
        // Arka teker engele değdiğinde araç durur — momentum taşınmaz
        v_new = 0;
        N_engine_new = idleRpm;
        stallCheckStart = -1; // Stall sayacını sıfırla
        prev_T_wheel_vs_req = false; // Arka teker için sıfırla
        gbLimitActivated = false;   // Arka teker için T_gb limiti tekrar tetiklenebilir
        // (ECM kaldırıldı — TC sıvı dinamiği modeli kullanılıyor)
        addMilestone('r_contact', 'Arka teker engel kosesine temas', {
          phi_deg: phi_new * 180 / Math.PI, v: v_new, N_engine: N_engine_new
        });
      } else {
        // Arka teker de aştı — başarılı
        addMilestone('r_complete', 'Arka teker engeli asti', {
          v: v_new, totalTime: t, KE: 0.5 * mass * v_new * v_new
        });
        simComplete = true;
        simSuccess = true;
        reason = 'Her iki teker de engeli basariyla asti.';
      }
    }

    // ── Stall kontrolü ──
    // Motor devri artarken T_wheel de artıyor — stall kararı vermek için
    // motorun stall dengesine oturmasını beklemek gerekir.
    // Koşul: v=0 VE T_wheel < T_req VE motor devri artışı durmuş (dN/dt ≈ 0)
    var motorSettled = (N_engine_new > 0 && Math.abs(N_engine_new - N_engine) / dt < 5.0);
    if(!simComplete && v_new < 1e-9 && DD >= 99.9 && isFinite(T_req_anlik) && T_wheel < T_req_anlik) {
      if(motorSettled) {
        // Motor stall dengesine ulaştı ve T_wheel hâlâ yetersiz → gerçek stall
        if(stallCheckStart < 0) {
          stallCheckStart = t;
        } else if(t - stallCheckStart >= 0.5) {
          // Motor settle olduktan sonra 0.5s daha bekle (kararlılık)
          stallDetected = true;
          stallPhase = phase;
          simComplete = true;
          simSuccess = false;
          reason = (phase === 'front' ? 'On' : 'Arka') + ' teker fazinda arac takildi (stall). T_wheel (' +
                   T_wheel.toFixed(0) + ' Nm) < T_req (' + T_req_anlik.toFixed(0) + ' Nm).';
          addMilestone(phase === 'front' ? 'f_stall' : 'r_stall',
            (phase === 'front' ? 'On' : 'Arka') + ' teker: STALL — arac takildi', {
            T_wheel: T_wheel, T_req: T_req_anlik, N_engine: N_engine_new, phi_deg: phi_new * 180 / Math.PI
          });
        }
      } else {
        // Motor hâlâ devir artırıyor — stall sayacını sıfırla
        stallCheckStart = -1;
      }
    } else {
      if(v_new > 1e-6) stallCheckStart = -1;
    }

    // Zaman aşımı kontrolü
    if(!simComplete && t >= maxTime) {
      simComplete = true;
      simSuccess = false;
      reason = 'Maksimum simulasyon suresi asildi (' + maxTime + ' s).';
    }

    // Durumları güncelle
    v = v_new;
    phi = phi_new;
    N_engine = N_engine_new;
    t += dt;
  }

  // Son kayıt
  log.push({
    t: t,
    v: v,
    N_engine: N_engine,
    T_engine: 0,
    TR: 0,
    SR: 0,
    T_wheel: 0,
    T_req: 0,
    phi_deg: phi * 180 / Math.PI,
    F_itme: 0,
    F_engel: 0,
    F_net: 0,
    KE: 0.5 * mass * v * v,
    DD: 100,
    phase: phase
  });

  return {
    success: simSuccess,
    reason: reason,
    totalTime: t,
    totalSteps: stepCount,
    dt: dt,
    // Faz bilgileri
    frontCompleted: frontCompleted,
    frontCompletionTime: frontCompletionTime,
    frontCompletionSpeed: frontCompletionSpeed,
    stallDetected: stallDetected,
    stallPhase: stallPhase,
    // Faz istatistikleri
    frontStats: {
      peakTreq: frontPeakTreq,
      peakTreqTime: frontPeakTreqTime,
      peakTwheel: frontPeakTwheel,
      maxSpeed: frontMaxSpeed
    },
    rearStats: {
      peakTreq: rearPeakTreq,
      peakTreqTime: rearPeakTreqTime,
      peakTwheel: rearPeakTwheel,
      maxSpeed: rearMaxSpeed
    },
    // Milestone olayları
    milestones: milestones,
    // Motor-Konvertör Eşleşme Tablosu
    matchTable: matchTable,
    // Parametreler
    params: {
      rampTime: rampTime,
      DD_initial: DD_initial,
      Cr: Cr,
      J_engine: J_engine,
      J_engine_source: (isFinite(J_engine_from_spec) && J_engine_from_spec > 0) ? 'motor bileseni' : 'varsayilan',
      J_tc: J_tc,
      momentumCarry: false,
      phi_start_deg: phi_start * 180 / Math.PI,
      J_fluid: J_fluid,
      gbTorqueLimit: gbTorqueLimit_dyn,
      motorTorquePct: motorTorquePct,
      logIntervalSec: logIntervalSec
    },
    // Zaman serisi
    log: log
  };
}
