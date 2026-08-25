// ============================================================================
//  YAPISAL ANALİZ — HESAPLAMA AĞI KÖPRÜSÜ (TetGen)
// ============================================================================
// Zincirin ikinci halkası. Üç katmanın ORTASI, Geometri'dekiyle birebir aynı
// ayrım (bkz. structural-model.js başlığı):
//
//   vendor/tetgen-src/*      HESAP ÇEKİRDEĞİ — DIŞARIDAN GELDİ, BİREBİR DURUR.
//                            TetGen 1.6 (Hang Si / WIAS), AGPL-3. Delaunay
//                            tetrahedralizasyon + kalite iyileştirme.
//   js/structural-remesh.js  YÜZEY HAZIRLIĞI (DOM'suz, saf) — OCCT'nin render
//                            tessellation'ını TetGen'in kabul edeceği üniform
//                            bir yüzey ağına çevirir.
//   js/structural-mesh-model.js  BU DOSYA. KÖPRÜ: geometriyi PLC'ye çevirir,
//                            çekirdeği çağırır, sonucu MFSim modeline döker,
//                            hatayı Türkçeleştirir. DOM'suz.
//   js/cp-structural.js      SUNUM. Yalnız HTML kurar; ağ HESAPLAMAZ.
//
// ── NEDEN KENDİMİZ DERLEDİK ─────────────────────────────────────────────────
// occt-import-js npm'den HAZIR .wasm olarak geliyordu; TetGen için öyle bir
// paket YOK (npm/CDN arandı). `tools/build-tetgen-wasm.js` gerçek TetGen
// kaynağını emscripten ile derliyor, `tools/build-tetgen-wasm-asset.js` çıkan
// .wasm'ı gzip+base64 uygulamaya gömüyor. Çıktıların ikisi de depoda: günlük
// akış (npm run build / test) derleyiciye hiç dokunmaz.
//
// ── TET10 (P2) PAZARLIK KONUSU DEĞİL ────────────────────────────────────────
// TetGen `-o2` ile doğrudan ikinci derece eleman üretir; orta düğümleri biz
// eklemiyoruz. Lineer tet (tet4) bu modülde YASAK ve gerekçesi ölçülmüş:
// MFSim'in kendi konsol kirişi ölçümünde 27.783 serbestlik derecesinde bile
// cevap %24 RİJİT (yani güvenli tarafta DEĞİL) çıkıyordu. Aynı sonuç bağımsız
// bir kaynakta daha var — aynı braket için kurulmuş Python boru hattının
// kalibrasyonu: 3 mm sacda kalınlık başına 4 lineer eleman koyulduğunda bile
// FEA/analitik = 0,81; tek KUADRATİK elemanla 0,98.
//
// ── SINIR KOŞULU ZİNCİRİ: CAD YÜZÜ KİMLİĞİ TETGEN'DEN GEÇER ────────────────
// Bu modülün en kritik sözleşmesi. Sınır koşulu ağ düğümüne değil CAD YÜZÜNE
// bağlanacak; yakınsama çalışması ise ağı defalarca yenileyecek. Zincir:
//   occt `brep_faces`  →  remesh `faceIds`  →  TetGen `facetmarkerlist`
//   →  TetGen çıktısı `trifacemarkerlist`  →  burada yeniden `m<i>/f<j>`
// NATIVE OLARAK ÖLÇÜLDÜ (TetGen 1.6, iki ayrı reçete): küpün üst yüzüne 42,
// diğer beşine 7 işaretçisi verildiğinde çıktı sınır üçgenlerinin İŞARETÇİSİ
// %100 {7,42}; başka değer YOK. Kalite kısıtı yüzeyi yeniden bölmeye zorlanınca
// (`-a5`, 12 → 232 sınır üçgeni) da sonuç aynı: 194 + 38, sıfır kayıp.
//
// ── HATA SESSİZ KALMAZ ──────────────────────────────────────────────────────
// TetGen kütüphane kipinde (`TETLIBRARY`) mesaj YAZMAZ, yalnız `throw <int>`
// yapar. Kodlar glue'da Türkçeleştiriliyor (tools/tetgen-wasm-src). Ayrıca
// ölçülmüş bir gerçek: kendini kesen bir yüzeyde TetGen çıktı yazma aşamasında
// WASM belleğinin dışına taşıyor ve JS'e `RuntimeError` olarak geliyor —
// modül örneği bundan SAĞ ÇIKIYOR (aynı örnekle sonraki geçerli iş başarıyla
// koşuyor, ölçüldü), o yüzden köprü hatayı yakalayıp sebebi yazıyor.
// ----------------------------------------------------------------------------

var VE_STR_TETGEN_WASM_PATHS = ['vendor/tetgen-wasm.wasm', './vendor/tetgen-wasm.wasm', 'tetgen-wasm.wasm'];

// KALİTE REÇETESİ — anlamı `vendor/tetgen-src/tetgen.cxx` parse_commandline'dan
// birebir doğrulandı (kısa yardımda yazmıyor):
//   p            girdi bir PLC (yüzey ağı), hacimlendir
//   q<oran>/<açı> radius-edge oranı üst sınırı / minimum dihedral açı alt sınırı
//   O<n>         iyileştirme seviyesi (flip düzeyi)
//   o2           İKİNCİ DERECE eleman (tet10) üret
//   Q            sessiz (stdout kirletmeyi bırak)
// Varsayılan 1.4/18: aynı braket için kurulmuş Python boru hattının ölçerek
// oturttuğu değerler (`minratio=1.4, mindihedral=18`).
var VE_STR_TETGEN_DEFAULTS = { minRatio: 1.4, minDihedral: 18, optLevel: 9, order2: true };

