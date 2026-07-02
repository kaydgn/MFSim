// ============================================================================
// INFO POPUP SİSTEMİ
// ============================================================================
var infoPopupData = {
  'motorVerileri': {
    title: 'Motor Verileri Hakkında',
    content: 'Bu bölümde motor freni veya motor tork-güç değerlerini girebilirsiniz. Bilgi içeriği kullanıcı tarafından düzenlenecek.'
  },
  'torkGucEgrisi': {
    title: 'Tork & Güç Eğrisi Hakkında',
    content: 'Girilen veriler grafiksel olarak gösterilir. Bilgi içeriği kullanıcı tarafından düzenlenecek.'
  },
  'egriYaklaşımı': {
    title: 'Eğri Yaklaşımı Hakkında',
    content: 'Verilerinize en uygun matematiksel modeli seçebilirsiniz. Bilgi içeriği kullanıcı tarafından düzenlenecek.'
  },
  'motorFreniParametreleri': {
    title: 'Motor Freni Parametreleri Hakkında',
    content: 'Motor freni verim ve governed RPM değerlerini ayarlayabilirsiniz. Bilgi içeriği kullanıcı tarafından düzenlenecek.'
  },
  'sanzimanVerileri': {
    title: 'Şanzıman Verileri Hakkında',
    content: 'Bu bölümde şanzıman vites oranlarını tanımlayabilirsiniz. Hazır şanzıman presetlerinden birini seçebilir veya manuel olarak kendi değerlerinizi girebilirsiniz. Her vites için oran ve isteğe bağlı not ekleyebilirsiniz.'
  },
  'testVitesi': {
    title: 'Test Başlangıç Vitesi Hakkında',
    content: 'Motor freni testinin hangi viteste başladığını belirler. Şanzıman verilerini girdikten sonra bu listeden ilgili vitesi seçin. Seçilen vitesin oranı otomatik olarak hesaplamalarda kullanılacaktır.'
  },
  'torkKonvertoru': {
    title: 'Tork Konvertörü Hakkında',
    content: 'Tork konvertörü, motor ile şanzıman arasında hidrolik bağlantı sağlar. Kilitli konvertör direkt mekanik bağlantı sağlar (oran 1.0). Kilitsiz durumda ise düşük hızlarda tork çarpanı (1.8-2.5), yüksek hızlarda ise yaklaşık 1.0 oran uygulanır.'
  },
  'ecMatching': {
    title: 'Motor-TC Eşleştirme Analizi Hakkında',
    content: 'Allison TD-148G standardına göre motor ile tüm mevcut tork konvertörlerinin uyumluluğunu otomatik analiz eder. C4 (Stall Speed), C5 (Min Motor Devri), C7 (Türbin Torku Limiti) ve C8 (SR @ Governed) kontrollerini uygulayarak en uygun konvertörü önerir.'
  },
  'transferKutusu': {
    title: 'Transfer Kutusu Hakkında',
    content: 'Transfer kutusu, çift kademe (High/Low) veya tek kademe olabilir. High kademe genellikle 1:1 oranında (veya çok yakın), Low kademe ise 2-3 kat daha yüksek orandadır. Arazi koşullarında Low kademe kullanılır.'
  },
  'diferansiyel': {
    title: 'Diferansiyel Hakkında',
    content: 'Diferansiyel (son tahrik), dönme hareketini tekerleklere aktarır ve virajlarda iç/dış tekerlek hız farkını sağlar. Diferansiyel oranı, motor devri ile tekerlek devri arasındaki son dönüşüm oranıdır.'
  },
  'propshaftVerileri': {
    title: 'Propşaft Hakkında',
    content: 'Propşaft (kardan mili), şanzıman çıkışı ile transfer kutusu veya transfer kutusu ile diferansiyel arasında tork aktarımı sağlayan güç aktarma milidir. Oran 1:1 olarak çalışır, sadece kardan mafsalı ve yatak kayıplarından kaynaklanan verim kaybı uygulanır.'
  },
  'tekerlek': {
    title: 'Tekerlek Parametreleri Hakkında',
    content: 'Tekerlek yarıçapı, hız ve devir hesaplamalarında kritiktir. Yuvarlanma direnci (Crr) yol yüzeyine ve lastik tipine bağlıdır. Döner kütle faktörü (δ), dönen parçaların ataletini hesaba katar.'
  }
};

