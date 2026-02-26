// ═══════════════════════════════════════════════════════════════════════════════
// SENSÖR SİHİRBAZI — Paketler, Topoloji Tarama, Otomatik Yerleştirme
// ═══════════════════════════════════════════════════════════════════════════════

var SENSOR_PACKAGES = [
  {
    id: 'performance', name: 'Performans Eğrileri', icon: '🏁', priority: 'essential',
    description: 'Temel hızlanma performansı: hız-zaman, mesafe-zaman, ivme eğrileri',
    requires: ['vehicle'],
    diagrams: [
      { id:'v-t', name:'Araç Hızı – Zaman', xAxis:'Zaman (s)', yAxis:'Hız (km/h)',
        significance:'En temel performans göstergesi. 0→100 km/h süresini direkt okuyabilirsiniz. Eğrinin eğimi ivmeyi, düzleştiği nokta max hızı verir.' },
      { id:'s-t', name:'Mesafe – Zaman', xAxis:'Zaman (s)', yAxis:'Mesafe (m)',
        significance:'400m veya 1/4 mile süresi gibi standart metrikleri elde etmek için. Eğrinin eğimi anlık hıza eşittir.' },
      { id:'a-v', name:'İvme – Araç Hızı', xAxis:'Hız (km/h)', yAxis:'İvme (m/s²)',
        significance:'Hangi hız aralığında aracın en güçlü/zayıf ivmelendiğini gösterir. Vites geçişleri anlık düşüş olarak görünür.' },
      { id:'a-t', name:'İvme – Zaman', xAxis:'Zaman (s)', yAxis:'İvme (m/s²)',
        significance:'Zamana bağlı ivme profili. Sürücü konforu ve yük güvenliği analizi için — ani ivme değişimleri yük kaymasına neden olabilir.' }
    ],
    sensors: [
      { target:'vehicle', attachment:'component', signal:'v_speed', label:'Araç → Araç Hızı (km/h)' },
      { target:'vehicle', attachment:'component', signal:'v_distance', label:'Araç → Kat Edilen Mesafe (m)' },
      { target:'vehicle', attachment:'component', signal:'v_accel', label:'Araç → İvme (m/s²)' }
    ]
  },
  {
    id: 'engine-analysis', name: 'Motor Çalışma Analizi', icon: '⚙️', priority: 'essential',
    description: 'Motor devri, tork ve güç eğrileri — motorun hızlanma boyunca nasıl çalıştığını gösterir',
    requires: ['engine'],
    diagrams: [
      { id:'rpm-v', name:'Motor Devri – Araç Hızı', xAxis:'Hız (km/h)', yAxis:'Motor Devri (rpm)',
        significance:'Her viteste motorun hangi devir aralığında çalıştığını gösterir. Vites geçişlerinde testere dişi deseni oluşur.' },
      { id:'rpm-t', name:'Motor Devri – Zaman', xAxis:'Zaman (s)', yAxis:'Motor Devri (rpm)',
        significance:'Zamana bağlı devir profili. Testere dişi şeklinde yükselen pattern: her vites tırmanır → shift → düşer → tekrar tırmanır.' },
      { id:'torque-v', name:'Motor Torku – Araç Hızı', xAxis:'Hız (km/h)', yAxis:'Motor Torku (Nm)',
        significance:'Motorun tam gaz tork eğrisinin hangi bölümünde çalıştığını gösterir. Fan ve AC kayıplarının etkisi görülür.' },
      { id:'power-v', name:'Motor Gücü – Araç Hızı', xAxis:'Hız (km/h)', yAxis:'Motor Gücü (kW)',
        significance:'Hıza bağlı efektif güç çıktısı. Fan/AC gibi aksesuarların ne kadar güç çaldığını gösterir.' }
    ],
    sensors: [
      { target:'engine', attachment:'output', signal:'rpm', label:'Motor Çıkışı → Devir (rpm)' },
      { target:'engine', attachment:'output', signal:'torque', label:'Motor Çıkışı → Tork (Nm)' },
      { target:'engine', attachment:'output', signal:'power', label:'Motor Çıkışı → Güç (kW)' }
    ]
  },
  {
    id: 'tc-analysis', name: 'Tork Konvertör Analizi', icon: '🌀', priority: 'recommended',
    description: 'TC çalışma noktası, tork çarpanı, verim ve kayma analizi',
    requires: ['torque-converter'],
    diagrams: [
      { id:'sr-v', name:'Hız Oranı (SR) – Araç Hızı', xAxis:'Hız (km/h)', yAxis:'Speed Ratio (SR)',
        significance:'TC çalışma noktası. SR=0 stall, SR≈0.85-0.90 coupling point, SR=1.0 lockup. Converter→lockup geçişi SR\'nin aniden 1.0\'a sıçraması olarak görülür.' },
      { id:'tr-v', name:'Tork Oranı (TR) – Araç Hızı', xAxis:'Hız (km/h)', yAxis:'Torque Ratio (TR)',
        significance:'TC tork çarpanı. Stall\'da en yüksek (tipik 2.0–3.5×), coupling point\'te 1.0\'a düşer. Lockup\'ta TR tam 1.0 olur.' },
      { id:'eta-tc-v', name:'TC Verimi – Araç Hızı', xAxis:'Hız (km/h)', yAxis:'Verim η (%)',
        significance:'Stall\'da η≈0 (tüm enerji ısıya), coupling point\'te peak (~85-88%), lockup\'ta η=100%. TC\'nin ne kadar verimsiz çalıştığını gösterir.' },
      { id:'tc-slip-v', name:'TC Kayma – Araç Hızı', xAxis:'Hız (km/h)', yAxis:'Kayma (%)',
        significance:'Kayma = (1 - SR) × 100. Stall\'da %100 kayma, lockup\'ta %0. Enerji kaybı ve ısınma profili için önemli.' },
      { id:'tc-io-torque', name:'TC Giriş/Çıkış Torku – Araç Hızı', xAxis:'Hız (km/h)', yAxis:'Tork (Nm)',
        significance:'Pump ve türbin torkları. Aradaki fark TC tork çarpım etkisi. Düşük hızlarda türbin torku pump\'tan çok yüksek (TR > 1).' }
    ],
    sensors: [
      { target:'torque-converter', attachment:'component', signal:'speed_ratio', label:'TC → Hız Oranı (SR)' },
      { target:'torque-converter', attachment:'component', signal:'torque_ratio', label:'TC → Tork Oranı (TR)' },
      { target:'torque-converter', attachment:'component', signal:'efficiency', label:'TC → Verim η (%)' },
      { target:'torque-converter', attachment:'component', signal:'slip', label:'TC → Kayma (%)' },
      { target:'torque-converter', attachment:'input', signal:'torque_in', label:'TC Girişi → Pump Torku (Nm)' },
      { target:'torque-converter', attachment:'output', signal:'torque_out', label:'TC Çıkışı → Türbin Torku (Nm)' }
    ]
  },
  {
    id: 'traction-analysis', name: 'Çekiş Kuvveti Analizi', icon: '💪', priority: 'essential',
    description: 'Tekerlekte çekiş kuvveti, direnç kuvvetleri ve net çekiş gücü',
    requires: ['vehicle'],
    diagrams: [
      { id:'te-v', name:'Çekiş Kuvveti (TE) – Araç Hızı', xAxis:'Hız (km/h)', yAxis:'Çekiş Kuvveti (kN)',
        significance:'İSCAAN temel diyagramı. Her vites ayrı eğri. Converter mod düz, lockup dik iniş. Zarf eğrisi aracın gerçek çekiş kapasitesi.' },
      { id:'dp-v', name:'Net Çekiş (DP) – Araç Hızı', xAxis:'Hız (km/h)', yAxis:'Drawbar Pull (kN)',
        significance:'DP = TE − F_direnç. Sıfıra düştüğü nokta max hız. Gradeability tablosunun doğrudan kaynağı.' },
      { id:'resistances-v', name:'Direnç Kuvvetleri – Araç Hızı', xAxis:'Hız (km/h)', yAxis:'Kuvvet (kN)',
        significance:'Yuvarlanma direnci (sabit), hava direnci (V² ile artar), toplam direnç. Düşük hızlarda yuvarlanma, yüksek hızlarda aero baskın.' },
      { id:'power-balance-v', name:'Güç Dengesi – Araç Hızı', xAxis:'Hız (km/h)', yAxis:'Güç (kW)',
        significance:'Motor gücü, tekerlekte güç, direnç gücü. Aradaki farklar TC kaybı, şanzıman kaybı olarak görülür. Drivetrain verimliliği analizi.' }
    ],
    sensors: [
      { target:'solver', attachment:'component', signal:'tractive_effort', label:'Çözücü → Çekiş Kuvveti TE (kN)' },
      { target:'solver', attachment:'component', signal:'drawbar_pull', label:'Çözücü → Net Çekiş DP (kN)' },
      { target:'road', attachment:'component', signal:'r_rolling_force', label:'Yol → Yuvarlanma Direnci (N)' },
      { target:'road', attachment:'component', signal:'r_aero_force', label:'Yol → Aerodinamik Direnç (N)' },
      { target:'road', attachment:'component', signal:'r_total_resist', label:'Yol → Toplam Direnç (N)' },
      { target:'engine', attachment:'output', signal:'power', label:'Motor Çıkışı → Güç (kW)' },
      { target:'solver', attachment:'component', signal:'wheel_power', label:'Çözücü → Tekerlekte Güç (kW)' }
    ]
  },
  {
    id: 'shift-analysis', name: 'Vites Geçiş Analizi', icon: '🔄', priority: 'recommended',
    description: 'Vites değişim noktaları, şanzıman çıkış parametreleri ve shift kalitesi',
    requires: ['gearbox', 'shift-controller'],
    diagrams: [
      { id:'gear-t', name:'Aktif Vites – Zaman', xAxis:'Zaman (s)', yAxis:'Vites Numarası',
        significance:'Adım fonksiyonu: 1C→2C→2L→3L→… Her adımın genişliği o viteste geçirilen süre. C→L geçişleri de görünür.' },
      { id:'gear-v', name:'Aktif Vites – Araç Hızı', xAxis:'Hız (km/h)', yAxis:'Vites Numarası',
        significance:'Hangi hızda hangi vitese geçildiğini gösterir. Shift hız eşiklerini doğrulamak için kullanılır.' },
      { id:'trans-out-v', name:'Şanzıman Çıkış Torku – Araç Hızı', xAxis:'Hız (km/h)', yAxis:'Çıkış Torku (Nm)',
        significance:'TC tork çarpımı + dişli oranı sonrası net tork. Her vites geçişinde ani değişim görülür.' },
      { id:'shift-rpm-t', name:'Vites Geçiş RPM Profili – Zaman', xAxis:'Zaman (s)', yAxis:'Motor Devri + Vites',
        significance:'Testere dişi devir patterninin her tepesi shift-up noktası. Shift kalibrasyon doğrulamasının temel aracı.' }
    ],
    sensors: [
      { target:'shift-controller', attachment:'component', signal:'current_gear', label:'Şanzıman Kontrol → Aktif Vites' },
      { target:'gearbox', attachment:'output', signal:'torque_out', label:'Şanzıman Çıkışı → Çıkış Torku (Nm)' },
      { target:'gearbox', attachment:'output', signal:'rpm_out', label:'Şanzıman Çıkışı → Çıkış Devri (rpm)' }
    ]
  },
  {
    id: 'comparison', name: 'Karşılaştırma Diyagramları', icon: '⚖️', priority: 'advanced',
    description: 'Transfer kademe karşılaştırması, verimlilik zinciri ve ileri analizler',
    requires: ['vehicle', 'engine', 'torque-converter'],
    dependsOn: ['performance', 'engine-analysis', 'tc-analysis', 'traction-analysis'],
    diagrams: [
      { id:'transfer-compare', name:'Yüksek / Düşük Kademe Hız Karşılaştırması', xAxis:'Zaman (s)', yAxis:'Hız (km/h)',
        significance:'İki transfer kademe V(t) eğrilerinin üst üste bindirilmesi. Kesişim noktası taktik karar sınırı.',
        note:'İki ayrı simülasyon gerektirir.' },
      { id:'efficiency-chain', name:'Güç Aktarma Verim Zinciri – Araç Hızı', xAxis:'Hız (km/h)', yAxis:'Verim (%)',
        significance:'Her bileşenin verimi ayrı eğri: TC η, şanzıman η, toplam η. Enerji kayıp analizi için vazgeçilmez.' },
      { id:'te-envelope', name:'TE Zarf Eğrisi – Araç Hızı', xAxis:'Hız (km/h)', yAxis:'Çekiş Kuvveti (kN)',
        significance:'Tüm viteslerin TE eğrileri + zarf eğrisi. Vites aralıklarının uygunluğunu gösterir.' },
      { id:'bsfc-map', name:'Motor BSFC Çalışma Haritası', xAxis:'Motor Devri (rpm)', yAxis:'Motor Torku (Nm)',
        significance:'Verimlilik haritası üzerine çalışma noktası yörüngesi. Motorun ne kadar verimli kullanıldığını gösterir.',
        note:'Arka plan BSFC kontur haritası motor veritabanından gelir.' }
    ],
    sensors: []
  }
];

