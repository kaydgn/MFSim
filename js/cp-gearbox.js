// Şanzıman özellikleri
// ===== ŞANZIMAN KONTROL ÖZELLİKLERİ =====
function getShiftControllerPropertiesHTML(node) {
  var html = '<div class="sw-panel">';

  // Status bar — veri durumunu göster
  var hasData = !!(nodes.find(function(n) { return n.type === 'gearbox'; }) && nodes.find(function(n) { return n.type === 'engine'; }));

  html += '<div class="sw-section-title" style="display:flex;align-items:center;justify-content:space-between;">Shift Schedule (Vites Geçiş Takvimi) <button class="sw-info-btn" onclick="showInfoPopup(\'shiftController\')" title="Bilgi">?</button></div>';

  html += '<div class="sw-pkg-desc">Bu bileşen otomatik şanzıman vites geçiş stratejisini kontrol eder. Converter modda SR eşiklerine göre upshift, lockup modda RPM eşiklerine göre shift kararı verilir.</div>';
  
  // Şanzıman ve motor bileşenlerinden veri çek
  var gbNode = nodes.find(function(n) { return n.type === 'gearbox'; });
  var engNode = nodes.find(function(n) { return n.type === 'engine'; });
  var diffNode = nodes.find(function(n) { return n.type === 'differential' && n.isMasterDiff; })
               || nodes.find(function(n) { return n.type === 'differential'; });
  var transNode = nodes.find(function(n) { return n.type === 'transfer'; });
  var wheelNode = nodes.find(function(n) { return n.type === 'wheel'; });
  
  var gbData = (gbNode && gbNode.data) || {};
  var engData = (engNode && engNode.data) || {};
  var diffData = (diffNode && diffNode.data) || {};
  var transData = (transNode && transNode.data) || {};
  var wheelData = (wheelNode && wheelNode.data) || {};
  
  // Shift profili bilgisi
  var shiftProfile = gbData.shiftProfile || 'allison3200sp_s1';
  var spData = VE_FT_SHIFT_PROFILES[shiftProfile] || {};
  var profileName = spData.name || 'Bilinmiyor';
  var lockupOffset = spData.lockupOffset || 75;
  
  // Governed speed — motor bileşeni her zaman öncelikli
  var esp = engData.motorSpecs || {};
  var governed = parseFloat(esp.governedSpeed) || parseFloat(engData.governedRpm) || 0;
  if(!governed) {
    governed = gbData.gbGovernedSpeed || 0;
  }
  // Shift referans RPM: profilde veya UI'da tanımlıysa onu kullan, yoksa motor governed
  var shiftRefRPM = spData.shiftRefRPM || gbData.shiftRefRPM || governed;
  
  // Driveline oranları
  var ftGears = gbData.ftGearData || VE_FT_GB_DEFAULT_GEARS;
  var i_diff = parseFloat(diffData.diffRatio) || 6.54;
  // Transfer: FT modda ftTrGears kullanır (ilk kademe referans)
  var i_trans = 1;
  if(transData.ftTrGears && transData.ftTrGears.length > 0) {
    var activeTr = transData.ftTrGears[0];
    i_trans = parseFloat(activeTr.ratio || activeTr.oran) || 1;
  } else {
    i_trans = parseFloat(transData.selectedRatio) || 1;
  }
  // Tekerlek yarıçapı → rev/km
  var r_tire = parseFloat(wheelData.ftTireRadius) || parseFloat(wheelData.dynamicRadius) || 0;
  var revPerKm = 0;
  if(r_tire > 0) {
    revPerKm = 1000 / (2 * Math.PI * r_tire);
  }
  if(!revPerKm) revPerKm = 507; // varsayılan
  
  var i_driveline = i_diff * i_trans;
  
  // Lockup shift RPM
  var N_shift_lockup = shiftRefRPM > 0 ? (shiftRefRPM - lockupOffset) : 0;
  
  // Profil adı
  html += '<div class="sw-pkg-card" style="margin-bottom:10px;">';
  html += '<div class="sw-pkg-header" style="cursor:default;"><span class="sw-pkg-name">Aktif Shift Profili</span></div>';
  html += '<div class="sw-pkg-body">';
  html += '<div style="font-size:0.72rem; font-weight:600; color:var(--text-heading);">' + profileName + '</div>';
  if(shiftRefRPM !== governed) {
    html += '<div style="font-size:0.58rem; color:var(--accent-warning); margin-top:2px;">Shift Ref. RPM: ' + shiftRefRPM + ' (motor governed: ' + governed + ')</div>';
  }
  html += '</div></div>';

  // Güncelle butonu
  html += '<div class="sw-btn-row" style="margin:8px 0; justify-content:flex-end;">';
  html += '<button class="sw-btn sw-btn-primary" onclick="veRefreshShiftSchedule()">Güncelle</button>';
  html += '</div>';
  
  // ── 5a. LOCKUP MODE SHIFT TABLOSU ──
  html += '<div class="sw-pkg-card" style="margin-bottom:10px;">';
  html += '<div class="sw-pkg-header" style="cursor:default;"><span class="sw-pkg-name">Lockup Mode Shift Tablosu</span></div>';
  html += '<div class="sw-pkg-body">';
  html += '<div class="sw-pkg-desc">N<sub>shift_lockup</sub> = N<sub>shift_ref</sub> − Lockup_Shift_Offset = ' + shiftRefRPM + ' − ' + lockupOffset + ' = <b>' + N_shift_lockup + ' rpm</b></div>';
  
  if(governed <= 0) {
    html += '<div class="sw-chain-bar fail">⚠ Governed speed tanımlı değil. Önce Motor veya Şanzıman bileşeninde Governed Speed giriniz.</div>';
  } else {
    // Lockup destekli ileri vitesler (F2 ve üstü lockup shift yapabilir)
    var lockupGears = ftGears.filter(function(g) { return g.lockup && g.name && g.name.charAt(0) === 'F'; });
    lockupGears.sort(function(a, b) {
      var na = parseInt(a.name.replace('F','')) || 0;
      var nb = parseInt(b.name.replace('F','')) || 0;
      return na - nb;
    });
    
    html += '<div style="max-height:200px; overflow-y:auto; border:1px solid var(--border-color); border-radius:0;">';
    html += '<table style="width:100%; border-collapse:collapse; font-size:0.66rem;">';
    html += '<thead style="position:sticky; top:0; background:var(--bg-secondary); z-index:1;">';
    html += '<tr>';
    html += '<th style="padding:5px; border-bottom:1px solid var(--border-color); text-align:center;">Geçiş</th>';
    html += '<th style="padding:5px; border-bottom:1px solid var(--border-color); text-align:center;">N<sub>shift</sub><br>[rpm]</th>';
    html += '<th style="padding:5px; border-bottom:1px solid var(--border-color); text-align:center;">i<sub>gear</sub><br>(mevcut)</th>';
    html += '</tr></thead><tbody>';
    
    for(var gi = 0; gi < lockupGears.length - 1; gi++) {
      var fromGear = lockupGears[gi];
      var toGear = lockupGears[gi + 1];
      var fromNum = fromGear.name;
      var toNum = toGear.name;
      // Shift sırasında mevcut vitesteyiz, shift RPM'de çıkış vitesine geçeriz
      var i_gear_from = fromGear.ratio || 1;
      
      html += '<tr style="border-bottom:1px solid var(--border-color);">';
      html += '<td style="padding:4px 6px; text-align:center; font-weight:500;">' + fromNum + 'L → ' + toNum + 'L</td>';
      html += '<td style="padding:4px 6px; text-align:center;">' + N_shift_lockup + '</td>';
      html += '<td style="padding:4px 6px; text-align:center;">' + i_gear_from.toFixed(3) + '</td>';
      html += '</tr>';
    }
    
    html += '</tbody></table></div>';
    
    // Bilgilendirme
    if(!diffNode || (i_diff <= 1.01 && !diffData.diffRatio)) {
      html += '<div class="sw-chain-bar fail">⚠ Diferansiyel oranı tanımlı değil (i_diff=' + i_diff.toFixed(3) + '). Diferansiyel bileşenini kontrol edin.</div>';
    }
  }
  
  html += '</div></div>';

  // ── 5b. CONVERTER MODE SHIFT MANTIĞI ──
  var shift1C2C_outRatio = spData.shift1C2C_outRatio || 0.2150;
  var shift2C2L_outRatio = spData.shift2C2L_outRatio || 0.3593;

  html += '<div class="sw-pkg-card" style="margin-bottom:10px;">';
  html += '<div class="sw-pkg-header" style="cursor:default;"><span class="sw-pkg-name">Converter Mode Shift Mantığı</span></div>';
  html += '<div class="sw-pkg-body">';
  html += '<div class="sw-pkg-desc">Converter-mod geçişleri şanzıman çıkış devri oranına (N_out / N_shift_ref) göre belirlenir. Bu oranlar motordan bağımsızdır — farklı governed RPM\'li motorlarda da doğru shift noktası verir.</div>';
  
  // Parametre tablosu
  html += '<table style="width:100%; border-collapse:collapse; font-size:0.64rem; border:1px solid var(--border-color); margin-bottom:8px;">';
  html += '<thead><tr style="background:var(--bg-secondary);">';
  html += '<th style="padding:5px 6px; text-align:left; border-bottom:1px solid var(--border-color);">Parametre</th>';
  html += '<th style="padding:5px 6px; text-align:center; border-bottom:1px solid var(--border-color); width:20%;">Değer</th>';
  html += '<th style="padding:5px 6px; text-align:left; border-bottom:1px solid var(--border-color);">Açıklama</th>';
  html += '</tr></thead><tbody>';
  html += '<tr style="border-bottom:1px solid var(--border-color);">';
  html += '<td style="padding:4px 6px; font-weight:500;">1C→2C Oran (N_out/N_gov)</td>';
  html += '<td style="padding:4px 6px; text-align:center; font-weight:600; color:var(--accent-primary);">' + shift1C2C_outRatio + '</td>';
  html += '<td style="padding:4px 6px; color:var(--text-muted);">N_out ≥ ' + shift1C2C_outRatio + ' × N_shift_ref → 1C→2C shift</td>';
  html += '</tr>';
  html += '<tr>';
  html += '<td style="padding:4px 6px; font-weight:500;">2C→2L Oran (N_out/N_gov)</td>';
  html += '<td style="padding:4px 6px; text-align:center; font-weight:600; color:var(--accent-primary);">' + shift2C2L_outRatio + '</td>';
  html += '<td style="padding:4px 6px; color:var(--text-muted);">N_out ≥ ' + shift2C2L_outRatio + ' × N_shift_ref → lockup engage</td>';
  html += '</tr>';
  html += '</tbody></table>';
  
  // Shift mantığı kuralları
  html += '<div style="background:var(--bg-input); border-radius:0; padding:8px 10px; margin-bottom:8px; border:1px solid var(--border-color); font-family:monospace; font-size:0.6rem; line-height:1.6; color:var(--text-secondary);">';
  html += '1C → 2C: shift @ N_out ≥ ' + shift1C2C_outRatio + ' × N_shift_ref<br>';
  html += '2C → 2L: shift @ N_out ≥ ' + shift2C2L_outRatio + ' × N_shift_ref (lockup engage)';
  html += '</div>';
  
  // Bilgi kutusu
  html += '<div class="sw-pkg-desc" style="border-left:3px solid var(--accent-primary); padding:8px 10px; font-style:italic;">';
  html += '"N_out = N_engine × SR / i_gear (şanzıman çıkış devri). Geçiş oranları iSCAAN çapraz validasyondan türetilmiştir. 3200 SP: 2 motor, 4000 SP: 3 motor + 2 TC ile doğrulanmış."';
  html += '</div>';

  html += '</div></div>';

  // ── SHIFT CONTROLLER ALGORİTMASI (Görsel) ──
  html += '<div class="sw-pkg-card" style="margin-bottom:10px;">';
  html += '<div class="sw-pkg-header" style="cursor:default;"><span class="sw-pkg-name">Shift Controller Algoritması</span></div>';
  html += '<div class="sw-pkg-body">';
  
  var codeStyle = 'background:var(--bg-input); border-radius:0; padding:10px; border:1px solid var(--border-color); font-family:monospace; font-size:0.55rem; line-height:1.7; color:var(--text-secondary); overflow-x:auto; white-space:pre;';
  
  html += '<div style="' + codeStyle + '">';
  html += '<span style="color:var(--text-muted);">Girdiler: N_engine, SR, V_vehicle, current_gear, mode</span>\n\n';
  html += '<span style="color:var(--accent-warning);">=== BAŞLANGIÇ DURUMU ===</span>\n';
  html += '  gear = F1, mode = CONVERTER, V = 0\n\n';
  html += '<span style="color:var(--accent-warning);">=== HER ZAMAN ADIMINDA ===</span>\n\n';
  
  html += '<span style="color:var(--accent-primary);">Adım 1: Converter modunda 1C → 2C upshift</span>\n';
  html += '  Eğer mode == CONVERTER VE gear == F1:\n';
  html += '    N_out = N_engine × SR / i_gear_F1\n';
  html += '    Eğer N_out >= ' + shift1C2C_outRatio + ' × N_shift_ref:\n';
  html += '      → gear = F2, mode = CONVERTER (2C)\n\n';
  
  html += '<span style="color:var(--accent-primary);">Adım 2: Converter → Lockup geçişi (2C → 2L)</span>\n';
  html += '  Eğer mode == CONVERTER VE gear == F2:\n';
  html += '    N_out = N_engine × SR / i_gear_F2\n';
  html += '    Eğer N_out >= ' + shift2C2L_outRatio + ' × N_shift_ref:\n';
  html += '      → mode = LOCKUP (2L)\n';
  html += '      → N_engine = N_turbine (1:1 mekanik kilit)\n\n';
  
  html += '<span style="color:var(--accent-primary);">Adım 3: Lockup modunda upshift (2L→3L→...→6L)</span>\n';
  html += '  Eğer mode == LOCKUP:\n';
  html += '    N_shift = N_shift_ref − ' + lockupOffset + '\n';
  html += '    Eğer N_engine >= N_shift:\n';
  html += '      next_gear = bir üst vites\n';
  html += '      Eğer next_gear var VE lockup destekliyse:\n';
  html += '        → gear = next_gear, mode = LOCKUP\n';
  html += '      Eğer next_gear yoksa:\n';
  html += '        → Shift yapma (son vites, governed\'a yaklaş)\n\n';
  
  html += '<span style="color:var(--accent-primary);">Adım 4: Shift sonrası devir düşüşü</span>\n';
  html += '  Shift gerçekleştiğinde:\n';
  html += '    N_engine_yeni = N_engine_eski × (i_eski / i_yeni)\n';
  html += '    Bu değer &lt; governed olmalı (kontrol)';
  html += '</div>';
  
  // Shift sırası görsel
  html += '<div class="sw-section-title" style="margin-top:10px;">Shift Sırası — ' + profileName + ', full throttle (WOT):</div>';
  
  html += '<div style="background:var(--bg-input); border-radius:0; padding:10px; border:1px solid var(--border-color); font-family:monospace; font-size:0.55rem; line-height:1.8; color:var(--text-secondary); overflow-x:auto; white-space:pre;">';
  html += '<span style="color:var(--accent-primary); font-weight:600;">1C → 2C → 2L → 3L → 4L → 5L → 6L</span>\n';
  html += ' │                              └ Son vites, governed\'a kadar\n';
  html += ' │                     └ N_eng >= N_ref−' + lockupOffset + ' → 6L\n';
  html += ' │                └ N_eng >= N_ref−' + lockupOffset + ' → 5L\n';
  html += ' │           └ N_eng >= N_ref−' + lockupOffset + ' → 4L\n';
  html += ' │      └ N_eng >= N_ref−' + lockupOffset + ' → 3L\n';
  html += ' │ └ N_out >= ' + shift2C2L_outRatio + '×N_ref → lockup engage\n';
  html += ' └ N_out >= ' + shift1C2C_outRatio + '×N_ref → 2C';
  html += '</div>';

  html += '</div></div>';

  html += '</div>';
  return html;
}

// Shift Schedule panelini yenile (diğer bileşenlerden güncel veriyi çeker)
function veRefreshShiftSchedule() {
  var scNode = nodes.find(function(n) { return n.type === 'shift-controller'; });
  if(scNode) {
    selectedNodes = [scNode];
    showNodeProperties(scNode);
    showToast('Shift Schedule güncellendi');
  }
}

/**
 * Lockup shift eşiğini hesaplar (upshift ve downshift için ortak).
 * Desteklenen formatlar:
 *   { a, b }                                     → lineer: N_out = a × ESL + b
 *   { a, b, minCap }                             → min cap'li lineer
 *   { a, b, capValue, capBelow }                  → cap'li lineer (ESL < capBelow → capValue)
 *   { type:'piecewise', breakpoint, low, high }   → parçalı lineer (2 segment)
 *   { type:'segments', segments: [{maxESL, a, b, cap}, ...] } → çok segmentli
 */
function calcLockupShiftThreshold(ls, esl) {
  if(!ls) return 0;
  if(ls.type === 'piecewise') {
    if(esl <= ls.breakpoint) return ls.low.a * esl + (ls.low.b || 0);
    return ls.high.a * esl + (ls.high.b || 0);
  }
  if(ls.type === 'segments') {
    for(var si = 0; si < ls.segments.length; si++) {
      var seg = ls.segments[si];
      if(seg.maxESL !== undefined && esl <= seg.maxESL) {
        return seg.cap !== undefined ? seg.cap : (seg.a * esl + (seg.b || 0));
      }
      if(si === ls.segments.length - 1) {
        return seg.cap !== undefined ? seg.cap : (seg.a * esl + (seg.b || 0));
      }
    }
  }
  if(ls.capValue !== undefined && ls.capBelow !== undefined && esl < ls.capBelow) {
    return ls.capValue;
  }
  var thr = ls.a * esl + (ls.b || 0);
  if(ls.minCap !== undefined) thr = Math.max(thr, ls.minCap);
  return thr;
}

