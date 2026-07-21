// ====== HARİTA BÜYÜTME MODALI ======
var _veMapModalActive = null;
var _veMapModalOrigParent = null;
var _veMapModalOrigNext = null;
var _veMapModalInfoInterval = null;

function veExpandRoadMap(nodeId) {
  var map = veRoadMaps[nodeId];
  var mapContainer = document.getElementById('ve-road-map-' + nodeId);
  if(!map || !mapContainer) { showToast('Harita bulunamadı', 'warning'); return; }
  
  if(_veMapModalActive === nodeId) { veCloseMapModal(); return; }
  
  // Orijinal konumu kaydet
  _veMapModalOrigParent = mapContainer.parentElement;
  _veMapModalOrigNext = mapContainer.nextElementSibling;

  // Alttaki Özellikler modalı bu harita modalının altında kalmasın → otomatik kapan
  if(typeof veTogglePropertiesPanel === 'function') veTogglePropertiesPanel(false);

  // Overlay
  var overlay = document.createElement('div');
  overlay.id = 've-map-modal-overlay';
  overlay.style.cssText = 'position:fixed; inset:0; z-index:100000; background:rgba(0,0,0,0.82); display:flex; align-items:center; justify-content:center; padding:20px; backdrop-filter:blur(4px);';

  // Modal
  var modal = document.createElement('div');
  modal.id = 've-map-modal';
  modal.style.cssText = 'width:90%; max-width:1500px; min-width:480px; height:88vh; max-height:900px; background:var(--bg-secondary, #0f1218); border:1px solid var(--border-color, #1c2333); border-radius:0; display:flex; flex-direction:column; overflow:hidden; box-shadow:0 20px 60px rgba(0,0,0,0.6); position:relative;';

  // Header — ince ortak başlık
  var markerCount = (veRoadMarkers[nodeId] || []).length;
  var badge = markerCount > 0 ? ' <span style="font-size:0.6rem; padding:1px 6px; background:var(--accent-primary); color:#fff; border-radius:0; margin-left:6px;">' + markerCount + ' nokta</span>' : '';

  var header = document.createElement('div');
  header.style.cssText = 'display:flex; align-items:center; justify-content:space-between; padding:5px 12px; background:var(--bg-tertiary); border-bottom:1px solid var(--border-color); flex-shrink:0;';
  header.innerHTML = '<span style="font-size:0.72rem; font-weight:700; color:var(--text-heading);">🗺️ Güzergah Haritası' + badge + '</span>' +
    '<button onclick="veCloseMapModal()" title="Kapat (ESC)" style="width:24px; height:24px; display:flex; align-items:center; justify-content:center; background:transparent; border:1px solid var(--border-color); border-radius:0; cursor:pointer; font-size:0.78rem; color:var(--text-secondary); transition:all 0.12s;" onmouseover="this.style.background=\'var(--accent-danger)\';this.style.color=\'#fff\';this.style.borderColor=\'var(--accent-danger)\'" onmouseout="this.style.background=\'transparent\';this.style.color=\'var(--text-secondary)\';this.style.borderColor=\'var(--border-color)\'">✕</button>';
  modal.appendChild(header);
  
  // Toolbar
  var bs = 'padding:6px 12px; font-size:0.66rem; font-weight:600; border:none; border-radius:0; cursor:pointer; display:inline-flex; align-items:center; gap:4px; transition:opacity 0.12s;';
  var toolbar = document.createElement('div');
  toolbar.style.cssText = 'display:flex; align-items:center; gap:5px; padding:6px 14px; background:var(--bg-secondary); border-bottom:1px solid var(--border-color); flex-shrink:0; flex-wrap:wrap;';

  toolbar.innerHTML = '<button onclick="veCalcRouteAndProfiles(\'' + nodeId + '\')" style="' + bs + 'background:#1b5e20;color:white;">🛣️ Rota Hesapla</button>' +
    '<button onclick="veSearchLocation(\'' + nodeId + '\')" style="' + bs + 'background:#1565c0;color:white;"><span class="mf-ico mf-ico-search"></span> Konum Ara</button>' +
    '<button onclick="veClearRoute(\'' + nodeId + '\')" style="' + bs + 'background:var(--accent-danger);color:white;"><span class="mf-ico mf-ico-trash"></span> Temizle</button>' +
    '<span style="flex:1;"></span>' +
    '<span id="ve-map-modal-info" style="font-size:0.6rem; color:var(--text-muted);">Haritaya tıklayarak nokta ekleyin</span>';
  modal.appendChild(toolbar);
  
  // Harita alanı
  var mapBox = document.createElement('div');
  mapBox.id = 've-map-modal-container';
  mapBox.style.cssText = 'flex:1; position:relative; min-height:0;';
  modal.appendChild(mapBox);
  // Footer
  var footer = document.createElement('div');
  footer.style.cssText = 'display:flex; align-items:center; gap:10px; padding:5px 14px; background:var(--bg-tertiary); border-top:1px solid var(--border-color); flex-shrink:0; font-size:0.58rem; color:var(--text-muted);';
  footer.innerHTML = '<span>Sol tık: Rota noktası ekle</span><span style="opacity:0.4;">│</span><span>Rota üzerine tık: 📍 Referans noktası</span><span style="opacity:0.4;">│</span><span>Scroll: Zoom</span><span style="margin-left:auto; color:var(--text-secondary);">ESC — Kapat</span>';
  modal.appendChild(footer);
  
  // ── Sol ve sağ kenar resize tutamaçları ──
  var handleCSS = 'position:absolute; top:0; width:6px; height:100%; cursor:ew-resize; z-index:10; background:transparent; transition:background 0.15s;';
  var leftHandle = document.createElement('div');
  leftHandle.style.cssText = handleCSS + 'left:-3px;';
  leftHandle.addEventListener('mouseenter', function() { this.style.background = 'rgba(var(--accent-primary-rgb, 59,130,246), 0.5)'; });
  leftHandle.addEventListener('mouseleave', function() { this.style.background = 'transparent'; });
  var rightHandle = document.createElement('div');
  rightHandle.style.cssText = handleCSS + 'right:-3px;';
  rightHandle.addEventListener('mouseenter', function() { this.style.background = 'rgba(var(--accent-primary-rgb, 59,130,246), 0.5)'; });
  rightHandle.addEventListener('mouseleave', function() { this.style.background = 'transparent'; });
  modal.appendChild(leftHandle);
  modal.appendChild(rightHandle);

  function _veStartResize(e, side) {
    e.preventDefault();
    e.stopPropagation();
    var startX = e.clientX;
    var startW = modal.offsetWidth;
    var overlayW = overlay.clientWidth;
    var minW = 480;

    function onMove(ev) {
      var dx = ev.clientX - startX;
      var newW = side === 'left' ? startW - dx : startW + dx;
      newW = Math.max(minW, Math.min(newW, overlayW - 40));
      modal.style.width = newW + 'px';
      modal.style.maxWidth = newW + 'px';
      if(map) map.invalidateSize();
    }
    function onUp() {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      if(map) map.invalidateSize();
    }
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }
  leftHandle.addEventListener('mousedown', function(e) { _veStartResize(e, 'left'); });
  rightHandle.addEventListener('mousedown', function(e) { _veStartResize(e, 'right'); });

  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  // Haritayı modal'a taşı
  mapContainer.style.width = '100%';
  mapContainer.style.height = '100%';
  mapContainer.style.borderRadius = '0';
  mapContainer.style.border = 'none';
  mapContainer.style.margin = '0';
  mapBox.appendChild(mapContainer);
  
  _veMapModalActive = nodeId;
  
  // Yeniden boyutlandır
  setTimeout(function() {
    map.invalidateSize();
    var markers = veRoadMarkers[nodeId] || [];
    if(markers.length >= 2) {
      var bounds = L.latLngBounds(markers.map(function(m) { return m.getLatLng(); }));
      map.fitBounds(bounds, { padding: [50, 50] });
    }
  }, 80);
  
  // Bilgi güncelleme
  _veMapModalInfoInterval = setInterval(function() {
    var info = document.getElementById('ve-map-modal-info');
    if(!info) return;
    var mc = (veRoadMarkers[nodeId] || []).length;
    info.textContent = mc === 0 ? 'Haritaya tıklayarak nokta ekleyin' : mc + ' nokta seçildi' + (mc >= 2 ? ' — Rota hesaplanabilir' : '');
  }, 400);
  
  // ESC handler
  overlay._veEscHandler = function(e) { if(e.key === 'Escape') veCloseMapModal(); };
  document.addEventListener('keydown', overlay._veEscHandler);
  
  // Overlay tıklama ile kapat
  overlay.addEventListener('mousedown', function(e) { if(e.target === overlay) veCloseMapModal(); });
}