function swScanTopology() {
  var result = {
    hasEngine:false, hasTC:false, hasGearbox:false, hasTransfer:false,
    hasDiff:false, hasVehicle:false, hasRoad:false, hasShiftCtrl:false, hasSolver:false,
    engineNode:null, tcNode:null, gearboxNode:null, transferNode:null,
    diffNode:null, vehicleNode:null, roadNode:null, shiftCtrlNode:null, solverNode:null,
    existingSensors: [],
    chainComplete: false
  };
  nodes.forEach(function(n) {
    switch(n.type) {
      case 'engine': case 'engine-brake': result.hasEngine=true; result.engineNode=n; break;
      case 'torque-converter': result.hasTC=true; result.tcNode=n; break;
      case 'gearbox': result.hasGearbox=true; result.gearboxNode=n; break;
      case 'transfer': result.hasTransfer=true; result.transferNode=n; break;
      case 'differential': result.hasDiff=true; result.diffNode=n; break;
      case 'vehicle': result.hasVehicle=true; result.vehicleNode=n; break;
      case 'road': result.hasRoad=true; result.roadNode=n; break;
      case 'shift-controller': result.hasShiftCtrl=true; result.shiftCtrlNode=n; break;
      case 'solver': result.hasSolver=true; result.solverNode=n; break;
      case 'sensor':
        result.existingSensors.push({
          node:n,
          attachedConn: n.data ? n.data.attachedConnection : null,
          attachedComp: n.data ? n.data.attachedComponent : null,
          direction: n.data ? n.data.sensorDirection : 'from',
          signal: n.data ? n.data.selectedSignal : null
        });
        break;
    }
  });
  result.chainComplete = result.hasEngine && result.hasTC && result.hasGearbox && result.hasVehicle;
  return result;
}

