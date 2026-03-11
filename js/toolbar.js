
// ============================================================================
// TOOLBAR FONKSİYONLARI
// ============================================================================
function veZoomIn() {
  var rect = document.getElementById('ve-canvas-wrapper').getBoundingClientRect();
  var centerX = rect.width / 2;
  var centerY = rect.height / 2;
  
  var oldZoom = canvasZoom;
  canvasZoom = Math.min(3, canvasZoom * 1.2);
  var zoomRatio = canvasZoom / oldZoom;
  canvasOffset.x = centerX - (centerX - canvasOffset.x) * zoomRatio;
  canvasOffset.y = centerY - (centerY - canvasOffset.y) * zoomRatio;
  updateCanvasTransform();
  showToast('Zoom: ' + Math.round(canvasZoom * 100) + '%');
}

function veZoomOut() {
  var rect = document.getElementById('ve-canvas-wrapper').getBoundingClientRect();
  var centerX = rect.width / 2;
  var centerY = rect.height / 2;
  
  var oldZoom = canvasZoom;
  canvasZoom = Math.max(0.2, canvasZoom * 0.8);
  var zoomRatio = canvasZoom / oldZoom;
  canvasOffset.x = centerX - (centerX - canvasOffset.x) * zoomRatio;
  canvasOffset.y = centerY - (centerY - canvasOffset.y) * zoomRatio;
  updateCanvasTransform();
  showToast('Zoom: ' + Math.round(canvasZoom * 100) + '%');
}

function veResetView() {
  canvasZoom = 1;
  canvasOffset = {x: 3000, y: 3000};
  updateCanvasTransform();
  showToast('Görünüm sıfırlandı');
}

function veUndo() {
  undo();
}

function veRedo() {
  redo();
}

// ===== DOSYA MENÜSÜ =====
function veToggleFileMenu() {
  var menu = document.getElementById('ve-file-menu');
  if(!menu) return;
  var show = menu.style.display === 'none';
  menu.style.display = show ? 'block' : 'none';
  if(show) {
    // Menü dışına tıklanınca kapat
    setTimeout(function() {
      document.addEventListener('click', veCloseFileMenu, {once: true});
    }, 10);
  }
}
function veCloseFileMenu(e) {
  var menu = document.getElementById('ve-file-menu');
  if(menu) menu.style.display = 'none';
}
function veNewProject() {
  veCloseFileMenu();
  var totalNodes = 0;
  veTabs.forEach(function(t, i) {
    if(i === veActiveTabIdx) totalNodes += nodes.length;
    else totalNodes += (t.nodeCount || 0);
  });
  
  var doNew = function() {
    if(veSplitMode) veCloseSplit();
    veClearCanvasDOM();
    veTabs = [];
    veActiveTabIdx = 0;
    veTabCounter = 0;
    compCounter = 0;
    veProjectName = '';
    var btn = document.getElementById('ve-project-name-btn');
    if(btn) btn.textContent = '⚙ MFSim ▾';
    veAddTab('Topoloji 1');
    showToast('Yeni proje oluşturuldu');
  };
  
  if(totalNodes > 0) {
    showConfirmToast('Mevcut projeyi kapatıp yeni proje oluşturulsun mu?', doNew);
  } else {
    doNew();
  }
}

// Proje adı - dosya adından veya topolojiden otomatik al
var veProjectName = '';
(function() {
  // Dosya adından proje adı çıkar
  var title = document.title || '';
  if(!title || title === 'Motor Freni Performans Hesaplayıcı') {
    // URL'den dosya adı al
    var path = window.location.pathname;
    var fname = path.split('/').pop().replace(/\.html?$/i, '').replace(/_/g, ' ').trim();
    if(fname) veProjectName = fname;
  } else {
    veProjectName = title;
  }
  // Proje buton metnini güncelle
  setTimeout(function() {
    var btn = document.getElementById('ve-project-name-btn');
    if(btn && veProjectName) {
      var shortName = veProjectName.length > 18 ? veProjectName.substring(0, 16) + '…' : veProjectName;
      btn.textContent = '⚙ ' + shortName + ' ▾';
    }
  }, 500);
})();

