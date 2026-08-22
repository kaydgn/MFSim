// ============================================================================
//  YAPISAL ANALİZ — GEOMETRİ 3B GÖRÜNTÜLEYİCİSİ
// ============================================================================
// İçe aktarılan STEP parçasını panelde gösterir. SALT SUNUM: geometriyi
// hesaplamaz, üçgenleri js/structural-model.js'in normalize ettiği modelden
// alır (veStrGeomCacheGet).
//
// Kalıp js/cp-mount-viewer.js'ten: kendi küresel kontrolü (OrbitControls
// vendorlu DEĞİL), ResizeObserver, dispose korumalı rAF döngüsü, tema
// renkleri CSS değişkenlerinden. Aynı üç tuzak da aynı şekilde kapatıldı:
//   • Kanvas DOM'dan koparıldığında döngü kendini durdurur (WebGL bağlam
//     sızıntısı: tarayıcı sınırı ~8-16, dolunca EN ESKİ bağlam düşürülür).
//   • Araya yeni bir init girerse eski döngü susar (iki döngü aynı anda dönmez).
//   • Kamera açısı mod başına saklanır: panel her yeniden çizildiğinde sahne
//     sıfırdan kurulur, kullanıcının döndürdüğü görüş habersiz silinmemeli.
//
// ── YÜZ VURGUSU BİR SÜS DEĞİL, ZİNCİRİN KANITI ─────────────────────────────
// Fare parçanın üstünde gezerken vurgulanan şey ÜÇGEN değil CAD YÜZÜdür:
// raycaster'ın verdiği üçgen indisi veStrFaceOfTriangle ile `brep_faces`
// aralığına çevrilir. Sınır Koşulları bileşeni yüz seçerken AYNI çeviriyi
// kullanacak — yani prototipte gördüğün vurgu, sonraki oturumda mesnet/yük
// bağlanacak yüzün ta kendisi. Zincir sonradan eklenen bir varsayım değil,
// bugün çalışıyor.
//
// THREE yoksa sessiz no-op (Takoz görüntüleyicisiyle aynı davranış).
// ----------------------------------------------------------------------------

var _veStrViewer = null;
var _veStrViewerCam = {};   // düğüm kimliği → kamera hafızası

// ─── Tema yardımcıları ──────────────────────────────────────────────────────
function _svwCssStr(varName, fallback){
  try {
    if(typeof document === 'undefined' || typeof getComputedStyle === 'undefined') return fallback;
    var v = getComputedStyle(document.documentElement).getPropertyValue(varName);
    v = v ? v.trim() : '';
    return v || fallback;
  } catch(e){ return fallback; }
}
function _svwCssColor(varName, fallback){
  try { return new THREE.Color(_svwCssStr(varName, fallback)); }
  catch(e){ return new THREE.Color(fallback); }
}
function _svwBgIsLight(){
  try {
    var c = _svwCssColor('--bg-primary', '#0a0a0a');
    return (0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b) > 0.5;
  } catch(e){ return false; }
}

// ─── Yaşam döngüsü ──────────────────────────────────────────────────────────
function veStrViewerDispose(){
  var V = _veStrViewer;
  if(!V) return;
  // Kamerayı UNUTMA: panel yeniden çizildiğinde aynı açıyla geri gelsin.
  if(V.nodeId){
    _veStrViewerCam[V.nodeId] = {
      theta: V.ctrl.theta, phi: V.ctrl.phi, radius: V.ctrl.radius,
      tx: V.ctrl.target.x, ty: V.ctrl.target.y, tz: V.ctrl.target.z
    };
  }
  V.disposed = true;
  if(V.raf) { try { cancelAnimationFrame(V.raf); } catch(e){} }
  if(V.ro) { try { V.ro.disconnect(); } catch(e){} }
  (V.detach || []).forEach(function(fn){ try { fn(); } catch(e){} });
  if(V.tooltip && V.tooltip.parentNode) { try { V.tooltip.parentNode.removeChild(V.tooltip); } catch(e){} }
  try { V.renderer.dispose(); } catch(e){}
  _veStrViewer = null;
}

function veStrViewerResize(){
  var V = _veStrViewer;
  if(!V || V.disposed) return;
  var wrap = V.canvas.parentElement;
  if(!wrap) return;
  var w = Math.max(1, wrap.clientWidth), h = Math.max(1, wrap.clientHeight);
  V.camera.aspect = w / h;
  V.camera.updateProjectionMatrix();
  V.renderer.setSize(w, h, false);
}

