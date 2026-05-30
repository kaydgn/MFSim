// ============================================================================
// FEA OCCT BREP — Gerçek B-Rep Topoloji Motoru (Full OpenCASCADE WASM)
// ============================================================================
// occt-import-js (hafif, sadece tessellation) yerine FULL opencascade.js
// kullanarak STEP geometrisinden KESİN topoloji çıkarır:
//   - Yüz/kenar/köşe entiteleri (TopExp_Explorer + HashCode dedup)
//   - Gerçek geometrik tip (BRepAdaptor): Plane/Cylinder/Cone/Sphere/Torus,
//     Line/Circle/Ellipse/BSpline — feature-recognition TAHMİNİ DEĞİL
//   - E→F adjacency (MapShapesAndAncestors) → manifold kontrolü
//   - Euler-Poincaré validity (V − E + F)
//
// Bu, "Topolojinin Doğru Kurulması" raporunun §7.1 TopoModel'ini gerçekler.
// Çıktı, mevcut veFEAComputeGeometryTopology formatıyla uyumludur (faces[],
// edges[], vertices[]) — UI/viewer/scanner değişmeden çalışır.
//
// Public API:
//   veFEAOcctLoad(opts)                       → Promise<oc>  (lazy, cache'li)
//   veFEAOcctShapeToTopology(oc, shape, opts) → TopoModel
//   veFEAOcctIsAvailable()                    → bool (modül yüklendi mi)
//
// Loader iki ortamı destekler:
//   Browser: opts.wasmJsUrl (+ otomatik .wasm yolu)
//   Node:    opts.distDir (vendor/opencascade-full veya node_modules/.../dist)
// ============================================================================

// GeomAbs tip kodları (OCCT standart enum değerleri) — .value ile eşleşir.
var VE_OCCT_SURF = {
  0: 'planar',      // GeomAbs_Plane
  1: 'cylindrical', // GeomAbs_Cylinder
  2: 'conical',     // GeomAbs_Cone
  3: 'spherical',   // GeomAbs_Sphere
  4: 'toroidal',    // GeomAbs_Torus
  5: 'bezier',      // GeomAbs_BezierSurface
  6: 'bspline',     // GeomAbs_BSplineSurface
  7: 'revolution',  // GeomAbs_SurfaceOfRevolution
  8: 'extrusion',   // GeomAbs_SurfaceOfExtrusion
  9: 'offset',      // GeomAbs_OffsetSurface
  10: 'freeform'    // GeomAbs_OtherSurface
};
var VE_OCCT_CURVE = {
  0: 'line',     // GeomAbs_Line
  1: 'circle',   // GeomAbs_Circle
  2: 'ellipse',  // GeomAbs_Ellipse
  3: 'hyperbola',// GeomAbs_Hyperbola
  4: 'parabola', // GeomAbs_Parabola
  5: 'bezier',   // GeomAbs_BezierCurve
  6: 'spline',   // GeomAbs_BSplineCurve
  7: 'offset',   // GeomAbs_OffsetCurve
  8: 'other'     // GeomAbs_OtherCurve
};

var _veFEAOcctInstance = null;     // yüklenmiş oc (cache)
var _veFEAOcctLoadPromise = null;  // devam eden yükleme

function veFEAOcctIsAvailable() { return !!_veFEAOcctInstance; }

// ─── Lazy loader ────────────────────────────────────────────────────────────
// Bir kez yükler, sonraki çağrılarda cache döner. Browser ve Node ortamlarını
// ayrı yollarla destekler.
function veFEAOcctLoad(opts) {
  opts = opts || {};
  if (_veFEAOcctInstance) return Promise.resolve(_veFEAOcctInstance);
  if (_veFEAOcctLoadPromise) return _veFEAOcctLoadPromise;

  _veFEAOcctLoadPromise = _veFEAOcctLoadImpl(opts).then(function(oc) {
    _veFEAOcctInstance = oc;
    _veFEAOcctLoadPromise = null;
    return oc;
  }).catch(function(err) {
    _veFEAOcctLoadPromise = null;
    throw err;
  });
  return _veFEAOcctLoadPromise;
}

function _veFEAOcctLoadImpl(opts) {
  // Node ortamı: fs ile glue oku, ESM→CJS çevir, compile et, wasmBinary ver.
  var isNode = (typeof process !== 'undefined' && process.versions && process.versions.node) &&
               (typeof opts.distDir === 'string');
  if (isNode) {
    return _veFEAOcctLoadNode(opts.distDir);
  }
  // Browser ortamı: dynamic import + locateFile.
  return _veFEAOcctLoadBrowser(opts);
}

function _veFEAOcctLoadNode(distDir) {
  return new Promise(function(resolve, reject) {
    try {
      var fs = require('fs');
      var path = require('path');
      var Mod = require('module');
      var gluePath = path.join(distDir, 'opencascade.wasm.js');
      var wasmPath = path.join(distDir, 'opencascade.wasm.wasm');
      var src = fs.readFileSync(gluePath, 'utf8')
        .replace(/export default opencascade;\s*$/, 'module.exports = opencascade;');
      var m = new Mod('occ-glue', module);
      m.filename = gluePath;
      m.paths = Mod._nodeModulePaths(distDir);
      m._compile(src, m.filename);
      var factory = m.exports;
      factory({ wasmBinary: fs.readFileSync(wasmPath) }).then(resolve).catch(reject);
    } catch (e) { reject(e); }
  });
}

