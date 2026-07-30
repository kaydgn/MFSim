// ===== MOTOR-TC EŞLEŞTİRME BİLEŞENİ =====

function getECMatchingPropertiesHTML(node) {
  var nd = node.data || {};
  var html = '';
  
  // Başlık
  html += '<div class="sw-panel ve-cp-panel">';
  html += '<div class="sw-section-title">Motor — Konvertör Eşleştirme Analizi</div>';
  html += '<div class="sw-pkg-desc">Motor çıkış portuna bağlanmalıdır. Allison TD-148G standardına göre motor-konvertör uyumluluğunu analiz eder. C4/C5/C7/C8/C9/C10 kontrollerini uygular.</div>';

  // İki sütun (asimetrik) — İNCE SOL ray: motor özeti + türbin limiti girdisi
  html += '<div class="ve-cp-grid ve-cp-grid--wideright"><div class="ve-cp-col ve-cp-col--in">';

  // Motor algılama bilgisi
  html += '<div id="ecm-engine-info-' + node.id + '" style="padding:10px 12px; border-bottom:1px solid var(--border-color);">';
  html += '<div style="font-size:var(--fs-tiny); color:var(--text-muted);">Motor bileşeni aranıyor...</div>';
  html += '</div>';
  
  // Şanzıman Türbin Torku Rating
  var turbineRating = nd.turbineRating || 3320;
  html += '<div class="sw-pkg-card" style="margin-bottom:10px;">';
  html += '<div class="sw-pkg-header" style="cursor:default;"><span class="sw-pkg-name">Şanzıman Türbin Torku Limiti</span></div>';
  html += '<div class="sw-pkg-body">';
  html += '<table style="width:100%; border-collapse:collapse; font-size:var(--fs-body);">';
  html += '<tr>';
  html += '<th style="padding:6px 8px; text-align:left; background:var(--bg-tertiary); border:1px solid var(--border-color); font-weight:500; color:var(--text-secondary); width:55%;">Şanzıman Türbin Torku Limiti [N·m]</th>';
  html += '<td style="padding:4px 6px; border:1px solid var(--border-color); background:var(--bg-secondary);"><input type="number" id="ecm-turbine-rating-' + node.id + '" value="' + turbineRating + '" step="10" min="500" style="width:100%; padding:4px; font-size:var(--fs-body); background:var(--bg-input); color:var(--text-primary); border:1px solid var(--border-color); border-radius:var(--radius-sm); text-align:right;" onchange="onECMParamChange(\'' + node.id + '\')"></td>';
  html += '</tr>';
  html += '</table>';
  html += '<div class="sw-pkg-desc">C7 kontrolü için kullanılır. Şanzıman preseti seçildiğinde otomatik güncellenir (Net Turbine Torque limiti).</div>';
  html += '</div></div>';
  html += '</div>';                                     // ve-cp-col--in kapat (ince sol ray)
  html += '<div class="ve-cp-col ve-cp-col--out">';     // GENİŞ SAĞ: sonuç tablosu + grafik

  // Analiz sonuç tablosu
  html += '<div id="ecm-results-' + node.id + '" style="padding:10px 12px;">';
  html += '<div style="text-align:center; padding:20px; color:var(--text-muted); font-size:var(--fs-body);">Analiz bekleniyor... Motor bileşeni tanımlandığında otomatik çalışır.</div>';
  html += '</div>';
  
  // Absorption chart canvas — Büyüt butonu canvas üzerinde
  html += '<div class="sw-pkg-card" style="margin-bottom:10px;">';
  html += '<div class="sw-pkg-header" style="cursor:default;"><span class="sw-pkg-name">Motor Eğrisi × Konvertör Kapasiteleri</span></div>';
  html += '<div class="sw-pkg-body">';
  html += '<div style="position:relative;">';
  html += '<canvas id="ecm-chart-' + node.id + '" width="440" height="300" style="width:100%; height:auto; background:var(--bg-input); border:1px solid var(--border-color);"></canvas>';
  html += '<button class="sw-btn sw-btn-outline" onclick="ecmExpandChart(\'' + node.id + '\')" title="Diyagramı büyüt" style="position:absolute; top:6px; right:6px; font-size:var(--fs-micro); padding:2px 6px; opacity:0.7;"><span class="mf-ico mf-ico-maximize"></span> Büyüt</button>';
  html += '</div>';
  html += '<div class="sw-pkg-desc">Motor net tork eğrisi (sarı) ile tüm konvertörlerin stall ve 0.80 SR kapasite eğrileri gösterilmektedir. Kesişim noktaları stall devir ve 0.80 SR çalışma noktalarını verir.</div>';
  html += '</div></div>';
  html += '</div>';  // ve-cp-col--out kapat
  html += '</div>';  // ve-cp-grid kapat
  html += '</div>'; // close sw-panel

  return html;
}

function onECMParamChange(nodeId) {
  var node = nodes.find(function(n) { return n.id === nodeId; });
  if(!node) return;
  if(!node.data) node.data = {};
  var ratingEl = document.getElementById('ecm-turbine-rating-' + nodeId);
  if(ratingEl) { var n = parseFloat(ratingEl.value); node.data.turbineRating = isNaN(n) ? 3320 : n; }
  runECMatchingAnalysis(nodeId);
}