// Steiner noktası TAVANI. TetGen ince/kusurlu bir yüzeyi doldurmak için sınırsız
// nokta ekleyebiliyor; tarayıcıda bu, sekmeyi kilitleyen bir bellek patlaması
// demek. Python boru hattı da aynı sınırı koymuş (`steinerleft=400000`).
var VE_STR_TETGEN_STEINER_LIMIT = 400000;

var VE_STR_MESH_STAGES = ['reader', 'remesh', 'tetgen', 'build'];

function _smNum(v){
  if(v === null || v === undefined || v === '') return NaN;
  var n = Number(v);
  return isFinite(n) ? n : NaN;
}

// ─── Gömülü .wasm ───────────────────────────────────────────────────────────
// structural-model.js `_sgRunAsset` ile AYNI kalıp ve aynı gerekçe. Ad öneki
// `_sm…` — aynı adı iki dosyada üst-seviye bildirmek `source-hygiene` kapısına
// takılır (bkz. CLAUDE.md).
var _smAssetPromise = null;

function _smRunAsset(sel, hazirMi){
  return new Promise(function(resolve, reject){
    if(typeof document === 'undefined') return reject(new Error('Gömülü varlık yalnız tarayıcıda okunur.'));
    if(hazirMi()) return resolve();
    var ph = document.querySelector(sel);
    if(!ph) return reject(new Error('Gömülü varlık sayfada yok: ' + sel));
    var s = document.createElement('script');
    if(ph.src){
      s.src = ph.src;
      s.onload = function(){ hazirMi() ? resolve() : reject(new Error('Gömülü varlık çalıştı ama içerik gelmedi: ' + sel)); };
      s.onerror = function(){ reject(new Error('Gömülü varlık yüklenemedi: ' + ph.src)); };
      document.head.appendChild(s);
    } else {
      // Tek dosya sürümü: içerik ZATEN sayfada, yalnız çalıştırılmamış.
      s.textContent = ph.textContent;
      document.head.appendChild(s);
      hazirMi() ? resolve() : reject(new Error('Gömülü varlık çalıştı ama içerik gelmedi: ' + sel));
    }
  });
}

function _smEmbeddedWasmB64(){
  if(_smAssetPromise) return _smAssetPromise;
  var hazir = function(){ return typeof window !== 'undefined' && !!window.VE_STR_TETGEN_WASM_GZ_B64; };
  var p = _smRunAsset('script[data-mfsim-asset="tetgen-wasm"]', hazir)
    .then(function(){ return window.VE_STR_TETGEN_WASM_GZ_B64; });
  _smAssetPromise = p;
  p['catch'](function(){ if(_smAssetPromise === p) _smAssetPromise = null; });
  return p;
}

// Worker'a giden kaynaklar — AĞSIZ. Tek dosya sürümünde her iki script de
// sayfada INLINE durur (`type` javascript olmadığı / MFSimLoader kopyayı
// çalıştırdığı için yer tutucunun METNİ yerinde kalır); modüler kurulumda
// src'den çekilir. Emscripten'in kendi yol tahminine (`currentScript.src`)
// güvenilmiyor: tek dosyada o alan YOKTUR.
function _smSourceOf(selector, label){
  var ph = (typeof document !== 'undefined') ? document.querySelector(selector) : null;
  if(ph && ph.textContent && ph.textContent.length > 500) return Promise.resolve(ph.textContent);
  var url = ph && ph.src;
  if(!url) return Promise.reject(new Error(label + ' kaynağı sayfada bulunamadı.'));
  if(typeof fetch !== 'function') return Promise.reject(new Error(label + ' kaynağı okunamadı.'));
  return fetch(url).then(function(res){
    if(!res.ok) throw new Error(label + ' kaynağı bulunamadı: ' + url);
    return res.text();
  });
}

// ─── WORKER ─────────────────────────────────────────────────────────────────
// HEM yeniden-mesh'leme HEM tetrahedralizasyon burada koşar. İkisi de ana iş
// parçacığında saniyeler sürüyor (ÖLÇÜLDÜ: braket parçasının yalnız yüzey
// hazırlığı 25 s), yani arayüz o süre boyunca TEK KARE çizmezdi. Ölçüt "hızlı
// mı" değil, ARAYÜZÜN YAŞIYOR olması — Geometri bileşeninde ölçülen dersin
// aynısı (orada ana iş parçacığında 1 kare, worker'da 91 kare çizilmişti).
var VE_STR_MESH_WORKER_BRIDGE = [
  'var _tg = null, _wasm = null;',
  'function _b64(s){ var b = atob(s), u = new Uint8Array(b.length);',
  '  for(var i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return u; }',
  'function _gunzip(u){',
  '  if(typeof DecompressionStream !== "function") return Promise.reject(new Error("DecompressionStream yok"));',
  '  return new Response(new Blob([u]).stream().pipeThrough(new DecompressionStream("gzip"))).arrayBuffer();',
  '}',
  'self.onmessage = function(e){',
  '  var d = e.data || {};',
  '  if(d.type === "init"){',
  '    try {',
  '      var bin = d.wasmBinary ? Promise.resolve(d.wasmBinary) : _gunzip(_b64(d.wasmB64));',
  // Baytları SAKLA: bir katı WASM belleğini taşırsa o örnek bir daha
  // güvenilir değil ve kalan katılar için TAZE bir örnek kurmak gerekiyor
  // (gerekçesi veStrMeshRunAll'da ölçümüyle yazılı).
  '      bin.then(function(wasm){ _wasm = wasm; return VeTetGenModule({ wasmBinary: wasm }); })',
  '      .then(function(m){ _tg = m; self.postMessage({ type:"ready" }); })',
  '      ["catch"](function(err){ self.postMessage({ type:"fatal", error:String((err && err.message) || err) }); });',
  '    } catch(err){ self.postMessage({ type:"fatal", error:String((err && err.message) || err) }); }',
  '    return;',
  '  }',
  '  if(d.type === "mesh"){',
  '    if(!_tg){ self.postMessage({ type:"error", id:d.id, error:"ağ üreteci hazır değil" }); return; }',
  '    var first = true;',
  '    var getMod = function(){',
  '      if(first){ first = false; return Promise.resolve(_tg); }',
  '      return VeTetGenModule({ wasmBinary: _wasm }).then(function(m){ _tg = m; return m; });',
  '    };',
  '    veStrMeshRunAll(getMod, d.meshes, d.options, function(stage, info){',
  '      self.postMessage({ type:"stage", id:d.id, stage:stage, info:info });',
  '    }).then(function(out){',
  '      if(!out.ok){ self.postMessage({ type:"error", id:d.id, error:out.error, plc:out.surface || null }); return; }',
  '      var transfer = [out.points.buffer, out.tets.buffer, out.triFaces.buffer];',
  '      self.postMessage({ type:"result", id:d.id, mesh:out }, transfer);',
  '    })["catch"](function(err){',
  '      self.postMessage({ type:"error", id:d.id, error:String((err && err.message) || err) });',
  '    });',
  '  }',
  '};'
].join('\n');

