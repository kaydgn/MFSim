// ============================================================================
// ÇÖZÜCÜ FONKSİYONLARI
// ============================================================================

// ── Ortak: Diğer topolojileri otomatik çöz ──
// solver.js ve solver-pro.js tarafından ortak kullanılır.
// options.log varsa detaylı loglama yapar (pro solver), yoksa sessiz çalışır.
function _veSolveOtherTopologies(options) {
  if(typeof veTabs === 'undefined' || veTabs.length <= 1) return;

  var log = (options && options.log) || function() {};
  var logSpacer = (options && options.logSpacer) || function() {};

  if(options && options.log) {
    logSpacer();
    log('═══════════════════════════════════════════', 'head');
    log('  EK TOPOLOJİLER — OTOMATİK ÇÖZÜM', 'head');
    log('═══════════════════════════════════════════', 'head');
    logSpacer();
    log('Aktif topoloji dışında ' + (veTabs.length - 1) + ' topoloji tespit edildi.', 'info');
    logSpacer();
  }

  // Global değişkenleri yedekle
  var _origNodes = nodes;
  var _origConns = connections;
  var _origSimResults = window.veSimResults;
  var _origChartViews = (typeof veChartViews !== 'undefined') ? JSON.parse(JSON.stringify(veChartViews)) : null;

  var _solvedCount = 0;
  var _failCount = 0;

  try {
    for(var _ti = 0; _ti < veTabs.length; _ti++) {
      if(_ti === veActiveTabIdx) {
        if(options && options.log) log('[' + (_ti+1) + '/' + veTabs.length + '] ' + veTabs[_ti].name + ' — zaten çözüldü ✓', 'ok');
        continue;
      }
      var _otherTab = veTabs[_ti];
      if(!_otherTab.state || !_otherTab.state.nodes || _otherTab.state.nodes.length === 0) {
        if(options && options.log) log('[' + (_ti+1) + '/' + veTabs.length + '] ' + _otherTab.name + ' — boş topoloji, atlandı', 'warn');
        continue;
      }

      var _hasEngine = _otherTab.state.nodes.some(function(n) { return n.type === 'engine' || n.type === 'engine-brake'; });
      if(!_hasEngine) {
        if(options && options.log) log('[' + (_ti+1) + '/' + veTabs.length + '] ' + _otherTab.name + ' — motor bileşeni yok, atlandı', 'warn');
        continue;
      }

      if(options && options.log) log('[' + (_ti+1) + '/' + veTabs.length + '] ' + _otherTab.name + ' çözülüyor...', 'info');

      try {
        var _tempNodes = _otherTab.state.nodes.map(function(n) {
          var _def = componentDefs[n.type];
          if(!_def) return null;
          return {
            id: n.id, type: n.type, x: n.x, y: n.y,
            width: n.width || 65, height: n.height || 60,
            def: _def,
            customName: n.customName || '',
            mirrored: n.mirrored || false,
            isMasterWheel: n.isMasterWheel || false,
            isMasterDiff: n.isMasterDiff || false,
            data: JSON.parse(JSON.stringify(n.data || {}))
          };
        }).filter(function(n) { return n !== null; });

        var _tempConns = _otherTab.state.connections ? JSON.parse(JSON.stringify(_otherTab.state.connections)) : [];

        nodes = _tempNodes;
        connections = _tempConns;

        var _otherResult;
        if(veActiveModule === 'full-throttle') {
          // Transfer dişli oranlarını iterasyonla gez
          var _trN = _tempNodes.find(function(n) { return n.type === 'transfer'; });
          var _trd = _trN ? (_trN.data || {}) : {};
          var _ftTrG = _trd.ftTrGears || [
            { kademe: 'High', ratio: 1.054, eff: 97.00 }
          ];
          var _allRR = {};
          _ftTrG.forEach(function(g) {
            _allRR[g.kademe] = veFTRunSimulationEngine(g.kademe);
          });
          _otherResult = _allRR[_ftTrG[0].kademe];
        } else {
          _otherResult = veRunSimulationEngine();
        }

        _otherTab.state.simResults = _otherResult;
        _solvedCount++;

        if(options && options.log) {
          var _otLen = _otherResult.time.length;
          var _otTime = _otherResult.time[_otLen - 1];
          log('  ✓ Tamamlandı — ' + _otLen + ' nokta, ' + _otTime.toFixed(1) + ' s', 'ok');
          if(_otherResult.speed && _otherResult.speed.length > 0) {
            log('  Hız: ' + _otherResult.speed[0].toFixed(1) + ' → ' + _otherResult.speed[_otLen - 1].toFixed(1) + ' km/h', 'dim');
          } else if(_otherResult.rpm && _otherResult.rpm.length > 0) {
            log('  Devir: ' + _otherResult.rpm[0].toFixed(0) + ' → ' + _otherResult.rpm[_otLen - 1].toFixed(0) + ' d/d', 'dim');
          }
        }
      } catch(_err) {
        _failCount++;
        if(options && options.log) {
          log('  ✗ HATA: ' + _err.message, 'err');
        } else {
          console.warn('[MFSim] Topoloji çözüm hatası (' + _otherTab.name + '):', _err.message);
        }
      }
    }
  } finally {
    // Global değişkenleri HER DURUMDA geri yükle
    nodes = _origNodes;
    connections = _origConns;
    window.veSimResults = _origSimResults;
    if(_origChartViews) veChartViews = _origChartViews;
  }

  if(options && options.log) {
    logSpacer();
    log(_solvedCount + ' ek topoloji başarıyla çözüldü' + (_failCount > 0 ? ', ' + _failCount + ' hata' : '') + '.', _failCount > 0 ? 'warn' : 'ok');
    logSpacer();
  }
}
function veSolverValidate() {
  var container = document.getElementById('ve-solver-validation');
  if(!container) return;
  
  var html = '';
  var allOk = true;
  
  // Bileşen kontrolleri
  var hasEngine = nodes.some(function(n) { return n.type === 'engine' || n.type === 'engine-brake'; });
  var hasGearbox = nodes.some(function(n) { return n.type === 'gearbox'; });
  var hasWheel = nodes.some(function(n) { return n.type === 'wheel'; });
  var hasVehicle = nodes.some(function(n) { return n.type === 'vehicle'; });
  var hasRoad = nodes.some(function(n) { return n.type === 'road'; });
  var hasDiff = nodes.some(function(n) { return n.type === 'differential'; });
  var hasTerminator = nodes.some(function(n) { return n.type === 'terminator'; });
  var hasScenario = nodes.some(function(n) { return n.type === 'scenario'; });
  
  // Terminator bağlı mı?
  var terminatorConnected = false;
  if(hasTerminator) {
    terminatorConnected = nodes.some(function(n) {
      if(n.type !== 'terminator') return false;
      return connections.some(function(c) { return c.to === n.id; });
    });
  }
  
  function addItem(ok, label, detail) {
    var cls = ok ? 've-validation-ok' : 've-validation-err';
    var icon = ok ? '✅' : '❌';
    html += '<div class="ve-validation-item ' + cls + '"><span>' + icon + '</span><span>' + label + (detail ? ' <span style="color:var(--text-muted);font-size:0.7rem;">(' + detail + ')</span>' : '') + '</span></div>';
    if(!ok) allOk = false;
  }
  
  function addWarn(label) {
    html += '<div class="ve-validation-item ve-validation-warn"><span>⚠️</span><span>' + label + '</span></div>';
  }
  
  function addInfo(label) {
    html += '<div class="ve-validation-item" style="font-size:0.75rem;"><span>ℹ️</span><span>' + label + '</span></div>';
  }
  
  addItem(hasEngine, 'Motor / Motor Freni bileşeni', hasEngine ? 'mevcut' : 'eksik');

  // Senaryo bileşeni zorunlu kontrolü
  var mod = veGetActiveModule();
  var scenarioRequired = mod.requiredComponents && mod.requiredComponents.indexOf('scenario') > -1;
  if(scenarioRequired) {
    addItem(hasScenario, 'Senaryolar bileşeni', hasScenario ? 'mevcut' : 'eksik — zorunlu bileşen');
  } else if(hasScenario) {
    addInfo('Senaryolar bileşeni mevcut (opsiyonel)');
  }

  if(hasTerminator && terminatorConnected) {
    // Kısmi analiz modu — sonlandırıcıya kadar hesap yapılacak
    addInfo('<span style="color:var(--accent-danger);font-weight:600;">Kısmi Analiz Modu</span> — Sonlandırıcı tespit edildi, zincir sonlandırıcıya kadar hesaplanacak');
    // Kısmi modda gearbox/wheel/vehicle zorunlu değil, ama motor zorunlu
    if(hasGearbox) addItem(true, 'Şanzıman bileşeni', 'mevcut');
    if(hasWheel) addItem(true, 'Tekerlek bileşeni', 'mevcut');
    if(hasVehicle) addItem(true, 'Araç Gövdesi bileşeni', 'mevcut');
  } else {
    // Tam analiz modu — tüm bileşenler gerekli
    addItem(hasGearbox, 'Şanzıman bileşeni', hasGearbox ? 'mevcut' : 'eksik');
    addItem(hasWheel, 'Tekerlek bileşeni', hasWheel ? 'mevcut' : 'eksik');
    addItem(hasVehicle, 'Araç Gövdesi bileşeni', hasVehicle ? 'mevcut' : 'eksik');
    if(veActiveModule !== 'full-throttle') {
      addItem(hasRoad, 'Yol / Eğim bileşeni', hasRoad ? 'mevcut' : 'eksik');
    } else if(hasRoad) {
      addInfo('Yol / Eğim bileşeni mevcut (opsiyonel — eğim Araç bileşeninden alınır)');
    }
    if(!hasDiff) addWarn('Diferansiyel bileşeni eksik - varsayılan oran kullanılacak');
  }
  
  // Bağlantı kontrolleri - terminator ve standalone hariç
  var standaloneTypes = ['vehicle','road','sensor','solver','scenario','coast-down','parametric','terminator'];
  var connectedNodes = new Set();
  connections.forEach(function(c) { connectedNodes.add(c.from); connectedNodes.add(c.to); });
  var disconnected = nodes.filter(function(n) {
    return standaloneTypes.indexOf(n.type) === -1 && !connectedNodes.has(n.id);
  });
  
  addItem(disconnected.length === 0, 'Güç zinciri bileşenleri bağlı', disconnected.length > 0 ? disconnected.length + ' bileşen bağlı değil' : 'OK');
  
  // Veri kontrolleri
  if(hasEngine) {
    var engineNode = nodes.find(function(n) { return n.type === 'engine' || n.type === 'engine-brake'; });
    var hasData = engineNode && engineNode.data && engineNode.data.torqueData && engineNode.data.torqueData.length >= 2;
    addItem(hasData, 'Motor tork verileri', hasData ? engineNode.data.torqueData.length + ' veri noktası' : 'eksik veya yetersiz');
  }
  
  if(hasVehicle) {
    var vehicleNode = nodes.find(function(n) { return n.type === 'vehicle'; });
    var hasMass = vehicleNode && vehicleNode.data && vehicleNode.data.mass > 0;
    addItem(hasMass, 'Araç ağırlığı', hasMass ? vehicleNode.data.mass + ' kg' : 'girilmemiş');
  }
  
  if(hasRoad) {
    var roadNode = nodes.find(function(n) { return n.type === 'road'; });
    var hasGrade = roadNode && roadNode.data && !isNaN(roadNode.data.grade) && roadNode.data.grade !== '';
    addItem(hasGrade, 'Arazi eğimi', hasGrade ? '%' + roadNode.data.grade : 'girilmemiş');
  }
  
  // Sonuç
  if(allOk) {
    var modeText = (hasTerminator && terminatorConnected) ? 'Kısmi analiz' : 'Tam analiz';
    html += '<div style="margin-top:12px;padding:10px;background:rgba(76,175,80,0.1);border-radius:6px;border:1px solid rgba(76,175,80,0.3);text-align:center;font-size:0.8rem;color:var(--accent-success);font-weight:600;">✅ ' + modeText + ' - hesaplamaya hazır</div>';
    document.getElementById('ve-solver-run-btn').disabled = false;
    document.getElementById('ve-solver-run-btn').style.opacity = '1';
  } else {
    html += '<div style="margin-top:12px;padding:10px;background:rgba(244,67,54,0.1);border-radius:6px;border:1px solid rgba(244,67,54,0.3);text-align:center;font-size:0.8rem;color:var(--accent-danger);font-weight:600;">❌ Eksikler var - hesaplama yapılamaz</div>';
    document.getElementById('ve-solver-run-btn').disabled = true;
    document.getElementById('ve-solver-run-btn').style.opacity = '0.5';
  }
  
  container.innerHTML = html;
}

