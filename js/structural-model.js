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

// Tipli diziye çevir — ZATEN doğru tipteyse olduğu gibi bırak. Worker yolunda
// diziler tipli geliyor; `new Float32Array(f32)` onları gereksizce kopyalardı.
function _sgTyped(Ctor, arr){
  if(arr === null || arr === undefined) return null;
  return (arr instanceof Ctor) ? arr : new Ctor(arr);
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

// ─── İLERLEME AŞAMALARI ─────────────────────────────────────────────────────
// Panel bu adlara göre yazı ve çubuk seçiyor. YALNIZ İLKİ BELİRLİ (%):
// indirilen bayt gerçekten sayılabiliyor. Diğer üçü OCCT'nin içinde tek bir
// çağrı; oraya uydurma bir yüzde koymak — "%60" deyip 8 saniye beklemek —
// kullanıcıya yalan söylemek olurdu. Belirsiz aşamada akan bir çubuk + geçen
// süre gösteriliyor.
var VE_STR_STAGES = ['download', 'compile', 'parse', 'build'];

// `vendor/occt-import-js.wasm`'ın AÇILMIŞ boyutu. Yüzde bunun üzerinden
// hesaplanıyor çünkü `Content-Length` GÜVENİLMEZ — ÖLÇÜLDÜ: hem `npx serve`
// hem GitHub Pages bu dosyayı `content-encoding: br` + `transfer-encoding:
// chunked` ile gönderiyor, o durumda başlık HİÇ GELMİYOR (tarayıcıda
// `headers.get('content-length')` → null). Yani tam da yayına çıkan kurulumda
// yüzde asla görünmezdi.
//
// `fetch` gövdeyi saydam biçimde açtığı için okunan baytlar AÇILMIŞ baytlardır
// → bu sabitle karşılaştırmak doğru. Sabit dosyayla birlikte kaymasın diye
// tests/unit/structural-model.test.js gerçek dosya boyutuna KİLİTLİYOR.
var VE_STR_OCCT_WASM_BYTES = 7604031;

// .wasm'ı aday yollardan İLERLEME BİLDİREREK getir. Hangi yolun tuttuğunu da
// döner ki panel bunu yazabilsin (bir kurulumda neden çalışmadığı ancak böyle
// anlaşılır).
function _sgFetchWasm(paths, onProgress, expectedBytes){
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
      var hdr = Number(res.headers && res.headers.get && res.headers.get('content-length')) || 0;
      // Başlık yoksa (br/chunked — yayındaki normal durum) BEKLENEN boyutu
      // kullan. Yine de bilinmiyorsa akış devam eder, yalnız yüzde olmaz.
      var total = hdr || Number(expectedBytes) || 0;
      // Akış okunamıyorsa (eski tarayıcı) BELİRSİZ ilerlemeye düş — indirme
      // yine çalışır.
      if(!res.body || typeof res.body.getReader !== 'function'){
        if(onProgress) onProgress('download', { loaded: 0, total: total, pct: null });
        return res.arrayBuffer();
      }
      var reader = res.body.getReader();
      var chunks = [], loaded = 0;
      return (function pump(){
        return reader.read().then(function(r){
          if(r.done){
            var all = new Uint8Array(loaded), o = 0;
            for(var i = 0; i < chunks.length; i++){ all.set(chunks[i], o); o += chunks[i].length; }
            return all.buffer;
          }
          chunks.push(r.value);
          loaded += r.value.length;
          if(onProgress){
            // Tahminimiz tutmadıysa (dosya güncellenmiş, sabit kalmış) yüzde
            // GÖSTERİLMEZ: %140 yazan bir çubuk, çubuk olmamasından kötüdür.
            var pct = (total && loaded <= total) ? (loaded / total) : null;
            onProgress('download', { loaded: loaded, total: total, pct: pct });
          }
          return pump();
        });
      })();
    }).then(function(buf){
      return { buffer: buf, url: url };
    })['catch'](function(){ return next(); });
  }
  return next();
}