var _smWorkerPromise = null;
var _smWorkerUrl = '';
var _smJobSeq = 0;

function _smWorkerSupported(){
  return typeof Worker === 'function' && typeof Blob === 'function' && typeof URL !== 'undefined' && !!URL.createObjectURL;
}

// ─── PLC KURULUMU ───────────────────────────────────────────────────────────
// Bütün katıların yüzeyleri TEK bir PLC'de birleşir: TetGen'e verilen şey
// "kapalı bir yüzey" olmak zorunda ve parçanın tamamı tek bir hacim.
//
// CAD YÜZÜ KİMLİĞİ → TAMSAYI. TetGen işaretçisi `int`; kimlik ise `m<i>/f<j>`
// dizgisi. Eşleme burada kuruluyor ve TERS TABLO sonuçla birlikte dönüyor —
// yoksa çıktıdaki 17 numaralı işaretçinin hangi CAD yüzü olduğu kaybolurdu.
// Sıfır KULLANILMIYOR: TetGen işaretçisiz yüzleri 0 sayıyor, gerçek bir yüzün
// kimliği onunla karışmamalı.
function veStrBuildPLC(meshes, options){
  options = options || {};
  if(!meshes || !meshes.length) return { ok: false, error: 'Ağ kurulamadı: geometri boş.' };

  var points = [], tris = [], markers = [];
  var faceOfMarker = {}, markerOfFace = {}, nextMarker = 1;
  var qBefore = { minAngleDeg: 180, below10: 0, tri: 0 };
  var qAfter = { minAngleDeg: 180, below10: 0, tri: 0 };
  var welded = 0, nonManifold = 0, volBefore = 0, volAfter = 0;

  for(var mi = 0; mi < meshes.length; mi++){
    var m = meshes[mi];
    if(!m || !m.indices || !m.indices.length) continue;

    // YÜZEY HAZIRLIĞI ATLANABİLİR (options.remesh === false). Gerekçesi
    // veStrMeshRunAll'daki yedek yolda: yeniden-mesh bazı parçalarda yüzeyi
    // kendi kendini keser hâle getiriyor, oysa HAM CAD üçgenlemesi temiz.
    var r;
    if(options.remesh === false){
      r = { ok: true, positions: m.positions, indices: m.indices,
            faceIds: (m.faces || []).reduce(function(acc, f){
              for(var q = f.first; q <= f.last; q++) acc[q] = f.id || ('m' + mi + '/f' + f.faceIndex);
              return acc;
            }, []),
            weldedCount: 0, nonManifoldEdges: 0, raw: true };
    } else {
      r = (typeof veStrRemeshMesh === 'function')
        ? veStrRemeshMesh(m, { targetLen: options.targetLen, iterations: options.remeshIterations })
        : null;
      if(!r) return { ok: false, error: 'Yüzey hazırlama modülü yüklenmedi (structural-remesh.js).' };
      if(!r.ok) return { ok: false, error: r.error };
    }

    welded += r.weldedCount || 0;
    nonManifold += r.nonManifoldEdges || 0;
    volBefore += Math.abs(r.volumeBefore || 0);
    volAfter += Math.abs(r.volumeAfter || 0);
    [['qualityBefore', qBefore], ['qualityAfter', qAfter]].forEach(function(pair){
      var q = r[pair[0]], acc = pair[1];
      if(!q || !q.triCount) return;
      if(q.minAngleDeg < acc.minAngleDeg) acc.minAngleDeg = q.minAngleDeg;
      acc.below10 += (q.below10Pct / 100) * q.triCount;
      acc.tri += q.triCount;
    });

    var base = points.length / 3;
    for(var p = 0; p < r.positions.length; p++) points.push(r.positions[p]);
    for(var t = 0; t < r.indices.length / 3; t++){
      tris.push(base + r.indices[t*3], base + r.indices[t*3+1], base + r.indices[t*3+2]);
      var fid = r.faceIds[t] || ('m' + mi + '/f?');
      if(markerOfFace[fid] === undefined){
        markerOfFace[fid] = nextMarker;
        faceOfMarker[nextMarker] = fid;
        nextMarker++;
      }
      markers.push(markerOfFace[fid]);
    }
  }

  if(!tris.length) return { ok: false, error: 'Ağ kurulamadı: yüzey üçgeni üretilemedi.' };

  return {
    ok: true,
    points: new Float64Array(points),
    triangles: new Int32Array(tris),
    triMarkers: new Int32Array(markers),
    faceOfMarker: faceOfMarker,
    report: {
      // Yüzey hazırlığı ATLANDI mı — yedek yolun kendini tanıması için
      // (ham yüzeyle koşarken tekrar yedeğe düşmeye kalkmasın).
      raw: options.remesh === false,
      surfaceNodes: points.length / 3,
      surfaceTris: tris.length / 3,
      faceCount: nextMarker - 1,
      weldedNodes: welded,
      nonManifoldEdges: nonManifold,
      // HACİM KAYBI: yüzey hazırlığı parçayı ne kadar yedi. Sessiz bir kayıp
      // daha ince bir gövde demek, o da sistematik olarak YÜKSEK gerilme —
      // panel bunu yazmak zorunda. (Python boru hattı %4'ü eşik almış;
      // burada eşik panelde, ölçüm burada.)
      cadVolume: volBefore,
      meshVolume: volAfter,
      volumeLossPct: volBefore > 0 ? (100 * (volBefore - volAfter) / volBefore) : 0,
      qualityBefore: { minAngleDeg: qBefore.tri ? qBefore.minAngleDeg : 0, below10Pct: qBefore.tri ? (100*qBefore.below10/qBefore.tri) : 0 },
      qualityAfter: { minAngleDeg: qAfter.tri ? qAfter.minAngleDeg : 0, below10Pct: qAfter.tri ? (100*qAfter.below10/qAfter.tri) : 0 }
    }
  };
}