function showInfoPopup(infoKey) {
  var info = infoPopupData[infoKey];
  if(!info) return;
  
  // Mevcut popup varsa kaldır
  var existingPopup = document.getElementById('ve-info-popup');
  if(existingPopup) existingPopup.remove();
  
  var popup = document.createElement('div');
  popup.id = 've-info-popup';
  popup.style.cssText = 'position:fixed; top:50%; left:50%; transform:translate(-50%,-50%); background:var(--bg-secondary); border:1px solid var(--border-color); border-radius:0; box-shadow:0 8px 32px rgba(0,0,0,0.4); z-index:10005; max-width:400px; padding:20px;';
  
  popup.innerHTML = '<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">' +
    '<h3 style="margin:0; font-size:1rem; color:var(--text-heading);">' + info.title + '</h3>' +
    '<button onclick="closeInfoPopup()" style="background:none; border:none; color:var(--text-muted); cursor:pointer; font-size:1.2rem;">✕</button>' +
    '</div>' +
    '<p style="margin:0; font-size:0.85rem; color:var(--text-secondary); line-height:1.5;">' + info.content + '</p>';
  
  // Arka plan overlay
  var overlay = document.createElement('div');
  overlay.id = 've-info-overlay';
  overlay.style.cssText = 'position:fixed; top:0; left:0; right:0; bottom:0; background:rgba(0,0,0,0.5); z-index:10004;';
  overlay.onclick = closeInfoPopup;
  
  document.body.appendChild(overlay);
  document.body.appendChild(popup);
}

function closeInfoPopup() {
  var popup = document.getElementById('ve-info-popup');
  var overlay = document.getElementById('ve-info-overlay');
  if(popup) popup.remove();
  if(overlay) overlay.remove();
}

function deleteConnection(connId) {
  var conn = connections.find(function(c) { return c.id === connId; });
  if(!conn) return;
  
  // Bu bağlantıya bağlı sensörleri kopar
  nodes.forEach(function(n) {
    if(n.type === 'sensor' && n.data && n.data.attachedConnection === connId) {
      n.data.attachedConnection = '';
      n.data.selectedSignal = '';
    }
  });
  
  connections = connections.filter(function(c) { return c.id !== connId; });
  
  // Port işaretlerini güncelle
  updatePortStatus(conn.from);
  updatePortStatus(conn.to);
  
  updateAllConnections();
  updateNodeCount();
}

function updatePortStatus(nodeId) {
  var hasOutput = connections.some(function(c) { return c.from === nodeId; });
  var hasInput = connections.some(function(c) { return c.to === nodeId; });
  
  var outPort = document.querySelector('#' + nodeId + ' .ve-node-port.output');
  var inPort = document.querySelector('#' + nodeId + ' .ve-node-port.input');
  
  if(outPort) outPort.classList.toggle('connected', hasOutput);
  if(inPort) inPort.classList.toggle('connected', hasInput);
}

function addToSelection(node) {
  if(selectedNodes.indexOf(node) === -1) {
    selectedNodes.push(node);
  }
  var el = document.getElementById(node.id);
  if(el) el.classList.add('selected');
  
  if(selectedNodes.length === 1) {
    showNodeProperties(node);
  } else {
    showMultipleSelection();
  }
}

function clearSelection() {
  selectedNodes.forEach(function(n) {
    var el = document.getElementById(n.id);
    if(el) el.classList.remove('selected');
  });
  selectedNodes = [];
  if(typeof clearAnnotationSelection === 'function') clearAnnotationSelection();
  showEmptyProperties();
}