// ─── WORKER ─────────────────────────────────────────────────────────────────
// STEP çözümlemesi ANA İŞ PARÇACIĞINDA yapılmaz. Ölçüldü: 4 688 üçgenlik bir
// montaj 396 ms; gerçek bir braket bunun 10–50 katı olabilir, yani saniyelerce
// donmuş arayüz. Donma yalnız çirkin değil YANILTICI: kullanıcı programın
// çöktüğünü sanıp sekmeyi kapatır.
//
// PAKETİN KENDİ WORKER'I (`occt-import-js-worker.js`) KULLANILMIYOR — üç
// eksiği var: (a) `locateFile` ile GÖRELİ yol çözüyor, yani worker dosyasının
// glue'nun yanında durmasını şart koşuyor; MFSim'in tek dosya sürümünde o
// dosya yok. (b) ilerleme bildirmiyor. (c) sonucu KOPYALAYARAK geri veriyor;
// yüz binlerce üçgende bu ikinci bir maliyet.
//
// Bizimki BLOB'DAN kuruluyor: glue metni + aşağıdaki köprü tek bir Blob'a
// yazılıp `new Worker(blobURL)` ile açılıyor. Böylece hiçbir dosya yolu
// varsayımı yok — glue nereden geldiyse worker da oradan gelmiş oluyor.
var VE_STR_WORKER_BRIDGE = [
  'var _occt = null, _log = [];',
  'self.onmessage = function(e){',
  '  var d = e.data || {};',
  '  if(d.type === "init"){',
  '    try {',
  '      occtimportjs({ wasmBinary: d.wasmBinary,',
  '        print: function(s){ _log.push(String(s)); },',
  '        printErr: function(s){ _log.push(String(s)); } })',
  '      .then(function(m){ _occt = m; self.postMessage({ type:"ready" }); })',
  '      ["catch"](function(err){ self.postMessage({ type:"fatal", error:String((err && err.message) || err) }); });',
  '    } catch(err){ self.postMessage({ type:"fatal", error:String((err && err.message) || err) }); }',
  '    return;',
  '  }',
  '  if(d.type === "step"){',
  '    if(!_occt){ self.postMessage({ type:"error", id:d.id, error:"okuyucu hazır değil" }); return; }',
  '    _log.length = 0;',
  '    var raw;',
  '    try { raw = _occt.ReadStepFile(new Uint8Array(d.bytes), d.params); }',
  '    catch(err){ self.postMessage({ type:"error", id:d.id, error:String((err && err.message) || err), log:_log.slice(0,4) }); return; }',
  // Tipli diziye BURADA çevriliyor: ana iş parçacığına TRANSFER edilebilsin
  // diye. Kopyalanan bir düz JS dizisi yüz binlerce üçgende hem bellek hem
  // duraklama demek — transfer sıfır kopya.
  '    var out = { success: !!(raw && raw.success), root: (raw && raw.root) || null, meshes: [] };',
  '    var transfer = [];',
  '    var ms = (raw && raw.meshes) || [];',
  '    for(var i = 0; i < ms.length; i++){',
  '      var m = ms[i];',
  '      var a = m.attributes || {};',
  '      var pos = new Float32Array((a.position && a.position.array) || []);',
  '      var idx = new Uint32Array((m.index && m.index.array) || []);',
  '      var nrm = (a.normal && a.normal.array) ? new Float32Array(a.normal.array) : null;',
  '      transfer.push(pos.buffer, idx.buffer);',
  '      if(nrm) transfer.push(nrm.buffer);',
  '      out.meshes.push({ name:m.name, color:m.color || null, brep_faces:m.brep_faces || [],',
  '                        positions:pos, normals:nrm, indices:idx });',
  '    }',
  '    self.postMessage({ type:"result", id:d.id, raw:out, log:_log.slice(0,4) }, transfer);',
  '  }',
  '};'
].join('\n');

var _sgWorkerPromise = null;
var _sgWorkerUrl = '';
var _sgJobSeq = 0;

function _sgWorkerSupported(){
  return typeof Worker === 'function' && typeof Blob === 'function'
      && typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function'
      && typeof fetch === 'function';
}

// Glue metni .wasm ile AYNI dizinden alınır: yol araması bir kez yapılıp
// (wasm) sonucu buradan türetiliyor. İki ayrı arama iki ayrı kurulumda
// birbirinden ayrı düşebilirdi.
function _sgGlueUrlFor(wasmUrl){
  return String(wasmUrl).replace(/occt-import-js\.wasm(\?.*)?$/, 'occt-import-js.js');
}