function veStrTetGenSwitches(options){
  options = options || {};
  var minRatio = _smNum(options.minRatio);
  var minDihedral = _smNum(options.minDihedral);
  var optLevel = _smNum(options.optLevel);
  if(!isFinite(minRatio) || minRatio <= 0) minRatio = VE_STR_TETGEN_DEFAULTS.minRatio;
  if(!isFinite(minDihedral) || minDihedral < 0) minDihedral = VE_STR_TETGEN_DEFAULTS.minDihedral;
  if(!isFinite(optLevel) || optLevel < 0) optLevel = VE_STR_TETGEN_DEFAULTS.optLevel;

  var sw = 'p' + 'q' + minRatio + '/' + minDihedral + 'O' + optLevel;
  if(options.order2 !== false) sw += 'o2';
  if(isFinite(_smNum(options.maxVolume)) && _smNum(options.maxVolume) > 0) sw += 'a' + _smNum(options.maxVolume);
  sw += 'S' + VE_STR_TETGEN_STEINER_LIMIT;
  sw += 'Q';
  return sw;
}

function veStrRunTetGen(mod, plc, options){
  var sw = veStrTetGenSwitches(options);
  var res;
  try {
    res = mod.veTetRun(plc.points, plc.triangles, plc.triMarkers, new Float64Array([]), sw);
  } catch(e){
    // ÖLÇÜLDÜ: kendini kesen bir yüzeyde TetGen çıktı yazarken WASM belleğinin
    // dışına taşıyor ve buraya `RuntimeError` olarak geliyor. Modül örneği
    // bundan sağ çıkıyor (sonraki geçerli iş aynı örnekle koşuyor), o yüzden
    // yakalayıp SEBEBİ yazmak yeterli — worker'ı yeniden kurmaya gerek yok.
    return { ok: false, crashed: true,
      error: 'Ağ üreteci bu yüzeyde durdu — yüzey büyük olasılıkla kendini kesiyor '
      + '(temas eden ya da çakışan katılar). Ayrıntı: ' + ((e && e.message) ? e.message : String(e)) };
  }
  if(!res || !res.ok) return { ok: false, error: (res && res.error) || 'Ağ üreteci sonuç vermedi.' };
  res.switches = sw;
  return res;
}

// ─── SONUCU NORMALİZE ET ────────────────────────────────────────────────────
// Kalite ölçütü İKİ TANE ve ikisi de gerekli — hangisinin kritik olduğu
// ölçülmüş bir ders: aynı braket için kurulmuş Python boru hattı, "kritik
// metrik `v_min`, `q_min` DEĞİL" diye yazmış. Şekil ölçütü iyi bir ağda bile
// 0,0000 görünebiliyor; asıl felaket HACMİ sıfıra yakın tetler, çünkü onlar
// rijitlik matrisini sayısal olarak tekil yapıyor ve HİÇBİR ön koşullandırıcı
// kurtaramıyor (o tarafta CG 800 iterasyonda 1e-2'de takılmış). Bu yüzden
// `minVolume` ve `degenerate` ayrı ayrı raporlanıyor ve dejenere varsa çözüm
// ADIMI UYARILMALI.
var VE_STR_TET_DEGENERATE_VOL = 1e-6;   // mm³

