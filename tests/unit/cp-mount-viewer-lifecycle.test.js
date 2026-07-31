/**
 * cp-mount-viewer.js — görüntüleyici YAŞAM DÖNGÜSÜ (kaynak bırakma + kamera)
 * ─────────────────────────────────────────────────────────────────────────
 * REGRESYON: 3D Görüntüleyici "kendiliğinden" kararıyordu.
 *
 * Kök neden: görüntüleyici kanvasına bağlıdır ve panel her yeniden çizildiğinde
 * kanvas kopar. Eski kodda kopan görüntüleyici:
 *   · rAF döngüsünü sonsuza dek döndürmeye devam ediyordu (görünmeyen kanvasa),
 *   · WebGL bağlamını hiç bırakmıyordu (renderer.dispose() bağlamı bırakmaz;
 *     forceContextLoss() gerekir),
 *   · pencere (window) düzeyindeki mousemove/mouseup dinleyicilerini bırakmıyordu.
 * Bağlamlar biriktikçe tarayıcının sınırına (~16) dayanılıyor ve EN ESKİ bağlam
 * zorla düşürülüyordu — o an AÇIK olan görüntüleyicinin ekranı boşalıyordu.
 * (Ölçüm: 24 aç/kapa turunda eski kodda 16 bağlam aynı anda canlı, yenide 1.)
 *
 * Ayrıca panel yeniden çizilince kullanıcının döndürdüğü kamera açısı da
 * siliniyordu; artık mod başına saklanıp geri yükleniyor.
 *
 * jsdom; THREE ve WebGL yok → gereken kadarıyla stub'lanır.
 */

// ─── Minimal THREE stub'ı ────────────────────────────────────────────────────
function V3(x, y, z) { this.x = x || 0; this.y = y || 0; this.z = z || 0; }
V3.prototype.set = function (x, y, z) { this.x = x; this.y = y; this.z = z; return this; };
V3.prototype.copy = function (v) { return this.set(v.x, v.y, v.z); };
V3.prototype.normalize = function () { return this; };
V3.prototype.subVectors = function () { return this; };
V3.prototype.crossVectors = function () { return this; };
V3.prototype.addScaledVector = function () { return this; };

function Obj3D() { this.children = []; this.position = new V3(); this.visible = true; }
Obj3D.prototype.add = function (o) { this.children.push(o); return this; };
Obj3D.prototype.remove = function (o) {
  var i = this.children.indexOf(o); if (i >= 0) this.children.splice(i, 1); return this;
};
Obj3D.prototype.traverse = function (fn) {
  fn(this); this.children.forEach(function (c) { if (c.traverse) c.traverse(fn); else fn(c); });
};

let rendererCalls;   // { made, disposed, forcedLoss }

function Geo() { this.disposed = 0; }
Geo.prototype.setFromPoints = function () { return this; };
Geo.prototype.dispose = function () { this.disposed++; };
function Mat() { this.disposed = 0; }
Mat.prototype.dispose = function () { this.disposed++; };

function Color() { this.r = 0.2; this.g = 0.2; this.b = 0.2; }
Color.prototype.clone = function () { return new Color(); };
Color.prototype.multiplyScalar = function () { return this; };
Color.prototype.setStyle = function () { return this; };

function makeThree() {
  function Scene() { Obj3D.call(this); this.background = null; }
  Scene.prototype = Object.create(Obj3D.prototype);
  function Group() { Obj3D.call(this); }
  Group.prototype = Object.create(Obj3D.prototype);
  function Node3D(geometry, material) {
    Obj3D.call(this);
    this.geometry = geometry; this.material = material;
    this.scale = new V3(1, 1, 1);
    this.rotation = new V3();
    this.computeLineDistances = function () {};
  }
  Node3D.prototype = Object.create(Obj3D.prototype);

  return {
    Scene: Scene,
    Group: Group,
    Color: Color,
    DoubleSide: 2,
    PerspectiveCamera: function () {
      Obj3D.call(this);
      this.aspect = 1; this.up = new V3(0, 1, 0);
      this.updateProjectionMatrix = function () {};
      this.lookAt = function () {};
    },
    WebGLRenderer: function () {
      rendererCalls.made++;
      var self = this;
      this.setPixelRatio = function () {};
      this.setSize = function () {};
      this.render = function () { self.renderCount = (self.renderCount || 0) + 1; };
      this.dispose = function () { rendererCalls.disposed++; };
      this.forceContextLoss = function () { rendererCalls.forcedLoss++; };
    },
    AmbientLight: function () { Obj3D.call(this); },
    DirectionalLight: function () { Obj3D.call(this); },
    GridHelper: function () { Obj3D.call(this); },
    ArrowHelper: function () { Obj3D.call(this); },
    Raycaster: function () { this.setFromCamera = function () {}; this.intersectObjects = function () { return []; }; },
    Vector2: function () { this.x = 0; this.y = 0; },
    Vector3: V3,
    BufferGeometry: Geo, BoxGeometry: Geo, SphereGeometry: Geo, PlaneGeometry: Geo,
    LineBasicMaterial: Mat, LineDashedMaterial: Mat,
    MeshBasicMaterial: Mat, MeshPhongMaterial: Mat, SpriteMaterial: Mat,
    CanvasTexture: function () { this.dispose = function () {}; },
    Mesh: Node3D, Line: Node3D, Sprite: Node3D
  };
}

