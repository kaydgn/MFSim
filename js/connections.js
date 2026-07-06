// ============================================================================
// TOPOLOJİ MATEMATİK HESAPLAMA SİSTEMİ
// ============================================================================
var TopologyMath = {
  // Topoloji geçerliliğini kontrol et
  validateTopology: function() {
    var errors = [];
    var warnings = [];
    
    // En az bir motor ve bir araç olmalı
    var hasEngine = nodes.some(function(n) { return n.type === 'engine'; });
    var hasVehicle = nodes.some(function(n) { return n.type === 'vehicle'; });
    
    if(!hasEngine) errors.push('Topolojide motor bileşeni eksik');
    if(!hasVehicle) warnings.push('Topolojide araç gövdesi bileşeni eksik');
    
    // Bağlantısız node'ları bul (standalone bileşenler hariç)
    var standaloneTypes = ['vehicle','road','sensor','solver','scenario','coast-down','parametric','terminator'];
    nodes.forEach(function(node) {
      if(standaloneTypes.indexOf(node.type) > -1) return;
      var hasConnection = connections.some(function(c) {
        return c.from === node.id || c.to === node.id;
      });
      if(!hasConnection) {
        warnings.push(node.def.name + ' (' + node.id + ') bağlantısız');
      }
    });
    
    return {
      valid: errors.length === 0,
      errors: errors,
      warnings: warnings
    };
  },
  
  // Güç akışı sırasını hesapla (topolojik sıralama)
  calculatePowerFlowOrder: function() {
    var order = [];
    var visited = {};
    var inDegree = {};
    
    // Her node için gelen bağlantı sayısını hesapla
    nodes.forEach(function(n) {
      inDegree[n.id] = 0;
    });
    
    connections.forEach(function(c) {
      inDegree[c.to] = (inDegree[c.to] || 0) + 1;
    });
    
    // Gelen bağlantısı olmayan node'larla başla
    var queue = nodes.filter(function(n) {
      return inDegree[n.id] === 0;
    });
    
    while(queue.length > 0) {
      var node = queue.shift();
      order.push(node);
      visited[node.id] = true;
      
      // Bu node'dan çıkan bağlantıları bul
      connections.forEach(function(c) {
        if(c.from === node.id && !visited[c.to]) {
          inDegree[c.to]--;
          if(inDegree[c.to] === 0) {
            var targetNode = nodes.find(function(n) { return n.id === c.to; });
            if(targetNode) queue.push(targetNode);
          }
        }
      });
    }
    
    return order;
  },
  
  // Motor tork/güç interpolasyonu
  interpolateMotorValue: function(nodeId, rpm, valueType) {
    var node = nodes.find(function(n) { return n.id === nodeId; });
    if(!node || !node.data || !node.data.torqueData) return null;
    
    var data = node.data.torqueData;
    if(data.length < 2) return null;
    
    // RPM aralığını bul
    for(var i = 0; i < data.length - 1; i++) {
      if(rpm >= data[i].rpm && rpm <= data[i+1].rpm) {
        var t = (rpm - data[i].rpm) / (data[i+1].rpm - data[i].rpm);
        var v1 = valueType === 'torque' ? data[i].torque : data[i].power;
        var v2 = valueType === 'torque' ? data[i+1].torque : data[i+1].power;
        return v1 + t * (v2 - v1);
      }
    }
    
    // Aralık dışında
    if(rpm < data[0].rpm) {
      return valueType === 'torque' ? data[0].torque : data[0].power;
    }
    return valueType === 'torque' ? data[data.length-1].torque : data[data.length-1].power;
  },
  
  // Sonlandırıcı tespit — zincir nerede bitmeli?
  getChainEndpoints: function() {
    var endpoints = [];
    var terminators = nodes.filter(function(n) { return n.type === 'terminator'; });
    
    terminators.forEach(function(term) {
      var inConn = connections.find(function(c) { return c.to === term.id; });
      if(inConn) {
        endpoints.push({
          terminatorId: term.id,
          cutNodeId: inConn.from, // Bu node'un çıkışında kes
          cutPort: inConn.fromPort || 'output'
        });
      }
    });
    
    return endpoints;
  },
  
  // Sonlandırıcıya kadar olan güç zincirini bul
  getPartialChain: function(terminatorId) {
    var term = nodes.find(function(n) { return n.id === terminatorId; });
    if(!term) return [];
    
    var chain = [];
    var visited = {};
    var driveTypes = ['engine','torque-converter','gearbox','transfer','differential','wheel'];
    
    function traceUp(nodeId) {
      if(visited[nodeId]) return;
      visited[nodeId] = true;
      var nd = nodes.find(function(n) { return n.id === nodeId; });
      if(!nd) return;
      if(driveTypes.indexOf(nd.type) > -1) {
        chain.unshift(nd);
      }
      connections.forEach(function(c) {
        if(c.to === nodeId) traceUp(c.from);
      });
    }
    
    var inConn = connections.find(function(c) { return c.to === term.id; });
    if(inConn) traceUp(inConn.from);
    
    return chain;
  },
  
  // Kısmi simülasyon: motordan sonlandırıcıya kadar olan zincirde değerleri hesapla
  simulatePartialChain: function(chain, inputRpm) {
    if(!chain || chain.length === 0) return null;
    
    var result = { rpm: inputRpm, torque: 0, power: 0, steps: [] };
    
    chain.forEach(function(nd) {
      var step = { nodeId: nd.id, type: nd.type, name: nd.customName || (componentDefs[nd.type] || {}).name || nd.type };
      
      if(nd.type === 'engine') {
        var tq = TopologyMath.interpolateMotorValue(nd.id, inputRpm, 'torque');
        var pw = TopologyMath.interpolateMotorValue(nd.id, inputRpm, 'power');
        result.torque = tq || 0;
        result.power = pw || 0;
        result.rpm = inputRpm;
        step.outputTorque = result.torque;
        step.outputRpm = result.rpm;
        step.outputPower = result.power;
        
      } else if(nd.type === 'torque-converter') {
        var d = nd.data || {};
        var isLocked = d.isLocked !== false; // default kilitli
        var tcRat = isLocked ? 1.0 : (parseFloat(d.tcRatio) || 1.0);
        var srTC = isLocked ? 1.0 : Math.min(0.98, 1.0 / tcRat);
        result.torque = result.torque * tcRat;
        result.rpm = result.rpm * srTC;
        result.power = result.torque * result.rpm * Math.PI / 30 / 1000;
        step.torqueRatio = tcRat;
        step.speedRatio = srTC;
        step.outputTorque = result.torque;
        step.outputRpm = result.rpm;
        
      } else if(nd.type === 'gearbox') {
        var d2 = nd.data || {};
        var ratios = d2.gearRatios || [3.5, 2.0, 1.4, 1.0, 0.8];
        var gear = d2.currentGear || 1;
        var ratio = ratios[gear - 1] || 1;
        var eff = (d2.efficiency || 97) / 100;
        result.torque = result.torque * ratio * eff;
        result.rpm = result.rpm / ratio;
        result.power = result.torque * result.rpm * Math.PI / 30 / 1000;
        step.gearRatio = ratio;
        step.gear = gear;
        step.outputTorque = result.torque;
        step.outputRpm = result.rpm;
        
      } else if(nd.type === 'transfer') {
        var d3 = nd.data || {};
        var tRatio = d3.ratio || 1.0;
        var tEff = (d3.efficiency || 98) / 100;
        result.torque = result.torque * tRatio * tEff;
        result.rpm = result.rpm / tRatio;
        step.outputTorque = result.torque;
        step.outputRpm = result.rpm;
        
      } else if(nd.type === 'differential') {
        var d4 = nd.data || {};
        var dRatio = d4.ratio || 4.11;
        var dEff = (d4.efficiency || 96) / 100;
        result.torque = result.torque * dRatio * dEff;
        result.rpm = result.rpm / dRatio;
        step.outputTorque = result.torque;
        step.outputRpm = result.rpm;
        
      } else if(nd.type === 'wheel') {
        var d5 = nd.data || {};
        var radius = d5.rollingRadius || 0.5;
        result.force = result.torque / radius; // N
        result.wheelSpeed = result.rpm * 2 * Math.PI * radius / 60; // m/s
        step.tractionForce = result.force;
        step.wheelSpeed = result.wheelSpeed;
        step.outputTorque = result.torque;
        step.outputRpm = result.rpm;
      }
      
      result.steps.push(step);
    });
    
    return result;
  }
};