// ===== SHIFT CONTROLLER RUNTIME ALGORİTMASI =====
// Her simülasyon zaman adımında çağrılır
function veShiftControllerStep(state, params) {
  // state: { N_engine, SR, V_vehicle, gear, gearIndex, mode, tau }
  // params: { governed, lockupOffset, shift1C2C_outRatio, shift2C2L_outRatio, ftGears }
  // mode: 'CONVERTER' veya 'LOCKUP'
  // Returns: { gear, gearIndex, mode, shifted, shiftType }
  
  var result = {
    gear: state.gear,
    gearIndex: state.gearIndex,
    mode: state.mode,
    shifted: false,
    shiftType: null
  };
  
  var N_eng = state.N_engine;
  var SR = state.SR;
  var governed = params.governed;
  var refRPM = params.shiftRefRPM || governed;  // Shift referans RPM
  var gears = params.ftGears;
  var lockupGears = gears.filter(function(g) { return g.lockup && g.name && g.name.charAt(0) === 'F'; });
  lockupGears.sort(function(a, b) {
    return (parseInt(a.name.replace('F','')) || 0) - (parseInt(b.name.replace('F','')) || 0);
  });
  
  // Converter-mod geçiş sabitleri (fallback oran, converterShifts yoksa)
  var SHIFT_1C_2C_OUT_RATIO = params.shift1C2C_outRatio || 0.2150;
  var SHIFT_2C_2L_OUT_RATIO = params.shift2C2L_outRatio || 0.3594;
  var csParams = params.converterShifts || null;

  // Segmentli 2C→2L eşiği hesaplama
  function _calc2C2LThreshold(esl) {
    if(!csParams || !csParams['2C2L']) return SHIFT_2C_2L_OUT_RATIO * esl;
    var cs2L = csParams['2C2L'];
    if(cs2L.type === 'segmented') {
      if(esl >= cs2L.linear.validFrom) return cs2L.linear.a * esl + cs2L.linear.b;
      var lk = cs2L.lookup;
      if(!lk || lk.length === 0) return cs2L.linear.a * esl + cs2L.linear.b;
      if(esl <= lk[0][0]) return lk[0][1];
      for(var li = 0; li < lk.length - 1; li++) {
        if(esl >= lk[li][0] && esl <= lk[li + 1][0]) {
          var frac = (esl - lk[li][0]) / (lk[li + 1][0] - lk[li][0]);
          return lk[li][1] + frac * (lk[li + 1][1] - lk[li][1]);
        }
      }
      return lk[lk.length - 1][1];
    }
    return cs2L.a * esl + (cs2L.b || 0);
  }

  // Adım 1: Converter modunda 1C → 2C
  if(state.mode === 'CONVERTER' && state.gearIndex === 0) {
    var allFwdGears = gears.filter(function(g) { return g.name && g.name.charAt(0) === 'F'; });
    allFwdGears.sort(function(a, b) { return (parseInt(a.name.replace('F',''))||0) - (parseInt(b.name.replace('F',''))||0); });
    var i_gear_F1 = allFwdGears.length > 0 ? (parseFloat(allFwdGears[0].ratio) || 1.0) : 1.0;
    var N_out = N_eng * SR / i_gear_F1;
    var threshold_1C2C;
    if(csParams && csParams['1C2C']) {
      threshold_1C2C = csParams['1C2C'].a * refRPM + (csParams['1C2C'].b || 0);
    } else {
      threshold_1C2C = SHIFT_1C_2C_OUT_RATIO * refRPM;
    }
    if(N_out >= threshold_1C2C) {
      result.gear = lockupGears.length > 1 ? lockupGears[1].name : state.gear;
      result.gearIndex = 1;
      result.mode = 'CONVERTER';
      result.shifted = true;
      result.shiftType = 'N_out-ratio (' + N_out.toFixed(0) + ' >= ' + threshold_1C2C.toFixed(0) + ')';
      return result;
    }
  }

  // Adım 2: Converter → Lockup (2C → 2L)
  if(state.mode === 'CONVERTER' && state.gearIndex === 1) {
    var allFwdGears2 = gears.filter(function(g) { return g.name && g.name.charAt(0) === 'F'; });
    allFwdGears2.sort(function(a, b) { return (parseInt(a.name.replace('F',''))||0) - (parseInt(b.name.replace('F',''))||0); });
    var i_gear_F2 = allFwdGears2.length > 1 ? (parseFloat(allFwdGears2[1].ratio) || 1.0) : 1.0;
    var N_out_2 = N_eng * SR / i_gear_F2;
    var threshold_2C2L = _calc2C2LThreshold(refRPM);
    if(N_out_2 >= threshold_2C2L) {
      result.mode = 'LOCKUP';
      result.shifted = true;
      result.shiftType = 'lockup-engage (N_out=' + N_out_2.toFixed(0) + ')';
      return result;
    }
  }
  
  // Adım 3: Lockup modunda upshift (2L → 3L → ... → 6L)
  // Lineer formül: N_out >= a × ESL + b (per-gear kalibrasyon)
  // Fallback: N_engine >= refRPM - lockupOffset (eski sabit ofset)
  if(state.mode === 'LOCKUP') {
    var nextIdx = state.gearIndex + 1;
    if(nextIdx < lockupGears.length && lockupGears[nextIdx].lockup) {
      var i_gear_lu = parseFloat(lockupGears[state.gearIndex].ratio) || 1.0;
      var N_out_lu = N_eng / i_gear_lu;  // Lockup modda SR=1
      var fromName = (state.gearIndex + 1) + 'L';
      var toName = (state.gearIndex + 2) + 'L';
      var shiftKey = fromName + toName;
      var luTriggered = false;

      if(params.lockupShifts && params.lockupShifts[shiftKey]) {
        var ls = params.lockupShifts[shiftKey];
        var threshold_lu = calcLockupShiftThreshold(ls, refRPM);
        if(N_out_lu >= threshold_lu) luTriggered = true;
      } else {
        // Eski yöntem: sabit lockupOffset
        var N_shift = refRPM - params.lockupOffset;
        if(N_eng >= N_shift) luTriggered = true;
      }

      if(luTriggered) {
        result.gear = lockupGears[nextIdx].name;
        result.gearIndex = nextIdx;
        result.mode = 'LOCKUP';
        result.shifted = true;
        result.shiftType = 'lockup-upshift (' + shiftKey + ')';
        return result;
      }
    }
  }
  
  return result;
}

// Shift sonrası devir hesabı
function veCalcPostShiftRPM(N_engine_old, i_old, i_new) {
  return N_engine_old * (i_old / i_new);
}

