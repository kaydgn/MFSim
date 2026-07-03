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
// Veri kaynağı: _veMntViewerData (Çözücü'nün topladığı kütle+takoz, cp-mount.js).
// Saf sunum: matematiğe dokunmaz. THREE yoksa graceful no-op.
// ----------------------------------------------------------------------------

var _veMountViewer = null;

// ─── Tema yardımcıları ───────────────────────────────────────────────────────
// Aktif temanın CSS değişkenlerinden renk oku (koyu/açık tema uyumu). THREE.Color
// setStyle 'rgb()/hsl()/#hex/isim' değerlerini çözer; çözülemezse yedeğe düşer.
function _mntViewerCssStr(varName, fallback){
  try {
    if(typeof document==='undefined' || typeof getComputedStyle==='undefined') return fallback;
    var v = getComputedStyle(document.documentElement).getPropertyValue(varName);
    v = v ? v.trim() : '';
    return v || fallback;
  } catch(e){ return fallback; }
}
function _mntViewerCssColor(varName, fallback){
  try { return new THREE.Color(_mntViewerCssStr(varName, fallback)); }
  catch(e){ return new THREE.Color(fallback); }
}
// Aktif zemin açık mı? (ışık/etiket dengesi için basit parlaklık eşiği)
function _mntViewerBgIsLight(){
  try {
    var c = _mntViewerCssColor('--bg-primary', '#0a0a0a');
    return (0.299*c.r + 0.587*c.g + 0.114*c.b) > 0.5;
  } catch(e){ return false; }
}

function veMountViewerInit(canvasId, mode){
  if(typeof THREE === 'undefined') return;      // THREE yüklü değil → sessiz atla
  veMountViewerDispose();
  var canvas = document.getElementById(canvasId);
  if(!canvas) return;
  var wrap = canvas.parentElement;
  var w = Math.max(1, wrap.clientWidth), h = Math.max(1, wrap.clientHeight);

  var scene = new THREE.Scene();
  scene.background = _mntViewerCssColor('--bg-primary', '#0a0a0a');

  var camera = new THREE.PerspectiveCamera(55, w/h, 1, 50000);
  var renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
  } catch(e){ return; }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio||1, 2));
  renderer.setSize(w, h, false);

  // Açık temada düz beyaz zemin fazla parlar → ışıkları temaya göre dengele.
  var isLight = _mntViewerBgIsLight();
  scene.add(new THREE.AmbientLight(0xffffff, isLight ? 0.85 : 0.7));
  var d1 = new THREE.DirectionalLight(0xffffff, isLight ? 0.6 : 0.8); d1.position.set(500,1000,500); scene.add(d1);
  var d2 = new THREE.DirectionalLight(0xffffff, 0.3); d2.position.set(-500,-500,-500); scene.add(d2);

  // Izgara çizgileri: kenarlık rengi (tema) + soluk varyantı.
  var gc = _mntViewerCssColor('--border-color', '#333333');
  var grid = new THREE.GridHelper(3000, 30, gc, gc.clone().multiplyScalar(0.55));
  grid.position.y = -200; scene.add(grid);

  var group = new THREE.Group(); scene.add(group);   // yeniden kurulan içerik

  _veMountViewer = {
    scene:scene, camera:camera, renderer:renderer, canvas:canvas, group:group,
    grid:grid, mode:(mode||'model'),
    axes:[], labelSprites:[], planes:[],
    massScale:{min:0,max:1},
    ctrl:{ theta:-Math.PI*0.75, phi:Math.PI/3, radius:2800, target:new THREE.Vector3(0,0,0) },
    raf:null, disposed:false, ro:null
  };

  // Sabit eksen üçlüsü (model modu). Koordinat modu ekseni kendi çizer.
  if(_veMountViewer.mode !== 'coordframe') _mntViewerAxes(scene);
  _mntViewerUpdateCamera();
  _mntViewerAttachControls(canvas);

  // Panel yeniden boyutlandığında canvas'ı takip et (resize desteği).
  if(typeof ResizeObserver !== 'undefined'){
    try {
      _veMountViewer.ro = new ResizeObserver(function(){ veMountViewerResize(); });
      _veMountViewer.ro.observe(wrap);
    } catch(e){}
  }

  function loop(){
    if(!_veMountViewer || _veMountViewer.disposed) return;
    _veMountViewer.raf = requestAnimationFrame(loop);
    renderer.render(scene, camera);
  }
  loop();
}