// ============================================================================
// BAĞLANTI ÇİZİM GÜNCELLEMESİ (Farklı çizgi tipleri desteği)
// ============================================================================

function getPortPosition(node, portType, portIndex) {
  var nodeWidth = node.width || 65;
  var nodeHeight = node.height || 60;
  

  var def = componentDefs[node.type] || {};
  portIndex = portIndex || 0;
  
  var isInput = portType.startsWith('input');
  var isOutput = portType.startsWith('output');
  
  if(portType.indexOf('-') > -1) {
    portIndex = parseInt(portType.split('-')[1]) || 0;
  }
  
  var totalPorts = (typeof nodePortCount === 'function') ? nodePortCount(node, isInput ? 'inputs' : 'outputs') : (isInput ? (def.inputs || 0) : (def.outputs || 0));
  var pos = (node.data && node.data.portPositions && node.data.portPositions[portType]) || null;
  // Varsayılan kenar: portLayout → aynalama → klasik (defaultPortSide, components.js)
  var side = pos ? pos.side
    : ((typeof defaultPortSide === 'function') ? defaultPortSide(node, portType)
      : (node.mirrored ? (isInput ? 'right' : 'left') : (isInput ? 'left' : 'right')));
  
  // Kenar üzerindeki konum: aynı kenardaki portların sırasına göre (portPerpPercent).
  var frac = ((typeof portPerpPercent === 'function') ? portPerpPercent(node, portType)
    : ((portIndex + 1) / (totalPorts + 1) * 100)) / 100;
  var x, y;
  switch(side) {
    case 'top':
      x = node.x + nodeWidth * frac; y = node.y - 7; break;
    case 'right':
      x = node.x + nodeWidth + 7; y = node.y + nodeHeight * frac; break;
    case 'bottom':
      x = node.x + nodeWidth * frac; y = node.y + nodeHeight + 7; break;
    case 'left':
      x = node.x - 7; y = node.y + nodeHeight * frac; break;
    default:
      if(isInput) { x = node.x - 7; y = node.y + nodeHeight * frac; }
      else { x = node.x + nodeWidth + 7; y = node.y + nodeHeight * frac; }
  }

  return {x: x, y: y, side: side};
}

