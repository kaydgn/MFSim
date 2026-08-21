// ============================================================================
//  YAPISAL ANALİZ — GEOMETRİ KÖPRÜSÜ (STEP içe aktarma)
// ============================================================================
// Üç katmanın ORTASI (bkz. cp-structural.js başlığı ve CLAUDE.md):
//
//   vendor/occt-import-js.*  HESAP ÇEKİRDEĞİ — DIŞARIDAN GELDİ, BİREBİR DURUR.
//                            OpenCascade'in emscripten arayüzü. B-rep okur,
//                            üçgenler ve CAD yüz aralıkları döner.
//   js/structural-model.js   BU DOSYA. KÖPRÜ: ham occt çıktısını MFSim'in
//                            modeline çevirir, yüz kimliğini kurar, hatayı
//                            Türkçeleştirir. DOM'suz, saf.
//   js/cp-structural.js      SUNUM. Yalnız HTML kurar; kendi geometrisini
//                            HESAPLAMAZ.
//
// ── VENDORLU KÜTÜPHANE DOKUNULMAZ ───────────────────────────────────────────
// `vendor/occt-import-js.js` MFSim içinde yazılmadı ve MFSim stiline
// ÇEVRİLMEZ — `js/fead-core.js` ile aynı kural, aynı gerekçe: değeri OCCT'nin
// B-rep çekirdeğini birebir üretmesi, stil uyarlaması sırasındaki tek bir
// hata "okunan ama yanlış" bir geometri üretir. Güncelleme de dışarıdan gelir
// (npm: occt-import-js). Lisans LGPL-2.1 (MFSim MIT) → kütüphane AYRI ve
// DEĞİŞTİRİLEBİLİR bir dosya olarak duruyor, tek dosyaya gömülmüyor.
//
// ── WASM `wasmBinary` İLE VERİLİR, `locateFile` İLE DEĞİL ───────────────────
// Emscripten glue'u .wasm yolunu normalde `document.currentScript.src`'den
// tahmin eder. MFSim'in TEK DOSYA sürümünde (MFSim_Code.html) bütün script'ler
// INLINE'dır → `currentScript.src` yoktur ve tahmin sessizce yanlış yere gider.
// Bu yüzden .wasm'ı KENDİMİZ getirip ArrayBuffer olarak veriyoruz: yol arama
// bizim elimizde, hata mesajı bizim dilimizde, aday yollar sırayla denenebilir.
//
// ── ÖLÇÜLDÜ: YÜZ KİMLİĞİ AĞ İNCELİĞİNDEN BAĞIMSIZ ──────────────────────────
// Bu modülün EN KRİTİK özelliği. Sınır koşulu mesh düğümüne değil CAD YÜZÜNE
// bağlanacak (CLAUDE.md); yakınsama çalışması ise ağı defalarca yeniler. Yüz
// kimliği ağ inceliğiyle değişseydi her yenilemede bütün sınır koşulları
// düşerdi. `brep_faces` bunu sağlıyor — üç ayrı incelikte ölçüldü:
//
//   as1-tu-203.stp   defl 0.001 → 4688 üçgen / 160 yüz
//                    defl 0.01  → 4408 üçgen / 160 yüz
//                    defl 0.1   → 2456 üçgen / 160 yüz
//   → yüz KİMLİKLERİ üçünde de AYNI, yüz başına ÜÇGEN sayısı değişiyor.
//
// Kapı: tests/unit/structural-model.test.js bunu iki dosyada da koşturuyor.
//
// ── ÖLÇÜLDÜ: BİRİM ÇEVRİMİ OCCT'DE DOĞRU, REGEX'LE OKUNMAZ ─────────────────
// Aynı küp mm / inch / metre birimleriyle yazılmış üç STEP dosyasında da
// occt 1000.0000 mm veriyor — yani dosyanın kendi birimini okuyup mm'ye
// çeviriyor. Sessiz 25.4× hatası YOK.
// STEP başlığından birimi regex ile okuma denendi ve BIRAKILDI: `cube-m.step`
// hiçbir `SI_UNIT(...METRE)` kalıbına uymuyor (birim dolaylı tanımlı). Yanlış
// okuyan bir regex, doğru çalışan bir çevrimin üstüne yanlış künye basardı.
// Biz yalnız İSTENEN çıktı birimini (millimeter) kaydediyoruz — MFSim'in UI
// birimi de mm.
// ----------------------------------------------------------------------------

// İstenen çıktı birimi. MFSim'in yapısal analiz UI birimi mm (CLAUDE.md).
var VE_STR_GEOM_UNIT = 'millimeter';