function _svwUpdateCamera(){
  var V = _veStrViewer;
  if(!V) return;
  var c = V.ctrl;
  // Küresel → kartezyen. phi kutuplara yapışmasın (kamera ters dönerdi).
  c.phi = Math.max(0.02, Math.min(Math.PI - 0.02, c.phi));
  var x = c.radius * Math.sin(c.phi) * Math.cos(c.theta);
  var y = c.radius * Math.cos(c.phi);
  var z = c.radius * Math.sin(c.phi) * Math.sin(c.theta);
  V.camera.position.set(c.target.x + x, c.target.y + y, c.target.z + z);
  V.camera.lookAt(c.target);
}

function _svwAttachControls(canvas){
  var V = _veStrViewer;
  var drag = null;

  function onDown(e){
    // 0 = sol (döndür), 2 = sağ (kaydır)
    drag = { btn: e.button, x: e.clientX, y: e.clientY };
    V.dragging = true;
  }
  function onUp(){ drag = null; if(_veStrViewer) _veStrViewer.dragging = false; }
  function onMove(e){
    if(!drag || !_veStrViewer || _veStrViewer.disposed) return;
    var dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    drag.x = e.clientX; drag.y = e.clientY;
    var c = _veStrViewer.ctrl;
    if(drag.btn === 2){
      // Kaydırma EKRAN düzleminde: kameranın sağ ve yukarı eksenleri boyunca.
      // Dünya eksenlerinde kaydırmak, kamera döndükten sonra fareyle ters
      // yönde hareket etmek demek olurdu.
      var cam = _veStrViewer.camera;
      var right = new THREE.Vector3().setFromMatrixColumn(cam.matrix, 0);
      var up = new THREE.Vector3().setFromMatrixColumn(cam.matrix, 1);
      var k = c.radius * 0.0016;
      c.target.addScaledVector(right, -dx * k);
      c.target.addScaledVector(up, dy * k);
    } else {
      c.theta -= dx * 0.008;
      c.phi   -= dy * 0.008;
    }
    _svwUpdateCamera();
  }
  function onWheel(e){
    e.preventDefault();
    if(!_veStrViewer) return;
    var c = _veStrViewer.ctrl;
    c.radius *= (e.deltaY > 0) ? 1.12 : (1 / 1.12);
    c.radius = Math.max(_veStrViewer.minRadius, Math.min(_veStrViewer.maxRadius, c.radius));
    _svwUpdateCamera();
  }
  function onCtx(e){ e.preventDefault(); }

  canvas.addEventListener('mousedown', onDown);
  window.addEventListener('mouseup', onUp);
  window.addEventListener('mousemove', onMove);
  canvas.addEventListener('wheel', onWheel, { passive: false });
  canvas.addEventListener('contextmenu', onCtx);
  V.detach.push(function(){
    canvas.removeEventListener('mousedown', onDown);
    window.removeEventListener('mouseup', onUp);
    window.removeEventListener('mousemove', onMove);
    canvas.removeEventListener('wheel', onWheel);
    canvas.removeEventListener('contextmenu', onCtx);
  });
}

// ─── CAD yüzü vurgusu ───────────────────────────────────────────────────────
// Raycaster üçgen indisi verir; veStrFaceOfTriangle onu `brep_faces`
// aralığına çevirir. Vurgulanan geometri o yüzün BÜTÜN üçgenleridir.
function _svwHighlightFace(meshIndex, face){
  var V = _veStrViewer;
  if(!V) return;
  if(V.hl){ V.group.remove(V.hl); try { V.hl.geometry.dispose(); } catch(e){} V.hl = null; }
  if(!face) return;
  var src = V.geom.meshes[meshIndex];
  if(!src) return;

  var tri = face.last - face.first + 1;
  var pos = new Float32Array(tri * 9);
  var idx = src.indices, p = src.positions;
  var o = 0;
  for(var t = face.first; t <= face.last; t++){
    for(var k = 0; k < 3; k++){
      var vi = idx[t * 3 + k] * 3;
      pos[o++] = p[vi]; pos[o++] = p[vi + 1]; pos[o++] = p[vi + 2];
    }
  }
  var g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.computeVertexNormals();
  var mat = new THREE.MeshBasicMaterial({
    color: _svwCssColor('--accent-warning', '#f59e0b'),
    transparent: true, opacity: 0.75, side: THREE.DoubleSide,
    // Vurgu yüzeyin İÇİNDE kalıyordu (z-fighting: aynı derinlikte iki üçgen)
    // → polygonOffset ile bir tık öne alınıyor.
    polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
    depthWrite: false
  });
  V.hl = new THREE.Mesh(g, mat);
  V.group.add(V.hl);
}