function veStrNormalizeMesh(raw, plc, meta){
  meta = meta || {};
  if(!raw || !raw.ok) return { ok: false, error: (raw && raw.error) || 'Ağ sonucu boş.' };

  var P = raw.points, T = raw.tets, C = raw.cornersPerTet, nT = raw.numberOfTets;
  if(!P || !T || !nT) return { ok: false, error: 'Ağ sonucu eksik (düğüm ya da eleman yok).' };

  var minVol = Infinity, sumVol = 0, degenerate = 0, inverted = 0;
  for(var t = 0; t < nT; t++){
    var o = t * C;
    var a = T[o]*3, b = T[o+1]*3, c = T[o+2]*3, d = T[o+3]*3;
    var ax=P[b]-P[a], ay=P[b+1]-P[a+1], az=P[b+2]-P[a+2];
    var bx=P[c]-P[a], by=P[c+1]-P[a+1], bz=P[c+2]-P[a+2];
    var cx=P[d]-P[a], cy=P[d+1]-P[a+1], cz=P[d+2]-P[a+2];
    var v = ((ay*bz-az*by)*cx + (az*bx-ax*bz)*cy + (ax*by-ay*bx)*cz) / 6;
    if(v < 0){ inverted++; v = -v; }
    if(v < minVol) minVol = v;
    if(v < VE_STR_TET_DEGENERATE_VOL) degenerate++;
    sumVol += v;
  }

  // Sınır üçgeni → CAD yüzü kimliği. Zincirin son halkası.
  var faceOfMarker = (plc && plc.faceOfMarker) || {};
  var boundary = [], faceTriCount = {};
  var nF = raw.numberOfTriFaces || 0;
  for(var f = 0; f < nF; f++){
    var mk = raw.triMarkers[f];
    var fid = faceOfMarker[mk] || null;
    if(fid) faceTriCount[fid] = (faceTriCount[fid] || 0) + 1;
    boundary.push(fid);
  }

  return {
    ok: true,
    points: P,
    numberOfNodes: raw.numberOfPoints,
    tets: T,
    cornersPerTet: C,
    numberOfTets: nT,
    triFaces: raw.triFaces,
    triFaceIds: boundary,
    numberOfTriFaces: nF,
    faceTriCount: faceTriCount,
    switches: raw.switches || '',
    stats: {
      nodes: raw.numberOfPoints,
      tets: nT,
      order: (C === 10) ? 2 : 1,
      // P2 serbestlik derecesi ≈ 3 × düğüm (tet10'da düğüm zaten orta noktaları
      // içeriyor). Ölçülen ampirik oran (SD ≈ 5,376 × tet) tet4 ağı P2'ye
      // yükseltmek içindir — burada TetGen tet10'u KENDİSİ ürettiği için
      // gerçek düğüm sayısı biliniyor ve tahmine gerek yok.
      dof: raw.numberOfPoints * 3,
      volume: sumVol,
      minTetVolume: isFinite(minVol) ? minVol : 0,
      degenerate: degenerate,
      inverted: inverted,
      boundaryTris: nF,
      surface: (plc && plc.report) || null
    },
    meta: {
      createdAt: meta.createdAt || null,
      targetLen: meta.targetLen || null,
      worker: !!meta.worker
    }
  };
}

// ─── OTURUMLUK ÖNBELLEK ─────────────────────────────────────────────────────
// Ağın kendisi (yüz binlerce sayı) `node.data`'ya YAZILMAZ — Geometri'nin STEP
// kaynağında ölçülen hatanın birebir aynısı: `saveState()` bütün `node.data`'yı
// derin kopyalıyor ve yığın 50 adım tutuyor, ayrıca otomatik yedek
// `localStorage`'a gidiyor (kota ~5-10 MB). Ağ TÜRETİLMİŞ veridir ve yakınsama
// çalışması için zaten yeniden üretilecek.
var veStrMeshCache = (typeof window !== 'undefined') ? (window.veStrMeshCache = window.veStrMeshCache || {}) : {};

function veStrMeshCacheSet(nodeId, mesh){ if(nodeId) veStrMeshCache[nodeId] = mesh; }
function veStrMeshCacheGet(nodeId){ return (nodeId && veStrMeshCache[nodeId]) || null; }
function veStrMeshCacheClear(){
  Object.keys(veStrMeshCache).forEach(function(k){ delete veStrMeshCache[k]; });
}

// Düğüme yazılan HAFİF künye: ne düğüm ne eleman girer.
function veStrMeshRecord(mesh){
  if(!mesh || !mesh.ok) return null;
  return {
    createdAt: mesh.meta.createdAt,
    targetLen: mesh.meta.targetLen,
    switches: mesh.switches,
    stats: mesh.stats,
    faces: Object.keys(mesh.faceTriCount).map(function(id){
      return { id: id, triCount: mesh.faceTriCount[id] };
    })
  };
}

// ─── ANA GİRİŞ ──────────────────────────────────────────────────────────────
// geom: structural-model.js'in normalize ettiği model (veStrGeomCacheGet).
// options: { targetLen, remeshIterations, minRatio, minDihedral, maxVolume }
// opts: { onProgress(stage), wasmBinary, noWorker, factory }
function veStrBuildMesh(geom, options, opts){
  options = options || {};
  opts = opts || {};
  var onp = opts.onProgress || function(){};

  if(!geom || !geom.ok || !geom.meshes || !geom.meshes.length){
    return Promise.resolve({ ok: false, error: 'Ağ kurulamadı: önce bir STEP parçası içe aktarılmalı.' });
  }

  var useWorker = !opts.noWorker && !opts.wasmBinary && !opts.factory && _smWorkerSupported();
  if(useWorker){
    return _smBuildViaWorker(geom, options, opts).then(null, function(err){
      // Worker açılamadıysa (CSP, eski tarayıcı) ana iş parçacığına düş — ve
      // panel bunu YAZSIN: "hiç açılmadı" ile "donarak açıldı" arasında dağlar
      // kadar fark var.
      return _smBuildMain(geom, options, opts, String((err && err.message) || err));
    });
  }
  return _smBuildMain(geom, options, opts, '');
}

function _smBuildMain(geom, options, opts, workerNote){
  var onp = opts.onProgress || function(){};
  onp('reader', {});
  return veStrMeshRunAll(function(){ return _smLoadModuleMain(opts); }, geom.meshes, options, onp)
    .then(function(out){
      if(out.ok){
        out.meta.worker = false;
        if(workerNote) out.workerNote = workerNote;
      }
      return out;
    }, function(err){
      return { ok: false, error: 'Ağ üreteci yüklenemedi: ' + ((err && err.message) || err) };
    });
}