function _veFEAOcctLoadBrowser(opts) {
  var wasmJsUrl = opts.wasmJsUrl || 'vendor/opencascade-full/opencascade.wasm.js';
  var wasmUrl = opts.wasmUrl || wasmJsUrl.replace(/\.js$/, '.wasm');
  // import() bare specifier'ı reddeder ('vendor/...' → hata). Relative/absolute
  // her path'i, sayfanın base URL'ine göre mutlak URL'e çevir.
  try {
    if (typeof document !== 'undefined' && typeof URL === 'function') {
      var base = document.baseURI || (typeof location !== 'undefined' ? location.href : undefined);
      wasmJsUrl = new URL(wasmJsUrl, base).href;
      wasmUrl = new URL(wasmUrl, base).href;
    }
  } catch (e) { /* URL çözülemezse orijinal path ile devam */ }
  // Dynamic import — ESM glue (export default factory). <script defer> içinden
  // çağrılsa bile import() her modern tarayıcıda çalışır.
  return import(/* webpackIgnore: true */ wasmJsUrl).then(function(mod) {
    var factory = mod && (mod.default || mod);
    if (typeof factory !== 'function') throw new Error('OCCT factory bulunamadı');
    return factory({
      locateFile: function(p) { return p.endsWith('.wasm') ? wasmUrl : p; }
    });
  });
}

// ─── Tessellation köprüsü (Faz 5, raporun §5.6) ────────────────────────────
// OCCT shape'i topology-aware tessellate eder (BRepMesh_IncrementalMesh) ve
// her yüzün üçgenlerini global pozisyona dönüştürerek face ID ile gruplar.
// 3D viewer'da STEP yüzleri TIKLANABİLİR hale gelir — Three.js BufferGeometry
// groups[] yapısı ile (her group materialIndex=face index).
//   opts: { deflection:number=0.5, angularDef:number=0.5 }
//   faceIdByHash: HashCode → 'faceN' map (caller'dan)
// Dönüş: { positions:Float32Array, indices:Uint32Array,
//          groups:[{start,count,faceId}], faceIdOrder:[faceId,...] }
function veFEAOcctTessellateShape(oc, shape, faceIdByHash, opts) {
  opts = opts || {};
  var defl = isFinite(opts.deflection) ? opts.deflection : 0.5;
  var aDefl = isFinite(opts.angularDef) ? opts.angularDef : 0.5;
  // Tessellate
  try { new oc.BRepMesh_IncrementalMesh_2(shape, defl, false, aDefl, false); }
  catch (e) { return null; }

  var positions = [];  // flat [x,y,z, ...]
  var indices = [];    // flat triangle indices
  var groups = [];
  var faceIdOrder = [];
  var nodeOffset = 0;  // global position dizinine ofset

  var TA = oc.TopAbs_ShapeEnum;
  var exp = new oc.TopExp_Explorer_2(shape, TA.TopAbs_FACE, TA.TopAbs_SHAPE);
  var seen = {};
  for (; exp.More(); exp.Next()) {
    var fShape = exp.Current();
    var h = fShape.HashCode(1e9);
    if (seen[h]) continue;
    seen[h] = true;
    var faceId = (faceIdByHash && faceIdByHash[h]) || ('face' + (faceIdOrder.length + 1));
    var face;
    try { face = oc.TopoDS.Face_1(fShape); } catch (e) { continue; }
    var loc = new oc.TopLoc_Location_1();
    var triHandle;
    try { triHandle = oc.BRep_Tool.Triangulation(face, loc); }
    catch (e) { continue; }
    if (!triHandle || triHandle.IsNull()) continue;
    var tri = triHandle.get();
    var nNodes = tri.NbNodes();
    var nTris = tri.NbTriangles();
    if (nNodes < 3 || nTris < 1) continue;

    // Yerel transformasyon (TopLoc_Location) — global pozisyon için uygulanmalı
    var trsf = loc.Transformation();
    var hasLoc = loc.IsIdentity ? !loc.IsIdentity() : true;

    // Yüz orientation REVERSED ise üçgen winding'i ters çevrilmeli
    var faceOri = (typeof face.Orientation_1 === 'function') ? face.Orientation_1() : null;
    var reversed = false;
    try { if (faceOri && faceOri.value === 1) reversed = true; }   // TopAbs_REVERSED = 1
    catch (e) { /* skip */ }

    var localStart = indices.length;

    // Node'ları positions'a ekle (1-tabanlı OCCT → 0-tabanlı buffer)
    for (var ni = 1; ni <= nNodes; ni++) {
      var p = tri.Node(ni);
      var x = p.X(), y = p.Y(), z = p.Z();
      if (hasLoc) {
        try {
          var pt = new oc.gp_Pnt_3(x, y, z);
          pt.Transform(trsf);
          positions.push(pt.X(), pt.Y(), pt.Z());
          pt.delete && pt.delete();
        } catch (e) { positions.push(x, y, z); }
      } else {
        positions.push(x, y, z);
      }
    }
    // Üçgenleri ekle (Triangle.Value(1/2/3) → 1-tabanlı node indeksleri)
    for (var ti = 1; ti <= nTris; ti++) {
      var t = tri.Triangle(ti);
      var a = t.Value(1) - 1 + nodeOffset;
      var b = t.Value(2) - 1 + nodeOffset;
      var c = t.Value(3) - 1 + nodeOffset;
      if (reversed) { indices.push(a, c, b); } else { indices.push(a, b, c); }
    }
    groups.push({ start: localStart, count: (indices.length - localStart), faceId: faceId });
    faceIdOrder.push(faceId);
    nodeOffset = positions.length / 3;
  }
  exp.delete();

  return {
    positions: new Float32Array(positions),
    indices: new Uint32Array(indices),
    groups: groups,
    faceIdOrder: faceIdOrder
  };
}

