// ============================================================================
// STEP DOSYA İMPORT'U (OpenCascade WebAssembly üzerinden)
// ============================================================================
// occt-import-js (OpenCascade) STEP'i okur ve tessellated mesh array'i döner.
// Hem dev modunda (vendor/opencascade/'den lazy fetch) hem monolitik HTML'de
// (window.__feaInline.occt{Script,Wasm} olarak base64 inline) çalışır.
//
// Public API:
//   veFEAEnsureOCCT()                    → Promise<occt>  (lazy load)
//   veFEAParseSTEPBuffer(arrayBuffer)    → Promise<{ meshes, ... }>
//   veFEAStepMeshesToParsed(result)      → { vertices, normals, triangleCount }
//   veFEAApplySTEP(nodeId, buf, name)    → viewer'a uygular, persist eder
//   veFEAOnSTEPFileSelected(input, id)   → cp-fea.js file input handler
// ============================================================================

var VE_FEA_OCCT_STATE = { module: null, loading: null };

// OCCT JS loader script kaynağını çöz (monolitik veya dev)
function _veFEAOcctScriptSource() {
  if (typeof window !== 'undefined' && window.__feaInline && window.__feaInline.occtScript) {
    return { kind: 'inline', source: window.__feaInline.occtScript };
  }
  return { kind: 'url', source: 'vendor/opencascade/occt-import-js.js' };
}