// ── ANA ANALİZ FONKSİYONU ──
function runECMatchingAnalysis(nodeId) {
  var node = nodes.find(function(n) { return n.id === nodeId; });
  if(!node) return;
  if(!node.data) node.data = {};
  
  var turbineRating = node.data.turbineRating || 3320;

  // Şanzıman limit verilerini al
  var gbNode = nodes.find(function(n) { return n.type === 'gearbox'; });
  var gbLimits = { grossInputPower: null, grossInputTorque: null, maxOutputSpeed: null };
  if(gbNode && gbNode.data) {
    var gbKey = gbNode.data.ftGBPreset || gbNode.data.selectedGearbox || '';
    if(gbKey && VE_GEARBOX_PRESETS[gbKey]) {
      var gbPreset = VE_GEARBOX_PRESETS[gbKey];
      gbLimits.grossInputPower = gbPreset.grossInputPower;
      gbLimits.grossInputTorque = gbPreset.grossInputTorque;
      gbLimits.maxOutputSpeed = gbPreset.maxOutputSpeed;
    }
  }

  // Bağlı motor bileşenini bul (yalnızca bağlantı üzerinden)
  var engineNode = findConnectedEngine(nodeId);

  var infoEl = document.getElementById('ecm-engine-info-' + nodeId);
  var resultsEl = document.getElementById('ecm-results-' + nodeId);

  if(!engineNode || !engineNode.data || !engineNode.data.torqueData || engineNode.data.torqueData.length < 2) {
    if(infoEl) infoEl.innerHTML = '<div style="padding:8px; background:color-mix(in srgb, var(--accent-danger) 10%, transparent); border:1px solid color-mix(in srgb, var(--accent-danger) 30%, transparent); border-radius:var(--radius-sm); font-size:var(--fs-tiny); color:var(--accent-danger);">⚠ Motor bileşenine bağlı değil veya tork verisi girilmemiş. Lütfen bu bileşenin giriş portunu Motor bileşeninin çıkış portuna bağlayın.</div>';
    return;
  }
  
  // Motor verilerini al
  var torqueData = engineNode.data.torqueData || [];
  var motorSpecs = engineNode.data.motorSpecs || {};
  var governed = motorSpecs.governedSpeed || engineNode.data.governedRpm || 2100;
  var noLoadGov = motorSpecs.noLoadGoverned || governed + 200;
  var engineName = engineNode.data.motorName || engineNode.customName || 'Motor';
  var defaultPumpDrop = 17.6; // Allison 3000 family default (bilgi panelinde gösterilir)
  
  // Peak torque bul
  var peakT = 0, peakRPM = 0;
  torqueData.forEach(function(d) {
    if(d.torque > peakT) { peakT = d.torque; peakRPM = d.rpm; }
  });

  // Governed devirdeki tork ve güç hesabı (C9/C10 kontrolleri için)
  var torqueAtGov = 0;
  if(torqueData.length >= 2) {
    // İnterpolasyon
    if(governed <= torqueData[0].rpm) torqueAtGov = torqueData[0].torque;
    else if(governed >= torqueData[torqueData.length-1].rpm) torqueAtGov = torqueData[torqueData.length-1].torque;
    else {
      for(var ti = 0; ti < torqueData.length - 1; ti++) {
        if(torqueData[ti].rpm <= governed && governed <= torqueData[ti+1].rpm) {
          var tf = (governed - torqueData[ti].rpm) / (torqueData[ti+1].rpm - torqueData[ti].rpm);
          torqueAtGov = torqueData[ti].torque + tf * (torqueData[ti+1].torque - torqueData[ti].torque);
          break;
        }
      }
    }
  }
  var powerAtGov = torqueAtGov * governed * Math.PI / 30000; // kW = T(Nm) * RPM * π / 30000

  // C9/C10 kontrolleri
  var c9ok = true, c10ok = true;
  if(gbLimits.grossInputPower !== null) c9ok = powerAtGov <= gbLimits.grossInputPower;
  if(gbLimits.grossInputTorque !== null) c10ok = torqueAtGov <= gbLimits.grossInputTorque;

  // Motor bilgi paneli
  if(infoEl) {
    var c9c10html = '';
    if(gbLimits.grossInputPower !== null || gbLimits.grossInputTorque !== null) {
      c9c10html += '<div style="font-size:var(--fs-tiny); color:var(--text-secondary); display:flex; flex-wrap:wrap; gap:8px; margin-top:4px; padding-top:4px; border-top:1px solid var(--border-color);">';
      c9c10html += '<span>Governed Güç: <b style="color:' + (c9ok ? 'var(--text-primary)' : 'var(--accent-danger)') + ';">' + powerAtGov.toFixed(0) + ' kW</b>';
      if(gbLimits.grossInputPower !== null) c9c10html += ' <span style="font-size:var(--fs-micro); color:' + (c9ok ? 'var(--text-muted)' : 'var(--accent-danger)') + ';">(limit: ' + gbLimits.grossInputPower + ' kW ' + (c9ok ? '<span style="color:var(--accent-success);font-weight:700;">✓</span>' : '<span style="color:var(--accent-danger);font-weight:700;">✗</span>') + ')</span>';
      c9c10html += '</span>';
      c9c10html += '<span>Governed Tork: <b style="color:' + (c10ok ? 'var(--text-primary)' : 'var(--accent-danger)') + ';">' + torqueAtGov.toFixed(0) + ' Nm</b>';
      if(gbLimits.grossInputTorque !== null) c9c10html += ' <span style="font-size:var(--fs-micro); color:' + (c10ok ? 'var(--text-muted)' : 'var(--accent-danger)') + ';">(limit: ' + gbLimits.grossInputTorque + ' Nm ' + (c10ok ? '<span style="color:var(--accent-success);font-weight:700;">✓</span>' : '<span style="color:var(--accent-danger);font-weight:700;">✗</span>') + ')</span>';
      c9c10html += '</span>';
      c9c10html += '</div>';
    }
    infoEl.innerHTML = '<div class="sw-pkg-card" style="margin-bottom:10px;">' +
      '<div class="sw-pkg-header" style="cursor:default;"><span class="sw-pkg-name"><span class="mf-ico mf-ico-wrench"></span> ' + engineName + '</span></div>' +
      '<div class="sw-pkg-body">' +
      '<div style="font-size:var(--fs-tiny); color:var(--text-secondary); display:flex; flex-wrap:wrap; gap:8px;">' +
      '<span>Peak Tork: <b style="color:var(--text-primary);">' + peakT.toFixed(0) + ' N·m @ ' + peakRPM + ' rpm</b></span>' +
      '<span>Governed: <b style="color:var(--text-primary);">' + governed + ' rpm</b></span>' +
      '<span>Pump Düşüm: <b style="color:var(--text-primary);">TC\'ye bağlı</b></span>' +
      '</div>' + c9c10html + '</div></div>';
  }
  
  // Motor tork interpolasyon fonksiyonu
  function interpT(rpm) {
    if(rpm <= torqueData[0].rpm) return torqueData[0].torque;
    if(rpm >= torqueData[torqueData.length-1].rpm) return torqueData[torqueData.length-1].torque;
    for(var i = 0; i < torqueData.length - 1; i++) {
      if(torqueData[i].rpm <= rpm && rpm <= torqueData[i+1].rpm) {
        var f = (rpm - torqueData[i].rpm) / (torqueData[i+1].rpm - torqueData[i].rpm);
        return torqueData[i].torque + f * (torqueData[i+1].torque - torqueData[i].torque);
      }
    }
    return 0;
  }
  
  // Governor droop interpolasyon (governed → noLoadGoverned arası lineer düşüş)
  function interpTWithDroop(rpm) {
    if(rpm <= governed) return interpT(rpm);
    if(rpm >= noLoadGov) return 0;
    var tAtGov = interpT(governed);
    var f = (rpm - governed) / (noLoadGov - governed);
    return tAtGov * (1 - f);
  }
  
  // TC veri interpolasyon
  function interpKp(tcData, sr) {
    sr = Math.max(0, Math.min(0.99, sr));
    if(sr <= tcData[0].sr) return tcData[0].kpump;
    if(sr >= tcData[tcData.length-1].sr) return tcData[tcData.length-1].kpump;
    for(var i = 0; i < tcData.length - 1; i++) {
      if(tcData[i].sr <= sr && sr <= tcData[i+1].sr) {
        var f = (sr - tcData[i].sr) / (tcData[i+1].sr - tcData[i].sr);
        return tcData[i].kpump + f * (tcData[i+1].kpump - tcData[i].kpump);
      }
    }
    return tcData[tcData.length-1].kpump;
  }
  function interpTau(tcData, sr) {
    sr = Math.max(0, Math.min(0.99, sr));
    if(sr <= tcData[0].sr) return tcData[0].tau;
    if(sr >= tcData[tcData.length-1].sr) return tcData[tcData.length-1].tau;
    for(var i = 0; i < tcData.length - 1; i++) {
      if(tcData[i].sr <= sr && sr <= tcData[i+1].sr) {
        var f = (sr - tcData[i].sr) / (tcData[i+1].sr - tcData[i].sr);
        return tcData[i].tau + f * (tcData[i+1].tau - tcData[i].tau);
      }
    }
    return tcData[tcData.length-1].tau;
  }
  
  // Stall speed hesabı (bisection)
  function findStallSpeed(tcData, pumpDrop) {
    var kp0 = tcData[0].kpump;
    var lo = 600, hi = 3500;
    for(var i = 0; i < 50; i++) {
      var mid = (lo + hi) / 2;
      var tAvail = interpTWithDroop(mid) - pumpDrop;
      var tAbsorbed = (mid * mid) / (kp0 * kp0);
      if(tAvail > tAbsorbed) lo = mid; else hi = mid;
      if(hi - lo < 0.5) break;
    }
    return (lo + hi) / 2;
  }

  // SR at governed hesabı
  function findSRAtGoverned(tcData, pumpDrop) {
    var tPump = interpT(governed) - pumpDrop;
    if(tPump <= 0) return 0;
    var kpNeeded = governed / Math.sqrt(tPump);
    // TC veri tablosunda kpNeeded'in bulunduğu SR aralığını ara
    for(var i = 0; i < tcData.length - 1; i++) {
      var kp1 = tcData[i].kpump, kp2 = tcData[i+1].kpump;
      var sr1 = tcData[i].sr, sr2 = tcData[i+1].sr;
      if((kp1 <= kpNeeded && kpNeeded <= kp2) || (kp2 <= kpNeeded && kpNeeded <= kp1)) {
        var f = (kpNeeded - kp1) / (kp2 - kp1);
        if(f >= 0 && f <= 1) return sr1 + f * (sr2 - sr1);
      }
    }
    // kpNeeded TC tablosunun üst sınırını aşıyorsa → konvertör neredeyse kilitli
    if(kpNeeded > tcData[tcData.length-1].kpump) return tcData[tcData.length-1].sr;
    // kpNeeded TC tablosunun alt sınırının altındaysa → TC veri aralığı yetersiz, stall bölgesinde
    return tcData[0].sr;
  }

  // Min engine speed hesabı (converter fazında)
  function findMinEngineSpeed(tcData, pumpDrop) {
    var minN = 9999;
    for(var nt = 0; nt <= governed * 1.05; nt += 15) {
      var lo = Math.max(nt + 1, 600), hi = noLoadGov + 100;
      for(var it = 0; it < 45; it++) {
        var mid = (lo + hi) / 2;
        if(mid <= nt) { lo = mid; continue; }
        var sr = nt / mid;
        sr = Math.max(0, Math.min(0.99, sr));
        var kp = interpKp(tcData, sr);
        var tAvail = interpTWithDroop(mid) - pumpDrop;
        var tAbsorbed = (mid * mid) / (kp * kp);
        if(tAvail > tAbsorbed) lo = mid; else hi = mid;
        if(hi - lo < 1) break;
      }
      var nEng = (lo + hi) / 2;
      if(nEng < minN && nEng > 500) minN = nEng;
    }
    return minN;
  }
  
  // Tüm konvertörleri analiz et (aileye göre filtrelenmiş)
  var results = [];
  veGetFamilyTCKeys().forEach(function(key) {
    var tc = VE_FT_TC_PRESETS[key];
    var tcData = tc.data;
    var pumpDrop = tc.pumpTorqueDrop !== undefined ? tc.pumpTorqueDrop : defaultPumpDrop;

    var stallSpeed = findStallSpeed(tcData, pumpDrop);
    var srGov = findSRAtGoverned(tcData, pumpDrop);
    var minSpeed = findMinEngineSpeed(tcData, pumpDrop);
    var stallTau = tcData[0].tau;
    var tPumpStall = interpTWithDroop(stallSpeed) - pumpDrop;
    var tTurbineStall = tPumpStall * stallTau;
    
    // Coupling SR
    var couplingSR = 0.88;
    for(var ci = 0; ci < tcData.length; ci++) {
      if(tcData[ci].tau <= 1.005) { couplingSR = tcData[ci].sr; break; }
    }
    
    // C5: Min engine speed >= peak torque speed
    var c5ok = minSpeed >= peakRPM - 50; // 50 rpm tolerans
    // C7: Stall turbine torque <= rating
    var c7ok = tTurbineStall <= turbineRating;
    // C8: SR at governed >= 0.80
    var c8ok = srGov >= 0.80;

    var status, score;
    if(!c9ok || !c10ok) { status = 'unacceptable'; score = 0; }
    else if(!c7ok) { status = 'unacceptable'; score = 0; }
    else if(!c5ok) { status = 'not-recommended'; score = 1; }
    else if(!c8ok) { status = 'caution'; score = 2; }
    else { status = 'recommended'; score = 3; }

    results.push({
      key: key, name: tc.name, stallTau: stallTau,
      stallSpeed: stallSpeed, minSpeed: minSpeed,
      srGov: srGov, tTurbineStall: tTurbineStall,
      couplingSR: couplingSR,
      c5ok: c5ok, c7ok: c7ok, c8ok: c8ok, c9ok: c9ok, c10ok: c10ok,
      status: status, score: score
    });
  });
  
  // Score'a göre sırala (yüksek → düşük), eşitlerde SR'ye göre
  results.sort(function(a, b) { return b.score - a.score || b.srGov - a.srGov; });
  
  // Sonuç tablosunu oluştur
  if(resultsEl) {
    var h = '';
    h += '<div style="display:flex; align-items:center; gap:6px; margin-bottom:8px;">';
    h += '<div class="sw-section-title">Konvertör Uyumluluk Tablosu</div>';
    h += '<div style="position:relative; display:inline-block;" onmouseenter="this.querySelector(\'.ecm-info-tip\').style.display=\'block\'" onmouseleave="this.querySelector(\'.ecm-info-tip\').style.display=\'none\'">';
    h += '<button class="sw-info-btn" onclick="void(0)" title="Bilgi">?</button>';
    h += '<div class="ecm-info-tip" style="display:none; position:absolute; left:20px; top:-8px; z-index:1000; width:320px; padding:10px 12px; background:var(--bg-secondary); border:1px solid var(--border-color); border-radius:var(--radius-sm); box-shadow:0 8px 24px rgba(0,0,0,0.4); font-size:var(--fs-tiny); color:var(--text-secondary); line-height:1.55;">';
    h += '<div style="font-weight:700; color:var(--text-heading); margin-bottom:6px; font-size:var(--fs-tiny);">Kontrol Kriterleri</div>';
    h += '<b style="color:var(--text-primary);">C4</b> — Stall Speed: Tam gaz, türbin çıkışı blokeli durumda motor devri (referans).<br>';
    h += '<b style="color:var(--text-primary);">C5</b> — Min Motor Devri ≥ Peak Tork Devri (' + peakRPM + ' rpm): Konvertör fazında motorun ulaştığı minimum devir. Altına düşerse motor lugging yapar.<br>';
    h += '<b style="color:var(--text-primary);">C7</b> — Stall Türbin Torku ≤ ' + turbineRating.toFixed(0) + ' N·m: Stall\'da türbin torku şanzıman limitini aşmamalı.<br>';
    h += '<b style="color:var(--text-primary);">C8</b> — SR @ Governed ≥ 0.80: Governed hızda kayma oranı. Düşükse loose match → performans kaybı (lockup\'ta sorun yok).<br>';
    if(gbLimits.grossInputPower !== null) h += '<b style="color:var(--text-primary);">C9</b> — Motor Gücü@Gov ≤ ' + gbLimits.grossInputPower + ' kW: Governed devirdeki motor gücü şanzıman giriş güç limitini aşmamalı.<br>';
    if(gbLimits.grossInputTorque !== null) h += '<b style="color:var(--text-primary);">C10</b> — Motor Torku@Gov ≤ ' + gbLimits.grossInputTorque + ' N·m: Governed devirdeki motor torku şanzıman giriş tork limitini aşmamalı.';
    h += '<div style="margin-top:6px; padding-top:5px; border-top:1px solid var(--border-color); font-size:var(--fs-micro); color:var(--text-muted); font-style:italic;">Referans Doküman: TD-148G</div>';
    h += '</div></div></div>';
    
    // C9/C10 uyarı bandı (şanzıman seviyesi kontroller)
    if(!c9ok || !c10ok) {
      h += '<div style="margin-bottom:8px; padding:8px 10px; background:color-mix(in srgb, var(--accent-danger) 10%, transparent); border:1px solid color-mix(in srgb, var(--accent-danger) 30%, transparent); border-radius:var(--radius-sm);">';
      h += '<div style="font-size:var(--fs-body); font-weight:700; color:var(--accent-danger);">✗ Şanzıman Giriş Limiti Aşılıyor</div>';
      h += '<div style="font-size:var(--fs-tiny); color:var(--text-secondary); margin-top:2px;">';
      if(!c9ok) h += 'C9: Motor gücü (' + powerAtGov.toFixed(0) + ' kW) > Şanzıman giriş güç limiti (' + gbLimits.grossInputPower + ' kW)<br>';
      if(!c10ok) h += 'C10: Motor torku (' + torqueAtGov.toFixed(0) + ' Nm) > Şanzıman giriş tork limiti (' + gbLimits.grossInputTorque + ' Nm)';
      h += '</div></div>';
    }

    // Tablo
    h += '<div style="overflow-x:auto;">';
    h += '<table style="width:100%; border-collapse:collapse; font-size:var(--fs-tiny); min-width:420px;">';
    h += '<thead><tr style="background:var(--bg-tertiary);">';
    h += '<th style="padding:5px 4px; border:1px solid var(--border-color); text-align:left; font-weight:600; color:var(--text-heading);">Durum</th>';
    h += '<th style="padding:5px 4px; border:1px solid var(--border-color); text-align:left; font-weight:600; color:var(--text-heading);">Konvertör</th>';
    h += '<th style="padding:5px 4px; border:1px solid var(--border-color); text-align:center; font-weight:500; color:var(--text-secondary);">Stall τ</th>';
    h += '<th style="padding:5px 4px; border:1px solid var(--border-color); text-align:center; font-weight:500; color:var(--text-secondary);" title="C4: Stall Speed">Stall<br>rpm</th>';
    h += '<th style="padding:5px 4px; border:1px solid var(--border-color); text-align:center; font-weight:500; color:var(--text-secondary);" title="C5: Min Engine Speed">Min N<br>rpm</th>';
    h += '<th style="padding:5px 4px; border:1px solid var(--border-color); text-align:center; font-weight:500; color:var(--text-secondary);" title="C7: Stall Turbine Torque">T_turb<br>N·m</th>';
    h += '<th style="padding:5px 4px; border:1px solid var(--border-color); text-align:center; font-weight:500; color:var(--text-secondary);" title="C8: SR at Governed Speed">SR@<br>Gov</th>';
    h += '<th style="padding:5px 4px; border:1px solid var(--border-color); text-align:center; font-weight:500; color:var(--text-secondary);">C5</th>';
    h += '<th style="padding:5px 4px; border:1px solid var(--border-color); text-align:center; font-weight:500; color:var(--text-secondary);">C7</th>';
    h += '<th style="padding:5px 4px; border:1px solid var(--border-color); text-align:center; font-weight:500; color:var(--text-secondary);">C8</th>';
    h += '<th style="padding:5px 4px; border:1px solid var(--border-color); text-align:center; font-weight:500; color:var(--text-secondary);"></th>';
    h += '</tr></thead><tbody>';

    // Kullanıcının TC bileşeninde seçtiği konvertörü belirle
    var _tcNodeForSel = nodes.find(function(n) { return n.type === 'torque-converter'; });
    var _selectedTCKey = (_tcNodeForSel && _tcNodeForSel.data && _tcNodeForSel.data.tcPresetKey) ? _tcNodeForSel.data.tcPresetKey : '';

    results.forEach(function(r, idx) {
      var bgColor = r.status === 'recommended' ? 'rgba(22,163,74,0.06)' :
                    r.status === 'caution' ? 'color-mix(in srgb, var(--accent-warning) 6%, transparent)' :
                    r.status === 'not-recommended' ? 'color-mix(in srgb, var(--accent-warning) 8%, transparent)' :
                    'color-mix(in srgb, var(--accent-danger) 6%, transparent)';
      var statusIcon = r.status === 'recommended' ? '<span style="color:var(--accent-success);font-weight:700;">✓</span>' :
                       r.status === 'caution' ? '<span style="color:var(--accent-warning);font-weight:700;">⚠</span>' :
                       r.status === 'not-recommended' ? '<span style="color:var(--accent-warning);font-weight:700;">⚠</span>' :
                       '<span style="color:var(--accent-danger);font-weight:700;">✗</span>';
      var statusText = r.status === 'recommended' ? 'Önerilen' :
                       r.status === 'caution' ? 'Dikkat' :
                       r.status === 'not-recommended' ? 'Önerilmez' :
                       'Uyumsuz';
      var statusColor = r.status === 'recommended' ? 'var(--accent-success)' :
                        r.status === 'caution' ? 'var(--accent-warning)' :
                        r.status === 'not-recommended' ? 'var(--accent-warning)' :
                        'var(--accent-danger)';
      var isSelected = r.key === _selectedTCKey;
      var borderLeft = isSelected ? '3px solid var(--accent-success)' : 'none';
      
      h += '<tr style="background:' + bgColor + '; border-left:' + borderLeft + ';">';
      h += '<td style="padding:4px; border:1px solid var(--border-color); white-space:nowrap;"><span style="font-size:var(--fs-tiny); font-weight:600; color:' + statusColor + ';">' + statusIcon + ' ' + statusText + '</span></td>';
      h += '<td style="padding:4px; border:1px solid var(--border-color); font-weight:600; color:var(--text-heading);">' + r.name + '</td>';
      h += '<td style="padding:4px; border:1px solid var(--border-color); text-align:center; color:var(--text-primary);">' + r.stallTau.toFixed(2) + '</td>';
      h += '<td style="padding:4px; border:1px solid var(--border-color); text-align:center; color:var(--text-primary);">' + r.stallSpeed.toFixed(0) + '</td>';
      h += '<td style="padding:4px; border:1px solid var(--border-color); text-align:center; color:' + (r.c5ok ? 'var(--text-primary)' : 'var(--accent-danger)') + ';">' + r.minSpeed.toFixed(0) + '</td>';
      h += '<td style="padding:4px; border:1px solid var(--border-color); text-align:center; color:' + (r.c7ok ? 'var(--text-primary)' : 'var(--accent-danger); font-weight:700') + ';">' + r.tTurbineStall.toFixed(0) + '</td>';
      h += '<td style="padding:4px; border:1px solid var(--border-color); text-align:center; color:' + (r.c8ok ? 'var(--text-primary)' : 'var(--accent-warning)') + ';">' + r.srGov.toFixed(3) + '</td>';
      h += '<td style="padding:4px; border:1px solid var(--border-color); text-align:center;">' + (r.c5ok ? '<span style="color:var(--accent-success);font-weight:700;">✓</span>' : '<span style="color:var(--accent-danger);font-weight:700;">✗</span>') + '</td>';
      h += '<td style="padding:4px; border:1px solid var(--border-color); text-align:center;">' + (r.c7ok ? '<span style="color:var(--accent-success);font-weight:700;">✓</span>' : '<span style="color:var(--accent-danger);font-weight:700;">✗</span>') + '</td>';
      h += '<td style="padding:4px; border:1px solid var(--border-color); text-align:center;">' + (r.c8ok ? '<span style="color:var(--accent-success);font-weight:700;">✓</span>' : '⚠') + '</td>';
      h += '<td style="padding:4px; border:1px solid var(--border-color); text-align:center;">';
      if(r.status !== 'unacceptable') {
        h += '<button class="sw-btn sw-btn-primary" onclick="ecmSelectConverter(\'' + nodeId + '\',\'' + r.key + '\')" style="padding:2px 8px; font-size:var(--fs-micro);" title="Bu konvertörü TC bileşenine yükle">Seç</button>';
      }
      h += '</td>';
      h += '</tr>';
    });
    
    h += '</tbody></table></div>';
    
    // Önerilen konvertör özeti
    if(results.length > 0 && results[0].status === 'recommended') {
      h += '<div class="sw-pkg-card" style="margin-top:8px; border-left:3px solid var(--accent-success);">';
      h += '<div class="sw-pkg-header" style="cursor:default;"><span class="sw-pkg-name" style="color:var(--accent-success);"><span class="mf-ico mf-ico-trophy"></span> Önerilen: ' + results[0].name + '</span></div>';
      h += '<div class="sw-pkg-body"><div class="sw-pkg-desc">Stall: ' + results[0].stallSpeed.toFixed(0) + ' rpm | SR@Gov: ' + results[0].srGov.toFixed(3) + ' | T_turb: ' + results[0].tTurbineStall.toFixed(0) + ' N·m</div></div>';
      h += '</div>';
    } else if(results.length > 0) {
      h += '<div class="sw-pkg-card" style="margin-top:8px; border-left:3px solid var(--accent-warning);">';
      h += '<div class="sw-pkg-header" style="cursor:default;"><span class="sw-pkg-name" style="color:var(--accent-warning);">⚠ Tam uyumlu konvertör bulunamadı</span></div>';
      h += '<div class="sw-pkg-body"><div class="sw-pkg-desc">En iyi seçenek: ' + results[0].name + ' (SR@Gov: ' + results[0].srGov.toFixed(3) + '). Lockup modunda çalışacağından performans kabul edilebilir olabilir.</div></div>';
      h += '</div>';
    }
    
    resultsEl.innerHTML = h;
  }
  
  // Chart için ortalama pump drop hesapla (motor eğrisi gösterimi)
  var chartPumpDrop = defaultPumpDrop;
  if(results.length > 0) {
    var sumDrop = 0;
    results.forEach(function(r) { var tc = VE_FT_TC_PRESETS[r.key]; sumDrop += (tc && tc.pumpTorqueDrop !== undefined) ? tc.pumpTorqueDrop : defaultPumpDrop; });
    chartPumpDrop = sumDrop / results.length;
  }

  // Absorption chart çiz
  drawECMAbsorptionChart(nodeId, torqueData, governed, noLoadGov, chartPumpDrop, results);
}