// ─── Shape Healing + Sewing + Validity Check (raporun §5.2-§5.3-§4.4) ──────
// Ham STEP shape'ini ANSYS pipeline'ı gibi temizler:
//   1. ShapeFix_Shape — tolerans uyuşmazlığı, eksik pcurve, küçük yüz onarımı
//   2. BRepBuilderAPI_Sewing — kopuk yüzleri shell'e dik (opsiyonel, IGES kritik)
//   3. BRepCheck_Analyzer — OCCT'nin kendi düzeyli validity check'i
// opts: { heal:bool=true, sew:bool=false, sewTolerance:0.01,
//         precision:0.001, minTol:1e-7, maxTol:1.0, validate:bool=true }
// Dönüş: { shape (healed), report:{healed,sewed,wasValid,nowValid,issues[]} }
function veFEAOcctHealShape(oc, shape, opts) {
  opts = opts || {};
  var doHeal = opts.heal !== false;
  var doSew = opts.sew === true;
  var doValidate = opts.validate !== false;
  var report = { healed: false, sewed: false, wasValid: null, nowValid: null, issues: [] };
  var cur = shape;

  // Önce validity (heal öncesi). IsValid_1(shape) — alt-shape parametresi alır;
  // boş = tüm shape.
  if (doValidate) {
    try {
      var preCheck = new oc.BRepCheck_Analyzer(cur, true);
      report.wasValid = preCheck.IsValid_1(cur);
      preCheck.delete && preCheck.delete();
    } catch (e) { report.issues.push('PreCheck: ' + (e.message || e)); }
  }

  // ShapeFix_Shape: tolerans + eksik pcurve + küçük yüz onarımı.
  // OCCT v1.1.1 Perform() boş ProgressIndicator handle ister.
  if (doHeal) {
    try {
      var fix = new oc.ShapeFix_Shape_1();
      fix.Init(cur);
      if (isFinite(opts.precision)) fix.SetPrecision(opts.precision);
      if (isFinite(opts.minTol))    fix.SetMinTolerance(opts.minTol);
      if (isFinite(opts.maxTol))    fix.SetMaxTolerance(opts.maxTol);
      var emptyProg = new oc.Handle_Message_ProgressIndicator_1();
      fix.Perform(emptyProg);
      emptyProg.delete && emptyProg.delete();
      var healed = fix.Shape();
      if (healed && (!healed.IsNull || !healed.IsNull())) {
        cur = healed;
        report.healed = true;
      }
      fix.delete && fix.delete();
    } catch (e) { report.issues.push('ShapeFix: ' + (e.message || e)); }
  }

  // Sewing: kopuk yüzleri birleştir (default OFF — STEP'te shell zaten kapalı,
  // IGES'te zorunlu). Constructor: (tol, option=true, cutting=true,
  // nonmanifold=false, ...) — opencascade.js v1.1.1 değişken imza.
  if (doSew) {
    try {
      var tol = isFinite(opts.sewTolerance) ? opts.sewTolerance : 0.01;
      var sew;
      try { sew = new oc.BRepBuilderAPI_Sewing(tol, true, true, true, false); }
      catch (e3) { try { sew = new oc.BRepBuilderAPI_Sewing(tol); } catch (e4) { sew = new oc.BRepBuilderAPI_Sewing(); } }
      sew.Add(cur);
      var pSew = new oc.Handle_Message_ProgressIndicator_1();
      try { sew.Perform(pSew); } catch (eP) { sew.Perform(); }  // bazı build'ler argümansız
      pSew.delete && pSew.delete();
      var sewed = sew.SewedShape();
      if (sewed && (!sewed.IsNull || !sewed.IsNull())) {
        cur = sewed;
        report.sewed = true;
      }
      sew.delete && sew.delete();
    } catch (e) { report.issues.push('Sewing: ' + (e.message || e)); }
  }

  // Healing sonrası validity (BRepCheck.IsValid_1(shape))
  if (doValidate) {
    try {
      var postCheck = new oc.BRepCheck_Analyzer(cur, true);
      report.nowValid = postCheck.IsValid_1(cur);
      postCheck.delete && postCheck.delete();
    } catch (e) { report.issues.push('PostCheck: ' + (e.message || e)); }
  }

  return { shape: cur, report: report };
}

// ─── STEP okuma: ArrayBuffer → TopoDS_Shape ─────────────────────────────────
// STEP dosyasını OCCT'nin Emscripten sanal FS'ine yazıp STEPControl_Reader ile
// okur, tüm root'ları transfer edip tek shape döndürür. occt-import-js'ten
// (tessellation) farklı olarak GERÇEK B-Rep TopoDS_Shape verir.
//   oc: yüklenmiş instance, buffer: ArrayBuffer|Uint8Array, fileName: opsiyonel
// Dönüş: { shape, ok, message }
function veFEAOcctReadStepBuffer(oc, buffer, fileName) {
  var name = fileName || 'import.step';
  var data = (buffer instanceof Uint8Array) ? buffer : new Uint8Array(buffer);
  var wrote = false;
  try {
    // Sanal FS'e yaz (kök dizinde)
    oc.FS.createDataFile('/', name, data, true, true, true);
    wrote = true;
    var reader = new oc.STEPControl_Reader_1();
    var status = reader.ReadFile(name);
    // IFSelect_ReturnStatus.IFSelect_RetDone = 1 → başarılı
    var sval = (status && typeof status === 'object' && 'value' in status) ? status.value : status;
    if (sval !== 1 && sval !== 0) {
      _veFEAOcctFsUnlink(oc, name);
      return { shape: null, ok: false, message: 'STEP okunamadı (status ' + sval + ')' };
    }
    // Root'ları transfer et. opencascade.js v1.1.1'de TransferRoots()
    // parametresizdir (ProgressRange OCCT 7.5+ ile geldi, bu build'de yok).
    try {
      reader.TransferRoots();
    } catch (e) {
      // Yeni sürüm imzası (ProgressRange) → fallback
      try {
        var pr = new oc.Message_ProgressRange_1();
        reader.TransferRoots(pr);
        pr.delete && pr.delete();
      } catch (e2) { /* transfer edilemedi, OneShape yine denenecek */ }
    }
    var shape = reader.OneShape();
    _veFEAOcctFsUnlink(oc, name);
    if (!shape || (shape.IsNull && shape.IsNull())) {
      return { shape: null, ok: false, message: 'STEP boş shape döndürdü' };
    }
    return { shape: shape, ok: true, message: 'ok' };
  } catch (e) {
    if (wrote) _veFEAOcctFsUnlink(oc, name);
    return { shape: null, ok: false, message: (e && e.message) || String(e) };
  }
}

