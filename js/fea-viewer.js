// ============================================================================
// FEA 3D VIEWER (Three.js tabanlı)
// ============================================================================
// Yapısal Analiz bileşenlerinin 3D sahnesini yöneten modül.
// F2 kapsamı: boş sahne (grid + axes + ışıklar) + manuel orbit/pan/zoom +
// tam ekran modal. F3-F6 ile geometri, mesh, kontur eklenecek.
//
// Public API:
//   veFEAInitViewer(canvas, opts)        → viewer instance döner
//   veFEAInitGeometryViewerForNode(id)   → cp-core dispatcher köprüsü
//   veFEAOpenFullscreenViewer(nodeId)    → tam ekran modal açar
// ============================================================================

// Aktif viewer kayıtları — panel her açıldığında eski viewer dispose edilir
var veFEAViewerRegistry = {};

// Standart CAD görünümlerinin kamera yönü (target'tan kameraya bakar).
// Renderer Y-up varsayar; Top/Bottom'da kamera up vektörü -Z/+Z olarak
// ayarlanir ki ekran düzleminde gimbal lock yaşanmasın.
var VE_FEA_STANDARD_VIEWS = {
  iso:    { dir: [ 1,  1,  1], up: [0, 1, 0] },
  top:    { dir: [ 0,  1,  0], up: [0, 0, -1] },
  bottom: { dir: [ 0, -1,  0], up: [0, 0,  1] },
  front:  { dir: [ 0,  0,  1], up: [0, 1,  0] },
  back:   { dir: [ 0,  0, -1], up: [0, 1,  0] },
  right:  { dir: [ 1,  0,  0], up: [0, 1,  0] },
  left:   { dir: [-1,  0,  0], up: [0, 1,  0] }
};

// Arka plan rengi preset'leri
var VE_FEA_BG_PRESETS = {
  dark:  0x1a1a1a,
  light: 0xe8e8e8,
  white: 0xffffff,
  blue:  0x1e3a5f
};

// Aktif program temasının arka plan rengini döner. CSS değişkeninden okur
// (--fea-viewer-bg varsa onu, yoksa --bg-tertiary). THREE.Color hem hex
// sayıyı hem CSS renk string'ini ('#151a22', 'rgb(...)') ayrıştırabildiği
// için dönüş değeri doğrudan new THREE.Color(...) içine verilebilir.
// DOM yoksa (ör. jsdom testleri) güvenli varsayılana (koyu) düşer.
function veFEAGetThemeBackgroundColor() {
  if (typeof document !== 'undefined' && document.documentElement &&
      typeof getComputedStyle === 'function') {
    try {
      var cs = getComputedStyle(document.documentElement);
      var raw = (cs.getPropertyValue('--fea-viewer-bg') ||
                 cs.getPropertyValue('--bg-tertiary') || '').trim();
      if (raw) return raw;
    } catch (e) {}
  }
  return 0x1a1a1a;
}

// Tema değiştiğinde tüm aktif viewer'ların arka planını günceller. Yalnızca
// temaya bağlı (kullanıcı elle bir preset seçmemiş) viewer'lar güncellenir.
// theme.js içindeki changeTheme() bunu çağırır.
function veFEAApplyThemeToViewers() {
  if (typeof veFEAViewerRegistry === 'undefined' || !veFEAViewerRegistry) return;
  Object.keys(veFEAViewerRegistry).forEach(function(key) {
    var entry = veFEAViewerRegistry[key];
    if (!entry) return;
    // Registry hem viewer'ları hem de {viewer, dispose} sarmalayıcılarını
    // (fullscreen) tutar — ikisini de destekle.
    var v = (typeof entry.setBackground === 'function') ? entry : entry.viewer;
    if (v && v._isThemeBackground && typeof v.setBackground === 'function') {
      v.setBackground('theme');
    }
  });
}

// Edges hesaplama eşiği — bunun üzerinde mesh için edges atlanır (performans)
var VE_FEA_EDGES_MAX_VERTICES = 30000;

// Bir mesh'e edges line'ı lazy olarak ekler. setDisplayMode 'shaded-edges'
// seçildiğinde visible=true yapılır.
function _veFEAEnsureEdges(mesh) {
  if (!mesh || !mesh.geometry || typeof THREE === 'undefined') return;
  if (mesh.userData.feaEdgesAttached) return;
  var posAttr = mesh.geometry.attributes && mesh.geometry.attributes.position;
  var vertexCount = posAttr ? posAttr.count : 0;
  if (vertexCount === 0 || vertexCount > VE_FEA_EDGES_MAX_VERTICES) {
    mesh.userData.feaEdgesAttached = true; // çok büyük — bir daha denemiyoruz
    return;
  }
  var edgesGeo = new THREE.EdgesGeometry(mesh.geometry, 30);
  var line = new THREE.LineSegments(
    edgesGeo,
    new THREE.LineBasicMaterial({ color: 0x102444 })
  );
  line.userData.feaEdges = true;
  line.visible = false; // setDisplayMode kontrol edecek
  mesh.add(line);
  mesh.userData.feaEdgesAttached = true;
}

// Mesh ve alt mesh'lerin material.clippingPlanes alanını günceller.
function _veFEAApplyClipPlanesToObject(object, planes) {
  if (!object) return;
  var active = planes && planes.length ? planes : null;
  object.traverse(function(obj) {
    if (obj.isMesh && obj.material) {
      var mats = Array.isArray(obj.material) ? obj.material : [obj.material];
      mats.forEach(function(m) {
        m.clippingPlanes = active;
        m.clipShadows = !!active;
        m.needsUpdate = true;
      });
    }
  });
}

function veFEAHasThree() {
  return typeof window !== 'undefined' && typeof window.THREE !== 'undefined';
}

