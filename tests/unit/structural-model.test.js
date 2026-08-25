/**
 * structural-model.test.js — YAPISAL ANALİZ geometri köprüsü (js/structural-model.js)
 *
 * Bu suite GERÇEK STEP dosyalarını GERÇEK OCCT çekirdeğiyle okutur
 * (tests/fixtures/step/*.step + vendor/occt-import-js.wasm). Sahte veri
 * KULLANILMIYOR: köprünün tek işi ham occt çıktısını doğru çevirmek, sahte bir
 * çıktı uydurmak tam da o çevirinin sınandığı yeri kaldırırdı.
 *
 * Asıl değer beş kapıda:
 *   1) YÜZ KİMLİĞİ AĞ İNCELİĞİNDEN BAĞIMSIZ. Modülün en kritik özelliği:
 *      sınır koşulu CAD yüzüne bağlanacak, yakınsama çalışması ise ağı
 *      defalarca yenileyecek. Kimlik incelikle değişseydi her yenilemede
 *      bütün sınır koşulları düşerdi — ve bunu hiçbir görsel test görmez.
 *   2) YÜZ ARALIKLARI ÜÇGENLERİ TAM BÖLER. `first`/`last` anlamı sessizce
 *      kayarsa (0-tabanlı ↔ 1-tabanlı, kapsayan ↔ kapsamayan) geometri yine
 *      kusursuz görünür ama yüz seçimi YANLIŞ üçgenleri toplar.
 *   3) KÜNYE ÜÇGEN TAŞIMAZ. node.data alt-topolojiye gömülüyor; üçgenler
 *      künyeye sızarsa proje dosyası çarpımsal büyür (veSanitizeEmbeddedState'in
 *      savaştığı hata sınıfı).
 *   4) BİRİM mm'YE ÇEVRİLİYOR. Sessiz 25.4× hatası bir gerilme analizinde
 *      felakettir ve ekranda kusursuz görünür.
 *   5) HATA SESSİZ DEĞİL. Okunamayan dosya `ok:false` + Türkçe sebep döner;
 *      undefined/boş sonuç dönmez.
 */
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const model = require('../../js/structural-model.js');

const vm = require('vm');

const ROOT = path.join(__dirname, '../..');
// Vendor .wasm DEPODA GZİP'Lİ duruyor (62,8 MB ham depoya konmaz).
const WASM = zlib.gunzipSync(fs.readFileSync(path.join(ROOT, 'vendor/opencascade.wasm.gz')));
const stepBytes = (name) =>
  new Uint8Array(fs.readFileSync(path.join(ROOT, 'tests/fixtures/step', name)));

// OCCT glue'su bir ESM değil (vendor'a alınırken `export default` çıkarıldı)
// ama `module.exports` da yazmıyor → `require` ile alınamaz. Tarayıcıda global
// `opencascade` olarak duruyor; burada onu bir vm bağlamında aynı şekilde
// üretip `opts.factory` ile veriyoruz. Sahte fabrika DEĞİL — vendor'daki
// dosyanın ta kendisi.
function occtFactory(){
  const glue = fs.readFileSync(path.join(ROOT, 'vendor/opencascade.js'), 'utf8');
  // jsdom ortamında TextDecoder/TextEncoder global DEĞİL; emscripten glue'su
  // onları arıyor → node:util'den veriliyor.
  const util = require('util');
  const sb = { console, process, require, Buffer, URL, performance,
               TextDecoder: global.TextDecoder || util.TextDecoder,
               TextEncoder: global.TextEncoder || util.TextEncoder,
               __filename: path.join(ROOT, 'vendor/opencascade.js'), __dirname: path.join(ROOT, 'vendor') };
  sb.global = sb;
  vm.createContext(sb);
  vm.runInContext(glue + '\n;globalThis.__oc = opencascade;', sb);
  return sb.__oc;
}
const FACTORY = occtFactory();

// OCCT yüklemesi (62,8 MB WASM derlemesi) pahalı → suite başına BİR kez.
const imp = (name, deflection, extra) =>
  model.veStrImportStep(stepBytes(name), { fileName: name, fileSize: 123, deflection },
    Object.assign({ factory: FACTORY, wasmBinary: WASM, noWorker: true }, extra || {}));

let cube, rounded, bracket;
beforeAll(async () => {
  cube = await imp('cube-mm.step');
  rounded = await imp('rounded-cube.step');
  bracket = await imp('multibody-bracket.step');
}, 240000);

// Derlenmiş WASM örneği (7.3 MB) suite sonunda BIRAKILMALI: tutulursa jest
// worker'ı teardown'da zorla kapatılıyor ("failed to exit gracefully").
afterAll(() => {
  model.veStrOcctForget();
  model.veStrGeomCacheClear();
  cube = null; rounded = null; bracket = null;
});