// ── ABSORPTION CHART ──
function drawECMAbsorptionChart(nodeId, torqueData, governed, noLoadGov, pumpDrop, results) {
  var canvas = document.getElementById('ecm-chart-' + nodeId);
  if(!canvas) return;
  var ctx = canvas.getContext('2d');
  var W = canvas.width, H = canvas.height;
  
  // Temizle — tema renklerini oku
  var tc = (typeof _drThemeColors === 'function') ? (_drTC || _drThemeColors()) : {bg:'#0a0c10', border:'#1c2333', textMuted:'#4a5568', textSec:'#7a8599', axisLine:'#333'};
  // Koyu/açık tema tespiti: bg renginin parlaklığına bak
  var _bgHex = tc.bg.replace('#','');
  var _bgR = parseInt(_bgHex.substring(0,2),16)||0;
  var _bgG = parseInt(_bgHex.substring(2,4),16)||0;
  var _bgB = parseInt(_bgHex.substring(4,6),16)||0;
  var isDark = (_bgR + _bgG + _bgB) / 3 < 128;
  ctx.fillStyle = tc.bg;
  ctx.fillRect(0, 0, W, H);

  // Marjlar
  var ml = 52, mr = 16, mt = 16, mb = 36;
  var pw = W - ml - mr, ph = H - mt - mb;

  // Veri aralıkları
  var maxRPM = noLoadGov + 100;
  var minRPM = 400;
  var maxT = 0;
  torqueData.forEach(function(d) { if(d.torque > maxT) maxT = d.torque; });
  maxT = Math.ceil(maxT / 200) * 200 + 200;

  function xPos(rpm) { return ml + (rpm - minRPM) / (maxRPM - minRPM) * pw; }
  function yPos(t) { return mt + ph - (t / maxT) * ph; }

  // Grid
  ctx.strokeStyle = tc.border;
  ctx.lineWidth = 0.5;
  for(var gt = 0; gt <= maxT; gt += 200) {
    ctx.beginPath(); ctx.moveTo(ml, yPos(gt)); ctx.lineTo(ml + pw, yPos(gt)); ctx.stroke();
    ctx.fillStyle = tc.textMuted; ctx.font = '9px sans-serif'; ctx.textAlign = 'right';
    ctx.fillText(gt, ml - 4, yPos(gt) + 3);
  }
  for(var gr = minRPM; gr <= maxRPM; gr += 200) {
    ctx.beginPath(); ctx.moveTo(xPos(gr), mt); ctx.lineTo(xPos(gr), mt + ph); ctx.stroke();
    ctx.fillStyle = tc.textMuted; ctx.font = '9px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText(gr, xPos(gr), mt + ph + 14);
  }

  // Eksen etiketleri
  ctx.fillStyle = tc.textSec; ctx.font = '10px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('Pump Speed — RPM', ml + pw/2, H - 4);
  ctx.save(); ctx.translate(12, mt + ph/2); ctx.rotate(-Math.PI/2);
  ctx.fillText('Pump Torque — N·m', 0, 0); ctx.restore();
  
  // Konvertör kapasite eğrileri (stall ve 0.80 SR)
  var tcColors = ['#ef4444','#f97316','#eab308','#22c55e','#06b6d4','#3b82f6','#8b5cf6'];
  var tcKeys = veGetFamilyTCKeys();
  
  tcKeys.forEach(function(key, ci) {
    var tc = VE_FT_TC_PRESETS[key];
    var tcData = tc.data;
    var color = tcColors[ci % tcColors.length];
    var kpStall = tcData[0].kpump;
    
    // Stall capacity curve: T = N² / Kp_stall²
    ctx.beginPath();
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.setLineDash([]);
    var first = true;
    for(var n = minRPM; n <= maxRPM; n += 10) {
      var t = (n * n) / (kpStall * kpStall);
      if(t > maxT * 1.1) break;
      var x = xPos(n), y = yPos(t);
      if(first) { ctx.moveTo(x, y); first = false; } else ctx.lineTo(x, y);
    }
    ctx.stroke();
    
    // 0.80 SR capacity curve
    var kp80 = 0;
    for(var di = 0; di < tcData.length - 1; di++) {
      if(tcData[di].sr <= 0.80 && tcData[di+1].sr >= 0.80) {
        var f = (0.80 - tcData[di].sr) / (tcData[di+1].sr - tcData[di].sr);
        kp80 = tcData[di].kpump + f * (tcData[di+1].kpump - tcData[di].kpump);
        break;
      }
    }
    if(kp80 > 0) {
      ctx.beginPath();
      ctx.strokeStyle = color;
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 3]);
      first = true;
      for(var n2 = minRPM; n2 <= maxRPM; n2 += 10) {
        var t2 = (n2 * n2) / (kp80 * kp80);
        if(t2 > maxT * 1.1) break;
        var x2 = xPos(n2), y2 = yPos(t2);
        if(first) { ctx.moveTo(x2, y2); first = false; } else ctx.lineTo(x2, y2);
      }
      ctx.stroke();
    }
    ctx.setLineDash([]);
    
    // Etiket (stall eğrisi üzerinde)
    var labelN = minRPM + (ci + 1) * (maxRPM - minRPM) / (tcKeys.length + 2);
    var labelT = (labelN * labelN) / (kpStall * kpStall);
    if(labelT < maxT * 0.9 && labelT > 50) {
      ctx.fillStyle = color; ctx.font = 'bold 8px sans-serif'; ctx.textAlign = 'left';
      ctx.fillText(tc.name, xPos(labelN) + 2, yPos(labelT) - 4);
    }
  });
  
  // Motor net tork eğrisi (pump torque = net - deduction)
  ctx.beginPath();
  ctx.strokeStyle = '#f59e0b';
  ctx.lineWidth = 2.5;
  ctx.setLineDash([]);
  var firstM = true;
  torqueData.forEach(function(d) {
    var tp = d.torque - pumpDrop;
    if(tp < 0) tp = 0;
    var x = xPos(d.rpm), y = yPos(tp);
    if(firstM) { ctx.moveTo(x, y); firstM = false; } else ctx.lineTo(x, y);
  });
  // Governor droop
  var tGov = 0;
  torqueData.forEach(function(d) { if(d.rpm <= governed) tGov = d.torque; });
  var tPumpGov = tGov - pumpDrop;
  ctx.lineTo(xPos(noLoadGov), yPos(0));
  ctx.stroke();
  
  // Motor eğrisi etiketi
  ctx.fillStyle = '#f59e0b'; ctx.font = 'bold 10px sans-serif'; ctx.textAlign = 'left';
  ctx.fillText('Motor (Net − ' + pumpDrop + ')', xPos(torqueData[0].rpm) + 4, yPos(torqueData[0].torque - pumpDrop) - 8);
  
  // Governed çizgisi
  ctx.beginPath();
  ctx.strokeStyle = isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.15)';
  ctx.lineWidth = 1;
  ctx.setLineDash([3, 3]);
  ctx.moveTo(xPos(governed), mt); ctx.lineTo(xPos(governed), mt + ph);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = isDark ? '#7a8599' : '#64748b'; ctx.font = '8px sans-serif'; ctx.textAlign = 'center';
  ctx.fillText('Gov ' + governed, xPos(governed), mt + ph + 26);
  
  // ── INTERSECTION DOTS (small chart) ──
  try {
    var _smPts = [];
    torqueData.forEach(function(dd) { _smPts.push({rpm: dd.rpm, torque: Math.max(0, dd.torque - pumpDrop)}); });
    _smPts.push({rpm: noLoadGov, torque: 0});
    
    // Build lookup
    var _smLookup = {};
    for(var sli = 0; sli < _smPts.length - 1; sli++) {
      var sp1 = _smPts[sli], sp2 = _smPts[sli+1];
      for(var slr = Math.ceil(sp1.rpm); slr <= Math.floor(sp2.rpm); slr++) {
        var slf = (sp2.rpm > sp1.rpm) ? (slr - sp1.rpm) / (sp2.rpm - sp1.rpm) : 0;
        _smLookup[slr] = sp1.torque + slf * (sp2.torque - sp1.torque);
      }
    }
    var _smFirst = Math.ceil(_smPts[0].rpm);
    var _smLast = Math.floor(_smPts[_smPts.length - 1].rpm);
    
    tcKeys.forEach(function(key, ci) {
      var tc = VE_FT_TC_PRESETS[key];
      var kpS = tc.data[0].kpump;
      var color = tcColors[ci % tcColors.length];
      if(!kpS || kpS <= 0) return;
      
      var wasAbove = false, fRPM = 0, fT = 0;
      for(var sr = _smFirst; sr <= _smLast; sr++) {
        var mV = _smLookup[sr] || 0;
        var cV = (sr * sr) / (kpS * kpS);
        if(mV > cV + 1) wasAbove = true;
        else if(wasAbove && mV > 0 && cV >= mV) { fRPM = sr; fT = cV; break; }
      }
      if(fRPM > 0 && fT > 0 && fT < maxT) {
        var sx = xPos(fRPM), sy = yPos(fT);
        ctx.beginPath(); ctx.arc(sx, sy, 4, 0, Math.PI * 2);
        ctx.fillStyle = color; ctx.fill();
        ctx.beginPath(); ctx.arc(sx, sy, 1.5, 0, Math.PI * 2);
        ctx.fillStyle = isDark ? '#0a0c10' : '#f8f9fa'; ctx.fill();
      }
    });
  } catch(err) {
    console.warn('ECM small chart dots error:', err);
    ctx.fillStyle = '#f59e0b'; ctx.font = '9px sans-serif'; ctx.textAlign = 'left';
    ctx.fillText('⚠ Kesişim hesaplama hatası', ml + 4, mt + ph - 4);
  }
  
  // Legend (sağ üst)
  ctx.font = '7px sans-serif'; ctx.textAlign = 'left';
  var ly = mt + 8;
  ctx.fillStyle = isDark ? '#7a8599' : '#64748b';
  ctx.fillText('── Stall   --- 0.80 SR', ml + pw - 100, ly);
}

