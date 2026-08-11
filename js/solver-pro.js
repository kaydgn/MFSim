// PROFESYONEL SOLVER - ANSYS-TARZI HESAPLAMA MOTORU
// ============================================================================

// Çözücü logunda tek bir listenin basabileceği EN ÇOK satır sayısı.
// Her log() çağrısı DOM'a bir düğüm ekliyor; sınırsız liste tarayıcıyı kilitler.
// Gerçek vaka: vites salınımı 25.134 geçiş üretti, entegrasyon 0,728 s'de bitti
// ama satırların basılması 14+ SAAT sürdü (log zaman damgası 3,4 s → 51.639 s).
// Hesap doğru olsa bile kullanıcı bunu "program takıldı" olarak görüyor.
var VE_LOG_LIST_CAP = 300;

/**
 * Uzun bir listeyi loga basar ama VE_LOG_LIST_CAP satırında keser.
 * Kesilirse kaç satırın atlandığını söyler — sessizce kırpmaz.
 * @param {Array}    arr      basılacak kayıtlar
 * @param {function} logFn    log(mesaj, tip) — çağıranın kendi log fonksiyonu
 * @param {function} lineFn   (kayıt, indeks) → satır metni
 * @param {string}   whatNote kesme mesajında geçen açıklama (opsiyonel)
 */
function veLogCappedList(arr, logFn, lineFn, whatNote) {
  var n = arr.length;
  var shown = Math.min(n, VE_LOG_LIST_CAP);
  for(var i = 0; i < shown; i++) logFn(lineFn(arr[i], i));
  if(n > shown) {
    logFn('  … ' + (n - shown) + ' satır daha (toplam ' + n + ') — log okunabilirliği için gizlendi.', 'dim');
    if(whatNote) logFn('    ' + whatNote, 'dim');
  }
}