// ── 1) İçe aktarma gerçekten oluyor mu ──────────────────────────────────────
describe('gerçek STEP dosyası okunuyor', () => {
  test('küp: 1 katı · 12 üçgen · 6 CAD yüzü', () => {
    expect(cube.ok).toBe(true);
    expect(cube.stats.meshCount).toBe(1);
    expect(cube.stats.triCount).toBe(12);
    expect(cube.stats.faceCount).toBe(6);
  });

  test('BİRİM mm — dosyanın kendi birimi okunup çevriliyor', () => {
    // cube-mm.step 1000 mm'lik bir küp. Çevrim atlanırsa ya da yanlış
    // birim istenirse bu sayı 25.4× / 1000× kayar ve ekranda FARK EDİLMEZ.
    expect(cube.unit).toBe('millimeter');
    cube.bbox.size.forEach((s) => expect(s).toBeCloseTo(1000, 3));
    expect(cube.bbox.diag).toBeCloseTo(Math.sqrt(3) * 1000, 2);
    expect(cube.bbox.center).toEqual([500, 500, 500]);
  });

  test('üçgen verisi TİPLİ dizi — kutulanmış JS dizisi değil', () => {
    // 100 bin üçgenlik bir brakette düz JS dizisi megabaytlarca kutulanmış
    // sayı demek; çeviri BURADA bir kez yapılır, her çizimde değil.
    expect(cube.meshes[0].positions).toBeInstanceOf(Float32Array);
    expect(cube.meshes[0].indices).toBeInstanceOf(Uint32Array);
  });
});

// ── 2) EN KRİTİK KAPI: yüz kimliği ağ inceliğinden bağımsız ────────────────
describe('CAD yüz kimliği ağ inceliğiyle DEĞİŞMEZ', () => {
  const kaba = { type: 'bounding_box_ratio', linear: 0.1, angular: 0.5 };
  const ince = { type: 'bounding_box_ratio', linear: 0.0005, angular: 0.5 };

  test('yuvarlatılmış küp: üçgen sayısı değişir, yüz kimlikleri AYNI kalır', async () => {
    const a = await imp('rounded-cube.step', kaba);
    const b = await imp('rounded-cube.step', ince);

    const idsA = a.faces.map((f) => f.id);
    const idsB = b.faces.map((f) => f.id);
    expect(idsA).toEqual(idsB);                       // kimlik: birebir aynı
    expect(a.stats.faceCount).toBe(b.stats.faceCount);

    // Ağ GERÇEKTEN değişmeli — yoksa test hiçbir şey sınamıyor demektir.
    expect(b.stats.triCount).toBeGreaterThan(a.stats.triCount);
  }, 120000);

  test('yüz kimliği mesh+yüz indisinden türer, üçgen sayısından DEĞİL', () => {
    expect(model.veStrFaceKey(0, 3)).toBe('m0/f3');
    expect(model.veStrFaceKey(2, 0)).toBe('m2/f0');
    cube.faces.forEach((f, i) => expect(f.id).toBe('m0/f' + i));
  });
});

// ── 3) Yüz aralıkları üçgenleri TAM böler ──────────────────────────────────
describe('brep_faces aralıkları üçgenleri boşluksuz ve örtüşmesiz kaplar', () => {
  const bol = (g) => {
    g.meshes.forEach((m) => {
      const kapsam = new Uint8Array(m.triCount);
      m.faces.forEach((f) => {
        expect(f.first).toBeGreaterThanOrEqual(0);
        expect(f.last).toBeLessThan(m.triCount);
        for (let t = f.first; t <= f.last; t++) kapsam[t]++;
      });
      // Her üçgen TAM BİR yüze ait: 0 → yüzsüz üçgen, 2 → iki yüze birden.
      for (let t = 0; t < m.triCount; t++) expect(kapsam[t]).toBe(1);
    });
  };

  test('küp', () => bol(cube));
  test('yuvarlatılmış küp', () => bol(rounded));

  test('triCount alanı aralıkla tutarlı', () => {
    cube.faces.forEach((f) => expect(f.triCount).toBe(f.last - f.first + 1));
    // Küpte her yüz iki üçgen — aralık anlamı (kapsayan) sessizce kayarsa bu düşer.
    cube.faces.forEach((f) => expect(f.triCount).toBe(2));
  });

  test('veStrFaceOfTriangle her üçgeni doğru yüze eşliyor', () => {
    const m = rounded.meshes[0];
    for (let t = 0; t < m.triCount; t++) {
      const f = model.veStrFaceOfTriangle(rounded, 0, t);
      expect(f).not.toBeNull();
      expect(t).toBeGreaterThanOrEqual(f.first);
      expect(t).toBeLessThanOrEqual(f.last);
    }
    // Aralık dışı → null (sessiz yanlış yüz DEĞİL)
    expect(model.veStrFaceOfTriangle(rounded, 0, m.triCount + 5)).toBeNull();
    expect(model.veStrFaceOfTriangle(rounded, 99, 0)).toBeNull();
  });
});