// Panel/sarmal boyutu değişince renderer + kamera en-boy oranını güncelle.
function veMountViewerResize(){
  var V=_veMountViewer; if(!V || !V.canvas) return;
  var wrap=V.canvas.parentElement; if(!wrap) return;
  var w=Math.max(1, wrap.clientWidth), h=Math.max(1, wrap.clientHeight);
  V.camera.aspect = w/h; V.camera.updateProjectionMatrix();
  V.renderer.setSize(w, h, false);
}

// Görünüm katmanı aç/kapa: 'grid' | 'axes' | 'labels' | 'planes'. Yeni görünürlük döner.
function veMountViewerToggle(what){
  var V=_veMountViewer; if(!V) return true;
  var vis=true;
  if(what==='grid' && V.grid){ V.grid.visible=!V.grid.visible; vis=V.grid.visible; }
  else if(what==='axes'){ V.axes.forEach(function(o){ o.visible=!o.visible; }); vis=V.axes.length?V.axes[0].visible:true; }
  else if(what==='labels'){ V.labelSprites.forEach(function(o){ o.visible=!o.visible; }); vis=V.labelSprites.length?V.labelSprites[0].visible:true; }
  else if(what==='planes'){ V.planes.forEach(function(o){ o.visible=!o.visible; }); vis=V.planes.length?V.planes[0].visible:true; }
  return vis;
}