// Worker'ı TEK SEFER kur ve yaşat: ikinci içe aktarma 7,3 MB'ı yeniden
// indirmez, WASM'ı yeniden derlemez.
function veStrOcctWorker(opts){
  opts = opts || {};
  if(_sgWorkerPromise && !opts.force) return _sgWorkerPromise;
  if(!_sgWorkerSupported()) return Promise.reject(new Error('Bu tarayıcıda Worker yok.'));

  var onp = opts.onProgress || function(){};
  var out = _sgFetchWasm(opts.wasmUrls, onp, opts.expectedBytes || VE_STR_OCCT_WASM_BYTES).then(function(got){
    onp('compile', {});
    return fetch(_sgGlueUrlFor(got.url)).then(function(res){
      if(!res.ok) throw new Error('STEP okuyucusunun kod dosyası bulunamadı: ' + _sgGlueUrlFor(got.url));
      return res.text();
    }).then(function(glue){
      var blob = new Blob([glue, '\n', VE_STR_WORKER_BRIDGE], { type: 'text/javascript' });
      var url = URL.createObjectURL(blob);
      var w = new Worker(url);
      // Blob URL'i KURULUMDAN HEMEN SONRA bırak: worker çalışmaya devam eder
      // (URL yalnız `new Worker` anında gerekli), tutulursa 96 KB'lık blob
      // her yeniden kurulumda bellekte birikirdi.
      try { URL.revokeObjectURL(url); } catch(e){}
      return new Promise(function(resolve, reject){
        function bitir(err){
          // Kurulum başarısızsa worker'ı ÖLDÜR — yaşayan bir worker WASM
          // belleğini tutmaya devam eder.
          try { w.terminate(); } catch(e2){}
          reject(err);
        }
        w.onmessage = function(e){
          if(e.data && e.data.type === 'ready'){ w.onmessage = null; w.onerror = null; resolve({ worker: w, wasmUrl: got.url }); }
          else if(e.data && e.data.type === 'fatal'){ bitir(new Error(e.data.error)); }
        };
        w.onerror = function(err){ bitir(new Error('STEP okuyucusu worker içinde açılamadı: ' + ((err && err.message) || 'bilinmeyen hata'))); };
        // .wasm TRANSFER EDİLMİYOR, kopyalanıyor: tek seferlik ~7 MB memcpy
        // ölçülemeyecek kadar ucuz, buna karşılık çağıranın tamponu
        // detach OLMUYOR (testler aynı tamponu yeniden kullanabiliyor).
        w.postMessage({ type: 'init', wasmBinary: got.buffer });
      });
    });
  });

  if(!opts.force) _sgWorkerPromise = out;
  // Kurulum başarısızsa sözü UNUT: kullanıcı dosyayı yerine koyup yeniden
  // denediğinde ilk denemenin hatası sonsuza kadar yapışmasın.
  out['catch'](function(){ if(_sgWorkerPromise === out) _sgWorkerPromise = null; });
  return out;
}

// Worker üzerinden içe aktar. Ana iş parçacığı BOŞTA kalır → panelin ilerleme
// animasyonu gerçekten akar (donmuş bir çubuk, çubuk olmamasından kötüdür).
function _sgImportViaWorker(bytes, meta, opts, onp){
  return veStrOcctWorker(opts).then(function(ctx){
    var id = ++_sgJobSeq;
    onp('parse', {});
    return new Promise(function(resolve, reject){
      function onMsg(e){
        var d = e.data || {};
        if(d.id !== id) return;
        ctx.worker.removeEventListener('message', onMsg);
        if(d.type === 'error'){ resolve({ ok: false, error: _sgWithDiag('STEP okuyucusu dosyayı işlerken durdu: ' + d.error, d.log) }); return; }
        if(d.type !== 'result'){ reject(new Error('Worker beklenmeyen yanıt verdi: ' + d.type)); return; }
        onp('build', {});
        meta.wasmUrl = ctx.wasmUrl;
        meta.worker = true;
        var res = veStrNormalizeImport(d.raw, meta);
        if(!res.ok) res.error = _sgWithDiag(res.error, d.log);
        resolve(res);
      }
      ctx.worker.addEventListener('message', onMsg);
      // STEP baytları TRANSFER EDİLİYOR (kopya yok). Çağıranın tamponu
      // detach olur; bu yüzden panel kaynağı ayrıca saklıyor.
      var copy = bytes.slice();
      ctx.worker.postMessage({ type: 'step', id: id, bytes: copy.buffer, params: meta._params }, [copy.buffer]);
    });
  });
}