// ── 4) Kalıcı künye — üçgen TAŞIMAZ ────────────────────────────────────────
describe('veStrGeomRecord: node.data\'ya yazılan künye hafif', () => {
  test('üçgen/köşe dizileri künyeye SIZMIYOR', () => {
    const rec = model.veStrGeomRecord(cube);
    const json = JSON.stringify(rec);
    expect(rec.meshes).toBeUndefined();
    // Tipli diziler JSON'da nesneye dönüşür ("0":1.5,...) — sızarsa künye şişer.
    expect(json.length).toBeLessThan(4000);
    expect(json).not.toMatch(/positions|indices|normals/);
  });

  test('yüz künyesi kimlik + üçgen sayısı taşıyor (sınır koşulu buna bağlanacak)', () => {
    const rec = model.veStrGeomRecord(cube);
    expect(rec.faces).toHaveLength(6);
    // Parça adı artık DOSYA ADINDAN geliyor: birleştirmeden sonra STEP'in
    // ürün adları anlamını yitiriyor (yedi gövde tek katı oldu).
    expect(rec.faces[0]).toEqual({ id: 'm0/f0', meshName: 'cube-mm', triCount: 2 });
    expect(rec.stats.faceCount).toBe(6);
    expect(rec.bbox.size[0]).toBeCloseTo(1000, 3);
  });

  test('çözülemeyen geometri künye üretmez', () => {
    expect(model.veStrGeomRecord(null)).toBeNull();
    expect(model.veStrGeomRecord({ ok: false })).toBeNull();
  });
});

// ── 5) Hata SESSİZ değil ───────────────────────────────────────────────────
describe('hata çevirisi', () => {
  test('STEP olmayan içerik → ok:false + Türkçe sebep', async () => {
    const cop = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]);
    const r = await model.veStrImportStep(cop, { fileName: 'x.step' }, { wasmBinary: WASM });
    expect(r.ok).toBe(false);
    expect(typeof r.error).toBe('string');
    expect(r.error.length).toBeGreaterThan(10);
    expect(r.error).not.toMatch(/undefined|NaN|\[object/);
  }, 120000);

  test('boş çıktı → okunamadı; üçgensiz çıktı → AYRI sebep', () => {
    const a = model.veStrNormalizeImport(null, {});
    const b = model.veStrNormalizeImport({ positions: new Float32Array(0), indices: new Uint32Array(0), triCount: 0, faces: [] }, {});
    expect(a.ok).toBe(false);
    expect(b.ok).toBe(false);
    // İki sebep AYNI olsaydı kullanıcı "dosya bozuk" ile "içinde katı yok"u
    // ayırt edemezdi — ikincisinde dosya gayet sağlam.
    expect(a.error).not.toBe(b.error);
    expect(b.error).toMatch(/katı|geometri/i);
  });
});

// ── 6) Sınır kutusu ────────────────────────────────────────────────────────
describe('veStrGeomBBox', () => {
  test('boş girdide null — 0×0×0 DEĞİL', () => {
    // 0 dönseydi kamera çerçeveleme sıfıra bölerdi ve künye "0 mm" yazardı.
    expect(model.veStrGeomBBox([])).toBeNull();
    expect(model.veStrGeomBBox([{ positions: new Float32Array(0) }])).toBeNull();
  });

  test('birden çok katıyı birlikte kapsıyor', () => {
    const bb = model.veStrGeomBBox([
      { positions: new Float32Array([0, 0, 0, 1, 1, 1]) },
      { positions: new Float32Array([-2, 0, 0, 0, 5, 0]) },
    ]);
    expect(bb.min).toEqual([-2, 0, 0]);
    expect(bb.max).toEqual([1, 5, 1]);
    expect(bb.size).toEqual([3, 5, 1]);
  });
});

// ── 7) Oturumluk önbellek — proje değişince temizlenmeli ───────────────────
describe('geometri önbelleği oturumluk', () => {
  test('yaz / oku / tek düğüm sil / hepsini sil', () => {
    model.veStrGeomCacheSet('n1', { ok: true, tag: 'a' });
    model.veStrGeomCacheSet('n2', { ok: true, tag: 'b' });
    expect(model.veStrGeomCacheGet('n1').tag).toBe('a');

    model.veStrGeomCacheClear('n1');
    expect(model.veStrGeomCacheGet('n1')).toBeNull();
    expect(model.veStrGeomCacheGet('n2').tag).toBe('b');

    // Argümansız → HEPSİ. Proje değişince çağrılan yol bu; tek düğüm silseydi
    // yeni projede önceki projenin parçası görüntüleyicide kalırdı.
    model.veStrGeomCacheClear();
    expect(model.veStrGeomCacheGet('n2')).toBeNull();
  });
});