// ── Bağlantı üzerinden motor bileşenini bul ──
function findConnectedEngine(nodeId) {
  // Bu node'un input portuna bağlı connection'ı bul
  for(var ci = 0; ci < connections.length; ci++) {
    var conn = connections[ci];
    if(conn.to === nodeId) {
      // Bağlı kaynak node'u bul
      var srcNode = nodes.find(function(n) { return n.id === conn.from; });
      if(srcNode && (srcNode.type === 'engine')) {
        return srcNode;
      }
    }
  }
  return null;
}

// ════════════════════════════════════════════════════════════════════════════
// MOTOR-ŞANZIMAN EŞLEŞTİRME BİLEŞENİ
// ════════════════════════════════════════════════════════════════════════════

function getEngineGearboxMatchingHTML(node) {
  var html = '';

  // Başlık
  html += '<div class="sw-panel">';
  html += '<div class="sw-section-title">Motor — Şanzıman Eşleştirme Analizi</div>';
  html += '<div class="sw-pkg-desc">Motor çıkış portuna bağlanmalıdır. Motor verilerine göre uyumlu şanzıman presetlerini C9/C10 kriterleri ile analiz eder.</div>';

  // Motor bağlantı durumu
  html += '<div id="egm-engine-info-' + node.id + '" style="padding:10px 12px; border-bottom:1px solid var(--border-color);">';
  html += '<div style="font-size:var(--fs-tiny); color:var(--text-muted);">Motor bağlantısı kontrol ediliyor...</div>';
  html += '</div>';

  // Analiz sonuç tablosu
  html += '<div id="egm-results-' + node.id + '" style="padding:10px 12px;">';
  html += '<div style="text-align:center; padding:20px; color:var(--text-muted); font-size:var(--fs-body);">Analiz bekleniyor... Motor bileşenine bağlandığında otomatik çalışır.</div>';
  html += '</div>';

  html += '</div>'; // close sw-panel

  return html;
}