function _svwAttachHover(canvas){
  var V = _veStrViewer;
  var tip = document.createElement('div');
  tip.className = 've-str-vwr-tip';
  tip.style.display = 'none';
  (canvas.parentElement || document.body).appendChild(tip);
  V.tooltip = tip;

  function onHover(e){
    var W = _veStrViewer;
    if(!W || W.disposed) return;
    // Sürükleme SIRASINDA vurgu arama: her karede raycast pahalı ve
    // kullanıcı zaten döndürüyor, seçmiyor.
    if(W.dragging){ tip.style.display = 'none'; return; }
    var r = canvas.getBoundingClientRect();
    W.mouse.x = ((e.clientX - r.left) / r.width) * 2 - 1;
    W.mouse.y = -((e.clientY - r.top) / r.height) * 2 + 1;
    W.raycaster.setFromCamera(W.mouse, W.camera);
    var hits = W.raycaster.intersectObjects(W.solids, false);
    if(!hits.length){
      _svwHighlightFace(-1, null);
      tip.style.display = 'none';
      W.hoverFace = null;
      return;
    }
    var h = hits[0];
    var mi = (h.object.userData && h.object.userData.meshIndex) || 0;
    var face = (typeof veStrFaceOfTriangle === 'function')
      ? veStrFaceOfTriangle(W.geom, mi, h.faceIndex) : null;
    if(!face){ tip.style.display = 'none'; return; }
    if(!W.hoverFace || W.hoverFace.id !== face.id){
      _svwHighlightFace(mi, face);
      W.hoverFace = face;
    }
    tip.innerHTML = '<b>' + String(face.meshName).replace(/</g, '&lt;') + '</b><br>'
      + 'CAD yüzü <b>' + face.id + '</b> · ' + face.triCount + ' üçgen';
    tip.style.display = 'block';
    tip.style.left = Math.max(4, e.clientX - r.left + 12) + 'px';
    tip.style.top  = Math.max(4, e.clientY - r.top + 12) + 'px';
  }
  function onLeave(){
    if(!_veStrViewer) return;
    _svwHighlightFace(-1, null);
    _veStrViewer.hoverFace = null;
    tip.style.display = 'none';
  }
  canvas.addEventListener('mousemove', onHover);
  canvas.addEventListener('mouseleave', onLeave);
  V.detach.push(function(){
    canvas.removeEventListener('mousemove', onHover);
    canvas.removeEventListener('mouseleave', onLeave);
  });
}

