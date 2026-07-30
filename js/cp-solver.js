// ===== TEKERLEK ÖZELLİKLERİ =====

// Simülasyon güvenlik limitinin TEK doğruluk kaynağı [s].
// Bu panel ile çözücüler (ft-performance.js, solver-pro.js) aynı değeri
// kullanmalı. Eskiden panel 300, çözücüler ise 120 varsayıyordu; değer
// görünmeyen bir hidden input'ta olduğu için kullanıcı farkı göremiyordu ve
// aynı proje, çözücü düğümü bir kez açılmışsa 300'e, açılmamışsa 120 s'ye
// kadar entegre ediliyordu (30 t örnekte 138 vs 81 km/h üst hız).
var VE_DEFAULT_MAX_SIM_TIME = 300;

function getSolverPropertiesHTML(node) {
  var d = node.data || {};
  var maxSimTime = d.maxSimTime !== undefined ? d.maxSimTime : VE_DEFAULT_MAX_SIM_TIME;

  var html = '<div class="ve-cp-panel" style="border-top:1px solid var(--border-color); padding-top:12px;">';

  // Başlık
  html += '<div style="display:flex; align-items:center; gap:8px; margin-bottom:10px;">';
  html += '<div style="font-size:0.78rem; font-weight:700; color:var(--text-heading);">Çözücü Ayarları</div>';
  html += '<span style="font-size:0.52rem; font-weight:600; color:#2e7d32; background:#2e7d3218; padding:2px 7px; border-radius:var(--radius-sm); border:1px solid #2e7d3230; letter-spacing:0.03em; text-transform:uppercase;">MFSim</span>';
  html += '</div>';

  // İKİ SÜTUN: SOL = çözüm kümesi + yöntem/tolerans (girdi), SAĞ = referans + zincir + hesapla
  html += '<div class="ve-cp-grid"><div class="ve-cp-col ve-cp-col--in">';
  // ===== ÇÖZÜM KÜMESİ =====
  var perfAnalysis = d.performanceAnalysis || false;
  html += '<div style="margin-bottom:10px;">';
  html += '<div style="font-size:0.72rem; font-weight:600; color:var(--text-heading); margin-bottom:6px;">Çözüm Kümesi</div>';
  html += '<label style="display:flex; align-items:center; gap:8px; padding:7px 10px; background:var(--bg-tertiary); border:1px solid var(--border-color); border-radius:var(--radius-sm); cursor:pointer; font-size:0.66rem; color:var(--text-primary);" onmouseenter="this.style.borderColor=\'var(--accent-primary)\'" onmouseleave="this.style.borderColor=\'var(--border-color)\'">';
  html += '<input type="checkbox" id="ve-solver-perfanalysis-' + node.id + '" ' + (perfAnalysis ? 'checked' : '') + ' onchange="onVESolverParamChange(\'' + node.id + '\')" style="accent-color:var(--accent-primary); width:15px; height:15px; cursor:pointer;">';
  html += '<div><div style="font-weight:600;">Performans Analizi</div><div style="font-size:0.54rem; color:var(--text-muted); margin-top:2px;">Tam gaz hızlanma, 0-100 km/h, elastik hızlanma, gradeability</div></div>';
  html += '</label>';

  // Yol bileşeninin eğim modunu kontrol et
  var roadNode = nodes.find(function(n) { return n.type === 'road'; });
  var roadEgimMode = (roadNode && roadNode.data && roadNode.data.egimMode) ? roadNode.data.egimMode : 'segment';

  // Kullanıcı Girişli Eğim Analizi checkbox (road egimMode === 'manuel' ise göster)
  var manualGradeAnalysis = d.manualGradeAnalysis || false;
  if(roadNode && roadEgimMode === 'manuel') {
    html += '<label style="display:flex; align-items:center; gap:8px; padding:7px 10px; margin-top:6px; background:var(--bg-tertiary); border:1px solid var(--border-color); border-radius:var(--radius-sm); cursor:pointer; font-size:0.66rem; color:var(--text-primary);" onmouseenter="this.style.borderColor=\'var(--accent-primary)\'" onmouseleave="this.style.borderColor=\'var(--border-color)\'">';
    html += '<input type="checkbox" id="ve-solver-manualgrade-' + node.id + '" ' + (manualGradeAnalysis ? 'checked' : '') + ' onchange="onVESolverParamChange(\'' + node.id + '\')" style="accent-color:var(--accent-primary); width:15px; height:15px; cursor:pointer;">';
    html += '<div><div style="font-weight:600;">Kullanıcı Girişli Eğim Analizi</div><div style="font-size:0.54rem; color:var(--text-muted); margin-top:2px;">Manuel eğim değerleri ile hızlanma/yavaşlama analizi</div></div>';
    html += '</label>';
  }

  // Hızlanma-Yavaşlama checkbox (segment bazlı sürüş — road egimMode === 'segment' ise göster)
  var accelDecel = d.accelDecelAnalysis || false;
  var scenNode = nodes.find(function(n) { return n.type === 'scenario'; });
  var hasRoadSegs = scenNode && scenNode.data && scenNode.data.roadSegments && scenNode.data.roadSegments.length > 0;
  if(hasRoadSegs && roadEgimMode === 'segment') {
    html += '<label style="display:flex; align-items:center; gap:8px; padding:7px 10px; margin-top:6px; background:var(--bg-tertiary); border:1px solid var(--border-color); border-radius:var(--radius-sm); cursor:pointer; font-size:0.66rem; color:var(--text-primary);" onmouseenter="this.style.borderColor=\'var(--accent-primary)\'" onmouseleave="this.style.borderColor=\'var(--border-color)\'">';
    html += '<input type="checkbox" id="ve-solver-acceldecel-' + node.id + '" ' + (accelDecel ? 'checked' : '') + ' onchange="onVESolverParamChange(\'' + node.id + '\')" style="accent-color:var(--accent-primary); width:15px; height:15px; cursor:pointer;">';
    html += '<div><div style="font-weight:600;">Hızlanma-Yavaşlama</div><div style="font-size:0.54rem; color:var(--text-muted); margin-top:2px;">Segment bazlı sürüş analizi — güzergah üzerinde hızlanma/yavaşlama profili</div></div>';
    html += '</label>';

    // Rapor zaman adımı (Hızlanma-Yavaşlama checkbox açıkken göster)
    var sdReportInterval = d.sdReportInterval || 0.5;
    html += '<div id="ve-solver-sdinterval-wrap-' + node.id + '" style="margin-top:4px; margin-left:23px; padding:5px 10px; background:var(--bg-secondary); border:1px solid var(--border-color); border-radius:var(--radius-sm);' + (!accelDecel ? 'display:none;' : '') + '">';
    html += '<label style="font-size:0.62rem; color:var(--text-secondary); display:flex; align-items:center; gap:6px;">';
    html += 'Rapor zaman adımı:';
    html += '<select id="ve-solver-sdinterval-' + node.id + '" onchange="onVESolverParamChange(\'' + node.id + '\')" style="padding:3px 6px; font-size:0.62rem; background:var(--bg-input); color:var(--text-primary); border:1px solid var(--border-color); border-radius:var(--radius-sm);">';
    html += '<option value="0.5"' + (sdReportInterval == 0.5 ? ' selected' : '') + '>0.5 s (varsayılan)</option>';
    html += '<option value="1"' + (sdReportInterval == 1 ? ' selected' : '') + '>1 s</option>';
    html += '<option value="2"' + (sdReportInterval == 2 ? ' selected' : '') + '>2 s</option>';
    html += '<option value="5"' + (sdReportInterval == 5 ? ' selected' : '') + '>5 s</option>';
    html += '<option value="10"' + (sdReportInterval == 10 ? ' selected' : '') + '>10 s</option>';
    html += '</select>';
    html += '</label>';
    html += '</div>';
  }

  // Engel Atlama Analizi checkbox (obstacle-crossing bileşeni gerektirir)
  var obsCrossAnalysis = d.obstacleCrossingAnalysis || false;
  var obsNode = nodes.find(function(n) { return n.type === 'obstacle-crossing'; });
  if(obsNode) {
    html += '<label style="display:flex; align-items:center; gap:8px; padding:7px 10px; margin-top:6px; background:var(--bg-tertiary); border:1px solid var(--border-color); border-radius:var(--radius-sm); cursor:pointer; font-size:0.66rem; color:var(--text-primary);" onmouseenter="this.style.borderColor=\'var(--accent-primary)\'" onmouseleave="this.style.borderColor=\'var(--border-color)\'">';
    html += '<input type="checkbox" id="ve-solver-obscross-' + node.id + '" ' + (obsCrossAnalysis ? 'checked' : '') + ' onchange="onVESolverParamChange(\'' + node.id + '\')" style="accent-color:var(--accent-primary); width:15px; height:15px; cursor:pointer;">';
    html += '<div><div style="font-weight:600;">Engel Atlama Analizi</div><div style="font-size:0.54rem; color:var(--text-muted); margin-top:2px;">Engel geçme kabiliyeti analizi — hendek, rampa ve dikey engel hesaplamaları</div></div>';
    html += '</label>';

    // Log kaydı aralığı (Engel Atlama checkbox açıkken göster)
    var obsLogInterval = d.obsLogInterval || 0.01;
    html += '<div id="ve-solver-obslog-wrap-' + node.id + '" style="margin-top:4px; margin-left:23px; padding:5px 10px; background:var(--bg-secondary); border:1px solid var(--border-color); border-radius:var(--radius-sm);' + (!obsCrossAnalysis ? 'display:none;' : '') + '">';
    html += '<label style="font-size:0.62rem; color:var(--text-secondary); display:flex; align-items:center; gap:6px;">';
    html += 'Log kaydı:';
    html += '<select id="ve-solver-obslog-' + node.id + '" onchange="onVESolverParamChange(\'' + node.id + '\')" style="padding:3px 6px; font-size:0.62rem; background:var(--bg-input); color:var(--text-primary); border:1px solid var(--border-color); border-radius:var(--radius-sm);">';
    html += '<option value="0.001"' + (obsLogInterval == 0.001 ? ' selected' : '') + '>1 ms (cok detayli)</option>';
    html += '<option value="0.005"' + (obsLogInterval == 0.005 ? ' selected' : '') + '>5 ms</option>';
    html += '<option value="0.01"' + (obsLogInterval == 0.01 ? ' selected' : '') + '>10 ms (varsayilan)</option>';
    html += '<option value="0.05"' + (obsLogInterval == 0.05 ? ' selected' : '') + '>50 ms</option>';
    html += '<option value="0.1"' + (obsLogInterval == 0.1 ? ' selected' : '') + '>100 ms (ozet)</option>';
    html += '</select>';
    html += '</label>';
    html += '</div>';
  }
  html += '</div>';

  html += '<table style="width:100%; font-size:0.68rem; border-collapse:collapse; border:1px solid var(--border-color);">';

  // Zaman modu: otomatik "maks hıza kadar"
  html += '<input type="hidden" id="ve-solver-timemode-' + node.id + '" value="stop">';

  // Çözüm yöntemi
  var method = d.method || 'rk4';
  var isAdaptive = method === 'rk45';
  html += '<tr style="border-bottom:1px solid var(--border-color);"><th style="padding:6px; text-align:left; background:var(--bg-tertiary); border-right:1px solid var(--border-color); font-weight:500; color:var(--text-secondary);">Çözüm yöntemi</th><td style="padding:6px; background:var(--bg-tertiary);"><select id="ve-solver-method-' + node.id + '" onchange="onVESolverParamChange(\'' + node.id + '\')" style="width:100%; padding:4px; font-size:0.68rem; background:var(--bg-input); color:var(--text-primary); border:1px solid var(--border-color); border-radius:var(--radius-sm);"><option value="euler"' + (method==='euler'?' selected':'') + '>Euler (1. derece)</option><option value="heun"' + (method==='heun'?' selected':'') + '>Heun (2. derece)</option><option value="ralston"' + (method==='ralston'?' selected':'') + '>Ralston (2. derece, optimal)</option><option value="rk4"' + (method==='rk4'?' selected':'') + '>RK4 (4. derece)</option><option value="rk45"' + (method==='rk45'?' selected':'') + '><span class="mf-ico mf-ico-zap"></span> RK45 Dormand-Prince (adaptif)</option></select></td></tr>';
  html += '<tr style="border-bottom:1px solid var(--border-color);"><td colspan="2" style="padding:3px 6px; font-size:0.54rem; color:var(--text-muted); background:var(--bg-secondary); line-height:1.3;"><b>Euler</b>: Hızlı, düşük doğruluk. <b>Heun</b>: İyi denge. <b>Ralston</b>: Optimal 2. derece. <b>RK4</b>: Yüksek doğruluk (önerilen). <b>RK45</b>: Adaptif adım — otomatik hassasiyet kontrolü.</td></tr>';

  // Sabit adım büyüklüğü (RK45 dışında)
  var ftDt = d.ftDt || 0.01;
  var showDtRow = method !== 'rk45';
  html += '<tr id="ve-solver-ftdt-row-' + node.id + '" style="border-bottom:1px solid var(--border-color);' + (!showDtRow ? 'display:none;' : '') + '"><th style="padding:6px; text-align:left; background:var(--bg-tertiary); border-right:1px solid var(--border-color); font-weight:500; color:var(--text-secondary);">Adım büyüklüğü Δt [s]</th><td style="padding:6px; background:var(--bg-tertiary);"><select id="ve-solver-ftdt-' + node.id + '" onchange="onVESolverParamChange(\'' + node.id + '\')" style="width:100%; padding:4px; font-size:0.68rem; background:var(--bg-input); color:var(--text-primary); border:1px solid var(--border-color); border-radius:var(--radius-sm);"><option value="0.05"' + (ftDt==0.05?' selected':'') + '>0.05 (hızlı)</option><option value="0.02"' + (ftDt==0.02?' selected':'') + '>0.02</option><option value="0.01"' + (ftDt==0.01?' selected':'') + '>0.01 (varsayılan)</option><option value="0.005"' + (ftDt==0.005?' selected':'') + '>0.005 (hassas)</option><option value="0.001"' + (ftDt==0.001?' selected':'') + '>0.001 (çok hassas)</option></select></td></tr>';

  // RK45 tolerans ayarları
  var ftAtol = d.ftAtol !== undefined ? d.ftAtol : 1e-6;
  var ftRtol = d.ftRtol !== undefined ? d.ftRtol : 1e-4;
  var showFtTol = method === 'rk45';
  html += '<tr id="ve-solver-fttol-row-' + node.id + '" style="border-bottom:1px solid var(--border-color);' + (!showFtTol ? 'display:none;' : '') + '"><th style="padding:6px; text-align:left; background:var(--bg-tertiary); border-right:1px solid var(--border-color); font-weight:500; color:var(--text-secondary);">Tolerans (ATol / RTol)</th><td style="padding:6px; background:var(--bg-tertiary);"><div style="display:flex; gap:4px; align-items:center;"><input type="text" id="ve-solver-ftatol-' + node.id + '" value="' + ftAtol + '" style="width:50%; padding:4px; font-size:0.68rem; background:var(--bg-input); color:var(--text-primary); border:1px solid var(--border-color); border-radius:var(--radius-sm); text-align:right; font-family:monospace;" onchange="onVESolverParamChange(\'' + node.id + '\')"><input type="text" id="ve-solver-ftrtol-' + node.id + '" value="' + ftRtol + '" style="width:50%; padding:4px; font-size:0.68rem; background:var(--bg-input); color:var(--text-primary); border:1px solid var(--border-color); border-radius:var(--radius-sm); text-align:right; font-family:monospace;" onchange="onVESolverParamChange(\'' + node.id + '\')"></div></td></tr>';
  html += '<tr id="ve-solver-fttol-desc-' + node.id + '" style="border-bottom:1px solid var(--border-color);' + (!showFtTol ? 'display:none;' : '') + '"><td colspan="2" style="padding:3px 6px; font-size:0.54rem; color:var(--text-muted); background:var(--bg-secondary); line-height:1.3;"><b>ATol</b>: Mutlak tolerans (hız m/s). <b>RTol</b>: Bağıl tolerans. Adaptif adım sayısı toleransa göre otomatik belirlenir.</td></tr>';
  
  // Güvenlik limiti — GÖRÜNÜR ve düzenlenebilir. Koşu bu süreye ulaşırsa
  // kesilir; kesilen koşu üst hızı olduğundan düşük raporlar, bu yüzden
  // değerin gizli kalmaması gerekiyor.
  html += '<tr style="border-bottom:1px solid var(--border-color);"><th style="padding:6px; text-align:left; background:var(--bg-tertiary); border-right:1px solid var(--border-color); font-weight:500; color:var(--text-secondary);">Güvenlik limiti [s]</th><td style="padding:6px; background:var(--bg-tertiary);"><input type="number" id="ve-solver-maxtime-' + node.id + '" value="' + maxSimTime + '" min="1" step="10" onchange="onVESolverParamChange(\'' + node.id + '\')" style="width:100%; padding:4px; font-size:0.68rem; background:var(--bg-input); color:var(--text-primary); border:1px solid var(--border-color); border-radius:0; text-align:right; font-family:monospace;"></td></tr>';
  html += '<tr style="border-bottom:1px solid var(--border-color);"><td colspan="2" style="padding:3px 6px; font-size:0.54rem; color:var(--text-muted); background:var(--bg-secondary); line-height:1.3;">Simülasyon en fazla bu kadar sürer. Koşu limite dayanırsa üst hıza ulaşılmadan kesilir — sonuç olduğundan düşük çıkar. Varsayılan ' + VE_DEFAULT_MAX_SIM_TIME + ' s.</td></tr>';

  html += '</table>';
  html += '</div>';                                   // ve-cp-col--in kapat (girdi)
  html += '<div class="ve-cp-col ve-cp-col--out">';   // SAĞ: referans + zincir + hesapla

  // ===== INTERPOLASYON BİLGİSİ =====
  html += '<div style="margin-top:10px; padding:8px 10px; background:var(--bg-secondary); border-radius:var(--radius-sm); border:1px solid var(--border-color);">';
  html += '<div style="display:flex; align-items:center; gap:5px; margin-bottom:5px;">';
  html += '<span style="font-size:0.62rem; font-weight:600; color:var(--text-heading);">Sayısal Yöntemler</span>';
  html += '</div>';
  html += '<div style="font-size:0.55rem; color:var(--text-muted); line-height:1.5;">';
  html += '<div style="display:flex; justify-content:space-between; padding:2px 0;"><span style="color:var(--text-secondary);">Tork interpolasyonu</span><span style="color:var(--text-primary); font-weight:500;">PCHIP Spline</span></div>';
  html += '<div style="display:flex; justify-content:space-between; padding:2px 0; border-top:1px solid var(--border-color);"><span style="color:var(--text-secondary);">Mesafe entegrasyonu</span><span style="color:var(--text-primary); font-weight:500;">Trapezoidal</span></div>';
  html += '<div style="display:flex; justify-content:space-between; padding:2px 0; border-top:1px solid var(--border-color);"><span style="color:var(--text-secondary);">Enerji dengesi</span><span style="color:var(--text-primary); font-weight:500;">Otomatik</span></div>';
  html += '</div></div>';
  
  // ===== TOPOLOJİ ZİNCİRİ ÖNİZLEME =====
  html += '<div style="margin-top:8px; padding:8px 10px; background:var(--bg-secondary); border-radius:var(--radius-sm); border:1px solid var(--border-color);">';
  html += '<div style="font-size:0.62rem; font-weight:600; color:var(--text-heading); margin-bottom:5px;">Güç Aktarma Zinciri</div>';
  html += '<div id="ve-solver-chain-' + node.id + '" style="font-size:0.56rem; color:var(--text-muted);">';
  
  var chain = veGetPowertrainChain();
  if(chain && chain.length > 0) {
    html += '<div style="display:flex; flex-wrap:wrap; align-items:center; gap:3px;">';
    chain.forEach(function(n, i) {
      if(i > 0) html += '<span style="color:var(--text-muted); font-size:0.48rem;">→</span>';
      html += '<span style="color:var(--accent-primary); font-weight:500; background:var(--bg-tertiary); padding:1px 6px; border-radius:var(--radius-sm); border:1px solid var(--border-color); font-size:0.54rem;">' + escapeHTML(n.customName || n.def.name) + '</span>';
    });
    html += '</div>';
  } else {
    html += '<span style="color:var(--accent-warning); font-size:0.54rem;">Bağlantılardan zincir oluşturulamadı. Bileşenleri bağlayın.</span>';
  }
  
  html += '</div></div>';
  
  // ===== HESAPLA BUTONU =====
  html += '<div style="margin-top:14px;">';
  html += '<button onclick="veSolverRunProfessional()" style="width:100%; padding:8px 12px; font-size:0.72rem; font-weight:600; background:linear-gradient(135deg, color-mix(in srgb, var(--accent-success) 65%, #000), color-mix(in srgb, var(--accent-success) 82%, #000)); color:white; border:none; border-radius:var(--radius-sm); cursor:pointer; display:flex; align-items:center; justify-content:center; gap:6px; box-shadow:0 2px 6px rgba(27,94,32,0.25); transition:all 0.15s; letter-spacing:0.03em;" onmouseenter="this.style.transform=\'translateY(-1px)\';this.style.boxShadow=\'0 4px 12px rgba(27,94,32,0.35)\'" onmouseleave="this.style.transform=\'\';this.style.boxShadow=\'0 2px 6px rgba(27,94,32,0.25)\'">';
  html += '▶ Hesapla';
  html += '</button>';
  html += '</div>';
  html += '</div>';                                   // ve-cp-col--out kapat
  html += '</div>';                                   // ve-cp-grid kapat

  html += '</div>';
  return html;
}

