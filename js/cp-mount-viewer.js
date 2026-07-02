// ============================================================================
// TAKOZ ÇÖKME-TİTREŞİM — 3D GÖRÜNTÜLEYİCİ (SPEC Bölüm 8, v1)
// ============================================================================
// A26 Three.js görüntüleyicisinin portu (MFSim vendored THREE r144 ile).
// Çizilenler: takoz küpleri · bileşen CG işaretleri (kütleye göre boyut) ·
// birleşik CG (kırmızı) · bağlantı çizgileri · eksen üçlüsü.
//
// Koordinat: kullanıcı girişi X=fore/aft, Y=left/right, Z=up (mm).
// Three.js Y-up → (x,y,z)_giriş = (x, z, y)_dünya (A26 konvansiyonu).
// Ölçek: 1 sahne birimi = 1 mm.
//
// Veri kaynağı: _veMountEditorNode.data.mnt (cp-mount.js editör durumu).
// Saf sunum: matematiğe dokunmaz. THREE yoksa graceful no-op.
// ----------------------------------------------------------------------------

var _veMountViewer = null;

function veMountViewerInit(canvasId){
  if(typeof THREE === 'undefined') return;      // THREE yüklü değil → sessiz atla
  veMountViewerDispose();
  var canvas = document.getElementById(canvasId);
  if(!canvas) return;
  var wrap = canvas.parentElement;
  var w = Math.max(1, wrap.clientWidth), h = Math.max(1, wrap.clientHeight);

  var scene = new THREE.Scene();
  scene.background = new THREE.Color(0x0a0a0a);

  var camera = new THREE.PerspectiveCamera(55, w/h, 1, 50000);
  var renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
  } catch(e){ return; }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio||1, 2));
  renderer.setSize(w, h, false);

  scene.add(new THREE.AmbientLight(0xffffff, 0.7));
  var d1 = new THREE.DirectionalLight(0xffffff, 0.8); d1.position.set(500,1000,500); scene.add(d1);
  var d2 = new THREE.DirectionalLight(0xffffff, 0.3); d2.position.set(-500,-500,-500); scene.add(d2);

  var grid = new THREE.GridHelper(3000, 30, 0x333333, 0x222222);
  grid.position.y = -200; scene.add(grid);

  var group = new THREE.Group(); scene.add(group);   // yeniden kurulan içerik

  _veMountViewer = {
    scene:scene, camera:camera, renderer:renderer, canvas:canvas, group:group,
    massScale:{min:0,max:1},
    ctrl:{ theta:-Math.PI*0.75, phi:Math.PI/3, radius:2800, target:new THREE.Vector3(0,0,0) },
    raf:null, disposed:false
  };

  _mntViewerAxes(scene);
  _mntViewerUpdateCamera();
  _mntViewerAttachControls(canvas);

  function loop(){
    if(!_veMountViewer || _veMountViewer.disposed) return;
    _veMountViewer.raf = requestAnimationFrame(loop);
    renderer.render(scene, camera);
  }
  loop();
}

function _mntViewerUpdateCamera(){
  var V=_veMountViewer; if(!V) return;
  var c=V.ctrl;
  var x = c.target.x + c.radius*Math.sin(c.phi)*Math.cos(c.theta);
  var y = c.target.y + c.radius*Math.cos(c.phi);
  var z = c.target.z + c.radius*Math.sin(c.phi)*Math.sin(c.theta);
  V.camera.position.set(x,y,z);
  V.camera.lookAt(c.target);
}

function _mntViewerAttachControls(canvas){
  var dragging=false, btn=0, px=0, py=0;
  canvas.addEventListener('mousedown', function(e){ dragging=true; btn=e.button; px=e.clientX; py=e.clientY; e.preventDefault(); });
  window.addEventListener('mouseup', function(){ dragging=false; });
  window.addEventListener('mousemove', function(e){
    var V=_veMountViewer; if(!V || !dragging) return;
    var dx=e.clientX-px, dy=e.clientY-py; px=e.clientX; py=e.clientY;
    var c=V.ctrl;
    if(btn===2){ // pan
      var sp=c.radius*0.001;
      var dir=new THREE.Vector3().subVectors(c.target, V.camera.position).normalize();
      var right=new THREE.Vector3().crossVectors(dir, V.camera.up).normalize();
      var up=new THREE.Vector3().crossVectors(right, dir).normalize();
      c.target.addScaledVector(right, -dx*sp);
      c.target.addScaledVector(up, dy*sp);
    } else {     // rotate
      c.theta -= dx*0.01;
      c.phi = Math.max(0.1, Math.min(Math.PI-0.1, c.phi - dy*0.01));
    }
    _mntViewerUpdateCamera();
  });
  canvas.addEventListener('wheel', function(e){
    var V=_veMountViewer; if(!V) return;
    e.preventDefault();
    V.ctrl.radius = Math.max(500, Math.min(20000, V.ctrl.radius + e.deltaY*2));
    _mntViewerUpdateCamera();
  }, {passive:false});
  canvas.addEventListener('contextmenu', function(e){ e.preventDefault(); });
}

