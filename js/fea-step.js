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
//
// Ortak yardımcılar (eski fea-stl.js'ten taşındı):
//   veFEAComputeMeshStats(parsed)        → { volume, surfaceArea, bbox }
//   veFEABuildTriangleMesh(parsed)       → THREE.Mesh (parsed triangles)
//   veFEAArrayBufferToBase64(buf)        → string
//   veFEABase64ToArrayBuffer(b64)        → ArrayBuffer
// ============================================================================

// ─── Mesh istatistikleri (hacim, alan, bbox) ──────────────────────────────
// Hacim: divergence teoremi (kapalı yüzey için).
// Yüzey alanı: her üçgenin (1/2)|(v2-v1) × (v3-v1)|.
// Bounding box: tüm vertex'lerin min/max.
function veFEAComputeMeshStats(parsed) {
  if(!parsed || !parsed.vertices || parsed.triangleCount === 0) {
    return { volume: 0, surfaceArea: 0, bbox: { x: 0, y: 0, z: 0 } };
  }
  var v = parsed.vertices;
  var n = parsed.triangleCount;
  var volume = 0;
  var surfaceArea = 0;
  var minX = Infinity, minY = Infinity, minZ = Infinity;
  var maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
  for(var i = 0; i < n; i++) {
    var o = i * 9;
    var x1 = v[o], y1 = v[o+1], z1 = v[o+2];
    var x2 = v[o+3], y2 = v[o+4], z2 = v[o+5];
    var x3 = v[o+6], y3 = v[o+7], z3 = v[o+8];
    if(x1 < minX) minX = x1; if(x1 > maxX) maxX = x1;
    if(x2 < minX) minX = x2; if(x2 > maxX) maxX = x2;
    if(x3 < minX) minX = x3; if(x3 > maxX) maxX = x3;
    if(y1 < minY) minY = y1; if(y1 > maxY) maxY = y1;
    if(y2 < minY) minY = y2; if(y2 > maxY) maxY = y2;
    if(y3 < minY) minY = y3; if(y3 > maxY) maxY = y3;
    if(z1 < minZ) minZ = z1; if(z1 > maxZ) maxZ = z1;
    if(z2 < minZ) minZ = z2; if(z2 > maxZ) maxZ = z2;
    if(z3 < minZ) minZ = z3; if(z3 > maxZ) maxZ = z3;
    volume += (x1 * (y2 * z3 - y3 * z2) + x2 * (y3 * z1 - y1 * z3) + x3 * (y1 * z2 - y2 * z1)) / 6;
    var ax = x2 - x1, ay = y2 - y1, az = z2 - z1;
    var bx = x3 - x1, by = y3 - y1, bz = z3 - z1;
    var cx = ay * bz - az * by;
    var cy = az * bx - ax * bz;
    var cz = ax * by - ay * bx;
    surfaceArea += Math.sqrt(cx * cx + cy * cy + cz * cz) / 2;
  }
  return {
    volume: Math.abs(volume),
    surfaceArea: surfaceArea,
    bbox: { x: maxX - minX, y: maxY - minY, z: maxZ - minZ }
  };
}

// ─── Three.js üçgen mesh inşası (parsed → THREE.Mesh) ─────────────────────
function veFEABuildTriangleMesh(parsed) {
  if(typeof THREE === 'undefined' || !parsed || parsed.triangleCount === 0) return null;
  var geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(parsed.vertices, 3));
  if(parsed.normals && parsed.normals.length === parsed.vertices.length) {
    geometry.setAttribute('normal', new THREE.BufferAttribute(parsed.normals, 3));
  } else {
    geometry.computeVertexNormals();
  }
  var material = new THREE.MeshStandardMaterial({
    color: 0x3b82f6,
    metalness: 0.3,
    roughness: 0.55,
    flatShading: true,
    side: THREE.DoubleSide
  });
  var mesh = new THREE.Mesh(geometry, material);
  mesh.userData.feaTriangleMesh = true;
  return mesh;
}