function onVESolverParamChange(nodeId) {
  var node = nodes.find(function(n) { return n.id === nodeId; });
  if(!node) return;
  if(!node.data) node.data = {};
  
  var el = function(id) { return document.getElementById(id); };
  var tmEl = el('ve-solver-timemode-' + nodeId);
  var durEl = el('ve-solver-duration-' + nodeId);
  var maxEl = el('ve-solver-maxtime-' + nodeId);
  var ssEl = el('ve-solver-stopspeed-' + nodeId);
  var resEl = el('ve-solver-resolution-' + nodeId);
  
  if(tmEl) {
    node.data.timeMode = tmEl.value;
    var isStop = tmEl.value === 'stop';
    var durRow = el('ve-solver-dur-row-' + nodeId);
    var maxRow = el('ve-solver-maxtime-row-' + nodeId);
    var stopRow = el('ve-solver-stopspeed-row-' + nodeId);
    if(durRow) durRow.style.display = isStop ? 'none' : '';
    if(maxRow) maxRow.style.display = isStop ? '' : 'none';
    if(stopRow) stopRow.style.display = 'none';
  }
  var pf = function(v, def) { var n = parseFloat(v); return isNaN(n) ? def : n; };
  if(durEl) node.data.duration = pf(durEl.value, 60);
  if(maxEl) node.data.maxSimTime = pf(maxEl.value, VE_DEFAULT_MAX_SIM_TIME);
  if(ssEl) node.data.stopSpeed = pf(ssEl.value, 2);

  // Çözünürlük → dt hesapla
  if(resEl) {
    var steps = parseInt(resEl.value) || 200;
    node.data.resolution = steps;
    var simTime = node.data.timeMode === 'stop' ? (node.data.maxSimTime || 300) : (node.data.duration || 60);
    node.data.dt = simTime / steps;
  }
  
  var methodEl = el('ve-solver-method-' + nodeId);
  if(methodEl) {
    node.data.method = methodEl.value;
    
    // RK45 tolerans satırlarının görünürlüğü (MF modu)
    var isAdaptive = methodEl.value === 'rk45';
    var tolRow = el('ve-solver-tol-row-' + nodeId);
    var tolDesc = el('ve-solver-tol-desc-' + nodeId);
    if(tolRow) tolRow.style.display = isAdaptive ? '' : 'none';
    if(tolDesc) tolDesc.style.display = isAdaptive ? '' : 'none';
    
    // FT modu: Δt satırı ve RK45 tolerans satırlarının görünürlüğü
    var ftDtRow = el('ve-solver-ftdt-row-' + nodeId);
    var ftTolRow = el('ve-solver-fttol-row-' + nodeId);
    var ftTolDesc = el('ve-solver-fttol-desc-' + nodeId);
    if(ftDtRow) ftDtRow.style.display = isAdaptive ? 'none' : '';
    if(ftTolRow) ftTolRow.style.display = isAdaptive ? '' : 'none';
    if(ftTolDesc) ftTolDesc.style.display = isAdaptive ? '' : 'none';
  }
  
  // RK45 tolerans parametreleri (MF modu)
  var atolEl = el('ve-solver-atol-' + nodeId);
  var rtolEl = el('ve-solver-rtol-' + nodeId);
  if(atolEl) node.data.atol = pf(atolEl.value, 1e-6);
  if(rtolEl) node.data.rtol = pf(rtolEl.value, 1e-4);
  
  // Performans Analizi checkbox
  var perfEl = el('ve-solver-perfanalysis-' + nodeId);
  if(perfEl) node.data.performanceAnalysis = perfEl.checked;

  // Kullanıcı Girişli Eğim Analizi checkbox
  var mgEl = el('ve-solver-manualgrade-' + nodeId);
  if(mgEl) node.data.manualGradeAnalysis = mgEl.checked;

  // Hızlanma-Yavaşlama checkbox + rapor zaman adımı
  var adEl = el('ve-solver-acceldecel-' + nodeId);
  if(adEl) {
    node.data.accelDecelAnalysis = adEl.checked;
    var sdIntWrap = document.getElementById('ve-solver-sdinterval-wrap-' + nodeId);
    if(sdIntWrap) sdIntWrap.style.display = adEl.checked ? '' : 'none';
  }
  var sdIntEl = el('ve-solver-sdinterval-' + nodeId);
  if(sdIntEl) node.data.sdReportInterval = parseFloat(sdIntEl.value) || 0.5;

  // Engel Atlama Analizi checkbox + log aralığı
  var ocEl = el('ve-solver-obscross-' + nodeId);
  if(ocEl) {
    node.data.obstacleCrossingAnalysis = ocEl.checked;
    var obsLogWrap = document.getElementById('ve-solver-obslog-wrap-' + nodeId);
    if(obsLogWrap) obsLogWrap.style.display = ocEl.checked ? '' : 'none';
  }
  var obsLogEl = el('ve-solver-obslog-' + nodeId);
  if(obsLogEl) node.data.obsLogInterval = parseFloat(obsLogEl.value) || 0.01;

  // FT modu parametreleri
  var ftDtEl = el('ve-solver-ftdt-' + nodeId);
  if(ftDtEl) node.data.ftDt = pf(ftDtEl.value, 0.01);
  var ftAtolEl = el('ve-solver-ftatol-' + nodeId);
  var ftRtolEl = el('ve-solver-ftrtol-' + nodeId);
  if(ftAtolEl) node.data.ftAtol = pf(ftAtolEl.value, 1e-6);
  if(ftRtolEl) node.data.ftRtol = pf(ftRtolEl.value, 1e-4);
}