function _veFEAOcctFsUnlink(oc, name) {
  try { oc.FS.unlink('/' + name); } catch (e) { try { oc.FS.unlink(name); } catch (e2) {} }
}

// Yüksek seviye: ArrayBuffer → topology (lazy-load + read + extract).
// Browser'da fea-step.js'in çağıracağı tek fonksiyon.
//   buffer: STEP ArrayBuffer, opts: { wasmJsUrl, fileName, sampleEdges, distDir }
// Dönüş: Promise<topology|null>
function veFEAOcctTopologyFromStepBuffer(buffer, opts) {
  opts = opts || {};
  return veFEAOcctLoad(opts).then(function(oc) {
    var r = veFEAOcctReadStepBuffer(oc, buffer, opts.fileName);
    if (!r.ok || !r.shape) {
      console.warn('[FEA OCCT] STEP read başarısız:', r.message);
      return null;
    }
    // Heal + (opsiyonel) sew + validity check — kötü STEP'leri sessizce kabul etme.
    // opts.heal=false ile devre dışı; opts.sew=true ile aktif (default OFF).
    var healed = veFEAOcctHealShape(oc, r.shape, opts);
    var topo = veFEAOcctShapeToTopology(oc, healed.shape, opts);
    if (topo) {
      // Healing raporunu topology.validity'ye iliştir (UI gösterecek)
      topo.validity = topo.validity || {};
      topo.validity.healed = healed.report.healed;
      topo.validity.sewed = healed.report.sewed;
      topo.validity.wasValid = healed.report.wasValid;
      topo.validity.brepCheckValid = healed.report.nowValid;
      if (healed.report.issues.length) {
        topo.validity.issues = (topo.validity.issues || []).concat(healed.report.issues);
      }
      // Faz 5 — Tessellation köprüsü: viewer'a 3D BREP yüz seçimi sağla
      if (opts.tessellate !== false) {
        try {
          var faceIdByHash = {};
          // ShapeToTopology'de oluşturulan ID'leri yeniden çıkarmak yerine
          // healed shape üzerinden HashCode → 'faceN' eşlemesini kur (sıra aynı).
          var fExp = new oc.TopExp_Explorer_2(healed.shape, oc.TopAbs_ShapeEnum.TopAbs_FACE, oc.TopAbs_ShapeEnum.TopAbs_SHAPE);
          var fi = 0, seenF = {};
          for (; fExp.More(); fExp.Next()) {
            var h = fExp.Current().HashCode(1e9);
            if (seenF[h]) continue;
            seenF[h] = true;
            fi++;
            faceIdByHash[h] = 'face' + fi;
          }
          fExp.delete();
          topo.tessellation = veFEAOcctTessellateShape(oc, healed.shape, faceIdByHash, opts);
        } catch (e) { /* tessellation başarısız → viewer sadece BREP listesi gösterir */ }
      }
    }
    return topo;
  });
}