// ─── Ana viewer kurulumu ────────────────────────────────────────────────────
function veFEAInitViewer(canvas, opts) {
  if(!veFEAHasThree()) {
    console.warn('[FEA] Three.js yüklenmemiş — viewer başlatılamıyor');
    return null;
  }
  if(!canvas) return null;

  opts = opts || {};
  var width = opts.width || canvas.clientWidth || 240;
  var height = opts.height || canvas.clientHeight || 180;

  // Arka plan: opts.background verilmemişse aktif temadan türet. usingThemeBg
  // bilgisi viewer nesnesinde saklanır; tema değişince yalnızca bu viewer'lar
  // otomatik güncellenir (kullanıcının elle seçtiği preset korunur).
  var usingThemeBg = (opts.background == null);
  var resolvedBg = usingThemeBg ? veFEAGetThemeBackgroundColor() : opts.background;

  var scene = new THREE.Scene();
  scene.background = new THREE.Color(resolvedBg);

  var camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 5000);
  camera.position.set(60, 50, 90);

  // WebGLRenderer constructor THREE.js içinde gl.getShaderPrecisionFormat()
  // çağırır; context limit aşılırsa (Chrome ~16 concurrent) null döner ve
  // "Cannot read properties of null (reading 'precision')" hatası verir.
  // try/catch ile yakalıyoruz — kullanıcı sayfayı yenilemeden eski state'i
  // korur. Çağıran (veFEAInitGeometryViewerForNode) null dönüşü handle eder.
  var renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
  } catch (e) {
    console.warn('[FEA] WebGLRenderer başlatılamadı (context limiti? GPU kayıp?):', e.message);
    return null;
  }
  if (!renderer || !renderer.getContext || !renderer.getContext()) {
    console.warn('[FEA] WebGL context alınamadı — viewer başlatılamıyor.');
    if (renderer && renderer.dispose) try { renderer.dispose(); } catch (e) {}
    return null;
  }
  renderer.setSize(width, height, false);
  renderer.setPixelRatio(window.devicePixelRatio || 1);
  renderer.localClippingEnabled = true; // material.clippingPlanes etkili olsun

  // Işıklar (sahnede grid/axes yok — sadece geometri ve aydınlatma)
  scene.add(new THREE.AmbientLight(0xffffff, 0.55));
  var dir = new THREE.DirectionalLight(0xffffff, 0.85);
  dir.position.set(80, 120, 60);
  scene.add(dir);

  // Sahneye orbit hedefi
  var target = new THREE.Vector3(0, 0, 0);
  camera.lookAt(target);

  // Opsiyonel: Coordinate gizmo (sağ alt köşede mini XYZ ekseni)
  // Sadece fullscreen modal'da etkin. Ana sahne render edildikten sonra
  // viewport split (scissor) ile küçük bir bölgeye çizilir.
  var gizmoScene = null;
  var gizmoCamera = null;
  if (opts.gizmo) {
    gizmoScene = new THREE.Scene();
    gizmoCamera = new THREE.PerspectiveCamera(50, 1, 0.1, 100);
    gizmoScene.add(new THREE.AxesHelper(1.4));
    // Eksen uçlarına renkli toplar — yön daha belirgin
    var sphereGeo = new THREE.SphereGeometry(0.18, 12, 12);
    [['x', 0xff4444, [1.4, 0, 0]],
     ['y', 0x44ff44, [0, 1.4, 0]],
     ['z', 0x4488ff, [0, 0, 1.4]]].forEach(function(item) {
      var s = new THREE.Mesh(sphereGeo, new THREE.MeshBasicMaterial({ color: item[1] }));
      s.position.set(item[2][0], item[2][1], item[2][2]);
      gizmoScene.add(s);
    });
  }

  // Render fonksiyonu — gerektiğinde çağrılır (on-demand)
  function render() {
    var w = canvas.width || width;
    var h = canvas.height || height;
    // Ana sahne
    renderer.setViewport(0, 0, w, h);
    renderer.setScissor(0, 0, w, h);
    renderer.setScissorTest(false);
    renderer.render(scene, camera);

    // Gizmo overlay (sağ alt 80×80 px)
    if (gizmoScene && gizmoCamera) {
      var gSize = 80;
      var gx = w - gSize - 12;
      var gy = 12; // WebGL alt-sol orijinli
      // Ana kameranın yönünü gizmo kamerasına ata
      var dir = new THREE.Vector3().subVectors(camera.position, target);
      if (dir.lengthSq() < 1e-6) dir.set(1, 1, 1);
      dir.normalize().multiplyScalar(3.5);
      gizmoCamera.position.copy(dir);
      gizmoCamera.up.copy(camera.up);
      gizmoCamera.lookAt(0, 0, 0);

      renderer.autoClear = false;
      renderer.setViewport(gx, gy, gSize, gSize);
      renderer.setScissor(gx, gy, gSize, gSize);
      renderer.setScissorTest(true);
      renderer.clearDepth();
      renderer.render(gizmoScene, gizmoCamera);
      renderer.autoClear = true;
      renderer.setScissorTest(false);
    }
  }

  // Manuel orbit/pan/zoom
  var orbitHandle = veFEAAttachOrbitControls(canvas, camera, target, render);

  // İlk render
  render();

  var viewer = {
    scene: scene,
    camera: camera,
    renderer: renderer,
    target: target,
    render: render,
    // F2b: Geometri katmanı — primitifler / STL / STEP burada yaşar.
    // Sahnenin diğer öğelerinden (grid, axes, ışıklar) ayrı tutulur ki
    // clearGeometry() yardımcıları silmesin.
    _geometryRoot: (function() {
      var root = new THREE.Group();
      root.name = 'feaGeometryRoot';
      scene.add(root);
      return root;
    })(),
    loadPrimitive: function(type, params) {
      if(typeof veFEABuildPrimitiveMesh !== 'function') return null;
      this.clearGeometry();
      var mesh = veFEABuildPrimitiveMesh(type, params);
      if(!mesh) return null;
      this._geometryRoot.add(mesh);
      _veFEAEnsureEdges(mesh);
      this._applyDisplayState(mesh);
      // Face selection için materyal haritası çıkar (faceId → THREE.Material)
      this._collectFaceMaterials();
      this.zoomToFit(mesh);
      return mesh;
    },
    // Geometri yedirildikten sonra her face'in materyalini topla. Hover/select
    // sırasında emissive ile vurgulama için doğrudan referans tutulur.
    _faceMaterials: null,
    _hoveredFaceId: null,
    _selectedFaceId: null,
    _collectFaceMaterials: function() {
      var map = {};
      var self = this;
      this._geometryRoot.traverse(function(obj) {
        if (!obj.isMesh) return;
        // Multi-material mesh (Box/Cylinder) — feaFaceMap ile material array eşle
        if (obj.userData.feaFaceMap && Array.isArray(obj.material)) {
          obj.userData.feaFaceMap.forEach(function(faceId, idx) {
            if (faceId && obj.material[idx]) map[faceId] = obj.material[idx];
          });
        }
        // Group child (Shaft/RectTube) — userData.feaFaceId
        if (obj.userData.feaFaceId && obj.material) {
          map[obj.userData.feaFaceId] = obj.material;
        }
      });
      this._faceMaterials = map;
      // Önceki seçim varsa renkleri tazele (yedirme sonrası emissive sıfırlanır)
      if (this._selectedFaceId) this._applyFaceColors();
    },
    _applyFaceColors: function() {
      if (!this._faceMaterials) return;
      var sel = this._selectedFaceId;
      var hov = this._hoveredFaceId;
      var scan = this._scanState;
      Object.keys(this._faceMaterials).forEach(function(fid) {
        var mat = this._faceMaterials[fid];
        if (!mat || !mat.emissive) return;
        // Scan modu — topoloji tarama animasyonu sırasında tespit edilen
        // yüzeyler yeşil yanar (seçim/hover'dan önceliklidir).
        if (scan && scan.faces && scan.faces[fid]) {
          mat.emissive.setHex(scan.faceColor || 0x22c55e);
          mat.emissiveIntensity = 0.9;   // belirgin yeşil glow
          mat.needsUpdate = true;
          return;
        }
        if (fid === sel) {
          mat.emissive.setHex(0xfbbf24);   // sarı — seçili
          mat.emissiveIntensity = 0.55;
        } else if (fid === hov) {
          mat.emissive.setHex(0x2dd4bf);   // cyan-yeşil — hover
          mat.emissiveIntensity = 0.4;
        } else {
          mat.emissive.setHex(0x000000);
          mat.emissiveIntensity = 1;
        }
        mat.needsUpdate = true;
      }.bind(this));
      render();
    },
    setHoveredFace: function(faceId) {
      if (this._hoveredFaceId === faceId) return;
      this._hoveredFaceId = faceId;
      this._applyFaceColors();
    },
    setSelectedFace: function(faceId) {
      if (this._selectedFaceId === faceId) return;
      this._selectedFaceId = faceId;
      this._applyFaceColors();
    },
    getSelectedFace: function() { return this._selectedFaceId; },
    // ─── Edge highlight (yeni topology motoru — polyline tabanlı) ───────────
    _topologyEdges: null,        // topology.edges[] referansı
    _topologyVertices: null,     // topology.vertices[] referansı
    _edgeHighlightGroup: null,   // sahnedeki ek LineSegments grubu
    _vertexHighlightGroup: null, // sahnedeki vertex marker grubu
    _selectedEdgeId: null,
    _hoveredEdgeId: null,
    _selectedVertexId: null,
    _hoveredVertexId: null,
    setTopologyData: function(topology) {
      this._topologyEdges = (topology && Array.isArray(topology.edges)) ? topology.edges : null;
      this._topologyVertices = (topology && Array.isArray(topology.vertices)) ? topology.vertices : null;
      this._refreshEdgeHighlights();
      this._refreshVertexHighlights();
    },
    _refreshEdgeHighlights: function() {
      // Temizle
      if (this._edgeHighlightGroup) {
        this._geometryRoot.remove(this._edgeHighlightGroup);
        this._edgeHighlightGroup.traverse(function(o) {
          if (o.geometry && o.geometry.dispose) o.geometry.dispose();
          if (o.material && o.material.dispose) o.material.dispose();
        });
        this._edgeHighlightGroup = null;
      }
      if (!this._topologyEdges || this._topologyEdges.length === 0) { render(); return; }
      var grp = new THREE.Group();
      grp.name = 'feaEdgeHighlights';
      grp.userData.feaEdgeOverlay = true;
      var self = this;
      this._topologyEdges.forEach(function(e) {
        var pts = e.polyline;
        if (!pts || pts.length < 2) {
          // Tek line endpoint çifti varsa polyline üret
          if (e.p1 && e.p2) pts = [e.p1, e.p2];
          else return;
        }
        var flat = new Float32Array(pts.length * 3);
        for (var i = 0; i < pts.length; i++) {
          flat[i*3] = pts[i][0]; flat[i*3+1] = pts[i][1]; flat[i*3+2] = pts[i][2];
        }
        var geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.BufferAttribute(flat, 3));
        var isSel = (self._selectedEdgeId === e.id);
        var isHov = (self._hoveredEdgeId === e.id);
        var scan = self._scanState;
        var isScan = !!(scan && scan.edges && scan.edges[e.id]);
        var color, lineWidth, opacity, renderOrder;
        if (isScan) {
          // Scan modu — kenar tarama fazı (cyan)
          color = scan.edgeColor || 0x06d6f5;
          lineWidth = 3; opacity = 1; renderOrder = 1000;
        } else if (isSel) {
          color = 0xfbbf24; lineWidth = 3; opacity = 1; renderOrder = 1000;
        } else if (isHov) {
          color = 0x2dd4bf; lineWidth = 3; opacity = 1; renderOrder = 1000;
        } else {
          color = 0x60a5fa; lineWidth = 1.4; opacity = 0; renderOrder = 200;
        }
        var mat = new THREE.LineBasicMaterial({
          color: color, linewidth: lineWidth, transparent: opacity < 1, opacity: opacity
        });
        var line = new THREE.Line(geo, mat);
        line.userData.feaEdgeId = e.id;
        line.renderOrder = renderOrder;
        grp.add(line);
      });
      this._geometryRoot.add(grp);
      this._edgeHighlightGroup = grp;
      render();
    },
    _refreshVertexHighlights: function() {
      if (this._vertexHighlightGroup) {
        this._geometryRoot.remove(this._vertexHighlightGroup);
        this._vertexHighlightGroup.traverse(function(o) {
          if (o.geometry && o.geometry.dispose) o.geometry.dispose();
          if (o.material && o.material.dispose) o.material.dispose();
        });
        this._vertexHighlightGroup = null;
      }
      if (!this._topologyVertices || this._topologyVertices.length === 0) { render(); return; }
      // Bbox'tan marker boyutu çıkar
      var bb = new THREE.Box3().setFromObject(this._geometryRoot);
      var bbSize = bb.isEmpty() ? 50 : Math.max(bb.getSize(new THREE.Vector3()).x, bb.getSize(new THREE.Vector3()).y, bb.getSize(new THREE.Vector3()).z);
      var markerR = Math.max(0.5, bbSize * 0.012);
      var grp = new THREE.Group();
      grp.name = 'feaVertexHighlights';
      grp.userData.feaVertexOverlay = true;
      var self = this;
      this._topologyVertices.forEach(function(v) {
        var pos = v.position;
        if (!pos || pos.length < 3) return;
        var isSel = (self._selectedVertexId === v.id);
        var isHov = (self._hoveredVertexId === v.id);
        var scan = self._scanState;
        var isScan = !!(scan && scan.vertices && scan.vertices[v.id]);
        // Default: küçük dot. Selected: büyük sarı küre. Hover: orta turkuaz. Scan: sarı.
        var emph = isSel || isHov || isScan;
        var size = emph ? markerR * 1.6 : markerR * 0.55;
        var color = isScan ? (scan.vertexColor || 0xfbbf24) : (isSel ? 0xfbbf24 : (isHov ? 0x2dd4bf : 0x94a3b8));
        var op = emph ? 1.0 : 0.55;
        var sg = new THREE.SphereGeometry(size, 12, 12);
        var sm = new THREE.MeshBasicMaterial({ color: color, transparent: op < 1, opacity: op, depthTest: !emph });
        var mesh = new THREE.Mesh(sg, sm);
        mesh.position.set(pos[0], pos[1], pos[2]);
        mesh.userData.feaVertexId = v.id;
        mesh.renderOrder = emph ? 1001 : 150;
        grp.add(mesh);
      });
      this._geometryRoot.add(grp);
      this._vertexHighlightGroup = grp;
      render();
    },
    setSelectedEdge: function(edgeId) {
      if (this._selectedEdgeId === edgeId) return;
      this._selectedEdgeId = edgeId;
      this._refreshEdgeHighlights();
    },
    setHoveredEdge: function(edgeId) {
      if (this._hoveredEdgeId === edgeId) return;
      this._hoveredEdgeId = edgeId;
      this._refreshEdgeHighlights();
    },
    getSelectedEdge: function() { return this._selectedEdgeId; },
    setSelectedVertex: function(vertexId) {
      if (this._selectedVertexId === vertexId) return;
      this._selectedVertexId = vertexId;
      this._refreshVertexHighlights();
    },
    setHoveredVertex: function(vertexId) {
      if (this._hoveredVertexId === vertexId) return;
      this._hoveredVertexId = vertexId;
      this._refreshVertexHighlights();
    },
    getSelectedVertex: function() { return this._selectedVertexId; },
    // ─── Topoloji tarama animasyonu (ANSYS-style scan) ──────────────────────
    // scanState: { faces:{id:true}, edges:{id:true}, vertices:{id:true},
    //              faceColor, edgeColor, vertexColor }
    // İlgili face/edge/vertex'leri scan renginde gösterir (yeşil/cyan/sarı).
    _scanState: null,
    setScanState: function(scanState) {
      this._scanState = scanState;
      this._applyFaceColors();
      this._refreshEdgeHighlights();
      this._refreshVertexHighlights();
    },
    // Performans: sadece face'leri güncelle (faz 1'de edge/vertex'e dokunma)
    setScanFaces: function(faceMap, faceColor) {
      this._scanState = this._scanState || {};
      this._scanState.faces = faceMap || {};
      this._scanState.faceColor = faceColor || 0x22c55e;
      this._applyFaceColors();
    },
    setScanEdges: function(edgeMap, edgeColor) {
      this._scanState = this._scanState || {};
      this._scanState.edges = edgeMap || {};
      this._scanState.edgeColor = edgeColor || 0x06d6f5;
      this._refreshEdgeHighlights();
    },
    setScanVertices: function(vertexMap, vertexColor) {
      this._scanState = this._scanState || {};
      this._scanState.vertices = vertexMap || {};
      this._scanState.vertexColor = vertexColor || 0xfbbf24;
      this._refreshVertexHighlights();
    },
    // Tüm modeli kısa bir süre belirtilen renkte yak (tamamlanma pulse).
    pulseAllFaces: function(colorHex, intensity) {
      if (!this._faceMaterials) return;
      var self = this;
      Object.keys(this._faceMaterials).forEach(function(fid) {
        var mat = self._faceMaterials[fid];
        if (mat && mat.emissive) {
          mat.emissive.setHex(colorHex || 0x22c55e);
          mat.emissiveIntensity = (intensity != null) ? intensity : 0.5;
          mat.needsUpdate = true;
        }
      });
      render();
    },
    clearScanState: function() {
      this._scanState = null;
      this._applyFaceColors();
      this._refreshEdgeHighlights();
      this._refreshVertexHighlights();
    },
    // Edge/vertex overlay'lerin görünürlüğünü kontrol et (geometri yedirildiğinde
    // çağrılır → varsayılan: tüm edge'ler görünür ama soluk).
    setEdgeOverlayMode: function(mode) {
      // mode: 'all' | 'selected-only' | 'off'
      this._edgeOverlayMode = mode || 'all';
      this._refreshEdgeHighlights();
    },
    setVertexOverlayMode: function(mode) {
      this._vertexOverlayMode = mode || 'all';
      this._refreshVertexHighlights();
    },
    // STEP üçgen mesh'inden Three.js sahnesine yükle. (Eski adı loadSTL; STL
    // desteği kaldırıldı ama eski isim viewer API'sinde geri uyumluluk için
    // korunmadı — yeni ad: loadTriangleMesh.)
    loadTriangleMesh: function(parsed) {
      if(typeof veFEABuildTriangleMesh !== 'function') return null;
      this.clearGeometry();
      var mesh = veFEABuildTriangleMesh(parsed);
      if(!mesh) return null;
      this._geometryRoot.add(mesh);
      _veFEAEnsureEdges(mesh);
      this._applyDisplayState(mesh);
      this.zoomToFit(mesh);
      return mesh;
    },
    // Faz 5 — OCCT BREP tessellation köprüsü: STEP yüzleri 3D'de TIKLANABİLİR.
    // tessellation: { positions, indices, groups:[{start,count,faceId}], faceIdOrder }
    // Multi-material BufferGeometry kurar (her face bir materyal), feaFaceMap'i
    // doldurur — mevcut face picking (_collectFaceMaterials + raycaster) otomatik çalışır.
    loadBrepTessellation: function(tessellation) {
      if (typeof THREE === 'undefined' || !tessellation || !tessellation.positions ||
          !tessellation.indices || !Array.isArray(tessellation.groups)) return null;
      this.clearGeometry();
      var geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(tessellation.positions, 3));
      geo.setIndex(new THREE.BufferAttribute(tessellation.indices, 1));
      // Materyal grupları — her face bir materialIndex
      var materials = [];
      var faceMap = [];
      tessellation.groups.forEach(function(g, mi) {
        geo.addGroup(g.start, g.count, mi);
        materials.push(_veFEAMakePrimitiveMaterial());
        faceMap[mi] = g.faceId;
      });
      geo.computeVertexNormals();
      var mesh = new THREE.Mesh(geo, materials);
      mesh.userData.feaFaceMap = faceMap;
      mesh.userData.feaBrep = true;   // BREP-kaynaklı (analitik primitif değil)
      this._geometryRoot.add(mesh);
      _veFEAEnsureEdges(mesh);
      this._applyDisplayState(mesh);
      this._collectFaceMaterials();   // face picking için materyal haritasını kur
      this.zoomToFit(mesh);
      return mesh;
    },
    // F3: Mesh data → LineSegments (kenar wireframe)
    loadMesh: function(meshData) {
      if (!meshData || typeof veFEAMeshExtractEdges !== 'function') return null;
      this.clearGeometry();
      var edgeVerts = veFEAMeshExtractEdges(meshData);
      if (!edgeVerts || edgeVerts.length === 0) return null;

      var geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.BufferAttribute(edgeVerts, 3));
      var line = new THREE.LineSegments(
        geometry,
        new THREE.LineBasicMaterial({ color: 0x60a5fa })
      );
      line.userData.feaMeshEdges = true;
      this._geometryRoot.add(line);
      // Mesh node referansını sakla → highlightNamedSelection kullanır
      this._meshData = meshData;
      this._highlightedSelectionKey = null;
      this.zoomToFit(line);
      return line;
    },
    // Mesh'i sabit renkte solid yüzey olarak yedirir (heat map'siz).
    // withEdges: true → siyah ince edge overlay'i de ekler
    // BC marker'lari sahneye ekle. assignments: array of {faceId, kind, value}.
    // Mesh'in face merkezi + normali bilgisini topology'den alir.
    // Marker tipleri:
    //   - fixed: kırmızı küçük çapraz/X (cıvata mesneti gibi)
    //   - force: yeşil ok (force yönü ve büyüklüğüne göre)
    //   - pressure: turkuaz ok dizisi (yüzeye dağılmış)
    //   - displacement: mavi ok (deplasman yönü)
    _bcMarkers: null,
    clearBCMarkers: function () {
      if (this._bcMarkers) {
        this._geometryRoot.remove(this._bcMarkers);
        this._bcMarkers.traverse(function (obj) {
          if (obj.geometry && obj.geometry.dispose) obj.geometry.dispose();
          if (obj.material && obj.material.dispose) obj.material.dispose();
        });
        this._bcMarkers = null;
      }
    },
    addBCMarkers: function (meshData, assignments, topology) {
      this.clearBCMarkers();
      if (!assignments || !assignments.length) { render(); return; }
      var group = new THREE.Group();
      group.name = 'feaBCMarkers';

      // Mesh bbox ölçeği — marker boyutlarını mesh'e göre ölçekle
      var bboxSize = 10;
      if (meshData && meshData.nodes && meshData.nodes.length) {
        var minB = [Infinity, Infinity, Infinity], maxB = [-Infinity, -Infinity, -Infinity];
        for (var i = 0; i < meshData.nodes.length / 3; i++) {
          for (var ax = 0; ax < 3; ax++) {
            var c = meshData.nodes[i * 3 + ax];
            if (c < minB[ax]) minB[ax] = c;
            if (c > maxB[ax]) maxB[ax] = c;
          }
        }
        bboxSize = Math.max(maxB[0] - minB[0], maxB[1] - minB[1], maxB[2] - minB[2]);
      }
      var ms = bboxSize * 0.12; // marker scale

      assignments.forEach(function (a) {
        if (!a.enabled) return;
        var faceNodes = (meshData.namedSelections && meshData.namedSelections[a.faceId])
          ? meshData.namedSelections[a.faceId].nodeIds : null;
        if (!faceNodes || !faceNodes.length) return;
        // Yüzey merkezi hesap
        var cx = 0, cy = 0, cz = 0;
        for (var ni = 0; ni < faceNodes.length; ni++) {
          var n = faceNodes[ni];
          cx += meshData.nodes[n * 3];
          cy += meshData.nodes[n * 3 + 1];
          cz += meshData.nodes[n * 3 + 2];
        }
        cx /= faceNodes.length;
        cy /= faceNodes.length;
        cz /= faceNodes.length;
        var center = new THREE.Vector3(cx, cy, cz);
        var face = (topology && topology.faces) ? topology.faces.filter(function (f) { return f.id === a.faceId; })[0] : null;
        var normal = face && face.normal ? new THREE.Vector3(face.normal[0], face.normal[1], face.normal[2]) : new THREE.Vector3(0, 1, 0);

        if (a.kind === 'fixed') {
          // 4-5 kırmızı küçük cıvata kontağı: yüzeydeki 5 nokta, her birinde küçük kırmızı küre
          var sampleCount = Math.min(faceNodes.length, 12);
          var step = Math.max(1, Math.floor(faceNodes.length / sampleCount));
          for (var si = 0; si < faceNodes.length; si += step) {
            var nn = faceNodes[si];
            var sp = new THREE.Mesh(
              new THREE.SphereGeometry(ms * 0.08, 8, 8),
              new THREE.MeshBasicMaterial({ color: 0xef4444 })
            );
            sp.position.set(meshData.nodes[nn * 3], meshData.nodes[nn * 3 + 1], meshData.nodes[nn * 3 + 2]);
            group.add(sp);
          }
        } else if (a.kind === 'force' && a.value) {
          // Yeşil ok: yüzey merkezinden force vektör yönünde
          var fv = new THREE.Vector3(a.value.fx || 0, a.value.fy || 0, a.value.fz || 0);
          var fmag = fv.length();
          if (fmag > 1e-12) {
            fv.normalize();
            var arrow = new THREE.ArrowHelper(fv, center, ms, 0x22c55e, ms * 0.3, ms * 0.15);
            group.add(arrow);
          }
        } else if (a.kind === 'pressure' && a.value) {
          // Turkuaz oklar yüzey normal yönünde, dağıtık
          var pressNorm = normal.clone().negate(); // Pressure içeri doğru baskı
          var pSamples = Math.min(faceNodes.length, 8);
          var pStep = Math.max(1, Math.floor(faceNodes.length / pSamples));
          for (var pi = 0; pi < faceNodes.length; pi += pStep) {
            var pn = faceNodes[pi];
            var p0 = new THREE.Vector3(meshData.nodes[pn * 3], meshData.nodes[pn * 3 + 1], meshData.nodes[pn * 3 + 2]);
            var arrowP = new THREE.ArrowHelper(pressNorm, p0.clone().sub(pressNorm.clone().multiplyScalar(ms * 0.6)), ms * 0.6, 0x2dd4bf, ms * 0.2, ms * 0.1);
            group.add(arrowP);
          }
        } else if (a.kind === 'displacement' && a.value) {
          // Mavi ok: deplasman vektör yönü
          var dv = new THREE.Vector3(a.value.ux || 0, a.value.uy || 0, a.value.uz || 0);
          var dmag = dv.length();
          if (dmag > 1e-12) {
            dv.normalize();
            var dArrow = new THREE.ArrowHelper(dv, center, ms, 0x3b82f6, ms * 0.3, ms * 0.15);
            group.add(dArrow);
          }
        }
      });

      this._geometryRoot.add(group);
      this._bcMarkers = group;
      render();
    },
    loadMeshSolid: function(meshData, withEdges) {
      if (!meshData || typeof veFEAExtractSurfaceTriangles !== 'function') return null;
      this.clearGeometry();
      var surf = veFEAExtractSurfaceTriangles(meshData);
      if (!surf || surf.positions.length === 0) return null;

      var geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.BufferAttribute(surf.positions, 3));
      geometry.computeVertexNormals();
      var material = new THREE.MeshStandardMaterial({
        color: 0x3b82f6,
        metalness: 0.15,
        roughness: 0.6,
        side: THREE.DoubleSide,
        flatShading: false,
        // Solid yüzeyi z-buffer'da hafifçe arkaya it → edge LineSegments'ler
        // her zaman önde renderlenir, sub-pixel'de bile sönük olmaz.
        polygonOffset: true,
        polygonOffsetFactor: 1,
        polygonOffsetUnits: 1
      });
      var solid = new THREE.Mesh(geometry, material);
      solid.userData.feaMeshSolid = true;
      this._geometryRoot.add(solid);

      if (withEdges) {
        var edgeVerts = veFEAMeshExtractEdges(meshData);
        if (edgeVerts && edgeVerts.length > 0 && edgeVerts.length / 3 < 200000) {
          var edgeGeo = new THREE.BufferGeometry();
          edgeGeo.setAttribute('position', new THREE.BufferAttribute(edgeVerts, 3));
          var edgeLine = new THREE.LineSegments(
            edgeGeo,
            new THREE.LineBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.92 })
          );
          edgeLine.userData.feaMeshEdges = true;
          this._geometryRoot.add(edgeLine);
        }
      }

      this._meshData = meshData;
      this._highlightedSelectionKey = null;
      this.zoomToFit(solid);
      return solid;
    },
    // ANSYS Body Color modu: orijinal geometri (primitif / STL / STEP) korunur,
    // uzerine mesh element edges siyah cizgi olarak eklenir. ANSYS Mechanical'da
    // mesh atildiktan sonra default goruntu: geometri yuzeyi + siyah mesh agi.
    loadMeshOverGeometry: function(meshData, geomNodeId, opts) {
      if (!meshData) return null;
      // wireframeMode: 'all' (default, eski davranıştan tutarlı ama 6M edge'e
      // kadar izin verir), 'surface' (sadece sınır face edges — yoğun mesh'te
      // en pratik, ANSYS-style shaded-with-edges hissi), 'off' (sadece solid).
      var wireframeMode = (opts && opts.wireframeMode) || 'all';
      // Solid mesh (tet4/hex8/pyramid5) için 'all' ≡ 'surface' görsel olarak:
      // interior edge'ler solid yüzey tarafından gizleniyor. Yoğun mesh'lerde
      // (>30K eleman) 'all' mod milyonlarca sub-pixel çizgi üretip wireframe'i
      // siliyor. Otomatik 'surface'e geç — kullanıcıya banner bildirimi yap.
      var elemCount = (meshData.elements && meshData.nodesPerElement)
                    ? (meshData.elements.length / meshData.nodesPerElement) : 0;
      var solidMesh = (meshData.type === 'tet4' || meshData.type === 'hex8' ||
                       meshData.type === 'pyramid5' || meshData.type === 'tet10' ||
                       meshData.type === 'hex20');
      var autoSurface = false;
      if (wireframeMode === 'all' && solidMesh && elemCount > 30000) {
        wireframeMode = 'surface';
        autoSurface = true;
      }
      // 1. Geometriyi yedir (mevcut helper kendi clearGeometry yapar).
      // geometryOnly: birleşik 'fea' modülünde geomNodeId === meshNodeId olduğu
      // için helper'ın mesh-cache kısayolunu atla — yoksa solid yüzey yerine
      // mesh wireframe çizilir ve aşağıdaki edge overlay ile çift tel kafes olur.
      if (geomNodeId && typeof _veFEALoadNodeGeometryIntoViewer === 'function') {
        _veFEALoadNodeGeometryIntoViewer(this, geomNodeId, { geometryOnly: true });
      } else {
        // Upstream geometri yok → mesh-derived solid yuzey yedir (fallback)
        this.clearGeometry();
        if (typeof veFEAExtractSurfaceTriangles === 'function') {
          var surf = veFEAExtractSurfaceTriangles(meshData);
          if (surf && surf.positions.length > 0) {
            var sGeo = new THREE.BufferGeometry();
            sGeo.setAttribute('position', new THREE.BufferAttribute(surf.positions, 3));
            sGeo.computeVertexNormals();
            var sMat = new THREE.MeshStandardMaterial({
              color: 0x3b82f6, metalness: 0.15, roughness: 0.6, side: THREE.DoubleSide,
              polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1
            });
            this._geometryRoot.add(new THREE.Mesh(sGeo, sMat));
          }
        }
      }
      // 2. Mesh element edges (siyah, belirgin) — geometrinin uzerine overlay
      // wireframeMode'a göre tüm vs yüzey-yalnız edge'ler.
      var edgeVerts = null;
      if (wireframeMode === 'all' && typeof veFEAMeshExtractEdges === 'function') {
        var allEdges = veFEAMeshExtractEdges(meshData);
        // Çok yoğun mesh'lerde tüm edge'ler ekrana sığmaz; 6M vertex
        // üst sınırını aşarsa yüzey moduna düşür.
        if (allEdges && allEdges.length / 3 > 6000000 && typeof veFEAMeshExtractSurfaceEdges === 'function') {
          edgeVerts = veFEAMeshExtractSurfaceEdges(meshData);
        } else {
          edgeVerts = allEdges;
        }
      } else if (wireframeMode === 'surface' && typeof veFEAMeshExtractSurfaceEdges === 'function') {
        edgeVerts = veFEAMeshExtractSurfaceEdges(meshData);
      }
      // 'off' → edgeVerts null, hiç wireframe yok
      if (edgeVerts && edgeVerts.length > 0) {
        var eGeo = new THREE.BufferGeometry();
        eGeo.setAttribute('position', new THREE.BufferAttribute(edgeVerts, 3));
        var eLine = new THREE.LineSegments(
          eGeo,
          new THREE.LineBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.92 })
        );
        eLine.userData.feaMeshEdges = true;
        this._geometryRoot.add(eLine);
      }
      this._meshData = meshData;
      this._highlightedSelectionKey = null;
      // zoomToFit gerekirse — geometri zaten yedirilirken yapildi
      return null;
    },
    // ANSYS-style threshold renkli mesh — perElement değerlere göre yeşil/sarı/kırmızı.
    // thresholds = { warnLimit, errLimit, inverted }
    loadMeshThresholdMap: function(meshData, perValues, thresholds) {
      if (!meshData || typeof veFEAExtractSurfaceTriangles !== 'function') return null;
      this.clearGeometry();
      var surf = veFEAExtractSurfaceTriangles(meshData);
      if (!surf || surf.positions.length === 0) return null;
      var positions = surf.positions;
      var elementIds = surf.elementIds;
      var triCount = elementIds.length;
      var colors = new Float32Array(positions.length);
      var warn = thresholds.warnLimit;
      var err = thresholds.errLimit;
      var inv = !!thresholds.inverted;
      for (var i = 0; i < triCount; i++) {
        var v = perValues ? perValues[elementIds[i]] : 0;
        var rgb = (typeof veFEAThresholdColor === 'function')
          ? veFEAThresholdColor(v, warn, err, inv) : [0.5, 0.5, 0.5];
        for (var k = 0; k < 3; k++) {
          colors[i * 9 + k * 3]     = rgb[0];
          colors[i * 9 + k * 3 + 1] = rgb[1];
          colors[i * 9 + k * 3 + 2] = rgb[2];
        }
      }
      var geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
      geometry.computeVertexNormals();
      var material = new THREE.MeshStandardMaterial({
        vertexColors: true,
        metalness: 0.0,
        roughness: 0.7,
        side: THREE.DoubleSide,
        flatShading: false
      });
      var solid = new THREE.Mesh(geometry, material);
      solid.userData.feaThresholdMap = true;
      this._geometryRoot.add(solid);

      // ANSYS-style: edge overlay (siyah, opaklık 0.45)
      var edgeVerts = veFEAMeshExtractEdges(meshData);
      if (edgeVerts && edgeVerts.length > 0 && edgeVerts.length / 3 < 200000) {
        var edgeGeo = new THREE.BufferGeometry();
        edgeGeo.setAttribute('position', new THREE.BufferAttribute(edgeVerts, 3));
        var edgeLine = new THREE.LineSegments(
          edgeGeo,
          new THREE.LineBasicMaterial({ color: 0x102444, transparent: true, opacity: 0.45 })
        );
        edgeLine.userData.feaMeshEdges = true;
        this._geometryRoot.add(edgeLine);
      }

      this._meshData = meshData;
      this._highlightedSelectionKey = null;
      this.zoomToFit(solid);
      return solid;
    },
    // Mesh'i renk-kodlu solid olarak yedirir. perValues: Float32Array (eleman/değer),
    // min/max: legend için sınırlar. Boundary face'ler üçgenleştirilip vertex
    // colors ile renklendirilir.
    // Sonuç görüntüleme: deformed shape — original mesh + u·scale ile node konumları
    // güncellenir, üst üste bindirme için isteğe bağlı undeformed (gri) gösterim.
    // perNodeValues stress map ile renkleme yapar (vonMises tipik kullanım).
    loadMeshDeformed: function(meshData, displacement, perNodeValues, valMin, valMax, opts) {
      if (!meshData || !displacement || typeof veFEAExtractSurfaceTriangles !== 'function') return null;
      opts = opts || {};
      this.clearGeometry();
      // Deform edilmis mesh kopyasi olustur
      var scale = (isFinite(opts.scale) && opts.scale > 0) ? opts.scale : 1;
      var deformedNodes = new Float32Array(meshData.nodes.length);
      var n = meshData.nodes.length / 3;
      for (var i = 0; i < n; i++) {
        deformedNodes[i * 3]     = meshData.nodes[i * 3]     + displacement[i * 3]     * scale;
        deformedNodes[i * 3 + 1] = meshData.nodes[i * 3 + 1] + displacement[i * 3 + 1] * scale;
        deformedNodes[i * 3 + 2] = meshData.nodes[i * 3 + 2] + displacement[i * 3 + 2] * scale;
      }
      var deformedMesh = Object.assign({}, meshData, { nodes: deformedNodes });

      // Undeformed referans (gri saydam kafes)
      if (opts.showUndeformed) {
        var origEdges = veFEAMeshExtractEdges(meshData);
        if (origEdges && origEdges.length > 0) {
          var origGeo = new THREE.BufferGeometry();
          origGeo.setAttribute('position', new THREE.BufferAttribute(origEdges, 3));
          var origLine = new THREE.LineSegments(
            origGeo,
            new THREE.LineBasicMaterial({ color: 0x888888, transparent: true, opacity: 0.30 })
          );
          origLine.userData.feaUndeformed = true;
          this._geometryRoot.add(origLine);
        }
      }

      // Deformed surface + heat map (varsa) veya solid
      var surf = veFEAExtractSurfaceTriangles(deformedMesh);
      if (!surf || surf.positions.length === 0) return null;
      var positions = surf.positions;
      var nVerts = positions.length / 3;
      var colors = new Float32Array(positions.length);
      var range = (isFinite(valMax) && isFinite(valMin) && valMax > valMin) ? (valMax - valMin) : 1;

      // Vertex → original node ID eşlemesi (deformedNodes pozisyonuyla)
      var nodeIdsForVerts;
      if (surf.nodeIds && surf.nodeIds.length === nVerts) {
        nodeIdsForVerts = surf.nodeIds;
      } else {
        nodeIdsForVerts = new Int32Array(nVerts);
        var dN = deformedNodes;
        var nN = dN.length / 3;
        for (var v = 0; v < nVerts; v++) {
          var vx = positions[v * 3], vy = positions[v * 3 + 1], vz = positions[v * 3 + 2];
          var best = -1, bestD = Infinity;
          for (var nn = 0; nn < nN; nn++) {
            var dx = dN[nn * 3] - vx;
            var dy = dN[nn * 3 + 1] - vy;
            var dz = dN[nn * 3 + 2] - vz;
            var d2 = dx * dx + dy * dy + dz * dz;
            if (d2 < bestD) { bestD = d2; best = nn; }
          }
          nodeIdsForVerts[v] = best;
        }
      }
      for (var vv = 0; vv < nVerts; vv++) {
        var nid = nodeIdsForVerts[vv];
        var vval = perNodeValues ? (perNodeValues[nid] || 0) : 0;
        var t = perNodeValues ? (vval - valMin) / range : 0.5;
        if (t < 0) t = 0; else if (t > 1) t = 1;
        var rgb = (typeof veFEAJetColor === 'function') ? veFEAJetColor(t) : [0.5, 0.5, 0.7];
        colors[vv * 3]     = rgb[0];
        colors[vv * 3 + 1] = rgb[1];
        colors[vv * 3 + 2] = rgb[2];
      }
      var geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
      geometry.computeVertexNormals();
      var material = new THREE.MeshStandardMaterial({
        vertexColors: true,
        metalness: 0.0,
        roughness: 0.65,
        side: THREE.DoubleSide
      });
      var solid = new THREE.Mesh(geometry, material);
      solid.userData.feaDeformed = true;
      this._geometryRoot.add(solid);

      var defEdges = veFEAMeshExtractEdges(deformedMesh);
      if (defEdges && defEdges.length > 0 && defEdges.length / 3 < 200000) {
        var edgeGeo = new THREE.BufferGeometry();
        edgeGeo.setAttribute('position', new THREE.BufferAttribute(defEdges, 3));
        var edgeLine = new THREE.LineSegments(
          edgeGeo,
          new THREE.LineBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.5 })
        );
        edgeLine.userData.feaMeshEdges = true;
        this._geometryRoot.add(edgeLine);
      }
      this._meshData = deformedMesh;
      this._highlightedSelectionKey = null;
      this.zoomToFit(solid);
      return solid;
    },
    // Sonuç görüntüleme: nodal (her düğüm için) değer haritası.
    // perNodeValues: Float64Array(nNodes) — örn. von Mises veya displacement magnitude.
    // Surface vertex'lere triangle başına element ID'ler yerine doğrudan node ID'ler
    // kullanılır. Renkleme node bazlı, üçgen içi interpolasyon Three.js'in
    // vertexColors özelliği ile otomatik yapılır.
    loadMeshResultMap: function(meshData, perNodeValues, valMin, valMax) {
      if (!meshData || !perNodeValues || typeof veFEAExtractSurfaceTriangles !== 'function') return null;
      this.clearGeometry();
      var surf = veFEAExtractSurfaceTriangles(meshData);
      if (!surf || surf.positions.length === 0) return null;
      // Yüzey vertex'leri triangle başına 9 float (3 vertex × 3 koord) layout'unda.
      // Her vertex'in hangi node'a karşılık geldiği bilgisi surf içinde nodeIds varsa
      // kullanılır (yeni viewer extension), yoksa pozisyondan en yakın node aranır.
      var positions = surf.positions;
      var nVerts = positions.length / 3;
      var colors = new Float32Array(positions.length);
      var range = (isFinite(valMax) && isFinite(valMin) && valMax > valMin) ? (valMax - valMin) : 1;

      // Vertex → node ID eşlemesi. Eğer surf.nodeIds varsa direkt kullan,
      // yoksa pozisyon karşılaştırması (mesh.nodes ile).
      var nodeIdsForVerts;
      if (surf.nodeIds && surf.nodeIds.length === nVerts) {
        nodeIdsForVerts = surf.nodeIds;
      } else {
        nodeIdsForVerts = new Int32Array(nVerts);
        var meshNodes = meshData.nodes;
        var nNodes = meshNodes.length / 3;
        for (var v = 0; v < nVerts; v++) {
          var vx = positions[v * 3], vy = positions[v * 3 + 1], vz = positions[v * 3 + 2];
          var best = -1, bestD = Infinity;
          for (var n = 0; n < nNodes; n++) {
            var dx = meshNodes[n * 3] - vx;
            var dy = meshNodes[n * 3 + 1] - vy;
            var dz = meshNodes[n * 3 + 2] - vz;
            var d2 = dx * dx + dy * dy + dz * dz;
            if (d2 < bestD) { bestD = d2; best = n; }
          }
          nodeIdsForVerts[v] = best;
        }
      }
      for (var vv = 0; vv < nVerts; vv++) {
        var nid = nodeIdsForVerts[vv];
        var vval = perNodeValues[nid] || 0;
        var t = (vval - valMin) / range;
        if (t < 0) t = 0; else if (t > 1) t = 1;
        var rgb = (typeof veFEAJetColor === 'function') ? veFEAJetColor(t) : [0.5, 0.5, 0.5];
        colors[vv * 3]     = rgb[0];
        colors[vv * 3 + 1] = rgb[1];
        colors[vv * 3 + 2] = rgb[2];
      }
      var geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
      geometry.computeVertexNormals();
      var material = new THREE.MeshStandardMaterial({
        vertexColors: true,
        metalness: 0.0,
        roughness: 0.7,
        side: THREE.DoubleSide,
        flatShading: false
      });
      var solid = new THREE.Mesh(geometry, material);
      solid.userData.feaResultMap = true;
      this._geometryRoot.add(solid);

      var edgeVerts = veFEAMeshExtractEdges(meshData);
      if (edgeVerts && edgeVerts.length > 0 && edgeVerts.length / 3 < 200000) {
        var edgeGeo = new THREE.BufferGeometry();
        edgeGeo.setAttribute('position', new THREE.BufferAttribute(edgeVerts, 3));
        var edgeLine = new THREE.LineSegments(
          edgeGeo,
          new THREE.LineBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.6 })
        );
        edgeLine.userData.feaMeshEdges = true;
        this._geometryRoot.add(edgeLine);
      }
      this._meshData = meshData;
      this._highlightedSelectionKey = null;
      this.zoomToFit(solid);
      return solid;
    },
    loadMeshHeatMap: function(meshData, perValues, valMin, valMax) {
      if (!meshData || typeof veFEAExtractSurfaceTriangles !== 'function') return null;
      this.clearGeometry();
      var surf = veFEAExtractSurfaceTriangles(meshData);
      if (!surf || surf.positions.length === 0) return null;

      var positions = surf.positions;
      var elementIds = surf.elementIds;
      var triCount = elementIds.length;
      var colors = new Float32Array(positions.length);

      var range = (isFinite(valMax) && isFinite(valMin) && valMax > valMin) ? (valMax - valMin) : 1;
      for (var i = 0; i < triCount; i++) {
        var eid = elementIds[i];
        var v = perValues ? perValues[eid] : 0;
        var t = (v - valMin) / range;
        var rgb = (typeof veFEAJetColor === 'function') ? veFEAJetColor(t) : [0.5, 0.5, 0.5];
        for (var k = 0; k < 3; k++) {
          colors[i * 9 + k * 3]     = rgb[0];
          colors[i * 9 + k * 3 + 1] = rgb[1];
          colors[i * 9 + k * 3 + 2] = rgb[2];
        }
      }

      var geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
      geometry.computeVertexNormals();
      var material = new THREE.MeshStandardMaterial({
        vertexColors: true,
        metalness: 0.0,
        roughness: 0.7,
        side: THREE.DoubleSide,
        flatShading: false
      });
      var solid = new THREE.Mesh(geometry, material);
      solid.userData.feaHeatMap = true;
      this._geometryRoot.add(solid);

      // Kenarları üstüne ekle (siyah ince çizgiler)
      var edgeVerts = veFEAMeshExtractEdges(meshData);
      if (edgeVerts && edgeVerts.length > 0 && edgeVerts.length / 3 < 200000) {
        var edgeGeo = new THREE.BufferGeometry();
        edgeGeo.setAttribute('position', new THREE.BufferAttribute(edgeVerts, 3));
        var edgeLine = new THREE.LineSegments(
          edgeGeo,
          new THREE.LineBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.85 })
        );
        edgeLine.userData.feaMeshEdges = true;
        this._geometryRoot.add(edgeLine);
      }

      this._meshData = meshData;
      this._highlightedSelectionKey = null;
      this.zoomToFit(solid);
      return solid;
    },
    // Verilen named selection key'inin düğümlerini sahnede vurgular.
    // null verilirse mevcut highlight kaldırılır.
    highlightNamedSelection: function(key) {
      // Önceki highlight'ı temizle
      if (this._highlightMarker) {
        this._geometryRoot.remove(this._highlightMarker);
        if (this._highlightMarker.geometry && this._highlightMarker.geometry.dispose) this._highlightMarker.geometry.dispose();
        if (this._highlightMarker.material && this._highlightMarker.material.dispose) this._highlightMarker.material.dispose();
        this._highlightMarker = null;
      }
      this._highlightedSelectionKey = null;
      if (!key || !this._meshData || !this._meshData.namedSelections) { render(); return; }
      var ns = this._meshData.namedSelections[key];
      if (!ns || !ns.nodeIds || ns.nodeIds.length === 0) { render(); return; }
      // Bbox tabanlı marker boyutu
      var box = new THREE.Box3().setFromObject(this._geometryRoot);
      var size = box.isEmpty() ? 50 : Math.max(box.getSize(new THREE.Vector3()).x, box.getSize(new THREE.Vector3()).y, box.getSize(new THREE.Vector3()).z);
      var pointSize = Math.max(2.5, size * 0.012);
      var nodes = this._meshData.nodes;
      var positions = new Float32Array(ns.nodeIds.length * 3);
      for (var i = 0; i < ns.nodeIds.length; i++) {
        var nid = ns.nodeIds[i];
        positions[i * 3]     = nodes[nid * 3];
        positions[i * 3 + 1] = nodes[nid * 3 + 1];
        positions[i * 3 + 2] = nodes[nid * 3 + 2];
      }
      var geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      var mat = new THREE.PointsMaterial({ color: 0xfbbf24, size: pointSize, sizeAttenuation: true, depthTest: false });
      var pts = new THREE.Points(geo, mat);
      pts.renderOrder = 999;
      pts.userData.feaHighlight = true;
      this._geometryRoot.add(pts);
      this._highlightMarker = pts;
      this._highlightedSelectionKey = key;
      render();
    },
    getHighlightedSelectionKey: function() {
      return this._highlightedSelectionKey || null;
    },
    // ANSYS-style bin-selection: histogram bin'inde olan element ID'lerini
    // 3D'de centroid noktası olarak vurgular. elementIds=null veya boş array
    // mevcut element-highlight'ı temizler.
    // Named selection highlight ile aynı marker slot'unu paylaşır (tek seferde
    // ya named selection ya da element highlight gösterilir).
    highlightElements: function(elementIds, color) {
      // Önceki highlight'ı temizle (named selection veya element)
      if (this._highlightMarker) {
        this._geometryRoot.remove(this._highlightMarker);
        if (this._highlightMarker.geometry && this._highlightMarker.geometry.dispose) this._highlightMarker.geometry.dispose();
        if (this._highlightMarker.material && this._highlightMarker.material.dispose) this._highlightMarker.material.dispose();
        this._highlightMarker = null;
      }
      this._highlightedSelectionKey = null;
      if (!elementIds || elementIds.length === 0 || !this._meshData) { render(); return; }
      var mesh = this._meshData;
      var nodes = mesh.nodes;
      var elements = mesh.elements;
      var per = mesh.nodesPerElement;
      // Quadratic elemanlarda corner-only centroid daha temsil edici
      var corners = (mesh.type === 'tet10') ? 4
                  : (mesh.type === 'hex20') ? 8
                  : (mesh.type === 'wedge15') ? 6
                  : per;
      var positions = new Float32Array(elementIds.length * 3);
      for (var i = 0; i < elementIds.length; i++) {
        var eid = elementIds[i];
        var off = eid * per;
        var cx = 0, cy = 0, cz = 0;
        for (var c = 0; c < corners; c++) {
          var n = elements[off + c] * 3;
          cx += nodes[n]; cy += nodes[n + 1]; cz += nodes[n + 2];
        }
        positions[i * 3]     = cx / corners;
        positions[i * 3 + 1] = cy / corners;
        positions[i * 3 + 2] = cz / corners;
      }
      var box = new THREE.Box3().setFromObject(this._geometryRoot);
      var bsize = box.isEmpty() ? 50 : Math.max(box.getSize(new THREE.Vector3()).x,
                                                 box.getSize(new THREE.Vector3()).y,
                                                 box.getSize(new THREE.Vector3()).z);
      var pointSize = Math.max(2.5, bsize * 0.015);
      var geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      var col = (typeof color === 'number') ? color : 0xff4400;
      var mat = new THREE.PointsMaterial({ color: col, size: pointSize, sizeAttenuation: true, depthTest: false });
      var pts = new THREE.Points(geo, mat);
      pts.renderOrder = 999;
      pts.userData.feaHighlight = true;
      pts.userData.feaElementHighlight = true;
      this._geometryRoot.add(pts);
      this._highlightMarker = pts;
      render();
    },
    // ─── Mesh eleman seçimi (mesh-pick modu) ─────────────────────────────────
    // Fare ile mesh üzerinde gezerken/tıklarken tekil mesh elemanını yakalar ve
    // dolu + kenar overlay ile vurgular. Yakalama: yüzeyden raycast ile 3D nokta
    // alınır, ardından o noktaya en yakın eleman centroid'i bulunur — bu sayede
    // hangi display modunda olursa olsun (geometri+mesh, solid, heat map) çalışır.
    _disposeOverlay: function(obj) {
      if (!obj) return;
      obj.traverse(function(o) {
        if (o.geometry && o.geometry.dispose) o.geometry.dispose();
        if (o.material) {
          var mats = Array.isArray(o.material) ? o.material : [o.material];
          mats.forEach(function(m) { if (m && m.dispose) m.dispose(); });
        }
      });
    },
    // Eleman centroid'lerini önbelleğe alır (mesh başına bir kez hesaplanır).
    _ensureElementCentroids: function() {
      var md = this._meshData;
      if (!md || !md.elements || !md.nodes || !md.nodesPerElement) { this._elementCentroids = null; return null; }
      if (this._elementCentroids && this._centroidsMesh === md) return this._elementCentroids;
      var per = md.nodesPerElement;
      var corners = (md.type === 'tet10') ? 4 : (md.type === 'hex20') ? 8 : (md.type === 'wedge15') ? 6 : per;
      var nodes = md.nodes, els = md.elements;
      var n = (els.length / per) | 0;
      var cen = new Float32Array(n * 3);
      for (var e = 0; e < n; e++) {
        var off = e * per, cx = 0, cy = 0, cz = 0;
        for (var c = 0; c < corners; c++) {
          var ni = els[off + c] * 3;
          cx += nodes[ni]; cy += nodes[ni + 1]; cz += nodes[ni + 2];
        }
        cen[e * 3] = cx / corners; cen[e * 3 + 1] = cy / corners; cen[e * 3 + 2] = cz / corners;
      }
      this._elementCentroids = cen;
      this._centroidsMesh = md;
      return cen;
    },
    // Eleman tipine göre yüzey üçgenlerini döner (overlay highlight için).
    _elementFaceList: function(type) {
      if (type === 'tet4' || type === 'tet10') return [[0,1,2],[0,1,3],[0,2,3],[1,2,3]];
      if (type === 'hex8' || type === 'hex20') return [[0,1,2,3],[4,5,6,7],[0,1,5,4],[1,2,6,5],[2,3,7,6],[3,0,4,7]];
      if (type === 'wedge6' || type === 'wedge15') return [[0,1,2],[3,4,5],[0,1,4,3],[1,2,5,4],[2,0,3,5]];
      if (type === 'pyramid5') return [[0,1,2,3],[0,1,4],[1,2,4],[2,3,4],[3,0,4]];
      if (type === 'tri3') return [[0,1,2]];
      if (type === 'quad4') return [[0,1,2,3]];
      return [[0,1,2,3],[4,5,6,7],[0,1,5,4],[1,2,6,5],[2,3,7,6],[3,0,4,7]];
    },
    // Tek bir elemanın yüzlerinden dolu + kenar overlay grubu kurar.
    _buildElementOverlay: function(elementId, color, opacity) {
      var md = this._meshData;
      if (!md || !md.elements || elementId == null) return null;
      var per = md.nodesPerElement;
      var off = elementId * per;
      if (off < 0 || off + per > md.elements.length) return null;
      var nodes = md.nodes, els = md.elements;
      var faces = this._elementFaceList(md.type);
      var tri = [];
      function push(a, b, c) {
        tri.push(nodes[a*3], nodes[a*3+1], nodes[a*3+2],
                 nodes[b*3], nodes[b*3+1], nodes[b*3+2],
                 nodes[c*3], nodes[c*3+1], nodes[c*3+2]);
      }
      for (var f = 0; f < faces.length; f++) {
        var fc = faces[f];
        var i0 = els[off + fc[0]], i1 = els[off + fc[1]], i2 = els[off + fc[2]];
        push(i0, i1, i2);
        if (fc.length === 4) push(i0, i2, els[off + fc[3]]);
      }
      if (tri.length === 0) return null;
      var geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(tri), 3));
      geo.computeVertexNormals();
      var grp = new THREE.Group();
      var fillMat = new THREE.MeshBasicMaterial({ color: color, transparent: true, opacity: (opacity == null ? 0.5 : opacity),
        side: THREE.DoubleSide, depthTest: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 });
      var fill = new THREE.Mesh(geo, fillMat);
      fill.renderOrder = 997; fill.raycast = function() {};
      grp.add(fill);
      if (typeof THREE.EdgesGeometry === 'function') {
        var edgeGeo = new THREE.EdgesGeometry(geo, 1);
        var line = new THREE.LineSegments(edgeGeo, new THREE.LineBasicMaterial({ color: color, transparent: true, opacity: 1, depthTest: false }));
        line.renderOrder = 998; line.raycast = function() {};
        grp.add(line);
      }
      grp.userData.feaMeshElementOverlay = true;
      return grp;
    },
    // Fare konumundan en yakın mesh elemanını döner (elementId | null).
    pickMeshElementFromMouse: function(clientX, clientY) {
      if (!this._meshData) return null;
      var pt = this.pickPointFromMouse(clientX, clientY);
      if (!pt) return null;
      var cen = this._ensureElementCentroids();
      if (!cen) return null;
      var best = -1, bestD = Infinity;
      var n = cen.length / 3;
      for (var e = 0; e < n; e++) {
        var dx = cen[e*3] - pt.x, dy = cen[e*3+1] - pt.y, dz = cen[e*3+2] - pt.z;
        var d = dx*dx + dy*dy + dz*dz;
        if (d < bestD) { bestD = d; best = e; }
      }
      return best >= 0 ? best : null;
    },
    // Bir mesh elemanını kalıcı seçili olarak vurgular (null → seçimi temizler).
    // Canvas köşesindeki "Eleman #id" etiketini de günceller.
    selectMeshElement: function(elementId) {
      if (this._meshElementHighlight) {
        this._geometryRoot.remove(this._meshElementHighlight);
        this._disposeOverlay(this._meshElementHighlight);
        this._meshElementHighlight = null;
      }
      this._selectedMeshElement = (elementId == null ? null : elementId);
      if (elementId != null) {
        var grp = this._buildElementOverlay(elementId, 0xfbbf24, 0.5);
        if (grp) { this._geometryRoot.add(grp); this._meshElementHighlight = grp; }
      }
      var cid = (canvas && typeof canvas.id === 'string') ? canvas.id.replace('ve-fea-mesh-canvas-', '').replace('ve-fea-geom-canvas-', '') : '';
      var label = document.getElementById('ve-fea-mesh-pick-label-' + cid);
      if (label) {
        if (elementId == null) { label.style.display = 'none'; }
        else { label.textContent = 'Eleman #' + elementId; label.style.display = 'block'; }
      }
      render();
    },
    // Fareyle üzerine gelinen elemanı geçici (hover) vurgular.
    hoverMeshElement: function(clientX, clientY) {
      var md = this._meshData;
      // Çok büyük mesh'lerde hover'ı atla (her mousemove'da O(N) maliyet).
      if (md && md.elements && md.nodesPerElement && (md.elements.length / md.nodesPerElement) > 150000) return;
      var eid = this.pickMeshElementFromMouse(clientX, clientY);
      if (eid === this._hoveredMeshElement) return;
      this._hoveredMeshElement = eid;
      if (this._meshElementHover) {
        this._geometryRoot.remove(this._meshElementHover);
        this._disposeOverlay(this._meshElementHover);
        this._meshElementHover = null;
      }
      if (eid != null && eid !== this._selectedMeshElement) {
        var grp = this._buildElementOverlay(eid, 0x2dd4bf, 0.28);
        if (grp) { this._geometryRoot.add(grp); this._meshElementHover = grp; }
      }
      if (canvas && canvas.style) canvas.style.cursor = (eid != null) ? 'pointer' : 'crosshair';
      render();
    },
    // Seçim + hover overlay'lerini ve etiketi temizler (mod kapatılınca çağrılır).
    clearMeshElementSelection: function() {
      if (this._meshElementHighlight) { this._geometryRoot.remove(this._meshElementHighlight); this._disposeOverlay(this._meshElementHighlight); }
      if (this._meshElementHover) { this._geometryRoot.remove(this._meshElementHover); this._disposeOverlay(this._meshElementHover); }
      this._meshElementHighlight = null;
      this._meshElementHover = null;
      this._selectedMeshElement = null;
      this._hoveredMeshElement = null;
      var cid = (canvas && typeof canvas.id === 'string') ? canvas.id.replace('ve-fea-mesh-canvas-', '').replace('ve-fea-geom-canvas-', '') : '';
      var label = document.getElementById('ve-fea-mesh-pick-label-' + cid);
      if (label) label.style.display = 'none';
      render();
    },
    // Display state'ini (mod, opaklık, clip planes) yeni eklenen mesh'e uygula
    _applyDisplayState: function(mesh) {
      this._applyDisplayModeToMesh(mesh);
      this._applyOpacityToMesh(mesh);
      _veFEAApplyClipPlanesToObject(mesh, this._clipPlanes);
    },
    _applyDisplayModeToMesh: function(mesh) {
      var mode = this._displayMode;
      mesh.traverse(function(obj) {
        if (obj.isMesh && obj.material) {
          var mats = Array.isArray(obj.material) ? obj.material : [obj.material];
          mats.forEach(function(m) {
            m.wireframe = (mode === 'wireframe');
            m.visible = true;
          });
        }
        if (obj.userData && obj.userData.feaEdges === true) {
          obj.visible = (mode === 'shaded-edges');
        }
      });
    },
    _applyOpacityToMesh: function(mesh) {
      var op = this._opacity;
      mesh.traverse(function(obj) {
        if (obj.isMesh && obj.material) {
          var mats = Array.isArray(obj.material) ? obj.material : [obj.material];
          mats.forEach(function(m) {
            m.opacity = op;
            m.transparent = (op < 1);
            m.needsUpdate = true;
          });
        }
      });
    },
    clearGeometry: function() {
      // Group içindeki tüm child'ları sil + buffer cleanup
      while(this._geometryRoot.children.length > 0) {
        var c = this._geometryRoot.children[0];
        this._geometryRoot.remove(c);
        c.traverse(function(o) {
          if(o.geometry && o.geometry.dispose) o.geometry.dispose();
          if(o.material) {
            if(Array.isArray(o.material)) o.material.forEach(function(m) { m.dispose && m.dispose(); });
            else if(o.material.dispose) o.material.dispose();
          }
        });
      }
      this._highlightMarker = null;
      this._highlightedSelectionKey = null;
      this._meshData = null;
      this._faceMaterials = null;
      this._hoveredFaceId = null;
      // _selectedFaceId korunur — kullanıcı seçimi geometri yedirme arasında saklı
      render();
    },
    zoomToFit: function(object) {
      var box = new THREE.Box3().setFromObject(object);
      if(box.isEmpty()) return;
      var size = box.getSize(new THREE.Vector3());
      var center = box.getCenter(new THREE.Vector3());
      var maxDim = Math.max(size.x, size.y, size.z);
      if(maxDim <= 0) return;
      var distance;
      if(camera.isOrthographicCamera) {
        // Ortografik: frustum boyutunu bbox'a göre ayarla
        var aspect = (canvas.width || width) / (canvas.height || height);
        var halfH = maxDim * 0.9;
        var halfW = halfH * aspect;
        camera.left = -halfW;
        camera.right = halfW;
        camera.top = halfH;
        camera.bottom = -halfH;
        camera.updateProjectionMatrix();
        distance = maxDim * 3; // pozisyon korunsa da target merkeze
      } else {
        var fov = camera.fov * (Math.PI / 180);
        distance = (maxDim / 2) / Math.tan(fov / 2) * 1.8;
      }
      target.copy(center);
      // Mevcut kamera yön vektörünü koru, sadece uzaklık değiştir
      var dir = camera.position.clone().sub(target);
      if(dir.lengthSq() < 1e-6) dir.set(1, 0.8, 1); // dejenere — varsayılan yön
      dir.normalize().multiplyScalar(distance);
      camera.position.copy(target).add(dir);
      camera.near = Math.max(0.1, distance * 0.01);
      camera.far = distance * 100;
      camera.updateProjectionMatrix();
      camera.lookAt(target);
      // Orbit controls'un spherical state'ini senkronla
      if(orbitHandle.sync) orbitHandle.sync();
      render();
    },
    // Parametre almadan tüm geometriyi sığdır (toolbar "Sığdır" düğmesi için)
    fitToGeometry: function() {
      if(this._geometryRoot.children.length === 0) return;
      this.zoomToFit(this._geometryRoot);
      this._viewHistoryCapture();
    },
    // Standart CAD görünümleri: 'iso', 'top', 'bottom', 'front', 'back', 'right', 'left'
    setStandardView: function(name) {
      var v = VE_FEA_STANDARD_VIEWS[name];
      if(!v) return;
      // Geometri varsa bbox merkezi target, yoksa origin
      var box = new THREE.Box3();
      if(this._geometryRoot.children.length > 0) box.setFromObject(this._geometryRoot);
      var center = box.isEmpty() ? new THREE.Vector3(0, 0, 0) : box.getCenter(new THREE.Vector3());
      var size = box.isEmpty() ? new THREE.Vector3(50, 50, 50) : box.getSize(new THREE.Vector3());
      var maxDim = Math.max(size.x, size.y, size.z, 10);
      var aspect = (canvas.width || width) / (canvas.height || height);
      var distance;
      if(camera.isOrthographicCamera) {
        var halfH = maxDim * 0.9;
        var halfW = halfH * aspect;
        camera.left = -halfW;
        camera.right = halfW;
        camera.top = halfH;
        camera.bottom = -halfH;
        camera.updateProjectionMatrix();
        distance = maxDim * 3;
      } else {
        var fov = camera.fov * (Math.PI / 180);
        distance = (maxDim / 2) / Math.tan(fov / 2) * 1.8;
      }
      target.copy(center);
      camera.up.set(v.up[0], v.up[1], v.up[2]);
      var dirVec = new THREE.Vector3(v.dir[0], v.dir[1], v.dir[2]).normalize().multiplyScalar(distance);
      camera.position.copy(target).add(dirVec);
      camera.lookAt(target);
      camera.near = Math.max(0.1, distance * 0.01);
      camera.far = distance * 100;
      camera.updateProjectionMatrix();
      if(orbitHandle.sync) orbitHandle.sync();
      this._viewHistoryCapture();
      render();
    },
    // Projeksiyon değişimi: 'perspective' veya 'orthographic'. Kamera
    // pozisyonu ve target korunur. Orbit handle yeni kamera referansını alır.
    projection: 'perspective',
    setProjection: function(type) {
      if(type !== 'perspective' && type !== 'orthographic') return;
      if(this.projection === type) return;
      var oldPos = camera.position.clone();
      var oldUp = camera.up.clone();
      var aspect = (canvas.width || width) / (canvas.height || height);

      var newCam;
      if(type === 'orthographic') {
        var box = new THREE.Box3();
        if(this._geometryRoot.children.length > 0) box.setFromObject(this._geometryRoot);
        var size = box.isEmpty() ? new THREE.Vector3(100, 100, 100) : box.getSize(new THREE.Vector3());
        var maxDim = Math.max(size.x, size.y, size.z, 10);
        var halfH = maxDim * 0.9;
        var halfW = halfH * aspect;
        newCam = new THREE.OrthographicCamera(-halfW, halfW, halfH, -halfH, 0.1, 5000);
      } else {
        newCam = new THREE.PerspectiveCamera(40, aspect, 0.1, 5000);
      }
      newCam.position.copy(oldPos);
      newCam.up.copy(oldUp);
      newCam.lookAt(target);

      // closure'daki camera referansını güncelle (render() ve orbit handle bunu kullanır)
      camera = newCam;
      this.camera = camera;
      this.projection = type;
      if(orbitHandle.setCamera) orbitHandle.setCamera(camera);
      render();
    },
    // ─── Grup B: Display modu / Opaklık / Arka plan ──────────────────────
    _displayMode: 'shaded', // 'shaded' | 'shaded-edges' | 'wireframe'
    _opacity: 1.0,
    _backgroundColor: resolvedBg,
    _isThemeBackground: usingThemeBg,
    _clipPlanes: [],
    _clipState: {
      x: { enabled: false, offset: 0 },
      y: { enabled: false, offset: 0 },
      z: { enabled: false, offset: 0 }
    },
    // ─── ANSYS-style Previous/Next view stack ─────────────────────────────
    // Kamera state snapshot'ları (position+target+zoom) — undo/redo mantığı.
    _viewHistory: [],       // { pos, target, zoom, projType }[]
    _viewHistoryIdx: -1,
    _viewHistoryCapture: function() {
      var snapshot = {
        pos: camera.position.toArray(),
        target: target.toArray(),
        projType: camera.isOrthographicCamera ? 'ortho' : 'persp'
      };
      if (camera.isOrthographicCamera) {
        snapshot.left = camera.left; snapshot.right = camera.right;
        snapshot.top = camera.top;   snapshot.bottom = camera.bottom;
      } else {
        snapshot.fov = camera.fov;
      }
      // Hâlihazırda undo'ya gittiyse, future-history'yi at
      if (this._viewHistoryIdx < this._viewHistory.length - 1) {
        this._viewHistory.length = this._viewHistoryIdx + 1;
      }
      this._viewHistory.push(snapshot);
      // Max 30 snapshot tut
      if (this._viewHistory.length > 30) this._viewHistory.shift();
      this._viewHistoryIdx = this._viewHistory.length - 1;
    },
    _viewHistoryRestore: function(idx) {
      if (idx < 0 || idx >= this._viewHistory.length) return;
      var s = this._viewHistory[idx];
      camera.position.fromArray(s.pos);
      target.fromArray(s.target);
      camera.lookAt(target);
      camera.updateProjectionMatrix();
      if(orbitHandle.sync) orbitHandle.sync();
      this._viewHistoryIdx = idx;
      render();
    },
    previousView: function() {
      if (this._viewHistoryIdx > 0) this._viewHistoryRestore(this._viewHistoryIdx - 1);
    },
    nextView: function() {
      if (this._viewHistoryIdx < this._viewHistory.length - 1) {
        this._viewHistoryRestore(this._viewHistoryIdx + 1);
      }
    },
    canGoPreviousView: function() { return this._viewHistoryIdx > 0; },
    canGoNextView:     function() { return this._viewHistoryIdx < this._viewHistory.length - 1; },

    // ─── ANSYS-style Pointer Mode (state machine) ─────────────────────────
    // Cursor her an ya 'view' (kamera kontrolü) ya da bir picking filter
    // modundadır. View modunda LMB orbit + sağ tık dynamic rotation center.
    // Face/Body pick modunda LMB seçim yapar.
    _pointerMode: 'view',  // 'view' | 'face-pick' | 'edge-pick' | 'vertex-pick' | 'body-pick' | 'box-select' | 'measure'
    setPointerMode: function(mode) {
      if (['view', 'face-pick', 'edge-pick', 'vertex-pick', 'body-pick', 'box-select', 'measure', 'mesh-pick'].indexOf(mode) < 0) mode = 'view';
      this._pointerMode = mode;
      // LMB her zaman seç olduğu için view modunda da default cursor.
      // Hover sırasında pointer hit varsa _onFaceMouseMove'da 'pointer' yapılır.
      var cursors = { 'view': 'default', 'face-pick': 'crosshair', 'edge-pick': 'crosshair', 'vertex-pick': 'crosshair', 'body-pick': 'crosshair', 'box-select': 'crosshair', 'measure': 'crosshair', 'mesh-pick': 'crosshair' };
      if (canvas && canvas.style) canvas.style.cursor = cursors[mode] || 'default';
      // Hit-coord overlay measure modunda aktif
      var coordDiv = document.getElementById('ve-fea-hit-coord-' + (canvas.id || '').replace('ve-fea-mesh-canvas-', '').replace('ve-fea-geom-canvas-', ''));
      if (coordDiv) coordDiv.style.display = (mode === 'measure') ? 'block' : 'none';
    },
    getPointerMode: function() { return this._pointerMode; },

    // ─── Dynamic rotation center (ANSYS-style) ─────────────────────────────
    // Geometriye sağ-tıklayınca o nokta rotation center'a (target) atanır,
    // kısa süreli kırmızı küre indicator gösterilir.
    setRotationCenterAt: function(worldPoint) {
      if (!worldPoint) return;
      target.copy(worldPoint);
      camera.lookAt(target);
      if (orbitHandle.sync) orbitHandle.sync();
      // Indicator: scene'e kırmızı küre, 1.2 sn sonra kaldır
      if (this._rotCenterMarker) {
        scene.remove(this._rotCenterMarker);
        if (this._rotCenterMarker.geometry && this._rotCenterMarker.geometry.dispose) this._rotCenterMarker.geometry.dispose();
        if (this._rotCenterMarker.material && this._rotCenterMarker.material.dispose) this._rotCenterMarker.material.dispose();
        this._rotCenterMarker = null;
      }
      var bbox = new THREE.Box3().setFromObject(this._geometryRoot || scene);
      var sz = bbox.isEmpty() ? 50 : Math.max(bbox.getSize(new THREE.Vector3()).x, bbox.getSize(new THREE.Vector3()).y, bbox.getSize(new THREE.Vector3()).z);
      var r = Math.max(0.5, sz * 0.012);
      var geo = new THREE.SphereGeometry(r, 16, 16);
      var mat = new THREE.MeshBasicMaterial({ color: 0xff3030, depthTest: false, transparent: true, opacity: 0.85 });
      var sphere = new THREE.Mesh(geo, mat);
      sphere.position.copy(worldPoint);
      sphere.renderOrder = 9999;
      scene.add(sphere);
      this._rotCenterMarker = sphere;
      var self = this;
      setTimeout(function() {
        if (self._rotCenterMarker === sphere) {
          scene.remove(sphere);
          if (sphere.geometry) sphere.geometry.dispose();
          if (sphere.material) sphere.material.dispose();
          self._rotCenterMarker = null;
          render();
        }
      }, 1200);
      render();
    },

    // ─── Hit point at screen coord (ANSYS Hit Point Coordinate) ───────────
    // İstenirse measure modunda cursor pozisyonundan canlı koordinat verir.
    pickPointFromMouse: function(clientX, clientY) {
      if (!this._geometryRoot || this._geometryRoot.children.length === 0) return null;
      var rect = canvas.getBoundingClientRect();
      var nx = ((clientX - rect.left) / rect.width) * 2 - 1;
      var ny = -((clientY - rect.top) / rect.height) * 2 + 1;
      var rc = new THREE.Raycaster();
      rc.setFromCamera({ x: nx, y: ny }, camera);
      var hits = rc.intersectObject(this._geometryRoot, true);
      for (var i = 0; i < hits.length; i++) {
        if (hits[i].point) return hits[i].point.clone();
      }
      return null;
    },
    // Tüm derin hit'ler (depth picking için) — raycaster mesafeye göre sıralı döner
    pickAllFromMouse: function(clientX, clientY) {
      if (!this._geometryRoot || this._geometryRoot.children.length === 0) return [];
      var rect = canvas.getBoundingClientRect();
      var nx = ((clientX - rect.left) / rect.width) * 2 - 1;
      var ny = -((clientY - rect.top) / rect.height) * 2 + 1;
      var rc = new THREE.Raycaster();
      rc.setFromCamera({ x: nx, y: ny }, camera);
      return rc.intersectObject(this._geometryRoot, true);
    },
    isMeasuring: function() { return this._pointerMode === 'measure'; },
    // Ölçüm pointlar listesi (toolbar button entegrasyonu için stub)
    addMeasurementPoint: function(pt) {
      this._measurementPoints = this._measurementPoints || [];
      this._measurementPoints.push(pt.clone());
    },
    setDisplayMode: function(mode) {
      if(mode !== 'shaded' && mode !== 'shaded-edges' && mode !== 'wireframe') return;
      this._displayMode = mode;
      // Tüm mesh'lere uygula. Edges shaded-edges modunda lazy attach.
      var self = this;
      this._geometryRoot.traverse(function(obj) {
        if (obj.isMesh) {
          if (mode === 'shaded-edges') _veFEAEnsureEdges(obj);
          self._applyDisplayModeToMesh(obj);
        }
      });
      render();
    },
    setOpacity: function(value) {
      var v = Number(value);
      if (!isFinite(v)) return;
      v = Math.max(0.05, Math.min(1, v));
      this._opacity = v;
      var self = this;
      this._geometryRoot.traverse(function(obj) {
        if (obj.isMesh) self._applyOpacityToMesh(obj);
      });
      render();
    },
    setBackground: function(colorOrPreset) {
      var color;
      if (colorOrPreset === 'theme') {
        // Aktif program temasına bağlan — tema değişince otomatik güncellenir.
        color = veFEAGetThemeBackgroundColor();
        this._isThemeBackground = true;
      } else if (typeof colorOrPreset === 'string' && VE_FEA_BG_PRESETS[colorOrPreset] !== undefined) {
        color = VE_FEA_BG_PRESETS[colorOrPreset];
        this._isThemeBackground = false;
      } else if (typeof colorOrPreset === 'number') {
        color = colorOrPreset;
        this._isThemeBackground = false;
      } else {
        return;
      }
      this._backgroundColor = color;
      try { scene.background = new THREE.Color(color); }
      catch (e) { return; }
      render();
    },
    // ─── Grup C: Section view (clip plane'ler) ───────────────────────────
    // axis: 'x' | 'y' | 'z', enabled: bool, offset: world space mesafe
    setClipPlane: function(axis, enabled, offset) {
      if (axis !== 'x' && axis !== 'y' && axis !== 'z') return;
      var state = this._clipState[axis];
      state.enabled = !!enabled;
      if (typeof offset === 'number' && isFinite(offset)) state.offset = offset;
      this._rebuildClipPlanes();
    },
    _rebuildClipPlanes: function() {
      var planes = [];
      var s = this._clipState;
      // Plane normal'i +axis yönünde; constant = -offset (yarım uzayı offset'in negatif tarafı bırakır)
      if (s.x.enabled) planes.push(new THREE.Plane(new THREE.Vector3(1, 0, 0), -s.x.offset));
      if (s.y.enabled) planes.push(new THREE.Plane(new THREE.Vector3(0, 1, 0), -s.y.offset));
      if (s.z.enabled) planes.push(new THREE.Plane(new THREE.Vector3(0, 0, 1), -s.z.offset));
      this._clipPlanes = planes;
      _veFEAApplyClipPlanesToObject(this._geometryRoot, planes);
      render();
    },
    getClipBoundsForAxis: function(axis) {
      // UI slider min/max için: bbox bounds döner
      var box = new THREE.Box3();
      if (this._geometryRoot.children.length > 0) box.setFromObject(this._geometryRoot);
      if (box.isEmpty()) return { min: -100, max: 100 };
      if (axis === 'x') return { min: box.min.x, max: box.max.x };
      if (axis === 'y') return { min: box.min.y, max: box.max.y };
      if (axis === 'z') return { min: box.min.z, max: box.max.z };
      return { min: -100, max: 100 };
    },
    // ─── Grup C: Mesfe Ölçümü ───────────────────────────────────────────
    _measurement: { active: false, points: [], group: null, distance: null, onChange: null },
    isMeasuring: function() { return this._measurement.active; },
    getMeasurementDistance: function() { return this._measurement.distance; },
    startMeasurement: function(onChange) {
      this._measurement.active = true;
      this._measurement.onChange = (typeof onChange === 'function') ? onChange : null;
      this._clearMeasurementGeometry();
      this._measurement.points = [];
      this._measurement.distance = null;
      if (this._measurement.onChange) this._measurement.onChange({ phase: 'start' });
    },
    stopMeasurement: function() {
      this._measurement.active = false;
      this._clearMeasurementGeometry();
      this._measurement.points = [];
      var d = this._measurement.distance;
      this._measurement.distance = null;
      if (this._measurement.onChange) this._measurement.onChange({ phase: 'stop' });
      this._measurement.onChange = null;
      render();
    },
    _clearMeasurementGeometry: function() {
      if (this._measurement.group) {
        this._measurement.group.traverse(function(o) {
          if (o.geometry && o.geometry.dispose) o.geometry.dispose();
          if (o.material && o.material.dispose) o.material.dispose();
        });
        scene.remove(this._measurement.group);
        this._measurement.group = null;
      }
    },
    // Raycaster ile noktayı yakala — canvas mouse koordinatları normalize edilmiş
    pickPointFromMouse: function(clientX, clientY) {
      var rect = canvas.getBoundingClientRect();
      var nx = ((clientX - rect.left) / rect.width) * 2 - 1;
      var ny = -((clientY - rect.top) / rect.height) * 2 + 1;
      var raycaster = new THREE.Raycaster();
      raycaster.setFromCamera({ x: nx, y: ny }, camera);
      var hits = raycaster.intersectObject(this._geometryRoot, true);
      // İlk gerçek mesh hit'i (edges/markers atla)
      for (var i = 0; i < hits.length; i++) {
        var o = hits[i].object;
        if (o.isMesh && !(o.userData && o.userData.feaMarker) && !(o.userData && o.userData.feaEdges)) {
          return hits[i].point.clone();
        }
      }
      return null;
    },
    // Bir nokta ekle (canvas click handler'ından çağrılır). 2'ye ulaşınca mesafe hesaplanır.
    addMeasurementPoint: function(point) {
      if (!this._measurement.active || !point) return;
      var m = this._measurement;
      // 2'ye ulaşmışsa sıfırla, yeni ölçüme başla
      if (m.points.length >= 2) {
        this._clearMeasurementGeometry();
        m.points = [];
        m.distance = null;
      }
      m.points.push(point.clone());

      // Marker mesh'i (küçük renkli küre)
      if (!m.group) {
        m.group = new THREE.Group();
        m.group.userData.feaMeasurementGroup = true;
        scene.add(m.group);
      }
      var box = new THREE.Box3();
      if (this._geometryRoot.children.length > 0) box.setFromObject(this._geometryRoot);
      var size = box.isEmpty() ? 50 : Math.max(box.getSize(new THREE.Vector3()).x, box.getSize(new THREE.Vector3()).y, box.getSize(new THREE.Vector3()).z);
      var radius = size * 0.012;
      var color = (m.points.length === 1) ? 0x22c55e : 0x3b82f6;
      var marker = new THREE.Mesh(
        new THREE.SphereGeometry(radius, 16, 16),
        new THREE.MeshBasicMaterial({ color: color, depthTest: false })
      );
      marker.position.copy(point);
      marker.userData.feaMarker = true;
      marker.renderOrder = 999;
      m.group.add(marker);

      if (m.points.length === 2) {
        // İki nokta arası çizgi
        var geo = new THREE.BufferGeometry().setFromPoints([m.points[0], m.points[1]]);
        var line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0xfbbf24, depthTest: false, linewidth: 2 }));
        line.userData.feaMarker = true;
        line.renderOrder = 998;
        m.group.add(line);
        m.distance = m.points[0].distanceTo(m.points[1]);
        if (m.onChange) m.onChange({ phase: 'measured', distance: m.distance, p1: m.points[0], p2: m.points[1] });
      } else if (m.points.length === 1 && m.onChange) {
        m.onChange({ phase: 'first', p1: m.points[0] });
      }
      render();
    },
    dispose: function() {
      this.clearGeometry();
      orbitHandle.dispose();
      renderer.dispose();
      // WebGL context cleanup
      var gl = renderer.getContext && renderer.getContext();
      if(gl && gl.getExtension) {
        var ext = gl.getExtension('WEBGL_lose_context');
        if(ext) ext.loseContext();
      }
    },
    resize: function(w, h) {
      renderer.setSize(w, h, false);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      render();
    }
  };

  // ─── Face hover/click selection handlers ─────────────────────────────────
  // Mouse hover: e.buttons === 0 (drag değil) durumunda raycaster ile
  // hangi face üzerinde olunduğunu bul, hover state'i güncelle.
  // Click: mousedown/mouseup pair — delta < 3px ise face select, aksi
  // halde orbit drag olduğu için skip.
  var _faceClickStart = null;
  function _faceIdFromHit(hit) {
    if (!hit || !hit.object) return null;
    var obj = hit.object;
    // Group child (shaft) — direkt userData.feaFaceId
    if (obj.userData && obj.userData.feaFaceId) return obj.userData.feaFaceId;
    // Multi-material mesh (box/cylinder) — face.materialIndex → faceMap
    if (obj.userData && obj.userData.feaFaceMap && hit.face && hit.face.materialIndex !== undefined) {
      return obj.userData.feaFaceMap[hit.face.materialIndex];
    }
    return null;
  }
  function _raycastFaceId(clientX, clientY) {
    if (!viewer._faceMaterials) return null;
    var rect = canvas.getBoundingClientRect();
    var nx = ((clientX - rect.left) / rect.width) * 2 - 1;
    var ny = -((clientY - rect.top) / rect.height) * 2 + 1;
    var rc = new THREE.Raycaster();
    rc.setFromCamera({ x: nx, y: ny }, camera);
    var hits = rc.intersectObject(viewer._geometryRoot, true);
    for (var i = 0; i < hits.length; i++) {
      // Sadece face owner mesh'ler (edges/markers skip)
      if (hits[i].object && hits[i].object.userData &&
          (hits[i].object.userData.feaFaceId || hits[i].object.userData.feaFaceMap)) {
        var fid = _faceIdFromHit(hits[i]);
        if (fid) return fid;
      }
    }
    return null;
  }
  // ANSYS-style Hit Point Coordinate overlay — measure / face-pick modunda
  // canvas üstündeki overlay div'i canlı koordinatlarla günceller.
  function _updateHitCoordOverlay(e) {
    var idStripped = (canvas.id || '').replace(/^ve-fea-(mesh|geom)-canvas-/, '');
    var div = document.getElementById('ve-fea-hit-coord-' + idStripped);
    if (!div) return;
    var mode = viewer._pointerMode || 'view';
    if (mode !== 'measure' && mode !== 'face-pick') { div.style.display = 'none'; return; }
    var pt = viewer.pickPointFromMouse(e.clientX, e.clientY);
    if (!pt) { div.style.display = 'none'; return; }
    div.style.display = 'block';
    div.textContent = 'X: ' + pt.x.toFixed(2) + '  Y: ' + pt.y.toFixed(2) + '  Z: ' + pt.z.toFixed(2);
  }

  function _onFaceMouseMove(e) {
    _updateHitCoordOverlay(e);
    if (e.buttons !== 0) return;  // orbit/pan drag sırasında hover skip
    // Mesh eleman seçimi modu — fareyle gezilen elemanı geçici (hover) vurgula
    if ((viewer._pointerMode || 'view') === 'mesh-pick') {
      if (typeof viewer.hoverMeshElement === 'function') viewer.hoverMeshElement(e.clientX, e.clientY);
      return;
    }
    if (!viewer._faceMaterials) return;
    var fid = _raycastFaceId(e.clientX, e.clientY);
    viewer.setHoveredFace(fid);
    if ((viewer._pointerMode || 'view') === 'view') {
      canvas.style.cursor = fid ? 'pointer' : 'default';
    }
  }
  function _onFaceMouseDown(e) {
    if (e.button !== 0) return;
    _faceClickStart = { x: e.clientX, y: e.clientY };
  }
  function _onFaceMouseUp(e) {
    if (e.button !== 0 || !_faceClickStart) return;
    var dx = e.clientX - _faceClickStart.x;
    var dy = e.clientY - _faceClickStart.y;
    _faceClickStart = null;
    if (dx * dx + dy * dy > 9) return;  // drag idi
    // Mesh eleman seçimi modu — tıklanan elemanı yakala + kalıcı vurgula
    if ((viewer._pointerMode || 'view') === 'mesh-pick') {
      var meid = (typeof viewer.pickMeshElementFromMouse === 'function') ? viewer.pickMeshElementFromMouse(e.clientX, e.clientY) : null;
      if (typeof viewer.selectMeshElement === 'function') viewer.selectMeshElement(meid);
      if (typeof veFEAOnViewerMeshElementSelected === 'function') veFEAOnViewerMeshElementSelected(meid);
      return;
    }
    // Önce edge/vertex picking dene — daha yakın bir line/marker bulunduysa o seçilir
    if (viewer._topologyEdges || viewer._topologyVertices) {
      var picked = _raycastEdgeOrVertex(e.clientX, e.clientY);
      if (picked.vertexId) {
        viewer.setSelectedVertex(picked.vertexId);
        if (typeof veFEAOnViewerVertexSelected === 'function') {
          veFEAOnViewerVertexSelected(picked.vertexId);
        }
        return;
      }
      if (picked.edgeId) {
        viewer.setSelectedEdge(picked.edgeId);
        if (typeof veFEAOnViewerEdgeSelected === 'function') {
          veFEAOnViewerEdgeSelected(picked.edgeId);
        }
        return;
      }
    }
    if (!viewer._faceMaterials) return;
    var fid = _raycastFaceId(e.clientX, e.clientY);
    viewer.setSelectedFace(fid);  // null da olabilir (boş alan)
    // Bridge: editor'e bildir (varsa)
    if (typeof veFEAOnViewerFaceSelected === 'function') {
      veFEAOnViewerFaceSelected(fid);
    }
    // ANSYS depth picking Z-stack: tıklamada üst üste 2+ hit varsa overlay göster
    _updateDepthStack(e);
  }

  // Edge / vertex raycasting — overlay grupları üzerinde line/sphere'leri picker.
  // Vertex marker'lar (küre) edge line'larından daha öncelikli — vertex'ler
  // edge endpoint'lerinde durur, mouse oraya değdiyse vertex'i seç.
  function _raycastEdgeOrVertex(clientX, clientY) {
    var result = { edgeId: null, vertexId: null };
    var rect = canvas.getBoundingClientRect();
    var nx = ((clientX - rect.left) / rect.width) * 2 - 1;
    var ny = -((clientY - rect.top) / rect.height) * 2 + 1;
    var rc = new THREE.Raycaster();
    rc.setFromCamera({ x: nx, y: ny }, camera);
    // Pixel-tabanlı threshold — bbox'a göre
    var bbS = (function() {
      var b = new THREE.Box3().setFromObject(viewer._geometryRoot);
      return b.isEmpty() ? 50 : Math.max(b.getSize(new THREE.Vector3()).x, b.getSize(new THREE.Vector3()).y, b.getSize(new THREE.Vector3()).z);
    })();
    rc.params.Line.threshold = Math.max(0.5, bbS * 0.005);  // %0.5 of bbox
    rc.params.Points = rc.params.Points || {};
    rc.params.Points.threshold = Math.max(1, bbS * 0.01);
    // Vertex marker'lar (sphere mesh'leri) — pickle önce
    if (viewer._vertexHighlightGroup) {
      var vHits = rc.intersectObject(viewer._vertexHighlightGroup, true);
      for (var i = 0; i < vHits.length; i++) {
        var vo = vHits[i].object;
        if (vo && vo.userData && vo.userData.feaVertexId) {
          result.vertexId = vo.userData.feaVertexId;
          return result;
        }
      }
    }
    // Edge line'lar
    if (viewer._edgeHighlightGroup) {
      var eHits = rc.intersectObject(viewer._edgeHighlightGroup, true);
      for (var i2 = 0; i2 < eHits.length; i2++) {
        var eo = eHits[i2].object;
        if (eo && eo.userData && eo.userData.feaEdgeId) {
          result.edgeId = eo.userData.feaEdgeId;
          return result;
        }
      }
    }
    return result;
  }
  // ─── ANSYS-style Depth Picking Z-Stack overlay ────────────────────────────
  // Tıklamada raycaster'ın tüm intersections'larını sol-alt overlay'de
  // dikey küçük rectangle yığını olarak göster. Üstteki = görünür face,
  // altındakiler = arkadaki face'ler (ışın boyunca). Tıklayınca o face'i seç.
  function _updateDepthStack(e) {
    var idStripped = (canvas.id || '').replace(/^ve-fea-(mesh|geom)-canvas-/, '');
    var stack = document.getElementById('ve-fea-depth-stack-' + idStripped);
    if (!stack) return;
    var hits = viewer.pickAllFromMouse(e.clientX, e.clientY) || [];
    // Sadece face owner mesh'leri tut, sırayla
    var faceHits = [];
    var seen = {};
    for (var i = 0; i < hits.length; i++) {
      var h = hits[i];
      if (!h || !h.object || !h.object.userData) continue;
      if (!(h.object.userData.feaFaceId || h.object.userData.feaFaceMap)) continue;
      var fid = _faceIdFromHit(h);
      if (!fid || seen[fid]) continue;
      seen[fid] = true;
      faceHits.push({ faceId: fid, distance: h.distance });
    }
    if (faceHits.length < 2) {
      stack.style.display = 'none';
      stack.innerHTML = '';
      return;
    }
    stack.style.display = 'flex';
    var sel = viewer._selectedFaceId;
    var html = '<div style="font-size:0.5rem; color:#999; padding:2px 4px; background:rgba(0,0,0,0.6);">Depth ' + faceHits.length + '</div>';
    faceHits.forEach(function(h, idx) {
      var isSel = (h.faceId === sel);
      var bgColor = isSel ? '#fbbf24' : (idx === 0 ? '#22c55e' : '#3b82f6');
      var op = isSel ? '1' : (0.4 + (faceHits.length - idx) / faceHits.length * 0.5);
      html += '<div data-depth-face="' + h.faceId + '" style="width:80px; padding:3px 6px; background:' + bgColor +
        '; color:#000; font-size:0.55rem; font-family:monospace; cursor:pointer; opacity:' + op + '; border:1px solid #000;"' +
        ' title="d=' + h.distance.toFixed(2) + ' — tıkla seç">' + h.faceId + '</div>';
    });
    stack.innerHTML = html;
    // Click handler — her satır
    var rows = stack.querySelectorAll('[data-depth-face]');
    rows.forEach(function(row) {
      row.addEventListener('click', function(ev) {
        ev.stopPropagation();
        var fid = this.getAttribute('data-depth-face');
        viewer.setSelectedFace(fid);
        if (typeof veFEAOnViewerFaceSelected === 'function') veFEAOnViewerFaceSelected(fid);
        // Stack güncelle (highlight değişecek)
        _updateDepthStack(e);
      });
      row.addEventListener('mouseenter', function() {
        var fid = this.getAttribute('data-depth-face');
        viewer.setHoveredFace(fid);
      });
      row.addEventListener('mouseleave', function() {
        viewer.setHoveredFace(null);
      });
    });
  }
  // Context menu disable — rotation center artık MMB'de (ANSYS davranışı).
  // RMB pan için kullanılıyor (orbit handle'da), browser context menu'yu kapat.
  function _onContextMenu(e) {
    e.preventDefault();
  }

  // ─── ANSYS-style Box Select (pointer mode = 'box-select') ─────────────────
  // LMB drag → ekran-uzayında dikdörtgen, mouseup'ta face center'larını
  // project et + rectangle içindekileri seç. Drag yönü:
  //   sağ→sol (dx<0) = crossing — rectangle'a *değen* face'ler.
  //   sol→sağ (dx>0) = window — *tamamen* içerideki face center'lar.
  var _boxStart = null;
  var _boxOverlay = null;
  function _ensureBoxOverlay() {
    if (_boxOverlay) return _boxOverlay;
    var parent = canvas.parentElement;
    if (!parent) return null;
    _boxOverlay = document.createElement('div');
    _boxOverlay.style.cssText = 'position:absolute; border:1px dashed #fbbf24; background:rgba(251,191,36,0.12); pointer-events:none; display:none;';
    parent.appendChild(_boxOverlay);
    return _boxOverlay;
  }
  function _onBoxMouseDown(e) {
    if ((viewer._pointerMode || 'view') !== 'box-select') return;
    if (e.button !== 0) return;
    var rect = canvas.getBoundingClientRect();
    _boxStart = { x: e.clientX, y: e.clientY, canvasRect: rect };
    var ov = _ensureBoxOverlay();
    if (ov) {
      ov.style.left = (e.clientX - rect.left) + 'px';
      ov.style.top = (e.clientY - rect.top) + 'px';
      ov.style.width = '0px';
      ov.style.height = '0px';
      ov.style.display = 'block';
    }
    e.preventDefault();
  }
  function _onBoxMouseMove(e) {
    if (!_boxStart) return;
    var ov = _boxOverlay;
    if (!ov) return;
    var rect = _boxStart.canvasRect;
    var x0 = _boxStart.x - rect.left;
    var y0 = _boxStart.y - rect.top;
    var x1 = e.clientX - rect.left;
    var y1 = e.clientY - rect.top;
    ov.style.left = Math.min(x0, x1) + 'px';
    ov.style.top = Math.min(y0, y1) + 'px';
    ov.style.width = Math.abs(x1 - x0) + 'px';
    ov.style.height = Math.abs(y1 - y0) + 'px';
    // Yön rengi: crossing = mavi-yeşil, window = sarı
    var crossing = (e.clientX < _boxStart.x);
    ov.style.border = '1px dashed ' + (crossing ? '#2dd4bf' : '#fbbf24');
    ov.style.background = crossing ? 'rgba(45,212,191,0.10)' : 'rgba(251,191,36,0.12)';
  }
  function _onBoxMouseUp(e) {
    if (!_boxStart) return;
    var rect = _boxStart.canvasRect;
    var x0 = _boxStart.x, y0 = _boxStart.y, x1 = e.clientX, y1 = e.clientY;
    var crossing = (x1 < x0);  // sağ→sol = crossing
    var startRectX = _boxStart.x; // sadece "ana" yön bilgisi
    if (_boxOverlay) _boxOverlay.style.display = 'none';
    _boxStart = null;
    if (Math.abs(x1 - x0) < 4 && Math.abs(y1 - y0) < 4) return;  // klik, drag değil

    if (!viewer._faceMaterials) return;
    // Her face center'ını ekran uzayına project et — selected list'i topla
    var minX = Math.min(x0, x1) - rect.left;
    var maxX = Math.max(x0, x1) - rect.left;
    var minY = Math.min(y0, y1) - rect.top;
    var maxY = Math.max(y0, y1) - rect.top;
    var w = canvas.width || canvas.clientWidth;
    var h = canvas.height || canvas.clientHeight;
    var selected = [];
    var faceIds = Object.keys(viewer._faceMaterials || {});
    var v = new THREE.Vector3();
    var allMeshes = [];
    viewer._geometryRoot.traverse(function(obj) {
      if (obj.isMesh && obj.userData && (obj.userData.feaFaceId || obj.userData.feaFaceMap)) {
        allMeshes.push(obj);
      }
    });
    // Her mesh için bbox center → project → screen → in/out test
    allMeshes.forEach(function(mesh) {
      var bbox = new THREE.Box3().setFromObject(mesh);
      if (bbox.isEmpty()) return;
      var c = bbox.getCenter(v.clone());
      var p = c.clone().project(camera);
      var sx = ((p.x + 1) / 2) * w;
      var sy = ((-p.y + 1) / 2) * h;
      if (sx >= minX && sx <= maxX && sy >= minY && sy <= maxY) {
        if (mesh.userData.feaFaceId) selected.push(mesh.userData.feaFaceId);
        else if (mesh.userData.feaFaceMap && mesh.userData.feaFaceMap.length > 0) {
          // Multi-material mesh: ilk faceId (mesh tek bir entity)
          selected.push(mesh.userData.feaFaceMap[0]);
        }
      }
    });
    // İlk seçileni viewer.setSelectedFace ile işaretle (UI çok-seçim sonra)
    if (selected.length > 0) {
      viewer.setSelectedFace(selected[selected.length - 1]);
      if (typeof veFEAOnViewerBoxSelected === 'function') {
        veFEAOnViewerBoxSelected(selected, crossing);
      }
      if (typeof veFEAOnViewerFaceSelected === 'function') {
        veFEAOnViewerFaceSelected(selected[selected.length - 1]);
      }
    }
  }

  canvas.addEventListener('mousemove', _onFaceMouseMove);
  canvas.addEventListener('mousemove', _onBoxMouseMove);
  canvas.addEventListener('mousedown', _onFaceMouseDown);
  canvas.addEventListener('mousedown', _onBoxMouseDown);
  window.addEventListener('mouseup', _onFaceMouseUp);
  window.addEventListener('mouseup', _onBoxMouseUp);
  canvas.addEventListener('contextmenu', _onContextMenu);
  // Dispose'da bunları temizle
  var origDispose = viewer.dispose;
  viewer.dispose = function() {
    canvas.removeEventListener('mousemove', _onFaceMouseMove);
    canvas.removeEventListener('mousemove', _onBoxMouseMove);
    canvas.removeEventListener('mousedown', _onFaceMouseDown);
    canvas.removeEventListener('mousedown', _onBoxMouseDown);
    window.removeEventListener('mouseup', _onFaceMouseUp);
    window.removeEventListener('mouseup', _onBoxMouseUp);
    canvas.removeEventListener('contextmenu', _onContextMenu);
    if (_boxOverlay && _boxOverlay.parentNode) _boxOverlay.parentNode.removeChild(_boxOverlay);
    _boxOverlay = null;
    if (typeof origDispose === 'function') origDispose.call(viewer);
  };

  // ANSYS-style: orbit handle'a viewer referansı ver → pointer mode'a
  // göre LMB davranışı + MMB rotation center.
  if (orbitHandle && typeof orbitHandle.setViewerRef === 'function') {
    orbitHandle.setViewerRef(viewer);
  }
  // Canvas referansını viewer'da sakla — veFEAInitGeometryViewerForNode
  // "aynı canvas mı?" kontrolü için kullanır (preserve-across-render fix).
  viewer._canvas = canvas;

  return viewer;
}