// ===== TOPOLOJİ ÖZETİ =====
function veGenerateTopologySummary() {
  var lines = [];
  var sep = '═══════════════════════════════════════════════════════════════════════';
  var thin = '───────────────────────────────────────────────────────────────────────';
  
  lines.push(sep);
  lines.push('  TOPOLOJİ ÖZETİ — ' + (veProjectName || 'Motor Freni Projesi'));
  lines.push(sep);
  lines.push('  Tarih           : ' + new Date().toLocaleString('tr-TR'));
  lines.push('  Bileşen Sayısı  : ' + nodes.length);
  lines.push('  Bağlantı Sayısı : ' + connections.length);
  lines.push('  Canvas Zoom     : ' + (canvasZoom * 100).toFixed(0) + '%');
  lines.push('');
  
  nodes.forEach(function(node, idx) {
    var def = node.def || componentDefs[node.type] || {};
    var displayName = node.customName || def.name || node.type;
    var d = node.data || {};
    
    lines.push('┌' + thin.substring(1));
    lines.push('│ [' + (idx+1) + '] ' + displayName);
    lines.push('│     Tip: ' + node.type + '  |  ID: ' + node.id + '  |  Konum: (' + Math.round(node.x) + ', ' + Math.round(node.y) + ')');
    lines.push('├' + thin.substring(1));
    
    if(node.type === 'engine' || node.type === 'engine-brake') {
      var ed = d;
      lines.push('│  Kategori            : ' + (ed.motorCategory || '—'));
      lines.push('│  Marka               : ' + (ed.motorBrand || '—'));
      lines.push('│  Model               : ' + (ed.motorModel || '—'));
      lines.push('│  Governed RPM        : ' + (ed.governedRpm || '—') + ' d/d');
      lines.push('│  Motor Freni Verimi  : %' + (ed.verim !== undefined ? ed.verim : 100));
      if(ed.motorData && ed.motorData.length > 0) {
        var rpms = ed.motorData.map(function(x){return x.rpm||0;});
        var torques = ed.motorData.filter(function(x){return x.torque!==null&&x.torque!==undefined;}).map(function(x){return x.torque;});
        var powers = ed.motorData.filter(function(x){return x.power!==null&&x.power!==undefined;}).map(function(x){return x.power;});
        lines.push('│  Veri Noktası        : ' + ed.motorData.length + ' adet');
        lines.push('│  RPM Aralığı         : ' + Math.min.apply(null,rpms) + ' – ' + Math.max.apply(null,rpms) + ' d/d');
        if(torques.length) lines.push('│  Maks. Tork          : ' + Math.max.apply(null,torques).toFixed(1) + ' Nm');
        if(powers.length) lines.push('│  Maks. Güç           : ' + Math.max.apply(null,powers).toFixed(1) + ' kW');
        lines.push('│');
        lines.push('│  ┌──── Tork/Güç Tablosu ────────────────────────────┐');
        lines.push('│  │ RPM       Tork [Nm]     Güç [kW]                │');
        lines.push('│  ├──────────────────────────────────────────────────┤');
        ed.motorData.forEach(function(r) {
          var rpmStr = String(r.rpm||0).padStart(7);
          var torqStr = (r.torque !== null && r.torque !== undefined ? r.torque.toFixed(1) : '—').padStart(13);
          var powStr = (r.power !== null && r.power !== undefined ? r.power.toFixed(1) : '—').padStart(13);
          lines.push('│  │' + rpmStr + torqStr + powStr + '                │');
        });
        lines.push('│  └──────────────────────────────────────────────────┘');
      } else {
        lines.push('│  Tork Tablosu        : (boş)');
      }
    }
    
    if(node.type === 'gearbox') {
      lines.push('│  Model               : ' + (d.selectedGearbox || '—'));
      lines.push('│  Verim               : %' + (d.efficiency !== undefined ? d.efficiency : 97));
      lines.push('│  Başlangıç Vites     : ' + (d.selectedGear || '—') + '. vites');
      lines.push('│  Seçili Vites Oranı  : ' + (d.selectedGearRatio || '—'));
      if(d.gearData && d.gearData.length > 0) {
        lines.push('│  Vites Sayısı        : ' + d.gearData.length);
        lines.push('│');
        lines.push('│  ┌──── Vites Tablosu ───────────────────────────────┐');
        lines.push('│  │ Vites    Oran         Not                       │');
        lines.push('│  ├──────────────────────────────────────────────────┤');
        d.gearData.forEach(function(g) {
          var gStr = String(g.gear||'?').padStart(5);
          var rStr = String(g.ratio||'—').padStart(10);
          var nStr = '  ' + (g.note || '');
          lines.push('│  │' + gStr + rStr + nStr.padEnd(33) + '│');
        });
        lines.push('│  └──────────────────────────────────────────────────┘');
      } else {
        lines.push('│  Vites Tablosu       : (boş)');
      }
    }
    
    if(node.type === 'torque-converter') {
      lines.push('│  Tork Çarpanı        : ' + (d.tcRatio || 1.0));
      lines.push('│  Kilit Durumu        : ' + (d.isLocked !== false ? 'Kilitli (Lock-up)' : 'Kilitsiz'));
      lines.push('│  K-Faktörü           : ' + (d.kFactor || '—'));
    }
    
    if(node.type === 'transfer') {
      lines.push('│  Marka               : ' + (d.selectedBrand || '—'));
      lines.push('│  Model               : ' + (d.selectedTransfer || '—'));
      lines.push('│  Verim               : %' + (d.efficiency !== undefined ? d.efficiency : 98));
      lines.push('│  Seçili Mod          : ' + (d.selectedMode || '—'));
      lines.push('│  Seçili Oran         : ' + (d.selectedRatio || '—'));
      if(d.transferData && d.transferData.length > 0) {
        lines.push('│');
        lines.push('│  ┌──── Kademe Tablosu ──────────────────────────────┐');
        d.transferData.forEach(function(t) {
          var sel = (d.selectedMode && d.selectedMode === t.mode) ? ' ← AKTİF' : '';
          lines.push('│  │  ' + (t.mode||'?') + ' → Oran: ' + (t.ratio||'—') + sel);
        });
        lines.push('│  └──────────────────────────────────────────────────┘');
      }
    }
    
    if(node.type === 'differential') {
      if(node.isMasterDiff) lines.push('│  ★ MASTER DİFERANSİYEL');
      else if(nodes.filter(function(nn) { return nn.type === 'differential'; }).length > 1) lines.push('│  🔗 SLAVE (master tarafından kontrol ediliyor)');
      lines.push('│  Diferansiyel Oranı  : ' + (d.diffRatio || 6.54));
      lines.push('│  Verim               : %' + (d.efficiency !== undefined ? d.efficiency : 96));
    }
    
    if(node.type === 'wheel') {
      if(node.isMasterWheel) lines.push('│  ★ MASTER TEKERLEK');
      else lines.push('│  🔗 SLAVE (master tarafından kontrol ediliyor)');
      lines.push('│  Tekerlek Yarıçapı   : ' + (d.wheelRadius !== undefined ? d.wheelRadius : 0.60876) + ' m');
      lines.push('│  Crr (yuvarlanma)    : ' + (d.rollingResistance !== undefined ? d.rollingResistance : 0.010));
      lines.push('│  δ (döner kütle)     : ' + (d.rotatingMass !== undefined ? d.rotatingMass : 1.08));
      var cdN = nodes.find(function(n) { return n.type === 'coast-down'; });
      if(cdN && cdN.data && cdN.data.crr) lines.push('│  🔒 Coast-Down Crr   : ' + cdN.data.crr);
    }
    
    if(node.type === 'vehicle') {
      lines.push('│  Kütle                : ' + (d.mass || 20000) + ' kg');
      lines.push('│  Başlangıç Hızı      : ' + (d.initialSpeed || 0) + ' km/h');
      lines.push('│  Cd (sürüklenme)     : ' + (d.cd || 0.65));
      lines.push('│  Frontal Alan        : ' + (d.frontalArea || 6.7) + ' m²');
      lines.push('│  Oto. Vites Değişimi : ' + (d.autoShift ? 'Aktif' : 'Pasif'));
    }
    
    if(node.type === 'road') {
      lines.push('│  Eğim                : %' + (d.grade !== undefined ? d.grade : 0));
      lines.push('│  Yükseklik           : ' + (d.altitude || 0) + ' m');
      lines.push('│  Sıcaklık            : ' + (d.temperature !== undefined ? d.temperature : 15) + ' °C');
      lines.push('│  Hava Yoğunluğu      : ' + (d.airDensity ? (typeof d.airDensity === 'number' ? d.airDensity.toFixed(4) : d.airDensity) : '1.2250') + ' kg/m³');
      if(d.routeSegments && d.routeSegments.length > 0) {
        lines.push('│  Güzergah Segmentler : ' + d.routeSegments.length + ' adet');
        lines.push('│  Ort. Eğim           : %' + (d.routeAvgGrade !== undefined ? d.routeAvgGrade.toFixed(2) : '—'));
        lines.push('│  Güzergah Mesafesi   : ' + (d.routeTotalDist ? (d.routeTotalDist/1000).toFixed(2) + ' km' : '—'));
      }
    }
    
    if(node.type === 'solver') {
      lines.push('│  Zaman Modu          : ' + (d.timeMode === 'stop' ? 'Durma Analizi' : (d.timeMode === 'time' ? 'Belirli Süre' : (d.timeMode || 'stop'))));
      lines.push('│  Süre                : ' + (d.duration || 300) + ' s');
      var methName = d.method === 'rk45' ? 'RK45 Dormand-Prince (Adaptif)' : d.method === 'rk4' ? 'RK4 (4. derece)' : d.method === 'heun' ? 'Heun (2. derece)' : d.method === 'ralston' ? 'Ralston (2. derece)' : 'Euler (1. derece)';
      lines.push('│  Yöntem              : ' + methName);
      if(d.method === 'rk45') {
        lines.push('│  Çıktı Noktası       : ' + (d.resolution || 500));
        lines.push('│  ATol / RTol         : ' + (d.atol || 1e-6) + ' / ' + (d.rtol || 1e-4));
      } else {
        lines.push('│  Çözünürlük          : ' + (d.resolution || 200) + ' adım');
      }
      lines.push('│  Durma Eşiği         : ' + (d.stopSpeed !== undefined ? d.stopSpeed : 5) + ' km/h');
      lines.push('│  Tork İnterpolasyonu : PCHIP Spline (Monoton Kübik Hermite)');
      lines.push('│  Mesafe Entegrasyonu : Trapezoidal');
      lines.push('│  Enerji Dengesi      : Aktif');
    }
    
    if(node.type === 'scenario') {
      var stMap = {coast:'Boşta Sürüş (Coast)',full_brake:'Tam Fren',full_throttle:'Tam Gaz',partial_throttle:'Kısmi Gaz',custom:'Özel'};
      lines.push('│  Senaryo Tipi        : ' + (stMap[d.scenarioType] || d.scenarioType || 'Coast'));
      if(d.throttle !== undefined) lines.push('│  Gaz Pedalı          : %' + d.throttle);
      if(d.brakeForce) lines.push('│  Fren Kuvveti        : ' + d.brakeForce + ' N');
    }
    
    if(node.type === 'coast-down') {
      lines.push('│  v1 (başlangıç)      : ' + (d.v1 || '—') + ' km/h');
      lines.push('│  v2 (bitiş)          : ' + (d.v2 || '—') + ' km/h');
      lines.push('│  Geçen Süre          : ' + (d.coastTime || '—') + ' s');
      lines.push('│  Hesaplanan Crr      : ' + (d.crr || '—'));
    }
    
    if(node.type === 'sensor') {
      if(d.attachedConnection) {
        var conn = connections.find(function(c) { return c.id === d.attachedConnection; });
        if(conn) {
          var fromN = nodes.find(function(n) { return n.id === conn.from; });
          var toN = nodes.find(function(n) { return n.id === conn.to; });
          var fL = fromN ? (fromN.customName || (componentDefs[fromN.type]||{}).name || '?') : '?';
          var tL = toN ? (toN.customName || (componentDefs[toN.type]||{}).name || '?') : '?';
          lines.push('│  Bağlantı            : ' + fL + ' → ' + tL);
          var dir = d.sensorDirection || 'from';
          lines.push('│  Okuma Yönü          : ' + (dir === 'from' ? '◀ ' + fL + ' (çıkış)' : '▶ ' + tL + ' (giriş)'));
        }
      }
      if(d.attachedComponent) {
        var comp = nodes.find(function(n) { return n.id === d.attachedComponent; });
        if(comp) lines.push('│  Bağlı Bileşen       : ' + (comp.customName || (componentDefs[comp.type]||{}).name || '?'));
      }
      lines.push('│  Seçili Sinyal        : ' + (d.selectedSignal || '(seçilmemiş)'));
    }
    
    lines.push('└' + thin.substring(1));
    lines.push('');
  });
  
  if(connections.length > 0) {
    lines.push(sep);
    lines.push('  BAĞLANTILAR (' + connections.length + ' adet)');
    lines.push(sep);
    connections.forEach(function(c, i) {
      var fNode = nodes.find(function(n){return n.id===c.from;});
      var tNode = nodes.find(function(n){return n.id===c.to;});
      var fName = fNode ? (fNode.customName || (componentDefs[fNode.type]||{}).name || c.from) : c.from;
      var tName = tNode ? (tNode.customName || (componentDefs[tNode.type]||{}).name || c.to) : c.to;
      var sInfo = c.sensorId ? ' [sensör bağlı]' : '';
      lines.push('  ' + (i+1) + '. ' + fName + ' [' + (c.fromPort||'output') + '] ──→ ' + tName + ' [' + (c.toPort||'input') + ']' + sInfo);
    });
    lines.push('');
  }
  
  lines.push(sep);
  lines.push('  AKTARMA ORGANLARI VERİM HESABI');
  lines.push(sep);
  var gbN = nodes.find(function(n){return n.type==='gearbox';});
  var trN = nodes.find(function(n){return n.type==='transfer';});
  var dfN = nodes.find(function(n){return n.type==='differential' && n.isMasterDiff;}) || nodes.find(function(n){return n.type==='differential';});
  var gbE = gbN && gbN.data && gbN.data.efficiency !== undefined ? gbN.data.efficiency : 97;
  var trE = trN && trN.data && trN.data.efficiency !== undefined ? trN.data.efficiency : 98;
  var dfE = dfN && dfN.data && dfN.data.efficiency !== undefined ? dfN.data.efficiency : 96;
  var toplamV = (gbE/100) * (trE/100) * (dfE/100) * 100;
  lines.push('  Şanzıman Verimi       : %' + gbE + (gbN ? '' : ' (varsayılan)'));
  lines.push('  Transfer Verimi       : %' + trE + (trN ? '' : ' (varsayılan)'));
  lines.push('  Diferansiyel Verimi   : %' + dfE + (dfN ? '' : ' (varsayılan)'));
  lines.push('  ' + thin.substring(2));
  lines.push('  TOPLAM VERİM          : %' + toplamV.toFixed(2));
  lines.push('');
  
  lines.push(sep);
  lines.push('  TOPLAM AKTARMA ORANI');
  lines.push(sep);
  var gNode = nodes.find(function(n){return n.type==='gearbox';});
  var tNode = nodes.find(function(n){return n.type==='transfer';});
  var dNode = nodes.find(function(n){return n.type==='differential' && n.isMasterDiff;}) || nodes.find(function(n){return n.type==='differential';});
  var tcN = nodes.find(function(n){return n.type==='torque-converter';});
  var iG = gNode && gNode.data ? (parseFloat(gNode.data.selectedGearRatio) || 1) : 1;
  var iT = tNode && tNode.data ? (parseFloat(tNode.data.selectedRatio) || 1) : 1;
  var iD = dNode && dNode.data ? (parseFloat(dNode.data.diffRatio) || 1) : 1;
  var iC = tcN && tcN.data ? (tcN.data.isLocked !== false ? 1.0 : (parseFloat(tcN.data.tcRatio) || 1)) : 1;
  var iTot = iG * iT * iD * iC;
  lines.push('  Şanzıman Oranı        : ' + iG.toFixed(3));
  lines.push('  Transfer Oranı        : ' + iT.toFixed(3));
  lines.push('  Diferansiyel Oranı    : ' + iD.toFixed(3));
  lines.push('  TC Çarpanı            : ' + iC.toFixed(3) + (tcN && tcN.data && tcN.data.isLocked !== false ? ' (kilitli)' : ''));
  lines.push('  ' + thin.substring(2));
  lines.push('  TOPLAM ORAN           : ' + iTot.toFixed(3));
  lines.push('');
  
  lines.push(sep);
  lines.push('  MATEMATİKSEL BAĞLAM');
  lines.push(sep);
  lines.push('  Güç Aktarma Zinciri:');
  lines.push('    Motor → [Kavrama/TC] → Şanzıman → Transfer → Diferansiyel → Tekerlek');
  lines.push('');
  lines.push('  Tekerlek Torku = Motor_Torku × i_şanz × i_trf × i_diff × i_TC × η_toplam');
  lines.push('  Tekerlek Hızı  = Motor_Hızı / (i_şanz × i_trf × i_diff × i_TC)');
  lines.push('  Çekiş Kuvveti  = Tekerlek_Torku / r_tekerlek');
  lines.push('  Fren Kuvveti   = Motor_Fren_Torku × i_toplam × η / r_tekerlek');
  lines.push('');
  lines.push('  Direnç Kuvvetleri:');
  lines.push('    F_yuvarlanma = m × g × Crr × cos(θ)');
  lines.push('    F_hava       = 0.5 × ρ × Cd × A × V²');
  lines.push('    F_eğim       = m × g × sin(θ)');
  lines.push('    F_net        = F_eğim - F_yuvarlanma - F_hava - F_fren');
  lines.push('');
  lines.push('  Motor Freni Aktiflik Kuralları:');
  lines.push('    • Hız < 20 km/h → Motor freni devre dışı');
  lines.push('    • Oto. vites + 1./2. vites → Motor freni devre dışı');
  
  return lines.join('\n');
}