function getGearboxPropertiesHTML(node) {
  var nodeData = node.data || {};
  var isFullThrottle = veActiveModule === 'full-throttle';
  
  var html = '<div class="sw-panel">';

  html += '<div class="sw-section-title" style="display:flex;align-items:center;justify-content:space-between;">Şanzıman Verileri <button class="sw-info-btn" onclick="showInfoPopup(\'sanzimanVerileri\')" title="Bilgi">?</button></div>';

  if(isFullThrottle) {
    // ── TAM GAZ HIZLANMA: Şanzıman Parametreleri ──
    var gbName = nodeData.gbName || 'Allison 3200 SP';
    var shiftProfile = nodeData.shiftProfile || 'allison3200sp_s1';
    var forwardGears = nodeData.forwardGears !== undefined ? nodeData.forwardGears : 6;
    var reverseGears = nodeData.reverseGears !== undefined ? nodeData.reverseGears : 1;
    var gbGovernedSpeed = nodeData.gbGovernedSpeed !== undefined ? nodeData.gbGovernedSpeed : '';
    
    // Motordan governed speed çekmeye çalış
    var autoGoverned = '';
    var engineNode = nodes.find(function(n) { return n.type === 'engine'; });
    if(engineNode && engineNode.data) {
      var esp = engineNode.data.motorSpecs || {};
      autoGoverned = esp.governedSpeed || engineNode.data.governedRpm || '';
    }
    var displayGoverned = gbGovernedSpeed || autoGoverned || '';
    
    html += '<div class="sw-pkg-card" style="margin-bottom:10px;">';
    html += '<div class="sw-pkg-header" style="cursor:default;"><span class="sw-pkg-name">Şanzıman Parametreleri</span></div>';
    html += '<div class="sw-pkg-body">';
    
    // Şanzıman Preset Seçici
    var ftGBPreset = nodeData.ftGBPreset || '';
    var hasEGM = nodes.some(function(n) { return n.type === 'engine-gearbox-matching'; });
    html += '<div style="display:flex; gap:6px; margin-bottom:8px; align-items:center;">';
    html += '<select id="ve-ft-gb-preset-' + node.id + '"' + (hasEGM ? ' disabled' : '') + ' onchange="onVEFTGBPresetSelect(\'' + node.id + '\', this.value)" style="flex:1; font-size:0.68rem; padding:4px 6px; background:var(--bg-input); color:var(--text-primary); border:1px solid var(--border-color); border-radius:0;' + (hasEGM ? ' opacity:0.6; cursor:not-allowed;' : '') + '">';
    html += '<option value="">-- Şanzıman Preset (' + Object.keys(VE_GEARBOX_PRESETS).length + ') --</option>';
    Object.keys(VE_GEARBOX_PRESETS).forEach(function(gk) {
      var gp = VE_GEARBOX_PRESETS[gk];
      var fwdC = gp.gears.filter(function(g) { return g.gear !== 'R'; }).length;
      var calM = (gp.calibrated ? ' ✦' : '') + (gp.downshiftCalibrated ? ' ✧' : '') + (gp.partialData ? ' ★' : '');
      var gSel = (gk === ftGBPreset) ? ' selected' : '';
      html += '<option value="' + gk + '"' + gSel + '>' + gp.name + ' (' + fwdC + 'V)' + calM + '</option>';
    });
    html += '</select>';
    html += '</div>';
    html += '<div style="font-size:0.55rem; color:var(--text-muted); margin:-4px 0 6px 2px; line-height:1.3;"><span style="color:var(--accent-warning);" title="Upshift kalibrasyon mevcut">✦</span> = Upshift kalibrasyon &nbsp; <span style="color:var(--accent-danger);" title="Downshift kalibrasyon mevcut">✧</span> = Downshift kalibrasyon &nbsp; <span style="color:#e53e3e;" title="Eksik veri — sadece vites oranları mevcut">★</span> = Eksik veri</div>';
    if(hasEGM) {
      html += '<div class="sw-chain-bar fail">🔒 Şanzıman seçimi Motor-Şanzıman Eşleştirme bileşeni üzerinden yapılmaktadır.</div>';
    }

    // Şanzıman limitleri bilgi kutusu
    if(ftGBPreset && VE_GEARBOX_PRESETS[ftGBPreset]) {
      var _lp = VE_GEARBOX_PRESETS[ftGBPreset];
      if(_lp.grossInputPower || _lp.grossInputTorque || _lp.netTurbineTorque || _lp.maxOutputSpeed) {
        html += '<div style="background:var(--bg-secondary); border:1px solid var(--border-color); border-radius:0; padding:6px 8px; margin-bottom:8px; font-size:0.6rem; line-height:1.5;">';
        html += '<div style="font-weight:600; color:var(--text-heading); margin-bottom:2px; font-size:0.62rem;">Şanzıman Limitleri</div>';
        html += '<div style="display:flex; flex-wrap:wrap; gap:4px 12px; color:var(--text-secondary);">';
        if(_lp.grossInputPower) html += '<span>Giriş Güç: <b style="color:var(--text-primary);">' + _lp.grossInputPower + ' kW</b></span>';
        if(_lp.grossInputTorque) html += '<span>Giriş Tork: <b style="color:var(--text-primary);">' + _lp.grossInputTorque + ' Nm</b></span>';
        if(_lp.netTurbineTorque) html += '<span>Türbin Tork: <b style="color:var(--text-primary);">' + _lp.netTurbineTorque + ' Nm</b></span>';
        if(_lp.maxOutputSpeed) html += '<span>Max Çıkış: <b style="color:var(--text-primary);">' + _lp.maxOutputSpeed + ' rpm</b></span>';
        html += '</div></div>';
      }
    }

    html += '<table style="width:100%; font-size:0.68rem; border-collapse:collapse; border:1px solid var(--border-color);">';
    
    // Shift Profili — yalnızca seçili şanzımana ait kalibrasyonlar
    html += '<tr style="border-bottom:1px solid var(--border-color);">';
    html += '<th style="padding:6px 8px; text-align:left; background:var(--bg-tertiary); border-right:1px solid var(--border-color); font-weight:500; color:var(--text-secondary);">Shift Profili</th>';
    html += '<td style="padding:4px 6px; background:var(--bg-tertiary);">';
    html += '<select id="ve-gb-shift-' + node.id + '" style="width:100%; padding:4px; font-size:0.68rem; background:var(--bg-input); color:var(--text-primary); border:1px solid var(--border-color); border-radius:0;" onchange="onVEFTGBParamChange(\'' + node.id + '\')">';
    var spCount = 0;
    var spFirstMatch = '';
    var spCurrentValid = false;
    Object.keys(VE_FT_SHIFT_PROFILES).forEach(function(spKey) {
      if(!ftGBPreset || veGetGearboxKeyFromShiftProfile(spKey) !== ftGBPreset) return;
      if(!spFirstMatch) spFirstMatch = spKey;
      if(spKey === shiftProfile) spCurrentValid = true;
      spCount++;
    });
    // Eğer mevcut profil bu şanzımana ait değilse, ilk uyumlu profili seç (yoksa temizle)
    if(!spCurrentValid) {
      shiftProfile = spFirstMatch;
      nodeData.shiftProfile = spFirstMatch;
    }
    Object.keys(VE_FT_SHIFT_PROFILES).forEach(function(spKey) {
      if(!ftGBPreset || veGetGearboxKeyFromShiftProfile(spKey) !== ftGBPreset) return;
      var sp = VE_FT_SHIFT_PROFILES[spKey];
      var sel = (spKey === shiftProfile) ? ' selected' : '';
      html += '<option value="' + spKey + '"' + sel + '>' + sp.name + ' ✦</option>';
    });
    if(spCount === 0) {
      html += '<option value="" disabled selected>— Bu şanzıman için kalibrasyon yok —</option>';
    }
    html += '</select>';
    html += '</td>';
    html += '</tr>';
    
    // Shift Referans RPM
    var shiftRefVal = nodeData.shiftRefRPM || '';
    html += '<tr style="border-bottom:1px solid var(--border-color);">';
    html += '<th style="padding:6px 8px; text-align:left; background:var(--bg-tertiary); border-right:1px solid var(--border-color); font-weight:500; color:var(--text-secondary);">Shift Ref. RPM</th>';
    html += '<td style="padding:4px 6px; background:var(--bg-tertiary);"><input type="number" id="ve-gb-shift-ref-' + node.id + '" value="' + shiftRefVal + '" placeholder="boş = motor governed" step="50" min="600" max="4000" style="width:100%; padding:4px; font-size:0.68rem; background:var(--bg-input); color:var(--text-primary); border:1px solid var(--border-color); border-radius:0; text-align:right;" onchange="onVEFTGBParamChange(\'' + node.id + '\')"></td>';
    html += '</tr>';
    html += '<tr><td colspan="2" style="padding:3px 8px; font-size:0.52rem; color:var(--text-muted); background:var(--bg-secondary); line-height:1.3;"><span style="color:var(--accent-primary);">ℹ</span> iSCAAN raporlarındaki "Shift Speed &amp; Strategy" değeri. Genellikle motor governed hızına eşittir. Farklıysa buraya girin.</td></tr>';
    
    // Shift profili parametreleri (readonly)
    var spData = VE_FT_SHIFT_PROFILES[shiftProfile] || {lockupOffset: 75, shift1C2C_outRatio: 0.2150, shift2C2L_outRatio: 0.3594};
    var roStyle = 'width:100%; padding:4px; font-size:0.68rem; background:var(--bg-secondary); color:var(--text-secondary); border:1px solid var(--border-color); border-radius:0; text-align:right; cursor:default;';

    // Converter-mod geçiş parametreleri
    if(spData.converterShifts) {
      // Lineer/segmentli converter model (örn. 4500SP)
      var cs = spData.converterShifts;
      html += '<tr style="border-bottom:1px solid var(--border-color);">';
      html += '<th colspan="2" style="padding:6px 8px; text-align:left; background:var(--bg-tertiary); font-weight:500; color:var(--text-secondary); font-size:0.66rem;">Converter Geçişleri <span style="color:var(--text-muted); font-weight:400;">[N_out = a×ESL + b]</span></th>';
      html += '</tr>';
      if(cs['1C2C']) {
        html += '<tr style="border-bottom:1px solid var(--border-color);">';
        html += '<th style="padding:4px 8px; text-align:left; background:var(--bg-tertiary); border-right:1px solid var(--border-color); font-weight:400; color:var(--text-secondary); font-size:0.64rem;">1C→2C</th>';
        html += '<td style="padding:4px 6px; background:var(--bg-tertiary); font-size:0.64rem; color:var(--text-secondary);">' + cs['1C2C'].a + ' × ESL ' + (cs['1C2C'].b >= 0 ? '+ ' : '− ') + Math.abs(cs['1C2C'].b || 0) + '</td>';
        html += '</tr>';
      }
      if(cs['2C2L']) {
        var cs2L = cs['2C2L'];
        html += '<tr style="border-bottom:1px solid var(--border-color);">';
        html += '<th style="padding:4px 8px; text-align:left; background:var(--bg-tertiary); border-right:1px solid var(--border-color); font-weight:400; color:var(--text-secondary); font-size:0.64rem;">2C→2L</th>';
        if(cs2L.type === 'segmented') {
          var linStr = cs2L.linear.a + ' × ESL ' + (cs2L.linear.b >= 0 ? '+ ' : '− ') + Math.abs(cs2L.linear.b);
          var lookupStr = cs2L.lookup.map(function(p) { return p[0] + ':' + p[1]; }).join(', ');
          html += '<td style="padding:4px 6px; background:var(--bg-tertiary); font-size:0.62rem; color:var(--text-secondary); line-height:1.3;">ESL ≥ ' + cs2L.linear.validFrom + ': ' + linStr + '<br>ESL &lt; ' + cs2L.linear.validFrom + ': Lookup [' + lookupStr + ']</td>';
        } else {
          html += '<td style="padding:4px 6px; background:var(--bg-tertiary); font-size:0.64rem; color:var(--text-secondary);">' + cs2L.a + ' × ESL ' + ((cs2L.b || 0) >= 0 ? '+ ' : '− ') + Math.abs(cs2L.b || 0) + '</td>';
        }
        html += '</tr>';
      }
      html += '<tr><td colspan="2" style="padding:5px 8px; font-size:0.56rem; color:var(--text-muted); background:var(--bg-secondary); line-height:1.4;">Converter-mod geçişleri lineer/segmentli model ile hesaplanır. N_out = N_engine × SR / i_gear.</td></tr>';
    } else {
      // Basit oran bazlı converter model (3200SP, 4000SP)
      html += '<tr style="border-bottom:1px solid var(--border-color);">';
      html += '<th style="padding:6px 8px; text-align:left; background:var(--bg-tertiary); border-right:1px solid var(--border-color); font-weight:500; color:var(--text-secondary);">1C→2C Oran <span style="color:var(--text-muted); font-weight:400;">[N_out/N_ref]</span></th>';
      html += '<td style="padding:4px 6px; background:var(--bg-tertiary);"><input type="text" id="ve-gb-sr-shift-' + node.id + '" value="' + (spData.shift1C2C_outRatio || 0.2150) + '" readonly style="' + roStyle + '" tabindex="-1"></td>';
      html += '</tr>';

      html += '<tr style="border-bottom:1px solid var(--border-color);">';
      html += '<th style="padding:6px 8px; text-align:left; background:var(--bg-tertiary); border-right:1px solid var(--border-color); font-weight:500; color:var(--text-secondary);">2C→2L Oran <span style="color:var(--text-muted); font-weight:400;">[N_out/N_ref]</span></th>';
      html += '<td style="padding:4px 6px; background:var(--bg-tertiary);"><input type="text" id="ve-gb-sr-lockup-' + node.id + '" value="' + (spData.shift2C2L_outRatio || 0.3594) + '" readonly style="' + roStyle + '" tabindex="-1"></td>';
      html += '</tr>';

      html += '<tr><td colspan="2" style="padding:5px 8px; font-size:0.56rem; color:var(--text-muted); background:var(--bg-secondary); line-height:1.4;">Converter-mod geçiş oranları iSCAAN çapraz validasyondan türetilmiştir. N_out = N_engine × SR / i_gear.</td></tr>';
    }

    // Lockup-mod geçiş parametreleri (per-gear kalibrasyon varsa göster)
    if(spData.lockupShifts) {
      html += '<tr style="border-bottom:1px solid var(--border-color);">';
      html += '<th colspan="2" style="padding:6px 8px; text-align:left; background:var(--bg-tertiary); font-weight:500; color:var(--text-secondary); font-size:0.66rem;">Lockup Geçişleri <span style="color:var(--text-muted); font-weight:400;">[N_out = a×ESL + b]</span></th>';
      html += '</tr>';
      Object.keys(spData.lockupShifts).forEach(function(sk) {
        var ls = spData.lockupShifts[sk];
        var label = sk.replace(/(\d+L)(\d+L)/, '$1→$2');
        var formula;
        if(ls.type === 'piecewise') {
          var lowF = ls.low.a + ' × ESL ' + ((ls.low.b || 0) >= 0 ? '+ ' : '− ') + Math.abs(ls.low.b || 0);
          var highF = ls.high.a + ' × ESL ' + ((ls.high.b || 0) >= 0 ? '+ ' : '− ') + Math.abs(ls.high.b || 0);
          formula = 'ESL ≤ ' + ls.breakpoint + ': ' + lowF + '<br>ESL &gt; ' + ls.breakpoint + ': ' + highF;
        } else if(ls.type === 'segments') {
          formula = ls.segments.map(function(seg, i) {
            if(seg.cap !== undefined) return 'ESL ≤ ' + seg.maxESL + ': ' + seg.cap + ' (cap)';
            var f = seg.a + ' × ESL ' + ((seg.b || 0) >= 0 ? '+ ' : '− ') + Math.abs(seg.b || 0);
            return seg.maxESL ? ('ESL ≤ ' + seg.maxESL + ': ' + f) : f;
          }).join('<br>');
        } else {
          formula = ls.a + ' × ESL ' + ((ls.b || 0) >= 0 ? '+ ' : '− ') + Math.abs(ls.b || 0);
          if(ls.capValue !== undefined) formula += ' (cap: ' + ls.capValue + ', ESL &lt; ' + ls.capBelow + ')';
          else if(ls.minCap !== undefined) formula += ' (min: ' + ls.minCap + ')';
        }
        html += '<tr style="border-bottom:1px solid var(--border-color);">';
        html += '<th style="padding:4px 8px; text-align:left; background:var(--bg-tertiary); border-right:1px solid var(--border-color); font-weight:400; color:var(--text-secondary); font-size:0.64rem;">' + label + '</th>';
        html += '<td style="padding:4px 6px; background:var(--bg-tertiary); font-size:0.64rem; color:var(--text-secondary);">' + formula + '</td>';
        html += '</tr>';
      });
    } else {
      // Eski sabit ofset göster
      html += '<tr style="border-bottom:1px solid var(--border-color);">';
      html += '<th style="padding:6px 8px; text-align:left; background:var(--bg-tertiary); border-right:1px solid var(--border-color); font-weight:500; color:var(--text-secondary);">Lockup Shift Offset <span style="color:var(--text-muted); font-weight:400;">[rpm]</span></th>';
      html += '<td style="padding:4px 6px; background:var(--bg-tertiary);"><input type="text" id="ve-gb-lockup-offset-' + node.id + '" value="' + spData.lockupOffset + '" readonly style="' + roStyle + '" tabindex="-1"></td>';
      html += '</tr>';
    }

    // Downshift eşikleri (varsa göster)
    if(spData.downshiftThresholds) {
      html += '<tr style="border-bottom:1px solid var(--border-color);">';
      html += '<th colspan="2" style="padding:6px 8px; text-align:left; background:var(--bg-tertiary); font-weight:500; color:var(--accent-warning); font-size:0.66rem;">Downshift Eşikleri <span style="color:var(--text-muted); font-weight:400;">[N_out &lt; threshold → alt vites]</span></th>';
      html += '</tr>';
      // Sıralı gösterim: büyük vitesten küçüğe
      var dsKeys = Object.keys(spData.downshiftThresholds).sort(function(a, b) {
        var na = parseInt(a); var nb = parseInt(b);
        return nb - na; // 6to5, 5to4, 4to3, 3to2, 2to1
      });
      dsKeys.forEach(function(dk) {
        var ds = spData.downshiftThresholds[dk];
        var label = dk.replace(/(\d+)to(\d+)/, '$1→$2');
        var formula;
        if(ds.type === 'piecewise') {
          var lowF = ds.low.a + ' × ESL ' + ((ds.low.b || 0) >= 0 ? '+ ' : '− ') + Math.abs(ds.low.b || 0);
          var highF = ds.high.a + ' × ESL ' + ((ds.high.b || 0) >= 0 ? '+ ' : '− ') + Math.abs(ds.high.b || 0);
          formula = 'ESL ≤ ' + ds.breakpoint + ': ' + lowF + '<br>ESL &gt; ' + ds.breakpoint + ': ' + highF;
        } else if(ds.type === 'segments') {
          formula = ds.segments.map(function(seg) {
            if(seg.cap !== undefined) return 'ESL ≤ ' + seg.maxESL + ': ' + seg.cap + ' (cap)';
            var f = seg.a + ' × ESL ' + ((seg.b || 0) >= 0 ? '+ ' : '− ') + Math.abs(seg.b || 0);
            return seg.maxESL ? ('ESL ≤ ' + seg.maxESL + ': ' + f) : f;
          }).join('<br>');
        } else {
          formula = ds.a + ' × ESL ' + ((ds.b || 0) >= 0 ? '+ ' : '− ') + Math.abs(ds.b || 0);
          if(ds.capValue !== undefined) formula += ' (cap: ' + ds.capValue + ', ESL &lt; ' + ds.capBelow + ')';
        }
        html += '<tr style="border-bottom:1px solid var(--border-color);">';
        html += '<th style="padding:4px 8px; text-align:left; background:var(--bg-tertiary); border-right:1px solid var(--border-color); font-weight:400; color:var(--accent-warning); font-size:0.64rem;">' + label + '</th>';
        html += '<td style="padding:4px 6px; background:var(--bg-tertiary); font-size:0.62rem; color:var(--text-secondary); line-height:1.3;">' + formula + '</td>';
        html += '</tr>';
      });
      html += '<tr><td colspan="2" style="padding:5px 8px; font-size:0.56rem; color:var(--text-muted); background:var(--bg-secondary); line-height:1.4;">Araç yavaşlarken N_out eşiğin altına düşerse alt vitese geçilir. Oran tabanlı formüller (N_engine = k × ESL). Histerezis: upshift &gt; downshift.</td></tr>';
    }

    // Vites Sayısı (İleri)
    html += '<tr style="border-bottom:1px solid var(--border-color);">';
    html += '<th style="padding:6px 8px; text-align:left; background:var(--bg-tertiary); border-right:1px solid var(--border-color); font-weight:500; color:var(--text-secondary);">Vites Sayısı (İleri)</th>';
    html += '<td style="padding:4px 6px; background:var(--bg-tertiary);"><input type="number" id="ve-gb-fwd-' + node.id + '" value="' + forwardGears + '" min="1" max="12" step="1" style="width:100%; padding:4px; font-size:0.68rem; background:var(--bg-input); color:var(--text-primary); border:1px solid var(--border-color); border-radius:0; text-align:right;" onchange="onVEFTGBParamChange(\'' + node.id + '\')"></td>';
    html += '</tr>';
    
    // Geri Vites Sayısı
    html += '<tr style="border-bottom:1px solid var(--border-color);">';
    html += '<th style="padding:6px 8px; text-align:left; background:var(--bg-tertiary); border-right:1px solid var(--border-color); font-weight:500; color:var(--text-secondary);">Geri Vites Sayısı</th>';
    html += '<td style="padding:4px 6px; background:var(--bg-tertiary);"><input type="number" id="ve-gb-rev-' + node.id + '" value="' + reverseGears + '" min="0" max="4" step="1" style="width:100%; padding:4px; font-size:0.68rem; background:var(--bg-input); color:var(--text-primary); border:1px solid var(--border-color); border-radius:0; text-align:right;" onchange="onVEFTGBParamChange(\'' + node.id + '\')"></td>';
    html += '</tr>';
    
    // Governed Speed — motordan otomatik alınır
    var govReadonly = autoGoverned ? true : false;
    var govStyle = govReadonly
      ? 'width:100%; padding:4px; font-size:0.68rem; background:var(--bg-secondary); color:var(--text-secondary); border:1px solid var(--border-color); border-radius:0; text-align:right; cursor:default;'
      : 'width:100%; padding:4px; font-size:0.68rem; background:var(--bg-input); color:var(--text-primary); border:1px solid var(--border-color); border-radius:0; text-align:right;';
    var govValue = autoGoverned || displayGoverned;
    // Motor varsa, gbGovernedSpeed'i de senkronize et
    if(autoGoverned) { nodeData.gbGovernedSpeed = parseFloat(autoGoverned); }
    html += '<tr style="border-bottom:1px solid var(--border-color);">';
    html += '<th style="padding:6px 8px; text-align:left; background:var(--bg-tertiary); border-right:1px solid var(--border-color); font-weight:500; color:var(--text-secondary);">Governed Speed <span style="color:var(--text-muted); font-weight:400;">[rpm]</span></th>';
    html += '<td style="padding:4px 6px; background:var(--bg-tertiary);"><input type="number" id="ve-gb-governed-' + node.id + '" value="' + govValue + '"' + (govReadonly ? ' readonly tabindex="-1"' : '') + ' placeholder="' + (autoGoverned ? 'Motordan: ' + autoGoverned : 'Giriniz') + '" step="1" min="0" style="' + govStyle + '"' + (govReadonly ? '' : ' onchange="onVEFTGBParamChange(\'' + node.id + '\')"') + '></td>';
    html += '</tr>';
    
    if(autoGoverned) {
      html += '<tr><td colspan="2" style="padding:4px 8px; font-size:0.58rem; color:var(--text-muted); background:var(--bg-secondary);"><span style="color:var(--accent-success);">✓</span> Motor bileşeninden otomatik alındı: ' + autoGoverned + ' rpm</td></tr>';
    }
    
    html += '</table>';
    html += '</div></div>'; // close sw-pkg-body + sw-pkg-card Şanzıman Parametreleri
    
    // ── VİTES ORANLARI VE VERİMLER TABLOSU ──
    var ftGearData = nodeData.ftGearData || VE_FT_GB_DEFAULT_GEARS;
    var ftGearTableHeight = nodeData.ftGearTableHeight || 220;
    
    html += '<div class="sw-pkg-card" style="margin-top:10px;">';
    html += '<div class="sw-pkg-header" style="cursor:default;"><span class="sw-pkg-name">Vites Oranları ve Verimler</span></div>';
    html += '<div class="sw-pkg-body">';
    html += '<div class="sw-pkg-desc">Her vites için oranı, mekanik verimi ve lockup desteğini girin.</div>';
    
    html += '<div id="ve-ftgear-table-wrapper-' + node.id + '" style="max-height:' + ftGearTableHeight + 'px; overflow-y:auto; margin-bottom:0; border:1px solid var(--border-color); border-radius:0; border-bottom:none;">';
    html += '<table style="width:100%; border-collapse:collapse; font-size:0.68rem;">';
    html += '<thead style="position:sticky; top:0; background:var(--bg-tertiary); z-index:1;">';
    html += '<tr>';
    html += '<th style="padding:5px; border-bottom:1px solid var(--border-color); text-align:center; width:18%;">Vites</th>';
    html += '<th style="padding:5px; border-bottom:1px solid var(--border-color); text-align:center; width:24%;">Oran<br>(i_gear)</th>';
    html += '<th style="padding:5px; border-bottom:1px solid var(--border-color); text-align:center; width:24%;">Verim<br>(η) [%]</th>';
    html += '<th style="padding:5px; border-bottom:1px solid var(--border-color); text-align:center; width:14%;">Mod</th>';
    html += '<th style="padding:5px; border-bottom:1px solid var(--border-color); width:12%;"></th>';
    html += '</tr></thead>';
    html += '<tbody id="ve-ftgear-table-' + node.id + '">';
    
    ftGearData.forEach(function(row) {
      html += getVEFTGearRowHTML(node.id, row.name, row.ratio, row.eff, row.lockup);
    });
    
    html += '</tbody></table></div>';
    
    // Resize handle
    html += '<div style="height:8px; background:var(--bg-tertiary); border:1px solid var(--border-color); border-top:none; border-radius:0; cursor:ns-resize; display:flex; align-items:center; justify-content:center;" onmousedown="startVEFTGearTableResize(event, \'' + node.id + '\')">';
    html += '<div style="width:30px; height:3px; background:var(--border-color); border-radius:0;"></div>';
    html += '</div>';
    
    // Butonlar
    html += '<div class="sw-btn-row" style="margin:8px 0;">';
    html += '<button class="sw-btn sw-btn-outline" onclick="addVEFTGearRow(\'' + node.id + '\')">+ Satır Ekle</button>';
    html += '<button class="sw-btn sw-btn-danger" onclick="clearVEFTGearTable(\'' + node.id + '\')">Tümünü Sil</button>';
    html += '<button class="sw-btn sw-btn-primary" onclick="saveVEFTGearData(\'' + node.id + '\')">Kaydet</button>';
    html += '</div>';
    html += '</div></div>';
  } else {
    // ── MOTOR FRENİ: Mevcut parametreler ──
  var gearData = nodeData.gearData || [];
  var selectedGearbox = nodeData.selectedGearbox || '';
  var selectedGear = nodeData.selectedGear || '';
  var selectedGearRatio = nodeData.selectedGearRatio || '';
  var tableHeight = nodeData.tableHeight || 150;
  var hasData = gearData.length > 0;
  
  html += '<div class="sw-pkg-desc">Test sırasında kullanılan şanzımanın vites oranlarını giriniz veya hazır şanzıman seçiniz.</div>';
  
  // Şanzıman Seçici
  var _hasEGM2 = nodes.some(function(n) { return n.type === 'engine-gearbox-matching'; });
  html += '<div style="display:flex; gap:6px; margin-bottom:8px; align-items:center;">';
  html += '<select id="ve-gearbox-select-' + node.id + '"' + (_hasEGM2 ? ' disabled' : '') + ' onchange="onVEGearboxSelectChange(\'' + node.id + '\', this.value)" style="flex:1; font-size:0.7rem; padding:4px 6px; background:var(--bg-input); color:var(--text-primary); border:1px solid var(--border-color); border-radius:0;' + (_hasEGM2 ? ' opacity:0.6; cursor:not-allowed;' : '') + '">';
  html += '<option value="">-- Şanzıman Seçiniz (' + Object.keys(VE_GEARBOX_PRESETS).length + ' preset) --</option>';
  Object.keys(VE_GEARBOX_PRESETS).forEach(function(key) {
    var gp = VE_GEARBOX_PRESETS[key];
    var fwdCount = gp.gears.filter(function(g) { return g.gear !== 'R'; }).length;
    var calMark = (gp.calibrated ? ' ✦' : '') + (gp.downshiftCalibrated ? ' ✧' : '') + (gp.partialData ? ' ★' : '');
    var sel = (key === selectedGearbox) ? ' selected' : '';
    html += '<option value="' + key + '"' + sel + '>' + gp.name + ' (' + fwdCount + 'V)' + calMark + '</option>';
  });
  html += '<option value="__new__">➕ Manuel Giriş</option>';
  html += '</select>';
  html += '</div>';
  html += '<div style="font-size:0.55rem; color:var(--text-muted); margin:-4px 0 6px 2px; line-height:1.3;"><span style="color:var(--accent-warning);" title="Upshift kalibrasyon mevcut">✦</span> = Upshift kalibrasyon &nbsp; <span style="color:var(--accent-danger);" title="Downshift kalibrasyon mevcut">✧</span> = Downshift kalibrasyon &nbsp; <span style="color:#e53e3e;" title="Eksik veri — sadece vites oranları mevcut">★</span> = Eksik veri</div>';
  if(_hasEGM2) {
    html += '<div class="sw-chain-bar fail">🔒 Şanzıman seçimi Motor-Şanzıman Eşleştirme bileşeni üzerinden yapılmaktadır.</div>';
  }

  // Veri alanı
  html += '<div id="ve-gearbox-data-area-' + node.id + '" style="display:' + (hasData || selectedGearbox ? 'block' : 'none') + ';">';
  
  // Vites Tablosu
  html += '<div id="ve-gearbox-table-wrapper-' + node.id + '" style="max-height:' + tableHeight + 'px; overflow-y:auto; margin-bottom:0; border:1px solid var(--border-color); border-radius:0; border-bottom:none;">';
  html += '<table style="width:100%; border-collapse:collapse; font-size:0.7rem;">';
  html += '<thead style="position:sticky; top:0; background:var(--bg-tertiary); z-index:1;">';
  html += '<tr>';
  html += '<th style="padding:6px; text-align:center; border-bottom:1px solid var(--border-color); width:25%;">Vites</th>';
  html += '<th style="padding:6px; text-align:center; border-bottom:1px solid var(--border-color); width:35%;">Oran [-]</th>';
  html += '<th style="padding:6px; text-align:center; border-bottom:1px solid var(--border-color); width:30%;">Not</th>';
  html += '<th style="padding:6px; text-align:center; border-bottom:1px solid var(--border-color); width:10%;">Sil</th>';
  html += '</tr>';
  html += '</thead>';
  html += '<tbody id="ve-gearbox-table-' + node.id + '">';
  
  if(gearData.length > 0) {
    gearData.forEach(function(row, idx) {
      html += getVEGearboxRowHTML(node.id, row.gear || '', row.ratio !== undefined && row.ratio !== null ? row.ratio : '', row.note || '');
    });
  } else {
    html += getVEGearboxRowHTML(node.id, '', '', '');
  }
  
  html += '</tbody></table></div>';
  
  // Tablo altı butonlar
  html += '<div class="sw-btn-row" style="margin:8px 0;">';
  html += '<button class="sw-btn sw-btn-outline" onclick="addVEGearboxRow(\'' + node.id + '\')">+ Satır Ekle</button>';
  html += '<button class="sw-btn sw-btn-danger" onclick="clearVEGearboxTable(\'' + node.id + '\')">Tümünü Sil</button>';
  html += '<button class="sw-btn sw-btn-primary" onclick="saveVEGearboxValues(\'' + node.id + '\')">Kaydet</button>';
  html += '</div>';
  
  html += '</div>'; // ve-gearbox-data-area
  
  // ===== TEST BAŞLANGIÇ VİTESİ =====
  html += '<div class="sw-pkg-card" style="margin-top:12px;">';
  html += '<div class="sw-pkg-header" style="cursor:default;"><span class="sw-pkg-name">Test Başlangıç Vitesi</span> <button class="sw-info-btn" onclick="showInfoPopup(\'testVitesi\')" title="Bilgi">?</button></div>';
  html += '<div class="sw-pkg-body">';
  
  html += '<table style="width:100%; font-size:0.7rem; border-collapse:collapse; border:1px solid var(--border-color);">';
  html += '<tr style="border-bottom:1px solid var(--border-color);">';
  html += '<th style="padding:8px; text-align:left; background:var(--bg-tertiary); border-right:1px solid var(--border-color); width:50%; font-weight:500; color:var(--text-secondary);">Kaçıncı vites?</th>';
  html += '<td style="padding:8px; background:var(--bg-tertiary);">';
  html += '<select id="ve-gear-select-' + node.id + '" onchange="onVEGearSelectChange(\'' + node.id + '\')" style="width:100%; padding:5px; font-size:0.7rem; background:var(--bg-input); color:var(--text-primary); border:1px solid var(--border-color); border-radius:0;">';
  html += '<option value="">-- Vites Seçin --</option>';
  html += '</select>';
  html += '</td>';
  html += '</tr>';
  html += '<tr>';
  html += '<th style="padding:8px; text-align:left; background:var(--bg-tertiary); border-right:1px solid var(--border-color); font-weight:500; color:var(--text-secondary);">Seçili vites oranı</th>';
  html += '<td style="padding:8px; background:var(--bg-tertiary);"><input type="number" id="ve-gear-ratio-' + node.id + '" value="' + selectedGearRatio + '" readonly style="width:100%; padding:5px; font-size:0.7rem; background:var(--bg-secondary); color:var(--text-primary); border:1px solid var(--border-color); border-radius:0; text-align:right; cursor:not-allowed;"></td>';
  html += '</tr>';
  html += '</table>';
  
  html += '<div class="sw-pkg-desc">Önce yukarıdan şanzıman seçin, ardından test başlangıç vitesini belirleyin.</div>';

  html += '</div></div>';
  
  // ===== VERİM =====
  var gearboxEfficiency = nodeData.efficiency !== undefined ? nodeData.efficiency : 97;
  html += '<div class="sw-pkg-card" style="margin-top:12px;">';
  html += '<div class="sw-pkg-header" style="cursor:default;"><span class="sw-pkg-name">Verim</span></div>';
  html += '<div class="sw-pkg-body">';
  html += '<table style="width:100%; font-size:0.7rem; border-collapse:collapse; border:1px solid var(--border-color);">';
  html += '<tr style="border-bottom:1px solid var(--border-color);">';
  html += '<th style="padding:8px; text-align:left; background:var(--bg-tertiary); border-right:1px solid var(--border-color); width:55%; font-weight:500; color:var(--text-secondary);">Şanzıman verimi [%]</th>';
  html += '<td style="padding:8px; background:var(--bg-tertiary);"><input type="number" id="ve-gearbox-eff-' + node.id + '" value="' + gearboxEfficiency + '" step="0.5" min="80" max="100" style="width:100%; padding:5px; font-size:0.7rem; background:var(--bg-input); color:var(--text-primary); border:1px solid var(--border-color); border-radius:0; text-align:right;" onchange="onVEGearboxEffChange(\'' + node.id + '\')"></td>';
  html += '</tr>';
  html += '<tr><td colspan="2" style="padding:5px 8px; font-size:0.62rem; color:var(--text-muted); background:var(--bg-secondary);">Tipik değer: %95–98</td></tr>';
  html += '</table>';
  html += '</div></div>';

  } // end motor freni else

  html += '</div>';
  return html;
}

