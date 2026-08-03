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
  var _origTraceView = (typeof veTrState !== 'undefined')
    ? { xMin: veTrState.xMin, xMax: veTrState.xMax, pinX: veTrState.pinX } : null;

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

      var _hasEngine = _otherTab.state.nodes.some(function(n) { return n.type === 'engine'; });
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
    if(_origTraceView && typeof veTrState !== 'undefined') {
      veTrState.xMin = _origTraceView.xMin;
      veTrState.xMax = _origTraceView.xMax;
      veTrState.pinX = _origTraceView.pinX;
    }
  }

  if(options && options.log) {
    logSpacer();
    log(_solvedCount + ' ek topoloji başarıyla çözüldü' + (_failCount > 0 ? ', ' + _failCount + ' hata' : '') + '.', _failCount > 0 ? 'warn' : 'ok');
    logSpacer();
  }
}
// ═══ TOPOLOJİ DOĞRULAMA ═══
// veCollectValidation() saf veri üretir: [{level, label, detail, nodeId}].
// Çizim iki ayrı yerde yapılır — Çözücü kartı ve GÖRÜNÜR uyarılar paneli.
// Önceden doğrulama yalnızca #ve-solver-validation'a yazıyordu; o eleman
// ulaşılamayan bir sayfada durduğu için "Doğrula"ya basmak ekranda hiçbir şey
// değiştirmiyordu. Sonuç: kullanıcı hatasını göremiyor, Çalıştır ise sessizce
// reddediyordu.
//
// level: 'ok' | 'err' | 'warn' | 'info'   ('err' hesaplamayı bloklar)
function veCollectValidation() {
  var items = [];
  var allOk = true;

  function addItem(ok, label, detail, nodeId) {
    items.push({ level: ok ? 'ok' : 'err', label: label, detail: detail || '', nodeId: nodeId || null });
    if(!ok) allOk = false;
  }
  function addWarn(label, nodeId) { items.push({ level:'warn', label:label, detail:'', nodeId:nodeId || null }); }
  function addInfo(label) { items.push({ level:'info', label:label, detail:'' }); }

  var hasEngine = nodes.some(function(n) { return n.type === 'engine'; });
  var hasGearbox = nodes.some(function(n) { return n.type === 'gearbox'; });
  var hasWheel = nodes.some(function(n) { return n.type === 'wheel'; });
  var hasVehicle = nodes.some(function(n) { return n.type === 'vehicle'; });
  var hasRoad = nodes.some(function(n) { return n.type === 'road'; });
  var hasDiff = nodes.some(function(n) { return n.type === 'differential'; });
  var hasTerminator = nodes.some(function(n) { return n.type === 'terminator'; });
  var hasScenario = nodes.some(function(n) { return n.type === 'scenario'; });

  var terminatorConnected = false;
  if(hasTerminator) {
    terminatorConnected = nodes.some(function(n) {
      if(n.type !== 'terminator') return false;
      return connections.some(function(c) { return c.to === n.id; });
    });
  }

  addItem(hasEngine, 'Motor bileşeni', hasEngine ? 'mevcut' : 'eksik');

  var mod = (typeof veGetActiveModule === 'function') ? veGetActiveModule() : {};
  var scenarioRequired = mod && mod.requiredComponents && mod.requiredComponents.indexOf('scenario') > -1;
  if(scenarioRequired) {
    addItem(hasScenario, 'Senaryolar bileşeni', hasScenario ? 'mevcut' : 'eksik — zorunlu bileşen');
  } else if(hasScenario) {
    addInfo('Senaryolar bileşeni mevcut (opsiyonel)');
  }

  if(hasTerminator && terminatorConnected) {
    addInfo('Kısmi Analiz Modu — Sonlandırıcı tespit edildi, zincir sonlandırıcıya kadar hesaplanacak');
    if(hasGearbox) addItem(true, 'Şanzıman bileşeni', 'mevcut');
    if(hasWheel) addItem(true, 'Tekerlek bileşeni', 'mevcut');
    if(hasVehicle) addItem(true, 'Araç Gövdesi bileşeni', 'mevcut');
  } else {
    addItem(hasGearbox, 'Şanzıman bileşeni', hasGearbox ? 'mevcut' : 'eksik');
    addItem(hasWheel, 'Tekerlek bileşeni', hasWheel ? 'mevcut' : 'eksik');
    addItem(hasVehicle, 'Araç Gövdesi bileşeni', hasVehicle ? 'mevcut' : 'eksik');
    if(typeof veActiveModule !== 'undefined' && veActiveModule !== 'full-throttle') {
      addItem(hasRoad, 'Yol / Eğim bileşeni', hasRoad ? 'mevcut' : 'eksik');
    } else if(hasRoad) {
      addInfo('Yol / Eğim bileşeni mevcut (opsiyonel — eğim Araç bileşeninden alınır)');
    }
    if(!hasDiff) addWarn('Diferansiyel bileşeni eksik — varsayılan oran kullanılacak');
  }

  // ── Bağlantı kontrolü ────────────────────────────────────────────────
  // Bir düğüm YALNIZCA bağlanabiliyorsa "bağlı değil" olabilir. Buradaki
  // muafiyet eskiden ELLE TUTULAN bir kopya listeydi ve components.js'teki
  // VE_STANDALONE_TYPES ile SENKRON DEĞİLDİ: ec-matching, sensor-wizard,
  // obstacle-crossing, engine-gearbox-matching ve shift-controller kopyada
  // yoktu. Sonuç: kullanıcı "Motor-Konvertör Eşleştirme" bileşenini eklediğinde
  // "bağlı değil" diye BLOKLAYAN bir hata alıyordu.
  //
  // Artık iki muafiyet var ve ikisi de TÜRETİLMİŞ:
  //   1. PORTU OLMAYAN düğüm (inputs=0 ve outputs=0) hiç bağlanamaz — modül
  //      kapsayıcıları (arac-performans, mount-analysis), çözücü, araç, yol,
  //      senaryo, tüm mnt-* araç blokları buraya girer. Bu kural tanımdan
  //      gelir, liste tutmayı gerektirmez.
  //   2. VE_STANDALONE_TYPES — portu OLAN ama bağlantısı zorunlu OLMAYAN
  //      tipler (sensor, terminator, ec-matching, engine-gearbox-matching).
  //      Tek kaynak: components.js.
  var standaloneTypes = (typeof VE_STANDALONE_TYPES !== 'undefined') ? VE_STANDALONE_TYPES : [];
  function veCanConnect(type) {
    var def = (typeof componentDefs !== 'undefined') ? componentDefs[type] : null;
    if(!def) return true;                        // tanım yoksa iddia etme
    return (def.inputs || 0) > 0 || (def.outputs || 0) > 0;
  }
  var connectedNodes = {};
  connections.forEach(function(c) { connectedNodes[c.from] = true; connectedNodes[c.to] = true; });
  var disconnected = nodes.filter(function(n) {
    if(!veCanConnect(n.type)) return false;              // portu yok → bağlanamaz
    if(standaloneTypes.indexOf(n.type) > -1) return false; // bağlantısı zorunlu değil
    return !connectedNodes[n.id];
  });
  addItem(disconnected.length === 0, 'Güç zinciri bileşenleri bağlı',
    disconnected.length > 0 ? disconnected.length + ' bileşen bağlı değil' : 'OK',
    disconnected.length > 0 ? disconnected[0].id : null);
  // Hangi bileşenlerin bağlı olmadığını tek tek söyle — "2 bileşen bağlı değil"
  // demek kullanıcıya hangisini arayacağını söylemiyordu.
  disconnected.forEach(function(n) {
    var nm = n.customName || ((typeof componentDefs !== 'undefined' && componentDefs[n.type]) ? componentDefs[n.type].name : n.type);
    addWarn(nm + ' bağlı değil', n.id);
  });

  if(hasEngine) {
    var engineNode = nodes.find(function(n) { return n.type === 'engine'; });
    var hasData = engineNode && engineNode.data && engineNode.data.torqueData && engineNode.data.torqueData.length >= 2;
    addItem(hasData, 'Motor tork verileri',
      hasData ? engineNode.data.torqueData.length + ' veri noktası' : 'eksik veya yetersiz',
      engineNode ? engineNode.id : null);

    if(engineNode && typeof VE_ACC_PORT_MAP !== 'undefined' && typeof VE_ACC_TYPES !== 'undefined') {
      Object.keys(VE_ACC_PORT_MAP).forEach(function(portId) {
        var accType = VE_ACC_PORT_MAP[portId];
        var info = VE_ACC_TYPES[accType] || {};
        var connectedAcc = connections.some(function(c) {
          if(c.to !== engineNode.id || c.toPort !== portId) return false;
          var fn = nodes.find(function(n){ return n.id === c.from; });
          return fn && fn.type === accType;
        });
        if(connectedAcc) addInfo((info.label || accType) + ' bağlı — aksesuar kaybı modellendi');
        else addWarn((info.label || accType) + ' portu boş — bu aksesuarın kaybı hesaba katılmıyor', engineNode.id);
      });
    }
  }

  if(hasVehicle) {
    var vehicleNode = nodes.find(function(n) { return n.type === 'vehicle'; });
    // Araç panelindeki "Toplam Kütle (GVW)" alanı data.ftGVW yazar
    // (component-extras.js onVEFTVehicleParamChange) ve çözücü de ftGVW okur
    // (simulation-engine.js, ft-performance.js, ft-obstacle.js).
    // BURASI data.mass OKUYORDU — hiçbir panelin YAZMADIĞI bir anahtar. Sonuç:
    // kullanıcı kütleyi girse bile "girilmemiş" deyip hesaplamayı BLOKLUYORDU.
    // Eski projelerde başka bir ad kullanılmış olabileceği için mass da kabul
    // edilir; asıl kaynak ftGVW.
    var vd = (vehicleNode && vehicleNode.data) ? vehicleNode.data : {};
    var kutle = parseFloat(vd.ftGVW);
    if(!(kutle > 0)) kutle = parseFloat(vd.mass);
    var hasMass = kutle > 0;
    addItem(hasMass, 'Araç ağırlığı', hasMass ? kutle + ' kg' : 'girilmemiş',
      vehicleNode ? vehicleNode.id : null);
  }

  if(hasRoad) {
    var roadNode = nodes.find(function(n) { return n.type === 'road'; });
    var rdd = (roadNode && roadNode.data) ? roadNode.data : {};
    // Burada BLOKLAYAN bir "Arazi eğimi — girilmemiş" hatası vardı ve
    // SAĞLANAMAZDI: yol panelinde manuel eğim girişi YOK (yalnız eğim modu ve
    // segment tablosu var; "Ort. Eğim" salt-okunur bir gösterge). data.grade'i
    // hiçbir panel yazmıyor, çözücü de yokken 0 kabul ediyor. Üstelik hemen
    // yukarıdaki bilgi satırı eğimin opsiyonel olduğunu söylüyordu — aynı
    // panelde iki çelişik ifade.
    // Artık eğimin NEREDEN geldiğini söyleyen bir bilgi satırı:
    var segMod = rdd.egimMode === 'segment' && rdd.routeSegments && rdd.routeSegments.length > 0;
    var elGrade = parseFloat(rdd.grade);
    if(segMod) {
      addInfo('Eğim segment tablosundan alınacak (' + rdd.routeSegments.length + ' segment)');
    } else if(elGrade > 0 || elGrade < 0) {
      addInfo('Sabit eğim: %' + elGrade);
    } else {
      addInfo('Eğim girilmedi — düz yol (%0) kabul edilecek');
    }
  }

  return {
    items: items,
    allOk: allOk,
    mode: (hasTerminator && terminatorConnected) ? 'Kısmi analiz' : 'Tam analiz',
    errors: items.filter(function(i) { return i.level === 'err'; }),
    warnings: items.filter(function(i) { return i.level === 'warn'; })
  };
}