// ─── Manuel orbit / pan / zoom kontrolörü ───────────────────────────────────
// OrbitControls eşdeğeri ama UMD bundle ile uyumlu (Three.js 0.149 jsm ESM-only)
function veFEAAttachOrbitControls(canvas, cameraArg, target, requestRender) {
  if(!veFEAHasThree()) return { dispose: function() {} };

  var camera = cameraArg;
  var spherical = new THREE.Spherical();
  spherical.setFromVector3(camera.position.clone().sub(target));

  var isOrbit = false, isPan = false;
  var lastX = 0, lastY = 0;
  // ANSYS-style pointer mode entegrasyonu — viewer oluşturulduktan sonra
  // setViewerRef ile bağlanır. LMB davranışı buna göre değişir, MMB her
  // zaman orbit + rotation center, RMB pan.
  var viewerRef = null;
  function getPointerMode() {
    return (viewerRef && viewerRef._pointerMode) ? viewerRef._pointerMode : 'view';
  }

  function updateCamera() {
    var offset = new THREE.Vector3().setFromSpherical(spherical);
    camera.position.copy(target).add(offset);
    camera.lookAt(target);
    requestRender();
  }

  function onMouseDown(e) {
    // Modifiersiz CAD mouse layout (kullanıcı tercihi):
    //   LMB: seçim (face/edge/vertex) — orbit YOK.
    //   MMB: rotate (döndür).
    //   RMB: pan (modifier gerekmez).
    //   wheel: zoom.
    if (e.button === 0) {
      return;  // LMB: face/box handler işler, orbit asla yapma.
    } else if (e.button === 1) {
      isOrbit = true;   // MMB: rotate
    } else if (e.button === 2) {
      isPan = true;     // RMB: pan (modifier yok)
    } else return;
    lastX = e.clientX;
    lastY = e.clientY;
    e.preventDefault();
  }

  function onMouseMove(e) {
    if(!isOrbit && !isPan) return;
    var dx = e.clientX - lastX;
    var dy = e.clientY - lastY;
    lastX = e.clientX;
    lastY = e.clientY;

    if(isOrbit) {
      // Hassasiyet katsayıları yumuşatıldı — daha kontrollü, profesyonel his
      spherical.theta -= dx * 0.005;
      spherical.phi = Math.max(0.05, Math.min(Math.PI - 0.05, spherical.phi - dy * 0.005));
      updateCamera();
    } else if(isPan) {
      var panSpeed = spherical.radius * 0.0008;
      // Kameraya göre right/up vektörlerini hesapla
      var camDir = camera.position.clone().sub(target).normalize();
      var right = new THREE.Vector3().crossVectors(camera.up, camDir).normalize();
      var up = new THREE.Vector3().crossVectors(camDir, right).normalize();
      target.addScaledVector(right, -dx * panSpeed);
      target.addScaledVector(up, dy * panSpeed);
      updateCamera();
    }
  }

  function onMouseUp() {
    isOrbit = false;
    isPan = false;
  }

  function onWheel(e) {
    e.preventDefault();
    // Zoom kademe oranı düşürüldü — tek scroll ile küçük adım, akıcı yaklaşım
    var factor = e.deltaY > 0 ? 1.07 : 0.935;
    if(camera.isOrthographicCamera) {
      // Ortografik: frustum boyutu üzerinden zoom (mesafe görsel etki vermez)
      var newHalfW = (camera.right - camera.left) * factor / 2;
      var newHalfH = (camera.top - camera.bottom) * factor / 2;
      newHalfW = Math.max(1, Math.min(5000, newHalfW));
      newHalfH = Math.max(1, Math.min(5000, newHalfH));
      camera.left = -newHalfW;
      camera.right = newHalfW;
      camera.top = newHalfH;
      camera.bottom = -newHalfH;
      camera.updateProjectionMatrix();
      requestRender();
    } else {
      spherical.radius = Math.max(5, Math.min(2000, spherical.radius * factor));
      updateCamera();
    }
  }

  function onContextMenu(e) {
    e.preventDefault();
  }

  canvas.addEventListener('mousedown', onMouseDown);
  canvas.addEventListener('contextmenu', onContextMenu);
  canvas.addEventListener('wheel', onWheel, { passive: false });
  // mouseup/mousemove window'da — pencere dışına çıkıldığında da kayıt yakalanır
  window.addEventListener('mousemove', onMouseMove);
  window.addEventListener('mouseup', onMouseUp);

  return {
    // setProjection ile kamera referansı değişir; orbit handle'ın da onu
    // bilmesi gerek. closure'daki "camera" değişkenini yeniden atar.
    setCamera: function(newCam) {
      camera = newCam;
      spherical.setFromVector3(camera.position.clone().sub(target));
    },
    // zoomToFit gibi dış çağrılar kamerayı değiştirir; spherical state'i
    // mevcut camera pozisyonundan yeniden hesaplayarak senkronla.
    sync: function() {
      spherical.setFromVector3(camera.position.clone().sub(target));
    },
    // ANSYS-style pointer mode entegrasyonu — viewer init'inden sonra çağrılır
    setViewerRef: function(v) { viewerRef = v; },
    dispose: function() {
      canvas.removeEventListener('mousedown', onMouseDown);
      canvas.removeEventListener('contextmenu', onContextMenu);
      canvas.removeEventListener('wheel', onWheel);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    }
  };
}