// ─── KATI BAŞINA TETRAHEDRALİZASYON ─────────────────────────────────────────
// TEK PLC DEĞİL, KATI BAŞINA BİR PLC. Bu bir tercih değil, ölçülmüş bir
// zorunluluk: braket parçası 7 KATIDAN oluşuyor ve katılar birbirine TEMAS
// ediyor (iç içe geçmiyor — kaynaklı montaj). Hepsi tek bir yüzey ağı olarak
// verildiğinde TetGen çakışan yüzeylerde duruyor (ÖLÇÜLDÜ: 18,5 s sonra
// bellek taşması). Aynı parça için kurulmuş Python boru hattı da tam olarak
// bu duvara çarpmış ve notlarına "gmsh tek başına bu montajı hacimlendiremiyor
// … healShapes, removeAllDuplicates, farklı Algorithm3D — hiçbiri çözmedi"
// diye yazmış; oradaki çözüm CAD seviyesinde boolean birleştirmeydi (gmsh
// `fuse`), ki occt-import-js yalnız OKUYUCU olduğu için burada yok.
//
// Katı başına ayırmak sorunu yapısal olarak ortadan kaldırıyor: her katı kendi
// içinde kapalı ve manifold, çakışma ancak katılar ARASINDA. Ölçüldü: braketin
// yedi katısının beşinde non-manifold kenar sıfır.
//
// BEDELİ AÇIKÇA YAZILIYOR: temas yüzeylerinde iki katının düğümleri ÇAKIŞMAZ,
// yani parçalar ağ düzeyinde birbirine bağlı değildir. Çözücü bileşeni bunu
// bilmek zorunda (bağ kurulacaksa "bonded contact" olarak kurulacak) ve
// künyede `solidCount` ile taşınıyor. Sessiz bırakılsaydı kullanıcı yedi ayrı
// parçayı tek bir gövde sanırdı.
// `getModule()` bir Promise<modül> döndürür ve HER ÇAĞRIDA TAZE bir örnek
// verebilmelidir: bir katı WASM belleğinin dışına taştığında o örnek bir daha
// GÜVENİLİR DEĞİL. ÖLÇÜLDÜ (braket, 7 katı): ilk katı çökünce aynı örnekle
// koşan sonraki ALTI katı da çöküyordu — oysa beşinin yüzeyi kusursuz
// (non-manifold kenar 0). Çökme sonrası taze örnekle o beşi sorunsuz
// tamamlanıyor. Küçük bir sentetik durumda örnek sağ çıkmıştı; gerçek bir
// parçadaki taşma o kadar iyi huylu değil.
// Object.assign yok (ES5 hedefi) — sığ birleştirme.
function _smAssign(hedef, a, b){
  [a, b].forEach(function(o){ if(o) for(var k in o) if(Object.prototype.hasOwnProperty.call(o, k)) hedef[k] = o[k]; });
  return hedef;
}

function veStrMeshRunAll(getModule, meshes, options, onp){
  onp = onp || function(){};
  var perSolid = options.perSolid !== false && meshes.length > 1;
  var groups = perSolid ? meshes.map(function(m){ return [m]; }) : [meshes];
  var acc = null, failed = [];

  return getModule().then(function(mod){
    var chain = Promise.resolve();
    groups.forEach(function(group, g){
      chain = chain.then(function(){
        onp('remesh', { solid: g, total: groups.length });
        var plc = veStrBuildPLC(group, options);
        if(!plc.ok){ failed.push({ solid: g, error: plc.error }); return; }
        onp('tetgen', { solid: g, total: groups.length });
        var raw = veStrRunTetGen(mod, plc, options);

        // ── YEDEK YOL: HAM YÜZEYLE YENİDEN DENE ────────────────────────────
        // ÖLÇÜLDÜ (kullanıcının braketi, native TetGen 1.6 `-d` ile):
        //   ham CAD üçgenlemesi        → "The input surface mesh is correct."
        //   yeniden-mesh h=10/8/6/4/3  → 8 / 3 / 2 / 10 / 19 üçgen ATILIYOR
        //                                ("self-intersections")
        // Yani yüzeyi bozan şey CAD verisi değil, HAZIRLIK adımının kendisi:
        // izotropik döngü ince bölgelerde birbirini kesen kenarlar üretiyor.
        // Bu, structural-remesh.js'te düzeltilmesi gereken bir kusur; ama o
        // düzelene kadar kullanıcının parçası HİÇ ağ örülemiyor olamaz.
        //
        // Ham yüzeyle örmenin bedeli ELEMAN SAYISI: TetGen kalite için Steiner
        // noktası ekliyor (aynı brakette 220 bin tet10). Pahalı ama ÇALIŞAN
        // bir ağ, hiç ağ olmamasından iyidir — ve sonuç bunu YAZIYOR.
        if(!raw.ok && options.remesh !== false && plc.report && !plc.report.raw){
          var hamPlc = veStrBuildPLC(group, _smAssign({}, options, { remesh: false }));
          if(hamPlc.ok){
            var ham = veStrRunTetGen(mod, hamPlc, options);
            if(ham.ok){
              ham.surfacePrep = 'ham';
              ham.surfacePrepNote = 'Yüzey hazırlığı bu parçada kendini kesen üçgen üretti; '
                + 'ham CAD üçgenlemesiyle örüldü (daha çok eleman).';
              plc = hamPlc;
              raw = ham;
            }
          }
        }

        if(!raw.ok){
          failed.push({ solid: g, error: raw.error, surface: plc.report });
          if(raw.crashed){
            return getModule().then(function(fresh){ mod = fresh; },
                                    function(){ /* taze örnek kurulamadı: kalanlar da düşecek */ });
          }
          return;
        }
        var part = veStrNormalizeMesh(raw, plc, {
          createdAt: new Date().toISOString(),
          targetLen: options.targetLen || null
        });
        if(!part.ok){ failed.push({ solid: g, error: part.error }); return; }
        acc = acc ? _smMergeMesh(acc, part) : part;
      });
    });
    return chain;
  }).then(function(){
    onp('build', {});
    if(!acc){
      return { ok: false,
        error: 'Ağ kurulamadı — ' + (failed[0] ? failed[0].error : 'bilinmeyen sebep'),
        failedSolids: failed,
        surface: (failed[0] && failed[0].surface) || null };
    }
    acc.stats.solidCount = groups.length - failed.length;
    acc.stats.solidTotal = groups.length;
    acc.stats.perSolid = perSolid;
    // KISMİ BAŞARI SESSİZ KALMAZ: bazı katılar ağa girmediyse çözüm eksik bir
    // gövde üzerinde koşar ve sonuç "makul ama yanlış" olur — bu modülün en
    // çok kaçındığı hata sınıfı.
    if(failed.length) acc.failedSolids = failed;
    return acc;
  });
}