// ── 8) BOOLEAN — çok gövdeli CAD dosyası TEK KATIYA iner ──────────────────
// Bu modülün YENİ ÇEKİRDEK istemesinin tek sebebi bu: eski okuyucuda
// (occt-import-js) boolean YOKTU, ve birbirine değen ama ayrı duran katıların
// yüzey üçgenlemesi arayüzde uyuşmadığı için tet ağ örücüsü kendi kendini
// kesen bir girdi görüyordu.
//
// Kapı SAYIYA değil DEĞİŞMEZE bakıyor: katı sayısı 1'e iner, hacim korunur
// (ya da örtüşme kadar azalır), yüz aralıkları üçgenleri hâlâ tam böler.
describe('çok gövdeli parça TEK KATIYA birleştiriliyor', () => {
  test('7 gövdeli braket → 1 katı', () => {
    expect(bracket.ok).toBe(true);
    expect(bracket.fuse.istendi).toBe(true);
    expect(bracket.fuse.ok).toBe(true);
    expect(bracket.fuse.once).toBe(7);
    expect(bracket.stats.solidCount).toBe(1);
    expect(bracket.stats.solidCountBefore).toBe(7);
    // Tek üçgen tamponu: ağ örücüye tek nesne gider.
    expect(bracket.meshes).toHaveLength(1);
  });

  test('birleşim gerçekten YAPILDI — yüzler imprint edildi, dikişler silindi', () => {
    // Ham hâlde 7 gövde = 30 yüz (plaka 6 + iki kulak 6+6 + dört silindir 3'er).
    // Birleşince 18: iç duvarlar gitti, plakanın üstü delikleriyle TEK yüz oldu.
    // Sayının kendisi değil, KÜÇÜLMESİ anlamlı — kaynaşma olmasaydı 30 kalırdı.
    expect(bracket.stats.faceCount).toBe(18);
    expect(bracket.stats.faceCount).toBeLessThan(30);
  });

  test('hacim korunuyor — kayıp yalnız ÖRTÜŞEN gövdelerin ortak hacmi kadar', () => {
    const f = bracket.fuse;
    // Bu fixture'da göbekler plakanın İÇİNE giriyor → birleşim hacmi toplamdan
    // küçük olmalı ama parçanın kendisinden büyük kalmalı.
    expect(f.hacimSonra).toBeLessThan(f.hacimOnce);
    expect(f.hacimSonra).toBeGreaterThan(f.hacimOnce * 0.9);
    // Sınır kutusu değişmedi: birleştirme parçayı büyütüp küçültmez.
    expect(bracket.bbox.size[0]).toBeCloseTo(60, 3);
    expect(bracket.bbox.size[1]).toBeCloseTo(40, 3);
    expect(bracket.bbox.size[2]).toBeCloseTo(31, 3);
  });

  test('birleştirmeden SONRA da yüz aralıkları üçgenleri TAM bölüyor', () => {
    let bek = 0;
    bracket.faces.forEach((f) => {
      if (f.triCount === 0) return;
      expect(f.first).toBe(bek);
      bek = f.last + 1;
    });
    expect(bek).toBe(bracket.stats.triCount);
  });

  test('tek katılı dosyada boolean HİÇ ÇALIŞMIYOR', () => {
    // Gereksiz bir BOP, küçük bir parçada bile yüz milisaniye ve —daha
    // kötüsü— topolojiyi gereksizce yeniden kurma riski demek.
    expect(cube.fuse.istendi).toBe(false);
    expect(cube.stats.solidCount).toBe(1);
  });

  test('fuse KAPATILABİLİR ve kapalıyken gövdeler ayrı kalır', async () => {
    const ham = await imp('multibody-bracket.step', undefined, { fuse: false });
    expect(ham.fuse.istendi).toBe(false);
    expect(ham.stats.solidCount).toBe(7);
    expect(ham.stats.faceCount).toBe(30);          // birleşmemiş yüz sayısı
    expect(ham.stats.faceCount).toBeGreaterThan(bracket.stats.faceCount);
  }, 120000);

  test('birleştirme künyeye GİRİYOR — panel sessiz kalamasın', () => {
    const rec = model.veStrGeomRecord(bracket);
    expect(rec.fuse.ok).toBe(true);
    expect(rec.fuse.once).toBe(7);
    expect(rec.fuse.sonra).toBe(1);
    expect(rec.stats.solidCountBefore).toBe(7);
    // Künye hâlâ HAFİF: üçgen taşımıyor.
    expect(JSON.stringify(rec)).not.toContain('positions');
  });
});