// ─── Topoloji çıkarımı: TopoDS_Shape → TopoModel ────────────────────────────
// oc: yüklenmiş opencascade instance, shape: TopoDS_Shape
// opts: { sampleEdges:bool (polyline üret, default true), maxEdgePts:int }
// Dönen format mevcut topology ile uyumlu: { type, faces[], edges[], vertices[],
//   totalSurfaceArea, volume, bbox, validity, generic:false, brep:true }
function veFEAOcctShapeToTopology(oc, shape, opts) {
  opts = opts || {};
  if (!oc || !shape) return null;
  var TA = oc.TopAbs_ShapeEnum;

  // 1) Entiteleri HashCode ile dedup ederek topla → stabil index/ID
  // Raporun §1.1 tam hiyerarşisi: SOLID → SHELL → FACE → WIRE → EDGE → VERTEX
  var solidList = _veFEAOcctCollect(oc, shape, TA.TopAbs_SOLID);
  var shellList = _veFEAOcctCollect(oc, shape, TA.TopAbs_SHELL);
  var faceList = _veFEAOcctCollect(oc, shape, TA.TopAbs_FACE);
  var wireList = _veFEAOcctCollect(oc, shape, TA.TopAbs_WIRE);
  var edgeList = _veFEAOcctCollect(oc, shape, TA.TopAbs_EDGE);
  var vertList = _veFEAOcctCollect(oc, shape, TA.TopAbs_VERTEX);

  // HashCode → ID haritaları (adjacency için)
  var solidIdByHash = {};
  solidList.forEach(function(it, i) { it.id = 'solid' + (i + 1); solidIdByHash[it.hash] = it.id; });
  var shellIdByHash = {};
  shellList.forEach(function(it, i) { it.id = 'shell' + (i + 1); shellIdByHash[it.hash] = it.id; });
  var faceIdByHash = {};
  faceList.forEach(function(it, i) { it.id = 'face' + (i + 1); faceIdByHash[it.hash] = it.id; });
  var wireIdByHash = {};
  wireList.forEach(function(it, i) { it.id = 'wire' + (i + 1); wireIdByHash[it.hash] = it.id; });
  var vertIdByHash = {};
  vertList.forEach(function(it, i) { it.id = 'v' + (i + 1); vertIdByHash[it.hash] = it.id; });
  edgeList.forEach(function(it, i) { it.id = 'edge' + (i + 1); });

  // 2) E→F adjacency: her kenarın komşu yüzleri (manifold kontrolü)
  var edgeFaceMap = _veFEAOcctEdgeFaceMap(oc, shape, faceIdByHash);

  // 3) Yüzleri işle (tip + alan + centroid + normal + outer/inner wire)
  var faces = [];
  var totalArea = 0;
  faceList.forEach(function(it) {
    var f = _veFEAOcctFaceInfo(oc, it.shape, it.id);
    if (f.area) totalArea += f.area;
    // Outer/inner wire ID'leri — raporun §3 "outer dolaşımı CCW, inner CW"
    var wireBindings = _veFEAOcctFaceWires(oc, it.shape, wireIdByHash);
    f.outerWireId = wireBindings.outer;
    f.innerWireIds = wireBindings.inner;
    faces.push(f);
  });

  // 3b) Wire entitelerini işle (edge listesi + parent face)
  var edgeIdByHash = {};
  edgeList.forEach(function(it) { edgeIdByHash[it.hash] = it.id; });
  var wires = [];
  wireList.forEach(function(it) {
    var w = _veFEAOcctWireInfo(oc, it.shape, it.id, edgeIdByHash);
    wires.push(w);
  });
  // Wire ↔ Face backward bind (face.outerWireId / innerWireIds'den)
  var wireMap = {}; wires.forEach(function(w) { wireMap[w.id] = w; w.faceIds = []; w.isOuter = false; });
  faces.forEach(function(f) {
    if (f.outerWireId && wireMap[f.outerWireId]) {
      wireMap[f.outerWireId].faceIds.push(f.id);
      wireMap[f.outerWireId].isOuter = true;
    }
    (f.innerWireIds || []).forEach(function(wid) {
      if (wireMap[wid]) wireMap[wid].faceIds.push(f.id);
    });
  });

  // 3c) Shell entitelerini işle (içerdiği face ID'leri)
  var shells = [];
  shellList.forEach(function(it) {
    shells.push({ id: it.id, label: it.id, faceIds: _veFEAOcctShellFaceIds(oc, it.shape, faceIdByHash) });
  });
  // 3d) Solid entitelerini işle (içerdiği shell ID'leri)
  var solids = [];
  solidList.forEach(function(it) {
    solids.push({ id: it.id, label: it.id, shellIds: _veFEAOcctSolidShellIds(oc, it.shape, shellIdByHash) });
  });

  // 4) Kenarları işle (tip + geometri + polyline + endpoint vertex'leri + faceIds)
  var edges = [];
  edgeList.forEach(function(it) {
    var e = _veFEAOcctEdgeInfo(oc, it.shape, it.id, opts);
    e.faceIds = edgeFaceMap[it.hash] || [];
    // Endpoint vertex ID'leri
    e.vertexIds = _veFEAOcctEdgeVertexIds(oc, it.shape, vertIdByHash);
    edges.push(e);
  });

  // 5) Köşeleri işle (pozisyon)
  var vertices = [];
  vertList.forEach(function(it) {
    var v = _veFEAOcctVertexInfo(oc, it.shape, it.id);
    vertices.push(v);
  });

  // 6) face.edgeIds / face.vertexIds + vertex.edgeIds/faceIds (backward bind)
  _veFEAOcctBindRelations(faces, edges, vertices);

  // 7) Hacim + bbox
  var volume = _veFEAOcctVolume(oc, shape);
  var bbox = _veFEAOcctBBox(oc, shape);

  // 8) Validity: Euler-Poincaré + manifold + watertight + entite sayıları
  var validity = _veFEAOcctValidity(faces, edges, vertices, edgeFaceMap, shells, solids, wires);

  return {
    type: 'step',
    solids: solids,    // Faz 4 — raporun §7.1 TopoModel solid hiyerarşisi
    shells: shells,    // Faz 4
    wires: wires,      // Faz 4 — outer/inner wire ayrımı + face ↔ wire
    faces: faces,
    edges: edges,
    vertices: vertices,
    totalSurfaceArea: totalArea,
    volume: volume,
    bbox: bbox,
    validity: validity,
    brep: true   // gerçek BREP topolojisi (feature-recognition değil)
  };
}

// HashCode ile unique entite toplama. Dönen: [{shape, hash}, ...]
function _veFEAOcctCollect(oc, shape, typeEnum) {
  var out = [];
  var seen = {};
  var exp = new oc.TopExp_Explorer_2(shape, typeEnum, oc.TopAbs_ShapeEnum.TopAbs_SHAPE);
  for (; exp.More(); exp.Next()) {
    var cur = exp.Current();
    var h = cur.HashCode(1e9);
    if (seen[h]) continue;
    seen[h] = true;
    // Shape kopyasını sakla (explorer ilerledikçe Current değişir)
    out.push({ shape: _veFEAOcctCopyShape(oc, cur), hash: h });
  }
  exp.delete();
  return out;
}

// Shape referansını güvenli sakla — TopExp_Explorer.Current() referans döndürür,
// Next()'te değişebilir. Yeni TopoDS_Shape ile referansı sabitle.
function _veFEAOcctCopyShape(oc, shape) {
  // shape.Located/Oriented yerine basitçe referansı klonla — OCCT shape'ler
  // hafif handle'lardır. embind çoğu durumda Current()'i kalıcı verir; yine de
  // explorer'ı yeniden kullanmadığımız için doğrudan saklamak güvenli.
  return shape;
}