function veShowTopologySummary() {
  veCloseFileMenu();
  if(nodes.length === 0) { showToast('Topolojide bileşen yok', 'warning'); return; }
  
  var summary = veGenerateTopologySummary();
  
  // Modal popup olarak göster
  var overlay = document.createElement('div');
  overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.6);z-index:9999;display:flex;align-items:center;justify-content:center;';
  overlay.onclick = function(e) { if(e.target === overlay) overlay.remove(); };
  
  var modal = document.createElement('div');
  modal.style.cssText = 'background:var(--bg-secondary,#1a1a2e);color:var(--text-primary,#e0e0e0);border-radius:12px;padding:20px;max-width:700px;width:90%;max-height:80vh;display:flex;flex-direction:column;box-shadow:0 16px 48px rgba(0,0,0,0.4);border:1px solid var(--border-color,#333);';
  
  var header = '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;"><h3 style="margin:0;font-size:1rem;">📊 Topoloji Özeti</h3><button onclick="this.closest(\'div[style*=fixed]\').remove()" style="background:none;border:none;color:var(--text-muted);font-size:1.2rem;cursor:pointer;">✕</button></div>';
  var body = '<pre style="flex:1;overflow:auto;font-size:0.68rem;font-family:Consolas,monospace;white-space:pre-wrap;background:var(--bg-tertiary,#111);padding:12px;border-radius:8px;border:1px solid var(--border-color,#333);line-height:1.5;">' + summary.replace(/</g,'&lt;') + '</pre>';
  var footer = '<div style="margin-top:10px;display:flex;gap:8px;justify-content:flex-end;"><button onclick="veExportSummaryTXT();this.closest(\'div[style*=fixed]\').remove();" style="padding:6px 14px;background:var(--accent-primary);color:white;border:none;border-radius:6px;cursor:pointer;font-size:0.75rem;">📥 TXT İndir</button><button onclick="this.closest(\'div[style*=fixed]\').remove()" style="padding:6px 14px;background:var(--bg-tertiary);color:var(--text-primary);border:1px solid var(--border-color);border-radius:6px;cursor:pointer;font-size:0.75rem;">Kapat</button></div>';
  
  modal.innerHTML = header + body + footer;
  overlay.appendChild(modal);
  document.body.appendChild(overlay);
}