// ===== TAM GAZ VİTES VARSAYILAN VERİLERİ =====
var VE_FT_GB_DEFAULT_GEARS = [
  {name: 'F1', ratio: 3.487, eff: 98.11, lockup: false},
  {name: 'F2', ratio: 1.864, eff: 98.79, lockup: true},
  {name: 'F3', ratio: 1.409, eff: 99.00, lockup: true},
  {name: 'F4', ratio: 1.000, eff: 99.64, lockup: true},
  {name: 'F5', ratio: 0.750, eff: 98.62, lockup: true},
  {name: 'F6', ratio: 0.652, eff: 98.05, lockup: true},
  {name: 'R1', ratio: 5.026, eff: 97.50, lockup: false}
];

function getVEFTGearRowHTML(nodeId, name, ratio, eff, lockup) {
  var html = '<tr>';
  html += '<td style="padding:3px; border-bottom:1px solid var(--border-color);"><input type="text" value="' + (name || '') + '" style="width:100%; padding:4px; font-size:0.68rem; background:var(--bg-input); color:var(--text-primary); border:1px solid var(--border-color); border-radius:0; text-align:center;" onchange="onVEFTGearDataChange(\'' + nodeId + '\')"></td>';
  html += '<td style="padding:3px; border-bottom:1px solid var(--border-color);"><input type="number" value="' + (ratio !== undefined && ratio !== '' ? ratio : '') + '" step="0.001" min="0" style="width:100%; padding:4px; font-size:0.68rem; background:var(--bg-input); color:var(--text-primary); border:1px solid var(--border-color); border-radius:0; text-align:center;" onchange="onVEFTGearDataChange(\'' + nodeId + '\')"></td>';
  html += '<td style="padding:3px; border-bottom:1px solid var(--border-color);"><input type="number" value="' + (eff !== undefined && eff !== '' ? eff : '') + '" step="0.01" min="0" max="100" style="width:100%; padding:4px; font-size:0.68rem; background:var(--bg-input); color:var(--text-primary); border:1px solid var(--border-color); border-radius:0; text-align:center;" onchange="onVEFTGearDataChange(\'' + nodeId + '\')"></td>';
  // Lockup: shift profilinden otomatik belirlenir, kullanıcı değiştiremez
  var lockupLabel = lockup ? '<span style="color:var(--accent-success); font-weight:600;">L</span>' : '<span style="color:var(--text-muted);">C</span>';
  html += '<td style="padding:3px; border-bottom:1px solid var(--border-color); text-align:center; font-size:0.64rem;">' + lockupLabel + '<input type="hidden" value="' + (lockup ? 'true' : 'false') + '"></td>';
  html += '<td style="padding:3px; border-bottom:1px solid var(--border-color); text-align:center;"><button onclick="removeVEFTGearRow(this, \'' + nodeId + '\')" style="padding:2px 6px; font-size:0.6rem; background:var(--accent-danger); color:white; border:none; border-radius:0; cursor:pointer;" title="Sil">×</button></td>';
  html += '</tr>';
  return html;
}

function addVEFTGearRow(nodeId) {
  var tbody = document.getElementById('ve-ftgear-table-' + nodeId);
  if(!tbody) return;
  var tr = document.createElement('tr');
  tr.innerHTML = getVEFTGearRowHTML(nodeId, '', '', '', false).replace('<tr>', '').replace('</tr>', '');
  tbody.appendChild(tr);
}

function removeVEFTGearRow(btn, nodeId) {
  var tr = btn.closest('tr');
  if(tr) { tr.remove(); onVEFTGearDataChange(nodeId); }
}

function clearVEFTGearTable(nodeId) {
  var tbody = document.getElementById('ve-ftgear-table-' + nodeId);
  if(!tbody) return;
  tbody.innerHTML = '';
  for(var i = 0; i < 3; i++) addVEFTGearRow(nodeId);
  onVEFTGearDataChange(nodeId);
  showToast('Vites tablosu temizlendi');
}

function saveVEFTGearData(nodeId) {
  onVEFTGearDataChange(nodeId);
  var node = nodes.find(function(n) { return n.id === nodeId; });
  if(!node || !node.data || !node.data.ftGearData || node.data.ftGearData.length === 0) {
    showToast('Kaydedilecek veri yok', 'error'); return;
  }
  showToast('Vites verileri kaydedildi (' + node.data.ftGearData.length + ' vites)');
}

function onVEFTGearDataChange(nodeId) {
  var tbody = document.getElementById('ve-ftgear-table-' + nodeId);
  if(!tbody) return;
  var node = nodes.find(function(n) { return n.id === nodeId; });
  if(!node) return;
  if(!node.data) node.data = {};
  
  var ftGearData = [];
  var rows = tbody.querySelectorAll('tr');
  rows.forEach(function(tr) {
    var textInputs = tr.querySelectorAll('input[type="text"]');
    var numInputs = tr.querySelectorAll('input[type="number"]');
    var hiddenInput = tr.querySelector('input[type="hidden"]');
    if(textInputs.length >= 1 && numInputs.length >= 2) {
      var name = textInputs[0].value.trim();
      var ratio = parseFloat(numInputs[0].value);
      var eff = parseFloat(numInputs[1].value);
      var lockup = hiddenInput ? hiddenInput.value === 'true' : false;
      if(name || !isNaN(ratio)) {
        ftGearData.push({
          name: name,
          ratio: isNaN(ratio) ? null : ratio,
          eff: isNaN(eff) ? null : eff,
          lockup: lockup
        });
      }
    }
  });
  node.data.ftGearData = ftGearData;
}

// FT Gear tablo resize
var veFTGearResizing = null;
function startVEFTGearTableResize(e, nodeId) {
  e.preventDefault();
  veFTGearResizing = { nodeId: nodeId, startY: e.clientY, startHeight: document.getElementById('ve-ftgear-table-wrapper-' + nodeId).offsetHeight };
  document.addEventListener('mousemove', doVEFTGearResize);
  document.addEventListener('mouseup', stopVEFTGearResize);
}
function doVEFTGearResize(e) {
  if(!veFTGearResizing) return;
  var w = document.getElementById('ve-ftgear-table-wrapper-' + veFTGearResizing.nodeId);
  if(!w) return;
  var h = Math.max(80, Math.min(400, veFTGearResizing.startHeight + (e.clientY - veFTGearResizing.startY)));
  w.style.maxHeight = h + 'px';
  var nd = nodes.find(function(n) { return n.id === veFTGearResizing.nodeId; });
  if(nd) { if(!nd.data) nd.data = {}; nd.data.ftGearTableHeight = h; }
}
function stopVEFTGearResize() {
  veFTGearResizing = null;
  document.removeEventListener('mousemove', doVEFTGearResize);
  document.removeEventListener('mouseup', stopVEFTGearResize);
}

