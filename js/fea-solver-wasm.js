// ============================================================================
// MFSim FEA — WASM SOLVER SARMALAYICI
// ============================================================================
// C++ ile yazılıp Emscripten ile derlenen FEA çözücüsünü (1D çubuk eleman
// prototipi) tarayıcıya yükler ve sade bir JS API olarak sunar.
//
// Hem dev modunda (vendor/mfsim-fea/'den lazy fetch) hem monolitik HTML'de
// (window.__feaInline.mfsimFeaScript / mfsimFeaWasm üzerinden base64 inline)
// çalışır. OCCT/STEP yükleyicisi (fea-step.js) ile aynı patterni izler.
//
// Public API:
//   veFEAEnsureWasm()                            → Promise<EmscriptenModule>
//   veFEASolveBar1D(N, E, A, L, F)               → Promise<Float64Array>
//   veFEASolveLinearElastic3D(meshSpec)          → Promise<{displacements, info}>
//   veFEAWasmVersion()                           → Promise<string>
//
// 3D çözücü mesh formatı (veFEASolveLinearElastic3D girişi):
//   {
//     elementType: 'tet4' | 'hex8',
//     nodes:       Float32Array | Float64Array (numNodes * 3, [x,y,z, ...]),
//     elements:    Int32Array | Uint32Array (numElements * nodesPerElem),
//     material:    { E: Pa, nu: 0..0.5 },
//     fixed:       Int32Array | number[]  (sabit düğüm indisleri, hepsi 3 DOF clamp),
//     loads:       [{ node: i, force: [fx, fy, fz] }, ...]
//   }
// ============================================================================

var VE_FEA_WASM_STATE = { module: null, loading: null };

// MFSim FEA glue script kaynağını çöz (monolitik veya dev modu)
function _veFEAWasmScriptSource() {
  if (typeof window !== 'undefined' && window.__feaInline && window.__feaInline.mfsimFeaScript) {
    return { kind: 'inline', source: window.__feaInline.mfsimFeaScript };
  }
  return { kind: 'url', source: 'vendor/mfsim-fea/mfsim-fea.js' };
}