// ─── Base64 yardımcıları (state.js save/load için) ────────────────────────
function veFEAArrayBufferToBase64(buffer) {
  var bytes = (buffer instanceof Uint8Array) ? buffer : new Uint8Array(buffer);
  var chunkSize = 0x8000;
  var binary = '';
  for(var i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, Math.min(i + chunkSize, bytes.length)));
  }
  if(typeof btoa === 'function') return btoa(binary);
  return Buffer.from(binary, 'binary').toString('base64');
}
function veFEABase64ToArrayBuffer(b64) {
  var binary;
  if(typeof atob === 'function') binary = atob(b64);
  else binary = Buffer.from(b64, 'base64').toString('binary');
  var buffer = new ArrayBuffer(binary.length);
  var bytes = new Uint8Array(buffer);
  for(var i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return buffer;
}

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

// OCCT result'ından { vertices, normals, triangleCount } formatına dönüştür
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
    // Triangle mesh builder ile yükle
    if (viewer && typeof viewer.loadTriangleMesh === 'function') viewer.loadTriangleMesh(parsed);

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
          // Parsed mesh — topology motoru için (transient, persist edilmez)
          parsedMesh: parsed,
          rawDataB64: canPersist && typeof veFEAArrayBufferToBase64 === 'function'
            ? veFEAArrayBufferToBase64(buffer) : null,
          persistNote: canPersist
            ? null
            : ('Dosya ' + (byteLength / (1024 * 1024)).toFixed(1) + ' MB — proje kaydında saklanmıyor, yeniden yükleyin.')
        };
        // ANSYS-style yuzey ozelliklerini tespit et (akilli mesh stratejisi icin)
        if (typeof veFEADetectGeometryFeatures === 'function') {
          try {
            var detected = veFEADetectGeometryFeatures(parsed);
            if (detected) {
              // Triangle ID listeleri buyuk olabilir, sadece ozet kayit
              node.data.geometry.detectedFeatures = {
                features: detected.features.map(function (f) {
                  var copy = {};
                  Object.keys(f).forEach(function (k) {
                    if (k !== 'triangleIds') copy[k] = f[k];
                  });
                  copy.triangleCount = (f.triangleIds || []).length;
                  return copy;
                }),
                summary: detected.summary,
                edgeStats: detected.edgeStats,
                totalArea: detected.totalArea,
                bbox: detected.bbox
              };
            }
          } catch (err) { /* tespit basarisiz olursa fallback'e dus */ }
        }
        if (typeof veFEAComputeGeometryTopology === 'function') {
          node.data.geometry.topology = veFEAComputeGeometryTopology(node.data.geometry);
        }
        // parsedMesh sadece topology hesaplaması için gerekti — proje kaydında
        // saklanmaması için temizle (rawDataB64 var, yeniden parse edilebilir).
        delete node.data.geometry.parsedMesh;
        if (typeof saveState === 'function') saveState();
      }
    }

    if (typeof showToast === 'function') {
      showToast('STEP yüklendi: ' + (fileName || '?') + ' (' + parsed.triangleCount + ' üçgen)', 'success');
    }
    // Canvas preserve-across-render: veFEAApplyPrimitive'deki açıklamaya
    // bak. WebGL context churn'ünü önlemek için canvas elementini detach +
    // re-render + re-attach.
    var canvasId = 've-fea-geom-canvas-' + nodeId;
    var savedCanvas = document.getElementById(canvasId);
    var savedParent = savedCanvas ? savedCanvas.parentNode : null;
    if (savedCanvas && savedParent) {
      savedParent.removeChild(savedCanvas);
    }
    if (typeof showNodeProperties === 'function' && typeof nodes !== 'undefined') {
      var n = nodes.find && nodes.find(function(x) { return x.id === nodeId; });
      if (n) showNodeProperties(n);
    }
    if (savedCanvas) {
      var placeholder = document.getElementById(canvasId);
      if (placeholder && placeholder.parentNode) {
        placeholder.parentNode.replaceChild(savedCanvas, placeholder);
      }
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