// ===== SHIFT PROFİLLERİ =====
// Lockup-mod geçişleri lineer formülle modellenir:
//   N_out_threshold = a × ESL + b
// Burada:
//   N_out = Şanzıman çıkış devri (lockup modda N_engine / i_gear)
//   ESL = Engine Speed Limit (governed RPM)
//   a = eğim (≈ 1 / i_gear), b = kalibrasyon ofseti
//   S4 için minCap: minimum N_out eşiği (formül altına düşmesini engeller)
var VE_FT_SHIFT_PROFILES = {
  allison3200sp_s1: {
    name: 'Allison 3200 SP — S1 Performance',
    family: '3000',
    lockupOffset: 75,    // Geriye uyumluluk (lockupShifts yoksa kullanılır)
    // Converter-mod geçiş oranları (N_out / N_shift_ref)
    // iSCAAN çapraz validasyondan türetildi (5 rapor, 3 motor, 2 TC)
    shift1C2C_outRatio: 0.2150,   // 1C→2C: N_out ≥ 0.2150 × N_shift_ref
    shift2C2L_outRatio: 0.3594,   // 2C→2L: N_out ≥ 0.3594 × N_shift_ref
    shiftRefRPM: null,    // null = motor governed kullan (varsayılan)
    // Lockup-mod geçişleri: N_out = a × ESL + b
    // S1: b ≈ -75 / i_gear → N_engine ≥ N_gov - 75 ile eşdeğer
    lockupShifts: {
      '2L3L': { a: 0.5361, b: -39.6 },   // 2L→3L, i_gear ≈ 1.8654, max hata ±0.4 rpm
      '3L4L': { a: 0.7100, b: -54.0 },   // 3L→4L, i_gear ≈ 1.4085, max hata ±0.0 rpm
      '4L5L': { a: 1.0000, b: -75.0 },   // 4L→5L, i_gear = 1.0000, max hata ±0.0 rpm
      '5L6L': { a: 1.3337, b: -100.1 }   // 5L→6L, i_gear ≈ 0.7498, max hata ±0.5 rpm
    },
    // Downshift eşikleri: N_out < threshold → alt vitese düş
    downshiftThresholds: {
      '6to5': { type: 'piecewise', breakpoint: 2000,
        low:  { a: 1.333, b: -298.8 },                                     // ESL ≤ 2000, max hata ±0.5 rpm
        high: { a: 1.1877, b: 0 }                                          // ESL ≥ 2100, max hata ±0.5 rpm
      },
      '5to4': { a: 0.8670, b: -0.2 },                                      // max hata ±0.5 rpm
      '4to3': { a: 0.6100, b: 0 },                                         // max hata ±0.0 rpm
      '3to2': { a: 0.4253, b: 1.1 },                                       // max hata ±1.4 rpm
      '2to1': { a: 0.3222, b: -27.6 }                                      // 2L→2C, max hata ±0.4 rpm
    },
    // Eski SR/η bazlı değerler (referans, artık kullanılmıyor)
    srShift1C2C: 0.78,
    srLockup2C2L: 0.85,
    etaLockup2C2L: 0.83
  },
  allison3200sp_s2: {
    name: 'Allison 3200 SP — S2 Performance',
    family: '3000',
    lockupOffset: 0,     // Geriye uyumluluk (b=0 → offset yok)
    shift1C2C_outRatio: 0.2150,   // 1C→2C: tüm kalibrasyonlarda aynı
    shift2C2L_outRatio: 0.3522,   // 2C→2L: N_out ≥ 0.3522 × N_shift_ref
    shiftRefRPM: null,
    // Lockup-mod geçişleri: N_out = a × ESL + b
    // S2: b = 0 → Geçiş tam N_gov'da, ofset yok
    lockupShifts: {
      '2L3L': { a: 0.4828, b: 0 },       // 2L→3L, i_gear ≈ 2.0712, max hata ±0.5 rpm
      '3L4L': { a: 0.6385, b: 0 },       // 3L→4L, i_gear ≈ 1.5663, max hata ±0.5 rpm
      '4L5L': { a: 0.9000, b: 0 },       // 4L→5L, i_gear ≈ 1.1111, max hata ±0.0 rpm
      '5L6L': { a: 1.2000, b: 0 }        // 5L→6L, i_gear ≈ 0.8333, max hata ±0.0 rpm
    },
    // Downshift eşikleri: N_out < threshold → alt vitese düş
    downshiftThresholds: {
      '6to5': { a: 1.2008, b: -200.9 },                                    // max hata ±0.5 rpm
      '5to4': { a: 0.9000, b: -100 },                                      // max hata ±0.0 rpm
      '4to3': { a: 0.6385, b: -70.6 },                                     // max hata ±0.5 rpm
      '3to2': { a: 0.4253, b: 1.1 },                                       // max hata ±1.4 rpm (S1 ile aynı)
      '2to1': { a: 0.3222, b: -27.6 }                                      // 2L→2C, max hata ±0.4 rpm
    },
    srShift1C2C: 0.78,
    srLockup2C2L: 0.85,
    etaLockup2C2L: 0.83
  },
  allison3200sp_s3: {
    name: 'Allison 3200 SP — S3 Economy',
    family: '3000',
    lockupOffset: -100,  // Geriye uyumluluk (pozitif b → erken geçiş)
    shift1C2C_outRatio: 0.2150,   // 1C→2C: tüm kalibrasyonlarda aynı
    shift2C2L_outRatio: 0.3468,   // 2C→2L: N_out ≥ 0.3468 × N_shift_ref
    shiftRefRPM: null,
    // Lockup-mod geçişleri: N_out = a × ESL + b
    // S3: b > 0 → Erken geçiş (ekonomik), düşük eğim (düşük efektif oran)
    // Not: 5L→6L nonlineer davranış gösterir (max hata 6.8 rpm)
    lockupShifts: {
      '2L3L': { a: 0.4258, b: 70.8 },    // 2L→3L, i_gear ≈ 2.3484, max hata ±0.4 rpm
      '3L4L': { a: 0.6000, b: 100.0 },   // 3L→4L, i_gear ≈ 1.6667, max hata ±0.0 rpm
      '4L5L': { a: 0.8000, b: 134.0 },   // 4L→5L, i_gear ≈ 1.2500, max hata ±0.0 rpm
      '5L6L': { a: 0.9256, b: 141.5 }    // 5L→6L, i_gear ≈ 1.0803, max hata ±6.8 rpm
    },
    // Downshift eşikleri: N_out < threshold → alt vitese düş
    downshiftThresholds: {
      '6to5': { a: 1.0000, b: -125 },                                      // max hata ±0.0 rpm
      '5to4': { a: 0.8011, b: -2 },                                        // max hata ±0.5 rpm
      '4to3': { a: 0.6000, b: 0 },                                         // max hata ±0.0 rpm
      '3to2': { a: 0.4253, b: 1.1 },                                       // max hata ±1.4 rpm (S1 ile aynı)
      '2to1': { a: 0.3222, b: -27.6 }                                      // 2L→2C, max hata ±0.4 rpm
    },
    srShift1C2C: 0.78,
    srLockup2C2L: 0.85,
    etaLockup2C2L: 0.83
  },
  allison3200sp_s4: {
    name: 'Allison 3200 SP — S4 Economy',
    family: '3000',
    lockupOffset: 50,    // Geriye uyumluluk (yaklaşık)
    shift1C2C_outRatio: 0.2150,   // 1C→2C: tüm kalibrasyonlarda aynı
    shift2C2L_outRatio: 0.3326,   // 2C→2L: N_out ≥ 0.3326 × N_shift_ref
    shiftRefRPM: null,
    // Lockup-mod geçişleri: N_out = a × ESL + b
    // S4: minCap tanımlı — formül düşük ESL'de minimum eşiğin altına düşmesini engeller
    // Not: 2L→3L nonlineer davranış gösterir (max hata 6.2 rpm)
    lockupShifts: {
      '2L3L': { a: 0.4088, b: 4.9, minCap: 724 },     // 2L→3L, i_gear ≈ 2.4460, max hata ±6.2 rpm
      '3L4L': { type: 'piecewise', breakpoint: 1700,
        low:  { a: 0.23, b: 632 },                     // ESL ≤ 1700, max hata ±0.0 rpm
        high: { a: 0.6, b: -50 }                       // ESL ≥ 1800, max hata ±0.0 rpm
      },
      '4L5L': { a: 0.8000, b: -66.0, minCap: 1360 },   // 4L→5L, i_gear ≈ 1.2500, max hata ±0.0 rpm
      '5L6L': { a: 1.0000, b: -45.0 }                   // 5L→6L, i_gear ≈ 1.0000, max hata ±0.0 rpm
    },
    // Downshift eşikleri: N_out < threshold → alt vitese düş
    downshiftThresholds: {
      '6to5': { a: 1.0000, b: -125 },                                      // max hata ±0.0 rpm
      '5to4': { a: 0.8000, b: -133, capValue: 1227, capBelow: 1800 },      // ESL<1800: cap 1227, max hata ±0.0 rpm
      '4to3': { a: 0.6000, b: -100, capValue: 920, capBelow: 1800 },       // ESL<1800: cap 920, max hata ±0.0 rpm
      '3to2': { a: 0.4000, b: -67, capValue: 653, capBelow: 1800 },        // ESL<1800: cap 653, max hata ±1.0 rpm
      '2to1': { a: 0.3255, b: -35.9, capValue: 488, capBelow: 1700 }       // 2L→2C, max hata ±3.0 rpm
    },
    srShift1C2C: 0.78,
    srLockup2C2L: 0.85,
    etaLockup2C2L: 0.83
  },
  allison3500sp_s1: {
    name: 'Allison 3500 SP — S1 Performance',
    family: '3000',
    lockupOffset: 75,    // Geriye uyumluluk
    shift1C2C_outRatio: 0.1635,   // Yaklaşık (converterShifts varsa o kullanılır)
    shift2C2L_outRatio: null,     // Lineer model — basit oran yok
    shiftRefRPM: null,
    // Converter-mod geçişleri: Lineer model
    // 1C→2C tüm kalibrasyonlarda aynı, 2C→2L kalibrasyon bazlı
    // Kaynak: 44 VEPS kalibrasyon raporu (CIN: CI-83000-91D-3)
    converterShifts: {
      '1C2C': { a: 0.1635, b: -0.3 },             // max hata ±0.4 rpm
      '2C2L': { a: 0.2915, b: 13.4 }               // max hata ±8.1 rpm
    },
    // Lockup-mod: N_engine = ESL - 75 (3200SP/4500SP S1 ile aynı kural)
    lockupShifts: {
      '2L3L': { a: 0.4439, b: -33.4 },   // i_gear ≈ 2.253, max hata ±0.4 rpm
      '3L4L': { a: 0.6514, b: -48.3 },   // i_gear ≈ 1.534, max hata ±0.5 rpm
      '4L5L': { a: 1.0000, b: -75.0 },   // i_gear = 1.000, max hata ±0.0 rpm
      '5L6L': { a: 1.3354, b: -99.9 }    // i_gear ≈ 0.749, max hata ±0.5 rpm
    },
    // Downshift eşikleri: N_out < threshold → alt vitese düş
    downshiftThresholds: {
      '6to5': { type: 'piecewise', breakpoint: 2000,
        low:  { a: 1.335, b: -299.8 },                                     // ESL ≤ 2000, max hata ±0.3 rpm
        high: { a: 1.19, b: 0 }                                            // ESL ≥ 2100, max hata ±0.3 rpm
      },
      '5to4': { a: 0.8687, b: -1.2 },                                      // max hata ±0.5 rpm
      '4to3': { a: 0.6514, b: -113.4 },                                    // max hata ±0.5 rpm
      '3to2': { type: 'piecewise', breakpoint: 1800,
        low:  { a: 0.445, b: -97.2 },                                      // ESL ≤ 1800, max hata ±0.5 rpm
        high: { a: 0.3914, b: -1.0 }                                       // ESL ≥ 1900, max hata ±0.5 rpm
      },
      '2to1': { a: 0.2662, b: -21.9 }                                      // 2L→2C, max hata ±0.5 rpm
    },
    srShift1C2C: 0.78,
    srLockup2C2L: 0.85,
    etaLockup2C2L: 0.83
  },
  allison3500sp_s2: {
    name: 'Allison 3500 SP — S2 Performance',
    family: '3000',
    lockupOffset: 0,     // Geriye uyumluluk (b ≈ 0)
    shift1C2C_outRatio: 0.1635,
    shift2C2L_outRatio: null,
    shiftRefRPM: null,
    converterShifts: {
      '1C2C': { a: 0.1635, b: -0.3 },
      '2C2L': { a: 0.2862, b: 12.1 }               // max hata ±8.0 rpm
    },
    // Lockup-mod: N_engine = 0.9 × ESL (3200SP/4500SP S2 ile aynı kural)
    // Düşük ESL'de nonlineer davranış — 2L3L: minCap, 3L4L: piecewise model
    lockupShifts: {
      '2L3L': { a: 0.4000, b: -1.0, minCap: 665 },   // i_gear ≈ 2.253, max hata ±0.0 rpm
      '3L4L': { type: 'piecewise', breakpoint: 1700,
        low:  { a: 0.26, b: 578 },                    // ESL ≤ 1700, max hata ±0.0 rpm
        high: { a: 0.5865, b: 0 }                     // ESL ≥ 1800, max hata ±0.4 rpm
      },
      '4L5L': { a: 0.9000, b: 0 },                    // i_gear ≈ 1.000, max hata ±0.0 rpm
      '5L6L': { a: 1.2022, b: -0.6 }                  // i_gear ≈ 0.749, max hata ±0.4 rpm
    },
    // Downshift eşikleri: N_out < threshold → alt vitese düş
    downshiftThresholds: {
      '6to5': { a: 1.2017, b: -199.9 },                                    // max hata ±0.4 rpm
      '5to4': { a: 0.9000, b: -100 },                                      // max hata ±0.0 rpm
      '4to3': { type: 'piecewise', breakpoint: 1700,
        low:  { a: 0.26, b: 513 },                                         // ESL ≤ 1700, max hata ±0.0 rpm
        high: { a: 0.5862, b: -64.3 }                                      // ESL ≥ 1800, max hata ±0.6 rpm
      },
      '3to2': { type: 'piecewise', breakpoint: 1700,
        low:  { a: 0.14, b: 379 },                                         // ESL ≤ 1700, max hata ±0.0 rpm
        high: { a: 0.4, b: -63 }                                           // ESL ≥ 1800, max hata ±0.0 rpm
      },
      '2to1': { a: 0.2662, b: -21.9 }                                      // 2L→2C, max hata ±0.5 rpm
    },
    srShift1C2C: 0.78,
    srLockup2C2L: 0.85,
    etaLockup2C2L: 0.83
  },
  allison3500sp_s3: {
    name: 'Allison 3500 SP — S3 Economy',
    family: '3000',
    lockupOffset: -100,  // Geriye uyumluluk (yaklaşık)
    shift1C2C_outRatio: 0.1635,
    shift2C2L_outRatio: null,
    shiftRefRPM: null,
    converterShifts: {
      '1C2C': { a: 0.1635, b: -0.3 },
      '2C2L': { a: 0.2800, b: 15.0 }
    },
    // Lockup-mod: Her viteste ayrı parametreler
    // Not: 2L→3L hafif nonlineer (6.1 rpm), 5L→6L yüksek ESL'de nonlineer (4.0 rpm)
    // Not: 3L→4L S1 ile birebir aynı (N_engine = ESL - 75)
    lockupShifts: {
      '2L3L': { a: 0.4015, b: 40.7 },    // i_gear ≈ 2.253, max hata ±6.1 rpm (nonlineer)
      '3L4L': { a: 0.6514, b: -48.3 },   // i_gear ≈ 1.534, max hata ±0.5 rpm (S1 ile aynı)
      '4L5L': { a: 0.8011, b: 134.0 },   // i_gear ≈ 1.000, max hata ±0.5 rpm
      '5L6L': { a: 0.9241, b: 148.4 }    // i_gear ≈ 0.749, max hata ±4.0 rpm (nonlineer)
    },
    // Downshift eşikleri: N_out < threshold → alt vitese düş
    downshiftThresholds: {
      '6to5': { a: 1.0000, b: -125 },                                      // max hata ±0.0 rpm
      '5to4': { a: 0.8013, b: 0 },                                         // max hata ±0.5 rpm
      '4to3': { a: 0.6514, b: -113.4 },                                    // max hata ±0.5 rpm (S1 ile aynı)
      '3to2': { type: 'piecewise', breakpoint: 1800,
        low:  { a: 0.445, b: -97.2 },                                      // ESL ≤ 1800, max hata ±0.5 rpm
        high: { a: 0.3914, b: -1.0 }                                       // ESL ≥ 1900, max hata ±0.5 rpm
      },
      '2to1': { a: 0.2662, b: -21.9 }                                      // 2L→2C, max hata ±0.5 rpm
    },
    srShift1C2C: 0.78,
    srLockup2C2L: 0.85,
    etaLockup2C2L: 0.83
  },
  allison3500sp_s4: {
    name: 'Allison 3500 SP — S4 Economy',
    family: '3000',
    lockupOffset: 50,    // Geriye uyumluluk (yaklaşık)
    shift1C2C_outRatio: 0.1635,
    shift2C2L_outRatio: null,
    shiftRefRPM: null,
    converterShifts: {
      '1C2C': { a: 0.1635, b: -0.3 },
      '2C2L': { a: 0.2691, b: 14.0 }               // max hata ±9.5 rpm
    },
    // Lockup-mod: minCap/piecewise destekli (düşük ESL koruması)
    lockupShifts: {
      '2L3L': { a: 0.3915, b: -33.6, minCap: 665 },    // i_gear ≈ 2.253, max hata ±0.5 rpm
      '3L4L': { type: 'piecewise', breakpoint: 1700,
        low:  { a: 0.26, b: 578 },                      // ESL ≤ 1700, max hata ±0.0 rpm
        high: { a: 0.6, b: -50 }                        // ESL ≥ 1800, max hata ±0.0 rpm
      },
      '4L5L': { a: 0.8007, b: -65.4, minCap: 1362 },   // i_gear ≈ 1.000, max hata ±0.6 rpm
      '5L6L': { a: 1.0000, b: -45.0 }                   // i_gear ≈ 0.749, max hata ±0.0 rpm
    },
    // Downshift eşikleri: N_out < threshold → alt vitese düş
    downshiftThresholds: {
      '6to5': { a: 1.0000, b: -125 },                                      // max hata ±0.0 rpm (S3 ile aynı)
      '5to4': { a: 0.8015, b: -134, capValue: 1229, capBelow: 1800 },      // ESL<1800: cap 1229, max hata ±0.5 rpm
      '4to3': { type: 'piecewise', breakpoint: 1700,
        low:  { a: -0.09, b: 1073 },                                       // ESL ≤ 1700, max hata ±0.0 rpm
        high: { a: 0.6, b: -100 }                                          // ESL ≥ 1800, max hata ±0.0 rpm
      },
      '3to2': { a: 0.39, b: -63, capValue: 600, capBelow: 1800 },          // ESL<1800: cap 600, max hata ±0.0 rpm
      '2to1': { type: 'piecewise', breakpoint: 1700,
        low:  { a: 0.14, b: 180 },                                         // ESL ≤ 1700, max hata ±0.0 rpm
        high: { a: 0.2757, b: -51.1 }                                      // ESL ≥ 1800, max hata ±0.6 rpm
      }
    },
    srShift1C2C: 0.78,
    srLockup2C2L: 0.85,
    etaLockup2C2L: 0.83
  },
  allison4000sp_s1: {
    name: 'Allison 4000 SP — S1 Performance',
    family: '4000',
    lockupOffset: 75,
    shift1C2C_outRatio: 0.2137,   // 1C→2C: N_out ≥ 0.2137 × N_shift_ref
    shift2C2L_outRatio: 0.3516,   // 2C→2L: N_out ≥ 0.3516 × N_shift_ref
    shiftRefRPM: null,    // null = motor governed kullan (varsayılan)
    srShift1C2C: 0.78,
    srLockup2C2L: 0.85,
    etaLockup2C2L: 0.83
  },
  allison4500sp_s1: {
    name: 'Allison 4500 SP — S1 Performance',
    family: '4000',
    lockupOffset: 75,    // Geriye uyumluluk
    shift1C2C_outRatio: 0.1592,   // Yaklaşık (converterShifts varsa o kullanılır)
    shift2C2L_outRatio: null,     // Segmentli model — basit oran yok
    shiftRefRPM: null,
    // Converter-mod geçişleri: Lineer + segmentli model
    // 3200SP'den farklı olarak basit oran yerine N_out = a × ESL + b kullanır
    converterShifts: {
      '1C2C': { a: 0.1592, b: 0.9 },              // N_out ≥ 0.1592 × ESL + 0.9, max hata ±0.5 rpm
      '2C2L': {
        type: 'segmented',
        linear: { a: 0.0800, b: 111.0, validFrom: 1800 }, // ESL ≥ 1800: max hata ±0.0 rpm
        lookup: [[1600, 230], [1700, 242]]                  // ESL < 1800: lookup tablosu
      }
    },
    // Lockup-mod geçişleri: N_out = a × ESL + b
    // S1: N_engine = ESL - 75 (3200SP S1 ile birebir aynı kural)
    lockupShifts: {
      '2L3L': { a: 0.4522, b: -34.6 },   // i_gear ≈ 2.2115, max hata ±0.4 rpm
      '3L4L': { a: 0.6540, b: -49.0 },   // i_gear ≈ 1.5291, max hata ±0.4 rpm
      '4L5L': { a: 1.0000, b: -75.0 },   // i_gear = 1.0000, max hata ±0.0 rpm
      '5L6L': { a: 1.3086, b: -98.7 }    // i_gear ≈ 0.7642, max hata ±0.5 rpm
    },
    // Downshift eşikleri: N_out < threshold → alt vitese düş
    downshiftThresholds: {
      '6to5': { type: 'piecewise', breakpoint: 1800,
        low:  { a: 1.31, b: -297 },                                        // ESL ≤ 1800, max hata ±0.4 rpm
        high: { a: 1.1544, b: -1 }                                         // ESL ≥ 1900, max hata ±0.4 rpm
      },
      '5to4': { a: 0.8500, b: 1 },                                         // max hata ±0.0 rpm
      '4to3': { a: 0.6542, b: -114.8 },                                    // max hata ±0.4 rpm
      '3to2': { a: 0.3931, b: -1.7 },                                      // max hata ±1.3 rpm
      '2to1': { a: 0.2711, b: -22.6 }                                      // 2L→2C, max hata ±0.5 rpm
    },
    srShift1C2C: 0.78,
    srLockup2C2L: 0.85,
    etaLockup2C2L: 0.83
  },
  allison4500sp_s2: {
    name: 'Allison 4500 SP — S2 Performance',
    family: '4000',
    lockupOffset: 0,     // Geriye uyumluluk (b ≈ 0)
    shift1C2C_outRatio: 0.1592,
    shift2C2L_outRatio: null,
    shiftRefRPM: null,
    converterShifts: {
      '1C2C': { a: 0.1592, b: 0.9 },
      '2C2L': {
        type: 'segmented',
        linear: { a: 0.0800, b: 111.0, validFrom: 1800 },
        lookup: [[1600, 230], [1700, 242]]
      }
    },
    // Lockup-mod: N_engine = 0.9 × ESL (3200SP S2 ile birebir aynı kural)
    // Düşük ESL'de nonlineer davranış — 2L3L: minCap, 3L4L: piecewise model
    lockupShifts: {
      '2L3L': { a: 0.4067, b: -0.2, minCap: 667 },   // i_gear ≈ 2.2115, max hata ±0.4 rpm
      '3L4L': { type: 'piecewise', breakpoint: 1700,
        low:  { a: 0.23, b: 629 },                    // ESL ≤ 1700, max hata ±0.0 rpm
        high: { a: 0.5888, b: -0.7 }                  // ESL ≥ 1800, max hata ±0.6 rpm
      },
      '4L5L': { a: 0.9000, b: 0 },                    // i_gear ≈ 1.0000, max hata ±0.0 rpm
      '5L6L': { a: 1.1776, b: -0.1 }                  // i_gear ≈ 0.7642, max hata ±0.4 rpm
    },
    // Downshift eşikleri: N_out < threshold → alt vitese düş
    downshiftThresholds: {
      '6to5': { a: 1.1774, b: -195.8 },                                    // max hata ±0.4 rpm
      '5to4': { a: 0.9000, b: -100 },                                      // max hata ±0.0 rpm
      '4to3': { type: 'piecewise', breakpoint: 1700,
        low:  { a: 0.23, b: 564 },                                         // ESL ≤ 1700, max hata ±0.0 rpm
        high: { a: 0.5883, b: -64.9 }                                      // ESL ≥ 1800, max hata ±0.5 rpm
      },
      '3to2': { type: 'piecewise', breakpoint: 1700,
        low:  { a: 0.24, b: 220 },                                         // ESL ≤ 1700, max hata ±0.0 rpm
        high: { a: 0.4065, b: -63 }                                        // ESL ≥ 1800, max hata ±0.4 rpm
      },
      '2to1': { a: 0.2711, b: -22.6 }                                      // 2L→2C, max hata ±0.5 rpm
    },
    srShift1C2C: 0.78,
    srLockup2C2L: 0.85,
    etaLockup2C2L: 0.83
  },
  allison4500sp_s3: {
    name: 'Allison 4500 SP — S3 Economy',
    family: '4000',
    lockupOffset: -100,  // Geriye uyumluluk (yaklaşık)
    shift1C2C_outRatio: 0.1592,
    shift2C2L_outRatio: null,
    shiftRefRPM: null,
    converterShifts: {
      '1C2C': { a: 0.1592, b: 0.9 },
      '2C2L': {
        type: 'segmented',
        linear: { a: 0.0800, b: 111.0, validFrom: 1800 },
        lookup: [[1600, 230], [1700, 242]]
      }
    },
    // Lockup-mod: Her viteste ayrı parametreler
    // Not: 2L→3L hafif nonlineerlik (2.8 rpm), 5L→6L önemli nonlineerlik (11.7 rpm)
    // Not: 3L→4L parametreleri S1 ile aynı
    lockupShifts: {
      '2L3L': { a: 0.3945, b: 60.6 },    // i_gear ≈ 2.2115, max hata ±2.8 rpm
      '3L4L': { a: 0.6540, b: -49.0 },   // i_gear ≈ 1.5291, max hata ±0.4 rpm (S1 ile aynı)
      '4L5L': { a: 0.7850, b: 130.8 },   // i_gear ≈ 1.0000, max hata ±0.3 rpm
      '5L6L': { a: 0.9843, b: -8.5 }     // i_gear ≈ 0.7642, max hata ±11.7 rpm (nonlineer)
    },
    // Downshift eşikleri: N_out < threshold → alt vitese düş
    downshiftThresholds: {
      '6to5': { a: 1.0000, b: -125 },                                      // max hata ±0.0 rpm
      '5to4': { a: 0.7850, b: 0.2 },                                       // max hata ±0.3 rpm
      '4to3': { a: 0.6542, b: -114.8 },                                    // max hata ±0.4 rpm (S1 ile aynı)
      '3to2': { a: 0.3931, b: -1.7 },                                      // max hata ±1.3 rpm
      '2to1': { a: 0.2711, b: -22.6 }                                      // 2L→2C, max hata ±0.5 rpm
    },
    srShift1C2C: 0.78,
    srLockup2C2L: 0.85,
    etaLockup2C2L: 0.83
  },
  allison4500sp_s4: {
    name: 'Allison 4500 SP — S4 Economy',
    family: '4000',
    lockupOffset: 50,    // Geriye uyumluluk (yaklaşık)
    shift1C2C_outRatio: 0.1592,
    shift2C2L_outRatio: null,
    shiftRefRPM: null,
    converterShifts: {
      '1C2C': { a: 0.1592, b: 0.9 },
      '2C2L': {
        type: 'segmented',
        linear: { a: 0.0800, b: 111.0, validFrom: 1800 },
        lookup: [[1600, 230], [1700, 242]]
      }
    },
    // Lockup-mod: minCap/piecewise destekli (düşük ESL koruması)
    lockupShifts: {
      '2L3L': { a: 0.3923, b: -32.5, minCap: 667 },    // i_gear ≈ 2.2115, max hata ±0.5 rpm
      '3L4L': { type: 'piecewise', breakpoint: 1700,
        low:  { a: 0.23, b: 629 },                      // ESL ≤ 1700, max hata ±0.0 rpm
        high: { a: 0.6, b: -50 }                        // ESL ≥ 1800, max hata ±0.0 rpm
      },
      '4L5L': { a: 0.7850, b: -65.2, minCap: 1335 },   // i_gear ≈ 1.0000, max hata ±0.3 rpm
      '5L6L': { a: 1.0000, b: -45.0 }                   // i_gear ≈ 0.7642, max hata ±0.0 rpm
    },
    // Downshift eşikleri: N_out < threshold → alt vitese düş
    downshiftThresholds: {
      '6to5': { a: 1.0000, b: -125 },                                      // max hata ±0.0 rpm (S3 ile aynı)
      '5to4': { a: 0.7850, b: -130.8, capValue: 1204, capBelow: 1800 },    // ESL<1800: cap 1204, max hata ±0.3 rpm
      '4to3': { type: 'piecewise', breakpoint: 1700,
        low:  { a: -0.12, b: 1124 },                                       // ESL ≤ 1700, max hata ±0.0 rpm
        high: { a: 0.6, b: -100 }                                          // ESL ≥ 1800, max hata ±0.0 rpm
      },
      '3to2': { a: 0.3927, b: -66, capValue: 602, capBelow: 1800 },        // ESL<1800: cap 602, max hata ±0.5 rpm
      '2to1': { type: 'piecewise', breakpoint: 1700,
        low:  { a: 0.15, b: 171 },                                         // ESL ≤ 1700, max hata ±0.0 rpm
        high: { a: 0.28, b: -50 }                                          // ESL ≥ 1800, max hata ±0.0 rpm
      }
    },
    srShift1C2C: 0.78,
    srLockup2C2L: 0.85,
    etaLockup2C2L: 0.83
  },
  // ════════════════════════════════════════════════════════════════════════
  // ALLISON 4700SP — 4000 SERİSİ (7 ileri vites, Creeper dahil)
  // ════════════════════════════════════════════════════════════════════════
  // Kaynak: VEPS kalibrasyon verileri (ESL 1600-2600 rpm, S1-S4)
  // Vites oranları: C=7.630, 1st=3.510, 2nd=1.906, 3rd=1.429, 4th=1.000, 5th=0.737, 6th=0.639
  // Not: Shift tablosundaki vitesler 1-6 (C vitesi shift profili dışında)
  allison4700sp_s1: {
    name: 'Allison 4700 SP — S1 Performance',
    family: '4000',
    lockupOffset: 75,
    shift1C2C_outRatio: 0.2137,
    shift2C2L_outRatio: null,
    shiftRefRPM: null,
    converterShifts: {
      '1C2C': { a: 0.2137, b: -0.1 },               // max hata ±0.5 rpm
      '2C2L': { a: 0.3451, b: 14.8 }                 // max hata ±10.1 rpm (nonlineer)
    },
    // Lockup-mod: N_engine = ESL - 75 kuralı
    // Not: 3L→4L düşük ESL'de nonlineer — piecewise model
    lockupShifts: {
      '2L3L': { a: 0.5250, b: -40.2 },                // max hata ±0.3 rpm
      '3L4L': { type: 'piecewise', breakpoint: 1700,
        low:  { a: 0.5, b: 287 },                     // ESL ≤ 1700, max hata ±0.0 rpm
        high: { a: 0.7, b: -53 }                      // ESL ≥ 1800, max hata ±0.0 rpm
      },
      '4L5L': { a: 1.0000, b: -75.0 },                // max hata ±0.0 rpm
      '5L6L': { a: 1.3567, b: -101.8 }                // max hata ±0.4 rpm
    },
    // Downshift eşikleri: N_out < threshold → alt vitese düş
    downshiftThresholds: {
      '6to5': { type: 'piecewise', breakpoint: 2100,
        low:  { a: 1.3574, b: -306.7 },                                    // ESL ≤ 2100, max hata ±0.4 rpm
        high: { a: 1.212, b: 2 }                                           // ESL ≥ 2200, max hata ±0.4 rpm
      },
      '5to4': { a: 0.8821, b: -0.6 },                                      // max hata ±0.4 rpm
      '4to3': { a: 0.6100, b: 0 },                                         // max hata ±0.0 rpm
      '3to2': { a: 0.4200, b: 0 },                                         // max hata ±0.0 rpm
      '2to1': { a: 0.3150, b: -26.8 }                                      // 2L→2C, max hata ±0.3 rpm
    },
    srShift1C2C: 0.78,
    srLockup2C2L: 0.85,
    etaLockup2C2L: 0.83
  },
  allison4700sp_s2: {
    name: 'Allison 4700 SP — S2 Performance',
    family: '4000',
    lockupOffset: 0,
    shift1C2C_outRatio: 0.2137,
    shift2C2L_outRatio: null,
    shiftRefRPM: null,
    converterShifts: {
      '1C2C': { a: 0.2137, b: -0.1 },
      '2C2L': { a: 0.3383, b: 14.3 }                 // max hata ±9.5 rpm (nonlineer)
    },
    // Lockup-mod: Düşük ESL'de nonlineer — 3L4L piecewise
    lockupShifts: {
      '2L3L': { a: 0.4723, b: -0.3 },                 // max hata ±0.5 rpm
      '3L4L': { type: 'piecewise', breakpoint: 1700,
        low:  { a: 0.51, b: 204 },                    // ESL ≤ 1700, max hata ±0.0 rpm
        high: { a: 0.63, b: 0 }                       // ESL ≥ 1800, max hata ±0.0 rpm
      },
      '4L5L': { a: 0.9000, b: 0 },                    // max hata ±0.0 rpm
      '5L6L': { a: 1.2201, b: 2.2 }                   // max hata ±1.7 rpm
    },
    // Downshift eşikleri: N_out < threshold → alt vitese düş
    downshiftThresholds: {
      '6to5': { a: 1.2213, b: -204 },                                      // max hata ±0.5 rpm
      '5to4': { a: 0.9000, b: -100 },                                      // max hata ±0.0 rpm
      '4to3': { type: 'piecewise', breakpoint: 1700,
        low:  { a: 0.51, b: 134 },                                         // ESL ≤ 1700, max hata ±0.0 rpm
        high: { a: 0.63, b: -70 }                                          // ESL ≥ 1800, max hata ±0.0 rpm
      },
      '3to2': { a: 0.4200, b: 0 },                                         // max hata ±0.0 rpm
      '2to1': { a: 0.3150, b: -26.8 }                                      // 2L→2C, max hata ±0.3 rpm
    },
    srShift1C2C: 0.78,
    srLockup2C2L: 0.85,
    etaLockup2C2L: 0.83
  },
  allison4700sp_s3: {
    name: 'Allison 4700 SP — S3 Economy',
    family: '4000',
    lockupOffset: -100,
    shift1C2C_outRatio: 0.2137,
    shift2C2L_outRatio: null,
    shiftRefRPM: null,
    converterShifts: {
      '1C2C': { a: 0.2137, b: -0.1 },
      '2C2L': { a: 0.3311, b: 17 }                   // max hata ±0.5 rpm
    },
    lockupShifts: {
      '2L3L': { a: 0.4200, b: 70 },                   // max hata ±0.0 rpm
      '3L4L': { a: 0.6000, b: 100 },                  // max hata ±0.0 rpm
      '4L5L': { a: 0.8142, b: 135.2 },                // max hata ±0.4 rpm
      '5L6L': { a: 0.9387, b: 157 }                   // max hata ±0.5 rpm
    },
    // Downshift eşikleri: N_out < threshold → alt vitese düş
    downshiftThresholds: {
      '6to5': { type: 'piecewise', breakpoint: 2000,
        low:  { a: 0.94, b: -2 },                                          // ESL ≤ 2000, max hata ±0.0 rpm
        high: { a: 1.0, b: -125 }                                          // ESL ≥ 2100, max hata ±0.0 rpm
      },
      '5to4': { a: 0.8140, b: 0 },                                         // max hata ±0.4 rpm
      '4to3': { a: 0.6000, b: 0 },                                         // max hata ±0.0 rpm
      '3to2': { a: 0.4200, b: 0 },                                         // max hata ±0.0 rpm
      '2to1': { a: 0.3150, b: -26.8 }                                      // 2L→2C, max hata ±0.3 rpm
    },
    srShift1C2C: 0.78,
    srLockup2C2L: 0.85,
    etaLockup2C2L: 0.83
  },
  allison4700sp_s4: {
    name: 'Allison 4700 SP — S4 Economy',
    family: '4000',
    lockupOffset: 50,
    shift1C2C_outRatio: 0.2137,
    shift2C2L_outRatio: null,
    shiftRefRPM: null,
    converterShifts: {
      '1C2C': { a: 0.2137, b: -0.1 },
      '2C2L': { a: 0.319, b: 14.5 }                  // max hata ±10.1 rpm (nonlineer)
    },
    // Lockup-mod: minCap/cap destekli (düşük ESL koruması)
    lockupShifts: {
      '2L3L': { a: 0.4095, b: -10, minCap: 714 },    // max hata ±0.5 rpm
      '3L4L': { a: 0.6000, b: -50, capValue: 1020, capBelow: 1800 },  // max hata ±0.0 rpm
      '4L5L': { a: 0.8143, b: -68.5, minCap: 1384 }, // max hata ±0.5 rpm
      '5L6L': { a: 1.0000, b: -45.0 }                 // max hata ±0.0 rpm
    },
    // Downshift eşikleri: N_out < threshold → alt vitese düş
    downshiftThresholds: {
      '6to5': { a: 1.0000, b: -125 },                                      // max hata ±0.0 rpm
      '5to4': { a: 0.8138, b: -135.2, capValue: 1248, capBelow: 1800 },    // ESL<1800: cap 1248, max hata ±0.5 rpm
      '4to3': { a: 0.6000, b: -100, capValue: 920, capBelow: 1800 },       // ESL<1800: cap 920, max hata ±0.0 rpm
      '3to2': { a: 0.4200, b: -70, capValue: 644, capBelow: 1800 },        // ESL<1800: cap 644, max hata ±1.0 rpm
      '2to1': { type: 'piecewise', breakpoint: 1700,
        low:  { a: 0.26, b: 61 },                                          // ESL ≤ 1700, max hata ±0.0 rpm
        high: { a: 0.3217, b: -43 }                                        // ESL ≥ 1800, max hata ±1.4 rpm
      }
    },
    srShift1C2C: 0.78,
    srLockup2C2L: 0.85,
    etaLockup2C2L: 0.83
  },
  // ════════════════════════════════════════════════════════════════════════
  // ALLISON 1000SP — 1000/2000 SERİSİ (S1 Performance)
  // ════════════════════════════════════════════════════════════════════════
  // Kaynak: iSCAAN raporu 497-A367123-1 (1000SP + ISB4.5 + TC222)
  // Vites oranları: F1=3.102, F2=1.811, F3=1.406, F4=1.000, F5=0.712, F6=0.614
  // Evrensel S1: N_out = (ESL − 75) / i_gear, 5 aile × 44 VEPS ile ±1 rpm içinde doğrulandı
  // Effective ESL=2605 rpm (ters-mühendislikle teyit — "2500 rpm Limiting" ≠ gerçek ESL)
  // Converter shift'ler evrensel formül × i_F1 / i_F2 ile hesaplandı (TC-spesifik ufak sapma normal)
  allison1000sp_s1: {
    name: 'Allison 1000 SP — S1 Performance',
    family: '1000_2000',
    lockupOffset: 75,
    shift1C2C_outRatio: 0.2418,      // = 0.75 / 3.102 (evrensel SR=0.75 × i_F1)
    shift2C2L_outRatio: null,         // piecewise lineer — converterShifts üzerinden
    shiftRefRPM: null,
    // Converter-mod geçişleri: Evrensel formülün lineer karşılığı
    // 1C→2C: N_out = 0.2418 × ESL  (TC222'de gerçek SR=0.77, evrensel 0.75 yaklaşımı → ±5-10 rpm)
    // 2C→2L: Evrensel N_eng kuralı i_F2=1.811 ile N_out'a çevrildi — segmented model
    converterShifts: {
      '1C2C': { a: 0.2418, b: 0 },
      '2C2L': {
        type: 'segmented',
        linear: { a: 0.3699, b: 0.22, validFrom: 1800 },  // ESL ≥ 1800: (0.6698×ESL+0.4)/1.811
        lookup: [[1600, 607], [1700, 628]]                 // ESL < 1800: (0.39×ESL+476)/1.811
      }
    },
    // Lockup-mod: Evrensel S1 kuralı — N_out = (ESL − 75) / i_gear
    lockupShifts: {
      '2L3L': { a: 0.5522, b: -41.4 },   // = 1/1.811, -75/1.811
      '3L4L': { a: 0.7112, b: -53.3 },   // = 1/1.406, -75/1.406
      '4L5L': { a: 1.0000, b: -75.0 },   // = 1/1.000, -75/1.000
      '5L6L': { a: 1.4045, b: -105.3 }   // = 1/0.712, -75/0.712
    },
    // Downshift eşikleri: 2500SP S1'den 1000SP dişli oranlarına adapte edildi
    // Kapalı gaz gözlemi: N_eng ≈ 1100 rpm (2L→2C için ≈1050) — Adım 5'te ölçümle karşılaştırılacak
    downshiftThresholds: {
      '3to2': { a: 0.4269, b: 0 },                                          // 2500SP × 1.439/1.406
      '4to3': { a: 0.6100, b: 0 },                                          // i_F4=1.000 (değişiklik yok)
      '5to4': { a: 0.9136, b: 0 },                                          // 2500SP × 0.737/0.712
      '6to5': { type: 'piecewise', breakpoint: 2000,
        low:  { a: 1.4190, b: -315.0 },                                     // 2500SP × 0.643/0.614
        high: { a: 1.2606, b: 1.47 }
      },
      '2to1': { a: 0.1117, b: 157.9, capValue: 327, capBelow: 1700 }        // 2500SP × 1.896/1.811
    },
    srShift1C2C: 0.77,        // TC222'ye has, referans
    srLockup2C2L: 0.87,       // gözlenen, referans
    etaLockup2C2L: 0.83       // diğer profillerle tutarlı
  },
  // ════════════════════════════════════════════════════════════════════════
  // ALLISON 2500SP — 1000/2000 SERİSİ
  // ════════════════════════════════════════════════════════════════════════
  // Kaynak: 44 adet VEPS kalibrasyon raporu (CIN: B1-81000-43C-9, ESL 1600-2600 rpm, S1-S4)
  // Vites oranları (KaATCC): 1st=3.512, 2nd=1.896, 3rd=1.439, 4th=1.000, 5th=0.737, 6th=0.643
  // 1→2 tüm kalibrasyonlarda aynı: N_out = 0.2133 × ESL (konvertör modu, max hata ±0.4 rpm)
  allison2500sp_s1: {
    name: 'Allison 2500 SP — S1 Performance',
    family: '1000_2000',
    lockupOffset: 75,
    shift1C2C_outRatio: 0.2133,   // Tüm kalibrasyonlarda aynı (konvertör modu)
    shift2C2L_outRatio: 0.3594,
    shiftRefRPM: null,
    // Upshift: Lockup-mod — N_engine = ESL - 75 kuralı
    lockupShifts: {
      '2L3L': { a: 0.5275, b: -39.7 },   // max hata ±0.5 rpm
      '3L4L': { a: 0.6950, b: -52.2 },   // max hata ±0.3 rpm
      '4L5L': { a: 1.0000, b: -75.0 },   // max hata ±0.0 rpm
      '5L6L': { a: 1.3577, b: -101.8 }   // max hata ±0.5 rpm
    },
    // Downshift eşikleri: N_out < threshold → alt vitese düş
    downshiftThresholds: {
      '3to2': { a: 0.4171, b: 0 },    // max hata ±0.4 rpm
      '4to3': { a: 0.6100, b: 0 },    // max hata ±0.0 rpm
      '5to4': { a: 0.8826, b: 0 },    // max hata ±0.5 rpm
      '6to5': { type: 'piecewise', breakpoint: 2000,
        low:  { a: 1.3550, b: -300.8 },   // ESL ≤ 2000, max hata ±0.3 rpm
        high: { a: 1.2037, b: 1.4 }       // ESL ≥ 2100, max hata ±0.5 rpm
      },
      '2to1': { a: 0.1067, b: 150.8, capValue: 312, capBelow: 1700 }  // max hata ±0.5 rpm
    },
    srShift1C2C: 0.78,
    srLockup2C2L: 0.85,
    etaLockup2C2L: 0.83
  },
  // S2 Performance — N_engine = 0.90 × ESL kuralı (oransal, offset yok)
  // Histerezis: 4→5/5→4 = 100 rpm, 5→6/6→5 ≈ 203 rpm, 3→4/4→3 ≈ 69 rpm
  allison2500sp_s2: {
    name: 'Allison 2500 SP — S2 Performance',
    family: '1000_2000',
    lockupOffset: 0,
    shift1C2C_outRatio: 0.2133,
    shift2C2L_outRatio: 0.3594,
    shiftRefRPM: null,
    // Upshift: Lockup-mod — N_engine ≈ 0.90 × ESL
    lockupShifts: {
      '2L3L': { a: 0.4750, b: 0 },                                     // max hata ±1.0 rpm
      '3L4L': { a: 0.6257, b: -0.4, capValue: 1020, capBelow: 1700 },  // ESL=1600: cap 1020, max hata ±0.5 rpm
      '4L5L': { a: 0.9000, b: 0 },                                     // max hata ±0.0 rpm
      '5L6L': { a: 1.2221, b: 0 }                                      // max hata ±1.0 rpm
    },
    // Downshift eşikleri: S2 Performance
    downshiftThresholds: {
      '3to2': { a: 0.4171, b: 0 },                                     // S1 ile aynı, max hata ±0.4 rpm
      '4to3': { a: 0.6256, b: -69.6, capValue: 950, capBelow: 1700 },  // max hata ±0.5 rpm
      '5to4': { a: 0.9000, b: -100 },                                  // max hata ±0.0 rpm
      '6to5': { a: 1.2218, b: -203.2 },                                // max hata ±0.5 rpm (S2'de parçalı yok: tekil lineer)
      '2to1': { a: 0.1067, b: 150.8, capValue: 312, capBelow: 1700 }   // S1 ile aynı, max hata ±0.5 rpm
    },
    srShift1C2C: 0.78,
    srLockup2C2L: 0.85,
    etaLockup2C2L: 0.83
  },
  // S3 Economy — Her shift kendi formülüne sahip (tek bir kural yok)
  // Histerezis: 3→4/4→3 ≈ 99 rpm, 4→5/5→4 ≈ 136 rpm, 5→6/6→5 ≈ 136 rpm
  allison2500sp_s3: {
    name: 'Allison 2500 SP — S3 Economy',
    family: '1000_2000',
    lockupOffset: 0,
    shift1C2C_outRatio: 0.2133,
    shift2C2L_outRatio: 0.3594,
    shiftRefRPM: null,
    // Upshift: Lockup-mod — per-gear bağımsız formüller
    lockupShifts: {
      '2L3L': { a: 0.4171, b: 69.4 },    // max hata ±0.4 rpm
      '3L4L': { a: 0.6000, b: 100 },     // max hata ±0.0 rpm
      '4L5L': { a: 0.8146, b: 135.9 },   // max hata ±0.5 rpm
      '5L6L': { a: 0.9326, b: 154.8 }    // max hata ±1.0 rpm
    },
    // Downshift eşikleri: S3 Economy
    downshiftThresholds: {
      '3to2': { a: 0.4171, b: 0 },                                     // S1 ile aynı, max hata ±0.4 rpm
      '4to3': { a: 0.6000, b: 0, capValue: 976, capBelow: 1700 },      // ESL=1600: cap 976, max hata ±0.0 rpm
      '5to4': { a: 0.8150, b: 0 },                                     // max hata ±0.3 rpm
      '6to5': { type: 'piecewise', breakpoint: 2000,
        low:  { a: 0.9560, b: -39.8 },   // ESL ≤ 2000, max hata ±3.0 rpm
        high: { a: 1.0000, b: -125 }     // ESL ≥ 2100, max hata ±0.0 rpm
      },
      '2to1': { a: 0.1067, b: 150.8, capValue: 312, capBelow: 1700 }   // S1 ile aynı, max hata ±0.5 rpm
    },
    srShift1C2C: 0.78,
    srLockup2C2L: 0.85,
    etaLockup2C2L: 0.83
  },
  // S4 Economy — Düşük ESL'lerde cap paternli, en konservatif kalibrasyon
  // Histerezis: 3→4/4→3 ≈ 55 rpm, 4→5/5→4 ≈ 80 rpm, 5→6/6→5 ≈ 80 rpm
  allison2500sp_s4: {
    name: 'Allison 2500 SP — S4 Economy',
    family: '1000_2000',
    lockupOffset: 0,
    shift1C2C_outRatio: 0.2133,
    shift2C2L_outRatio: 0.3594,
    shiftRefRPM: null,
    // Upshift: Lockup-mod — düşük ESL'lerde cap paternli
    lockupShifts: {
      '2L3L': { type: 'segments', segments: [
        { maxESL: 1700, cap: 709 },                   // ESL ≤ 1700: cap
        { maxESL: 2100, a: 0.3540, b: 98.7 },         // 1800 ≤ ESL ≤ 2100, max hata ±0.3 rpm
        {              a: 0.4160, b: -32.4 }           // ESL ≥ 2200, max hata ±0.4 rpm
      ]},
      '3L4L': { a: 0.6000, b: -50, capValue: 1020, capBelow: 1800 },   // ESL ≤ 1700: cap, max hata ±0.0 rpm
      '4L5L': { a: 0.8143, b: -67.2, capValue: 1385, capBelow: 1800 }, // ESL ≤ 1700: cap, max hata ±0.0 rpm
      '5L6L': { a: 1.0000, b: -45 }                                    // max hata ±0.0 rpm
    },
    // Downshift eşikleri: S4 Economy
    downshiftThresholds: {
      '3to2': { type: 'segments', segments: [
        { maxESL: 1700, cap: 639 },                   // ESL ≤ 1700: cap
        { maxESL: 2100, a: 0.3530, b: 26.9 },         // 1800 ≤ ESL ≤ 2100, max hata ±0.4 rpm
        {              a: 0.4170, b: -69.4 }           // ESL ≥ 2200, max hata ±0.4 rpm
      ]},
      '4to3': { a: 0.6000, b: -100, capValue: 920, capBelow: 1800 },   // ESL ≤ 1700: cap, max hata ±0.0 rpm
      '5to4': { a: 0.8140, b: -134.4, capValue: 1249, capBelow: 1800 },// ESL ≤ 1700: cap, max hata ±0.4 rpm
      '6to5': { a: 1.0000, b: -125 },                                  // max hata ±0.0 rpm
      '2to1': { a: 0.1067, b: 150.8, capValue: 312, capBelow: 1700 }   // S1 ile aynı, max hata ±0.5 rpm
    },
    srShift1C2C: 0.78,
    srLockup2C2L: 0.85,
    etaLockup2C2L: 0.83
  }
};