// WASM kaynağı: base64 inline ise Blob URL, değilse direkt dosya URL'i
function _veFEAWasmBinaryUrl() {
  if (typeof window === 'undefined') return null;
  if (window.__feaInline && window.__feaInline.mfsimFeaWasm) {
    var b64 = window.__feaInline.mfsimFeaWasm;
    var binary = (typeof atob === 'function') ? atob(b64) : Buffer.from(b64, 'base64').toString('binary');
    var bytes = new Uint8Array(binary.length);
    for (var i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return URL.createObjectURL(new Blob([bytes], { type: 'application/wasm' }));
  }
  return 'vendor/mfsim-fea/mfsim-fea.wasm';
}

// MFSimFEAModule global factory'sini hazırlar. Zaten yüklüyse hemen döner.
function _veFEAEnsureWasmScript() {
  if (typeof MFSimFEAModule !== 'undefined') return Promise.resolve();
  var src = _veFEAWasmScriptSource();
  if (src.kind === 'inline') {
    var url = URL.createObjectURL(new Blob([src.source], { type: 'application/javascript' }));
    return _veFEAWasmLoadScript(url, true).catch(function() {
      // Fallback: CSP nedeniyle script tag yüklemesi reddedilirse global eval
      try { (0, eval)(src.source); return Promise.resolve(); }
      catch (e) { return Promise.reject(e); }
    });
  }
  return _veFEAWasmLoadScript(src.source, false);
}

function _veFEAWasmLoadScript(src, isBlobUrl) {
  return new Promise(function(resolve, reject) {
    if (typeof document === 'undefined') {
      reject(new Error('document yok — Worker/Node ortamında doğrudan require/importScripts kullanın'));
      return;
    }
    var script = document.createElement('script');
    script.src = src;
    script.onload = function() {
      if (isBlobUrl) URL.revokeObjectURL(src);
      if (typeof MFSimFEAModule === 'undefined') {
        reject(new Error('MFSim FEA glue yüklendi ama MFSimFEAModule global tanımlı değil'));
      } else {
        resolve();
      }
    };
    script.onerror = function() { reject(new Error('MFSim FEA glue yüklenemedi: ' + src)); };
    document.head.appendChild(script);
  });
}

// Ana giriş noktası: Emscripten modülünü hazır halde döner. Tek sefer init,
// sonraki çağrılarda aynı promise/instance.
function veFEAEnsureWasm() {
  if (VE_FEA_WASM_STATE.module) return Promise.resolve(VE_FEA_WASM_STATE.module);
  if (VE_FEA_WASM_STATE.loading) return VE_FEA_WASM_STATE.loading;

  VE_FEA_WASM_STATE.loading = _veFEAEnsureWasmScript().then(function() {
    var wasmUrl = _veFEAWasmBinaryUrl();
    return MFSimFEAModule({
      locateFile: function(p) {
        return /\.wasm$/i.test(p) ? wasmUrl : p;
      }
    });
  }).then(function(mod) {
    VE_FEA_WASM_STATE.module = mod;
    VE_FEA_WASM_STATE.loading = null;
    return mod;
  }).catch(function(err) {
    VE_FEA_WASM_STATE.loading = null;
    throw err;
  });

  return VE_FEA_WASM_STATE.loading;
}

// ─── Public API ─────────────────────────────────────────────────────────────

// 1D çubuk eleman FEA: sol uç sabit, sağ uca F kuvveti.
// Döndürdüğü Float64Array düğüm yer değiştirmelerini içerir, uzunluk = N+1.
function veFEASolveBar1D(numElements, E, A, L, F) {
  return veFEAEnsureWasm().then(function(Module) {
    var N = numElements | 0;
    if (N <= 0) throw new Error('numElements > 0 olmalı (verilen: ' + numElements + ')');
    if (!(E > 0) || !(A > 0) || !(L > 0)) {
      throw new Error('E, A, L pozitif olmalı (E=' + E + ', A=' + A + ', L=' + L + ')');
    }

    var nDoubles = N + 1;
    var ptr = Module._malloc(nDoubles * 8);
    if (!ptr) throw new Error('WASM malloc başarısız');
    try {
      var status = Module.ccall(
        'solve_bar_1d', 'number',
        ['number', 'number', 'number', 'number', 'number', 'number'],
        [N, E, A, L, F, ptr]
      );
      if (status !== 0) throw new Error('solve_bar_1d başarısız (status=' + status + ')');
      // HEAPF64 buffer SharedArrayBuffer/ArrayBuffer; slice kopya alır.
      var view = new Float64Array(Module.HEAPF64.buffer, ptr, nDoubles);
      var out = new Float64Array(nDoubles);
      out.set(view);
      return out;
    } finally {
      Module._free(ptr);
    }
  });
}

function veFEAWasmVersion() {
  return veFEAEnsureWasm().then(function(Module) {
    var ptr = Module.ccall('mfsim_fea_version', 'number', [], []);
    return Module.UTF8ToString(ptr);
  });
}

// ─── 3D Lineer Elastik Çözücü ───────────────────────────────────────────────
// Eleman tipi enum'u — C++ ile aynı sıraya göre olmalı (solver3d.cpp)
var VE_FEA_ELEM_TYPE = { tet4: 0, hex8: 1 };
var VE_FEA_NODES_PER_ELEM = { tet4: 4, hex8: 8 };

function _veFEAToFloat64(arr) {
  if (arr instanceof Float64Array) return arr;
  return Float64Array.from(arr);
}

function _veFEAToInt32(arr) {
  if (arr instanceof Int32Array) return arr;
  if (Array.isArray(arr)) return Int32Array.from(arr);
  // Uint32Array, etc.
  return Int32Array.from(arr);
}

function veFEASolveLinearElastic3D(spec) {
  return veFEAEnsureWasm().then(function(Module) {
    if (!spec || typeof spec !== 'object') throw new Error('mesh spec gerekli');
    var elementType = spec.elementType;
    if (!(elementType in VE_FEA_ELEM_TYPE)) {
      throw new Error('Desteklenmeyen elementType: ' + elementType + ' (tet4 veya hex8)');
    }
    var elemEnum = VE_FEA_ELEM_TYPE[elementType];
    var nodesPerElem = VE_FEA_NODES_PER_ELEM[elementType];

    var nodes = _veFEAToFloat64(spec.nodes);
    var elements = _veFEAToInt32(spec.elements);
    if (nodes.length % 3 !== 0) throw new Error('nodes uzunluğu 3 katı olmalı');
    if (elements.length % nodesPerElem !== 0) {
      throw new Error('elements uzunluğu ' + nodesPerElem + ' katı olmalı');
    }
    var numNodes = nodes.length / 3;
    var numElements = elements.length / nodesPerElem;

    if (!spec.material || !(spec.material.E > 0)) throw new Error('material.E > 0 olmalı');
    if (typeof spec.material.nu !== 'number' || spec.material.nu <= -1 || spec.material.nu >= 0.5) {
      throw new Error('material.nu (-1, 0.5) aralığında olmalı');
    }

    var fixed = _veFEAToInt32(spec.fixed || []);
    var loadsSpec = spec.loads || [];
    var loadedIndices = new Int32Array(loadsSpec.length);
    var loadValues = new Float64Array(loadsSpec.length * 3);
    for (var li = 0; li < loadsSpec.length; ++li) {
      var L = loadsSpec[li];
      if (typeof L.node !== 'number') throw new Error('load[' + li + '].node sayı olmalı');
      if (!L.force || L.force.length !== 3) throw new Error('load[' + li + '].force = [fx,fy,fz]');
      loadedIndices[li] = L.node;
      loadValues[li * 3 + 0] = L.force[0];
      loadValues[li * 3 + 1] = L.force[1];
      loadValues[li * 3 + 2] = L.force[2];
    }

    // WASM heap'inde buffer'lar tahsis et + veri kopyala
    var nodesPtr   = Module._malloc(nodes.byteLength);
    var elemPtr    = Module._malloc(elements.byteLength);
    var fixedPtr   = fixed.length > 0 ? Module._malloc(fixed.byteLength) : 0;
    var loadedPtr  = loadedIndices.length > 0 ? Module._malloc(loadedIndices.byteLength) : 0;
    var loadsPtr   = loadValues.length > 0 ? Module._malloc(loadValues.byteLength) : 0;
    var uOutPtr    = Module._malloc(numNodes * 3 * 8);
    if (!nodesPtr || !elemPtr || !uOutPtr) {
      // partial cleanup
      if (nodesPtr) Module._free(nodesPtr);
      if (elemPtr) Module._free(elemPtr);
      if (fixedPtr) Module._free(fixedPtr);
      if (loadedPtr) Module._free(loadedPtr);
      if (loadsPtr) Module._free(loadsPtr);
      if (uOutPtr) Module._free(uOutPtr);
      throw new Error('WASM malloc başarısız (büyük mesh için INITIAL_MEMORY artırılabilir)');
    }

    try {
      Module.HEAPF64.set(nodes, nodesPtr / 8);
      Module.HEAP32.set(elements, elemPtr / 4);
      if (fixedPtr) Module.HEAP32.set(fixed, fixedPtr / 4);
      if (loadedPtr) Module.HEAP32.set(loadedIndices, loadedPtr / 4);
      if (loadsPtr) Module.HEAPF64.set(loadValues, loadsPtr / 8);

      var t0 = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();
      var status = Module.ccall(
        'solve_linear_elastic_3d', 'number',
        ['number','number','number','number','number','number','number',
         'number','number','number','number','number','number'],
        [
          elemEnum, numNodes, numElements,
          nodesPtr, elemPtr,
          spec.material.E, spec.material.nu,
          fixed.length, fixedPtr,
          loadsSpec.length, loadedPtr, loadsPtr,
          uOutPtr
        ]
      );
      var t1 = (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now();

      if (status !== 0) {
        var msg = 'solve_linear_elastic_3d başarısız (status=' + status + ')';
        if (status === -1) msg += ': geçersiz parametre';
        else if (status === -3) msg += ': desteklenmeyen eleman tipi';
        else if (status === -4) msg += ': dejenere eleman (negatif/sıfır hacim)';
        else if (status === -5) msg += ': sparse decomposition başarısız';
        else if (status === -6) msg += ': sparse solve başarısız';
        throw new Error(msg);
      }

      var view = new Float64Array(Module.HEAPF64.buffer, uOutPtr, numNodes * 3);
      var displacements = new Float64Array(numNodes * 3);
      displacements.set(view);

      return {
        displacements: displacements,
        info: {
          elementType: elementType,
          numNodes: numNodes,
          numElements: numElements,
          solveMs: t1 - t0
        }
      };
    } finally {
      Module._free(nodesPtr);
      Module._free(elemPtr);
      if (fixedPtr) Module._free(fixedPtr);
      if (loadedPtr) Module._free(loadedPtr);
      if (loadsPtr) Module._free(loadsPtr);
      Module._free(uOutPtr);
    }
  });
}

// Node/Jest ortamında CommonJS export — birim testleri için.
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    veFEAEnsureWasm: veFEAEnsureWasm,
    veFEASolveBar1D: veFEASolveBar1D,
    veFEASolveLinearElastic3D: veFEASolveLinearElastic3D,
    veFEAWasmVersion: veFEAWasmVersion,
    VE_FEA_ELEM_TYPE: VE_FEA_ELEM_TYPE,
    _VE_FEA_WASM_STATE: VE_FEA_WASM_STATE
  };
}