// Ağ inceliği varsayılanı. `bounding_box_ratio` → değer, parçanın ortalama
// sınır kutusuna ORANDIR; yani küçük bir braket ile büyük bir şasi aynı
// göreli kalitede üçgenlenir. Mutlak değer verilseydi (absolute_value) aynı
// sayı küçük parçayı aşırı, büyüğü yetersiz bölerdi.
//
// DİKKAT — BU AĞ FEA AĞI DEĞİL: OCCT'nin RENDER tessellation'ıdır, yalnız
// GÖRÜNTÜLEMEK ve yüz aralıklarını kurmak içindir. CLAUDE.md'de ölçüldü:
// bu üçgenlerin min açısı 2.81° ve parametreyi sıkmak İYİLEŞTİRMİYOR,
// BOZUYOR (2.50° → 0.14°, tet 11.8k → 1.32M). Hesaplama Ağı bileşeni araya
// yüzey yeniden-mesh'leme koyacak; buradaki üçgen doğrudan TetGen'e GİTMEZ.
var VE_STR_GEOM_DEFLECTION = { type: 'bounding_box_ratio', linear: 0.002, angular: 0.5 };

// .wasm aday yolları — SIRAYLA denenir, ilk tutan kazanır.
//   vendor/…      : index.html (modüler) ve `npx serve` ile kök dizinden servis
//   ./vendor/…    : alt dizinden servis edilen kurulum
//   occt-…        : .wasm MFSim_Code.html'in YANINA konmuşsa (tek dosya sürümü)
// Tek dosya sürümü .wasm'ı İÇİNDE TAŞIMAZ (7.3 MB + LGPL) — yanında bulamazsa
// sebebini yazar, sessizce boş kalmaz.
var VE_STR_OCCT_WASM_PATHS = ['vendor/occt-import-js.wasm', './vendor/occt-import-js.wasm', 'occt-import-js.wasm'];

// Tek seferlik yükleme sözü. İkinci çağrı aynı sözü döner → 7.3 MB iki kez
// indirilmez, WASM iki kez derlenmez.
var _sgOcctPromise = null;

function _sgNum(v){
  if(v === null || v === undefined || v === '') return NaN;
  var n = Number(v);
  return isFinite(n) ? n : NaN;
}

// occt fabrikasını bul: tarayıcıda vendorlu script global `occtimportjs`
// bırakır; Node'da (testler) require ile alınır.
function _sgOcctFactory(){
  if(typeof occtimportjs !== 'undefined') return occtimportjs;
  if(typeof window !== 'undefined' && window.occtimportjs) return window.occtimportjs;
  if(typeof require === 'function'){
    try { return require('../vendor/occt-import-js.js'); } catch(e){}
  }
  return null;
}

// .wasm'ı aday yollardan getir. Hangi yolun tuttuğunu döner ki panel bunu
// yazabilsin (bir kurulumda neden çalışmadığı ancak böyle anlaşılır).
function _sgFetchWasm(paths){
  var list = (paths && paths.length) ? paths.slice() : VE_STR_OCCT_WASM_PATHS.slice();
  var tried = [];
  function next(){
    if(!list.length){
      return Promise.reject(new Error('STEP okuyucusu (occt-import-js.wasm) bulunamadı. Denenen yollar: ' + tried.join(', ')));
    }
    var url = list.shift();
    tried.push(url);
    return fetch(url).then(function(res){
      if(!res.ok) throw new Error(res.status + ' ' + res.statusText);
      return res.arrayBuffer();
    }).then(function(buf){
      return { buffer: buf, url: url };
    })['catch'](function(){ return next(); });
  }
  return next();
}