// İki ağı birleştir: düğüm indisleri kaydırılır, künyeler toplanır.
function _smMergeMesh(a, b){
  var shift = a.numberOfNodes;
  var C = a.cornersPerTet;

  var points = new Float64Array(a.points.length + b.points.length);
  points.set(a.points, 0); points.set(b.points, a.points.length);

  var tets = new Int32Array(a.tets.length + b.tets.length);
  tets.set(a.tets, 0);
  for(var i = 0; i < b.tets.length; i++) tets[a.tets.length + i] = b.tets[i] + shift;

  var tri = new Int32Array(a.triFaces.length + b.triFaces.length);
  tri.set(a.triFaces, 0);
  for(var j = 0; j < b.triFaces.length; j++) tri[a.triFaces.length + j] = b.triFaces[j] + shift;

  var ids = a.triFaceIds.concat(b.triFaceIds);
  var counts = {};
  Object.keys(a.faceTriCount).forEach(function(k){ counts[k] = a.faceTriCount[k]; });
  Object.keys(b.faceTriCount).forEach(function(k){ counts[k] = (counts[k] || 0) + b.faceTriCount[k]; });

  var sa = a.stats, sb = b.stats;
  var surf = sa.surface && sb.surface ? {
    surfaceNodes: sa.surface.surfaceNodes + sb.surface.surfaceNodes,
    surfaceTris: sa.surface.surfaceTris + sb.surface.surfaceTris,
    faceCount: sa.surface.faceCount + sb.surface.faceCount,
    weldedNodes: sa.surface.weldedNodes + sb.surface.weldedNodes,
    nonManifoldEdges: sa.surface.nonManifoldEdges + sb.surface.nonManifoldEdges,
    cadVolume: (sa.surface.cadVolume || 0) + (sb.surface.cadVolume || 0),
    meshVolume: (sa.surface.meshVolume || 0) + (sb.surface.meshVolume || 0),
    volumeLossPct: (function(){
      var cv = (sa.surface.cadVolume || 0) + (sb.surface.cadVolume || 0);
      var mv = (sa.surface.meshVolume || 0) + (sb.surface.meshVolume || 0);
      return cv > 0 ? (100 * (cv - mv) / cv) : 0;
    })(),
    qualityBefore: {
      minAngleDeg: Math.min(sa.surface.qualityBefore.minAngleDeg, sb.surface.qualityBefore.minAngleDeg),
      below10Pct: (sa.surface.qualityBefore.below10Pct * sa.surface.surfaceTris + sb.surface.qualityBefore.below10Pct * sb.surface.surfaceTris) / (sa.surface.surfaceTris + sb.surface.surfaceTris)
    },
    qualityAfter: {
      minAngleDeg: Math.min(sa.surface.qualityAfter.minAngleDeg, sb.surface.qualityAfter.minAngleDeg),
      below10Pct: (sa.surface.qualityAfter.below10Pct * sa.surface.surfaceTris + sb.surface.qualityAfter.below10Pct * sb.surface.surfaceTris) / (sa.surface.surfaceTris + sb.surface.surfaceTris)
    }
  } : (sa.surface || sb.surface);

  return {
    ok: true,
    points: points,
    numberOfNodes: a.numberOfNodes + b.numberOfNodes,
    tets: tets,
    cornersPerTet: C,
    numberOfTets: a.numberOfTets + b.numberOfTets,
    triFaces: tri,
    triFaceIds: ids,
    numberOfTriFaces: a.numberOfTriFaces + b.numberOfTriFaces,
    faceTriCount: counts,
    switches: a.switches,
    stats: {
      nodes: a.numberOfNodes + b.numberOfNodes,
      tets: a.numberOfTets + b.numberOfTets,
      order: sa.order,
      dof: (a.numberOfNodes + b.numberOfNodes) * 3,
      volume: sa.volume + sb.volume,
      minTetVolume: Math.min(sa.minTetVolume, sb.minTetVolume),
      degenerate: sa.degenerate + sb.degenerate,
      inverted: sa.inverted + sb.inverted,
      boundaryTris: sa.boundaryTris + sb.boundaryTris,
      surface: surf
    },
    meta: a.meta
  };
}