// ─── cp-core dispatcher köprüsü ─────────────────────────────────────────────
// showNodeProperties() içinden setTimeout ile çağrılır.
function veFEAInitGeometryViewerForNode(nodeId) {
  var canvasId = 've-fea-geom-canvas-' + nodeId;
  var canvas = document.getElementById(canvasId);
  if(!canvas) return;

  // PRESERVE-ACROSS-RENDER FIX: Eski viewer hâlâ aynı canvas elementine
  // bağlıysa onu yeniden yarat MA — Chrome ~16 WebGL context limiti var,
  // her panel re-render'da context churn yaratırsak (dispose + recreate)
  // slot async-release nedeniyle sonradan null context döner ve render
  // bozulur. veFEAApplyPrimitive showNodeProperties öncesi canvas'ı DOM'dan
  // detach edip sonra geri yapıştırır; bu sayede aynı element kalır ve
  // mevcut viewer (aynı WebGL context) korunabilir.
  var existingViewer = veFEAViewerRegistry[nodeId];
  if (existingViewer && existingViewer._canvas === canvas) {
    // Aynı canvas → viewer hâlâ geçerli. Yalnızca node.data.geometry'den
    // sahneyi tazele.
    _veFEALoadNodeGeometryIntoViewer(existingViewer, nodeId);
    return;
  }

  // Canvas değişmiş (panel re-render, canvas preserve uygulanmamış) veya
  // ilk init → eski viewer'ı dispose et + sıfırdan oluştur.
  if(existingViewer) {
    try { existingViewer.dispose(); } catch(e) {}
    delete veFEAViewerRegistry[nodeId];
  }

  if(!veFEAHasThree()) {
    // Three.js yoksa kullanıcıya görsel bilgi ver
    var ctx = canvas.getContext && canvas.getContext('2d');
    if(ctx) {
      ctx.fillStyle = '#444';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#ddd';
      ctx.font = '12px sans-serif';
      ctx.fillText('Three.js yüklenmedi', 20, canvas.height / 2);
    }
    return;
  }

  var viewer = veFEAInitViewer(canvas, {
    width: canvas.clientWidth || 240,
    height: canvas.clientHeight || 180
  });
  if(!viewer) return;
  veFEAViewerRegistry[nodeId] = viewer;

  // Node geometrisini viewer'a sessizce yedir (persist/toast YOK).
  _veFEALoadNodeGeometryIntoViewer(viewer, nodeId);
}

