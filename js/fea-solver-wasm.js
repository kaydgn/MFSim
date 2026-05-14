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
//   veFEAWasmVersion()                           → Promise<string>
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

// Node/Jest ortamında CommonJS export — birim testleri için.
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    veFEAEnsureWasm: veFEAEnsureWasm,
    veFEASolveBar1D: veFEASolveBar1D,
    veFEAWasmVersion: veFEAWasmVersion,
    _VE_FEA_WASM_STATE: VE_FEA_WASM_STATE
  };
}