// STEP okuyucusunu TALEP ÜZERİNE yükler (7.3 MB — açılışta yüklenmez).
// opts.wasmUrls   : aday yolları ez (test/kurulum)
// opts.factory    : occt fabrikasını ez (test)
// opts.wasmBinary : .wasm'ı doğrudan ver (Node testleri — fetch yok)
function veStrOcctReady(opts){
  opts = opts || {};
  if(_sgOcctPromise && !opts.force) return _sgOcctPromise;

  var factory = opts.factory || _sgOcctFactory();
  if(!factory){
    return Promise.reject(new Error('STEP okuyucusu yüklenemedi: vendor/occt-import-js.js sayfaya eklenmemiş.'));
  }

  var p;
  if(opts.wasmBinary){
    p = Promise.resolve({ buffer: opts.wasmBinary, url: '(bellek)' });
  } else if(typeof fetch !== 'function'){
    p = Promise.reject(new Error('STEP okuyucusu yüklenemedi: bu ortamda fetch yok.'));
  } else {
    p = _sgFetchWasm(opts.wasmUrls);
  }

  // OCCT kendi teşhisini stdout'a yazar ("Line 2: Incorrect syntax: unexpected
  // QUID, expecting STEP" gibi). Varsayılanda bu console'a düşer ve KULLANICI
  // GÖRMEZ — kullanıcı yalnız "dosya okunamadı" der. Oysa okuyanın ihtiyacı
  // olan tek şey o satırdır. Yakalanıp hata mesajına ekleniyor (ham İngilizce:
  // kütüphanenin kendi teşhisi, çevirmek yanlış tercüme riski demek).
  var log = [];
  var out = p.then(function(got){
    return factory({
      wasmBinary: got.buffer,
      print: function(s){ log.push(String(s)); },
      printErr: function(s){ log.push(String(s)); }
    }).then(function(occt){
      occt._veWasmUrl = got.url;
      occt._veLog = log;
      return occt;
    });
  });

  if(!opts.force) _sgOcctPromise = out;
  // Yükleme başarısızsa sözü UNUT: kullanıcı .wasm'ı yerine koyup yeniden
  // denediğinde ilk denemenin hatası sonsuza kadar yapışmasın.
  out['catch'](function(){ if(_sgOcctPromise === out) _sgOcctPromise = null; });
  return out;
}

// OCCT'nin ham teşhisini hata mesajına iliştirir. Gürültüyü eler ("ERR
// StepFile :" öneki, boş satır, tekrar) ve en fazla iki satır alır — panelin
// durum satırı tek cümlelik, oraya on satır dökmek sebebi gizlerdi.
function _sgWithDiag(msg, log){
  if(!log || !log.length) return msg;
  var seen = {}, keep = [];
  for(var i = 0; i < log.length && keep.length < 2; i++){
    var s = String(log[i]).replace(/^\s*\*+\s*/, '').replace(/\s*\*+\s*$/, '').trim();
    s = s.replace(/^ERR\s+\w+\s*:\s*/i, '').replace(/^Undefined\s+/i, '').trim();
    if(!s || seen[s]) continue;
    seen[s] = 1;
    keep.push(s);
  }
  return keep.length ? (msg + ' — okuyucunun teşhisi: ' + keep.join(' / ')) : msg;
}

// Yüklenmiş okuyucuyu BIRAK. İki kullanımı var: (a) kullanıcı .wasm'ı yerine
// koyup yeniden denemek istediğinde önbelleğe alınmış sözü temizlemek,
// (b) testlerde derlenmiş WASM örneğinin (7.3 MB) suite sonunda toplanabilmesi
// — yoksa jest worker'ı teardown'da zorla kapatılıyor.
function veStrOcctForget(){
  _sgOcctPromise = null;
}

// ─── Yüz kimliği ────────────────────────────────────────────────────────────
// Sınır koşulu bu dizgiye bağlanacak. mesh indisi + yüz indisi: ikisi de
// OCCT'nin B-rep gezinme sırasından gelir ve ağ inceliğiyle DEĞİŞMEZ (yukarıda
// ölçüldü). Ağ düğümü indisine bağlanmanın neden yanlış olduğu CLAUDE.md'de.
function veStrFaceKey(meshIndex, faceIndex){
  return 'm' + meshIndex + '/f' + faceIndex;
}

// ─── Sınır kutusu ───────────────────────────────────────────────────────────
// Kamerayı çerçevelemek, ölçek yazmak ve "parça gerçekten geldi mi" demek için.
function veStrGeomBBox(meshes){
  var mn = [Infinity, Infinity, Infinity], mx = [-Infinity, -Infinity, -Infinity];
  (meshes || []).forEach(function(m){
    var p = m.positions;
    if(!p) return;
    for(var i = 0; i < p.length; i += 3){
      for(var k = 0; k < 3; k++){
        var v = p[i + k];
        if(v < mn[k]) mn[k] = v;
        if(v > mx[k]) mx[k] = v;
      }
    }
  });
  if(!isFinite(mn[0])) return null;
  var size = [mx[0] - mn[0], mx[1] - mn[1], mx[2] - mn[2]];
  return {
    min: mn, max: mx, size: size,
    center: [(mn[0] + mx[0]) / 2, (mn[1] + mx[1]) / 2, (mn[2] + mx[2]) / 2],
    diag: Math.sqrt(size[0] * size[0] + size[1] * size[1] + size[2] * size[2])
  };
}