// Verilen viewer'a node geometrisini/mesh'ini sessizce uygular. Hem küçük preview
// hem fullscreen modal tarafından kullanılır. Persist veya toast yapmaz —
// applySTEP/applyPrimitive zincirine girmez, dolayısıyla showNodeProperties
// yeniden tetiklenmez (sonsuz döngü koruması).
function _veFEALoadNodeGeometryIntoViewer(viewer, nodeId, opts) {
  if(!viewer || typeof nodes === 'undefined') return;
  var node = nodes.find && nodes.find(function(n) { return n.id === nodeId; });
  if(!node) return;
  // geometryOnly: çağıran geometri yüzeyini istiyor (ör. loadMeshOverGeometry'nin
  // "Geometri + Mesh Çizgileri" modu). Bu durumda aşağıdaki mesh-cache kısayolu
  // atlanır; aksi halde mesh wireframe'i solid geometrinin yerine geçer ve
  // yüzey hiç çizilmez (sadece tel kafes görünür).
  var geometryOnly = !!(opts && opts.geometryOnly);

  // Mesh node (veya birleşik 'fea' modülü): in-memory cache'ten mesh data
  // yedir (mesh data node.data'da değil, veFEAMeshCache global cache'inde).
  if (!geometryOnly && (node.type === 'fea-mesh' || node.type === 'fea') &&
      typeof veFEAMeshCache !== 'undefined' && veFEAMeshCache[nodeId] &&
      typeof viewer.loadMesh === 'function') {
    viewer.loadMesh(veFEAMeshCache[nodeId]);
    return;
  }

  if(!node.data || !node.data.geometry || !node.data.geometry.type) return;

  var g = node.data.geometry;
  if(g.type === 'step' && g.rawDataB64 && typeof veFEABase64ToArrayBuffer === 'function'
            && typeof veFEAParseSTEPBuffer === 'function' && typeof veFEAStepMeshesToParsed === 'function') {
    var stepBuf = veFEABase64ToArrayBuffer(g.rawDataB64);
    veFEAParseSTEPBuffer(stepBuf).then(function(result) {
      var parsedStep = veFEAStepMeshesToParsed(result);
      if(parsedStep && parsedStep.triangleCount > 0 && typeof viewer.loadTriangleMesh === 'function') {
        viewer.loadTriangleMesh(parsedStep);
      }
    }).catch(function(err) {
      console.error('[FEA] STEP yeniden yukleme hatasi:', err);
    });
  } else if (g.type && typeof viewer.loadPrimitive === 'function') {
    // Tüm primitif tipleri için aynı yol — veFEABuildPrimitiveMesh
    // dispatch'i `box`, `cylinder`, `shaft`, `sphere`, `hemisphere`,
    // `torus`, `cone`, `lbracket`, `ibeam`, `rectTube` hepsini biliyor.
    // Önceki kod sadece box/cylinder/shaft'ı yedirip diğerlerini sessizce
    // atlıyordu — kullanıcı şaft'tan sonraki primitif (sphere, vs.)
    // yeniden render edilmedi.
    viewer.loadPrimitive(g.type, g.params);
  }
  // Geometriyle birlikte topology data'yı viewer'a aktar (edge/vertex overlay)
  if (typeof viewer.setTopologyData === 'function') {
    var topo = g.topology;
    if (!topo && typeof veFEAComputeGeometryTopology === 'function') {
      topo = veFEAComputeGeometryTopology(g);
    }
    if (topo) viewer.setTopologyData(topo);
  }
}