// Görünümü başlangıç açısına/uzaklığına sıfırla (ve içeriğe yeniden çerçevele).
function veMountViewerReset(){
  var V=_veMountViewer; if(!V) return;
  V.ctrl.theta=-Math.PI*0.75; V.ctrl.phi=Math.PI/3;
  V.ctrl.radius=(V.mode==='coordframe')?1700:2800;
  V.ctrl.target.set(0,0,0);
  V._framed=false;
  _mntViewerUpdateCamera();
  if(typeof veMountViewerUpdate==='function') veMountViewerUpdate();
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
  var V=_veMountViewer;
  function line(a,b,color){
    var g=new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(a[0],a[1],a[2]), new THREE.Vector3(b[0],b[1],b[2])]);
    var ln=new THREE.Line(g, new THREE.LineBasicMaterial({color:color}));
    scene.add(ln); if(V) V.axes.push(ln); return ln;
  }
  function label(t,p){ var s=_mntViewerLabel(t,p); scene.add(s); if(V) V.labelSprites.push(s); return s; }
  var L=400;
  // giriş X→dünya +X (kırmızı), giriş Y→dünya +Z (yeşil), giriş Z→dünya +Y (mavi)
  line([0,0,0],[L,0,0],0xff4444);
  line([0,0,0],[0,0,L],0x44ff44);
  line([0,0,0],[0,L,0],0x4444ff);
  label('X',[L+40,0,0]);
  label('Y',[0,0,L+40]);
  label('Z',[0,L+40,0]);
}
function _mntViewerLabel(text, pos){
  var cv=document.createElement('canvas'); cv.width=64; cv.height=64;
  var ctx=cv.getContext('2d'); ctx.fillStyle=_mntViewerCssStr('--text-primary','#ffffff'); ctx.font='bold 40px Arial'; ctx.textAlign='center'; ctx.textBaseline='middle';
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

// Grup içeriğini temizle (geometri/materyal serbest bırak).
function _mntViewerClearGroup(V){
  while(V.group.children.length){
    var o=V.group.children.pop();
    if(o.geometry) o.geometry.dispose();
    if(o.material){ if(o.material.map) o.material.map.dispose(); o.material.dispose(); }
    V.group.remove(o);
  }
}

function veMountViewerUpdate(){
  var V=_veMountViewer; if(!V) return;

  // Koordinat düzlemi modu: eksen + düzlem + yön etiketleri çiz, veri gerektirmez.
  if(V.mode==='coordframe'){
    _mntViewerClearGroup(V); V.axes=[]; V.labelSprites=[]; V.planes=[];
    _mntViewerDrawCoordFrame(V);
    if(!V._framed){ V.ctrl.target.set(0,0,0); V.ctrl.radius=1700; _mntViewerUpdateCamera(); V._framed=true; }
    return;
  }

  // Çözücü'nün topladığı kütle+takoz verisi (UI mm; cp-mount.js sağlar)
  var d = (typeof _veMntViewerData!=='undefined' && _veMntViewerData) ? _veMntViewerData : null;
  if(!d) return;
  if(!d.components) d.components=[]; if(!d.mounts) d.mounts=[];

  // Eski içeriği temizle
  _mntViewerClearGroup(V);

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

// ─── Koordinat Düzlemi (mnt-coordframe) — eksen + düzlem + yön etiketleri ─────
// Genişliğe uyan metin sprite'ı (çok karakterli yön etiketleri için).
function _mntViewerTextSprite(text, pos, color, worldSize){
  var fs=44, pad=10;
  var cv=document.createElement('canvas'); var ctx=cv.getContext('2d');
  ctx.font='bold '+fs+'px Arial';
  var tw=Math.max(1, Math.ceil(ctx.measureText(text).width));
  cv.width=tw+pad*2; cv.height=fs+pad*2;
  ctx=cv.getContext('2d');
  ctx.font='bold '+fs+'px Arial'; ctx.textAlign='center'; ctx.textBaseline='middle';
  ctx.fillStyle=color||_mntViewerCssStr('--text-primary','#ffffff');
  ctx.fillText(text, cv.width/2, cv.height/2);
  var tex=new THREE.CanvasTexture(cv);
  var sp=new THREE.Sprite(new THREE.SpriteMaterial({map:tex, transparent:true, depthTest:false}));
  var ws=worldSize||120;
  sp.scale.set(ws*(cv.width/cv.height), ws, 1);
  sp.position.set(pos[0],pos[1],pos[2]);
  return sp;
}
function _mntViewerDrawCoordFrame(V){
  var G=V.group, L=700, S=900;
  if(V.grid) V.grid.position.y=0;   // ızgarayı zemin düzlemiyle hizala
  function arrow(dir,color){
    var a=new THREE.ArrowHelper(new THREE.Vector3(dir[0],dir[1],dir[2]).normalize(), new THREE.Vector3(0,0,0), L, color, 95, 58);
    G.add(a); V.axes.push(a);
  }
  // giriş X→dünya+X (kırmızı), giriş Y→dünya+Z (yeşil), giriş Z→dünya+Y (mavi, yukarı)
  arrow([1,0,0], 0xef4444); arrow([0,0,1], 0x22c55e); arrow([0,1,0], 0x3b82f6);
  function negline(b,color){
    var g=new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0,0,0), new THREE.Vector3(b[0],b[1],b[2])]);
    var ln=new THREE.Line(g, new THREE.LineBasicMaterial({color:color, transparent:true, opacity:0.35}));
    G.add(ln); V.axes.push(ln);
  }
  negline([-L*0.6,0,0],0xef4444); negline([0,0,-L*0.6],0x22c55e); negline([0,-L*0.6,0],0x3b82f6);
  function plane(rotX,rotY,color){
    var m=new THREE.Mesh(new THREE.PlaneGeometry(2*S,2*S), new THREE.MeshBasicMaterial({color:color, transparent:true, opacity:0.07, side:THREE.DoubleSide, depthWrite:false}));
    if(rotX) m.rotation.x=rotX; if(rotY) m.rotation.y=rotY;
    G.add(m); V.planes.push(m);
  }
  plane(-Math.PI/2, 0, 0x3b82f6);  // giriş XY (zemin) ⟂ Z
  plane(0, 0, 0x22c55e);           // giriş XZ ⟂ Y
  plane(0, Math.PI/2, 0xef4444);   // giriş YZ ⟂ X
  var tp=_mntViewerCssStr('--text-primary','#ffffff');
  function lab(text,pos,color,sz){ var s=_mntViewerTextSprite(text,pos,color,sz); G.add(s); V.labelSprites.push(s); }
  lab('+X · Arka',   [L+130,0,0], '#ef4444', 120);
  lab('+Y · Sağ',    [0,0,L+130], '#22c55e', 120);
  lab('+Z · Yukarı', [0,L+130,0], '#3b82f6', 120);
  lab('Ön',   [-L*0.6-80,0,0], tp, 85);
  lab('Sol',  [0,0,-L*0.6-80], tp, 85);
  lab('Aşağı',[0,-L*0.6-80,0], tp, 85);
  var o=new THREE.Mesh(new THREE.SphereGeometry(24,20,20), new THREE.MeshBasicMaterial({color:tp}));
  G.add(o);
}

function veMountViewerDispose(){
  var V=_veMountViewer; if(!V) return;
  V.disposed=true;
  if(V.raf) cancelAnimationFrame(V.raf);
  if(V.ro){ try{ V.ro.disconnect(); }catch(e){} }
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