// ─── Ham occt çıktısı → MFSim modeli ───────────────────────────────────────
// SAF: DOM yok, THREE yok, yan etki yok. Testler bunu doğrudan koşturuyor.
//
// Tipli diziye ÇEVİRİYOR (Float32Array/Uint32Array): occt düz JS dizisi döner,
// bir braketin 100 bin üçgeninde bu dizi 2.4 MB'lık kutulanmış sayı demektir;
// THREE'ye vermeden önce zaten çevrilecek — bir kez, burada.
function veStrNormalizeImport(raw, meta){
  meta = meta || {};
  if(!raw || !raw.success){
    return { ok: false, error: 'Dosya STEP olarak okunamadı. Dosya bozuk olabilir ya da desteklenmeyen bir sürümde yazılmış olabilir.' };
  }
  var rawMeshes = raw.meshes || [];
  if(!rawMeshes.length){
    return { ok: false, error: 'STEP dosyası okundu ama içinde katı/yüzey geometrisi yok (yalnız eğri, nokta ya da boş montaj olabilir).' };
  }

  var meshes = [], faces = [];
  var triTotal = 0, vtxTotal = 0;

  rawMeshes.forEach(function(m, mi){
    var pos = (m.attributes && m.attributes.position && m.attributes.position.array) || [];
    var nrm = (m.attributes && m.attributes.normal && m.attributes.normal.array) || null;
    var idx = (m.index && m.index.array) || [];
    var triCount = Math.floor(idx.length / 3);
    var name = (m.name && String(m.name).trim()) || ('Parça ' + (mi + 1));

    var mFaces = [];
    (m.brep_faces || []).forEach(function(f, fi){
      var first = _sgNum(f.first), last = _sgNum(f.last);
      if(!isFinite(first) || !isFinite(last)) return;
      var rec = {
        id: veStrFaceKey(mi, fi),
        meshIndex: mi, meshName: name, faceIndex: fi,
        first: first, last: last,
        triCount: (last - first + 1),
        color: f.color || null
      };
      mFaces.push(rec);
      faces.push(rec);
    });

    meshes.push({
      index: mi, name: name,
      color: m.color || null,
      positions: new Float32Array(pos),
      normals: nrm ? new Float32Array(nrm) : null,
      indices: new Uint32Array(idx),
      triCount: triCount,
      faces: mFaces
    });
    triTotal += triCount;
    vtxTotal += Math.floor(pos.length / 3);
  });

  var bbox = veStrGeomBBox(meshes);
  return {
    ok: true,
    fileName: meta.fileName || '',
    fileSize: _sgNum(meta.fileSize) || 0,
    importedAt: meta.importedAt || null,
    unit: VE_STR_GEOM_UNIT,
    deflection: meta.deflection || VE_STR_GEOM_DEFLECTION,
    wasmUrl: meta.wasmUrl || '',
    root: raw.root || null,
    meshes: meshes,
    faces: faces,
    bbox: bbox,
    stats: {
      meshCount: meshes.length,
      triCount: triTotal,
      vertexCount: vtxTotal,
      faceCount: faces.length
    }
  };
}

// Üçgen indisinden CAD yüzünü bul. Sınır Koşulları bileşeni yüz seçerken
// bunu kullanacak; şimdilik görüntüleyicinin fare vurgusu kullanıyor —
// yani zincir prototipte de CANLI, sonradan eklenen bir varsayım değil.
function veStrFaceOfTriangle(geom, meshIndex, triIndex){
  if(!geom || !geom.meshes || !geom.meshes[meshIndex]) return null;
  var fs = geom.meshes[meshIndex].faces || [];
  for(var i = 0; i < fs.length; i++){
    if(triIndex >= fs[i].first && triIndex <= fs[i].last) return fs[i];
  }
  return null;
}

// ─── Kalıcı künye ───────────────────────────────────────────────────────────
// node.data'ya YAZILAN kayıt. Üçgenler BURAYA GİRMEZ: bir braketin 100 bin
// üçgeni JSON'a çevrilince onlarca MB olur, üstelik alt-topolojiye GÖMÜLÜR
// (veSanitizeEmbeddedState'in hafifletmeye çalıştığı çarpımsal büyümenin ta
// kendisi). Ağır olan iki şey ayrı yerde durur:
//   • STEP KAYNAĞI  → node.data.geometry.source (kullanıcı isterse; asıl gerçek)
//   • ÜÇGENLER      → oturumluk önbellek (window.veStrGeometryCache)
// Üçgen zaten TÜRETİLMİŞ veridir: kaynaktan her an yeniden üretilir ve
// yakınsama çalışması için ZATEN farklı inceliklerde yeniden üretilecek.
function veStrGeomRecord(geom){
  if(!geom || !geom.ok) return null;
  return {
    fileName: geom.fileName,
    fileSize: geom.fileSize,
    importedAt: geom.importedAt,
    unit: geom.unit,
    deflection: geom.deflection,
    stats: geom.stats,
    bbox: geom.bbox,
    // Yüz künyesi HAFİF: kimlik + üçgen sayısı. Sınır koşulu kimliğe bağlanır,
    // üçgen sayısı yalnız "aynı dosya mı" denetimi için.
    faces: (geom.faces || []).map(function(f){
      return { id: f.id, meshName: f.meshName, triCount: f.triCount };
    })
  };
}