function veShowSaveDialog(defaultName, blob, toastMsg) {
  // Önceki diyalog varsa kapat
  var prev = document.getElementById('ve-save-dialog-overlay');
  if(prev) prev.remove();

  var overlay = document.createElement('div');
  overlay.id = 've-save-dialog-overlay';
  overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.6);z-index:9999;display:flex;align-items:center;justify-content:center;';
  overlay.onclick = function(e) { if(e.target === overlay) overlay.remove(); };

  var modal = document.createElement('div');
  modal.style.cssText = 'background:var(--bg-secondary,#1a1a2e);color:var(--text-primary,#e0e0e0);border-radius:12px;padding:24px;max-width:420px;width:90%;box-shadow:0 16px 48px rgba(0,0,0,0.4);border:1px solid var(--border-color,#333);';

  var nameOnly = defaultName.replace(/\.[^.]+$/, '');
  var ext = defaultName.slice(nameOnly.length);

  modal.innerHTML =
    '<h3 style="margin:0 0 16px 0;font-size:1rem;">Farklı Kaydet</h3>' +
    '<label style="font-size:0.8rem;color:var(--text-muted,#aaa);display:block;margin-bottom:6px;">Dosya adı</label>' +
    '<div style="display:flex;align-items:center;gap:0;">' +
      '<input id="ve-save-filename" type="text" value="' + nameOnly.replace(/"/g, '&quot;') + '" ' +
        'style="flex:1;padding:8px 12px;background:var(--bg-tertiary,#111);color:var(--text-primary,#e0e0e0);border:1px solid var(--border-color,#444);border-radius:8px 0 0 8px;font-size:0.85rem;outline:none;" />' +
      '<span style="padding:8px 12px;background:var(--bg-tertiary,#111);color:var(--text-muted,#888);border:1px solid var(--border-color,#444);border-left:none;border-radius:0 8px 8px 0;font-size:0.85rem;white-space:nowrap;">' + ext + '</span>' +
    '</div>' +
    '<div style="margin-top:18px;display:flex;gap:8px;justify-content:flex-end;">' +
      '<button id="ve-save-cancel" style="padding:7px 18px;background:var(--bg-tertiary,#222);color:var(--text-primary,#e0e0e0);border:1px solid var(--border-color,#444);border-radius:8px;cursor:pointer;font-size:0.8rem;">İptal</button>' +
      '<button id="ve-save-confirm" style="padding:7px 18px;background:var(--accent-primary,#3b82f6);color:white;border:none;border-radius:8px;cursor:pointer;font-size:0.8rem;font-weight:600;">Kaydet</button>' +
    '</div>';

  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  var input = document.getElementById('ve-save-filename');
  input.focus();
  input.select();

  function doSave() {
    var fileName = input.value.trim();
    if(!fileName) { showToast('Dosya adı boş olamaz', 'warning'); return; }
    fileName += ext;
    overlay.remove();

    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast(toastMsg);
  }

  document.getElementById('ve-save-confirm').onclick = doSave;
  document.getElementById('ve-save-cancel').onclick = function() { overlay.remove(); };
  input.addEventListener('keydown', function(e) {
    if(e.key === 'Enter') doSave();
    if(e.key === 'Escape') overlay.remove();
  });
}