// ===== VİTES GEÇİŞLERİ ÖZELLİKLERİ =====
function getGearShiftPropertiesHTML(node) {
  var html = '<div class="ve-cp-panel" style="border-top:1px solid var(--border-color); padding-top:12px;">';

  // ── Kaynak bileşenlerden veri çek ──
  var gbNode = nodes.find(function(n) { return n.type === 'gearbox'; });
  var engNode = nodes.find(function(n) { return n.type === 'engine' || n.type === 'engine-brake'; });
  var gbData = (gbNode && gbNode.data) || {};
  var engData = (engNode && engNode.data) || {};

  // Governed RPM
  var esp = engData.motorSpecs || {};
  var governed = parseFloat(esp.governedSpeed) || parseFloat(engData.governedRpm) || 0;
  if (!governed) governed = gbData.gbGovernedSpeed || 0;

  // Aktif shift profili (şanzımandan)
  var activeProfileKey = gbData.shiftProfile || 'allison3200sp_s1';
  // Node'da seçili profil (kullanıcı bu bileşende farklı profil gezebilir)
  var d = node.data || {};
  if (!d._gsSelectedProfile) d._gsSelectedProfile = activeProfileKey;
  var selectedKey = d._gsSelectedProfile;
  var spData = VE_FT_SHIFT_PROFILES[selectedKey] || {};
  var profileName = spData.name || 'Bilinmiyor';

  // Vites oranları
  var ftGears = gbData.ftGearData || VE_FT_GB_DEFAULT_GEARS;
  var fwdGears = ftGears.filter(function(g) { return g.name && g.name.charAt(0) === 'F'; });
  fwdGears.sort(function(a, b) { return (parseInt(a.name.replace('F','')) || 0) - (parseInt(b.name.replace('F','')) || 0); });

  // Shift referans RPM
  var shiftRefRPM = spData.shiftRefRPM || gbData.shiftRefRPM || governed;

  // ── Başlık ──
  html += '<div style="font-size:0.8rem; font-weight:600; color:var(--text-heading); margin-bottom:8px; display:flex; align-items:center; gap:6px;">';
  html += '<span>Vites Geçiş Analizi</span>';
  html += '</div>';

  // ── 1. Profil Seçici ──
  html += '<div style="background:var(--bg-tertiary); border-radius:8px; padding:10px; margin-bottom:10px;">';
  html += '<div style="font-size:0.72rem; font-weight:600; color:var(--text-heading); margin-bottom:6px;">Shift Profili</div>';

  html += '<select id="ve-gs-profile-' + node.id + '" onchange="onVEGearShiftProfileChange(\'' + node.id + '\')" style="width:100%; padding:6px 8px; font-size:0.7rem; background:var(--bg-input); color:var(--text-primary); border:1px solid var(--border-color); border-radius:4px; margin-bottom:6px;">';
  var profileKeys = Object.keys(VE_FT_SHIFT_PROFILES);
  for (var pi = 0; pi < profileKeys.length; pi++) {
    var pk = profileKeys[pi];
    var pn = VE_FT_SHIFT_PROFILES[pk].name || pk;
    var sel = (pk === selectedKey) ? ' selected' : '';
    var isActive = (pk === activeProfileKey) ? ' ★' : '';
    html += '<option value="' + pk + '"' + sel + '>' + pn + isActive + '</option>';
  }
  html += '</select>';

  // Profil özet bilgileri
  var lockupOffset = spData.lockupOffset || 0;
  html += '<div style="display:grid; grid-template-columns:1fr 1fr; gap:4px; font-size:0.62rem;">';
  html += '<div style="background:var(--bg-secondary); padding:5px 7px; border-radius:4px;"><span style="color:var(--text-muted);">Aile:</span> <span style="color:var(--text-heading); font-weight:500;">' + (spData.family || '—') + '</span></div>';
  html += '<div style="background:var(--bg-secondary); padding:5px 7px; border-radius:4px;"><span style="color:var(--text-muted);">Lockup Offset:</span> <span style="color:var(--text-heading); font-weight:500;">' + lockupOffset + ' rpm</span></div>';
  html += '<div style="background:var(--bg-secondary); padding:5px 7px; border-radius:4px;"><span style="color:var(--text-muted);">Shift Ref:</span> <span style="color:var(--text-heading); font-weight:500;">' + (shiftRefRPM > 0 ? shiftRefRPM + ' rpm' : 'Tanımsız') + '</span></div>';
  html += '<div style="background:var(--bg-secondary); padding:5px 7px; border-radius:4px;"><span style="color:var(--text-muted);">Gov. RPM:</span> <span style="color:var(--text-heading); font-weight:500;">' + (governed > 0 ? governed + ' rpm' : 'Tanımsız') + '</span></div>';
  html += '</div>';

  if (pk !== activeProfileKey && activeProfileKey !== selectedKey) {
    html += '<div style="font-size:0.58rem; color:var(--accent-warning); margin-top:4px;">★ Canvas\'taki şanzıman profili: ' + (VE_FT_SHIFT_PROFILES[activeProfileKey] ? VE_FT_SHIFT_PROFILES[activeProfileKey].name : activeProfileKey) + '</div>';
  }
  html += '</div>';

  // Governed RPM yoksa uyarı
  if (governed <= 0) {
    html += '<div style="background:var(--accent-danger); color:white; border-radius:6px; padding:10px; margin-bottom:10px; font-size:0.7rem; text-align:center;">Motor Governed RPM tanımlı değil. Eşik hesaplamaları yapılamaz.</div>';
    html += '</div>';
    return html;
  }

  // İKİ SÜTUN (kart yığını): profil seçici tam genişlik üstte kaldı; çıktı
  // kartları SOL = Converter + Lockup, SAĞ = Downshift + Matematik + Algoritma
  html += '<div class="ve-cp-grid ve-cp-grid--cards"><div class="ve-cp-col">';
  // ── 2. Converter-Mod Geçişleri ──
  html += '<div style="background:var(--bg-tertiary); border-radius:8px; padding:10px; margin-bottom:10px;">';
  html += '<div style="font-size:0.72rem; font-weight:600; color:var(--text-heading); margin-bottom:4px;">Converter-Mod Geçişleri</div>';
  html += '<p style="font-size:0.58rem; color:var(--text-muted); margin-bottom:8px; line-height:1.3;">Converter modda şanzıman çıkış devri (N<sub>out</sub>) belirli eşiklere ulaştığında geçiş tetiklenir.</p>';

  html += '<table style="width:100%; border-collapse:collapse; font-size:0.64rem; border:1px solid var(--border-color);">';
  html += '<thead><tr style="background:var(--bg-secondary);">';
  html += '<th style="padding:5px 6px; text-align:left; border-bottom:1px solid var(--border-color);">Geçiş</th>';
  html += '<th style="padding:5px 6px; text-align:center; border-bottom:1px solid var(--border-color);">Model</th>';
  html += '<th style="padding:5px 6px; text-align:left; border-bottom:1px solid var(--border-color);">Formül / Katsayılar</th>';
  html += '<th style="padding:5px 6px; text-align:center; border-bottom:1px solid var(--border-color);">Eşik<br>[rpm]</th>';
  html += '</tr></thead><tbody>';

  // 1C→2C
  var cs = spData.converterShifts;
  var ratio1C2C = spData.shift1C2C_outRatio || 0.2150;
  var thr1C2C, model1C2C, formula1C2C;

  if (cs && cs['1C2C']) {
    model1C2C = 'Lineer';
    formula1C2C = 'N<sub>out</sub> = ' + cs['1C2C'].a + ' × ESL + (' + (cs['1C2C'].b || 0) + ')';
    thr1C2C = (cs['1C2C'].a * shiftRefRPM + (cs['1C2C'].b || 0)).toFixed(0);
  } else {
    model1C2C = 'Sabit Oran';
    formula1C2C = 'N<sub>out</sub> ≥ ' + ratio1C2C + ' × N<sub>ref</sub>';
    thr1C2C = (ratio1C2C * shiftRefRPM).toFixed(0);
  }
  html += '<tr style="border-bottom:1px solid var(--border-color);">';
  html += '<td style="padding:5px 6px; font-weight:600; color:var(--accent-primary);">1C → 2C</td>';
  html += '<td style="padding:5px 6px; text-align:center;"><span style="background:var(--bg-secondary); padding:2px 6px; border-radius:3px; font-size:0.58rem;">' + model1C2C + '</span></td>';
  html += '<td style="padding:5px 6px; font-family:monospace; font-size:0.6rem;">' + formula1C2C + '</td>';
  html += '<td style="padding:5px 6px; text-align:center; font-weight:600; color:var(--accent-primary);">' + thr1C2C + '</td>';
  html += '</tr>';

  // 2C→2L
  var thr2C2L, model2C2L, formula2C2L;
  if (cs && cs['2C2L']) {
    var cs2L = cs['2C2L'];
    if (cs2L.type === 'segmented') {
      model2C2L = 'Segmentli';
      formula2C2L = 'ESL ≥ ' + cs2L.linear.validFrom + ': a=' + cs2L.linear.a + ', b=' + cs2L.linear.b;
      if (cs2L.lookup && cs2L.lookup.length > 0) {
        formula2C2L += '<br>Lookup: [' + cs2L.lookup.map(function(p) { return p[0] + '→' + p[1]; }).join(', ') + ']';
      }
      if (shiftRefRPM >= cs2L.linear.validFrom) {
        thr2C2L = (cs2L.linear.a * shiftRefRPM + cs2L.linear.b).toFixed(0);
      } else if (cs2L.lookup && cs2L.lookup.length > 0) {
        thr2C2L = cs2L.lookup[cs2L.lookup.length - 1][1].toFixed(0);
      } else {
        thr2C2L = '—';
      }
    } else {
      model2C2L = 'Lineer';
      formula2C2L = 'N<sub>out</sub> = ' + cs2L.a + ' × ESL + (' + (cs2L.b || 0) + ')';
      thr2C2L = (cs2L.a * shiftRefRPM + (cs2L.b || 0)).toFixed(0);
    }
  } else if (spData.shift2C2L_outRatio) {
    model2C2L = 'Sabit Oran';
    formula2C2L = 'N<sub>out</sub> ≥ ' + spData.shift2C2L_outRatio + ' × N<sub>ref</sub>';
    thr2C2L = (spData.shift2C2L_outRatio * shiftRefRPM).toFixed(0);
  } else {
    model2C2L = '—';
    formula2C2L = 'Tanımsız';
    thr2C2L = '—';
  }
  html += '<tr>';
  html += '<td style="padding:5px 6px; font-weight:600; color:var(--accent-primary);">2C → 2L</td>';
  html += '<td style="padding:5px 6px; text-align:center;"><span style="background:var(--bg-secondary); padding:2px 6px; border-radius:3px; font-size:0.58rem;">' + model2C2L + '</span></td>';
  html += '<td style="padding:5px 6px; font-family:monospace; font-size:0.6rem;">' + formula2C2L + '</td>';
  html += '<td style="padding:5px 6px; text-align:center; font-weight:600; color:var(--accent-primary);">' + thr2C2L + '</td>';
  html += '</tr>';

  html += '</tbody></table>';
  html += '</div>';

  // ── 3. Lockup-Mod Upshift Tablosu ──
  html += '<div style="background:var(--bg-tertiary); border-radius:8px; padding:10px; margin-bottom:10px;">';
  html += '<div style="font-size:0.72rem; font-weight:600; color:var(--text-heading); margin-bottom:4px;">Lockup-Mod Upshift Eşikleri</div>';
  html += '<p style="font-size:0.58rem; color:var(--text-muted); margin-bottom:8px; line-height:1.3;">Lockup modda: N<sub>out</sub> = N<sub>engine</sub> / i<sub>gear</sub> (SR = 1.0). Geçiş koşulu: N<sub>out</sub> ≥ a × ESL + b</p>';

  var luShifts = spData.lockupShifts;
  if (luShifts) {
    html += '<div style="overflow-x:auto; border:1px solid var(--border-color); border-radius:6px;">';
    html += '<table style="width:100%; border-collapse:collapse; font-size:0.62rem;">';
    html += '<thead style="background:var(--bg-secondary);">';
    html += '<tr>';
    html += '<th style="padding:5px 6px; text-align:center; border-bottom:1px solid var(--border-color);">Geçiş</th>';
    html += '<th style="padding:5px 6px; text-align:center; border-bottom:1px solid var(--border-color);">Model</th>';
    html += '<th style="padding:5px 6px; text-align:center; border-bottom:1px solid var(--border-color);">a</th>';
    html += '<th style="padding:5px 6px; text-align:center; border-bottom:1px solid var(--border-color);">b</th>';
    html += '<th style="padding:5px 6px; text-align:center; border-bottom:1px solid var(--border-color);">minCap</th>';
    html += '<th style="padding:5px 6px; text-align:center; border-bottom:1px solid var(--border-color);">i<sub>gear</sub></th>';
    html += '<th style="padding:5px 6px; text-align:center; border-bottom:1px solid var(--border-color);">Eşik<br>[rpm]</th>';
    html += '</tr></thead><tbody>';

    var luKeys = Object.keys(luShifts);
    for (var li = 0; li < luKeys.length; li++) {
      var luKey = luKeys[li];
      var ls = luShifts[luKey];
      var threshold = calcLockupShiftThreshold(ls, shiftRefRPM);

      // Vites oranını bul
      var fromGearNum = parseInt(luKey.charAt(0)) || 0;
      var matchGear = fwdGears.length >= fromGearNum ? fwdGears[fromGearNum - 1] : null;
      var iGear = matchGear ? (parseFloat(matchGear.ratio) || 1) : (ls.a ? (1 / ls.a).toFixed(3) : '—');

      var modelType, aVal, bVal, capVal;
      if (ls.type === 'piecewise') {
        modelType = 'Parçalı';
        aVal = ls.low.a + ' / ' + ls.high.a;
        bVal = (ls.low.b || 0) + ' / ' + (ls.high.b || 0);
        capVal = 'BP: ' + ls.breakpoint;
      } else if (ls.type === 'segments') {
        modelType = 'Segmentli';
        aVal = ls.segments.filter(function(s) { return s.a !== undefined; }).map(function(s) { return s.a; }).join(' / ') || '—';
        bVal = ls.segments.filter(function(s) { return s.b !== undefined; }).map(function(s) { return s.b; }).join(' / ') || '—';
        capVal = ls.segments.filter(function(s) { return s.cap !== undefined; }).map(function(s) { return s.cap; }).join(', ') || '—';
      } else {
        modelType = 'Lineer';
        aVal = ls.a !== undefined ? ls.a : '—';
        bVal = ls.b !== undefined ? ls.b : 0;
        capVal = ls.minCap !== undefined ? ls.minCap : (ls.capValue !== undefined ? ls.capValue + ' (<' + ls.capBelow + ')' : '—');
      }

      // Geçiş adını oku: '2L3L' → '2L → 3L'
      var shiftLabel = luKey.replace(/(\d+L)(\d+L)/, '$1 → $2');

      html += '<tr style="border-bottom:1px solid var(--border-color);">';
      html += '<td style="padding:4px 6px; text-align:center; font-weight:600; color:var(--accent-primary);">' + shiftLabel + '</td>';
      html += '<td style="padding:4px 6px; text-align:center;"><span style="background:var(--bg-secondary); padding:1px 5px; border-radius:3px; font-size:0.56rem;">' + modelType + '</span></td>';
      html += '<td style="padding:4px 6px; text-align:center; font-family:monospace;">' + aVal + '</td>';
      html += '<td style="padding:4px 6px; text-align:center; font-family:monospace;">' + bVal + '</td>';
      html += '<td style="padding:4px 6px; text-align:center; font-family:monospace; color:var(--text-muted);">' + capVal + '</td>';
      html += '<td style="padding:4px 6px; text-align:center; font-family:monospace;">' + (typeof iGear === 'number' ? iGear.toFixed(3) : iGear) + '</td>';
      html += '<td style="padding:4px 6px; text-align:center; font-weight:600; color:var(--accent-success);">' + threshold.toFixed(0) + '</td>';
      html += '</tr>';
    }
    html += '</tbody></table></div>';
  } else {
    html += '<div style="font-size:0.68rem; color:var(--text-muted); text-align:center; padding:8px;">Bu profilde per-gear lockup shift verisi tanımlı değil. Sabit ofset kullanılır: N<sub>engine</sub> ≥ N<sub>ref</sub> − ' + lockupOffset + '</div>';
  }
  html += '</div>';

  // ── 4. Downshift Tablosu ──
  html += '</div>';                                    // ve-cp-col (sol) kapat
  html += '<div class="ve-cp-col">';                   // SAĞ sütun: downshift + matematik + algoritma
  html += '<div style="background:var(--bg-tertiary); border-radius:8px; padding:10px; margin-bottom:10px;">';
  html += '<div style="font-size:0.72rem; font-weight:600; color:var(--text-heading); margin-bottom:4px;">Downshift Eşikleri</div>';
  html += '<p style="font-size:0.58rem; color:var(--text-muted); margin-bottom:8px; line-height:1.3;">Downshift koşulu: N<sub>out</sub> &lt; eşik → alt vitese düş. Histerezis = upshift eşiği − downshift eşiği.</p>';

  var dsThresholds = spData.downshiftThresholds;
  if (dsThresholds) {
    html += '<div style="overflow-x:auto; border:1px solid var(--border-color); border-radius:6px;">';
    html += '<table style="width:100%; border-collapse:collapse; font-size:0.62rem;">';
    html += '<thead style="background:var(--bg-secondary);">';
    html += '<tr>';
    html += '<th style="padding:5px 6px; text-align:center; border-bottom:1px solid var(--border-color);">Geçiş</th>';
    html += '<th style="padding:5px 6px; text-align:center; border-bottom:1px solid var(--border-color);">Model</th>';
    html += '<th style="padding:5px 6px; text-align:center; border-bottom:1px solid var(--border-color);">a</th>';
    html += '<th style="padding:5px 6px; text-align:center; border-bottom:1px solid var(--border-color);">b</th>';
    html += '<th style="padding:5px 6px; text-align:center; border-bottom:1px solid var(--border-color);">Cap / Özel</th>';
    html += '<th style="padding:5px 6px; text-align:center; border-bottom:1px solid var(--border-color);">Eşik<br>[rpm]</th>';
    html += '<th style="padding:5px 6px; text-align:center; border-bottom:1px solid var(--border-color);">Histerezis<br>[rpm]</th>';
    html += '</tr></thead><tbody>';

    var dsKeys = Object.keys(dsThresholds);
    for (var di = 0; di < dsKeys.length; di++) {
      var dsKey = dsKeys[di];
      var ds = dsThresholds[dsKey];
      var dsThr = calcLockupShiftThreshold(ds, shiftRefRPM);

      // Histerezis: karşılık gelen upshift eşiğini bul
      // dsKey: '6to5' → upshift '5L6L'
      var dsMatch = dsKey.match(/(\d+)to(\d+)/);
      var hysteresis = '—';
      if (dsMatch && luShifts) {
        var upKey = dsMatch[2] + 'L' + dsMatch[1] + 'L';
        if (luShifts[upKey]) {
          var upThr = calcLockupShiftThreshold(luShifts[upKey], shiftRefRPM);
          hysteresis = (upThr - dsThr).toFixed(0);
        }
      }

      var dsModelType, dsAVal, dsBVal, dsCapVal;
      if (ds.type === 'piecewise') {
        dsModelType = 'Parçalı';
        dsAVal = ds.low.a + ' / ' + ds.high.a;
        dsBVal = (ds.low.b || 0) + ' / ' + (ds.high.b || 0);
        dsCapVal = 'BP: ' + ds.breakpoint;
      } else if (ds.type === 'segments') {
        dsModelType = 'Segmentli';
        dsAVal = ds.segments.filter(function(s) { return s.a !== undefined; }).map(function(s) { return s.a; }).join(' / ') || '—';
        dsBVal = ds.segments.filter(function(s) { return s.b !== undefined; }).map(function(s) { return s.b; }).join(' / ') || '—';
        dsCapVal = ds.segments.filter(function(s) { return s.cap !== undefined; }).map(function(s) { return s.cap; }).join(', ') || '—';
      } else {
        dsModelType = 'Lineer';
        dsAVal = ds.a !== undefined ? ds.a : '—';
        dsBVal = ds.b !== undefined ? ds.b : 0;
        dsCapVal = ds.capValue !== undefined ? ds.capValue + ' (<' + ds.capBelow + ')' : (ds.minCap !== undefined ? ds.minCap : '—');
      }

      // Geçiş adı: '6to5' → '6 → 5'
      var dsLabel = dsKey.replace(/(\d+)to(\d+)/, '$1 → $2');

      html += '<tr style="border-bottom:1px solid var(--border-color);">';
      html += '<td style="padding:4px 6px; text-align:center; font-weight:600; color:var(--accent-danger);">' + dsLabel + '</td>';
      html += '<td style="padding:4px 6px; text-align:center;"><span style="background:var(--bg-secondary); padding:1px 5px; border-radius:3px; font-size:0.56rem;">' + dsModelType + '</span></td>';
      html += '<td style="padding:4px 6px; text-align:center; font-family:monospace;">' + dsAVal + '</td>';
      html += '<td style="padding:4px 6px; text-align:center; font-family:monospace;">' + dsBVal + '</td>';
      html += '<td style="padding:4px 6px; text-align:center; font-family:monospace; color:var(--text-muted);">' + dsCapVal + '</td>';
      html += '<td style="padding:4px 6px; text-align:center; font-weight:600; color:var(--accent-danger);">' + dsThr.toFixed(0) + '</td>';
      html += '<td style="padding:4px 6px; text-align:center; font-weight:500; color:var(--accent-warning);">' + hysteresis + '</td>';
      html += '</tr>';
    }
    html += '</tbody></table></div>';
  } else {
    html += '<div style="font-size:0.68rem; color:var(--text-muted); text-align:center; padding:8px;">Bu profilde downshift eşikleri tanımlı değil (sadece upshift).</div>';
  }
  html += '</div>';

  // ── 5. Matematik Özeti ──
  html += '<div style="background:var(--bg-tertiary); border-radius:8px; padding:10px; margin-bottom:10px;">';
  html += '<div style="font-size:0.72rem; font-weight:600; color:var(--text-heading); margin-bottom:6px;">Matematiksel Modeller</div>';

  var mathStyle = 'background:var(--bg-input); border-radius:5px; padding:8px 10px; border:1px solid var(--border-color); font-family:monospace; font-size:0.58rem; line-height:1.8; color:var(--text-secondary); margin-bottom:6px;';

  html += '<div style="' + mathStyle + '">';
  html += '<span style="color:var(--accent-primary); font-weight:600;">Lineer Model:</span><br>';
  html += '  N<sub>out</sub> = a × ESL + b<br>';
  html += '  a ≈ 1/i<sub>gear</sub> (eğim, vites oranının tersi)<br>';
  html += '  b = zamanlama ofseti (+ erken, − geç)<br>';
  html += '  ESL = Engine Speed Limit (governed RPM)';
  html += '</div>';

  html += '<div style="' + mathStyle + '">';
  html += '<span style="color:var(--accent-warning); font-weight:600;">minCap Koruması:</span><br>';
  html += '  thr = max(a × ESL + b, minCap)<br>';
  html += '  Düşük ESL\'de formül çok düşük çıkarsa minCap devreye girer';
  html += '</div>';

  html += '<div style="' + mathStyle + '">';
  html += '<span style="color:var(--accent-danger); font-weight:600;">Parçalı Lineer (Piecewise):</span><br>';
  html += '  ESL ≤ breakpoint → a<sub>low</sub> × ESL + b<sub>low</sub><br>';
  html += '  ESL &gt; breakpoint → a<sub>high</sub> × ESL + b<sub>high</sub>';
  html += '</div>';

  html += '<div style="' + mathStyle + '">';
  html += '<span style="color:var(--text-heading); font-weight:600;">Segmentli Model:</span><br>';
  html += '  [ESL ≤ maxESL₁] → cap veya a₁ × ESL + b₁<br>';
  html += '  [ESL ≤ maxESL₂] → a₂ × ESL + b₂<br>';
  html += '  [ESL &gt; maxESL₂] → a₃ × ESL + b₃';
  html += '</div>';

  html += '<div style="background:var(--bg-secondary); border-left:3px solid var(--accent-primary); border-radius:0 5px 5px 0; padding:8px 10px; font-size:0.57rem; color:var(--text-muted); line-height:1.5; font-style:italic;">';
  html += 'Tüm katsayılar iSCAAN çapraz validasyondan türetilmiştir. Tipik max hata: ±0.5 rpm (lineer), ±6-12 rpm (nonlineer bölgeler).';
  html += '</div>';
  html += '</div>';

  // ── 6. Shift Mantığı Akışı ──
  html += '<div style="background:var(--bg-tertiary); border-radius:8px; padding:10px; margin-bottom:10px;">';
  html += '<div style="font-size:0.72rem; font-weight:600; color:var(--text-heading); margin-bottom:6px;">Vites Geçiş Algoritması</div>';

  var codeStyle = 'background:var(--bg-input); border-radius:5px; padding:10px; border:1px solid var(--border-color); font-family:monospace; font-size:0.55rem; line-height:1.7; color:var(--text-secondary); overflow-x:auto; white-space:pre;';

  html += '<div style="' + codeStyle + '">';
  html += '<span style="color:var(--text-muted);">Girdiler: N_engine, SR, i_gear, current_gear, mode</span>\n';
  html += '<span style="color:var(--text-muted);">ESL = ' + shiftRefRPM + ' rpm (Shift Referans)</span>\n\n';

  html += '<span style="color:var(--accent-warning); font-weight:600;">── CONVERTER MODU ──</span>\n\n';
  html += '<span style="color:var(--accent-primary);">1C → 2C (F1 → F2, converter):</span>\n';
  html += '  N_out = N_engine × SR / i_F1\n';
  html += '  Koşul: N_out ≥ ' + thr1C2C + ' rpm\n\n';
  html += '<span style="color:var(--accent-primary);">2C → 2L (lockup kilitleme):</span>\n';
  html += '  N_out = N_engine × SR / i_F2\n';
  html += '  Koşul: N_out ≥ ' + thr2C2L + ' rpm\n\n';

  html += '<span style="color:var(--accent-warning); font-weight:600;">── LOCKUP MODU ──</span>\n\n';
  html += '<span style="color:var(--accent-primary);">Upshift (2L → 3L → ... → 6L):</span>\n';
  html += '  N_out = N_engine / i_gear  (SR = 1.0)\n';
  html += '  Koşul: N_out ≥ a × ESL + b\n';
  html += '  Shift sonrası: N_eng_yeni = N_eng × (i_eski / i_yeni)\n\n';

  if (dsThresholds) {
    html += '<span style="color:var(--accent-danger);">Downshift (6 → 5 → ... → 2 → 1C):</span>\n';
    html += '  N_out = N_engine / i_gear\n';
    html += '  Koşul: N_out &lt; downshift eşiği\n';
    html += '  2L → 1C: Converter moduna geri dön\n\n';
  }

  html += '<span style="color:var(--accent-warning); font-weight:600;">── SHIFT SIRASI ──</span>\n\n';
  html += '<span style="color:var(--accent-primary); font-weight:600;">1C → 2C → 2L → 3L → 4L → 5L → 6L</span>';
  if (dsThresholds) {
    html += '\n<span style="color:var(--accent-danger); font-weight:600;">6L → 5L → 4L → 3L → 2L → 1C</span> (yavaşlama)';
  }
  html += '</div>';

  html += '</div>';
  html += '</div>';                                    // ve-cp-col (sağ) kapat
  html += '</div>';                                    // ve-cp-grid kapat

  html += '</div>';
  return html;
}

// Vites Geçişleri — profil değişikliği
function onVEGearShiftProfileChange(nodeId) {
  var node = nodes.find(function(n) { return n.id === nodeId; });
  if (!node) return;
  if (!node.data) node.data = {};
  var sel = document.getElementById('ve-gs-profile-' + nodeId);
  if (sel) {
    node.data._gsSelectedProfile = sel.value;
    showNodeProperties(node);
  }
}