function updateAllConnections() {
  var svg = document.getElementById('ve-connections-layer');
  if(!svg) return;
  
  // Mevcut çizgileri temizle (tempLine hariç)
  Array.from(svg.querySelectorAll('path:not(.ve-connection-temp), circle.ve-control-point, .ve-sensor-dot, .ve-conn-midpoint, .ve-sensor-line, .ve-comp-attach-point, .ve-comp-sensor-line')).forEach(function(el) {
    el.remove();
  });
  
  connections.forEach(function(conn) {
    var fromNode = nodes.find(function(n) { return n.id === conn.from; });
    var toNode = nodes.find(function(n) { return n.id === conn.to; });
    if(!fromNode || !toNode) return;

    // Takoz modülü: mount düğümleri (gövde/takoz/cradle) arası bağlantılar ŞASİ
    // METAFORU ile çizilir (cp-mount.js veMntDecorateConnections) → burada port-port
    // eğrisi ÇİZME. Diğer topolojiler (Araç Performans vb.) etkilenmez.
    var _fd = (typeof componentDefs!=='undefined' && componentDefs[fromNode.type]) || {};
    var _td = (typeof componentDefs!=='undefined' && componentDefs[toNode.type]) || {};
    if((_fd.isMount||_fd.isMountBody) && (_td.isMount||_td.isMountBody)) return;

    // Port pozisyonlarını al
    var fromPortType = conn.fromPort || 'output';
    var toPortType = conn.toPort || 'input';
    var fromPort = getPortPosition(fromNode, fromPortType);
    var toPort = getPortPosition(toNode, toPortType);
    
    var x1 = fromPort.x;
    var y1 = fromPort.y;
    var x2 = toPort.x;
    var y2 = toPort.y;
    
    var path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('class', 've-connection');
    path.setAttribute('data-conn-id', conn.id);
    
    var d = '';
    var lineType = conn.lineType || 'curve';
    
    if(lineType === 'straight') {
      // Düz çizgi
      if(conn.controlPoints && conn.controlPoints.length > 0) {
        d = 'M ' + x1 + ' ' + y1;
        conn.controlPoints.forEach(function(cp) {
          d += ' L ' + cp.x + ' ' + cp.y;
        });
        d += ' L ' + x2 + ' ' + y2;
      } else {
        d = 'M ' + x1 + ' ' + y1 + ' L ' + x2 + ' ' + y2;
      }
    } else if(lineType === 'stepped') {
      // Kademeli çizgi
      var midX = (x1 + x2) / 2;
      d = 'M ' + x1 + ' ' + y1 + ' L ' + midX + ' ' + y1 + ' L ' + midX + ' ' + y2 + ' L ' + x2 + ' ' + y2;
    } else {
      // Eğri (varsayılan) - Akıllı yönlendirme
      // Port yönlerine göre kontrol noktaları hesapla
      var fromSide = fromPort.side;
      var toSide = toPort.side;
      var offset = 40; // Bileşenden uzaklaşma mesafesi
      
      var cp1x, cp1y, cp2x, cp2y;
      
      // Çıkış portu yönüne göre ilk kontrol noktası
      switch(fromSide) {
        case 'right':
          cp1x = x1 + offset;
          cp1y = y1;
          break;
        case 'left':
          cp1x = x1 - offset;
          cp1y = y1;
          break;
        case 'top':
          cp1x = x1;
          cp1y = y1 - offset;
          break;
        case 'bottom':
          cp1x = x1;
          cp1y = y1 + offset;
          break;
        default:
          cp1x = x1 + offset;
          cp1y = y1;
      }
      
      // Giriş portu yönüne göre ikinci kontrol noktası
      switch(toSide) {
        case 'left':
          cp2x = x2 - offset;
          cp2y = y2;
          break;
        case 'right':
          cp2x = x2 + offset;
          cp2y = y2;
          break;
        case 'top':
          cp2x = x2;
          cp2y = y2 - offset;
          break;
        case 'bottom':
          cp2x = x2;
          cp2y = y2 + offset;
          break;
        default:
          cp2x = x2 - offset;
          cp2y = y2;
      }
      
      d = 'M ' + x1 + ' ' + y1 + ' C ' + cp1x + ' ' + cp1y + ', ' + cp2x + ' ' + cp2y + ', ' + x2 + ' ' + y2;
    }
    
    path.setAttribute('d', d);
    
    // Konvertör ↔ Şanzıman bağlantısı: koyu turuncu (aile filtreleme ilişkisini gösterir)
    var connTypes = [fromNode.type, toNode.type].sort().join('|');
    if(connTypes === 'gearbox|torque-converter') {
      path.classList.add('ve-connection-tc-gb');
    }
    path.addEventListener('contextmenu', function(e) {
      showConnectionContextMenu(e, conn.id);
    });
    
    // Sol tık ile seçme
    path.addEventListener('click', function(e) {
      e.stopPropagation();
      // Seçili bağlantıyı vurgula
      svg.querySelectorAll('.ve-connection').forEach(function(p) {
        p.classList.remove('selected');
      });
      path.classList.add('selected');
    });
    
    svg.appendChild(path);
    
    // Bağlantı ortasında TEK sensör göstergesi (kaç sensör bağlı olursa olsun)
    var connSensors = nodes.filter(function(nd) {
      return nd.type === 'sensor' && nd.data && nd.data.attachedConnection === conn.id;
    });
    
    if(connSensors.length > 0) {
      var mx = (x1 + x2) / 2;
      var my = (y1 + y2) / 2;
      
      // TEK yeşil dot - bağlantı ölçüm noktası
      var dotSize = 10;
      var sensorDot = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      sensorDot.setAttribute('class', 've-sensor-dot');
      sensorDot.setAttribute('x', mx - dotSize/2);
      sensorDot.setAttribute('y', my - dotSize/2);
      sensorDot.setAttribute('width', dotSize);
      sensorDot.setAttribute('height', dotSize);
      sensorDot.setAttribute('rx', '2');
      sensorDot.setAttribute('data-conn-id', conn.id);
      sensorDot.style.cssText = 'fill:#22c55e; stroke:white; stroke-width:2; cursor:default; pointer-events:all;';
      
      // Sensör sayısı göstergesi (1'den fazlaysa)
      if(connSensors.length > 1) {
        sensorDot.setAttribute('width', '14');
        sensorDot.setAttribute('height', '14');
        sensorDot.setAttribute('x', mx - 7);
        sensorDot.setAttribute('y', my - 7);
      }
      
      svg.appendChild(sensorDot);
      
      // Sayı etiketi (2+ sensör)
      if(connSensors.length > 1) {
        var countLabel = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        countLabel.setAttribute('x', mx);
        countLabel.setAttribute('y', my + 3.5);
        countLabel.setAttribute('text-anchor', 'middle');
        countLabel.setAttribute('fill', 'white');
        countLabel.setAttribute('font-size', '8');
        countLabel.setAttribute('font-weight', '700');
        countLabel.setAttribute('class', 've-sensor-dot');
        countLabel.style.pointerEvents = 'none';
        countLabel.textContent = connSensors.length;
        svg.appendChild(countLabel);
      }
      
      // Her sensörden tek dot'a bağlantı çizgisi (normal bağlantı stili)
      connSensors.forEach(function(sNode) {
        var sPort = getPortPosition(sNode, 'input');
        var sLine = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        sLine.setAttribute('class', 've-sensor-line');
        var offset = 40;
        var cp1x, cp1y, cp2x, cp2y;
        // Sensor port side → first control point
        switch(sPort.side) {
          case 'right': cp1x = sPort.x + offset; cp1y = sPort.y; break;
          case 'top': cp1x = sPort.x; cp1y = sPort.y - offset; break;
          case 'bottom': cp1x = sPort.x; cp1y = sPort.y + offset; break;
          default: cp1x = sPort.x - offset; cp1y = sPort.y; break; // left
        }
        // Target midpoint → second control point (approach from best direction)
        if(Math.abs(mx - sPort.x) > Math.abs(my - sPort.y)) {
          cp2x = mx + (sPort.x > mx ? offset : -offset); cp2y = my;
        } else {
          cp2x = mx; cp2y = my + (sPort.y > my ? offset : -offset);
        }
        var sD = 'M ' + sPort.x + ' ' + sPort.y + ' C ' + cp1x + ' ' + cp1y + ' ' + cp2x + ' ' + cp2y + ' ' + mx + ' ' + my;
        sLine.setAttribute('d', sD);
        sLine.style.cssText = 'fill:none; stroke:#22c55e; stroke-width:2; stroke-dasharray:5,3; pointer-events:none; opacity:0.7;';
        svg.appendChild(sLine);
      });
    }
    
    // Sensör bağlantı modundayken: tüm bağlantıların ortasında bağlanılabilir midpoint göster
    if(isConnecting && connectingFrom && connectingFrom.node && connectingFrom.node.type === 'sensor') {
      var midX = (x1 + x2) / 2;
      var midY = (y1 + y2) / 2;
      
      var midpoint = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      midpoint.setAttribute('class', 've-conn-midpoint');
      midpoint.setAttribute('x', midX - 6);
      midpoint.setAttribute('y', midY - 6);
      midpoint.setAttribute('width', '12');
      midpoint.setAttribute('height', '12');
      midpoint.setAttribute('rx', '3');
      midpoint.setAttribute('data-conn-id', conn.id);
      midpoint.style.cssText = 'fill:rgba(59,130,246,0.3); stroke:#3b82f6; stroke-width:2.5; cursor:pointer; pointer-events:all;';
      
      // Hover efekti
      midpoint.addEventListener('mouseenter', function() {
        this.style.fill = 'rgba(59,130,246,0.6)';
        this.setAttribute('width', '16'); this.setAttribute('height', '16');
        this.setAttribute('x', parseFloat(this.getAttribute('x')) - 2);
        this.setAttribute('y', parseFloat(this.getAttribute('y')) - 2);
      });
      midpoint.addEventListener('mouseleave', function() {
        this.style.fill = 'rgba(59,130,246,0.3)';
        this.setAttribute('width', '12'); this.setAttribute('height', '12');
        this.setAttribute('x', parseFloat(this.getAttribute('x')) + 2);
        this.setAttribute('y', parseFloat(this.getAttribute('y')) + 2);
      });
      
      // Tıklama: sensörü bu bağlantıya bağla
      midpoint.addEventListener('mousedown', function(e) {
        e.stopPropagation();
        e.preventDefault();
        var cid = this.getAttribute('data-conn-id');
        if(isConnecting && connectingFrom && connectingFrom.node && connectingFrom.node.type === 'sensor') {
          var sensorNode = connectingFrom.node;
          
          // Önceki bağlantıdan ayır
          if(sensorNode.data && sensorNode.data.attachedConnection) {
            veDetachSensor(sensorNode);
          }
          
          // Yeni bağlantıya bağla
          veAttachSensorToConnection(sensorNode, cid);
          
          // Bağlantı stilini sıfırla ve güncelle
          if(connectingFrom.element) { connectingFrom.element.style.background = ''; connectingFrom.element.style.transform = ''; }
          cleanupTempLine();
          updateAllConnections();
          showNodeProperties(sensorNode);
        }
      });
      
      svg.appendChild(midpoint);
    }
    
    // Kontrol noktalarını çiz
    if(conn.controlPoints) {
      conn.controlPoints.forEach(function(cp) {
        var circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        circle.setAttribute('class', 've-control-point');
        circle.setAttribute('cx', cp.x);
        circle.setAttribute('cy', cp.y);
        circle.setAttribute('r', '6');
        circle.setAttribute('data-cp-id', cp.id);
        circle.setAttribute('data-conn-id', conn.id);
        circle.style.cssText = 'fill:#fbbf24; stroke:#000; stroke-width:2; cursor:move; pointer-events:all;';
        
        // Kontrol noktası sürükleme
        circle.addEventListener('mousedown', function(e) {
          if(e.button === 0) { // Sol tık - sürükle
            e.stopPropagation();
            startControlPointDrag(e, conn, cp);
          }
        });
        
        // Kontrol noktası sağ tık - sil
        circle.addEventListener('contextmenu', function(e) {
          e.preventDefault();
          e.stopPropagation();
          deleteControlPoint(conn, cp);
        });
        
        svg.appendChild(circle);
      });
    }
  });
  
  // Sensör bağlantı modundayken: bileşen üzerinde bağlanılabilir noktalar göster (vehicle, road)
  if(isConnecting && connectingFrom && connectingFrom.node && connectingFrom.node.type === 'sensor') {
    var attachableTypes = ['vehicle', 'road', 'scenario'];
    nodes.forEach(function(nd) {
      if(attachableTypes.indexOf(nd.type) === -1) return;
      if(!COMPONENT_SIGNALS[nd.type]) return;
      
      // Doğrudan node canvas koordinatları kullan (getPortPosition ile aynı yöntem)
      var cx = nd.x + (nd.width || 65) / 2;
      var cy = nd.y + (nd.height || 60) / 2;
      
      // Turuncu kare bağlantı noktası
      var compDot = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
      compDot.setAttribute('class', 've-comp-attach-point');
      compDot.setAttribute('x', cx - 8);
      compDot.setAttribute('y', cy - 8);
      compDot.setAttribute('width', '16');
      compDot.setAttribute('height', '16');
      compDot.setAttribute('rx', '4');
      compDot.setAttribute('data-comp-id', nd.id);
      compDot.style.cssText = 'fill:rgba(245,158,11,0.4); stroke:#f59e0b; stroke-width:2.5; cursor:pointer; pointer-events:all;';
      
      compDot.addEventListener('mouseenter', function() {
        this.style.fill = 'rgba(245,158,11,0.7)';
        this.setAttribute('width', '20'); this.setAttribute('height', '20');
        this.setAttribute('x', parseFloat(this.getAttribute('x')) - 2);
        this.setAttribute('y', parseFloat(this.getAttribute('y')) - 2);
      });
      compDot.addEventListener('mouseleave', function() {
        this.style.fill = 'rgba(245,158,11,0.4)';
        this.setAttribute('width', '16'); this.setAttribute('height', '16');
        this.setAttribute('x', parseFloat(this.getAttribute('x')) + 2);
        this.setAttribute('y', parseFloat(this.getAttribute('y')) + 2);
      });
      
      compDot.addEventListener('mousedown', function(e) {
        e.stopPropagation();
        e.preventDefault();
        var compId = this.getAttribute('data-comp-id');
        if(isConnecting && connectingFrom && connectingFrom.node && connectingFrom.node.type === 'sensor') {
          var sensorNode = connectingFrom.node;
          veDetachSensor(sensorNode);
          veAttachSensorToComponent(sensorNode, compId);
          if(connectingFrom.element) { connectingFrom.element.style.background = ''; connectingFrom.element.style.transform = ''; }
          cleanupTempLine();
          updateAllConnections();
          showNodeProperties(sensorNode);
        }
      });
      
      svg.appendChild(compDot);
    });
  }
  
  // Bileşene bağlı sensörlerin bağlantı çizgilerini çiz
  var compSensorGroups = {};
  nodes.forEach(function(sn) {
    if(sn.type !== 'sensor' || !sn.data || !sn.data.attachedComponent) return;
    if(!compSensorGroups[sn.data.attachedComponent]) compSensorGroups[sn.data.attachedComponent] = [];
    compSensorGroups[sn.data.attachedComponent].push(sn);
  });
  
  Object.keys(compSensorGroups).forEach(function(compId) {
    var group = compSensorGroups[compId];
    var compNode = nodes.find(function(n) { return n.id === compId; });
    if(!compNode) return;
    
    // Doğrudan node canvas koordinatları kullan
    var cx2 = compNode.x + (compNode.width || 65) / 2;
    var cy2 = compNode.y + (compNode.height || 60) / 2;
    
    // TEK turuncu dot - bileşen ölçüm noktası
    var dotSize = group.length > 1 ? 14 : 10;
    var dot = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    dot.setAttribute('class', 've-sensor-dot');
    dot.setAttribute('x', cx2 - dotSize/2);
    dot.setAttribute('y', cy2 - dotSize/2);
    dot.setAttribute('width', dotSize);
    dot.setAttribute('height', dotSize);
    dot.setAttribute('rx', '3');
    dot.style.cssText = 'fill:#f59e0b; stroke:#000; stroke-width:1.5; cursor:default; pointer-events:all;';
    svg.appendChild(dot);
    
    // Sayı etiketi (2+ sensör)
    if(group.length > 1) {
      var cLabel = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      cLabel.setAttribute('x', cx2);
      cLabel.setAttribute('y', cy2 + 3.5);
      cLabel.setAttribute('text-anchor', 'middle');
      cLabel.setAttribute('fill', '#000');
      cLabel.setAttribute('font-size', '8');
      cLabel.setAttribute('font-weight', '700');
      cLabel.setAttribute('class', 've-sensor-dot');
      cLabel.style.pointerEvents = 'none';
      cLabel.textContent = group.length;
      svg.appendChild(cLabel);
    }
    
    // Her sensörden tek dot'a bağlantı çizgisi (normal bağlantı stili)
    group.forEach(function(sn) {
      var sPort = getPortPosition(sn, 'input');
      var offset = 40;
      var cp1x, cp1y, cp2x, cp2y;
      // Sensor port side → first control point
      switch(sPort.side) {
        case 'right': cp1x = sPort.x + offset; cp1y = sPort.y; break;
        case 'top': cp1x = sPort.x; cp1y = sPort.y - offset; break;
        case 'bottom': cp1x = sPort.x; cp1y = sPort.y + offset; break;
        default: cp1x = sPort.x - offset; cp1y = sPort.y; break;
      }
      // Target component center → second control point
      if(Math.abs(cx2 - sPort.x) > Math.abs(cy2 - sPort.y)) {
        cp2x = cx2 + (sPort.x > cx2 ? offset : -offset); cp2y = cy2;
      } else {
        cp2x = cx2; cp2y = cy2 + (sPort.y > cy2 ? offset : -offset);
      }
      var dStr = 'M ' + sPort.x + ' ' + sPort.y + ' C ' + cp1x + ' ' + cp1y + ' ' + cp2x + ' ' + cp2y + ' ' + cx2 + ' ' + cy2;
      var sLine = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      sLine.setAttribute('class', 've-sensor-line');
      sLine.setAttribute('d', dStr);
      sLine.style.cssText = 'fill:none; stroke:#f59e0b; stroke-width:2; stroke-dasharray:5,3; pointer-events:none; opacity:0.7;';
      svg.appendChild(sLine);
    });
  });
  
  // Topoloji sınır çerçevesini güncelle
  veUpdateBoundary();

  // Takoz modülü: takozların dış ucuna "şasi" sembolü çiz (varsa; başka
  // modüllerde no-op). Bağlantı katmanı her yenilendiğinde birlikte tazelenir.
  if(typeof veMntDecorateConnections === 'function') veMntDecorateConnections(svg);
}