// Çözücü sayfasındaki doğrulama kartı (sayfa şu an gezinmede yok; eleman
// bulunamazsa sessizce atlanır — çizim artık zorunlu değil).
function veRenderValidationCard(res) {
  var container = document.getElementById('ve-solver-validation');
  if(!container) return;
  var html = '';
  res.items.forEach(function(it) {
    if(it.level === 'info') {
      html += '<div class="ve-validation-item" style="font-size:var(--fs-md);"><span>ℹ️</span><span>' + it.label + '</span></div>';
      return;
    }
    if(it.level === 'warn') {
      html += '<div class="ve-validation-item ve-validation-warn"><span>⚠</span><span>' + it.label + '</span></div>';
      return;
    }
    var ok = it.level === 'ok';
    var icon = ok ? '<span style="color:var(--accent-success);font-weight:700;">✓</span>'
                  : '<span style="color:var(--accent-danger);font-weight:700;">✗</span>';
    html += '<div class="ve-validation-item ' + (ok ? 've-validation-ok' : 've-validation-err') + '"><span>' + icon +
            '</span><span>' + it.label + (it.detail ? ' <span style="color:var(--text-muted);font-size:var(--fs-body);">(' + it.detail + ')</span>' : '') + '</span></div>';
  });
  if(res.allOk) {
    html += '<div style="margin-top:12px;padding:10px;background:color-mix(in srgb, var(--accent-success) 10%, transparent);border-radius:var(--radius-sm);border:1px solid color-mix(in srgb, var(--accent-success) 30%, transparent);text-align:center;font-size:var(--fs-lg);color:var(--accent-success);font-weight:600;">✓ ' + res.mode + ' - hesaplamaya hazır</div>';
  } else {
    html += '<div style="margin-top:12px;padding:10px;background:color-mix(in srgb, var(--accent-danger) 10%, transparent);border-radius:var(--radius-sm);border:1px solid color-mix(in srgb, var(--accent-danger) 30%, transparent);text-align:center;font-size:var(--fs-lg);color:var(--accent-danger);font-weight:600;">✗ Eksikler var - hesaplama yapılamaz</div>';
  }
  container.innerHTML = html;

  var runBtn = document.getElementById('ve-solver-run-btn');
  if(runBtn) {
    runBtn.disabled = !res.allOk;
    runBtn.style.opacity = res.allOk ? '1' : '0.5';
  }
}