// ── 9) Okuyucunun kendi teşhisi kullanıcıya ULAŞIYOR ──────────────────────
describe('OCCT teşhisi hata mesajına iliştiriliyor', () => {
  test('bozuk STEP: genel cümlenin yanında okuyucunun teşhisi de var', async () => {
    // YENİ ÇEKİRDEKTE TEŞHİS İSTENMEDEN GELMİYOR — ölçüldü: bozuk bir dosyada
    // print/printErr'e SIFIR satır düşüyor. Eski okuyucu kendiliğinden
    // yazıyordu; bu çekirdekte `PrintCheckLoad` çağrılmazsa kullanıcı yalnız
    // "dosya okunamadı" görür ve dosyanın mı programın mı sorunlu olduğunu
    // ayırt edemez. Kapı o çağrının YAPILDIĞINI sınıyor.
    const bozuk = new Uint8Array(Buffer.from('ISO-10303-21;\nHEADER_BOZUK;\n', 'utf8'));
    const r = await model.veStrImportStep(bozuk, { fileName: 'bozuk.step' },
      { factory: FACTORY, wasmBinary: WASM, noWorker: true });
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/teşhisi/);
    expect(r.error).toMatch(/check|data|entity|step/i);
  }, 120000);

  test('teşhis en fazla iki satır — durum satırına on satır dökülmüyor', () => {
    const uzun = Array.from({ length: 20 }, (_, i) => '**** ERR StepFile : Undefined hata-' + i + ' ****');
    const out = model._sgWithDiag('Temel mesaj.', uzun);
    expect(out).toContain('hata-0');
    expect(out).toContain('hata-1');
    expect(out).not.toContain('hata-2');
    // Gürültü öneki/soneki eleniyor
    expect(out).not.toContain('****');
    expect(out).not.toMatch(/ERR StepFile/);
  });

  test('teşhis yoksa mesaj OLDUĞU GİBİ kalır', () => {
    expect(model._sgWithDiag('Temel mesaj.', [])).toBe('Temel mesaj.');
    expect(model._sgWithDiag('Temel mesaj.', null)).toBe('Temel mesaj.');
  });
});

// ── 10) WORKER'A TAŞIMA ────────────────────────────────────────────────────
// STEP çözümlemesi ana iş parçacığında değil worker'da koşuyor. Worker'ın
// KENDİSİ ancak gerçek tarayıcıda sınanabilir (jsdom'da Worker yok) →
// tests/e2e/structural-geometry.spec.js orada kare sayarak ölçüyor.
// Burada worker'a taşımanın SAF sözleşmeleri sınanıyor.
describe('worker köprüsü — sözleşme', () => {
  const src = model.VE_STR_WORKER_BRIDGE;

  test('protokolün dört mesajı da köprüde geçiyor', () => {
    ['"init"', '"step"', '"ready"', '"result"', '"error"', '"fatal"'].forEach((k) => {
      expect(src).toContain(k);
    });
  });

  test('köprü DOM\'a dokunmuyor — worker\'da document/window YOK', () => {
    // Bir `document.` sızarsa worker açılır açılmaz patlar ve içe aktarma
    // sessizce ana iş parçacığı yedeğine düşerdi: yani "çalışıyor" görünürken
    // donmaya geri dönerdik.
    expect(src).not.toMatch(/\bdocument\./);
    expect(src).not.toMatch(/\bwindow\./);
  });

  test('sonuç TRANSFER ile dönüyor — kopyalanmıyor', () => {
    // Düz kopya 45 bin üçgende ikinci bir maliyet; transfer sıfır kopya.
    expect(src).toMatch(/postMessage\(\{ type:"result"[\s\S]*?\},\s*\n?\s*\[g\.positions\.buffer, g\.normals\.buffer, g\.indices\.buffer\]\)/);
  });

  test('AŞAMA bildirimi worker\'dan geliyor — boolean saniyeler sürebilir', () => {
    // Birleştirme 18 katılı bir montajda 15 s sürebiliyor (ölçüldü). Worker
    // aşama bildirmeseydi kullanıcı "Geometri çözümleniyor" yazısına 15 saniye
    // bakardı — ilerleme göstergesinin var oluş sebebi yok olurdu.
    expect(src).toContain('"stage"');
    expect(src).toContain('onStage');
  });

  test('BORU HATTI worker\'a kaynak metin olarak giriyor — ikinci kopya YOK', () => {
    // Tek kaynak kuralı: ana iş parçacığı yedeği ile worker AYNI fonksiyonu
    // koşuyor. İki kopya tutulsaydı ayrışma sessiz olurdu — worker yolu
    // çalışırken yedek yol başka bir geometri üretirdi.
    const model_src = fs.readFileSync(path.join(ROOT, 'js/structural-model.js'), 'utf8');
    expect(model_src).toContain('_sgOcctPipeline.toString()');
    expect(src).toContain('_sgOcctPipeline(_oc');
    expect(model_src).toMatch(/function _sgImportMainThread[\s\S]{0,600}_sgOcctPipeline\(oc,/);
    // Boru hattı DIŞARIYA BAŞVURMAMALI: worker'a metin olarak gidiyor, dış
    // bir yardımcıya başvursaydı orada tanımsız olurdu.
    const fn = model._sgOcctPipeline.toString();
    ['_sgNum(', '_sgTyped(', 'veStrFaceKey(', 'VE_STR_GEOM_'].forEach((ad) => {
      expect(fn).not.toContain(ad);
    });
  });

  test('BOOLEAN worker tarafında koşuyor — ana iş parçacığı kilitlenmiyor', () => {
    const fn = model._sgOcctPipeline.toString();
    expect(fn).toContain('BRepAlgoAPI_Fuse_1');
    expect(fn).toContain('ShapeUpgrade_UnifySameDomain_2');
  });
});

describe('worker sonucu ana iş parçacığında normalize ediliyor', () => {
  // Worker, boru hattının ÇIKTISINI olduğu gibi gönderiyor (tipli diziler +
  // yüz aralıkları). Normalize onu model biçimine çeviriyor.
  const workerRaw = {
    positions: new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1]),
    normals: new Float32Array(12),
    indices: new Uint32Array([0, 1, 2, 0, 1, 3]),
    faces: [{ index: 0, first: 0, last: 0, triCount: 1 },
            { index: 1, first: 1, last: 1, triCount: 1 }],
    triCount: 2,
    solidCount: 1,
    volume: 0,
    fuse: { istendi: false, ok: false, once: 1, sonra: 1, ms: 0, hata: '' }
  };

  test('tipli dizilerle gelen mesh çözülüyor', () => {
    const g = model.veStrNormalizeImport(workerRaw, { fileName: 'w.step' });
    expect(g.ok).toBe(true);
    expect(g.stats.triCount).toBe(2);
    expect(g.stats.faceCount).toBe(2);
    expect(g.faces[1].id).toBe('m0/f1');
  });

  test('zaten tipli olan dizi YENİDEN KOPYALANMIYOR', () => {
    // 100 bin üçgende gereksiz kopya megabaytlarca bellek ve duraklama demek.
    const g = model.veStrNormalizeImport(workerRaw, {});
    expect(g.meshes[0].positions).toBe(workerRaw.positions);
    expect(g.meshes[0].indices).toBe(workerRaw.indices);
  });

  test('_sgTyped: tip uyuyorsa aynı nesne, uymuyorsa çevirir', () => {
    const f = new Float32Array([1, 2, 3]);
    expect(model._sgTyped(Float32Array, f)).toBe(f);
    const conv = model._sgTyped(Float32Array, [1, 2, 3]);
    expect(conv).toBeInstanceOf(Float32Array);
    expect(Array.from(conv)).toEqual([1, 2, 3]);
    expect(model._sgTyped(Float32Array, null)).toBeNull();
  });

  test('worker bayrağı sonuca geçiyor — panel donmanın SEBEBİNİ yazabilsin', () => {
    expect(model.veStrNormalizeImport(workerRaw, { worker: true }).worker).toBe(true);
    expect(model.veStrNormalizeImport(workerRaw, {}).worker).toBe(false);
  });
});

