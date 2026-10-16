// ============================================================================
// TAKOZ ÇÖKME-TİTREŞİM — KOORDİNAT DÜZLEMİ'NİN 3B SAHNESİ
// ============================================================================
// A26 Three.js görüntüleyicisinin portu (MFSim vendored THREE r144 ile).
// Koordinat Düzlemi (mnt-coordframe) penceresi: üç eksen oku, eksi yönlerin
// soluk çizgileri, üç yarı saydam düzlem, yön etiketleri.
//
// 3D Görüntüleyici'nin three.js sahnesi ("model" kipi: takoz küpleri, CG
// küreleri, fare ipucu, kendi tam ekranı) 2026-10-16'da KALDIRILDI —
// kullanıcı kararı: "Klasik 3B" sekmesi yalnız ad olarak kalır, ilerleyen
// zamanda gerçek CAD dosyasıyla işlenecek. Model Görünümler bileşeninde
// döndürülüyor (js/mount-akso.js).
//
// Koordinat: kullanıcı girişi X=fore/aft, Y=left/right, Z=up (mm).
// Three.js Y-up → (x,y,z)_giriş = (x, z, y)_dünya (A26 konvansiyonu).
// Saf sunum: matematiğe dokunmaz. THREE yoksa graceful no-op.
// ----------------------------------------------------------------------------

var _veMountViewer = null;

// Kamera hafızası (kip başına). Görüntüleyici kendi kanvasına bağlıdır;
// panel HTML'i her yeniden çizildiğinde (arka-plan kaydetme sonrası panel
// tazeleme) kanvas yeniden kurulur ve sahne SIFIRDAN inşa edilir. Açıyı da
// sıfırlamak kullanıcının döndürüp yakınlaştırdığı görüşü habersiz siliyordu →
// dispose anında sakla, aynı kipte kurulurken geri yükle. "Sıfırla" düğmesi
// hafızayı da temizler.
var _veMountViewerCam = {};

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
// Aktif zemin açık mı? (ışık dengesi için basit parlaklık eşiği)
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

  // Izgara çizgileri: kenarlık rengi (tema) + soluk varyantı. AÇILIŞTA GİZLİ
  // (kullanıcı isteği: eksenler "havada" + geri çekilmiş görünüm); "Zemin"
  // düğmesiyle açılır, zemin düzlemiyle hizalı.
  var gc = _mntViewerCssColor('--border-color', '#333333');
  var grid = new THREE.GridHelper(3000, 30, gc, gc.clone().multiplyScalar(0.55));
  grid.position.y = 0; grid.visible = false; scene.add(grid);

  var group = new THREE.Group(); scene.add(group);   // yeniden kurulan içerik

  // Başlangıç: geri çekilmiş, dikey ekseni (+Z) çerçeveleyen görünüm (hedef biraz yukarı).
  _veMountViewer = {
    scene:scene, camera:camera, renderer:renderer, canvas:canvas, group:group,
    grid:grid, mode:mode||'coordframe',
    axes:[], labelSprites:[], planes:[],
    ctrl:{ theta:-Math.PI*0.75, phi:Math.PI/3, radius:2600, target:new THREE.Vector3(0,150,0) },
    raf:null, disposed:false, ro:null, detach:[]
  };

  // Önceki oturumun kamera açısı varsa geri yükle (bkz. _veMountViewerCam).
  // _framed=true → veMountViewerUpdate kamerayı yeniden çerçevelemeye
  // kalkmaz, kullanıcının bıraktığı açı korunur.
  var _memo = _veMountViewerCam[_veMountViewer.mode];
  if(_memo){
    var _c = _veMountViewer.ctrl;
    _c.theta=_memo.theta; _c.phi=_memo.phi; _c.radius=_memo.radius;
    _c.target.set(_memo.tx, _memo.ty, _memo.tz);
    _veMountViewer._framed = true;
  }

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
    var V=_veMountViewer;
    // Bu döngü ARTIK güncel görüntüleyiciye ait değilse (araya yeni bir init
    // girdi) sessizce sus — yoksa iki döngü aynı anda döner.
    if(!V || V.disposed || V.renderer!==renderer) return;
    V.raf = requestAnimationFrame(loop);
    // Kanvas DOM'dan koparıldıysa görüntüleyici görünmez ama rAF döngüsü ve
    // WebGL bağlamı yaşamaya devam ederdi. Panel her yeniden çizildiğinde
    // (bileşen değiştir, arka-plan kaydetme, sekme) bir bağlam daha sızar;
    // tarayıcının bağlam sınırı (~8-16) dolunca EN ESKİ bağlam zorla düşürülür
    // ve o an AÇIK olan görüntüleyicinin ekranı kendiliğinden boşalır.
    // Koptuğunu görür görmez kendini topla.
    if(canvas.isConnected === false){ veMountViewerDispose(); return; }
    // Panel gizliyken (display:none → 0 ölçü) çizmenin anlamı yok.
    if(!canvas.clientWidth || !canvas.clientHeight) return;
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