// STEP okuyucusunu TALEP ÜZERİNE yükler (7.3 MB — açılışta yüklenmez).
// opts.wasmUrls   : aday yolları ez (test/kurulum)
// opts.factory    : occt fabrikasını ez (test)
// opts.wasmBinary : .wasm'ı doğrudan ver (Node testleri — fetch yok)
function veStrOcctReady(opts, onProgress){
  opts = opts || {};
  var onp = onProgress || opts.onProgress || function(){};
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
    p = _sgFetchWasm(opts.wasmUrls, onp, opts.expectedBytes || VE_STR_OCCT_WASM_BYTES);
  }
  p = p.then(function(got){ onp('compile', {}); return got; });

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
  // Worker'ı da kapat — yaşayan bir worker WASM belleğini (yüzlerce MB'a
  // çıkabilir) tutmaya devam eder. Blob URL'i de bırakılır.
  var wp = _sgWorkerPromise;
  _sgWorkerPromise = null;
  if(wp && wp.then){
    wp.then(function(ctx){ try { ctx.worker.terminate(); } catch(e){} })['catch'](function(){});
  }
  if(_sgWorkerUrl && typeof URL !== 'undefined' && URL.revokeObjectURL){
    try { URL.revokeObjectURL(_sgWorkerUrl); } catch(e){}
    _sgWorkerUrl = '';
  }
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
    // İKİ GİRDİ BİÇİMİ, TEK ÇIKTI. Worker yolunda diziler ZATEN tipli gelir
    // (orada çevrilip transfer edilirler); ana iş parçacığı yedeğinde occt'nin
    // düz JS dizileri gelir. `_sgTyped` ikisini de kabul eder ve tipli olanı
    // YENİDEN KOPYALAMAZ — 100 bin üçgende o kopya boşuna bir megabayt.
    var pos = _sgTyped(Float32Array, (m.positions) || (m.attributes && m.attributes.position && m.attributes.position.array) || []);
    var nrm = _sgTyped(Float32Array, (m.normals) || (m.attributes && m.attributes.normal && m.attributes.normal.array) || null);
    var idx = _sgTyped(Uint32Array, (m.indices) || (m.index && m.index.array) || []);
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
      positions: pos,
      normals: nrm,
      indices: idx,
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
    // Worker'da mı çözüldü? Panel bunu yazıyor: ana iş parçacığına düşülmüşse
    // kullanıcı donmanın SEBEBİNİ görmeli, "program ağır" sanmamalı.
    worker: !!meta.worker,
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

// Ana iş parçacığı YEDEĞİ. Worker olmayan ortamlarda (eski tarayıcı, jsdom
// altındaki birim testleri) kullanılır. Donma pahasına ÇALIŞIR — hiç
// çalışmamasından iyidir; panel bu yola düşüldüğünü künyeye yazıyor.
function _sgImportMainThread(bytes, meta, opts, onp){
  return veStrOcctReady(opts, onp).then(function(occt){
    onp('parse', {});
    // Teşhis tamponunu bu okumadan ÖNCE boşalt: önceki dosyanın hatası bu
    // dosyanın mesajına yapışmasın.
    if(occt._veLog) occt._veLog.length = 0;
    var raw;
    try {
      raw = occt.ReadStepFile(bytes, meta._params);
    } catch(e){
      return { ok: false, error: 'STEP okuyucusu dosyayı işlerken durdu: ' + (e && e.message ? e.message : e) };
    }
    onp('build', {});
    meta.wasmUrl = occt._veWasmUrl || '';
    meta.worker = false;
    var res = veStrNormalizeImport(raw, meta);
    if(!res.ok) res.error = _sgWithDiag(res.error, occt._veLog);
    return res;
  });
}

// ─── Uçtan uca içe aktarma ──────────────────────────────────────────────────
// Dosya içeriği (Uint8Array) → normalize model. Tek giriş noktası: sunum
// katmanı occt'yi doğrudan çağırmaz.
//
// opts.onProgress(stage, info) — VE_STR_STAGES sırasıyla çağrılır. Yalnız
// 'download' belirli bir yüzde taşır (info.pct); diğerleri belirsizdir.
// opts.noWorker — yedeğe zorla (test/ölçüm).
function veStrImportStep(bytes, meta, opts){
  meta = meta || {};
  opts = opts || {};
  var onp = opts.onProgress || function(){};
  var defl = meta.deflection || VE_STR_GEOM_DEFLECTION;
  meta.deflection = defl;
  meta._params = {
    linearUnit: VE_STR_GEOM_UNIT,
    linearDeflectionType: defl.type,
    linearDeflection: defl.linear,
    angularDeflection: defl.angular
  };

  var useWorker = !opts.noWorker && !opts.wasmBinary && !opts.factory && _sgWorkerSupported();
  var run = useWorker
    ? _sgImportViaWorker(bytes, meta, opts, onp)
        // Worker kurulamadıysa (CSP blob'u engelliyor, dosya yok, eski tarayıcı)
        // SESSİZCE değil ama ÇALIŞARAK yedeğe düş: kullanıcı için "hiç
        // açılmadı" ile "donarak açıldı" arasında dağlar kadar fark var.
        ['catch'](function(e){
          if(opts.noFallback) throw e;
          onp('compile', { fallback: true });
          return _sgImportMainThread(bytes, meta, opts, onp);
        })
    : _sgImportMainThread(bytes, meta, opts, onp);

  return run['catch'](function(e){
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
    veStrOcctWorker: veStrOcctWorker,
    VE_STR_STAGES: VE_STR_STAGES,
    VE_STR_OCCT_WASM_BYTES: VE_STR_OCCT_WASM_BYTES,
    VE_STR_WORKER_BRIDGE: VE_STR_WORKER_BRIDGE,
    _sgTyped: _sgTyped,
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