// E→F adjacency: kenar HashCode → [faceId, ...]. Yüzleri gezip her yüzün
// kenarlarını işaretler (MapShapesAndAncestors embind'de yoksa bu yöntem çalışır).
function _veFEAOcctEdgeFaceMap(oc, shape, faceIdByHash) {
  var map = {};
  var TA = oc.TopAbs_ShapeEnum;
  var fExp = new oc.TopExp_Explorer_2(shape, TA.TopAbs_FACE, TA.TopAbs_SHAPE);
  var seenFace = {};
  for (; fExp.More(); fExp.Next()) {
    var face = fExp.Current();
    var fh = face.HashCode(1e9);
    if (seenFace[fh]) continue;
    seenFace[fh] = true;
    var fid = faceIdByHash[fh];
    if (!fid) continue;
    var eExp = new oc.TopExp_Explorer_2(face, TA.TopAbs_EDGE, TA.TopAbs_SHAPE);
    var seenEdgeInFace = {};
    for (; eExp.More(); eExp.Next()) {
      var eh = eExp.Current().HashCode(1e9);
      if (seenEdgeInFace[eh]) continue;
      seenEdgeInFace[eh] = true;
      if (!map[eh]) map[eh] = [];
      if (map[eh].indexOf(fid) < 0) map[eh].push(fid);
    }
    eExp.delete();
  }
  fExp.delete();
  return map;
}

// Yüz bilgisi: tip + alan + centroid + (planar ise) normal + (cylinder/sphere
// ise) radius/axis.
function _veFEAOcctFaceInfo(oc, faceShape, id) {
  var info = { id: id, label: id, type: 'freeform', edgeIds: [], vertexIds: [] };
  try {
    var face = oc.TopoDS.Face_1(faceShape);
    var surf = new oc.BRepAdaptor_Surface_2(face, true);
    var stype = surf.GetType();
    var tval = (typeof stype === 'object' && 'value' in stype) ? stype.value : stype;
    info.type = VE_OCCT_SURF[tval] || 'freeform';
    info.label = _veFEAOcctSurfLabel(info.type);
    // Tipe özel parametreler
    try {
      if (info.type === 'cylindrical') {
        var cyl = surf.Cylinder();
        info.radius = cyl.Radius();
        var ax = cyl.Axis(); var d = ax.Direction();
        info.axis = [d.X(), d.Y(), d.Z()];
      } else if (info.type === 'spherical') {
        var sph = surf.Sphere();
        info.radius = sph.Radius();
      } else if (info.type === 'conical') {
        var con = surf.Cone();
        info.radius = con.RefRadius();
      } else if (info.type === 'toroidal') {
        var tor = surf.Torus();
        info.majorRadius = tor.MajorRadius();
        info.minorRadius = tor.MinorRadius();
      } else if (info.type === 'planar') {
        var pl = surf.Plane(); var n = pl.Axis().Direction();
        info.normal = [n.X(), n.Y(), n.Z()];
      }
    } catch (e2) { /* tip parametresi alınamadı */ }
    surf.delete();
  } catch (e) { /* yüz adapt edilemedi */ }
  // Alan + centroid (GProp)
  try {
    var props = new oc.GProp_GProps_1();
    oc.BRepGProp.SurfaceProperties_1(faceShape, props, false, false);
    info.area = props.Mass();
    var cm = props.CentreOfMass();
    info.centroid = [cm.X(), cm.Y(), cm.Z()];
    props.delete();
  } catch (e3) { info.area = 0; }
  return info;
}

// Kenar bilgisi: tip + geometri + uzunluk + polyline (viewer için).
function _veFEAOcctEdgeInfo(oc, edgeShape, id, opts) {
  var info = { id: id, label: id, type: 'spline', faceIds: [], vertexIds: [] };
  try {
    var edge = oc.TopoDS.Edge_1(edgeShape);
    var crv = new oc.BRepAdaptor_Curve_2(edge);
    var ctype = crv.GetType();
    var tval = (typeof ctype === 'object' && 'value' in ctype) ? ctype.value : ctype;
    info.type = VE_OCCT_CURVE[tval] || 'spline';
    info.label = _veFEAOcctCurveLabel(info.type);
    try {
      if (info.type === 'circle') {
        var c = crv.Circle(); info.radius = c.Radius();
        var loc = c.Location(); info.center = [loc.X(), loc.Y(), loc.Z()];
        var cax = c.Axis().Direction(); info.axis = [cax.X(), cax.Y(), cax.Z()];
      } else if (info.type === 'ellipse') {
        var el = crv.Ellipse();
        info.majorRadius = el.MajorRadius(); info.minorRadius = el.MinorRadius();
        var elc = el.Location(); info.center = [elc.X(), elc.Y(), elc.Z()];
      }
    } catch (e2) { /* skip */ }
    // Uzunluk (GProp)
    try {
      var props = new oc.GProp_GProps_1();
      oc.BRepGProp.LinearProperties_1(edgeShape, props, false, false);
      info.length = props.Mass();
      props.delete();
    } catch (e3) { /* skip */ }
    // Polyline örnekleme (viewer highlight için)
    if (opts.sampleEdges !== false) {
      info.polyline = _veFEAOcctSampleEdge(oc, crv, opts.maxEdgePts || 48);
      // circle ise full/arc tespiti
      if ((info.type === 'circle') && info.polyline && info.polyline.length > 2) {
        var p0 = info.polyline[0], pN = info.polyline[info.polyline.length - 1];
        var dd = Math.sqrt(Math.pow(p0[0]-pN[0],2) + Math.pow(p0[1]-pN[1],2) + Math.pow(p0[2]-pN[2],2));
        info.isFullCircle = dd < (info.radius || 1) * 0.05;
        if (!info.isFullCircle) { info.type = 'arc'; info.label = _veFEAOcctCurveLabel('arc'); }
      }
    }
    crv.delete();
  } catch (e) { /* edge adapt edilemedi */ }
  return info;
}