// Profil adından şanzıman kodunu (preset key) çıkarır.
// Örn: "Allison 3200 SP — S1 Performance" → "3200SP"
function veGetGearboxKeyFromShiftProfile(spKey) {
  var sp = VE_FT_SHIFT_PROFILES[spKey];
  if(!sp || !sp.name) return '';
  var m = sp.name.match(/Allison\s+(\d+)\s*SP/i);
  return m ? (m[1] + 'SP') : '';
}

// Tam Gaz — Şanzıman parametre değişikliği
function onVEFTGBParamChange(nodeId) {
  var node = nodes.find(function(n) { return n.id === nodeId; });
  if(!node) return;
  if(!node.data) node.data = {};
  
  var nameEl = document.getElementById('ve-gb-name-' + nodeId);
  var shiftEl = document.getElementById('ve-gb-shift-' + nodeId);
  var fwdEl = document.getElementById('ve-gb-fwd-' + nodeId);
  var revEl = document.getElementById('ve-gb-rev-' + nodeId);
  var govEl = document.getElementById('ve-gb-governed-' + nodeId);
  
  if(nameEl) node.data.gbName = nameEl.value;
  if(shiftEl) {
    node.data.shiftProfile = shiftEl.value;
    // Readonly alanları güncelle
    var spData = VE_FT_SHIFT_PROFILES[shiftEl.value];
    if(spData) {
      var offEl = document.getElementById('ve-gb-lockup-offset-' + nodeId);
      var srShEl = document.getElementById('ve-gb-sr-shift-' + nodeId);
      var srLkEl = document.getElementById('ve-gb-sr-lockup-' + nodeId);
      if(offEl) offEl.value = spData.lockupOffset;
      if(srShEl) srShEl.value = spData.shift1C2C_outRatio || 0.2150;
      if(srLkEl) srLkEl.value = spData.shift2C2L_outRatio || 0.3593;
      node.data.lockupOffset = spData.lockupOffset;
      node.data.shift1C2C_outRatio = spData.shift1C2C_outRatio || 0.2150;
      node.data.shift2C2L_outRatio = spData.shift2C2L_outRatio || 0.3594;
      // Lockup-mod per-gear kalibrasyon verilerini kopyala
      if(spData.lockupShifts) {
        node.data.lockupShifts = JSON.parse(JSON.stringify(spData.lockupShifts));
      } else {
        delete node.data.lockupShifts;
      }
      // Converter-mod lineer/segmentli model verilerini kopyala
      if(spData.converterShifts) {
        node.data.converterShifts = JSON.parse(JSON.stringify(spData.converterShifts));
      } else {
        delete node.data.converterShifts;
      }
      // Downshift eşiklerini kopyala
      if(spData.downshiftThresholds) {
        node.data.downshiftThresholds = JSON.parse(JSON.stringify(spData.downshiftThresholds));
      } else {
        delete node.data.downshiftThresholds;
      }
      // Eski parametreleri de koru (geriye uyumluluk)
      node.data.srShift1C2C = spData.srShift1C2C;
      node.data.srLockup2C2L = spData.srLockup2C2L;
      node.data.etaLockup2C2L = spData.etaLockup2C2L || 0.83;
    }
  }
  // Shift Referans RPM (boş = motor governed kullanılır)
  var shiftRefEl = document.getElementById('ve-gb-shift-ref-' + nodeId);
  if(shiftRefEl) {
    var val = parseFloat(shiftRefEl.value);
    node.data.shiftRefRPM = (val && val > 0) ? val : null;
  }
  if(fwdEl) node.data.forwardGears = parseInt(fwdEl.value) || 6;
  if(revEl) node.data.reverseGears = parseInt(revEl.value) || 1;
  if(govEl) node.data.gbGovernedSpeed = parseFloat(govEl.value) || 0;
}