function runEngineGearboxMatchingAnalysis(nodeId) {
  var node = nodes.find(function(n) { return n.id === nodeId; });
  if(!node) return;

  var infoEl = document.getElementById('egm-engine-info-' + nodeId);
  var resultsEl = document.getElementById('egm-results-' + nodeId);

  // Bağlı motoru bul
  var engineNode = findConnectedEngine(nodeId);
  if(!engineNode) {
    if(infoEl) infoEl.innerHTML = '<div style="padding:8px; background:color-mix(in srgb, var(--accent-danger) 10%, transparent); border:1px solid color-mix(in srgb, var(--accent-danger) 30%, transparent); border-radius:var(--radius-sm); font-size:var(--fs-tiny); color:var(--accent-danger);">⚠ Motor bileşenine bağlı değil. Lütfen bu bileşenin giriş portunu Motor bileşeninin çıkış portuna bağlayın.</div>';
    if(resultsEl) resultsEl.innerHTML = '';
    return;
  }

  var torqueData = engineNode.data ? (engineNode.data.torqueData || []) : [];
  if(torqueData.length < 2) {
    if(infoEl) infoEl.innerHTML = '<div style="padding:8px; background:color-mix(in srgb, var(--accent-warning) 10%, transparent); border:1px solid color-mix(in srgb, var(--accent-warning) 30%, transparent); border-radius:var(--radius-sm); font-size:var(--fs-tiny); color:var(--accent-warning);">⚠ Motor tork verisi girilmemiş. Önce motor bileşeninde tork-devir verilerini girin.</div>';
    if(resultsEl) resultsEl.innerHTML = '';
    return;
  }

  var motorSpecs = engineNode.data.motorSpecs || {};
  var governed = motorSpecs.governedSpeed || engineNode.data.governedRpm || 2100;
  var engineName = engineNode.data.motorName || engineNode.customName || 'Motor';

  // Peak torque
  var peakT = 0, peakRPM = 0;
  torqueData.forEach(function(d) { if(d.torque > peakT) { peakT = d.torque; peakRPM = d.rpm; } });

  // Governed devirdeki tork ve güç
  var torqueAtGov = 0;
  if(governed <= torqueData[0].rpm) torqueAtGov = torqueData[0].torque;
  else if(governed >= torqueData[torqueData.length-1].rpm) torqueAtGov = torqueData[torqueData.length-1].torque;
  else {
    for(var ti = 0; ti < torqueData.length - 1; ti++) {
      if(torqueData[ti].rpm <= governed && governed <= torqueData[ti+1].rpm) {
        var tf = (governed - torqueData[ti].rpm) / (torqueData[ti+1].rpm - torqueData[ti].rpm);
        torqueAtGov = torqueData[ti].torque + tf * (torqueData[ti+1].torque - torqueData[ti].torque);
        break;
      }
    }
  }
  var powerAtGov = torqueAtGov * governed * Math.PI / 30000;

  // Motor bilgi paneli
  if(infoEl) {
    infoEl.innerHTML = '<div class="sw-pkg-card" style="margin-bottom:10px;">' +
      '<div class="sw-pkg-header" style="cursor:default;"><span class="sw-pkg-name"><span class="mf-ico mf-ico-wrench"></span> ' + engineName + '</span></div>' +
      '<div class="sw-pkg-body">' +
      '<div style="font-size:var(--fs-tiny); color:var(--text-secondary); display:flex; flex-wrap:wrap; gap:8px;">' +
      '<span>Peak Tork: <b style="color:var(--text-primary);">' + peakT.toFixed(0) + ' N·m @ ' + peakRPM + ' rpm</b></span>' +
      '<span>Governed: <b style="color:var(--text-primary);">' + governed + ' rpm</b></span>' +
      '</div>' +
      '<div style="font-size:var(--fs-tiny); color:var(--text-secondary); display:flex; flex-wrap:wrap; gap:8px; margin-top:4px; padding-top:4px; border-top:1px solid var(--border-color);">' +
      '<span>Güç@Gov: <b style="color:var(--text-primary);">' + powerAtGov.toFixed(0) + ' kW</b></span>' +
      '<span>Tork@Gov: <b style="color:var(--text-primary);">' + torqueAtGov.toFixed(0) + ' N·m</b></span>' +
      '</div></div></div>';
  }

  // Tüm şanzıman presetlerini analiz et
  var results = [];
  Object.keys(VE_GEARBOX_PRESETS).forEach(function(gbKey) {
    var preset = VE_GEARBOX_PRESETS[gbKey];

    var c9ok = true, c10ok = true;
    var c9detail = '—', c10detail = '—';
    var maxOutOk = true;

    if(preset.grossInputPower !== null) {
      c9ok = powerAtGov <= preset.grossInputPower;
      c9detail = preset.grossInputPower + ' kW';
    }
    if(preset.grossInputTorque !== null) {
      c10ok = torqueAtGov <= preset.grossInputTorque;
      c10detail = preset.grossInputTorque + ' N·m';
    }

    var status, score;
    if(preset.grossInputPower === null && preset.grossInputTorque === null) {
      status = 'no-data'; score = -1;
    } else if(!c9ok || !c10ok) {
      status = 'unacceptable'; score = 0;
    } else {
      // Marjları hesapla
      var powerMargin = preset.grossInputPower !== null ? ((preset.grossInputPower - powerAtGov) / preset.grossInputPower * 100) : 100;
      var torqueMargin = preset.grossInputTorque !== null ? ((preset.grossInputTorque - torqueAtGov) / preset.grossInputTorque * 100) : 100;
      var minMargin = Math.min(powerMargin, torqueMargin);
      if(minMargin >= 15) { status = 'recommended'; score = 3; }
      else if(minMargin >= 5) { status = 'caution'; score = 2; }
      else { status = 'tight'; score = 1; }
    }

    results.push({
      key: gbKey,
      name: preset.name,
      family: preset.family || '—',
      calibrated: preset.calibrated || false,
      downshiftCalibrated: preset.downshiftCalibrated || false,
      grossInputPower: preset.grossInputPower,
      grossInputTorque: preset.grossInputTorque,
      netTurbineTorque: preset.netTurbineTorque,
      maxOutputSpeed: preset.maxOutputSpeed,
      c9ok: c9ok, c10ok: c10ok,
      c9detail: c9detail, c10detail: c10detail,
      status: status, score: score,
      gearCount: preset.gears.filter(function(g) { return g.gear !== 'R'; }).length
    });
  });

  // Sıralama: score desc, sonra isim
  results.sort(function(a, b) { return b.score - a.score || a.name.localeCompare(b.name); });

  // Seçili şanzıman
  var gbNode = nodes.find(function(n) { return n.type === 'gearbox'; });
  var selectedGB = (gbNode && gbNode.data) ? (gbNode.data.ftGBPreset || '') : '';

  // Tablo oluştur
  if(resultsEl) {
    var h = '';
    h += '<div style="display:flex; align-items:center; gap:6px; margin-bottom:8px;">';
    h += '<div class="sw-section-title">Şanzıman Uyumluluk Tablosu</div>';
    h += '<div style="position:relative; display:inline-block;" onmouseenter="this.querySelector(\'.egm-info-tip\').style.display=\'block\'" onmouseleave="this.querySelector(\'.egm-info-tip\').style.display=\'none\'">';
    h += '<button class="sw-info-btn" onclick="void(0)" title="Bilgi">?</button>';
    h += '<div class="egm-info-tip" style="display:none; position:absolute; left:20px; top:-8px; z-index:1000; width:300px; padding:10px 12px; background:var(--bg-secondary); border:1px solid var(--border-color); border-radius:var(--radius-sm); box-shadow:0 8px 24px rgba(0,0,0,0.4); font-size:var(--fs-tiny); color:var(--text-secondary); line-height:1.55;">';
    h += '<div style="font-weight:700; color:var(--text-heading); margin-bottom:6px; font-size:var(--fs-tiny);">Kontrol Kriterleri</div>';
    h += '<b style="color:var(--text-primary);">C9</b> — Motor Gücü@Gov (' + powerAtGov.toFixed(0) + ' kW) ≤ Şanzıman Giriş Güç Limiti: Governed devirdeki motor gücü şanzıman giriş güç limitini aşmamalı.<br>';
    h += '<b style="color:var(--text-primary);">C10</b> — Motor Torku@Gov (' + torqueAtGov.toFixed(0) + ' N·m) ≤ Şanzıman Giriş Tork Limiti: Governed devirdeki motor torku şanzıman giriş tork limitini aşmamalı.<br>';
    h += '<div style="margin-top:6px; padding-top:5px; border-top:1px solid var(--border-color);">';
    h += '<span style="color:var(--accent-success);">Önerilen</span>: ≥15% marj | <span style="color:var(--accent-warning);">Dikkat</span>: 5-15% marj | <span style="color:#f97316;">Sıkı</span>: &lt;5% marj | <span style="color:var(--accent-danger);">Uyumsuz</span>: Limit aşılıyor';
    h += '</div></div></div></div>';

    // Tablo
    h += '<div style="overflow-x:auto;">';
    h += '<table style="width:100%; border-collapse:collapse; font-size:var(--fs-micro); table-layout:fixed;">';
    h += '<colgroup>';
    h += '<col style="width:28px;">';   // Durum (ikon)
    h += '<col style="width:auto;">';   // Şanzıman
    h += '<col style="width:32px;">';   // Vites
    h += '<col style="width:38px;">';   // Güç
    h += '<col style="width:40px;">';   // Tork
    h += '<col style="width:40px;">';   // Türbin
    h += '<col style="width:40px;">';   // Max Çkş
    h += '<col style="width:24px;">';   // C9
    h += '<col style="width:24px;">';   // C10
    h += '<col style="width:34px;">';   // Seç
    h += '</colgroup>';
    h += '<thead><tr style="background:var(--bg-tertiary);">';
    h += '<th style="padding:3px 2px; border:1px solid var(--border-color); text-align:center; font-weight:600; color:var(--text-heading); font-size:var(--fs-micro);" title="Durum">⊘</th>';
    h += '<th style="padding:3px 2px; border:1px solid var(--border-color); text-align:left; font-weight:600; color:var(--text-heading);">Şanzıman</th>';
    h += '<th style="padding:3px 2px; border:1px solid var(--border-color); text-align:center; font-weight:500; color:var(--text-secondary);">V</th>';
    h += '<th style="padding:3px 2px; border:1px solid var(--border-color); text-align:center; font-weight:500; color:var(--text-secondary);" title="C9: Giriş Güç Limiti (kW)">Güç</th>';
    h += '<th style="padding:3px 2px; border:1px solid var(--border-color); text-align:center; font-weight:500; color:var(--text-secondary);" title="C10: Giriş Tork Limiti (Nm)">Tork</th>';
    h += '<th style="padding:3px 2px; border:1px solid var(--border-color); text-align:center; font-weight:500; color:var(--text-secondary);" title="Net Türbin Torku (Nm)">Türb.</th>';
    h += '<th style="padding:3px 2px; border:1px solid var(--border-color); text-align:center; font-weight:500; color:var(--text-secondary);" title="Maks. Çıkış Hızı (rpm)">Çkş</th>';
    h += '<th style="padding:3px 1px; border:1px solid var(--border-color); text-align:center; font-weight:500; color:var(--text-secondary);">C9</th>';
    h += '<th style="padding:3px 1px; border:1px solid var(--border-color); text-align:center; font-weight:500; color:var(--text-secondary);">C10</th>';
    h += '<th style="padding:3px 1px; border:1px solid var(--border-color); text-align:center; font-weight:500; color:var(--text-secondary);"></th>';
    h += '</tr></thead><tbody>';

    results.forEach(function(r) {
      var bgColor = r.status === 'recommended' ? 'rgba(22,163,74,0.06)' :
                    r.status === 'caution' ? 'color-mix(in srgb, var(--accent-warning) 6%, transparent)' :
                    r.status === 'tight' ? 'rgba(249,115,22,0.06)' :
                    r.status === 'unacceptable' ? 'color-mix(in srgb, var(--accent-danger) 6%, transparent)' :
                    'transparent';
      var statusIcon = r.status === 'recommended' ? '<span style="color:var(--accent-success);font-weight:700;">✓</span>' :
                       r.status === 'caution' ? '<span style="color:var(--accent-warning);font-weight:700;">⚠</span>' :
                       r.status === 'tight' ? '<span style="color:var(--accent-warning);font-weight:700;">⚠</span>' :
                       r.status === 'unacceptable' ? '<span style="color:var(--accent-danger);font-weight:700;">✗</span>' : '—';
      var statusText = r.status === 'recommended' ? 'Önerilen' :
                       r.status === 'caution' ? 'Dikkat' :
                       r.status === 'tight' ? 'Sıkı' :
                       r.status === 'unacceptable' ? 'Uyumsuz' : 'Veri Yok';
      var statusColor = r.status === 'recommended' ? 'var(--accent-success)' :
                        r.status === 'caution' ? 'var(--accent-warning)' :
                        r.status === 'tight' ? '#f97316' :
                        r.status === 'unacceptable' ? 'var(--accent-danger)' : 'var(--text-muted)';
      var isSelected = r.key === selectedGB;
      var borderLeft = isSelected ? '3px solid var(--accent-primary)' : 'none';
      var calMark = (r.calibrated ? ' ✦' : '') + (r.downshiftCalibrated ? ' ✧' : '') + (r.partialData ? ' ★' : '');

      // Şanzıman adını kısalt: "Allison | 4000SP" → "4000SP"
      var shortName = r.name.replace(/^Allison\s*\|\s*/i, '');
      h += '<tr style="background:' + bgColor + '; border-left:' + borderLeft + ';" title="' + statusText + ': ' + r.name + '">';
      h += '<td style="padding:2px; border:1px solid var(--border-color); text-align:center;" title="' + statusText + '"><span style="font-size:var(--fs-tiny);">' + statusIcon + '</span></td>';
      h += '<td style="padding:2px 3px; border:1px solid var(--border-color); font-weight:600; color:var(--text-heading); overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">' + shortName + calMark + (isSelected ? ' <span style="font-size:var(--fs-micro); background:var(--accent-primary); color:white; padding:0 3px; border-radius:var(--radius-sm);">✔</span>' : '') + '</td>';
      h += '<td style="padding:2px; border:1px solid var(--border-color); text-align:center; color:var(--text-primary);">' + r.gearCount + '</td>';
      h += '<td style="padding:2px; border:1px solid var(--border-color); text-align:center; color:' + (r.c9ok ? 'var(--text-primary)' : 'var(--accent-danger); font-weight:700') + ';">' + (r.grossInputPower !== null ? r.grossInputPower : '—') + '</td>';
      h += '<td style="padding:2px; border:1px solid var(--border-color); text-align:center; color:' + (r.c10ok ? 'var(--text-primary)' : 'var(--accent-danger); font-weight:700') + ';">' + (r.grossInputTorque !== null ? r.grossInputTorque : '—') + '</td>';
      h += '<td style="padding:2px; border:1px solid var(--border-color); text-align:center; color:var(--text-primary);">' + (r.netTurbineTorque !== null ? r.netTurbineTorque : '—') + '</td>';
      h += '<td style="padding:2px; border:1px solid var(--border-color); text-align:center; color:var(--text-primary);">' + (r.maxOutputSpeed !== null ? r.maxOutputSpeed : '—') + '</td>';
      h += '<td style="padding:2px 1px; border:1px solid var(--border-color); text-align:center; font-size:var(--fs-micro);">' + (r.score < 0 ? '—' : (r.c9ok ? '<span style="color:var(--accent-success);font-weight:700;">✓</span>' : '<span style="color:var(--accent-danger);font-weight:700;">✗</span>')) + '</td>';
      h += '<td style="padding:2px 1px; border:1px solid var(--border-color); text-align:center; font-size:var(--fs-micro);">' + (r.score < 0 ? '—' : (r.c10ok ? '<span style="color:var(--accent-success);font-weight:700;">✓</span>' : '<span style="color:var(--accent-danger);font-weight:700;">✗</span>')) + '</td>';
      h += '<td style="padding:2px 1px; border:1px solid var(--border-color); text-align:center;">';
      h += '<button class="sw-btn ' + (isSelected ? '' : 'sw-btn-primary') + '" onclick="egmSelectGearbox(\'' + nodeId + '\',\'' + r.key + '\')" style="padding:1px 4px; font-size:var(--fs-micro);' + (isSelected ? ' opacity:0.5; cursor:default;' : '') + '"' + (isSelected ? ' disabled' : '') + '>' + (isSelected ? '✔' : 'Seç') + '</button>';
      h += '</td>';
      h += '</tr>';
    });

    h += '</tbody></table></div>';

    // Önerilen şanzıman özeti
    var recommended = results.filter(function(r) { return r.status === 'recommended'; });
    if(recommended.length > 0) {
      h += '<div class="sw-pkg-card" style="margin-top:8px; border-left:3px solid var(--accent-success);">';
      h += '<div class="sw-pkg-header" style="cursor:default;"><span class="sw-pkg-name" style="color:var(--accent-success);"><span class="mf-ico mf-ico-trophy"></span> Önerilen Şanzımanlar (' + recommended.length + ')</span></div>';
      h += '<div class="sw-pkg-body"><div class="sw-pkg-desc">' + recommended.map(function(r) { return r.name; }).join(', ') + '</div></div>';
      h += '</div>';
    } else {
      var acceptable = results.filter(function(r) { return r.score > 0; });
      if(acceptable.length > 0) {
        h += '<div class="sw-pkg-card" style="margin-top:8px; border-left:3px solid var(--accent-warning);">';
        h += '<div class="sw-pkg-header" style="cursor:default;"><span class="sw-pkg-name" style="color:var(--accent-warning);">⚠ Tam uyumlu şanzıman bulunamadı</span></div>';
        h += '<div class="sw-pkg-body"><div class="sw-pkg-desc">En iyi seçenekler: ' + acceptable.map(function(r) { return r.name; }).join(', ') + '</div></div>';
        h += '</div>';
      }
    }

    resultsEl.innerHTML = h;
  }
}

// Şanzıman seçimi (Eşleştirme bileşeninden → Gearbox bileşenine)
function egmSelectGearbox(egmNodeId, gbPresetKey) {
  var gbNode = nodes.find(function(n) { return n.type === 'gearbox'; });
  if(!gbNode) {
    showToast('⚠ Şanzıman bileşeni bulunamadı. Önce canvas\'a ekleyin.', 'warning');
    return;
  }

  // Gearbox bileşenine preset yükle (mevcut fonksiyonu kullan)
  onVEFTGBPresetSelect(gbNode.id, gbPresetKey);

  // EC-Matching varsa turbineRating'i de güncelle
  var preset = VE_GEARBOX_PRESETS[gbPresetKey];
  if(preset && preset.netTurbineTorque) {
    var ecmNode = nodes.find(function(n) { return n.type === 'ec-matching'; });
    if(ecmNode) {
      if(!ecmNode.data) ecmNode.data = {};
      ecmNode.data.turbineRating = preset.netTurbineTorque;
      var trEl = document.getElementById('ecm-turbine-rating-' + ecmNode.id);
      if(trEl) trEl.value = preset.netTurbineTorque;
      // EC-Matching analizini yeniden çalıştır
      runECMatchingAnalysis(ecmNode.id);
    }
  }

  showToast('' + preset.name + ' → Şanzıman bileşenine yüklendi', 'success');

  // Tabloyu güncelle (seçili satırı göster)
  runEngineGearboxMatchingAnalysis(egmNodeId);
}