function _mntViewerAxes(scene){
  function line(a,b,color){
    var g=new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(a[0],a[1],a[2]), new THREE.Vector3(b[0],b[1],b[2])]);
    return new THREE.Line(g, new THREE.LineBasicMaterial({color:color}));
  }
  var L=400;
  // giriş X→dünya +X (kırmızı), giriş Y→dünya +Z (yeşil), giriş Z→dünya +Y (mavi)
  scene.add(line([0,0,0],[L,0,0],0xff4444));
  scene.add(line([0,0,0],[0,0,L],0x44ff44));
  scene.add(line([0,0,0],[0,L,0],0x4444ff));
  scene.add(_mntViewerLabel('X',[L+40,0,0]));
  scene.add(_mntViewerLabel('Y',[0,0,L+40]));
  scene.add(_mntViewerLabel('Z',[0,L+40,0]));
}
function _mntViewerLabel(text, pos){
  var cv=document.createElement('canvas'); cv.width=64; cv.height=64;
  var ctx=cv.getContext('2d'); ctx.fillStyle='#fff'; ctx.font='bold 40px Arial'; ctx.textAlign='center'; ctx.textBaseline='middle';
  ctx.fillText(text, 32, 32);
  var tex=new THREE.CanvasTexture(cv);
  var sp=new THREE.Sprite(new THREE.SpriteMaterial({map:tex, transparent:true}));
  sp.position.set(pos[0],pos[1],pos[2]); sp.scale.set(60,60,1);
  return sp;
}

// giriş (x,y,z) mm → dünya vektörü
function _mntW(x,y,z){ return new THREE.Vector3(x, z, y); }

// Kütle → CG işaret yarıçapı (A26 getCGMarkerRadiusFromMass portu)
function _mntCGRadius(mass, ms){
  if(!(mass>0)) return 22;
  var rng=ms.max-ms.min;
  var t = rng>1e-9 ? (mass-ms.min)/rng : 0.5;
  return 18 + 28*Math.sqrt(Math.max(0,Math.min(1,t)));
}

function veMountViewerUpdate(){
  var V=_veMountViewer; if(!V) return;
  var node = (typeof _veMountEditorNode!=='undefined') ? _veMountEditorNode : null;
  if(!node || !node.data || !node.data.mnt) return;
  var d = node.data.mnt;

  // Eski içeriği temizle
  while(V.group.children.length){
    var o=V.group.children.pop();
    if(o.geometry) o.geometry.dispose();
    if(o.material){ if(o.material.map) o.material.map.dispose(); o.material.dispose(); }
    V.group.remove(o);
  }

  var num=function(v){ var n=Number(String(v).replace(',','.')); return Number.isFinite(n)?n:NaN; };

  // Kütle ölçeği
  var masses = d.components.map(function(c){ return num(c.mass); }).filter(function(m){ return m>0; });
  V.massScale.min = masses.length ? Math.min.apply(null,masses) : 0;
  V.massScale.max = masses.length ? Math.max.apply(null,masses) : 1;

  // Birleşik CG (kütle ağırlıklı ortalama, mm)
  var mSum=0, sx=0, sy=0, sz=0;
  d.components.forEach(function(c){
    var m=num(c.mass), x=num(c.cgx), y=num(c.cgy), z=num(c.cgz);
    if(m>0 && Number.isFinite(x)&&Number.isFinite(y)&&Number.isFinite(z)){ mSum+=m; sx+=m*x; sy+=m*y; sz+=m*z; }
  });
  var hasCG = mSum>0;
  var cg = hasCG ? [sx/mSum, sy/mSum, sz/mSum] : [0,0,0];

  // Takoz küpleri + bağlantı çizgileri
  d.mounts.forEach(function(mt){
    var x=num(mt.x), y=num(mt.y), z=num(mt.z);
    if(!(Number.isFinite(x)&&Number.isFinite(y)&&Number.isFinite(z))) return;
    var box=new THREE.Mesh(new THREE.BoxGeometry(60,40,60),
      new THREE.MeshPhongMaterial({color:0x22c55e, emissive:0x114422, shininess:30}));
    box.position.copy(_mntW(x,y,z));
    V.group.add(box);
    if(hasCG){
      var g=new THREE.BufferGeometry().setFromPoints([_mntW(cg[0],cg[1],cg[2]), _mntW(x,y,z)]);
      var ln=new THREE.Line(g, new THREE.LineDashedMaterial({color:0x888888, dashSize:30, gapSize:15, transparent:true, opacity:0.6}));
      ln.computeLineDistances();
      V.group.add(ln);
    }
  });

  // Bileşen CG işaretleri
  d.components.forEach(function(c){
    var m=num(c.mass), x=num(c.cgx), y=num(c.cgy), z=num(c.cgz);
    if(!(Number.isFinite(x)&&Number.isFinite(y)&&Number.isFinite(z))) return;
    var r=_mntCGRadius(m, V.massScale);
    var s=new THREE.Mesh(new THREE.SphereGeometry(r,18,18),
      new THREE.MeshPhongMaterial({color:0xf59e0b, emissive:0x553300, shininess:20}));
    s.position.copy(_mntW(x,y,z));
    V.group.add(s);
  });

  // Birleşik CG (kırmızı)
  if(hasCG){
    var cgm=new THREE.Mesh(new THREE.SphereGeometry(40,32,32),
      new THREE.MeshPhongMaterial({color:0xef4444, emissive:0x551111, shininess:80}));
    cgm.position.copy(_mntW(cg[0],cg[1],cg[2]));
    V.group.add(cgm);
    // Kamera hedefini birleşik CG'ye getir (ilk kurulumda)
    if(!V._framed){ V.ctrl.target.copy(_mntW(cg[0],cg[1],cg[2])); _mntViewerUpdateCamera(); V._framed=true; }
  }
}

function veMountViewerDispose(){
  var V=_veMountViewer; if(!V) return;
  V.disposed=true;
  if(V.raf) cancelAnimationFrame(V.raf);
  try {
    while(V.group && V.group.children.length){
      var o=V.group.children.pop();
      if(o.geometry) o.geometry.dispose();
      if(o.material){ if(o.material.map) o.material.map.dispose(); o.material.dispose(); }
    }
    if(V.renderer){ V.renderer.dispose(); }
  } catch(e){}
  _veMountViewer=null;
}
