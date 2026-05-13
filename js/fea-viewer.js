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

  // Grid (XZ düzlemi) — koyu/açık gri tonlar
  var grid = new THREE.GridHelper(100, 20, 0x666666, 0x333333);
  scene.add(grid);

  // Eksen oklari (X kırmızı, Y yeşil, Z mavi)
  var axes = new THREE.AxesHelper(35);
  scene.add(axes);

  // Işıklar
  scene.add(new THREE.AmbientLight(0xffffff, 0.55));
  var dir = new THREE.DirectionalLight(0xffffff, 0.85);
  dir.position.set(80, 120, 60);
  scene.add(dir);

  // Sahneye orbit hedefi
  var target = new THREE.Vector3(0, 0, 0);
  camera.lookAt(target);

  // Render fonksiyonu — gerektiğinde çağrılır (on-demand)
  function render() {
    renderer.render(scene, camera);
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
    dispose: function() {
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
function veFEAAttachOrbitControls(canvas, camera, target, requestRender) {
  if(!veFEAHasThree()) return { dispose: function() {} };

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
    spherical.radius = Math.max(5, Math.min(2000, spherical.radius * factor));
    updateCamera();
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
  if(viewer) veFEAViewerRegistry[nodeId] = viewer;
}

// ─── Tam ekran modal ────────────────────────────────────────────────────────
function veFEAOpenFullscreenViewer(nodeId) {
  // Mevcut modal varsa kapat
  veFEACloseFullscreenViewer();

  var overlay = document.createElement('div');
  overlay.id = 've-fea-fullscreen-overlay';
  overlay.style.cssText = 'position:fixed; top:0; left:0; right:0; bottom:0; background:rgba(0,0,0,0.85); z-index:10010; display:flex; flex-direction:column;';

  // Üst toolbar
  var toolbar = document.createElement('div');
  toolbar.style.cssText = 'display:flex; align-items:center; justify-content:space-between; padding:10px 16px; background:var(--bg-secondary, #2a2a2a); border-bottom:1px solid var(--border-color, #444);';
  toolbar.innerHTML =
    '<div style="display:flex; align-items:center; gap:12px;">' +
      '<span style="font-size:0.85rem; font-weight:600; color:var(--text-heading, #fff);">Yapısal Analiz — 3D Görüntüleyici</span>' +
      '<span style="font-size:0.6rem; color:var(--text-muted, #888);">Sol drag: orbit · Sağ drag: pan · Wheel: zoom</span>' +
    '</div>' +
    '<button id="ve-fea-fullscreen-close" style="background:var(--accent-danger, #ef4444); color:#fff; border:none; padding:6px 14px; font-size:0.7rem; cursor:pointer;">✕ Kapat (Esc)</button>';

  // Canvas konteyneri
  var canvasWrap = document.createElement('div');
  canvasWrap.style.cssText = 'flex:1; position:relative; background:#1a1a1a;';
  var canvas = document.createElement('canvas');
  canvas.id = 've-fea-fullscreen-canvas';
  canvas.style.cssText = 'display:block; width:100%; height:100%;';
  canvasWrap.appendChild(canvas);

  overlay.appendChild(toolbar);
  overlay.appendChild(canvasWrap);
  document.body.appendChild(overlay);

  // Canvas gerçek piksel boyutuna ayarla
  canvas.width = canvasWrap.clientWidth;
  canvas.height = canvasWrap.clientHeight;

  var viewer = veFEAInitViewer(canvas, {
    width: canvas.width,
    height: canvas.height
  });

  // Resize handler
  function onResize() {
    if(!viewer) return;
    canvas.width = canvasWrap.clientWidth;
    canvas.height = canvasWrap.clientHeight;
    viewer.resize(canvas.width, canvas.height);
  }
  window.addEventListener('resize', onResize);

  // Esc tuşu ve kapat butonu
  function onKey(e) {
    if(e.key === 'Escape') veFEACloseFullscreenViewer();
  }
  document.addEventListener('keydown', onKey);

  document.getElementById('ve-fea-fullscreen-close').addEventListener('click', veFEACloseFullscreenViewer);

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
