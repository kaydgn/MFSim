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

// Kamera hafızası (mod başına: 'model' | 'coordframe'). Görüntüleyici kendi
// kanvasına bağlıdır; panel HTML'i her yeniden çizildiğinde (arka-plan kaydetme
// sonrası panel tazeleme, "Yenile", tam ekrandan dönüş) kanvas yeniden kurulur
// ve sahne SIFIRDAN inşa edilir. Açıyı da sıfırlamak kullanıcının döndürüp
// yakınlaştırdığı görüşü habersiz siliyordu → dispose anında sakla, aynı modda
// kurulurken geri yükle. "Sıfırla" düğmesi hafızayı da temizler.
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
// Aktif zemin açık mı? (ışık/etiket dengesi için basit parlaklık eşiği)
function _mntViewerBgIsLight(){
  try {
    var c = _mntViewerCssColor('--bg-primary', '#0a0a0a');
    return (0.299*c.r + 0.587*c.g + 0.114*c.b) > 0.5;
  } catch(e){ return false; }
}
// İşaret malzemesi (tema uyumu). Takoz/bileşen/CG işaretleri UI'nin semantik
// accent renklerini (--accent-success/-warning/-danger) kullanır; bu renkler her
// temada zemine göre ayarlıdır → açık temada koyulaşıp beyaz zemine karşı okunur
// kalır (2D görünümün takoz rengiyle de aynı değişken). Emissive parıltı yalnızca
// koyu temada eklenir; açık temada kapanır ki işaretler solmadan doygun görünsün.
function _mntViewerMarkerMat(varName, fallback, shininess){
  var base = _mntViewerCssColor(varName, fallback);
  var emF = _mntViewerBgIsLight() ? 0 : 0.3;
  return new THREE.MeshPhongMaterial({
    color: base,
    emissive: base.clone().multiplyScalar(emF),
    shininess: shininess
  });
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

  // Izgara çizgileri: kenarlık rengi (tema) + soluk varyantı. Hem 3D görüntüleyici
  // (model modu) hem koordinat modu AÇILIŞTA zemini GİZLİ getirir (kullanıcı isteği:
  // eksenler "havada" + geri çekilmiş görünüm). "Zemin" düğmesiyle açılabilir.
  var _mode = mode||'model';
  var gc = _mntViewerCssColor('--border-color', '#333333');
  var grid = new THREE.GridHelper(3000, 30, gc, gc.clone().multiplyScalar(0.55));
  grid.position.y = -200; grid.visible = false; scene.add(grid);

  var group = new THREE.Group(); scene.add(group);   // yeniden kurulan içerik

  _veMountViewer = {
    scene:scene, camera:camera, renderer:renderer, canvas:canvas, group:group,
    grid:grid, mode:_mode,
    axes:[], labelSprites:[], planes:[],
    massScale:{min:0,max:1},
    ctrl:{ theta:-Math.PI*0.75, phi:Math.PI/3, radius:2800, target:new THREE.Vector3(0,0,0) },
    raf:null, disposed:false, ro:null, detach:[],
    raycaster:new THREE.Raycaster(), mouse:new THREE.Vector2(), tooltip:null, dragging:false
  };

  // Önceki oturumun kamera açısı varsa geri yükle (bkz. _veMountViewerCam).
  // _framed=true → veMountViewerUpdate içerik gelince kamerayı yeniden
  // çerçevelemeye kalkmaz, kullanıcının bıraktığı açı korunur.
  var _memo = _veMountViewerCam[_mode];
  if(_memo){
    var _c = _veMountViewer.ctrl;
    _c.theta=_memo.theta; _c.phi=_memo.phi; _c.radius=_memo.radius;
    _c.target.set(_memo.tx, _memo.ty, _memo.tz);
    _veMountViewer._framed = true;
  }

  // Sabit eksen üçlüsü (model modu). Koordinat modu ekseni kendi çizer.
  if(_veMountViewer.mode !== 'coordframe') _mntViewerAxes(scene);
  _mntViewerUpdateCamera();
  _mntViewerAttachControls(canvas);
  _mntViewerAttachHover(canvas);

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

// Görünümü başlangıç açısına/uzaklığına sıfırla (ve içeriğe yeniden çerçevele).
function veMountViewerReset(){
  var V=_veMountViewer; if(!V) return;
  // Sıfırlama kamera hafızasını da siler — yoksa panel bir sonraki yeniden
  // çiziminde sıfırladığın açı yerine eski açıya dönerdi.
  try { delete _veMountViewerCam[V.mode]; } catch(e){}
  V.ctrl.theta=-Math.PI*0.75; V.ctrl.phi=Math.PI/3;
  V.ctrl.radius=(V.mode==='coordframe')?2600:2800;
  // Koordinat modu: dikey ekseni (+Z) çerçevelemek için hedefi biraz yukarı al.
  V.ctrl.target.set(0, (V.mode==='coordframe')?150:0, 0);
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
  function onDown(e){ dragging=true; btn=e.button; px=e.clientX; py=e.clientY; if(_veMountViewer) _veMountViewer.dragging=true; e.preventDefault(); }
  function onUp(){ dragging=false; if(_veMountViewer) _veMountViewer.dragging=false; }
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

// Fare ile bileşen/takoz üzerine gelince özelliklerini tooltip olarak göster
// (raycast). İşaretlerde userData.info (HTML) tutulur (bkz. veMountViewerUpdate).
function _mntViewerAttachHover(canvas){
  var V=_veMountViewer; if(!V) return;
  var tip=document.createElement('div');
  tip.style.cssText='position:fixed; z-index:100060; pointer-events:none; display:none; max-width:240px; '
    +'padding:7px 9px; font-size:var(--fs-tiny); line-height:1.5; background:var(--bg-secondary,#1a1a1a); '
    +'color:var(--text-primary,#eee); border:1px solid var(--border-color,#444); border-radius:6px; '
    +'box-shadow:0 6px 20px rgba(0,0,0,0.45);';
  document.body.appendChild(tip);
  V.tooltip=tip;
  function onHover(e){
    var W=_veMountViewer; if(!W || W.disposed || !W.tooltip) return;
    if(W.dragging){ W.tooltip.style.display='none'; return; }
    var rect=canvas.getBoundingClientRect();
    W.mouse.x = ((e.clientX-rect.left)/rect.width)*2-1;
    W.mouse.y = -((e.clientY-rect.top)/rect.height)*2+1;
    W.raycaster.setFromCamera(W.mouse, W.camera);
    var hits=W.raycaster.intersectObjects(W.group.children, false);
    var hit=null;
    for(var i=0;i<hits.length;i++){ if(hits[i].object && hits[i].object.userData && hits[i].object.userData.info){ hit=hits[i].object; break; } }
    if(hit){
      W.tooltip.innerHTML=hit.userData.info;
      W.tooltip.style.display='block';
      var tx=e.clientX+14, ty=e.clientY+14;
      var tw=W.tooltip.offsetWidth, th=W.tooltip.offsetHeight;
      if(tx+tw>window.innerWidth-8) tx=e.clientX-tw-14;
      if(ty+th>window.innerHeight-8) ty=e.clientY-th-14;
      W.tooltip.style.left=tx+'px'; W.tooltip.style.top=ty+'px';
      canvas.style.cursor='pointer';
    } else {
      W.tooltip.style.display='none';
      canvas.style.cursor='';
    }
  }
  function onLeave(){ if(_veMountViewer && _veMountViewer.tooltip) _veMountViewer.tooltip.style.display='none'; }
  canvas.addEventListener('mousemove', onHover);
  canvas.addEventListener('mouseleave', onLeave);
  V.detach.push(function(){
    canvas.removeEventListener('mousemove', onHover);
    canvas.removeEventListener('mouseleave', onLeave);
  });
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

// Hover tooltip için basit kaçış + sayısal biçim.
function _mntViewerEsc(s){ return String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function _mntViewerN(v,d){ var n=Number(String(v).replace(',','.')); return Number.isFinite(n)?n.toFixed(d===undefined?1:d):'—'; }

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
    // Geri çekilmiş + dikey ekseni çerçeveleyen başlangıç görünümü (hedef biraz yukarı).
    if(!V._framed){ V.ctrl.target.set(0,150,0); V.ctrl.radius=2600; _mntViewerUpdateCamera(); V._framed=true; }
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

  // CG→takoz kılavuz çizgisi: temaya göre soluk gri (açık temada koyulaşır).
  var lineCol = _mntViewerCssColor('--text-muted', '#888888');

  // Takoz küpleri + bağlantı çizgileri
  d.mounts.forEach(function(mt){
    var x=num(mt.x), y=num(mt.y), z=num(mt.z);
    if(!(Number.isFinite(x)&&Number.isFinite(y)&&Number.isFinite(z))) return;
    var box=new THREE.Mesh(new THREE.BoxGeometry(60,40,60),
      _mntViewerMarkerMat('--accent-success', '#22c55e', 30));
    box.position.copy(_mntW(x,y,z));
    var kInfo='';
    if(mt.kxs!==undefined||mt.kzs!==undefined) kInfo='<br><span style="color:var(--text-muted,#888);">Statik k (N/mm):</span> '+_mntViewerN(mt.kxs,0)+' · '+_mntViewerN(mt.kys,0)+' · '+_mntViewerN(mt.kzs,0);
    box.userData={ info:'<b style="color:var(--accent-success,#22c55e);">'+_mntViewerEsc(mt.name||'Takoz')+'</b>'
      +'<br><span style="color:var(--text-muted,#888);">Konum (mm):</span> '+x.toFixed(1)+' · '+y.toFixed(1)+' · '+z.toFixed(1)+kInfo };
    V.group.add(box);
    if(hasCG){
      var g=new THREE.BufferGeometry().setFromPoints([_mntW(cg[0],cg[1],cg[2]), _mntW(x,y,z)]);
      var ln=new THREE.Line(g, new THREE.LineDashedMaterial({color:lineCol, dashSize:30, gapSize:15, transparent:true, opacity:0.6}));
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
      _mntViewerMarkerMat('--accent-warning', '#f59e0b', 20));
    s.position.copy(_mntW(x,y,z));
    s.userData={ info:'<b style="color:var(--accent-warning,#f59e0b);">'+_mntViewerEsc(c.name||'Bileşen')+'</b>'
      +'<br><span style="color:var(--text-muted,#888);">Kütle:</span> '+(m>0?m.toFixed(1)+' kg':'—')
      +'<br><span style="color:var(--text-muted,#888);">CG (mm):</span> '+x.toFixed(1)+' · '+y.toFixed(1)+' · '+z.toFixed(1) };
    V.group.add(s);
  });

  // Birleşik CG (kırmızı)
  if(hasCG){
    var cgm=new THREE.Mesh(new THREE.SphereGeometry(40,32,32),
      _mntViewerMarkerMat('--accent-danger', '#ef4444', 80));
    cgm.position.copy(_mntW(cg[0],cg[1],cg[2]));
    cgm.userData={ info:'<b style="color:var(--accent-danger,#ef4444);">Birleşik Ağırlık Merkezi</b>'
      +'<br><span style="color:var(--text-muted,#888);">Toplam kütle:</span> '+mSum.toFixed(1)+' kg'
      +'<br><span style="color:var(--text-muted,#888);">CG (mm):</span> '+cg[0].toFixed(1)+' · '+cg[1].toFixed(1)+' · '+cg[2].toFixed(1) };
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
  if(V.tooltip){ try{ V.tooltip.remove(); }catch(e){} V.tooltip=null; }
  try {
    // Sahnenin TAMAMINI boşalt: group içeriği + doğrudan sahneye eklenen
    // eksen çizgileri/etiket sprite'ları (bunlar eskiden sızıyordu).
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