function _smLoadModuleMain(opts){
  // `factory` ya hazır bir modül örneği ya da TAZE örnek üreten bir fonksiyon
  // olabilir. Fonksiyon biçimi çökme sonrası yeniden kurmayı mümkün kılıyor
  // (bkz. veStrMeshRunAll); hazır örnek biçimi testlerde tek örneği paylaşmayı.
  if(typeof opts.factory === 'function') return Promise.resolve(opts.factory());
  if(opts.factory) return Promise.resolve(opts.factory);
  if(typeof VeTetGenModule !== 'function'){
    return Promise.reject(new Error('TetGen kod dosyası yüklenmedi (vendor/tetgen-wasm.js).'));
  }
  if(opts.wasmBinary) return VeTetGenModule({ wasmBinary: opts.wasmBinary });
  return _smEmbeddedWasmB64().then(function(b64){
    var bin = atob(b64), u = new Uint8Array(bin.length);
    for(var i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
    if(typeof DecompressionStream !== 'function'){
      return Promise.reject(new Error('Bu tarayıcı gömülü ağ üretecini açamıyor (DecompressionStream yok).'));
    }
    return new Response(new Blob([u]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer()
      .then(function(wasm){ return VeTetGenModule({ wasmBinary: wasm }); });
  });
}

function _smEnsureWorker(){
  if(_smWorkerPromise) return _smWorkerPromise;
  var p = Promise.all([
    _smSourceOf('script[data-mfsim-tetgen-glue]', 'Ağ üreteci'),
    _smSourceOf('script[data-mfsim-remesh-src]', 'Yüzey hazırlama'),
    _smEmbeddedWasmB64()
  ]).then(function(parts){
    var blob = new Blob([parts[0], '\n', parts[1], '\n', _smMeshBridgeSource(), '\n', VE_STR_MESH_WORKER_BRIDGE],
      { type: 'text/javascript' });
    _smWorkerUrl = URL.createObjectURL(blob);
    var w = new Worker(_smWorkerUrl);
    return new Promise(function(resolve, reject){
      var done = false;
      function bitir(err, val){
        if(done) return;
        done = true;
        w.removeEventListener('message', onMsg);
        err ? reject(err) : resolve(val);
      }
      function onMsg(ev){
        var d = ev.data || {};
        if(d.type === 'ready') bitir(null, w);
        else if(d.type === 'fatal') bitir(new Error(d.error || 'Ağ üreteci worker içinde açılamadı.'));
      }
      w.addEventListener('message', onMsg);
      w.onerror = function(e){ bitir(new Error('Ağ üreteci worker içinde açılamadı: ' + ((e && e.message) || 'bilinmeyen hata'))); };
      w.postMessage({ type: 'init', wasmB64: parts[2] });
    });
  });
  _smWorkerPromise = p;
  p['catch'](function(){ if(_smWorkerPromise === p) _smWorkerPromise = null; });
  return p;
}

// Worker'ın içinde çalışacak KÖPRÜ FONKSİYONLARI. Bu dosya worker'a bir bütün
// olarak gönderilemez (DOM'a dokunan asset/worker yardımcıları var); worker'ın
// ihtiyacı olan saf hesap fonksiyonları kaynak metni olarak geçiyor.
function _smMeshBridgeSource(){
  return [
    'var VE_STR_TETGEN_DEFAULTS = ' + JSON.stringify(VE_STR_TETGEN_DEFAULTS) + ';',
    'var VE_STR_TETGEN_STEINER_LIMIT = ' + VE_STR_TETGEN_STEINER_LIMIT + ';',
    'var VE_STR_TET_DEGENERATE_VOL = ' + VE_STR_TET_DEGENERATE_VOL + ';',
    _smNum.toString(),
    veStrBuildPLC.toString(),
    veStrTetGenSwitches.toString(),
    veStrRunTetGen.toString(),
    veStrNormalizeMesh.toString(),
    _smMergeMesh.toString(),
    veStrMeshRunAll.toString()
  ].join('\n');
}

function _smBuildViaWorker(geom, options, opts){
  var onp = opts.onProgress || function(){};
  onp('reader', {});
  return _smEnsureWorker().then(function(w){
    return new Promise(function(resolve, reject){
      var id = ++_smJobSeq;
      function onMsg(ev){
        var d = ev.data || {};
        if(d.id !== id && d.type !== 'fatal') return;
        if(d.type === 'stage'){ onp(d.stage, {}); return; }
        w.removeEventListener('message', onMsg);
        if(d.type === 'error'){
          resolve({ ok: false, error: d.error, surface: d.plc || null });
          return;
        }
        if(d.type !== 'result'){ reject(new Error('Worker beklenmeyen yanıt verdi: ' + d.type)); return; }
        // Ağ worker'da ZATEN normalize edildi (kalite/hacim taraması orada
        // yapılıyor ki ana iş parçacığı yüz binlerce tet üzerinde dönmesin).
        var mesh = d.mesh;
        mesh.meta = mesh.meta || {};
        mesh.meta.worker = true;
        resolve(mesh);
      }
      w.addEventListener('message', onMsg);
      // Tipli diziler TRANSFER EDİLMİYOR: çağıranın geometri önbelleği canlı
      // kalmalı (3B görüntüleyici aynı tamponları kullanıyor). Kopya maliyeti
      // tek seferlik ve ağ kurmanın yanında ihmal edilebilir.
      var payload = geom.meshes.map(function(m){
        return { positions: m.positions, indices: m.indices, faces: m.faces };
      });
      w.postMessage({ type: 'mesh', id: id, meshes: payload, options: options });
    });
  });
}

function veStrMeshForget(){
  if(_smWorkerPromise){
    _smWorkerPromise.then(function(w){ try { w.terminate(); } catch(e){} }, function(){});
    _smWorkerPromise = null;
  }
  if(_smWorkerUrl){ try { URL.revokeObjectURL(_smWorkerUrl); } catch(e){} _smWorkerUrl = ''; }
  _smAssetPromise = null;
}

if(typeof module !== 'undefined' && module.exports){
  module.exports = {
    VE_STR_TETGEN_DEFAULTS: VE_STR_TETGEN_DEFAULTS,
    VE_STR_TETGEN_STEINER_LIMIT: VE_STR_TETGEN_STEINER_LIMIT,
    VE_STR_TET_DEGENERATE_VOL: VE_STR_TET_DEGENERATE_VOL,
    VE_STR_MESH_STAGES: VE_STR_MESH_STAGES,
    veStrBuildPLC: veStrBuildPLC,
    veStrTetGenSwitches: veStrTetGenSwitches,
    veStrRunTetGen: veStrRunTetGen,
    veStrNormalizeMesh: veStrNormalizeMesh,
    veStrBuildMesh: veStrBuildMesh,
    veStrMeshRecord: veStrMeshRecord,
    veStrMeshCacheSet: veStrMeshCacheSet,
    veStrMeshCacheGet: veStrMeshCacheGet,
    veStrMeshCacheClear: veStrMeshCacheClear,
    veStrMeshForget: veStrMeshForget
  };
}