function swCheckSensorExists(sensorReq, topology) {
  for(var i=0; i<topology.existingSensors.length; i++) {
    var s = topology.existingSensors[i];
    var targetMatch = false;
    
    if(sensorReq.attachment === 'component' && s.attachedComp) {
      var compNode = nodes.find(function(n) { return n.id === s.attachedComp; });
      if(compNode && (compNode.type === sensorReq.target || (sensorReq.target === 'engine' && compNode.type === 'engine-brake'))) targetMatch = true;
    } else if(s.attachedConn) {
      var conn = connections.find(function(c) { return c.id === s.attachedConn; });
      if(conn) {
        var fromNode = nodes.find(function(n) { return n.id === conn.from; });
        var toNode = nodes.find(function(n) { return n.id === conn.to; });
        if(sensorReq.attachment === 'output' && fromNode) {
          if(fromNode.type === sensorReq.target || (sensorReq.target === 'engine' && fromNode.type === 'engine-brake')) {
            if(s.direction === 'from' || !s.direction) targetMatch = true;
          }
        }
        if(sensorReq.attachment === 'input' && toNode) {
          if(toNode.type === sensorReq.target || (sensorReq.target === 'engine' && toNode.type === 'engine-brake')) {
            if(s.direction === 'to') targetMatch = true;
          }
        }
      }
    }
    if(targetMatch && s.signal === sensorReq.signal) {
      return { matched:true, sensorNode: s.node };
    }
  }
  return { matched:false, sensorNode:null };
}