// Tam Gaz — Şanzıman preset seçimi
function onVEFTGBPresetSelect(nodeId, value) {
  var node = nodes.find(function(n) { return n.id === nodeId; });
  if(!node) return;
  if(!node.data) node.data = {};
  
  if(!value) return;
  var preset = VE_GEARBOX_PRESETS[value];
  if(!preset) return;
  
  node.data.ftGBPreset = value;

  // Şanzıman adı güncelle — isim/sayı verilerini DOM'dan bağımsız yaz
  var nameEl = document.getElementById('ve-gb-name-' + nodeId);
  node.data.gbName = preset.name;
  if(nameEl) nameEl.value = preset.name;

  // Vites sayıları güncelle
  var fwdGears = preset.gears.filter(function(g) { return g.gear !== 'R'; });
  var revGears = preset.gears.filter(function(g) { return g.gear === 'R'; });
  var fwdEl = document.getElementById('ve-gb-fwd-' + nodeId);
  var revEl = document.getElementById('ve-gb-rev-' + nodeId);
  node.data.forwardGears = fwdGears.length;
  node.data.reverseGears = revGears.length;
  if(fwdEl) fwdEl.value = fwdGears.length;
  if(revEl) revEl.value = revGears.length;
  
  // 3000SP/3200SP ise kalibre edilmiş veri kullan
  var ftGears = [];
  if(value === '3000SP' || value === '3200SP') {
    ftGears = VE_FT_GB_DEFAULT_GEARS.map(function(g) {
      return {name: g.name, ratio: g.ratio, eff: g.eff, lockup: g.lockup};
    });
  } else {
    // Diğer presetler: oran al, verim tahmin et
    // Direct drive vites bul (ratio === 1.00)
    var directIdx = -1;
    fwdGears.forEach(function(g, i) { if(Math.abs(g.ratio - 1.0) < 0.01) directIdx = i; });
    
    fwdGears.forEach(function(g, i) {
      var eff;
      if(directIdx >= 0 && i === directIdx) eff = 99.64; // Direct drive
      else if(i === 0) eff = 98.11; // 1. vites (yüksek tork yükü)
      else if(directIdx >= 0 && i < directIdx) eff = 98.5 + (i / directIdx) * 0.5; // Underdrive
      else eff = 98.62 - (i - directIdx) * 0.57; // Overdrive (artan kayıp)
      
      ftGears.push({
        name: 'F' + g.gear,
        ratio: g.ratio,
        eff: parseFloat(eff.toFixed(2)),
        lockup: (i > 0) // F1 = converter, geri kalan lockup
      });
    });
    revGears.forEach(function(g, i) {
      ftGears.push({
        name: 'R' + (i + 1),
        ratio: Math.abs(g.ratio),
        eff: 97.50,
        lockup: false
      });
    });
  }
  
  // Vites tablosunu güncelle
  node.data.ftGearData = ftGears;
  
  var tbody = document.getElementById('ve-ftgear-table-' + nodeId);
  if(tbody) {
    tbody.innerHTML = '';
    ftGears.forEach(function(row) {
      var tr = document.createElement('tr');
      tr.innerHTML = getVEFTGearRowHTML(nodeId, row.name, row.ratio, row.eff, row.lockup).replace('<tr>', '').replace('</tr>', '');
      tbody.appendChild(tr);
    });
  }
  
  saveVEFTGearData(nodeId);
  
  // Şanzıman değiştiğinde shift profilini bu şanzımana özel kalibrasyonla eşleştir
  var currentSP = node.data.shiftProfile || '';
  var currentMatchesGB = currentSP && veGetGearboxKeyFromShiftProfile(currentSP) === value;
  if(!currentMatchesGB) {
    var matchKey = '';
    Object.keys(VE_FT_SHIFT_PROFILES).forEach(function(spk) {
      if(!matchKey && veGetGearboxKeyFromShiftProfile(spk) === value) matchKey = spk;
    });
    if(matchKey) {
      node.data.shiftProfile = matchKey;
      var msp = VE_FT_SHIFT_PROFILES[matchKey];
      node.data.lockupOffset = msp.lockupOffset;
      node.data.shift1C2C_outRatio = msp.shift1C2C_outRatio;
      node.data.shift2C2L_outRatio = msp.shift2C2L_outRatio;
    } else {
      // Bu şanzıman için kalibrasyon yok → profil seçimini temizle
      node.data.shiftProfile = '';
    }
  }
  
  // Şanzıman limitleri: netTurbineTorque → EC-Matching turbineRating otomatik güncelle
  if(preset.netTurbineTorque) {
    var ecmNode = nodes.find(function(n) { return n.type === 'ec-matching'; });
    if(ecmNode) {
      if(!ecmNode.data) ecmNode.data = {};
      ecmNode.data.turbineRating = preset.netTurbineTorque;
      var trEl = document.getElementById('ecm-turbine-rating-' + ecmNode.id);
      if(trEl) trEl.value = preset.netTurbineTorque;
    }
  }
  // Şanzıman limit verilerini gearbox node'a da kaydet
  node.data.gbGrossInputPower = preset.grossInputPower;
  node.data.gbGrossInputTorque = preset.grossInputTorque;
  node.data.gbNetTurbineTorque = preset.netTurbineTorque;
  node.data.gbMaxOutputSpeed = preset.maxOutputSpeed;

  // Şanzıman limitleri bilgi mesajı
  var limitsInfo = [];
  if(preset.grossInputPower) limitsInfo.push('Giriş Güç: ' + preset.grossInputPower + ' kW');
  if(preset.grossInputTorque) limitsInfo.push('Giriş Tork: ' + preset.grossInputTorque + ' Nm');
  if(preset.netTurbineTorque) limitsInfo.push('Türbin Tork: ' + preset.netTurbineTorque + ' Nm');
  if(preset.maxOutputSpeed) limitsInfo.push('Max Çıkış: ' + preset.maxOutputSpeed + ' rpm');
  if(limitsInfo.length > 0) {
    showToast('Şanzıman limitleri: ' + limitsInfo.join(' | '), 'info');
  }

  // Şanzıman ailesi değiştiğinde TC dropdown'ını güncelle
  veRefreshTCDropdownForFamily();

  // Shift profili dropdown'ını ve readonly parametreleri yenilemek için paneli yeniden çiz
  showNodeProperties(node);
}