// ── TC bileşenine konvertör yükle ──
function ecmSelectConverter(ecmNodeId, tcPresetKey) {
  var tcNode = nodes.find(function(n) { return n.type === 'torque-converter'; });
  if(!tcNode) {
    showToast('⚠ Tork Konvertörü bileşeni bulunamadı. Önce canvas\'a ekleyin.', 'warning');
    return;
  }
  // TC bileşenine preset yükle
  onVEFTTCSelect(tcNode.id, tcPresetKey);
  
  // TC bileşeninin dropdown'ını güncelle
  var selEl = document.getElementById('ve-tc-select-' + tcNode.id);
  if(selEl) selEl.value = tcPresetKey;
  
  showToast('' + VE_FT_TC_PRESETS[tcPresetKey].name + ' → TC bileşenine yüklendi', 'success');

  // Tabloyu yeniden çiz (seçili satır çentiğini güncelle)
  runECMatchingAnalysis(ecmNodeId);
}

// ── FULLSCREEN INTERACTIVE CHART ──
var _ecmModalActive = null;
var _ecmModalData = null;
var _ecmZoom = { scale: 1.0, centerRPM: null, centerT: null };

function ecmExpandChart(nodeId) {
  var node = nodes.find(function(n) { return n.id === nodeId; });
  if(!node) return;
  
  // Motor verisini bağlantı üzerinden bul
  var engineNode = findConnectedEngine(nodeId);
  if(!engineNode) { showToast('⚠ Motor bileşeni bağlı değil — lütfen giriş portunu Motor çıkışına bağlayın', 'warning'); return; }
  
  var torqueData = engineNode.data.torqueData || [];
  var motorSpecs = engineNode.data.motorSpecs || {};
  var governed = motorSpecs.governedSpeed || engineNode.data.governedRpm || 2100;
  var noLoadGov = motorSpecs.noLoadGoverned || governed + 200;
  var engineName = engineNode.data.motorName || engineNode.customName || 'Motor';
  // Modal chart için ortalama pump drop hesapla
  var tcKeys = veGetFamilyTCKeys();
  var modalPumpDrop = 17.6;
  if(tcKeys.length > 0) {
    var sumD = 0;
    tcKeys.forEach(function(k) { var tc = VE_FT_TC_PRESETS[k]; sumD += (tc && tc.pumpTorqueDrop !== undefined) ? tc.pumpTorqueDrop : 17.6; });
    modalPumpDrop = sumD / tcKeys.length;
  }

  _ecmModalData = { torqueData: torqueData, governed: governed, noLoadGov: noLoadGov, pumpDrop: modalPumpDrop, engineName: engineName };
  _ecmModalActive = nodeId;
  _ecmZoom = { scale: 1.0, centerRPM: null, centerT: null };

  // Alttaki Özellikler modalı bu büyük chart'ın altında kalmasın → otomatik kapan
  if(typeof veTogglePropertiesPanel === 'function') veTogglePropertiesPanel(false);

  // Overlay
  var overlay = document.createElement('div');
  overlay.id = 'ecm-chart-modal-overlay';
  overlay.style.cssText = 'position:fixed; inset:0; z-index:100000; background:rgba(0,0,0,0.82); display:flex; align-items:center; justify-content:center; padding:20px; backdrop-filter:blur(4px);';

  // Modal
  var modal = document.createElement('div');
  modal.style.cssText = 'width:100%; max-width:1100px; height:85vh; max-height:820px; background:var(--bg-secondary, #0f1218); border:1px solid var(--border-color, #1c2333); border-radius:var(--radius-lg); display:flex; flex-direction:column; overflow:hidden; box-shadow:0 20px 60px rgba(0,0,0,0.6);';

  // Header
  var header = document.createElement('div');
  header.style.cssText = 'display:flex; align-items:center; justify-content:space-between; padding:5px 12px; background:var(--bg-tertiary); border-bottom:1px solid var(--border-color); flex-shrink:0;';
  header.innerHTML = '<span style="font-size:var(--fs-body); font-weight:700; color:var(--text-heading);"><span class="mf-ico mf-ico-settings"></span> Motor Eğrisi × Konvertör Kapasiteleri — ' + engineName + '</span>' +
    '<button onclick="ecmCloseChartModal()" title="Kapat (ESC)" style="width:24px; height:24px; display:flex; align-items:center; justify-content:center; background:transparent; border:1px solid var(--border-color); border-radius:var(--radius-sm); cursor:pointer; font-size:var(--fs-md); color:var(--text-secondary); transition:all 0.12s;" onmouseover="this.style.background=\'var(--accent-danger)\';this.style.color=\'#fff\';this.style.borderColor=\'var(--accent-danger)\'" onmouseout="this.style.background=\'transparent\';this.style.color=\'var(--text-secondary)\';this.style.borderColor=\'var(--border-color)\'">✕</button>';
  modal.appendChild(header);
  
  // Chart container
  var chartBox = document.createElement('div');
  chartBox.style.cssText = 'flex:1; position:relative; min-height:0; padding:10px;';
  chartBox.innerHTML = '<canvas id="ecm-modal-canvas" style="width:100%; height:100%; display:block; border-radius:var(--radius-sm);"></canvas>' +
    '<div id="ecm-modal-tooltip" style="position:absolute; display:none; pointer-events:none; background:var(--bg-tertiary, #151a22); border:1px solid var(--border-light, #222b3a); border-radius:var(--radius-sm); padding:8px 12px; font-size:var(--fs-tiny); color:var(--text-primary, #c8d1dc); line-height:1.5; box-shadow:0 4px 16px rgba(0,0,0,0.5); z-index:10; max-width:260px; white-space:nowrap;"></div>' +
    '<div id="ecm-modal-crosshair-v" style="position:absolute; top:0; width:1px; height:100%; background:rgba(255,255,255,0.12); pointer-events:none; display:none; z-index:5;"></div>' +
    '<div id="ecm-modal-crosshair-h" style="position:absolute; left:0; width:100%; height:1px; background:rgba(255,255,255,0.12); pointer-events:none; display:none; z-index:5;"></div>';
  modal.appendChild(chartBox);
  
  // Footer — Legend
  var footer = document.createElement('div');
  footer.style.cssText = 'display:flex; align-items:center; gap:14px; padding:7px 14px; background:var(--bg-tertiary); border-top:1px solid var(--border-color); flex-shrink:0; font-size:var(--fs-tiny); color:var(--text-secondary);';
  
  var tcKeys = veGetFamilyTCKeys();
  var tcColors = ['#ef4444','#f97316','#eab308','#22c55e','#06b6d4','#3b82f6','#a855f7'];
  var legendItems = '';
  tcKeys.forEach(function(key, i) {
    var c = tcColors[i % tcColors.length];
    legendItems += '<span style="display:inline-flex; align-items:center; gap:3px;"><span style="width:14px; height:3px; background:' + c + '; border-radius:1px; flex-shrink:0;"></span><span style="font-weight:600; color:' + c + ';">' + VE_FT_TC_PRESETS[key].name + '</span></span>';
  });
  footer.innerHTML = '<span style="display:inline-flex; align-items:center; gap:4px;"><span style="width:18px; height:3px; background:#f59e0b; border-radius:1px;"></span><span style="font-weight:700; color:#f59e0b;">Motor</span></span>' +
    '<span style="opacity:0.3;">│</span>' + legendItems +
    '<span style="opacity:0.3; margin-left:4px;">│</span>' +
    '<span style="color:var(--text-muted); font-size:var(--fs-micro);">── Stall &nbsp; <span style="border-bottom:1px dashed var(--text-muted);">┄┄</span> 0.80 SR &nbsp; ● Kesişim</span>' +
    '<span style="margin-left:auto; display:flex; align-items:center; gap:10px;">' +
    '<span id="ecm-zoom-indicator" style="display:none; color:#60a5fa; font-weight:600; font-size:var(--fs-tiny); cursor:pointer;" onclick="ecmResetZoom()" title="Tıklayarak sıfırlayın"><span class="mf-ico mf-ico-search"></span> 1.0×</span>' +
    '<span style="color:var(--text-muted); font-size:var(--fs-micro);">Scroll — Yakınlaştır &nbsp;│&nbsp; Sağ Tık + Sürükle — Kaydır</span>' +
    '<span style="color:var(--text-primary); font-weight:500;">ESC — Kapat</span></span>';
  modal.appendChild(footer);
  
  overlay.appendChild(modal);
  document.body.appendChild(overlay);
  
  // ESC handler
  overlay._escHandler = function(e) { if(e.key === 'Escape') ecmCloseChartModal(); };
  document.addEventListener('keydown', overlay._escHandler);
  overlay.addEventListener('mousedown', function(e) { if(e.button === 0 && e.target === overlay) ecmCloseChartModal(); });
  overlay.addEventListener('contextmenu', function(e) { e.preventDefault(); });
  
  // Global mouseup for pan — fires even when mouse is released outside canvas
  overlay._mouseupHandler = function(e) {
    if(e.button === 2 && _ecmPan.active) {
      _ecmPan.active = false;
      var c = document.getElementById('ecm-modal-canvas');
      if(c) c.style.cursor = 'crosshair';
    }
  };
  document.addEventListener('mouseup', overlay._mouseupHandler);
  
  // Draw after layout
  setTimeout(function() { ecmDrawModalChart(); }, 60);
}

function ecmCloseChartModal() {
  var overlay = document.getElementById('ecm-chart-modal-overlay');
  if(!overlay) return;
  if(overlay._escHandler) document.removeEventListener('keydown', overlay._escHandler);
  if(overlay._mouseupHandler) document.removeEventListener('mouseup', overlay._mouseupHandler);
  overlay.remove();
  _ecmModalActive = null;
  _ecmModalData = null;
  _ecmZoom = { scale: 1.0, centerRPM: null, centerT: null };
  _ecmPan.active = false;
}