// Kontrol noktası sürükleme
var isDraggingControlPoint = false;
var draggingControlPoint = null;

function startControlPointDrag(e, conn, cp) {
  isDraggingControlPoint = true;
  draggingControlPoint = {conn: conn, cp: cp};
  saveState();
  
  document.addEventListener('mousemove', doControlPointDrag);
  document.addEventListener('mouseup', stopControlPointDrag);
}

function doControlPointDrag(e) {
  if(!isDraggingControlPoint || !draggingControlPoint) return;
  
  var wrapperRect = document.getElementById('ve-canvas-wrapper').getBoundingClientRect();
  var canvasInitialOffset = 3000;
  
  var x = (e.clientX - wrapperRect.left - canvasOffset.x) / canvasZoom + canvasInitialOffset;
  var y = (e.clientY - wrapperRect.top - canvasOffset.y) / canvasZoom + canvasInitialOffset;
  
  draggingControlPoint.cp.x = x;
  draggingControlPoint.cp.y = y;
  
  updateAllConnections();
}

function stopControlPointDrag() {
  isDraggingControlPoint = false;
  draggingControlPoint = null;
  document.removeEventListener('mousemove', doControlPointDrag);
  document.removeEventListener('mouseup', stopControlPointDrag);
}

// Kontrol noktasını sil
function deleteControlPoint(conn, cp) {
  if(!conn.controlPoints) return;
  
  saveState();
  
  conn.controlPoints = conn.controlPoints.filter(function(p) {
    return p.id !== cp.id;
  });
  
  updateAllConnections();
  showToast('Kontrol noktası silindi');
}

