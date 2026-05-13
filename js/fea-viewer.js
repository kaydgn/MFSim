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

  var scene = new THREE.Scene();
  scene.background = new THREE.Color(opts.background || 0x1a1a1a);

  var camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 5000);
  camera.position.set(60, 50, 90);

  var renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
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
      this.zoomToFit(mesh);
      return mesh;
    },
    loadSTL: function(parsed) {
      if(typeof veFEABuildSTLMesh !== 'function') return null;
      this.clearGeometry();
      var mesh = veFEABuildSTLMesh(parsed);
      if(!mesh) return null;
      this._geometryRoot.add(mesh);
      _veFEAEnsureEdges(mesh);
      this._applyDisplayState(mesh);
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
    // Mesh'i renk-kodlu solid olarak yedirir. perValues: Float32Array (eleman/değer),
    // min/max: legend için sınırlar. Boundary face'ler üçgenleştirilip vertex
    // colors ile renklendirilir.
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
          new THREE.LineBasicMaterial({ color: 0x111111, transparent: true, opacity: 0.35 })
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
    _backgroundColor: opts.background || 0x1a1a1a,
    _clipPlanes: [],
    _clipState: {
      x: { enabled: false, offset: 0 },
      y: { enabled: false, offset: 0 },
      z: { enabled: false, offset: 0 }
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
      if (typeof colorOrPreset === 'string' && VE_FEA_BG_PRESETS[colorOrPreset] !== undefined) {
        color = VE_FEA_BG_PRESETS[colorOrPreset];
      } else if (typeof colorOrPreset === 'number') {
        color = colorOrPreset;
      } else {
        return;
      }
      this._backgroundColor = color;
      scene.background = new THREE.Color(color);
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

  function updateCamera() {
    var offset = new THREE.Vector3().setFromSpherical(spherical);
    camera.position.copy(target).add(offset);
    camera.lookAt(target);
    requestRender();
  }

  function onMouseDown(e) {
    if(e.button === 0) isOrbit = true;
    else if(e.button === 2) isPan = true;
    else return;
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
      spherical.theta -= dx * 0.01;
      spherical.phi = Math.max(0.05, Math.min(Math.PI - 0.05, spherical.phi - dy * 0.01));
      updateCamera();
    } else if(isPan) {
      var panSpeed = spherical.radius * 0.0015;
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
    var factor = e.deltaY > 0 ? 1.12 : 0.89;
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

  // Eski viewer'ı temizle
  if(veFEAViewerRegistry[nodeId]) {
    try { veFEAViewerRegistry[nodeId].dispose(); } catch(e) {}
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

// Verilen viewer'a node.data.geometry'yi sessizce uygular. Hem küçük preview
// hem fullscreen modal tarafından kullanılır. Persist veya toast yapmaz —
// applySTEP/applyPrimitive zincirine girmez, dolayısıyla showNodeProperties
// yeniden tetiklenmez (sonsuz döngü koruması).
function _veFEALoadNodeGeometryIntoViewer(viewer, nodeId) {
  if(!viewer || typeof nodes === 'undefined') return;
  var node = nodes.find && nodes.find(function(n) { return n.id === nodeId; });
  if(!node || !node.data || !node.data.geometry || !node.data.geometry.type) return;

  var g = node.data.geometry;
  if(g.type === 'stl' && g.rawDataB64 && typeof veFEABase64ToArrayBuffer === 'function' && typeof veFEAParseSTL === 'function') {
    var buf = veFEABase64ToArrayBuffer(g.rawDataB64);
    var parsed = veFEAParseSTL(buf);
    if(parsed) viewer.loadSTL(parsed);
  } else if(g.type === 'step' && g.rawDataB64 && typeof veFEABase64ToArrayBuffer === 'function'
            && typeof veFEAParseSTEPBuffer === 'function' && typeof veFEAStepMeshesToParsed === 'function') {
    var stepBuf = veFEABase64ToArrayBuffer(g.rawDataB64);
    veFEAParseSTEPBuffer(stepBuf).then(function(result) {
      var parsedStep = veFEAStepMeshesToParsed(result);
      if(parsedStep && parsedStep.triangleCount > 0 && typeof viewer.loadSTL === 'function') {
        viewer.loadSTL(parsedStep);
      }
    }).catch(function(err) {
      console.error('[FEA] STEP yeniden yukleme hatasi:', err);
    });
  } else if(g.type === 'box' || g.type === 'cylinder' || g.type === 'shaft') {
    viewer.loadPrimitive(g.type, g.params);
  }
}

// ─── Geometri uygulama köprüsü — cp-fea.js UI'sinden çağrılır ───────────────
// nodeId üzerine primitif yükler, node.data.geometry'yi günceller, paneli
// yeniden render eder (durum tablosu / "Geometriyi Sil" butonu güncellensin).
function veFEAApplyPrimitive(nodeId, type, params) {
  var viewer = veFEAViewerRegistry[nodeId];
  if(!viewer) return;
  var p = (typeof veFEANormalizePrimitiveParams === 'function')
    ? veFEANormalizePrimitiveParams(type, params)
    : params;
  viewer.loadPrimitive(type, p);

  // Persist
  if(typeof nodes !== 'undefined') {
    var node = nodes.find && nodes.find(function(n) { return n.id === nodeId; });
    if(node) {
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
      if(typeof saveState === 'function') saveState();
    }
  }

  // Panel yeniden render — durum tablosu güncellensin
  if(typeof showNodeProperties === 'function' && typeof nodes !== 'undefined') {
    var n = nodes.find && nodes.find(function(x) { return x.id === nodeId; });
    if(n) showNodeProperties(n);
  }
}

// ─── STL Apply köprüsü ─────────────────────────────────────────────────────
// Maksimum dosya boyutu (proje kaydında saklamak için).
var VE_FEA_STL_MAX_PERSIST_BYTES = 10 * 1024 * 1024; // 10 MB

function veFEAApplySTL(nodeId, buffer, fileName) {
  if(typeof veFEAParseSTL !== 'function') return;
  var parsed = veFEAParseSTL(buffer);
  if(!parsed || parsed.triangleCount === 0) {
    if(typeof showToast === 'function') showToast('STL dosyası geçersiz veya boş', 'error');
    return;
  }

  var viewer = veFEAViewerRegistry[nodeId];
  if(viewer) viewer.loadSTL(parsed);

  var stats = (typeof veFEAComputeMeshStats === 'function')
    ? veFEAComputeMeshStats(parsed)
    : { volume: 0, surfaceArea: 0, bbox: { x: 0, y: 0, z: 0 } };

  var byteLength = (buffer && buffer.byteLength) || 0;
  var canPersist = byteLength > 0 && byteLength <= VE_FEA_STL_MAX_PERSIST_BYTES;

  if(typeof nodes !== 'undefined') {
    var node = nodes.find && nodes.find(function(n) { return n.id === nodeId; });
    if(node) {
      node.data = node.data || {};
      node.data.geometry = {
        type: 'stl',
        sourceLabel: fileName || 'STL',
        triangleCount: parsed.triangleCount,
        fileSize: byteLength,
        volume: stats.volume,
        surfaceArea: stats.surfaceArea,
        bbox: stats.bbox,
        rawDataB64: canPersist ? veFEAArrayBufferToBase64(buffer) : null,
        persistNote: canPersist
          ? null
          : ('Dosya ' + (byteLength / (1024*1024)).toFixed(1) + ' MB — proje kaydında saklanmıyor, yeniden yükleyin.')
      };
      if(typeof saveState === 'function') saveState();
    }
  }

  if(typeof showToast === 'function') {
    var sizeMB = (byteLength / (1024*1024)).toFixed(2);
    showToast('STL yüklendi: ' + (fileName || '?') + ' (' + parsed.triangleCount + ' üçgen, ' + sizeMB + ' MB)', 'success');
  }

  if(typeof showNodeProperties === 'function' && typeof nodes !== 'undefined') {
    var n = nodes.find && nodes.find(function(x) { return x.id === nodeId; });
    if(n) showNodeProperties(n);
  }
}

// File <input> change handler — cp-fea.js HTML'inden çağrılır
function veFEAOnSTLFileSelected(input, nodeId) {
  if(!input || !input.files || !input.files[0]) return;
  var file = input.files[0];
  var reader = new FileReader();
  reader.onload = function(e) {
    veFEAApplySTL(nodeId, e.target.result, file.name);
  };
  reader.onerror = function() {
    if(typeof showToast === 'function') showToast('Dosya okunamadı: ' + file.name, 'error');
  };
  reader.readAsArrayBuffer(file);
  input.value = ''; // aynı dosyayı tekrar seçebilmek için
}

// cp-fea.js "Sığdır" düğmesi için — preview viewer'ın geometriyi sığdırması
function veFEAFitPreviewForNode(nodeId) {
  var viewer = veFEAViewerRegistry[nodeId];
  if(viewer && typeof viewer.fitToGeometry === 'function') viewer.fitToGeometry();
}

// In-memory mesh cache (büyük data persist edilmez; her session'da yeniden hesaplanır)
var veFEAMeshCache = {};

// Mesh node panel açıldığında çağrılır — fea-geometry'den input alıp viewer kurar
function veFEAInitMeshViewerForNode(nodeId) {
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

  var viewer = veFEAInitViewer(canvas, {
    width: canvas.clientWidth || 240,
    height: canvas.clientHeight || 180
  });
  if (!viewer) return;
  veFEAViewerRegistry[nodeId] = viewer;

  // Cache'te mesh varsa otomatik yedir
  if (veFEAMeshCache[nodeId]) {
    var node = (typeof nodes !== 'undefined') ? nodes.find(function(n) { return n.id === nodeId; }) : null;
    // Heat map aktifse renk-kodlu render; değilse wireframe + highlight
    if (node && node.data && node.data.heatMapMetric && typeof veFEAApplyHeatMap === 'function') {
      veFEAApplyHeatMap(nodeId, node.data.heatMapMetric);
    } else {
      viewer.loadMesh(veFEAMeshCache[nodeId]);
      if (node && node.data && node.data.highlightedSelection && typeof viewer.highlightNamedSelection === 'function') {
        viewer.highlightNamedSelection(node.data.highlightedSelection);
      }
    }
  }
}

// Geometri → Mesh node bağlantısını bul (upstream)
function veFEAFindUpstreamGeometryNode(meshNodeId) {
  if (typeof connections === 'undefined' || typeof nodes === 'undefined') return null;
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

  var t0 = Date.now();
  var meshOpts = {
    size: settings.size,
    mode: settings.mode,
    elementType: settings.elementType,
    midSideNodes: settings.midSideNodes
  };

  // STEP için async parse gerekebilir — promise-aware yol
  var needsAsync = (geometry.type === 'step');
  var finishMesh = function(meshData) {
    if (!meshData) {
      if (typeof showToast === 'function') showToast('Mesh oluşturulamadı (desteklenmeyen tip?)', 'error');
      return;
    }
    if (meshData.error === 'voxel-too-many') {
      if (typeof showToast === 'function') {
        showToast('Mesh boyu çok küçük: ' + meshData.total.toLocaleString('tr-TR') +
          ' voxel (üst sınır ' + VE_FEA_VOXEL_MAX_COUNT.toLocaleString('tr-TR') + '). Daha büyük mesh boyu seçin.', 'error');
      }
      return;
    }
    if (meshData.error === 'voxel-empty') {
      if (typeof showToast === 'function') {
        showToast('Hiçbir voxel iç bölgede değil. Mesh boyu çok büyük olabilir veya yüzey kapalı değil.', 'warning');
      }
      return;
    }
    var dt = Date.now() - t0;
    var metrics = veFEAComputeMeshMetrics(meshData);
    metrics.computeMs = dt;
    metrics.voxelMode = !!meshData.voxelMode;
    // Jacobian / signed volume — solver-uygunluk kontrolü
    if (typeof veFEAComputeJacobianMetrics === 'function') {
      metrics.jacobian = veFEAComputeJacobianMetrics(meshData);
    }
    // Kalite metrikleri: aspect ratio + skewness + iç açı + histogram
    if (typeof veFEAComputeQualityMetrics === 'function') {
      metrics.quality = veFEAComputeQualityMetrics(meshData);
    }

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
      if (meshNode.data.heatMapMetric && typeof veFEAApplyHeatMap === 'function') {
        // veFEAApplyHeatMap zaten cache + viewer.loadMeshHeatMap kullanır
        veFEAApplyHeatMap(meshNodeId, meshNode.data.heatMapMetric);
      } else {
        viewer.loadMesh(meshData);
        if (meshNode.data.highlightedSelection && typeof viewer.highlightNamedSelection === 'function') {
          viewer.highlightNamedSelection(meshNode.data.highlightedSelection);
        }
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
    if (typeof showNodeProperties === 'function') showNodeProperties(meshNode);
  };

  if (needsAsync && typeof veFEAMeshFromGeometryAsync === 'function') {
    if (typeof showToast === 'function') showToast('STEP mesh hesaplanıyor (voxelize)...', 'info');
    veFEAMeshFromGeometryAsync(geometry, meshOpts).then(finishMesh).catch(function(err) {
      var msg = (err && err.message) ? err.message : String(err);
      if (typeof showToast === 'function') showToast('Mesh hatası: ' + msg, 'error');
      console.error('[FEA mesh]', err);
    });
  } else {
    finishMesh(veFEAMeshFromGeometry(geometry, meshOpts));
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
  if (typeof showNodeProperties === 'function' && meshNode) showNodeProperties(meshNode);
}

// Heat map metrik seçimini uygula — UI'dan çağrılır.
// metric: 'aspect' | 'skewness' | 'minAngle' | 'jacobianRatio' | null (kapat)
function veFEAApplyHeatMap(meshNodeId, metric) {
  var meshNode = (typeof nodes !== 'undefined') ? nodes.find(function(n) { return n.id === meshNodeId; }) : null;
  if (!meshNode) return;
  meshNode.data = meshNode.data || {};

  var viewer = veFEAViewerRegistry[meshNodeId];
  var meshData = veFEAMeshCache[meshNodeId];

  if (!metric || metric === 'off' || metric === 'none') {
    meshNode.data.heatMapMetric = null;
    if (viewer && meshData) viewer.loadMesh(meshData);
    if (typeof showNodeProperties === 'function') showNodeProperties(meshNode);
    return;
  }

  meshNode.data.heatMapMetric = metric;
  if (!viewer || !meshData) {
    if (typeof showNodeProperties === 'function') showNodeProperties(meshNode);
    return;
  }
  if (typeof veFEAComputePerElementQuality !== 'function') return;

  var values = veFEAComputePerElementQuality(meshData, metric);
  if (!values) {
    if (typeof showToast === 'function') showToast('Heat map için kalite hesaplanamadı', 'warning');
    return;
  }
  // Renklendirme aralığı: pratik üst sınırlar (renk çözünürlüğü için clamp)
  var vMin, vMax;
  if (metric === 'aspect') { vMin = 1; vMax = 20; }
  else if (metric === 'skewness') { vMin = 0; vMax = 1; }
  else if (metric === 'minAngle') { vMin = 0; vMax = 90; }
  else if (metric === 'jacobianRatio') { vMin = 1; vMax = 40; }
  else { vMin = 0; vMax = 1; }

  // minAngle için ters renkleme: küçük açı = kötü = kırmızı.
  // veFEAJetColor düşük t = mavi (iyi), yüksek t = kırmızı (kötü).
  // Diğer metriklerde değer büyüdükçe kötü, doğal eşleşme.
  // minAngle: değer küçük = kötü → t = 1 - normalized
  if (metric === 'minAngle') {
    var inverted = new Float32Array(values.length);
    for (var i = 0; i < values.length; i++) inverted[i] = vMax - (values[i] - vMin);
    values = inverted;
  }

  viewer.loadMeshHeatMap(meshData, values, vMin, vMax);
  if (typeof showNodeProperties === 'function') showNodeProperties(meshNode);
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
  if (typeof showNodeProperties === 'function') showNodeProperties(meshNode);
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
  var html = '<div style="padding:8px 12px; background:#2a2a2a; border-bottom:1px solid #444; font-weight:600; font-size:0.75rem;">⚙ Görüntüleyici Araçları</div>';

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
        '<option value="dark"  selected>Koyu</option>' +
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
      '<button data-action="measure" data-active="false" style="' + btnStyle + '; width:100%; margin-bottom:6px;">📏 Mesafe Ölç</button>' +
      '<div data-role="measure-status" style="display:none; padding:6px 8px; background:#2a2a2a; border:1px solid #444;">' +
        '<div data-role="status" style="color:#fbbf24; margin-bottom:4px; font-size:0.66rem;">📏 İlk noktayı tıklayın</div>' +
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
  canvasWrap.style.cssText = 'flex:1 1 auto; position:relative; background:#1a1a1a; min-height:0; overflow:hidden;';
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