// ── 11) İLERLEME ───────────────────────────────────────────────────────────
// Çekirdek GÖMÜLÜ olduğu için "indiriliyor" diye bir aşama YOK; ağdan indirme
// yolu tamamen kalktı (vendor dosyası zaten gzip'li, yani DecompressionStream
// bilmeyen tarayıcıda yedek de açılamazdı — var olmayan bir durumu kurtaran
// bir yol taşımanın karşılığı yoktu).
describe('ilerleme bildirimi', () => {
  test('aşama adları sabit ve BOOLEAN kendi aşamasını taşıyor', () => {
    expect(model.VE_STR_STAGES).toEqual(['reader', 'parse', 'fuse', 'build']);
    // 'download' KALKTI: gömülü çekirdek indirilmiyor.
    expect(model.VE_STR_STAGES).not.toContain('download');
  });

  test('çok gövdeli dosyada aşamalar SIRAYLA bildiriliyor, fuse dahil', async () => {
    const gorulen = [];
    const g = await model.veStrImportStep(
      stepBytes('multibody-bracket.step'), { fileName: 'mb.step', fileSize: 1 },
      { factory: FACTORY, wasmBinary: WASM, noWorker: true,
        onProgress: (st) => { if (gorulen[gorulen.length - 1] !== st) gorulen.push(st); } });
    expect(g.ok).toBe(true);
    expect(gorulen).toContain('parse');
    expect(gorulen).toContain('fuse');
    expect(gorulen).toContain('build');
    // Sıra anlamlı: birleştirme çözümlemeden SONRA, ağ örmeden ÖNCE.
    expect(gorulen.indexOf('fuse')).toBeGreaterThan(gorulen.indexOf('parse'));
    expect(gorulen.indexOf('build')).toBeGreaterThan(gorulen.indexOf('fuse'));
  }, 120000);

  test('tek katılı dosyada fuse aşaması HİÇ bildirilmiyor', async () => {
    const gorulen = [];
    await model.veStrImportStep(
      stepBytes('rounded-cube.step'), { fileName: 'r.step', fileSize: 1 },
      { factory: FACTORY, wasmBinary: WASM, noWorker: true,
        onProgress: (st) => gorulen.push(st) });
    // Olmayan bir işi bildirmek, kullanıcının okuduğu her satırı şüpheli yapar.
    expect(gorulen).not.toContain('fuse');
  }, 120000);
});