// ─── Geometri uygulama köprüsü — cp-fea.js UI'sinden çağrılır ───────────────
// nodeId üzerine primitif yükler, node.data.geometry'yi günceller, paneli
// yeniden render eder (durum tablosu / "Geometriyi Sil" butonu güncellensin).
function veFEAApplyPrimitive(nodeId, type, params) {
  var p = (typeof veFEANormalizePrimitiveParams === 'function')
    ? veFEANormalizePrimitiveParams(type, params)
    : params;

  // 1) Mevcut viewer'a sahneyi hemen uygula — kullanıcı anında geri bildirim
  //    alır (showNodeProperties → setTimeout(100ms) gecikmesini beklemez).
  var viewer = veFEAViewerRegistry[nodeId];
  if (viewer && typeof viewer.loadPrimitive === 'function') {
    try { viewer.loadPrimitive(type, p); } catch (e) {
      console.warn('[FEA] loadPrimitive hata:', e.message);
    }
  }

  // 2) Data persist — viewer yoksa bile (ileride init olduğunda yedirilsin)
  if (typeof nodes !== 'undefined') {
    var node = nodes.find && nodes.find(function(n) { return n.id === nodeId; });
    if (node) {
      node.data = node.data || {};
      var stats = (typeof veFEAPrimitiveStats === 'function') ? veFEAPrimitiveStats(type, p) : null;
      node.data.geometry = {
        type: type,
        params: p,
        volume: stats ? stats.volume : null,
        surfaceArea: stats ? stats.surfaceArea : null,
        bbox: stats ? stats.bbox : null,
        sourceLabel: (typeof veFEAPrimitiveLabel === 'function') ? veFEAPrimitiveLabel(type) : type
      };
      if (typeof veFEAComputeGeometryTopology === 'function') {
        node.data.geometry.topology = veFEAComputeGeometryTopology(node.data.geometry);
      }
      // Geometri değişti → topoloji yeniden taranmalı (otomatik tarama guard'ı reset)
      node.data.topologyScanned = false;
      if (typeof saveState === 'function') saveState();
    }
  }

  // 3) CANVAS PRESERVE: showNodeProperties → content.innerHTML = html →
  //    canvas DOM elementi yeniden yaratılır → eski WebGL context kayıp +
  //    yenisi gerekir. Chrome ~16 concurrent WebGL context limiti var; her
  //    primitif submit'te yeni context oluşturmazsak Chrome dolar ve yeni
  //    context null gl döner ("precision" hatası / sessiz render bozulması).
  //
  //    Çözüm: Canvas elementini DOM'dan detach → innerHTML değişimi canvas'ı
  //    ETKİLEMEZ → yeniden render sonrası YENİ placeholder'ı eski canvas ile
  //    değiştir. Aynı element + aynı WebGL context + aynı viewer korunur.
  //    veFEAInitGeometryViewerForNode "aynı canvas mı?" check'iyle mevcut
  //    viewer'ı yeniden yaratmaz (preserve-across-render).
  var canvasId = 've-fea-geom-canvas-' + nodeId;
  var savedCanvas = document.getElementById(canvasId);
  var savedParent = savedCanvas ? savedCanvas.parentNode : null;
  if (savedCanvas && savedParent) {
    savedParent.removeChild(savedCanvas);
  }

  // 4) Panel yeniden render — durum tablosu, dropdown, butonlar güncellensin
  if (typeof showNodeProperties === 'function' && typeof nodes !== 'undefined') {
    var n = nodes.find && nodes.find(function(x) { return x.id === nodeId; });
    if (n) showNodeProperties(n);
  }
  // Birleşik modül editörü açıksa outline + Details panelini de yenile
  // (Geometri dalının state ikonu + durum tablosu güncellensin)
  if (typeof veFEAEditorRefreshAccordions === 'function') veFEAEditorRefreshAccordions();

  // 5) Yeni placeholder canvas'ı (showNodeProperties tarafından yaratıldı)
  //    eski (preserve edilmiş) canvas ile değiştir.
  if (savedCanvas) {
    var placeholder = document.getElementById(canvasId);
    if (placeholder && placeholder.parentNode) {
      placeholder.parentNode.replaceChild(savedCanvas, placeholder);
    }
  }
}

// STL import desteği kaldırıldı (sadece STEP). Eski veFEAApplySTL +
// veFEAOnSTLFileSelected kullanılmıyor, fea-step.js'in veFEAApplySTEP +
// veFEAOnSTEPFileSelected eşdeğerleri tek import yolu.

// cp-fea.js "Sığdır" düğmesi için — preview viewer'ın geometriyi sığdırması
function veFEAFitPreviewForNode(nodeId) {
  var viewer = veFEAViewerRegistry[nodeId];
  if(viewer && typeof viewer.fitToGeometry === 'function') viewer.fitToGeometry();
}

// In-memory mesh cache (büyük data persist edilmez; her session'da yeniden hesaplanır)
var veFEAMeshCache = {};

// Side panel + Mesh Editor modal'ini birlikte yeniler. State degisikliklerinde
// (mesh build/clear, heat map toggle, named selection, refinement uygula)
// her ikisinin de senkronize gostermesi icin tum eski showNodeProperties()
// cagrilari bu helper'a yonlendirildi.
function _veFEARefreshMeshUI(meshNode) {
  if (typeof showNodeProperties === 'function' && meshNode) showNodeProperties(meshNode);
  if (typeof veFEAEditorRefreshAccordions === 'function') veFEAEditorRefreshAccordions();
}

// Mesh node panel açıldığında çağrılır — fea-geometry'den input alıp viewer kurar
function veFEAInitMeshViewerForNode(nodeId, viewerOpts) {
  var canvasId = 've-fea-mesh-canvas-' + nodeId;
  var canvas = document.getElementById(canvasId);
  if (!canvas) return;

  if (veFEAViewerRegistry[nodeId]) {
    try { veFEAViewerRegistry[nodeId].dispose(); } catch(e) {}
    delete veFEAViewerRegistry[nodeId];
  }

  if (!veFEAHasThree()) {
    var ctx = canvas.getContext && canvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#444';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = '#ddd';
      ctx.font = '12px sans-serif';
      ctx.fillText('Three.js yüklenmedi', 20, canvas.height / 2);
    }
    return;
  }

  // Modal viewer için sade ayarlar (program teması ile uyumlu) + triad gizmo
  var opts = viewerOpts || {};
  var finalOpts = {
    width: canvas.clientWidth || 240,
    height: canvas.clientHeight || 180,
    background: opts.background,         // undefined ise default 0x1a1a1a
    gizmo: opts.gizmo !== false          // default true (XYZ ekseni)
  };
  var viewer = veFEAInitViewer(canvas, finalOpts);
  if (!viewer) return;
  veFEAViewerRegistry[nodeId] = viewer;

  // Cache'te mesh varsa otomatik yedir
  if (veFEAMeshCache[nodeId]) {
    var node = (typeof nodes !== 'undefined') ? nodes.find(function(n) { return n.id === nodeId; }) : null;
    // Display modu (ANSYS-style default: 'geom-mesh' = Geometri + siyah mesh edges)
    var displayMode = (node && node.data && node.data.heatMapMetric) || 'geom-mesh';
    if (displayMode === 'off') {
      // Wireframe modu (LineSegments, sadece edges)
      viewer.loadMesh(veFEAMeshCache[nodeId]);
    } else if (typeof veFEAApplyHeatMap === 'function') {
      veFEAApplyHeatMap(nodeId, displayMode);
    }
    if (node && node.data && node.data.highlightedSelection && typeof viewer.highlightNamedSelection === 'function') {
      viewer.highlightNamedSelection(node.data.highlightedSelection);
    }
  } else if (typeof veFEAFindUpstreamGeometryNode === 'function') {
    // Mesh henüz hesaplanmamış → upstream Geometri node'unu bul ve viewer'a
    // yedir (kullanıcı mesh oluşturmadan önce de geometriyi 3D olarak görsün)
    var geomNode = veFEAFindUpstreamGeometryNode(nodeId);
    if (geomNode && typeof _veFEALoadNodeGeometryIntoViewer === 'function') {
      _veFEALoadNodeGeometryIntoViewer(viewer, geomNode.id);
    }
  }

  // Persist edilmiş face selection'ı uygula (geometri yedirme sonrası)
  var nodeRef = (typeof nodes !== 'undefined') ? nodes.find(function(n) { return n.id === nodeId; }) : null;
  if (nodeRef && nodeRef.data && nodeRef.data.selectedFaceId && typeof viewer.setSelectedFace === 'function') {
    viewer.setSelectedFace(nodeRef.data.selectedFaceId);
  }
  // Topology data viewer'a aktar (edge/vertex overlay için)
  if (typeof veFEAFindUpstreamGeometryNode === 'function' && typeof viewer.setTopologyData === 'function') {
    var gNode = veFEAFindUpstreamGeometryNode(nodeId);
    if (gNode && gNode.data && gNode.data.geometry) {
      var topo = gNode.data.geometry.topology;
      if (!topo && typeof veFEAComputeGeometryTopology === 'function') {
        topo = veFEAComputeGeometryTopology(gNode.data.geometry);
      }
      if (topo) viewer.setTopologyData(topo);
    }
  }
  // Persist edilmiş edge / vertex seçimini de uygula
  if (nodeRef && nodeRef.data) {
    if (nodeRef.data.selectedEdgeId && typeof viewer.setSelectedEdge === 'function') {
      viewer.setSelectedEdge(nodeRef.data.selectedEdgeId);
    }
    if (nodeRef.data.selectedVertexId && typeof viewer.setSelectedVertex === 'function') {
      viewer.setSelectedVertex(nodeRef.data.selectedVertexId);
    }
  }
}

// Geometri → Mesh node bağlantısını bul (upstream)
function veFEAFindUpstreamGeometryNode(meshNodeId) {
  if (typeof nodes === 'undefined') return null;
  // Birleşik modül (Faz 1): aynı 'fea' node geometriyi de tutar
  var self = nodes.find(function(n) { return n.id === meshNodeId; });
  if (self && (self.type === 'fea' || (self.data && self.data.geometry))) return self;
  if (typeof connections === 'undefined') return null;
  var conn = connections.find(function(c) { return c.to === meshNodeId; });
  if (!conn) return null;
  var geomNode = nodes.find(function(n) { return n.id === conn.from && n.type === 'fea-geometry'; });
  return geomNode || null;
}

// Mesh oluştur — kullanıcı "Mesh Oluştur" butonuna tıklayınca
function veFEABuildMeshForNode(meshNodeId) {
  if (typeof veFEAMeshFromGeometry !== 'function') return;
  var geomNode = veFEAFindUpstreamGeometryNode(meshNodeId);
  if (!geomNode || !geomNode.data || !geomNode.data.geometry || !geomNode.data.geometry.type) {
    if (typeof showToast === 'function') showToast('Önce geometri tanımlayın (Geometri bloğu)', 'warning');
    return;
  }
  var geometry = geomNode.data.geometry;
  var meshNode = nodes.find(function(n) { return n.id === meshNodeId; });
  if (!meshNode) return;
  meshNode.data = meshNode.data || {};
  var settings = meshNode.data.meshSettings || {};
  if (!settings.size) settings.size = 10;
  if (!settings.mode) settings.mode = 'auto';
  if (!settings.elementType) settings.elementType = 'auto';
  if (settings.midSideNodes === undefined) settings.midSideNodes = false;
  if (!settings.curvatureRefinement) settings.curvatureRefinement = { enabled: false, normalAngleDeg: 18 };
  if (!settings.localSizing) settings.localSizing = { selection: 'none', biasStrength: 0 };
  if (settings.useWorker === undefined) settings.useWorker = false;
  if (settings.useTetMesher === undefined) settings.useTetMesher = true;
  if (settings.delaunayAddInteriorPoints === undefined) settings.delaunayAddInteriorPoints = true;
  if (settings.useTetgen === undefined) settings.useTetgen = true;
  if (settings.tetgenRadiusEdgeRatio === undefined) settings.tetgenRadiusEdgeRatio = 1.4;
  // Mesh smoothing: unstructured (STEP/voxel) tet için varsayılan AÇIK.
  if (settings.smoothing === undefined) settings.smoothing = true;
  if (settings.smoothingIterations === undefined) settings.smoothingIterations = 3;

  var t0 = Date.now();
  var editorActive = (typeof _veFEAEditorActive !== 'undefined' && _veFEAEditorActive === meshNodeId);

  // Delaunay tet mesher faz-bazlı ilerleme callback'i — UI overlay'i günceller
  var onMeshProgress = function(stage, msg) {
    if (!editorActive || typeof veFEAEditorShowLoading !== 'function') return;
    veFEAEditorShowLoading('Mesh oluşturuluyor...', msg);
  };

  var meshOpts = {
    size: settings.size,
    mode: settings.mode,
    elementType: settings.elementType,
    midSideNodes: settings.midSideNodes,
    curvatureRefinement: settings.curvatureRefinement,
    localSizing: settings.localSizing,
    sphereOfInfluence: settings.sphereOfInfluence,
    faceSizingControls: settings.faceSizingControls,
    edgeSizingControls: settings.edgeSizingControls,
    virtualTopology: settings.virtualTopology,
    defeaturingTolerance: settings.defeaturingTolerance,
    crossSection: settings.crossSection,
    useTetMesher: settings.useTetMesher,
    delaunayAddInteriorPoints: settings.delaunayAddInteriorPoints,
    delaunayAddSurfacePoints: settings.delaunayAddSurfacePoints,
    useTetgen: settings.useTetgen,
    tetgenRadiusEdgeRatio: settings.tetgenRadiusEdgeRatio,
    // smoothing: false → kapalı; aksi halde { iterations } config'i geçilir.
    smoothing: (settings.smoothing === false) ? false
             : { iterations: settings.smoothingIterations },
    onProgress: onMeshProgress
  };

  // ─── ANSYS-tarz outline kontrolleri entegrasyonu (Faz 3b) ──────────────
  // FEAMeshControls modülü yüklüyse, suppress filter + yeni kontrol tiplerini
  // (Body Sizing / Refinement / Method Override) etkin değerlere uygula.
  // Mesher API'sini değiştirmiyoruz; opts'a yeni alanlar eklenir + mevcut
  // alanlar (faceSizingControls vb.) suppress'lenmiş öğeler atılarak yeniden
  // doldurulur. Conflict resolution: hard > soft (rapor §4.3).
  if (typeof FEAMeshControls !== 'undefined') {
    try {
      // Suppress filter — sadece aktif kontrolleri pasla
      var actFS  = FEAMeshControls.activeControls(meshNode, 'faceSizing');
      var actES  = FEAMeshControls.activeControls(meshNode, 'edgeSizing');
      var actSOI = FEAMeshControls.activeControls(meshNode, 'soi');
      var actVT  = FEAMeshControls.activeControls(meshNode, 'virtualTopology');
      var actBS  = FEAMeshControls.activeControls(meshNode, 'bodySizing');
      var actRF  = FEAMeshControls.activeControls(meshNode, 'refinement');
      var actMO  = FEAMeshControls.activeControls(meshNode, 'methodOverride');

      // Mevcut listeleri suppress edilmiş öğelerden temizle (override)
      meshOpts.faceSizingControls = actFS.map(function(a) { return a.control; });
      meshOpts.edgeSizingControls = actES.map(function(a) { return a.control; });
      meshOpts.sphereOfInfluence  = actSOI.map(function(a) { return a.control; });
      meshOpts.virtualTopology    = actVT.map(function(a) { return a.control; });

      // Yeni alanlar — mesher şu an opts üzerinden okur, future-proof:
      meshOpts.bodySizingControls = actBS.map(function(a) { return a.control; });
      meshOpts.refinementControls = actRF.map(function(a) { return a.control; });
      meshOpts.methodOverrides    = actMO.map(function(a) { return a.control; });

      // Body Sizing: v1 single-body modelde global size'ı override et
      // (resolveBodySizingFor en sıkı kontrolü döndürür: hard > soft)
      var bsBest = FEAMeshControls.resolveBodySizingFor(meshNode, 0);
      if (bsBest && isFinite(bsBest.size) && bsBest.size > 0) {
        meshOpts.size = bsBest.size;
        // Persist'i settings'e geri yansıtma — kullanıcı global size'a dokunmadıysa
        // settings.size global olarak kalır; meshOpts override'ı sadece bu build'e
        // özgüdür.
      }

      // Method Override: v1 single-body modelde global meshMethod/elementOrder'ı
      // override et
      var moBest = FEAMeshControls.resolveBodyMethodOverride(meshNode, 0);
      if (moBest && moBest.method) {
        meshOpts.meshMethod = moBest.method;
        if (moBest.elementOrder && moBest.elementOrder !== 'program') {
          meshOpts.elementOrder = moBest.elementOrder;
          meshOpts.midSideNodes = (moBest.elementOrder === 'quadratic');
        }
      }
    } catch (controlsErr) {
      console.warn('[fea-mesh] outline kontrolleri uygulanamadı:', controlsErr);
    }
  }

  // Mesh editor modal aktifse loading overlay göster (faz ilerlemesi onProgress'ten gelir)
  if (editorActive && typeof veFEAEditorShowLoading === 'function') {
    var tetgenReady = (typeof veFEATetgenIsBuilt === 'function') && veFEATetgenIsBuilt() && settings.useTetgen !== false;
    var tetMesherReady = (typeof veFEADelaunayAvailable === 'function') && veFEADelaunayAvailable() && settings.useTetMesher !== false;
    var loadingSub = settings.useWorker ? 'Web Worker arka planda hesaplıyor...'
                   : (geometry.type === 'step' && tetgenReady) ? 'TetGen tet mesher hazırlanıyor (kaliteli CDT)...'
                   : (geometry.type === 'step' && tetMesherReady) ? 'Delaunay tet mesher hazırlanıyor...'
                   : (geometry.type === 'step') ? 'Voxelization + tet4 + boundary snap...'
                   : 'Yapısal mesh üretiliyor (' + (geometry.sourceLabel || geometry.type) + ')...';
    veFEAEditorShowLoading('Mesh oluşturuluyor...', loadingSub);
  }

  // STEP için async parse gerekebilir — promise-aware yol.
  // _parsedTriangles cached olsa bile, TetGen/Delaunay istemi async wrapper'dan geçer.
  var tetMesherWanted = settings.useTetMesher !== false &&
    (typeof veFEADelaunayAvailable === 'function') && veFEADelaunayAvailable();
  // TetGen istemi de async wrapper gerektirir (sync path WASM'a erişemez).
  var tetgenWanted = settings.useTetgen !== false &&
    (typeof veFEATetgenIsBuilt === 'function') && veFEATetgenIsBuilt();
  var needsAsync = (geometry.type === 'step') &&
    (!geometry._parsedTriangles || tetMesherWanted || tetgenWanted);
  var finishMesh = function(meshData) {
    // Loading overlay'i temizle (her durumda — hata yolu dahil)
    if (editorActive && typeof veFEAEditorHideLoading === 'function') veFEAEditorHideLoading();
    if (!meshData) {
      if (typeof showToast === 'function') showToast('Mesh oluşturulamadı (desteklenmeyen tip?)', 'error');
      if (editorActive && typeof veFEAEditorShowResultBanner === 'function') {
        veFEAEditorShowResultBanner('error', 'Mesh oluşturulamadı', 'Desteklenmeyen geometri tipi veya parse hatası');
      }
      return;
    }
    if (meshData.error === 'voxel-too-many') {
      var msg1 = 'Mesh boyu çok küçük: ' + meshData.total.toLocaleString('tr-TR') +
        ' voxel (üst sınır ' + VE_FEA_VOXEL_MAX_COUNT.toLocaleString('tr-TR') + '). Daha büyük mesh boyu seçin.';
      if (typeof showToast === 'function') showToast(msg1, 'error');
      if (editorActive && typeof veFEAEditorShowResultBanner === 'function') {
        veFEAEditorShowResultBanner('error', 'Mesh boyu çok küçük',
          meshData.total.toLocaleString('tr-TR') + ' voxel — sınır ' + VE_FEA_VOXEL_MAX_COUNT.toLocaleString('tr-TR') + '. Mesh boyutunu artırın.');
      }
      return;
    }
    if (meshData.error === 'voxel-empty') {
      if (typeof showToast === 'function') {
        showToast('Hiçbir voxel iç bölgede değil. Mesh boyu çok büyük olabilir veya yüzey kapalı değil.', 'warning');
      }
      if (editorActive && typeof veFEAEditorShowResultBanner === 'function') {
        veFEAEditorShowResultBanner('warning', 'Mesh boş', 'Voxel parite testi hiç iç hücre bulamadı — geometri kapalı (watertight) olmayabilir veya mesh boyu çok büyük.');
      }
      return;
    }
    var dt = Date.now() - t0;
    var metrics = veFEAComputeMeshMetrics(meshData);
    metrics.computeMs = dt;
    metrics.voxelMode = !!meshData.voxelMode;
    metrics.sweepAxis = meshData.sweepAxis || null;
    metrics.geometryType = meshData.geometryType || null;
    // Jacobian / signed volume — solver-uygunluk kontrolü
    if (typeof veFEAComputeJacobianMetrics === 'function') {
      metrics.jacobian = veFEAComputeJacobianMetrics(meshData);
    }
    // Kalite metrikleri: aspect ratio + skewness + iç açı + histogram
    if (typeof veFEAComputeQualityMetrics === 'function') {
      metrics.quality = veFEAComputeQualityMetrics(meshData);
    }
    // ANSYS-tarzı genel mesh kalite skoru (0-100 + derecelendirme)
    if (typeof veFEAComputeMeshQualityScore === 'function') {
      metrics.qualityScore = veFEAComputeMeshQualityScore(meshData);
    }

    // ANSYS-tarz outline'dan gelen Refinement kontrol metadata'sı (Faz 3b)
    // v1: meshData üzerine refinementApplied[] alanı yazar — gerçek bölme
    // Faz 2'de (size-field). Mesher tarafı no-op olarak çalışmaya devam eder.
    if (typeof FEAMeshControls !== 'undefined' && typeof FEAMeshControls.applyRefinementsToMesh === 'function') {
      try { FEAMeshControls.applyRefinementsToMesh(meshNode, meshData); } catch (e) {}
    }
    // Önceki başarısız mesh build'ten kalan controlKey hatasını temizle
    meshNode.data.meshError = null;

    veFEAMeshCache[meshNodeId] = meshData;
    meshNode.data.meshSettings = settings;
    meshNode.data.meshMetrics = metrics;
    meshNode.data.meshActive = true;
    // Named selections özetini persistence için sakla (nodeIds hariç).
    // Sınır Koşulları bloğu bu özetten yüzey seçeneklerini doldurur.
    if (typeof veFEAComputeNamedSelectionsSummary === 'function') {
      meshNode.data.namedSelectionsSummary = veFEAComputeNamedSelectionsSummary(meshData);
    }
    if (typeof saveState === 'function') saveState();

    var viewer = veFEAViewerRegistry[meshNodeId];
    if (viewer) {
      // Default: ANSYS-style 'geom-mesh' (geometri + siyah mesh çizgileri).
      // Kullanıcı bir display modu seçtiyse onu kullan.
      var dispMode = meshNode.data.heatMapMetric || 'geom-mesh';
      if (dispMode === 'off') {
        viewer.loadMesh(meshData);
      } else if (typeof veFEAApplyHeatMap === 'function') {
        veFEAApplyHeatMap(meshNodeId, dispMode);
      }
      if (meshNode.data.highlightedSelection && typeof viewer.highlightNamedSelection === 'function') {
        viewer.highlightNamedSelection(meshNode.data.highlightedSelection);
      }
    }

    if (typeof showToast === 'function') {
      showToast('Mesh oluşturuldu: ' + metrics.elementCount.toLocaleString('tr-TR') +
        ' eleman, ' + metrics.nodeCount.toLocaleString('tr-TR') + ' düğüm (' + dt + ' ms)', 'success');
      // Jacobian uyarıları (negatif/dejenere eleman varsa)
      if (metrics.jacobian && !metrics.jacobian.valid) {
        var jm = metrics.jacobian;
        var parts = [];
        if (jm.invertedCount > 0) parts.push(jm.invertedCount + ' ters dönmüş');
        if (jm.degenerateCount > 0) parts.push(jm.degenerateCount + ' dejenere');
        showToast('⚠ Mesh kalite uyarısı: ' + parts.join(', ') + ' eleman tespit edildi (solver patlayabilir)', 'warning');
      } else if (metrics.jacobian && metrics.jacobian.poorCount > 0) {
        showToast('Mesh kalite: ' + metrics.jacobian.poorCount + ' eleman düşük Jacobian oranlı (max ratio > ' +
          metrics.jacobian.ratioWarnThreshold + ')', 'info');
      }
    }

    // Mesh editor modal'da görsel sonuç banner'ı
    if (editorActive && typeof veFEAEditorShowResultBanner === 'function') {
      var bannerType = 'success';
      var bannerMsg = '✓ Mesh oluşturuldu — ' + metrics.elementCount.toLocaleString('tr-TR') +
                      ' eleman · ' + metrics.nodeCount.toLocaleString('tr-TR') + ' düğüm · ' + dt + ' ms';
      var bannerSub = '';
      if (typeof veFEAMeshLabel === 'function') {
        bannerSub = veFEAMeshLabel(metrics.elementType);
      }
      if (metrics.voxelMode) bannerSub += (bannerSub ? ' · ' : '') + 'voxel + boundary-snap';
      if (metrics.jacobian && !metrics.jacobian.valid) {
        bannerType = 'warning';
        bannerSub += (bannerSub ? ' · ' : '') + 'Jacobian uyarısı (negatif/dejenere eleman var)';
      }
      veFEAEditorShowResultBanner(bannerType, bannerMsg, bannerSub);
    }
    _veFEARefreshMeshUI(meshNode);
  };

  // Sync yolun başlamadan önce overlay'in DOM'a çizilebilmesi için
  // bir frame defer et. JS thread bloke olunca CSS animasyon duraklasa
  // bile en azından kullanıcı "Mesh oluşturuluyor..." mesajını görür.
  function _veFEADeferSync(fn) {
    if (typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(function() { requestAnimationFrame(fn); });
    } else {
      setTimeout(fn, 30);
    }
  }

  if (settings.useWorker && typeof veFEAMeshFromGeometryViaWorker === 'function') {
    if (typeof showToast === 'function') showToast('Mesh arka planda hesaplanıyor (Web Worker)...', 'info');
    veFEAMeshFromGeometryViaWorker(geometry, meshOpts).then(finishMesh).catch(function(err) {
      var msg = (err && err.message) ? err.message : String(err);
      if (typeof showToast === 'function') showToast('Worker hatası, sync deneniyor: ' + msg, 'warning');
      // Sync fallback
      try { finishMesh(veFEAMeshFromGeometry(geometry, meshOpts)); }
      catch (e2) {
        if (typeof showToast === 'function') showToast('Mesh hatası: ' + e2.message, 'error');
        if (editorActive && typeof veFEAEditorHideLoading === 'function') veFEAEditorHideLoading();
        if (editorActive && typeof veFEAEditorShowResultBanner === 'function') {
          veFEAEditorShowResultBanner('error', 'Mesh hatası', e2.message);
        }
      }
    });
  } else if (needsAsync && typeof veFEAMeshFromGeometryAsync === 'function') {
    if (typeof showToast === 'function') showToast('STEP mesh hesaplanıyor (voxelize)...', 'info');
    veFEAMeshFromGeometryAsync(geometry, meshOpts).then(finishMesh).catch(function(err) {
      var msg = (err && err.message) ? err.message : String(err);
      if (typeof showToast === 'function') showToast('Mesh hatası: ' + msg, 'error');
      if (editorActive && typeof veFEAEditorHideLoading === 'function') veFEAEditorHideLoading();
      if (editorActive && typeof veFEAEditorShowResultBanner === 'function') {
        veFEAEditorShowResultBanner('error', 'Mesh hatası', msg);
      }
      console.error('[FEA mesh]', err);
    });
  } else {
    // Sync yol: overlay renderlanması için bir frame bekle, sonra mesh üret.
    // Editor aktif değilse defer gerekmez (overlay yok).
    if (editorActive) {
      _veFEADeferSync(function() {
        try { finishMesh(veFEAMeshFromGeometry(geometry, meshOpts)); }
        catch (e3) {
          if (typeof showToast === 'function') showToast('Mesh hatası: ' + e3.message, 'error');
          if (typeof veFEAEditorHideLoading === 'function') veFEAEditorHideLoading();
          if (typeof veFEAEditorShowResultBanner === 'function') {
            veFEAEditorShowResultBanner('error', 'Mesh hatası', e3.message);
          }
        }
      });
    } else {
      finishMesh(veFEAMeshFromGeometry(geometry, meshOpts));
    }
  }
}