// Görünümü başlangıç açısına/uzaklığına sıfırla.
function veMountViewerReset(){
  var V=_veMountViewer; if(!V) return;
  // Sıfırlama kamera hafızasını da siler — yoksa panel bir sonraki yeniden
  // çiziminde sıfırladığın açı yerine eski açıya dönerdi.
  try { delete _veMountViewerCam[V.mode]; } catch(e){}
  V.ctrl.theta=-Math.PI*0.75; V.ctrl.phi=Math.PI/3;
  V.ctrl.radius=2600;
  V.ctrl.target.set(0, 150, 0);      // dikey ekseni (+Z) çerçevele: hedef biraz yukarıda
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

// NOT: pencere (window) düzeyindeki dinleyiciler dispose'ta MUTLAKA sökülür
// (V.detach). Aksi hâlde görüntüleyici her yeniden kurulduğunda bir çift
// mousemove/mouseup dinleyicisi daha birikirdi.
function _mntViewerAttachControls(canvas){
  var V=_veMountViewer; if(!V) return;
  var dragging=false, btn=0, px=0, py=0;
  function onDown(e){ dragging=true; btn=e.button; px=e.clientX; py=e.clientY; e.preventDefault(); }
  function onUp(){ dragging=false; }
  function onMove(e){
    var W=_veMountViewer; if(!W || W.disposed || !dragging) return;
    var dx=e.clientX-px, dy=e.clientY-py; px=e.clientX; py=e.clientY;
    var c=W.ctrl;
    if(btn===2){ // pan
      var sp=c.radius*0.001;
      var dir=new THREE.Vector3().subVectors(c.target, W.camera.position).normalize();
      var right=new THREE.Vector3().crossVectors(dir, W.camera.up).normalize();
      var up=new THREE.Vector3().crossVectors(right, dir).normalize();
      c.target.addScaledVector(right, -dx*sp);
      c.target.addScaledVector(up, dy*sp);
    } else {     // rotate
      c.theta -= dx*0.01;
      c.phi = Math.max(0.1, Math.min(Math.PI-0.1, c.phi - dy*0.01));
    }
    _mntViewerUpdateCamera();
  }
  function onWheel(e){
    var W=_veMountViewer; if(!W || W.disposed) return;
    e.preventDefault();
    W.ctrl.radius = Math.max(500, Math.min(20000, W.ctrl.radius + e.deltaY*2));
    _mntViewerUpdateCamera();
  }
  function onCtx(e){ e.preventDefault(); }
  canvas.addEventListener('mousedown', onDown);
  window.addEventListener('mouseup', onUp);
  window.addEventListener('mousemove', onMove);
  canvas.addEventListener('wheel', onWheel, {passive:false});
  canvas.addEventListener('contextmenu', onCtx);
  V.detach.push(function(){
    canvas.removeEventListener('mousedown', onDown);
    window.removeEventListener('mouseup', onUp);
    window.removeEventListener('mousemove', onMove);
    canvas.removeEventListener('wheel', onWheel);
    canvas.removeEventListener('contextmenu', onCtx);
  });
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

// Sahneyi kur: eksen + düzlem + yön etiketleri; veri gerektirmez.
function veMountViewerUpdate(){
  var V=_veMountViewer; if(!V) return;
  _mntViewerClearGroup(V); V.axes=[]; V.labelSprites=[]; V.planes=[];
  _mntViewerDrawCoordFrame(V);
  // Geri çekilmiş + dikey ekseni çerçeveleyen başlangıç görünümü (hedef biraz yukarı).
  if(!V._framed){ V.ctrl.target.set(0,150,0); V.ctrl.radius=2600; _mntViewerUpdateCamera(); V._framed=true; }
}

// ─── Koordinat Düzlemi (mnt-coordframe) — eksen + düzlem + yön etiketleri ─────
// Genişliğe uyan metin sprite'ı (çok karakterli yön etiketleri için).
function _mntViewerTextSprite(text, pos, color, worldSize){
  var fs=44, pad=10;
  var cv=document.createElement('canvas'); var ctx=cv.getContext('2d');
  ctx.font=veThemeFont(fs, 'bold');
  var tw=Math.max(1, Math.ceil(ctx.measureText(text).width));
  cv.width=tw+pad*2; cv.height=fs+pad*2;
  ctx=cv.getContext('2d');
  ctx.font=veThemeFont(fs, 'bold'); ctx.textAlign='center'; ctx.textBaseline='middle';
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
  // Kamera açısını sakla (yalnız çerçevelenmiş bir görünüm anlamlıdır).
  if(V.mode && V.ctrl && V._framed){
    try {
      _veMountViewerCam[V.mode] = {
        theta:V.ctrl.theta, phi:V.ctrl.phi, radius:V.ctrl.radius,
        tx:V.ctrl.target.x, ty:V.ctrl.target.y, tz:V.ctrl.target.z
      };
    } catch(e){}
  }
  if(V.raf) cancelAnimationFrame(V.raf);
  if(V.ro){ try{ V.ro.disconnect(); }catch(e){} }
  if(V.detach){ V.detach.forEach(function(fn){ try{ fn(); }catch(e){} }); V.detach=[]; }
  try {
    // Sahnenin TAMAMINI boşalt: group içeriği + doğrudan sahneye eklenen
    // ışıklar ve ızgara (bunlar eskiden sızıyordu).
    if(V.scene && typeof V.scene.traverse==='function'){
      V.scene.traverse(function(o){
        if(o.geometry && o.geometry.dispose) o.geometry.dispose();
        var mats = o.material ? (Array.isArray(o.material)?o.material:[o.material]) : [];
        mats.forEach(function(m){
          if(!m) return;
          if(m.map && m.map.dispose) m.map.dispose();
          if(m.dispose) m.dispose();
        });
      });
    }
    if(V.renderer){
      // dispose() TEK BAŞINA WebGL bağlamını bırakmaz; bağlam sayacı dolunca
      // tarayıcı en eski bağlamı düşürür ve açık görüntüleyici kararır.
      // forceContextLoss() bağlamı gerçekten serbest bırakır.
      if(typeof V.renderer.forceContextLoss==='function'){ try{ V.renderer.forceContextLoss(); }catch(e){} }
      V.renderer.dispose();
    }
  } catch(e){}
  _veMountViewer=null;
}