function veCloseMapModal() {
  var overlay = document.getElementById('ve-map-modal-overlay');
  if(!overlay || !_veMapModalActive) return;
  
  var nodeId = _veMapModalActive;
  var map = veRoadMaps[nodeId];
  var mapContainer = document.getElementById('ve-road-map-' + nodeId);
  
  if(_veMapModalInfoInterval) { clearInterval(_veMapModalInfoInterval); _veMapModalInfoInterval = null; }
  if(overlay._veEscHandler) document.removeEventListener('keydown', overlay._veEscHandler);
  
  // Haritayı geri taşı
  if(mapContainer && _veMapModalOrigParent) {
    mapContainer.style.width = '100%';
    mapContainer.style.height = '220px';
    mapContainer.style.borderRadius = '6px';
    mapContainer.style.border = '1px solid var(--border-color)';
    mapContainer.style.margin = '';
    
    if(_veMapModalOrigNext && _veMapModalOrigNext.parentElement === _veMapModalOrigParent) {
      _veMapModalOrigParent.insertBefore(mapContainer, _veMapModalOrigNext);
    } else {
      _veMapModalOrigParent.appendChild(mapContainer);
    }
    
    setTimeout(function() { if(map) map.invalidateSize(); }, 100);
  }
  
  // Modal kapandığında profil bölümüne scroll yap (varsa)
  var profilesSectionId = 've-road-profiles-' + nodeId;

  _veMapModalActive = null;
  _veMapModalOrigParent = null;
  _veMapModalOrigNext = null;
  overlay.remove();

  // Profil bölümü görünürse scroll
  setTimeout(function() {
    var ps = document.getElementById(profilesSectionId);
    if(ps && ps.style.display !== 'none') {
      ps.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, 200);
}

function veInitRoadMap(nodeId) {
  var container = document.getElementById('ve-road-map-' + nodeId);
  if(!container) return;

  // Modal açıksa haritayı yeniden oluşturma — modal kapanınca geri gelecek
  if(_veMapModalActive === nodeId && veRoadMaps[nodeId]) {
    return;
  }

  // DOM yenilenmişse (properties tekrar açılmışsa) eski instance'ı temizle
  if(veRoadMaps[nodeId]) {
    try { veRoadMaps[nodeId].remove(); } catch(e) {}
    veRoadMaps[nodeId] = null;
  }

  if(typeof L === 'undefined') {
    container.innerHTML = '<div style="padding:8px;color:#f44336;font-size:0.7rem;">Leaflet yüklenemedi.</div>';
    return;
  }

  // İzmir BMC Fabrika konumu
  var bmcKonum = [38.375, 27.100];
  var map = L.map(container, { center: bmcKonum, zoom: 11, minZoom: 5, maxZoom: 18 });
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OSM' }).addTo(map);

  veRoadMaps[nodeId] = map;
  veRoadMarkers[nodeId] = [];
  veRoadPolylines[nodeId] = null;
  veRoadOSRMlines[nodeId] = null;

  // Arama butonu (sağ üst köşe)
  var searchControl = L.control({ position: 'topright' });
  searchControl.onAdd = function() {
    var div = L.DomUtil.create('div', 'leaflet-bar');
    div.style.background = 'white';
    div.style.padding = '0';
    div.innerHTML = '<a href="#" title="Konum Ara" style="display:block;width:30px;height:30px;line-height:30px;text-align:center;font-size:16px;text-decoration:none;color:#333;"><span class="mf-ico mf-ico-search"></span></a>';
    L.DomEvent.disableClickPropagation(div);
    L.DomEvent.on(div.querySelector('a'), 'click', function(e) {
      L.DomEvent.stop(e);
      veSearchLocation(nodeId);
    });
    return div;
  };
  searchControl.addTo(map);

  // Tıklama ile nokta ekleme
  map.on('click', function(e) {
    veAddRoutePoint(nodeId, e.latlng);
  });

  // Harita boyutunu düzelt
  setTimeout(function() { map.invalidateSize(); }, 300);

  // ── Kayıtlı rota verisini geri yükle ──
  var node = nodes.find(function(n) { return n.id === nodeId; });
  if(node && node.data && node.data.routeCoords && node.data.routeCoords.length >= 2) {
    setTimeout(function() {
      _veRestoreRoute(nodeId, node, map);
    }, 500);
  }
}

// Kayıtlı rota verilerini haritaya ve profillere geri yükle
function _veRestoreRoute(nodeId, node, map) {
  var rc = node.data.routeCoords;
  if(!rc || rc.length < 2) return;

  // OSRM rota çizgisini geri çiz
  var latlngs = rc.map(function(c) { return [c[0], c[1]]; });
  if(veRoadOSRMlines[nodeId]) { try { map.removeLayer(veRoadOSRMlines[nodeId]); } catch(e){} }
  veRoadOSRMlines[nodeId] = L.polyline(latlngs, { color: '#1a3a6b', weight: 4 }).addTo(map);
  _veAttachRouteClickForWaypoint(nodeId);
  map.fitBounds(veRoadOSRMlines[nodeId].getBounds(), { padding: [20, 20] });

  // Başlangıç ve bitiş marker'larını koy
  var startLL = L.latLng(rc[0][0], rc[0][1]);
  var endLL = L.latLng(rc[rc.length - 1][0], rc[rc.length - 1][1]);

  function _addRestoreMarker(latlng, idx, total) {
    var isStart = idx === 0;
    var isEnd = idx === total - 1;
    var label = isStart ? '1' : String(total);
    var marker = L.marker(latlng, {
      icon: L.divIcon({
        className: 'custom-marker',
        html: '<div style="background:#2196f3; color:white; width:20px; height:20px; border-radius:50%; text-align:center; line-height:20px; font-size:10px; font-weight:600; border:2px solid white; box-shadow:0 1px 3px rgba(0,0,0,0.3);">' + label + '</div>',
        iconSize: [20, 20], iconAnchor: [10, 10]
      })
    }).addTo(map);
    veRoadMarkers[nodeId].push(marker);
  }
  _addRestoreMarker(startLL, 0, 2);
  _addRestoreMarker(endLL, 1, 2);

  // Sonuç kutusunu göster
  var resultDiv = document.getElementById('ve-road-route-result-' + nodeId);
  var distDiv = document.getElementById('ve-road-dist-' + nodeId);
  var dhDiv = document.getElementById('ve-road-dh-' + nodeId);
  var gradeDiv = document.getElementById('ve-road-avggrade-' + nodeId);
  if(resultDiv) resultDiv.style.display = 'block';
  if(node.data.routeTotalDist && distDiv) distDiv.textContent = (node.data.routeTotalDist / 1000).toFixed(2) + ' km';
  if(node.data.routeAvgGrade !== undefined && gradeDiv) gradeDiv.textContent = '%' + node.data.routeAvgGrade.toFixed(1);
  if(node.data.routeElevations && node.data.routeElevations.length >= 2 && dhDiv) {
    var dh = node.data.routeElevations[0].elevation - node.data.routeElevations[node.data.routeElevations.length - 1].elevation;
    dhDiv.textContent = dh.toFixed(0) + ' m';
  }

  // Segment markerları geri koy
  if(node.data.routeElevations && node.data.routeSegments) {
    var coords = node.data.routeElevations;
    var segs = node.data.routeSegments;
    if(!veRoadSegMarkers[nodeId]) veRoadSegMarkers[nodeId] = [];
    var cumDist = 0;
    for(var pi = 0; pi < coords.length; pi++) {
      var pt = coords[pi];
      var isEndpoint = (pi === 0 || pi === coords.length - 1);
      if(pi > 0) cumDist += veHesaplaMesafe(coords[pi-1].lat, coords[pi-1].lng, pt.lat, pt.lng);
      var cm = L.circleMarker([pt.lat, pt.lng], {
        radius: isEndpoint ? 6 : 3.5,
        color: isEndpoint ? '#fff' : '#ffa726',
        fillColor: isEndpoint ? '#4fc3f7' : '#ffa726',
        fillOpacity: isEndpoint ? 1 : 0.8,
        weight: isEndpoint ? 2 : 1.2
      }).addTo(map);
      var ttHtml = '<b>' + (isEndpoint ? (pi === 0 ? 'BAŞLANGIÇ' : 'BİTİŞ') : 'Nokta ' + (pi + 1)) + '</b>';
      ttHtml += '<br>Mesafe: ' + (cumDist / 1000).toFixed(2) + ' km';
      if(pt.elevation !== undefined) ttHtml += '<br>Yükseklik: ' + pt.elevation.toFixed(0) + ' m';
      if(pi < segs.length && segs[pi] && segs[pi].egim !== undefined) ttHtml += '<br>Segment eğim: %' + segs[pi].egim.toFixed(1);
      cm.bindTooltip(ttHtml, { direction: 'top', offset: [0, -6] });
      veRoadSegMarkers[nodeId].push(cm);
    }
  }

  // Segment bilgi kutusunu güncelle
  if(node.data.routeSegments) {
    var segBilgi = document.getElementById('ve-road-segment-bilgi-' + nodeId);
    if(segBilgi) {
      var segs2 = node.data.routeSegments;
      var maxE = 0, minE = 0;
      segs2.forEach(function(seg) { var e = seg && seg.egim !== undefined ? seg.egim : 0; if(e > maxE) maxE = e; if(e < minE) minE = e; });
      var td = node.data.routeTotalDist || 0;
      segBilgi.innerHTML = '<div style="display:flex; gap:8px; flex-wrap:wrap; font-size:0.6rem;">' +
        '<span style="color:var(--accent-primary);"><span class="mf-ico mf-ico-ruler"></span> <b>' + (td / 1000).toFixed(2) + ' km</b></span>' +
        '<span style="color:var(--accent-success);"><span class="mf-ico mf-ico-bar-chart"></span> <b>' + segs2.length + '</b> seg.</span>' +
        '<span style="color:var(--accent-warning);"><span class="mf-ico mf-ico-ruler"></span> Ort: <b>%' + (node.data.routeAvgGrade || 0).toFixed(1) + '</b></span>' +
        '<span style="color:var(--accent-danger);">⬆️ Max: <b>%' + maxE.toFixed(1) + '</b></span>' +
        '</div>';
    }
  }

  // Waypoint'leri geri yükle ve haritada göster
  _veWaypointRestore(nodeId);
  setTimeout(function() { _veWaypointShowOnMap(nodeId); }, 600);

  // Profili geri oluştur (gpsSamples varsa her zaman profili göster)
  if(node.data.gpsSamples && node.data.gpsSamples.length >= 2) {
    setTimeout(function() {
      veCalcDistGradeProfile(nodeId);
    }, 200);
  }
}

function veSearchLocation(nodeId) {
  var map = veRoadMaps[nodeId];
  if(!map) return;
  
  // Inline arama kutusu oluştur (toast tarzı)
  var existing = document.getElementById('ve-map-search-' + nodeId);
  if(existing) { existing.querySelector('input').focus(); return; }
  
  var container = document.getElementById('ve-road-map-' + nodeId);
  var searchDiv = document.createElement('div');
  searchDiv.id = 've-map-search-' + nodeId;
  searchDiv.style.cssText = 'position:absolute; top:8px; left:50px; right:50px; z-index:1000; display:flex; gap:3px;';
  searchDiv.innerHTML = '<input type="text" placeholder="Konum veya adres ara..." style="flex:1; padding:6px 8px; font-size:0.72rem; border:2px solid #2196f3; border-radius:0; outline:none; background:white; color:#333; box-shadow:0 2px 8px rgba(0,0,0,0.2);"><button style="padding:6px 10px; background:#2196f3; color:white; border:none; border-radius:0; cursor:pointer; font-size:0.68rem; white-space:nowrap;">Ara</button>';
  container.style.position = 'relative';
  container.appendChild(searchDiv);
  
  var input = searchDiv.querySelector('input');
  var btn = searchDiv.querySelector('button');
  input.focus();
  
  function doSearch() {
    var q = input.value.trim();
    if(!q) return;
    btn.textContent = '⏳';
    fetch('https://nominatim.openstreetmap.org/search?format=json&q=' + encodeURIComponent(q) + '&limit=1')
      .then(function(r) { return r.json(); })
      .then(function(data) {
        if(data && data.length > 0) {
          var lat = parseFloat(data[0].lat), lon = parseFloat(data[0].lon);
          map.setView([lat, lon], 13, {animate: true});
          // Arama marker'ı ekle
          if(window._veSearchMarker) { try{map.removeLayer(window._veSearchMarker);}catch(e){} }
          window._veSearchMarker = L.marker([lat, lon], {
            icon: L.divIcon({
              className:'',
              html:'<div style="background:#f44336;color:white;width:24px;height:24px;border-radius:50%;text-align:center;line-height:24px;font-size:14px;border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.4);"><span class="mf-ico mf-ico-map-pin"></span></div>',
              iconSize:[24,24], iconAnchor:[12,24]
            })
          }).addTo(map).bindPopup('<b>' + data[0].display_name.split(',').slice(0,3).join(',') + '</b>').openPopup();
          searchDiv.remove();
        } else {
          showToast('Sonuç bulunamadı', 'warning');
        }
        btn.textContent = 'Ara';
      })
      .catch(function() { btn.textContent = 'Ara'; showToast('Arama hatası', 'warning'); });
  }
  
  btn.onclick = doSearch;
  input.addEventListener('keydown', function(e) {
    if(e.key === 'Enter') doSearch();
    if(e.key === 'Escape') { searchDiv.remove(); }
  });
}

function veAddRoutePoint(nodeId, latlng) {
  var map = veRoadMaps[nodeId];
  if(!map) return;
  
  if(!veRoadMarkers[nodeId]) veRoadMarkers[nodeId] = [];
  var idx = veRoadMarkers[nodeId].length + 1;
  
  var marker = L.marker(latlng, {
    icon: L.divIcon({
      className: 'custom-marker',
      html: '<div style="background:#2196f3; color:white; width:20px; height:20px; border-radius:50%; text-align:center; line-height:20px; font-size:10px; font-weight:600; border:2px solid white; box-shadow:0 1px 3px rgba(0,0,0,0.3);">' + idx + '</div>',
      iconSize: [20, 20], iconAnchor: [10, 10]
    })
  }).addTo(map);
  
  marker.on('click', function(e) {
    // Tıklanan noktayı sil (map click event'ine yayılmasını engelle)
    if(e && e.originalEvent) L.DomEvent.stopPropagation(e);
    var markers = veRoadMarkers[nodeId];
    var mIdx = markers.indexOf(marker);
    if(mIdx >= 0) {
      // Tıklanan marker'ı sil
      map.removeLayer(marker);
      markers.splice(mIdx, 1);
      // Kalan marker'ları yeniden numarala
      for(var ri = 0; ri < markers.length; ri++) {
        var newNum = ri + 1;
        markers[ri].setIcon(L.divIcon({
          className: 'custom-marker',
          html: '<div style="background:#2196f3; color:white; width:20px; height:20px; border-radius:50%; text-align:center; line-height:20px; font-size:10px; font-weight:600; border:2px solid white; box-shadow:0 1px 3px rgba(0,0,0,0.3);">' + newNum + '</div>',
          iconSize: [20, 20], iconAnchor: [10, 10]
        }));
      }
    }
    veUpdateRoutePolyline(nodeId);
  });
  
  veRoadMarkers[nodeId].push(marker);
  veUpdateRoutePolyline(nodeId);
}

function veUpdateRoutePolyline(nodeId) {
  var map = veRoadMaps[nodeId];
  if(!map) return;
  
  // Eski polyline sil
  if(veRoadPolylines[nodeId]) { map.removeLayer(veRoadPolylines[nodeId]); veRoadPolylines[nodeId] = null; }
  
  var markers = veRoadMarkers[nodeId] || [];
  if(markers.length < 2) return;
  
  var latlngs = markers.map(function(m) { return m.getLatLng(); });
  veRoadPolylines[nodeId] = L.polyline(latlngs, { color: '#2196f3', weight: 3, dashArray: '8,4' }).addTo(map);
}

function veCalcRouteAndProfiles(nodeId) {
  var markers = veRoadMarkers[nodeId] || [];
  if(markers.length < 2) { showToast('En az 2 nokta gerekli', 'warning'); return; }

  var map = veRoadMaps[nodeId];
  if(!map) return;

  // 1) OSRM rotasını hesapla
  var coords = markers.map(function(m) { var ll = m.getLatLng(); return ll.lng + ',' + ll.lat; }).join(';');
  var url = 'https://router.project-osrm.org/route/v1/driving/' + coords + '?overview=full&geometries=geojson';

  showToast('Rota hesaplanıyor...');

  fetch(url)
    .then(function(r) { return r.json(); })
    .then(function(data) {
      if(!data.routes || !data.routes[0]) { showToast('Rota bulunamadı', 'warning'); return; }

      var route = data.routes[0];
      var geom = route.geometry.coordinates;
      var latlngs = geom.map(function(c) { return [c[1], c[0]]; });

      // Eski OSRM çizgisi sil
      if(veRoadOSRMlines[nodeId]) { map.removeLayer(veRoadOSRMlines[nodeId]); }

      veRoadOSRMlines[nodeId] = L.polyline(latlngs, { color: '#1a3a6b', weight: 4 }).addTo(map);
      _veAttachRouteClickForWaypoint(nodeId);
      map.fitBounds(veRoadOSRMlines[nodeId].getBounds(), { padding: [20, 20] });

      // Kesikli çizgiyi kaldır (OSRM rotası artık görünür)
      if(veRoadPolylines[nodeId]) { map.removeLayer(veRoadPolylines[nodeId]); veRoadPolylines[nodeId] = null; }

      var distKm = (route.distance / 1000).toFixed(2);
      showToast('Rota bulundu: ' + distKm + ' km — Yükseklik verisi alınıyor...');

      // Sonuç kutusunu göster
      var resultDiv = document.getElementById('ve-road-route-result-' + nodeId);
      var distDiv = document.getElementById('ve-road-dist-' + nodeId);
      if(resultDiv) resultDiv.style.display = 'block';
      if(distDiv) distDiv.textContent = distKm + ' km';

      // Node verilerine kaydet
      var node = nodes.find(function(n) { return n.id === nodeId; });
      if(node) { if(!node.data) node.data = {}; node.data.routeDistance = route.distance; node.data.routeCoords = latlngs; }

      // 2) Ardından eğim hesapla + profilleri otomatik oluştur
      veCalcElevation(nodeId, function() {
        // 3) Profilleri otomatik oluştur
        veCalcDistGradeProfile(nodeId);
      });
    })
    .catch(function(err) { showToast('OSRM hatası: ' + err.message, 'warning'); });
}

function veCalcRouteOSRM(nodeId) {
  var markers = veRoadMarkers[nodeId] || [];
  if(markers.length < 2) { showToast('En az 2 nokta gerekli', 'warning'); return; }
  
  var map = veRoadMaps[nodeId];
  if(!map) return;
  
  // OSRM API ile rota bul
  var coords = markers.map(function(m) { var ll = m.getLatLng(); return ll.lng + ',' + ll.lat; }).join(';');
  var url = 'https://router.project-osrm.org/route/v1/driving/' + coords + '?overview=full&geometries=geojson';
  
  showToast('OSRM rota hesaplanıyor...');
  
  fetch(url)
    .then(function(r) { return r.json(); })
    .then(function(data) {
      if(!data.routes || !data.routes[0]) { showToast('Rota bulunamadı', 'warning'); return; }
      
      var route = data.routes[0];
      var geom = route.geometry.coordinates;
      var latlngs = geom.map(function(c) { return [c[1], c[0]]; });
      
      // Eski OSRM çizgisi sil
      if(veRoadOSRMlines[nodeId]) { map.removeLayer(veRoadOSRMlines[nodeId]); }
      
      veRoadOSRMlines[nodeId] = L.polyline(latlngs, { color: '#1a3a6b', weight: 4 }).addTo(map);
      _veAttachRouteClickForWaypoint(nodeId);
      map.fitBounds(veRoadOSRMlines[nodeId].getBounds(), { padding: [20, 20] });

      // Kesikli çizgiyi kaldır
      if(veRoadPolylines[nodeId]) { map.removeLayer(veRoadPolylines[nodeId]); veRoadPolylines[nodeId] = null; }

      var distKm = (route.distance / 1000).toFixed(2);
      var pointCount = latlngs.length;
      showToast('Rota bulundu: ' + distKm + ' km (' + pointCount + ' nokta)');
      
      // Sonuç kutusunu göster
      var resultDiv = document.getElementById('ve-road-route-result-' + nodeId);
      var distDiv = document.getElementById('ve-road-dist-' + nodeId);
      if(resultDiv) resultDiv.style.display = 'block';
      if(distDiv) distDiv.textContent = distKm + ' km';
      
      // Segment aralığı butonları göster
      var segBtns = document.getElementById('ve-road-seg-btns-' + nodeId);
      if(!segBtns) {
        segBtns = document.createElement('div');
        segBtns.id = 've-road-seg-btns-' + nodeId;
        segBtns.style.cssText = 'display:flex; gap:3px; margin-top:6px; flex-wrap:wrap;';
        resultDiv.appendChild(segBtns);
      }
      var intervals = [100, 200, 300, 500];
      var segEl = document.getElementById('ve-road-segment-' + nodeId);
      var curInterval = segEl ? parseInt(segEl.value) : 300;
      segBtns.innerHTML = '<span style="font-size:0.54rem; color:var(--text-muted); margin-right:2px; line-height:22px;">Segment:</span>';
      intervals.forEach(function(iv) {
        var estSegs = Math.ceil(route.distance / iv);
        var active = iv === curInterval;
        segBtns.innerHTML += '<button onclick="veSetSegmentInterval(\'' + nodeId + '\',' + iv + ')" style="padding:2px 6px; font-size:0.54rem; border-radius:0; border:1px solid ' + (active ? 'var(--accent-primary)' : 'var(--border-color)') + '; background:' + (active ? 'var(--accent-primary)' : 'var(--bg-tertiary)') + '; color:' + (active ? 'white' : 'var(--text-secondary)') + '; cursor:pointer;">' + iv + 'm (~' + estSegs + ')</button>';
      });
      
      // Node verilerine kaydet
      var node = nodes.find(function(n) { return n.id === nodeId; });
      if(node) { if(!node.data) node.data = {}; node.data.routeDistance = route.distance; node.data.routeCoords = latlngs; }
    })
    .catch(function(err) { showToast('OSRM hatası: ' + err.message, 'warning'); });
}

function veSetSegmentInterval(nodeId, interval) {
  var segEl = document.getElementById('ve-road-segment-' + nodeId);
  if(segEl) segEl.value = interval;
  // Butonları güncelle
  var segBtns = document.getElementById('ve-road-seg-btns-' + nodeId);
  if(segBtns) {
    segBtns.querySelectorAll('button').forEach(function(btn) {
      var iv = parseInt(btn.textContent);
      var active = iv === interval;
      btn.style.border = '1px solid ' + (active ? 'var(--accent-primary)' : 'var(--border-color)');
      btn.style.background = active ? 'var(--accent-primary)' : 'var(--bg-tertiary)';
      btn.style.color = active ? 'white' : 'var(--text-secondary)';
    });
  }
  showToast('Segment aralığı: ~' + interval + 'm');
}

function veClearRoute(nodeId) {
  var map = veRoadMaps[nodeId];
  if(map) {
    (veRoadMarkers[nodeId] || []).forEach(function(m) { map.removeLayer(m); });
    veRoadMarkers[nodeId] = [];
    if(veRoadPolylines[nodeId]) { map.removeLayer(veRoadPolylines[nodeId]); veRoadPolylines[nodeId] = null; }
    if(veRoadOSRMlines[nodeId]) { map.removeLayer(veRoadOSRMlines[nodeId]); veRoadOSRMlines[nodeId] = null; }
    // Segment noktalarını temizle
    if(veRoadSegMarkers[nodeId]) {
      veRoadSegMarkers[nodeId].forEach(function(m) { try { map.removeLayer(m); } catch(e){} });
      veRoadSegMarkers[nodeId] = [];
    }
  }
  var resultDiv = document.getElementById('ve-road-route-result-' + nodeId);
  if(resultDiv) resultDiv.style.display = 'none';
  var segBilgi = document.getElementById('ve-road-segment-bilgi-' + nodeId);
  if(segBilgi) segBilgi.innerHTML = '<span style="color:var(--text-muted);">Güzergah temizlendi.</span>';
  var segTable = document.getElementById('ve-road-seg-table-' + nodeId);
  if(segTable) segTable.innerHTML = '';
  var segBtns = document.getElementById('ve-road-seg-btns-' + nodeId);
  if(segBtns) segBtns.remove();
  
  // Node verisini temizle
  var node = nodes.find(function(n) { return n.id === nodeId; });
  if(node && node.data) {
    delete node.data.routeCoords; delete node.data.routeSegments; delete node.data.routeDistance;
    delete node.data.gpsSamples; delete node.data.routeElevations; delete node.data.gradeLines;
    delete node.data.routeTotalDist; delete node.data.routeAvgGrade; delete node.data.rawElevations;
    delete node.data.routeWaypoints;
  }
  // Eğim çizgilerini de temizle
  _veAltGradeLines[nodeId] = [];
  // Waypoint'leri temizle
  veClearRouteWaypoints(nodeId);
  // Profil bölümünü gizle
  var profilesSection = document.getElementById('ve-road-profiles-' + nodeId);
  if(profilesSection) profilesSection.style.display = 'none';
  showToast('Güzergah temizlendi');
}

// Haversine mesafe hesaplama
function veHesaplaMesafe(lat1, lon1, lat2, lon2) {
  var R = 6371000;
  var dLat = (lat2 - lat1) * Math.PI / 180;
  var dLon = (lon2 - lon1) * Math.PI / 180;
  var a = Math.sin(dLat/2) * Math.sin(dLat/2) + Math.cos(lat1 * Math.PI/180) * Math.cos(lat2 * Math.PI/180) * Math.sin(dLon/2) * Math.sin(dLon/2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}

// ── Kümülatif mesafe dizisi (metre): cum[i] = yol başından coords[i]'ye ──
function _veCumDistances(coords) {
  var cum = [0];
  for(var i = 1; i < coords.length; i++) {
    cum[i] = cum[i-1] + veHesaplaMesafe(coords[i-1].lat, coords[i-1].lng, coords[i].lat, coords[i].lng);
  }
  return cum;
}

// ── Elevation API'leri için seyrek örnekleme indeksleri ──
// GPS örnekleri ~1.67m aralıklı (binlerce nokta) ama DEM çözünürlüğü 30-90m;
// her noktayı sormak hem gereksiz hem de Open-Meteo'nun istek başına 100-nokta
// limitini ve sunucuları zorlar. Bunun yerine en fazla `maxPts`, en az
// `minSpacing` metre aralıklı bir alt küme seç (ilk + son nokta daima dahil).
function _veBuildFetchIndices(cum, maxPts, minSpacing) {
  var n = cum.length;
  if(n <= 2) { var all = []; for(var k = 0; k < n; k++) all.push(k); return all; }
  var total = cum[n-1] || 0;
  var spacing = Math.max(minSpacing, total / Math.max(1, maxPts - 1));
  var idxs = [0];
  var lastD = 0;
  for(var i = 1; i < n - 1; i++) {
    if(cum[i] - lastD >= spacing) { idxs.push(i); lastD = cum[i]; }
  }
  idxs.push(n - 1);
  return idxs;
}

// ── Seyrek elevation'ı tüm yoğun noktalara mesafeye göre lineer interpolasyonla yay ──
// idxs: coords içindeki örneklenen indeksler; coarseElev[k] ↔ coords[idxs[k]].
// Dönen dizi cum ile aynı uzunlukta (her yoğun nokta için bir yükseklik).
function _veInterpElevByDist(cum, idxs, coarseElev) {
  var out = new Array(cum.length);
  var seg = 0;
  for(var p = 0; p < cum.length; p++) {
    while(seg < idxs.length - 2 && idxs[seg+1] <= p) seg++;
    var iL = idxs[seg], iR = idxs[seg+1] !== undefined ? idxs[seg+1] : iL;
    var eL = coarseElev[seg];
    var eR = coarseElev[seg+1] !== undefined ? coarseElev[seg+1] : eL;
    if(eL === undefined) { out[p] = eR; continue; }
    if(p <= iL || iR <= iL) { out[p] = eL; }
    else if(p >= iR) { out[p] = eR; }
    else {
      var dL = cum[iL], dR = cum[iR];
      var t = dR > dL ? (cum[p] - dL) / (dR - dL) : 0;
      out[p] = eL + (eR - eL) * t;
    }
  }
  return out;
}

// ── 3 katmanlı yükseklik API: Open-Meteo → Open-Elevation → Open Topo Data ──
// Yoğun GPS noktalarını doğrudan sormak yerine DEM çözünürlüğüne uygun seyrek
// bir alt küme sorar, sonra interpolasyonla yoğunlaştırır. Bu sayede istek
// başına 100-nokta limiti aşılmaz ve sunucular gereksiz yükle patlamaz.
function veFetchElevations(coords) {
  var cum = _veCumDistances(coords);
  var MAX_FETCH_PTS = 500;   // Open-Meteo için ≤5 paralel 100-nokta isteği
  var MIN_SPACING_M = 25;    // DEM ~30-90m; bunun altında yeni bilgi yok
  var idxs = _veBuildFetchIndices(cum, MAX_FETCH_PTS, MIN_SPACING_M);
  var fetchCoords = idxs.map(function(k) { return { lat: coords[k].lat, lng: coords[k].lng }; });
  var lats = fetchCoords.map(function(c) { return c.lat; });
  var lngs = fetchCoords.map(function(c) { return c.lng; });

  // 1) Open-Meteo: GET, istek başına EN FAZLA 100 nokta (API limiti), Copernicus DEM 90m
  function tryOpenMeteo() {
    var chunkSize = 100;
    var chunks = [];
    for(var i = 0; i < lats.length; i += chunkSize) {
      chunks.push({ lats: lats.slice(i, i + chunkSize), lngs: lngs.slice(i, i + chunkSize) });
    }
    // Parça sayısı az (≤5) → paralel iste; Promise.all sırayı korur
    return Promise.all(chunks.map(function(chunk) {
      var url = 'https://api.open-meteo.com/v1/elevation?latitude=' + chunk.lats.join(',') + '&longitude=' + chunk.lngs.join(',');
      return fetch(url).then(function(r) {
        if(!r.ok) throw new Error('Open-Meteo HTTP ' + r.status);
        return r.json();
      }).then(function(data) {
        if(!data.elevation || data.elevation.length !== chunk.lats.length) throw new Error('Open-Meteo eksik veri');
        return data.elevation;
      });
    })).then(function(parts) {
      return parts.reduce(function(acc, p) { return acc.concat(p); }, []);
    });
  }

  // 2) Open-Elevation: POST, SRTM 30m — CORS destekli yedek
  function tryOpenElevation() {
    var locations = fetchCoords.map(function(c) { return {latitude: c.lat, longitude: c.lng}; });
    return fetch('https://api.open-elevation.com/api/v1/lookup', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({locations: locations})
    }).then(function(r) {
      if(!r.ok) throw new Error('Open-Elevation HTTP ' + r.status);
      return r.json();
    }).then(function(data) {
      if(!data.results || data.results.length < fetchCoords.length) throw new Error('Open-Elevation eksik veri');
      return data.results.map(function(r) { return r.elevation; });
    });
  }

  // 3) Open Topo Data: GET, SRTM 30m — son çare.
  //    NOT: CORS başlığı göndermediğinden tarayıcıda genelde çalışmaz;
  //    yalnızca CORS uygulanmayan ortamlar (Electron/proxy) için tutuluyor.
  function tryOpenTopoData() {
    var chunkSize = 100;
    var chunks = [];
    for(var i = 0; i < lats.length; i += chunkSize) {
      chunks.push(lats.slice(i, i + chunkSize).map(function(lat, j) { return lat + ',' + lngs[i + j]; }));
    }
    // Sıralı istekler (1/sn rate limit)
    return chunks.reduce(function(promise, chunk, idx) {
      return promise.then(function(acc) {
        var delay = idx > 0 ? new Promise(function(res) { setTimeout(res, 1100); }) : Promise.resolve();
        return delay.then(function() {
          var url = 'https://api.opentopodata.org/v1/srtm30m?locations=' + chunk.join('|') + '&interpolation=cubic';
          return fetch(url).then(function(r) {
            if(!r.ok) throw new Error('OpenTopoData HTTP ' + r.status);
            return r.json();
          }).then(function(data) {
            if(!data.results || data.results.length !== chunk.length) throw new Error('OpenTopoData eksik veri');
            return acc.concat(data.results.map(function(r) { return r.elevation; }));
          });
        });
      });
    }, Promise.resolve([]));
  }

  // Fallback zinciri: Open-Meteo → Open-Elevation → Open Topo Data
  // Sonra seyrek elevation'ı tüm yoğun noktalara interpolasyonla yay.
  return tryOpenMeteo()
    .catch(function(e) {
      console.warn('Open-Meteo başarısız, Open-Elevation deneniyor...', e.message);
      showToast('⚠️ Open-Meteo yanıt vermedi, alternatif deneniyor...', 'warning');
      return tryOpenElevation();
    })
    .catch(function(e) {
      console.warn('Open-Elevation başarısız, Open Topo Data deneniyor...', e.message);
      showToast('⚠️ Alternatif API yanıt vermedi, son seçenek deneniyor...', 'warning');
      return tryOpenTopoData();
    })
    .then(function(coarseElev) {
      return _veInterpElevByDist(cum, idxs, coarseElev);
    });
}

function veCalcElevation(nodeId, onComplete) {
  // OSRM rota noktaları veya haritadaki marker'ları kullan
  var node = nodes.find(function(n) { return n.id === nodeId; });
  if(!node) return;

  var coords = [];
  if(node.data && node.data.routeCoords && node.data.routeCoords.length >= 2) {
    var rc = node.data.routeCoords;

    // GPS sensör simülasyonu: 10 Hz @ 60 km/h ≈ 1.67m aralıklarla örnekle
    var sampleInterval = 1.67;

    // Rota boyunca kümülatif mesafe hesapla
    coords.push({lat: rc[0][0], lng: rc[0][1]});
    var cumDist = 0;
    var lastSampled = 0;
    for(var i = 1; i < rc.length; i++) {
      var d = veHesaplaMesafe(rc[i-1][0], rc[i-1][1], rc[i][0], rc[i][1]);
      cumDist += d;
      if(cumDist - lastSampled >= sampleInterval || i === rc.length - 1) {
        coords.push({lat: rc[i][0], lng: rc[i][1]});
        lastSampled = cumDist;
      }
    }
  } else {
    // Marker'lardan noktalar
    var markers = veRoadMarkers[nodeId] || [];
    if(markers.length < 2) { showToast('En az 2 nokta veya OSRM rotası gerekli', 'warning'); return; }
    markers.forEach(function(m) { var ll = m.getLatLng(); coords.push({lat: ll.lat, lng: ll.lng}); });
  }

  if(coords.length < 2) { showToast('Yetersiz nokta', 'warning'); return; }

  showToast('⏳ Yükseklik verisi alınıyor... (' + coords.length + ' nokta)');

  // 3 katmanlı elevation API (Open-Meteo → Open Topo Data → Open-Elevation)
  veFetchElevations(coords)
  .then(function(elevations) {
    // Yükseklikleri eşleştir
    for(var i = 0; i < coords.length; i++) {
      coords[i].elevation = elevations[i];
    }

    // ── Yükseklik yumuşatma (SRTM gürültüsünü azalt) ──
    // Savitzky-Golay filtresi: polynomial fit ile gerçek eğim korunur, sadece gürültü temizlenir
    var smoothEl = document.getElementById('ve-road-smooth-' + nodeId);
    var smoothLevel = smoothEl ? parseInt(smoothEl.value) : 2;
    if(!node.data) node.data = {};
    node.data.smoothLevel = smoothLevel;

    // Ham veriyi kaydet
    var rawElevations = coords.map(function(c) { return c.elevation; });
    node.data.rawElevations = rawElevations.slice();

    if(smoothLevel > 0 && coords.length >= 4) {
      var n = rawElevations.length;

      // ── Adım 1: Elevation outlier temizliği (IQR tabanlı) ──
      // SRTM verisinde ara sıra ±30m spike'lar olabiliyor
      var current = rawElevations.slice();
      if(n >= 5) {
        var windowIQR = Math.min(7, Math.floor(n / 3));
        for(var oi = 1; oi < n - 1; oi++) {
          // Komşu penceredeki değerleri topla
          var neighbors = [];
          for(var nj = Math.max(0, oi - windowIQR); nj <= Math.min(n - 1, oi + windowIQR); nj++) {
            if(nj !== oi) neighbors.push(current[nj]);
          }
          neighbors.sort(function(a, b) { return a - b; });
          var q1 = neighbors[Math.floor(neighbors.length * 0.25)];
          var q3 = neighbors[Math.floor(neighbors.length * 0.75)];
          var iqr = q3 - q1;
          var fence = Math.max(iqr * 2.5, 15); // Minimum ±15m tolerans
          var median = neighbors[Math.floor(neighbors.length / 2)];
          if(Math.abs(current[oi] - median) > fence) {
            // Spike — komşu medyan ile değiştir
            current[oi] = median;
          }
        }
      }

      // ── Adım 2: Savitzky-Golay filtresi ──
      // 2. derece (kuadratik) polynomial fit — eğimi korur, gürültüyü temizler
      // SavGol pencere boyutu: seviyeye göre adaptif
      var halfWinBase;
      if(smoothLevel === 1) halfWinBase = Math.max(2, Math.min(Math.floor(n / 12), 4));
      else if(smoothLevel === 2) halfWinBase = Math.max(3, Math.min(Math.floor(n / 6), 10));
      else halfWinBase = Math.max(5, Math.min(Math.floor(n / 4), 18));
      var halfWin = Math.min(halfWinBase, Math.floor((n - 1) / 2));
      var winSize = 2 * halfWin + 1;

      // SavGol katsayılarını hesapla (2. derece polynomial)
      // Vandermonde matrisi: J[i][k] = i^k, i = -halfWin..halfWin, k = 0..polyOrder
      var polyOrder = 2;
      function _veSavGolCoeffs(hw, order) {
        var m = 2 * hw + 1;
        // J matrisi (m x (order+1))
        var J = [];
        for(var ri = 0; ri < m; ri++) {
          J[ri] = [];
          var x = ri - hw;
          for(var ci = 0; ci <= order; ci++) {
            J[ri][ci] = Math.pow(x, ci);
          }
        }
        // (J^T J) hesapla: (order+1) x (order+1)
        var ncols = order + 1;
        var JtJ = [];
        for(var r = 0; r < ncols; r++) {
          JtJ[r] = [];
          for(var c = 0; c < ncols; c++) {
            var s = 0;
            for(var k = 0; k < m; k++) s += J[k][r] * J[k][c];
            JtJ[r][c] = s;
          }
        }
        // (J^T J)^-1: Gauss-Jordan ile
        var aug = [];
        for(var r = 0; r < ncols; r++) {
          aug[r] = JtJ[r].slice();
          for(var c = 0; c < ncols; c++) aug[r].push(r === c ? 1 : 0);
        }
        for(var col = 0; col < ncols; col++) {
          // Pivot
          var maxVal = Math.abs(aug[col][col]), maxRow = col;
          for(var r = col + 1; r < ncols; r++) {
            if(Math.abs(aug[r][col]) > maxVal) { maxVal = Math.abs(aug[r][col]); maxRow = r; }
          }
          var tmp = aug[col]; aug[col] = aug[maxRow]; aug[maxRow] = tmp;
          var piv = aug[col][col];
          if(Math.abs(piv) < 1e-12) continue;
          for(var c = 0; c < 2 * ncols; c++) aug[col][c] /= piv;
          for(var r = 0; r < ncols; r++) {
            if(r === col) continue;
            var f = aug[r][col];
            for(var c = 0; c < 2 * ncols; c++) aug[r][c] -= f * aug[col][c];
          }
        }
        var inv = [];
        for(var r = 0; r < ncols; r++) {
          inv[r] = [];
          for(var c = 0; c < ncols; c++) inv[r][c] = aug[r][ncols + c];
        }
        // SavGol katsayıları: ((J^T J)^-1 J^T) ilk satırı (smoothing row)
        var coeffs = [];
        for(var i = 0; i < m; i++) {
          var c0 = 0;
          for(var k = 0; k < ncols; k++) c0 += inv[0][k] * J[i][k];
          coeffs.push(c0);
        }
        return coeffs;
      }

      var sgCoeffs = _veSavGolCoeffs(halfWin, polyOrder);

      // Çoklu geçiş: güçlü modda 2 geçiş, diğerlerinde 1
      var passes = smoothLevel >= 3 ? 2 : 1;
      for(var pass = 0; pass < passes; pass++) {
        var smoothed = current.slice();
        for(var si = halfWin; si < n - halfWin; si++) {
          var val = 0;
          for(var ci = 0; ci < sgCoeffs.length; ci++) {
            val += sgCoeffs[ci] * current[si - halfWin + ci];
          }
          smoothed[si] = val;
        }
        // Kenar noktaları: küçük pencereli SavGol (daralarak)
        for(var ei = 1; ei < halfWin && ei < n - 1; ei++) {
          var edgeHW = ei;
          var edgeCoeffs = _veSavGolCoeffs(edgeHW, Math.min(polyOrder, 2 * edgeHW));
          // Sol kenar
          var vL = 0;
          for(var ec = 0; ec < edgeCoeffs.length; ec++) vL += edgeCoeffs[ec] * current[ei - edgeHW + ec];
          smoothed[ei] = vL;
          // Sağ kenar
          var ri2 = n - 1 - ei;
          var vR = 0;
          for(var ec2 = 0; ec2 < edgeCoeffs.length; ec2++) vR += edgeCoeffs[ec2] * current[ri2 - edgeHW + ec2];
          smoothed[ri2] = vR;
        }
        // Uç noktaları koru
        smoothed[0] = current[0];
        smoothed[n - 1] = current[n - 1];
        current = smoothed;
      }
      // Uygula
      for(var ui = 0; ui < n; ui++) {
        coords[ui].elevation = current[ui];
      }
    }

    // ── GPS Sensör Verisi: Smooth edilmiş ince örnekleri kaydet (downsample öncesi) ──
    // Bu veri, Rakım Profili grafiği için kullanılacak (GPS sensör simülasyonu)
    var gpsSamples = [];
    var gpsCumDist = 0;
    gpsSamples.push({ dist: 0, elev: coords[0].elevation, lat: coords[0].lat, lng: coords[0].lng });
    for(var gi = 1; gi < coords.length; gi++) {
      gpsCumDist += veHesaplaMesafe(coords[gi-1].lat, coords[gi-1].lng, coords[gi].lat, coords[gi].lng);
      gpsSamples.push({ dist: gpsCumDist, elev: coords[gi].elevation, lat: coords[gi].lat, lng: coords[gi].lng });
    }
    node.data.gpsSamples = gpsSamples;

    // Toplam mesafe ve ortalama yükseklik
    var toplamMesafe = gpsSamples.length > 1 ? gpsSamples[gpsSamples.length - 1].dist : 0;
    var topYuk = 0;
    gpsSamples.forEach(function(s) { topYuk += s.elev; });
    var ortYukseklik = gpsSamples.length > 0 ? topYuk / gpsSamples.length : 0;
    var elevFirst = gpsSamples[0].elev;
    var elevLast = gpsSamples[gpsSamples.length - 1].elev;
    var yukseklikFark = elevFirst - elevLast;

    // Node verisine kaydet
    node.data.routeAvgAltitude = ortYukseklik;
    node.data.routeTotalDist = toplamMesafe;

    // routeElevations: harita markerları için ~300m aralıklarla downsample
    // (ince veri gpsSamples'da zaten mevcut, haritada binlerce nokta göstermeye gerek yok)
    var dsInterval = 300;
    var dsElev = [{ lat: coords[0].lat, lng: coords[0].lng, elevation: coords[0].elevation }];
    var dsCumDist = 0, dsLastSampled = 0;
    for(var di = 1; di < coords.length; di++) {
      dsCumDist += veHesaplaMesafe(coords[di-1].lat, coords[di-1].lng, coords[di].lat, coords[di].lng);
      if(dsCumDist - dsLastSampled >= dsInterval || di === coords.length - 1) {
        dsElev.push({ lat: coords[di].lat, lng: coords[di].lng, elevation: coords[di].elevation });
        dsLastSampled = dsCumDist;
      }
    }
    node.data.routeElevations = dsElev;

    // Sonuçları göster
    var resultDiv = document.getElementById('ve-road-route-result-' + nodeId);
    var distDiv = document.getElementById('ve-road-dist-' + nodeId);
    var dhDiv = document.getElementById('ve-road-dh-' + nodeId);
    if(resultDiv) resultDiv.style.display = 'block';
    if(distDiv) distDiv.textContent = (toplamMesafe / 1000).toFixed(2) + ' km';
    if(dhDiv) dhDiv.textContent = yukseklikFark.toFixed(0) + ' m';

    // ═══ ORTAM PARAMETRELERİNİ OTOMATİK DOLDUR ═══
    // Yükseklik
    var altEl = document.getElementById('ve-road-alt-' + nodeId);
    if(altEl) { altEl.value = Math.round(ortYukseklik); node.data.altitude = ortYukseklik; }
    // Sıcaklık (boşsa ISA standart 15°C)
    var tempEl = document.getElementById('ve-road-temp-' + nodeId);
    if(tempEl && !tempEl.value) { tempEl.value = '15'; node.data.temperature = 15; }
    // Hava yoğunluğunu otomatik hesapla (ISA modeli)
    veCalcAirDensityRoad(nodeId);

    // Otomatik başlangıç/bitiş waypoint'leri ekle (yoksa)
    if(!_veRouteWaypoints[nodeId] || _veRouteWaypoints[nodeId].length === 0) {
      _veRouteWaypoints[nodeId] = [];
      _veAddAutoWaypoint(nodeId, 0, 'Başlangıç');
      _veAddAutoWaypoint(nodeId, toplamMesafe, 'Bitiş');
      _veWaypointPersist(nodeId);
    }
    // Haritada waypoint'leri göster
    _veWaypointShowOnMap(nodeId);

    showToast('✅ Rakım verisi okundu: ' + gpsSamples.length + ' sample, ' + (toplamMesafe / 1000).toFixed(2) + ' km');

    // Callback (profil oluşturma vb.)
    if(typeof onComplete === 'function') onComplete();
  })
  .catch(function(err) {
    showToast('Yükseklik API hatası: ' + err.message, 'warning');
  });
}

function onVERoadEgimModeChange(nodeId) {
  var sel = document.getElementById('ve-road-egimmode-' + nodeId);
  if(!sel) return;
  var mode = sel.value;

  // Segment bazlı içerik (harita + profiller) göster/gizle
  var segContent = document.getElementById('ve-road-segment-content-' + nodeId);
  if(segContent) segContent.style.display = (mode === 'segment') ? '' : 'none';

  // Manuel içerik göster/gizle
  var manuelContent = document.getElementById('ve-road-manuel-content-' + nodeId);
  if(manuelContent) manuelContent.style.display = (mode === 'manuel') ? '' : 'none';

  onVERoadParamChange(nodeId);

  // Manuel modda profili çiz (varsa)
  if(mode === 'manuel') {
    var node = nodes.find(function(n) { return n.id === nodeId; });
    if(node && node.data && node.data.manualSegments && node.data.manualSegments.length > 0) {
      _veManualSegRefresh(nodeId);
    }
  }

  // Solver properties panelini yenile (checkbox'lar değişir)
  var solverNode = nodes.find(function(n) { return n.type === 'solver'; });
  if(solverNode && typeof showNodeProperties === 'function') {
    // Eğer solver paneli açıksa yenile
    var currentPanel = document.querySelector('.ve-props-active');
    if(currentPanel && currentPanel.getAttribute('data-node-id') === solverNode.id) {
      showNodeProperties(solverNode);
    }
  }
}

function veCalcAirDensityRoad(nodeId) {
  var altEl = document.getElementById('ve-road-alt-' + nodeId);
  var tempEl = document.getElementById('ve-road-temp-' + nodeId);
  var densEl = document.getElementById('ve-road-density-' + nodeId);
  if(!altEl || !tempEl || !densEl) return;
  var h = parseFloat(altEl.value), T = parseFloat(tempEl.value);
  if(isNaN(h) || isNaN(T)) { showToast('Yükseklik ve sıcaklık giriniz', 'warning'); return; }
  var P0=101325,T0=288.15,L=0.0065,R=287.05,g=9.80665;
  var Tk=T+273.15, P=P0*Math.pow(1-L*h/T0,g/(R*L)), rho=P/(R*Tk);
  densEl.value = rho.toFixed(4);
  var node = nodes.find(function(n){return n.id===nodeId;});
  if(node){if(!node.data)node.data={};node.data.airDensity=rho;}
  showToast('Hava yoğunluğu: '+rho.toFixed(4)+' kg/m³');
}

// ═══════════════════════════════════════════════════════════════
// PROFİL HESAPLA — Dropdown & Mesafe-Eğim Profili
// ═══════════════════════════════════════════════════════════════

// ═══ Profil ayarlarını güncelle (Güncelle butonu) ═══
// Mevcut rota verisi üzerinde yeni segment/smooth ayarlarıyla yeniden hesaplar
function veUpdateProfiles(nodeId) {
  var node = nodes.find(function(n) { return n.id === nodeId; });
  if(!node || !node.data || !node.data.routeCoords || node.data.routeCoords.length < 2) {
    showToast('Önce haritadan rota hesaplayın', 'warning');
    return;
  }
  showToast('Profil güncelleniyor...');
  veCalcElevation(nodeId, function() {
    veCalcDistGradeProfile(nodeId);
    showToast('Profil güncellendi');
  });
}

// Büyük ekrandan filtre güncellemesi — elevation yeniden alır, expanded canvas'ı yeniler
function veUpdateProfilesExpanded(nodeId) {
  var node = nodes.find(function(n) { return n.id === nodeId; });
  if(!node || !node.data || !node.data.routeCoords || node.data.routeCoords.length < 2) {
    showToast('Rota verisi bulunamadı', 'warning'); return;
  }
  showToast('Profil güncelleniyor...');
  veCalcElevation(nodeId, function() {
    veCalcDistGradeProfile(nodeId);
    // Expanded canvas'ı yenile
    var expCanvas = document.getElementById('ve-road-altitude-expanded-' + nodeId);
    if(expCanvas && node.data.gpsSamples) {
      veRenderAltitudeProfile('ve-road-altitude-expanded-' + nodeId, node.data.gpsSamples, nodeId);
      _veAltUpdateLineList(nodeId);
    }
    showToast('Profil güncellendi');
  });
}

function veToggleProfileDropdown(nodeId) {
  var dd = document.getElementById('ve-profile-dropdown-' + nodeId);
  if(!dd) return;
  var isOpen = dd.style.display !== 'none';
  dd.style.display = isOpen ? 'none' : 'block';
  if(!isOpen) {
    // Dışarı tıklayınca kapat
    var closeHandler = function(e) {
      var wrap = document.getElementById('ve-profile-dropdown-wrap-' + nodeId);
      if(wrap && !wrap.contains(e.target)) {
        dd.style.display = 'none';
        document.removeEventListener('mousedown', closeHandler);
      }
    };
    setTimeout(function() { document.addEventListener('mousedown', closeHandler); }, 10);
  }
}

function veToggleDistGradeProfile(nodeId) {
  var cb = document.getElementById('ve-profile-opt-distgrade-' + nodeId);
  if(!cb) return;

  if(cb.checked) {
    veCalcDistGradeProfile(nodeId);
  } else {
    // Profili kaldır
    var profileDiv = document.getElementById('ve-road-profile-distgrade-' + nodeId);
    if(profileDiv) profileDiv.remove();
    var profilesContent = document.getElementById('ve-road-profiles-content-' + nodeId);
    var profilesSection = document.getElementById('ve-road-profiles-' + nodeId);
    if(profilesContent && profilesContent.children.length === 0 && profilesSection) {
      profilesSection.style.display = 'none';
    }
  }
}

function veCalcDistGradeProfile(nodeId) {
  var node = nodes.find(function(n) { return n.id === nodeId; });
  if(!node || !node.data || !node.data.gpsSamples || node.data.gpsSamples.length < 2) {
    showToast('Önce rota hesaplayın (en az 2 nokta gerekli)', 'warning');
    return;
  }

  var gpsSamples = node.data.gpsSamples;
  var totalDist = gpsSamples[gpsSamples.length - 1].dist;
  var elevFirst = gpsSamples[0].elev;
  var elevLast = gpsSamples[gpsSamples.length - 1].elev;

  // Profil HTML şablonu (sadece Rakım Profili GPS)
  function _buildProfileHTML(canvasId) {
    var altCanvasId = canvasId.replace('distgrade', 'altitude');
    if(!gpsSamples) return '<div style="color:var(--text-muted); font-size:0.6rem; padding:8px;">GPS verisi bulunamadı.</div>';
    return '<div style="position:relative; margin-bottom:8px;">' +
      '<canvas id="' + altCanvasId + '" style="width:100%; cursor:crosshair; border-radius:0;"></canvas>' +
      '<div id="' + altCanvasId + '-tooltip" class="dr-chart-tooltip"></div>' +
      '<button onclick="veExpandProfileChart(\'' + nodeId + '\', \'altitude\')" title="Grafiği büyüt" style="position:absolute; top:4px; right:4px; width:22px; height:22px; display:flex; align-items:center; justify-content:center; background:rgba(30,36,48,0.7); border:1px solid rgba(255,255,255,0.15); border-radius:0; cursor:pointer; font-size:0.7rem; color:var(--text-secondary); transition:all 0.12s; z-index:2;" onmouseover="this.style.background=\'var(--accent-primary)\';this.style.color=\'#fff\'" onmouseout="this.style.background=\'rgba(30,36,48,0.7)\';this.style.color=\'var(--text-secondary)\'">⛶</button>' +
      '</div>' +
      '<div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap; margin-bottom:8px; padding:5px 8px; background:var(--bg-secondary); border-radius:0; border:1px solid var(--border-color); font-size:0.58rem;">' +
      '<span style="color:var(--text-muted);">Başlangıç:</span><span style="color:#b39ddb; font-weight:600;">' + elevFirst.toFixed(0) + 'm</span>' +
      '<span style="color:var(--text-muted); opacity:0.4;">→</span>' +
      '<span style="color:var(--text-muted);">Bitiş:</span><span style="color:#b39ddb; font-weight:600;">' + elevLast.toFixed(0) + 'm</span>' +
      '<span style="color:var(--text-muted); opacity:0.4;">│</span>' +
      '<span style="color:var(--text-muted);">Δh:</span><span style="color:var(--accent-warning); font-weight:700;">' + (elevFirst - elevLast).toFixed(1) + 'm</span>' +
      '<span style="color:var(--text-muted); opacity:0.4;">│</span>' +
      '<span style="font-size:0.54rem; color:var(--text-muted);">' + (gpsSamples ? gpsSamples.length + ' sample' : '') + ' | ' + totalDist.toFixed(0) + ' m</span>' +
      '</div>';
  }

  // Properties paneldeki profil bölümüne yaz
  var profilesSection = document.getElementById('ve-road-profiles-' + nodeId);
  var profilesContent = document.getElementById('ve-road-profiles-content-' + nodeId);
  if(profilesSection && profilesContent) {
    profilesSection.style.display = 'block';
    var profileDiv = document.getElementById('ve-road-profile-distgrade-' + nodeId);
    if(!profileDiv) {
      profileDiv = document.createElement('div');
      profileDiv.id = 've-road-profile-distgrade-' + nodeId;
      profilesContent.appendChild(profileDiv);
    }
    var panelCanvasId = 've-road-distgrade-canvas-' + nodeId;
    profileDiv.innerHTML = _buildProfileHTML(panelCanvasId) +
      '<button onclick="veTransferSegmentsToScenario(\'' + nodeId + '\')" style="width:100%; margin-top:6px; padding:7px 10px; font-size:0.66rem; font-weight:600; background:var(--accent-primary, #3b82f6); color:#fff; border:none; border-radius:0; cursor:pointer; display:flex; align-items:center; justify-content:center; gap:6px; transition:all 0.15s; opacity:0.9;" onmouseover="this.style.opacity=\'1\';this.style.boxShadow=\'0 2px 8px rgba(59,130,246,0.35)\'" onmouseleave="this.style.opacity=\'0.9\';this.style.boxShadow=\'none\'"><span class="mf-ico mf-ico-upload"></span> Eğim Segmentlerini Senaryolara Aktar</button>';
    setTimeout(function() {
      var altCanvasId = panelCanvasId.replace('distgrade', 'altitude');
      veRenderAltitudeProfile(altCanvasId, gpsSamples, nodeId);
      // Profil bölümüne scroll
      profilesSection.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 100);
  }

  showToast('Rakım profili oluşturuldu');
}

function veRenderDistGradeProfile(canvasId, segments, nodeId) {
  var canvas = document.getElementById(canvasId);
  if(!canvas || !segments || segments.length < 1) return;

  var parentW = canvas.parentElement.clientWidth || 400;
  var chartH = canvas._dgExpandedH || 180;
  var dpr = window.devicePixelRatio || 1;
  canvas.width = parentW * dpr;
  canvas.height = chartH * dpr;
  canvas.style.width = parentW + 'px';
  canvas.style.height = chartH + 'px';

  var ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  var W = parentW, H = chartH;

  var padL = 42, padR = 12, padT = 26, padB = 34;
  var plotW = W - padL - padR, plotH = H - padT - padB;

  // Veri noktaları: her segmentin ortasındaki eğim değeri (çizgi grafiği için)
  var cumDist = 0;
  var dataPoints = [];
  var linePoints = []; // çizgi grafiği noktaları: {x: mesafe, y: eğim}
  for(var i = 0; i < segments.length; i++) {
    var midX = cumDist + segments[i].mesafe / 2;
    dataPoints.push({ xStart: cumDist, xEnd: cumDist + segments[i].mesafe, grade: segments[i].egim, deltaH: segments[i].deltaH, mesafe: segments[i].mesafe });
    linePoints.push({ x: midX, y: segments[i].egim });
    cumDist += segments[i].mesafe;
  }
  // Başlangıç ve bitiş noktaları ekle (uçlarda kesilmesin)
  if(linePoints.length > 0) {
    linePoints.unshift({ x: 0, y: linePoints[0].y });
    linePoints.push({ x: cumDist, y: linePoints[linePoints.length - 1].y });
  }

  var totalDist = cumDist;
  var grades = segments.map(function(s) { return s.egim; });
  var maxGrade = Math.max.apply(null, grades);
  var minGrade = Math.min.apply(null, grades);

  // Aralıklar
  var baseXMin = 0, baseXMax = totalDist;
  var gradeMargin = Math.max(2, (maxGrade - minGrade) * 0.15);
  var baseYMin = Math.floor(minGrade - gradeMargin);
  var baseYMax = Math.ceil(maxGrade + gradeMargin);
  if(baseYMin > -2) baseYMin = -2;
  if(baseYMax < 2) baseYMax = 2;

  // Zoom uygula
  var z = _drGetZoom(canvasId);
  var zs = z.scale || 1.0;
  var visXRange = (baseXMax - baseXMin) / zs;
  var visYRange = (baseYMax - baseYMin) / zs;
  if(z.cx === null) z.cx = (baseXMin + baseXMax) / 2;
  if(z.cy === null) z.cy = (baseYMin + baseYMax) / 2;
  var xMin = z.cx - visXRange / 2, xMax = z.cx + visXRange / 2;
  var yMin = z.cy - visYRange / 2, yMax = z.cy + visYRange / 2;
  if(zs >= 1.0) {
    if(xMin < baseXMin) { xMin = baseXMin; xMax = baseXMin + visXRange; }
    if(xMax > baseXMax) { xMax = baseXMax; xMin = baseXMax - visXRange; }
    if(yMin < baseYMin) { yMin = baseYMin; yMax = baseYMin + visYRange; }
    if(yMax > baseYMax) { yMax = baseYMax; yMin = baseYMax - visYRange; }
  }
  z.cx = (xMin + xMax) / 2; z.cy = (yMin + yMax) / 2;

  function toX(v) { return padL + (v - xMin) / (xMax - xMin) * plotW; }
  function toY(v) { return padT + plotH - (v - yMin) / (yMax - yMin) * plotH; }
  function fromX(px) { return xMin + (px - padL) / plotW * (xMax - xMin); }
  function fromY(py) { return yMin + (padT + plotH - py) / plotH * (yMax - yMin); }

  // Tema renkleri
  var cs = getComputedStyle(document.documentElement);
  var bgColor = cs.getPropertyValue('--bg-tertiary').trim() || '#1a1f2e';
  var textColor = cs.getPropertyValue('--text-secondary').trim() || '#8b95a5';
  var headColor = cs.getPropertyValue('--text-heading').trim() || '#e0e0e0';
  var borderColor = cs.getPropertyValue('--border-color').trim() || '#2a3040';
  var accentColor = cs.getPropertyValue('--accent-primary').trim() || '#3b82f6';
  var successColor = cs.getPropertyValue('--accent-success').trim() || '#4caf50';
  var dangerColor = cs.getPropertyValue('--accent-danger').trim() || '#ef5350';

  // Arka plan
  ctx.fillStyle = bgColor;
  ctx.fillRect(0, 0, W, H);

  // Grid
  ctx.strokeStyle = borderColor; ctx.lineWidth = 0.5;
  var yStep = (yMax - yMin) <= 8 ? 1 : (yMax - yMin) <= 20 ? 2 : 5;
  for(var gy = Math.ceil(yMin / yStep) * yStep; gy <= yMax; gy += yStep) {
    ctx.beginPath(); ctx.moveTo(padL, toY(gy)); ctx.lineTo(W - padR, toY(gy)); ctx.stroke();
  }

  // Sıfır çizgisi
  if(yMin <= 0 && yMax >= 0) {
    ctx.strokeStyle = textColor; ctx.lineWidth = 0.8;
    ctx.setLineDash([4, 3]);
    ctx.beginPath(); ctx.moveTo(padL, toY(0)); ctx.lineTo(W - padR, toY(0)); ctx.stroke();
    ctx.setLineDash([]);
  }

  // Eksenler
  ctx.strokeStyle = textColor; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(padL, padT); ctx.lineTo(padL, H - padB); ctx.lineTo(W - padR, H - padB); ctx.stroke();

  // Y etiketleri
  ctx.fillStyle = textColor; ctx.font = '9px Segoe UI, sans-serif'; ctx.textAlign = 'right';
  for(var ly = Math.ceil(yMin / yStep) * yStep; ly <= yMax; ly += yStep) {
    ctx.fillText('%' + ly.toFixed(0), padL - 4, toY(ly) + 3);
  }

  // X etiketleri (mesafe — her zaman metre)
  ctx.textAlign = 'center';
  var xStep;
  if(totalDist <= 500) xStep = 50;
  else if(totalDist <= 2000) xStep = 200;
  else if(totalDist <= 5000) xStep = 500;
  else if(totalDist <= 20000) xStep = 2000;
  else xStep = 5000;
  for(var lx = 0; lx <= xMax; lx += xStep) {
    if(lx < xMin) continue;
    ctx.fillText(lx.toFixed(0), toX(lx), H - padB + 14);
  }

  // Eksen başlıkları
  ctx.fillStyle = headColor; ctx.font = '600 9.5px Segoe UI, sans-serif'; ctx.textAlign = 'center';
  ctx.fillText('Mesafe (m)', padL + plotW / 2, H - 3);
  ctx.save(); ctx.translate(10, padT + plotH / 2); ctx.rotate(-Math.PI / 2);
  ctx.fillText('Eğim (%)', 0, 0); ctx.restore();

  // Başlık
  ctx.fillStyle = headColor; ctx.font = '600 10.5px Segoe UI, sans-serif'; ctx.textAlign = 'center';
  ctx.fillText('Mesafe — Eğim Profili', padL + plotW / 2, 14);

  // Zoom göstergesi
  if(zs > 1.05 || zs < 0.95) {
    ctx.fillStyle = 'rgba(106,27,154,0.85)'; ctx.font = '600 8px Segoe UI, sans-serif'; ctx.textAlign = 'right';
    ctx.fillText(zs.toFixed(1) + 'x', W - padR - 26, padT - 4);
  }

  // Çizim alanı kırp
  ctx.save();
  ctx.beginPath();
  ctx.rect(padL, padT, plotW, plotH);
  ctx.clip();

  // ── Gradient dolgu (çizgi altı) ──
  var zeroY = toY(0);
  if(linePoints.length >= 2) {
    // Pozitif bölge (iniş = yeşil gradient)
    ctx.beginPath();
    ctx.moveTo(toX(linePoints[0].x), zeroY);
    for(var gi = 0; gi < linePoints.length; gi++) {
      var px = toX(linePoints[gi].x);
      var py = toY(Math.max(0, linePoints[gi].y));
      if(gi === 0) ctx.lineTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.lineTo(toX(linePoints[linePoints.length - 1].x), zeroY);
    ctx.closePath();
    var gradPos = ctx.createLinearGradient(0, padT, 0, padT + plotH);
    gradPos.addColorStop(0, 'rgba(76,175,80,0.35)');
    gradPos.addColorStop(1, 'rgba(76,175,80,0.03)');
    ctx.fillStyle = gradPos;
    ctx.fill();

    // Negatif bölge (çıkış = kırmızı gradient)
    ctx.beginPath();
    ctx.moveTo(toX(linePoints[0].x), zeroY);
    for(var ni = 0; ni < linePoints.length; ni++) {
      var npx = toX(linePoints[ni].x);
      var npy = toY(Math.min(0, linePoints[ni].y));
      ctx.lineTo(npx, npy);
    }
    ctx.lineTo(toX(linePoints[linePoints.length - 1].x), zeroY);
    ctx.closePath();
    var gradNeg = ctx.createLinearGradient(0, padT, 0, padT + plotH);
    gradNeg.addColorStop(0, 'rgba(239,83,80,0.03)');
    gradNeg.addColorStop(1, 'rgba(239,83,80,0.35)');
    ctx.fillStyle = gradNeg;
    ctx.fill();
  }

  // ── Ana çizgi ──
  if(linePoints.length >= 2) {
    ctx.lineWidth = 2; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    // Çizgiyi renk segmentleriyle çiz
    for(var li = 0; li < linePoints.length - 1; li++) {
      var p1 = linePoints[li], p2 = linePoints[li + 1];
      var avgGrade = (p1.y + p2.y) / 2;
      ctx.strokeStyle = avgGrade > 0.5 ? successColor : (avgGrade < -0.5 ? dangerColor : accentColor);
      ctx.beginPath();
      ctx.moveTo(toX(p1.x), toY(p1.y));
      ctx.lineTo(toX(p2.x), toY(p2.y));
      ctx.stroke();
    }

    // Veri noktaları (sadece segment ortaları, uç noktalar değil)
    for(var pi = 1; pi < linePoints.length - 1; pi++) {
      var pt = linePoints[pi];
      var ptx = toX(pt.x), pty = toY(pt.y);
      if(ptx < padL - 5 || ptx > W - padR + 5) continue;
      ctx.beginPath(); ctx.arc(ptx, pty, 3, 0, Math.PI * 2);
      var ptColor = pt.y > 0.5 ? successColor : (pt.y < -0.5 ? dangerColor : accentColor);
      ctx.fillStyle = bgColor; ctx.fill();
      ctx.strokeStyle = ptColor; ctx.lineWidth = 1.5; ctx.stroke();
    }
  }

  // ── Mesafe-ağırlıklı ortalama eğim çizgisi ──
  var totalDistCalc = 0, weightedGradeCalc = 0;
  segments.forEach(function(seg) { totalDistCalc += seg.mesafe; weightedGradeCalc += seg.egim * seg.mesafe; });
  var routeAvgGrade = totalDistCalc > 0 ? weightedGradeCalc / totalDistCalc : 0;
  var avgY = toY(routeAvgGrade);
  if(avgY >= padT && avgY <= padT + plotH) {
    ctx.strokeStyle = '#ff9800';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([6, 3]);
    ctx.beginPath();
    ctx.moveTo(padL, avgY);
    ctx.lineTo(padL + plotW, avgY);
    ctx.stroke();
    ctx.setLineDash([]);
    // Etiket
    ctx.fillStyle = '#ff9800';
    ctx.font = '600 8px Segoe UI, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('Ort: %' + routeAvgGrade.toFixed(2), padL + 4, avgY - 4);
  }

  // ── Bölge seçimi overlay ──
  if(canvas._dgSelection) {
    var sel = canvas._dgSelection;
    var selX1 = Math.max(padL, toX(sel.xStart));
    var selX2 = Math.min(padL + plotW, toX(sel.xEnd));
    if(selX2 > selX1) {
      // Seçim kutusu
      ctx.fillStyle = 'rgba(255,152,0,0.12)';
      ctx.fillRect(selX1, padT, selX2 - selX1, plotH);
      ctx.strokeStyle = '#ff9800';
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 2]);
      ctx.strokeRect(selX1, padT, selX2 - selX1, plotH);
      ctx.setLineDash([]);
      // Seçili bölgenin ağırlıklı ortalama eğim çizgisi
      if(sel.avgGrade !== undefined) {
        var selAvgY = toY(sel.avgGrade);
        if(selAvgY >= padT && selAvgY <= padT + plotH) {
          ctx.strokeStyle = '#ffeb3b';
          ctx.lineWidth = 2;
          ctx.setLineDash([4, 2]);
          ctx.beginPath();
          ctx.moveTo(selX1, selAvgY);
          ctx.lineTo(selX2, selAvgY);
          ctx.stroke();
          ctx.setLineDash([]);
          ctx.fillStyle = '#ffeb3b';
          ctx.font = '700 9px Segoe UI, sans-serif';
          ctx.textAlign = 'center';
          ctx.fillText('Seçim Ort: %' + sel.avgGrade.toFixed(2), (selX1 + selX2) / 2, selAvgY - 6);
        }
      }
    }
  }

  ctx.restore();

  // ── SavGol filtre bilgisi ──
  ctx.save();
  ctx.fillStyle = 'rgba(255,152,0,0.6)';
  ctx.font = '600 7.5px Segoe UI, sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText('SavGol Filtre', W - padR - 4, padT + 12);
  ctx.restore();

  // Etkileşim verisi kaydet
  canvas._drChart = {
    type: 'distGrade', segments: segments, dataPoints: dataPoints, linePoints: linePoints,
    padL: padL, padR: padR, padT: padT, padB: padB,
    plotW: plotW, plotH: plotH, xMin: xMin, xMax: xMax, yMin: yMin, yMax: yMax,
    baseXMin: baseXMin, baseXMax: baseXMax, baseYMin: baseYMin, baseYMax: baseYMax,
    fromX: fromX, fromY: fromY, W: W, H: H, totalDist: totalDist,
    nodeId: nodeId
  };

  // Event'leri bağla (bir kez)
  if(!canvas._drEventsAttached) {
    canvas._drEventsAttached = true;
    canvas.addEventListener('wheel', _drChartWheel, {passive: false});
    canvas.addEventListener('mousedown', _drChartMouseDown);
    canvas.addEventListener('mouseup', _drChartMouseUp);
    canvas.addEventListener('mousemove', _drChartMouseMove);
    canvas.addEventListener('mouseleave', _drChartMouseLeave);
    canvas.addEventListener('dblclick', _drChartDblClick);
    canvas.addEventListener('contextmenu', function(e) { e.preventDefault(); });

    // ── Bölge seçimi (sol tık + sürükle) ──
    canvas.addEventListener('mousedown', function(e) {
      if(e.button !== 0) return; // sadece sol tık
      var d = canvas._drChart;
      if(!d || d.type !== 'distGrade') return;
      var rect = canvas.getBoundingClientRect();
      var mx = e.clientX - rect.left;
      var my = e.clientY - rect.top;
      // Sadece plot alanı içinde
      if(mx < d.padL || mx > d.W - d.padR || my < d.padT || my > d.padT + d.plotH) return;
      canvas._dgSelecting = true;
      canvas._dgSelStartX = d.fromX(mx);
      canvas._dgSelection = null;
    });
    canvas.addEventListener('mousemove', function(e) {
      if(!canvas._dgSelecting) return;
      var d = canvas._drChart;
      if(!d) return;
      var rect = canvas.getBoundingClientRect();
      var mx = e.clientX - rect.left;
      var xVal = d.fromX(mx);
      var x1 = Math.min(canvas._dgSelStartX, xVal);
      var x2 = Math.max(canvas._dgSelStartX, xVal);
      // Clamp
      x1 = Math.max(0, x1);
      x2 = Math.min(d.totalDist, x2);
      if(x2 - x1 < 1) return; // çok küçük seçim

      // Seçili bölgedeki segment'lerin ağırlıklı ortalamasını hesapla
      var selDist = 0, selWeighted = 0;
      var cumD = 0;
      for(var si = 0; si < d.segments.length; si++) {
        var segStart = cumD;
        var segEnd = cumD + d.segments[si].mesafe;
        // Kesişim
        var overlapStart = Math.max(x1, segStart);
        var overlapEnd = Math.min(x2, segEnd);
        if(overlapEnd > overlapStart) {
          var overlapLen = overlapEnd - overlapStart;
          selDist += overlapLen;
          selWeighted += d.segments[si].egim * overlapLen;
        }
        cumD = segEnd;
      }
      var selAvg = selDist > 0 ? selWeighted / selDist : 0;
      canvas._dgSelection = { xStart: x1, xEnd: x2, avgGrade: selAvg, dist: selDist };

      // Redraw
      _drRedrawChart(canvas);

      // Bilgi kutusunu güncelle
      var nid = d.nodeId;
      if(nid) {
        var selEl = document.getElementById('ve-road-selection-grade-' + nid);
        if(selEl) {
          selEl.innerHTML = '<span style="color:#ffeb3b; font-weight:700;">Seçim: %' + selAvg.toFixed(2) + '</span>' +
            '<span style="color:var(--text-muted); margin-left:6px;">(' + selDist.toFixed(0) + ' m)</span>';
          selEl.style.fontStyle = 'normal';
        }
      }
    });
    canvas.addEventListener('mouseup', function(e) {
      if(e.button !== 0) return;
      canvas._dgSelecting = false;
    });
    canvas.addEventListener('mouseleave', function() {
      canvas._dgSelecting = false;
    });
  }
}


// ═══ RAKIM PROFİLİ (GPS Sensör tarzı yükseklik grafiği) ═══

// ═══ ROTA WAYPOINT SİSTEMİ ═══
// Rota üzerinde kullanıcının belirlediği referans noktaları (köy, kavşak, tünel vb.)
// nodeId → [{id, name, dist, elev, lat, lng, auto}]
var _veRouteWaypoints = {};
var _veWaypointMode = {}; // nodeId → true/false — waypoint ekleme modu aktif mi
var _veWaypointMarkers = {}; // nodeId → [L.marker, ...] — haritadaki waypoint markerları
var _veWaypointColors = ['#ff9800', '#00bcd4', '#e91e63', '#8bc34a', '#9c27b0', '#ffeb3b', '#03a9f4', '#ff5722'];

// Waypoint ekleme (rota üzerine snap)
function veAddRouteWaypoint(nodeId, dist, name) {
  var node = nodes.find(function(n) { return n.id === nodeId; });
  if(!node || !node.data || !node.data.gpsSamples || node.data.gpsSamples.length < 2) return null;

  var pts = node.data.gpsSamples;
  var totalDist = pts[pts.length - 1].dist;
  dist = Math.max(0, Math.min(totalDist, dist));

  // Elevation ve lat/lng interpolasyonu
  var elev = _veAltInterpElev(pts, dist);
  var latLng = _veInterpLatLng(pts, dist);

  if(!_veRouteWaypoints[nodeId]) _veRouteWaypoints[nodeId] = [];
  var wps = _veRouteWaypoints[nodeId];
  var wpId = 'wp_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
  var wp = {
    id: wpId,
    name: name || 'Nokta ' + (wps.length + 1),
    dist: dist,
    elev: elev,
    lat: latLng.lat,
    lng: latLng.lng,
    auto: false
  };
  wps.push(wp);
  // Mesafeye göre sırala
  wps.sort(function(a, b) { return a.dist - b.dist; });
  _veWaypointPersist(nodeId);
  return wp;
}

// Otomatik waypoint ekle (başlangıç/bitiş)
function _veAddAutoWaypoint(nodeId, dist, name) {
  var node = nodes.find(function(n) { return n.id === nodeId; });
  if(!node || !node.data || !node.data.gpsSamples || node.data.gpsSamples.length < 2) return;

  var pts = node.data.gpsSamples;
  var totalDist = pts[pts.length - 1].dist;
  dist = Math.max(0, Math.min(totalDist, dist));
  var elev = _veAltInterpElev(pts, dist);
  var latLng = _veInterpLatLng(pts, dist);

  if(!_veRouteWaypoints[nodeId]) _veRouteWaypoints[nodeId] = [];
  var wps = _veRouteWaypoints[nodeId];

  // Aynı mesafede auto waypoint varsa ekleme
  var exists = wps.some(function(w) { return w.auto && Math.abs(w.dist - dist) < 1; });
  if(exists) return;

  wps.push({
    id: 'wp_auto_' + Date.now() + '_' + Math.floor(Math.random() * 100),
    name: name,
    dist: dist,
    elev: elev,
    lat: latLng.lat,
    lng: latLng.lng,
    auto: true
  });
  wps.sort(function(a, b) { return a.dist - b.dist; });
}

// GPS samples üzerinde lat/lng interpolasyonu
function _veInterpLatLng(pts, dist) {
  if(!pts || pts.length < 2) return { lat: 0, lng: 0 };
  if(dist <= pts[0].dist) return { lat: pts[0].lat, lng: pts[0].lng };
  if(dist >= pts[pts.length - 1].dist) return { lat: pts[pts.length - 1].lat, lng: pts[pts.length - 1].lng };
  for(var k = 0; k < pts.length - 1; k++) {
    if(dist >= pts[k].dist && dist <= pts[k+1].dist) {
      var t = (pts[k+1].dist - pts[k].dist) > 0.01 ? (dist - pts[k].dist) / (pts[k+1].dist - pts[k].dist) : 0;
      return {
        lat: pts[k].lat + t * (pts[k+1].lat - pts[k].lat),
        lng: pts[k].lng + t * (pts[k+1].lng - pts[k].lng)
      };
    }
  }
  return { lat: pts[pts.length - 1].lat, lng: pts[pts.length - 1].lng };
}

// Waypoint sil
function veRemoveRouteWaypoint(nodeId, wpId) {
  if(!_veRouteWaypoints[nodeId]) return;
  _veRouteWaypoints[nodeId] = _veRouteWaypoints[nodeId].filter(function(w) { return w.id !== wpId; });
  _veWaypointPersist(nodeId);
}

// Waypoint ismini güncelle
function veRenameRouteWaypoint(nodeId, wpId, newName) {
  if(!_veRouteWaypoints[nodeId]) return;
  var wp = _veRouteWaypoints[nodeId].find(function(w) { return w.id === wpId; });
  if(wp) { wp.name = newName; _veWaypointPersist(nodeId); }
}

// Tüm waypoint'leri temizle
function veClearRouteWaypoints(nodeId) {
  _veRouteWaypoints[nodeId] = [];
  _veWaypointPersist(nodeId);
  _veWaypointClearMapMarkers(nodeId);
}

// Bir mesafe değerine en yakın waypoint'i bul
function _veFindNearestWaypoint(wps, dist) {
  if(!wps || wps.length === 0) return null;
  var best = null, bestDist = Infinity;
  for(var i = 0; i < wps.length; i++) {
    var d = Math.abs(wps[i].dist - dist);
    if(d < bestDist) { bestDist = d; best = wps[i]; }
  }
  return best;
}

// Persist: node.data'ya kaydet
function _veWaypointPersist(nodeId) {
  var node = nodes.find(function(n) { return n.id === nodeId; });
  if(!node) return;
  if(!node.data) node.data = {};
  node.data.routeWaypoints = (_veRouteWaypoints[nodeId] || []).map(function(w) {
    return { id: w.id, name: w.name, dist: w.dist, elev: w.elev, lat: w.lat, lng: w.lng, auto: w.auto };
  });
}

// Restore: node.data'dan geri yükle
function _veWaypointRestore(nodeId) {
  var node = nodes.find(function(n) { return n.id === nodeId; });
  if(!node || !node.data || !node.data.routeWaypoints || node.data.routeWaypoints.length === 0) return;
  if(_veRouteWaypoints[nodeId] && _veRouteWaypoints[nodeId].length > 0) return; // zaten yüklü
  _veRouteWaypoints[nodeId] = node.data.routeWaypoints.map(function(w) {
    return { id: w.id, name: w.name, dist: w.dist, elev: w.elev, lat: w.lat, lng: w.lng, auto: !!w.auto };
  });
}

// OSRM rota çizgisine waypoint ekleme click handler'ı bağla
function _veAttachRouteClickForWaypoint(nodeId) {
  var line = veRoadOSRMlines[nodeId];
  if(!line) return;
  // Mevcut handler varsa kaldır
  line.off('click');
  line.on('click', function(e) {
    L.DomEvent.stopPropagation(e); // Harita click'ini engelle
    var node = nodes.find(function(n) { return n.id === nodeId; });
    if(!node || !node.data || !node.data.gpsSamples || node.data.gpsSamples.length < 2) {
      showToast('Önce rota hesaplayın', 'warning'); return;
    }
    // Tıklanan noktanın rota üzerindeki en yakın mesafesini bul
    var clickLatLng = e.latlng;
    var pts = node.data.gpsSamples;
    var bestDist = Infinity, bestRouteDist = 0;
    for(var i = 0; i < pts.length; i++) {
      var d = Math.pow(pts[i].lat - clickLatLng.lat, 2) + Math.pow(pts[i].lng - clickLatLng.lng, 2);
      if(d < bestDist) { bestDist = d; bestRouteDist = pts[i].dist; }
    }
    // İsimlendirme dialog'u aç
    _veWaypointNameDialog(nodeId, bestRouteDist, function(name) {
      veAddRouteWaypoint(nodeId, bestRouteDist, name);
      _veWaypointUpdateList(nodeId);
      _veAltRedrawAll(nodeId);
      _veWaypointShowOnMap(nodeId);
      showToast('📍 Referans noktası eklendi: ' + name);
    });
  });
}

// Haritadaki waypoint marker'larını temizle
function _veWaypointClearMapMarkers(nodeId) {
  var map = veRoadMaps[nodeId];
  if(map && _veWaypointMarkers[nodeId]) {
    _veWaypointMarkers[nodeId].forEach(function(m) { try { map.removeLayer(m); } catch(e){} });
  }
  _veWaypointMarkers[nodeId] = [];
}

// Haritada waypoint marker'larını göster
function _veWaypointShowOnMap(nodeId) {
  var map = veRoadMaps[nodeId];
  if(!map) return;
  _veWaypointClearMapMarkers(nodeId);
  var wps = _veRouteWaypoints[nodeId] || [];
  if(!_veWaypointMarkers[nodeId]) _veWaypointMarkers[nodeId] = [];
  wps.forEach(function(wp, idx) {
    var color = wp.auto ? '#4fc3f7' : _veWaypointColors[idx % _veWaypointColors.length];
    var marker = L.marker([wp.lat, wp.lng], {
      icon: L.divIcon({
        className: '',
        html: '<div style="background:' + color + '; color:#000; width:18px; height:18px; border-radius:3px; text-align:center; line-height:18px; font-size:8px; font-weight:700; border:2px solid #fff; box-shadow:0 1px 4px rgba(0,0,0,0.4);"><span class="mf-ico mf-ico-map-pin"></span></div>',
        iconSize: [18, 18], iconAnchor: [9, 18]
      })
    }).addTo(map);
    var ttHtml = '<b>' + wp.name + '</b><br>Mesafe: ' + (wp.dist / 1000).toFixed(2) + ' km<br>Rakım: ' + wp.elev.toFixed(0) + ' m';
    marker.bindTooltip(ttHtml, { direction: 'top', offset: [0, -20] });
    _veWaypointMarkers[nodeId].push(marker);
  });
}

// İsimlendirme dialog'u
function _veWaypointNameDialog(nodeId, dist, callback) {
  var existing = document.getElementById('ve-wp-name-dialog');
  if(existing) existing.remove();

  var ov = document.createElement('div');
  ov.id = 've-wp-name-dialog';
  ov.style.cssText = 'position:fixed; inset:0; z-index:200000; background:rgba(0,0,0,0.5); display:flex; align-items:center; justify-content:center;';
  ov.addEventListener('mousedown', function(e) { if(e.target === ov) { ov.remove(); } });

  var distKm = (dist / 1000).toFixed(2);
  var box = document.createElement('div');
  box.style.cssText = 'width:320px; background:var(--bg-secondary); border:1px solid var(--border-color); border-radius:0; overflow:hidden; box-shadow:0 20px 60px rgba(0,0,0,0.6);';
  box.innerHTML =
    '<div style="padding:10px 14px; background:linear-gradient(135deg, #e65100 0%, #ff9800 100%); display:flex; align-items:center; justify-content:space-between;">' +
      '<span style="font-size:0.78rem; font-weight:700; color:#fff;"><span class="mf-ico mf-ico-map-pin"></span> Referans Noktası Ekle</span>' +
      '<button onclick="document.getElementById(\'ve-wp-name-dialog\').remove()" style="width:24px; height:24px; background:transparent; border:1px solid rgba(255,255,255,0.3); border-radius:0; color:#fff; cursor:pointer; font-size:0.85rem;">✕</button>' +
    '</div>' +
    '<div style="padding:14px 16px;">' +
      '<div style="font-size:0.62rem; color:var(--text-muted); margin-bottom:8px;">Mesafe: <b style="color:var(--accent-primary);">' + distKm + ' km</b></div>' +
      '<label style="color:var(--text-secondary); font-size:0.66rem; display:block; margin-bottom:4px;">Nokta Adı:</label>' +
      '<input type="text" id="ve-wp-name-input" placeholder="Ör: Bolu Tüneli Çıkışı" style="width:100%; padding:7px 10px; font-size:0.72rem; background:var(--bg-input); color:var(--text-primary); border:1px solid var(--border-color); border-radius:0; box-sizing:border-box;" autofocus>' +
      '<button id="ve-wp-name-ok" style="width:100%; margin-top:10px; padding:8px; background:linear-gradient(135deg, #e65100 0%, #ff9800 100%); color:#fff; border:none; border-radius:0; font-size:0.72rem; font-weight:700; cursor:pointer;"><span class="mf-ico mf-ico-map-pin"></span> Ekle</button>' +
    '</div>';
  ov.appendChild(box);
  document.body.appendChild(ov);

  var inp = document.getElementById('ve-wp-name-input');
  setTimeout(function() { inp.focus(); }, 50);

  function doAdd() {
    var name = inp.value.trim();
    if(!name) { inp.style.borderColor = 'var(--accent-danger)'; inp.focus(); return; }
    ov.remove();
    callback(name);
  }

  document.getElementById('ve-wp-name-ok').addEventListener('click', doAdd);
  inp.addEventListener('keydown', function(e) {
    if(e.key === 'Enter') doAdd();
    if(e.key === 'Escape') ov.remove();
  });
}

// Waypoint listesini güncelle (expanded modal'daki panel)
function _veWaypointUpdateList(nodeId) {
  var listEl = document.getElementById('ve-wp-list-' + nodeId);
  if(!listEl) return;
  var wps = _veRouteWaypoints[nodeId] || [];
  if(wps.length === 0) {
    listEl.innerHTML = '<div style="color:var(--text-muted); font-style:italic; font-size:0.58rem; padding:4px 0;">Henüz referans noktası yok. Grafikte sağ tık ile ekleyin.</div>';
    return;
  }
  var html = '<table style="width:100%; font-size:0.58rem; border-collapse:collapse;">';
  html += '<thead><tr style="background:var(--bg-tertiary);">' +
    '<th style="padding:3px 4px; text-align:center; border-bottom:1px solid var(--border-color); width:20px;">#</th>' +
    '<th style="padding:3px 4px; text-align:left; border-bottom:1px solid var(--border-color);">Adı</th>' +
    '<th style="padding:3px 4px; text-align:right; border-bottom:1px solid var(--border-color);">Mesafe</th>' +
    '<th style="padding:3px 4px; text-align:right; border-bottom:1px solid var(--border-color);">Rakım</th>' +
    '<th style="padding:3px 4px; text-align:center; border-bottom:1px solid var(--border-color); width:40px;"></th>' +
    '</tr></thead><tbody>';
  for(var i = 0; i < wps.length; i++) {
    var w = wps[i];
    var color = w.auto ? '#4fc3f7' : _veWaypointColors[i % _veWaypointColors.length];
    html += '<tr style="border-bottom:1px solid var(--border-color);">';
    html += '<td style="padding:2px 4px; text-align:center;"><span style="display:inline-block; width:10px; height:10px; border-radius:2px; background:' + color + ';"></span></td>';
    html += '<td style="padding:2px 4px; text-align:left; font-weight:600; color:' + color + '; max-width:120px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="' + w.name + '">' + w.name + '</td>';
    html += '<td style="padding:2px 4px; text-align:right;">' + (w.dist / 1000).toFixed(2) + ' km</td>';
    html += '<td style="padding:2px 4px; text-align:right;">' + w.elev.toFixed(0) + ' m</td>';
    html += '<td style="padding:2px 4px; text-align:center;">';
    html += '<button onclick="veWaypointRenameUI(\'' + nodeId + '\',\'' + w.id + '\')" style="background:none; border:none; cursor:pointer; color:var(--text-secondary); font-size:0.6rem; padding:0 2px;" title="İsim değiştir"><span class="mf-ico mf-ico-edit"></span></button>';
    if(!w.auto) {
      html += '<button onclick="veWaypointRemoveUI(\'' + nodeId + '\',\'' + w.id + '\')" style="background:none; border:none; cursor:pointer; color:var(--accent-danger); font-size:0.6rem; padding:0 2px;" title="Sil">✕</button>';
    }
    html += '</td>';
    html += '</tr>';
  }
  html += '</tbody></table>';
  listEl.innerHTML = html;
}

// UI: Waypoint sil
function veWaypointRemoveUI(nodeId, wpId) {
  veRemoveRouteWaypoint(nodeId, wpId);
  _veWaypointUpdateList(nodeId);
  _veAltRedrawAll(nodeId);
  _veWaypointShowOnMap(nodeId);
}

// UI: Waypoint ismini değiştir
function veWaypointRenameUI(nodeId, wpId) {
  var wps = _veRouteWaypoints[nodeId] || [];
  var wp = wps.find(function(w) { return w.id === wpId; });
  if(!wp) return;
  var newName = prompt('Yeni isim:', wp.name);
  if(newName && newName.trim()) {
    veRenameRouteWaypoint(nodeId, wpId, newName.trim());
    _veWaypointUpdateList(nodeId);
    _veAltRedrawAll(nodeId);
    _veWaypointShowOnMap(nodeId);
  }
}

// UI: Tüm waypoint'leri temizle
function veWaypointClearAllUI(nodeId) {
  veClearRouteWaypoints(nodeId);
  _veWaypointUpdateList(nodeId);
  _veAltRedrawAll(nodeId);
}

// Kaydedilmiş eğim çizgileri: nodeId → [{x1, y1, x2, y2, grade, dist, deltaH, color}]
var _veAltGradeLines = {};
var _veAltGradeLineColors = ['#ffeb3b', '#ff9800', '#4caf50', '#2196f3', '#e91e63', '#00bcd4', '#ff5722', '#8bc34a'];

function _veAltInterpElev(pts, dist) {
  if(!pts || pts.length < 2) return 0;
  if(dist <= pts[0].dist) return pts[0].elev;
  if(dist >= pts[pts.length - 1].dist) return pts[pts.length - 1].elev;
  for(var k = 0; k < pts.length - 1; k++) {
    if(dist >= pts[k].dist && dist <= pts[k+1].dist) {
      var t = (pts[k+1].dist - pts[k].dist) > 0.01 ? (dist - pts[k].dist) / (pts[k+1].dist - pts[k].dist) : 0;
      return pts[k].elev + t * (pts[k+1].elev - pts[k].elev);
    }
  }
  return pts[pts.length - 1].elev;
}

function veRenderAltitudeProfile(canvasId, gpsSamples, nodeId) {
  var canvas = document.getElementById(canvasId);
  if(!canvas || !gpsSamples || gpsSamples.length < 2) return;

  // Kaydedilmiş eğim çizgilerini geri yükle (panel yenilenmesinde kaybolmaması için)
  _veAltRestoreGradeLines(nodeId);

  var pts = gpsSamples; // [{dist, elev}, ...]
  var parentW = canvas.parentElement.clientWidth || 400;
  var chartH = canvas._dgExpandedH || 180;
  var dpr = window.devicePixelRatio || 1;
  canvas.width = parentW * dpr;
  canvas.height = chartH * dpr;
  canvas.style.width = parentW + 'px';
  canvas.style.height = chartH + 'px';

  var ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  var W = parentW, H = chartH;
  var padL = 48, padR = 12, padT = 26, padB = 34;
  var plotW = W - padL - padR, plotH = H - padT - padB;

  var totalDist = pts[pts.length - 1].dist;

  // Y aralığı
  var elevMin = Infinity, elevMax = -Infinity;
  pts.forEach(function(p) {
    if(p.elev < elevMin) elevMin = p.elev;
    if(p.elev > elevMax) elevMax = p.elev;
  });
  var elevMargin = Math.max(5, (elevMax - elevMin) * 0.12);
  var baseXMin = 0, baseXMax = totalDist;
  var baseYMin = Math.floor((elevMin - elevMargin) / 5) * 5;
  var baseYMax = Math.ceil((elevMax + elevMargin) / 5) * 5;
  if(baseYMax - baseYMin < 20) { baseYMin -= 10; baseYMax += 10; }

  // Zoom
  var z = _drGetZoom(canvasId);
  var zs = z.scale || 1.0;
  var visXRange = (baseXMax - baseXMin) / zs;
  var visYRange = (baseYMax - baseYMin) / zs;
  if(z.cx === null) z.cx = (baseXMin + baseXMax) / 2;
  if(z.cy === null) z.cy = (baseYMin + baseYMax) / 2;
  var xMin = z.cx - visXRange / 2, xMax = z.cx + visXRange / 2;
  var yMin = z.cy - visYRange / 2, yMax = z.cy + visYRange / 2;
  if(zs >= 1.0) {
    if(xMin < baseXMin) { xMin = baseXMin; xMax = baseXMin + visXRange; }
    if(xMax > baseXMax) { xMax = baseXMax; xMin = baseXMax - visXRange; }
    if(yMin < baseYMin) { yMin = baseYMin; yMax = baseYMin + visYRange; }
    if(yMax > baseYMax) { yMax = baseYMax; yMin = baseYMax - visYRange; }
  }
  z.cx = (xMin + xMax) / 2; z.cy = (yMin + yMax) / 2;

  function toX(v) { return padL + (v - xMin) / (xMax - xMin) * plotW; }
  function toY(v) { return padT + plotH - (v - yMin) / (yMax - yMin) * plotH; }
  function fromX(px) { return xMin + (px - padL) / plotW * (xMax - xMin); }
  function fromY(py) { return yMin + (padT + plotH - py) / plotH * (yMax - yMin); }

  // Tema
  var cs = getComputedStyle(document.documentElement);
  var bgColor = cs.getPropertyValue('--bg-tertiary').trim() || '#1a1f2e';
  var textColor = cs.getPropertyValue('--text-secondary').trim() || '#8b95a5';
  var headColor = cs.getPropertyValue('--text-heading').trim() || '#e0e0e0';
  var borderColor = cs.getPropertyValue('--border-color').trim() || '#2a3040';

  // Arka plan
  ctx.fillStyle = bgColor;
  ctx.fillRect(0, 0, W, H);

  // Grid
  ctx.strokeStyle = borderColor; ctx.lineWidth = 0.5;
  var yRange = yMax - yMin;
  var yStep = yRange <= 30 ? 5 : yRange <= 80 ? 10 : yRange <= 200 ? 20 : yRange <= 500 ? 50 : 100;
  for(var gy = Math.ceil(yMin / yStep) * yStep; gy <= yMax; gy += yStep) {
    ctx.beginPath(); ctx.moveTo(padL, toY(gy)); ctx.lineTo(W - padR, toY(gy)); ctx.stroke();
  }

  // Eksenler
  ctx.strokeStyle = textColor; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(padL, padT); ctx.lineTo(padL, H - padB); ctx.lineTo(W - padR, H - padB); ctx.stroke();

  // Y etiketleri (rakım)
  ctx.fillStyle = textColor; ctx.font = '9px Segoe UI, sans-serif'; ctx.textAlign = 'right';
  for(var ly = Math.ceil(yMin / yStep) * yStep; ly <= yMax; ly += yStep) {
    ctx.fillText(ly.toFixed(0) + 'm', padL - 4, toY(ly) + 3);
  }

  // X etiketleri (mesafe — her zaman metre)
  ctx.textAlign = 'center';
  var xStep;
  if(totalDist <= 500) xStep = 50;
  else if(totalDist <= 2000) xStep = 200;
  else if(totalDist <= 5000) xStep = 500;
  else if(totalDist <= 20000) xStep = 2000;
  else xStep = 5000;
  for(var lx = 0; lx <= xMax; lx += xStep) {
    if(lx < xMin) continue;
    ctx.fillText(lx.toFixed(0), toX(lx), H - padB + 14);
  }

  // Eksen başlıkları
  ctx.fillStyle = headColor; ctx.font = '600 9.5px Segoe UI, sans-serif'; ctx.textAlign = 'center';
  ctx.fillText('Mesafe (m)', padL + plotW / 2, H - 3);
  ctx.save(); ctx.translate(10, padT + plotH / 2); ctx.rotate(-Math.PI / 2);
  ctx.fillText('Rakım (m)', 0, 0); ctx.restore();

  // Başlık
  ctx.fillStyle = headColor; ctx.font = '600 10.5px Segoe UI, sans-serif'; ctx.textAlign = 'center';
  var sampleInfo = pts.length + ' sample';
  if(pts.length > 1) {
    var avgInterval = (totalDist / (pts.length - 1));
    sampleInfo += ' @ ~' + avgInterval.toFixed(0) + 'm';
  }
  ctx.fillText('Rakım profili (GPS) — ' + sampleInfo, padL + plotW / 2, 14);

  // Zoom göstergesi
  if(zs > 1.05 || zs < 0.95) {
    ctx.fillStyle = 'rgba(106,27,154,0.85)'; ctx.font = '600 8px Segoe UI, sans-serif'; ctx.textAlign = 'right';
    ctx.fillText(zs.toFixed(1) + 'x', W - padR - 26, padT - 4);
  }

  // Başlangıç / Bitiş etiketleri (rakım değerleri ile)
  var startElev = pts[0].elev.toFixed(0);
  var endElev = pts[pts.length - 1].elev.toFixed(0);
  ctx.font = '600 8px Segoe UI, sans-serif';
  ctx.fillStyle = '#4caf50'; ctx.textAlign = 'left';
  ctx.fillText('A ' + startElev + 'm ▸', padL + 4, H - padB - 4);
  ctx.fillStyle = '#ef5350'; ctx.textAlign = 'right';
  ctx.fillText('◂ ' + endElev + 'm B', W - padR - 4, H - padB - 4);

  // Çizim alanı kırp
  ctx.save();
  ctx.beginPath();
  ctx.rect(padL, padT, plotW, plotH);
  ctx.clip();

  // ── Gradient dolgu (çizgi altı) ──
  if(pts.length >= 2) {
    ctx.beginPath();
    ctx.moveTo(toX(pts[0].dist), toY(baseYMin));
    for(var fi = 0; fi < pts.length; fi++) {
      ctx.lineTo(toX(pts[fi].dist), toY(pts[fi].elev));
    }
    ctx.lineTo(toX(pts[pts.length - 1].dist), toY(baseYMin));
    ctx.closePath();
    var grad = ctx.createLinearGradient(0, padT, 0, padT + plotH);
    grad.addColorStop(0, 'rgba(149,117,205,0.4)');
    grad.addColorStop(1, 'rgba(149,117,205,0.03)');
    ctx.fillStyle = grad;
    ctx.fill();
  }

  // ── Ana çizgi (mor — GPS tarzı) ──
  if(pts.length >= 2) {
    ctx.strokeStyle = '#b39ddb';
    ctx.lineWidth = 2;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(toX(pts[0].dist), toY(pts[0].elev));
    for(var li = 1; li < pts.length; li++) {
      ctx.lineTo(toX(pts[li].dist), toY(pts[li].elev));
    }
    ctx.stroke();
  }

  // ── Kaydedilmiş eğim çizgileri ──
  var lines = _veAltGradeLines[nodeId] || [];
  for(var gli = 0; gli < lines.length; gli++) {
    var gl = lines[gli];
    var glX1 = toX(gl.x1), glY1 = toY(gl.y1);
    var glX2 = toX(gl.x2), glY2 = toY(gl.y2);
    // Çizgi
    ctx.strokeStyle = gl.color;
    ctx.lineWidth = 2.5;
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.moveTo(glX1, glY1);
    ctx.lineTo(glX2, glY2);
    ctx.stroke();
    // Uç noktalar (daire)
    ctx.fillStyle = gl.color;
    ctx.beginPath(); ctx.arc(glX1, glY1, 4, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(glX2, glY2, 4, 0, Math.PI * 2); ctx.fill();
    // Eğim etiketi (çizgi ortası)
    var glMidX = (glX1 + glX2) / 2;
    var glMidY = Math.min(glY1, glY2) - 8;
    ctx.fillStyle = gl.color;
    ctx.font = '700 9px Segoe UI, sans-serif';
    ctx.textAlign = 'center';
    var glLabel = '%' + gl.grade.toFixed(2) + '  Δh:' + gl.deltaH.toFixed(1) + 'm';
    // Arka plan kutusu
    var glLabelW = ctx.measureText(glLabel).width + 8;
    ctx.fillStyle = 'rgba(15,18,24,0.8)';
    ctx.fillRect(glMidX - glLabelW / 2, glMidY - 9, glLabelW, 14);
    ctx.fillStyle = gl.color;
    ctx.fillText(glLabel, glMidX, glMidY + 1);
    // Numara
    ctx.fillStyle = 'rgba(15,18,24,0.85)';
    ctx.beginPath(); ctx.arc(glX1 + 10, glY1 - 10, 8, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = gl.color;
    ctx.font = '700 8px Segoe UI, sans-serif';
    ctx.fillText('' + (gli + 1), glX1 + 10, glY1 - 7);
  }

  // ── Waypoint referans noktaları ──
  _veWaypointRestore(nodeId);
  var wpList = _veRouteWaypoints[nodeId] || [];
  for(var wi = 0; wi < wpList.length; wi++) {
    var wp = wpList[wi];
    var wpX = toX(wp.dist);
    var wpElev = _veAltInterpElev(pts, wp.dist);
    var wpY = toY(wpElev);
    // Görünür alanda mı
    if(wpX < padL - 5 || wpX > W - padR + 5) continue;
    var wpColor = wp.auto ? '#4fc3f7' : _veWaypointColors[wi % _veWaypointColors.length];
    // Dikey kesikli çizgi
    ctx.strokeStyle = wpColor;
    ctx.lineWidth = 1.2;
    ctx.setLineDash([4, 3]);
    ctx.beginPath();
    ctx.moveTo(wpX, padT);
    ctx.lineTo(wpX, padT + plotH);
    ctx.stroke();
    ctx.setLineDash([]);
    // Profil üzerindeki nokta
    ctx.fillStyle = wpColor;
    ctx.beginPath(); ctx.arc(wpX, wpY, 4.5, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(wpX, wpY, 4.5, 0, Math.PI * 2); ctx.stroke();
    // İsim etiketi (üstte, çapraz)
    ctx.save();
    ctx.translate(wpX, padT + 4);
    ctx.rotate(-Math.PI / 4);
    ctx.font = '600 8px Segoe UI, sans-serif';
    ctx.textAlign = 'left';
    // Arka plan kutusu
    var wpLabel = wp.name;
    var wpLabelW = ctx.measureText(wpLabel).width + 6;
    ctx.fillStyle = 'rgba(15,18,24,0.82)';
    ctx.fillRect(-2, -9, wpLabelW, 12);
    ctx.fillStyle = wpColor;
    ctx.fillText(wpLabel, 1, 0);
    ctx.restore();
    // Mesafe etiketi (altta)
    ctx.font = '500 7px Segoe UI, sans-serif';
    ctx.fillStyle = wpColor;
    ctx.textAlign = 'center';
    ctx.globalAlpha = 0.7;
    ctx.fillText((wp.dist / 1000).toFixed(1) + 'km', wpX, padT + plotH + 10);
    ctx.globalAlpha = 1.0;
  }

  // ── Çizim önizleme (aktif çizgi çizme) ──
  if(canvas._altDrawPreview) {
    var dp = canvas._altDrawPreview;
    ctx.strokeStyle = dp.color;
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 3]);
    ctx.beginPath();
    ctx.moveTo(toX(dp.x1), toY(dp.y1));
    ctx.lineTo(toX(dp.x2), toY(dp.y2));
    ctx.stroke();
    ctx.setLineDash([]);
    // Başlangıç noktası
    ctx.fillStyle = dp.color;
    ctx.beginPath(); ctx.arc(toX(dp.x1), toY(dp.y1), 5, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(toX(dp.x2), toY(dp.y2), 4, 0, Math.PI * 2); ctx.fill();
    // Anlık eğim bilgisi (her zaman sol→sağ yönünde normalize)
    var pvDist = Math.abs(dp.x2 - dp.x1);
    if(pvDist > 0.5) {
      var pvLeftY = dp.x1 <= dp.x2 ? dp.y1 : dp.y2;
      var pvRightY = dp.x1 <= dp.x2 ? dp.y2 : dp.y1;
      var pvDh = pvLeftY - pvRightY;
      var pvGrade = (pvDh / pvDist) * 100;
      ctx.fillStyle = dp.color;
      ctx.font = '700 10px Segoe UI, sans-serif';
      ctx.textAlign = 'center';
      var pvLabel = '%' + pvGrade.toFixed(2) + '  Δh:' + pvDh.toFixed(1) + 'm  (' + pvDist.toFixed(0) + 'm)';
      var pvMidX = (toX(dp.x1) + toX(dp.x2)) / 2;
      var pvMidY = Math.min(toY(dp.y1), toY(dp.y2)) - 14;
      ctx.fillText(pvLabel, pvMidX, pvMidY);
    }
  }

  ctx.restore();

  // Etkileşim verisi
  canvas._drChart = {
    type: 'altProfile', pts: pts, gpsSamples: gpsSamples,
    padL: padL, padR: padR, padT: padT, padB: padB,
    plotW: plotW, plotH: plotH, xMin: xMin, xMax: xMax, yMin: yMin, yMax: yMax,
    baseXMin: baseXMin, baseXMax: baseXMax, baseYMin: baseYMin, baseYMax: baseYMax,
    fromX: fromX, fromY: fromY, W: W, H: H, totalDist: totalDist,
    nodeId: nodeId
  };

  // Event'leri bağla (bir kez)
  if(!canvas._drEventsAttached) {
    canvas._drEventsAttached = true;
    canvas.addEventListener('wheel', _drChartWheel, {passive: false});
    canvas.addEventListener('mousedown', _drChartMouseDown);
    canvas.addEventListener('mouseup', _drChartMouseUp);
    canvas.addEventListener('mousemove', _drChartMouseMove);
    canvas.addEventListener('mouseleave', _drChartMouseLeave);
    canvas.addEventListener('dblclick', _drChartDblClick);
    canvas.addEventListener('contextmenu', function(e) { e.preventDefault(); });
  }
}

// ═══ Eğim çizgisi çizme/silme yönetimi ═══
function veAltAddGradeLine(nodeId, x1, y1, x2, y2) {
  if(!_veAltGradeLines[nodeId]) _veAltGradeLines[nodeId] = [];
  var lines = _veAltGradeLines[nodeId];
  var color = _veAltGradeLineColors[lines.length % _veAltGradeLineColors.length];
  // Her zaman sol→sağ (rota yönü) olarak sırala
  var lx = Math.min(x1, x2), rx = Math.max(x1, x2);
  var ly = (x1 <= x2) ? y1 : y2;
  var ry = (x1 <= x2) ? y2 : y1;
  var dist = rx - lx;
  var deltaH = ly - ry; // pozitif = iniş (sol yüksek, sağ düşük)
  var grade = dist > 0.1 ? (deltaH / dist) * 100 : 0;
  lines.push({ x1: lx, y1: ly, x2: rx, y2: ry, grade: grade, dist: dist, deltaH: deltaH, color: color });
  _veAltPersistGradeLines(nodeId);
  return lines[lines.length - 1];
}

function veAltRemoveGradeLine(nodeId, index) {
  if(!_veAltGradeLines[nodeId]) return;
  _veAltGradeLines[nodeId].splice(index, 1);
  _veAltPersistGradeLines(nodeId);
}

function veAltClearGradeLines(nodeId) {
  _veAltGradeLines[nodeId] = [];
  _veAltPersistGradeLines(nodeId);
}

// Eğim çizgilerini node.data'ya kaydet (proje kaydı ve panel yenilenmesinde korunması için)
function _veAltPersistGradeLines(nodeId) {
  var node = nodes.find(function(n) { return n.id === nodeId; });
  if(!node) return;
  if(!node.data) node.data = {};
  var lines = _veAltGradeLines[nodeId] || [];
  node.data.gradeLines = lines.map(function(l) {
    return { x1: l.x1, y1: l.y1, x2: l.x2, y2: l.y2, grade: l.grade, dist: l.dist, deltaH: l.deltaH, color: l.color };
  });
}

// node.data'dan eğim çizgilerini geri yükle
function _veAltRestoreGradeLines(nodeId) {
  var node = nodes.find(function(n) { return n.id === nodeId; });
  if(!node || !node.data || !node.data.gradeLines || node.data.gradeLines.length === 0) return;
  if(_veAltGradeLines[nodeId] && _veAltGradeLines[nodeId].length > 0) return; // zaten yüklü
  _veAltGradeLines[nodeId] = node.data.gradeLines.map(function(l, i) {
    return {
      x1: l.x1, y1: l.y1, x2: l.x2, y2: l.y2,
      grade: l.grade, dist: l.dist, deltaH: l.deltaH,
      color: l.color || _veAltGradeLineColors[i % _veAltGradeLineColors.length]
    };
  });
}

function _veAltUpdateLineList(nodeId) {
  var listEl = document.getElementById('ve-alt-line-list-' + nodeId);
  if(!listEl) return;
  var lines = _veAltGradeLines[nodeId] || [];
  if(lines.length === 0) {
    listEl.innerHTML = '<div style="color:var(--text-muted); font-style:italic; font-size:0.58rem; padding:4px 0;">Henüz eğim çizgisi yok. Grafikte sol tık ile çizin.</div>';
    return;
  }
  var html = '<table style="width:100%; font-size:0.58rem; border-collapse:collapse;">';
  html += '<thead><tr style="background:var(--bg-tertiary);"><th style="padding:3px 4px; text-align:center; border-bottom:1px solid var(--border-color); width:24px;">#</th><th style="padding:3px 4px; text-align:right; border-bottom:1px solid var(--border-color);">Eğim</th><th style="padding:3px 4px; text-align:right; border-bottom:1px solid var(--border-color);">Δh</th><th style="padding:3px 4px; text-align:right; border-bottom:1px solid var(--border-color);">Mesafe</th><th style="padding:3px 4px; text-align:center; border-bottom:1px solid var(--border-color); width:24px;"></th></tr></thead><tbody>';
  for(var i = 0; i < lines.length; i++) {
    var l = lines[i];
    var egimIcon = l.grade > 1 ? '↓' : (l.grade < -1 ? '↑' : '→');
    html += '<tr style="border-bottom:1px solid var(--border-color);">';
    html += '<td style="padding:2px 4px; text-align:center;"><span style="display:inline-flex; align-items:center; justify-content:center; width:16px; height:16px; border-radius:50%; background:' + l.color + '; color:#000; font-size:0.5rem; font-weight:700;">' + (i + 1) + '</span></td>';
    html += '<td style="padding:2px 4px; text-align:right; font-weight:600; color:' + l.color + ';">' + egimIcon + ' %' + l.grade.toFixed(2) + '</td>';
    html += '<td style="padding:2px 4px; text-align:right;">' + l.deltaH.toFixed(1) + 'm</td>';
    html += '<td style="padding:2px 4px; text-align:right;">' + l.dist.toFixed(0) + 'm</td>';
    html += '<td style="padding:2px 4px; text-align:center;"><button onclick="veAltRemoveGradeLineUI(\'' + nodeId + '\',' + i + ')" style="background:none; border:none; cursor:pointer; color:var(--accent-danger); font-size:0.7rem; padding:0; line-height:1;" title="Sil">✕</button></td>';
    html += '</tr>';
  }
  html += '</tbody></table>';
  listEl.innerHTML = html;
}

function veAltRemoveGradeLineUI(nodeId, index) {
  veAltRemoveGradeLine(nodeId, index);
  _veAltUpdateLineList(nodeId);
  // Canvas'ları yeniden çiz
  _veAltRedrawAll(nodeId);
}

function veAltClearGradeLinesUI(nodeId) {
  veAltClearGradeLines(nodeId);
  _veAltUpdateLineList(nodeId);
  _veAltRedrawAll(nodeId);
}

function _veAltRedrawAll(nodeId) {
  var node = nodes.find(function(n) { return n.id === nodeId; });
  if(!node || !node.data || !node.data.gpsSamples) return;
  // Panel canvas
  var panelCanvas = document.getElementById('ve-road-altitude-canvas-' + nodeId);
  if(panelCanvas) veRenderAltitudeProfile('ve-road-altitude-canvas-' + nodeId, node.data.gpsSamples, nodeId);
  // Expanded canvas
  var expCanvas = document.getElementById('ve-road-altitude-expanded-' + nodeId);
  if(expCanvas) veRenderAltitudeProfile('ve-road-altitude-expanded-' + nodeId, node.data.gpsSamples, nodeId);
}

// ═══ Eğim segmentlerini Senaryolar bileşenine aktar ═══
function veTransferSegmentsToScenario(roadNodeId) {
  var lines = _veAltGradeLines[roadNodeId] || [];
  if(lines.length === 0) {
    showToast('Aktarılacak eğim çizgisi yok. Önce rakım profilinde çizgi çizin.', 'warning');
    return;
  }

  // Topolojideki scenario node'u bul
  var scenarioNode = nodes.find(function(n) { return n.type === 'scenario'; });
  if(!scenarioNode) {
    showToast('Topolojide Senaryolar bileşeni bulunamadı. Önce ekleyin.', 'warning');
    return;
  }
  if(!scenarioNode.data) scenarioNode.data = {};

  // Segmentleri sol→sağ sıralı olarak aktar
  var sorted = lines.slice().sort(function(a, b) { return a.x1 - b.x1; });
  var wps = _veRouteWaypoints[roadNodeId] || [];

  var segments = sorted.map(function(l, i) {
    var seg = {
      no: i + 1,
      grade: l.grade,
      distance: l.dist,
      deltaH: l.deltaH
    };
    // Segment başlangıç ve bitişine en yakın waypoint'leri bul
    if(wps.length > 0) {
      var startWp = _veFindNearestWaypoint(wps, l.x1);
      var endWp = _veFindNearestWaypoint(wps, l.x2);
      if(startWp) seg.startWaypoint = startWp.name;
      if(endWp && endWp.id !== (startWp && startWp.id)) seg.endWaypoint = endWp.name;
    }
    return seg;
  });

  scenarioNode.data.roadSegments = segments;
  // Waypoint'leri de senaryoya aktar
  scenarioNode.data.routeWaypoints = wps.map(function(w) {
    return { id: w.id, name: w.name, dist: w.dist, elev: w.elev, auto: w.auto };
  });

  // Road node'a da kaydet (proje kaydı ve restore için)
  var roadNode = nodes.find(function(n) { return n.id === roadNodeId; });
  if(roadNode) {
    if(!roadNode.data) roadNode.data = {};
    roadNode.data.routeSegments = segments;
  }

  // Properties paneli açıksa güncelle
  var segTable = document.getElementById('ve-scenario-segments-' + scenarioNode.id);
  if(segTable) {
    segTable.innerHTML = _veScenarioSegmentsTableHTML(segments);
    segTable.style.display = 'block';
  }

  showToast(segments.length + ' eğim segmenti Senaryolar bileşenine aktarıldı');
}

// Senaryo segmentleri tablo HTML'i
function _veScenarioSegmentsTableHTML(segments, editable) {
  if(!segments || segments.length === 0) return '';
  // Waypoint bilgisi var mı kontrol et
  var hasWaypoints = segments.some(function(s) { return s.startWaypoint || s.endWaypoint; });
  var html = '<table style="width:100%; font-size:0.62rem; border-collapse:collapse; border:1px solid var(--border-color);">';
  html += '<thead><tr style="background:var(--bg-tertiary);">' +
    '<th style="padding:4px 6px; text-align:center; border-bottom:1px solid var(--border-color); border-right:1px solid var(--border-color); width:28px;">#</th>';
  if(hasWaypoints) {
    html += '<th style="padding:4px 6px; text-align:left; border-bottom:1px solid var(--border-color); border-right:1px solid var(--border-color);">Güzergah</th>';
  }
  html += '<th style="padding:4px 6px; text-align:left; border-bottom:1px solid var(--border-color); border-right:1px solid var(--border-color);">Tip</th>' +
    '<th style="padding:4px 6px; text-align:right; border-bottom:1px solid var(--border-color); border-right:1px solid var(--border-color);">Eğim (%)</th>' +
    '<th style="padding:4px 6px; text-align:right; border-bottom:1px solid var(--border-color); border-right:1px solid var(--border-color);">Mesafe (m)</th>' +
    '<th style="padding:4px 6px; text-align:right; border-bottom:1px solid var(--border-color); border-right:1px solid var(--border-color);">Δh (m)</th>' +
    '<th style="padding:4px 6px; text-align:center; border-bottom:1px solid var(--border-color);">Komut</th>' +
    '</tr></thead><tbody>';
  for(var i = 0; i < segments.length; i++) {
    var s = segments[i];
    var egimIcon, egimLabel, egimColor;
    if(s.grade > 0.5) {
      egimIcon = '↓'; egimLabel = 'Yokuş aşağı'; egimColor = 'var(--accent-success)';
    } else if(s.grade < -0.5) {
      egimIcon = '↑'; egimLabel = 'Yokuş yukarı'; egimColor = 'var(--accent-danger)';
    } else {
      egimIcon = '→'; egimLabel = 'Düz yol'; egimColor = 'var(--text-secondary)';
    }
    var cmd = s.command || 'full_throttle';
    html += '<tr style="border-bottom:1px solid var(--border-color);">';
    html += '<td style="padding:3px 6px; text-align:center; border-right:1px solid var(--border-color); font-weight:600;">' + s.no + '</td>';
    if(hasWaypoints) {
      var routeLabel = '';
      if(s.startWaypoint && s.endWaypoint) routeLabel = s.startWaypoint + ' → ' + s.endWaypoint;
      else if(s.startWaypoint) routeLabel = s.startWaypoint + ' →';
      else if(s.endWaypoint) routeLabel = '→ ' + s.endWaypoint;
      html += '<td style="padding:3px 6px; text-align:left; border-right:1px solid var(--border-color); color:var(--accent-warning); font-size:0.56rem; max-width:120px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="' + routeLabel + '">' + routeLabel + '</td>';
    }
    html += '<td style="padding:3px 6px; text-align:left; border-right:1px solid var(--border-color); color:' + egimColor + '; white-space:nowrap;">' + egimIcon + ' ' + egimLabel + '</td>';
    html += '<td style="padding:3px 6px; text-align:right; border-right:1px solid var(--border-color); font-weight:600; color:' + egimColor + ';">' + s.grade.toFixed(2) + '</td>';
    html += '<td style="padding:3px 6px; text-align:right; border-right:1px solid var(--border-color);">' + s.distance.toFixed(0) + '</td>';
    html += '<td style="padding:3px 6px; text-align:right; border-right:1px solid var(--border-color);">' + s.deltaH.toFixed(1) + '</td>';
    if(editable) {
      html += '<td style="padding:2px 4px; text-align:center;"><select data-seg-idx="' + i + '" onchange="onVESegmentCommandChange(this)" style="padding:2px 4px; font-size:0.58rem; background:var(--bg-input); color:var(--text-primary); border:1px solid var(--border-color); border-radius:0;">';
      html += '<option value="full_throttle"' + (cmd === 'full_throttle' ? ' selected' : '') + '>Tam gaz</option>';
      html += '<option value="coast"' + (cmd === 'coast' ? ' selected' : '') + '>Gaz kesme</option>';
      html += '</select></td>';
    } else {
      var cmdLabel = cmd === 'coast' ? 'Gaz kesme' : 'Tam gaz';
      var cmdColor = cmd === 'coast' ? 'var(--accent-warning, #e65100)' : 'var(--accent-success)';
      html += '<td style="padding:3px 6px; text-align:center; font-weight:600; color:' + cmdColor + '; font-size:0.58rem;">' + cmdLabel + '</td>';
    }
    html += '</tr>';
  }
  html += '</tbody></table>';
  return html;
}

// ═══ Segment komut değişikliği (Tam gaz / Gaz kesme) ═══
function onVESegmentCommandChange(selectEl) {
  var idx = parseInt(selectEl.getAttribute('data-seg-idx'));
  var val = selectEl.value;
  var scenarioNode = nodes.find(function(n) { return n.type === 'scenario'; });
  if(!scenarioNode || !scenarioNode.data || !scenarioNode.data.roadSegments) return;
  if(idx >= 0 && idx < scenarioNode.data.roadSegments.length) {
    scenarioNode.data.roadSegments[idx].command = val;
  }
}

// ═══ Profil yönünü çevir ═══
function veAltReverseDirection(nodeId) {
  var node = nodes.find(function(n) { return n.id === nodeId; });
  if(!node || !node.data || !node.data.gpsSamples || node.data.gpsSamples.length < 2) {
    showToast('Çevrilecek veri yok', 'warning'); return;
  }

  // gpsSamples'ı ters çevir: elevation'ları reverse, distance'ları yeniden hesapla
  var samples = node.data.gpsSamples;
  var totalDist = samples[samples.length - 1].dist;
  var reversed = [];
  for(var i = samples.length - 1; i >= 0; i--) {
    reversed.push({
      dist: totalDist - samples[i].dist,
      elev: samples[i].elev,
      lat: samples[i].lat,
      lng: samples[i].lng
    });
  }
  node.data.gpsSamples = reversed;

  // routeElevations'ı da ters çevir
  if(node.data.routeElevations && node.data.routeElevations.length > 0) {
    node.data.routeElevations.reverse();
  }

  // routeSegments'ı ters çevir ve eğim sign'larını flip
  if(node.data.routeSegments && node.data.routeSegments.length > 0) {
    node.data.routeSegments.reverse();
    node.data.routeSegments.forEach(function(seg) {
      seg.egim = -seg.egim;
      seg.deltaH = -seg.deltaH;
    });
    // Ortalama eğimi de güncelle
    if(node.data.routeAvgGrade !== undefined) {
      node.data.routeAvgGrade = -node.data.routeAvgGrade;
    }
  }

  // Eğim çizgilerini temizle (yönle birlikte anlamını kaybeder)
  veAltClearGradeLines(nodeId);
  _veAltUpdateLineList(nodeId);

  // Waypoint'lerin mesafelerini tersine çevir
  var wps = _veRouteWaypoints[nodeId] || [];
  if(wps.length > 0) {
    var wpTotalDist = reversed[reversed.length - 1].dist;
    wps.forEach(function(w) {
      w.dist = wpTotalDist - w.dist;
      w.elev = _veAltInterpElev(reversed, w.dist);
      var ll = _veInterpLatLng(reversed, w.dist);
      w.lat = ll.lat; w.lng = ll.lng;
    });
    // Başlangıç/Bitiş isimlerini değiştir
    wps.forEach(function(w) {
      if(w.auto && w.name === 'Başlangıç') w.name = 'Bitiş';
      else if(w.auto && w.name === 'Bitiş') w.name = 'Başlangıç';
    });
    wps.sort(function(a, b) { return a.dist - b.dist; });
    _veWaypointPersist(nodeId);
    _veWaypointShowOnMap(nodeId);
  }

  // Zoom'ları sıfırla (çevirme sonrası garip görünmesin)
  var panelCanvasEl = document.getElementById('ve-road-altitude-canvas-' + nodeId);
  if(panelCanvasEl) { delete _drChartZoom['ve-road-altitude-canvas-' + nodeId]; }
  var expCanvasEl = document.getElementById('ve-road-altitude-expanded-' + nodeId);
  if(expCanvasEl) { delete _drChartZoom['ve-road-altitude-expanded-' + nodeId]; }

  // Yeniden çiz
  _veAltRedrawAll(nodeId);

  // Bilgi kutusundaki başlangıç/bitiş değerlerini güncelle
  var selInfo = document.getElementById('ve-alt-selection-info-' + nodeId);
  if(selInfo) {
    selInfo.innerHTML = '<span style="color:#1565c0; font-weight:600;">Yön çevrildi</span>';
    selInfo.style.fontStyle = 'normal';
  }

  showToast('Profil yönü çevrildi');
}


// ═══ Profil grafiği büyütme modalı ═══
function veExpandProfileChart(nodeId, chartType) {
  var node = nodes.find(function(n) { return n.id === nodeId; });
  if(!node || !node.data) { showToast('Profil verisi bulunamadı', 'warning'); return; }

  var isAlt = true; // Sadece rakım profili destekleniyor
  if(!node.data.gpsSamples || node.data.gpsSamples.length < 2) {
    showToast('GPS rakım verisi bulunamadı', 'warning'); return;
  }

  // Alttaki Özellikler modalı bu büyük chart'ın altında kalmasın → otomatik kapan
  if(typeof veTogglePropertiesPanel === 'function') veTogglePropertiesPanel(false);

  // Overlay
  var overlay = document.createElement('div');
  overlay.id = 've-profile-modal-overlay';
  overlay.style.cssText = 'position:fixed; inset:0; z-index:100001; background:rgba(0,0,0,0.85); display:flex; align-items:center; justify-content:center; padding:20px; backdrop-filter:blur(4px);';

  // Modal
  var modal = document.createElement('div');
  modal.style.cssText = 'width:100%; max-width:1200px; max-height:90vh; background:var(--bg-secondary,#0f1218); border:1px solid var(--border-color,#1c2333); border-radius:0; display:flex; flex-direction:column; overflow:hidden; box-shadow:0 20px 60px rgba(0,0,0,0.6);';

  // Header — ince ortak başlık
  var curSmooth = (node.data && node.data.smoothLevel !== undefined) ? node.data.smoothLevel : 2;
  var header = document.createElement('div');
  header.style.cssText = 'display:flex; align-items:center; justify-content:space-between; padding:5px 12px; background:var(--bg-tertiary); border-bottom:1px solid var(--border-color); flex-shrink:0;';
  header.innerHTML = '<span style="font-size:0.72rem; font-weight:700; color:var(--text-heading);"><span class="mf-ico mf-ico-bar-chart"></span> Rakım profili (GPS)</span>' +
    '<div style="display:flex; align-items:center; gap:8px;">' +
    '<div style="display:inline-flex; align-items:center; gap:3px;">' +
    '<label style="font-size:0.56rem; color:var(--text-muted);">Filtre:</label>' +
    '<select id="ve-road-smooth-' + nodeId + '" style="padding:2px 3px; font-size:0.56rem; background:var(--bg-input); color:var(--text-primary); border:1px solid var(--border-color); border-radius:0;">' +
    '<option value="0"' + (curSmooth === 0 ? ' selected' : '') + '>Yok</option>' +
    '<option value="1"' + (curSmooth === 1 ? ' selected' : '') + '>SavGol Hafif</option>' +
    '<option value="2"' + (curSmooth === 2 ? ' selected' : '') + '>SavGol Orta</option>' +
    '<option value="3"' + (curSmooth === 3 ? ' selected' : '') + '>SavGol Güçlü</option>' +
    '</select></div>' +
    '<button onclick="veUpdateProfilesExpanded(\'' + nodeId + '\')" style="padding:4px 10px; font-size:0.6rem; font-weight:600; background:#1b5e20; color:white; border:none; border-radius:0; cursor:pointer;">Güncelle</button>' +
    '<button onclick="veAltReverseDirection(\'' + nodeId + '\')" style="padding:4px 10px; font-size:0.6rem; font-weight:600; background:#1565c0; color:white; border:none; border-radius:0; cursor:pointer;">↔ Yönü çevir</button>' +
    '<button onclick="veCloseProfileModal()" title="Kapat (ESC)" style="width:28px; height:28px; display:flex; align-items:center; justify-content:center; background:transparent; border:1px solid var(--border-color); border-radius:0; cursor:pointer; font-size:0.9rem; color:var(--text-secondary); transition:all 0.12s;" onmouseover="this.style.background=\'var(--accent-danger)\';this.style.color=\'#fff\'" onmouseout="this.style.background=\'transparent\';this.style.color=\'var(--text-secondary)\'">✕</button></div>';
  modal.appendChild(header);

  // Chart container
  var chartBox = document.createElement('div');
  chartBox.style.cssText = 'padding:16px; position:relative;';
  var expandCanvasId = 've-road-' + (isAlt ? 'altitude' : 'distgrade') + '-expanded-' + nodeId;
  chartBox.innerHTML = '<canvas id="' + expandCanvasId + '" style="width:100%; cursor:crosshair; border-radius:0;"></canvas>' +
    '<div id="' + expandCanvasId + '-tooltip" class="dr-chart-tooltip"></div>';
  modal.appendChild(chartBox);

  // Altitude profile: eğim çizgileri kontrol paneli
  if(isAlt) {
    var controlBox = document.createElement('div');
    controlBox.style.cssText = 'padding:0 16px 16px 16px; display:flex; gap:12px; align-items:flex-start;';
    controlBox.innerHTML =
      '<div style="flex:1; min-width:0;">' +
        '<div style="display:flex; align-items:center; gap:8px; margin-bottom:6px;">' +
          '<span style="font-size:0.72rem; font-weight:600; color:var(--text-heading);"><span class="mf-ico mf-ico-ruler"></span> Eğim çizgileri</span>' +
          '<button onclick="veAltClearGradeLinesUI(\'' + nodeId + '\')" style="padding:3px 8px; font-size:0.56rem; background:var(--accent-danger); color:white; border:none; border-radius:0; cursor:pointer; opacity:0.8;" onmouseover="this.style.opacity=1" onmouseout="this.style.opacity=0.8">Tümünü sil</button>' +
          '<button onclick="veTransferSegmentsToScenario(\'' + nodeId + '\')" style="padding:3px 8px; font-size:0.56rem; background:var(--accent-primary, #3b82f6); color:white; border:none; border-radius:0; cursor:pointer; opacity:0.9; transition:all 0.12s;" onmouseover="this.style.opacity=1;this.style.boxShadow=\'0 1px 4px rgba(59,130,246,0.35)\'" onmouseout="this.style.opacity=0.9;this.style.boxShadow=\'none\'"><span class="mf-ico mf-ico-upload"></span> Senaryolara Aktar</button>' +
        '</div>' +
        '<div id="ve-alt-line-list-' + nodeId + '" style="max-height:140px; overflow-y:auto; border:1px solid var(--border-color); border-radius:0; padding:4px; background:var(--bg-tertiary);"></div>' +
      '</div>' +
      '<div style="flex:1; min-width:0;">' +
        '<div style="display:flex; align-items:center; gap:8px; margin-bottom:6px;">' +
          '<span style="font-size:0.72rem; font-weight:600; color:var(--text-heading);"><span class="mf-ico mf-ico-map-pin"></span> Referans Noktaları</span>' +
          '<button onclick="veWaypointClearAllUI(\'' + nodeId + '\')" style="padding:3px 8px; font-size:0.56rem; background:var(--accent-danger); color:white; border:none; border-radius:0; cursor:pointer; opacity:0.8;" onmouseover="this.style.opacity=1" onmouseout="this.style.opacity=0.8">Tümünü sil</button>' +
        '</div>' +
        '<div id="ve-wp-list-' + nodeId + '" style="max-height:140px; overflow-y:auto; border:1px solid var(--border-color); border-radius:0; padding:4px; background:var(--bg-tertiary);"></div>' +
        '<div style="font-size:0.5rem; color:var(--text-muted); margin-top:4px; opacity:0.7;">Haritada rota çizgisi üzerine tıklayarak referans noktası ekleyin</div>' +
      '</div>';
    modal.appendChild(controlBox);
  }

  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  // ESC kapatma
  var escHandler = function(e) { if(e.key === 'Escape') veCloseProfileModal(); };
  document.addEventListener('keydown', escHandler);
  overlay._veEscHandler = escHandler;
  overlay.addEventListener('mousedown', function(e) { if(e.target === overlay) veCloseProfileModal(); });

  // Render (büyük boyut)
  setTimeout(function() {
    var expandCanvas = document.getElementById(expandCanvasId);
    if(expandCanvas) {
      expandCanvas._dgExpandedH = 500;
      veRenderAltitudeProfile(expandCanvasId, node.data.gpsSamples, nodeId);
      // Eğim çizgisi çizme eventlerini bağla
      _veAltAttachDrawEvents(expandCanvas, nodeId);
      _veAltUpdateLineList(nodeId);
      _veWaypointUpdateList(nodeId);
    }
  }, 50);
}

// ═══ Büyük ekranda eğim çizgisi çizme event'leri ═══
function _veAltAttachDrawEvents(canvas, nodeId) {
  if(canvas._altDrawAttached) return;
  canvas._altDrawAttached = true;
  canvas._altDrawState = null; // null | {x1, y1} — ilk tıklama bekliyor veya başlangıç noktası seçildi

  // Mevcut çizgilerin uç noktalarına snap mesafesi (piksel)
  var SNAP_PX = 20;

  // En yakın çizgi uç noktasını bul (piksel mesafesine göre)
  function _findSnapEndpoint(d, mx) {
    var lines = _veAltGradeLines[nodeId] || [];
    if(lines.length === 0) return null;
    var bestDist = Infinity, bestSnap = null;
    for(var i = 0; i < lines.length; i++) {
      var l = lines[i];
      // Her çizginin başlangıç ve bitiş noktasını kontrol et
      var pts = [{x: l.x1, y: l.y1}, {x: l.x2, y: l.y2}];
      for(var j = 0; j < pts.length; j++) {
        var px = d.padL + (pts[j].x - d.xMin) / (d.xMax - d.xMin) * d.plotW;
        var dist = Math.abs(mx - px);
        if(dist < bestDist) { bestDist = dist; bestSnap = pts[j]; }
      }
    }
    return bestDist <= SNAP_PX ? bestSnap : null;
  }

  canvas.addEventListener('mousedown', function(e) {
    if(e.button !== 0) return; // sadece sol tık
    var d = canvas._drChart;
    if(!d || d.type !== 'altProfile') return;
    var rect = canvas.getBoundingClientRect();
    var mx = e.clientX - rect.left;
    var my = e.clientY - rect.top;
    // Sadece plot alanı içinde
    if(mx < d.padL || mx > d.W - d.padR || my < d.padT || my > d.padT + d.plotH) return;

    var xVal = d.fromX(mx);
    xVal = Math.max(0, Math.min(d.totalDist, xVal));
    var yVal = _veAltInterpElev(d.pts, xVal);

    // Mevcut çizgi uç noktasına snap
    var snap = _findSnapEndpoint(d, mx);
    if(snap) {
      xVal = snap.x;
      yVal = snap.y;
    }

    if(!canvas._altDrawState) {
      // İlk tıklama: başlangıç noktası
      var lines = _veAltGradeLines[nodeId] || [];
      var nextColor = _veAltGradeLineColors[lines.length % _veAltGradeLineColors.length];
      canvas._altDrawState = { x1: xVal, y1: yVal, color: nextColor };
      canvas._altDrawPreview = { x1: xVal, y1: yVal, x2: xVal, y2: yVal, color: nextColor };
      canvas.style.cursor = 'crosshair';
    } else {
      // İkinci tıklama: bitiş noktası → çizgiyi kaydet
      var state = canvas._altDrawState;
      veAltAddGradeLine(nodeId, state.x1, state.y1, xVal, yVal);
      _veAltUpdateLineList(nodeId);

      // Otomatik olarak eklenen çizginin sağ ucundan (x2, rota yönünde ileri) yeni çizgi başlat
      var lines2 = _veAltGradeLines[nodeId] || [];
      var lastLine = lines2[lines2.length - 1];
      var contX = lastLine.x2;
      var contY = lastLine.y2;
      var nextColor2 = _veAltGradeLineColors[lines2.length % _veAltGradeLineColors.length];
      canvas._altDrawState = { x1: contX, y1: contY, color: nextColor2 };
      canvas._altDrawPreview = { x1: contX, y1: contY, x2: contX, y2: contY, color: nextColor2 };
      canvas.style.cursor = 'crosshair';
      _veAltRedrawAll(nodeId);
    }
  });

  canvas.addEventListener('mousemove', function(e) {
    var d = canvas._drChart;
    if(!d) return;
    var rect = canvas.getBoundingClientRect();
    var mx = e.clientX - rect.left;

    if(!canvas._altDrawState) {
      // Çizim modunda değilken, uç noktaya yakınsa cursor değiştir
      var snap = _findSnapEndpoint(d, mx);
      canvas.style.cursor = snap ? 'pointer' : 'crosshair';
      return;
    }

    var xVal = d.fromX(mx);
    xVal = Math.max(0, Math.min(d.totalDist, xVal));
    var yVal = _veAltInterpElev(d.pts, xVal);

    // Snap kontrolü (çizim sırasında da)
    var snap2 = _findSnapEndpoint(d, mx);
    if(snap2) { xVal = snap2.x; yVal = snap2.y; }

    canvas._altDrawPreview = {
      x1: canvas._altDrawState.x1, y1: canvas._altDrawState.y1,
      x2: xVal, y2: yVal, color: canvas._altDrawState.color
    };
    _drRedrawChart(canvas);
  });

  // ESC ile çizimi iptal et
  document.addEventListener('keydown', function(e) {
    if(e.key === 'Escape' && canvas._altDrawState) {
      canvas._altDrawState = null;
      canvas._altDrawPreview = null;
      _drRedrawChart(canvas);
    }
  });

  // Sağ tık: çizim modundaysa iptal et
  canvas.addEventListener('contextmenu', function(e) {
    e.preventDefault();
    if(canvas._altDrawState) {
      canvas._altDrawState = null;
      canvas._altDrawPreview = null;
      _drRedrawChart(canvas);
    }
  });
}

function veCloseProfileModal() {
  var overlay = document.getElementById('ve-profile-modal-overlay');
  if(!overlay) return;
  if(overlay._veEscHandler) document.removeEventListener('keydown', overlay._veEscHandler);
  overlay.remove();
  // Panel canvas'ını da güncelle (modal'dan eklenen çizgiler panel'de de görünsün)
  // Tüm açık altitude canvas'larını yeniden çiz
  var allAltCanvases = document.querySelectorAll('[id^="ve-road-altitude-canvas-"]');
  allAltCanvases.forEach(function(c) {
    var d = c._drChart;
    if(d && d.type === 'altProfile' && d.nodeId) {
      _veAltRedrawAll(d.nodeId);
    }
  });
}

// Sonlandırıcı bileşeni özellikleri
function getTerminatorPropertiesHTML(node) {
  var html = '';
  
  // Açıklama
  html += '<div style="background:rgba(239,68,68,0.08); border:1px solid rgba(239,68,68,0.2); border-radius:0; padding:10px 12px; margin-bottom:12px;">';
  html += '<div style="font-size:0.72rem; color:var(--accent-danger); font-weight:600; margin-bottom:4px;">✂️ Hesap Sonlandırma Noktası</div>';
  html += '<div style="font-size:0.68rem; color:var(--text-secondary); line-height:1.5;">Bu bileşen, güç akış zincirini burada keser. Çözücü, bu noktaya kadar olan bileşenlerin hesabını yapar ve durur. Tam model kurmadan kısmi analizler yapmanızı sağlar.</div>';
  html += '</div>';
  
  // Bağlantı durumu - bu terminatöre gelen zinciri bul
  var inConn = connections.find(function(c) { return c.to === node.id; });
  
  if(!inConn) {
    html += '<div style="background:var(--bg-tertiary); border-radius:0; padding:12px; text-align:center;">';
    html += '<div style="font-size:0.75rem; color:var(--text-muted);">⚠️ Henüz bir bileşene bağlanmadı</div>';
    html += '<div style="font-size:0.65rem; color:var(--text-muted); margin-top:4px;">Bir bileşenin çıkış portuna bağlayın</div>';
    html += '</div>';
  } else {
    // Upstream zinciri bul
    var chain = [];
    var visited = {};
    function traceUpstream(nodeId) {
      if(visited[nodeId]) return;
      visited[nodeId] = true;
      var nd = nodes.find(function(n) { return n.id === nodeId; });
      if(!nd) return;
      // Sadece güç aktarım bileşenlerini dahil et
      var driveTypes = ['engine','torque-converter','gearbox','transfer','differential','wheel'];
      if(driveTypes.indexOf(nd.type) > -1) {
        chain.unshift(nd);
      }
      // Upstream'e git
      connections.forEach(function(c) {
        if(c.to === nodeId) traceUpstream(c.from);
      });
    }
    traceUpstream(inConn.from);
    
    html += '<div style="border-top:1px solid var(--border-color); padding-top:10px; margin-bottom:10px;">';
    html += '<div style="font-size:0.7rem; color:var(--text-muted); text-transform:uppercase; margin-bottom:8px;"><span class="mf-ico mf-ico-ruler"></span> Hesap Zinciri</div>';
    
    if(chain.length === 0) {
      html += '<div style="font-size:0.72rem; color:var(--text-muted);">Upstream güç bileşeni bulunamadı.</div>';
    } else {
      html += '<div style="display:flex; flex-direction:column; gap:2px;">';
      chain.forEach(function(nd, idx) {
        var def = componentDefs[nd.type] || {};
        var name = nd.customName || def.name || nd.type;
        var isLast = idx === chain.length - 1;
        html += '<div style="display:flex; align-items:center; gap:6px; padding:5px 8px; background:' + (isLast ? 'rgba(239,68,68,0.08)' : 'var(--bg-tertiary)') + '; border-radius:0; font-size:0.7rem;">';
        html += '<span style="color:var(--text-muted); font-size:0.6rem; width:14px; text-align:center;">' + (idx + 1) + '</span>';
        html += '<span style="color:var(--text-primary);">' + name + '</span>';
        if(isLast) {
          html += '<span style="margin-left:auto; font-size:0.6rem; color:var(--accent-danger);">← kesim noktası</span>';
        }
        html += '</div>';
        if(idx < chain.length - 1) {
          html += '<div style="text-align:center; color:var(--text-muted); font-size:0.6rem; line-height:1;">↓</div>';
        }
      });
      html += '</div>';
      
      // Bu noktada ölçülebilir sinyaller
      var lastNode = chain[chain.length - 1];
      var lastDef = componentDefs[lastNode.type] || {};
      html += '<div style="margin-top:10px; padding-top:8px; border-top:1px solid var(--border-color);">';
      html += '<div style="font-size:0.65rem; color:var(--text-muted); text-transform:uppercase; margin-bottom:6px;"><span class="mf-ico mf-ico-bar-chart"></span> Bu Noktada Ölçülebilir</div>';
      
      // Bileşen tipine göre çıkış sinyalleri
      var signals = [];
      if(lastNode.type === 'engine') {
        signals = ['Tork (Nm)', 'Güç (kW)', 'Devir (rpm)'];
      } else if(lastNode.type === 'torque-converter') {
        signals = ['Çıkış Torku (Nm)', 'Çıkış Devri (rpm)', 'Tork Oranı', 'Kayma Oranı'];
      } else if(lastNode.type === 'gearbox') {
        signals = ['Çıkış Torku (Nm)', 'Çıkış Devri (rpm)', 'Aktif Vites'];
      } else if(lastNode.type === 'transfer') {
        signals = ['Çıkış Torku (Nm)', 'Çıkış Devri (rpm)', 'Dağılım Oranı'];
      } else if(lastNode.type === 'differential') {
        signals = ['Yarım Aks Torku (Nm)', 'Yarım Aks Devri (rpm)'];
      } else if(lastNode.type === 'wheel') {
        signals = ['Tekerlek Torku (Nm)', 'Tekerlek Devri (rpm)', 'Çekiş Kuvveti (N)'];
      }
      
      if(signals.length > 0) {
        html += '<div style="display:flex; flex-wrap:wrap; gap:4px;">';
        signals.forEach(function(s) {
          html += '<span style="font-size:0.62rem; background:var(--bg-tertiary); border:1px solid var(--border-color); padding:2px 7px; border-radius:0; color:var(--text-secondary);">' + s + '</span>';
        });
        html += '</div>';
      }
      html += '</div>';
    }
    html += '</div>';
  }
  
  return html;
}

// Varsayılan özellikler
function getDefaultPropertiesHTML(node) {
  var html = '<div style="border-top:1px solid var(--border-color); padding-top:12px;">';
  html += '<div style="font-size:0.7rem; color:var(--text-muted); text-transform:uppercase; margin-bottom:8px;">Parametreler</div>';
  html += '<div style="font-size:0.8rem; color:var(--text-secondary);">Bu bileşen için henüz parametre tanımlanmamış.</div>';
  html += '</div>';
  return html;
}

function veEditNodeName(nodeId) {
  var node = nodes.find(function(n) { return n.id === nodeId; });
  if(!node) return;
  
  var currentName = node.customName || node.def.name;
  var nameDisplay = document.getElementById('ve-node-name-display-' + nodeId);
  if(!nameDisplay) return;
  
  // Inline edit - mevcut span'ı input'a çevir
  var input = document.createElement('input');
  input.type = 'text';
  input.value = currentName;
  input.style.cssText = 'width:120px; padding:2px 6px; font-size:0.8rem; font-weight:600; text-align:center; background:var(--bg-input); color:var(--text-primary); border:1px solid var(--accent-primary); border-radius:0; outline:none;';
  
  nameDisplay.textContent = '';
  nameDisplay.appendChild(input);
  input.focus();
  input.select();
  
  function applyName() {
    var newName = input.value.trim();
    if(newName === '') newName = node.def.name;
    node.customName = newName;
    nameDisplay.textContent = newName;
    
    var nodeEl = document.getElementById(nodeId);
    if(nodeEl) {
      var label = nodeEl.querySelector('.ve-node-label');
      if(label) label.textContent = newName;
    }
    showToast('İsim güncellendi: ' + newName);
  }
  
  input.addEventListener('blur', applyName);
  input.addEventListener('keydown', function(e) {
    if(e.key === 'Enter') { e.preventDefault(); input.blur(); }
    if(e.key === 'Escape') { input.value = currentName; input.blur(); }
  });
}

// Bileşen özellikleri MODAL toggle — overlay fade-in/out yönetir.
// forceState true → aç; false → kapat; undefined → toggle.
// Race-safe: hızlı kapat→aç sıralarında bekleyen close timeout'unun yeni
// open'ı bozmasını engeller (visible class kontrolü ile).
function veTogglePropertiesPanel(forceState) {
  var ov = document.getElementById('ve-properties-overlay');
  if(!ov) return;
  var isVisible = ov.classList.contains('visible');
  var open = (typeof forceState === 'boolean') ? forceState : !isVisible;
  if(open) {
    if(ov.style.display !== 'flex') {
      // Tamamen kapalıydı → display set, sonra rAF ile visible (geçiş 0→1)
      ov.style.display = 'flex';
      requestAnimationFrame(function() {
        requestAnimationFrame(function() { ov.classList.add('visible'); });
      });
    } else if(!isVisible) {
      // Kapanma sürecinde tekrar açıldı (display hâlâ flex) → visible'ı geri ekle
      ov.classList.add('visible');
    }
  } else {
    if(!isVisible) return;
    ov.classList.remove('visible');
    setTimeout(function() {
      // 220ms sonra hâlâ visible değilse gerçekten kapat (race-safe)
      if(!ov.classList.contains('visible')) ov.style.display = 'none';
    }, 220);
  }
}
// ESC: modal açıksa kapat (input/textarea içinde değilse)
document.addEventListener('keydown', function(e) {
  if(e.key !== 'Escape') return;
  var t = e.target;
  if(t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
  var ov = document.getElementById('ve-properties-overlay');
  if(ov && ov.style.display === 'flex') veTogglePropertiesPanel(false);
});

function showMultipleSelection() {
  var content = document.querySelector('.ve-properties-content');
  if(!content) return;

  var html = '<div style="text-align:center; padding:20px;">';
  html += '<div style="font-size:2rem; margin-bottom:12px;"><span class="mf-ico mf-ico-package"></span></div>';
  html += '<div style="font-weight:600; color:var(--text-heading); margin-bottom:8px;">' + selectedNodes.length + ' bileşen seçili</div>';
  html += '<div style="margin-top:16px;">';
  html += '<button onclick="deleteSelectedNodes()" style="width:100%; padding:8px; background:var(--accent-danger); color:white; border:none; border-radius:0; cursor:pointer; font-size:0.8rem;"><span class="mf-ico mf-ico-trash"></span> Seçilenleri Sil</button>';
  html += '</div>';
  html += '</div>';

  content.innerHTML = html;
  // Modal otomatik açılmaz — kullanıcı çift tık ile veya marker'a tıklayarak açar
}

function showEmptyProperties() {
  var content = document.querySelector('.ve-properties-content');
  if(!content) return;
  // Seçim yok → modal'ı kapat
  veTogglePropertiesPanel(false);

  content.innerHTML = '<div class="ve-prop-empty"><div class="ve-prop-empty-icon"><span class="mf-ico mf-ico-mouse-pointer"></span></div><div>Bir bileşen seçin</div><small style="color:var(--text-muted);">Özellikleri burada açılır</small></div>';
}

function deleteSelectedNodes() {
  // TC ↔ Şanzıman bağlıyken Şanzıman Kontrol silinemez
  if(veIsTCConnectedToGearbox()) {
    var hasMandatory = selectedNodes.some(function(n) { return n.type === 'shift-controller'; });
    if(hasMandatory) {
      showToast('Tork Konvertörü şanzımana bağlıyken Şanzıman Kontrol bileşeni zorunludur, silinemez', 'error');
      selectedNodes = selectedNodes.filter(function(n) { return n.type !== 'shift-controller'; });
      if(selectedNodes.length === 0) return;
    }
  }
  selectedNodes.forEach(function(node) {
    // Silinecek bağlantıları bul
    var deadConnIds = connections.filter(function(c) {
      return c.from === node.id || c.to === node.id;
    }).map(function(c) { return c.id; });
    
    // Bu bağlantılara bağlı sensörleri kopar
    deadConnIds.forEach(function(cid) {
      nodes.forEach(function(n) {
        if(n.type === 'sensor' && n.data && n.data.attachedConnection === cid) {
          n.data.attachedConnection = '';
          n.data.selectedSignal = '';
        }
      });
    });
    
    // Bu bileşene doğrudan bağlı sensörleri kopar (vehicle/road/scenario)
    nodes.forEach(function(n) {
      if(n.type === 'sensor' && n.data && n.data.attachedComponent === node.id) {
        n.data.attachedComponent = '';
        n.data.selectedSignal = '';
      }
    });
    
    // Parametrik analizdeki referansları temizle
    nodes.forEach(function(n) {
      if(n.type === 'parametric' && n.data && n.data.params) {
        n.data.params = n.data.params.filter(function(p) { return p.compId !== node.id; });
      }
    });
    
    // Node'a bağlı connectionları sil
    connections = connections.filter(function(c) {
      return c.from !== node.id && c.to !== node.id;
    });
    
    // Node'u sil
    var nodeEl = document.getElementById(node.id);
    if(nodeEl) nodeEl.remove();
    
    nodes = nodes.filter(function(n) { return n.id !== node.id; });
  });
  
  selectedNodes = [];
  showEmptyProperties();
  updateAllConnections();
  updateNodeCount();
}

function updateNodeCount() {
  var countEl = document.querySelector('.ve-toolbar-info');
  if(countEl) {
    countEl.innerHTML = nodes.length + ' bileşen, ' + connections.length + ' bağlantı';
  }
}