function ecmDrawModalChart() {
  var canvas = document.getElementById('ecm-modal-canvas');
  if(!canvas || !_ecmModalData) return;
  
  var rect = canvas.parentElement.getBoundingClientRect();
  var dpr = window.devicePixelRatio || 1;
  canvas.width = rect.width * dpr;
  canvas.height = rect.height * dpr;
  canvas.style.width = rect.width + 'px';
  canvas.style.height = rect.height + 'px';
  
  var ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  var W = rect.width, H = rect.height;
  
  var d = _ecmModalData;
  var tc = (typeof _drThemeColors === 'function') ? (_drTC || _drThemeColors()) : {bg:'#0a0c10', border:'#1c2333', textMuted:'#4a5568', textSec:'#7a8599'};
  var _bgHex2 = tc.bg.replace('#','');
  var isDark = ((parseInt(_bgHex2.substring(0,2),16)||0) + (parseInt(_bgHex2.substring(2,4),16)||0) + (parseInt(_bgHex2.substring(4,6),16)||0)) / 3 < 128;

  // Background
  ctx.fillStyle = tc.bg;
  ctx.fillRect(0, 0, W, H);
  
  // Margins
  var ml = 70, mr = 24, mt = 24, mb = 50;
  var pw = W - ml - mr, ph = H - mt - mb;
  
  // Data ranges — base
  var baseMaxRPM = d.noLoadGov + 100;
  var baseMinRPM = 400;
  var baseMaxT = 0;
  d.torqueData.forEach(function(dd) { if(dd.torque > baseMaxT) baseMaxT = dd.torque; });
  baseMaxT = Math.ceil(baseMaxT / 200) * 200 + 400;
  var baseMinT = 0;
  
  // Apply zoom
  var zs = _ecmZoom.scale || 1.0;
  var baseRPMRange = baseMaxRPM - baseMinRPM;
  var baseTRange = baseMaxT - baseMinT;
  var visRPMRange = baseRPMRange / zs;
  var visTRange = baseTRange / zs;
  
  // Center defaults
  if(_ecmZoom.centerRPM === null) _ecmZoom.centerRPM = (baseMinRPM + baseMaxRPM) / 2;
  if(_ecmZoom.centerT === null) _ecmZoom.centerT = baseMaxT / 2;
  
  var minRPM = _ecmZoom.centerRPM - visRPMRange / 2;
  var maxRPM = _ecmZoom.centerRPM + visRPMRange / 2;
  var minT = _ecmZoom.centerT - visTRange / 2;
  var maxT = _ecmZoom.centerT + visTRange / 2;
  
  // Clamp so we don't go beyond base bounds (only when zoomed in)
  if(zs >= 1.0) {
    if(minRPM < baseMinRPM) { minRPM = baseMinRPM; maxRPM = baseMinRPM + visRPMRange; }
    if(maxRPM > baseMaxRPM) { maxRPM = baseMaxRPM; minRPM = baseMaxRPM - visRPMRange; }
    if(minT < baseMinT) { minT = baseMinT; maxT = baseMinT + visTRange; }
    if(maxT > baseMaxT) { maxT = baseMaxT; minT = baseMaxT - visTRange; }
  }
  // Update center after clamping
  _ecmZoom.centerRPM = (minRPM + maxRPM) / 2;
  _ecmZoom.centerT = (minT + maxT) / 2;
  
  function xPos(rpm) { return ml + (rpm - minRPM) / (maxRPM - minRPM) * pw; }
  function yPos(t) { return mt + ph - ((t - minT) / (maxT - minT)) * ph; }
  function rpmFromX(x) { return minRPM + (x - ml) / pw * (maxRPM - minRPM); }
  function torqueFromY(y) { return minT + (mt + ph - y) / ph * (maxT - minT); }
  
  // Grid
  var gridColor = tc.border;
  var textColor = tc.textMuted;
  ctx.font = '11px system-ui, sans-serif';
  
  // Grid — adaptive step sizes based on visible range
  var tRange = maxT - minT;
  var tStep = tRange > 2000 ? 500 : tRange > 800 ? 200 : tRange > 400 ? 100 : 50;
  var rpmRange = maxRPM - minRPM;
  var rpmStep = rpmRange > 2000 ? 500 : rpmRange > 1000 ? 200 : 100;
  
  var tStart = Math.ceil(minT / tStep) * tStep;
  for(var gt = tStart; gt <= maxT; gt += tStep) {
    ctx.strokeStyle = gridColor; ctx.lineWidth = 0.5;
    ctx.beginPath(); ctx.moveTo(ml, yPos(gt)); ctx.lineTo(ml + pw, yPos(gt)); ctx.stroke();
    ctx.fillStyle = textColor; ctx.textAlign = 'right';
    ctx.fillText(gt, ml - 8, yPos(gt) + 4);
  }
  var rpmStart = Math.ceil(minRPM / rpmStep) * rpmStep;
  for(var gr = rpmStart; gr <= maxRPM; gr += rpmStep) {
    ctx.strokeStyle = gridColor; ctx.lineWidth = 0.5;
    ctx.beginPath(); ctx.moveTo(xPos(gr), mt); ctx.lineTo(xPos(gr), mt + ph); ctx.stroke();
    ctx.fillStyle = textColor; ctx.textAlign = 'center';
    ctx.fillText(gr, xPos(gr), mt + ph + 18);
  }
  
  // Axis labels
  ctx.fillStyle = tc.textSec; ctx.font = '12px system-ui, sans-serif'; ctx.textAlign = 'center';
  ctx.fillText('Pump Speed — RPM', ml + pw/2, H - 8);
  ctx.save(); ctx.translate(16, mt + ph/2); ctx.rotate(-Math.PI/2);
  ctx.fillText('Pump Torque — N·m', 0, 0); ctx.restore();
  
  // Converter capacity curves with hitmap data
  ctx.save();
  ctx.beginPath();
  ctx.rect(ml, mt, pw, ph);
  ctx.clip();
  var tcColors = ['#ef4444','#f97316','#eab308','#22c55e','#06b6d4','#3b82f6','#a855f7'];
  var tcKeys = veGetFamilyTCKeys();
  var _ecmCurves = [];
  
  tcKeys.forEach(function(key, ci) {
    var tc = VE_FT_TC_PRESETS[key];
    var tcData = tc.data;
    var color = tcColors[ci % tcColors.length];
    var kpStall = tcData[0].kpump;
    var stallTau = tcData[0].tau;
    
    // Stall curve
    var stallPts = [];
    ctx.beginPath();
    ctx.strokeStyle = color; ctx.lineWidth = 2; ctx.setLineDash([]);
    var first = true;
    for(var n = minRPM; n <= maxRPM; n += 5) {
      var t = (n * n) / (kpStall * kpStall);
      if(t > maxT * 1.1) break;
      stallPts.push({rpm: n, torque: t});
      var x = xPos(n), y = yPos(t);
      if(first) { ctx.moveTo(x, y); first = false; } else ctx.lineTo(x, y);
    }
    ctx.stroke();
    
    // 0.80 SR curve
    var kp80 = 0;
    for(var di = 0; di < tcData.length - 1; di++) {
      if(tcData[di].sr <= 0.80 && tcData[di+1].sr >= 0.80) {
        var f = (0.80 - tcData[di].sr) / (tcData[di+1].sr - tcData[di].sr);
        kp80 = tcData[di].kpump + f * (tcData[di+1].kpump - tcData[di].kpump);
        break;
      }
    }
    var sr80Pts = [];
    if(kp80 > 0) {
      ctx.beginPath();
      ctx.strokeStyle = color; ctx.lineWidth = 1.2; ctx.setLineDash([6, 4]);
      first = true;
      for(var n2 = minRPM; n2 <= maxRPM; n2 += 5) {
        var t2 = (n2 * n2) / (kp80 * kp80);
        if(t2 > maxT * 1.1) break;
        sr80Pts.push({rpm: n2, torque: t2});
        var x2 = xPos(n2), y2 = yPos(t2);
        if(first) { ctx.moveTo(x2, y2); first = false; } else ctx.lineTo(x2, y2);
      }
      ctx.stroke();
    }
    ctx.setLineDash([]);
    
    // Label
    var labelIdx = Math.min(Math.floor(stallPts.length * 0.3) + ci * 15, stallPts.length - 1);
    if(labelIdx >= 0 && labelIdx < stallPts.length) {
      var lp = stallPts[labelIdx];
      if(lp.torque < maxT * 0.92) {
        ctx.fillStyle = color; ctx.font = 'bold 11px system-ui, sans-serif'; ctx.textAlign = 'left';
        ctx.fillText(tc.name, xPos(lp.rpm) + 4, yPos(lp.torque) - 6);
      }
    }
    
    _ecmCurves.push({ key: key, name: tc.name, color: color, stallTau: stallTau, kpStall: kpStall, kp80: kp80, stallPts: stallPts, sr80Pts: sr80Pts });
  });
  
  // Motor curve (pump torque = net - deduction)
  var motorPts = [];
  ctx.beginPath();
  ctx.strokeStyle = '#f59e0b'; ctx.lineWidth = 3; ctx.setLineDash([]);
  var firstM = true;
  d.torqueData.forEach(function(dd) {
    var tp = Math.max(0, dd.torque - d.pumpDrop);
    motorPts.push({rpm: dd.rpm, torque: tp});
    var x = xPos(dd.rpm), y = yPos(tp);
    if(firstM) { ctx.moveTo(x, y); firstM = false; } else ctx.lineTo(x, y);
  });
  // Governor droop
  var tGov = 0;
  d.torqueData.forEach(function(dd) { if(dd.rpm <= d.governed) tGov = dd.torque; });
  var tPumpGov = Math.max(0, tGov - d.pumpDrop);
  motorPts.push({rpm: d.noLoadGov, torque: 0});
  ctx.lineTo(xPos(d.noLoadGov), yPos(0));
  ctx.stroke();
  
  // Motor fill (subtle)
  ctx.beginPath();
  ctx.fillStyle = veThemeRgba('--accent-warning', isDark ? 0.06 : 0.08, 'rgba(245,158,11,0.08)');
  var fFirst = true;
  motorPts.forEach(function(p) { var x = xPos(p.rpm), y = yPos(p.torque); if(fFirst) { ctx.moveTo(x, y); fFirst = false; } else ctx.lineTo(x, y); });
  ctx.lineTo(xPos(motorPts[motorPts.length-1].rpm), yPos(0));
  ctx.lineTo(xPos(motorPts[0].rpm), yPos(0));
  ctx.closePath(); ctx.fill();
  
  // Motor label
  ctx.fillStyle = '#f59e0b'; ctx.font = 'bold 12px system-ui, sans-serif'; ctx.textAlign = 'left';
  ctx.fillText('Motor (Net − ' + d.pumpDrop + ' N·m)', xPos(d.torqueData[1].rpm) + 6, yPos(d.torqueData[1].torque - d.pumpDrop) - 12);
  
  // Governed line
  ctx.beginPath();
  ctx.strokeStyle = isDark ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.12)';
  ctx.lineWidth = 1; ctx.setLineDash([4, 4]);
  ctx.moveTo(xPos(d.governed), mt); ctx.lineTo(xPos(d.governed), mt + ph);
  ctx.stroke(); ctx.setLineDash([]);
  ctx.fillStyle = isDark ? '#7a8599' : '#64748b'; ctx.font = '10px system-ui, sans-serif'; ctx.textAlign = 'center';
  ctx.fillText('Governed ' + d.governed + ' rpm', xPos(d.governed), mt + ph + 34);
  
  // ── INTERSECTION DOTS: Motor eğrisi × Konvertör stall eğrileri ──
  try {
    // Build motor pump torque lookup array (dense, every 1 rpm)
    var _mLookup = {};
    for(var li = 0; li < motorPts.length - 1; li++) {
      var p1 = motorPts[li], p2 = motorPts[li+1];
      var rStart = Math.ceil(p1.rpm), rEnd = Math.floor(p2.rpm);
      for(var lr = rStart; lr <= rEnd; lr++) {
        var lf = (p2.rpm > p1.rpm) ? (lr - p1.rpm) / (p2.rpm - p1.rpm) : 0;
        _mLookup[lr] = p1.torque + lf * (p2.torque - p1.torque);
      }
    }
    
    var firstMotorRPM = Math.ceil(motorPts[0].rpm);
    var lastMotorRPM = Math.floor(motorPts[motorPts.length - 1].rpm);
    
    _ecmCurves.forEach(function(curve) {
      var kp = curve.kpStall;
      if(!kp || kp <= 0) return;
      
      // Scan: find where motor drops below converter stall curve
      var foundRPM = 0, foundT = 0;
      var wasAbove = false;
      for(var rr = firstMotorRPM; rr <= lastMotorRPM; rr++) {
        var mTorque = _mLookup[rr] || 0;
        var cTorque = (rr * rr) / (kp * kp);
        if(mTorque > cTorque + 1) {
          wasAbove = true;
        } else if(wasAbove && mTorque > 0 && cTorque >= mTorque) {
          // Crossing found — refine with 0.1 rpm steps
          for(var fr = rr - 1; fr <= rr; fr += 0.1) {
            var p1r = Math.floor(fr), p2r = p1r + 1;
            var mF = (_mLookup[p2r] !== undefined && _mLookup[p1r] !== undefined) ?
              _mLookup[p1r] + (fr - p1r) * (_mLookup[p2r] - _mLookup[p1r]) : 0;
            var cF = (fr * fr) / (kp * kp);
            if(cF >= mF && mF > 0) {
              foundRPM = fr;
              foundT = cF;
              break;
            }
          }
          break;
        }
      }
      
      if(foundRPM > 0 && foundT > 0 && foundT < maxT) {
        var px = xPos(foundRPM), py = yPos(foundT);
        
        // Glow ring
        ctx.beginPath();
        ctx.arc(px, py, 10, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(255,255,255,0.08)';
        ctx.fill();
        
        // Main dot
        ctx.beginPath();
        ctx.arc(px, py, 6, 0, Math.PI * 2);
        ctx.fillStyle = curve.color;
        ctx.fill();
        
        // Inner highlight
        ctx.beginPath();
        ctx.arc(px, py, 2.5, 0, Math.PI * 2);
        ctx.fillStyle = '#ffffff';
        ctx.fill();
        
        // RPM label
        ctx.fillStyle = curve.color;
        ctx.font = 'bold 10px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(Math.round(foundRPM) + ' rpm', px, py - 13);
      }
      
      // 0.80 SR intersection
      if(curve.kp80 > 0) {
        var kp80 = curve.kp80;
        var foundRPM2 = 0, foundT2 = 0;
        var wasAbove2 = false;
        for(var rr2 = firstMotorRPM; rr2 <= lastMotorRPM; rr2++) {
          var mT2 = _mLookup[rr2] || 0;
          var cT2 = (rr2 * rr2) / (kp80 * kp80);
          if(mT2 > cT2 + 1) {
            wasAbove2 = true;
          } else if(wasAbove2 && mT2 > 0 && cT2 >= mT2) {
            foundRPM2 = rr2;
            foundT2 = cT2;
            break;
          }
        }
        
        if(foundRPM2 > 0 && foundT2 > 0 && foundT2 < maxT) {
          var px2 = xPos(foundRPM2), py2 = yPos(foundT2);
          
          // Hollow ring
          ctx.beginPath();
          ctx.arc(px2, py2, 4.5, 0, Math.PI * 2);
          ctx.strokeStyle = curve.color;
          ctx.lineWidth = 2;
          ctx.stroke();
          
          // Center
          ctx.beginPath();
          ctx.arc(px2, py2, 1.5, 0, Math.PI * 2);
          ctx.fillStyle = curve.color;
          ctx.fill();
        }
      }
    });
  } catch(err) {
    console.warn('ECM intersection dots error:', err);
    ctx.fillStyle = '#f59e0b'; ctx.font = '11px system-ui, sans-serif'; ctx.textAlign = 'left';
    ctx.fillText('⚠ Kesişim hesaplama hatası', ml + 6, mt + ph - 8);
  }
  
  // Restore clip
  ctx.restore();
  
  // Zoom indicator on chart
  if(_ecmZoom.scale > 1.05 || _ecmZoom.scale < 0.95) {
    ctx.fillStyle = veThemeRgba('--accent-primary', isDark ? 0.25 : 0.15, 'rgba(59,130,246,0.15)');
    ctx.font = '11px system-ui, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText('' + _ecmZoom.scale.toFixed(1) + '× — scroll ile yakınlaştırın, tıklayarak sıfırlayın', ml + pw - 4, mt + 14);
  }
  
  // Store data for interaction
  canvas._ecmInteractive = {
    ml: ml, mr: mr, mt: mt, mb: mb, pw: pw, ph: ph,
    minRPM: minRPM, maxRPM: maxRPM, minT: minT, maxT: maxT,
    xPos: xPos, yPos: yPos, rpmFromX: rpmFromX, torqueFromY: torqueFromY,
    curves: _ecmCurves, motorPts: motorPts, governed: d.governed, pumpDrop: d.pumpDrop, dpr: dpr
  };
  
  // Attach mouse events
  canvas.onmousemove = ecmModalMouseMove;
  canvas.onmouseleave = ecmModalMouseLeave;
  canvas.onwheel = ecmModalWheel;
  canvas.onmousedown = ecmModalMouseDown;
  canvas.onmouseup = ecmModalMouseUp;
  canvas.oncontextmenu = function(e) { e.preventDefault(); };
  canvas.style.cursor = 'crosshair';
}