// ── 12) GÖMÜLÜ OKUYUCU — ÇEVRİMDIŞI ÇALIŞMANIN ŞARTI ──────────────────────
// .wasm artık uygulamanın içinde (js/structural-occt-wasm.js). Eskiden
// `vendor/` yolundan indiriliyordu ve yanında vendor/ olmayan bir kurulumda
// STEP hiç açılmıyordu. Gerçek tarayıcıdaki uçtan uca kapı
// tests/e2e/structural-geometry.spec.js'te (ağ kesikken içe aktarma).
describe('gömülü .wasm varlığı', () => {
  const ASSET = path.join(ROOT, 'js/structural-occt-wasm.js');
  const VENDOR = path.join(ROOT, 'vendor/opencascade.wasm.gz');

  test('vendor .wasm depoda ve GERÇEKTEN bir WebAssembly ikilisi', () => {
    // Ham 62,8 MB depoya konmaz → gzip'li duruyor. LGPL-2.1'in "kütüphane
    // değiştirilebilir olmalı" koşulu bununla karşılanıyor.
    expect(fs.existsSync(VENDOR)).toBe(true);
    const ham = zlib.gunzipSync(fs.readFileSync(VENDOR));
    expect(Array.from(ham.slice(0, 4))).toEqual([0x00, 0x61, 0x73, 0x6d]);
    expect(fs.existsSync(path.join(ROOT, 'vendor/opencascade.js'))).toBe(true);
    expect(fs.existsSync(path.join(ROOT, 'vendor/license.occt.txt'))).toBe(true);
    expect(fs.existsSync(path.join(ROOT, 'vendor/license.opencascade-js.txt'))).toBe(true);
  });

  test('üretilen varlık vendor dosyasıyla BİREBİR aynı', () => {
    // Varlık artık git'e dahil DEĞİL, her `npm run build` yeniden üretiyor →
    // "vendor güncellendi, varlık bayat kaldı" sınıfı ortadan kalktı. Ama
    // varlık ÜRETİLMİŞSE içeriği vendor'la aynı olmalı: üreteç yanlış dosyayı
    // gömerse program sessizce başka bir çekirdek taşırdı.
    if (!fs.existsSync(ASSET)) return;                       // henüz üretilmemiş
    const src = fs.readFileSync(ASSET, 'utf8');
    const m = src.match(/VE_STR_OCCT_WASM_GZ_B64 = "([A-Za-z0-9+/=]+)"/);
    expect(m).not.toBeNull();
    expect(Buffer.from(m[1], 'base64').equals(fs.readFileSync(VENDOR))).toBe(true);
  });

  test('bildirilen açılmış boyut gerçek dosyayla tutuyor', () => {
    if (!fs.existsSync(ASSET)) return;
    const src = fs.readFileSync(ASSET, 'utf8');
    const m = src.match(/VE_STR_OCCT_WASM_BYTES_EMBEDDED = (\d+);/);
    expect(m).not.toBeNull();
    expect(Number(m[1])).toBe(zlib.gunzipSync(fs.readFileSync(VENDOR)).length);
  });

  test('gzip GERÇEKTEN kazandırıyor — ham base64 çok daha büyük olurdu', () => {
    const ham = zlib.gunzipSync(fs.readFileSync(VENDOR)).length;
    const gz = fs.statSync(VENDOR).size;
    // Ölçüldü: 62,8 MB → 13,1 MB (base64 sonrası 17,5 MB). Ham base64 83,8 MB
    // olurdu; yani gömme maliyeti beşte bire iniyor.
    expect(gz).toBeLessThan(ham * 0.35);
    expect(gz * 4 / 3).toBeLessThan(ham * 4 / 3 * 0.35);
  });

  test('index.html: varlık AÇILIŞTA yüklenmiyor, glue metni işaretli', () => {
    const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
    expect(html).toMatch(/type="text\/x-mfsim-asset"[^>]*data-mfsim-asset="occt-wasm"[^>]*src="js\/structural-occt-wasm\.js"/);
    expect(html).toMatch(/src="vendor\/opencascade\.js"[^>]*data-mfsim-occt-glue/);
    // x-mfsim-defer olsaydı AÇILIŞTA yüklenirdi — 17,5 MB'lık bir dizgiyi her
    // açılışta okumak, kullanıcı hiç STEP açmayacak olsa bile.
    expect(html).not.toMatch(/x-mfsim-defer[^>]*structural-occt-wasm/);
  });

  test('worker köprüsü gzip açmayı KENDİSİ yapıyor (ana iş parçacığı durmasın)', () => {
    expect(model.VE_STR_WORKER_BRIDGE).toContain('DecompressionStream');
    expect(model.VE_STR_WORKER_BRIDGE).toContain('atob');
  });

  test('varlık git\'e dahil DEĞİL — .gitignore\'da', () => {
    const gi = fs.readFileSync(path.join(ROOT, '.gitignore'), 'utf8');
    expect(gi).toMatch(/^js\/structural-occt-wasm\.js$/m);
  });
});