// Sayfa yüklendiğinde ilk state'i kaydet
// ═══════════════════════════════════════════════════════════════════════════
// OTOMATİK DATA SENKRONİZASYON — 3 SN PERİYODİK
// Sekme gizliyken durdurulur (visibilitychange), görünürken yeniden başlar.
// ═══════════════════════════════════════════════════════════════════════════
var _veAutoSyncInterval = null;
var VE_AUTO_SYNC_MS = 3000;

function _veAutoSyncTick() {
  if(!nodes || nodes.length === 0) return;
  // Tek modül — veActiveModule sabit
  if(!veActiveModule) veActiveModule = 'full-throttle';
  nodes.forEach(function(node) {
    if(!node || !node.id) return;
    if(!node.data) node.data = {};
    try {
      switch(node.type) {
        case 'differential':
          onVEDiffParamChange(node.id);
          break;
        case 'propshaft':
          onVEPropshaftParamChange(node.id);
          break;
        case 'vehicle':
          if(veActiveModule === 'full-throttle') {
            onVEFTVehicleParamChange(node.id);
          } else {
            onVEVehicleParamChange(node.id);
          }
          break;
        case 'wheel':
          if(veActiveModule === 'full-throttle') {
            onVEFTWheelParamChange(node.id);
          } else {
            onVEWheelParamChange(node.id);
          }
          break;
        case 'gearbox':
          if(veActiveModule === 'full-throttle') {
            onVEFTGearDataChange(node.id);
          }
          break;
        case 'torque-converter':
          if(veActiveModule === 'full-throttle') {
            onVEFTTCParamChange(node.id);
          }
          break;
        case 'transfer':
          if(veActiveModule === 'full-throttle') {
            onVEFTTransferParamChange(node.id);
          }
          break;
        case 'solver':
          onVESolverParamChange(node.id);
          break;
      }
    } catch(e) { console.warn('[MFSim] Auto-sync hatası (' + (node ? node.type : '?') + '):', e.message); }
  });
}

function veStartAutoSync() {
  if(_veAutoSyncInterval) return;
  _veAutoSyncInterval = setInterval(_veAutoSyncTick, VE_AUTO_SYNC_MS);
}

function veStopAutoSync() {
  if(_veAutoSyncInterval) {
    clearInterval(_veAutoSyncInterval);
    _veAutoSyncInterval = null;
  }
}

veStartAutoSync();

if(typeof document !== 'undefined' && typeof document.addEventListener === 'function') {
  document.addEventListener('visibilitychange', function() {
    if(document.hidden) veStopAutoSync();
    else veStartAutoSync();
  });
}

setTimeout(function() {
  if(typeof saveState === 'function') {
    saveState();
  }
}, 500);