function onVEGearboxEffChange(nodeId) {
  var node = nodes.find(function(n) { return n.id === nodeId; });
  if(!node) return;
  if(!node.data) node.data = {};
  var el = document.getElementById('ve-gearbox-eff-' + nodeId);
  if(el) { var n = parseFloat(el.value); node.data.efficiency = isNaN(n) ? 97 : n; }
}

// Şanzıman satır HTML'i
function getVEGearboxRowHTML(nodeId, gear, ratio, note) {
  var html = '<tr>';
  html += '<td style="padding:3px; border-bottom:1px solid var(--border-color);"><input type="text" value="' + gear + '" style="width:100%; padding:4px; font-size:0.7rem; background:var(--bg-input); color:var(--text-primary); border:1px solid var(--border-color); border-radius:0; text-align:center;" onchange="onVEGearboxDataChange(\'' + nodeId + '\')"></td>';
  html += '<td style="padding:3px; border-bottom:1px solid var(--border-color);"><input type="number" step="0.001" value="' + ratio + '" style="width:100%; padding:4px; font-size:0.7rem; background:var(--bg-input); color:var(--text-primary); border:1px solid var(--border-color); border-radius:0; text-align:center;" onchange="onVEGearboxDataChange(\'' + nodeId + '\')"></td>';
  html += '<td style="padding:3px; border-bottom:1px solid var(--border-color);"><input type="text" value="' + note + '" style="width:100%; padding:4px; font-size:0.7rem; background:var(--bg-input); color:var(--text-primary); border:1px solid var(--border-color); border-radius:0; text-align:center;" onchange="onVEGearboxDataChange(\'' + nodeId + '\')"></td>';
  html += '<td style="padding:3px; border-bottom:1px solid var(--border-color); text-align:center;"><button onclick="removeVEGearboxRow(this, \'' + nodeId + '\')" style="padding:2px 6px; font-size:0.6rem; background:var(--accent-danger); color:white; border:none; border-radius:0; cursor:pointer;" title="Satırı sil">×</button></td>';
  html += '</tr>';
  return html;
}

// Şanzıman preset verileri
var VE_GEARBOX_PRESETS = {
  '1000SP': {
    name: 'Allison | 1000SP',
    family: '1000_2000',
    calibrated: false,
    grossInputPower: null,
    grossInputTorque: null,
    netTurbineTorque: null,
    maxOutputSpeed: null,
    gears: [
      {gear: '1', ratio: 3.10, note: ''},
      {gear: '2', ratio: 1.81, note: ''},
      {gear: '3', ratio: 1.41, note: ''},
      {gear: '4', ratio: 1.00, note: ''},
      {gear: '5', ratio: 0.71, note: ''},
      {gear: '6', ratio: 0.61, note: ''},
      {gear: 'R', ratio: -4.49, note: 'Geri'}
    ]
  },
  '2100SP': {
    name: 'Allison | 2100SP',
    family: '1000_2000',
    calibrated: false,
    grossInputPower: null,
    grossInputTorque: null,
    netTurbineTorque: null,
    maxOutputSpeed: null,
    gears: [
      {gear: '1', ratio: 3.10, note: ''},
      {gear: '2', ratio: 1.81, note: ''},
      {gear: '3', ratio: 1.41, note: ''},
      {gear: '4', ratio: 1.00, note: ''},
      {gear: '5', ratio: 0.71, note: ''},
      {gear: '6', ratio: 0.61, note: ''},
      {gear: 'R', ratio: -4.49, note: 'Geri'}
    ]
  },
  '2200SP': {
    name: 'Allison | 2200SP',
    family: '1000_2000',
    calibrated: false,
    grossInputPower: null,
    grossInputTorque: null,
    netTurbineTorque: null,
    maxOutputSpeed: null,
    gears: [
      {gear: '1', ratio: 3.10, note: ''},
      {gear: '2', ratio: 1.81, note: ''},
      {gear: '3', ratio: 1.41, note: ''},
      {gear: '4', ratio: 1.00, note: ''},
      {gear: '5', ratio: 0.71, note: ''},
      {gear: '6', ratio: 0.61, note: ''},
      {gear: 'R', ratio: -4.49, note: 'Geri'}
    ]
  },
  '2350SP': {
    name: 'Allison | 2350SP',
    family: '1000_2000',
    calibrated: false,
    grossInputPower: null,
    grossInputTorque: null,
    netTurbineTorque: null,
    maxOutputSpeed: null,
    gears: [
      {gear: '1', ratio: 3.10, note: ''},
      {gear: '2', ratio: 1.81, note: ''},
      {gear: '3', ratio: 1.41, note: ''},
      {gear: '4', ratio: 1.00, note: ''},
      {gear: '5', ratio: 0.71, note: ''},
      {gear: '6', ratio: 0.61, note: ''},
      {gear: 'R', ratio: -4.49, note: 'Geri'}
    ]
  },
  '2500SP': {
    name: 'Allison | 2500SP',
    family: '1000_2000',
    calibrated: true,
    downshiftCalibrated: true,
    grossInputPower: null,
    grossInputTorque: null,
    netTurbineTorque: null,
    maxOutputSpeed: null,
    gears: [
      {gear: '1', ratio: 3.51, note: ''},
      {gear: '2', ratio: 1.90, note: ''},
      {gear: '3', ratio: 1.44, note: ''},
      {gear: '4', ratio: 1.00, note: ''},
      {gear: '5', ratio: 0.74, note: ''},
      {gear: '6', ratio: 0.64, note: ''},
      {gear: 'R', ratio: -5.09, note: 'Geri'}
    ]
  },
  '3000SP': {
    name: 'Allison | 3000SP',
    family: '3000',
    calibrated: true,
    grossInputPower: 261,
    grossInputTorque: 1424,
    netTurbineTorque: 2305,
    maxOutputSpeed: 3600,
    gears: [
      {gear: '1', ratio: 3.49, note: ''},
      {gear: '2', ratio: 1.86, note: ''},
      {gear: '3', ratio: 1.41, note: ''},
      {gear: '4', ratio: 1.00, note: ''},
      {gear: '5', ratio: 0.75, note: ''},
      {gear: '6', ratio: 0.65, note: ''},
      {gear: 'R', ratio: -5.03, note: 'Geri'}
    ]
  },
  '3200SP': {
    name: 'Allison | 3200SP',
    family: '3000',
    calibrated: true,
    downshiftCalibrated: true,
    grossInputPower: 336,
    grossInputTorque: 1695,
    netTurbineTorque: 2305,
    maxOutputSpeed: 3600,
    gears: [
      {gear: '1', ratio: 3.49, note: ''},
      {gear: '2', ratio: 1.86, note: ''},
      {gear: '3', ratio: 1.41, note: ''},
      {gear: '4', ratio: 1.00, note: ''},
      {gear: '5', ratio: 0.75, note: ''},
      {gear: '6', ratio: 0.65, note: ''},
      {gear: 'R', ratio: -5.03, note: 'Geri'}
    ]
  },
  '3500SP': {
    name: 'Allison | 3500SP',
    family: '3000',
    calibrated: true,
    downshiftCalibrated: true,
    grossInputPower: 246,
    grossInputTorque: 1335,
    netTurbineTorque: 2034,
    maxOutputSpeed: 3600,
    gears: [
      {gear: '1', ratio: 4.59, note: ''},
      {gear: '2', ratio: 2.25, note: ''},
      {gear: '3', ratio: 1.54, note: ''},
      {gear: '4', ratio: 1.00, note: ''},
      {gear: '5', ratio: 0.75, note: ''},
      {gear: '6', ratio: 0.65, note: ''},
      {gear: 'R', ratio: -5.00, note: 'Geri'}
    ]
  },
  '3700SP': {
    name: 'Allison | 3700SP',
    family: '3000',
    calibrated: false,
    grossInputPower: 246,
    grossInputTorque: 1186,
    netTurbineTorque: 1996,
    maxOutputSpeed: 3600,
    gears: [
      {gear: '1', ratio: 6.93, note: ''},
      {gear: '2', ratio: 4.18, note: ''},
      {gear: '3', ratio: 2.24, note: ''},
      {gear: '4', ratio: 1.69, note: ''},
      {gear: '5', ratio: 1.20, note: ''},
      {gear: '6', ratio: 0.90, note: ''},
      {gear: '7', ratio: 0.78, note: ''},
      {gear: 'R', ratio: -6.03, note: 'Geri'}
    ]
  },
  '4000SP': {
    name: 'Allison | 4000SP',
    family: '4000',
    calibrated: true,
    grossInputPower: 485,
    grossInputTorque: 2544,
    netTurbineTorque: 3795,
    maxOutputSpeed: 3600,
    gears: [
      {gear: '1', ratio: 3.51, note: ''},
      {gear: '2', ratio: 1.91, note: ''},
      {gear: '3', ratio: 1.43, note: ''},
      {gear: '4', ratio: 1.00, note: ''},
      {gear: '5', ratio: 0.74, note: ''},
      {gear: '6', ratio: 0.64, note: ''},
      {gear: 'R', ratio: -4.80, note: 'Geri'}
    ]
  },
  '4500SP': {
    name: 'Allison | 4500SP',
    family: '4000',
    calibrated: true,
    downshiftCalibrated: true,
    grossInputPower: 451,
    grossInputTorque: 2400,
    netTurbineTorque: 3525,
    maxOutputSpeed: 3525,
    gears: [
      {gear: '1', ratio: 4.70, note: ''},
      {gear: '2', ratio: 2.21, note: ''},
      {gear: '3', ratio: 1.53, note: ''},
      {gear: '4', ratio: 1.00, note: ''},
      {gear: '5', ratio: 0.76, note: ''},
      {gear: '6', ratio: 0.67, note: ''},
      {gear: 'R', ratio: -5.55, note: 'Geri'}
    ]
  },
  '4700SP': {
    name: 'Allison | 4700SP',
    family: '4000',
    calibrated: true,
    downshiftCalibrated: true,
    grossInputPower: 451,
    grossInputTorque: 2508,
    netTurbineTorque: 4067,
    maxOutputSpeed: null,
    gears: [
      {gear: '1', ratio: 7.63, note: ''},
      {gear: '2', ratio: 3.51, note: ''},
      {gear: '3', ratio: 1.91, note: ''},
      {gear: '4', ratio: 1.43, note: ''},
      {gear: '5', ratio: 1.00, note: ''},
      {gear: '6', ratio: 0.74, note: ''},
      {gear: '7', ratio: 0.64, note: ''},
      {gear: 'R', ratio: -4.80, note: 'Geri'}
    ]
  },
  '4800SP': {
    name: 'Allison | 4800SP',
    family: '4000',
    calibrated: false,
    grossInputPower: 597,
    grossInputTorque: 2644,
    netTurbineTorque: 4067,
    maxOutputSpeed: null,
    gears: [
      {gear: '1', ratio: 7.63, note: ''},
      {gear: '2', ratio: 3.51, note: ''},
      {gear: '3', ratio: 1.91, note: ''},
      {gear: '4', ratio: 1.43, note: ''},
      {gear: '5', ratio: 1.00, note: ''},
      {gear: '6', ratio: 0.74, note: ''},
      {gear: '7', ratio: 0.64, note: ''},
      {gear: 'R', ratio: -4.80, note: 'Geri'}
    ]
  },
  '4900SP': {
    name: 'Allison | 4900SP',
    family: '4000',
    calibrated: false,
    grossInputPower: null,
    grossInputTorque: null,
    netTurbineTorque: null,
    maxOutputSpeed: null,
    gears: [
      {gear: '1', ratio: 7.63, note: ''},
      {gear: '2', ratio: 3.51, note: ''},
      {gear: '3', ratio: 1.91, note: ''},
      {gear: '4', ratio: 1.43, note: ''},
      {gear: '5', ratio: 1.00, note: ''},
      {gear: '6', ratio: 0.74, note: ''},
      {gear: '7', ratio: 0.64, note: ''},
      {gear: 'R', ratio: -4.80, note: 'Geri'}
    ]
  },
  '2957SP_WIDE': {
    name: 'Allison | 2957 SP Wide',
    family: '',
    calibrated: false,
    partialData: true,
    grossInputPower: null,
    grossInputTorque: null,
    netTurbineTorque: null,
    maxOutputSpeed: null,
    gears: [
      {gear: '1', ratio: 4.822, note: ''},
      {gear: '2', ratio: 3.512, note: ''},
      {gear: '3', ratio: 2.852, note: ''},
      {gear: '4', ratio: 1.896, note: ''},
      {gear: '5', ratio: 1.439, note: ''},
      {gear: '6', ratio: 1.000, note: ''},
      {gear: '7', ratio: 0.736, note: ''},
      {gear: '8', ratio: 0.643, note: ''},
      {gear: '9', ratio: 0.568, note: ''},
      {gear: 'R', ratio: -5.085, note: 'Geri'}
    ]
  }
};

// Şanzıman seçildiğinde
function onVEGearboxSelectChange(nodeId, value) {
  var node = nodes.find(function(n) { return n.id === nodeId; });
  if(!node) return;
  
  if(!node.data) node.data = {};
  node.data.selectedGearbox = value;
  
  var dataArea = document.getElementById('ve-gearbox-data-area-' + nodeId);
  var tbody = document.getElementById('ve-gearbox-table-' + nodeId);
  
  if(value === '' || value === '__new__') {
    if(dataArea) dataArea.style.display = value === '__new__' ? 'block' : 'none';
    if(value === '__new__' && tbody) {
      tbody.innerHTML = '';
      addVEGearboxRow(nodeId);
    }
    node.data.gearData = [];
    updateVEGearSelectOptions(nodeId);
    return;
  }
  
  // Preset verilerini yükle
  var preset = VE_GEARBOX_PRESETS[value];
  if(preset && tbody) {
    if(dataArea) dataArea.style.display = 'block';
    tbody.innerHTML = '';
    preset.gears.forEach(function(g) {
      var tr = document.createElement('tr');
      tr.innerHTML = getVEGearboxRowHTML(nodeId, g.gear, g.ratio, g.note).replace('<tr>', '').replace('</tr>', '');
      tbody.appendChild(tr);
    });
    node.data.gearData = JSON.parse(JSON.stringify(preset.gears));
    updateVEGearSelectOptions(nodeId);
    showToast(preset.name + ' yüklendi');
  }
}

// Vites seçim dropdown'ını güncelle
function updateVEGearSelectOptions(nodeId) {
  var node = nodes.find(function(n) { return n.id === nodeId; });
  if(!node) return;
  
  var selectEl = document.getElementById('ve-gear-select-' + nodeId);
  if(!selectEl) return;
  
  var gearData = node.data && node.data.gearData ? node.data.gearData : getVEGearboxTableData(nodeId);
  
  selectEl.innerHTML = '<option value="">-- Vites Seçin --</option>';
  gearData.forEach(function(g, idx) {
    if(g.gear && g.ratio && parseFloat(g.ratio) > 0) { // Geri vites hariç
      var opt = document.createElement('option');
      opt.value = idx;
      opt.textContent = g.gear + '. vites (oran: ' + g.ratio + ')';
      selectEl.appendChild(opt);
    }
  });
}

// Vites seçildiğinde
function onVEGearSelectChange(nodeId) {
  var node = nodes.find(function(n) { return n.id === nodeId; });
  if(!node) return;
  
  var selectEl = document.getElementById('ve-gear-select-' + nodeId);
  var ratioEl = document.getElementById('ve-gear-ratio-' + nodeId);
  if(!selectEl || !ratioEl) return;
  
  var idx = parseInt(selectEl.value);
  var gearData = node.data && node.data.gearData ? node.data.gearData : getVEGearboxTableData(nodeId);
  
  if(!isNaN(idx) && gearData[idx]) {
    ratioEl.value = gearData[idx].ratio;
    if(!node.data) node.data = {};
    node.data.selectedGear = selectEl.value;
    node.data.selectedGearRatio = gearData[idx].ratio;
  } else {
    ratioEl.value = '';
    if(node.data) {
      node.data.selectedGear = '';
      node.data.selectedGearRatio = '';
    }
  }
}

// Şanzıman tablosundan veri al
function getVEGearboxTableData(nodeId) {
  var tbody = document.getElementById('ve-gearbox-table-' + nodeId);
  if(!tbody) return [];
  
  var data = [];
  tbody.querySelectorAll('tr').forEach(function(tr) {
    var inputs = tr.querySelectorAll('input');
    if(inputs.length >= 2) {
      var gear = inputs[0].value.trim();
      var ratio = inputs[1].value.trim();
      var note = inputs[2] ? inputs[2].value.trim() : '';
      if(gear || ratio) {
        data.push({gear: gear, ratio: ratio, note: note});
      }
    }
  });
  return data;
}

// Şanzıman satır ekle
function addVEGearboxRow(nodeId) {
  var tbody = document.getElementById('ve-gearbox-table-' + nodeId);
  if(!tbody) return;
  
  var tr = document.createElement('tr');
  tr.innerHTML = getVEGearboxRowHTML(nodeId, '', '', '').replace('<tr>', '').replace('</tr>', '');
  tbody.appendChild(tr);
}

// Şanzıman satır sil
function removeVEGearboxRow(btn, nodeId) {
  var tr = btn.closest('tr');
  if(tr) {
    tr.remove();
    onVEGearboxDataChange(nodeId);
  }
}

// Şanzıman tablosu temizle
function clearVEGearboxTable(nodeId) {
  showConfirmToast('Tablodaki tüm verileri silmek istediğinize emin misiniz?', function() {
    var tbody = document.getElementById('ve-gearbox-table-' + nodeId);
    if(tbody) {
      tbody.innerHTML = '';
      addVEGearboxRow(nodeId);
    }
    var node = nodes.find(function(n) { return n.id === nodeId; });
    if(node && node.data) {
      node.data.gearData = [];
    }
    updateVEGearSelectOptions(nodeId);
    showToast('Tablo temizlendi');
  });
}

// Şanzıman değerleri kaydet
function saveVEGearboxValues(nodeId) {
  var node = nodes.find(function(n) { return n.id === nodeId; });
  if(!node) return;
  
  if(!node.data) node.data = {};
  node.data.gearData = getVEGearboxTableData(nodeId);
  updateVEGearSelectOptions(nodeId);
  showToast('Şanzıman verileri kaydedildi');
}

// Şanzıman veri değişikliği
function onVEGearboxDataChange(nodeId) {
  var node = nodes.find(function(n) { return n.id === nodeId; });
  if(!node) return;
  
  if(!node.data) node.data = {};
  node.data.gearData = getVEGearboxTableData(nodeId);
  updateVEGearSelectOptions(nodeId);
}

