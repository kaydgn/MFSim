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
      Object.keys(this._faceMaterials).forEach(function(fid) {
        var mat = this._faceMaterials[fid];
        if (!mat || !mat.emissive) return;
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
      // 1. Geometriyi yedir (mevcut helper kendi clearGeometry yapar)
      if (geomNodeId && typeof _veFEALoadNodeGeometryIntoViewer === 'function') {
        _veFEALoadNodeGeometryIntoViewer(this, geomNodeId);
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
  function _onFaceMouseMove(e) {
    if (e.buttons !== 0) return;  // orbit/pan drag sırasında hover skip
    if (!viewer._faceMaterials) return;
    var fid = _raycastFaceId(e.clientX, e.clientY);
    viewer.setHoveredFace(fid);
    canvas.style.cursor = fid ? 'pointer' : 'grab';
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
    if (!viewer._faceMaterials) return;
    var fid = _raycastFaceId(e.clientX, e.clientY);
    viewer.setSelectedFace(fid);  // null da olabilir (boş alan)
    // Bridge: editor'e bildir (varsa)
    if (typeof veFEAOnViewerFaceSelected === 'function') {
      veFEAOnViewerFaceSelected(fid);
    }
  }
  canvas.addEventListener('mousemove', _onFaceMouseMove);
  canvas.addEventListener('mousedown', _onFaceMouseDown);
  window.addEventListener('mouseup', _onFaceMouseUp);
  // Dispose'da bunları temizle
  var origDispose = viewer.dispose;
  viewer.dispose = function() {
    canvas.removeEventListener('mousemove', _onFaceMouseMove);
    canvas.removeEventListener('mousedown', _onFaceMouseDown);
    window.removeEventListener('mouseup', _onFaceMouseUp);
    if (typeof origDispose === 'function') origDispose.call(viewer);
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

// Verilen viewer'a node geometrisini/mesh'ini sessizce uygular. Hem küçük preview
// hem fullscreen modal tarafından kullanılır. Persist veya toast yapmaz —
// applySTEP/applyPrimitive zincirine girmez, dolayısıyla showNodeProperties
// yeniden tetiklenmez (sonsuz döngü koruması).
function _veFEALoadNodeGeometryIntoViewer(viewer, nodeId) {
  if(!viewer || typeof nodes === 'undefined') return;
  var node = nodes.find && nodes.find(function(n) { return n.id === nodeId; });
  if(!node) return;

  // Mesh node: in-memory cache'ten mesh data yedir (kullanıcı raporladığı
  // "tam ekran mesh gelmiyor" sorununu çözer — mesh data node.data'da değil,
  // veFEAMeshCache global cache'inde tutulur)
  if (node.type === 'fea-mesh' &&
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
}

// ─── Geometri uygulama köprüsü — cp-fea.js UI'sinden çağrılır ───────────────
// nodeId üzerine primitif yükler, node.data.geometry'yi günceller, paneli
// yeniden render eder (durum tablosu / "Geometriyi Sil" butonu güncellensin).
function veFEAApplyPrimitive(nodeId, type, params) {
  var p = (typeof veFEANormalizePrimitiveParams === 'function')
    ? veFEANormalizePrimitiveParams(type, params)
    : params;

  // KRİTİK 1: Data persist'i HER ZAMAN yap — viewer yoksa bile (WebGL limit
  // aşımı durumunda). Aksi halde kullanıcı "Oluştur" der, viewer yok, hiçbir
  // şey olmaz; data güncellenmez, panel yeniden render olmaz.
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
      if (typeof saveState === 'function') saveState();
    }
  }

  // KRİTİK 2: showNodeProperties panel'i yeniden render eder → canvas DOM
  // elementi değişir. Eski WebGL context detached canvas'a bağlı kalır;
  // Chrome ~16 concurrent context limiti var. Re-render ÖNCESİ eski viewer'ı
  // dispose et — WEBGL_lose_context slot'u serbest bırakır. Eski viewer
  // zaten her halükarda yenisi ile değişecek (cp-core setTimeout(100) ile
  // veFEAInitGeometryViewerForNode tetiklenir; yeni viewer
  // _veFEALoadNodeGeometryIntoViewer ile node.data.geometry'den primitif'i
  // yedirir — TÜM tipleri destekler).
  if (veFEAViewerRegistry[nodeId]) {
    try { veFEAViewerRegistry[nodeId].dispose(); } catch(e) {}
    delete veFEAViewerRegistry[nodeId];
  }

  // Panel yeniden render — durum tablosu, dropdown, butonlar güncellensin
  if (typeof showNodeProperties === 'function' && typeof nodes !== 'undefined') {
    var n = nodes.find && nodes.find(function(x) { return x.id === nodeId; });
    if (n) showNodeProperties(n);
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
  if (!settings.curvatureRefinement) settings.curvatureRefinement = { enabled: false, normalAngleDeg: 18 };
  if (!settings.localSizing) settings.localSizing = { selection: 'none', biasStrength: 0 };
  if (settings.useWorker === undefined) settings.useWorker = false;
  if (settings.useTetMesher === undefined) settings.useTetMesher = true;
  if (settings.delaunayAddInteriorPoints === undefined) settings.delaunayAddInteriorPoints = true;

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
    onProgress: onMeshProgress
  };

  // Mesh editor modal aktifse loading overlay göster (faz ilerlemesi onProgress'ten gelir)
  if (editorActive && typeof veFEAEditorShowLoading === 'function') {
    var tetMesherReady = (typeof veFEADelaunayAvailable === 'function') && veFEADelaunayAvailable() && settings.useTetMesher !== false;
    var loadingSub = settings.useWorker ? 'Web Worker arka planda hesaplıyor...'
                   : (geometry.type === 'step' && tetMesherReady) ? 'Delaunay tet mesher hazırlanıyor...'
                   : (geometry.type === 'step') ? 'Voxelization + tet4 + boundary snap...'
                   : 'Yapısal mesh üretiliyor (' + (geometry.sourceLabel || geometry.type) + ')...';
    veFEAEditorShowLoading('Mesh oluşturuluyor...', loadingSub);
  }

  // STEP için async parse gerekebilir — promise-aware yol.
  // _parsedTriangles cached olsa bile, Delaunay istemi async wrapper'dan geçer.
  var tetMesherWanted = settings.useTetMesher !== false &&
    (typeof veFEADelaunayAvailable === 'function') && veFEADelaunayAvailable();
  var needsAsync = (geometry.type === 'step') &&
    (!geometry._parsedTriangles || tetMesherWanted);
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
  if (typeof connections === 'undefined' || typeof nodes === 'undefined') return null;
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