function showNodeProperties(node) {
  var content = document.querySelector('.ve-properties-content');
  if(!content) return;
  // Modal başlığında bileşenin adı ve sembolü görünür
  var titleEl = document.getElementById('ve-properties-title');
  if(titleEl) {
    var nm = (node && (node.customName || (node.def && node.def.name))) || 'Özellikler';
    titleEl.innerHTML = '<span class="mf-ico mf-ico-sliders"></span>' + nm + ' <span style="opacity:0.5;font-weight:400;font-size:0.7rem;margin-left:6px;">' + (node.id || '') + '</span>';
  }
  
  var html = '<div style="position:relative; text-align:center; margin-bottom:12px;">';
  html += node.def.svg.replace('width="50"', 'width="50"').replace('height="50"', 'height="50"');
  html += '<button onclick="deleteSelectedNodes()" style="position:absolute; top:-4px; right:-4px; width:22px; height:22px; border-radius:50%; background:var(--accent-danger); color:white; border:none; cursor:pointer; font-size:0.65rem; display:flex; align-items:center; justify-content:center; opacity:0.7; transition:opacity 0.15s;" onmouseenter="this.style.opacity=1" onmouseleave="this.style.opacity=0.7" title="Bileşeni Sil"><span class="mf-ico mf-ico-trash"></span></button>';
  html += '</div>';
  var displayName = node.customName || node.def.name;
  html += '<div style="font-weight:600; color:var(--text-heading); margin-bottom:4px; text-align:center; display:flex; align-items:center; justify-content:center; gap:6px;">';
  html += '<span id="ve-node-name-display-' + node.id + '">' + displayName + '</span>';
  html += '<button onclick="veEditNodeName(\'' + node.id + '\')" style="width:18px; height:18px; border:none; background:none; cursor:pointer; font-size:0.7rem; opacity:0.6; padding:0;" title="İsmi düzenle"><span class="mf-ico mf-ico-edit"></span></button>';
  html += '</div>';
  html += '<div style="font-size:0.7rem; color:var(--text-muted); margin-bottom:12px; text-align:center;">ID: ' + node.id + '</div>';
  
  // Node tipine göre özel içerik
  if(node.type === 'engine') {
    html += getEnginePropertiesHTML(node);
  } else if(node.type === 'gearbox') {
    html += getGearboxPropertiesHTML(node);
  } else if(node.type === 'shift-controller') {
    html += getShiftControllerPropertiesHTML(node);
  } else if(node.type === 'torque-converter') {
    html += getTorqueConverterPropertiesHTML(node);
  } else if(node.type === 'ec-matching') {
    html += getECMatchingPropertiesHTML(node);
  } else if(node.type === 'engine-gearbox-matching') {
    html += getEngineGearboxMatchingHTML(node);
  } else if(node.type === 'transfer') {
    html += getTransferPropertiesHTML(node);
  } else if(node.type === 'propshaft') {
    html += getPropshaftPropertiesHTML(node);
  } else if(node.type === 'differential') {
    html += getDifferentialPropertiesHTML(node);
  } else if(node.type === 'wheel') {
    html += getWheelPropertiesHTML(node);
  } else if(node.type === 'vehicle') {
    html += getVehiclePropertiesHTML(node);
  } else if(node.type === 'sensor') {
    html += getSensorPropertiesHTML(node);
  } else if(node.type === 'scenario') {
    html += getScenarioPropertiesHTML(node);
  } else if(node.type === 'coast-down') {
    html += getCoastDownPropertiesHTML(node);
  } else if(node.type === 'obstacle-crossing') {
    html += getObstacleCrossingPropertiesHTML(node);
  } else if(node.type === 'mnt-motor' || node.type === 'mnt-gearbox' || node.type === 'mnt-shaft' || node.type === 'mnt-bracket' || node.type === 'mnt-mass') {
    html += getMntMassPropertiesHTML(node);
  } else if(node.type === 'mnt-mount') {
    html += getMntMountPropertiesHTML(node);
  } else if(node.type === 'mnt-solver') {
    html += getMntSolverPropertiesHTML(node);
  } else if(node.type === 'solver') {
    html += getSolverPropertiesHTML(node);
  } else if(node.type === 'road') {
    html += getRoadPropertiesHTML(node);
  } else if(node.type === 'parametric') {
    html += getParametricPropertiesHTML(node);
  } else if(node.type === 'sensor-wizard') {
    html += getSensorWizardPropertiesHTML(node);
  } else if(node.type === 'terminator') {
    html += getTerminatorPropertiesHTML(node);
  } else if(node.type === 'gear-shift') {
    html += getGearShiftPropertiesHTML(node);
  } else {
    html += getDefaultPropertiesHTML(node);
  }
  
  
  content.innerHTML = html;
  // Modal OTOMATİK AÇILMAZ — tek tık sadece seçim yapar, çift tık (veAttachNodeDrag)
  // veya marker tıklaması modal'ı açar. Eğer modal zaten açıksa içerik yenilenir.


  // Motor bileşeni için grafik çiz ve kategori dropdown'ı doldur
  if(node.type === 'engine') {
    setTimeout(function() {
      // Kategori dropdown'ını doldur
      onVEMotorCategoryChange(node.id);
      // Grafiği güncelle
      updateVEMotorChart(node.id);
    }, 100);
  }
  
  // Tork konvertörü grafikleri
  if(node.type === 'torque-converter' && veActiveModule === 'full-throttle') {
    setTimeout(function() {
      updateVETCCharts(node.id);
    }, 100);
  }
  
  // Motor-TC Eşleştirme bileşeni: analizi çalıştır
  if(node.type === 'ec-matching') {
    setTimeout(function() {
      runECMatchingAnalysis(node.id);
    }, 150);
  }
  // Motor-Şanzıman Eşleştirme bileşeni: analizi çalıştır
  if(node.type === 'engine-gearbox-matching') {
    setTimeout(function() {
      runEngineGearboxMatchingAnalysis(node.id);
    }, 150);
  }
  
  // Yol/Ortam bileşeni: Leaflet haritayı otomatik yükle
  if(node.type === 'road') {
    setTimeout(function() {
      veInitRoadMap(node.id);
    }, 400);
  }

  // Takoz Çözücü: bağlı kütle+takozları otomatik hesapla + 3D viewer
  if(node.type === 'mnt-solver') {
    setTimeout(function() {
      if(typeof veMntSolverCompute === 'function') veMntSolverCompute(node.id);
    }, 120);
  }
}
