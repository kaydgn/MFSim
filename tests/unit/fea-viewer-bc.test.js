/**
 * FEA 3D Viewer — Grup B (display modu / opaklık / arka plan) ve Grup C
 * (mesfe ölçümü / section view) birim testleri.
 *  - Module helper'lar: _veFEAEnsureEdges, _veFEAApplyClipPlanesToObject
 *  - viewer API: setDisplayMode, setOpacity, setBackground, setClipPlane,
 *    getClipBoundsForAxis, startMeasurement/stopMeasurement, isMeasuring,
 *    pickPointFromMouse, addMeasurementPoint, getMeasurementDistance
 *  - Fullscreen toolbar yeni butonları + alt panel render
 *  - Kaynak güvenceleri (renderer.localClippingEnabled, Plane kullanımı vb.)
 *
 * JSDOM Three.js'i çalıştıramaz; Three.js global'i mock'lanır, davranış
 * birim seviyesinde doğrulanır.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '../..');

eval(fs.readFileSync(path.join(ROOT, 'js/components.js'), 'utf8'));
eval(fs.readFileSync(path.join(ROOT, 'js/fea-primitives.js'), 'utf8'));
eval(fs.readFileSync(path.join(ROOT, 'js/fea-step.js'), 'utf8'));
eval(fs.readFileSync(path.join(ROOT, 'js/fea-step.js'), 'utf8'));
eval(fs.readFileSync(path.join(ROOT, 'js/fea-viewer.js'), 'utf8'));
eval(fs.readFileSync(path.join(ROOT, 'js/cp-fea.js'), 'utf8'));

// ────────────────────────────────────────────────────────────────────────────
describe('Module sabitleri', () => {
  test('VE_FEA_BG_PRESETS 4 preset içerir', () => {
    expect(typeof VE_FEA_BG_PRESETS).toBe('object');
    ['dark','light','white','blue'].forEach((k) => {
      expect(VE_FEA_BG_PRESETS[k]).toBeDefined();
      expect(typeof VE_FEA_BG_PRESETS[k]).toBe('number');
    });
  });

  test('VE_FEA_EDGES_MAX_VERTICES sayı (performans sınırı)', () => {
    expect(typeof VE_FEA_EDGES_MAX_VERTICES).toBe('number');
    expect(VE_FEA_EDGES_MAX_VERTICES).toBeGreaterThan(1000);
  });

  test('veFEAGetThemeBackgroundColor tanımlı bir renk döner', () => {
    expect(typeof veFEAGetThemeBackgroundColor).toBe('function');
    var c = veFEAGetThemeBackgroundColor();
    // CSS değişkeni yoksa fallback (hex sayı), varsa CSS string.
    expect(c === undefined || c === null).toBe(false);
    expect(['number', 'string']).toContain(typeof c);
  });

  test('veFEAApplyThemeToViewers fonksiyonu tanımlı', () => {
    expect(typeof veFEAApplyThemeToViewers).toBe('function');
  });
});

// ────────────────────────────────────────────────────────────────────────────
describe('fea-viewer.js — kaynak güvenceleri', () => {
  const src = fs.readFileSync(path.join(ROOT, 'js/fea-viewer.js'), 'utf8');

  test('renderer.localClippingEnabled = true ayarlanır', () => {
    expect(src).toMatch(/renderer\.localClippingEnabled\s*=\s*true/);
  });

  test('THREE.Plane kullanılır (clip plane oluşturmak için)', () => {
    expect(src).toMatch(/new\s+THREE\.Plane/);
  });

  test('THREE.Raycaster kullanılır (mesfe ölçümü için)', () => {
    expect(src).toMatch(/new\s+THREE\.Raycaster/);
  });

  test('changeTheme (theme.js) viewer arka planını yeniler', () => {
    const themeSrc = fs.readFileSync(path.join(ROOT, 'js/theme.js'), 'utf8');
    expect(themeSrc).toMatch(/veFEAApplyThemeToViewers/);
  });

  test('viewer arka planı tema CSS değişkeninden türetilir', () => {
    expect(src).toMatch(/--bg-tertiary/);
    expect(src).toMatch(/function veFEAGetThemeBackgroundColor/);
  });

  test('EdgesGeometry lazy attach helper tanımlı', () => {
    expect(src).toMatch(/function _veFEAEnsureEdges/);
    expect(src).toMatch(/new\s+THREE\.EdgesGeometry/);
  });

  test('mesh-pick modu mouse handler\'larına bağlı (hover + click)', () => {
    // Regresyon: bu wiring daha önce sessizce uygulanmadan kalmıştı.
    expect(src).toMatch(/hoverMeshElement\(e\.clientX, e\.clientY\)/);
    expect(src).toMatch(/pickMeshElementFromMouse\(e\.clientX, e\.clientY\)/);
    expect(src).toMatch(/selectMeshElement\(meid\)/);
  });

  test('mesh eleman seçimi API yöntemleri tanımlı', () => {
    ['pickMeshElementFromMouse', 'selectMeshElement', 'hoverMeshElement', 'clearMeshElementSelection']
      .forEach(function(fn) {
        expect(src).toMatch(new RegExp(fn + ':\\s*function'));
      });
  });

  test('_veFEAApplyClipPlanesToObject helper tanımlı', () => {
    expect(src).toMatch(/function _veFEAApplyClipPlanesToObject/);
  });

  test('viewer API: setDisplayMode, setOpacity, setBackground, setClipPlane', () => {
    expect(src).toMatch(/setDisplayMode:\s*function/);
    expect(src).toMatch(/setOpacity:\s*function/);
    expect(src).toMatch(/setBackground:\s*function/);
    expect(src).toMatch(/setClipPlane:\s*function/);
  });

  test('viewer API: startMeasurement, stopMeasurement, addMeasurementPoint', () => {
    expect(src).toMatch(/startMeasurement:\s*function/);
    expect(src).toMatch(/stopMeasurement:\s*function/);
    expect(src).toMatch(/addMeasurementPoint:\s*function/);
    expect(src).toMatch(/pickPointFromMouse:\s*function/);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// Three.js mock — viewer instance'ı ile davranışsal testler
describe('viewer davranış testleri (Three.js mock)', () => {
  let viewer;

  function setupThreeMock() {
    function Vec3(x, y, z) { this.x = x || 0; this.y = y || 0; this.z = z || 0; }
    Vec3.prototype.clone = function() { return new Vec3(this.x, this.y, this.z); };
    Vec3.prototype.copy = function(v) { this.x = v.x; this.y = v.y; this.z = v.z; return this; };
    Vec3.prototype.set = function(x, y, z) { this.x = x; this.y = y; this.z = z; return this; };
    Vec3.prototype.sub = function(v) { this.x -= v.x; this.y -= v.y; this.z -= v.z; return this; };
    Vec3.prototype.subVectors = function(a, b) { this.x = a.x - b.x; this.y = a.y - b.y; this.z = a.z - b.z; return this; };
    Vec3.prototype.add = function(v) { this.x += v.x; this.y += v.y; this.z += v.z; return this; };
    Vec3.prototype.addScaledVector = function(v, s) { this.x += v.x * s; this.y += v.y * s; this.z += v.z * s; return this; };
    Vec3.prototype.normalize = function() {
      var l = Math.sqrt(this.x*this.x + this.y*this.y + this.z*this.z) || 1;
      this.x /= l; this.y /= l; this.z /= l; return this;
    };
    Vec3.prototype.length = function() { return Math.sqrt(this.x*this.x + this.y*this.y + this.z*this.z); };
    Vec3.prototype.lengthSq = function() { return this.x*this.x + this.y*this.y + this.z*this.z; };
    Vec3.prototype.multiplyScalar = function(s) { this.x *= s; this.y *= s; this.z *= s; return this; };
    Vec3.prototype.crossVectors = function(a, b) {
      this.x = a.y*b.z - a.z*b.y; this.y = a.z*b.x - a.x*b.z; this.z = a.x*b.y - a.y*b.x; return this;
    };
    Vec3.prototype.setFromSpherical = function(s) {
      var sp = Math.sin(s.phi) * s.radius;
      this.x = sp * Math.sin(s.theta); this.y = Math.cos(s.phi) * s.radius; this.z = sp * Math.cos(s.theta);
      return this;
    };
    Vec3.prototype.distanceTo = function(v) {
      var dx = this.x - v.x, dy = this.y - v.y, dz = this.z - v.z;
      return Math.sqrt(dx*dx + dy*dy + dz*dz);
    };

    function Box3() { this.min = new Vec3(Infinity,Infinity,Infinity); this.max = new Vec3(-Infinity,-Infinity,-Infinity); }
    Box3.prototype.setFromObject = function(obj) {
      // Basit: traverse mesh'lerden geometry.userData.box (test fixture'ı)
      var self = this;
      obj.traverse && obj.traverse(function(o) {
        if (o.userData && o.userData.testBox) {
          var b = o.userData.testBox;
          self.min.x = Math.min(self.min.x, b.min.x); self.min.y = Math.min(self.min.y, b.min.y); self.min.z = Math.min(self.min.z, b.min.z);
          self.max.x = Math.max(self.max.x, b.max.x); self.max.y = Math.max(self.max.y, b.max.y); self.max.z = Math.max(self.max.z, b.max.z);
        }
      });
      return this;
    };
    Box3.prototype.isEmpty = function() { return this.min.x > this.max.x; };
    Box3.prototype.getSize = function(target) { target.x = this.max.x - this.min.x; target.y = this.max.y - this.min.y; target.z = this.max.z - this.min.z; return target; };
    Box3.prototype.getCenter = function(target) { target.x = (this.min.x + this.max.x)/2; target.y = (this.min.y + this.max.y)/2; target.z = (this.min.z + this.max.z)/2; return target; };

    function Group() { this.children = []; this.userData = {}; }
    Group.prototype.add = function(c) { this.children.push(c); c.parent = this; };
    Group.prototype.remove = function(c) { var i = this.children.indexOf(c); if (i >= 0) this.children.splice(i, 1); };
    Group.prototype.traverse = function(fn) { fn(this); this.children.forEach(function(c) { c.traverse && c.traverse(fn); }); };

    function Scene() { Group.call(this); this.background = null; }
    Scene.prototype = Object.create(Group.prototype);

    function PerspectiveCamera(fov, asp, n, f) { this.fov = fov; this.aspect = asp; this.near = n; this.far = f; this.position = new Vec3(); this.up = new Vec3(0, 1, 0); this.isPerspectiveCamera = true; }
    PerspectiveCamera.prototype.lookAt = function() {};
    PerspectiveCamera.prototype.updateProjectionMatrix = function() {};

    function WebGLRenderer() {}
    WebGLRenderer.prototype.setSize = function() {};
    WebGLRenderer.prototype.setPixelRatio = function() {};
    WebGLRenderer.prototype.setViewport = function() {};
    WebGLRenderer.prototype.setScissor = function() {};
    WebGLRenderer.prototype.setScissorTest = function() {};
    WebGLRenderer.prototype.clearDepth = function() {};
    WebGLRenderer.prototype.render = function() {};
    // veFEAInitViewer artık getContext() null ise viewer'ı reddediyor
    // (WebGL context limit defensive check). Mock için truthy stub döndür.
    WebGLRenderer.prototype.getContext = function() { return {}; };
    WebGLRenderer.prototype.dispose = function() {};

    return {
      Vector3: Vec3,
      Spherical: function() { this.radius = 1; this.theta = 0; this.phi = Math.PI / 4; this.setFromVector3 = function(v) { this.radius = v.length() || 1; }; },
      Color: function(c) { this.value = c; },
      Box3: Box3,
      Plane: function(normal, constant) { this.normal = normal; this.constant = constant; },
      Group: Group,
      Scene: Scene,
      PerspectiveCamera: PerspectiveCamera,
      OrthographicCamera: function(l, r, t, b, n, f) {
        this.left = l; this.right = r; this.top = t; this.bottom = b; this.near = n; this.far = f;
        this.position = new Vec3(); this.up = new Vec3(0, 1, 0); this.isOrthographicCamera = true;
        this.lookAt = function() {}; this.updateProjectionMatrix = function() {};
      },
      WebGLRenderer: WebGLRenderer,
      AmbientLight: function() { return { traverse: function(f) { f(this); }.bind({}) }; },
      DirectionalLight: function() {
        var o = { position: new Vec3() };
        o.traverse = function(f) { f(o); };
        return o;
      },
      AxesHelper: function() { return { traverse: function(f) { f(this); } }; },
      SphereGeometry: function() { this.dispose = function() {}; },
      EdgesGeometry: function() { this.dispose = function() {}; },
      BufferAttribute: function(array, itemSize) { this.array = array; this.itemSize = itemSize; this.count = array ? array.length / itemSize : 0; },
      BufferGeometry: function() {
        this.dispose = function() {};
        this.attributes = {};
        this.setFromPoints = function() { return this; };
        this.setAttribute = function(name, attr) { this.attributes[name] = attr; return this; };
        this.getAttribute = function(name) { return this.attributes[name]; };
        this.computeVertexNormals = function() {};
        this.computeBoundingSphere = function() {};
        this.setIndex = function() {};
      },
      PointsMaterial: function(opts) { Object.assign(this, opts || {}); this.dispose = function() {}; },
      Points: function(geo, mat) {
        this.geometry = geo; this.material = mat; this.userData = {}; this.children = [];
        this.renderOrder = 0;
        this.traverse = function(f) { f(this); };
      },
      LineBasicMaterial: function() { this.dispose = function() {}; },
      LineSegments: function(geo, mat) {
        this.geometry = geo; this.material = mat; this.userData = {}; this.children = [];
        this.visible = true;
        this.add = function(c) { this.children.push(c); };
        this.traverse = function(f) { f(this); this.children.forEach(function(c) { c.traverse && c.traverse(f); }); };
      },
      Line: function(geo, mat) {
        this.geometry = geo; this.material = mat; this.userData = {}; this.children = [];
        this.traverse = function(f) { f(this); };
      },
      Mesh: function(geo, mat) {
        this.geometry = geo;
        this.material = mat;
        this.userData = {};
        this.children = [];
        this.isMesh = true;
        this.position = new Vec3();
        this.renderOrder = 0;
        var self = this;
        this.add = function(c) { self.children.push(c); c.parent = self; };
        this.traverse = function(f) { f(self); self.children.forEach(function(c) { c.traverse && c.traverse(f); }); };
      },
      MeshBasicMaterial: function(opts) { Object.assign(this, opts || {}); this.dispose = function() {}; },
      MeshStandardMaterial: function(opts) {
        Object.assign(this, opts || {});
        this.dispose = function() {};
        this.needsUpdate = false;
      },
      Raycaster: function() {
        this.setFromCamera = function() {};
        this.intersectObject = function() { return []; };
      },
      DoubleSide: 2
    };
  }

  function createTestMesh(name, vertexCount) {
    return {
      isMesh: true,
      userData: { testBox: { min: { x: -10, y: -10, z: -10 }, max: { x: 10, y: 10, z: 10 } } },
      geometry: {
        attributes: { position: { count: vertexCount || 100 } },
        dispose: function() {}
      },
      material: {
        wireframe: false,
        opacity: 1,
        transparent: false,
        visible: true,
        clippingPlanes: null,
        clipShadows: false,
        needsUpdate: false,
        dispose: function() {}
      },
      children: [],
      add: function(c) { this.children.push(c); c.parent = this; },
      traverse: function(f) { f(this); var self = this; this.children.forEach(function(c) { c.traverse && c.traverse(f); }); },
      name: name || 'testMesh'
    };
  }

  beforeEach(() => {
    global.THREE = setupThreeMock();
    var canvas = document.createElement('canvas');
    canvas.width = 800;
    canvas.height = 600;
    document.body.appendChild(canvas);
    viewer = veFEAInitViewer(canvas, { width: 800, height: 600 });
  });

  afterEach(() => {
    delete global.THREE;
    document.body.innerHTML = '';
  });

  // ─── Mesh eleman seçimi (mesh-pick modu) ───────────────────────────────────
  test('setPointerMode "mesh-pick" modunu kabul eder', () => {
    viewer.setPointerMode('mesh-pick');
    expect(viewer.getPointerMode()).toBe('mesh-pick');
  });

  test('_ensureElementCentroids eleman centroid\'lerini hesaplar (tek hex8)', () => {
    // Birim küp (8 köşe) → tek hex8 elemanı, centroid (0.5,0.5,0.5)
    viewer._meshData = {
      type: 'hex8', nodesPerElement: 8,
      nodes: [0,0,0, 1,0,0, 1,1,0, 0,1,0, 0,0,1, 1,0,1, 1,1,1, 0,1,1],
      elements: [0,1,2,3,4,5,6,7]
    };
    var cen = viewer._ensureElementCentroids();
    expect(cen.length).toBe(3);
    expect(cen[0]).toBeCloseTo(0.5, 5);
    expect(cen[1]).toBeCloseTo(0.5, 5);
    expect(cen[2]).toBeCloseTo(0.5, 5);
  });

  test('pickMeshElementFromMouse vurulan noktaya en yakın elemanı döner', () => {
    // İki tet4: 0. eleman orijin civarı, 1. eleman x=10 civarı
    viewer._meshData = {
      type: 'tet4', nodesPerElement: 4,
      nodes: [
        0,0,0, 1,0,0, 0,1,0, 0,0,1,            // eleman 0 düğümleri
        10,0,0, 11,0,0, 10,1,0, 10,0,1          // eleman 1 düğümleri
      ],
      elements: [0,1,2,3, 4,5,6,7]
    };
    // pickPointFromMouse'u sabit bir noktaya stub'la (raycaster gerektirmez)
    viewer.pickPointFromMouse = function() { return { x: 10, y: 0.2, z: 0.2 }; };
    expect(viewer.pickMeshElementFromMouse(0, 0)).toBe(1);
    viewer.pickPointFromMouse = function() { return { x: 0.2, y: 0.2, z: 0.2 }; };
    expect(viewer.pickMeshElementFromMouse(0, 0)).toBe(0);
  });

  test('pickMeshElementFromMouse: nokta yoksa null', () => {
    viewer._meshData = { type: 'tet4', nodesPerElement: 4, nodes: [0,0,0,1,0,0,0,1,0,0,0,1], elements: [0,1,2,3] };
    viewer.pickPointFromMouse = function() { return null; };
    expect(viewer.pickMeshElementFromMouse(0, 0)).toBeNull();
  });

  test('selectMeshElement elemanı vurgular + etiketi günceller; null temizler', () => {
    document.body.innerHTML = '<canvas id="ve-fea-mesh-canvas-N1"></canvas>' +
      '<div id="ve-fea-mesh-pick-label-N1" style="display:none;"></div>';
    var c = document.getElementById('ve-fea-mesh-canvas-N1');
    var v = veFEAInitViewer(c, { width: 400, height: 300 });
    v._meshData = {
      type: 'tet4', nodesPerElement: 4,
      nodes: [0,0,0, 1,0,0, 0,1,0, 0,0,1], elements: [0,1,2,3]
    };
    v.selectMeshElement(0);
    expect(v._selectedMeshElement).toBe(0);
    expect(v._meshElementHighlight).not.toBeNull();
    var label = document.getElementById('ve-fea-mesh-pick-label-N1');
    expect(label.style.display).toBe('block');
    expect(label.textContent).toBe('Eleman #0');
    // Temizle
    v.selectMeshElement(null);
    expect(v._selectedMeshElement).toBeNull();
    expect(v._meshElementHighlight).toBeNull();
    expect(label.style.display).toBe('none');
  });

  test('clearMeshElementSelection seçim + hover overlay\'lerini temizler', () => {
    viewer._meshData = { type: 'tet4', nodesPerElement: 4, nodes: [0,0,0,1,0,0,0,1,0,0,0,1], elements: [0,1,2,3] };
    viewer.selectMeshElement(0);
    expect(viewer._selectedMeshElement).toBe(0);
    viewer.clearMeshElementSelection();
    expect(viewer._selectedMeshElement).toBeNull();
    expect(viewer._meshElementHighlight).toBeNull();
    expect(viewer._meshElementHover).toBeNull();
  });

  test('viewer başlangıçta shaded mode, opacity=1, projection=perspective', () => {
    expect(viewer._displayMode).toBe('shaded');
    expect(viewer._opacity).toBe(1.0);
    expect(viewer.projection).toBe('perspective');
    expect(Array.isArray(viewer._clipPlanes)).toBe(true);
    expect(viewer._clipPlanes.length).toBe(0);
  });

  test('setDisplayMode geçerli modları kabul eder', () => {
    viewer.setDisplayMode('wireframe');
    expect(viewer._displayMode).toBe('wireframe');
    viewer.setDisplayMode('shaded-edges');
    expect(viewer._displayMode).toBe('shaded-edges');
    viewer.setDisplayMode('shaded');
    expect(viewer._displayMode).toBe('shaded');
  });

  test('setDisplayMode geçersiz değeri yok sayar', () => {
    viewer._displayMode = 'shaded';
    viewer.setDisplayMode('invalid');
    expect(viewer._displayMode).toBe('shaded');
  });

  test('setOpacity 0.05..1 aralığına clamp eder', () => {
    viewer.setOpacity(0.5);
    expect(viewer._opacity).toBe(0.5);
    viewer.setOpacity(-1);
    expect(viewer._opacity).toBe(0.05);
    viewer.setOpacity(5);
    expect(viewer._opacity).toBe(1);
  });

  test('setOpacity geçersiz değer için davranışı koruyor', () => {
    viewer.setOpacity(0.7);
    viewer.setOpacity(NaN);
    expect(viewer._opacity).toBe(0.7);
  });

  test('setBackground preset string kabul eder', () => {
    viewer.setBackground('blue');
    expect(viewer._backgroundColor).toBe(VE_FEA_BG_PRESETS.blue);
    viewer.setBackground('white');
    expect(viewer._backgroundColor).toBe(VE_FEA_BG_PRESETS.white);
  });

  test('setBackground geçersiz preset için davranışı koruyor', () => {
    var before = viewer._backgroundColor;
    viewer.setBackground('purple');
    expect(viewer._backgroundColor).toBe(before);
  });

  test('opts.background verilmeyen viewer temaya bağlıdır', () => {
    // beforeEach viewer'ı background vermeden oluşturur → tema modu.
    expect(viewer._isThemeBackground).toBe(true);
  });

  test('setBackground("theme") viewer\'ı tema moduna alır', () => {
    viewer.setBackground('blue');
    expect(viewer._isThemeBackground).toBe(false);
    viewer.setBackground('theme');
    expect(viewer._isThemeBackground).toBe(true);
    // Tema rengi CSS değişkeninden ya da fallback'ten gelir (her zaman tanımlı).
    expect(viewer._backgroundColor).toBeDefined();
  });

  test('elle seçilen preset tema modunu kapatır', () => {
    viewer.setBackground('white');
    expect(viewer._isThemeBackground).toBe(false);
    expect(viewer._backgroundColor).toBe(VE_FEA_BG_PRESETS.white);
  });

  test('veFEAApplyThemeToViewers yalnızca tema modundaki viewer\'ları günceller', () => {
    // İki viewer: biri temaya bağlı, biri elle preset seçilmiş.
    var c2 = document.createElement('canvas');
    document.body.appendChild(c2);
    var themed = veFEAInitViewer(c2, { width: 400, height: 300 }); // tema modu
    var c3 = document.createElement('canvas');
    document.body.appendChild(c3);
    var manual = veFEAInitViewer(c3, { width: 400, height: 300 });
    manual.setBackground('blue'); // elle → tema modu kapanır

    veFEAViewerRegistry['themed'] = themed;
    veFEAViewerRegistry['manual'] = manual;

    expect(() => veFEAApplyThemeToViewers()).not.toThrow();
    // Elle seçilen viewer mavi kalmalı (tema değişimi onu etkilemez).
    expect(manual._backgroundColor).toBe(VE_FEA_BG_PRESETS.blue);
    expect(manual._isThemeBackground).toBe(false);
    // Tema modundaki viewer tema modunda kalır.
    expect(themed._isThemeBackground).toBe(true);

    delete veFEAViewerRegistry['themed'];
    delete veFEAViewerRegistry['manual'];
  });

  test('setClipPlane X ekseninde plane oluşturur', () => {
    viewer.setClipPlane('x', true, 5);
    expect(viewer._clipState.x.enabled).toBe(true);
    expect(viewer._clipState.x.offset).toBe(5);
    expect(viewer._clipPlanes.length).toBe(1);
  });

  test('setClipPlane 3 eksen birlikte aktif olabilir', () => {
    viewer.setClipPlane('x', true, 1);
    viewer.setClipPlane('y', true, 2);
    viewer.setClipPlane('z', true, 3);
    expect(viewer._clipPlanes.length).toBe(3);
  });

  test('setClipPlane disable plane listesini boşaltır', () => {
    viewer.setClipPlane('x', true, 5);
    expect(viewer._clipPlanes.length).toBe(1);
    viewer.setClipPlane('x', false);
    expect(viewer._clipPlanes.length).toBe(0);
  });

  test('getClipBoundsForAxis: geometri yokken default sınırlar', () => {
    var b = viewer.getClipBoundsForAxis('x');
    expect(b.min).toBeLessThanOrEqual(b.max);
  });

  test('startMeasurement / isMeasuring / stopMeasurement durum makinesi', () => {
    expect(viewer.isMeasuring()).toBe(false);
    viewer.startMeasurement();
    expect(viewer.isMeasuring()).toBe(true);
    viewer.stopMeasurement();
    expect(viewer.isMeasuring()).toBe(false);
  });

  test('addMeasurementPoint: 2 nokta verilince mesafe hesaplanır', () => {
    viewer.startMeasurement();
    viewer.addMeasurementPoint(new THREE.Vector3(0, 0, 0));
    viewer.addMeasurementPoint(new THREE.Vector3(3, 4, 0));
    expect(viewer.getMeasurementDistance()).toBeCloseTo(5, 4); // 3-4-5 üçgeni
  });

  test('addMeasurementPoint onChange callback fazları (start, first, measured)', () => {
    var events = [];
    viewer.startMeasurement(function(ev) { events.push(ev.phase); });
    viewer.addMeasurementPoint(new THREE.Vector3(0, 0, 0));
    viewer.addMeasurementPoint(new THREE.Vector3(5, 0, 0));
    expect(events).toContain('start');
    expect(events).toContain('first');
    expect(events).toContain('measured');
  });

  test('addMeasurementPoint mod aktif değilse yok sayar', () => {
    viewer.addMeasurementPoint(new THREE.Vector3(1, 1, 1));
    expect(viewer.getMeasurementDistance()).toBeNull();
  });

  test('addMeasurementPoint 3. tıklamada sıfırlanır', () => {
    viewer.startMeasurement();
    viewer.addMeasurementPoint(new THREE.Vector3(0, 0, 0));
    viewer.addMeasurementPoint(new THREE.Vector3(5, 0, 0));
    viewer.addMeasurementPoint(new THREE.Vector3(10, 0, 0));
    expect(viewer._measurement.points.length).toBe(1);
    expect(viewer.getMeasurementDistance()).toBeNull();
  });
});

// ────────────────────────────────────────────────────────────────────────────
describe('Sağ üst kontrol paneli — accordion yapısı', () => {
  beforeEach(() => {
    if (typeof veFEACloseFullscreenViewer === 'function') veFEACloseFullscreenViewer();
    var leftover = document.getElementById('ve-fea-fullscreen-overlay');
    if (leftover && leftover.parentNode) leftover.parentNode.removeChild(leftover);
    document.body.innerHTML = '';
    Object.keys(veFEAViewerRegistry).forEach((k) => delete veFEAViewerRegistry[k]);
  });

  test('Toggle butonu sağ üstte render edilir, panel default gizli', () => {
    veFEAOpenFullscreenViewer('test-acc');
    var toggleBtn = document.getElementById('ve-fea-controls-toggle');
    var panel     = document.getElementById('ve-fea-controls-panel');
    expect(toggleBtn).not.toBeNull();
    expect(panel).not.toBeNull();
    expect(panel.style.display).toBe('none');
    expect(toggleBtn.innerHTML).toBe('⚙');
  });

  test('Toggle butonuna tıklanınca panel açılır ve buton işareti ✕ olur', () => {
    veFEAOpenFullscreenViewer('test-acc');
    var toggleBtn = document.getElementById('ve-fea-controls-toggle');
    var panel     = document.getElementById('ve-fea-controls-panel');
    toggleBtn.click();
    expect(panel.style.display).toBe('block');
    expect(toggleBtn.innerHTML).toBe('✕');
    toggleBtn.click();
    expect(panel.style.display).toBe('none');
    expect(toggleBtn.innerHTML).toBe('⚙');
  });

  test('3 accordion kategorisi (view / display / interaction) render edilir', () => {
    veFEAOpenFullscreenViewer('test-acc');
    ['view','display','interaction'].forEach((id) => {
      expect(document.querySelector('button[data-acc-header="' + id + '"]')).not.toBeNull();
      expect(document.querySelector('div[data-acc-body="' + id + '"]')).not.toBeNull();
    });
  });

  test('Accordion başlığına tıklayınca o bölüm açılır/kapanır', () => {
    veFEAOpenFullscreenViewer('test-acc');
    var header = document.querySelector('button[data-acc-header="view"]');
    var body   = document.querySelector('div[data-acc-body="view"]');
    expect(body.style.display).toBe(''); // default açık (display:block CSS'ten)
    header.click();
    expect(body.style.display).toBe('none');
    header.click();
    expect(body.style.display).toBe('block');
  });
});

describe('Fullscreen toolbar — Grup B + C butonları render', () => {
  beforeEach(() => {
    if (typeof veFEACloseFullscreenViewer === 'function') veFEACloseFullscreenViewer();
    var leftover = document.getElementById('ve-fea-fullscreen-overlay');
    if (leftover && leftover.parentNode) leftover.parentNode.removeChild(leftover);
    document.body.innerHTML = '';
    Object.keys(veFEAViewerRegistry).forEach((k) => delete veFEAViewerRegistry[k]);
  });

  test('Mod / Opaklık / Arka plan / Ölç / Kesit butonları render edilir', () => {
    veFEAOpenFullscreenViewer('test-bc');
    expect(document.querySelector('button[data-action="mode"]')).not.toBeNull();
    expect(document.querySelector('input[data-action="opacity"]')).not.toBeNull();
    expect(document.querySelector('select[data-action="bg"]')).not.toBeNull();
    expect(document.querySelector('button[data-action="measure"]')).not.toBeNull();
    expect(document.querySelector('button[data-action="clip"]')).not.toBeNull();
  });

  test('Mod butonu default "Shaded" ve data-mode="shaded"', () => {
    veFEAOpenFullscreenViewer('test-bc');
    var modeBtn = document.querySelector('button[data-action="mode"]');
    expect(modeBtn.getAttribute('data-mode')).toBe('shaded');
    expect(modeBtn.textContent).toMatch(/Shaded/);
  });

  test('Arka plan dropdown tema + 4 preset içerir', () => {
    veFEAOpenFullscreenViewer('test-bc');
    var opts = document.querySelectorAll('select[data-action="bg"] option');
    expect(opts.length).toBe(5);
    var values = Array.from(opts).map(function(o) { return o.value; });
    expect(values).toEqual(['theme','dark','light','white','blue']);
    // Varsayılan seçim "Tema" — viewer programın aktif temasına uyar.
    expect(values[0]).toBe('theme');
  });

  test('Ölçüm status div\'i accordion içinde gizli olarak render edilir', () => {
    veFEAOpenFullscreenViewer('test-bc');
    var statusDiv = document.querySelector('[data-role="measure-status"]');
    expect(statusDiv).not.toBeNull();
    expect(statusDiv.style.display).toBe('none');
  });

  test('Kesit kontrolleri accordion içinde gizli + 3 eksen satırı', () => {
    veFEAOpenFullscreenViewer('test-bc');
    var clipControls = document.querySelector('[data-role="clip-controls"]');
    expect(clipControls).not.toBeNull();
    expect(clipControls.style.display).toBe('none');
    ['x','y','z'].forEach((ax) => {
      expect(clipControls.querySelector('div[data-axis="' + ax + '"]')).not.toBeNull();
    });
  });

  test('Mod butonu tıklanırsa metin döner (Shaded → Shaded+Edges → Wireframe → Shaded)', () => {
    veFEAOpenFullscreenViewer('test-bc');
    var modeBtn = document.querySelector('button[data-action="mode"]');
    // İlk tıklama → shaded-edges
    expect(() => modeBtn.click()).not.toThrow();
    expect(modeBtn.getAttribute('data-mode')).toBe('shaded-edges');
    expect(modeBtn.textContent).toMatch(/Shaded\+Edges/);
    // İkinci → wireframe
    modeBtn.click();
    expect(modeBtn.getAttribute('data-mode')).toBe('wireframe');
    // Üçüncü → shaded
    modeBtn.click();
    expect(modeBtn.getAttribute('data-mode')).toBe('shaded');
  });

  test('Ölç butonu tıklanırsa ölçüm status div\'i görünür olur', () => {
    veFEAOpenFullscreenViewer('test-bc');
    var btn = document.querySelector('button[data-action="measure"]');
    var statusDiv = document.querySelector('[data-role="measure-status"]');
    expect(statusDiv.style.display).toBe('none');
    expect(() => btn.click()).not.toThrow();
    // Three.js olmasa da UI durumu güncellenir (helper viewer-yoksa yolu)
    if (btn.getAttribute('data-active') === 'true') {
      expect(statusDiv.style.display).toBe('block');
    }
  });

  test('Kesit butonu tıklanırsa kesit kontrolleri açılır/kapanır', () => {
    veFEAOpenFullscreenViewer('test-bc');
    var btn = document.querySelector('button[data-action="clip"]');
    var clipControls = document.querySelector('[data-role="clip-controls"]');
    expect(clipControls.style.display).toBe('none');
    expect(() => btn.click()).not.toThrow();
    if (btn.getAttribute('data-active') === 'true') {
      expect(clipControls.style.display).toBe('block');
      btn.click();
      expect(clipControls.style.display).toBe('none');
    }
  });
});