// ── 13) STEP KAYNAĞI node.data'DA DURMAZ ──────────────────────────────────
// ÖLÇÜLDÜ (gerçek tarayıcı, 140 KB'lık STEP):
//   kaynak node.data'dayken   saveState 2,17 ms · 20 adım yığın 3,14 MB
//   oturumluk depodayken      saveState 0,12 ms · 20 adım yığın  184 KB
// Sebep: saveState() bütün node.data'yı derin kopyalıyor ve yığın 50 adım
// tutuyor; ayrıca otomatik localStorage yedeği (kota ~5-10 MB) aynı yoldan
// geçiyor. Kaynak yalnız proje DOSYASINA yazılır.
describe('kaynak deposu — dosyaya yazılır, undo yığınına binmez', () => {
  const bytes = new Uint8Array([73, 83, 79, 45, 49, 48]);   // "ISO-10"

  beforeEach(() => model.veStrSrcClear());
  afterAll(() => model.veStrSrcClear());

  const dugum = (id) => ({
    id: id, type: 'str-geometry',
    data: { geometry: { fileName: 'x.step', fileSize: 6, stats: {}, faces: [] } },
  });

  test('veStrSrcAttach KOPYALA-YAZ — girdiyi DEĞİŞTİRMİYOR', () => {
    // BU KAPI GERÇEK BİR HATADAN DOĞDU. İlk sürüm yerinde yazıyordu; ama
    // veSanitizeNodesSubtopology (topology.js) hiçbir şey değişmediyse AYNI
    // diziyi döndürüyor, dolayısıyla kaynak CANLI tab.state'e sızıyor ve
    // otomatik yedeğe de giriyordu (ölçüldü: yedek 9,9 KB yerine 46,4 KB).
    const r = model.veStrSrcSet('n1', bytes, 'x.step', 6);
    r.gzB64 = 'SAHTE_GZIP';                      // sıkıştırma bitmiş gibi

    const canli = [dugum('n1')];
    const tabs = [{ state: { nodes: canli } }];
    const n = model.veStrSrcAttach(tabs);

    expect(n).toBe(1);
    // ÇIKTIDA var
    expect(tabs[0].state.nodes[0].data.geometry.sourceGz).toBe('SAHTE_GZIP');
    // GİRDİDE yok — tek bir alan bile yazılmamış
    expect(canli[0].data.geometry.sourceGz).toBeUndefined();
    expect(canli[0].data.geometry.source).toBeUndefined();
    expect(tabs[0].state.nodes).not.toBe(canli);            // dizi kopyalandı
    expect(tabs[0].state.nodes[0]).not.toBe(canli[0]);      // düğüm kopyalandı
  });

  test('alt-topolojideki geometri düğümüne de ulaşıyor', () => {
    const ic = dugum('n9');
    const dis = { id: 'mod', type: 'structural-analysis', data: { subTopology: { nodes: [ic] } } };
    const r = model.veStrSrcSet('n9', bytes, 'x.step', 6);
    r.gzB64 = 'GZ';

    const tabs = [{ state: { nodes: [dis] } }];
    expect(model.veStrSrcAttach(tabs)).toBe(1);
    expect(tabs[0].state.nodes[0].data.subTopology.nodes[0].data.geometry.sourceGz).toBe('GZ');
    // Canlı ağaç yine dokunulmamış
    expect(ic.data.geometry.sourceGz).toBeUndefined();
    expect(dis.data.subTopology.nodes[0]).toBe(ic);
  });

  test('deposu olmayan düğüme hiçbir şey yazılmıyor ve KOPYA da üretilmiyor', () => {
    const canli = [dugum('yok')];
    const tabs = [{ state: { nodes: canli } }];
    expect(model.veStrSrcAttach(tabs)).toBe(0);
    // Değişiklik yoksa gereksiz kopya üretilmemeli (topology.js ile aynı kural)
    expect(tabs[0].state.nodes).toBe(canli);
  });

  test('veStrSrcHarvest eski projelerin HAM kaynağını da kabul ediyor', async () => {
    // Önceki sürümler node.data.geometry.source'a düz metin yazıyordu.
    const onceki = global.TextEncoder;
    global.TextEncoder = require('util').TextEncoder;
    try {
      const n = dugum('n3');
      n.data.geometry.source = 'ISO-10303-21;';
      const st = { nodes: [n] };
      await model.veStrSrcHarvest(st);
      // node.data'dan ÇIKARILDI
      expect(n.data.geometry.source).toBeUndefined();
      // ve depoya alındı
      const r = model.veStrSrcGet('n3');
      expect(r).not.toBeNull();
      expect(r.bytes.length).toBe('ISO-10303-21;'.length);
    } finally { global.TextEncoder = onceki; }
  });

  test('veStrSrcWillPersist depoya göre cevap veriyor', () => {
    expect(model.veStrSrcWillPersist('yok')).toBe(false);
    model.veStrSrcSet('n5', bytes, 'x.step', 6);
    expect(model.veStrSrcWillPersist('n5')).toBe(true);
    model.veStrSrcClear('n5');
    expect(model.veStrSrcWillPersist('n5')).toBe(false);
  });

  test('saklama sınırı SIKIŞTIRILMIŞ boyuta konuyor (dosyaya giden o)', () => {
    // STEP metni ~4,6-5,3× sıkışıyor; base64 sonrası net kazanç ~4× (ölçüldü),
    // yani 8 MB'lık sınır kabaca 30 MB'lık ham STEP'e karşılık geliyor.
    expect(model.VE_STR_SRC_STORE_LIMIT).toBe(8 * 1024 * 1024);
  });
});