// WASM kaynağı: base64 inline ise Blob URL, değilse direkt URL
function _veFEAOcctWasmUrl() {
  if (typeof window === 'undefined') return null;
  if (window.__feaInline && window.__feaInline.occtWasm) {
    var b64 = window.__feaInline.occtWasm;
    var binary = (typeof atob === 'function') ? atob(b64) : Buffer.from(b64, 'base64').toString('binary');
    var bytes = new Uint8Array(binary.length);
    for (var i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return URL.createObjectURL(new Blob([bytes], { type: 'application/wasm' }));
  }
  return 'vendor/opencascade/occt-import-js.wasm';
}

// occt-import-js global fonksiyonunu yükle (zaten yüklüyse hemen döner)
function _veFEAEnsureOcctScript() {
  if (typeof occtimportjs !== 'undefined') return Promise.resolve();
  var src = _veFEAOcctScriptSource();
  if (src.kind === 'inline') {
    // Monolitik: kaynağı bir blob URL'den yükle ki tarayıcı CSP'si izin verirse
    // script tag ile, izin vermezse fallback olarak global eval ile çalışsın.
    var url = URL.createObjectURL(new Blob([src.source], { type: 'application/javascript' }));
    return _veFEALoadScript(url, true).catch(function() {
      // Fallback: indirect eval (global scope'da çalışır)
      try { (0, eval)(src.source); return Promise.resolve(); }
      catch (e) { return Promise.reject(e); }
    });
  }
  return _veFEALoadScript(src.source, false);
}

function _veFEALoadScript(src, isBlobUrl) {
  return new Promise(function(resolve, reject) {
    var script = document.createElement('script');
    script.src = src;
    script.onload = function() {
      if (isBlobUrl) URL.revokeObjectURL(src);
      if (typeof occtimportjs === 'undefined') {
        reject(new Error('OCCT JS yüklendi ama global occtimportjs tanımlı değil'));
      } else {
        resolve();
      }
    };
    script.onerror = function() { reject(new Error('OCCT JS yüklenemedi: ' + src)); };
    document.head.appendChild(script);
  });
}

// Ana giriş noktası: OCCT modülünü hazır halde döner. Tekrar tekrar
// çağrılabilir; tek sefer initialize edilir.
function veFEAEnsureOCCT() {
  if (VE_FEA_OCCT_STATE.module) return Promise.resolve(VE_FEA_OCCT_STATE.module);
  if (VE_FEA_OCCT_STATE.loading) return VE_FEA_OCCT_STATE.loading;

  VE_FEA_OCCT_STATE.loading = _veFEAEnsureOcctScript().then(function() {
    var wasmUrl = _veFEAOcctWasmUrl();
    return occtimportjs({
      locateFile: function(p) {
        return /\.wasm$/i.test(p) ? wasmUrl : p;
      }
    });
  }).then(function(mod) {
    VE_FEA_OCCT_STATE.module = mod;
    VE_FEA_OCCT_STATE.loading = null;
    return mod;
  }).catch(function(err) {
    VE_FEA_OCCT_STATE.loading = null;
    throw err;
  });

  return VE_FEA_OCCT_STATE.loading;
}

// ─── STEP buffer → tessellated mesh listesi ─────────────────────────────────
function veFEAParseSTEPBuffer(arrayBuffer) {
  return veFEAEnsureOCCT().then(function(oc) {
    var bytes = (arrayBuffer instanceof Uint8Array) ? arrayBuffer : new Uint8Array(arrayBuffer);
    // occt-import-js API: ReadStepFile(buffer, params) → { success, meshes }
    var result;
    if (typeof oc.ReadStepFile === 'function') {
      result = oc.ReadStepFile(bytes, null);
    } else if (typeof oc.ReadStep === 'function') {
      result = oc.ReadStep(bytes, null);
    } else {
      throw new Error('OCCT API uyumsuz: ReadStepFile bulunamadı');
    }
    if (!result || result.success === false) {
      throw new Error('STEP parse başarısız');
    }
    return result;
  });
}

// OCCT result'ından bizim STL/primitif ile uyumlu { vertices, normals, triangleCount }
// formatına dönüştür. Birden çok parça varsa hepsi tek bir vertex stream'inde
// birleştirilir (tek bir mesh olarak gösterilir).
function veFEAStepMeshesToParsed(result) {
  if (!result || !result.meshes || result.meshes.length === 0) {
    return { vertices: new Float32Array(0), normals: new Float32Array(0), triangleCount: 0 };
  }
  // Toplam üçgen sayısını say
  var totalTris = 0;
  result.meshes.forEach(function(m) {
    var idx = m.index && (m.index.array || m.index.data || m.index);
    if (idx && idx.length) totalTris += idx.length / 3;
  });
  if (totalTris === 0) {
    return { vertices: new Float32Array(0), normals: new Float32Array(0), triangleCount: 0 };
  }

  var vertices = new Float32Array(Math.round(totalTris) * 9);
  var normals  = new Float32Array(Math.round(totalTris) * 9);
  var triPtr = 0;

  result.meshes.forEach(function(m) {
    var attrs = m.attributes || {};
    var pos = (attrs.position && (attrs.position.array || attrs.position.data || attrs.position)) || null;
    var nrm = (attrs.normal && (attrs.normal.array || attrs.normal.data || attrs.normal)) || null;
    var idx = (m.index && (m.index.array || m.index.data || m.index)) || null;
    if (!pos || !idx) return;

    for (var i = 0; i < idx.length; i += 3) {
      var i1 = idx[i] * 3, i2 = idx[i + 1] * 3, i3 = idx[i + 2] * 3;
      // 3 vertex'i unrolled olarak yaz
      vertices[triPtr * 9    ] = pos[i1];
      vertices[triPtr * 9 + 1] = pos[i1 + 1];
      vertices[triPtr * 9 + 2] = pos[i1 + 2];
      vertices[triPtr * 9 + 3] = pos[i2];
      vertices[triPtr * 9 + 4] = pos[i2 + 1];
      vertices[triPtr * 9 + 5] = pos[i2 + 2];
      vertices[triPtr * 9 + 6] = pos[i3];
      vertices[triPtr * 9 + 7] = pos[i3 + 1];
      vertices[triPtr * 9 + 8] = pos[i3 + 2];
      if (nrm) {
        normals[triPtr * 9    ] = nrm[i1];
        normals[triPtr * 9 + 1] = nrm[i1 + 1];
        normals[triPtr * 9 + 2] = nrm[i1 + 2];
        normals[triPtr * 9 + 3] = nrm[i2];
        normals[triPtr * 9 + 4] = nrm[i2 + 1];
        normals[triPtr * 9 + 5] = nrm[i2 + 2];
        normals[triPtr * 9 + 6] = nrm[i3];
        normals[triPtr * 9 + 7] = nrm[i3 + 1];
        normals[triPtr * 9 + 8] = nrm[i3 + 2];
      }
      triPtr++;
    }
  });

  return {
    vertices: vertices,
    normals: normals,
    triangleCount: triPtr,
    meshCount: result.meshes.length
  };
}

// ─── Apply köprüsü ─────────────────────────────────────────────────────────
var VE_FEA_STEP_MAX_PERSIST_BYTES = 10 * 1024 * 1024; // 10 MB

function veFEAApplySTEP(nodeId, buffer, fileName) {
  var byteLength = (buffer && buffer.byteLength) || 0;
  if (typeof showToast === 'function') {
    showToast('STEP dosyası işleniyor: ' + (fileName || '?') + ' (' + (byteLength / 1024).toFixed(0) + ' KB)...', 'info');
  }

  veFEAParseSTEPBuffer(buffer).then(function(result) {
    var parsed = veFEAStepMeshesToParsed(result);
    if (!parsed || parsed.triangleCount === 0) {
      if (typeof showToast === 'function') showToast('STEP geometrisi boş veya çözümlenemedi', 'error');
      return;
    }

    var viewer = veFEAViewerRegistry[nodeId];
    // STL ile aynı mesh builder'ı kullan — parsed formatı uyumlu
    if (viewer && typeof viewer.loadSTL === 'function') viewer.loadSTL(parsed);

    var stats = (typeof veFEAComputeMeshStats === 'function')
      ? veFEAComputeMeshStats(parsed)
      : { volume: 0, surfaceArea: 0, bbox: { x: 0, y: 0, z: 0 } };

    var canPersist = byteLength > 0 && byteLength <= VE_FEA_STEP_MAX_PERSIST_BYTES;

    if (typeof nodes !== 'undefined') {
      var node = nodes.find && nodes.find(function(n) { return n.id === nodeId; });
      if (node) {
        node.data = node.data || {};
        node.data.geometry = {
          type: 'step',
          sourceLabel: fileName || 'STEP',
          triangleCount: parsed.triangleCount,
          meshCount: parsed.meshCount || 1,
          fileSize: byteLength,
          volume: stats.volume,
          surfaceArea: stats.surfaceArea,
          bbox: stats.bbox,
          rawDataB64: canPersist && typeof veFEAArrayBufferToBase64 === 'function'
            ? veFEAArrayBufferToBase64(buffer) : null,
          persistNote: canPersist
            ? null
            : ('Dosya ' + (byteLength / (1024 * 1024)).toFixed(1) + ' MB — proje kaydında saklanmıyor, yeniden yükleyin.')
        };
        if (typeof saveState === 'function') saveState();
      }
    }

    if (typeof showToast === 'function') {
      showToast('STEP yüklendi: ' + (fileName || '?') + ' (' + parsed.triangleCount + ' üçgen)', 'success');
    }
    if (typeof showNodeProperties === 'function' && typeof nodes !== 'undefined') {
      var n = nodes.find && nodes.find(function(x) { return x.id === nodeId; });
      if (n) showNodeProperties(n);
    }
  }).catch(function(err) {
    var msg = (err && err.message) ? err.message : String(err);
    if (typeof showToast === 'function') showToast('STEP hatası: ' + msg, 'error');
    console.error('[FEA STEP]', err);
  });
}

// File input change handler — cp-fea.js HTML'inden çağrılır
function veFEAOnSTEPFileSelected(input, nodeId) {
  if (!input || !input.files || !input.files[0]) return;
  var file = input.files[0];
  var reader = new FileReader();
  reader.onload = function(e) {
    veFEAApplySTEP(nodeId, e.target.result, file.name);
  };
  reader.onerror = function() {
    if (typeof showToast === 'function') showToast('Dosya okunamadı: ' + file.name, 'error');
  };
  reader.readAsArrayBuffer(file);
  input.value = '';
}