function veSolverRunProfessional() {
  // Tek modül — veActiveModule her zaman 'full-throttle'
  if(!veActiveModule) veActiveModule = 'full-throttle';

  // Modal oluştur
  var overlay = document.createElement('div');
  overlay.id = 've-solver-modal-overlay';
  // z-index, çözücü ayar penceresinin (.ve-properties-overlay = 100020) ÜSTÜNDE
  // olmalı — "Hesapla" bu penceresinin içinden çağrılıyor. Aksi halde simülasyon
  // penceresi ayar penceresinin arkasına düşer.
  overlay.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100vh;background:rgba(0,0,0,0.72);z-index:100050;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(2px);';
  
  var modal = document.createElement('div');
  modal.style.cssText = 'width:780px;max-width:94vw;max-height:58vh;background:var(--bg-primary);border:2px solid var(--border-color);border-radius:var(--radius-lg);box-shadow:0 4px 32px rgba(0,0,0,0.5);display:flex;flex-direction:column;overflow:hidden;';
  
  // Header — keskin, iç içe pencere
  var header = document.createElement('div');
  header.style.cssText = 'padding:8px 14px;background:var(--bg-secondary);border-bottom:2px solid var(--border-color);display:flex;align-items:center;justify-content:space-between;';
  header.innerHTML = '<div style="display:flex;align-items:center;gap:10px;">' +
    '<div style="display:flex;gap:3px;">' +
      '<span style="width:8px;height:8px;border-radius:1px;background:var(--bg-tertiary);border:1px solid var(--border-color);display:inline-block;"></span>' +
      '<span style="width:8px;height:8px;border-radius:1px;background:var(--bg-tertiary);border:1px solid var(--border-color);display:inline-block;"></span>' +
      '<span style="width:8px;height:8px;border-radius:1px;background:var(--bg-tertiary);border:1px solid var(--border-color);display:inline-block;"></span>' +
    '</div>' +
    '<div style="font-weight:700;font-size:var(--fs-md);color:var(--text-heading);letter-spacing:0.06em;text-transform:uppercase;">MFSim — Çözücü</div>' +
  '</div>' +
  '<div style="display:flex;align-items:center;gap:5px;">' +
    '<button id="ve-solver-log-dl" style="display:none;padding:3px 9px;font-size:var(--fs-micro);font-weight:600;background:transparent;border:1px solid var(--border-color);border-radius:1px;color:var(--text-muted);cursor:pointer;letter-spacing:0.03em;" onmouseover="this.style.borderColor=\'var(--accent-primary)\';this.style.color=\'var(--accent-primary)\'" onmouseout="this.style.borderColor=\'var(--border-color)\';this.style.color=\'var(--text-muted)\'"><span class="mf-ico mf-ico-download"></span> LOG</button>' +
    '<button id="ve-solver-modal-close" style="width:22px;height:22px;border-radius:1px;background:transparent;border:1px solid var(--border-color);color:var(--text-muted);cursor:pointer;font-size:var(--fs-tiny);display:none;" onclick="document.getElementById(\'ve-solver-modal-overlay\').remove()">✕</button>' +
  '</div>';
  modal.appendChild(header);
  
  // Progress bar — keskin panel
  var progressWrap = document.createElement('div');
  progressWrap.style.cssText = 'padding:8px 14px 6px;background:var(--bg-secondary);border-bottom:1px solid var(--border-color);';
  progressWrap.innerHTML = '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:5px;">' +
    '<span id="ve-sp-phase" style="font-size:var(--fs-body);font-weight:600;color:var(--text-heading);letter-spacing:0.02em;">Başlatılıyor...</span>' +
    '<span id="ve-sp-percent" style="font-size:var(--fs-body);font-weight:700;color:var(--accent-primary);font-family:Consolas,monospace;">0%</span>' +
  '</div>' +
  '<div style="width:100%;height:3px;background:var(--bg-tertiary);border:1px solid var(--border-color);border-radius:var(--radius-sm);overflow:hidden;">' +
    '<div id="ve-sp-bar" style="width:0%;height:100%;background:linear-gradient(90deg,#1b6a2a,#35a050);transition:width 0.3s ease;"></div>' +
  '</div>';
  modal.appendChild(progressWrap);
  
  // Log area — iç pencere (inset border)
  var logWrap = document.createElement('div');
  logWrap.style.cssText = 'flex:1;overflow-y:auto;margin:8px 14px 10px;background:var(--bg-tertiary);border:2px inset var(--border-color);border-radius:1px;padding:12px 16px;min-height:160px;max-height:36vh;';
  logWrap.innerHTML = '<div id="ve-sp-log" style="font-family:Consolas,\'Courier New\',monospace;font-size:var(--fs-body);line-height:1.65;color:var(--text-secondary);white-space:pre-wrap;"></div>';
  modal.appendChild(logWrap);
  
  overlay.appendChild(modal);
  document.body.appendChild(overlay);
  
  // Solver engine
  var logEl = document.getElementById('ve-sp-log');
  var barEl = document.getElementById('ve-sp-bar');
  var phaseEl = document.getElementById('ve-sp-phase');
  var pctEl = document.getElementById('ve-sp-percent');
  var closeBtn = document.getElementById('ve-solver-modal-close');
  var logDlBtn = document.getElementById('ve-solver-log-dl');
  var logArea = logWrap;
  
  // Log indirme yardımcı fonksiyonu
  function downloadLog() {
    var logContent = logEl.innerText || logEl.textContent || '';
    if(!logContent) return;
    var blob = new Blob([logContent], { type: 'text/plain;charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    var now2 = new Date();
    var prefix = 'MFSim_Log_';
    a.download = prefix + now2.getFullYear() + String(now2.getMonth()+1).padStart(2,'0') + String(now2.getDate()).padStart(2,'0') + '_' + String(now2.getHours()).padStart(2,'0') + String(now2.getMinutes()).padStart(2,'0') + '.txt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
  
  // logDlBtn'e her zaman onclick ata (button henüz gizli)
  if(logDlBtn) logDlBtn.onclick = downloadLog;
  
  var warnings = [];
  var errors = [];
  var startTime = performance.now();
  
  function setProgress(pct, phase) {
    barEl.style.width = pct + '%';
    pctEl.textContent = pct + '%';
    if(phase) phaseEl.textContent = phase;
  }
  
  function log(text, type) {
    var ts = ((performance.now() - startTime) / 1000).toFixed(2);
    var prefix = '[' + ts + 's] ';
    var color = 'var(--text-secondary)';
    if(type === 'ok') color = '#2e9e44';
    else if(type === 'warn') { color = '#c88a20'; warnings.push(text); }
    else if(type === 'err') { color = '#d04040'; errors.push(text); }
    else if(type === 'fatal') color = '#d04040';  // Kırmızı ama errors'a ekleme
    else if(type === 'head') color = 'var(--accent-primary)';
    else if(type === 'info') color = '#4a8fc0';
    else if(type === 'dim') color = 'var(--text-muted)';
    
    var line = document.createElement('div');
    line.style.color = color;
    if(type === 'head') line.style.fontWeight = '700';
    line.textContent = prefix + text;
    logEl.appendChild(line);
    logArea.scrollTop = logArea.scrollHeight;
  }
  
  function logSpacer() {
    var sp = document.createElement('div');
    sp.style.height = '6px';
    logEl.appendChild(sp);
  }
  
  // Step queue
  var steps = [];
  var stepIdx = 0;
  
  function addStep(fn) { steps.push(fn); }
  function runNext() {
    if(stepIdx < steps.length) {
      steps[stepIdx]();
      stepIdx++;
    }
  }
  function delay(ms) { return function(next) { setTimeout(next, ms); }; }
  
  // ====== ADIM 1: TOPOLOJİ KONTROLÜ ======
  addStep(function() {
    setProgress(5, 'Topoloji Kontrolü');
    log('═══════════════════════════════════════════', 'head');
    log('  ADIM 1/5 — TOPOLOJİ KONTROLÜ', 'head');
    log('═══════════════════════════════════════════', 'head');
    logSpacer();
    log('Topoloji haritası okunuyor...');
    setTimeout(runNext, 180);
  });
  
  addStep(function() {
    var totalNodes = nodes.length;
    var totalConns = connections.length;
    log('Toplam bileşen sayısı: ' + totalNodes);
    log('Toplam bağlantı sayısı: ' + totalConns);
    logSpacer();
    
    // Bileşen tipleri
    var typeCounts = {};
    nodes.forEach(function(n) {
      var label = n.def ? n.def.name : n.type;
      typeCounts[label] = (typeCounts[label] || 0) + 1;
    });
    log('Bileşen dağılımı:', 'info');
    Object.keys(typeCounts).forEach(function(k) {
      log('  • ' + k + ': ' + typeCounts[k] + ' adet', 'dim');
    });
    logSpacer();
    setTimeout(runNext, 200);
  });
  
  addStep(function() {
    setProgress(10);
    // Zorunlu bileşen kontrolü
    var hasEngine = nodes.some(function(n) { return n.type === 'engine'; });
    var hasVehicle = nodes.some(function(n) { return n.type === 'vehicle'; });
    var hasSolver = nodes.some(function(n) { return n.type === 'solver'; });
    var hasWheel = nodes.some(function(n) { return n.type === 'wheel'; });
    var hasRoad = nodes.some(function(n) { return n.type === 'road'; });
    var hasScenario = nodes.some(function(n) { return n.type === 'scenario'; });
    
    log('Zorunlu bileşen kontrolü:', 'info');
    log('  Motor         : ' + (hasEngine ? '✓ Bulundu' : '✗ EKSİK'), hasEngine ? 'ok' : 'err');
    log('  Araç          : ' + (hasVehicle ? '✓ Bulundu' : '✗ EKSİK'), hasVehicle ? 'ok' : 'err');
    log('  Tekerlek      : ' + (hasWheel ? '✓ Bulundu' : '✗ EKSİK'), hasWheel ? 'ok' : 'err');
    // Senaryo bileşeni zorunlu kontrolü
    var _mod = veGetActiveModule();
    var _scenarioRequired = _mod.requiredComponents && _mod.requiredComponents.indexOf('scenario') > -1;
    if(_scenarioRequired) {
      log('  Senaryo       : ' + (hasScenario ? '✓ Bulundu' : '✗ EKSİK — zorunlu bileşen'), hasScenario ? 'ok' : 'err');
    } else {
      if(hasScenario) log('  Senaryo       : ✓ Bulundu (opsiyonel)', 'dim');
    }
    if(hasRoad) log('  Yol           : ✓ Bulundu (opsiyonel)', 'dim');
    log('  Çözücü        : ' + (hasSolver ? '✓ Bulundu' : '✗ EKSİK'), hasSolver ? 'ok' : 'err');
    logSpacer();
    
    if(!hasEngine || !hasSolver) {
      log('KRİTİK: Motor ve Çözücü bileşenleri zorunludur!', 'err');
    }
    if(_scenarioRequired && !hasScenario) {
      log('KRİTİK: Senaryolar bileşeni bu modülde zorunludur!', 'err');
    }
    
    // Zincir kontrolü
    var chain = veGetPowertrainChain();
    if(chain && chain.length > 0) {
      var chainStr = chain.map(function(n) { return n.customName || n.def.name; }).join(' → ');
      log('Güç aktarma zinciri: ' + chainStr, 'ok');
      if(chain._isPartial) {
        log('  ⚠ Kısmi zincir tespit edildi (Sonlandırıcı mevcut)', 'warn');
      }
    } else {
      log('Güç aktarma zinciri oluşturulamadı!', 'err');
    }
    logSpacer();
    
    // TC ↔ Şanzıman bağlantısında Şanzıman Kontrol zorunluluğu
    if(veIsTCConnectedToGearbox()) {
      var hasShiftCtrl = nodes.some(function(n) { return n.type === 'shift-controller'; });
      log('Otomatik şanzıman kontrolü:', 'info');
      if(hasShiftCtrl) {
        log('  Şanzıman Kontrol : ✓ Bulundu', 'ok');
      } else {
        log('  Şanzıman Kontrol : ✗ EKSİK', 'err');
        log('  Tork Konvertörü şanzımana bağlı — Şanzıman Kontrol bileşeni zorunludur!', 'err');
      }
      logSpacer();
    }
    
    log('Topoloji kontrolü tamamlandı.', 'ok');
    logSpacer();
    setTimeout(runNext, 250);
  });
  
  // ====== ADIM 2: BİLEŞEN KONTROLÜ ======
  addStep(function() {
    setProgress(25, 'Bileşen Doğrulama');
    log('═══════════════════════════════════════════', 'head');
    log('  ADIM 2/5 — BİLEŞEN PARAMETRELERİ', 'head');
    log('═══════════════════════════════════════════', 'head');
    logSpacer();
    setTimeout(runNext, 150);
  });
  
  addStep(function() {
    // Motor
    var eng = nodes.find(function(n) { return n.type === 'engine'; });
    if(eng) {
      var ed = eng.data || {};
      var rows = ed.torqueData || [];
      log('[Motor] ' + (eng.customName || 'Motor'), 'info');
      log('  Tork verisi     : ' + rows.length + ' satır' + (rows.length >= 2 ? '' : ' ⚠ En az 2 satır gerekli'), rows.length >= 2 ? 'ok' : 'err');
      log('  Motor verimi    : ' + (ed.verim || 100) + '%', 'dim');
      log('  Governed RPM    : ' + (ed.governedRpm || 2100) + ' d/d', 'dim');
      // Aksesuar kayıpları
      if(veActiveModule === 'full-throttle') {
        var _acc = ed.accessories || [];
        var _fanL = 0, _otherL = 0;
        _acc.forEach(function(a) {
          var l = parseFloat(a.userLoss) || 0;
          if(l <= 0) return;
          if(a.name && a.name.toLowerCase().indexOf('fan') >= 0) _fanL += l;
          else _otherL += l;
        });
        if(_fanL + _otherL > 0) {
          log('  Aksesuar kayıp  : Fan=' + _fanL.toFixed(1) + ' kW, Diğer=' + _otherL.toFixed(1) + ' kW (toplam ' + (_fanL + _otherL).toFixed(1) + ' kW @ governed)', 'ok');
          _acc.forEach(function(a) {
            if((parseFloat(a.userLoss) || 0) > 0) log('    • ' + a.name + ': ' + a.userLoss + ' kW', 'dim');
          });
          log('  » NET motor torku kullanılıyor (brüt − aksesuar)', 'dim');
        } else {
          log('  Aksesuar kayıp  : Tanımsız — brüt motor torku kullanılacak', 'warn');
        }
      }
    }
    logSpacer();
    
    // Şanzıman
    var gb = nodes.find(function(n) { return n.type === 'gearbox'; });
    if(gb) {
      var gd = gb.data || {};
      log('[Şanzıman] ' + (gb.customName || 'Şanzıman'), 'info');
      if(veActiveModule === 'full-throttle') {
        var ftGears = gd.ftGearData || VE_FT_GB_DEFAULT_GEARS;
        var fwd = ftGears.filter(function(g) { return g.name && g.name.charAt(0) === 'F'; });
        var rev = ftGears.filter(function(g) { return g.name && g.name.charAt(0) === 'R'; });
        log('  İleri vites     : ' + fwd.length + ' adet', fwd.length > 0 ? 'ok' : 'err');
        log('  Geri vites      : ' + rev.length + ' adet', 'dim');
        log('  Shift profili   : ' + (gd.shiftProfile || 'allison3200sp_s1'), 'dim');
        // Shift Ref. RPM bilgisi
        var spLog = VE_FT_SHIFT_PROFILES[gd.shiftProfile || 'allison3200sp_s1'] || {};
        var logRefRPM = spLog.shiftRefRPM || gd.shiftRefRPM || null;
        if(logRefRPM) {
          log('  Shift Ref. RPM  : ' + logRefRPM + ' (kullanıcı tanımlı)', 'dim');
        } else {
          // governed speed'i bul
          var engN = nodes.find(function(n) { return n.type === 'engine'; });
          var engSp = engN ? ((engN.data || {}).motorSpecs || {}) : {};
          var govLog = parseFloat(engSp.governedSpeed) || parseFloat((engN || {}).data ? engN.data.governedRpm : 0) || 0;
          if(govLog) log('  Shift Ref. RPM  : ' + govLog + ' (motor governed)', 'dim');
        }
        var spLogData = VE_FT_SHIFT_PROFILES[gd.shiftProfile || 'allison3200sp_s1'] || {};
        var refForLog = logRefRPM || (function(){ var eN = nodes.find(function(n){return n.type==='engine';}); return eN ? (parseFloat(((eN.data||{}).motorSpecs||{}).governedSpeed)||parseFloat((eN.data||{}).governedRpm)||0) : 0; })();
        var _hasTCNode = nodes.some(function(n){ return n.type === 'torque-converter'; });
        if(refForLog && (spLogData.lockupOffset || spLogData.lockupShifts)) {
          // Converter geçişleri — YALNIZ TK varsa (TK yoksa converter fazı yok, gösterme)
          if(_hasTCNode && spLogData.converterShifts) {
            var csLog = spLogData.converterShifts;
            if(csLog['1C2C']) {
              var thr1C = csLog['1C2C'].a * refForLog + (csLog['1C2C'].b || 0);
              log('  1C→2C eşik      : N_out = ' + Math.round(thr1C) + ' (' + csLog['1C2C'].a + '×' + refForLog + '+' + (csLog['1C2C'].b || 0) + ')', 'dim');
            }
            if(csLog['2C2L']) {
              var cs2L = csLog['2C2L'];
              if(cs2L.type === 'segmented') {
                var thr2L = cs2L.linear.a * refForLog + cs2L.linear.b;
                log('  2C→2L eşik      : N_out = ' + Math.round(thr2L) + ' (' + cs2L.linear.a + '×' + refForLog + '+' + cs2L.linear.b + ', ESL≥' + cs2L.linear.validFrom + ')', 'dim');
                if(cs2L.lookup) log('  2C→2L lookup    : ' + cs2L.lookup.map(function(p) { return p[0] + '→' + p[1]; }).join(', '), 'dim');
              } else {
                var thr2Ls = (cs2L.a || 0) * refForLog + (cs2L.b || 0);
                log('  2C→2L eşik      : N_out = ' + Math.round(thr2Ls) + ' (' + (cs2L.a || 0) + '×' + refForLog + '+' + (cs2L.b || 0) + ')', 'dim');
              }
            }
          } else if(_hasTCNode) {
            if(spLogData.shift1C2C_outRatio) log('  1C→2C eşik      : N_out = ' + Math.round(spLogData.shift1C2C_outRatio * refForLog) + ' (' + spLogData.shift1C2C_outRatio + ' × ' + refForLog + ')', 'dim');
            if(spLogData.shift2C2L_outRatio) log('  2C→2L eşik      : N_out = ' + Math.round(spLogData.shift2C2L_outRatio * refForLog) + ' (' + spLogData.shift2C2L_outRatio + ' × ' + refForLog + ')', 'dim');
          }
          if(spLogData.lockupShifts) {
            log('  ' + (_hasTCNode ? 'Lockup geçişleri' : 'Vites geçiş eşik.') + ': N_out = a × ESL + b (per-gear kalibrasyon)', 'dim');
            Object.keys(spLogData.lockupShifts).forEach(function(sk) {
              var ls = spLogData.lockupShifts[sk];
              var thr = (typeof calcLockupShiftThreshold === 'function') ? calcLockupShiftThreshold(ls, refForLog) : (ls.a * refForLog + (ls.b || 0));
              var label = sk.replace(/(\d+L)(\d+L)/, '$1→$2');
              if(!_hasTCNode) label = label.replace(/L/g, '');  // TK yok → salt vites no
              var detail = '';
              if(ls.type === 'segments') { detail = 'segments'; }
              else if(ls.type === 'piecewise') { detail = 'piecewise'; }
              else { detail = ls.a + '×' + refForLog + (ls.b >= 0 ? '+' : '') + ls.b; if(ls.capValue !== undefined) detail += ', cap=' + ls.capValue + '<' + ls.capBelow; else if(ls.minCap !== undefined) detail += ', cap=' + ls.minCap; }
              log('    ' + label + ': N_out ≥ ' + thr.toFixed(1) + ' (' + detail + ')', 'dim');
            });
          } else {
            log('  ' + (_hasTCNode ? 'Lockup shift    ' : 'Vites shift     ') + ': ' + (refForLog - spLogData.lockupOffset) + ' rpm (ref - ' + spLogData.lockupOffset + ')', 'dim');
          }
        }
        fwd.forEach(function(g) {
          log('    ' + g.name + ': i=' + g.ratio + ', η=' + g.eff + '%' + (_hasTCNode ? (', ' + (g.lockup ? 'Lockup' : 'Converter')) : ''), 'dim');
        });
      } else {
        var gears = gd.gearData || [];
        log('  Vites sayısı    : ' + gears.length, gears.length > 0 ? 'ok' : 'warn');
        log('  Seçili vites    : ' + (gd.selectedGear || 'Belirtilmemiş'), gd.selectedGear ? 'ok' : 'warn');
        log('  Aktif oran      : ' + (gd.selectedGearRatio || '—'));
        log('  Verim           : ' + (gd.efficiency || 98) + '%', 'dim');
      }
    }
    logSpacer();
    
    // Tork konvertörü
    var tc = nodes.find(function(n) { return n.type === 'torque-converter'; });
    if(tc) {
      var td = tc.data || {};
      log('[Tork Konvertörü] ' + (tc.customName || 'TC'), 'info');
      if(veActiveModule === 'full-throttle') {
        var tcArr = td.tcData || [];
        log('  TC verisi       : ' + tcArr.length + ' nokta', tcArr.length >= 2 ? 'ok' : 'warn');
        log('  Pump torque drop: ' + (td.pumpTorqueDrop !== undefined ? td.pumpTorqueDrop : 17.6) + ' Nm', 'dim');
        if(tcArr.length < 2) log('  ⚠ TC verisi eksik veya yetersiz', 'warn');
      } else {
        log('  Kilitli         : ' + (td.isLocked ? 'Evet (1:1)' : 'Hayır'), 'dim');
        log('  TC oranı        : ' + (td.tcRatio || 1.0), 'dim');
      }
    }
    
    // Propşaft
    var psNodes = nodes.filter(function(n) { return n.type === 'propshaft'; });
    if(psNodes.length > 0) {
      psNodes.forEach(function(ps, idx) {
        var psd = ps.data || {};
        log('[Propşaft' + (psNodes.length > 1 ? ' ' + (idx+1) : '') + '] ' + (ps.customName || (psd.psName || 'Propşaft')), 'info');
        log('  Oran            : 1.000 (geçiş mili)', 'dim');
        log('  Verim           : ' + (psd.psEff || 98.60) + '%', 'dim');
        log('  Atalet          : ' + (psd.psInertia || 0.5) + ' kg·m²', 'dim');
      });
    }
    
    // Transfer
    var tr = nodes.find(function(n) { return n.type === 'transfer'; });
    if(tr) {
      var trd = tr.data || {};
      log('[Transfer] ' + (tr.customName || 'Transfer Kutusu'), 'info');
      if(veActiveModule === 'full-throttle') {
        var ftTrG = trd.ftTrGears || [
          { kademe: 'High', ratio: 1.054, eff: 97.00 },
          { kademe: 'Low', ratio: 2.337, eff: 97.00 }
        ];
        log('  Kademe sayısı   : ' + ftTrG.length, 'ok');
        ftTrG.forEach(function(g) {
          log('    ' + g.kademe + ': i=' + (g.ratio || g.oran) + ', η=' + (g.eff || g.verim) + '%', 'dim');
        });
        log('  » Her kademe için ayrı hesap yapılacak', 'dim');
      } else {
        log('  Aktif kademe    : ' + (trd.selectedMode || 'Belirtilmemiş'), trd.selectedMode ? 'ok' : 'warn');
        log('  Aktif oran      : ' + (trd.selectedRatio || '—'));
      }
    }
    
    // Diferansiyel
    var allDiffs = nodes.filter(function(n) { return n.type === 'differential'; });
    if(allDiffs.length > 0) {
      allDiffs.forEach(function(diff, idx) {
        var dd = diff.data || {};
        var masterLabel = diff.isMasterDiff ? ' ★ MASTER' : (allDiffs.length > 1 ? ' (SLAVE)' : '');
        log('[Diferansiyel' + (allDiffs.length > 1 ? ' ' + (idx+1) : '') + masterLabel + '] ' + (diff.customName || 'Diferansiyel'), 'info');
        if(diff.isMasterDiff || allDiffs.length === 1) {
          log('  Oran            : ' + (dd.diffRatio || 6.54), dd.diffRatio ? 'ok' : 'warn');
          if(!dd.diffRatio) log('  ⚠ diffRatio undefined — varsayılan 6.54 kullanılacak', 'warn');
        } else {
          log('  Bu diferansiyel semboliktir, parametreler Master\'dan okunur.', 'dim');
        }
      });
    }
    logSpacer();
    setTimeout(runNext, 300);
  });
  
  // ====== ADIM 3: GİRDİ DOĞRULAMA ======
  addStep(function() {
    setProgress(45, 'Girdi Doğrulama');
    log('═══════════════════════════════════════════', 'head');
    log('  ADIM 3/5 — GİRDİ DOĞRULAMA', 'head');
    log('═══════════════════════════════════════════', 'head');
    logSpacer();
    setTimeout(runNext, 150);
  });
  
  addStep(function() {
    // Araç parametreleri
    var veh = nodes.find(function(n) { return n.type === 'vehicle'; });
    if(veh) {
      var vd = veh.data || {};
      log('[Araç parametreleri]', 'info');
      if(veActiveModule === 'full-throttle') {
        // FT mod alanları
        var mass = parseFloat(vd.ftGVW);
        var cd = parseFloat(vd.ftCd) || 0.900;
        var h = parseFloat(vd.ftHeight) || 3.2;
        var w = parseFloat(vd.ftWidth) || 2.5;
        var rho = parseFloat(vd.ftRho) || 1.225;
        log('  Araç ağırlığı   : ' + (mass || '—') + ' kg', mass > 0 ? 'ok' : 'err');
        log('  Cd              : ' + cd, 'dim');
        log('  Frontal alan    : ' + (h * w).toFixed(2) + ' m² (' + h + '×' + w + ')', 'dim');
        log('  Hava yoğunluğu  : ' + rho + ' kg/m³', 'dim');
        log('  Başlangıç hızı  : 0 km/h (sabit — tam gaz kalkış)', 'dim');
        if(!mass || mass <= 0) log('  ✗ Araç ağırlığı (GVW) girişi gerekli!', 'err');
      } else {
        // Diğer mod alanları
        var mass = parseFloat(vd.mass);
        var speed = parseFloat(vd.initialSpeed);
        log('  Araç ağırlığı   : ' + (mass || '—') + ' kg', mass > 0 ? 'ok' : 'err');
        log('  İlk hız         : ' + (speed || '—') + ' km/h', speed >= 0 ? 'ok' : 'err');
        log('  Cd              : ' + (vd.cd || 0.65), 'dim');
        log('  Frontal alan    : ' + (vd.frontalArea || 6.7) + ' m²', 'dim');
        if(!mass || mass <= 0) log('  ✗ Araç ağırlığı girişi gerekli!', 'err');
        if(speed === undefined || speed === '' || isNaN(speed)) log('  ✗ İlk hız girişi gerekli!', 'err');
      }
    } else {
      log('[Araç parametreleri] — Araç bileşeni bulunamadı', 'err');
    }
    logSpacer();
    
    // Tekerlek
    var wh = nodes.find(function(n) { return n.type === 'wheel'; });
    if(wh) {
      var wd = wh.data || {};
      log('[Tekerlek parametreleri]', 'info');
      if(veActiveModule === 'full-throttle') {
        var r = parseFloat(wd.ftTireRadius) || 0.573;
        var crr = parseFloat(wd.ftCrr) || 0.0035;
        var sf = parseFloat(wd.ftSurfaceFactor) || 1.00;
        log('  Dinamik yarıçap : ' + r + ' m', 'ok');
        log('  Crr (nominal)   : ' + crr, 'dim');
        log('  Crr hız modeli  : Aktif (iSCAAN evrensel düzeltme)', 'dim');
        var f50 = FT_SOLVER.getCrrEffective(crr, 50/3.6);
        var f100 = FT_SOLVER.getCrrEffective(crr, 100/3.6);
        log('    @ 0 km/h      : ' + crr.toFixed(5) + ' (×1.000)', 'dim');
        log('    @ 50 km/h     : ' + f50.toFixed(5) + ' (×' + (f50/crr).toFixed(3) + ')', 'dim');
        log('    @ 100 km/h    : ' + f100.toFixed(5) + ' (×' + (f100/crr).toFixed(3) + ')', 'dim');
        log('  Yüzey faktörü   : ' + sf, 'dim');
      } else {
        log('  Yarıçap         : ' + (wd.wheelRadius || 0.60876) + ' m', 'ok');
        var mfCrr = parseFloat(wd.rollingResistance) || 0.010;
        log('  Crr (nominal)   : ' + mfCrr, 'dim');
        log('  Crr hız modeli  : Aktif (iSCAAN evrensel düzeltme)', 'dim');
        log('  δ (döner kütle) : ' + (wd.rotatingMass || 1.08), 'dim');
      }
      var rCheck = veActiveModule === 'full-throttle' ? parseFloat(wd.ftTireRadius) : parseFloat(wd.wheelRadius);
      if(rCheck && (rCheck < 0.1 || rCheck > 2)) {
        log('  ⚠ Tekerlek yarıçapı olağandışı: ' + rCheck + ' m', 'warn');
      }
    }
    logSpacer();
    
    // Yol parametreleri
    var road = nodes.find(function(n) { return n.type === 'road'; });
    if(road) {
      var rd = road.data || {};
      log('[Yol/Arazi parametreleri]', 'info');
      log('  Eğim modu       : ' + (rd.egimMode === 'segment' ? 'Segment bazlı' : 'Manuel'), 'dim');
      if(rd.egimMode === 'segment' && rd.routeSegments && rd.routeSegments.length > 0) {
        var segs = rd.routeSegments;
        var totalD = 0; segs.forEach(function(s) { totalD += s.mesafe; });
        var minE = 0, maxE = 0;
        segs.forEach(function(s) { if(s.egim > maxE) maxE = s.egim; if(s.egim < minE) minE = s.egim; });
        log('  Segment sayısı  : ' + segs.length, 'ok');
        log('  Toplam mesafe   : ' + (totalD/1000).toFixed(2) + ' km', 'ok');
        log('  Eğim aralığı   : %' + minE.toFixed(1) + ' ... %' + maxE.toFixed(1), 'ok');
        log('  ─── Segment detayları ───', 'dim');
        var cumD = 0;
        segs.forEach(function(s, i) {
          cumD += s.mesafe;
          var icon = s.egim > 1 ? '↓' : (s.egim < -1 ? '↑' : '→');
          log('    [' + (i+1) + '] ' + s.mesafe.toFixed(0) + 'm  %' + s.egim.toFixed(1) + ' ' + icon + '  (kümülatif: ' + (cumD/1000).toFixed(2) + ' km)', 'dim');
        });
        log('  » Dinamik eğim aktif: her adımda mesafeye göre eğim güncellenir', 'head');
      } else if(rd.egimMode !== 'segment') {
        var grade = parseFloat(rd.grade);
        log('  Arazi eğimi     : ' + (grade || 0) + '%', grade !== undefined && grade !== '' ? 'ok' : 'warn');
      }
      log('  Yükseklik       : ' + (rd.altitude || '—') + ' m', 'dim');
      log('  Sıcaklık        : ' + (rd.temperature || '—') + ' °C', 'dim');
      log('  Hava yoğunluğu  : ' + (rd.airDensity || 'Hesaplanmadı') + ' kg/m³', rd.airDensity ? 'ok' : 'warn');
    }
    logSpacer();
    
    // Çözücü parametreleri
    var solver = nodes.find(function(n) { return n.type === 'solver'; });
    if(solver) {
      var sd = solver.data || {};
      log('[Çözücü parametreleri]', 'info');
      if(veActiveModule === 'full-throttle') {
        // FT mod
        var ftMLabel = sd.method === 'heun' ? 'Heun (2. derece)' : sd.method === 'euler' ? 'Euler (1. derece)' : sd.method === 'ralston' ? 'Ralston (2. derece)' : sd.method === 'rk45' ? 'RK45 Dormand-Prince (adaptif)' : 'RK4 (4. derece)';
        log('  Mod             : Tam Gaz Hızlanma (V=0 → Maks Hız)', 'dim');
        log('  Yöntem          : ' + ftMLabel, 'dim');
        if(sd.method === 'rk45') {
          log('  Adım boyutu     : Adaptif (Dormand-Prince)', 'dim');
          log('  ATol / RTol     : ' + (sd.ftAtol || 1e-6) + ' / ' + (sd.ftRtol || 1e-4), 'dim');
        } else {
          log('  Δt              : ' + (sd.ftDt || 0.01) + ' s — sabit', 'dim');
        }
        log('  Güvenlik limiti : ' + (sd.maxSimTime || (typeof VE_DEFAULT_MAX_SIM_TIME !== 'undefined' ? VE_DEFAULT_MAX_SIM_TIME : 300)) + ' s', 'dim');
        log('  Bitiş koşulu   : F_net ≤ 0 (son vites, çekiş = direnç)', 'dim');
        log('  Tork interpol.  : PCHIP Spline (C¹ sürekli)', 'dim');
      } else {
        // Diğer mod
        var mLabel = sd.method === 'heun' ? 'Heun (2. derece)' : sd.method === 'rk4' ? 'RK4 (4. derece)' : sd.method === 'rk45' ? 'RK45 Dormand-Prince (adaptif)' : sd.method === 'ralston' ? 'Ralston (2. derece)' : 'Basit Euler';
        var simTime = sd.timeMode === 'stop' ? (sd.maxSimTime || 300) : (sd.duration || 60);
        var res = sd.resolution || 200;
        var dtCalc = (simTime / res).toFixed(4);
        log('  Zaman modu      : ' + (sd.timeMode === 'stop' ? 'Durma analizi' : 'Belirli süre'), 'dim');
        log('  Simülasyon süresi: ' + simTime + ' s', 'dim');
        if(sd.method === 'rk45') {
          log('  Çıktı noktası   : ' + res, 'dim');
          log('  ATol / RTol     : ' + (sd.atol || 1e-6) + ' / ' + (sd.rtol || 1e-4), 'dim');
        } else {
          log('  Çözünürlük      : ' + res + ' adım', 'dim');
          log('  Δt (hesaplanan) : ' + dtCalc + ' s', 'dim');
        }
        log('  Yöntem          : ' + mLabel, 'dim');
        log('  Tork interpol.  : PCHIP Spline (C¹ sürekli)', 'dim');
      
        // Segment bazlı modda RK45 uyarısı
        var _roadCheck = nodes.find(function(n) { return n.type === 'road'; });
        if(_roadCheck && _roadCheck.data && _roadCheck.data.egimMode === 'segment' && sd.method === 'rk45') {
          log('  ⚠ Segment bazlı modda RK45 → RK4 olarak çalıştırılacak', 'warn');
          log('    (Mesafe takibi gerektiğinden adaptif adım kullanılamaz)', 'dim');
        }
      
        if(sd.timeMode === 'stop') {
          log('  Durma eşiği     : ' + (sd.stopSpeed || 2) + ' km/h', 'dim');
        }
      }
    }
    logSpacer();
    setTimeout(runNext, 300);
  });
  
  // ====== ADIM 4: SENSÖR KONTROLÜ ======
  addStep(function() {
    setProgress(60, 'Sensör Kontrolü');
    log('═══════════════════════════════════════════', 'head');
    log('  ADIM 4/5 — SENSÖR KONTROLÜ', 'head');
    log('═══════════════════════════════════════════', 'head');
    logSpacer();
    
    var sensors = nodes.filter(function(n) { return n.type === 'sensor'; });
    if(sensors.length === 0) {
      log('Topolojide sensör bulunmadı.', 'dim');
      log('  (Sensörler opsiyoneldir, simülasyon çalışır)', 'dim');
    } else {
      log('Toplam sensör sayısı: ' + sensors.length, 'info');
      logSpacer();
      sensors.forEach(function(s, idx) {
        var sd = s.data || {};
        var sName = s.customName || ('Sensör-' + (idx+1));
        var signal = sd.signalName || sd.signal || '—';
        var unit = sd.signalUnit || '';
        var attached = sd.attachedConnection || sd.attachedComponent || null;
        
        log('[Sensör ' + (idx+1) + '] ' + sName, 'info');
        log('  Sinyal          : ' + signal + (unit ? ' [' + unit + ']' : ''), 'dim');
        if(attached) {
          // Bağlı olduğu bileşeni bul
          var sourceConn = connections.find(function(c) { return c.id === sd.attachedConnection; });
          var sourceNodeId = sourceConn ? sourceConn.from : sd.attachedComponent;
          var sourceNode = sourceNodeId ? nodes.find(function(n) { return n.id === sourceNodeId; }) : null;
          var sourceName = sourceNode ? (sourceNode.customName || sourceNode.def.name) : '?';
          log('  Kaynak bileşen  : ' + sourceName, 'ok');
        } else {
          log('  Kaynak bileşen  : Bağlantı yok', 'warn');
        }
      });
    }
    logSpacer();
    setTimeout(runNext, 250);
  });
  
  // ====== ADIM 5: SİMÜLASYON ======
  addStep(function() {
    setProgress(70, 'Simülasyon Çalıştırılıyor');
    log('═══════════════════════════════════════════', 'head');
    log('  ADIM 5/5 — SAYISAL ENTEGRASYON', 'head');
    log('═══════════════════════════════════════════', 'head');
    logSpacer();
    
    if(errors.length > 0) {
      log('KRİTİK HATA SAYISI: ' + errors.length, 'fatal');
      log('Simülasyon başlatılamıyor. Lütfen hataları düzeltin.', 'fatal');
      logSpacer();
      setProgress(100, 'Hata — Tamamlanamadı');
      barEl.style.background = 'linear-gradient(90deg,#c62828,#f44336)';
      
      log('═══════════════════════════════════════════', 'fatal');
      log('  ÇÖZÜM BAŞARISIZ — ' + errors.length + ' kritik hata', 'fatal');
      log('═══════════════════════════════════════════', 'fatal');
      
      closeBtn.style.display = '';
      if(logDlBtn) logDlBtn.style.display = '';
      return;
    }
    
    log('Entegrasyon motoru başlatılıyor...', 'dim');
    setTimeout(runNext, 200);
  });
  
  addStep(function() {
    setProgress(75);
    var solver = nodes.find(function(n) { return n.type === 'solver'; });
    var sd = solver ? (solver.data || {}) : {};
    
    if(veActiveModule === 'full-throttle') {
      var ftMaxTime = parseFloat(sd.maxSimTime) || (typeof VE_DEFAULT_MAX_SIM_TIME !== 'undefined' ? VE_DEFAULT_MAX_SIM_TIME : 300);
      // Yöntem ve Δt SABİT yazılıyordu ('RK4 | Δt = 0.01 s'), oysa motor
      // (ft-performance.js) gerçekte sd.method / sd.ftDt okuyor. Kullanıcı RK45
      // seçtiğinde bile log "RK4" diyordu → takılma teşhisi yanlış yöne gidiyordu.
      // Tek doğruluk kaynağı: çözücü düğümünün kendi verisi.
      var ftMethodLabel = sd.method === 'heun' ? 'Heun'
                        : sd.method === 'rk45' ? 'RK45 (adaptif)'
                        : sd.method === 'ralston' ? 'Ralston'
                        : sd.method === 'euler' ? 'Euler'
                        : 'RK4';
      var ftDtShown = parseFloat(sd.ftDt) || 0.01;
      log('Yöntem: ' + ftMethodLabel + ' | Δt = ' + ftDtShown + ' s | Güvenlik limiti: ' + ftMaxTime + ' s');
      log('Mod: Tam Gaz Hızlanma — V=0 → Maks Hız (F_net ≤ 0)');
    } else {
    var mLabel = sd.method === 'heun' ? 'Heun' : sd.method === 'rk4' ? 'RK4' : sd.method === 'rk45' ? 'RK45 (adaptif)' : sd.method === 'ralston' ? 'Ralston' : 'Euler';
    var simTime = sd.timeMode === 'stop' ? (sd.maxSimTime || 300) : (sd.duration || 60);
    var res = sd.resolution || 200;
    
    var _segRoad = nodes.find(function(n) { return n.type === 'road'; });
    var _isSegMode = _segRoad && _segRoad.data && _segRoad.data.egimMode === 'segment' && _segRoad.data.routeSegments;
    
    log('Yöntem: ' + mLabel + ' | ' + (sd.method === 'rk45' ? 'Çıktı: ' + res + ' nokta' : 'Adım: ' + res) + ' | Süre: ' + simTime + 's');
    if(_isSegMode) {
      log('Segment bazlı dinamik eğim aktif (' + _segRoad.data.routeSegments.length + ' segment)', 'head');
      var _totalRouteDist = 0;
      _segRoad.data.routeSegments.forEach(function(s) { _totalRouteDist += s.mesafe; });
      var _vehicle = nodes.find(function(n) { return n.type === 'vehicle'; });
      var _v0 = (_vehicle && _vehicle.data) ? (parseFloat(_vehicle.data.initialSpeed) || 60) : 60;
      var _estTime = _totalRouteDist / (_v0 / 3.6);
      log('  Güzergah mesafesi: ' + (_totalRouteDist/1000).toFixed(2) + ' km, Tahmini süre: ~' + _estTime.toFixed(0) + ' s', 'dim');
      if(sd.timeMode !== 'stop' && simTime < _estTime * 0.8) {
        log('  ⚠ Simülasyon süresi güzergahı tamamlamak için yetersiz olabilir!', 'warn');
        log('    Önerilen süre: ' + Math.ceil(_estTime * 1.3) + ' s veya "Durma Analizi" kullanın', 'warn');
      }
    }
    } // end validation
    log('Hesap başlıyor...');
    logSpacer();
    
    setTimeout(function() {
      setProgress(85);
      
      try {
        var t0 = performance.now();
        var simResult;
        if(veActiveModule === 'full-throttle') {
          // ── SOLVER NODE VE SENARYO VERİLERİ ──
          var _solverNode = nodes.find(function(n) { return n.type === 'solver'; });
          var _solverData = _solverNode ? (_solverNode.data || {}) : {};
          var _scenarioNode = nodes.find(function(n) { return n.type === 'scenario'; });
          var _scenData = _scenarioNode ? (_scenarioNode.data || {}) : {};
          var _hasPerfAnalysis = _solverData.performanceAnalysis !== false; // varsayılan açık
          var _hasSegDrive = _solverData.accelDecelAnalysis && _scenData.roadSegments && _scenData.roadSegments.length > 0;

          // ── 1) PERFORMANS ANALİZİ (Tam Gaz Hızlanma — her zaman çalışır) ──
          var _trNode = nodes.find(function(n) { return n.type === 'transfer'; });
          var _trd = _trNode ? (_trNode.data || {}) : {};
          var _ftTrGears = _trd.ftTrGears || [
            { kademe: 'High', ratio: 1.054, eff: 97.00 },
            { kademe: 'Low', ratio: 2.337, eff: 97.00 }
          ];

          var allRangeResults = {};
          _ftTrGears.forEach(function(g) {
            allRangeResults[g.kademe] = veFTRunSimulationEngine(g.kademe);
          });

          simResult = allRangeResults[_ftTrGears[0].kademe];
          window._veFTAllRangeResults = allRangeResults;
          window._veFTTransferGears = _ftTrGears;

          // ── 2) SEGMENT BAZLI SÜRÜŞ (Hızlanma-Yavaşlama — opsiyonel) ──
          if(_hasSegDrive) {
            var _segInitSpeed = parseFloat(_scenData.segInitSpeed) || 0;
            // Tüm transfer kademeleri için ayrı hesap
            var segDriveAllRanges = {};
            _ftTrGears.forEach(function(g) {
              segDriveAllRanges[g.kademe] = veFTRunSegmentDrive(_scenData.roadSegments, _segInitSpeed, g.kademe);
            });
            // İlk kademeyi ana sonuç olarak kullan
            simResult.segmentDrive = segDriveAllRanges[_ftTrGears[0].kademe];
            simResult.segmentDriveAllRanges = segDriveAllRanges;
            simResult.segmentDriveTransferGears = _ftTrGears;
            // Orijinal segment girdi verisini sakla (TXT raporu için)
            simResult.segmentDriveInputSegments = _scenData.roadSegments.map(function(s) {
              var seg = { no: s.no, grade: s.grade, distance: s.distance, deltaH: s.deltaH, command: s.command || 'full_throttle' };
              if(s.startWaypoint) seg.startWaypoint = s.startWaypoint;
              if(s.endWaypoint) seg.endWaypoint = s.endWaypoint;
              return seg;
            });
            // Waypoint bilgisini de sakla
            if(_scenData.routeWaypoints) {
              simResult.routeWaypoints = _scenData.routeWaypoints;
            }
            // Rapor zaman adımı
            simResult.sdReportInterval = parseFloat(_solverData.sdReportInterval) || 0.5;
          }

          // ── 3) ENGEL ATLAMA ANALİZİ (opsiyonel — obstacle-crossing bileşeni gerektirir) ──
          var _obsNode = nodes.find(function(n) { return n.type === 'obstacle-crossing'; });
          var _hasObsCross = _solverData.obstacleCrossingAnalysis && _obsNode;
          if(_hasObsCross) {
            var obsData = _obsNode.data || {};
            // Transfer kademeleri — her biri icin ayri statik + dinamik analiz
            var _obsTrNode = nodes.find(function(n) { return n.type === 'transfer'; });
            var _obsTrd = _obsTrNode ? (_obsTrNode.data || {}) : {};
            var _obsFtTrGears = _obsTrd.ftTrGears || [
              { kademe: 'High', ratio: 1.054, eff: 97.00 },
              { kademe: 'Low', ratio: 2.337, eff: 97.00 }
            ];
            var _obsByTransfer = [];
            for(var _oti = 0; _oti < _obsFtTrGears.length; _oti++) {
              var _oTrObsData = {};
              for(var _k in obsData) { if(obsData.hasOwnProperty(_k)) _oTrObsData[_k] = obsData[_k]; }
              _oTrObsData.transferIdx = _oti;
              var _obsCrossRes_i = veFTRunObstacleCrossingAnalysis(_oTrObsData);
              var _obsDynRes_i = null;
              if(_obsCrossRes_i && _obsCrossRes_i.stallAnalysis && _obsCrossRes_i.stallAnalysis.hasData && !_obsCrossRes_i.geometryFail) {
                try {
                  var _dynOpts_i = {};
                  if(_solverData.obsLogInterval) _dynOpts_i.logInterval = parseFloat(_solverData.obsLogInterval);
                  _obsDynRes_i = veFTRunObstacleDynamicSim(_obsCrossRes_i, _dynOpts_i);
                } catch(e) {
                  _obsDynRes_i = { success: false, reason: 'Dinamik simulasyon hatasi: ' + e.message };
                }
              }
              _obsByTransfer.push({
                kademe: _obsFtTrGears[_oti].kademe || ('Kademe ' + (_oti + 1)),
                ratio: parseFloat(_obsFtTrGears[_oti].ratio) || 1,
                eff: parseFloat(_obsFtTrGears[_oti].eff) || 97,
                obstacleCrossing: _obsCrossRes_i,
                obstacleDynamic: _obsDynRes_i
              });
            }
            // Varsayilan olarak son kademe (Low) ana sonuc alanlarinda — geriye donuk uyumluluk
            var _obsDefaultIdx = _obsFtTrGears.length - 1;
            simResult.obstacleCrossing = _obsByTransfer[_obsDefaultIdx].obstacleCrossing;
            simResult.obstacleDynamic = _obsByTransfer[_obsDefaultIdx].obstacleDynamic;
            simResult.obstacleByTransfer = _obsByTransfer;
          }
        } else {
          simResult = veRunSimulationEngine();
        }
        var elapsed = ((performance.now() - t0) / 1000).toFixed(3);
        
        window.veSimResults = simResult;
        
        // ── Gradeability hesabı (FT modunda) ──
        if(simResult.mode === 'full-throttle' && simResult.speed && simResult.DP && simResult.gearMode) {
          simResult.gradeability = veCalculateGradeability(simResult);
        }
        
        // ── Hızlanma milestone hesabı (FT modunda) ──
        if(simResult.mode === 'full-throttle' && simResult.speed && simResult.time && simResult.distance) {
          simResult.acceleration = veCalculateAcceleration(simResult);
        }
        
        setProgress(95);
        
        var totalSteps = simResult.time.length;
        var finalTime = simResult.solverStats ? (simResult.solverStats.steps * (simResult.solverStats.dt || 0.01)) : simResult.time[totalSteps - 1];
        var mode = simResult.mode === 'partial' ? 'Kısmi Analiz' : simResult.mode === 'full-throttle' ? 'Tam Gaz Hızlanma' : 'Tam Analiz';
        
        log('Entegrasyon tamamlandı (' + elapsed + ' s).', 'ok');

        // Adım bütçesi hedef süreye varmadan bittiyse sonuç EKSİKTİR — sessiz kalma.
        if(simResult.solverStats && simResult.solverStats.truncatedByStepBudget) {
          log('  ⚠ Adım bütçesi doldu: simülasyon ' +
              (simResult.solverStats.simEndTime || 0).toFixed(2) + ' s\'de kesildi (hedef ' +
              (simResult.solverStats.maxTime || 0) + ' s). Sonuç EKSİK.', 'warn');
          log('    Δt\'yi büyütün ya da sabit adımlı bir yöntem (RK4) kullanın.', 'warn');
        }

        // Segment drive da çalıştıysa çift analiz modunu belirt
        var _hasSegDriveResult = simResult.segmentDrive && simResult.segmentDrive.segmentSummary;
        if(_hasSegDriveResult && simResult.mode === 'full-throttle') {
          logSpacer();
          log('═══════════════════════════════════════════', 'info');
          log('PERFORMANS ANALİZİ (Tam Gaz Hızlanma)', 'info');
          log('═══════════════════════════════════════════', 'info');
        }

        logSpacer();
        log('Sonuç Özeti:', 'info');
        log('  Analiz modu     : ' + mode);
        log('  Toplam adım     : ' + totalSteps);
        log('  Simülasyon süresi: ' + finalTime.toFixed(2) + ' s');
        log('  Hesap süresi    : ' + elapsed + ' s (' + (totalSteps / parseFloat(elapsed) / 1000).toFixed(1) + 'k adım/s)', 'dim');
        
        if(simResult.speed && simResult.speed.length > 0) {
          var v0 = simResult.speed[0];
          var vF = simResult.speed[totalSteps - 1];
          var vMax = (simResult.solverStats && simResult.solverStats.maxSpeed_kmh !== undefined) ? simResult.solverStats.maxSpeed_kmh : Math.max.apply(null, simResult.speed);
          var vMin = Math.min.apply(null, simResult.speed);
          log('  Başlangıç hız   : ' + v0.toFixed(2) + ' km/h');
          log('  Son hız         : ' + vF.toFixed(2) + ' km/h');
          log('  Maks. hız       : ' + vMax.toFixed(2) + ' km/h');
          log('  Min. hız        : ' + vMin.toFixed(2) + ' km/h');
        }
        if(simResult.rpm && simResult.rpm.length > 0) {
          var rpmF = simResult.rpm[totalSteps - 1];
          var rpmMax = Math.max.apply(null, simResult.rpm);
          log('  Son motor devri : ' + rpmF.toFixed(0) + ' d/d');
          log('  Maks. devir     : ' + rpmMax.toFixed(0) + ' d/d');
        }
        if(simResult.distance && simResult.distance.length > 0) {
          var distF = simResult.distance[totalSteps - 1];
          log('  Kat. mesafe     : ' + distF.toFixed(1) + ' m');
          
          // Segment bazlı özet
          var _roadNode = nodes.find(function(n) { return n.type === 'road'; });
          var _rd = _roadNode ? (_roadNode.data || {}) : {};
          if(_rd.egimMode === 'segment' && _rd.routeSegments && _rd.routeSegments.length > 0) {
            var _totalRouteDist = 0;
            _rd.routeSegments.forEach(function(s) { _totalRouteDist += s.mesafe; });
            var pctDone = Math.min(100, (distF / _totalRouteDist) * 100);
            var segsTraversed = 0;
            var _cumDist = 0;
            for(var _si = 0; _si < _rd.routeSegments.length; _si++) {
              _cumDist += _rd.routeSegments[_si].mesafe;
              if(distF >= _cumDist - 1) segsTraversed = _si + 1;
            }
            log('  Güzergah ilerleme: %' + pctDone.toFixed(1) + ' (' + segsTraversed + '/' + _rd.routeSegments.length + ' segment)');
            if(distF >= _totalRouteDist - 1) {
              log('  ✓ Güzergah tamamlandı!', 'ok');
            }
          }
        }
        // ── Segment Sürüş: Hızlanma-Yavaşlama Özet Tablosu ──
        if(simResult.segmentDriveAllRanges && simResult.segmentDriveTransferGears) {
          var _sdTrGears = simResult.segmentDriveTransferGears;
          var _sdAllRes = simResult.segmentDriveAllRanges;

          logSpacer();
          log('═══════════════════════════════════════════', 'info');
          log('HIZLANMA-YAVAŞLAMA ANALİZİ', 'info');
          log('═══════════════════════════════════════════', 'info');

          // Girdi segmentlerini logla
          var _inputSegs = simResult.segmentDriveInputSegments || [];
          if(_inputSegs.length > 0) {
            log('Girdi Segmentleri (' + _inputSegs.length + ' adet):', 'info');
            _inputSegs.forEach(function(iseg) {
              var cmdL = iseg.command === 'coast' ? 'Gaz Kesme' : 'Tam Gaz';
              log('  Seg ' + iseg.no + ': mesafe=' + (iseg.distance || 0).toFixed(0) + 'm, eğim=%' + (iseg.grade || 0).toFixed(2) + ', komut=' + cmdL);
            });
          }

          _sdTrGears.forEach(function(trg) {
            var _segDrv = _sdAllRes[trg.kademe];
            if(!_segDrv || !_segDrv.segmentSummary) return;
            var _sds = _segDrv.solverStats || {};

            logSpacer();
            var trLabel = trg.kademe + ' (i=' + (parseFloat(trg.ratio || trg.oran) || 0).toFixed(3) + ')';
            log('Transfer: ' + trLabel, 'info');

            // Güç aktarma parametreleri
            if(_sds.i_axle) {
              log('  i_axle=' + _sds.i_axle.toFixed(3) +
                  '  r_tire=' + (_sds.r_tire || 0).toFixed(3) + 'm' +
                  '  GVW=' + (_sds.m_vehicle || 0).toFixed(0) + 'kg' +
                  '  Crr=' + (_sds.Crr || 0).toFixed(4) +
                  '  Cd=' + (_sds.Cd || 0).toFixed(3) +
                  '  A=' + (_sds.A_frontal || 0).toFixed(2) + 'm²', 'dim');
            }

            var _computedSegs = _segDrv.segmentSummary.length;
            var _expectedSegs = _inputSegs.length || _sds.segments || 0;
            log('Segment Bazlı Özet (' + _computedSegs + '/' + _expectedSegs + ' segment hesaplandı):', 'info');
            if(_computedSegs < _expectedSegs) {
              log('  ⚠ UYARI: ' + (_expectedSegs - _computedSegs) + ' segment hesaplanamadı!', 'error');
            }
            _segDrv.segmentSummary.forEach(function(ss) {
              var cmdLabel = ss.command === 'coast' ? 'Gaz Kesme' : 'Tam Gaz';
              var cmdIcon = ss.command === 'coast' ? '⏸' : '▶';
              log('  ' + cmdIcon + ' Seg ' + ss.no + ' [' + cmdLabel + ', %' + ss.grade.toFixed(1) + ']: ' +
                ss.startSpeed_kmh.toFixed(1) + ' → ' + ss.endSpeed_kmh.toFixed(1) + ' km/h, ' +
                ss.actualDist.toFixed(0) + 'm, ' + ss.duration.toFixed(1) + 's');
            });

            logSpacer();
            log('  Başlangıç hızı : ' + _sds.initSpeed_kmh.toFixed(1) + ' km/h');
            log('  Son hız        : ' + _sds.finalSpeed_kmh.toFixed(1) + ' km/h');
            log('  Toplam mesafe  : ' + _sds.totalDistance.toFixed(0) + ' m');
            log('  Toplam adım   : ' + _sds.steps);
            log('  Son vites      : ' + (_sds.finalGear || '—') + (nodes.some(function(n){return n.type==='torque-converter';}) ? (_sds.isLockup ? ' (Lockup)' : ' (Converter)') : ''));

            if(_sds.shiftHistory && _sds.shiftHistory.length > 0) {
              log('  Vites geçişleri (' + _sds.shiftHistory.length + '):', 'dim');
              _sds.shiftHistory.forEach(function(sh) {
                log('    t=' + sh.t.toFixed(2) + 's | ' + sh.fromMode + ' → ' + sh.toMode + ' | V=' + sh.v_kmh.toFixed(1) + ' km/h', 'dim');
              });
            }

            if(_segDrv.speed && _segDrv.speed.length > 0) {
              var _sdMaxV = Math.max.apply(null, _segDrv.speed);
              var _sdMinV = Math.min.apply(null, _segDrv.speed);
              log('  Maks. hız      : ' + _sdMaxV.toFixed(1) + ' km/h');
              log('  Min. hız       : ' + _sdMinV.toFixed(1) + ' km/h');
            }
          });
        }

        // ── Tam Gaz: Vites Geçiş Tablosu (tüm kademeler) ──
        if(simResult.mode === 'full-throttle' && window._veFTAllRangeResults) {
          var trGears = window._veFTTransferGears || [{ kademe: 'High' }];
          var allRes = window._veFTAllRangeResults;
          
          trGears.forEach(function(trg) {
            var r = allRes[trg.kademe];
            if(!r || !r.solverStats) return;
            var sh = r.solverStats.shiftHistory || [];
            if(sh.length > 0) {
              logSpacer();
              var i_tr = trg.ratio || trg.oran || '?';
              log('Vites Geçiş Tablosu — ' + trg.kademe + ' (i=' + i_tr + ') — ' + sh.length + ' geçiş:', 'info');
              veLogCappedList(sh, log, function(s) {
                return '  t=' + s.t.toFixed(2) + 's | ' + s.fromMode + ' → ' + s.toMode
                  + ' | V=' + s.v_kmh.toFixed(1) + ' km/h | N=' + s.N_engine.toFixed(0)
                  + ' rpm | SR=' + s.SR.toFixed(3);
              }, 'Tam liste için Log İndir düğmesini kullanın.');
              if(r.solverStats.suppressedHunts > 0) {
                log('  ⚠ ' + r.solverStats.suppressedHunts + ' vites salınımı (hunt) bastırıldı — ' +
                    'shift profili şanzıman oranlarıyla tam uyuşmuyor olabilir.', 'warn');
              }
              if(r.solverStats.reachedMaxSpeed) {
                log('  ✓ Maks. hız: ' + r.solverStats.maxSpeed_kmh.toFixed(1) + ' km/h (' + r.solverStats.finalGear + ')', 'ok');
              }
            }
          });
        } else if(simResult.mode === 'full-throttle' && simResult.solverStats && simResult.solverStats.shiftHistory) {
          // Tek kademe fallback
          var sh = simResult.solverStats.shiftHistory;
          if(sh.length > 0) {
            logSpacer();
            log('Vites Geçiş Tablosu (' + sh.length + ' geçiş):', 'info');
            veLogCappedList(sh, log, function(s) {
              return '  t=' + s.t.toFixed(2) + 's | ' + s.fromMode + ' → ' + s.toMode
                + ' | V=' + s.v_kmh.toFixed(1) + ' km/h | N=' + s.N_engine.toFixed(0)
                + ' rpm | SR=' + s.SR.toFixed(3);
            }, 'Tam liste için Log İndir düğmesini kullanın.');
          }
        }
        logSpacer();
        
        // Sonuç kartını da güncelle
        var resultEl = document.getElementById('ve-solver-result');
        if(resultEl) {
          var rhtml = '<div style="padding:8px;text-align:center;"><div style="font-size:var(--fs-h2);">✓</div><div style="font-weight:600;font-size:var(--fs-lg);color:var(--text-heading);">Hesaplama Tamamlandı</div><div style="font-size:var(--fs-tiny);color:var(--text-muted);margin-top:2px;">' + mode + ' | ' + totalSteps + ' adım | ' + finalTime.toFixed(1) + ' s</div></div>';
          resultEl.innerHTML = rhtml;
        }
        
        // ══════ ANALİZ ÇIKTISI (MOD'A GÖRE) ══════
        if(simResult.mode === 'full-throttle' && simResult.TE) {
          // ── iSCAAN FULL THROTTLE — ALLISON FORMAT ──
          
          var allResults = window._veFTAllRangeResults || {};
          var trGears = window._veFTTransferGears || [{ kademe: 'High' }];
          if(!window._veFTAllRangeResults) {
            allResults = {};
            allResults[trGears[0].kademe] = simResult;
          }
          
          var pad = function(s, w) { s = String(s); while(s.length < w) s = ' ' + s; return s; };
          
          // ── HER KADEME İÇİN PROFESYONEL ANALİZ ──
          trGears.forEach(function(trg) {
            var r = allResults[trg.kademe];
            if(!r || !r.TE) return;
            
            var i_tr = trg.ratio || trg.oran || '?';
            var ss = r.solverStats || {};
            var sData = r.speed;
            var sLen = sData.length;
            var sh = ss.shiftHistory || [];
            var governed = ss.N_governed || 2100;
            var fgArr = ss.forwardGears || [];
            // Shift profili — aşağıdaki "Vites Geçiş Doğrulama" bölümü bunu
            // kullanıyor. Eskiden ADIM 2'de tanımlı `gd` değişkenine bakıyordu;
            // o değişken BU kapsamda yok → Lock→Lock geçişi olan her topolojide
            // "gd is not defined" ile çözüm son anda çöküyordu.
            var _gbNodeV = nodes.find(function(n) { return n.type === 'gearbox'; });
            var _gbDataV = _gbNodeV ? (_gbNodeV.data || {}) : {};
            
            logSpacer();
            log('═══════════════════════════════════════════', 'head');
            log('  ' + trg.kademe.toUpperCase() + ' RANGE — PERFORMANS ANALİZİ (i=' + i_tr + ')', 'head');
            log('═══════════════════════════════════════════', 'head');
            logSpacer();
            
            // ── 1. Performans Özeti ──
            log('PERFORMANS ÖZETİ:', 'info');
            var maxTE = Math.max.apply(null, r.TE);
            var maxDP = Math.max.apply(null, r.DP);
            var maxWP = Math.max.apply(null, r.WP);
            var maxGr = Math.max.apply(null, r.netGrade);
            var maxHeat = Math.max.apply(null, r.heatRejection);
            log('  Maks. Çekme Kuvveti (TE) : ' + maxTE.toFixed(2) + ' kN');
            log('  Maks. Drawbar Pull  (DP) : ' + maxDP.toFixed(2) + ' kN');
            log('  Maks. Tekerlek Gücü (WP) : ' + maxWP.toFixed(1) + ' kW');
            log('  Maks. Net Eğim          : %' + maxGr.toFixed(1));
            log('  Maks. Isı Reddi         : ' + maxHeat.toFixed(1) + ' kW');
            if(ss.reachedMaxSpeed) {
              log('  Maks. Hız               : ' + ss.maxSpeed_kmh.toFixed(1) + ' km/h (' + ss.finalGear + ')', 'ok');
            }
            
            // ── 2. Hızlanma Süreleri ──
            logSpacer();
            log('HIZLANMA SÜRELERİ:', 'info');
            var targets = [30, 40, 50, 60, 70, 80, 90, 100];
            targets.forEach(function(tgt) {
              for(var ai = 0; ai < sLen; ai++) {
                if(sData[ai] >= tgt) {
                  log('  0 → ' + tgt + ' km/h : ' + r.time[ai].toFixed(2) + ' s  (' + r.distance[ai].toFixed(0) + ' m)');
                  break;
                }
                if(ai === sLen - 1) {
                  log('  0 → ' + tgt + ' km/h : ulaşılamadı', 'warn');
                }
              }
            });
            
            // ── 3. Vites Geçiş Doğrulama ──
            logSpacer();
            log('VİTES GEÇİŞ DOĞRULAMA (' + sh.length + ' geçiş):', 'info');
            if(sh.length > 0) {
              var shiftErrors = 0;
              // Doğrulama TÜM geçişler için yapılır (hata sayımı eksilmesin), ama
              // loga yalnız ilk VE_LOG_LIST_CAP satır basılır — 25.000 DOM düğümü
              // tarayıcıyı kilitliyordu.
              sh.forEach(function(s, _si) {
                var fromMode = s.fromMode || '';
                var toMode = s.toMode || '';
                var isConvToConv = fromMode.match(/C$/) && toMode.match(/C$/);
                var isConvToLock = fromMode.match(/C$/) && toMode.match(/L$/);
                var isLockToLock = fromMode.match(/L$/) && toMode.match(/L$/);
                var isDirect = !fromMode.match(/[CL]$/) && !toMode.match(/[CL]$/);  // TK yok → salt vites geçişi

                var shiftType = isConvToConv ? 'Conv→Conv' : isConvToLock ? 'Conv→Lock' : isLockToLock ? 'Lock→Lock' : (isDirect ? 'Vites' : 'Diğer');
                var statusIcon = '✓';
                var statusNote = '';
                
                // Lockup vites geçişlerinde doğrulama
                if(isLockToLock) {
                  var spValData = VE_FT_SHIFT_PROFILES[_gbDataV.shiftProfile || 'allison3200sp_s1'] || {};
                  var valShiftKey = fromMode + toMode;  // örn. '2L3L'
                  if(spValData.lockupShifts && spValData.lockupShifts[valShiftKey]) {
                    // Per-gear kalibrasyon: N_out = a × ESL + b
                    var lsV = spValData.lockupShifts[valShiftKey];
                    var expectedNout = (typeof calcLockupShiftThreshold === 'function') ? calcLockupShiftThreshold(lsV, governed) : (lsV.a * governed + (lsV.b || 0));
                    var actualNout = s.N_out || 0;
                    var noutDiff = Math.abs(actualNout - expectedNout);
                    if(noutDiff > 15) {
                      statusIcon = '⚠';
                      statusNote = ' (N_out beklenen: ' + expectedNout.toFixed(0) + ', gerçek: ' + actualNout.toFixed(0) + ', fark: ' + noutDiff.toFixed(0) + ')';
                      shiftErrors++;
                    }
                  } else {
                    // Eski yöntem: sabit lockupOffset
                    var expectedRPM = ss.N_shift_lockup || (governed - 75);
                    var rpmDiff = Math.abs((s.N_engine || 0) - expectedRPM);
                    if(rpmDiff > 10) {
                      statusIcon = '⚠';
                      statusNote = ' (beklenen: ' + expectedRPM + ' rpm, fark: ' + rpmDiff.toFixed(0) + ')';
                      shiftErrors++;
                    }
                  }
                }
                
                // Converter geçişlerinde SR kontrol et  
                if(isConvToConv || isConvToLock) {
                  var sr = s.SR || 0;
                  // η = SR × τ — konvertör verimliliği kontrolü
                  var eta = s.eta || 0;
                  if(isConvToConv && sr < 0.5) {
                    statusIcon = '⚠';
                    statusNote = ' (düşük SR — erken geçiş?)';
                    shiftErrors++;
                  }
                }
                
                if(_si < VE_LOG_LIST_CAP) {
                  log('  ' + statusIcon + ' ' + s.fromMode + ' → ' + s.toMode + ' @ V=' + (s.v_kmh||0).toFixed(1) + ' km/h, N=' + (s.N_engine||0).toFixed(0) + ' rpm [' + shiftType + ']' + statusNote);
                } else if(_si === VE_LOG_LIST_CAP) {
                  log('  … ' + (sh.length - VE_LOG_LIST_CAP) + ' satır daha (toplam ' + sh.length +
                      ') — log okunabilirliği için gizlendi. Doğrulama hepsi için yapıldı.', 'dim');
                }
              });

              if(shiftErrors === 0) {
                log('  ─── Tüm vites geçişleri doğrulandı ✓', 'ok');
              } else {
                log('  ─── ' + shiftErrors + ' geçişte sapma tespit edildi', 'warn');
              }
            } else {
              log('  Vites geçişi yok — Tek vites simülasyonu', 'warn');
            }
            
            // ── 4. Kinematik Doğrulama (Kompakt) ──
            logSpacer();
            log('KİNEMATİK DOĞRULAMA:', 'info');
            log('  Drivetrain: r=' + (ss.r_tire||'?') + 'm × i_ps=' + (ss.i_propshaft||1) + ' × i_tr=' + i_tr + ' × i_axle=' + (ss.i_axle||'?'), 'dim');
            
            var kinErrors = 0;
            var kinChecked = 0;
            var maxNoutErr = 0;
            var prevGM_v = '';
            for(var vi = 0; vi < sLen; vi++) {
              var vv = sData[vi];
              // Her vites geçişi ve her 10 km/h'de kontrol
              var doCheck = false;
              if(r.gearMode[vi] !== prevGM_v) doCheck = true;
              if(vi % Math.max(1, Math.round(sLen/20)) === 0) doCheck = true;
              if(vi === sLen - 1) doCheck = true;
              
              if(doCheck && vv > 0.5) {
                var gm2 = r.gearMode[vi] || '';
                var gearNum2 = parseInt(gm2.replace(/[^0-9]/g, '')) || 1;
                var fg2 = fgArr[gearNum2 - 1];
                var iGear2 = fg2 ? parseFloat(fg2.ratio) : 1.0;
                var Nout2 = r.outputSpeed ? r.outputSpeed[vi] : 0;
                var vMs2 = vv / 3.6;
                var Nout_chk = (vMs2 / (ss.r_tire || 0.573)) * ((ss.i_propshaft || 1) * parseFloat(i_tr) * (ss.i_axle || 6.54)) * 60 / (2 * Math.PI);
                var nErr = Math.abs(Nout2 - Nout_chk);
                if(nErr > maxNoutErr) maxNoutErr = nErr;
                if(nErr > 5) kinErrors++;
                kinChecked++;
              }
              prevGM_v = r.gearMode[vi];
            }
            
            if(kinErrors === 0) {
              log('  ✓ N_output doğrulama: ' + kinChecked + '/' + kinChecked + ' nokta BAŞARILI (maks. sapma: ' + maxNoutErr.toFixed(1) + ' rpm)', 'ok');
            } else {
              log('  ✗ N_output doğrulama: ' + kinErrors + '/' + kinChecked + ' noktada sapma (maks: ' + maxNoutErr.toFixed(1) + ' rpm)', 'err');
            }
            
            // TC çalışma aralığı kontrolü (sadece converter modlu viteslerde)
            var minSR = 1.0, maxSR = 0.0, minTau = 99, maxTau = 0;
            var convSamples = 0;
            for(var ci = 0; ci < sLen; ci++) {
              var gmc = r.gearMode[ci] || '';
              if(gmc.match(/C$/)) {
                var _sr = r.SR ? r.SR[ci] : 0;
                var _tau = r.tau ? r.tau[ci] : 0;
                if(_sr > 0) { if(_sr < minSR) minSR = _sr; if(_sr > maxSR) maxSR = _sr; }
                if(_tau > 0) { if(_tau < minTau) minTau = _tau; if(_tau > maxTau) maxTau = _tau; }
                convSamples++;
              }
            }
            if(convSamples > 0) {
              log('  ✓ TC çalışma aralığı: SR=[' + minSR.toFixed(3) + ' – ' + maxSR.toFixed(3) + '], τ=[' + minTau.toFixed(3) + ' – ' + maxTau.toFixed(3) + '] (' + convSamples + ' nokta)', 'ok');
              // Stall torque ratio kontrolü
              if(maxTau > 2.0) {
                log('    Stall τ = ' + maxTau.toFixed(3) + ' (tipik aralık: 1.8–2.5)', 'dim');
              }
            }
            
            // Lockup modda SR = 1.0 kontrolü
            var lockSR_err = 0;
            for(var li = 0; li < sLen; li++) {
              var gml = r.gearMode[li] || '';
              if(gml.match(/L$/) && r.SR && Math.abs(r.SR[li] - 1.0) > 0.001) lockSR_err++;
            }
            if(lockSR_err === 0) {
              log('  ✓ Lockup modu: Tüm L-viteslerde SR = 1.000', 'ok');
            } else {
              log('  ✗ Lockup modu: ' + lockSR_err + ' noktada SR ≠ 1.0', 'err');
            }
            
            // ── 5. Enerji Dengesi Analizi ──
            // 5a. Temel kontrol: TE×V ≈ WP
            var energyErrors = 0;
            for(var ei = 1; ei < sLen; ei++) {
              var v_ms = sData[ei] / 3.6;
              if(v_ms < 0.5) continue;
              var wp_calc = r.TE[ei] * v_ms; // kN × m/s = kW
              var wp_rec = r.WP[ei];
              if(Math.abs(wp_calc - wp_rec) > 0.5) energyErrors++;
            }
            if(energyErrors === 0) {
              log('  ✓ Enerji tutarlılığı: WP = TE × V doğrulandı', 'ok');
            } else {
              log('  ⚠ Enerji tutarlılığı: ' + energyErrors + ' noktada WP ≠ TE×V (>0.5 kW fark)', 'warn');
            }

            // 5b. Güç akışı dağılımı (enerji dengesi dizileri varsa)
            var eb = ss.energyBalance;
            if(eb) {
              logSpacer();
              log('ENERJİ DENGESİ — GÜÇ AKIŞI:', 'info');
              log('  ┌─────────────────────────────────────────────────┐');
              log('  │  Güç Bileşeni            │  Maks [kW] │ Ort [kW]│');
              log('  ├─────────────────────────────────────────────────┤');
              log('  │  Motor Gücü (P_engine)    │ ' + pad(eb.maxP_engine.toFixed(1), 9) + '  │ ' + pad(eb.avgP_engine.toFixed(1), 7) + ' │');
              var _tcHeatLbl = nodes.some(function(n){return n.type==='torque-converter';}) ? 'TC Isı Kaybı (P_TC)' : 'Aktarma Isı (P_ısı)';
              log('  │  ' + _tcHeatLbl + '      │ ' + pad(eb.maxP_TC_heat.toFixed(1), 9) + '  │ ' + pad(eb.avgP_TC_heat.toFixed(1), 7) + ' │');
              log('  │  Güç Aktarma Kaybı (P_dt) │ ' + pad(eb.maxP_drivetrain.toFixed(1), 9) + '  │ ' + pad(eb.avgP_drivetrain.toFixed(1), 7) + ' │');
              log('  │  Tekerlek Gücü (P_wheel)  │ ' + pad(eb.maxP_wheel.toFixed(1), 9) + '  │ ' + pad(eb.avgP_wheel.toFixed(1), 7) + ' │');
              log('  ├─────────────────────────────────────────────────┤');
              log('  │  Yuvarlanma (P_rolling)    │             │ ' + pad(eb.avgP_rolling.toFixed(1), 7) + ' │');
              log('  │  Aerodinamik (P_aero)      │             │ ' + pad(eb.avgP_aero.toFixed(1), 7) + ' │');
              log('  │  Eğim (P_grade)            │             │ ' + pad(eb.avgP_grade.toFixed(1), 7) + ' │');
              log('  │  Hızlanma (P_accel)        │             │ ' + pad(eb.avgP_accel.toFixed(1), 7) + ' │');
              log('  └─────────────────────────────────────────────────┘');
              log('  Toplam verim: η = ' + eb.eta_avg.toFixed(1) + '% (ort.) | ' + eb.eta_min.toFixed(1) + '% (min) | ' + eb.eta_max.toFixed(1) + '% (maks)');
              log('  Maks. artık (residual): ' + eb.maxResidual_kW.toFixed(3) + ' kW (' + eb.samples + ' nokta)');
              if(eb.maxResidual_kW < 0.5) {
                log('  ✓ Newton dengesi: F_traction = F_resist + m_eff × a doğrulandı', 'ok');
              } else {
                log('  ⚠ Newton dengesi sapması: ' + eb.maxResidual_kW.toFixed(3) + ' kW', 'warn');
              }

              // Kayıp dağılımı yüzdeleri (ortalama üzerinden)
              if(eb.avgP_engine > 0.1) {
                var pctTC = eb.avgP_TC_heat / eb.avgP_engine * 100;
                var pctDT = eb.avgP_drivetrain / eb.avgP_engine * 100;
                var pctWheel = eb.avgP_wheel / eb.avgP_engine * 100;
                log('  Güç dağılımı: Tekerlek ' + pctWheel.toFixed(1) + '% | ' + (nodes.some(function(n){return n.type==='torque-converter';}) ? 'TC ısı' : 'Aktarma ısı') + ' ' + pctTC.toFixed(1) + '% | Drivetrain ' + pctDT.toFixed(1) + '%', 'dim');
              }
            }
            
            // ── 6. Fiziksel Sınır Kontrolleri ──
            var physWarn = [];
            // Motor devri governed'ı aşmamalı (lockup'ta)
            var maxLockupRPM = 0;
            for(var pi = 0; pi < sLen; pi++) {
              var gmp = r.gearMode[pi] || '';
              if(gmp.match(/L$/) && r.rpm[pi] > maxLockupRPM) maxLockupRPM = r.rpm[pi];
            }
            if(maxLockupRPM > governed + 50) {
              physWarn.push('Lockup modda motor devri governed aşıyor: ' + maxLockupRPM.toFixed(0) + ' > ' + governed + ' rpm');
            }
            
            // DP negatife düştüğü hız = gerçek maks hız
            var dpCrossIdx = -1;
            for(var di = 1; di < sLen; di++) {
              if(r.DP[di] < 0 && r.DP[di-1] >= 0) { dpCrossIdx = di; break; }
            }
            if(dpCrossIdx > 0) {
              log('  ✓ Maks. sürdürülebilir hız: ' + sData[dpCrossIdx].toFixed(1) + ' km/h (DP = 0 noktası)', 'ok');
            }
            
            // Isı reddi monotonluk kontrolü (genelde hızla artar)
            var heatIncrCount = 0, heatDecrCount = 0;
            for(var hi = 1; hi < sLen; hi++) {
              if(r.gearMode[hi] === r.gearMode[hi-1]) { // Aynı vites içinde
                if(r.heatRejection[hi] > r.heatRejection[hi-1]) heatIncrCount++;
                else if(r.heatRejection[hi] < r.heatRejection[hi-1] - 0.1) heatDecrCount++;
              }
            }
            
            if(physWarn.length > 0) {
              physWarn.forEach(function(pw) { log('  ⚠ ' + pw, 'warn'); });
            }
            
            // ── 7. Sonuç ──
            logSpacer();
            var totalChecks = kinChecked + sh.length + (convSamples > 0 ? 1 : 0) + 1 + 1;
            var totalFails = kinErrors + (lockSR_err > 0 ? 1 : 0) + energyErrors + physWarn.length;
            if(totalFails === 0) {
              log('  ' + trg.kademe.toUpperCase() + ' sonuç: Tüm doğrulamalar başarılı', 'ok');
            } else {
              log('  ' + trg.kademe.toUpperCase() + ' sonuç: ' + totalFails + ' uyarı/hata tespit edildi', 'warn');
            }
          });
          
          logSpacer();

        } else if(simResult.speed && simResult.speed.length > 0 && simResult.F_grade) {
          // ── KUVVET DENGESİ ANALİZİ ──
          logSpacer();
          log('═══════════════════════════════════════════', 'head');
          log('  KUVVET DENGESİ ANALİZİ', 'head');
          log('═══════════════════════════════════════════', 'head');
          logSpacer();
          
          var Fg0 = simResult.F_grade[0] || 0;
          var Fr0 = simResult.F_rolling ? simResult.F_rolling[0] : 0;
          var Fa0 = simResult.F_aero ? simResult.F_aero[0] : 0;
          var Fn0 = simResult.F_net ? simResult.F_net[0] : 0;
          var topDirenc0 = Math.abs(Fr0) + Math.abs(Fa0);
          var kap0 = Math.abs(Fg0) > 0 ? (topDirenc0 / Math.abs(Fg0)) * 100 : 0;
          
          log('┌─ t=0 (Başlangıç Anı) ─────────────────', 'info');
          log('│ Hız              : ' + simResult.speed[0].toFixed(1) + ' km/h', 'dim');
          log('│ Motor Devri      : ' + (simResult.rpm ? simResult.rpm[0].toFixed(0) : '—') + ' d/d', 'dim');
          log('│');
          log('│ KUVVETLER:', 'info');
          // F_grade fizik konvansiyonunda: pozitif = yokuşa direnç (frenleyici),
          // negatif = yokuş aşağı itici. Bu panel kuvvetleri "harekete etkisi"
          // işaretiyle yazar (F_roll/F_aero hep '-'), yani eğimin etkisi −F_grade.
          function _egimEtki(fg) {
            var etki = -fg;                       // harekete etkisi
            return (etki >= 0 ? '+' : '-') + Math.abs(etki).toFixed(0) + ' N  (' +
                   (etki > 0 ? 'hızlandırıcı' : etki < 0 ? 'frenleyici' : 'etkisiz') + ')';
          }
          log('│   Eğim Kuvveti    (F_grade) : ' + _egimEtki(Fg0));
          log('│   Yuvarlanma Dir. (F_roll)  : -' + Math.abs(Fr0).toFixed(0) + ' N  (frenleme)');
          log('│   Hava Direnci    (F_aero)  : -' + Math.abs(Fa0).toFixed(0) + ' N  (frenleme)');
          log('│   ─────────────────────────────');
          log('│   TOPLAM DİRENÇ            : ' + topDirenc0.toFixed(0) + ' N');
          log('│   NET KUVVET               : ' + (Fn0 >= 0 ? '+' : '') + Fn0.toFixed(0) + ' N' + (Fn0 > 10 ? '  → hızlanıyor' : (Fn0 < -10 ? '  → yavaşlıyor' : '  → dengede')));
          if(Math.abs(Fg0) > 0) {
            log('│', 'dim');
            log('│   Kapasite: %' + kap0.toFixed(1), kap0 >= 100 ? 'ok' : 'warn');
          }
          log('└──────────────────────────────────────────');
          logSpacer();
          
          var li = simResult.speed.length - 1;
          var FgL = simResult.F_grade[li] || 0;
          var FrL = simResult.F_rolling ? simResult.F_rolling[li] : 0;
          var FaL = simResult.F_aero ? simResult.F_aero[li] : 0;
          var FnL = simResult.F_net ? simResult.F_net[li] : 0;
          var topDirencL = Math.abs(FrL) + Math.abs(FaL);
          var kapL = Math.abs(FgL) > 0 ? (topDirencL / Math.abs(FgL)) * 100 : 0;
          
          log('┌─ t=' + simResult.time[li].toFixed(1) + 's (Bitiş Anı) ─────────────────', 'info');
          log('│ Hız              : ' + simResult.speed[li].toFixed(1) + ' km/h', 'dim');
          log('│ Motor Devri      : ' + (simResult.rpm ? simResult.rpm[li].toFixed(0) : '—') + ' d/d', 'dim');
          log('│');
          log('│ KUVVETLER:', 'info');
          log('│   Eğim Kuvveti    (F_grade) : ' + _egimEtki(FgL));
          log('│   Yuvarlanma Dir. (F_roll)  : -' + Math.abs(FrL).toFixed(0) + ' N');
          log('│   Hava Direnci    (F_aero)  : -' + Math.abs(FaL).toFixed(0) + ' N');
          log('│   ─────────────────────────────');
          log('│   TOPLAM DİRENÇ            : ' + topDirencL.toFixed(0) + ' N');
          log('│   NET KUVVET               : ' + (FnL >= 0 ? '+' : '') + FnL.toFixed(0) + ' N' + (FnL > 10 ? '  → hızlanıyor' : (FnL < -10 ? '  → yavaşlıyor' : '  → dengede')));
          if(Math.abs(FgL) > 0) {
            log('│', 'dim');
            log('│   Kapasite: %' + kapL.toFixed(1), kapL >= 100 ? 'ok' : 'warn');
          }
          log('└──────────────────────────────────────────');
          logSpacer();
          
          var hizDeg = simResult.speed[li] - simResult.speed[0];
          log('KUVVET DENGESİ DEĞERLENDİRMESİ:', 'info');
          if(kap0 >= 100 && kapL >= 100) {
            log('  ✓ Direnç kuvvetleri tüm süre boyunca YETERLİ', 'ok');
          } else if(kap0 >= 100) {
            log('  ⚠ Direnç kuvvetleri başlangıçta yeterli, sonda yetersiz', 'warn');
          } else {
            log('  ✗ Direnç kuvvetleri YETERSİZ', 'err');
          }
          log('  Hız değişimi: ' + (hizDeg >= 0 ? '+' : '') + hizDeg.toFixed(2) + ' km/h (' + (hizDeg > 0.5 ? 'hızlandı' : (hizDeg < -0.5 ? 'yavaşladı' : 'dengede')) + ')');
          logSpacer();
        }
        
        // ── DİĞER TOPOLOJİLERİ OTOMATİK ÇÖZ ──
        try {
          _veSolveOtherTopologies({ log: log, logSpacer: logSpacer });
        } catch(_otErr) {
          log('⚠ Ek topoloji çözümünde hata: ' + _otErr.message, 'warn');
        }

        // Sonuçlar sayfasını güncelle
        if(typeof veUpdateSolverTabs === 'function') {
          veUpdateSolverTabs();
        }
        if(typeof veUpdateResultsTree === 'function') {
          veUpdateResultsTree();
        }

        // Uyarı özeti
        if(warnings.length > 0) {
          log('Uyarılar (' + warnings.length + '):', 'warn');
          warnings.forEach(function(w) { log('  ⚠ ' + w, 'warn'); });
          logSpacer();
        }

        // Final
        setProgress(100, 'Tamamlandı');
        logSpacer();
        log('═══════════════════════════════════════════', 'ok');
        if(errors.length === 0 && warnings.length === 0) {
          log('  ✓ HESAP TAMAMLANDI — ' + veTabs.length + ' topoloji', 'ok');
          log('  Herhangi bir sorunla karşılaşılmadı.', 'ok');
        } else if(errors.length === 0) {
          log('  ✓ HESAP TAMAMLANDI — ' + veTabs.length + ' topoloji (' + warnings.length + ' uyarı)', 'ok');
          log('  Hesap başarılı, ancak bazı uyarılar mevcut.', 'warn');
        }
        log('═══════════════════════════════════════════', 'ok');
        log('');
        log('Detaylı sonuçlar ve diyagramlar Sonuçlar sayfasındadır.', 'dim');
        
        // ── Log İndir butonunu aktifleştir ──
        if(logDlBtn) logDlBtn.style.display = '';
        
      } catch(e) {
        setProgress(100, 'Hata — Tamamlanamadı');
        barEl.style.background = 'linear-gradient(90deg,#8a2020,#c03030)';
        logSpacer();
        log('SİMÜLASYON HATASI: ' + e.message, 'fatal');
        logSpacer();
        log('═══════════════════════════════════════════', 'fatal');
        log('  ✗ ÇÖZÜM BAŞARISIZ', 'fatal');
        log('  ' + e.message, 'fatal');
        log('═══════════════════════════════════════════', 'fatal');
      }
      
      closeBtn.style.display = '';
      // Log İndir — her durumda göster
      if(logDlBtn) logDlBtn.style.display = '';
    }, 300);
  });
  
  // Adımları sırayla çalıştır
  function runChain() {
    if(stepIdx >= steps.length) return;
    var currentStep = steps[stepIdx];
    stepIdx++;
    currentStep();
  }
  
  // runNext'i chain'e bağla
  stepIdx = 0;
  var origRunNext = runNext;
  runNext = function() { runChain(); };
  
  // Başlat
  setTimeout(runChain, 300);
}

// Bağlantılardan güç aktarma zincirini otomatik çıkar
function veGetPowertrainChain() {
  // Motor (kaynak) bul → bağlantıları takip et → Sonlandırıcı veya zincir sonuna kadar
  var engineNodes = nodes.filter(function(n) { return n.type === 'engine'; });
  if(engineNodes.length === 0) return [];
  
  var chain = [];
  var visited = {};
  var current = engineNodes[0];
  var isPartial = false; // sonlandırıcı ile mi bitiyor
  
  while(current && !visited[current.id]) {
    visited[current.id] = true;
    
    // Sonlandırıcıya geldiysek dur
    if(current.type === 'terminator') {
      isPartial = true;
      break;
    }
    
    chain.push(current);
    
    // Bu node'dan çıkan bağlantıları bul (sensörler hariç)
    var outConns = connections.filter(function(c) { return c.from === current.id; });
    if(outConns.length === 0) break;
    
    // Sensör olmayan ilk hedef
    var nextNode = null;
    for(var ci = 0; ci < outConns.length; ci++) {
      var candidate = nodes.find(function(n) { return n.id === outConns[ci].to; });
      if(candidate && candidate.type !== 'sensor') {
        nextNode = candidate;
        break;
      }
    }
    current = nextNode;
  }
  
  chain._isPartial = isPartial;
  return chain;
}