function veSolverRun() {
  veSolverValidate();
  
  var progressEl = document.getElementById('ve-solver-progress');
  var progressFill = document.getElementById('ve-solver-progress-fill');
  var progressText = document.getElementById('ve-solver-progress-text');
  var resultEl = document.getElementById('ve-solver-result');
  
  if(!progressEl) return;
  
  progressEl.style.display = 'block';
  progressFill.style.width = '0%';
  progressText.textContent = 'Başlatılıyor...';
  resultEl.innerHTML = '';
  
  setTimeout(function() {
    progressFill.style.width = '15%';
    progressText.textContent = 'Topoloji zinciri çıkarılıyor...';
    
    setTimeout(function() {
      try {
        // Ayar özetini güncelle
        var summaryEl = document.getElementById('ve-solver-settings-summary');
        var solverN = nodes.find(function(n) { return n.type === 'solver'; });
        if(summaryEl && solverN && solverN.data) {
          var sd = solverN.data;
          var mLabel = sd.method === 'heun' ? 'Heun' : sd.method === 'rk4' ? 'RK4' : sd.method === 'rk45' ? 'RK45' : sd.method === 'ralston' ? 'Ralston' : 'Euler';
          var tLabel = sd.timeMode === 'stop' ? 'Durma analizi' : (sd.duration || 60) + ' s';
          var summaryRows = '<tr><td style="color:var(--text-muted);">Mod:</td><td style="text-align:right;font-weight:600;">' + tLabel + '</td></tr><tr><td style="color:var(--text-muted);">Yöntem:</td><td style="text-align:right;font-weight:600;">' + mLabel + '</td></tr>';
          if(sd.method === 'rk45') {
            summaryRows += '<tr><td style="color:var(--text-muted);">Çıktı noktası:</td><td style="text-align:right;font-weight:600;">' + (sd.resolution || 500) + '</td></tr>';
            summaryRows += '<tr><td style="color:var(--text-muted);">Tolerans:</td><td style="text-align:right;font-weight:600;font-family:monospace;font-size:0.62rem;">' + (sd.atol || 1e-6) + ' / ' + (sd.rtol || 1e-4) + '</td></tr>';
          } else {
            summaryRows += '<tr><td style="color:var(--text-muted);">Çözünürlük:</td><td style="text-align:right;font-weight:600;">' + (sd.resolution || 200) + ' adım</td></tr>';
            summaryRows += '<tr><td style="color:var(--text-muted);">Δt:</td><td style="text-align:right;font-weight:600;">' + ((sd.dt || 0.3).toFixed(4)) + ' s</td></tr>';
          }
          summaryEl.innerHTML = '<table style="width:100%;font-size:0.72rem;">' + summaryRows + '</table>';
        }
        
        var simResult = veActiveModule === 'full-throttle' ? veFTRunSimulationEngine() : veRunSimulationEngine();
        
        progressFill.style.width = '100%';
        progressText.textContent = 'Tamamlandı!';
        
        window.veSimResults = simResult;

        // ── DİĞER TOPOLOJİLERİ OTOMATİK ÇÖZ ──
        try {
          _veSolveOtherTopologies();
        } catch(_otErr) {
          console.warn('[MFSim] Ek topoloji çözümünde hata:', _otErr.message);
        }

        var totalTime = simResult.time[simResult.time.length - 1];
        var ss = simResult.solverStats || {};
        
        var rhtml = '<div style="padding:12px;">';
        rhtml += '<div style="text-align:center; margin-bottom:12px;"><div style="font-size:1.5rem; margin-bottom:4px;">✅</div><div style="font-weight:600; color:var(--text-heading); font-size:0.85rem;">Hesaplama Tamamlandı</div>';
        rhtml += '<div style="font-size:0.65rem; color:var(--text-muted); margin-top:2px;">' + (simResult.mode === 'partial' ? '✂️ Kısmi Analiz Modu' : '🔗 Tam Analiz Modu') + '</div></div>';
        
        rhtml += '<div style="display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-bottom:12px;">';
        rhtml += '<div style="background:var(--bg-tertiary); padding:10px; border-radius:6px; border:1px solid var(--border-color); text-align:center;"><div style="font-size:0.65rem; color:var(--text-muted);">Toplam Süre</div><div style="font-size:1rem; font-weight:700; color:var(--accent-primary);">' + totalTime.toFixed(1) + ' s</div></div>';
        rhtml += '<div style="background:var(--bg-tertiary); padding:10px; border-radius:6px; border:1px solid var(--border-color); text-align:center;"><div style="font-size:0.65rem; color:var(--text-muted);">Çıktı Noktası</div><div style="font-size:1rem; font-weight:700; color:var(--accent-success);">' + simResult.time.length + '</div></div>';
        
        if(simResult.mode === 'partial') {
          var maxRpm = Math.max.apply(null, simResult.rpm);
          var finalRpm = simResult.rpm[simResult.rpm.length - 1];
          rhtml += '<div style="background:var(--bg-tertiary); padding:10px; border-radius:6px; border:1px solid var(--border-color); text-align:center;"><div style="font-size:0.65rem; color:var(--text-muted);">Maks Devir</div><div style="font-size:1rem; font-weight:700; color:#ef4444;">' + maxRpm.toFixed(0) + ' rpm</div></div>';
          rhtml += '<div style="background:var(--bg-tertiary); padding:10px; border-radius:6px; border:1px solid var(--border-color); text-align:center;"><div style="font-size:0.65rem; color:var(--text-muted);">Son Devir</div><div style="font-size:1rem; font-weight:700; color:#f59e0b;">' + finalRpm.toFixed(0) + ' rpm</div></div>';
        } else {
          var maxV = Math.max.apply(null, simResult.speed);
          var finalV = simResult.speed[simResult.speed.length - 1];
          rhtml += '<div style="background:var(--bg-tertiary); padding:10px; border-radius:6px; border:1px solid var(--border-color); text-align:center;"><div style="font-size:0.65rem; color:var(--text-muted);">Maks Hız</div><div style="font-size:1rem; font-weight:700; color:#ef4444;">' + maxV.toFixed(2) + ' km/h</div></div>';
          rhtml += '<div style="background:var(--bg-tertiary); padding:10px; border-radius:6px; border:1px solid var(--border-color); text-align:center;"><div style="font-size:0.65rem; color:var(--text-muted);">Son Hız</div><div style="font-size:1rem; font-weight:700; color:#f59e0b;">' + finalV.toFixed(2) + ' km/h</div></div>';
        }
        
        rhtml += '</div>';
        
        // ── Solver İstatistikleri Kartı ──
        if(ss.method) {
          rhtml += '<div style="background:var(--bg-secondary); border:1px solid var(--border-color); border-radius:8px; padding:10px; margin-bottom:10px;">';
          rhtml += '<div style="font-size:0.68rem; font-weight:600; color:var(--text-heading); margin-bottom:6px;">📊 Solver İstatistikleri</div>';
          rhtml += '<table style="width:100%; font-size:0.65rem; color:var(--text-secondary);">';
          
          if(ss.method === 'rk45') {
            rhtml += '<tr><td>İç adım sayısı:</td><td style="text-align:right; font-weight:600; font-family:monospace;">' + (ss.steps || 0) + '</td></tr>';
            rhtml += '<tr><td>Reddedilen adım:</td><td style="text-align:right; font-weight:600; font-family:monospace; color:' + (ss.rejected > 0 ? '#f59e0b' : 'var(--accent-success)') + ';">' + (ss.rejected || 0) + '</td></tr>';
            if(ss.dtMin !== undefined) rhtml += '<tr><td>dt aralığı:</td><td style="text-align:right; font-weight:600; font-family:monospace;">' + ss.dtMin.toExponential(2) + ' → ' + ss.dtMax.toExponential(2) + ' s</td></tr>';
            if(ss.maxError !== undefined) rhtml += '<tr><td>Maks yerel hata:</td><td style="text-align:right; font-weight:600; font-family:monospace;">' + ss.maxError.toExponential(2) + '</td></tr>';
            if(ss.events && ss.events.length > 0) rhtml += '<tr><td>Algılanan olaylar:</td><td style="text-align:right; font-weight:600;">' + ss.events.length + '</td></tr>';
          }
          
          // Enerji dengesi (tüm yöntemler için)
          if(ss.energyError) {
            var ee = ss.energyError;
            var errColor = ee.error_pct < 0.1 ? '#22c55e' : ee.error_pct < 1.0 ? '#f59e0b' : '#ef4444';
            var errLabel = ee.error_pct < 0.1 ? 'Mükemmel' : ee.error_pct < 1.0 ? 'Kabul edilebilir' : 'Yüksek — adım sayısını artırın';
            rhtml += '<tr style="border-top:1px solid var(--border-color);"><td colspan="2" style="padding-top:6px; font-weight:600; color:var(--text-heading);">⚡ Enerji Dengesi</td></tr>';
            rhtml += '<tr><td>Hata:</td><td style="text-align:right; font-weight:700; color:' + errColor + ';">%' + ee.error_pct.toFixed(4) + '</td></tr>';
            rhtml += '<tr><td>Durum:</td><td style="text-align:right; font-weight:600; color:' + errColor + ';">' + errLabel + '</td></tr>';
            rhtml += '<tr><td>ΔKE:</td><td style="text-align:right; font-family:monospace;">' + (ee.deltaKE / 1000).toFixed(2) + ' kJ</td></tr>';
            rhtml += '<tr><td>Motor işi:</td><td style="text-align:right; font-family:monospace;">' + (ee.breakdown.W_engine / 1000).toFixed(2) + ' kJ</td></tr>';
            rhtml += '<tr><td>Yuvarlanma:</td><td style="text-align:right; font-family:monospace;">' + (ee.breakdown.W_rolling / 1000).toFixed(2) + ' kJ</td></tr>';
            rhtml += '<tr><td>Aerodinamik:</td><td style="text-align:right; font-family:monospace;">' + (ee.breakdown.W_aero / 1000).toFixed(2) + ' kJ</td></tr>';
            rhtml += '<tr><td>Eğim:</td><td style="text-align:right; font-family:monospace;">' + (ee.breakdown.W_grade / 1000).toFixed(2) + ' kJ</td></tr>';
          }
          
          // PCHIP spline bilgisi
          rhtml += '<tr style="border-top:1px solid var(--border-color);"><td>Tork interpolasyonu:</td><td style="text-align:right; font-weight:600;">PCHIP Spline</td></tr>';
          
          rhtml += '</table>';
          rhtml += '</div>';
        }
        
        rhtml += '<div style="font-size:0.72rem; color:var(--text-muted); text-align:center;">Sonuçlar sekmesinden detayları görüntüleyebilirsiniz.</div>';
        rhtml += '</div>';
        resultEl.innerHTML = rhtml;
        
        // Sonuçlar sayfasındaki grafik/tabloları güncelle
        for(var si = 0; si < 4; si++) {
          var slot = veResultSlots[si];
          if(slot && slot.sensors && slot.sensors.length > 0) {
            if(slot.type === 'line') veRenderChart(si);
            else veRenderTable(si);
          }
        }
        
        var _toastMsg = 'Hesaplama tamamlandı (' + simResult.time.length + ' nokta';
        if(ss.method === 'rk45') _toastMsg += ', ' + (ss.steps || 0) + ' iç adım';
        if(ss.energyError) _toastMsg += ', enerji hatası: %' + ss.energyError.error_pct.toFixed(4);
        _toastMsg += ')';
        showToast(_toastMsg, 'success');
        
      } catch(err) {
        progressFill.style.width = '100%';
        progressFill.style.background = 'var(--accent-danger)';
        progressText.textContent = 'HATA!';
        resultEl.innerHTML = '<div style="padding:16px; text-align:center; color:var(--accent-danger);"><div style="font-size:1.5rem; margin-bottom:8px;">❌</div><div style="font-weight:600;">Hesaplama Hatası</div><div style="font-size:0.72rem; margin-top:8px; color:var(--text-muted);">' + err.message + '</div></div>';
        showToast('Hesaplama hatası: ' + err.message, 'error');
      }
    }, 200);
  }, 100);
}