function veFEAClearMeshForNode(meshNodeId) {
  delete veFEAMeshCache[meshNodeId];
  var meshNode = (typeof nodes !== 'undefined') ? nodes.find(function(n) { return n.id === meshNodeId; }) : null;
  if (meshNode && meshNode.data) {
    delete meshNode.data.meshMetrics;
    delete meshNode.data.meshActive;
    delete meshNode.data.namedSelectionsSummary;
    delete meshNode.data.highlightedSelection;
    delete meshNode.data.heatMapMetric;
    if (typeof saveState === 'function') saveState();
  }
  var viewer = veFEAViewerRegistry[meshNodeId];
  if (viewer) viewer.clearGeometry();
  _veFEARefreshMeshUI(meshNode);
}

// Face selection köprüsü (iki yönlü sync):
//   - Topology accordion'daki satıra tıklama → bu fonksiyon → viewer.setSelectedFace
//   - Viewer'da face tıklama → veFEAOnViewerFaceSelected → bu fonksiyon (gelen yöne göre)
//   - State node.data.selectedFaceId'e persist edilir
//   - Editor accordion'ları refresh → topology satırı highlight güncellenir
function veFEASelectGeometryFace(meshNodeId, faceId, opts) {
  var meshNode = (typeof nodes !== 'undefined') ? nodes.find(function(n) { return n.id === meshNodeId; }) : null;
  if (!meshNode) return;
  meshNode.data = meshNode.data || {};
  // Aynı face'e tekrar tıklandıysa seçimi kaldır (toggle, sadece topology panel'inden gelen click'lerde)
  if (meshNode.data.selectedFaceId === faceId && !(opts && opts.fromViewer) && !(opts && opts.fromDropdown)) {
    faceId = null;
  }
  meshNode.data.selectedFaceId = faceId;
  // Lokal Yoğunlaştırma "Hedef" dropdown'u ile sync (Topology → Inflation)
  meshNode.data.meshSettings = meshNode.data.meshSettings || {};
  meshNode.data.meshSettings.localSizing = meshNode.data.meshSettings.localSizing || { biasMode: 'power', biasStrength: 0, firstLayerThickness: 1, growthRate: 1.2, layerCount: 5 };
  meshNode.data.meshSettings.localSizing.selection = faceId || 'none';
  var viewer = veFEAViewerRegistry[meshNodeId];
  if (viewer && typeof viewer.setSelectedFace === 'function') {
    viewer.setSelectedFace(faceId);
  }
  if (typeof saveState === 'function') saveState();
  // Editor accordion'ları yenile (topology satırı + lokal sizing dropdown güncellensin)
  if (typeof veFEAEditorRefreshAccordions === 'function') veFEAEditorRefreshAccordions();
}

// Lokal Yoğunlaştırma "Hedef" dropdown'undan face seçimi geldiğinde
// Topology + 3D viewer'ı da senkronize tutar (Inflation → Topology).
function veFEAOnLocalSelectionChange(meshNodeId, faceValue) {
  var faceId = (faceValue && faceValue !== 'none') ? faceValue : null;
  veFEASelectGeometryFace(meshNodeId, faceId, { fromDropdown: true });
}

// Viewer face click handler — 3D'de mouse ile seçim yapıldığında çağrılır.
function veFEAOnViewerFaceSelected(faceId) {
  if (!_veFEAEditorActive) return;
  veFEASelectGeometryFace(_veFEAEditorActive, faceId, { fromViewer: true });
}

// Viewer edge click handler — 3D'de mouse ile edge seçildiğinde çağrılır.
function veFEAOnViewerEdgeSelected(edgeId) {
  if (!_veFEAEditorActive) return;
  if (typeof veFEASelectGeometryEdge === 'function') {
    veFEASelectGeometryEdge(_veFEAEditorActive, edgeId);
  }
  // Topology sekmesini Edges'e çevir
  if (typeof veFEAEditorSetTopologyTab === 'function') {
    veFEAEditorSetTopologyTab(_veFEAEditorActive, 'edges');
  }
}

// Viewer vertex click handler — 3D'de mouse ile vertex seçildiğinde çağrılır.
function veFEAOnViewerVertexSelected(vertexId) {
  if (!_veFEAEditorActive) return;
  if (typeof veFEASelectGeometryVertex === 'function') {
    veFEASelectGeometryVertex(_veFEAEditorActive, vertexId);
  }
  if (typeof veFEAEditorSetTopologyTab === 'function') {
    veFEAEditorSetTopologyTab(_veFEAEditorActive, 'vertices');
  }
}

// Refinement önerisini uygula — UI butonundan çağrılır.
// suggestion.action.type:
//   'reduceSize'      → settings.size *= factor + re-build
//   'enableCurvature' → settings.curvatureRefinement enabled + re-build
function veFEAApplyRefinementSuggestion(meshNodeId, actionType, actionData) {
  var meshNode = (typeof nodes !== 'undefined') ? nodes.find(function(n) { return n.id === meshNodeId; }) : null;
  if (!meshNode) return;
  meshNode.data = meshNode.data || {};
  meshNode.data.meshSettings = meshNode.data.meshSettings || {};
  var s = meshNode.data.meshSettings;

  if (actionType === 'reduceSize') {
    var factor = (actionData && actionData.factor) || 0.8;
    if (factor < 0.05) factor = 0.05;
    if (factor > 1) factor = 1;
    var currentSize = s.size || 10;
    s.size = Math.max(VE_FEA_MESH_MIN_SIZE, currentSize * factor);
    if (typeof showToast === 'function') {
      showToast('Mesh boyu ' + currentSize.toFixed(2) + ' → ' + s.size.toFixed(2) + ' mm. Yeniden meshleniyor...', 'info');
    }
  } else if (actionType === 'enableCurvature') {
    s.curvatureRefinement = s.curvatureRefinement || {};
    s.curvatureRefinement.enabled = true;
    if (actionData && actionData.normalAngleDeg) s.curvatureRefinement.normalAngleDeg = actionData.normalAngleDeg;
    if (typeof showToast === 'function') {
      showToast('Curvature refinement aktif edildi (' + s.curvatureRefinement.normalAngleDeg + '°). Yeniden meshleniyor...', 'info');
    }
  } else {
    return;
  }

  if (typeof veFEABuildMeshForNode === 'function') veFEABuildMeshForNode(meshNodeId);
}

// Mesh görünüm modu (wireframe / solid / heat map). UI'dan çağrılır.
// mode değerleri:
//   'off' / null  → wireframe (default)
//   'solid'       → uniform solid (mavi)
//   'solid-edges' → solid + ince edge overlay
//   'aspect' | 'skewness' | 'minAngle' | 'jacobianRatio' → heat map
// Mesh node ID'sinden aşağı akıştaki solver node'unu bulur.
// BC → solver path: mesh → bc → solver
function _veFEAFindSolverNodeForMesh(meshNodeId) {
  if (typeof nodes === 'undefined') return null;
  // Birleşik modül (Faz 1): solver verisi aynı node'da
  var self = nodes.filter(function (n) { return n.id === meshNodeId; })[0];
  if (self && (self.type === 'fea' || (self.data && self.data.solver))) return self;
  if (typeof connections === 'undefined') return null;
  // mesh → bc
  var bcConn = connections.filter(function (c) { return c.from === meshNodeId; })[0];
  if (!bcConn) return null;
  var bcNode = nodes.filter(function (n) { return n.id === bcConn.to; })[0];
  if (!bcNode || bcNode.type !== 'fea-bc') return null;
  // bc → solver
  var solConn = connections.filter(function (c) { return c.from === bcNode.id; })[0];
  if (!solConn) return null;
  return nodes.filter(function (n) { return n.id === solConn.to; })[0] || null;
}

// Eski isim veFEAApplyHeatMap geriye uyumluluk için korunur.
// Mesh wireframe modunu güncelle ve mevcut display modunu yenile.
// 'all' / 'surface' / 'off' — kullanıcı tercihi meshSettings'e persist edilir.
function veFEASetWireframeMode(meshNodeId, mode) {
  if (typeof nodes === 'undefined') return;
  var meshNode = nodes.find(function(n) { return n.id === meshNodeId; });
  if (!meshNode) return;
  meshNode.data = meshNode.data || {};
  meshNode.data.meshSettings = meshNode.data.meshSettings || {};
  meshNode.data.meshSettings.wireframeMode = mode;
  if (typeof saveState === 'function') saveState();
  // Mevcut display mode'unu yeniden uygula (geom-mesh ise wireframe görünür değişir)
  var currentDisplay = meshNode.data.heatMapMetric || 'geom-mesh';
  if (typeof veFEAApplyHeatMap === 'function') {
    veFEAApplyHeatMap(meshNodeId, currentDisplay);
  }
}

function veFEAApplyHeatMap(meshNodeId, mode) {
  var meshNode = (typeof nodes !== 'undefined') ? nodes.find(function(n) { return n.id === meshNodeId; }) : null;
  if (!meshNode) return;
  meshNode.data = meshNode.data || {};

  var viewer = veFEAViewerRegistry[meshNodeId];
  var meshData = veFEAMeshCache[meshNodeId];

  // Wireframe (off)
  if (!mode || mode === 'off' || mode === 'none') {
    meshNode.data.heatMapMetric = null;
    if (viewer && meshData) viewer.loadMesh(meshData);
    _veFEARefreshMeshUI(meshNode);
    return;
  }

  meshNode.data.heatMapMetric = mode;
  if (!viewer || !meshData) {
    _veFEARefreshMeshUI(meshNode);
    return;
  }

  // ANSYS Body Color modu — Geometri + mesh edges (siyah çizgili)
  if (mode === 'geom-mesh') {
    var geomNode = (typeof veFEAFindUpstreamGeometryNode === 'function')
      ? veFEAFindUpstreamGeometryNode(meshNodeId) : null;
    // Wireframe modu kullanıcı tercihi: meshSettings.wireframeMode
    var wfMode = (meshNode.data.meshSettings && meshNode.data.meshSettings.wireframeMode) || 'all';
    viewer.loadMeshOverGeometry(meshData, geomNode ? geomNode.id : null, { wireframeMode: wfMode });
    _veFEARefreshMeshUI(meshNode);
    return;
  }

  // Solid modları (heat map'siz, mesh-derived yüzey)
  if (mode === 'solid' || mode === 'solid-edges') {
    viewer.loadMeshSolid(meshData, mode === 'solid-edges');
    _veFEARefreshMeshUI(meshNode);
    return;
  }

  // Threshold (ANSYS Mesh Quality Worksheet stili: yeşil/sarı/kırmızı)
  if (mode === 'threshold-aspect' || mode === 'threshold-skewness' ||
      mode === 'threshold-minAngle' || mode === 'threshold-jacobian') {
    if (typeof veFEAComputePerElementQuality !== 'function') return;
    var thrMetric, thrWarn, thrErr, thrInverted;
    if (mode === 'threshold-aspect')    { thrMetric = 'aspect';        thrWarn = 5;   thrErr = 20;  thrInverted = false; }
    else if (mode === 'threshold-skewness') { thrMetric = 'skewness';   thrWarn = 0.5; thrErr = 0.85; thrInverted = false; }
    else if (mode === 'threshold-minAngle') { thrMetric = 'minAngle';   thrWarn = 30;  thrErr = 15;  thrInverted = true; }
    else if (mode === 'threshold-jacobian') { thrMetric = 'jacobianRatio'; thrWarn = 5; thrErr = 40; thrInverted = false; }
    var thrVals = veFEAComputePerElementQuality(meshData, thrMetric);
    if (!thrVals) {
      if (typeof showToast === 'function') showToast('Threshold için kalite hesaplanamadı', 'warning');
      return;
    }
    if (typeof viewer.loadMeshThresholdMap === 'function') {
      viewer.loadMeshThresholdMap(meshData, thrVals, { warnLimit: thrWarn, errLimit: thrErr, inverted: thrInverted });
    }
    _veFEARefreshMeshUI(meshNode);
    return;
  }

  // Deformed shape sonuç görüntüleme — displacement + vonMises rengi
  if (mode === 'result-deformed') {
    var solverNodeD = _veFEAFindSolverNodeForMesh(meshNodeId);
    if (!solverNodeD || !solverNodeD.data || !solverNodeD.data.solver || !solverNodeD.data.solver.displacement) {
      if (typeof showToast === 'function') showToast('Önce çözücü ile sonuç hesaplanmalı', 'warning');
      return;
    }
    var sdD = solverNodeD.data.solver;
    var vmVals = sdD.vonMises;
    var vmMin = Infinity, vmMax = -Infinity;
    if (vmVals) {
      for (var ki = 0; ki < vmVals.length; ki++) {
        if (vmVals[ki] < vmMin) vmMin = vmVals[ki];
        if (vmVals[ki] > vmMax) vmMax = vmVals[ki];
      }
    } else { vmMin = 0; vmMax = 1; }
    // Otomatik ölçek: mesh bbox / max deplasman × 0.1
    var dispMags = veFEAComputeDisplacementMagnitudes(sdD.displacement);
    var maxDisp = dispMags.maxMag;
    var bboxSize = 1;
    if (meshData.nodes && meshData.nodes.length) {
      var minB = [Infinity, Infinity, Infinity], maxB = [-Infinity, -Infinity, -Infinity];
      for (var ni = 0; ni < meshData.nodes.length / 3; ni++) {
        for (var ax = 0; ax < 3; ax++) {
          var co = meshData.nodes[ni * 3 + ax];
          if (co < minB[ax]) minB[ax] = co;
          if (co > maxB[ax]) maxB[ax] = co;
        }
      }
      bboxSize = Math.max(maxB[0] - minB[0], maxB[1] - minB[1], maxB[2] - minB[2]);
    }
    var autoScale = (maxDisp > 0) ? (bboxSize * 0.1 / maxDisp) : 1;
    if (typeof viewer.loadMeshDeformed === 'function') {
      viewer.loadMeshDeformed(meshData, sdD.displacement, vmVals, vmMin, vmMax,
        { scale: autoScale, showUndeformed: true });
    }
    _veFEARefreshMeshUI(meshNode);
    return;
  }

  // Sonuç haritaları (vonMises, displacement, principalMax) — nodal values
  if (mode === 'result-vonMises' || mode === 'result-displacement' ||
      mode === 'result-principalMax' || mode === 'result-principalMin') {
    var solverNode = _veFEAFindSolverNodeForMesh(meshNodeId);
    if (!solverNode || !solverNode.data || !solverNode.data.solver) {
      if (typeof showToast === 'function') showToast('Önce çözücü ile sonuç hesaplanmalı', 'warning');
      return;
    }
    var sd = solverNode.data.solver;
    var nodalVals = null;
    if (mode === 'result-vonMises') nodalVals = sd.vonMises;
    else if (mode === 'result-displacement') {
      var dispMags = veFEAComputeDisplacementMagnitudes(sd.displacement);
      nodalVals = dispMags.mags;
    } else if (mode === 'result-principalMax') {
      // principal stored as flat [s1, s2, s3, s1, s2, s3, ...] per node
      var n = sd.principal.length / 3;
      nodalVals = new Float64Array(n);
      for (var i = 0; i < n; i++) nodalVals[i] = sd.principal[i * 3];
    } else if (mode === 'result-principalMin') {
      var n2 = sd.principal.length / 3;
      nodalVals = new Float64Array(n2);
      for (var j = 0; j < n2; j++) nodalVals[j] = sd.principal[j * 3 + 2];
    }
    if (!nodalVals) {
      if (typeof showToast === 'function') showToast('Sonuç verisi yok', 'warning');
      return;
    }
    // Min/max'i bul
    var rMin = Infinity, rMax = -Infinity;
    for (var ri = 0; ri < nodalVals.length; ri++) {
      if (nodalVals[ri] < rMin) rMin = nodalVals[ri];
      if (nodalVals[ri] > rMax) rMax = nodalVals[ri];
    }
    if (typeof viewer.loadMeshResultMap === 'function') {
      viewer.loadMeshResultMap(meshData, nodalVals, rMin, rMax);
    }
    _veFEARefreshMeshUI(meshNode);
    return;
  }

  // Heat map modları (rainbow)
  if (typeof veFEAComputePerElementQuality !== 'function') return;
  var values = veFEAComputePerElementQuality(meshData, mode);
  if (!values) {
    if (typeof showToast === 'function') showToast('Heat map için kalite hesaplanamadı', 'warning');
    return;
  }
  // Renklendirme aralığı: pratik üst sınırlar (renk çözünürlüğü için clamp)
  var vMin, vMax;
  if (mode === 'aspect') { vMin = 1; vMax = 20; }
  else if (mode === 'skewness') { vMin = 0; vMax = 1; }
  else if (mode === 'minAngle') { vMin = 0; vMax = 90; }
  else if (mode === 'jacobianRatio') { vMin = 1; vMax = 40; }
  else { vMin = 0; vMax = 1; }

  // minAngle için ters renkleme: küçük açı = kötü = kırmızı.
  if (mode === 'minAngle') {
    var inverted = new Float32Array(values.length);
    for (var i = 0; i < values.length; i++) inverted[i] = vMax - (values[i] - vMin);
    values = inverted;
  }

  viewer.loadMeshHeatMap(meshData, values, vMin, vMax);
  _veFEARefreshMeshUI(meshNode);
}