function veSolverValidate() {
  var res = veCollectValidation();
  veRenderValidationCard(res);
  // Asıl geri bildirim burada: kullanıcının GÖRDÜĞÜ panel
  if(typeof veShowValidationInWarnings === 'function') veShowValidationInWarnings(res);
  return res.allOk;
}

/**
 * Şerit "Çalıştır" düğmesi (ve komut paleti / Sonuçlar boş-yuva düğmesi).
 *
 * ARTIK ÇÖZÜCÜ BİLEŞENİNİ AÇAR — ayrı bir hesap yolu koşturmaz.
 *
 * Neden değişti: "Çalıştır" eskiden veSolverRunLegacy'yi çağırıyordu; o da
 * sonuçlarını #ve-page-cozucu alt-sayfasındaki elemanlara (ve-solver-progress /
 * ve-solver-result) yazıyordu. O sayfa gezinmede YOK ve display:none —
 * getElementById onu yine buluyor, dolayısıyla simülasyon gerçekten koşuyor ama
 * çıktısı görünmez bir sayfaya gidiyordu. Kullanıcı açısından düğme "hiçbir şey
 * yapmıyor" gibi görünüyordu; üstelik Çözücü bileşeninin "Hesapla" düğmesinden
 * (veSolverRunProfessional) TAMAMEN AYRI, eski bir kod yoluydu.
 *
 * Tek doğruluk kaynağı: Çözücü bileşeni. Çalıştır artık onu açar; hesap oradan
 * başlatılır. Böylece iki düğme aynı davranışa sahip olur.
 */