function veExportSummaryTXT() {
  veCloseFileMenu();
  if(nodes.length === 0) { showToast('Topolojide bileşen yok', 'warning'); return; }
  var summary = veGenerateTopologySummary();
  var blob = new Blob([summary], {type:'text/plain;charset=utf-8'});
  var defaultName = 'topoloji_ozeti_' + new Date().toISOString().slice(0,10) + '.txt';
  veShowSaveDialog(defaultName, blob, 'Topoloji özeti indirildi');
}

function veClearAll() {
  if(nodes.length === 0) {
    showToast('Temizlenecek bileşen yok', 'warning');
    return;
  }
  showConfirmToast('Bu sekmedeki tüm bileşenleri silmek istediğinize emin misiniz?', function() {
    saveState();
    nodes.forEach(function(n) {
      var el = document.getElementById(n.id);
      if(el) el.remove();
    });
    nodes = [];
    connections = [];
    selectedNodes = [];
    showEmptyProperties();
    updateAllConnections();
    updateNodeCount();
    veSaveActiveTabState();
    veRenderTabs();
    showToast('Sekme temizlendi');
  });
}

function veSaveTopology() {
  veCloseFileMenu();
  
  // Aktif sekmeyi kaydet
  veSaveActiveTabState();
  
  var project = {
    version: 2,
    projectName: veProjectName || '',
    activeModule: veActiveModule || '',
    tabCounter: veTabCounter,
    activeTabIdx: veActiveTabIdx,
    tabs: veTabs.map(function(tab) {
      var cleanState = null;
      if(tab.state) {
        cleanState = {
          nodes: tab.state.nodes,
          connections: tab.state.connections,
          compCounter: tab.state.compCounter,
          canvasOffset: tab.state.canvasOffset,
          canvasZoom: tab.state.canvasZoom,
          simResults: tab.state.simResults || null,
          resultSlots: tab.state.resultSlots || [{},{},{},{}]
        };
      }
      return {
        id: tab.id,
        name: tab.name,
        state: cleanState
      };
    })
  };
  
  var json = JSON.stringify(project, null, 2);
  var blob = new Blob([json], {type: 'application/json'});
  var defaultName = (veProjectName || 'topoloji') + '_' + new Date().toISOString().slice(0,10) + '.json';
  veShowSaveDialog(defaultName, blob, 'Proje kaydedildi (' + veTabs.length + ' sekme)');
}