var swExpandedPkg = {};

function swTogglePkg(pkgId) {
  swExpandedPkg[pkgId] = !swExpandedPkg[pkgId];
  var wizNode = nodes.find(function(n) { return n.type === 'sensor-wizard'; });
  if(wizNode) showNodeProperties(wizNode);
}

function swShowDiagramInfo(pkgId, diagIdx) {
  var pkg = SENSOR_PACKAGES.find(function(p) { return p.id === pkgId; });
  if(!pkg || !pkg.diagrams[diagIdx]) return;
  var d = pkg.diagrams[diagIdx];
  var ov = document.getElementById('sw-info-overlay');
  if(!ov) {
    ov = document.createElement('div');
    ov.id = 'sw-info-overlay';
    ov.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.5);z-index:99999;display:flex;align-items:center;justify-content:center;';
    document.body.appendChild(ov);
  }
  var html = '<div style="background:var(--bg-primary,#fff);border-radius:12px;padding:20px;max-width:440px;width:90%;box-shadow:0 8px 32px rgba(0,0,0,0.3);color:var(--text-primary,#333);">';
  html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">';
  html += '<span style="font-weight:700;font-size:0.9rem;">📊 ' + d.name + '</span>';
  html += '<button onclick="document.getElementById(\'sw-info-overlay\').remove()" style="background:none;border:none;font-size:1.1rem;cursor:pointer;color:var(--text-muted,#999);">✕</button>';
  html += '</div>';
  html += '<div style="font-size:0.72rem;color:var(--text-secondary,#666);margin-bottom:8px;"><b>X:</b> ' + d.xAxis + ' &nbsp; <b>Y:</b> ' + (Array.isArray(d.yAxis) ? d.yAxis.join(' / ') : d.yAxis) + '</div>';
  html += '<div style="font-size:0.72rem;line-height:1.5;color:var(--text-primary,#333);border-top:1px solid var(--border-color,#eee);padding-top:10px;">' + d.significance + '</div>';
  if(d.note) {
    html += '<div style="font-size:0.68rem;color:#f59e0b;margin-top:8px;padding:6px 8px;background:rgba(245,158,11,0.08);border-radius:6px;">⚠️ ' + d.note + '</div>';
  }
  html += '</div>';
  ov.innerHTML = html;
  ov.onclick = function(e) { if(e.target === ov) ov.remove(); };
}