function veSolverRun() {
  var solverNode = (typeof nodes !== 'undefined' && nodes)
    ? nodes.find(function(n) { return n.type === 'solver'; })
    : null;

  if(!solverNode) {
    if(typeof showToast === 'function') {
      showToast('Topolojide Çözücü bileşeni yok — önce bir Çözücü ekleyin.', 'error');
    }
    return;
  }

  // Bileşene çift tıklamayla aynı yol: seç (panel içeriğini üretir) + pencereyi aç.
  if(typeof clearSelection === 'function') clearSelection();
  if(typeof addToSelection === 'function') {
    addToSelection(solverNode);
  } else if(typeof showNodeProperties === 'function') {
    showNodeProperties(solverNode);
  }
  if(typeof veTogglePropertiesPanel === 'function') veTogglePropertiesPanel(true);
}

// ── ESKİ HESAP YOLU (kullanılmıyor) ────────────────────────────────────────
// Sonuçlarını gezinmede olmayan #ve-page-cozucu sayfasına yazar. Çözücü
// bileşenindeki veSolverRunProfessional'ın yerini aldığı için hiçbir düğmeye
// bağlı değildir; referans olarak duruyor.
function veSolverRunLegacy() {
  // veSolverValidate zaten sonucu görünür panele döküyor ve toast atıyor;
  // burada ikinci bir toast atmak aynı bilgiyi iki kez söylemek olurdu.
  // Eksikler panelde kalıcı durur — kaybolan bir toast'ın aksine.
  var valid = veSolverValidate();
  if(!valid) return;

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
            summaryRows += '<tr><td style="color:var(--text-muted);">Tolerans:</td><td style="text-align:right;font-weight:600;font-family:monospace;font-size:var(--fs-tiny);">' + (sd.atol || 1e-6) + ' / ' + (sd.rtol || 1e-4) + '</td></tr>';
          } else {
            summaryRows += '<tr><td style="color:var(--text-muted);">Çözünürlük:</td><td style="text-align:right;font-weight:600;">' + (sd.resolution || 200) + ' adım</td></tr>';
            summaryRows += '<tr><td style="color:var(--text-muted);">Δt:</td><td style="text-align:right;font-weight:600;">' + ((sd.dt || 0.3).toFixed(4)) + ' s</td></tr>';
          }
          summaryEl.innerHTML = '<table style="width:100%;font-size:var(--fs-body);">' + summaryRows + '</table>';
        }
        
        var simResult = veFTRunSimulationEngine();
        
        progressFill.style.width = '100%';
        progressText.textContent = 'Tamamlandı!';
        
        window.veSimResults = simResult;

        // Ölçüm penceresi "Çözüm sonucu yok" boş durumundan çıkmalı ve
        // şeritler yeni veriyle çizilmeli; aksi hâlde kullanıcı çalıştırdıktan
        // sonra da eski mesajı ya da bayat eğriyi görür.
        try {
          if(typeof veTrResetView === 'function') veTrResetView();
          if(typeof veTrRefresh === 'function') veTrRefresh();
        } catch(_e) {}

        // ── DİĞER TOPOLOJİLERİ OTOMATİK ÇÖZ ──
        try {
          _veSolveOtherTopologies();
        } catch(_otErr) {
          console.warn('[MFSim] Ek topoloji çözümünde hata:', _otErr.message);
        }

        var totalTime = simResult.time[simResult.time.length - 1];
        var ss = simResult.solverStats || {};
        
        var rhtml = '<div style="padding:12px;">';
        rhtml += '<div style="text-align:center; margin-bottom:12px;"><div style="font-size:var(--fs-h1); margin-bottom:4px;"><span style="color:var(--accent-success);">✓</span></div><div style="font-weight:600; color:var(--text-heading); font-size:var(--fs-lg);">Hesaplama Tamamlandı</div>';
        rhtml += '<div style="font-size:var(--fs-tiny); color:var(--text-muted); margin-top:2px;">' + (simResult.mode === 'partial' ? 'Kısmi analiz Modu' : 'Tam Analiz Modu') + '</div></div>';
        
        rhtml += '<div style="display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-bottom:12px;">';
        rhtml += '<div style="background:var(--bg-tertiary); padding:10px; border-radius:var(--radius-sm); border:1px solid var(--border-color); text-align:center;"><div style="font-size:var(--fs-tiny); color:var(--text-muted);">Toplam Süre</div><div style="font-size:var(--fs-title); font-weight:700; color:var(--accent-primary);">' + totalTime.toFixed(1) + ' s</div></div>';
        rhtml += '<div style="background:var(--bg-tertiary); padding:10px; border-radius:var(--radius-sm); border:1px solid var(--border-color); text-align:center;"><div style="font-size:var(--fs-tiny); color:var(--text-muted);">Çıktı Noktası</div><div style="font-size:var(--fs-title); font-weight:700; color:var(--accent-success);">' + simResult.time.length + '</div></div>';
        
        if(simResult.mode === 'partial') {
          var maxRpm = Math.max.apply(null, simResult.rpm);
          var finalRpm = simResult.rpm[simResult.rpm.length - 1];
          rhtml += '<div style="background:var(--bg-tertiary); padding:10px; border-radius:var(--radius-sm); border:1px solid var(--border-color); text-align:center;"><div style="font-size:var(--fs-tiny); color:var(--text-muted);">Maks Devir</div><div style="font-size:var(--fs-title); font-weight:700; color:#ef4444;">' + maxRpm.toFixed(0) + ' rpm</div></div>';
          rhtml += '<div style="background:var(--bg-tertiary); padding:10px; border-radius:var(--radius-sm); border:1px solid var(--border-color); text-align:center;"><div style="font-size:var(--fs-tiny); color:var(--text-muted);">Son Devir</div><div style="font-size:var(--fs-title); font-weight:700; color:#f59e0b;">' + finalRpm.toFixed(0) + ' rpm</div></div>';
        } else {
          var maxV = Math.max.apply(null, simResult.speed);
          var finalV = simResult.speed[simResult.speed.length - 1];
          rhtml += '<div style="background:var(--bg-tertiary); padding:10px; border-radius:var(--radius-sm); border:1px solid var(--border-color); text-align:center;"><div style="font-size:var(--fs-tiny); color:var(--text-muted);">Maks Hız</div><div style="font-size:var(--fs-title); font-weight:700; color:#ef4444;">' + maxV.toFixed(2) + ' km/h</div></div>';
          rhtml += '<div style="background:var(--bg-tertiary); padding:10px; border-radius:var(--radius-sm); border:1px solid var(--border-color); text-align:center;"><div style="font-size:var(--fs-tiny); color:var(--text-muted);">Son Hız</div><div style="font-size:var(--fs-title); font-weight:700; color:#f59e0b;">' + finalV.toFixed(2) + ' km/h</div></div>';
        }
        
        rhtml += '</div>';
        
        // ── Solver İstatistikleri Kartı ──
        if(ss.method) {
          rhtml += '<div style="background:var(--bg-secondary); border:1px solid var(--border-color); border-radius:var(--radius-sm); padding:10px; margin-bottom:10px;">';
          rhtml += '<div style="font-size:var(--fs-body); font-weight:600; color:var(--text-heading); margin-bottom:6px;"><span class="mf-ico mf-ico-bar-chart"></span> Solver İstatistikleri</div>';
          rhtml += '<table style="width:100%; font-size:var(--fs-tiny); color:var(--text-secondary);">';
          
          if(ss.method === 'rk45') {
            rhtml += '<tr><td>İç adım sayısı:</td><td style="text-align:right; font-weight:600; font-family:monospace;">' + (ss.steps || 0) + '</td></tr>';
            rhtml += '<tr><td>Reddedilen adım:</td><td style="text-align:right; font-weight:600; font-family:monospace; color:' + (ss.rejected > 0 ? '#f59e0b' : 'var(--accent-success)') + ';">' + (ss.rejected || 0) + '</td></tr>';
            if(ss.dtMin !== undefined) rhtml += '<tr><td>dt aralığı:</td><td style="text-align:right; font-weight:600; font-family:monospace;">' + ss.dtMin.toExponential(2) + ' → ' + ss.dtMax.toExponential(2) + ' s</td></tr>';
            if(ss.maxError !== undefined) rhtml += '<tr><td>Maks yerel hata:</td><td style="text-align:right; font-weight:600; font-family:monospace;">' + ss.maxError.toExponential(2) + '</td></tr>';
            if(ss.events && ss.events.length > 0) rhtml += '<tr><td>Algılanan olaylar:</td><td style="text-align:right; font-weight:600;">' + ss.events.length + '</td></tr>';
            if(ss.stiffnessDetected) rhtml += '<tr style="border-top:1px solid var(--border-color);"><td colspan="2" style="padding-top:6px; font-weight:700; color:#ef4444;">⚠ Sertlik Uyarısı</td></tr><tr><td colspan="2" style="font-size:var(--fs-tiny); color:#ef4444;">Problem sert (stiff) olabilir. Adım boyutu sürekli minimumda veya ardışık redler algılandı. Tolerans değerlerini gevşetmeyi veya simülasyon parametrelerini gözden geçirmeyi deneyin.</td></tr>';
          }
          
          // Enerji dengesi (tüm yöntemler için)
          if(ss.energyError) {
            var ee = ss.energyError;
            var errColor = ee.error_pct < 0.1 ? '#22c55e' : ee.error_pct < 1.0 ? '#f59e0b' : '#ef4444';
            var errLabel = ee.error_pct < 0.1 ? 'Mükemmel' : ee.error_pct < 1.0 ? 'Kabul edilebilir' : 'Yüksek — adım sayısını artırın';
            rhtml += '<tr style="border-top:1px solid var(--border-color);"><td colspan="2" style="padding-top:6px; font-weight:600; color:var(--text-heading);"><span class="mf-ico mf-ico-zap"></span> Enerji Dengesi</td></tr>';
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
        
        rhtml += '<div style="font-size:var(--fs-body); color:var(--text-muted); text-align:center;">Sonuçlar sekmesinden detayları görüntüleyebilirsiniz.</div>';
        rhtml += '</div>';
        resultEl.innerHTML = rhtml;
        
        // Ölçüm penceresini tazele (şeritler + tablo/3B aynı kapıdan)
        if(typeof veTrRefresh === 'function') veTrRefresh();
        
        var _toastMsg = 'Hesaplama tamamlandı (' + simResult.time.length + ' nokta';
        if(ss.method === 'rk45') _toastMsg += ', ' + (ss.steps || 0) + ' iç adım';
        if(ss.energyError) _toastMsg += ', enerji hatası: %' + ss.energyError.error_pct.toFixed(4);
        _toastMsg += ')';
        showToast(_toastMsg, 'success');
        
      } catch(err) {
        progressFill.style.width = '100%';
        progressFill.style.background = 'var(--accent-danger)';
        progressText.textContent = 'HATA!';
        resultEl.innerHTML = '<div style="padding:16px; text-align:center; color:var(--accent-danger);"><div style="font-size:var(--fs-h1); margin-bottom:8px;"><span style="color:var(--accent-danger);">✗</span></div><div style="font-weight:600;">Hesaplama Hatası</div><div style="font-size:var(--fs-body); margin-top:8px; color:var(--text-muted);">' + err.message + '</div></div>';
        showToast('Hesaplama hatası: ' + err.message, 'error');
      }
    }, 200);
  }, 100);
}