function veLoadTopology() {
  veCloseFileMenu();
  var input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json';
  
  input.addEventListener('change', function(e) {
    var file = e.target.files[0];
    if(!file) return;
    
    var reader = new FileReader();
    reader.onload = function(ev) {
      try {
        var data = JSON.parse(ev.target.result);
        
        // Format v2: çoklu sekme projesi
        if(data.version === 2 && data.tabs && data.tabs.length > 0) {
          veClearCanvasDOM();
          veTabs = [];
          veTabCounter = data.tabCounter || data.tabs.length;
          
          data.tabs.forEach(function(t) {
            veTabs.push({
              id: t.id,
              name: t.name,
              state: t.state,
              nodeCount: (t.state && t.state.nodes) ? t.state.nodes.length : 0,
              connCount: (t.state && t.state.connections) ? t.state.connections.length : 0
            });
          });
          
          veActiveTabIdx = Math.min(data.activeTabIdx || 0, veTabs.length - 1);
          
          // Aktif modülü yükle (FT vs MF vs diğer)
          if(data.activeModule && VE_MODULES[data.activeModule]) {
            veActiveModule = data.activeModule;
            var modSel = document.getElementById('ve-module-select');
            if(modSel) modSel.value = veActiveModule;
            // Modül overlay'ını gizle (proje yüklenmişse modül seçilmiş demektir)
            var moduleOverlay = document.getElementById('ve-module-overlay');
            if(moduleOverlay) moduleOverlay.style.display = 'none';
            // Sidebar bileşenlerini modüle göre filtrele
            var mod = VE_MODULES[veActiveModule];
            if(mod) {
              document.querySelectorAll('.ve-component[data-type]').forEach(function(el) {
                var type = el.getAttribute('data-type');
                el.style.display = mod.components.indexOf(type) > -1 ? '' : 'none';
              });
              document.querySelectorAll('.ve-category').forEach(function(cat) {
                if(cat.getAttribute('data-always-visible')) return;
                var visibleComps = cat.querySelectorAll('.ve-component:not([style*="display: none"])');
                cat.style.display = visibleComps.length === 0 ? 'none' : '';
              });
            }
          }
          
          veLoadTabState(veTabs[veActiveTabIdx]);
          
          if(data.projectName) {
            veProjectName = data.projectName;
            var btn = document.getElementById('ve-project-name-btn');
            if(btn) {
              var shortName = veProjectName.length > 18 ? veProjectName.substring(0, 16) + '…' : veProjectName;
              btn.textContent = '⚙ ' + shortName + ' ▾';
            }
          }
          
          veRenderTabs();
          showToast('Proje yüklendi: ' + veTabs.length + ' sekme');
          return;
        }
        
        // Format v1 (eski): tek topoloji
        if(!data.nodes || !data.connections) {
          showToast('Geçersiz topoloji dosyası', 'error');
          return;
        }
        
        // Eski formatı aktif sekmeye yükle
        veClearCanvasDOM();
        
        if(data.canvasOffset) canvasOffset = data.canvasOffset;
        if(data.canvasZoom) canvasZoom = data.canvasZoom;
        if(data.compCounter) compCounter = data.compCounter;
        else if(data.nodeCounter) compCounter = data.nodeCounter;
        updateCanvasTransform();
        
        restoreState(data);
        
        // Aktif sekmeyi güncelle
        undoStack = [];
        redoStack = [];
        saveState();
        veSaveActiveTabState();
        veRenderTabs();
        
        showToast('Topoloji yüklendi: ' + data.nodes.length + ' bileşen (v1 format)');
      } catch(err) {
        showToast('Dosya okunamadı: ' + err.message, 'error');
      }
    };
    reader.readAsText(file);
  });
  
  input.click();
}