function getSensorWizardPropertiesHTML(node) {
  var topo = swScanTopology();
  var html = '<div style="border-top:1px solid var(--border-color);padding-top:12px;">';
  
  // ── Topoloji Durumu ──
  html += '<div style="font-size:0.72rem;font-weight:700;color:var(--accent-warning,#f59e0b);margin-bottom:8px;">📡 Topoloji Durumu</div>';
  html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:3px 8px;font-size:0.62rem;margin-bottom:10px;padding:8px;background:var(--bg-tertiary);border-radius:6px;border:1px solid var(--border-color);">';
  var topoItems = [
    {k:'Motor', v:topo.hasEngine}, {k:'Tork Konvertör', v:topo.hasTC},
    {k:'Şanzıman', v:topo.hasGearbox}, {k:'Transfer Kutusu', v:topo.hasTransfer},
    {k:'Son Dişli / Diff.', v:topo.hasDiff}, {k:'Araç', v:topo.hasVehicle},
    {k:'Yol / Ortam', v:topo.hasRoad}, {k:'Şanz. Kontrol', v:topo.hasShiftCtrl}
  ];
  topoItems.forEach(function(ti) {
    html += '<div style="display:flex;align-items:center;gap:3px;">';
    html += '<span style="color:' + (ti.v ? '#22c55e' : '#ef4444') + ';">' + (ti.v ? '✅' : '❌') + '</span>';
    html += '<span style="color:' + (ti.v ? 'var(--text-primary)' : 'var(--text-muted)') + ';">' + ti.k + '</span>';
    html += '</div>';
  });
  html += '</div>';
  
  // Zincir durumu
  html += '<div style="font-size:0.62rem;padding:5px 8px;border-radius:4px;margin-bottom:12px;' + (topo.chainComplete ? 'background:rgba(34,197,94,0.08);color:#16a34a;' : 'background:rgba(239,68,68,0.08);color:#dc2626;') + '">';
  html += topo.chainComplete ? '✅ Zincir: Motor → … → Araç tamamlanmış' : '⚠️ Güç aktarma zinciri tamamlanmamış!';
  html += '</div>';
  
  // Sensör sayısı özeti
  var totalReq = 0, totalMatched = 0;
  SENSOR_PACKAGES.forEach(function(pkg) {
    pkg.sensors.forEach(function(sReq) {
      totalReq++;
      if(swCheckSensorExists(sReq, topo).matched) totalMatched++;
    });
  });
  
  // İlerleme çubuğu
  var pct = totalReq > 0 ? Math.round(totalMatched / totalReq * 100) : 0;
  html += '<div style="font-size:0.62rem;color:var(--text-muted);margin-bottom:4px;">Sensör Durumu: <b style="color:var(--text-primary);">' + totalMatched + ' / ' + totalReq + '</b> bağlı</div>';
  html += '<div style="height:6px;background:var(--bg-tertiary);border-radius:3px;margin-bottom:12px;overflow:hidden;border:1px solid var(--border-color);">';
  html += '<div style="height:100%;width:' + pct + '%;background:' + (pct === 100 ? '#22c55e' : pct > 0 ? '#f59e0b' : 'var(--bg-tertiary)') + ';border-radius:3px;transition:width 0.3s;"></div>';
  html += '</div>';
  
  // ── Diyagram Paketleri ──
  html += '<div style="font-size:0.72rem;font-weight:700;color:var(--accent-warning,#f59e0b);margin-bottom:8px;">📦 Diyagram Paketleri</div>';
  
  SENSOR_PACKAGES.forEach(function(pkg, pkgIdx) {
    var pkgMatched = 0, pkgTotal = pkg.sensors.length;
    var sensorStatuses = [];
    pkg.sensors.forEach(function(sReq) {
      var chk = swCheckSensorExists(sReq, topo);
      sensorStatuses.push(chk.matched);
      if(chk.matched) pkgMatched++;
    });
    
    // Gerekli bileşenler var mı?
    var reqsMet = true;
    for(var r=0; r<pkg.requires.length; r++) {
      var rt = pkg.requires[r];
      if(!nodes.some(function(n) { return n.type === rt || (rt === 'engine' && (n.type === 'engine' || n.type === 'engine-brake')); })) {
        reqsMet = false; break;
      }
    }
    
    // Durum ikonu
    var statusIcon = '⬜', statusColor = '#94a3b8';
    if(!reqsMet) { statusIcon = '⚠️'; statusColor = '#ef4444'; }
    else if(pkgTotal === 0 && pkg.dependsOn) { statusIcon = '🔗'; statusColor = '#6b7280'; }
    else if(pkgMatched === pkgTotal && pkgTotal > 0) { statusIcon = '✅'; statusColor = '#22c55e'; }
    else if(pkgMatched > 0) { statusIcon = '🔶'; statusColor = '#f59e0b'; }
    
    // Öncelik bordür rengi
    var prioColor = pkg.priority === 'essential' ? '#22c55e' : pkg.priority === 'recommended' ? '#3b82f6' : '#a855f7';
    
    var expanded = swExpandedPkg[pkg.id];
    
    html += '<div style="border-left:3px solid ' + prioColor + ';margin-bottom:6px;border-radius:4px;background:var(--bg-secondary);border:1px solid var(--border-color);overflow:hidden;">';
    
    // Başlık
    html += '<div onclick="swTogglePkg(\'' + pkg.id + '\')" style="display:flex;align-items:center;gap:6px;padding:7px 8px;cursor:pointer;font-size:0.65rem;user-select:none;" onmouseover="this.style.background=\'var(--bg-tertiary)\'" onmouseout="this.style.background=\'transparent\'">';
    html += '<span style="font-size:0.6rem;opacity:0.5;">' + (expanded ? '▼' : '▶') + '</span>';
    html += '<span>' + pkg.icon + '</span>';
    html += '<span style="flex:1;font-weight:600;color:var(--text-primary);">' + pkg.name + '</span>';
    if(pkgTotal > 0) {
      html += '<span style="font-size:0.58rem;color:' + statusColor + ';font-weight:600;">' + pkgMatched + '/' + pkgTotal + ' ' + statusIcon + '</span>';
    } else {
      html += '<span style="font-size:0.58rem;color:' + statusColor + ';">' + statusIcon + ' bağımlı</span>';
    }
    html += '</div>';
    
    // Genişletilmiş içerik
    if(expanded) {
      html += '<div style="padding:0 8px 8px;border-top:1px solid var(--border-color);">';
      html += '<div style="font-size:0.58rem;color:var(--text-muted);margin:6px 0 4px;line-height:1.4;">' + pkg.description + '</div>';
      
      // Sensörler
      if(pkg.sensors.length > 0) {
        html += '<div style="font-size:0.6rem;font-weight:600;color:var(--text-secondary);margin:8px 0 4px;">Gerekli Sensörler:</div>';
        pkg.sensors.forEach(function(sReq, sIdx) {
          var matched = sensorStatuses[sIdx];
          html += '<div style="display:flex;align-items:center;gap:4px;padding:3px 0;font-size:0.58rem;">';
          html += '<span style="color:' + (matched ? '#22c55e' : (reqsMet ? '#94a3b8' : '#ef4444')) + ';">' + (matched ? '✅' : (reqsMet ? '⬜' : '⚠️')) + '</span>';
          html += '<span style="color:' + (matched ? 'var(--text-primary)' : 'var(--text-secondary)') + ';">' + sReq.label + '</span>';
          html += '</div>';
        });
      } else if(pkg.dependsOn) {
        html += '<div style="font-size:0.58rem;color:var(--text-muted);margin:6px 0;font-style:italic;">Bu paket için ek sensör gerekmez — diğer paketlerin sensörlerini kullanır.</div>';
      }
      
      // Diyagramlar
      html += '<div style="font-size:0.6rem;font-weight:600;color:var(--text-secondary);margin:10px 0 4px;">Oluşacak Diyagramlar:</div>';
      pkg.diagrams.forEach(function(d, dIdx) {
        var diagramReady = (pkgTotal === 0 && pkg.dependsOn) ? false : (pkgMatched === pkgTotal && pkgTotal > 0);
        html += '<div style="display:flex;align-items:center;gap:4px;padding:2px 0;font-size:0.58rem;">';
        html += '<span style="color:' + (diagramReady ? '#22c55e' : '#6b7280') + ';">' + (diagramReady ? '✅' : '🔒') + '</span>';
        html += '<span style="flex:1;color:' + (diagramReady ? 'var(--text-primary)' : 'var(--text-muted)') + ';">' + d.name + '</span>';
        html += '<button onclick="event.stopPropagation();swShowDiagramInfo(\'' + pkg.id + '\',' + dIdx + ')" style="padding:1px 4px;font-size:0.52rem;background:transparent;color:var(--text-muted);border:1px solid var(--border-color);border-radius:3px;cursor:pointer;" title="Diyagram bilgisi">ℹ️</button>';
        html += '</div>';
      });
      
      html += '</div>'; // expanded content
    }
    
    html += '</div>'; // package card
  });
  
  // ── Alt bilgi ──
  if(totalMatched === totalReq && totalReq > 0) {
    html += '<div style="text-align:center;padding:8px;font-size:0.65rem;color:#22c55e;font-weight:600;margin-top:8px;">✅ Tüm sensörler yerleştirilmiş!</div>';
  } else {
    html += '<div style="font-size:0.55rem;color:var(--text-muted);margin-top:8px;padding:6px 8px;background:var(--bg-tertiary);border-radius:4px;line-height:1.5;">';
    html += '💡 Eksik sensörleri topolojiye manuel olarak ekleyin. Sensörü bağlantı çizgisine veya bileşene bağlayın, ardından ilgili sinyali seçin. Bu panel otomatik güncellenir.';
    html += '</div>';
  }
  
  // Yenile butonu
  html += '<div style="text-align:center;margin-top:8px;">';
  html += '<button onclick="var w=nodes.find(function(n){return n.type===\'sensor-wizard\';});if(w)showNodeProperties(w);" style="padding:4px 12px;font-size:0.6rem;background:var(--bg-tertiary);color:var(--text-secondary);border:1px solid var(--border-color);border-radius:4px;cursor:pointer;">🔄 Durumu Yenile</button>';
  html += '</div>';
  
  html += '</div>';
  return html;
}

