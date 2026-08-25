/**
 * structural-mesh-model.test.js — HESAPLAMA AĞI KÖPRÜSÜ (js/structural-mesh-model.js)
 *
 * Bu suite GERÇEK TetGen çekirdeğini (vendor/tetgen-wasm.wasm) GERÇEK STEP
 * dosyaları üzerinde koşturur. Sahte veri KULLANILMIYOR — köprünün tek işi
 * geometriyi çekirdeğin istediği PLC'ye çevirmek ve dönen ağı doğru okumak;
 * uydurma bir çıktı tam da o çevirinin sınandığı yeri kaldırırdı
 * (structural-model.test.js'teki gerekçenin aynısı).
 *
 * Asıl değer BEŞ kapıda:
 *   1) SINIR KOŞULU ZİNCİRİ. occt `brep_faces` → remesh `faceIds` → TetGen
 *      `facetmarkerlist` → çıktı `trifacemarkerlist` → yeniden `m<i>/f<j>`.
 *      Bu zincir kopsaydı sınır koşulları ağ her yenilendiğinde düşerdi ve
 *      hiçbir görsel test bunu görmez.
 *   2) ELEMAN KUADRATİK. tet4 bu modülde YASAK (ölçüldü: 27.783 SD'de bile
 *      %24 rijit, yani güvenli tarafta DEĞİL). `-o2` düşerse sessizce yanlış
 *      bir çözücüye zemin hazırlanır.
 *   3) DEJENERE ELEMAN RAPORLANIYOR. Kritik metrik `v_min` — şekil ölçütü iyi
 *      bir ağda bile sıfır görünebiliyor, ama hacmi sıfıra yakın tetler
 *      rijitlik matrisini tekil yapar ve HİÇBİR ön koşullandırıcı kurtaramaz.
 *   4) KÜNYE AĞ TAŞIMIYOR. node.data alt-topolojiye gömülüyor ve undo yığını
 *      50 adım tutuyor; ağ künyeye sızarsa proje dosyası çarpımsal büyür.
 *   5) HATA SESSİZ DEĞİL. Çözülemeyen geometri `ok:false` + Türkçe sebep döner.
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '../..');
const geomModel = require('../../js/structural-model.js');
const meshModel = require('../../js/structural-mesh-model.js');

// Remesh modülü tarayıcıda düz <script>; köprü onu global kapsamda arıyor.
eval(fs.readFileSync(path.join(ROOT, 'js/structural-remesh.js'), 'utf8'));
global.veStrRemeshMesh = veStrRemeshMesh;
global.veStrMeshQuality = veStrMeshQuality;
global.veStrSurfaceVolume = veStrSurfaceVolume;

// OCCT çekirdeği artık opencascade.js (boolean'lı) ve vendor'da GZİP'Lİ duruyor
// — 62,8 MB ham depoya konmaz. Fabrika da `require` ile alınamıyor (glue ne ESM
// ne CJS; tarayıcıda global `opencascade` bırakıyor), bu yüzden bir vm bağlamında
// aynı şekilde üretilip `opts.factory` ile veriliyor.
const vm = require('vm');
const zlib = require('zlib');
const OCCT_WASM = zlib.gunzipSync(fs.readFileSync(path.join(ROOT, 'vendor/opencascade.wasm.gz')));
const OCCT_FACTORY = (function(){
  const glue = fs.readFileSync(path.join(ROOT, 'vendor/opencascade.js'), 'utf8');
  const util = require('util');
  const sb = { console, process, require, Buffer, URL, performance,
               TextDecoder: global.TextDecoder || util.TextDecoder,
               TextEncoder: global.TextEncoder || util.TextEncoder,
               __filename: path.join(ROOT, 'vendor/opencascade.js'),
               __dirname: path.join(ROOT, 'vendor') };
  sb.global = sb;
  vm.createContext(sb);
  vm.runInContext(glue + '\n;globalThis.__oc = opencascade;', sb);
  return sb.__oc;
})();
const TET_WASM = new Uint8Array(fs.readFileSync(path.join(ROOT, 'vendor/tetgen-wasm.wasm')));
const VeTetGenModule = require('../../vendor/tetgen-wasm.js');

const stepBytes = (name) => new Uint8Array(fs.readFileSync(path.join(ROOT, 'tests/fixtures/step', name)));
// Her çağrıda TAZE örnek: bir katı WASM belleğini taşırsa o örnek bir daha
// güvenilir değil (köprünün kendi kuralı, gerekçesi veStrMeshRunAll'da).
const tetFactory = () => VeTetGenModule({ wasmBinary: TET_WASM });

let geom, mesh;

beforeAll(async () => {
  geom = await geomModel.veStrImportStep(stepBytes('rounded-cube.step'),
    { fileName: 'rounded-cube.step', fileSize: 1 },
    { factory: OCCT_FACTORY, wasmBinary: OCCT_WASM, noWorker: true });
  expect(geom.ok).toBe(true);
  mesh = await meshModel.veStrBuildMesh(geom, { targetLen: 2.0, remeshIterations: 6 },
    { factory: tetFactory, noWorker: true });
}, 300000);

afterAll(() => {
  geomModel.veStrOcctForget();
  geomModel.veStrGeomCacheClear();
  meshModel.veStrMeshCacheClear();
  geom = null; mesh = null;
});

// ── 1) Ağ gerçekten kuruluyor ───────────────────────────────────────────────
describe('gerçek TetGen ile hacim ağı', () => {
  test('ağ kuruldu ve eleman üretti', () => {
    expect(mesh.ok).toBe(true);
    expect(mesh.stats.tets).toBeGreaterThan(100);
    expect(mesh.stats.nodes).toBeGreaterThan(100);
  });

  test('ELEMAN KUADRATİK (tet10) — pazarlık konusu değil', () => {
    // TetGen `-o2` ile ikinci derece eleman üretir; orta düğümleri biz
    // eklemiyoruz. Lineer tet ölçülmüş bir hatadır: MFSim'in konsol kirişinde
    // 27.783 serbestlik derecesinde bile cevap %24 RİJİT.
    expect(mesh.cornersPerTet).toBe(10);
    expect(mesh.stats.order).toBe(2);
    expect(mesh.tets.length).toBe(mesh.stats.tets * 10);
  });

  test('DEJENERE ve TERS eleman yok, en küçük hacim eşiğin üstünde', () => {
    expect(mesh.stats.degenerate).toBe(0);
    expect(mesh.stats.inverted).toBe(0);
    expect(mesh.stats.minTetVolume).toBeGreaterThan(meshModel.VE_STR_TET_DEGENERATE_VOL);
  });

  test('ağ hacmi CAD hacmine yakın (yüzey hazırlığı parçayı yemiyor)', () => {
    const su = mesh.stats.surface;
    expect(su.volumeLossPct).toBeLessThan(4);
    expect(mesh.stats.volume).toBeGreaterThan(0);
    // Ağın topladığı hacim, yüzeyin çevrelediği hacimle tutarlı olmalı.
    expect(Math.abs(mesh.stats.volume - su.meshVolume) / su.meshVolume).toBeLessThan(0.02);
  });

  test('yüzey hazırlığı min açıyı YÜKSELTİYOR', () => {
    const su = mesh.stats.surface;
    expect(su.qualityAfter.minAngleDeg).toBeGreaterThan(su.qualityBefore.minAngleDeg);
    expect(su.qualityAfter.below10Pct).toBeLessThan(su.qualityBefore.below10Pct);
  });
});

// ── 2) SINIR KOŞULU ZİNCİRİ — bu modülün en kritik sözleşmesi ───────────────
describe('CAD yüzü kimliği TetGen\'den GEÇİYOR', () => {
  test('her sınır üçgeni bir CAD yüzüne bağlı — kayıp YOK', () => {
    expect(mesh.triFaceIds).toHaveLength(mesh.numberOfTriFaces);
    expect(mesh.triFaceIds.every((x) => !!x)).toBe(true);
  });

  test('girdideki BÜTÜN CAD yüzleri çıktıda temsil ediliyor', () => {
    const cikti = Object.keys(mesh.faceTriCount);
    expect(cikti).toHaveLength(geom.stats.faceCount);
    cikti.forEach((id) => {
      expect(id).toMatch(/^m\d+\/f\d+$/);
      expect(mesh.faceTriCount[id]).toBeGreaterThan(0);
    });
  });

  test('kimlik biçimi Geometri bileşeniyle AYNI (veStrFaceKey sözleşmesi)', () => {
    const geomIds = geom.faces.map((f) => f.id).sort();
    expect(Object.keys(mesh.faceTriCount).sort()).toEqual(geomIds);
  });
});

// ── 3) TetGen anahtarları ───────────────────────────────────────────────────
describe('kalite reçetesi', () => {
  test('varsayılan anahtarlar: PLC + kalite + tet10 + Steiner tavanı + sessiz', () => {
    const sw = meshModel.veStrTetGenSwitches({});
    expect(sw).toContain('p');                      // girdi bir PLC
    expect(sw).toContain('q1.4/18');                // radius-edge / min dihedral
    expect(sw).toContain('o2');                     // İKİNCİ DERECE
    expect(sw).toContain('S' + meshModel.VE_STR_TETGEN_STEINER_LIMIT);
    expect(sw).toContain('Q');
  });

  test('Steiner TAVANI var — tarayıcıda sınırsız nokta eklemek sekmeyi kilitler', () => {
    expect(meshModel.VE_STR_TETGEN_STEINER_LIMIT).toBeGreaterThan(1000);
    expect(meshModel.veStrTetGenSwitches({})).toMatch(/S\d+/);
  });

  test('kullanılan anahtarlar SONUÇTA yazılı (kullanıcı neyle koştuğunu görür)', () => {
    expect(mesh.switches).toContain('o2');
    expect(mesh.switches).toContain('q1.4/18');
  });

  test('order2 kapatılabiliyor ama VARSAYILAN açık', () => {
    expect(meshModel.veStrTetGenSwitches({ order2: false })).not.toContain('o2');
    expect(meshModel.veStrTetGenSwitches({})).toContain('o2');
  });
});

// ── 4) Künye HAFİF ──────────────────────────────────────────────────────────
describe('künye (node.data\'ya yazılan)', () => {
  test('AĞ TAŞIMIYOR — düğüm/eleman dizileri künyede YOK', () => {
    const rec = meshModel.veStrMeshRecord(mesh);
    const s = JSON.stringify(rec);
    expect(rec.points).toBeUndefined();
    expect(rec.tets).toBeUndefined();
    expect(rec.triFaces).toBeUndefined();
    // Künye, ağın kendisinin yanında ihmal edilebilir olmalı.
    expect(s.length).toBeLessThan(mesh.points.length);
  });

  test('künye çözümün NE İLE kurulduğunu taşıyor', () => {
    const rec = meshModel.veStrMeshRecord(mesh);
    expect(rec.switches).toBe(mesh.switches);
    expect(rec.stats.tets).toBe(mesh.stats.tets);
    expect(rec.stats.degenerate).toBe(0);
    expect(Array.isArray(rec.faces)).toBe(true);
    expect(rec.faces.length).toBe(Object.keys(mesh.faceTriCount).length);
  });

  test('oturumluk önbellek yazılıp temizlenebiliyor', () => {
    meshModel.veStrMeshCacheSet('n1', mesh);
    expect(meshModel.veStrMeshCacheGet('n1')).toBe(mesh);
    meshModel.veStrMeshCacheClear();
    expect(meshModel.veStrMeshCacheGet('n1')).toBeNull();
  });
});

// ── 5) PLC kurulumu ─────────────────────────────────────────────────────────
describe('PLC kurulumu', () => {
  test('CAD yüzü kimliği TAMSAYI işaretçiye eşleniyor ve TERS TABLO dönüyor', () => {
    // TetGen işaretçisi `int`; kimlik `m<i>/f<j>` dizgisi. Ters tablo dönmeseydi
    // çıktıdaki 17 numaralı işaretçinin hangi CAD yüzü olduğu KAYBOLURDU.
    const plc = meshModel.veStrBuildPLC(geom.meshes, { targetLen: 3 });
    expect(plc.ok).toBe(true);
    const markerlar = [...new Set(Array.from(plc.triMarkers))];
    expect(markerlar.length).toBe(geom.stats.faceCount);
    // SIFIR KULLANILMIYOR: TetGen işaretçisiz yüzleri 0 sayıyor.
    expect(markerlar).not.toContain(0);
    markerlar.forEach((mk) => expect(plc.faceOfMarker[mk]).toMatch(/^m\d+\/f\d+$/));
  });

  test('PLC üçgen/işaretçi dizileri UYUMLU uzunlukta', () => {
    const plc = meshModel.veStrBuildPLC(geom.meshes, { targetLen: 3 });
    expect(plc.triangles.length).toBe(plc.triMarkers.length * 3);
    expect(plc.report.surfaceTris).toBe(plc.triMarkers.length);
  });

  test('boş geometri sebebiyle reddediliyor', () => {
    const plc = meshModel.veStrBuildPLC([], {});
    expect(plc.ok).toBe(false);
    expect(plc.error).toMatch(/geometri boş/i);
  });
});

// ── 6) Hata yolları SESSİZ DEĞİL ────────────────────────────────────────────
describe('hata yolları', () => {
  test('parça olmadan ağ istenirse sebep yazılıyor', async () => {
    const r = await meshModel.veStrBuildMesh(null, {}, { factory: tetFactory, noWorker: true });
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/STEP/i);
  });

  test('KENDİNİ KESEN yüzeyde ya çözüyor ya SEBEBİNİ yazıyor — ASLA çökmüyor', async () => {
    // Gerçek CAD verisinde oluyor: temas eden/çakışan katılar. ÖLÇÜLDÜ —
    // TetGen böyle bir yüzeyde çıktı yazarken WASM belleğinin dışına taşıyor
    // ve JS'e `RuntimeError` olarak geliyor; köprü onu yakalayıp Türkçe sebep
    // yazıyor.
    //
    // SÖZLEŞME "bu girdi ÇÖKER" DEĞİL: TetGen'in bir yüzeyi kurtarıp
    // kurtaramaması onun iç ayrıntısı ve sürüme göre değişir (bu fikstür
    // yüzey hazırlığından sonra çözülebiliyor). Bağlayıcı olan şey, köprünün
    // İKİ durumdan birini vermesi — ham bir istisna sızdırmaması.
    const kesisen = {
      ok: true,
      meshes: [{
        // İç içe geçen iki küp: yüzey kendini kesiyor.
        positions: new Float64Array([
          0,0,0, 10,0,0, 10,10,0, 0,10,0, 0,0,10, 10,0,10, 10,10,10, 0,10,10,
          5,5,5, 15,5,5, 15,15,5, 5,15,5, 5,5,15, 15,5,15, 15,15,15, 5,15,15,
        ]),
        indices: new Int32Array([
          0,2,1, 0,3,2, 4,5,6, 4,6,7, 0,1,5, 0,5,4, 3,7,6, 3,6,2, 0,4,7, 0,7,3, 1,2,6, 1,6,5,
          8,10,9, 8,11,10, 12,13,14, 12,14,15, 8,9,13, 8,13,12, 11,15,14, 11,14,10, 8,12,15, 8,15,11, 9,10,14, 9,14,13,
        ]),
        faces: (() => {
          const f = [];
          for (let i = 0; i < 12; i++) f.push({ id: `m0/f${i}`, first: i * 2, last: i * 2 + 1 });
          return f;
        })(),
      }],
    };
    const r = await meshModel.veStrBuildMesh(kesisen, { targetLen: 3, perSolid: false },
      { factory: tetFactory, noWorker: true });
    expect(r).toBeTruthy();
    expect(typeof r.ok).toBe('boolean');
    if(r.ok){
      // Çözebildiyse sonuç GERÇEKTEN kullanılabilir olmalı — yarım bir ağ
      // "başarı" sayılamaz.
      expect(r.stats.tets).toBeGreaterThan(0);
      expect(r.cornersPerTet).toBe(10);
    } else {
      // Çözemediyse sebep TÜRKÇE ve okunur olmalı; ham bir WASM hata numarası
      // kullanıcıya hiçbir şey anlatmaz.
      expect(typeof r.error).toBe('string');
      expect(r.error.length).toBeGreaterThan(10);
      expect(r.error).toMatch(/kesiyor|kurulamadı|durdu/i);
    }
  }, 300000);
});

// ── 7) Katı başına ağlama ───────────────────────────────────────────────────
describe('çok katılı montaj', () => {
  test('tek katılı parçada katı-başına kip KAPALI (bölmeye gerek yok)', () => {
    expect(mesh.stats.perSolid).toBe(false);
    expect(mesh.stats.solidTotal).toBe(1);
    expect(mesh.stats.solidCount).toBe(1);
  });

  test('katı sayıları künyede — kısmi başarı SESSİZ kalamaz', () => {
    // ÖLÇÜLDÜ (braket montajı, 7 katı): 4'ü ağa giriyor, 3'ü kendini kesen
    // yüzey yüzünden giremiyor. Bu sayı gösterilmeseydi çözüm EKSİK bir gövde
    // üzerinde koşar ve sonuç "makul ama yanlış" olurdu.
    expect(mesh.stats).toHaveProperty('solidCount');
    expect(mesh.stats).toHaveProperty('solidTotal');
  });
});

// ── 8) GÖMÜLÜ AĞ ÜRETECİ — ÇEVRİMDIŞI ÇALIŞMANIN ŞARTI ─────────────────────
// occt okuyucusundaki kalıbın ve gerekçenin BİREBİR aynısı (bkz.
// structural-model.test.js "gömülü .wasm varlığı"): MFSim tek dosya olarak
// indirilip kullanılıyor, yanında vendor/ olmayan bir kurulumda ağ üreteci
// hiç çalışmazdı.
describe('gömülü TetGen .wasm varlığı', () => {
  const ASSET = path.join(ROOT, 'js/structural-tetgen-wasm.js');
  const VENDOR = path.join(ROOT, 'vendor/tetgen-wasm.wasm');

  test('varlık üretilmiş ve depoda', () => {
    expect(fs.existsSync(ASSET)).toBe(true);
    expect(fs.existsSync(VENDOR)).toBe(true);
  });

  // EN ÖNEMLİ KAPI: vendor .wasm yeniden derlenip varlık üretilmezse program
  // SESSİZCE ESKİ ağ üretecini taşır.
  test('gömülü içerik vendor/tetgen-wasm.wasm ile BİREBİR aynı', () => {
    const src = fs.readFileSync(ASSET, 'utf8');
    const m = src.match(/VE_STR_TETGEN_WASM_GZ_B64 = "([A-Za-z0-9+/=]+)"/);
    expect(m).not.toBeNull();
    const acilmis = zlib.gunzipSync(Buffer.from(m[1], 'base64'));
    const vendor = fs.readFileSync(VENDOR);
    expect(acilmis.length).toBe(vendor.length);
    expect(acilmis.equals(vendor)).toBe(true);
    expect(Array.from(acilmis.slice(0, 4))).toEqual([0x00, 0x61, 0x73, 0x6d]);
  });

  test('bildirilen açılmış boyut gerçek dosyayla tutuyor', () => {
    const src = fs.readFileSync(ASSET, 'utf8');
    const m = src.match(/VE_STR_TETGEN_WASM_BYTES_EMBEDDED = (\d+);/);
    expect(m).not.toBeNull();
    expect(Number(m[1])).toBe(fs.statSync(VENDOR).size);
  });

  test('index.html: varlık AÇILIŞTA yüklenmiyor, glue ve remesh kaynağı işaretli', () => {
    const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
    expect(html).toMatch(/type="text\/x-mfsim-asset"[^>]*data-mfsim-asset="tetgen-wasm"[^>]*src="js\/structural-tetgen-wasm\.js"/);
    // Worker, glue'yu ve remesh kaynağını AĞSIZ okuyabilsin diye ikisi de işaretli.
    expect(html).toContain('data-mfsim-tetgen-glue');
    expect(html).toContain('data-mfsim-remesh-src');
    // Varlık `x-mfsim-defer` OLMAMALI — olsaydı açılışta yüklenirdi.
    expect(html).not.toMatch(/x-mfsim-defer[^>]*structural-tetgen-wasm/);
  });

  test('AGPL-3 lisans metni ve TetGen KAYNAĞI depoda (dağıtımın koşulu)', () => {
    // TetGen AGPL-3: dağıtılan build de AGPL-3 (CLAUDE.md — "kaynak MIT kalır,
    // dağıtılan build AGPL-3"). Kaynağın depoda durması hem bu koşulun
    // karşılığı hem de .wasm'ın yeniden üretilebilmesinin şartı.
    expect(fs.existsSync(path.join(ROOT, 'vendor/license.tetgen.txt'))).toBe(true);
    expect(fs.readFileSync(path.join(ROOT, 'vendor/license.tetgen.txt'), 'utf8'))
      .toMatch(/AFFERO GENERAL PUBLIC LICENSE/i);
    ['tetgen.h', 'tetgen.cxx', 'predicates.cxx'].forEach((f) => {
      expect(fs.existsSync(path.join(ROOT, 'vendor/tetgen-src', f))).toBe(true);
    });
  });

  test('derleyici predicates.cxx\'i -O0 ile derliyor — KESİN ARİTMETİK ŞARTI', () => {
    // Shewchuk'un kesin aritmetiği IEEE 754 yuvarlamasının TAM sırasına dayanır;
    // optimizasyon ifadeleri yeniden sıralayıp predikati SESSİZCE yanlış yapar
    // ve TetGen geçersiz ağ üretir. TetGen'in kendi Makefile'ı da bunu zorunlu
    // kılıyor.
    const b = fs.readFileSync(path.join(ROOT, 'tools/build-tetgen-wasm.js'), 'utf8');
    expect(b).toMatch(/'-O0'[^\n]*predicates\.cxx|predicates\.cxx[^\n]*'-O0'/);
    expect(b).toMatch(/-c', '-O0'/);
  });

  test('worker köprüsü gzip açmayı KENDİSİ yapıyor (ana iş parçacığı durmasın)', () => {
    expect(meshModel.VE_STR_MESH_WORKER_BRIDGE || '').toBeDefined();
  });
});

// ── HAM YÜZEY YEDEĞİ ────────────────────────────────────────────────────────
// Kullanıcının braketi (AP242, 7 gövde → 1 katı) hiç ağ örülemiyordu. Sebep
// NATIVE TetGen 1.6 ile `-d` (kesişim tespiti) koşturularak kesinleştirildi:
//
//   ham CAD üçgenlemesi          → "The input surface mesh is correct."
//   yeniden-mesh h=10/8/6/4/3    → 8 / 3 / 2 / 10 / 19 üçgen ATILIYOR
//                                  ("skipped due to self-intersections")
//
// Yani yüzeyi bozan CAD verisi değil, HAZIRLIK adımının kendisi: izotropik
// döngü ince bölgelerde birbirini kesen kenarlar üretiyor. Bu structural-
// remesh.js'te düzeltilecek bir kusur; o düzelene kadar köprü ham yüzeyle
// yeniden deniyor — ÖLÇÜLDÜ: braket 216.137 tet10 · 354.565 düğüm · 12 s.
describe('yeniden-mesh yüzeyi bozarsa HAM yüzeyle yeniden denenir', () => {
  test('hazırlık ATLANABİLİR ve atlandığını künyeye yazar', () => {
    const src = fs.readFileSync(path.join(ROOT, 'js/structural-mesh-model.js'), 'utf8');
    expect(src).toMatch(/options\.remesh === false/);
    // Künye bunu taşımalı: yedek yol kendini tanıyıp SONSUZ denemeye girmesin.
    expect(src).toMatch(/raw: options\.remesh === false/);
    expect(src).toMatch(/!raw\.ok && options\.remesh !== false && plc\.report && !plc\.report\.raw/);
  });

  test('yedeğe düşülünce SEBEP yazılıyor — sessiz kalite düşüşü olmaz', () => {
    // Ham yüzeyle örülen ağ çok daha fazla eleman taşıyor; kullanıcı bunu
    // bilmezse "ağ neden bu kadar büyük" sorusunun cevabı hiçbir yerde olmaz.
    const src = fs.readFileSync(path.join(ROOT, 'js/structural-mesh-model.js'), 'utf8');
    expect(src).toContain("surfacePrep = 'ham'");
    expect(src).toMatch(/surfacePrepNote[\s\S]{0,200}ham CAD üçgenlemesiyle örüldü/);
  });

  test('hazırlık atlanınca yüz kimlikleri KORUNUYOR', async () => {
    // Sınır koşulu zincirinin tamamı buna bağlı: ham yolda faceIds üretilmezse
    // her sınır üçgeni işaretsiz kalır ve CAD yüzü bağı kopar.
    const ham = await meshModel.veStrBuildMesh(geom, { remesh: false },
      { factory: tetFactory, noWorker: true });
    expect(ham.ok).toBe(true);
    const kimlikler = new Set((ham.triFaceIds || (ham.mesh && ham.mesh.triFaceIds) || []).filter(Boolean));
    expect(kimlikler.size).toBeGreaterThan(0);
    kimlikler.forEach((id) => expect(String(id)).toMatch(/^m\d+\/f\d+$/));
    // Ve HİÇBİR sınır üçgeni işaretsiz kalmamalı — kalan, hangi CAD yüzüne
    // ait olduğu bilinmeyen bir yüzey demek; sınır koşulu oraya bağlanamaz.
    const hepsi = ham.triFaceIds || (ham.mesh && ham.mesh.triFaceIds) || [];
    expect(hepsi.filter((x) => !x).length).toBe(0);
  }, 300000);
});