// Kenarı parametrik olarak örnekle → polyline [[x,y,z], ...]
function _veFEAOcctSampleEdge(oc, crv, maxPts) {
  var pts = [];
  try {
    var t0 = crv.FirstParameter();
    var t1 = crv.LastParameter();
    if (!isFinite(t0) || !isFinite(t1) || t1 <= t0) return pts;
    var n = Math.max(2, maxPts | 0);
    for (var i = 0; i <= n; i++) {
      var t = t0 + (t1 - t0) * (i / n);
      var p = crv.Value(t);
      pts.push([p.X(), p.Y(), p.Z()]);
    }
  } catch (e) { /* skip */ }
  return pts;
}

// Kenarın endpoint vertex ID'leri (TopExp ile)
function _veFEAOcctEdgeVertexIds(oc, edgeShape, vertIdByHash) {
  var ids = [];
  try {
    var TA = oc.TopAbs_ShapeEnum;
    var exp = new oc.TopExp_Explorer_2(edgeShape, TA.TopAbs_VERTEX, TA.TopAbs_SHAPE);
    var seen = {};
    for (; exp.More(); exp.Next()) {
      var h = exp.Current().HashCode(1e9);
      if (seen[h]) continue; seen[h] = true;
      var vid = vertIdByHash[h];
      if (vid && ids.indexOf(vid) < 0) ids.push(vid);
    }
    exp.delete();
  } catch (e) { /* skip */ }
  return ids;
}

// Köşe bilgisi: 3D pozisyon (BRep_Tool.Pnt)
function _veFEAOcctVertexInfo(oc, vertShape, id) {
  var info = { id: id, label: id, position: [0, 0, 0], edgeIds: [], faceIds: [] };
  try {
    var vtx = oc.TopoDS.Vertex_1(vertShape);
    var p = oc.BRep_Tool.Pnt(vtx);
    info.position = [p.X(), p.Y(), p.Z()];
  } catch (e) { /* skip */ }
  return info;
}

// ─── Wire / Shell / Solid yardımcıları (Faz 4) ──────────────────────────────
// Bir yüzün outer wire'ı (BRepTools.OuterWire) + inner wires (delik loop'ları).
// Raporun §3 outer/inner ayrımı — "deliği tek tıkla seç" UX'inin temeli.
function _veFEAOcctFaceWires(oc, faceShape, wireIdByHash) {
  var result = { outer: null, inner: [] };
  try {
    var face = oc.TopoDS.Face_1(faceShape);
    var outerWire = oc.BRepTools.OuterWire(face);
    var outerHash = null;
    if (outerWire && !outerWire.IsNull()) {
      outerHash = outerWire.HashCode(1e9);
      result.outer = wireIdByHash[outerHash] || null;
    }
    // Yüzün tüm wire'larını gez; outer olmayanlar inner (delik loop'ları)
    var exp = new oc.TopExp_Explorer_2(faceShape, oc.TopAbs_ShapeEnum.TopAbs_WIRE, oc.TopAbs_ShapeEnum.TopAbs_SHAPE);
    var seen = {};
    for (; exp.More(); exp.Next()) {
      var wh = exp.Current().HashCode(1e9);
      if (seen[wh]) continue;
      seen[wh] = true;
      if (wh === outerHash) continue;
      var wid = wireIdByHash[wh];
      if (wid && result.inner.indexOf(wid) < 0) result.inner.push(wid);
    }
    exp.delete();
  } catch (e) { /* sessiz — face wire mapping başarısız */ }
  return result;
}

// Wire entitesi: içerdiği kenarlar + uzunluk (loop perimeter).
function _veFEAOcctWireInfo(oc, wireShape, id, edgeIdByHash) {
  var info = { id: id, label: id, edgeIds: [], faceIds: [], isOuter: false, length: 0 };
  try {
    var exp = new oc.TopExp_Explorer_2(wireShape, oc.TopAbs_ShapeEnum.TopAbs_EDGE, oc.TopAbs_ShapeEnum.TopAbs_SHAPE);
    var seen = {};
    for (; exp.More(); exp.Next()) {
      var eh = exp.Current().HashCode(1e9);
      if (seen[eh]) continue;
      seen[eh] = true;
      var eid = edgeIdByHash && edgeIdByHash[eh];
      if (eid && info.edgeIds.indexOf(eid) < 0) info.edgeIds.push(eid);
    }
    exp.delete();
    // Wire uzunluğu (perimeter)
    try {
      var props = new oc.GProp_GProps_1();
      oc.BRepGProp.LinearProperties_1(wireShape, props, false, false);
      info.length = props.Mass();
      props.delete();
    } catch (e2) { /* skip */ }
  } catch (e) { /* skip */ }
  return info;
}

// Shell içindeki face ID'leri çıkar.
function _veFEAOcctShellFaceIds(oc, shellShape, faceIdByHash) {
  var ids = [];
  try {
    var exp = new oc.TopExp_Explorer_2(shellShape, oc.TopAbs_ShapeEnum.TopAbs_FACE, oc.TopAbs_ShapeEnum.TopAbs_SHAPE);
    var seen = {};
    for (; exp.More(); exp.Next()) {
      var h = exp.Current().HashCode(1e9);
      if (seen[h]) continue;
      seen[h] = true;
      var fid = faceIdByHash[h];
      if (fid && ids.indexOf(fid) < 0) ids.push(fid);
    }
    exp.delete();
  } catch (e) { /* skip */ }
  return ids;
}

// Solid içindeki shell ID'leri çıkar.
function _veFEAOcctSolidShellIds(oc, solidShape, shellIdByHash) {
  var ids = [];
  try {
    var exp = new oc.TopExp_Explorer_2(solidShape, oc.TopAbs_ShapeEnum.TopAbs_SHELL, oc.TopAbs_ShapeEnum.TopAbs_SHAPE);
    var seen = {};
    for (; exp.More(); exp.Next()) {
      var h = exp.Current().HashCode(1e9);
      if (seen[h]) continue;
      seen[h] = true;
      var sid = shellIdByHash[h];
      if (sid && ids.indexOf(sid) < 0) ids.push(sid);
    }
    exp.delete();
  } catch (e) { /* skip */ }
  return ids;
}