// jsdom'da canvas 2d bağlamı yok; etiket sprite'ları için yeter kadarını taklit et.
HTMLCanvasElement.prototype.getContext = function () {
  return {
    fillStyle: '', font: '', textAlign: '', textBaseline: '',
    fillText: function () {},
    measureText: function (t) { return { width: String(t).length * 20 }; }
  };
};

// ─── rAF: elle adımlanabilir kuyruk ──────────────────────────────────────────
let rafQueue;
function stepFrame() {
  const q = rafQueue; rafQueue = [];
  q.forEach((fn) => fn());
}

global.getComputedStyle = function () { return { getPropertyValue: function () { return '#101010'; } }; };
global.ResizeObserver = undefined;

eval(loadSource('cp-mount-viewer.js'));

// Test kanvası: parentElement'i olan, DOM'a bağlı bir canvas kur.
function mountCanvas(id) {
  document.body.innerHTML = '<div id="wrap"><canvas id="' + id + '"></canvas></div>';
  const c = document.getElementById(id);
  Object.defineProperty(c, 'clientWidth', { value: 600, configurable: true });
  Object.defineProperty(c, 'clientHeight', { value: 400, configurable: true });
  return c;
}

let addSpy, removeSpy;

beforeEach(() => {
  rafQueue = [];
  global.requestAnimationFrame = jest.fn((fn) => { rafQueue.push(fn); return rafQueue.length; });
  global.cancelAnimationFrame = jest.fn();
  // Önceki testten kalan görüntüleyici / kamera hafızası sızmasın — SAYAÇLARDAN
  // ÖNCE temizle ki bu temizlik yeni testin ölçümüne karışmasın.
  if (_veMountViewer) veMountViewerDispose();
  Object.keys(_veMountViewerCam).forEach((k) => { delete _veMountViewerCam[k]; });
  rendererCalls = { made: 0, disposed: 0, forcedLoss: 0 };
  global.THREE = makeThree();
  addSpy = jest.spyOn(window, 'addEventListener');
  removeSpy = jest.spyOn(window, 'removeEventListener');
});

afterEach(() => {
  addSpy.mockRestore();
  removeSpy.mockRestore();
});

describe('dispose: WebGL bağlamını ve dinleyicileri GERÇEKTEN bırakır', () => {
  test('forceContextLoss çağrılır — dispose() tek başına bağlamı bırakmaz', () => {
    mountCanvas('cv');
    veMountViewerInit('cv', 'coordframe');
    expect(rendererCalls.made).toBe(1);

    veMountViewerDispose();

    expect(rendererCalls.forcedLoss).toBe(1);   // bağlam serbest
    expect(rendererCalls.disposed).toBe(1);
    expect(_veMountViewer).toBeNull();
  });

  test('pencere (window) dinleyicileri sökülür — her kurulumda birikmez', () => {
    mountCanvas('cv');
    veMountViewerInit('cv', 'coordframe');
    const added = addSpy.mock.calls.filter((c) => c[0] === 'mousemove' || c[0] === 'mouseup');
    expect(added.length).toBe(2);

    veMountViewerDispose();

    const removed = removeSpy.mock.calls.filter((c) => c[0] === 'mousemove' || c[0] === 'mouseup');
    expect(removed.length).toBe(2);
    // Aynı fonksiyon referansları sökülmüş olmalı (yoksa removeEventListener no-op'tur)
    expect(removed.map((c) => c[1]).sort()).toEqual(added.map((c) => c[1]).sort());
  });

  test('tooltip elemanı body\'den kaldırılır', () => {
    mountCanvas('cv');
    veMountViewerInit('cv', 'coordframe');
    const tip = _veMountViewer.tooltip;
    expect(document.body.contains(tip)).toBe(true);

    veMountViewerDispose();
    expect(document.body.contains(tip)).toBe(false);
  });

  test('yeniden kurulum eskisini bırakır: aynı anda tek bağlam canlı kalır', () => {
    mountCanvas('cv');
    for (let i = 0; i < 5; i++) veMountViewerInit('cv', 'coordframe');

    expect(rendererCalls.made).toBe(5);
    expect(rendererCalls.forcedLoss).toBe(4);   // ilk 4'ü bırakıldı, 1 tanesi canlı
  });
});