// ─── Oturumluk üçgen önbelleği ──────────────────────────────────────────────
// Takoz'un veMountResults'ı ve FEAD'in veFeadResults'ı ile AYNI kalıp ve AYNI
// TUZAK: proje değişince temizlenmezse yeni projede önceki projenin parçası
// görüntüleyicide durur. Kanca cp-structural.js _strForgetResults'ta.
function veStrGeomCacheSet(nodeId, geom){
  if(typeof window === 'undefined') return;
  if(!window.veStrGeometryCache) window.veStrGeometryCache = {};
  window.veStrGeometryCache[nodeId] = geom;
}
function veStrGeomCacheGet(nodeId){
  if(typeof window === 'undefined' || !window.veStrGeometryCache) return null;
  return window.veStrGeometryCache[nodeId] || null;
}
function veStrGeomCacheClear(nodeId){
  if(typeof window === 'undefined' || !window.veStrGeometryCache) return;
  if(nodeId) delete window.veStrGeometryCache[nodeId];
  else window.veStrGeometryCache = {};
}

// ─── Uçtan uca içe aktarma ──────────────────────────────────────────────────
// Dosya içeriği (Uint8Array) → normalize model. Tek giriş noktası: sunum
// katmanı occt'yi doğrudan çağırmaz.
function veStrImportStep(bytes, meta, opts){
  meta = meta || {};
  opts = opts || {};
  var defl = meta.deflection || VE_STR_GEOM_DEFLECTION;
  return veStrOcctReady(opts).then(function(occt){
    var params = {
      linearUnit: VE_STR_GEOM_UNIT,
      linearDeflectionType: defl.type,
      linearDeflection: defl.linear,
      angularDeflection: defl.angular
    };
    // Teşhis tamponunu bu okumadan ÖNCE boşalt: önceki dosyanın hatası bu
    // dosyanın mesajına yapışmasın.
    if(occt._veLog) occt._veLog.length = 0;
    var raw;
    try {
      raw = occt.ReadStepFile(bytes, params);
    } catch(e){
      return { ok: false, error: 'STEP okuyucusu dosyayı işlerken durdu: ' + (e && e.message ? e.message : e) };
    }
    meta.wasmUrl = occt._veWasmUrl || '';
    meta.deflection = defl;
    var res = veStrNormalizeImport(raw, meta);
    if(!res.ok) res.error = _sgWithDiag(res.error, occt._veLog);
    return res;
  })['catch'](function(e){
    return { ok: false, error: (e && e.message) ? e.message : String(e) };
  });
}

// ── Test köprüsü ────────────────────────────────────────────────────────────
// Tarayıcıda düz <script>; Node'da testler require ile alır. Üst-seviye
// bildirim EKLEMEZ → source-hygiene kapısına takılmaz.
if(typeof module !== 'undefined' && module.exports) {
  module.exports = {
    VE_STR_GEOM_UNIT: VE_STR_GEOM_UNIT,
    VE_STR_GEOM_DEFLECTION: VE_STR_GEOM_DEFLECTION,
    VE_STR_OCCT_WASM_PATHS: VE_STR_OCCT_WASM_PATHS,
    veStrOcctReady: veStrOcctReady,
    veStrOcctForget: veStrOcctForget,
    veStrFaceKey: veStrFaceKey,
    veStrGeomBBox: veStrGeomBBox,
    veStrNormalizeImport: veStrNormalizeImport,
    veStrFaceOfTriangle: veStrFaceOfTriangle,
    veStrGeomRecord: veStrGeomRecord,
    veStrGeomCacheSet: veStrGeomCacheSet,
    veStrGeomCacheGet: veStrGeomCacheGet,
    veStrGeomCacheClear: veStrGeomCacheClear,
    veStrImportStep: veStrImportStep,
    _sgWithDiag: _sgWithDiag
  };
}