// face.edgeIds, face.vertexIds + vertex.edgeIds/faceIds ilişkilerini kur.
function _veFEAOcctBindRelations(faces, edges, vertices) {
  var faceMap = {}; faces.forEach(function(f) { faceMap[f.id] = f; });
  var vertMap = {}; vertices.forEach(function(v) { v.edgeIds = []; v.faceIds = []; vertMap[v.id] = v; });
  edges.forEach(function(e) {
    (e.faceIds || []).forEach(function(fid) {
      var f = faceMap[fid];
      if (f && f.edgeIds.indexOf(e.id) < 0) f.edgeIds.push(e.id);
    });
    (e.vertexIds || []).forEach(function(vid) {
      var v = vertMap[vid];
      if (!v) return;
      if (v.edgeIds.indexOf(e.id) < 0) v.edgeIds.push(e.id);
      (e.faceIds || []).forEach(function(fid) {
        if (v.faceIds.indexOf(fid) < 0) v.faceIds.push(fid);
        var f2 = faceMap[fid];
        if (f2 && f2.vertexIds.indexOf(vid) < 0) f2.vertexIds.push(vid);
      });
    });
  });
}

function _veFEAOcctVolume(oc, shape) {
  try {
    var props = new oc.GProp_GProps_1();
    oc.BRepGProp.VolumeProperties_1(shape, props, false, false, false);
    var v = Math.abs(props.Mass());
    props.delete();
    return v;
  } catch (e) { return 0; }
}

function _veFEAOcctBBox(oc, shape) {
  try {
    var box = new oc.Bnd_Box_1();
    oc.BRepBndLib.Add(shape, box, false);
    var xmin = {}, ymin = {}, zmin = {}, xmax = {}, ymax = {}, zmax = {};
    // embind: Get(...) çıkış parametreleri obje döndürmez; CornerMin/Max kullan
    var pMin = box.CornerMin();
    var pMax = box.CornerMax();
    var bx = pMax.X() - pMin.X(), by = pMax.Y() - pMin.Y(), bz = pMax.Z() - pMin.Z();
    box.delete();
    return { x: bx, y: by, z: bz };
  } catch (e) { return { x: 0, y: 0, z: 0 }; }
}

// Validity: Euler-Poincaré + manifold (E→F=2) + watertight.
function _veFEAOcctValidity(faces, edges, vertices, edgeFaceMap, shells, solids, wires) {
  var V = vertices.length, E = edges.length, F = faces.length;
  var S = shells ? shells.length : 0, So = solids ? solids.length : 0, W = wires ? wires.length : 0;
  var chi = V - E + F;
  // Manifold: her kenar tam 2 yüze ait olmalı (kapalı katı)
  var manifoldEdges = 0, openEdges = 0, nonManifoldEdges = 0;
  edges.forEach(function(e) {
    var c = (e.faceIds || []).length;
    if (c === 2) manifoldEdges++;
    else if (c < 2) openEdges++;
    else nonManifoldEdges++;
  });
  var manifold = (openEdges === 0 && nonManifoldEdges === 0);
  // Basit kapalı katı için Euler χ=2 beklenir (genus 0, tek shell).
  // Delikli/çok-shell'li katılarda χ≠2 olabilir; bu yüzden "uyarı" seviyesinde.
  var eulerOK = (chi === 2);
  var issues = [];
  if (!manifold) {
    if (openEdges > 0) issues.push(openEdges + ' açık kenar (watertight değil)');
    if (nonManifoldEdges > 0) issues.push(nonManifoldEdges + ' non-manifold kenar');
  }
  if (!eulerOK) issues.push('Euler χ=' + chi + ' (basit katı için 2 beklenir — delik/genus olabilir)');
  return {
    eulerChi: chi, eulerOK: eulerOK,
    manifold: manifold, watertight: (openEdges === 0),
    counts: { V: V, E: E, F: F, W: W, S: S, So: So, manifoldEdges: manifoldEdges, openEdges: openEdges, nonManifoldEdges: nonManifoldEdges },
    issues: issues
  };
}

function _veFEAOcctSurfLabel(type) {
  return ({
    planar: 'Düzlemsel Yüzey', cylindrical: 'Silindirik Yüzey', conical: 'Konik Yüzey',
    spherical: 'Küresel Yüzey', toroidal: 'Toroidal Yüzey', bspline: 'B-Spline Yüzey',
    bezier: 'Bezier Yüzey', revolution: 'Dönel Yüzey', extrusion: 'Süpürme Yüzey',
    offset: 'Offset Yüzey', freeform: 'Serbest Yüzey'
  })[type] || 'Yüzey';
}
function _veFEAOcctCurveLabel(type) {
  return ({
    line: 'Doğru', circle: 'Daire', arc: 'Yay', ellipse: 'Elips',
    hyperbola: 'Hiperbol', parabola: 'Parabol', spline: 'B-Spline Eğri',
    bezier: 'Bezier Eğri', offset: 'Offset Eğri', other: 'Eğri'
  })[type] || 'Kenar';
}

// Node.js (Jest) export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    veFEAOcctLoad: veFEAOcctLoad,
    veFEAOcctShapeToTopology: veFEAOcctShapeToTopology,
    veFEAOcctReadStepBuffer: veFEAOcctReadStepBuffer,
    veFEAOcctTopologyFromStepBuffer: veFEAOcctTopologyFromStepBuffer,
    veFEAOcctHealShape: veFEAOcctHealShape,
    veFEAOcctTessellateShape: veFEAOcctTessellateShape,
    veFEAOcctIsAvailable: veFEAOcctIsAvailable,
    VE_OCCT_SURF: VE_OCCT_SURF,
    VE_OCCT_CURVE: VE_OCCT_CURVE
  };
}