// ─── Kurulum ────────────────────────────────────────────────────────────────
// geom: js/structural-model.js'in normalize ettiği model (veStrGeomCacheGet).
function veStrViewerInit(canvasId, geom, nodeId){
  if(typeof THREE === 'undefined') return false;      // THREE yok → sessiz atla
  veStrViewerDispose();
  var canvas = document.getElementById(canvasId);
  if(!canvas || !geom || !geom.ok || !geom.meshes || !geom.meshes.length) return false;
  var wrap = canvas.parentElement;
  var w = Math.max(1, wrap.clientWidth), h = Math.max(1, wrap.clientHeight);

  var scene = new THREE.Scene();
  scene.background = _svwCssColor('--bg-primary', '#0a0a0a');

  var bb = geom.bbox || { center: [0, 0, 0], diag: 100, size: [100, 100, 100] };
  var diag = bb.diag || 100;

  var camera = new THREE.PerspectiveCamera(50, w / h, Math.max(0.01, diag / 5000), diag * 200);
  var renderer;
  try { renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true }); }
  catch(e){ return false; }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(w, h, false);

  var isLight = _svwBgIsLight();
  scene.add(new THREE.AmbientLight(0xffffff, isLight ? 0.85 : 0.65));
  var d1 = new THREE.DirectionalLight(0xffffff, isLight ? 0.55 : 0.75); d1.position.set(1, 2, 1); scene.add(d1);
  var d2 = new THREE.DirectionalLight(0xffffff, 0.28); d2.position.set(-1, -1, -1); scene.add(d2);

  var group = new THREE.Group();
  // Parçayı ORİJİNE taşı: döndürme parçanın merkezi etrafında olsun. Model
  // koordinatları DEĞİŞMİYOR — yalnız sahne dönüşümü (künyedeki mm değerleri
  // ve yüz kimlikleri ham koordinattan okunuyor).
  group.position.set(-bb.center[0], -bb.center[1], -bb.center[2]);
  scene.add(group);

  _veStrViewer = {
    scene: scene, camera: camera, renderer: renderer, canvas: canvas, group: group,
    geom: geom, nodeId: nodeId || null,
    solids: [], edges: [], hl: null, hoverFace: null,
    ctrl: { theta: -Math.PI * 0.72, phi: Math.PI / 3, radius: diag * 1.9, target: new THREE.Vector3(0, 0, 0) },
    minRadius: Math.max(diag * 0.05, 0.05), maxRadius: diag * 40,
    raf: null, disposed: false, ro: null, detach: [],
    raycaster: new THREE.Raycaster(), mouse: new THREE.Vector2(), tooltip: null, dragging: false
  };

  var solidCol = _svwCssColor('--accent-primary', '#3b82f6');
  var edgeCol = _svwCssColor('--text-muted', '#888888');

  geom.meshes.forEach(function(m, mi){
    var g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(m.positions, 3));
    if(m.normals && m.normals.length === m.positions.length){
      g.setAttribute('normal', new THREE.BufferAttribute(m.normals, 3));
    }
    g.setIndex(new THREE.BufferAttribute(m.indices, 1));
    if(!m.normals) g.computeVertexNormals();

    // STEP'ten renk geldiyse ONU kullan (parça kendi rengini taşıyor olabilir);
    // gelmediyse tema vurgusu. Uydurma bir renk paleti kullanmıyoruz.
    var col = (m.color && m.color.length >= 3)
      ? new THREE.Color(m.color[0], m.color[1], m.color[2]) : solidCol;
    var mat = new THREE.MeshPhongMaterial({
      color: col, shininess: 24, flatShading: false, side: THREE.DoubleSide
    });
    var mesh = new THREE.Mesh(g, mat);
    mesh.userData.meshIndex = mi;
    group.add(mesh);
    _veStrViewer.solids.push(mesh);

    // Kenar çizgileri: düz gölgeli bir katıda parçanın KENARLARI okunmaz;
    // teknik bir görüntüde kenar, yüzeyden daha çok şey söyler. 30° eşiği
    // teğetsel (yuvarlatma) üçgen sınırlarını eler, gerçek kenarı bırakır.
    try {
      var eg = new THREE.EdgesGeometry(g, 30);
      var el = new THREE.LineSegments(eg, new THREE.LineBasicMaterial({ color: edgeCol, transparent: true, opacity: 0.55 }));
      group.add(el);
      _veStrViewer.edges.push(el);
    } catch(e){}
  });

  // Önceki oturumun kamerası (aynı düğüm) varsa geri yükle.
  var memo = nodeId ? _veStrViewerCam[nodeId] : null;
  if(memo){
    var c = _veStrViewer.ctrl;
    c.theta = memo.theta; c.phi = memo.phi; c.radius = memo.radius;
    c.target.set(memo.tx, memo.ty, memo.tz);
  }
  _svwUpdateCamera();
  _svwAttachControls(canvas);
  _svwAttachHover(canvas);

  if(typeof ResizeObserver !== 'undefined'){
    try {
      _veStrViewer.ro = new ResizeObserver(function(){ veStrViewerResize(); });
      _veStrViewer.ro.observe(wrap);
    } catch(e){}
  }

  function loop(){
    var V = _veStrViewer;
    // Bu döngü ARTIK güncel görüntüleyiciye ait değilse sus (araya yeni init
    // girdi) — yoksa iki döngü aynı anda döner.
    if(!V || V.disposed || V.renderer !== renderer) return;
    // Kanvas DOM'dan koparıldıysa görüntüleyici görünmez ama rAF ve WebGL
    // bağlamı yaşamaya devam ederdi → panel her yeniden çizildiğinde bir
    // bağlam daha sızar. Kopukluğu görünce kendini kapat.
    if(!V.canvas.isConnected){ veStrViewerDispose(); return; }
    V.raf = requestAnimationFrame(loop);
    try { V.renderer.render(V.scene, V.camera); } catch(e){}
  }
  loop();
  return true;
}

// Kamerayı parçaya göre yeniden çerçevele ("Sıfırla").
function veStrViewerReset(){
  var V = _veStrViewer;
  if(!V || V.disposed) return;
  if(V.nodeId) delete _veStrViewerCam[V.nodeId];
  var bb = V.geom.bbox || { diag: 100 };
  V.ctrl.theta = -Math.PI * 0.72;
  V.ctrl.phi = Math.PI / 3;
  V.ctrl.radius = (bb.diag || 100) * 1.9;
  V.ctrl.target.set(0, 0, 0);
  _svwUpdateCamera();
}

// Kenar çizgilerini gizle/göster.
function veStrViewerToggleEdges(on){
  var V = _veStrViewer;
  if(!V || V.disposed) return;
  V.edges.forEach(function(e){ e.visible = !!on; });
}

// Standart görüşler — teknik resim alışkanlığı (Ön/Üst/Sağ/İzometrik).
function veStrViewerView(which){
  var V = _veStrViewer;
  if(!V || V.disposed) return;
  var c = V.ctrl;
  if(which === 'top')       { c.theta = -Math.PI / 2; c.phi = 0.02; }
  else if(which === 'front'){ c.theta = -Math.PI / 2; c.phi = Math.PI / 2; }
  else if(which === 'right'){ c.theta = 0;            c.phi = Math.PI / 2; }
  else                      { c.theta = -Math.PI * 0.72; c.phi = Math.PI / 3; }
  _svwUpdateCamera();
}