// ── ECM Pan state ──
var _ecmPan = { active: false, startX: 0, startY: 0, startCenterRPM: 0, startCenterT: 0, _raf: null };

function ecmModalMouseDown(e) {
  // Sağ tık (button=2) → pan başlat
  if(e.button !== 2) return;
  e.preventDefault();
  var canvas = e.target;
  var data = canvas._ecmInteractive;
  if(!data) return;
  
  _ecmPan.active = true;
  _ecmPan.startX = e.clientX;
  _ecmPan.startY = e.clientY;
  _ecmPan.startCenterRPM = _ecmZoom.centerRPM;
  _ecmPan.startCenterT = _ecmZoom.centerT;
  canvas.style.cursor = 'grabbing';
  
  // Hide tooltip during pan
  var tooltip = document.getElementById('ecm-modal-tooltip');
  if(tooltip) tooltip.style.display = 'none';
}

function ecmModalMouseUp(e) {
  if(e.button !== 2) return;
  if(!_ecmPan.active) return;
  _ecmPan.active = false;
  var canvas = e.target;
  canvas.style.cursor = 'crosshair';
}

function ecmModalWheel(e) {
  e.preventDefault();
  var canvas = e.target;
  var data = canvas._ecmInteractive;
  if(!data) return;
  
  var rect = canvas.getBoundingClientRect();
  var mx = e.clientX - rect.left;
  var my = e.clientY - rect.top;
  
  // Ignore if outside plot area
  if(mx < data.ml || mx > data.ml + data.pw || my < data.mt || my > data.mt + data.ph) return;
  
  // Center-based zoom (no mouse-position anchoring)
  var oldScale = _ecmZoom.scale;
  var delta = e.deltaY > 0 ? 0.85 : 1.18;
  var newScale = Math.max(0.3, Math.min(12.0, oldScale * delta));
  
  if(newScale === oldScale) return;
  
  _ecmZoom.scale = newScale;
  
  ecmDrawModalChart();
  ecmUpdateZoomIndicator(newScale);
}

function ecmUpdateZoomIndicator(scale) {
  var zoomEl = document.getElementById('ecm-zoom-indicator');
  if(!zoomEl) return;
  if(scale > 1.05 || scale < 0.95) {
    zoomEl.textContent = scale.toFixed(1) + '×';
    zoomEl.style.display = 'inline';
  } else {
    zoomEl.style.display = 'none';
  }
}

function ecmResetZoom() {
  _ecmZoom = { scale: 1.0, centerRPM: null, centerT: null };
  _ecmPan.active = false;
  ecmUpdateZoomIndicator(1.0);
  ecmDrawModalChart();
}

function ecmModalMouseMove(e) {
  var canvas = e.target;
  var data = canvas._ecmInteractive;
  if(!data) return;
  
  // ── Pan mode (sağ tık sürükleme) ──
  if(_ecmPan.active) {
    var d = _ecmModalData;
    if(!d) return;
    
    // Hide tooltip and crosshairs during pan
    var _tt = document.getElementById('ecm-modal-tooltip');
    var _cv = document.getElementById('ecm-modal-crosshair-v');
    var _ch = document.getElementById('ecm-modal-crosshair-h');
    if(_tt) _tt.style.display = 'none';
    if(_cv) _cv.style.display = 'none';
    if(_ch) _ch.style.display = 'none';
    
    // Pixel delta → data delta
    var dxPx = e.clientX - _ecmPan.startX;
    var dyPx = e.clientY - _ecmPan.startY;
    
    var visRPMRange = data.maxRPM - data.minRPM;
    var visTRange = data.maxT - data.minT;
    
    var dRPM = -dxPx / data.pw * visRPMRange;
    var dT = dyPx / data.ph * visTRange;
    
    _ecmZoom.centerRPM = _ecmPan.startCenterRPM + dRPM;
    _ecmZoom.centerT = _ecmPan.startCenterT + dT;
    
    if(!_ecmPan._raf) {
      _ecmPan._raf = requestAnimationFrame(function() {
        ecmDrawModalChart();
        _ecmPan._raf = null;
      });
    }
    return;
  }
  
  // ── Normal tooltip mode ──
  var rect = canvas.getBoundingClientRect();
  var mx = e.clientX - rect.left;
  var my = e.clientY - rect.top;
  
  var tooltip = document.getElementById('ecm-modal-tooltip');
  var crossV = document.getElementById('ecm-modal-crosshair-v');
  var crossH = document.getElementById('ecm-modal-crosshair-h');
  
  // Check bounds
  if(mx < data.ml || mx > data.ml + data.pw || my < data.mt || my > data.mt + data.ph) {
    if(tooltip) tooltip.style.display = 'none';
    if(crossV) crossV.style.display = 'none';
    if(crossH) crossH.style.display = 'none';
    return;
  }
  
  // Crosshairs
  if(crossV) { crossV.style.display = 'block'; crossV.style.left = mx + 'px'; }
  if(crossH) { crossH.style.display = 'block'; crossH.style.top = my + 'px'; }
  
  var rpm = data.rpmFromX(mx);
  var cursorT = data.torqueFromY(my);
  
  // Motor pump torque at this RPM
  var motorT = 0;
  var mpts = data.motorPts;
  for(var i = 0; i < mpts.length - 1; i++) {
    if(mpts[i].rpm <= rpm && rpm <= mpts[i+1].rpm) {
      var f = (rpm - mpts[i].rpm) / (mpts[i+1].rpm - mpts[i].rpm);
      motorT = mpts[i].torque + f * (mpts[i+1].torque - mpts[i].torque);
      break;
    }
  }
  
  // Calculate converter values at this RPM & find closest to cursor
  var items = [];
  data.curves.forEach(function(c) {
    var tStall = (rpm * rpm) / (c.kpStall * c.kpStall);
    var t80 = c.kp80 > 0 ? (rpm * rpm) / (c.kp80 * c.kp80) : null;
    var distStall = Math.abs(cursorT - tStall);
    var dist80 = t80 !== null ? Math.abs(cursorT - t80) : 9999;
    items.push({ name: c.name, color: c.color, tStall: tStall, t80: t80, stallTau: c.stallTau, minDist: Math.min(distStall, dist80) });
  });
  // Motor curve distance
  var motorDist = motorT > 0 ? Math.abs(cursorT - motorT) : 9999;
  
  // Sort by proximity to cursor
  items.sort(function(a, b) { return a.minDist - b.minDist; });
  
  // Nearest curve (converter or motor)
  var nearest = items[0];
  var nearestIsMotor = motorDist < nearest.minDist;
  
  // Build tooltip — compact
  var html = '<div style="display:flex; align-items:baseline; gap:8px; margin-bottom:5px; padding-bottom:4px; border-bottom:1px solid var(--border-color);">';
  html += '<span style="font-weight:700; color:var(--text-heading); font-size:var(--fs-body);">' + rpm.toFixed(0) + ' rpm</span>';
  html += '</div>';
  
  // Motor line
  if(motorT > 0) {
    var motorHL = nearestIsMotor ? 'background:color-mix(in srgb, var(--accent-warning) 12%, transparent); margin:0 -8px; padding:2px 8px; border-radius:var(--radius-sm);' : '';
    html += '<div style="display:flex; align-items:center; gap:6px; padding:2px 0; ' + motorHL + '">';
    html += '<span style="width:16px; height:3px; background:#f59e0b; border-radius:1px; flex-shrink:0;"></span>';
    html += '<span style="color:#f59e0b; font-weight:600; min-width:65px;">Motor</span>';
    html += '<span style="color:var(--text-primary); font-weight:600;">' + motorT.toFixed(0) + ' N·m</span>';
    html += '</div>';
  }
  
  // Show top 3 nearest converters (not all 7)
  var shown = 0;
  items.forEach(function(c) {
    if(c.tStall > data.maxT * 1.2) return;
    if(shown >= 3) return;
    shown++;
    var isNearest = c === nearest && !nearestIsMotor;
    var hl = isNearest ? 'background:rgba(255,255,255,0.04); margin:0 -8px; padding:2px 8px; border-radius:var(--radius-sm);' : '';
    html += '<div style="display:flex; align-items:center; gap:6px; padding:2px 0; ' + hl + '">';
    html += '<span style="width:16px; height:3px; background:' + c.color + '; border-radius:1px; flex-shrink:0;"></span>';
    html += '<span style="color:' + c.color + '; font-weight:600; min-width:65px;">' + c.name + '</span>';
    html += '<span style="color:var(--text-primary);">' + c.tStall.toFixed(0) + '</span>';
    if(c.t80 !== null && c.t80 < data.maxT * 1.1) {
      html += '<span style="color:var(--text-muted); font-size:var(--fs-micro);">(0.80: ' + c.t80.toFixed(0) + ')</span>';
    }
    html += '</div>';
  });
  
  // If motor intersects a converter stall curve at this RPM
  if(motorT > 0) {
    var intersections = items.filter(function(c) { return Math.abs(c.tStall - motorT) < motorT * 0.04; });
    if(intersections.length > 0) {
      html += '<div style="margin-top:4px; padding-top:3px; border-top:1px solid var(--border-color); color:var(--accent-success); font-weight:600; font-size:var(--fs-tiny);">';
      html += '★ Stall kesişim: ' + intersections.map(function(c) { return c.name; }).join(', ');
      html += '</div>';
    }
  }
  
  if(tooltip) {
    tooltip.innerHTML = html;
    tooltip.style.display = 'block';
    var tw = 260, th = tooltip.offsetHeight || 120;
    var tx = mx + 18, ty = my - 10;
    if(tx + tw > rect.width - 10) tx = mx - tw - 12;
    if(ty + th > rect.height - 10) ty = rect.height - th - 10;
    if(ty < 4) ty = 4;
    tooltip.style.left = tx + 'px';
    tooltip.style.top = ty + 'px';
  }
}

function ecmModalMouseLeave(e) {
  // Pan duruyorsa bitir
  if(_ecmPan.active) {
    _ecmPan.active = false;
    var canvas = document.getElementById('ecm-modal-canvas');
    if(canvas) canvas.style.cursor = 'crosshair';
  }
  var tooltip = document.getElementById('ecm-modal-tooltip');
  var crossV = document.getElementById('ecm-modal-crosshair-v');
  var crossH = document.getElementById('ecm-modal-crosshair-h');
  if(tooltip) tooltip.style.display = 'none';
  if(crossV) crossV.style.display = 'none';
  if(crossH) crossH.style.display = 'none';
}