// Named selection vurgulama köprüsü — cp-fea.js UI butonundan çağrılır.
// Aynı key ikinci kez tıklanırsa highlight kapatılır (toggle davranışı).
function veFEAToggleNamedSelection(meshNodeId, key) {
  var meshNode = (typeof nodes !== 'undefined') ? nodes.find(function(n) { return n.id === meshNodeId; }) : null;
  if (!meshNode) return;
  meshNode.data = meshNode.data || {};
  var current = meshNode.data.highlightedSelection || null;
  var nextKey = (current === key) ? null : key;
  meshNode.data.highlightedSelection = nextKey;
  var viewer = veFEAViewerRegistry[meshNodeId];
  if (viewer && typeof viewer.highlightNamedSelection === 'function') {
    viewer.highlightNamedSelection(nextKey);
  }
  _veFEARefreshMeshUI(meshNode);
}

function veFEAClearGeometryForNode(nodeId) {
  var viewer = veFEAViewerRegistry[nodeId];
  if(viewer) viewer.clearGeometry();
  if(typeof nodes !== 'undefined') {
    var node = nodes.find && nodes.find(function(n) { return n.id === nodeId; });
    if(node && node.data) {
      delete node.data.geometry;
      if(typeof saveState === 'function') saveState();
    }
  }
  if(typeof showNodeProperties === 'function' && typeof nodes !== 'undefined') {
    var n = nodes.find && nodes.find(function(x) { return x.id === nodeId; });
    if(n) showNodeProperties(n);
  }
  // Birleşik modül editörü açıksa outline + Details panelini de yenile
  if (typeof veFEAEditorRefreshAccordions === 'function') veFEAEditorRefreshAccordions();
}

// ─── Kontrol paneli HTML şablonu (accordion yapı) ───────────────────────────
function _veFEAControlsPanelHTML() {
  var btnStyle = 'background:#2a2a2a; color:#ddd; border:1px solid #444; padding:5px 8px; font-size:0.66rem; cursor:pointer;';
  var headerStyle = 'width:100%; padding:8px 12px; background:#252525; color:#fff; border:none; text-align:left; cursor:pointer; font-size:0.72rem; font-weight:600; display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid #333;';
  var bodyStyle = 'padding:10px 12px; background:#1f1f1f; border-bottom:1px solid #333;';

  function section(id, title, content) {
    return '<div data-acc-id="' + id + '">' +
      '<button data-acc-header="' + id + '" style="' + headerStyle + '">' +
        '<span>' + title + '</span>' +
        '<span data-acc-arrow style="font-size:0.65rem;">▼</span>' +
      '</button>' +
      '<div data-acc-body="' + id + '" style="' + bodyStyle + '">' + content + '</div>' +
    '</div>';
  }

  // Panel header
  var html = '<div style="padding:8px 12px; background:#2a2a2a; border-bottom:1px solid #444; font-weight:600; font-size:0.75rem;"><span class="mf-ico mf-ico-settings"></span> Görüntüleyici Araçları</div>';

  // ─── Görünüm ───
  html += section('view', '🎯 Görünüm',
    '<div style="display:grid; grid-template-columns:repeat(4, 1fr); gap:4px; margin-bottom:6px;">' +
      '<button data-view="iso"    style="' + btnStyle + '">ISO</button>' +
      '<button data-view="top"    style="' + btnStyle + '">Üst</button>' +
      '<button data-view="bottom" style="' + btnStyle + '">Alt</button>' +
      '<button data-view="front"  style="' + btnStyle + '">Ön</button>' +
      '<button data-view="back"   style="' + btnStyle + '">Arka</button>' +
      '<button data-view="right"  style="' + btnStyle + '">Sağ</button>' +
      '<button data-view="left"   style="' + btnStyle + '">Sol</button>' +
    '</div>' +
    '<div style="display:flex; gap:4px;">' +
      '<button data-action="fit"  style="' + btnStyle + '; flex:1;">⛶ Sığdır</button>' +
      '<button data-action="proj" data-projection="perspective" style="' + btnStyle + '; flex:1;">Perspektif</button>' +
    '</div>'
  );

  // ─── Görüntü ───
  html += section('display', '🎨 Görüntü',
    '<button data-action="mode" data-mode="shaded" style="' + btnStyle + '; width:100%; margin-bottom:8px;">Mod: Shaded</button>' +
    '<div style="margin-bottom:8px;">' +
      '<div style="font-size:0.6rem; color:#bbb; margin-bottom:3px;">Opaklık</div>' +
      '<input data-action="opacity" type="range" min="10" max="100" value="100" style="width:100%; vertical-align:middle;">' +
    '</div>' +
    '<div>' +
      '<div style="font-size:0.6rem; color:#bbb; margin-bottom:3px;">Arka plan</div>' +
      '<select data-action="bg" style="' + btnStyle + '; width:100%;">' +
        '<option value="theme" selected>Tema</option>' +
        '<option value="dark">Koyu</option>' +
        '<option value="light">Açık</option>' +
        '<option value="white">Beyaz</option>' +
        '<option value="blue">Mavi</option>' +
      '</select>' +
    '</div>'
  );

  // ─── Etkileşim ───
  var clipRows = ['x','y','z'].map(function(ax) {
    return '<div data-axis="' + ax + '" style="display:flex; align-items:center; gap:6px; margin-bottom:4px;">' +
      '<label style="display:flex; align-items:center; gap:3px; min-width:34px;">' +
        '<input type="checkbox" data-role="enable">' +
        '<span style="font-weight:600;">' + ax.toUpperCase() + '</span>' +
      '</label>' +
      '<input type="range" data-role="offset" style="flex:1; min-width:0;">' +
      '<span data-role="value" style="min-width:42px; text-align:right; font-family:monospace; font-size:0.6rem;">—</span>' +
    '</div>';
  }).join('');

  html += section('interaction', '📐 Etkileşim',
    // Ölçüm
    '<div style="margin-bottom:10px;">' +
      '<button data-action="measure" data-active="false" style="' + btnStyle + '; width:100%; margin-bottom:6px;"><span class="mf-ico mf-ico-ruler"></span> Mesafe Ölç</button>' +
      '<div data-role="measure-status" style="display:none; padding:6px 8px; background:#2a2a2a; border:1px solid #444;">' +
        '<div data-role="status" style="color:#fbbf24; margin-bottom:4px; font-size:0.66rem;"><span class="mf-ico mf-ico-ruler"></span> İlk noktayı tıklayın</div>' +
        '<div style="display:flex; gap:4px;">' +
          '<button data-role="reset" style="' + btnStyle + '; flex:1; font-size:0.6rem; padding:4px;">Sıfırla</button>' +
          '<button data-role="close" style="background:#ef4444; color:#fff; border:none; padding:4px; font-size:0.6rem; cursor:pointer; flex:1;">Çık</button>' +
        '</div>' +
      '</div>' +
    '</div>' +
    // Kesit
    '<div>' +
      '<button data-action="clip" data-active="false" style="' + btnStyle + '; width:100%; margin-bottom:6px;">✂ Kesit Düzlemi</button>' +
      '<div data-role="clip-controls" style="display:none; padding:6px 8px; background:#2a2a2a; border:1px solid #444;">' + clipRows + '</div>' +
    '</div>'
  );

  return html;
}

// ─── Fullscreen UI helper'ları (ölçüm + kesit) ──────────────────────────────
function _veFEAStartMeasurementUI(viewer, btn, panel, canvas) {
  if (!viewer || !viewer.startMeasurement) {
    // viewer yoksa bile UI state güncellensin (tutarlı UX)
    if (panel) panel.style.display = 'block';
    if (btn) { btn.setAttribute('data-active', 'true'); btn.style.background = '#3b82f6'; }
    if (canvas) canvas.style.cursor = 'crosshair';
    return;
  }
  panel.style.display = 'block';
  btn.setAttribute('data-active', 'true');
  btn.style.background = '#3b82f6';
  canvas.style.cursor = 'crosshair';
  var statusEl = panel.querySelector('div[data-role="status"]') || panel.querySelector('span[data-role="status"]');
  viewer.startMeasurement(function(ev) {
    if (!statusEl) return;
    if (ev.phase === 'start' || ev.phase === 'reset') {
      statusEl.style.color = '#fbbf24';
      statusEl.textContent = '📏 İlk noktayı tıklayın';
    } else if (ev.phase === 'first') {
      statusEl.style.color = '#fbbf24';
      statusEl.textContent = '📏 İkinci noktayı tıklayın';
    } else if (ev.phase === 'measured') {
      statusEl.style.color = '#22c55e';
      var d = ev.distance;
      var unit = 'mm';
      if (d > 1000) { d = d / 1000; unit = 'm'; }
      statusEl.textContent = '📏 Mesfe: ' + d.toFixed(3) + ' ' + unit;
    }
  });
}
function _veFEAStopMeasurementUI(viewer, btn, panel, canvas) {
  if (viewer && viewer.stopMeasurement) viewer.stopMeasurement();
  panel.style.display = 'none';
  btn.setAttribute('data-active', 'false');
  btn.style.background = '#2a2a2a';
  canvas.style.cursor = '';
}
function _veFEAInitClipPanel(viewer, panel) {
  ['x','y','z'].forEach(function(axis) {
    var row = panel.querySelector('div[data-axis="' + axis + '"]');
    if (!row) return;
    var slider = row.querySelector('input[data-role="offset"]');
    var bounds = viewer.getClipBoundsForAxis(axis);
    slider.min = bounds.min;
    slider.max = bounds.max;
    slider.step = Math.max(0.1, (bounds.max - bounds.min) / 200);
    var state = viewer._clipState[axis];
    slider.value = state.offset;
    var check = row.querySelector('input[data-role="enable"]');
    check.checked = state.enabled;
    var valLabel = row.querySelector('span[data-role="value"]');
    valLabel.textContent = state.enabled ? Number(slider.value).toFixed(1) : '—';
  });
}

// ─── Tam ekran modal ────────────────────────────────────────────────────────
function veFEAOpenFullscreenViewer(nodeId) {
  // Mevcut modal varsa kapat
  veFEACloseFullscreenViewer();

  // <html>'in dogrudan cocugu olarak ekle — body altindaki sidebar/tab bar/
  // canvas wrapper'larin z-index/transform context'lerinden tamamen ayrilir.
  // Maksimum z-index ile garantili olarak ustte gosterilir.
  var overlay = document.createElement('div');
  overlay.id = 've-fea-fullscreen-overlay';
  overlay.style.cssText = [
    'position:fixed',
    'top:0', 'left:0', 'right:0', 'bottom:0',
    'width:100vw', 'height:100vh',
    'margin:0', 'padding:0',
    'background:rgba(0,0,0,0.92)',
    'z-index:2147483647',          // max int32 — başka hiçbir şeyin üstüne çıkamaz
    'display:flex',
    'flex-direction:column'
  ].join(';') + ';';

  // Üst toolbar — sade: sol başlık + sağ kapat
  var toolbar = document.createElement('div');
  toolbar.style.cssText = 'flex:0 0 auto; display:flex; align-items:center; justify-content:space-between; padding:8px 14px; background:#1f1f1f; border-bottom:1px solid #444; color:#fff;';
  toolbar.innerHTML =
    '<span style="font-size:0.82rem; font-weight:600;">Yapısal Analiz — 3D Görüntüleyici</span>' +
    '<button id="ve-fea-fullscreen-close" style="background:#ef4444; color:#fff; border:none; padding:6px 14px; font-size:0.7rem; cursor:pointer; white-space:nowrap;">✕ Kapat (Esc)</button>';

  // Canvas konteyneri — kalan tüm yüksekliği alır
  var canvasWrap = document.createElement('div');
  canvasWrap.style.cssText = 'flex:1 1 auto; position:relative; background:var(--bg-tertiary); min-height:0; overflow:hidden;';
  var canvas = document.createElement('canvas');
  canvas.id = 've-fea-fullscreen-canvas';
  canvas.style.cssText = 'display:block; width:100%; height:100%;';
  canvasWrap.appendChild(canvas);

  // ─── Sağ üst kontrol paneli — accordion yapı ──────────────────────────
  var controlsWrap = document.createElement('div');
  controlsWrap.id = 've-fea-controls-wrap';
  controlsWrap.style.cssText = 'position:absolute; top:14px; right:14px; display:flex; flex-direction:column; align-items:flex-end; gap:8px; max-height:calc(100% - 28px); pointer-events:none; z-index:5;';

  var toggleBtn = document.createElement('button');
  toggleBtn.id = 've-fea-controls-toggle';
  toggleBtn.style.cssText = 'pointer-events:auto; background:#1f1f1fee; color:#fff; border:1px solid #555; width:38px; height:38px; cursor:pointer; font-size:1rem; box-shadow:0 2px 8px rgba(0,0,0,0.4);';
  toggleBtn.innerHTML = '⚙';
  toggleBtn.title = 'Görüntüleyici araçları';

  var panel = document.createElement('div');
  panel.id = 've-fea-controls-panel';
  panel.style.cssText = 'pointer-events:auto; display:none; width:280px; max-height:100%; overflow-y:auto; background:#1f1f1f; border:1px solid #555; color:#fff; font-size:0.7rem; box-shadow:0 4px 16px rgba(0,0,0,0.5);';
  panel.innerHTML = _veFEAControlsPanelHTML();

  controlsWrap.appendChild(toggleBtn);
  controlsWrap.appendChild(panel);
  canvasWrap.appendChild(controlsWrap);

  // Geriye uyumluluk: ölçüm ve kesit referansları artık accordion içindeki div'ler
  var measurePanel = panel.querySelector('[data-role="measure-status"]');
  var clipPanel    = panel.querySelector('[data-role="clip-controls"]');

  overlay.appendChild(toolbar);
  overlay.appendChild(canvasWrap);
  // body yerine documentElement (html) altina ekle — body'nin transform/filter/
  // opacity context'leri overlay'i kapsamaz, z-index global kalir.
  (document.documentElement || document.body).appendChild(overlay);

  // Layout sonrasi gercek piksel boyutunu al
  var w = canvasWrap.clientWidth || window.innerWidth;
  var h = canvasWrap.clientHeight || (window.innerHeight - 50);
  canvas.width = w;
  canvas.height = h;

  var viewer = veFEAInitViewer(canvas, { width: w, height: h, gizmo: true });

  // Node geometrisini fullscreen viewer'a da yedir (eski versiyonda
  // unutulmustu — kullanici "buyuttugumde geometriyi goremiyorum" raporladi)
  _veFEALoadNodeGeometryIntoViewer(viewer, nodeId);

  // Resize handler
  function onResize() {
    if(!viewer) return;
    var nw = canvasWrap.clientWidth || window.innerWidth;
    var nh = canvasWrap.clientHeight || (window.innerHeight - 50);
    canvas.width = nw;
    canvas.height = nh;
    viewer.resize(nw, nh);
  }
  window.addEventListener('resize', onResize);

  // Esc tuşu ve kapat butonu
  function onKey(e) {
    if(e.key === 'Escape') veFEACloseFullscreenViewer();
  }
  document.addEventListener('keydown', onKey);

  document.getElementById('ve-fea-fullscreen-close').addEventListener('click', veFEACloseFullscreenViewer);

  // Kontrol paneli toggle
  toggleBtn.addEventListener('click', function() {
    var open = panel.style.display !== 'none';
    panel.style.display = open ? 'none' : 'block';
    toggleBtn.innerHTML = open ? '⚙' : '✕';
    toggleBtn.title = open ? 'Görüntüleyici araçları' : 'Paneli kapat';
  });

  // Accordion header'lar — bir başlığa tıklayınca o bölümün gövdesi açılır/kapanır
  panel.querySelectorAll('button[data-acc-header]').forEach(function(headerBtn) {
    headerBtn.addEventListener('click', function() {
      var id = this.getAttribute('data-acc-header');
      var body = panel.querySelector('div[data-acc-body="' + id + '"]');
      var arrow = this.querySelector('[data-acc-arrow]');
      if (!body) return;
      var isOpen = body.style.display !== 'none';
      body.style.display = isOpen ? 'none' : 'block';
      if (arrow) arrow.textContent = isOpen ? '▶' : '▼';
    });
  });

  // ─── Görünüm kategorisi: standart görünümler + sığdır + projeksiyon ─
  panel.querySelectorAll('button[data-view]').forEach(function(btn) {
    btn.addEventListener('click', function() {
      if (viewer && typeof viewer.setStandardView === 'function') {
        viewer.setStandardView(this.getAttribute('data-view'));
      }
    });
  });
  var fitBtn = panel.querySelector('button[data-action="fit"]');
  if (fitBtn) fitBtn.addEventListener('click', function() {
    if (viewer && typeof viewer.fitToGeometry === 'function') viewer.fitToGeometry();
  });
  var projBtn = panel.querySelector('button[data-action="proj"]');
  if (projBtn) projBtn.addEventListener('click', function() {
    var current = this.getAttribute('data-projection');
    var next = (current === 'perspective') ? 'orthographic' : 'perspective';
    this.setAttribute('data-projection', next);
    this.textContent = (next === 'perspective') ? 'Perspektif' : 'Ortografik';
    if (viewer && typeof viewer.setProjection === 'function') viewer.setProjection(next);
  });

  // ─── Görüntü kategorisi: mod + opaklık + arka plan ──────────────────
  var modeBtn = panel.querySelector('button[data-action="mode"]');
  if (modeBtn) modeBtn.addEventListener('click', function() {
    var cur = this.getAttribute('data-mode');
    var next = (cur === 'shaded') ? 'shaded-edges'
             : (cur === 'shaded-edges') ? 'wireframe'
             : 'shaded';
    this.setAttribute('data-mode', next);
    var label = (next === 'shaded') ? 'Shaded'
              : (next === 'shaded-edges') ? 'Shaded+Edges'
              : 'Wireframe';
    this.textContent = 'Mod: ' + label;
    if (viewer && typeof viewer.setDisplayMode === 'function') viewer.setDisplayMode(next);
  });
  var opacityInput = panel.querySelector('input[data-action="opacity"]');
  if (opacityInput) opacityInput.addEventListener('input', function() {
    if (!viewer || typeof viewer.setOpacity !== 'function') return;
    viewer.setOpacity(parseInt(this.value, 10) / 100);
  });
  var bgSelect = panel.querySelector('select[data-action="bg"]');
  if (bgSelect) bgSelect.addEventListener('change', function() {
    if (!viewer || typeof viewer.setBackground !== 'function') return;
    viewer.setBackground(this.value);
  });

  // ─── Etkileşim kategorisi: ölçüm + kesit ─────────────────────────────
  var measureBtn = panel.querySelector('button[data-action="measure"]');
  if (measureBtn) measureBtn.addEventListener('click', function() {
    if (!viewer) return;
    var active = this.getAttribute('data-active') === 'true';
    if (active) _veFEAStopMeasurementUI(viewer, measureBtn, measurePanel, canvas);
    else        _veFEAStartMeasurementUI(viewer, measureBtn, measurePanel, canvas);
  });

  var clipBtn = panel.querySelector('button[data-action="clip"]');
  if (clipBtn) clipBtn.addEventListener('click', function() {
    if (!viewer) return;
    var active = this.getAttribute('data-active') === 'true';
    if (active) {
      clipPanel.style.display = 'none';
      this.setAttribute('data-active', 'false');
      this.style.background = '#2a2a2a';
    } else {
      _veFEAInitClipPanel(viewer, clipPanel);
      clipPanel.style.display = 'block';
      this.setAttribute('data-active', 'true');
      this.style.background = '#3b82f6';
    }
  });

  // Kesit panel slider handler'ları
  clipPanel.querySelectorAll('div[data-axis]').forEach(function(row) {
    var axis = row.getAttribute('data-axis');
    var check = row.querySelector('input[data-role="enable"]');
    var slider = row.querySelector('input[data-role="offset"]');
    var valLabel = row.querySelector('span[data-role="value"]');
    function update() {
      var enabled = check.checked;
      var offset = parseFloat(slider.value);
      viewer.setClipPlane(axis, enabled, offset);
      valLabel.textContent = enabled ? offset.toFixed(1) : '—';
    }
    check.addEventListener('change', update);
    slider.addEventListener('input', update);
  });

  // Ölçüm modu için canvas click handler'ı
  function onCanvasClick(e) {
    if (!viewer || !viewer.isMeasuring || !viewer.isMeasuring()) return;
    var pt = viewer.pickPointFromMouse(e.clientX, e.clientY);
    if (pt) viewer.addMeasurementPoint(pt);
  }
  canvas.addEventListener('click', onCanvasClick);

  // Ölçüm panel butonları
  measurePanel.querySelector('button[data-role="reset"]').addEventListener('click', function() {
    if (viewer && viewer.startMeasurement) {
      // Yeniden başlat — onChange'ı koru
      var prev = viewer._measurement && viewer._measurement.onChange;
      viewer._clearMeasurementGeometry();
      viewer._measurement.points = [];
      viewer._measurement.distance = null;
      if (prev) prev({ phase: 'reset' });
    }
  });
  measurePanel.querySelector('button[data-role="close"]').addEventListener('click', function() {
    _veFEAStopMeasurementUI(viewer, measureBtn, measurePanel, canvas);
  });

  // Temizlik için handle'ı sakla
  veFEAViewerRegistry['__fullscreen__'] = {
    viewer: viewer,
    dispose: function() {
      window.removeEventListener('resize', onResize);
      document.removeEventListener('keydown', onKey);
      if(viewer) viewer.dispose();
      if(overlay && overlay.parentNode) overlay.parentNode.removeChild(overlay);
    }
  };
}

function veFEACloseFullscreenViewer() {
  var entry = veFEAViewerRegistry['__fullscreen__'];
  if(entry) {
    try { entry.dispose(); } catch(e) {}
    delete veFEAViewerRegistry['__fullscreen__'];
  }
}