describe('render döngüsü: kopan kanvasta sonsuza dek dönmez', () => {
  test('kanvas DOM\'dan koparsa döngü kendini kapatır (rAF + bağlam biter)', () => {
    const c = mountCanvas('cv');
    veMountViewerInit('cv', 'coordframe');
    expect(_veMountViewer).not.toBeNull();

    stepFrame();                                   // normal kare — hayatta
    expect(_veMountViewer).not.toBeNull();

    c.parentElement.removeChild(c);                // panel yeniden çizildi → kanvas koptu
    stepFrame();

    expect(_veMountViewer).toBeNull();             // kendini topladı
    expect(rendererCalls.forcedLoss).toBe(1);      // bağlam bırakıldı
    rafQueue = [];
    stepFrame();
    expect(rafQueue.length).toBe(0);               // yeni kare planlanmıyor
  });

  test('panel gizliyken (0 ölçü) çizim yapılmaz ama döngü yaşar', () => {
    const c = mountCanvas('cv');
    veMountViewerInit('cv', 'coordframe');
    const r = _veMountViewer.renderer;
    stepFrame();
    const drawn = r.renderCount;

    Object.defineProperty(c, 'clientWidth', { value: 0, configurable: true });
    stepFrame();

    expect(r.renderCount).toBe(drawn);             // çizim atlandı
    expect(_veMountViewer).not.toBeNull();         // ama görüntüleyici duruyor
  });

  test('eski döngü yeni görüntüleyiciyi çizmez', () => {
    mountCanvas('cv');
    veMountViewerInit('cv', 'coordframe');
    const stale = rafQueue.slice();                // eski döngünün bekleyen karesi

    veMountViewerInit('cv', 'coordframe');         // yeni görüntüleyici
    const fresh = _veMountViewer.renderer;
    fresh.renderCount = 0;

    stale.forEach((fn) => fn());                   // eski kare koşsun
    expect(fresh.renderCount).toBe(0);             // yeniye dokunmadı
    expect(_veMountViewer).not.toBeNull();         // ve onu öldürmedi
  });
});

describe('kamera hafızası: panel yeniden çizilince açı korunur', () => {
  test('dispose açıyı saklar, aynı modda kurulum geri yükler', () => {
    mountCanvas('cv');
    veMountViewerInit('cv', 'coordframe');
    _veMountViewer._framed = true;                 // kullanıcı çerçevelenmiş bir görünümde
    _veMountViewer.ctrl.theta = 1.23;
    _veMountViewer.ctrl.phi = 0.77;
    _veMountViewer.ctrl.radius = 4321;
    _veMountViewer.ctrl.target.set(10, 20, 30);

    veMountViewerInit('cv', 'coordframe');         // panel yeniden çizildi

    expect(_veMountViewer.ctrl.theta).toBeCloseTo(1.23);
    expect(_veMountViewer.ctrl.phi).toBeCloseTo(0.77);
    expect(_veMountViewer.ctrl.radius).toBe(4321);
    expect(_veMountViewer.ctrl.target.x).toBe(10);
    expect(_veMountViewer._framed).toBe(true);      // yeniden çerçevelemeye kalkmaz
  });

  test('çerçevelenmemiş görünüm saklanmaz (içerik gelince kamera kendini konumlasın)', () => {
    mountCanvas('cv');
    veMountViewerInit('cv', 'coordframe');
    _veMountViewer.ctrl.radius = 9999;              // _framed set EDİLMEDİ
    veMountViewerDispose();

    expect(_veMountViewerCam.coordframe).toBeUndefined();
  });

  test('mod başına ayrı hafıza: coordframe açısı model moduna sızmaz', () => {
    mountCanvas('cv');
    veMountViewerInit('cv', 'coordframe');
    _veMountViewer._framed = true;
    _veMountViewer.ctrl.radius = 1111;
    veMountViewerDispose();

    veMountViewerInit('cv', 'model');
    expect(_veMountViewer.ctrl.radius).toBe(2800);  // model modunun varsayılanı
  });

  test('Sıfırla hafızayı da temizler (sonraki çizimde eski açı geri gelmesin)', () => {
    mountCanvas('cv');
    veMountViewerInit('cv', 'coordframe');
    _veMountViewer._framed = true;
    _veMountViewer.ctrl.radius = 1111;
    veMountViewerDispose();
    expect(_veMountViewerCam.coordframe).toBeDefined();

    veMountViewerInit('cv', 'coordframe');
    global.veMountViewerUpdate = jest.fn();          // sahne yeniden çizimini atla
    veMountViewerReset();

    expect(_veMountViewerCam.coordframe).toBeUndefined();
    expect(_veMountViewer.ctrl.radius).toBe(2600);   // coordframe sıfırlama uzaklığı
  });
});
